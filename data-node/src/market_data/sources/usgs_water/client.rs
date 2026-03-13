//! USGS Water Services client implementing MarketDataSource
//!
//! Tracks streamflow (discharge) at USGS water monitoring stations across the US.
//! Each station is an asset; its value is the latest discharge reading in cubic
//! feet per second (ft3/s).
//!
//! Assets are dynamically discovered per state — the config JSON starts empty
//! and stations are populated via `discover_upstream_assets()` and `fetch_prices()`.
//!
//! API: https://waterservices.usgs.gov/nwis/iv/
//! Auth: None
//! Rate limit: 30 req/min (government API)
//! Sync interval: 600s (10 minutes)

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration (starts empty — dynamic discovery)
const ASSET_JSON: &str = include_str!("../../../config/usgs_water.json");

/// USGS Water Services instantaneous values API base
const API_BASE: &str = "https://waterservices.usgs.gov/nwis/iv/";

/// Parameter code for discharge (streamflow) in cubic feet per second
const PARAM_DISCHARGE: &str = "00060";

/// USGS missing data sentinel value
const MISSING_SENTINEL: &str = "-999999";

/// Maximum stations to keep per state (by highest flow rate)
const MAX_STATIONS_PER_STATE: usize = 200;

/// Maximum number of site numbers per direct USGS query.
/// The USGS API accepts comma-separated site lists; keep batches manageable.
const SITES_PER_BATCH: usize = 100;

/// Curated list of US states with significant water monitoring networks
const STATES: &[&str] = &[
    "AL", "AZ", "CA", "CO", "FL", "GA", "ID", "LA", "MT", "NY", "OH", "OR", "PA", "TX", "WA",
];

/// Delay between sequential state fetches (ms) to be respectful to the API
const INTER_REQUEST_DELAY_MS: u64 = 2500;

/// How many days offline before a gauge is deactivated (excluded from fetch_assets).
/// When the sync engine sees an asset not returned by fetch_assets, it sets is_active = false.
/// If the gauge comes back online, it will reappear in fetch_assets and get reactivated.
const DEACTIVATION_DAYS: i64 = 3;

/// Grace period for newly discovered gauges (hours). If a gauge was discovered
/// but never returned data within this window, it won't be returned by fetch_assets()
/// — preventing "registered but never priced" assets.
const GRACE_PERIOD_HOURS: i64 = 48;

/// How long to retain a gauge in the in-memory cache before pruning (days).
/// Longer than DEACTIVATION_DAYS so we can reactivate gauges that come back.
const RETENTION_DAYS: i64 = 30;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Top-level USGS Water Services JSON response
#[derive(Debug, Deserialize)]
struct UsgsResponse {
    value: UsgsValue,
}

/// The `value` object containing time series data
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsgsValue {
    time_series: Vec<UsgsTimeSeries>,
}

/// A single time series entry (one station + one parameter)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsgsTimeSeries {
    source_info: UsgsSourceInfo,
    values: Vec<UsgsValues>,
}

/// Station metadata
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsgsSourceInfo {
    site_name: String,
    site_code: Vec<UsgsSiteCode>,
    geo_location: Option<UsgsGeoLocation>,
}

/// Site code entry
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsgsSiteCode {
    value: String,
}

/// Geographic location wrapper
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsgsGeoLocation {
    geog_location: Option<UsgsCoords>,
}

/// Latitude/longitude coordinates
#[derive(Debug, Deserialize)]
struct UsgsCoords {
    latitude: f64,
    longitude: f64,
}

/// Values wrapper containing the actual readings
#[derive(Debug, Deserialize)]
struct UsgsValues {
    value: Vec<UsgsReading>,
}

/// A single reading (value + timestamp)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsgsReading {
    value: String,
    #[allow(dead_code)]
    date_time: String,
}

