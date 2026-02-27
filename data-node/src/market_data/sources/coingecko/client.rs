//! CoinGecko API client implementing MarketDataSource
//!
//! Fetches cryptocurrency prices via /coins/markets (250 coins/page).
//! Demo tier: 40 pages × 3s = ~120s per sweep, fits in 10-min cycle.
//! Rate limiter is shared with cg_collector to prevent 429 collisions.

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;
use tracing::{info, warn};

use crate::coingecko::RateLimiter;
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

/// Maximum retries per request (non-429 errors)
const MAX_RETRIES: u32 = 3;

/// Maximum retries specifically for 429 (rate limit) responses.
/// 429s are transient — we just need to wait long enough.
const MAX_429_RETRIES: u32 = 6;

// Rate limiting is handled by the shared RateLimiter from coingecko.rs,
// which coordinates with cg_collector to avoid 429s on Demo tier.

/// Base backoff delay (in seconds) when we receive HTTP 429 Too Many Requests.
/// We use exponential backoff: BASE * 2^attempt (5s, 10s, 20s).
const RATE_LIMIT_BACKOFF_BASE_SECS: u64 = 5;

/// API key tier determines endpoint URL, auth header, and rate limits
#[derive(Debug, Clone, PartialEq)]
enum ApiTier {
    /// Paid Pro API key — fast rate limits, pro endpoint
    Pro,
    /// Demo API key (CG- prefix) — moderate rate limits, demo endpoint
    Demo,
    /// No API key — free tier with aggressive rate limiting
    Free,
}

/// Result of fetching a single page from /coins/markets
enum PageResult {
    /// Successfully fetched coins (may be empty = end of data)
    Ok(Vec<MarketCoin>),
    /// All 429 retries exhausted — skip page, keep paginating
    RateLimited,
    /// Non-recoverable error — stop pagination
    Fatal(String),
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
    /// API tier determines endpoint, auth, and rate limits
    tier: ApiTier,
    sync_interval_secs: u64,
    /// Shared rate limiter — coordinates with cg_collector
    limiter: RateLimiter,
    /// Number of top coins to track (0 = all with prices)
    top_coins_count: usize,
}

impl CoinGeckoMarketSource {
    /// Detect API tier from the key string
    fn detect_tier(api_key: &str) -> ApiTier {
        let key = api_key.trim();
        if key.is_empty() {
            ApiTier::Free
        } else if key.starts_with("CG-") {
            ApiTier::Demo
        } else if std::env::var("COINGECKO_DEMO").is_ok() {
            // Explicit override: treat any key as demo tier
            ApiTier::Demo
        } else {
            ApiTier::Pro
        }
    }

    /// Create a new CoinGecko market source with a shared rate limiter.
    pub fn new(api_key: String, sync_interval_secs: u64, top_coins_count: usize, limiter: RateLimiter) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .user_agent("index-data-node/1.0 (market data aggregator)")
            .build()
            .context("Failed to create HTTP client")?;

        let tier = Self::detect_tier(&api_key);

        info!(
            "CoinGecko API tier: {:?} (key {})",
            tier,
            if api_key.trim().is_empty() { "empty" } else { "present" }
        );

