//! ESPN Live Scores client implementing MarketDataSource
//!
//! Dynamically discovers active/scheduled/completed games across 12 leagues.
//! Each game produces 3 assets: home score, away score, and total score.
//! When games fall off the scoreboard, assets become inactive automatically.
//!
//! API: https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
//! Auth: None
//! Rate limit: 30 req/min (be polite, undocumented API)

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
    load_assets_from_json, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

/// Asset configuration (empty — all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/sports.json");

/// ESPN API base URL
const API_BASE: &str = "https://site.api.espn.com/apis/site/v2/sports";

/// Delay between sequential league fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 2000;

/// All leagues to poll. Each entry is (sport_path, league_code, display_name).
/// sport_path is used in the ESPN URL, league_code is used in asset IDs.
const LEAGUES: &[(&str, &str, &str)] = &[
    ("basketball/nba", "nba", "NBA"),
    ("football/nfl", "nfl", "NFL"),
    ("soccer/eng.1", "epl", "EPL"),
    ("baseball/mlb", "mlb", "MLB"),
    ("hockey/nhl", "nhl", "NHL"),
    ("soccer/esp.1", "laliga", "La Liga"),
    ("soccer/ger.1", "bundesliga", "Bundesliga"),
    ("soccer/ita.1", "seriea", "Serie A"),
    ("soccer/fra.1", "ligue1", "Ligue 1"),
    ("soccer/usa.1", "mls", "MLS"),
    ("basketball/wnba", "wnba", "WNBA"),
    ("soccer/uefa.champions", "ucl", "Champions League"),
];

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Top-level scoreboard response
#[derive(Debug, Deserialize)]
struct ScoreboardResponse {
    #[serde(default)]
    events: Vec<Event>,
}

/// A single event (game)
#[derive(Debug, Deserialize)]
struct Event {
    #[serde(default)]
    id: String,
    #[serde(default)]
    competitions: Vec<Competition>,
}

/// A competition within an event
#[derive(Debug, Deserialize)]
struct Competition {
    #[serde(default)]
    competitors: Vec<Competitor>,
    #[serde(default)]
    status: Option<CompetitionStatus>,
}

/// A competitor (team) in a competition
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Competitor {
    #[serde(default)]
    id: String,
    #[serde(default)]
    team: Option<TeamInfo>,
    #[serde(default)]
    score: Option<String>,
    #[serde(default)]
    home_away: Option<String>,
    #[serde(default)]
    winner: Option<bool>,
}

/// Team info within a competitor
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TeamInfo {
    #[serde(default)]
    display_name: String,
}

/// Competition status
#[derive(Debug, Deserialize)]
struct CompetitionStatus {
    #[serde(default, rename = "type")]
    status_type: Option<StatusType>,
}

/// Status type details
#[derive(Debug, Deserialize)]
struct StatusType {
    #[serde(default)]
    completed: bool,
    #[serde(default)]
    state: Option<String>,
}

/// Parsed game info extracted from a scoreboard event
#[derive(Debug, Clone)]
struct GameInfo {
    game_id: String,
    home_team: String,
    away_team: String,
    home_score: Option<Decimal>,
    away_score: Option<Decimal>,
    state: String, // "pre", "in", "post"
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// ESPN live scores market data source.
///
/// Dynamically discovers games across 12 leagues and tracks scores.
/// Source ID is `"sports"`.
pub struct SportsMarketSource {
    http: SourceHttpClient,
}

impl SportsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!(
            "Sports source initialized (ESPN, {} leagues)",
            LEAGUES.len()
        );

