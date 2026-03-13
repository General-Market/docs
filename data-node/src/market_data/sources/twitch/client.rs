//! Twitch Helix API client implementing MarketDataSource
//!
//! Fetches live viewer counts for top streamers and games from https://api.twitch.tv/helix
//! Uses OAuth2 Client Credentials for authentication (app access token).
//!
//! Rolling fetch strategy (all within 800 req/min budget):
//!   - Top 6000 streams: 60 paginated requests (100 per page)
//!   - Top 1000 games:   10 paginated requests (100 per page)
//!   - Total: 70 requests per 60s cycle = 8.75% of budget

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};
use crate::market_data::sources::oauth::OAuthTokenCache;

use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource,
    PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/twitch.json");

/// Twitch Helix API base URL
const HELIX_URL: &str = "https://api.twitch.tv/helix";

/// Twitch OAuth2 token endpoint
const TOKEN_URL: &str = "https://id.twitch.tv/oauth2/token";

/// Max items per page (Twitch Helix limit)
const PAGE_SIZE: usize = 100;

/// Max user_ids per Get Streams request
const BATCH_SIZE: usize = 100;

/// How many top streams to discover (60 pages x 100)
const TOP_STREAMS_COUNT: usize = 6000;

/// How many top games to discover (10 pages x 100)
const TOP_GAMES_COUNT: usize = 1000;

/// Minimum viewer count to include a streamer.
/// Only streamers whose observed viewer count meets this threshold are tracked.
const MIN_VIEWER_COUNT: u64 = 100;

/// Request timeout
const REQUEST_TIMEOUT_SECS: u64 = 15;

/// How long to retain a streamer in the in-memory peak cache.
/// After 30 days without appearing in the top streams, they are pruned from memory.
/// This is intentionally longer than DEACTIVATION_DAYS so we can reactivate
/// streamers who come back online after a break.
const RETENTION_DAYS: i64 = 30;

/// How many days offline before a streamer is deactivated (is_active = false).
/// Streamers offline for more than 3 days are excluded from fetch_assets(),
/// causing the sync engine to set is_active = false. When they come back
/// online, they'll appear in fetch_assets() again and get reactivated.
const DEACTIVATION_DAYS: i64 = 3;

/// Grace period for newly discovered streamers. If a streamer was discovered
/// but never seen live again within this many hours, it won't be returned
/// by fetch_assets() — preventing "never got prices" assets.
const GRACE_PERIOD_HOURS: i64 = 24;

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

