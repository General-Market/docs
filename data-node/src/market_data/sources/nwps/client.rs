//! NWPS (National Water Prediction Service) river gauge client implementing MarketDataSource
//!
//! Tracks real-time river gauge heights from ~68 major US river gauges via the
//! NOAA NWPS API. Each gauge is an asset; its value is the current stage height
//! in feet.
//!
//! **API**: https://api.water.noaa.gov/nwps/v1/gauges/{gaugeId}
//! - No auth needed (public API)
//! - Single-gauge per request
//! - Rate limit: undisclosed but generous; we use 20 req/min conservatively
//! - Data updates hourly (more frequently during flood events)
//!
//! Stage height can be negative in some unusual conditions (datum-relative).

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate};

// ============================================================================
// CONSTANTS
// ============================================================================

/// NWPS API base URL
const API_BASE: &str = "https://api.water.noaa.gov/nwps/v1/gauges";

/// User-Agent for NWPS API (good citizenship for government APIs)
const USER_AGENT: &str = "IndexDataNode/1.0 (contact: data@index.markets)";

/// Delay between sequential gauge requests (ms) to stay within 20 req/min
const INTER_REQUEST_DELAY_MS: u64 = 2000;

// ============================================================================
// CURATED GAUGE LIST
// ============================================================================

/// A river gauge definition
struct GaugeDef {
    id: &'static str,
    name: &'static str,
}

/// Major US river gauges verified active on the NWPS v1 API.
/// NOTE: ~45 of the original 67 gauges now return 404 on the NWPS API.
/// This list only includes the 22 verified active gauges.
const GAUGES: &[GaugeDef] = &[
    // Mississippi River system
    GaugeDef { id: "EADM7", name: "Mississippi at St. Louis, MO" },
    GaugeDef { id: "MEMT1", name: "Mississippi at Memphis, TN" },
    GaugeDef { id: "VCKM6", name: "Mississippi at Vicksburg, MS" },
    GaugeDef { id: "BTRL1", name: "Mississippi at Baton Rouge, LA" },
    GaugeDef { id: "NORL1", name: "Mississippi at New Orleans, LA" },
    GaugeDef { id: "CIRI2", name: "Mississippi at Chester, IL" },
    // Columbia River
    GaugeDef { id: "BONO3", name: "Columbia at Bonneville Dam, OR" },
    GaugeDef { id: "VAPW1", name: "Columbia at Vancouver, WA" },
    GaugeDef { id: "TDAO3", name: "Columbia at The Dalles, OR" },
    // Sacramento
    GaugeDef { id: "SACC1", name: "Sacramento at Sacramento, CA" },
    // Hudson
    GaugeDef { id: "ALBN6", name: "Hudson at Albany, NY" },
    // Potomac/James
    GaugeDef { id: "BRKM2", name: "Potomac at Little Falls, MD" },
    GaugeDef { id: "RMDV2", name: "James at Richmond, VA" },
    // Great Lakes
    GaugeDef { id: "BUFN6", name: "Niagara at Buffalo, NY" },
    // Savannah
    GaugeDef { id: "AUGG1", name: "Savannah at Augusta, GA" },
    // Rio Grande
    GaugeDef { id: "LART2", name: "Rio Grande at Laredo, TX" },
    // Willamette
    GaugeDef { id: "PRTO3", name: "Willamette at Portland, OR" },
    // Des Moines
    GaugeDef { id: "DMOI4", name: "Des Moines at Des Moines, IA" },
    // Iowa
    GaugeDef { id: "IACI4", name: "Iowa at Iowa City, IA" },
    // Atchafalaya
    GaugeDef { id: "MRGN2", name: "Atchafalaya at Morgan City, LA" },
    // Trinity
    GaugeDef { id: "DALT2", name: "Trinity at Dallas, TX" },
    // Apalachicola
    GaugeDef { id: "CHAF1", name: "Apalachicola at Chattahoochee, FL" },
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Top-level response from the NWPS gauge API
/// Note: The API changed from `gaugeId` to `lid` as the identifier field.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NwpsGaugeResponse {
    /// Gauge identifier (new API uses "lid" instead of "gaugeId")
    #[allow(dead_code)]
    lid: Option<String>,
    /// Gauge display name
    #[allow(dead_code)]
    name: Option<String>,
    /// State (now a nested object, not a string)
    #[allow(dead_code)]
    state: Option<serde_json::Value>,
    /// County name
    #[allow(dead_code)]
    county: Option<String>,
    /// Latitude
    #[allow(dead_code)]
    latitude: Option<f64>,
    /// Longitude
    #[allow(dead_code)]
    longitude: Option<f64>,
    /// Status block containing observed data
    status: Option<NwpsStatus>,
}

