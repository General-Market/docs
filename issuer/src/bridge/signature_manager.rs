//! Generic signature collection manager for BLS consensus rounds.
//!
//! Replaces the 16 hand-written trios of `start_*_signature_collection`,
//! `add_*_follower_signature`, `check_*_threshold_reached` with a single
//! generic `SignatureCollectionManager<K>`.

use std::collections::HashMap;
use std::fmt::Display;
use std::hash::Hash;
use std::sync::Arc;

use ethers::types::U256;
use tokio::sync::{Notify, RwLock};
use tracing::{debug, info, warn};

use common::bls::Bn254BLSSigner;
use common::traits::BLSSigner;
use common::types::BLSSignature;

use super::types::{BridgeError, SignatureCollector, SignedConsensusResult};
use crate::consensus::ConsensusError;

/// Generic manager for collecting BLS signatures keyed by `K`.
///
/// `K` is typically `U256` (order IDs), `u64` (cycle numbers), or `H256` (ITP IDs).
/// Each instance carries a human-readable `label` used in log messages.
pub struct SignatureCollectionManager<K> {
    collectors: RwLock<HashMap<K, SignatureCollector>>,
    label: &'static str,
}

impl<K> SignatureCollectionManager<K>
where
    K: Hash + Eq + Clone + Display + Send + Sync + 'static,
{
    /// Create a new manager with a label for log messages (e.g. "bridge", "batch").
    pub fn new(label: &'static str) -> Self {
        Self {
            collectors: RwLock::new(HashMap::new()),
            label,
        }
    }

    /// Start collecting signatures for a key (leader calls this).
    ///
    /// Creates a new `SignatureCollector`, adds the leader's own signature,
    /// and inserts it into the map.
    pub async fn start_collection(
        &self,
        key: K,
        node_index: u8,
        leader_signature: BLSSignature,
    ) {
        let mut collectors = self.collectors.write().await;

        // SignatureCollector::new requires a U256 order_id for legacy reasons;
        // pass zero since the manager tracks the real key externally.
        let mut collector = SignatureCollector::new(U256::zero());

        // Add leader's own signature (leader is always at its own index)
        collector.add_signature(node_index, leader_signature);

        collectors.insert(key.clone(), collector);

        debug!(
            key = %key,
            label = self.label,
            "Started signature collection for {} proposal",
            self.label,
        );
    }

    /// Add a follower signature to an in-progress collection (leader calls this).
    ///
    /// Returns `Ok(Some(SignedConsensusResult))` when the threshold is reached,
    /// `Ok(None)` if more signatures are still needed (or duplicate was rejected),
    /// and `Err` if the collection was not found or aggregation failed.
    pub async fn add_follower_signature(
        &self,
        key: &K,
        signer_index: u8,
        signature: BLSSignature,
        min_signatures: usize,
        bls_signer: &Bn254BLSSigner,
    ) -> Result<Option<SignedConsensusResult>, BridgeError> {
        let mut collectors = self.collectors.write().await;

        let collector = collectors.get_mut(key).ok_or_else(|| {
            BridgeError::CollectionNotFound {
                label: self.label.to_string(),
                key: key.to_string(),
            }
        })?;

        // Add the signature
        if !collector.add_signature(signer_index, signature.clone()) {
            debug!(
                key = %key,
                signer_index = signer_index,
                label = self.label,
                "Duplicate {} signature rejected",
                self.label,
            );
            return Ok(None);
        }

        info!(
            key = %key,
            signer_index = signer_index,
            collected = collector.signature_count(),
            required = min_signatures,
            label = self.label,
            "Added follower signature for {}",
            self.label,
        );

        // Check if threshold reached
        if collector.has_threshold(min_signatures) {
            // Aggregate signatures
            let signatures: Vec<BLSSignature> = collector
                .signatures()
                .iter()
                .map(|(_, sig)| sig.clone())
                .collect();

            let aggregated_signature = bls_signer
                .aggregate_signatures(signatures)
                .map_err(|e| ConsensusError::BlsSigningError {
                    reason: e.to_string(),
                })?;

            info!(
                key = %key,
                signature_count = collector.signature_count(),
                signer_bitmap = %collector.signer_bitmap(),
                label = self.label,
                "{} signature threshold reached, ready for execution",
                self.label,
            );

            Ok(Some(SignedConsensusResult {
                aggregated_signature,
                signer_bitmap: collector.signer_bitmap(),
                signature_count: collector.signature_count(),
            }))
        } else {
            Ok(None)
        }
    }

    /// Check if threshold is reached without modifying the collection.
    ///
    /// Returns `Some(SignedConsensusResult)` if enough signatures exist,
    /// `None` if the key is missing, threshold is not met, or aggregation fails.
    pub async fn check_threshold(
        &self,
        key: &K,
        min_signatures: usize,
        bls_signer: &Bn254BLSSigner,
    ) -> Option<SignedConsensusResult> {
        let collectors = self.collectors.read().await;
        let collector = collectors.get(key)?;

        if collector.has_threshold(min_signatures) {
            let signatures: Vec<BLSSignature> = collector
                .signatures()
                .iter()
                .map(|(_, sig)| sig.clone())
                .collect();

            match bls_signer.aggregate_signatures(signatures) {
                Ok(aggregated_signature) => {
                    debug!(
                        key = %key,
                        signature_count = collector.signature_count(),
                        signer_bitmap = %collector.signer_bitmap(),
                        label = self.label,
                        "Threshold check: {} signatures collected",
                        self.label,
                    );

                    Some(SignedConsensusResult {
                        aggregated_signature,
                        signer_bitmap: collector.signer_bitmap(),
                        signature_count: collector.signature_count(),
                    })
                }
                Err(e) => {
                    warn!(
                        key = %key,
                        error = %e,
                        label = self.label,
                        "Failed to aggregate signatures in {} threshold check",
                        self.label,
                    );
                    None
                }
            }
        } else {
            None
        }
    }

    /// Get the current signature count for a key (for timeout diagnostics).
    pub async fn get_signature_count(&self, key: &K) -> Option<usize> {
        let collectors = self.collectors.read().await;
        collectors.get(key).map(|c| c.signature_count())
    }

    /// Get notifier for a collector (wakes on new signature arrival).
    pub async fn get_notifier(&self, key: &K) -> Option<Arc<Notify>> {
        let collectors = self.collectors.read().await;
        collectors.get(key).map(|c| c.notifier())
    }

    /// Remove a collector by key.
    pub async fn remove(&self, key: &K) {
        self.collectors.write().await.remove(key);
    }

    /// Clean up stale collectors older than `max_age_ms`.
    pub async fn cleanup_stale(&self, max_age_ms: u64) {
        let mut collectors = self.collectors.write().await;
        let stale_keys: Vec<K> = collectors
            .iter()
            .filter(|(_, c)| c.elapsed_ms() > max_age_ms)
            .map(|(k, _)| k.clone())
            .collect();

        for key in stale_keys {
            debug!(
                key = %key,
                label = self.label,
                "Removing stale {} signature collector",
                self.label,
            );
            collectors.remove(&key);
        }
    }

    /// Check if a signature collection has timed out.
    pub async fn is_timed_out(&self, key: &K, timeout_ms: u64) -> bool {
        let collectors = self.collectors.read().await;
        if let Some(collector) = collectors.get(key) {
            collector.is_timed_out(timeout_ms)
        } else {
            false
        }
    }
}
