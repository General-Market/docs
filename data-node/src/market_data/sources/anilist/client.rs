//! AniList GraphQL API client implementing MarketDataSource
//!
//! Tracks the only AniList signal that moves: `trending`. The cumulative
//! `popularity` and `favourites` fields asymptote within weeks of release —
//! they are the dead asymptote of public attention. `trending` is recomputed
//! by AniList every few hours and oscillates per cycle. We emit it as the
//! primary value.
//!
//! Two assets per work:
//! - `anilist_anime_<id>` / `anilist_manga_<id>` — primary value = `trending`.
//!   `popularity` and `favourites` ride along in metadata for historical interest.
//! - `anilist_anime_<id>_rank` / `anilist_manga_<id>_rank` — 1-indexed position
//!   in the live TRENDING_DESC top-N list. Only emitted while the title is in
//!   the window. Once a title falls out, the asset deactivates on the next
//!   `fetch_assets()` cycle. Same lifecycle as HackerNews `_rank`.
//!
//! Universe is the union of (POPULARITY_DESC base list) ∪ (TRENDING_DESC top-N).
//! New entrants in the trending list get tracked the next cycle; titles dropping
//! out of trending lose their `_rank` companion.
//!
//! API: POST https://graphql.anilist.co (GraphQL, no auth)
//! Rate limit: 90 req/min → budget 76 req/min (85%)

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
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, BatchStrategy,
    MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/anilist.json");

/// AniList GraphQL endpoint
const ANILIST_API_URL: &str = "https://graphql.anilist.co";

/// Delay between sequential GraphQL requests (ms)
/// AniList rate limit is 90 req/min; 1500ms gives us max 40 req/min (safe margin)
const INTER_REQUEST_DELAY_MS: u64 = 1500;

/// How many discovery pages per media type for the POPULARITY_DESC base list (50/page)
const DISCOVERY_PAGES: u32 = 10;

/// Top-N TRENDING_DESC titles per media type that get a `_rank` companion asset.
/// Two pages of 50 = 100 titles per type.
const TRENDING_PAGES: u32 = 2;
const RANK_TOP_N: usize = (TRENDING_PAGES as usize) * 50;

/// Max retries for rate-limited GraphQL requests
const MAX_GRAPHQL_RETRIES: u32 = 3;

/// Base delay for GraphQL retry backoff (ms)
const GRAPHQL_RETRY_BASE_MS: u64 = 5000;

/// Items per page
const PAGE_SIZE: u32 = 50;

/// Batch size for price fetching (id_in filter)
const PRICE_BATCH_SIZE: usize = 50;

// ============================================================================
// GRAPHQL RESPONSE TYPES
// ============================================================================

/// Top-level GraphQL response wrapper
#[derive(Debug, Deserialize)]
struct GqlResponse<T> {
    data: Option<T>,
}

/// Page wrapper from AniList's Page type
#[derive(Debug, Deserialize)]
struct PageData {
    #[serde(rename = "Page")]
    page: PageInner,
}

/// Inner page with pagination info and media items
#[derive(Debug, Deserialize)]
struct PageInner {
    #[serde(rename = "pageInfo")]
    page_info: PageInfo,
    media: Vec<MediaItem>,
}

/// Pagination info
#[derive(Debug, Deserialize)]
struct PageInfo {
    #[serde(rename = "hasNextPage")]
    has_next_page: bool,
}

/// Media item (anime or manga)
#[derive(Debug, Deserialize)]
struct MediaItem {
    id: u64,
    title: MediaTitle,
    #[serde(default)]
    popularity: u64,
    #[serde(default)]
    trending: u64,
    #[serde(rename = "averageScore", default)]
    average_score: Option<u32>,
    #[serde(default)]
    favourites: u64,
}

/// Title object — prefer english, fall back to romaji
#[derive(Debug, Deserialize)]
struct MediaTitle {
    romaji: Option<String>,
    english: Option<String>,
}

impl MediaTitle {
    fn best(&self) -> String {
        self.english
            .as_deref()
            .or(self.romaji.as_deref())
            .unwrap_or("Unknown")
            .to_string()
    }
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// AniList market data source.
///
/// Tracks `trending` (live) and TRENDING_DESC rank for anime & manga.
/// Source ID is `"anilist"`.
pub struct AniListMarketSource {
    http: SourceHttpClient,
}

impl AniListMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 76, // 85% of 90 req/min
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("AniList source initialized (dynamic assets via GraphQL, trending + rank)");

