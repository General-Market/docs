//! Vision REST API endpoints
//!
//! Provides HTTP endpoints for the Vision prediction market subsystem.
//! These endpoints serve both Postgres-backed batch/history data and
//! in-memory bitmap/balance state.
//!
//! ## Endpoints
//!
//! **From Postgres (batch/history queries):**
//! - `GET /vision/batches` - List active batches with player count + TVL
//! - `GET /vision/batch/:id/state` - Single batch state
//! - `GET /vision/batch/:id/history` - Tick results (last 100)
//! - `POST /vision/backtest` - Strategy backtest (bitmap simulation)
//! - `GET /vision/leaderboard` - Player rankings by PnL
//! - `GET /vision/player/:address/profile` - Display-ready player profile
//!
//! **Round-based aliases (E2E test compatibility):**
//! - `GET /vision/rounds/active` - Active rounds (alias for batches, filtered)
//! - `GET /vision/rounds/:id/results` - Round results after settlement
//! - `GET /vision/rounds/:id/bitmaps` - Decoded bitmaps for a settled round
//! - `GET /vision/player/:address/rounds` - Player's round history
//!
//! **From in-memory state (bitmap/balance):**
//! - `POST /vision/bitmap` - Player submits bitmap
//! - `GET /vision/balance/:batch_id/:player` - BLS-signed balance proof
//! - `GET /vision/reveal/:batch_id/:tick_id` - Published bitmaps after reveal window
//! - `GET /vision/markets` - Oracle-curated market whitelist

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Json;
use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use common::types::P2PMessage;

use super::bitmap_store::BitmapStore;
use super::config::VisionConfig;
use super::tick_scheduler::TickScheduler;

/// Shared state for Vision API handlers.
pub struct VisionState {
    /// Postgres connection pool for batch/history queries.
    pub pool: sqlx::PgPool,
    /// Tick scheduler: tracks active batches and players in memory.
    pub scheduler: Arc<TickScheduler>,
    /// In-memory bitmap store for player predictions.
    pub bitmap_store: Arc<BitmapStore>,
    /// Vision subsystem configuration.
    pub config: VisionConfig,
    /// Optional P2P broadcast channel for bitmap gossip.
    /// When Some, a BitmapGossip message is broadcast to peers on every
    /// accepted bitmap so all oracles converge on the same bitmap set.
    pub broadcast_tx: Option<tokio::sync::mpsc::Sender<P2PMessage>>,
    // TODO: Add TickResolver when Task 3.6 is complete
    // pub resolver: Arc<TickResolver>,
    // TODO: Add BLS signer for balance proofs
    // pub bls_signer: ...,
}

/// Decode a bytes32 hex string (e.g. "0x636f696e6765636b6f00...") to a UTF-8 string,
/// stripping trailing null bytes. Returns the hex as-is if decoding fails.
///
/// **Why this exists:** On-chain, `sourceId` is stored as `keccak256(name + "_" + version)` —
/// a lossy hash that only round-trips for short ASCII strings fitting in 32 bytes.
/// The `vision_batch_lifecycle` table stores the plain-text source name, but batches
/// discovered via `chain_listener.rs` (BatchCreated events) are written to `vision_batches`
/// only — they never get a lifecycle row. This fallback decodes the raw hex for those
/// orphan batches. It will produce garbage for actual keccak hashes (by design — the
/// caller gets a hex string back, which is better than nothing).
fn bytes32_hex_to_string(hex: &str) -> String {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    if let Ok(bytes) = hex::decode(hex) {
        let trimmed: Vec<u8> = bytes.into_iter().take_while(|&b| b != 0).collect();
        String::from_utf8(trimmed).unwrap_or_else(|_| format!("0x{hex}"))
    } else {
        format!("0x{hex}")
    }
}

/// Encode a UTF-8 string to a 0x-prefixed bytes32 hex string (right-padded with zeros).
/// Inverse of `bytes32_hex_to_string`.
fn string_to_bytes32_hex(s: &str) -> String {
    let mut buf = [0u8; 32];
    let bytes = s.as_bytes();
    let len = bytes.len().min(32);
    buf[..len].copy_from_slice(&bytes[..len]);
    format!("0x{}", hex::encode(buf))
}

/// Build the axum router for all Vision API endpoints.
pub fn routes(state: Arc<VisionState>) -> axum::Router {
    axum::Router::new()
        .route("/vision/batches", get(list_batches))
        .route("/vision/batch/:id/state", get(batch_state))
        .route("/vision/bitmap", post(submit_bitmap))
        .route("/vision/markets", get(markets))
        .route("/vision/leaderboard", get(vision_leaderboard))
        .route("/vision/player/:address/profile", get(player_profile))
        .route("/vision/source/:source_id/history", get(source_batch_history))
        // Round-based aliases for E2E test compatibility
        .route("/vision/rounds/active", get(rounds_active))
        .route("/vision/rounds/:id/results", get(round_results))
        .route("/vision/rounds/:id/bitmaps", get(round_bitmaps))
        .route("/vision/player/:address/rounds", get(player_rounds))
        .route("/vision/points", get(vision_points))
        .route("/vision/points/:address", get(vision_points_player))
        .with_state(state)
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Summary of a single batch for the list endpoint.
#[derive(Debug, Serialize)]
pub struct BatchSummary {
    pub id: u64,
    pub creator: String,
    pub source_id: String,
    pub config_hash: String,
    pub tick_duration: u64,
    pub player_count: usize,
    pub tvl: String,
    pub paused: bool,
    pub current_tick: u64,
    pub market_count: usize,
}

/// Full batch state response.
#[derive(Debug, Serialize)]
pub struct BatchStateResponse {
    pub id: u64,
    pub creator: String,
    pub source_id: String,
    pub config_hash: String,
    pub tick_duration: u64,
    pub created_at_tick: u64,
    pub paused: bool,
    pub player_count: usize,
    pub next_tick: u64,
    pub players: Vec<PlayerInfo>,
}

/// Player info within a batch state response.
#[derive(Debug, Serialize)]
pub struct PlayerInfo {
    pub address: String,
    pub stake_per_tick: String,
    pub balance: String,
    pub start_tick: u64,
    pub has_bitmap: bool,
}

/// A tick result entry for the history endpoint.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickHistoryEntry {
    pub batch_id: i64,
    pub tick_id: i64,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    pub player_count: Option<i32>,
    pub total_matched: Option<String>,
    pub market_outcomes: Option<serde_json::Value>,
}

/// Request body for bitmap submission.
#[derive(Debug, Deserialize)]
pub struct SubmitBitmapRequest {
    /// Player's Ethereum address.
    pub player: String,
    /// Batch ID the bitmap is for.
    pub batch_id: u64,
    /// Raw bitmap bytes (hex-encoded).
    pub bitmap_hex: String,
    /// Expected keccak256 hash of the bitmap (must match on-chain commitment).
    pub expected_hash: String,
}

/// Response after successful bitmap submission.
#[derive(Debug, Serialize)]
pub struct SubmitBitmapResponse {
    pub accepted: bool,
    pub batch_id: u64,
    pub player: String,
}

/// Balance proof response with BLS signature for on-chain verification.
#[derive(Debug, Serialize)]
pub struct BalanceResponse {
    pub batch_id: u64,
    pub player: String,
    pub balance: String,
    pub stake_per_tick: String,
    /// BLS signature (hex-encoded, 128 chars = 64 bytes G1 point).
    /// Empty string if proof not yet generated (oracle just started, tick not resolved).
    pub bls_sig: String,
    /// Signer bitmap (decimal string, uint256). Bit at node_index is set.
    pub signer_bitmap: String,
    /// Tick ID at which this proof was generated (latest resolved tick for this player).
    /// 0 if proof not yet available.
    pub tick_id: u64,
}

/// Revealed bitmap for a player after the reveal window has passed.
#[derive(Debug, Serialize)]
pub struct RevealedBitmap {
    pub player: String,
    pub bitmap_hex: String,
    pub hash: String,
}

/// A market in the oracle-curated whitelist.
#[derive(Debug, Serialize)]
pub struct MarketInfo {
    pub market_id: String,
    pub symbol: String,
    pub display_name: String,
}

/// Standard API error response.
#[derive(Debug, Serialize)]
struct ApiError {
    error: String,
}

impl ApiError {
    fn new(msg: impl Into<String>) -> Self {
        Self {
            error: msg.into(),
        }
    }
}

// ---------------------------------------------------------------------------
// GET /vision/batches
// ---------------------------------------------------------------------------

