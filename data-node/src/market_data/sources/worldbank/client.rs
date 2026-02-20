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
    AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// World Bank API base URL
const WB_API_URL: &str = "https://api.worldbank.org/v2";

/// World Bank indicators
/// (code, name, unit, category)
const WB_INDICATORS: &[(&str, &str, &str, &str)] = &[
    ("NY.GDP.MKTP.CD", "GDP (Current USD)", "usd", "economy"),
    (
        "NY.GDP.MKTP.KD.ZG",
        "GDP Growth (Annual %)",
        "percent",
        "economy",
    ),
    ("NY.GDP.PCAP.CD", "GDP Per Capita", "usd", "economy"),
    ("SP.POP.TOTL", "Total Population", "count", "demographics"),
    (
        "SP.POP.GROW",
        "Population Growth",
        "percent",
        "demographics",
    ),
    ("FP.CPI.TOTL.ZG", "Inflation (CPI)", "percent", "prices"),
    ("SL.UEM.TOTL.ZS", "Unemployment Rate", "percent", "labor"),
    ("NE.EXP.GNFS.ZS", "Exports (% of GDP)", "percent", "trade"),
    ("NE.IMP.GNFS.ZS", "Imports (% of GDP)", "percent", "trade"),
    (
        "BN.CAB.XOKA.GD.ZS",
        "Current Account (% GDP)",
        "percent",
        "trade",
    ),
    (
        "GC.DOD.TOTL.GD.ZS",
        "Government Debt (% GDP)",
        "percent",
        "fiscal",
    ),
    ("FR.INR.RINR", "Real Interest Rate", "percent", "rates"),
    ("PA.NUS.FCRF", "Official Exchange Rate", "lcu_per_usd", "fx"),
    (
        "EG.USE.PCAP.KG.OE",
        "Energy Use Per Capita",
        "kg_oil_equiv",
        "energy",
    ),
    (
        "EN.ATM.CO2E.PC",
        "CO2 Emissions Per Capita",
        "metric_tons",
        "environment",
    ),
];

/// Countries (top 20 by GDP)
const WB_COUNTRIES: &[(&str, &str)] = &[
    ("USA", "United States"),
    ("CHN", "China"),
    ("JPN", "Japan"),
    ("DEU", "Germany"),
    ("IND", "India"),
    ("GBR", "United Kingdom"),
    ("FRA", "France"),
    ("ITA", "Italy"),
    ("BRA", "Brazil"),
    ("CAN", "Canada"),
    ("RUS", "Russia"),
    ("KOR", "South Korea"),
    ("AUS", "Australia"),
    ("ESP", "Spain"),
    ("MEX", "Mexico"),
    ("IDN", "Indonesia"),
    ("NLD", "Netherlands"),
    ("SAU", "Saudi Arabia"),
    ("TUR", "Turkey"),
    ("CHE", "Switzerland"),
];

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
    client: reqwest::Client,
}

impl WorldBankMarketSource {
    /// Create the World Bank client
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        let total_assets = WB_INDICATORS.len() * WB_COUNTRIES.len();
        info!(
            "World Bank client initialized with {} series ({} indicators × {} countries)",
            total_assets,
            WB_INDICATORS.len(),
            WB_COUNTRIES.len()
        );

        Ok(Self { client })
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

        let resp = self.client.get(&url).send().await.with_context(|| {
            format!(
                "Failed to fetch World Bank data for {} {}",
                country, indicator
            )
        })?;

        if !resp.status().is_success() {
            let status = resp.status();
            debug!(
                "World Bank API error for {} {}: {}",
                country, indicator, status
            );
            return Ok(None);
        }

        // World Bank returns [metadata, data[]] array
        let text = resp.text().await?;
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
        let mut assets = Vec::new();

        for (country_code, country_name) in WB_COUNTRIES {
            for (indicator_code, indicator_name, unit, category) in WB_INDICATORS {
                let asset_id = Self::make_asset_id(country_code, indicator_code);
                let name = format!("{} - {}", country_name, indicator_name);

                assets.push(AssetUpdate {
                    asset_id,
                    symbol: format!("{}_{}", country_code, indicator_code.replace('.', "_")),
                    name,
                    category: Some(category.to_string()),
                    metadata: serde_json::json!({
                        "source": "worldbank",
                        "country": country_code,
                        "country_name": country_name,
                        "indicator": indicator_code,
                        "indicator_name": indicator_name,
                        "unit": unit,
                        "update_frequency": "annual",
                    }),
                });
            }
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for (country_code, _country_name) in WB_COUNTRIES {
            for (indicator_code, _indicator_name, _unit, _category) in WB_INDICATORS {
                // Be nice to the API
                tokio::time::sleep(Duration::from_millis(200)).await;

                let asset_id = Self::make_asset_id(country_code, indicator_code);

                match self.fetch_indicator(country_code, indicator_code).await {
                    Ok(Some((_date, value))) => {
                        if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                            results.push(PriceUpdate {
                                asset_id,
                                symbol: format!("{}_{}", country_code, indicator_code),
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
                            country_code, indicator_code, e
                        );
                    }
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
        let total = WB_INDICATORS.len() * WB_COUNTRIES.len();
        assert_eq!(total, 300); // 15 indicators × 20 countries
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
        let categories: Vec<_> = WB_INDICATORS.iter().map(|i| i.3).collect();
        assert!(categories.contains(&"economy"));
        assert!(categories.contains(&"demographics"));
        assert!(categories.contains(&"trade"));
    }
}
