//! EIA API client implementing MarketDataSource and ScheduledMarketDataSource
//!
//! Fetches energy data from https://api.eia.gov/v2/
//! Focus on petroleum inventories, production, and natural gas storage.

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc, Weekday};
use chrono_tz::US::Eastern;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, today_at_eastern, AssetUpdate,
    BatchStrategy, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// EIA API base URL
const EIA_API_URL: &str = "https://api.eia.gov/v2/petroleum/sum/sndw/data/";

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/eia.json");

/// EIA API response structure
#[derive(Debug, Deserialize)]
struct EiaResponse {
    response: EiaResponseData,
}

#[derive(Debug, Deserialize)]
struct EiaResponseData {
    data: Vec<EiaDataPoint>,
}

#[derive(Debug, Deserialize)]
struct EiaDataPoint {
    period: String,
    /// EIA v2 API returns value as a JSON string (e.g. "419815"), not a number
    value: Option<String>,
    #[serde(rename = "series-description")]
    #[allow(dead_code)]
    series_description: Option<String>,
}

/// EIA market data source
pub struct EiaMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl EiaMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("EIA_API_KEY").context("EIA_API_KEY not set")?;

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
        info!("EIA client initialized with {} series", asset_count);

        Ok(Self { http, api_key })
    }

    /// Fetch a petroleum series
    async fn fetch_petroleum_series(&self, series_id: &str) -> Result<Option<(String, f64)>> {
        let url = format!(
            "{}?api_key={}&frequency=weekly&data[0]=value&facets[series][]={}&sort[0][column]=period&sort[0][direction]=desc&length=1",
            EIA_API_URL, self.api_key, series_id
        );

        let data: EiaResponse = match self.http.get_json(&url).await {
            Ok(d) => d,
            Err(e) => {
                warn!("EIA API error for {}: {}", series_id, e);
                return Ok(None);
            }
        };

        if let Some(point) = data.response.data.first() {
            if let Some(ref value_str) = point.value {
                if let Ok(value) = value_str.parse::<f64>() {
                    return Ok(Some((point.period.clone(), value)));
                }
            }
        }

        Ok(None)
    }

    /// Fetch natural gas storage (different API endpoint)
    async fn fetch_natgas_storage(&self) -> Result<Option<(String, f64)>> {
        // Natural gas storage endpoint
        let url = format!(
            "https://api.eia.gov/v2/natural-gas/stor/wkly/data/?api_key={}&frequency=weekly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=1",
            self.api_key
        );

        let data: EiaResponse = match self.http.get_json(&url).await {
            Ok(d) => d,
            Err(e) => {
                warn!("EIA API error for natural gas: {}", e);
                return Ok(None);
            }
        };

        if let Some(point) = data.response.data.first() {
            if let Some(ref value_str) = point.value {
                if let Ok(value) = value_str.parse::<f64>() {
                    return Ok(Some((point.period.clone(), value)));
                }
            }
        }

        Ok(None)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for EiaMarketSource {
    fn source_id(&self) -> &'static str {
        "eia"
    }

    fn display_name(&self) -> &'static str {
        "EIA Energy Data"
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
            windows: vec![RateWindow {
                max_requests: 50, // Conservative: EIA is unlimited but be nice
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        // Build lookup from JSON config
        let entries = load_all_asset_entries(ASSET_JSON)?;

        for entry in &entries {
            // Natural gas storage uses different endpoint
            if entry.asset_id == "eia_natgas_storage" {
                match self.fetch_natgas_storage().await {
                    Ok(Some((_period, value))) => {
                        if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                            results.push(PriceUpdate {
                                asset_id: entry.asset_id.clone(),
                                symbol: entry.symbol.clone(),
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
                        debug!("No EIA natural gas storage data");
                    }
                    Err(e) => {
                        warn!("Error fetching EIA natural gas storage: {:?}", e);
                    }
                }
                continue;
            }

            // Petroleum series
            match self.fetch_petroleum_series(&entry.api_ref).await {
                Ok(Some((_period, value))) => {
                    if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: entry.asset_id.clone(),
                            symbol: entry.symbol.clone(),
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
                    debug!("No EIA data for {}", entry.api_ref);
                }
                Err(e) => {
                    warn!("Error fetching EIA series {}: {:?}", entry.api_ref, e);
                }
            }
        }

        info!("Fetched {} EIA energy series", results.len());
        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::MACRO_DAILY
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for EiaMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let weekday = eastern.weekday();
        let hour = eastern.hour();

        // Wednesday 10:30 AM ET - Petroleum Status Report
        if weekday == Weekday::Wed && hour < 11 {
            return today_at_eastern(now, 10, 25);
        }

        // Thursday 10:30 AM ET - Natural Gas Storage
        if weekday == Weekday::Thu && hour < 11 {
            return today_at_eastern(now, 10, 25);
        }

        // If we're on Wed or Thu after the release, fetch now
        if weekday == Weekday::Wed && hour >= 10 && hour < 14 {
            return now;
        }
        if weekday == Weekday::Thu && hour >= 10 && hour < 14 {
            return now;
        }

        // Wait for next release day
        self.next_eia_release(now)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        let eastern = now.with_timezone(&Eastern);
        // Only fetch on Wed/Thu (release days)
        !matches!(eastern.weekday(), Weekday::Wed | Weekday::Thu)
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        let eastern = now.with_timezone(&Eastern);
        let weekday = eastern.weekday();
        let hour = eastern.hour();

        // Burst mode Wed/Thu 10:30-11:30 AM ET
        if matches!(weekday, Weekday::Wed | Weekday::Thu) && hour >= 10 && hour < 12 {
            return Some(Duration::from_secs(15 * 60)); // 15 minutes
        }

        None
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

impl EiaMarketSource {
    /// Calculate next EIA release time
    fn next_eia_release(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let eastern = now.with_timezone(&Eastern);
        let mut date = eastern.date_naive();
        let weekday = date.weekday();

        // Find next Wednesday or Thursday
        let days_to_add = match weekday {
            Weekday::Wed => {
                if eastern.hour() >= 14 {
                    1 // Next day (Thursday)
                } else {
                    0
                }
            }
            Weekday::Thu => {
                if eastern.hour() >= 14 {
                    6 // Next Wednesday
                } else {
                    0
                }
            }
            Weekday::Fri => 5, // Next Wednesday
            Weekday::Sat => 4,
            Weekday::Sun => 3,
            Weekday::Mon => 2,
            Weekday::Tue => 1,
        };

        date = date + chrono::Duration::days(days_to_add);

        let fetch_time = date.and_time(NaiveTime::from_hms_opt(10, 25, 0).unwrap());
        Eastern
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_series_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.len() >= 9, "Expected at least 9 EIA series");
    }

    #[test]
    fn test_energy_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.category == "commodities"));
        assert!(entries.iter().all(|e| e.subcategory == "energy"));
    }

    #[test]
    fn test_natgas_storage_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().any(|e| e.asset_id == "eia_natgas_storage"));
    }
}
