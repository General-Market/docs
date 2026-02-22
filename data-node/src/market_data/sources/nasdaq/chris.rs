//! CHRIS Continuous Futures data source
//!
//! Fetches continuous futures contract prices via Nasdaq Data Link.
//! Data updated daily at end of day.
//!
//! Provides 50 continuous contracts across indices, energy, metals,
//! agriculture, rates, currencies, and volatility.

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
    is_us_market_closed, load_all_asset_entries, load_assets_from_json, next_us_trading_day,
    today_at_eastern, AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/futures.json");

/// Nasdaq dataset response structure
#[derive(Debug, Deserialize)]
struct NasdaqDatasetResponse {
    dataset: NasdaqDataset,
}

#[derive(Debug, Deserialize)]
struct NasdaqDataset {
    column_names: Vec<String>,
    data: Vec<Vec<serde_json::Value>>,
}

/// CHRIS market data source
pub struct ChrisMarketSource {
    client: NasdaqClient,
}

impl ChrisMarketSource {
    /// Create from environment variable
    pub fn from_env() -> Result<Self> {
        let client = NasdaqClient::from_env()?;
        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("CHRIS client initialized with {} contracts", asset_count);
        Ok(Self { client })
    }

    /// Fetch price for a contract
    async fn fetch_contract(&self, contract_code: &str) -> Result<Option<ChrisPrice>> {
        let dataset_code = format!("CHRIS/{}", contract_code);

        let resp: NasdaqDatasetResponse = match self.client.fetch_dataset(&dataset_code, 1).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to fetch CHRIS contract {}: {:?}", contract_code, e);
                return Ok(None);
            }
        };

        if resp.dataset.data.is_empty() {
            debug!("No CHRIS data for {}", contract_code);
            return Ok(None);
        }

        let row = &resp.dataset.data[0];
        let columns = &resp.dataset.column_names;

        // Find column indices
        let get_value = |name: &str| -> Option<f64> {
            columns
                .iter()
                .position(|c| c.to_lowercase().contains(&name.to_lowercase()))
                .and_then(|i| row.get(i))
                .and_then(|v| v.as_f64())
        };

        // Get settle price (or last, or close)
        let price = get_value("settle")
            .or_else(|| get_value("last"))
            .or_else(|| get_value("close"));

        let prev_close = get_value("previous");
        let volume = get_value("volume");
        let open_interest = get_value("open interest");

        // Date from first column
        let date = row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        if let Some(p) = price {
            Ok(Some(ChrisPrice {
                date,
                settle: p,
                prev_close,
                volume,
                open_interest,
            }))
        } else {
            Ok(None)
        }
    }
}

/// CHRIS price data
struct ChrisPrice {
    #[allow(dead_code)]
    date: String,
    settle: f64,
    prev_close: Option<f64>,
    volume: Option<f64>,
    #[allow(dead_code)]
    open_interest: Option<f64>,
}

#[async_trait::async_trait]
impl MarketDataSource for ChrisMarketSource {
    fn source_id(&self) -> &'static str {
        "futures"
    }

    fn display_name(&self) -> &'static str {
        "CHRIS Continuous Futures"
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
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();

        for entry in &entries {
            if !entry.active {
                continue;
            }

            let contract_code = &entry.api_ref;

            // Small delay between requests
            tokio::time::sleep(Duration::from_millis(100)).await;

            match self.fetch_contract(contract_code).await {
                Ok(Some(price)) => {
                    if let Ok(value) = Decimal::from_str(&price.settle.to_string()) {
                        let prev_close = price
                            .prev_close
                            .and_then(|p| Decimal::from_str(&p.to_string()).ok());

                        let change_pct = match (prev_close, Some(value)) {
                            (Some(prev), Some(curr)) if prev != Decimal::ZERO => {
                                Some(((curr - prev) / prev) * Decimal::from(100))
                            }
                            _ => None,
                        };

                        let volume_24h = price
                            .volume
                            .and_then(|v| Decimal::from_str(&v.to_string()).ok());

                        results.push(PriceUpdate {
                            asset_id: entry.asset_id.clone(),
                            symbol: entry.symbol.clone(),
                            value,
                            prev_close,
                            change_pct,
                            volume_24h,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Ok(None) => {
                    debug!("No CHRIS data for {}", contract_code);
                }
                Err(e) => {
                    warn!("Error fetching CHRIS contract {}: {:?}", contract_code, e);
                }
            }
        }

        info!("Fetched {} CHRIS futures prices", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for ChrisMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let hour = eastern.hour();

        // Data publishes after market close ~6 PM ET
        // Fetch windows: 6:30 PM, 7:30 PM, 8:30 PM ET
        let fetch_hour = 18;
        let fetch_minute = 30;

        if hour < fetch_hour {
            // Before 6:30 PM: wait
            return today_at_eastern(now, fetch_hour, fetch_minute);
        } else if hour == fetch_hour && eastern.minute() < fetch_minute {
            // At 6 PM but before :30: wait
            return today_at_eastern(now, fetch_hour, fetch_minute);
        } else if hour <= 20 {
            // 6:30 PM - 8:30 PM: fetch now
            return now;
        }

        // After 8:30 PM: wait for next trading day at 6:30 PM
        let next_day = next_us_trading_day(now);
        let next_eastern = next_day.with_timezone(&Eastern);
        let fetch_time = next_eastern
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(fetch_hour, fetch_minute, 0).unwrap());
        Eastern
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_market_closed(now)
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        // No burst mode for daily settlement data
        None
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_contract_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 50, "Expected exactly 50 CHRIS contracts");
    }

    #[test]
    fn test_fetch_assets_filters_active() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(!assets.is_empty());
        for asset in &assets {
            assert_eq!(asset.category, Some("commodities".to_string()));
        }
    }

    #[test]
    fn test_subcategories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let subcats: Vec<&str> = entries.iter().map(|e| e.subcategory.as_str()).collect();
        assert!(subcats.contains(&"energy"));
        assert!(subcats.contains(&"metals"));
        assert!(subcats.contains(&"agriculture"));
    }
}
