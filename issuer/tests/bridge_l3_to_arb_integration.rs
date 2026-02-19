//! Integration tests for Story 7.5: Bridge USDC L3 to Arbitrum
//!
//! Tests the full L3→Arb bridge flow with BLS consensus:
//! 1. Leader proposes bridge L3→Arb with cycle_number, order_ids, and total_amount
//! 2. Followers validate proposal (orders must be in Batched status)
//! 3. Followers sign proposal
//! 4. Threshold reached → signatures aggregated
//! 5. Execute bridge simulation (mint ArbUSDC to IssuerCustody Arb)
//!
//! This is Step 5 of the vital-test.md "Buy ITP via Bridge" flow.

use std::sync::Arc;

use async_trait::async_trait;
use ethers::types::{Address, H256, U256};
use tokio::sync::RwLock;

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::mocks::MockChainBuilder;
use common::traits::BLSSigner;
use common::types::{BLSSignature, PeerId};

use issuer::bridge::{
    build_bridge_l3_to_arb_hash, BridgeConfig, BridgeError, BridgeL3ToArbProposal,
    BridgeL3ToArbResult, BridgeOrchestrator, BridgeOrderStatus, CrossChainOrderReader,
};
use issuer::chain::CrossChainOrderData;

// ============================================================================
// Test Helpers
// ============================================================================

/// Mock implementation of CrossChainOrderReader for testing
struct MockCrossChainOrderReader {
    orders: RwLock<std::collections::HashMap<U256, CrossChainOrderData>>,
}

impl MockCrossChainOrderReader {
    fn new() -> Self {
        Self {
            orders: RwLock::new(std::collections::HashMap::new()),
        }
    }

    async fn add_order(&self, order_id: U256, data: CrossChainOrderData) {
        self.orders.write().await.insert(order_id, data);
    }
}

#[async_trait]
impl CrossChainOrderReader for MockCrossChainOrderReader {
    async fn get_cross_chain_order(
        &self,
        order_id: U256,
    ) -> Result<CrossChainOrderData, BridgeError> {
        self.orders
            .read()
            .await
            .get(&order_id)
            .cloned()
            .ok_or_else(|| BridgeError::OrderNotFound { order_id })
    }
}

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
        arb_custody_address: Address::from([0x33; 20]),
        arbitrum_chain_id: 42161,
        l3_chain_id: 111222333,
        index_address: Address::from([0x44; 20]),
        min_signatures: 2, // 2-of-3 threshold
        proposal_timeout_ms: 500,
        sign_timeout_ms: 300,
        // Story 7.5: Bridge L3→Arb config
        issuer_custody_arb: Address::from([0x55; 20]),
        arb_usdc_address: Address::from([0x66; 20]),
        // Story 7.6: Custody release to vault config
        bitget_vault: Address::from([0x77; 20]),
        signer_address: Address::from([0x88; 20]),
        collateral_registry: Address::zero(),
        bridge_proxy: Address::zero(),
    }
}

fn test_order_data(order_id: U256, amount: U256) -> CrossChainOrderData {
    CrossChainOrderData {
        itp_id: H256::from([0xAA; 32]),
        user: Address::from([0xBB; 20]),
        amount,
        limit_price: U256::from(2000000000000000000u64), // 2.0
        slippage_tier: 1,
        deadline: U256::from(u64::MAX),
        created_at: U256::from(1700000000u64),
    }
}

// ============================================================================
// Hash Builder Tests (Additional from types.rs)
// ============================================================================

#[test]
fn test_build_bridge_l3_to_arb_hash_is_deterministic() {
    let hash1 = build_bridge_l3_to_arb_hash(
        111222333,
        42,
        &[U256::from(1), U256::from(2), U256::from(3)],
        U256::from(3000000000000000000u64),
        Address::from([0x55; 20]),
    );

    let hash2 = build_bridge_l3_to_arb_hash(
        111222333,
        42,
        &[U256::from(1), U256::from(2), U256::from(3)],
        U256::from(3000000000000000000u64),
        Address::from([0x55; 20]),
    );

    assert_eq!(hash1, hash2, "Same inputs should produce same hash");
}

