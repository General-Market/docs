//! Integration tests for Story 7.4: Batch and Fill Orchestration
//!
//! Tests the batch and fill consensus flows:
//! 1. Leader proposes batch confirmation with order IDs and prices
//! 2. Followers validate and sign
//! 3. Threshold reached → signatures aggregated
//! 4. Leader proposes fills confirmation
//! 5. Fills validated and confirmed

use std::sync::Arc;

use ethers::types::{Address, H256, U256};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::mocks::MockChainBuilder;
use common::traits::BLSSigner;
use common::types::{BLSSignature, PeerId};

use issuer::bridge::{
    build_confirm_batch_hash, build_confirm_fills_hash, BatchProposal, BatchResult,
    BridgeConfig, BridgeError, BridgeOrchestrator, BridgeOrderStatus, Fill, FillsProposal,
    FillsResult,
};

// ============================================================================
// Test Helpers
// ============================================================================

fn test_peer_id(n: u8) -> PeerId {
    let mut id = [0u8; 32];
    id[0] = n;
    id
}

fn test_bls_keypair(seed: u64) -> BLSKeyPair {
    let mut seed_bytes = [0u8; 32];
    seed_bytes[..8].copy_from_slice(&seed.to_be_bytes());
    for i in 8..32 {
        seed_bytes[i] = (seed % 256) as u8;
    }
    BLSKeyPair::from_seed(&seed_bytes).expect("BLS keypair generation failed")
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

// ============================================================================
// Hash Builder Tests
// ============================================================================

#[test]
fn test_build_confirm_batch_hash_deterministic() {
    let addr = Address::zero();
    let hash1 = build_confirm_batch_hash(
        111222333,
        addr,
        42,
        &[U256::from(1), U256::from(2), U256::from(3)],
    );

    let hash2 = build_confirm_batch_hash(
        111222333,
        addr,
        42,
        &[U256::from(1), U256::from(2), U256::from(3)],
    );

    assert_eq!(hash1, hash2, "Same inputs should produce same hash");
}

#[test]
fn test_build_confirm_batch_hash_different_cycles() {
    let addr = Address::zero();
    let hash1 = build_confirm_batch_hash(111222333, addr, 1, &[U256::from(1)]);
    let hash2 = build_confirm_batch_hash(111222333, addr, 2, &[U256::from(1)]);

    assert_ne!(hash1, hash2, "Different cycles should produce different hashes");
}

#[test]
fn test_build_confirm_fills_hash_deterministic() {
    let fills = vec![
        Fill {
            order_id: U256::from(1),
            fill_price: U256::from(1500000000000000000u64),
            fill_amount: U256::from(1000000000000000000u64),
        },
    ];

    let addr = Address::zero();
    let hash1 = build_confirm_fills_hash(111222333, addr, 42, &fills);
    let hash2 = build_confirm_fills_hash(111222333, addr, 42, &fills);

    assert_eq!(hash1, hash2, "Same inputs should produce same hash");
}

#[test]
fn test_build_confirm_fills_hash_different_prices() {
    let fills1 = vec![Fill {
        order_id: U256::from(1),
        fill_price: U256::from(1000000000000000000u64),
        fill_amount: U256::from(500000000000000000u64),
    }];

    let fills2 = vec![Fill {
        order_id: U256::from(1),
        fill_price: U256::from(2000000000000000000u64),
        fill_amount: U256::from(500000000000000000u64),
    }];

    let addr = Address::zero();
    let hash1 = build_confirm_fills_hash(111222333, addr, 1, &fills1);
    let hash2 = build_confirm_fills_hash(111222333, addr, 1, &fills2);

    assert_ne!(hash1, hash2, "Different fill prices should produce different hashes");
}

// ============================================================================
// BatchProposal Tests
// ============================================================================

#[test]
fn test_batch_proposal_creation() {
    let proposal = BatchProposal {
        leader_id: test_peer_id(1),
        cycle_number: 42,
        order_ids: vec![U256::from(1), U256::from(2)],
        prices: vec![U256::from(1000000000000000000u64), U256::from(2000000000000000000u64)],
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash: H256::from([0xEE; 32]),
    };

    assert_eq!(proposal.cycle_number, 42);
    assert_eq!(proposal.order_ids.len(), 2);
    assert_eq!(proposal.prices.len(), 2);
}

// ============================================================================
// FillsProposal Tests
// ============================================================================

#[test]
fn test_fills_proposal_creation() {
    let proposal = FillsProposal {
        leader_id: test_peer_id(1),
        cycle_number: 42,
        fills: vec![
            Fill {
                order_id: U256::from(1),
                fill_price: U256::from(1500000000000000000u64),
                fill_amount: U256::from(1000000000000000000u64),
            },
        ],
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash: H256::from([0xEE; 32]),
    };

    assert_eq!(proposal.cycle_number, 42);
    assert_eq!(proposal.fills.len(), 1);
    assert_eq!(proposal.fills[0].fill_price, U256::from(1500000000000000000u64));
}

// ============================================================================
// BLS Signing Tests
// ============================================================================

#[test]
fn test_batch_bls_signing() {
    let keypair = test_bls_keypair(1);
    let signer = Bn254BLSSigner::new();

    let message_hash = build_confirm_batch_hash(
        111222333,
        Address::zero(),
        42,
        &[U256::from(1), U256::from(2)],
    );

    let signature = signer
        .sign_with_keypair(&keypair, message_hash.as_bytes())
        .expect("Signing failed");

    assert!(!signature.0.is_empty(), "Signature should not be empty");
}

#[test]
fn test_batch_signature_aggregation() {
    let keypair1 = test_bls_keypair(1);
    let keypair2 = test_bls_keypair(2);
    let keypair3 = test_bls_keypair(3);
    let signer = Bn254BLSSigner::new();

    let message_hash = build_confirm_batch_hash(
        111222333,
        Address::zero(),
        42,
        &[U256::from(1)],
    );

    let sig1 = signer.sign_with_keypair(&keypair1, message_hash.as_bytes()).unwrap();
    let sig2 = signer.sign_with_keypair(&keypair2, message_hash.as_bytes()).unwrap();
    let sig3 = signer.sign_with_keypair(&keypair3, message_hash.as_bytes()).unwrap();

    let aggregated = signer
        .aggregate_signatures(vec![sig1.clone(), sig2.clone(), sig3.clone()])
        .expect("Aggregation failed");

    assert!(!aggregated.0.is_empty(), "Aggregated signature should not be empty");
    assert_ne!(aggregated.0, sig1.0);
}

// ============================================================================
// Mock Infrastructure
// ============================================================================

use async_trait::async_trait;
use issuer::bridge::CrossChainOrderReader;
use issuer::chain::CrossChainOrderData;

struct MockCrossChainOrderReader;

#[async_trait]
impl CrossChainOrderReader for MockCrossChainOrderReader {
    async fn get_cross_chain_order(&self, order_id: U256) -> Result<CrossChainOrderData, BridgeError> {
        Err(BridgeError::OrderNotFound { order_id })
    }
}

// ============================================================================
// BridgeOrchestrator Batch Confirmation Tests
// ============================================================================

#[tokio::test]
async fn test_orchestrator_propose_confirm_batch() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let order_ids = vec![U256::from(1), U256::from(2)];
    let prices = vec![U256::from(1000000000000000000u64), U256::from(2000000000000000000u64)];

    let proposal = orchestrator
        .propose_confirm_batch(42, order_ids.clone(), prices.clone())
        .expect("Proposal creation should succeed");

    assert_eq!(proposal.cycle_number, 42);
    assert_eq!(proposal.order_ids, order_ids);
    assert_eq!(proposal.prices, prices);
    assert!(!proposal.leader_signature.0.is_empty());

    // Verify message hash
    let expected_hash = build_confirm_batch_hash(config.l3_chain_id, config.index_address, 42, &order_ids);
    assert_eq!(proposal.message_hash, expected_hash);
}

