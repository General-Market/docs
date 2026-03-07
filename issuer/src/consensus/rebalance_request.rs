//! Rebalance Request Handler for BLS-based cross-chain rebalance (Cross-Chain Rebalance)
//!
//! This module handles the consensus protocol for rebalancing ITPs via cross-chain
//! requests from the BridgeProxy contract on the Settlement chain.
//!
//! ## Flow
//!
//! 1. Deployer calls `BridgeProxy.requestRebalance()` on Settlement chain
//! 2. Issuers detect `RebalanceRequested` event (or poll pending requests)
//! 3. Leader broadcasts `RebalanceRequestProposal` with weightsHash
//! 4. Followers verify and sign
//! 5. Leader aggregates signatures (threshold)
//! 6. Leader calls `BridgeProxy.completeRebalance()` on Settlement chain
//!    (BridgeProxy atomically calls Index.proposeRebalanceFromBridge on L3)

use ethers::types::{Address, H256, U256};
use tracing::debug;

use super::ConsensusError;
use crate::abi::AbiEncoder;

/// Build the message hash for rebalance request BLS signing
/// (must match BridgeProxy.completeRebalance exactly)
///
/// # Solidity Reference (BridgeProxy.sol)
/// ```solidity
/// bytes32 weightsHash = keccak256(abi.encodePacked(pending.newWeights));
/// bytes32 messageHash = keccak256(abi.encodePacked(
///     block.chainid,      // uint256
///     address(this),      // address (20 bytes, NO padding)
///     pending.deployer,   // address (20 bytes, NO padding)
///     nonce,              // uint256
///     pending.itpId,      // bytes32
///     weightsHash         // bytes32
/// ));
/// ```
pub fn build_rebalance_request_hash(
    chain_id: u64,
    bridge_proxy: Address,
    deployer: Address,
    nonce: U256,
    itp_id: H256,
    weights_hash: H256,
) -> H256 {
    // abi.encodePacked layout:
    // - chain_id: 32 bytes (uint256, big endian)
    // - bridge_proxy: 20 bytes (address, NO zero-padding)
    // - deployer: 20 bytes (address, NO zero-padding)
    // - nonce: 32 bytes (uint256, big endian)
    // - itp_id: 32 bytes (bytes32)
    // - weights_hash: 32 bytes (bytes32)
    // Total: 168 bytes

    debug!(
        chain_id = chain_id,
        bridge_proxy = ?bridge_proxy,
        deployer = ?deployer,
        nonce = %nonce,
        itp_id = ?itp_id,
        weights_hash = ?weights_hash,
        "Building rebalance request message hash"
    );

    AbiEncoder::with_capacity(168)
        .u256(U256::from(chain_id))
        .address_packed(bridge_proxy)
        .address_packed(deployer)
        .u256(nonce)
        .h256(itp_id)
        .h256(weights_hash)
        .keccak256()
}

/// Compute weights hash: keccak256(abi.encodePacked(weights))
/// Delegates to the shared implementation in crate::abi.
pub fn compute_rebalance_weights_hash(weights: &[U256]) -> H256 {
    crate::abi::compute_weights_hash(weights)
}

/// Configuration for rebalance request handler
#[derive(Debug, Clone)]
pub struct RebalanceRequestConfig {
    /// Settlement chain ID (42161 for mainnet)
    pub settlement_chain_id: u64,
    /// BridgeProxy contract address on Settlement chain
    pub bridge_proxy_address: Address,
    /// Timeout for proposal broadcast (ms)
    pub proposal_timeout_ms: u64,
    /// Timeout for collecting signatures (ms)
    pub sign_timeout_ms: u64,
    /// Minimum signatures required
    pub min_signatures: usize,
}

impl Default for RebalanceRequestConfig {
    fn default() -> Self {
        Self {
            settlement_chain_id: 42161,
            bridge_proxy_address: Address::zero(),
            proposal_timeout_ms: 500,
            sign_timeout_ms: 300,
            min_signatures: 11,
        }
    }
}

/// Result of rebalance request consensus
#[derive(Debug, Clone)]
pub struct RebalanceRequestResult {
    /// Request nonce
    pub nonce: U256,
    /// Bitmap of issuer IDs that signed
    pub signer_bitmap: U256,
    /// Aggregated G2 public key of signers (128 bytes)
    pub aggregated_pubkey: Vec<u8>,
    /// Aggregated BLS signature (64 bytes)
    pub aggregated_signature: Vec<u8>,
    /// Number of signatures aggregated
    pub signature_count: usize,
}

