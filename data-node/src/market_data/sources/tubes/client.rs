//! Pornstar total-view tracker across tube sites.
//!
//! Tracks cumulative profile-level view counts for top-ranked performers on
//! pornhub, xvideos, xnxx, and eporner. Per-star aggregates move more
//! predictably than per-video counts, and the asset universe is stable for
//! weeks at a time — unlike trending video lists which churn daily.
//!
//! ## Two fetch patterns
//!
//! **Bulk-listing** (pornhub) — the listing page itself carries every star's
//! current view count in K/M/B-formatted markup. One page fetch = 120 stars
//! of view data. We simply re-fetch the listing pages every sync.
//!
//! **Per-profile** (xvideos, xnxx, eporner) — the listing only exposes
//! slugs; views live on each star's profile page. We use a rolling cursor
//! exactly like Finnhub: the sync engine calls `fetch_prices()` often, each
//! call advances through BATCH_SIZE stars, full cycle completes in minutes.
//!
//! ## Feed design
//!
//! One feed per star: current profile-level view count as a decimal integer.
//! Bigger numbers than per-video (50M–5B typical), meaningful weekly delta.
//!
//! ## Env vars
//!
//! - `TUBES_SITES` — comma-separated subset of supported sites. Default: all 4.
//! - `TUBES_TOP_N` — number of top-ranked stars to track per site. Default: 20.
//! - `TUBES_PH_PAGES` — listing pages to crawl for Pornhub. Default: 1
//!   (top 120; the first `TUBES_TOP_N` are kept).
//! - `TUBES_PROFILE_BATCH` — stars per sync for profile sites. Default: 10.
//! - `TUBES_SYNC_INTERVAL_SECS` — pause between batches. Default: 5.
//! - `TUBES_LISTING_REFRESH_HOURS` — how often to re-discover the star list.
//!   Default: 24.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use regex::Regex;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/tubes.json");

/// Supported sites with their URL templates and parser kind.
#[derive(Debug, Clone, Copy)]
struct SiteSpec {
    id: &'static str,
    listing_url_template: &'static str, // {page} placeholder where applicable
    strategy: FetchStrategy,
    profile_url_template: &'static str, // {slug} placeholder; unused for BulkListing
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FetchStrategy {
    /// Listing page carries view counts in bulk — no per-profile fetch needed.
    BulkListing,
    /// Listing gives slugs, views come from profile page.
    PerProfile,
}

const SITES: &[SiteSpec] = &[
    SiteSpec {
        id: "pornhub",
        listing_url_template: "https://www.pornhub.com/pornstars?o=t&page={page}",
        strategy: FetchStrategy::BulkListing,
        profile_url_template: "https://www.pornhub.com/pornstar/{slug}",
    },
    SiteSpec {
        id: "xvideos",
        listing_url_template: "https://www.xvideos.com/pornstars/{page}",
        strategy: FetchStrategy::PerProfile,
        profile_url_template: "https://www.xvideos.com/pornstars/{slug}",
    },
    SiteSpec {
        id: "xnxx",
        listing_url_template: "https://www.xnxx.com/pornstars/{page}",
        strategy: FetchStrategy::PerProfile,
        profile_url_template: "https://www.xnxx.com{slug}",
    },
    SiteSpec {
        id: "eporner",
        listing_url_template: "https://www.eporner.com/pornstars/{page}/",
        strategy: FetchStrategy::PerProfile,
        profile_url_template: "https://www.eporner.com{slug}",
    },
];

/// Cached star entry. Views field may be stale if listing hasn't been
/// refreshed recently; the pricing path keeps it current.
#[derive(Clone, Debug)]
struct CachedStar {
    site: &'static str,
    slug: String,
    name: String,
    views: u64,
    last_seen: DateTime<Utc>,
}

fn find_site(id: &str) -> Option<&'static SiteSpec> {
    SITES.iter().find(|s| s.id == id)
}

