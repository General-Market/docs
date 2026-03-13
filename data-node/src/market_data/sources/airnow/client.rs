//! AirNow Air Quality Index (AQI) client implementing MarketDataSource
//!
//! Tracks real-time air quality data from AirNow/EPA.
//! Each reporting area (city/metro) is an asset; its value is the maximum
//! AQI across all measured pollutants (PM2.5, OZONE, PM10, etc.).
//!
//! **Data source**: https://files.airnowtech.org/airnow/today/reportingarea.dat
//! - Public pipe-delimited text file, no API key required
//! - Contains all US (and some international) reporting areas in a single file
//! - Updated hourly (~10-30 min past the hour)
//!
//! Previously used the bbox JSON API at www.airnowapi.org/aq/observation/current/1/
//! which now redirects to the documentation site (broken). Switched to the bulk
//! reportingarea.dat file which is more reliable and efficient (1 request vs 3).
//!
//! AQI scale:
//! - 0-50: Good
//! - 51-100: Moderate
//! - 101-150: Unhealthy for Sensitive Groups
//! - 151-200: Unhealthy
//! - 201-300: Very Unhealthy
//! - 301-500: Hazardous

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

// ============================================================================
// CONSTANTS
// ============================================================================

/// AirNow bulk data file URL — all reporting areas in one pipe-delimited file.
/// This replaces the broken bbox JSON API at www.airnowapi.org.
const DATA_URL: &str = "https://files.airnowtech.org/airnow/today/reportingarea.dat";

/// Maximum number of reporting areas to track
const MAX_AREAS: usize = 300;

/// How many days offline before a sensor is deactivated (excluded from fetch_assets).
/// When the sync engine sees an asset not returned by fetch_assets, it sets is_active = false.
/// If the sensor comes back online, it will reappear in fetch_assets and get reactivated.
const DEACTIVATION_DAYS: i64 = 3;

/// Grace period for newly discovered sensors (hours). If a sensor was discovered
/// but never returned data within this window, it won't be returned by fetch_assets()
/// — preventing "registered but never priced" assets.
const GRACE_PERIOD_HOURS: i64 = 48;

/// How long to retain a sensor in the in-memory cache before pruning (days).
/// Longer than DEACTIVATION_DAYS so we can reactivate sensors that come back.
const RETENTION_DAYS: i64 = 30;

// ============================================================================
// SENSOR CACHE
// ============================================================================

/// Tracks when a sensor was first and last seen reporting data.
#[derive(Clone, Debug)]
struct CachedSensor {
    /// Human-readable area name
    reporting_area: String,
    /// State code
    state_code: String,
    /// First time this sensor was observed
    first_seen: DateTime<Utc>,
    /// Last time this sensor had live data
    last_seen: DateTime<Utc>,
    /// Whether we've ever received a price for this sensor
    got_price: bool,
}

// ============================================================================
// PARSED OBSERVATION TYPE
// ============================================================================

/// A single observation parsed from the reportingarea.dat file.
/// Kept compatible with the old JSON-based AirnowObservation so that
/// group_observations and downstream logic remain unchanged.
#[derive(Debug, Clone)]
pub(crate) struct AirnowObservation {
    /// Reporting area name (e.g., "Washington")
    pub reporting_area: String,
    /// State code (e.g., "DC")
    pub state_code: String,
    /// Latitude
    pub latitude: f64,
    /// Longitude
    pub longitude: f64,
    /// Pollutant name (e.g., "PM2.5", "OZONE")
    pub parameter_name: String,
    /// AQI value (0-500)
    pub aqi: i32,
    /// AQI category name (e.g., "Good", "Moderate")
    pub category_name: String,
}

// ============================================================================
// PARSING
// ============================================================================

