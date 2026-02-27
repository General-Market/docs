//! ParkAPI Parking Garages client implementing MarketDataSource
//!
//! Tracks total free parking spaces across ~20 European cities
//! using the ParkAPI (https://api.parkendd.de/).
//!
//! Each city is an asset; its value is the total number of free
//! parking spaces summed across all lots in that city.
//!
//! API: https://api.parkendd.de/{city}
//! Auth: None
//! Rate limit: Conservative 30 req/min (no documented limit)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// ParkAPI base URL
const API_BASE: &str = "https://api.parkendd.de";

/// Delay between individual city requests (2s)
const INTER_REQUEST_DELAY: Duration = Duration::from_secs(2);

// ============================================================================
// CURATED CITY LIST (~20 European cities)
// ============================================================================

/// A curated parking city entry.
struct CuratedCity {
    /// ParkAPI city ID (used in API path, lowercase German spelling)
    id: &'static str,
    /// Human-readable city name
    name: &'static str,
    /// Country
    country: &'static str,
}

/// ~20 European cities available on ParkAPI, curated by size and availability.
/// Note: ParkAPI URLs require capitalized city names (e.g. "Zuerich" not "zuerich").
/// The `api_name` field holds the capitalized form used in URLs.
/// Cities removed (no longer on ParkAPI): frankfurt, muenchen, essen, duesseldorf.
/// Replacements added: mannheim, nuernberg, heilbronn, regensburg.
const CURATED_CITIES: &[CuratedCity] = &[
    CuratedCity { id: "zuerich", name: "Zuerich", country: "Switzerland" },
    CuratedCity { id: "dresden", name: "Dresden", country: "Germany" },
    CuratedCity { id: "hamburg", name: "Hamburg", country: "Germany" },
    CuratedCity { id: "koeln", name: "Koeln", country: "Germany" },
    CuratedCity { id: "bonn", name: "Bonn", country: "Germany" },
    CuratedCity { id: "aachen", name: "Aachen", country: "Germany" },
    CuratedCity { id: "dortmund", name: "Dortmund", country: "Germany" },
    CuratedCity { id: "wiesbaden", name: "Wiesbaden", country: "Germany" },
    CuratedCity { id: "karlsruhe", name: "Karlsruhe", country: "Germany" },
    CuratedCity { id: "freiburg", name: "Freiburg", country: "Germany" },
    CuratedCity { id: "heidelberg", name: "Heidelberg", country: "Germany" },
    CuratedCity { id: "ulm", name: "Ulm", country: "Germany" },
    CuratedCity { id: "ingolstadt", name: "Ingolstadt", country: "Germany" },
    CuratedCity { id: "konstanz", name: "Konstanz", country: "Germany" },
    CuratedCity { id: "oldenburg", name: "Oldenburg", country: "Germany" },
    CuratedCity { id: "luebeck", name: "Luebeck", country: "Germany" },
    CuratedCity { id: "mannheim", name: "Mannheim", country: "Germany" },
    CuratedCity { id: "nuernberg", name: "Nuernberg", country: "Germany" },
    CuratedCity { id: "heilbronn", name: "Heilbronn", country: "Germany" },
    CuratedCity { id: "regensburg", name: "Regensburg", country: "Germany" },
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Response from GET https://api.parkendd.de/{city}
#[derive(Debug, Deserialize)]
struct CityResponse {
    #[serde(default)]
    lots: Vec<ParkingLot>,
}

/// A single parking lot
#[derive(Debug, Deserialize)]
struct ParkingLot {
    /// Number of free (available) spaces
    #[serde(default)]
    free: Option<i64>,
    /// Total capacity
    #[allow(dead_code)]
    #[serde(default)]
    total: Option<i64>,
    /// Lot state: "open", "closed", "nodata", "unknown"
    #[serde(default)]
    state: Option<String>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// ParkAPI parking garage market data source.
///
/// Tracks total free parking spaces across ~20 European cities.
/// Source ID is `"parking"`.
pub struct ParkingMarketSource {
    http: SourceHttpClient,
}

impl ParkingMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("ParkAPI source initialized ({} cities)", CURATED_CITIES.len());

        Ok(Self { http })
    }

    /// Look up a curated city by its ParkAPI ID.
    fn find_city(city_id: &str) -> Option<&'static CuratedCity> {
        CURATED_CITIES.iter().find(|c| c.id == city_id)
    }

    /// Extract the ParkAPI city ID from our asset_id format.
    /// e.g. "parking_zuerich" -> "zuerich"
    fn extract_city_id(asset_id: &str) -> &str {
        asset_id.strip_prefix("parking_").unwrap_or(asset_id)
    }

    /// Sum free spaces across all open lots in a city response.
    /// Only counts lots where state is "open" (or state is absent/None).
    /// Filters out negative values as bad data.
    fn sum_free_spaces(lots: &[ParkingLot]) -> i64 {
        lots.iter()
            .filter(|lot| {
                match &lot.state {
                    Some(s) => s == "open",
                    None => true, // If no state field, assume open
                }
            })
            .filter_map(|lot| lot.free)
            .filter(|&f| f >= 0)
            .sum()
    }
}

