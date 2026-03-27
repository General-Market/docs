//! 4-hour epoch points system.
//!
//! Every 4 hours (wall-clock aligned to 00:00/04:00/08:00/12:00/16:00/20:00 UTC),
//! aggregates all `vision_round_players` rows settled in the epoch window,
//! computes points per player, and upserts into `vision_player_points`.
//!
//! Points formula per round:
//!   base       = 10
//!   volume     = deposited (in USDC, 18-dec → human units)
//!   accuracy   = (correct_count / total_markets) * 50
//!   round_pts  = base + volume + accuracy
//!
//! Epoch points = sum of round_pts across all rounds in the 4-hour window.

use chrono::{Utc, Duration, Timelike};
use sqlx::PgPool;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tracing::{info, warn, error};

const EPOCH_HOURS: i64 = 4;

/// Returns the start of the current 4-hour epoch (wall-clock aligned).
fn current_epoch_start() -> chrono::DateTime<Utc> {
    let now = Utc::now();
    let hour = now.hour() as i64;
    let epoch_hour = (hour / EPOCH_HOURS) * EPOCH_HOURS;
    now.date_naive()
        .and_hms_opt(epoch_hour as u32, 0, 0)
        .unwrap()
        .and_utc()
}

/// Returns seconds until the next epoch boundary.
fn seconds_until_next_epoch() -> u64 {
    let next = current_epoch_start() + Duration::hours(EPOCH_HOURS);
    let diff = next.signed_duration_since(Utc::now());
    diff.num_seconds().max(1) as u64
}

/// Row from aggregating vision_round_players within an epoch window.
#[derive(Debug, sqlx::FromRow)]
struct EpochPlayerRow {
    player: String,
    rounds_count: i64,
    total_deposited: f64,
    total_pnl: f64,
    total_correct: i64,
    total_markets: i64,
}

/// Compute points for one player's epoch.
fn compute_points(row: &EpochPlayerRow) -> i64 {
    let base = 10i64 * row.rounds_count;

    // Volume: 1 point per USDC deposited (18-dec values stored as text → parsed as f64)
    let volume = (row.total_deposited / 1e18).max(0.0) as i64;

    // Accuracy: up to 50 points per round for perfect prediction
    let accuracy = if row.total_markets > 0 {
        ((row.total_correct as f64 / row.total_markets as f64) * 50.0 * row.rounds_count as f64) as i64
    } else {
        0
    };

    base + volume + accuracy
}

