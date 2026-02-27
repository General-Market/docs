//! PyPI market data source implementing MarketDataSource
//!
//! Tracks Python package daily download counts.
//! Discovery via hugovk top-pypi-packages JSON (15K packages, 1 call).
//! Prices via pypistats.org API (30 req/min, 85% = 25/min).
//!
//! APIs:
//!   Discovery: https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json
//!   Prices: https://pypistats.org/api/packages/{package}/recent
//! Auth: None
//! Rate limit: pypistats 30 req/min → 85% = 255 per 10-min window

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource,
    PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

const ASSET_JSON: &str = include_str!("../../../config/pypi.json");
const HUGOVK_URL: &str =
    "https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json";
const PYPISTATS_URL: &str = "https://pypistats.org/api/packages";
const MAX_PACKAGES: usize = 100; // Keep init under 5 min (100 × 2.5s = 250s)
const INTER_REQUEST_DELAY_MS: u64 = 2500; // 30 req/min × 85% ≈ 1 per 2.4s

#[derive(Debug, Deserialize)]
struct HugovkResponse {
    rows: Vec<HugovkPackage>,
}

#[derive(Debug, Deserialize)]
struct HugovkPackage {
    project: String,
    download_count: u64,
}

#[derive(Debug, Deserialize)]
struct PypiStatsRecent {
    data: PypiStatsData,
    package: String,
}

#[derive(Debug, Deserialize)]
struct PypiStatsData {
    last_day: u64,
    last_week: u64,
    last_month: u64,
}

pub struct PypiMarketSource {
    http: SourceHttpClient,
}

impl PypiMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 255,
                duration: Duration::from_secs(600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("PyPI source initialized (pypistats.org for downloads)");
        Ok(Self { http })
    }

    /// Discover top packages from hugovk JSON
    async fn discover_top_packages(&self) -> Result<Vec<(String, u64)>, SourceError> {
        let resp: HugovkResponse = self.http.get_json(HUGOVK_URL).await?;
        let mut packages: Vec<(String, u64)> = resp
            .rows
            .into_iter()
            .map(|r| (r.project, r.download_count))
            .collect();
        packages.truncate(MAX_PACKAGES);
        info!(
            "Discovered {} top PyPI packages from hugovk",
            packages.len()
        );
        Ok(packages)
    }

    /// Fetch recent download stats for a single package
    async fn fetch_package_stats(&self, package: &str) -> Result<PypiStatsData, SourceError> {
        let url = format!("{}/{}/recent", PYPISTATS_URL, package);
        let resp: PypiStatsRecent = self.http.get_json(&url).await?;
        Ok(resp.data)
    }
}

fn make_asset_id(package: &str) -> String {
    let sanitized = package.replace('-', "_").to_lowercase();
    format!("pypi_{}", sanitized)
}

fn parse_package_from_ref(api_ref: &str) -> Option<&str> {
    api_ref.strip_prefix("pkg:")
}

fn parse_package_from_asset_id(asset_id: &str) -> Option<&str> {
    asset_id.strip_prefix("pypi_")
}

#[async_trait::async_trait]
impl MarketDataSource for PypiMarketSource {
    fn source_id(&self) -> &'static str {
        "pypi"
    }

    fn display_name(&self) -> &'static str {
        "PyPI Python Packages"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(3600) // 1 hour — 250 packages × 2.5s each = ~10 min fetch time
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 255,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        info!("PyPI config is empty, performing live discovery");
        let packages = self
            .discover_top_packages()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover PyPI packages: {:?}", e))?;

        let assets: Vec<AssetUpdate> = packages
            .iter()
            .map(|(name, _)| AssetUpdate {
                asset_id: make_asset_id(name),
                symbol: format!("PYPI:{}", name),
                name: name.clone(),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("pkg:{}", name),
                    "subcategory": "pypi",
                    "active": true,
                    "extra": {},
                }),
            })
            .collect();

        info!("Discovered {} PyPI packages", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load api_ref lookup
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        let mut results = Vec::new();

        for asset_id in asset_ids {
            let package = if let Some(api_ref) = ref_lookup.get(asset_id) {
                parse_package_from_ref(api_ref).map(|s| s.to_string())
            } else {
                parse_package_from_asset_id(asset_id).map(|s| s.replace('_', "-"))
            };

            let package = match package {
                Some(p) => p,
                None => {
                    debug!("Cannot parse package from: {}", asset_id);
                    continue;
                }
            };

            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_package_stats(&package).await {
                Ok(stats) => {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: format!("PYPI:{}", package),
                        value: Decimal::from(stats.last_day),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: Some(Decimal::from(stats.last_week)),
                        market_cap: Some(Decimal::from(stats.last_month)),
                        fetched_at: now,
                    });
                }
                Err(e) => {
                    debug!("Failed to fetch pypistats for {}: {:?}", package, e);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from PyPI",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering PyPI packages...");
        let packages = self
            .discover_top_packages()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover PyPI packages: {:?}", e))?;

        let entries: Vec<AssetEntry> = packages
            .iter()
            .map(|(name, _)| AssetEntry {
                asset_id: make_asset_id(name),
                symbol: format!("PYPI:{}", name),
                name: name.clone(),
                category: "sentiment".to_string(),
                subcategory: "pypi".to_string(),
                api_ref: format!("pkg:{}", name),
                active: true,
            })
            .collect();

        info!("Discovered {} PyPI packages", entries.len());
        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn test_make_asset_id() {
        assert_eq!(make_asset_id("requests"), "pypi_requests");
        assert_eq!(make_asset_id("numpy"), "pypi_numpy");
        assert_eq!(make_asset_id("scikit-learn"), "pypi_scikit_learn");
    }

    #[test]
    fn test_parse_package_from_ref() {
        assert_eq!(parse_package_from_ref("pkg:requests"), Some("requests"));
        assert_eq!(parse_package_from_ref("invalid"), None);
    }
}
