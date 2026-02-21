//! Arbitration processor
//!
//! Runs consensus for each arbitration request.
//! Coordinates price proposal, voting, signature collection, and chain submission.
//!
//! ## 4-Phase Consensus
//!
//! 1. **PriceProposal** — Leader fetches exit prices from data-node and broadcasts
//!    `ArbitrationPriceProposal` to all peers with a BLS-signed hash.
//!
//! 2. **PriceVote** — Followers fetch their own prices, compare within tolerance,
//!    and respond with `ArbitrationPriceVote` (accept/reject).
//!
//! 3. **ResolutionSign** — Once price consensus is reached, the leader resolves the
//!    bet using `resolution::compute_outcome`, broadcasts the outcome, and collects
//!    `ArbitrationResolutionSign` messages (BLS sigs on the outcome hash).
//!
//! 4. **Complete** — Once enough signatures are collected (>= threshold), aggregate
//!    them and submit `ArbitrationSettlement.settleBet(...)` on-chain.

use ethers::types::U256;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info, warn};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::traits::{BLSSigner, P2PTransport};
use common::types::{BLSSignature, P2PMessage};

use super::consensus::{build_outcome_hash, build_price_proposal_hash};
use super::market_data::DataNodePriceFetcher;
use super::types::{ArbitrationConfig, ArbitrationPhase, ArbitrationRequest, ArbitrationResult};

/// Per-bet consensus state
struct BetConsensusState {
    request: ArbitrationRequest,
    phase: ArbitrationPhase,
    /// Phase 2: price votes from followers (voter_index -> accept)
    price_votes: HashMap<u8, bool>,
    /// Phase 3: resolution signatures from followers (signer_index -> signature)
    resolution_sigs: HashMap<u8, BLSSignature>,
    /// Resolved outcome: true = creator wins, false = filler wins
    creator_wins: Option<bool>,
}

/// Processes arbitration requests through 4-phase consensus
pub struct ArbitrationProcessor {
    config: ArbitrationConfig,
    price_fetcher: DataNodePriceFetcher,
    active: HashMap<U256, BetConsensusState>,
    /// P2P transport for broadcasting proposals
    p2p: Arc<dyn P2PTransport>,
    /// BLS signer for signature operations
    bls_signer: Bn254BLSSigner,
    /// BLS keypair for this node
    bls_keypair: BLSKeyPair,
    /// This node's issuer index (for signer bitmap)
    issuer_index: u8,
}

impl ArbitrationProcessor {
    pub fn new(
        config: ArbitrationConfig,
        p2p: Arc<dyn P2PTransport>,
        bls_keypair: BLSKeyPair,
        issuer_index: u8,
    ) -> Self {
        let price_fetcher = DataNodePriceFetcher::new(&config.data_node_url);
        Self {
            config,
            price_fetcher,
            active: HashMap::new(),
            p2p,
            bls_signer: Bn254BLSSigner::new(),
            bls_keypair,
            issuer_index,
        }
    }

    /// Return a reference to the price fetcher (for follower price verification)
    pub fn price_fetcher(&self) -> &DataNodePriceFetcher {
        &self.price_fetcher
    }

    /// Handle an incoming P2P message for an active arbitration
    pub fn handle_message(&mut self, msg: P2PMessage) {
        match msg {
            P2PMessage::ArbitrationPriceVote {
                voter_index,
                bet_id,
                accept,
                ..
            } => {
                if let Some(state) = self.active.get_mut(&bet_id) {
                    state.price_votes.insert(voter_index, accept);
                    info!(bet_id = %bet_id, voter = voter_index, accept, "Price vote received");
                    self.check_price_vote_threshold(bet_id);
                }
            }
            P2PMessage::ArbitrationResolutionSign {
                signer_index,
                bet_id,
                signature,
                ..
            } => {
                if let Some(state) = self.active.get_mut(&bet_id) {
                    state.resolution_sigs.insert(signer_index, signature);
                    info!(bet_id = %bet_id, signer = signer_index, "Resolution signature received");
                    self.check_resolution_threshold(bet_id);
                }
            }
            _ => {}
        }
    }

    fn check_price_vote_threshold(&mut self, bet_id: U256) {
        let threshold = self.config.signature_threshold;
        if let Some(state) = self.active.get_mut(&bet_id) {
            let accept_count = state.price_votes.values().filter(|v| **v).count();
            if accept_count >= threshold {
                info!(bet_id = %bet_id, accepts = accept_count, "Price consensus reached");
                state.phase = ArbitrationPhase::ResolutionSign;
            }
        }
    }

