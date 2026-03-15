//! MockIssuer implementation for testing consensus operations
//!
//! Provides mock BLS signing and consensus simulation for testing
//! without a real issuer network.

use std::sync::Arc;

use rand::Rng;
use tokio::sync::RwLock;

use crate::error::Error;
use crate::traits::BLSSigner;
use crate::types::{BLSPublicKey, BLSSignature, Fill, PeerId};

use super::MockError;

/// Batch proposal for consensus
#[derive(Debug, Clone)]
pub struct BatchProposal {
    /// Cycle number for this batch
    pub cycle_number: u64,
    /// Order IDs included in the batch
    pub order_ids: Vec<u64>,
    /// Fills for the orders
    pub fills: Vec<Fill>,
    /// Proposer's signature
    pub proposer_signature: BLSSignature,
    /// Timestamp of proposal
    pub timestamp: u64,
}

/// Result of a consensus round
#[derive(Debug, Clone)]
pub enum ConsensusResult {
    /// Consensus reached with aggregated signature
    Success {
        aggregated_signature: BLSSignature,
        signers: Vec<PeerId>,
    },
    /// Not enough signatures collected
    InsufficientSignatures { collected: usize, required: usize },
    /// Timeout waiting for signatures
    Timeout,
}

/// Internal state for MockIssuer
#[derive(Debug)]
struct MockIssuerState {
    /// This node's ID
    node_id: PeerId,
    /// BLS keypair (simplified as bytes)
    bls_private_key: Vec<u8>,
    bls_public_key: BLSPublicKey,
    /// Known peers
    peers: Vec<PeerId>,
    /// Single-node mode flag
    single_node_mode: bool,
    /// All proposed batches (for test assertions)
    proposed_batches: Vec<BatchProposal>,
    /// Current cycle
    current_cycle: u64,
}

/// Mock implementation of issuer consensus
///
/// Supports single-node mode (always leader, auto-approve) and
/// multi-node simulation for integration tests.
pub struct MockIssuer {
    state: Arc<RwLock<MockIssuerState>>,
}

impl MockIssuer {
    /// Generate a deterministic BLS keypair from a seed
    fn generate_keypair(seed: u64) -> (Vec<u8>, BLSPublicKey) {
        // Simplified mock keypair - in production would use real BLS
        let mut private_key = vec![0u8; 32];
        private_key[0..8].copy_from_slice(&seed.to_le_bytes());

        let mut public_key = vec![0u8; 48];
        public_key[0..8].copy_from_slice(&seed.to_le_bytes());
        public_key[8] = 0x01; // Mark as public key

        (private_key, BLSPublicKey(public_key))
    }

    /// Propose a batch of orders for consensus
    pub async fn propose_batch(&self, order_ids: Vec<u64>, fills: Vec<Fill>) -> Result<BatchProposal, Error> {
        let mut state = self.state.write().await;

        // Sign the proposal
        let message = Self::batch_message(state.current_cycle, &order_ids);
        let signature = self.sign_internal(&state.bls_private_key, &message);

        let proposal = BatchProposal {
            cycle_number: state.current_cycle,
            order_ids,
            fills,
            proposer_signature: signature,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };

        // Store for test assertions
        state.proposed_batches.push(proposal.clone());

        // In single-node mode, auto-approve
        if state.single_node_mode {
            state.current_cycle += 1;
        }

        Ok(proposal)
    }

    /// Sign a batch proposal
    pub async fn sign_batch(&self, proposal: &BatchProposal) -> Result<BLSSignature, Error> {
        let state = self.state.read().await;
        let message = Self::batch_message(proposal.cycle_number, &proposal.order_ids);
        Ok(self.sign_internal(&state.bls_private_key, &message))
    }

    /// Aggregate multiple signatures
    pub async fn aggregate_signatures(&self, signatures: Vec<BLSSignature>) -> Result<BLSSignature, Error> {
        if signatures.is_empty() {
            return Err(MockError::ConsensusFailure("no signatures to aggregate".to_string()).into());
        }

        // Mock aggregation - XOR all signatures together
        let mut aggregated = signatures[0].0.clone();
        for sig in &signatures[1..] {
            for (i, byte) in sig.0.iter().enumerate() {
                if i < aggregated.len() {
                    aggregated[i] ^= byte;
                }
            }
        }

        Ok(BLSSignature(aggregated))
    }