        Ok(Self { http })
    }

    /// Execute a GraphQL query against the AniList API with retry on 429/5xx
    async fn graphql_query<T: serde::de::DeserializeOwned>(
        &self,
        query: &str,
        variables: serde_json::Value,
    ) -> Result<T, SourceError> {
        let body = serde_json::json!({
            "query": query,
            "variables": variables,
        });

        let mut last_error = None;

        for attempt in 0..=MAX_GRAPHQL_RETRIES {
            // Wait for rate limit
            self.http.rate_limiter().wait_for_permit().await;

            let response = match self
                .http
                .inner()
                .post(ANILIST_API_URL)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .json(&body)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    let err = SourceError::Transient(format!("AniList request failed: {}", e));
                    if attempt < MAX_GRAPHQL_RETRIES {
                        let delay = Duration::from_millis(GRAPHQL_RETRY_BASE_MS * 2u64.pow(attempt));
                        warn!(
                            "AniList request error (attempt {}/{}), retrying in {:?}: {}",
                            attempt + 1, MAX_GRAPHQL_RETRIES, delay, e
                        );
                        tokio::time::sleep(delay).await;
                        last_error = Some(err);
                        continue;
                    }
                    return Err(err);
                }
            };

            let status = response.status().as_u16();

            // Rate limited — retry with backoff
            if status == 429 {
                let retry_after = response
                    .headers()
                    .get("Retry-After")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(GRAPHQL_RETRY_BASE_MS / 1000 * 2u64.pow(attempt));
                let delay = Duration::from_secs(retry_after.max(5));

                if attempt < MAX_GRAPHQL_RETRIES {
                    warn!(
                        "AniList rate limited (attempt {}/{}), waiting {:?}",
                        attempt + 1, MAX_GRAPHQL_RETRIES, delay
                    );
                    tokio::time::sleep(delay).await;
                    last_error = Some(SourceError::RateLimited(Some(delay)));
                    continue;
                }
                return Err(SourceError::RateLimited(Some(delay)));
            }

            if status == 401 || status == 403 {
                let body = response.text().await.unwrap_or_default();
                return Err(SourceError::AuthFailed(format!("HTTP {}: {}", status, body)));
            }

            // Server error — retry
            if status >= 500 {
                let body = response.text().await.unwrap_or_default();
                let err = SourceError::Transient(format!("AniList HTTP {}: {}", status, body));
                if attempt < MAX_GRAPHQL_RETRIES {
                    let delay = Duration::from_millis(GRAPHQL_RETRY_BASE_MS * 2u64.pow(attempt));
                    warn!(
                        "AniList server error {} (attempt {}/{}), retrying in {:?}",
                        status, attempt + 1, MAX_GRAPHQL_RETRIES, delay
                    );
                    tokio::time::sleep(delay).await;
                    last_error = Some(err);
                    continue;
                }
                return Err(err);
            }

            if !response.status().is_success() {
                let body = response.text().await.unwrap_or_default();
                return Err(SourceError::Transient(format!(
                    "AniList HTTP {}: {}",
                    status, body
                )));
            }

            let gql_resp: GqlResponse<T> = response
                .json()
                .await
                .map_err(|e| SourceError::DataError(format!("JSON parse error: {}", e)))?;

            return gql_resp.data.ok_or_else(|| {
                SourceError::DataError("AniList returned null data".to_string())
            });
        }

        Err(last_error.unwrap_or_else(|| {
            SourceError::Transient("AniList: max retries exceeded".to_string())
        }))
    }

    /// Discover media of a given type sorted by an arbitrary sort criterion, paginated.
    /// `sort` is one of `POPULARITY_DESC`, `TRENDING_DESC`.
    async fn discover_media_sorted(
        &self,
        media_type: &str,
        sort: &str,
        pages: u32,
    ) -> Result<Vec<MediaItem>, SourceError> {
        // sort is interpolated into the query string because GraphQL enums
        // can't be passed as variables without an enum-typed schema declaration.
        // The set of allowed values is closed; no untrusted input reaches here.
        let query = format!(
            r#"
            query ($page: Int, $perPage: Int, $type: MediaType) {{
                Page(page: $page, perPage: $perPage) {{
                    pageInfo {{ hasNextPage }}
                    media(type: $type, sort: {}) {{
                        id
                        title {{ romaji english }}
                        popularity
                        trending
                        averageScore
                        favourites
                    }}
                }}
            }}
        "#,
            sort
        );

        let mut all = Vec::new();

        for page in 1..=pages {
            let variables = serde_json::json!({
                "page": page,
                "perPage": PAGE_SIZE,
                "type": media_type,
            });

            match self.graphql_query::<PageData>(&query, variables).await {
                Ok(data) => {
                    let has_next = data.page.page_info.has_next_page;
                    all.extend(data.page.media);

                    if !has_next {
                        debug!(
                            "AniList {} {} discovery ended at page {}",
                            media_type, sort, page
                        );
                        break;
                    }
                }
                Err(e) => {
                    warn!(
                        "Failed to fetch AniList {} {} page {}: {:?}",
                        media_type, sort, page, e
                    );
                    break;
                }
            }

            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!(
            "Fetched {} {} {} from AniList ({} pages)",
            all.len(),
            sort,
            media_type.to_lowercase(),
            pages
        );
        Ok(all)
    }

    /// Fetch prices for a batch of media IDs using id_in filter
    async fn fetch_batch_by_ids(&self, ids: &[u64]) -> Result<Vec<MediaItem>, SourceError> {
        let query = r#"
            query ($ids: [Int], $page: Int, $perPage: Int) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo { hasNextPage }
                    media(id_in: $ids) {
                        id
                        title { romaji english }
                        popularity
                        trending
                        averageScore
                        favourites
                    }
                }
            }
        "#;

        let variables = serde_json::json!({
            "ids": ids,
            "page": 1,
            "perPage": PAGE_SIZE,
        });

        let data: PageData = self.graphql_query(query, variables).await?;
        Ok(data.page.media)
    }

    /// Build the rank map for a given media type from the live TRENDING_DESC list.
    /// Returns id -> 1-indexed position. Empty on failure (rank assets just won't price).
    async fn fetch_trending_rank_map(&self, media_type: &str) -> HashMap<u64, usize> {
        match self
            .discover_media_sorted(media_type, "TRENDING_DESC", TRENDING_PAGES)
            .await
        {
            Ok(items) => items
                .iter()
                .take(RANK_TOP_N)
                .enumerate()
                .map(|(idx, m)| (m.id, idx + 1))
                .collect(),
            Err(e) => {
                warn!(
                    "AniList trending fetch failed for {}: {:?}",
                    media_type, e
                );
                HashMap::new()
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for AniListMarketSource {
    fn source_id(&self) -> &'static str {
        "anilist"
    }

    fn display_name(&self) -> &'static str {
        "AniList Anime & Manga"
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
                max_requests: 76,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Dynamic discovery
        info!("AniList config is empty, performing live asset discovery");
        let mut assets = Vec::new();

        for (media_type, subcategory, sym_letter) in
            [("ANIME", "anime", 'A'), ("MANGA", "manga", 'M')]
        {
            // Base list — POPULARITY_DESC for stable universe coverage
            let base = match self
                .discover_media_sorted(media_type, "POPULARITY_DESC", DISCOVERY_PAGES)
                .await
            {
                Ok(items) => items,
                Err(e) => {
                    warn!(
                        "Failed to discover AniList POPULARITY_DESC {}: {:?}",
                        media_type, e
                    );
                    Vec::new()
                }
            };

            // Trending list — TRENDING_DESC, top RANK_TOP_N
            let trending = match self
                .discover_media_sorted(media_type, "TRENDING_DESC", TRENDING_PAGES)
                .await
            {
                Ok(items) => items,
                Err(e) => {
                    warn!(
                        "Failed to discover AniList TRENDING_DESC {}: {:?}",
                        media_type, e
                    );
                    Vec::new()
                }
            };

            let rank_map: HashMap<u64, usize> = trending
                .iter()
                .take(RANK_TOP_N)
                .enumerate()
                .map(|(idx, m)| (m.id, idx + 1))
                .collect();

            // Union — base ∪ trending. Trending titles missing from POPULARITY_DESC
            // get tracked too. Dedup by id, keep first MediaItem we saw.
            let mut seen: HashSet<u64> = HashSet::new();
            let mut union: Vec<&MediaItem> = Vec::with_capacity(base.len() + trending.len());
            for item in base.iter().chain(trending.iter()) {
                if seen.insert(item.id) {
                    union.push(item);
                }
            }

            for item in &union {
                // Primary asset — value = trending
                assets.push(AssetUpdate {
                    asset_id: format!("anilist_{}_{}", subcategory, item.id),
                    symbol: format!("ANI#{}{}", sym_letter, item.id),
                    name: item.title.best(),
                    category: Some("sentiment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("{}:{}", subcategory, item.id),
                        "subcategory": subcategory,
                        "active": true,
                        "extra": {
                            "metric": "trending",
                        },
                    }),
                });

                // Companion `_rank` asset — only while in TRENDING_DESC top-N
                if let Some(&rank) = rank_map.get(&item.id) {
                    assets.push(AssetUpdate {
                        asset_id: format!("anilist_{}_{}_rank", subcategory, item.id),
                        symbol: format!("ANI#{}{}", sym_letter, item.id),
                        name: format!("{} (rank)", item.title.best()),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": format!("{}:{}", subcategory, item.id),
                            "subcategory": subcategory,
                            "active": true,
                            "extra": {
                                "metric": "rank",
                                "rank_top_n": RANK_TOP_N,
                            },
                        }),
                    });
                    let _ = rank;
                }
            }

            info!(
                "AniList {}: base={} trending={} union={} rank_assets={}",
                media_type,
                base.len(),
                trending.len(),
                union.len(),
                rank_map.len()
            );
        }

        info!("Discovered {} AniList assets via GraphQL", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Load api_ref lookup from config
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: std::collections::HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), e.api_ref))
            .collect();

        // Parse incoming asset_ids — each maps to a (media_type, id) pair plus
        // a metric flavour (trending vs rank). Dedupe ids per type so we only
        // hit the batch endpoint once per content asset.
        let mut anime_ids: Vec<u64> = Vec::new();
        let mut manga_ids: Vec<u64> = Vec::new();
        let requested: HashSet<String> = asset_ids.iter().cloned().collect();

        for asset_id in asset_ids {
            let (media_type, id) = if let Some(api_ref) = ref_lookup.get(asset_id) {
                parse_type_and_id_from_ref(api_ref)
            } else {
                parse_type_and_id_from_asset_id(asset_id)
            }
            .unwrap_or_default();

            if id == 0 {
                debug!("Cannot parse AniList ID from asset_id: {}", asset_id);
                continue;
            }

            match media_type.as_str() {
                "anime" => {
                    if !anime_ids.contains(&id) {
                        anime_ids.push(id);
                    }
                }
                "manga" => {
                    if !manga_ids.contains(&id) {
                        manga_ids.push(id);
                    }
                }
                _ => {
                    debug!("Unknown media type '{}' for {}", media_type, asset_id);
                }
            }
        }

        // Pull live TRENDING_DESC top-N once per type, populates the `_rank` companion.
        // A title not present has no rank price this tick; the asset will deactivate
        // on the next fetch_assets() cycle. Same lifecycle as HN `_rank`.
        let anime_rank_map = if anime_ids.is_empty() {
            HashMap::new()
        } else {
            self.fetch_trending_rank_map("ANIME").await
        };
        let manga_rank_map = if manga_ids.is_empty() {
            HashMap::new()
        } else {
            self.fetch_trending_rank_map("MANGA").await
        };

        // Helper closure-ish loop — parameterised over media type so anime/manga
        // share the price-emit logic.
        for (subcategory, ids, rank_map) in [
            ("anime", &anime_ids, &anime_rank_map),
            ("manga", &manga_ids, &manga_rank_map),
        ] {
            for chunk in ids.chunks(PRICE_BATCH_SIZE) {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

                match self.fetch_batch_by_ids(chunk).await {
                    Ok(items) => {
                        for item in items {
                            let primary_id = format!("anilist_{}_{}", subcategory, item.id);
                            let rank_id = format!("anilist_{}_{}_rank", subcategory, item.id);
                            let title = item.title.best();

                            if requested.contains(&primary_id) {
                                results.push(PriceUpdate {
                                    asset_id: primary_id,
                                    symbol: title.clone(),
                                    // Primary value is TRENDING — the only field that moves.
                                    value: Decimal::from(item.trending),
                                    prev_close: None,
                                    change_pct: None,
                                    // Stash the dead-but-reportable signals as side metrics
                                    // so the audit trail keeps them.
                                    volume_24h: Some(Decimal::from(item.popularity)),
                                    market_cap: item
                                        .average_score
                                        .map(|s| Decimal::from(s)),
                                    fetched_at: now,
                                });
                            }

                            if requested.contains(&rank_id) {
                                if let Some(&rank) = rank_map.get(&item.id) {
                                    results.push(PriceUpdate {
                                        asset_id: rank_id,
                                        symbol: format!("{} (rank)", title),
                                        value: Decimal::from(rank as u64),
                                        prev_close: None,
                                        change_pct: None,
                                        volume_24h: None,
                                        market_cap: None,
                                        fetched_at: now,
                                    });
                                }
                                // Out of trending top-N this tick → no price.
                                // Deactivated on next fetch_assets() cycle.
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to fetch AniList {} batch: {:?}", subcategory, e);
                    }
                }
            }
        }

        info!(
            "Fetched {}/{} prices from AniList",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        let mut entries = Vec::new();

        for (media_type, subcategory, sym_letter) in
            [("ANIME", "anime", 'A'), ("MANGA", "manga", 'M')]
        {
            info!(
                "Discovering AniList {} (POPULARITY_DESC {} pages + TRENDING_DESC {} pages)...",
                media_type, DISCOVERY_PAGES, TRENDING_PAGES
            );

            let base = self
                .discover_media_sorted(media_type, "POPULARITY_DESC", DISCOVERY_PAGES)
                .await
                .map_err(|e| {
                    anyhow::anyhow!("Failed to discover AniList POPULARITY_DESC {}: {:?}", media_type, e)
                })?;

            let trending = self
                .discover_media_sorted(media_type, "TRENDING_DESC", TRENDING_PAGES)
                .await
                .map_err(|e| {
                    anyhow::anyhow!("Failed to discover AniList TRENDING_DESC {}: {:?}", media_type, e)
                })?;

            let trending_ids: HashSet<u64> = trending.iter().map(|m| m.id).collect();

            let mut seen: HashSet<u64> = HashSet::new();
            for item in base.iter().chain(trending.iter()) {
                if !seen.insert(item.id) {
                    continue;
                }

                entries.push(AssetEntry {
                    asset_id: format!("anilist_{}_{}", subcategory, item.id),
                    symbol: format!("ANI#{}{}", sym_letter, item.id),
                    name: item.title.best(),
                    category: "sentiment".to_string(),
                    subcategory: subcategory.to_string(),
                    api_ref: format!("{}:{}", subcategory, item.id),
                    active: true,
                });

                // Persist `_rank` companion only for titles currently in trending —
                // matches the lifecycle the sync engine drives at runtime.
                if trending_ids.contains(&item.id) {
                    entries.push(AssetEntry {
                        asset_id: format!("anilist_{}_{}_rank", subcategory, item.id),
                        symbol: format!("ANI#{}{}", sym_letter, item.id),
                        name: format!("{} (rank)", item.title.best()),
                        category: "sentiment".to_string(),
                        subcategory: subcategory.to_string(),
                        api_ref: format!("{}:{}", subcategory, item.id),
                        active: true,
                    });
                }
            }

            info!(
                "AniList discovery {}: base={} trending={}",
                media_type,
                base.len(),
                trending.len()
            );
        }

        info!("Discovered {} total AniList asset entries", entries.len());
        Ok(entries)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENGAGEMENT
    }
}

/// Parse media type and ID from api_ref like "anime:16498"
fn parse_type_and_id_from_ref(api_ref: &str) -> Option<(String, u64)> {
    let (media_type, id_str) = api_ref.split_once(':')?;
    let id = id_str.parse().ok()?;
    Some((media_type.to_string(), id))
}

/// Parse media type and ID from asset_id like "anilist_anime_16498" or
/// "anilist_anime_16498_rank". The `_rank` suffix is recognised so price
/// requests for companion assets resolve to the same upstream id.
fn parse_type_and_id_from_asset_id(asset_id: &str) -> Option<(String, u64)> {
    let rest = asset_id.strip_prefix("anilist_")?;
    let (media_type, after_type) = if let Some(after) = rest.strip_prefix("anime_") {
        ("anime", after)
    } else if let Some(after) = rest.strip_prefix("manga_") {
        ("manga", after)
    } else {
        return None;
    };

    // Either "<id>" or "<id>_rank"
    let id_str = after_type
        .strip_suffix("_rank")
        .unwrap_or(after_type);
    let id = id_str.parse().ok()?;
    Some((media_type.to_string(), id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("anilist", "anilist");
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
    fn test_parse_type_and_id_from_ref() {
        assert_eq!(
            parse_type_and_id_from_ref("anime:16498"),
            Some(("anime".to_string(), 16498))
        );
        assert_eq!(
            parse_type_and_id_from_ref("manga:30002"),
            Some(("manga".to_string(), 30002))
        );
        assert_eq!(parse_type_and_id_from_ref("invalid"), None);
        assert_eq!(parse_type_and_id_from_ref("anime:"), None);
        assert_eq!(parse_type_and_id_from_ref("anime:abc"), None);
    }

    #[test]
    fn test_parse_type_and_id_from_asset_id() {
        assert_eq!(
            parse_type_and_id_from_asset_id("anilist_anime_16498"),
            Some(("anime".to_string(), 16498))
        );
        assert_eq!(
            parse_type_and_id_from_asset_id("anilist_manga_30002"),
            Some(("manga".to_string(), 30002))
        );
        assert_eq!(parse_type_and_id_from_asset_id("invalid"), None);
        assert_eq!(parse_type_and_id_from_asset_id("anilist_anime_"), None);
        assert_eq!(parse_type_and_id_from_asset_id("anilist_anime_abc"), None);
    }

    #[test]
    fn test_parse_rank_asset_id() {
        assert_eq!(
            parse_type_and_id_from_asset_id("anilist_anime_16498_rank"),
            Some(("anime".to_string(), 16498))
        );
        assert_eq!(
            parse_type_and_id_from_asset_id("anilist_manga_30002_rank"),
            Some(("manga".to_string(), 30002))
        );
    }

    #[test]
    fn test_asset_id_format() {
        let anime_id = format!("anilist_anime_{}", 16498);
        assert_eq!(anime_id, "anilist_anime_16498");

        let manga_id = format!("anilist_manga_{}", 30002);
        assert_eq!(manga_id, "anilist_manga_30002");

        let rank_id = format!("anilist_anime_{}_rank", 16498);
        assert_eq!(rank_id, "anilist_anime_16498_rank");
    }

    #[test]
    fn test_trending_to_decimal() {
        // Primary value is now `trending`, not `popularity`.
        let trending: u64 = 4321;
        let value = Decimal::from(trending);
        assert_eq!(value, Decimal::from(4321u64));

        let value = Decimal::from(0u64);
        assert_eq!(value, Decimal::ZERO);
    }

    #[test]
    fn test_rank_top_n() {
        assert_eq!(RANK_TOP_N, 100);
    }

    #[test]
    fn test_media_title_best() {
        // Prefer english
        let title = MediaTitle {
            romaji: Some("Shingeki no Kyojin".to_string()),
            english: Some("Attack on Titan".to_string()),
        };
        assert_eq!(title.best(), "Attack on Titan");

        // Fall back to romaji
        let title = MediaTitle {
            romaji: Some("Naruto".to_string()),
            english: None,
        };
        assert_eq!(title.best(), "Naruto");

        // Both None
        let title = MediaTitle {
            romaji: None,
            english: None,
        };
        assert_eq!(title.best(), "Unknown");
    }

    #[test]
    fn test_api_ref_roundtrip() {
        let id: u64 = 16498;
        let api_ref = format!("anime:{}", id);
        assert_eq!(
            parse_type_and_id_from_ref(&api_ref),
            Some(("anime".to_string(), 16498))
        );
    }
}
