//! IMF World Economic Outlook data source
//!
//! Fetches IMF WEO data via Nasdaq Data Link (ODA database).
//! Data updated semi-annually (April and October).
//!
//! Provides 60 series: 6 indicators × 10 major economies.

use anyhow::Result;
use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info};

use super::client::NasdaqClient;
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
    ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/imf.json");

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

/// IMF market data source
pub struct ImfMarketSource {
    client: NasdaqClient,
}

impl ImfMarketSource {
    /// Create from environment variable
    pub fn from_env() -> Result<Self> {
        let client = NasdaqClient::from_env()?;
        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("IMF client initialized with {} series", asset_count);
        Ok(Self { client })
    }

    /// Parse country and indicator from api_ref (format: "COUNTRY_INDICATOR")
    fn parse_api_ref(api_ref: &str) -> Option<(&str, &str)> {
        let idx = api_ref.find('_')?;
        Some((&api_ref[..idx], &api_ref[idx + 1..]))
    }

    /// Fetch a single series
    async fn fetch_series(&self, country: &str, indicator: &str) -> Result<Option<(String, f64)>> {
        // ODA dataset format: ODA/{COUNTRY}_{INDICATOR}
        let dataset_code = format!("ODA/{}_{}", country, indicator);

        let resp: NasdaqDatasetResponse = match self.client.fetch_dataset(&dataset_code, 1).await {
            Ok(r) => r,
            Err(e) => {
                debug!(
                    "Failed to fetch IMF data for {} {}: {:?}",
                    country, indicator, e
                );
                return Ok(None);
            }
        };

        if resp.dataset.data.is_empty() {
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
impl MarketDataSource for ImfMarketSource {
    fn source_id(&self) -> &'static str {
        "imf"
    }

    fn display_name(&self) -> &'static str {
        "IMF World Economic Outlook"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Sync once per week (data only updates semi-annually)
        Duration::from_secs(7 * 24 * 3600)
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

            let (country_code, indicator_code) = match Self::parse_api_ref(&entry.api_ref) {
                Some(pair) => pair,
                None => {
                    debug!("Invalid api_ref format: {}", entry.api_ref);
                    continue;
                }
            };

            // Small delay between requests
            tokio::time::sleep(Duration::from_millis(100)).await;

            match self.fetch_series(country_code, indicator_code).await {
                Ok(Some((_date, value))) => {
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
                    // Many country/indicator combos may not exist
                }
                Err(e) => {
                    debug!(
                        "Error fetching IMF {} {}: {:?}",
                        country_code, indicator_code, e
                    );
                }
            }
        }

        info!("Fetched {} IMF WEO indicators", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for ImfMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // IMF WEO releases in April and October
        // Check if we're in a release window (first 2 weeks of April or October)
        let month = now.month();

        if (month == 4 || month == 10) && now.day() <= 15 {
            // In release window: check daily
            return now + chrono::Duration::days(1);
        }

        // Outside release window: check weekly
        now + chrono::Duration::days(7)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Annual data, no day restrictions
        false
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        // Burst mode during WEO release windows (first 2 weeks of April/October)
        let month = now.month();
        let day = now.day();

        if (month == 4 || month == 10) && day <= 15 {
            return Some(Duration::from_secs(6 * 3600)); // Every 6 hours
        }

        None
    }

    fn timezone(&self) -> &'static str {
        "UTC"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 60, "Expected 60 IMF assets (6 indicators × 10 countries)");
    }

    #[test]
    fn test_fetch_assets_filters_active() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(!assets.is_empty());
        for asset in &assets {
            assert_eq!(asset.category, Some("macro".to_string()));
        }
    }

    #[test]
    fn test_parse_api_ref() {
        let (country, indicator) = ImfMarketSource::parse_api_ref("USA_NGDP_RPCH").unwrap();
        assert_eq!(country, "USA");
        assert_eq!(indicator, "NGDP_RPCH");
    }

    #[test]
    fn test_api_ref_contains_country() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let api_refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(api_refs.iter().any(|r| r.starts_with("USA_")));
        assert!(api_refs.iter().any(|r| r.starts_with("CHN_")));
        assert!(api_refs.iter().any(|r| r.starts_with("DEU_")));
    }
}
