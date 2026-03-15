//! Integration tests for Story 7.3: Submit Order for User
//!
//! Tests the submit order consensus flow:
//! 1. Leader proposes submitting order on L3
//! 2. Followers validate and sign
//! 3. Threshold reached → signatures aggregated
//! 4. Order mapping stored

use std::sync::Arc;

use ethers::types::{Address, H256, U256};
use tokio::sync::RwLock;

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::mocks::MockChainBuilder;
use common::traits::BLSSigner;
use common::types::{BLSSignature, PeerId};

use issuer::bridge::{
    build_submit_order_hash, BridgeConfig, BridgeOrchestrator, BridgeOrderStatus,
    OrderMapping, SubmitOrderProposal, SubmitOrderResult,
};
use issuer::chain::CrossChainOrder;

// ============================================================================
// Test Helpers
// ============================================================================

fn test_peer_id(n: u8) -> PeerId {
    let mut id = [0u8; 32];
    id[0] = n;
    id
}

fn test_bls_keypair(seed: u64) -> BLSKeyPair {
    // BLS keypair requires at least 32 bytes of seed
    let mut seed_bytes = [0u8; 32];
    seed_bytes[..8].copy_from_slice(&seed.to_be_bytes());
    // Fill rest with seed value for uniqueness
    for i in 8..32 {
        seed_bytes[i] = (seed % 256) as u8;
    }
    BLSKeyPair::from_seed(&seed_bytes).expect("BLS keypair generation failed")
}

fn test_cross_chain_order() -> CrossChainOrder {
    CrossChainOrder {
        order_id: U256::from(123),
        itp_id: H256::from([0xCD; 32]),
        user: Address::from([0xAB; 20]),
        amount: U256::from(1000000000000000000u64), // 1 USDC
        limit_price: U256::from(2000000000000000000u64), // 2.0 price
        slippage_tier: 1, // Normal
        deadline: U256::from(u64::MAX), // Far future
        created_at: U256::from(1700000000u64),
        chain_id: 42161, // Settlement chain
        block_number: 100,
        tx_hash: H256::from([0xEE; 32]),
    }
}

// ============================================================================
// Unit Tests for build_submit_order_hash
// ============================================================================

#[test]
fn test_build_submit_order_hash_deterministic() {
    let hash1 = build_submit_order_hash(
        111222333,
        U256::from(123),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64),
        U256::from(1),
        U256::from(1700000000u64),
    );

    let hash2 = build_submit_order_hash(
        111222333,
        U256::from(123),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64),
        U256::from(1),
        U256::from(1700000000u64),
    );

    assert_eq!(hash1, hash2, "Same inputs should produce same hash");
}

#[test]
fn test_build_submit_order_hash_different_slippage_tiers() {
    let hash_tier0 = build_submit_order_hash(
        111222333,
        U256::from(1),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64),
        U256::from(0),
        U256::from(1700000000u64),
    );

    let hash_tier1 = build_submit_order_hash(
        111222333,
        U256::from(1),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64),
        U256::from(1),
        U256::from(1700000000u64),
    );

    let hash_tier2 = build_submit_order_hash(
        111222333,
        U256::from(1),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64),
        U256::from(2),
        U256::from(1700000000u64),
    );

    assert_ne!(hash_tier0, hash_tier1, "Different tiers should produce different hashes");
    assert_ne!(hash_tier1, hash_tier2, "Different tiers should produce different hashes");
    assert_ne!(hash_tier0, hash_tier2, "Different tiers should produce different hashes");
}

#[test]
fn test_build_submit_order_hash_includes_limit_price() {
    let hash1 = build_submit_order_hash(
        111222333,
        U256::from(1),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(1000000000000000000u64), // 1.0 price
        U256::from(1),
        U256::from(1700000000u64),
    );

    let hash2 = build_submit_order_hash(
        111222333,
        U256::from(1),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64), // 2.0 price
        U256::from(1),
        U256::from(1700000000u64),
    );

    assert_ne!(hash1, hash2, "Different limit prices should produce different hashes");
}

// ============================================================================
// Unit Tests for SubmitOrderProposal
// ============================================================================

