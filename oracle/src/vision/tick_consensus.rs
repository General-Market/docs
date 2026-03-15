//! BLS consensus for Vision tick resolution.
//!
//! Leader resolves the tick, computes the result hash, proposes to followers.
//! Followers independently resolve the same tick and verify the hash matches.
//! If 2/3 agree, the aggregated BLS signature is used for on-chain settlement.

use std::collections::HashMap;
use std::sync::Arc;

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::error::Error;
use common::types::{BLSSignature, PeerId};
use ethers::abi::{encode, Token};
use ethers::core::utils::keccak256;
use ethers::types::{Address, H256, U256};
use tokio::sync::RwLock;
use tracing::{info, warn};

use super::types::TickResult;
use crate::consensus::aggregator::{compute_threshold, AggregationStatus, SignatureAggregator};

/// Compute the deterministic hash of a tick result.
/// This hash is what oracles sign via BLS.
///
/// hash = keccak256(abi.encode(
///   chain_id, vision_address, "VISION_TICK_SETTLEMENT",
///   batch_id, tick_id,
///   keccak256(abi.encode(player1, balance1, player2, balance2, ...))
/// ))
pub fn compute_tick_result_hash(
    chain_id: u64,
    vision_address: Address,
    batch_id: u64,
    tick_id: u64,
    player_balances: &[(Address, U256)],
) -> H256 {
    // Sort by address for determinism
    let mut sorted = player_balances.to_vec();
    sorted.sort_by_key(|(addr, _)| *addr);

    // Inner hash: player balances
    let balance_tokens: Vec<Token> = sorted
        .iter()
        .flat_map(|(addr, bal)| vec![Token::Address(*addr), Token::Uint(*bal)])
        .collect();
    let balances_hash = keccak256(&encode(&balance_tokens));

    // Outer hash: full tick context
    let outer = encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(vision_address),
        Token::String("VISION_TICK_SETTLEMENT".to_string()),
        Token::Uint(U256::from(batch_id)),
        Token::Uint(U256::from(tick_id)),
        Token::FixedBytes(balances_hash.to_vec()),
    ]);
    H256::from(keccak256(&outer))
}

/// Pending tick consensus round.
pub struct PendingTickRound {
    pub batch_id: u64,
    pub tick_id: u64,
    pub result_hash: H256,
    pub player_balances: Vec<(Address, U256)>,
    pub aggregator: SignatureAggregator,
    pub created_at: std::time::Instant,
}

/// Manages BLS consensus for tick resolution.
pub struct TickConsensus {
    /// Active consensus rounds: (batch_id, tick_id) -> PendingTickRound
    pub pending_rounds: RwLock<HashMap<(u64, u64), PendingTickRound>>,
    /// Chain ID for hash computation
    pub chain_id: u64,
    /// Vision contract address
    pub vision_address: Address,
    /// Number of oracles for threshold computation
    pub num_oracles: usize,
    /// BLS signer (stateless, used for sign + aggregate)
    pub signer: Arc<Bn254BLSSigner>,
    /// This oracle's BLS keypair
    pub keypair: Arc<BLSKeyPair>,
}

impl TickConsensus {
    pub fn new(
        chain_id: u64,
        vision_address: Address,
        num_oracles: usize,
        signer: Arc<Bn254BLSSigner>,
        keypair: Arc<BLSKeyPair>,
    ) -> Self {
        Self {
            pending_rounds: RwLock::new(HashMap::new()),
            chain_id,
            vision_address,
            num_oracles,
            signer,
            keypair,
        }
    }

    /// Leader: create a proposal from a TickResult.
    ///
    /// Returns (result_hash, leader_bls_signature, flattened_player_balances).
    pub async fn create_proposal(
        &self,
        result: &TickResult,
        _reference_nonce: u64,
    ) -> Result<(H256, BLSSignature, Vec<(Address, U256)>), Error> {
        let player_balances: Vec<(Address, U256)> = result
            .player_balances
            .iter()
            .map(|pb| (pb.player, pb.new_balance))
            .collect();

        let result_hash = compute_tick_result_hash(
            self.chain_id,
            self.vision_address,
            result.batch_id,
            result.tick_id,
            &player_balances,
        );

        // Sign the hash with our keypair
        let hash_bytes: [u8; 32] = result_hash.into();
        let signature = self
            .signer
            .sign_message_hash(&self.keypair, &hash_bytes)
            .map_err(|e| Error::BlsSigning(format!("tick consensus sign failed: {}", e)))?;

        // Create pending round (leader's own signature will be added via add_signature)
        let threshold = compute_threshold(self.num_oracles);
        let aggregator = SignatureAggregator::with_threshold(threshold);

        let round = PendingTickRound {
            batch_id: result.batch_id,
            tick_id: result.tick_id,
            result_hash,
            player_balances: player_balances.clone(),
            aggregator,
            created_at: std::time::Instant::now(),
        };

        self.pending_rounds
            .write()
            .await
            .insert((result.batch_id, result.tick_id), round);

        info!(
            batch_id = result.batch_id,
            tick_id = result.tick_id,
            result_hash = ?result_hash,
            num_players = player_balances.len(),
            "Created tick consensus proposal"
        );

        Ok((result_hash, signature, player_balances))
    }

