//! NOAA Space Weather client implementing MarketDataSource
//!
//! Tracks space weather indices from NOAA's Space Weather Prediction Center:
//! - Kp geomagnetic index (0-9)
//! - Solar wind speed and density
//! - NOAA G/S/R storm scales (0-5 each)
//! - Daily sunspot number and 10.7cm solar flux (F10.7)
//! - >10 MeV proton flux and >2 MeV electron flux
//!
//! Assets are static — defined in config/spaceweather.json (10 metrics).
//!
//! APIs:
//! - https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json
//! - https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json
//! - https://services.swpc.noaa.gov/products/noaa-scales.json
//! - https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json
//! - https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json
//! - https://services.swpc.noaa.gov/json/goes/primary/integral-electrons-1-day.json
//!
//! Auth: None
//! Rate limit: 30 req/min (government API, generous)
//!
//! IMPORTANT: NOAA array-of-arrays format. First element is headers row.

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration
const ASSET_JSON: &str = include_str!("../../../config/spaceweather.json");

/// NOAA SWPC API URLs
const KP_INDEX_URL: &str = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const SOLAR_WIND_PLASMA_URL: &str =
    "https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json";
const NOAA_SCALES_URL: &str = "https://services.swpc.noaa.gov/products/noaa-scales.json";

/// Solar cycle observed indices (sunspot number + F10.7 solar flux)
const SOLAR_CYCLE_URL: &str =
    "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json";
/// GOES integral proton flux (>10 MeV, 1-day)
const PROTON_FLUX_URL: &str =
    "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json";
/// GOES integral electron flux (>2 MeV, 1-day)
const ELECTRON_FLUX_URL: &str =
    "https://services.swpc.noaa.gov/json/goes/primary/integral-electrons-1-day.json";

// ============================================================================
// PARSED SPACE WEATHER DATA
// ============================================================================

/// All space weather metrics collected in one struct
#[derive(Debug, Default)]
struct SpaceWeatherMetrics {
    kp_index: Option<Decimal>,
    solar_wind_speed: Option<Decimal>,
    solar_wind_density: Option<Decimal>,
    g_scale: Option<Decimal>,
    s_scale: Option<Decimal>,
    r_scale: Option<Decimal>,
    sunspot_number: Option<Decimal>,
    solar_flux: Option<Decimal>,
    proton_flux: Option<Decimal>,
    electron_flux: Option<Decimal>,
}

/// Parse the NOAA array-of-arrays format and extract the last data row.
/// Format: [["header1","header2",...], ["val1","val2",...], ...]
/// Returns the last non-header row as a Vec<String>, or None if empty.
fn parse_last_row(json: &serde_json::Value) -> Option<Vec<String>> {
    let arr = json.as_array()?;
    if arr.len() < 2 {
        return None; // Need at least headers + 1 data row
    }

    // Last row is the most recent data point
    let last = arr.last()?;
    let row = last.as_array()?;

    Some(
        row.iter()
            .map(|v| v.as_str().unwrap_or("").to_string())
            .collect(),
    )
}