    /// Get all proposed batches (for test assertions)
    pub async fn proposed_batches(&self) -> Vec<BatchProposal> {
        self.state.read().await.proposed_batches.clone()
    }

    /// Check if this node is the leader for a cycle
    pub async fn is_leader(&self, cycle_number: u64) -> bool {
        let state = self.state.read().await;

        // In single-node mode, always leader
        if state.single_node_mode {
            return true;
        }

        // Multi-node: deterministic leader election
        let leader = self.elect_leader_internal(&state.peers, cycle_number);
        leader == state.node_id
    }

    /// Elect leader deterministically from last signature
    pub fn elect_leader(last_sig: &BLSSignature, num_issuers: usize) -> usize {
        if num_issuers == 0 {
            return 0;
        }

        // Hash the signature to get leader index
        let mut hash: u64 = 0;
        for (i, byte) in last_sig.0.iter().enumerate() {
            hash = hash.wrapping_add((*byte as u64).wrapping_mul(i as u64 + 1));
        }

        (hash as usize) % num_issuers
    }

    /// Get the node's public key
    pub async fn public_key(&self) -> BLSPublicKey {
        self.state.read().await.bls_public_key.clone()
    }

    /// Get the node's ID
    pub async fn node_id(&self) -> PeerId {
        self.state.read().await.node_id
    }

    /// Internal helper to create batch message for signing
    fn batch_message(cycle: u64, order_ids: &[u64]) -> Vec<u8> {
        let mut message = Vec::new();
        message.extend_from_slice(&cycle.to_be_bytes());
        for id in order_ids {
            message.extend_from_slice(&id.to_be_bytes());
        }
        message
    }

    /// Internal signing (mock BLS)
    fn sign_internal(&self, private_key: &[u8], message: &[u8]) -> BLSSignature {
        // Mock signing - combine private key and message hash
        let mut signature = vec![0u8; 96];

        // Simple deterministic "signature" for testing
        for (i, byte) in message.iter().enumerate() {
            let pk_byte = private_key.get(i % private_key.len()).unwrap_or(&0);
            signature[i % 96] ^= byte ^ pk_byte;
        }

        BLSSignature(signature)
    }

    /// Internal leader election
    fn elect_leader_internal(&self, peers: &[PeerId], cycle: u64) -> PeerId {
        if peers.is_empty() {
            return [0u8; 32];
        }

        let index = (cycle as usize) % peers.len();
        peers[index]
    }
}

impl BLSSigner for MockIssuer {
    fn sign(&self, private_key: &[u8], message: &[u8]) -> Result<BLSSignature, Error> {
        Ok(self.sign_internal(private_key, message))
    }

    fn aggregate_signatures(&self, signatures: Vec<BLSSignature>) -> Result<BLSSignature, Error> {
        if signatures.is_empty() {
            return Err(Error::SignatureAggregation("no signatures".to_string()));
        }

        let mut aggregated = signatures[0].0.clone();
        for sig in &signatures[1..] {
            for (i, byte) in sig.0.iter().enumerate() {
                if i < aggregated.len() {
                    aggregated[i] ^= byte;
                }
            }
        }

        Ok(BLSSignature(aggregated))
    }

    fn verify(
        &self,
        _public_key: &BLSPublicKey,
        _message: &[u8],
        _signature: &BLSSignature,
    ) -> Result<bool, Error> {
        // Mock verification - always returns true in tests
        // Real implementation would do actual BLS verification
        Ok(true)
    }
}

/// Create a network of mock issuers for integration testing
pub fn create_issuer_network(count: usize) -> Vec<MockIssuer> {
    let mut issuers = Vec::new();
    let mut peer_ids = Vec::new();

    // Generate peer IDs
    for i in 0..count {
        let mut peer_id = [0u8; 32];
        peer_id[0..8].copy_from_slice(&(i as u64).to_le_bytes());
        peer_ids.push(peer_id);
    }

    // Create issuers with knowledge of all peers
    for i in 0..count {
        let issuer = MockIssuerBuilder::new()
            .with_node_id(peer_ids[i])
            .with_peers(peer_ids.clone())
            .single_node_mode(false)
            .build();
        issuers.push(issuer);
    }

    issuers
}