#[test]
fn test_build_bridge_l3_to_arb_hash_order_ids_matter() {
    let hash1 = build_bridge_l3_to_arb_hash(
        111222333,
        42,
        &[U256::from(1), U256::from(2)],
        U256::from(2000000000000000000u64),
        Address::from([0x55; 20]),
    );

    // Same amount but different order
    let hash2 = build_bridge_l3_to_arb_hash(
        111222333,
        42,
        &[U256::from(2), U256::from(1)], // Different order
        U256::from(2000000000000000000u64),
        Address::from([0x55; 20]),
    );

    assert_ne!(hash1, hash2, "Different order_id ordering should produce different hashes");
}

// ============================================================================
// Test 1: Leader creates valid proposal with explicit amount
// ============================================================================

#[tokio::test]
async fn test_leader_creates_l3_to_arb_proposal_with_amount() {
    let config = test_bridge_config();
    let mock_reader = Arc::new(MockCrossChainOrderReader::new());

    // Add orders
    let order1_id = U256::from(1);
    let order2_id = U256::from(2);
    let amount1 = U256::from(1000000000000000000u64); // 1 USDC
    let amount2 = U256::from(2000000000000000000u64); // 2 USDC
    let total_amount = amount1 + amount2;

    mock_reader.add_order(order1_id, test_order_data(order1_id, amount1)).await;
    mock_reader.add_order(order2_id, test_order_data(order2_id, amount2)).await;

    let l3_chain = Arc::new(MockChainBuilder::new().build());
    let keypair = test_bls_keypair(0);
    let peer_id = test_peer_id(0);

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        mock_reader,
        l3_chain,
        keypair,
        peer_id,
        0, // node_index
    );

    // Pre-condition: mark orders as Batched
    orchestrator.set_order_status(order1_id, BridgeOrderStatus::Batched).await;
    orchestrator.set_order_status(order2_id, BridgeOrderStatus::Batched).await;

    let order_ids = vec![order1_id, order2_id];
    let cycle_number = 42u64;

    // Create proposal with explicit amount
    let proposal = orchestrator
        .propose_bridge_l3_to_arb_with_amount(cycle_number, order_ids.clone(), total_amount)
        .unwrap();

    // Verify proposal fields
    assert_eq!(proposal.leader_id, peer_id);
    assert_eq!(proposal.cycle_number, cycle_number);
    assert_eq!(proposal.order_ids, order_ids);
    assert_eq!(proposal.total_amount, total_amount);
    assert_eq!(proposal.destination, config.issuer_custody_arb);

    // Verify signature is not empty
    assert!(!proposal.leader_signature.0.is_empty());
    assert_eq!(proposal.leader_signature.0.len(), 64);

    // Verify message hash matches recomputed
    let expected_hash = build_bridge_l3_to_arb_hash(
        config.l3_chain_id,
        cycle_number,
        &order_ids,
        total_amount,
        config.issuer_custody_arb,
    );
    assert_eq!(proposal.message_hash, expected_hash);
}

// ============================================================================
// Test 2: Follower validates proposal (requires Batched status)
// ============================================================================

#[tokio::test]
async fn test_follower_validates_l3_to_arb_proposal() {
    let config = test_bridge_config();

    // Setup leader
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(100);
    let amount = U256::from(1000000000000000000u64);
    leader_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let leader_chain = Arc::new(MockChainBuilder::new().build());
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        leader_chain,
        test_bls_keypair(0),
        test_peer_id(0),
        0,
    );

    // Mark as Batched (pre-condition)
    leader.set_order_status(order_id, BridgeOrderStatus::Batched).await;

    // Create proposal
    let proposal = leader
        .propose_bridge_l3_to_arb_with_amount(42, vec![order_id], amount)
        .unwrap();

    // Setup follower
    let follower_reader = Arc::new(MockCrossChainOrderReader::new());
    follower_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let follower_chain = Arc::new(MockChainBuilder::new().build());
    let follower = BridgeOrchestrator::new(
        config.clone(),
        follower_reader,
        follower_chain,
        test_bls_keypair(1),
        test_peer_id(1),
        1,
    );

    // Mark as Batched on follower too
    follower.set_order_status(order_id, BridgeOrderStatus::Batched).await;

    // Validate proposal
    let is_valid = follower.validate_bridge_l3_to_arb_proposal(&proposal).await.unwrap();
    assert!(is_valid, "Follower should validate proposal with Batched orders");
}

// ============================================================================
// Test 3: Follower rejects proposal when order not Batched
// ============================================================================

