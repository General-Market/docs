//! P2Pool REST API endpoints
//!
//! Provides HTTP endpoints for the P2Pool prediction market subsystem.
//! These endpoints serve both Postgres-backed batch/history data and
//! in-memory bitmap/balance state.
//!
//! ## Endpoints
//!
//! **From Postgres (batch/history queries):**
//! - `GET /p2pool/batches` - List active batches with player count + TVL
//! - `GET /p2pool/batch/:id/state` - Single batch state
//! - `GET /p2pool/batch/:id/history` - Tick results (last 100)
//! - `GET /p2pool/backtest` - Strategy backtest (placeholder)
//!
//! **From in-memory state (bitmap/balance):**
//! - `POST /p2pool/bitmap` - Player submits bitmap
//! - `GET /p2pool/balance/:batch_id/:player` - BLS-signed balance proof
//! - `GET /p2pool/reveal/:batch_id/:tick_id` - Published bitmaps after reveal window
//! - `GET /p2pool/markets` - Issuer-curated market whitelist

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Json;
use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use super::bitmap_store::BitmapStore;
use super::config::P2PoolConfig;
use super::tick_scheduler::TickScheduler;

/// Shared state for P2Pool API handlers.
pub struct P2PoolState {
    /// Postgres connection pool for batch/history queries.
    pub pool: sqlx::PgPool,
    /// Tick scheduler: tracks active batches and players in memory.
    pub scheduler: Arc<TickScheduler>,
    /// In-memory bitmap store for player predictions.
    pub bitmap_store: Arc<BitmapStore>,
    /// P2Pool subsystem configuration.
    pub config: P2PoolConfig,
    // TODO: Add TickResolver when Task 3.6 is complete
    // pub resolver: Arc<TickResolver>,
    // TODO: Add BLS signer for balance proofs
    // pub bls_signer: ...,
}

/// Build the axum router for all P2Pool API endpoints.
pub fn routes(state: Arc<P2PoolState>) -> axum::Router {
    axum::Router::new()
        .route("/p2pool/batches", get(list_batches))
        .route("/p2pool/batch/{id}/state", get(batch_state))
        .route("/p2pool/batch/{id}/history", get(batch_history))
        .route("/p2pool/backtest", get(backtest))
        .route("/p2pool/bitmap", post(submit_bitmap))
        .route("/p2pool/balance/{batch_id}/{player}", get(get_balance))
        .route("/p2pool/reveal/{batch_id}/{tick_id}", get(get_reveals))
        .route("/p2pool/markets", get(markets))
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
    pub market_count: usize,
    pub tick_duration: u64,
    pub player_count: usize,
    pub tvl: String,
    pub paused: bool,
}

