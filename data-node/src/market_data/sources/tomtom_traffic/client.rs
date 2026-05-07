//! TomTom Traffic Flow client implementing MarketDataSource
//!
//! Tracks real-time road congestion across ~20 major highway corridors worldwide.
//! Each road segment is an asset; its value is the congestion ratio:
//! `currentSpeed / freeFlowSpeed` (0.0 = standstill, 1.0 = free flow).
//!
//! If a road closure is reported, the value is forced to 0.0.
//!
//! Assets are static -- defined in config/tomtom_traffic.json (~20 segments).
//!
//! API: https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
//! Auth: TOMTOM_API_KEY env var (free tier: 2,500 req/day)
//! Rate limit: 100 req/day (conservative -- shared with other TomTom sources)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

/// Asset configuration
const ASSET_JSON: &str = include_str!("../../../config/tomtom_traffic.json");

/// TomTom Traffic Flow API base URL
const API_BASE: &str =
    "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";

/// Delay between individual segment requests (conservative for daily limit)
const INTER_REQUEST_DELAY: Duration = Duration::from_secs(3);

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Top-level TomTom Traffic Flow API response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TomtomFlowResponse {
    pub flow_segment_data: FlowSegmentData,
}

/// Flow segment data from TomTom API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowSegmentData {
    /// Functional Road Class (FRC0 = motorway, FRC6 = local)
    #[allow(dead_code)]
    pub frc: Option<String>,
    /// Current average speed in km/h
    pub current_speed: f64,
    /// Free-flow speed in km/h (speed with no traffic)
    pub free_flow_speed: f64,
    /// Current travel time in seconds
    #[allow(dead_code)]
    pub current_travel_time: Option<f64>,
    /// Free-flow travel time in seconds
    #[allow(dead_code)]
    pub free_flow_travel_time: Option<f64>,
    /// Confidence of the data (0.0 - 1.0)
    #[allow(dead_code)]
    pub confidence: Option<f64>,
    /// Whether the road is closed
    #[serde(default)]
    pub road_closure: bool,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// TomTom Traffic Flow market data source.
