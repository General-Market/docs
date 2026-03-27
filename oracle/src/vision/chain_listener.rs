//! Unified Vision.sol chain listener + indexer
//!
//! Watches Vision.sol events via HTTP polling (same pattern as `ArbitrationListener`).
//! Each event triggers BOTH:
//! 1. In-memory scheduler update (feeds tick resolution engine)
//! 2. Postgres write (persists batch/position/tick state for REST API)
//!
//! Single indexer eliminates consistency issues between scheduler and database.

use ethers::abi::{self, Token};
use ethers::providers::{Http, Middleware, Provider};
use ethers::types::{Address, Filter, H256, Log, U256, U64};
use sqlx::PgPool;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tracing::{debug, info, warn};

use super::tick_scheduler::TickScheduler;
use super::types::{Batch, PlayerPosition};

/// Poll interval for checking new blocks (seconds).
const POLL_INTERVAL_SECS: u64 = 2;

/// Maximum number of blocks to query per batch to avoid RPC timeouts.
const MAX_BLOCK_RANGE: u64 = 2000;

/// Unified chain listener: watches Vision.sol events, updates BOTH the in-memory
/// tick scheduler AND Postgres tables (vision_batches, vision_positions, etc.).
pub struct ChainListener {
    provider: Arc<Provider<Http>>,
    vision_address: Address,
    scheduler: Arc<TickScheduler>,
    pool: PgPool,
    start_block: u64,
}

/// Computed event topic hashes (keccak256 of signatures).
struct EventTopics {
    batch_created: H256,
    batch_paused: H256,
    batch_unpaused: H256,
    batch_config_updated: H256,
    batch_config_promoted: H256,
    player_joined: H256,
    bitmap_updated: H256,
    player_withdrawn: H256,
}

impl EventTopics {
    fn new() -> Self {
        Self {
            batch_created: H256::from(ethers::utils::keccak256(
                b"BatchCreated(uint256,bytes32,address,bytes32,uint256,uint256)",
            )),
            batch_paused: H256::from(ethers::utils::keccak256(
                b"BatchPausedEvent(uint256)",
            )),
            batch_unpaused: H256::from(ethers::utils::keccak256(
                b"BatchUnpaused(uint256)",
            )),
            batch_config_updated: H256::from(ethers::utils::keccak256(
                b"BatchConfigUpdated(uint256,bytes32,uint256,uint256)",
            )),
            batch_config_promoted: H256::from(ethers::utils::keccak256(
                b"BatchConfigPromoted(uint256,bytes32,bytes32,uint256)",
            )),
            player_joined: H256::from(ethers::utils::keccak256(
                b"PlayerJoined(uint256,address,uint256,bytes32,bytes32)",
            )),
            bitmap_updated: H256::from(ethers::utils::keccak256(
                b"BitmapUpdated(uint256,address,bytes32,bytes32)",
            )),
            player_withdrawn: H256::from(ethers::utils::keccak256(
                b"PlayerWithdrawn(uint256,address,uint256)",
            )),
        }
    }
}

/// Fetched batch data from the contract (intermediate struct for decoding).
struct FetchedBatchData {
    source_id: H256,
    config_hash: H256,
    lock_offset: u64,
    created_at_tick: u64,
    paused: bool,
    settled: bool,
}

impl ChainListener {
    pub fn new(
        provider: Arc<Provider<Http>>,
        vision_address: Address,
        scheduler: Arc<TickScheduler>,
        pool: PgPool,
        start_block: u64,
    ) -> Self {
        Self {
            provider,
            vision_address,
            scheduler,
            pool,
            start_block,
        }
    }

