//! crates.io API client implementing MarketDataSource
//!
//! Tracks Rust crate download counts from the crates.io registry.
//! The list endpoint returns all metrics inline (100 crates/page, 200 pages max = 20K).
//!
//! API: https://crates.io/api/v1/crates?sort=downloads&per_page=100
//! Auth: None (User-Agent required)
//! Rate limit: 1 req/s (600 per 10-min window, budget 85% = 510)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource,
    PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

const ASSET_JSON: &str = include_str!("../../../config/crates_io.json");
const API_URL: &str = "https://crates.io/api/v1";
const PER_PAGE: usize = 100;
const MAX_PAGES: usize = 200; // 200 pages × 100 = 20k crates
const INTER_REQUEST_DELAY_MS: u64 = 1100; // >1s to respect 1 req/s

#[derive(Debug, Deserialize)]
struct CratesListResponse {
    crates: Vec<CrateEntry>,
    meta: CratesMeta,
}

#[derive(Debug, Deserialize)]
struct CratesMeta {
    total: u64,
}

#[derive(Debug, Deserialize)]
struct CrateEntry {
    #[serde(rename = "id")]
    name: String,
    #[serde(default)]
    downloads: u64,
    #[serde(default)]
    recent_downloads: Option<u64>,
    #[serde(default)]
    max_version: Option<String>,
    #[serde(default)]
    description: Option<String>,
}

pub struct CratesIoMarketSource {
    http: SourceHttpClient,
}

impl CratesIoMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 510,
                duration: Duration::from_secs(600),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(45))
            .user_agent("market-data-lib (github.com/agiarena)")
            .build()?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());
        info!("crates.io source initialized");
        Ok(Self { http })
    }

    /// Fetch a page of crates sorted by downloads
    async fn fetch_page(
        &self,
        page: usize,
        sort: &str,
    ) -> Result<CratesListResponse, SourceError> {
        let url = format!(
            "{}/crates?sort={}&per_page={}&page={}",
            API_URL, sort, PER_PAGE, page
        );
        self.http.get_json(&url).await
    }

    /// Fetch all pages up to max_pages, collecting crate entries
    async fn fetch_all_crates(&self, max_items: usize) -> Result<Vec<CrateEntry>, SourceError> {
        let pages_needed = (max_items + PER_PAGE - 1) / PER_PAGE;
        let pages_needed = pages_needed.min(MAX_PAGES);
        let mut all_crates = Vec::new();

        for page in 1..=pages_needed {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            match self.fetch_page(page, "downloads").await {
                Ok(resp) => {
                    let count = resp.crates.len();
                    all_crates.extend(resp.crates);
                    if count < PER_PAGE {
                        break; // Last page
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch crates.io page {}: {:?}", page, e);
                    break;
                }
            }
        }

        all_crates.truncate(max_items);
        info!("Fetched {} crates from crates.io", all_crates.len());
        Ok(all_crates)
    }
}

fn make_asset_id(name: &str) -> String {
    format!("crate_{}", name)
}

fn parse_name_from_asset_id(asset_id: &str) -> Option<&str> {
    asset_id.strip_prefix("crate_")
}

fn parse_name_from_ref(api_ref: &str) -> Option<&str> {
    api_ref.strip_prefix("crate:")
}

#[async_trait::async_trait]
impl MarketDataSource for CratesIoMarketSource {
    fn source_id(&self) -> &'static str {
        "crates_io"
    }

    fn display_name(&self) -> &'static str {
        "crates.io Rust Packages"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 510,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        info!("crates.io config is empty, performing live discovery");
        let crates = self
            .fetch_all_crates(20_000)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch crates: {:?}", e))?;

        let assets: Vec<AssetUpdate> = crates
            .iter()
            .map(|c| AssetUpdate {
                asset_id: make_asset_id(&c.name),
                symbol: format!("CRATE:{}", c.name),
                name: c.description.clone().unwrap_or_else(|| c.name.clone()),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("crate:{}", c.name),
                    "subcategory": "crates",
                    "active": true,
                    "extra": {},
                }),
            })
            .collect();

        info!("Discovered {} crates", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Fetch all crates from list endpoint (returns downloads inline)
        let crates = self
            .fetch_all_crates(20_000)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch crates: {:?}", e))?;

        // Build name -> crate lookup
        let crate_lookup: HashMap<&str, &CrateEntry> =
            crates.iter().map(|c| (c.name.as_str(), c)).collect();

        // Also load api_ref from config
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        let mut results = Vec::new();
        for asset_id in asset_ids {
            let name = if let Some(api_ref) = ref_lookup.get(asset_id) {
                parse_name_from_ref(api_ref)
            } else {
                parse_name_from_asset_id(asset_id)
            };

            let name = match name {
                Some(n) => n,
                None => {
                    debug!("Cannot parse crate name from: {}", asset_id);
                    continue;
                }
            };

            if let Some(entry) = crate_lookup.get(name) {
                let value = entry.recent_downloads.unwrap_or(entry.downloads);
                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol: format!("CRATE:{}", name),
                    value: Decimal::from(value),
                    prev_close: None,
                    change_pct: None,
                    volume_24h: Some(Decimal::from(entry.downloads)),
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        info!(
            "Fetched {}/{} prices from crates.io",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering top crates from crates.io...");
        let crates = self
            .fetch_all_crates(20_000)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch crates: {:?}", e))?;

        let entries: Vec<AssetEntry> = crates
            .iter()
            .map(|c| AssetEntry {
                asset_id: make_asset_id(&c.name),
                symbol: format!("CRATE:{}", c.name),
                name: c.description.clone().unwrap_or_else(|| c.name.clone()),
                category: "sentiment".to_string(),
                subcategory: "crates".to_string(),
                api_ref: format!("crate:{}", c.name),
                active: true,
            })
            .collect();

        info!("Discovered {} crates", entries.len());
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
    fn test_empty_config_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    #[test]
    fn test_make_asset_id() {
        assert_eq!(make_asset_id("serde"), "crate_serde");
        assert_eq!(make_asset_id("tokio"), "crate_tokio");
    }

    #[test]
    fn test_parse_name_from_asset_id() {
        assert_eq!(parse_name_from_asset_id("crate_serde"), Some("serde"));
        assert_eq!(parse_name_from_asset_id("crate_tokio"), Some("tokio"));
        assert_eq!(parse_name_from_asset_id("invalid"), None);
    }

    #[test]
    fn test_parse_name_from_ref() {
        assert_eq!(parse_name_from_ref("crate:serde"), Some("serde"));
        assert_eq!(parse_name_from_ref("invalid"), None);
    }
}
