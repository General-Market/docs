//! AirNow Air Quality Index (AQI) client implementing MarketDataSource
//!
//! Tracks real-time air quality data from the EPA AirNow API.
//! Each reporting area (city/metro) is an asset; its value is the maximum
//! AQI across all measured pollutants (PM2.5, OZONE, PM10, etc.).
//!
//! **API**: https://www.airnowapi.org/aq/observation/current/1/
//! - Requires free API key: env var `AIRNOW_API_KEY`
//! - 500 requests per hour per endpoint
//! - Data updates hourly (~10-30 min past the hour)
//!
//! We use 3 bounding box requests (Continental US, Alaska, Hawaii) to fetch
//! all monitoring stations in bulk. Each sync cycle is only 3 API calls.
//!
//! AQI scale:
//! - 0-50: Good
//! - 51-100: Moderate
//! - 101-150: Unhealthy for Sensitive Groups
//! - 151-200: Unhealthy
//! - 201-300: Very Unhealthy
//! - 301-500: Hazardous

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

// ============================================================================
// CONSTANTS
// ============================================================================

/// AirNow API base URL for current observations
const API_BASE: &str = "https://www.airnowapi.org/aq/observation/current/1/";

/// User-Agent for AirNow API
const USER_AGENT: &str = "IndexDataNode/1.0 (contact: data@index.markets)";

/// Delay between bounding box requests (ms)
const INTER_REQUEST_DELAY_MS: u64 = 2000;

/// Maximum number of reporting areas to track
const MAX_AREAS: usize = 300;

/// Distance parameter for bbox queries (miles)
const DISTANCE_MILES: u32 = 100;

// ============================================================================
// BOUNDING BOXES
// ============================================================================

/// A geographic bounding box for bulk AQI fetching
struct BBox {
    name: &'static str,
    min_lon: f64,
    min_lat: f64,
    max_lon: f64,
    max_lat: f64,
}

