//! Adzuna Job Market data source
//!
//! Fetches job vacancy counts and average salaries from the Adzuna API
//! across multiple countries (US, GB, DE, FR).
//!
//! API: https://api.adzuna.com/v1/api/jobs/{country}/search/1
//! Auth: App ID + App Key (query params)
//! Rate limit: 250 req/min
//! Sync interval: 3600s (1 hour)

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/adzuna.json");

/// Adzuna API base URL
const API_BASE: &str = "https://api.adzuna.com/v1/api/jobs";

/// Adzuna search response
#[derive(Debug, Deserialize)]
struct AdzunaSearchResponse {
    count: Option<u64>,
    mean: Option<f64>,
}

/// Adzuna job market data source.
///
/// Tracks job vacancy counts and average advertised salaries across
/// US, GB, DE, and FR markets.
/// Source ID is `"adzuna"`.
pub struct AdzunaMarketSource {
    client: reqwest::Client,
    app_id: String,
    app_key: String,
}

impl AdzunaMarketSource {
    pub fn from_env() -> Result<Self> {
        let app_id = std::env::var("ADZUNA_APP_ID").context("ADZUNA_APP_ID not set")?;
        let app_key = std::env::var("ADZUNA_APP_KEY").context("ADZUNA_APP_KEY not set")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("IndexDataNode/1.0")
            .build()
            .context("Failed to build reqwest client")?;

        info!("Adzuna source initialized (app_id: {}...)", &app_id[..app_id.len().min(8)]);
        Ok(Self {
            client,
            app_id,
            app_key,
        })
    }

    /// Fetch job data for a country. Returns (vacancy_count, mean_salary).
    async fn fetch_country(&self, country: &str) -> Result<(u64, Option<f64>)> {
        let url = format!(
            "{}/{}/search/1?app_id={}&app_key={}&results_per_page=0",
            API_BASE, country, self.app_id, self.app_key
        );

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Adzuna request failed for {}", country))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Adzuna API error for {}: {} {}", country, status, body);
        }

        let data: AdzunaSearchResponse = resp
            .json()
            .await
            .with_context(|| format!("Adzuna parse failed for {}", country))?;

        Ok((data.count.unwrap_or(0), data.mean))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for AdzunaMarketSource {
    fn source_id(&self) -> &'static str {
        "adzuna"
    }

    fn display_name(&self) -> &'static str {
        "Adzuna Jobs"
    }

    fn default_resolution(&self) -> &'static str {
        "latest"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600) // 1 hour
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 250,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let mut results = Vec::new();

        // Extract unique countries from api_ref (format: "country:metric")
        let mut countries: Vec<String> = entries
            .iter()
            .filter_map(|e| e.api_ref.split(':').next().map(|s| s.to_string()))
            .collect();
        countries.sort();
        countries.dedup();

        for country in &countries {
            // Small delay between requests
            tokio::time::sleep(Duration::from_millis(500)).await;

            match self.fetch_country(country).await {
                Ok((vacancy_count, mean_salary)) => {
                    // Find matching entries for this country
                    for entry in &entries {
                        if !entry.active || !asset_ids.contains(&entry.asset_id) {
                            continue;
                        }

                        let parts: Vec<&str> = entry.api_ref.split(':').collect();
                        if parts.len() != 2 || parts[0] != country {
                            continue;
                        }

                        let value = match parts[1] {
                            "vacancies" => {
                                Decimal::from_str(&vacancy_count.to_string()).ok()
                            }
                            "salary" => mean_salary
                                .and_then(|s| Decimal::from_str(&format!("{:.2}", s)).ok()),
                            _ => None,
                        };

                        if let Some(v) = value {
                            results.push(PriceUpdate {
                                asset_id: entry.asset_id.clone(),
                                symbol: entry.symbol.clone(),
                                value: v,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Adzuna fetch failed for {}: {:?}", country, e);
                }
            }
        }

        info!("Fetched {} Adzuna job market data points", results.len());
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_asset_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 8, "Expected 8 Adzuna assets (4 countries × 2 metrics)");
    }

    #[test]
    fn test_fetch_assets_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 8);
        for asset in &assets {
            assert_eq!(asset.category, Some("government".to_string()));
        }
    }

    #[test]
    fn test_api_ref_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let parts: Vec<&str> = entry.api_ref.split(':').collect();
            assert_eq!(
                parts.len(),
                2,
                "api_ref '{}' should have country:metric format",
                entry.api_ref
            );
            assert!(
                ["us", "gb", "de", "fr"].contains(&parts[0]),
                "Unknown country: {}",
                parts[0]
            );
            assert!(
                ["vacancies", "salary"].contains(&parts[1]),
                "Unknown metric: {}",
                parts[1]
            );
        }
    }

    #[test]
    fn test_country_extraction() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut countries: Vec<String> = entries
            .iter()
            .filter_map(|e| e.api_ref.split(':').next().map(|s| s.to_string()))
            .collect();
        countries.sort();
        countries.dedup();
        assert_eq!(countries, vec!["de", "fr", "gb", "us"]);
    }

    #[test]
    fn test_response_parsing() {
        let json = r#"{"count": 12345, "mean": 55432.50}"#;
        let resp: AdzunaSearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.count.unwrap(), 12345);
        assert!((resp.mean.unwrap() - 55432.50).abs() < 0.01);
    }

    #[test]
    fn test_response_missing_fields() {
        let json = r#"{"count": 100}"#;
        let resp: AdzunaSearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.count.unwrap(), 100);
        assert!(resp.mean.is_none());
    }
}
