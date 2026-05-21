//! Batch state tracker for Vision
//!
//! Maintains in-memory state of all active batches and their players.
//! Fed by the chain listener (via event handler methods) and queried by the
//! lifecycle manager and API layer.
//!
//! ## Memory model
//!
//! Two modes are supported, switchable per oracle via `--lazy-vision-state`.
//!
//! * **Strict** (legacy default): every active batch and every active player
//!   position is preloaded on startup and kept in memory for the life of the
//!   process. Simple, fast, and leaks several GB of RSS on busy networks.
//! * **Lazy**: `load_from_db` skips the position load. The `batches` map still
//!   holds the small, immutable per-batch config (~200 B × ~30 k = 6 MB). Player
//!   positions are read from Postgres on demand at settle time, then dropped.
//!   The `players` map is still updated by chain events for hot-path bitmap
//!   verification, but it is no longer treated as authoritative cold storage —
//!   it only ever holds joins/withdraws observed since startup.
//!
//! Lazy mode collapses the steady-state RSS by 1000×: a missed `mark_settled`
//! used to leak a 200-position map (tens of KB), now it leaks at most a single
//! `Batch` (~200 B).

use std::collections::HashMap;
use tokio::sync::RwLock;

use ethers::types::{Address, H256, U256};
use sqlx::PgPool;
use tracing::info;

use super::types::{Batch, PlayerPosition};

/// Batch state tracker: holds in-memory batch metadata and (optionally) player positions.
pub struct TickScheduler {
    /// All active batches: batch_id -> Batch (config-only; ~200 B per entry).
    batches: RwLock<HashMap<u64, Batch>>,
    /// All player positions: batch_id -> (player -> PlayerPosition).
    /// In lazy mode this map is fed only by chain events observed since startup;
    /// authoritative reads go to Postgres via `load_positions_now`.
    players: RwLock<HashMap<u64, HashMap<Address, PlayerPosition>>>,
    /// When true, `load_from_db` skips the position bootstrap and authoritative
    /// reads (`get_batch_state`, `player_count`, `get_player_bitmap_hash`) consult
    /// Postgres on demand.
    lazy: bool,
    /// Postgres pool used by lazy-mode on-demand reads. `None` in strict mode.
    pool: Option<PgPool>,
}

#[derive(Debug, thiserror::Error)]
pub enum TickSchedulerError {
    #[error("batch {0} not found")]
    BatchNotFound(u64),
    #[error("player {player:?} not found in batch {batch_id}")]
    PlayerNotFound { batch_id: u64, player: Address },
}

impl TickScheduler {
    /// Strict mode constructor — preserves legacy behavior.
    pub fn new() -> Self {
        Self {
            batches: RwLock::new(HashMap::new()),
            players: RwLock::new(HashMap::new()),
            lazy: false,
            pool: None,
        }
    }

    /// Lazy mode constructor — skips the position bootstrap and serves
    /// authoritative position reads from Postgres. The pool must be the same
    /// one passed to `load_from_db`.
    pub fn new_lazy(pool: PgPool) -> Self {
        Self {
            batches: RwLock::new(HashMap::new()),
            players: RwLock::new(HashMap::new()),
            lazy: true,
            pool: Some(pool),
        }
    }

    /// Whether this scheduler operates in lazy mode.
    pub fn is_lazy(&self) -> bool {
        self.lazy
    }

    /// Read player positions for a batch directly from Postgres, bypassing the
    /// in-memory `players` map. Used by lazy mode at settle time and by lazy-mode
    /// API handlers. Returns `Ok(vec![])` if the batch has no live positions.
    pub async fn load_positions_now(
        &self,
        batch_id: u64,
    ) -> Result<Vec<PlayerPosition>, sqlx::Error> {
        let pool = match self.pool.as_ref() {
            Some(p) => p,
            None => return Ok(Vec::new()),
        };
        let rows: Vec<(String, String, String)> = sqlx::query_as(
            "SELECT player, bitmap_hash, total_deposited::text \
             FROM vision_positions \
             WHERE batch_id = $1 AND balance > 0",
        )
        .bind(batch_id as i64)
        .fetch_all(pool)
        .await?;

        let mut out = Vec::with_capacity(rows.len());
        for (player, bitmap_hash, total_deposited) in rows {
            out.push(PlayerPosition {
                player: player.parse().unwrap_or_default(),
                bitmap_hash: bitmap_hash.parse().unwrap_or_default(),
                deposit: U256::from_dec_str(&total_deposited).unwrap_or_default(),
            });
        }
        Ok(out)
    }

