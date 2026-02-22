//! USGS Earthquakes client implementing MarketDataSource
//!
//! Tracks earthquake metrics from the USGS Earthquake Hazards Program.
//! Fetches from 3 GeoJSON feeds (all_hour, 4.5_day, significant_month)
//! and computes 10 derived metrics: counts, max magnitude, regional filters,
//! and total seismic energy.
//!
//! Assets are static — defined in config/earthquake.json (10 metrics).
//!
//! API: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/
//! Auth: None
//! Rate limit: 30 req/min (government API, generous)

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
const ASSET_JSON: &str = include_str!("../../../config/earthquake.json");

/// USGS Earthquake feed URLs
const FEED_ALL_HOUR: &str =
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
const FEED_M45_DAY: &str =
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";
const FEED_SIGNIFICANT_MONTH: &str =
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson";

// ============================================================================
// PARSED EARTHQUAKE DATA
// ============================================================================

/// A parsed earthquake feature with the fields we need
#[derive(Debug, Clone)]
struct Quake {
    mag: f64,
    lon: f64,
    lat: f64,
}

/// Parse GeoJSON feed response into a list of quakes
fn parse_geojson_features(json: &serde_json::Value) -> Vec<Quake> {
    let mut quakes = Vec::new();

    let features = match json.get("features").and_then(|f| f.as_array()) {
        Some(f) => f,
        None => return quakes,
    };

    for feature in features {
        let mag = feature
            .pointer("/properties/mag")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let coords = feature
            .pointer("/geometry/coordinates")
            .and_then(|v| v.as_array());

        let (lon, lat) = match coords {
            Some(c) if c.len() >= 2 => {
                let lon = c[0].as_f64().unwrap_or(0.0);
                let lat = c[1].as_f64().unwrap_or(0.0);
                (lon, lat)
            }
            _ => (0.0, 0.0),
        };

        quakes.push(Quake { mag, lon, lat });
    }

    quakes
}

// ============================================================================
// REGION FILTERS
// ============================================================================

/// Check if a quake is in the Pacific Ring of Fire.
/// Simplified bounding boxes covering the major Ring of Fire segments:
/// - Western Pacific: lon 120..180, lat -50..60 (Japan, Philippines, Kamchatka, NZ)
/// - Eastern Pacific: lon -180..-60, lat -60..65 (Americas west coast)
fn is_ring_of_fire(lon: f64, lat: f64) -> bool {
    // Western Pacific segment
    let western = lon >= 120.0 && lon <= 180.0 && lat >= -50.0 && lat <= 60.0;
    // Eastern Pacific segment (wraps around)
    let eastern = lon >= -180.0 && lon <= -60.0 && lat >= -60.0 && lat <= 65.0;
    western || eastern
}

/// Check if a quake is in the US West Coast region
fn is_us_west(lon: f64, lat: f64) -> bool {
    lon >= -125.0 && lon <= -104.0 && lat >= 32.0 && lat <= 49.0
}

/// Check if a quake is in the Japan region
fn is_japan(lon: f64, lat: f64) -> bool {
    lon >= 129.0 && lon <= 146.0 && lat >= 30.0 && lat <= 46.0
}

/// Check if a quake is in the Mediterranean region
fn is_mediterranean(lon: f64, lat: f64) -> bool {
    lon >= -10.0 && lon <= 40.0 && lat >= 30.0 && lat <= 47.0
}

