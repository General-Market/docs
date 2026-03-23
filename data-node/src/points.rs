//! Points system — 10,000 pts/day across three pools.
//!
//! - Vision (5,000/day): awarded when rounds settle, proportional to deposit size
//! - Index Creator (2,500/day): hourly, ranked by ITP NAV growth, 0.7x exponential decay
//! - Index Holder (2,500/day): hourly, ranked by weighted portfolio performance, 0.7x decay
//!
//! All computation lives here. The oracle provides settled round data.
//! ITP data comes from chain cache + itp_meta table.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{Timelike, Utc};
use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::{debug, error, info, warn};

use crate::chain_cache::ChainCache;

// ── Budget constants ──────────────────────────────────────────────────────

/// Vision pool: 5,000 pts/day = ~208.33 pts/hr
const VISION_BUDGET_PER_DAY: f64 = 5_000.0;

/// Index Creator pool: 2,500 pts/day = ~104.17 pts/hr
const CREATOR_BUDGET_PER_HOUR: f64 = 2_500.0 / 24.0;

/// Index Holder pool: 2,500 pts/day = ~104.17 pts/hr
const HOLDER_BUDGET_PER_HOUR: f64 = 2_500.0 / 24.0;

/// Exponential decay factor for ranked distributions
const DECAY_FACTOR: f64 = 0.7;

// ── Oracle types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OracleRound {
    #[serde(alias = "batch_id", alias = "batchId")]
    batch_id: i64,
    #[serde(alias = "settled_at", alias = "settledAt")]
    settled_at: Option<String>,
    #[serde(alias = "player_count", alias = "playerCount")]
    player_count: Option<i64>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OracleRoundResult {
    #[serde(alias = "batch_id", alias = "batchId")]
    batch_id: i64,
    settled: Option<bool>,
    players: Option<Vec<OraclePlayerResult>>,
}

#[derive(Debug, Deserialize)]
struct OraclePlayerResult {
    player: String,
    deposited: String,
    payout: String,
    pnl: String,
    #[serde(alias = "correct_count", alias = "correctCount")]
    correct_count: Option<i64>,
    #[serde(alias = "total_markets", alias = "totalMarkets")]
    total_markets: Option<i64>,
}

// ── API response types ────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPoints {
    pub vision: f64,
    pub index_creator: f64,
    pub index_holder: f64,
    pub total: f64,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub rank: i64,
    pub player: String,
    pub vision: f64,
    pub index_creator: f64,
    pub index_holder: f64,
    pub total: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PointsLeaderboard {
    pub entries: Vec<LeaderboardEntry>,
    pub updated_at: String,
}

// ── DB helpers ─────────────────────────────────────────────────────────────