    fn check_resolution_threshold(&mut self, bet_id: U256) {
        let threshold = self.config.signature_threshold;
        if let Some(state) = self.active.get_mut(&bet_id) {
            if state.resolution_sigs.len() >= threshold {
                info!(
                    bet_id = %bet_id,
                    sigs = state.resolution_sigs.len(),
                    "Resolution threshold reached"
                );
                state.phase = ArbitrationPhase::Complete;
                // TODO: Aggregate sigs + submit via ChainWriter
            }
        }
    }

    /// Start a new consensus round for an arbitration request (leader only)
    pub async fn start_consensus(&mut self, request: ArbitrationRequest) {
        let bet_id = request.bet_id;
        info!(bet_id = %bet_id, "Starting arbitration consensus");
        self.active.insert(
            bet_id,
            BetConsensusState {
                request,
                phase: ArbitrationPhase::PriceProposal,
                price_votes: HashMap::new(),
                resolution_sigs: HashMap::new(),
                creator_wins: None,
            },
        );

        // Fetch exit prices from data-node
        // TODO: trades list should come from the request/on-chain data; stub for now
        let trades: Vec<(u32, String)> = vec![]; // Will be populated from bet metadata
        let prices = match self.price_fetcher.fetch_trade_prices(&trades).await {
            Ok(p) => p,
            Err(e) => {
                warn!(bet_id = %bet_id, error = %e, "Failed to fetch trade prices, aborting consensus");
                self.active.remove(&bet_id);
                return;
            }
        };

        // Build price tuples for hashing and P2P message
        let price_tuples: Vec<(u32, String, i64)> = prices
            .iter()
            .map(|p| (p.trade_index, p.symbol.clone(), p.exit_price_cents))
            .collect();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Build price proposal hash and BLS-sign it
        let proposal_hash = build_price_proposal_hash(bet_id, &price_tuples, timestamp);
        let signature = match self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, proposal_hash.as_fixed_bytes())
        {
            Ok(sig) => sig,
            Err(e) => {
                error!(bet_id = %bet_id, error = %e, "Failed to BLS-sign price proposal");
                self.active.remove(&bet_id);
                return;
            }
        };

        // Broadcast ArbitrationPriceProposal via P2P
        let mut leader_id = [0u8; 32];
        leader_id[0] = self.issuer_index;
        let msg = P2PMessage::ArbitrationPriceProposal {
            leader_id,
            bet_id,
            prices: price_tuples,
            timestamp,
            leader_signature: signature,
        };