    /// Count live positions for a batch directly from Postgres. Used by lazy
    /// mode where the in-memory `players` map is not authoritative.
    async fn count_positions_now(&self, batch_id: u64) -> Result<usize, sqlx::Error> {
        let pool = match self.pool.as_ref() {
            Some(p) => p,
            None => return Ok(0),
        };
        let count: Option<i64> = sqlx::query_scalar(
            "SELECT COUNT(*) FROM vision_positions WHERE batch_id = $1 AND balance > 0",
        )
        .bind(batch_id as i64)
        .fetch_one(pool)
        .await?;
        Ok(count.unwrap_or(0) as usize)
    }

    // === Chain event handlers (called by ChainListener) ===

    /// Register a newly created batch.
    pub async fn on_batch_created(&self, batch: Batch) {
        self.batches.write().await.insert(batch.id, batch);
    }

    /// Update config_hash and source_id for a batch (used by config hash repair).
    pub async fn update_config_hash(&self, batch_id: u64, config_hash: H256, source_id: H256) {
        if let Some(batch) = self.batches.write().await.get_mut(&batch_id) {
            batch.config_hash = config_hash;
            batch.source_id = source_id;
        }
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

    /// Update a player's bitmap hash after an on-chain updateBitmap() call.
    pub async fn on_bitmap_updated(
        &self,
        batch_id: u64,
        player: Address,
        new_bitmap_hash: H256,
    ) -> Result<(), TickSchedulerError> {
        let mut players = self.players.write().await;
        let batch_players = players
            .get_mut(&batch_id)
            .ok_or(TickSchedulerError::BatchNotFound(batch_id))?;
        let pos = batch_players
            .get_mut(&player)
            .ok_or(TickSchedulerError::PlayerNotFound { batch_id, player })?;
        pos.bitmap_hash = new_bitmap_hash;
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

    /// Pause a batch.
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

    /// Update a batch's config hash directly (round-based: no pending/promotion).
    pub async fn on_batch_config_updated(
        &self,
        batch_id: u64,
        new_config_hash: H256,
        _new_lock_offset: u64,
        _new_tick_duration: u64,
    ) {
        let mut batches = self.batches.write().await;
        if let Some(batch) = batches.get_mut(&batch_id) {
            batch.config_hash = new_config_hash;
        }
    }

    /// Promote config hash (legacy event — just sets config_hash directly).
    pub async fn on_batch_config_promoted(
        &self,
        batch_id: u64,
        config_hash: H256,
        _promoted_at_tick: u64,
    ) {
        let mut batches = self.batches.write().await;
        if let Some(batch) = batches.get_mut(&batch_id) {
            batch.config_hash = config_hash;
        }
    }

    // === Query methods ===

    /// Get batch state for resolution. In lazy mode the player list is read
    /// from Postgres on demand; in strict mode it comes from the in-memory map.
    pub async fn get_batch_state(
        &self,
        batch_id: u64,
    ) -> Option<(Batch, Vec<PlayerPosition>)> {
        let batch = self.batches.read().await.get(&batch_id)?.clone();

        if self.lazy {
            // Authoritative read goes to Postgres. The in-memory map is best-effort.
            match self.load_positions_now(batch_id).await {
                Ok(list) => Some((batch, list)),
                Err(e) => {
                    tracing::warn!(
                        batch_id,
                        error = %e,
                        "lazy load_positions_now failed; falling back to in-memory players map"
                    );
                    let list = self
                        .players
                        .read()
                        .await
                        .get(&batch_id)
                        .map(|m| m.values().cloned().collect())
                        .unwrap_or_default();
                    Some((batch, list))
                }
            }
        } else {
            let list = self
                .players
                .read()
                .await
                .get(&batch_id)
                .map(|m| m.values().cloned().collect())
                .unwrap_or_default();
            Some((batch, list))
        }
    }

    /// Get a player's on-chain bitmap hash (for verification).
    /// In lazy mode this consults Postgres when the in-memory map has no entry,
    /// so chain-event lag doesn't masquerade as a cache miss.
    pub async fn get_player_bitmap_hash(
        &self,
        batch_id: u64,
        player: Address,
    ) -> Option<H256> {
        if let Some(hash) = self
            .players
            .read()
            .await
            .get(&batch_id)
            .and_then(|m| m.get(&player))
            .map(|p| p.bitmap_hash)
        {
            return Some(hash);
        }

        if !self.lazy {
            return None;
        }

        let pool = self.pool.as_ref()?;
        let player_hex = format!("{:?}", player);
        sqlx::query_scalar::<_, String>(
            "SELECT bitmap_hash FROM vision_positions \
             WHERE batch_id = $1 AND LOWER(player) = LOWER($2) AND balance > 0",
        )
        .bind(batch_id as i64)
        .bind(&player_hex)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|s| s.parse().ok())
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
    /// In lazy mode this defers to Postgres unless the in-memory map already
    /// has a positive count (covers freshly-joined players observed since the
    /// last bootstrap).
    pub async fn player_count(&self, batch_id: u64) -> usize {
        let in_memory = self
            .players
            .read()
            .await
            .get(&batch_id)
            .map(|m| m.len())
            .unwrap_or(0);

        if !self.lazy || in_memory > 0 {
            return in_memory;
        }

        match self.count_positions_now(batch_id).await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(
                    batch_id,
                    error = %e,
                    "lazy count_positions_now failed; reporting 0"
                );
                0
            }
        }
    }

