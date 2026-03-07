//! ITP Creation Event Types (Story 6.21)
//!
//! This module provides types for parsing and validating cross-chain ITP creation events
//! from the BridgeProxy contract on the Settlement chain.
//!
//! Events:
//! - `CreateItpRequested` - User requests ITP creation on Settlement chain
//! - `ItpCreated` - ITP creation completed with bridged token deployed

use ethers::prelude::*;
use ethers::types::{Address, H256, Log, U256};
use std::collections::HashSet;
use thiserror::Error;

/// Event signature for CreateItpRequested
/// `keccak256("CreateItpRequested(address,uint256,string,string,uint256[],address[])")`
pub const CREATE_ITP_REQUESTED_SIGNATURE: &str =
    "CreateItpRequested(address,uint256,string,string,uint256[],address[])";

/// Event signature for ItpCreated
/// `keccak256("ItpCreated(bytes32,address,uint256,address)")`
pub const ITP_CREATED_SIGNATURE: &str = "ItpCreated(bytes32,address,uint256,address)";

/// Minimum weight per asset (0.25% = 2.5e15 in 1e18 scale)
pub const MIN_WEIGHT: u128 = 2_500_000_000_000_000;

/// Weight sum must equal 100% (1e18)
pub const WEIGHT_SUM: u128 = 1_000_000_000_000_000_000;

/// Maximum number of assets per ITP
pub const MAX_ASSETS: usize = 50;

/// Maximum name length in bytes
pub const MAX_NAME_LENGTH: usize = 32;

/// Maximum symbol length in bytes
pub const MAX_SYMBOL_LENGTH: usize = 10;

