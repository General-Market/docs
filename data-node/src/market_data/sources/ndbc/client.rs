//! NDBC (National Data Buoy Center) ocean buoy client implementing MarketDataSource
//!
//! Tracks significant wave height (WVHT) for NDBC ocean buoys across US coastal waters.
//!
//! Each buoy station is an asset; its primary value is significant wave height in meters.
//! Data is whitespace-delimited text updated hourly (~25 past the hour).
//!
//! Assets are dynamic — parsed from the bulk observation file itself (no static config JSON).
//!
//! API: https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt
//! Auth: None
//! Rate limit: 10 req/min (conservative; it's a static file)

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// NDBC latest observations bulk file URL
const DATA_URL: &str = "https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt";

/// Maximum number of stations to track
const MAX_STATIONS: usize = 500;

/// How many days offline before a buoy is deactivated (excluded from fetch_assets).
/// When the sync engine sees an asset not returned by fetch_assets, it sets is_active = false.
/// If the buoy comes back online, it will reappear in fetch_assets and get reactivated.
const DEACTIVATION_DAYS: i64 = 3;

/// Grace period for newly discovered buoys (hours). If a buoy was discovered
/// but never returned data within this window, it won't be returned by fetch_assets()
/// — preventing "registered but never priced" assets.
const GRACE_PERIOD_HOURS: i64 = 48;

/// How long to retain a buoy in the in-memory cache before pruning (days).
/// Longer than DEACTIVATION_DAYS so we can reactivate buoys that come back.
const RETENTION_DAYS: i64 = 30;

// ============================================================================
// COLUMN INDICES (0-based) in the NDBC latest_obs.txt file
// ============================================================================
// #STN  LAT   LON   YYYY MM DD hh mm  WDIR WSPD GST  WVHT DPD  APD  MWD  PRES  ATMP  WTMP DEWP VIS  PTDY TIDE
//  0     1     2     3    4  5  6  7    8    9   10   11   12   13   14   15    16    17   18   19   20   21

const COL_STN: usize = 0;
const COL_WSPD: usize = 9;
const COL_WVHT: usize = 11;
const COL_PRES: usize = 15;
const COL_ATMP: usize = 16;
const COL_WTMP: usize = 17;

/// Minimum number of columns expected in a valid data line
const MIN_COLUMNS: usize = 18;

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

// ============================================================================
// BUOY CACHE
// ============================================================================

/// Tracks when a buoy was first and last seen reporting data.
#[derive(Clone, Debug)]
struct CachedBuoy {
    /// Station identifier
    station_id: String,
    /// First time this buoy was observed
    first_seen: DateTime<Utc>,
    /// Last time this buoy had live wave data
    last_seen: DateTime<Utc>,
    /// Whether we've ever received a price for this buoy
    got_price: bool,
    /// Whether the station has wave height data (vs only wind/temp)
    has_wvht: bool,
}

/// NDBC Ocean Buoys market data source.
///
/// Tracks significant wave height for NDBC buoy stations.
/// Includes buoy lifecycle management: buoys offline for 3+ days are
/// deactivated, and buoys that come back online are reactivated.
/// Source ID is `"ndbc"`.
pub struct NdbcMarketSource {
    http: SourceHttpClient,
    /// Buoy cache: asset_id -> CachedBuoy. Tracks first/last seen times
    /// for lifecycle management. Pruned after RETENTION_DAYS of inactivity.
    buoy_cache: Arc<Mutex<HashMap<String, CachedBuoy>>>,
}