/// Run the epoch points aggregation for a specific epoch window.
async fn run_epoch(pool: &PgPool, epoch_start: chrono::DateTime<Utc>) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let epoch_end = epoch_start + Duration::hours(EPOCH_HOURS);

    // Check if this epoch was already computed
    let already_computed: Option<i64> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vision_epoch_log WHERE epoch_ts = $1"
    )
    .bind(epoch_start)
    .fetch_one(pool)
    .await?;

    if already_computed.unwrap_or(0) > 0 {
        info!(epoch = %epoch_start, "Epoch already computed — skipping");
        return Ok(0);
    }

    // Aggregate all rounds settled in this epoch window
    let rows: Vec<EpochPlayerRow> = sqlx::query_as(
        "SELECT
            player,
            COUNT(*)::bigint as rounds_count,
            COALESCE(SUM(deposited::float8), 0) as total_deposited,
            COALESCE(SUM(pnl::float8), 0) as total_pnl,
            COALESCE(SUM(correct_count), 0)::bigint as total_correct,
            COALESCE(SUM(total_markets), 0)::bigint as total_markets
         FROM vision_round_players
         WHERE settled_at >= $1 AND settled_at < $2
         GROUP BY player"
    )
    .bind(epoch_start)
    .bind(epoch_end)
    .fetch_all(pool)
    .await?;

    if rows.is_empty() {
        info!(epoch = %epoch_start, "No rounds settled in epoch — nothing to compute");
        return Ok(0);
    }

    let mut players_updated = 0u64;

    for row in &rows {
        let points = compute_points(row);
        if points <= 0 {
            continue;
        }

        // Upsert lifetime accumulator
        sqlx::query(
            "INSERT INTO vision_player_points (player, total_points, rounds_played, total_deposited, total_pnl, last_epoch_ts, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (player) DO UPDATE SET
                total_points = vision_player_points.total_points + EXCLUDED.total_points,
                rounds_played = vision_player_points.rounds_played + EXCLUDED.rounds_played,
                total_deposited = (vision_player_points.total_deposited::float8 + EXCLUDED.total_deposited::float8)::text,
                total_pnl = (vision_player_points.total_pnl::float8 + EXCLUDED.total_pnl::float8)::text,
                last_epoch_ts = EXCLUDED.last_epoch_ts,
                updated_at = NOW()"
        )
        .bind(&row.player)
        .bind(points)
        .bind(row.rounds_count as i32)
        .bind(format!("{:.0}", row.total_deposited))
        .bind(format!("{:.0}", row.total_pnl))
        .bind(epoch_start)
        .execute(pool)
        .await?;

        // Record epoch snapshot for audit trail
        sqlx::query(
            "INSERT INTO vision_epoch_log (epoch_ts, player, points_delta, rounds_in_epoch, deposited_total, pnl_total)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (epoch_ts, player) DO NOTHING"
        )
        .bind(epoch_start)
        .bind(&row.player)
        .bind(points)
        .bind(row.rounds_count as i32)
        .bind(format!("{:.0}", row.total_deposited))
        .bind(format!("{:.0}", row.total_pnl))
        .execute(pool)
        .await?;

        players_updated += 1;
    }

    info!(
        epoch = %epoch_start,
        players = players_updated,
        "Epoch points computed"
    );

    Ok(players_updated)
}

/// Main loop — sleeps until each epoch boundary, then computes points.
/// Only node_index == 0 (leader) runs the computation.
pub async fn run(pool: PgPool, shutdown: Arc<AtomicBool>, node_index: u8) {
    info!("EpochPoints worker started — {} hour epochs", EPOCH_HOURS);

    // On startup, check if the previous epoch was missed (e.g., oracle was down)
    let prev_epoch = current_epoch_start() - Duration::hours(EPOCH_HOURS);
    if node_index == 0 {
        match run_epoch(&pool, prev_epoch).await {
            Ok(n) => {
                if n > 0 {
                    info!(epoch = %prev_epoch, players = n, "Backfilled missed epoch on startup");
                }
            }
            Err(e) => warn!(epoch = %prev_epoch, error = %e, "Failed to backfill previous epoch"),
        }
    }

    loop {
        if shutdown.load(Ordering::Relaxed) {
            info!("EpochPoints worker shutting down");
            return;
        }

        let wait_secs = seconds_until_next_epoch();
        info!(wait_secs, next_epoch = %current_epoch_start() + Duration::hours(EPOCH_HOURS), "EpochPoints sleeping until next epoch");

        // Sleep in 30s chunks so we can check shutdown
        let mut slept = 0u64;
        while slept < wait_secs {
            if shutdown.load(Ordering::Relaxed) {
                return;
            }
            let chunk = (wait_secs - slept).min(30);
            tokio::time::sleep(tokio::time::Duration::from_secs(chunk)).await;
            slept += chunk;
        }

        if shutdown.load(Ordering::Relaxed) {
            return;
        }

        // Only leader computes
        if node_index != 0 {
            continue;
        }

        // Compute the epoch that just ended
        let completed_epoch = current_epoch_start() - Duration::hours(EPOCH_HOURS);
        match run_epoch(&pool, completed_epoch).await {
            Ok(n) => info!(epoch = %completed_epoch, players = n, "Epoch points computed"),
            Err(e) => error!(epoch = %completed_epoch, error = %e, "Epoch points computation failed"),
        }
    }
}
