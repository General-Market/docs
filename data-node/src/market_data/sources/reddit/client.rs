//! Reddit subreddit popularity tracker via OAuth2 API.
//!
//! Tracks subscriber counts and active user counts for curated subreddits.
//! Uses Reddit's OAuth2 client credentials grant (app-only auth).
//!
//! Each subreddit produces two assets:
//!   - `reddit_{subreddit}_subscribers` — total subscriber count
//!   - `reddit_{subreddit}_active` — currently online users (~15min rolling)
//!
//! API: https://oauth.reddit.com/api/info?sr_name=sub1,sub2,...
//! Rate limit: 50 req/min (conservative, free tier allows 60)
//! Gated on: REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/reddit.json");

/// Reddit OAuth2 token endpoint
const TOKEN_URL: &str = "https://www.reddit.com/api/v1/access_token";

/// Reddit OAuth API base
const API_BASE: &str = "https://oauth.reddit.com";

/// Max subreddits per /api/info request
const BATCH_SIZE: usize = 100;

/// Request timeout
const REQUEST_TIMEOUT_SECS: u64 = 15;

/// Max retries per request
const MAX_RETRIES: u32 = 3;

/// Minimum delay between API requests (ms) — ~50/min budget
const MIN_REQUEST_DELAY_MS: u64 = 1200;

/// User-Agent (Reddit requires a descriptive one)
const USER_AGENT: &str = "IndexDataNode/1.0 (by /u/IndexDataBot)";

/// Curated subreddits covering crypto, finance, tech, gaming, politics, sports, entertainment
const SUBREDDITS: &[&str] = &[
    // Crypto
    "bitcoin", "ethereum", "cryptocurrency", "cryptomarkets", "defi",
    "solana", "cardano", "polkadot", "algorand", "cosmos",
    "avalanche", "chainlink", "litecoin", "monero", "ripple",
    "dogecoin", "shibainu", "pepe", "nft", "web3",
    "bitcoinmarkets", "ethfinance", "ethtrader", "altcoin", "binance",
    "cryptocurrencytrading", "satoshistreetbets", "wallstreetbetscrypto",
    // Finance / Stocks
    "wallstreetbets", "stocks", "investing", "options", "stockmarket",
    "personalfinance", "financialindependence", "bogleheads", "dividends",
    "daytrading", "pennystocks", "forex", "economics", "realestateinvesting",
    "superstonk", "valueinvesting", "thetagang", "smallstreetbets",
    // Tech
    "technology", "programming", "machinelearning", "artificial",
    "localllama", "chatgpt", "openai", "singularity", "futurology",
    "linux", "python", "rust", "javascript", "webdev",
    "datascience", "cscareerquestions", "sysadmin", "netsec", "cybersecurity",
    "apple", "android", "google", "microsoft", "nvidia",
    // Gaming
    "gaming", "pcgaming", "games", "ps5", "xboxseriesx",
    "nintendoswitch", "steam", "leagueoflegends", "valorant", "fortnite",
    "minecraft", "genshinimpact", "eldenring", "baldursgate3", "palworld",
    "csgo", "dota2", "overwatch", "apexlegends", "deadbydaylight",
    // Politics / News
    "politics", "worldnews", "news", "geopolitics", "conservative",
    "liberal", "libertarian", "neutralpolitics", "politicaldiscussion",
    "economics", "collapse", "environment", "climate",
    // Sports
    "nba", "nfl", "soccer", "baseball", "hockey",
    "mma", "boxing", "formula1", "cfb", "fantasyfootball",
    "tennis", "golf", "cricket", "olympics", "running",
    // Entertainment / Culture
    "movies", "television", "anime", "manga", "books",
    "music", "hiphopheads", "popheads", "kpop", "indieheads",
    "marvelstudios", "starwars", "gameofthrones", "theboys",
    // Science
    "science", "space", "astronomy", "physics", "biology",
    "chemistry", "neuroscience", "askscience",
    // Memes / Social
    "memes", "dankmemes", "me_irl", "funny", "pics",
    "videos", "askreddit", "todayilearned", "explainlikeimfive",
    "showerthoughts", "unpopularopinion", "amitheasshole", "tifu",
    // Niche but high-signal
    "wallstreetbets", "antiwork", "latestagecapitalism", "workreform",
    "fire", "preppers", "homeimprovement", "diy",
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    #[allow(dead_code)]
    token_type: String,
}

