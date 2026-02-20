//! Congress.gov API client implementing MarketDataSource
//!
//! Fetches legislative data from https://api.congress.gov/v3/
//! Tracks bills, nominations, and legislative activity.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::traits::{
    AssetUpdate, MarketDataSource, PriceUpdate, ScheduledMarketDataSource,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Congress.gov API base URL
const CONGRESS_API_URL: &str = "https://api.congress.gov/v3";

/// Legislative metrics to track
/// (asset_id, name, endpoint_suffix, category, unit)
const CONGRESS_METRICS: &[(&str, &str, &str, &str, &str)] = &[
    (
        "congress_bills_introduced_house",
        "Bills Introduced (House)",
        "bill?chamber=house",
        "house",
        "count",
    ),
    (
        "congress_bills_introduced_senate",
        "Bills Introduced (Senate)",
        "bill?chamber=senate",
        "senate",
        "count",
    ),
    (
        "congress_bills_passed_house",
        "Bills Passed House",
        "bill?billStatus=passedHouse",
        "house",
        "count",
    ),
    (
        "congress_bills_passed_senate",
        "Bills Passed Senate",
        "bill?billStatus=passedSenate",
        "senate",
        "count",
    ),
    (
        "congress_bills_became_law",
        "Bills Became Law",
        "bill?billStatus=becameLaw",
        "enacted",
        "count",
    ),
    (
        "congress_nominations_pending",
        "Pending Nominations",
        "nomination?status=pending",
        "nominations",
        "count",
    ),
    (
        "congress_nominations_confirmed",
        "Confirmed Nominations",
        "nomination?status=confirmed",
        "nominations",
        "count",
    ),
    (
        "congress_bills_vetoed",
        "Vetoed Bills",
        "bill?billStatus=vetoed",
        "enacted",
        "count",
    ),
    (
        "congress_resolutions_passed",
        "Joint Resolutions Passed",
        "bill?billType=sjres&billStatus=passSenate",
        "resolutions",
        "count",
    ),
    (
        "congress_committee_hearings",
        "Committee Hearings",
        "committee-meeting",
        "hearings",
        "count",
    ),
];

/// Congress.gov API response structure
#[derive(Debug, Deserialize)]
struct CongressResponse {
    pagination: Option<CongressPagination>,
}

#[derive(Debug, Deserialize)]
struct CongressPagination {
    count: i64,
}

/// Congress market data source
pub struct CongressMarketSource {
    client: reqwest::Client,
    api_key: String,
}

impl CongressMarketSource {
    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("CONGRESS_API_KEY").context("CONGRESS_API_KEY not set")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!(
            "Congress client initialized with {} metrics",
            CONGRESS_METRICS.len()
        );

        Ok(Self { client, api_key })
    }

    /// Fetch count for a metric
    async fn fetch_metric(&self, endpoint_suffix: &str) -> Result<Option<i64>> {
        let url = format!(
            "{}/{}?api_key={}&limit=1",
            CONGRESS_API_URL, endpoint_suffix, self.api_key
        );

        let resp =
            self.client.get(&url).send().await.with_context(|| {
                format!("Failed to fetch Congress data for {}", endpoint_suffix)
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            warn!("Congress API error for {}: {}", endpoint_suffix, status);
            return Ok(None);
        }

        let data: CongressResponse = resp.json().await.with_context(|| {
            format!("Failed to parse Congress response for {}", endpoint_suffix)
        })?;

        Ok(data.pagination.map(|p| p.count))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for CongressMarketSource {
    fn source_id(&self) -> &'static str {
        "congress"
    }

    fn display_name(&self) -> &'static str {
        "Congress.gov Legislative Activity"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Check every 6 hours
        Duration::from_secs(6 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 400, // Conservative: Congress allows 5000/hr
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        Ok(CONGRESS_METRICS
            .iter()
            .map(|(asset_id, name, endpoint, category, unit)| AssetUpdate {
                asset_id: asset_id.to_string(),
                symbol: asset_id.to_string(),
                name: name.to_string(),
                category: Some(category.to_string()),
                metadata: serde_json::json!({
                    "source": "congress",
                    "endpoint": endpoint,
                    "unit": unit,
                    "update_frequency": "daily",
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let mut results = Vec::new();

        for (asset_id, _name, endpoint, _category, _unit) in CONGRESS_METRICS {
            tokio::time::sleep(Duration::from_millis(200)).await;

            match self.fetch_metric(endpoint).await {
                Ok(Some(count)) => {
                    if let Ok(value) = Decimal::from_str(&count.to_string()) {
                        results.push(PriceUpdate {
                            asset_id: asset_id.to_string(),
                            symbol: asset_id.to_string(),
                            value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Ok(None) => {
                    debug!("No Congress data for {}", asset_id);
                }
                Err(e) => {
                    warn!("Error fetching Congress data for {}: {:?}", asset_id, e);
                }
            }
        }

        info!("Fetched {} Congress legislative metrics", results.len());
        Ok(results)
    }
}

#[async_trait::async_trait]
impl ScheduledMarketDataSource for CongressMarketSource {
    fn next_fetch_time(&self, now: DateTime<Utc>) -> DateTime<Utc> {
        // Check every 6 hours
        now + chrono::Duration::hours(6)
    }

    fn should_skip_today(&self, _now: DateTime<Utc>) -> bool {
        // Legislative activity can happen any day
        false
    }

    fn burst_mode(&self, _now: DateTime<Utc>) -> Option<Duration> {
        // No burst mode for Congress data
        None
    }

    fn timezone(&self) -> &'static str {
        "US/Eastern"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metric_count() {
        assert!(
            CONGRESS_METRICS.len() >= 10,
            "Expected at least 10 Congress metrics"
        );
    }

    #[test]
    fn test_categories() {
        let categories: Vec<_> = CONGRESS_METRICS.iter().map(|m| m.3).collect();
        assert!(categories.contains(&"house"));
        assert!(categories.contains(&"senate"));
        assert!(categories.contains(&"enacted"));
        assert!(categories.contains(&"nominations"));
    }
}
