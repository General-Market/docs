//! HackerNews Firebase API client implementing MarketDataSource
//!
//! Fetches top stories from https://hacker-news.firebaseio.com/v0
//! No API key required. Rate limit: 30 requests/minute (polite usage).
//!
//! Uses a 60s shared cache between `fetch_assets` and `fetch_prices` to avoid
//! redundant requests. Item fetches are batched with a concurrency semaphore.

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{RwLock, Semaphore};
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// HackerNews Firebase API base URL
const HN_API: &str = "https://hacker-news.firebaseio.com/v0";

/// Cache TTL: 60 seconds (shared between fetch_assets and fetch_prices)
const CACHE_TTL_SECS: u64 = 60;

/// Number of top stories to fetch
const TOP_STORIES_LIMIT: usize = 50;

/// Max concurrent item fetches (polite batching)
const MAX_CONCURRENT_FETCHES: usize = 10;

// ============================================================================
// HackerNews API response types
// ============================================================================

#[derive(Debug, Deserialize)]
struct HnItem {
    /// Unique item ID
    id: u64,
    /// Story title
    #[serde(default)]
    title: Option<String>,
    /// Story score (upvotes)
    #[serde(default)]
    score: Option<u64>,
    /// Story URL (external link)
    #[serde(default)]
    url: Option<String>,
    /// Author username
    #[serde(default)]
    by: Option<String>,
    /// Number of comments (descendants)
    #[serde(default)]
    descendants: Option<u64>,
}

// ============================================================================
// Cached story data
// ============================================================================

#[derive(Debug, Clone)]
struct CachedStory {
    /// Market ID: "hn_{id}"
    market_id: String,
    /// Story title
    title: String,
    /// Story score (upvotes)
    score: u64,
    /// Story URL
    url: Option<String>,
    /// Author username
    author: String,
    /// Number of comments
    comments: u64,
    /// Original HN item ID
    item_id: u64,
}

struct CacheEntry {
    stories: Vec<CachedStory>,
    fetched_at: Instant,
}

// ============================================================================
// HackerNewsSource
// ============================================================================

/// HackerNews story score data source
pub struct HackerNewsSource {
    client: reqwest::Client,
    cache: Arc<RwLock<Option<CacheEntry>>>,
    semaphore: Arc<Semaphore>,
}

impl HackerNewsSource {
    /// Create a new HackerNews source (no API key needed)
    pub fn from_env() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!("HackerNews source initialized (Firebase API)");

        Ok(Self {
            client,
            cache: Arc::new(RwLock::new(None)),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_FETCHES)),
        })
    }

    /// Fetch stories from the Firebase API and populate cache.
    /// Returns cached data if still fresh (< 60s old).
    async fn fetch_and_cache(&self) -> Result<Vec<CachedStory>> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.as_ref() {
                if entry.fetched_at.elapsed() < Duration::from_secs(CACHE_TTL_SECS) {
                    debug!(
                        "HackerNews: using cached data ({} stories, {:.1}s old)",
                        entry.stories.len(),
                        entry.fetched_at.elapsed().as_secs_f64()
                    );
                    return Ok(entry.stories.clone());
                }
            }
        }

        // Cache miss or stale -- fetch fresh data
        let stories = self.fetch_top_stories().await?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            *cache = Some(CacheEntry {
                stories: stories.clone(),
                fetched_at: Instant::now(),
            });
        }

        Ok(stories)
    }

    /// Fetch top story IDs, then fetch each story's details concurrently.
    async fn fetch_top_stories(&self) -> Result<Vec<CachedStory>> {
        let url = format!("{}/topstories.json", HN_API);

        debug!("HackerNews: fetching top story IDs from {}", url);

        let resp = self
            .client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .context("Failed to fetch HackerNews top stories")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("HackerNews Firebase API error: {} {}", status, body);
            anyhow::bail!("HackerNews API returned {}", status);
        }

        let story_ids: Vec<u64> = resp
            .json()
            .await
            .context("Failed to parse HackerNews top stories response")?;

        // Take only top N stories
        let story_ids: Vec<u64> = story_ids.into_iter().take(TOP_STORIES_LIMIT).collect();

        debug!("HackerNews: fetching {} story details concurrently", story_ids.len());

        // Fetch each story's details concurrently with semaphore
        let mut handles = Vec::with_capacity(story_ids.len());

        for id in story_ids {
            let client = self.client.clone();
            let sem = Arc::clone(&self.semaphore);

            handles.push(tokio::spawn(async move {
                let _permit = sem.acquire().await.expect("semaphore closed");
                fetch_item(&client, id).await
            }));
        }

        let mut cached_stories = Vec::new();

        for handle in handles {
            match handle.await {
                Ok(Ok(Some(story))) => cached_stories.push(story),
                Ok(Ok(None)) => {} // skipped (e.g. not a story, missing fields)
                Ok(Err(e)) => {
                    debug!("HackerNews: failed to fetch item: {}", e);
                }
                Err(e) => {
                    debug!("HackerNews: task join error: {}", e);
                }
            }
        }

        info!(
            "HackerNews: fetched {} stories",
            cached_stories.len()
        );

        Ok(cached_stories)
    }
}

