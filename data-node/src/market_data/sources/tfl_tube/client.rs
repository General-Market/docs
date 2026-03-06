//! London TfL Tube status source implementing MarketDataSource
//!
//! Tracks tube line disruption severity using the TfL Unified API.
//! Each tube line is an asset; its value represents disruption severity
//! (0 = good service, higher = more disrupted).
//!
//! Assets are static -- defined in config/tfl_tube.json.
//!
//! API: https://api.tfl.gov.uk/Line/Mode/tube/Status
//! Auth: Optional app_key (TFL_APP_KEY env var) for higher rate limits
//! Rate limit: 50 req/min without key, 500 req/min with key

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

const ASSET_JSON: &str = include_str!("../../../config/tfl_tube.json");

pub struct TflTubeMarketSource {
    http: SourceHttpClient,
}

impl TflTubeMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 50,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("TfL Tube status source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TflTubeMarketSource {
    fn source_id(&self) -> &'static str {
        "tfl_tube"
    }

    fn display_name(&self) -> &'static str {
        "London TfL Tube Status"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300) // 5 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 50,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "TfL Tube fetch_assets: {} lines loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get line references from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        // TODO: Implement actual TfL Unified API integration
        // GET https://api.tfl.gov.uk/Line/Mode/tube/Status
        // Parse line status severity (Good Service=0, Minor Delays=1, etc.)
        for asset_id in asset_ids {
            let (_line_id, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (line ID) for asset {}", asset_id);
                    continue;
                }
            };

            debug!("TfL Tube: would fetch status for {}", asset_id);

            // TODO: Fetch actual line status from TfL API
            // results.push(PriceUpdate { ... });
        }

        info!(
            "Fetched {}/{} prices from TfL Tube",
            results.len(),
            asset_ids.len(),
        );
        Ok(results)
    }
}
