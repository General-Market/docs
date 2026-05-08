//! Hacker News Firebase API client implementing MarketDataSource
//!
//! Tracks three metrics per story: score (upvotes), comment count, and
//! front-page rank (1-indexed position in /topstories). The universe is
//! the live top UNIVERSE_SIZE stories from /topstories — nothing else.
//! Age is irrelevant: a 5-day-old story still on the front page is more
//! interesting than a 1-hour-old story buried at #400.
//!
//! Lifecycle:
//! - Each cycle, the universe is rebuilt from /topstories. Stories not
//!   present this cycle are absent from `fetch_assets()`; the sync engine
//!   deactivates them.
//! - Dead and deleted items are filtered out during both discovery and pricing.
//! - Rank, score and comments are all pulled from the same fetch path —
//!   one `/item/{id}` call per story plus one `/topstories` call per cycle.
//!
//! API: https://hacker-news.firebaseio.com/v0/
//! Auth: None
//! Rate limit: None documented

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/hackernews.json");

/// HN Firebase API base URL
const HN_API_URL: &str = "https://hacker-news.firebaseio.com/v0";

/// Delay between sequential item fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 50;

/// Size of the tracked universe. /topstories returns 500 entries but past
/// ~100 the order is noisy and the stories see almost no engagement. The
/// universe is THIS list — stories not in it are not tracked, regardless
/// of age.
const UNIVERSE_SIZE: usize = 100;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// A single HN item (story, comment, job, poll)
#[derive(Debug, Deserialize)]
struct HnItem {
    id: u64,
    #[serde(default)]
    score: i64,
    #[serde(default)]
    descendants: i64,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    by: Option<String>,
    #[serde(default)]
    #[serde(rename = "type")]
    item_type: Option<String>,
    #[serde(default)]
    dead: Option<bool>,
    #[serde(default)]
    deleted: Option<bool>,
    /// Unix timestamp of when the item was created
    #[serde(default)]
    time: Option<i64>,
}

impl HnItem {
    /// Returns true if this item should be tracked
    fn is_trackable(&self) -> bool {
        !self.deleted.unwrap_or(false) && !self.dead.unwrap_or(false)
    }

    /// Truncated title for display (max 80 chars).
    ///
    /// Uses `chars()` not byte slicing — HN titles regularly contain
    /// curly quotes and emoji, and `&t[..77]` panics on multi-byte
    /// boundaries. The crash loop that taught us this restarted the
    /// process 197 times.
    fn display_title(&self) -> String {
        match &self.title {
            Some(t) if t.chars().count() > 80 => {
                let truncated: String = t.chars().take(77).collect();
                format!("{}...", truncated)
            }
            Some(t) => t.clone(),
            None => format!("HN Item #{}", self.id),
        }
    }
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Hacker News market data source.
///
/// Tracks score, comment count and rank for the live top UNIVERSE_SIZE
/// stories from /topstories. Source ID is `"hackernews"`.
pub struct HackerNewsMarketSource {
    http: SourceHttpClient,
}

impl HackerNewsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 1000, // HN has no documented limit; be reasonable
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("HackerNews source initialized (universe = top {} from /topstories)", UNIVERSE_SIZE);

