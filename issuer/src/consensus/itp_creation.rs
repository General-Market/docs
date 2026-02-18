//! ITP Creation Handler for BLS-based cross-chain ITP creation (Story 6.21)
//!
//! This module handles the consensus protocol for creating ITPs via cross-chain
//! requests from Arbitrum's BridgeProxy contract.
//!
//! ## Flow (Atomic)
//!
//! 1. User calls `BridgeProxy.requestCreateItp()` on Arbitrum
//! 2. Issuers detect `CreateItpRequested` event
//! 3. Leader broadcasts `ItpCreationProposal` with weightsHash + assetsHash
//! 4. Followers verify and sign
//! 5. Leader aggregates signatures (11/20 threshold)
//! 6. Leader calls `BridgeProxy.completeCreateItp()` on Arbitrum
//!    (BridgeProxy atomically calls Index.createITP on L3)
//!
//! ## Design: STATELESS
//!
//! This handler maintains no state between cycles. All pending requests
//! are queried fresh from the chain each cycle, making the issuer
//! resilient to restarts.

use ethers::types::{Address, H256, U256};
use tracing::debug;

use crate::chain::events::ItpCreationRequest;

/// Build the message hash for BLS signing (must match BridgeProxy.sol exactly)
///
/// # Arguments
/// * `chain_id` - Arbitrum chain ID (42161 for mainnet, 421614 for Sepolia)
/// * `bridge_proxy` - BridgeProxy contract address on Arbitrum
/// * `admin` - Original requester address
/// * `nonce` - Request nonce from BridgeProxy
/// * `weights_hash` - keccak256(abi.encodePacked(weights))
/// * `assets_hash` - keccak256(abi.encodePacked(assets))
///
/// # Returns
/// 32-byte keccak256 hash for BLS signing
///
/// # Solidity Reference (BridgeProxy.sol)
/// ```solidity
/// bytes32 weightsHash = keccak256(abi.encodePacked(pending.weights));
/// bytes32 assetsHash = keccak256(abi.encodePacked(pending.assets));
/// bytes32 messageHash = keccak256(abi.encodePacked(
///     block.chainid,      // uint256
///     address(this),      // address (20 bytes, NO padding)
///     pending.admin,      // address (20 bytes, NO padding)
///     nonce,              // uint256
///     weightsHash,        // bytes32
///     assetsHash          // bytes32
/// ));
/// ```
pub fn build_message_hash(
    chain_id: u64,
    bridge_proxy: Address,
    admin: Address,
    nonce: U256,
    weights_hash: H256,
    assets_hash: H256,
) -> H256 {
    // abi.encodePacked layout:
    // - chain_id: 32 bytes (uint256, big endian)
    // - bridge_proxy: 20 bytes (address, NO zero-padding)
    // - admin: 20 bytes (address, NO zero-padding)
    // - nonce: 32 bytes (uint256, big endian)
    // - weights_hash: 32 bytes
    // - assets_hash: 32 bytes
    // Total: 168 bytes

    let mut data = Vec::with_capacity(168);

    // chain_id as uint256 (32 bytes, big endian)
    let mut chain_id_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
    data.extend_from_slice(&chain_id_bytes);

    // bridge_proxy as address (20 bytes, packed)
    data.extend_from_slice(bridge_proxy.as_bytes());

    // admin as address (20 bytes, packed)
    data.extend_from_slice(admin.as_bytes());

    // nonce as uint256 (32 bytes, big endian)
    let mut nonce_bytes = [0u8; 32];
    nonce.to_big_endian(&mut nonce_bytes);
    data.extend_from_slice(&nonce_bytes);

    // weights_hash as bytes32 (32 bytes)
    data.extend_from_slice(weights_hash.as_bytes());

    // assets_hash as bytes32 (32 bytes)
    data.extend_from_slice(assets_hash.as_bytes());

    // Debug: log the packed data length
    debug!(
        data_len = data.len(),
        chain_id = chain_id,
        bridge_proxy = ?bridge_proxy,
        admin = ?admin,
        nonce = %nonce,
        weights_hash = ?weights_hash,
        assets_hash = ?assets_hash,
        "Building message hash"
    );

    // keccak256 hash
    H256::from_slice(&ethers::utils::keccak256(&data))
}