/// Insert a batch of point awards into the ledger + upsert totals.
/// Uses ON CONFLICT DO NOTHING for idempotency.
async fn award_points(
    pool: &PgPool,
    awards: &[(String, String, f64, String, Option<i32>)], // (player, pool, points, reason, rank)
) -> Result<u64, sqlx::Error> {
    if awards.is_empty() {
        return Ok(0);
    }

    let mut inserted = 0u64;
    for (player, pts_pool, points, reason, rank) in awards {
        if *points <= 0.0 {
            continue;
        }

        let result = sqlx::query(
            r#"
            INSERT INTO points_ledger (player, pool, points, reason, rank)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (player, pool, reason) DO NOTHING
            "#,
        )
        .bind(player)
        .bind(pts_pool)
        .bind(Decimal::from_f64(*points).unwrap_or(Decimal::ZERO))
        .bind(reason)
        .bind(*rank)
        .execute(pool)
        .await?;

        if result.rows_affected() > 0 {
            inserted += 1;

            // Upsert totals
            sqlx::query(
                r#"
                INSERT INTO points_totals (player, pool, total, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (player, pool) DO UPDATE
                SET total = points_totals.total + $3, updated_at = NOW()
                "#,
            )
            .bind(player)
            .bind(pts_pool)
            .bind(Decimal::from_f64(*points).unwrap_or(Decimal::ZERO))
            .execute(pool)
            .await?;
        }
    }

    Ok(inserted)
}

/// Ensure itp_meta row exists for an ITP. Returns true if newly inserted.
async fn ensure_itp_meta(
    pool: &PgPool,
    itp_id: &str,
    creator: &str,
    nav_at_creation: f64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        INSERT INTO itp_meta (itp_id, creator, nav_at_creation)
        VALUES ($1, $2, $3)
        ON CONFLICT (itp_id) DO NOTHING
        "#,
    )
    .bind(itp_id)
    .bind(creator)
    .bind(Decimal::from_f64(nav_at_creation).unwrap_or(Decimal::ONE))
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

// ── Vision points ─────────────────────────────────────────────────────────

/// Process a settled round: distribute vision points proportional to deposit.
///
/// Per-round budget = VISION_BUDGET_PER_DAY / estimated_rounds_per_day.
/// We estimate rounds_per_day from the number of rounds settled in the last hour × 24.
/// Minimum: 10 pts/round (prevents dust when many rounds settle).
/// Maximum: 500 pts/round (prevents single-round gorging when few rounds exist).
async fn process_settled_round(
    pool: &PgPool,
    oracle_url: &str,
    client: &reqwest::Client,
    batch_id: i64,
    rounds_last_hour: u64,
) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    // Check if we already processed this round
    let existing: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM points_ledger WHERE reason = $1 AND pool = 'vision'",
    )
    .bind(format!("vision:round:{}", batch_id))
    .fetch_one(pool)
    .await?;

    if existing.0 > 0 {
        debug!(batch_id, "Round already processed for points, skipping");
        return Ok(0);
    }

    // Fetch round results from oracle
    let url = format!("{}/vision/rounds/{}/results", oracle_url, batch_id);
    let resp = client.get(&url).send().await?;
    if !resp.status().is_success() {
        return Err(format!("Oracle returned {} for round {}", resp.status(), batch_id).into());
    }

    let results: OracleRoundResult = resp.json().await?;
    let players = results.players.unwrap_or_default();
    if players.is_empty() {
        debug!(batch_id, "Round has no players, skipping");
        return Ok(0);
    }

    // Compute per-round budget
    // Estimate rounds/day from last hour's rate (minimum 1 round/hr → 24/day)
    let est_rounds_per_day = (rounds_last_hour.max(1) as f64) * 24.0;
    let round_budget = (VISION_BUDGET_PER_DAY / est_rounds_per_day)
        .max(10.0)
        .min(500.0);

    // Total deposits for this round
    let total_deposited: f64 = players
        .iter()
        .map(|p| parse_wei_to_f64(&p.deposited))
        .sum();

    if total_deposited <= 0.0 {
        return Ok(0);
    }

    // Distribute proportionally
    let reason = format!("vision:round:{}", batch_id);
    let awards: Vec<_> = players
        .iter()
        .map(|p| {
            let deposit = parse_wei_to_f64(&p.deposited);
            let share = deposit / total_deposited;
            let pts = round_budget * share;
            (
                p.player.to_lowercase(),
                "vision".to_string(),
                pts,
                reason.clone(),
                None::<i32>,
            )
        })
        .collect();

    let inserted = award_points(pool, &awards).await?;
    if inserted > 0 {
        info!(
            batch_id,
            players = players.len(),
            budget = format!("{:.1}", round_budget),
            "Vision points awarded for round"
        );
    }

    Ok(inserted)
}

// ── Index Creator points ──────────────────────────────────────────────────