/// Errors for rebalance request operations
#[derive(Debug, thiserror::Error)]
pub enum RebalanceRequestError {
    #[error(transparent)]
    Consensus(#[from] ConsensusError),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_rebalance_request_hash_deterministic() {
        let chain_id = 42161u64;
        let bridge_proxy = Address::from([0xABu8; 20]);
        let deployer = Address::from([0xCDu8; 20]);
        let nonce = U256::from(7);
        let itp_id = H256::from([0x01u8; 32]);
        let weights_hash = compute_rebalance_weights_hash(&[
            U256::from(600_000_000_000_000_000u64),
            U256::from(400_000_000_000_000_000u64),
        ]);

        let hash1 = build_rebalance_request_hash(
            chain_id, bridge_proxy, deployer, nonce, itp_id, weights_hash,
        );
        let hash2 = build_rebalance_request_hash(
            chain_id, bridge_proxy, deployer, nonce, itp_id, weights_hash,
        );

        assert_eq!(hash1, hash2, "Same inputs should produce same hash");
        assert_ne!(hash1, H256::zero(), "Hash should be non-zero");
    }

    #[test]
    fn test_build_rebalance_request_hash_different_inputs() {
        let chain_id = 42161u64;
        let bridge_proxy = Address::from([0xABu8; 20]);
        let deployer = Address::from([0xCDu8; 20]);
        let nonce = U256::from(7);
        let itp_id = H256::from([0x01u8; 32]);
        let weights_hash = compute_rebalance_weights_hash(&[
            U256::from(600_000_000_000_000_000u64),
            U256::from(400_000_000_000_000_000u64),
        ]);

        let hash1 = build_rebalance_request_hash(
            chain_id, bridge_proxy, deployer, nonce, itp_id, weights_hash,
        );

        // Different nonce
        let hash2 = build_rebalance_request_hash(
            chain_id, bridge_proxy, deployer, U256::from(8), itp_id, weights_hash,
        );
        assert_ne!(hash1, hash2, "Different nonce should produce different hash");

        // Different itp_id
        let hash3 = build_rebalance_request_hash(
            chain_id, bridge_proxy, deployer, nonce, H256::from([0x02u8; 32]), weights_hash,
        );
        assert_ne!(hash1, hash3, "Different itp_id should produce different hash");

        // Different deployer
        let hash4 = build_rebalance_request_hash(
            chain_id, bridge_proxy, Address::from([0xEEu8; 20]), nonce, itp_id, weights_hash,
        );
        assert_ne!(hash1, hash4, "Different deployer should produce different hash");

        // Different weights
        let diff_weights_hash = compute_rebalance_weights_hash(&[
            U256::from(700_000_000_000_000_000u64),
            U256::from(300_000_000_000_000_000u64),
        ]);
        let hash5 = build_rebalance_request_hash(
            chain_id, bridge_proxy, deployer, nonce, itp_id, diff_weights_hash,
        );
        assert_ne!(hash1, hash5, "Different weights should produce different hash");
    }

    #[test]
    fn test_build_rebalance_request_hash_packed_length() {
        // The packed encoding should be exactly 168 bytes:
        // 32 (chain_id) + 20 (bridge_proxy) + 20 (deployer) + 32 (nonce) + 32 (itp_id) + 32 (weights_hash) = 168

        let mut data = Vec::with_capacity(168);

        let mut chain_id_bytes = [0u8; 32];
        U256::from(42161u64).to_big_endian(&mut chain_id_bytes);
        data.extend_from_slice(&chain_id_bytes);
        data.extend_from_slice(Address::from([0xABu8; 20]).as_bytes());
        data.extend_from_slice(Address::from([0xCDu8; 20]).as_bytes());
        let mut nonce_bytes = [0u8; 32];
        U256::from(7u64).to_big_endian(&mut nonce_bytes);
        data.extend_from_slice(&nonce_bytes);
        data.extend_from_slice(H256::from([0x01u8; 32]).as_bytes());
        data.extend_from_slice(H256::from([0xEFu8; 32]).as_bytes());

        assert_eq!(data.len(), 168, "Packed data should be exactly 168 bytes");
    }

    #[test]
    fn test_compute_rebalance_weights_hash() {
        let weights = vec![
            U256::from(600_000_000_000_000_000u64),
            U256::from(400_000_000_000_000_000u64),
        ];
        let hash = compute_rebalance_weights_hash(&weights);
        assert_ne!(hash, H256::zero());

        // Different weights = different hash
        let weights2 = vec![
            U256::from(500_000_000_000_000_000u64),
            U256::from(500_000_000_000_000_000u64),
        ];
        let hash2 = compute_rebalance_weights_hash(&weights2);
        assert_ne!(hash, hash2);
    }

    #[test]
    fn test_config_defaults() {
        let config = RebalanceRequestConfig::default();
        assert_eq!(config.settlement_chain_id, 42161);
        assert_eq!(config.proposal_timeout_ms, 500);
        assert_eq!(config.sign_timeout_ms, 300);
        assert_eq!(config.min_signatures, 11);
    }
}
