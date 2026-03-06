//! NYC MTA Subway alerts source implementing MarketDataSource
//!
//! Tracks subway line disruption severity using the MTA real-time alerts API.
//! Each subway line is an asset; its value represents disruption severity
//! (0 = normal service, higher = more disrupted).
//!
//! Assets are static -- defined in config/mta_subway.json.
//!
//! API: https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/
//! Auth: API key required (MTA_API_KEY env var)
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

const ASSET_JSON: &str = include_str!("../../../config/mta_subway.json");

pub struct MtaSubwayMarketSource {
    http: SourceHttpClient,
}

impl MtaSubwayMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("MTA Subway alerts source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for MtaSubwayMarketSource {
    fn source_id(&self) -> &'static str {
        "mta_subway"
    }

    fn display_name(&self) -> &'static str {
        "NYC MTA Subway Alerts"
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
            "MTA Subway fetch_assets: {} lines loaded from config",
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

        // TODO: Implement actual MTA GTFS-RT service alerts API integration
        // Fetch service alerts from MTA feed, parse disruption severity per line
        for asset_id in asset_ids {
            let (_line_ref, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (line ID) for asset {}", asset_id);
                    continue;
                }
            };

            debug!("MTA Subway: would fetch alerts for {}", asset_id);

            // TODO: Fetch actual disruption severity from MTA API
            // results.push(PriceUpdate { ... });
        }

        info!(
            "Fetched {}/{} prices from MTA Subway",
            results.len(),
            asset_ids.len(),
        );
        Ok(results)
    }
}
