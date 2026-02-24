//! Bitmap store for Vision player predictions
//!
//! In-memory store for player bitmaps. Each issuer holds all bitmaps and
//! verifies them against their on-chain keccak256 commitment hash before storing.

use ethers::core::utils::keccak256;
use ethers::types::{Address, H256};
use std::collections::HashMap;
use tokio::sync::RwLock;

use super::types::StoredBitmap;

/// In-memory store for player bitmaps. Each issuer holds all bitmaps.
pub struct BitmapStore {
    /// (batch_id, player) -> StoredBitmap
    bitmaps: RwLock<HashMap<(u64, Address), StoredBitmap>>,
}

impl BitmapStore {
    pub fn new() -> Self {
        Self {
            bitmaps: RwLock::new(HashMap::new()),
        }
    }

    /// Store a bitmap after verifying keccak256(bitmap) matches the on-chain hash.
    pub async fn store(
        &self,
        player: Address,
        batch_id: u64,
        bitmap: Vec<u8>,
        expected_hash: H256,
    ) -> Result<(), BitmapStoreError> {
        // Verify hash
        let computed = keccak256(&bitmap);
        let computed_hash = H256::from(computed);
        if computed_hash != expected_hash {
            return Err(BitmapStoreError::HashMismatch {
                expected: expected_hash,
                computed: computed_hash,
            });
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let stored = StoredBitmap {
            player,
            batch_id,
            bitmap,
            hash: expected_hash,
            received_at: now,
        };

        self.bitmaps
            .write()
            .await
            .insert((batch_id, player), stored);
        Ok(())
    }

    /// Get a player's bitmap for a batch.
    pub async fn get(&self, batch_id: u64, player: Address) -> Option<StoredBitmap> {
        self.bitmaps.read().await.get(&(batch_id, player)).cloned()
    }

    /// Get all bitmaps for a batch (for tick resolution).
    pub async fn get_all_for_batch(&self, batch_id: u64) -> Vec<StoredBitmap> {
        self.bitmaps
            .read()
            .await
            .iter()
            .filter(|((bid, _), _)| *bid == batch_id)
            .map(|(_, v)| v.clone())
            .collect()
    }

    /// Remove a bitmap (after player withdraws).
    pub async fn remove(&self, batch_id: u64, player: Address) {
        self.bitmaps.write().await.remove(&(batch_id, player));
    }
}

#[derive(Debug, thiserror::Error)]
pub enum BitmapStoreError {
    #[error("Hash mismatch: expected {expected:?}, computed {computed:?}")]
    HashMismatch { expected: H256, computed: H256 },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn store_and_retrieve_bitmap() {
        let store = BitmapStore::new();
        let player = Address::random();
        let batch_id = 1u64;
        let bitmap = vec![0u8, 1, 1, 0, 1, 0, 0, 1];
        let hash = H256::from(keccak256(&bitmap));

        store
            .store(player, batch_id, bitmap.clone(), hash)
            .await
            .expect("store should succeed");

        let retrieved = store.get(batch_id, player).await.expect("should exist");
        assert_eq!(retrieved.player, player);
        assert_eq!(retrieved.batch_id, batch_id);
        assert_eq!(retrieved.bitmap, bitmap);
        assert_eq!(retrieved.hash, hash);
    }

    #[tokio::test]
    async fn reject_hash_mismatch() {
        let store = BitmapStore::new();
        let player = Address::random();
        let bitmap = vec![1u8, 0, 1];
        let wrong_hash = H256::zero();

        let result = store.store(player, 1, bitmap, wrong_hash).await;
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            BitmapStoreError::HashMismatch { .. }
        ));
    }

    #[tokio::test]
    async fn get_all_for_batch_filters_correctly() {
        let store = BitmapStore::new();
        let player_a = Address::random();
        let player_b = Address::random();
        let player_c = Address::random();

        let bitmap_a = vec![1u8, 0];
        let bitmap_b = vec![0u8, 1];
        let bitmap_c = vec![1u8, 1];

        // Two players in batch 1, one in batch 2
        store
            .store(player_a, 1, bitmap_a.clone(), H256::from(keccak256(&bitmap_a)))
            .await
            .unwrap();
        store
            .store(player_b, 1, bitmap_b.clone(), H256::from(keccak256(&bitmap_b)))
            .await
            .unwrap();
        store
            .store(player_c, 2, bitmap_c.clone(), H256::from(keccak256(&bitmap_c)))
            .await
            .unwrap();

        let batch_1 = store.get_all_for_batch(1).await;
        assert_eq!(batch_1.len(), 2);

        let batch_2 = store.get_all_for_batch(2).await;
        assert_eq!(batch_2.len(), 1);
        assert_eq!(batch_2[0].player, player_c);
    }

    #[tokio::test]
    async fn remove_bitmap() {
        let store = BitmapStore::new();
        let player = Address::random();
        let bitmap = vec![1u8, 0, 1, 0];
        let hash = H256::from(keccak256(&bitmap));

        store.store(player, 1, bitmap, hash).await.unwrap();
        assert!(store.get(1, player).await.is_some());

        store.remove(1, player).await;
        assert!(store.get(1, player).await.is_none());
    }
}