/// List all active batches with player count and TVL.
///
/// Reads from the in-memory tick scheduler for live data, with optional
/// Postgres fallback for historical batches.
async fn list_batches(
    State(state): State<Arc<VisionState>>,
) -> impl IntoResponse {
    // Read active batches from the in-memory scheduler.
    // The scheduler holds all known batches synced from chain events.
    //
    // For a production implementation, we would also query Postgres for
    // completed/archived batches. For now, we return in-memory state only.

    // We need to collect batch info from the scheduler. Since the scheduler
    // exposes get_batch() and player_count() per ID, but not an "all batches"
    // iterator, we query Postgres for batch IDs and then enrich with live data.

    let rows = sqlx::query_as::<_, BatchRow>(
        "SELECT id, creator, tick_duration, paused, source_id, config_hash
         FROM vision_batches
         WHERE paused = false
         ORDER BY id DESC
         LIMIT 100"
    )
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(rows) => {
            // Build batch_id → (source_id, market_count, player_count) from vision_batch_lifecycle
            // (persisted at creation with plain text source names)
            let mut lifecycle_counts: std::collections::HashMap<u64, usize> = std::collections::HashMap::new();
            let mut lifecycle_sources: std::collections::HashMap<u64, String> = std::collections::HashMap::new();
            let mut lifecycle_player_counts: std::collections::HashMap<u64, usize> = std::collections::HashMap::new();
            if let Ok(lc_rows) = sqlx::query_as::<_, (i64, String, Option<i32>, Option<i32>)>(
                "SELECT batch_id, source_id, market_count, player_count FROM vision_batch_lifecycle"
            )
            .fetch_all(&state.pool)
            .await
            {
                for (bid, src, mc, pc) in lc_rows {
                    lifecycle_sources.insert(bid as u64, src);
                    if let Some(count) = mc {
                        lifecycle_counts.insert(bid as u64, count as usize);
                    }
                    if let Some(count) = pc {
                        lifecycle_player_counts.insert(bid as u64, count as usize);
                    }
                }
            }
            let recommended_counts = fetch_market_counts(&state.config.data_node_url).await;

            let mut summaries = Vec::with_capacity(rows.len());
            for row in rows {
                let batch_id = row.id as u64;
                // Enrich with live player count from scheduler.
                // Fall back to vision_batch_lifecycle.player_count when the scheduler
                // returns 0 (e.g. after settlement zeroes balances and oracle restarts).
                let live_count = state.scheduler.player_count(batch_id).await;
                let player_count = if live_count > 0 {
                    live_count
                } else {
                    lifecycle_player_counts.get(&batch_id).copied().unwrap_or(0)
                };

                // Compute TVL from in-memory player positions
                let tvl = if let Some((_batch, players)) =
                    state.scheduler.get_batch_state(batch_id).await
                {
                    players
                        .iter()
                        .fold(U256::zero(), |acc, p| acc + p.deposit)
                } else {
                    U256::zero()
                };

                let current_tick = 0;

                let config_hash_str = row.config_hash.clone().unwrap_or_default();
                let market_count = lifecycle_counts
                    .get(&batch_id)
                    .copied()
                    .or_else(|| recommended_counts.get(&config_hash_str).copied())
                    .unwrap_or(0);

                // Prefer plain-text source name from lifecycle table;
                // fall back to decoding the on-chain bytes32 for batches that
                // lack a lifecycle row (discovered via chain_listener events,
                // or created before lifecycle tracking existed).
                let source_id = lifecycle_sources
                    .get(&batch_id)
                    .cloned()
                    .unwrap_or_else(|| bytes32_hex_to_string(&row.source_id.unwrap_or_default()));

                summaries.push(BatchSummary {
                    id: batch_id,
                    creator: row.creator,
                    source_id,
                    config_hash: config_hash_str,
                    tick_duration: row.tick_duration as u64,
                    player_count,
                    tvl: tvl.to_string(),
                    paused: row.paused,
                    current_tick,
                    market_count,
                });
            }
            (StatusCode::OK, Json(serde_json::json!({ "batches": summaries }))).into_response()
        }
        Err(e) => {
            warn!("Failed to query batches from Postgres: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(format!("Database error: {e}"))),
            )
                .into_response()
        }
    }
}

/// Fetch market counts per config_hash from the data-node recommended batches endpoint.
async fn fetch_market_counts(data_node_url: &str) -> std::collections::HashMap<String, usize> {
    use super::batch_config_orchestrator;
    let mut counts = std::collections::HashMap::new();
    match batch_config_orchestrator::fetch_recommended(data_node_url).await {
        Ok(batches) => {
            for batch in batches {
                counts.insert(batch.config_hash, batch.markets.len());
            }
        }
        Err(e) => {
            warn!("Failed to fetch recommended batches for market counts: {e}");
        }
    }
    counts
}

/// Row type for batch queries from Postgres.
#[derive(Debug, sqlx::FromRow)]
struct BatchRow {
    id: i64,
    creator: String,
    tick_duration: i64,
    paused: bool,
    source_id: Option<String>,
    config_hash: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /vision/batch/:id/state
// ---------------------------------------------------------------------------

/// Get full state for a single batch.
async fn batch_state(
    State(state): State<Arc<VisionState>>,
    Path(id): Path<u64>,
) -> impl IntoResponse {
    let batch_data = state.scheduler.get_batch_state(id).await;

    match batch_data {
        Some((batch, players)) => {
            let next_tick = 0;

            let mut player_infos = Vec::with_capacity(players.len());
            for p in &players {
                let has_bitmap = state.bitmap_store.get_pending(id, p.player).await.is_some()
                    || state.bitmap_store.get_active(id, p.player).await.is_some();
                player_infos.push(PlayerInfo {
                    address: format!("{:?}", p.player),
                    stake_per_tick: p.deposit.to_string(),
                    balance: p.deposit.to_string(),
                    start_tick: 0,
                    has_bitmap,
                });
            }

            // Prefer plain-text source name from lifecycle table.
            // Fallback: batches without lifecycle rows (chain_listener discovery path).
            let lifecycle_source: Option<String> = sqlx::query_scalar(
                "SELECT source_id FROM vision_batch_lifecycle WHERE batch_id = $1"
            )
            .bind(id as i64)
            .fetch_optional(&state.pool)
            .await
            .ok()
            .flatten();
            let source_id = lifecycle_source
                .unwrap_or_else(|| bytes32_hex_to_string(&format!("{:?}", batch.source_id)));

            let response = BatchStateResponse {
                id: batch.id,
                creator: format!("{:?}", batch.creator),
                source_id,
                config_hash: format!("{:?}", batch.config_hash),
                tick_duration: batch.tick_duration,
                created_at_tick: batch.created_at_tick,
                paused: batch.paused,
                player_count: players.len(),
                next_tick,
                players: player_infos,
            };

            (StatusCode::OK, Json(response)).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(ApiError::new(format!("Batch {id} not found"))),
        )
            .into_response(),
    }
}

// ---------------------------------------------------------------------------
// GET /vision/batch/:id/history
// ---------------------------------------------------------------------------

/// Get tick result history for a batch (last 100 ticks).
async fn batch_history(
    State(state): State<Arc<VisionState>>,
    Path(id): Path<u64>,
) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, TickResultRow>(
        "SELECT batch_id, tick_id, resolved_at, player_count, total_matched, results_json
         FROM vision_tick_results
         WHERE batch_id = $1
         ORDER BY tick_id DESC
         LIMIT 100"
    )
    .bind(id as i64)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(rows) => {
            let entries: Vec<TickHistoryEntry> = rows
                .into_iter()
                .map(|r| TickHistoryEntry {
                    batch_id: r.batch_id,
                    tick_id: r.tick_id,
                    resolved_at: r.resolved_at,
                    player_count: r.player_count,
                    total_matched: r.total_matched,
                    market_outcomes: r.results_json,
                })
                .collect();
            (StatusCode::OK, Json(entries)).into_response()
        }
        Err(e) => {
            warn!("Failed to query tick history for batch {id}: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(format!("Database error: {e}"))),
            )
                .into_response()
        }
    }
}

