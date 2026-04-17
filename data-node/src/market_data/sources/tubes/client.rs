//! Tube-site view-count tracker (pornhub, xvideos, xhamster, xnxx, redtube,
//! youporn, eporner, txxx).
//!
//! ## Architecture
//!
//! Data-node → lustpress (self-hosted, VPS 2) → upstream tube sites.
//!
//! Lustpress handles the Redis cache, Cloudflare back-off, and parsing of 8
//! tube sites. We poll it like any other HTTP JSON API. Every sync cycle
//! advances a rolling cursor through the asset list and fetches `BATCH_SIZE`
//! video view counts — same pattern Finnhub uses for 780 stocks.
//!
//! ## Why single-IP matters
//!
//! Tube sites are Cloudflare-protected. Bursts from one IP get an HTTP 429 or
//! an interstitial challenge; persistent offenders get a 24–72h IP ban. The
//! rolling-cursor + low rate limit keeps the upstream request rate flat.
//!
//! ## Feed design
//!
//! One asset per trending video. The value is current view count. Videos that
//! fall off the per-site trending list stop being refreshed and eventually
//! deactivate (same lifecycle as HackerNews top-500 / Twitch min-viewers).
//!
//! ## Env vars
//!
//! - `LUSTPRESS_BASE_URL` (required) — e.g. `http://10.2.0.2:3131`
//! - `TUBES_SITES` (optional, default all 8) — comma-separated subset
//! - `TUBES_PER_SITE` (optional, default 50) — trending videos per site
//! - `TUBES_BATCH_SIZE` (optional, default 20) — videos per sync cycle
//! - `TUBES_SYNC_INTERVAL_SECS` (optional, default 5) — pause between batches

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/tubes.json");

/// All sites supported by lustpress upstream.
const ALL_SITES: &[&str] = &[
    "pornhub", "xvideos", "xhamster", "xnxx", "redtube", "youporn", "eporner", "txxx",
];

/// Default trending count per site.
const DEFAULT_PER_SITE: usize = 50;

/// Default videos fetched per sync cycle (rolling batch).
const DEFAULT_BATCH_SIZE: usize = 20;

/// How often to refresh the trending list per site.
const TRENDING_REFRESH_HOURS: i64 = 6;

/// After this many hours of not being seen in trending, stop refreshing.
const DEACTIVATION_HOURS: i64 = 48;

// ============================================================================
// API RESPONSE TYPES (lustpress-compatible, loose schema)
// ============================================================================

/// Lustpress trending response — best-effort schema, unknown fields ignored.
#[derive(Debug, Deserialize)]
struct TrendingItem {
    /// Video ID as used by the upstream site (e.g. pornhub "viewkey")
    #[serde(alias = "viewkey", alias = "video_id", alias = "id")]
    id: String,
    /// Video title (optional — some lustpress endpoints omit it)
    #[serde(default, alias = "title", alias = "name")]
    title: Option<String>,
    /// Current view count, if included in the trending payload
    #[serde(default, alias = "views", alias = "view_count")]
    views: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct TrendingResponse {
    #[serde(alias = "results", alias = "videos", alias = "data")]
    items: Vec<TrendingItem>,
}

#[derive(Debug, Deserialize)]
struct VideoDetails {
    #[serde(default, alias = "views", alias = "view_count")]
    views: Option<u64>,
}

// ============================================================================
// INTERNAL STATE
// ============================================================================

/// Cached trending entry — we remember videos we've seen recently so they can
/// still be priced for a while after falling off trending.
#[derive(Clone, Debug)]
struct CachedVideo {
    site: &'static str,
    video_id: String,
    title: String,
    last_seen: DateTime<Utc>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct TubesMarketSource {
    http: SourceHttpClient,
    base_url: String,
    sites: Vec<&'static str>,
    per_site: usize,
    batch_size: usize,
    sync_interval_secs: u64,
    /// Rolling cursor across the asset list — Pattern D.
    batch_cursor: Mutex<usize>,
    /// Most recently seen videos per (site, id).
    video_cache: RwLock<HashMap<String, CachedVideo>>,
    /// When the trending list for a given site was last refreshed.
    trending_refreshed_at: RwLock<HashMap<&'static str, DateTime<Utc>>>,
}

impl TubesMarketSource {
    pub fn from_env() -> Result<Self> {
        let base_url =
            std::env::var("LUSTPRESS_BASE_URL").context("LUSTPRESS_BASE_URL not set")?;

        let sites: Vec<&'static str> = std::env::var("TUBES_SITES")
            .ok()
            .map(|s| {
                s.split(',')
                    .map(|t| t.trim().to_string())
                    .filter(|t| !t.is_empty())
                    .filter_map(|t| ALL_SITES.iter().find(|s| **s == t.as_str()).copied())
                    .collect::<Vec<_>>()
            })
            .filter(|v: &Vec<&'static str>| !v.is_empty())
            .unwrap_or_else(|| ALL_SITES.to_vec());

        let per_site = std::env::var("TUBES_PER_SITE")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_PER_SITE);

        let batch_size = std::env::var("TUBES_BATCH_SIZE")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_BATCH_SIZE);

