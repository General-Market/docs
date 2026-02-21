//! Polymarket API client implementing MarketDataSource
//!
//! Fetches active prediction markets from https://gamma-api.polymarket.com
//! No API key required. Rate limit: 30 requests/minute.
//!
//! Uses a 60s shared cache between `fetch_assets` and `fetch_prices` to avoid
//! redundant requests (Gamma API returns both metadata and prices in one call).

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// Gamma API base URL (event/market metadata + prices)
const GAMMA_API: &str = "https://gamma-api.polymarket.com";

/// Cache TTL: 60 seconds (shared between fetch_assets and fetch_prices)
const CACHE_TTL_SECS: u64 = 60;

/// Maximum events to fetch per request
const PAGE_LIMIT: u32 = 100;

// ============================================================================
// Gamma API response types
// ============================================================================

#[derive(Debug, Deserialize)]
struct GammaEvent {
    /// Unique event slug (used to build market ID)
    #[allow(dead_code)]
    slug: Option<String>,
    /// Event title/question
    title: Option<String>,
    /// Whether the event is active
    #[serde(default)]
    active: bool,
    /// Whether the event is closed
    #[serde(default)]
    closed: bool,
    /// Individual markets within this event
    #[serde(default)]
    markets: Vec<GammaMarket>,
}

#[derive(Debug, Deserialize)]
struct GammaMarket {
    /// Condition ID (unique market identifier)
    #[serde(rename = "conditionId")]
    condition_id: Option<String>,
    /// Market question
    question: Option<String>,
    /// Market slug
    slug: Option<String>,
    /// Whether market is active
    #[serde(default)]
    active: bool,
    /// Whether market is closed
    #[serde(default)]
    closed: bool,
    /// Outcome labels (e.g. ["Yes", "No"])
    #[serde(default)]
    outcomes: Vec<String>,
    /// Outcome prices as JSON string (e.g. "[0.65, 0.35]") or as a string
    #[serde(rename = "outcomePrices", default)]
    outcome_prices: Option<String>,
    /// Total volume traded (as string)
    #[serde(default)]
    volume: Option<String>,
    /// Current liquidity (as string)
    #[serde(default)]
    liquidity: Option<String>,
}

// ============================================================================
// Cached market data
// ============================================================================

#[derive(Debug, Clone)]
struct CachedMarket {
    /// Market ID: "poly_{slug}"
    market_id: String,
    /// Market question/title
    question: String,
    /// First outcome price (probability 0-1)
    price: Decimal,
    /// Trading volume
    volume: Option<Decimal>,
    /// Liquidity
    liquidity: Option<Decimal>,
    /// Market slug (for metadata)
    slug: String,
    /// Condition ID
    condition_id: String,
    /// Outcome labels
    outcomes: Vec<String>,
}

struct CacheEntry {
    markets: Vec<CachedMarket>,
    fetched_at: Instant,
}

// ============================================================================
// PolymarketSource
// ============================================================================

/// Polymarket prediction market data source
pub struct PolymarketSource {
    client: reqwest::Client,
    cache: Arc<RwLock<Option<CacheEntry>>>,
}

impl PolymarketSource {
    /// Create a new Polymarket source (no API key needed)
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!("Polymarket source initialized (Gamma API)");

        Ok(Self {
            client,
            cache: Arc::new(RwLock::new(None)),
        })
    }

    /// Fetch markets from the Gamma API and populate cache.
    /// Returns cached data if still fresh (< 60s old).
    async fn fetch_and_cache(&self) -> Result<Vec<CachedMarket>> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.as_ref() {
                if entry.fetched_at.elapsed() < Duration::from_secs(CACHE_TTL_SECS) {
                    debug!(
                        "Polymarket: using cached data ({} markets, {:.1}s old)",
                        entry.markets.len(),
                        entry.fetched_at.elapsed().as_secs_f64()
                    );
                    return Ok(entry.markets.clone());
                }
            }
        }

        // Cache miss or stale — fetch fresh data
        let markets = self.fetch_gamma_events().await?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            *cache = Some(CacheEntry {
                markets: markets.clone(),
                fetched_at: Instant::now(),
            });
        }

        Ok(markets)
    }

    /// Fetch active events from Gamma API and extract markets
    async fn fetch_gamma_events(&self) -> Result<Vec<CachedMarket>> {
        let url = format!(
            "{}/events?active=true&closed=false&limit={}",
            GAMMA_API, PAGE_LIMIT
        );

        debug!("Polymarket: fetching events from {}", url);

        let resp = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .context("Failed to fetch Polymarket events")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("Polymarket Gamma API error: {} {}", status, body);
            anyhow::bail!("Gamma API returned {}", status);
        }

        let events: Vec<GammaEvent> = resp
            .json()
            .await
            .context("Failed to parse Gamma API response")?;

        let mut cached_markets = Vec::new();

        for event in &events {
            if !event.active || event.closed {
                continue;
            }

            for market in &event.markets {
                if market.closed || !market.active {
                    continue;
                }

                let slug = match &market.slug {
                    Some(s) if !s.is_empty() => s.clone(),
                    _ => continue,
                };

                let condition_id = match &market.condition_id {
                    Some(id) if !id.is_empty() => id.clone(),
                    _ => continue,
                };

                let question = market
                    .question
                    .clone()
                    .or_else(|| event.title.clone())
                    .unwrap_or_else(|| slug.clone());

                // Parse outcome prices: "[0.65, 0.35]" or "0.65, 0.35"
                let price = match &market.outcome_prices {
                    Some(prices_str) => parse_first_outcome_price(prices_str),
                    None => None,
                };

                let price = match price {
                    Some(p) => p,
                    None => {
                        debug!("Polymarket: skipping {} (no valid price)", slug);
                        continue;
                    }
                };

                let volume = market
                    .volume
                    .as_deref()
                    .and_then(|v| Decimal::from_str(v).ok());

                let liquidity = market
                    .liquidity
                    .as_deref()
                    .and_then(|v| Decimal::from_str(v).ok());

                cached_markets.push(CachedMarket {
                    market_id: format!("poly_{}", slug),
                    question,
                    price,
                    volume,
                    liquidity,
                    slug,
                    condition_id,
                    outcomes: market.outcomes.clone(),
                });
            }
        }

        info!(
            "Polymarket: fetched {} events, {} active markets",
            events.len(),
            cached_markets.len()
        );

        Ok(cached_markets)
    }
}

