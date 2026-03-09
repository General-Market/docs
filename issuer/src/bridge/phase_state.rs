//! Consolidated state for a BLS consensus phase.

use std::collections::HashMap;
use std::hash::Hash;
use ethers::types::H256;
use tokio::sync::RwLock;
use super::signature_manager::SignatureCollectionManager;

/// Bundles a SignatureCollectionManager with its dedup map.
///
/// Replaces the repeated pattern of:
///   x_sigs: SignatureCollectionManager<K>,
///   confirmed_x: RwLock<HashMap<K, H256>>,
pub struct PhaseState<K: Hash + Eq> {
    pub sigs: SignatureCollectionManager<K>,
    pub confirmed: RwLock<HashMap<K, H256>>,
}

impl<K: Hash + Eq + Clone + std::fmt::Display + Send + Sync + 'static> PhaseState<K> {
    pub fn new(label: &'static str) -> Self {
        Self {
            sigs: SignatureCollectionManager::new(label),
            confirmed: RwLock::new(HashMap::new()),
        }
    }

    pub async fn is_confirmed(&self, key: &K) -> bool {
        self.confirmed.read().await.contains_key(key)
    }

    pub async fn mark_confirmed(&self, key: K, tx_hash: H256) {
        self.confirmed.write().await.insert(key, tx_hash);
    }
}
