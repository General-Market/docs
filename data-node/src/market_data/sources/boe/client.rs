//! Bank of England exchange rate client implementing MarketDataSource and ScheduledMarketDataSource
//!
//! Fetches daily spot exchange rates from https://www.bankofengland.co.uk
//! Rates are observed by the BoE FX desk "around 4pm" London time using
//! multiple sources including Bloomberg BFIX and LSEG (WM/Reuters).
//! Published by 9:30am next business day, 1-2 day lag.
//! No API key required. CSV format.

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::Europe::London;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    is_eu_weekend, load_all_asset_entries, load_assets_from_json, next_eu_trading_day,
    AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};

/// BoE statistical database base URL
const BOE_BASE_URL: &str =
    "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp";

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/boe.json");

/// Bank of England exchange rate source
pub struct BoeMarketSource {
    http: SourceHttpClient,
}

impl BoeMarketSource {
    pub fn from_env() -> Result<Self> {
        // BoE has no documented rate limits, but be conservative
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("BoE client initialized with {} currency pairs", asset_count);

        Ok(Self { http })
    }

    /// Fetch all rates in a single CSV request.
    /// Returns a map of series_code -> latest value.
    async fn fetch_all_rates(&self) -> Result<HashMap<String, Decimal>> {
        let entries = load_all_asset_entries(ASSET_JSON)?;

        // Build comma-separated series codes
        let series_codes: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        let codes_param = series_codes.join(",");

        // Request last 10 days to handle weekends/holidays
        let from_date = {
            let now = Utc::now();
            let ten_days_ago = now - chrono::Duration::days(10);
            let london = ten_days_ago.with_timezone(&London);
            format!(
                "{:02}/{}/{:04}",
                london.day(),
                month_abbrev(london.month()),
                london.year()
            )
        };

        let url = format!(
            "{}?csv.x=yes&Datefrom={}&Dateto=now&SeriesCodes={}&CSVF=TT&UsingCodes=Y",
            BOE_BASE_URL, from_date, codes_param
        );

        // Raw GET — BoE returns CSV, not JSON
        self.http.rate_limiter().wait_for_permit().await;
        let response = self
            .http
            .inner()
            .get(&url)
            .send()
            .await
            .context("Failed to fetch BoE CSV")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("BoE API error: {} {}", status, &body[..body.len().min(200)]);
        }

        let body = response.text().await.context("Failed to read BoE response")?;
        self.parse_csv(&body, &series_codes)
    }

    /// Parse BoE CSV response.
    /// The response has a metadata block first (SERIES,DESCRIPTION rows),
    /// then a blank line, then the data:
    ///   SERIES,DESCRIPTION
    ///   XUDLUSS,Spot exchange rate - US $ into Sterling
    ///   ...
    ///
    ///   DATE,XUDLUSS,XUDLERS,...
    ///   10 Mar 2026, 1.2345, 0.8765,...
    ///
    /// Takes the most recent row (last non-empty row).
    fn parse_csv(
        &self,
        body: &str,
        expected_codes: &[&str],
    ) -> Result<HashMap<String, Decimal>> {
        let mut results = HashMap::new();
        let lines: Vec<&str> = body.lines().collect();

        // Find the data header line (starts with "DATE")
        let header_idx = lines
            .iter()
            .position(|line| {
                let trimmed = line.trim();
                trimmed.starts_with("DATE,") || trimmed == "DATE"
            })
            .unwrap_or(0); // Fall back to first line if no DATE header found

        if lines.len() <= header_idx + 1 {
            anyhow::bail!("BoE CSV has no data rows after header (line {})", header_idx);
        }

        // Parse header row to find column indices
        let headers: Vec<&str> = lines[header_idx].split(',').map(|s| s.trim()).collect();

        // Build column index -> series code mapping (skip column 0 = DATE)
        let mut col_to_code: HashMap<usize, &str> = HashMap::new();
        for (i, header) in headers.iter().enumerate().skip(1) {
            if expected_codes.contains(header) {
                col_to_code.insert(i, header);
            }
        }

        if col_to_code.is_empty() {
            anyhow::bail!(
                "No matching series codes found in BoE CSV headers: {:?}",
                &headers[..headers.len().min(10)]
            );
        }

        // Find the most recent data row (last non-empty row with actual values)
        for line in lines[header_idx + 1..].iter().rev() {
            let cols: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
            if cols.len() < 2 || cols[0].is_empty() {
                continue;
            }

            let mut found_any = false;
            for (&col_idx, &code) in &col_to_code {
                if col_idx >= cols.len() {
                    continue;
                }
                let val_str = cols[col_idx].trim();
                // BoE uses empty string or ".." for missing values
                if val_str.is_empty() || val_str == ".." {
                    continue;
                }
                match Decimal::from_str(val_str) {
                    Ok(value) => {
                        results.insert(code.to_string(), value);
                        found_any = true;
                    }
                    Err(e) => {
                        debug!("Could not parse BoE value '{}' for {}: {}", val_str, code, e);
                    }
                }
            }

            if found_any {
                debug!(
                    "Using BoE data from row date={}, got {} values",
                    cols[0],
                    results.len()
                );
                break;
            }
        }

        Ok(results)
    }
}

/// Convert month number to BoE date format abbreviation
fn month_abbrev(month: u32) -> &'static str {
    match month {
        1 => "Jan",
        2 => "Feb",
        3 => "Mar",
        4 => "Apr",
        5 => "May",
        6 => "Jun",
        7 => "Jul",
        8 => "Aug",
        9 => "Sep",
        10 => "Oct",
        11 => "Nov",
        12 => "Dec",
        _ => "Jan",
    }
}