/// Award creator points for the current hour.
/// Ranks ITPs by NAV growth since creation, distributes with 0.7x exponential decay.
async fn award_creator_points(
    pool: &PgPool,
    chain_cache: &ChainCache,
) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let hour_key = Utc::now().format("%Y-%m-%dT%H").to_string();
    let reason = format!("index_creator:hourly:{}", hour_key);

    // Check idempotency
    let existing: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM points_ledger WHERE reason = $1 AND pool = 'index_creator'",
    )
    .bind(&reason)
    .fetch_one(pool)
    .await?;

    if existing.0 > 0 {
        debug!(hour = %hour_key, "Creator points already awarded this hour");
        return Ok(0);
    }

    // Get all ITP states from chain cache
    let itp_states = chain_cache.itp_states.read().await;
    let nav_snapshots = chain_cache.nav.read().await;
    if itp_states.states.is_empty() {
        return Ok(0);
    }

    // Build NAV lookup from nav snapshots (nav_per_share is already f64 in USDC)
    let nav_lookup: HashMap<String, f64> = nav_snapshots
        .iter()
        .map(|s| (s.itp_id.clone(), s.nav_per_share))
        .collect();

    // Load itp_meta for creator addresses and NAV at creation
    let meta_rows: Vec<(String, String, Decimal)> = sqlx::query_as(
        "SELECT itp_id, creator, nav_at_creation FROM itp_meta",
    )
    .fetch_all(pool)
    .await?;

    let meta_map: HashMap<String, (String, f64)> = meta_rows
        .into_iter()
        .map(|(id, creator, nav)| {
            (id, (creator, nav.to_f64().unwrap_or(1.0)))
        })
        .collect();

    // For ITPs without meta, seed them now from chain cache
    for (itp_id, cached) in &itp_states.states {
        if !meta_map.contains_key(itp_id) {
            let creator_addr = format!("{:?}", cached.creator).to_lowercase();
            let nav_f64 = nav_lookup.get(itp_id).copied().unwrap_or(1.0);
            if ensure_itp_meta(pool, itp_id, &creator_addr, nav_f64).await? {
                info!(itp_id, "Seeded itp_meta for new ITP");
            }
        }
    }

    // Drop locks before re-reading
    drop(itp_states);
    drop(nav_snapshots);

    // Re-read meta after seeding
    let meta_rows: Vec<(String, String, Decimal)> = sqlx::query_as(
        "SELECT itp_id, creator, nav_at_creation FROM itp_meta",
    )
    .fetch_all(pool)
    .await?;

    // Re-acquire NAV snapshots
    let nav_snapshots = chain_cache.nav.read().await;
    let nav_lookup: HashMap<String, f64> = nav_snapshots
        .iter()
        .map(|s| (s.itp_id.clone(), s.nav_per_share))
        .collect();

    // Compute NAV growth for each ITP
    struct ItpGrowth {
        creator: String,
        growth_pct: f64,
    }

    let mut growths: Vec<ItpGrowth> = Vec::new();
    for (itp_id, creator, nav_at_creation) in &meta_rows {
        let nav_creation = nav_at_creation.to_f64().unwrap_or(1.0);
        if nav_creation <= 0.0 {
            continue;
        }

        // Get current NAV from chain cache
        let current_nav = match nav_lookup.get(itp_id) {
            Some(&nav) => nav,
            None => continue,
        };

        let growth = (current_nav - nav_creation) / nav_creation;
        if growth > 0.0 {
            growths.push(ItpGrowth {
                creator: creator.clone(),
                growth_pct: growth,
            });
        }
    }

    if growths.is_empty() {
        debug!("No ITPs with positive growth, skipping creator points");
        return Ok(0);
    }

    // Sort by growth descending
    growths.sort_by(|a, b| b.growth_pct.partial_cmp(&a.growth_pct).unwrap_or(std::cmp::Ordering::Equal));

    // Distribute with exponential decay
    let awards = distribute_ranked(&growths.iter().map(|g| g.creator.clone()).collect::<Vec<_>>(), CREATOR_BUDGET_PER_HOUR, &reason, "index_creator");

    let inserted = award_points(pool, &awards).await?;
    if inserted > 0 {
        info!(
            hour = %hour_key,
            eligible_itps = growths.len(),
            awarded = inserted,
            "Creator points awarded"
        );
    }

    Ok(inserted)
}

// ── Index Holder points ───────────────────────────────────────────────────