/// Full batch state response.
#[derive(Debug, Serialize)]
pub struct BatchStateResponse {
    pub id: u64,
    pub creator: String,
    pub market_ids: Vec<String>,
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

/// Balance proof response (placeholder until BLS signing is integrated).
#[derive(Debug, Serialize)]
pub struct BalanceResponse {
    pub batch_id: u64,
    pub player: String,
    pub balance: String,
    pub stake_per_tick: String,
    // TODO: BLS signature fields
    // pub bls_signature: String,
    // pub issuer_id: u8,
    // pub pubkey: String,
}

/// Revealed bitmap for a player after the reveal window has passed.
#[derive(Debug, Serialize)]
pub struct RevealedBitmap {
    pub player: String,
    pub bitmap_hex: String,
    pub hash: String,
}

/// A market in the issuer-curated whitelist.
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
// GET /p2pool/batches
// ---------------------------------------------------------------------------

/// List all active batches with player count and TVL.
///
/// Reads from the in-memory tick scheduler for live data, with optional
/// Postgres fallback for historical batches.
async fn list_batches(
    State(state): State<Arc<P2PoolState>>,
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
        "SELECT id, creator, market_count, tick_duration, paused
         FROM p2pool_batches
         WHERE paused = false
         ORDER BY id DESC
         LIMIT 100"
    )
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(rows) => {
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

                summaries.push(BatchSummary {
                    id: batch_id,
                    creator: row.creator,
                    market_count: row.market_count as usize,
                    tick_duration: row.tick_duration as u64,
                    player_count,
                    tvl: tvl.to_string(),
                    paused: row.paused,
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

/// Row type for batch queries from Postgres.
#[derive(Debug, sqlx::FromRow)]
struct BatchRow {
    id: i64,
    creator: String,
    market_count: i32,
    tick_duration: i64,
    paused: bool,
}

// ---------------------------------------------------------------------------
// GET /p2pool/batch/:id/state
// ---------------------------------------------------------------------------

/// Get full state for a single batch.
async fn batch_state(
    State(state): State<Arc<P2PoolState>>,
    Path(id): Path<u64>,
) -> impl IntoResponse {
    let batch_data = state.scheduler.get_batch_state(id).await;

    match batch_data {
        Some((batch, players)) => {
            let next_tick = state.scheduler.next_tick_for_batch(id).await;

            let mut player_infos = Vec::with_capacity(players.len());
            for p in &players {
                let has_bitmap = state.bitmap_store.get(id, p.player).await.is_some();
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
                market_ids: batch.market_ids.iter().map(|m| format!("{:?}", m)).collect(),
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
// GET /p2pool/batch/:id/history
// ---------------------------------------------------------------------------

/// Get tick result history for a batch (last 100 ticks).
async fn batch_history(
    State(state): State<Arc<P2PoolState>>,
    Path(id): Path<u64>,
) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, TickResultRow>(
        "SELECT batch_id, tick_id, resolved_at, player_count, total_matched, results_json
         FROM p2pool_tick_results
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
// GET /p2pool/backtest
// ---------------------------------------------------------------------------

/// Strategy backtest endpoint (placeholder).
///
/// Full implementation requires price data integration from the data-node
/// and the tick resolver engine. This will be implemented when those
/// components are ready.
async fn backtest(
    State(_state): State<Arc<P2PoolState>>,
) -> impl IntoResponse {
    // TODO: Implement backtest logic
    // This needs:
    // 1. Historical price data from data-node
    // 2. A simulated tick resolver running over historical periods
    // 3. Parameters: strategy bitmap, batch config, time range
    //
    // For now, return a placeholder response indicating the endpoint exists
    // but is not yet implemented.
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(ApiError::new("Backtest not yet implemented — requires price data integration")),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// POST /p2pool/bitmap
// ---------------------------------------------------------------------------

/// Player submits their prediction bitmap off-chain.
///
/// The bitmap is verified against its keccak256 hash, which must match
/// the player's on-chain commitment hash. If verification passes, the
/// bitmap is stored in memory for use during tick resolution.
async fn submit_bitmap(
    State(state): State<Arc<P2PoolState>>,
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

    // Store the bitmap (BitmapStore verifies keccak256(bitmap) == expected_hash)
    match state
        .bitmap_store
        .store(player, req.batch_id, bitmap, expected_hash)
        .await
    {
        Ok(()) => {
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
// GET /p2pool/balance/:batch_id/:player
// ---------------------------------------------------------------------------

/// Get a player's current balance in a batch.
///
/// In the full implementation, this will return a BLS-signed balance proof
/// that the player can submit on-chain for withdrawals. For now, it returns
/// the unsigned balance from the in-memory scheduler state.
async fn get_balance(
    State(state): State<Arc<P2PoolState>>,
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
                    // TODO: Add BLS signature for balance proof
                    // The balance proof must be signed by this issuer's BLS key
                    // so players can aggregate signatures from 2/3+ issuers
                    // and submit the proof on-chain for withdrawals.
                    //
                    // Message hash: keccak256(abi.encodePacked(
                    //     batchId, player, balance, tickId
                    // ))
                    let response = BalanceResponse {
                        batch_id,
                        player: format!("{:?}", player),
                        balance: pos.balance.to_string(),
                        stake_per_tick: pos.stake_per_tick.to_string(),
                    };
                    (StatusCode::OK, Json(response)).into_response()
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// GET /p2pool/reveal/:batch_id/:tick_id
// ---------------------------------------------------------------------------

/// Get revealed bitmaps for a batch tick after the reveal window has passed.
///
/// Bitmaps are only published after the reveal window expires, so that
/// players cannot see opponents' predictions before committing their own.
async fn get_reveals(
    State(state): State<Arc<P2PoolState>>,
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
    let bitmaps = state.bitmap_store.get_all_for_batch(batch_id).await;

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
// GET /p2pool/markets
// ---------------------------------------------------------------------------

/// Get the issuer-curated market whitelist.
///
/// Returns the set of markets (price feeds) that this issuer supports
/// for P2Pool prediction batches. Batch creators must select from this
/// list when creating new batches.
async fn markets(
    State(_state): State<Arc<P2PoolState>>,
) -> impl IntoResponse {
    // TODO: Load market whitelist from configuration or data-node.
    // For now, return a static placeholder list of common crypto markets.
    // In production, this would be loaded from P2PoolConfig or queried
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
            market_count: 5,
            tick_duration: 3600,
            player_count: 10,
            tvl: "1000000000000000000".into(),
            paused: false,
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
        // We cannot construct a full P2PoolState without a real PgPool, but we can
        // verify the function signature is correct.
        fn _assert_returns_router(_state: Arc<P2PoolState>) -> axum::Router {
            routes(_state)
        }
    }
}
