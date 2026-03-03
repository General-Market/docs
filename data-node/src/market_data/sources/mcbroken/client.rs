//! McBroken Ice Cream client implementing MarketDataSource
//!
//! Tracks McDonald's ice cream machine broken percentages per US city.
//! Each city is an asset; its value is the broken percentage (e.g. 53.33 = 53.33% broken).
//!
//! Assets are static -- defined in config/mcbroken.json (~30 US cities).
//!
//! Strategy: ONE call to stats.json fetches all city broken percentages,
//! then we match each tracked city by comparing api_ref with the city field.
//!
//! API: https://mcbroken.com/stats.json
//! Auth: None
//! Rate limit: None documented (conservative 10 req / 10 min)
//! Format: JSON

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
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

/// Asset configuration -- 30 US cities
const ASSET_JSON: &str = include_str!("../../../config/mcbroken.json");

/// McBroken stats API endpoint
const API_URL: &str = "https://mcbroken.com/stats.json";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, serde::Deserialize)]
struct McBrokenResponse {
    cities: Vec<CityEntry>,
}

#[derive(Debug, serde::Deserialize)]
struct CityEntry {
    city: String,
    broken: f64,
    total_locations: u32,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// McBroken Ice Cream market data source.
///
/// Tracks McDonald's ice cream machine broken percentages for ~30 US cities.
/// Source ID is `"mcbroken"`.
pub struct McBrokenMarketSource {
    http: SourceHttpClient,
}

impl McBrokenMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(600),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .user_agent("Mozilla/5.0 (compatible; DataNode/1.0)")
            .build()?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());
        info!("McBroken Ice Cream source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for McBrokenMarketSource {
    fn source_id(&self) -> &'static str {
        "mcbroken"
    }

    fn display_name(&self) -> &'static str {
        "McBroken Ice Cream"
    }

    fn default_resolution(&self) -> &'static str {
        "600"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "McBroken fetch_assets: {} cities loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get city names from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        // ONE call to get all city broken percentages
        let json_text = match self.http.get_raw(API_URL).await {
            Ok(text) => text,
            Err(e) => {
                warn!("McBroken: failed to fetch stats: {:?}", e);
                return Ok(Vec::new());
            }
        };

        // Parse JSON response
        let response: McBrokenResponse = match serde_json::from_str(&json_text) {
            Ok(r) => r,
            Err(e) => {
                warn!("McBroken: failed to parse JSON: {:?}", e);
                return Ok(Vec::new());
            }
        };

        // Build lookup: city name → (broken %, total_locations)
        let city_data: HashMap<String, (f64, u32)> = response
            .cities
            .into_iter()
            .map(|c| (c.city.clone(), (c.broken, c.total_locations)))
            .collect();

        debug!(
            "McBroken: {} cities in API response",
            city_data.len()
        );

        // Match each tracked asset against the API data
        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let city_name = match ref_map.get(asset_id) {
                Some(name) => name,
                None => {
                    warn!("No api_ref (city name) for asset {}", asset_id);
                    continue;
                }
            };

            let (broken_pct, total_locations) = match city_data.get(city_name) {
                Some(data) => *data,
                None => {
                    debug!("McBroken: city '{}' not found in API response", city_name);
                    continue;
                }
            };

            let value = Decimal::from_f64_retain(broken_pct).unwrap_or(Decimal::ZERO);

            debug!("McBroken {} broken={}%", city_name, broken_pct);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("MCB/{}", city_name),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: Some(Decimal::from(total_locations)),
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from McBroken (1 API call, {} cities in response)",
            results.len(),
            asset_ids.len(),
            city_data.len()
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
            30,
            "Expected exactly 30 city entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(
            assets.len(),
            30,
            "Expected exactly 30 active city assets, got {}",
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
    fn test_all_entries_sentiment_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "sentiment",
                "Entry {} should have sentiment category",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "food",
                "Entry {} should have food subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("mcbroken_"),
                "Asset ID {} should start with 'mcbroken_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_mcb() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("MCB/"),
                "Symbol '{}' should start with 'MCB/'",
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
    fn test_unique_city_refs() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        refs.dedup();
        assert_eq!(
            refs.len(),
            entries.len(),
            "All city refs (api_ref) should be unique"
        );
    }

    #[test]
    fn test_known_cities_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let city_refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(city_refs.contains(&"Atlanta, GA"), "Atlanta should be present");
        assert!(city_refs.contains(&"Las Vegas, NV"), "Las Vegas should be present");
        assert!(city_refs.contains(&"Seattle, WA"), "Seattle should be present");
        assert!(city_refs.contains(&"San Diego, CA"), "San Diego should be present");
    }

    #[test]
    fn test_parse_api_response() {
        let json = r#"{"cities": [
            {"city": "Atlanta, GA", "broken": 12.5, "total_locations": 40},
            {"city": "Las Vegas, NV", "broken": 0.0, "total_locations": 25},
            {"city": "Corpus Christi, TX", "broken": 53.33, "total_locations": 15}
        ]}"#;

        let response: McBrokenResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.cities.len(), 3);
        assert_eq!(response.cities[0].city, "Atlanta, GA");
        assert!((response.cities[0].broken - 12.5).abs() < f64::EPSILON);
        assert_eq!(response.cities[0].total_locations, 40);
        assert_eq!(response.cities[2].city, "Corpus Christi, TX");
        assert!((response.cities[2].broken - 53.33).abs() < f64::EPSILON);
    }

    #[test]
    fn test_parse_empty_cities() {
        let json = r#"{"cities": []}"#;
        let response: McBrokenResponse = serde_json::from_str(json).unwrap();
        assert!(response.cities.is_empty());
    }
}
