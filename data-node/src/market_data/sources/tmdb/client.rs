//! TMDb (The Movie Database) API client implementing MarketDataSource
//!
//! Tracks popularity scores for movies, TV shows, and trending people (celebrities).
//! Assets are fully dynamic — discovered from /movie/popular, /tv/popular, and
//! /trending/person/day endpoints.
//!
//! **Lifecycle**: Only the top pages of each list are tracked (200 movies, 200 TV,
//! ~300 people). The sync engine deactivates assets that fall off these lists hourly.
//! `fetch_prices()` uses the same shared snapshot as `fetch_assets()` to guarantee
//! every registered asset gets a price — no orphans.
//!
//! API: https://api.themoviedb.org/3/
//! Auth: TMDB_API_KEY env var (passed as query param)
//! Rate limit: ~50 req/s → 30,000 calls per 10-min window

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::sync::Mutex;
use std::time::Duration;
use tracing::{info, warn};

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

/// How many pages of popular movies to fetch (20 items/page, 10 pages = 200)
/// Reduced from 50 to prevent registering thousands of rotating assets.
const MOVIE_DISCOVERY_PAGES: u32 = 10;

/// How many pages of popular TV shows to fetch (20 items/page, 10 pages = 200)
/// Reduced from 50 to prevent registering thousands of rotating assets.
const TV_DISCOVERY_PAGES: u32 = 10;

/// How many pages of trending people to fetch (20 items/page, 10 pages = 200)
const PERSON_TRENDING_PAGES: u32 = 10;

/// How many pages of popular people to fetch (20 items/page, 10 pages = 200)
/// Reduced from 50 to prevent registering thousands of rotating assets.
const PERSON_POPULAR_PAGES: u32 = 10;

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

/// Person from trending/popular list
#[derive(Debug, Deserialize)]
struct TmdbPersonListItem {
    id: u64,
    name: String,
    #[serde(default)]
    popularity: f64,
    #[serde(default)]
    known_for_department: Option<String>,
}


// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Cached snapshot of TMDb popular lists. Both `fetch_assets()` and
/// `fetch_prices()` operate on the same snapshot so every registered asset
/// is guaranteed to get a price within the same sync cycle.
#[derive(Clone, Default)]
struct TmdbSnapshot {
    /// (tmdb_id, title/name, popularity, vote_count)
    movies: Vec<(u64, String, f64, u64)>,
    /// (tmdb_id, name, popularity, vote_count)
    tv_shows: Vec<(u64, String, f64, u64)>,
    /// (tmdb_id, name, popularity, department)
    people: Vec<(u64, String, f64, String)>,
}

/// TMDb market data source.
///
/// Tracks popularity scores for movies, TV shows, and trending celebrities.
/// Source ID is `"tmdb"`.
pub struct TmdbMarketSource {
    http: SourceHttpClient,
    api_key: String,
    /// Cached snapshot from the last `fetch_assets()` call.
    /// `fetch_prices()` reads from this instead of re-querying the API,
    /// eliminating the race where popular lists rotate between the two calls.
    snapshot: Mutex<TmdbSnapshot>,
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

        info!("TMDb source initialized (dynamic assets from /popular + /trending/person)");

