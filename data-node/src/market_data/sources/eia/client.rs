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
    today_at_eastern, AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// EIA API base URL
const EIA_API_URL: &str = "https://api.eia.gov/v2/petroleum/sum/sndw/data/";

/// EIA series definitions
/// (series_id, asset_id, name, category, unit, release_day)
const EIA_SERIES: &[(&str, &str, &str, &str, &str, ReleaseDay)] = &[
    // Petroleum (Wednesday 10:30 AM ET)
    (
        "WCESTUS1",
        "eia_crude_stocks",
        "U.S. Crude Oil Inventories",
        "petroleum",
        "thousand_barrels",
        ReleaseDay::Wednesday,
    ),
    (
        "WCSSTUS1",
        "eia_spr",
        "Strategic Petroleum Reserve",
        "petroleum",
        "thousand_barrels",
        ReleaseDay::Wednesday,
    ),
    (
        "WGTSTUS1",
        "eia_gasoline_stocks",
        "U.S. Gasoline Inventories",
        "petroleum",
        "thousand_barrels",
        ReleaseDay::Wednesday,
    ),
    (
        "WDISTUS1",
        "eia_distillate_stocks",
        "U.S. Distillate Inventories",
        "petroleum",
        "thousand_barrels",
        ReleaseDay::Wednesday,
    ),
    (
        "WCRFPUS2",
        "eia_crude_production",
        "U.S. Crude Oil Production",
        "production",
        "thousand_barrels_per_day",
        ReleaseDay::Wednesday,
    ),
    (
        "WPULEUS3",
        "eia_refinery_util",
        "U.S. Refinery Utilization",
        "production",
        "percent",
        ReleaseDay::Wednesday,
    ),
    (
        "WCRIMUS2",
        "eia_crude_imports",
        "U.S. Crude Oil Imports",
        "trade",
        "thousand_barrels_per_day",
        ReleaseDay::Wednesday,
    ),
    (
        "WRPUPUS2",
        "eia_days_supply",
        "Days of Crude Oil Supply",
        "petroleum",
        "days",
        ReleaseDay::Wednesday,
    ),
];

/// Natural gas series (uses different API endpoint)
const EIA_NATGAS_SERIES: &[(&str, &str, &str, &str, &str)] = &[
    // Natural Gas (Thursday 10:30 AM ET)
    (
        "natgas_storage",
        "eia_natgas_storage",
        "U.S. Natural Gas Storage",
        "natural_gas",
        "billion_cubic_feet",
    ),
];

#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(dead_code)]
enum ReleaseDay {
    Wednesday,
    Thursday,
    Friday,
}

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
    value: Option<f64>,
    #[serde(rename = "series-description")]
    #[allow(dead_code)]
    series_description: Option<String>,
}

/// EIA market data source
pub struct EiaMarketSource {
    client: reqwest::Client,
    api_key: String,
}

impl EiaMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("EIA_API_KEY").context("EIA_API_KEY not set")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        let total_series = EIA_SERIES.len() + EIA_NATGAS_SERIES.len();
        info!("EIA client initialized with {} series", total_series);

        Ok(Self { client, api_key })
    }

    /// Fetch a petroleum series
    async fn fetch_petroleum_series(&self, series_id: &str) -> Result<Option<(String, f64)>> {
        let url = format!(
            "{}?api_key={}&frequency=weekly&data[0]=value&facets[series][]={}&sort[0][column]=period&sort[0][direction]=desc&length=1",
            EIA_API_URL, self.api_key, series_id
        );

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch EIA series {}", series_id))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("EIA API error for {}: {} {}", series_id, status, body);
            return Ok(None);
        }

        let data: EiaResponse = resp
            .json()
            .await
            .with_context(|| format!("Failed to parse EIA response for {}", series_id))?;

        if let Some(point) = data.response.data.first() {
            if let Some(value) = point.value {
                return Ok(Some((point.period.clone(), value)));
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

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch EIA natural gas storage")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("EIA API error for natural gas: {} {}", status, body);
            return Ok(None);
        }

        let data: EiaResponse = resp
            .json()
            .await
            .context("Failed to parse EIA natural gas response")?;

        if let Some(point) = data.response.data.first() {
            if let Some(value) = point.value {
                return Ok(Some((point.period.clone(), value)));
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
        let mut assets: Vec<AssetUpdate> = EIA_SERIES
            .iter()
            .map(
                |(series_id, asset_id, name, category, unit, release_day)| AssetUpdate {
                    asset_id: asset_id.to_string(),
                    symbol: series_id.to_string(),
                    name: name.to_string(),
                    category: Some(category.to_string()),
                    metadata: serde_json::json!({
                        "source": "eia",
                        "series_id": series_id,
                        "unit": unit,
                        "release_day": match release_day {
                            ReleaseDay::Wednesday => "wednesday",
                            ReleaseDay::Thursday => "thursday",
                            ReleaseDay::Friday => "friday",
                        },
                        "release_time": "10:30 AM ET",
                    }),
                },
            )
            .collect();

        // Add natural gas series
        for (series_id, asset_id, name, category, unit) in EIA_NATGAS_SERIES {
            assets.push(AssetUpdate {
                asset_id: asset_id.to_string(),
                symbol: series_id.to_string(),
                name: name.to_string(),
                category: Some(category.to_string()),
                metadata: serde_json::json!({
                    "source": "eia",
                    "series_id": series_id,
                    "unit": unit,
                    "release_day": "thursday",
                    "release_time": "10:30 AM ET",
                }),
            });
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        // Fetch petroleum series
        for (series_id, asset_id, _name, _category, _unit, _release_day) in EIA_SERIES {
            tokio::time::sleep(Duration::from_millis(200)).await;

            match self.fetch_petroleum_series(series_id).await {
                Ok(Some((_period, value))) => {
                    if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: asset_id.to_string(),
                            symbol: series_id.to_string(),
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
                    debug!("No EIA data for {}", series_id);
                }
                Err(e) => {
                    warn!("Error fetching EIA series {}: {:?}", series_id, e);
                }
            }
        }

        // Fetch natural gas storage
        tokio::time::sleep(Duration::from_millis(200)).await;
        match self.fetch_natgas_storage().await {
            Ok(Some((_period, value))) => {
                if let Ok(decimal_value) = Decimal::from_str(&value.to_string()) {
                    results.push(PriceUpdate {
                        asset_id: "eia_natgas_storage".to_string(),
                        symbol: "natgas_storage".to_string(),
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

        info!("Fetched {} EIA energy series", results.len());
        Ok(results)
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
        let total = EIA_SERIES.len() + EIA_NATGAS_SERIES.len();
        assert!(total >= 9, "Expected at least 9 EIA series");
    }

    #[test]
    fn test_petroleum_categories() {
        let categories: Vec<_> = EIA_SERIES.iter().map(|s| s.3).collect();
        assert!(categories.contains(&"petroleum"));
        assert!(categories.contains(&"production"));
        assert!(categories.contains(&"trade"));
    }
}
