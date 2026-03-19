//! NOAA CO-OPS Ocean Meteorology client implementing MarketDataSource
//!
//! Tracks real-time water temperature and wind data from ~59 major US coastal
//! stations via the NOAA CO-OPS Tides & Currents API. Each station produces
//! two assets: water temperature (°F) and wind speed (knots).
//!
//! **API**: https://api.tidesandcurrents.noaa.gov/api/prod/datagetter
//! - No auth needed
//! - Single-station requests (no batch endpoint)
//! - Rate limit: 25 req/min (slightly lower than noaa_tides to avoid competing)
//! - Sync interval: 600s (10 min) — data updates every 6 minutes
//!
//! Products tracked:
//! - `water_temperature` — ocean/harbor water temp in °F
//! - `wind` — wind speed in knots + direction

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
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

/// Delay between sequential station requests (ms) to stay within 25 req/min
const INTER_REQUEST_DELAY_MS: u64 = 1500;

// ============================================================================
// PRODUCT TYPES
// ============================================================================

/// Meteorological product types we track per station
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum MetProduct {
    WaterTemperature,
    Wind,
}

impl MetProduct {
    /// NOAA API product parameter value
    fn api_product(&self) -> &'static str {
        match self {
            MetProduct::WaterTemperature => "water_temperature",
            MetProduct::Wind => "wind",
        }
    }

    /// Asset ID suffix
    fn asset_suffix(&self) -> &'static str {
        match self {
            MetProduct::WaterTemperature => "water_temp",
            MetProduct::Wind => "wind",
        }
    }

    /// Symbol path component
    fn symbol_component(&self) -> &'static str {
        match self {
            MetProduct::WaterTemperature => "WTEMP",
            MetProduct::Wind => "WIND",
        }
    }

    /// Human-readable label for asset name
    fn display_label(&self) -> &'static str {
        match self {
            MetProduct::WaterTemperature => "Water Temp",
            MetProduct::Wind => "Wind Speed",
        }
    }
}

// ============================================================================
// CURATED STATION LIST
// ============================================================================

/// A meteorological station definition
struct StationDef {
    id: &'static str,
    name: &'static str,
}

/// ~59 major US coastal stations (same as noaa_tides)
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

/// Top-level response from the NOAA CO-OPS datagetter API (water_temperature)
#[derive(Debug, Deserialize)]
struct WaterTempResponse {
    /// Station metadata (present on success)
    #[allow(dead_code)]
    metadata: Option<NoaaMetadata>,
    /// Water temperature data points (present on success)
    data: Option<Vec<WaterTempDataPoint>>,
    /// Error object (present on failure)
    error: Option<NoaaError>,
}

/// Top-level response from the NOAA CO-OPS datagetter API (wind)
#[derive(Debug, Deserialize)]
struct WindResponse {
    /// Station metadata (present on success)
    #[allow(dead_code)]
    metadata: Option<NoaaMetadata>,
    /// Wind data points (present on success)
    data: Option<Vec<WindDataPoint>>,
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

/// A single water temperature data point
#[derive(Debug, Deserialize)]
struct WaterTempDataPoint {
    /// Timestamp (e.g., "2024-01-15 12:00")
    #[allow(dead_code)]
    t: String,
    /// Water temperature in °F (as string, e.g., "45.3")
    v: String,
    /// Quality flags
    #[allow(dead_code)]
    f: Option<String>,
}

/// A single wind data point
#[derive(Debug, Deserialize)]
struct WindDataPoint {
    /// Timestamp (e.g., "2024-01-15 12:00")
    #[allow(dead_code)]
    t: String,
    /// Wind speed in knots (as string, e.g., "12.5")
    s: String,
    /// Wind direction in degrees (as string, e.g., "180.00")
    #[allow(dead_code)]
    d: Option<String>,
    /// Compass direction (e.g., "S", "NW")
    #[allow(dead_code)]
    dr: Option<String>,
    /// Gust speed in knots (as string, e.g., "15.2")
    #[allow(dead_code)]
    g: Option<String>,
    /// Quality flags
    #[allow(dead_code)]
    f: Option<String>,
}

/// Error response from NOAA API
#[derive(Debug, Deserialize)]
struct NoaaError {
    message: Option<String>,
}

// ============================================================================
// ASSET ID PARSING
// ============================================================================

/// Parsed asset identifier containing station ID and product type
#[derive(Debug)]
struct ParsedAssetId {
    station_id: String,
    product: MetProduct,
}

/// Parse an asset_id like "noaa_met_8443970_water_temp" or "noaa_met_8443970_wind"
/// into its station ID and product type.
fn parse_asset_id(asset_id: &str) -> Option<ParsedAssetId> {
    let stripped = asset_id.strip_prefix("noaa_met_")?;

    if let Some(station_id) = stripped.strip_suffix("_water_temp") {
        Some(ParsedAssetId {
            station_id: station_id.to_string(),
            product: MetProduct::WaterTemperature,
        })
    } else if let Some(station_id) = stripped.strip_suffix("_wind") {
        Some(ParsedAssetId {
            station_id: station_id.to_string(),
            product: MetProduct::Wind,
        })
    } else {
        None
    }
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// NOAA Ocean Meteorology market data source.
///
/// Tracks real-time water temperature and wind data for ~59 major US
/// coastal stations. Source ID is `"noaa_met"`.
pub struct NoaaMetMarketSource {
    http: SourceHttpClient,
}

impl NoaaMetMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 25,
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
            "NOAA Ocean Meteorology source initialized ({} stations, {} assets)",
            STATIONS.len(),
            STATIONS.len() * 2
        );