/// Simulate a consensus round among issuers
pub async fn simulate_consensus_round(
    issuers: &[MockIssuer],
    proposal: &BatchProposal,
) -> ConsensusResult {
    if issuers.is_empty() {
        return ConsensusResult::InsufficientSignatures {
            collected: 0,
            required: 1,
        };
    }

    let mut signatures = Vec::new();
    let mut signers = Vec::new();

    // Collect signatures from all issuers
    for issuer in issuers {
        match issuer.sign_batch(proposal).await {
            Ok(sig) => {
                signatures.push(sig);
                signers.push(issuer.node_id().await);
            }
            Err(_) => continue,
        }
    }

    // Check if we have enough signatures (2/3 + 1)
    let required = (issuers.len() * 2 / 3) + 1;
    if signatures.len() < required {
        return ConsensusResult::InsufficientSignatures {
            collected: signatures.len(),
            required,
        };
    }

    // Aggregate signatures
    if let Some(first) = issuers.first() {
        match first.aggregate_signatures(signatures).await {
            Ok(aggregated) => ConsensusResult::Success {
                aggregated_signature: aggregated,
                signers,
            },
            Err(_) => ConsensusResult::InsufficientSignatures {
                collected: 0,
                required,
            },
        }
    } else {
        ConsensusResult::InsufficientSignatures {
            collected: 0,
            required: 1,
        }
    }
}

/// Builder for MockIssuer
pub struct MockIssuerBuilder {
    node_id: Option<PeerId>,
    bls_keypair: Option<(Vec<u8>, BLSPublicKey)>,
    peers: Vec<PeerId>,
    single_node_mode: bool,
}

impl MockIssuerBuilder {
    /// Create a new builder with defaults
    pub fn new() -> Self {
        Self {
            node_id: None,
            bls_keypair: None,
            peers: Vec::new(),
            single_node_mode: true, // Default to single-node mode
        }
    }

    /// Set the node ID
    pub fn with_node_id(mut self, node_id: PeerId) -> Self {
        self.node_id = Some(node_id);
        self
    }

    /// Set the BLS keypair
    pub fn with_bls_keypair(mut self, private_key: Vec<u8>, public_key: BLSPublicKey) -> Self {
        self.bls_keypair = Some((private_key, public_key));
        self
    }

    /// Set known peers
    pub fn with_peers(mut self, peers: Vec<PeerId>) -> Self {
        self.peers = peers;
        self
    }

    /// Enable/disable single-node mode
    pub fn single_node_mode(mut self, enabled: bool) -> Self {
        self.single_node_mode = enabled;
        self
    }

    /// Build the MockIssuer
    pub fn build(self) -> MockIssuer {
        // Generate node ID if not provided
        let node_id = self.node_id.unwrap_or_else(|| {
            let mut id = [0u8; 32];
            let mut rng = rand::thread_rng();
            rng.fill(&mut id);
            id
        });

        // Generate keypair if not provided
        let (private_key, public_key) = self.bls_keypair.unwrap_or_else(|| {
            let seed = u64::from_le_bytes(node_id[0..8].try_into().unwrap_or([0; 8]));
            MockIssuer::generate_keypair(seed)
        });

        let state = MockIssuerState {
            node_id,
            bls_private_key: private_key,
            bls_public_key: public_key,
            peers: self.peers,
            single_node_mode: self.single_node_mode,
            proposed_batches: Vec::new(),
            current_cycle: 0,
        };

        MockIssuer {
            state: Arc::new(RwLock::new(state)),
        }
    }
}