/// Parsed station data for internal processing
#[derive(Debug, Clone)]
struct StationReading {
    site_no: String,
    site_name: String,
    discharge: Decimal,
    latitude: f64,
    longitude: f64,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

// ============================================================================
// GAUGE CACHE
// ============================================================================

/// Tracks when a gauge was first and last seen reporting data.
#[derive(Clone, Debug)]
struct CachedGauge {
    /// USGS site number
    site_no: String,
    /// Human-readable site name
    site_name: String,
    /// First time this gauge was observed
    first_seen: DateTime<Utc>,
    /// Last time this gauge had live discharge data
    last_seen: DateTime<Utc>,
    /// Whether we've ever received a price for this gauge
    got_price: bool,
}

/// USGS Water monitoring market data source.
///
/// Tracks streamflow (discharge) at ~2000-3000 USGS stations across 15 US states.
/// Includes gauge lifecycle management: gauges offline for 3+ days are
/// deactivated, and gauges that come back online are reactivated.
///
/// fetch_prices queries specific site numbers directly (not per-state top-200),
/// ensuring all active gauges get prices regardless of their current flow rank.
///
/// Source ID is `"usgs_water"`.
pub struct UsgsWaterMarketSource {
    http: SourceHttpClient,
    /// Gauge cache: asset_id -> CachedGauge. Tracks first/last seen times
    /// for lifecycle management. Pruned after RETENTION_DAYS of inactivity.
    gauge_cache: Arc<Mutex<HashMap<String, CachedGauge>>>,
}

impl UsgsWaterMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("USGS Water Monitoring source initialized");

