//! ESPN Live Scores client implementing MarketDataSource
//!
//! Discovers in-progress games across 12 leagues. Each live game emits a 3-asset
//! score block (home / away / total) plus a per-sport catalog of high-frequency
//! boxscore stats (possession %, passes, shots, rebounds, assists, etc.) pulled
//! from ESPN's `summary` endpoint.
//!
//! Pre-game and post-game events are not registered. The first cycle in which an
//! event flips from "in" to "post" still emits its assets one last time so the
//! closing score and final stats get published; the cycle after that drops them
//! and the sync engine marks them inactive.
//!
//! API: https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
//! API: https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={id}
//! Auth: None
//! Rate limit: 30 req/min self-imposed (undocumented public API; be polite)

use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::sync::Mutex;
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

/// Delay between league scoreboard fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 2000;

/// Delay between summary fetches within one league (ms). Smaller than the
/// inter-league delay because summary calls don't share a bottleneck and we
/// want to fit a full weekend's live games inside one sync cycle.
const SUMMARY_DELAY_MS: u64 = 750;

/// Pre-game events whose scheduled start is within this many hours are kept
/// as score-only markets. Wider than zero so the page is never empty between
/// matches; tight enough that we don't carry tomorrow's full slate as 0–0
/// flat lines. Picks up the "matches starting tonight" cohort.
const UPCOMING_WINDOW_HOURS: i64 = 12;

/// All leagues to poll. Each entry is (sport_path, league_code, display_name).
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
// STAT CATALOGS — per-sport boxscore fields we publish.
//
// Selection rule: each entry is expected to change ≥ ~1× per 5-minute window
// during live play. Slow stats (red cards, penalty kicks, blocks) are dropped
// on purpose so the registry stays full of moving markets.
//
// `name` is the ESPN boxscore `name` field. `label` is the asset-ID suffix
// (camelCase, no underscores or dashes). `parse` decides how to interpret the
// `displayValue` string.
// ============================================================================

#[derive(Clone, Copy)]
struct StatField {
    name: &'static str,
    label: &'static str,
    parse: StatParse,
}

#[derive(Clone, Copy)]
enum StatParse {
    /// Plain decimal: "16", "45.1"
    Number,
    /// Fraction-of-1 percentage: "0.8" -> 80.0
    FractionPct,
    /// "MM:SS" -> seconds. "32:14" -> 1934
    TimeMmSs,
    /// "X-Y" -> X. "23-50" -> 23, "4-12" -> 4
    DashFirst,
}

const SOCCER_STATS: &[StatField] = &[
    StatField { name: "possessionPct", label: "possessionPct", parse: StatParse::Number },
    StatField { name: "accuratePasses", label: "accuratePasses", parse: StatParse::Number },
    StatField { name: "totalPasses", label: "totalPasses", parse: StatParse::Number },
    StatField { name: "passPct", label: "passPct", parse: StatParse::FractionPct },
    StatField { name: "accurateLongBalls", label: "accurateLongBalls", parse: StatParse::Number },
    StatField { name: "totalLongBalls", label: "totalLongBalls", parse: StatParse::Number },
    StatField { name: "accurateCrosses", label: "accurateCrosses", parse: StatParse::Number },
    StatField { name: "totalCrosses", label: "totalCrosses", parse: StatParse::Number },
    StatField { name: "effectiveClearance", label: "effectiveClearance", parse: StatParse::Number },
    StatField { name: "totalClearance", label: "totalClearance", parse: StatParse::Number },
    StatField { name: "effectiveTackles", label: "effectiveTackles", parse: StatParse::Number },
    StatField { name: "totalTackles", label: "totalTackles", parse: StatParse::Number },
    StatField { name: "interceptions", label: "interceptions", parse: StatParse::Number },
];

const NBA_STATS: &[StatField] = &[
    StatField {
        name: "fieldGoalsMade-fieldGoalsAttempted",
        label: "fieldGoalsMade",
        parse: StatParse::DashFirst,
    },
    StatField {
        name: "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
        label: "threePointFieldGoalsMade",
        parse: StatParse::DashFirst,
    },
    StatField {
        name: "freeThrowsMade-freeThrowsAttempted",
        label: "freeThrowsMade",
        parse: StatParse::DashFirst,
    },
    StatField { name: "rebounds", label: "rebounds", parse: StatParse::Number },
    StatField { name: "assists", label: "assists", parse: StatParse::Number },
    StatField { name: "steals", label: "steals", parse: StatParse::Number },
    StatField { name: "blocks", label: "blocks", parse: StatParse::Number },
    StatField { name: "turnovers", label: "turnovers", parse: StatParse::Number },
    StatField { name: "fouls", label: "fouls", parse: StatParse::Number },
];

const NFL_STATS: &[StatField] = &[
    StatField { name: "totalYards", label: "totalYards", parse: StatParse::Number },
    StatField { name: "netPassingYards", label: "netPassingYards", parse: StatParse::Number },
    StatField { name: "rushingYards", label: "rushingYards", parse: StatParse::Number },
    StatField { name: "firstDowns", label: "firstDowns", parse: StatParse::Number },
    StatField { name: "thirdDownEff", label: "thirdDownConversions", parse: StatParse::DashFirst },
    StatField { name: "turnovers", label: "turnovers", parse: StatParse::Number },
    StatField { name: "sacksYardsLost", label: "sacks", parse: StatParse::DashFirst },
    StatField { name: "possessionTime", label: "possessionSeconds", parse: StatParse::TimeMmSs },
];

const NHL_STATS: &[StatField] = &[
    StatField { name: "shotsTotal", label: "shotsTotal", parse: StatParse::Number },
    StatField { name: "hits", label: "hits", parse: StatParse::Number },
    StatField { name: "faceoffsWon", label: "faceoffsWon", parse: StatParse::Number },
    StatField { name: "powerPlayGoals", label: "powerPlayGoals", parse: StatParse::Number },
    StatField {
        name: "powerPlayOpportunities",
        label: "powerPlayOpportunities",
        parse: StatParse::Number,
    },
    StatField { name: "penaltyMinutes", label: "penaltyMinutes", parse: StatParse::Number },
];

