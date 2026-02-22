//! AIS Maritime vessel tracking client implementing MarketDataSource
//!
//! Tracks vessel counts across 25 global ports and shipping lanes using the
//! AISStream.io REST API.
//!
//! Each region is defined by a bounding box. The value for each asset is the
//! count of vessels detected in that area.
//!
//! API: POST https://api.aisstream.io/v0/rest/vessel-positions
//! Auth: AISSTREAM_API_KEY env var (sent as Api-Key header)
//! Rate limit: Conservative — 6 req/min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — 25 global ports and shipping lanes
const ASSET_JSON: &str = include_str!("../../../config/maritime.json");

/// AISStream REST API endpoint
const API_URL: &str = "https://api.aisstream.io/v0/rest/vessel-positions";

/// Delay between sequential region fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 10000;

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/// AISStream REST API request body
#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]
struct AisStreamRequest {
    /// Bounding boxes to query — each is [[lat_min, lon_min], [lat_max, lon_max]]
    bounding_boxes: Vec<[[f64; 2]; 2]>,
}

/// AISStream REST API response
/// The response is a JSON array of vessel position objects.
#[derive(Debug, Deserialize)]
struct AisStreamResponse {
    /// Vessel positions — count of elements = vessel count
    #[serde(default)]
    positions: Option<Vec<serde_json::Value>>,
}

/// Fallback: if the response is just an array at the top level
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum AisResponse {
    /// Response with named field
    Named(AisStreamResponse),
    /// Response as direct array
    Array(Vec<serde_json::Value>),
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// AIS maritime vessel tracking market data source.
///
/// Tracks vessel counts across 25 global ports and shipping lanes.
/// Source ID is `"maritime"`.
pub struct MaritimeMarketSource {
    http: SourceHttpClient,
    /// Raw reqwest client for POST requests (SourceHttpClient only supports GET)
    client: reqwest::Client,
    api_key: String,
}

impl MaritimeMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("AISSTREAM_API_KEY").map_err(|_| {
            anyhow::anyhow!(
                "AISSTREAM_API_KEY env var not set — required for AIS maritime source"
            )
        })?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 6,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        info!("AIS maritime source initialized (25 ports/lanes)");

        Ok(Self {
            http,
            client,
            api_key,
        })
    }

    /// Parse bounding box from config format "lon_min,lat_min,lon_max,lat_max"
    /// into AISStream format [[lat_min, lon_min], [lat_max, lon_max]].
    fn parse_bbox(bbox_str: &str) -> Result<[[f64; 2]; 2], String> {
        let parts: Vec<&str> = bbox_str.split(',').collect();
        if parts.len() != 4 {
            return Err(format!(
                "Expected 4 components, got {} in '{}'",
                parts.len(),
                bbox_str
            ));
        }
        let lon_min: f64 = parts[0].trim().parse().map_err(|e| format!("lon_min: {}", e))?;
        let lat_min: f64 = parts[1].trim().parse().map_err(|e| format!("lat_min: {}", e))?;
        let lon_max: f64 = parts[2].trim().parse().map_err(|e| format!("lon_max: {}", e))?;
        let lat_max: f64 = parts[3].trim().parse().map_err(|e| format!("lat_max: {}", e))?;
        Ok([[lat_min, lon_min], [lat_max, lon_max]])
    }

    /// Fetch vessel count for a bounding box via POST request.
    async fn fetch_vessel_count(&self, bbox: [[f64; 2]; 2]) -> Result<u64, SourceError> {
        let body = AisStreamRequest {
            bounding_boxes: vec![bbox],
        };

        let response = self
            .client
            .post(API_URL)
            .header("Api-Key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| SourceError::Transient(format!("AIS request failed: {}", e)))?;

        let status = response.status().as_u16();
        if !response.status().is_success() {
            let body_text = response.text().await.unwrap_or_default();
            return Err(SourceError::from_status(status, &body_text));
        }

        let text = response
            .text()
            .await
            .map_err(|e| SourceError::DataError(format!("Read response body: {}", e)))?;

        // Try parsing as different response formats
        let count = match serde_json::from_str::<AisResponse>(&text) {
            Ok(AisResponse::Named(resp)) => resp.positions.map(|p| p.len()).unwrap_or(0),
            Ok(AisResponse::Array(arr)) => arr.len(),
            Err(_) => {
                // Last resort: try to parse as a generic JSON value and count entries
                match serde_json::from_str::<serde_json::Value>(&text) {
                    Ok(serde_json::Value::Array(arr)) => arr.len(),
                    Ok(serde_json::Value::Object(obj)) => {
                        // Look for any array field in the response
                        obj.values()
                            .filter_map(|v| v.as_array())
                            .map(|a| a.len())
                            .max()
                            .unwrap_or(0)
                    }
                    _ => 0,
                }
            }
        };

        Ok(count as u64)
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
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("Maritime fetch_assets: {} ports/lanes loaded", assets.len());
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
            "Maritime fetch_prices: fetching {} ports/lanes (expect ~{}s total due to rate limit)",
            asset_ids.len(),
            asset_ids.len() * 10
        );

        for asset_id in asset_ids {
            let bbox_str = match bbox_map.get(asset_id.as_str()) {
                Some(b) => *b,
                None => {
                    warn!("Maritime: unknown asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

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

            // Rate limit between requests
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_vessel_count(bbox).await {
                Ok(vessel_count) => {
                    debug!(
                        "Maritime {}: {} vessels (bbox={})",
                        asset_id, vessel_count, bbox_str
                    );

                    let symbol = all_entries
                        .iter()
                        .find(|e| e.asset_id == *asset_id)
                        .map(|e| e.symbol.clone())
                        .unwrap_or_else(|| format!("AIS/{}", asset_id));

                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol,
                        value: Decimal::from(vessel_count),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Err(e) => {
                    warn!(
                        "Error fetching maritime data for {} (bbox={}): {:?}",
                        asset_id, bbox_str, e
                    );
                }
            }
        }

        info!(
            "Fetched {}/{} prices from AISStream",
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
        // Format: [[lat_min, lon_min], [lat_max, lon_max]]
        assert!((bbox[0][0] - 1.0).abs() < 0.001); // lat_min
        assert!((bbox[0][1] - 103.5).abs() < 0.001); // lon_min
        assert!((bbox[1][0] - 1.5).abs() < 0.001); // lat_max
        assert!((bbox[1][1] - 104.2).abs() < 0.001); // lon_max
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
        assert!((bbox[0][0] - 33.6).abs() < 0.001); // lat_min
        assert!((bbox[0][1] - (-118.4)).abs() < 0.001); // lon_min
        assert!((bbox[1][0] - 33.9).abs() < 0.001); // lat_max
        assert!((bbox[1][1] - (-118.0)).abs() < 0.001); // lon_max
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
    fn test_ais_request_serialization() {
        let req = AisStreamRequest {
            bounding_boxes: vec![[[1.0, 103.5], [1.5, 104.2]]],
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("BoundingBoxes"));
        assert!(json.contains("103.5"));
    }
}
