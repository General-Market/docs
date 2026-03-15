//! Integration tests for NAV signing endpoint (Story 8.3)
//!
//! Tests the full NAV signing flow including:
//! - Single oracle response validation
//! - 3-oracle consistency (same price/cycleNumber)
//! - BLS signature aggregation
//! - Aggregate signature verification

use common::bls::{aggregate_pubkeys, BLSKeyPair, Bn254BLSSigner};
use common::traits::BLSSigner;
use ethers::types::{Address, U256};
use oracle::api::{
    build_nav_message_hash, ItpInfo, ItpRegistryReader, MockNavCalculator, NavSignHandler,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Mock ITP registry for testing
struct MockItpRegistry {
    itps: HashMap<Address, ItpInfo>,
}

impl MockItpRegistry {
    fn new() -> Self {
        Self {
            itps: HashMap::new(),
        }
    }

    fn add_itp(&mut self, address: Address, info: ItpInfo) {
        self.itps.insert(address, info);
    }
}

#[async_trait::async_trait]
impl ItpRegistryReader for MockItpRegistry {
    async fn get_itp_info(
        &self,
        itp_address: Address,
    ) -> Result<Option<ItpInfo>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(self.itps.get(&itp_address).cloned())
    }
}

/// Helper to create test ITP info
fn test_itp_info() -> ItpInfo {
    let asset1: Address = "0x1111111111111111111111111111111111111111"
        .parse()
        .unwrap();
    let asset2: Address = "0x2222222222222222222222222222222222222222"
        .parse()
        .unwrap();

    ItpInfo {
        id: U256::from(1),
        inventory: vec![
            (asset1, U256::from(50)), // 50% qty per share
            (asset2, U256::from(50)), // 50% qty per share
        ],
        shares_outstanding: U256::exp10(18) * 1000, // 1000 shares
    }
}

#[tokio::test]
async fn test_single_oracle_returns_valid_signed_response() {
    // Setup: ITP registry with one ITP
    let itp_address: Address = "0xaaaa111111111111111111111111111111111111"
        .parse()
        .unwrap();
    let mut registry = MockItpRegistry::new();
    registry.add_itp(itp_address, test_itp_info());

    // Setup: NAV calculator that returns 1.0 (10^18)
    let nav_calculator = MockNavCalculator::one();

    // Setup: BLS keypair
    let keypair = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();

    // Create handler
    let handler = NavSignHandler::new(
        nav_calculator,
        registry,
        Some(keypair.clone()),
        1, // oracle_id
        42, // initial cycle
    );

    // Make request
    let request = oracle::api::NavSignRequest { itp: itp_address };
    let response = handler.handle(&request).await.unwrap();

    // Verify response fields
    assert!(response.itp_address.contains("0xaaaa1111"));
    assert!(!response.price.is_empty());
    assert_eq!(response.cycle_number, 42);
    assert_eq!(response.oracle_id, 1);
    assert!(response.bls_signature.starts_with("0x"));
    assert!(response.pubkey.starts_with("0x"));

    // Verify price is 1.0 scaled to 36 decimals
    let expected_price_36 = U256::exp10(36);
    // Note: U256::parse() interprets as hex, must use from_dec_str for decimal
    let actual_price = U256::from_dec_str(&response.price).unwrap();
    assert_eq!(actual_price, expected_price_36);

    // Verify signature is valid
    let signer = Bn254BLSSigner::new();
    let message_hash = build_nav_message_hash(
        itp_address,
        actual_price,
        response.timestamp,
        response.cycle_number,
    );

    let signature_bytes = hex::decode(&response.bls_signature[2..]).unwrap();
    let signature = common::types::BLSSignature(signature_bytes);

    let valid = signer
        .verify_message_hash(&keypair.public_key(), &message_hash, &signature)
        .unwrap();
    assert!(valid, "BLS signature should be valid");
}