        let sync_interval_secs = std::env::var("TUBES_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5);

        // Conservative rate limit to lustpress. Lustpress itself queues upstream.
        // Burning 20 req per 5s = 240 req/min against lustpress. Upstream
        // concurrency is capped by lustpress's MAX_CONCURRENT_REQUESTS.
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 240,
                duration: Duration::from_secs(60),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .user_agent("data-node/tubes (+lustpress)")
            .build()
            .context("build reqwest client")?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        info!(
            "Tubes source initialized: sites={:?} per_site={} batch_size={} interval={}s base={}",
            sites, per_site, batch_size, sync_interval_secs, base_url
        );

        Ok(Self {
            http,
            base_url,
            sites,
            per_site,
            batch_size,
            sync_interval_secs,
            batch_cursor: Mutex::new(0),
            video_cache: RwLock::new(HashMap::new()),
            trending_refreshed_at: RwLock::new(HashMap::new()),
        })
    }

    fn asset_id(site: &str, video_id: &str) -> String {
        format!("tubes_{}_{}", site, video_id)
    }

    fn symbol(site: &str, video_id: &str) -> String {
        format!("TUBE:{}:{}", site.to_uppercase(), video_id)
    }

    fn parse_asset_id(asset_id: &str) -> Option<(&'static str, String)> {
        let rest = asset_id.strip_prefix("tubes_")?;
        for site in ALL_SITES {
            if let Some(id) = rest.strip_prefix(&format!("{}_", site)) {
                return Some((site, id.to_string()));
            }
        }
        None
    }

    async fn fetch_trending(&self, site: &'static str) -> Result<Vec<TrendingItem>> {
        let url = format!(
            "{}/api/{}/trending?limit={}",
            self.base_url.trim_end_matches('/'),
            site,
            self.per_site
        );
        debug!("Tubes fetch_trending: {}", url);
        let resp: TrendingResponse = self.http.get_json(&url).await?;
        Ok(resp.items.into_iter().take(self.per_site).collect())
    }

    async fn fetch_video_views(&self, site: &str, video_id: &str) -> Result<Option<u64>> {
        let url = format!(
            "{}/api/{}/video?id={}",
            self.base_url.trim_end_matches('/'),
            site,
            urlencoding_encode(video_id)
        );
        match self.http.get_json::<VideoDetails>(&url).await {
            Ok(v) => Ok(v.views),
            Err(e) => {
                warn!("tubes {} {} fetch failed: {}", site, video_id, e);
                Ok(None)
            }
        }
    }

    async fn refresh_trending_if_stale(&self, site: &'static str) {
        let now = Utc::now();
        let needs_refresh = {
            let map = self.trending_refreshed_at.read().await;
            match map.get(site) {
                Some(ts) => now.signed_duration_since(*ts).num_hours() >= TRENDING_REFRESH_HOURS,
                None => true,
            }
        };
        if !needs_refresh {
            return;
        }
        match self.fetch_trending(site).await {
            Ok(items) => {
                let mut cache = self.video_cache.write().await;
                for item in &items {
                    let key = Self::asset_id(site, &item.id);
                    cache
                        .entry(key)
                        .and_modify(|v| v.last_seen = now)
                        .or_insert(CachedVideo {
                            site,
                            video_id: item.id.clone(),
                            title: item.title.clone().unwrap_or_default(),
                            last_seen: now,
                        });
                }
                drop(cache);
                self.trending_refreshed_at.write().await.insert(site, now);
                info!("tubes refreshed trending for {}: {} items", site, items.len());
            }
            Err(e) => warn!("tubes trending refresh failed for {}: {}", site, e),
        }
    }