/// Row type for tick result queries from Postgres.
#[derive(Debug, sqlx::FromRow)]
struct TickResultRow {
    batch_id: i64,
    tick_id: i64,
    resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    player_count: Option<i32>,
    total_matched: Option<String>,
    results_json: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// POST /vision/backtest
// ---------------------------------------------------------------------------

/// Request body for backtest.
#[derive(Debug, Deserialize)]
struct BacktestRequest {
    batch_id: u64,
    /// Packed bitmap in hex (e.g. "0xab01..."). If absent, `code` is ignored.
    bitmap_hex: Option<String>,
    /// Python strategy code (ignored server-side — run preview via Pyodide first).
    #[serde(default)]
    #[allow(dead_code)]
    code: Option<String>,
    /// Number of simulated ticks (default: 50).
    ticks: Option<u64>,
}

#[derive(Debug, Serialize)]
struct BacktestResultResponse {
    win_rate: f64,
    pnl_curve: Vec<PnlPoint>,
    total_pnl: f64,
}

#[derive(Debug, Serialize)]
struct PnlPoint {
    tick: u64,
    pnl: f64,
}

/// Backtest a bitmap against simulated market outcomes.
///
/// Accepts a packed bitmap and simulates N ticks using deterministic
/// pseudo-random market movements. Returns win rate and PnL curve.
async fn backtest(
    State(state): State<Arc<VisionState>>,
    Json(req): Json<BacktestRequest>,
) -> impl IntoResponse {
    let ticks = req.ticks.unwrap_or(50).min(200);

    // Get batch info from scheduler
    let batch = match state.scheduler.get_batch(req.batch_id).await {
        Some(b) => b,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiError::new(format!("Batch {} not found", req.batch_id))),
            )
                .into_response();
        }
    };

    // Parse bitmap
    let bitmap_hex = match &req.bitmap_hex {
        Some(h) => h.clone(),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiError::new("bitmap_hex required — run preview first to generate bitmap")),
            )
                .into_response();
        }
    };

    let bitmap = match hex::decode(bitmap_hex.trim_start_matches("0x")) {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiError::new(format!("Invalid bitmap_hex: {e}"))),
            )
                .into_response();
        }
    };

    // Use config_hash as seed for deterministic market simulation.
    // In a full implementation, this would fetch the actual market config
    // from the data-node to get market_ids. For now, use a fixed market_count
    // derived from the bitmap length or a default.
    let market_count = bitmap.len() * 8; // each byte = 8 markets
    if market_count == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiError::new("Batch has no markets (empty bitmap)")),
        )
            .into_response();
    }

    // Simulate ticks with deterministic PRNG based on config_hash + tick
    let mut pnl_curve = Vec::with_capacity(ticks as usize);
    let mut cumulative_pnl = 0.0_f64;
    let mut total_wins = 0u64;
    let mut total_markets = 0u64;

    for tick in 0..ticks {
        let mut tick_wins = 0u64;

        for i in 0..market_count {
            // Deterministic outcome from config_hash + market_index + tick
            let mut seed_bytes = [0u8; 44];
            seed_bytes[..32].copy_from_slice(batch.config_hash.as_bytes());
            seed_bytes[32..36].copy_from_slice(&(i as u32).to_le_bytes());
            seed_bytes[36..44].copy_from_slice(&tick.to_le_bytes());
            let seed_hash = ethers::utils::keccak256(&seed_bytes);
            let market_went_up = seed_hash[0] & 1 == 0; // 50/50 split

            // User's bet from bitmap
            let byte_idx = i / 8;
            let bit_idx = 7 - (i % 8);
            let user_bet_up = if byte_idx < bitmap.len() {
                (bitmap[byte_idx] >> bit_idx) & 1 == 1
            } else {
                false
            };

            if user_bet_up == market_went_up {
                tick_wins += 1;
            }
            total_markets += 1;
        }

        total_wins += tick_wins;
        // PnL per tick: normalized to ±1 USDC range
        // wins get proportional share, losses pay proportional share
        let win_pct = tick_wins as f64 / market_count as f64;
        let tick_pnl = (win_pct - 0.5) * 2.0; // -1 to +1
        cumulative_pnl += tick_pnl;

        pnl_curve.push(PnlPoint {
            tick,
            pnl: (cumulative_pnl * 1000.0).round() / 1000.0,
        });
    }

    let win_rate = if total_markets > 0 {
        total_wins as f64 / total_markets as f64
    } else {
        0.0
    };

    (
        StatusCode::OK,
        Json(BacktestResultResponse {
            win_rate: (win_rate * 10000.0).round() / 10000.0,
            pnl_curve,
            total_pnl: (cumulative_pnl * 1000.0).round() / 1000.0,
        }),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// POST /vision/bitmap
// ---------------------------------------------------------------------------

/// Player submits their prediction bitmap off-chain.
///
/// The bitmap is verified against its keccak256 hash, which must match
/// the player's on-chain commitment hash. If verification passes, the
/// bitmap is stored in memory for use during tick resolution.
async fn submit_bitmap(
    State(state): State<Arc<VisionState>>,
    Json(req): Json<SubmitBitmapRequest>,
) -> impl IntoResponse {
    // Parse player address
    let player: Address = match req.player.parse() {
        Ok(addr) => addr,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiError::new(format!("Invalid player address: {e}"))),
            )
                .into_response();
        }
    };

    // Parse bitmap from hex
    let bitmap = match hex::decode(req.bitmap_hex.trim_start_matches("0x")) {
        Ok(bytes) => bytes,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiError::new(format!("Invalid bitmap hex: {e}"))),
            )
                .into_response();
        }
    };

    // Parse expected hash
    let expected_hash: H256 = match req.expected_hash.parse() {
        Ok(h) => h,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiError::new(format!("Invalid expected_hash: {e}"))),
            )
                .into_response();
        }
    };

    // Verify player is actually in this batch (check scheduler)
    let on_chain_hash = state
        .scheduler
        .get_player_bitmap_hash(req.batch_id, player)
        .await;

    match on_chain_hash {
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiError::new(format!(
                    "Player {:?} not found in batch {}",
                    player, req.batch_id
                ))),
            )
                .into_response();
        }
        Some(chain_hash) => {
            // Verify submitted hash matches on-chain commitment
            if chain_hash != expected_hash {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ApiError::new(format!(
                        "expected_hash {:?} does not match on-chain commitment {:?}",
                        expected_hash, chain_hash
                    ))),
                )
                    .into_response();
            }
        }
    }

    // Determine current config_hash and target tick for this bitmap
    let batch_config_hash = state.scheduler.get_batch(req.batch_id).await
        .map(|b| b.config_hash)
        .unwrap_or_default();
    let target_tick_id = 0;

    // Store the bitmap in pending slot (verifies hash, persists to DB)
    match state
        .bitmap_store
        .store_pending(player, req.batch_id, bitmap.clone(), expected_hash, batch_config_hash, target_tick_id)
        .await
    {
        Ok(()) => {
            // DB-first persistence is handled inside store_pending
            if let Err(e) = state.bitmap_store.persist_pending_to_db(
                &state.pool, req.batch_id, player,
                &state.bitmap_store.get_pending(req.batch_id, player).await.unwrap(),
            ).await {
                tracing::warn!(error = %e, "Failed to persist bitmap to DB");
            }

            // Gossip to peers so all oracles converge on the same bitmap set.
            if let Some(ref tx) = state.broadcast_tx {
                let gossip_msg = P2PMessage::BitmapGossip {
                    batch_id: req.batch_id,
                    player,
                    bitmap_hash: expected_hash,
                    config_hash: batch_config_hash,
                    target_tick_id,
                };
                if let Err(e) = tx.try_send(gossip_msg) {
                    warn!(
                        player = ?player,
                        batch_id = req.batch_id,
                        error = %e,
                        "Failed to enqueue BitmapGossip for broadcast"
                    );
                }
            }

            info!(
                player = ?player,
                batch_id = req.batch_id,
                "Bitmap accepted"
            );
            (
                StatusCode::OK,
                Json(SubmitBitmapResponse {
                    accepted: true,
                    batch_id: req.batch_id,
                    player: format!("{:?}", player),
                }),
            )
                .into_response()
        }
        Err(e) => {
            warn!(
                player = ?player,
                batch_id = req.batch_id,
                error = %e,
                "Bitmap rejected"
            );
            (
                StatusCode::BAD_REQUEST,
                Json(ApiError::new(format!("Bitmap verification failed: {e}"))),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /vision/balance/:batch_id/:player
// ---------------------------------------------------------------------------

/// Get a player's BLS-signed balance proof for on-chain withdrawal.
///
/// Reads pre-generated proof from Postgres (generated at tick end by the engine).
/// Falls back to in-memory scheduler state with empty BLS sig if proof not yet stored.
async fn get_balance(
    State(state): State<Arc<VisionState>>,
    Path((batch_id, player_str)): Path<(u64, String)>,
) -> impl IntoResponse {
    let player: Address = match player_str.parse() {
        Ok(addr) => addr,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiError::new(format!("Invalid player address: {e}"))),
            )
                .into_response();
        }
    };

    let player_hex = format!("{:?}", player);

    // Try stored proof from DB first (has BLS signature, generated at tick end)
    if let Ok(Some(row)) = sqlx::query(
        "SELECT balance, bls_sig, signer_bitmap, tick_id
         FROM vision_balance_proofs
         WHERE batch_id = $1 AND LOWER(player) = LOWER($2)"
    )
    .bind(batch_id as i64)
    .bind(&player_hex)
    .fetch_optional(&state.pool)
    .await
    {
        use sqlx::Row;
        let balance: String = row.get("balance");
        let bls_sig: Vec<u8> = row.get("bls_sig");
        let signer_bitmap: String = row.get("signer_bitmap");
        let tick_id: i64 = row.get("tick_id");

        // Get stake_per_tick from in-memory state
        let stake = state.scheduler.get_batch_state(batch_id).await
            .and_then(|(_, players)| {
                players.iter().find(|p| p.player == player).map(|p| p.deposit.to_string())
            })
            .unwrap_or_else(|| "0".to_string());

        let response = BalanceResponse {
            batch_id,
            player: player_hex,
            balance,
            stake_per_tick: stake,
            bls_sig: hex::encode(&bls_sig),
            signer_bitmap,
            tick_id: tick_id as u64,
        };
        return (StatusCode::OK, Json(response)).into_response();
    }

    // Fall back to in-memory state (no BLS sig — proof not yet generated)
    let batch_state = state.scheduler.get_batch_state(batch_id).await;

    match batch_state {
        None => (
            StatusCode::NOT_FOUND,
            Json(ApiError::new(format!("Batch {batch_id} not found"))),
        )
            .into_response(),
        Some((_batch, players)) => {
            match players.iter().find(|p| p.player == player) {
                None => (
                    StatusCode::NOT_FOUND,
                    Json(ApiError::new(format!(
                        "Player {:?} not found in batch {batch_id}",
                        player
                    ))),
                )
                    .into_response(),
                Some(pos) => {
                    let response = BalanceResponse {
                        batch_id,
                        player: player_hex,
                        balance: pos.deposit.to_string(),
                        stake_per_tick: pos.deposit.to_string(),
                        bls_sig: String::new(),
                        signer_bitmap: "0".to_string(),
                        tick_id: 0,
                    };
                    (StatusCode::OK, Json(response)).into_response()
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// GET /vision/reveal/:batch_id/:tick_id
// ---------------------------------------------------------------------------

/// Get revealed bitmaps for a batch tick after the reveal window has passed.
///
/// Bitmaps are only published after the reveal window expires, so that
/// players cannot see opponents' predictions before committing their own.
async fn get_reveals(
    State(state): State<Arc<VisionState>>,
    Path((batch_id, tick_id)): Path<(u64, u64)>,
) -> impl IntoResponse {
    // Check that the reveal window has passed for this tick
    let batch = state.scheduler.get_batch(batch_id).await;

    match batch {
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ApiError::new(format!("Batch {batch_id} not found"))),
            )
                .into_response();
        }
        Some(batch) => {
            // Tick N ends at: (created_at_tick + tick_id + 1) * tick_duration
            let tick_end =
                (batch.created_at_tick + tick_id + 1) * batch.tick_duration;
            let reveal_deadline = tick_end + 600;

            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();

            if now < reveal_deadline {
                return (
                    StatusCode::FORBIDDEN,
                    Json(ApiError::new(format!(
                        "Reveal window not yet expired. Deadline: {reveal_deadline}, now: {now}"
                    ))),
                )
                    .into_response();
            }
        }
    }

    // Retrieve all bitmaps for this batch
    let bitmaps = state.bitmap_store.get_all_active_for_batch(batch_id).await;

    let revealed: Vec<RevealedBitmap> = bitmaps
        .into_iter()
        .map(|b| RevealedBitmap {
            player: format!("{:?}", b.player),
            bitmap_hex: format!("0x{}", hex::encode(&b.bitmap)),
            hash: format!("{:?}", b.hash),
        })
        .collect();

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "batch_id": batch_id,
            "tick_id": tick_id,
            "bitmaps": revealed,
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// GET /vision/markets
// ---------------------------------------------------------------------------

/// Get the oracle-curated market whitelist.
///
/// Returns the set of markets (price feeds) that this oracle supports
/// for Vision prediction batches. Batch creators must select from this
/// list when creating new batches.
async fn markets(
    State(_state): State<Arc<VisionState>>,
) -> impl IntoResponse {
    // TODO: Load market whitelist from configuration or data-node.
    // For now, return a static placeholder list of common crypto markets.
    // In production, this would be loaded from VisionConfig or queried
    // from the data-node's available price feeds.
    let market_list = vec![
        MarketInfo {
            market_id: "BTC-USD".into(),
            symbol: "BTC".into(),
            display_name: "Bitcoin / USD".into(),
        },
        MarketInfo {
            market_id: "ETH-USD".into(),
            symbol: "ETH".into(),
            display_name: "Ethereum / USD".into(),
        },
        MarketInfo {
            market_id: "SOL-USD".into(),
            symbol: "SOL".into(),
            display_name: "Solana / USD".into(),
        },
    ];

    (StatusCode::OK, Json(serde_json::json!({ "markets": market_list })))
}

// ---------------------------------------------------------------------------
// GET /vision/leaderboard
// ---------------------------------------------------------------------------

/// Vision player leaderboard entry.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LeaderboardEntry {
    rank: usize,
    wallet_address: String,
    pnl: f64,
    win_rate: f64,
    roi: f64,
    total_volume: f64,
    portfolio_bets: usize,
    avg_portfolio_size: f64,
    largest_portfolio: usize,
    rounds_played: u64,
    rounds_won: u64,
    avg_correct_pct: f64,
}

/// Query params for leaderboard filtering.
#[derive(Debug, Deserialize)]
struct LeaderboardQuery {
    batch_id: Option<u64>,
    source_id: Option<String>,
    /// Include settled round results from `vision_round_players`. Defaults to true.
    include_rounds: Option<bool>,
}

/// Aggregated per-player row from `vision_round_players`.
#[derive(Debug, sqlx::FromRow)]
struct RoundStatsRow {
    player: String,
    total_payout: Option<String>,
    total_deposited: Option<String>,
    wins: Option<String>,
    rounds_played: Option<i64>,
    total_correct: Option<i64>,
    total_markets: Option<i64>,
}

/// Vision leaderboard — aggregates player balances across batches.
///
/// Ranks players by current PnL (current_balance - initial_deposit).
/// Supports `?batch_id=N` for a single batch or `?source_id=X` for all
/// batches belonging to a source (including completed/paused ones).
async fn vision_leaderboard(
    State(state): State<Arc<VisionState>>,
    Query(query): Query<LeaderboardQuery>,
) -> impl IntoResponse {
    if let Some(bid) = query.batch_id {
        return leaderboard_from_postgres(&state.pool, None, Some(bid)).await;
    }

    // Per-source leaderboard: delegate to Postgres which JOINs vision_round_players
    // with vision_batches to filter by source_id. This covers both active and settled rounds.
    if let Some(ref source_id) = query.source_id {
        return leaderboard_from_postgres(&state.pool, Some(source_id.as_str()), None).await;
    }

    // player -> (total_balance, total_deposited, batches_joined, largest_batch_markets, batch_wins,
    //            rounds_played, rounds_won, total_correct, total_markets)
    let mut player_data: std::collections::HashMap<
        Address,
        (u128, u128, usize, usize, usize, u64, u64, u64, u64),
    > = std::collections::HashMap::new();

    // Round-only mode: use settled round results from Postgres as the SOLE data source.
    // The in-memory scheduler holds unsettled positions (deposit == initial_deposit → PnL=0),
    // which would pollute the leaderboard with phantom $0 entries.
    {
        let query = "SELECT player,
                SUM(payout::numeric)::text as total_payout,
                SUM(deposited::numeric)::text as total_deposited,
                SUM(CASE WHEN pnl::numeric > 0 THEN 1 ELSE 0 END)::text as wins,
                COUNT(*)::bigint as rounds_played,
                SUM(correct_count)::bigint as total_correct,
                SUM(total_markets)::bigint as total_markets
         FROM vision_round_players
         GROUP BY player";
        if let Ok(round_rows) = sqlx::query_as::<_, RoundStatsRow>(query)
        .fetch_all(&state.pool)
        .await
        {
            for row in round_rows {
                if let Ok(addr) = row.player.parse::<Address>() {
                    let entry = player_data
                        .entry(addr)
                        .or_insert((0, 0, 0, 0, 0, 0, 0, 0, 0));

                    // Payout = what the player received back
                    if let Some(ref p) = row.total_payout {
                        if let Ok(v) = p.parse::<u128>() {
                            entry.0 += v;
                        }
                    }
                    // Deposited = what the player put in
                    if let Some(ref d) = row.total_deposited {
                        if let Ok(v) = d.parse::<u128>() {
                            entry.1 += v;
                        }
                    }

                    let rp = row.rounds_played.unwrap_or(0) as u64;
                    let rw = row.wins.as_deref().unwrap_or("0").parse::<u64>().unwrap_or(0);

                    entry.2 += rp as usize;
                    entry.4 += rw as usize;
                    entry.5 += rp;
                    entry.6 += rw;
                    entry.7 += row.total_correct.unwrap_or(0) as u64;
                    entry.8 += row.total_markets.unwrap_or(0) as u64;
                }
            }
        }
    }

    let leaderboard = build_leaderboard_from_map(player_data);

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "leaderboard": leaderboard,
            "updatedAt": chrono::Utc::now().to_rfc3339(),
        })),
    )
        .into_response()
}

