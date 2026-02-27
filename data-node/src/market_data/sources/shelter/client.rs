//! Austin Animal Center Stray Map data source
//!
//! Tracks stray animal counts at the Austin Animal Center via the Socrata
//! Open Data API (SODA). Data updates in real-time as animals are logged.
//!
//! Assets track total strays, by species (Dog/Cat), and by shelter status
//! (at shelter vs. in foster/field).
//!
//! API: https://data.austintexas.gov/resource/kz4x-q9k5.json
//! Auth: None (public dataset, optional app token for higher rate limits)
//! Rate limit: 1000 req/hour without token
//! Sync interval: 1800s (30 minutes)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/shelter.json");

/// Austin Animal Center Stray Map SODA endpoint
const STRAY_MAP_URL: &str = "https://data.austintexas.gov/resource/kz4x-q9k5.json";

/// SODA count response
#[derive(Debug, Deserialize)]
struct SodaCountResponse {
    count: String,
}

/// Austin Animal Center shelter data source.
///
/// Tracks stray animal counts by species and shelter status.
/// Source ID is `"shelter"`.
pub struct ShelterMarketSource {
    http: SourceHttpClient,
}

impl ShelterMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Shelter Animals source initialized (Austin Animal Center SODA API)");
        Ok(Self { http })
    }

    /// Query the SODA API with an optional $where filter and return the count.
    async fn query_count(&self, where_clause: Option<&str>) -> Result<u64> {
        let url = match where_clause {
            Some(clause) => format!(
                "{}?$select=count(*)&$where={}",
                STRAY_MAP_URL,
                encode_soda_where(clause)
            ),
            None => format!("{}?$select=count(*)", STRAY_MAP_URL),
        };

        let results: Vec<SodaCountResponse> = self.http.get_json(&url).await?;

        let count = results
            .first()
            .and_then(|r| r.count.parse::<u64>().ok())
            .unwrap_or(0);

        Ok(count)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for ShelterMarketSource {
    fn source_id(&self) -> &'static str {
        "shelter"
    }

    fn display_name(&self) -> &'static str {
        "Shelter Animals"
    }

    fn default_resolution(&self) -> &'static str {
        "latest"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(1800) // 30 minutes
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
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Map api_ref patterns to SODA $where clauses
        let queries: Vec<(&str, &str, Option<&str>)> = vec![
            ("shelter_austin_stray_total", "SHLT/TOTAL", None),
            ("shelter_austin_stray_dogs", "SHLT/DOG", Some("type='Dog'")),
            ("shelter_austin_stray_cats", "SHLT/CAT", Some("type='Cat'")),
            ("shelter_austin_at_shelter", "SHLT/AT", Some("at_aac='Yes (come to the shelter)'")),
            ("shelter_austin_not_at_shelter", "SHLT/AWAY", Some("at_aac='No (contact for more info)'")),
            ("shelter_austin_dogs_at_shelter", "SHLT/DOG-AT", Some("type='Dog' AND at_aac='Yes (come to the shelter)'")),
            ("shelter_austin_cats_at_shelter", "SHLT/CAT-AT", Some("type='Cat' AND at_aac='Yes (come to the shelter)'")),
            ("shelter_austin_dogs_not_at_shelter", "SHLT/DOG-AW", Some("type='Dog' AND at_aac='No (contact for more info)'")),
            ("shelter_austin_cats_not_at_shelter", "SHLT/CAT-AW", Some("type='Cat' AND at_aac='No (contact for more info)'")),
        ];

        for (asset_id, symbol, where_clause) in &queries {
            if !asset_ids.iter().any(|id| id == *asset_id) {
                continue;
            }

            // Small delay between requests
            tokio::time::sleep(Duration::from_millis(200)).await;

            match self.query_count(*where_clause).await {
                Ok(count) => {
                    if let Ok(value) = Decimal::from_str(&count.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: asset_id.to_string(),
                            symbol: symbol.to_string(),
                            value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Err(e) => {
                    warn!("Shelter query failed for {}: {:?}", asset_id, e);
                }
            }
        }

        info!("Fetched {}/{} shelter animal counts", results.len(), asset_ids.len());
        Ok(results)
    }
}

/// Percent-encode a SODA $where clause for use in a URL query parameter.
fn encode_soda_where(clause: &str) -> String {
    clause
        .replace('%', "%25")
        .replace(' ', "%20")
        .replace('\'', "%27")
        .replace('=', "%3D")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 9, "Expected 9 shelter assets");
    }

    #[test]
    fn test_fetch_assets_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 9);
        for asset in &assets {
            assert_eq!(asset.category, Some("animals".to_string()));
        }
    }

    #[test]
    fn test_asset_ids_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("shelter_austin_"),
                "Asset ID '{}' should start with 'shelter_austin_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_soda_count_parsing() {
        let json = r#"[{"count": "42"}]"#;
        let results: Vec<SodaCountResponse> = serde_json::from_str(json).unwrap();
        assert_eq!(results[0].count, "42");
        assert_eq!(results[0].count.parse::<u64>().unwrap(), 42);
    }
}