/// Status block within gauge response
#[derive(Debug, Deserialize)]
struct NwpsStatus {
    /// Current observed conditions
    observed: Option<NwpsObserved>,
}

/// Observed conditions from the gauge
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NwpsObserved {
    /// Primary reading — stage height in feet
    primary: Option<f64>,
    /// Primary reading unit (typically "ft")
    #[allow(dead_code)]
    primary_unit: Option<String>,
    /// Secondary reading — discharge in CFS/kcfs
    #[allow(dead_code)]
    secondary: Option<f64>,
    /// Secondary reading unit (typically "kcfs" or "cfs")
    #[allow(dead_code)]
    secondary_unit: Option<String>,
    /// Timestamp of observation (new field name: "validTime")
    #[allow(dead_code)]
    valid_time: Option<String>,
}

// Note: Flood data is now a top-level field in the API response (not under status).
// We don't need it for price computation (we only need stage height from observed).

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// NWPS River Gauges market data source.
///
/// Tracks real-time stage heights for ~68 major US river gauges.
/// Source ID is `"nwps"`.
pub struct NwpsMarketSource {
    http: SourceHttpClient,
}

impl NwpsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(60),
            }],
        };

        // Build custom reqwest client with User-Agent header
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(USER_AGENT)
            .build()?;

        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        info!(
            "NWPS River Gauges source initialized ({} gauges)",
            GAUGES.len()
        );

        Ok(Self { http })
    }

    /// Build the API URL for fetching a gauge's current data
    fn gauge_url(gauge_id: &str) -> String {
        format!("{}/{}", API_BASE, gauge_id)
    }

    /// Extract gauge ID from asset_id (strip "nwps_" prefix, uppercase it)
    fn extract_gauge_id(asset_id: &str) -> String {
        asset_id
            .strip_prefix("nwps_")
            .unwrap_or(asset_id)
            .to_uppercase()
    }
}