/// Award holder points for the current hour.
/// Ranks holders by weighted portfolio NAV growth, distributes with 0.7x decay.
async fn award_holder_points(
    pool: &PgPool,
    chain_cache: &ChainCache,
) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let hour_key = Utc::now().format("%Y-%m-%dT%H").to_string();
    let reason = format!("index_holder:hourly:{}", hour_key);

    // Check idempotency
    let existing: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM points_ledger WHERE reason = $1 AND pool = 'index_holder'",
    )
    .bind(&reason)
    .fetch_one(pool)
    .await?;

    if existing.0 > 0 {
        debug!(hour = %hour_key, "Holder points already awarded this hour");
        return Ok(0);
    }

    // Get all ITPs and their current NAVs from chain cache
    let nav_snapshots = chain_cache.nav.read().await;
    if nav_snapshots.is_empty() {
        return Ok(0);
    }

    let nav_lookup: HashMap<String, f64> = nav_snapshots
        .iter()
        .map(|s| (s.itp_id.clone(), s.nav_per_share))
        .collect();
    drop(nav_snapshots);

    // Load itp_meta for NAV at creation
    let meta_rows: Vec<(String, Decimal)> = sqlx::query_as(
        "SELECT itp_id, nav_at_creation FROM itp_meta",
    )
    .fetch_all(pool)
    .await?;

    let meta_map: HashMap<String, f64> = meta_rows
        .into_iter()
        .map(|(id, nav)| (id, nav.to_f64().unwrap_or(1.0)))
        .collect();

    // Get holder data from user_shares table (populated by chain pollers)
    let share_rows: Vec<(String, String, Decimal)> = sqlx::query_as(
        "SELECT itp_id, user_address, shares FROM user_shares WHERE shares > 0",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if share_rows.is_empty() {
        debug!("No holders found, skipping holder points");
        return Ok(0);
    }

    // Compute weighted portfolio performance per holder
    // For each holder: weighted avg NAV growth across all ITPs held
    // Simplified: use NAV at creation as baseline (all holders start from migration)
    struct HolderPerf {
        address: String,
        perf: f64,
    }

    let mut holder_values: HashMap<String, (f64, f64)> = HashMap::new(); // address → (weighted_growth_sum, weight_sum)

    for (itp_id, user_address, shares) in &share_rows {
        let shares_f64 = shares.to_f64().unwrap_or(0.0);
        if shares_f64 <= 0.0 {
            continue;
        }

        let nav_creation = meta_map.get(itp_id).copied().unwrap_or(1.0);
        if nav_creation <= 0.0 {
            continue;
        }

        let current_nav = match nav_lookup.get(itp_id) {
            Some(&nav) => nav,
            None => continue,
        };

        let growth = (current_nav - nav_creation) / nav_creation;
        let weight = shares_f64 * nav_creation; // dollar-weighted

        let entry = holder_values
            .entry(user_address.to_lowercase())
            .or_insert((0.0, 0.0));
        entry.0 += growth * weight;
        entry.1 += weight;
    }

    let mut perfs: Vec<HolderPerf> = holder_values
        .into_iter()
        .filter_map(|(address, (growth_sum, weight_sum))| {
            if weight_sum <= 0.0 {
                return None;
            }
            let perf = growth_sum / weight_sum;
            if perf > 0.0 {
                Some(HolderPerf { address, perf })
            } else {
                None
            }
        })
        .collect();

    if perfs.is_empty() {
        debug!("No holders with positive performance, skipping");
        return Ok(0);
    }

    // Sort by performance descending
    perfs.sort_by(|a, b| b.perf.partial_cmp(&a.perf).unwrap_or(std::cmp::Ordering::Equal));

    let awards = distribute_ranked(
        &perfs.iter().map(|h| h.address.clone()).collect::<Vec<_>>(),
        HOLDER_BUDGET_PER_HOUR,
        &reason,
        "index_holder",
    );

    let inserted = award_points(pool, &awards).await?;
    if inserted > 0 {
        info!(
            hour = %hour_key,
            eligible_holders = perfs.len(),
            awarded = inserted,
            "Holder points awarded"
        );
    }

    Ok(inserted)
}

// ── Ranked distribution helper ────────────────────────────────────────────

/// Distribute a budget across ranked players using 0.7x exponential decay.
/// Rank 1 gets weight 1.0, rank 2 gets 0.7, rank 3 gets 0.49, etc.
fn distribute_ranked(
    players: &[String],
    budget: f64,
    reason: &str,
    pool_name: &str,
) -> Vec<(String, String, f64, String, Option<i32>)> {
    if players.is_empty() || budget <= 0.0 {
        return Vec::new();
    }

    // Compute weights
    let weights: Vec<f64> = (0..players.len())
        .map(|i| DECAY_FACTOR.powi(i as i32))
        .collect();
    let total_weight: f64 = weights.iter().sum();

    let mut awards = Vec::with_capacity(players.len());
    let mut remaining = budget;

    for (i, player) in players.iter().enumerate() {
        let pts = if i == 0 {
            // Rank 1 gets their share + any rounding remainder
            let base = (weights[0] / total_weight) * budget;
            let others: f64 = weights[1..]
                .iter()
                .map(|w| ((w / total_weight) * budget).floor())
                .sum();
            budget - others
        } else {
            ((weights[i] / total_weight) * budget).floor()
        };

        remaining -= pts;
        awards.push((
            player.clone(),
            pool_name.to_string(),
            pts,
            reason.to_string(),
            Some((i + 1) as i32),
        ));
    }

    awards
}