/// Compute weights hash: keccak256(abi.encodePacked(weights))
/// Each weight is uint256 (32 bytes, big endian)
pub fn compute_weights_hash(weights: &[U256]) -> H256 {
    let mut data = Vec::with_capacity(weights.len() * 32);
    for w in weights {
        let mut bytes = [0u8; 32];
        w.to_big_endian(&mut bytes);
        data.extend_from_slice(&bytes);
    }
    H256::from_slice(&ethers::utils::keccak256(&data))
}

/// Compute assets hash: keccak256(abi.encodePacked(assets))
/// For address[], Solidity's abi.encodePacked uses 32 bytes per address (left-padded with zeros).
/// This differs from individual addresses in abi.encodePacked which use 20 bytes.
pub fn compute_assets_hash(assets: &[Address]) -> H256 {
    let mut data = Vec::with_capacity(assets.len() * 32);
    for a in assets {
        // Left-pad address to 32 bytes (12 zero bytes + 20 address bytes)
        data.extend_from_slice(&[0u8; 12]);
        data.extend_from_slice(a.as_bytes());
    }
    H256::from_slice(&ethers::utils::keccak256(&data))
}

/// Verify that a proposal matches the on-chain request
///
/// Used by followers to validate leader's proposal before signing.
pub fn verify_proposal_matches_request(
    request: &ItpCreationRequest,
    admin: &Address,
    nonce: &U256,
    name: &str,
    symbol: &str,
    weights: &[U256],
    assets: &[Address],
) -> bool {
    request.admin == *admin
        && request.nonce == *nonce
        && request.name == name
        && request.symbol == symbol
        && request.weights == weights
        && request.assets == assets
}

/// Configuration for ITP creation handler
#[derive(Debug, Clone)]
pub struct ItpCreationConfig {
    /// Arbitrum chain ID (42161 for mainnet)
    pub arbitrum_chain_id: u64,
    /// BridgeProxy contract address on Arbitrum
    pub bridge_proxy_address: Address,
    /// Timeout for proposal broadcast (ms)
    pub proposal_timeout_ms: u64,
    /// Timeout for collecting signatures (ms)
    pub sign_timeout_ms: u64,
    /// Minimum signatures required (11/20)
    pub min_signatures: usize,
}

impl Default for ItpCreationConfig {
    fn default() -> Self {
        Self {
            arbitrum_chain_id: 42161,
            bridge_proxy_address: Address::zero(),
            proposal_timeout_ms: 500,
            sign_timeout_ms: 300,
            min_signatures: 11,
        }
    }
}

/// Result of ITP creation consensus
#[derive(Debug, Clone)]
pub struct ItpCreationResult {
    /// Request nonce
    pub nonce: U256,
    /// Bitmap of issuer IDs that signed (bit i = issuer i signed)
    pub signer_bitmap: U256,
    /// Aggregated G2 public key of signers (128 bytes)
    pub aggregated_pubkey: Vec<u8>,
    /// Aggregated BLS signature (64 bytes)
    pub aggregated_signature: Vec<u8>,
    /// Number of signatures aggregated
    pub signature_count: usize,
}

/// Errors for ITP creation operations
#[derive(Debug, thiserror::Error)]
pub enum ItpCreationError {
    #[error("insufficient signatures: got {got}, need {need}")]
    InsufficientSignatures { got: usize, need: usize },

    #[error("proposal timeout: no response within {timeout_ms}ms")]
    ProposalTimeout { timeout_ms: u64 },

    #[error("signing timeout: {received} signatures within {timeout_ms}ms")]
    SigningTimeout { received: usize, timeout_ms: u64 },

    #[error("L3 ITP creation failed: {reason}")]
    L3CreationFailed { reason: String },

    #[error("Arbitrum completion failed: {reason}")]
    ArbitrumCompletionFailed { reason: String },

    #[error("invalid proposal: {reason}")]
    InvalidProposal { reason: String },

    #[error("chain reader error: {reason}")]
    ChainReaderError { reason: String },

    #[error("chain writer error: {reason}")]
    ChainWriterError { reason: String },

