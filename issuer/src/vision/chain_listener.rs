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
    player_deposited: H256,
    rewards_claimed: H256,
    player_withdrawn: H256,
    force_withdrawn: H256,
    // Dual-balance events (Vision First Deposit)
    balance_credited: H256,
    balance_deposited: H256,
    real_balance_withdrawn: H256,
    withdraw_to_settlement_requested: H256,
    balance_debited: H256,
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
            player_deposited: H256::from(ethers::utils::keccak256(
                b"PlayerDeposited(uint256,address,uint256)",
            )),
            rewards_claimed: H256::from(ethers::utils::keccak256(
                b"RewardsClaimed(uint256,address,uint256)",
            )),
            player_withdrawn: H256::from(ethers::utils::keccak256(
                b"PlayerWithdrawn(uint256,address,uint256)",
            )),
            force_withdrawn: H256::from(ethers::utils::keccak256(
                b"ForceWithdrawn(uint256,address,uint256)",
            )),
            // Dual-balance events (Vision First Deposit)
            balance_credited: H256::from(ethers::utils::keccak256(
                b"BalanceCredited(address,uint256,uint256)",
            )),
            balance_deposited: H256::from(ethers::utils::keccak256(
                b"BalanceDeposited(address,uint256)",
            )),
            real_balance_withdrawn: H256::from(ethers::utils::keccak256(
                b"RealBalanceWithdrawn(address,uint256)",
            )),
            withdraw_to_settlement_requested: H256::from(ethers::utils::keccak256(
                b"WithdrawToSettlementRequested(address,uint256,uint256)",
            )),
            balance_debited: H256::from(ethers::utils::keccak256(
                b"BalanceDebited(address,uint256,uint256)",
            )),
        }
    }
}