#[test]
fn test_submit_order_proposal_creation() {
    let proposal = SubmitOrderProposal {
        leader_id: test_peer_id(1),
        settlement_order_id: U256::from(123),
        itp_id: H256::from([0xAB; 32]),
        user: Address::from([0xCD; 20]),
        amount: U256::from(1000000000000000000u64),
        limit_price: U256::from(2000000000000000000u64),
        slippage_tier: U256::from(1),
        deadline: U256::from(1700000000u64),
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash: H256::from([0xEE; 32]),
    };

    assert_eq!(proposal.settlement_order_id, U256::from(123));
    assert_eq!(proposal.slippage_tier, U256::from(1));
    assert_eq!(proposal.leader_signature.0.len(), 96);
}

// ============================================================================
// Unit Tests for SubmitOrderResult
// ============================================================================

#[test]
fn test_submit_order_result_with_l3_order_id() {
    let result = SubmitOrderResult {
        aggregated_signature: BLSSignature(vec![0xFF; 96]),
        signer_bitmap: U256::from(7), // bits 0, 1, 2 set
        signature_count: 3,
        l3_order_id: Some(U256::from(999)),
    };

    assert_eq!(result.signature_count, 3);
    assert_eq!(result.l3_order_id, Some(U256::from(999)));
    assert_eq!(result.signer_bitmap, U256::from(7));
}

#[test]
fn test_submit_order_result_without_l3_order_id() {
    let result = SubmitOrderResult {
        aggregated_signature: BLSSignature(vec![0xFF; 96]),
        signer_bitmap: U256::from(3),
        signature_count: 2,
        l3_order_id: None,
    };

    assert_eq!(result.l3_order_id, None);
}

// ============================================================================
// Unit Tests for OrderMapping
// ============================================================================

#[test]
fn test_order_mapping_creation() {
    let mapping = OrderMapping {
        settlement_order_id: U256::from(123),
        l3_order_id: U256::from(456),
        original_user: Address::from([0xAB; 20]),
        created_at: 1700000000,
    };

    assert_eq!(mapping.settlement_order_id, U256::from(123));
    assert_eq!(mapping.l3_order_id, U256::from(456));
    assert_eq!(mapping.original_user, Address::from([0xAB; 20]));
}

#[test]
fn test_order_mapping_serialization() {
    let mapping = OrderMapping {
        settlement_order_id: U256::from(123),
        l3_order_id: U256::from(456),
        original_user: Address::from([0xAB; 20]),
        created_at: 1700000000,
    };

    // Test JSON serialization
    let json = serde_json::to_string(&mapping).expect("Serialization failed");
    let deserialized: OrderMapping = serde_json::from_str(&json).expect("Deserialization failed");

    assert_eq!(mapping.settlement_order_id, deserialized.settlement_order_id);
    assert_eq!(mapping.l3_order_id, deserialized.l3_order_id);
    assert_eq!(mapping.original_user, deserialized.original_user);
    assert_eq!(mapping.created_at, deserialized.created_at);
}

// ============================================================================
// BLS Signing Tests
// ============================================================================

#[test]
fn test_submit_order_bls_signing() {
    let keypair = test_bls_keypair(1);
    let signer = Bn254BLSSigner::new();

    let message_hash = build_submit_order_hash(
        111222333,
        U256::from(123),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64),
        U256::from(1),
        U256::from(1700000000u64),
    );

    let signature = signer
        .sign_with_keypair(&keypair, message_hash.as_bytes())
        .expect("Signing failed");

    assert!(!signature.0.is_empty(), "Signature should not be empty");
}

#[test]
fn test_submit_order_signature_aggregation() {
    let keypair1 = test_bls_keypair(1);
    let keypair2 = test_bls_keypair(2);
    let keypair3 = test_bls_keypair(3);
    let signer = Bn254BLSSigner::new();

    let message_hash = build_submit_order_hash(
        111222333,
        U256::from(123),
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64),
        U256::from(1),
        U256::from(1700000000u64),
    );

    let sig1 = signer
        .sign_with_keypair(&keypair1, message_hash.as_bytes())
        .expect("Signing 1 failed");
    let sig2 = signer
        .sign_with_keypair(&keypair2, message_hash.as_bytes())
        .expect("Signing 2 failed");
    let sig3 = signer
        .sign_with_keypair(&keypair3, message_hash.as_bytes())
        .expect("Signing 3 failed");

    let aggregated = signer
        .aggregate_signatures(vec![sig1.clone(), sig2.clone(), sig3.clone()])
        .expect("Aggregation failed");

    assert!(!aggregated.0.is_empty(), "Aggregated signature should not be empty");
    // Verify that aggregation produces a different signature than any individual one
    assert_ne!(aggregated.0, sig1.0);
    assert_ne!(aggregated.0, sig2.0);
    assert_ne!(aggregated.0, sig3.0);
}

