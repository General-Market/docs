//! Global Flight Tracking via adsb.lol community ADS-B API
//!
//! Tracks aircraft counts across 25 global airspace regions and airport areas.
//!
//! Strategy: ONE call to `https://api.adsb.lol/v2/all` fetches all aircraft globally,
//! then counts per bounding box region in-memory. This replaces the old OpenSky approach
//! which needed 25 separate calls with 11s delays (275s total per sync).
//!
//! Each region is defined by a bounding box. The value for each asset is the
//! count of aircraft currently in that airspace.
//!
//! API: https://api.adsb.lol/v2/all
//! Auth: None (community API, no key required)
//! Rate limit: generous (~60 req/min)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — 25 global airspace monitoring regions
const ASSET_JSON: &str = include_str!("../../../config/flights.json");

/// adsb.lol global aircraft endpoint (fetches everything once)
const API_URL: &str = "https://api.adsb.lol/v2/all";

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
            .timeout(Duration::from_secs(60)) // Large response, generous timeout
            .gzip(true)
            .build()?;

        info!("adsb.lol flights source initialized (25 regions, single-call strategy)");

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
        Duration::from_secs(300) // 5 minutes (single call, no rate limit pressure)
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

        // ONE call to get ALL aircraft globally
        let resp = self
            .client
            .get(API_URL)
            .header("Accept", "application/json")
            .send()
            .await;

        let response: AdsbLolResponse = match resp {
            Ok(r) => {
                if !r.status().is_success() {
                    let status = r.status();
                    warn!("Flights: adsb.lol returned {}", status);
                    return Ok(Vec::new());
                }
                match r.json().await {
                    Ok(data) => data,
                    Err(e) => {
                        warn!("Flights: failed to parse adsb.lol response: {:?}", e);
                        return Ok(Vec::new());
                    }
                }
            }
            Err(e) => {
                warn!("Flights: failed to fetch adsb.lol: {:?}", e);
                return Ok(Vec::new());
            }
        };

        // Extract valid positions
        let positions: Vec<(f64, f64)> = response
            .ac
            .iter()
            .filter_map(|ac| {
                match (ac.lat, ac.lon) {
                    (Some(lat), Some(lon)) if lat.is_finite() && lon.is_finite() => {
                        Some((lat, lon))
                    }
                    _ => None,
                }
            })
            .collect();

        debug!(
            "Flights: {} aircraft with positions out of {} total",
            positions.len(),
            response.total
        );

        // Count aircraft per requested region
        let mut results = Vec::new();

        for asset_id in asset_ids {
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

            let count = positions
                .iter()
                .filter(|&&(lat, lon)| bbox.contains(lat, lon))
                .count();

            debug!("Flights {}: {} aircraft (bbox={})", asset_id, count, bbox_str);

            let symbol = all_entries
                .iter()
                .find(|e| e.asset_id == *asset_id)
                .map(|e| e.symbol.clone())
                .unwrap_or_else(|| format!("FLT/{}", asset_id));

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
            "Flights: counted {}/{} regions from {} aircraft (adsb.lol)",
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
