//! Signature aggregation for BLS consensus
//!
//! Collects BLS signatures from peers and aggregates them when threshold is reached.

use std::collections::HashMap;

use common::bls::Bn254BLSSigner;
use common::error::Error;
use common::traits::BLSSigner;
use common::types::{BLSSignature, PeerId};
use ethers::types::U256;
use tracing::{debug, info, warn};

/// Threshold constants for consensus
pub const QUORUM_THRESHOLD: usize = 14; // 14/20 online required
pub const DISAGREEMENT_PERCENT: u8 = 20; // 20% disagree triggers retry
pub const MAX_PRICE_RETRIES: u8 = 3;
pub const MAX_BATCH_RETRIES: u8 = 3;

/// BFT threshold: floor(2n/3) + 1. Requires >2/3 of issuers to sign.
/// For n=20: threshold=14. For n=3: threshold=3.
pub fn compute_threshold(num_issuers: usize) -> usize {
    if num_issuers == 0 { return 1; }
    (num_issuers * 2 / 3) + 1
}

/// Status of signature aggregation
#[derive(Debug, Clone)]
pub enum AggregationStatus {
    /// Still collecting signatures
    Collecting {
        /// Number of signatures collected so far
        count: usize,
        /// Number of signatures required
        required: usize,
    },
    /// Threshold reached, signature aggregated
    ThresholdReached {
        /// The aggregated BLS signature
        aggregated_signature: BLSSignature,
        /// Number of signatures that were aggregated
        signer_count: usize,
        /// Bitmask of signer indices (bit i set = signer i participated)
        signers_bitmask: U256,
    },
    /// Batch was already submitted
    AlreadySubmitted,
}

/// Aggregates BLS signatures for batch approval
pub struct SignatureAggregator {
    /// Required number of signatures for threshold
    required_signatures: usize,
    /// Collected signatures by peer ID
    collected: HashMap<PeerId, BLSSignature>,
    /// Signer index for each peer (for bitmask computation)
    signer_indices: HashMap<PeerId, u8>,
    /// Whether threshold has been reached and submitted
    threshold_reached: bool,
    /// The BLS signer for aggregation
    signer: Bn254BLSSigner,
}

impl std::fmt::Debug for SignatureAggregator {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SignatureAggregator")
            .field("required_signatures", &self.required_signatures)
            .field("collected_count", &self.collected.len())
            .field("threshold_reached", &self.threshold_reached)
            .finish()
    }
}

impl SignatureAggregator {
    /// Create a new signature aggregator with the given threshold
    pub fn new(threshold: usize) -> Self {
        Self::with_threshold(threshold)
    }

    /// Create a new signature aggregator with custom threshold
    pub fn with_threshold(required_signatures: usize) -> Self {
        Self {
            required_signatures,
            collected: HashMap::new(),
            signer_indices: HashMap::new(),
            threshold_reached: false,
            signer: Bn254BLSSigner::new(),
        }
    }

    /// Update the signature threshold at runtime (for registry auto-update)
    pub fn set_threshold(&mut self, threshold: usize) {
        assert!(threshold >= 2, "BLS threshold must be >= 2, got {}", threshold);
        self.required_signatures = threshold;
    }

    /// Get the required number of signatures
    pub fn required_signatures(&self) -> usize {
        self.required_signatures
    }

    /// Get the current number of collected signatures
    pub fn collected_count(&self) -> usize {
        self.collected.len()
    }

    /// Check if threshold has been reached
    pub fn is_threshold_reached(&self) -> bool {
        self.threshold_reached
    }

    /// Reset the aggregator for a new round
    pub fn reset(&mut self) {
        self.collected.clear();
        self.signer_indices.clear();
        self.threshold_reached = false;
    }