/// Parse the pipe-delimited reportingarea.dat file into observations.
///
/// File format (pipe-delimited, no header):
/// ```text
/// IssueDate|ValidDate|ValidTime|TimeZone|RecordSeq|DataType|Primary|ReportingArea|StateCode|Lat|Lon|Parameter|AQI|Category|ActionDay|Discussion|Agency
/// ```
///
/// We only keep rows where DataType == "O" (observed/current).
/// Forecast rows (DataType == "F") and yesterday rows ("Y") are skipped.
fn parse_reporting_area_dat(body: &str) -> Vec<AirnowObservation> {
    let mut observations = Vec::new();

    for (i, line) in body.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() < 14 {
            debug!("Skipping malformed AirNow line {}: too few columns ({})", i + 1, parts.len());
            continue;
        }

        // Column 5 (index 5): DataType — only keep "O" (observed)
        let data_type = parts[5].trim();
        if data_type != "O" {
            continue;
        }

        let reporting_area = parts[7].trim().to_string();
        let state_code = parts[8].trim().to_string();

        if reporting_area.is_empty() {
            continue;
        }

        let latitude = parts[9].trim().parse::<f64>().unwrap_or(0.0);
        let longitude = parts[10].trim().parse::<f64>().unwrap_or(0.0);
        let parameter_name = parts[11].trim().to_string();
        let aqi = match parts[12].trim().parse::<i32>() {
            Ok(v) => v,
            Err(_) => {
                debug!("Non-numeric AQI '{}' for {} on line {}", parts[12].trim(), reporting_area, i + 1);
                continue;
            }
        };
        let category_name = parts[13].trim().to_string();

        observations.push(AirnowObservation {
            reporting_area,
            state_code,
            latitude,
            longitude,
            parameter_name,
            aqi,
            category_name,
        });
    }

    observations
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
/// Includes sensor lifecycle management: sensors offline for 3+ days are
/// deactivated, and sensors that come back online are reactivated.
/// Source ID is `"airnow"`.
pub struct AirnowMarketSource {
    http: SourceHttpClient,
    /// Sensor cache: asset_id -> CachedSensor. Tracks first/last seen times
    /// for lifecycle management. Pruned after RETENTION_DAYS of inactivity.
    sensor_cache: Arc<Mutex<HashMap<String, CachedSensor>>>,
}

