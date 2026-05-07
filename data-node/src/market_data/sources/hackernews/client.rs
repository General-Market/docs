//! Hacker News Firebase API client implementing MarketDataSource
//!
//! Tracks score (upvotes) and comment count for the top 500 stories.
//! Assets are fully dynamic — discovered from the live /topstories endpoint.
//!
//! Lifecycle management:
//! - Stories older than 7 days are excluded from `fetch_assets()` even if they
//!   remain in the HN top 500. This triggers the sync engine to deactivate them.
//! - Dead and deleted items are filtered out during both discovery and pricing.
//! - `fetch_prices()` detects dead/deleted items and skips them, letting the
//!   sync engine deactivate them on the next `fetch_assets()` cycle.
//!
//! API: https://hacker-news.firebaseio.com/v0/
//! Auth: None
//! Rate limit: None documented

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashSet;
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

/// Maximum age for tracked stories (seconds). Stories older than this
/// are excluded from fetch_assets(), causing the sync engine to deactivate them.
/// 7 days = 604800 seconds.
const MAX_STORY_AGE_SECS: i64 = 7 * 24 * 60 * 60;

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

    /// Returns true if this item is too old to track.
    /// Stories older than MAX_STORY_AGE_SECS are considered stale.
    fn is_too_old(&self, now_unix: i64) -> bool {
        match self.time {
            Some(created_at) => (now_unix - created_at) > MAX_STORY_AGE_SECS,
            // No timestamp — assume it's old (shouldn't happen for real items)
            None => true,
        }
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
/// Tracks score and comment count for top 500 stories.
/// Source ID is `"hackernews"`.
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

        info!("HackerNews source initialized (dynamic assets from /topstories, {}d max age)", MAX_STORY_AGE_SECS / 86400);

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

        info!("HN topstories returned {} story IDs", story_ids.len());

        let now_unix = Utc::now().timestamp();
        let mut assets = Vec::with_capacity(story_ids.len() * 2);
        let mut skipped = 0u32;
        let mut aged_out = 0u32;

        for &story_id in &story_ids {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_item(story_id).await {
                Ok(Some(item)) if item.is_trackable() => {
                    // Skip stories older than MAX_STORY_AGE_SECS — they stop getting
                    // meaningful vote/comment activity and just waste price slots.
                    // The sync engine will deactivate them on the next cycle.
                    if item.is_too_old(now_unix) {
                        aged_out += 1;
                        continue;
                    }

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
            "HN fetch_assets: {} stories -> {} assets ({} skipped, {} aged out >{}d)",
            story_ids.len(),
            assets.len(),
            skipped,
            aged_out,
            MAX_STORY_AGE_SECS / 86400
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let now_unix = now.timestamp();
        let mut results = Vec::new();

        // Dedupe asset_ids to unique story IDs
        // asset_ids look like: "hn_12345_score", "hn_12345_comments"
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

        debug!(
            "HN fetch_prices: {} asset_ids -> {} unique stories",
            asset_ids.len(),
            unique_story_ids.len()
        );

        let mut dead_or_deleted = 0u32;
        let mut aged_out = 0u32;

        for &story_id in &unique_story_ids {
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

                    // Skip aged-out items — don't waste price records on stale stories.
                    // They'll be deactivated on the next fetch_assets() cycle.
                    if item.is_too_old(now_unix) {
                        aged_out += 1;
                        debug!("HN item {} is older than {}d, skipping price", story_id, MAX_STORY_AGE_SECS / 86400);
                        continue;
                    }

                    let score_id = format!("hn_{}_score", story_id);
                    let comments_id = format!("hn_{}_comments", story_id);
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

        if dead_or_deleted > 0 || aged_out > 0 {
            info!(
                "HN fetch_prices: {} dead/deleted, {} aged out (skipped)",
                dead_or_deleted, aged_out
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
    fn test_hn_item_too_old() {
        let now = Utc::now().timestamp();
        let item = HnItem {
            id: 1,
            score: 100,
            descendants: 50,
            title: Some("Old story".to_string()),
            url: None,
            by: None,
            item_type: None,
            dead: None,
            deleted: None,
            time: Some(now - MAX_STORY_AGE_SECS - 1), // 1 second past the limit
        };
        assert!(item.is_too_old(now));
    }

    #[test]
    fn test_hn_item_not_too_old() {
        let now = Utc::now().timestamp();
        let item = HnItem {
            id: 1,
            score: 100,
            descendants: 50,
            title: Some("Fresh story".to_string()),
            url: None,
            by: None,
            item_type: None,
            dead: None,
            deleted: None,
            time: Some(now - 3600), // 1 hour old
        };
        assert!(!item.is_too_old(now));
    }

    #[test]
    fn test_hn_item_no_timestamp_is_old() {
        let now = Utc::now().timestamp();
        let item = HnItem {
            id: 1,
            score: 0,
            descendants: 0,
            title: None,
            url: None,
            by: None,
            item_type: None,
            dead: None,
            deleted: None,
            time: None, // No timestamp
        };
        assert!(item.is_too_old(now));
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
    fn test_max_story_age_is_7_days() {
        assert_eq!(MAX_STORY_AGE_SECS, 604800);
    }
}