/// Create a datetime for today at a specific hour:minute in London time.
fn today_at_london(now: DateTime<Utc>, hour: u32, minute: u32) -> DateTime<Utc> {
    let london = now.with_timezone(&London);
    let date = london.date_naive();
    let time = NaiveTime::from_hms_opt(hour, minute, 0).unwrap();
    let dt = date.and_time(time);
    London
        .from_local_datetime(&dt)
        .unwrap()
        .with_timezone(&Utc)
}

#[async_trait::async_trait]
impl MarketDataSource for BoeMarketSource {
    fn source_id(&self) -> &'static str {
        "boe"
    }

    fn display_name(&self) -> &'static str {
        "Bank of England Exchange Rates"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600) // Fallback; ScheduledSyncEngine uses next_fetch_time()
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        }
    }

    fn always_record_price(&self) -> bool {
        // Daily data — always write fresh timestamps to prove liveness
        true
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();

        // Build lookup: asset_id -> series_code (api_ref)
        let entries = load_all_asset_entries(ASSET_JSON)?;
        let series_lookup: HashMap<String, String> = entries
            .iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();
        // One CSV request returns all rates
        let rates = self.fetch_all_rates().await?;

        let mut results = Vec::new();
        for asset_id in asset_ids {
            if let Some(series_code) = series_lookup.get(asset_id) {
                if let Some(value) = rates.get(series_code) {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: asset_id.clone(),
                        value: *value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                } else {
                    debug!("No BoE data for {} (series {})", asset_id, series_code);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from Bank of England",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for BoeMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let london = now.with_timezone(&London);
        let hour = london.hour();

        // BoE publishes rates by 9:30am London, 1-2 business days after observation.
        // Fetch at 9:45am and again at 12:00 (safety net).
        let primary_hour = 9;
        let primary_min = 45;
        let secondary_hour = 12;

        if hour < primary_hour || (hour == primary_hour && london.minute() < primary_min as u32) {
            return today_at_london(now, primary_hour, primary_min);
        } else if hour < secondary_hour {
            return today_at_london(now, secondary_hour as u32, 0);
        }

        // After noon: wait for next trading day at 9:45am
        let next_day = next_eu_trading_day(now);
        let next_london = next_day.with_timezone(&London);
        let fetch_time = next_london
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(primary_hour, primary_min as u32, 0).unwrap());
        London
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_eu_weekend(now)
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        // No burst events — BoE publishes once daily, no intraday surprises
        None
    }

    fn timezone(&self) -> &'static str {
        "Europe/London"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 29, "Expected 29 BoE series (27 FX + 2 rates)");
    }

    #[test]
    fn test_all_fx_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(entry.category, "macro", "Asset {} should be macro", entry.asset_id);
        }
    }

    #[test]
    fn test_series_codes_valid() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.api_ref.starts_with("XUDL") || entry.api_ref.starts_with("IUD"),
                "BoE series code should start with XUDL or IUD: {}",
                entry.api_ref
            );
        }
    }

    #[test]
    fn test_asset_id_prefix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("boe_"),
                "Asset ID should start with boe_: {}",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_csv_parsing() {
        let source = BoeMarketSource {
            http: SourceHttpClient::new(
                RateLimitConfig {
                    windows: vec![RateWindow {
                        max_requests: 10,
                        duration: Duration::from_secs(60),
                    }],
                },
                RetryConfig::default(),
            ),
        };

        // Real BoE format: metadata block, then blank line, then data
        let csv = "SERIES,DESCRIPTION\n\
                   XUDLUSS,Spot exchange rate - US $ into Sterling\n\
                   XUDLERS,Spot exchange rate - Euro into Sterling\n\
                   \n\
                   DATE,XUDLUSS,XUDLERS\n\
                   14 Mar 2026, 1.2340, 0.8760\n\
                   17 Mar 2026, 1.2345, 0.8765\n";

        let codes = vec!["XUDLUSS", "XUDLERS"];
        let result = source.parse_csv(csv, &codes).unwrap();

        assert_eq!(result.len(), 2);
        assert_eq!(
            result.get("XUDLUSS"),
            Some(&Decimal::from_str("1.2345").unwrap())
        );
        assert_eq!(
            result.get("XUDLERS"),
            Some(&Decimal::from_str("0.8765").unwrap())
        );
    }

    #[test]
    fn test_csv_missing_values() {
        let source = BoeMarketSource {
            http: SourceHttpClient::new(
                RateLimitConfig {
                    windows: vec![RateWindow {
                        max_requests: 10,
                        duration: Duration::from_secs(60),
                    }],
                },
                RetryConfig::default(),
            ),
        };

        // Real format with metadata block; most recent row has missing XUDLERS
        let csv = "SERIES,DESCRIPTION\n\
                   XUDLUSS,Spot exchange rate\n\
                   XUDLERS,Spot exchange rate\n\
                   \n\
                   DATE,XUDLUSS,XUDLERS\n\
                   14 Mar 2026, 1.2340, 0.8760\n\
                   17 Mar 2026, 1.2345, ..\n";

        let codes = vec!["XUDLUSS", "XUDLERS"];
        let result = source.parse_csv(csv, &codes).unwrap();

        assert!(result.contains_key("XUDLUSS"));
        // XUDLERS is ".." so it should still be in results from the same row
        // since we found at least one value
        assert!(!result.contains_key("XUDLERS"));
    }

    #[test]
    fn test_month_abbrev() {
        assert_eq!(month_abbrev(1), "Jan");
        assert_eq!(month_abbrev(6), "Jun");
        assert_eq!(month_abbrev(12), "Dec");
    }
}
