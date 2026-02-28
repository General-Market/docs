//! World Bank API client implementing MarketDataSource
//!
//! Fetches global economic indicators from https://api.worldbank.org/v2/
//! Free public API with no authentication required.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
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

/// World Bank API response structure
/// Note: Response is parsed manually from JSON, these types are kept for reference
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct WbDataResponse(Vec<serde_json::Value>, Vec<WbDataPoint>);

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct WbDataPoint {
    indicator: WbIndicatorRef,
    country: WbCountryRef,
    value: Option<f64>,
    date: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct WbIndicatorRef {
    id: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct WbCountryRef {
    id: String,
}

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
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

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

    /// Fetch indicator data for a country
    async fn fetch_indicator(
        &self,
        country: &str,
        indicator: &str,
    ) -> Result<Option<(String, f64)>> {
        let url = format!(
            "{}/country/{}/indicator/{}?format=json&per_page=1&mrv=1",
            WB_API_URL, country, indicator
        );

        // World Bank returns [metadata, data[]] array — fetch as raw text and parse
        let text = match self.http.get_raw(&url).await {
            Ok(t) => t,
            Err(e) => {
                debug!(
                    "World Bank API error for {} {}: {}",
                    country, indicator, e
                );
                return Ok(None);
            }
        };
        let data: Vec<serde_json::Value> = serde_json::from_str(&text).with_context(|| {
            format!(
                "Failed to parse World Bank response for {} {}",
                country, indicator
            )
        })?;

        if data.len() < 2 {
            return Ok(None);
        }

        // Parse data points
        if let Some(points) = data.get(1).and_then(|v| v.as_array()) {
            for point in points {
                if let (Some(date), Some(value)) = (
                    point.get("date").and_then(|d| d.as_str()),
                    point.get("value").and_then(|v| v.as_f64()),
                ) {
                    return Ok(Some((date.to_string(), value)));
                }
            }
        }

        Ok(None)
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

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        let entries = load_all_asset_entries(ASSET_JSON)?;

        for entry in &entries {
            let Some((country, indicator)) = Self::parse_api_ref(&entry.api_ref) else {
                continue;
            };

            match self.fetch_indicator(country, indicator).await {
                Ok(Some((_date, value))) => {
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
                Ok(None) => {
                    // Many country/indicator combos may not have recent data
                }
                Err(e) => {
                    debug!(
                        "Error fetching World Bank {} {}: {:?}",
                        country, indicator, e
                    );
                }
            }
        }

        info!("Fetched {} World Bank indicators", results.len());
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