/// Parsed CreateItpRequested event from BridgeProxy on Settlement chain
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItpCreationRequest {
    /// Original requester address on Settlement chain
    pub admin: Address,
    /// Request nonce from BridgeProxy
    pub nonce: U256,
    /// ITP name (max 32 chars)
    pub name: String,
    /// ITP symbol (max 10 chars)
    pub symbol: String,
    /// Asset weights (sum to 1e18)
    pub weights: Vec<U256>,
    /// Asset addresses
    pub assets: Vec<Address>,
    /// Asset prices (18 decimals) — from BridgeProxy pending request
    pub prices: Vec<U256>,
    /// Block number where event was emitted
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

/// Validation errors for ITP creation requests
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ValidationError {
    #[error("weights and assets length mismatch: {weights_len} != {assets_len}")]
    LengthMismatch { weights_len: usize, assets_len: usize },

    #[error("no assets provided")]
    NoAssets,

    #[error("too many assets: {count} > {max}")]
    TooManyAssets { count: usize, max: usize },

    #[error("weights sum to {actual}, expected {expected}")]
    InvalidWeightsSum { actual: U256, expected: U256 },

    #[error("weight at index {index} is {weight}, below minimum {min}")]
    WeightBelowMinimum { index: usize, weight: U256, min: U256 },

    #[error("duplicate asset: {asset:?}")]
    DuplicateAsset { asset: Address },

    #[error("zero address asset at index {index}")]
    ZeroAddressAsset { index: usize },

    #[error("name too long: {length} > {max}")]
    NameTooLong { length: usize, max: usize },

    #[error("symbol too long: {length} > {max}")]
    SymbolTooLong { length: usize, max: usize },
}

/// Error parsing events from logs
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ParseError {
    #[error("missing topic at index {index}")]
    MissingTopic { index: usize },

    #[error("invalid topic length at index {index}: expected 32, got {length}")]
    InvalidTopicLength { index: usize, length: usize },

    #[error("failed to decode event data: {reason}")]
    DecodeError { reason: String },

    #[error("unexpected event signature")]
    UnexpectedSignature,

    #[error("missing block metadata")]
    MissingBlockMetadata,
}

impl ItpCreationRequest {
    /// Parse CreateItpRequested event from a raw log
    ///
    /// Event: CreateItpRequested(address indexed admin, uint256 indexed nonce, string name, string symbol, uint256[] weights, address[] assets)
    ///
    /// Topics:
    /// - [0]: event signature
    /// - [1]: admin (indexed)
    /// - [2]: nonce (indexed)
    ///
    /// Data (ABI encoded):
    /// - name (string)
    /// - symbol (string)
    /// - weights (uint256[])
    /// - assets (address[])
    pub fn from_log(log: &Log) -> Result<Self, ParseError> {
        // Verify we have enough topics
        if log.topics.len() < 3 {
            return Err(ParseError::MissingTopic {
                index: log.topics.len(),
            });
        }

        // Extract admin from topic[1] (last 20 bytes of bytes32)
        let admin = Address::from_slice(&log.topics[1].as_bytes()[12..32]);

        // Extract nonce from topic[2]
        let nonce = U256::from_big_endian(log.topics[2].as_bytes());

        // Decode the non-indexed parameters from data
        // Data layout for dynamic types:
        // [0]: offset to name (32 bytes)
        // [1]: offset to symbol (32 bytes)
        // [2]: offset to weights (32 bytes)
        // [3]: offset to assets (32 bytes)
        // Then the actual data follows at those offsets

        let data = &log.data.0;
        if data.len() < 128 {
            return Err(ParseError::DecodeError {
                reason: "data too short for offsets".to_string(),
            });
        }

        // Read offsets
        let name_offset = U256::from_big_endian(&data[0..32]).as_usize();
        let symbol_offset = U256::from_big_endian(&data[32..64]).as_usize();
        let weights_offset = U256::from_big_endian(&data[64..96]).as_usize();
        let assets_offset = U256::from_big_endian(&data[96..128]).as_usize();

        // Parse name string
        let name = decode_string(data, name_offset)?;

        // Parse symbol string
        let symbol = decode_string(data, symbol_offset)?;

        // Parse weights array
        let weights = decode_uint256_array(data, weights_offset)?;

        // Parse assets array
        let assets = decode_address_array(data, assets_offset)?;

        // Get block metadata
        let block_number = log
            .block_number
            .ok_or(ParseError::MissingBlockMetadata)?
            .as_u64();
        let tx_hash = log.transaction_hash.ok_or(ParseError::MissingBlockMetadata)?;

        Ok(Self {
            admin,
            nonce,
            name,
            symbol,
            weights,
            assets,
            prices: vec![], // Prices not in event; populated by getPendingCreation view call
            block_number,
            tx_hash,
        })
    }

    /// Validate the ITP creation request
    ///
    /// Checks:
    /// - weights.length == assets.length
    /// - weights.length > 0 && weights.length <= 50
    /// - sum(weights) == 1e18
    /// - each weight >= 0.25% (2.5e15)
    /// - no duplicate assets
    /// - no zero address assets
    /// - name.length <= 32 && symbol.length <= 10
    pub fn validate(&self) -> Result<(), ValidationError> {
        // Check lengths match
        if self.weights.len() != self.assets.len() {
            return Err(ValidationError::LengthMismatch {
                weights_len: self.weights.len(),
                assets_len: self.assets.len(),
            });
        }

        // Check not empty
        if self.weights.is_empty() {
            return Err(ValidationError::NoAssets);
        }

        // Check max assets
        if self.weights.len() > MAX_ASSETS {
            return Err(ValidationError::TooManyAssets {
                count: self.weights.len(),
                max: MAX_ASSETS,
            });
        }

        // Check weights sum to 1e18
        let sum: U256 = self.weights.iter().fold(U256::zero(), |acc, w| acc + *w);
        let expected_sum = U256::from(WEIGHT_SUM);
        if sum != expected_sum {
            return Err(ValidationError::InvalidWeightsSum {
                actual: sum,
                expected: expected_sum,
            });
        }

        // Check minimum weight (0.25% = 2.5e15)
        let min_weight = U256::from(MIN_WEIGHT);
        for (i, weight) in self.weights.iter().enumerate() {
            if *weight < min_weight {
                return Err(ValidationError::WeightBelowMinimum {
                    index: i,
                    weight: *weight,
                    min: min_weight,
                });
            }
        }

        // Check no duplicate assets
        let mut seen = HashSet::new();
        for asset in &self.assets {
            if !seen.insert(*asset) {
                return Err(ValidationError::DuplicateAsset { asset: *asset });
            }
        }

        // Check no zero address
        for (i, asset) in self.assets.iter().enumerate() {
            if asset.is_zero() {
                return Err(ValidationError::ZeroAddressAsset { index: i });
            }
        }

        // Check name length
        if self.name.len() > MAX_NAME_LENGTH {
            return Err(ValidationError::NameTooLong {
                length: self.name.len(),
                max: MAX_NAME_LENGTH,
            });
        }

        // Check symbol length
        if self.symbol.len() > MAX_SYMBOL_LENGTH {
            return Err(ValidationError::SymbolTooLong {
                length: self.symbol.len(),
                max: MAX_SYMBOL_LENGTH,
            });
        }

        Ok(())
    }
}

/// Parsed ItpCreated event from BridgeProxy on Settlement chain
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItpCreatedEvent {
    /// L3 ITP ID
    pub orbit_itp_id: H256,
    /// Deployed BridgedITP address on Settlement chain
    pub bridged_itp_address: Address,
    /// Original request nonce
    pub nonce: U256,
    /// Original requester
    pub admin: Address,
    /// Block number
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: H256,
}

impl ItpCreatedEvent {
    /// Parse ItpCreated event from a raw log
    ///
    /// Event: ItpCreated(bytes32 indexed orbitItpId, address indexed bridgedItpAddress, uint256 indexed nonce, address admin)
    ///
    /// Topics:
    /// - [0]: event signature
    /// - [1]: orbitItpId (indexed)
    /// - [2]: bridgedItpAddress (indexed)
    /// - [3]: nonce (indexed)
    ///
    /// Data:
    /// - admin (address)
    pub fn from_log(log: &Log) -> Result<Self, ParseError> {
        if log.topics.len() < 4 {
            return Err(ParseError::MissingTopic {
                index: log.topics.len(),
            });
        }

        let orbit_itp_id = log.topics[1];
        let bridged_itp_address = Address::from_slice(&log.topics[2].as_bytes()[12..32]);
        let nonce = U256::from_big_endian(log.topics[3].as_bytes());

        // Decode admin from data
        let data = &log.data.0;
        if data.len() < 32 {
            return Err(ParseError::DecodeError {
                reason: "data too short for admin".to_string(),
            });
        }
        let admin = Address::from_slice(&data[12..32]);

        let block_number = log
            .block_number
            .ok_or(ParseError::MissingBlockMetadata)?
            .as_u64();
        let tx_hash = log.transaction_hash.ok_or(ParseError::MissingBlockMetadata)?;

        Ok(Self {
            orbit_itp_id,
            bridged_itp_address,
            nonce,
            admin,
            block_number,
            tx_hash,
        })
    }
}

/// Decode a dynamic string from ABI-encoded data
fn decode_string(data: &[u8], offset: usize) -> Result<String, ParseError> {
    if offset + 32 > data.len() {
        return Err(ParseError::DecodeError {
            reason: "string offset out of bounds".to_string(),
        });
    }

    // First 32 bytes at offset is the string length
    let length = U256::from_big_endian(&data[offset..offset + 32]).as_usize();

    // Check bounds
    if offset + 32 + length > data.len() {
        return Err(ParseError::DecodeError {
            reason: "string data out of bounds".to_string(),
        });
    }

    // Read string bytes
    let string_bytes = &data[offset + 32..offset + 32 + length];
    String::from_utf8(string_bytes.to_vec()).map_err(|e| ParseError::DecodeError {
        reason: format!("invalid UTF-8: {}", e),
    })
}

/// Decode a dynamic uint256[] array from ABI-encoded data
fn decode_uint256_array(data: &[u8], offset: usize) -> Result<Vec<U256>, ParseError> {
    if offset + 32 > data.len() {
        return Err(ParseError::DecodeError {
            reason: "array offset out of bounds".to_string(),
        });
    }

    // First 32 bytes at offset is the array length
    let length = U256::from_big_endian(&data[offset..offset + 32]).as_usize();

    // Check bounds
    let expected_end = offset + 32 + length * 32;
    if expected_end > data.len() {
        return Err(ParseError::DecodeError {
            reason: "array data out of bounds".to_string(),
        });
    }

    let mut result = Vec::with_capacity(length);
    for i in 0..length {
        let start = offset + 32 + i * 32;
        let value = U256::from_big_endian(&data[start..start + 32]);
        result.push(value);
    }

    Ok(result)
}

/// Decode a dynamic address[] array from ABI-encoded data
fn decode_address_array(data: &[u8], offset: usize) -> Result<Vec<Address>, ParseError> {
    if offset + 32 > data.len() {
        return Err(ParseError::DecodeError {
            reason: "array offset out of bounds".to_string(),
        });
    }

    // First 32 bytes at offset is the array length
    let length = U256::from_big_endian(&data[offset..offset + 32]).as_usize();

    // Check bounds (addresses are padded to 32 bytes in ABI encoding)
    let expected_end = offset + 32 + length * 32;
    if expected_end > data.len() {
        return Err(ParseError::DecodeError {
            reason: "array data out of bounds".to_string(),
        });
    }

    let mut result = Vec::with_capacity(length);
    for i in 0..length {
        let start = offset + 32 + i * 32;
        // Address is in the last 20 bytes of the 32-byte slot
        let address = Address::from_slice(&data[start + 12..start + 32]);
        result.push(address);
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_request() -> ItpCreationRequest {
        ItpCreationRequest {
            admin: Address::from([0x11u8; 20]),
            nonce: U256::from(1),
            name: "Test ITP".to_string(),
            symbol: "TITP".to_string(),
            weights: vec![
                U256::from(500_000_000_000_000_000u64), // 50%
                U256::from(500_000_000_000_000_000u64), // 50%
            ],
            assets: vec![
                Address::from([0x22u8; 20]),
                Address::from([0x33u8; 20]),
            ],
            prices: vec![
                U256::from(1_000_000_000_000_000_000u64), // $1
                U256::from(1_000_000_000_000_000_000u64), // $1
            ],
            block_number: 100,
            tx_hash: H256::from([0x44u8; 32]),
        }
    }

    #[test]
    fn test_validate_success() {
        let request = create_test_request();
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_validate_length_mismatch() {
        let mut request = create_test_request();
        request.assets.push(Address::from([0x55u8; 20]));
        let result = request.validate();
        assert!(matches!(
            result,
            Err(ValidationError::LengthMismatch { .. })
        ));
    }

    #[test]
    fn test_validate_no_assets() {
        let mut request = create_test_request();
        request.weights.clear();
        request.assets.clear();
        let result = request.validate();
        assert!(matches!(result, Err(ValidationError::NoAssets)));
    }

    #[test]
    fn test_validate_too_many_assets() {
        let mut request = create_test_request();
        request.weights.clear();
        request.assets.clear();

        // Add 51 assets (above max of 50)
        let weight_per_asset = U256::from(WEIGHT_SUM / 51);
        for i in 0..51 {
            request.weights.push(weight_per_asset);
            request.assets.push(Address::from([i as u8; 20]));
        }
        // Adjust to sum to 1e18
        request.weights[0] = request.weights[0] + U256::from(WEIGHT_SUM % 51);

        let result = request.validate();
        assert!(matches!(
            result,
            Err(ValidationError::TooManyAssets { count: 51, max: 50 })
        ));
    }

    #[test]
    fn test_validate_invalid_weights_sum() {
        let mut request = create_test_request();
        request.weights[0] = U256::from(400_000_000_000_000_000u64); // 40% instead of 50%
        let result = request.validate();
        assert!(matches!(
            result,
            Err(ValidationError::InvalidWeightsSum { .. })
        ));
    }

    #[test]
    fn test_validate_weight_below_minimum() {
        let mut request = create_test_request();
        request.weights[0] = U256::from(1_000_000_000_000_000u64); // 0.1% (below 0.25%)
        request.weights[1] = U256::from(999_000_000_000_000_000u64); // 99.9%
        let result = request.validate();
        assert!(matches!(
            result,
            Err(ValidationError::WeightBelowMinimum { index: 0, .. })
        ));
    }

    #[test]
    fn test_validate_duplicate_asset() {
        let mut request = create_test_request();
        request.assets[1] = request.assets[0]; // Duplicate
        let result = request.validate();
        assert!(matches!(
            result,
            Err(ValidationError::DuplicateAsset { .. })
        ));
    }

    #[test]
    fn test_validate_zero_address_asset() {
        let mut request = create_test_request();
        request.assets[0] = Address::zero();
        let result = request.validate();
        assert!(matches!(
            result,
            Err(ValidationError::ZeroAddressAsset { index: 0 })
        ));
    }

    #[test]
    fn test_validate_name_too_long() {
        let mut request = create_test_request();
        request.name = "a".repeat(33);
        let result = request.validate();
        assert!(matches!(
            result,
            Err(ValidationError::NameTooLong { length: 33, max: 32 })
        ));
    }

    #[test]
    fn test_validate_symbol_too_long() {
        let mut request = create_test_request();
        request.symbol = "a".repeat(11);
        let result = request.validate();
        assert!(matches!(
            result,
            Err(ValidationError::SymbolTooLong { length: 11, max: 10 })
        ));
    }

    #[test]
    fn test_validate_exact_min_weight() {
        let mut request = create_test_request();
        request.weights[0] = U256::from(MIN_WEIGHT); // Exactly 0.25%
        request.weights[1] = U256::from(WEIGHT_SUM) - U256::from(MIN_WEIGHT); // Rest
        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_validate_max_assets() {
        let mut request = ItpCreationRequest {
            admin: Address::from([0x11u8; 20]),
            nonce: U256::from(1),
            name: "Max Assets".to_string(),
            symbol: "MAX".to_string(),
            weights: Vec::new(),
            assets: Vec::new(),
            prices: Vec::new(),
            block_number: 100,
            tx_hash: H256::from([0x44u8; 32]),
        };

        // Add exactly 50 assets (max allowed)
        let weight_per_asset = U256::from(WEIGHT_SUM / 50);
        for i in 0..50 {
            request.weights.push(weight_per_asset);
            request.assets.push(Address::from([i as u8 + 1; 20]));
        }

        assert!(request.validate().is_ok());
    }

    #[test]
    fn test_decode_string() {
        // Build ABI-encoded string "Test"
        let mut data = vec![0u8; 128];
        // Length = 4
        data[31] = 4;
        // "Test" in ASCII
        data[32] = b'T';
        data[33] = b'e';
        data[34] = b's';
        data[35] = b't';

        let result = decode_string(&data, 0).unwrap();
        assert_eq!(result, "Test");
    }

    #[test]
    fn test_decode_uint256_array() {
        // Build ABI-encoded uint256[] with [100, 200]
        let mut data = vec![0u8; 96];
        // Length = 2
        data[31] = 2;
        // First element = 100
        data[63] = 100;
        // Second element = 200
        data[95] = 200;

        let result = decode_uint256_array(&data, 0).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], U256::from(100));
        assert_eq!(result[1], U256::from(200));
    }

    #[test]
    fn test_decode_address_array() {
        // Build ABI-encoded address[] with 2 addresses
        let mut data = vec![0u8; 96];
        // Length = 2
        data[31] = 2;
        // First address (last 20 bytes of 32-byte slot)
        for i in 12..32 {
            data[32 + i] = 0x11;
        }
        // Second address
        for i in 12..32 {
            data[64 + i] = 0x22;
        }

        let result = decode_address_array(&data, 0).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], Address::from([0x11u8; 20]));
        assert_eq!(result[1], Address::from([0x22u8; 20]));
    }
}
