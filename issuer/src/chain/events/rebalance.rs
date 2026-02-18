//! RebalanceRequested Event Types (Story 7-14, Task 4.1)
//!
//! This module provides types for parsing RebalanceRequested events
//! from the Index contract on L3.
//!
//! Events:
//! - `RebalanceRequested` - ITP creator requests a rebalance with asset changes and new weights

use ethers::types::{H256, Log, U256, U64};
use thiserror::Error;

/// Event signature for RebalanceRequested
/// `keccak256("RebalanceRequested(address,bytes32,uint256[],address[],uint256[],string)")`
///
/// Topics layout:
/// - topics[0]: event signature hash
/// - topics[1]: requester (address, indexed)
/// - topics[2]: itpId (bytes32, indexed)
///
/// Data layout:
/// - ABI-encoded: removeIndices (uint256[]), addAssets (address[]), newWeights (uint256[]), note (string)
pub const REBALANCE_REQUESTED_SIGNATURE: &str =
    "RebalanceRequested(address,bytes32,uint256[],address[],uint256[],string)";

/// Parsed RebalanceRequested event from Index.sol on L3
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebalanceRequestedEvent {
    /// Address that requested the rebalance (indexed)
    pub requester: ethers::types::Address,
    /// ITP identifier (bytes32, indexed)
    pub itp_id: H256,
    /// Indices of assets to remove from the ITP
    pub remove_indices: Vec<U256>,
    /// Addresses of new assets to add to the ITP
    pub add_assets: Vec<ethers::types::Address>,
    /// New target weights (18 decimals each)
    pub new_weights: Vec<U256>,
    /// Human-readable note describing the rebalance reason
    pub note: String,
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

/// Error parsing RebalanceRequested events from logs
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum RebalanceParseError {
    #[error("missing topic at index {index}")]
    MissingTopic { index: usize },

    #[error("failed to decode event data: {reason}")]
    DecodeError { reason: String },

    #[error("missing block metadata")]
    MissingBlockMetadata,

    #[error("empty weights array")]
    EmptyWeights,
}

impl RebalanceRequestedEvent {
    /// Parse RebalanceRequested event from a raw log
    ///
    /// Event: RebalanceRequested(address indexed requester, bytes32 indexed itpId,
    ///        uint256[] removeIndices, address[] addAssets, uint256[] newWeights, string note)
    ///
    /// Topics:
    /// - [0]: event signature hash
    /// - [1]: requester (address, indexed — left-padded to 32 bytes)
    /// - [2]: itpId (bytes32, indexed)
    ///
    /// Data (ABI-encoded dynamic fields):
    /// - offset to removeIndices
    /// - offset to addAssets
    /// - offset to newWeights
    /// - offset to note
    /// - removeIndices array (length + elements)
    /// - addAssets array (length + elements)
    /// - newWeights array (length + elements)
    /// - note string (length + UTF-8 bytes, padded to 32)
    pub fn from_log(log: &Log) -> Result<Self, RebalanceParseError> {
        // Verify we have enough topics (signature + 2 indexed params)
        if log.topics.len() < 3 {
            return Err(RebalanceParseError::MissingTopic {
                index: log.topics.len(),
            });
        }

        // Extract requester from topic[1] (last 20 bytes of H256)
        let requester_bytes = log.topics[1].as_bytes();
        let requester = ethers::types::Address::from_slice(&requester_bytes[12..32]);

        // Extract itpId from topic[2]
        let itp_id = log.topics[2];

        // Decode dynamic fields from data
        let data = &log.data.0;

        // We need at least 4 offsets (4 * 32 = 128 bytes)
        if data.len() < 128 {
            return Err(RebalanceParseError::DecodeError {
                reason: format!("data too short: expected at least 128, got {}", data.len()),
            });
        }

        // Read offsets to each dynamic field
        let remove_indices_offset = U256::from_big_endian(&data[0..32]).as_usize();
        let add_assets_offset = U256::from_big_endian(&data[32..64]).as_usize();
        let new_weights_offset = U256::from_big_endian(&data[64..96]).as_usize();
        let note_offset = U256::from_big_endian(&data[96..128]).as_usize();

        // Parse removeIndices (uint256[])
        let remove_indices = Self::parse_u256_array(data, remove_indices_offset)?;

        // Parse addAssets (address[]) — stored as uint256[] in ABI, take last 20 bytes
        let add_assets = Self::parse_address_array(data, add_assets_offset)?;

        // Parse newWeights (uint256[])
        let new_weights = Self::parse_u256_array(data, new_weights_offset)?;

        // Parse note (string)
        let note = Self::parse_string(data, note_offset)?;

        if new_weights.is_empty() {
            return Err(RebalanceParseError::EmptyWeights);
        }

        // Get block metadata
        let block_number = log
            .block_number
            .ok_or(RebalanceParseError::MissingBlockMetadata)?
            .as_u64();
        let tx_hash = log
            .transaction_hash
            .ok_or(RebalanceParseError::MissingBlockMetadata)?;

        Ok(Self {
            requester,
            itp_id,
            remove_indices,
            add_assets,
            new_weights,
            note,
            block_number,
            tx_hash,
        })
    }

    /// Parse a dynamic uint256[] from ABI-encoded data at the given offset
    fn parse_u256_array(data: &[u8], offset: usize) -> Result<Vec<U256>, RebalanceParseError> {
        if offset + 32 > data.len() {
            return Err(RebalanceParseError::DecodeError {
                reason: format!("array offset {} exceeds data length {}", offset, data.len()),
            });
        }

        let length = U256::from_big_endian(&data[offset..offset + 32]).as_usize();
        let elements_start = offset + 32;

        if elements_start + length * 32 > data.len() {
            return Err(RebalanceParseError::DecodeError {
                reason: format!(
                    "array data exceeds buffer: need {} bytes at offset {}, have {}",
                    length * 32,
                    elements_start,
                    data.len()
                ),
            });
        }

        let mut result = Vec::with_capacity(length);
        for i in 0..length {
            let start = elements_start + i * 32;
            result.push(U256::from_big_endian(&data[start..start + 32]));
        }
        Ok(result)
    }

    /// Parse a dynamic address[] from ABI-encoded data at the given offset.
    /// In ABI encoding, addresses are stored as 32-byte words (left-padded with zeros).
    /// We extract the last 20 bytes of each word to get the address.
    fn parse_address_array(
        data: &[u8],
        offset: usize,
    ) -> Result<Vec<ethers::types::Address>, RebalanceParseError> {
        let u256_values = Self::parse_u256_array(data, offset)?;
        let mut addresses = Vec::with_capacity(u256_values.len());
        for val in &u256_values {
            let mut buf = [0u8; 32];
            val.to_big_endian(&mut buf);
            // Address is the last 20 bytes of the 32-byte word
            addresses.push(ethers::types::Address::from_slice(&buf[12..32]));
        }
        Ok(addresses)
    }

    /// Parse a dynamic string from ABI-encoded data at the given offset.
    /// ABI encoding: [length (32 bytes)][UTF-8 bytes padded to 32-byte boundary]
    fn parse_string(data: &[u8], offset: usize) -> Result<String, RebalanceParseError> {
        if offset + 32 > data.len() {
            return Err(RebalanceParseError::DecodeError {
                reason: format!(
                    "string offset {} exceeds data length {}",
                    offset,
                    data.len()
                ),
            });
        }

        let byte_length = U256::from_big_endian(&data[offset..offset + 32]).as_usize();
        let bytes_start = offset + 32;

        if bytes_start + byte_length > data.len() {
            return Err(RebalanceParseError::DecodeError {
                reason: format!(
                    "string data exceeds buffer: need {} bytes at offset {}, have {}",
                    byte_length, bytes_start, data.len()
                ),
            });
        }

        let raw_bytes = &data[bytes_start..bytes_start + byte_length];
        String::from_utf8(raw_bytes.to_vec()).map_err(|e| RebalanceParseError::DecodeError {
            reason: format!("invalid UTF-8 in string: {}", e),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::Bytes;

    /// Helper: encode a RebalanceRequested event log with the new format.
    ///
    /// Topics: [signature, requester (left-padded), itpId]
    /// Data: ABI-encoded (removeIndices, addAssets, newWeights, note)
    fn create_test_log(
        requester: [u8; 20],
        itp_id: [u8; 32],
        remove_indices: &[U256],
        add_assets: &[ethers::types::Address],
        new_weights: &[U256],
        note: &str,
    ) -> Log {
        let mut topics = Vec::with_capacity(3);

        // topic[0]: event signature
        let sig_hash = H256::from_slice(&ethers::utils::keccak256(
            REBALANCE_REQUESTED_SIGNATURE,
        ));
        topics.push(sig_hash);

        // topic[1]: requester (address left-padded to 32 bytes)
        let mut requester_padded = [0u8; 32];
        requester_padded[12..32].copy_from_slice(&requester);
        topics.push(H256::from_slice(&requester_padded));

        // topic[2]: itpId
        topics.push(H256::from_slice(&itp_id));

        // Build ABI-encoded data for 4 dynamic fields
        // Layout:
        //   [0..32)   offset to removeIndices
        //   [32..64)  offset to addAssets
        //   [64..96)  offset to newWeights
        //   [96..128) offset to note
        //   then: removeIndices array, addAssets array, newWeights array, note string

        let mut buf = [0u8; 32];

        // Pre-compute array byte sizes
        let remove_indices_size = 32 + remove_indices.len() * 32; // length + elements
        let add_assets_size = 32 + add_assets.len() * 32;
        let new_weights_size = 32 + new_weights.len() * 32;
        // note: length word + padded bytes
        let note_bytes = note.as_bytes();
        let note_padded_len = ((note_bytes.len() + 31) / 32) * 32;
        let _note_size = 32 + note_padded_len;

        // Offsets (relative to start of data)
        let offset_remove_indices = 128u64; // 4 offsets * 32
        let offset_add_assets = offset_remove_indices + remove_indices_size as u64;
        let offset_new_weights = offset_add_assets + add_assets_size as u64;
        let offset_note = offset_new_weights + new_weights_size as u64;

        let mut data = Vec::new();

        // Write 4 offsets
        U256::from(offset_remove_indices).to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
        U256::from(offset_add_assets).to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
        U256::from(offset_new_weights).to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
        U256::from(offset_note).to_big_endian(&mut buf);
        data.extend_from_slice(&buf);

        // removeIndices array: length + elements
        U256::from(remove_indices.len()).to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
        for val in remove_indices {
            val.to_big_endian(&mut buf);
            data.extend_from_slice(&buf);
        }

        // addAssets array: length + elements (addresses left-padded to 32 bytes)
        U256::from(add_assets.len()).to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
        for addr in add_assets {
            buf = [0u8; 32];
            buf[12..32].copy_from_slice(addr.as_bytes());
            data.extend_from_slice(&buf);
        }

        // newWeights array: length + elements
        U256::from(new_weights.len()).to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
        for val in new_weights {
            val.to_big_endian(&mut buf);
            data.extend_from_slice(&buf);
        }

        // note string: length + padded UTF-8 bytes
        U256::from(note_bytes.len()).to_big_endian(&mut buf);
        data.extend_from_slice(&buf);
        data.extend_from_slice(note_bytes);
        // Pad to 32-byte boundary
        let padding = note_padded_len - note_bytes.len();
        data.extend(std::iter::repeat(0u8).take(padding));

        Log {
            address: ethers::types::Address::from([0x11u8; 20]),
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
    fn test_parse_rebalance_requested_event() {
        let requester = [0xDDu8; 20];
        let new_weights = vec![
            U256::from(700_000_000_000_000_000u128), // 70%
            U256::from(300_000_000_000_000_000u128), // 30%
        ];
        let remove_indices = vec![U256::from(0)];
        let add_assets = vec![ethers::types::Address::from([0xEEu8; 20])];

        let log = create_test_log(
            requester,
            [0xAAu8; 32],
            &remove_indices,
            &add_assets,
            &new_weights,
            "rebalance to 70/30",
        );
        let event = RebalanceRequestedEvent::from_log(&log).unwrap();

        assert_eq!(event.requester, ethers::types::Address::from(requester));
        assert_eq!(event.itp_id, H256::from([0xAAu8; 32]));
        assert_eq!(event.remove_indices, remove_indices);
        assert_eq!(event.add_assets, add_assets);
        assert_eq!(event.new_weights, new_weights);
        assert_eq!(event.note, "rebalance to 70/30");
        assert_eq!(event.block_number, 12345);
        assert_eq!(event.tx_hash, H256::from([0x33u8; 32]));
    }

    #[test]
    fn test_parse_missing_topics() {
        let new_weights = vec![U256::from(1_000_000_000_000_000_000u128)];
        let mut log = create_test_log(
            [0xDDu8; 20],
            [0xAA; 32],
            &[],
            &[],
            &new_weights,
            "test",
        );
        log.topics.truncate(2); // Remove itpId topic, only sig + requester remain

        let result = RebalanceRequestedEvent::from_log(&log);
        assert!(matches!(
            result,
            Err(RebalanceParseError::MissingTopic { index: 2 })
        ));
    }

    #[test]
    fn test_parse_missing_block_metadata() {
        let new_weights = vec![U256::from(1_000_000_000_000_000_000u128)];
        let mut log = create_test_log(
            [0xDDu8; 20],
            [0xAA; 32],
            &[],
            &[],
            &new_weights,
            "test",
        );
        log.block_number = None;

        let result = RebalanceRequestedEvent::from_log(&log);
        assert!(matches!(
            result,
            Err(RebalanceParseError::MissingBlockMetadata)
        ));
    }

    #[test]
    fn test_parse_three_asset_rebalance() {
        let requester = [0xCCu8; 20];
        let remove_indices = vec![U256::from(1)];
        let add_assets = vec![
            ethers::types::Address::from([0xA1u8; 20]),
            ethers::types::Address::from([0xA2u8; 20]),
        ];
        let new_weights = vec![
            U256::from(500_000_000_000_000_000u128), // 50%
            U256::from(250_000_000_000_000_000u128), // 25%
            U256::from(250_000_000_000_000_000u128), // 25%
        ];

        let log = create_test_log(
            requester,
            [0xBBu8; 32],
            &remove_indices,
            &add_assets,
            &new_weights,
            "diversify portfolio",
        );
        let event = RebalanceRequestedEvent::from_log(&log).unwrap();

        assert_eq!(event.requester, ethers::types::Address::from(requester));
        assert_eq!(event.itp_id, H256::from([0xBBu8; 32]));
        assert_eq!(event.remove_indices.len(), 1);
        assert_eq!(event.remove_indices[0], U256::from(1));
        assert_eq!(event.add_assets.len(), 2);
        assert_eq!(event.add_assets[0], ethers::types::Address::from([0xA1u8; 20]));
        assert_eq!(event.add_assets[1], ethers::types::Address::from([0xA2u8; 20]));
        assert_eq!(event.new_weights.len(), 3);
        assert_eq!(event.new_weights, new_weights);
        assert_eq!(event.note, "diversify portfolio");
    }

    #[test]
    fn test_parse_empty_remove_and_add() {
        let new_weights = vec![
            U256::from(600_000_000_000_000_000u128), // 60%
            U256::from(400_000_000_000_000_000u128), // 40%
        ];

        let log = create_test_log(
            [0xDDu8; 20],
            [0xAAu8; 32],
            &[],             // no removals
            &[],             // no additions
            &new_weights,
            "",              // empty note
        );
        let event = RebalanceRequestedEvent::from_log(&log).unwrap();

        assert!(event.remove_indices.is_empty());
        assert!(event.add_assets.is_empty());
        assert_eq!(event.new_weights, new_weights);
        assert_eq!(event.note, "");
    }

    #[test]
    fn test_parse_empty_weights_error() {
        let log = create_test_log(
            [0xDDu8; 20],
            [0xAAu8; 32],
            &[],
            &[],
            &[],        // empty weights → should error
            "bad rebalance",
        );
        let result = RebalanceRequestedEvent::from_log(&log);
        assert!(matches!(result, Err(RebalanceParseError::EmptyWeights)));
    }

    #[test]
    fn test_parse_long_note() {
        let new_weights = vec![U256::from(1_000_000_000_000_000_000u128)];
        let long_note = "This is a longer note that exceeds 32 bytes to test padding behavior in ABI encoding";

        let log = create_test_log(
            [0xDDu8; 20],
            [0xAAu8; 32],
            &[],
            &[],
            &new_weights,
            long_note,
        );
        let event = RebalanceRequestedEvent::from_log(&log).unwrap();
        assert_eq!(event.note, long_note);
    }

    #[test]
    fn test_requester_address_parsing() {
        // Use a specific requester address to verify correct extraction from topic
        let requester = [
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A,
            0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14,
        ];
        let new_weights = vec![U256::from(1_000_000_000_000_000_000u128)];

        let log = create_test_log(
            requester,
            [0xAAu8; 32],
            &[],
            &[],
            &new_weights,
            "test",
        );
        let event = RebalanceRequestedEvent::from_log(&log).unwrap();

        assert_eq!(event.requester, ethers::types::Address::from(requester));
    }
}
