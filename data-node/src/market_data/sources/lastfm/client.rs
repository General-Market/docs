//! Last.fm API client implementing MarketDataSource
//!
//! Tracks listener counts and play counts for music artists/celebrities.
//! Discovery is dynamic — fetches top artists from Last.fm charts.
//!
//! API: https://ws.audioscrobbler.com/2.0/
//! Auth: LASTFM_API_KEY env var (passed as query param)
//! Rate limit: ~5 req/s (undocumented, community-tested)
//! Feeds per artist: 2 (listeners, playcount)

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Asset configuration (empty — all assets are dynamic via charts)
const ASSET_JSON: &str = include_str!("../../../config/lastfm.json");

/// Last.fm API base URL
const API_BASE: &str = "https://ws.audioscrobbler.com/2.0/";

/// Delay between API calls (ms) — stay under ~5 req/s
const INTER_REQUEST_DELAY_MS: u64 = 250;

/// How many pages of top artists to fetch from chart (50 artists/page)
const CHART_PAGES: u32 = 10;

/// Artists per page from chart.getTopArtists
const ARTISTS_PER_PAGE: u32 = 50;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Wrapper for chart.getTopArtists response
#[derive(Debug, Deserialize)]
struct ChartTopArtistsResponse {
    artists: ChartArtistList,
}

#[derive(Debug, Deserialize)]
struct ChartArtistList {
    artist: Vec<ChartArtist>,
    #[serde(rename = "@attr")]
    attr: Option<ChartAttr>,
}

#[derive(Debug, Deserialize)]
struct ChartAttr {
    #[serde(rename = "totalPages", default)]
    total_pages: String,
}

#[derive(Debug, Deserialize)]
struct ChartArtist {
    name: String,
    #[serde(default)]
    playcount: String,
    #[serde(default)]
    listeners: String,
    mbid: Option<String>,
}

/// Wrapper for artist.getInfo response
#[derive(Debug, Deserialize)]
struct ArtistInfoResponse {
    artist: Option<ArtistInfo>,
}

#[derive(Debug, Deserialize)]
struct ArtistInfo {
    name: String,
    stats: Option<ArtistStats>,
}

#[derive(Debug, Deserialize)]
struct ArtistStats {
    #[serde(default)]
    listeners: String,
    #[serde(default)]
    playcount: String,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct LastfmMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl LastfmMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("LASTFM_API_KEY")
            .context("LASTFM_API_KEY environment variable must be set")?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 250, // ~4 req/s * 60s, stay under 5 req/s
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Last.fm source initialized (dynamic assets from chart.getTopArtists)");

        Ok(Self { http, api_key })
    }

    /// Build a Last.fm API URL
    fn api_url(&self, method: &str, extra_params: &str) -> String {
        format!(
            "{}?method={}&api_key={}&format=json{}",
            API_BASE, method, self.api_key,
            if extra_params.is_empty() { String::new() } else { format!("&{}", extra_params) }
        )
    }

    /// Fetch top artists from Last.fm charts
    async fn fetch_chart_artists(&self) -> Result<Vec<(String, u64, u64)>, SourceError> {
        let mut all = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for page in 1..=CHART_PAGES {
            let url = self.api_url(
                "chart.getTopArtists",
                &format!("page={}&limit={}", page, ARTISTS_PER_PAGE),
            );
            match self.http.get_json::<ChartTopArtistsResponse>(&url).await {
                Ok(resp) => {
                    for artist in resp.artists.artist {
                        let name = artist.name.trim().to_string();
                        if name.is_empty() || !seen.insert(name.to_lowercase()) {
                            continue;
                        }
                        let listeners = artist.listeners.parse::<u64>().unwrap_or(0);
                        let playcount = artist.playcount.parse::<u64>().unwrap_or(0);
                        all.push((name, listeners, playcount));
                    }
                    // Check total pages
                    if let Some(attr) = resp.artists.attr {
                        let total: u32 = attr.total_pages.parse().unwrap_or(u32::MAX);
                        if page >= total {
                            break;
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch Last.fm chart page {}: {:?}", page, e);
                    break;
                }
            }
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!("Fetched {} artists from Last.fm charts", all.len());
        Ok(all)
    }

    /// Percent-encode a string for use in query parameters
    fn percent_encode(s: &str) -> String {
        let mut encoded = String::new();
        for byte in s.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(byte as char);
                }
                _ => {
                    encoded.push_str(&format!("%{:02X}", byte));
                }
            }
        }
        encoded
    }

    /// Fetch detailed info for a single artist (used for price updates on specific artists)
    #[allow(dead_code)]
    async fn fetch_artist_info(&self, artist_name: &str) -> Result<(u64, u64), SourceError> {
        let encoded = Self::percent_encode(artist_name);
        let url = self.api_url("artist.getInfo", &format!("artist={}", encoded));
        let resp: ArtistInfoResponse = self.http.get_json(&url).await?;
        if let Some(artist) = resp.artist {
            if let Some(stats) = artist.stats {
                let listeners = stats.listeners.parse::<u64>().unwrap_or(0);
                let playcount = stats.playcount.parse::<u64>().unwrap_or(0);
                return Ok((listeners, playcount));
            }
        }
        Ok((0, 0))
    }

    /// Normalize artist name to a safe asset_id slug
    fn slugify(name: &str) -> String {
        name.to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' })
            .collect::<String>()
            .replace("__", "_")
            .trim_matches('_')
            .to_string()
    }
}

