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
    /// Quantity at this level
    pub quantity: f64,
    /// USD value of depth at this level
    pub usd_value: f64,
}

/// Per-asset orderbook summary (included in response for transparency).
#[derive(Debug, Clone, Serialize)]
pub struct AssetOrderbookSummary {
    pub symbol: String,
    pub mid_price: f64,
    pub spread_bps: f64,
    pub bid_depth_usd: f64,
    pub ask_depth_usd: f64,
    pub weight_bps: u64,
}

/// The final aggregated orderbook for an ITP.
#[derive(Debug, Clone, Serialize)]
pub struct AggregatedOrderbook {
    /// Index mid price (weighted sum of asset mids)
    pub mid_price: f64,
    /// Spread in basis points between best aggregated bid/ask
    pub spread_bps: f64,
    /// Aggregated bid levels (descending by price)
    pub bids: Vec<OrderbookLevel>,
    /// Aggregated ask levels (ascending by price)
    pub asks: Vec<OrderbookLevel>,
    /// Total USD depth on the bid side
    pub total_bid_depth_usd: f64,
    /// Total USD depth on the ask side
    pub total_ask_depth_usd: f64,
    /// Number of assets successfully fetched
    pub assets_included: usize,
    /// Symbols of assets that failed to fetch
    pub assets_failed: Vec<String>,
    /// Per-asset summaries
    pub per_asset: Vec<AssetOrderbookSummary>,
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
            if inserted_at.elapsed() < self.ttl {
                return Some(book.clone());
            }
        }
        None
    }

    /// Insert a fresh orderbook into the cache.
    pub async fn set(&self, key: String, book: AggregatedOrderbook) {
        let mut cache = self.cache.write().await;
        cache.insert(key, (Instant::now(), book));
        // Evict stale entries to bound memory
        let ttl = self.ttl;
        cache.retain(|_, (ts, _)| ts.elapsed() < ttl * 2);
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
///    `usd = (price * qty) / weight_fraction`  where `weight_fraction = weight_bps / 10000`
/// 5. Sort bids descending, asks ascending
/// 6. Aggregate levels within `aggregation_bps` threshold
/// 7. Truncate to requested number of levels
pub async fn fetch_and_aggregate(
    client: &Arc<dyn BitgetReadOnlyClient + Send + Sync>,
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

    // Collect successful orderbooks and track failures
    let mut fetched_books: Vec<(usize, String, common::traits::BitgetOrderbook)> = Vec::new();
    let mut assets_failed: Vec<String> = Vec::new();
    for (i, result) in results.into_iter().enumerate() {
        match result {
            Ok((symbol, Ok(book))) => {
                if !book.bids.is_empty() && !book.asks.is_empty() {
                    fetched_books.push((i, symbol, book));
                } else {
                    assets_failed.push(symbol);
                }
            }
            Ok((symbol, Err(e))) => {
                tracing::warn!(symbol = %symbol, error = %e, "Failed to fetch orderbook");
                assets_failed.push(symbol);
            }
            Err(e) => {
                tracing::warn!(error = %e, "Orderbook fetch task panicked");
                // Can't recover symbol name from a panicked task
            }
        }
    }

    let assets_included = fetched_books.len();

    // 2. Compute index mid price: sum(inventory * mid) / 1e18
    let mut index_mid = 0.0_f64;
    for &(idx, _, ref book) in &fetched_books {
        let asset_mid = (book.bids[0].0 + book.asks[0].0) / 2.0;
        index_mid += assets[idx].inventory * asset_mid;
    }
    index_mid /= 1e18;

    if index_mid <= 0.0 {
        return AggregatedOrderbook {
            mid_price: 0.0,
            spread_bps: 0.0,
            bids: vec![],
            asks: vec![],
            total_bid_depth_usd: 0.0,
            total_ask_depth_usd: 0.0,
            assets_included: 0,
            assets_failed: assets.iter().map(|a| a.symbol.clone()).collect(),
            per_asset: vec![],
        };
    }

    // 3 & 4. Convert each asset's levels to index-relative prices
    // Each raw entry: (index_price, quantity, usd_value)
    let mut raw_bids: Vec<(f64, f64, f64)> = Vec::new();
    let mut raw_asks: Vec<(f64, f64, f64)> = Vec::new();
    let mut asset_summaries: Vec<AssetOrderbookSummary> = Vec::new();

    for &(idx, ref symbol, ref book) in &fetched_books {
        let asset_mid = (book.bids[0].0 + book.asks[0].0) / 2.0;
        if asset_mid <= 0.0 {
            continue;
        }

        let weight_fraction = assets[idx].weight_bps as f64 / 10000.0;
        let mut bid_depth_usd = 0.0_f64;
        let mut ask_depth_usd = 0.0_f64;

        // Convert bids — USD depth scaled by weight_fraction
        for &(price, qty) in &book.bids {
            let index_price = index_mid * (price / asset_mid);
            let usd = if weight_fraction > 0.0 {
                (price * qty) / weight_fraction
            } else {
                price * qty
            };
            raw_bids.push((index_price, qty, usd));
            bid_depth_usd += usd;
        }

        // Convert asks — USD depth scaled by weight_fraction
        for &(price, qty) in &book.asks {
            let index_price = index_mid * (price / asset_mid);
            let usd = if weight_fraction > 0.0 {
                (price * qty) / weight_fraction
            } else {
                price * qty
            };
            raw_asks.push((index_price, qty, usd));
            ask_depth_usd += usd;
        }

        // Compute per-asset spread_bps
        let best_bid = book.bids[0].0;
        let best_ask = book.asks[0].0;
        let asset_spread_bps = if asset_mid > 0.0 {
            (best_ask - best_bid) / asset_mid * 10000.0
        } else {
            0.0
        };

        asset_summaries.push(AssetOrderbookSummary {
            symbol: symbol.clone(),
            mid_price: asset_mid,
            spread_bps: asset_spread_bps,
            bid_depth_usd,
            ask_depth_usd,
            weight_bps: assets[idx].weight_bps,
        });
    }

    // 5. Sort: bids descending, asks ascending
    raw_bids.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    raw_asks.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    // 6. Aggregate within threshold
    let bids = aggregate_levels(&raw_bids, aggregation_bps, levels);
    let asks = aggregate_levels(&raw_asks, aggregation_bps, levels);

    // Compute total depths
    let total_bid_depth_usd: f64 = bids.iter().map(|l| l.usd_value).sum();
    let total_ask_depth_usd: f64 = asks.iter().map(|l| l.usd_value).sum();

    // Compute spread_bps from raw best bid/ask (pre-aggregation) so it stays
    // stable regardless of the aggregation level chosen by the user.
    let agg_spread_bps = match (raw_bids.first(), raw_asks.first()) {
        (Some(&(best_bid_price, _, _)), Some(&(best_ask_price, _, _))) => {
            let mid = (best_bid_price + best_ask_price) / 2.0;
            if mid > 0.0 {
                (best_ask_price - best_bid_price) / mid * 10000.0
            } else {
                0.0
            }
        }
        _ => 0.0,
    };

    AggregatedOrderbook {
        mid_price: index_mid,
        spread_bps: agg_spread_bps,
        bids,
        asks,
        total_bid_depth_usd,
        total_ask_depth_usd,
        assets_included,
        assets_failed,
        per_asset: asset_summaries,
    }
}

/// Aggregate raw (price, quantity, usd_value) levels into buckets.
///
/// Adjacent levels within `aggregation_bps` of each other are merged.
/// For bids (descending), we group levels where the price drop is within threshold.
/// For asks (ascending), we group levels where the price rise is within threshold.
fn aggregate_levels(
    raw: &[(f64, f64, f64)],
    aggregation_bps: u64,
    max_levels: usize,
) -> Vec<OrderbookLevel> {
    if raw.is_empty() {
        return vec![];
    }

    let threshold = aggregation_bps as f64 / 10000.0;
    let mut result: Vec<(f64, f64, f64)> = Vec::new(); // (price, quantity, usd_value)

    let mut bucket_price = raw[0].0;
    let mut bucket_qty = raw[0].1;
    let mut bucket_usd = raw[0].2;

    for &(price, qty, usd) in raw.iter().skip(1) {
        if bucket_price <= 0.0 {
            bucket_price = price;
            bucket_qty = qty;
            bucket_usd = usd;
            continue;
        }

        let pct_diff = ((price - bucket_price) / bucket_price).abs();
        if pct_diff <= threshold {
            // Merge into current bucket (weighted average price by usd_value)
            let total_usd = bucket_usd + usd;
            if total_usd > 0.0 {
                bucket_price = (bucket_price * bucket_usd + price * usd) / total_usd;
            }
            bucket_qty += qty;
            bucket_usd = total_usd;
        } else {
            result.push((bucket_price, bucket_qty, bucket_usd));
            bucket_price = price;
            bucket_qty = qty;
            bucket_usd = usd;
        }
    }
    // Push last bucket
    result.push((bucket_price, bucket_qty, bucket_usd));

    // 7. Truncate to max levels
    result
        .into_iter()
        .take(max_levels)
        .map(|(price, quantity, usd_value)| OrderbookLevel {
            price,
            quantity,
            usd_value,
        })
        .collect()
}
