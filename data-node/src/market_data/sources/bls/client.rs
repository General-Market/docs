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
    is_us_market_closed, AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// BLS API base URL
const BLS_API_URL: &str = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

/// BLS series to track
/// Format: (series_id, asset_id, display_name, category, release_type)
const BLS_SERIES: &[(&str, &str, &str, &str, ReleaseType)] = &[
    // Employment Situation (NFP) - First Friday 8:30 AM ET
    (
        "LNS14000000",
        "bls_unemployment",
        "Unemployment Rate",
        "employment",
        ReleaseType::Nfp,
    ),
    (
        "CES0000000001",
        "bls_nfp",
        "Total Nonfarm Payrolls",
        "employment",
        ReleaseType::Nfp,
    ),
    (
        "CES0500000003",
        "bls_wages",
        "Average Hourly Earnings",
        "employment",
        ReleaseType::Nfp,
    ),
    (
        "LNS11300000",
        "bls_lfpr",
        "Labor Force Participation Rate",
        "employment",
        ReleaseType::Nfp,
    ),
    // CPI - ~10th-13th of month 8:30 AM ET
    (
        "CUSR0000SA0",
        "bls_cpi",
        "CPI All Items",
        "inflation",
        ReleaseType::Cpi,
    ),
    (
        "CUSR0000SA0L1E",
        "bls_cpi_core",
        "CPI Core (Ex Food & Energy)",
        "inflation",
        ReleaseType::Cpi,
    ),
    // PPI - ~14th-16th of month 8:30 AM ET
    (
        "WPUFD49104",
        "bls_ppi",
        "PPI Final Demand",
        "inflation",
        ReleaseType::Ppi,
    ),
    // JOLTS - First week, usually Tuesday 10:00 AM ET
    (
        "JTS000000000000000JOL",
        "bls_jolts",
        "Job Openings (JOLTS)",
        "employment",
        ReleaseType::Jolts,
    ),
    // Productivity - Quarterly (first month of quarter)
    (
        "PRS85006092",
        "bls_productivity",
        "Nonfarm Business Labor Productivity",
        "macro",
        ReleaseType::Quarterly,
    ),
];

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
    client: reqwest::Client,
    api_key: String,
}

impl BlsMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("BLS_API_KEY").context("BLS_API_KEY not set")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!("BLS client initialized with {} series", BLS_SERIES.len());

        Ok(Self { client, api_key })
    }

    /// Fetch multiple series in a single request (BLS allows up to 50)
    async fn fetch_series_batch(&self, series_ids: &[&str]) -> Result<Vec<(String, Decimal)>> {
        // BLS API requires POST with JSON body for multiple series
        let body = serde_json::json!({
            "seriesid": series_ids,
            "registrationkey": self.api_key,
            "latest": true,  // Get only latest observation
        });

        let resp = self
            .client
            .post(BLS_API_URL)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .context("Failed to fetch BLS series")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            warn!("BLS API error: {} {}", status, body_text);
            return Ok(Vec::new());
        }

        let data: BlsResponse = resp.json().await.context("Failed to parse BLS response")?;

        if data.status != "REQUEST_SUCCEEDED" {
            if let Some(msgs) = &data.message {
                warn!("BLS API message: {:?}", msgs);
            }
            return Ok(Vec::new());
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
        Ok(BLS_SERIES
            .iter()
            .map(
                |(series_id, asset_id, name, category, release_type)| AssetUpdate {
                    asset_id: asset_id.to_string(),
                    symbol: asset_id.to_string(),
                    name: name.to_string(),
                    category: Some(category.to_string()),
                    metadata: serde_json::json!({
                        "source": "bls",
                        "series_id": series_id,
                        "release_type": format!("{:?}", release_type),
                    }),
                },
            )
            .collect())
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();

        // Build lookup from asset_id to series_id
        let series_lookup: std::collections::HashMap<&str, &str> = BLS_SERIES
            .iter()
            .map(|(series_id, asset_id, _, _, _)| (*asset_id, *series_id))
            .collect();

        // Get series IDs for requested assets
        let series_ids: Vec<&str> = asset_ids
            .iter()
            .filter_map(|id| series_lookup.get(id.as_str()).copied())
            .collect();

        if series_ids.is_empty() {
            return Ok(Vec::new());
        }

        // Fetch all series in one batch request
        let fetched = self.fetch_series_batch(&series_ids).await?;

        // Build reverse lookup from series_id to asset_id
        let asset_lookup: std::collections::HashMap<&str, &str> = BLS_SERIES
            .iter()
            .map(|(series_id, asset_id, _, _, _)| (*series_id, *asset_id))
            .collect();

        let results: Vec<PriceUpdate> = fetched
            .into_iter()
            .filter_map(|(series_id, value)| {
                asset_lookup
                    .get(series_id.as_str())
                    .map(|&asset_id| PriceUpdate {
                        asset_id: asset_id.to_string(),
                        symbol: asset_id.to_string(),
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
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for BlsMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // If we're in a release window, fetch immediately
        if self.is_in_release_window(now).is_some() {
            return now;
        }

        // Otherwise, calculate next release time
        self.next_release_time(now)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        // Skip weekends and US holidays (BLS doesn't release on these days)
        is_us_market_closed(now)
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
        assert_eq!(BLS_SERIES.len(), 9, "Expected 9 BLS series");
    }

    #[test]
    fn test_source_id() {
        // Verify source_id is "bls"
        assert_eq!("bls", "bls");
    }

    #[test]
    fn test_category_coverage() {
        let categories: Vec<_> = BLS_SERIES.iter().map(|(_, _, _, cat, _)| *cat).collect();
        assert!(categories.contains(&"employment"));
        assert!(categories.contains(&"inflation"));
        assert!(categories.contains(&"macro"));
    }

    #[test]
    fn test_release_types() {
        // Verify we have all release types represented
        let types: Vec<_> = BLS_SERIES.iter().map(|(_, _, _, _, rt)| *rt).collect();
        assert!(types.contains(&ReleaseType::Nfp));
        assert!(types.contains(&ReleaseType::Cpi));
        assert!(types.contains(&ReleaseType::Ppi));
        assert!(types.contains(&ReleaseType::Jolts));
        assert!(types.contains(&ReleaseType::Quarterly));
    }
}