/// Fetched batch data from the contract (intermediate struct for decoding).
struct FetchedBatchData {
    source_id: H256,
    config_hash: H256,
    next_config_hash: H256,
    lock_offset: u64,
    next_lock_offset: u64,
    created_at_tick: u64,
    last_promotion_tick: u64,
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
                } else if *topic0 == topics.player_deposited {
                    self.handle_player_deposited(&log).await;
                } else if *topic0 == topics.rewards_claimed {
                    self.handle_rewards_claimed(&log).await;
                } else if *topic0 == topics.player_withdrawn {
                    self.handle_player_withdrawn(&log).await;
                } else if *topic0 == topics.force_withdrawn {
                    self.handle_force_withdrawn(&log).await;
                }
                // Dual-balance events (Vision First Deposit)
                else if *topic0 == topics.balance_credited {
                    self.handle_balance_credited(&log).await;
                } else if *topic0 == topics.balance_deposited {
                    self.handle_balance_deposited(&log).await;
                } else if *topic0 == topics.real_balance_withdrawn {
                    self.handle_real_balance_withdrawn(&log).await;
                } else if *topic0 == topics.withdraw_to_settlement_requested {
                    self.handle_withdraw_to_settlement_requested(&log).await;
                } else if *topic0 == topics.balance_debited {
                    self.handle_balance_debited(&log).await;
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
        let tick_duration = if log.data.len() >= 64 {
            // tickDuration is the second word in data (bytes 32..64)
            let tuple = ethers::abi::decode(
                &[ethers::abi::ParamType::FixedBytes(32), ethers::abi::ParamType::Uint(256), ethers::abi::ParamType::Uint(256)],
                &log.data,
            );
            match tuple {
                Ok(tokens) => tokens[1].clone().into_uint().map(|v| v.as_u64()).unwrap_or(0),
                Err(_) => {
                    warn!(batch_id, "BatchCreated: failed to decode data tuple");
                    return;
                }
            }
        } else {
            match decode_single_u256(&log.data) {
                Some(v) => v.as_u64(),
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
                next_config_hash: fetched.next_config_hash,
                tick_duration,
                lock_offset: fetched.lock_offset,
                next_lock_offset: fetched.next_lock_offset,
                next_tick_duration: None,
                created_at_tick: fetched.created_at_tick,
                last_promotion_tick: fetched.last_promotion_tick,
                paused: false,
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
                    config_hash: H256::zero(),
                    next_config_hash: H256::zero(),
                    tick_duration,
                    lock_offset: 0,
                    next_lock_offset: 0,
                    next_tick_duration: None,
                    created_at_tick,
                    last_promotion_tick: 0,
                    paused: false,
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

    /// Handle `BatchConfigUpdated(uint256 indexed batchId, bytes32 nextConfigHash, uint256 nextLockOffset, uint256 nextTickDuration)`
    ///
    /// Emitted when a batch creator (or BLS consensus) updates the pending config.
    /// Sets next_config_hash, next_lock_offset, and next_tick_duration on the batch; promotion happens at tick boundary.
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
            "UPDATE vision_batches SET next_config_hash = $1, next_lock_offset = $2, next_tick_duration = $3 WHERE id = $4",
        )
        .bind(format!("{:?}", new_config_hash))
        .bind(new_lock_offset as i64)
        .bind(new_tick_duration as i64)
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
            "BatchConfigUpdated"
        );
    }

    /// Handle `BatchConfigPromoted(uint256 indexed batchId, bytes32 oldConfigHash, bytes32 newConfigHash, uint256 atTick)`
    ///
    /// Emitted when next_config_hash is promoted to active config_hash at a tick boundary.
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
            "UPDATE vision_batches SET config_hash = $1, last_promotion_tick = $2, \
             tick_duration = COALESCE(next_tick_duration, tick_duration), \
             next_tick_duration = NULL \
             WHERE id = $3",
        )
        .bind(format!("{:?}", config_hash))
        .bind(promoted_at_tick as i64)
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
            "BatchConfigPromoted"
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

        // Data: stakePerTick (uint256) + bitmapHash (bytes32) = 64 bytes
        if log.data.len() < 64 {
            warn!(batch_id, player = %player, "PlayerJoined: data too short");
            return;
        }
        let stake_per_tick = U256::from_big_endian(&log.data[0..32]);
        let bitmap_hash = H256::from_slice(&log.data[32..64]);

        // Get block timestamp for start_tick computation
        let start_tick = match self.get_block_timestamp(log).await {
            Some(ts) => {
                // Compute start_tick from batch's tick_duration
                let tick_dur = self
                    .scheduler
                    .get_batch(batch_id)
                    .await
                    .map(|b| b.tick_duration)
                    .unwrap_or(1);
                if tick_dur > 0 { ts / tick_dur } else { 0 }
            }
            None => 0,
        };

        // Compute initial balance: for the join event, the depositAmount IS the initial balance.
        // However, the event emits stakePerTick, not depositAmount. The on-chain deposit was
        // handled separately. We fetch the actual position to get the balance.
        let at_block = log.block_number.map(|n| ethers::types::BlockId::Number(n.into()));
        let balance = match self.fetch_position_balance(batch_id, player, at_block).await {
            Some(b) => b,
            None => {
                // Fallback: we don't know the initial balance from the event alone.
                // stakePerTick is the minimum, but actual deposit could be higher.
                // Use stakePerTick as a floor and it will be corrected on next deposit event.
                warn!(batch_id, player = %player, "Could not fetch position balance, using stakePerTick");
                stake_per_tick
            }
        };

        let position = PlayerPosition {
            player,
            bitmap_hash,
            stake_per_tick,
            start_tick,
            balance,
            initial_deposit: balance,
        };

        // 1. Update in-memory scheduler (per-batch position)
        self.scheduler.on_player_joined(batch_id, position).await;

        // 1b. Dual-balance debit is now handled by the BalanceDebited event
        //     (emitted by _debitBalance in Vision.sol with exact fromVirtual/fromReal amounts)

        // 2. Write to Postgres (position)
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_positions (batch_id, player, stake_per_tick, bitmap_hash, start_tick, balance, join_timestamp, total_deposited)
             VALUES ($1, $2, $3::numeric, $4, $5, $6::numeric, $7, $8::numeric)
             ON CONFLICT (batch_id, player) DO UPDATE SET
                stake_per_tick = EXCLUDED.stake_per_tick,
                bitmap_hash = EXCLUDED.bitmap_hash,
                start_tick = EXCLUDED.start_tick,
                balance = EXCLUDED.balance,
                total_deposited = EXCLUDED.total_deposited"
        )
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .bind(stake_per_tick.to_string())
        .bind(format!("{:?}", bitmap_hash))
        .bind(start_tick as i64)
        .bind(balance.to_string())
        .bind(0i64) // join_timestamp no longer tracked (multiplier system removed)
        .bind(balance.to_string()) // total_deposited = initial balance at join time
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, player = %player, error = %e, "Failed to insert position into Postgres");
        }

        info!(
            batch_id,
            player = %player,
            stake_per_tick = %stake_per_tick,
            "PlayerJoined"
        );
    }

    /// Handle `PlayerDeposited(uint256 indexed batchId, address indexed player, uint256 amount)`
    async fn handle_player_deposited(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("PlayerDeposited: missing batchId topic");
                return;
            }
        };
        let player = match extract_indexed_address(log, 2) {
            Some(v) => v,
            None => {
                warn!(batch_id, "PlayerDeposited: missing player topic");
                return;
            }
        };

        // Fetch the new balance from the contract at event block (amount is the deposit, not new total)
        let at_block = log.block_number.map(|n| ethers::types::BlockId::Number(n.into()));
        let new_balance = match self.fetch_position_balance(batch_id, player, at_block).await {
            Some(b) => b,
            None => {
                // Fallback: we can't just add 'amount' because we might not have the previous balance.
                // Log warning and skip scheduler update.
                warn!(batch_id, player = %player, "PlayerDeposited: could not fetch new balance");
                return;
            }
        };

        // 1. Update in-memory scheduler
        if let Err(e) = self
            .scheduler
            .on_player_deposited(batch_id, player, new_balance)
            .await
        {
            warn!(batch_id, player = %player, error = %e, "Scheduler on_player_deposited failed");
        }

        // 2. Update Postgres (balance + accumulate total_deposited)
        // The deposit amount is new_balance - old_balance, but we don't track old_balance here.
        // Instead, we read the current balance from Postgres and compute the delta.
        let deposit_delta = {
            let row = sqlx::query_scalar::<_, String>(
                "SELECT balance FROM vision_positions WHERE batch_id = $1 AND player = $2",
            )
            .bind(batch_id as i64)
            .bind(format!("{:?}", player))
            .fetch_optional(&self.pool)
            .await;
            match row {
                Ok(Some(old_bal_str)) => {
                    let old_bal = U256::from_dec_str(&old_bal_str).unwrap_or(U256::zero());
                    if new_balance > old_bal { new_balance - old_bal } else { U256::zero() }
                }
                _ => U256::zero(),
            }
        };

        if let Err(e) = sqlx::query(
            "UPDATE vision_positions SET balance = $1::numeric, total_deposited = total_deposited + $4::numeric WHERE batch_id = $2 AND player = $3",
        )
        .bind(new_balance.to_string())
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .bind(deposit_delta.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, player = %player, error = %e, "Failed to update position balance in Postgres");
        }

        info!(
            batch_id,
            player = %player,
            new_balance = %new_balance,
            "PlayerDeposited"
        );
    }

    /// Handle `RewardsClaimed(uint256 indexed batchId, address indexed player, uint256 amount)`
    async fn handle_rewards_claimed(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("RewardsClaimed: missing batchId topic");
                return;
            }
        };
        let player = match extract_indexed_address(log, 2) {
            Some(v) => v,
            None => {
                warn!(batch_id, "RewardsClaimed: missing player topic");
                return;
            }
        };
        let amount = match decode_single_u256(&log.data) {
            Some(v) => v,
            None => {
                warn!(batch_id, player = %player, "RewardsClaimed: failed to decode amount");
                return;
            }
        };

        // Fetch new balance from contract since the on-chain claimRewards updates balance
        let new_balance = match self.fetch_position_balance(batch_id, player, None).await {
            Some(b) => b,
            None => {
                warn!(batch_id, player = %player, "RewardsClaimed: could not fetch new balance");
                return;
            }
        };

        // 1. Update in-memory scheduler (per-batch position)
        if let Err(e) = self
            .scheduler
            .on_rewards_claimed(batch_id, player, new_balance)
            .await
        {
            warn!(batch_id, player = %player, error = %e, "Scheduler on_rewards_claimed failed");
        }

        // 1b. Implicit dual-balance update: claimRewards credits realBalance
        //     (batch payouts are always real L3 USDC)
        self.scheduler.on_batch_payout(player, amount).await;

        // 2. Update Postgres (position)
        if let Err(e) = sqlx::query(
            "UPDATE vision_positions SET balance = $1::numeric WHERE batch_id = $2 AND player = $3",
        )
        .bind(new_balance.to_string())
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, player = %player, error = %e, "Failed to update balance after rewards in Postgres");
        }

        info!(
            batch_id,
            player = %player,
            amount = %amount,
            new_balance = %new_balance,
            "RewardsClaimed"
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

        // Decode the payout amount from data for dual-balance tracking
        let payout_amount = decode_single_u256(&log.data).unwrap_or(U256::zero());

        // 1. Update in-memory scheduler (removes the player)
        if let Err(e) = self.scheduler.on_player_withdrawn(batch_id, player).await {
            warn!(batch_id, player = %player, error = %e, "Scheduler on_player_withdrawn failed");
        }

        // 1b. Implicit dual-balance update: withdraw credits realBalance
        //     (batch payouts are always real L3 USDC)
        if !payout_amount.is_zero() {
            self.scheduler.on_batch_payout(player, payout_amount).await;
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

        info!(batch_id, player = %player, payout = %payout_amount, "PlayerWithdrawn");
    }

    /// Handle `ForceWithdrawn(uint256 indexed batchId, address indexed player, uint256 amount)`
    ///
    /// Same as PlayerWithdrawn from the indexer's perspective: position is deleted.
    /// Also credits the user's realBalance (batch payouts are always real).
    async fn handle_force_withdrawn(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("ForceWithdrawn: missing batchId topic");
                return;
            }
        };
        let player = match extract_indexed_address(log, 2) {
            Some(v) => v,
            None => {
                warn!(batch_id, "ForceWithdrawn: missing player topic");
                return;
            }
        };

        // Decode the payout amount from data for dual-balance tracking
        let payout_amount = decode_single_u256(&log.data).unwrap_or(U256::zero());

        // 1. Update in-memory scheduler (removes the player)
        if let Err(e) = self.scheduler.on_player_withdrawn(batch_id, player).await {
            warn!(batch_id, player = %player, error = %e, "Scheduler on_player_withdrawn (force) failed");
        }

        // 1b. Implicit dual-balance update: forceWithdraw credits realBalance
        if !payout_amount.is_zero() {
            self.scheduler.on_batch_payout(player, payout_amount).await;
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
            warn!(batch_id, player = %player, error = %e, "Failed to delete position (force) from Postgres");
        }

        info!(batch_id, player = %player, payout = %payout_amount, "ForceWithdrawn");
    }

    // =========================================================================
    // Dual-balance event handlers (Vision First Deposit)
    // =========================================================================

    /// Handle `BalanceCredited(address indexed user, uint256 amount, uint256 indexed depositId)`
    ///
    /// Emitted by Vision.creditBalance() after cross-chain deposit from Settlement.
    /// Updates the user's virtual balance in the tick scheduler and Postgres.
    async fn handle_balance_credited(&self, log: &Log) {
        let user = match extract_indexed_address(log, 1) {
            Some(v) => v,
            None => {
                warn!("BalanceCredited: missing user topic");
                return;
            }
        };

        // data: amount (uint256)
        let amount = match decode_single_u256(&log.data) {
            Some(v) => v,
            None => {
                warn!(user = %user, "BalanceCredited: failed to decode amount");
                return;
            }
        };

        let deposit_id = match log.topics.get(2) {
            Some(t) => U256::from(t.as_bytes()).as_u64(),
            None => 0,
        };

        // 1. Update in-memory scheduler
        self.scheduler.on_virtual_balance_credited(user, amount).await;

        // 2. Update Postgres vision_user_balances
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_user_balances (user_address, virtual_balance, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_address) DO UPDATE SET
                virtual_balance = (CAST(vision_user_balances.virtual_balance AS NUMERIC) + CAST($2 AS NUMERIC))::TEXT,
                updated_at = NOW()",
        )
        .bind(format!("{:?}", user))
        .bind(amount.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(user = %user, error = %e, "Failed to update virtual balance in Postgres");
        }

        info!(
            user = %user,
            amount = %amount,
            deposit_id,
            "BalanceCredited (virtual)"
        );
    }

    /// Handle `BalanceDeposited(address indexed user, uint256 amount)`
    ///
    /// Emitted by Vision.depositBalance() for direct L3 deposits.
    /// Updates the user's real balance in the tick scheduler and Postgres.
    async fn handle_balance_deposited(&self, log: &Log) {
        let user = match extract_indexed_address(log, 1) {
            Some(v) => v,
            None => {
                warn!("BalanceDeposited: missing user topic");
                return;
            }
        };

        let amount = match decode_single_u256(&log.data) {
            Some(v) => v,
            None => {
                warn!(user = %user, "BalanceDeposited: failed to decode amount");
                return;
            }
        };

        // 1. Update in-memory scheduler
        self.scheduler.on_real_balance_deposited(user, amount).await;

        // 2. Update Postgres vision_user_balances
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_user_balances (user_address, real_balance, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_address) DO UPDATE SET
                real_balance = (CAST(vision_user_balances.real_balance AS NUMERIC) + CAST($2 AS NUMERIC))::TEXT,
                updated_at = NOW()",
        )
        .bind(format!("{:?}", user))
        .bind(amount.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(user = %user, error = %e, "Failed to update real balance in Postgres");
        }

        info!(user = %user, amount = %amount, "BalanceDeposited (real)");
    }

    /// Handle `RealBalanceWithdrawn(address indexed user, uint256 amount)`
    ///
    /// Emitted by Vision.withdrawBalance() when user withdraws real balance to L3 wallet.
    async fn handle_real_balance_withdrawn(&self, log: &Log) {
        let user = match extract_indexed_address(log, 1) {
            Some(v) => v,
            None => {
                warn!("RealBalanceWithdrawn: missing user topic");
                return;
            }
        };

        let amount = match decode_single_u256(&log.data) {
            Some(v) => v,
            None => {
                warn!(user = %user, "RealBalanceWithdrawn: failed to decode amount");
                return;
            }
        };

        // 1. Update in-memory scheduler
        self.scheduler.on_real_balance_withdrawn(user, amount).await;

        // 2. Update Postgres — decrement real balance
        if let Err(e) = sqlx::query(
            "UPDATE vision_user_balances SET
                real_balance = (GREATEST(CAST(real_balance AS NUMERIC) - CAST($2 AS NUMERIC), 0))::TEXT,
                updated_at = NOW()
             WHERE user_address = $1",
        )
        .bind(format!("{:?}", user))
        .bind(amount.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(user = %user, error = %e, "Failed to decrement real balance in Postgres");
        }

        info!(user = %user, amount = %amount, "RealBalanceWithdrawn");
    }

    /// Handle `WithdrawToSettlementRequested(address indexed user, uint256 amount, uint256 indexed withdrawId)`
    ///
    /// Emitted by Vision.withdrawToSettlement() when user initiates Settlement withdrawal.
    /// Virtual balance already debited on-chain. We track the withdraw order
    /// and the deposit watcher handles the Settlement-side completion.
    async fn handle_withdraw_to_settlement_requested(&self, log: &Log) {
        let user = match extract_indexed_address(log, 1) {
            Some(v) => v,
            None => {
                warn!("WithdrawToSettlementRequested: missing user topic");
                return;
            }
        };

        // data: amount (uint256)
        let amount = match decode_single_u256(&log.data) {
            Some(v) => v,
            None => {
                warn!(user = %user, "WithdrawToSettlementRequested: failed to decode amount");
                return;
            }
        };

        let withdraw_id = match log.topics.get(2) {
            Some(t) => U256::from(t.as_bytes()).as_u64(),
            None => {
                warn!(user = %user, "WithdrawToSettlementRequested: missing withdrawId topic");
                return;
            }
        };

        // 1. Update in-memory scheduler — debit virtual balance
        self.scheduler.on_virtual_balance_withdrawn(user, amount).await;

        // 2. Update Postgres — decrement virtual balance
        if let Err(e) = sqlx::query(
            "UPDATE vision_user_balances SET
                virtual_balance = (GREATEST(CAST(virtual_balance AS NUMERIC) - CAST($2 AS NUMERIC), 0))::TEXT,
                updated_at = NOW()
             WHERE user_address = $1",
        )
        .bind(format!("{:?}", user))
        .bind(amount.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(user = %user, error = %e, "Failed to decrement virtual balance in Postgres");
        }

        // 3. Create withdraw order record
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_withdraw_orders (withdraw_id, user_address, amount, status, created_at)
             VALUES ($1, $2, $3, 'pending', NOW())
             ON CONFLICT (withdraw_id) DO NOTHING",
        )
        .bind(withdraw_id as i64)
        .bind(format!("{:?}", user))
        .bind(amount.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(user = %user, withdraw_id, error = %e, "Failed to insert withdraw order into Postgres");
        }

        info!(
            user = %user,
            amount = %amount,
            withdraw_id,
            "WithdrawToSettlementRequested"
        );
    }

    // =========================================================================
    // BalanceDebited event — authoritative dual-balance debit from _debitBalance
    // =========================================================================

    /// Handle BalanceDebited(address indexed user, uint256 fromVirtual, uint256 fromReal)
    ///
    /// Emitted by Vision._debitBalance whenever joinBatch or deposit debits from
    /// the user's global balance. Provides exact per-pool amounts, replacing the
    /// previous local computation in on_batch_join_debit.
    async fn handle_balance_debited(&self, log: &ethers::types::Log) {
        if log.topics.len() < 2 || log.data.len() < 64 {
            warn!("BalanceDebited log too short, skipping");
            return;
        }

        let user = Address::from(log.topics[1]);
        let from_virtual = U256::from_big_endian(&log.data[0..32]);
        let from_real = U256::from_big_endian(&log.data[32..64]);

        // Update in-memory scheduler with exact debit amounts
        if !from_virtual.is_zero() {
            self.scheduler.on_virtual_balance_withdrawn(user, from_virtual).await;
        }
        if !from_real.is_zero() {
            self.scheduler.on_real_balance_withdrawn(user, from_real).await;
        }

        // Persist to Postgres
        if let Err(e) = sqlx::query(
            "INSERT INTO vision_user_balances (user_address, real_balance, virtual_balance, updated_at)
             VALUES ($1,
                     (COALESCE((SELECT real_balance FROM vision_user_balances WHERE user_address = $1), '0')::numeric - $2::numeric)::text,
                     (COALESCE((SELECT virtual_balance FROM vision_user_balances WHERE user_address = $1), '0')::numeric - $3::numeric)::text,
                     NOW())
             ON CONFLICT (user_address) DO UPDATE SET
                 real_balance = (EXCLUDED.real_balance::numeric)::text,
                 virtual_balance = (EXCLUDED.virtual_balance::numeric)::text,
                 updated_at = NOW()"
        )
        .bind(format!("{:?}", user))
        .bind(from_real.to_string())
        .bind(from_virtual.to_string())
        .execute(&self.pool)
        .await
        {
            warn!(user = %user, error = %e, "Failed to persist BalanceDebited to Postgres");
        }

        debug!(
            user = %user,
            from_virtual = %from_virtual,
            from_real = %from_real,
            "BalanceDebited"
        );
    }

    // =========================================================================
    // Implicit balance updates from existing events
    // =========================================================================
    //
    // RewardsClaimed, PlayerWithdrawn, ForceWithdrawn credit realBalance via
    // batch payouts. These are still handled in the existing handlers above
    // with calls to tick_scheduler.on_batch_payout.
    //
    // PlayerJoined debit is NOW handled by BalanceDebited event above.
    // See handle_rewards_claimed: calls on_batch_payout
    // See handle_player_withdrawn: calls on_batch_payout
    // See handle_force_withdrawn: calls on_batch_payout

    // =========================================================================
    // Contract read helpers — raw ABI-encoded calls (no abigen!)
    // =========================================================================

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

        // Decode the new Batch struct tuple:
        // (address creator, bytes32 sourceId, bytes32 configHash, bytes32 nextConfigHash,
        //  uint256 tickDuration, uint256 lockOffset, uint256 nextLockOffset,
        //  uint256 createdAtTick, uint256 lastPromotionTick, bool paused)
        let tokens = match abi::decode(
            &[abi::ParamType::Tuple(vec![
                abi::ParamType::Address,           // creator
                abi::ParamType::FixedBytes(32),     // sourceId
                abi::ParamType::FixedBytes(32),     // configHash
                abi::ParamType::FixedBytes(32),     // nextConfigHash
                abi::ParamType::Uint(256),          // tickDuration
                abi::ParamType::Uint(256),          // lockOffset
                abi::ParamType::Uint(256),          // nextLockOffset
                abi::ParamType::Uint(256),          // createdAtTick
                abi::ParamType::Uint(256),          // lastPromotionTick
                abi::ParamType::Bool,               // paused
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

        // tuple[3] = nextConfigHash
        let next_config_hash = match &tuple[3] {
            Token::FixedBytes(b) if b.len() == 32 => H256::from_slice(b),
            _ => H256::zero(),
        };

        // tuple[4] = tickDuration (skip, from event)
        // tuple[5] = lockOffset
        let lock_offset = match &tuple[5] {
            Token::Uint(v) => v.as_u64(),
            _ => 0,
        };

        // tuple[6] = nextLockOffset
        let next_lock_offset = match &tuple[6] {
            Token::Uint(v) => v.as_u64(),
            _ => 0,
        };

        // tuple[7] = createdAtTick
        let created_at_tick = match &tuple[7] {
            Token::Uint(v) => v.as_u64(),
            _ => 0,
        };

        // tuple[8] = lastPromotionTick
        let last_promotion_tick = match &tuple[8] {
            Token::Uint(v) => v.as_u64(),
            _ => 0,
        };

        Some(FetchedBatchData {
            source_id,
            config_hash,
            next_config_hash,
            lock_offset,
            next_lock_offset,
            created_at_tick,
            last_promotion_tick,
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
