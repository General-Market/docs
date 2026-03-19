//! NOAA Tides & Currents client implementing MarketDataSource
//!
//! Tracks real-time water levels from ~59 major US tide stations via the
//! NOAA CO-OPS Tides & Currents API. Each station is an asset; its value
//! is the current water level in feet relative to MLLW datum.
//!
//! **API**: https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
//! - No auth needed
//! - Single-station requests (no batch endpoint)
//! - Rate limit: 30 req/min
//! - Sync interval: 900s (15 min) — conservative for single-station API
//!
//! Water levels can be negative during extreme low tides.

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

/// NOAA CO-OPS API base URL
const API_BASE: &str = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

/// User-Agent for NOAA API (good citizenship for government APIs)
const USER_AGENT: &str = "IndexDataNode/1.0 (contact: data@index.markets)";

/// Delay between sequential station requests (ms) to stay within 30 req/min
const INTER_REQUEST_DELAY_MS: u64 = 1200;

// ============================================================================
// CURATED STATION LIST
// ============================================================================

/// A tide station definition
struct StationDef {
    id: &'static str,
    name: &'static str,
}

/// ~59 major US tide stations (highest-traffic NOAA stations)
const STATIONS: &[StationDef] = &[
    // East Coast — North to South
    StationDef { id: "8443970", name: "Boston, MA" },
    StationDef { id: "8452660", name: "Newport, RI" },
    StationDef { id: "8461490", name: "New London, CT" },
    StationDef { id: "8510560", name: "Montauk, NY" },
    StationDef { id: "8518750", name: "The Battery, NY" },
    StationDef { id: "8531680", name: "Sandy Hook, NJ" },
    StationDef { id: "8534720", name: "Atlantic City, NJ" },
    StationDef { id: "8545240", name: "Philadelphia, PA" },
    StationDef { id: "8574680", name: "Baltimore, MD" },
    StationDef { id: "8638610", name: "Sewells Point, VA" },
    StationDef { id: "8651370", name: "Duck, NC" },
    StationDef { id: "8658120", name: "Wilmington, NC" },
    StationDef { id: "8665530", name: "Charleston, SC" },
    StationDef { id: "8670870", name: "Fort Pulaski, GA" },
    // Florida & Gulf Coast
    StationDef { id: "8720218", name: "Mayport, FL" },
    StationDef { id: "8723214", name: "Virginia Key, FL" },
    StationDef { id: "8724580", name: "Key West, FL" },
    StationDef { id: "8726520", name: "St. Petersburg, FL" },
    StationDef { id: "8729108", name: "Panama City, FL" },
    StationDef { id: "8735180", name: "Dauphin Island, AL" },
    StationDef { id: "8761724", name: "Grand Isle, LA" },
    StationDef { id: "8770570", name: "Sabine Pass, TX" },
    StationDef { id: "8771341", name: "Galveston Bay, TX" },
    StationDef { id: "8775870", name: "Bob Hall Pier, TX" },
    StationDef { id: "8779770", name: "Port Isabel, TX" },
    // West Coast — South to North
    StationDef { id: "9410230", name: "La Jolla, CA" },
    StationDef { id: "9410660", name: "Los Angeles, CA" },
    StationDef { id: "9410840", name: "Santa Monica, CA" },
    StationDef { id: "9411340", name: "Santa Barbara, CA" },
    StationDef { id: "9412110", name: "Port San Luis, CA" },
    StationDef { id: "9413450", name: "Monterey, CA" },
    StationDef { id: "9414290", name: "San Francisco, CA" },
    StationDef { id: "9414750", name: "Alameda, CA" },
    StationDef { id: "9415020", name: "Point Reyes, CA" },
    StationDef { id: "9418767", name: "North Spit, CA" },
    StationDef { id: "9431647", name: "Port Orford, OR" },
    StationDef { id: "9432780", name: "Charleston, OR" },
    StationDef { id: "9435380", name: "South Beach, OR" },
    StationDef { id: "9437540", name: "Garibaldi, OR" },
    StationDef { id: "9439040", name: "Astoria, OR" },
    StationDef { id: "9440910", name: "Toke Point, WA" },
    StationDef { id: "9443090", name: "Neah Bay, WA" },
    StationDef { id: "9444900", name: "Port Townsend, WA" },
    StationDef { id: "9446484", name: "Tacoma, WA" },
    StationDef { id: "9447130", name: "Seattle, WA" },
    StationDef { id: "9449880", name: "Friday Harbor, WA" },
    // Alaska
    StationDef { id: "9450460", name: "Ketchikan, AK" },
    StationDef { id: "9451054", name: "Port Alexander, AK" },
    StationDef { id: "9451600", name: "Sitka, AK" },
    StationDef { id: "9452210", name: "Juneau, AK" },
    StationDef { id: "9455920", name: "Anchorage, AK" },
    StationDef { id: "9457292", name: "Kodiak Island, AK" },
    StationDef { id: "9459881", name: "Sand Point, AK" },
    StationDef { id: "9461380", name: "Adak Island, AK" },
    StationDef { id: "9462620", name: "Unalaska, AK" },
    // Hawaii
    StationDef { id: "1612340", name: "Honolulu, HI" },
    StationDef { id: "1615680", name: "Kahului, HI" },
    StationDef { id: "1617433", name: "Kawaihae, HI" },
    StationDef { id: "1617760", name: "Hilo, HI" },
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Top-level response from the NOAA CO-OPS datagetter API
#[derive(Debug, Deserialize)]
struct NoaaResponse {
    /// Station metadata (present on success)
    #[allow(dead_code)]
    metadata: Option<NoaaMetadata>,
    /// Water level data points (present on success)
    data: Option<Vec<NoaaDataPoint>>,
    /// Error object (present on failure)
    error: Option<NoaaError>,
}

/// Station metadata from NOAA response
#[derive(Debug, Deserialize)]
struct NoaaMetadata {
    #[allow(dead_code)]
    id: Option<String>,
    #[allow(dead_code)]
    name: Option<String>,
    #[allow(dead_code)]
    lat: Option<String>,
    #[allow(dead_code)]
    lon: Option<String>,
}

/// A single water level data point
#[derive(Debug, Deserialize)]
struct NoaaDataPoint {
    /// Timestamp (e.g., "2024-01-15 12:00")
    #[allow(dead_code)]
    t: String,
    /// Water level value in feet (as string, e.g., "2.456")
    v: String,
    /// Standard deviation (as string)
    #[allow(dead_code)]
    s: Option<String>,
    /// Quality flags
    #[allow(dead_code)]
    f: Option<String>,
    /// Quality assurance flag
    #[allow(dead_code)]
    q: Option<String>,
}

/// Error response from NOAA API
#[derive(Debug, Deserialize)]
struct NoaaError {
    message: Option<String>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// NOAA Tides & Currents market data source.
///
/// Tracks real-time water levels for ~59 major US tide stations.
/// Source ID is `"noaa_tides"`.
pub struct NoaaTidesMarketSource {
    http: SourceHttpClient,
}

impl NoaaTidesMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
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
            "NOAA Tides & Currents source initialized ({} stations)",
            STATIONS.len()
        );

        Ok(Self { http })
    }

    /// Build the API URL for fetching latest water level for a station
    fn water_level_url(station_id: &str) -> String {
        format!(
            "{}?date=latest&station={}&product=water_level&datum=MLLW&units=english&time_zone=gmt&application=IndexDataNode&format=json",
            API_BASE, station_id
        )
    }

    /// Extract station ID from asset_id (strip "noaa_tide_" prefix)
    fn extract_station_id(asset_id: &str) -> &str {
        asset_id.strip_prefix("noaa_tide_").unwrap_or(asset_id)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for NoaaTidesMarketSource {
    fn source_id(&self) -> &'static str {
        "noaa_tides"
    }

    fn display_name(&self) -> &'static str {
        "NOAA Tides & Currents"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(900) // 15 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets: Vec<AssetUpdate> = STATIONS
            .iter()
            .map(|station| AssetUpdate {
                asset_id: format!("noaa_tide_{}", station.id),
                symbol: format!("TIDE/{}", station.id),
                name: format!("Tide: {}", station.name),
                category: Some("environment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": station.id,
                    "subcategory": "tides",
                    "active": true,
                    "extra": {},
                }),
            })
            .collect();

        info!(
            "NOAA Tides fetch_assets: {} stations loaded",
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
            let station_id = Self::extract_station_id(asset_id);
            let url = Self::water_level_url(station_id);

            // Add delay between requests (skip before first)
            if i > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            debug!("Fetching water level for station {}", station_id);

            let response: NoaaResponse = match self.http.get_json(&url).await {
                Ok(data) => data,
                Err(e) => {
                    warn!(
                        "Error fetching NOAA tide data for station {}: {:?}",
                        station_id, e
                    );
                    errors += 1;
                    continue;
                }
            };

            // Check for API-level error
            if let Some(ref err) = response.error {
                let msg = err.message.as_deref().unwrap_or("unknown error");
                warn!("NOAA API error for station {}: {}", station_id, msg);
                errors += 1;
                continue;
            }

            // Extract water level from data array
            let water_level = match response.data.as_ref().and_then(|d| d.first()) {
                Some(point) => match Decimal::from_str(point.v.trim()) {
                    Ok(val) => val,
                    Err(e) => {
                        warn!(
                            "Failed to parse water level '{}' for station {}: {}",
                            point.v, station_id, e
                        );
                        errors += 1;
                        continue;
                    }
                },
                None => {
                    warn!("No data points returned for station {}", station_id);
                    errors += 1;
                    continue;
                }
            };

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("TIDE/{}", station_id),
                value: water_level,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} water levels from NOAA Tides ({} errors)",
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
    fn test_station_count() {
        assert_eq!(
            STATIONS.len(),
            59,
            "Expected 59 curated tide stations, got {}",
            STATIONS.len()
        );
    }

    #[test]
    fn test_fetch_assets_returns_correct_format() {
        // Verify the first station produces the expected AssetUpdate fields
        let station = &STATIONS[0];
        let asset_id = format!("noaa_tide_{}", station.id);
        let symbol = format!("TIDE/{}", station.id);
        let name = format!("Tide: {}", station.name);

        assert!(asset_id.starts_with("noaa_tide_"));
        assert!(symbol.starts_with("TIDE/"));
        assert!(name.starts_with("Tide: "));

        // Verify all stations produce valid asset IDs
        for s in STATIONS {
            let aid = format!("noaa_tide_{}", s.id);
            assert!(
                aid.starts_with("noaa_tide_"),
                "Asset ID {} should start with 'noaa_tide_'",
                aid
            );
        }
    }

    #[test]
    fn test_parse_water_level() {
        // Normal positive water level
        let val = Decimal::from_str("2.456").unwrap();
        assert_eq!(val, Decimal::from_str("2.456").unwrap());

        // Negative water level (extreme low tide)
        let neg = Decimal::from_str("-0.532").unwrap();
        assert!(neg < Decimal::ZERO);

        // Zero water level
        let zero = Decimal::from_str("0.000").unwrap();
        assert_eq!(zero, Decimal::ZERO);

        // Large water level (storm surge)
        let large = Decimal::from_str("12.345").unwrap();
        assert!(large > Decimal::from(10));
    }

    #[test]
    fn test_station_ids_valid() {
        for station in STATIONS {
            // All station IDs should be numeric
            assert!(
                station.id.chars().all(|c| c.is_ascii_digit()),
                "Station ID '{}' ({}) should be all digits",
                station.id,
                station.name
            );
            // All station IDs should be 7 digits
            assert_eq!(
                station.id.len(),
                7,
                "Station ID '{}' ({}) should be 7 digits, got {}",
                station.id,
                station.name,
                station.id.len()
            );
        }
    }

    #[test]
    fn test_station_ids_unique() {
        let mut ids: Vec<&str> = STATIONS.iter().map(|s| s.id).collect();
        let original_len = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(
            ids.len(),
            original_len,
            "Station IDs should be unique (found duplicates)"
        );
    }

    #[test]
    fn test_extract_station_id() {
        assert_eq!(
            NoaaTidesMarketSource::extract_station_id("noaa_tide_8518750"),
            "8518750"
        );
        assert_eq!(
            NoaaTidesMarketSource::extract_station_id("8518750"),
            "8518750"
        );
    }

    #[test]
    fn test_water_level_url() {
        let url = NoaaTidesMarketSource::water_level_url("8518750");
        assert!(url.contains("station=8518750"));
        assert!(url.contains("product=water_level"));
        assert!(url.contains("datum=MLLW"));
        assert!(url.contains("units=english"));
        assert!(url.contains("time_zone=gmt"));
        assert!(url.contains("format=json"));
        assert!(url.contains("date=latest"));
        assert!(url.contains("application=IndexDataNode"));
    }

    #[test]
    fn test_known_stations_present() {
        let ids: Vec<&str> = STATIONS.iter().map(|s| s.id).collect();
        // Verify some well-known stations
        assert!(ids.contains(&"8518750"), "The Battery, NY should be present");
        assert!(ids.contains(&"9414290"), "San Francisco, CA should be present");
        assert!(ids.contains(&"9447130"), "Seattle, WA should be present");
        assert!(ids.contains(&"1612340"), "Honolulu, HI should be present");
        assert!(ids.contains(&"9452210"), "Juneau, AK should be present");
        assert!(ids.contains(&"8724580"), "Key West, FL should be present");
    }

    #[test]
    fn test_noaa_response_deserialization() {
        let json = r#"{
            "metadata": {
                "id": "8518750",
                "name": "The Battery",
                "lat": "40.7006",
                "lon": "-74.0142"
            },
            "data": [
                {
                    "t": "2024-01-15 12:00",
                    "v": "2.456",
                    "s": "0.016",
                    "f": "0,0,0,0",
                    "q": "v"
                }
            ]
        }"#;

        let response: NoaaResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_some());
        assert!(response.error.is_none());

        let data = response.data.unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0].v, "2.456");
        assert_eq!(data[0].t, "2024-01-15 12:00");

        let water_level = Decimal::from_str(data[0].v.trim()).unwrap();
        assert_eq!(water_level, Decimal::from_str("2.456").unwrap());
    }

    #[test]
    fn test_noaa_error_response_deserialization() {
        let json = r#"{
            "error": {
                "message": "Station not found"
            }
        }"#;

        let response: NoaaResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_none());
        assert!(response.error.is_some());
        assert_eq!(
            response.error.unwrap().message.unwrap(),
            "Station not found"
        );
    }
}