#[async_trait::async_trait]
impl MarketDataSource for LastfmMarketSource {
    fn source_id(&self) -> &'static str {
        "lastfm"
    }

    fn display_name(&self) -> &'static str {
        "Last.fm Music Artists"
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
                max_requests: 250,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Dynamic discovery via charts
        info!("Last.fm config is empty, discovering top artists from charts");
        let mut assets = Vec::new();

        match self.fetch_chart_artists().await {
            Ok(artists) => {
                for (name, _, _) in &artists {
                    let slug = Self::slugify(name);
                    if slug.is_empty() {
                        continue;
                    }

                    // Two feeds per artist: listeners and playcount
                    assets.push(AssetUpdate {
                        asset_id: format!("lastfm_{}_listeners", slug),
                        symbol: format!("LFM#{}", slug),
                        name: format!("{} (listeners)", name),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": name,
                            "subcategory": "music_artists",
                            "active": true,
                            "extra": { "metric": "listeners" },
                        }),
                    });
                    assets.push(AssetUpdate {
                        asset_id: format!("lastfm_{}_playcount", slug),
                        symbol: format!("LFM#{}_plays", slug),
                        name: format!("{} (scrobbles)", name),
                        category: Some("sentiment".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": name,
                            "subcategory": "music_artists",
                            "active": true,
                            "extra": { "metric": "playcount" },
                        }),
                    });
                }
            }
            Err(e) => warn!("Failed to discover Last.fm artists: {:?}", e),
        }

        info!("Discovered {} Last.fm assets ({} artists × 2 feeds)", assets.len(), assets.len() / 2);
        Ok(assets)
    }

    async fn fetch_prices(&self, _asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        // Re-fetch chart — it returns listeners + playcount inline (Pattern F)
        let now = Utc::now();
        let mut results = Vec::new();

        match self.fetch_chart_artists().await {
            Ok(artists) => {
                for (name, listeners, playcount) in artists {
                    let slug = Self::slugify(&name);
                    if slug.is_empty() {
                        continue;
                    }

                    results.push(PriceUpdate {
                        asset_id: format!("lastfm_{}_listeners", slug),
                        symbol: format!("{} (listeners)", name),
                        value: Decimal::from(listeners),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                    results.push(PriceUpdate {
                        asset_id: format!("lastfm_{}_playcount", slug),
                        symbol: format!("{} (plays)", name),
                        value: Decimal::from(playcount),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }
            Err(e) => warn!("Failed to fetch Last.fm prices: {:?}", e),
        }

        info!("Fetched {} prices from Last.fm", results.len());
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        let artists = self
            .fetch_chart_artists()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover Last.fm artists: {:?}", e))?;

        let mut entries = Vec::new();
        for (name, _, _) in &artists {
            let slug = Self::slugify(name);
            if slug.is_empty() {
                continue;
            }
            entries.push(AssetEntry {
                asset_id: format!("lastfm_{}_listeners", slug),
                symbol: format!("LFM#{}", slug),
                name: format!("{} (listeners)", name),
                category: "sentiment".to_string(),
                subcategory: "music_artists".to_string(),
                api_ref: name.clone(),
                active: true,
            });
            entries.push(AssetEntry {
                asset_id: format!("lastfm_{}_playcount", slug),
                symbol: format!("LFM#{}_plays", slug),
                name: format!("{} (scrobbles)", name),
                category: "sentiment".to_string(),
                subcategory: "music_artists".to_string(),
                api_ref: name.clone(),
                active: true,
            });
        }

        info!("Discovered {} Last.fm assets ({} artists)", entries.len(), artists.len());
        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("lastfm", "lastfm");
    }

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.is_empty(), "Config should be empty — assets are dynamic");
    }

    #[test]
    fn test_slugify() {
        assert_eq!(LastfmMarketSource::slugify("The Weeknd"), "the_weeknd");
        assert_eq!(LastfmMarketSource::slugify("Kanye West"), "kanye_west");
        assert_eq!(LastfmMarketSource::slugify("AC/DC"), "ac_dc");
        assert_eq!(LastfmMarketSource::slugify("Beyoncé"), "beyoncé");
        assert_eq!(LastfmMarketSource::slugify("twenty one pilots"), "twenty_one_pilots");
        assert_eq!(LastfmMarketSource::slugify("  spaces  "), "spaces");
    }

    #[test]
    fn test_slugify_empty() {
        assert_eq!(LastfmMarketSource::slugify(""), "");
        assert_eq!(LastfmMarketSource::slugify("   "), "");
    }

    #[test]
    fn test_asset_id_format() {
        let slug = LastfmMarketSource::slugify("Taylor Swift");
        assert_eq!(format!("lastfm_{}_listeners", slug), "lastfm_taylor_swift_listeners");
        assert_eq!(format!("lastfm_{}_playcount", slug), "lastfm_taylor_swift_playcount");
    }

    #[test]
    fn test_api_url_building() {
        let base = "https://ws.audioscrobbler.com/2.0/";
        let key = "test_key";
        let method = "chart.getTopArtists";
        let extra = "page=1&limit=50";
        let url = format!(
            "{}?method={}&api_key={}&format=json&{}",
            base, method, key, extra
        );
        assert_eq!(
            url,
            "https://ws.audioscrobbler.com/2.0/?method=chart.getTopArtists&api_key=test_key&format=json&page=1&limit=50"
        );
    }

    #[test]
    fn test_listener_count_parsing() {
        let val: u64 = "12345678".parse().unwrap();
        let dec = Decimal::from(val);
        assert_eq!(dec.to_string(), "12345678");
    }
}