#[tokio::test]
async fn test_orchestrator_propose_confirm_batch_mismatched_lengths() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    // order_ids.len() != prices.len()
    let result = orchestrator.propose_confirm_batch(
        42,
        vec![U256::from(1), U256::from(2)],
        vec![U256::from(1000000000000000000u64)], // Only 1 price
    );

    assert!(result.is_err());
}

#[tokio::test]
async fn test_orchestrator_validate_batch_proposal() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let order_ids = vec![U256::from(1), U256::from(2)];
    let prices = vec![U256::from(1000000000000000000u64), U256::from(2000000000000000000u64)];
    let message_hash = build_confirm_batch_hash(config.l3_chain_id, config.index_address, 42, &order_ids);

    let proposal = BatchProposal {
        leader_id: test_peer_id(1),
        cycle_number: 42,
        order_ids,
        prices,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash,
    };

    let result = orchestrator.validate_batch_proposal(&proposal).await;
    assert!(result.is_ok());
    assert!(result.unwrap(), "Validation should pass");
}

#[tokio::test]
async fn test_orchestrator_validate_batch_proposal_hash_mismatch() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let proposal = BatchProposal {
        leader_id: test_peer_id(1),
        cycle_number: 42,
        order_ids: vec![U256::from(1)],
        prices: vec![U256::from(1000000000000000000u64)],
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash: H256::from([0x00; 32]), // Wrong hash
    };

    let result = orchestrator.validate_batch_proposal(&proposal).await;
    assert!(result.is_ok());
    assert!(!result.unwrap(), "Should reject mismatched hash");
}

