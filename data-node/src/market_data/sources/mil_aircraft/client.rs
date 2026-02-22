//! US Military Aircraft tracking via OpenSky Network API
//!
//! Tracks individual US military aircraft GPS positions and aggregate counts.
//! Military aircraft are identified by ICAO 24-bit hex address in the range AE0000-AFFFFF.
//!
//! Makes ONE call to `https://opensky-network.org/api/states/all` (global, no bbox),
//! then filters for military ICAO hex codes.
//!
//! Assets:
//! - Static aggregates: total broadcasting, airborne, ground, regional counts, avg altitude/speed
//! - Dynamic per-aircraft: lat, lon, alt for each currently broadcasting military aircraft
//!
//! API: https://opensky-network.org/api/states/all
//! Auth: None (anonymous access)
//! Rate limit: 6 req/min (shared with flights on OpenSky's IP-level limit)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration -- 9 static aggregate assets
const ASSET_JSON: &str = include_str!("../../../config/mil_aircraft.json");

/// OpenSky API base URL (global, no bbox)
const API_URL: &str = "https://opensky-network.org/api/states/all";

/// US military ICAO range start (inclusive)
const MIL_ICAO_START: u32 = 0xAE0000;
/// US military ICAO range end (inclusive)
const MIL_ICAO_END: u32 = 0xAFFFFF;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// OpenSky Network states response
#[derive(Debug, Deserialize)]
struct OpenSkyResponse {
    /// Unix timestamp of the state vectors
    #[allow(dead_code)]
    time: i64,
    /// Array of state vectors. Each element is an array of mixed types.
    /// null if no aircraft broadcasting.
    states: Option<Vec<serde_json::Value>>,
}

// ============================================================================
// PARSED AIRCRAFT STATE
// ============================================================================

/// Parsed state for a single military aircraft
#[derive(Debug, Clone)]
pub struct MilAircraftState {
    pub icao24: String,
    pub callsign: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub baro_altitude: Option<f64>,
    pub on_ground: bool,
    pub velocity: Option<f64>,
}

// ============================================================================
// HELPER FUNCTIONS (pub for testing)
// ============================================================================

/// Check if an ICAO 24-bit hex address is in the US military range (AE0000-AFFFFF).
pub fn is_us_military(icao24: &str) -> bool {
    if let Ok(hex) = u32::from_str_radix(icao24, 16) {
        hex >= MIL_ICAO_START && hex <= MIL_ICAO_END
    } else {
        false
    }
}

/// Classify an aircraft's region based on lat/lon.
pub fn classify_region(lat: f64, lon: f64) -> &'static str {
    // Europe: lat 35-72, lon -25-45
    if lat >= 35.0 && lat <= 72.0 && lon >= -25.0 && lon <= 45.0 {
        return "europe";
    }
    // Middle East: lat 12-42, lon 25-63
    if lat >= 12.0 && lat <= 42.0 && lon >= 25.0 && lon <= 63.0 {
        return "mideast";
    }
    // Pacific: lat -50-60, lon 100-180 or -180--120
    if lat >= -50.0 && lat <= 60.0 && (lon >= 100.0 || lon <= -120.0) {
        return "pacific";
    }
    // CONUS: lat 24-50, lon -125--66
    if lat >= 24.0 && lat <= 50.0 && lon >= -125.0 && lon <= -66.0 {
        return "conus";
    }
    "other"
}

/// Parse a single OpenSky state vector (JSON array) into a MilAircraftState.
/// Returns None if the ICAO is not in the US military range.
pub fn parse_state_vector(state: &serde_json::Value) -> Option<MilAircraftState> {
    let arr = state.as_array()?;
    if arr.len() < 10 {
        return None;
    }

    let icao24 = arr[0].as_str()?.trim().to_lowercase();
    if !is_us_military(&icao24) {
        return None;
    }

    let callsign = arr[1]
        .as_str()
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    let longitude = arr[5].as_f64();
    let latitude = arr[6].as_f64();
    let baro_altitude = arr[7].as_f64();
    let on_ground = arr[8].as_bool().unwrap_or(false);
    let velocity = arr[9].as_f64();

    Some(MilAircraftState {
        icao24,
        callsign,
        latitude,
        longitude,
        baro_altitude,
        on_ground,
        velocity,
    })
}

