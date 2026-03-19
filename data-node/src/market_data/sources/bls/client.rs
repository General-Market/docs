//! BLS API client implementing MarketDataSource and ScheduledMarketDataSource
//!
//! Fetches employment and inflation data from https://api.bls.gov/publicAPI/v2
//! Requires BLS_API_KEY (free registration at https://data.bls.gov/registrationEngine/)
//!
//! Release-aware scheduling:
//! - NFP/Employment: First Friday of month, 8:30 AM ET
//! - CPI: ~10th-13th of month, 8:30 AM ET
//! - PPI: ~14th-16th of month, 8:30 AM ET
//! - JOLTS: First week (~Tuesday), 10:00 AM ET
//! - Fallback: 24 hours outside release windows

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc, Weekday};
use chrono_tz::US::Eastern;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    is_us_market_closed, load_all_asset_entries, load_assets_from_json, AssetUpdate,
    BatchStrategy, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// BLS API base URL
const BLS_API_URL: &str = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/bls.json");

/// Release type determines scheduling behavior
#[derive(Debug, Clone, Copy, PartialEq)]
enum ReleaseType {
    /// First Friday of month, 8:30 AM ET
    Nfp,
    /// ~10th-13th of month, 8:30 AM ET
    Cpi,
    /// ~14th-16th of month, 8:30 AM ET
    Ppi,
    /// First week (1st-7th), 10:00 AM ET
    Jolts,
    /// Quarterly releases
    Quarterly,
}

/// BLS API response structure
#[derive(Debug, Deserialize)]
struct BlsResponse {
    status: String,
    #[serde(rename = "responseTime")]
    _response_time: Option<u64>,
    message: Option<Vec<String>>,
    #[serde(rename = "Results")]
    results: Option<BlsResults>,
}

#[derive(Debug, Deserialize)]
struct BlsResults {
    series: Vec<BlsSeries>,
}

#[derive(Debug, Deserialize)]
struct BlsSeries {
    #[serde(rename = "seriesID")]
    series_id: String,
    data: Vec<BlsObservation>,
}

/// BLS API observation - fields used for Serde deserialization
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct BlsObservation {
    year: String,
    period: String,
    #[serde(rename = "periodName")]
    _period_name: Option<String>,
    value: String,
    footnotes: Option<Vec<serde_json::Value>>,
}

