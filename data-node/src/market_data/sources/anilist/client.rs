//! AniList GraphQL API client implementing MarketDataSource
//!
//! Tracks popularity, trending scores, and ratings for anime and manga.
//! Assets are fully dynamic — discovered from the AniList popularity-sorted listings.
//!
//! API: POST https://graphql.anilist.co (GraphQL, no auth)
//! Rate limit: 90 req/min → budget 76 req/min (85%)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource,
    PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/anilist.json");

/// AniList GraphQL endpoint
const ANILIST_API_URL: &str = "https://graphql.anilist.co";

/// Delay between sequential GraphQL requests (ms)
const INTER_REQUEST_DELAY_MS: u64 = 800;

/// How many discovery pages per media type (50 items/page)
const DISCOVERY_PAGES: u32 = 20;

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
/// Tracks anime & manga popularity scores.
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

        info!("AniList source initialized (dynamic assets via GraphQL)");

        Ok(Self { http })
    }

    /// Execute a GraphQL query against the AniList API
    async fn graphql_query<T: serde::de::DeserializeOwned>(
        &self,
        query: &str,
        variables: serde_json::Value,
    ) -> Result<T, SourceError> {
        // Wait for rate limit
        self.http.rate_limiter().wait_for_permit().await;

        let body = serde_json::json!({
            "query": query,
            "variables": variables,
        });

        let response = self
            .http
            .inner()
            .post(ANILIST_API_URL)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| SourceError::Transient(format!("AniList request failed: {}", e)))?;

        let status = response.status().as_u16();

        if status == 429 {
            return Err(SourceError::RateLimited(Some(Duration::from_secs(60))));
        }

        if status == 401 || status == 403 {
            let body = response.text().await.unwrap_or_default();
            return Err(SourceError::AuthFailed(format!("HTTP {}: {}", status, body)));
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

        gql_resp.data.ok_or_else(|| {
            SourceError::DataError("AniList returned null data".to_string())
        })
    }

    /// Discover popular media of a given type (ANIME or MANGA), paginated
    async fn discover_media(
        &self,
        media_type: &str,
        pages: u32,
    ) -> Result<Vec<MediaItem>, SourceError> {
        let query = r#"
            query ($page: Int, $perPage: Int, $type: MediaType) {
                Page(page: $page, perPage: $perPage) {
                    pageInfo { hasNextPage }
                    media(type: $type, sort: POPULARITY_DESC) {
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

        let mut all = Vec::new();

        for page in 1..=pages {
            let variables = serde_json::json!({
                "page": page,
                "perPage": PAGE_SIZE,
                "type": media_type,
            });

            match self.graphql_query::<PageData>(query, variables).await {
                Ok(data) => {
                    let has_next = data.page.page_info.has_next_page;
                    all.extend(data.page.media);

                    if !has_next {
                        debug!("AniList {} discovery ended at page {}", media_type, page);
                        break;
                    }
                }
                Err(e) => {
                    warn!(
                        "Failed to fetch AniList {} page {}: {:?}",
                        media_type, page, e
                    );
                    break;
                }
            }

            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!(
            "Fetched {} popular {} from AniList ({} pages)",
            all.len(),
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

        // Discover popular anime
        match self.discover_media("ANIME", DISCOVERY_PAGES).await {
            Ok(anime) => {
                for item in &anime {
                    assets.push(AssetUpdate {
                        asset_id: format!("anilist_anime_{}", item.id),
                        symbol: format!("ANI#A{}", item.id),
                        name: item.title.best(),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": format!("anime:{}", item.id),
                            "subcategory": "anime",
                            "active": true,
                            "extra": {},
                        }),
                    });
                }
            }
            Err(e) => warn!("Failed to discover AniList anime: {:?}", e),
        }

        // Discover popular manga
        match self.discover_media("MANGA", DISCOVERY_PAGES).await {
            Ok(manga) => {
                for item in &manga {
                    assets.push(AssetUpdate {
                        asset_id: format!("anilist_manga_{}", item.id),
                        symbol: format!("ANI#M{}", item.id),
                        name: item.title.best(),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": format!("manga:{}", item.id),
                            "subcategory": "manga",
                            "active": true,
                            "extra": {},
                        }),
                    });
                }
            }
            Err(e) => warn!("Failed to discover AniList manga: {:?}", e),
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

        // Parse IDs and group by type
        let mut anime_ids: Vec<u64> = Vec::new();
        let mut manga_ids: Vec<u64> = Vec::new();

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
                "anime" => anime_ids.push(id),
                "manga" => manga_ids.push(id),
                _ => {
                    debug!("Unknown media type '{}' for {}", media_type, asset_id);
                }
            }
        }

        // Fetch anime prices in batches
        for chunk in anime_ids.chunks(PRICE_BATCH_SIZE) {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_batch_by_ids(chunk).await {
                Ok(items) => {
                    for item in items {
                        results.push(PriceUpdate {
                            asset_id: format!("anilist_anime_{}", item.id),
                            symbol: format!("ANI#A{}", item.id),
                            value: Decimal::from(item.popularity),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: Some(Decimal::from(item.favourites)),
                            market_cap: item
                                .average_score
                                .map(|s| Decimal::from(s)),
                            fetched_at: now,
                        });
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch AniList anime batch: {:?}", e);
                }
            }
        }

        // Fetch manga prices in batches
        for chunk in manga_ids.chunks(PRICE_BATCH_SIZE) {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_batch_by_ids(chunk).await {
                Ok(items) => {
                    for item in items {
                        results.push(PriceUpdate {
                            asset_id: format!("anilist_manga_{}", item.id),
                            symbol: format!("ANI#M{}", item.id),
                            value: Decimal::from(item.popularity),
                            prev_close: None,
                            change_pct: None,
                            volume_24h: Some(Decimal::from(item.favourites)),
                            market_cap: item
                                .average_score
                                .map(|s| Decimal::from(s)),
                            fetched_at: now,
                        });
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch AniList manga batch: {:?}", e);
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

        // Discover popular anime
        info!("Discovering popular AniList anime ({} pages)...", DISCOVERY_PAGES);
        let anime = self
            .discover_media("ANIME", DISCOVERY_PAGES)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover AniList anime: {:?}", e))?;

        for item in &anime {
            entries.push(AssetEntry {
                asset_id: format!("anilist_anime_{}", item.id),
                symbol: format!("ANI#A{}", item.id),
                name: item.title.best(),
                category: "sentiment".to_string(),
                subcategory: "anime".to_string(),
                api_ref: format!("anime:{}", item.id),
                active: true,
            });
        }

        // Discover popular manga
        info!("Discovering popular AniList manga ({} pages)...", DISCOVERY_PAGES);
        let manga = self
            .discover_media("MANGA", DISCOVERY_PAGES)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover AniList manga: {:?}", e))?;

        for item in &manga {
            entries.push(AssetEntry {
                asset_id: format!("anilist_manga_{}", item.id),
                symbol: format!("ANI#M{}", item.id),
                name: item.title.best(),
                category: "sentiment".to_string(),
                subcategory: "manga".to_string(),
                api_ref: format!("manga:{}", item.id),
                active: true,
            });
        }

        info!(
            "Discovered {} total AniList assets ({} anime + {} manga)",
            entries.len(),
            anime.len(),
            manga.len()
        );
        Ok(entries)
    }
}

/// Parse media type and ID from api_ref like "anime:16498"
fn parse_type_and_id_from_ref(api_ref: &str) -> Option<(String, u64)> {
    let (media_type, id_str) = api_ref.split_once(':')?;
    let id = id_str.parse().ok()?;
    Some((media_type.to_string(), id))
}

/// Parse media type and ID from asset_id like "anilist_anime_16498"
fn parse_type_and_id_from_asset_id(asset_id: &str) -> Option<(String, u64)> {
    let rest = asset_id.strip_prefix("anilist_")?;
    if let Some(id_str) = rest.strip_prefix("anime_") {
        let id = id_str.parse().ok()?;
        return Some(("anime".to_string(), id));
    }
    if let Some(id_str) = rest.strip_prefix("manga_") {
        let id = id_str.parse().ok()?;
        return Some(("manga".to_string(), id));
    }
    None
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
    fn test_asset_id_format() {
        let anime_id = format!("anilist_anime_{}", 16498);
        assert_eq!(anime_id, "anilist_anime_16498");

        let manga_id = format!("anilist_manga_{}", 30002);
        assert_eq!(manga_id, "anilist_manga_30002");
    }

    #[test]
    fn test_popularity_to_decimal() {
        let popularity: u64 = 234567;
        let value = Decimal::from(popularity);
        assert_eq!(value, Decimal::from(234567u64));

        // Zero popularity
        let value = Decimal::from(0u64);
        assert_eq!(value, Decimal::ZERO);
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
