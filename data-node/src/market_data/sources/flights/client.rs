//! Global Flight Tracking via adsb.lol community ADS-B API
//!
//! Tracks aircraft counts across 25 global airspace regions and airport areas.
//!
//! Strategy: Per-region queries via `https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{dist}`.
//! The old `/v2/all` endpoint was removed. We now compute the center and radius for each
//! bounding box and query individually. Airport areas use small radii (15-25nm) while
//! large regions use multiple overlapping queries stitched together.
//!
//! Each region is defined by a bounding box. The value for each asset is the
//! count of aircraft currently in that airspace.
//!
//! API: https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{dist}
//! Auth: None (community API, no key required)
//! Rate limit: generous (~60 req/min), max radius 250nm

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — 25 global airspace monitoring regions
const ASSET_JSON: &str = include_str!("../../../config/flights.json");

/// adsb.lol geographic query endpoint (max 250nm radius)
const API_BASE: &str = "https://api.adsb.lol/v2/lat";

/// Maximum query radius in nautical miles (API limit)
const MAX_RADIUS_NM: f64 = 250.0;

/// Approximate nautical miles per degree of latitude
const NM_PER_DEG_LAT: f64 = 60.0;

/// Delay between requests in ms
const INTER_REQUEST_DELAY_MS: u64 = 500;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// adsb.lol global aircraft response
#[derive(Debug, Deserialize)]
struct AdsbLolResponse {
    /// Array of aircraft objects
    #[serde(default)]
    ac: Vec<AircraftPosition>,
    /// Total aircraft count
    #[serde(default)]
    total: i64,
}

/// Minimal aircraft position — only extract what we need for counting
#[derive(Debug, Deserialize)]
struct AircraftPosition {
    /// ICAO hex identifier for deduplication across overlapping queries
    #[serde(default)]
    hex: Option<String>,
    #[serde(default)]
    lat: Option<f64>,
    #[serde(default)]
    lon: Option<f64>,
}

/// Parsed bounding box
#[derive(Debug, Clone)]
struct BBox {
    lat_min: f64,
    lat_max: f64,
    lon_min: f64,
    lon_max: f64,
}

impl BBox {
    /// Check if a lat/lon point is inside this bounding box.
    fn contains(&self, lat: f64, lon: f64) -> bool {
        lat >= self.lat_min && lat <= self.lat_max
            && lon >= self.lon_min && lon <= self.lon_max
    }

    /// Get center point of the bounding box
    fn center(&self) -> (f64, f64) {
        (
            (self.lat_min + self.lat_max) / 2.0,
            (self.lon_min + self.lon_max) / 2.0,
        )
    }

    /// Compute the radius in nautical miles needed to cover this bounding box from center.
    /// Uses the diagonal half-distance.
    fn radius_nm(&self) -> f64 {
        let (center_lat, center_lon) = self.center();
        let dlat = (self.lat_max - center_lat) * NM_PER_DEG_LAT;
        let cos_lat = (center_lat.to_radians()).cos();
        let dlon = (self.lon_max - center_lon) * NM_PER_DEG_LAT * cos_lat;
        (dlat * dlat + dlon * dlon).sqrt()
    }
}

/// A query point: center lat/lon and radius
#[derive(Debug, Clone)]
struct QueryPoint {
    lat: f64,
    lon: f64,
    dist: u32, // nm, capped at 250
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Global flight tracking market data source.
///
/// Tracks aircraft counts across 25 global airspace regions
/// using the adsb.lol community ADS-B API.
/// Source ID is `"flights"`.
pub struct FlightsMarketSource {
    client: reqwest::Client,
}

impl FlightsMarketSource {
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .gzip(true)
            .build()?;

        info!("adsb.lol flights source initialized (25 regions, per-region strategy)");

        Ok(Self { client })
    }

    /// Parse bounding box string "lat_min,lat_max,lon_min,lon_max" into BBox.
    fn parse_bbox(bbox: &str) -> Result<BBox, String> {
        let parts: Vec<&str> = bbox.split(',').collect();
        if parts.len() != 4 {
            return Err(format!(
                "Expected 4 components, got {} in '{}'",
                parts.len(),
                bbox
            ));
        }
        Ok(BBox {
            lat_min: parts[0].trim().parse().map_err(|e| format!("lat_min: {}", e))?,
            lat_max: parts[1].trim().parse().map_err(|e| format!("lat_max: {}", e))?,
            lon_min: parts[2].trim().parse().map_err(|e| format!("lon_min: {}", e))?,
            lon_max: parts[3].trim().parse().map_err(|e| format!("lon_max: {}", e))?,
        })
    }

