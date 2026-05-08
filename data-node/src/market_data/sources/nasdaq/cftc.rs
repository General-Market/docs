//! CFTC Commitment of Traders (COT) data source
//!
//! Fetches positioning data from CFTC via Nasdaq Data Link.
//! Data published every Friday at 3:30 PM ET.
//!
//! Provides 40 assets: 20 markets × 2 metrics (net speculative, net commercial)

use anyhow::Result;
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc, Weekday};
use chrono_tz::US::Eastern;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use super::client::NasdaqClient;
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, today_at_eastern, AssetUpdate,
    BatchStrategy, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/cftc.json");

/// Nasdaq dataset response structure for CFTC
#[derive(Debug, Deserialize)]
struct NasdaqDatasetResponse {
    dataset: NasdaqDataset,
}

#[derive(Debug, Deserialize)]
struct NasdaqDataset {
    column_names: Vec<String>,
    data: Vec<Vec<serde_json::Value>>,
}

/// CFTC market data source
pub struct CftcMarketSource {
    client: NasdaqClient,
}

impl CftcMarketSource {
    /// Create from environment variable
    pub fn from_env() -> Result<Self> {
        let client = NasdaqClient::from_env()?;
        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("CFTC client initialized with {} assets", asset_count);
        Ok(Self { client })
    }

    /// Extract unique market codes from the JSON entries.
    /// api_ref format: "CODE:position_type"
    fn market_codes() -> Vec<String> {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let mut codes: Vec<String> = entries
            .iter()
            .filter_map(|e| e.api_ref.split(':').next().map(|s| s.to_string()))
            .collect();
        codes.sort();
        codes.dedup();
        codes
    }

    /// Fetch CFTC data for a market code
    async fn fetch_market(&self, market_code: &str) -> Result<Option<CftcPositions>> {
        // CFTC datasets are in format: CFTC/{CODE}_F_ALL (Futures and Options Combined)
        let dataset_code = format!("CFTC/{}_F_ALL", market_code);

        let resp: NasdaqDatasetResponse = match self.client.fetch_dataset(&dataset_code, 1).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to fetch CFTC data for {}: {:?}", market_code, e);
                return Ok(None);
            }
        };

        if resp.dataset.data.is_empty() {
            debug!("No CFTC data for {}", market_code);
            return Ok(None);
        }

        let row = &resp.dataset.data[0];
        let columns = &resp.dataset.column_names;

        // Extract positions by finding column indices
        let get_value = |name: &str| -> Option<i64> {
            columns
                .iter()
                .position(|c| c.contains(name))
                .and_then(|i| row.get(i))
                .and_then(|v| v.as_f64())
                .map(|v| v as i64)
        };

        // Legacy report fields
        let commercial_long = get_value("Commercial Long");
        let commercial_short = get_value("Commercial Short");
        let noncommercial_long = get_value("Noncommercial Long");
        let noncommercial_short = get_value("Noncommercial Short");

        // Calculate net positions
        let net_commercial = match (commercial_long, commercial_short) {
            (Some(l), Some(s)) => Some(l - s),
            _ => None,
        };

        let net_noncommercial = match (noncommercial_long, noncommercial_short) {
            (Some(l), Some(s)) => Some(l - s),
            _ => None,
        };

        // Date from first column
        let report_date = row
            .first()
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        Ok(Some(CftcPositions {
            report_date,
            net_commercial,
            net_noncommercial,
        }))
    }
}

/// Extracted CFTC positions
struct CftcPositions {
    #[allow(dead_code)]
    report_date: String,
    net_commercial: Option<i64>,
    net_noncommercial: Option<i64>,
}