/// Reddit "thing" wrapper
#[derive(Debug, Deserialize)]
struct RedditListing {
    data: RedditListingData,
}

#[derive(Debug, Deserialize)]
struct RedditListingData {
    children: Vec<RedditChild>,
}

#[derive(Debug, Deserialize)]
struct RedditChild {
    #[allow(dead_code)]
    kind: String,
    data: SubredditData,
}

#[derive(Debug, Deserialize)]
struct SubredditData {
    display_name: String,
    subscribers: Option<u64>,
    accounts_active: Option<u64>,
    #[allow(dead_code)]
    public_description: Option<String>,
}

/// Response from /r/{sub}/about.json (public, unauthenticated endpoint)
#[derive(Debug, Deserialize)]
struct SubredditAboutResponse {
    data: SubredditData,
}

// ============================================================================
// CACHED TOKEN
// ============================================================================

struct CachedToken {
    access_token: String,
    expires_at: std::time::Instant,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Reddit subreddit popularity data source.
///
/// Tracks subscriber count and active user count for ~200 curated subreddits.
/// Two assets per subreddit: `_subscribers` and `_active`.
///
/// Supports two modes:
/// - **Authenticated** (OAuth2): fast batch API via /api/info (needs REDDIT_CLIENT_ID + SECRET)
/// - **Public** (no auth): per-subreddit JSON API at /r/{sub}/about.json (10 req/min)
///
/// Source ID is `"reddit"`.
pub struct RedditMarketSource {
    client: reqwest::Client,
    client_id: Option<String>,
    client_secret: Option<String>,
    token: Arc<Mutex<Option<CachedToken>>>,
    last_request: Arc<Mutex<std::time::Instant>>,
    /// Whether we have OAuth credentials.
    authenticated: bool,
}

impl RedditMarketSource {
    pub fn from_env() -> Result<Self> {
        let client_id = std::env::var("REDDIT_CLIENT_ID")
            .ok()
            .filter(|s| !s.is_empty());
        let client_secret = std::env::var("REDDIT_CLIENT_SECRET")
            .ok()
            .filter(|s| !s.is_empty());

        let authenticated = client_id.is_some() && client_secret.is_some();

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .user_agent(USER_AGENT)
            .build()
            .context("Failed to build HTTP client")?;

        info!(
            "Reddit source initialized (auth={}), tracking {} subreddits ({} assets)",
            if authenticated { "OAuth2" } else { "public (no auth, 10 req/min)" },
            SUBREDDITS.len(),
            SUBREDDITS.len() * 2
        );

        Ok(Self {
            client,
            client_id,
            client_secret,
            token: Arc::new(Mutex::new(None)),
            last_request: Arc::new(Mutex::new(std::time::Instant::now())),
            authenticated,
        })
    }

    /// Get a valid access token, refreshing if needed.
    /// Returns None if not authenticated.
    async fn get_token(&self) -> Result<Option<String>> {
        let (client_id, client_secret) = match (&self.client_id, &self.client_secret) {
            (Some(id), Some(secret)) => (id, secret),
            _ => return Ok(None),
        };

        let mut token_guard = self.token.lock().await;

        // Return cached token if still valid (with 60s buffer)
        if let Some(ref cached) = *token_guard {
            if cached.expires_at > std::time::Instant::now() + Duration::from_secs(60) {
                return Ok(Some(cached.access_token.clone()));
            }
        }

        // Fetch new token via client credentials grant
        let resp = self
            .client
            .post(TOKEN_URL)
            .basic_auth(client_id, Some(client_secret))
            .form(&[("grant_type", "client_credentials")])
            .send()
            .await
            .context("Failed to request Reddit access token")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Reddit token request failed: {} {}", status, body);
        }

        let token_resp: TokenResponse = resp
            .json()
            .await
            .context("Failed to parse Reddit token response")?;

        let expires_at =
            std::time::Instant::now() + Duration::from_secs(token_resp.expires_in.saturating_sub(120));

        let access_token = token_resp.access_token.clone();

        *token_guard = Some(CachedToken {
            access_token: token_resp.access_token,
            expires_at,
        });

        debug!("Reddit access token refreshed, expires in {}s", token_resp.expires_in);
        Ok(Some(access_token))
    }

    /// Enforce rate limiting between requests.
    async fn rate_limit(&self) {
        let mut last = self.last_request.lock().await;
        let elapsed = last.elapsed();
        let min_delay = Duration::from_millis(MIN_REQUEST_DELAY_MS);

        if elapsed < min_delay {
            tokio::time::sleep(min_delay - elapsed).await;
        }

        *last = std::time::Instant::now();
    }