    /// Add a signature from a peer
    ///
    /// Returns the current aggregation status.
    /// Rejects duplicate signatures from the same peer.
    ///
    /// # Arguments
    /// * `peer_id` - The peer's unique identifier
    /// * `signer_index` - The signer's index in the issuer registry (for bitmask computation)
    /// * `signature` - The BLS signature
    pub fn add_signature(
        &mut self,
        peer_id: PeerId,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<AggregationStatus, Error> {
        // Check if already submitted
        if self.threshold_reached {
            debug!(
                ?peer_id,
                "Signature received after threshold reached, ignoring"
            );
            return Ok(AggregationStatus::AlreadySubmitted);
        }

        // Check for duplicate
        if self.collected.contains_key(&peer_id) {
            warn!(code = "INFRA-006", ?peer_id, "Duplicate signature rejected");
            return Ok(AggregationStatus::Collecting {
                count: self.collected.len(),
                required: self.required_signatures,
            });
        }

        // Validate signature length
        if signature.0.len() != 64 {
            return Err(Error::BlsVerification(format!(
                "Invalid signature length: expected 64, got {}",
                signature.0.len()
            )));
        }

        // Add signature and signer index
        self.collected.insert(peer_id, signature);
        self.signer_indices.insert(peer_id, signer_index);

        debug!(
            ?peer_id,
            signer_index,
            collected = self.collected.len(),
            required = self.required_signatures,
            "Signature added"
        );

        // Check if threshold reached
        if self.collected.len() >= self.required_signatures {
            info!(
                collected = self.collected.len(),
                required = self.required_signatures,
                "Signature threshold reached, aggregating"
            );

            // Aggregate signatures
            let signatures: Vec<BLSSignature> = self.collected.values().cloned().collect();
            let aggregated = self.signer.aggregate_signatures(signatures)?;

            self.threshold_reached = true;

            // Compute signers bitmask
            let mut bitmask = U256::zero();
            for &idx in self.signer_indices.values() {
                bitmask |= U256::one() << idx;
            }

            Ok(AggregationStatus::ThresholdReached {
                aggregated_signature: aggregated,
                signer_count: self.collected.len(),
                signers_bitmask: bitmask,
            })
        } else {
            Ok(AggregationStatus::Collecting {
                count: self.collected.len(),
                required: self.required_signatures,
            })
        }
    }

    /// Get all collected signatures
    pub fn get_signatures(&self) -> &HashMap<PeerId, BLSSignature> {
        &self.collected
    }

    /// Check if we have a signature from a specific peer
    pub fn has_signature_from(&self, peer_id: &PeerId) -> bool {
        self.collected.contains_key(peer_id)
    }

    /// Compute the current signers bitmask from collected signer indices
    ///
    /// Bit i is set if a signer with index i has contributed a signature.
    pub fn signers_bitmask(&self) -> U256 {
        let mut bitmask = U256::zero();
        for &idx in self.signer_indices.values() {
            bitmask |= U256::one() << idx;
        }
        bitmask
    }
}

impl Default for SignatureAggregator {
    fn default() -> Self {
        // Default to BFT threshold for 20 issuers
        Self::new(compute_threshold(20))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::bls::BLSKeyPair;

    fn test_peer_id(n: u8) -> PeerId {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    fn create_signature(keypair: &BLSKeyPair, message: &[u8]) -> BLSSignature {
        let signer = Bn254BLSSigner::new();
        signer.sign_with_keypair(keypair, message).unwrap()
    }

    #[test]
    fn test_aggregator_new() {
        let aggregator = SignatureAggregator::new(compute_threshold(20));
        assert_eq!(aggregator.required_signatures(), 14); // BFT: floor(2*20/3)+1 = 14
        assert_eq!(aggregator.collected_count(), 0);
        assert!(!aggregator.is_threshold_reached());
    }

    #[test]
    fn test_aggregator_with_threshold() {
        let aggregator = SignatureAggregator::with_threshold(5);
        assert_eq!(aggregator.required_signatures(), 5);
    }

    #[test]
    fn test_aggregator_add_signatures() {
        let mut aggregator = SignatureAggregator::with_threshold(3);
        let keypair = BLSKeyPair::generate();
        let message = b"test batch message";

        // Add first signature
        let sig1 = create_signature(&keypair, message);
        let status = aggregator.add_signature(test_peer_id(1), 0, sig1).unwrap();
        assert!(matches!(
            status,
            AggregationStatus::Collecting {
                count: 1,
                required: 3
            }
        ));

        // Add second signature
        let sig2 = create_signature(&keypair, message);
        let status = aggregator.add_signature(test_peer_id(2), 1, sig2).unwrap();
        assert!(matches!(
            status,
            AggregationStatus::Collecting {
                count: 2,
                required: 3
            }
        ));

        // Add third signature - threshold reached
        let sig3 = create_signature(&keypair, message);
        let status = aggregator.add_signature(test_peer_id(3), 2, sig3).unwrap();
        assert!(matches!(
            status,
            AggregationStatus::ThresholdReached {
                signer_count: 3,
                ..
            }
        ));
        assert!(aggregator.is_threshold_reached());
    }

    #[test]
    fn test_aggregator_duplicate_rejection() {
        let mut aggregator = SignatureAggregator::with_threshold(3);
        let keypair = BLSKeyPair::generate();
        let message = b"test message";

        // Add first signature
        let sig1 = create_signature(&keypair, message);
        aggregator
            .add_signature(test_peer_id(1), 0, sig1.clone())
            .unwrap();
        assert_eq!(aggregator.collected_count(), 1);

        // Try to add duplicate
        let status = aggregator.add_signature(test_peer_id(1), 0, sig1).unwrap();
        assert!(matches!(
            status,
            AggregationStatus::Collecting {
                count: 1,
                required: 3
            }
        ));
        assert_eq!(aggregator.collected_count(), 1);
    }

    #[test]
    fn test_aggregator_already_submitted() {
        let mut aggregator = SignatureAggregator::with_threshold(2);
        let keypair = BLSKeyPair::generate();
        let message = b"test message";

        // Reach threshold
        let sig1 = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(1), 0, sig1).unwrap();
        let sig2 = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(2), 1, sig2).unwrap();

        assert!(aggregator.is_threshold_reached());

        // Try to add more after threshold
        let sig3 = create_signature(&keypair, message);
        let status = aggregator.add_signature(test_peer_id(3), 2, sig3).unwrap();
        assert!(matches!(status, AggregationStatus::AlreadySubmitted));
    }