#[tokio::test]
async fn test_three_oracles_return_matching_data() {
    // Setup: ITP address for all handlers
    let itp_address: Address = "0xaaaa111111111111111111111111111111111111"
        .parse()
        .unwrap();

    // Create 3 oracles with different keypairs
    let kp1 = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();
    let kp2 = BLSKeyPair::from_seed(&[2u8; 32]).unwrap();
    let kp3 = BLSKeyPair::from_seed(&[3u8; 32]).unwrap();

    let cycle_number = 100;

    // Create handlers (each wraps the same registry)
    let handler1 = NavSignHandler::new(
        MockNavCalculator::one(),
        MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
        Some(kp1.clone()),
        1,
        cycle_number,
    );
    let handler2 = NavSignHandler::new(
        MockNavCalculator::one(),
        MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
        Some(kp2.clone()),
        2,
        cycle_number,
    );
    let handler3 = NavSignHandler::new(
        MockNavCalculator::one(),
        MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
        Some(kp3.clone()),
        3,
        cycle_number,
    );

    let request = oracle::api::NavSignRequest { itp: itp_address };

    // Get responses from all 3 oracles
    let r1 = handler1.handle(&request).await.unwrap();
    let r2 = handler2.handle(&request).await.unwrap();
    let r3 = handler3.handle(&request).await.unwrap();

    // AC4: All 3 should have matching price and cycleNumber
    assert_eq!(r1.price, r2.price);
    assert_eq!(r2.price, r3.price);
    assert_eq!(r1.cycle_number, r2.cycle_number);
    assert_eq!(r2.cycle_number, r3.cycle_number);

    // Different oracle IDs
    assert_ne!(r1.oracle_id, r2.oracle_id);
    assert_ne!(r2.oracle_id, r3.oracle_id);

    // Different signatures (same message, different keys)
    assert_ne!(r1.bls_signature, r2.bls_signature);
    assert_ne!(r2.bls_signature, r3.bls_signature);
}

#[tokio::test]
async fn test_aggregate_signatures_verify_against_aggregated_pubkey() {
    // Setup
    let itp_address: Address = "0xaaaa111111111111111111111111111111111111"
        .parse()
        .unwrap();

    let kp1 = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();
    let kp2 = BLSKeyPair::from_seed(&[2u8; 32]).unwrap();
    let kp3 = BLSKeyPair::from_seed(&[3u8; 32]).unwrap();

    let cycle_number = 100u64;

    // Create handlers
    let handler1 = NavSignHandler::new(
        MockNavCalculator::one(),
        MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
        Some(kp1.clone()),
        1,
        cycle_number,
    );
    let handler2 = NavSignHandler::new(
        MockNavCalculator::one(),
        MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
        Some(kp2.clone()),
        2,
        cycle_number,
    );
    let handler3 = NavSignHandler::new(
        MockNavCalculator::one(),
        MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
        Some(kp3.clone()),
        3,
        cycle_number,
    );

    let request = oracle::api::NavSignRequest { itp: itp_address };

    let r1 = handler1.handle(&request).await.unwrap();
    let r2 = handler2.handle(&request).await.unwrap();
    let r3 = handler3.handle(&request).await.unwrap();

    // Parse signatures
    let sig1_bytes = hex::decode(&r1.bls_signature[2..]).unwrap();
    let sig2_bytes = hex::decode(&r2.bls_signature[2..]).unwrap();
    let sig3_bytes = hex::decode(&r3.bls_signature[2..]).unwrap();

    let sig1 = common::types::BLSSignature(sig1_bytes);
    let sig2 = common::types::BLSSignature(sig2_bytes);
    let sig3 = common::types::BLSSignature(sig3_bytes);

    // AC5: Aggregate individual signatures
    let signer = Bn254BLSSigner::new();
    let agg_sig = BLSSigner::aggregate_signatures(&signer, vec![sig1, sig2, sig3]).unwrap();

    // AC6: Aggregate public keys
    let agg_pk = aggregate_pubkeys(&[kp1.public_key(), kp2.public_key(), kp3.public_key()]).unwrap();

    // Build message hash (same for all)
    let price = U256::from_dec_str(&r1.price).unwrap();
    let message_hash = build_nav_message_hash(itp_address, price, r1.timestamp, r1.cycle_number);

    // Verify aggregate signature with aggregate pubkey
    let valid = signer
        .verify_message_hash(&agg_pk, &message_hash, &agg_sig)
        .unwrap();
    assert!(
        valid,
        "Aggregated signature should verify against aggregated pubkey"
    );
}

