//! Points system — 10,000 pts/day across three pools.
//!
//! - Vision (5,000/day): hourly, proportional to deposit size across active batches
//! - Index Creator (2,500/day): hourly, ranked by ITP NAV growth, 0.7x exponential decay
//! - Index Holder (2,500/day): hourly, ranked by weighted portfolio performance, 0.7x decay
//!
//! Vision points use live deposit data from the oracle's batch state endpoints.
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
const VISION_BUDGET_PER_HOUR: f64 = 5_000.0 / 24.0;

/// Index Creator pool: 2,500 pts/day = ~104.17 pts/hr
const CREATOR_BUDGET_PER_HOUR: f64 = 2_500.0 / 24.0;

/// Index Holder pool: 2,500 pts/day = ~104.17 pts/hr
const HOLDER_BUDGET_PER_HOUR: f64 = 2_500.0 / 24.0;

/// Exponential decay factor for ranked distributions
const DECAY_FACTOR: f64 = 0.7;

// ── Oracle batch types ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OracleBatchSummary {
    id: u64,
    #[serde(default)]
    player_count: usize,
}

#[derive(Debug, Deserialize)]
struct OracleBatchesResponse {
    batches: Vec<OracleBatchSummary>,
}

#[derive(Debug, Deserialize)]
struct OracleBatchState {
    #[serde(default)]
    players: Vec<OracleBatchPlayer>,
}

#[derive(Debug, Deserialize)]
struct OracleBatchPlayer {
    address: String,
    /// Total deposit balance in wei (18 decimals)
    #[serde(default)]
    balance: String,
    /// Stake per tick in wei (18 decimals)
    #[serde(default)]
    stake_per_tick: String,
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

/// Award vision points for the current hour based on deposits in active batches.
/// Polls all active batches from the oracle, sums each player's deposits,
/// and distributes VISION_BUDGET_PER_HOUR proportionally.
async fn award_vision_points(
    pool: &PgPool,
    oracle_url: &str,
    client: &reqwest::Client,
) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    let hour_key = Utc::now().format("%Y-%m-%dT%H").to_string();
    let reason = format!("vision:hourly:{}", hour_key);