/// Compute aggregate metrics from a list of military aircraft states.
pub fn compute_aggregates(states: &[MilAircraftState]) -> HashMap<String, Decimal> {
    let mut results = HashMap::new();

    let total = states.len();
    let airborne = states.iter().filter(|s| !s.on_ground).count();
    let ground = states.iter().filter(|s| s.on_ground).count();

    // Regional counts (only for aircraft with known positions)
    let mut region_counts: HashMap<&str, usize> = HashMap::new();
    let mut alt_sum = 0.0f64;
    let mut alt_count = 0usize;
    let mut speed_sum = 0.0f64;
    let mut speed_count = 0usize;

    for state in states {
        if let (Some(lat), Some(lon)) = (state.latitude, state.longitude) {
            let region = classify_region(lat, lon);
            *region_counts.entry(region).or_insert(0) += 1;
        }

        if let Some(alt) = state.baro_altitude {
            if !state.on_ground && alt > 0.0 {
                alt_sum += alt;
                alt_count += 1;
            }
        }

        if let Some(vel) = state.velocity {
            if !state.on_ground && vel > 0.0 {
                speed_sum += vel;
                speed_count += 1;
            }
        }
    }

    results.insert(
        "mil_us_active_total".to_string(),
        Decimal::from(total as u64),
    );
    results.insert(
        "mil_us_airborne".to_string(),
        Decimal::from(airborne as u64),
    );
    results.insert("mil_us_ground".to_string(), Decimal::from(ground as u64));

    results.insert(
        "mil_us_europe".to_string(),
        Decimal::from(*region_counts.get("europe").unwrap_or(&0) as u64),
    );
    results.insert(
        "mil_us_mideast".to_string(),
        Decimal::from(*region_counts.get("mideast").unwrap_or(&0) as u64),
    );
    results.insert(
        "mil_us_pacific".to_string(),
        Decimal::from(*region_counts.get("pacific").unwrap_or(&0) as u64),
    );
    results.insert(
        "mil_us_conus".to_string(),
        Decimal::from(*region_counts.get("conus").unwrap_or(&0) as u64),
    );

    // Average altitude (rounded to integer meters)
    let avg_alt = if alt_count > 0 {
        (alt_sum / alt_count as f64).round() as i64
    } else {
        0
    };
    results.insert(
        "mil_us_avg_altitude".to_string(),
        Decimal::from(avg_alt),
    );

    // Average speed (rounded to integer m/s)
    let avg_speed = if speed_count > 0 {
        (speed_sum / speed_count as f64).round() as i64
    } else {
        0
    };
    results.insert(
        "mil_us_avg_speed".to_string(),
        Decimal::from(avg_speed),
    );

    results
}

/// Build dynamic asset updates for individual aircraft GPS data.
pub fn build_dynamic_assets(states: &[MilAircraftState]) -> Vec<AssetUpdate> {
    let mut assets = Vec::new();

    for state in states {
        // Only include aircraft with known positions
        let (Some(_lat), Some(_lon)) = (state.latitude, state.longitude) else {
            continue;
        };

        let label = if state.callsign.is_empty() {
            state.icao24.to_uppercase()
        } else {
            state.callsign.clone()
        };

        let icao = &state.icao24;

        // Latitude asset
        assets.push(AssetUpdate {
            asset_id: format!("mil_{}_lat", icao),
            symbol: format!("MIL/{}_LAT", label),
            name: format!("{} Latitude", label),
            category: Some("defense".to_string()),
            metadata: serde_json::json!({
                "api_ref": format!("gps:{}:lat", icao),
                "subcategory": "aviation",
                "active": true,
                "extra": {
                    "icao24": icao,
                    "callsign": state.callsign,
                    "metric": "latitude",
                },
            }),
        });

        // Longitude asset
        assets.push(AssetUpdate {
            asset_id: format!("mil_{}_lon", icao),
            symbol: format!("MIL/{}_LON", label),
            name: format!("{} Longitude", label),
            category: Some("defense".to_string()),
            metadata: serde_json::json!({
                "api_ref": format!("gps:{}:lon", icao),
                "subcategory": "aviation",
                "active": true,
                "extra": {
                    "icao24": icao,
                    "callsign": state.callsign,
                    "metric": "longitude",
                },
            }),
        });

        // Altitude asset
        assets.push(AssetUpdate {
            asset_id: format!("mil_{}_alt", icao),
            symbol: format!("MIL/{}_ALT", label),
            name: format!("{} Altitude", label),
            category: Some("defense".to_string()),
            metadata: serde_json::json!({
                "api_ref": format!("gps:{}:alt", icao),
                "subcategory": "aviation",
                "active": true,
                "extra": {
                    "icao24": icao,
                    "callsign": state.callsign,
                    "metric": "altitude",
                },
            }),
        });
    }

    assets
}