        Ok(Self {
            client,
            api_key,
            tier,
            sync_interval_secs,
            limiter,
            top_coins_count,
        })
    }

    /// Create from environment variables with a shared rate limiter.
    /// Works with or without COINGECKO_API_KEY — falls back to free tier.
    pub fn from_env(limiter: RateLimiter) -> Result<Self> {
        let api_key = std::env::var("COINGECKO_API_KEY").unwrap_or_default();

        let sync_interval_secs = std::env::var("COINGECKO_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(600);

        let top_coins_count = std::env::var("COINGECKO_TOP_COINS")
            .ok()
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0); // 0 = all coins with prices

        Self::new(api_key, sync_interval_secs, top_coins_count, limiter)
    }

    /// Get the base URL depending on key type
    fn base_url(&self) -> &str {
        match self.tier {
            ApiTier::Pro => COINGECKO_PRO_URL,
            ApiTier::Demo | ApiTier::Free => COINGECKO_DEMO_URL,
        }
    }

    /// Build a request with appropriate auth (or no auth for free tier)
    fn authenticated_get(&self, url: &str) -> reqwest::RequestBuilder {
        let req = self.client.get(url);
        match self.tier {
            ApiTier::Pro => req.header("x-cg-pro-api-key", &self.api_key),
            ApiTier::Demo => req.header("x-cg-demo-key", &self.api_key),
            ApiTier::Free => req, // no auth header
        }
    }

    /// Enforce rate limiting before making a request (shared with cg_collector).
    async fn rate_limit(&self) {
        self.limiter.wait().await;
    }

    /// Fetch coins by market cap with retries
    ///
    /// Uses /coins/markets endpoint for richer data.
    /// If limit is usize::MAX, fetches ALL coins with prices.
    ///
    /// 429 handling: rate-limit responses get up to 6 retries with aggressive
    /// backoff (10s, 20s, 40s, 60s, 60s, 60s). After exhausting 429 retries on
    /// a page we skip that page and continue (partial data is better than none).
    /// Only non-429 errors (auth failures, server errors) stop pagination.
    ///
    /// Public so SnapshotService can call it for trade list generation.
    pub async fn fetch_top_coins(&self, limit: usize) -> Result<Vec<MarketCoin>> {
        let mut all_coins = Vec::new();
        let fetch_all = limit == usize::MAX;
        let mut page = 1;
        let mut consecutive_failures = 0u32;

        loop {
            let url = format!(
                "{}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page={}&sparkline=false",
                self.base_url(), page
            );

            self.rate_limit().await;

            let page_result = self.fetch_page_with_retry(&url, page).await;

            match page_result {
                PageResult::Ok(coins) => {
                    if coins.is_empty() {
                        // No more results — we've reached the end
                        info!(
                            "Fetched {} coins with prices from CoinGecko ({:?} tier, {} pages)",
                            all_coins.len(), self.tier, page
                        );
                        return Ok(all_coins);
                    }

                    all_coins.extend(coins);
                    consecutive_failures = 0;

                    // Check if we've reached the limit
                    if !fetch_all && all_coins.len() >= limit {
                        all_coins.truncate(limit);
                        info!(
                            "Fetched {} coins (limit: {}) from CoinGecko",
                            all_coins.len(), limit
                        );
                        return Ok(all_coins);
                    }
                }
                PageResult::RateLimited => {
                    // 429 exhausted — skip this page but keep going.
                    // Next page's rate_limit() call will add delay.
                    consecutive_failures += 1;
                    warn!(
                        "Skipping page {} after 429 retries exhausted ({} consecutive failures)",
                        page, consecutive_failures
                    );
                    // If 3+ consecutive pages all 429, stop — we're genuinely rate-blocked
                    if consecutive_failures >= 3 {
                        warn!(
                            "Stopping pagination at page {} — {} consecutive 429 failures",
                            page, consecutive_failures
                        );
                        break;
                    }
                }
                PageResult::Fatal(err) => {
                    // Non-recoverable error (auth, server error) — stop
                    warn!("Stopping coin fetch at page {} due to error: {}", page, err);
                    break;
                }
            }

            page += 1;

            // Safety limit (CoinGecko has ~15k coins max = 60 pages)
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

    /// Attempt to fetch a single page with retries.
    /// Returns Ok(coins), RateLimited (429 exhausted), or Fatal (non-recoverable).
    async fn fetch_page_with_retry(&self, url: &str, page: u32) -> PageResult {
        let mut rate_limit_attempts = 0u32;
        let mut other_attempts = 0u32;

        loop {
            match self.authenticated_get(url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.json::<Vec<MarketCoin>>().await {
                            Ok(coins) => return PageResult::Ok(coins),
                            Err(e) => {
                                other_attempts += 1;
                                warn!(
                                    "Failed to parse coins page {} (attempt {}/{}): {:?}",
                                    page, other_attempts, MAX_RETRIES, e
                                );
                                if other_attempts >= MAX_RETRIES {
                                    return PageResult::Fatal(e.to_string());
                                }
                                let delay = Duration::from_secs(2u64.pow(other_attempts - 1));
                                tokio::time::sleep(delay).await;
                            }
                        }
                    } else {
                        let status = response.status().as_u16();

                        if status == 429 {
                            rate_limit_attempts += 1;
                            // Aggressive backoff: 10s, 20s, 40s, 60s, 60s, 60s
                            let backoff_secs = match rate_limit_attempts {
                                1 => 10,
                                2 => 20,
                                3 => 40,
                                _ => 60,
                            };
                            if rate_limit_attempts <= MAX_429_RETRIES {
                                warn!(
                                    "Rate limited (429) on page {}, attempt {}/{}, waiting {}s",
                                    page, rate_limit_attempts, MAX_429_RETRIES, backoff_secs
                                );
                                tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                                continue;
                            } else {
                                return PageResult::RateLimited;
                            }
                        }

                        // Non-429 HTTP error
                        other_attempts += 1;
                        warn!(
                            "CoinGecko API error page {} (attempt {}/{}): HTTP {}",
                            page, other_attempts, MAX_RETRIES, status
                        );
                        if other_attempts >= MAX_RETRIES {
                            return PageResult::Fatal(format!("HTTP {}", status));
                        }
                        let delay = Duration::from_secs(2u64.pow(other_attempts - 1));
                        tokio::time::sleep(delay).await;
                    }
                }
                Err(e) => {
                    other_attempts += 1;
                    warn!(
                        "Request failed page {} (attempt {}/{}): {:?}",
                        page, other_attempts, MAX_RETRIES, e
                    );
                    if other_attempts >= MAX_RETRIES {
                        return PageResult::Fatal(e.to_string());
                    }
                    let delay = Duration::from_secs(2u64.pow(other_attempts - 1));
                    tokio::time::sleep(delay).await;
                }
            }
        }
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
        let max_requests = match self.tier {
            ApiTier::Pro => 400,  // conservative: stay under 500/min
            ApiTier::Demo | ApiTier::Free => 18, // shared 3s limiter ≈ 20 req/min
        };
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests,
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

        // Use /coins/markets (250 coins/page) — 40 pages for ~10k coins.
        // Much more efficient than /simple/price (50 coins/batch = 200 calls).
        let all_coins = self.fetch_top_coins(usize::MAX).await?;

        // Build lookup of requested asset_ids for O(1) matching
        let requested: std::collections::HashSet<&str> =
            asset_ids.iter().map(|s| s.as_str()).collect();

        let mut results = Vec::new();
        for coin in &all_coins {
            if !requested.contains(coin.id.as_str()) {
                continue;
            }
            if let Some(price_usd) = coin.current_price {
                let price = Decimal::try_from(price_usd).unwrap_or_default();
                let volume = coin.total_volume.and_then(|v| Decimal::try_from(v).ok());
                let market_cap = coin.market_cap.and_then(|v| Decimal::try_from(v).ok());
                let change_pct = coin
                    .price_change_percentage_24h
                    .and_then(|v| Decimal::try_from(v).ok());

                results.push(PriceUpdate {
                    asset_id: coin.id.clone(),
                    symbol: coin.symbol.to_uppercase(),
                    value: price,
                    prev_close: None,
                    change_pct,
                    volume_24h: volume,
                    market_cap,
                    fetched_at: now,
                });
            }
        }

        info!(
            "Fetched {}/{} crypto prices via /coins/markets ({} pages)",
            results.len(),
            asset_ids.len(),
            (all_coins.len() + 249) / 250
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
    fn test_tier_detection() {
        assert_eq!(CoinGeckoMarketSource::detect_tier(""), ApiTier::Free);
        assert_eq!(CoinGeckoMarketSource::detect_tier("  "), ApiTier::Free);
        assert_eq!(CoinGeckoMarketSource::detect_tier("CG-abc123"), ApiTier::Demo);
        assert_eq!(CoinGeckoMarketSource::detect_tier("some-pro-key"), ApiTier::Pro);
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
