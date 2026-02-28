use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use common::BitgetReadOnlyClient;

use crate::bitget_init::create_bitget_client;
use crate::collector_loop::PruneTimer;
use crate::db;

pub struct CollectorState {
    pub last_fetch_at: RwLock<Option<DateTime<Utc>>>,
    pub symbols_tracked: RwLock<usize>,
}

impl CollectorState {
    pub fn new() -> Self {
        Self {
            last_fetch_at: RwLock::new(None),
            symbols_tracked: RwLock::new(0),
        }
    }
}

fn load_tracked_symbols(assets_file: &str) -> Result<HashSet<String>, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(assets_file)?;
    let assets: Vec<serde_json::Value> = serde_json::from_str(&content)?;

    let symbols: HashSet<String> = assets
        .iter()
        .filter_map(|a| a.get("bitget").and_then(|v| v.as_str()).map(String::from))
        .collect();

    info!(count = symbols.len(), file = assets_file, "Loaded tracked symbols");
    Ok(symbols)
}

pub async fn run(
    pool: PgPool,
    state: Arc<CollectorState>,
    assets_file: String,
    poll_interval_secs: u64,
    retention_days: u32,
) {
    let tracked = match load_tracked_symbols(&assets_file) {
        Ok(s) => s,
        Err(e) => {
            error!(%e, "Failed to load assets file, collector cannot start");
            return;
        }
    };

    *state.symbols_tracked.write().await = tracked.len();

    let client = match create_bitget_client("collector") {
        Some(c) => c,
        None => return,
    };

    let poll_interval = Duration::from_secs(poll_interval_secs);
    let mut prune = PruneTimer::new(poll_interval_secs, 3600);

    info!(
        poll_interval_secs,
        retention_days,
        symbols = tracked.len(),
        "Collector started"
    );

    loop {
        // Fetch and store prices
        match client.get_all_tickers().await {
            Ok(tickers) => {
                let now = Utc::now();
                let rows: Vec<(String, String, DateTime<Utc>)> = tickers
                    .into_iter()
                    .filter(|t| tracked.contains(&t.symbol))
                    .map(|t| (t.symbol, t.last_price, now))
                    .collect();

                let count = rows.len();
                match db::batch_insert_prices(&pool, &rows).await {
                    Ok(inserted) => {
                        *state.last_fetch_at.write().await = Some(now);
                        info!(fetched = count, inserted, "Price fetch cycle complete");
                    }
                    Err(e) => {
                        error!(%e, "Failed to insert prices into database");
                    }
                }
            }
            Err(e) => {
                warn!(?e, "Failed to fetch tickers from Bitget");
            }
        }

        if prune.tick() {
            if let Err(e) = db::prune_old_prices(&pool, retention_days).await {
                warn!(%e, "Failed to prune old prices");
            }
        }

        tokio::time::sleep(poll_interval).await;
    }
}