    /// Find the latest (highest ID) on-chain batch for a given source.
    pub async fn find_latest_batch_for_source(&self, source_id: H256) -> Option<u64> {
        self.batches
            .read()
            .await
            .iter()
            .filter(|(_, batch)| batch.source_id == source_id)
            .map(|(&id, _)| id)
            .max()
    }

    /// Get all batch IDs (for leaderboard aggregation).
    pub async fn get_all_batch_ids(&self) -> Vec<u64> {
        self.batches.read().await.keys().copied().collect()
    }

    /// Remove a batch from all in-memory state. Called after settlement.
    pub async fn remove_batch(&self, batch_id: u64) {
        self.batches.write().await.remove(&batch_id);
        self.players.write().await.remove(&batch_id);
    }

    /// Mark a batch as settled in Postgres and remove from memory.
    pub async fn mark_settled(&self, pool: &PgPool, batch_id: u64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE vision_batches SET state = 'settled', paused = true WHERE id = $1")
            .bind(batch_id as i64)
            .execute(pool)
            .await?;
        self.remove_batch(batch_id).await;
        Ok(())
    }

    // === DB persistence for crash recovery ===

    /// Load batch metadata and player positions from DB on startup.
    pub async fn load_from_db(&self, pool: &PgPool) -> Result<(), sqlx::Error> {
        // 1. Load batches
        let batch_rows: Vec<(i64, String, i64, i64, bool, String, String, i64)> =
            sqlx::query_as(
                "SELECT id, creator, tick_duration, created_at_tick, paused, \
                 source_id, config_hash, COALESCE(lock_offset, 0) \
                 FROM vision_batches WHERE NOT paused AND (state = 'active' OR state IS NULL)",
            )
            .fetch_all(pool)
            .await?;

        {
            let mut batches = self.batches.write().await;
            for (id, creator, tick_duration, created_at_tick, paused, source_id, config_hash, lock_offset) in &batch_rows {
                let batch = Batch {
                    id: *id as u64,
                    creator: creator.parse().unwrap_or_default(),
                    source_id: source_id.parse().unwrap_or_default(),
                    config_hash: config_hash.parse().unwrap_or_default(),
                    tick_duration: *tick_duration as u64,
                    lock_offset: *lock_offset as u64,
                    // settlement_grace not yet persisted to DB; chain_listener
                    // re-hydrates it from the contract on startup. Default 0
                    // means the refund cliff stays closed until the listener
                    // refreshes — safer than a guess.
                    settlement_grace: 0,
                    created_at_tick: *created_at_tick as u64,
                    paused: *paused,
                    settled: false, // loaded from active batches, not settled
                };
                batches.insert(batch.id, batch);
            }
        }
        info!(count = batch_rows.len(), "Loaded batches from DB");

        if self.lazy {
            // The whole point of lazy mode: do not preload ~221k positions into
            // RAM. Authoritative reads happen on demand via `load_positions_now`.
            // Chain-event handlers still populate the in-memory map for the
            // hot bitmap-verification path, but that map only ever holds joins
            // observed since this oracle started — bounded by the active batch
            // tick window, not by historical depth.
            info!("lazy-vision-state: skipping player position bootstrap");
            return Ok(());
        }

        // 2. Load player positions — only for the active, non-paused batches we just
        // loaded above. Without this join, positions from already-settled batches that
        // happen to still carry balance > 0 (refunds pending, withdrawals not claimed)
        // pile into the in-memory map: ~493k of the ~715k rows belong to dead batches.
        // The oracle never schedules ticks for them; it just paid RSS to remember them.
        let pos_rows: Vec<(i64, String, String, i64, String, String)> =
            sqlx::query_as(
                "SELECT p.batch_id, p.player, p.bitmap_hash, p.start_tick, \
                        p.balance::text, p.total_deposited::text \
                 FROM vision_positions p \
                 JOIN vision_batches b ON b.id = p.batch_id \
                 WHERE p.balance > 0 \
                   AND NOT b.paused \
                   AND (b.state = 'active' OR b.state IS NULL)",
            )
            .fetch_all(pool)
            .await?;

        {
            let mut players = self.players.write().await;
            for (batch_id, player, bitmap_hash, _start_tick, _balance, total_deposited) in &pos_rows {
                let deposit = U256::from_dec_str(total_deposited).unwrap_or_default();
                let position = PlayerPosition {
                    player: player.parse().unwrap_or_default(),
                    bitmap_hash: bitmap_hash.parse().unwrap_or_default(),
                    deposit,
                };
                players
                    .entry(*batch_id as u64)
                    .or_default()
                    .insert(position.player, position);
            }
        }
        info!(count = pos_rows.len(), "Loaded player positions from DB");

        Ok(())
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
            tick_duration,
            lock_offset: 0,
            settlement_grace: 0,
            created_at_tick,
            paused: false,
            settled: false,
        }
    }

    fn make_player(player: Address, deposit: u64) -> PlayerPosition {
        PlayerPosition {
            player,
            bitmap_hash: H256::random(),
            deposit: U256::from(deposit),
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

        let state = scheduler.get_batch_state(1).await;
        assert!(state.is_some());
        let (b, players) = state.unwrap();
        assert_eq!(b.id, 1);
        assert!(players.is_empty());
    }

    #[tokio::test]
    async fn test_paused_batch() {
        let scheduler = TickScheduler::new();
        let batch = make_batch(1, 3600, 0);
        scheduler.on_batch_created(batch).await;

        scheduler.on_batch_paused(1).await.unwrap();
        assert_eq!(scheduler.active_batch_count().await, 0);

        scheduler.on_batch_unpaused(1).await.unwrap();
        assert_eq!(scheduler.active_batch_count().await, 1);
    }

    #[tokio::test]
    async fn test_player_join_and_withdraw() {
        let scheduler = TickScheduler::new();
        let batch = make_batch(1, 3600, 0);
        scheduler.on_batch_created(batch).await;

        let player_a = Address::random();
        let player_b = Address::random();

        scheduler
            .on_player_joined(1, make_player(player_a, 100))
            .await;
        scheduler
            .on_player_joined(1, make_player(player_b, 200))
            .await;

        assert_eq!(scheduler.player_count(1).await, 2);

        let (_, players) = scheduler.get_batch_state(1).await.unwrap();
        assert_eq!(players.len(), 2);

        scheduler.on_player_withdrawn(1, player_a).await.unwrap();
        assert_eq!(scheduler.player_count(1).await, 1);

        let (_, players) = scheduler.get_batch_state(1).await.unwrap();
        assert_eq!(players.len(), 1);
        assert_eq!(players[0].player, player_b);
    }

    #[tokio::test]
    async fn test_strict_mode_default() {
        // Strict mode preserves the legacy behavior: `is_lazy` is false, no pool.
        let scheduler = TickScheduler::new();
        assert!(!scheduler.is_lazy());
        // load_positions_now returns empty (no pool) without panicking.
        let positions = scheduler.load_positions_now(42).await.unwrap();
        assert!(positions.is_empty());
    }

    #[tokio::test]
    async fn test_find_latest_batch_for_source() {
        let scheduler = TickScheduler::new();
        let sid = H256::from([1u8; 32]);

        let mut b1 = make_batch(10, 3600, 0);
        b1.source_id = sid;
        let mut b2 = make_batch(20, 3600, 0);
        b2.source_id = sid;
        let mut b3 = make_batch(5, 3600, 0);
        b3.source_id = H256::from([2u8; 32]); // different source

        scheduler.on_batch_created(b1).await;
        scheduler.on_batch_created(b2).await;
        scheduler.on_batch_created(b3).await;

        assert_eq!(scheduler.find_latest_batch_for_source(sid).await, Some(20));
    }
}
