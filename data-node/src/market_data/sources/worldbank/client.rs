//! World Bank API client implementing MarketDataSource
//!
//! Fetches global economic indicators from https://api.worldbank.org/v2/
//! Free public API with no authentication required.

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info};

use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
    ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// World Bank API base URL
const WB_API_URL: &str = "https://api.worldbank.org/v2";

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/worldbank.json");

/// World Bank market data source
pub struct WorldBankMarketSource {
    http: SourceHttpClient,
}

impl WorldBankMarketSource {
    /// Create the World Bank client
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 50,
                duration: Duration::from_secs(60),
            }],
        };

        // Use a custom client with User-Agent and longer timeout for World Bank API
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(45))
            .connect_timeout(Duration::from_secs(10))
            .user_agent("IndexDataNode/1.0")
            .build()
            .expect("Failed to create World Bank HTTP client");

        let retry = RetryConfig {
            max_retries: 4,
            base_delay_ms: 500,
            max_delay_ms: 10_000,
        };

        let http = SourceHttpClient::with_client(client, rate_limit, retry);

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!(
            "World Bank client initialized with {} indicators",
            asset_count
        );

        Ok(Self { http })
    }

    /// Parse country and indicator from api_ref (format: "COUNTRY:INDICATOR")
    fn parse_api_ref(api_ref: &str) -> Option<(&str, &str)> {
        api_ref.split_once(':')
    }

    /// Generate asset ID from country and indicator
    fn make_asset_id(country: &str, indicator: &str) -> String {
        let ind_short = indicator.replace('.', "_").to_lowercase();
        format!("wb_{}_{}", country.to_lowercase(), ind_short)
    }

}

#[async_trait::async_trait]
impl MarketDataSource for WorldBankMarketSource {
    fn source_id(&self) -> &'static str {
        "worldbank"
    }

    fn display_name(&self) -> &'static str {
        "World Bank Global Indicators"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Annual data, check weekly
        Duration::from_secs(7 * 24 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 50, // Be nice to public API
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

        // Build a lookup from asset_id -> entry for only the requested assets
        let all_entries = load_all_asset_entries(ASSET_JSON)?;
        let requested: std::collections::HashSet<&String> = asset_ids.iter().collect();

        // Group entries by indicator so we can batch countries for the same indicator.
        // World Bank API supports multi-country queries: /country/USA;CHN;JPN/indicator/X
        let mut indicator_groups: std::collections::HashMap<String, Vec<_>> = std::collections::HashMap::new();
        for entry in &all_entries {
            if !requested.contains(&entry.asset_id) {
                continue;
            }
            let Some((country, indicator)) = Self::parse_api_ref(&entry.api_ref) else {
                continue;
            };
            indicator_groups
                .entry(indicator.to_string())
                .or_default()
                .push((country.to_string(), entry.clone()));
        }

        // Fetch each indicator once with all countries batched
        for (indicator, country_entries) in &indicator_groups {
            let countries: Vec<&str> = country_entries.iter().map(|(c, _)| c.as_str()).collect();
            let countries_joined = countries.join(";");

            let url = format!(
                "{}/country/{}/indicator/{}?format=json&per_page=50&mrv=1",
                WB_API_URL, countries_joined, indicator
            );

            match self.http.get_raw(&url).await {
                Ok(text) => {
                    let data: Vec<serde_json::Value> = match serde_json::from_str(&text) {
                        Ok(d) => d,
                        Err(e) => {
                            debug!("Failed to parse World Bank response for {}: {}", indicator, e);
                            continue;
                        }
                    };

                    if data.len() < 2 {
                        continue;
                    }

                    // Parse data points and build a country->value map
                    let mut country_values: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
                    if let Some(points) = data.get(1).and_then(|v| v.as_array()) {
                        for point in points {
                            if let (Some(country_obj), Some(value)) = (
                                point.get("country").and_then(|c| c.get("id")).and_then(|id| id.as_str()),
                                point.get("value").and_then(|v| v.as_f64()),
                            ) {
                                // Only insert first occurrence (most recent value)
                                country_values.entry(country_obj.to_string()).or_insert(value);
                            }
                        }
                    }

                    // Match back to entries
                    for (country, entry) in country_entries {
                        if let Some(&value) = country_values.get(country) {
                            if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                                results.push(PriceUpdate {
                                    asset_id: entry.asset_id.clone(),
                                    symbol: entry.symbol.clone(),
                                    value: decimal_value,
                                    prev_close: None,
                                    change_pct: None,
                                    volume_24h: None,
                                    market_cap: None,
                                    fetched_at: now,
                                });
                            }
                        }
                    }
                }
                Err(e) => {
                    debug!("Error fetching World Bank indicator {}: {}", indicator, e);
                }
            }
        }

        info!("Fetched {}/{} World Bank indicators", results.len(), asset_ids.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for WorldBankMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // Check weekly
        now + chrono::Duration::days(7)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Annual data, no restrictions
        false
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        None
    }

    fn timezone(&self) -> &'static str {
        "UTC"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        // Trimmed to top 20 indicators for major economies
        assert!(entries.len() >= 20, "Expected at least 20 indicators");
    }

    #[test]
    fn test_make_asset_id() {
        assert_eq!(
            WorldBankMarketSource::make_asset_id("USA", "NY.GDP.MKTP.CD"),
            "wb_usa_ny_gdp_mktp_cd"
        );
    }

    #[test]
    fn test_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.category == "macro"));
        assert!(entries.iter().all(|e| e.subcategory == "global_indicators"));
    }
}
