//! CoinGecko Pro API client implementing MarketDataSource
//!
//! Fetches cryptocurrency prices from https://pro-api.coingecko.com/api/v3
//! Handles rate limiting, retries, and batched requests.

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/crypto.json");

/// CoinGecko Pro API base URL
const COINGECKO_PRO_URL: &str = "https://pro-api.coingecko.com/api/v3";
/// CoinGecko Demo API base URL (for CG- prefixed keys)
const COINGECKO_DEMO_URL: &str = "https://api.coingecko.com/api/v3";

/// Request timeout in seconds
const REQUEST_TIMEOUT_SECS: u64 = 30;

/// Maximum coins per batch request
/// Note: CoinGecko limit is 500, but with long coin IDs the URL can exceed limits
/// Using 100 to stay safe with URI length limits
const BATCH_SIZE: usize = 100;

/// Maximum retries per request
const MAX_RETRIES: u32 = 3;

/// Rate limit: minimum delay between API requests (ms)
/// CoinGecko Pro allows ~500 requests/minute, we use 150ms to stay safe
const MIN_REQUEST_DELAY_MS: u64 = 150;

/// Price data response from CoinGecko /simple/price endpoint
#[derive(Debug, Deserialize)]
pub struct PriceData {
    pub usd: Option<f64>,
    pub usd_market_cap: Option<f64>,
    pub usd_24h_vol: Option<f64>,
    pub usd_24h_change: Option<f64>,
}

/// Market coin data from /coins/markets endpoint
#[derive(Debug, Clone, Deserialize)]
pub struct MarketCoin {
    pub id: String,
    pub symbol: String,
    pub name: String,
    pub image: Option<String>,
    pub current_price: Option<f64>,
    pub market_cap: Option<f64>,
    pub market_cap_rank: Option<i64>,
    pub total_volume: Option<f64>,
    pub price_change_percentage_24h: Option<f64>,
    #[allow(dead_code)]
    pub last_updated: Option<String>,
}

/// CoinGecko cryptocurrency market data source.
///
/// Source ID is `"crypto"` — this is the source name used everywhere in the system.
pub struct CoinGeckoMarketSource {
    client: reqwest::Client,
    api_key: String,
    /// Whether this is a demo API key (CG- prefix) vs pro key
    is_demo: bool,
    sync_interval_secs: u64,
    /// Last request timestamp for internal rate limiting
    last_request: Arc<Mutex<std::time::Instant>>,
    /// Number of top coins to track (0 = all with prices)
    top_coins_count: usize,
}

impl CoinGeckoMarketSource {
    /// Create a new CoinGecko market source
    pub fn new(api_key: String, sync_interval_secs: u64, top_coins_count: usize) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .context("Failed to create HTTP client")?;

        let is_demo = std::env::var("COINGECKO_DEMO").is_ok();