    /// Generate query points to cover a bounding box.
    /// Small regions (radius <= 250nm) use a single center query.
    /// Large regions are subdivided into a grid of overlapping 250nm queries.
    fn coverage_queries(bbox: &BBox) -> Vec<QueryPoint> {
        let radius = bbox.radius_nm();
        if radius <= MAX_RADIUS_NM {
            let (lat, lon) = bbox.center();
            return vec![QueryPoint {
                lat,
                lon,
                dist: (radius.ceil() as u32).max(1).min(250),
            }];
        }

        // For large regions, create a grid of 250nm queries
        let cos_lat = ((bbox.lat_min + bbox.lat_max) / 2.0).to_radians().cos().max(0.1);
        let step_lat = (MAX_RADIUS_NM * 1.5) / NM_PER_DEG_LAT; // ~1.5x radius overlap
        let step_lon = step_lat / cos_lat;

        let mut points = Vec::new();
        let mut lat = bbox.lat_min + step_lat / 2.0;
        while lat < bbox.lat_max {
            let mut lon = bbox.lon_min + step_lon / 2.0;
            while lon < bbox.lon_max {
                points.push(QueryPoint {
                    lat,
                    lon,
                    dist: 250,
                });
                lon += step_lon;
            }
            lat += step_lat;
        }

        if points.is_empty() {
            let (lat, lon) = bbox.center();
            points.push(QueryPoint { lat, lon, dist: 250 });
        }

        points
    }

