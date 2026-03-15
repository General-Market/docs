//! Fluent ABI encoding helpers for keccak256 hashing and calldata construction.
//!
//! Replaces scattered manual byte-packing (`let mut bytes = [0u8; 32]; val.to_big_endian(...)`)
//! with a chainable builder that is harder to misuse.

use ethers::types::{Address, H256, U256};

/// Fluent builder for ABI-encoding data for keccak256 hashing and calldata construction.
pub struct AbiEncoder {
    data: Vec<u8>,
}

impl AbiEncoder {
    pub fn new() -> Self {
        Self { data: Vec::new() }
    }

    pub fn with_capacity(cap: usize) -> Self {
        Self { data: Vec::with_capacity(cap) }
    }

    /// Append a U256 as 32 big-endian bytes.
    pub fn u256(mut self, val: U256) -> Self {
        let mut bytes = [0u8; 32];
        val.to_big_endian(&mut bytes);
        self.data.extend_from_slice(&bytes);
        self
    }

    /// Append an address left-padded to 32 bytes (for ABI encoding).
    pub fn address_padded(mut self, addr: Address) -> Self {
        let mut bytes = [0u8; 32];
        bytes[12..32].copy_from_slice(addr.as_bytes());
        self.data.extend_from_slice(&bytes);
        self
    }

    /// Append an address as packed 20 bytes (for encodePacked).
    pub fn address_packed(mut self, addr: Address) -> Self {
        self.data.extend_from_slice(addr.as_bytes());
        self
    }

    /// Append an H256 (32 bytes).
    pub fn h256(mut self, val: H256) -> Self {
        self.data.extend_from_slice(val.as_bytes());
        self
    }

    /// Append raw bytes.
    pub fn bytes(mut self, val: &[u8]) -> Self {
        self.data.extend_from_slice(val);
        self
    }

    /// Append a bool as a 32-byte padded value.
    pub fn bool(mut self, val: bool) -> Self {
        let mut bytes = [0u8; 32];
        if val {
            bytes[31] = 1;
        }
        self.data.extend_from_slice(&bytes);
        self
    }

    /// Append a u8 as a 32-byte padded value (for uint8 in ABI encoding).
    pub fn u8_padded(mut self, val: u8) -> Self {
        let mut bytes = [0u8; 32];
        bytes[31] = val;
        self.data.extend_from_slice(&bytes);
        self
    }

    /// Append a dynamic bytes value with ABI encoding (length + padded data).
    /// Used for encoding `bytes` parameters in calldata.
    pub fn bytes_with_length(mut self, val: &[u8]) -> Self {
        // length as uint256
        let mut len_bytes = [0u8; 32];
        U256::from(val.len()).to_big_endian(&mut len_bytes);
        self.data.extend_from_slice(&len_bytes);
        // data + padding to 32-byte boundary
        self.data.extend_from_slice(val);
        let padding = (32 - (val.len() % 32)) % 32;
        self.data.extend(std::iter::repeat(0u8).take(padding));
        self
    }

    /// Append a string value with ABI encoding (length + padded data).
    /// Used for encoding `string` parameters in abi.encode.
    pub fn string_with_length(self, val: &[u8]) -> Self {
        self.bytes_with_length(val)
    }

    /// Compute keccak256 hash of the accumulated data.
    pub fn keccak256(&self) -> H256 {
        H256::from_slice(&ethers::utils::keccak256(&self.data))
    }

    /// Return the accumulated bytes (for calldata construction).
    pub fn finish(self) -> Vec<u8> {
        self.data
    }
}

/// Compute keccak256 of abi.encodePacked(weights) -- packed U256 array.
pub fn compute_weights_hash(weights: &[U256]) -> H256 {
    let mut enc = AbiEncoder::with_capacity(weights.len() * 32);
    for w in weights {
        enc = enc.u256(*w);
    }
    enc.keccak256()
}
