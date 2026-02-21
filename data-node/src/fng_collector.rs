//! Fear & Greed Index daily collector.
//!
//! Fetches full FNG history from alternative.me and upserts missing dates.

use std::time::Duration;

use sqlx::PgPool;
use tracing::{error, info};

use crate::db;
use crate::fng_client;

/// Run the FNG collector loop. Fetches once, then sleeps for poll_interval.
pub async fn run(pool: PgPool, poll_interval_secs: u64) {
    let poll_interval = Duration::from_secs(poll_interval_secs);

    info!(poll_secs = poll_interval_secs, "FNG collector started");

    loop {
        match sync_fng(&pool).await {
            Ok(count) => {
                if count > 0 {
                    info!(upserted = count, "FNG sync complete");
                } else {
                    info!("FNG sync: already up to date");
                }
            }
            Err(e) => {
                error!(%e, "FNG sync failed");
            }
        }

        tokio::time::sleep(poll_interval).await;
    }
}

async fn sync_fng(pool: &PgPool) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let entries = fng_client::fetch_all().await?;
    if entries.is_empty() {
        return Ok(0);
    }

    let rows: Vec<(chrono::NaiveDate, i32, String)> = entries
        .into_iter()
        .map(|e| (e.date, e.value, e.classification))
        .collect();

    let upserted = db::fng_batch_upsert(pool, &rows).await?;
    Ok(upserted)
}