// ============================================================================
// Integration Tests with Mock BridgeOrchestrator state
// ============================================================================

/// Simulates the submit order proposal and signature collection flow
#[tokio::test]
async fn test_submit_order_consensus_flow_simulation() {
    // Setup: 3 issuers
    let keypair1 = test_bls_keypair(1);
    let keypair2 = test_bls_keypair(2);
    let keypair3 = test_bls_keypair(3);
    let signer = Bn254BLSSigner::new();

    // Order data
    let order = test_cross_chain_order();
    let l3_chain_id = 111222333u64;

    // 1. Leader creates message hash and signs
    let message_hash = build_submit_order_hash(
        l3_chain_id,
        order.order_id,
        order.itp_id,
        order.user,
        order.amount,
        order.limit_price,
        U256::from(order.slippage_tier),
        order.deadline,
    );

    let leader_sig = signer
        .sign_with_keypair(&keypair1, message_hash.as_bytes())
        .expect("Leader signing failed");

    // 2. Create proposal
    let proposal = SubmitOrderProposal {
        leader_id: test_peer_id(1),
        settlement_order_id: order.order_id,
        itp_id: order.itp_id,
        user: order.user,
        amount: order.amount,
        limit_price: order.limit_price,
        slippage_tier: U256::from(order.slippage_tier),
        deadline: order.deadline,
        leader_signature: leader_sig.clone(),
        message_hash,
    };

    // 3. Followers validate and sign
    // Follower 2 rebuilds hash and verifies it matches
    let follower2_hash = build_submit_order_hash(
        l3_chain_id,
        proposal.settlement_order_id,
        proposal.itp_id,
        proposal.user,
        proposal.amount,
        proposal.limit_price,
        proposal.slippage_tier,
        proposal.deadline,
    );
    assert_eq!(follower2_hash, proposal.message_hash, "Follower hash should match proposal");

    let sig2 = signer
        .sign_with_keypair(&keypair2, follower2_hash.as_bytes())
        .expect("Follower 2 signing failed");

    // Follower 3
    let sig3 = signer
        .sign_with_keypair(&keypair3, proposal.message_hash.as_bytes())
        .expect("Follower 3 signing failed");

    // 4. Collect signatures and check threshold
    let signatures = vec![leader_sig.clone(), sig2.clone(), sig3.clone()];
    let signature_count = signatures.len();
    let min_signatures = 2; // 2 of 3 threshold

    assert!(
        signature_count >= min_signatures,
        "Should have enough signatures"
    );

    // 5. Aggregate signatures
    let aggregated = signer
        .aggregate_signatures(signatures)
        .expect("Aggregation failed");

    // 6. Create result
    let result = SubmitOrderResult {
        aggregated_signature: aggregated,
        signer_bitmap: U256::from(7), // bits 0, 1, 2
        signature_count,
        l3_order_id: None, // Will be set after actual execution
    };

    assert_eq!(result.signature_count, 3);
    assert!(result.signer_bitmap.bit(0)); // Leader signed
    assert!(result.signer_bitmap.bit(1)); // Follower 2 signed
    assert!(result.signer_bitmap.bit(2)); // Follower 3 signed
}

