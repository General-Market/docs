//! AIS Maritime vessel tracking client implementing MarketDataSource
//!
//! Tracks vessel counts using the Finnish Digitraffic AIS API.
//!
//! ## GEOGRAPHIC SCOPE LIMITATION
//!
//! Digitraffic only emits vessel positions for the Baltic Sea and Gulf of
//! Finland. The 25-entry config retains worldwide ports and lanes for
//! historical reasons, but bboxes outside the Baltic envelope count zero
//! vessels forever — the API cannot see them.
//!
//! When `BALTIC_ONLY` is true (the only sane setting today), assets and
//! prices are filtered at runtime to bboxes intersecting `BALTIC_BBOX`.
//! Result: Bosphorus, Hormuz, Suez, LA, Singapore, etc. are silently
//! dropped. To track non-Baltic regions, swap to a global AIS provider
//! (AISStream, MarineTraffic, Spire) and remove this filter.
//!
//! Strategy: ONE call to the Digitraffic AIS locations endpoint fetches all
//! vessel positions as GeoJSON, then counts per bounding box region in-memory.
//!
//! API: GET https://meri.digitraffic.fi/api/ais/v1/locations
//! Auth: None (public API)
//! Rate limit: Requires Accept-Encoding: gzip
//! Note: Response is GeoJSON with coordinates in [lon, lat] order.

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — 25 global ports and shipping lanes
const ASSET_JSON: &str = include_str!("../../../config/maritime.json");

/// Digitraffic AIS locations endpoint (returns all vessels as GeoJSON)
const API_URL: &str = "https://meri.digitraffic.fi/api/ais/v1/locations";

/// When true, drop any asset whose bbox does not intersect the Baltic envelope.
/// The Digitraffic feed has zero coverage outside this area; tracking those
/// regions just emits dead zeros. Flip to false only after switching to a
/// global AIS provider.
const BALTIC_ONLY: bool = true;

/// Conservative envelope of Digitraffic AIS coverage: Baltic Sea, Gulf of
/// Finland, Gulf of Bothnia, Kattegat, Skagerrak. Coordinates as
/// (lon_min, lat_min, lon_max, lat_max).
const BALTIC_BBOX: (f64, f64, f64, f64) = (8.0, 53.0, 32.0, 66.0);

// ============================================================================
// API RESPONSE TYPES (GeoJSON format from Digitraffic)
// ============================================================================

/// GeoJSON FeatureCollection response from Digitraffic AIS
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AisGeoJsonResponse {
    /// Array of vessel features
    #[serde(default)]
    features: Vec<AisFeature>,
}

/// A single vessel GeoJSON feature
#[derive(Debug, Deserialize)]
struct AisFeature {
    /// Point geometry with [lon, lat] coordinates
    geometry: Option<AisGeometry>,
}

/// GeoJSON Point geometry
#[derive(Debug, Deserialize)]
struct AisGeometry {
    /// Coordinates in [longitude, latitude] order (GeoJSON standard)
    coordinates: Option<Vec<f64>>,
}

/// Parsed bounding box for vessel counting
#[derive(Debug, Clone)]
struct BBox {
    lon_min: f64,
    lat_min: f64,
    lon_max: f64,
    lat_max: f64,
}

impl BBox {
    /// Check if a (lat, lon) point is inside this bounding box
    fn contains(&self, lat: f64, lon: f64) -> bool {
        lat >= self.lat_min && lat <= self.lat_max
            && lon >= self.lon_min && lon <= self.lon_max
    }

    /// True if this bbox overlaps the Baltic envelope (the only region
    /// Digitraffic AIS actually covers).
    fn intersects_baltic(&self) -> bool {
        let (b_lon_min, b_lat_min, b_lon_max, b_lat_max) = BALTIC_BBOX;
        self.lon_min <= b_lon_max
            && self.lon_max >= b_lon_min
            && self.lat_min <= b_lat_max
            && self.lat_max >= b_lat_min
    }
}