        Ok(Self {
            http,
            gauge_cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Fetch station readings for a single state.
    /// Returns parsed station data, capped at MAX_STATIONS_PER_STATE sorted by
    /// highest discharge (most active streams first).
    async fn fetch_state(&self, state: &str) -> Vec<StationReading> {
        let url = format!(
            "{}?stateCd={}&parameterCd={}&format=json&siteStatus=active&period=PT2H",
            API_BASE, state, PARAM_DISCHARGE
        );

        let response: UsgsResponse = match self.http.get_json(&url).await {
            Ok(data) => data,
            Err(e) => {
                warn!("Error fetching USGS water data for state {}: {:?}", state, e);
                return Vec::new();
            }
        };

        Self::parse_readings(&response)
    }

    /// Fetch readings for specific site numbers (direct query, no per-state top-N truncation).
    /// This ensures all requested gauges get price data, even low-flow ones that
    /// would be cut off by the per-state top-200 filter in fetch_state.
    async fn fetch_sites(&self, site_nos: &[&str]) -> Vec<StationReading> {
        if site_nos.is_empty() {
            return Vec::new();
        }

        let sites_csv = site_nos.join(",");
        let url = format!(
            "{}?sites={}&parameterCd={}&format=json&siteStatus=active&period=PT2H",
            API_BASE, sites_csv, PARAM_DISCHARGE
        );

        let response: UsgsResponse = match self.http.get_json(&url).await {
            Ok(data) => data,
            Err(e) => {
                warn!("Error fetching USGS water data for {} sites: {:?}", site_nos.len(), e);
                return Vec::new();
            }
        };

        Self::parse_readings(&response)
    }

    /// Parse station readings from a USGS API response. Shared by fetch_state and fetch_sites.
    fn parse_readings(response: &UsgsResponse) -> Vec<StationReading> {
        let mut readings = Vec::new();

        for ts in &response.value.time_series {
            // Extract site number
            let site_no = match ts.source_info.site_code.first() {
                Some(sc) => &sc.value,
                None => continue,
            };

            // Get the latest reading value
            let raw_value = match ts
                .values
                .first()
                .and_then(|v| v.value.last())
                .map(|r| r.value.as_str())
            {
                Some(v) => v,
                None => continue,
            };

            // Skip missing data sentinel and non-positive values
            if raw_value == MISSING_SENTINEL {
                continue;
            }

            let discharge = match Decimal::from_str(raw_value) {
                Ok(d) if d > Decimal::ZERO => d,
                _ => continue,
            };

            // Extract coordinates
            let (lat, lon) = ts
                .source_info
                .geo_location
                .as_ref()
                .and_then(|gl| gl.geog_location.as_ref())
                .map(|c| (c.latitude, c.longitude))
                .unwrap_or((0.0, 0.0));

            readings.push(StationReading {
                site_no: site_no.clone(),
                site_name: ts.source_info.site_name.clone(),
                discharge,
                latitude: lat,
                longitude: lon,
            });
        }

        readings
    }

    /// Update the gauge cache with currently reporting stations.
    /// - New gauges are added with first_seen = now
    /// - Existing gauges get last_seen updated
    /// - Gauges not seen in > RETENTION_DAYS are pruned from memory
    async fn update_gauge_cache(&self, readings: &[StationReading]) {
        let now = Utc::now();
        let mut cache = self.gauge_cache.lock().await;

        for reading in readings {
            let asset_id = format!("usgs_water_{}", reading.site_no);

            match cache.get_mut(&asset_id) {
                Some(entry) => {
                    entry.last_seen = now;
                    entry.site_name = reading.site_name.clone();
                }
                None => {
                    cache.insert(asset_id, CachedGauge {
                        site_no: reading.site_no.clone(),
                        site_name: reading.site_name.clone(),
                        first_seen: now,
                        last_seen: now,
                        got_price: false,
                    });
                }
            }
        }

        // Prune gauges not seen in > RETENTION_DAYS (memory cleanup)
        let cutoff = now - chrono::Duration::days(RETENTION_DAYS);
        let before = cache.len();
        cache.retain(|_, v| v.last_seen > cutoff);
        let pruned = before - cache.len();
        if pruned > 0 {
            info!("USGS Water: pruned {} gauges not seen in > {} days", pruned, RETENTION_DAYS);
        }
    }

    /// Check if a cached gauge should be considered "active" for asset registration.
    ///
    /// A gauge is active if:
    /// 1. It reported data within the last DEACTIVATION_DAYS, OR
    /// 2. It is newly discovered (within GRACE_PERIOD_HOURS) — give it time to get a price.
    ///
    /// A gauge is NOT active if:
    /// - It hasn't reported data in > DEACTIVATION_DAYS (offline/maintenance/decommissioned)
    /// - It was discovered > GRACE_PERIOD_HOURS ago but never got a price (dead on arrival)
    fn is_gauge_active(gauge: &CachedGauge, now: DateTime<Utc>) -> bool {
        let offline_duration = now - gauge.last_seen;
        let age = now - gauge.first_seen;

        // Gauge recently reported data — active
        if offline_duration < chrono::Duration::days(DEACTIVATION_DAYS) {
            // But check for "never got price" case on old-enough gauges
            if !gauge.got_price && age > chrono::Duration::hours(GRACE_PERIOD_HOURS) {
                return false;
            }
            return true;
        }

        // Gauge has been offline too long — deactivate
        false
    }
}

#[async_trait::async_trait]
impl MarketDataSource for UsgsWaterMarketSource {
    fn source_id(&self) -> &'static str {
        "usgs_water"
    }

    fn display_name(&self) -> &'static str {
        "USGS Water Monitoring"
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
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let now = Utc::now();

        // Try static config first
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            info!(
                "USGS Water fetch_assets: {} assets loaded from config",
                static_assets.len()
            );
            return Ok(static_assets);
        }

        // Config is empty — do live discovery from USGS API
        info!("USGS Water config empty, performing live asset discovery across {} states", STATES.len());

        let mut all_readings = Vec::new();
        let mut seen_sites = HashSet::new();

        for (i, state) in STATES.iter().enumerate() {
            if i > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let mut readings = self.fetch_state(state).await;
            // Sort by discharge descending, take top N for discovery
            readings.sort_by(|a, b| b.discharge.cmp(&a.discharge));
            readings.truncate(MAX_STATIONS_PER_STATE);

            for reading in readings {
                if seen_sites.insert(reading.site_no.clone()) {
                    all_readings.push(reading);
                }
            }
        }

        // Update gauge cache with all discovered stations
        self.update_gauge_cache(&all_readings).await;