impl NdbcMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("NDBC Ocean Buoys source initialized");

        Ok(Self {
            http,
            buoy_cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Update the buoy cache with currently reporting stations.
    /// - New buoys are added with first_seen = now
    /// - Existing buoys get last_seen updated
    /// - Buoys not seen in > RETENTION_DAYS are pruned from memory
    async fn update_buoy_cache(&self, stations: &[NdbcStation]) {
        let now = Utc::now();
        let mut cache = self.buoy_cache.lock().await;

        for station in stations {
            let asset_id = format_asset_id(&station.station_id);
            let has_wvht = station.wvht.is_some();

            match cache.get_mut(&asset_id) {
                Some(entry) => {
                    if has_wvht {
                        entry.last_seen = now;
                        entry.has_wvht = true;
                    }
                }
                None => {
                    if has_wvht {
                        cache.insert(asset_id, CachedBuoy {
                            station_id: station.station_id.clone(),
                            first_seen: now,
                            last_seen: now,
                            got_price: false,
                            has_wvht: true,
                        });
                    }
                }
            }
        }

        // Prune buoys not seen in > RETENTION_DAYS (memory cleanup)
        let cutoff = now - chrono::Duration::days(RETENTION_DAYS);
        let before = cache.len();
        cache.retain(|_, v| v.last_seen > cutoff);
        let pruned = before - cache.len();
        if pruned > 0 {
            info!("NDBC: pruned {} buoys not seen in > {} days", pruned, RETENTION_DAYS);
        }
    }

    /// Check if a cached buoy should be considered "active" for asset registration.
    ///
    /// A buoy is active if:
    /// 1. It had wave data within the last DEACTIVATION_DAYS, OR
    /// 2. It is newly discovered (within GRACE_PERIOD_HOURS) — give it time to get a price.
    ///
    /// A buoy is NOT active if:
    /// - It hasn't reported wave data in > DEACTIVATION_DAYS (offline/maintenance)
    /// - It was discovered > GRACE_PERIOD_HOURS ago but never got a price (dead on arrival)
    fn is_buoy_active(buoy: &CachedBuoy, now: DateTime<Utc>) -> bool {
        let offline_duration = now - buoy.last_seen;
        let age = now - buoy.first_seen;

        // Buoy recently reported data — active
        if offline_duration < chrono::Duration::days(DEACTIVATION_DAYS) {
            // But check for "never got price" case on old-enough buoys
            if !buoy.got_price && age > chrono::Duration::hours(GRACE_PERIOD_HOURS) {
                return false;
            }
            return true;
        }

        // Buoy has been offline too long — deactivate
        false
    }
}

#[async_trait::async_trait]
impl MarketDataSource for NdbcMarketSource {
    fn source_id(&self) -> &'static str {
        "ndbc"
    }

    fn display_name(&self) -> &'static str {
        "NDBC Ocean Buoys"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes — data updates hourly
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
        let body = self.http.get_raw(DATA_URL).await?;
        let stations = parse_ndbc_data(&body);

        // Update buoy cache with live data
        self.update_buoy_cache(&stations).await;

        // Build asset list from cache, filtering out deactivated buoys.
        // The sync engine will set is_active = false for any previously registered
        // asset that is no longer returned here.
        let cache = self.buoy_cache.lock().await;
        let mut active_buoys: Vec<_> = cache
            .iter()
            .filter(|(_, buoy)| Self::is_buoy_active(buoy, now))
            .collect();

        // Sort by asset_id for deterministic ordering
        active_buoys.sort_by(|a, b| a.0.cmp(b.0));
        active_buoys.truncate(MAX_STATIONS);

        let total_cached = cache.len();
        let deactivated = total_cached - active_buoys.len();

        let assets: Vec<AssetUpdate> = active_buoys
            .iter()
            .map(|(asset_id, buoy)| {
                let symbol = format!("NDBC/{}", buoy.station_id.to_uppercase());
                let name = format!("Buoy {}: Wave Ht", buoy.station_id);

                AssetUpdate {
                    asset_id: (*asset_id).clone(),
                    symbol,
                    name,
                    category: Some("environment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": buoy.station_id,
                        "subcategory": "ocean",
                        "active": true,
                        "extra": {
                            "has_wvht": buoy.has_wvht,
                        },
                    }),
                }
            })
            .collect();

        info!(
            "NDBC fetch_assets: {} active buoys ({} cached, {} deactivated, {} total in data)",
            assets.len(),
            total_cached,
            deactivated,
            stations.len(),
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        let body = self.http.get_raw(DATA_URL).await?;
        let stations = parse_ndbc_data(&body);

        // Update buoy cache with live data
        self.update_buoy_cache(&stations).await;

        // Build lookup: asset_id -> station data
        let station_map: HashMap<String, &NdbcStation> = stations
            .iter()
            .map(|s| (format_asset_id(&s.station_id), s))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());
        let mut priced_ids = Vec::new();

        for asset_id in asset_ids {
            if let Some(station) = station_map.get(asset_id) {
                // Use WVHT as primary value; skip station if no wave data
                if let Some(wvht) = station.wvht {
                    let station_key = asset_id
                        .strip_prefix("ndbc_")
                        .unwrap_or(asset_id);
                    let symbol = format!("NDBC/{}", station_key.to_uppercase());

                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol,
                        value: wvht,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                    priced_ids.push(asset_id.clone());
                }
            } else {
                debug!("NDBC station not found in latest data: {}", asset_id);
            }
        }

        // Mark buoys that got prices
        if !priced_ids.is_empty() {
            let mut cache = self.buoy_cache.lock().await;
            for id in &priced_ids {
                if let Some(buoy) = cache.get_mut(id) {
                    buoy.got_price = true;
                }
            }
        }

        info!(
            "Fetched {}/{} prices from NDBC ({} stations in data)",
            results.len(),
            asset_ids.len(),
            stations.len()
        );

        Ok(results)
    }
}

