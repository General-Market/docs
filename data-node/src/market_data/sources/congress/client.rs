//! Congress.gov API client implementing MarketDataSource
//!
//! Fetches legislative data from https://api.congress.gov/v3/
//! Tracks bills, nominations, and legislative activity.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
    ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// Congress.gov API base URL
const CONGRESS_API_URL: &str = "https://api.congress.gov/v3";

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/congress.json");

/// Congress.gov API response structure
#[derive(Debug, Deserialize)]
struct CongressResponse {
    pagination: Option<CongressPagination>,
}

#[derive(Debug, Deserialize)]
struct CongressPagination {
    count: i64,
}

/// Congress market data source
pub struct CongressMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl CongressMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("CONGRESS_API_KEY").context("CONGRESS_API_KEY not set")?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 400,
                duration: Duration::from_secs(3600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("Congress client initialized with {} metrics", asset_count);

        Ok(Self { http, api_key })
    }

    /// Fetch count for a metric
    async fn fetch_metric(&self, endpoint_suffix: &str) -> Result<Option<i64>> {
        let url = format!(
            "{}/{}?api_key={}&limit=1",
            CONGRESS_API_URL, endpoint_suffix, self.api_key
        );

        let data: CongressResponse = match self.http.get_json(&url).await {
            Ok(d) => d,
            Err(e) => {
                warn!("Congress API error for {}: {}", endpoint_suffix, e);
                return Ok(None);
            }
        };

        Ok(data.pagination.map(|p| p.count))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for CongressMarketSource {
    fn source_id(&self) -> &'static str {
        "congress"
    }

    fn display_name(&self) -> &'static str {
        "Congress.gov Legislative Activity"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Check every 6 hours
        Duration::from_secs(6 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 400, // Conservative: Congress allows 5000/hr
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        let entries = load_all_asset_entries(ASSET_JSON)?;

        for entry in &entries {
            match self.fetch_metric(&entry.api_ref).await {
                Ok(Some(count)) => {
                    if let Ok(value) = Decimal::from_str(&count.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: entry.asset_id.clone(),
                            symbol: entry.symbol.clone(),
                            value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Ok(None) => {
                    debug!("No Congress data for {}", entry.asset_id);
                }
                Err(e) => {
                    warn!("Error fetching Congress data for {}: {:?}", entry.asset_id, e);
                }
            }
        }

        info!("Fetched {} Congress legislative metrics", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for CongressMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // Check every 6 hours
        now + chrono::Duration::hours(6)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Legislative activity can happen any day
        false
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        // No burst mode for Congress data
        None
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metric_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.len() >= 10, "Expected at least 10 Congress metrics");
    }

    #[test]
    fn test_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.category == "regulatory"));
        assert!(entries.iter().all(|e| e.subcategory == "legislative"));
    }
}
