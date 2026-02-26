//! ITP Orderbook Aggregator
//!
//! Fetches individual asset orderbooks from Bitget and aggregates them into
//! a single index-level orderbook. Each asset's price levels are converted
//! to index-relative prices using the ITP's inventory weights, then merged
//! and bucketed into the requested number of depth levels.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use tokio::sync::{RwLock, Semaphore};

use common::BitgetReadOnlyClient;

/// A single price level in the aggregated orderbook.
#[derive(Debug, Clone, Serialize)]
pub struct OrderbookLevel {
    /// Index-level price (USD)
    pub price: f64,
    /// Total USD depth at this level
    pub usd_depth: f64,
    /// Cumulative USD depth from top of book
    pub cumulative_usd: f64,
}

/// Per-asset orderbook summary (included in response for transparency).
#[derive(Debug, Clone, Serialize)]
pub struct AssetOrderbookSummary {
    pub symbol: String,
    pub mid_price: f64,
    pub best_bid: f64,
    pub best_ask: f64,
    pub bid_depth_usd: f64,
    pub ask_depth_usd: f64,
    pub weight_bps: u64,
}

/// The final aggregated orderbook for an ITP.
#[derive(Debug, Clone, Serialize)]
pub struct AggregatedOrderbook {
    pub itp_id: String,
    /// Index mid price (weighted sum of asset mids)
    pub index_mid: f64,
    /// Aggregated bid levels (descending by price)
    pub bids: Vec<OrderbookLevel>,
    /// Aggregated ask levels (ascending by price)
    pub asks: Vec<OrderbookLevel>,
    /// Per-asset summaries
    pub assets: Vec<AssetOrderbookSummary>,
    /// Number of assets successfully fetched
    pub assets_fetched: usize,
    /// Total assets in the ITP
    pub assets_total: usize,
    /// Cache age in milliseconds (0 = fresh)
    pub cache_age_ms: u64,
}

/// Cached aggregated orderbook with TTL.
pub struct OrderbookCache {
    cache: RwLock<HashMap<String, (Instant, AggregatedOrderbook)>>,
    ttl: Duration,
}

impl OrderbookCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            cache: RwLock::new(HashMap::new()),
            ttl: Duration::from_secs(ttl_secs),
        }
    }

    /// Get a cached orderbook if it exists and is not expired.
    pub async fn get(&self, key: &str) -> Option<AggregatedOrderbook> {
        let cache = self.cache.read().await;
        if let Some((inserted_at, book)) = cache.get(key) {
            let age = inserted_at.elapsed();
            if age < self.ttl {
                let mut book = book.clone();
                book.cache_age_ms = age.as_millis() as u64;
                return Some(book);
            }
        }
        None
    }

    /// Insert a fresh orderbook into the cache.
    pub async fn set(&self, key: String, book: AggregatedOrderbook) {
        let mut cache = self.cache.write().await;
        cache.insert(key, (Instant::now(), book));
    }
}

/// Input for a single asset in the ITP.
pub struct AssetInput {
    /// Bitget trading pair symbol (e.g., "BTCUSDT")
    pub symbol: String,
    /// On-chain inventory (raw 18-decimal value as f64)
    pub inventory: f64,
    /// Weight in basis points (e.g., 1000 = 10%)
    pub weight_bps: u64,
}