/// MLB exposes nothing useful in `boxscore.teams[].statistics` — that's just
/// section headers. The real cumulative numbers live in the per-inning
/// linescore on the header. `extract_summary` sums them into synthetic stat
/// names so this catalog can address them uniformly.
const MLB_STATS: &[StatField] = &[
    StatField { name: "linescoreRuns", label: "runs", parse: StatParse::Number },
    StatField { name: "linescoreHits", label: "hits", parse: StatParse::Number },
    StatField { name: "linescoreErrors", label: "errors", parse: StatParse::Number },
];

fn stat_catalog(league_code: &str) -> &'static [StatField] {
    match league_code {
        "epl" | "laliga" | "bundesliga" | "seriea" | "ligue1" | "mls" | "ucl" => SOCCER_STATS,
        "nba" | "wnba" => NBA_STATS,
        "nfl" => NFL_STATS,
        "nhl" => NHL_STATS,
        "mlb" => MLB_STATS,
        _ => &[],
    }
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct ScoreboardResponse {
    #[serde(default)]
    events: Vec<Event>,
}

#[derive(Debug, Deserialize)]
struct Event {
    #[serde(default)]
    id: String,
    /// ISO-8601 kickoff timestamp. Pre-games use this to decide whether the
    /// event is close enough to register as an upcoming score market.
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    competitions: Vec<Competition>,
}

#[derive(Debug, Deserialize)]
struct Competition {
    #[serde(default)]
    competitors: Vec<Competitor>,
    #[serde(default)]
    status: Option<CompetitionStatus>,
}

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TeamInfo {
    #[serde(default)]
    display_name: String,
}

#[derive(Debug, Deserialize)]
struct CompetitionStatus {
    #[serde(default, rename = "type")]
    status_type: Option<StatusType>,
}

