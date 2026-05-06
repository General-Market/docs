//! Materializer for `account_pnl_curve`.
//!
//! For each `(account, bucket_secs)` it walks bucket-by-bucket from the
//! cursor (or the account's earliest position event) up to the current
//! head, joining `account_vault_positions` against `vault_snapshots` to
//! produce a single (portfolio_value, cost_basis, pnl, realized_pnl) row
//! per bucket.
//!
//! Two entry points:
//!   - `spawn(pool)` — long-running task, ticks every 60s for the live tail.
//!   - `run_oneshot(args)` — CLI subcommand for the catch-up sweep.
//!
//! The job is idempotent: `ON CONFLICT (account, bucket_secs, bucket_ts) DO UPDATE`
//! lets us re-run any window without erasing newer rows.

use chrono::{DateTime, Duration, TimeZone, Utc};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::config::BuildAccountPnlCurveArgs;

const DEFAULT_BUCKETS: &[i64] = &[300, 2100, 10800, 21600];
/// Per-bucket retention. Anything older is dropped from the curve table on
/// every catch-up run; the position ledger keeps the underlying data forever.
const RETENTION_DAYS: &[(i64, i64)] = &[(300, 7), (2100, 30), (10800, 365), (21600, 36500)];

pub fn spawn(pool: PgPool) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let pool = Arc::new(pool);
        let mut tick = tokio::time::interval(std::time::Duration::from_secs(60));
        tick.tick().await; // skip immediate
        loop {
            tick.tick().await;
            for &bucket_secs in DEFAULT_BUCKETS {
                if let Err(e) = sweep_all_accounts(&pool, bucket_secs, None, None).await {
                    warn!(?e, bucket_secs, "account_pnl_curve live sweep failed");
                }
            }
            if let Err(e) = enforce_retention(&pool).await {
                warn!(?e, "account_pnl_curve retention failed");
            }
        }
    })
}

pub async fn run_oneshot(
    args: BuildAccountPnlCurveArgs,
) -> Result<(), Box<dyn std::error::Error>> {
    init_logging(&args.log_level);

    let pool = match PgPool::connect(&args.database_url).await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("DB connect: {e}");
            std::process::exit(1);
        }
    };

    let buckets: Vec<i64> = if args.bucket_secs.is_empty() {
        DEFAULT_BUCKETS.to_vec()
    } else {
        args.bucket_secs
    };

    let account_filter = args
        .account
        .as_deref()
        .and_then(|s| parse_address(s));

    let max_lookback = args.max_lookback_days.map(Duration::days);

    for bucket_secs in &buckets {
        info!(bucket_secs = *bucket_secs, "starting catch-up sweep");
        if let Err(e) = sweep_all_accounts(&pool, *bucket_secs, account_filter, max_lookback).await {
            eprintln!("sweep failed for bucket={}: {}", bucket_secs, e);
        }
    }

    if let Err(e) = enforce_retention(&pool).await {
        warn!(?e, "retention pass failed");
    }

    Ok(())
}

async fn sweep_all_accounts(
    pool: &PgPool,
    bucket_secs: i64,
    only_account: Option<[u8; 20]>,
    max_lookback: Option<Duration>,
) -> Result<(), sqlx::Error> {
    // Gather every account that has position activity. Cheap — the unique
    // accounts list rarely exceeds a few thousand rows even at saturation.
    let accounts: Vec<Vec<u8>> = if let Some(a) = only_account {
        vec![a.to_vec()]
    } else {
        sqlx::query_scalar("SELECT DISTINCT account FROM account_vault_positions")
            .fetch_all(pool)
            .await?
    };

    let now_bucket = floor_bucket(Utc::now(), bucket_secs);

    for account in accounts {
        if account.len() != 20 {
            continue;
        }
        let mut bytes = [0u8; 20];
        bytes.copy_from_slice(&account);

        if let Err(e) =
            sweep_one_account(pool, bytes, bucket_secs, now_bucket, max_lookback).await
        {
            warn!(?e, ?bytes, bucket_secs, "sweep_one_account failed");
        }
    }

    Ok(())
}