    // Check idempotency
    let existing: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM points_ledger WHERE reason = $1 AND pool = 'vision'",
    )
    .bind(&reason)
    .fetch_one(pool)
    .await?;

    if existing.0 > 0 {
        debug!(hour = %hour_key, "Vision points already awarded this hour");
        return Ok(0);
    }

    // Fetch all active batches from oracle
    let url = format!("{}/vision/batches", oracle_url);
    let resp = client.get(&url).send().await?;
    if !resp.status().is_success() {
        return Err(format!("Oracle returned {} for batches", resp.status()).into());
    }

    let batches_resp: OracleBatchesResponse = resp.json().await?;
    let active_batches: Vec<&OracleBatchSummary> = batches_resp
        .batches
        .iter()
        .filter(|b| b.player_count > 0)
        .collect();

    if active_batches.is_empty() {
        debug!("No active batches with players, skipping vision points");
        return Ok(0);
    }

    // For each batch with players, fetch state to get deposit amounts
    let mut player_deposits: HashMap<String, f64> = HashMap::new();

    for batch in &active_batches {
        let state_url = format!("{}/vision/batch/{}/state", oracle_url, batch.id);
        let state_resp = match client.get(&state_url).send().await {
            Ok(r) if r.status().is_success() => r,
            Ok(r) => {
                debug!(batch_id = batch.id, status = %r.status(), "Skipping batch state fetch");
                continue;
            }
            Err(e) => {
                debug!(batch_id = batch.id, error = %e, "Failed to fetch batch state");
                continue;
            }
        };

        let state: OracleBatchState = match state_resp.json().await {
            Ok(s) => s,
            Err(e) => {
                debug!(batch_id = batch.id, error = %e, "Failed to parse batch state");
                continue;
            }
        };

        for player in &state.players {
            // Use balance (total deposit) or fall back to stake_per_tick
            let deposit_str = if !player.balance.is_empty() && player.balance != "0" {
                &player.balance
            } else {
                &player.stake_per_tick
            };
            let deposit = parse_wei_to_f64(deposit_str);
            if deposit > 0.0 {
                *player_deposits
                    .entry(player.address.to_lowercase())
                    .or_insert(0.0) += deposit;
            }
        }
    }

    if player_deposits.is_empty() {
        debug!("No player deposits found across active batches");
        return Ok(0);
    }

    // Total deposits across all players
    let total_deposited: f64 = player_deposits.values().sum();
    if total_deposited <= 0.0 {
        return Ok(0);
    }

    // Distribute proportionally to deposits
    let awards: Vec<_> = player_deposits
        .iter()
        .map(|(player, deposit)| {
            let share = deposit / total_deposited;
            let pts = VISION_BUDGET_PER_HOUR * share;
            (
                player.clone(),
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
            hour = %hour_key,
            batches = active_batches.len(),
            players = player_deposits.len(),
            total_tvl = format!("{:.2}", total_deposited),
            "Vision points awarded"
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

    // For ITPs without meta, seed them now from chain cache.
    // All ITPs start at $1 (1.0) by design — use that as creation NAV.
    for (itp_id, cached) in &itp_states.states {
        if !meta_map.contains_key(itp_id) {
            let creator_addr = format!("{:?}", cached.creator).to_lowercase();
            if ensure_itp_meta(pool, itp_id, &creator_addr, 1.0).await? {
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

    // Compute NAV growth per ITP, then aggregate best growth per creator
    let mut creator_best_growth: HashMap<String, f64> = HashMap::new();

    for (itp_id, creator, nav_at_creation) in &meta_rows {
        let nav_creation = nav_at_creation.to_f64().unwrap_or(1.0);
        if nav_creation <= 0.0 {
            continue;
        }

        let current_nav = match nav_lookup.get(itp_id) {
            Some(&nav) => nav,
            None => continue,
        };

        let growth = (current_nav - nav_creation) / nav_creation;
        if growth > 0.0 {
            let entry = creator_best_growth
                .entry(creator.to_lowercase())
                .or_insert(0.0);
            if growth > *entry {
                *entry = growth;
            }
        }
    }

    if creator_best_growth.is_empty() {
        debug!("No creators with positive ITP growth, skipping creator points");
        return Ok(0);
    }

    // Sort creators by best growth descending
    let mut ranked: Vec<(String, f64)> = creator_best_growth.into_iter().collect();
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let awards = distribute_ranked(
        &ranked.iter().map(|(c, _)| c.clone()).collect::<Vec<_>>(),
        CREATOR_BUDGET_PER_HOUR,
        &reason,
        "index_creator",
    );

    let inserted = award_points(pool, &awards).await?;
    if inserted > 0 {
        info!(
            hour = %hour_key,
            eligible_creators = ranked.len(),
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
/// All three pools award hourly at :00.
pub async fn run(pool: PgPool, chain_cache: Arc<ChainCache>, oracle_url: String) {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default();

    // One-time fix: reset itp_meta.nav_at_creation to 1.0 (all ITPs start at $1).
    // Earlier seeding incorrectly used the current NAV at seeding time.
    match sqlx::query("UPDATE itp_meta SET nav_at_creation = 1.0 WHERE nav_at_creation != 1.0")
        .execute(&pool)
        .await
    {
        Ok(r) if r.rows_affected() > 0 => {
            info!(fixed = r.rows_affected(), "Reset itp_meta nav_at_creation to $1");
        }
        Err(e) => warn!(error = %e, "Failed to reset itp_meta nav_at_creation"),
        _ => {}
    }

    info!("Points engine started");

    let mut last_hourly_run: Option<u32> = None;
    let mut last_backup_hour: Option<u32> = None;
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));

    // Run initial backup on startup
    if let Err(e) = backup_points_to_csv(&pool).await {
        warn!(error = %e, "Initial points backup failed");
    }

    loop {
        interval.tick().await;

        let current_hour = Utc::now().hour();

        // ── CSV backup every 4 hours ──
        if current_hour % BACKUP_INTERVAL_HOURS == 0 && last_backup_hour != Some(current_hour) {
            last_backup_hour = Some(current_hour);
            if let Err(e) = backup_points_to_csv(&pool).await {
                error!(error = %e, "Points CSV backup failed");
            }
        }

        // ── All pools: hourly cron at :00 ──
        if last_hourly_run != Some(current_hour) {
            last_hourly_run = Some(current_hour);

            // Vision points (deposit-proportional across active batches)
            if let Err(e) = award_vision_points(&pool, &oracle_url, &client).await {
                error!(error = %e, "Failed to award vision points");
            }

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

