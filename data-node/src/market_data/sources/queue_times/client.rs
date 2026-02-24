//! Queue-Times.com theme park wait times client implementing MarketDataSource
//!
//! Tracks average ride wait times across major theme parks worldwide.
//! Each park is an asset; its value is the average wait time in minutes
//! across all currently open rides with non-zero waits.
//!
//! Assets are static -- defined in config/queue_times.json (~30 parks).
//!
//! API: https://queue-times.com
//! Auth: None
//! Rate limit: 30 req/min (conservative, no documented limit)
//! Update frequency: Every 5 minutes upstream

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration
const ASSET_JSON: &str = include_str!("../../../config/queue_times.json");

/// Queue-Times API base URL
const API_BASE: &str = "https://queue-times.com";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// A ride entry from the Queue-Times API
#[derive(Debug, Deserialize)]
struct QueueTimesRide {
    /// Ride ID
    #[allow(dead_code)]
    id: u64,
    /// Ride name
    #[allow(dead_code)]
    name: String,
    /// Whether the ride is currently open
    is_open: bool,
    /// Current wait time in minutes
    wait_time: u64,
    /// Last updated timestamp
    #[allow(dead_code)]
    last_updated: Option<String>,
}

/// A themed land/area within a park
#[derive(Debug, Deserialize)]
struct QueueTimesLand {
    /// Land name
    #[allow(dead_code)]
    name: String,
    /// Rides within this land
    rides: Vec<QueueTimesRide>,
}

/// Top-level response from /parks/{id}/queue_times.json
#[derive(Debug, Deserialize)]
struct QueueTimesResponse {
    /// Themed lands containing rides
    lands: Vec<QueueTimesLand>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Queue-Times theme park wait times market data source.
///
/// Tracks average ride wait times for ~30 major theme parks worldwide.
/// Source ID is `"queue_times"`.
pub struct QueueTimesMarketSource {
    http: SourceHttpClient,
}

impl QueueTimesMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Queue-Times theme park source initialized");

        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for QueueTimesMarketSource {
    fn source_id(&self) -> &'static str {
        "queue_times"
    }

    fn display_name(&self) -> &'static str {
        "Queue-Times Theme Parks"
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
            "Queue-Times fetch_assets: {} parks loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get api_ref (park ID) for each asset
        let entries: Vec<crate::market_data::traits::AssetEntry> =
            serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let park_id = match ref_map.get(asset_id) {
                Some(id) => id,
                None => {
                    warn!("No api_ref for asset {}", asset_id);
                    continue;
                }
            };

            let url = format!("{}/parks/{}/queue_times.json", API_BASE, park_id);
            let resp: QueueTimesResponse = match self.http.get_json(&url).await {
                Ok(data) => data,
                Err(e) => {
                    warn!(
                        "Error fetching queue times for park {} ({}): {:?}",
                        asset_id, park_id, e
                    );
                    continue;
                }
            };

            // Calculate average wait time across all open rides with non-zero waits
            let mut total_wait: u64 = 0;
            let mut open_count: u64 = 0;
            for land in &resp.lands {
                for ride in &land.rides {
                    if ride.is_open && ride.wait_time > 0 {
                        total_wait += ride.wait_time;
                        open_count += 1;
                    }
                }
            }

            let avg_wait = if open_count > 0 {
                Decimal::from(total_wait) / Decimal::from(open_count)
            } else {
                Decimal::ZERO
            };

            let park_key = asset_id
                .strip_prefix("queue_times_")
                .unwrap_or(asset_id);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("QT/{}", park_key.to_uppercase()),
                value: avg_wait,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from Queue-Times ({} parks polled)",
            results.len(),
            asset_ids.len(),
            results.len()
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
        assert!(
            entries.len() >= 20,
            "Expected >= 20 park entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 20,
            "Expected >= 20 active park assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Entry {} should be active", entry.asset_id);
        }
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
                entry.subcategory, "theme_park",
                "Entry {} should have theme_park subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("queue_times_"),
                "Asset ID {} should start with 'queue_times_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_has_exactly_30_entries() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 30, "Expected exactly 30 park entries");
    }

    #[test]
    fn test_known_parks_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"queue_times_magic_kingdom"));
        assert!(ids.contains(&"queue_times_disneyland"));
        assert!(ids.contains(&"queue_times_europa_park"));
        assert!(ids.contains(&"queue_times_tokyo_disneyland"));
        assert!(ids.contains(&"queue_times_universal_studios_japan"));
    }

    #[test]
    fn test_api_refs_are_numeric() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.api_ref.parse::<u64>().is_ok(),
                "api_ref '{}' for {} should be a numeric park ID",
                entry.api_ref,
                entry.asset_id
            );
        }
    }
}
