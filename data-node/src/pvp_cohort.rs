//! Cohort rotation worker for PvP markets.
//!
//! Wakes once per minute. For every entry in the `PAIR_REGISTRY`, computes
//! the previous cohort window, reads the baseline and final values from
//! `market_prices`, scores them per format, and writes one
//! `pvp_resolutions` row. `INSERT ... ON CONFLICT DO NOTHING` makes the
//! whole loop idempotent — running twice is harmless.
//!
//! What this is *not*: an oracle. The on-chain settlement reads from
//! `/v1/pairs/{n}/price` at its own cadence. This worker only writes the
//! historical record so the frontend can show a roster archive even when
//! the markets have rotated past it.

use std::time::Duration;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use tracing::{debug, info, warn};

use crate::pvp::{Format, PairSpec, PAIR_REGISTRY};

/// Tick interval. Cams cohorts close every 2 minutes, so 60s cadence
/// is sufficient — we never miss a closing edge by more than a minute,
/// and the worker is idempotent on retry.
const TICK_SECS: u64 = 60;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        info!("pvp_cohort_worker started");
        // Kick once on startup so the very first cohort gets persisted
        // without waiting a minute.
        if let Err(e) = run_once(&pool).await {
            warn!(error = %e, "pvp_cohort_worker initial run failed");
        }
        let mut tick = tokio::time::interval(Duration::from_secs(TICK_SECS));
        tick.tick().await; // skip the immediate first tick
        loop {
            tick.tick().await;
            if let Err(e) = run_once(&pool).await {
                warn!(error = %e, "pvp_cohort_worker tick failed");
            }
        }
    });
}

async fn run_once(pool: &PgPool) -> Result<(), sqlx::Error> {
    let now = Utc::now();
    let now_secs = now.timestamp();
    let mut written = 0usize;
    let mut skipped = 0usize;

    for spec in PAIR_REGISTRY {
        let current_cohort_start = spec.cohort_start_at(now_secs);
        // Resolve the cohort that has just closed (i.e. the previous one).
        let prev_cohort_end = current_cohort_start;
        let prev_cohort_start = prev_cohort_end - spec.window_secs;

        let inserted = resolve_and_persist(pool, spec, prev_cohort_start, prev_cohort_end).await?;
        if inserted {
            written += 1;
        } else {
            skipped += 1;
        }
    }

    debug!(written, skipped, "pvp_cohort_worker tick complete");
    Ok(())
}

