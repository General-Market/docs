//! Paris Metro status source implementing MarketDataSource
//!
//! Tracks metro line disruption severity using the RATP/PRIM API.
//! Each metro line is an asset; its value represents disruption severity
//! (0 = normal service, higher = more disrupted).
//!
//! Assets are static -- defined in config/paris_metro.json.
//!
//! API: https://prim.iledefrance-mobilites.fr/marketplace/general-message
//! Auth: API key required (PRIM_API_KEY env var)
//! Rate limit: Conservative 60 req/5min

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

const ASSET_JSON: &str = include_str!("../../../config/paris_metro.json");

pub struct ParisMetroMarketSource {
    http: SourceHttpClient,
}

impl ParisMetroMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Paris Metro status source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for ParisMetroMarketSource {
    fn source_id(&self) -> &'static str {
        "paris_metro"
    }

    fn display_name(&self) -> &'static str {
        "Paris Metro Status"
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
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "Paris Metro fetch_assets: {} lines loaded from config",
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

        // TODO: Implement actual PRIM API integration for Paris Metro
        // Fetch general messages / disruption info per line
        for asset_id in asset_ids {
            let (_line_ref, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (line ID) for asset {}", asset_id);
                    continue;
                }
            };

            debug!("Paris Metro: would fetch status for {}", asset_id);

            // TODO: Fetch actual disruption severity from PRIM API
            // results.push(PriceUpdate { ... });
        }

        info!(
            "Fetched {}/{} prices from Paris Metro",
            results.len(),
            asset_ids.len(),
        );
        Ok(results)
    }
}