#[async_trait::async_trait]
impl MarketDataSource for NwpsMarketSource {
    fn source_id(&self) -> &'static str {
        "nwps"
    }

    fn display_name(&self) -> &'static str {
        "NWPS River Gauges"
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
                max_requests: 20,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets: Vec<AssetUpdate> = GAUGES
            .iter()
            .map(|gauge| AssetUpdate {
                asset_id: format!("nwps_{}", gauge.id.to_lowercase()),
                symbol: format!("RIVER/{}", gauge.id),
                name: gauge.name.to_string(),
                category: Some("environment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": gauge.id,
                    "subcategory": "river",
                    "active": true,
                    "extra": {},
                }),
            })
            .collect();

        info!(
            "NWPS fetch_assets: {} gauges loaded",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::with_capacity(asset_ids.len());
        let mut errors = 0u32;

        for (i, asset_id) in asset_ids.iter().enumerate() {
            let gauge_id = Self::extract_gauge_id(asset_id);
            let url = Self::gauge_url(&gauge_id);

            // Add delay between requests (skip before first)
            if i > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            debug!("Fetching gauge data for {}", gauge_id);

            let response: NwpsGaugeResponse = match self.http.get_json(&url).await {
                Ok(data) => data,
                Err(e) => {
                    warn!(
                        "Error fetching NWPS data for gauge {}: {:?}",
                        gauge_id, e
                    );
                    errors += 1;
                    continue;
                }
            };

            // Extract stage height from status.observed.primary
            let stage_height = match response
                .status
                .as_ref()
                .and_then(|s| s.observed.as_ref())
                .and_then(|o| o.primary)
            {
                Some(val) => match Decimal::from_str(&val.to_string()) {
                    Ok(d) => d,
                    Err(e) => {
                        warn!(
                            "Failed to parse stage height {} for gauge {}: {}",
                            val, gauge_id, e
                        );
                        errors += 1;
                        continue;
                    }
                },
                None => {
                    warn!("No observed data for gauge {}", gauge_id);
                    errors += 1;
                    continue;
                }
            };

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("RIVER/{}", gauge_id),
                value: stage_height,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} stage heights from NWPS ({} errors)",
            results.len(),
            asset_ids.len(),
            errors
        );

        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENVIRONMENTAL
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gauge_count() {
        assert_eq!(
            GAUGES.len(),
            22,
            "Expected 22 verified active river gauges, got {}",
            GAUGES.len()
        );
    }

    #[test]
    fn test_gauge_ids_unique() {
        let mut ids: Vec<&str> = GAUGES.iter().map(|g| g.id).collect();
        let original_len = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(
            ids.len(),
            original_len,
            "Gauge IDs should be unique (found duplicates)"
        );
    }

    #[test]
    fn test_fetch_assets_returns_correct_format() {
        // Verify the first gauge produces the expected AssetUpdate fields
        let gauge = &GAUGES[0];
        let asset_id = format!("nwps_{}", gauge.id.to_lowercase());
        let symbol = format!("RIVER/{}", gauge.id);

        assert_eq!(asset_id, "nwps_eadm7");
        assert_eq!(symbol, "RIVER/EADM7");
        assert_eq!(gauge.name, "Mississippi at St. Louis, MO");

        // Verify all gauges produce valid asset IDs
        for g in GAUGES {
            let aid = format!("nwps_{}", g.id.to_lowercase());
            assert!(
                aid.starts_with("nwps_"),
                "Asset ID {} should start with 'nwps_'",
                aid
            );
        }
    }

    #[test]
    fn test_asset_generation_count() {
        let assets: Vec<(&str, String)> = GAUGES
            .iter()
            .map(|g| (g.id, format!("nwps_{}", g.id.to_lowercase())))
            .collect();
        assert_eq!(
            assets.len(),
            GAUGES.len(),
            "Should generate one asset per gauge"
        );
    }

    #[test]
    fn test_extract_gauge_id() {
        assert_eq!(
            NwpsMarketSource::extract_gauge_id("nwps_eadm7"),
            "EADM7"
        );
        assert_eq!(
            NwpsMarketSource::extract_gauge_id("nwps_pitk2"),
            "PITK2"
        );
        // Without prefix, still uppercases
        assert_eq!(
            NwpsMarketSource::extract_gauge_id("eadm7"),
            "EADM7"
        );
    }

    #[test]
    fn test_gauge_url() {
        let url = NwpsMarketSource::gauge_url("EADM7");
        assert_eq!(url, "https://api.water.noaa.gov/nwps/v1/gauges/EADM7");
    }

    #[test]
    fn test_parse_gauge_response() {
        // New NWPS API format: "lid" instead of "gaugeId", "state" is an object
        let json = r#"{
            "lid": "EADM7",
            "name": "Mississippi River at St. Louis",
            "state": {"abbreviation": "MO", "name": "Missouri"},
            "county": "St. Louis City",
            "latitude": 38.6275,
            "longitude": -90.1808,
            "status": {
                "observed": {
                    "primary": 10.5,
                    "primaryUnit": "ft",
                    "secondary": 180000,
                    "secondaryUnit": "cfs",
                    "floodCategory": "no_flooding",
                    "validTime": "2024-01-15T12:00:00Z"
                },
                "forecast": null
            },
            "flood": {
                "stageUnits": "ft",
                "categories": []
            }
        }"#;

        let response: NwpsGaugeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.lid.as_deref(), Some("EADM7"));
        assert_eq!(response.name.as_deref(), Some("Mississippi River at St. Louis"));

        let status = response.status.unwrap();
        let observed = status.observed.unwrap();
        assert_eq!(observed.primary, Some(10.5));
        assert_eq!(observed.primary_unit.as_deref(), Some("ft"));
        assert_eq!(observed.secondary, Some(180000.0));

        // Verify Decimal conversion
        let val = Decimal::from_str(&observed.primary.unwrap().to_string()).unwrap();
        assert_eq!(val, Decimal::from_str("10.5").unwrap());
    }

    #[test]
    fn test_parse_gauge_response_missing_observed() {
        // Gauge exists but has no current observation
        let json = r#"{
            "lid": "TEST1",
            "name": "Test River",
            "status": {
                "observed": null,
                "forecast": null
            }
        }"#;

        let response: NwpsGaugeResponse = serde_json::from_str(json).unwrap();
        let status = response.status.unwrap();
        assert!(status.observed.is_none());
    }

    #[test]
    fn test_parse_gauge_response_missing_status() {
        // Minimal response with no status at all
        let json = r#"{
            "lid": "UNKNOWN",
            "name": "Unknown Gauge"
        }"#;

        let response: NwpsGaugeResponse = serde_json::from_str(json).unwrap();
        assert!(response.status.is_none());
    }

    #[test]
    fn test_parse_gauge_response_missing_primary() {
        // Observed block exists but primary is null
        let json = r#"{
            "lid": "EADM7",
            "name": "Mississippi River at St. Louis",
            "status": {
                "observed": {
                    "primary": null,
                    "primaryUnit": "ft",
                    "validTime": "2024-01-15T12:00:00Z"
                }
            }
        }"#;

        let response: NwpsGaugeResponse = serde_json::from_str(json).unwrap();
        let observed = response.status.unwrap().observed.unwrap();
        assert!(observed.primary.is_none());
    }

    #[test]
    fn test_parse_negative_stage_height() {
        // Stage can be negative (datum-relative)
        let json = r#"{
            "lid": "EADM7",
            "status": {
                "observed": {
                    "primary": -2.3,
                    "primaryUnit": "ft"
                }
            }
        }"#;

        let response: NwpsGaugeResponse = serde_json::from_str(json).unwrap();
        let val = response.status.unwrap().observed.unwrap().primary.unwrap();
        let decimal = Decimal::from_str(&val.to_string()).unwrap();
        assert!(decimal < Decimal::ZERO);
        assert_eq!(decimal, Decimal::from_str("-2.3").unwrap());
    }

    #[test]
    fn test_parse_large_stage_height() {
        // Major flood conditions can produce very high readings
        let json = r#"{
            "lid": "EADM7",
            "status": {
                "observed": {
                    "primary": 49.58,
                    "primaryUnit": "ft"
                }
            }
        }"#;

        let response: NwpsGaugeResponse = serde_json::from_str(json).unwrap();
        let val = response.status.unwrap().observed.unwrap().primary.unwrap();
        let decimal = Decimal::from_str(&val.to_string()).unwrap();
        assert!(decimal > Decimal::from(40));
    }

    #[test]
    fn test_known_gauges_present() {
        let ids: Vec<&str> = GAUGES.iter().map(|g| g.id).collect();
        // Verify some well-known gauges (only those verified active on NWPS v1)
        assert!(ids.contains(&"EADM7"), "Mississippi at St. Louis should be present");
        assert!(ids.contains(&"BONO3"), "Columbia at Bonneville Dam should be present");
        assert!(ids.contains(&"SACC1"), "Sacramento at Sacramento should be present");
        assert!(ids.contains(&"ALBN6"), "Hudson at Albany should be present");
        assert!(ids.contains(&"BRKM2"), "Potomac at Little Falls should be present");
    }

    #[test]
    fn test_error_response_404() {
        // Simulate what happens when the API returns a non-JSON 404
        // The http client would return a SourceError, not a parse issue.
        // Here we just verify our deserialization handles empty/minimal JSON.
        let json = r#"{}"#;
        let response: NwpsGaugeResponse = serde_json::from_str(json).unwrap();
        assert!(response.lid.is_none());
        assert!(response.status.is_none());
    }
}