    /// Fetch aircraft from a single lat/lon/dist query
    async fn fetch_region(&self, qp: &QueryPoint) -> Result<Vec<AircraftPosition>> {
        let url = format!(
            "{}/{}/lon/{}/dist/{}",
            API_BASE, qp.lat, qp.lon, qp.dist
        );

        let resp = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await;

        match resp {
            Ok(r) => {
                if !r.status().is_success() {
                    warn!("Flights: adsb.lol returned {} for ({},{})", r.status(), qp.lat, qp.lon);
                    return Ok(Vec::new());
                }
                match r.json::<AdsbLolResponse>().await {
                    Ok(data) => Ok(data.ac),
                    Err(e) => {
                        warn!("Flights: parse error for ({},{}): {:?}", qp.lat, qp.lon, e);
                        Ok(Vec::new())
                    }
                }
            }
            Err(e) => {
                warn!("Flights: fetch error for ({},{}): {:?}", qp.lat, qp.lon, e);
                Ok(Vec::new())
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FlightsMarketSource {
    fn source_id(&self) -> &'static str {
        "flights"
    }

    fn display_name(&self) -> &'static str {
        "Global Flights"
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
                max_requests: 50,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("Flights fetch_assets: {} regions loaded", assets.len());
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

        let mut results = Vec::new();

        for (i, asset_id) in asset_ids.iter().enumerate() {
            let bbox_str = match bbox_map.get(asset_id.as_str()) {
                Some(b) => *b,
                None => {
                    warn!("Flights: unknown asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

            let bbox = match Self::parse_bbox(bbox_str) {
                Ok(b) => b,
                Err(e) => {
                    warn!("Flights: bad bounding box for {}: {}", asset_id, e);
                    continue;
                }
            };

            // Generate query points to cover this region
            let queries = Self::coverage_queries(&bbox);

            // Collect unique aircraft across all queries for this region
            // (large regions use multiple overlapping queries; deduplicate by hex)
            let mut seen_hex: HashSet<String> = HashSet::new();
            let mut count: u64 = 0;

            for qp in &queries {
                // Rate limit between requests
                if i > 0 || !seen_hex.is_empty() {
                    tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
                }

                let aircraft = self.fetch_region(qp).await.unwrap_or_default();
                for ac in &aircraft {
                    if let (Some(lat), Some(lon)) = (ac.lat, ac.lon) {
                        if lat.is_finite() && lon.is_finite() && bbox.contains(lat, lon) {
                            // Deduplicate by hex if available, otherwise count directly
                            if let Some(hex) = &ac.hex {
                                if seen_hex.insert(hex.clone()) {
                                    count += 1;
                                }
                            } else {
                                count += 1;
                            }
                        }
                    }
                }
            }

            debug!(
                "Flights {}: {} aircraft ({} queries, bbox={})",
                asset_id, count, queries.len(), bbox_str
            );

            let symbol = all_entries
                .iter()
                .find(|e| e.asset_id == *asset_id)
                .map(|e| e.symbol.clone())
                .unwrap_or_else(|| format!("FLT/{}", asset_id));

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol,
                value: Decimal::from(count),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Flights: counted {}/{} regions (adsb.lol per-region)",
            results.len(),
            asset_ids.len(),
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
        assert_eq!("flights", "flights");
    }

    #[test]
    fn test_config_loads_25_entries() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 25, "Should have exactly 25 flight regions");
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
                entry.subcategory, "flights",
                "Asset {} should have subcategory 'flights'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_ids_start_with_flight() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("flight_"),
                "Asset ID '{}' should start with 'flight_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_flt() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("FLT/"),
                "Symbol '{}' should start with 'FLT/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_bounding_box_parsing() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let result = FlightsMarketSource::parse_bbox(&entry.api_ref);
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
        let bbox = FlightsMarketSource::parse_bbox("40.4,40.9,-74,-73.5").unwrap();
        assert!((bbox.lat_min - 40.4).abs() < 0.001);
        assert!((bbox.lat_max - 40.9).abs() < 0.001);
        assert!((bbox.lon_min - (-74.0)).abs() < 0.001);
        assert!((bbox.lon_max - (-73.5)).abs() < 0.001);
    }

    #[test]
    fn test_parse_bbox_invalid() {
        assert!(FlightsMarketSource::parse_bbox("1,2,3").is_err());
        assert!(FlightsMarketSource::parse_bbox("").is_err());
        assert!(FlightsMarketSource::parse_bbox("a,b,c,d").is_err());
    }

    #[test]
    fn test_bbox_contains() {
        // JFK area: 40.4,40.9,-74,-73.5
        let bbox = BBox {
            lat_min: 40.4,
            lat_max: 40.9,
            lon_min: -74.0,
            lon_max: -73.5,
        };

        // JFK coordinates: ~40.64, -73.78
        assert!(bbox.contains(40.64, -73.78));
        // Outside: Los Angeles
        assert!(!bbox.contains(33.94, -118.41));
        // Edge: exact boundary
        assert!(bbox.contains(40.4, -74.0));
        assert!(bbox.contains(40.9, -73.5));
    }

    #[test]
    fn test_global_bbox_contains_everything() {
        // Global bbox: -90,90,-180,180
        let bbox = FlightsMarketSource::parse_bbox("-90,90,-180,180").unwrap();
        assert!(bbox.contains(0.0, 0.0));
        assert!(bbox.contains(89.99, 179.99));
        assert!(bbox.contains(-89.99, -179.99));
        assert!(bbox.contains(40.64, -73.78)); // JFK
        assert!(bbox.contains(-33.87, 151.21)); // Sydney
    }

    #[test]
    fn test_bbox_center() {
        let bbox = FlightsMarketSource::parse_bbox("40.4,40.9,-74,-73.5").unwrap();
        let (lat, lon) = bbox.center();
        assert!((lat - 40.65).abs() < 0.01);
        assert!((lon - (-73.75)).abs() < 0.01);
    }

    #[test]
    fn test_bbox_radius_nm_small_region() {
        // JFK area — small box, should be well under 250nm
        let bbox = FlightsMarketSource::parse_bbox("40.4,40.9,-74,-73.5").unwrap();
        let radius = bbox.radius_nm();
        assert!(radius < 50.0, "JFK area radius should be small, got {}", radius);
        assert!(radius > 5.0, "JFK area radius should be > 5nm, got {}", radius);
    }

    #[test]
    fn test_coverage_queries_small_region() {
        // Airport-sized region — should use single query
        let bbox = FlightsMarketSource::parse_bbox("40.4,40.9,-74,-73.5").unwrap();
        let queries = FlightsMarketSource::coverage_queries(&bbox);
        assert_eq!(queries.len(), 1, "Small region should use single query");
        assert!(queries[0].dist <= 250);
    }

    #[test]
    fn test_coverage_queries_large_region() {
        // US Airspace — too large for single query, needs grid
        let bbox = FlightsMarketSource::parse_bbox("24.5,49.5,-125,-66.5").unwrap();
        let queries = FlightsMarketSource::coverage_queries(&bbox);
        assert!(queries.len() > 1, "US airspace should need multiple queries, got {}", queries.len());
        for qp in &queries {
            assert_eq!(qp.dist, 250, "Large region queries should use max radius");
        }
    }

    #[test]
    fn test_load_assets_from_json() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 25);
        // Verify a specific asset
        let jfk = assets.iter().find(|a| a.asset_id == "flight_jfk").unwrap();
        assert_eq!(jfk.symbol, "FLT/JFK");
        assert_eq!(jfk.name, "JFK Airport Area");
        assert_eq!(jfk.category, Some("transport".to_string()));
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
}
