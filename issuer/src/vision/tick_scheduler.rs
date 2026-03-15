//! Tick scheduler for Vision batch management
//!
//! Maintains in-memory state of all active batches and their players.
//! Fed by the chain listener (via event handler methods) and queried by the
//! tick engine to find batches that have a tick due for resolution.

use std::collections::HashMap;
use tokio::sync::RwLock;

use ethers::types::{Address, H256, U256};
use sqlx::PgPool;
use tracing::info;

use super::types::{Batch, PlayerBalance, PlayerPosition};

/// Tick scheduler: tracks active batches and determines when ticks are due.
///
/// Also tracks dual-balance state per user (real + virtual), separate from
/// per-batch position balances. The dual-balance is the global Vision.sol
/// balance available for joining batches or withdrawing.
pub struct TickScheduler {
    /// All active batches: batch_id -> Batch
    batches: RwLock<HashMap<u64, Batch>>,
    /// All player positions: batch_id -> (player -> PlayerPosition)
    players: RwLock<HashMap<u64, HashMap<Address, PlayerPosition>>>,
    /// Last resolved tick per batch: batch_id -> tick_id
    last_resolved: RwLock<HashMap<u64, u64>>,

    // === Dual-balance state (Vision First Deposit) ===

    /// Per-user real balance — backed by actual L3 USDC in Vision.sol.
    user_real_balances: RwLock<HashMap<Address, U256>>,
    /// Per-user virtual balance — backed by USDC locked in SettlementBridgeCustody on Settlement.
    user_virtual_balances: RwLock<HashMap<Address, U256>>,
}

#[derive(Debug, thiserror::Error)]
pub enum TickSchedulerError {
    #[error("batch {0} not found")]
    BatchNotFound(u64),
    #[error("player {player:?} not found in batch {batch_id}")]
    PlayerNotFound { batch_id: u64, player: Address },
}

impl TickScheduler {
    pub fn new() -> Self {
        Self {
            batches: RwLock::new(HashMap::new()),
            players: RwLock::new(HashMap::new()),
            last_resolved: RwLock::new(HashMap::new()),
            user_real_balances: RwLock::new(HashMap::new()),
            user_virtual_balances: RwLock::new(HashMap::new()),
        }
    }

    // === Chain event handlers (called by ChainListener) ===

    /// Register a newly created batch.
    pub async fn on_batch_created(&self, batch: Batch) {
        self.batches.write().await.insert(batch.id, batch);
    }

    /// Register a player joining a batch.
    pub async fn on_player_joined(&self, batch_id: u64, position: PlayerPosition) {
        self.players
            .write()
            .await
            .entry(batch_id)
            .or_default()
            .insert(position.player, position);
    }

    /// Update a player's balance after additional deposit.
    pub async fn on_player_deposited(
        &self,
        batch_id: u64,
        player: Address,
        new_balance: U256,
    ) -> Result<(), TickSchedulerError> {
        let mut players = self.players.write().await;
        let batch_players = players
            .get_mut(&batch_id)
            .ok_or(TickSchedulerError::BatchNotFound(batch_id))?;
        let pos = batch_players
            .get_mut(&player)
            .ok_or(TickSchedulerError::PlayerNotFound { batch_id, player })?;
        // Track additional deposit in initial_deposit
        if new_balance > pos.balance {
            let deposit_amount = new_balance - pos.balance;
            pos.initial_deposit = pos.initial_deposit + deposit_amount;
        }
        pos.balance = new_balance;
        Ok(())
    }

    /// Remove a player who has withdrawn from a batch.
    pub async fn on_player_withdrawn(
        &self,
        batch_id: u64,
        player: Address,
    ) -> Result<(), TickSchedulerError> {
        let mut players = self.players.write().await;
        let batch_players = players
            .get_mut(&batch_id)
            .ok_or(TickSchedulerError::BatchNotFound(batch_id))?;
        batch_players.remove(&player);
        Ok(())
    }

    /// Pause a batch (no ticks will be scheduled while paused).
    pub async fn on_batch_paused(&self, batch_id: u64) -> Result<(), TickSchedulerError> {
        let mut batches = self.batches.write().await;
        let batch = batches
            .get_mut(&batch_id)
            .ok_or(TickSchedulerError::BatchNotFound(batch_id))?;
        batch.paused = true;
        Ok(())
    }