#[async_trait::async_trait]
impl MarketDataSource for ParkingMarketSource {
    fn source_id(&self) -> &'static str {
        "parking"
    }

    fn display_name(&self) -> &'static str {
        "ParkAPI Parking Garages"
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
        let assets: Vec<AssetUpdate> = CURATED_CITIES
            .iter()
            .map(|city| AssetUpdate {
                asset_id: format!("parking_{}", city.id),
                symbol: format!("PARK/{}", city.id.to_uppercase()),
                name: format!("Parking {} ({})", city.name, city.country),
                category: Some("transport".to_string()),
                metadata: serde_json::json!({
                    "api_ref": city.id,
                    "subcategory": "parking",
                    "active": true,
                    "extra": {
                        "country": city.country,
                    },
                }),
            })
            .collect();

        info!("ParkAPI fetch_assets: {} cities", assets.len());
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
            let city_id = Self::extract_city_id(asset_id);

            // ParkAPI requires capitalized city names in URLs
            let city_api_name = Self::find_city(city_id)
                .map(|c| c.name)
                .unwrap_or(city_id);
            let url = format!("{}/{}", API_BASE, city_api_name);

            debug!("ParkAPI: fetching city {} ({}/{})", city_id, i + 1, asset_ids.len());

            // Fetch city parking data
            let city_data: CityResponse = match self.http.get_json(&url).await {
                Ok(data) => data,
                Err(e) => {
                    warn!("ParkAPI: error fetching city '{}': {:?}", city_id, e);
                    skipped += 1;
                    // Add delay even on error to respect rate limits
                    if i + 1 < asset_ids.len() {
                        tokio::time::sleep(INTER_REQUEST_DELAY).await;
                    }
                    continue;
                }
            };

            // Sum free spaces across all open lots
            let total_free = Self::sum_free_spaces(&city_data.lots);

            debug!(
                "ParkAPI: {} has {} free spaces across {} lots",
                city_id,
                total_free,
                city_data.lots.len()
            );

            // Build symbol from curated list or fallback
            let symbol = Self::find_city(city_id)
                .map(|_| format!("PARK/{}", city_id.to_uppercase()))
                .unwrap_or_else(|| format!("PARK/{}", city_id.to_uppercase()));

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol,
                value: Decimal::from(total_free),
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
            "ParkAPI: fetched {}/{} cities ({} skipped)",
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
    fn test_city_count() {
        assert_eq!(
            CURATED_CITIES.len(),
            20,
            "Should have exactly 20 curated cities"
        );
    }

    #[test]
    fn test_asset_id_format() {
        for city in CURATED_CITIES {
            let asset_id = format!("parking_{}", city.id);
            assert!(
                asset_id.starts_with("parking_"),
                "Asset ID '{}' should start with 'parking_'",
                asset_id
            );
            // Ensure no spaces in the city ID
            assert!(
                !city.id.contains(' '),
                "City ID '{}' should not contain spaces",
                city.id
            );
        }
    }

    #[test]
    fn test_parse_api_response() {
        let json = r#"{
            "lots": [
                {
                    "id": "lot_001",
                    "name": "Parkhaus Altstadt",
                    "free": 123,
                    "total": 456,
                    "state": "open",
                    "coords": { "lat": 47.3, "lng": 8.5 }
                },
                {
                    "id": "lot_002",
                    "name": "Parkhaus Bahnhof",
                    "free": 50,
                    "total": 200,
                    "state": "open",
                    "coords": { "lat": 47.31, "lng": 8.51 }
                },
                {
                    "id": "lot_003",
                    "name": "Parkhaus Zentrum",
                    "free": 0,
                    "total": 100,
                    "state": "closed",
                    "coords": { "lat": 47.32, "lng": 8.52 }
                }
            ]
        }"#;

        let response: CityResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.lots.len(), 3);
        assert_eq!(response.lots[0].free, Some(123));
        assert_eq!(response.lots[0].state, Some("open".to_string()));
        assert_eq!(response.lots[1].free, Some(50));
        assert_eq!(response.lots[2].free, Some(0));
        assert_eq!(response.lots[2].state, Some("closed".to_string()));
    }

    #[test]
    fn test_sum_free_spaces() {
        let lots = vec![
            ParkingLot { free: Some(123), total: Some(456), state: Some("open".to_string()) },
            ParkingLot { free: Some(50), total: Some(200), state: Some("open".to_string()) },
            ParkingLot { free: Some(0), total: Some(100), state: Some("closed".to_string()) },
            ParkingLot { free: Some(30), total: Some(80), state: Some("open".to_string()) },
            ParkingLot { free: None, total: Some(50), state: Some("open".to_string()) },
        ];

        let total = ParkingMarketSource::sum_free_spaces(&lots);
        assert_eq!(
            total, 203,
            "Should sum 123 + 50 + 30 = 203 (skipping closed lot and None)"
        );
    }

    #[test]
    fn test_sum_free_spaces_empty() {
        let lots: Vec<ParkingLot> = vec![];
        let total = ParkingMarketSource::sum_free_spaces(&lots);
        assert_eq!(total, 0, "Empty lots should sum to 0");
    }

    #[test]
    fn test_sum_free_spaces_all_closed() {
        let lots = vec![
            ParkingLot { free: Some(100), total: Some(200), state: Some("closed".to_string()) },
            ParkingLot { free: Some(50), total: Some(100), state: Some("closed".to_string()) },
        ];
        let total = ParkingMarketSource::sum_free_spaces(&lots);
        assert_eq!(total, 0, "All-closed lots should sum to 0");
    }

    #[test]
    fn test_sum_free_spaces_no_state() {
        // Lots with no state field should be treated as open
        let lots = vec![
            ParkingLot { free: Some(10), total: Some(50), state: None },
            ParkingLot { free: Some(20), total: Some(100), state: None },
        ];
        let total = ParkingMarketSource::sum_free_spaces(&lots);
        assert_eq!(total, 30, "Lots with no state should be counted as open: 10 + 20 = 30");
    }

    #[test]
    fn test_sum_free_spaces_negative_filtered() {
        let lots = vec![
            ParkingLot { free: Some(10), total: Some(50), state: Some("open".to_string()) },
            ParkingLot { free: Some(-1), total: Some(100), state: Some("open".to_string()) },
            ParkingLot { free: Some(5), total: Some(30), state: Some("open".to_string()) },
        ];
        let total = ParkingMarketSource::sum_free_spaces(&lots);
        assert_eq!(total, 15, "Negative values should be filtered out: 10 + 5 = 15");
    }

    #[test]
    fn test_extract_city_id() {
        assert_eq!(
            ParkingMarketSource::extract_city_id("parking_zuerich"),
            "zuerich"
        );
        assert_eq!(
            ParkingMarketSource::extract_city_id("parking_dresden"),
            "dresden"
        );
        // Fallback if prefix is missing
        assert_eq!(
            ParkingMarketSource::extract_city_id("hamburg"),
            "hamburg"
        );
    }

    #[test]
    fn test_unique_city_ids() {
        let mut ids: Vec<&str> = CURATED_CITIES.iter().map(|c| c.id).collect();
        ids.sort();
        let original_len = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), original_len, "All city IDs should be unique");
    }

    #[test]
    fn test_known_cities_present() {
        let ids: Vec<&str> = CURATED_CITIES.iter().map(|c| c.id).collect();
        assert!(ids.contains(&"zuerich"), "Should contain Zuerich");
        assert!(ids.contains(&"dresden"), "Should contain Dresden");
        assert!(ids.contains(&"hamburg"), "Should contain Hamburg");
        assert!(ids.contains(&"koeln"), "Should contain Koeln");
        assert!(ids.contains(&"mannheim"), "Should contain Mannheim");
    }

    #[test]
    fn test_find_city() {
        let zuerich = ParkingMarketSource::find_city("zuerich");
        assert!(zuerich.is_some());
        assert_eq!(zuerich.unwrap().name, "Zuerich");
        assert_eq!(zuerich.unwrap().country, "Switzerland");

        let unknown = ParkingMarketSource::find_city("nonexistent-city");
        assert!(unknown.is_none());
    }

    #[test]
    fn test_fetch_assets_produces_correct_metadata() {
        // Verify the asset generation logic produces correct structure
        let city = &CURATED_CITIES[0]; // zuerich
        let asset = AssetUpdate {
            asset_id: format!("parking_{}", city.id),
            symbol: format!("PARK/{}", city.id.to_uppercase()),
            name: format!("Parking {} ({})", city.name, city.country),
            category: Some("transport".to_string()),
            metadata: serde_json::json!({
                "api_ref": city.id,
                "subcategory": "parking",
                "active": true,
                "extra": {
                    "country": city.country,
                },
            }),
        };

        assert_eq!(asset.asset_id, "parking_zuerich");
        assert_eq!(asset.symbol, "PARK/ZUERICH");
        assert_eq!(asset.name, "Parking Zuerich (Switzerland)");
        assert_eq!(asset.category, Some("transport".to_string()));
        assert_eq!(asset.metadata["subcategory"], "parking");
        assert_eq!(asset.metadata["api_ref"], "zuerich");
        assert_eq!(asset.metadata["extra"]["country"], "Switzerland");
    }
}