// ── CSV backup ────────────────────────────────────────────────────────────

/// Backup interval: every 4 hours
const BACKUP_INTERVAL_HOURS: u32 = 4;

/// Dump points_ledger and points_totals to CSV files.
/// Writes to `data-node/backups/points/` with timestamped filenames.
/// Each run produces a complete snapshot — any single file is enough to restore.
async fn backup_points_to_csv(pool: &PgPool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use std::io::Write;

    let backup_dir = std::path::PathBuf::from("data-node/backups/points");
    // Fall back to CWD-relative if data-node/ doesn't exist (running from project root vs data-node dir)
    let backup_dir = if backup_dir.parent().map(|p| p.exists()).unwrap_or(false) {
        backup_dir
    } else {
        std::path::PathBuf::from("backups/points")
    };
    std::fs::create_dir_all(&backup_dir)?;

    let ts = Utc::now().format("%Y%m%d-%H%M%S").to_string();

    // ── Dump points_totals (the one that matters for recovery) ──
    let totals_path = backup_dir.join(format!("points_totals_{}.csv", ts));
    let totals: Vec<(String, String, Decimal, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT player, pool, total, updated_at FROM points_totals ORDER BY player, pool",
    )
    .fetch_all(pool)
    .await?;

    {
        let mut f = std::fs::File::create(&totals_path)?;
        writeln!(f, "player,pool,total,updated_at")?;
        for (player, pts_pool, total, updated_at) in &totals {
            writeln!(f, "{},{},{},{}", player, pts_pool, total, updated_at.to_rfc3339())?;
        }
        f.flush()?;
    }

    // ── Dump points_ledger (full audit trail) ──
    let ledger_path = backup_dir.join(format!("points_ledger_{}.csv", ts));
    let ledger: Vec<(i64, String, String, Decimal, String, Option<i32>, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT id, player, pool, points, reason, rank, created_at FROM points_ledger ORDER BY id",
    )
    .fetch_all(pool)
    .await?;

    {
        let mut f = std::fs::File::create(&ledger_path)?;
        writeln!(f, "id,player,pool,points,reason,rank,created_at")?;
        for (id, player, pts_pool, points, reason, rank, created_at) in &ledger {
            let rank_str = rank.map(|r| r.to_string()).unwrap_or_default();
            // Escape reason field (may contain colons but no commas — safe for CSV)
            writeln!(
                f,
                "{},{},{},{},{},{},{}",
                id, player, pts_pool, points, reason, rank_str, created_at.to_rfc3339()
            )?;
        }
        f.flush()?;
    }

    // ── Prune old backups (keep last 10 of each type) ──
    prune_old_backups(&backup_dir, "points_totals_", 10);
    prune_old_backups(&backup_dir, "points_ledger_", 10);

    info!(
        totals = totals.len(),
        ledger = ledger.len(),
        path = %totals_path.display(),
        "Points CSV backup written"
    );

    Ok(())
}

/// Keep only the N most recent files matching a prefix. Oldest files are deleted.
fn prune_old_backups(dir: &std::path::Path, prefix: &str, keep: usize) {
    let mut files: Vec<std::path::PathBuf> = std::fs::read_dir(dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_str()
                .map(|n| n.starts_with(prefix) && n.ends_with(".csv"))
                .unwrap_or(false)
        })
        .map(|e| e.path())
        .collect();

    // Sort by name (timestamp is embedded, so lexicographic = chronological)
    files.sort();

    if files.len() > keep {
        for old in &files[..files.len() - keep] {
            if let Err(e) = std::fs::remove_file(old) {
                warn!(path = %old.display(), error = %e, "Failed to prune old backup");
            }
        }
    }
}

// ── Utility ───────────────────────────────────────────────────────────────

/// Parse a wei string (uint256) to f64 USDC (18 decimals on L3).
fn parse_wei_to_f64(s: &str) -> f64 {
    s.parse::<f64>().unwrap_or(0.0) / 1e18
}