/// Row type for Postgres-based leaderboard queries.
#[derive(Debug, sqlx::FromRow)]
struct LeaderboardRow {
    player: String,
    total_balance: Option<String>,
    total_deposited: Option<String>,
    batches_joined: Option<i64>,
    wins: Option<i64>,
    total_correct: Option<i64>,
    total_markets: Option<i64>,
}

/// Build leaderboard from Postgres — used when source_id or batch_id filter is set.
/// Includes ALL batches (active + completed/paused) so historical data is visible.
async fn leaderboard_from_postgres(
    pool: &sqlx::PgPool,
    source_id: Option<&str>,
    batch_id: Option<u64>,
) -> axum::response::Response {
    let query = if let Some(sid) = source_id {
        // Round-only: per-source leaderboard from vision_round_players
        // JOIN vision_batch_lifecycle (plain source names) instead of vision_batches
        // (which stores keccak256 hashes that don't match frontend source IDs).
        // Sanitize sid to prevent SQL injection (alphanumeric + underscore only)
        let safe_sid = sid.chars().filter(|c| c.is_alphanumeric() || *c == '_').collect::<String>();
        format!(
            "SELECT vrp.player,
                    SUM(vrp.payout::numeric)::text as total_balance,
                    SUM(vrp.deposited::numeric)::text as total_deposited,
                    COUNT(*)::bigint as batches_joined,
                    SUM(CASE WHEN vrp.pnl::numeric > 0 THEN 1 ELSE 0 END)::bigint as wins,
                    SUM(vrp.correct_count)::bigint as total_correct,
                    SUM(vrp.total_markets)::bigint as total_markets
             FROM vision_round_players vrp
             JOIN vision_batch_lifecycle vbl ON vrp.batch_id = vbl.batch_id
             WHERE vbl.source_id = '{safe_sid}'
             GROUP BY vrp.player",
            safe_sid = safe_sid
        )
    } else if let Some(bid) = batch_id {
        format!(
            "SELECT player,
                    SUM(payout::numeric)::text as total_balance,
                    SUM(deposited::numeric)::text as total_deposited,
                    COUNT(*)::bigint as batches_joined,
                    SUM(CASE WHEN pnl::numeric > 0 THEN 1 ELSE 0 END)::bigint as wins,
                    SUM(correct_count)::bigint as total_correct,
                    SUM(total_markets)::bigint as total_markets
             FROM vision_round_players
             WHERE batch_id = {bid}
             GROUP BY player",
            bid = bid
        )
    } else {
        return (
            StatusCode::OK,
            Json(serde_json::json!({
                "leaderboard": Vec::<LeaderboardEntry>::new(),
                "updatedAt": chrono::Utc::now().to_rfc3339(),
            })),
        )
            .into_response();
    };

    let rows = match sqlx::query_as::<_, LeaderboardRow>(&query)
        .fetch_all(pool)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Leaderboard Postgres query failed: {e}");
            return (
                StatusCode::OK,
                Json(serde_json::json!({
                    "leaderboard": Vec::<LeaderboardEntry>::new(),
                    "updatedAt": chrono::Utc::now().to_rfc3339(),
                })),
            )
                .into_response();
        }
    };

    let decimals = 1e18_f64;

    // (bal, dep, batches, wins, rounds_played, rounds_won, total_correct, total_markets)
    let mut merged: std::collections::HashMap<String, (f64, f64, usize, usize, u64, u64, u64, u64)> =
        std::collections::HashMap::new();

    for r in rows {
        let bal: f64 = r.total_balance.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
        let dep: f64 = r.total_deposited.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
        let batches = r.batches_joined.unwrap_or(0) as usize;
        let wins = r.wins.unwrap_or(0) as usize;
        let entry = merged.entry(r.player).or_insert((0.0, 0.0, 0, 0, 0, 0, 0, 0));
        entry.0 += bal;
        entry.1 += dep;
        entry.2 += batches;
        entry.3 += wins;
        entry.4 += batches as u64;   // rounds_played
        entry.5 += wins as u64;      // rounds_won
        entry.6 += r.total_correct.unwrap_or(0) as u64;
        entry.7 += r.total_markets.unwrap_or(0) as u64;
    }

    // Sort by PnL descending
    let mut entries: Vec<_> = merged.into_iter().collect();
    entries.sort_by(|a, b| {
        let pnl_a = a.1 .0 - a.1 .1;
        let pnl_b = b.1 .0 - b.1 .1;
        pnl_b.partial_cmp(&pnl_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    let leaderboard: Vec<LeaderboardEntry> = entries
        .iter()
        .enumerate()
        .map(|(i, (addr, (bal, dep, batches, wins, rounds_played, rounds_won, total_correct, total_markets)))| {
            let pnl = (bal - dep) / decimals;
            let deposited = dep / decimals;
            let roi = if deposited > 0.0 { pnl / deposited * 100.0 } else { 0.0 };
            let win_rate = if *batches > 0 {
                *wins as f64 / *batches as f64 * 100.0
            } else {
                0.0
            };
            let avg_correct_pct = if *total_markets > 0 {
                *total_correct as f64 / *total_markets as f64 * 100.0
            } else {
                0.0
            };
            LeaderboardEntry {
                rank: i + 1,
                wallet_address: addr.clone(),
                pnl: (pnl * 100.0).round() / 100.0,
                win_rate: (win_rate * 10.0).round() / 10.0,
                roi: (roi * 100.0).round() / 100.0,
                total_volume: (deposited * 100.0).round() / 100.0,
                portfolio_bets: *batches,
                avg_portfolio_size: 0.0,
                largest_portfolio: 0,
                rounds_played: *rounds_played,
                rounds_won: *rounds_won,
                avg_correct_pct: (avg_correct_pct * 10.0).round() / 10.0,
            }
        })
        .collect();

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "leaderboard": leaderboard,
            "updatedAt": chrono::Utc::now().to_rfc3339(),
        })),
    )
        .into_response()
}