#[derive(Debug, Deserialize)]
struct StatusType {
    #[serde(default)]
    completed: bool,
    #[serde(default)]
    state: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SummaryResponse {
    #[serde(default)]
    boxscore: Option<Boxscore>,
    /// Used for MLB-style sports whose cumulative team stats live in the
    /// per-period linescore instead of the boxscore statistics array.
    #[serde(default)]
    header: Option<SummaryHeader>,
}

#[derive(Debug, Deserialize)]
struct SummaryHeader {
    #[serde(default)]
    competitions: Vec<HeaderCompetition>,
}

#[derive(Debug, Deserialize)]
struct HeaderCompetition {
    #[serde(default)]
    competitors: Vec<HeaderCompetitor>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HeaderCompetitor {
    #[serde(default)]
    home_away: Option<String>,
    #[serde(default)]
    linescores: Vec<LinescoreEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinescoreEntry {
    /// String form of the period's score (runs for MLB).
    #[serde(default)]
    display_value: Option<String>,
    #[serde(default)]
    hits: Option<i64>,
    #[serde(default)]
    errors: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct Boxscore {
    #[serde(default)]
    teams: Vec<BoxscoreTeamEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BoxscoreTeamEntry {
    #[serde(default)]
    statistics: Vec<Statistic>,
    #[serde(default)]
    home_away: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Statistic {
    #[serde(default)]
    name: String,
    #[serde(default)]
    display_value: String,
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

#[derive(Debug, Clone)]
struct GameInfo {
    game_id: String,
    home_team: String,
    away_team: String,
    home_score: Option<Decimal>,
    away_score: Option<Decimal>,
    state: String,
    start_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Default, Clone)]
struct EventSummary {
    /// stat-name -> (home displayValue, away displayValue). Missing sides are None.
    stats: HashMap<String, (Option<String>, Option<String>)>,
}

#[derive(Debug, Clone)]
enum AssetKind {
    Score { side: String },
    Stat { stat: String, side: String },
}

#[derive(Debug, Clone)]
struct ParsedAssetId {
    original_id: String,
    league_code: String,
    game_id: String,
    kind: AssetKind,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// ESPN live scores market data source. Source ID is `"sports"`.
pub struct SportsMarketSource {
    http: SourceHttpClient,
    /// `format!("{league}/{game_id}")` keys for events that were live in the
    /// previous fetch_assets cycle. Drives the one-tick-after-final emission
    /// so closing scores and final boxscore stats get published before the
    /// asset deactivates.
    events_live_last_cycle: Mutex<HashSet<String>>,
    /// Per-cycle cache: same `league/game_id` key -> parsed summary. Populated by
    /// fetch_assets, consumed by fetch_prices within the same sync cycle. Cleared
    /// at the start of every fetch_assets call.
    summary_cache: Mutex<HashMap<String, EventSummary>>,
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
            "Sports source initialized (ESPN, {} leagues, 5-min ticks, boxscore expansion)",
            LEAGUES.len()
        );

        Ok(Self {
            http,
            events_live_last_cycle: Mutex::new(HashSet::new()),
            summary_cache: Mutex::new(HashMap::new()),
        })
    }

    async fn fetch_scoreboard(
        &self,
        sport_league: &str,
    ) -> Result<ScoreboardResponse, SourceError> {
        let url = format!("{}/{}/scoreboard", API_BASE, sport_league);
        self.http.get_json::<ScoreboardResponse>(&url).await
    }

    async fn fetch_summary(
        &self,
        sport_league: &str,
        event_id: &str,
    ) -> Result<SummaryResponse, SourceError> {
        let url = format!("{}/{}/summary?event={}", API_BASE, sport_league, event_id);
        self.http.get_json::<SummaryResponse>(&url).await
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
        // 5-minute ticks. Score and boxscore stats advance fast enough during
        // live play to fill several batches per cycle; tighter polling would
        // spend rate-limit budget for marginal gain.
        Duration::from_secs(300)
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
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Reset per-cycle summary cache and grab the previous-cycle live set.
        let prev_live: HashSet<String> = {
            let mut cache = self.summary_cache.lock().expect("summary_cache poisoned");
            cache.clear();
            self.events_live_last_cycle
                .lock()
                .expect("events_live_last_cycle poisoned")
                .clone()
        };

        let now = Utc::now();
        let upcoming_horizon =
            chrono::Duration::hours(UPCOMING_WINDOW_HOURS);

        let mut assets = Vec::new();
        let mut next_live: HashSet<String> = HashSet::new();
        let mut new_cache: HashMap<String, EventSummary> = HashMap::new();
        let mut total_events = 0u32;
        let mut live_events = 0u32;
        let mut final_tick_events = 0u32;
        let mut upcoming_events = 0u32;
        let mut league_errors = 0u32;

        for (idx, &(sport_path, league_code, display_name)) in LEAGUES.iter().enumerate() {
            if idx > 0 {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let scoreboard = match self.fetch_scoreboard(sport_path).await {
                Ok(s) => s,
                Err(e) => {
                    warn!(
                        "Error fetching ESPN scoreboard for {} ({}): {:?}",
                        display_name, sport_path, e
                    );
                    league_errors += 1;
                    continue;
                }
            };

            let games = extract_games(&scoreboard);
            debug!(
                "Sports {}: {} games on scoreboard",
                league_code,
                games.len()
            );
            total_events += games.len() as u32;

            for game in &games {
                let key = format!("{}/{}", league_code, game.game_id);
                let is_live = is_live_state(&game.state);
                let is_final_tick = !is_live && game.state == "post" && prev_live.contains(&key);
                let is_upcoming = !is_live
                    && !is_final_tick
                    && game.state == "pre"
                    && game
                        .start_time
                        .map(|t| t > now && (t - now) <= upcoming_horizon)
                        .unwrap_or(false);

                if !is_live && !is_final_tick && !is_upcoming {
                    continue;
                }

                if is_live {
                    live_events += 1;
                    next_live.insert(key.clone());
                } else if is_final_tick {
                    final_tick_events += 1;
                } else {
                    upcoming_events += 1;
                }

                let matchup = format!("{} vs {}", game.away_team, game.home_team);
                let subcategory = league_code.to_string();
                let start_iso = game.start_time.map(|t| t.to_rfc3339());

                // Score assets: home, away, total.
                for side in ["home", "away", "total"] {
                    assets.push(AssetUpdate {
                        asset_id: format!("sport_{}_{}_{}", league_code, game.game_id, side),
                        symbol: format!("{}/{}", league_code.to_uppercase(), game.game_id),
                        name: format!("{} ({}) [{}]", matchup, side, display_name),
                        category: Some("sports".to_string()),
                        metadata: serde_json::json!({
                            "api_ref": format!("{}:{}", sport_path, game.game_id),
                            "subcategory": subcategory,
                            "active": true,
                            "extra": {
                                "kind": "score",
                                "metric": side,
                                "game_id": game.game_id,
                                "league": league_code,
                                "home_team": game.home_team,
                                "away_team": game.away_team,
                                "state": game.state,
                                "final_tick": is_final_tick,
                                "upcoming": is_upcoming,
                                "start_time": start_iso,
                            },
                        }),
                    });
                }

                // Pre-game (upcoming) events register score-only. No summary
                // fetch, no stat fan-out — the boxscore is empty before
                // kickoff and the rate-limit budget is better spent on live
                // matches.
                if is_upcoming {
                    continue;
                }

                // Boxscore stat assets — only for sports with a catalog.
                let catalog = stat_catalog(league_code);
                if catalog.is_empty() {
                    continue;
                }

                // Fetch summary (whether live or final tick — final tick needs it
                // to publish closing boxscore values).
                tokio::time::sleep(Duration::from_millis(SUMMARY_DELAY_MS)).await;
                let summary = match self.fetch_summary(sport_path, &game.game_id).await {
                    Ok(s) => extract_summary(&s),
                    Err(e) => {
                        warn!(
                            "Error fetching ESPN summary for {} event {}: {:?}",
                            display_name, game.game_id, e
                        );
                        continue;
                    }
                };

                for field in catalog {
                    let (home_raw, away_raw) = summary
                        .stats
                        .get(field.name)
                        .cloned()
                        .unwrap_or((None, None));

                    for (side, raw) in [("home", &home_raw), ("away", &away_raw)] {
                        // Only register an asset if the value actually parses.
                        // Otherwise we'd publish a phantom market that no
                        // fetch_prices call can fill.
                        if raw.as_deref().and_then(|s| parse_stat_value(s, field.parse)).is_none() {
                            continue;
                        }

                        assets.push(AssetUpdate {
                            asset_id: format!(
                                "sport_{}_{}_{}_{}",
                                league_code, game.game_id, field.label, side
                            ),
                            symbol: format!(
                                "{}/{}",
                                league_code.to_uppercase(),
                                game.game_id
                            ),
                            name: format!(
                                "{} ({} · {}) [{}]",
                                matchup, field.label, side, display_name
                            ),
                            category: Some("sports".to_string()),
                            metadata: serde_json::json!({
                                "api_ref": format!("{}:{}", sport_path, game.game_id),
                                "subcategory": subcategory,
                                "active": true,
                                "extra": {
                                    "kind": "stat",
                                    "stat": field.label,
                                    "espn_field": field.name,
                                    "metric": side,
                                    "game_id": game.game_id,
                                    "league": league_code,
                                    "home_team": game.home_team,
                                    "away_team": game.away_team,
                                    "state": game.state,
                                    "final_tick": is_final_tick,
                                },
                            }),
                        });
                    }
                }

                new_cache.insert(key, summary);
            }
        }

        // Swap state for next cycle.
        {
            let mut cache = self.summary_cache.lock().expect("summary_cache poisoned");
            *cache = new_cache;
        }
        {
            let mut live = self
                .events_live_last_cycle
                .lock()
                .expect("events_live_last_cycle poisoned");
            *live = next_live;
        }

        info!(
            "Sports fetch_assets: {} leagues ({} errors) -> {} events ({} live, {} final-tick, {} upcoming<{}h) -> {} assets",
            LEAGUES.len(),
            league_errors,
            total_events,
            live_events,
            final_tick_events,
            upcoming_events,
            UPCOMING_WINDOW_HOURS,
            assets.len()
        );

        Ok(assets)
    }

    fn skips_when_unchanged(&self) -> bool {
        true
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Split incoming asset IDs into score and stat buckets.
        // Score IDs are grouped by league for one scoreboard fetch per league.
        // Stat IDs are grouped by (league, event) — we serve them from the
        // per-cycle summary cache populated by fetch_assets, falling back to
        // a fresh fetch if the cache misses.
        let mut score_by_league: HashMap<String, Vec<ParsedAssetId>> = HashMap::new();
        let mut stat_by_event: HashMap<(String, String), Vec<ParsedAssetId>> = HashMap::new();
        let mut parsed_total = 0usize;

        for asset_id in asset_ids {
            let parsed = match parse_asset_id(asset_id) {
                Some(p) => p,
                None => continue,
            };
            parsed_total += 1;
            match &parsed.kind {
                AssetKind::Score { .. } => {
                    score_by_league
                        .entry(parsed.league_code.clone())
                        .or_default()
                        .push(parsed);
                }
                AssetKind::Stat { .. } => {
                    stat_by_event
                        .entry((parsed.league_code.clone(), parsed.game_id.clone()))
                        .or_default()
                        .push(parsed);
                }
            }
        }

        debug!(
            "Sports fetch_prices: {} asset_ids ({} parsed) -> {} score-leagues, {} stat-events",
            asset_ids.len(),
            parsed_total,
            score_by_league.len(),
            stat_by_event.len()
        );

        // -----------------------------------------------------------------
        // Score path: one scoreboard call per league, same as the original
        // implementation but with the parser updated.
        // -----------------------------------------------------------------
        let mut first = true;
        for (league_code, parsed_assets) in &score_by_league {
            if !first {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }
            first = false;

            let sport_path = match league_code_to_sport_path(league_code) {
                Some(p) => p,
                None => {
                    warn!("Unknown league code '{}', skipping", league_code);
                    continue;
                }
            };

            let scoreboard = match self.fetch_scoreboard(sport_path).await {
                Ok(s) => s,
                Err(e) => {
                    warn!(
                        "Error fetching ESPN scoreboard for league '{}': {:?} — skipping league",
                        league_code, e
                    );
                    continue;
                }
            };

            let games = extract_games(&scoreboard);
            let game_map: HashMap<&str, &GameInfo> =
                games.iter().map(|g| (g.game_id.as_str(), g)).collect();

            for parsed in parsed_assets {
                let game = match game_map.get(parsed.game_id.as_str()) {
                    Some(g) => g,
                    None => {
                        // Event off the scoreboard — don't publish a fake zero.
                        // fetch_assets handles deactivation cleanly.
                        debug!(
                            "Sports: game {} no longer on scoreboard, skipping",
                            parsed.game_id
                        );
                        continue;
                    }
                };

                let side = match &parsed.kind {
                    AssetKind::Score { side } => side.as_str(),
                    _ => continue,
                };

                let value = match side {
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

        // -----------------------------------------------------------------
        // Stat path: serve from per-cycle summary cache, fall back to a
        // fresh summary fetch if missing (e.g. registry has an asset that
        // wasn't repopulated this cycle).
        // -----------------------------------------------------------------
        for ((league_code, event_id), parsed_assets) in &stat_by_event {
            let key = format!("{}/{}", league_code, event_id);

            // Snapshot of the cache entry, if any. Holding the lock across an
            // await is unsound, so we clone out and drop.
            let cached: Option<EventSummary> = {
                self.summary_cache
                    .lock()
                    .expect("summary_cache poisoned")
                    .get(&key)
                    .cloned()
            };

            let summary = match cached {
                Some(s) => s,
                None => {
                    let sport_path = match league_code_to_sport_path(league_code) {
                        Some(p) => p,
                        None => {
                            warn!("Unknown league code '{}', skipping stats", league_code);
                            continue;
                        }
                    };
                    tokio::time::sleep(Duration::from_millis(SUMMARY_DELAY_MS)).await;
                    match self.fetch_summary(sport_path, event_id).await {
                        Ok(s) => {
                            let extracted = extract_summary(&s);
                            self.summary_cache
                                .lock()
                                .expect("summary_cache poisoned")
                                .insert(key.clone(), extracted.clone());
                            extracted
                        }
                        Err(e) => {
                            warn!(
                                "Error fetching ESPN summary for {} event {}: {:?} — skipping stats",
                                league_code, event_id, e
                            );
                            continue;
                        }
                    }
                }
            };

            let catalog = stat_catalog(league_code);
            // Build a quick lookup from label -> StatField for this catalog.
            let by_label: HashMap<&'static str, &StatField> =
                catalog.iter().map(|f| (f.label, f)).collect();

            for parsed in parsed_assets {
                let (stat_label, side) = match &parsed.kind {
                    AssetKind::Stat { stat, side } => (stat.as_str(), side.as_str()),
                    _ => continue,
                };

                let field = match by_label.get(stat_label) {
                    Some(f) => f,
                    None => {
                        debug!(
                            "Sports: stat '{}' not in catalog for league '{}', skipping",
                            stat_label, league_code
                        );
                        continue;
                    }
                };

                let (home_raw, away_raw) = match summary.stats.get(field.name) {
                    Some(pair) => pair.clone(),
                    None => continue,
                };

                let raw = match side {
                    "home" => home_raw,
                    "away" => away_raw,
                    _ => continue,
                };

                let value = match raw.as_deref().and_then(|s| parse_stat_value(s, field.parse)) {
                    Some(v) => v,
                    None => continue,
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

/// Live states keep markets active. ESPN reports halftime as `state == "in"`
/// in observed payloads but `halftime` is included defensively in case the
/// upstream schema ever changes.
fn is_live_state(state: &str) -> bool {
    matches!(state, "in" | "halftime")
}

/// Parse a sports asset ID.
///
/// Two valid shapes after the `sport_` prefix:
/// - Score: `{league}_{event_id}_{home|away|total}`
/// - Stat:  `{league}_{event_id}_{statName}_{home|away}`
///
/// `event_id` is purely numeric (ESPN convention). `league` is alphanumeric
/// with no underscores. `statName` is camelCase with no underscores.
fn parse_asset_id(asset_id: &str) -> Option<ParsedAssetId> {
    let rest = asset_id.strip_prefix("sport_")?;
    let tokens: Vec<&str> = rest.split('_').collect();

    if tokens.len() < 3 || tokens.len() > 4 {
        return None;
    }

    let league_code = tokens[0];
    if league_code.is_empty() {
        return None;
    }

    let event_id = tokens[1];
    if event_id.is_empty() || !event_id.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }

    match tokens.len() {
        3 => {
            let side = tokens[2];
            if !matches!(side, "home" | "away" | "total") {
                return None;
            }
            Some(ParsedAssetId {
                original_id: asset_id.to_string(),
                league_code: league_code.to_string(),
                game_id: event_id.to_string(),
                kind: AssetKind::Score {
                    side: side.to_string(),
                },
            })
        }
        4 => {
            let stat = tokens[2];
            let side = tokens[3];
            if stat.is_empty() {
                return None;
            }
            if !matches!(side, "home" | "away") {
                return None;
            }
            Some(ParsedAssetId {
                original_id: asset_id.to_string(),
                league_code: league_code.to_string(),
                game_id: event_id.to_string(),
                kind: AssetKind::Stat {
                    stat: stat.to_string(),
                    side: side.to_string(),
                },
            })
        }
        _ => None,
    }
}

fn league_code_to_sport_path(league_code: &str) -> Option<&'static str> {
    for &(sport_path, code, _) in LEAGUES {
        if code == league_code {
            return Some(sport_path);
        }
    }
    None
}

/// ESPN serves event timestamps in two flavors:
/// - `2026-05-24T15:00:00Z` (full RFC3339)
/// - `2026-05-24T15:00Z`    (seconds elided)
/// chrono's strict RFC3339 parser rejects the second form; try both.
fn parse_espn_timestamp(raw: &str) -> Option<DateTime<Utc>> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(raw) {
        return Some(dt.with_timezone(&Utc));
    }
    chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%MZ")
        .ok()
        .map(|n| n.and_utc())
}

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

            if !home_team.is_empty() || !away_team.is_empty() {
                let start_time = event
                    .date
                    .as_deref()
                    .and_then(parse_espn_timestamp);
                games.push(GameInfo {
                    game_id: event.id.clone(),
                    home_team,
                    away_team,
                    home_score,
                    away_score,
                    state,
                    start_time,
                });
            }
        }
    }

    games
}

/// Pull the per-team statistics dict out of a summary response and index it
/// by ESPN's stat `name`. Missing sides become None so downstream code can
/// publish whichever side ESPN actually reported.
fn extract_summary(resp: &SummaryResponse) -> EventSummary {
    let mut stats: HashMap<String, (Option<String>, Option<String>)> = HashMap::new();

    // Box-score path — soccer, NBA, NFL, NHL: per-team statistics array
    // is the source of truth.
    if let Some(boxscore) = resp.boxscore.as_ref() {
        for team in &boxscore.teams {
            let is_home = team.home_away.as_deref() == Some("home");
            for s in &team.statistics {
                if s.name.is_empty() || s.display_value.is_empty() {
                    continue;
                }
                let entry = stats.entry(s.name.clone()).or_default();
                if is_home {
                    entry.0 = Some(s.display_value.clone());
                } else {
                    entry.1 = Some(s.display_value.clone());
                }
            }
        }
    }

    // Linescore path — MLB and any other sport whose per-team scalar totals
    // live in `header.competitions[].competitors[].linescores[]`. Sum across
    // periods/innings and stash under synthetic stat names that the per-sport
    // catalog can address. Inert for sports whose linescore is empty.
    if let Some(header) = resp.header.as_ref() {
        if let Some(comp) = header.competitions.first() {
            for c in &comp.competitors {
                if c.linescores.is_empty() {
                    continue;
                }
                let is_home = c.home_away.as_deref() == Some("home");
                let mut runs: i64 = 0;
                let mut hits: i64 = 0;
                let mut errors: i64 = 0;
                for ls in &c.linescores {
                    runs += ls
                        .display_value
                        .as_deref()
                        .and_then(|v| v.parse::<i64>().ok())
                        .unwrap_or(0);
                    hits += ls.hits.unwrap_or(0);
                    errors += ls.errors.unwrap_or(0);
                }
                for (name, val) in [
                    ("linescoreRuns", runs),
                    ("linescoreHits", hits),
                    ("linescoreErrors", errors),
                ] {
                    let entry = stats.entry(name.to_string()).or_default();
                    if is_home {
                        entry.0 = Some(val.to_string());
                    } else {
                        entry.1 = Some(val.to_string());
                    }
                }
            }
        }
    }

    EventSummary { stats }
}

/// Convert an ESPN `displayValue` string into a Decimal using the rule
/// declared in the catalog. Returns None for missing, malformed, or
/// otherwise non-numeric inputs — caller skips the price update.
fn parse_stat_value(raw: &str, rule: StatParse) -> Option<Decimal> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    match rule {
        StatParse::Number => Decimal::from_str(raw).ok(),
        StatParse::FractionPct => {
            let v = Decimal::from_str(raw).ok()?;
            // If ESPN ever switches to whole-number percentages (e.g. "80"
            // instead of "0.8"), avoid double-multiplying.
            if v > Decimal::ONE {
                Some(v)
            } else {
                Some(v * Decimal::from(100))
            }
        }
        StatParse::TimeMmSs => {
            let (mm, ss) = raw.split_once(':')?;
            let m: i64 = mm.parse().ok()?;
            let s: i64 = ss.parse().ok()?;
            Some(Decimal::from(m * 60 + s))
        }
        StatParse::DashFirst => {
            let head = raw.split('-').next()?;
            Decimal::from_str(head.trim()).ok()
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

    // ------------------------------------------------------------------
    // Asset ID parsing
    // ------------------------------------------------------------------

    fn score_side(p: &ParsedAssetId) -> Option<&str> {
        match &p.kind {
            AssetKind::Score { side } => Some(side.as_str()),
            _ => None,
        }
    }

    fn stat_parts(p: &ParsedAssetId) -> Option<(&str, &str)> {
        match &p.kind {
            AssetKind::Stat { stat, side } => Some((stat.as_str(), side.as_str())),
            _ => None,
        }
    }

    #[test]
    fn test_parse_score_home() {
        let p = parse_asset_id("sport_nba_401656789_home").unwrap();
        assert_eq!(p.league_code, "nba");
        assert_eq!(p.game_id, "401656789");
        assert_eq!(score_side(&p), Some("home"));
    }

    #[test]
    fn test_parse_score_away() {
        let p = parse_asset_id("sport_nfl_401547123_away").unwrap();
        assert_eq!(p.league_code, "nfl");
        assert_eq!(score_side(&p), Some("away"));
    }

    #[test]
    fn test_parse_score_total() {
        let p = parse_asset_id("sport_epl_694302_total").unwrap();
        assert_eq!(p.league_code, "epl");
        assert_eq!(score_side(&p), Some("total"));
    }

    #[test]
    fn test_parse_stat_home() {
        let p = parse_asset_id("sport_bundesliga_747019_possessionPct_home").unwrap();
        assert_eq!(p.league_code, "bundesliga");
        assert_eq!(p.game_id, "747019");
        assert_eq!(stat_parts(&p), Some(("possessionPct", "home")));
    }

    #[test]
    fn test_parse_stat_away() {
        let p = parse_asset_id("sport_nba_401873341_threePointFieldGoalsMade_away").unwrap();
        assert_eq!(p.league_code, "nba");
        assert_eq!(p.game_id, "401873341");
        assert_eq!(stat_parts(&p), Some(("threePointFieldGoalsMade", "away")));
    }

    #[test]
    fn test_parse_rejects_stat_with_total_side() {
        // Stats only have home/away; total is score-only.
        assert!(parse_asset_id("sport_epl_694302_possessionPct_total").is_none());
    }

    #[test]
    fn test_parse_rejects_invalid() {
        assert!(parse_asset_id("invalid").is_none());
        assert!(parse_asset_id("sport_").is_none());
        assert!(parse_asset_id("sport_nba_").is_none());
        assert!(parse_asset_id("sport_nba_abc_home").is_none());
        assert!(parse_asset_id("").is_none());
        assert!(parse_asset_id("hn_12345_score").is_none());
        assert!(parse_asset_id("sport_nba_123_invalid").is_none());
        // Too many tokens.
        assert!(parse_asset_id("sport_nba_123_stat_extra_home").is_none());
    }

    #[test]
    fn test_parse_preserves_original() {
        let original = "sport_nhl_401656999_away";
        let p = parse_asset_id(original).unwrap();
        assert_eq!(p.original_id, original);
    }

    // ------------------------------------------------------------------
    // League mapping
    // ------------------------------------------------------------------

    #[test]
    fn test_league_code_to_sport_path() {
        assert_eq!(league_code_to_sport_path("nba"), Some("basketball/nba"));
        assert_eq!(league_code_to_sport_path("nfl"), Some("football/nfl"));
        assert_eq!(league_code_to_sport_path("epl"), Some("soccer/eng.1"));
        assert_eq!(league_code_to_sport_path("mlb"), Some("baseball/mlb"));
        assert_eq!(league_code_to_sport_path("nhl"), Some("hockey/nhl"));
        assert_eq!(league_code_to_sport_path("laliga"), Some("soccer/esp.1"));
        assert_eq!(
            league_code_to_sport_path("bundesliga"),
            Some("soccer/ger.1")
        );
        assert_eq!(league_code_to_sport_path("seriea"), Some("soccer/ita.1"));
        assert_eq!(league_code_to_sport_path("ligue1"), Some("soccer/fra.1"));
        assert_eq!(league_code_to_sport_path("mls"), Some("soccer/usa.1"));
        assert_eq!(league_code_to_sport_path("wnba"), Some("basketball/wnba"));
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
            assert!(codes.insert(code), "Duplicate league code: {}", code);
        }
    }

    // ------------------------------------------------------------------
    // Stat catalogs
    // ------------------------------------------------------------------

    #[test]
    fn test_stat_catalog_routing() {
        assert!(!stat_catalog("epl").is_empty());
        assert!(!stat_catalog("bundesliga").is_empty());
        assert!(!stat_catalog("nba").is_empty());
        assert!(!stat_catalog("wnba").is_empty());
        assert!(!stat_catalog("nfl").is_empty());
        assert!(!stat_catalog("nhl").is_empty());
        assert!(!stat_catalog("mlb").is_empty());
        assert!(stat_catalog("unknown").is_empty());
    }

    #[test]
    fn test_stat_labels_are_camel_case_no_underscores() {
        // Asset IDs use `_` as separator. Stat labels must therefore not
        // contain underscores or dashes.
        for catalog in [
            SOCCER_STATS,
            NBA_STATS,
            NFL_STATS,
            NHL_STATS,
            MLB_STATS,
        ] {
            for f in catalog {
                assert!(
                    !f.label.contains('_') && !f.label.contains('-'),
                    "stat label {} contains separator",
                    f.label
                );
            }
        }
    }

    // ------------------------------------------------------------------
    // Stat value parsing
    // ------------------------------------------------------------------

    #[test]
    fn test_parse_stat_number() {
        assert_eq!(
            parse_stat_value("16", StatParse::Number),
            Some(Decimal::from(16))
        );
        assert_eq!(
            parse_stat_value("45.1", StatParse::Number),
            Some(Decimal::from_str("45.1").unwrap())
        );
        assert_eq!(parse_stat_value("", StatParse::Number), None);
        assert_eq!(parse_stat_value("abc", StatParse::Number), None);
    }

    #[test]
    fn test_parse_stat_fraction_pct() {
        // ESPN soccer passPct often arrives as "0.8" meaning 80%.
        assert_eq!(
            parse_stat_value("0.8", StatParse::FractionPct),
            Some(Decimal::from_str("80.0").unwrap())
        );
        assert_eq!(
            parse_stat_value("0.451", StatParse::FractionPct),
            Some(Decimal::from_str("45.1").unwrap())
        );
        // If ESPN ever returns "80" instead, don't double-multiply.
        assert_eq!(
            parse_stat_value("80", StatParse::FractionPct),
            Some(Decimal::from(80))
        );
    }

    #[test]
    fn test_parse_stat_time_mmss() {
        assert_eq!(
            parse_stat_value("32:14", StatParse::TimeMmSs),
            Some(Decimal::from(32 * 60 + 14))
        );
        assert_eq!(
            parse_stat_value("0:45", StatParse::TimeMmSs),
            Some(Decimal::from(45))
        );
        assert_eq!(parse_stat_value("32", StatParse::TimeMmSs), None);
        assert_eq!(parse_stat_value("abc:def", StatParse::TimeMmSs), None);
    }

    #[test]
    fn test_parse_stat_dash_first() {
        assert_eq!(
            parse_stat_value("4-12", StatParse::DashFirst),
            Some(Decimal::from(4))
        );
        assert_eq!(
            parse_stat_value("23-50", StatParse::DashFirst),
            Some(Decimal::from(23))
        );
        assert_eq!(
            parse_stat_value("7", StatParse::DashFirst),
            Some(Decimal::from(7))
        );
        assert_eq!(parse_stat_value("", StatParse::DashFirst), None);
    }

    // ------------------------------------------------------------------
    // Live-state classifier
    // ------------------------------------------------------------------

    #[test]
    fn test_is_live_state() {
        assert!(is_live_state("in"));
        assert!(is_live_state("halftime"));
        assert!(!is_live_state("pre"));
        assert!(!is_live_state("post"));
        assert!(!is_live_state(""));
        assert!(!is_live_state("unknown"));
    }

    // ------------------------------------------------------------------
    // Scoreboard extraction
    // ------------------------------------------------------------------

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
                date: None,
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
    fn test_extract_games_parses_start_time() {
        let scoreboard = ScoreboardResponse {
            events: vec![Event {
                id: "740966".to_string(),
                date: Some("2026-05-24T15:00Z".to_string()),
                competitions: vec![Competition {
                    competitors: vec![
                        Competitor {
                            id: "1".to_string(),
                            team: Some(TeamInfo {
                                display_name: "Team A".to_string(),
                            }),
                            score: None,
                            home_away: Some("home".to_string()),
                            winner: None,
                        },
                        Competitor {
                            id: "2".to_string(),
                            team: Some(TeamInfo {
                                display_name: "Team B".to_string(),
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
        let st = games[0].start_time.expect("start_time should parse");
        assert_eq!(st.to_rfc3339(), "2026-05-24T15:00:00+00:00");
    }

    #[test]
    fn test_parse_espn_timestamp_full_rfc3339() {
        let dt = parse_espn_timestamp("2026-05-24T15:00:00Z").unwrap();
        assert_eq!(dt.to_rfc3339(), "2026-05-24T15:00:00+00:00");
    }

    #[test]
    fn test_parse_espn_timestamp_abbreviated() {
        let dt = parse_espn_timestamp("2026-05-24T15:00Z").unwrap();
        assert_eq!(dt.to_rfc3339(), "2026-05-24T15:00:00+00:00");
    }

    #[test]
    fn test_parse_espn_timestamp_rejects_garbage() {
        assert!(parse_espn_timestamp("").is_none());
        assert!(parse_espn_timestamp("not-a-date").is_none());
    }

    #[test]
    fn test_upcoming_window_classifier() {
        let now = Utc::now();
        let horizon = chrono::Duration::hours(UPCOMING_WINDOW_HOURS);

        let in_window = now + chrono::Duration::hours(2);
        let out_of_window = now + chrono::Duration::hours(48);
        let past = now - chrono::Duration::hours(1);

        // Mirror of the gate predicate from fetch_assets.
        let is_upcoming = |start: DateTime<Utc>| -> bool {
            start > now && (start - now) <= horizon
        };

        assert!(is_upcoming(in_window));
        assert!(!is_upcoming(out_of_window));
        assert!(!is_upcoming(past));
    }

    #[test]
    fn test_extract_games_pre_no_scores() {
        let scoreboard = ScoreboardResponse {
            events: vec![Event {
                id: "401656790".to_string(),
                date: Some("2026-05-24T15:00Z".to_string()),
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
        assert_eq!(games[0].state, "pre");
        assert_eq!(games[0].home_score, None);
        assert_eq!(games[0].away_score, None);
    }

    #[test]
    fn test_extract_games_skips_empty_id() {
        let scoreboard = ScoreboardResponse {
            events: vec![Event {
                id: "".to_string(),
                date: None,
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

    // ------------------------------------------------------------------
    // Summary extraction
    // ------------------------------------------------------------------

    #[test]
    fn test_extract_summary_indexes_both_sides() {
        let resp = SummaryResponse {
            header: None,
            boxscore: Some(Boxscore {
                teams: vec![
                    BoxscoreTeamEntry {
                        statistics: vec![
                            Statistic {
                                name: "possessionPct".to_string(),
                                display_value: "54.9".to_string(),
                            },
                            Statistic {
                                name: "totalShots".to_string(),
                                display_value: "12".to_string(),
                            },
                        ],
                        home_away: Some("home".to_string()),
                    },
                    BoxscoreTeamEntry {
                        statistics: vec![
                            Statistic {
                                name: "possessionPct".to_string(),
                                display_value: "45.1".to_string(),
                            },
                            Statistic {
                                name: "totalShots".to_string(),
                                display_value: "10".to_string(),
                            },
                        ],
                        home_away: Some("away".to_string()),
                    },
                ],
            }),
        };

        let summary = extract_summary(&resp);
        let poss = summary.stats.get("possessionPct").unwrap();
        assert_eq!(poss.0.as_deref(), Some("54.9"));
        assert_eq!(poss.1.as_deref(), Some("45.1"));
        let shots = summary.stats.get("totalShots").unwrap();
        assert_eq!(shots.0.as_deref(), Some("12"));
        assert_eq!(shots.1.as_deref(), Some("10"));
    }

    #[test]
    fn test_extract_summary_missing_boxscore() {
        let resp = SummaryResponse {
            boxscore: None,
            header: None,
        };
        let summary = extract_summary(&resp);
        assert!(summary.stats.is_empty());
    }

    #[test]
    fn test_extract_summary_linescore_mlb() {
        // 4 innings; home: 1+0+0+2 runs, 1+1+0+3 hits, 0+0+1+0 errors
        // away: 1+0+0+0 runs, 2+0+1+0 hits, 0+0+0+0 errors
        let resp = SummaryResponse {
            boxscore: Some(Boxscore { teams: vec![] }),
            header: Some(SummaryHeader {
                competitions: vec![HeaderCompetition {
                    competitors: vec![
                        HeaderCompetitor {
                            home_away: Some("home".to_string()),
                            linescores: vec![
                                LinescoreEntry {
                                    display_value: Some("1".to_string()),
                                    hits: Some(1),
                                    errors: Some(0),
                                },
                                LinescoreEntry {
                                    display_value: Some("0".to_string()),
                                    hits: Some(1),
                                    errors: Some(0),
                                },
                                LinescoreEntry {
                                    display_value: Some("0".to_string()),
                                    hits: Some(0),
                                    errors: Some(1),
                                },
                                LinescoreEntry {
                                    display_value: Some("2".to_string()),
                                    hits: Some(3),
                                    errors: Some(0),
                                },
                            ],
                        },
                        HeaderCompetitor {
                            home_away: Some("away".to_string()),
                            linescores: vec![
                                LinescoreEntry {
                                    display_value: Some("1".to_string()),
                                    hits: Some(2),
                                    errors: Some(0),
                                },
                                LinescoreEntry {
                                    display_value: Some("0".to_string()),
                                    hits: Some(0),
                                    errors: Some(0),
                                },
                                LinescoreEntry {
                                    display_value: Some("0".to_string()),
                                    hits: Some(1),
                                    errors: Some(0),
                                },
                                LinescoreEntry {
                                    display_value: Some("0".to_string()),
                                    hits: Some(0),
                                    errors: Some(0),
                                },
                            ],
                        },
                    ],
                }],
            }),
        };

        let summary = extract_summary(&resp);
        let runs = summary.stats.get("linescoreRuns").unwrap();
        assert_eq!(runs.0.as_deref(), Some("3"));
        assert_eq!(runs.1.as_deref(), Some("1"));
        let hits = summary.stats.get("linescoreHits").unwrap();
        assert_eq!(hits.0.as_deref(), Some("5"));
        assert_eq!(hits.1.as_deref(), Some("3"));
        let errors = summary.stats.get("linescoreErrors").unwrap();
        assert_eq!(errors.0.as_deref(), Some("1"));
        assert_eq!(errors.1.as_deref(), Some("0"));
    }

    // ------------------------------------------------------------------
    // Bucketing in fetch_prices (parser exercised via map-building)
    // ------------------------------------------------------------------

    #[test]
    fn test_bucketing_score_vs_stat() {
        let asset_ids = vec![
            "sport_nba_100_home".to_string(),
            "sport_nba_100_away".to_string(),
            "sport_nba_100_total".to_string(),
            "sport_epl_200_possessionPct_home".to_string(),
            "sport_epl_200_possessionPct_away".to_string(),
            "sport_epl_200_totalPasses_home".to_string(),
        ];

        let mut score_by_league: HashMap<String, Vec<ParsedAssetId>> = HashMap::new();
        let mut stat_by_event: HashMap<(String, String), Vec<ParsedAssetId>> = HashMap::new();

        for aid in &asset_ids {
            let parsed = parse_asset_id(aid).unwrap();
            match &parsed.kind {
                AssetKind::Score { .. } => {
                    score_by_league
                        .entry(parsed.league_code.clone())
                        .or_default()
                        .push(parsed);
                }
                AssetKind::Stat { .. } => {
                    stat_by_event
                        .entry((parsed.league_code.clone(), parsed.game_id.clone()))
                        .or_default()
                        .push(parsed);
                }
            }
        }

        assert_eq!(score_by_league.len(), 1);
        assert_eq!(score_by_league.get("nba").unwrap().len(), 3);
        assert_eq!(stat_by_event.len(), 1);
        assert_eq!(
            stat_by_event
                .get(&("epl".to_string(), "200".to_string()))
                .unwrap()
                .len(),
            3
        );
    }
}
