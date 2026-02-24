//! TomTom EV Charging Station Availability client implementing MarketDataSource
//!
//! Tracks available EV charging connectors at major charging hubs worldwide.
//!
//! Strategy: Two-step API approach per station:
//!   1. Nearby Search (`/search/2/nearbySearch/.json`) with categorySet=7309
//!      to find the nearest EV charging station and get its chargingPark ID.
//!   2. Charging Availability (`/search/2/chargingAvailability.json`) to get
//!      connector availability counts.
//!
//! API: TomTom Search API v2
//! Auth: TOMTOM_API_KEY env var (query parameter `key=`)
//! Rate limit: 100 req/day (conservative — shared with traffic source, 2,500/day total)
//! Sync interval: 600s (10 minutes)

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
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — ~25 EV charging station locations
const ASSET_JSON: &str = include_str!("../../../config/tomtom_evcharge.json");

/// TomTom Nearby Search API base URL
const NEARBY_SEARCH_URL: &str = "https://api.tomtom.com/search/2/nearbySearch/.json";

/// TomTom EV Charging Availability API base URL
const CHARGING_AVAILABILITY_URL: &str =
    "https://api.tomtom.com/search/2/chargingAvailability.json";

/// Delay between sequential station fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 3000;

// ============================================================================
// NEARBY SEARCH API RESPONSE TYPES
// ============================================================================

/// TomTom Nearby Search response
#[derive(Debug, Deserialize)]
struct NearbySearchResponse {
    #[serde(default)]
    results: Vec<NearbySearchResult>,
}

/// Single result from nearby search
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NearbySearchResult {
    #[serde(default)]
    data_sources: Option<DataSources>,
}

/// Data sources section of a search result
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DataSources {
    #[serde(default)]
    charging_availability: Option<ChargingAvailabilityRef>,
}

/// Reference to the charging availability data source
#[derive(Debug, Deserialize)]
struct ChargingAvailabilityRef {
    id: String,
}

// ============================================================================
// CHARGING AVAILABILITY API RESPONSE TYPES
// ============================================================================

/// TomTom Charging Availability response
#[derive(Debug, Deserialize)]
struct ChargingAvailabilityResponse {
    #[serde(default)]
    connectors: Vec<Connector>,
}

/// A connector type at a charging station
#[derive(Debug, Deserialize)]
struct Connector {
    #[serde(default)]
    availability: Option<ConnectorAvailability>,
}

/// Availability info for a connector type
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectorAvailability {
    #[serde(default)]
    per_power_level: Vec<PowerLevelAvailability>,
}

/// Availability per power level
#[derive(Debug, Deserialize)]
struct PowerLevelAvailability {
    #[serde(default)]
    current: Option<AvailabilityCounts>,
}

/// Current availability counts
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AvailabilityCounts {
    #[serde(default)]
    available: u32,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// TomTom EV Charging station availability market data source.
///
/// Tracks available connector counts at major EV charging hubs worldwide.
/// Source ID is `"tomtom_evcharge"`.
pub struct TomtomEvchargeMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl TomtomEvchargeMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("TOMTOM_API_KEY")
            .map_err(|_| anyhow::anyhow!("TOMTOM_API_KEY not set"))?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100,
                duration: Duration::from_secs(86400),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("TomTom EV Charging source initialized");

        Ok(Self { http, api_key })
    }

    /// Parse "lat,lon" string from api_ref into (lat, lon) tuple
    fn parse_lat_lon(api_ref: &str) -> Result<(f64, f64), String> {
        let parts: Vec<&str> = api_ref.split(',').collect();
        if parts.len() != 2 {
            return Err(format!(
                "Expected 'lat,lon' format, got '{}' ({} parts)",
                api_ref,
                parts.len()
            ));
        }
        let lat: f64 = parts[0]
            .trim()
            .parse()
            .map_err(|e| format!("Invalid latitude '{}': {}", parts[0], e))?;
        let lon: f64 = parts[1]
            .trim()
            .parse()
            .map_err(|e| format!("Invalid longitude '{}': {}", parts[1], e))?;
        Ok((lat, lon))
    }

    /// Step 1: Nearby search to find chargingPark ID for a lat/lon
    async fn find_charging_park_id(
        &self,
        lat: f64,
        lon: f64,
    ) -> Result<String, SourceError> {
        let url = format!(
            "{}?lat={}&lon={}&categorySet=7309&limit=1&key={}",
            NEARBY_SEARCH_URL, lat, lon, self.api_key
        );

        let response: NearbySearchResponse = self.http.get_json(&url).await?;

        let result = response
            .results
            .first()
            .ok_or_else(|| SourceError::DataError("No EV stations found nearby".to_string()))?;

        let charging_park_id = result
            .data_sources
            .as_ref()
            .and_then(|ds| ds.charging_availability.as_ref())
            .map(|ca| ca.id.clone())
            .ok_or_else(|| {
                SourceError::DataError(
                    "Nearby station has no chargingAvailability data source".to_string(),
                )
            })?;

        Ok(charging_park_id)
    }

    /// Step 2: Get available connector count for a chargingPark ID
    async fn get_available_connectors(
        &self,
        charging_park_id: &str,
    ) -> Result<u32, SourceError> {
        let url = format!(
            "{}?chargingPark={}&key={}",
            CHARGING_AVAILABILITY_URL, charging_park_id, self.api_key
        );

        let response: ChargingAvailabilityResponse = self.http.get_json(&url).await?;

        let total_available = sum_available_connectors(&response);

        Ok(total_available)
    }
}

