//! Two-slot bitmap store for Vision player predictions
//!
//! Each batch has two slots: *pending* and *active*.
//!
//! - Players submit bitmaps into the **pending** slot.
//! - At a tick boundary the engine calls `flip(batch_id)`, which promotes
//!   every pending entry to active (clearing the previous active set for that
//!   batch first).  Players who did not submit a new bitmap simply sit out the
//!   next tick — their old active entry is gone after the flip.
//! - Both maps live inside a single `RwLock<BitmapSlots>` to prevent
//!   deadlock and to make flip() atomic.

use ethers::types::{Address, H256};
use std::collections::HashMap;
use tokio::sync::RwLock;

use super::types::SlottedBitmap;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

struct BitmapSlots {
    pending: HashMap<(u64, Address), SlottedBitmap>,
    active: HashMap<(u64, Address), SlottedBitmap>,
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
            .insert((batch_id, player), entry);

        Ok(())
    }

    /// Retrieve a player's **active** bitmap for a batch, if present.
    pub async fn get_active(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
        self.slots
            .read()
            .await
            .active
            .get(&(batch_id, player))
            .cloned()
    }

    /// Retrieve a player's **pending** bitmap for a batch, if present.
    pub async fn get_pending(&self, batch_id: u64, player: Address) -> Option<SlottedBitmap> {
        self.slots
            .read()
            .await
            .pending
            .get(&(batch_id, player))
            .cloned()
    }

    /// Return all **active** bitmaps for a batch (for tick resolution).
    pub async fn get_all_active_for_batch(&self, batch_id: u64) -> Vec<SlottedBitmap> {
        self.slots
            .read()
            .await
            .active
            .iter()
            .filter(|((bid, _), _)| *bid == batch_id)
            .map(|(_, v)| v.clone())
            .collect()
    }

    /// Promote all pending bitmaps for `batch_id` to active.
    ///
    /// 1. Remove every existing active entry for this batch.
    /// 2. Move every pending entry for this batch into active.
    ///
    /// Players who submitted no pending bitmap sit out the tick — they have no
    /// active entry after the flip.
    pub async fn flip(&self, batch_id: u64) {
        let mut guard = self.slots.write().await;

        // 1. Clear old active entries for this batch.
        guard.active.retain(|(bid, _), _| *bid != batch_id);

        // 2. Drain matching pending entries into active.
        let to_promote: Vec<_> = guard
            .pending
            .keys()
            .filter(|(bid, _)| *bid == batch_id)
            .cloned()
            .collect();

        for key in to_promote {
            if let Some(bitmap) = guard.pending.remove(&key) {
                guard.active.insert(key, bitmap);
            }
        }
    }

    /// Remove pending bitmaps for `batch_id` whose `target_tick_id` is older
    /// than `last_resolved_tick_id`.  Called after a tick resolves so that
    /// stragglers don't accumulate indefinitely.
    pub async fn cleanup_stale_pending(&self, batch_id: u64, last_resolved_tick_id: u64) {
        self.slots.write().await.pending.retain(|(bid, _), bm| {
            *bid != batch_id || bm.target_tick_id > last_resolved_tick_id
        });
    }

    /// Remove a player's entries from **both** slots.
    ///
    /// Called when a player withdraws and is no longer eligible for settlement.
    pub async fn remove(&self, batch_id: u64, player: Address) {
        let mut guard = self.slots.write().await;
        guard.pending.remove(&(batch_id, player));
        guard.active.remove(&(batch_id, player));
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
    // A player who submits no pending bitmap sits out after flip
    // ------------------------------------------------------------------
    #[tokio::test]
    async fn test_no_pending_means_sit_out() {
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

        // Tick N+1: only player_a submits.
        store
            .store_pending(player_a, batch_id, bm_a.clone(), make_hash(&bm_a), zero_config(), 6)
            .await
            .unwrap();
        store.flip(batch_id).await;

        let active = store.get_all_active_for_batch(batch_id).await;
        assert_eq!(active.len(), 1, "player_b sat out — should not appear in active");
        assert_eq!(active[0].player, player_a);

        // player_b is gone from active.
        assert!(store.get_active(batch_id, player_b).await.is_none());
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
}