/// The 3 bounding boxes covering all US monitoring stations
const BBOXES: &[BBox] = &[
    BBox {
        name: "Continental US",
        min_lon: -125.0,
        min_lat: 24.5,
        max_lon: -66.9,
        max_lat: 49.5,
    },
    BBox {
        name: "Alaska",
        min_lon: -180.0,
        min_lat: 51.0,
        max_lon: -129.0,
        max_lat: 72.0,
    },
    BBox {
        name: "Hawaii",
        min_lon: -161.0,
        min_lat: 18.0,
        max_lon: -154.0,
        max_lat: 23.0,
    },
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// A single observation from the AirNow API
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub(crate) struct AirnowObservation {
    /// Date of observation (e.g., "2024-01-15")
    #[serde(rename = "DateObserved")]
    pub date_observed: String,
    /// Hour of observation (0-23)
    #[serde(rename = "HourObserved")]
    pub hour_observed: i32,
    /// Local timezone abbreviation (e.g., "EST")
    #[serde(rename = "LocalTimeZone")]
    pub local_time_zone: String,
    /// Reporting area name (e.g., "Washington")
    #[serde(rename = "ReportingArea")]
    pub reporting_area: String,
    /// State code (e.g., "DC")
    #[serde(rename = "StateCode")]
    pub state_code: String,
    /// Latitude
    #[serde(rename = "Latitude")]
    pub latitude: f64,
    /// Longitude
    #[serde(rename = "Longitude")]
    pub longitude: f64,
    /// Pollutant name (e.g., "PM2.5", "OZONE")
    #[serde(rename = "ParameterName")]
    pub parameter_name: String,
    /// AQI value (0-500)
    #[serde(rename = "AQI")]
    pub aqi: i32,
    /// AQI category
    #[serde(rename = "Category")]
    pub category: AirnowCategory,
}

/// AQI category from AirNow API
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub(crate) struct AirnowCategory {
    /// Category number (1-6)
    #[serde(rename = "Number")]
    pub number: i32,
    /// Category name (e.g., "Good", "Moderate")
    #[serde(rename = "Name")]
    pub name: String,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Normalize a reporting area and state code into an asset_id.
/// E.g., ("Washington", "DC") -> "airnow_dc_washington"
fn normalize_area(reporting_area: &str, state_code: &str) -> String {
    let area = reporting_area
        .to_lowercase()
        .replace(' ', "_")
        .replace('-', "_")
        .replace('.', "")
        .replace('/', "_")
        .replace('\'', "");
    format!("airnow_{}_{}", state_code.to_lowercase(), area)
}

/// Get the AQI category name for a given AQI value
fn aqi_category_name(aqi: i32) -> &'static str {
    match aqi {
        0..=50 => "Good",
        51..=100 => "Moderate",
        101..=150 => "Unhealthy for Sensitive Groups",
        151..=200 => "Unhealthy",
        201..=300 => "Very Unhealthy",
        301..=500 => "Hazardous",
        _ => "Unknown",
    }
}

/// Group observations by reporting area key and compute max AQI per area.
/// Returns a map of (area_key) -> (max_aqi, reporting_area, state_code).
fn group_observations(
    observations: &[AirnowObservation],
) -> HashMap<String, (i32, String, String)> {
    let mut area_map: HashMap<String, (i32, String, String)> = HashMap::new();

    for obs in observations {
        let key = normalize_area(&obs.reporting_area, &obs.state_code);
        let entry = area_map
            .entry(key)
            .or_insert((0, obs.reporting_area.clone(), obs.state_code.clone()));
        // Take the maximum AQI across all pollutants for this area
        if obs.aqi > entry.0 {
            entry.0 = obs.aqi;
        }
    }

    area_map
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// AirNow Air Quality market data source.
///
/// Tracks real-time AQI for US reporting areas (cities/metros).
/// Source ID is `"airnow"`.
pub struct AirnowMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl AirnowMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("AIRNOW_API_KEY")
            .context("AIRNOW_API_KEY environment variable is required for AirNow source")?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(60),
            }],
        };

        // Build custom reqwest client with User-Agent header
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(USER_AGENT)
            .build()?;

        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        info!("AirNow Air Quality source initialized");

        Ok(Self { http, api_key })
    }

    /// Build the API URL for fetching current observations in a bounding box
    fn bbox_url(&self, bbox: &BBox) -> String {
        format!(
            "{}?format=application/json&distance={}&bbox={},{},{},{}&API_KEY={}",
            API_BASE,
            DISTANCE_MILES,
            bbox.min_lon,
            bbox.min_lat,
            bbox.max_lon,
            bbox.max_lat,
            self.api_key,
        )
    }

    /// Fetch all observations from all 3 bounding boxes
    async fn fetch_all_observations(&self) -> Result<Vec<AirnowObservation>> {
        let mut all_observations = Vec::new();

        for (i, bbox) in BBOXES.iter().enumerate() {
            // Add delay between requests (skip before first)
            if i > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let url = self.bbox_url(bbox);
            debug!("Fetching AirNow observations for {}", bbox.name);

            let observations: Vec<AirnowObservation> = match self.http.get_json(&url).await {
                Ok(data) => data,
                Err(e) => {
                    warn!(
                        "Error fetching AirNow data for {}: {:?}",
                        bbox.name, e
                    );
                    continue;
                }
            };

            debug!(
                "AirNow {}: {} observations",
                bbox.name,
                observations.len()
            );
            all_observations.extend(observations);
        }

        Ok(all_observations)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for AirnowMarketSource {
    fn source_id(&self) -> &'static str {
        "airnow"
    }

    fn display_name(&self) -> &'static str {
        "AirNow Air Quality"
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
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let observations = self.fetch_all_observations().await?;
        let area_map = group_observations(&observations);

        // Sort by area key for deterministic output
        let mut areas: Vec<_> = area_map.into_iter().collect();
        areas.sort_by(|a, b| a.0.cmp(&b.0));

        // Cap at MAX_AREAS
        areas.truncate(MAX_AREAS);

        let assets: Vec<AssetUpdate> = areas
            .iter()
            .map(|(key, (_aqi, reporting_area, state_code))| {
                let symbol = format!(
                    "AQI/{}/{}",
                    state_code.to_uppercase(),
                    reporting_area.to_uppercase().replace(' ', "_")
                );
                let name = format!("{}, {} AQI", reporting_area, state_code);

                AssetUpdate {
                    asset_id: key.clone(),
                    symbol,
                    name,
                    category: Some("environment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": key,
                        "subcategory": "air_quality",
                        "active": true,
                        "extra": {
                            "state_code": state_code,
                            "reporting_area": reporting_area,
                        },
                    }),
                }
            })
            .collect();

        info!(
            "AirNow fetch_assets: {} reporting areas loaded",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let observations = self.fetch_all_observations().await?;
        let area_map = group_observations(&observations);

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            if let Some((max_aqi, reporting_area, state_code)) = area_map.get(asset_id) {
                let symbol = format!(
                    "AQI/{}/{}",
                    state_code.to_uppercase(),
                    reporting_area.to_uppercase().replace(' ', "_")
                );

                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol,
                    value: Decimal::from(*max_aqi),
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            } else {
                debug!("AirNow: no observation found for asset {}", asset_id);
            }
        }

        info!(
            "Fetched {}/{} AQI values from AirNow ({} total observations)",
            results.len(),
            asset_ids.len(),
            observations.len()
        );

        Ok(results)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to create a test observation
    fn make_observation(
        reporting_area: &str,
        state_code: &str,
        parameter: &str,
        aqi: i32,
    ) -> AirnowObservation {
        AirnowObservation {
            date_observed: "2024-01-15 ".to_string(),
            hour_observed: 12,
            local_time_zone: "EST".to_string(),
            reporting_area: reporting_area.to_string(),
            state_code: state_code.to_string(),
            latitude: 38.9,
            longitude: -77.0,
            parameter_name: parameter.to_string(),
            aqi,
            category: AirnowCategory {
                number: 1,
                name: "Good".to_string(),
            },
        }
    }

    #[test]
    fn test_parse_observation_response() {
        let json = r#"[
            {
                "DateObserved": "2024-01-15 ",
                "HourObserved": 12,
                "LocalTimeZone": "EST",
                "ReportingArea": "Washington",
                "StateCode": "DC",
                "Latitude": 38.9,
                "Longitude": -77.0,
                "ParameterName": "PM2.5",
                "AQI": 55,
                "Category": {
                    "Number": 2,
                    "Name": "Moderate"
                }
            },
            {
                "DateObserved": "2024-01-15 ",
                "HourObserved": 12,
                "LocalTimeZone": "EST",
                "ReportingArea": "Washington",
                "StateCode": "DC",
                "Latitude": 38.9,
                "Longitude": -77.0,
                "ParameterName": "OZONE",
                "AQI": 42,
                "Category": {
                    "Number": 1,
                    "Name": "Good"
                }
            }
        ]"#;

        let observations: Vec<AirnowObservation> = serde_json::from_str(json).unwrap();
        assert_eq!(observations.len(), 2);
        assert_eq!(observations[0].reporting_area, "Washington");
        assert_eq!(observations[0].state_code, "DC");
        assert_eq!(observations[0].parameter_name, "PM2.5");
        assert_eq!(observations[0].aqi, 55);
        assert_eq!(observations[0].category.number, 2);
        assert_eq!(observations[0].category.name, "Moderate");
        assert_eq!(observations[1].parameter_name, "OZONE");
        assert_eq!(observations[1].aqi, 42);
    }

    #[test]
    fn test_deduplication_by_reporting_area() {
        let observations = vec![
            make_observation("Washington", "DC", "PM2.5", 55),
            make_observation("Washington", "DC", "OZONE", 42),
            make_observation("Los Angeles", "CA", "PM2.5", 80),
            make_observation("Los Angeles", "CA", "PM10", 60),
            make_observation("Los Angeles", "CA", "OZONE", 70),
        ];

        let area_map = group_observations(&observations);

        // Should have 2 unique areas
        assert_eq!(area_map.len(), 2);
        assert!(area_map.contains_key("airnow_dc_washington"));
        assert!(area_map.contains_key("airnow_ca_los_angeles"));
    }

    #[test]
    fn test_max_aqi_across_pollutants() {
        let observations = vec![
            make_observation("Washington", "DC", "PM2.5", 55),
            make_observation("Washington", "DC", "OZONE", 42),
            make_observation("Washington", "DC", "PM10", 30),
        ];

        let area_map = group_observations(&observations);
        let (max_aqi, _, _) = area_map.get("airnow_dc_washington").unwrap();

        // Max of 55, 42, 30 should be 55
        assert_eq!(*max_aqi, 55);
    }

    #[test]
    fn test_max_aqi_single_high_pollutant() {
        let observations = vec![
            make_observation("Seattle", "WA", "PM2.5", 10),
            make_observation("Seattle", "WA", "OZONE", 150),
            make_observation("Seattle", "WA", "PM10", 25),
        ];

        let area_map = group_observations(&observations);
        let (max_aqi, _, _) = area_map.get("airnow_wa_seattle").unwrap();

        assert_eq!(*max_aqi, 150);
    }

    #[test]
    fn test_normalize_area_basic() {
        assert_eq!(normalize_area("Washington", "DC"), "airnow_dc_washington");
        assert_eq!(normalize_area("Los Angeles", "CA"), "airnow_ca_los_angeles");
        assert_eq!(normalize_area("New York", "NY"), "airnow_ny_new_york");
    }

    #[test]
    fn test_normalize_area_hyphens() {
        assert_eq!(
            normalize_area("Winston-Salem", "NC"),
            "airnow_nc_winston_salem"
        );
    }

    #[test]
    fn test_normalize_area_dots() {
        assert_eq!(normalize_area("St. Louis", "MO"), "airnow_mo_st_louis");
        assert_eq!(normalize_area("Ft. Worth", "TX"), "airnow_tx_ft_worth");
    }

    #[test]
    fn test_normalize_area_apostrophes() {
        assert_eq!(
            normalize_area("O'Fallon", "MO"),
            "airnow_mo_ofallon"
        );
    }

    #[test]
    fn test_normalize_area_slashes() {
        assert_eq!(
            normalize_area("Dallas/Fort Worth", "TX"),
            "airnow_tx_dallas_fort_worth"
        );
    }

    #[test]
    fn test_normalize_area_mixed() {
        assert_eq!(
            normalize_area("St. Mary's-by-the-Sea", "MD"),
            "airnow_md_st_marys_by_the_sea"
        );
    }

    #[test]
    fn test_handle_empty_response() {
        let observations: Vec<AirnowObservation> = vec![];
        let area_map = group_observations(&observations);

        assert!(area_map.is_empty());
    }

    #[test]
    fn test_handle_single_pollutant() {
        let observations = vec![make_observation("Portland", "OR", "PM2.5", 35)];

        let area_map = group_observations(&observations);
        assert_eq!(area_map.len(), 1);

        let (max_aqi, reporting_area, state_code) =
            area_map.get("airnow_or_portland").unwrap();
        assert_eq!(*max_aqi, 35);
        assert_eq!(reporting_area, "Portland");
        assert_eq!(state_code, "OR");
    }

    #[test]
    fn test_asset_count_cap() {
        // Create more than MAX_AREAS unique areas
        let mut observations = Vec::new();
        for i in 0..350 {
            observations.push(AirnowObservation {
                date_observed: "2024-01-15 ".to_string(),
                hour_observed: 12,
                local_time_zone: "EST".to_string(),
                reporting_area: format!("Area{}", i),
                state_code: "XX".to_string(),
                latitude: 38.9,
                longitude: -77.0,
                parameter_name: "PM2.5".to_string(),
                aqi: 50,
                category: AirnowCategory {
                    number: 2,
                    name: "Moderate".to_string(),
                },
            });
        }

        let area_map = group_observations(&observations);
        assert_eq!(area_map.len(), 350);

        // Simulate the truncation logic from fetch_assets
        let mut areas: Vec<_> = area_map.into_iter().collect();
        areas.sort_by(|a, b| a.0.cmp(&b.0));
        areas.truncate(MAX_AREAS);

        assert_eq!(areas.len(), MAX_AREAS);
    }

    #[test]
    fn test_aqi_category_name() {
        assert_eq!(aqi_category_name(0), "Good");
        assert_eq!(aqi_category_name(25), "Good");
        assert_eq!(aqi_category_name(50), "Good");
        assert_eq!(aqi_category_name(51), "Moderate");
        assert_eq!(aqi_category_name(100), "Moderate");
        assert_eq!(aqi_category_name(101), "Unhealthy for Sensitive Groups");
        assert_eq!(aqi_category_name(150), "Unhealthy for Sensitive Groups");
        assert_eq!(aqi_category_name(151), "Unhealthy");
        assert_eq!(aqi_category_name(200), "Unhealthy");
        assert_eq!(aqi_category_name(201), "Very Unhealthy");
        assert_eq!(aqi_category_name(300), "Very Unhealthy");
        assert_eq!(aqi_category_name(301), "Hazardous");
        assert_eq!(aqi_category_name(500), "Hazardous");
        assert_eq!(aqi_category_name(501), "Unknown");
    }

    #[test]
    fn test_symbol_format() {
        let reporting_area = "Washington";
        let state_code = "DC";
        let symbol = format!(
            "AQI/{}/{}",
            state_code.to_uppercase(),
            reporting_area.to_uppercase().replace(' ', "_")
        );
        assert_eq!(symbol, "AQI/DC/WASHINGTON");
    }

    #[test]
    fn test_symbol_format_multi_word() {
        let reporting_area = "Los Angeles";
        let state_code = "CA";
        let symbol = format!(
            "AQI/{}/{}",
            state_code.to_uppercase(),
            reporting_area.to_uppercase().replace(' ', "_")
        );
        assert_eq!(symbol, "AQI/CA/LOS_ANGELES");
    }

    #[test]
    fn test_name_format() {
        let name = format!("{}, {} AQI", "Washington", "DC");
        assert_eq!(name, "Washington, DC AQI");
    }

    #[test]
    fn test_multiple_areas_different_states() {
        let observations = vec![
            make_observation("Portland", "OR", "PM2.5", 35),
            make_observation("Portland", "ME", "PM2.5", 20),
        ];

        let area_map = group_observations(&observations);

        // Same city name but different states should be separate entries
        assert_eq!(area_map.len(), 2);
        assert!(area_map.contains_key("airnow_or_portland"));
        assert!(area_map.contains_key("airnow_me_portland"));
    }

    #[test]
    fn test_max_aqi_value_boundary() {
        let observations = vec![
            make_observation("Disaster Zone", "CA", "PM2.5", 500),
            make_observation("Disaster Zone", "CA", "OZONE", 300),
        ];

        let area_map = group_observations(&observations);
        let (max_aqi, _, _) = area_map.get("airnow_ca_disaster_zone").unwrap();
        assert_eq!(*max_aqi, 500);
    }

    #[test]
    fn test_zero_aqi() {
        let observations = vec![make_observation("Clean Air", "MT", "PM2.5", 0)];

        let area_map = group_observations(&observations);
        let (max_aqi, _, _) = area_map.get("airnow_mt_clean_air").unwrap();
        assert_eq!(*max_aqi, 0);
    }

    #[test]
    fn test_bbox_count() {
        assert_eq!(BBOXES.len(), 3, "Should have 3 bounding boxes (CONUS, Alaska, Hawaii)");
    }
}
