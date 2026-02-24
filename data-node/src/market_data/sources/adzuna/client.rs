//! Adzuna Jobs source (stub)
//!
//! TODO: Implement Adzuna job market data tracking.

use anyhow::Result;
use async_trait::async_trait;
use std::time::Duration;

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

pub struct AdzunaMarketSource;

impl AdzunaMarketSource {
    pub fn from_env() -> Result<Self> {
        Ok(Self)
    }
}

#[async_trait]
impl MarketDataSource for AdzunaMarketSource {
    fn source_id(&self) -> &'static str {
        "adzuna"
    }

    fn display_name(&self) -> &'static str {
        "Adzuna Jobs"
    }

    fn default_resolution(&self) -> &'static str {
        "latest"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600)
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
        Ok(vec![])
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        Ok(vec![])
    }
}
