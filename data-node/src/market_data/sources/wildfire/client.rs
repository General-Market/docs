//! NASA FIRMS Wildfires client implementing MarketDataSource
//!
//! Tracks active fire hotspot counts across 20 global regions using NASA's
//! Fire Information for Resource Management System (FIRMS) VIIRS data.
//!
//! Each region is defined by a bounding box. The value for each asset is the
//! count of active fire hotspots detected in that region.
//!
//! API: https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{area}/1
//! Auth: NASA_FIRMS_MAP_KEY env var
//! Rate limit: Conservative — 2 req/min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — 20 global wildfire monitoring regions
const ASSET_JSON: &str = include_str!("../../../config/wildfire.json");

/// NASA FIRMS API base URL
const API_BASE: &str = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";

/// Delay between sequential region fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 3000;

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// NASA FIRMS wildfire hotspot market data source.
///
/// Tracks active fire hotspot counts across 20 global regions.
/// Source ID is `"wildfire"`.
pub struct WildfireMarketSource {
    http: SourceHttpClient,
    map_key: String,
}

impl WildfireMarketSource {
    pub fn from_env() -> Result<Self> {
        let map_key = std::env::var("NASA_FIRMS_MAP_KEY").map_err(|_| {
            anyhow::anyhow!(
                "NASA_FIRMS_MAP_KEY env var not set — required for NASA FIRMS wildfire source"
            )
        })?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("NASA FIRMS wildfire source initialized (20 regions)");

        Ok(Self { http, map_key })
    }

    /// Build the FIRMS API URL for a given bounding box.
    /// Bounding box format: "west,south,east,north"
    fn build_url(&self, bounding_box: &str) -> String {
        format!(
            "{}/{}/VIIRS_SNPP_NRT/{}/1",
            API_BASE, self.map_key, bounding_box
        )
    }

    /// Count fire hotspots from CSV response text.
    /// First line is the header row; each subsequent line is a hotspot.
    /// Returns the count of data lines (excluding header).
    fn count_hotspots(csv_text: &str) -> u64 {
        let line_count = csv_text.lines().count();
        if line_count <= 1 {
            0
        } else {
            (line_count - 1) as u64
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for WildfireMarketSource {
    fn source_id(&self) -> &'static str {
        "wildfire"
    }

    fn display_name(&self) -> &'static str {
        "NASA FIRMS Wildfires"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(1800) // 30 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("Wildfire fetch_assets: {} regions loaded", assets.len());
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
            "Wildfire fetch_prices: fetching {} regions",
            asset_ids.len()
        );

        for asset_id in asset_ids {
            let bbox = match bbox_map.get(asset_id.as_str()) {
                Some(b) => *b,
                None => {
                    warn!("Wildfire: unknown asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

            // Rate limit between requests
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            let url = self.build_url(bbox);
            match self.http.get_raw(&url).await {
                Ok(csv_text) => {
                    let hotspot_count = Self::count_hotspots(&csv_text);
                    debug!(
                        "Wildfire {}: {} hotspots (bbox={})",
                        asset_id, hotspot_count, bbox
                    );

                    let symbol = all_entries
                        .iter()
                        .find(|e| e.asset_id == *asset_id)
                        .map(|e| e.symbol.clone())
                        .unwrap_or_else(|| format!("FIRE/{}", asset_id));

                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol,
                        value: Decimal::from(hotspot_count),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Err(e) => {
                    warn!(
                        "Error fetching wildfire data for {} (bbox={}): {:?}",
                        asset_id, bbox, e
                    );
                }
            }
        }

        info!(
            "Fetched {}/{} prices from NASA FIRMS",
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
        assert_eq!("wildfire", "wildfire");
    }

    #[test]
    fn test_config_loads_20_entries() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 20, "Should have exactly 20 wildfire regions");
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Asset {} should be active", entry.asset_id);
        }
    }

    #[test]
    fn test_all_entries_environment_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "environment",
                "Asset {} should have category 'environment'",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "wildfire",
                "Asset {} should have subcategory 'wildfire'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_ids_start_with_fire() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("fire_"),
                "Asset ID '{}' should start with 'fire_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_fire() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("FIRE/"),
                "Symbol '{}' should start with 'FIRE/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_bounding_box_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let parts: Vec<&str> = entry.api_ref.split(',').collect();
            assert_eq!(
                parts.len(),
                4,
                "Bounding box '{}' for {} should have 4 components (west,south,east,north)",
                entry.api_ref,
                entry.asset_id
            );
            // Each part should parse as a float
            for (i, part) in parts.iter().enumerate() {
                let _val: f64 = part.parse().unwrap_or_else(|_| {
                    panic!(
                        "Bounding box component {} ('{}') for {} should be a valid number",
                        i, part, entry.asset_id
                    )
                });
            }
        }
    }

    #[test]
    fn test_count_hotspots_empty() {
        assert_eq!(WildfireMarketSource::count_hotspots(""), 0);
    }

    #[test]
    fn test_count_hotspots_header_only() {
        let csv = "latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight";
        assert_eq!(WildfireMarketSource::count_hotspots(csv), 0);
    }

    #[test]
    fn test_count_hotspots_with_data() {
        let csv = "latitude,longitude,brightness,scan,track\n\
                    34.5,-118.2,320.1,0.4,0.3\n\
                    35.1,-117.8,315.6,0.5,0.4\n\
                    33.9,-119.0,310.2,0.3,0.3";
        assert_eq!(WildfireMarketSource::count_hotspots(csv), 3);
    }

    #[test]
    fn test_count_hotspots_single_data_line() {
        let csv = "header\ndata_row";
        assert_eq!(WildfireMarketSource::count_hotspots(csv), 1);
    }

    #[test]
    fn test_load_assets_from_json() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 20);
        // Verify first asset
        let first = assets.iter().find(|a| a.asset_id == "fire_us_west").unwrap();
        assert_eq!(first.symbol, "FIRE/US_WEST");
        assert_eq!(first.name, "US West Coast");
        assert_eq!(first.category, Some("environment".to_string()));
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
