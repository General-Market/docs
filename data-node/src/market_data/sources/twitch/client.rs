//! Twitch Helix API client implementing MarketDataSource
//!
//! Fetches top live streams from https://api.twitch.tv/helix
//! Requires TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET env vars.
//! Rate limit: 800 req/min allowed, conservative at 30 req/min.
//!
//! Uses a 60s shared cache between `fetch_assets` and `fetch_prices` to avoid
//! redundant requests (Helix API returns both metadata and viewer counts in one call).

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

/// Twitch Helix API base URL
const HELIX_API: &str = "https://api.twitch.tv/helix";

/// Twitch OAuth2 token endpoint
const TOKEN_URL: &str = "https://id.twitch.tv/oauth2/token";

/// Cache TTL: 60 seconds (shared between fetch_assets and fetch_prices)
const CACHE_TTL_SECS: u64 = 60;

/// Maximum streams to fetch per request (Twitch max is 100)
const PAGE_LIMIT: u32 = 100;

// ============================================================================
// Twitch API response types
// ============================================================================

#[derive(Debug, Deserialize)]
struct HelixStreamsResponse {
    data: Vec<HelixStream>,
}

#[derive(Debug, Deserialize)]
struct HelixStream {
    /// Stream ID
    #[allow(dead_code)]
    id: String,
    /// Broadcaster's login name (lowercase)
    user_login: String,
    /// Broadcaster's display name
    user_name: String,
    /// Game/category ID
    #[allow(dead_code)]
    game_id: String,
    /// Game/category name
    game_name: String,
    /// Stream title
    title: String,
    /// Current viewer count
    viewer_count: u64,
    /// Stream language
    #[allow(dead_code)]
    language: String,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[allow(dead_code)]
    expires_in: u64,
    #[allow(dead_code)]
    token_type: String,
}

// ============================================================================
// Cached stream data
// ============================================================================

#[derive(Debug, Clone)]
struct CachedStream {
    /// Market ID: "twitch_{login}"
    market_id: String,
    /// Broadcaster's display name
    display_name: String,
    /// Stream title
    title: String,
    /// Current viewer count
    viewer_count: u64,
    /// Game/category name
    game_name: String,
    /// Broadcaster's login name
    login: String,
}

struct CacheEntry {
    streams: Vec<CachedStream>,
    fetched_at: Instant,
}

// ============================================================================
// OAuth token cache
// ============================================================================

struct TokenCache {
    token: String,
    expires_at: Instant,
}

// ============================================================================
// TwitchSource
// ============================================================================

/// Twitch viewer count data source
pub struct TwitchSource {
    client: reqwest::Client,
    client_id: String,
    client_secret: String,
    cache: Arc<RwLock<Option<CacheEntry>>>,
    token_cache: Arc<RwLock<Option<TokenCache>>>,
}

impl TwitchSource {
    /// Create a new Twitch source from TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET env vars
    pub fn from_env() -> Result<Self> {
        let client_id = std::env::var("TWITCH_CLIENT_ID")
            .context("TWITCH_CLIENT_ID env var not set")?;
        let client_secret = std::env::var("TWITCH_CLIENT_SECRET")
            .context("TWITCH_CLIENT_SECRET env var not set")?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to build reqwest client")?;

        info!("Twitch source initialized (Helix API)");

        Ok(Self {
            client,
            client_id,
            client_secret,
            cache: Arc::new(RwLock::new(None)),
            token_cache: Arc::new(RwLock::new(None)),
        })
    }

