//! GitHub API client implementing MarketDataSource
//!
//! Tracks repository star counts AND a derived stars-per-day velocity per
//! repository. The raw `stargazers_count` field asymptotes — a 10-year-old
//! project at 80k stars adds three a day; the cumulative number barely
//! moves. The companion `_velocity` asset measures the daily acceleration
//! and oscillates each cycle, giving the sync engine a metric that
//! actually breathes.
//!
//! Per repo we register two assets:
//!   - `gh_<owner>_<repo>`           — cumulative stargazers_count
//!   - `gh_<owner>_<repo>_velocity`  — stars/day, computed against a prior
//!                                     in-memory snapshot. Emitted only
//!                                     after a baseline exists.
//!
//! The velocity is normalized to a 24h window: `(now_stars - prior_stars)
//! * 86400 / elapsed_secs`. Negative values are clamped to zero — GitHub
//! occasionally returns lower counts after spam-account purges.
//!
//! API: https://api.github.com/repos/{owner}/{repo}
//! Auth: GITHUB_TOKEN (optional zero-scope PAT, free)
//!   - Authenticated: 5,000 req/hr = 833/10min
//!   - Unauthenticated: 60 req/hr = 10/10min (sufficient for ~669 repos with config)

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, BatchStrategy,
    MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

const ASSET_JSON: &str = include_str!("../../../config/github.json");
const API_URL: &str = "https://api.github.com";
const MAX_REPOS: usize = 700;
const SEARCH_PER_PAGE: usize = 100;
/// Unauthenticated rate limit: 60 req/hr = 10 req/10min, 85% = 8
const UNAUTH_RATE_LIMIT: u32 = 8;
/// Authenticated rate limit: 5000 req/hr = 833/10min, 85% = 708
const AUTH_RATE_LIMIT: u32 = 708;
const INTER_REQUEST_DELAY_MS: u64 = 850; // 708 calls in 600s ≈ 846ms each
const INTER_REQUEST_DELAY_UNAUTH_MS: u64 = 6500; // 8 calls in 600s ≈ 6s each

#[derive(Debug, Deserialize)]
struct SearchResponse {
    items: Vec<RepoInfo>,
    total_count: u64,
}

#[derive(Debug, Deserialize)]
struct RepoInfo {
    full_name: String,
    #[serde(default)]
    description: Option<String>,
    stargazers_count: u64,
    forks_count: u64,
    #[serde(default)]
    open_issues_count: u64,
    #[serde(default)]
    subscribers_count: Option<u64>,
}

pub struct GithubMarketSource {
    http: SourceHttpClient,
    /// None = unauthenticated (lower rate limits, public repos only)
    token: Option<String>,
    /// Set to true when a 401 is received, causing all subsequent requests
    /// to drop the Authorization header and use unauthenticated mode.
    auth_revoked: AtomicBool,
    /// Prior star snapshots keyed by primary asset_id. Used to derive the
    /// `_velocity` companion metric. The first cycle has no baseline — the
    /// velocity asset is silent until the second observation arrives.
    star_snapshots: Mutex<HashMap<String, (DateTime<Utc>, u64)>>,
}