/// Convert in-memory player_data map to sorted LeaderboardEntry vec.
///
/// Tuple layout: (total_balance, total_deposited, batches_joined, largest_batch_markets,
///                batch_wins, rounds_played, rounds_won, total_correct, total_markets)
fn build_leaderboard_from_map(
    player_data: std::collections::HashMap<
        Address,
        (u128, u128, usize, usize, usize, u64, u64, u64, u64),
    >,
) -> Vec<LeaderboardEntry> {
    let mut entries: Vec<_> = player_data.into_iter().collect();

    entries.sort_by(|a, b| {
        let pnl_a = a.1 .0 as i128 - a.1 .1 as i128;
        let pnl_b = b.1 .0 as i128 - b.1 .1 as i128;
        pnl_b.cmp(&pnl_a)
    });

    let decimals = 1e18_f64;
    entries
        .iter()
        .enumerate()
        .map(
            |(
                i,
                (
                    addr,
                    (bal, dep, batches, _largest, wins, rounds_played, rounds_won, total_correct, total_markets),
                ),
            )| {
                let pnl = (*bal as i128 - *dep as i128) as f64 / decimals;
                let deposited = *dep as f64 / decimals;
                let roi = if deposited > 0.0 {
                    pnl / deposited * 100.0
                } else {
                    0.0
                };
                let win_rate = if *batches > 0 {
                    *wins as f64 / *batches as f64 * 100.0
                } else {
                    0.0
                };
                let avg_correct_pct = if *total_markets > 0 {
                    *total_correct as f64 / *total_markets as f64 * 100.0
                } else {
                    0.0
                };
                LeaderboardEntry {
                    rank: i + 1,
                    wallet_address: format!("{:?}", addr),
                    pnl: (pnl * 100.0).round() / 100.0,
                    win_rate: (win_rate * 10.0).round() / 10.0,
                    roi: (roi * 100.0).round() / 100.0,
                    total_volume: (deposited * 100.0).round() / 100.0,
                    portfolio_bets: *batches,
                    avg_portfolio_size: 0.0,
                    largest_portfolio: 0,
                    rounds_played: *rounds_played,
                    rounds_won: *rounds_won,
                    avg_correct_pct: (avg_correct_pct * 10.0).round() / 10.0,
                }
            },
        )
        .collect()
}

/// Row type for deposit queries.
#[derive(Debug, sqlx::FromRow)]
struct DepositRow {
    player: String,
    total_deposited: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /vision/user/:address/balance (Dual-balance — Vision First Deposit)
// ---------------------------------------------------------------------------

/// Response for user's dual Vision balance.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserBalanceResponse {
    /// Real balance — backed by actual L3 USDC in Vision.sol.
    real_balance: String,
    /// Virtual balance — backed by USDC locked in SettlementBridgeCustody on Settlement.
    virtual_balance: String,
    /// Total balance (real + virtual) — what the user can spend.
    total: String,
}