    /// Run the chain listener: replay from bookmark, then poll for new events.
    pub async fn run(self, shutdown: Arc<AtomicBool>) {
        info!(
            vision = %self.vision_address,
            start_block = self.start_block,
            "ChainListener starting"
        );

        let topics = EventTopics::new();

        // Repair batches with zero config_hash from previous failed contract reads
        self.repair_zero_config_hashes().await;

        // Determine where to start: bookmark from Postgres, or config start_block.
        let mut cursor = match self.get_last_indexed_block().await {
            Some(block) => {
                info!(block, "Resuming from Postgres bookmark");
                block + 1
            }
            None => {
                info!(block = self.start_block, "No bookmark found, starting from config start_block");
                self.start_block
            }
        };

        loop {
            if shutdown.load(Ordering::Relaxed) {
                info!("ChainListener shutting down");
                break;
            }

            // Get current chain tip
            let tip = match self.provider.get_block_number().await {
                Ok(n) => n.as_u64(),
                Err(e) => {
                    warn!(error = %e, "Failed to get block number, retrying...");
                    tokio::time::sleep(std::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;
                    continue;
                }
            };

            if cursor > tip {
                // Caught up — wait for new blocks
                tokio::time::sleep(std::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;
                continue;
            }

            // Clamp block range to avoid RPC timeouts
            let to_block = std::cmp::min(cursor + MAX_BLOCK_RANGE - 1, tip);

            match self.process_block_range(cursor, to_block, &topics).await {
                Ok(count) => {
                    if count > 0 {
                        info!(
                            from = cursor,
                            to = to_block,
                            events = count,
                            "Processed Vision events"
                        );
                    } else {
                        debug!(from = cursor, to = to_block, "No events in range");
                    }

                    // Save bookmark
                    if let Err(e) = self.save_last_indexed_block(to_block).await {
                        warn!(error = %e, block = to_block, "Failed to save bookmark");
                    }

                    cursor = to_block + 1;
                }
                Err(e) => {
                    warn!(
                        error = %e,
                        from = cursor,
                        to = to_block,
                        "Failed to process block range, retrying..."
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;
                }
            }

            // If caught up to tip, sleep before next poll
            if to_block >= tip {
                tokio::time::sleep(std::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;
            }
        }

        info!("ChainListener stopped");
    }

    /// Fetch and process all Vision events in a block range.
    async fn process_block_range(
        &self,
        from_block: u64,
        to_block: u64,
        topics: &EventTopics,
    ) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let filter = Filter::new()
            .address(self.vision_address)
            .from_block(U64::from(from_block))
            .to_block(U64::from(to_block));

        let logs = self.provider.get_logs(&filter).await?;
        let count = logs.len();

        for log in logs {
            if let Some(topic0) = log.topics.first() {
                if *topic0 == topics.batch_created {
                    self.handle_batch_created(&log).await;
                } else if *topic0 == topics.batch_paused {
                    self.handle_batch_paused(&log).await;
                } else if *topic0 == topics.batch_unpaused {
                    self.handle_batch_unpaused(&log).await;
                } else if *topic0 == topics.batch_config_updated {
                    self.handle_batch_config_updated(&log).await;
                } else if *topic0 == topics.batch_config_promoted {
                    self.handle_batch_config_promoted(&log).await;
                } else if *topic0 == topics.player_joined {
                    self.handle_player_joined(&log).await;
                } else if *topic0 == topics.bitmap_updated {
                    self.handle_bitmap_updated(&log).await;
                } else if *topic0 == topics.player_withdrawn {
                    self.handle_player_withdrawn(&log).await;
                }
            }
        }

        Ok(count)
    }

    // =========================================================================
    // Event handlers — each updates scheduler (in-memory) AND Postgres
    // =========================================================================

    /// Handle `BatchCreated(uint256 indexed batchId, address indexed creator, bytes32 indexed sourceId, uint256 tickDuration)`
    ///
    /// The event contains batchId, creator, sourceId (all indexed) and tickDuration (data).
    /// We fetch the full batch from the contract to get configHash, lockOffset, etc.
    async fn handle_batch_created(&self, log: &Log) {
        // Event: BatchCreated(uint256 indexed batchId, bytes32 indexed sourceId, address indexed creator, bytes32 configHash, uint256 tickDuration, uint256 lockOffset)
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("BatchCreated: missing batchId topic");
                return;
            }
        };
        let source_id_from_event = log
            .topics
            .get(2)
            .copied()
            .unwrap_or(H256::zero());
        let creator = match extract_indexed_address(log, 3) {
            Some(v) => v,
            None => {
                warn!(batch_id, "BatchCreated: missing creator topic");
                return;
            }
        };
        // data = configHash (bytes32) + tickDuration (uint256) + lockOffset (uint256)
        let (config_hash_from_event, tick_duration) = if log.data.len() >= 64 {
            let tuple = ethers::abi::decode(
                &[ethers::abi::ParamType::FixedBytes(32), ethers::abi::ParamType::Uint(256), ethers::abi::ParamType::Uint(256)],
                &log.data,
            );
            match tuple {
                Ok(tokens) => {
                    let ch = match &tokens[0] {
                        Token::FixedBytes(b) if b.len() == 32 => H256::from_slice(b),
                        _ => H256::zero(),
                    };
                    let td = tokens[1].clone().into_uint().map(|v| v.as_u64()).unwrap_or(0);
                    (ch, td)
                }
                Err(_) => {
                    warn!(batch_id, "BatchCreated: failed to decode data tuple");
                    return;
                }
            }
        } else {
            match decode_single_u256(&log.data) {
                Some(v) => (H256::zero(), v.as_u64()),
                None => {
                    warn!(batch_id, "BatchCreated: failed to decode tickDuration from data");
                    return;
                }
            }
        };

        // Fetch full batch from contract to get sourceId, configHash, etc.
        let batch = match self.fetch_batch_from_contract(batch_id).await {
            Some(fetched) => Batch {
                id: batch_id,
                creator,
                source_id: fetched.source_id,
                config_hash: fetched.config_hash,
                tick_duration,
                lock_offset: fetched.lock_offset,
                created_at_tick: fetched.created_at_tick,
                paused: fetched.paused,
                settled: fetched.settled,
            },
            None => {
                // Fallback: use block timestamp to compute created_at_tick
                let created_at_tick = match self.get_block_timestamp(log).await {
                    Some(ts) => {
                        if tick_duration > 0 {
                            ts / tick_duration
                        } else {
                            0
                        }
                    }
                    None => 0,
                };
                warn!(
                    batch_id,
                    "Failed to fetch batch from contract, using fallback"
                );
                Batch {
                    id: batch_id,
                    creator,
                    source_id: source_id_from_event,
                    config_hash: config_hash_from_event,
                    tick_duration,
                    lock_offset: 0,
                    created_at_tick,
                    paused: false,
                    settled: false,
                }
            }
        };

        // 1. Update in-memory scheduler
        self.scheduler.on_batch_created(batch.clone()).await;

        // 2. Write to Postgres
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_batches (id, creator, tick_duration, created_at_tick, paused, source_id, config_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
                tick_duration = EXCLUDED.tick_duration,
                paused = EXCLUDED.paused,
                source_id = EXCLUDED.source_id,
                config_hash = EXCLUDED.config_hash"
        )
        .bind(batch.id as i64)
        .bind(format!("{:?}", batch.creator))
        .bind(batch.tick_duration as i64)
        .bind(batch.created_at_tick as i64)
        .bind(false)
        .bind(format!("{:?}", batch.source_id))
        .bind(format!("{:?}", batch.config_hash))
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, error = %e, "Failed to insert batch into Postgres");
        }