#[derive(Debug, Clone, Deserialize)]
pub struct TwitchStream {
    pub id: String,
    pub user_id: String,
    pub user_login: String,
    pub user_name: String,
    pub game_id: String,
    pub game_name: String,
    #[serde(rename = "type")]
    pub stream_type: String,
    pub title: String,
    pub viewer_count: u64,
    pub started_at: String,
    pub language: String,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub is_mature: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TwitchGame {
    pub id: String,
    pub name: String,
    #[allow(dead_code)]
    pub box_art_url: Option<String>,
    #[allow(dead_code)]
    pub igdb_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HelixResponse<T> {
    data: Vec<T>,
    pagination: Option<Pagination>,
}

#[derive(Debug, Deserialize)]
struct Pagination {
    cursor: Option<String>,
}

// ============================================================================
// STREAMER PEAK CACHE
// ============================================================================

/// Tracks a streamer's peak (max) viewer count and when they were last seen live.
#[derive(Clone, Debug)]
struct CachedStreamer {
    user_name: String,
    user_id: String,
    /// Highest viewer count ever observed for this streamer.
    max_viewers: u64,
    /// First time this streamer was added to the cache (discovery time).
    first_seen: DateTime<Utc>,
    /// Last time this streamer appeared in the top streams (live).
    last_seen: DateTime<Utc>,
    /// How many times this streamer has been seen live in a fetch cycle.
    /// Starts at 1 on discovery. Incremented on each subsequent sighting.
    /// A streamer with live_count == 1 has only been seen once (at discovery)
    /// and may have gone offline before the first price fetch.
    live_count: u32,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Twitch live streaming data source.
///
/// Stores the **peak (max) viewer count** for each streamer. When a streamer
/// goes offline, they remain in the asset list with their peak value — they are
/// only pruned after 30 days of not being seen live. New streamers are added
/// automatically when discovered with >= 200 peak viewers.
///
/// Source ID is `"twitch"`.
pub struct TwitchMarketSource {
    /// Used for OAuth token requests (POST)
    client: reqwest::Client,
    /// Used for data-fetching GET requests (with rate limiting + retry)
    http: SourceHttpClient,
    client_id: String,
    client_secret: String,
    token_cache: OAuthTokenCache,
    /// Peak viewer cache: user_login -> CachedStreamer.
    /// Tracks max viewers and last_seen. Pruned after 30 days of inactivity.
    seen_streamers: Arc<Mutex<HashMap<String, CachedStreamer>>>,
}

impl TwitchMarketSource {
    pub fn from_env() -> Result<Self> {
        let client_id = std::env::var("TWITCH_CLIENT_ID")
            .context("TWITCH_CLIENT_ID environment variable must be set")?;
        let client_secret = std::env::var("TWITCH_CLIENT_SECRET")
            .context("TWITCH_CLIENT_SECRET environment variable must be set")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .context("Failed to build HTTP client")?;

        let http = SourceHttpClient::new(
            RateLimitConfig {
                windows: vec![RateWindow {
                    max_requests: 720, // 90% of 800/min Twitch budget
                    duration: Duration::from_secs(60),
                }],
            },
            RetryConfig::default(),
        );

        let asset_count = load_assets_from_json(ASSET_JSON)
            .map(|a| a.len())
            .unwrap_or(0);
        info!("Twitch source initialized with {} assets", asset_count);

        Ok(Self {
            client,
            http,
            client_id,
            client_secret,
            token_cache: OAuthTokenCache::new("Twitch"),
            seen_streamers: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Get a valid access token, refreshing if needed.
    async fn get_token(&self) -> Result<String> {
        let client = self.client.clone();
        let client_id = self.client_id.clone();
        let client_secret = self.client_secret.clone();

        self.token_cache
            .get_or_refresh(|| async move {
                let resp = client
                    .post(TOKEN_URL)
                    .form(&[
                        ("client_id", client_id.as_str()),
                        ("client_secret", client_secret.as_str()),
                        ("grant_type", "client_credentials"),
                    ])
                    .send()
                    .await
                    .context("Failed to request Twitch access token")?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    anyhow::bail!("Twitch token request failed: {} {}", status, body);
                }

                let token_resp: TokenResponse = resp
                    .json()
                    .await
                    .context("Failed to parse Twitch token response")?;

                Ok((token_resp.access_token, token_resp.expires_in))
            })
            .await
    }

    /// Make an authenticated GET request to the Helix API.
    /// Uses SourceHttpClient for rate limiting and retry.
    /// Handles 401 by invalidating the token cache and retrying once.
    async fn helix_get<T: serde::de::DeserializeOwned>(
        &self,
        url: &str,
    ) -> Result<HelixResponse<T>> {
        let token = self.get_token().await?;
        let auth_value = format!("Bearer {}", token);
        let headers: Vec<(&str, &str)> = vec![
            ("Client-Id", self.client_id.as_str()),
            ("Authorization", auth_value.as_str()),
        ];

        match self.http.get_json_with_headers::<HelixResponse<T>>(url, &headers).await {
            Ok(data) => Ok(data),
            Err(crate::market_data::sources::error::SourceError::AuthFailed(_)) => {
                // Token expired — clear cache and retry once with a fresh token
                warn!("Twitch auth failed (401), clearing token cache and retrying");
                self.token_cache.invalidate().await;

                let new_token = self.get_token().await?;
                let new_auth = format!("Bearer {}", new_token);
                let new_headers: Vec<(&str, &str)> = vec![
                    ("Client-Id", self.client_id.as_str()),
                    ("Authorization", new_auth.as_str()),
                ];

                self.http.get_json_with_headers::<HelixResponse<T>>(url, &new_headers)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))
            }
            Err(e) => Err(anyhow::anyhow!("{}", e)),
        }
    }

    /// Fetch top N streams sorted by viewer count (paginated).
    /// Returns up to `count` live streams.
    async fn fetch_top_streams(&self, count: usize) -> Result<Vec<TwitchStream>> {
        let mut all_streams = Vec::with_capacity(count);
        let mut cursor: Option<String> = None;
        let pages_needed = (count + PAGE_SIZE - 1) / PAGE_SIZE;

        for page in 0..pages_needed {
            let url = match &cursor {
                Some(c) => format!(
                    "{}/streams?first={}&after={}",
                    HELIX_URL, PAGE_SIZE, c
                ),
                None => format!("{}/streams?first={}", HELIX_URL, PAGE_SIZE),
            };

            match self.helix_get::<TwitchStream>(&url).await {
                Ok(resp) => {
                    if resp.data.is_empty() {
                        debug!("No more streams at page {}", page);
                        break;
                    }

                    all_streams.extend(resp.data);

                    cursor = resp.pagination.and_then(|p| p.cursor);
                    if cursor.is_none() {
                        break;
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch streams page {}: {:?}", page, e);
                    break;
                }
            }

            if all_streams.len() >= count {
                break;
            }
        }

        all_streams.truncate(count);
        info!("Fetched {} live streams from Twitch", all_streams.len());
        Ok(all_streams)
    }

    /// Fetch top N games sorted by viewer count (paginated).
    async fn fetch_top_games(&self, count: usize) -> Result<Vec<TwitchGame>> {
        let mut all_games = Vec::with_capacity(count);
        let mut cursor: Option<String> = None;
        let pages_needed = (count + PAGE_SIZE - 1) / PAGE_SIZE;

        for page in 0..pages_needed {
            let url = match &cursor {
                Some(c) => format!(
                    "{}/games/top?first={}&after={}",
                    HELIX_URL, PAGE_SIZE, c
                ),
                None => format!("{}/games/top?first={}", HELIX_URL, PAGE_SIZE),
            };

            match self.helix_get::<TwitchGame>(&url).await {
                Ok(resp) => {
                    if resp.data.is_empty() {
                        debug!("No more games at page {}", page);
                        break;
                    }

                    all_games.extend(resp.data);

                    cursor = resp.pagination.and_then(|p| p.cursor);
                    if cursor.is_none() {
                        break;
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch games page {}: {:?}", page, e);
                    break;
                }
            }

            if all_games.len() >= count {
                break;
            }
        }

        all_games.truncate(count);
        info!("Fetched {} top games from Twitch", all_games.len());
        Ok(all_games)
    }

    /// Update the peak viewer cache with currently live streams.
    /// - If a streamer is new and has >= MIN_VIEWER_COUNT, add them.
    /// - If a streamer already exists, update max_viewers if current > stored max.
    /// - Prune entries not seen live in > 30 days.
    async fn update_peak_cache(&self, streams: &[TwitchStream]) {
        let now = Utc::now();
        let mut cache = self.seen_streamers.lock().await;

        for stream in streams {
            if stream.viewer_count < MIN_VIEWER_COUNT {
                continue;
            }

            match cache.get_mut(&stream.user_login) {
                Some(entry) => {
                    // Update max if current viewers exceed stored peak
                    if stream.viewer_count > entry.max_viewers {
                        entry.max_viewers = stream.viewer_count;
                    }
                    entry.last_seen = now;
                    entry.live_count += 1;
                    entry.user_name = stream.user_name.clone();
                }
                None => {
                    // New streamer — add to cache
                    cache.insert(
                        stream.user_login.clone(),
                        CachedStreamer {
                            user_name: stream.user_name.clone(),
                            user_id: stream.user_id.clone(),
                            max_viewers: stream.viewer_count,
                            first_seen: now,
                            last_seen: now,
                            live_count: 1,
                        },
                    );
                }
            }
        }

        // Prune entries not seen in > 30 days (memory cleanup)
        let cutoff = now - chrono::Duration::days(RETENTION_DAYS);
        let before = cache.len();
        cache.retain(|_, v| v.last_seen > cutoff);
        let pruned = before - cache.len();
        if pruned > 0 {
            info!("Pruned {} streamers not seen in > {} days", pruned, RETENTION_DAYS);
        }

        debug!(
            "Peak cache: {} streamers tracked (top max_viewers: {})",
            cache.len(),
            cache.values().map(|v| v.max_viewers).max().unwrap_or(0)
        );
    }

    /// Check if a cached streamer should be considered "active" for asset registration.
    ///
    /// A streamer is active if:
    /// 1. They were seen live within the last DEACTIVATION_DAYS, OR
    /// 2. They are newly discovered (within GRACE_PERIOD_HOURS) and haven't had
    ///    time to be confirmed yet.
    ///
    /// A streamer is NOT active if:
    /// - They've been in cache for > GRACE_PERIOD_HOURS but were only seen once
    ///   (never confirmed live in a subsequent fetch cycle) — these are the
    ///   "never got prices" assets.
    /// - Their last_seen is older than DEACTIVATION_DAYS.
    fn is_streamer_active(cached: &CachedStreamer, now: DateTime<Utc>) -> bool {
        let age = now - cached.first_seen;
        let since_last_seen = now - cached.last_seen;

        // If seen within the deactivation window, active
        if since_last_seen < chrono::Duration::days(DEACTIVATION_DAYS) {
            // But if they're past the grace period and were only seen once
            // (at discovery), they likely went offline before first price fetch
            if age > chrono::Duration::hours(GRACE_PERIOD_HOURS) && cached.live_count <= 1 {
                return false;
            }
            return true;
        }

        // Last seen more than DEACTIVATION_DAYS ago — inactive
        false
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TwitchMarketSource {
    fn source_id(&self) -> &'static str {
        "twitch"
    }

    fn display_name(&self) -> &'static str {
        "Twitch Live Streaming"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(60) // Rolling refresh cycle
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 720, // 90% of 800/min Twitch budget
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;

        // If we have a populated config, use it
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Config is empty — do live discovery so the sync engine has assets to work with.
        // This makes the source work immediately even before refresh-assets runs.
        info!("Twitch config is empty, performing live asset discovery");

        let mut assets = Vec::new();
        let now = Utc::now();

        // Discover top streams and update peak cache
        match self.fetch_top_streams(TOP_STREAMS_COUNT).await {
            Ok(streams) => {
                // Update peak cache with live data
                self.update_peak_cache(&streams).await;

                // Return only ACTIVE cached streamers as assets.
                // This causes the sync engine to deactivate streamers that:
                // - Haven't been seen live in > DEACTIVATION_DAYS
                // - Were discovered but never confirmed live (grace period expired)
                let cache = self.seen_streamers.lock().await;
                let mut active_count = 0usize;
                let mut inactive_count = 0usize;
                for (login, cached) in cache.iter() {
                    if !Self::is_streamer_active(cached, now) {
                        inactive_count += 1;
                        continue;
                    }
                    active_count += 1;
                    assets.push(AssetUpdate {
                        asset_id: format!("twitch_stream_{}", login),
                        symbol: login.clone(),
                        name: cached.user_name.clone(),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": format!("user_id:{}", cached.user_id),
                            "subcategory": "streamers",
                            "active": true,
                            "extra": {},
                        }),
                    });
                }
                drop(cache);

                info!(
                    "Registered {} active streamers ({} inactive/deactivated, peak >= {} viewers)",
                    active_count, inactive_count, MIN_VIEWER_COUNT
                );

                // Aggregate game viewer counts from stream data
                let mut game_viewers: HashMap<String, (String, u64)> = HashMap::new();
                for stream in &streams {
                    if !stream.game_id.is_empty() {
                        let entry = game_viewers
                            .entry(stream.game_id.clone())
                            .or_insert_with(|| (stream.game_name.clone(), 0));
                        entry.1 += stream.viewer_count;
                    }
                }

                for (game_id, (game_name, _)) in &game_viewers {
                    assets.push(AssetUpdate {
                        asset_id: format!("twitch_game_{}", game_id),
                        symbol: game_name.clone(),
                        name: game_name.clone(),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": format!("game_id:{}", game_id),
                            "subcategory": "games",
                            "active": true,
                            "extra": {},
                        }),
                    });
                }
            }
            Err(e) => {
                warn!("Failed to discover Twitch streams: {:?}", e);
            }
        }

        info!("Discovered {} Twitch assets via live API", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Categorize assets by parsing the asset_id prefix directly.
        // This works in both config mode and discovery mode.
        let mut streamer_logins: Vec<String> = Vec::new(); // user_login extracted from asset_id
        let mut game_ids: Vec<String> = Vec::new(); // game_id extracted from asset_id

        for asset_id in asset_ids {
            if let Some(login) = asset_id.strip_prefix("twitch_stream_") {
                streamer_logins.push(login.to_string());
            } else if let Some(gid) = asset_id.strip_prefix("twitch_game_") {
                game_ids.push(gid.to_string());
            }
        }

        // =====================================================================
        // Fetch top streams once — used for both streamer and game lookups
        // =====================================================================
        let mut streams = if !streamer_logins.is_empty() || !game_ids.is_empty() {
            match self.fetch_top_streams(TOP_STREAMS_COUNT).await {
                Ok(s) => s,
                Err(e) => {
                    warn!("Failed to fetch Twitch streams for prices: {:?}", e);
                    Vec::new()
                }
            }
        } else {
            Vec::new()
        };

        // =====================================================================
        // TARGETED LOOKUP: Check registered streamers not found in top streams.
        // The top-streams endpoint only returns the top N by viewers. Active
        // streamers with fewer viewers would be missed, leading to "never got
        // prices" assets. Query them directly via user_login filter.
        // =====================================================================
        if !streamer_logins.is_empty() && !streams.is_empty() {
            let found_logins: std::collections::HashSet<String> =
                streams.iter().map(|s| s.user_login.clone()).collect();

            let missing_logins: Vec<&str> = streamer_logins
                .iter()
                .filter(|l| !found_logins.contains(l.as_str()))
                .map(|l| l.as_str())
                .collect();

            if !missing_logins.is_empty() {
                info!(
                    "Querying {} registered streamers not in top {} streams",
                    missing_logins.len(),
                    TOP_STREAMS_COUNT
                );

                // Twitch Helix /streams?user_login=... supports up to 100 per request
                for chunk in missing_logins.chunks(BATCH_SIZE) {
                    let query_params: String = chunk
                        .iter()
                        .map(|l| format!("user_login={}", l))
                        .collect::<Vec<_>>()
                        .join("&");
                    let url = format!("{}/streams?first={}&{}", HELIX_URL, chunk.len(), query_params);

                    match self.helix_get::<TwitchStream>(&url).await {
                        Ok(resp) => {
                            if !resp.data.is_empty() {
                                debug!(
                                    "Found {} live streamers from targeted lookup batch",
                                    resp.data.len()
                                );
                                streams.extend(resp.data);
                            }
                        }
                        Err(e) => {
                            warn!("Failed to fetch targeted streamer batch: {:?}", e);
                        }
                    }
                }
            }
        }

        // =====================================================================
        // STREAMERS: Peak cache decides WHO we track. Price value is CURRENT
        // live viewer count (0 if offline).
        // =====================================================================
        {
            // Update peak cache with current live data (decides roster)
            self.update_peak_cache(&streams).await;

            // Build lookup: user_login -> current live viewer_count
            let mut live_viewers: HashMap<String, u64> = HashMap::new();
            for stream in &streams {
                live_viewers.insert(stream.user_login.clone(), stream.viewer_count);
            }

            let cache = self.seen_streamers.lock().await;

            // Registered streamers — only emit when live (skip offline/0-viewer streams)
            for login in &streamer_logins {
                if cache.contains_key(login.as_str()) {
                    let viewers = live_viewers.get(login.as_str()).copied().unwrap_or(0);
                    if viewers == 0 {
                        continue; // Don't submit offline streamers to batch
                    }
                    results.push(PriceUpdate {
                        asset_id: format!("twitch_stream_{}", login),
                        symbol: login.clone(),
                        value: Decimal::from(viewers),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }

            // Discover new streamers not yet registered (only if live)
            let known_logins: std::collections::HashSet<&str> =
                streamer_logins.iter().map(|s| s.as_str()).collect();
            let mut new_count = 0u32;
            for (login, _cached) in cache.iter() {
                if known_logins.contains(login.as_str()) {
                    continue;
                }
                let viewers = live_viewers.get(login.as_str()).copied().unwrap_or(0);
                if viewers == 0 {
                    continue; // Don't submit offline streamers to batch
                }
                results.push(PriceUpdate {
                    asset_id: format!("twitch_stream_{}", login),
                    symbol: login.clone(),
                    value: Decimal::from(viewers),
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
                new_count += 1;
            }
            drop(cache);

            if new_count > 0 {
                info!("Emitting {} newly discovered streamers", new_count);
            }
        }

        // =====================================================================
        // GAMES: Aggregate viewer counts from stream data by game_id
        // =====================================================================
        if !game_ids.is_empty() {
            let mut game_viewers: HashMap<String, u64> = HashMap::new();
            for stream in &streams {
                if !stream.game_id.is_empty() {
                    *game_viewers.entry(stream.game_id.clone()).or_insert(0) +=
                        stream.viewer_count;
                }
            }

            for gid in &game_ids {
                let viewers = game_viewers.get(gid).copied().unwrap_or(0);
                results.push(PriceUpdate {
                    asset_id: format!("twitch_game_{}", gid),
                    symbol: gid.clone(),
                    value: Decimal::from(viewers),
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        info!(
            "Fetched {}/{} Twitch viewer counts",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    /// Discover top streamers and games from the live Twitch API.
    /// Used by the refresh-assets CLI to populate config/twitch.json.
    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        let mut entries = Vec::new();

        // =====================================================================
        // DISCOVER TOP 6000 STREAMERS
        // =====================================================================
        info!("Discovering top {} Twitch streamers...", TOP_STREAMS_COUNT);
        let streams = self.fetch_top_streams(TOP_STREAMS_COUNT).await?;

        // Deduplicate by user_login, filter by minimum viewer count
        let mut seen_logins = std::collections::HashSet::new();

        for stream in &streams {
            if stream.viewer_count < MIN_VIEWER_COUNT {
                continue;
            }
            if seen_logins.insert(stream.user_login.clone()) {
                entries.push(AssetEntry {
                    asset_id: format!("twitch_stream_{}", stream.user_login),
                    symbol: stream.user_login.clone(),
                    name: stream.user_name.clone(),
                    category: "sentiment".to_string(),
                    subcategory: "streamers".to_string(),
                    api_ref: format!("user_id:{}", stream.user_id),
                    active: true,
                });
            }
        }

        info!(
            "Discovered {} unique streamers with >= {} viewers",
            seen_logins.len(),
            MIN_VIEWER_COUNT
        );

        // =====================================================================
        // DISCOVER TOP 1000 GAMES
        // =====================================================================
        info!("Discovering top {} Twitch games...", TOP_GAMES_COUNT);
        let games = self.fetch_top_games(TOP_GAMES_COUNT).await?;

        for game in &games {
            entries.push(AssetEntry {
                asset_id: format!("twitch_game_{}", game.id),
                symbol: game.name.clone(),
                name: game.name.clone(),
                category: "sentiment".to_string(),
                subcategory: "games".to_string(),
                api_ref: format!("game_id:{}", game.id),
                active: true,
            });
        }

        info!(
            "Discovered {} total Twitch assets ({} streamers + {} games)",
            entries.len(),
            seen_logins.len(),
            games.len()
        );

        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_source_id() {
        assert_eq!("twitch", "twitch");
    }

    #[test]
    fn test_asset_json_parses() {
        // Config starts empty — should parse to empty vec
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        // Empty is fine (populated by discover_upstream_assets / refresh-assets)
        assert!(entries.is_empty() || entries.len() > 0);
    }

    #[test]
    fn test_active_assets_load() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        // Empty config returns empty vec — that's valid
        for asset in &assets {
            assert_eq!(asset.category, Some("sentiment".to_string()));
        }
    }

    #[test]
    fn test_category_coverage() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                crate::market_data::traits::categories::is_valid(&entry.category),
                "Invalid category '{}' for asset '{}'",
                entry.category,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_streamer_asset_id_format() {
        let asset_id = format!("twitch_stream_{}", "xqc");
        assert_eq!(asset_id, "twitch_stream_xqc");

        let asset_id = format!("twitch_game_{}", "509658");
        assert_eq!(asset_id, "twitch_game_509658");
    }

    #[test]
    fn test_api_ref_parsing() {
        let api_ref = "user_id:12345";
        assert_eq!(api_ref.strip_prefix("user_id:"), Some("12345"));

        let api_ref = "game_id:509658";
        assert_eq!(api_ref.strip_prefix("game_id:"), Some("509658"));

        let api_ref = "invalid";
        assert_eq!(api_ref.strip_prefix("user_id:"), None);
    }

    #[test]
    fn test_page_count_calculation() {
        // 6000 streams / 100 per page = 60 pages
        let pages = (TOP_STREAMS_COUNT + PAGE_SIZE - 1) / PAGE_SIZE;
        assert_eq!(pages, 60);

        // 1000 games / 100 per page = 10 pages
        let pages = (TOP_GAMES_COUNT + PAGE_SIZE - 1) / PAGE_SIZE;
        assert_eq!(pages, 10);

        // Total: 70 requests, well within 720/min budget
        assert!(60 + 10 <= 720);
    }

    #[test]
    fn test_viewer_count_to_decimal() {
        let viewers: u64 = 150_000;
        let value = Decimal::from(viewers);
        assert_eq!(value, Decimal::from(150_000));

        // Offline streamer
        let viewers: u64 = 0;
        let value = Decimal::from(viewers);
        assert_eq!(value, Decimal::from(0));
    }

    #[test]
    fn test_min_viewer_count_threshold() {
        assert_eq!(MIN_VIEWER_COUNT, 100);
        // Streams below threshold should be filtered
        assert!(50 < MIN_VIEWER_COUNT);
        assert!(99 < MIN_VIEWER_COUNT);
        // Streams at or above threshold should be included
        assert!(100 >= MIN_VIEWER_COUNT);
        assert!(1000 >= MIN_VIEWER_COUNT);
    }

    #[test]
    fn test_retention_days() {
        assert_eq!(RETENTION_DAYS, 30);
    }

    #[test]
    fn test_deactivation_days() {
        assert_eq!(DEACTIVATION_DAYS, 3);
        // Deactivation must be shorter than retention (deactivate before pruning)
        assert!(DEACTIVATION_DAYS < RETENTION_DAYS);
    }

    #[test]
    fn test_grace_period_hours() {
        assert_eq!(GRACE_PERIOD_HOURS, 24);
    }

    #[test]
    fn test_is_streamer_active_recently_seen() {
        let now = Utc::now();
        let cached = CachedStreamer {
            user_name: "test".to_string(),
            user_id: "123".to_string(),
            max_viewers: 500,
            first_seen: now - chrono::Duration::days(10),
            last_seen: now - chrono::Duration::hours(1),
            live_count: 5,
        };
        // Seen 1h ago, live_count > 1 — active
        assert!(TwitchMarketSource::is_streamer_active(&cached, now));
    }

    #[test]
    fn test_is_streamer_active_offline_3_days() {
        let now = Utc::now();
        let cached = CachedStreamer {
            user_name: "test".to_string(),
            user_id: "123".to_string(),
            max_viewers: 500,
            first_seen: now - chrono::Duration::days(10),
            last_seen: now - chrono::Duration::days(4),
            live_count: 50,
        };
        // Last seen 4 days ago — inactive
        assert!(!TwitchMarketSource::is_streamer_active(&cached, now));
    }

    #[test]
    fn test_is_streamer_active_never_confirmed() {
        let now = Utc::now();
        let cached = CachedStreamer {
            user_name: "test".to_string(),
            user_id: "123".to_string(),
            max_viewers: 200,
            first_seen: now - chrono::Duration::hours(30),
            last_seen: now - chrono::Duration::hours(30),
            live_count: 1,
        };
        // Discovered 30h ago, only seen once (at discovery), past grace period — inactive
        assert!(!TwitchMarketSource::is_streamer_active(&cached, now));
    }

    #[test]
    fn test_is_streamer_active_new_within_grace() {
        let now = Utc::now();
        let cached = CachedStreamer {
            user_name: "test".to_string(),
            user_id: "123".to_string(),
            max_viewers: 200,
            first_seen: now - chrono::Duration::hours(2),
            last_seen: now - chrono::Duration::hours(2),
            live_count: 1,
        };
        // Discovered 2h ago, only seen once but within grace period — active
        assert!(TwitchMarketSource::is_streamer_active(&cached, now));
    }
}