impl GithubMarketSource {
    pub fn from_env() -> Result<Self> {
        let token = std::env::var("GITHUB_TOKEN").ok().filter(|t| !t.is_empty());

        // Always configure the HTTP client with unauth rate limits.
        // If the token turns out to be valid, we still respect the lower limit
        // which is safe (just slower). This avoids needing to reconfigure the
        // rate limiter at runtime when a token is revoked mid-cycle.
        let rate = if token.is_some() { AUTH_RATE_LIMIT } else { UNAUTH_RATE_LIMIT };
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: rate,
                duration: Duration::from_secs(600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        if token.is_some() {
            info!("GitHub source initialized (authenticated, {} req/10min)", rate);
        } else {
            warn!("GitHub source initialized WITHOUT token — using unauthenticated rate limits ({} req/10min). Set GITHUB_TOKEN for higher limits.", rate);
        }
        Ok(Self {
            http,
            token,
            auth_revoked: AtomicBool::new(false),
            star_snapshots: Mutex::new(HashMap::new()),
        })
    }

    /// Whether we're effectively unauthenticated (no token or token revoked)
    fn is_unauthenticated(&self) -> bool {
        self.token.is_none() || self.auth_revoked.load(Ordering::Relaxed)
    }

    /// Build common headers — includes Authorization only if token is set AND not revoked
    fn api_headers(&self) -> Vec<(&'static str, String)> {
        let mut headers = vec![
            ("Accept", "application/vnd.github+json".to_string()),
            ("User-Agent", "market-data-lib".to_string()),
            ("X-GitHub-Api-Version", "2022-11-28".to_string()),
        ];
        if let Some(ref token) = self.token {
            if !self.auth_revoked.load(Ordering::Relaxed) {
                headers.push(("Authorization", format!("Bearer {}", token)));
            }
        }
        headers
    }

    /// Build unauthenticated headers (no Authorization, even if token exists)
    fn unauth_headers(&self) -> Vec<(&'static str, String)> {
        vec![
            ("Accept", "application/vnd.github+json".to_string()),
            ("User-Agent", "market-data-lib".to_string()),
            ("X-GitHub-Api-Version", "2022-11-28".to_string()),
        ]
    }

    /// Mark the token as revoked and switch to unauthenticated mode
    fn revoke_token(&self) {
        if self.token.is_some() && !self.auth_revoked.load(Ordering::Relaxed) {
            warn!("GitHub token is invalid/expired (401) — falling back to unauthenticated mode (60 req/hr). Update GITHUB_TOKEN for higher rate limits.");
            self.auth_revoked.store(true, Ordering::Relaxed);
        }
    }

    fn inter_request_delay(&self) -> u64 {
        if self.is_unauthenticated() { INTER_REQUEST_DELAY_UNAUTH_MS } else { INTER_REQUEST_DELAY_MS }
    }

    /// Search for top repos by stars
    async fn search_top_repos(&self) -> Result<Vec<RepoInfo>, SourceError> {
        let mut all_repos = Vec::new();
        let pages_needed = (MAX_REPOS + SEARCH_PER_PAGE - 1) / SEARCH_PER_PAGE;

        // Search API max 1000 results (10 pages of 100)
        let pages_needed = pages_needed.min(10);

        for page in 1..=pages_needed {
            let url = format!(
                "{}/search/repositories?q=stars:>5000&sort=stars&order=desc&per_page={}&page={}",
                API_URL, SEARCH_PER_PAGE, page
            );

            // Search API: 30/min authenticated, 10/min unauthenticated
            let search_delay = if self.is_unauthenticated() { 6500 } else { 2100 };
            tokio::time::sleep(Duration::from_millis(search_delay)).await;

            let headers = self.api_headers();
            let header_refs: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();

            match self.http.get_json_with_headers::<SearchResponse>(
                &url,
                &header_refs,
            ).await {
                Ok(resp) => {
                    let count = resp.items.len();
                    all_repos.extend(resp.items);
                    if count < SEARCH_PER_PAGE {
                        break;
                    }
                }
                Err(SourceError::AuthFailed(_)) => {
                    // Token is expired/invalid — revoke it and retry this page unauthenticated
                    self.revoke_token();
                    tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_UNAUTH_MS)).await;

                    let headers = self.unauth_headers();
                    let header_refs: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();

                    match self.http.get_json_with_headers::<SearchResponse>(
                        &url,
                        &header_refs,
                    ).await {
                        Ok(resp) => {
                            let count = resp.items.len();
                            all_repos.extend(resp.items);
                            if count < SEARCH_PER_PAGE {
                                break;
                            }
                        }
                        Err(e) => {
                            warn!("GitHub search page {} failed (unauthenticated retry): {:?}", page, e);
                            break;
                        }
                    }
                }
                Err(e) => {
                    warn!("GitHub search page {} failed: {:?}", page, e);
                    break;
                }
            }
        }