#[tokio::test]
async fn test_orchestrator_sign_batch_proposal() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(2);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(2),
        1, // follower
    );

    let order_ids = vec![U256::from(1)];
    let prices = vec![U256::from(1000000000000000000u64)];
    let message_hash = build_confirm_batch_hash(config.l3_chain_id, config.index_address, 42, &order_ids);

    let proposal = BatchProposal {
        leader_id: test_peer_id(1),
        cycle_number: 42,
        order_ids,
        prices,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash,
    };

    let signature = orchestrator.sign_batch_proposal(&proposal).expect("Signing should succeed");
    assert!(!signature.0.is_empty());
}

#[tokio::test]
async fn test_orchestrator_batch_signature_collection() {
    let config = test_bridge_config();
    let keypair1 = test_bls_keypair(1);
    let keypair2 = test_bls_keypair(2);
    let signer = Bn254BLSSigner::new();

    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair1.clone(),
        test_peer_id(1),
        0, // leader
    );

    let cycle_number = 42u64;
    let order_ids = vec![U256::from(1)];
    let prices = vec![U256::from(1000000000000000000u64)];
    let message_hash = build_confirm_batch_hash(config.l3_chain_id, config.index_address, cycle_number, &order_ids);

    let leader_sig = signer.sign_with_keypair(&keypair1, message_hash.as_bytes()).unwrap();
    let follower_sig = signer.sign_with_keypair(&keypair2, message_hash.as_bytes()).unwrap();

    // Start collection
    orchestrator.start_batch_signature_collection(cycle_number, leader_sig).await;

    // Add follower signature - should reach threshold
    let result = orchestrator
        .add_batch_follower_signature(cycle_number, 1, follower_sig)
        .await;

    assert!(result.is_ok());
    let result = result.unwrap();
    assert!(result.is_some(), "Threshold should be reached");

    let batch_result = result.unwrap();
    assert_eq!(batch_result.signature_count, 2);
    assert!(batch_result.signer_bitmap.bit(0)); // Leader
    assert!(batch_result.signer_bitmap.bit(1)); // Follower
}

// ============================================================================
// BridgeOrchestrator Fills Confirmation Tests
// ============================================================================

#[tokio::test]
async fn test_orchestrator_propose_confirm_fills() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let fills = vec![
        Fill {
            order_id: U256::from(1),
            fill_price: U256::from(1500000000000000000u64),
            fill_amount: U256::from(1000000000000000000u64),
        },
    ];

    let proposal = orchestrator
        .propose_confirm_fills(42, fills.clone())
        .expect("Proposal creation should succeed");

    assert_eq!(proposal.cycle_number, 42);
    assert_eq!(proposal.fills.len(), 1);
    assert!(!proposal.leader_signature.0.is_empty());

    // Verify message hash
    let expected_hash = build_confirm_fills_hash(config.l3_chain_id, config.index_address, 42, &fills);
    assert_eq!(proposal.message_hash, expected_hash);
}

