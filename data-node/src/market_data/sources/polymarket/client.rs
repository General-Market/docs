//! Polymarket Gamma API client implementing MarketDataSource
//!
//! Fetches prediction market data from https://gamma-api.polymarket.com
//! Markets are dynamically discovered from the Gamma API (no static JSON needed).

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Polymarket Gamma API base URL
const GAMMA_API_URL: &str = "https://gamma-api.polymarket.com";

/// Request timeout in seconds
const REQUEST_TIMEOUT_SECS: u64 = 30;

/// Page size for paginated requests
const PAGE_SIZE: usize = 500;

/// Maximum retries per request
const MAX_RETRIES: u32 = 3;

/// Rate limit: minimum delay between API requests (ms)
/// Polymarket allows ~10 requests/second, we use 150ms to stay safe
const MIN_REQUEST_DELAY_MS: u64 = 150;

/// Gamma API market response
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GammaMarket {
    condition_id: String,
    question: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    category: Option<String>,
    /// Volume as string
    #[serde(default)]
    volume: Option<String>,
    /// Outcome prices as JSON string "[0.65, 0.35]"
    #[serde(default)]
    outcome_prices: Option<String>,
    /// Whether market is closed
    #[serde(default)]
    closed: bool,
    /// Whether market is active
    #[serde(default)]
    active: bool,
}

/// Polymarket prediction markets data source
pub struct PolymarketMarketSource {
    client: reqwest::Client,
    last_request: Arc<Mutex<std::time::Instant>>,
    sync_interval_secs: u64,
}