// ============================================================================
// DATA PARSING
// ============================================================================

/// A parsed station observation from the NDBC latest_obs.txt file
#[derive(Debug, Clone)]
struct NdbcStation {
    /// Station identifier (e.g., "41001", "ALSN6")
    station_id: String,
    /// Significant wave height in meters
    wvht: Option<Decimal>,
    /// Wind speed in m/s
    wspd: Option<Decimal>,
    /// Water temperature in degrees C
    wtmp: Option<Decimal>,
    /// Air temperature in degrees C
    atmp: Option<Decimal>,
    /// Sea level pressure in hPa
    pres: Option<Decimal>,
}

/// Parse the whitespace-delimited NDBC latest observations text file.
///
/// Expected format:
/// ```text
/// #STN     LAT      LON      YYYY MM DD hh mm  WDIR  WSPD  GST   WVHT  DPD   APD   MWD   PRES   ATMP   WTMP  DEWP  VIS   PTDY  TIDE
/// #text    deg      deg      yr   mo da hr mn   degT  m/s   m/s   m     sec   sec   degT  hPa    degC   degC  degC  nmi   hPa   ft
/// 41001   34.700  -72.700   2024 01 15 12 00    200   5.0   7.0   1.5   8.0   5.5   190  1015.0  15.0   20.0  10.0  MM    MM    MM
/// ```
///
/// Lines starting with `#` are headers and are skipped.
/// "MM" indicates missing data for a field.
fn parse_ndbc_data(body: &str) -> Vec<NdbcStation> {
    let mut stations = Vec::new();

    for (i, line) in body.lines().enumerate() {
        let line = line.trim();

        // Skip empty lines and header lines (start with #)
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let cols: Vec<&str> = line.split_whitespace().collect();

        if cols.len() < MIN_COLUMNS {
            debug!(
                "Skipping NDBC line {} with only {} columns (need {}): '{}'",
                i + 1,
                cols.len(),
                MIN_COLUMNS,
                if line.len() > 80 { &line[..80] } else { line }
            );
            continue;
        }

        let station_id = cols[COL_STN].to_string();

        if station_id.is_empty() {
            debug!("Skipping NDBC line {} with empty station ID", i + 1);
            continue;
        }

        let wvht = parse_ndbc_value(cols[COL_WVHT]);
        let wspd = parse_ndbc_value(cols[COL_WSPD]);
        let wtmp = parse_ndbc_value(cols[COL_WTMP]);
        let atmp = parse_ndbc_value(cols[COL_ATMP]);
        let pres = parse_ndbc_value(cols[COL_PRES]);

        stations.push(NdbcStation {
            station_id,
            wvht,
            wspd,
            wtmp,
            atmp,
            pres,
        });
    }

    stations
}