/// Parse a string value as Decimal, returning None for empty/invalid strings.
fn parse_decimal(s: &str) -> Option<Decimal> {
    if s.is_empty() || s == "-999.9" || s == "-99999.99" {
        return None; // Sentinel values used by NOAA for missing data
    }
    Decimal::from_str(s).ok()
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// NOAA Space Weather market data source.
///
/// Tracks 10 space weather metrics from NOAA SWPC.
/// Source ID is `"spaceweather"`.
pub struct SpaceweatherMarketSource {
    http: SourceHttpClient,
}

impl SpaceweatherMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("NOAA Space Weather source initialized");

        Ok(Self { http })
    }

    /// Fetch Kp index from NOAA planetary K index endpoint.
    /// Returns Kp value from the last row (index 1).
    async fn fetch_kp_index(&self) -> Option<Decimal> {
        match self
            .http
            .get_json::<serde_json::Value>(KP_INDEX_URL)
            .await
        {
            Ok(json) => {
                let row = parse_last_row(&json)?;
                // Row format: [time_tag, Kp, a_running, station_count]
                if row.len() >= 2 {
                    let kp = parse_decimal(&row[1]);
                    debug!("Kp index: {:?} (from row: {:?})", kp, row);
                    kp
                } else {
                    warn!("Kp index row too short: {:?}", row);
                    None
                }
            }
            Err(e) => {
                warn!("Error fetching Kp index: {:?}", e);
                None
            }
        }
    }

    /// Fetch solar wind plasma data from NOAA.
    /// Returns (density, speed) from the last row.
    async fn fetch_solar_wind(&self) -> (Option<Decimal>, Option<Decimal>) {
        match self
            .http
            .get_json::<serde_json::Value>(SOLAR_WIND_PLASMA_URL)
            .await
        {
            Ok(json) => {
                let row = match parse_last_row(&json) {
                    Some(r) => r,
                    None => return (None, None),
                };
                // Row format: [time_tag, density, speed, temperature]
                if row.len() >= 3 {
                    let density = parse_decimal(&row[1]);
                    let speed = parse_decimal(&row[2]);
                    debug!(
                        "Solar wind: density={:?}, speed={:?} (from row: {:?})",
                        density, speed, row
                    );
                    (density, speed)
                } else {
                    warn!("Solar wind row too short: {:?}", row);
                    (None, None)
                }
            }
            Err(e) => {
                warn!("Error fetching solar wind data: {:?}", e);
                (None, None)
            }
        }
    }

    /// Fetch solar cycle indices (sunspot number and F10.7 solar flux).
    /// Returns (sunspot_number, solar_flux) from the last entry.
    async fn fetch_solar_cycle(&self) -> (Option<Decimal>, Option<Decimal>) {
        match self
            .http
            .get_json::<serde_json::Value>(SOLAR_CYCLE_URL)
            .await
        {
            Ok(json) => {
                let arr = match json.as_array() {
                    Some(a) if !a.is_empty() => a,
                    _ => {
                        warn!("Solar cycle: empty or invalid response");
                        return (None, None);
                    }
                };

                let last = &arr[arr.len() - 1];
                let ssn = last
                    .get("ssn")
                    .and_then(|v| {
                        if v.is_number() {
                            v.as_f64().and_then(|f| Decimal::try_from(f).ok())
                        } else {
                            v.as_str().and_then(|s| Decimal::from_str(s).ok())
                        }
                    });
                let flux = last
                    .get("f10.7")
                    .and_then(|v| {
                        if v.is_number() {
                            v.as_f64().and_then(|f| Decimal::try_from(f).ok())
                        } else {
                            v.as_str().and_then(|s| Decimal::from_str(s).ok())
                        }
                    });

                debug!("Solar cycle: ssn={:?}, f10.7={:?}", ssn, flux);
                (ssn, flux)
            }
            Err(e) => {
                warn!("Error fetching solar cycle data: {:?}", e);
                (None, None)
            }
        }
    }

    /// Fetch >10 MeV proton flux from GOES integral protons endpoint.
    /// Returns the flux value from the last entry with energy >= 10 MeV.
    async fn fetch_proton_flux(&self) -> Option<Decimal> {
        match self
            .http
            .get_json::<serde_json::Value>(PROTON_FLUX_URL)
            .await
        {
            Ok(json) => {
                let arr = match json.as_array() {
                    Some(a) if !a.is_empty() => a,
                    _ => {
                        warn!("Proton flux: empty or invalid response");
                        return None;
                    }
                };

                // Find last entry with energy >= 10 MeV
                let entry = arr.iter().rev().find(|e| {
                    e.get("energy")
                        .and_then(|v| v.as_str())
                        .map(|s| s.contains("10"))
                        .unwrap_or(false)
                });

                let flux = entry.and_then(|e| {
                    e.get("flux")
                        .and_then(|v| {
                            if v.is_number() {
                                v.as_f64().and_then(|f| Decimal::try_from(f).ok())
                            } else {
                                v.as_str().and_then(|s| Decimal::from_str(s).ok())
                            }
                        })
                });

                debug!("Proton flux (>10 MeV): {:?}", flux);
                flux
            }
            Err(e) => {
                warn!("Error fetching proton flux: {:?}", e);
                None
            }
        }
    }

    /// Fetch >2 MeV electron flux from GOES integral electrons endpoint.
    /// Returns the flux value from the last entry.
    async fn fetch_electron_flux(&self) -> Option<Decimal> {
        match self
            .http
            .get_json::<serde_json::Value>(ELECTRON_FLUX_URL)
            .await
        {
            Ok(json) => {
                let arr = match json.as_array() {
                    Some(a) if !a.is_empty() => a,
                    _ => {
                        warn!("Electron flux: empty or invalid response");
                        return None;
                    }
                };

                // Last entry has the most recent measurement
                let last = &arr[arr.len() - 1];
                let flux = last
                    .get("flux")
                    .and_then(|v| {
                        if v.is_number() {
                            v.as_f64().and_then(|f| Decimal::try_from(f).ok())
                        } else {
                            v.as_str().and_then(|s| Decimal::from_str(s).ok())
                        }
                    });

                debug!("Electron flux (>2 MeV): {:?}", flux);
                flux
            }
            Err(e) => {
                warn!("Error fetching electron flux: {:?}", e);
                None
            }
        }
    }

    /// Fetch NOAA G/S/R scales from the scales endpoint.
    /// Returns (G, S, R) scale values from the "0" (current) entry.
    async fn fetch_noaa_scales(&self) -> (Option<Decimal>, Option<Decimal>, Option<Decimal>) {
        match self
            .http
            .get_json::<serde_json::Value>(NOAA_SCALES_URL)
            .await
        {
            Ok(json) => {
                // The scales JSON is an object with keys "0" (current), "-1" (previous), etc.
                let current = match json.get("0") {
                    Some(c) => c,
                    None => {
                        warn!("NOAA scales: no '0' key found");
                        return (None, None, None);
                    }
                };

                let g_scale = current
                    .pointer("/G/Scale")
                    .and_then(|v| {
                        if v.is_number() {
                            v.as_u64().map(|n| Decimal::from(n))
                        } else {
                            v.as_str().and_then(|s| Decimal::from_str(s).ok())
                        }
                    });

                let s_scale = current
                    .pointer("/S/Scale")
                    .and_then(|v| {
                        if v.is_number() {
                            v.as_u64().map(|n| Decimal::from(n))
                        } else {
                            v.as_str().and_then(|s| Decimal::from_str(s).ok())
                        }
                    });

                let r_scale = current
                    .pointer("/R/Scale")
                    .and_then(|v| {
                        if v.is_number() {
                            v.as_u64().map(|n| Decimal::from(n))
                        } else {
                            v.as_str().and_then(|s| Decimal::from_str(s).ok())
                        }
                    });

                debug!(
                    "NOAA scales: G={:?}, S={:?}, R={:?}",
                    g_scale, s_scale, r_scale
                );

                (g_scale, s_scale, r_scale)
            }
            Err(e) => {
                warn!("Error fetching NOAA scales: {:?}", e);
                (None, None, None)
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for SpaceweatherMarketSource {
    fn source_id(&self) -> &'static str {
        "spaceweather"
    }

    fn display_name(&self) -> &'static str {
        "NOAA Space Weather"
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
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "Space Weather fetch_assets: {} assets loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Fetch all endpoints independently — if one fails, still return the others
        let kp_index = self.fetch_kp_index().await;
        let (solar_wind_density, solar_wind_speed) = self.fetch_solar_wind().await;
        let (g_scale, s_scale, r_scale) = self.fetch_noaa_scales().await;
        let (sunspot_number, solar_flux) = self.fetch_solar_cycle().await;
        let proton_flux = self.fetch_proton_flux().await;
        let electron_flux = self.fetch_electron_flux().await;

        let metrics = SpaceWeatherMetrics {
            kp_index,
            solar_wind_speed,
            solar_wind_density,
            g_scale,
            s_scale,
            r_scale,
            sunspot_number,
            solar_flux,
            proton_flux,
            electron_flux,
        };

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let value = match asset_id.as_str() {
                "sw_kp_index" => metrics.kp_index,
                "sw_solar_wind_speed" => metrics.solar_wind_speed,
                "sw_solar_wind_density" => metrics.solar_wind_density,
                "sw_g_scale" => metrics.g_scale,
                "sw_s_scale" => metrics.s_scale,
                "sw_r_scale" => metrics.r_scale,
                "sw_sunspot_number" => metrics.sunspot_number,
                "sw_solar_flux" => metrics.solar_flux,
                "sw_proton_flux" => metrics.proton_flux,
                "sw_electron_flux" => metrics.electron_flux,
                _ => {
                    warn!("Unknown spaceweather asset_id: {}", asset_id);
                    None
                }
            };

            if let Some(value) = value {
                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol: format!(
                        "SW/{}",
                        asset_id
                            .strip_prefix("sw_")
                            .unwrap_or(asset_id)
                            .to_uppercase()
                    ),
                    value,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        info!(
            "Fetched {}/{} space weather metrics (kp={:?}, wind_speed={:?}, G={:?}, ssn={:?})",
            results.len(),
            asset_ids.len(),
            metrics.kp_index,
            metrics.solar_wind_speed,
            metrics.g_scale,
            metrics.sunspot_number,
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

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            10,
            "Expected exactly 10 spaceweather entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 10);
    }

    #[test]
    fn test_all_entries_space_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(entry.category, "space");
            assert_eq!(entry.subcategory, "spaceweather");
        }
    }

    #[test]
    fn test_parse_last_row_basic() {
        let json: serde_json::Value = serde_json::from_str(
            r#"[
                ["time_tag", "Kp", "a_running", "station_count"],
                ["2024-01-01 00:00:00", "1.33", "4", "8"],
                ["2024-01-01 03:00:00", "2.67", "7", "8"]
            ]"#,
        )
        .unwrap();

        let row = parse_last_row(&json).unwrap();
        assert_eq!(row.len(), 4);
        assert_eq!(row[0], "2024-01-01 03:00:00");
        assert_eq!(row[1], "2.67");
    }

    #[test]
    fn test_parse_last_row_single_data() {
        let json: serde_json::Value = serde_json::from_str(
            r#"[
                ["header1", "header2"],
                ["value1", "value2"]
            ]"#,
        )
        .unwrap();

        let row = parse_last_row(&json).unwrap();
        assert_eq!(row[0], "value1");
        assert_eq!(row[1], "value2");
    }

    #[test]
    fn test_parse_last_row_empty() {
        // Only headers, no data
        let json: serde_json::Value = serde_json::from_str(
            r#"[["header1", "header2"]]"#,
        )
        .unwrap();

        assert!(parse_last_row(&json).is_none());
    }

    #[test]
    fn test_parse_last_row_not_array() {
        let json: serde_json::Value = serde_json::from_str(r#"{"key": "value"}"#).unwrap();
        assert!(parse_last_row(&json).is_none());
    }

    #[test]
    fn test_parse_decimal_valid() {
        assert_eq!(parse_decimal("2.67"), Some(Decimal::from_str("2.67").unwrap()));
        assert_eq!(parse_decimal("0"), Some(Decimal::ZERO));
        assert_eq!(parse_decimal("450.3"), Some(Decimal::from_str("450.3").unwrap()));
    }

    #[test]
    fn test_parse_decimal_invalid() {
        assert_eq!(parse_decimal(""), None);
        assert_eq!(parse_decimal("-999.9"), None);
        assert_eq!(parse_decimal("-99999.99"), None);
        assert_eq!(parse_decimal("not_a_number"), None);
    }

    #[test]
    fn test_parse_noaa_scales_format() {
        // Simulate the NOAA scales JSON structure
        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "0": {
                    "DateStamp": "2024-01-01",
                    "TimeStamp": "1200",
                    "G": {"Scale": 1, "Text": "Minor"},
                    "S": {"Scale": 0, "Text": "None"},
                    "R": {"Scale": 2, "Text": "Moderate"}
                },
                "-1": {
                    "DateStamp": "2024-01-01",
                    "TimeStamp": "0800",
                    "G": {"Scale": 0, "Text": "None"},
                    "S": {"Scale": 0, "Text": "None"},
                    "R": {"Scale": 0, "Text": "None"}
                }
            }"#,
        )
        .unwrap();

        let current = json.get("0").unwrap();

        let g = current
            .pointer("/G/Scale")
            .and_then(|v| v.as_u64())
            .map(Decimal::from);
        let s = current
            .pointer("/S/Scale")
            .and_then(|v| v.as_u64())
            .map(Decimal::from);
        let r = current
            .pointer("/R/Scale")
            .and_then(|v| v.as_u64())
            .map(Decimal::from);

        assert_eq!(g, Some(Decimal::from(1)));
        assert_eq!(s, Some(Decimal::from(0)));
        assert_eq!(r, Some(Decimal::from(2)));
    }

    #[test]
    fn test_asset_ids_match_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let expected = vec![
            "sw_kp_index",
            "sw_solar_wind_speed",
            "sw_solar_wind_density",
            "sw_g_scale",
            "sw_s_scale",
            "sw_r_scale",
            "sw_sunspot_number",
            "sw_solar_flux",
            "sw_proton_flux",
            "sw_electron_flux",
        ];
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        for exp in &expected {
            assert!(ids.contains(exp), "Missing expected asset_id: {}", exp);
        }
    }

    #[test]
    fn test_parse_solar_cycle_format() {
        // Simulate the solar cycle JSON (array of objects)
        let json: serde_json::Value = serde_json::from_str(
            r#"[
                {"time-tag": "2024-01", "ssn": 120.5, "smoothed_ssn": 115.2, "observed_swpc_ssn": 120, "smoothed_swpc_ssn": 115, "f10.7": 165.3, "smoothed_f10.7": 160.1},
                {"time-tag": "2024-02", "ssn": 130.2, "smoothed_ssn": 118.0, "observed_swpc_ssn": 130, "smoothed_swpc_ssn": 118, "f10.7": 172.8, "smoothed_f10.7": 163.5}
            ]"#,
        )
        .unwrap();

        let arr = json.as_array().unwrap();
        let last = &arr[arr.len() - 1];
        let ssn = last.get("ssn").and_then(|v| v.as_f64());
        let flux = last.get("f10.7").and_then(|v| v.as_f64());

        assert!((ssn.unwrap() - 130.2).abs() < 0.01);
        assert!((flux.unwrap() - 172.8).abs() < 0.01);
    }

    #[test]
    fn test_parse_proton_flux_format() {
        let json: serde_json::Value = serde_json::from_str(
            r#"[
                {"time_tag": "2024-01-01T00:00:00Z", "flux": 0.35, "energy": ">=10 MeV"},
                {"time_tag": "2024-01-01T00:05:00Z", "flux": 0.42, "energy": ">=10 MeV"},
                {"time_tag": "2024-01-01T00:00:00Z", "flux": 105.2, "energy": ">=50 MeV"},
                {"time_tag": "2024-01-01T00:05:00Z", "flux": 110.5, "energy": ">=50 MeV"}
            ]"#,
        )
        .unwrap();

        let arr = json.as_array().unwrap();
        // Find last entry with energy containing "10"
        let entry = arr.iter().rev().find(|e| {
            e.get("energy")
                .and_then(|v| v.as_str())
                .map(|s| s.contains("10"))
                .unwrap_or(false)
        });

        assert!(entry.is_some());
        let flux = entry.unwrap().get("flux").and_then(|v| v.as_f64());
        assert!((flux.unwrap() - 0.42).abs() < 0.01);
    }

    #[test]
    fn test_parse_electron_flux_format() {
        let json: serde_json::Value = serde_json::from_str(
            r#"[
                {"time_tag": "2024-01-01T00:00:00Z", "flux": 250.5, "energy": ">=2 MeV"},
                {"time_tag": "2024-01-01T00:05:00Z", "flux": 275.3, "energy": ">=2 MeV"}
            ]"#,
        )
        .unwrap();

        let arr = json.as_array().unwrap();
        let last = &arr[arr.len() - 1];
        let flux = last.get("flux").and_then(|v| v.as_f64());
        assert!((flux.unwrap() - 275.3).abs() < 0.01);
    }

    #[test]
    fn test_solar_wind_plasma_row_parsing() {
        // Simulate parsing a solar wind plasma row
        let json: serde_json::Value = serde_json::from_str(
            r#"[
                ["time_tag", "density", "speed", "temperature"],
                ["2024-01-01 00:00:00.000", "5.21", "382.4", "98521"],
                ["2024-01-01 00:01:00.000", "4.87", "401.2", "105200"]
            ]"#,
        )
        .unwrap();

        let row = parse_last_row(&json).unwrap();
        assert_eq!(row.len(), 4);
        let density = parse_decimal(&row[1]).unwrap();
        let speed = parse_decimal(&row[2]).unwrap();
        assert_eq!(density, Decimal::from_str("4.87").unwrap());
        assert_eq!(speed, Decimal::from_str("401.2").unwrap());
    }
}