impl PolymarketMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let sync_interval_secs = std::env::var("POLYMARKET_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(300); // 5 minutes default

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .context("Failed to create HTTP client")?;

        info!("Polymarket client initialized");

        Ok(Self {
            client,
            last_request: Arc::new(Mutex::new(std::time::Instant::now())),
            sync_interval_secs,
        })
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

    /// Fetch all active markets from Gamma API with pagination
    async fn fetch_all_markets(&self) -> Result<Vec<GammaMarket>> {
        let mut all_markets = Vec::new();
        let mut offset = 0;

        loop {
            let markets = self.fetch_markets_page(offset).await?;
            let page_size = markets.len();

            all_markets.extend(markets);

            if page_size < PAGE_SIZE {
                break;
            }

            offset += PAGE_SIZE;
        }

        info!(
            "Fetched {} total markets from Polymarket Gamma API",
            all_markets.len()
        );

        Ok(all_markets)
    }

    /// Fetch a single page of markets
    async fn fetch_markets_page(&self, offset: usize) -> Result<Vec<GammaMarket>> {
        let url = format!(
            "{}/markets?closed=false&limit={}&offset={}",
            GAMMA_API_URL, PAGE_SIZE, offset
        );

        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            self.rate_limit().await;

            match self.client.get(&url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        match response.json::<Vec<GammaMarket>>().await {
                            Ok(markets) => {
                                debug!("Fetched {} markets from offset {}", markets.len(), offset);
                                return Ok(markets);
                            }
                            Err(e) => {
                                warn!(
                                    "Failed to parse Gamma API response (attempt {}/{}): {:?}",
                                    attempt + 1,
                                    MAX_RETRIES,
                                    e
                                );
                                last_error = Some(e.to_string());
                            }
                        }
                    } else {
                        warn!(
                            "Gamma API error (attempt {}/{}): status {}",
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

            if attempt < MAX_RETRIES - 1 {
                let delay = Duration::from_secs(2u64.pow(attempt));
                tokio::time::sleep(delay).await;
            }
        }

        Err(anyhow::anyhow!(
            "Failed to fetch markets after {} retries: {:?}",
            MAX_RETRIES,
            last_error
        ))
    }

    /// Parse outcome prices from string "[\"0.65\", \"0.35\"]" or "[0.65, 0.35]" -> (yes_price, no_price)
    fn parse_outcome_prices(s: &str) -> Option<(Decimal, Decimal)> {
        // Remove brackets and split
        let trimmed = s.trim_start_matches('[').trim_end_matches(']');
        let parts: Vec<&str> = trimmed.split(',').collect();

        if parts.len() >= 2 {
            // Remove quotes and whitespace from each part
            let yes_str = parts[0].trim().trim_matches('"');
            let no_str = parts[1].trim().trim_matches('"');

            let yes: f64 = yes_str.parse().ok()?;
            let no: f64 = no_str.parse().ok()?;
            Some((
                Decimal::try_from(yes).ok()?,
                Decimal::try_from(no).ok()?,
            ))
        } else {
            None
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for PolymarketMarketSource {
    fn source_id(&self) -> &'static str {
        "polymarket"
    }

    fn display_name(&self) -> &'static str {
        "Polymarket Predictions"
    }

    fn default_resolution(&self) -> &'static str {
        "polymarket"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(self.sync_interval_secs)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 400, // 10/sec * 60 = 600, use 400 to be safe
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // Dynamically discover all active markets from Gamma API
        let markets = self.fetch_all_markets().await?;

        let assets: Vec<AssetUpdate> = markets
            .into_iter()
            .filter(|m| m.active && !m.closed)
            .filter(|m| m.outcome_prices.is_some()) // Only markets with prices
            .map(|m| {
                let category = m.category
                    .as_deref()
                    .unwrap_or("prediction")
                    .to_lowercase();

                AssetUpdate {
                    asset_id: m.condition_id.clone(),
                    symbol: m.condition_id.chars().take(12).collect(),
                    name: m.question.chars().take(200).collect(),
                    category: Some(category),
                    metadata: serde_json::json!({
                        "active": true,
                        "source_category": m.category,
                        "volume": m.volume,
                    }),
                }
            })
            .collect();

        info!("Discovered {} active Polymarket markets", assets.len());

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        // For Polymarket, we need to re-fetch to get current prices
        // The Gamma API returns prices in the markets response
        let markets = self.fetch_all_markets().await?;
        let now = Utc::now();

        // Build lookup
        let asset_set: std::collections::HashSet<&str> =
            asset_ids.iter().map(|s| s.as_str()).collect();

        let prices: Vec<PriceUpdate> = markets
            .into_iter()
            .filter(|m| asset_set.contains(m.condition_id.as_str()))
            .filter_map(|m| {
                // Parse outcome prices
                let (yes_price, _no_price) =
                    m.outcome_prices.as_ref().and_then(|s| Self::parse_outcome_prices(s))?;

                // Use "Yes" price as the value (probability 0-1)
                Some(PriceUpdate {
                    asset_id: m.condition_id.clone(),
                    symbol: m.condition_id.chars().take(12).collect(),
                    value: yes_price,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: m.volume.as_ref().and_then(|v| {
                        v.parse::<f64>().ok().and_then(|f| Decimal::try_from(f).ok())
                    }),
                    market_cap: None,
                    fetched_at: now,
                })
            })
            .collect();

        info!(
            "Fetched {}/{} Polymarket prices",
            prices.len(),
            asset_ids.len()
        );

        Ok(prices)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_outcome_prices() {
        let prices = PolymarketMarketSource::parse_outcome_prices("[0.65, 0.35]");
        assert!(prices.is_some());
        let (yes, no) = prices.unwrap();
        assert_eq!(yes.to_string(), "0.65");
        assert_eq!(no.to_string(), "0.35");
    }

    #[test]
    fn test_parse_outcome_prices_with_spaces() {
        let prices = PolymarketMarketSource::parse_outcome_prices("[ 0.5 , 0.5 ]");
        assert!(prices.is_some());
    }

    #[test]
    fn test_parse_outcome_prices_invalid() {
        assert!(PolymarketMarketSource::parse_outcome_prices("invalid").is_none());
        assert!(PolymarketMarketSource::parse_outcome_prices("[]").is_none());
    }
}
