//! Two-slot bitmap store for Vision player predictions
//!
//! Each batch has two slots: *pending* and *active*.
//!
//! - Players submit bitmaps into the **pending** slot.
//! - At a tick boundary the engine calls `flip(batch_id)`, which merges
//!   pending entries into active.  Players who submitted a new bitmap get
//!   their active entry overwritten; players who did not submit keep their
//!   existing active entry — their prediction persists across ticks.
//! - Both maps live inside a single `RwLock<BitmapSlots>` to prevent
//!   deadlock and to make flip() atomic.

use ethers::types::{Address, H256};
use sqlx::PgPool;
use std::collections::HashMap;
use tokio::sync::RwLock;

use super::types::SlottedBitmap;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

struct BitmapSlots {
    pending: HashMap<u64, HashMap<Address, SlottedBitmap>>,
    active: HashMap<u64, HashMap<Address, SlottedBitmap>>,
}

impl BitmapSlots {
    fn new() -> Self {
        Self {
            pending: HashMap::new(),
            active: HashMap::new(),
        }
    }
}

// ---------------------------------------------------------------------------
// Public store
// ---------------------------------------------------------------------------

/// Two-slot in-memory bitmap store.
///
/// Thread-safe via a single `RwLock` that guards both pending and active maps.
pub struct BitmapStore {
    slots: RwLock<BitmapSlots>,
}

impl BitmapStore {
    pub fn new() -> Self {
        Self {
            slots: RwLock::new(BitmapSlots::new()),
        }
    }