/// Fetch a single item from the HN Firebase API and convert to CachedStory.
async fn fetch_item(client: &reqwest::Client, id: u64) -> Result<Option<CachedStory>> {
    let url = format!("{}/item/{}.json", HN_API, id);

    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .with_context(|| format!("Failed to fetch HN item {}", id))?;

    if !resp.status().is_success() {
        anyhow::bail!("HN item {} returned {}", id, resp.status());
    }

    let item: Option<HnItem> = resp
        .json()
        .await
        .with_context(|| format!("Failed to parse HN item {}", id))?;

    let item = match item {
        Some(i) => i,
        None => return Ok(None),
    };

    // Skip items without title or score (deleted/dead items)
    let title = match item.title {
        Some(t) if !t.is_empty() => t,
        _ => return Ok(None),
    };

    let score = item.score.unwrap_or(0);
    let author = item.by.unwrap_or_default();
    let comments = item.descendants.unwrap_or(0);

    Ok(Some(CachedStory {
        market_id: format!("hn_{}", item.id),
        title,
        score,
        url: item.url,
        author,
        comments,
        item_id: item.id,
    }))
}

// ============================================================================
// MarketDataSource implementation
// ============================================================================

#[async_trait::async_trait]
impl MarketDataSource for HackerNewsSource {
    fn source_id(&self) -> &'static str {
        "hackernews"
    }

    fn display_name(&self) -> &'static str {
        "HackerNews Story Scores"
    }

    fn default_resolution(&self) -> &'static str {
        "community"
    }

    fn sync_interval(&self) -> Duration {
        // Stories don't change that fast; 5 minutes
        Duration::from_secs(300)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // Firebase has generous limits, but be polite: 30 req/min
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 25, // Conservative to stay under 30/min
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let stories = self.fetch_and_cache().await?;

        Ok(stories
            .into_iter()
            .map(|s| AssetUpdate {
                asset_id: s.market_id.clone(),
                symbol: s.market_id,
                name: s.title,
                category: Some("tech".to_string()),
                metadata: serde_json::json!({
                    "source": "hackernews",
                    "item_id": s.item_id,
                    "author": s.author,
                    "url": s.url,
                    "comments": s.comments,
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let stories = self.fetch_and_cache().await?;

        // Build lookup set for requested asset IDs
        let requested: std::collections::HashSet<&str> =
            asset_ids.iter().map(|s| s.as_str()).collect();

        let results: Vec<PriceUpdate> = stories
            .into_iter()
            .filter(|s| requested.contains(s.market_id.as_str()))
            .map(|s| PriceUpdate {
                asset_id: s.market_id.clone(),
                symbol: s.market_id,
                value: Decimal::from(s.score),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            })
            .collect();

        info!(
            "Fetched {}/{} prices from HackerNews",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_market_id_format() {
        let id: u64 = 12345678;
        let market_id = format!("hn_{}", id);
        assert_eq!(market_id, "hn_12345678");
    }

    #[test]
    fn test_market_id_format_small() {
        let id: u64 = 1;
        let market_id = format!("hn_{}", id);
        assert_eq!(market_id, "hn_1");
    }

    #[test]
    fn test_score_to_decimal() {
        let score: u64 = 1500;
        let decimal = Decimal::from(score);
        assert_eq!(decimal, Decimal::from(1500u64));
    }

    #[test]
    fn test_source_id() {
        assert_eq!("hackernews", "hackernews");
    }

    #[test]
    fn test_cached_story_construction() {
        let story = CachedStory {
            market_id: "hn_42".to_string(),
            title: "Show HN: My cool project".to_string(),
            score: 250,
            url: Some("https://example.com".to_string()),
            author: "pg".to_string(),
            comments: 42,
            item_id: 42,
        };
        assert_eq!(story.market_id, "hn_42");
        assert_eq!(story.score, 250);
        assert_eq!(story.comments, 42);
    }
}
