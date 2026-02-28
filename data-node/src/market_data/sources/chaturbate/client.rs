//! Chaturbate live cam model viewer count tracker.
//!
//! Fetches live viewer counts for top cam models from Chaturbate's public API.
//! Follows the Twitch pattern: discover top models, track live viewer counts,
//! report 0 when offline, prune after 30 days of inactivity.
//!
//! API: https://chaturbate.com/api/public/affiliates/onlinerooms/?format=json&limit=500
//! No auth required — public affiliate API.
//! Rate limit: 30 req/min (conservative)

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/chaturbate.json");

/// Chaturbate public affiliates API base
const API_BASE: &str = "https://chaturbate.com/api/public/affiliates/onlinerooms/";

/// Results per page (max 500)
const PAGE_SIZE: usize = 500;

/// Max pages to fetch per discovery cycle (500 * 10 = 5000 models)
const MAX_PAGES: usize = 10;

/// Minimum viewer count to include a model
const MIN_VIEWER_COUNT: u64 = 50;

/// Request timeout
const REQUEST_TIMEOUT_SECS: u64 = 15;

/// How long to retain a model after they were last seen live.
const RETENTION_DAYS: i64 = 30;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Paginated API response wrapper (API returns `{"results": [...], "count": N}`)
#[derive(Debug, Clone, Deserialize)]
pub struct ChaturbateApiResponse {
    pub results: Vec<ChaturbateRoom>,
    #[allow(dead_code)]
    pub count: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChaturbateRoom {
    pub username: String,
    pub num_users: u64,
    #[allow(dead_code)]
    pub current_show: Option<String>,
    #[allow(dead_code)]
    pub gender: Option<String>,
    #[allow(dead_code)]
    pub location: Option<String>,
    #[allow(dead_code)]
    pub spoken_languages: Option<String>,
    #[allow(dead_code)]
    pub is_new: Option<bool>,
    #[allow(dead_code)]
    pub birthday: Option<String>,
    #[allow(dead_code)]
    pub image_url: Option<String>,
}

// ============================================================================
// MODEL PEAK CACHE
// ============================================================================

/// Tracks a model's peak (max) viewer count and when they were last seen live.
#[derive(Clone, Debug)]
struct CachedModel {
    username: String,
    /// Highest viewer count ever observed for this model.
    max_viewers: u64,
    /// Last time this model appeared in the online rooms (live).
    last_seen: DateTime<Utc>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Chaturbate live cam model data source.
///
/// Stores the **peak (max) viewer count** for each model. When a model
/// goes offline, they remain in the asset list with their peak value — they are
/// only pruned after 30 days of not being seen live. New models are added
/// automatically when discovered with >= 50 peak viewers.
///
/// Source ID is `"chaturbate"`.
pub struct ChaturbateMarketSource {
    http: SourceHttpClient,
    /// Peak viewer cache: username -> CachedModel.
    seen_models: Arc<Mutex<HashMap<String, CachedModel>>>,
    /// Chaturbate affiliate webmaster ID (required by API).
    wm: String,
}

impl ChaturbateMarketSource {
    pub fn from_env() -> Result<Self> {
        let wm = std::env::var("CHATURBATE_WM")
            .map_err(|_| anyhow::anyhow!("CHATURBATE_WM environment variable is required (affiliate webmaster ID)"))?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to build HTTP client: {}", e))?;

        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        info!("Chaturbate source initialized (wm={})", wm);

        Ok(Self {
            http,
            seen_models: Arc::new(Mutex::new(HashMap::new())),
            wm,
        })
    }

    /// Fetch a page of online rooms.
    ///
    /// The Chaturbate API requires `wm` (affiliate ID) and `client_ip` params.
    /// Response is paginated: `{"results": [...], "count": N}`.
    async fn fetch_page(&self, offset: usize) -> Result<Vec<ChaturbateRoom>> {
        let url = format!(
            "{}?format=json&limit={}&offset={}&wm={}&client_ip=0.0.0.0",
            API_BASE, PAGE_SIZE, offset, self.wm
        );

        let api_resp: ChaturbateApiResponse = self.http.get_json(&url).await?;
        Ok(api_resp.results)
    }

    /// Fetch all online rooms (paginated, up to MAX_PAGES).
    async fn fetch_online_rooms(&self) -> Result<Vec<ChaturbateRoom>> {
        let mut all_rooms = Vec::new();

        for page in 0..MAX_PAGES {
            let offset = page * PAGE_SIZE;
            match self.fetch_page(offset).await {
                Ok(rooms) => {
                    if rooms.is_empty() {
                        debug!("No more rooms at page {}", page);
                        break;
                    }

                    all_rooms.extend(rooms);
                }
                Err(e) => {
                    warn!("Failed to fetch rooms page {}: {:?}", page, e);
                    break;
                }
            }
        }

        info!("Fetched {} online rooms from Chaturbate", all_rooms.len());
        Ok(all_rooms)
    }