/// Get a user's dual Vision balance (real + virtual).
///
/// Reads from the in-memory tick scheduler for instant response.
/// `realBalance` = withdrawable to L3 wallet (via `withdrawBalance`)
/// `virtualBalance` = withdrawable to Settlement wallet (via `withdrawToSettlement`)
async fn get_user_balance(
    State(state): State<Arc<VisionState>>,
    Path(address_str): Path<String>,
) -> impl IntoResponse {
    let user: Address = match address_str.parse() {
        Ok(addr) => addr,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiError::new(format!("Invalid address: {e}"))),
            )
                .into_response();
        }
    };

    let (real_balance, virtual_balance) = (ethers::types::U256::zero(), ethers::types::U256::zero());
    let total = real_balance.saturating_add(virtual_balance);

    (
        StatusCode::OK,
        Json(UserBalanceResponse {
            real_balance: real_balance.to_string(),
            virtual_balance: virtual_balance.to_string(),
            total: total.to_string(),
        }),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// GET /vision/deposit/:order_id/status
// ---------------------------------------------------------------------------

/// Response for cross-chain deposit order status.
#[derive(Debug, Serialize)]
struct DepositStatusResponse {
    order_id: i64,
    status: String,
    user_address: Option<String>,
    amount: Option<String>,
    created_at: Option<chrono::NaiveDateTime>,
    completed_at: Option<chrono::NaiveDateTime>,
}

/// Row type for deposit order queries.
#[derive(Debug, sqlx::FromRow)]
struct DepositOrderRow {
    order_id: i64,
    user_address: String,
    amount: String,
    status: String,
    created_at: chrono::NaiveDateTime,
    completed_at: Option<chrono::NaiveDateTime>,
}

/// Get the status of a cross-chain deposit order.
///
/// Returns the current state in the deposit state machine:
/// pending → credited_on_l3 → completed | pending → refunded
async fn get_deposit_status(
    State(state): State<Arc<VisionState>>,
    Path(order_id): Path<i64>,
) -> impl IntoResponse {
    let row = sqlx::query_as::<_, DepositOrderRow>(
        "SELECT order_id, user_address, amount, status, created_at, completed_at
         FROM vision_deposit_orders
         WHERE order_id = $1",
    )
    .bind(order_id)
    .fetch_optional(&state.pool)
    .await;

    match row {
        Ok(Some(r)) => (
            StatusCode::OK,
            Json(DepositStatusResponse {
                order_id: r.order_id,
                status: r.status,
                user_address: Some(r.user_address),
                amount: Some(r.amount),
                created_at: Some(r.created_at),
                completed_at: r.completed_at,
            }),
        )
            .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiError::new(format!("Deposit order {order_id} not found"))),
        )
            .into_response(),
        Err(e) => {
            warn!(order_id, error = %e, "Failed to query deposit order");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(format!("Database error: {e}"))),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /vision/withdraw/:withdraw_id/status
// ---------------------------------------------------------------------------

/// Response for cross-chain withdraw order status.
#[derive(Debug, Serialize)]
struct WithdrawStatusResponse {
    withdraw_id: i64,
    status: String,
    user_address: Option<String>,
    amount: Option<String>,
    created_at: Option<chrono::NaiveDateTime>,
    completed_at: Option<chrono::NaiveDateTime>,
}

/// Row type for withdraw order queries.
#[derive(Debug, sqlx::FromRow)]
struct WithdrawOrderRow {
    withdraw_id: i64,
    user_address: String,
    amount: String,
    status: String,
    created_at: chrono::NaiveDateTime,
    completed_at: Option<chrono::NaiveDateTime>,
}

/// Get the status of a cross-chain withdraw order.
///
/// Returns the current state: pending → completed
async fn get_withdraw_status(
    State(state): State<Arc<VisionState>>,
    Path(withdraw_id): Path<i64>,
) -> impl IntoResponse {
    let row = sqlx::query_as::<_, WithdrawOrderRow>(
        "SELECT withdraw_id, user_address, amount, status, created_at, completed_at
         FROM vision_withdraw_orders
         WHERE withdraw_id = $1",
    )
    .bind(withdraw_id)
    .fetch_optional(&state.pool)
    .await;

    match row {
        Ok(Some(r)) => (
            StatusCode::OK,
            Json(WithdrawStatusResponse {
                withdraw_id: r.withdraw_id,
                status: r.status,
                user_address: Some(r.user_address),
                amount: Some(r.amount),
                created_at: Some(r.created_at),
                completed_at: r.completed_at,
            }),
        )
            .into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiError::new(format!("Withdraw order {withdraw_id} not found"))),
        )
            .into_response(),
        Err(e) => {
            warn!(withdraw_id, error = %e, "Failed to query withdraw order");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiError::new(format!("Database error: {e}"))),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /vision/player/:address/profile
// ---------------------------------------------------------------------------

/// Display-ready player profile response.
#[derive(Debug, Serialize)]
pub struct PlayerProfileResponse {
    pub stats: ProfileStats,
    pub batches: Vec<ProfileBatch>,
    #[serde(rename = "pnlHistory")]
    pub pnl_history: Vec<ProfilePnlPoint>,
}

/// Aggregate player statistics.
#[derive(Debug, Serialize)]
pub struct ProfileStats {
    pub pnl: f64,
    #[serde(rename = "totalDeposited")]
    pub total_deposited: f64,
    pub roi: f64,
    #[serde(rename = "winRate")]
    pub win_rate: f64,
    #[serde(rename = "totalBatches")]
    pub total_batches: u64,
    #[serde(rename = "lastActiveAt")]
    pub last_active_at: Option<String>,
}

/// Per-batch breakdown in a player profile.
#[derive(Debug, Serialize)]
pub struct ProfileBatch {
    #[serde(rename = "batchId")]
    pub batch_id: i64,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    pub status: String,
    pub deposited: f64,
    pub balance: f64,
    #[serde(rename = "tickCount")]
    pub tick_count: i64,
    pub roi: f64,
    pub ticks: Vec<ProfileTick>,
}

/// A single tick result within a batch.
#[derive(Debug, Serialize, Clone)]
pub struct ProfileTick {
    #[serde(rename = "tickId")]
    pub tick_id: i64,
    pub pnl: f64,
    pub won: bool,
}

/// Hourly-bucketed P&L history point.
#[derive(Debug, Serialize)]
pub struct ProfilePnlPoint {
    pub timestamp: String,
    pub pnl: f64,
}

/// Player profile — stats, batches, and P&L chart in a single call.
///
/// Aggregates from `vision_round_players`, `vision_positions`,
/// and `vision_batches`. Returns display-ready dollars, percentages,
/// pre-sorted batches, and hourly-bucketed P&L history.
async fn player_profile(
    State(state): State<Arc<VisionState>>,
    Path(address_str): Path<String>,
) -> impl IntoResponse {
    // -- Validate address --
    if address_str.len() != 42
        || !address_str.starts_with("0x")
        || !address_str[2..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiError::new("Invalid address: expected 0x-prefixed 40 hex chars")),
        )
            .into_response();
    }
    let address = address_str.to_lowercase();

    // -- Q0: per-batch settled round aggregates --
    #[derive(Debug, sqlx::FromRow)]
    struct RoundAggRow {
        batch_id: i64,
        total_pnl: Option<String>,
        total_deposited: Option<String>,
        round_count: Option<i64>,
    }

    // -- Q1: recent settled rounds (max 60) --
    #[derive(Debug, sqlx::FromRow)]
    struct RoundRow {
        batch_id: i64,
        correct_count: i64,
        total_markets: i64,
        pnl: String,
        settled_at: chrono::DateTime<chrono::Utc>,
    }

    // -- Q2: active positions --
    #[derive(Debug, sqlx::FromRow)]
    struct PositionRow {
        batch_id: i64,
        balance: String,
        total_deposited: String,
    }

    // -- Q3: P&L history (from settled rounds) --
    #[derive(Debug, sqlx::FromRow)]
    struct HistoryRow {
        delta: String,
        resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    }


    // -- Q4: batch metadata --
    #[derive(Debug, sqlx::FromRow)]
    struct BatchMetaRow {
        id: i64,
        source_id_raw: Option<String>,
    }

    // Run all 4 independent queries in parallel (Q4 depends on Q0+Q2 results)
    let (q0_result, q1_result, q2_result, q3_result) = tokio::join!(
        sqlx::query_as::<_, RoundAggRow>(
            "SELECT batch_id, SUM(pnl::numeric)::text as total_pnl, \
             SUM(deposited::numeric)::text as total_deposited, COUNT(*) as round_count \
             FROM vision_round_players WHERE LOWER(player) = $1 GROUP BY batch_id"
        )
        .bind(&address)
        .fetch_all(&state.pool),

        sqlx::query_as::<_, RoundRow>(
            "SELECT batch_id, correct_count, total_markets, pnl, settled_at \
             FROM vision_round_players WHERE LOWER(player) = $1 \
             ORDER BY settled_at DESC LIMIT 500"
        )
        .bind(&address)
        .fetch_all(&state.pool),

        sqlx::query_as::<_, PositionRow>(
            "SELECT batch_id, balance::text as balance, total_deposited::text as total_deposited \
             FROM vision_positions WHERE LOWER(player) = $1"
        )
        .bind(&address)
        .fetch_all(&state.pool),

        sqlx::query_as::<_, HistoryRow>(
            "SELECT pnl as delta, settled_at as resolved_at \
             FROM vision_round_players WHERE LOWER(player) = $1 \
             ORDER BY settled_at DESC LIMIT 5000"
        )
        .bind(&address)
        .fetch_all(&state.pool),
    );

    // Unwrap results — return 500 on any DB failure
    let round_aggs = match q0_result {
        Ok(rows) => rows,
        Err(e) => {
            warn!(error = %e, "Profile Q0 (round aggregates) failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError::new(format!("Database error: {e}")))).into_response();
        }
    };
    let round_rows = match q1_result {
        Ok(rows) => rows,
        Err(e) => {
            warn!(error = %e, "Profile Q1 (round rows) failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError::new(format!("Database error: {e}")))).into_response();
        }
    };
    let positions = match q2_result {
        Ok(rows) => rows,
        Err(e) => {
            warn!(error = %e, "Profile Q2 (positions) failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError::new(format!("Database error: {e}")))).into_response();
        }
    };
    let history_rows = match q3_result {
        Ok(rows) => rows,
        Err(e) => {
            warn!(error = %e, "Profile Q3 (history) failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError::new(format!("Database error: {e}")))).into_response();
        }
    };

    // Collect all batch IDs for Q4
    let mut all_batch_ids: Vec<i64> = round_aggs.iter().map(|r| r.batch_id).collect();
    for p in &positions {
        if !all_batch_ids.contains(&p.batch_id) {
            all_batch_ids.push(p.batch_id);
        }
    }

    // -- Q4: batch metadata --
    // LEFT JOIN vision_batch_lifecycle to get plain-text source names;
    // fall back to bytes32_hex_to_string for batches without lifecycle entries
    // (chain_listener discovery path, or pre-lifecycle-era batches).
    let batch_meta_map: std::collections::HashMap<i64, String> = if all_batch_ids.is_empty() {
        std::collections::HashMap::new()
    } else {
        match sqlx::query_as::<_, BatchMetaRow>(
            "SELECT vbl.batch_id as id,
                    vbl.source_id as source_id_raw
             FROM vision_batch_lifecycle vbl
             WHERE vbl.batch_id = ANY($1)"
        )
        .bind(&all_batch_ids)
        .fetch_all(&state.pool)
        .await
        {
            Ok(rows) => rows
                .into_iter()
                .map(|r| {
                    let source = r.source_id_raw.unwrap_or_default();
                    (r.id, if source.is_empty() { "unknown".to_string() } else { source })
                })
                .collect(),
            Err(e) => {
                warn!(error = %e, "Profile Q4 (batch meta) failed");
                std::collections::HashMap::new()
            }
        }
    };

    // -- Build lookup maps --
    let round_agg_map: std::collections::HashMap<i64, &RoundAggRow> =
        round_aggs.iter().map(|r| (r.batch_id, r)).collect();

    let position_map: std::collections::HashMap<i64, &PositionRow> =
        positions.iter().map(|r| (r.batch_id, r)).collect();

    // Group round_rows by SOURCE (not batch) — each round creates a new batch_id
    // but the frontend groups by source. We need ticks keyed by source_id.
    // Also keep the old batch-level map for legacy tick-engine batches.
    let mut rounds_by_source: std::collections::HashMap<String, Vec<ProfileTick>> =
        std::collections::HashMap::new();
    let mut rounds_by_batch: std::collections::HashMap<i64, Vec<ProfileTick>> =
        std::collections::HashMap::new();
    for r in &round_rows {
        let pnl_wei: i128 = r.pnl.parse().unwrap_or(0);
        let pnl = pnl_wei as f64 / 1e18;
        let tick = ProfileTick {
            tick_id: r.settled_at.timestamp(),
            pnl: (pnl * 100.0).round() / 100.0,
            won: pnl_wei > 0,
        };
        // Group by source using batch_meta_map
        if let Some(source) = batch_meta_map.get(&r.batch_id) {
            rounds_by_source.entry(source.clone()).or_default().push(tick.clone());
        }
        rounds_by_batch.entry(r.batch_id).or_default().push(tick);
    }
    // Reverse so oldest is first
    for rounds in rounds_by_source.values_mut() {
        rounds.reverse();
    }
    for rounds in rounds_by_batch.values_mut() {
        rounds.reverse();
    }

    // -- Compute aggregate stats using i128 arithmetic --
    let mut total_pnl_wei: i128 = 0;
    let mut total_deposited_wei: i128 = 0;
    let mut total_wins: u64 = 0;
    let mut total_batches: u64 = 0;
    let mut last_active: Option<String> = None;

    // Active batches: from positions
    let mut profile_batches: Vec<ProfileBatch> = Vec::new();

    for pos in &positions {
        let deposited_wei: i128 = pos.total_deposited.parse().unwrap_or(0);
        // vision_positions.balance is never updated after settlement — it stays
        // at initial_deposit. Real PnL lives in vision_round_players. Use the
        // settled round aggregate if available, otherwise fall back to position balance.
        let round_pnl_wei: i128 = round_agg_map
            .get(&pos.batch_id)
            .and_then(|a| a.total_pnl.as_deref())
            .and_then(|s| s.parse::<i128>().ok())
            .unwrap_or(0);
        let balance_wei = deposited_wei + round_pnl_wei;
        let pnl_wei = round_pnl_wei;

        total_pnl_wei += pnl_wei;
        total_deposited_wei += deposited_wei;
        total_batches += 1;
        if pnl_wei > 0 {
            total_wins += 1;
        }

        let tick_count = round_agg_map
            .get(&pos.batch_id)
            .and_then(|d| d.round_count)
            .unwrap_or(0);

        let deposited_f = deposited_wei as f64 / 1e18;
        let balance_f = balance_wei as f64 / 1e18;
        let pnl_f = pnl_wei as f64 / 1e18;
        let roi = if deposited_f > 0.0 { pnl_f / deposited_f * 100.0 } else { 0.0 };

        let source = batch_meta_map.get(&pos.batch_id).cloned().unwrap_or_default();
        // Get ticks by source (covers all rounds across all batches for this source)
        // Use remove so each source's ticks are only attached once
        let ticks = rounds_by_source.remove(&source)
            .or_else(|| rounds_by_batch.remove(&pos.batch_id))
            .unwrap_or_default();

        profile_batches.push(ProfileBatch {
            batch_id: pos.batch_id,
            source_id: source,
            status: "active".to_string(),
            deposited: (deposited_f * 100.0).round() / 100.0,
            balance: (balance_f * 100.0).round() / 100.0,
            tick_count,
            roi: (roi * 100.0).round() / 100.0,
            ticks,
        });
    }

    // Exited batches: have settled rounds but no active position
    for agg in &round_aggs {
        if position_map.contains_key(&agg.batch_id) {
            continue; // already counted as active
        }
        let delta_wei: i128 = agg.total_pnl.as_deref().unwrap_or("0").parse().unwrap_or(0);
        let deposited_wei: i128 = agg.total_deposited.as_deref().unwrap_or("0").parse().unwrap_or(0);

        total_pnl_wei += delta_wei;
        total_deposited_wei += deposited_wei;
        total_batches += 1;
        if delta_wei > 0 {
            total_wins += 1;
        }

        let tick_count = agg.round_count.unwrap_or(0);
        let deposited_f = deposited_wei as f64 / 1e18;
        let pnl_f = delta_wei as f64 / 1e18;
        let roi = if deposited_f > 0.0 { pnl_f / deposited_f * 100.0 } else { 0.0 };

        let source = batch_meta_map.get(&agg.batch_id).cloned().unwrap_or_default();
        let ticks = rounds_by_source.remove(&source)
            .or_else(|| rounds_by_batch.remove(&agg.batch_id))
            .unwrap_or_default();

        profile_batches.push(ProfileBatch {
            batch_id: agg.batch_id,
            source_id: source,
            status: "exited".to_string(),
            deposited: (deposited_f * 100.0).round() / 100.0,
            balance: ((deposited_f + pnl_f) * 100.0).round() / 100.0,
            tick_count,
            roi: (roi * 100.0).round() / 100.0,
            ticks,
        });
    }

    // Sort: active first, then by tick_count descending
    profile_batches.sort_by(|a, b| {
        let status_ord = |s: &str| -> u8 { if s == "active" { 0 } else { 1 } };
        status_ord(&a.status)
            .cmp(&status_ord(&b.status))
            .then(b.tick_count.cmp(&a.tick_count))
    });

    // -- P&L history: hourly bucketed, running sum, downsampled to ~200 --
    let mut pnl_history: Vec<ProfilePnlPoint> = Vec::new();
    if !history_rows.is_empty() {
        // history_rows are DESC by resolved_at — reverse for chronological
        let mut chrono_rows: Vec<&HistoryRow> = history_rows.iter().collect();
        chrono_rows.reverse();

        // Find last_active_at from the last row (most recent)
        if let Some(last) = history_rows.first() {
            if let Some(ts) = &last.resolved_at {
                last_active = Some(ts.to_rfc3339());
            }
        }

        // Bucket into hourly intervals with i128 running sum
        struct Bucket {
            hour: String,
            sum_wei: i128,
        }

        let mut buckets: Vec<Bucket> = Vec::new();
        let mut running_sum: i128 = 0;

        for row in &chrono_rows {
            let delta_wei: i128 = row.delta.parse().unwrap_or(0);
            running_sum += delta_wei;

            let hour = match &row.resolved_at {
                Some(ts) => {
                    // Truncate to hour boundary — ts is DateTime<Utc>, so Z suffix is truthful
                    let epoch_hour = ts.timestamp() / 3600;
                    chrono::DateTime::from_timestamp(epoch_hour * 3600, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default()
                }
                None => continue,
            };

            match buckets.last_mut() {
                Some(b) if b.hour == hour => {
                    b.sum_wei = running_sum;
                }
                _ => {
                    buckets.push(Bucket {
                        hour,
                        sum_wei: running_sum,
                    });
                }
            }
        }

        // Downsample to ~200 points
        let target = 200usize;
        let step = if buckets.len() > target {
            buckets.len() / target
        } else {
            1
        };

        for (i, bucket) in buckets.iter().enumerate() {
            if i % step == 0 || i == buckets.len() - 1 {
                pnl_history.push(ProfilePnlPoint {
                    timestamp: bucket.hour.clone(),
                    pnl: (bucket.sum_wei as f64 / 1e18 * 100.0).round() / 100.0,
                });
            }
        }
    }

    // -- Final stats --
    let total_deposited_f = total_deposited_wei as f64 / 1e18;
    let total_pnl_f = total_pnl_wei as f64 / 1e18;
    let roi = if total_deposited_f > 0.0 {
        total_pnl_f / total_deposited_f * 100.0
    } else {
        0.0
    };
    // Profitable rounds rate: rounds with positive PnL / total rounds
    let win_rate = if total_batches > 0 {
        total_wins as f64 / total_batches as f64 * 100.0
    } else {
        0.0
    };

    let stats = ProfileStats {
        pnl: (total_pnl_f * 100.0).round() / 100.0,
        total_deposited: (total_deposited_f * 100.0).round() / 100.0,
        roi: (roi * 100.0).round() / 100.0,
        win_rate: (win_rate * 10.0).round() / 10.0,
        total_batches,
        last_active_at: last_active,
    };

    (
        StatusCode::OK,
        Json(PlayerProfileResponse {
            stats,
            batches: profile_batches,
            pnl_history,
        }),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// GET /vision/source/:source_id/history
// ---------------------------------------------------------------------------

/// Source batch history entry — always settled.
/// Active batch info is injected client-side from the scheduler.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceBatchHistoryEntry {
    batch_id: i64,
    status: String,
    player_count: i64,
    total_pool: f64,
    avg_pnl: f64,
    timestamp: String,
}

#[derive(Debug, Deserialize)]
struct SourceHistoryQuery {
    page: Option<u32>,
    per_page: Option<u32>,
}

#[derive(Debug, sqlx::FromRow)]
struct SettledHistoryRow {
    batch_id: i64,
    settled_at: chrono::DateTime<chrono::Utc>,
    player_count: Option<i64>,
    total_deposited: Option<String>,
    total_pnl: Option<String>,
}

async fn source_batch_history(
    State(state): State<Arc<VisionState>>,
    Path(source_id): Path<String>,
    Query(query): Query<SourceHistoryQuery>,
) -> impl IntoResponse {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(10).min(50);
    let offset = ((page - 1) * per_page) as i64;
    let limit = per_page as i64;
    let decimals = 1e18_f64;

    // Active batch is injected client-side from the scheduler (always accurate).
    // This endpoint only returns settled batches, ordered by settlement time.
    let mut entries: Vec<SourceBatchHistoryEntry> = Vec::new();

    // Settled batches — from round_players aggregated, paginated
    let total_settled: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT vrp.batch_id)::bigint
         FROM vision_round_players vrp
         JOIN vision_batch_lifecycle vbl ON vrp.batch_id = vbl.batch_id
         WHERE vbl.source_id = $1"
    )
    .bind(&source_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let settled_rows = sqlx::query_as::<_, SettledHistoryRow>(
        "SELECT vrp.batch_id,
                MAX(vrp.settled_at) AS settled_at,
                COUNT(DISTINCT vrp.player)::bigint AS player_count,
                SUM(vrp.deposited::numeric)::text AS total_deposited,
                SUM(vrp.pnl::numeric)::text AS total_pnl
         FROM vision_round_players vrp
         JOIN vision_batch_lifecycle vbl ON vrp.batch_id = vbl.batch_id
         WHERE vbl.source_id = $1
         GROUP BY vrp.batch_id
         ORDER BY MAX(vrp.settled_at) DESC
         LIMIT $2 OFFSET $3"
    )
    .bind(&source_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    for r in settled_rows {
        let players = r.player_count.unwrap_or(0);
        let total_dep = r.total_deposited.as_deref()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0) / decimals;
        let total_pnl = r.total_pnl.as_deref()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0) / decimals;
        let avg_pnl = if players > 0 { total_pnl / players as f64 } else { 0.0 };

        entries.push(SourceBatchHistoryEntry {
            batch_id: r.batch_id,
            status: "settled".to_string(),
            player_count: players,
            total_pool: (total_dep * 100.0).round() / 100.0,
            avg_pnl: (avg_pnl * 100.0).round() / 100.0,
            timestamp: r.settled_at.to_rfc3339(),
        });
    }

    let total_pages = ((total_settled as f64) / per_page as f64).ceil() as u32;

    (StatusCode::OK, Json(serde_json::json!({
        "batches": entries,
        "page": page,
        "perPage": per_page,
        "totalSettled": total_settled,
        "totalPages": total_pages,
    }))).into_response()
}

// ---------------------------------------------------------------------------
// GET /vision/rounds/active — round-based alias for list_batches
// ---------------------------------------------------------------------------

/// Query params for the rounds/active endpoint.
#[derive(Debug, Deserialize)]
struct RoundsActiveQuery {
    source: Option<String>,
}

/// A round in the E2E-expected shape.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoundInfoResponse {
    batch_id: u64,
    source_id: String,
    timeframe_secs: u64,
    status: String,
    player_count: usize,
    betting_end: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    config_hash: Option<String>,
}

/// List active rounds (non-paused batches) in the shape the E2E tests expect.
///
/// Reads the same data as `list_batches` but returns `{ rounds: [...] }`
/// with camelCase fields matching the `RoundInfo` TypeScript interface.
async fn rounds_active(
    State(state): State<Arc<VisionState>>,
    Query(query): Query<RoundsActiveQuery>,
) -> impl IntoResponse {
    // Build the SQL filter — always paused=false, optionally by source_id
    let rows = if let Some(ref source) = query.source {
        let hex_sid = string_to_bytes32_hex(source);
        sqlx::query_as::<_, BatchRow>(
            "SELECT id, creator, tick_duration, paused, source_id, config_hash
             FROM vision_batches
             WHERE paused = false AND source_id = $1
             ORDER BY id DESC
             LIMIT 100"
        )
        .bind(&hex_sid)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, BatchRow>(
            "SELECT id, creator, tick_duration, paused, source_id, config_hash
             FROM vision_batches
             WHERE paused = false
             ORDER BY id DESC
             LIMIT 100"
        )
        .fetch_all(&state.pool)
        .await
    };

    match rows {
        Ok(rows) => {
            let mut rounds = Vec::with_capacity(rows.len());
            for row in rows {
                let batch_id = row.id as u64;
                let live_count = state.scheduler.player_count(batch_id).await;

                // betting_end + source_id + player_count from vision_batch_lifecycle (plain text names).
                // Falls back to now + tick_duration / hash decode if lifecycle record
                // doesn't exist (chain_listener discovery path).
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();
                let lifecycle_row: Option<(chrono::DateTime<chrono::Utc>, String, Option<i32>)> = sqlx::query_as(
                    "SELECT betting_end, source_id, player_count FROM vision_batch_lifecycle WHERE batch_id = $1"
                )
                .bind(batch_id as i64)
                .fetch_optional(&state.pool)
                .await
                .ok()
                .flatten();
                // Skip batches with no lifecycle row — they were discovered by chain_listener
                // but have no real betting_end. A fabricated `now + tick_duration` would drift
                // on every request, producing a timer that never counts down.
                let (betting_end_ts, lifecycle_source, lifecycle_pc) = match lifecycle_row {
                    Some((ts, src, pc)) => (ts.timestamp() as u64, Some(src), pc.unwrap_or(0) as usize),
                    None => continue,
                };

                // Live scheduler count preferred; fall back to persisted lifecycle count
                // (survives oracle restarts after settlement zeroes in-memory balances).
                let player_count = if live_count > 0 { live_count } else { lifecycle_pc };

                // Derive status from betting_end: past deadline = settling, otherwise betting
                let status = if now >= betting_end_ts { "settling" } else { "betting" };

                let source_id = lifecycle_source
                    .unwrap_or_else(|| bytes32_hex_to_string(&row.source_id.unwrap_or_default()));

                let config_hash = row.config_hash.clone().filter(|h| !h.is_empty());

                rounds.push(RoundInfoResponse {
                    batch_id,
                    source_id,
                    timeframe_secs: row.tick_duration as u64,
                    status: status.to_string(),
                    player_count,
                    betting_end: chrono::DateTime::from_timestamp(betting_end_ts as i64, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| betting_end_ts.to_string()),
                    config_hash,
                });
            }
            (StatusCode::OK, Json(serde_json::json!({ "rounds": rounds }))).into_response()
        }
        Err(e) => {
            warn!("Failed to query rounds from Postgres: {e}");
            // Return empty array on error — E2E tests check `data.rounds ?? []`
            (StatusCode::OK, Json(serde_json::json!({ "rounds": Vec::<()>::new() }))).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /vision/rounds/:id/results — round results after settlement
// ---------------------------------------------------------------------------

/// Player result within a settled round.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoundPlayerResult {
    player: String,
    deposited: String,
    payout: String,
    pnl: String,
    correct_count: i64,
    total_markets: i64,
}

/// Round results — outcomes and PnL for each player after settlement.
///
/// Reads from `vision_round_players` if the table exists.
/// Returns 200 with empty players array if no data yet (round not settled).
async fn round_results(
    State(state): State<Arc<VisionState>>,
    Path(id): Path<u64>,
) -> impl IntoResponse {
    #[derive(Debug, sqlx::FromRow)]
    struct RoundPlayerRow {
        player: String,
        deposited: String,
        payout: String,
        pnl: String,
        correct_count: Option<i64>,
        total_markets: Option<i64>,
    }

    let rows = sqlx::query_as::<_, RoundPlayerRow>(
        "SELECT player, deposited, payout, pnl, correct_count, total_markets
         FROM vision_round_players
         WHERE batch_id = $1
         ORDER BY pnl::numeric DESC"
    )
    .bind(id as i64)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(rows) => {
            let players: Vec<RoundPlayerResult> = rows
                .into_iter()
                .map(|r| RoundPlayerResult {
                    player: r.player,
                    deposited: r.deposited,
                    payout: r.payout,
                    pnl: r.pnl,
                    correct_count: r.correct_count.unwrap_or(0),
                    total_markets: r.total_markets.unwrap_or(0),
                })
                .collect();
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "batchId": id,
                    "players": players,
                })),
            )
                .into_response()
        }
        Err(e) => {
            // Table may not exist yet — return empty result, not 500
            warn!("Failed to query round results for batch {id}: {e}");
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "batchId": id,
                    "players": Vec::<()>::new(),
                })),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /vision/rounds/:id/bitmaps — decoded bitmaps for a settled round