        if let Err(e) = self.p2p.broadcast(msg).await {
            error!(bet_id = %bet_id, error = %e, "Failed to broadcast price proposal");
            // Keep the bet active — followers may still be able to drive consensus
        } else {
            info!(bet_id = %bet_id, "Broadcasting ArbitrationPriceProposal");
        }
    }

    /// Check if a bet has an active consensus round
    pub fn has_active_consensus(&self, bet_id: &U256) -> bool {
        self.active.contains_key(bet_id)
    }

    /// Get the current phase for a bet, if active
    pub fn get_phase(&self, bet_id: &U256) -> Option<ArbitrationPhase> {
        self.active.get(bet_id).map(|s| s.phase)
    }

    /// Build the outcome hash for a bet (delegates to consensus module).
    ///
    /// Uses the settlement contract address and chain ID from config.
    pub fn build_outcome_hash(&self, bet_id: U256, creator_wins: bool) -> ethers::types::H256 {
        build_outcome_hash(
            self.config.chain_id,
            self.config.settlement_contract,
            bet_id,
            creator_wins,
        )
    }

    /// Drain completed results
    pub fn drain_completed(&mut self) -> Vec<ArbitrationResult> {
        let completed: Vec<U256> = self
            .active
            .iter()
            .filter(|(_, s)| s.phase == ArbitrationPhase::Complete)
            .map(|(id, _)| *id)
            .collect();

        let mut results = Vec::new();
        for bet_id in completed {
            if let Some(state) = self.active.remove(&bet_id) {
                // Build bitmap from signer indices
                let mut bitmap = U256::zero();
                for idx in state.resolution_sigs.keys() {
                    bitmap = bitmap | (U256::one() << *idx as usize);
                }

                // Aggregate BLS signatures
                let sigs: Vec<BLSSignature> =
                    state.resolution_sigs.values().cloned().collect();
                let aggregated_signature = match self.bls_signer.aggregate_signatures(sigs) {
                    Ok(agg) => agg.0,
                    Err(e) => {
                        error!(
                            bet_id = %bet_id,
                            error = %e,
                            "Failed to aggregate BLS signatures, skipping bet"
                        );
                        // Re-insert for retry on next drain cycle
                        self.active.insert(bet_id, state);
                        continue;
                    }
                };

                results.push(ArbitrationResult {
                    bet_id,
                    creator_wins: state.creator_wins.unwrap_or(false),
                    aggregated_signature,
                    signer_bitmap: bitmap,
                    signer_count: state.resolution_sigs.len(),
                });
            }
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use common::types::PeerInfo;
    use ethers::types::{Address, H256};

    /// Minimal no-op P2P transport for processor unit tests
    struct NoOpP2P;

    #[async_trait]
    impl P2PTransport for NoOpP2P {
        async fn connect_peers(&self, _peers: Vec<PeerInfo>) -> Result<(), common::error::Error> {
            Ok(())
        }
        async fn broadcast(&self, _message: P2PMessage) -> Result<(), common::error::Error> {
            Ok(())
        }
        async fn send_to(
            &self,
            _peer_id: common::types::PeerId,
            _message: P2PMessage,
        ) -> Result<(), common::error::Error> {
            Ok(())
        }
        async fn receive(
            &self,
        ) -> Result<common::MessageStream, common::error::Error> {
            Err(common::error::Error::P2PReceive(
                "not implemented".to_string(),
            ))
        }
    }

    fn test_config() -> ArbitrationConfig {
        ArbitrationConfig {
            signature_threshold: 2,
            settlement_contract: Address::from([0xAA; 20]),
            chain_id: 111222333,
            ..Default::default()
        }
    }

    fn test_request(bet_id: u64) -> ArbitrationRequest {
        ArbitrationRequest {
            bet_id: U256::from(bet_id),
            trades_root: H256::zero(),
            creator: Address::zero(),
            filler: Address::zero(),
            creator_amount: U256::zero(),
            filler_amount: U256::zero(),
            deadline: U256::zero(),
        }
    }

    fn test_processor() -> ArbitrationProcessor {
        let p2p: Arc<dyn P2PTransport> = Arc::new(NoOpP2P);
        let keypair = BLSKeyPair::generate();
        ArbitrationProcessor::new(test_config(), p2p, keypair, 0)
    }

    /// Generate real BLS signatures for drain_completed tests
    fn real_bls_sigs(message_hash: &[u8; 32]) -> (BLSSignature, BLSSignature) {
        let signer = Bn254BLSSigner::new();
        let kp1 = BLSKeyPair::from_seed(&[0u8; 32]).unwrap();
        let kp2 = BLSKeyPair::from_seed(&[2u8; 32]).unwrap();
        let sig1 = signer.sign_message_hash(&kp1, message_hash).unwrap();
        let sig2 = signer.sign_message_hash(&kp2, message_hash).unwrap();
        (sig1, sig2)
    }

    #[tokio::test]
    async fn test_start_consensus_creates_active_state() {
        let mut processor = test_processor();

        assert!(!processor.has_active_consensus(&U256::from(42)));
        processor.start_consensus(test_request(42)).await;
        assert!(processor.has_active_consensus(&U256::from(42)));
        assert_eq!(
            processor.get_phase(&U256::from(42)),
            Some(ArbitrationPhase::PriceProposal)
        );
    }

    #[tokio::test]
    async fn test_price_vote_threshold_advances_phase() {
        let mut processor = test_processor();

        processor.start_consensus(test_request(1)).await;

        // First vote: not enough yet
        processor.handle_message(P2PMessage::ArbitrationPriceVote {
            voter_id: [0x01; 32],
            voter_index: 0,
            bet_id: U256::from(1),
            accept: true,
            signature: BLSSignature(vec![0x01]),
        });
        assert_eq!(
            processor.get_phase(&U256::from(1)),
            Some(ArbitrationPhase::PriceProposal)
        );

        // Second vote: threshold reached (2/2)
        processor.handle_message(P2PMessage::ArbitrationPriceVote {
            voter_id: [0x02; 32],
            voter_index: 1,
            bet_id: U256::from(1),
            accept: true,
            signature: BLSSignature(vec![0x02]),
        });
        assert_eq!(
            processor.get_phase(&U256::from(1)),
            Some(ArbitrationPhase::ResolutionSign)
        );
    }

    #[tokio::test]
    async fn test_reject_votes_dont_advance_phase() {
        let mut processor = test_processor();

        processor.start_consensus(test_request(1)).await;

        // Two reject votes: should not advance
        processor.handle_message(P2PMessage::ArbitrationPriceVote {
            voter_id: [0x01; 32],
            voter_index: 0,
            bet_id: U256::from(1),
            accept: false,
            signature: BLSSignature(vec![0x01]),
        });
        processor.handle_message(P2PMessage::ArbitrationPriceVote {
            voter_id: [0x02; 32],
            voter_index: 1,
            bet_id: U256::from(1),
            accept: false,
            signature: BLSSignature(vec![0x02]),
        });
        assert_eq!(
            processor.get_phase(&U256::from(1)),
            Some(ArbitrationPhase::PriceProposal)
        );
    }

    #[tokio::test]
    async fn test_resolution_sigs_advance_to_complete() {
        let mut processor = test_processor();

        processor.start_consensus(test_request(7)).await;

        // Manually advance to ResolutionSign (normally done by price votes)
        processor.active.get_mut(&U256::from(7)).unwrap().phase =
            ArbitrationPhase::ResolutionSign;

        // First sig
        processor.handle_message(P2PMessage::ArbitrationResolutionSign {
            signer_id: [0x01; 32],
            signer_index: 0,
            bet_id: U256::from(7),
            outcome_hash: H256::from([0xAB; 32]),
            signature: BLSSignature(vec![0xAA]),
        });
        assert_eq!(
            processor.get_phase(&U256::from(7)),
            Some(ArbitrationPhase::ResolutionSign)
        );

        // Second sig: threshold reached
        processor.handle_message(P2PMessage::ArbitrationResolutionSign {
            signer_id: [0x02; 32],
            signer_index: 1,
            bet_id: U256::from(7),
            outcome_hash: H256::from([0xAB; 32]),
            signature: BLSSignature(vec![0xBB]),
        });
        assert_eq!(
            processor.get_phase(&U256::from(7)),
            Some(ArbitrationPhase::Complete)
        );
    }

    #[tokio::test]
    async fn test_drain_completed_returns_results() {
        let mut processor = test_processor();

        processor.start_consensus(test_request(10)).await;

        // Use real BLS signatures so aggregation succeeds
        let outcome_hash = processor.build_outcome_hash(U256::from(10), true);
        let (sig0, sig2) = real_bls_sigs(outcome_hash.as_fixed_bytes());

        // Force to complete state with real sigs
        {
            let state = processor.active.get_mut(&U256::from(10)).unwrap();
            state.phase = ArbitrationPhase::Complete;
            state.creator_wins = Some(true);
            state.resolution_sigs.insert(0, sig0);
            state.resolution_sigs.insert(2, sig2);
        }

        let results = processor.drain_completed();
        assert_eq!(results.len(), 1);
        let r = &results[0];
        assert_eq!(r.bet_id, U256::from(10));
        assert!(r.creator_wins);
        assert_eq!(r.signer_count, 2);
        // Bitmap: bit 0 and bit 2 set = 0b101 = 5
        assert_eq!(r.signer_bitmap, U256::from(5));
        // Aggregated signature should be 64 bytes (real BLS)
        assert_eq!(r.aggregated_signature.len(), 64);

        // After drain, bet should no longer be active
        assert!(!processor.has_active_consensus(&U256::from(10)));
    }

    #[tokio::test]
    async fn test_drain_completed_empty_when_no_completions() {
        let mut processor = test_processor();

        processor.start_consensus(test_request(1)).await;
        let results = processor.drain_completed();
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_messages_for_unknown_bet_are_ignored() {
        let mut processor = test_processor();

        // Send vote for a bet that doesn't exist
        processor.handle_message(P2PMessage::ArbitrationPriceVote {
            voter_id: [0x01; 32],
            voter_index: 0,
            bet_id: U256::from(999),
            accept: true,
            signature: BLSSignature(vec![0x01]),
        });

        // No crash, no active consensus for that bet
        assert!(!processor.has_active_consensus(&U256::from(999)));
    }

    #[test]
    fn test_build_outcome_hash_uses_config() {
        let processor = test_processor();

        let h1 = processor.build_outcome_hash(U256::from(42), true);
        let h2 = processor.build_outcome_hash(U256::from(42), true);
        assert_eq!(h1, h2);
        assert_ne!(h1, H256::zero());

        let h3 = processor.build_outcome_hash(U256::from(42), false);
        assert_ne!(h1, h3);
    }
}