///
/// Tracks congestion ratios for ~20 major highway corridors worldwide.
/// Source ID is `"tomtom_traffic"`.
pub struct TomtomTrafficMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl TomtomTrafficMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("TOMTOM_API_KEY")
            .map_err(|_| anyhow::anyhow!("TOMTOM_API_KEY not set"))?;
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100,
                duration: Duration::from_secs(86400), // daily limit
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("TomTom Traffic source initialized");
        Ok(Self { http, api_key })
    }

    /// Compute congestion ratio from flow segment data.
    /// Returns a value between 0.0 (standstill) and 1.0 (free flow).
    /// Road closures always return 0.0.
    fn congestion_ratio(data: &FlowSegmentData) -> Option<Decimal> {
        if data.road_closure {
            return Some(Decimal::ZERO);
        }

        if data.free_flow_speed <= 0.0 {
            warn!(
                "TomTom Traffic: free_flow_speed is {} (invalid), skipping",
                data.free_flow_speed
            );
            return None;
        }

        let ratio = data.current_speed / data.free_flow_speed;
        // Cap at 1.0 (current speed should not exceed free-flow, but clamp just in case)
        let capped = ratio.min(1.0).max(0.0);
        Decimal::from_f64(capped)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TomtomTrafficMarketSource {
    fn source_id(&self) -> &'static str {
        "tomtom_traffic"
    }

    fn display_name(&self) -> &'static str {
        "TomTom Traffic Flow"
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
                max_requests: 100,
                duration: Duration::from_secs(86400),
            }],
        }
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::STATUS
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "TomTom Traffic fetch_assets: {} segments loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load asset config to get lat/lon coordinates from api_ref
        let all_entries: Vec<crate::market_data::traits::AssetEntry> =
            serde_json::from_str(ASSET_JSON)?;
        let ref_map: std::collections::HashMap<&str, (&str, &str)> = all_entries
            .iter()
            .map(|e| (e.asset_id.as_str(), (e.api_ref.as_str(), e.symbol.as_str())))
            .collect();

        let mut results = Vec::new();

        for (i, asset_id) in asset_ids.iter().enumerate() {
            let (api_ref, symbol) = match ref_map.get(asset_id.as_str()) {
                Some(r) => *r,
                None => {
                    warn!(
                        "TomTom Traffic: unknown asset_id '{}', skipping",
                        asset_id
                    );
                    continue;
                }
            };

            // Parse "lat,lon" from api_ref
            let parts: Vec<&str> = api_ref.split(',').collect();
            if parts.len() != 2 {
                warn!(
                    "TomTom Traffic: invalid api_ref '{}' for {}, expected 'lat,lon'",
                    api_ref, asset_id
                );
                continue;
            }

            let lat = parts[0].trim();
            let lon = parts[1].trim();

            let url = format!(
                "{}?point={},{}&key={}",
                API_BASE, lat, lon, self.api_key
            );

            let response: TomtomFlowResponse = match self.http.get_json(&url).await {
                Ok(data) => data,
                Err(SourceError::AuthFailed(msg)) => {
                    warn!("TomTom Traffic: auth failed: {}", msg);
                    return Ok(results); // Stop all fetching on auth failure
                }
                Err(SourceError::RateLimited(_)) => {
                    warn!("TomTom Traffic: rate limited, stopping batch");
                    return Ok(results); // Return what we have so far
                }
                Err(e) => {
                    warn!(
                        "TomTom Traffic: error fetching {}: {:?}, skipping",
                        asset_id, e
                    );
                    continue; // Skip this segment, try next
                }
            };

            let value = match Self::congestion_ratio(&response.flow_segment_data) {
                Some(v) => v,
                None => {
                    warn!(
                        "TomTom Traffic: could not compute congestion ratio for {}, skipping",
                        asset_id
                    );
                    continue;
                }
            };

            debug!(
                "TomTom Traffic {}: current={}km/h, freeflow={}km/h, ratio={}, closure={}",
                asset_id,
                response.flow_segment_data.current_speed,
                response.flow_segment_data.free_flow_speed,
                value,
                response.flow_segment_data.road_closure
            );

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: symbol.to_string(),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });

            // Delay between requests (skip after last)
            if i < asset_ids.len() - 1 {
                tokio::time::sleep(INTER_REQUEST_DELAY).await;
            }
        }

        info!(
            "Fetched {}/{} prices from TomTom Traffic Flow",
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
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            20,
            "Expected 20 traffic segment entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(
            assets.len(),
            20,
            "Expected 20 active traffic segment assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_entries_transport_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "transport",
                "Entry {} should have transport category",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "traffic",
                "Entry {} should have traffic subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("tomtom_traffic_"),
                "Asset ID '{}' should start with 'tomtom_traffic_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_api_ref_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let parts: Vec<&str> = entry.api_ref.split(',').collect();
            assert_eq!(
                parts.len(),
                2,
                "api_ref '{}' for {} should have exactly 2 comma-separated values (lat,lon)",
                entry.api_ref,
                entry.asset_id
            );
            let lat: f64 = parts[0].trim().parse().unwrap_or_else(|e| {
                panic!(
                    "api_ref lat '{}' for {} is not a valid f64: {}",
                    parts[0], entry.asset_id, e
                )
            });
            let lon: f64 = parts[1].trim().parse().unwrap_or_else(|e| {
                panic!(
                    "api_ref lon '{}' for {} is not a valid f64: {}",
                    parts[1], entry.asset_id, e
                )
            });
            assert!(
                (-90.0..=90.0).contains(&lat),
                "Latitude {} for {} out of range [-90, 90]",
                lat,
                entry.asset_id
            );
            assert!(
                (-180.0..=180.0).contains(&lon),
                "Longitude {} for {} out of range [-180, 180]",
                lon,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_parse_flow_response() {
        let json = r#"{
            "flowSegmentData": {
                "frc": "FRC0",
                "currentSpeed": 45,
                "freeFlowSpeed": 65,
                "currentTravelTime": 120,
                "freeFlowTravelTime": 82,
                "confidence": 0.95,
                "roadClosure": false
            }
        }"#;

        let resp: TomtomFlowResponse = serde_json::from_str(json).unwrap();
        assert!((resp.flow_segment_data.current_speed - 45.0).abs() < 0.001);
        assert!((resp.flow_segment_data.free_flow_speed - 65.0).abs() < 0.001);
        assert!(!resp.flow_segment_data.road_closure);
        assert_eq!(resp.flow_segment_data.frc, Some("FRC0".to_string()));
    }

    #[test]
    fn test_congestion_ratio_calculation() {
        // Normal traffic: 45/65 = ~0.692
        let data = FlowSegmentData {
            frc: Some("FRC0".to_string()),
            current_speed: 45.0,
            free_flow_speed: 65.0,
            current_travel_time: Some(120.0),
            free_flow_travel_time: Some(82.0),
            confidence: Some(0.95),
            road_closure: false,
        };
        let ratio = TomtomTrafficMarketSource::congestion_ratio(&data).unwrap();
        // 45/65 = 0.6923...
        let expected = Decimal::from_f64(45.0 / 65.0).unwrap();
        assert_eq!(ratio, expected);

        // Free flow: 65/65 = 1.0
        let data_free = FlowSegmentData {
            frc: None,
            current_speed: 65.0,
            free_flow_speed: 65.0,
            current_travel_time: None,
            free_flow_travel_time: None,
            confidence: None,
            road_closure: false,
        };
        let ratio_free = TomtomTrafficMarketSource::congestion_ratio(&data_free).unwrap();
        assert_eq!(ratio_free, Decimal::ONE);

        // Standstill: 0/65 = 0.0
        let data_stop = FlowSegmentData {
            frc: None,
            current_speed: 0.0,
            free_flow_speed: 65.0,
            current_travel_time: None,
            free_flow_travel_time: None,
            confidence: None,
            road_closure: false,
        };
        let ratio_stop = TomtomTrafficMarketSource::congestion_ratio(&data_stop).unwrap();
        assert_eq!(ratio_stop, Decimal::ZERO);

        // Over free-flow (capped at 1.0): 70/65 -> 1.0
        let data_over = FlowSegmentData {
            frc: None,
            current_speed: 70.0,
            free_flow_speed: 65.0,
            current_travel_time: None,
            free_flow_travel_time: None,
            confidence: None,
            road_closure: false,
        };
        let ratio_over = TomtomTrafficMarketSource::congestion_ratio(&data_over).unwrap();
        assert_eq!(ratio_over, Decimal::ONE);
    }

    #[test]
    fn test_road_closure_returns_zero() {
        let data = FlowSegmentData {
            frc: Some("FRC0".to_string()),
            current_speed: 45.0,
            free_flow_speed: 65.0,
            current_travel_time: Some(120.0),
            free_flow_travel_time: Some(82.0),
            confidence: Some(0.95),
            road_closure: true,
        };
        let ratio = TomtomTrafficMarketSource::congestion_ratio(&data).unwrap();
        assert_eq!(ratio, Decimal::ZERO);
    }

    #[test]
    fn test_zero_free_flow_speed_returns_none() {
        let data = FlowSegmentData {
            frc: None,
            current_speed: 10.0,
            free_flow_speed: 0.0,
            current_travel_time: None,
            free_flow_travel_time: None,
            confidence: None,
            road_closure: false,
        };
        assert!(TomtomTrafficMarketSource::congestion_ratio(&data).is_none());
    }

    #[test]
    fn test_symbols_start_with_traf() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("TRAF/"),
                "Symbol '{}' should start with 'TRAF/'",
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
        assert_eq!(
            symbols.len(),
            entries.len(),
            "All symbols should be unique"
        );
    }

    #[test]
    fn test_most_entries_active() {
        // shuto_tokyo and ring4_beijing are deliberately inactive — TomTom returns
        // HTTP 400 for those points (coverage gap). All others must be active.
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let inactive_allowlist: &[&str] = &[
            "tomtom_traffic_shuto_tokyo",
            "tomtom_traffic_ring4_beijing",
        ];
        for entry in &entries {
            if inactive_allowlist.contains(&entry.asset_id.as_str()) {
                continue;
            }
            assert!(entry.active, "Entry {} should be active", entry.asset_id);
        }
    }

    #[test]
    fn test_known_segments_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"tomtom_traffic_i405_la"));
        assert!(ids.contains(&"tomtom_traffic_m25_london"));
        assert!(ids.contains(&"tomtom_traffic_401_toronto"));
        assert!(ids.contains(&"tomtom_traffic_n1_capetown"));
    }

    #[test]
    fn test_parse_flow_response_minimal() {
        // Minimal response with only required fields
        let json = r#"{
            "flowSegmentData": {
                "currentSpeed": 30,
                "freeFlowSpeed": 60,
                "roadClosure": false
            }
        }"#;

        let resp: TomtomFlowResponse = serde_json::from_str(json).unwrap();
        assert!((resp.flow_segment_data.current_speed - 30.0).abs() < 0.001);
        assert!((resp.flow_segment_data.free_flow_speed - 60.0).abs() < 0.001);
        assert!(!resp.flow_segment_data.road_closure);
        assert!(resp.flow_segment_data.frc.is_none());
    }

    #[test]
    fn test_parse_flow_response_road_closure() {
        let json = r#"{
            "flowSegmentData": {
                "currentSpeed": 0,
                "freeFlowSpeed": 65,
                "roadClosure": true
            }
        }"#;

        let resp: TomtomFlowResponse = serde_json::from_str(json).unwrap();
        assert!(resp.flow_segment_data.road_closure);
        let ratio = TomtomTrafficMarketSource::congestion_ratio(&resp.flow_segment_data).unwrap();
        assert_eq!(ratio, Decimal::ZERO);
    }
}