impl AirnowMarketSource {
    pub fn from_env() -> Result<Self> {
        // Note: AIRNOW_API_KEY is no longer required — the bulk file is public.
        // We log a notice if the env var is set (it's unused now).
        if std::env::var("AIRNOW_API_KEY").is_ok() {
            info!("AIRNOW_API_KEY is set but no longer needed — using public bulk data file");
        }

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("IndexDataNode/1.0 (contact: data@index.markets)")
            .build()?;

        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        info!("AirNow Air Quality source initialized (bulk file mode)");

        Ok(Self {
            http,
            sensor_cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Fetch all current observations from the bulk reportingarea.dat file.
    async fn fetch_all_observations(&self) -> Result<Vec<AirnowObservation>> {
        let body = self.http.get_raw(DATA_URL).await.map_err(|e| {
            anyhow::anyhow!("Failed to fetch AirNow reporting area data: {:?}", e)
        })?;

        let observations = parse_reporting_area_dat(&body);

        if observations.is_empty() {
            warn!("AirNow: reportingarea.dat returned 0 observed records — data may be stale");
        } else {
            debug!("AirNow: parsed {} observed records from reportingarea.dat", observations.len());
        }

        Ok(observations)
    }

    /// Update the sensor cache with currently reporting areas.
    /// - New sensors are added with first_seen = now
    /// - Existing sensors get last_seen updated
    /// - Sensors not seen in > RETENTION_DAYS are pruned from memory
    async fn update_sensor_cache(
        &self,
        area_map: &HashMap<String, (i32, String, String)>,
    ) {
        let now = Utc::now();
        let mut cache = self.sensor_cache.lock().await;

        for (key, (_aqi, reporting_area, state_code)) in area_map {
            match cache.get_mut(key) {
                Some(entry) => {
                    entry.last_seen = now;
                    entry.reporting_area = reporting_area.clone();
                    entry.state_code = state_code.clone();
                }
                None => {
                    cache.insert(key.clone(), CachedSensor {
                        reporting_area: reporting_area.clone(),
                        state_code: state_code.clone(),
                        first_seen: now,
                        last_seen: now,
                        got_price: false,
                    });
                }
            }
        }

        // Prune sensors not seen in > RETENTION_DAYS (memory cleanup)
        let cutoff = now - chrono::Duration::days(RETENTION_DAYS);
        let before = cache.len();
        cache.retain(|_, v| v.last_seen > cutoff);
        let pruned = before - cache.len();
        if pruned > 0 {
            info!("AirNow: pruned {} sensors not seen in > {} days", pruned, RETENTION_DAYS);
        }
    }

    /// Check if a cached sensor should be considered "active" for asset registration.
    ///
    /// A sensor is active if:
    /// 1. It was seen within the last DEACTIVATION_DAYS, OR
    /// 2. It is newly discovered (within GRACE_PERIOD_HOURS) — give it time to get a price.
    ///
    /// A sensor is NOT active if:
    /// - It hasn't reported data in > DEACTIVATION_DAYS (offline/maintenance/decommissioned)
    /// - It was discovered > GRACE_PERIOD_HOURS ago but never got a price (dead on arrival)
    fn is_sensor_active(sensor: &CachedSensor, now: DateTime<Utc>) -> bool {
        let offline_duration = now - sensor.last_seen;
        let age = now - sensor.first_seen;

        // Sensor recently reported data — active
        if offline_duration < chrono::Duration::days(DEACTIVATION_DAYS) {
            // But check for "never got price" case on old-enough sensors
            if !sensor.got_price && age > chrono::Duration::hours(GRACE_PERIOD_HOURS) {
                return false;
            }
            return true;
        }

        // Sensor has been offline too long — deactivate
        false
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
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let now = Utc::now();
        let observations = self.fetch_all_observations().await?;
        let area_map = group_observations(&observations);

        // Update sensor cache with live data
        self.update_sensor_cache(&area_map).await;

        // Build asset list from cache, filtering out deactivated sensors.
        // The sync engine will set is_active = false for any previously registered
        // asset that is no longer returned here.
        let cache = self.sensor_cache.lock().await;
        let mut active_sensors: Vec<_> = cache
            .iter()
            .filter(|(_, sensor)| Self::is_sensor_active(sensor, now))
            .collect();

        // Sort by key for deterministic output
        active_sensors.sort_by(|a, b| a.0.cmp(b.0));

        // Cap at MAX_AREAS
        active_sensors.truncate(MAX_AREAS);

        let total_cached = cache.len();
        let deactivated = total_cached - active_sensors.len();

        let assets: Vec<AssetUpdate> = active_sensors
            .iter()
            .map(|(key, sensor)| {
                let symbol = format!(
                    "AQI/{}/{}",
                    sensor.state_code.to_uppercase(),
                    sensor.reporting_area.to_uppercase().replace(' ', "_")
                );
                let name = format!("{}, {} AQI", sensor.reporting_area, sensor.state_code);

                AssetUpdate {
                    asset_id: (*key).clone(),
                    symbol,
                    name,
                    category: Some("environment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": key,
                        "subcategory": "air_quality",
                        "active": true,
                        "extra": {
                            "state_code": sensor.state_code,
                            "reporting_area": sensor.reporting_area,
                        },
                    }),
                }
            })
            .collect();

        info!(
            "AirNow fetch_assets: {} active reporting areas ({} cached, {} deactivated)",
            assets.len(),
            total_cached,
            deactivated,
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

        // Update sensor cache — sensors that have data are marked as alive
        self.update_sensor_cache(&area_map).await;

        let mut results = Vec::with_capacity(asset_ids.len());
        let mut priced_ids = Vec::new();

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
                priced_ids.push(asset_id.clone());
            } else {
                debug!("AirNow: no observation found for asset {}", asset_id);
            }
        }

        // Mark sensors that got prices
        if !priced_ids.is_empty() {
            let mut cache = self.sensor_cache.lock().await;
            for id in &priced_ids {
                if let Some(sensor) = cache.get_mut(id) {
                    sensor.got_price = true;
                }
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

    /// Sample reportingarea.dat content for testing.
    /// Format: IssueDate|ValidDate|ValidTime|TZ|RecordSeq|DataType|Primary|Area|State|Lat|Lon|Param|AQI|Category|ActionDay|Discussion|Agency
    const SAMPLE_DAT: &str = "\
02/24/26|02/24/26|17:00|EST|0|O|Y|Washington|DC|38.9190|-77.0130|PM2.5|55|Moderate|No||EPA
02/24/26|02/24/26|17:00|EST|0|O|N|Washington|DC|38.9190|-77.0130|OZONE|42|Good|No||EPA
02/24/26|02/24/26|14:00|PST|0|O|Y|Los Angeles|CA|34.0522|-118.2437|PM2.5|80|Moderate|No||SCAQMD
02/24/26|02/24/26|14:00|PST|0|O|N|Los Angeles|CA|34.0522|-118.2437|PM10|60|Moderate|No||SCAQMD
02/24/26|02/24/26|14:00|PST|0|O|N|Los Angeles|CA|34.0522|-118.2437|OZONE|70|Moderate|No||SCAQMD
02/24/26|02/23/26||CST|-1|Y|Y|Washington|DC|38.9190|-77.0130|PM2.5|45|Good|No||EPA
02/25/26|02/25/26||EST|1|F|Y|Washington|DC|38.9190|-77.0130|PM2.5|50|Good|No||EPA";

    /// Helper to create a test observation
    fn make_observation(
        reporting_area: &str,
        state_code: &str,
        parameter: &str,
        aqi: i32,
    ) -> AirnowObservation {
        AirnowObservation {
            reporting_area: reporting_area.to_string(),
            state_code: state_code.to_string(),
            latitude: 38.9,
            longitude: -77.0,
            parameter_name: parameter.to_string(),
            aqi,
            category_name: "Good".to_string(),
        }
    }

    #[test]
    fn test_parse_reporting_area_dat() {
        let observations = parse_reporting_area_dat(SAMPLE_DAT);

        // Should only include DataType=O rows (5 of them), not Y or F rows
        assert_eq!(observations.len(), 5);

        assert_eq!(observations[0].reporting_area, "Washington");
        assert_eq!(observations[0].state_code, "DC");
        assert_eq!(observations[0].parameter_name, "PM2.5");
        assert_eq!(observations[0].aqi, 55);
        assert_eq!(observations[0].category_name, "Moderate");

        assert_eq!(observations[1].reporting_area, "Washington");
        assert_eq!(observations[1].parameter_name, "OZONE");
        assert_eq!(observations[1].aqi, 42);

        assert_eq!(observations[2].reporting_area, "Los Angeles");
        assert_eq!(observations[2].state_code, "CA");
        assert_eq!(observations[2].parameter_name, "PM2.5");
        assert_eq!(observations[2].aqi, 80);
    }

    #[test]
    fn test_parse_filters_forecast_and_yesterday() {
        let observations = parse_reporting_area_dat(SAMPLE_DAT);

        // No forecast or yesterday rows
        for obs in &observations {
            // All should have valid AQI (we filtered non-O rows)
            assert!(obs.aqi >= 0);
        }

        // Exactly 5 observed rows
        assert_eq!(observations.len(), 5);
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
                reporting_area: format!("Area{}", i),
                state_code: "XX".to_string(),
                latitude: 38.9,
                longitude: -77.0,
                parameter_name: "PM2.5".to_string(),
                aqi: 50,
                category_name: "Moderate".to_string(),
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
    fn test_parse_malformed_lines() {
        let data = "\
02/24/26|02/24/26|17:00|EST|0|O|Y|Washington|DC|38.9|-77.0|PM2.5|55|Moderate|No||EPA
bad line without pipes
02/24/26|02/24/26|14:00|PST|0|O|Y|Seattle|WA|47.6|-122.3|OZONE|30|Good|No||PSCAA
02/24/26|02/24/26||EST|0|O|Y||DC|38.9|-77.0|PM2.5|40|Good|No||EPA";

        let observations = parse_reporting_area_dat(data);

        // "bad line" has too few columns -> skipped
        // Empty reporting area -> skipped
        assert_eq!(observations.len(), 2);
        assert_eq!(observations[0].reporting_area, "Washington");
        assert_eq!(observations[1].reporting_area, "Seattle");
    }

    #[test]
    fn test_parse_non_numeric_aqi() {
        let data = "\
02/24/26|02/24/26|17:00|EST|0|O|Y|Washington|DC|38.9|-77.0|PM2.5|N/A|Unknown|No||EPA
02/24/26|02/24/26|17:00|EST|0|O|Y|Seattle|WA|47.6|-122.3|PM2.5|42|Good|No||PSCAA";

        let observations = parse_reporting_area_dat(data);

        // "N/A" AQI -> skipped
        assert_eq!(observations.len(), 1);
        assert_eq!(observations[0].reporting_area, "Seattle");
    }

    #[test]
    fn test_parse_empty_body() {
        let observations = parse_reporting_area_dat("");
        assert!(observations.is_empty());
    }

    #[test]
    fn test_grouped_from_dat_sample() {
        let observations = parse_reporting_area_dat(SAMPLE_DAT);
        let area_map = group_observations(&observations);

        // Should have Washington DC and Los Angeles CA
        assert_eq!(area_map.len(), 2);

        // Washington: max(55 PM2.5, 42 OZONE) = 55
        let (max_aqi, _, _) = area_map.get("airnow_dc_washington").unwrap();
        assert_eq!(*max_aqi, 55);

        // Los Angeles: max(80 PM2.5, 60 PM10, 70 OZONE) = 80
        let (max_aqi, _, _) = area_map.get("airnow_ca_los_angeles").unwrap();
        assert_eq!(*max_aqi, 80);
    }

    // ========================================================================
    // SENSOR LIFECYCLE TESTS
    // ========================================================================

    fn make_sensor(reporting_area: &str, state_code: &str, first_seen: DateTime<Utc>, last_seen: DateTime<Utc>, got_price: bool) -> CachedSensor {
        CachedSensor {
            reporting_area: reporting_area.to_string(),
            state_code: state_code.to_string(),
            first_seen,
            last_seen,
            got_price,
        }
    }

    #[test]
    fn test_sensor_active_recently_seen() {
        let now = Utc::now();
        let sensor = make_sensor("Washington", "DC", now - chrono::Duration::days(10), now - chrono::Duration::hours(1), true);
        assert!(AirnowMarketSource::is_sensor_active(&sensor, now));
    }

    #[test]
    fn test_sensor_deactivated_after_3_days_offline() {
        let now = Utc::now();
        let sensor = make_sensor("Washington", "DC", now - chrono::Duration::days(10), now - chrono::Duration::days(4), true);
        assert!(!AirnowMarketSource::is_sensor_active(&sensor, now));
    }

    #[test]
    fn test_sensor_reactivated_when_back_online() {
        let now = Utc::now();
        // Was offline for 5 days, but last_seen is now (came back)
        let sensor = make_sensor("Washington", "DC", now - chrono::Duration::days(20), now, true);
        assert!(AirnowMarketSource::is_sensor_active(&sensor, now));
    }

    #[test]
    fn test_new_sensor_grace_period() {
        let now = Utc::now();
        // New sensor (1h old), never got a price yet — still within grace period
        let sensor = make_sensor("NewCity", "XX", now - chrono::Duration::hours(1), now, false);
        assert!(AirnowMarketSource::is_sensor_active(&sensor, now));
    }

    #[test]
    fn test_sensor_never_priced_after_grace_period() {
        let now = Utc::now();
        // Sensor is 3 days old, still reporting, but never got a price
        let sensor = make_sensor("DeadSensor", "XX", now - chrono::Duration::days(3), now, false);
        assert!(!AirnowMarketSource::is_sensor_active(&sensor, now));
    }

    #[test]
    fn test_deactivation_constants() {
        assert_eq!(DEACTIVATION_DAYS, 3);
        assert_eq!(GRACE_PERIOD_HOURS, 48);
        assert!(RETENTION_DAYS > DEACTIVATION_DAYS);
    }
}