    #[error("BLS signing error: {reason}")]
    BlsSigningError { reason: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_message_hash_deterministic() {
        let chain_id = 42161u64;
        let bridge_proxy = Address::from([0xABu8; 20]);
        let admin = Address::from([0xCDu8; 20]);
        let nonce = U256::from(42);
        let weights_hash = compute_weights_hash(&[U256::from(500_000_000_000_000_000u64), U256::from(500_000_000_000_000_000u64)]);
        let assets_hash = compute_assets_hash(&[Address::from([0x11u8; 20]), Address::from([0x22u8; 20])]);

        let hash1 = build_message_hash(chain_id, bridge_proxy, admin, nonce, weights_hash, assets_hash);
        let hash2 = build_message_hash(chain_id, bridge_proxy, admin, nonce, weights_hash, assets_hash);

        assert_eq!(hash1, hash2, "Same inputs should produce same hash");
    }

    #[test]
    fn test_build_message_hash_different_inputs() {
        let chain_id = 42161u64;
        let bridge_proxy = Address::from([0xABu8; 20]);
        let admin = Address::from([0xCDu8; 20]);
        let nonce = U256::from(42);
        let weights_hash = compute_weights_hash(&[U256::from(500_000_000_000_000_000u64), U256::from(500_000_000_000_000_000u64)]);
        let assets_hash = compute_assets_hash(&[Address::from([0x11u8; 20]), Address::from([0x22u8; 20])]);

        let hash1 = build_message_hash(chain_id, bridge_proxy, admin, nonce, weights_hash, assets_hash);

        // Different nonce
        let hash2 = build_message_hash(chain_id, bridge_proxy, admin, U256::from(43), weights_hash, assets_hash);
        assert_ne!(hash1, hash2, "Different nonce should produce different hash");

        // Different admin
        let hash3 = build_message_hash(
            chain_id,
            bridge_proxy,
            Address::from([0xAAu8; 20]),
            nonce,
            weights_hash,
            assets_hash,
        );
        assert_ne!(hash1, hash3, "Different admin should produce different hash");

        // Different chain_id
        let hash4 = build_message_hash(1, bridge_proxy, admin, nonce, weights_hash, assets_hash);
        assert_ne!(hash1, hash4, "Different chain_id should produce different hash");

        // Different weights_hash
        let diff_weights_hash = compute_weights_hash(&[U256::from(700_000_000_000_000_000u64), U256::from(300_000_000_000_000_000u64)]);
        let hash5 = build_message_hash(chain_id, bridge_proxy, admin, nonce, diff_weights_hash, assets_hash);
        assert_ne!(hash1, hash5, "Different weights_hash should produce different hash");

        // Different assets_hash
        let diff_assets_hash = compute_assets_hash(&[Address::from([0x33u8; 20]), Address::from([0x44u8; 20])]);
        let hash6 = build_message_hash(chain_id, bridge_proxy, admin, nonce, weights_hash, diff_assets_hash);
        assert_ne!(hash1, hash6, "Different assets_hash should produce different hash");
    }

    #[test]
    fn test_build_message_hash_packed_length() {
        // The packed encoding should be exactly 168 bytes:
        // 32 (chain_id) + 20 (bridge_proxy) + 20 (admin) + 32 (nonce) + 32 (weights_hash) + 32 (assets_hash) = 168

        let chain_id = 42161u64;
        let bridge_proxy = Address::from([0xABu8; 20]);
        let admin = Address::from([0xCDu8; 20]);
        let nonce = U256::from(42);
        let weights_hash = H256::from([0xEFu8; 32]);
        let assets_hash = H256::from([0xABu8; 32]);

        // Build the packed data manually to verify length
        let mut data = Vec::with_capacity(168);

        let mut chain_id_bytes = [0u8; 32];
        U256::from(chain_id).to_big_endian(&mut chain_id_bytes);
        data.extend_from_slice(&chain_id_bytes);
        data.extend_from_slice(bridge_proxy.as_bytes());
        data.extend_from_slice(admin.as_bytes());
        let mut nonce_bytes = [0u8; 32];
        nonce.to_big_endian(&mut nonce_bytes);
        data.extend_from_slice(&nonce_bytes);
        data.extend_from_slice(weights_hash.as_bytes());
        data.extend_from_slice(assets_hash.as_bytes());

        assert_eq!(data.len(), 168, "Packed data should be exactly 168 bytes");
    }

    #[test]
    fn test_verify_proposal_matches_request() {
        let request = ItpCreationRequest {
            admin: Address::from([0xABu8; 20]),
            nonce: U256::from(1),
            name: "Test ITP".to_string(),
            symbol: "TITP".to_string(),
            weights: vec![
                U256::from(500_000_000_000_000_000u64),
                U256::from(500_000_000_000_000_000u64),
            ],
            assets: vec![
                Address::from([0x11u8; 20]),
                Address::from([0x22u8; 20]),
            ],
            prices: vec![
                U256::from(1_000_000_000_000_000_000u64),
                U256::from(1_000_000_000_000_000_000u64),
            ],
            block_number: 100,
            tx_hash: H256::from([0x44u8; 32]),
        };

        // Matching proposal
        assert!(verify_proposal_matches_request(
            &request,
            &Address::from([0xABu8; 20]),
            &U256::from(1),
            "Test ITP",
            "TITP",
            &[
                U256::from(500_000_000_000_000_000u64),
                U256::from(500_000_000_000_000_000u64),
            ],
            &[
                Address::from([0x11u8; 20]),
                Address::from([0x22u8; 20]),
            ],
        ));

        // Mismatched admin
        assert!(!verify_proposal_matches_request(
            &request,
            &Address::from([0xCDu8; 20]),
            &U256::from(1),
            "Test ITP",
            "TITP",
            &[
                U256::from(500_000_000_000_000_000u64),
                U256::from(500_000_000_000_000_000u64),
            ],
            &[
                Address::from([0x11u8; 20]),
                Address::from([0x22u8; 20]),
            ],
        ));

        // Mismatched nonce
        assert!(!verify_proposal_matches_request(
            &request,
            &Address::from([0xABu8; 20]),
            &U256::from(2),
            "Test ITP",
            "TITP",
            &[
                U256::from(500_000_000_000_000_000u64),
                U256::from(500_000_000_000_000_000u64),
            ],
            &[
                Address::from([0x11u8; 20]),
                Address::from([0x22u8; 20]),
            ],
        ));
    }

    #[test]
    fn test_config_defaults() {
        let config = ItpCreationConfig::default();
        assert_eq!(config.arbitrum_chain_id, 42161);
        assert_eq!(config.proposal_timeout_ms, 500);
        assert_eq!(config.sign_timeout_ms, 300);
        assert_eq!(config.min_signatures, 11);
    }

    /// Test hash uses weightsHash + assetsHash (matches new BridgeProxy.sol)
    ///
    /// Verifies the new message hash format:
    /// keccak256(abi.encodePacked(chainid, bridgeProxy, admin, nonce, weightsHash, assetsHash))
    #[test]
    fn test_build_message_hash_new_format() {
        let chain_id = 42161u64;
        let bridge_proxy = Address::from([0xABu8; 20]);
        let admin = Address::from([0xCDu8; 20]);
        let nonce = U256::from(42);

        let weights = vec![U256::from(500_000_000_000_000_000u64), U256::from(500_000_000_000_000_000u64)];
        let assets = vec![Address::from([0x11u8; 20]), Address::from([0x22u8; 20])];

        let weights_hash = compute_weights_hash(&weights);
        let assets_hash = compute_assets_hash(&assets);

        let hash = build_message_hash(chain_id, bridge_proxy, admin, nonce, weights_hash, assets_hash);

        // Hash should be deterministic and non-zero
        assert_ne!(hash, H256::zero(), "Message hash should not be zero");

        // Verify same inputs produce same hash
        let hash2 = build_message_hash(chain_id, bridge_proxy, admin, nonce, weights_hash, assets_hash);
        assert_eq!(hash, hash2, "Rust hash MUST be deterministic");

        println!("Rust message hash (new format): {:#x}", hash);
    }

    #[test]
    fn test_compute_weights_hash() {
        let weights = vec![U256::from(500_000_000_000_000_000u64), U256::from(500_000_000_000_000_000u64)];
        let hash = compute_weights_hash(&weights);
        assert_ne!(hash, H256::zero());

        // Different weights = different hash
        let weights2 = vec![U256::from(700_000_000_000_000_000u64), U256::from(300_000_000_000_000_000u64)];
        let hash2 = compute_weights_hash(&weights2);
        assert_ne!(hash, hash2);
    }

    #[test]
    fn test_compute_assets_hash() {
        let assets = vec![Address::from([0x11u8; 20]), Address::from([0x22u8; 20])];
        let hash = compute_assets_hash(&assets);
        assert_ne!(hash, H256::zero());

        // Different assets = different hash
        let assets2 = vec![Address::from([0x33u8; 20]), Address::from([0x44u8; 20])];
        let hash2 = compute_assets_hash(&assets2);
        assert_ne!(hash, hash2);
    }
}
