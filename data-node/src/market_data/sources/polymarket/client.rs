//! Polymarket Gamma API client implementing MarketDataSource
//!
//! Fetches prediction market data from https://gamma-api.polymarket.com
//! Markets are dynamically discovered from the Gamma API (no static JSON needed).
//!
//! Lifecycle management:
//! - `fetch_assets()` only registers markets that are open, active, accepting orders,
//!   and have parseable outcome prices. This prevents dead markets from entering the DB.
//! - `fetch_prices()` uses the open-markets fetch for bulk pricing, then individually
//!   queries any remaining assets (likely resolved/closed) via the single-market endpoint
//!   to return terminal prices. This eliminates the "never got prices" gap.
//! - The sync engine deactivates markets dropped from `fetch_assets()` automatically.

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashSet;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Polymarket Gamma API base URL
const GAMMA_API_URL: &str = "https://gamma-api.polymarket.com";

/// Page size for paginated requests
const PAGE_SIZE: usize = 500;

/// Max individual market lookups per price cycle (don't hammmer API for stale assets)
const MAX_INDIVIDUAL_LOOKUPS: usize = 200;

/// Delay between individual market fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 100;

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
    /// Whether market has been resolved (e.g. "Yes" or "No" outcome decided)
    #[serde(default)]
    resolved: bool,
    /// Whether the market is currently accepting orders
    #[serde(default)]
    accepting_orders: bool,
    /// End date as ISO string (market expiry)
    #[serde(default)]
    end_date_iso: Option<String>,
}

impl GammaMarket {
    /// Whether this market is open for trading and should be registered
    fn is_open_for_trading(&self) -> bool {
        self.active && !self.closed && !self.resolved && self.accepting_orders
    }

    /// Whether this market has reached a terminal state (resolved or closed)
    fn is_terminal(&self) -> bool {
        self.resolved || self.closed
    }
}

/// Polymarket prediction markets data source
pub struct PolymarketMarketSource {
    http: SourceHttpClient,
    sync_interval_secs: u64,
}