// ── API handlers ──────────────────────────────────────────────────────────

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::Json;

#[derive(Deserialize)]
pub struct PointsQuery {
    pub user: Option<String>,
}

#[derive(Deserialize)]
pub struct LeaderboardQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// GET /points?user={address}
pub async fn get_points(
    State(state): State<Arc<crate::api::AppState>>,
    Query(params): Query<PointsQuery>,
) -> Result<Json<UserPoints>, StatusCode> {
    let user = params
        .user
        .as_deref()
        .ok_or(StatusCode::BAD_REQUEST)?
        .to_lowercase();

    let rows: Vec<(String, Decimal)> = sqlx::query_as(
        "SELECT pool, total FROM points_totals WHERE player = $1",
    )
    .bind(&user)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch points: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let mut vision = 0.0;
    let mut index_creator = 0.0;
    let mut index_holder = 0.0;

    for (pool, total) in &rows {
        let val = total.to_f64().unwrap_or(0.0);
        match pool.as_str() {
            "vision" => vision = val,
            "index_creator" => index_creator = val,
            "index_holder" => index_holder = val,
            _ => {}
        }
    }

    Ok(Json(UserPoints {
        vision,
        index_creator,
        index_holder,
        total: vision + index_creator + index_holder,
        updated_at: Utc::now().to_rfc3339(),
    }))
}

/// GET /points/leaderboard?limit=50&offset=0
pub async fn get_leaderboard(
    State(state): State<Arc<crate::api::AppState>>,
    Query(params): Query<LeaderboardQuery>,
) -> Result<Json<PointsLeaderboard>, StatusCode> {
    let limit = params.limit.unwrap_or(50).min(200);
    let offset = params.offset.unwrap_or(0).max(0);

    // Aggregate across all pools per player, rank by total
    let rows: Vec<(String, Decimal, Decimal, Decimal, Decimal)> = sqlx::query_as(
        r#"
        SELECT
            player,
            COALESCE(SUM(CASE WHEN pool = 'vision' THEN total ELSE 0 END), 0) as vision,
            COALESCE(SUM(CASE WHEN pool = 'index_creator' THEN total ELSE 0 END), 0) as creator,
            COALESCE(SUM(CASE WHEN pool = 'index_holder' THEN total ELSE 0 END), 0) as holder,
            COALESCE(SUM(total), 0) as grand_total
        FROM points_totals
        GROUP BY player
        ORDER BY grand_total DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch leaderboard: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let entries: Vec<LeaderboardEntry> = rows
        .into_iter()
        .enumerate()
        .map(|(i, (player, vision, creator, holder, total))| LeaderboardEntry {
            rank: (offset + i as i64 + 1),
            player,
            vision: vision.to_f64().unwrap_or(0.0),
            index_creator: creator.to_f64().unwrap_or(0.0),
            index_holder: holder.to_f64().unwrap_or(0.0),
            total: total.to_f64().unwrap_or(0.0),
        })
        .collect();

    Ok(Json(PointsLeaderboard {
        entries,
        updated_at: Utc::now().to_rfc3339(),
    }))
}

// ── Background loop ───────────────────────────────────────────────────────

/// Main points engine loop. Runs forever.
///
/// - Every 30s: polls oracle for settled rounds, awards vision points
/// - Every hour (at :00): awards index creator + holder points
pub async fn run(pool: PgPool, chain_cache: Arc<ChainCache>, oracle_url: String) {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    // Track which rounds we've seen as settled
    let mut processed_rounds: std::collections::HashSet<i64> = std::collections::HashSet::new();

    // Pre-load already processed rounds from DB
    let existing: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT reason FROM points_ledger WHERE pool = 'vision' AND reason LIKE 'vision:round:%'",
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    for (reason,) in existing {
        if let Some(id_str) = reason.strip_prefix("vision:round:") {
            if let Ok(id) = id_str.parse::<i64>() {
                processed_rounds.insert(id);
            }
        }
    }

    info!(
        already_processed = processed_rounds.len(),
        "Points engine started"
    );

    let mut last_hourly_run: Option<u32> = None;
    let mut last_backup_hour: Option<u32> = None;
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));

    // Run initial backup on startup
    if let Err(e) = backup_points_to_csv(&pool).await {
        warn!(error = %e, "Initial points backup failed");
    }

    loop {
        interval.tick().await;

        // ── CSV backup every 4 hours ──
        let current_hour = Utc::now().hour();
        if current_hour % BACKUP_INTERVAL_HOURS == 0 && last_backup_hour != Some(current_hour) {
            last_backup_hour = Some(current_hour);
            if let Err(e) = backup_points_to_csv(&pool).await {
                error!(error = %e, "Points CSV backup failed");
            }
        }

        // ── Vision: check for newly settled rounds ──
        match fetch_settled_rounds(&client, &oracle_url).await {
            Ok(rounds) => {
                let rounds_last_hour = rounds.len() as u64;
                for round in rounds {
                    if processed_rounds.contains(&round.batch_id) {
                        continue;
                    }

                    match process_settled_round(
                        &pool,
                        &oracle_url,
                        &client,
                        round.batch_id,
                        rounds_last_hour,
                    )
                    .await
                    {
                        Ok(n) => {
                            processed_rounds.insert(round.batch_id);
                            if n > 0 {
                                debug!(batch_id = round.batch_id, awards = n, "Round processed");
                            }
                        }
                        Err(e) => {
                            warn!(batch_id = round.batch_id, error = %e, "Failed to process round");
                        }
                    }
                }
            }
            Err(e) => {
                warn!(error = %e, "Failed to fetch settled rounds");
            }
        }

        // ── Index: hourly cron at :00 ──
        if last_hourly_run != Some(current_hour) {
            last_hourly_run = Some(current_hour);

            // Creator points
            if let Err(e) = award_creator_points(&pool, &chain_cache).await {
                error!(error = %e, "Failed to award creator points");
            }

            // Holder points
            if let Err(e) = award_holder_points(&pool, &chain_cache).await {
                error!(error = %e, "Failed to award holder points");
            }
        }
    }
}