#[tokio::test]
async fn test_follower_rejects_proposal_when_order_not_batched() {
    let config = test_bridge_config();

    // Setup leader
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(100);
    let amount = U256::from(1000000000000000000u64);
    leader_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let leader_chain = Arc::new(MockChainBuilder::new().build());
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        leader_chain,
        test_bls_keypair(0),
        test_peer_id(0),
        0,
    );

    // Mark as Batched on leader
    leader.set_order_status(order_id, BridgeOrderStatus::Batched).await;

    let proposal = leader
        .propose_bridge_l3_to_arb_with_amount(42, vec![order_id], amount)
        .unwrap();

    // Setup follower with order in WRONG status (SubmittedOnL3, not Batched)
    let follower_reader = Arc::new(MockCrossChainOrderReader::new());
    follower_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let follower_chain = Arc::new(MockChainBuilder::new().build());
    let follower = BridgeOrchestrator::new(
        config.clone(),
        follower_reader,
        follower_chain,
        test_bls_keypair(1),
        test_peer_id(1),
        1,
    );

    // Keep order in SubmittedOnL3 status (not Batched)
    follower.set_order_status(order_id, BridgeOrderStatus::SubmittedOnL3).await;

    // Validation should fail
    let is_valid = follower.validate_bridge_l3_to_arb_proposal(&proposal).await.unwrap();
    assert!(!is_valid, "Follower should reject proposal when order not in Batched status");
}

// ============================================================================
// Test 4: Follower signs validated proposal
// ============================================================================

#[tokio::test]
async fn test_follower_signs_l3_to_arb_proposal() {
    let config = test_bridge_config();

    // Setup leader
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(100);
    let amount = U256::from(1000000000000000000u64);
    leader_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let leader_chain = Arc::new(MockChainBuilder::new().build());
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        leader_chain,
        test_bls_keypair(0),
        test_peer_id(0),
        0,
    );

    leader.set_order_status(order_id, BridgeOrderStatus::Batched).await;
    let proposal = leader
        .propose_bridge_l3_to_arb_with_amount(42, vec![order_id], amount)
        .unwrap();

    // Setup follower
    let follower_reader = Arc::new(MockCrossChainOrderReader::new());
    follower_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let follower_chain = Arc::new(MockChainBuilder::new().build());
    let follower_keypair = test_bls_keypair(1);
    let follower = BridgeOrchestrator::new(
        config.clone(),
        follower_reader,
        follower_chain,
        follower_keypair.clone(),
        test_peer_id(1),
        1,
    );

    follower.set_order_status(order_id, BridgeOrderStatus::Batched).await;

    // Sign proposal
    let signature = follower.sign_bridge_l3_to_arb_proposal(&proposal).unwrap();

    // Verify signature is valid
    assert!(!signature.0.is_empty());
    assert_eq!(signature.0.len(), 64);

    // Verify signature can be verified
    let signer = Bn254BLSSigner::new();
    let is_valid = signer
        .verify(&follower_keypair.public_key(), proposal.message_hash.as_bytes(), &signature)
        .unwrap();
    assert!(is_valid, "Signature should be valid");
}

// ============================================================================
// Test 5: Signature aggregation reaches threshold
// ============================================================================

#[tokio::test]
async fn test_signature_aggregation_threshold_reached() {
    let config = test_bridge_config();

    // Setup leader
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(100);
    let amount = U256::from(1000000000000000000u64);
    leader_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let leader_chain = Arc::new(MockChainBuilder::new().build());
    let leader_keypair = test_bls_keypair(0);
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        leader_chain,
        leader_keypair,
        test_peer_id(0),
        0,
    );

    leader.set_order_status(order_id, BridgeOrderStatus::Batched).await;
    let proposal = leader
        .propose_bridge_l3_to_arb_with_amount(42, vec![order_id], amount)
        .unwrap();

    // Start signature collection
    leader
        .start_l3_to_arb_signature_collection(proposal.cycle_number, proposal.leader_signature.clone())
        .await;

    // Setup follower
    let follower_reader = Arc::new(MockCrossChainOrderReader::new());
    follower_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let follower_chain = Arc::new(MockChainBuilder::new().build());
    let follower_keypair = test_bls_keypair(1);
    let follower = BridgeOrchestrator::new(
        config.clone(),
        follower_reader,
        follower_chain,
        follower_keypair,
        test_peer_id(1),
        1,
    );

    follower.set_order_status(order_id, BridgeOrderStatus::Batched).await;
    let follower_sig = follower.sign_bridge_l3_to_arb_proposal(&proposal).unwrap();

    // Add follower signature
    let result = leader
        .add_l3_to_arb_follower_signature(proposal.cycle_number, 1, follower_sig)
        .await
        .unwrap();

    // Should have reached threshold (2-of-3 with leader + 1 follower)
    assert!(result.is_some(), "Should reach threshold with 2 signatures");

    let bridge_result = result.unwrap();
    assert_eq!(bridge_result.signature_count, 2);
    assert_eq!(bridge_result.signer_bitmap, U256::from(3)); // bits 0 and 1 set
}