        Ok(Self { http })
    }

    /// Build the API URL for fetching latest data for a station+product
    fn product_url(station_id: &str, product: &str) -> String {
        format!(
            "{}?date=latest&station={}&product={}&units=english&time_zone=gmt&application=IndexDataNode&format=json",
            API_BASE, station_id, product
        )
    }
}

#[async_trait::async_trait]
impl MarketDataSource for NoaaMetMarketSource {
    fn source_id(&self) -> &'static str {
        "noaa_met"
    }

    fn display_name(&self) -> &'static str {
        "NOAA Ocean Meteorology"
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
                max_requests: 25,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let products = [MetProduct::WaterTemperature, MetProduct::Wind];
        let mut assets = Vec::with_capacity(STATIONS.len() * products.len());

        for station in STATIONS {
            for product in &products {
                assets.push(AssetUpdate {
                    asset_id: format!("noaa_met_{}_{}", station.id, product.asset_suffix()),
                    symbol: format!("MET/{}/{}", station.id, product.symbol_component()),
                    name: format!("{} {}", station.name, product.display_label()),
                    category: Some("environment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": station.id,
                        "subcategory": "ocean_met",
                        "product": product.api_product(),
                        "active": true,
                        "extra": {},
                    }),
                });
            }
        }

        info!(
            "NOAA Ocean Met fetch_assets: {} assets ({} stations x {} products)",
            assets.len(),
            STATIONS.len(),
            products.len()
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

        // Group requested asset_ids by station
        let mut station_products: HashMap<String, Vec<(String, MetProduct)>> = HashMap::new();
        for asset_id in asset_ids {
            if let Some(parsed) = parse_asset_id(asset_id) {
                station_products
                    .entry(parsed.station_id.clone())
                    .or_default()
                    .push((asset_id.clone(), parsed.product));
            } else {
                warn!("Failed to parse NOAA met asset_id: {}", asset_id);
                errors += 1;
            }
        }

        let mut request_count = 0u32;

        for (station_id, product_list) in &station_products {
            // Deduplicate products for this station
            let mut products_needed: Vec<MetProduct> = Vec::new();
            for (_, product) in product_list {
                if !products_needed.contains(product) {
                    products_needed.push(*product);
                }
            }

            for product in &products_needed {
                // Add delay between requests (skip before first)
                if request_count > 0 {
                    tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
                }
                request_count += 1;

                let url = Self::product_url(station_id, product.api_product());
                debug!(
                    "Fetching {} for station {}",
                    product.api_product(),
                    station_id
                );

                match product {
                    MetProduct::WaterTemperature => {
                        let response: WaterTempResponse = match self.http.get_json(&url).await {
                            Ok(data) => data,
                            Err(e) => {
                                warn!(
                                    "Error fetching water_temperature for station {}: {:?}",
                                    station_id, e
                                );
                                errors += 1;
                                continue;
                            }
                        };

                        // Check for API-level error
                        if let Some(ref err) = response.error {
                            let msg = err.message.as_deref().unwrap_or("unknown error");
                            warn!(
                                "NOAA API error for station {} water_temperature: {}",
                                station_id, msg
                            );
                            errors += 1;
                            continue;
                        }

                        // Extract water temperature from data array
                        let temp = match response.data.as_ref().and_then(|d| d.first()) {
                            Some(point) => match Decimal::from_str(point.v.trim()) {
                                Ok(val) => val,
                                Err(e) => {
                                    warn!(
                                        "Failed to parse water temp '{}' for station {}: {}",
                                        point.v, station_id, e
                                    );
                                    errors += 1;
                                    continue;
                                }
                            },
                            None => {
                                warn!(
                                    "No water_temperature data points for station {}",
                                    station_id
                                );
                                errors += 1;
                                continue;
                            }
                        };

                        // Find all asset_ids for this station+product and push results
                        for (asset_id, p) in product_list {
                            if p == product {
                                results.push(PriceUpdate {
                                    asset_id: asset_id.clone(),
                                    symbol: format!("MET/{}/WTEMP", station_id),
                                    value: temp,
                                    prev_close: None,
                                    change_pct: None,
                                    volume_24h: None,
                                    market_cap: None,
                                    fetched_at: now,
                                });
                            }
                        }
                    }
                    MetProduct::Wind => {
                        let response: WindResponse = match self.http.get_json(&url).await {
                            Ok(data) => data,
                            Err(e) => {
                                warn!(
                                    "Error fetching wind for station {}: {:?}",
                                    station_id, e
                                );
                                errors += 1;
                                continue;
                            }
                        };

                        // Check for API-level error
                        if let Some(ref err) = response.error {
                            let msg = err.message.as_deref().unwrap_or("unknown error");
                            warn!(
                                "NOAA API error for station {} wind: {}",
                                station_id, msg
                            );
                            errors += 1;
                            continue;
                        }

                        // Extract wind speed from data array
                        let speed = match response.data.as_ref().and_then(|d| d.first()) {
                            Some(point) => match Decimal::from_str(point.s.trim()) {
                                Ok(val) => val,
                                Err(e) => {
                                    warn!(
                                        "Failed to parse wind speed '{}' for station {}: {}",
                                        point.s, station_id, e
                                    );
                                    errors += 1;
                                    continue;
                                }
                            },
                            None => {
                                warn!("No wind data points for station {}", station_id);
                                errors += 1;
                                continue;
                            }
                        };

                        // Find all asset_ids for this station+product and push results
                        for (asset_id, p) in product_list {
                            if p == product {
                                results.push(PriceUpdate {
                                    asset_id: asset_id.clone(),
                                    symbol: format!("MET/{}/WIND", station_id),
                                    value: speed,
                                    prev_close: None,
                                    change_pct: None,
                                    volume_24h: None,
                                    market_cap: None,
                                    fetched_at: now,
                                });
                            }
                        }
                    }
                }
            }
        }

        info!(
            "Fetched {}/{} met values from NOAA Ocean Met ({} errors, {} API requests)",
            results.len(),
            asset_ids.len(),
            errors,
            request_count
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
            "Expected 59 curated met stations, got {}",
            STATIONS.len()
        );
    }

    #[test]
    fn test_asset_generation_count() {
        // 59 stations x 2 products = 118 assets
        let products = [MetProduct::WaterTemperature, MetProduct::Wind];
        let total = STATIONS.len() * products.len();
        assert_eq!(total, 118, "Expected 118 assets (59 x 2), got {}", total);
    }

    #[test]
    fn test_asset_ids_format() {
        let station = &STATIONS[0];
        let wtemp_id = format!("noaa_met_{}_water_temp", station.id);
        let wind_id = format!("noaa_met_{}_wind", station.id);

        assert_eq!(wtemp_id, "noaa_met_8443970_water_temp");
        assert_eq!(wind_id, "noaa_met_8443970_wind");
    }

    #[test]
    fn test_asset_symbols_format() {
        let station = &STATIONS[0];
        let wtemp_sym = format!("MET/{}/WTEMP", station.id);
        let wind_sym = format!("MET/{}/WIND", station.id);

        assert_eq!(wtemp_sym, "MET/8443970/WTEMP");
        assert_eq!(wind_sym, "MET/8443970/WIND");
    }

    #[test]
    fn test_asset_names_format() {
        let station = &STATIONS[0]; // Boston, MA
        let wtemp_name = format!("{} {}", station.name, MetProduct::WaterTemperature.display_label());
        let wind_name = format!("{} {}", station.name, MetProduct::Wind.display_label());

        assert_eq!(wtemp_name, "Boston, MA Water Temp");
        assert_eq!(wind_name, "Boston, MA Wind Speed");
    }

    #[test]
    fn test_parse_asset_id_water_temp() {
        let parsed = parse_asset_id("noaa_met_8443970_water_temp").unwrap();
        assert_eq!(parsed.station_id, "8443970");
        assert_eq!(parsed.product, MetProduct::WaterTemperature);
    }

    #[test]
    fn test_parse_asset_id_wind() {
        let parsed = parse_asset_id("noaa_met_9447130_wind").unwrap();
        assert_eq!(parsed.station_id, "9447130");
        assert_eq!(parsed.product, MetProduct::Wind);
    }

    #[test]
    fn test_parse_asset_id_invalid_prefix() {
        assert!(parse_asset_id("noaa_tide_8443970_water_temp").is_none());
        assert!(parse_asset_id("wrong_prefix_8443970_wind").is_none());
    }

    #[test]
    fn test_parse_asset_id_invalid_suffix() {
        assert!(parse_asset_id("noaa_met_8443970_unknown").is_none());
        assert!(parse_asset_id("noaa_met_8443970").is_none());
    }

    #[test]
    fn test_parse_water_temperature_response() {
        let json = r#"{
            "metadata": {
                "id": "8443970",
                "name": "Boston",
                "lat": "42.3548",
                "lon": "-71.0534"
            },
            "data": [
                {
                    "t": "2024-01-15 12:00",
                    "v": "45.3",
                    "f": "0,0,0"
                }
            ]
        }"#;

        let response: WaterTempResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_some());
        assert!(response.error.is_none());

        let data = response.data.unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0].v, "45.3");
        assert_eq!(data[0].t, "2024-01-15 12:00");

        let temp = Decimal::from_str(data[0].v.trim()).unwrap();
        assert_eq!(temp, Decimal::from_str("45.3").unwrap());
    }

    #[test]
    fn test_parse_wind_response() {
        let json = r#"{
            "metadata": {
                "id": "8443970",
                "name": "Boston",
                "lat": "42.3548",
                "lon": "-71.0534"
            },
            "data": [
                {
                    "t": "2024-01-15 12:00",
                    "s": "12.5",
                    "d": "180.00",
                    "dr": "S",
                    "g": "15.2",
                    "f": "0,0,0"
                }
            ]
        }"#;

        let response: WindResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_some());
        assert!(response.error.is_none());

        let data = response.data.unwrap();
        assert_eq!(data.len(), 1);
        assert_eq!(data[0].s, "12.5");
        assert_eq!(data[0].d.as_deref(), Some("180.00"));
        assert_eq!(data[0].dr.as_deref(), Some("S"));
        assert_eq!(data[0].g.as_deref(), Some("15.2"));

        let speed = Decimal::from_str(data[0].s.trim()).unwrap();
        assert_eq!(speed, Decimal::from_str("12.5").unwrap());
    }

    #[test]
    fn test_parse_error_response_water_temp() {
        let json = r#"{
            "error": {
                "message": "No data was found. This product may not be offered at this station at the requested time."
            }
        }"#;

        let response: WaterTempResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_none());
        assert!(response.error.is_some());
        assert!(response
            .error
            .unwrap()
            .message
            .unwrap()
            .contains("No data was found"));
    }

    #[test]
    fn test_parse_error_response_wind() {
        let json = r#"{
            "error": {
                "message": "Station not found"
            }
        }"#;

        let response: WindResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_none());
        assert!(response.error.is_some());
        assert_eq!(
            response.error.unwrap().message.unwrap(),
            "Station not found"
        );
    }

    #[test]
    fn test_parse_water_temp_values() {
        // Normal warm water
        let val = Decimal::from_str("78.5").unwrap();
        assert!(val > Decimal::from(70));

        // Cold water
        let cold = Decimal::from_str("32.1").unwrap();
        assert!(cold > Decimal::from(30));

        // Zero (freezing)
        let zero = Decimal::from_str("0.0").unwrap();
        assert_eq!(zero, Decimal::ZERO);
    }

    #[test]
    fn test_parse_wind_speed_values() {
        // Normal wind
        let val = Decimal::from_str("12.5").unwrap();
        assert!(val > Decimal::from(10));

        // Calm wind
        let calm = Decimal::from_str("0.00").unwrap();
        assert_eq!(calm, Decimal::ZERO);

        // Strong wind / gust
        let strong = Decimal::from_str("45.8").unwrap();
        assert!(strong > Decimal::from(40));
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
    fn test_known_stations_present() {
        let ids: Vec<&str> = STATIONS.iter().map(|s| s.id).collect();
        assert!(ids.contains(&"8518750"), "The Battery, NY should be present");
        assert!(ids.contains(&"9414290"), "San Francisco, CA should be present");
        assert!(ids.contains(&"9447130"), "Seattle, WA should be present");
        assert!(ids.contains(&"1612340"), "Honolulu, HI should be present");
        assert!(ids.contains(&"9452210"), "Juneau, AK should be present");
        assert!(ids.contains(&"8724580"), "Key West, FL should be present");
    }

    #[test]
    fn test_product_url_water_temperature() {
        let url = NoaaMetMarketSource::product_url("8518750", "water_temperature");
        assert!(url.contains("station=8518750"));
        assert!(url.contains("product=water_temperature"));
        assert!(url.contains("units=english"));
        assert!(url.contains("time_zone=gmt"));
        assert!(url.contains("format=json"));
        assert!(url.contains("date=latest"));
        assert!(url.contains("application=IndexDataNode"));
    }

    #[test]
    fn test_product_url_wind() {
        let url = NoaaMetMarketSource::product_url("9447130", "wind");
        assert!(url.contains("station=9447130"));
        assert!(url.contains("product=wind"));
        assert!(url.contains("units=english"));
        assert!(url.contains("time_zone=gmt"));
        assert!(url.contains("format=json"));
        assert!(url.contains("date=latest"));
    }

    #[test]
    fn test_met_product_api_values() {
        assert_eq!(MetProduct::WaterTemperature.api_product(), "water_temperature");
        assert_eq!(MetProduct::Wind.api_product(), "wind");
    }

    #[test]
    fn test_met_product_suffixes() {
        assert_eq!(MetProduct::WaterTemperature.asset_suffix(), "water_temp");
        assert_eq!(MetProduct::Wind.asset_suffix(), "wind");
    }

    #[test]
    fn test_met_product_symbols() {
        assert_eq!(MetProduct::WaterTemperature.symbol_component(), "WTEMP");
        assert_eq!(MetProduct::Wind.symbol_component(), "WIND");
    }

    #[test]
    fn test_fetch_assets_returns_correct_count() {
        // Simulate what fetch_assets does
        let products = [MetProduct::WaterTemperature, MetProduct::Wind];
        let mut assets = Vec::new();
        for station in STATIONS {
            for product in &products {
                assets.push(format!(
                    "noaa_met_{}_{}",
                    station.id,
                    product.asset_suffix()
                ));
            }
        }
        assert_eq!(
            assets.len(),
            118,
            "Expected 118 assets (59 stations x 2 products), got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_generated_asset_ids_parseable() {
        let products = [MetProduct::WaterTemperature, MetProduct::Wind];
        for station in STATIONS {
            for product in &products {
                let asset_id = format!("noaa_met_{}_{}", station.id, product.asset_suffix());
                let parsed = parse_asset_id(&asset_id);
                assert!(
                    parsed.is_some(),
                    "Asset ID '{}' should be parseable",
                    asset_id
                );
                let parsed = parsed.unwrap();
                assert_eq!(parsed.station_id, station.id);
                assert_eq!(parsed.product, *product);
            }
        }
    }
}