#[tokio::test]
async fn test_unknown_itp_returns_404() {
    let registry = MockItpRegistry::new(); // Empty registry
    let nav_calculator = MockNavCalculator::one();
    let keypair = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();

    let handler = NavSignHandler::new(nav_calculator, registry, Some(keypair), 1, 42);

    let unknown_itp: Address = "0xdead000000000000000000000000000000000000"
        .parse()
        .unwrap();
    let request = oracle::api::NavSignRequest { itp: unknown_itp };

    let result = handler.handle(&request).await;
    assert!(result.is_err());

    if let Err(e) = result {
        assert_eq!(e.status_code(), 404);
    }
}

#[tokio::test]
async fn test_no_bls_keypair_returns_503() {
    let itp_address: Address = "0xaaaa111111111111111111111111111111111111"
        .parse()
        .unwrap();
    let mut registry = MockItpRegistry::new();
    registry.add_itp(itp_address, test_itp_info());

    let nav_calculator = MockNavCalculator::one();

    // No BLS keypair
    let handler = NavSignHandler::new(nav_calculator, registry, None, 1, 42);

    let request = oracle::api::NavSignRequest { itp: itp_address };
    let result = handler.handle(&request).await;

    assert!(result.is_err());
    if let Err(e) = result {
        assert_eq!(e.status_code(), 503);
    }
}

#[tokio::test]
async fn test_concurrent_requests_return_identical_data() {
    let itp_address: Address = "0xaaaa111111111111111111111111111111111111"
        .parse()
        .unwrap();

    // Shared handler
    let handler = Arc::new(NavSignHandler::new(
        MockNavCalculator::one(),
        MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
        Some(BLSKeyPair::from_seed(&[1u8; 32]).unwrap()),
        1,
        42,
    ));

    let request = oracle::api::NavSignRequest { itp: itp_address };

    // Spawn 10 concurrent requests
    let mut handles = vec![];
    for _ in 0..10 {
        let h = handler.clone();
        let r = request.clone();
        handles.push(tokio::spawn(async move { h.handle(&r).await.unwrap() }));
    }

    // Wait for all
    let mut results = vec![];
    for handle in handles {
        results.push(handle.await.unwrap());
    }

    // AC3: All should have identical price and cycleNumber (cached)
    let first_price = &results[0].price;
    let first_cycle = results[0].cycle_number;
    let first_timestamp = results[0].timestamp;
    let first_sig = &results[0].bls_signature;

    for r in &results[1..] {
        assert_eq!(&r.price, first_price, "Price should be identical");
        assert_eq!(r.cycle_number, first_cycle, "Cycle number should be identical");
        assert_eq!(r.timestamp, first_timestamp, "Timestamp should be cached");
        assert_eq!(&r.bls_signature, first_sig, "Signature should be cached");
    }
}

/// AC2: Malformed ITP address returns HTTP 400 Bad Request
#[tokio::test]
async fn test_malformed_address_returns_400() {
    use oracle::api::handle_nav_sign_request;

    let itp_address: Address = "0xaaaa111111111111111111111111111111111111"
        .parse()
        .unwrap();

    let handler = NavSignHandler::new(
        MockNavCalculator::one(),
        MockItpRegistry::new_with_itp(itp_address, test_itp_info()),
        Some(BLSKeyPair::from_seed(&[1u8; 32]).unwrap()),
        1,
        42,
    );

    // Test malformed address (not a valid hex)
    let (status, _content_type, _body) = handle_nav_sign_request(&handler, "itp=notanaddress").await;
    assert_eq!(status, 400, "Malformed address should return 400 Bad Request");

    // Test missing itp parameter
    let (status, _content_type, _body) = handle_nav_sign_request(&handler, "foo=bar").await;
    assert_eq!(status, 400, "Missing itp parameter should return 400 Bad Request");

    // Test empty query string
    let (status, _content_type, _body) = handle_nav_sign_request(&handler, "").await;
    assert_eq!(status, 400, "Empty query string should return 400 Bad Request");

    // Test partial/truncated address
    let (status, _content_type, _body) = handle_nav_sign_request(&handler, "itp=0x1234").await;
    assert_eq!(status, 400, "Truncated address should return 400 Bad Request");
}

// Helper impl for MockItpRegistry
impl MockItpRegistry {
    fn new_with_itp(address: Address, info: ItpInfo) -> Self {
        let mut registry = Self::new();
        registry.add_itp(address, info);
        registry
    }
}