#[tokio::test]
async fn test_orchestrator_validate_fills_proposal() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let fills = vec![Fill {
        order_id: U256::from(1),
        fill_price: U256::from(1500000000000000000u64),
        fill_amount: U256::from(1000000000000000000u64),
    }];
    let message_hash = build_confirm_fills_hash(config.l3_chain_id, config.index_address, 42, &fills);

    let proposal = FillsProposal {
        leader_id: test_peer_id(1),
        cycle_number: 42,
        fills,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash,
    };

    let result = orchestrator.validate_fills_proposal(&proposal).await;
    assert!(result.is_ok());
    assert!(result.unwrap(), "Validation should pass");
}

#[tokio::test]
async fn test_orchestrator_validate_fills_proposal_zero_amount() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let fills = vec![Fill {
        order_id: U256::from(1),
        fill_price: U256::from(1500000000000000000u64),
        fill_amount: U256::zero(), // Invalid
    }];
    let message_hash = build_confirm_fills_hash(config.l3_chain_id, config.index_address, 42, &fills);

    let proposal = FillsProposal {
        leader_id: test_peer_id(1),
        cycle_number: 42,
        fills,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash,
    };

    let result = orchestrator.validate_fills_proposal(&proposal).await;
    assert!(result.is_ok());
    assert!(!result.unwrap(), "Should reject zero fill amount");
}

#[tokio::test]
async fn test_orchestrator_validate_fills_proposal_zero_price() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let fills = vec![Fill {
        order_id: U256::from(1),
        fill_price: U256::zero(), // Invalid - would cause division by zero
        fill_amount: U256::from(1000000000000000000u64),
    }];
    let message_hash = build_confirm_fills_hash(config.l3_chain_id, config.index_address, 42, &fills);

    let proposal = FillsProposal {
        leader_id: test_peer_id(1),
        cycle_number: 42,
        fills,
        leader_signature: BLSSignature(vec![0xFF; 96]),
        message_hash,
    };

    let result = orchestrator.validate_fills_proposal(&proposal).await;
    assert!(result.is_err(), "Should error on zero fill price");

    match result.unwrap_err() {
        BridgeError::InvalidFillPrice { order_id } => {
            assert_eq!(order_id, U256::from(1));
        }
        other => panic!("Expected InvalidFillPrice error, got: {:?}", other),
    }
}

#[tokio::test]
async fn test_orchestrator_fills_signature_collection() {
    let config = test_bridge_config();
    let keypair1 = test_bls_keypair(1);
    let keypair2 = test_bls_keypair(2);
    let signer = Bn254BLSSigner::new();

    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        writer,
        keypair1.clone(),
        test_peer_id(1),
        0, // leader
    );

    let cycle_number = 42u64;
    let fills = vec![Fill {
        order_id: U256::from(1),
        fill_price: U256::from(1500000000000000000u64),
        fill_amount: U256::from(1000000000000000000u64),
    }];
    let message_hash = build_confirm_fills_hash(config.l3_chain_id, config.index_address, cycle_number, &fills);

    let leader_sig = signer.sign_with_keypair(&keypair1, message_hash.as_bytes()).unwrap();
    let follower_sig = signer.sign_with_keypair(&keypair2, message_hash.as_bytes()).unwrap();

    // Start collection
    orchestrator.start_fills_signature_collection(cycle_number, leader_sig).await;

    // Add follower signature - should reach threshold
    let result = orchestrator
        .add_fills_follower_signature(cycle_number, 1, follower_sig)
        .await;

    assert!(result.is_ok());
    let result = result.unwrap();
    assert!(result.is_some(), "Threshold should be reached");

    let fills_result = result.unwrap();
    assert_eq!(fills_result.signature_count, 2);
}