impl PolymarketMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let sync_interval_secs = std::env::var("POLYMARKET_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(300); // 5 minutes default

        let http = SourceHttpClient::new(
            RateLimitConfig {
                windows: vec![RateWindow {
                    max_requests: 400,
                    duration: Duration::from_secs(60),
                }],
            },
            RetryConfig::default(),
        );

        info!("Polymarket client initialized");

        Ok(Self {
            http,
            sync_interval_secs,
        })
    }

    /// Fetch all open markets from Gamma API with pagination (closed=false).
    /// Returns only markets the API considers open.
    async fn fetch_open_markets(&self) -> Result<Vec<GammaMarket>> {
        let mut all_markets = Vec::new();
        let mut offset = 0;

        loop {
            let url = format!(
                "{}/markets?closed=false&limit={}&offset={}",
                GAMMA_API_URL, PAGE_SIZE, offset
            );
            let markets: Vec<GammaMarket> = self.http.get_json(&url).await.map_err(|e| anyhow::anyhow!("{}", e))?;
            let page_size = markets.len();

            debug!("Fetched {} open markets from offset {}", page_size, offset);
            all_markets.extend(markets);

            if page_size < PAGE_SIZE {
                break;
            }
            offset += PAGE_SIZE;
        }

        info!(
            "Fetched {} total open markets from Polymarket Gamma API",
            all_markets.len()
        );

        Ok(all_markets)
    }

    /// Fetch a single market by condition_id. Returns None if not found.
    /// This endpoint returns the market regardless of closed/resolved status.
    async fn fetch_single_market(&self, condition_id: &str) -> Option<GammaMarket> {
        let url = format!("{}/markets/{}", GAMMA_API_URL, condition_id);
        match self.http.get_json::<GammaMarket>(&url).await {
            Ok(market) => Some(market),
            Err(e) => {
                debug!("Failed to fetch market {}: {:?}", condition_id, e);
                None
            }
        }
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

    /// Build a PriceUpdate from a GammaMarket
    fn market_to_price(m: &GammaMarket, now: chrono::DateTime<Utc>) -> Option<PriceUpdate> {
        let prices_str = m.outcome_prices.as_ref()?;
        let (yes_price, _no_price) = Self::parse_outcome_prices(prices_str)?;

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
        // Only fetch open markets (closed=false from API).
        // Further filter: must be active, not resolved, accepting orders, and
        // have parseable outcome prices. This prevents registering dead markets.
        let markets = self.fetch_open_markets().await?;

        let total = markets.len();
        let resolved_count = markets.iter().filter(|m| m.resolved).count();
        let closed_count = markets.iter().filter(|m| m.closed).count();
        let not_accepting = markets.iter().filter(|m| !m.accepting_orders).count();
        info!(
            "Polymarket: {} from API, {} resolved, {} closed, {} not accepting orders",
            total, resolved_count, closed_count, not_accepting
        );

        let assets: Vec<AssetUpdate> = markets
            .into_iter()
            .filter(|m| m.is_open_for_trading())
            .filter(|m| {
                // Must have parseable outcome prices — markets without prices are useless
                m.outcome_prices.as_ref()
                    .and_then(|s| Self::parse_outcome_prices(s))
                    .is_some()
            })
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
                        "accepting_orders": true,
                        "source_category": m.category,
                        "volume": m.volume,
                        "end_date_iso": m.end_date_iso,
                    }),
                }
            })
            .collect();

        info!("Discovered {} tradeable Polymarket markets (from {} API results)", assets.len(), total);

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let asset_set: HashSet<&str> = asset_ids.iter().map(|s| s.as_str()).collect();

        // Step 1: Fetch open markets (same as fetch_assets). This covers the majority
        // of active assets efficiently in bulk.
        let open_markets = self.fetch_open_markets().await?;

        let mut prices = Vec::new();
        let mut found_ids: HashSet<String> = HashSet::new();
        let mut terminal_from_open = 0u32;

        for m in &open_markets {
            if !asset_set.contains(m.condition_id.as_str()) {
                continue;
            }

            // Even in the "open" response, some may be resolved/closed (API lag)
            if let Some(price) = Self::market_to_price(m, now) {
                found_ids.insert(m.condition_id.clone());
                prices.push(price);

                if m.is_terminal() {
                    terminal_from_open += 1;
                }
            }
        }

        // Step 2: For assets NOT found in the open markets response, they likely
        // resolved/closed since the last fetch_assets() cycle. Query them individually
        // to get terminal prices. Cap at MAX_INDIVIDUAL_LOOKUPS to avoid hammering the API.
        let missing: Vec<&str> = asset_ids
            .iter()
            .filter(|id| !found_ids.contains(id.as_str()))
            .map(|s| s.as_str())
            .collect();

        let mut resolved_count = 0u32;
        let mut closed_count = 0u32;
        let mut not_found = 0u32;
        let lookups = missing.len().min(MAX_INDIVIDUAL_LOOKUPS);

        if !missing.is_empty() {
            info!(
                "Polymarket: {} assets missing from open markets, querying {} individually",
                missing.len(),
                lookups
            );

            for &condition_id in missing.iter().take(MAX_INDIVIDUAL_LOOKUPS) {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

                match self.fetch_single_market(condition_id).await {
                    Some(m) => {
                        if m.resolved {
                            resolved_count += 1;
                        }
                        if m.closed {
                            closed_count += 1;
                        }

                        // Return terminal price so this asset gets a final price record
                        // before the next fetch_assets() cycle deactivates it
                        if let Some(price) = Self::market_to_price(&m, now) {
                            prices.push(price);
                        }
                    }
                    None => {
                        not_found += 1;
                        debug!("Market {} not found via individual lookup", condition_id);
                    }
                }
            }

            if resolved_count > 0 || closed_count > 0 || not_found > 0 {
                info!(
                    "Polymarket individual lookups: {} resolved, {} closed, {} not found",
                    resolved_count, closed_count, not_found
                );
            }
        }

        info!(
            "Fetched {}/{} Polymarket prices ({} from bulk, {} from individual lookups)",
            prices.len(),
            asset_ids.len(),
            found_ids.len(),
            prices.len() - found_ids.len(),
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

    #[test]
    fn test_is_open_for_trading() {
        let market = GammaMarket {
            condition_id: "abc".to_string(),
            question: "Will X happen?".to_string(),
            description: None,
            category: None,
            volume: None,
            outcome_prices: Some("[0.5, 0.5]".to_string()),
            closed: false,
            active: true,
            resolved: false,
            accepting_orders: true,
            end_date_iso: None,
        };
        assert!(market.is_open_for_trading());
        assert!(!market.is_terminal());
    }

    #[test]
    fn test_resolved_market_is_terminal() {
        let market = GammaMarket {
            condition_id: "abc".to_string(),
            question: "Will X happen?".to_string(),
            description: None,
            category: None,
            volume: None,
            outcome_prices: Some("[1.0, 0.0]".to_string()),
            closed: true,
            active: false,
            resolved: true,
            accepting_orders: false,
            end_date_iso: None,
        };
        assert!(!market.is_open_for_trading());
        assert!(market.is_terminal());
    }

    #[test]
    fn test_closed_not_accepting_not_tradeable() {
        let market = GammaMarket {
            condition_id: "abc".to_string(),
            question: "Test?".to_string(),
            description: None,
            category: None,
            volume: None,
            outcome_prices: Some("[0.7, 0.3]".to_string()),
            closed: false,
            active: true,
            resolved: false,
            accepting_orders: false,
            end_date_iso: None,
        };
        assert!(!market.is_open_for_trading());
        assert!(!market.is_terminal());
    }

    #[test]
    fn test_market_to_price() {
        let market = GammaMarket {
            condition_id: "test123".to_string(),
            question: "Test?".to_string(),
            description: None,
            category: None,
            volume: Some("1000".to_string()),
            outcome_prices: Some("[0.75, 0.25]".to_string()),
            closed: false,
            active: true,
            resolved: false,
            accepting_orders: true,
            end_date_iso: None,
        };

        let price = PolymarketMarketSource::market_to_price(&market, Utc::now());
        assert!(price.is_some());
        let p = price.unwrap();
        assert_eq!(p.asset_id, "test123");
        assert_eq!(p.value.to_string(), "0.75");
        assert!(p.volume_24h.is_some());
    }

    #[test]
    fn test_market_to_price_no_prices() {
        let market = GammaMarket {
            condition_id: "test".to_string(),
            question: "Test?".to_string(),
            description: None,
            category: None,
            volume: None,
            outcome_prices: None,
            closed: false,
            active: true,
            resolved: false,
            accepting_orders: true,
            end_date_iso: None,
        };

        let price = PolymarketMarketSource::market_to_price(&market, Utc::now());
        assert!(price.is_none());
    }
}
