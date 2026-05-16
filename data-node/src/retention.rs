//! Bounded retention pruner for the append-only giants.
//!
//! Two row-DELETE targets, plus a list of hypertables pruned via
//! `drop_chunks`. One shared rhythm: chunked DELETEs of 50k rows with
//! 250ms breathing room, every hour, forever.
//!
//! Why per-table TTLs. `market_prices` stays at 30d because reports and
//! backfills still read it. `vision_bitmaps` is cut to 4h after batch
//! settlement — once a batch is final, the commit-reveal bitmaps are
//! evidence we will never re-verify. The phase-5 archive drop
//! (vision_asset_settlement_players_archive, vision_market_ratios_archive)
//! removed the other two targets; their JSONB replacement
//! (`vision_settlements`) is now a Timescale hypertable pruned by chunk
//! drop in the HYPERTABLE_DROP_TARGETS list below.
//!
//! What this prevents. `market_prices` (~82 GB) was the last write-heavy
//! plain table; without retention it would push Postgres into
//! XID-wraparound territory the way the players archive (84 GB) and
//! ratios archive (20 GB) did before the phase-5 drop. The emergency
//! `VACUUM FREEZE` that follows wraparound locks the table for over an
//! hour and drags oracle consensus down with it. We pay a small cost
//! continuously so autovacuum keeps up.
//!
//! Modeled after `account_pnl_curve_writer::spawn`: bare `tokio::spawn`,
//! shared sqlx pool, one-hour cadence between cycles, never crashes.

use chrono::Duration as ChronoDuration;
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

/// Sleep between full cycles. One hour is enough to keep all targets
/// trimmed to their retention horizon without burning IO on a tight loop.
const CYCLE_SLEEP: Duration = Duration::from_secs(3600);

/// Sleep after an error before retrying. A statement timeout or a
/// conflicting `VACUUM FREEZE` will resolve in well under an hour;
/// retrying sooner just stacks more lock requests on the same table.
const ERROR_SLEEP: Duration = Duration::from_secs(3600);

/// How each target identifies "old enough to delete". Direct targets have
/// a timestamp column on the table itself. Joined targets borrow the
/// timestamp from a parent table — `vision_bitmaps` has no time column,
/// so we age its rows by the settlement time of their parent batch.
enum Predicate {
    /// `WHERE <column> < NOW() - <ttl>`
    Direct { column: &'static str },
    /// `WHERE EXISTS (SELECT 1 FROM <parent> WHERE <join> AND <parent_column> IS NOT NULL AND <parent_column> < NOW() - <ttl>)`
    Joined {
        parent_table: &'static str,
        join_predicate: &'static str,
        parent_time_column: &'static str,
    },
}

struct RetentionTarget {
    table: &'static str,
    predicate: Predicate,
    retention: ChronoDuration,
}

/// Build the target list. `market_prices` honors the CLI flag; everything
/// else is hard-coded — 4h is a finality window, not a tunable.
fn targets(market_prices_days: u32) -> Vec<RetentionTarget> {
    vec![
        // Commit-reveal bitmaps. No own timestamp; aged by the parent
        // batch's settled_at. Bitmaps for unsettled batches are spared
        // — only batches that have actually finalized lose their evidence.
        RetentionTarget {
            table: "vision_bitmaps",
            predicate: Predicate::Joined {
                parent_table: "vision_batch_lifecycle",
                join_predicate: "vision_batch_lifecycle.batch_id = vision_bitmaps.batch_id",
                parent_time_column: "settled_at",
            },
            retention: ChronoDuration::hours(4),
        },
        // Price history. The only target whose TTL is operationally
        // tunable — backfills and reports still read this.
        RetentionTarget {
            table: "market_prices",
            predicate: Predicate::Direct { column: "fetched_at" },
            retention: ChronoDuration::days(market_prices_days as i64),
        },
    ]
}

/// Hypertable targets pruned by `drop_chunks`. Apache-edition-safe; no
/// compression, no policies. Chunks older than the cutoff disappear
/// atomically — far cheaper than DELETE for the v2 tables.
const HYPERTABLE_DROP_TARGETS: &[(&str, i64)] = &[
    ("market_prices_v2", 30),
    ("prices_v2", 90),
    ("vision_bitmaps_v2", 7),
    ("vision_settlements", 30),
];

pub fn spawn(pool: PgPool, market_prices_retention_days: u32) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let targets = targets(market_prices_retention_days);
        info!(
            target_count = targets.len(),
            hypertable_targets = HYPERTABLE_DROP_TARGETS.len(),
            market_prices_retention_days, "retention-pruner started"
        );
        loop {
            for target in &targets {
                match prune_target(&pool, target).await {
                    Ok((rows, elapsed)) => info!(
                        "retention: pruned {} rows from {} in {:.1}s (ttl={})",
                        rows,
                        target.table,
                        elapsed.as_secs_f64(),
                        format_duration(target.retention),
                    ),
                    Err(e) => {
                        warn!(
                            ?e,
                            table = target.table,
                            "retention: prune failed, sleeping {}s before retry",
                            ERROR_SLEEP.as_secs()
                        );
                        tokio::time::sleep(ERROR_SLEEP).await;
                    }
                }
            }
            for (table, days) in HYPERTABLE_DROP_TARGETS {
                match drop_old_chunks(&pool, table, *days).await {
                    Ok(dropped) => info!(
                        "retention: dropped {} chunks from {} (older than {}d)",
                        dropped, table, days
                    ),
                    Err(e) => warn!(?e, table, "retention: drop_chunks failed"),
                }
            }
            tokio::time::sleep(CYCLE_SLEEP).await;
        }
    })
}

