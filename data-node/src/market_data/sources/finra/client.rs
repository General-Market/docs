//! FINRA Short Interest API client implementing MarketDataSource
//!
//! Fetches short interest data from https://api.finra.org/
//! Tracks 25 high-interest securities.

use anyhow::{Context, Result};
use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
    ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/finra.json");

/// FINRA market data source
pub struct FinraMarketSource {
    #[allow(dead_code)]
    client: reqwest::Client,
    api_key: Option<String>,
}

impl FinraMarketSource {
    /// Create from environment variable (optional API key)
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("FINRA_API_KEY").ok();

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!(
            "FINRA client initialized with {} securities (API key: {})",
            asset_count,
            if api_key.is_some() {
                "configured"
            } else {
                "not configured"
            }
        );

        Ok(Self { client, api_key })
    }

    /// Check if we're in a settlement period (mid-month or end-of-month)
    fn is_settlement_period(now: DateTime<Utc>) -> bool {
        let day = now.day();
        // Mid-month: 15th-17th
        // End-of-month: 28th-31st
        matches!(day, 15..=17 | 28..=31)
    }

    /// Fetch short interest for a symbol
    async fn fetch_short_interest(&self, symbol: &str) -> Result<Option<ShortInterestData>> {
        // Note: FINRA requires OAuth authentication for real API access
        // This is a placeholder showing the expected data structure

        // In production, would use:
        // POST https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest/data
        // with OAuth token and request body specifying the symbol

        debug!("Fetching FINRA short interest for {} (placeholder)", symbol);

        // Return None for now - actual implementation requires FINRA API access
        Ok(None)
    }
}

/// Short interest data
#[allow(dead_code)]
struct ShortInterestData {
    shares_short: i64,
    short_interest_ratio: f64, // days to cover
    short_pct_float: f64,      // % of float shorted
    change_from_prior: f64,    // % change from last report
}

#[async_trait::async_trait]
impl MarketDataSource for FinraMarketSource {
    fn source_id(&self) -> &'static str {
        "finra"
    }

    fn display_name(&self) -> &'static str {
        "FINRA Short Interest"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Bi-weekly data, check daily during settlement periods
        Duration::from_secs(24 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100, // Conservative: FINRA allows 1200/min
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

        if self.api_key.is_none() {
            info!("FINRA API key not configured - skipping short interest fetch");
            return Ok(vec![]);
        }

        let entries = load_all_asset_entries(ASSET_JSON)?;

        for entry in &entries {
            tokio::time::sleep(Duration::from_millis(100)).await;

            match self.fetch_short_interest(&entry.api_ref).await {
                Ok(Some(data)) => {
                    // Store shares short as the primary value
                    if let Ok(value) = Decimal::from_str(&data.shares_short.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: entry.asset_id.clone(),
                            symbol: entry.symbol.clone(),
                            value,
                            prev_close: None,
                            change_pct: Decimal::from_str(&data.change_from_prior.to_string()).ok(),
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Ok(None) => {
                    debug!("No FINRA data for {}", entry.api_ref);
                }
                Err(e) => {
                    warn!("Error fetching FINRA data for {}: {:?}", entry.api_ref, e);
                }
            }
        }

        info!("Fetched {} FINRA short interest records", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for FinraMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        if Self::is_settlement_period(now) {
            // During settlement, check every 6 hours
            now + chrono::Duration::hours(6)
        } else {
            // Outside settlement, check daily
            now + chrono::Duration::days(1)
        }
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Short interest data can be published any business day
        false
    }

    fn burst_mode(&self, now: DateTime<Utc>) -> Option<Duration> {
        if Self::is_settlement_period(now) {
            Some(Duration::from_secs(6 * 3600)) // Every 6 hours
        } else {
            None
        }
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_security_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.len() >= 25, "Expected at least 25 securities");
    }

    #[test]
    fn test_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.category == "regulatory"));
        assert!(entries.iter().all(|e| e.subcategory == "short_interest"));
    }

    #[test]
    fn test_settlement_period() {
        // 15th should be in settlement period
        let mid = chrono::Utc.with_ymd_and_hms(2026, 6, 15, 12, 0, 0).unwrap();
        assert!(FinraMarketSource::is_settlement_period(mid));

        // 10th should NOT be in settlement period
        let tenth = chrono::Utc.with_ymd_and_hms(2026, 6, 10, 12, 0, 0).unwrap();
        assert!(!FinraMarketSource::is_settlement_period(tenth));
    }
}
