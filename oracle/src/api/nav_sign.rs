//! NAV signing endpoint handler for oracle node
//!
//! Implements `GET /api/nav-sign?itp={address}` which returns a BLS-signed NAV price.
//!
//! ## Response Format
//!
//! ```json
//! {
//!   "itpAddress": "0x...",
//!   "price": "1000000000000000000000000000000000000",
//!   "timestamp": 1706886400,
//!   "cycleNumber": 42,
//!   "blsSignature": "0x...",
//!   "oracleId": 2,
//!   "pubkey": "0x..."
//! }
//! ```
//!
//! ## Security Model
//!
//! This endpoint is public (AC7). Security comes from BLS verification:
//! - Individual signatures are harmless
//! - Only aggregated signatures (2/3+ of oracles) are useful
//! - On-chain verification uses OracleRegistry aggregated pubkey

use ethers::types::{Address, U256};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::abi::AbiEncoder;

/// Request parameters for NAV signing endpoint
#[derive(Debug, Clone, Deserialize)]
pub struct NavSignRequest {
    /// ITP contract address
    pub itp: Address,
}

/// Response from NAV signing endpoint
///
/// All numeric values that exceed JavaScript's safe integer range are encoded as strings.
#[derive(Debug, Clone, Serialize)]
pub struct NavSignResponse {
    /// ITP contract address (checksummed)
    #[serde(rename = "itpAddress")]
    pub itp_address: String,

    /// NAV price in 36 decimals (Morpho oracle standard), as decimal string
    pub price: String,

    /// Unix timestamp (seconds) when NAV was computed
    pub timestamp: u64,

    /// Current oracle cycle number
    #[serde(rename = "cycleNumber")]
    pub cycle_number: u64,

    /// BLS G1 signature (64 bytes, hex-encoded with 0x prefix)
    #[serde(rename = "blsSignature")]
    pub bls_signature: String,

    /// This oracle's on-chain ID from OracleRegistry
    #[serde(rename = "oracleId")]
    pub oracle_id: u8,

    /// This oracle's BLS G2 public key (128 bytes, hex-encoded with 0x prefix)
    pub pubkey: String,
}

/// Errors that can occur during NAV signing
#[derive(Debug, Error)]
pub enum NavSignError {
    /// ITP address not registered
    #[error("ITP not found: {address:?}")]
    ItpNotFound { address: Address },

    /// Missing or malformed itp parameter
    #[error("Invalid ITP address: {reason}")]
    InvalidAddress { reason: String },

    /// BLS keypair not configured
    #[error("BLS keys not configured")]
    BlsKeysNotConfigured,

    /// Failed to compute NAV
    #[error("Failed to compute NAV: {reason}")]
    NavComputationFailed { reason: String },

    /// Failed to sign NAV
    #[error("Failed to sign NAV: {reason}")]
    SigningFailed { reason: String },

    /// Internal error
    #[error("Internal error: {reason}")]
    Internal { reason: String },
}

impl NavSignError {
    /// Returns the HTTP status code for this error
    pub fn status_code(&self) -> u16 {
        match self {
            NavSignError::ItpNotFound { .. } => 404,
            NavSignError::InvalidAddress { .. } => 400,
            NavSignError::BlsKeysNotConfigured => 503,
            NavSignError::NavComputationFailed { .. } => 500,
            NavSignError::SigningFailed { .. } => 500,
            NavSignError::Internal { .. } => 500,
        }
    }
}

/// Cached NAV entry for consistency within a cycle
#[derive(Debug, Clone)]
pub struct NavCacheEntry {
    /// NAV price (36 decimals)
    pub price: U256,
    /// Timestamp when NAV was computed
    pub timestamp: u64,
    /// BLS signature bytes
    pub signature: Vec<u8>,
}

/// Handler for NAV sign requests
///
/// Encapsulates all dependencies needed to process NAV sign requests.
pub struct NavSignHandler<NC, CR> {
    /// NAV calculator for computing ITP NAV
    nav_calculator: NC,
    /// Chain reader for ITP registry lookups
    chain_reader: CR,
    /// BLS keypair for signing (None if not configured)
    bls_keypair: Option<common::bls::BLSKeyPair>,
    /// This oracle's on-chain ID
    oracle_id: u8,
    /// Current cycle number provider
    cycle_number: std::sync::Arc<std::sync::atomic::AtomicU64>,
    /// NAV cache for consistency within cycles
    nav_cache: std::sync::Arc<
        tokio::sync::RwLock<std::collections::HashMap<(Address, u64), NavCacheEntry>>,
    >,
}