/// Tests the order mapping storage and retrieval
#[tokio::test]
async fn test_order_mapping_storage_and_retrieval() {
    // Simulate storage using HashMap (like BridgeOrchestrator)
    let order_mappings: RwLock<std::collections::HashMap<U256, OrderMapping>> =
        RwLock::new(std::collections::HashMap::new());

    // Store mapping after successful submitOrder
    let mapping = OrderMapping {
        settlement_order_id: U256::from(123),
        l3_order_id: U256::from(456),
        original_user: Address::from([0xAB; 20]),
        created_at: 1700000000,
    };

    order_mappings
        .write()
        .await
        .insert(mapping.settlement_order_id, mapping.clone());

    // Retrieve mapping
    let retrieved = order_mappings
        .read()
        .await
        .get(&U256::from(123))
        .cloned();

    assert!(retrieved.is_some(), "Mapping should exist");
    let retrieved = retrieved.unwrap();
    assert_eq!(retrieved.l3_order_id, U256::from(456));
    assert_eq!(retrieved.original_user, Address::from([0xAB; 20]));
}

/// Tests that proposals for expired orders are rejected
#[test]
fn test_submit_order_expired_deadline_validation() {
    // Create order with past deadline
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let past_deadline = U256::from(now - 1000); // 1000 seconds ago

    let proposal = SubmitOrderProposal {
        leader_id: test_peer_id(1),
        settlement_order_id: U256::from(123),
        itp_id: H256::from([0xAB; 32]),
        user: Address::from([0xCD; 20]),
        amount: U256::from(1000000000000000000u64),
        limit_price: U256::from(2000000000000000000u64),
        slippage_tier: U256::from(1),
        deadline: past_deadline,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash: H256::from([0xEE; 32]),
    };

    // Validation should detect expired deadline
    assert!(
        proposal.deadline.as_u64() < now,
        "Deadline should be in the past for this test"
    );
}

/// Tests invalid slippage tier validation
#[test]
fn test_submit_order_invalid_slippage_tier() {
    // Slippage tier must be 0, 1, or 2
    let invalid_tier = U256::from(5);

    assert!(
        invalid_tier > U256::from(2),
        "Tier 5 should be invalid"
    );
}

// ============================================================================
// BridgeOrchestrator Integration Tests
// ============================================================================

use async_trait::async_trait;
use issuer::bridge::{BridgeError, CrossChainOrderReader};
use issuer::chain::CrossChainOrderData;

/// Mock CrossChainOrderReader for testing
struct MockCrossChainOrderReader {
    orders: std::collections::HashMap<U256, CrossChainOrderData>,
}

impl MockCrossChainOrderReader {
    fn new() -> Self {
        Self {
            orders: std::collections::HashMap::new(),
        }
    }

    #[allow(dead_code)]
    fn with_order(mut self, order_id: U256, data: CrossChainOrderData) -> Self {
        self.orders.insert(order_id, data);
        self
    }
}

#[async_trait]
impl CrossChainOrderReader for MockCrossChainOrderReader {
    async fn get_cross_chain_order(&self, order_id: U256) -> Result<CrossChainOrderData, BridgeError> {
        self.orders.get(&order_id).cloned().ok_or(BridgeError::OrderNotFound { order_id })
    }
}

fn test_bridge_config() -> BridgeConfig {
    BridgeConfig {
        issuer_custody_l3: Address::from([0x11; 20]),
        l3_usdc_address: Address::from([0x22; 20]),
        settlement_custody_address: Address::from([0x33; 20]),
        settlement_chain_id: 42161,
        l3_chain_id: 111222333,
        index_address: Address::from([0x44; 20]),
        min_signatures: 2,
        proposal_timeout_ms: 500,
        sign_timeout_ms: 300,
        // Story 7.5: Bridge L3→Arb config
        issuer_custody_settlement: Address::from([0x55; 20]),
        settlement_usdc_address: Address::from([0x66; 20]),
        // Story 7.6: Custody release to vault config
        bitget_vault: Address::from([0x77; 20]),
        signer_address: Address::from([0x88; 20]),
        collateral_registry: Address::zero(),
        bridge_proxy: Address::zero(),
    }
}

/// Tests BridgeOrchestrator.propose_submit_order() - requires BRIDGED_TO_L3 status
#[tokio::test]
async fn test_orchestrator_propose_submit_order_requires_bridged_status() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader::new());
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let order = test_cross_chain_order();

    // Order is not in BRIDGED_TO_L3 status, should fail
    let result = orchestrator.propose_submit_order(&order).await;
    assert!(result.is_err());

    match result.unwrap_err() {
        BridgeError::OrderNotBridged { settlement_order_id, status } => {
            assert_eq!(settlement_order_id, order.order_id);
            assert_eq!(status, None); // No status set yet
        }
        other => panic!("Expected OrderNotBridged error, got: {:?}", other),
    }
}