/// Resolve a single pair for a single cohort window. Returns true when a
/// new row was inserted. Returns false on conflict (already resolved) or
/// when the cohort hasn't gathered any data — the worker won't write a
/// stub row before observations exist.
async fn resolve_and_persist(
    pool: &PgPool,
    spec: &PairSpec,
    cohort_start: i64,
    cohort_end: i64,
) -> Result<bool, sqlx::Error> {
    // Skip cohorts that haven't closed yet. Belt-and-suspenders against
    // a minute-tick edge race.
    if cohort_end > Utc::now().timestamp() {
        return Ok(false);
    }

    // Idempotent guard. Saves a query roundtrip if the row already exists.
    let exists: Option<(i32,)> = sqlx::query_as(
        "SELECT 1 FROM pvp_resolutions WHERE pair_index = $1 AND cohort_start = $2",
    )
    .bind(spec.pair_index as i32)
    .bind(cohort_start)
    .fetch_optional(pool)
    .await?;
    if exists.is_some() {
        return Ok(false);
    }

    let (source, asset_a, asset_b) = spec.db_keys();
    let start_dt = DateTime::from_timestamp(cohort_start, 0).unwrap_or_else(Utc::now);
    let end_dt = DateTime::from_timestamp(cohort_end, 0).unwrap_or_else(Utc::now);

    let baseline_a = value_at_or_before(pool, source, &asset_a, start_dt).await?;
    let baseline_b = value_at_or_before(pool, source, &asset_b, start_dt).await?;
    let final_a = value_at_or_before(pool, source, &asset_a, end_dt).await?;
    let final_b = value_at_or_before(pool, source, &asset_b, end_dt).await?;

    // If we don't have at least the closing observations on both sides,
    // wait — the next tick will retry. F1 also needs both baselines.
    let need_baselines = matches!(spec.format, Format::F1GainRace);
    if final_a.is_none()
        || final_b.is_none()
        || (need_baselines && (baseline_a.is_none() || baseline_b.is_none()))
    {
        // Once the cohort end is well in the past and observations still
        // haven't arrived, write a 'missing' row so the archive moves on.
        let stale_after = cohort_end + spec.window_secs * 2;
        if Utc::now().timestamp() < stale_after {
            return Ok(false);
        }
        return persist_missing(pool, spec, cohort_start, cohort_end).await;
    }

    let fa = final_a.unwrap();
    let fb = final_b.unwrap();
    let (score, winner): (rust_decimal::Decimal, &'static str) = match spec.format {
        Format::F2ViewerTotal => {
            let s = &fa - &fb;
            let w = winner_label(&s);
            (s, w)
        }
        Format::F1GainRace => {
            let ba = baseline_a.clone().unwrap();
            let bb = baseline_b.clone().unwrap();
            let da = &fa - &ba;
            let db = &fb - &bb;
            let s = &da - &db;
            let w = winner_label(&s);
            (s, w)
        }
    };

    sqlx::query(
        r#"
        INSERT INTO pvp_resolutions
            (pair_index, board, format, cohort_start, cohort_end,
             slug_a, slug_b, baseline_a, baseline_b, final_a, final_b,
             score, winner)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (pair_index, cohort_start) DO NOTHING
        "#,
    )
    .bind(spec.pair_index as i32)
    .bind(spec.board.as_str())
    .bind(spec.format.as_str())
    .bind(cohort_start)
    .bind(cohort_end)
    .bind(spec.slug_a)
    .bind(spec.slug_b)
    .bind(baseline_a)
    .bind(baseline_b)
    .bind(Some(fa))
    .bind(Some(fb))
    .bind(Some(score))
    .bind(winner)
    .execute(pool)
    .await?;

    Ok(true)
}

async fn persist_missing(
    pool: &PgPool,
    spec: &PairSpec,
    cohort_start: i64,
    cohort_end: i64,
) -> Result<bool, sqlx::Error> {
    let res = sqlx::query(
        r#"
        INSERT INTO pvp_resolutions
            (pair_index, board, format, cohort_start, cohort_end,
             slug_a, slug_b, winner)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'missing')
        ON CONFLICT (pair_index, cohort_start) DO NOTHING
        "#,
    )
    .bind(spec.pair_index as i32)
    .bind(spec.board.as_str())
    .bind(spec.format.as_str())
    .bind(cohort_start)
    .bind(cohort_end)
    .bind(spec.slug_a)
    .bind(spec.slug_b)
    .execute(pool)
    .await?;
    Ok(res.rows_affected() > 0)
}

fn winner_label(score: &rust_decimal::Decimal) -> &'static str {
    if score.is_sign_negative() {
        "b"
    } else if score.is_zero() {
        "tie"
    } else {
        "a"
    }
}

async fn value_at_or_before(
    pool: &PgPool,
    source: &str,
    asset_id: &str,
    at_ts: DateTime<Utc>,
) -> Result<Option<rust_decimal::Decimal>, sqlx::Error> {
    let row: Option<(rust_decimal::Decimal,)> = sqlx::query_as(
        r#"
        SELECT value
        FROM market_prices
        WHERE source = $1 AND asset_id = $2 AND fetched_at <= $3
        ORDER BY fetched_at DESC
        LIMIT 1
        "#,
    )
    .bind(source)
    .bind(asset_id)
    .bind(at_ts)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(v,)| v))
}

