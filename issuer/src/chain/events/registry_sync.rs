//! RegistryStateChanged Event Types (Story 8.4)
//!
//! This module provides types for parsing and validating RegistryStateChanged events
//! from the L3 IssuerRegistry contract.
//!
//! Events:
//! - `RegistryStateChanged(uint256 indexed nonce, uint256 activeCount, bytes32 stateHash)`
//!
//! This event is emitted when:
//! - A new issuer is added
//! - An issuer is removed
//! - A key rotation is executed
//!
//! Used by issuers to sync their local state with the on-chain registry
//! and serve signed proofs via GET /api/registry-sync endpoint.

use ethers::types::{H256, Log, U256, U64};
use thiserror::Error;

/// Event signature for RegistryStateChanged
/// `keccak256("RegistryStateChanged(uint256,uint256,bytes32)")`
///
/// Topics layout:
/// - topics[0]: event signature hash
/// - topics[1]: nonce (uint256, indexed)
///
/// Data layout:
/// - data[0-32]: activeCount (uint256)
/// - data[32-64]: stateHash (bytes32)
pub const REGISTRY_STATE_CHANGED_SIGNATURE: &str = "RegistryStateChanged(uint256,uint256,bytes32)";

/// Parsed RegistryStateChanged event from L3 IssuerRegistry
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistryStateChangedEvent {
    /// Monotonically increasing nonce for replay protection
    pub nonce: u64,
    /// Number of currently active issuers
    pub active_count: u64,
    /// keccak256 of all active issuer pubkeys concatenated in order
    pub state_hash: H256,
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

/// Error parsing RegistryStateChanged events from logs
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum RegistryStateChangedParseError {
    #[error("missing topic at index {index}")]
    MissingTopic { index: usize },

    #[error("failed to decode event data: {reason}")]
    DecodeError { reason: String },

    #[error("unexpected event signature")]
    UnexpectedSignature,

    #[error("missing block metadata")]
    MissingBlockMetadata,

    #[error("invalid nonce: nonce is zero")]
    ZeroNonce,
}

impl RegistryStateChangedEvent {
    /// Parse RegistryStateChanged event from a raw log
    ///
    /// Event: RegistryStateChanged(uint256 indexed nonce, uint256 activeCount, bytes32 stateHash)
    ///
    /// Topics:
    /// - [0]: event signature hash
    /// - [1]: nonce (uint256, indexed)
    ///
    /// Data:
    /// - [0-32]: activeCount (uint256)
    /// - [32-64]: stateHash (bytes32)
    pub fn from_log(log: &Log) -> Result<Self, RegistryStateChangedParseError> {
        // Verify we have enough topics (signature + 1 indexed param)
        if log.topics.len() < 2 {
            return Err(RegistryStateChangedParseError::MissingTopic {
                index: log.topics.len(),
            });
        }

        // Verify event signature
        let expected_sig = ethers::utils::keccak256(REGISTRY_STATE_CHANGED_SIGNATURE);
        if log.topics[0].as_bytes() != expected_sig {
            return Err(RegistryStateChangedParseError::UnexpectedSignature);
        }

        // Extract nonce from topic[1]
        let nonce = U256::from_big_endian(log.topics[1].as_bytes()).as_u64();

        // Decode activeCount and stateHash from data
        let data = &log.data.0;
        if data.len() < 64 {
            return Err(RegistryStateChangedParseError::DecodeError {
                reason: format!(
                    "data too short: expected 64 bytes, got {}",
                    data.len()
                ),
            });
        }

        let active_count = U256::from_big_endian(&data[0..32]).as_u64();
        let state_hash = H256::from_slice(&data[32..64]);

        // Get block metadata
        let block_number = log
            .block_number
            .ok_or(RegistryStateChangedParseError::MissingBlockMetadata)?
            .as_u64();
        let tx_hash = log
            .transaction_hash
            .ok_or(RegistryStateChangedParseError::MissingBlockMetadata)?;

        // Basic validation - nonce should be > 0 after first state change
        // Note: We allow nonce=0 for testing, but in production first event will have nonce=1
        if nonce == 0 {
            return Err(RegistryStateChangedParseError::ZeroNonce);
        }

        Ok(Self {
            nonce,
            active_count,
            state_hash,
            block_number,
            tx_hash,
        })
    }

    /// Get the computed event signature hash
    pub fn signature_hash() -> H256 {
        H256::from_slice(&ethers::utils::keccak256(REGISTRY_STATE_CHANGED_SIGNATURE))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::{Address, Bytes};

    fn create_test_log(nonce: u64, active_count: u64, state_hash: [u8; 32]) -> Log {
        // Build topics
        let mut topics = Vec::with_capacity(2);

        // topic[0]: event signature
        let sig_hash = H256::from_slice(&ethers::utils::keccak256(
            REGISTRY_STATE_CHANGED_SIGNATURE,
        ));
        topics.push(sig_hash);

        // topic[1]: nonce (U256 as 32 bytes)
        let mut nonce_bytes = [0u8; 32];
        U256::from(nonce).to_big_endian(&mut nonce_bytes);
        topics.push(H256::from_slice(&nonce_bytes));

        // Build data: activeCount (U256) + stateHash (bytes32)
        let mut data = vec![0u8; 64];
        U256::from(active_count).to_big_endian(&mut data[0..32]);
        data[32..64].copy_from_slice(&state_hash);

        Log {
            address: Address::from([0x11u8; 20]),
            topics,
            data: Bytes::from(data),
            block_hash: Some(H256::from([0x22u8; 32])),
            block_number: Some(U64::from(12345)),
            transaction_hash: Some(H256::from([0x33u8; 32])),
            transaction_index: Some(U64::from(0)),
            log_index: Some(U256::from(0)),
            transaction_log_index: None,
            log_type: None,
            removed: Some(false),
        }
    }

    #[test]
    fn test_parse_registry_state_changed_event() {
        let state_hash = [0xAAu8; 32];
        let log = create_test_log(5, 3, state_hash);

        let event = RegistryStateChangedEvent::from_log(&log).unwrap();

        assert_eq!(event.nonce, 5);
        assert_eq!(event.active_count, 3);
        assert_eq!(event.state_hash, H256::from([0xAAu8; 32]));
        assert_eq!(event.block_number, 12345);
        assert_eq!(event.tx_hash, H256::from([0x33u8; 32]));
    }

    #[test]
    fn test_parse_missing_topics() {
        let mut log = create_test_log(5, 3, [0xAA; 32]);
        log.topics.truncate(1); // Remove nonce topic

        let result = RegistryStateChangedEvent::from_log(&log);
        assert!(matches!(
            result,
            Err(RegistryStateChangedParseError::MissingTopic { index: 1 })
        ));
    }

    #[test]
    fn test_parse_wrong_signature() {
        let mut log = create_test_log(5, 3, [0xAA; 32]);
        log.topics[0] = H256::from([0xFF; 32]); // Wrong signature

        let result = RegistryStateChangedEvent::from_log(&log);
        assert!(matches!(
            result,
            Err(RegistryStateChangedParseError::UnexpectedSignature)
        ));
    }

    #[test]
    fn test_parse_missing_data() {
        let mut log = create_test_log(5, 3, [0xAA; 32]);
        log.data = Bytes::from(vec![0u8; 32]); // Too short (missing stateHash)

        let result = RegistryStateChangedEvent::from_log(&log);
        assert!(matches!(
            result,
            Err(RegistryStateChangedParseError::DecodeError { .. })
        ));
    }

    #[test]
    fn test_parse_zero_nonce() {
        let log = create_test_log(0, 3, [0xAA; 32]);

        let result = RegistryStateChangedEvent::from_log(&log);
        assert!(matches!(
            result,
            Err(RegistryStateChangedParseError::ZeroNonce)
        ));
    }

    #[test]
    fn test_parse_missing_block_metadata() {
        let mut log = create_test_log(5, 3, [0xAA; 32]);
        log.block_number = None;

        let result = RegistryStateChangedEvent::from_log(&log);
        assert!(matches!(
            result,
            Err(RegistryStateChangedParseError::MissingBlockMetadata)
        ));
    }

    #[test]
    fn test_signature_hash() {
        let hash = RegistryStateChangedEvent::signature_hash();
        let expected = H256::from_slice(&ethers::utils::keccak256(
            REGISTRY_STATE_CHANGED_SIGNATURE,
        ));
        assert_eq!(hash, expected);
    }

    #[test]
    fn test_large_nonce() {
        let log = create_test_log(u64::MAX, 20, [0xBB; 32]);
        let event = RegistryStateChangedEvent::from_log(&log).unwrap();
        assert_eq!(event.nonce, u64::MAX);
    }

    #[test]
    fn test_max_active_count() {
        let log = create_test_log(1, 20, [0xCC; 32]);
        let event = RegistryStateChangedEvent::from_log(&log).unwrap();
        assert_eq!(event.active_count, 20);
    }
}