#[async_trait::async_trait]
impl MarketDataSource for CftcMarketSource {
    fn source_id(&self) -> &'static str {
        "cftc"
    }

    fn display_name(&self) -> &'static str {
        "CFTC Commitment of Traders"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Default: once per day (ScheduledSyncEngine uses next_fetch_time)
        Duration::from_secs(86400)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![
                RateWindow {
                    max_requests: 250, // Conservative: 300/10sec
                    duration: Duration::from_secs(10),
                },
                RateWindow {
                    max_requests: 40000, // Conservative: 50k/day
                    duration: Duration::from_secs(86400),
                },
            ],
        }
    }

    fn always_record_price(&self) -> bool {
        // CFTC publishes once a week, on Friday. Six identical days a week
        // bloat the table without informing anything. The sync engine's
        // change-detection writes a new row only when a fresh report ships.
        false
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();
        let market_codes = Self::market_codes();

        for code in &market_codes {
            // Small delay between requests
            tokio::time::sleep(Duration::from_millis(100)).await;

            match self.fetch_market(code).await {
                Ok(Some(positions)) => {
                    // Add net speculative position
                    if let Some(net_spec) = positions.net_noncommercial {
                        let asset_id = format!("cftc_{}_net_spec", code.to_lowercase());
                        if let Ok(value) = Decimal::from_str(&net_spec.to_string()) {
                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: asset_id,
                                value,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }

                    // Add net commercial position
                    if let Some(net_comm) = positions.net_commercial {
                        let asset_id = format!("cftc_{}_net_comm", code.to_lowercase());
                        if let Ok(value) = Decimal::from_str(&net_comm.to_string()) {
                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: asset_id,
                                value,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Ok(None) => {
                    debug!("No CFTC data for {}", code);
                }
                Err(e) => {
                    warn!("Error fetching CFTC data for {}: {:?}", code, e);
                }
            }
        }

        info!("Fetched {} CFTC positions", results.len());
        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::MACRO_DAILY
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for CftcMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let weekday = eastern.weekday();
        let hour = eastern.hour();

        // CFTC publishes Friday at 3:30 PM ET
        if weekday == Weekday::Fri {
            if hour < 16 {
                // Before 4 PM Friday: fetch at 3:35 PM (5 min buffer)
                return today_at_eastern(now, 15, 35);
            } else if hour < 18 {
                // 4-6 PM Friday: fetch now (burst mode)
                return now;
            }
        }

        // Not Friday or after 6 PM: wait for next Friday at 3:35 PM
        let days_until_friday = match weekday {
            Weekday::Fri => 7, // Next Friday
            Weekday::Sat => 6,
            Weekday::Sun => 5,
            Weekday::Mon => 4,
            Weekday::Tue => 3,
            Weekday::Wed => 2,
            Weekday::Thu => 1,
        };

        let next_friday = eastern.date_naive() + chrono::Duration::days(days_until_friday);
        let fetch_time = next_friday.and_time(NaiveTime::from_hms_opt(15, 35, 0).unwrap());
        Eastern
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        // Only fetch on Fridays
        let eastern = now.with_timezone(&Eastern);
        eastern.weekday() != Weekday::Fri
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        let eastern = now.with_timezone(&Eastern);

        // Burst mode on Friday 3:30-5:30 PM ET
        if eastern.weekday() == Weekday::Fri {
            let hour = eastern.hour();
            if hour >= 15 && hour < 18 {
                return Some(Duration::from_secs(15 * 60)); // 15 minutes
            }
        }

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
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 42, "Expected 42 CFTC assets (21 markets × 2)");
    }

    #[test]
    fn test_fetch_assets_filters_active() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(!assets.is_empty());
        // All active entries should have regulatory category
        for asset in &assets {
            assert_eq!(asset.category, Some("regulatory".to_string()));
        }
    }

    #[test]
    fn test_market_codes_extraction() {
        let codes = CftcMarketSource::market_codes();
        assert!(codes.len() >= 20, "Expected at least 20 unique market codes");
        // Verify deduplication worked
        let mut sorted = codes.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(codes.len(), sorted.len());
    }

    #[test]
    fn test_api_ref_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.api_ref.contains(':'),
                "api_ref '{}' should contain ':' separator",
                entry.api_ref
            );
        }
    }
}
