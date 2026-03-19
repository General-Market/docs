//! npm registry API client implementing MarketDataSource
//!
//! Tracks npm package daily download counts.
//! Discovery via multi-term search API (20 terms × 2 pages × 250/page, deduped),
//! prices via bulk download API (128/call).
//!
//! APIs:
//!   Search: https://registry.npmjs.org/-/v1/search?text={term}&popularity=1.0&size=250
//!   Downloads: https://api.npmjs.org/downloads/point/last-day/{pkg1},{pkg2},...
//! Auth: None
//! Rate limit: Empirical ~200ms between calls. Budget 85% = ~2,550 calls/10min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, BatchStrategy,
    MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

const ASSET_JSON: &str = include_str!("../../../config/npm.json");
const SEARCH_URL: &str = "https://registry.npmjs.org/-/v1/search";
const DOWNLOADS_URL: &str = "https://api.npmjs.org/downloads/point/last-day";
const SEARCH_PAGE_SIZE: usize = 250;
const PAGES_PER_TERM: usize = 2; // 2 pages × 250 = 500 per term
const BULK_BATCH_SIZE: usize = 128;
const INTER_REQUEST_DELAY_MS: u64 = 1500;

/// Broad search terms covering different npm ecosystems.
/// Each returns 50K+ results sorted by popularity, so the first pages
/// of each give us the most popular packages in that ecosystem.
/// Multi-term + dedup yields ~3,000-5,000 unique popular packages.
const DISCOVERY_TERMS: &[&str] = &[
    "react", "node", "typescript", "express", "webpack",
    "eslint", "babel", "jest", "json", "http",
    "cli", "api", "server", "util", "test",
    "file", "css", "data", "log", "plugin",
];

#[derive(Debug, Deserialize)]
struct NpmSearchResponse {
    objects: Vec<NpmSearchObject>,
    total: u64,
}

#[derive(Debug, Deserialize)]
struct NpmSearchObject {
    package: NpmPackageInfo,
}

