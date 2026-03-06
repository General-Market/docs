//! US Power Outages (ODIN) source implementing MarketDataSource
//!
//! Tracks power outage counts by US state using the ODIN/DOE PowerOutage.us API.
//! Each state is an asset; its value is the number of customers without power.
//!
//! Assets are static -- defined in config/power_outages.json.
//!
//! API: https://poweroutage.us/api/
//! Auth: API key may be required (POWER_OUTAGE_API_KEY env var)
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

const ASSET_JSON: &str = include_str!("../../../config/power_outages.json");

pub struct PowerOutagesMarketSource {
    http: SourceHttpClient,
}

impl PowerOutagesMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("US Power Outages (ODIN) source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for PowerOutagesMarketSource {
    fn source_id(&self) -> &'static str {
        "power_outages"
    }

    fn display_name(&self) -> &'static str {
        "US Power Outages (ODIN)"
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
            "Power Outages fetch_assets: {} states loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get state references from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        // TODO: Implement actual PowerOutage.us / ODIN API integration
        // Fetch outage counts per state
        for asset_id in asset_ids {
            let (_state_ref, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (state code) for asset {}", asset_id);
                    continue;
                }
            };

            debug!("Power Outages: would fetch outage count for {}", asset_id);

            // TODO: Fetch actual outage count from API
            // results.push(PriceUpdate { ... });
        }

        info!(
            "Fetched {}/{} prices from Power Outages",
            results.len(),
            asset_ids.len(),
        );
        Ok(results)
    }
}
