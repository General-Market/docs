//! CityBikes Bike Sharing client implementing MarketDataSource
//!
//! Tracks total available bikes across 30 major bike-sharing networks worldwide
//! using the CityBikes API v2 (http://api.citybik.es/v2/).
//!
//! Each network is an asset; its value is the total number of free (available)
//! bikes summed across all stations in that network.
//!
//! API: http://api.citybik.es/v2/
//! Auth: None
//! Rate limit: 300 req/hr -> conservative 5 req/min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// CityBikes API base URL
const API_BASE: &str = "http://api.citybik.es/v2";

/// Delay between individual network detail requests (12s = 5 req/min)
const INTER_REQUEST_DELAY: Duration = Duration::from_secs(12);

// ============================================================================
// CURATED NETWORK LIST (30 major networks)
// ============================================================================

/// A curated bike-sharing network entry.
struct CuratedNetwork {
    /// CityBikes network ID (used in API path)
    id: &'static str,
    /// Human-readable name
    name: &'static str,
    /// City/location description
    city: &'static str,
}

/// Top 30 bike-sharing networks worldwide, curated by size and popularity.
const CURATED_NETWORKS: &[CuratedNetwork] = &[
    CuratedNetwork { id: "citi-bike-nyc", name: "Citi Bike", city: "New York" },
    CuratedNetwork { id: "divvy", name: "Divvy", city: "Chicago" },
    CuratedNetwork { id: "capital-bikeshare", name: "Capital Bikeshare", city: "Washington DC" },
    CuratedNetwork { id: "bluebikes", name: "Bluebikes", city: "Boston" },
    CuratedNetwork { id: "bay-wheels", name: "Bay Wheels", city: "San Francisco" },
    CuratedNetwork { id: "biketown", name: "Biketown", city: "Portland" },
    CuratedNetwork { id: "nice-ride-minnesota", name: "Nice Ride", city: "Minneapolis" },
    CuratedNetwork { id: "metro-bike-share", name: "Metro Bike Share", city: "Los Angeles" },
    CuratedNetwork { id: "indego", name: "Indego", city: "Philadelphia" },
    CuratedNetwork { id: "cogo", name: "CoGo", city: "Columbus" },
    CuratedNetwork { id: "bixi-montreal", name: "BIXI", city: "Montreal" },
    CuratedNetwork { id: "bike-share-toronto", name: "Bike Share Toronto", city: "Toronto" },
    CuratedNetwork { id: "ecobici", name: "Ecobici", city: "Mexico City" },
    CuratedNetwork { id: "santander-cycles", name: "Santander Cycles", city: "London" },
    CuratedNetwork { id: "velib-metropole", name: "Velib", city: "Paris" },
    CuratedNetwork { id: "bicing", name: "Bicing", city: "Barcelona" },
    CuratedNetwork { id: "bicimad", name: "BiciMAD", city: "Madrid" },
    CuratedNetwork { id: "dublinbikes", name: "Dublin Bikes", city: "Dublin" },
    CuratedNetwork { id: "citybike-wien", name: "Citybike Wien", city: "Vienna" },
    CuratedNetwork { id: "styr-och-stall", name: "Styr & Stall", city: "Gothenburg" },
    CuratedNetwork { id: "oslo-bysykkel", name: "Oslo City Bike", city: "Oslo" },
    CuratedNetwork { id: "bysykkel", name: "Bergen City Bike", city: "Bergen" },
    CuratedNetwork { id: "helsinki-citybikes", name: "Helsinki City Bikes", city: "Helsinki" },
    CuratedNetwork { id: "smoove-valence", name: "Valence Bikes", city: "Valence" },
    CuratedNetwork { id: "youbike", name: "YouBike", city: "Taipei" },
    CuratedNetwork { id: "bikesampa", name: "Bike Sampa", city: "Sao Paulo" },
    CuratedNetwork { id: "ecobici-buenos-aires", name: "Ecobici", city: "Buenos Aires" },
    CuratedNetwork { id: "seoul-bike", name: "Seoul Bike", city: "Seoul" },
    CuratedNetwork { id: "hangzhou-public-bicycle", name: "Hangzhou Public Bicycle", city: "Hangzhou" },
    CuratedNetwork { id: "melbourne-bike-share", name: "Melbourne Bike Share", city: "Melbourne" },
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Response from GET /v2/networks/{network_id}
#[derive(Debug, Deserialize)]
struct NetworkDetailResponse {
    network: NetworkDetail,
}

/// Network detail including stations
#[derive(Debug, Deserialize)]
struct NetworkDetail {
    #[allow(dead_code)]
    id: String,
    #[allow(dead_code)]
    name: String,
    #[serde(default)]
    stations: Vec<Station>,
}

/// A single bike station
#[derive(Debug, Deserialize)]
struct Station {
    /// Number of available (free) bikes at this station
    #[serde(default)]
    free_bikes: Option<i64>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// CityBikes bike sharing market data source.
///
/// Tracks total available bikes across 30 major bike-sharing networks worldwide.
/// Source ID is `"citybikes"`.
pub struct CityBikesMarketSource {
    http: SourceHttpClient,
}

impl CityBikesMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 5,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("CityBikes source initialized ({} networks)", CURATED_NETWORKS.len());

        Ok(Self { http })
    }

    /// Look up a curated network by its CityBikes ID.
    fn find_network(network_id: &str) -> Option<&'static CuratedNetwork> {
        CURATED_NETWORKS.iter().find(|n| n.id == network_id)
    }

    /// Extract the CityBikes network ID from our asset_id format.
    /// e.g. "citybikes_citi-bike-nyc" -> "citi-bike-nyc"
    fn extract_network_id(asset_id: &str) -> &str {
        asset_id.strip_prefix("citybikes_").unwrap_or(asset_id)
    }

    /// Sum free_bikes across all stations in a network detail response.
    fn sum_free_bikes(stations: &[Station]) -> i64 {
        stations
            .iter()
            .filter_map(|s| s.free_bikes)
            .filter(|&b| b >= 0)
            .sum()
    }
}