        all_repos.truncate(MAX_REPOS);
        info!("Discovered {} GitHub repos via search", all_repos.len());
        Ok(all_repos)
    }

    /// Fetch a single repo's details, with automatic fallback to unauthenticated on 401
    async fn fetch_repo(&self, full_name: &str) -> Result<RepoInfo, SourceError> {
        let url = format!("{}/repos/{}", API_URL, full_name);
        let headers = self.api_headers();
        let header_refs: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();

        match self.http.get_json_with_headers::<RepoInfo>(&url, &header_refs).await {
            Ok(repo) => Ok(repo),
            Err(SourceError::AuthFailed(_)) if !self.is_unauthenticated() => {
                // Token just failed — revoke and retry without auth
                self.revoke_token();
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_UNAUTH_MS)).await;

                let headers = self.unauth_headers();
                let header_refs: Vec<(&str, &str)> = headers.iter().map(|(k, v)| (*k, v.as_str())).collect();
                self.http.get_json_with_headers(&url, &header_refs).await
            }
            Err(e) => Err(e),
        }
    }
}

/// Suffix applied to the companion stars-per-day asset_id.
const VELOCITY_SUFFIX: &str = "_velocity";

fn make_asset_id(full_name: &str) -> String {
    let sanitized = full_name.replace('/', "_").to_lowercase();
    format!("gh_{}", sanitized)
}

fn make_velocity_id(primary_id: &str) -> String {
    format!("{}{}", primary_id, VELOCITY_SUFFIX)
}

fn parse_repo_from_ref(api_ref: &str) -> Option<&str> {
    api_ref.strip_prefix("repo:")
}

/// Strip the velocity suffix and return the primary asset_id, if present.
fn primary_id_for_velocity(asset_id: &str) -> Option<&str> {
    asset_id.strip_suffix(VELOCITY_SUFFIX)
}

fn parse_repo_from_asset_id(asset_id: &str) -> Option<String> {
    // The velocity companion shares the repo identity of its primary —
    // strip the suffix before splitting owner/repo.
    let stem = primary_id_for_velocity(asset_id).unwrap_or(asset_id);
    let name = stem.strip_prefix("gh_")?;
    // Convert back: gh_facebook_react -> facebook/react (first underscore is /)
    let idx = name.find('_')?;
    Some(format!("{}/{}", &name[..idx], &name[idx + 1..]))
}

