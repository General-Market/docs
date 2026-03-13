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
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/tfl_tube.json");

/// TfL Unified API endpoint — returns status for all tube lines in one call
const API_URL: &str = "https://api.tfl.gov.uk/Line/Mode/tube/Status";

// ============================================================================
// TfL API response types
// ============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TflLineStatus {
    id: String,
    line_statuses: Vec<TflLineStatusDetail>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TflLineStatusDetail {
    status_severity: i32,
}

pub struct TflTubeMarketSource {
    http: SourceHttpClient,
    app_key: Option<String>,
}

impl TflTubeMarketSource {
    pub fn from_env() -> Result<Self> {
        let app_key = std::env::var("TFL_APP_KEY").ok();
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: if app_key.is_some() { 500 } else { 50 },
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!(
            "TfL Tube status source initialized (app_key={})",
            if app_key.is_some() {
                "present"
            } else {
                "none"
            }
        );
        Ok(Self { http, app_key })
    }

    /// Convert TfL statusSeverity (0-10) to a disruption score.
    /// Higher score = more disrupted.
    fn severity_to_disruption(severity: i32) -> i64 {
        match severity {
            10 => 0, // Good Service
            9 => 1,  // Minor Delays
            8 => 2,  // Reduced Service
            7 => 3,  // Planned Closure
            6 => 4,  // Severe Delays
            5 => 5,  // Part Closure
            4 => 6,  // Part Suspended
            3 => 7,  // Suspended
            2 => 5,  // Part Closure
            1 => 8,  // Service Closed
            0 => 1,  // Special Service
            other => (10 - other).max(0) as i64,
        }
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

        // Load config to build api_ref → (asset_id, symbol) lookup
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        // Build reverse map: line_id (api_ref) → (asset_id, symbol) for fast lookup
        let mut line_to_asset: HashMap<String, (String, String)> = HashMap::new();
        for asset_id in asset_ids {
            if let Some((line_id, symbol)) = ref_map.get(asset_id) {
                line_to_asset.insert(
                    line_id.clone(),
                    (asset_id.clone(), symbol.clone()),
                );
            } else {
                warn!("No api_ref (line ID) for asset {}", asset_id);
            }
        }

        // ONE call to get all tube line statuses
        let url = match &self.app_key {
            Some(key) => format!("{}?app_key={}", API_URL, key),
            None => API_URL.to_string(),
        };

        let lines: Vec<TflLineStatus> = match self.http.get_json(&url).await {
            Ok(data) => data,
            Err(e) => {
                warn!("TfL Tube: failed to fetch line statuses: {:?}", e);
                return Ok(Vec::new());
            }
        };

        debug!("TfL Tube: received status for {} lines", lines.len());

        // Map each API line to its asset and convert severity to disruption score
        let mut results = Vec::with_capacity(asset_ids.len());

        for line in &lines {
            let (asset_id, symbol) = match line_to_asset.get(&line.id) {
                Some(pair) => pair,
                None => continue, // Line not in our tracked assets
            };

            // Use worst (lowest) severity across all statuses for the line
            let worst_severity = line
                .line_statuses
                .iter()
                .map(|s| s.status_severity)
                .min()
                .unwrap_or(10); // Default to Good Service if no statuses

            let disruption = Self::severity_to_disruption(worst_severity);

            debug!(
                "TfL {}: severity={} → disruption={}",
                line.id, worst_severity, disruption
            );

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: symbol.clone(),
                value: Decimal::from(disruption),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from TfL Tube (1 API call, {} lines from API)",
            results.len(),
            asset_ids.len(),
            lines.len(),
        );
        Ok(results)
    }
}
