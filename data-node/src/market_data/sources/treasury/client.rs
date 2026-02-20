//! US Treasury API client via Nasdaq Data Link
//!
//! Fetches Treasury data from https://data.nasdaq.com/api/v3/datasets/USTREASURY
//! Data published daily at 3:30 PM ET.

use anyhow::{Context, Result};
use chrono::{DateTime, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::US::Eastern;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    is_us_market_closed, next_us_trading_day, today_at_eastern, AssetUpdate, MarketDataSource,
    PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Nasdaq Data Link API base URL
const NASDAQ_API_URL: &str = "https://data.nasdaq.com/api/v3/datasets";

/// Treasury datasets to fetch
const TREASURY_DATASETS: &[(&str, &str, &[&str])] = &[
    // (dataset_code, display_prefix, column_names_to_extract)
    (
        "USTREASURY/YIELD",
        "Treasury Yield",
        &[
            "1 MO", "2 MO", "3 MO", "6 MO", "1 YR", "2 YR", "3 YR", "5 YR", "7 YR", "10 YR",
            "20 YR", "30 YR",
        ],
    ),
    (
        "USTREASURY/BILLRATES",
        "T-Bill Rate",
        &[
            "4 WEEKS BANK DISCOUNT",
            "8 WEEKS BANK DISCOUNT",
            "13 WEEKS BANK DISCOUNT",
            "26 WEEKS BANK DISCOUNT",
            "52 WEEKS BANK DISCOUNT",
        ],
    ),
    (
        "USTREASURY/REALYIELD",
        "Real Yield",
        &["5 YR", "7 YR", "10 YR", "20 YR", "30 YR"],
    ),
];

/// Nasdaq Data Link dataset response
#[derive(Debug, Deserialize)]
struct NasdaqDatasetResponse {
    dataset: NasdaqDataset,
}

#[derive(Debug, Deserialize)]
struct NasdaqDataset {
    column_names: Vec<String>,
    data: Vec<Vec<serde_json::Value>>,
}

/// Treasury market data source
pub struct TreasuryMarketSource {
    client: reqwest::Client,
    api_key: String,
}

impl TreasuryMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("NASDAQ_API_KEY").context("NASDAQ_API_KEY not set")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!("Treasury client initialized (via Nasdaq Data Link)");

        Ok(Self { client, api_key })
    }

    /// Fetch a Treasury dataset and extract column values
    async fn fetch_dataset(
        &self,
        dataset_code: &str,
    ) -> Result<Option<(String, HashMap<String, f64>)>> {
        let url = format!(
            "{}/{}.json?api_key={}&rows=1",
            NASDAQ_API_URL, dataset_code, self.api_key
        );

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch Treasury dataset {}", dataset_code))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("Nasdaq API error for {}: {} {}", dataset_code, status, body);
            return Ok(None);
        }

        let data: NasdaqDatasetResponse = resp
            .json()
            .await
            .with_context(|| format!("Failed to parse Nasdaq response for {}", dataset_code))?;

        if data.dataset.data.is_empty() {
            debug!("No data in Treasury dataset {}", dataset_code);
            return Ok(None);
        }

        let row = &data.dataset.data[0];
        let columns = &data.dataset.column_names;

        // First column is always "Date"
        let date = row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        // Extract column name -> value mapping
        let mut values = HashMap::new();
        for (i, col_name) in columns.iter().enumerate().skip(1) {
            if let Some(val) = row.get(i) {
                if let Some(num) = val.as_f64() {
                    values.insert(col_name.clone(), num);
                }
            }
        }

        Ok(Some((date, values)))
    }

    /// Generate asset ID from dataset and column
    fn make_asset_id(dataset: &str, column: &str) -> String {
        let ds_short = dataset.replace("USTREASURY/", "").to_lowercase();
        let col_clean = column
            .replace(' ', "_")
            .replace("WEEKS", "WK")
            .replace("BANK_DISCOUNT", "")
            .trim_end_matches('_')
            .to_lowercase();
        format!("tsy_{}_{}", ds_short, col_clean)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TreasuryMarketSource {
    fn source_id(&self) -> &'static str {
        "bonds"
    }

    fn display_name(&self) -> &'static str {
        "US Treasury Yields"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![
                RateWindow {
                    max_requests: 250, // Conservative: Nasdaq allows 300/10sec
                    duration: Duration::from_secs(10),
                },
                RateWindow {
                    max_requests: 40000, // Conservative: Nasdaq allows 50k/day
                    duration: Duration::from_secs(86400),
                },
            ],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let mut assets = Vec::new();

        for (dataset, display_prefix, columns) in TREASURY_DATASETS {
            let category = match *dataset {
                "USTREASURY/YIELD" => "treasury_yields",
                "USTREASURY/BILLRATES" => "tbill_rates",
                "USTREASURY/REALYIELD" => "real_yields",
                _ => "bonds",
            };

            for col in *columns {
                let asset_id = Self::make_asset_id(dataset, col);
                let name = format!("{} {}", display_prefix, col);

                assets.push(AssetUpdate {
                    asset_id: asset_id.clone(),
                    symbol: asset_id,
                    name,
                    category: Some(category.to_string()),
                    metadata: serde_json::json!({
                        "source": "nasdaq",
                        "dataset": dataset,
                        "column": col,
                    }),
                });
            }
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        // Fetch all Treasury datasets
        for (dataset, _display_prefix, columns) in TREASURY_DATASETS {
            // Small delay between requests
            tokio::time::sleep(Duration::from_millis(200)).await;

            match self.fetch_dataset(dataset).await {
                Ok(Some((_date, values))) => {
                    for col in *columns {
                        let asset_id = Self::make_asset_id(dataset, col);

                        if let Some(&value) = values.get(*col) {
                            if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                                results.push(PriceUpdate {
                                    asset_id: asset_id.clone(),
                                    symbol: asset_id,
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
                Ok(None) => {
                    debug!("No data for Treasury dataset {}", dataset);
                }
                Err(e) => {
                    warn!("Error fetching Treasury dataset {}: {:?}", dataset, e);
                }
            }
        }

        info!("Fetched {} Treasury prices from Nasdaq", results.len());

        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for TreasuryMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let hour = eastern.hour();
        let minute = eastern.minute();

        // Treasury publishes at 3:30 PM ET
        let publish_hour = 15;
        let publish_minute = 30;

        // Fetch windows: 3:30 PM, 4:00 PM, 4:30 PM ET
        if hour < publish_hour || (hour == publish_hour && minute < publish_minute) {
            // Before 3:30 PM: wait for publish time
            return today_at_eastern(now, publish_hour, publish_minute);
        } else if hour == publish_hour && minute >= publish_minute {
            // At 3:30 PM: fetch now
            return now;
        } else if hour == 16 && minute < 30 {
            // 4:00-4:30 PM: fetch at 4:00 or now if past
            if minute < 5 {
                return now;
            }
            return today_at_eastern(now, 16, 30);
        } else if hour == 16 && minute >= 30 && minute < 35 {
            // 4:30 PM: fetch now
            return now;
        }

        // After 4:30 PM: wait for next trading day at 3:30 PM
        let next_day = next_us_trading_day(now);
        let next_eastern = next_day.with_timezone(&Eastern);
        let fetch_time = next_eastern
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(publish_hour, publish_minute, 0).unwrap());
        Eastern
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_market_closed(now)
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        // No burst mode for Treasury - data only updates once daily
        None
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_make_asset_id() {
        assert_eq!(
            TreasuryMarketSource::make_asset_id("USTREASURY/YIELD", "10 YR"),
            "tsy_yield_10_yr"
        );
        assert_eq!(
            TreasuryMarketSource::make_asset_id("USTREASURY/BILLRATES", "4 WEEKS BANK DISCOUNT"),
            "tsy_billrates_4_wk"
        );
    }

    #[test]
    fn test_asset_count() {
        // Count total assets we'll generate
        let total: usize = TREASURY_DATASETS
            .iter()
            .map(|(_, _, cols)| cols.len())
            .sum();
        assert!(total >= 20, "Expected at least 20 Treasury assets");
    }
}