        Ok(Self {
            client,
            api_key,
            is_demo,
            sync_interval_secs,
            last_request: Arc::new(Mutex::new(std::time::Instant::now())),
            top_coins_count,
        })
    }

    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("COINGECKO_API_KEY")
            .context("COINGECKO_API_KEY environment variable must be set")?;

        let sync_interval_secs = std::env::var("COINGECKO_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60);

        let top_coins_count = std::env::var("COINGECKO_TOP_COINS")
            .ok()
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0); // 0 = all coins with prices

        Self::new(api_key, sync_interval_secs, top_coins_count)
    }

    /// Get the base URL depending on key type
    fn base_url(&self) -> &str {
        if self.is_demo { COINGECKO_DEMO_URL } else { COINGECKO_PRO_URL }
    }

    /// Get the auth header name depending on key type
    fn auth_header(&self) -> &str {
        if self.is_demo { "x-cg-demo-api-key" } else { "x-cg-pro-api-key" }
    }

    /// Enforce rate limiting before making a request
    async fn rate_limit(&self) {
        let mut last = self.last_request.lock().await;
        let elapsed = last.elapsed();
        let min_delay = Duration::from_millis(MIN_REQUEST_DELAY_MS);

        if elapsed < min_delay {
            let sleep_time = min_delay - elapsed;
            tokio::time::sleep(sleep_time).await;
        }

        *last = std::time::Instant::now();
    }

    /// Fetch coins by market cap with retries
    ///
    /// Uses /coins/markets endpoint for richer data.
    /// If limit is usize::MAX, fetches ALL coins with prices.
    ///
    /// Public so SnapshotService can call it for trade list generation.
    pub async fn fetch_top_coins(&self, limit: usize) -> Result<Vec<MarketCoin>> {
        let mut all_coins = Vec::new();
        let fetch_all = limit == usize::MAX;
        let mut page = 1;

        loop {
            let url = format!(
                "{}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page={}&sparkline=false",
                self.base_url(), page
            );

            self.rate_limit().await;

            let mut last_error = None;

            for attempt in 0..MAX_RETRIES {
                match self
                    .client
                    .get(&url)
                    .header(self.auth_header(), &self.api_key)
                    .send()
                    .await
                {
                    Ok(response) => {
                        if response.status().is_success() {
                            match response.json::<Vec<MarketCoin>>().await {
                                Ok(coins) => {
                                    if coins.is_empty() {
                                        // No more results
                                        info!(
                                            "Fetched {} coins with prices from CoinGecko",
                                            all_coins.len()
                                        );
                                        return Ok(all_coins);
                                    }

                                    all_coins.extend(coins);

                                    // Check if we've reached the limit
                                    if !fetch_all && all_coins.len() >= limit {
                                        all_coins.truncate(limit);
                                        info!(
                                            "Fetched {} coins (limit: {}) from CoinGecko",
                                            all_coins.len(),
                                            limit
                                        );
                                        return Ok(all_coins);
                                    }

                                    break; // Success, continue to next page
                                }
                                Err(e) => {
                                    warn!(
                                        "Failed to parse coins page {} (attempt {}/{}): {:?}",
                                        page,
                                        attempt + 1,
                                        MAX_RETRIES,
                                        e
                                    );
                                    last_error = Some(e.to_string());
                                }
                            }
                        } else {
                            warn!(
                                "CoinGecko API error page {} (attempt {}/{}): status {}",
                                page,
                                attempt + 1,
                                MAX_RETRIES,
                                response.status()
                            );
                            last_error = Some(format!("HTTP {}", response.status()));
                        }
                    }
                    Err(e) => {
                        warn!(
                            "Request failed page {} (attempt {}/{}): {:?}",
                            page,
                            attempt + 1,
                            MAX_RETRIES,
                            e
                        );
                        last_error = Some(e.to_string());
                    }
                }

                // Exponential backoff
                if attempt < MAX_RETRIES - 1 {
                    let delay = Duration::from_secs(2u64.pow(attempt));
                    tokio::time::sleep(delay).await;
                }
            }

            // If we exhausted retries, stop pagination
            if last_error.is_some() {
                warn!("Stopping coin fetch at page {} due to errors", page);
                break;
            }

            page += 1;

            // Safety limit to avoid infinite loops (CoinGecko has ~15k coins max)
            if page > 100 {
                warn!("Reached page limit (100), stopping coin fetch");
                break;
            }
        }

        info!(
            "Fetched {} coins with prices from CoinGecko",
            all_coins.len()
        );
        Ok(all_coins)
    }

    /// Fetch prices for a batch of coins (up to BATCH_SIZE)
    async fn fetch_prices_batch(&self, coin_ids: &[String]) -> Result<HashMap<String, PriceData>> {
        let ids = coin_ids.join(",");
        let url = format!(
            "{}/simple/price?ids={}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true",
            self.base_url(), ids
        );

        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            self.rate_limit().await;

            match self
                .client
                .get(&url)
                .header(self.auth_header(), &self.api_key)
                .send()
                .await
            {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.json::<HashMap<String, PriceData>>().await {
                            Ok(prices) => {
                                debug!(
                                    "Fetched {} prices from batch of {}",
                                    prices.len(),
                                    coin_ids.len()
                                );
                                return Ok(prices);
                            }
                            Err(e) => {
                                warn!(
                                    "Failed to parse prices (attempt {}/{}): {:?}",
                                    attempt + 1,
                                    MAX_RETRIES,
                                    e
                                );
                                last_error = Some(e.to_string());
                            }
                        }
                    } else {
                        warn!(
                            "CoinGecko API error (attempt {}/{}): status {}",
                            attempt + 1,
                            MAX_RETRIES,
                            response.status()
                        );
                        last_error = Some(format!("HTTP {}", response.status()));
                    }
                }
                Err(e) => {
                    warn!(
                        "Request failed (attempt {}/{}): {:?}",
                        attempt + 1,
                        MAX_RETRIES,
                        e
                    );
                    last_error = Some(e.to_string());
                }
            }

            // Exponential backoff
            if attempt < MAX_RETRIES - 1 {
                let delay = Duration::from_secs(2u64.pow(attempt));
                tokio::time::sleep(delay).await;
            }
        }

        Err(anyhow::anyhow!(
            "Failed to fetch prices after {} retries: {:?}",
            MAX_RETRIES,
            last_error
        ))
    }

    /// Determine the category based on market cap rank
    fn get_category(market_cap_rank: Option<i64>) -> Option<String> {
        match market_cap_rank {
            Some(rank) if rank <= 100 => Some("cryptoLargeCap".to_string()),
            Some(rank) if rank <= 500 => Some("cryptoMidCap".to_string()),
            Some(_) => Some("cryptoSmallCap".to_string()),
            None => None,
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for CoinGeckoMarketSource {
    fn source_id(&self) -> &'static str {
        "crypto"
    }

    fn display_name(&self) -> &'static str {
        "CoinGecko Crypto"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(self.sync_interval_secs)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 400, // conservative: stay under 500/min
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();
        let total_batches = (asset_ids.len() + BATCH_SIZE - 1) / BATCH_SIZE;
        let mut failed_batches = 0u32;

        // Batch requests to respect API limits
        for chunk in asset_ids.chunks(BATCH_SIZE) {
            let chunk_vec: Vec<String> = chunk.to_vec();
            match self.fetch_prices_batch(&chunk_vec).await {
                Ok(prices) => {
                    for (coin_id, price_data) in prices {
                        if let Some(value) = price_data.usd {
                            let price = Decimal::try_from(value).unwrap_or_default();
                            let volume = price_data
                                .usd_24h_vol
                                .and_then(|v| Decimal::try_from(v).ok());
                            let market_cap = price_data
                                .usd_market_cap
                                .and_then(|v| Decimal::try_from(v).ok());
                            let change_pct = price_data
                                .usd_24h_change
                                .and_then(|v| Decimal::try_from(v).ok());

                            // Find the original symbol for this coin_id
                            // (we don't have it from /simple/price, use coin_id as fallback)
                            let symbol = coin_id.to_uppercase();

                            results.push(PriceUpdate {
                                asset_id: coin_id,
                                symbol,
                                value: price,
                                prev_close: None, // CoinGecko doesn't provide prev_close
                                change_pct,
                                volume_24h: volume,
                                market_cap,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Error fetching CoinGecko batch: {:?}", e);
                    failed_batches += 1;
                }
            }
        }

        if failed_batches > 0 {
            let estimated_missing = failed_batches as usize * BATCH_SIZE;
            warn!(
                "CoinGecko: {}/{} batches failed, ~{}/{} assets may be missing",
                failed_batches, total_batches, estimated_missing, asset_ids.len()
            );
        }

        info!(
            "Fetched {}/{} crypto prices from CoinGecko ({}/{} batches ok)",
            results.len(), asset_ids.len(),
            total_batches - failed_batches as usize, total_batches
        );

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 10000, "Expected 10000 crypto assets");
    }

    #[test]
    fn test_fetch_assets_filters_active() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(!assets.is_empty());
        for asset in &assets {
            assert_eq!(asset.category, Some("crypto".to_string()));
        }
    }

    #[test]
    fn test_known_coins_exist() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"bitcoin"), "bitcoin should be in crypto assets");
        assert!(ids.contains(&"ethereum"), "ethereum should be in crypto assets");
        assert!(ids.contains(&"solana"), "solana should be in crypto assets");
    }

    #[test]
    fn test_subcategories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let subcats: Vec<&str> = entries.iter().map(|e| e.subcategory.as_str()).collect();
        assert!(subcats.contains(&"large_cap"));
        assert!(subcats.contains(&"mid_cap"));
        assert!(subcats.contains(&"small_cap"));
    }

    #[test]
    fn test_category_assignment() {
        assert_eq!(
            CoinGeckoMarketSource::get_category(Some(1)),
            Some("cryptoLargeCap".to_string())
        );
        assert_eq!(
            CoinGeckoMarketSource::get_category(Some(101)),
            Some("cryptoMidCap".to_string())
        );
        assert_eq!(
            CoinGeckoMarketSource::get_category(Some(501)),
            Some("cryptoSmallCap".to_string())
        );
        assert_eq!(CoinGeckoMarketSource::get_category(None), None);
    }
}
