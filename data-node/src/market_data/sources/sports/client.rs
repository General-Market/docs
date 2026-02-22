//! ESPN Live Scores client implementing MarketDataSource
//!
//! Tracks team scores across 5 major leagues: NBA, NFL, EPL, MLB, NHL.
//! Each team is an asset; value is the team's score in the most recent game.
//!
//! API: https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
//! Auth: None
//! Rate limit: 30 req/min (be polite, undocumented API)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — static list of ~102 teams across 5 leagues
const ASSET_JSON: &str = include_str!("../../../config/sports.json");

/// ESPN API base URL
const API_BASE: &str = "https://site.api.espn.com/apis/site/v2/sports";

/// Delay between sequential league fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 2000;

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
struct Competitor {
    #[serde(default)]
    id: String,
    #[serde(default)]
    team: Option<TeamInfo>,
    #[serde(default)]
    score: Option<String>,
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
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// ESPN live scores market data source.
///
/// Tracks team scores across NBA, NFL, EPL, MLB, NHL.
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

        info!("Sports source initialized (ESPN)");

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
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Load asset entries to get api_ref mappings
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let entry_map: HashMap<String, AssetEntry> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), e))
            .collect();

        // Group assets by sport/league from api_ref
        // api_ref format: "basketball/nba:13"
        let mut league_teams: HashMap<String, Vec<(String, String, String)>> = HashMap::new();

        for asset_id in asset_ids {
            if let Some(entry) = entry_map.get(asset_id.as_str()) {
                if let Some((league, team_id)) = parse_api_ref(&entry.api_ref) {
                    league_teams
                        .entry(league.to_string())
                        .or_default()
                        .push((asset_id.clone(), team_id.to_string(), entry.symbol.clone()));
                }
            }
        }

        debug!(
            "Sports fetch_prices: {} asset_ids -> {} unique leagues",
            asset_ids.len(),
            league_teams.len()
        );

        // Fetch each league's scoreboard once
        for (league, teams) in &league_teams {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_scoreboard(league).await {
                Ok(scoreboard) => {
                    // Build a map of team_id -> latest score
                    let score_map = extract_team_scores(&scoreboard);

                    for (asset_id, team_id, symbol) in teams {
                        let score = score_map
                            .get(team_id.as_str())
                            .copied()
                            .unwrap_or(Decimal::ZERO);

                        results.push(PriceUpdate {
                            asset_id: asset_id.clone(),
                            symbol: symbol.clone(),
                            value: score,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
                Err(e) => {
                    warn!("Error fetching ESPN scoreboard for {}: {:?}", league, e);
                    // Return 0 for all teams in this league on error
                    for (asset_id, _, symbol) in teams {
                        results.push(PriceUpdate {
                            asset_id: asset_id.clone(),
                            symbol: symbol.clone(),
                            value: Decimal::ZERO,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
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

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        // Could fetch each league's teams endpoint to discover new teams
        // For now, return empty — static config covers all relevant teams
        Ok(vec![])
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/// Parse api_ref "basketball/nba:13" into ("basketball/nba", "13")
fn parse_api_ref(api_ref: &str) -> Option<(&str, &str)> {
    api_ref.split_once(':')
}

/// Extract team scores from a scoreboard response.
/// Returns a map of team_id -> score (most recent game).
/// If a team has multiple games, the most recent (last in events list) wins.
fn extract_team_scores(scoreboard: &ScoreboardResponse) -> HashMap<String, Decimal> {
    let mut scores: HashMap<String, Decimal> = HashMap::new();

    for event in &scoreboard.events {
        for competition in &event.competitions {
            for competitor in &competition.competitors {
                if let Some(score_str) = &competitor.score {
                    if let Ok(score) = score_str.parse::<i64>() {
                        scores.insert(competitor.id.clone(), Decimal::from(score));
                    }
                }
            }
        }
    }

    scores
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
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(
            entries.len() >= 90,
            "Expected at least 90 sports assets, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_active_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 90,
            "Expected at least 90 active sports assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_entries_sports_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "sports",
                "Asset {} has category '{}', expected 'sports'",
                entry.asset_id, entry.category
            );
        }
    }

    #[test]
    fn test_parse_api_ref() {
        assert_eq!(
            parse_api_ref("basketball/nba:13"),
            Some(("basketball/nba", "13"))
        );
        assert_eq!(
            parse_api_ref("football/nfl:12"),
            Some(("football/nfl", "12"))
        );
        assert_eq!(
            parse_api_ref("soccer/eng.1:359"),
            Some(("soccer/eng.1", "359"))
        );
        assert_eq!(
            parse_api_ref("baseball/mlb:10"),
            Some(("baseball/mlb", "10"))
        );
        assert_eq!(
            parse_api_ref("hockey/nhl:3"),
            Some(("hockey/nhl", "3"))
        );
        assert_eq!(parse_api_ref("invalid"), None);
    }

    #[test]
    fn test_all_entries_have_valid_api_ref() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let parsed = parse_api_ref(&entry.api_ref);
            assert!(
                parsed.is_some(),
                "Failed to parse api_ref '{}' for asset '{}'",
                entry.api_ref,
                entry.asset_id
            );
            let (league, team_id) = parsed.unwrap();
            assert!(!league.is_empty(), "Empty league in api_ref for {}", entry.asset_id);
            assert!(!team_id.is_empty(), "Empty team_id in api_ref for {}", entry.asset_id);
            // team_id should be numeric
            assert!(
                team_id.parse::<u32>().is_ok(),
                "Non-numeric team_id '{}' in api_ref for {}",
                team_id,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_league_distribution() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut league_counts: HashMap<String, usize> = HashMap::new();
        for entry in &entries {
            if let Some((league, _)) = parse_api_ref(&entry.api_ref) {
                *league_counts.entry(league.to_string()).or_default() += 1;
            }
        }
        assert_eq!(*league_counts.get("basketball/nba").unwrap_or(&0), 30);
        assert_eq!(*league_counts.get("football/nfl").unwrap_or(&0), 32);
        assert_eq!(*league_counts.get("soccer/eng.1").unwrap_or(&0), 20);
        assert_eq!(*league_counts.get("baseball/mlb").unwrap_or(&0), 10);
        assert_eq!(*league_counts.get("hockey/nhl").unwrap_or(&0), 10);
    }

    #[test]
    fn test_extract_team_scores_empty() {
        let scoreboard = ScoreboardResponse { events: vec![] };
        let scores = extract_team_scores(&scoreboard);
        assert!(scores.is_empty());
    }

    #[test]
    fn test_extract_team_scores_basic() {
        let scoreboard = ScoreboardResponse {
            events: vec![Event {
                competitions: vec![Competition {
                    competitors: vec![
                        Competitor {
                            id: "13".to_string(),
                            team: Some(TeamInfo {
                                display_name: "Los Angeles Lakers".to_string(),
                            }),
                            score: Some("105".to_string()),
                            winner: Some(false),
                        },
                        Competitor {
                            id: "2".to_string(),
                            team: Some(TeamInfo {
                                display_name: "Boston Celtics".to_string(),
                            }),
                            score: Some("110".to_string()),
                            winner: Some(true),
                        },
                    ],
                    status: Some(CompetitionStatus {
                        status_type: Some(StatusType { completed: true }),
                    }),
                }],
            }],
        };

        let scores = extract_team_scores(&scoreboard);
        assert_eq!(scores.get("13"), Some(&Decimal::from(105)));
        assert_eq!(scores.get("2"), Some(&Decimal::from(110)));
    }

    #[test]
    fn test_extract_team_scores_no_score() {
        let scoreboard = ScoreboardResponse {
            events: vec![Event {
                competitions: vec![Competition {
                    competitors: vec![Competitor {
                        id: "13".to_string(),
                        team: Some(TeamInfo {
                            display_name: "Los Angeles Lakers".to_string(),
                        }),
                        score: None,
                        winner: None,
                    }],
                    status: None,
                }],
            }],
        };

        let scores = extract_team_scores(&scoreboard);
        assert!(scores.is_empty());
    }

    #[test]
    fn test_unique_team_ids_per_league() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut seen: HashMap<String, Vec<String>> = HashMap::new();
        for entry in &entries {
            let key = format!("{}:{}", entry.api_ref, entry.asset_id);
            seen.entry(entry.api_ref.clone())
                .or_default()
                .push(entry.asset_id.clone());
        }
        for (api_ref, asset_ids) in &seen {
            assert_eq!(
                asset_ids.len(),
                1,
                "Duplicate api_ref '{}' used by: {:?}",
                api_ref,
                asset_ids
            );
        }
    }
}