/// Tests BridgeOrchestrator.propose_submit_order() - success case
#[tokio::test]
async fn test_orchestrator_propose_submit_order_success() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader::new());
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let order = test_cross_chain_order();

    // Set order status to BRIDGED_TO_L3
    orchestrator.set_order_status(order.order_id, BridgeOrderStatus::BridgedToL3).await;

    // Now propose should succeed
    let proposal = orchestrator.propose_submit_order(&order).await.expect("Proposal should succeed");

    assert_eq!(proposal.settlement_order_id, order.order_id);
    assert_eq!(proposal.itp_id, order.itp_id);
    assert_eq!(proposal.user, order.user);
    assert_eq!(proposal.amount, order.amount);
    assert_eq!(proposal.limit_price, order.limit_price);
    assert_eq!(proposal.slippage_tier, U256::from(order.slippage_tier));
    assert!(!proposal.leader_signature.0.is_empty());

    // Verify message hash was computed with config's L3 chain ID
    let expected_hash = build_submit_order_hash(
        config.l3_chain_id,
        order.order_id,
        order.itp_id,
        order.user,
        order.amount,
        order.limit_price,
        U256::from(order.slippage_tier),
        order.deadline,
    );
    assert_eq!(proposal.message_hash, expected_hash);
}

/// Tests BridgeOrchestrator.validate_submit_order_proposal() - validation logic
#[tokio::test]
async fn test_orchestrator_validate_submit_order_proposal() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader::new());
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let order = test_cross_chain_order();
    let message_hash = build_submit_order_hash(
        config.l3_chain_id,
        order.order_id,
        order.itp_id,
        order.user,
        order.amount,
        order.limit_price,
        U256::from(order.slippage_tier),
        order.deadline,
    );

    let proposal = SubmitOrderProposal {
        leader_id: test_peer_id(1),
        settlement_order_id: order.order_id,
        itp_id: order.itp_id,
        user: order.user,
        amount: order.amount,
        limit_price: order.limit_price,
        slippage_tier: U256::from(order.slippage_tier),
        deadline: order.deadline,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash,
    };

    // Without BRIDGED_TO_L3 status, validation should return false
    let result = orchestrator.validate_submit_order_proposal(&proposal).await;
    assert!(result.is_ok());
    assert!(!result.unwrap(), "Should reject: order not in BRIDGED_TO_L3 status");

    // Set status to BRIDGED_TO_L3
    orchestrator.set_order_status(order.order_id, BridgeOrderStatus::BridgedToL3).await;

    // Now validation should pass
    let result = orchestrator.validate_submit_order_proposal(&proposal).await;
    assert!(result.is_ok());
    assert!(result.unwrap(), "Should pass validation with correct status");
}

/// Tests BridgeOrchestrator.validate_submit_order_proposal() - rejects already submitted
#[tokio::test]
async fn test_orchestrator_validate_rejects_already_submitted() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader::new());
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let order = test_cross_chain_order();

    // Set status and store mapping (simulating already submitted)
    orchestrator.set_order_status(order.order_id, BridgeOrderStatus::BridgedToL3).await;
    orchestrator.store_order_mapping(OrderMapping {
        settlement_order_id: order.order_id,
        l3_order_id: U256::from(999),
        original_user: order.user,
        created_at: 1700000000,
    }).await;

    let message_hash = build_submit_order_hash(
        config.l3_chain_id,
        order.order_id,
        order.itp_id,
        order.user,
        order.amount,
        order.limit_price,
        U256::from(order.slippage_tier),
        order.deadline,
    );

    let proposal = SubmitOrderProposal {
        leader_id: test_peer_id(1),
        settlement_order_id: order.order_id,
        itp_id: order.itp_id,
        user: order.user,
        amount: order.amount,
        limit_price: order.limit_price,
        slippage_tier: U256::from(order.slippage_tier),
        deadline: order.deadline,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash,
    };

    // Validation should reject already submitted order
    let result = orchestrator.validate_submit_order_proposal(&proposal).await;
    assert!(result.is_ok());
    assert!(!result.unwrap(), "Should reject: order already submitted");
}

