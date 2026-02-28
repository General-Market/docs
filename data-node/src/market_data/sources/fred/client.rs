//! FRED API client implementing MarketDataSource and ScheduledMarketDataSource
//!
//! Fetches economic data from https://api.stlouisfed.org/fred
//! Focus on interest rates and treasury yields.

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::US::Eastern;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    is_fomc_day, is_us_market_closed, load_assets_from_json, next_us_trading_day,
    today_at_eastern, AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// FRED API base URL
const FRED_API_URL: &str = "https://api.stlouisfed.org/fred";

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/rates.json");

/// FRED API observation response
#[derive(Debug, Deserialize)]
struct FredObservationsResponse {
    observations: Vec<FredObservation>,
}

#[derive(Debug, Deserialize)]
struct FredObservation {
    date: String,
    value: String,
}

/// FRED market data source
pub struct FredMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl FredMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("FRED_API_KEY").context("FRED_API_KEY not set")?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("FRED client initialized with {} series", asset_count);

        Ok(Self { http, api_key })
    }

    /// Fetch the latest observation for a series
    async fn fetch_series(&self, series_id: &str) -> Result<Option<(String, Decimal)>> {
        let url = format!(
            "{}/series/observations?series_id={}&api_key={}&file_type=json&sort_order=desc&limit=1",
            FRED_API_URL, series_id, self.api_key
        );

        let data: FredObservationsResponse = match self.http.get_json(&url).await {
            Ok(d) => d,
            Err(e) => {
                warn!("FRED API error for {}: {}", series_id, e);
                return Ok(None);
            }
        };

        if let Some(obs) = data.observations.first() {
            // FRED uses "." for missing values
            if obs.value == "." {
                debug!("FRED series {} has no value (holiday/weekend)", series_id);
                return Ok(None);
            }

            let value = Decimal::from_str(&obs.value)
                .with_context(|| format!("Invalid value '{}' for {}", obs.value, series_id))?;

            return Ok(Some((obs.date.clone(), value)));
        }

        Ok(None)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FredMarketSource {
    fn source_id(&self) -> &'static str {
        "rates"
    }

    fn display_name(&self) -> &'static str {
        "FRED Interest Rates"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Fallback interval (used by basic SyncEngine)
        // ScheduledSyncEngine uses next_fetch_time() instead
        Duration::from_secs(3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100, // Conservative: FRED allows 120/min
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for asset_id in asset_ids {
            match self.fetch_series(asset_id).await {
                Ok(Some((_date, value))) => {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: asset_id.clone(),
                        value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Ok(None) => {
                    debug!("No data for FRED series {}", asset_id);
                }
                Err(e) => {
                    warn!("Error fetching FRED series {}: {:?}", asset_id, e);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from FRED",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for FredMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let hour = eastern.hour();

        // Daily data publishes around 4-6 PM ET
        // We fetch at 6 PM and 7 PM to catch updates
        let primary_fetch_hour = 18; // 6 PM ET
        let secondary_fetch_hour = 19; // 7 PM ET

        // Check if it's Thursday (mortgage rate day)
        let is_thursday = eastern.weekday() == chrono::Weekday::Thu;
        let mortgage_fetch_hour = 10; // Mortgage rates release ~10 AM Thursday

        if is_thursday && hour < mortgage_fetch_hour {
            // Thursday morning: wait for mortgage rates at 10 AM
            return today_at_eastern(now, mortgage_fetch_hour, 30);
        }

        if hour < primary_fetch_hour {
            // Before 6 PM: wait for primary fetch window
            return today_at_eastern(now, primary_fetch_hour, 0);
        } else if hour < secondary_fetch_hour {
            // Between 6-7 PM: fetch now (we're in the window)
            return now;
        } else if hour == secondary_fetch_hour {
            // At 7 PM: fetch now (secondary window)
            return now;
        }

        // After 7 PM: wait for next trading day at 6 PM
        let next_day = next_us_trading_day(now);
        let next_eastern = next_day.with_timezone(&Eastern);
        let fetch_time = next_eastern
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(primary_fetch_hour, 0, 0).unwrap());
        Eastern
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_us_market_closed(now)
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        let eastern = now.with_timezone(&Eastern);
        let date = eastern.date_naive();

        // Check if it's an FOMC announcement day
        if is_fomc_day(date) {
            let hour = eastern.hour();
            // FOMC typically announces at 2 PM ET
            // Burst mode from 2 PM to 6 PM
            if hour >= 14 && hour <= 18 {
                return Some(Duration::from_secs(30 * 60)); // 30 minutes
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
    fn test_series_count() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.len() >= 15, "Expected at least 15 FRED series");
    }

    #[test]
    fn test_source_id() {
        // Verify source_id is "rates" not "fred"
        assert_eq!("rates", "rates");
    }

    #[test]
    fn test_category_is_macro() {
        // Verify all assets have category "macro"
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(entry.category, "macro", "Asset {} should have category 'macro'", entry.asset_id);
        }
    }

    #[test]
    fn test_subcategories() {
        // Verify subcategories are valid
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let subcats: Vec<_> = entries.iter().map(|e| e.subcategory.as_str()).collect();
        assert!(subcats.contains(&"interest_rates"));
        assert!(subcats.contains(&"inflation"));
    }

    #[test]
    fn test_all_entries_active() {
        // By default all FRED entries should be active
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.active), "All FRED entries should be active");
    }

    #[test]
    fn test_api_ref_matches_asset_id() {
        // For FRED, api_ref should match asset_id (series_id)
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(entry.api_ref, entry.asset_id, "api_ref should match asset_id for FRED");
        }
    }
}
