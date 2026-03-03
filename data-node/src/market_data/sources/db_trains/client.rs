//! Deutsche Bahn train delays source implementing MarketDataSource
//!
//! Tracks average departure delay (in minutes) at ~58 major German train stations
//! using the v6.db.transport.rest API (free, no auth).
//!
//! Each station is an asset; its value is the average delay in minutes across
//! departures in the next 60 minutes. A value of 0.0 means all trains are on time.
//!
//! Assets are static -- defined in config/db_trains.json (58 stations).
//!
//! Strategy: One API call per station fetches departures with delay info.
//! Pattern B (grouped calls), ~58 calls per sync, well within 100 req/min limit.
//!
//! API: https://v6.db.transport.rest/stops/{stationId}/departures
//! Auth: None
//! Rate limit: 100 req/min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/db_trains.json");

const API_BASE: &str = "https://v6.db.transport.rest";

/// Delay between requests to individual stations (ms)
const INTER_REQUEST_DELAY: Duration = Duration::from_millis(300);

#[derive(Debug, Deserialize)]
struct Departure {
    delay: Option<i64>,
}

pub struct DbTrainsMarketSource {
    http: SourceHttpClient,
}

impl DbTrainsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Deutsche Bahn train delays source initialized");
        Ok(Self { http })
    }

    /// Fetch departures for a station and compute average delay in minutes.
    async fn fetch_station_delay(&self, station_id: &str) -> Result<Option<Decimal>> {
        let url = format!(
            "{}/stops/{}/departures?duration=60&results=60",
            API_BASE, station_id
        );

        let body = match self.http.get_raw(&url).await {
            Ok(text) => text,
            Err(e) => {
                warn!("DB Trains: failed to fetch station {}: {:?}", station_id, e);
                return Ok(None);
            }
        };

        let departures: Vec<Departure> = match serde_json::from_str(&body) {
            Ok(deps) => deps,
            Err(e) => {
                warn!(
                    "DB Trains: failed to parse departures for {}: {:?}",
                    station_id, e
                );
                return Ok(None);
            }
        };

        if departures.is_empty() {
            return Ok(Some(Decimal::ZERO));
        }

        // Compute average delay in minutes. Null delay = on time (0).
        let total_delay_secs: i64 = departures
            .iter()
            .map(|d| d.delay.unwrap_or(0).max(0)) // ignore negative (early)
            .sum();

        let avg_delay_secs = total_delay_secs as f64 / departures.len() as f64;
        let avg_delay_mins = avg_delay_secs / 60.0;

        // Round to 1 decimal place
        let rounded = (avg_delay_mins * 10.0).round() / 10.0;
        Ok(Some(Decimal::from_f64_retain(rounded).unwrap_or(Decimal::ZERO)))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for DbTrainsMarketSource {
    fn source_id(&self) -> &'static str {
        "db_trains"
    }

    fn display_name(&self) -> &'static str {
        "Deutsche Bahn Train Delays"
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
                max_requests: 100,
                duration: Duration::from_secs(300),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "DB Trains fetch_assets: {} stations loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get station IDs from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let (station_id, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (station ID) for asset {}", asset_id);
                    continue;
                }
            };

            match self.fetch_station_delay(station_id).await {
                Ok(Some(value)) => {
                    debug!("DB {} avg_delay={}min", station_id, value);
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: symbol.clone(),
                        value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Ok(None) => {
                    debug!("DB {} skipped (no data)", station_id);
                }
                Err(e) => {
                    warn!("DB {} error: {:?}", station_id, e);
                }
            }

            tokio::time::sleep(INTER_REQUEST_DELAY).await;
        }

        info!(
            "Fetched {}/{} prices from Deutsche Bahn ({} station calls)",
            results.len(),
            asset_ids.len(),
            asset_ids.len()
        );
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 58, "Expected 58 station entries");
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 58, "Expected 58 active station assets");
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
            assert_eq!(entry.category, "transport", "{} should be transport", entry.asset_id);
            assert_eq!(entry.subcategory, "rail", "{} should be rail subcategory", entry.asset_id);
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("db_trains_"),
                "Asset ID {} should start with 'db_trains_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_db() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("DB/"),
                "Symbol '{}' should start with 'DB/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        ids.sort();
        let orig_len = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), orig_len, "All asset IDs should be unique");
    }

    #[test]
    fn test_unique_symbols() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut symbols: Vec<&str> = entries.iter().map(|e| e.symbol.as_str()).collect();
        symbols.sort();
        let orig_len = symbols.len();
        symbols.dedup();
        assert_eq!(symbols.len(), orig_len, "All symbols should be unique");
    }

    #[test]
    fn test_unique_station_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        let orig_len = refs.len();
        refs.dedup();
        assert_eq!(refs.len(), orig_len, "All station IDs should be unique");
    }

    #[test]
    fn test_station_ids_are_numeric() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.api_ref.chars().all(|c| c.is_ascii_digit()),
                "Station ID '{}' for {} should be all digits",
                entry.api_ref,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_known_stations_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(ids.contains(&"8011160"), "Berlin Hbf should be present");
        assert!(ids.contains(&"8000261"), "München Hbf should be present");
        assert!(ids.contains(&"8002549"), "Hamburg Hbf should be present");
        assert!(ids.contains(&"8000105"), "Frankfurt Hbf should be present");
    }

    #[test]
    fn test_parse_departures() {
        let json = r#"[
            {"delay": 120},
            {"delay": 0},
            {"delay": null},
            {"delay": 300},
            {"delay": -60}
        ]"#;
        let deps: Vec<Departure> = serde_json::from_str(json).unwrap();
        assert_eq!(deps.len(), 5);

        // Average: (120 + 0 + 0 + 300 + 0) / 5 = 84 secs = 1.4 min
        let total: i64 = deps.iter().map(|d| d.delay.unwrap_or(0).max(0)).sum();
        let avg_mins = (total as f64 / deps.len() as f64) / 60.0;
        let rounded = (avg_mins * 10.0).round() / 10.0;
        assert!((rounded - 1.4).abs() < 0.01);
    }
}