    /// Unpause a batch.
    pub async fn on_batch_unpaused(&self, batch_id: u64) -> Result<(), TickSchedulerError> {
        let mut batches = self.batches.write().await;
        let batch = batches
            .get_mut(&batch_id)
            .ok_or(TickSchedulerError::BatchNotFound(batch_id))?;
        batch.paused = false;
        Ok(())
    }

    /// Update a player after they claim rewards.
    pub async fn on_rewards_claimed(
        &self,
        batch_id: u64,
        player: Address,
        new_balance: U256,
    ) -> Result<(), TickSchedulerError> {
        let mut players = self.players.write().await;
        let batch_players = players
            .get_mut(&batch_id)
            .ok_or(TickSchedulerError::BatchNotFound(batch_id))?;
        let pos = batch_players
            .get_mut(&player)
            .ok_or(TickSchedulerError::PlayerNotFound { batch_id, player })?;
        pos.balance = new_balance;
        Ok(())
    }

    /// Apply balance updates from tick resolution.
    /// Updates in-memory player balances after a tick is resolved.
    pub async fn apply_tick_balances(&self, batch_id: u64, balances: &[PlayerBalance]) {
        let mut players = self.players.write().await;
        if let Some(batch_players) = players.get_mut(&batch_id) {
            for pb in balances {
                if let Some(pos) = batch_players.get_mut(&pb.player) {
                    pos.balance = pb.new_balance;
                }
            }
        }
    }