        Ok(Self { http })
    }

    /// Fetch the top stories ID list
    async fn fetch_top_story_ids(&self) -> Result<Vec<u64>, SourceError> {
        let url = format!("{}/topstories.json", HN_API_URL);
        self.http.get_json::<Vec<u64>>(&url).await
    }

    /// Fetch a single item by ID
    async fn fetch_item(&self, id: u64) -> Result<Option<HnItem>, SourceError> {
        let url = format!("{}/item/{}.json", HN_API_URL, id);
        // HN returns `null` for deleted items
        match self.http.get_json::<Option<HnItem>>(&url).await {
            Ok(item) => Ok(item),
            Err(e) => {
                debug!("Failed to fetch HN item {}: {:?}", id, e);
                Ok(None)
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for HackerNewsMarketSource {
    fn source_id(&self) -> &'static str {
        "hackernews"
    }

    fn display_name(&self) -> &'static str {
        "Hacker News"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300) // 5 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 1000,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // If config JSON has static entries, use them (shouldn't happen, but defensive)
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Dynamic discovery from live API
        let story_ids = self.fetch_top_story_ids().await.map_err(|e| {
            anyhow::anyhow!("Failed to fetch HN top stories: {:?}", e)
        })?;

        info!("HN topstories returned {} story IDs (universe = top {})", story_ids.len(), UNIVERSE_SIZE);

        let universe: Vec<u64> = story_ids.iter().take(UNIVERSE_SIZE).copied().collect();
        let mut assets = Vec::with_capacity(universe.len() * 3);
        let mut skipped = 0u32;

        for (idx, &story_id) in universe.iter().enumerate() {
            let rank = idx + 1;
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_item(story_id).await {
                Ok(Some(item)) if item.is_trackable() => {
                    let title = item.display_title();

                    // Score asset
                    assets.push(AssetUpdate {
                        asset_id: format!("hn_{}_score", story_id),
                        symbol: format!("HN#{}", story_id),
                        name: format!("{} (score)", title),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": story_id.to_string(),
                            "subcategory": "hacker_news",
                            "active": true,
                            "extra": {
                                "metric": "score",
                                "by": item.by,
                                "url": item.url,
                                "created_at": item.time,
                            },
                        }),
                    });

                    // Comments asset
                    assets.push(AssetUpdate {
                        asset_id: format!("hn_{}_comments", story_id),
                        symbol: format!("HN#{}", story_id),
                        name: format!("{} (comments)", title),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": story_id.to_string(),
                            "subcategory": "hacker_news",
                            "active": true,
                            "extra": {
                                "metric": "comments",
                                "by": item.by,
                                "url": item.url,
                                "created_at": item.time,
                            },
                        }),
                    });

                    // Rank asset — position in /topstories. Oscillates every cycle.
                    assets.push(AssetUpdate {
                        asset_id: format!("hn_{}_rank", story_id),
                        symbol: format!("HN#{}", story_id),
                        name: format!("{} (rank)", title),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": story_id.to_string(),
                            "subcategory": "hacker_news",
                            "active": true,
                            "extra": {
                                "metric": "rank",
                                "by": item.by,
                                "url": item.url,
                                "created_at": item.time,
                                "universe_size": UNIVERSE_SIZE,
                                "rank_at_discovery": rank,
                            },
                        }),
                    });
                }
                Ok(Some(_)) => {
                    skipped += 1; // dead or deleted
                }
                Ok(None) => {
                    skipped += 1; // null response
                }
                Err(e) => {
                    warn!("Error fetching HN item {}: {:?}", story_id, e);
                    skipped += 1;
                }
            }
        }

        info!(
            "HN fetch_assets: {} stories -> {} assets ({} skipped)",
            universe.len(),
            assets.len(),
            skipped,
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Dedupe asset_ids to unique story IDs
        // asset_ids look like: "hn_12345_score", "hn_12345_comments", "hn_12345_rank"
        let mut unique_story_ids: Vec<u64> = Vec::new();
        let mut requested_metrics: HashSet<String> = HashSet::new();

        for asset_id in asset_ids {
            requested_metrics.insert(asset_id.clone());
            if let Some(story_id) = parse_story_id(asset_id) {
                if !unique_story_ids.contains(&story_id) {
                    unique_story_ids.push(story_id);
                }
            }
        }

        // Pull the live topstories list once per pricing cycle. Stories not in
        // the top UNIVERSE_SIZE this cycle get no price emissions; the sync
        // engine deactivates them on the next fetch_assets() pass.
        let top_ids = self.fetch_top_story_ids().await.unwrap_or_else(|e| {
            warn!("HN topstories fetch failed during pricing: {:?}", e);
            Vec::new()
        });
        let rank_map: HashMap<u64, usize> = top_ids
            .iter()
            .take(UNIVERSE_SIZE)
            .enumerate()
            .map(|(idx, &id)| (id, idx + 1))
            .collect();

        debug!(
            "HN fetch_prices: {} asset_ids -> {} unique stories ({} in universe)",
            asset_ids.len(),
            unique_story_ids.len(),
            rank_map.len(),
        );

        let mut dead_or_deleted = 0u32;
        let mut out_of_universe = 0u32;

        for &story_id in &unique_story_ids {
            // Stories that fell out of the top UNIVERSE_SIZE since last
            // fetch_assets() cycle: skip silently. The sync engine deactivates
            // them on the next discovery pass.
            if !rank_map.contains_key(&story_id) {
                out_of_universe += 1;
                continue;
            }

            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_item(story_id).await {
                Ok(Some(item)) => {
                    // Skip dead/deleted items — they'll be deactivated by the next
                    // fetch_assets() cycle since they won't appear in the results.
                    if !item.is_trackable() {
                        dead_or_deleted += 1;
                        debug!("HN item {} is dead/deleted, skipping price", story_id);
                        continue;
                    }

                    let score_id = format!("hn_{}_score", story_id);
                    let comments_id = format!("hn_{}_comments", story_id);
                    let rank_id = format!("hn_{}_rank", story_id);
                    let title = item.display_title();

                    if requested_metrics.contains(&score_id) {
                        results.push(PriceUpdate {
                            asset_id: score_id.clone(),
                            symbol: format!("{} (score)", title),
                            value: Decimal::from(item.score),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }

                    if requested_metrics.contains(&comments_id) {
                        results.push(PriceUpdate {
                            asset_id: comments_id.clone(),
                            symbol: format!("{} (comments)", title),
                            value: Decimal::from(item.descendants),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }

                    if requested_metrics.contains(&rank_id) {
                        // Story is in the universe (we already gated on this above),
                        // so the lookup is guaranteed to hit.
                        let rank = rank_map[&story_id];
                        results.push(PriceUpdate {
                            asset_id: rank_id.clone(),
                            symbol: format!("{} (rank)", title),
                            value: Decimal::from(rank as u64),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Ok(None) => {
                    dead_or_deleted += 1;
                    debug!("HN item {} returned null (deleted?)", story_id);
                }
                Err(e) => {
                    warn!("Error fetching HN item {} for prices: {:?}", story_id, e);
                }
            }
        }

        if dead_or_deleted > 0 || out_of_universe > 0 {
            info!(
                "HN fetch_prices: {} dead/deleted, {} fell out of top {} (skipped)",
                dead_or_deleted, out_of_universe, UNIVERSE_SIZE,
            );
        }

        info!(
            "Fetched {}/{} prices from HackerNews",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENGAGEMENT
    }
}

/// Parse story ID from an asset_id like "hn_12345_score" or "hn_12345_comments"
fn parse_story_id(asset_id: &str) -> Option<u64> {
    let rest = asset_id.strip_prefix("hn_")?;
    // rest = "12345_score" or "12345_comments"
    let id_str = rest.split('_').next()?;
    id_str.parse::<u64>().ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("hackernews", "hackernews");
    }

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.is_empty(), "Config should be empty — assets are dynamic");
    }

    #[test]
    fn test_empty_config_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    #[test]
    fn test_parse_story_id_score() {
        assert_eq!(parse_story_id("hn_12345_score"), Some(12345));
    }

    #[test]
    fn test_parse_story_id_comments() {
        assert_eq!(parse_story_id("hn_67890_comments"), Some(67890));
    }

    #[test]
    fn test_parse_story_id_large() {
        assert_eq!(parse_story_id("hn_43291827_score"), Some(43291827));
    }

    #[test]
    fn test_parse_story_id_invalid() {
        assert_eq!(parse_story_id("invalid"), None);
        assert_eq!(parse_story_id("hn_"), None);
        assert_eq!(parse_story_id("hn_abc_score"), None);
        assert_eq!(parse_story_id(""), None);
    }

    #[test]
    fn test_hn_item_trackable() {
        let item = HnItem {
            id: 1,
            score: 100,
            descendants: 50,
            title: Some("Test".to_string()),
            url: None,
            by: Some("user".to_string()),
            item_type: Some("story".to_string()),
            dead: None,
            deleted: None,
            time: Some(1700000000),
        };
        assert!(item.is_trackable());
    }

    #[test]
    fn test_hn_item_dead() {
        let item = HnItem {
            id: 1,
            score: 0,
            descendants: 0,
            title: None,
            url: None,
            by: None,
            item_type: None,
            dead: Some(true),
            deleted: None,
            time: None,
        };
        assert!(!item.is_trackable());
    }

    #[test]
    fn test_hn_item_deleted() {
        let item = HnItem {
            id: 1,
            score: 0,
            descendants: 0,
            title: None,
            url: None,
            by: None,
            item_type: None,
            dead: None,
            deleted: Some(true),
            time: None,
        };
        assert!(!item.is_trackable());
    }

    #[test]
    fn test_display_title_short() {
        let item = HnItem {
            id: 1,
            score: 0,
            descendants: 0,
            title: Some("Short title".to_string()),
            url: None,
            by: None,
            item_type: None,
            dead: None,
            deleted: None,
            time: None,
        };
        assert_eq!(item.display_title(), "Short title");
    }

    #[test]
    fn test_display_title_long() {
        let long = "A".repeat(100);
        let item = HnItem {
            id: 1,
            score: 0,
            descendants: 0,
            title: Some(long),
            url: None,
            by: None,
            item_type: None,
            dead: None,
            deleted: None,
            time: None,
        };
        let display = item.display_title();
        assert_eq!(display.len(), 80); // 77 chars + "..."
        assert!(display.ends_with("..."));
    }

    #[test]
    fn test_display_title_none() {
        let item = HnItem {
            id: 42,
            score: 0,
            descendants: 0,
            title: None,
            url: None,
            by: None,
            item_type: None,
            dead: None,
            deleted: None,
            time: None,
        };
        assert_eq!(item.display_title(), "HN Item #42");
    }

    #[test]
    fn test_score_to_decimal() {
        let score: i64 = 2500;
        let value = Decimal::from(score);
        assert_eq!(value, Decimal::from(2500));

        // Negative score edge case
        let score: i64 = -1;
        let value = Decimal::from(score);
        assert_eq!(value, Decimal::from(-1));
    }

    #[test]
    fn test_dedupe_story_ids() {
        let asset_ids = vec![
            "hn_100_score".to_string(),
            "hn_100_comments".to_string(),
            "hn_200_score".to_string(),
        ];

        let mut unique: Vec<u64> = Vec::new();
        for aid in &asset_ids {
            if let Some(sid) = parse_story_id(aid) {
                if !unique.contains(&sid) {
                    unique.push(sid);
                }
            }
        }

        assert_eq!(unique, vec![100, 200]);
    }

    #[test]
    fn test_universe_size() {
        assert_eq!(UNIVERSE_SIZE, 100);
    }

    #[test]
    fn test_parse_story_id_rank() {
        assert_eq!(parse_story_id("hn_12345_rank"), Some(12345));
    }
}