// ============================================================================
// Order Status Updates Tests
// ============================================================================

#[tokio::test]
async fn test_orchestrator_mark_orders_batched() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let order_ids = vec![U256::from(1), U256::from(2), U256::from(3)];

    // Initially no status
    assert!(orchestrator.get_order_status(&order_ids[0]).await.is_none());

    // Mark as batched
    orchestrator.mark_orders_batched(&order_ids).await;

    // Check status updated
    for order_id in &order_ids {
        let status = orchestrator.get_order_status(order_id).await;
        assert_eq!(status, Some(BridgeOrderStatus::Batched));
    }
}

#[tokio::test]
async fn test_orchestrator_mark_orders_filled() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    let fills = vec![
        Fill { order_id: U256::from(1), fill_price: U256::from(1000000000000000000u64), fill_amount: U256::from(500000000000000000u64) },
        Fill { order_id: U256::from(2), fill_price: U256::from(2000000000000000000u64), fill_amount: U256::from(750000000000000000u64) },
    ];

    // Mark as filled
    orchestrator.mark_orders_filled(&fills).await;

    // Check status updated
    for fill in &fills {
        let status = orchestrator.get_order_status(&fill.order_id).await;
        assert_eq!(status, Some(BridgeOrderStatus::Filled));
    }
}

// ============================================================================
// Deduplication Tests
// ============================================================================

#[tokio::test]
async fn test_orchestrator_batch_deduplication() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    // Initially not confirmed
    assert!(!orchestrator.is_batch_confirmed(42).await);

    let batch_result = BatchResult {
        aggregated_signature: BLSSignature(vec![0xFF; 96]),
        signer_bitmap: U256::from(3),
        signature_count: 2,
    };

    // First execution should succeed
    let result = orchestrator
        .execute_confirm_batch(42, &[U256::from(1)], &batch_result)
        .await;
    assert!(result.is_ok());

    // Now it's confirmed
    assert!(orchestrator.is_batch_confirmed(42).await);

    // Second execution should fail
    let result2 = orchestrator
        .execute_confirm_batch(42, &[U256::from(1)], &batch_result)
        .await;
    assert!(result2.is_err());

    match result2.unwrap_err() {
        BridgeError::BatchAlreadyConfirmed { cycle_number } => {
            assert_eq!(cycle_number, 42);
        }
        other => panic!("Expected BatchAlreadyConfirmed error, got: {:?}", other),
    }
}

#[tokio::test]
async fn test_orchestrator_fills_deduplication() {
    let config = test_bridge_config();
    let keypair = test_bls_keypair(1);
    let reader = Arc::new(MockCrossChainOrderReader);
    let writer = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        writer,
        keypair,
        test_peer_id(1),
        0,
    );

    // Initially not confirmed
    assert!(!orchestrator.is_fills_confirmed(42).await);

    let fills = vec![Fill {
        order_id: U256::from(1),
        fill_price: U256::from(1500000000000000000u64),
        fill_amount: U256::from(1000000000000000000u64),
    }];

    let fills_result = FillsResult {
        aggregated_signature: BLSSignature(vec![0xFF; 96]),
        signer_bitmap: U256::from(3),
        signature_count: 2,
    };

    // First execution should succeed
    let result = orchestrator
        .execute_confirm_fills(42, &fills, &fills_result)
        .await;
    assert!(result.is_ok());

    // Now it's confirmed
    assert!(orchestrator.is_fills_confirmed(42).await);

    // Second execution should fail
    let result2 = orchestrator
        .execute_confirm_fills(42, &fills, &fills_result)
        .await;
    assert!(result2.is_err());

    match result2.unwrap_err() {
        BridgeError::FillsAlreadyConfirmed { cycle_number } => {
            assert_eq!(cycle_number, 42);
        }
        other => panic!("Expected FillsAlreadyConfirmed error, got: {:?}", other),
    }
}

// ============================================================================
// Full Consensus Flow Simulation
// ============================================================================