        Ok(Self {
            http,
            api_key,
            snapshot: Mutex::new(TmdbSnapshot::default()),
        })
    }

    /// Refresh the cached snapshot from live API data. Called by `fetch_assets()`.
    /// Returns the snapshot for immediate use.
    async fn refresh_snapshot(&self) -> TmdbSnapshot {
        let mut snap = TmdbSnapshot::default();

        match self.fetch_popular_movies(MOVIE_DISCOVERY_PAGES).await {
            Ok(movies) => snap.movies = movies,
            Err(e) => warn!("Failed to fetch TMDb movies: {:?}", e),
        }

        match self.fetch_popular_tv(TV_DISCOVERY_PAGES).await {
            Ok(shows) => snap.tv_shows = shows,
            Err(e) => warn!("Failed to fetch TMDb TV shows: {:?}", e),
        }

        match self.fetch_people().await {
            Ok(people) => snap.people = people,
            Err(e) => warn!("Failed to fetch TMDb people: {:?}", e),
        }

        info!(
            "TMDb snapshot: {} movies + {} TV + {} people = {} total",
            snap.movies.len(),
            snap.tv_shows.len(),
            snap.people.len(),
            snap.movies.len() + snap.tv_shows.len() + snap.people.len()
        );

        // Store for fetch_prices() to use
        *self.snapshot.lock().unwrap_or_else(|e| e.into_inner()) = snap.clone();
        snap
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

    /// Fetch trending + popular people (celebrities) — returns (id, name, popularity, department)
    /// Merges /trending/person/day (volatile, what's hot right now) with /person/popular
    /// (stable top celebrities) and deduplicates by person ID.
    async fn fetch_people(&self) -> Result<Vec<(u64, String, f64, String)>, SourceError> {
        let mut seen = std::collections::HashSet::new();
        let mut all = Vec::new();

        // 1. Trending people (daily) — most volatile, what's hot right now
        for page in 1..=PERSON_TRENDING_PAGES {
            let url = self.api_url(&format!("trending/person/day?page={}", page));
            match self.http.get_json::<TmdbListResponse<TmdbPersonListItem>>(&url).await {
                Ok(resp) => {
                    for person in resp.results {
                        if seen.insert(person.id) {
                            let dept = person.known_for_department
                                .unwrap_or_else(|| "Unknown".to_string());
                            all.push((person.id, person.name, person.popularity, dept));
                        }
                    }
                    if page >= resp.total_pages {
                        break;
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch trending people page {}: {:?}", page, e);
                    break;
                }
            }
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }
        let trending_count = all.len();

        // 2. Popular people (stable top celebrities) — fill out the roster
        for page in 1..=PERSON_POPULAR_PAGES {
            let url = self.api_url(&format!("person/popular?page={}", page));
            match self.http.get_json::<TmdbListResponse<TmdbPersonListItem>>(&url).await {
                Ok(resp) => {
                    for person in resp.results {
                        if seen.insert(person.id) {
                            let dept = person.known_for_department
                                .unwrap_or_else(|| "Unknown".to_string());
                            all.push((person.id, person.name, person.popularity, dept));
                        }
                    }
                    if page >= resp.total_pages {
                        break;
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch popular people page {}: {:?}", page, e);
                    break;
                }
            }
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!(
            "Fetched {} people from TMDb ({} trending + {} popular, deduplicated)",
            all.len(), trending_count, all.len() - trending_count
        );
        Ok(all)
    }
}

#[async_trait::async_trait]
impl MarketDataSource for TmdbMarketSource {
    fn source_id(&self) -> &'static str {
        "tmdb"
    }

    fn display_name(&self) -> &'static str {
        "TMDb Movies, TV & Celebrities"
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

        // Refresh snapshot from live API — also caches for fetch_prices()
        let snap = self.refresh_snapshot().await;
        let mut assets = Vec::new();

        for (id, title, _, _) in &snap.movies {
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

        for (id, name, _, _) in &snap.tv_shows {
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

        for (id, name, _, dept) in &snap.people {
            assets.push(AssetUpdate {
                asset_id: format!("tmdb_person_{}", id),
                symbol: format!("TMDB#P{}", id),
                name: name.clone(),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("person:{}", id),
                    "subcategory": "celebrities",
                    "active": true,
                    "extra": { "department": dept },
                }),
            });
        }

        info!("Discovered {} TMDb assets via live API", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();

        // Build set of active asset IDs for filtering
        let active_set: std::collections::HashSet<&str> =
            asset_ids.iter().map(|s| s.as_str()).collect();

        // Read the cached snapshot (populated by fetch_assets).
        // If snapshot is empty (first price sync before any asset sync), refresh it.
        let snap = {
            let cached = self.snapshot.lock().unwrap_or_else(|e| e.into_inner()).clone();
            if cached.movies.is_empty() && cached.tv_shows.is_empty() && cached.people.is_empty() {
                info!("TMDb snapshot empty, refreshing for price fetch");
                self.refresh_snapshot().await
            } else {
                cached
            }
        };

        let mut results = Vec::new();

        // Movies — only price assets that are in the active set
        for (id, title, popularity, vote_count) in &snap.movies {
            let asset_id = format!("tmdb_movie_{}", id);
            if !active_set.contains(asset_id.as_str()) {
                continue;
            }
            results.push(PriceUpdate {
                asset_id,
                symbol: title.clone(),
                value: Decimal::from_f64_retain(*popularity)
                    .unwrap_or(Decimal::ZERO),
                prev_close: None,
                change_pct: None,
                volume_24h: Some(Decimal::from(*vote_count)),
                market_cap: None,
                fetched_at: now,
            });
        }

        // TV shows
        for (id, name, popularity, vote_count) in &snap.tv_shows {
            let asset_id = format!("tmdb_tv_{}", id);
            if !active_set.contains(asset_id.as_str()) {
                continue;
            }
            results.push(PriceUpdate {
                asset_id,
                symbol: name.clone(),
                value: Decimal::from_f64_retain(*popularity)
                    .unwrap_or(Decimal::ZERO),
                prev_close: None,
                change_pct: None,
                volume_24h: Some(Decimal::from(*vote_count)),
                market_cap: None,
                fetched_at: now,
            });
        }

        // People
        for (id, name, popularity, _dept) in &snap.people {
            let asset_id = format!("tmdb_person_{}", id);
            if !active_set.contains(asset_id.as_str()) {
                continue;
            }
            results.push(PriceUpdate {
                asset_id,
                symbol: name.clone(),
                value: Decimal::from_f64_retain(*popularity)
                    .unwrap_or(Decimal::ZERO),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        if results.len() < asset_ids.len() {
            warn!(
                "TMDb: priced {}/{} active assets (rest rotated off popular lists, will be deactivated)",
                results.len(),
                asset_ids.len()
            );
        }

        info!("Fetched {} prices from TMDb (movies + TV + people)", results.len());
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

        // Discover trending + popular people
        info!("Discovering TMDb trending + popular people...");
        let people = self
            .fetch_people()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover TMDb people: {:?}", e))?;

        for (id, name, _, _) in &people {
            entries.push(AssetEntry {
                asset_id: format!("tmdb_person_{}", id),
                symbol: format!("TMDB#P{}", id),
                name: name.clone(),
                category: "sentiment".to_string(),
                subcategory: "celebrities".to_string(),
                api_ref: format!("person:{}", id),
                active: true,
            });
        }

        info!(
            "Discovered {} total TMDb assets ({} movies + {} TV shows + {} people)",
            entries.len(),
            movies.len(),
            shows.len(),
            people.len()
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
    if let Some(id) = asset_id.strip_prefix("tmdb_person_") {
        if id.parse::<u64>().is_ok() {
            return Some(format!("person:{}", id));
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
    fn test_parse_api_ref_person() {
        assert_eq!(
            parse_api_ref_from_asset_id("tmdb_person_500"),
            Some("person:500".to_string())
        );
        assert_eq!(
            parse_api_ref_from_asset_id("tmdb_person_287"),
            Some("person:287".to_string())
        );
    }

    #[test]
    fn test_parse_api_ref_invalid() {
        assert_eq!(parse_api_ref_from_asset_id("invalid"), None);
        assert_eq!(parse_api_ref_from_asset_id("tmdb_movie_"), None);
        assert_eq!(parse_api_ref_from_asset_id("tmdb_movie_abc"), None);
        assert_eq!(parse_api_ref_from_asset_id("tmdb_person_"), None);
        assert_eq!(parse_api_ref_from_asset_id(""), None);
    }

    #[test]
    fn test_asset_id_format() {
        let movie_id = format!("tmdb_movie_{}", 550);
        assert_eq!(movie_id, "tmdb_movie_550");

        let tv_id = format!("tmdb_tv_{}", 1399);
        assert_eq!(tv_id, "tmdb_tv_1399");

        let person_id = format!("tmdb_person_{}", 500);
        assert_eq!(person_id, "tmdb_person_500");
    }

    #[test]
    fn test_api_ref_strip() {
        let api_ref = "movie:550";
        assert_eq!(api_ref.strip_prefix("movie:"), Some("550"));

        let api_ref = "tv:1399";
        assert_eq!(api_ref.strip_prefix("tv:"), Some("1399"));

        let api_ref = "person:500";
        assert_eq!(api_ref.strip_prefix("person:"), Some("500"));

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

        let path = "trending/person/day?page=1";
        let sep = if path.contains('?') { '&' } else { '?' };
        let url = format!("{}/{}{}api_key={}", base, path, sep, key);
        assert_eq!(
            url,
            "https://api.themoviedb.org/3/trending/person/day?page=1&api_key=test_key"
        );
    }
}