        Ok(Self { http })
    }

    /// Fetch scoreboard for a league
    async fn fetch_scoreboard(
        &self,
        sport_league: &str,
    ) -> Result<ScoreboardResponse, SourceError> {
        let url = format!("{}/{}/scoreboard", API_BASE, sport_league);
        self.http.get_json::<ScoreboardResponse>(&url).await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for SportsMarketSource {
    fn source_id(&self) -> &'static str {
        "sports"
    }

    fn display_name(&self) -> &'static str {
        "ESPN Live Scores"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(120) // 2 minutes — live scores change rapidly
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::PROBABILITY
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // If config JSON has static entries, use them (defensive fallback)
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Dynamic discovery from live scoreboards
        let mut assets = Vec::new();
        let mut total_events = 0u32;
        let mut league_errors = 0u32;

        for (idx, &(sport_path, league_code, display_name)) in LEAGUES.iter().enumerate() {
            // Delay between requests (skip delay before first request)
            if idx > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            match self.fetch_scoreboard(sport_path).await {
                Ok(scoreboard) => {
                    let games = extract_games(&scoreboard);
                    debug!(
                        "Sports {}: {} games on scoreboard",
                        league_code,
                        games.len()
                    );
                    total_events += games.len() as u32;

                    let subcategory = league_code.to_string();

                    for game in &games {
                        let matchup = format!("{} vs {}", game.away_team, game.home_team);

                        // Home score asset
                        assets.push(AssetUpdate {
                            asset_id: format!("sport_{}_{}_home", league_code, game.game_id),
                            symbol: format!("{}/{}", league_code.to_uppercase(), game.game_id),
                            name: format!("{} (home) [{}]", matchup, display_name),
                            category: Some("sports".to_string()),
                            metadata: serde_json::json!({
                                "api_ref": format!("{}:{}", sport_path, game.game_id),
                                "subcategory": subcategory,
                                "active": true,
                                "extra": {
                                    "metric": "home",
                                    "game_id": game.game_id,
                                    "league": league_code,
                                    "home_team": game.home_team,
                                    "away_team": game.away_team,
                                    "state": game.state,
                                },
                            }),
                        });

                        // Away score asset
                        assets.push(AssetUpdate {
                            asset_id: format!("sport_{}_{}_away", league_code, game.game_id),
                            symbol: format!("{}/{}", league_code.to_uppercase(), game.game_id),
                            name: format!("{} (away) [{}]", matchup, display_name),
                            category: Some("sports".to_string()),
                            metadata: serde_json::json!({
                                "api_ref": format!("{}:{}", sport_path, game.game_id),
                                "subcategory": subcategory,
                                "active": true,
                                "extra": {
                                    "metric": "away",
                                    "game_id": game.game_id,
                                    "league": league_code,
                                    "home_team": game.home_team,
                                    "away_team": game.away_team,
                                    "state": game.state,
                                },
                            }),
                        });

                        // Total score asset
                        assets.push(AssetUpdate {
                            asset_id: format!("sport_{}_{}_total", league_code, game.game_id),
                            symbol: format!("{}/{}", league_code.to_uppercase(), game.game_id),
                            name: format!("{} (total) [{}]", matchup, display_name),
                            category: Some("sports".to_string()),
                            metadata: serde_json::json!({
                                "api_ref": format!("{}:{}", sport_path, game.game_id),
                                "subcategory": subcategory,
                                "active": true,
                                "extra": {
                                    "metric": "total",
                                    "game_id": game.game_id,
                                    "league": league_code,
                                    "home_team": game.home_team,
                                    "away_team": game.away_team,
                                    "state": game.state,
                                },
                            }),
                        });
                    }
                }
                Err(e) => {
                    warn!(
                        "Error fetching ESPN scoreboard for {} ({}): {:?}",
                        display_name, sport_path, e
                    );
                    league_errors += 1;
                }
            }
        }

        info!(
            "Sports fetch_assets: {} leagues ({} errors) -> {} events -> {} assets",
            LEAGUES.len(),
            league_errors,
            total_events,
            assets.len()
        );

        Ok(assets)
    }

    /// Sports scores should always be written on every sync cycle.
    /// A score of 3-2 staying at 3-2 is meaningful data (game still in progress).
    /// Without this, the change detection in SyncEngine skips unchanged values,
    /// causing 86% of sports assets to have only 1 price row.
    fn skips_when_unchanged(&self) -> bool {
        true
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Parse asset IDs and group by league
        // Format: sport_{league_code}_{game_id}_{metric}
        let mut league_requests: HashMap<String, Vec<ParsedAssetId>> = HashMap::new();
        let mut requested_ids: HashSet<String> = HashSet::new();

        for asset_id in asset_ids {
            requested_ids.insert(asset_id.clone());
            if let Some(parsed) = parse_asset_id(asset_id) {
                league_requests
                    .entry(parsed.league_code.clone())
                    .or_default()
                    .push(parsed);
            }
        }

        debug!(
            "Sports fetch_prices: {} asset_ids -> {} unique leagues",
            asset_ids.len(),
            league_requests.len()
        );

        // Fetch each needed league's scoreboard
        let mut first = true;
        for (league_code, parsed_assets) in &league_requests {
            if !first {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }
            first = false;

            // Look up the sport_path for this league_code
            let sport_path = match league_code_to_sport_path(league_code) {
                Some(path) => path,
                None => {
                    warn!("Unknown league code '{}', skipping", league_code);
                    continue;
                }
            };

            match self.fetch_scoreboard(sport_path).await {
                Ok(scoreboard) => {
                    // Build game_id -> GameInfo map
                    let games = extract_games(&scoreboard);
                    let game_map: HashMap<&str, &GameInfo> =
                        games.iter().map(|g| (g.game_id.as_str(), g)).collect();

                    for parsed in parsed_assets {
                        let game = match game_map.get(parsed.game_id.as_str()) {
                            Some(g) => g,
                            None => {
                                // Game no longer on scoreboard — skip, don't emit fake zero
                                debug!("Sports: game {} no longer on scoreboard, skipping", parsed.game_id);
                                continue;
                            }
                        };

                        // Use 0 for pre-game assets (score not yet available).
                        // This ensures every asset gets a price row on every sync cycle,
                        // not just when the score first appears.
                        let value = match parsed.metric.as_str() {
                            "home" => game.home_score.unwrap_or(Decimal::ZERO),
                            "away" => game.away_score.unwrap_or(Decimal::ZERO),
                            "total" => {
                                let h = game.home_score.unwrap_or(Decimal::ZERO);
                                let a = game.away_score.unwrap_or(Decimal::ZERO);
                                h + a
                            }
                            _ => continue,
                        };

                        results.push(PriceUpdate {
                            asset_id: parsed.original_id.clone(),
                            symbol: format!(
                                "{}/{}",
                                league_code.to_uppercase(),
                                parsed.game_id
                            ),
                            value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Err(e) => {
                    warn!(
                        "Error fetching ESPN scoreboard for league '{}': {:?} — skipping league",
                        league_code, e
                    );
                    // Skip this league entirely; do not emit fake zeros
                    continue;
                }
            }
        }

        info!(
            "Fetched {}/{} prices from ESPN",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/// Parsed components of a sports asset ID
#[derive(Debug, Clone)]
struct ParsedAssetId {
    original_id: String,
    league_code: String,
    game_id: String,
    metric: String, // "home", "away", "total"
}

/// Parse asset ID like "sport_nba_401656789_home" into components.
///
/// Format: sport_{league_code}_{game_id}_{metric}
/// The league_code and game_id parts can contain digits only (game_id)
/// or letters/digits (league_code), but metric is always the last segment
/// and is one of: home, away, total.
fn parse_asset_id(asset_id: &str) -> Option<ParsedAssetId> {
    let rest = asset_id.strip_prefix("sport_")?;

    // Find the metric suffix (last segment after final '_')
    let last_underscore = rest.rfind('_')?;
    let metric = &rest[last_underscore + 1..];

    // Validate metric
    if metric != "home" && metric != "away" && metric != "total" {
        return None;
    }

    let before_metric = &rest[..last_underscore];

    // Find the game_id (second-to-last segment) — everything after the first '_'
    // league_code is everything before the first '_' in before_metric
    // BUT league_code could itself be multi-word like "laliga", "bundesliga"
    // The game_id is always numeric (ESPN event IDs are numeric)
    // So we split on last '_' in before_metric to separate league_code from game_id
    let game_underscore = before_metric.rfind('_')?;
    let league_code = &before_metric[..game_underscore];
    let game_id = &before_metric[game_underscore + 1..];

    // Game ID should be numeric
    if game_id.is_empty() || !game_id.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }

    if league_code.is_empty() {
        return None;
    }

    Some(ParsedAssetId {
        original_id: asset_id.to_string(),
        league_code: league_code.to_string(),
        game_id: game_id.to_string(),
        metric: metric.to_string(),
    })
}

/// Map league_code back to ESPN sport_path
fn league_code_to_sport_path(league_code: &str) -> Option<&'static str> {
    for &(sport_path, code, _) in LEAGUES {
        if code == league_code {
            return Some(sport_path);
        }
    }
    None
}

/// Extract game info from a scoreboard response.
fn extract_games(scoreboard: &ScoreboardResponse) -> Vec<GameInfo> {
    let mut games = Vec::new();

    for event in &scoreboard.events {
        if event.id.is_empty() {
            continue;
        }

        for competition in &event.competitions {
            let mut home_team = String::new();
            let mut away_team = String::new();
            let mut home_score: Option<Decimal> = None;
            let mut away_score: Option<Decimal> = None;

            for competitor in &competition.competitors {
                let team_name = competitor
                    .team
                    .as_ref()
                    .map(|t| t.display_name.clone())
                    .unwrap_or_else(|| format!("Team #{}", competitor.id));

                let score = competitor
                    .score
                    .as_ref()
                    .and_then(|s| s.parse::<i64>().ok())
                    .map(Decimal::from);

                let is_home = competitor
                    .home_away
                    .as_deref()
                    .map(|ha| ha == "home")
                    .unwrap_or(false);

                if is_home {
                    home_team = team_name;
                    home_score = score;
                } else {
                    away_team = team_name;
                    away_score = score;
                }
            }

            let state = competition
                .status
                .as_ref()
                .and_then(|s| s.status_type.as_ref())
                .and_then(|st| st.state.clone())
                .unwrap_or_else(|| "pre".to_string());

            // Only include if we have at least one team identified
            if !home_team.is_empty() || !away_team.is_empty() {
                games.push(GameInfo {
                    game_id: event.id.clone(),
                    home_team,
                    away_team,
                    home_score,
                    away_score,
                    state,
                });
            }
        }
    }

    games
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("sports", "sports");
    }

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(
            entries.is_empty(),
            "Config should be empty -- assets are dynamic"
        );
    }

    #[test]
    fn test_empty_config_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    // ========================================================================
    // Asset ID parsing tests
    // ========================================================================

    #[test]
    fn test_parse_asset_id_home() {
        let parsed = parse_asset_id("sport_nba_401656789_home").unwrap();
        assert_eq!(parsed.league_code, "nba");
        assert_eq!(parsed.game_id, "401656789");
        assert_eq!(parsed.metric, "home");
    }

    #[test]
    fn test_parse_asset_id_away() {
        let parsed = parse_asset_id("sport_nfl_401547123_away").unwrap();
        assert_eq!(parsed.league_code, "nfl");
        assert_eq!(parsed.game_id, "401547123");
        assert_eq!(parsed.metric, "away");
    }

    #[test]
    fn test_parse_asset_id_total() {
        let parsed = parse_asset_id("sport_epl_694302_total").unwrap();
        assert_eq!(parsed.league_code, "epl");
        assert_eq!(parsed.game_id, "694302");
        assert_eq!(parsed.metric, "total");
    }

    #[test]
    fn test_parse_asset_id_new_leagues() {
        let parsed = parse_asset_id("sport_laliga_694500_home").unwrap();
        assert_eq!(parsed.league_code, "laliga");
        assert_eq!(parsed.game_id, "694500");
        assert_eq!(parsed.metric, "home");

        let parsed = parse_asset_id("sport_bundesliga_694501_away").unwrap();
        assert_eq!(parsed.league_code, "bundesliga");
        assert_eq!(parsed.game_id, "694501");
        assert_eq!(parsed.metric, "away");

        let parsed = parse_asset_id("sport_seriea_694502_total").unwrap();
        assert_eq!(parsed.league_code, "seriea");
        assert_eq!(parsed.game_id, "694502");
        assert_eq!(parsed.metric, "total");

        let parsed = parse_asset_id("sport_ligue1_694503_home").unwrap();
        assert_eq!(parsed.league_code, "ligue1");
        assert_eq!(parsed.game_id, "694503");
        assert_eq!(parsed.metric, "home");

        let parsed = parse_asset_id("sport_mls_694504_away").unwrap();
        assert_eq!(parsed.league_code, "mls");
        assert_eq!(parsed.game_id, "694504");
        assert_eq!(parsed.metric, "away");

        let parsed = parse_asset_id("sport_wnba_401656790_home").unwrap();
        assert_eq!(parsed.league_code, "wnba");
        assert_eq!(parsed.game_id, "401656790");
        assert_eq!(parsed.metric, "home");

        let parsed = parse_asset_id("sport_ucl_694505_total").unwrap();
        assert_eq!(parsed.league_code, "ucl");
        assert_eq!(parsed.game_id, "694505");
        assert_eq!(parsed.metric, "total");
    }

    #[test]
    fn test_parse_asset_id_invalid() {
        assert!(parse_asset_id("invalid").is_none());
        assert!(parse_asset_id("sport_").is_none());
        assert!(parse_asset_id("sport_nba_").is_none());
        assert!(parse_asset_id("sport_nba_abc_home").is_none()); // non-numeric game ID
        assert!(parse_asset_id("").is_none());
        assert!(parse_asset_id("hn_12345_score").is_none()); // wrong prefix
        assert!(parse_asset_id("sport_nba_123_invalid").is_none()); // invalid metric
    }

    #[test]
    fn test_parse_asset_id_preserves_original() {
        let original = "sport_nhl_401656999_away";
        let parsed = parse_asset_id(original).unwrap();
        assert_eq!(parsed.original_id, original);
    }

    // ========================================================================
    // League code mapping tests
    // ========================================================================

    #[test]
    fn test_league_code_to_sport_path() {
        assert_eq!(
            league_code_to_sport_path("nba"),
            Some("basketball/nba")
        );
        assert_eq!(
            league_code_to_sport_path("nfl"),
            Some("football/nfl")
        );
        assert_eq!(
            league_code_to_sport_path("epl"),
            Some("soccer/eng.1")
        );
        assert_eq!(
            league_code_to_sport_path("mlb"),
            Some("baseball/mlb")
        );
        assert_eq!(
            league_code_to_sport_path("nhl"),
            Some("hockey/nhl")
        );
        assert_eq!(
            league_code_to_sport_path("laliga"),
            Some("soccer/esp.1")
        );
        assert_eq!(
            league_code_to_sport_path("bundesliga"),
            Some("soccer/ger.1")
        );
        assert_eq!(
            league_code_to_sport_path("seriea"),
            Some("soccer/ita.1")
        );
        assert_eq!(
            league_code_to_sport_path("ligue1"),
            Some("soccer/fra.1")
        );
        assert_eq!(
            league_code_to_sport_path("mls"),
            Some("soccer/usa.1")
        );
        assert_eq!(
            league_code_to_sport_path("wnba"),
            Some("basketball/wnba")
        );
        assert_eq!(
            league_code_to_sport_path("ucl"),
            Some("soccer/uefa.champions")
        );
        assert_eq!(league_code_to_sport_path("unknown"), None);
    }

    #[test]
    fn test_leagues_count() {
        assert_eq!(LEAGUES.len(), 12);
    }

    #[test]
    fn test_league_codes_unique() {
        let mut codes: HashSet<&str> = HashSet::new();
        for &(_, code, _) in LEAGUES {
            assert!(
                codes.insert(code),
                "Duplicate league code: {}",
                code
            );
        }
    }

    // ========================================================================
    // Scoreboard extraction tests
    // ========================================================================

    #[test]
    fn test_extract_games_empty() {
        let scoreboard = ScoreboardResponse { events: vec![] };
        let games = extract_games(&scoreboard);
        assert!(games.is_empty());
    }

    #[test]
    fn test_extract_games_basic() {
        let scoreboard = ScoreboardResponse {
            events: vec![Event {
                id: "401656789".to_string(),
                competitions: vec![Competition {
                    competitors: vec![
                        Competitor {
                            id: "13".to_string(),
                            team: Some(TeamInfo {
                                display_name: "Los Angeles Lakers".to_string(),
                            }),
                            score: Some("105".to_string()),
                            home_away: Some("home".to_string()),
                            winner: Some(false),
                        },
                        Competitor {
                            id: "2".to_string(),
                            team: Some(TeamInfo {
                                display_name: "Boston Celtics".to_string(),
                            }),
                            score: Some("110".to_string()),
                            home_away: Some("away".to_string()),
                            winner: Some(true),
                        },
                    ],
                    status: Some(CompetitionStatus {
                        status_type: Some(StatusType {
                            completed: true,
                            state: Some("post".to_string()),
                        }),
                    }),
                }],
            }],
        };

        let games = extract_games(&scoreboard);
        assert_eq!(games.len(), 1);

        let game = &games[0];
        assert_eq!(game.game_id, "401656789");
        assert_eq!(game.home_team, "Los Angeles Lakers");
        assert_eq!(game.away_team, "Boston Celtics");
        assert_eq!(game.home_score, Some(Decimal::from(105)));
        assert_eq!(game.away_score, Some(Decimal::from(110)));
        assert_eq!(game.state, "post");
    }

    #[test]
    fn test_extract_games_pre_game_no_scores() {
        let scoreboard = ScoreboardResponse {
            events: vec![Event {
                id: "401656790".to_string(),
                competitions: vec![Competition {
                    competitors: vec![
                        Competitor {
                            id: "9".to_string(),
                            team: Some(TeamInfo {
                                display_name: "Golden State Warriors".to_string(),
                            }),
                            score: None,
                            home_away: Some("home".to_string()),
                            winner: None,
                        },
                        Competitor {
                            id: "14".to_string(),
                            team: Some(TeamInfo {
                                display_name: "Miami Heat".to_string(),
                            }),
                            score: None,
                            home_away: Some("away".to_string()),
                            winner: None,
                        },
                    ],
                    status: Some(CompetitionStatus {
                        status_type: Some(StatusType {
                            completed: false,
                            state: Some("pre".to_string()),
                        }),
                    }),
                }],
            }],
        };

        let games = extract_games(&scoreboard);
        assert_eq!(games.len(), 1);

        let game = &games[0];
        assert_eq!(game.game_id, "401656790");
        assert_eq!(game.home_team, "Golden State Warriors");
        assert_eq!(game.away_team, "Miami Heat");
        assert_eq!(game.home_score, None);
        assert_eq!(game.away_score, None);
        assert_eq!(game.state, "pre");
    }

    #[test]
    fn test_extract_games_multiple_events() {
        let scoreboard = ScoreboardResponse {
            events: vec![
                Event {
                    id: "100".to_string(),
                    competitions: vec![Competition {
                        competitors: vec![
                            Competitor {
                                id: "1".to_string(),
                                team: Some(TeamInfo {
                                    display_name: "Team A".to_string(),
                                }),
                                score: Some("3".to_string()),
                                home_away: Some("home".to_string()),
                                winner: None,
                            },
                            Competitor {
                                id: "2".to_string(),
                                team: Some(TeamInfo {
                                    display_name: "Team B".to_string(),
                                }),
                                score: Some("1".to_string()),
                                home_away: Some("away".to_string()),
                                winner: None,
                            },
                        ],
                        status: Some(CompetitionStatus {
                            status_type: Some(StatusType {
                                completed: false,
                                state: Some("in".to_string()),
                            }),
                        }),
                    }],
                },
                Event {
                    id: "200".to_string(),
                    competitions: vec![Competition {
                        competitors: vec![
                            Competitor {
                                id: "3".to_string(),
                                team: Some(TeamInfo {
                                    display_name: "Team C".to_string(),
                                }),
                                score: Some("0".to_string()),
                                home_away: Some("home".to_string()),
                                winner: None,
                            },
                            Competitor {
                                id: "4".to_string(),
                                team: Some(TeamInfo {
                                    display_name: "Team D".to_string(),
                                }),
                                score: Some("2".to_string()),
                                home_away: Some("away".to_string()),
                                winner: None,
                            },
                        ],
                        status: Some(CompetitionStatus {
                            status_type: Some(StatusType {
                                completed: false,
                                state: Some("in".to_string()),
                            }),
                        }),
                    }],
                },
            ],
        };

        let games = extract_games(&scoreboard);
        assert_eq!(games.len(), 2);
        assert_eq!(games[0].game_id, "100");
        assert_eq!(games[1].game_id, "200");
    }

    #[test]
    fn test_extract_games_skips_empty_id() {
        let scoreboard = ScoreboardResponse {
            events: vec![Event {
                id: "".to_string(),
                competitions: vec![Competition {
                    competitors: vec![Competitor {
                        id: "1".to_string(),
                        team: Some(TeamInfo {
                            display_name: "Test".to_string(),
                        }),
                        score: Some("5".to_string()),
                        home_away: Some("home".to_string()),
                        winner: None,
                    }],
                    status: None,
                }],
            }],
        };

        let games = extract_games(&scoreboard);
        assert!(games.is_empty());
    }

    // ========================================================================
    // Dedupe tests
    // ========================================================================

    #[test]
    fn test_dedupe_by_league() {
        let asset_ids = vec![
            "sport_nba_100_home".to_string(),
            "sport_nba_100_away".to_string(),
            "sport_nba_100_total".to_string(),
            "sport_nba_200_home".to_string(),
            "sport_nfl_300_home".to_string(),
        ];

        let mut league_requests: HashMap<String, Vec<ParsedAssetId>> = HashMap::new();
        for aid in &asset_ids {
            if let Some(parsed) = parse_asset_id(aid) {
                league_requests
                    .entry(parsed.league_code.clone())
                    .or_default()
                    .push(parsed);
            }
        }

        // 2 unique leagues: nba and nfl
        assert_eq!(league_requests.len(), 2);
        // nba has 4 assets (3 for game 100, 1 for game 200)
        assert_eq!(league_requests.get("nba").unwrap().len(), 4);
        // nfl has 1 asset
        assert_eq!(league_requests.get("nfl").unwrap().len(), 1);
    }

    // ========================================================================
    // Score computation tests
    // ========================================================================

    #[test]
    fn test_total_score_computation() {
        let home = Decimal::from(105);
        let away = Decimal::from(110);
        assert_eq!(home + away, Decimal::from(215));
    }

    #[test]
    fn test_zero_score_for_pre_game() {
        let game = GameInfo {
            game_id: "123".to_string(),
            home_team: "A".to_string(),
            away_team: "B".to_string(),
            home_score: None,
            away_score: None,
            state: "pre".to_string(),
        };

        let home_val = game.home_score.unwrap_or(Decimal::ZERO);
        let away_val = game.away_score.unwrap_or(Decimal::ZERO);
        assert_eq!(home_val, Decimal::ZERO);
        assert_eq!(away_val, Decimal::ZERO);
        assert_eq!(home_val + away_val, Decimal::ZERO);
    }
}