/// Compute total seismic energy: sum(10^(1.5*mag)) for all quakes.
/// Returns as a Decimal string to avoid overflow.
fn compute_total_energy(quakes: &[Quake]) -> Decimal {
    let mut total: f64 = 0.0;
    for q in quakes {
        // 10^(1.5 * mag) — seismic energy proxy (Gutenberg-Richter)
        total += (10.0_f64).powf(1.5 * q.mag);
    }
    // Convert to Decimal, truncating to reasonable precision
    Decimal::from_str(&format!("{:.0}", total)).unwrap_or(Decimal::ZERO)
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// USGS Earthquakes market data source.
///
/// Tracks 10 earthquake metrics derived from 3 USGS GeoJSON feeds.
/// Source ID is `"earthquake"`.
pub struct EarthquakeMarketSource {
    http: SourceHttpClient,
}

impl EarthquakeMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("USGS Earthquakes source initialized");

        Ok(Self { http })
    }

    /// Fetch and parse a GeoJSON feed, returning parsed quakes.
    /// Returns empty vec on error (non-fatal).
    async fn fetch_feed(&self, url: &str) -> Vec<Quake> {
        match self.http.get_json::<serde_json::Value>(url).await {
            Ok(json) => {
                let quakes = parse_geojson_features(&json);
                debug!("Parsed {} quakes from {}", quakes.len(), url);
                quakes
            }
            Err(e) => {
                warn!("Error fetching earthquake feed {}: {:?}", url, e);
                Vec::new()
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for EarthquakeMarketSource {
    fn source_id(&self) -> &'static str {
        "earthquake"
    }

    fn display_name(&self) -> &'static str {
        "USGS Earthquakes"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300) // 5 minutes
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
            "Earthquake fetch_assets: {} assets loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Fetch all 3 feeds
        let all_hour = self.fetch_feed(FEED_ALL_HOUR).await;
        let m45_day = self.fetch_feed(FEED_M45_DAY).await;
        let significant_month = self.fetch_feed(FEED_SIGNIFICANT_MONTH).await;

        // Compute metrics
        let count_all_1h = Decimal::from(all_hour.len() as u64);

        let count_m25_1h = Decimal::from(
            all_hour.iter().filter(|q| q.mag >= 2.5).count() as u64,
        );

        let count_m45_24h = Decimal::from(m45_day.len() as u64);

        let max_mag_24h = m45_day
            .iter()
            .map(|q| q.mag)
            .fold(0.0_f64, f64::max);
        let max_mag_24h = Decimal::from_str(&format!("{:.1}", max_mag_24h))
            .unwrap_or(Decimal::ZERO);

        let significant_month_count = Decimal::from(significant_month.len() as u64);

        let ring_of_fire_count = Decimal::from(
            m45_day
                .iter()
                .filter(|q| is_ring_of_fire(q.lon, q.lat))
                .count() as u64,
        );

        let us_west_count = Decimal::from(
            all_hour
                .iter()
                .filter(|q| is_us_west(q.lon, q.lat))
                .count() as u64,
        );

        let japan_count = Decimal::from(
            all_hour
                .iter()
                .filter(|q| is_japan(q.lon, q.lat))
                .count() as u64,
        );

        let mediterranean_count = Decimal::from(
            all_hour
                .iter()
                .filter(|q| is_mediterranean(q.lon, q.lat))
                .count() as u64,
        );

        let total_energy = compute_total_energy(&m45_day);

        // Build results
        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let value = match asset_id.as_str() {
                "eq_count_all_1h" => Some(count_all_1h),
                "eq_count_m25_1h" => Some(count_m25_1h),
                "eq_count_m45_24h" => Some(count_m45_24h),
                "eq_max_mag_24h" => Some(max_mag_24h),
                "eq_significant_month" => Some(significant_month_count),
                "eq_ring_of_fire" => Some(ring_of_fire_count),
                "eq_us_west" => Some(us_west_count),
                "eq_japan" => Some(japan_count),
                "eq_mediterranean" => Some(mediterranean_count),
                "eq_total_energy_24h" => Some(total_energy),
                _ => {
                    warn!("Unknown earthquake asset_id: {}", asset_id);
                    None
                }
            };

            if let Some(value) = value {
                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol: format!("EQ/{}", asset_id.strip_prefix("eq_").unwrap_or(asset_id).to_uppercase()),
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
            "Fetched {}/{} earthquake metrics (all_hour={}, m45_day={}, significant={})",
            results.len(),
            asset_ids.len(),
            all_hour.len(),
            m45_day.len(),
            significant_month.len()
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
            "Expected exactly 10 earthquake entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 10);
    }

    #[test]
    fn test_all_entries_geophysical_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(entry.category, "geophysical");
            assert_eq!(entry.subcategory, "earthquake");
        }
    }

    #[test]
    fn test_region_us_west() {
        // San Francisco: lon=-122.4, lat=37.8
        assert!(is_us_west(-122.4, 37.8));
        // Los Angeles: lon=-118.2, lat=34.1
        assert!(is_us_west(-118.2, 34.1));
        // Denver: lon=-104.9, lat=39.7 — inside west boundary (-104.9 <= -104.0)
        assert!(is_us_west(-104.9, 39.7));
        // Chicago: lon=-87.6, lat=41.9 — outside east boundary (-87.6 > -104.0)
        assert!(!is_us_west(-87.6, 41.9));
        // Tokyo: clearly outside
        assert!(!is_us_west(139.7, 35.7));
    }

    #[test]
    fn test_region_japan() {
        // Tokyo: lon=139.7, lat=35.7
        assert!(is_japan(139.7, 35.7));
        // Osaka: lon=135.5, lat=34.7
        assert!(is_japan(135.5, 34.7));
        // Beijing: outside
        assert!(!is_japan(116.4, 39.9));
    }

    #[test]
    fn test_region_mediterranean() {
        // Rome: lon=12.5, lat=41.9
        assert!(is_mediterranean(12.5, 41.9));
        // Athens: lon=23.7, lat=37.98
        assert!(is_mediterranean(23.7, 37.98));
        // London: lat too high
        assert!(!is_mediterranean(-0.1, 51.5));
    }

    #[test]
    fn test_region_ring_of_fire() {
        // Tokyo (western Pacific)
        assert!(is_ring_of_fire(139.7, 35.7));
        // Chile (eastern Pacific)
        assert!(is_ring_of_fire(-70.6, -33.4));
        // Alaska
        assert!(is_ring_of_fire(-150.0, 61.2));
        // London (not ring of fire)
        assert!(!is_ring_of_fire(-0.1, 51.5));
        // Middle of Atlantic
        assert!(!is_ring_of_fire(-30.0, 30.0));
    }

    #[test]
    fn test_parse_geojson_features() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "type": "FeatureCollection",
                "metadata": {"count": 2},
                "features": [
                    {
                        "properties": {"mag": 5.2, "place": "Near Japan", "time": 1234567890000},
                        "geometry": {"type": "Point", "coordinates": [139.7, 35.7, 10.0]}
                    },
                    {
                        "properties": {"mag": 3.1, "place": "California", "time": 1234567890000},
                        "geometry": {"type": "Point", "coordinates": [-122.4, 37.8, 5.0]}
                    }
                ]
            }"#,
        )
        .unwrap();

        let quakes = parse_geojson_features(&json);
        assert_eq!(quakes.len(), 2);
        assert!((quakes[0].mag - 5.2).abs() < 0.01);
        assert!((quakes[0].lon - 139.7).abs() < 0.01);
        assert!((quakes[0].lat - 35.7).abs() < 0.01);
        assert!((quakes[1].mag - 3.1).abs() < 0.01);
    }

    #[test]
    fn test_parse_geojson_empty() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{"type": "FeatureCollection", "metadata": {"count": 0}, "features": []}"#,
        )
        .unwrap();

        let quakes = parse_geojson_features(&json);
        assert!(quakes.is_empty());
    }

    #[test]
    fn test_parse_geojson_missing_fields() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "type": "FeatureCollection",
                "features": [
                    {
                        "properties": {},
                        "geometry": {"type": "Point", "coordinates": [0.0, 0.0]}
                    }
                ]
            }"#,
        )
        .unwrap();

        let quakes = parse_geojson_features(&json);
        assert_eq!(quakes.len(), 1);
        assert!((quakes[0].mag - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_compute_total_energy() {
        let quakes = vec![
            Quake { mag: 5.0, lon: 0.0, lat: 0.0 },
            Quake { mag: 6.0, lon: 0.0, lat: 0.0 },
        ];
        let energy = compute_total_energy(&quakes);
        // 10^(1.5*5) + 10^(1.5*6) = 10^7.5 + 10^9 = ~31622776 + ~1000000000
        assert!(energy > Decimal::ZERO);
        assert!(energy > Decimal::from(1_000_000_000u64));
    }

    #[test]
    fn test_compute_total_energy_empty() {
        let quakes: Vec<Quake> = vec![];
        let energy = compute_total_energy(&quakes);
        assert_eq!(energy, Decimal::ZERO);
    }

    #[test]
    fn test_asset_ids_match_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let expected = vec![
            "eq_count_all_1h",
            "eq_count_m25_1h",
            "eq_count_m45_24h",
            "eq_max_mag_24h",
            "eq_significant_month",
            "eq_ring_of_fire",
            "eq_us_west",
            "eq_japan",
            "eq_mediterranean",
            "eq_total_energy_24h",
        ];
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        for exp in &expected {
            assert!(ids.contains(exp), "Missing expected asset_id: {}", exp);
        }
    }
}