/// Fetch recently settled rounds from oracle.
/// Returns rounds settled in the last hour for budget estimation.
async fn fetch_settled_rounds(
    client: &reqwest::Client,
    oracle_url: &str,
) -> Result<Vec<OracleRound>, Box<dyn std::error::Error + Send + Sync>> {
    // Try the rounds endpoint first
    let url = format!("{}/vision/rounds/active", oracle_url);
    let resp = client.get(&url).send().await?;

    if !resp.status().is_success() {
        // Fall back to batches endpoint
        let url2 = format!("{}/vision/batches", oracle_url);
        let resp2 = client.get(&url2).send().await?;
        if !resp2.status().is_success() {
            return Err(format!("Oracle returned {}", resp2.status()).into());
        }
        let data: serde_json::Value = resp2.json().await?;
        let batches = data["batches"].as_array().cloned().unwrap_or_default();
        let rounds: Vec<OracleRound> = batches
            .into_iter()
            .filter_map(|b| serde_json::from_value(b).ok())
            .filter(|r: &OracleRound| {
                r.settled_at.is_some()
                    || r.status.as_deref() == Some("settled")
            })
            .collect();
        return Ok(rounds);
    }

    let data: serde_json::Value = resp.json().await?;
    let rounds_arr = data["rounds"].as_array().cloned().unwrap_or_default();

    // Also fetch settled rounds — active endpoint only returns non-settled
    let settled_url = format!("{}/vision/batches?include_settled=true", oracle_url);
    let settled_resp = client.get(&settled_url).send().await;
    let mut all_rounds: Vec<OracleRound> = Vec::new();

    // Parse active rounds
    for r in rounds_arr {
        if let Ok(round) = serde_json::from_value::<OracleRound>(r) {
            if round.settled_at.is_some() || round.status.as_deref() == Some("settled") {
                all_rounds.push(round);
            }
        }
    }

    // Parse settled batches if available
    if let Ok(resp) = settled_resp {
        if resp.status().is_success() {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                let batches = data["batches"].as_array().cloned().unwrap_or_default();
                for b in batches {
                    if let Ok(round) = serde_json::from_value::<OracleRound>(b) {
                        if round.settled_at.is_some()
                            || round.status.as_deref() == Some("settled")
                        {
                            // Deduplicate
                            if !all_rounds.iter().any(|r| r.batch_id == round.batch_id) {
                                all_rounds.push(round);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(all_rounds)
}