impl<NC, CR> NavSignHandler<NC, CR>
where
    NC: super::nav::NavCalculator,
    CR: ItpRegistryReader,
{
    /// Creates a new NAV sign handler
    pub fn new(
        nav_calculator: NC,
        chain_reader: CR,
        bls_keypair: Option<common::bls::BLSKeyPair>,
        oracle_id: u8,
        initial_cycle: u64,
    ) -> Self {
        Self {
            nav_calculator,
            chain_reader,
            bls_keypair,
            oracle_id,
            cycle_number: std::sync::Arc::new(std::sync::atomic::AtomicU64::new(initial_cycle)),
            nav_cache: std::sync::Arc::new(tokio::sync::RwLock::new(
                std::collections::HashMap::new(),
            )),
        }
    }

    /// Updates the current cycle number
    pub fn set_cycle_number(&self, cycle: u64) {
        self.cycle_number
            .store(cycle, std::sync::atomic::Ordering::Relaxed);
    }

    /// Returns the current cycle number
    pub fn get_cycle_number(&self) -> u64 {
        self.cycle_number
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Handles a NAV sign request
    pub async fn handle(&self, request: &NavSignRequest) -> Result<NavSignResponse, NavSignError> {
        // AC8: Check BLS keypair is configured
        let keypair = self
            .bls_keypair
            .as_ref()
            .ok_or(NavSignError::BlsKeysNotConfigured)?;

        let itp_address = request.itp;
        let cycle_number = self.get_cycle_number();

        // Check cache first for consistency (AC3)
        {
            let cache = self.nav_cache.read().await;
            if let Some(entry) = cache.get(&(itp_address, cycle_number)) {
                // Return cached response
                return Ok(self.build_response(
                    itp_address,
                    entry.price,
                    entry.timestamp,
                    cycle_number,
                    &entry.signature,
                    keypair,
                ));
            }
        }

        // AC4: Look up ITP from registry
        let itp_info = self
            .chain_reader
            .get_itp_info(itp_address)
            .await
            .map_err(|e| NavSignError::Internal {
                reason: e.to_string(),
            })?
            .ok_or(NavSignError::ItpNotFound {
                address: itp_address,
            })?;

        // AC9: Compute NAV from ITP inventory (per-share quantities)
        let nav_18_decimals = self
            .nav_calculator
            .calculate_nav(&itp_info.inventory)
            .await
            .map_err(|e| NavSignError::NavComputationFailed {
                reason: e.to_string(),
            })?;

        // Scale to 36 decimals for Morpho compatibility
        let nav_36_decimals = nav_18_decimals * U256::exp10(18);

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .expect("System clock required for NAV signing");

        // Build message hash for signing
        let message_hash = build_nav_message_hash(itp_address, nav_36_decimals, timestamp, cycle_number);

        // Sign with BLS keypair
        let signer = common::bls::Bn254BLSSigner::new();
        let signature = signer
            .sign_message_hash(keypair, &message_hash)
            .map_err(|e| NavSignError::SigningFailed {
                reason: e.to_string(),
            })?;

        // Cache for consistency
        {
            let mut cache = self.nav_cache.write().await;
            cache.insert(
                (itp_address, cycle_number),
                NavCacheEntry {
                    price: nav_36_decimals,
                    timestamp,
                    signature: signature.0.clone(),
                },
            );
        }

        Ok(self.build_response(
            itp_address,
            nav_36_decimals,
            timestamp,
            cycle_number,
            &signature.0,
            keypair,
        ))
    }

    /// Builds the response struct from computed values
    fn build_response(
        &self,
        itp_address: Address,
        price: U256,
        timestamp: u64,
        cycle_number: u64,
        signature: &[u8],
        keypair: &common::bls::BLSKeyPair,
    ) -> NavSignResponse {
        NavSignResponse {
            itp_address: format!("{:?}", itp_address),
            price: price.to_string(),
            timestamp,
            cycle_number,
            bls_signature: format!("0x{}", hex::encode(signature)),
            oracle_id: self.oracle_id,
            pubkey: format!("0x{}", hex::encode(&keypair.public_key().0)),
        }
    }

    /// Clears old cache entries (call periodically)
    pub async fn clear_old_cache(&self, current_cycle: u64, keep_cycles: u64) {
        let mut cache = self.nav_cache.write().await;
        cache.retain(|(_, cycle), _| *cycle + keep_cycles >= current_cycle);
    }
}

/// Trait for reading ITP info from chain
#[async_trait::async_trait]
pub trait ItpRegistryReader: Send + Sync {
    /// Gets ITP info by address, returns None if not registered
    async fn get_itp_info(&self, itp_address: Address) -> Result<Option<ItpInfo>, Box<dyn std::error::Error + Send + Sync>>;
}

/// ITP information from registry
#[derive(Debug, Clone)]
pub struct ItpInfo {
    /// On-chain ITP ID
    pub id: U256,
    /// Per-share inventory quantities: [(asset_address, qty_per_share)]
    pub inventory: Vec<(Address, U256)>,
    /// Total shares outstanding
    pub shares_outstanding: U256,
}

/// Builds the message hash for NAV signing
///
/// Must match Solidity's `keccak256(abi.encodePacked(itpAddress, price, timestamp, cycleNumber))`
pub fn build_nav_message_hash(
    itp_address: Address,
    price: U256,
    timestamp: u64,
    cycle_number: u64,
) -> [u8; 32] {
    // abi.encodePacked packs tightly without padding
    let hash = AbiEncoder::with_capacity(116)
        .address_packed(itp_address)
        .u256(price)
        .u256(U256::from(timestamp))
        .u256(U256::from(cycle_number))
        .keccak256();
    *hash.as_fixed_bytes()
}

/// Parses an HTTP request and handles the NAV sign endpoint
///
/// Returns (status_code, content_type, body)
pub async fn handle_nav_sign_request<NC, CR>(
    handler: &NavSignHandler<NC, CR>,
    query_string: &str,
) -> (u16, &'static str, String)
where
    NC: super::nav::NavCalculator,
    CR: ItpRegistryReader,
{
    // Parse query string
    let request = match parse_nav_sign_query(query_string) {
        Ok(req) => req,
        Err(e) => {
            return (
                400,
                "application/json",
                format!(r#"{{"error":"{}"}}"#, e),
            );
        }
    };

    // Handle request
    match handler.handle(&request).await {
        Ok(response) => {
            let json = serde_json::to_string(&response).unwrap_or_else(|e| {
                format!(r#"{{"error":"Serialization failed: {}"}}"#, e)
            });
            (200, "application/json", json)
        }
        Err(e) => {
            let status = e.status_code();
            (
                status,
                "application/json",
                format!(r#"{{"error":"{}"}}"#, e),
            )
        }
    }
}

/// Parses the query string for NAV sign request
fn parse_nav_sign_query(query: &str) -> Result<NavSignRequest, NavSignError> {
    // Parse "itp=0x..." from query string
    for pair in query.split('&') {
        if let Some(value) = pair.strip_prefix("itp=") {
            let address = value
                .parse::<Address>()
                .map_err(|e| NavSignError::InvalidAddress {
                    reason: e.to_string(),
                })?;
            return Ok(NavSignRequest { itp: address });
        }
    }

    Err(NavSignError::InvalidAddress {
        reason: "Missing 'itp' query parameter".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_nav_sign_query_valid() {
        let query = "itp=0x1234567890123456789012345678901234567890";
        let result = parse_nav_sign_query(query).unwrap();
        assert_eq!(
            result.itp,
            "0x1234567890123456789012345678901234567890"
                .parse::<Address>()
                .unwrap()
        );
    }

    #[test]
    fn test_parse_nav_sign_query_missing_itp() {
        let query = "foo=bar";
        let result = parse_nav_sign_query(query);
        assert!(matches!(result, Err(NavSignError::InvalidAddress { .. })));
    }

    #[test]
    fn test_parse_nav_sign_query_invalid_address() {
        let query = "itp=notanaddress";
        let result = parse_nav_sign_query(query);
        assert!(matches!(result, Err(NavSignError::InvalidAddress { .. })));
    }

    #[test]
    fn test_build_nav_message_hash() {
        let itp_address: Address = "0x1234567890123456789012345678901234567890"
            .parse()
            .unwrap();
        let price = U256::exp10(36); // 1.0 in 36 decimals
        let timestamp = 1706886400u64;
        let cycle_number = 42u64;

        let hash = build_nav_message_hash(itp_address, price, timestamp, cycle_number);

        // Hash should be 32 bytes
        assert_eq!(hash.len(), 32);

        // Same inputs should produce same hash (deterministic)
        let hash2 = build_nav_message_hash(itp_address, price, timestamp, cycle_number);
        assert_eq!(hash, hash2);

        // Different inputs should produce different hash
        let hash3 = build_nav_message_hash(itp_address, price, timestamp, cycle_number + 1);
        assert_ne!(hash, hash3);
    }

    #[test]
    fn test_nav_sign_error_status_codes() {
        assert_eq!(
            NavSignError::ItpNotFound {
                address: Address::zero()
            }
            .status_code(),
            404
        );
        assert_eq!(
            NavSignError::InvalidAddress {
                reason: "test".into()
            }
            .status_code(),
            400
        );
        assert_eq!(NavSignError::BlsKeysNotConfigured.status_code(), 503);
        assert_eq!(
            NavSignError::NavComputationFailed {
                reason: "test".into()
            }
            .status_code(),
            500
        );
    }

    #[test]
    fn test_nav_sign_response_serialization() {
        let response = NavSignResponse {
            itp_address: "0x1234567890123456789012345678901234567890".to_string(),
            price: "1000000000000000000000000000000000000".to_string(),
            timestamp: 1706886400,
            cycle_number: 42,
            bls_signature: "0xaabbccdd".to_string(),
            oracle_id: 1,
            pubkey: "0xeeff".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("itpAddress"));
        assert!(json.contains("cycleNumber"));
        assert!(json.contains("blsSignature"));
        assert!(json.contains("oracleId"));
    }

    #[test]
    fn test_u256_to_string_is_decimal() {
        // Verify that U256::to_string() outputs decimal, not hex
        let val = U256::exp10(36);
        let s = val.to_string();
        assert_eq!(s, "1000000000000000000000000000000000000",
                   "U256::to_string() should output decimal");

        // Verify roundtrip works - U256::from_dec_str must be used, not parse()
        // parse() interprets strings as HEX by default!
        let parsed = U256::from_dec_str(&s).unwrap();
        assert_eq!(parsed, val, "from_dec_str should roundtrip correctly");
    }

    #[test]
    fn test_bls_signing_for_nav() {
        use common::bls::{BLSKeyPair, Bn254BLSSigner};

        let itp_address: Address = "0x1234567890123456789012345678901234567890"
            .parse()
            .unwrap();
        let price = U256::exp10(36); // 1.0 in 36 decimals
        let timestamp = 1706886400u64;
        let cycle_number = 42u64;

        // Generate keypair
        let keypair = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();
        let signer = Bn254BLSSigner::new();

        // Build message hash
        let message_hash = build_nav_message_hash(itp_address, price, timestamp, cycle_number);

        // Sign the message hash
        let signature = signer.sign_message_hash(&keypair, &message_hash).unwrap();

        // Signature should be 64 bytes (G1 point)
        assert_eq!(signature.0.len(), 64);

        // Verify the signature
        let valid = signer
            .verify_message_hash(&keypair.public_key(), &message_hash, &signature)
            .unwrap();
        assert!(valid, "BLS signature should verify");

        // Same inputs should produce same signature (deterministic)
        let signature2 = signer.sign_message_hash(&keypair, &message_hash).unwrap();
        assert_eq!(signature.0, signature2.0);

        // Different inputs should produce different signature
        let different_hash = build_nav_message_hash(itp_address, price, timestamp, cycle_number + 1);
        let signature3 = signer.sign_message_hash(&keypair, &different_hash).unwrap();
        assert_ne!(signature.0, signature3.0);
    }

    #[test]
    fn test_bls_signature_aggregation_for_nav() {
        use common::bls::{aggregate_pubkeys, BLSKeyPair, Bn254BLSSigner};
        use common::traits::BLSSigner;

        let itp_address: Address = "0x1234567890123456789012345678901234567890"
            .parse()
            .unwrap();
        let price = U256::exp10(36);
        let timestamp = 1706886400u64;
        let cycle_number = 42u64;

        // Generate 3 keypairs (simulating 3 oracles)
        let kp1 = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();
        let kp2 = BLSKeyPair::from_seed(&[2u8; 32]).unwrap();
        let kp3 = BLSKeyPair::from_seed(&[3u8; 32]).unwrap();

        let signer = Bn254BLSSigner::new();
        let message_hash = build_nav_message_hash(itp_address, price, timestamp, cycle_number);

        // Each oracle signs the same message hash
        let sig1 = signer.sign_message_hash(&kp1, &message_hash).unwrap();
        let sig2 = signer.sign_message_hash(&kp2, &message_hash).unwrap();
        let sig3 = signer.sign_message_hash(&kp3, &message_hash).unwrap();

        // Aggregate the signatures (use trait method)
        let agg_sig = BLSSigner::aggregate_signatures(&signer, vec![sig1, sig2, sig3])
            .unwrap();

        // Aggregate the public keys
        let agg_pk = aggregate_pubkeys(&[kp1.public_key(), kp2.public_key(), kp3.public_key()])
            .unwrap();

        // Verify the aggregated signature with the aggregated pubkey
        let valid = signer
            .verify_message_hash(&agg_pk, &message_hash, &agg_sig)
            .unwrap();
        assert!(valid, "Aggregated BLS signature should verify with aggregated pubkey");
    }
}