// ============================================================================
// Test 6: Execute bridge simulation (mint ArbUSDC)
// ============================================================================

#[tokio::test]
async fn test_execute_bridge_l3_to_arb_simulation() {
    let config = test_bridge_config();

    // Setup leader
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(100);
    let amount = U256::from(1000000000000000000u64);
    leader_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let leader_chain = Arc::new(MockChainBuilder::new().build());
    let leader_keypair = test_bls_keypair(0);
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        leader_chain,
        leader_keypair,
        test_peer_id(0),
        0,
    );

    leader.set_order_status(order_id, BridgeOrderStatus::Batched).await;
    let proposal = leader
        .propose_bridge_l3_to_arb_with_amount(42, vec![order_id], amount)
        .unwrap();

    // Create a result with aggregated signature
    let result = BridgeL3ToArbResult {
        aggregated_signature: proposal.leader_signature.clone(),
        signer_bitmap: U256::from(3),
        signature_count: 2,
    };

    // Execute bridge
    let tx_hash = leader.execute_bridge_l3_to_arb(&proposal, &result).await.unwrap();

    // Verify tx_hash is set
    assert_ne!(tx_hash, H256::zero());

    // Verify order status updated to BridgedBackToArb
    let status = leader.get_order_status(&order_id).await;
    assert_eq!(status, Some(BridgeOrderStatus::BridgedBackToArb));

    // Verify cycle is marked as confirmed
    assert!(leader.is_l3_to_arb_confirmed(42).await);
}

// ============================================================================
// Test 7: Duplicate cycle execution is rejected
// ============================================================================

#[tokio::test]
async fn test_duplicate_cycle_execution_rejected() {
    let config = test_bridge_config();

    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(100);
    let amount = U256::from(1000000000000000000u64);
    leader_reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let leader_chain = Arc::new(MockChainBuilder::new().build());
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        leader_chain,
        test_bls_keypair(0),
        test_peer_id(0),
        0,
    );

    leader.set_order_status(order_id, BridgeOrderStatus::Batched).await;
    let proposal = leader
        .propose_bridge_l3_to_arb_with_amount(42, vec![order_id], amount)
        .unwrap();

    let result = BridgeL3ToArbResult {
        aggregated_signature: proposal.leader_signature.clone(),
        signer_bitmap: U256::from(3),
        signature_count: 2,
    };

    // First execution should succeed
    let tx_hash = leader.execute_bridge_l3_to_arb(&proposal, &result).await.unwrap();
    assert_ne!(tx_hash, H256::zero());

    // Second execution should fail
    let err = leader.execute_bridge_l3_to_arb(&proposal, &result).await;
    assert!(matches!(
        err,
        Err(BridgeError::BridgeL3ToArbAlreadyProcessed { cycle_number: 42 })
    ));
}

// ============================================================================
// Test 8: Full 3-node consensus flow
// ============================================================================