// ---------------------------------------------------------------------------

/// Decoded bitmaps for a settled round.
///
/// Returns the bitmap store's active bitmaps decoded into per-player boolean arrays.
/// If the round hasn't settled or bitmaps aren't available, returns empty arrays.
async fn round_bitmaps(
    State(state): State<Arc<VisionState>>,
    Path(id): Path<u64>,
) -> impl IntoResponse {
    let bitmaps = state.bitmap_store.get_all_active_for_batch(id).await;

    let players: Vec<serde_json::Value> = bitmaps
        .into_iter()
        .map(|b| {
            let predictions: Vec<bool> = b.bitmap.iter()
                .flat_map(|byte| (0..8).rev().map(move |bit| (byte >> bit) & 1 == 1))
                .collect();
            serde_json::json!({
                "player": format!("{:?}", b.player),
                "predictions": predictions,
            })
        })
        .collect();

    // Fetch market names from the batch's config via data-node
    let markets: Vec<String> = match sqlx::query_scalar::<_, Option<String>>(
        "SELECT config_hash FROM vision_batches WHERE id = $1",
    )
    .bind(id as i64)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some(Some(hash))) if !hash.is_empty() => {
            use super::batch_config_orchestrator;
            match batch_config_orchestrator::fetch_config_by_hash(
                &state.config.data_node_url,
                &hash,
            )
            .await
            {
                Ok(config) => config.markets.into_iter().map(|m| m.asset_id).collect(),
                Err(e) => {
                    warn!("round_bitmaps: failed to fetch config for hash {hash}: {e}");
                    Vec::new()
                }
            }
        }
        _ => Vec::new(),
    };

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "batchId": id,
            "markets": markets,
            "players": players,
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// GET /vision/player/:address/rounds — player round history
// ---------------------------------------------------------------------------

