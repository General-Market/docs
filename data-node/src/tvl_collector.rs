//! Protocol-wide AUM snapshots.
//!
//! Every `interval_secs`, sum `aum_usd` across the cached NAV snapshots and
//! write one row to `tvl_history`. The itp_collector already computes the
//! per-ITP AUM on each poll, so this collector is a cheap aggregator over
//! the existing cache — no fresh RPC reads.

use std::sync::Arc;
use std::time::Duration;

use chrono::{Timelike, Utc};
use sqlx::PgPool;
use tracing::{info, warn};

use crate::chain_cache::ChainCache;

pub async fn run(pool: PgPool, cache: Arc<ChainCache>, interval_secs: u64) {
    // Give itp_collector a moment to populate the cache before the first write.
    tokio::time::sleep(Duration::from_secs(30)).await;
    let interval = Duration::from_secs(interval_secs);
    loop {
        let snapshot = {
            let guard = cache.nav.read().await;
            guard.clone()
        };
        let itp_count = snapshot.len() as i32;
        let supply_count = snapshot.iter()
            .filter(|n| !n.total_supply.is_empty() && n.total_supply != "0")
            .count() as i32;
        let total_aum: f64 = snapshot.iter().map(|n| n.aum_usd).sum();

        // Only persist real samples — an empty cache is the absence of data,
        // not the existence of a zero. Writing zeros would poison the chart.
        if itp_count > 0 {
            let now = Utc::now();
            // Bucket to the minute so two restarts near each other don't
            // collide on the UNIQUE(snapshot_ts) constraint.
            let bucket = now
                .with_second(0)
                .and_then(|t| t.with_nanosecond(0))
                .unwrap_or(now);
            match sqlx::query(
                r#"
                INSERT INTO tvl_history (snapshot_ts, total_aum_usd, itp_count, supply_count)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (snapshot_ts) DO UPDATE
                SET total_aum_usd = EXCLUDED.total_aum_usd,
                    itp_count     = EXCLUDED.itp_count,
                    supply_count  = EXCLUDED.supply_count
                "#,
            )
            .bind(bucket)
            .bind(total_aum)
            .bind(itp_count)
            .bind(supply_count)
            .execute(&pool)
            .await
            {
                Ok(_) => info!(total_aum, itp_count, supply_count, "tvl_history row written"),
                Err(e) => warn!(%e, "tvl_history insert failed"),
            }
        }

        tokio::time::sleep(interval).await;
    }
}