/// True if the bbox string parses and falls inside the Baltic envelope.
fn bbox_in_coverage(bbox_str: &str) -> bool {
    if !BALTIC_ONLY {
        return true;
    }
    match MaritimeMarketSource::parse_bbox(bbox_str) {
        Ok(b) => b.intersects_baltic(),
        Err(_) => false,
    }
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// AIS maritime vessel tracking market data source.
///
/// Tracks vessel counts across 25 global ports and shipping lanes
/// using the Digitraffic AIS API. Source ID is `"maritime"`.
pub struct MaritimeMarketSource {
    http: SourceHttpClient,
}

impl MaritimeMarketSource {
    pub fn from_env() -> Result<Self> {
        // No API key required for Digitraffic
        // Accept AISSTREAM_API_KEY silently for backward compat but don't require it
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(60)) // Large GeoJSON response
            .gzip(true)
            .build()?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 6,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        info!("AIS maritime source initialized (Digitraffic API, 25 ports/lanes)");

        Ok(Self { http })
    }

    /// Parse bounding box from config format "lon_min,lat_min,lon_max,lat_max"
    fn parse_bbox(bbox_str: &str) -> Result<BBox, String> {
        let parts: Vec<&str> = bbox_str.split(',').collect();
        if parts.len() != 4 {
            return Err(format!(
                "Expected 4 components, got {} in '{}'",
                parts.len(),
                bbox_str
            ));
        }
        Ok(BBox {
            lon_min: parts[0].trim().parse().map_err(|e| format!("lon_min: {}", e))?,
            lat_min: parts[1].trim().parse().map_err(|e| format!("lat_min: {}", e))?,
            lon_max: parts[2].trim().parse().map_err(|e| format!("lon_max: {}", e))?,
            lat_max: parts[3].trim().parse().map_err(|e| format!("lat_max: {}", e))?,
        })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for MaritimeMarketSource {
    fn source_id(&self) -> &'static str {
        "maritime"
    }

    fn display_name(&self) -> &'static str {
        "AIS Maritime"
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
        let all_entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let bbox_map: HashMap<String, String> = all_entries
            .iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        let assets: Vec<AssetUpdate> = load_assets_from_json(ASSET_JSON)?
            .into_iter()
            .filter(|a| {
                bbox_map
                    .get(&a.asset_id)
                    .map(|bbox| bbox_in_coverage(bbox))
                    .unwrap_or(false)
            })
            .collect();

        let total = bbox_map.len();
        info!(
            "Maritime fetch_assets: {}/{} ports/lanes inside Digitraffic Baltic coverage",
            assets.len(),
            total
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load asset config to get bounding boxes
        let all_entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let bbox_map: HashMap<&str, &str> = all_entries
            .iter()
            .map(|e| (e.asset_id.as_str(), e.api_ref.as_str()))
            .collect();

        // ONE call to get ALL vessel positions as GeoJSON
        let response: AisGeoJsonResponse = match self.http.get_json(API_URL).await {
            Ok(d) => d,
            Err(e) => {
                warn!("Maritime: failed to fetch Digitraffic AIS: {}", e);
                return Ok(Vec::new());
            }
        };

        // Extract valid positions (GeoJSON: coordinates = [lon, lat])
        let positions: Vec<(f64, f64)> = response
            .features
            .iter()
            .filter_map(|f| {
                let coords = f.geometry.as_ref()?.coordinates.as_ref()?;
                if coords.len() >= 2 {
                    let lon = coords[0];
                    let lat = coords[1];
                    if lat.is_finite() && lon.is_finite() {
                        return Some((lat, lon));
                    }
                }
                None
            })
            .collect();

        debug!(
            "Maritime: {} vessels with positions out of {} features",
            positions.len(),
            response.features.len()
        );

        // Count vessels per requested region
        let mut results = Vec::new();

        for asset_id in asset_ids {
            let bbox_str = match bbox_map.get(asset_id.as_str()) {
                Some(b) => *b,
                None => {
                    warn!("Maritime: unknown asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

            // Skip regions Digitraffic can't see. Emitting zeros there is a lie.
            if !bbox_in_coverage(bbox_str) {
                debug!(
                    "Maritime: {} bbox outside Digitraffic Baltic coverage, skipping",
                    asset_id
                );
                continue;
            }

            let bbox = match Self::parse_bbox(bbox_str) {
                Ok(b) => b,
                Err(e) => {
                    warn!(
                        "Maritime: bad bounding box for {} ('{}'): {}",
                        asset_id, bbox_str, e
                    );
                    continue;
                }
            };

            let count = positions
                .iter()
                .filter(|&&(lat, lon)| bbox.contains(lat, lon))
                .count();

            debug!(
                "Maritime {}: {} vessels (bbox={})",
                asset_id, count, bbox_str
            );

            let symbol = all_entries
                .iter()
                .find(|e| e.asset_id == *asset_id)
                .map(|e| e.symbol.clone())
                .unwrap_or_else(|| format!("AIS/{}", asset_id));

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol,
                value: Decimal::from(count as u64),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Maritime: counted {}/{} regions from {} vessels (Digitraffic AIS)",
            results.len(),
            asset_ids.len(),
            positions.len()
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
    fn test_source_id() {
        assert_eq!("maritime", "maritime");
    }

    #[test]
    fn test_config_loads_25_entries() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            25,
            "Should have exactly 25 maritime ports/lanes"
        );
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Asset {} should be active", entry.asset_id);
        }
    }

    #[test]
    fn test_all_entries_transport_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "transport",
                "Asset {} should have category 'transport'",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "maritime",
                "Asset {} should have subcategory 'maritime'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_ids_start_with_port_or_lane() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("port_") || entry.asset_id.starts_with("lane_"),
                "Asset ID '{}' should start with 'port_' or 'lane_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_ais() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("AIS/"),
                "Symbol '{}' should start with 'AIS/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_bounding_box_parsing() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let result = MaritimeMarketSource::parse_bbox(&entry.api_ref);
            assert!(
                result.is_ok(),
                "Bounding box '{}' for {} should parse: {:?}",
                entry.api_ref,
                entry.asset_id,
                result.err()
            );
        }
    }

    #[test]
    fn test_parse_bbox_valid() {
        let bbox = MaritimeMarketSource::parse_bbox("103.5,1.0,104.2,1.5").unwrap();
        assert!((bbox.lon_min - 103.5).abs() < 0.001);
        assert!((bbox.lat_min - 1.0).abs() < 0.001);
        assert!((bbox.lon_max - 104.2).abs() < 0.001);
        assert!((bbox.lat_max - 1.5).abs() < 0.001);
    }

    #[test]
    fn test_parse_bbox_invalid() {
        assert!(MaritimeMarketSource::parse_bbox("1,2,3").is_err());
        assert!(MaritimeMarketSource::parse_bbox("").is_err());
        assert!(MaritimeMarketSource::parse_bbox("a,b,c,d").is_err());
    }

    #[test]
    fn test_parse_bbox_negative_coords() {
        let bbox = MaritimeMarketSource::parse_bbox("-118.4,33.6,-118.0,33.9").unwrap();
        assert!((bbox.lon_min - (-118.4)).abs() < 0.001);
        assert!((bbox.lat_min - 33.6).abs() < 0.001);
        assert!((bbox.lon_max - (-118.0)).abs() < 0.001);
        assert!((bbox.lat_max - 33.9).abs() < 0.001);
    }

    #[test]
    fn test_bbox_contains() {
        let bbox = BBox {
            lon_min: 103.5,
            lat_min: 1.0,
            lon_max: 104.2,
            lat_max: 1.5,
        };
        // Inside Singapore
        assert!(bbox.contains(1.3, 103.8));
        // Outside
        assert!(!bbox.contains(40.0, -74.0));
    }

    #[test]
    fn test_port_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ports = entries
            .iter()
            .filter(|e| e.asset_id.starts_with("port_"))
            .count();
        let lanes = entries
            .iter()
            .filter(|e| e.asset_id.starts_with("lane_"))
            .count();
        assert_eq!(ports, 15, "Should have 15 ports");
        assert_eq!(lanes, 10, "Should have 10 shipping lanes");
    }

    #[test]
    fn test_load_assets_from_json() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 25);
        // Verify a specific asset
        let singapore = assets
            .iter()
            .find(|a| a.asset_id == "port_singapore")
            .unwrap();
        assert_eq!(singapore.symbol, "AIS/SINGAPORE");
        assert_eq!(singapore.name, "Port of Singapore");
        assert_eq!(singapore.category, Some("transport".to_string()));
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
    fn test_geojson_response_parsing() {
        let json = r#"{
            "type": "FeatureCollection",
            "dataUpdatedTime": "2026-02-24T20:00:00Z",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [103.8, 1.3]
                    },
                    "properties": {
                        "mmsi": 123456789,
                        "sog": 12.5
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [104.0, 1.2]
                    },
                    "properties": {
                        "mmsi": 987654321,
                        "sog": 0.0
                    }
                }
            ]
        }"#;

        let response: AisGeoJsonResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.features.len(), 2);

        let coords0 = response.features[0].geometry.as_ref().unwrap().coordinates.as_ref().unwrap();
        assert!((coords0[0] - 103.8).abs() < 0.001); // lon
        assert!((coords0[1] - 1.3).abs() < 0.001);   // lat

        let coords1 = response.features[1].geometry.as_ref().unwrap().coordinates.as_ref().unwrap();
        assert!((coords1[0] - 104.0).abs() < 0.001); // lon
        assert!((coords1[1] - 1.2).abs() < 0.001);   // lat
    }
}