/// Query params for the player rounds endpoint.
#[derive(Debug, Deserialize)]
struct PlayerRoundsQuery {
    limit: Option<u64>,
}

/// Player's round history — past results across all batches.
///
/// Reads from `vision_round_players` and returns in the shape the E2E expects:
/// `{ rounds: PlayerRound[] }`.
async fn player_rounds(
    State(state): State<Arc<VisionState>>,
    Path(address_str): Path<String>,
    Query(query): Query<PlayerRoundsQuery>,
) -> impl IntoResponse {
    let limit = query.limit.unwrap_or(20).min(100) as i64;

    #[derive(Debug, sqlx::FromRow)]
    struct PlayerRoundRow {
        batch_id: i64,
        deposited: String,
        payout: String,
        pnl: String,
        correct_count: Option<i64>,
        total_markets: Option<i64>,
    }

    let rows = sqlx::query_as::<_, PlayerRoundRow>(
        "SELECT batch_id, deposited, payout, pnl, correct_count, total_markets
         FROM vision_round_players
         WHERE LOWER(player) = LOWER($1)
         ORDER BY batch_id DESC
         LIMIT $2"
    )
    .bind(&address_str)
    .bind(limit)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(rows) => {
            let rounds: Vec<serde_json::Value> = rows
                .into_iter()
                .map(|r| {
                    serde_json::json!({
                        "batchId": r.batch_id,
                        "deposited": r.deposited,
                        "payout": r.payout,
                        "pnl": r.pnl,
                        "correctCount": r.correct_count.unwrap_or(0),
                        "totalMarkets": r.total_markets.unwrap_or(0),
                    })
                })
                .collect();
            (StatusCode::OK, Json(serde_json::json!({ "rounds": rounds }))).into_response()
        }
        Err(e) => {
            // Table may not exist yet — return empty, not 500
            warn!("Failed to query player rounds for {address_str}: {e}");
            (StatusCode::OK, Json(serde_json::json!({ "rounds": Vec::<()>::new() }))).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /vision/points — lifetime points leaderboard
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
struct PointsEntry {
    player: String,
    total_points: i64,
    rounds_played: i32,
    total_deposited: String,
    total_pnl: String,
    last_epoch_ts: Option<chrono::DateTime<chrono::Utc>>,
}

async fn vision_points(
    State(state): State<Arc<VisionState>>,
) -> axum::response::Response {
    let rows: Vec<PointsEntry> = match sqlx::query_as(
        "SELECT player, total_points, rounds_played, total_deposited, total_pnl, last_epoch_ts
         FROM vision_player_points
         ORDER BY total_points DESC
         LIMIT 200"
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return axum::Json(serde_json::json!({
                "error": format!("DB error: {}", e),
                "leaderboard": []
            })).into_response();
        }
    };

    axum::Json(serde_json::json!({
        "leaderboard": rows,
        "count": rows.len(),
    })).into_response()
}

// GET /vision/points/:address — single player points + epoch history
async fn vision_points_player(
    State(state): State<Arc<VisionState>>,
    Path(address): Path<String>,
) -> axum::response::Response {
    let addr = address.to_lowercase();

    let player: Option<PointsEntry> = sqlx::query_as(
        "SELECT player, total_points, rounds_played, total_deposited, total_pnl, last_epoch_ts
         FROM vision_player_points
         WHERE LOWER(player) = $1"
    )
    .bind(&addr)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    let rank: Option<i64> = if player.is_some() {
        sqlx::query_scalar(
            "SELECT COUNT(*) + 1 FROM vision_player_points WHERE total_points > (
                SELECT total_points FROM vision_player_points WHERE LOWER(player) = $1
            )"
        )
        .bind(&addr)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
    } else {
        None
    };

    #[derive(serde::Serialize, sqlx::FromRow)]
    struct EpochRow {
        epoch_ts: chrono::DateTime<chrono::Utc>,
        points_delta: i64,
        rounds_in_epoch: i32,
        deposited_total: String,
        pnl_total: String,
    }

    let epochs: Vec<EpochRow> = sqlx::query_as(
        "SELECT epoch_ts, points_delta, rounds_in_epoch, deposited_total, pnl_total
         FROM vision_epoch_log
         WHERE LOWER(player) = $1
         ORDER BY epoch_ts DESC
         LIMIT 50"
    )
    .bind(&addr)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    axum::Json(serde_json::json!({
        "player": player,
        "rank": rank,
        "epochs": epochs,
    })).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_error_serialization() {
        let err = ApiError::new("test error");
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("test error"));
    }

    #[test]
    fn test_submit_bitmap_request_deserialization() {
        let json = r#"{
            "player": "0x1234567890123456789012345678901234567890",
            "batch_id": 42,
            "bitmap_hex": "0x01010001",
            "expected_hash": "0x0000000000000000000000000000000000000000000000000000000000000001"
        }"#;
        let req: SubmitBitmapRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.batch_id, 42);
        assert_eq!(req.bitmap_hex, "0x01010001");
    }

    #[test]
    fn test_batch_summary_serialization() {
        let summary = BatchSummary {
            id: 1,
            creator: "0x0000000000000000000000000000000000000001".into(),
            source_id: "0x0000000000000000000000000000000000000000000000000000000000000001".into(),
            config_hash: "0x0000000000000000000000000000000000000000000000000000000000000002".into(),
            tick_duration: 3600,
            player_count: 10,
            tvl: "1000000000000000000".into(),
            paused: false,
            current_tick: 0,
            market_count: 0,
        };
        let json = serde_json::to_string(&summary).unwrap();
        assert!(json.contains("\"id\":1"));
        assert!(json.contains("\"player_count\":10"));
        assert!(json.contains("\"tvl\":\"1000000000000000000\""));
    }

    #[test]
    fn test_balance_response_serialization() {
        let resp = BalanceResponse {
            batch_id: 1,
            player: "0x0000000000000000000000000000000000000001".into(),
            balance: "5000000000000000000".into(),
            stake_per_tick: "100000000000000000".into(),
            bls_sig: String::new(),
            signer_bitmap: "0".into(),
            tick_id: 42,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"batch_id\":1"));
        assert!(json.contains("\"balance\":\"5000000000000000000\""));
        assert!(json.contains("\"tick_id\":42"));
    }

    #[test]
    fn test_routes_builder_compiles() {
        // This test just verifies the routes() function compiles with the right types.
        // We cannot construct a full VisionState without a real PgPool, but we can
        // verify the function signature is correct.
        fn _assert_returns_router(_state: Arc<VisionState>) -> axum::Router {
            routes(_state)
        }
    }
}