impl Default for MockIssuerBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::{H256, U256};

    fn create_test_fill(order_id: u64) -> Fill {
        Fill {
            order_id: U256::from(order_id),
            fill_price: U256::from(100u64) * U256::exp10(18),
            fill_amount: U256::from(1000u64) * U256::exp10(18),
            cycle_number: U256::from(1),
            tx_hash: H256::zero(),
        }
    }

    #[tokio::test]
    async fn test_single_node_batch_proposal_and_signing() {
        let issuer = MockIssuerBuilder::new().single_node_mode(true).build();

        // Should always be leader in single-node mode
        assert!(issuer.is_leader(0).await);
        assert!(issuer.is_leader(1).await);
        assert!(issuer.is_leader(100).await);

        // Propose a batch
        let fills = vec![create_test_fill(1), create_test_fill(2)];
        let proposal = issuer.propose_batch(vec![1, 2], fills).await.unwrap();

        assert_eq!(proposal.order_ids, vec![1, 2]);
        assert!(!proposal.proposer_signature.0.is_empty());

        // Sign the batch
        let signature = issuer.sign_batch(&proposal).await.unwrap();
        assert!(!signature.0.is_empty());
    }

    #[tokio::test]
    async fn test_proposed_batches_tracking() {
        let issuer = MockIssuerBuilder::new().single_node_mode(true).build();

        // Initially empty
        assert!(issuer.proposed_batches().await.is_empty());

        // Propose multiple batches
        let _ = issuer.propose_batch(vec![1], vec![create_test_fill(1)]).await;
        let _ = issuer.propose_batch(vec![2, 3], vec![create_test_fill(2), create_test_fill(3)]).await;

        // Should capture all proposals
        let batches = issuer.proposed_batches().await;
        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0].order_ids, vec![1]);
        assert_eq!(batches[1].order_ids, vec![2, 3]);
    }

    #[tokio::test]
    async fn test_leader_election_determinism() {
        // Same inputs should produce same leader
        let sig1 = BLSSignature(vec![1, 2, 3, 4, 5]);
        let sig2 = BLSSignature(vec![1, 2, 3, 4, 5]);

        let leader1 = MockIssuer::elect_leader(&sig1, 19);
        let leader2 = MockIssuer::elect_leader(&sig2, 19);

        assert_eq!(leader1, leader2);

        // Different signatures should (usually) produce different leaders
        let sig3 = BLSSignature(vec![5, 4, 3, 2, 1]);
        let leader3 = MockIssuer::elect_leader(&sig3, 19);

        // Not guaranteed but highly likely to be different
        let _ = leader3; // Just verify it doesn't panic
    }

    #[tokio::test]
    async fn test_multi_node_consensus_round() {
        let issuers = create_issuer_network(3);

        // Create a proposal
        let proposal = issuers[0]
            .propose_batch(vec![1, 2, 3], vec![create_test_fill(1)])
            .await
            .unwrap();

        // Run consensus
        let result = simulate_consensus_round(&issuers, &proposal).await;

        match result {
            ConsensusResult::Success { aggregated_signature, signers } => {
                assert!(!aggregated_signature.0.is_empty());
                assert_eq!(signers.len(), 3);
            }
            _ => panic!("Expected consensus success"),
        }
    }

    #[tokio::test]
    async fn test_bls_signer_trait() {
        let issuer = MockIssuerBuilder::new().build();

        let private_key = vec![1u8; 32];
        let message = b"test message";

        // Sign
        let signature = BLSSigner::sign(&issuer, &private_key, message).unwrap();
        assert!(!signature.0.is_empty());

        // Verify (mock always returns true)
        let public_key = BLSPublicKey(vec![2u8; 48]);
        let valid = BLSSigner::verify(&issuer, &public_key, message, &signature).unwrap();
        assert!(valid);

        // Aggregate
        let sig2 = BLSSigner::sign(&issuer, &private_key, b"another message").unwrap();
        let aggregated = BLSSigner::aggregate_signatures(&issuer, vec![signature, sig2]).unwrap();
        assert!(!aggregated.0.is_empty());
    }

    #[tokio::test]
    async fn test_multi_node_leader_rotation() {
        let issuers = create_issuer_network(3);

        // Different cycles should have different leaders
        let mut leaders = vec![];
        for i in 0..6 {
            for issuer in &issuers {
                if issuer.is_leader(i).await {
                    leaders.push((i, issuer.node_id().await));
                }
            }
        }

        // Each cycle should have exactly one leader
        assert!(leaders.len() >= 3); // At least 3 cycles with a leader each
    }
}
