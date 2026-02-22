//! OpenSky Flight Tracking client implementing MarketDataSource
//!
//! Tracks aircraft counts across 25 global airspace regions and airport areas
//! using the OpenSky Network REST API.
//!
//! Each region is defined by a bounding box. The value for each asset is the
//! count of aircraft currently in that airspace.
//!
//! API: https://opensky-network.org/api/states/all?lamin=...&lamax=...&lomin=...&lomax=...
//! Auth: None (anonymous access)
//! Rate limit: 10s cooldown between requests (anonymous), ~6 req/min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — 25 global airspace monitoring regions
const ASSET_JSON: &str = include_str!("../../../config/flights.json");

/// OpenSky API base URL
const API_BASE: &str = "https://opensky-network.org/api/states/all";

/// Delay between sequential region fetches (ms) — OpenSky requires 10s+ cooldown
const INTER_REQUEST_DELAY_MS: u64 = 11000;

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
    /// null if no aircraft in the bounding box.
    states: Option<Vec<serde_json::Value>>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// OpenSky flight tracking market data source.
///
/// Tracks aircraft counts across 25 global airspace regions.
/// Source ID is `"flights"`.
pub struct FlightsMarketSource {
    http: SourceHttpClient,
}

impl FlightsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 6,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("OpenSky flights source initialized (25 regions)");

        Ok(Self { http })
    }

    /// Build the OpenSky API URL for a given bounding box.
    /// Bounding box format in config: "lat_min,lat_max,lon_min,lon_max"
    fn build_url(bbox: &str) -> Result<String, SourceError> {
        let parts: Vec<&str> = bbox.split(',').collect();
        if parts.len() != 4 {
            return Err(SourceError::DataError(format!(
                "Invalid bounding box format '{}': expected 'lat_min,lat_max,lon_min,lon_max'",
                bbox
            )));
        }

        Ok(format!(
            "{}?lamin={}&lamax={}&lomin={}&lomax={}",
            API_BASE,
            parts[0].trim(),
            parts[1].trim(),
            parts[2].trim(),
            parts[3].trim()
        ))
    }

    /// Parse bounding box string into (lat_min, lat_max, lon_min, lon_max).
    /// Used for validation in tests.
    fn parse_bbox(bbox: &str) -> Result<(f64, f64, f64, f64), String> {
        let parts: Vec<&str> = bbox.split(',').collect();
        if parts.len() != 4 {
            return Err(format!(
                "Expected 4 components, got {} in '{}'",
                parts.len(),
                bbox
            ));
        }
        let lat_min: f64 = parts[0].trim().parse().map_err(|e| format!("lat_min: {}", e))?;
        let lat_max: f64 = parts[1].trim().parse().map_err(|e| format!("lat_max: {}", e))?;
        let lon_min: f64 = parts[2].trim().parse().map_err(|e| format!("lon_min: {}", e))?;
        let lon_max: f64 = parts[3].trim().parse().map_err(|e| format!("lon_max: {}", e))?;
        Ok((lat_min, lat_max, lon_min, lon_max))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FlightsMarketSource {
    fn source_id(&self) -> &'static str {
        "flights"
    }

    fn display_name(&self) -> &'static str {
        "OpenSky Flights"
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
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("Flights fetch_assets: {} regions loaded", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Load asset config to get bounding boxes
        let all_entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let bbox_map: HashMap<&str, &str> = all_entries
            .iter()
            .map(|e| (e.asset_id.as_str(), e.api_ref.as_str()))
            .collect();

        debug!(
            "Flights fetch_prices: fetching {} regions (expect ~{}s total due to rate limit)",
            asset_ids.len(),
            asset_ids.len() * 11
        );

        for asset_id in asset_ids {
            let bbox = match bbox_map.get(asset_id.as_str()) {
                Some(b) => *b,
                None => {
                    warn!("Flights: unknown asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

            let url = match Self::build_url(bbox) {
                Ok(u) => u,
                Err(e) => {
                    warn!("Flights: bad bounding box for {}: {:?}", asset_id, e);
                    continue;
                }
            };

            // OpenSky requires 10s+ between requests for anonymous access
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.http.get_json::<OpenSkyResponse>(&url).await {
                Ok(response) => {
                    let aircraft_count = response
                        .states
                        .as_ref()
                        .map(|s| s.len())
                        .unwrap_or(0);

                    debug!(
                        "Flights {}: {} aircraft (bbox={})",
                        asset_id, aircraft_count, bbox
                    );

                    let symbol = all_entries
                        .iter()
                        .find(|e| e.asset_id == *asset_id)
                        .map(|e| e.symbol.clone())
                        .unwrap_or_else(|| format!("FLT/{}", asset_id));

                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol,
                        value: Decimal::from(aircraft_count as u64),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Err(e) => {
                    warn!(
                        "Error fetching flight data for {} (bbox={}): {:?}",
                        asset_id, bbox, e
                    );
                }
            }
        }

        info!(
            "Fetched {}/{} prices from OpenSky",
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
        let (lat_min, lat_max, lon_min, lon_max) =
            FlightsMarketSource::parse_bbox("40.4,40.9,-74,-73.5").unwrap();
        assert!((lat_min - 40.4).abs() < 0.001);
        assert!((lat_max - 40.9).abs() < 0.001);
        assert!((lon_min - (-74.0)).abs() < 0.001);
        assert!((lon_max - (-73.5)).abs() < 0.001);
    }

    #[test]
    fn test_parse_bbox_invalid() {
        assert!(FlightsMarketSource::parse_bbox("1,2,3").is_err());
        assert!(FlightsMarketSource::parse_bbox("").is_err());
        assert!(FlightsMarketSource::parse_bbox("a,b,c,d").is_err());
    }

    #[test]
    fn test_build_url() {
        let url = FlightsMarketSource::build_url("40.4,40.9,-74,-73.5").unwrap();
        assert!(url.contains("lamin=40.4"));
        assert!(url.contains("lamax=40.9"));
        assert!(url.contains("lomin=-74"));
        assert!(url.contains("lomax=-73.5"));
        assert!(url.starts_with("https://opensky-network.org/api/states/all?"));
    }

    #[test]
    fn test_build_url_invalid() {
        let result = FlightsMarketSource::build_url("1,2,3");
        assert!(result.is_err());
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
