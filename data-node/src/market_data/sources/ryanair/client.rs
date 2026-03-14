//! Ryanair cheapest fares source implementing MarketDataSource
//!
//! Tracks the cheapest one-way fare from each airport for Ryanair flights.
//! Each airport is an asset; its value is the cheapest fare in EUR
//! for the next 7 days of departures.
//!
//! Assets are static -- defined in config/ryanair.json (40 airports).
//!
//! API: https://services-api.ryanair.com/farfnd/v4/ (unofficial, may change)
//! Auth: None
//! Rate limit: Conservative 20 req/5min (Ryanair is strict about bot traffic)

use anyhow::Result;
use chrono::{Duration as ChronoDuration, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/ryanair.json");

/// Ryanair fare finder API base (services-api bypasses WAF on www.ryanair.com)
const API_BASE: &str = "https://services-api.ryanair.com/farfnd/v4/oneWayFares";

/// Delay between per-airport requests (Ryanair blocks aggressive crawling)
const INTER_REQUEST_DELAY_MS: u64 = 1500;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct FareFinderResponse {
    fares: Vec<Fare>,
}

#[derive(Debug, Deserialize)]
struct Fare {
    outbound: OutboundFare,
}

#[derive(Debug, Deserialize)]
struct OutboundFare {
    #[serde(rename = "departureAirport")]
    departure_airport: Airport,
    #[serde(rename = "arrivalAirport")]
    arrival_airport: Airport,
    price: FarePrice,
}

#[derive(Debug, Deserialize)]
struct Airport {
    #[serde(rename = "iataCode")]
    iata_code: String,
}

#[derive(Debug, Deserialize)]
struct FarePrice {
    value: f64,
    #[serde(rename = "currencyCode")]
    currency_code: String,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct RyanairMarketSource {
    http: SourceHttpClient,
}

impl RyanairMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Ryanair cheapest fares source initialized");
        Ok(Self { http })
    }

    /// Build browser-like headers to avoid bot detection
    fn api_headers() -> Vec<(&'static str, &'static str)> {
        vec![
            ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
            ("Accept", "application/json, text/plain, */*"),
            ("Accept-Language", "en-US,en;q=0.9"),
            ("Referer", "https://www.ryanair.com/"),
            ("Origin", "https://www.ryanair.com"),
        ]
    }
}

#[async_trait::async_trait]
impl MarketDataSource for RyanairMarketSource {
    fn source_id(&self) -> &'static str {
        "ryanair"
    }

    fn display_name(&self) -> &'static str {
        "Ryanair Cheapest Fares"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(900) // 15 minutes (40 airports * 1.5s delay = ~60s per cycle)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(300),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "Ryanair fetch_assets: {} airports loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Date range: today to today+7
        let date_from = now.format("%Y-%m-%d").to_string();
        let date_to = (now + ChronoDuration::days(7))
            .format("%Y-%m-%d")
            .to_string();

        // Load config to get airport IATA codes from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        let headers = Self::api_headers();
        let mut results = Vec::with_capacity(asset_ids.len());

        for (i, asset_id) in asset_ids.iter().enumerate() {
            let (airport_code, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (airport code) for asset {}", asset_id);
                    continue;
                }
            };

            // Rate limit: delay between requests (skip delay for the first request)
            if i > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let url = format!(
                "{}?departureAirportIataCode={}&outboundDepartureDateFrom={}&outboundDepartureDateTo={}&currency=EUR&limit=1",
                API_BASE, airport_code, date_from, date_to
            );

            let resp: FareFinderResponse = match self
                .http
                .get_json_with_headers(&url, &headers)
                .await
            {
                Ok(data) => data,
                Err(e) => {
                    warn!(
                        "Ryanair: failed to fetch fares for {} ({}): {:?}",
                        airport_code, asset_id, e
                    );
                    continue;
                }
            };

            // Extract cheapest fare
            let fare = match resp.fares.first() {
                Some(f) => f,
                None => {
                    debug!(
                        "Ryanair: no fares available from {} in date range {}-{}",
                        airport_code, date_from, date_to
                    );
                    continue;
                }
            };

            let price_value = fare.outbound.price.value;
            let value = match Decimal::from_str(&format!("{:.2}", price_value)) {
                Ok(d) => d,
                Err(e) => {
                    warn!(
                        "Ryanair: invalid price {} for {}: {:?}",
                        price_value, airport_code, e
                    );
                    continue;
                }
            };

            debug!(
                "Ryanair: {} -> {} cheapest fare: {} {}",
                fare.outbound.departure_airport.iata_code,
                fare.outbound.arrival_airport.iata_code,
                price_value,
                fare.outbound.price.currency_code
            );

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

        info!(
            "Fetched {}/{} prices from Ryanair (cheapest fares, {} to {})",
            results.len(),
            asset_ids.len(),
            date_from,
            date_to,
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
            entries.len() >= 30,
            "Expected >= 30 airport entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 30,
            "Expected >= 30 active airport assets, got {}",
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
                entry.asset_id.starts_with("ryanair_"),
                "Asset ID {} should start with 'ryanair_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_fr() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("FR/"),
                "Symbol '{}' should start with 'FR/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        ids.sort();
        let original_len = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), original_len, "All asset IDs should be unique");
    }

    #[test]
    fn test_known_airports_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let iata_codes: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(iata_codes.contains(&"DUB"), "Dublin should be present");
        assert!(iata_codes.contains(&"STN"), "London Stansted should be present");
        assert!(iata_codes.contains(&"MAD"), "Madrid should be present");
        assert!(iata_codes.contains(&"BCN"), "Barcelona should be present");
    }

    #[test]
    fn test_fare_response_parsing() {
        let json = r#"{
            "fares": [
                {
                    "outbound": {
                        "departureAirport": {"iataCode": "DUB"},
                        "arrivalAirport": {"iataCode": "STN"},
                        "price": {"value": 29.99, "currencyCode": "EUR"}
                    }
                }
            ]
        }"#;

        let resp: FareFinderResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.fares.len(), 1);
        assert_eq!(resp.fares[0].outbound.departure_airport.iata_code, "DUB");
        assert_eq!(resp.fares[0].outbound.arrival_airport.iata_code, "STN");
        assert!((resp.fares[0].outbound.price.value - 29.99).abs() < 0.001);
        assert_eq!(resp.fares[0].outbound.price.currency_code, "EUR");
    }

    #[test]
    fn test_fare_response_empty_fares() {
        let json = r#"{"fares": []}"#;
        let resp: FareFinderResponse = serde_json::from_str(json).unwrap();
        assert!(resp.fares.is_empty());
    }

    #[test]
    fn test_api_url_construction() {
        let url = format!(
            "{}?departureAirportIataCode={}&outboundDepartureDateFrom={}&outboundDepartureDateTo={}&currency=EUR&limit=1",
            API_BASE, "DUB", "2026-03-14", "2026-03-21"
        );
        assert!(url.contains("departureAirportIataCode=DUB"));
        assert!(url.contains("outboundDepartureDateFrom=2026-03-14"));
        assert!(url.contains("outboundDepartureDateTo=2026-03-21"));
        assert!(url.contains("currency=EUR"));
        assert!(url.contains("limit=1"));
    }
}