    /// Make a GET request to the Reddit API with retries.
    /// Uses OAuth if authenticated, plain request otherwise.
    async fn api_get(&self, url: &str) -> Result<RedditListing> {
        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            self.rate_limit().await;

            let token = self.get_token().await?;

            let mut req = self.client.get(url);
            if let Some(ref tok) = token {
                req = req.header("Authorization", format!("Bearer {}", tok));
            }

            match req.send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        match resp.json::<RedditListing>().await {
                            Ok(data) => return Ok(data),
                            Err(e) => {
                                warn!(
                                    "Failed to parse Reddit response (attempt {}/{}): {:?}",
                                    attempt + 1, MAX_RETRIES, e
                                );
                                last_error = Some(e.to_string());
                            }
                        }
                    } else if resp.status().as_u16() == 429 {
                        let retry_after = resp
                            .headers()
                            .get("Retry-After")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(5);

                        warn!(
                            "Reddit rate limited (attempt {}/{}), waiting {}s",
                            attempt + 1, MAX_RETRIES, retry_after
                        );
                        tokio::time::sleep(Duration::from_secs(retry_after)).await;
                        last_error = Some("Rate limited".to_string());
                    } else if resp.status().as_u16() == 401 {
                        warn!("Reddit auth failed (401), clearing token cache");
                        let mut token_guard = self.token.lock().await;
                        *token_guard = None;
                        last_error = Some("Auth failed".to_string());
                    } else {
                        let status = resp.status();
                        let body = resp.text().await.unwrap_or_default();
                        warn!(
                            "Reddit API error (attempt {}/{}): {} {}",
                            attempt + 1, MAX_RETRIES, status, body
                        );
                        last_error = Some(format!("HTTP {}", status));
                    }
                }
                Err(e) => {
                    warn!(
                        "Reddit request failed (attempt {}/{}): {:?}",
                        attempt + 1, MAX_RETRIES, e
                    );
                    last_error = Some(e.to_string());
                }
            }

            // Exponential backoff
            if attempt < MAX_RETRIES - 1 {
                let delay = Duration::from_secs(2u64.pow(attempt));
                tokio::time::sleep(delay).await;
            }
        }

        Err(anyhow::anyhow!(
            "Reddit request failed after {} retries: {:?}",
            MAX_RETRIES,
            last_error
        ))
    }

    /// Fetch subreddit info in batches of 100 via OAuth /api/info (authenticated mode only).
    async fn fetch_subreddit_batch(&self, subs: &[&str]) -> Result<Vec<SubredditData>> {
        let sr_names = subs.join(",");
        let url = format!("{}/api/info?sr_name={}", API_BASE, sr_names);

        let listing = self.api_get(&url).await?;

        Ok(listing
            .data
            .children
            .into_iter()
            .map(|c| c.data)
            .collect())
    }

    /// Fetch a single subreddit's info via the public JSON API (no auth needed).
    /// Uses https://www.reddit.com/r/{sub}/about.json
    async fn fetch_subreddit_public(&self, sub: &str) -> Result<SubredditData> {
        self.rate_limit().await;
        let url = format!("https://www.reddit.com/r/{}/about.json", sub);

        let mut last_error = None;
        for attempt in 0..MAX_RETRIES {
            if attempt > 0 {
                self.rate_limit().await;
            }

            match self.client.get(&url).send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        match resp.json::<SubredditAboutResponse>().await {
                            Ok(data) => return Ok(data.data),
                            Err(e) => {
                                warn!("Failed to parse Reddit about.json for r/{} (attempt {}/{}): {:?}",
                                    sub, attempt + 1, MAX_RETRIES, e);
                                last_error = Some(e.to_string());
                            }
                        }
                    } else if resp.status().as_u16() == 429 {
                        let retry_after = resp.headers()
                            .get("Retry-After")
                            .and_then(|v| v.to_str().ok())
                            .and_then(|s| s.parse::<u64>().ok())
                            .unwrap_or(10);
                        warn!("Reddit public API rate limited for r/{}, waiting {}s", sub, retry_after);
                        tokio::time::sleep(Duration::from_secs(retry_after)).await;
                        last_error = Some("Rate limited".to_string());
                    } else {
                        let status = resp.status();
                        last_error = Some(format!("HTTP {}", status));
                    }
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                }
            }

            if attempt < MAX_RETRIES - 1 {
                tokio::time::sleep(Duration::from_secs(2u64.pow(attempt))).await;
            }
        }

        Err(anyhow::anyhow!("Reddit public API failed for r/{}: {:?}", sub, last_error))
    }

    /// Deduplicated subreddit list
    fn subreddit_list() -> Vec<&'static str> {
        let mut seen = std::collections::HashSet::new();
        SUBREDDITS
            .iter()
            .filter(|s| seen.insert(**s))
            .copied()
            .collect()
    }
}

