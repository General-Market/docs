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
/// tick scheduler AND Postgres tables (p2pool_batches, p2pool_positions, etc.).
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
    player_joined: H256,
    player_deposited: H256,
    rewards_claimed: H256,
    player_withdrawn: H256,
    force_withdrawn: H256,
}

impl EventTopics {
    fn new() -> Self {
        Self {
            batch_created: H256::from(ethers::utils::keccak256(
                b"BatchCreated(uint256,address,uint256)",
            )),
            batch_paused: H256::from(ethers::utils::keccak256(
                b"BatchPausedEvent(uint256)",
            )),
            batch_unpaused: H256::from(ethers::utils::keccak256(
                b"BatchUnpaused(uint256)",
            )),
            player_joined: H256::from(ethers::utils::keccak256(
                b"PlayerJoined(uint256,address,uint256,bytes32)",
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
        }
    }
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
            }
        }

        Ok(count)
    }

    // =========================================================================
    // Event handlers — each updates scheduler (in-memory) AND Postgres
    // =========================================================================

    /// Handle `BatchCreated(uint256 indexed batchId, address indexed creator, uint256 tickDuration)`
    ///
    /// The event only contains batchId, creator, tickDuration. We fetch the full
    /// batch from the contract to get marketIds, resolutionTypes, customThresholds,
    /// and createdAtTick.
    async fn handle_batch_created(&self, log: &Log) {
        let batch_id = match extract_indexed_u64(log, 1) {
            Some(v) => v,
            None => {
                warn!("BatchCreated: missing batchId topic");
                return;
            }
        };
        let creator = match extract_indexed_address(log, 2) {
            Some(v) => v,
            None => {
                warn!(batch_id, "BatchCreated: missing creator topic");
                return;
            }
        };
        let tick_duration = match decode_single_u256(&log.data) {
            Some(v) => v.as_u64(),
            None => {
                warn!(batch_id, "BatchCreated: failed to decode tickDuration from data");
                return;
            }
        };

        // Fetch full batch from contract to get marketIds, resolutionTypes, etc.
        let (market_ids, resolution_types, custom_thresholds, created_at_tick) =
            match self.fetch_batch_from_contract(batch_id).await {
                Some(v) => v,
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
                    (vec![], vec![], vec![], created_at_tick)
                }
            };

        let batch = Batch {
            id: batch_id,
            creator,
            market_ids,
            resolution_types,
            tick_duration,
            custom_thresholds,
            created_at_tick,
            paused: false,
        };

        // 1. Update in-memory scheduler
        self.scheduler.on_batch_created(batch.clone()).await;

        // 2. Write to Postgres
        let market_ids_json = serde_json::to_value(&batch.market_ids).unwrap_or_default();
        if let Err(e) = sqlx::query(
            "INSERT INTO p2pool_batches (id, creator, market_count, tick_duration, created_at_tick, paused, market_ids)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
                market_count = EXCLUDED.market_count,
                tick_duration = EXCLUDED.tick_duration,
                paused = EXCLUDED.paused,
                market_ids = EXCLUDED.market_ids"
        )
        .bind(batch.id as i64)
        .bind(format!("{:?}", batch.creator))
        .bind(batch.market_ids.len() as i32)
        .bind(batch.tick_duration as i64)
        .bind(batch.created_at_tick as i64)
        .bind(false)
        .bind(market_ids_json)
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, error = %e, "Failed to insert batch into Postgres");
        }

        info!(
            batch_id,
            creator = %creator,
            tick_duration,
            markets = batch.market_ids.len(),
            created_at_tick,
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
        if let Err(e) = sqlx::query("UPDATE p2pool_batches SET paused = true WHERE id = $1")
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
        if let Err(e) = sqlx::query("UPDATE p2pool_batches SET paused = false WHERE id = $1")
            .bind(batch_id as i64)
            .execute(&self.pool)
            .await
        {
            warn!(batch_id, error = %e, "Failed to update batch unpaused in Postgres");
        }

        info!(batch_id, "BatchUnpaused");
    }

    /// Handle `PlayerJoined(uint256 indexed batchId, address indexed player, uint256 stakePerTick, bytes32 bitmapHash)`
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

        // Get block timestamp for join_timestamp and start_tick computation
        let (join_timestamp, start_tick) = match self.get_block_timestamp(log).await {
            Some(ts) => {
                // Compute start_tick from batch's tick_duration
                let tick_dur = self
                    .scheduler
                    .get_batch(batch_id)
                    .await
                    .map(|b| b.tick_duration)
                    .unwrap_or(1);
                let start_tick = if tick_dur > 0 { ts / tick_dur } else { 0 };
                (ts, start_tick)
            }
            None => (0, 0),
        };

        // Compute initial balance: for the join event, the depositAmount IS the initial balance.
        // However, the event emits stakePerTick, not depositAmount. The on-chain deposit was
        // handled separately. We fetch the actual position to get the balance.
        let balance = match self.fetch_position_balance(batch_id, player).await {
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
            join_timestamp,
        };

        // 1. Update in-memory scheduler
        self.scheduler.on_player_joined(batch_id, position).await;

        // 2. Write to Postgres
        if let Err(e) = sqlx::query(
            "INSERT INTO p2pool_positions (batch_id, player, stake_per_tick, bitmap_hash, start_tick, balance, join_timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (batch_id, player) DO UPDATE SET
                stake_per_tick = EXCLUDED.stake_per_tick,
                bitmap_hash = EXCLUDED.bitmap_hash,
                start_tick = EXCLUDED.start_tick,
                balance = EXCLUDED.balance"
        )
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .bind(stake_per_tick.to_string())
        .bind(format!("{:?}", bitmap_hash))
        .bind(start_tick as i64)
        .bind(balance.to_string())
        .bind(join_timestamp as i64)
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

        // Fetch the new balance from the contract (amount is the deposit, not new total)
        let new_balance = match self.fetch_position_balance(batch_id, player).await {
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

        // 2. Update Postgres
        if let Err(e) = sqlx::query(
            "UPDATE p2pool_positions SET balance = $1 WHERE batch_id = $2 AND player = $3",
        )
        .bind(new_balance.to_string())
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
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
        let new_balance = match self.fetch_position_balance(batch_id, player).await {
            Some(b) => b,
            None => {
                warn!(batch_id, player = %player, "RewardsClaimed: could not fetch new balance");
                return;
            }
        };

        // 1. Update in-memory scheduler
        if let Err(e) = self
            .scheduler
            .on_rewards_claimed(batch_id, player, new_balance)
            .await
        {
            warn!(batch_id, player = %player, error = %e, "Scheduler on_rewards_claimed failed");
        }

        // 2. Update Postgres
        if let Err(e) = sqlx::query(
            "UPDATE p2pool_positions SET balance = $1 WHERE batch_id = $2 AND player = $3",
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

        // 1. Update in-memory scheduler (removes the player)
        if let Err(e) = self.scheduler.on_player_withdrawn(batch_id, player).await {
            warn!(batch_id, player = %player, error = %e, "Scheduler on_player_withdrawn failed");
        }

        // 2. Delete from Postgres
        if let Err(e) = sqlx::query(
            "DELETE FROM p2pool_positions WHERE batch_id = $1 AND player = $2",
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

    /// Handle `ForceWithdrawn(uint256 indexed batchId, address indexed player, uint256 amount)`
    ///
    /// Same as PlayerWithdrawn from the indexer's perspective: position is deleted.
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

        // 1. Update in-memory scheduler (removes the player)
        if let Err(e) = self.scheduler.on_player_withdrawn(batch_id, player).await {
            warn!(batch_id, player = %player, error = %e, "Scheduler on_player_withdrawn (force) failed");
        }

        // 2. Delete from Postgres
        if let Err(e) = sqlx::query(
            "DELETE FROM p2pool_positions WHERE batch_id = $1 AND player = $2",
        )
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .execute(&self.pool)
        .await
        {
            warn!(batch_id, player = %player, error = %e, "Failed to delete position (force) from Postgres");
        }

        info!(batch_id, player = %player, "ForceWithdrawn");
    }

    // =========================================================================
    // Contract read helpers — raw ABI-encoded calls (no abigen!)
    // =========================================================================

    /// Fetch full batch data from Vision.getBatch(uint256).
    ///
    /// Returns (market_ids, resolution_types, custom_thresholds, created_at_tick).
    async fn fetch_batch_from_contract(
        &self,
        batch_id: u64,
    ) -> Option<(Vec<H256>, Vec<u8>, Vec<U256>, u64)> {
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

        // Decode the Batch struct tuple:
        // (address creator, bytes32[] marketIds, uint8[] resolutionTypes,
        //  uint256 tickDuration, uint256[] customThresholds, uint256 createdAtTick, bool paused)
        let tokens = match abi::decode(
            &[abi::ParamType::Tuple(vec![
                abi::ParamType::Address,
                abi::ParamType::Array(Box::new(abi::ParamType::FixedBytes(32))),
                abi::ParamType::Array(Box::new(abi::ParamType::Uint(8))),
                abi::ParamType::Uint(256),
                abi::ParamType::Array(Box::new(abi::ParamType::Uint(256))),
                abi::ParamType::Uint(256),
                abi::ParamType::Bool,
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

        // tuple[0] = creator (skip)
        // tuple[1] = marketIds
        let market_ids: Vec<H256> = match &tuple[1] {
            Token::Array(arr) => arr
                .iter()
                .filter_map(|t| match t {
                    Token::FixedBytes(b) if b.len() == 32 => Some(H256::from_slice(b)),
                    _ => None,
                })
                .collect(),
            _ => vec![],
        };

        // tuple[2] = resolutionTypes
        let resolution_types: Vec<u8> = match &tuple[2] {
            Token::Array(arr) => arr
                .iter()
                .filter_map(|t| match t {
                    Token::Uint(v) => Some(v.as_u32() as u8),
                    _ => None,
                })
                .collect(),
            _ => vec![],
        };

        // tuple[3] = tickDuration (skip, already from event)
        // tuple[4] = customThresholds
        let custom_thresholds: Vec<U256> = match &tuple[4] {
            Token::Array(arr) => arr
                .iter()
                .filter_map(|t| match t {
                    Token::Uint(v) => Some(*v),
                    _ => None,
                })
                .collect(),
            _ => vec![],
        };

        // tuple[5] = createdAtTick
        let created_at_tick = match &tuple[5] {
            Token::Uint(v) => v.as_u64(),
            _ => 0,
        };

        Some((market_ids, resolution_types, custom_thresholds, created_at_tick))
    }

    /// Fetch a player's current balance from Vision.getPosition(uint256,address).
    async fn fetch_position_balance(&self, batch_id: u64, player: Address) -> Option<U256> {
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

        let result = match self.provider.call(&tx.into(), None).await {
            Ok(r) => r,
            Err(e) => {
                warn!(batch_id, player = %player, error = %e, "getPosition call failed");
                return None;
            }
        };

        // Decode PlayerPosition struct:
        // (bytes32 bitmapHash, uint256 stakePerTick, uint256 startTick, uint256 balance,
        //  uint256 lastClaimedTick, uint256 joinTimestamp, uint256 totalDeposited, uint256 totalClaimed)
        let tokens = match abi::decode(
            &[abi::ParamType::Tuple(vec![
                abi::ParamType::FixedBytes(32),
                abi::ParamType::Uint(256),
                abi::ParamType::Uint(256),
                abi::ParamType::Uint(256),
                abi::ParamType::Uint(256),
                abi::ParamType::Uint(256),
                abi::ParamType::Uint(256),
                abi::ParamType::Uint(256),
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

        // tuple[3] = balance
        match &tuple[3] {
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
            "SELECT value FROM p2pool_kv_store WHERE key = 'chain_listener_last_block'",
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
            "INSERT INTO p2pool_kv_store (key, value)
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

        // All topics should be distinct
        let all = vec![
            topics.batch_created,
            topics.batch_paused,
            topics.batch_unpaused,
            topics.player_joined,
            topics.player_deposited,
            topics.rewards_claimed,
            topics.player_withdrawn,
            topics.force_withdrawn,
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