/// Fetch orderbooks for all assets in parallel and aggregate into a single
/// index-level orderbook.
///
/// # Algorithm
///
/// 1. Parallel-fetch orderbooks from Bitget (capped at 20 concurrent requests)
/// 2. Compute index mid price: sum(inventory_i * mid_i) / 1e18
/// 3. For each asset, convert its bid/ask levels to index-relative prices:
///    `index_price = index_mid * (asset_price / asset_mid)`
/// 4. Scale USD depth by the asset's weight fraction:
///    `usd = price * qty`  (raw depth, not scaled — scaling is implicit in index_price)
/// 5. Sort bids descending, asks ascending
/// 6. Aggregate levels within `aggregation_bps` threshold
/// 7. Truncate to requested number of levels
pub async fn fetch_and_aggregate(
    client: &Arc<dyn BitgetReadOnlyClient + Send + Sync>,
    itp_id: &str,
    assets: &[AssetInput],
    levels: usize,
    aggregation_bps: u64,
) -> AggregatedOrderbook {
    let semaphore = Arc::new(Semaphore::new(20));
    let client = Arc::clone(client);

    // 1. Parallel fetch orderbooks
    let mut handles = Vec::with_capacity(assets.len());
    for asset in assets {
        let sem = Arc::clone(&semaphore);
        let client = Arc::clone(&client);
        let symbol = asset.symbol.clone();
        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            let result = client.get_orderbook(&symbol, 50).await;
            (symbol, result)
        }));
    }

    let results = futures::future::join_all(handles).await;

    // Collect successful orderbooks
    let mut fetched_books: Vec<(usize, String, common::traits::BitgetOrderbook)> = Vec::new();
    for (i, result) in results.into_iter().enumerate() {
        match result {
            Ok((symbol, Ok(book))) => {
                if !book.bids.is_empty() && !book.asks.is_empty() {
                    fetched_books.push((i, symbol, book));
                }
            }
            Ok((symbol, Err(e))) => {
                tracing::warn!(symbol = %symbol, error = %e, "Failed to fetch orderbook");
            }
            Err(e) => {
                tracing::warn!(error = %e, "Orderbook fetch task panicked");
            }
        }
    }

    let assets_fetched = fetched_books.len();

    // 2. Compute index mid price: sum(inventory * mid) / 1e18
    let mut index_mid = 0.0_f64;
    for &(idx, _, ref book) in &fetched_books {
        let asset_mid = (book.bids[0].0 + book.asks[0].0) / 2.0;
        index_mid += assets[idx].inventory * asset_mid;
    }
    index_mid /= 1e18;

    if index_mid <= 0.0 {
        return AggregatedOrderbook {
            itp_id: itp_id.to_string(),
            index_mid: 0.0,
            bids: vec![],
            asks: vec![],
            assets: vec![],
            assets_fetched: 0,
            assets_total: assets.len(),
            cache_age_ms: 0,
        };
    }

    // 3 & 4. Convert each asset's levels to index-relative prices
    let mut raw_bids: Vec<(f64, f64)> = Vec::new(); // (index_price, usd_depth)
    let mut raw_asks: Vec<(f64, f64)> = Vec::new();
    let mut asset_summaries: Vec<AssetOrderbookSummary> = Vec::new();

    for &(idx, ref symbol, ref book) in &fetched_books {
        let asset_mid = (book.bids[0].0 + book.asks[0].0) / 2.0;
        if asset_mid <= 0.0 {
            continue;
        }

        let mut bid_depth_usd = 0.0_f64;
        let mut ask_depth_usd = 0.0_f64;

        // Convert bids
        for &(price, qty) in &book.bids {
            let index_price = index_mid * (price / asset_mid);
            let usd = price * qty;
            raw_bids.push((index_price, usd));
            bid_depth_usd += usd;
        }

        // Convert asks
        for &(price, qty) in &book.asks {
            let index_price = index_mid * (price / asset_mid);
            let usd = price * qty;
            raw_asks.push((index_price, usd));
            ask_depth_usd += usd;
        }

        asset_summaries.push(AssetOrderbookSummary {
            symbol: symbol.clone(),
            mid_price: asset_mid,
            best_bid: book.bids[0].0,
            best_ask: book.asks[0].0,
            bid_depth_usd,
            ask_depth_usd,
            weight_bps: assets[idx].weight_bps,
        });
    }

    // 5. Sort: bids descending, asks ascending
    raw_bids.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    raw_asks.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    // 6. Aggregate within threshold
    let bids = aggregate_levels(&raw_bids, aggregation_bps, levels, true);
    let asks = aggregate_levels(&raw_asks, aggregation_bps, levels, false);

    AggregatedOrderbook {
        itp_id: itp_id.to_string(),
        index_mid,
        bids,
        asks,
        assets: asset_summaries,
        assets_fetched,
        assets_total: assets.len(),
        cache_age_ms: 0,
    }
}

/// Aggregate raw (price, usd_depth) levels into buckets.
///
/// Adjacent levels within `aggregation_bps` of each other are merged.
/// For bids (descending), we group levels where the price drop is within threshold.
/// For asks (ascending), we group levels where the price rise is within threshold.
fn aggregate_levels(
    raw: &[(f64, f64)],
    aggregation_bps: u64,
    max_levels: usize,
    _is_bid: bool,
) -> Vec<OrderbookLevel> {
    if raw.is_empty() {
        return vec![];
    }

    let threshold = aggregation_bps as f64 / 10000.0;
    let mut result: Vec<(f64, f64)> = Vec::new(); // (price, usd_depth)

    let mut bucket_price = raw[0].0;
    let mut bucket_depth = raw[0].1;

    for &(price, depth) in raw.iter().skip(1) {
        if bucket_price <= 0.0 {
            bucket_price = price;
            bucket_depth = depth;
            continue;
        }

        let pct_diff = ((price - bucket_price) / bucket_price).abs();
        if pct_diff <= threshold {
            // Merge into current bucket (weighted average price)
            let total_depth = bucket_depth + depth;
            if total_depth > 0.0 {
                bucket_price = (bucket_price * bucket_depth + price * depth) / total_depth;
            }
            bucket_depth = total_depth;
        } else {
            result.push((bucket_price, bucket_depth));
            bucket_price = price;
            bucket_depth = depth;
        }
    }
    // Push last bucket
    result.push((bucket_price, bucket_depth));

    // 7. Truncate and compute cumulative
    let mut levels = Vec::new();
    let mut cumulative = 0.0_f64;
    for (price, usd_depth) in result.into_iter().take(max_levels) {
        cumulative += usd_depth;
        levels.push(OrderbookLevel {
            price,
            usd_depth,
            cumulative_usd: cumulative,
        });
    }

    levels
}