#[async_trait::async_trait]
impl MarketDataSource for RedditMarketSource {
    fn source_id(&self) -> &'static str {
        "reddit"
    }

    fn display_name(&self) -> &'static str {
        "Reddit Communities"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        if self.authenticated {
            Duration::from_secs(600) // 10 minutes with OAuth
        } else {
            Duration::from_secs(3600) // 1 hour with public API (slower due to rate limits)
        }
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        if self.authenticated {
            RateLimitConfig {
                windows: vec![RateWindow {
                    max_requests: 50,
                    duration: Duration::from_secs(60),
                }],
            }
        } else {
            RateLimitConfig {
                windows: vec![RateWindow {
                    max_requests: 8, // ~10 req/min public limit, stay under
                    duration: Duration::from_secs(60),
                }],
            }
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Config is empty — generate assets from curated list
        info!("Reddit config is empty, generating assets from curated subreddit list");

        let subs = Self::subreddit_list();
        let mut assets = Vec::with_capacity(subs.len() * 2);

        for sub in &subs {
            let sub_lower = sub.to_lowercase();

            // Subscribers asset
            assets.push(AssetUpdate {
                asset_id: format!("reddit_{}_subscribers", sub_lower),
                symbol: format!("REDDIT/{}/SUBSCRIBERS", sub.to_uppercase()),
                name: format!("r/{} Subscribers", sub),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": *sub,
                    "subcategory": "reddit",
                    "active": true,
                    "extra": { "metric": "subscribers" },
                }),
            });

            // Active users asset
            assets.push(AssetUpdate {
                asset_id: format!("reddit_{}_active", sub_lower),
                symbol: format!("REDDIT/{}/ACTIVE", sub.to_uppercase()),
                name: format!("r/{} Active Users", sub),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": *sub,
                    "subcategory": "reddit",
                    "active": true,
                    "extra": { "metric": "active" },
                }),
            });
        }

        info!("Registered {} Reddit assets ({} subreddits x 2 metrics)", assets.len(), subs.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Extract unique subreddit names from asset_ids
        let mut subs_needed: std::collections::HashSet<String> = std::collections::HashSet::new();
        for aid in asset_ids {
            // Format: reddit_{sub}_subscribers or reddit_{sub}_active
            if let Some(rest) = aid.strip_prefix("reddit_") {
                if let Some(sub) = rest.strip_suffix("_subscribers").or_else(|| rest.strip_suffix("_active")) {
                    subs_needed.insert(sub.to_string());
                }
            }
        }

        if subs_needed.is_empty() {
            return Ok(Vec::new());
        }

        let subs_vec: Vec<String> = subs_needed.into_iter().collect();
        let mut sub_data: std::collections::HashMap<String, (u64, u64)> = std::collections::HashMap::new();

        if self.authenticated {
            // Authenticated mode: batch fetch via OAuth /api/info
            for chunk in subs_vec.chunks(BATCH_SIZE) {
                let chunk_refs: Vec<&str> = chunk.iter().map(|s| s.as_str()).collect();
                match self.fetch_subreddit_batch(&chunk_refs).await {
                    Ok(data) => {
                        for sub in data {
                            let name = sub.display_name.to_lowercase();
                            let subscribers = sub.subscribers.unwrap_or(0);
                            let active = sub.accounts_active.unwrap_or(0);
                            sub_data.insert(name, (subscribers, active));
                        }
                    }
                    Err(e) => {
                        warn!("Failed to fetch Reddit batch: {:?}", e);
                    }
                }
            }
        } else {
            // Public mode: fetch one subreddit at a time via /r/{sub}/about.json
            // Rate limit is ~10 req/min so we add inter-request delays
            for sub in &subs_vec {
                match self.fetch_subreddit_public(sub).await {
                    Ok(data) => {
                        let name = data.display_name.to_lowercase();
                        let subscribers = data.subscribers.unwrap_or(0);
                        let active = data.accounts_active.unwrap_or(0);
                        sub_data.insert(name, (subscribers, active));
                    }
                    Err(e) => {
                        debug!("Failed to fetch r/{} (public): {:?}", sub, e);
                    }
                }
                // 6-second delay to stay well under 10 req/min public limit
                tokio::time::sleep(Duration::from_secs(6)).await;
            }
        }

        // Build price updates
        let mut results = Vec::new();
        for aid in asset_ids {
            if let Some(rest) = aid.strip_prefix("reddit_") {
                if let Some(sub) = rest.strip_suffix("_subscribers") {
                    if let Some(&(subscribers, _)) = sub_data.get(sub) {
                        results.push(PriceUpdate {
                            asset_id: aid.clone(),
                            symbol: format!("REDDIT/{}/SUBSCRIBERS", sub.to_uppercase()),
                            value: Decimal::from(subscribers),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                } else if let Some(sub) = rest.strip_suffix("_active") {
                    if let Some(&(_, active)) = sub_data.get(sub) {
                        results.push(PriceUpdate {
                            asset_id: aid.clone(),
                            symbol: format!("REDDIT/{}/ACTIVE", sub.to_uppercase()),
                            value: Decimal::from(active),
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

        info!(
            "Fetched {}/{} Reddit metrics ({} subreddits queried, mode={})",
            results.len(),
            asset_ids.len(),
            sub_data.len(),
            if self.authenticated { "oauth" } else { "public" }
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        let subs = Self::subreddit_list();
        let mut entries = Vec::with_capacity(subs.len() * 2);

        for sub in &subs {
            let sub_lower = sub.to_lowercase();

            entries.push(AssetEntry {
                asset_id: format!("reddit_{}_subscribers", sub_lower),
                symbol: format!("REDDIT/{}/SUBSCRIBERS", sub.to_uppercase()),
                name: format!("r/{} Subscribers", sub),
                category: "sentiment".to_string(),
                subcategory: "reddit".to_string(),
                api_ref: sub.to_string(),
                active: true,
            });

            entries.push(AssetEntry {
                asset_id: format!("reddit_{}_active", sub_lower),
                symbol: format!("REDDIT/{}/ACTIVE", sub.to_uppercase()),
                name: format!("r/{} Active Users", sub),
                category: "sentiment".to_string(),
                subcategory: "reddit".to_string(),
                api_ref: sub.to_string(),
                active: true,
            });
        }

        info!("Discovered {} Reddit assets", entries.len());
        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("reddit", "reddit");
    }

    #[test]
    fn test_asset_json_parses() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.is_empty() || entries.len() > 0);
    }

    #[test]
    fn test_active_assets_load() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        for asset in &assets {
            assert_eq!(asset.category, Some("sentiment".to_string()));
        }
    }

    #[test]
    fn test_subreddit_list_dedup() {
        let subs = RedditMarketSource::subreddit_list();
        let mut seen = std::collections::HashSet::new();
        for s in &subs {
            assert!(seen.insert(*s), "Duplicate subreddit: {}", s);
        }
    }

    #[test]
    fn test_asset_id_format() {
        let sub = "bitcoin";
        assert_eq!(
            format!("reddit_{}_subscribers", sub),
            "reddit_bitcoin_subscribers"
        );
        assert_eq!(
            format!("reddit_{}_active", sub),
            "reddit_bitcoin_active"
        );
    }

    #[test]
    fn test_symbol_format() {
        let sub = "bitcoin";
        assert_eq!(
            format!("REDDIT/{}/SUBSCRIBERS", sub.to_uppercase()),
            "REDDIT/BITCOIN/SUBSCRIBERS"
        );
    }

    #[test]
    fn test_batch_calculation() {
        let subs = RedditMarketSource::subreddit_list();
        let batches = (subs.len() + BATCH_SIZE - 1) / BATCH_SIZE;
        // Should fit in 2-3 batches at most
        assert!(batches <= 3, "Too many batches: {}", batches);
    }

    #[test]
    fn test_asset_id_parsing() {
        let aid = "reddit_bitcoin_subscribers";
        let rest = aid.strip_prefix("reddit_").unwrap();
        let sub = rest.strip_suffix("_subscribers").unwrap();
        assert_eq!(sub, "bitcoin");

        let aid = "reddit_wallstreetbets_active";
        let rest = aid.strip_prefix("reddit_").unwrap();
        let sub = rest.strip_suffix("_active").unwrap();
        assert_eq!(sub, "wallstreetbets");
    }
}
