//! Bounded retention pruner for the two append-only giants:
//! `vision_asset_settlement_players_archive` and `market_prices`.
//!
//! Both tables grow forever and both have already pushed Postgres into
//! XID-wraparound territory. The emergency `VACUUM FREEZE` that follows
//! locks the table for over an hour and drags oracle consensus down with
//! it. We pay a small cost continuously — chunked DELETEs of 50k rows
//! with 250ms breathing room — so autovacuum keeps up and the freezer
//! never has to wake up screaming.
//!
//! Modeled after `account_pnl_curve_writer::spawn`: bare `tokio::spawn`,
//! shared sqlx pool, one-hour cadence between cycles, never crashes.

use sqlx::PgPool;
use std::time::{Duration, Instant};
use tracing::{info, warn};

/// Rows deleted per chunked DELETE. Small enough that each statement runs
/// in well under a second and holds row-locks briefly; large enough that a
/// full pass through ~10M expired rows fits in a single hourly cycle
/// without thrashing.
const BATCH_SIZE: i64 = 50_000;

/// Pause between chunks. Gives autovacuum and replication a window to
/// catch up before the next DELETE. Tight enough that a healthy table
/// finishes its pass quickly.
const BATCH_SLEEP: Duration = Duration::from_millis(250);

/// Sleep between full cycles. One hour is enough to keep both tables
/// trimmed to the retention horizon without burning IO on a tight loop.
const CYCLE_SLEEP: Duration = Duration::from_secs(3600);

/// Sleep after an error before retrying. A statement timeout or a
/// conflicting `VACUUM FREEZE` will resolve in well under an hour;
/// retrying sooner just stacks more lock requests on the same table.
const ERROR_SLEEP: Duration = Duration::from_secs(3600);

/// Tables we prune, with their time column.
const TABLES: &[(&str, &str)] = &[
    ("vision_asset_settlement_players_archive", "settled_at"),
    ("market_prices", "fetched_at"),
];

pub fn spawn(pool: PgPool, retention_days: u32) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        info!(retention_days, "retention-pruner started");
        loop {
            for (table, ts_col) in TABLES {
                match prune_table(&pool, table, ts_col, retention_days).await {
                    Ok((rows, elapsed)) => info!(
                        "retention: pruned {} rows from {} in {:.1}s",
                        rows,
                        table,
                        elapsed.as_secs_f64()
                    ),
                    Err(e) => {
                        warn!(
                            ?e,
                            table,
                            "retention: prune failed, sleeping {}s before retry",
                            ERROR_SLEEP.as_secs()
                        );
                        tokio::time::sleep(ERROR_SLEEP).await;
                    }
                }
            }
            tokio::time::sleep(CYCLE_SLEEP).await;
        }
    })
}

async fn prune_table(
    pool: &PgPool,
    table: &str,
    ts_col: &str,
    retention_days: u32,
) -> Result<(u64, Duration), sqlx::Error> {
    // ctid IN (SELECT ... LIMIT N) keeps each statement bounded to N rows
    // even when the qualifying set is in the tens of millions. Without the
    // LIMIT clamp, the planner would happily scan the entire expired set
    // in one transaction and hold AccessShare on the table for hours.
    let sql = format!(
        "DELETE FROM {table} \
         WHERE ctid IN ( \
             SELECT ctid FROM {table} \
             WHERE {ts_col} < NOW() - ($1::int || ' days')::interval \
             LIMIT $2 \
         )"
    );

    let started = Instant::now();
    let mut total: u64 = 0;
    let mut since_last_log: u64 = 0;

    loop {
        let result = sqlx::query(&sql)
            .bind(retention_days as i32)
            .bind(BATCH_SIZE)
            .execute(pool)
            .await?;
        let affected = result.rows_affected();
        if affected == 0 {
            break;
        }
        total += affected;
        since_last_log += affected;
        if since_last_log >= 100_000 {
            info!(
                "retention: {} progress — {} rows deleted so far ({:.1}s elapsed)",
                table,
                total,
                started.elapsed().as_secs_f64()
            );
            since_last_log = 0;
        }
        tokio::time::sleep(BATCH_SLEEP).await;
    }

    Ok((total, started.elapsed()))
}