    /// Store a bitmap in the **pending** slot after verifying its keccak256 hash.
    ///
    /// `config_hash` and `target_tick_id` travel with the bitmap so downstream
    /// code can detect config-version mismatches before using the bitmap.
    pub async fn store_pending(
        &self,
        player: Address,
        batch_id: u64,
        bitmap: Vec<u8>,
        expected_hash: H256,
        config_hash: H256,
        target_tick_id: u64,
    ) -> Result<(), BitmapStoreError> {
        let computed = keccak256(&bitmap);
        if computed != expected_hash {
            return Err(BitmapStoreError::HashMismatch {
                expected: expected_hash,
                computed,
            });
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let entry = SlottedBitmap {
            player,
            batch_id,
            bitmap,
            hash: expected_hash,
            config_hash,
            target_tick_id,
            received_at: now,
        };

        self.slots
            .write()
            .await
            .pending
            .entry(batch_id)
            .or_default()
            .insert(player, entry);

        Ok(())
    }

    /// Retrieve a player's **active** bitmap for a batch, if present.
    pub async fn get_active(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
        self.slots
            .read()
            .await
            .active
            .get(&batch_id)
            .and_then(|m| m.get(&player))
            .cloned()
    }

    /// Retrieve a player's **pending** bitmap for a batch, if present.
    pub async fn get_pending(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
        self.slots
            .read()
            .await
            .pending
            .get(&batch_id)
            .and_then(|m| m.get(&player))
            .cloned()
    }

    /// Return all **active** bitmaps for a batch (for tick resolution).
    pub async fn get_all_active_for_batch(&self, batch_id: u64) -> Vec<SlottedBitmap> {
        self.slots
            .read()
            .await
            .active
            .get(&batch_id)
            .map(|m| m.values().cloned().collect())
            .unwrap_or_default()
    }

    /// Merge pending bitmaps for `batch_id` into active.
    ///
    /// Players who submitted a new bitmap get their active entry overwritten.
    /// Players who did NOT submit keep their existing active entry — their
    /// prediction persists across ticks until they explicitly change it.
    pub async fn flip(&self, batch_id: u64) {
        let mut guard = self.slots.write().await;
        if let Some(pending_batch) = guard.pending.remove(&batch_id) {
            let active = guard.active.entry(batch_id).or_default();
            for (player, bitmap) in pending_batch {
                active.insert(player, bitmap);
            }
        }
        // Active bitmaps persist for players who didn't re-submit.
    }

    /// Remove all bitmaps (pending + active) for a batch. Called after settlement.
    pub async fn purge_batch(&self, batch_id: u64) {
        let mut guard = self.slots.write().await;
        guard.pending.remove(&batch_id);
        guard.active.remove(&batch_id);
    }

    /// Purge from both memory and DB.
    pub async fn purge_batch_from_db(&self, pool: &PgPool, batch_id: u64) -> Result<(), BitmapStoreError> {
        sqlx::query("DELETE FROM vision_bitmaps WHERE batch_id = $1")
            .bind(batch_id as i64)
            .execute(pool)
            .await
            .map_err(BitmapStoreError::Db)?;
        self.purge_batch(batch_id).await;
        Ok(())
    }

    /// Remove pending bitmaps for `batch_id` whose `target_tick_id` is older
    /// than `last_resolved_tick_id`.  Called after a tick resolves so that
    /// stragglers don't accumulate indefinitely.
    pub async fn cleanup_stale_pending(&self, batch_id: u64, last_resolved_tick_id: u64) {
        let mut guard = self.slots.write().await;
        if let Some(batch_pending) = guard.pending.get_mut(&batch_id) {
            batch_pending.retain(|_, bm| bm.target_tick_id > last_resolved_tick_id);
            if batch_pending.is_empty() {
                guard.pending.remove(&batch_id);
            }
        }
    }

    /// Remove a player's entries from **both** slots.
    ///
    /// Called when a player withdraws and is no longer eligible for settlement.
    pub async fn remove(&self, batch_id: u64, player: Address) {
        let mut guard = self.slots.write().await;
        if let Some(m) = guard.pending.get_mut(&batch_id) {
            m.remove(&player);
            if m.is_empty() {
                guard.pending.remove(&batch_id);
            }
        }
        if let Some(m) = guard.active.get_mut(&batch_id) {
            m.remove(&player);
            if m.is_empty() {
                guard.active.remove(&batch_id);
            }
        }
    }

    // -----------------------------------------------------------------------
    // DB persistence
    // -----------------------------------------------------------------------

    /// Upsert a player's **pending** bitmap for `batch_id` into `vision_bitmaps`.
    pub async fn persist_pending_to_db(
        &self,
        pool: &PgPool,
        batch_id: u64,
        player: Address,
        bitmap: &SlottedBitmap,
    ) -> Result<(), BitmapStoreError> {
        sqlx::query(
            "INSERT INTO vision_bitmaps
                 (batch_id, player, bitmap, bitmap_hash, slot, target_tick_id, config_hash)
             VALUES ($1, $2, $3, $4, 'pending', $5, $6)
             ON CONFLICT (batch_id, player, slot) DO UPDATE SET
                 bitmap         = EXCLUDED.bitmap,
                 bitmap_hash    = EXCLUDED.bitmap_hash,
                 target_tick_id = EXCLUDED.target_tick_id,
                 config_hash    = EXCLUDED.config_hash",
        )
        .bind(batch_id as i64)
        .bind(format!("{:?}", player))
        .bind(&bitmap.bitmap)
        .bind(format!("{:?}", bitmap.hash))
        .bind(bitmap.target_tick_id as i64)
        .bind(format!("{:?}", bitmap.config_hash))
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Merge pending bitmaps into active rows in the DB and record the
    /// resolved tick id in `vision_batch_state`.
    ///
    /// Mirrors the in-memory `flip()` merge logic: pending entries overwrite
    /// their matching active rows (by player), but active rows without a
    /// pending replacement are kept intact.
    pub async fn persist_flip_and_mark_resolved(
        &self,
        pool: &PgPool,
        batch_id: u64,
        resolved_tick_id: u64,
    ) -> Result<(), BitmapStoreError> {
        let mut tx = pool.begin().await.map_err(BitmapStoreError::Db)?;

        // 1. For each pending row, upsert into active (overwrite if exists,
        //    insert if the player had no active entry). Existing active rows
        //    for players without a pending replacement remain untouched.
        sqlx::query(
            "INSERT INTO vision_bitmaps (batch_id, player, bitmap, bitmap_hash, slot, target_tick_id, config_hash)
             SELECT batch_id, player, bitmap, bitmap_hash, 'active', target_tick_id, config_hash
             FROM vision_bitmaps
             WHERE batch_id = $1 AND slot = 'pending'
             ON CONFLICT (batch_id, player, slot) DO UPDATE SET
                 bitmap         = EXCLUDED.bitmap,
                 bitmap_hash    = EXCLUDED.bitmap_hash,
                 target_tick_id = EXCLUDED.target_tick_id,
                 config_hash    = EXCLUDED.config_hash",
        )
        .bind(batch_id as i64)
        .execute(&mut *tx)
        .await
        .map_err(BitmapStoreError::Db)?;

        // 2. Remove pending rows now that they've been merged.
        sqlx::query("DELETE FROM vision_bitmaps WHERE batch_id = $1 AND slot = 'pending'")
            .bind(batch_id as i64)
            .execute(&mut *tx)
            .await
            .map_err(BitmapStoreError::Db)?;

        // 3. Record the resolved tick id.
        sqlx::query(
            "INSERT INTO vision_batch_state (batch_id, last_resolved_tick_id)
             VALUES ($1, $2)
             ON CONFLICT (batch_id) DO UPDATE SET
                 last_resolved_tick_id = EXCLUDED.last_resolved_tick_id",
        )
        .bind(batch_id as i64)
        .bind(resolved_tick_id as i64)
        .execute(&mut *tx)
        .await
        .map_err(BitmapStoreError::Db)?;

        tx.commit().await.map_err(BitmapStoreError::Db)?;
        Ok(())
    }

    /// Reload all bitmaps from the DB into the in-memory store.
    ///
    /// Called once at startup for crash recovery.  Any row whose `player`
    /// address or hash cannot be parsed is silently skipped — the oracle will
    /// simply request a fresh bitmap from the player on the next tick.
    pub async fn load_from_db(&self, pool: &PgPool) -> Result<(), BitmapStoreError> {
        let rows = sqlx::query_as::<_, (i64, String, Vec<u8>, String, String, i64, String)>(
            "SELECT batch_id, player, bitmap, bitmap_hash, slot, target_tick_id, config_hash
             FROM vision_bitmaps",
        )
        .fetch_all(pool)
        .await
        .map_err(BitmapStoreError::Db)?;

        let mut slots = self.slots.write().await;
        for (batch_id, player_str, bitmap, hash_str, slot, tick_id, config_hash_str) in rows {
            let player: Address = match player_str.parse() {
                Ok(a) => a,
                Err(_) => continue,
            };
            let hash: H256 = match hash_str.parse() {
                Ok(h) => h,
                Err(_) => continue,
            };
            let config_hash: H256 = match config_hash_str.parse() {
                Ok(h) => h,
                Err(_) => continue,
            };

            let bid = batch_id as u64;
            let entry = SlottedBitmap {
                player,
                batch_id: bid,
                bitmap,
                hash,
                config_hash,
                target_tick_id: tick_id as u64,
                received_at: 0,
            };
            match slot.as_str() {
                "pending" => {
                    slots.pending.entry(bid).or_default().insert(player, entry);
                }
                "active" => {
                    slots.active.entry(bid).or_default().insert(player, entry);
                }
                _ => {}
            }
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum BitmapStoreError {
    #[error("Hash mismatch: expected {expected:?}, computed {computed:?}")]
    HashMismatch { expected: H256, computed: H256 },
    #[error("DB error: {0}")]
    Db(#[from] sqlx::Error),
}

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

fn keccak256(data: &[u8]) -> H256 {
    H256::from(ethers::core::utils::keccak256(data))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_hash(data: &[u8]) -> H256 {
        keccak256(data)
    }

    fn zero_config() -> H256 {
        H256::zero()
    }

    // ------------------------------------------------------------------
    // store_pending → get_pending → flip → get_active
    // ------------------------------------------------------------------
    #[tokio::test]
    async fn test_two_slot_store_and_flip() {
        let store = BitmapStore::new();
        let player = Address::random();
        let batch_id = 1u64;
        let bitmap = vec![0u8, 1, 1, 0];
        let hash = make_hash(&bitmap);
        let config_hash = make_hash(b"config_v1");
        let target_tick = 42u64;

        // Nothing in either slot yet.
        assert!(store.get_pending(batch_id, player).await.is_none());
        assert!(store.get_active(batch_id, player).await.is_none());

        // Store into pending.
        store
            .store_pending(player, batch_id, bitmap.clone(), hash, config_hash, target_tick)
            .await
            .expect("store_pending should succeed");

        assert!(store.get_pending(batch_id, player).await.is_some());
        assert!(store.get_active(batch_id, player).await.is_none());

        // Flip promotes pending → active.
        store.flip(batch_id).await;

        assert!(store.get_pending(batch_id, player).await.is_none());
        let active = store
            .get_active(batch_id, player)
            .await
            .expect("should be active after flip");

        assert_eq!(active.player, player);
        assert_eq!(active.batch_id, batch_id);
        assert_eq!(active.bitmap, bitmap);
        assert_eq!(active.hash, hash);
        assert_eq!(active.config_hash, config_hash);
        assert_eq!(active.target_tick_id, target_tick);
    }

    // ------------------------------------------------------------------
    // flip() clears previous active before promoting new pending
    // ------------------------------------------------------------------
    #[tokio::test]
    async fn test_flip_clears_previous_active() {
        let store = BitmapStore::new();
        let player = Address::random();
        let batch_id = 2u64;

        let bitmap_a = vec![1u8, 0];
        let bitmap_b = vec![0u8, 1];

        // First tick: player submits bitmap_a.
        store
            .store_pending(
                player,
                batch_id,
                bitmap_a.clone(),
                make_hash(&bitmap_a),
                zero_config(),
                10,
            )
            .await
            .unwrap();
        store.flip(batch_id).await;

        let active = store.get_active(batch_id, player).await.unwrap();
        assert_eq!(active.bitmap, bitmap_a);

        // Second tick: player submits bitmap_b.
        store
            .store_pending(
                player,
                batch_id,
                bitmap_b.clone(),
                make_hash(&bitmap_b),
                zero_config(),
                11,
            )
            .await
            .unwrap();
        store.flip(batch_id).await;

        let active2 = store.get_active(batch_id, player).await.unwrap();
        assert_eq!(active2.bitmap, bitmap_b, "active should reflect the new bitmap");

        // Old bitmap_a must be gone from both slots.
        let all_active = store.get_all_active_for_batch(batch_id).await;
        assert_eq!(all_active.len(), 1);
    }

    // ------------------------------------------------------------------
    // A player who submits no pending bitmap persists in active
    // ------------------------------------------------------------------
    #[tokio::test]
    async fn test_no_pending_means_persist() {
        let store = BitmapStore::new();
        let player_a = Address::random();
        let player_b = Address::random();
        let batch_id = 3u64;

        let bm_a = vec![1u8, 1];
        let bm_b = vec![0u8, 0];

        // Both players active from tick N.
        store
            .store_pending(player_a, batch_id, bm_a.clone(), make_hash(&bm_a), zero_config(), 5)
            .await
            .unwrap();
        store
            .store_pending(player_b, batch_id, bm_b.clone(), make_hash(&bm_b), zero_config(), 5)
            .await
            .unwrap();
        store.flip(batch_id).await;

        assert_eq!(store.get_all_active_for_batch(batch_id).await.len(), 2);

        // Tick N+1: only player_a submits a new bitmap.
        let bm_a2 = vec![0u8, 0, 1];
        store
            .store_pending(player_a, batch_id, bm_a2.clone(), make_hash(&bm_a2), zero_config(), 6)
            .await
            .unwrap();
        store.flip(batch_id).await;

        // Both players remain active — player_b's old bitmap persists.
        let active = store.get_all_active_for_batch(batch_id).await;
        assert_eq!(active.len(), 2, "player_b persists — prediction carries across ticks");

        // player_a got the updated bitmap.
        let a_active = store.get_active(batch_id, player_a).await.unwrap();
        assert_eq!(a_active.bitmap, bm_a2);

        // player_b kept the original bitmap.
        let b_active = store.get_active(batch_id, player_b).await.unwrap();
        assert_eq!(b_active.bitmap, bm_b);
    }

    // ------------------------------------------------------------------
    // Hash mismatch is rejected
    // ------------------------------------------------------------------
    #[tokio::test]
    async fn test_hash_mismatch_rejected() {
        let store = BitmapStore::new();
        let player = Address::random();
        let bitmap = vec![1u8, 0, 1];
        let wrong_hash = H256::zero();

        let result = store
            .store_pending(player, 1, bitmap, wrong_hash, zero_config(), 1)
            .await;

        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            BitmapStoreError::HashMismatch { .. }
        ));
    }

    // ------------------------------------------------------------------
    // remove() clears both slots
    // ------------------------------------------------------------------
    #[tokio::test]
    async fn test_remove_clears_both_slots() {
        let store = BitmapStore::new();
        let player = Address::random();
        let batch_id = 4u64;
        let bm = vec![1u8];

        store
            .store_pending(player, batch_id, bm.clone(), make_hash(&bm), zero_config(), 1)
            .await
            .unwrap();
        store.flip(batch_id).await;

        // Put another entry in pending.
        store
            .store_pending(player, batch_id, bm.clone(), make_hash(&bm), zero_config(), 2)
            .await
            .unwrap();

        store.remove(batch_id, player).await;

        assert!(store.get_pending(batch_id, player).await.is_none());
        assert!(store.get_active(batch_id, player).await.is_none());
    }

    // ------------------------------------------------------------------
    // cleanup_stale_pending removes old entries only
    // ------------------------------------------------------------------
    #[tokio::test]
    async fn test_cleanup_stale_pending() {
        let store = BitmapStore::new();
        let player_old = Address::random();
        let player_new = Address::random();
        let batch_id = 5u64;
        let bm = vec![1u8];
        let hash = make_hash(&bm);

        // One entry targeting tick 5 (stale), one targeting tick 10 (fresh).
        store
            .store_pending(player_old, batch_id, bm.clone(), hash, zero_config(), 5)
            .await
            .unwrap();
        store
            .store_pending(player_new, batch_id, bm.clone(), hash, zero_config(), 10)
            .await
            .unwrap();

        // Resolve tick 7: anything with target_tick_id <= 7 is stale.
        store.cleanup_stale_pending(batch_id, 7).await;

        assert!(store.get_pending(batch_id, player_old).await.is_none());
        assert!(store.get_pending(batch_id, player_new).await.is_some());
    }

    // ------------------------------------------------------------------
    // get_all_active_for_batch only returns entries for the requested batch
    // ------------------------------------------------------------------
    #[tokio::test]
    async fn test_get_all_active_only_returns_requested_batch() {
        let store = BitmapStore::new();
        let player = Address::random();
        let bm = vec![1u8];
        let hash = make_hash(&bm);

        for batch_id in [10u64, 20, 30] {
            store.store_pending(player, batch_id, bm.clone(), hash, zero_config(), 1).await.unwrap();
            store.flip(batch_id).await;
        }

        let active_20 = store.get_all_active_for_batch(20).await;
        assert_eq!(active_20.len(), 1);
        assert_eq!(active_20[0].batch_id, 20);

        assert_eq!(store.get_all_active_for_batch(10).await.len(), 1);
        assert_eq!(store.get_all_active_for_batch(30).await.len(), 1);
        assert_eq!(store.get_all_active_for_batch(99).await.len(), 0);
    }
}