    /// Follower: verify a proposed tick result against own computation.
    ///
    /// Returns true if the proposed hash matches the follower's independent result.
    pub fn verify_proposal(
        &self,
        batch_id: u64,
        tick_id: u64,
        proposed_hash: H256,
        _proposed_balances: &[(Address, U256)],
        own_result: &TickResult,
    ) -> bool {
        // Compute our own hash from our independent resolution
        let own_balances: Vec<(Address, U256)> = own_result
            .player_balances
            .iter()
            .map(|pb| (pb.player, pb.new_balance))
            .collect();

        let own_hash = compute_tick_result_hash(
            self.chain_id,
            self.vision_address,
            batch_id,
            tick_id,
            &own_balances,
        );

        if own_hash != proposed_hash {
            warn!(
                batch_id,
                tick_id,
                own_hash = ?own_hash,
                proposed_hash = ?proposed_hash,
                "Tick result hash mismatch — rejecting proposal"
            );
            return false;
        }

        true
    }

    /// Follower: sign a verified proposal and return the BLS signature.
    pub fn sign_proposal(&self, result_hash: H256) -> Result<BLSSignature, Error> {
        let hash_bytes: [u8; 32] = result_hash.into();
        self.signer
            .sign_message_hash(&self.keypair, &hash_bytes)
            .map_err(|e| Error::BlsSigning(format!("tick consensus co-sign failed: {}", e)))
    }

    /// Add a signature to a pending round.
    ///
    /// Returns None if no round exists for the given (batch_id, tick_id).
    pub async fn add_signature(
        &self,
        batch_id: u64,
        tick_id: u64,
        signer_id: PeerId,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Option<Result<AggregationStatus, Error>> {
        let mut rounds = self.pending_rounds.write().await;
        let round = rounds.get_mut(&(batch_id, tick_id))?;
        Some(round.aggregator.add_signature(signer_id, signer_index, signature))
    }

    /// Clean up old pending rounds (> 60s).
    pub async fn gc_stale_rounds(&self) {
        let mut rounds = self.pending_rounds.write().await;
        let before = rounds.len();
        rounds.retain(|_, r| r.created_at.elapsed().as_secs() < 60);
        let removed = before - rounds.len();
        if removed > 0 {
            info!(removed, remaining = rounds.len(), "GC'd stale tick consensus rounds");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_tick_result_hash_deterministic() {
        let chain_id = 111222333u64;
        let vision_address = Address::random();
        let batch_id = 1u64;
        let tick_id = 42u64;

        let balances = vec![
            (Address::random(), U256::from(1000)),
            (Address::random(), U256::from(2000)),
        ];

        let h1 = compute_tick_result_hash(chain_id, vision_address, batch_id, tick_id, &balances);
        let h2 = compute_tick_result_hash(chain_id, vision_address, batch_id, tick_id, &balances);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_compute_tick_result_hash_order_independent() {
        let chain_id = 111222333u64;
        let vision_address = Address::random();
        let batch_id = 1u64;
        let tick_id = 42u64;

        let addr1 = Address::random();
        let addr2 = Address::random();

        let balances_a = vec![(addr1, U256::from(1000)), (addr2, U256::from(2000))];
        let balances_b = vec![(addr2, U256::from(2000)), (addr1, U256::from(1000))];

        let h_a =
            compute_tick_result_hash(chain_id, vision_address, batch_id, tick_id, &balances_a);
        let h_b =
            compute_tick_result_hash(chain_id, vision_address, batch_id, tick_id, &balances_b);
        assert_eq!(h_a, h_b, "Hash must be order-independent (sorted internally)");
    }

    #[test]
    fn test_compute_tick_result_hash_different_inputs() {
        let chain_id = 111222333u64;
        let vision_address = Address::random();
        let addr = Address::random();

        let balances = vec![(addr, U256::from(1000))];

        let h1 = compute_tick_result_hash(chain_id, vision_address, 1, 1, &balances);
        let h2 = compute_tick_result_hash(chain_id, vision_address, 1, 2, &balances);
        let h3 = compute_tick_result_hash(chain_id, vision_address, 2, 1, &balances);

        assert_ne!(h1, h2, "Different tick_id must produce different hash");
        assert_ne!(h1, h3, "Different batch_id must produce different hash");
    }
}
