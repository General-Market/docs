//! GitHub API client implementing MarketDataSource
//!
//! Tracks repository star counts for the most popular open-source projects.
//! Discovery via search API (sorted by stars), prices via individual repo calls.
//!
//! API: https://api.github.com/repos/{owner}/{repo}
//! Auth: GITHUB_TOKEN (optional zero-scope PAT, free)
//!   - Authenticated: 5,000 req/hr = 833/10min
//!   - Unauthenticated: 60 req/hr = 10/10min (sufficient for ~669 repos with config)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource,
    PriceUpdate,
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

fn make_asset_id(full_name: &str) -> String {
    let sanitized = full_name.replace('/', "_").to_lowercase();
    format!("gh_{}", sanitized)
}

fn parse_repo_from_ref(api_ref: &str) -> Option<&str> {
    api_ref.strip_prefix("repo:")
}

fn parse_repo_from_asset_id(asset_id: &str) -> Option<String> {
    let name = asset_id.strip_prefix("gh_")?;
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

        let assets: Vec<AssetUpdate> = repos
            .iter()
            .map(|r| AssetUpdate {
                asset_id: make_asset_id(&r.full_name),
                symbol: format!("GH:{}", r.full_name),
                name: {
                    let raw = r.description.clone().unwrap_or_else(|| r.full_name.clone());
                    raw.chars().take(200).collect()
                },
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("repo:{}", r.full_name),
                    "subcategory": "repositories",
                    "active": true,
                    "extra": {},
                }),
            })
            .collect();

        info!("Discovered {} GitHub repos", assets.len());
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
            let full_name = if let Some(api_ref) = ref_lookup.get(asset_id) {
                parse_repo_from_ref(api_ref).map(|s| s.to_string())
            } else {
                parse_repo_from_asset_id(asset_id)
            };

            let full_name = match full_name {
                Some(n) => n,
                None => {
                    debug!("Cannot parse repo from: {}", asset_id);
                    continue;
                }
            };

            tokio::time::sleep(Duration::from_millis(self.inter_request_delay())).await;

            match self.fetch_repo(&full_name).await {
                Ok(repo) => {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: format!("GH:{}", full_name),
                        value: Decimal::from(repo.stargazers_count),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: Some(Decimal::from(repo.forks_count)),
                        market_cap: Some(Decimal::from(repo.open_issues_count)),
                        fetched_at: now,
                    });
                }
                Err(e) => {
                    debug!("Failed to fetch {}: {:?}", full_name, e);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from GitHub",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering GitHub repos...");
        let repos = self
            .search_top_repos()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to search GitHub repos: {:?}", e))?;

        let entries: Vec<AssetEntry> = repos
            .iter()
            .map(|r| AssetEntry {
                asset_id: make_asset_id(&r.full_name),
                symbol: format!("GH:{}", r.full_name),
                name: {
                    let raw = r.description.clone().unwrap_or_else(|| r.full_name.clone());
                    raw.chars().take(200).collect()
                },
                category: "sentiment".to_string(),
                subcategory: "repositories".to_string(),
                api_ref: format!("repo:{}", r.full_name),
                active: true,
            })
            .collect();

        info!("Discovered {} GitHub repos", entries.len());
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
}