    /// Get a valid OAuth bearer token, refreshing if expired.
    async fn get_token(&self) -> Result<String> {
        // Check token cache
        {
            let cache = self.token_cache.read().await;
            if let Some(entry) = cache.as_ref() {
                if entry.expires_at > Instant::now() {
                    return Ok(entry.token.clone());
                }
            }
        }

        // Token expired or missing — request new one via client credentials flow
        debug!("Twitch: requesting new OAuth token");

        let resp = self
            .client
            .post(TOKEN_URL)
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("grant_type", "client_credentials"),
            ])
            .send()
            .await
            .context("Failed to request Twitch OAuth token")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("Twitch OAuth error: {} {}", status, body);
            anyhow::bail!("Twitch OAuth returned {}", status);
        }

        let token_resp: TokenResponse = resp
            .json()
            .await
            .context("Failed to parse Twitch OAuth response")?;

        // Cache with 60s safety margin before actual expiry
        let expires_at = Instant::now()
            + Duration::from_secs(token_resp.expires_in.saturating_sub(60));

        let token = token_resp.access_token.clone();

        {
            let mut cache = self.token_cache.write().await;
            *cache = Some(TokenCache {
                token: token_resp.access_token,
                expires_at,
            });
        }

        info!("Twitch: OAuth token refreshed (expires in {}s)", token_resp.expires_in);

        Ok(token)
    }

    /// Fetch streams from the Helix API and populate cache.
    /// Returns cached data if still fresh (< 60s old).
    async fn fetch_and_cache(&self) -> Result<Vec<CachedStream>> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.as_ref() {
                if entry.fetched_at.elapsed() < Duration::from_secs(CACHE_TTL_SECS) {
                    debug!(
                        "Twitch: using cached data ({} streams, {:.1}s old)",
                        entry.streams.len(),
                        entry.fetched_at.elapsed().as_secs_f64()
                    );
                    return Ok(entry.streams.clone());
                }
            }
        }

        // Cache miss or stale — fetch fresh data
        let streams = self.fetch_top_streams().await?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            *cache = Some(CacheEntry {
                streams: streams.clone(),
                fetched_at: Instant::now(),
            });
        }

        Ok(streams)
    }

    /// Fetch top streams from Helix API by viewer count
    async fn fetch_top_streams(&self) -> Result<Vec<CachedStream>> {
        let token = self.get_token().await?;

        let url = format!(
            "{}/streams?first={}",
            HELIX_API, PAGE_LIMIT
        );

        debug!("Twitch: fetching top streams from {}", url);

        let resp = self
            .client
            .get(&url)
            .header("Client-ID", &self.client_id)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .context("Failed to fetch Twitch streams")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            warn!("Twitch Helix API error: {} {}", status, body);
            anyhow::bail!("Helix API returned {}", status);
        }

        let response: HelixStreamsResponse = resp
            .json()
            .await
            .context("Failed to parse Helix API response")?;

        let cached_streams: Vec<CachedStream> = response
            .data
            .into_iter()
            .filter(|s| !s.user_login.is_empty())
            .map(|s| CachedStream {
                market_id: format!("twitch_{}", s.user_login),
                display_name: s.user_name,
                title: s.title,
                viewer_count: s.viewer_count,
                game_name: s.game_name,
                login: s.user_login,
            })
            .collect();

        info!(
            "Twitch: fetched {} live streams",
            cached_streams.len()
        );

        Ok(cached_streams)
    }
}

// ============================================================================
// MarketDataSource implementation
// ============================================================================

#[async_trait::async_trait]
impl MarketDataSource for TwitchSource {
    fn source_id(&self) -> &'static str {
        "twitch"
    }

    fn display_name(&self) -> &'static str {
        "Twitch Viewer Counts"
    }

    fn default_resolution(&self) -> &'static str {
        "live"
    }

    fn sync_interval(&self) -> Duration {
        // Viewer counts change frequently; 60 seconds
        Duration::from_secs(60)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // Twitch allows 800 req/min, be conservative at 30/min
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 25, // Conservative to stay under 30/min
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let streams = self.fetch_and_cache().await?;

        Ok(streams
            .into_iter()
            .map(|s| AssetUpdate {
                asset_id: s.market_id.clone(),
                symbol: s.market_id,
                name: s.display_name.clone(),
                category: Some(s.game_name.clone()),
                metadata: serde_json::json!({
                    "source": "twitch",
                    "login": s.login,
                    "display_name": s.display_name,
                    "game_name": s.game_name,
                    "title": s.title,
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let streams = self.fetch_and_cache().await?;

        // Build lookup set for requested asset IDs
        let requested: std::collections::HashSet<&str> =
            asset_ids.iter().map(|s| s.as_str()).collect();

        let results: Vec<PriceUpdate> = streams
            .into_iter()
            .filter(|s| requested.contains(s.market_id.as_str()))
            .map(|s| PriceUpdate {
                asset_id: s.market_id.clone(),
                symbol: s.market_id,
                value: Decimal::from(s.viewer_count),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            })
            .collect();

        info!(
            "Fetched {}/{} prices from Twitch",
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
        let login = "xqc";
        let market_id = format!("twitch_{}", login);
        assert_eq!(market_id, "twitch_xqc");
    }

    #[test]
    fn test_market_id_format_complex() {
        let login = "shroud";
        let market_id = format!("twitch_{}", login);
        assert_eq!(market_id, "twitch_shroud");
    }

    #[test]
    fn test_viewer_count_to_decimal() {
        let viewer_count: u64 = 45000;
        let decimal = Decimal::from(viewer_count);
        assert_eq!(decimal, Decimal::from(45000u64));
    }

    #[test]
    fn test_source_id() {
        assert_eq!("twitch", "twitch");
    }
}
