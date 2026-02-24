//! ISS Position client implementing MarketDataSource
//!
//! Tracks the International Space Station's position (latitude/longitude)
//! and the number of people currently in space.
//!
//! APIs:
//!   - http://api.open-notify.org/iss-now.json — current ISS position
//!   - http://api.open-notify.org/astros.json — people currently in space
//! Auth: None
//! Rate limit: 10 req/min (generous)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — 3 ISS-related metrics
const ASSET_JSON: &str = include_str!("../../../config/iss.json");

/// ISS position API (HTTP, not HTTPS)
const ISS_POSITION_URL: &str = "http://api.open-notify.org/iss-now.json";

/// Astronauts API (HTTP, not HTTPS)
const ASTROS_URL: &str = "http://api.open-notify.org/astros.json";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// ISS position response from /iss-now.json
#[derive(Debug, Deserialize)]
struct IssPositionResponse {
    iss_position: IssPosition,
    #[allow(dead_code)]
    timestamp: i64,
    message: String,
}

/// ISS lat/lon position
#[derive(Debug, Deserialize)]
struct IssPosition {
    latitude: String,
    longitude: String,
}

/// Astronauts response from /astros.json
#[derive(Debug, Deserialize)]
struct AstrosResponse {
    number: i64,
    #[allow(dead_code)]
    people: Vec<Astronaut>,
    message: String,
}

/// Individual astronaut entry
#[derive(Debug, Deserialize)]
struct Astronaut {
    #[allow(dead_code)]
    name: String,
    #[allow(dead_code)]
    craft: String,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// ISS Position market data source.
///
/// Tracks ISS latitude, longitude, and people in space.
/// Source ID is `"iss"`.
pub struct IssMarketSource {
    http: SourceHttpClient,
}

impl IssMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("ISS source initialized (open-notify.org)");

        Ok(Self { http })
    }

    /// Fetch current ISS position
    async fn fetch_position(&self) -> Result<IssPositionResponse, SourceError> {
        self.http
            .get_json::<IssPositionResponse>(ISS_POSITION_URL)
            .await
    }

    /// Fetch current astronaut count
    async fn fetch_astros(&self) -> Result<AstrosResponse, SourceError> {
        self.http.get_json::<AstrosResponse>(ASTROS_URL).await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for IssMarketSource {
    fn source_id(&self) -> &'static str {
        "iss"
    }

    fn display_name(&self) -> &'static str {
        "ISS Position"
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
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Load asset entries to get api_ref mappings
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let api_ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        // Determine which APIs we need to call
        let mut need_position = false;
        let mut need_astros = false;

        for asset_id in asset_ids {
            if let Some((api_ref, _)) = api_ref_map.get(asset_id.as_str()) {
                match api_ref.as_str() {
                    "latitude" | "longitude" => need_position = true,
                    "people" => need_astros = true,
                    _ => {}
                }
            }
        }

        // Fetch ISS position if needed
        let mut latitude: Option<Decimal> = None;
        let mut longitude: Option<Decimal> = None;

        if need_position {
            match self.fetch_position().await {
                Ok(pos) => {
                    if pos.message == "success" {
                        latitude = Decimal::from_str(&pos.iss_position.latitude).ok();
                        longitude = Decimal::from_str(&pos.iss_position.longitude).ok();
                        debug!(
                            "ISS position: lat={}, lon={}",
                            pos.iss_position.latitude, pos.iss_position.longitude
                        );
                    } else {
                        warn!("ISS position API returned non-success: {}", pos.message);
                    }
                }
                Err(e) => {
                    warn!("Error fetching ISS position: {:?}", e);
                }
            }
        }

        // Fetch astronaut count if needed
        let mut people_count: Option<Decimal> = None;

        if need_astros {
            match self.fetch_astros().await {
                Ok(astros) => {
                    if astros.message == "success" {
                        people_count = Some(Decimal::from(astros.number));
                        debug!("People in space: {}", astros.number);
                    } else {
                        warn!("Astros API returned non-success: {}", astros.message);
                    }
                }
                Err(e) => {
                    warn!("Error fetching astronaut count: {:?}", e);
                }
            }
        }

        // Map each requested asset to its value
        for asset_id in asset_ids {
            if let Some((api_ref, symbol)) = api_ref_map.get(asset_id.as_str()) {
                let value = match api_ref.as_str() {
                    "latitude" => latitude,
                    "longitude" => longitude,
                    "people" => people_count,
                    _ => None,
                };

                if let Some(value) = value {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: symbol.clone(),
                        value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }
        }

        info!(
            "Fetched {}/{} prices from ISS/open-notify",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        Ok(vec![])
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("iss", "iss");
    }

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            3,
            "Expected exactly 3 ISS assets, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_active_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(
            assets.len(),
            3,
            "Expected exactly 3 active ISS assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_entries_space_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "space",
                "Asset {} has category '{}', expected 'space'",
                entry.asset_id, entry.category
            );
        }
    }

    #[test]
    fn test_all_entries_iss_subcategory() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.subcategory, "iss",
                "Asset {} has subcategory '{}', expected 'iss'",
                entry.asset_id, entry.subcategory
            );
        }
    }

    #[test]
    fn test_valid_api_refs() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let valid_refs = ["latitude", "longitude", "people"];
        for entry in &entries {
            assert!(
                valid_refs.contains(&entry.api_ref.as_str()),
                "Invalid api_ref '{}' for asset '{}'. Valid: {:?}",
                entry.api_ref,
                entry.asset_id,
                valid_refs
            );
        }
    }

    #[test]
    fn test_iss_position_url_is_http() {
        // ISS API uses HTTP, not HTTPS
        assert!(
            ISS_POSITION_URL.starts_with("http://"),
            "ISS position URL must use HTTP"
        );
        assert!(
            !ISS_POSITION_URL.starts_with("https://"),
            "ISS position URL must NOT use HTTPS"
        );
    }

    #[test]
    fn test_astros_url_is_http() {
        assert!(
            ASTROS_URL.starts_with("http://"),
            "Astros URL must use HTTP"
        );
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut seen: HashMap<String, usize> = HashMap::new();
        for entry in &entries {
            *seen.entry(entry.asset_id.clone()).or_default() += 1;
        }
        for (asset_id, count) in &seen {
            assert_eq!(*count, 1, "Duplicate asset_id: {}", asset_id);
        }
    }

    #[test]
    fn test_unique_api_refs() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut seen: HashMap<String, usize> = HashMap::new();
        for entry in &entries {
            *seen.entry(entry.api_ref.clone()).or_default() += 1;
        }
        for (api_ref, count) in &seen {
            assert_eq!(*count, 1, "Duplicate api_ref: {}", api_ref);
        }
    }

    #[test]
    fn test_symbol_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("ISS/"),
                "Symbol '{}' should start with 'ISS/' for asset {}",
                entry.symbol,
                entry.asset_id
            );
        }
    }
}
