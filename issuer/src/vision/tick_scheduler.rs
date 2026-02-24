//! Tick scheduler for Vision batch management
//!
//! Maintains in-memory state of all active batches and their players.
//! Fed by the chain listener (via event handler methods) and queried by the
//! tick engine to find batches that have a tick due for resolution.

use std::collections::HashMap;
use tokio::sync::RwLock;

use ethers::types::{Address, H256, U256};

use super::types::{Batch, PlayerPosition};

/// Tick scheduler: tracks active batches and determines when ticks are due.
pub struct TickScheduler {
    /// All active batches: batch_id -> Batch
    batches: RwLock<HashMap<u64, Batch>>,
    /// All player positions: batch_id -> (player -> PlayerPosition)
    players: RwLock<HashMap<u64, HashMap<Address, PlayerPosition>>>,
    /// Last resolved tick per batch: batch_id -> tick_id
    last_resolved: RwLock<HashMap<u64, u64>>,
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
            market_ids: vec![H256::zero()],
            resolution_types: vec![0],
            tick_duration,
            custom_thresholds: vec![],
            created_at_tick,
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
            join_timestamp: 1000,
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
}
