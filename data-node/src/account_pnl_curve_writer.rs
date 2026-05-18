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
    // Gather every account that has either vault position activity OR ITP
    // trade activity. The curve is now a unified vault+ITP series, so the
    // sweep must reach both populations. Cheap — the union still totals
    // a few thousand rows at saturation.
    let accounts: Vec<Vec<u8>> = if let Some(a) = only_account {
        vec![a.to_vec()]
    } else {
        sqlx::query_scalar(
            "SELECT DISTINCT account FROM (
                 SELECT account FROM account_vault_positions
                 UNION
                 SELECT decode(substring(user_address FROM 3), 'hex') AS account
                 FROM trades
                 WHERE user_address ~ '^0x[0-9a-fA-F]{40}$'
                   AND status = 2
             ) u",
        )
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

    // Earliest activity for this account, across both ledgers. LEAST in
    // Postgres ignores NULL inputs — so an account that only has vault rows
    // (or only trades) gets the right answer.
    let earliest: Option<DateTime<Utc>> = sqlx::query_scalar(
        "SELECT LEAST(
             (SELECT MIN(block_time) FROM account_vault_positions WHERE account = $1),
             (SELECT MIN(order_timestamp) FROM trades
              WHERE user_address = ('0x' || encode($1, 'hex'))
                AND status = 2
                AND fill_price IS NOT NULL
                AND fill_amount IS NOT NULL)
         )",
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

    // Start at the first bucket boundary that the user actually had a position
    // in. floor_bucket(earliest) lands BEFORE earliest when the event is mid-
    // interval, which used to produce a pre-position (0,0,0,0) row at the
    // leading edge — that row then graphed as a vertical cliff from PnL=0
    // down to the next bucket's real value. Round up when the event isn't
    // already on a boundary.
    let mut t = match (cursor, from_lookback) {
        (Some(c), _) => c + Duration::seconds(bucket_secs),
        (None, Some(lb)) => {
            let effective = earliest.max(lb);
            let start = floor_bucket(effective, bucket_secs);
            if effective > start { start + Duration::seconds(bucket_secs) } else { start }
        }
        (None, None) => {
            let start = floor_bucket(earliest, bucket_secs);
            if earliest > start { start + Duration::seconds(bucket_secs) } else { start }
        }
    };

    let mut written = 0u64;
    while t <= now_bucket {
        let row = compute_bucket(pool, &account, t).await?;
        // Defensive skip: never emit a fully-empty bucket. The cursor advance
        // above prevents it for first-event boundary cases; this catches
        // races where compute_bucket runs before fill_price/fill_amount land
        // on the trades row, or any future bug that produces (0,0,0,0).
        let is_empty = row.contributing_vaults == 0
            && row.portfolio_value.is_zero()
            && row.cost_basis.is_zero()
            && row.realized_pnl.is_zero();
        if !is_empty {
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
            written += 1;
        }

        t += Duration::seconds(bucket_secs);
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
    // For each vault this account holds, fetch the latest NAV at-or-before
    // bucket_ts via a per-vault LATERAL — scales O(account_vaults), not
    // O(all_vaults) like the prior DISTINCT ON. With 324 vaults × millions
    // of snapshot rows the prior shape took 2-3s/query; this hits the
    // (vault_address, created_at DESC) index point-wise.
    let vault_row: (Option<rust_decimal::Decimal>, Option<rust_decimal::Decimal>, Option<rust_decimal::Decimal>, Option<i64>) = sqlx::query_as(
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
        )
        SELECT
            COALESCE(SUM((pos.shares_after / 1e18) * COALESCE(nav.nav_per_share, 1.0))::numeric(38,18), 0) AS portfolio_value,
            COALESCE(SUM(pos.cost_basis_after / 1e18)::numeric(38,18), 0)            AS cost_basis,
            COALESCE(SUM(pos.realized_pnl_after / 1e18)::numeric(38,18), 0)           AS realized_pnl,
            COUNT(*) FILTER (WHERE pos.shares_after > 0)                              AS contributing_vaults
        FROM pos
        LEFT JOIN LATERAL (
            SELECT nav_per_share
            FROM vault_snapshots
            WHERE vault_address = ('0x' || encode(pos.vault_address, 'hex'))
              AND created_at <= $2
            ORDER BY created_at DESC
            LIMIT 1
        ) nav ON TRUE
        "#,
    )
    .bind(account)
    .bind(bucket_ts)
    .fetch_one(pool)
    .await?;

    // ITP leg. Sums fills up to bucket_ts per itp_id, holds the remaining
    // share count against the latest NAV at-or-before bucket_ts, and
    // accumulates total dollars bought (matches /portfolio/history's
    // monotonic cost-basis definition — sells don't reduce). The
    // (itp_id, valid_from DESC) index makes the LATERAL lookup point-wise.
    let itp_row: (Option<rust_decimal::Decimal>, Option<rust_decimal::Decimal>, Option<i64>) = sqlx::query_as(
        r#"
        WITH itp_state AS (
            SELECT
                itp_id,
                SUM(CASE WHEN side = 0 THEN fill_amount::numeric / 1e18 ELSE 0 END) AS bought_shares,
                SUM(CASE WHEN side = 0 THEN (fill_amount::numeric / 1e18) * (fill_price::numeric / 1e18) ELSE 0 END) AS bought_usd,
                SUM(CASE WHEN side = 1 THEN fill_amount::numeric / 1e18 ELSE 0 END) AS sold_shares
            FROM trades
            WHERE user_address = ('0x' || encode($1, 'hex'))
              AND status = 2
              AND fill_price IS NOT NULL
              AND fill_amount IS NOT NULL
              AND order_timestamp <= $2
            GROUP BY itp_id
        )
        SELECT
            COALESCE(SUM(GREATEST(s.bought_shares - s.sold_shares, 0) * COALESCE(nav.nav_per_share, 0))::numeric(38,18), 0) AS itp_value,
            COALESCE(SUM(s.bought_usd)::numeric(38,18), 0)                                                                 AS itp_cost,
            (COUNT(*) FILTER (WHERE s.bought_shares - s.sold_shares > 0))::bigint                                          AS itp_count
        FROM itp_state s
        LEFT JOIN LATERAL (
            SELECT nav::numeric / 1e18 AS nav_per_share
            FROM itp_snapshots
            WHERE itp_id = s.itp_id
              AND valid_from <= $2
              AND nav::numeric > 1e15
            ORDER BY valid_from DESC
            LIMIT 1
        ) nav ON TRUE
        "#,
    )
    .bind(account)
    .bind(bucket_ts)
    .fetch_one(pool)
    .await?;

    let vault_value = vault_row.0.unwrap_or_default();
    let vault_cost = vault_row.1.unwrap_or_default();
    let vault_realized = vault_row.2.unwrap_or_default();
    let vault_count = vault_row.3.unwrap_or(0) as i32;

    let itp_value = itp_row.0.unwrap_or_default();
    let itp_cost = itp_row.1.unwrap_or_default();
    let itp_count = itp_row.2.unwrap_or(0) as i32;

    let portfolio_value = vault_value + itp_value;
    let cost_basis = vault_cost + itp_cost;
    let pnl = portfolio_value - cost_basis;
    // ITP realized PnL stays implicit in the curve. Surfacing it requires
    // pro-rata cost-basis accounting per fill, which conflicts with the
    // monotonic cost basis above. The IndexTab handles its own per-position
    // realized number from a different reader.
    let realized_pnl = vault_realized;
    let contributing_vaults = vault_count + itp_count;

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

    // Purge leading pre-position artifact rows. An older writer occasionally
    // wrote a (portfolio=0, cost=0, realized=0, contributing=0) row at the
    // bucket boundary preceding an account's first event. The chart then
    // rendered the next bucket — already at a real PnL — as a vertical
    // crash from 0. The writer no longer emits these; this DELETE scrubs
    // historical residue and any future regression that lets one through.
    //
    // We bound the delete to rows strictly before each account's first
    // non-empty bucket so a legitimate "fully exited, broke even" row
    // (very rare; cost basis is monotonic, so even sells leave cost>0)
    // is preserved.
    let purged = sqlx::query(
        "DELETE FROM account_pnl_curve a
         USING (
             SELECT account, bucket_secs, MIN(bucket_ts) AS first_real
             FROM account_pnl_curve
             WHERE NOT (portfolio_value = 0 AND cost_basis = 0
                        AND realized_pnl = 0 AND contributing_vaults = 0)
             GROUP BY account, bucket_secs
         ) r
         WHERE a.account = r.account
           AND a.bucket_secs = r.bucket_secs
           AND a.bucket_ts < r.first_real
           AND a.portfolio_value = 0
           AND a.cost_basis = 0
           AND a.realized_pnl = 0
           AND a.contributing_vaults = 0",
    )
    .execute(pool)
    .await?;
    if purged.rows_affected() > 0 {
        info!(
            rows = purged.rows_affected(),
            "purged leading pre-position rows from account_pnl_curve"
        );
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