/// Parse a single NDBC value field.
/// Returns None for "MM" (missing) or unparseable values.
fn parse_ndbc_value(s: &str) -> Option<Decimal> {
    if s == "MM" || s.is_empty() {
        return None;
    }
    match Decimal::from_str(s) {
        Ok(val) => Some(val),
        Err(_) => {
            debug!("Non-numeric NDBC value: '{}'", s);
            None
        }
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Format a station ID into an asset_id.
///
/// - Prefix with "ndbc_"
/// - Lowercase
///
/// Examples:
/// - "41001" -> "ndbc_41001"
/// - "ALSN6" -> "ndbc_alsn6"
fn format_asset_id(station_id: &str) -> String {
    format!("ndbc_{}", station_id.to_lowercase())
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_DATA: &str = "\
#STN     LAT      LON      YYYY MM DD hh mm  WDIR  WSPD  GST   WVHT  DPD   APD   MWD   PRES   ATMP   WTMP  DEWP  VIS   PTDY  TIDE
#text    deg      deg      yr   mo da hr mn   degT  m/s   m/s   m     sec   sec   degT  hPa    degC   degC  degC  nmi   hPa   ft
41001   34.700  -72.700   2024 01 15 12 00    200   5.0   7.0   1.5   8.0   5.5   190  1015.0  15.0   20.0  10.0  MM    MM    MM
41002   32.300  -75.200   2024 01 15 12 00    180   3.0   5.0   2.3   9.0   6.1   200  1013.5  14.5   19.5   9.0  MM    MM    MM
ALSN6   40.467  -73.764   2024 01 15 12 00    220   8.0  10.0   MM    MM    MM    MM   1010.0  12.0   MM     8.5  MM    MM    MM
44025   40.251  -73.164   2024 01 15 12 00    210   6.5   9.0   0.8   7.0   4.5   195  1012.0  13.0   18.0   9.5  MM    MM    MM";

    #[test]
    fn test_parse_ndbc_data_basic() {
        let stations = parse_ndbc_data(SAMPLE_DATA);
        assert_eq!(stations.len(), 4, "Expected 4 station rows (headers skipped)");

        // First station: 41001
        assert_eq!(stations[0].station_id, "41001");
        assert_eq!(
            stations[0].wvht,
            Some(Decimal::from_str("1.5").unwrap())
        );
        assert_eq!(
            stations[0].wspd,
            Some(Decimal::from_str("5.0").unwrap())
        );
        assert_eq!(
            stations[0].wtmp,
            Some(Decimal::from_str("20.0").unwrap())
        );
        assert_eq!(
            stations[0].atmp,
            Some(Decimal::from_str("15.0").unwrap())
        );
        assert_eq!(
            stations[0].pres,
            Some(Decimal::from_str("1015.0").unwrap())
        );

        // Second station: 41002
        assert_eq!(stations[1].station_id, "41002");
        assert_eq!(
            stations[1].wvht,
            Some(Decimal::from_str("2.3").unwrap())
        );
    }

    #[test]
    fn test_missing_mm_values() {
        let stations = parse_ndbc_data(SAMPLE_DATA);

        // ALSN6 has MM for WVHT, DPD, APD, MWD, WTMP
        let alsn6 = &stations[2];
        assert_eq!(alsn6.station_id, "ALSN6");
        assert_eq!(alsn6.wvht, None, "WVHT should be None for MM");
        assert_eq!(alsn6.wtmp, None, "WTMP should be None for MM");
        // But WSPD, ATMP, PRES should be present
        assert_eq!(
            alsn6.wspd,
            Some(Decimal::from_str("8.0").unwrap())
        );
        assert_eq!(
            alsn6.atmp,
            Some(Decimal::from_str("12.0").unwrap())
        );
        assert_eq!(
            alsn6.pres,
            Some(Decimal::from_str("1010.0").unwrap())
        );
    }

    #[test]
    fn test_station_id_extraction() {
        let stations = parse_ndbc_data(SAMPLE_DATA);

        let ids: Vec<&str> = stations.iter().map(|s| s.station_id.as_str()).collect();
        assert_eq!(ids, vec!["41001", "41002", "ALSN6", "44025"]);
    }

    #[test]
    fn test_asset_id_formatting() {
        assert_eq!(format_asset_id("41001"), "ndbc_41001");
        assert_eq!(format_asset_id("ALSN6"), "ndbc_alsn6");
        assert_eq!(format_asset_id("44025"), "ndbc_44025");
        assert_eq!(format_asset_id("KTNF1"), "ndbc_ktnf1");
    }

    #[test]
    fn test_asset_id_always_lowercase() {
        let stations = parse_ndbc_data(SAMPLE_DATA);
        for station in &stations {
            let asset_id = format_asset_id(&station.station_id);
            assert!(
                asset_id.starts_with("ndbc_"),
                "Asset ID '{}' should start with 'ndbc_'",
                asset_id
            );
            assert_eq!(
                asset_id,
                asset_id.to_lowercase(),
                "Asset ID '{}' should be all lowercase",
                asset_id
            );
        }
    }

    #[test]
    fn test_multiple_stations_in_file() {
        let stations = parse_ndbc_data(SAMPLE_DATA);
        assert_eq!(stations.len(), 4);

        // Verify each has unique station ID
        let mut ids: Vec<String> = stations.iter().map(|s| s.station_id.clone()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 4, "All station IDs should be unique");
    }

    #[test]
    fn test_empty_file() {
        let data = "";
        let stations = parse_ndbc_data(data);
        assert!(stations.is_empty(), "Empty file should produce no stations");
    }

    #[test]
    fn test_header_only_file() {
        let data = "\
#STN     LAT      LON      YYYY MM DD hh mm  WDIR  WSPD  GST   WVHT  DPD   APD   MWD   PRES   ATMP   WTMP  DEWP  VIS   PTDY  TIDE
#text    deg      deg      yr   mo da hr mn   degT  m/s   m/s   m     sec   sec   degT  hPa    degC   degC  degC  nmi   hPa   ft
";
        let stations = parse_ndbc_data(data);
        assert!(
            stations.is_empty(),
            "Header-only file should produce no stations"
        );
    }

    #[test]
    fn test_parse_ndbc_value_valid() {
        assert_eq!(
            parse_ndbc_value("1.5"),
            Some(Decimal::from_str("1.5").unwrap())
        );
        assert_eq!(
            parse_ndbc_value("0.0"),
            Some(Decimal::from_str("0.0").unwrap())
        );
        assert_eq!(
            parse_ndbc_value("1015.0"),
            Some(Decimal::from_str("1015.0").unwrap())
        );
        assert_eq!(
            parse_ndbc_value("100"),
            Some(Decimal::from_str("100").unwrap())
        );
    }

    #[test]
    fn test_parse_ndbc_value_missing() {
        assert_eq!(parse_ndbc_value("MM"), None);
        assert_eq!(parse_ndbc_value(""), None);
    }

    #[test]
    fn test_parse_ndbc_value_invalid() {
        assert_eq!(parse_ndbc_value("N/A"), None);
        assert_eq!(parse_ndbc_value("abc"), None);
        assert_eq!(parse_ndbc_value("--"), None);
    }

    #[test]
    fn test_skips_short_lines() {
        let data = "\
#STN     LAT      LON      YYYY MM DD hh mm  WDIR  WSPD  GST   WVHT  DPD   APD   MWD   PRES   ATMP   WTMP  DEWP  VIS   PTDY  TIDE
#text    deg      deg      yr   mo da hr mn   degT  m/s   m/s   m     sec   sec   degT  hPa    degC   degC  degC  nmi   hPa   ft
41001   34.700  -72.700   2024 01 15 12 00    200   5.0   7.0   1.5   8.0   5.5   190  1015.0  15.0   20.0  10.0  MM    MM    MM
short line with few cols
41002   32.300";

        let stations = parse_ndbc_data(data);
        assert_eq!(
            stations.len(),
            1,
            "Only the complete line should be parsed"
        );
        assert_eq!(stations[0].station_id, "41001");
    }

    #[test]
    fn test_filters_stations_with_wave_data() {
        let stations = parse_ndbc_data(SAMPLE_DATA);

        let with_waves: Vec<&NdbcStation> = stations
            .iter()
            .filter(|s| s.wvht.is_some())
            .collect();

        // ALSN6 has MM for WVHT, so only 3 stations have wave data
        assert_eq!(with_waves.len(), 3);
        assert!(!with_waves.iter().any(|s| s.station_id == "ALSN6"));
    }

    #[test]
    fn test_asset_update_fields() {
        let station = NdbcStation {
            station_id: "41001".to_string(),
            wvht: Some(Decimal::from_str("1.5").unwrap()),
            wspd: Some(Decimal::from_str("5.0").unwrap()),
            wtmp: Some(Decimal::from_str("20.0").unwrap()),
            atmp: Some(Decimal::from_str("15.0").unwrap()),
            pres: Some(Decimal::from_str("1015.0").unwrap()),
        };

        let asset_id = format_asset_id(&station.station_id);
        let symbol = format!("NDBC/{}", station.station_id.to_uppercase());
        let name = format!("Buoy {}: Wave Ht", station.station_id);

        assert_eq!(asset_id, "ndbc_41001");
        assert_eq!(symbol, "NDBC/41001");
        assert_eq!(name, "Buoy 41001: Wave Ht");
    }

    #[test]
    fn test_asset_update_for_alpha_station() {
        let station_id = "ALSN6";
        let asset_id = format_asset_id(station_id);
        let symbol = format!("NDBC/{}", station_id.to_uppercase());

        assert_eq!(asset_id, "ndbc_alsn6");
        assert_eq!(symbol, "NDBC/ALSN6");
    }

    #[test]
    fn test_all_mm_station() {
        let data = "\
#STN     LAT      LON      YYYY MM DD hh mm  WDIR  WSPD  GST   WVHT  DPD   APD   MWD   PRES   ATMP   WTMP  DEWP  VIS   PTDY  TIDE
#text    deg      deg      yr   mo da hr mn   degT  m/s   m/s   m     sec   sec   degT  hPa    degC   degC  degC  nmi   hPa   ft
99999   0.000    0.000    2024 01 15 12 00    MM    MM    MM    MM    MM    MM    MM    MM     MM     MM    MM   MM    MM    MM";

        let stations = parse_ndbc_data(data);
        assert_eq!(stations.len(), 1);
        assert_eq!(stations[0].station_id, "99999");
        assert_eq!(stations[0].wvht, None);
        assert_eq!(stations[0].wspd, None);
        assert_eq!(stations[0].wtmp, None);
        assert_eq!(stations[0].atmp, None);
        assert_eq!(stations[0].pres, None);
    }

    #[test]
    fn test_zero_wave_height_is_valid() {
        let data = "\
#STN     LAT      LON      YYYY MM DD hh mm  WDIR  WSPD  GST   WVHT  DPD   APD   MWD   PRES   ATMP   WTMP  DEWP  VIS   PTDY  TIDE
#text    deg      deg      yr   mo da hr mn   degT  m/s   m/s   m     sec   sec   degT  hPa    degC   degC  degC  nmi   hPa   ft
41001   34.700  -72.700   2024 01 15 12 00    200   5.0   7.0   0.0   8.0   5.5   190  1015.0  15.0   20.0  10.0  MM    MM    MM";

        let stations = parse_ndbc_data(data);
        assert_eq!(stations.len(), 1);
        assert_eq!(
            stations[0].wvht,
            Some(Decimal::from_str("0.0").unwrap()),
            "Zero wave height should be valid, not None"
        );
    }

    #[test]
    fn test_whitespace_variations() {
        // NDBC files may use varying amounts of whitespace
        let data = "\
#STN     LAT      LON      YYYY MM DD hh mm  WDIR  WSPD  GST   WVHT  DPD   APD   MWD   PRES   ATMP   WTMP  DEWP  VIS   PTDY  TIDE
#text    deg      deg      yr   mo da hr mn   degT  m/s   m/s   m     sec   sec   degT  hPa    degC   degC  degC  nmi   hPa   ft
41001  34.700 -72.700  2024 01 15 12 00  200  5.0  7.0  1.5  8.0  5.5  190 1015.0 15.0  20.0 10.0 MM  MM  MM";

        let stations = parse_ndbc_data(data);
        assert_eq!(stations.len(), 1);
        assert_eq!(stations[0].station_id, "41001");
        assert_eq!(
            stations[0].wvht,
            Some(Decimal::from_str("1.5").unwrap())
        );
    }

    #[test]
    fn test_max_stations_cap() {
        // Verify the constant is set correctly
        assert_eq!(MAX_STATIONS, 500);
    }

    #[test]
    fn test_symbol_format() {
        // Numeric station
        let id = "41001";
        let symbol = format!("NDBC/{}", id.to_uppercase());
        assert_eq!(symbol, "NDBC/41001");

        // Alphanumeric station
        let id = "alsn6";
        let symbol = format!("NDBC/{}", id.to_uppercase());
        assert_eq!(symbol, "NDBC/ALSN6");
    }

    #[test]
    fn test_comments_and_blank_lines_skipped() {
        let data = "\
#STN     LAT      LON      YYYY MM DD hh mm  WDIR  WSPD  GST   WVHT  DPD   APD   MWD   PRES   ATMP   WTMP  DEWP  VIS   PTDY  TIDE
#text    deg      deg      yr   mo da hr mn   degT  m/s   m/s   m     sec   sec   degT  hPa    degC   degC  degC  nmi   hPa   ft
# This is a comment line
41001   34.700  -72.700   2024 01 15 12 00    200   5.0   7.0   1.5   8.0   5.5   190  1015.0  15.0   20.0  10.0  MM    MM    MM

# Another comment

41002   32.300  -75.200   2024 01 15 12 00    180   3.0   5.0   2.3   9.0   6.1   200  1013.5  14.5   19.5   9.0  MM    MM    MM";

        let stations = parse_ndbc_data(data);
        assert_eq!(
            stations.len(),
            2,
            "Comments and blank lines should be skipped"
        );
        assert_eq!(stations[0].station_id, "41001");
        assert_eq!(stations[1].station_id, "41002");
    }

    // ========================================================================
    // BUOY LIFECYCLE TESTS
    // ========================================================================

    fn make_buoy(station_id: &str, first_seen: DateTime<Utc>, last_seen: DateTime<Utc>, got_price: bool) -> CachedBuoy {
        CachedBuoy {
            station_id: station_id.to_string(),
            first_seen,
            last_seen,
            got_price,
            has_wvht: true,
        }
    }

    #[test]
    fn test_buoy_active_recently_seen() {
        let now = Utc::now();
        let buoy = make_buoy("41001", now - chrono::Duration::days(10), now - chrono::Duration::hours(1), true);
        assert!(NdbcMarketSource::is_buoy_active(&buoy, now));
    }

    #[test]
    fn test_buoy_deactivated_after_3_days_offline() {
        let now = Utc::now();
        let buoy = make_buoy("41001", now - chrono::Duration::days(10), now - chrono::Duration::days(4), true);
        assert!(!NdbcMarketSource::is_buoy_active(&buoy, now));
    }

    #[test]
    fn test_buoy_reactivated_when_back_online() {
        let now = Utc::now();
        // Was offline for a while, but last_seen is now (came back)
        let buoy = make_buoy("41001", now - chrono::Duration::days(20), now, true);
        assert!(NdbcMarketSource::is_buoy_active(&buoy, now));
    }

    #[test]
    fn test_new_buoy_grace_period() {
        let now = Utc::now();
        // New buoy (1h old), never got a price yet — still within grace period
        let buoy = make_buoy("99999", now - chrono::Duration::hours(1), now, false);
        assert!(NdbcMarketSource::is_buoy_active(&buoy, now));
    }

    #[test]
    fn test_buoy_never_priced_after_grace_period() {
        let now = Utc::now();
        // Buoy is 3 days old, still reporting, but never got a price
        let buoy = make_buoy("99999", now - chrono::Duration::days(3), now, false);
        assert!(!NdbcMarketSource::is_buoy_active(&buoy, now));
    }

    #[test]
    fn test_ndbc_deactivation_constants() {
        assert_eq!(DEACTIVATION_DAYS, 3);
        assert_eq!(GRACE_PERIOD_HOURS, 48);
        assert!(RETENTION_DAYS > DEACTIVATION_DAYS);
    }
}