#[tokio::test]
async fn test_full_batch_consensus_flow() {
    // Setup: 3 issuers
    let keypair1 = test_bls_keypair(1);
    let keypair2 = test_bls_keypair(2);
    let keypair3 = test_bls_keypair(3);
    let signer = Bn254BLSSigner::new();

    let config = test_bridge_config();
    let cycle_number = 42u64;
    let order_ids = vec![U256::from(1), U256::from(2)];
    let prices = vec![U256::from(1000000000000000000u64), U256::from(2000000000000000000u64)];

    // 1. Leader creates message hash and signs
    let message_hash = build_confirm_batch_hash(
        config.l3_chain_id,
        config.index_address,
        cycle_number,
        &order_ids,
    );

    let leader_sig = signer
        .sign_with_keypair(&keypair1, message_hash.as_bytes())
        .expect("Leader signing failed");

    // 2. Create proposal
    let proposal = BatchProposal {
        leader_id: test_peer_id(1),
        cycle_number,
        order_ids: order_ids.clone(),
        prices: prices.clone(),
        leader_signature: leader_sig.clone(),
        message_hash,
    };

    // 3. Followers validate hash matches
    let follower2_hash = build_confirm_batch_hash(
        config.l3_chain_id,
        config.index_address,
        proposal.cycle_number,
        &proposal.order_ids,
    );
    assert_eq!(follower2_hash, proposal.message_hash, "Follower hash should match");

    // 4. Followers sign
    let sig2 = signer.sign_with_keypair(&keypair2, follower2_hash.as_bytes()).unwrap();
    let sig3 = signer.sign_with_keypair(&keypair3, proposal.message_hash.as_bytes()).unwrap();

    // 5. Aggregate signatures
    let signatures = vec![leader_sig, sig2, sig3];
    let aggregated = signer.aggregate_signatures(signatures).expect("Aggregation failed");

    // 6. Create result
    let result = BatchResult {
        aggregated_signature: aggregated,
        signer_bitmap: U256::from(7), // bits 0, 1, 2
        signature_count: 3,
    };

    assert_eq!(result.signature_count, 3);
    assert!(result.signer_bitmap.bit(0));
    assert!(result.signer_bitmap.bit(1));
    assert!(result.signer_bitmap.bit(2));
}

#[tokio::test]
async fn test_full_fills_consensus_flow() {
    // Setup: 3 issuers
    let keypair1 = test_bls_keypair(1);
    let keypair2 = test_bls_keypair(2);
    let keypair3 = test_bls_keypair(3);
    let signer = Bn254BLSSigner::new();

    let config = test_bridge_config();
    let cycle_number = 42u64;
    let fills = vec![
        Fill {
            order_id: U256::from(1),
            fill_price: U256::from(1500000000000000000u64),
            fill_amount: U256::from(1000000000000000000u64),
        },
        Fill {
            order_id: U256::from(2),
            fill_price: U256::from(2500000000000000000u64),
            fill_amount: U256::from(500000000000000000u64),
        },
    ];

    // 1. Leader creates message hash and signs
    let message_hash = build_confirm_fills_hash(config.l3_chain_id, config.index_address, cycle_number, &fills);

    let leader_sig = signer
        .sign_with_keypair(&keypair1, message_hash.as_bytes())
        .expect("Leader signing failed");

    // 2. Create proposal
    let proposal = FillsProposal {
        leader_id: test_peer_id(1),
        cycle_number,
        fills: fills.clone(),
        leader_signature: leader_sig.clone(),
        message_hash,
    };

    // 3. Followers sign
    let sig2 = signer.sign_with_keypair(&keypair2, proposal.message_hash.as_bytes()).unwrap();
    let sig3 = signer.sign_with_keypair(&keypair3, proposal.message_hash.as_bytes()).unwrap();

    // 4. Aggregate signatures
    let signatures = vec![leader_sig, sig2, sig3];
    let aggregated = signer.aggregate_signatures(signatures).expect("Aggregation failed");

    // 5. Create result
    let result = FillsResult {
        aggregated_signature: aggregated,
        signer_bitmap: U256::from(7),
        signature_count: 3,
    };

    assert_eq!(result.signature_count, 3);
}
