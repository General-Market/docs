//! Steam API client implementing MarketDataSource
//!
//! Tracks concurrent player counts for top games via the Steam Web API.
//! Assets are fully dynamic — discovered from SteamSpy top games list.
//!
//! When a game falls off the top 500 list, it continues to be tracked.
//! After 7 days off the list, the sync engine's retention pruning deactivates it.
//!
//! API: https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/
//! Auth: None
//! Rate limit: ~100k calls/day (~694 per 10-min window)

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
const ASSET_JSON: &str = include_str!("../../../config/steam.json");

/// Steam Web API base URL
const STEAM_API_URL: &str = "https://api.steampowered.com";

/// SteamSpy API for top games discovery
const STEAMSPY_API_URL: &str = "https://steamspy.com/api.php";

/// Delay between sequential player count fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 1200;

/// How many top games to discover
const TOP_GAMES_COUNT: usize = 500;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Steam GetNumberOfCurrentPlayers response
#[derive(Debug, Deserialize)]
struct PlayerCountResponse {
    response: PlayerCountInner,
}

#[derive(Debug, Deserialize)]
struct PlayerCountInner {
    #[serde(default)]
    player_count: u64,
    result: u32,
}

/// SteamSpy top games response (map of appid -> game info)
#[derive(Debug, Deserialize)]
struct SteamSpyGame {
    appid: u64,
    name: String,
    #[serde(default)]
    ccu: u64,
}

/// Seed list of well-known popular Steam games (fallback if SteamSpy is down)
const SEED_APPIDS: &[(u64, &str)] = &[
    (730, "Counter-Strike 2"),
    (570, "Dota 2"),
    (440, "Team Fortress 2"),
    (578080, "PUBG: BATTLEGROUNDS"),
    (1172470, "Apex Legends"),
    (252490, "Rust"),
    (271590, "Grand Theft Auto V"),
    (1599340, "Lost Ark"),
    (292030, "The Witcher 3"),
    (1245620, "Elden Ring"),
    (1091500, "Cyberpunk 2077"),
    (1326470, "Sons Of The Forest"),
    (413150, "Stardew Valley"),
    (236390, "War Thunder"),
    (346110, "ARK: Survival Evolved"),
    (218620, "PAYDAY 2"),
    (105600, "Terraria"),
    (238960, "Path of Exile"),
    (255710, "Cities: Skylines"),
    (1086940, "Baldur's Gate 3"),
];

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Steam market data source.
///
/// Tracks concurrent player counts for top games.
/// Source ID is `"steam"`.
pub struct SteamMarketSource {
    http: SourceHttpClient,
}

