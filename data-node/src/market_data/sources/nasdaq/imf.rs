//! IMF World Economic Outlook data source
//!
//! Fetches IMF WEO data via Nasdaq Data Link (ODA database).
//! Data updated semi-annually (April and October).
//!
//! Provides 60 series: 6 indicators × 10 major economies.

use anyhow::Result;
use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info};

use super::client::NasdaqClient;
use crate::market_data::traits::{
    AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// IMF WEO indicators
/// (code, name, unit, category)
const IMF_INDICATORS: &[(&str, &str, &str, &str)] = &[
    ("NGDP_RPCH", "Real GDP Growth", "percent_yoy", "growth"),
    ("PCPIPCH", "Inflation Rate", "percent_yoy", "inflation"),
    ("LUR", "Unemployment Rate", "percent", "employment"),
    (
        "BCA_NGDPD",
        "Current Account Balance",
        "percent_gdp",
        "trade",
    ),
    ("GGXWDG_NGDP", "Government Debt", "percent_gdp", "fiscal"),
    ("NGDPD", "Nominal GDP", "billion_usd", "growth"),
];

/// Countries to track (ISO 3-letter codes)
/// (code, name)
const IMF_COUNTRIES: &[(&str, &str)] = &[
    ("USA", "United States"),
    ("CHN", "China"),
    ("JPN", "Japan"),
    ("DEU", "Germany"),
    ("GBR", "United Kingdom"),
    ("FRA", "France"),
    ("IND", "India"),
    ("ITA", "Italy"),
    ("BRA", "Brazil"),
    ("CAN", "Canada"),
];

/// Nasdaq dataset response structure
#[derive(Debug, Deserialize)]
struct NasdaqDatasetResponse {
    dataset: NasdaqDataset,
}

#[derive(Debug, Deserialize)]
struct NasdaqDataset {
    #[allow(dead_code)]
    column_names: Vec<String>,
    data: Vec<Vec<serde_json::Value>>,
}

/// IMF market data source
pub struct ImfMarketSource {
    client: NasdaqClient,
}

impl ImfMarketSource {
    /// Create from environment variable
    pub fn from_env() -> Result<Self> {
        let client = NasdaqClient::from_env()?;
        let total_assets = IMF_INDICATORS.len() * IMF_COUNTRIES.len();
        info!(
            "IMF client initialized with {} series ({} indicators × {} countries)",
            total_assets,
            IMF_INDICATORS.len(),
            IMF_COUNTRIES.len()
        );
        Ok(Self { client })
    }

    /// Generate asset ID from country and indicator
    fn make_asset_id(country: &str, indicator: &str) -> String {
        format!(
            "imf_{}_{}",
            country.to_lowercase(),
            indicator.to_lowercase()
        )
    }

    /// Fetch a single series
    async fn fetch_series(&self, country: &str, indicator: &str) -> Result<Option<(String, f64)>> {
        // ODA dataset format: ODA/{COUNTRY}_{INDICATOR}
        let dataset_code = format!("ODA/{}_{}", country, indicator);

        let resp: NasdaqDatasetResponse = match self.client.fetch_dataset(&dataset_code, 1).await {
            Ok(r) => r,
            Err(e) => {
                debug!(
                    "Failed to fetch IMF data for {} {}: {:?}",
                    country, indicator, e
                );
                return Ok(None);
            }
        };

        if resp.dataset.data.is_empty() {
            return Ok(None);
        }

        let row = &resp.dataset.data[0];

        // Date is first column, value is second
        let date = row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let value = row.get(1).and_then(|v| v.as_f64());

        if let Some(v) = value {
            Ok(Some((date, v)))
        } else {
            Ok(None)
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for ImfMarketSource {
    fn source_id(&self) -> &'static str {
        "imf"
    }

    fn display_name(&self) -> &'static str {
        "IMF World Economic Outlook"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Sync once per week (data only updates semi-annually)
        Duration::from_secs(7 * 24 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![
                RateWindow {
                    max_requests: 250,
                    duration: Duration::from_secs(10),
                },
                RateWindow {
                    max_requests: 40000,
                    duration: Duration::from_secs(86400),
                },
            ],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let mut assets = Vec::new();

        for (country_code, country_name) in IMF_COUNTRIES {
            for (indicator_code, indicator_name, unit, category) in IMF_INDICATORS {
                let asset_id = Self::make_asset_id(country_code, indicator_code);
                let name = format!("{} - {}", country_name, indicator_name);

                assets.push(AssetUpdate {
                    asset_id,
                    symbol: format!("{}_{}", country_code, indicator_code),
                    name,
                    category: Some(category.to_string()),
                    metadata: serde_json::json!({
                        "source": "imf",
                        "database": "ODA",
                        "country": country_code,
                        "country_name": country_name,
                        "indicator": indicator_code,
                        "indicator_name": indicator_name,
                        "unit": unit,
                        "update_frequency": "semi-annual",
                    }),
                });
            }
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for (country_code, _country_name) in IMF_COUNTRIES {
            for (indicator_code, _indicator_name, _unit, _category) in IMF_INDICATORS {
                // Small delay between requests
                tokio::time::sleep(Duration::from_millis(100)).await;

                let asset_id = Self::make_asset_id(country_code, indicator_code);

                match self.fetch_series(country_code, indicator_code).await {
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
                        // Many country/indicator combos may not exist
                    }
                    Err(e) => {
                        debug!(
                            "Error fetching IMF {} {}: {:?}",
                            country_code, indicator_code, e
                        );
                    }
                }
            }
        }

        info!("Fetched {} IMF WEO indicators", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for ImfMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // IMF WEO releases in April and October
        // Check if we're in a release window (first 2 weeks of April or October)
        let month = now.month();

        if (month == 4 || month == 10) && now.day() <= 15 {
            // In release window: check daily
            return now + chrono::Duration::days(1);
        }

        // Outside release window: check weekly
        now + chrono::Duration::days(7)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Annual data, no day restrictions
        false
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        // Burst mode during WEO release windows (first 2 weeks of April/October)
        let month = now.month();
        let day = now.day();

        if (month == 4 || month == 10) && day <= 15 {
            return Some(Duration::from_secs(6 * 3600)); // Every 6 hours
        }

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
        let total = IMF_INDICATORS.len() * IMF_COUNTRIES.len();
        assert_eq!(total, 60);
    }

    #[test]
    fn test_make_asset_id() {
        assert_eq!(
            ImfMarketSource::make_asset_id("USA", "NGDP_RPCH"),
            "imf_usa_ngdp_rpch"
        );
    }

    #[test]
    fn test_countries() {
        let countries: Vec<_> = IMF_COUNTRIES.iter().map(|(c, _)| *c).collect();
        assert!(countries.contains(&"USA"));
        assert!(countries.contains(&"CHN"));
        assert!(countries.contains(&"DEU"));
    }
}