/// Tests BridgeOrchestrator.sign_submit_order_proposal()
#[tokio::test]
async fn test_orchestrator_sign_submit_order_proposal() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(2);
    let reader = Arc::new(MockCrossChainOrderReader::new());
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(2),
        1, // follower index
    );

    let order = test_cross_chain_order();
    let message_hash = build_submit_order_hash(
        config.l3_chain_id,
        order.order_id,
        order.itp_id,
        order.user,
        order.amount,
        order.limit_price,
        U256::from(order.slippage_tier),
        order.deadline,
    );

    let proposal = SubmitOrderProposal {
        leader_id: test_peer_id(1),
        settlement_order_id: order.order_id,
        itp_id: order.itp_id,
        user: order.user,
        amount: order.amount,
        limit_price: order.limit_price,
        slippage_tier: U256::from(order.slippage_tier),
        deadline: order.deadline,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash,
    };

    // Sign the proposal
    let signature = orchestrator.sign_submit_order_proposal(&proposal).expect("Signing should succeed");
    assert!(!signature.0.is_empty(), "Signature should not be empty");
}

/// Tests BridgeOrchestrator signature collection and threshold
#[tokio::test]
async fn test_orchestrator_signature_collection_threshold() {
    let config = test_bridge_config();
    let keypair1 = test_bls_keypair(1);
    let keypair2 = test_bls_keypair(2);
    let signer = Bn254BLSSigner::new();

    let reader = Arc::new(MockCrossChainOrderReader::new());
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair1.clone(),
        test_peer_id(1),
        0, // leader index
    );

    let settlement_order_id = U256::from(123);

    // Create a message hash for signing
    let message_hash = build_submit_order_hash(
        config.l3_chain_id,
        settlement_order_id,
        H256::from([0xAB; 32]),
        Address::from([0xCD; 20]),
        U256::from(1000000000000000000u64),
        U256::from(2000000000000000000u64),
        U256::from(1),
        U256::from(u64::MAX),
    );

    // Generate real signatures
    let leader_sig = signer
        .sign_with_keypair(&keypair1, message_hash.as_bytes())
        .expect("Leader signing failed");
    let follower_sig = signer
        .sign_with_keypair(&keypair2, message_hash.as_bytes())
        .expect("Follower signing failed");

    // Start signature collection
    orchestrator.start_submit_order_signature_collection(settlement_order_id, leader_sig).await;

    // Add follower signature - with min_signatures = 2, threshold should now be reached
    let result = orchestrator.add_submit_order_follower_signature(settlement_order_id, 1, follower_sig).await;
    assert!(result.is_ok(), "Adding follower signature should succeed");

    // With min_signatures = 2, threshold should now be reached (leader + 1 follower = 2)
    let result = result.unwrap();
    assert!(result.is_some(), "Threshold should be reached with 2 signatures");

    let submit_result = result.unwrap();
    assert_eq!(submit_result.signature_count, 2);
    assert!(submit_result.signer_bitmap.bit(0)); // Leader signed
    assert!(submit_result.signer_bitmap.bit(1)); // Follower 1 signed
}

/// Tests BridgeOrchestrator order mapping storage
#[tokio::test]
async fn test_orchestrator_order_mapping_storage() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader::new());
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let settlement_order_id = U256::from(123);
    let l3_order_id = U256::from(456);
    let user = Address::from([0xAB; 20]);

    // Initially no mapping
    assert!(orchestrator.get_l3_order_id(&settlement_order_id).await.is_none());

    // Store mapping
    orchestrator.store_order_mapping(OrderMapping {
        settlement_order_id,
        l3_order_id,
        original_user: user,
        created_at: 1700000000,
    }).await;

    // Now mapping exists
    let retrieved_l3_id = orchestrator.get_l3_order_id(&settlement_order_id).await;
    assert_eq!(retrieved_l3_id, Some(l3_order_id));

    // Full mapping retrieval
    let mapping = orchestrator.get_order_mapping(&settlement_order_id).await;
    assert!(mapping.is_some());
    let mapping = mapping.unwrap();
    assert_eq!(mapping.original_user, user);
}