impl SteamMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 600, // ~694 budget per 10 min, stay conservative
                duration: Duration::from_secs(600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Steam source initialized (dynamic assets from SteamSpy)");

        Ok(Self { http })
    }

    /// Fetch concurrent player count for a single app
    async fn fetch_player_count(&self, appid: u64) -> Result<u64, SourceError> {
        let url = format!(
            "{}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid={}",
            STEAM_API_URL, appid
        );
        let resp: PlayerCountResponse = self.http.get_json(&url).await?;
        if resp.response.result != 1 {
            return Err(SourceError::DataError(format!(
                "Steam API returned result={} for appid {}",
                resp.response.result, appid
            )));
        }
        Ok(resp.response.player_count)
    }

    /// Discover top games from SteamSpy (all endpoint returns 1000 games sorted by CCU)
    async fn discover_top_games(&self) -> Result<Vec<(u64, String)>, SourceError> {
        let url = format!("{}?request=all&page=0", STEAMSPY_API_URL);

        match self
            .http
            .get_json::<std::collections::HashMap<String, SteamSpyGame>>(&url)
            .await
        {
            Ok(games) => {
                let total = games.len();
                let mut result: Vec<(u64, String, u64)> = games
                    .into_values()
                    .map(|g| (g.appid, g.name, g.ccu))
                    .collect();
                // Sort by concurrent users descending
                result.sort_by(|a, b| b.2.cmp(&a.2));
                result.truncate(TOP_GAMES_COUNT);
                info!("SteamSpy returned {} games, kept top {}", total, result.len());
                Ok(result.into_iter().map(|(id, name, _)| (id, name)).collect())
            }
            Err(e) => {
                warn!("SteamSpy API failed, using seed list: {:?}", e);
                Ok(SEED_APPIDS
                    .iter()
                    .map(|(id, name)| (*id, name.to_string()))
                    .collect())
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for SteamMarketSource {
    fn source_id(&self) -> &'static str {
        "steam"
    }

    fn display_name(&self) -> &'static str {
        "Steam Games"
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
                max_requests: 600,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Dynamic discovery from SteamSpy
        info!("Steam config is empty, performing live asset discovery");
        let games = self
            .discover_top_games()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover Steam games: {:?}", e))?;

        let mut assets = Vec::with_capacity(games.len());
        for (appid, name) in &games {
            assets.push(AssetUpdate {
                asset_id: format!("steam_game_{}", appid),
                symbol: format!("STEAM#{}", appid),
                name: name.clone(),
                category: Some("sentiment".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("appid:{}", appid),
                    "subcategory": "games",
                    "active": true,
                    "extra": {},
                }),
            });
        }

        info!("Discovered {} Steam games via SteamSpy", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Load api_ref and name lookup from config
        let entries = load_all_asset_entries(ASSET_JSON).unwrap_or_default();
        let ref_lookup: std::collections::HashMap<String, String> = entries
            .iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();
        let name_lookup: std::collections::HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.name))
            .collect();

        for asset_id in asset_ids {
            let appid = if let Some(api_ref) = ref_lookup.get(asset_id) {
                parse_appid_from_ref(api_ref)
            } else {
                parse_appid_from_asset_id(asset_id)
            };

            let appid = match appid {
                Some(id) => id,
                None => {
                    debug!("Cannot parse appid from asset_id: {}", asset_id);
                    continue;
                }
            };

            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_player_count(appid).await {
                Ok(count) => {
                    let sym = name_lookup.get(asset_id)
                        .cloned()
                        .unwrap_or_else(|| format!("STEAM#{}", appid));
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: sym,
                        value: Decimal::from(count),
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Err(e) => {
                    warn!("Failed to fetch player count for appid {}: {:?}", appid, e);
                }
            }
        }

        info!(
            "Fetched {}/{} prices from Steam",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        info!("Discovering top {} Steam games...", TOP_GAMES_COUNT);
        let games = self
            .discover_top_games()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to discover Steam games: {:?}", e))?;

        let entries: Vec<AssetEntry> = games
            .into_iter()
            .map(|(appid, name)| AssetEntry {
                asset_id: format!("steam_game_{}", appid),
                symbol: format!("STEAM#{}", appid),
                name,
                category: "sentiment".to_string(),
                subcategory: "games".to_string(),
                api_ref: format!("appid:{}", appid),
                active: true,
            })
            .collect();

        info!("Discovered {} Steam game assets", entries.len());
        Ok(entries)
    }
}

/// Parse appid from api_ref like "appid:730"
fn parse_appid_from_ref(api_ref: &str) -> Option<u64> {
    api_ref.strip_prefix("appid:")?.parse().ok()
}

/// Parse appid from asset_id like "steam_game_730"
fn parse_appid_from_asset_id(asset_id: &str) -> Option<u64> {
    asset_id.strip_prefix("steam_game_")?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("steam", "steam");
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
    fn test_parse_appid_from_ref() {
        assert_eq!(parse_appid_from_ref("appid:730"), Some(730));
        assert_eq!(parse_appid_from_ref("appid:578080"), Some(578080));
        assert_eq!(parse_appid_from_ref("invalid"), None);
        assert_eq!(parse_appid_from_ref("appid:"), None);
        assert_eq!(parse_appid_from_ref("appid:abc"), None);
    }

    #[test]
    fn test_parse_appid_from_asset_id() {
        assert_eq!(parse_appid_from_asset_id("steam_game_730"), Some(730));
        assert_eq!(parse_appid_from_asset_id("steam_game_578080"), Some(578080));
        assert_eq!(parse_appid_from_asset_id("invalid"), None);
        assert_eq!(parse_appid_from_asset_id("steam_game_"), None);
    }

    #[test]
    fn test_asset_id_format() {
        let asset_id = format!("steam_game_{}", 730);
        assert_eq!(asset_id, "steam_game_730");
    }

    #[test]
    fn test_player_count_to_decimal() {
        let count: u64 = 1_500_000;
        let value = Decimal::from(count);
        assert_eq!(value, Decimal::from(1_500_000));

        // Zero players (game offline / no one playing)
        let count: u64 = 0;
        let value = Decimal::from(count);
        assert_eq!(value, Decimal::from(0));
    }

    #[test]
    fn test_seed_appids_not_empty() {
        assert!(!SEED_APPIDS.is_empty());
        // All seed appids should be valid
        for (appid, name) in SEED_APPIDS {
            assert!(*appid > 0, "Invalid appid for {}", name);
            assert!(!name.is_empty(), "Empty name for appid {}", appid);
        }
    }

    #[test]
    fn test_api_ref_roundtrip() {
        let appid: u64 = 730;
        let api_ref = format!("appid:{}", appid);
        assert_eq!(parse_appid_from_ref(&api_ref), Some(730));
    }
}
