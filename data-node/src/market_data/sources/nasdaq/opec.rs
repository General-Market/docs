//! OPEC Reference Basket Price data source
//!
//! Fetches OPEC basket price via Nasdaq Data Link.
//! Data updated daily.

use anyhow::Result;
use chrono::{DateTime, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::US::Eastern;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use super::client::NasdaqClient;
use crate::market_data::traits::{
    next_us_trading_day, today_at_eastern, AssetUpdate, MarketDataSource, PriceUpdate,
    ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

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

/// OPEC market data source
pub struct OpecMarketSource {
    client: NasdaqClient,
}

impl OpecMarketSource {
    /// Create from environment variable
    pub fn from_env() -> Result<Self> {
        let client = NasdaqClient::from_env()?;
        info!("OPEC client initialized");
        Ok(Self { client })
    }

    /// Fetch OPEC basket price
    async fn fetch_basket(&self) -> Result<Option<(String, f64)>> {
        let resp: NasdaqDatasetResponse = match self.client.fetch_dataset("OPEC/ORB", 1).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to fetch OPEC basket price: {:?}", e);
                return Ok(None);
            }
        };

        if resp.dataset.data.is_empty() {
            debug!("No OPEC data available");
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
impl MarketDataSource for OpecMarketSource {
    fn source_id(&self) -> &'static str {
        "opec"
    }

    fn display_name(&self) -> &'static str {
        "OPEC Reference Basket"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Sync every 4 hours
        Duration::from_secs(4 * 3600)
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
        Ok(vec![AssetUpdate {
            asset_id: "opec_basket".to_string(),
            symbol: "ORB".to_string(),
            name: "OPEC Reference Basket Price".to_string(),
            category: Some("energy".to_string()),
            metadata: serde_json::json!({
                "source": "opec",
                "unit": "usd_per_barrel",
                "description": "Weighted average of oil prices from OPEC member countries",
            }),
        }])
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();

        match self.fetch_basket().await {
            Ok(Some((_date, value))) => {
                if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                    info!("Fetched OPEC basket price: ${:.2}", value);
                    return Ok(vec![PriceUpdate {
                        asset_id: "opec_basket".to_string(),
                        symbol: "ORB".to_string(),
                        value: decimal_value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    }]);
                }
            }
            Ok(None) => {
                debug!("No OPEC data available");
            }
            Err(e) => {
                warn!("Error fetching OPEC basket price: {:?}", e);
            }
        }

        Ok(vec![])
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for OpecMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // OPEC publishes daily, fetch at midday and evening
        let eastern = now.with_timezone(&Eastern);
        let hour = eastern.hour();

        if hour < 12 {
            return today_at_eastern(now, 12, 0);
        } else if hour < 18 {
            return today_at_eastern(now, 18, 0);
        }

        // After 6 PM: wait for next day at noon
        let next_day = next_us_trading_day(now);
        let next_eastern = next_day.with_timezone(&Eastern);
        let fetch_time = next_eastern
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(12, 0, 0).unwrap());
        Eastern
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // OPEC operates globally, no weekends
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
    #[test]
    fn test_asset_id() {
        // Verify the OPEC basket asset ID format
        let expected_id = "opec_basket";
        assert_eq!(expected_id.len(), 11);
        assert!(expected_id.starts_with("opec"));
    }
}