    #[test]
    fn test_aggregator_reset() {
        let mut aggregator = SignatureAggregator::with_threshold(2);
        let keypair = BLSKeyPair::generate();
        let message = b"test message";

        // Add signatures and reach threshold
        let sig1 = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(1), 0, sig1).unwrap();
        let sig2 = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(2), 1, sig2).unwrap();

        assert!(aggregator.is_threshold_reached());
        assert_eq!(aggregator.collected_count(), 2);

        // Reset
        aggregator.reset();

        assert!(!aggregator.is_threshold_reached());
        assert_eq!(aggregator.collected_count(), 0);
    }

    #[test]
    fn test_aggregator_invalid_signature_length() {
        let mut aggregator = SignatureAggregator::new(compute_threshold(20));
        let invalid_sig = BLSSignature(vec![0u8; 32]); // Wrong length

        let result = aggregator.add_signature(test_peer_id(1), 0, invalid_sig);
        assert!(result.is_err());
    }

    #[test]
    fn test_aggregator_has_signature_from() {
        let mut aggregator = SignatureAggregator::new(compute_threshold(20));
        let keypair = BLSKeyPair::generate();
        let message = b"test message";

        assert!(!aggregator.has_signature_from(&test_peer_id(1)));

        let sig = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(1), 0, sig).unwrap();

        assert!(aggregator.has_signature_from(&test_peer_id(1)));
        assert!(!aggregator.has_signature_from(&test_peer_id(2)));
    }

    #[test]
    fn test_threshold_constants() {
        assert_eq!(QUORUM_THRESHOLD, 14);
        assert_eq!(DISAGREEMENT_PERCENT, 20);
        assert_eq!(MAX_PRICE_RETRIES, 3);
        assert_eq!(MAX_BATCH_RETRIES, 3);
    }

    #[test]
    fn test_compute_threshold_3_nodes() {
        // BFT: floor(2*3/3)+1 = 3
        assert_eq!(compute_threshold(3), 3);
    }

    #[test]
    fn test_compute_threshold_5_nodes() {
        // BFT: floor(2*5/3)+1 = floor(10/3)+1 = 3+1 = 4
        assert_eq!(compute_threshold(5), 4);
    }

    #[test]
    fn test_compute_threshold_10_nodes() {
        // BFT: floor(2*10/3)+1 = floor(20/3)+1 = 6+1 = 7
        assert_eq!(compute_threshold(10), 7);
    }

    #[test]
    fn test_compute_threshold_20_nodes() {
        // BFT: floor(2*20/3)+1 = floor(40/3)+1 = 13+1 = 14
        assert_eq!(compute_threshold(20), 14);
    }

    #[test]
    fn test_compute_threshold_small_values() {
        // 1 node: floor(2/3)+1 = 0+1 = 1
        assert_eq!(compute_threshold(1), 1);
        // 2 nodes: floor(4/3)+1 = 1+1 = 2
        assert_eq!(compute_threshold(2), 2);
    }

    #[test]
    fn test_compute_threshold_zero_nodes() {
        // 0 issuers returns 1 (guard)
        assert_eq!(compute_threshold(0), 1);
    }
}