    async fn prune_expired(&self) {
        let cutoff = Utc::now() - chrono::Duration::hours(DEACTIVATION_HOURS);
        let mut cache = self.video_cache.write().await;
        let before = cache.len();
        cache.retain(|_, v| v.last_seen > cutoff);
        let removed = before - cache.len();
        if removed > 0 {
            debug!("tubes pruned {} inactive videos", removed);
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TubesMarketSource {
    fn source_id(&self) -> &'static str {
        "tubes"
    }

    fn display_name(&self) -> &'static str {
        "Tube Video Views"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(self.sync_interval_secs)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 240,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // If a static list is configured, honor it (testing/override).
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Otherwise refresh trending per site.
        for site in &self.sites {
            self.refresh_trending_if_stale(site).await;
        }
        self.prune_expired().await;

        let cache = self.video_cache.read().await;
        let mut assets = Vec::with_capacity(cache.len());
        for (_asset_id, v) in cache.iter() {
            let name = if v.title.is_empty() {
                format!("{} {}", v.site, v.video_id)
            } else {
                format!(
                    "{} [{}]",
                    v.title.chars().take(80).collect::<String>(),
                    v.site
                )
            };
            assets.push(AssetUpdate {
                asset_id: Self::asset_id(v.site, &v.video_id),
                symbol: Self::symbol(v.site, &v.video_id),
                name,
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": v.video_id,
                    "subcategory": v.site,
                    "active": true,
                    "extra": {},
                }),
            });
        }
        info!("tubes registered {} trending videos across {} sites", assets.len(), self.sites.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }
        let total = asset_ids.len();

        // Advance the rolling cursor by batch_size. Same pattern as Finnhub.
        let (start, batch): (usize, Vec<String>) = {
            let mut cursor = self.batch_cursor.lock().unwrap();
            if *cursor >= total {
                *cursor = 0;
            }
            let start = *cursor;
            let end = (start + self.batch_size).min(total);
            let batch = asset_ids[start..end].to_vec();
            *cursor = if end >= total { 0 } else { end };
            (start, batch)
        };

        let now = Utc::now();
        let mut results = Vec::new();

        for asset_id in &batch {
            let Some((site, video_id)) = Self::parse_asset_id(asset_id) else {
                continue;
            };
            match self.fetch_video_views(site, &video_id).await {
                Ok(Some(views)) => {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: Self::symbol(site, &video_id),
                        value: Decimal::from(views),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Ok(None) => {}
                Err(e) => warn!("tubes price fetch error for {}: {}", asset_id, e),
            }
        }

        info!(
            "tubes fetched {}/{} (batch {}-{}/{} total)",
            results.len(),
            batch.len(),
            start,
            start + batch.len(),
            total
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        let mut entries = Vec::new();
        for site in &self.sites {
            match self.fetch_trending(site).await {
                Ok(items) => {
                    for item in items {
                        entries.push(AssetEntry {
                            asset_id: Self::asset_id(site, &item.id),
                            symbol: Self::symbol(site, &item.id),
                            name: item.title.unwrap_or_else(|| format!("{} {}", site, item.id)),
                            category: "sentiment".to_string(),
                            subcategory: (*site).to_string(),
                            api_ref: item.id.clone(),
                            active: true,
                        });
                    }
                }
                Err(e) => warn!("tubes discover failed for {}: {}", site, e),
            }
        }
        Ok(entries)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENGAGEMENT
    }
}

/// Minimal URL path-component encoder — avoids pulling a new crate dep.
/// Tube video IDs are `[a-zA-Z0-9_-]+` in practice so this is mostly a no-op.
fn urlencoding_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asset_id_roundtrip() {
        for site in ALL_SITES {
            let id = "abc123-xyz_def.456";
            let asset = TubesMarketSource::asset_id(site, id);
            let parsed = TubesMarketSource::parse_asset_id(&asset);
            assert_eq!(parsed, Some((*site, id.to_string())));
        }
    }

    #[test]
    fn rejects_wrong_prefix() {
        assert_eq!(TubesMarketSource::parse_asset_id("foo_pornhub_123"), None);
        assert_eq!(TubesMarketSource::parse_asset_id("tubes_unknown_123"), None);
    }

    #[test]
    fn urlencoding_preserves_safe_chars() {
        assert_eq!(urlencoding_encode("abcXYZ123-_.~"), "abcXYZ123-_.~");
    }

    #[test]
    fn urlencoding_escapes_unsafe() {
        assert_eq!(urlencoding_encode("a b&c"), "a%20b%26c");
    }

    #[test]
    fn all_sites_match_lustpress_support() {
        assert_eq!(ALL_SITES.len(), 8);
        assert!(ALL_SITES.contains(&"pornhub"));
        assert!(ALL_SITES.contains(&"txxx"));
    }
}
