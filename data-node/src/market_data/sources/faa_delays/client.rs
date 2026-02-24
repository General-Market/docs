//! FAA Airport Delays client implementing MarketDataSource
//!
//! Tracks US airport delay status from the FAA Airport Status Web Service.
//! Each airport is an asset; its value is 0 (no delay) or 1 (delay active).
//!
//! Assets are static -- defined in config/faa_delays.json (~30 major airports).
//! Uses rolling cursor pattern (Pattern D) since the API accepts one airport per request.
//! At 600s interval and 10 per batch, all 30 airports update every ~1800s (30 minutes).
//!
//! API: https://soa.smext.faa.gov/asws/api/airport/status/{IATA}
//! Auth: None
//! Rate limit: None documented (US government)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

// ============================================================================
// CONSTANTS
// ============================================================================

/// Asset configuration -- 30 major US airports
const ASSET_JSON: &str = include_str!("../../../config/faa_delays.json");

/// FAA Airport Status Web Service base URL
const API_BASE: &str = "https://soa.smext.faa.gov/asws/api/airport/status";

/// Number of airports to fetch per sync cycle (rolling cursor)
const BATCH_SIZE: usize = 10;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// FAA Airport Status response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct FaaAirportStatus {
    #[allow(dead_code)]
    name: Option<String>,
    #[allow(dead_code)]
    #[serde(alias = "IATA")]
    iata: Option<String>,
    delay: Option<bool>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// FAA Airport Delays market data source.
///
/// Tracks delay status for ~30 major US airports via the FAA ASWS API.
/// Source ID is `"faa_delays"`.
pub struct FaaDelaysMarketSource {
    http: SourceHttpClient,
    batch_cursor: Mutex<usize>,
}

impl FaaDelaysMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("FAA Airport Delays source initialized");
        Ok(Self {
            http,
            batch_cursor: Mutex::new(0),
        })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FaaDelaysMarketSource {
    fn source_id(&self) -> &'static str {
        "faa_delays"
    }

    fn display_name(&self) -> &'static str {
        "FAA Airport Delays"
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
            "FAA Delays fetch_assets: {} airports loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Rolling cursor -- only fetch BATCH_SIZE airports per sync
        let start = {
            let mut cursor = self.batch_cursor.lock().unwrap();
            let s = *cursor;
            *cursor = if s + BATCH_SIZE >= asset_ids.len() {
                0
            } else {
                s + BATCH_SIZE
            };
            s
        };
        let end = (start + BATCH_SIZE).min(asset_ids.len());
        let batch = &asset_ids[start..end];

        // Load config to get IATA codes from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        let mut results = Vec::with_capacity(batch.len());

        for asset_id in batch {
            let iata = match ref_map.get(asset_id) {
                Some(code) => code,
                None => {
                    warn!("No api_ref (IATA code) for asset {}", asset_id);
                    continue;
                }
            };

            let url = format!("{}/{}", API_BASE, iata);
            let status: FaaAirportStatus = match self.http.get_json(&url).await {
                Ok(data) => data,
                Err(e) => {
                    warn!("Error fetching FAA status for {}: {:?}", iata, e);
                    continue;
                }
            };

            let value = if status.delay.unwrap_or(false) {
                Decimal::from(1)
            } else {
                Decimal::ZERO
            };

            debug!("FAA {} delay={}", iata, status.delay.unwrap_or(false));

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("FAA/{}", iata.to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from FAA (batch {}-{} of {})",
            results.len(),
            batch.len(),
            start,
            end,
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
        assert!(
            entries.len() >= 25,
            "Expected >= 25 airport entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 25,
            "Expected >= 25 active airport assets, got {}",
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
                entry.subcategory, "airport",
                "Entry {} should have airport subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("faa_delays_"),
                "Asset ID {} should start with 'faa_delays_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_faa() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("FAA/"),
                "Symbol '{}' should start with 'FAA/'",
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
    fn test_unique_iata_codes() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        refs.dedup();
        assert_eq!(
            refs.len(),
            entries.len(),
            "All IATA codes (api_ref) should be unique"
        );
    }

    #[test]
    fn test_iata_codes_are_uppercase_3char() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.api_ref.len(),
                3,
                "IATA code '{}' for {} should be 3 characters",
                entry.api_ref,
                entry.asset_id
            );
            assert!(
                entry.api_ref.chars().all(|c| c.is_ascii_uppercase()),
                "IATA code '{}' for {} should be all uppercase ASCII",
                entry.api_ref,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_known_airports_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let iata_codes: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(iata_codes.contains(&"JFK"), "JFK should be present");
        assert!(iata_codes.contains(&"LAX"), "LAX should be present");
        assert!(iata_codes.contains(&"ORD"), "ORD should be present");
        assert!(iata_codes.contains(&"ATL"), "ATL should be present");
        assert!(iata_codes.contains(&"SFO"), "SFO should be present");
        assert!(iata_codes.contains(&"DEN"), "DEN should be present");
    }

    #[test]
    fn test_api_response_deserialization_no_delay() {
        let json = r#"{
            "Name": "John F Kennedy International",
            "City": "New York",
            "State": "NY",
            "IATA": "JFK",
            "ICAO": "KJFK",
            "Delay": false,
            "Status": [{"Reason": "No known delays for this airport"}],
            "Weather": {"Temp": ["34F (1C)"], "Wind": ["North at 15 mph"]}
        }"#;

        let status: FaaAirportStatus = serde_json::from_str(json).unwrap();
        assert_eq!(status.delay, Some(false));
        assert_eq!(status.iata.as_deref(), Some("JFK"));
        assert_eq!(status.name.as_deref(), Some("John F Kennedy International"));
    }

    #[test]
    fn test_api_response_deserialization_with_delay() {
        let json = r#"{
            "Name": "Chicago O'Hare International",
            "IATA": "ORD",
            "Delay": true,
            "Status": [{"Type": "Ground Delay", "AvgDelay": "2 hours and 5 minutes", "Reason": "WEATHER / LOW CEILINGS"}]
        }"#;

        let status: FaaAirportStatus = serde_json::from_str(json).unwrap();
        assert_eq!(status.delay, Some(true));

        let value = if status.delay.unwrap_or(false) {
            Decimal::from(1)
        } else {
            Decimal::ZERO
        };
        assert_eq!(value, Decimal::from(1));
    }

    #[test]
    fn test_api_response_deserialization_missing_delay() {
        // Some airports may return minimal JSON without the Delay field
        let json = r#"{"Name": "Test Airport"}"#;
        let status: FaaAirportStatus = serde_json::from_str(json).unwrap();
        assert_eq!(status.delay, None);

        // Missing delay should default to "no delay" (0)
        let value = if status.delay.unwrap_or(false) {
            Decimal::from(1)
        } else {
            Decimal::ZERO
        };
        assert_eq!(value, Decimal::ZERO);
    }

    #[test]
    fn test_entry_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            30,
            "Expected exactly 30 airport entries, got {}",
            entries.len()
        );
    }
}