// ============================================================================
// REGEXES — compiled once, reused.
// ============================================================================

/// Pornhub listing — each card block.
///
/// `<a href="/pornstar/valentina-nappi" ... `Valentina Nappi` ...
/// `<div class="viewsCount performerCount">546M`
fn ph_card_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(
            r#"(?s)href="/pornstar/([a-z0-9\-_]+)"[^>]*>.*?<a[^>]*class="performerName"[^>]*>\s*([^<]+?)\s*</a>.*?class="viewsCount performerCount">\s*([\d.]+[KMB]?)"#,
        )
        .expect("ph_card_re compile")
    })
}

/// Xvideos profile — the raw integer sitting inside a desktop-only span.
/// `<span class="mobile-hide">630,931,214</span><span ...>630.9M</span> video views`
fn xv_profile_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"<span class="mobile-hide">([\d,]+)</span>[^<]*<span[^>]*>[^<]+</span>\s*video views"#)
            .expect("xv_profile_re compile")
    })
}

/// Xvideos listing — pornstar profile slugs.
fn xv_listing_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"href="/pornstars/([a-zA-Z0-9_\-\.]+)""#).expect("xv_listing_re")
    })
}

/// XNXX profile — 23,834,854 video views.
fn xn_profile_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"class="views">\s*<span[^>]*></span>\s*([\d,]+)\s*video views"#)
            .expect("xn_profile_re")
    })
}

/// XNXX listing — pornstar links (path form).
fn xn_listing_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"href="(/pornstar/[^"]+)""#).expect("xn_listing_re"))
}

/// Eporner profile — Video views:<span>184,480,949</span>.
fn ep_profile_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"Video views:<span>([\d,]+)</span>"#).expect("ep_profile_re")
    })
}