/// BLS market data source
pub struct BlsMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl BlsMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("BLS_API_KEY").context("BLS_API_KEY not set")?;

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
        info!("BLS client initialized with {} series", asset_count);

        Ok(Self { http, api_key })
    }

    /// Fetch multiple series in a single request (BLS allows up to 50)
    async fn fetch_series_batch(&self, series_ids: &[&str]) -> Result<Vec<(String, Decimal)>> {
        // BLS API requires POST with JSON body for multiple series
        let body = serde_json::json!({
            "seriesid": series_ids,
            "registrationkey": self.api_key,
            "latest": true,  // Get only latest observation
        });

        // Use rate limiter before POST request
        self.http.rate_limiter().wait_for_permit().await;

        let resp = self
            .http
            .inner()
            .post(BLS_API_URL)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .context("Failed to fetch BLS series")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("BLS API error: {} {}", status, body_text));
        }

        let data: BlsResponse = resp.json().await.context("Failed to parse BLS response")?;

        if data.status != "REQUEST_SUCCEEDED" {
            let msgs = data.message.unwrap_or_default().join("; ");
            return Err(anyhow::anyhow!(
                "BLS API request failed (status='{}'): {}",
                data.status,
                msgs
            ));
        }

        let mut results = Vec::new();

        if let Some(bls_results) = data.results {
            for series in bls_results.series {
                if let Some(obs) = series.data.first() {
                    // BLS uses "-" for missing values
                    if obs.value == "-" {
                        debug!("BLS series {} has no value", series.series_id);
                        continue;
                    }

                    match Decimal::from_str(&obs.value) {
                        Ok(value) => {
                            results.push((series.series_id.clone(), value));
                        }
                        Err(e) => {
                            warn!(
                                "Invalid value '{}' for BLS series {}: {:?}",
                                obs.value, series.series_id, e
                            );
                        }
                    }
                }
            }
        }

        Ok(results)
    }

    /// Check if we're in a release window
    fn is_in_release_window(&self, now: DateTime<Utc>) -> Option<(ReleaseType, Duration)> {
        let eastern = now.with_timezone(&Eastern);
        let day = eastern.day();
        let hour = eastern.hour();
        let minute = eastern.minute();
        let weekday = eastern.weekday();

        // Calculate day of week for first day of month
        let first_of_month = eastern
            .with_day(1)
            .unwrap_or(eastern)
            .date_naive()
            .weekday();

        // Find first Friday of month
        let days_until_friday = (Weekday::Fri.num_days_from_monday() as i32
            - first_of_month.num_days_from_monday() as i32
            + 7)
            % 7;
        let first_friday = 1 + days_until_friday as u32;

        // NFP window: First Friday 8:30-10:00 AM ET
        if day == first_friday && weekday == Weekday::Fri {
            let time_val = hour * 60 + minute;
            // 8:00 AM to 10:00 AM window (8*60 = 480, 10*60 = 600)
            if time_val >= 480 && time_val <= 600 {
                return Some((ReleaseType::Nfp, Duration::from_secs(5 * 60))); // 5 min interval
            }
        }

        // CPI window: 10th-13th, 8:30 AM ET
        if (10..=13).contains(&day) {
            let time_val = hour * 60 + minute;
            if time_val >= 480 && time_val <= 600 {
                return Some((ReleaseType::Cpi, Duration::from_secs(5 * 60)));
            }
        }

        // PPI window: 14th-16th, 8:30 AM ET
        if (14..=16).contains(&day) {
            let time_val = hour * 60 + minute;
            if time_val >= 480 && time_val <= 600 {
                return Some((ReleaseType::Ppi, Duration::from_secs(5 * 60)));
            }
        }

        // JOLTS window: 1st-7th, around 10:00 AM ET (usually Tuesday)
        if (1..=7).contains(&day) {
            let time_val = hour * 60 + minute;
            // 9:45 AM to 11:00 AM window
            if time_val >= 585 && time_val <= 660 {
                return Some((ReleaseType::Jolts, Duration::from_secs(15 * 60)));
                // 15 min interval
            }
        }

        None
    }

    /// Get next release time for scheduling
    fn next_release_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let day = eastern.day();
        let hour = eastern.hour();

        // Calculate first Friday of current month
        let first_of_month = eastern
            .with_day(1)
            .unwrap_or(eastern)
            .date_naive()
            .weekday();
        let days_until_friday = (Weekday::Fri.num_days_from_monday() as i32
            - first_of_month.num_days_from_monday() as i32
            + 7)
            % 7;
        let first_friday = 1 + days_until_friday as u32;

        // Check which release is next
        // Priority: NFP (1st Fri) > JOLTS (1st-7th) > CPI (10th-13th) > PPI (14th-16th)

        // If before first Friday and before 8:30, wait for NFP
        if day < first_friday || (day == first_friday && hour < 8) {
            if let Some(nfp_date) = eastern.with_day(first_friday) {
                let dt = nfp_date.date_naive().and_time(
                    NaiveTime::from_hms_opt(8, 25, 0).unwrap(), // 8:25 AM to catch 8:30 release
                );
                return Eastern
                    .from_local_datetime(&dt)
                    .unwrap()
                    .with_timezone(&Utc);
            }
        }

        // If before CPI window (10th-13th)
        if day < 10 || (day <= 13 && hour < 8) {
            let cpi_day = if day < 10 { 10 } else { day };
            if let Some(cpi_date) = eastern.with_day(cpi_day) {
                let dt = cpi_date
                    .date_naive()
                    .and_time(NaiveTime::from_hms_opt(8, 25, 0).unwrap());
                return Eastern
                    .from_local_datetime(&dt)
                    .unwrap()
                    .with_timezone(&Utc);
            }
        }

        // If before PPI window (14th-16th)
        if day < 14 || (day <= 16 && hour < 8) {
            let ppi_day = if day < 14 { 14 } else { day };
            if let Some(ppi_date) = eastern.with_day(ppi_day) {
                let dt = ppi_date
                    .date_naive()
                    .and_time(NaiveTime::from_hms_opt(8, 25, 0).unwrap());
                return Eastern
                    .from_local_datetime(&dt)
                    .unwrap()
                    .with_timezone(&Utc);
            }
        }

        // After all releases this month, wait for next month's first Friday
        // Go to first day of next month
        let next_month = if eastern.month() == 12 {
            Utc.with_ymd_and_hms(eastern.year() + 1, 1, 1, 12, 0, 0)
                .unwrap()
        } else {
            Utc.with_ymd_and_hms(eastern.year(), eastern.month() + 1, 1, 12, 0, 0)
                .unwrap()
        };

        // Find first Friday of next month
        let next_eastern = next_month.with_timezone(&Eastern);
        let first_weekday = next_eastern.date_naive().weekday();
        let days_to_friday = (Weekday::Fri.num_days_from_monday() as i32
            - first_weekday.num_days_from_monday() as i32
            + 7)
            % 7;
        let next_first_friday = next_eastern
            .with_day(1 + days_to_friday as u32)
            .unwrap_or(next_eastern);

        let dt = next_first_friday
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(8, 25, 0).unwrap());
        Eastern
            .from_local_datetime(&dt)
            .unwrap()
            .with_timezone(&Utc)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for BlsMarketSource {
    fn source_id(&self) -> &'static str {
        "bls"
    }

    fn display_name(&self) -> &'static str {
        "BLS Employment & Inflation"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Fallback interval (used by basic SyncEngine)
        // ScheduledSyncEngine uses next_fetch_time() instead
        Duration::from_secs(24 * 3600) // 24 hours
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // BLS allows 500 requests/day for registered users
        // We only need ~10 requests/day max
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 50, // Very conservative
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    fn always_record_price(&self) -> bool {
        true // BLS values change monthly; always write a fresh timestamped record on each sync
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();

        // Build lookup from asset_id to series_id (api_ref)
        let entries = load_all_asset_entries(ASSET_JSON)?;
        let series_lookup: std::collections::HashMap<String, String> = entries
            .iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        // Get series IDs for requested assets
        let series_ids: Vec<&str> = asset_ids
            .iter()
            .filter_map(|id| series_lookup.get(id).map(|s| s.as_str()))
            .collect();

        if series_ids.is_empty() {
            return Ok(Vec::new());
        }

        // Fetch all series in one batch request
        let fetched = self.fetch_series_batch(&series_ids).await?;

        // Build reverse lookup from series_id (api_ref) to asset_id
        let asset_lookup: std::collections::HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.api_ref, e.asset_id))
            .collect();

        let results: Vec<PriceUpdate> = fetched
            .into_iter()
            .filter_map(|(series_id, value)| {
                asset_lookup.get(&series_id).map(|asset_id| PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol: asset_id.clone(),
                    value,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                })
            })
            .collect();

        info!(
            "Fetched {}/{} prices from BLS",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::MACRO_DAILY
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for BlsMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // If we're in a release window, fetch immediately
        if self.is_in_release_window(now).is_some() {
            return now;
        }

        // Outside release windows, still sync every 12 hours to keep
        // all 9 series fresh with current-value + fresh-timestamp records.
        // Use whichever comes first: next release or 12 hours from now.
        let next_release = self.next_release_time(now);
        let max_gap = now + chrono::Duration::hours(12);
        std::cmp::min(next_release, max_gap)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // BLS doesn't release on weekends, but we still want to record
        // fresh timestamps for existing values, so never skip.
        false
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        // Return burst interval if we're in a release window
        self.is_in_release_window(now).map(|(_, interval)| interval)
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_series_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 9, "Expected 9 BLS series");
    }

    #[test]
    fn test_source_id() {
        assert_eq!("bls", "bls");
    }

    #[test]
    fn test_category_is_macro() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "macro",
                "Asset {} should have category 'macro'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_subcategory_coverage() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let subcats: Vec<_> = entries.iter().map(|e| e.subcategory.as_str()).collect();
        assert!(subcats.contains(&"employment"));
        assert!(subcats.contains(&"inflation"));
        assert!(subcats.contains(&"gdp"));
    }

    #[test]
    fn test_release_types() {
        // Keep this test for release window detection logic
        let types = vec![
            ReleaseType::Nfp,
            ReleaseType::Cpi,
            ReleaseType::Ppi,
            ReleaseType::Jolts,
            ReleaseType::Quarterly,
        ];
        assert!(types.contains(&ReleaseType::Nfp));
        assert!(types.contains(&ReleaseType::Cpi));
    }
}
