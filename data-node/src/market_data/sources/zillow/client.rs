//! Zillow API client (Stub implementation)
//!
//! NOTE: Zillow's Bridge Interactive API requires a business application.
//! This is a placeholder that logs the requirement and returns empty results.

use anyhow::Result;
use chrono::{DateTime, Utc};
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
    ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/zillow.json");

/// Zillow market data source (Stub)
pub struct ZillowMarketSource {
    _stub: bool,
}

impl ZillowMarketSource {
    /// Create the Zillow client
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("ZILLOW_API_KEY").ok();

        if api_key.is_none() {
            warn!("Zillow source requires Bridge Interactive API access. See: https://bridgeinteractive.com/");
            warn!("ZILLOW_API_KEY not configured - Zillow data will not be available");
        } else {
            info!("Zillow client initialized (stub - API implementation pending)");
        }

        Ok(Self { _stub: true })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for ZillowMarketSource {
    fn source_id(&self) -> &'static str {
        "zillow"
    }

    fn display_name(&self) -> &'static str {
        "Zillow Real Estate (Unavailable)"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Monthly data
        Duration::from_secs(24 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        // Log that we can't fetch
        info!("Zillow source unavailable - requires Bridge Interactive API access");
        Ok(vec![])
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for ZillowMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // Check once per day (stub)
        now + chrono::Duration::days(1)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Always skip since we can't actually fetch
        true
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
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
        assert_eq!(entries.len(), 10);
    }

    #[test]
    fn test_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.category == "macro"));
        assert!(entries.iter().all(|e| e.subcategory == "housing"));
    }
}
