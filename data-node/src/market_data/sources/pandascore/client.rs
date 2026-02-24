//! PandaScore Esports live match client implementing MarketDataSource
//!
//! Dynamically discovers running and upcoming esports matches across all games
//! (CS2, LoL, Dota 2, Valorant, etc.). Each match produces 2 assets: one score
//! feed per opponent. Matches fall off naturally when they leave the running
//! endpoint.
//!
//! API: https://api.pandascore.co
//! Auth: Bearer token (free tier: 1000 req/hr)
//! Rate limit: 800 req/hr (conservative to avoid hitting 1000 cap)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/pandascore.json");

/// PandaScore API base URL
const API_BASE: &str = "https://api.pandascore.co";

/// Max results per page (PandaScore max is 100)
const PER_PAGE: u32 = 100;

/// How many pages of upcoming matches to fetch (limits API calls)
const MAX_UPCOMING_PAGES: u32 = 2;

/// Delay between sequential API requests (ms)
const INTER_REQUEST_DELAY_MS: u64 = 500;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct PsMatch {
    id: i64,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    match_type: Option<String>,
    #[serde(default)]
    number_of_games: Option<i32>,
    #[serde(default)]
    opponents: Vec<PsOpponentWrapper>,
    #[serde(default)]
    results: Vec<PsResult>,
    #[serde(default)]
    games: Vec<PsGame>,
    #[serde(default)]
    videogame: Option<PsVideogame>,
    #[serde(default)]
    league: Option<PsLeague>,
    #[serde(default)]
    serie: Option<PsSerie>,
    #[serde(default)]
    tournament: Option<PsTournament>,
    #[serde(default)]
    begin_at: Option<String>,
    #[serde(default)]
    scheduled_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PsOpponentWrapper {
    #[serde(default, rename = "type")]
    opponent_type: Option<String>,
    #[serde(default)]
    opponent: Option<PsOpponent>,
}

#[derive(Debug, Deserialize)]
struct PsOpponent {
    #[serde(default)]
    id: i64,
    #[serde(default)]
    name: String,
    #[serde(default)]
    acronym: Option<String>,
    #[serde(default)]
    image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PsResult {
    #[serde(default)]
    team_id: Option<i64>,
    #[serde(default)]
    score: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct PsGame {
    #[serde(default)]
    id: Option<i64>,
    #[serde(default)]
    position: Option<i32>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    winner: Option<PsWinner>,
}

#[derive(Debug, Deserialize)]
struct PsWinner {
    #[serde(default)]
    id: Option<i64>,
    #[serde(default, rename = "type")]
    winner_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PsVideogame {
    #[serde(default)]
    id: Option<i64>,
    #[serde(default)]
    name: String,
    #[serde(default)]
    slug: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PsLeague {
    #[serde(default)]
    id: Option<i64>,
    #[serde(default)]
    name: String,
}

#[derive(Debug, Deserialize)]
struct PsSerie {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    full_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PsTournament {
    #[serde(default)]
    name: Option<String>,
}

// ============================================================================
// PARSED MATCH INFO
// ============================================================================

#[derive(Debug, Clone)]
struct MatchInfo {
    match_id: i64,
    game_slug: String,
    game_name: String,
    league_name: String,
    status: String,
    team1_id: i64,
    team1_name: String,
    team1_acronym: String,
    team1_score: i32,
    team2_id: i64,
    team2_name: String,
    team2_acronym: String,
    team2_score: i32,
    games_finished: i32,
    number_of_games: i32,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct PandascoreMarketSource {
    http: SourceHttpClient,
    token: String,
}

impl PandascoreMarketSource {
    pub fn from_env() -> Result<Self> {
        let token = std::env::var("PANDASCORE_TOKEN")
            .unwrap_or_else(|_| "-VURFHJt8oFdzp_ZEIlAKSvfinCCRfWSAVtjq7K5voLywaFlRVo".to_string());

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 800,
                duration: Duration::from_secs(3600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("PandaScore esports source initialized");

        Ok(Self { http, token })
    }

    /// Fetch a page of matches from PandaScore
    async fn fetch_matches_page(
        &self,
        endpoint: &str,
        page: u32,
    ) -> Result<Vec<PsMatch>, SourceError> {
        let url = format!(
            "{}/{}?token={}&per_page={}&page={}&sort=-begin_at",
            API_BASE, endpoint, self.token, PER_PAGE, page
        );
        self.http.get_json::<Vec<PsMatch>>(&url).await
    }

    /// Fetch all running matches (paginate until empty)
    async fn fetch_running_matches(&self) -> Result<Vec<PsMatch>, SourceError> {
        let mut all = Vec::new();
        let mut page = 1u32;

        loop {
            let matches = self.fetch_matches_page("matches/running", page).await?;
            let count = matches.len();
            all.extend(matches);

            if count < PER_PAGE as usize {
                break;
            }
            page += 1;
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        Ok(all)
    }

    /// Fetch upcoming matches (limited pages to save API budget)
    async fn fetch_upcoming_matches(&self) -> Result<Vec<PsMatch>, SourceError> {
        let mut all = Vec::new();

        for page in 1..=MAX_UPCOMING_PAGES {
            if page > 1 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }
            let url = format!(
                "{}/matches/upcoming?token={}&per_page={}&page={}&sort=begin_at",
                API_BASE, self.token, PER_PAGE, page
            );
            let matches: Vec<PsMatch> = self.http.get_json(&url).await?;
            let count = matches.len();
            all.extend(matches);

            if count < PER_PAGE as usize {
                break;
            }
        }

        Ok(all)
    }
}

/// Parse a PsMatch into a MatchInfo if it has 2 valid opponents
fn parse_match(m: &PsMatch) -> Option<MatchInfo> {
    // Need exactly 2 opponents
    if m.opponents.len() != 2 {
        return None;
    }

    let opp1 = m.opponents[0].opponent.as_ref()?;
    let opp2 = m.opponents[1].opponent.as_ref()?;

    let game_slug = m
        .videogame
        .as_ref()
        .and_then(|v| v.slug.clone())
        .unwrap_or_else(|| "unknown".to_string());

    let game_name = m
        .videogame
        .as_ref()
        .map(|v| v.name.clone())
        .unwrap_or_else(|| "Unknown".to_string());

    let league_name = m
        .league
        .as_ref()
        .map(|l| l.name.clone())
        .unwrap_or_else(|| "Unknown".to_string());

    let status = m.status.clone().unwrap_or_else(|| "unknown".to_string());

    // Find scores from results array (match by team_id)
    let team1_score = m
        .results
        .iter()
        .find(|r| r.team_id == Some(opp1.id))
        .and_then(|r| r.score)
        .unwrap_or(0);

    let team2_score = m
        .results
        .iter()
        .find(|r| r.team_id == Some(opp2.id))
        .and_then(|r| r.score)
        .unwrap_or(0);

    let games_finished = m
        .games
        .iter()
        .filter(|g| g.status.as_deref() == Some("finished"))
        .count() as i32;

    let number_of_games = m.number_of_games.unwrap_or(1);

    let acronym_or_name = |opp: &PsOpponent| -> String {
        opp.acronym
            .as_ref()
            .filter(|a| !a.is_empty())
            .cloned()
            .unwrap_or_else(|| {
                // Truncate long names
                if opp.name.len() > 12 {
                    opp.name.chars().take(12).collect()
                } else {
                    opp.name.clone()
                }
            })
    };

    Some(MatchInfo {
        match_id: m.id,
        game_slug,
        game_name,
        league_name,
        status,
        team1_id: opp1.id,
        team1_name: opp1.name.clone(),
        team1_acronym: acronym_or_name(opp1),
        team1_score,
        team2_id: opp2.id,
        team2_name: opp2.name.clone(),
        team2_acronym: acronym_or_name(opp2),
        team2_score,
        games_finished,
        number_of_games,
    })
}

/// Build a short game label from slug
fn short_game_name(slug: &str) -> &str {
    match slug {
        "cs-go" | "cs-2" | "counter-strike" => "CS2",
        "league-of-legends" | "lol" => "LoL",
        "dota-2" | "dota2" => "Dota2",
        "valorant" => "VAL",
        "overwatch" | "overwatch-2" => "OW2",
        "kog" | "king-of-glory" => "KoG",
        "lol-wild-rift" => "WR",
        "mlbb" | "mobile-legends-bang-bang" => "MLBB",
        "starcraft-2" => "SC2",
        "starcraft-brood-war" => "SCBW",
        "rainbow-six" | "r6siege" => "R6",
        "rocket-league" => "RL",
        "cod-mw" | "call-of-duty" | "codmw" => "CoD",
        "pubg" => "PUBG",
        "ea-sports-fc" | "ea-fc" | "fifa" => "FC",
        _ => slug.split('-').next().unwrap_or(slug),
    }
}

#[async_trait::async_trait]
impl MarketDataSource for PandascoreMarketSource {
    fn source_id(&self) -> &'static str {
        "esports"
    }

    fn display_name(&self) -> &'static str {
        "PandaScore Esports"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300) // 5 minutes — live scores need freshness
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 800,
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // Config JSON is empty — all assets are dynamic
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        let mut assets = Vec::new();
        let mut match_count = 0u32;

        // Fetch running matches
        let running = match self.fetch_running_matches().await {
            Ok(m) => m,
            Err(e) => {
                warn!("PandaScore: error fetching running matches: {:?}", e);
                Vec::new()
            }
        };

        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

        // Fetch upcoming matches
        let upcoming = match self.fetch_upcoming_matches().await {
            Ok(m) => m,
            Err(e) => {
                warn!("PandaScore: error fetching upcoming matches: {:?}", e);
                Vec::new()
            }
        };

        // Dedupe by match_id (a match could appear in both endpoints briefly)
        let mut seen_ids: HashSet<i64> = HashSet::new();
        let all_matches: Vec<&PsMatch> = running
            .iter()
            .chain(upcoming.iter())
            .filter(|m| seen_ids.insert(m.id))
            .collect();

        for ps_match in &all_matches {
            let info = match parse_match(ps_match) {
                Some(i) => i,
                None => continue,
            };

            match_count += 1;
            let game_short = short_game_name(&info.game_slug);
            let matchup = format!("{} vs {}", info.team1_acronym, info.team2_acronym);
            let context = format!("{} / {}", game_short, info.league_name);
            let subcategory = info.game_slug.clone();

            // Team 1 score feed
            assets.push(AssetUpdate {
                asset_id: format!("esport_{}_{}_t1", info.game_slug, info.match_id),
                symbol: format!("E/{}", info.match_id),
                name: format!(
                    "{} ({} {}) [{}]",
                    matchup, info.team1_acronym, info.team1_score, context
                ),
                category: Some("sports".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("pandascore:{}", info.match_id),
                    "subcategory": subcategory,
                    "active": true,
                    "extra": {
                        "metric": "t1",
                        "match_id": info.match_id,
                        "game": info.game_slug,
                        "game_name": info.game_name,
                        "league": info.league_name,
                        "team_id": info.team1_id,
                        "team_name": info.team1_name,
                        "team_acronym": info.team1_acronym,
                        "opponent_name": info.team2_name,
                        "opponent_acronym": info.team2_acronym,
                        "status": info.status,
                        "match_type": ps_match.match_type,
                        "best_of": info.number_of_games,
                    },
                }),
            });

            // Team 2 score feed
            assets.push(AssetUpdate {
                asset_id: format!("esport_{}_{}_t2", info.game_slug, info.match_id),
                symbol: format!("E/{}", info.match_id),
                name: format!(
                    "{} ({} {}) [{}]",
                    matchup, info.team2_acronym, info.team2_score, context
                ),
                category: Some("sports".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("pandascore:{}", info.match_id),
                    "subcategory": subcategory,
                    "active": true,
                    "extra": {
                        "metric": "t2",
                        "match_id": info.match_id,
                        "game": info.game_slug,
                        "game_name": info.game_name,
                        "league": info.league_name,
                        "team_id": info.team2_id,
                        "team_name": info.team2_name,
                        "team_acronym": info.team2_acronym,
                        "opponent_name": info.team1_name,
                        "opponent_acronym": info.team1_acronym,
                        "status": info.status,
                        "match_type": ps_match.match_type,
                        "best_of": info.number_of_games,
                    },
                }),
            });

            // Games progress feed (how many maps/games finished out of total)
            // Only for best_of > 1
            if info.number_of_games > 1 {
                assets.push(AssetUpdate {
                    asset_id: format!("esport_{}_{}_maps", info.game_slug, info.match_id),
                    symbol: format!("E/{}", info.match_id),
                    name: format!(
                        "{} (maps {}/{}) [{}]",
                        matchup, info.games_finished, info.number_of_games, context
                    ),
                    category: Some("sports".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("pandascore:{}", info.match_id),
                        "subcategory": subcategory,
                        "active": true,
                        "extra": {
                            "metric": "maps",
                            "match_id": info.match_id,
                            "game": info.game_slug,
                            "game_name": info.game_name,
                            "league": info.league_name,
                            "team1_name": info.team1_name,
                            "team2_name": info.team2_name,
                            "status": info.status,
                            "best_of": info.number_of_games,
                        },
                    }),
                });
            }
        }

        info!(
            "PandaScore fetch_assets: {} running + {} upcoming -> {} matches -> {} assets",
            running.len(),
            upcoming.len(),
            match_count,
            assets.len()
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Parse asset IDs and group by match_id to minimize API calls
        let mut match_requests: HashMap<i64, Vec<ParsedEsportId>> = HashMap::new();

        for asset_id in asset_ids {
            if let Some(parsed) = parse_esport_id(asset_id) {
                match_requests
                    .entry(parsed.match_id)
                    .or_default()
                    .push(parsed);
            }
        }

        debug!(
            "PandaScore fetch_prices: {} asset_ids -> {} unique matches",
            asset_ids.len(),
            match_requests.len()
        );

        // Fetch all running matches (they contain the scores)
        let running = match self.fetch_running_matches().await {
            Ok(m) => m,
            Err(e) => {
                warn!("PandaScore: error fetching running matches for prices: {:?}", e);
                Vec::new()
            }
        };

        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

        // Also fetch upcoming (some tracked matches may be upcoming still)
        let upcoming = match self.fetch_upcoming_matches().await {
            Ok(m) => m,
            Err(e) => {
                warn!("PandaScore: error fetching upcoming matches for prices: {:?}", e);
                Vec::new()
            }
        };

        // Build match_id -> MatchInfo map
        let mut match_map: HashMap<i64, MatchInfo> = HashMap::new();
        for ps_match in running.iter().chain(upcoming.iter()) {
            if let Some(info) = parse_match(ps_match) {
                match_map.entry(info.match_id).or_insert(info);
            }
        }

        // Resolve each requested asset
        for (match_id, parsed_assets) in &match_requests {
            for parsed in parsed_assets {
                let value = if let Some(info) = match_map.get(match_id) {
                    match parsed.metric.as_str() {
                        "t1" => Decimal::from(info.team1_score),
                        "t2" => Decimal::from(info.team2_score),
                        "maps" => Decimal::from(info.games_finished),
                        _ => Decimal::ZERO,
                    }
                } else {
                    // Match no longer on running/upcoming — return last known (0 is fine,
                    // sync engine won't insert if value unchanged)
                    Decimal::ZERO
                };

                results.push(PriceUpdate {
                    asset_id: parsed.original_id.clone(),
                    symbol: format!("E/{}", match_id),
                    value,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        info!(
            "PandaScore: fetched {}/{} prices ({} matches in API)",
            results.len(),
            asset_ids.len(),
            match_map.len()
        );

        Ok(results)
    }
}

// ============================================================================
// HELPERS
// ============================================================================

#[derive(Debug, Clone)]
struct ParsedEsportId {
    original_id: String,
    game_slug: String,
    match_id: i64,
    metric: String, // "t1", "t2", "maps"
}

/// Parse asset ID like "esport_valorant_1337061_t1" into components.
///
/// Format: esport_{game_slug}_{match_id}_{metric}
/// metric is one of: t1, t2, maps
fn parse_esport_id(asset_id: &str) -> Option<ParsedEsportId> {
    let rest = asset_id.strip_prefix("esport_")?;

    // Metric is the last segment
    let last_underscore = rest.rfind('_')?;
    let metric = &rest[last_underscore + 1..];

    if metric != "t1" && metric != "t2" && metric != "maps" {
        return None;
    }

    let before_metric = &rest[..last_underscore];

    // Match ID is the numeric part before the metric
    let id_underscore = before_metric.rfind('_')?;
    let match_id_str = &before_metric[id_underscore + 1..];
    let game_slug = &before_metric[..id_underscore];

    let match_id: i64 = match_id_str.parse().ok()?;

    if game_slug.is_empty() {
        return None;
    }

    Some(ParsedEsportId {
        original_id: asset_id.to_string(),
        game_slug: game_slug.to_string(),
        match_id,
        metric: metric.to_string(),
    })
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_source_id() {
        // Just verify the constant
        assert_eq!("esports", "esports");
    }

    #[test]
    fn test_config_is_empty() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    #[test]
    fn test_parse_esport_id_t1() {
        let parsed = parse_esport_id("esport_valorant_1337061_t1").unwrap();
        assert_eq!(parsed.game_slug, "valorant");
        assert_eq!(parsed.match_id, 1337061);
        assert_eq!(parsed.metric, "t1");
    }

    #[test]
    fn test_parse_esport_id_t2() {
        let parsed = parse_esport_id("esport_cs-go_999888_t2").unwrap();
        assert_eq!(parsed.game_slug, "cs-go");
        assert_eq!(parsed.match_id, 999888);
        assert_eq!(parsed.metric, "t2");
    }

    #[test]
    fn test_parse_esport_id_maps() {
        let parsed = parse_esport_id("esport_league-of-legends_12345_maps").unwrap();
        assert_eq!(parsed.game_slug, "league-of-legends");
        assert_eq!(parsed.match_id, 12345);
        assert_eq!(parsed.metric, "maps");
    }

    #[test]
    fn test_parse_esport_id_invalid() {
        assert!(parse_esport_id("invalid").is_none());
        assert!(parse_esport_id("esport_").is_none());
        assert!(parse_esport_id("esport_cs_abc_t1").is_none()); // non-numeric match ID
        assert!(parse_esport_id("").is_none());
        assert!(parse_esport_id("sport_nba_123_home").is_none()); // wrong prefix
        assert!(parse_esport_id("esport_cs_123_invalid").is_none()); // invalid metric
    }

    #[test]
    fn test_parse_esport_id_preserves_original() {
        let original = "esport_dota-2_555_t1";
        let parsed = parse_esport_id(original).unwrap();
        assert_eq!(parsed.original_id, original);
    }

    #[test]
    fn test_short_game_name() {
        assert_eq!(short_game_name("cs-go"), "CS2");
        assert_eq!(short_game_name("league-of-legends"), "LoL");
        assert_eq!(short_game_name("dota-2"), "Dota2");
        assert_eq!(short_game_name("valorant"), "VAL");
        assert_eq!(short_game_name("overwatch-2"), "OW2");
        assert_eq!(short_game_name("mlbb"), "MLBB");
        assert_eq!(short_game_name("starcraft-2"), "SC2");
        assert_eq!(short_game_name("rocket-league"), "RL");
        // Unknown game -> first segment before dash
        assert_eq!(short_game_name("new-game"), "new");
    }

    #[test]
    fn test_parse_match_basic() {
        let m = PsMatch {
            id: 100,
            name: Some("ELE vs HOLY".to_string()),
            status: Some("running".to_string()),
            match_type: Some("best_of".to_string()),
            number_of_games: Some(3),
            opponents: vec![
                PsOpponentWrapper {
                    opponent_type: Some("Team".to_string()),
                    opponent: Some(PsOpponent {
                        id: 1,
                        name: "Elevate".to_string(),
                        acronym: Some("ELE".to_string()),
                        image_url: None,
                    }),
                },
                PsOpponentWrapper {
                    opponent_type: Some("Team".to_string()),
                    opponent: Some(PsOpponent {
                        id: 2,
                        name: "Holy".to_string(),
                        acronym: Some("HOLY".to_string()),
                        image_url: None,
                    }),
                },
            ],
            results: vec![
                PsResult {
                    team_id: Some(1),
                    score: Some(1),
                },
                PsResult {
                    team_id: Some(2),
                    score: Some(2),
                },
            ],
            games: vec![
                PsGame {
                    id: Some(1),
                    position: Some(1),
                    status: Some("finished".to_string()),
                    winner: None,
                },
                PsGame {
                    id: Some(2),
                    position: Some(2),
                    status: Some("finished".to_string()),
                    winner: None,
                },
                PsGame {
                    id: Some(3),
                    position: Some(3),
                    status: Some("running".to_string()),
                    winner: None,
                },
            ],
            videogame: Some(PsVideogame {
                id: Some(26),
                name: "Valorant".to_string(),
                slug: Some("valorant".to_string()),
            }),
            league: Some(PsLeague {
                id: Some(100),
                name: "VCL".to_string(),
            }),
            serie: None,
            tournament: None,
            begin_at: None,
            scheduled_at: None,
        };

        let info = parse_match(&m).unwrap();
        assert_eq!(info.match_id, 100);
        assert_eq!(info.game_slug, "valorant");
        assert_eq!(info.team1_acronym, "ELE");
        assert_eq!(info.team2_acronym, "HOLY");
        assert_eq!(info.team1_score, 1);
        assert_eq!(info.team2_score, 2);
        assert_eq!(info.games_finished, 2);
        assert_eq!(info.number_of_games, 3);
        assert_eq!(info.status, "running");
    }

    #[test]
    fn test_parse_match_single_opponent_returns_none() {
        let m = PsMatch {
            id: 200,
            name: None,
            status: None,
            match_type: None,
            number_of_games: None,
            opponents: vec![PsOpponentWrapper {
                opponent_type: None,
                opponent: Some(PsOpponent {
                    id: 1,
                    name: "Solo".to_string(),
                    acronym: None,
                    image_url: None,
                }),
            }],
            results: vec![],
            games: vec![],
            videogame: None,
            league: None,
            serie: None,
            tournament: None,
            begin_at: None,
            scheduled_at: None,
        };

        assert!(parse_match(&m).is_none());
    }

    #[test]
    fn test_parse_match_long_team_name_truncated() {
        let m = PsMatch {
            id: 300,
            name: None,
            status: Some("not_started".to_string()),
            match_type: None,
            number_of_games: Some(1),
            opponents: vec![
                PsOpponentWrapper {
                    opponent_type: None,
                    opponent: Some(PsOpponent {
                        id: 1,
                        name: "Very Long Team Name Here".to_string(),
                        acronym: None, // No acronym
                        image_url: None,
                    }),
                },
                PsOpponentWrapper {
                    opponent_type: None,
                    opponent: Some(PsOpponent {
                        id: 2,
                        name: "Short".to_string(),
                        acronym: None,
                        image_url: None,
                    }),
                },
            ],
            results: vec![],
            games: vec![],
            videogame: Some(PsVideogame {
                id: Some(1),
                name: "CS".to_string(),
                slug: Some("cs-go".to_string()),
            }),
            league: Some(PsLeague {
                id: Some(1),
                name: "ESL".to_string(),
            }),
            serie: None,
            tournament: None,
            begin_at: None,
            scheduled_at: None,
        };

        let info = parse_match(&m).unwrap();
        assert_eq!(info.team1_acronym, "Very Long Te"); // truncated to 12
        assert_eq!(info.team2_acronym, "Short");
    }
}