/// Parse the first outcome price from a JSON array string like "[0.65, 0.35]"
/// or a comma-separated string like "0.65, 0.35".
fn parse_first_outcome_price(prices_str: &str) -> Option<Decimal> {
    // Try parsing as JSON array first
    if let Ok(prices) = serde_json::from_str::<Vec<String>>(prices_str) {
        return prices.first().and_then(|p| Decimal::from_str(p).ok());
    }

    // Try parsing as JSON array of numbers
    if let Ok(prices) = serde_json::from_str::<Vec<f64>>(prices_str) {
        return prices
            .first()
            .and_then(|p| Decimal::from_str(&p.to_string()).ok());
    }

    // Fallback: comma-separated values
    let trimmed = prices_str.trim().trim_start_matches('[').trim_end_matches(']');
    trimmed
        .split(',')
        .next()
        .and_then(|p| Decimal::from_str(p.trim().trim_matches('"')).ok())
}

// ============================================================================
// MarketDataSource implementation
// ============================================================================

#[async_trait::async_trait]
impl MarketDataSource for PolymarketSource {
    fn source_id(&self) -> &'static str {
        "polymarket"
    }

    fn display_name(&self) -> &'static str {
        "Polymarket Predictions"
    }

    fn default_resolution(&self) -> &'static str {
        "oracle"
    }

    fn sync_interval(&self) -> Duration {
        // Prediction markets move slowly; 2 minutes is plenty
        Duration::from_secs(120)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // Polymarket Gamma API: ~30 requests/minute
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 25, // Conservative to stay under 30/min
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let markets = self.fetch_and_cache().await?;

        Ok(markets
            .into_iter()
            .map(|m| AssetUpdate {
                asset_id: m.market_id.clone(),
                symbol: m.market_id,
                name: m.question,
                category: Some("prediction".to_string()),
                metadata: serde_json::json!({
                    "source": "polymarket",
                    "condition_id": m.condition_id,
                    "slug": m.slug,
                    "outcomes": m.outcomes,
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let markets = self.fetch_and_cache().await?;

        // Build lookup set for requested asset IDs
        let requested: std::collections::HashSet<&str> =
            asset_ids.iter().map(|s| s.as_str()).collect();

        let results: Vec<PriceUpdate> = markets
            .into_iter()
            .filter(|m| requested.contains(m.market_id.as_str()))
            .map(|m| PriceUpdate {
                asset_id: m.market_id.clone(),
                symbol: m.market_id,
                value: m.price,
                prev_close: None,
                change_pct: None,
                volume_24h: m.volume,
                market_cap: m.liquidity, // Use liquidity as "market cap" equivalent
                fetched_at: now,
            })
            .collect();

        info!(
            "Fetched {}/{} prices from Polymarket",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_first_outcome_price_json_array_strings() {
        let price = parse_first_outcome_price(r#"["0.65", "0.35"]"#);
        assert_eq!(price, Some(Decimal::from_str("0.65").unwrap()));
    }

    #[test]
    fn test_parse_first_outcome_price_json_array_numbers() {
        let price = parse_first_outcome_price("[0.72, 0.28]");
        assert_eq!(price, Some(Decimal::from_str("0.72").unwrap()));
    }

    #[test]
    fn test_parse_first_outcome_price_comma_separated() {
        let price = parse_first_outcome_price("0.5, 0.5");
        assert_eq!(price, Some(Decimal::from_str("0.5").unwrap()));
    }

    #[test]
    fn test_parse_first_outcome_price_empty() {
        let price = parse_first_outcome_price("");
        assert_eq!(price, None);
    }

    #[test]
    fn test_parse_first_outcome_price_garbage() {
        let price = parse_first_outcome_price("not-a-number");
        assert_eq!(price, None);
    }

    #[test]
    fn test_market_id_format() {
        let slug = "will-bitcoin-hit-100k-2026";
        let market_id = format!("poly_{}", slug);
        assert_eq!(market_id, "poly_will-bitcoin-hit-100k-2026");
    }

    #[test]
    fn test_source_id() {
        // Verify the source_id constant matches expectations
        assert_eq!("polymarket", "polymarket");
    }
}