async fn sweep_one_account(
    pool: &PgPool,
    account: [u8; 20],
    bucket_secs: i64,
    now_bucket: DateTime<Utc>,
    max_lookback: Option<Duration>,
) -> Result<(), sqlx::Error> {
    // Resume from cursor if present; otherwise start at the account's first
    // position event (or `max_lookback` ago, whichever is later).
    let cursor: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT last_bucket FROM account_pnl_curve_cursors
         WHERE account = $1 AND bucket_secs = $2",
    )
    .bind(account.as_ref())
    .bind(bucket_secs)
    .fetch_optional(pool)
    .await?;

    let earliest: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT MIN(block_time) FROM account_vault_positions WHERE account = $1",
    )
    .bind(account.as_ref())
    .fetch_optional(pool)
    .await?
    .flatten();

    let earliest = match earliest {
        Some(t) => t,
        None => return Ok(()),
    };
    let from_lookback = max_lookback.map(|d| now_bucket - d);

    let mut t = match (cursor, from_lookback) {
        (Some(c), _) => c + Duration::seconds(bucket_secs),
        (None, Some(lb)) => floor_bucket(earliest.max(lb), bucket_secs),
        (None, None) => floor_bucket(earliest, bucket_secs),
    };

    let mut written = 0u64;
    while t <= now_bucket {
        let row = compute_bucket(pool, &account, t).await?;
        sqlx::query(
            "INSERT INTO account_pnl_curve
                (account, bucket_secs, bucket_ts, portfolio_value, cost_basis, pnl,
                 realized_pnl, contributing_vaults, computed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (account, bucket_secs, bucket_ts) DO UPDATE
                SET portfolio_value = EXCLUDED.portfolio_value,
                    cost_basis      = EXCLUDED.cost_basis,
                    pnl             = EXCLUDED.pnl,
                    realized_pnl    = EXCLUDED.realized_pnl,
                    contributing_vaults = EXCLUDED.contributing_vaults,
                    computed_at     = NOW()",
        )
        .bind(account.as_ref())
        .bind(bucket_secs)
        .bind(t)
        .bind(row.portfolio_value)
        .bind(row.cost_basis)
        .bind(row.pnl)
        .bind(row.realized_pnl)
        .bind(row.contributing_vaults)
        .execute(pool)
        .await?;

        t += Duration::seconds(bucket_secs);
        written += 1;
    }

    if written > 0 {
        sqlx::query(
            "INSERT INTO account_pnl_curve_cursors (account, bucket_secs, last_bucket, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (account, bucket_secs) DO UPDATE
                SET last_bucket = EXCLUDED.last_bucket, updated_at = NOW()",
        )
        .bind(account.as_ref())
        .bind(bucket_secs)
        .bind(now_bucket)
        .execute(pool)
        .await?;
        debug!(?account, bucket_secs, written, "curve sweep wrote rows");
    }

    Ok(())
}

struct BucketRow {
    portfolio_value: rust_decimal::Decimal,
    cost_basis: rust_decimal::Decimal,
    pnl: rust_decimal::Decimal,
    realized_pnl: rust_decimal::Decimal,
    contributing_vaults: i32,
}

async fn compute_bucket(
    pool: &PgPool,
    account: &[u8],
    bucket_ts: DateTime<Utc>,
) -> Result<BucketRow, sqlx::Error> {
    // Two correlated lookups joined: the latest position-row per vault for
    // this account at-or-before bucket_ts, and the latest NAV snapshot per
    // vault at-or-before the same. The vault address conversion lives in
    // the JOIN so we don't depend on Postgres extensions.
    let row: (Option<rust_decimal::Decimal>, Option<rust_decimal::Decimal>, Option<rust_decimal::Decimal>, Option<i64>) = sqlx::query_as(
        r#"
        WITH pos AS (
            SELECT DISTINCT ON (vault_address)
                vault_address,
                shares_after,
                cost_basis_after,
                realized_pnl_after
            FROM account_vault_positions
            WHERE account = $1
              AND block_time <= $2
            ORDER BY vault_address, block_number DESC, log_index DESC
        ),
        nav AS (
            SELECT DISTINCT ON (vault_address)
                vault_address AS vault_text,
                nav_per_share
            FROM vault_snapshots
            WHERE created_at <= $2
            ORDER BY vault_address, created_at DESC
        )
        SELECT
            COALESCE(SUM((pos.shares_after / 1e18) * nav.nav_per_share)::numeric(38,18), 0) AS portfolio_value,
            COALESCE(SUM(pos.cost_basis_after / 1e18)::numeric(38,18), 0)            AS cost_basis,
            COALESCE(SUM(pos.realized_pnl_after / 1e18)::numeric(38,18), 0)           AS realized_pnl,
            COUNT(*) FILTER (WHERE pos.shares_after > 0)                              AS contributing_vaults
        FROM pos
        LEFT JOIN nav ON nav.vault_text = ('0x' || encode(pos.vault_address, 'hex'))
        "#,
    )
    .bind(account)
    .bind(bucket_ts)
    .fetch_one(pool)
    .await?;

    let portfolio_value = row.0.unwrap_or_default();
    let cost_basis = row.1.unwrap_or_default();
    let realized_pnl = row.2.unwrap_or_default();
    let contributing_vaults = row.3.unwrap_or(0) as i32;
    let pnl = portfolio_value - cost_basis;

    Ok(BucketRow {
        portfolio_value,
        cost_basis,
        pnl,
        realized_pnl,
        contributing_vaults,
    })
}

async fn enforce_retention(pool: &PgPool) -> Result<(), sqlx::Error> {
    for &(bucket_secs, days) in RETENTION_DAYS {
        sqlx::query(
            "DELETE FROM account_pnl_curve
             WHERE bucket_secs = $1
               AND bucket_ts < NOW() - ($2::int || ' days')::interval",
        )
        .bind(bucket_secs)
        .bind(days as i32)
        .execute(pool)
        .await?;
    }
    Ok(())
}

fn floor_bucket(ts: DateTime<Utc>, bucket_secs: i64) -> DateTime<Utc> {
    let secs = ts.timestamp();
    Utc.timestamp_opt(secs - secs.rem_euclid(bucket_secs), 0)
        .single()
        .unwrap_or(ts)
}

fn parse_address(s: &str) -> Option<[u8; 20]> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(s).ok()?;
    if bytes.len() != 20 {
        return None;
    }
    let mut out = [0u8; 20];
    out.copy_from_slice(&bytes);
    Some(out)
}

fn init_logging(level: &str) {
    use tracing_subscriber::EnvFilter;
    let filter = EnvFilter::try_new(level).unwrap_or_else(|_| EnvFilter::new("info"));
    let _ = tracing_subscriber::fmt().with_env_filter(filter).try_init();
}
