//! Signature aggregation for BLS consensus
//!
//! Collects BLS signatures from peers and aggregates them when threshold is reached.

use std::collections::HashMap;

use common::bls::Bn254BLSSigner;
use common::error::Error;
use common::traits::BLSSigner;
use common::types::{BLSSignature, PeerId};
use tracing::{debug, info, warn};

/// Threshold constants for consensus
pub const QUORUM_THRESHOLD: usize = 14; // 14/20 online required
pub const SIGNATURE_THRESHOLD: usize = 11; // 11/20 for batch approval
pub const DISAGREEMENT_PERCENT: u8 = 20; // 20% disagree triggers retry
pub const MAX_PRICE_RETRIES: u8 = 3;
pub const MAX_BATCH_RETRIES: u8 = 3;

/// Calculate the signature threshold for a given number of issuers.
///
/// Uses proportional scaling from the production ratio (11/20 = 55%):
/// `threshold = max(2, ceil(n * 11 / 20))`
///
/// Results:
/// - 3 nodes → 2
/// - 5 nodes → 3
/// - 10 nodes → 6
/// - 20 nodes → 11
pub fn calculate_threshold(num_issuers: usize) -> usize {
    if num_issuers == 0 {
        return 0;
    }
    let scaled = (num_issuers * 11 + 19) / 20; // ceil(n * 11 / 20)
    scaled.max(2)
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
    /// Create a new signature aggregator with default threshold (11/20)
    pub fn new() -> Self {
        Self::with_threshold(SIGNATURE_THRESHOLD)
    }

    /// Create a new signature aggregator with custom threshold
    pub fn with_threshold(required_signatures: usize) -> Self {
        Self {
            required_signatures,
            collected: HashMap::new(),
            threshold_reached: false,
            signer: Bn254BLSSigner::new(),
        }
    }

    /// Update the signature threshold at runtime (for registry auto-update)
    pub fn set_threshold(&mut self, threshold: usize) {
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
        self.threshold_reached = false;
    }

    /// Add a signature from a peer
    ///
    /// Returns the current aggregation status.
    /// Rejects duplicate signatures from the same peer.
    pub fn add_signature(
        &mut self,
        peer_id: PeerId,
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

        // Add signature
        self.collected.insert(peer_id, signature);

        debug!(
            ?peer_id,
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

            Ok(AggregationStatus::ThresholdReached {
                aggregated_signature: aggregated,
                signer_count: self.collected.len(),
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
}

impl Default for SignatureAggregator {
    fn default() -> Self {
        Self::new()
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
        let aggregator = SignatureAggregator::new();
        assert_eq!(aggregator.required_signatures(), SIGNATURE_THRESHOLD);
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
        let status = aggregator.add_signature(test_peer_id(1), sig1).unwrap();
        assert!(matches!(
            status,
            AggregationStatus::Collecting {
                count: 1,
                required: 3
            }
        ));

        // Add second signature
        let sig2 = create_signature(&keypair, message);
        let status = aggregator.add_signature(test_peer_id(2), sig2).unwrap();
        assert!(matches!(
            status,
            AggregationStatus::Collecting {
                count: 2,
                required: 3
            }
        ));

        // Add third signature - threshold reached
        let sig3 = create_signature(&keypair, message);
        let status = aggregator.add_signature(test_peer_id(3), sig3).unwrap();
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
            .add_signature(test_peer_id(1), sig1.clone())
            .unwrap();
        assert_eq!(aggregator.collected_count(), 1);

        // Try to add duplicate
        let status = aggregator.add_signature(test_peer_id(1), sig1).unwrap();
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
        aggregator.add_signature(test_peer_id(1), sig1).unwrap();
        let sig2 = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(2), sig2).unwrap();

        assert!(aggregator.is_threshold_reached());

        // Try to add more after threshold
        let sig3 = create_signature(&keypair, message);
        let status = aggregator.add_signature(test_peer_id(3), sig3).unwrap();
        assert!(matches!(status, AggregationStatus::AlreadySubmitted));
    }

    #[test]
    fn test_aggregator_reset() {
        let mut aggregator = SignatureAggregator::with_threshold(2);
        let keypair = BLSKeyPair::generate();
        let message = b"test message";

        // Add signatures and reach threshold
        let sig1 = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(1), sig1).unwrap();
        let sig2 = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(2), sig2).unwrap();

        assert!(aggregator.is_threshold_reached());
        assert_eq!(aggregator.collected_count(), 2);

        // Reset
        aggregator.reset();

        assert!(!aggregator.is_threshold_reached());
        assert_eq!(aggregator.collected_count(), 0);
    }

    #[test]
    fn test_aggregator_invalid_signature_length() {
        let mut aggregator = SignatureAggregator::new();
        let invalid_sig = BLSSignature(vec![0u8; 32]); // Wrong length

        let result = aggregator.add_signature(test_peer_id(1), invalid_sig);
        assert!(result.is_err());
    }

    #[test]
    fn test_aggregator_has_signature_from() {
        let mut aggregator = SignatureAggregator::new();
        let keypair = BLSKeyPair::generate();
        let message = b"test message";

        assert!(!aggregator.has_signature_from(&test_peer_id(1)));

        let sig = create_signature(&keypair, message);
        aggregator.add_signature(test_peer_id(1), sig).unwrap();

        assert!(aggregator.has_signature_from(&test_peer_id(1)));
        assert!(!aggregator.has_signature_from(&test_peer_id(2)));
    }

    #[test]
    fn test_threshold_constants() {
        assert_eq!(SIGNATURE_THRESHOLD, 11);
        assert_eq!(QUORUM_THRESHOLD, 14);
        assert_eq!(DISAGREEMENT_PERCENT, 20);
        assert_eq!(MAX_PRICE_RETRIES, 3);
        assert_eq!(MAX_BATCH_RETRIES, 3);
    }

    #[test]
    fn test_calculate_threshold_3_nodes() {
        assert_eq!(calculate_threshold(3), 2);
    }

    #[test]
    fn test_calculate_threshold_5_nodes() {
        assert_eq!(calculate_threshold(5), 3);
    }

    #[test]
    fn test_calculate_threshold_10_nodes() {
        assert_eq!(calculate_threshold(10), 6);
    }

    #[test]
    fn test_calculate_threshold_20_nodes() {
        assert_eq!(calculate_threshold(20), 11);
    }

    #[test]
    fn test_calculate_threshold_minimum_is_2() {
        // Even with 1 or 2 nodes, threshold should be at least 2
        assert_eq!(calculate_threshold(1), 2);
        assert_eq!(calculate_threshold(2), 2);
    }

    #[test]
    fn test_calculate_threshold_zero_nodes() {
        assert_eq!(calculate_threshold(0), 0);
    }
}
