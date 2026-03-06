//! CAIDA IODA Internet Outage Detection source implementing MarketDataSource
//!
//! Monitors internet outages by country using the IODA API.
//! Each country is an asset; its value represents an outage severity score.
//!
//! Assets are static -- defined in config/ioda.json.
//!
//! API: https://api.ioda.inetintel.cc.gatech.edu/v2/
//! Auth: None
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

const ASSET_JSON: &str = include_str!("../../../config/ioda.json");

pub struct IodaMarketSource {
    http: SourceHttpClient,
}

impl IodaMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("IODA internet outage detection source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for IodaMarketSource {
    fn source_id(&self) -> &'static str {
        "ioda"
    }

    fn display_name(&self) -> &'static str {
        "Internet Outage Detection (IODA)"
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
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("IODA fetch_assets: {} countries loaded from config", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get country codes from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        // TODO: Implement actual IODA API integration
        // API endpoint: https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/{entityType}/{entityCode}
        // For now, return empty results
        for asset_id in asset_ids {
            let (_country_code, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (country code) for asset {}", asset_id);
                    continue;
                }
            };

            debug!("IODA: would fetch outage data for {}", asset_id);

            // TODO: Fetch actual outage severity from IODA API
            // results.push(PriceUpdate { ... });
        }

        info!(
            "Fetched {}/{} prices from IODA",
            results.len(),
            asset_ids.len(),
        );
        Ok(results)
    }
}