#[derive(Debug, Deserialize)]
struct NpmPackageInfo {
    name: String,
    #[serde(default)]
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NpmDownloadPoint {
    downloads: u64,
    package: String,
}

pub struct NpmMarketSource {
    http: SourceHttpClient,
    /// Cache of asset_id -> original package name, populated during fetch_assets().
    /// This is necessary because scoped package names (e.g. @babel/core) cannot be
    /// reconstructed from asset_ids (npm_babel_core) — the @ and / are lost.
    package_name_cache: Arc<Mutex<HashMap<String, String>>>,
}

impl NpmMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2550,
                duration: Duration::from_secs(600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("npm source initialized");
        Ok(Self {
            http,
            package_name_cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Discover popular packages via multi-term search.
    /// The npm search API requires a text parameter (2-64 chars), so we search
    /// multiple broad terms and deduplicate. Results sorted by popularity=1.0
    /// ensures top packages surface first.
    async fn discover_packages(&self, max_items: usize) -> Result<Vec<(String, String)>, SourceError> {
        let mut seen = std::collections::HashSet::new();
        let mut packages = Vec::new();

        for term in DISCOVERY_TERMS {
            if packages.len() >= max_items {
                break;
            }

            for page in 0..PAGES_PER_TERM {
                let offset = page * SEARCH_PAGE_SIZE;
                let url = format!(
                    "{}?text={}&popularity=1.0&quality=0.0&maintenance=0.0&size={}&from={}",
                    SEARCH_URL, term, SEARCH_PAGE_SIZE, offset
                );

                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

                match self.http.get_json::<NpmSearchResponse>(&url).await {
                    Ok(resp) => {
                        let count = resp.objects.len();
                        for obj in resp.objects {
                            if seen.insert(obj.package.name.clone()) {
                                let desc = obj.package.description.unwrap_or_default();
                                packages.push((obj.package.name, desc));
                            }
                        }
                        if count < SEARCH_PAGE_SIZE {
                            break;
                        }
                    }
                    Err(e) => {
                        warn!("npm search '{}' page {} failed: {:?}", term, page, e);
                        break;
                    }
                }
            }
        }

        packages.truncate(max_items);
        info!("Discovered {} npm packages via multi-term search", packages.len());
        Ok(packages)
    }

    /// Fetch download counts for a batch of unscoped packages (max 128)
    async fn fetch_bulk_downloads(
        &self,
        packages: &[&str],
    ) -> Result<HashMap<String, u64>, SourceError> {
        let joined = packages.join(",");
        let url = format!("{}/{}", DOWNLOADS_URL, joined);
        let resp: HashMap<String, Option<NpmDownloadPoint>> = self.http.get_json(&url).await?;
        Ok(resp
            .into_iter()
            .filter_map(|(k, v)| v.map(|p| (k, p.downloads)))
            .collect())
    }

    /// Fetch download count for a single package (scoped or unscoped)
    async fn fetch_single_download(&self, package: &str) -> Result<u64, SourceError> {
        let encoded = package.replace('/', "%2F");
        let url = format!("{}/{}", DOWNLOADS_URL, encoded);
        let resp: NpmDownloadPoint = self.http.get_json(&url).await?;
        Ok(resp.downloads)
    }
}

fn make_asset_id(package: &str) -> String {
    // Replace @ and / for asset_id: @babel/core -> npm_babel_core
    let sanitized = package
        .replace('@', "")
        .replace('/', "_");
    format!("npm_{}", sanitized)
}

fn is_scoped(package: &str) -> bool {
    package.starts_with('@')
}

fn parse_package_from_ref(api_ref: &str) -> Option<&str> {
    api_ref.strip_prefix("pkg:")
}

fn parse_package_from_asset_id(asset_id: &str) -> Option<&str> {
    asset_id.strip_prefix("npm_")
}

#[async_trait::async_trait]
impl MarketDataSource for NpmMarketSource {
    fn source_id(&self) -> &'static str {
        "npm"
    }

    fn display_name(&self) -> &'static str {
        "npm Package Downloads"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(1800) // 30 min — 1000 pkgs × 1.5s = ~15 min fetch time
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2550,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        info!("npm config is empty, performing live discovery");
        let packages = self
            .discover_packages(10_000)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover npm packages: {:?}", e))?;

        // Populate the package_name_cache so fetch_prices can resolve scoped names
        {
            let mut cache = self.package_name_cache.lock().unwrap_or_else(|e| e.into_inner());
            cache.clear();
            for (name, _) in &packages {
                cache.insert(make_asset_id(name), name.clone());
            }
            info!("npm package name cache populated with {} entries", cache.len());
        }

        let assets: Vec<AssetUpdate> = packages
            .iter()
            .map(|(name, desc)| {
                let display_name = if desc.is_empty() {
                    name.clone()
                } else {
                    let mut d = desc.clone();
                    if d.len() > 190 {
                        d.truncate(190);
                        d.push_str("...");
                    }
                    d
                };
                AssetUpdate {
                    asset_id: make_asset_id(name),
                    symbol: format!("NPM:{}", name),
                    name: display_name,
                    category: Some("sentiment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("pkg:{}", name),
                        "subcategory": "npm",
                        "active": true,
                        "extra": {},
                    }),
                }
            })
            .collect();

        info!("Discovered {} npm packages", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load api_ref lookup from static config (may be empty)
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        // Load the in-memory package name cache (populated by fetch_assets)
        let name_cache = self
            .package_name_cache
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        // Resolve asset_ids to package names using three strategies:
        // 1. Static JSON config api_ref (if populated)
        // 2. In-memory cache from fetch_assets() (handles scoped packages correctly)
        // 3. Fallback: parse from asset_id (only works for unscoped packages)
        let mut package_map: HashMap<String, String> = HashMap::new(); // package_name -> asset_id
        let mut unresolved = 0usize;
        for asset_id in asset_ids {
            let pkg = if let Some(api_ref) = ref_lookup.get(asset_id) {
                // Strategy 1: static config
                parse_package_from_ref(api_ref).map(|s| s.to_string())
            } else if let Some(cached_name) = name_cache.get(asset_id) {
                // Strategy 2: in-memory cache from fetch_assets (handles @scope/name)
                Some(cached_name.clone())
            } else {
                // Strategy 3: fallback parse from asset_id (only works for unscoped)
                parse_package_from_asset_id(asset_id).map(|s| s.to_string())
            };
            if let Some(pkg) = pkg {
                package_map.insert(pkg, asset_id.clone());
            } else {
                unresolved += 1;
                debug!("Cannot parse package name from: {}", asset_id);
            }
        }

        if unresolved > 0 {
            warn!("npm: {} asset_ids could not be resolved to package names", unresolved);
        }

        let mut results = Vec::new();
        let mut download_counts: HashMap<String, u64> = HashMap::new();

        // Separate scoped vs unscoped
        let (scoped, unscoped): (Vec<_>, Vec<_>) =
            package_map.keys().partition(|k| is_scoped(k));

        info!(
            "npm: fetching prices for {} unscoped + {} scoped packages",
            unscoped.len(),
            scoped.len()
        );

        // Bulk fetch unscoped packages in batches of 128
        for chunk in unscoped.chunks(BULK_BATCH_SIZE) {
            let refs: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            match self.fetch_bulk_downloads(&refs).await {
                Ok(counts) => download_counts.extend(counts),
                Err(e) => warn!("Bulk download fetch failed: {:?}", e),
            }
        }

        // Fetch scoped packages individually
        for pkg in &scoped {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            match self.fetch_single_download(pkg).await {
                Ok(count) => {
                    download_counts.insert(pkg.to_string(), count);
                }
                Err(e) => {
                    debug!("Failed to fetch downloads for {}: {:?}", pkg, e);
                }
            }
        }

        // Map downloads to PriceUpdate
        for (pkg, asset_id) in &package_map {
            if let Some(&count) = download_counts.get(pkg.as_str()) {
                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol: format!("NPM:{}", pkg),
                    value: Decimal::from(count),
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        info!(
            "Fetched {}/{} prices from npm ({} scoped, {} unscoped)",
            results.len(),
            asset_ids.len(),
            scoped.len(),
            unscoped.len(),
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering npm packages...");
        let packages = self
            .discover_packages(10_000)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover npm packages: {:?}", e))?;

        let entries: Vec<AssetEntry> = packages
            .iter()
            .map(|(name, desc)| {
                let display_name = if desc.is_empty() {
                    name.clone()
                } else {
                    let mut d = desc.clone();
                    if d.len() > 190 {
                        d.truncate(190);
                        d.push_str("...");
                    }
                    d
                };
                AssetEntry {
                    asset_id: make_asset_id(name),
                    symbol: format!("NPM:{}", name),
                    name: display_name,
                    category: "sentiment".to_string(),
                    subcategory: "npm".to_string(),
                    api_ref: format!("pkg:{}", name),
                    active: true,
                }
            })
            .collect();

        info!("Discovered {} npm packages", entries.len());
        Ok(entries)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENGAGEMENT
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
        assert_eq!(make_asset_id("react"), "npm_react");
        assert_eq!(make_asset_id("@babel/core"), "npm_babel_core");
        assert_eq!(make_asset_id("lodash"), "npm_lodash");
    }

    #[test]
    fn test_is_scoped() {
        assert!(is_scoped("@babel/core"));
        assert!(is_scoped("@types/node"));
        assert!(!is_scoped("react"));
        assert!(!is_scoped("lodash"));
    }

    #[test]
    fn test_parse_package_from_ref() {
        assert_eq!(parse_package_from_ref("pkg:react"), Some("react"));
        assert_eq!(parse_package_from_ref("pkg:@babel/core"), Some("@babel/core"));
        assert_eq!(parse_package_from_ref("invalid"), None);
    }

    #[test]
    fn test_package_name_cache_roundtrip() {
        // Verify that scoped packages survive the make_asset_id -> cache lookup roundtrip
        let scoped = "@babel/core";
        let asset_id = make_asset_id(scoped);
        assert_eq!(asset_id, "npm_babel_core");

        // Without cache, parse_package_from_asset_id gives wrong result
        assert_eq!(parse_package_from_asset_id(&asset_id), Some("babel_core"));

        // With cache, we get the correct name back
        let mut cache = HashMap::new();
        cache.insert(asset_id.clone(), scoped.to_string());
        assert_eq!(cache.get(&asset_id), Some(&scoped.to_string()));
    }

    #[test]
    fn test_unscoped_fallback_still_works() {
        // Unscoped packages work fine with parse_package_from_asset_id
        let unscoped = "react";
        let asset_id = make_asset_id(unscoped);
        assert_eq!(asset_id, "npm_react");
        assert_eq!(parse_package_from_asset_id(&asset_id), Some("react"));
    }
}
