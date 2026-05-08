//! Lichess chess data source implementing MarketDataSource
//!
//! Tracks top player ratings, live TV channel ratings, and tournament activity
//! from Lichess.org. The daily puzzle metric was dropped: it changes once a day
//! and sits frozen for the other 23h59m -- a flat asymptote masquerading as a
//! price. TV channel ratings move every time the featured game ends and a new
//! pair takes the seat (every few minutes); that is the live signal.
//!
//! Assets are static -- defined in config/lichess.json (32 entries; the puzzle
//! row is retained but inactive for backward compatibility, leaving 31 active).
//!
//! Strategy: 3 API calls per sync cycle, each returning data for multiple feeds:
//!   1. GET /api/player          → top player ratings (13 variants)
//!   2. GET /api/tv/channels     → live TV channel ratings (16 channels)
//!   3. GET /api/tournament      → running tournament count & total players
//!
//! API: https://lichess.org/api
//! Auth: None (public API), but User-Agent header is REQUIRED
//! Rate limit: No published limit. Conservative: 60 req / 5 min.

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

// ============================================================================
// CONSTANTS
// ============================================================================

/// Asset configuration -- 32 chess feeds
const ASSET_JSON: &str = include_str!("../../../config/lichess.json");

/// User-Agent header required by Lichess (blocks default reqwest UA)
const USER_AGENT: &str = "IndexDataNode/1.0 (https://generalmarket.io)";

/// Lichess API endpoints
const LEADERBOARD_URL: &str = "https://lichess.org/api/player";
const TV_CHANNELS_URL: &str = "https://lichess.org/api/tv/channels";
const TOURNAMENT_URL: &str = "https://lichess.org/api/tournament";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

// --- Leaderboard ---

/// Top-level leaderboard response: each key is a variant name,
/// value is an array of top players.
/// We use a HashMap because the variant names are dynamic keys.
type LeaderboardResponse = HashMap<String, Vec<LeaderboardPlayer>>;

#[derive(Debug, Deserialize)]
struct LeaderboardPlayer {
    perfs: HashMap<String, PerfEntry>,
}

#[derive(Debug, Deserialize)]
struct PerfEntry {
    rating: i64,
}

// --- TV Channels ---

/// TV channels response: each key is a channel name,
/// value contains the rating of the current featured player.
type TvChannelsResponse = HashMap<String, TvChannel>;

#[derive(Debug, Deserialize)]
struct TvChannel {
    rating: Option<i64>,
}

// --- Tournaments ---

