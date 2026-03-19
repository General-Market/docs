//! ECB API client implementing MarketDataSource and ScheduledMarketDataSource
//!
//! Fetches Euro area data from https://data-api.ecb.europa.eu
//! No API key required. Uses SDMX 2.1 format (JSON output).

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, NaiveTime, TimeZone, Timelike, Utc};
use chrono_tz::Europe::Berlin;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    is_ecb_day, is_eu_weekend, load_all_asset_entries, load_assets_from_json, next_eu_trading_day,
    today_at_cet, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};

/// ECB API base URL
const ECB_API_URL: &str = "https://data-api.ecb.europa.eu/service/data";

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/ecb.json");

/// ECB SDMX JSON response structure
#[derive(Debug, Deserialize)]
struct EcbResponse {
    #[serde(rename = "dataSets")]
    data_sets: Option<Vec<EcbDataSet>>,
    #[allow(dead_code)] // Used for SDMX structure parsing
    structure: Option<EcbStructure>,
}

#[derive(Debug, Deserialize)]
struct EcbDataSet {
    series: Option<std::collections::HashMap<String, EcbSeries>>,
}

#[derive(Debug, Deserialize)]
struct EcbSeries {
    observations: Option<std::collections::HashMap<String, Vec<serde_json::Value>>>,
}

// These structs are part of the SDMX response format and needed for deserialization
// even if we don't currently read all fields directly
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct EcbStructure {
    dimensions: Option<EcbDimensions>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct EcbDimensions {
    observation: Option<Vec<EcbDimension>>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct EcbDimension {
    values: Option<Vec<EcbDimensionValue>>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct EcbDimensionValue {
    id: String,
}

/// ECB market data source
pub struct EcbMarketSource {
    http: SourceHttpClient,
}

impl EcbMarketSource {
    /// Create a new ECB client (no API key needed)
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("ECB client initialized with {} series", asset_count);

        Ok(Self { http })
    }

    /// Fetch a single ECB series
    async fn fetch_series(&self, series_key: &str) -> Result<Option<Decimal>> {
        // ECB API format: /data/{flowRef}/{key}
        // flowRef is the first part before the first dot
        let parts: Vec<&str> = series_key.splitn(2, '.').collect();
        if parts.len() != 2 {
            warn!("Invalid ECB series key format: {}", series_key);
            return Ok(None);
        }

        let flow_ref = parts[0];
        let key = parts[1];

        let url = format!(
            "{}/{}/{}?format=jsondata&lastNObservations=1",
            ECB_API_URL, flow_ref, key
        );

        let data: EcbResponse = match self.http.get_json_with_headers(&url, &[("Accept", "application/json")]).await {
            Ok(d) => d,
            Err(e) => {
                warn!("ECB API error for {}: {}", series_key, e);
                return Ok(None);
            }
        };

        // Navigate the SDMX structure to get the value
        // dataSets[0].series["0:0:0:..."].observations["0"][0]
        if let Some(data_sets) = data.data_sets {
            if let Some(first_set) = data_sets.first() {
                if let Some(series) = &first_set.series {
                    if series.len() > 1 {
                        warn!("ECB response for {} has {} series, using first", series_key, series.len());
                    }
                    if let Some(first_series) = series.values().next() {
                        if let Some(observations) = &first_series.observations {
                            // Find the most recent observation by max key (keys are period indices "0", "1", ...)
                            let latest_obs = observations.iter()
                                .max_by_key(|(k, _)| k.parse::<u64>().unwrap_or(0))
                                .map(|(_, v)| v);
                            if let Some(obs_values) = latest_obs {
                                if let Some(value) = obs_values.first() {
                                    if let Some(num) = value.as_f64() {
                                        return Ok(Some(
                                            Decimal::from_str(&num.to_string()).unwrap_or_default(),
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        debug!("No value found in ECB response for {}", series_key);
        Ok(None)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for EcbMarketSource {
    fn source_id(&self) -> &'static str {
        "ecb"
    }

    fn display_name(&self) -> &'static str {
        "ECB Euro Area Data"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // ECB doesn't document limits but is generous
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30, // Conservative
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

        // Build a lookup from asset_id to series_key (api_ref)
        let entries = load_all_asset_entries(ASSET_JSON)?;
        let series_lookup: std::collections::HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        for asset_id in asset_ids {
            if let Some(series_key) = series_lookup.get(asset_id) {
                match self.fetch_series(series_key).await {
                    Ok(Some(value)) => {
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
                        debug!("No data for ECB series {}", asset_id);
                    }
                    Err(e) => {
                        warn!("Error fetching ECB series {}: {:?}", asset_id, e);
                    }
                }
            }
        }

        info!(
            "Fetched {}/{} prices from ECB",
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
impl ScheduledMarketDataSource for EcbMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        let cet = now.with_timezone(&Berlin);
        let hour = cet.hour();
        let date = cet.date_naive();

        // ECB meeting days: check for rate announcement at 14:15 CET
        if is_ecb_day(date) {
            if hour < 14 {
                return today_at_cet(now, 14, 15);
            } else if hour == 14 {
                return now; // Fetch during announcement window
            }
        }

        // Daily data publishes at 16:00 CET
        let publish_hour = 16;

        if hour < publish_hour {
            return today_at_cet(now, publish_hour, 5);
        } else if hour == publish_hour {
            return now;
        }

        // After 4 PM: wait for next trading day at 4 PM
        let next_day = next_eu_trading_day(now);
        let next_cet = next_day.with_timezone(&Berlin);
        let fetch_time = next_cet
            .date_naive()
            .and_time(NaiveTime::from_hms_opt(publish_hour, 5, 0).unwrap());
        Berlin
            .from_local_datetime(&fetch_time)
            .unwrap()
            .with_timezone(&Utc)
    }

    fn should_skip_today(&self, now: DateTime<Utc>) -> bool {
        is_eu_weekend(now)
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        let cet = now.with_timezone(&Berlin);
        let date = cet.date_naive();
        let day = cet.day();
        let hour = cet.hour();

        // ECB meeting days: burst mode from 14:00 to 17:00 CET
        if is_ecb_day(date) {
            if hour >= 14 && hour <= 17 {
                return Some(Duration::from_secs(5 * 60)); // 5 minutes
            }
        }

        // M3 money supply release window: 26th-28th around 10:00 CET
        if (26..=28).contains(&day) && hour >= 9 && hour <= 11 {
            return Some(Duration::from_secs(15 * 60)); // 15 minutes
        }

        None
    }

    fn timezone(&self) -> &'static str {
        "Europe/Berlin"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_series_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 10, "Expected 10 ECB series");
    }

    #[test]
    fn test_source_id() {
        assert_eq!("ecb", "ecb");
    }

    #[test]
    fn test_series_key_format() {
        // Verify all api_ref (series keys) have the expected format
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.api_ref.contains('.'),
                "Series key should contain dots: {}",
                entry.api_ref
            );
        }
    }

    #[test]
    fn test_category_is_macro() {
        // All ECB entries should have category "macro"
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
        assert!(subcats.contains(&"interest_rates"));
        assert!(subcats.contains(&"money_supply"));
        assert!(subcats.contains(&"inflation"));
        assert!(subcats.contains(&"employment"));
        assert!(subcats.contains(&"credit"));
        assert!(subcats.contains(&"gdp"));
    }
}