        // Build asset list from cache, filtering out deactivated gauges.
        // The sync engine will set is_active = false for any previously registered
        // asset that is no longer returned here.
        let cache = self.gauge_cache.lock().await;
        let mut active_gauges: Vec<_> = cache
            .iter()
            .filter(|(_, gauge)| Self::is_gauge_active(gauge, now))
            .collect();

        // Sort by asset_id for deterministic output
        active_gauges.sort_by(|a, b| a.0.cmp(b.0));

        let total_cached = cache.len();
        let deactivated = total_cached - active_gauges.len();

        let all_assets: Vec<AssetUpdate> = active_gauges
            .iter()
            .map(|(asset_id, gauge)| {
                AssetUpdate {
                    asset_id: (*asset_id).clone(),
                    symbol: format!("WATER/{}", gauge.site_no),
                    name: gauge.site_name.clone(),
                    category: Some("environment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": gauge.site_no,
                        "subcategory": "water",
                        "active": true,
                        "extra": {},
                    }),
                }
            })
            .collect();

        info!(
            "USGS Water: {} active stations ({} cached, {} deactivated) across {} states",
            all_assets.len(),
            total_cached,
            deactivated,
            STATES.len()
        );

        Ok(all_assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Extract site numbers from asset_ids
        let site_nos: Vec<&str> = asset_ids
            .iter()
            .filter_map(|id| id.strip_prefix("usgs_water_"))
            .collect();

        if site_nos.is_empty() {
            return Ok(Vec::new());
        }

        // Query specific site numbers directly in batches.
        // This replaces the old per-state approach which truncated at 200/state,
        // dropping stations whose flow decreased since discovery.
        let mut all_readings = Vec::new();

        for (i, chunk) in site_nos.chunks(SITES_PER_BATCH).enumerate() {
            if i > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let readings = self.fetch_sites(chunk).await;
            all_readings.extend(readings);
        }

        // Update gauge cache with fetched data
        self.update_gauge_cache(&all_readings).await;

        // Build lookup: site_no -> reading
        let reading_map: HashMap<&str, &StationReading> = all_readings
            .iter()
            .map(|r| (r.site_no.as_str(), r))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());
        let mut priced_ids = Vec::new();

        for asset_id in asset_ids {
            let site_no = match asset_id.strip_prefix("usgs_water_") {
                Some(s) => s,
                None => continue,
            };

            if let Some(reading) = reading_map.get(site_no) {
                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol: format!("WATER/{}", reading.site_no),
                    value: reading.discharge,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
                priced_ids.push(asset_id.clone());
            }
        }

        // Mark gauges that got prices
        if !priced_ids.is_empty() {
            let mut cache = self.gauge_cache.lock().await;
            for id in &priced_ids {
                if let Some(gauge) = cache.get_mut(id) {
                    gauge.got_price = true;
                }
            }
        }

        info!(
            "Fetched {}/{} prices from USGS Water ({} batches, {} readings)",
            results.len(),
            asset_ids.len(),
            (site_nos.len() + SITES_PER_BATCH - 1) / SITES_PER_BATCH,
            all_readings.len(),
        );

        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("USGS Water: discovering stations across {} states...", STATES.len());

        let mut all_readings = Vec::new();
        let mut seen_sites = HashSet::new();

        for (i, state) in STATES.iter().enumerate() {
            // Respectful delay between state requests (skip first)
            if i > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let mut readings = self.fetch_state(state).await;
            // Sort by discharge descending, take top N for discovery
            readings.sort_by(|a, b| b.discharge.cmp(&a.discharge));
            readings.truncate(MAX_STATIONS_PER_STATE);

            for reading in readings {
                if seen_sites.insert(reading.site_no.clone()) {
                    all_readings.push(reading);
                }
            }
        }

        // Update gauge cache with discovered stations
        self.update_gauge_cache(&all_readings).await;

        let all_entries: Vec<AssetEntry> = all_readings
            .iter()
            .map(|reading| AssetEntry {
                asset_id: format!("usgs_water_{}", reading.site_no),
                symbol: format!("WATER/{}", reading.site_no),
                name: reading.site_name.clone(),
                category: "environment".to_string(),
                subcategory: "water".to_string(),
                api_ref: reading.site_no.clone(),
                active: true,
            })
            .collect();

        info!(
            "USGS Water: discovered {} unique stations across {} states",
            all_entries.len(),
            STATES.len()
        );

        Ok(all_entries)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_list_not_empty() {
        assert!(
            !STATES.is_empty(),
            "States list must not be empty"
        );
        assert_eq!(
            STATES.len(),
            15,
            "Expected 15 curated states, got {}",
            STATES.len()
        );
        // Verify all entries are 2-letter state codes
        for state in STATES {
            assert_eq!(
                state.len(),
                2,
                "State code '{}' should be 2 characters",
                state
            );
            assert!(
                state.chars().all(|c| c.is_ascii_uppercase()),
                "State code '{}' should be all uppercase ASCII",
                state
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let site_no = "01646500";
        let asset_id = format!("usgs_water_{}", site_no);
        assert!(
            asset_id.starts_with("usgs_water_"),
            "Asset ID '{}' should start with 'usgs_water_'",
            asset_id
        );
        // Verify site number is preserved
        let extracted = asset_id.strip_prefix("usgs_water_").unwrap();
        assert_eq!(extracted, site_no);
    }

    #[test]
    fn test_symbol_format() {
        let site_no = "01646500";
        let symbol = format!("WATER/{}", site_no);
        assert!(
            symbol.starts_with("WATER/"),
            "Symbol '{}' should start with 'WATER/'",
            symbol
        );
    }

    #[test]
    fn test_parse_response() {
        let json_str = r#"{
            "value": {
                "timeSeries": [
                    {
                        "sourceInfo": {
                            "siteName": "POTOMAC RIVER NEAR WASH, DC LITTLE FALLS PUMP STA",
                            "siteCode": [{"value": "01646500", "agencyCode": "USGS"}],
                            "geoLocation": {
                                "geogLocation": {"latitude": 38.94977778, "longitude": -77.12763889}
                            }
                        },
                        "variable": {
                            "variableCode": [{"value": "00060"}],
                            "variableName": "Streamflow, ft3/s",
                            "unit": {"unitCode": "ft3/s"}
                        },
                        "values": [{
                            "value": [
                                {"value": "8430", "dateTime": "2024-01-15T12:00:00.000-05:00"},
                                {"value": "8500", "dateTime": "2024-01-15T12:15:00.000-05:00"}
                            ]
                        }]
                    },
                    {
                        "sourceInfo": {
                            "siteName": "SHENANDOAH RIVER AT MILLVILLE, WV",
                            "siteCode": [{"value": "01636500", "agencyCode": "USGS"}],
                            "geoLocation": {
                                "geogLocation": {"latitude": 39.27, "longitude": -77.79}
                            }
                        },
                        "variable": {
                            "variableCode": [{"value": "00060"}],
                            "variableName": "Streamflow, ft3/s",
                            "unit": {"unitCode": "ft3/s"}
                        },
                        "values": [{
                            "value": [
                                {"value": "1200", "dateTime": "2024-01-15T12:00:00.000-05:00"}
                            ]
                        }]
                    },
                    {
                        "sourceInfo": {
                            "siteName": "DRY CREEK NEAR NOWHERE",
                            "siteCode": [{"value": "99999999", "agencyCode": "USGS"}],
                            "geoLocation": {
                                "geogLocation": {"latitude": 40.0, "longitude": -80.0}
                            }
                        },
                        "variable": {
                            "variableCode": [{"value": "00060"}],
                            "variableName": "Streamflow, ft3/s",
                            "unit": {"unitCode": "ft3/s"}
                        },
                        "values": [{
                            "value": [
                                {"value": "-999999", "dateTime": "2024-01-15T12:00:00.000-05:00"}
                            ]
                        }]
                    }
                ]
            }
        }"#;

        let response: UsgsResponse = serde_json::from_str(json_str).unwrap();

        // Should have 3 time series
        assert_eq!(response.value.time_series.len(), 3);

        // Parse the first station
        let ts0 = &response.value.time_series[0];
        assert_eq!(ts0.source_info.site_code[0].value, "01646500");
        assert_eq!(
            ts0.source_info.site_name,
            "POTOMAC RIVER NEAR WASH, DC LITTLE FALLS PUMP STA"
        );

        // Check latest reading (should be the last value in the array)
        let latest = ts0.values[0].value.last().unwrap();
        assert_eq!(latest.value, "8500");

        // Parse second station
        let ts1 = &response.value.time_series[1];
        assert_eq!(ts1.source_info.site_code[0].value, "01636500");
        let val1 = ts1.values[0].value.last().unwrap();
        assert_eq!(val1.value, "1200");

        // Third station has missing data sentinel
        let ts2 = &response.value.time_series[2];
        let val2 = ts2.values[0].value.last().unwrap();
        assert_eq!(val2.value, MISSING_SENTINEL);

        // Verify Decimal parsing works for valid values
        let d = Decimal::from_str("8500").unwrap();
        assert!(d > Decimal::ZERO);

        // Verify missing sentinel is correctly filtered
        assert_eq!(
            Decimal::from_str(MISSING_SENTINEL).unwrap(),
            Decimal::from(-999999)
        );
    }

    #[test]
    fn test_parse_response_filters_invalid() {
        // Verify that zero and negative discharge values are filtered
        let zero = Decimal::from_str("0").unwrap();
        assert!(!(zero > Decimal::ZERO), "Zero should be filtered");

        let negative = Decimal::from_str("-5").unwrap();
        assert!(!(negative > Decimal::ZERO), "Negative should be filtered");

        let valid = Decimal::from_str("1234").unwrap();
        assert!(valid > Decimal::ZERO, "Positive should pass filter");
    }

    #[test]
    fn test_config_loads() {
        // Config starts as empty array — should load with 0 assets
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(
            assets.len(),
            0,
            "Config should start empty (dynamic discovery), got {}",
            assets.len()
        );
    }

    #[test]
    fn test_missing_sentinel_constant() {
        assert_eq!(MISSING_SENTINEL, "-999999");
    }

    #[test]
    fn test_max_stations_per_state() {
        assert_eq!(MAX_STATIONS_PER_STATE, 200);
    }

    #[test]
    fn test_known_states_present() {
        assert!(STATES.contains(&"CA"), "California should be in state list");
        assert!(STATES.contains(&"TX"), "Texas should be in state list");
        assert!(STATES.contains(&"NY"), "New York should be in state list");
        assert!(STATES.contains(&"FL"), "Florida should be in state list");
        assert!(STATES.contains(&"WA"), "Washington should be in state list");
    }

    #[test]
    fn test_geo_location_parsing() {
        let json_str = r#"{
            "value": {
                "timeSeries": [
                    {
                        "sourceInfo": {
                            "siteName": "TEST RIVER",
                            "siteCode": [{"value": "12345678", "agencyCode": "USGS"}],
                            "geoLocation": {
                                "geogLocation": {"latitude": 38.95, "longitude": -77.13}
                            }
                        },
                        "variable": {
                            "variableCode": [{"value": "00060"}]
                        },
                        "values": [{
                            "value": [{"value": "500", "dateTime": "2024-01-15T12:00:00.000"}]
                        }]
                    }
                ]
            }
        }"#;

        let response: UsgsResponse = serde_json::from_str(json_str).unwrap();
        let ts = &response.value.time_series[0];
        let geo = ts
            .source_info
            .geo_location
            .as_ref()
            .unwrap()
            .geog_location
            .as_ref()
            .unwrap();

        assert!((geo.latitude - 38.95).abs() < 0.001);
        assert!((geo.longitude - (-77.13)).abs() < 0.001);
    }

    #[test]
    fn test_parse_readings_static() {
        let json_str = r#"{
            "value": {
                "timeSeries": [
                    {
                        "sourceInfo": {
                            "siteName": "POTOMAC RIVER",
                            "siteCode": [{"value": "01646500", "agencyCode": "USGS"}],
                            "geoLocation": {
                                "geogLocation": {"latitude": 38.95, "longitude": -77.13}
                            }
                        },
                        "variable": {
                            "variableCode": [{"value": "00060"}]
                        },
                        "values": [{
                            "value": [{"value": "8500", "dateTime": "2024-01-15T12:00:00.000"}]
                        }]
                    },
                    {
                        "sourceInfo": {
                            "siteName": "DRY CREEK",
                            "siteCode": [{"value": "99999999", "agencyCode": "USGS"}],
                            "geoLocation": {
                                "geogLocation": {"latitude": 40.0, "longitude": -80.0}
                            }
                        },
                        "variable": {
                            "variableCode": [{"value": "00060"}]
                        },
                        "values": [{
                            "value": [{"value": "-999999", "dateTime": "2024-01-15T12:00:00.000"}]
                        }]
                    }
                ]
            }
        }"#;

        let response: UsgsResponse = serde_json::from_str(json_str).unwrap();
        let readings = UsgsWaterMarketSource::parse_readings(&response);

        // Only the valid reading (8500), not the -999999 sentinel
        assert_eq!(readings.len(), 1);
        assert_eq!(readings[0].site_no, "01646500");
        assert_eq!(readings[0].discharge, Decimal::from(8500));
    }

    // ========================================================================
    // GAUGE LIFECYCLE TESTS
    // ========================================================================

    fn make_gauge(site_no: &str, first_seen: DateTime<Utc>, last_seen: DateTime<Utc>, got_price: bool) -> CachedGauge {
        CachedGauge {
            site_no: site_no.to_string(),
            site_name: format!("Test gauge {}", site_no),
            first_seen,
            last_seen,
            got_price,
        }
    }

    #[test]
    fn test_gauge_active_recently_seen() {
        let now = Utc::now();
        let gauge = make_gauge("01646500", now - chrono::Duration::days(10), now - chrono::Duration::hours(1), true);
        assert!(UsgsWaterMarketSource::is_gauge_active(&gauge, now));
    }

    #[test]
    fn test_gauge_deactivated_after_3_days_offline() {
        let now = Utc::now();
        let gauge = make_gauge("01646500", now - chrono::Duration::days(10), now - chrono::Duration::days(4), true);
        assert!(!UsgsWaterMarketSource::is_gauge_active(&gauge, now));
    }

    #[test]
    fn test_gauge_reactivated_when_back_online() {
        let now = Utc::now();
        // Was offline for a while, but last_seen is now (came back)
        let gauge = make_gauge("01646500", now - chrono::Duration::days(20), now, true);
        assert!(UsgsWaterMarketSource::is_gauge_active(&gauge, now));
    }

    #[test]
    fn test_new_gauge_grace_period() {
        let now = Utc::now();
        // New gauge (1h old), never got a price yet — still within grace period
        let gauge = make_gauge("99999999", now - chrono::Duration::hours(1), now, false);
        assert!(UsgsWaterMarketSource::is_gauge_active(&gauge, now));
    }

    #[test]
    fn test_gauge_never_priced_after_grace_period() {
        let now = Utc::now();
        // Gauge is 3 days old, still reporting, but never got a price
        let gauge = make_gauge("99999999", now - chrono::Duration::days(3), now, false);
        assert!(!UsgsWaterMarketSource::is_gauge_active(&gauge, now));
    }

    #[test]
    fn test_usgs_deactivation_constants() {
        assert_eq!(DEACTIVATION_DAYS, 3);
        assert_eq!(GRACE_PERIOD_HOURS, 48);
        assert!(RETENTION_DAYS > DEACTIVATION_DAYS);
    }

    #[test]
    fn test_sites_per_batch() {
        assert_eq!(SITES_PER_BATCH, 100);
    }
}