/// Build dynamic price updates for individual aircraft GPS data.
fn build_dynamic_prices(
    states: &[MilAircraftState],
    asset_ids: &[String],
    now: chrono::DateTime<Utc>,
) -> Vec<PriceUpdate> {
    let mut results = Vec::new();
    let requested: std::collections::HashSet<&str> =
        asset_ids.iter().map(|s| s.as_str()).collect();

    for state in states {
        let (Some(lat), Some(lon)) = (state.latitude, state.longitude) else {
            continue;
        };

        let label = if state.callsign.is_empty() {
            state.icao24.to_uppercase()
        } else {
            state.callsign.clone()
        };

        let icao = &state.icao24;
        let alt = state.baro_altitude.unwrap_or(0.0);

        // Latitude
        let lat_id = format!("mil_{}_lat", icao);
        if requested.contains(lat_id.as_str()) {
            results.push(PriceUpdate {
                asset_id: lat_id,
                symbol: format!("MIL/{}_LAT", label),
                value: decimal_from_f64(lat),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        // Longitude
        let lon_id = format!("mil_{}_lon", icao);
        if requested.contains(lon_id.as_str()) {
            results.push(PriceUpdate {
                asset_id: lon_id,
                symbol: format!("MIL/{}_LON", label),
                value: decimal_from_f64(lon),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        // Altitude
        let alt_id = format!("mil_{}_alt", icao);
        if requested.contains(alt_id.as_str()) {
            results.push(PriceUpdate {
                asset_id: alt_id,
                symbol: format!("MIL/{}_ALT", label),
                value: decimal_from_f64(alt),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }
    }

    results
}

/// Convert f64 to Decimal, rounding to 6 decimal places.
fn decimal_from_f64(v: f64) -> Decimal {
    Decimal::from_f64_retain(v)
        .unwrap_or(Decimal::ZERO)
        .round_dp(6)
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// US Military Aircraft tracking market data source.
///
/// Tracks individual US military aircraft positions and aggregate counts
/// using the OpenSky Network API.
/// Source ID is `"mil_aircraft"`.
pub struct MilAircraftMarketSource {
    http: SourceHttpClient,
    /// Cached aircraft states from last fetch (used by fetch_assets to generate dynamic assets)
    last_states: Mutex<Vec<MilAircraftState>>,
}

impl MilAircraftMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 6,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Military aircraft source initialized (OpenSky, ICAO AE0000-AFFFFF)");

        Ok(Self {
            http,
            last_states: Mutex::new(Vec::new()),
        })
    }

    /// Fetch all state vectors from OpenSky and filter to US military.
    async fn fetch_military_states(&self) -> Result<Vec<MilAircraftState>, crate::market_data::sources::error::SourceError> {
        let response: OpenSkyResponse = self.http.get_json(API_URL).await?;

        let states = response
            .states
            .unwrap_or_default()
            .iter()
            .filter_map(parse_state_vector)
            .collect::<Vec<_>>();

        debug!(
            "MilAircraft: {} military aircraft from global feed",
            states.len()
        );

        Ok(states)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for MilAircraftMarketSource {
    fn source_id(&self) -> &'static str {
        "mil_aircraft"
    }

    fn display_name(&self) -> &'static str {
        "Military Aircraft"
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
                max_requests: 6,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // Static assets from config JSON
        let mut assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "MilAircraft fetch_assets: {} static assets loaded",
            assets.len()
        );

        // Dynamic assets from last fetched state
        let cached = self.last_states.lock().unwrap().clone();
        if !cached.is_empty() {
            let dynamic = build_dynamic_assets(&cached);
            info!(
                "MilAircraft fetch_assets: {} dynamic aircraft assets",
                dynamic.len()
            );
            assets.extend(dynamic);
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // ONE API call to get global states, then filter
        let states = match self.fetch_military_states().await {
            Ok(s) => s,
            Err(e) => {
                warn!("MilAircraft: failed to fetch OpenSky states: {:?}", e);
                return Ok(Vec::new());
            }
        };

        info!(
            "MilAircraft: {} military aircraft found, computing prices for {} assets",
            states.len(),
            asset_ids.len()
        );

        // Update cached states for next fetch_assets call
        {
            let mut cached = self.last_states.lock().unwrap();
            *cached = states.clone();
        }

        // Compute aggregate metrics
        let aggregates = compute_aggregates(&states);

        // Load static config to get symbols
        let all_entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let symbol_map: HashMap<&str, &str> = all_entries
            .iter()
            .map(|e| (e.asset_id.as_str(), e.symbol.as_str()))
            .collect();

        let mut results = Vec::new();

        // Process aggregate asset requests
        for asset_id in asset_ids {
            if let Some(&value) = aggregates.get(asset_id.as_str()) {
                let symbol = symbol_map
                    .get(asset_id.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("MIL/{}", asset_id));

                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol,
                    value,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        // Process dynamic per-aircraft asset requests
        let dynamic_prices = build_dynamic_prices(&states, asset_ids, now);
        results.extend(dynamic_prices);

        info!(
            "MilAircraft: fetched {}/{} prices",
            results.len(),
            asset_ids.len()
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
    use crate::market_data::traits::load_all_asset_entries;

    // ========================================================================
    // ICAO filtering tests
    // ========================================================================

    #[test]
    fn test_is_us_military_valid() {
        assert!(is_us_military("ae0000")); // Start of range
        assert!(is_us_military("AE0000")); // Case insensitive
        assert!(is_us_military("afffff")); // End of range
        assert!(is_us_military("AFFFFF"));
        assert!(is_us_military("ae1234")); // Middle of range
        assert!(is_us_military("af5678"));
    }

    #[test]
    fn test_is_us_military_invalid() {
        assert!(!is_us_military("addfffff")); // Too long (not in range though)
        assert!(!is_us_military("a00000")); // Below range
        assert!(!is_us_military("b00000")); // Above range
        assert!(!is_us_military("adffff")); // Just below AE0000
        assert!(!is_us_military("")); // Empty
        assert!(!is_us_military("zzzzzz")); // Invalid hex
        assert!(!is_us_military("ae000")); // 5 chars (still valid hex, 0x0AE000 which is below range)
    }

    #[test]
    fn test_is_us_military_boundary() {
        // AE0000 = 11403264 decimal
        assert!(is_us_military("ae0000"));
        // AFFFFF = 11534335 decimal
        assert!(is_us_military("afffff"));
        // ADFFFF = one below start
        assert!(!is_us_military("adffff"));
        // B00000 = one above end
        assert!(!is_us_military("b00000"));
    }

    // ========================================================================
    // Region classification tests
    // ========================================================================

    #[test]
    fn test_classify_region_europe() {
        assert_eq!(classify_region(48.8566, 2.3522), "europe"); // Paris
        assert_eq!(classify_region(51.5074, -0.1278), "europe"); // London
        assert_eq!(classify_region(52.52, 13.405), "europe"); // Berlin
    }

    #[test]
    fn test_classify_region_mideast() {
        assert_eq!(classify_region(25.2048, 55.2708), "mideast"); // Dubai
        assert_eq!(classify_region(24.7136, 46.6753), "mideast"); // Riyadh
    }

    #[test]
    fn test_classify_region_pacific() {
        assert_eq!(classify_region(35.6762, 139.6503), "pacific"); // Tokyo
        assert_eq!(classify_region(21.3069, -157.8583), "pacific"); // Hawaii
        assert_eq!(classify_region(-33.8688, 151.2093), "pacific"); // Sydney
    }

    #[test]
    fn test_classify_region_conus() {
        assert_eq!(classify_region(38.8977, -77.0365), "conus"); // Washington DC
        assert_eq!(classify_region(34.0522, -118.2437), "conus"); // Los Angeles
        assert_eq!(classify_region(40.7128, -74.006), "conus"); // NYC
    }

    #[test]
    fn test_classify_region_other() {
        assert_eq!(classify_region(-34.6037, -58.3816), "other"); // Buenos Aires
        assert_eq!(classify_region(5.0, 10.0), "other"); // Gulf of Guinea (below Europe lat, below Mideast lat)
        assert_eq!(classify_region(75.0, 30.0), "other"); // Svalbard (above Europe lat range)
    }

    #[test]
    fn test_classify_region_overlap() {
        // Turkey (lat 39, lon 35) is in both Europe and Middle East bounding boxes
        // Europe check comes first, so it should be classified as Europe
        let region = classify_region(39.0, 35.0);
        assert_eq!(region, "europe");
    }

    // ========================================================================
    // State vector parsing tests
    // ========================================================================

    #[test]
    fn test_parse_state_vector_military() {
        let state = serde_json::json!([
            "ae1234",  // 0: icao24 (US military)
            "EVAC01 ", // 1: callsign (with trailing space)
            "United States", // 2: origin_country
            1234567890.0, // 3: time_position
            1234567890.0, // 4: last_contact
            -77.0365, // 5: longitude
            38.8977,  // 6: latitude
            10668.0,  // 7: baro_altitude
            false,    // 8: on_ground
            250.5,    // 9: velocity
            45.0,     // 10: true_track
            0.0,      // 11: vertical_rate
            null,     // 12: sensors
            10972.0,  // 13: geo_altitude
            "1234",   // 14: squawk
            false,    // 15: spi
            0         // 16: position_source
        ]);

        let parsed = parse_state_vector(&state).unwrap();
        assert_eq!(parsed.icao24, "ae1234");
        assert_eq!(parsed.callsign, "EVAC01");
        assert_eq!(parsed.latitude, Some(38.8977));
        assert_eq!(parsed.longitude, Some(-77.0365));
        assert_eq!(parsed.baro_altitude, Some(10668.0));
        assert!(!parsed.on_ground);
        assert_eq!(parsed.velocity, Some(250.5));
    }

    #[test]
    fn test_parse_state_vector_non_military() {
        let state = serde_json::json!([
            "a12345",  // Not in military range
            "UAL123",
            "United States",
            0.0, 0.0,
            -73.0, 40.0, 10000.0, false, 200.0,
            0.0, 0.0, null, 0.0, "1234", false, 0
        ]);

        assert!(parse_state_vector(&state).is_none());
    }

    #[test]
    fn test_parse_state_vector_null_fields() {
        let state = serde_json::json!([
            "ae5678",
            null,  // null callsign
            "United States",
            0.0, 0.0,
            null,  // null longitude
            null,  // null latitude
            null,  // null altitude
            true,  // on ground
            null,  // null velocity
            0.0, 0.0, null, 0.0, null, false, 0
        ]);

        let parsed = parse_state_vector(&state).unwrap();
        assert_eq!(parsed.icao24, "ae5678");
        assert_eq!(parsed.callsign, "");
        assert!(parsed.latitude.is_none());
        assert!(parsed.longitude.is_none());
        assert!(parsed.baro_altitude.is_none());
        assert!(parsed.on_ground);
        assert!(parsed.velocity.is_none());
    }

    #[test]
    fn test_parse_state_vector_too_short() {
        let state = serde_json::json!(["ae1234", "CALL", "US"]);
        assert!(parse_state_vector(&state).is_none());
    }

    // ========================================================================
    // Aggregate computation tests
    // ========================================================================

    #[test]
    fn test_compute_aggregates_basic() {
        let states = vec![
            MilAircraftState {
                icao24: "ae0001".to_string(),
                callsign: "EVAC01".to_string(),
                latitude: Some(38.9),
                longitude: Some(-77.0),
                baro_altitude: Some(10000.0),
                on_ground: false,
                velocity: Some(200.0),
            },
            MilAircraftState {
                icao24: "ae0002".to_string(),
                callsign: "EVAC02".to_string(),
                latitude: Some(48.8),
                longitude: Some(2.3),
                baro_altitude: Some(12000.0),
                on_ground: false,
                velocity: Some(300.0),
            },
            MilAircraftState {
                icao24: "ae0003".to_string(),
                callsign: "EVAC03".to_string(),
                latitude: Some(38.9),
                longitude: Some(-77.0),
                baro_altitude: None,
                on_ground: true,
                velocity: None,
            },
        ];

        let agg = compute_aggregates(&states);

        assert_eq!(agg["mil_us_active_total"], Decimal::from(3));
        assert_eq!(agg["mil_us_airborne"], Decimal::from(2));
        assert_eq!(agg["mil_us_ground"], Decimal::from(1));
        assert_eq!(agg["mil_us_conus"], Decimal::from(2)); // DC + ground DC
        assert_eq!(agg["mil_us_europe"], Decimal::from(1)); // Paris
        assert_eq!(agg["mil_us_mideast"], Decimal::from(0));
        assert_eq!(agg["mil_us_pacific"], Decimal::from(0));
        // Avg altitude: (10000 + 12000) / 2 = 11000
        assert_eq!(agg["mil_us_avg_altitude"], Decimal::from(11000));
        // Avg speed: (200 + 300) / 2 = 250
        assert_eq!(agg["mil_us_avg_speed"], Decimal::from(250));
    }

    #[test]
    fn test_compute_aggregates_empty() {
        let states: Vec<MilAircraftState> = vec![];
        let agg = compute_aggregates(&states);

        assert_eq!(agg["mil_us_active_total"], Decimal::from(0));
        assert_eq!(agg["mil_us_airborne"], Decimal::from(0));
        assert_eq!(agg["mil_us_ground"], Decimal::from(0));
        assert_eq!(agg["mil_us_avg_altitude"], Decimal::from(0));
        assert_eq!(agg["mil_us_avg_speed"], Decimal::from(0));
    }

    // ========================================================================
    // Dynamic asset generation tests
    // ========================================================================

    #[test]
    fn test_build_dynamic_assets_with_callsign() {
        let states = vec![MilAircraftState {
            icao24: "ae1234".to_string(),
            callsign: "EVAC01".to_string(),
            latitude: Some(38.9),
            longitude: Some(-77.0),
            baro_altitude: Some(10000.0),
            on_ground: false,
            velocity: Some(200.0),
        }];

        let assets = build_dynamic_assets(&states);
        assert_eq!(assets.len(), 3);

        assert_eq!(assets[0].asset_id, "mil_ae1234_lat");
        assert_eq!(assets[0].symbol, "MIL/EVAC01_LAT");
        assert_eq!(assets[0].name, "EVAC01 Latitude");

        assert_eq!(assets[1].asset_id, "mil_ae1234_lon");
        assert_eq!(assets[1].symbol, "MIL/EVAC01_LON");

        assert_eq!(assets[2].asset_id, "mil_ae1234_alt");
        assert_eq!(assets[2].symbol, "MIL/EVAC01_ALT");
    }

    #[test]
    fn test_build_dynamic_assets_no_callsign() {
        let states = vec![MilAircraftState {
            icao24: "ae5678".to_string(),
            callsign: "".to_string(),
            latitude: Some(40.0),
            longitude: Some(-74.0),
            baro_altitude: Some(5000.0),
            on_ground: false,
            velocity: Some(150.0),
        }];

        let assets = build_dynamic_assets(&states);
        assert_eq!(assets.len(), 3);

        // Falls back to ICAO hex in uppercase
        assert_eq!(assets[0].symbol, "MIL/AE5678_LAT");
        assert_eq!(assets[0].name, "AE5678 Latitude");
    }

    #[test]
    fn test_build_dynamic_assets_no_position() {
        let states = vec![MilAircraftState {
            icao24: "ae9999".to_string(),
            callsign: "NOPOS".to_string(),
            latitude: None,
            longitude: None,
            baro_altitude: None,
            on_ground: true,
            velocity: None,
        }];

        let assets = build_dynamic_assets(&states);
        assert!(assets.is_empty(), "Aircraft with no position should not generate assets");
    }

    // ========================================================================
    // Config tests
    // ========================================================================

    #[test]
    fn test_config_loads_9_entries() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 9, "Should have exactly 9 static aggregate assets");
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Asset {} should be active", entry.asset_id);
        }
    }

    #[test]
    fn test_all_entries_defense_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "defense",
                "Asset {} should have category 'defense'",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "aviation",
                "Asset {} should have subcategory 'aviation'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_mil() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("MIL/"),
                "Symbol '{}' should start with 'MIL/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), entries.len(), "All asset IDs should be unique");
    }

    #[test]
    fn test_unique_symbols() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut symbols: Vec<&str> = entries.iter().map(|e| e.symbol.as_str()).collect();
        symbols.sort();
        symbols.dedup();
        assert_eq!(symbols.len(), entries.len(), "All symbols should be unique");
    }

    #[test]
    fn test_load_assets_from_json() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 9);
        let total = assets
            .iter()
            .find(|a| a.asset_id == "mil_us_active_total")
            .unwrap();
        assert_eq!(total.symbol, "MIL/US_ACTIVE");
        assert_eq!(total.name, "US Military Aircraft Broadcasting");
        assert_eq!(total.category, Some("defense".to_string()));
    }

    // ========================================================================
    // Decimal conversion test
    // ========================================================================

    #[test]
    fn test_decimal_from_f64() {
        let val = decimal_from_f64(38.897700);
        assert_eq!(val, Decimal::from_str_exact("38.897700").unwrap());

        let zero = decimal_from_f64(0.0);
        assert_eq!(zero, Decimal::ZERO);
    }
}