#[tokio::test]
async fn test_full_3_node_l3_to_arb_consensus() {
    let config = test_bridge_config();

    // Setup 3 orders to bridge back
    let order_ids = vec![U256::from(1), U256::from(2), U256::from(3)];
    let amounts = vec![
        U256::from(1000000000000000000u64), // 1 USDC
        U256::from(2000000000000000000u64), // 2 USDC
        U256::from(1500000000000000000u64), // 1.5 USDC
    ];
    let total_amount = amounts.iter().fold(U256::zero(), |acc, a| acc + *a);
    let cycle_number = 99u64;

    // Create 3 orchestrators
    let mut orchestrators = Vec::new();
    for i in 0..3 {
        let reader = Arc::new(MockCrossChainOrderReader::new());
        for (j, order_id) in order_ids.iter().enumerate() {
            reader.add_order(*order_id, test_order_data(*order_id, amounts[j])).await;
        }

        let chain = Arc::new(MockChainBuilder::new().build());
        let orchestrator = BridgeOrchestrator::new(
            config.clone(),
            reader,
            chain,
            test_bls_keypair(i as u64),
            test_peer_id(i as u8),
            i as u8,
        );

        // Mark all orders as Batched
        for order_id in &order_ids {
            orchestrator.set_order_status(*order_id, BridgeOrderStatus::Batched).await;
        }

        orchestrators.push(orchestrator);
    }

    let (leader, followers) = orchestrators.split_first_mut().unwrap();

    // 1. Leader creates proposal
    let proposal = leader
        .propose_bridge_l3_to_arb_with_amount(cycle_number, order_ids.clone(), total_amount)
        .unwrap();

    assert_eq!(proposal.order_ids, order_ids);
    assert_eq!(proposal.total_amount, total_amount);
    assert_eq!(proposal.destination, config.issuer_custody_arb);

    // 2. Leader starts signature collection
    leader
        .start_l3_to_arb_signature_collection(cycle_number, proposal.leader_signature.clone())
        .await;

    // 3. Followers validate and sign
    let mut final_result: Option<BridgeL3ToArbResult> = None;
    for (i, follower) in followers.iter().enumerate() {
        // Validate
        let is_valid = follower.validate_bridge_l3_to_arb_proposal(&proposal).await.unwrap();
        assert!(is_valid, "Follower {} should validate proposal", i + 1);

        // Sign
        let sig = follower.sign_bridge_l3_to_arb_proposal(&proposal).unwrap();

        // Add to leader
        let result = leader
            .add_l3_to_arb_follower_signature(cycle_number, (i + 1) as u8, sig)
            .await
            .unwrap();

        if result.is_some() {
            final_result = result;
        }
    }

    // 4. Threshold should be reached
    assert!(final_result.is_some(), "Should reach threshold with 3 signatures");
    let result = final_result.unwrap();
    assert_eq!(result.signature_count, 3);

    // 5. Execute bridge
    let tx_hash = leader.execute_bridge_l3_to_arb(&proposal, &result).await.unwrap();
    assert_ne!(tx_hash, H256::zero());

    // 6. Verify all orders are now BridgedBackToArb
    for order_id in &order_ids {
        let status = leader.get_order_status(order_id).await;
        assert_eq!(
            status,
            Some(BridgeOrderStatus::BridgedBackToArb),
            "Order {} should be BridgedBackToArb",
            order_id
        );
    }

    // 7. Verify cycle is confirmed
    assert!(leader.is_l3_to_arb_confirmed(cycle_number).await);
}

// ============================================================================
// Test 9: Status transition Batched → BridgedBackToArb
// ============================================================================

#[tokio::test]
async fn test_status_transition_batched_to_bridged_back() {
    let config = test_bridge_config();

    let reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(42);
    let amount = U256::from(1000000000000000000u64);
    reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let chain = Arc::new(MockChainBuilder::new().build());
    let orchestrator = BridgeOrchestrator::new(
        config,
        reader,
        chain,
        test_bls_keypair(0),
        test_peer_id(0),
        0,
    );

    // Initial status should be None/Pending
    let initial = orchestrator.get_order_status(&order_id).await;
    assert!(initial.is_none() || initial == Some(BridgeOrderStatus::Pending));

    // Set to Batched (pre-condition from Story 7.4)
    orchestrator.set_order_status(order_id, BridgeOrderStatus::Batched).await;
    assert_eq!(
        orchestrator.get_order_status(&order_id).await,
        Some(BridgeOrderStatus::Batched)
    );

    // Call mark_orders_bridged_back
    orchestrator.mark_orders_bridged_back(&[order_id]).await;

    // Verify status changed
    assert_eq!(
        orchestrator.get_order_status(&order_id).await,
        Some(BridgeOrderStatus::BridgedBackToArb)
    );
}

// ============================================================================
// Test 10: Cleanup stale signature collectors
// ============================================================================