#[async_trait::async_trait]
impl MarketDataSource for GithubMarketSource {
    fn source_id(&self) -> &'static str {
        "github"
    }

    fn display_name(&self) -> &'static str {
        "GitHub Repositories"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        let rate = if self.is_unauthenticated() { UNAUTH_RATE_LIMIT } else { AUTH_RATE_LIMIT };
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: rate,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        info!("GitHub config is empty, performing live discovery");
        let repos = self
            .search_top_repos()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to search GitHub repos: {:?}", e))?;

        let mut assets: Vec<AssetUpdate> = Vec::with_capacity(repos.len() * 2);
        for r in &repos {
            let primary_id = make_asset_id(&r.full_name);
            let display_name: String = {
                let raw = r.description.clone().unwrap_or_else(|| r.full_name.clone());
                raw.chars().take(200).collect()
            };

            assets.push(AssetUpdate {
                asset_id: primary_id.clone(),
                symbol: format!("GH:{}", r.full_name),
                name: display_name.clone(),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("repo:{}", r.full_name),
                    "subcategory": "repositories",
                    "active": true,
                    "extra": {},
                }),
            });

            // Companion: stars/day. The cumulative count asymptotes; this
            // metric is what actually moves cycle to cycle.
            assets.push(AssetUpdate {
                asset_id: make_velocity_id(&primary_id),
                symbol: format!("GH:{}/d", r.full_name),
                name: format!("{} (stars/day)", r.full_name),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("repo_velocity:{}", r.full_name),
                    "subcategory": "repository_velocity",
                    "active": true,
                    "extra": {
                        "metric": "stars_per_day",
                        "primary_asset_id": primary_id,
                    },
                }),
            });
        }

        info!("Discovered {} GitHub assets ({} repos × 2 metrics)", assets.len(), repos.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load api_ref lookup. Velocity ids share the api_ref of their
        // primary, but the lookup is keyed by id — fall back to suffix
        // stripping when the velocity id isn't in the json (it usually
        // isn't, since github.json is empty in production).
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        // Dedupe by primary asset_id — one repo fetch can serve both the
        // primary and the velocity companion.
        let mut requested_primary: HashMap<String, String> = HashMap::new(); // primary_id -> full_name
        let mut requested_velocity: HashMap<String, String> = HashMap::new(); // primary_id -> full_name
        for asset_id in asset_ids {
            let (primary_id, full_name) = if let Some(primary) = primary_id_for_velocity(asset_id) {
                let full_name = ref_lookup
                    .get(asset_id)
                    .and_then(|r| r.strip_prefix("repo_velocity:").map(str::to_string))
                    .or_else(|| parse_repo_from_asset_id(asset_id));
                match full_name {
                    Some(n) => (primary.to_string(), n),
                    None => continue,
                }
            } else {
                let full_name = ref_lookup
                    .get(asset_id)
                    .and_then(|r| parse_repo_from_ref(r).map(str::to_string))
                    .or_else(|| parse_repo_from_asset_id(asset_id));
                match full_name {
                    Some(n) => (asset_id.clone(), n),
                    None => continue,
                }
            };

            if primary_id_for_velocity(asset_id).is_some() {
                requested_velocity.insert(primary_id, full_name);
            } else {
                requested_primary.insert(primary_id, full_name);
            }
        }

        // Union of primaries we need to fetch — every requested velocity
        // also needs its repo polled, even if the primary itself wasn't
        // explicitly requested this cycle.
        let mut to_fetch: HashMap<String, String> = HashMap::new();
        to_fetch.extend(requested_primary.clone());
        to_fetch.extend(requested_velocity.clone());

        let mut results = Vec::new();

        for (primary_id, full_name) in &to_fetch {
            tokio::time::sleep(Duration::from_millis(self.inter_request_delay())).await;

            match self.fetch_repo(full_name).await {
                Ok(repo) => {
                    let stars = repo.stargazers_count;

                    // Primary asset — preserves prior behavior verbatim.
                    if requested_primary.contains_key(primary_id) {
                        results.push(PriceUpdate {
                            asset_id: primary_id.clone(),
                            symbol: format!("GH:{}", full_name),
                            value: Decimal::from(stars),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: Some(Decimal::from(repo.forks_count)),
                            market_cap: Some(Decimal::from(repo.open_issues_count)),
                            fetched_at: now,
                        });
                    }

                    // Velocity companion. Compute against the prior
                    // snapshot, then update it. First observation has no
                    // baseline — silent until the second cycle. The
                    // engine deactivates orphans on its own schedule.
                    let prior = {
                        let mut snaps = match self.star_snapshots.lock() {
                            Ok(g) => g,
                            Err(p) => p.into_inner(), // poisoned — recover the map
                        };
                        let prior = snaps.get(primary_id).copied();
                        snaps.insert(primary_id.clone(), (now, stars));
                        prior
                    };

                    if requested_velocity.contains_key(primary_id) {
                        if let Some((prior_ts, prior_stars)) = prior {
                            let elapsed_secs = (now - prior_ts).num_seconds();
                            if elapsed_secs > 0 {
                                // i128 arithmetic to keep negative deltas
                                // honest; clamp at zero before writing.
                                let delta = stars as i128 - prior_stars as i128;
                                let velocity_per_day =
                                    (delta * 86_400) / (elapsed_secs as i128);
                                let value = if velocity_per_day < 0 {
                                    Decimal::ZERO
                                } else {
                                    Decimal::from(velocity_per_day as i64)
                                };
                                results.push(PriceUpdate {
                                    asset_id: make_velocity_id(primary_id),
                                    symbol: format!("GH:{}/d", full_name),
                                    value,
                                    prev_close: None,
                                    change_pct: None,
                                    volume_24h: None,
                                    market_cap: None,
                                    fetched_at: now,
                                });
                            }
                        }
                    }
                }
                Err(e) => {
                    debug!("Failed to fetch {}: {:?}", full_name, e);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from GitHub ({} repos polled)",
            results.len(),
            asset_ids.len(),
            to_fetch.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering GitHub repos...");
        let repos = self
            .search_top_repos()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to search GitHub repos: {:?}", e))?;

        let mut entries: Vec<AssetEntry> = Vec::with_capacity(repos.len() * 2);
        for r in &repos {
            let primary_id = make_asset_id(&r.full_name);
            let display_name: String = {
                let raw = r.description.clone().unwrap_or_else(|| r.full_name.clone());
                raw.chars().take(200).collect()
            };

            entries.push(AssetEntry {
                asset_id: primary_id.clone(),
                symbol: format!("GH:{}", r.full_name),
                name: display_name.clone(),
                category: "sentiment".to_string(),
                subcategory: "repositories".to_string(),
                api_ref: format!("repo:{}", r.full_name),
                active: true,
            });

            entries.push(AssetEntry {
                asset_id: make_velocity_id(&primary_id),
                symbol: format!("GH:{}/d", r.full_name),
                name: format!("{} (stars/day)", r.full_name),
                category: "sentiment".to_string(),
                subcategory: "repository_velocity".to_string(),
                api_ref: format!("repo_velocity:{}", r.full_name),
                active: true,
            });
        }

        info!("Discovered {} GitHub entries ({} repos × 2 metrics)", entries.len(), repos.len());
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
        assert_eq!(make_asset_id("facebook/react"), "gh_facebook_react");
        assert_eq!(make_asset_id("torvalds/linux"), "gh_torvalds_linux");
    }

    #[test]
    fn test_parse_repo_from_ref() {
        assert_eq!(
            parse_repo_from_ref("repo:facebook/react"),
            Some("facebook/react")
        );
        assert_eq!(parse_repo_from_ref("invalid"), None);
    }

    #[test]
    fn test_parse_repo_from_asset_id() {
        assert_eq!(
            parse_repo_from_asset_id("gh_facebook_react"),
            Some("facebook/react".to_string())
        );
        assert_eq!(
            parse_repo_from_asset_id("gh_torvalds_linux"),
            Some("torvalds/linux".to_string())
        );
        assert_eq!(parse_repo_from_asset_id("invalid"), None);
    }

    #[test]
    fn test_velocity_id_roundtrip() {
        let primary = make_asset_id("facebook/react");
        let velocity = make_velocity_id(&primary);
        assert_eq!(velocity, "gh_facebook_react_velocity");
        assert_eq!(primary_id_for_velocity(&velocity), Some(primary.as_str()));
        assert_eq!(primary_id_for_velocity(&primary), None);
    }

    #[test]
    fn test_parse_repo_from_velocity_asset_id() {
        // Velocity ids must resolve to the same owner/repo as their primary.
        assert_eq!(
            parse_repo_from_asset_id("gh_facebook_react_velocity"),
            Some("facebook/react".to_string())
        );
        assert_eq!(
            parse_repo_from_asset_id("gh_torvalds_linux_velocity"),
            Some("torvalds/linux".to_string())
        );
    }
}