        info!(
            batch_id,
            creator = %creator,
            tick_duration,
            config_hash = ?batch.config_hash,
            created_at_tick = batch.created_at_tick,
            "BatchCreated"
        );
    }

    /// Handle `BatchPausedEvent(uint256 indexed batchId)`
    async fn handle_batch_paused(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("BatchPausedEvent: missing batchId topic");
                return;
            }
        };

        // 1. Update in-memory scheduler
        if let Err(e) = self.scheduler.on_batch_paused(batch_id).await {
            warn!(batch_id, error = %e, "Scheduler on_batch_paused failed");
        }

        // 2. Update Postgres
        if let Err(e) = sqlx::query("UPDATE vision_batches SET paused = true WHERE id = $1")
            .bind(batch_id as i64)
            .execute(&self.pool)
            .await
        {
            warn!(batch_id, error = %e, "Failed to update batch paused in Postgres");
        }

        info!(batch_id, "BatchPaused");
    }

    /// Handle `BatchUnpaused(uint256 indexed batchId)`
    async fn handle_batch_unpaused(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("BatchUnpaused: missing batchId topic");
                return;
            }
        };

        // 1. Update in-memory scheduler
        if let Err(e) = self.scheduler.on_batch_unpaused(batch_id).await {
            warn!(batch_id, error = %e, "Scheduler on_batch_unpaused failed");
        }

        // 2. Update Postgres
        if let Err(e) = sqlx::query("UPDATE vision_batches SET paused = false WHERE id = $1")
            .bind(batch_id as i64)
            .execute(&self.pool)
            .await
        {
            warn!(batch_id, error = %e, "Failed to update batch unpaused in Postgres");
        }

        info!(batch_id, "BatchUnpaused");
    }

    /// Handle `BatchConfigUpdated` (legacy event — no longer emitted by current contract).
    ///
    /// Kept for backward-compatible log replay. Updates config_hash directly.
    async fn handle_batch_config_updated(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("BatchConfigUpdated: missing batchId topic");
                return;
            }
        };

        // Data: nextConfigHash (bytes32) + nextLockOffset (uint256) + nextTickDuration (uint256) = 96 bytes
        if log.data.len() < 96 {
            warn!(batch_id, "BatchConfigUpdated: data too short");
            return;
        }
        let new_config_hash = H256::from_slice(&log.data[0..32]);
        let new_lock_offset = U256::from_big_endian(&log.data[32..64]).as_u64();
        let new_tick_duration = U256::from_big_endian(&log.data[64..96]).as_u64();

        // 1. Update in-memory scheduler
        self.scheduler
            .on_batch_config_updated(batch_id, new_config_hash, new_lock_offset, new_tick_duration)
            .await;

        // 2. Update Postgres
        if let Err(e) = sqlx::query(
            "UPDATE vision_batches SET config_hash = $1 WHERE id = $2",
        )
        .bind(format!("{:?}", new_config_hash))
        .bind(batch_id as i64)
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, error = %e, "Failed to update batch config in Postgres");
        }

        info!(
            batch_id,
            new_config_hash = ?new_config_hash,
            new_lock_offset,
            new_tick_duration,
            "BatchConfigUpdated (legacy)"
        );
    }

    /// Handle `BatchConfigPromoted` (legacy event — no longer emitted by current contract).
    ///
    /// Kept for backward-compatible log replay. Updates config_hash directly.
    async fn handle_batch_config_promoted(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("BatchConfigPromoted: missing batchId topic");
                return;
            }
        };

        // Data: oldConfigHash (bytes32) + newConfigHash (bytes32) + atTick (uint256) = 96 bytes
        if log.data.len() < 96 {
            warn!(batch_id, "BatchConfigPromoted: data too short");
            return;
        }
        let config_hash = H256::from_slice(&log.data[32..64]); // newConfigHash
        let promoted_at_tick = U256::from_big_endian(&log.data[64..96]).as_u64();

        // 1. Update in-memory scheduler
        self.scheduler
            .on_batch_config_promoted(batch_id, config_hash, promoted_at_tick)
            .await;

        // 2. Update Postgres
        if let Err(e) = sqlx::query(
            "UPDATE vision_batches SET config_hash = $1 WHERE id = $2",
        )
        .bind(format!("{:?}", config_hash))
        .bind(batch_id as i64)
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, error = %e, "Failed to update promoted config in Postgres");
        }

        info!(
            batch_id,
            config_hash = ?config_hash,
            promoted_at_tick,
            "BatchConfigPromoted (legacy)"
        );
    }

    /// Handle `PlayerJoined(uint256 indexed batchId, address indexed player, uint256 stakePerTick, bytes32 bitmapHash, bytes32 configHash)`
    async fn handle_player_joined(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("PlayerJoined: missing batchId topic");
                return;
            }
        };
        let player = match extract_indexed_address(log, 2) {
            Some(v) => v,
            None => {
                warn!(batch_id, "PlayerJoined: missing player topic");
                return;
            }
        };

        // Data: deposit (uint256, was stakePerTick) + bitmapHash (bytes32) = 64 bytes
        if log.data.len() < 64 {
            warn!(batch_id, player = %player, "PlayerJoined: data too short");
            return;
        }
        let deposit = U256::from_big_endian(&log.data[0..32]);
        let bitmap_hash = H256::from_slice(&log.data[32..64]);

        let position = PlayerPosition {
            player,
            bitmap_hash,
            deposit,
            initial_deposit: deposit,
        };

        // 1. Update in-memory scheduler
        self.scheduler.on_player_joined(batch_id, position).await;

        // 2. Write to Postgres
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_positions (batch_id, player, stake_per_tick, bitmap_hash, start_tick, balance, join_timestamp, total_deposited)
             VALUES ($1, $2, $3::numeric, $4, 0, $5::numeric, 0, $6::numeric)
             ON CONFLICT (batch_id, player) DO UPDATE SET
                stake_per_tick = EXCLUDED.stake_per_tick,
                bitmap_hash = EXCLUDED.bitmap_hash,
                balance = EXCLUDED.balance,
                total_deposited = EXCLUDED.total_deposited"
        )
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .bind(deposit.to_string())
        .bind(format!("{:?}", bitmap_hash))
        .bind(deposit.to_string())
        .bind(deposit.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, player = %player, error = %e, "Failed to insert position into Postgres");
        }

        // 3. Sync player_count in vision_batch_lifecycle from vision_positions.
        // Uses a subquery count instead of bare increment to stay idempotent
        // when the chain_listener replays blocks after a restart.
        if let Err(e) = sqlx::query(
            "UPDATE vision_batch_lifecycle SET player_count = (
                SELECT COUNT(DISTINCT player)::integer FROM vision_positions WHERE batch_id = $1
             ) WHERE batch_id = $1"
        )
        .bind(batch_id as i64)
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, player = %player, error = %e, "Failed to sync lifecycle player_count");
        }

        info!(
            batch_id,
            player = %player,
            deposit = %deposit,
            "PlayerJoined"
        );
    }

    /// Handle `BitmapUpdated(uint256 indexed batchId, address indexed player, bytes32 newBitmapHash, bytes32 configHash)`
    async fn handle_bitmap_updated(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("BitmapUpdated: missing batchId topic");
                return;
            }
        };
        let player = match extract_indexed_address(log, 2) {
            Some(v) => v,
            None => {
                warn!(batch_id, "BitmapUpdated: missing player topic");
                return;
            }
        };

        // Data: newBitmapHash (bytes32) + configHash (bytes32) = 64 bytes
        if log.data.len() < 64 {
            warn!(batch_id, player = %player, "BitmapUpdated: data too short");
            return;
        }
        let new_bitmap_hash = H256::from_slice(&log.data[0..32]);

        // 1. Update in-memory scheduler
        if let Err(e) = self.scheduler.on_bitmap_updated(batch_id, player, new_bitmap_hash).await {
            warn!(batch_id, player = %player, error = %e, "BitmapUpdated: scheduler update failed");
        }

        // 2. Update Postgres
        if let Err(e) = sqlx::query(
            "UPDATE vision_positions SET bitmap_hash = $1 WHERE batch_id = $2 AND player = $3"
        )
        .bind(format!("{:?}", new_bitmap_hash))
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, player = %player, error = %e, "BitmapUpdated: Postgres update failed");
        }

        info!(
            batch_id,
            player = %player,
            new_bitmap_hash = %new_bitmap_hash,
            "BitmapUpdated"
        );
    }

    /// Handle `PlayerWithdrawn(uint256 indexed batchId, address indexed player, uint256 amount)`
    async fn handle_player_withdrawn(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("PlayerWithdrawn: missing batchId topic");
                return;
            }
        };
        let player = match extract_indexed_address(log, 2) {
            Some(v) => v,
            None => {
                warn!(batch_id, "PlayerWithdrawn: missing player topic");
                return;
            }
        };

        // 1. Update in-memory scheduler (removes the player)
        if let Err(e) = self.scheduler.on_player_withdrawn(batch_id, player).await {
            warn!(batch_id, player = %player, error = %e, "Scheduler on_player_withdrawn failed");
        }

        // 2. Delete from Postgres
        if let Err(e) = sqlx::query(
            "DELETE FROM vision_positions WHERE batch_id = $1 AND player = $2",
        )
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, player = %player, error = %e, "Failed to delete position from Postgres");
        }

        info!(batch_id, player = %player, "PlayerWithdrawn");
    }

    // =========================================================================
    // Contract read helpers — raw ABI-encoded calls (no abigen!)
    // =========================================================================

    /// Repair batches with zero config_hash by re-fetching from the contract.
    ///
    /// Public so it can be called synchronously from main before the HTTP server starts,
    /// ensuring the in-memory scheduler never serves stale zero hashes on first request.
    pub async fn repair_zero_config_hashes(&self) {
        let zero_hash = "0x0000000000000000000000000000000000000000000000000000000000000000";
        // Catch both the canonical zero-hash string AND empty string (written by older code paths).
        let zero_batches: Vec<(i64,)> = match sqlx::query_as(
            "SELECT id FROM vision_batches WHERE config_hash = '' OR config_hash = $1"
        ).bind(zero_hash).fetch_all(&self.pool).await {
            Ok(rows) => rows,
            Err(e) => { warn!(error = %e, "repair_zero_config_hashes query failed"); return; }
        };
        if zero_batches.is_empty() { return; }
        info!(count = zero_batches.len(), "Repairing batches with zero config_hash");
        let mut repaired = 0usize;
        for (bid,) in &zero_batches {
            if let Some(f) = self.fetch_batch_from_contract(*bid as u64).await {
                if f.config_hash != H256::zero() {
                    let h = format!("0x{}", hex::encode(f.config_hash));
                    let s = format!("0x{}", hex::encode(f.source_id));
                    if sqlx::query("UPDATE vision_batches SET config_hash=$1, source_id=$2, lock_offset=$3, created_at_tick=$4 WHERE id=$5")
                        .bind(&h).bind(&s).bind(f.lock_offset as i64).bind(f.created_at_tick as i64).bind(*bid)
                        .execute(&self.pool).await.is_ok() {
                        self.scheduler.update_config_hash(*bid as u64, f.config_hash, f.source_id).await;
                        repaired += 1;
                    }
                }
            }
        }
        info!(repaired, total = zero_batches.len(), "Config hash repair complete");
    }

    /// Fetch full batch data from Vision.getBatch(uint256).
    ///
    /// Returns the decoded batch fields needed to construct a Batch struct.
    async fn fetch_batch_from_contract(
        &self,
        batch_id: u64,
    ) -> Option<FetchedBatchData> {
        // getBatch(uint256) selector = keccak256("getBatch(uint256)")[:4]
        let selector = &ethers::utils::keccak256(b"getBatch(uint256)")[..4];
        let encoded_arg = abi::encode(&[Token::Uint(U256::from(batch_id))]);

        let mut calldata = Vec::with_capacity(4 + encoded_arg.len());
        calldata.extend_from_slice(selector);
        calldata.extend_from_slice(&encoded_arg);

        let tx = ethers::types::TransactionRequest::new()
            .to(self.vision_address)
            .data(calldata);

        let result = match self.provider.call(&tx.into(), None).await {
            Ok(r) => r,
            Err(e) => {
                warn!(batch_id, error = %e, "getBatch call failed");
                return None;
            }
        };

        // Decode the 8-field Batch struct tuple (must match IVision.sol exactly):
        // (address creator, bytes32 sourceId, bytes32 configHash,
        //  uint256 tickDuration, uint256 lockOffset,
        //  uint256 createdAtTick, bool paused, bool settled)
        let tokens = match abi::decode(
            &[abi::ParamType::Tuple(vec![
                abi::ParamType::Address,           // [0] creator
                abi::ParamType::FixedBytes(32),     // [1] sourceId
                abi::ParamType::FixedBytes(32),     // [2] configHash
                abi::ParamType::Uint(256),          // [3] tickDuration
                abi::ParamType::Uint(256),          // [4] lockOffset
                abi::ParamType::Uint(256),          // [5] createdAtTick
                abi::ParamType::Bool,               // [6] paused
                abi::ParamType::Bool,               // [7] settled
            ])],
            &result,
        ) {
            Ok(t) => t,
            Err(e) => {
                warn!(batch_id, error = %e, "Failed to decode getBatch result");
                return None;
            }
        };

        let tuple = match tokens.into_iter().next()? {
            Token::Tuple(t) => t,
            _ => return None,
        };

        // tuple[0] = creator (skip, from event)
        // tuple[1] = sourceId
        let source_id = match &tuple[1] {
            Token::FixedBytes(b) if b.len() == 32 => H256::from_slice(b),
            _ => H256::zero(),
        };

        // tuple[2] = configHash
        let config_hash = match &tuple[2] {
            Token::FixedBytes(b) if b.len() == 32 => H256::from_slice(b),
            _ => H256::zero(),
        };

        // tuple[3] = tickDuration (skip, from event)
        // tuple[4] = lockOffset
        let lock_offset = match &tuple[4] {
            Token::Uint(v) => v.as_u64(),
            _ => 0,
        };

        // tuple[5] = createdAtTick
        let created_at_tick = match &tuple[5] {
            Token::Uint(v) => v.as_u64(),
            _ => 0,
        };

        // tuple[6] = paused
        let paused = match &tuple[6] {
            Token::Bool(v) => *v,
            _ => false,
        };

        // tuple[7] = settled
        let settled = match &tuple[7] {
            Token::Bool(v) => *v,
            _ => false,
        };

        Some(FetchedBatchData {
            source_id,
            config_hash,
            lock_offset,
            created_at_tick,
            paused,
            settled,
        })
    }

    /// Fetch a player's current balance from Vision.getPosition(uint256,address).
    async fn fetch_position_balance(&self, batch_id: u64, player: Address, at_block: Option<ethers::types::BlockId>) -> Option<U256> {
        // getPosition(uint256,address) selector
        let selector =
            &ethers::utils::keccak256(b"getPosition(uint256,address)")[..4];
        let encoded_args = abi::encode(&[
            Token::Uint(U256::from(batch_id)),
            Token::Address(player),
        ]);

        let mut calldata = Vec::with_capacity(4 + encoded_args.len());
        calldata.extend_from_slice(selector);
        calldata.extend_from_slice(&encoded_args);

        let tx = ethers::types::TransactionRequest::new()
            .to(self.vision_address)
            .data(calldata);

        let result = match self.provider.call(&tx.into(), at_block).await {
            Ok(r) => r,
            Err(e) => {
                warn!(batch_id, player = %player, error = %e, "getPosition call failed");
                return None;
            }
        };

        // Decode PlayerPosition struct:
        // (bytes32 bitmapHash, bytes32 configHash, uint256 stakePerTick, uint256 startTick,
        //  uint256 balance, uint256 lastClaimedTick, uint256 joinTimestamp, uint256 totalDeposited, uint256 totalClaimed)
        let tokens = match abi::decode(
            &[abi::ParamType::Tuple(vec![
                abi::ParamType::FixedBytes(32),  // bitmapHash
                abi::ParamType::FixedBytes(32),  // configHash
                abi::ParamType::Uint(256),       // stakePerTick
                abi::ParamType::Uint(256),       // startTick
                abi::ParamType::Uint(256),       // balance
                abi::ParamType::Uint(256),       // lastClaimedTick
                abi::ParamType::Uint(256),       // joinTimestamp
                abi::ParamType::Uint(256),       // totalDeposited
                abi::ParamType::Uint(256),       // totalClaimed
            ])],
            &result,
        ) {
            Ok(t) => t,
            Err(e) => {
                warn!(batch_id, player = %player, error = %e, "Failed to decode getPosition result");
                return None;
            }
        };

        let tuple = match tokens.into_iter().next()? {
            Token::Tuple(t) => t,
            _ => return None,
        };

        // tuple[4] = balance
        match &tuple[4] {
            Token::Uint(v) => Some(*v),
            _ => None,
        }
    }

    /// Get the block timestamp for a log's block.
    async fn get_block_timestamp(&self, log: &Log) -> Option<u64> {
        let block_number = log.block_number?;
        let block = self
            .provider
            .get_block(block_number)
            .await
            .ok()
            .flatten()?;
        Some(block.timestamp.as_u64())
    }

    // =========================================================================
    // Bookmark persistence (kv_store table in Postgres)
    // =========================================================================

    /// Get the last indexed block number from Postgres kv_store.
    async fn get_last_indexed_block(&self) -> Option<u64> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT value FROM vision_kv_store WHERE key = 'chain_listener_last_block'",
        )
        .fetch_optional(&self.pool)
        .await
        .ok()?;

        row.and_then(|(v,)| v.parse::<u64>().ok())
    }

    /// Save the last indexed block number to Postgres kv_store.
    async fn save_last_indexed_block(
        &self,
        block: u64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO vision_kv_store (key, value)
             VALUES ('chain_listener_last_block', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(block.to_string())
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}

// =============================================================================
// Log parsing helpers
// =============================================================================

/// Extract an indexed `uint256` value from a log topic at the given index,
/// returning it as `u64`. Returns `None` if the topic is missing.
fn extract_indexed_u64(log: &Log, topic_index: usize) -> Option<u64> {
    let topic = log.topics.get(topic_index)?;
    Some(U256::from(topic.as_bytes()).as_u64())
}

/// Extract an indexed `address` value from a log topic at the given index.
/// Addresses are left-padded to 32 bytes in topics.
fn extract_indexed_address(log: &Log, topic_index: usize) -> Option<Address> {
    let topic = log.topics.get(topic_index)?;
    Some(Address::from_slice(&topic.as_bytes()[12..]))
}

/// Decode a single `uint256` from ABI-encoded data bytes.
fn decode_single_u256(data: &[u8]) -> Option<U256> {
    if data.len() < 32 {
        return None;
    }
    Some(U256::from_big_endian(&data[0..32]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::Bytes;

    #[test]
    fn test_event_topic_hashes() {
        let topics = EventTopics::new();

        // Verify a few known event signatures
        assert_ne!(topics.batch_created, H256::zero());
        assert_ne!(topics.player_joined, H256::zero());
        assert_ne!(topics.batch_paused, H256::zero());

        // Verify new event topics exist
        assert_ne!(topics.batch_config_updated, H256::zero());
        assert_ne!(topics.batch_config_promoted, H256::zero());

        // Verify dual-balance event topics
        assert_ne!(topics.balance_credited, H256::zero());
        assert_ne!(topics.balance_deposited, H256::zero());
        assert_ne!(topics.real_balance_withdrawn, H256::zero());
        assert_ne!(topics.withdraw_to_settlement_requested, H256::zero());
        assert_ne!(topics.balance_debited, H256::zero());

        // All topics should be distinct
        let all = vec![
            topics.batch_created,
            topics.batch_paused,
            topics.batch_unpaused,
            topics.batch_config_updated,
            topics.batch_config_promoted,
            topics.player_joined,
            topics.player_deposited,
            topics.rewards_claimed,
            topics.player_withdrawn,
            topics.force_withdrawn,
            topics.balance_credited,
            topics.balance_deposited,
            topics.real_balance_withdrawn,
            topics.withdraw_to_settlement_requested,
            topics.balance_debited,
        ];
        let unique: std::collections::HashSet<_> = all.iter().collect();
        assert_eq!(unique.len(), all.len(), "All event topics must be unique");
    }

    #[test]
    fn test_extract_indexed_u64() {
        let mut batch_id_bytes = [0u8; 32];
        U256::from(42u64).to_big_endian(&mut batch_id_bytes);

        let log = Log {
            topics: vec![H256::zero(), H256::from(batch_id_bytes)],
            ..Default::default()
        };

        assert_eq!(extract_indexed_u64(&log, 1), Some(42));
        assert_eq!(extract_indexed_u64(&log, 2), None);
    }

    #[test]
    fn test_extract_indexed_address() {
        let addr = Address::from([0xABu8; 20]);
        let mut topic_bytes = [0u8; 32];
        topic_bytes[12..].copy_from_slice(addr.as_bytes());

        let log = Log {
            topics: vec![H256::zero(), H256::from(topic_bytes)],
            ..Default::default()
        };

        assert_eq!(extract_indexed_address(&log, 1), Some(addr));
        assert_eq!(extract_indexed_address(&log, 2), None);
    }

    #[test]
    fn test_decode_single_u256() {
        let mut data = vec![0u8; 32];
        U256::from(12345u64).to_big_endian(&mut data);

        assert_eq!(decode_single_u256(&data), Some(U256::from(12345u64)));
        assert_eq!(decode_single_u256(&[]), None);
        assert_eq!(decode_single_u256(&[0u8; 31]), None);
    }
}