/// Sum all available connectors across all connector types and power levels
fn sum_available_connectors(response: &ChargingAvailabilityResponse) -> u32 {
    let mut total = 0u32;
    for connector in &response.connectors {
        if let Some(availability) = &connector.availability {
            for power_level in &availability.per_power_level {
                if let Some(counts) = &power_level.current {
                    total += counts.available;
                }
            }
        }
    }
    total
}

// ============================================================================
// MARKET DATA SOURCE TRAIT IMPLEMENTATION
// ============================================================================

#[async_trait::async_trait]
impl MarketDataSource for TomtomEvchargeMarketSource {
    fn source_id(&self) -> &'static str {
        "tomtom_evcharge"
    }

    fn display_name(&self) -> &'static str {
        "TomTom EV Charging"
    }

    fn default_resolution(&self) -> &'static str {
        "measurement"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // 100 req/day (conservative — shared with traffic source, 2,500/day total)
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100,
                duration: Duration::from_secs(86400),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load asset entries to get api_ref (lat,lon) for each asset
        let all_entries = load_all_asset_entries(ASSET_JSON)?;
        let entry_map: HashMap<&str, (&str, &str)> = all_entries
            .iter()
            .map(|e| (e.asset_id.as_str(), (e.api_ref.as_str(), e.symbol.as_str())))
            .collect();

        let mut results = Vec::new();
        let mut succeeded = 0usize;
        let mut failed = 0usize;

        for (i, asset_id) in asset_ids.iter().enumerate() {
            let (api_ref, symbol) = match entry_map.get(asset_id.as_str()) {
                Some(entry) => *entry,
                None => {
                    warn!(
                        "TomTom EV Charging: unknown asset_id '{}', skipping",
                        asset_id
                    );
                    failed += 1;
                    continue;
                }
            };

            let (lat, lon) = match Self::parse_lat_lon(api_ref) {
                Ok(coords) => coords,
                Err(e) => {
                    warn!(
                        "TomTom EV Charging: bad api_ref for {}: {}",
                        asset_id, e
                    );
                    failed += 1;
                    continue;
                }
            };

            // Step 1: Find chargingPark ID via nearby search
            let charging_park_id = match self.find_charging_park_id(lat, lon).await {
                Ok(id) => id,
                Err(e) => {
                    warn!(
                        "TomTom EV Charging: nearby search failed for {} ({},{}): {:?}",
                        asset_id, lat, lon, e
                    );
                    failed += 1;
                    // Delay before next station even on failure
                    if i < asset_ids.len() - 1 {
                        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
                    }
                    continue;
                }
            };

            debug!(
                "TomTom EV Charging: {} -> chargingPark={}",
                asset_id, charging_park_id
            );

            // Step 2: Get availability
            let available = match self.get_available_connectors(&charging_park_id).await {
                Ok(count) => count,
                Err(e) => {
                    warn!(
                        "TomTom EV Charging: availability fetch failed for {} (park={}): {:?}",
                        asset_id, charging_park_id, e
                    );
                    failed += 1;
                    // Delay before next station even on failure
                    if i < asset_ids.len() - 1 {
                        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
                    }
                    continue;
                }
            };

            debug!(
                "TomTom EV Charging: {} -> {} available connectors",
                asset_id, available
            );

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: symbol.to_string(),
                value: Decimal::from(available),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });

            succeeded += 1;

            // Delay between stations (skip after last)
            if i < asset_ids.len() - 1 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }
        }

        info!(
            "TomTom EV Charging: fetched {}/{} stations ({} failed)",
            succeeded,
            asset_ids.len(),
            failed
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
            25,
            "Expected 25 EV charging stations, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(
            assets.len(),
            25,
            "Expected 25 active assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_entries_transport_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "transport",
                "Asset {} has category '{}', expected 'transport'",
                entry.asset_id, entry.category
            );
            assert_eq!(
                entry.subcategory, "ev_charging",
                "Asset {} has subcategory '{}', expected 'ev_charging'",
                entry.asset_id, entry.subcategory
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("tomtom_evcharge_"),
                "Asset ID '{}' should start with 'tomtom_evcharge_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_api_ref_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let result = TomtomEvchargeMarketSource::parse_lat_lon(&entry.api_ref);
            assert!(
                result.is_ok(),
                "api_ref '{}' for {} should parse as lat,lon: {:?}",
                entry.api_ref,
                entry.asset_id,
                result.err()
            );

            let (lat, lon) = result.unwrap();
            assert!(
                (-90.0..=90.0).contains(&lat),
                "Latitude {} out of range for {}",
                lat,
                entry.asset_id
            );
            assert!(
                (-180.0..=180.0).contains(&lon),
                "Longitude {} out of range for {}",
                lon,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_evc() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("EVC/"),
                "Symbol '{}' should start with 'EVC/' for asset {}",
                entry.symbol,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Asset {} should be active", entry.asset_id);
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
        assert_eq!(symbols.len(), entries.len(), "All symbols should be unique");
    }

    #[test]
    fn test_parse_lat_lon_valid() {
        let (lat, lon) = TomtomEvchargeMarketSource::parse_lat_lon("35.0284,-117.0145").unwrap();
        assert!((lat - 35.0284).abs() < 0.0001);
        assert!((lon - (-117.0145)).abs() < 0.0001);
    }

    #[test]
    fn test_parse_lat_lon_negative() {
        let (lat, lon) = TomtomEvchargeMarketSource::parse_lat_lon("-33.8352,151.0885").unwrap();
        assert!((lat - (-33.8352)).abs() < 0.0001);
        assert!((lon - 151.0885).abs() < 0.0001);
    }

    #[test]
    fn test_parse_lat_lon_invalid() {
        assert!(TomtomEvchargeMarketSource::parse_lat_lon("invalid").is_err());
        assert!(TomtomEvchargeMarketSource::parse_lat_lon("1,2,3").is_err());
        assert!(TomtomEvchargeMarketSource::parse_lat_lon("").is_err());
        assert!(TomtomEvchargeMarketSource::parse_lat_lon("abc,def").is_err());
    }

    #[test]
    fn test_parse_nearby_search_response() {
        let json = r#"{
            "results": [
                {
                    "dataSources": {
                        "chargingAvailability": {
                            "id": "840DRT00e7qa3K"
                        }
                    }
                }
            ]
        }"#;

        let response: NearbySearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.results.len(), 1);

        let id = response.results[0]
            .data_sources
            .as_ref()
            .unwrap()
            .charging_availability
            .as_ref()
            .unwrap()
            .id
            .as_str();
        assert_eq!(id, "840DRT00e7qa3K");
    }

    #[test]
    fn test_parse_nearby_search_empty() {
        let json = r#"{"results": []}"#;
        let response: NearbySearchResponse = serde_json::from_str(json).unwrap();
        assert!(response.results.is_empty());
    }

    #[test]
    fn test_parse_availability_response() {
        let json = r#"{
            "connectors": [
                {
                    "type": "IEC62196Type2CCS",
                    "availability": {
                        "perPowerLevel": [
                            {
                                "powerKW": 150.0,
                                "current": {
                                    "available": 3,
                                    "occupied": 5,
                                    "reserved": 0,
                                    "outOfService": 1,
                                    "unknown": 0
                                }
                            }
                        ]
                    }
                }
            ]
        }"#;

        let response: ChargingAvailabilityResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.connectors.len(), 1);

        let available = response.connectors[0]
            .availability
            .as_ref()
            .unwrap()
            .per_power_level[0]
            .current
            .as_ref()
            .unwrap()
            .available;
        assert_eq!(available, 3);
    }

    #[test]
    fn test_sum_available_connectors() {
        let response = ChargingAvailabilityResponse {
            connectors: vec![
                Connector {
                    availability: Some(ConnectorAvailability {
                        per_power_level: vec![
                            PowerLevelAvailability {
                                current: Some(AvailabilityCounts { available: 3 }),
                            },
                            PowerLevelAvailability {
                                current: Some(AvailabilityCounts { available: 2 }),
                            },
                        ],
                    }),
                },
                Connector {
                    availability: Some(ConnectorAvailability {
                        per_power_level: vec![PowerLevelAvailability {
                            current: Some(AvailabilityCounts { available: 5 }),
                        }],
                    }),
                },
            ],
        };

        let total = sum_available_connectors(&response);
        assert_eq!(total, 10); // 3 + 2 + 5
    }

    #[test]
    fn test_sum_available_connectors_empty() {
        let response = ChargingAvailabilityResponse {
            connectors: vec![],
        };
        assert_eq!(sum_available_connectors(&response), 0);
    }

    #[test]
    fn test_sum_available_connectors_none_current() {
        let response = ChargingAvailabilityResponse {
            connectors: vec![Connector {
                availability: Some(ConnectorAvailability {
                    per_power_level: vec![PowerLevelAvailability { current: None }],
                }),
            }],
        };
        assert_eq!(sum_available_connectors(&response), 0);
    }

    #[test]
    fn test_sum_available_connectors_none_availability() {
        let response = ChargingAvailabilityResponse {
            connectors: vec![Connector {
                availability: None,
            }],
        };
        assert_eq!(sum_available_connectors(&response), 0);
    }
}
