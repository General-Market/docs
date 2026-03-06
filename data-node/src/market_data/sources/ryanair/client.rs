//! Ryanair flight delays source implementing MarketDataSource
//!
//! Tracks average departure delays by airport for Ryanair flights.
//! Each airport is an asset; its value is the average delay in minutes
//! for Ryanair departures.
//!
//! Assets are static -- defined in config/ryanair.json.
//!
//! API: https://www.ryanair.com/api/ (unofficial, may change)
//! Auth: None
//! Rate limit: Conservative 30 req/5min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/ryanair.json");

pub struct RyanairMarketSource {
    http: SourceHttpClient,
}

impl RyanairMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Ryanair flight delays source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for RyanairMarketSource {
    fn source_id(&self) -> &'static str {
        "ryanair"
    }

    fn display_name(&self) -> &'static str {
        "Ryanair Flight Delays"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(300),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "Ryanair fetch_assets: {} airports loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get airport codes from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        // TODO: Implement actual Ryanair API integration
        // Fetch departure delays per airport
        for asset_id in asset_ids {
            let (_airport_code, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (airport code) for asset {}", asset_id);
                    continue;
                }
            };

            debug!("Ryanair: would fetch delays for {}", asset_id);

            // TODO: Fetch actual delay data from Ryanair API
            // results.push(PriceUpdate { ... });
        }

        info!(
            "Fetched {}/{} prices from Ryanair",
            results.len(),
            asset_ids.len(),
        );
        Ok(results)
    }
}