#[tokio::test]
async fn test_cleanup_stale_l3_to_arb_collectors() {
    use tokio::time::{sleep, Duration};

    let config = test_bridge_config();

    let reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(42);
    let amount = U256::from(1000000000000000000u64);
    reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let chain = Arc::new(MockChainBuilder::new().build());
    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        chain,
        test_bls_keypair(0),
        test_peer_id(0),
        0,
    );

    orchestrator.set_order_status(order_id, BridgeOrderStatus::Batched).await;
    let proposal = orchestrator
        .propose_bridge_l3_to_arb_with_amount(42, vec![order_id], amount)
        .unwrap();

    // Start collection
    orchestrator
        .start_l3_to_arb_signature_collection(42, proposal.leader_signature.clone())
        .await;

    // Wait a small amount to ensure elapsed_ms > 0
    sleep(Duration::from_millis(10)).await;

    // Cleanup with max_age of 1ms - since we waited 10ms, the collector should be stale
    orchestrator.cleanup_stale_l3_to_arb_collectors(1).await;

    // Collector should be gone (CycleNotFound error)
    // Create a valid signature to test - use follower keypair
    let follower_keypair = test_bls_keypair(1);
    let signer = Bn254BLSSigner::new();
    let valid_sig = signer
        .sign_with_keypair(&follower_keypair, proposal.message_hash.as_bytes())
        .expect("signing should succeed");

    let result = orchestrator
        .add_l3_to_arb_follower_signature(42, 1, valid_sig)
        .await;
    assert!(
        matches!(result, Err(BridgeError::CycleNotFound { cycle_number: 42 })),
        "Expected CycleNotFound error but got: {:?}",
        result
    );
}

// ============================================================================
// Test 11: Deprecated propose_bridge_l3_to_arb returns total_amount=0
// ============================================================================

#[tokio::test]
#[allow(deprecated)]
async fn test_deprecated_propose_method_returns_zero_amount() {
    let config = test_bridge_config();

    let reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(100);
    let amount = U256::from(5000000000000000000u64); // 5 USDC
    reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let chain = Arc::new(MockChainBuilder::new().build());
    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        chain,
        test_bls_keypair(0),
        test_peer_id(0),
        0,
    );

    // Mark order as Batched (pre-condition)
    orchestrator.set_order_status(order_id, BridgeOrderStatus::Batched).await;

    // Call the deprecated method - it should return total_amount = 0
    // despite the order having amount = 5 USDC
    let proposal = orchestrator
        .propose_bridge_l3_to_arb(42, vec![order_id])
        .await
        .expect("proposal should succeed");

    // IMPORTANT: This documents the bug that the deprecated method has
    // total_amount is always 0 because order amounts are not tracked
    assert_eq!(
        proposal.total_amount,
        U256::zero(),
        "DEPRECATED method should return total_amount=0 - use propose_bridge_l3_to_arb_with_amount() instead"
    );

    // In contrast, the correct method returns the expected amount
    let correct_proposal = orchestrator
        .propose_bridge_l3_to_arb_with_amount(43, vec![order_id], amount)
        .expect("proposal should succeed");

    assert_eq!(
        correct_proposal.total_amount, amount,
        "propose_bridge_l3_to_arb_with_amount() should return correct amount"
    );
}

// ============================================================================
// Test 12: Execute validates destination address
// ============================================================================

#[tokio::test]
async fn test_execute_validates_destination() {
    let config = test_bridge_config();

    let reader = Arc::new(MockCrossChainOrderReader::new());
    let order_id = U256::from(100);
    let amount = U256::from(1000000000000000000u64);
    reader.add_order(order_id, test_order_data(order_id, amount)).await;

    let chain = Arc::new(MockChainBuilder::new().build());
    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        reader,
        chain,
        test_bls_keypair(0),
        test_peer_id(0),
        0,
    );

    orchestrator.set_order_status(order_id, BridgeOrderStatus::Batched).await;

    // Create a proposal with the wrong destination
    let mut proposal = orchestrator
        .propose_bridge_l3_to_arb_with_amount(42, vec![order_id], amount)
        .unwrap();

    // Tamper with the destination (simulate malicious proposal)
    let malicious_destination = Address::from([0xEE; 20]);
    proposal.destination = malicious_destination;

    // Create a fake aggregated result (not used but required for API)
    let aggregated = BridgeL3ToArbResult {
        aggregated_signature: proposal.leader_signature.clone(),
        signer_bitmap: U256::from(0b11), // 2 signers
        signature_count: 2,
    };

    // Execute should fail with InvalidDestination error
    let result = orchestrator.execute_bridge_l3_to_arb(&proposal, &aggregated).await;

    assert!(
        matches!(
            result,
            Err(BridgeError::InvalidDestination { expected, actual })
            if expected == config.issuer_custody_arb && actual == malicious_destination
        ),
        "Expected InvalidDestination error but got: {:?}",
        result
    );
}
