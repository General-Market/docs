use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;
use tracing::{info, warn};

use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};
use common::{BitgetReadOnlyClient, BitgetTicker};

#[derive(Clone, Debug, serde::Serialize)]
pub struct CachedTicker {
    pub last_price: String,
    pub best_bid: String,
    pub best_ask: String,
    pub timestamp_ms: u64,
}

pub struct LiveTickerCache {
    pub tickers: RwLock<HashMap<String, CachedTicker>>,
    last_update: RwLock<Option<Instant>>,
}

impl LiveTickerCache {
    pub fn new() -> Self {
        Self {
            tickers: RwLock::new(HashMap::new()),
            last_update: RwLock::new(None),
        }
    }

    /// Bulk update from get_all_tickers() result
    pub async fn update(&self, tickers: Vec<BitgetTicker>) {
        let mut map = self.tickers.write().await;
        for t in tickers {
            map.insert(
                t.symbol,
                CachedTicker {
                    last_price: t.last_price,
                    best_bid: t.best_bid,
                    best_ask: t.best_ask,
                    timestamp_ms: t.timestamp,
                },
            );
        }
        *self.last_update.write().await = Some(Instant::now());
    }

    /// Get prices for specific symbols (instant, no DB)
    pub async fn get_prices(&self, symbols: &[&str]) -> HashMap<String, CachedTicker> {
        let map = self.tickers.read().await;
        let mut result = HashMap::new();
        for &sym in symbols {
            if let Some(ticker) = map.get(sym) {
                result.insert(sym.to_string(), ticker.clone());
            }
        }
        result
    }

    /// Get all cached prices
    pub async fn get_all(&self) -> HashMap<String, CachedTicker> {
        self.tickers.read().await.clone()
    }

    /// Milliseconds since last update, or None if never updated
    pub async fn age_ms(&self) -> Option<u64> {
        self.last_update
            .read()
            .await
            .map(|t| t.elapsed().as_millis() as u64)
    }
}

pub async fn run_fast_poller(
    cache: Arc<LiveTickerCache>,
    tracked_symbols: HashSet<String>,
    poll_interval: Duration,
) {
    let bitget_config = match BitgetReadOnlyConfig::from_env() {
        Ok(c) => c,
        Err(e) => {
            warn!(?e, "Fast poller: failed to load Bitget config, not starting");
            return;
        }
    };

    let client = match BitgetReadOnlyClientImpl::new(bitget_config) {
        Ok(c) => c,
        Err(e) => {
            warn!(?e, "Fast poller: failed to create Bitget client, not starting");
            return;
        }
    };

    info!(
        poll_interval_ms = poll_interval.as_millis() as u64,
        symbols = tracked_symbols.len(),
        "Fast poller started"
    );

    loop {
        match client.get_all_tickers().await {
            Ok(tickers) => {
                let filtered: Vec<_> = tickers
                    .into_iter()
                    .filter(|t| tracked_symbols.contains(&t.symbol))
                    .collect();
                let count = filtered.len();
                cache.update(filtered).await;
                tracing::debug!(count, "Fast poller: cache updated");
            }
            Err(e) => {
                warn!(?e, "Fast poller: failed to fetch tickers");
            }
        }
        tokio::time::sleep(poll_interval).await;
    }
}