#[derive(Debug, Deserialize)]
struct TournamentResponse {
    started: Vec<TournamentEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TournamentEntry {
    nb_players: i64,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Lichess chess market data source.
///
/// Tracks top player ratings, live TV channel ratings, tournament activity,
/// and daily puzzle ratings. Source ID is `"lichess"`.
pub struct LichessMarketSource {
    http: SourceHttpClient,
}

impl LichessMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        };
        // Lichess REQUIRES a real User-Agent header — default reqwest UA is blocked
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(USER_AGENT)
            .build()?;
        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());
        info!("Lichess Chess source initialized");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for LichessMarketSource {
    fn source_id(&self) -> &'static str {
        "lichess"
    }

    fn display_name(&self) -> &'static str {
        "Lichess Chess"
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
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "Lichess fetch_assets: {} feeds loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to build asset_id → (api_ref, symbol) lookup
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        // Determine which categories of data we need
        let need_leaderboard = asset_ids.iter().any(|id| {
            ref_map
                .get(id)
                .map(|(r, _)| r.starts_with("top_"))
                .unwrap_or(false)
        });
        let need_tv = asset_ids.iter().any(|id| {
            ref_map
                .get(id)
                .map(|(r, _)| r.starts_with("tv_"))
                .unwrap_or(false)
        });
        let need_tournaments = asset_ids.iter().any(|id| {
            ref_map
                .get(id)
                .map(|(r, _)| r.starts_with("tournaments_"))
                .unwrap_or(false)
        });

        // Collect all values: api_ref → value
        let mut values: HashMap<String, i64> = HashMap::new();
        let mut api_calls = 0u32;

        // 1. Leaderboard — top player ratings per variant
        if need_leaderboard {
            match self.http.get_json::<LeaderboardResponse>(LEADERBOARD_URL).await {
                Ok(data) => {
                    api_calls += 1;
                    for (variant, players) in &data {
                        if let Some(top) = players.first() {
                            // The rating is stored under the variant key in perfs
                            if let Some(perf) = top.perfs.get(variant) {
                                values.insert(format!("top_{}", variant), perf.rating);
                            }
                        }
                    }
                    debug!("Lichess leaderboard: {} variants", data.len());
                }
                Err(e) => {
                    warn!("Lichess: failed to fetch leaderboard: {:?}", e);
                }
            }
        }

        // 2. TV Channels — current featured player ratings
        if need_tv {
            match self.http.get_json::<TvChannelsResponse>(TV_CHANNELS_URL).await {
                Ok(data) => {
                    api_calls += 1;
                    for (channel, info) in &data {
                        if let Some(rating) = info.rating {
                            // Channel names from API: "Bullet", "Blitz", etc.
                            // Our api_ref uses: "tv_bullet", "tv_blitz", etc.
                            let key = format!("tv_{}", to_camel_key(channel));
                            values.insert(key, rating);
                        }
                    }
                    debug!("Lichess TV channels: {} channels", data.len());
                }
                Err(e) => {
                    warn!("Lichess: failed to fetch TV channels: {:?}", e);
                }
            }
        }

        // 3. Tournaments — running count and total players
        if need_tournaments {
            match self.http.get_json::<TournamentResponse>(TOURNAMENT_URL).await {
                Ok(data) => {
                    api_calls += 1;
                    let running_count = data.started.len() as i64;
                    let total_players: i64 = data.started.iter().map(|t| t.nb_players).sum();
                    values.insert("tournaments_running".to_string(), running_count);
                    values.insert("tournaments_players".to_string(), total_players);
                    debug!(
                        "Lichess tournaments: {} running, {} total players",
                        running_count, total_players
                    );
                }
                Err(e) => {
                    warn!("Lichess: failed to fetch tournaments: {:?}", e);
                }
            }
        }

        // Map values to price updates
        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let (api_ref, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref for asset {}", asset_id);
                    continue;
                }
            };

            let value = match values.get(api_ref) {
                Some(v) => *v,
                None => {
                    debug!("Lichess: no value for api_ref '{}'", api_ref);
                    continue;
                }
            };

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: symbol.clone(),
                value: Decimal::from(value),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from Lichess ({} API calls)",
            results.len(),
            asset_ids.len(),
            api_calls,
        );
        Ok(results)
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/// Convert Lichess API channel names to our camelCase api_ref keys.
/// API returns: "Bullet", "Blitz", "Rapid", "Classical", "Chess960",
/// "UltraBullet", "Crazyhouse", "King of the Hill", "Three-check",
/// "Antichess", "Atomic", "Horde", "Racing Kings", "Computer", "Bot",
/// "Best"
fn to_camel_key(channel_name: &str) -> String {
    match channel_name {
        "Bullet" => "bullet".to_string(),
        "Blitz" => "blitz".to_string(),
        "Rapid" => "rapid".to_string(),
        "Classical" => "classical".to_string(),
        "Chess960" => "chess960".to_string(),
        "UltraBullet" => "ultraBullet".to_string(),
        "Crazyhouse" => "crazyhouse".to_string(),
        "King of the Hill" => "kingOfTheHill".to_string(),
        "Three-check" => "threeCheck".to_string(),
        "Antichess" => "antichess".to_string(),
        "Atomic" => "atomic".to_string(),
        "Horde" => "horde".to_string(),
        "Racing Kings" => "racingKings".to_string(),
        "Computer" => "computer".to_string(),
        "Bot" => "bot".to_string(),
        "Best" => "best".to_string(),
        // Fallback: lowercase first char
        other => {
            let mut s = other.to_string();
            if let Some(c) = s.get_mut(0..1) {
                c.make_ascii_lowercase();
            }
            // Remove spaces
            s.retain(|c| c != ' ');
            s
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            32,
            "Expected exactly 32 feed entries (incl. retired puzzle), got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(
            assets.len(),
            31,
            "Expected exactly 31 active feed assets (puzzle retired), got {}",
            assets.len()
        );
    }

    #[test]
    fn test_puzzle_is_retired() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let puzzle = entries
            .iter()
            .find(|e| e.api_ref == "puzzle_rating")
            .expect("puzzle entry kept for backward compat");
        assert!(
            !puzzle.active,
            "puzzle_rating must remain inactive — daily metric, frozen 23h59m"
        );
    }

    #[test]
    fn test_all_entries_sports_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "sports",
                "Entry {} should have sports category",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "chess",
                "Entry {} should have chess subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("lichess_"),
                "Asset ID {} should start with 'lichess_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_li() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("LI/"),
                "Symbol '{}' should start with 'LI/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), entries.len(), "All asset IDs should be unique");
    }

    #[test]
    fn test_unique_symbols() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut symbols: Vec<&str> = entries.iter().map(|e| e.symbol.as_str()).collect();
        symbols.sort();
        symbols.dedup();
        assert_eq!(
            symbols.len(),
            entries.len(),
            "All symbols should be unique"
        );
    }

    #[test]
    fn test_unique_api_refs() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        refs.dedup();
        assert_eq!(
            refs.len(),
            entries.len(),
            "All api_ref values should be unique"
        );
    }

    #[test]
    fn test_api_ref_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let top_count = entries.iter().filter(|e| e.api_ref.starts_with("top_")).count();
        let tv_count = entries.iter().filter(|e| e.api_ref.starts_with("tv_")).count();
        let tournament_count = entries.iter().filter(|e| e.api_ref.starts_with("tournaments_")).count();
        let puzzle_count = entries.iter().filter(|e| e.api_ref == "puzzle_rating").count();

        assert_eq!(top_count, 13, "Expected 13 top player feeds");
        assert_eq!(tv_count, 16, "Expected 16 TV channel feeds");
        assert_eq!(tournament_count, 2, "Expected 2 tournament feeds");
        assert_eq!(puzzle_count, 1, "Puzzle row retained for back-compat (inactive)");
    }

    #[test]
    fn test_to_camel_key() {
        assert_eq!(to_camel_key("Bullet"), "bullet");
        assert_eq!(to_camel_key("Blitz"), "blitz");
        assert_eq!(to_camel_key("King of the Hill"), "kingOfTheHill");
        assert_eq!(to_camel_key("Three-check"), "threeCheck");
        assert_eq!(to_camel_key("Racing Kings"), "racingKings");
        assert_eq!(to_camel_key("UltraBullet"), "ultraBullet");
        assert_eq!(to_camel_key("Chess960"), "chess960");
        assert_eq!(to_camel_key("Bot"), "bot");
        assert_eq!(to_camel_key("Best"), "best");
    }

    #[test]
    fn test_parse_leaderboard_response() {
        let json = r#"{
            "bullet": [{"id": "player1", "username": "Player1", "perfs": {"bullet": {"rating": 3465, "progress": 0}}, "title": "GM"}],
            "blitz": [{"id": "player2", "username": "Player2", "perfs": {"blitz": {"rating": 3002, "progress": 5}}}]
        }"#;

        let data: LeaderboardResponse = serde_json::from_str(json).unwrap();
        assert_eq!(data.len(), 2);
        assert_eq!(data["bullet"][0].perfs["bullet"].rating, 3465);
        assert_eq!(data["blitz"][0].perfs["blitz"].rating, 3002);
    }

    #[test]
    fn test_parse_tv_channels_response() {
        let json = r#"{
            "Bullet": {"user": {"id": "player1"}, "rating": 3048, "gameId": "abc"},
            "Blitz": {"user": {"id": "player2"}, "rating": 2968, "gameId": "def"},
            "Best": {"user": {"id": "player3"}, "rating": 3048, "gameId": "ghi"}
        }"#;

        let data: TvChannelsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(data.len(), 3);
        assert_eq!(data["Bullet"].rating, Some(3048));
        assert_eq!(data["Blitz"].rating, Some(2968));
    }

    #[test]
    fn test_parse_tournament_response() {
        let json = r#"{
            "created": [{"id": "t1", "nbPlayers": 5}],
            "started": [
                {"id": "t2", "nbPlayers": 120},
                {"id": "t3", "nbPlayers": 45}
            ],
            "finished": [{"id": "t4", "nbPlayers": 200}]
        }"#;

        let data: TournamentResponse = serde_json::from_str(json).unwrap();
        assert_eq!(data.started.len(), 2);
        let total: i64 = data.started.iter().map(|t| t.nb_players).sum();
        assert_eq!(total, 165);
    }

}