async fn drop_old_chunks(
    pool: &PgPool,
    table: &str,
    older_than_days: i64,
) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM drop_chunks($1::regclass, older_than => make_interval(days => $2::int))",
    )
    .bind(table)
    .bind(older_than_days)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

async fn prune_target(
    pool: &PgPool,
    target: &RetentionTarget,
) -> Result<(u64, Duration), sqlx::Error> {
    // ctid IN (SELECT ... LIMIT N) keeps each statement bounded to N rows
    // even when the qualifying set is in the tens of millions. Without the
    // LIMIT clamp, the planner would happily scan the entire expired set
    // in one transaction and hold AccessShare on the table for hours.
    let table = target.table;
    let ttl_seconds = target.retention.num_seconds();
    let sql = match &target.predicate {
        Predicate::Direct { column } => format!(
            "DELETE FROM {table} \
             WHERE ctid IN ( \
                 SELECT ctid FROM {table} \
                 WHERE {column} < NOW() - make_interval(secs => $1::double precision) \
                 LIMIT $2 \
             )"
        ),
        Predicate::Joined {
            parent_table,
            join_predicate,
            parent_time_column,
        } => format!(
            "DELETE FROM {table} \
             WHERE ctid IN ( \
                 SELECT {table}.ctid FROM {table} \
                 JOIN {parent_table} ON {join_predicate} \
                 WHERE {parent_table}.{parent_time_column} IS NOT NULL \
                   AND {parent_table}.{parent_time_column} < NOW() - make_interval(secs => $1::double precision) \
                 LIMIT $2 \
             )"
        ),
    };

    let started = Instant::now();
    let mut total: u64 = 0;
    let mut since_last_log: u64 = 0;

    loop {
        let result = sqlx::query(&sql)
            .bind(ttl_seconds as f64)
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

fn format_duration(d: ChronoDuration) -> String {
    let secs = d.num_seconds();
    if secs % 86_400 == 0 {
        format!("{}d", secs / 86_400)
    } else if secs % 3600 == 0 {
        format!("{}h", secs / 3600)
    } else if secs % 60 == 0 {
        format!("{}m", secs / 60)
    } else {
        format!("{}s", secs)
    }
}