/// Eporner listing — pornstar link paths.
fn ep_listing_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"href="(/pornstar/[^"]+)""#).expect("ep_listing_re"))
}

/// Parse a K/M/B-suffixed string into an integer. "546M" → 546_000_000.
pub(crate) fn parse_scaled_count(raw: &str) -> Option<u64> {
    let s = raw.trim();
    let (num_part, mult): (&str, u64) = if let Some(stripped) = s.strip_suffix('B') {
        (stripped, 1_000_000_000)
    } else if let Some(stripped) = s.strip_suffix('M') {
        (stripped, 1_000_000)
    } else if let Some(stripped) = s.strip_suffix('K') {
        (stripped, 1_000)
    } else {
        (s, 1)
    };
    let cleaned: String = num_part.chars().filter(|c| *c != ',').collect();
    let n: f64 = cleaned.parse().ok()?;
    Some((n * mult as f64) as u64)
}

// ============================================================================
// SOURCE
// ============================================================================

pub struct TubesMarketSource {
    http: SourceHttpClient,
    sites: Vec<&'static SiteSpec>,
    top_n: usize,
    ph_pages: u32,
    profile_batch: usize,
    sync_interval_secs: u64,
    listing_refresh_hours: i64,
    /// Cursor used only for PerProfile sites.
    batch_cursor: Mutex<usize>,
    /// site → last listing refresh time.
    listing_refreshed_at: RwLock<HashMap<&'static str, DateTime<Utc>>>,
    /// asset_id → cached star data.
    stars: RwLock<HashMap<String, CachedStar>>,
}

impl TubesMarketSource {
    pub fn from_env() -> Result<Self> {
        let sites: Vec<&'static SiteSpec> = std::env::var("TUBES_SITES")
            .ok()
            .map(|s| {
                s.split(',')
                    .map(|t| t.trim().to_string())
                    .filter(|t| !t.is_empty())
                    .filter_map(|t| find_site(t.as_str()))
                    .collect::<Vec<_>>()
            })
            .filter(|v: &Vec<_>| !v.is_empty())
            .unwrap_or_else(|| SITES.iter().collect());

        let top_n = std::env::var("TUBES_TOP_N")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(20);
        let ph_pages = std::env::var("TUBES_PH_PAGES")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(1);
        let profile_batch = std::env::var("TUBES_PROFILE_BATCH")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(10);
        let sync_interval_secs = std::env::var("TUBES_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(5);
        let listing_refresh_hours = std::env::var("TUBES_LISTING_REFRESH_HOURS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(24);

        // ~4 rps against the combined upstreams; each site sees fewer.
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 240,
                duration: Duration::from_secs(60),
            }],
        };
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .user_agent(
                "Mozilla/5.0 (compatible; data-node/tubes; +https://generalmarket.io)",
            )
            .build()
            .context("build reqwest client")?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        info!(
            "Tubes source initialized: sites={:?} top_n={} ph_pages={} profile_batch={} interval={}s refresh_h={}",
            sites.iter().map(|s| s.id).collect::<Vec<_>>(),
            top_n,
            ph_pages,
            profile_batch,
            sync_interval_secs,
            listing_refresh_hours
        );

        Ok(Self {
            http,
            sites,
            top_n,
            ph_pages,
            profile_batch,
            sync_interval_secs,
            listing_refresh_hours,
            batch_cursor: Mutex::new(0),
            listing_refreshed_at: RwLock::new(HashMap::new()),
            stars: RwLock::new(HashMap::new()),
        })
    }

    fn asset_id(site: &str, slug: &str) -> String {
        format!("tubes_{}_star_{}", site, slug.replace('/', ""))
    }

    fn parse_asset_id(asset_id: &str) -> Option<(&'static SiteSpec, String)> {
        let rest = asset_id.strip_prefix("tubes_")?;
        for s in SITES {
            let prefix = format!("{}_star_", s.id);
            if let Some(slug) = rest.strip_prefix(&prefix) {
                return Some((s, slug.to_string()));
            }
        }
        None
    }

    fn symbol(site: &str, slug: &str) -> String {
        format!("TUBE:{}:{}", site.to_uppercase(), slug)
    }

    // ---- Pornhub — listing carries view counts ---------------------------

    async fn fetch_pornhub_listing(&self) -> Result<Vec<CachedStar>> {
        let mut stars = Vec::new();
        let now = Utc::now();
        for page in 1..=self.ph_pages {
            let url = SITES[0]
                .listing_url_template
                .replace("{page}", &page.to_string());
            let html = match self.http.get_raw(&url).await {
                Ok(h) => h,
                Err(e) => {
                    warn!("pornhub listing page {} failed: {}", page, e);
                    continue;
                }
            };
            for caps in ph_card_re().captures_iter(&html) {
                let slug = caps[1].to_string();
                let name = caps[2].trim().to_string();
                let views_raw = caps[3].to_string();
                if let Some(views) = parse_scaled_count(&views_raw) {
                    stars.push(CachedStar {
                        site: "pornhub",
                        slug,
                        name,
                        views,
                        last_seen: now,
                    });
                }
                if stars.len() >= self.top_n {
                    break;
                }
            }
            if stars.len() >= self.top_n {
                break;
            }
        }
        stars.truncate(self.top_n);
        debug!("pornhub listing parsed {} stars (top_n={})", stars.len(), self.top_n);
        Ok(stars)
    }

    // ---- Per-profile sites — listing gives slugs only --------------------

    async fn fetch_profile_listing_slugs(
        &self,
        site: &'static SiteSpec,
    ) -> Result<Vec<(String, String)>> {
        // Only page 1 for the profile-fetch sites; profile calls are the
        // expensive thing, not discovery. Adding pagination can come later.
        let url = site.listing_url_template.replace("{page}", "1");
        let html = self.http.get_raw(&url).await?;
        let results: Vec<(String, String)> = match site.id {
            "xvideos" => xv_listing_re()
                .captures_iter(&html)
                .map(|c| (c[1].to_string(), c[1].to_string()))
                .collect(),
            "xnxx" => xn_listing_re()
                .captures_iter(&html)
                .map(|c| {
                    let path = c[1].to_string();
                    let slug = path.trim_start_matches("/pornstar/").to_string();
                    (slug, path)
                })
                .collect(),
            "eporner" => ep_listing_re()
                .captures_iter(&html)
                .map(|c| {
                    let path = c[1].to_string();
                    let slug = path.trim_start_matches("/pornstar/").trim_end_matches('/').to_string();
                    (slug, path)
                })
                .collect(),
            _ => Vec::new(),
        };

        let mut seen = std::collections::HashSet::new();
        let deduped: Vec<_> = results
            .into_iter()
            .filter(|(slug, _)| seen.insert(slug.clone()))
            .take(self.top_n)
            .collect();
        debug!("{} listing parsed {} slugs (top_n={})", site.id, deduped.len(), self.top_n);
        Ok(deduped)
    }

    async fn fetch_profile_views(
        &self,
        site: &'static SiteSpec,
        slug: &str,
    ) -> Result<Option<u64>> {
        // slug for xvideos is a name; for xnxx/eporner we stored the URL path.
        let url = match site.id {
            "xvideos" => site.profile_url_template.replace("{slug}", slug),
            "xnxx" | "eporner" => {
                // We stored the path form in the slug for these two.
                let path = if slug.starts_with('/') {
                    slug.to_string()
                } else {
                    format!("/pornstar/{}", slug)
                };
                site.profile_url_template.replace("{slug}", &path)
            }
            _ => return Ok(None),
        };
        let html = match self.http.get_raw(&url).await {
            Ok(h) => h,
            Err(e) => {
                warn!("{} profile fetch {} failed: {}", site.id, slug, e);
                return Ok(None);
            }
        };
        let re = match site.id {
            "xvideos" => xv_profile_re(),
            "xnxx" => xn_profile_re(),
            "eporner" => ep_profile_re(),
            _ => return Ok(None),
        };
        let Some(caps) = re.captures(&html) else {
            return Ok(None);
        };
        let raw = caps.get(1).map(|m| m.as_str()).unwrap_or("");
        Ok(parse_scaled_count(raw))
    }

    // ---- Cache management -----------------------------------------------

    async fn refresh_listings_if_stale(&self) {
        let now = Utc::now();
        let cutoff_hours = self.listing_refresh_hours;
        for site in &self.sites {
            let needs = {
                let map = self.listing_refreshed_at.read().await;
                map.get(site.id)
                    .map(|ts| now.signed_duration_since(*ts).num_hours() >= cutoff_hours)
                    .unwrap_or(true)
            };
            if !needs {
                continue;
            }
            let discovered: Vec<CachedStar> = match site.strategy {
                FetchStrategy::BulkListing => self.fetch_pornhub_listing().await.unwrap_or_default(),
                FetchStrategy::PerProfile => {
                    let slugs = self
                        .fetch_profile_listing_slugs(site)
                        .await
                        .unwrap_or_default();
                    // For PerProfile sites we don't have views yet — views
                    // get filled in by fetch_prices().
                    slugs
                        .into_iter()
                        .map(|(slug, _)| CachedStar {
                            site: site.id,
                            slug,
                            name: String::new(),
                            views: 0,
                            last_seen: now,
                        })
                        .collect()
                }
            };
            if discovered.is_empty() {
                warn!("{} listing refresh returned 0 stars", site.id);
                continue;
            }
            let mut cache = self.stars.write().await;
            for s in discovered {
                let key = Self::asset_id(s.site, &s.slug);
                cache
                    .entry(key)
                    .and_modify(|existing| {
                        existing.last_seen = now;
                        if !s.name.is_empty() {
                            existing.name = s.name.clone();
                        }
                        if s.views > 0 {
                            existing.views = s.views;
                        }
                    })
                    .or_insert(s);
            }
            drop(cache);
            self.listing_refreshed_at.write().await.insert(site.id, now);
            info!("{} listing refreshed", site.id);
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TubesMarketSource {
    fn source_id(&self) -> &'static str {
        "tubes"
    }

    fn display_name(&self) -> &'static str {
        "Tube Pornstar Views"
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
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        self.refresh_listings_if_stale().await;

        let cache = self.stars.read().await;
        let mut out = Vec::with_capacity(cache.len());
        for (_id, s) in cache.iter() {
            let display_name = if s.name.is_empty() {
                format!("{} [{}]", s.slug, s.site)
            } else {
                format!("{} [{}]", s.name, s.site)
            };
            out.push(AssetUpdate {
                asset_id: Self::asset_id(s.site, &s.slug),
                symbol: Self::symbol(s.site, &s.slug),
                name: display_name,
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": s.slug,
                    "subcategory": s.site,
                    "active": true,
                    "extra": {},
                }),
            });
        }
        info!(
            "tubes registered {} stars across {} sites",
            out.len(),
            self.sites.len()
        );
        Ok(out)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results: Vec<PriceUpdate> = Vec::new();

        // ---- Pornhub: re-fetch listing pages, harvest views in bulk -----
        let ph_enabled = self.sites.iter().any(|s| s.id == "pornhub");
        if ph_enabled {
            let live = self.fetch_pornhub_listing().await.unwrap_or_default();
            let mut by_slug: HashMap<String, (String, u64)> = HashMap::new();
            for s in &live {
                by_slug.insert(s.slug.clone(), (s.name.clone(), s.views));
            }
            let mut cache = self.stars.write().await;
            for asset_id in asset_ids {
                let Some((site, slug)) = Self::parse_asset_id(asset_id) else {
                    continue;
                };
                if site.id != "pornhub" {
                    continue;
                }
                if let Some((name, views)) = by_slug.get(&slug) {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: Self::symbol(site.id, &slug),
                        value: Decimal::from(*views),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                    cache
                        .entry(asset_id.clone())
                        .and_modify(|e| {
                            e.views = *views;
                            e.name = name.clone();
                            e.last_seen = now;
                        });
                }
            }
        }

        // ---- Per-profile sites: rolling cursor over profile URLs --------
        let profile_ids: Vec<&String> = asset_ids
            .iter()
            .filter(|id| {
                Self::parse_asset_id(id)
                    .map(|(site, _)| site.strategy == FetchStrategy::PerProfile)
                    .unwrap_or(false)
            })
            .collect();

        if !profile_ids.is_empty() {
            let total = profile_ids.len();
            let (start, batch): (usize, Vec<String>) = {
                let mut cursor = self.batch_cursor.lock().unwrap();
                if *cursor >= total {
                    *cursor = 0;
                }
                let start = *cursor;
                let end = (start + self.profile_batch).min(total);
                let batch: Vec<String> =
                    profile_ids[start..end].iter().map(|s| (*s).clone()).collect();
                *cursor = if end >= total { 0 } else { end };
                (start, batch)
            };

            for asset_id in &batch {
                let Some((site, slug)) = Self::parse_asset_id(asset_id) else {
                    continue;
                };
                match self.fetch_profile_views(site, &slug).await {
                    Ok(Some(views)) => {
                        results.push(PriceUpdate {
                            asset_id: asset_id.clone(),
                            symbol: Self::symbol(site.id, &slug),
                            value: Decimal::from(views),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                        let mut cache = self.stars.write().await;
                        cache
                            .entry(asset_id.clone())
                            .and_modify(|e| {
                                e.views = views;
                                e.last_seen = now;
                            });
                    }
                    Ok(None) => {}
                    Err(e) => warn!("profile price error for {}: {}", asset_id, e),
                }
            }

            info!(
                "tubes profile batch: {}/{} (cursor {}-{}/{})",
                results.len(),
                batch.len(),
                start,
                start + batch.len(),
                total
            );
        }

        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        self.refresh_listings_if_stale().await;
        let cache = self.stars.read().await;
        let mut entries = Vec::with_capacity(cache.len());
        for (_id, s) in cache.iter() {
            entries.push(AssetEntry {
                asset_id: Self::asset_id(s.site, &s.slug),
                symbol: Self::symbol(s.site, &s.slug),
                name: if s.name.is_empty() {
                    s.slug.clone()
                } else {
                    s.name.clone()
                },
                category: "sentiment".to_string(),
                subcategory: s.site.to_string(),
                api_ref: s.slug.clone(),
                active: true,
            });
        }
        Ok(entries)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENGAGEMENT
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_scaled_handles_all_suffixes() {
        assert_eq!(parse_scaled_count("546M"), Some(546_000_000));
        assert_eq!(parse_scaled_count("1.2B"), Some(1_200_000_000));
        assert_eq!(parse_scaled_count("75K"), Some(75_000));
        assert_eq!(parse_scaled_count("23,834,854"), Some(23_834_854));
        assert_eq!(parse_scaled_count("42"), Some(42));
        assert_eq!(parse_scaled_count("not a number"), None);
    }

    #[test]
    fn asset_id_roundtrip_per_site() {
        for site in SITES {
            let id = TubesMarketSource::asset_id(site.id, "kate_rich");
            let parsed = TubesMarketSource::parse_asset_id(&id);
            let (got_site, slug) = parsed.expect("parseable");
            assert_eq!(got_site.id, site.id);
            assert_eq!(slug, "kate_rich");
        }
    }

    #[test]
    fn rejects_wrong_prefix() {
        assert!(TubesMarketSource::parse_asset_id("tubes_unknown_star_xyz").is_none());
        assert!(TubesMarketSource::parse_asset_id("foo_pornhub_star_xyz").is_none());
        // Old video-format ID should no longer parse.
        assert!(TubesMarketSource::parse_asset_id("tubes_pornhub_abc123").is_none());
    }

    #[test]
    fn ph_card_parses_real_fixture() {
        let sample = r#"
            <li class="performerCard">
                <a href="/pornstar/valentina-nappi">
                <span class="rankNumber">30</span>
                <a href="/pornstar/valentina-nappi" class="performerName">
                    Valentina Nappi
                </a>
                <div class="videosCount performerCount">919<span>Videos</span></div>
                <div class="viewsCount performerCount">546M<span>Views</span></div>
            </li>
        "#;
        let cap = ph_card_re().captures(sample).expect("match");
        assert_eq!(&cap[1], "valentina-nappi");
        assert_eq!(cap[2].trim(), "Valentina Nappi");
        assert_eq!(&cap[3], "546M");
    }

    #[test]
    fn xv_profile_parses_real_fixture() {
        let sample = r#"<small class="mobile-only-hide"><span class="mobile-hide">630,931,214</span><span class="mobile-show-inline">630.9M</span> video views</small>"#;
        let cap = xv_profile_re().captures(sample).expect("match");
        assert_eq!(&cap[1], "630,931,214");
        assert_eq!(parse_scaled_count(&cap[1]), Some(630_931_214));
    }

    #[test]
    fn xn_profile_parses_real_fixture() {
        let sample = r#"<p class="views">
<span class="icon-f icf-eye"></span> 23,834,854 video views
</p>"#;
        let cap = xn_profile_re().captures(sample).expect("match");
        assert_eq!(&cap[1], "23,834,854");
    }

    #[test]
    fn ep_profile_parses_real_fixture() {
        let sample = r#"<div>Video views:<span>184,480,949</span></div>"#;
        let cap = ep_profile_re().captures(sample).expect("match");
        assert_eq!(&cap[1], "184,480,949");
    }

    #[test]
    fn sites_list_non_empty() {
        assert_eq!(SITES.len(), 4);
        assert!(find_site("pornhub").is_some());
        assert!(find_site("bogus").is_none());
    }
}
