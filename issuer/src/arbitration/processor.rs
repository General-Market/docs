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
use tokio::sync::mpsc;
use tracing::info;

use common::types::{BLSSignature, P2PMessage};

use super::consensus::build_outcome_hash;
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
    _request_rx: mpsc::UnboundedReceiver<ArbitrationRequest>,
}

impl ArbitrationProcessor {
    pub fn new(
        config: ArbitrationConfig,
        request_rx: mpsc::UnboundedReceiver<ArbitrationRequest>,
    ) -> Self {
        let price_fetcher = DataNodePriceFetcher::new(&config.data_node_url);
        Self {
            config,
            price_fetcher,
            active: HashMap::new(),
            _request_rx: request_rx,
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
        // TODO: Fetch trades, compute prices, broadcast ArbitrationPriceProposal via P2P
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
    /// Uses the settlement contract address and L3 chain ID from config.
    pub fn build_outcome_hash(&self, bet_id: U256, creator_wins: bool) -> ethers::types::H256 {
        // L3 chain ID = 111222333 (from ArbitrationSettlement.sol: block.chainid)
        let chain_id = 111222333u64;
        build_outcome_hash(
            chain_id,
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
                results.push(ArbitrationResult {
                    bet_id,
                    creator_wins: state.creator_wins.unwrap_or(false),
                    aggregated_signature: vec![], // TODO: actual BLS aggregation
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
    use ethers::types::{Address, H256};

    fn test_config() -> ArbitrationConfig {
        ArbitrationConfig {
            signature_threshold: 2,
            settlement_contract: Address::from([0xAA; 20]),
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

    #[tokio::test]
    async fn test_start_consensus_creates_active_state() {
        let (_tx, rx) = mpsc::unbounded_channel();
        let mut processor = ArbitrationProcessor::new(test_config(), rx);

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
        let (_tx, rx) = mpsc::unbounded_channel();
        let mut processor = ArbitrationProcessor::new(test_config(), rx);

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
        let (_tx, rx) = mpsc::unbounded_channel();
        let mut processor = ArbitrationProcessor::new(test_config(), rx);

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
        let (_tx, rx) = mpsc::unbounded_channel();
        let mut processor = ArbitrationProcessor::new(test_config(), rx);

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
        let (_tx, rx) = mpsc::unbounded_channel();
        let mut processor = ArbitrationProcessor::new(test_config(), rx);

        processor.start_consensus(test_request(10)).await;

        // Force to complete state with sigs
        {
            let state = processor.active.get_mut(&U256::from(10)).unwrap();
            state.phase = ArbitrationPhase::Complete;
            state.creator_wins = Some(true);
            state.resolution_sigs.insert(0, BLSSignature(vec![0xAA]));
            state.resolution_sigs.insert(2, BLSSignature(vec![0xBB]));
        }

        let results = processor.drain_completed();
        assert_eq!(results.len(), 1);
        let r = &results[0];
        assert_eq!(r.bet_id, U256::from(10));
        assert!(r.creator_wins);
        assert_eq!(r.signer_count, 2);
        // Bitmap: bit 0 and bit 2 set = 0b101 = 5
        assert_eq!(r.signer_bitmap, U256::from(5));

        // After drain, bet should no longer be active
        assert!(!processor.has_active_consensus(&U256::from(10)));
    }

    #[tokio::test]
    async fn test_drain_completed_empty_when_no_completions() {
        let (_tx, rx) = mpsc::unbounded_channel();
        let mut processor = ArbitrationProcessor::new(test_config(), rx);

        processor.start_consensus(test_request(1)).await;
        let results = processor.drain_completed();
        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_messages_for_unknown_bet_are_ignored() {
        let (_tx, rx) = mpsc::unbounded_channel();
        let mut processor = ArbitrationProcessor::new(test_config(), rx);

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
        let (_tx, rx) = mpsc::unbounded_channel();
        let processor = ArbitrationProcessor::new(test_config(), rx);

        let h1 = processor.build_outcome_hash(U256::from(42), true);
        let h2 = processor.build_outcome_hash(U256::from(42), true);
        assert_eq!(h1, h2);
        assert_ne!(h1, H256::zero());

        let h3 = processor.build_outcome_hash(U256::from(42), false);
        assert_ne!(h1, h3);
    }
}