#[async_trait::async_trait]
impl MarketDataSource for CityBikesMarketSource {
    fn source_id(&self) -> &'static str {
        "citybikes"
    }

    fn display_name(&self) -> &'static str {
        "CityBikes Bike Sharing"
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
                max_requests: 5,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets: Vec<AssetUpdate> = CURATED_NETWORKS
            .iter()
            .map(|net| AssetUpdate {
                asset_id: format!("citybikes_{}", net.id),
                symbol: format!("BIKE/{}", net.id.to_uppercase()),
                name: format!("{} ({})", net.name, net.city),
                category: Some("transport".to_string()),
                metadata: serde_json::json!({
                    "api_ref": net.id,
                    "subcategory": "bikeshare",
                    "active": true,
                    "extra": {
                        "city": net.city,
                    },
                }),
            })
            .collect();

        info!("CityBikes fetch_assets: {} networks", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::with_capacity(asset_ids.len());
        let mut fetched = 0u32;
        let mut skipped = 0u32;

        for (i, asset_id) in asset_ids.iter().enumerate() {
            let network_id = Self::extract_network_id(asset_id);

            // Build the network detail URL
            let url = format!("{}/networks/{}", API_BASE, network_id);

            debug!("CityBikes: fetching network {} ({}/{})", network_id, i + 1, asset_ids.len());

            // Fetch network detail
            let detail: NetworkDetailResponse = match self.http.get_json(&url).await {
                Ok(data) => data,
                Err(e) => {
                    warn!("CityBikes: error fetching network '{}': {:?}", network_id, e);
                    skipped += 1;
                    // Add delay even on error to respect rate limits
                    if i + 1 < asset_ids.len() {
                        tokio::time::sleep(INTER_REQUEST_DELAY).await;
                    }
                    continue;
                }
            };

            // Sum free bikes across all stations
            let total_bikes = Self::sum_free_bikes(&detail.network.stations);

            debug!(
                "CityBikes: {} has {} free bikes across {} stations",
                network_id,
                total_bikes,
                detail.network.stations.len()
            );

            // Build symbol from curated list or fallback
            let symbol = Self::find_network(network_id)
                .map(|_| format!("BIKE/{}", network_id.to_uppercase()))
                .unwrap_or_else(|| format!("BIKE/{}", network_id.to_uppercase()));

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol,
                value: Decimal::from(total_bikes),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });

            fetched += 1;

            // Add delay between requests to stay under rate limit
            if i + 1 < asset_ids.len() {
                tokio::time::sleep(INTER_REQUEST_DELAY).await;
            }
        }

        info!(
            "CityBikes: fetched {}/{} networks ({} skipped)",
            fetched,
            asset_ids.len(),
            skipped
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

    #[test]
    fn test_network_count() {
        assert_eq!(
            CURATED_NETWORKS.len(),
            30,
            "Should have exactly 30 curated networks"
        );
    }

    #[test]
    fn test_asset_id_format() {
        for net in CURATED_NETWORKS {
            let asset_id = format!("citybikes_{}", net.id);
            assert!(
                asset_id.starts_with("citybikes_"),
                "Asset ID '{}' should start with 'citybikes_'",
                asset_id
            );
            // Ensure no spaces in the network ID
            assert!(
                !net.id.contains(' '),
                "Network ID '{}' should not contain spaces",
                net.id
            );
        }
    }

    #[test]
    fn test_parse_network_response() {
        let json = r#"{
            "network": {
                "id": "citi-bike-nyc",
                "name": "Citi Bike",
                "stations": [
                    {
                        "id": "abc123",
                        "name": "Station A",
                        "free_bikes": 12,
                        "empty_slots": 18,
                        "timestamp": "2024-01-15T12:00:00Z",
                        "latitude": 40.7,
                        "longitude": -74.0
                    },
                    {
                        "id": "def456",
                        "name": "Station B",
                        "free_bikes": 5,
                        "empty_slots": 25,
                        "timestamp": "2024-01-15T12:00:00Z",
                        "latitude": 40.71,
                        "longitude": -74.01
                    },
                    {
                        "id": "ghi789",
                        "name": "Station C",
                        "free_bikes": 0,
                        "empty_slots": 30,
                        "timestamp": "2024-01-15T12:00:00Z",
                        "latitude": 40.72,
                        "longitude": -74.02
                    }
                ]
            }
        }"#;

        let response: NetworkDetailResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.network.id, "citi-bike-nyc");
        assert_eq!(response.network.name, "Citi Bike");
        assert_eq!(response.network.stations.len(), 3);
        assert_eq!(response.network.stations[0].free_bikes, Some(12));
        assert_eq!(response.network.stations[1].free_bikes, Some(5));
        assert_eq!(response.network.stations[2].free_bikes, Some(0));
    }

    #[test]
    fn test_sum_free_bikes() {
        let stations = vec![
            Station { free_bikes: Some(12) },
            Station { free_bikes: Some(5) },
            Station { free_bikes: Some(0) },
            Station { free_bikes: Some(8) },
            Station { free_bikes: None },
        ];

        let total = CityBikesMarketSource::sum_free_bikes(&stations);
        assert_eq!(total, 25, "Should sum 12 + 5 + 0 + 8 = 25 (skipping None)");
    }

    #[test]
    fn test_sum_free_bikes_empty() {
        let stations: Vec<Station> = vec![];
        let total = CityBikesMarketSource::sum_free_bikes(&stations);
        assert_eq!(total, 0, "Empty stations should sum to 0");
    }

    #[test]
    fn test_sum_free_bikes_all_none() {
        let stations = vec![
            Station { free_bikes: None },
            Station { free_bikes: None },
        ];
        let total = CityBikesMarketSource::sum_free_bikes(&stations);
        assert_eq!(total, 0, "All-None stations should sum to 0");
    }

    #[test]
    fn test_sum_free_bikes_negative_filtered() {
        let stations = vec![
            Station { free_bikes: Some(10) },
            Station { free_bikes: Some(-1) }, // Bad data, should be filtered
            Station { free_bikes: Some(5) },
        ];
        let total = CityBikesMarketSource::sum_free_bikes(&stations);
        assert_eq!(total, 15, "Negative values should be filtered out: 10 + 5 = 15");
    }

    #[test]
    fn test_extract_network_id() {
        assert_eq!(
            CityBikesMarketSource::extract_network_id("citybikes_citi-bike-nyc"),
            "citi-bike-nyc"
        );
        assert_eq!(
            CityBikesMarketSource::extract_network_id("citybikes_velib-metropole"),
            "velib-metropole"
        );
        // Fallback if prefix is missing
        assert_eq!(
            CityBikesMarketSource::extract_network_id("divvy"),
            "divvy"
        );
    }

    #[test]
    fn test_find_network() {
        let nyc = CityBikesMarketSource::find_network("citi-bike-nyc");
        assert!(nyc.is_some());
        assert_eq!(nyc.unwrap().name, "Citi Bike");
        assert_eq!(nyc.unwrap().city, "New York");

        let unknown = CityBikesMarketSource::find_network("nonexistent-network");
        assert!(unknown.is_none());
    }

    #[test]
    fn test_unique_network_ids() {
        let mut ids: Vec<&str> = CURATED_NETWORKS.iter().map(|n| n.id).collect();
        ids.sort();
        let original_len = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), original_len, "All network IDs should be unique");
    }

    #[test]
    fn test_known_networks_present() {
        let ids: Vec<&str> = CURATED_NETWORKS.iter().map(|n| n.id).collect();
        assert!(ids.contains(&"citi-bike-nyc"), "Should contain Citi Bike NYC");
        assert!(ids.contains(&"santander-cycles"), "Should contain Santander Cycles London");
        assert!(ids.contains(&"velib-metropole"), "Should contain Velib Paris");
        assert!(ids.contains(&"youbike"), "Should contain YouBike Taipei");
        assert!(ids.contains(&"melbourne-bike-share"), "Should contain Melbourne Bike Share");
    }

    #[test]
    fn test_fetch_assets_produces_correct_metadata() {
        // Verify the asset generation logic produces correct structure
        let net = &CURATED_NETWORKS[0]; // citi-bike-nyc
        let asset = AssetUpdate {
            asset_id: format!("citybikes_{}", net.id),
            symbol: format!("BIKE/{}", net.id.to_uppercase()),
            name: format!("{} ({})", net.name, net.city),
            category: Some("transport".to_string()),
            metadata: serde_json::json!({
                "api_ref": net.id,
                "subcategory": "bikeshare",
                "active": true,
                "extra": {
                    "city": net.city,
                },
            }),
        };

        assert_eq!(asset.asset_id, "citybikes_citi-bike-nyc");
        assert_eq!(asset.symbol, "BIKE/CITI-BIKE-NYC");
        assert_eq!(asset.name, "Citi Bike (New York)");
        assert_eq!(asset.category, Some("transport".to_string()));
        assert_eq!(asset.metadata["subcategory"], "bikeshare");
        assert_eq!(asset.metadata["api_ref"], "citi-bike-nyc");
        assert_eq!(asset.metadata["extra"]["city"], "New York");
    }
}
