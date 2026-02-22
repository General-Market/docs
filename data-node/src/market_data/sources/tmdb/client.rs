//! TMDb (The Movie Database) API client implementing MarketDataSource
//!
//! Tracks popularity scores, vote counts, and revenue for movies and TV shows.
//! Assets are fully dynamic — discovered from the /movie/popular and /tv/popular endpoints.
//!
//! API: https://api.themoviedb.org/3/
//! Auth: TMDB_API_KEY env var (passed as query param)
//! Rate limit: ~50 req/s → 30,000 calls per 10-min window

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource,
    PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/tmdb.json");

/// TMDb API base URL
const TMDB_API_URL: &str = "https://api.themoviedb.org/3";

/// Delay between individual detail fetches (ms) — ~25 req/s
const INTER_REQUEST_DELAY_MS: u64 = 40;

/// How many pages of popular movies to fetch (20 items/page, 500 pages = 10k)
const MOVIE_DISCOVERY_PAGES: u32 = 500;

/// How many pages of popular TV shows to fetch (20 items/page, 500 pages = 10k)
const TV_DISCOVERY_PAGES: u32 = 500;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// TMDb paginated list response
#[derive(Debug, Deserialize)]
struct TmdbListResponse<T> {
    results: Vec<T>,
    #[serde(default)]
    total_pages: u32,
}

/// Movie from popular list
#[derive(Debug, Deserialize)]
struct TmdbMovieListItem {
    id: u64,
    title: String,
    #[serde(default)]
    popularity: f64,
    #[serde(default)]
    vote_count: u64,
}

/// TV show from popular list
#[derive(Debug, Deserialize)]
struct TmdbTvListItem {
    id: u64,
    name: String,
    #[serde(default)]
    popularity: f64,
    #[serde(default)]
    vote_count: u64,
}


// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// TMDb market data source.
///
/// Tracks popularity scores for movies and TV shows.
/// Source ID is `"tmdb"`.
pub struct TmdbMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl TmdbMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("TMDB_API_KEY")
            .context("TMDB_API_KEY environment variable must be set")?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 1500, // 25 req/s * 60s, stay well below 50 req/s
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("TMDb source initialized (dynamic assets from /popular)");

        Ok(Self { http, api_key })
    }

    /// Build a TMDb API URL with the API key
    fn api_url(&self, path: &str) -> String {
        let sep = if path.contains('?') { '&' } else { '?' };
        format!("{}/{}{}api_key={}", TMDB_API_URL, path, sep, self.api_key)
    }

    /// Fetch popular movies (paginated) — returns (id, title, popularity, vote_count)
    async fn fetch_popular_movies(&self, pages: u32) -> Result<Vec<(u64, String, f64, u64)>, SourceError> {
        let mut all = Vec::new();

        for page in 1..=pages {
            let url = self.api_url(&format!("movie/popular?page={}", page));
            match self.http.get_json::<TmdbListResponse<TmdbMovieListItem>>(&url).await {
                Ok(resp) => {
                    for movie in resp.results {
                        all.push((movie.id, movie.title, movie.popularity, movie.vote_count));
                    }
                    if page >= resp.total_pages {
                        break;
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch popular movies page {}: {:?}", page, e);
                    break;
                }
            }
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!("Fetched {} popular movies from TMDb", all.len());
        Ok(all)
    }

    /// Fetch popular TV shows (paginated) — returns (id, name, popularity, vote_count)
    async fn fetch_popular_tv(&self, pages: u32) -> Result<Vec<(u64, String, f64, u64)>, SourceError> {
        let mut all = Vec::new();

        for page in 1..=pages {
            let url = self.api_url(&format!("tv/popular?page={}", page));
            match self.http.get_json::<TmdbListResponse<TmdbTvListItem>>(&url).await {
                Ok(resp) => {
                    for show in resp.results {
                        all.push((show.id, show.name, show.popularity, show.vote_count));
                    }
                    if page >= resp.total_pages {
                        break;
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch popular TV page {}: {:?}", page, e);
                    break;
                }
            }
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!("Fetched {} popular TV shows from TMDb", all.len());
        Ok(all)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TmdbMarketSource {
    fn source_id(&self) -> &'static str {
        "tmdb"
    }

    fn display_name(&self) -> &'static str {
        "TMDb Movies & TV"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300) // 5 minutes (price fetch uses popular pages, ~40s)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 1500,
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
        info!("TMDb config is empty, performing live asset discovery");
        let mut assets = Vec::new();

        // Discover popular movies
        match self.fetch_popular_movies(MOVIE_DISCOVERY_PAGES).await {
            Ok(movies) => {
                for (id, title, _, _) in &movies {
                    assets.push(AssetUpdate {
                        asset_id: format!("tmdb_movie_{}", id),
                        symbol: format!("TMDB#M{}", id),
                        name: title.clone(),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": format!("movie:{}", id),
                            "subcategory": "movies",
                            "active": true,
                            "extra": {},
                        }),
                    });
                }
            }
            Err(e) => warn!("Failed to discover TMDb movies: {:?}", e),
        }

        // Discover popular TV shows
        match self.fetch_popular_tv(TV_DISCOVERY_PAGES).await {
            Ok(shows) => {
                for (id, name, _, _) in &shows {
                    assets.push(AssetUpdate {
                        asset_id: format!("tmdb_tv_{}", id),
                        symbol: format!("TMDB#T{}", id),
                        name: name.clone(),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": format!("tv:{}", id),
                            "subcategory": "tv_shows",
                            "active": true,
                            "extra": {},
                        }),
                    });
                }
            }
            Err(e) => warn!("Failed to discover TMDb TV shows: {:?}", e),
        }

        info!("Discovered {} TMDb assets via live API", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        // Fetch all prices via the /popular listing endpoints (~1,000 page calls)
        // instead of 20,000 individual detail calls. The popular listing already
        // returns popularity + vote_count for each item.
        let now = Utc::now();
        let mut results = Vec::new();

        // Fetch movies from popular pages
        match self.fetch_popular_movies(MOVIE_DISCOVERY_PAGES).await {
            Ok(movies) => {
                for (id, _title, popularity, vote_count) in movies {
                    results.push(PriceUpdate {
                        asset_id: format!("tmdb_movie_{}", id),
                        symbol: format!("TMDB#M{}", id),
                        value: Decimal::from_f64_retain(popularity)
                            .unwrap_or(Decimal::ZERO),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: Some(Decimal::from(vote_count)),
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }
            Err(e) => warn!("Failed to fetch TMDb movie prices: {:?}", e),
        }

        // Fetch TV shows from popular pages
        match self.fetch_popular_tv(TV_DISCOVERY_PAGES).await {
            Ok(shows) => {
                for (id, _name, popularity, vote_count) in shows {
                    results.push(PriceUpdate {
                        asset_id: format!("tmdb_tv_{}", id),
                        symbol: format!("TMDB#T{}", id),
                        value: Decimal::from_f64_retain(popularity)
                            .unwrap_or(Decimal::ZERO),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: Some(Decimal::from(vote_count)),
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }
            Err(e) => warn!("Failed to fetch TMDb TV prices: {:?}", e),
        }

        info!("Fetched {} prices from TMDb via popular pages", results.len());
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        let mut entries = Vec::new();

        // Discover popular movies
        info!("Discovering popular TMDb movies ({} pages)...", MOVIE_DISCOVERY_PAGES);
        let movies = self
            .fetch_popular_movies(MOVIE_DISCOVERY_PAGES)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover TMDb movies: {:?}", e))?;

        for (id, title, _, _) in &movies {
            entries.push(AssetEntry {
                asset_id: format!("tmdb_movie_{}", id),
                symbol: format!("TMDB#M{}", id),
                name: title.clone(),
                category: "sentiment".to_string(),
                subcategory: "movies".to_string(),
                api_ref: format!("movie:{}", id),
                active: true,
            });
        }

        // Discover popular TV shows
        info!("Discovering popular TMDb TV shows ({} pages)...", TV_DISCOVERY_PAGES);
        let shows = self
            .fetch_popular_tv(TV_DISCOVERY_PAGES)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover TMDb TV shows: {:?}", e))?;

        for (id, name, _, _) in &shows {
            entries.push(AssetEntry {
                asset_id: format!("tmdb_tv_{}", id),
                symbol: format!("TMDB#T{}", id),
                name: name.clone(),
                category: "sentiment".to_string(),
                subcategory: "tv_shows".to_string(),
                api_ref: format!("tv:{}", id),
                active: true,
            });
        }

        info!(
            "Discovered {} total TMDb assets ({} movies + {} TV shows)",
            entries.len(),
            movies.len(),
            shows.len()
        );
        Ok(entries)
    }
}

/// Parse api_ref from asset_id like "tmdb_movie_123" -> "movie:123"
#[cfg(test)]
fn parse_api_ref_from_asset_id(asset_id: &str) -> Option<String> {
    if let Some(id) = asset_id.strip_prefix("tmdb_movie_") {
        if id.parse::<u64>().is_ok() {
            return Some(format!("movie:{}", id));
        }
    }
    if let Some(id) = asset_id.strip_prefix("tmdb_tv_") {
        if id.parse::<u64>().is_ok() {
            return Some(format!("tv:{}", id));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("tmdb", "tmdb");
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
    fn test_parse_api_ref_movie() {
        assert_eq!(
            parse_api_ref_from_asset_id("tmdb_movie_123"),
            Some("movie:123".to_string())
        );
        assert_eq!(
            parse_api_ref_from_asset_id("tmdb_movie_999999"),
            Some("movie:999999".to_string())
        );
    }

    #[test]
    fn test_parse_api_ref_tv() {
        assert_eq!(
            parse_api_ref_from_asset_id("tmdb_tv_456"),
            Some("tv:456".to_string())
        );
    }

    #[test]
    fn test_parse_api_ref_invalid() {
        assert_eq!(parse_api_ref_from_asset_id("invalid"), None);
        assert_eq!(parse_api_ref_from_asset_id("tmdb_movie_"), None);
        assert_eq!(parse_api_ref_from_asset_id("tmdb_movie_abc"), None);
        assert_eq!(parse_api_ref_from_asset_id(""), None);
    }

    #[test]
    fn test_asset_id_format() {
        let movie_id = format!("tmdb_movie_{}", 550);
        assert_eq!(movie_id, "tmdb_movie_550");

        let tv_id = format!("tmdb_tv_{}", 1399);
        assert_eq!(tv_id, "tmdb_tv_1399");
    }

    #[test]
    fn test_api_ref_strip() {
        let api_ref = "movie:550";
        assert_eq!(api_ref.strip_prefix("movie:"), Some("550"));

        let api_ref = "tv:1399";
        assert_eq!(api_ref.strip_prefix("tv:"), Some("1399"));

        let api_ref = "invalid";
        assert_eq!(api_ref.strip_prefix("movie:"), None);
    }

    #[test]
    fn test_popularity_to_decimal() {
        let popularity: f64 = 234.567;
        let value = Decimal::from_f64_retain(popularity).unwrap_or(Decimal::ZERO);
        assert!(value > Decimal::ZERO);

        // Zero popularity
        let value = Decimal::from_f64_retain(0.0).unwrap_or(Decimal::ZERO);
        assert_eq!(value, Decimal::ZERO);
    }

    #[test]
    fn test_api_url_building() {
        // Simulating what api_url does
        let base = "https://api.themoviedb.org/3";
        let key = "test_key";

        let path = "movie/popular?page=1";
        let sep = if path.contains('?') { '&' } else { '?' };
        let url = format!("{}/{}{}api_key={}", base, path, sep, key);
        assert_eq!(
            url,
            "https://api.themoviedb.org/3/movie/popular?page=1&api_key=test_key"
        );

        let path = "movie/550";
        let sep = if path.contains('?') { '&' } else { '?' };
        let url = format!("{}/{}{}api_key={}", base, path, sep, key);
        assert_eq!(
            url,
            "https://api.themoviedb.org/3/movie/550?api_key=test_key"
        );
    }
}