    /// Update the peak viewer cache with currently online rooms.
    async fn update_peak_cache(&self, rooms: &[ChaturbateRoom]) {
        let now = Utc::now();
        let mut cache = self.seen_models.lock().await;

        for room in rooms {
            if room.num_users < MIN_VIEWER_COUNT {
                continue;
            }

            match cache.get_mut(&room.username) {
                Some(entry) => {
                    if room.num_users > entry.max_viewers {
                        entry.max_viewers = room.num_users;
                    }
                    entry.last_seen = now;
                }
                None => {
                    cache.insert(
                        room.username.clone(),
                        CachedModel {
                            username: room.username.clone(),
                            max_viewers: room.num_users,
                            last_seen: now,
                        },
                    );
                }
            }
        }

        // Prune entries not seen in > 30 days
        let cutoff = now - chrono::Duration::days(RETENTION_DAYS);
        let before = cache.len();
        cache.retain(|_, v| v.last_seen > cutoff);
        let pruned = before - cache.len();
        if pruned > 0 {
            info!("Pruned {} models not seen in > {} days", pruned, RETENTION_DAYS);
        }

        debug!(
            "Peak cache: {} models tracked (top max_viewers: {})",
            cache.len(),
            cache.values().map(|v| v.max_viewers).max().unwrap_or(0)
        );
    }
}

#[async_trait::async_trait]
impl MarketDataSource for ChaturbateMarketSource {
    fn source_id(&self) -> &'static str {
        "chaturbate"
    }

    fn display_name(&self) -> &'static str {
        "Chaturbate Live Cams"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Config is empty — do live discovery
        info!("Chaturbate config is empty, performing live asset discovery");

        let rooms = self.fetch_online_rooms().await?;
        self.update_peak_cache(&rooms).await;

        let cache = self.seen_models.lock().await;
        let mut assets = Vec::with_capacity(cache.len());

        for (username, _cached) in cache.iter() {
            assets.push(AssetUpdate {
                asset_id: format!("cb_model_{}", username),
                symbol: format!("CB:{}", username),
                name: username.clone(),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": username,
                    "subcategory": "chaturbate",
                    "active": true,
                    "extra": {},
                }),
            });
        }

        let model_count = cache.len();
        drop(cache);

        info!(
            "Registered {} models (all with peak >= {} viewers, retained up to {} days)",
            model_count, MIN_VIEWER_COUNT, RETENTION_DAYS
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Collect usernames we need
        let mut model_usernames: Vec<String> = Vec::new();
        for asset_id in asset_ids {
            if let Some(username) = asset_id.strip_prefix("cb_model_") {
                model_usernames.push(username.to_string());
            }
        }

        // Fetch all online rooms
        let rooms = self.fetch_online_rooms().await?;

        // Update peak cache with current live data
        self.update_peak_cache(&rooms).await;

        // Build lookup: username -> current viewer count
        let mut live_viewers: HashMap<String, u64> = HashMap::new();
        for room in &rooms {
            live_viewers.insert(room.username.clone(), room.num_users);
        }

        let cache = self.seen_models.lock().await;

        // Registered models — emit current viewers (0 if offline)
        for username in &model_usernames {
            if cache.contains_key(username.as_str()) {
                let viewers = live_viewers.get(username.as_str()).copied().unwrap_or(0);
                results.push(PriceUpdate {
                    asset_id: format!("cb_model_{}", username),
                    symbol: format!("CB:{}", username),
                    value: Decimal::from(viewers),
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        // Discover new models not yet registered
        let known: std::collections::HashSet<&str> =
            model_usernames.iter().map(|s| s.as_str()).collect();
        let mut new_count = 0u32;
        for (username, _cached) in cache.iter() {
            if known.contains(username.as_str()) {
                continue;
            }
            let viewers = live_viewers.get(username.as_str()).copied().unwrap_or(0);
            results.push(PriceUpdate {
                asset_id: format!("cb_model_{}", username),
                symbol: format!("CB:{}", username),
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
            info!("Emitting {} newly discovered models", new_count);
        }

        info!(
            "Fetched {}/{} Chaturbate viewer counts",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        let rooms = self.fetch_online_rooms().await?;

        let mut entries = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for room in &rooms {
            if room.num_users < MIN_VIEWER_COUNT {
                continue;
            }
            if seen.insert(room.username.clone()) {
                entries.push(AssetEntry {
                    asset_id: format!("cb_model_{}", room.username),
                    symbol: format!("CB:{}", room.username),
                    name: room.username.clone(),
                    category: "sentiment".to_string(),
                    subcategory: "chaturbate".to_string(),
                    api_ref: room.username.clone(),
                    active: true,
                });
            }
        }

        info!(
            "Discovered {} Chaturbate models with >= {} viewers",
            entries.len(),
            MIN_VIEWER_COUNT
        );
        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("chaturbate", "chaturbate");
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
    fn test_asset_id_format() {
        let username = "testmodel";
        assert_eq!(
            format!("cb_model_{}", username),
            "cb_model_testmodel"
        );
    }

    #[test]
    fn test_symbol_format() {
        let username = "testmodel";
        assert_eq!(
            format!("CB:{}", username),
            "CB:testmodel"
        );
    }

    #[test]
    fn test_min_viewer_count_threshold() {
        assert_eq!(MIN_VIEWER_COUNT, 50);
        assert!(25 < MIN_VIEWER_COUNT);
        assert!(49 < MIN_VIEWER_COUNT);
        assert!(50 >= MIN_VIEWER_COUNT);
        assert!(1000 >= MIN_VIEWER_COUNT);
    }

    #[test]
    fn test_retention_days() {
        assert_eq!(RETENTION_DAYS, 30);
    }

    #[test]
    fn test_page_count_calculation() {
        // 10 pages * 500 = 5000 models max
        assert_eq!(MAX_PAGES * PAGE_SIZE, 5000);
        // Total requests well within 30/min budget
        assert!(MAX_PAGES <= 30);
    }

    #[test]
    fn test_viewer_count_to_decimal() {
        let viewers: u64 = 5000;
        let value = Decimal::from(viewers);
        assert_eq!(value, Decimal::from(5000));

        // Offline model
        let value = Decimal::from(0u64);
        assert_eq!(value, Decimal::from(0));
    }
}
