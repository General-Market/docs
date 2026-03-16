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
        .route("/vision/batch/:id/history", get(batch_history))
        .route("/vision/backtest", post(backtest))
        .route("/vision/bitmap", post(submit_bitmap))
        .route("/vision/balance/:batch_id/:player", get(get_balance))
        .route("/vision/reveal/:batch_id/:tick_id", get(get_reveals))
        .route("/vision/markets", get(markets))
        .route("/vision/leaderboard", get(vision_leaderboard))
        // Dual-balance endpoints (Vision First Deposit)
        .route("/vision/user/:address/balance", get(get_user_balance))
        .route("/vision/deposit/:order_id/status", get(get_deposit_status))
        .route("/vision/withdraw/:withdraw_id/status", get(get_withdraw_status))
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
pub struct TickHistoryEntry {
    pub batch_id: i64,
    pub tick_id: i64,
    pub resolved_at: Option<chrono::NaiveDateTime>,
    pub player_count: Option<i32>,
    pub total_matched: Option<String>,
    pub results_json: Option<serde_json::Value>,
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
            // Build config_hash → market_count map from data-node recommended batches
            let market_counts = fetch_market_counts(&state.config.data_node_url).await;

            let mut summaries = Vec::with_capacity(rows.len());
            for row in rows {
                let batch_id = row.id as u64;
                // Enrich with live player count from scheduler
                let player_count = state.scheduler.player_count(batch_id).await;

                // Compute TVL from in-memory player positions
                let tvl = if let Some((_batch, players)) =
                    state.scheduler.get_batch_state(batch_id).await
                {
                    players
                        .iter()
                        .fold(U256::zero(), |acc, p| acc + p.balance)
                } else {
                    U256::zero()
                };

                let current_tick = state.scheduler.next_tick_for_batch(batch_id).await;

                let config_hash_str = row.config_hash.clone().unwrap_or_default();
                let market_count = market_counts
                    .get(&config_hash_str)
                    .copied()
                    .unwrap_or(0);

                summaries.push(BatchSummary {
                    id: batch_id,
                    creator: row.creator,
                    source_id: bytes32_hex_to_string(&row.source_id.unwrap_or_default()),
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
            let next_tick = state.scheduler.next_tick_for_batch(id).await;

            let mut player_infos = Vec::with_capacity(players.len());
            for p in &players {
                let has_bitmap = state.bitmap_store.get_pending(id, p.player).await.is_some()
                    || state.bitmap_store.get_active(id, p.player).await.is_some();
                player_infos.push(PlayerInfo {
                    address: format!("{:?}", p.player),
                    stake_per_tick: p.stake_per_tick.to_string(),
                    balance: p.balance.to_string(),
                    start_tick: p.start_tick,
                    has_bitmap,
                });
            }

            let response = BatchStateResponse {
                id: batch.id,
                creator: format!("{:?}", batch.creator),
                source_id: bytes32_hex_to_string(&format!("{:?}", batch.source_id)),
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
                    results_json: r.results_json,
                })
                .collect();
            (StatusCode::OK, Json(serde_json::json!({ "history": entries }))).into_response()
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
    resolved_at: Option<chrono::NaiveDateTime>,
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
    let target_tick_id = state.scheduler.next_tick_for_batch(req.batch_id).await;

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
        "SELECT balance, bls_sig, signer_bitmap
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

        // Get stake_per_tick from in-memory state
        let stake = state.scheduler.get_batch_state(batch_id).await
            .and_then(|(_, players)| {
                players.iter().find(|p| p.player == player).map(|p| p.stake_per_tick.to_string())
            })
            .unwrap_or_else(|| "0".to_string());

        let response = BalanceResponse {
            batch_id,
            player: player_hex,
            balance,
            stake_per_tick: stake,
            bls_sig: hex::encode(&bls_sig),
            signer_bitmap,
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
                        balance: pos.balance.to_string(),
                        stake_per_tick: pos.stake_per_tick.to_string(),
                        bls_sig: String::new(),
                        signer_bitmap: "0".to_string(),
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
            let reveal_deadline = tick_end + state.config.reveal_window_secs;

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
}

/// Query params for leaderboard filtering.
#[derive(Debug, Deserialize)]
struct LeaderboardQuery {
    batch_id: Option<u64>,
    source_id: Option<String>,
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
    // When source_id is provided, use Postgres for full historical data
    // (includes completed/paused batches that are no longer in memory).
    if let Some(ref source_id) = query.source_id {
        return leaderboard_from_postgres(&state.pool, Some(source_id), None).await;
    }
    if let Some(bid) = query.batch_id {
        return leaderboard_from_postgres(&state.pool, None, Some(bid)).await;
    }

    // No filter — aggregate from in-memory scheduler (active batches only)
    let all_ids = state.scheduler.get_all_batch_ids().await;

    // player -> (total_balance, total_deposited, batches_joined, largest_batch_markets, batch_wins)
    let mut player_data: std::collections::HashMap<
        Address,
        (u128, u128, usize, usize, usize),
    > = std::collections::HashMap::new();

    for batch_id in &all_ids {
        if let Some((batch, players)) = state.scheduler.get_batch_state(*batch_id).await {
            if batch.paused {
                continue;
            }
            for p in &players {
                let entry = player_data.entry(p.player).or_insert((0, 0, 0, 0, 0));
                let balance = p.balance.as_u128();
                entry.0 += balance;
                let initial = p.initial_deposit.as_u128();
                entry.1 += initial;
                entry.2 += 1;
                if balance > initial {
                    entry.4 += 1;
                }
            }
        }
    }

    // Supplement with Postgres deposits for active batches
    if let Ok(rows) = sqlx::query_as::<_, DepositRow>(
        "SELECT vp.player, SUM(vp.total_deposited::numeric)::bigint as total_deposited
         FROM vision_positions vp
         JOIN vision_batches vb ON vp.batch_id = vb.id
         WHERE vb.paused = false
         GROUP BY vp.player",
    )
    .fetch_all(&state.pool)
    .await
    {
        for row in rows {
            if let Ok(addr) = row.player.parse::<Address>() {
                if let Some(entry) = player_data.get_mut(&addr) {
                    if let Some(dep) = row.total_deposited {
                        if dep > 0 {
                            entry.1 = dep as u128;
                        }
                    }
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
}

/// Build leaderboard from Postgres — used when source_id or batch_id filter is set.
/// Includes ALL batches (active + completed/paused) so historical data is visible.
async fn leaderboard_from_postgres(
    pool: &sqlx::PgPool,
    source_id: Option<&str>,
    batch_id: Option<u64>,
) -> axum::response::Response {
    let query = if let Some(sid) = source_id {
        // source_id in Postgres is stored as bytes32 hex (e.g. "0x70756d7066756e00...")
        // The frontend sends human-readable strings (e.g. "pumpfun"), so convert.
        let hex_sid = string_to_bytes32_hex(sid);
        format!(
            "SELECT vp.player,
                    SUM(vp.balance::numeric)::text as total_balance,
                    SUM(vp.total_deposited::numeric)::text as total_deposited,
                    COUNT(DISTINCT vp.batch_id) as batches_joined,
                    SUM(CASE WHEN vp.balance::numeric > vp.total_deposited::numeric THEN 1 ELSE 0 END) as wins
             FROM vision_positions vp
             JOIN vision_batches vb ON vp.batch_id = vb.id
             WHERE vb.source_id = '{}'
             GROUP BY vp.player",
            hex_sid.replace('\'', "")
        )
    } else if let Some(bid) = batch_id {
        format!(
            "SELECT vp.player,
                    SUM(vp.balance::numeric)::text as total_balance,
                    SUM(vp.total_deposited::numeric)::text as total_deposited,
                    COUNT(DISTINCT vp.batch_id) as batches_joined,
                    SUM(CASE WHEN vp.balance::numeric > vp.total_deposited::numeric THEN 1 ELSE 0 END) as wins
             FROM vision_positions vp
             WHERE vp.batch_id = {}
             GROUP BY vp.player",
            bid
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
    let mut entries: Vec<(String, f64, f64, usize, usize)> = rows
        .into_iter()
        .map(|r| {
            let bal: f64 = r.total_balance.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
            let dep: f64 = r.total_deposited.as_deref().unwrap_or("0").parse().unwrap_or(0.0);
            let batches = r.batches_joined.unwrap_or(0) as usize;
            let wins = r.wins.unwrap_or(0) as usize;
            (r.player, bal, dep, batches, wins)
        })
        .collect();

    // Sort by PnL descending
    entries.sort_by(|a, b| {
        let pnl_a = a.1 - a.2;
        let pnl_b = b.1 - b.2;
        pnl_b.partial_cmp(&pnl_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    let leaderboard: Vec<LeaderboardEntry> = entries
        .iter()
        .enumerate()
        .map(|(i, (addr, bal, dep, batches, wins))| {
            let pnl = (bal - dep) / decimals;
            let deposited = dep / decimals;
            let roi = if deposited > 0.0 { pnl / deposited * 100.0 } else { 0.0 };
            let win_rate = if *batches > 0 {
                *wins as f64 / *batches as f64 * 100.0
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
fn build_leaderboard_from_map(
    player_data: std::collections::HashMap<Address, (u128, u128, usize, usize, usize)>,
) -> Vec<LeaderboardEntry> {
    let mut entries: Vec<(Address, u128, u128, usize, usize, usize)> = player_data
        .into_iter()
        .map(|(addr, (bal, dep, batches, largest, wins))| (addr, bal, dep, batches, largest, wins))
        .collect();

    entries.sort_by(|a, b| {
        let pnl_a = a.1 as i128 - a.2 as i128;
        let pnl_b = b.1 as i128 - b.2 as i128;
        pnl_b.cmp(&pnl_a)
    });

    let decimals = 1e18_f64;
    entries
        .iter()
        .enumerate()
        .map(|(i, (addr, bal, dep, batches, _largest, wins))| {
            let pnl = (*bal as i128 - *dep as i128) as f64 / decimals;
            let deposited = *dep as f64 / decimals;
            let roi = if deposited > 0.0 { pnl / deposited * 100.0 } else { 0.0 };
            let win_rate = if *batches > 0 {
                *wins as f64 / *batches as f64 * 100.0
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
            }
        })
        .collect()
}

/// Row type for deposit queries.
#[derive(Debug, sqlx::FromRow)]
struct DepositRow {
    player: String,
    total_deposited: Option<i64>,
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

    let (real_balance, virtual_balance) = state.scheduler.get_user_balance(user).await;
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
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"batch_id\":1"));
        assert!(json.contains("\"balance\":\"5000000000000000000\""));
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