    /// Apply balance updates and persist to Postgres.
    pub async fn apply_tick_balances_with_db(
        &self,
        pool: &PgPool,
        batch_id: u64,
        balances: &[PlayerBalance],
    ) -> Result<(), sqlx::Error> {
        // 1. Persist to DB first — all-or-nothing via transaction.
        let mut tx = pool.begin().await?;
        for pb in balances {
            sqlx::query(
                "UPDATE vision_positions SET balance = $1 WHERE batch_id = $2 AND player = $3",
            )
            .bind(pb.new_balance.to_string())
            .bind(batch_id as i64)
            .bind(format!("{:?}", pb.player))
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;

        // 2. Only update in-memory state after DB confirms.
        self.apply_tick_balances(batch_id, balances).await;

        Ok(())
    }

    /// Update a batch's pending config (next_config_hash + next_lock_offset).
    /// Called when BatchConfigUpdated event is received.
    pub async fn on_batch_config_updated(
        &self,
        batch_id: u64,
        new_config_hash: H256,
        new_lock_offset: u64,
    ) {
        let mut batches = self.batches.write().await;
        if let Some(batch) = batches.get_mut(&batch_id) {
            batch.next_config_hash = new_config_hash;
            batch.next_lock_offset = new_lock_offset;
        }
    }

    /// Promote next_config_hash to active config_hash at tick boundary.
    /// Called when BatchConfigPromoted event is received.
    pub async fn on_batch_config_promoted(
        &self,
        batch_id: u64,
        config_hash: H256,
        promoted_at_tick: u64,
    ) {
        let mut batches = self.batches.write().await;
        if let Some(batch) = batches.get_mut(&batch_id) {
            batch.config_hash = config_hash;
            batch.lock_offset = batch.next_lock_offset;
            batch.last_promotion_tick = promoted_at_tick;
            // Clear pending config since it's now active
            batch.next_config_hash = H256::zero();
        }
    }

    // === Dual-balance event handlers (Vision First Deposit) ===
    //
    // These track the global per-user Vision balance (real + virtual),
    // separate from per-batch position balances above.

    /// Credit virtual balance after cross-chain deposit from Settlement.
    /// Called when `BalanceCredited(user, amount, depositId)` event is received.
    pub async fn on_virtual_balance_credited(&self, user: Address, amount: U256) {
        let mut balances = self.user_virtual_balances.write().await;
        let entry = balances.entry(user).or_insert(U256::zero());
        *entry = entry.saturating_add(amount);
    }

    /// Credit real balance after direct L3 deposit.
    /// Called when `BalanceDeposited(user, amount)` event is received.
    pub async fn on_real_balance_deposited(&self, user: Address, amount: U256) {
        let mut balances = self.user_real_balances.write().await;
        let entry = balances.entry(user).or_insert(U256::zero());
        *entry = entry.saturating_add(amount);
    }

    /// Debit real balance after L3 withdrawal.
    /// Called when `RealBalanceWithdrawn(user, amount)` event is received.
    pub async fn on_real_balance_withdrawn(&self, user: Address, amount: U256) {
        let mut balances = self.user_real_balances.write().await;
        let entry = balances.entry(user).or_insert(U256::zero());
        *entry = entry.saturating_sub(amount);
    }

    /// Debit virtual balance after withdrawToSettlement.
    /// Called when `WithdrawToSettlementRequested(user, amount, withdrawId)` event is received.
    pub async fn on_virtual_balance_withdrawn(&self, user: Address, amount: U256) {
        let mut balances = self.user_virtual_balances.write().await;
        let entry = balances.entry(user).or_insert(U256::zero());
        *entry = entry.saturating_sub(amount);
    }

    /// Credit real balance after batch payout (claimRewards, withdraw, forceWithdraw).
    /// Batch payouts always credit realBalance because the batch pool holds real L3 USDC.
    pub async fn on_batch_payout(&self, user: Address, amount: U256) {
        let mut balances = self.user_real_balances.write().await;
        let entry = balances.entry(user).or_insert(U256::zero());
        *entry = entry.saturating_add(amount);
    }

    /// Debit user balance after joining a batch (virtual first, then real).
    /// Mirrors `_debitBalance` in Vision.sol.
    pub async fn on_batch_join_debit(&self, user: Address, amount: U256) {
        let mut virtual_balances = self.user_virtual_balances.write().await;
        let mut real_balances = self.user_real_balances.write().await;

        let virtual_bal = virtual_balances.entry(user).or_insert(U256::zero());
        let real_bal = real_balances.entry(user).or_insert(U256::zero());

        // Debit virtual first, then real (same logic as contract)
        let from_virtual = if amount > *virtual_bal {
            *virtual_bal
        } else {
            amount
        };
        let from_real = amount.saturating_sub(from_virtual);

        *virtual_bal = virtual_bal.saturating_sub(from_virtual);
        *real_bal = real_bal.saturating_sub(from_real);
    }

    /// Get user's dual balance (realBalance, virtualBalance).
    pub async fn get_user_balance(&self, user: Address) -> (U256, U256) {
        let real = self
            .user_real_balances
            .read()
            .await
            .get(&user)
            .copied()
            .unwrap_or(U256::zero());
        let virtual_bal = self
            .user_virtual_balances
            .read()
            .await
            .get(&user)
            .copied()
            .unwrap_or(U256::zero());
        (real, virtual_bal)
    }

    /// Get user's total balance (real + virtual).
    pub async fn get_user_total_balance(&self, user: Address) -> U256 {
        let (real, virtual_bal) = self.get_user_balance(user).await;
        real.saturating_add(virtual_bal)
    }

    /// Set user balances directly (used for DB-based crash recovery).
    pub async fn set_user_balances(
        &self,
        user: Address,
        real_balance: U256,
        virtual_balance: U256,
    ) {
        self.user_real_balances
            .write()
            .await
            .insert(user, real_balance);
        self.user_virtual_balances
            .write()
            .await
            .insert(user, virtual_balance);
    }

    // === DB persistence for crash recovery ===

    /// Load all state from DB on startup (crash recovery).
    /// Restores batches, player positions, and last_resolved ticks.
    pub async fn load_from_db(&self, pool: &PgPool) -> Result<(), sqlx::Error> {
        // 1. Load batches
        let batch_rows: Vec<(i64, String, i64, i64, bool, String, String, String, i64, i64)> =
            sqlx::query_as(
                "SELECT id, creator, tick_duration, created_at_tick, paused, \
                 source_id, config_hash, next_config_hash, next_lock_offset, last_promotion_tick \
                 FROM vision_batches WHERE NOT paused",
            )
            .fetch_all(pool)
            .await?;

        {
            let mut batches = self.batches.write().await;
            for (id, creator, tick_duration, created_at_tick, paused, source_id, config_hash, next_config_hash, next_lock_offset, last_promotion_tick) in &batch_rows {
                let batch = Batch {
                    id: *id as u64,
                    creator: creator.parse().unwrap_or_default(),
                    source_id: source_id.parse().unwrap_or_default(),
                    config_hash: config_hash.parse().unwrap_or_default(),
                    next_config_hash: next_config_hash.parse().unwrap_or_default(),
                    tick_duration: *tick_duration as u64,
                    lock_offset: 0,
                    next_lock_offset: *next_lock_offset as u64,
                    created_at_tick: *created_at_tick as u64,
                    last_promotion_tick: *last_promotion_tick as u64,
                    paused: *paused,
                };
                batches.insert(batch.id, batch);
            }
        }
        info!(count = batch_rows.len(), "Loaded batches from DB");

        // 2. Load player positions (only active: balance > 0)
        // Cast numeric columns to text to avoid BigDecimal dependency
        let pos_rows: Vec<(i64, String, String, String, i64, String, String)> =
            sqlx::query_as(
                "SELECT batch_id, player, bitmap_hash, stake_per_tick::text, start_tick, balance::text, total_deposited::text \
                 FROM vision_positions WHERE balance > 0",
            )
            .fetch_all(pool)
            .await?;

        {
            let mut players = self.players.write().await;
            for (batch_id, player, bitmap_hash, stake_per_tick, start_tick, balance, total_deposited) in &pos_rows {
                let bal = U256::from_dec_str(balance).unwrap_or_default();
                let dep = U256::from_dec_str(total_deposited).unwrap_or(bal);
                let position = PlayerPosition {
                    player: player.parse().unwrap_or_default(),
                    bitmap_hash: bitmap_hash.parse().unwrap_or_default(),
                    stake_per_tick: U256::from_dec_str(stake_per_tick).unwrap_or_default(),
                    start_tick: *start_tick as u64,
                    balance: bal,
                    initial_deposit: dep,
                };
                players
                    .entry(*batch_id as u64)
                    .or_default()
                    .insert(position.player, position);
            }
        }
        info!(count = pos_rows.len(), "Loaded player positions from DB");

        // 3. Load last_resolved ticks
        let resolved_rows: Vec<(i64, i64)> = sqlx::query_as(
            "SELECT batch_id, last_tick_id FROM vision_last_resolved",
        )
        .fetch_all(pool)
        .await?;

        {
            let mut last_resolved = self.last_resolved.write().await;
            for (batch_id, tick_id) in &resolved_rows {
                last_resolved.insert(*batch_id as u64, *tick_id as u64);
            }
        }
        info!(count = resolved_rows.len(), "Loaded last_resolved from DB");

        Ok(())
    }

    /// Mark a tick as resolved and persist to DB for crash recovery.
    pub async fn mark_resolved_with_db(
        &self,
        pool: &PgPool,
        batch_id: u64,
        tick_id: u64,
    ) -> Result<(), sqlx::Error> {
        self.last_resolved.write().await.insert(batch_id, tick_id);

        sqlx::query(
            "INSERT INTO vision_last_resolved (batch_id, last_tick_id, resolved_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (batch_id) DO UPDATE SET last_tick_id = $2, resolved_at = NOW()",
        )
        .bind(batch_id as i64)
        .bind(tick_id as i64)
        .execute(pool)
        .await?;

        Ok(())
    }

    // === Tick engine queries ===

    /// Get all batch IDs that have a tick due at the given timestamp.
    ///
    /// A tick is due when: `now >= tick_end_time + reveal_window_secs`
    ///
    /// Tick timing is deterministic from `created_at_tick`:
    /// - Tick N starts at: `created_at_tick * tick_duration + N * tick_duration`
    /// - Tick N ends at:   `created_at_tick * tick_duration + (N + 1) * tick_duration`
    /// - Resolution allowed after: `tick_end_time + reveal_window_secs`
    pub async fn get_due_batches(&self, now: u64, reveal_window_secs: u64) -> Vec<u64> {
        let batches = self.batches.read().await;
        let last_resolved = self.last_resolved.read().await;

        batches
            .iter()
            .filter(|(_, batch)| !batch.paused)
            .filter_map(|(&id, batch)| {
                let last_tick = last_resolved.get(&id).copied();
                let next_tick = match last_tick {
                    Some(t) => t + 1,
                    None => 0,
                };
                // Tick N ends at: (created_at_tick + next_tick + 1) * tick_duration
                let tick_end_time =
                    (batch.created_at_tick + next_tick + 1) * batch.tick_duration;
                let reveal_deadline = tick_end_time + reveal_window_secs;
                if now >= reveal_deadline {
                    Some(id)
                } else {
                    None
                }
            })
            .collect()
    }

    /// Get batch state for tick resolution.
    pub async fn get_batch_state(
        &self,
        batch_id: u64,
    ) -> Option<(Batch, Vec<PlayerPosition>)> {
        let batches = self.batches.read().await;
        let players = self.players.read().await;

        let batch = batches.get(&batch_id)?.clone();
        let player_list = players
            .get(&batch_id)
            .map(|m| m.values().cloned().collect())
            .unwrap_or_default();

        Some((batch, player_list))
    }

    /// Mark a tick as resolved. The next call to `get_due_batches` will
    /// check for tick_id + 1.
    pub async fn mark_resolved(&self, batch_id: u64, tick_id: u64) {
        self.last_resolved.write().await.insert(batch_id, tick_id);
    }

    /// Get a player's on-chain bitmap hash (for verification).
    pub async fn get_player_bitmap_hash(
        &self,
        batch_id: u64,
        player: Address,
    ) -> Option<H256> {
        self.players
            .read()
            .await
            .get(&batch_id)?
            .get(&player)
            .map(|p| p.bitmap_hash)
    }

    /// Get the next tick ID that needs resolution for a batch.
    pub async fn next_tick_for_batch(&self, batch_id: u64) -> u64 {
        match self.last_resolved.read().await.get(&batch_id) {
            Some(&t) => t + 1,
            None => 0,
        }
    }

    /// Get a batch by ID.
    pub async fn get_batch(&self, batch_id: u64) -> Option<Batch> {
        self.batches.read().await.get(&batch_id).cloned()
    }

    /// Get the number of active (non-paused) batches.
    pub async fn active_batch_count(&self) -> usize {
        self.batches
            .read()
            .await
            .values()
            .filter(|b| !b.paused)
            .count()
    }

    /// Get the number of players in a batch.
    pub async fn player_count(&self, batch_id: u64) -> usize {
        self.players
            .read()
            .await
            .get(&batch_id)
            .map(|m| m.len())
            .unwrap_or(0)
    }

    /// Get all batch IDs (for leaderboard aggregation).
    pub async fn get_all_batch_ids(&self) -> Vec<u64> {
        self.batches.read().await.keys().copied().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::H256;

    fn make_batch(id: u64, tick_duration: u64, created_at_tick: u64) -> Batch {
        Batch {
            id,
            creator: Address::zero(),
            source_id: H256::zero(),
            config_hash: H256::zero(),
            next_config_hash: H256::zero(),
            tick_duration,
            lock_offset: 0,
            next_lock_offset: 0,
            created_at_tick,
            last_promotion_tick: 0,
            paused: false,
        }
    }

    fn make_player(player: Address, stake: u64) -> PlayerPosition {
        PlayerPosition {
            player,
            bitmap_hash: H256::random(),
            stake_per_tick: U256::from(stake),
            start_tick: 0,
            balance: U256::from(stake * 100),
            initial_deposit: U256::from(stake * 100),
        }
    }

    #[tokio::test]
    async fn test_add_batch_and_query() {
        let scheduler = TickScheduler::new();
        let batch = make_batch(1, 3600, 0);

        scheduler.on_batch_created(batch.clone()).await;

        let retrieved = scheduler.get_batch(1).await;
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.id, 1);
        assert_eq!(retrieved.tick_duration, 3600);
        assert_eq!(retrieved.created_at_tick, 0);

        // Batch with no players returns empty player list
        let state = scheduler.get_batch_state(1).await;
        assert!(state.is_some());
        let (b, players) = state.unwrap();
        assert_eq!(b.id, 1);
        assert!(players.is_empty());
    }

    #[tokio::test]
    async fn test_due_batches() {
        let scheduler = TickScheduler::new();

        // Batch with tick_duration=3600, created_at_tick=0
        // Tick 0 ends at: (0 + 0 + 1) * 3600 = 3600
        // With reveal_window=600, tick 0 is due at: 3600 + 600 = 4200
        let batch = make_batch(1, 3600, 0);
        scheduler.on_batch_created(batch).await;

        // Not due yet at t=4199
        let due = scheduler.get_due_batches(4199, 600).await;
        assert!(due.is_empty(), "batch should NOT be due at t=4199");

        // Due at t=4200
        let due = scheduler.get_due_batches(4200, 600).await;
        assert_eq!(due, vec![1], "batch should be due at t=4200");

        // Also due at t=5000
        let due = scheduler.get_due_batches(5000, 600).await;
        assert_eq!(due, vec![1], "batch should still be due at t=5000");
    }

    #[tokio::test]
    async fn test_due_batches_nonzero_created_at_tick() {
        let scheduler = TickScheduler::new();

        // Batch with tick_duration=3600, created_at_tick=10
        // Tick 0 ends at: (10 + 0 + 1) * 3600 = 39600
        // With reveal_window=600, tick 0 is due at: 39600 + 600 = 40200
        let batch = make_batch(1, 3600, 10);
        scheduler.on_batch_created(batch).await;

        let due = scheduler.get_due_batches(40199, 600).await;
        assert!(due.is_empty(), "not due before 40200");

        let due = scheduler.get_due_batches(40200, 600).await;
        assert_eq!(due, vec![1], "due at 40200");
    }

    #[tokio::test]
    async fn test_paused_batch_not_due() {
        let scheduler = TickScheduler::new();
        let batch = make_batch(1, 3600, 0);
        scheduler.on_batch_created(batch).await;

        // Pause the batch
        scheduler.on_batch_paused(1).await.unwrap();

        // Even after reveal deadline passes, paused batch is not due
        let due = scheduler.get_due_batches(100_000, 600).await;
        assert!(due.is_empty(), "paused batch should not be due");

        // Unpause and it becomes due
        scheduler.on_batch_unpaused(1).await.unwrap();
        let due = scheduler.get_due_batches(100_000, 600).await;
        assert_eq!(due, vec![1], "unpaused batch should be due");
    }

    #[tokio::test]
    async fn test_player_join_and_withdraw() {
        let scheduler = TickScheduler::new();
        let batch = make_batch(1, 3600, 0);
        scheduler.on_batch_created(batch).await;

        let player_a = Address::random();
        let player_b = Address::random();

        // Add two players
        scheduler
            .on_player_joined(1, make_player(player_a, 100))
            .await;
        scheduler
            .on_player_joined(1, make_player(player_b, 200))
            .await;

        assert_eq!(scheduler.player_count(1).await, 2);

        // Verify batch state includes both players
        let (_, players) = scheduler.get_batch_state(1).await.unwrap();
        assert_eq!(players.len(), 2);

        // Withdraw player_a
        scheduler.on_player_withdrawn(1, player_a).await.unwrap();
        assert_eq!(scheduler.player_count(1).await, 1);

        // Only player_b remains
        let (_, players) = scheduler.get_batch_state(1).await.unwrap();
        assert_eq!(players.len(), 1);
        assert_eq!(players[0].player, player_b);

        // Bitmap hash lookup
        let hash = scheduler.get_player_bitmap_hash(1, player_b).await;
        assert!(hash.is_some());
        let hash = scheduler.get_player_bitmap_hash(1, player_a).await;
        assert!(hash.is_none(), "withdrawn player should have no hash");
    }

    #[tokio::test]
    async fn test_player_deposit_updates_balance() {
        let scheduler = TickScheduler::new();
        let batch = make_batch(1, 3600, 0);
        scheduler.on_batch_created(batch).await;

        let player = Address::random();
        scheduler
            .on_player_joined(1, make_player(player, 100))
            .await;

        // Deposit more
        scheduler
            .on_player_deposited(1, player, U256::from(50000))
            .await
            .unwrap();

        let (_, players) = scheduler.get_batch_state(1).await.unwrap();
        assert_eq!(players[0].balance, U256::from(50000));
    }

    #[tokio::test]
    async fn test_mark_resolved_advances_tick() {
        let scheduler = TickScheduler::new();

        // Batch with tick_duration=3600, created_at_tick=0
        let batch = make_batch(1, 3600, 0);
        scheduler.on_batch_created(batch).await;

        // Tick 0 due at (0+0+1)*3600 + 600 = 4200
        let due = scheduler.get_due_batches(4200, 600).await;
        assert_eq!(due, vec![1]);

        // Resolve tick 0
        scheduler.mark_resolved(1, 0).await;
        assert_eq!(scheduler.next_tick_for_batch(1).await, 1);

        // At t=4200, tick 1 is NOT yet due
        // Tick 1 ends at: (0 + 1 + 1) * 3600 = 7200
        // Tick 1 due at: 7200 + 600 = 7800
        let due = scheduler.get_due_batches(4200, 600).await;
        assert!(due.is_empty(), "tick 1 not due at t=4200");

        let due = scheduler.get_due_batches(7799, 600).await;
        assert!(due.is_empty(), "tick 1 not due at t=7799");

        let due = scheduler.get_due_batches(7800, 600).await;
        assert_eq!(due, vec![1], "tick 1 due at t=7800");

        // Resolve tick 1, check tick 2
        scheduler.mark_resolved(1, 1).await;
        assert_eq!(scheduler.next_tick_for_batch(1).await, 2);

        // Tick 2 ends at: (0 + 2 + 1) * 3600 = 10800
        // Tick 2 due at: 10800 + 600 = 11400
        let due = scheduler.get_due_batches(11399, 600).await;
        assert!(due.is_empty());
        let due = scheduler.get_due_batches(11400, 600).await;
        assert_eq!(due, vec![1]);
    }

    #[tokio::test]
    async fn test_multiple_batches_due() {
        let scheduler = TickScheduler::new();

        // Batch 1: tick_duration=3600, created_at_tick=0
        // Tick 0 due at: (0+0+1)*3600 + 600 = 4200
        scheduler.on_batch_created(make_batch(1, 3600, 0)).await;

        // Batch 2: tick_duration=1800, created_at_tick=0
        // Tick 0 due at: (0+0+1)*1800 + 600 = 2400
        scheduler.on_batch_created(make_batch(2, 1800, 0)).await;

        // Batch 3: paused, should never appear
        let mut batch3 = make_batch(3, 60, 0);
        batch3.paused = true;
        scheduler.on_batch_created(batch3).await;

        // At t=2400: only batch 2 is due
        let mut due = scheduler.get_due_batches(2400, 600).await;
        due.sort();
        assert_eq!(due, vec![2]);

        // At t=4200: both batch 1 and 2 are due
        let mut due = scheduler.get_due_batches(4200, 600).await;
        due.sort();
        assert_eq!(due, vec![1, 2]);
    }

    #[tokio::test]
    async fn test_error_on_unknown_batch() {
        let scheduler = TickScheduler::new();

        let result = scheduler.on_batch_paused(999).await;
        assert!(matches!(
            result,
            Err(TickSchedulerError::BatchNotFound(999))
        ));

        let result = scheduler
            .on_player_withdrawn(999, Address::zero())
            .await;
        assert!(matches!(
            result,
            Err(TickSchedulerError::BatchNotFound(999))
        ));
    }

    #[tokio::test]
    async fn test_active_batch_count() {
        let scheduler = TickScheduler::new();

        scheduler.on_batch_created(make_batch(1, 3600, 0)).await;
        scheduler.on_batch_created(make_batch(2, 3600, 0)).await;
        assert_eq!(scheduler.active_batch_count().await, 2);

        scheduler.on_batch_paused(1).await.unwrap();
        assert_eq!(scheduler.active_batch_count().await, 1);

        scheduler.on_batch_unpaused(1).await.unwrap();
        assert_eq!(scheduler.active_batch_count().await, 2);
    }

    #[tokio::test]
    async fn test_batch_config_updated() {
        let scheduler = TickScheduler::new();
        let batch = make_batch(1, 3600, 0);
        scheduler.on_batch_created(batch).await;

        let new_hash = H256::from([0xAA; 32]);
        scheduler
            .on_batch_config_updated(1, new_hash, 120)
            .await;

        let batch = scheduler.get_batch(1).await.unwrap();
        assert_eq!(batch.next_config_hash, new_hash);
        assert_eq!(batch.next_lock_offset, 120);
        // Active config should remain unchanged
        assert_eq!(batch.config_hash, H256::zero());
        assert_eq!(batch.lock_offset, 0);
    }

    #[tokio::test]
    async fn test_batch_config_promoted() {
        let scheduler = TickScheduler::new();
        let mut batch = make_batch(1, 3600, 0);
        batch.next_lock_offset = 120;
        scheduler.on_batch_created(batch).await;

        let config_hash = H256::from([0xBB; 32]);
        scheduler
            .on_batch_config_promoted(1, config_hash, 5)
            .await;

        let batch = scheduler.get_batch(1).await.unwrap();
        assert_eq!(batch.config_hash, config_hash);
        assert_eq!(batch.lock_offset, 120); // promoted from next_lock_offset
        assert_eq!(batch.last_promotion_tick, 5);
        assert_eq!(batch.next_config_hash, H256::zero()); // cleared after promotion
    }

    #[tokio::test]
    async fn test_config_update_on_unknown_batch_is_noop() {
        let scheduler = TickScheduler::new();
        // Should not panic on unknown batch
        scheduler
            .on_batch_config_updated(999, H256::from([0xCC; 32]), 60)
            .await;
        scheduler
            .on_batch_config_promoted(999, H256::from([0xDD; 32]), 10)
            .await;
        // No batch exists, so nothing happened
        assert!(scheduler.get_batch(999).await.is_none());
    }

    // === Dual-balance tests (Vision First Deposit) ===

    #[tokio::test]
    async fn test_dual_balance_credit_and_query() {
        let scheduler = TickScheduler::new();
        let user = Address::from([0xAA; 20]);

        // Initially zero
        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(real, U256::zero());
        assert_eq!(virt, U256::zero());
        assert_eq!(scheduler.get_user_total_balance(user).await, U256::zero());

        // Credit virtual balance (cross-chain deposit from Settlement)
        scheduler
            .on_virtual_balance_credited(user, U256::from(1000))
            .await;
        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(real, U256::zero());
        assert_eq!(virt, U256::from(1000));
        assert_eq!(
            scheduler.get_user_total_balance(user).await,
            U256::from(1000)
        );

        // Credit real balance (direct L3 deposit)
        scheduler
            .on_real_balance_deposited(user, U256::from(500))
            .await;
        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(real, U256::from(500));
        assert_eq!(virt, U256::from(1000));
        assert_eq!(
            scheduler.get_user_total_balance(user).await,
            U256::from(1500)
        );
    }

    #[tokio::test]
    async fn test_dual_balance_withdraw() {
        let scheduler = TickScheduler::new();
        let user = Address::from([0xBB; 20]);

        scheduler
            .on_real_balance_deposited(user, U256::from(1000))
            .await;
        scheduler
            .on_virtual_balance_credited(user, U256::from(2000))
            .await;

        // Withdraw real
        scheduler
            .on_real_balance_withdrawn(user, U256::from(300))
            .await;
        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(real, U256::from(700));
        assert_eq!(virt, U256::from(2000));

        // Withdraw virtual (withdrawToSettlement)
        scheduler
            .on_virtual_balance_withdrawn(user, U256::from(500))
            .await;
        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(real, U256::from(700));
        assert_eq!(virt, U256::from(1500));
    }

    #[tokio::test]
    async fn test_dual_balance_batch_join_debit_virtual_first() {
        let scheduler = TickScheduler::new();
        let user = Address::from([0xCC; 20]);

        // User has 600 virtual + 400 real = 1000 total
        scheduler
            .on_virtual_balance_credited(user, U256::from(600))
            .await;
        scheduler
            .on_real_balance_deposited(user, U256::from(400))
            .await;

        // Join batch with 800 USDC — should debit 600 virtual + 200 real
        scheduler
            .on_batch_join_debit(user, U256::from(800))
            .await;

        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(virt, U256::zero(), "Virtual should be fully drained");
        assert_eq!(real, U256::from(200), "Real should have 200 remaining");
    }

    #[tokio::test]
    async fn test_dual_balance_batch_join_debit_only_virtual() {
        let scheduler = TickScheduler::new();
        let user = Address::from([0xDD; 20]);

        scheduler
            .on_virtual_balance_credited(user, U256::from(1000))
            .await;
        scheduler
            .on_real_balance_deposited(user, U256::from(500))
            .await;

        // Join with 500 — all from virtual
        scheduler
            .on_batch_join_debit(user, U256::from(500))
            .await;

        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(virt, U256::from(500), "Virtual should have 500 remaining");
        assert_eq!(real, U256::from(500), "Real should be untouched");
    }

    #[tokio::test]
    async fn test_dual_balance_batch_payout_credits_real() {
        let scheduler = TickScheduler::new();
        let user = Address::from([0xEE; 20]);

        // Start with only virtual balance
        scheduler
            .on_virtual_balance_credited(user, U256::from(1000))
            .await;

        // Batch payout always credits real
        scheduler
            .on_batch_payout(user, U256::from(300))
            .await;

        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(real, U256::from(300), "Payout should credit real");
        assert_eq!(virt, U256::from(1000), "Virtual should be untouched");
    }

    #[tokio::test]
    async fn test_dual_balance_set_and_get() {
        let scheduler = TickScheduler::new();
        let user = Address::from([0xFF; 20]);

        scheduler
            .set_user_balances(user, U256::from(123), U256::from(456))
            .await;

        let (real, virt) = scheduler.get_user_balance(user).await;
        assert_eq!(real, U256::from(123));
        assert_eq!(virt, U256::from(456));
        assert_eq!(
            scheduler.get_user_total_balance(user).await,
            U256::from(579)
        );
    }

    #[tokio::test]
    async fn test_dual_balance_saturating_withdraw() {
        let scheduler = TickScheduler::new();
        let user = Address::from([0x11; 20]);

        scheduler
            .on_real_balance_deposited(user, U256::from(100))
            .await;

        // Withdraw more than available — should saturate to 0, not underflow
        scheduler
            .on_real_balance_withdrawn(user, U256::from(200))
            .await;

        let (real, _virt) = scheduler.get_user_balance(user).await;
        assert_eq!(real, U256::zero(), "Should saturate to 0, not underflow");
    }
}
