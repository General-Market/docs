//! Integration tests for Bridge Arb→L3 orchestration (Story 7.2, Task 10)
//!
//! Tests the full bridge flow with 3 nodes:
//! 1. Leader proposes bridge for CrossChainOrder
//! 2. Followers validate and sign
//! 3. Threshold reached → execute bridge (mint L3Usdc to IssuerCustody L3)
//!
//! Uses mock chain reader providing order data and MockChain for L3 writes.

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use ethers::types::{Address, H256, U256};
use tokio::sync::RwLock;

use common::bls::BLSKeyPair;
use common::mocks::MockChainBuilder;
use common::types::PeerId;
use issuer::bridge::{
    BridgeConfig, BridgeError, BridgeOrchestrator, BridgeOrderStatus, CrossChainOrderReader,
};
use issuer::chain::{CrossChainOrder, CrossChainOrderData};

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
    async fn get_cross_chain_order(&self, order_id: U256) -> Result<CrossChainOrderData, BridgeError> {
        self.orders
            .read()
            .await
            .get(&order_id)
            .cloned()
            .ok_or_else(|| BridgeError::OrderNotFound { order_id })
    }
}

/// Create a test BridgeConfig
fn test_config() -> BridgeConfig {
    BridgeConfig {
        issuer_custody_l3: Address::from([0x11u8; 20]),
        l3_usdc_address: Address::from([0x22u8; 20]),
        arb_custody_address: Address::from([0x33u8; 20]),
        arbitrum_chain_id: 42161,
        l3_chain_id: 111222333, // Index L3 Orbit chain
        index_address: Address::from([0x44u8; 20]),
        min_signatures: 2, // 2 of 3 threshold
        proposal_timeout_ms: 500,
        sign_timeout_ms: 300,
        // Story 7.5: Bridge L3→Arb config
        issuer_custody_arb: Address::from([0x55u8; 20]),
        arb_usdc_address: Address::from([0x66u8; 20]),
        // Story 7.6: Custody release to vault config
        bitget_vault: Address::from([0x77u8; 20]),
        signer_address: Address::from([0x88; 20]),
        collateral_registry: Address::zero(),
        bridge_proxy: Address::zero(),
    }
}

/// Create a test CrossChainOrder
fn test_cross_chain_order() -> CrossChainOrder {
    // Deadline far in the future to avoid expiration during tests
    let future_deadline = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() + 3600; // 1 hour from now

    CrossChainOrder {
        order_id: U256::from(42),
        itp_id: H256::from([0xAA; 32]),
        user: Address::from([0xBB; 20]),
        amount: U256::from(1_000_000_000_000_000_000u64), // 1e18 (1 USDC)
        limit_price: U256::from(500_000_000_000_000_000u64), // 0.5e18
        slippage_tier: 1, // normal
        deadline: U256::from(future_deadline),
        created_at: U256::from(1699000000u64),
        chain_id: 42161,
        block_number: 12345,
        tx_hash: H256::from([0x33; 32]),
    }
}

/// Create CrossChainOrderData from CrossChainOrder (for mock reader)
fn order_to_data(order: &CrossChainOrder) -> CrossChainOrderData {
    CrossChainOrderData {
        itp_id: order.itp_id,
        user: order.user,
        amount: order.amount,
        limit_price: order.limit_price,
        slippage_tier: order.slippage_tier,
        deadline: order.deadline,
        created_at: order.created_at,
    }
}

/// Generate deterministic keypair for testing
fn test_keypair(index: u8) -> BLSKeyPair {
    let mut seed = [0u8; 32];
    seed[0] = index;
    seed[1] = 0x42;
    BLSKeyPair::from_seed(&seed).expect("valid seed")
}

/// Generate deterministic peer ID for testing
fn test_peer_id(index: u8) -> PeerId {
    let mut peer_id = [0u8; 32];
    peer_id[0] = index;
    peer_id
}

// =============================================================================
// Test 1: Leader creates valid proposal
// =============================================================================

#[tokio::test]
async fn test_leader_creates_valid_proposal() {
    let config = test_config();
    let order = test_cross_chain_order();

    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(order.order_id, order_to_data(&order)).await;

    let l3_chain = Arc::new(MockChainBuilder::new().build());
    let keypair = test_keypair(0);
    let peer_id = test_peer_id(0);

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        mock_reader,
        l3_chain,
        keypair,
        peer_id,
        0, // node_index
    );

    // Create proposal
    let proposal = orchestrator.propose_bridge_arb_to_l3(&order).unwrap();

    // Verify proposal fields
    assert_eq!(proposal.leader_id, peer_id);
    assert_eq!(proposal.order_id, order.order_id);
    assert_eq!(proposal.itp_id, order.itp_id);
    assert_eq!(proposal.user, order.user);
    assert_eq!(proposal.amount, order.amount);
    assert_eq!(proposal.deadline, order.deadline);

    // Verify signature is not empty
    assert!(!proposal.leader_signature.0.is_empty());
    assert_eq!(proposal.leader_signature.0.len(), 64);

    // Verify message hash is deterministic
    let proposal2 = orchestrator.propose_bridge_arb_to_l3(&order).unwrap();
    assert_eq!(proposal.message_hash, proposal2.message_hash);
}

// =============================================================================
// Test 2: Follower validates proposal against on-chain data
// =============================================================================

#[tokio::test]
async fn test_follower_validates_proposal() {
    let config = test_config();
    let order = test_cross_chain_order();

    // Setup leader
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    leader_reader.add_order(order.order_id, order_to_data(&order)).await;
    let leader_chain = Arc::new(MockChainBuilder::new().build());
    let leader_keypair = test_keypair(0);
    let leader_peer_id = test_peer_id(0);

    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        leader_chain,
        leader_keypair,
        leader_peer_id,
        0,
    );

    // Create proposal
    let proposal = leader.propose_bridge_arb_to_l3(&order).unwrap();

    // Setup follower
    let follower_reader = Arc::new(MockCrossChainOrderReader::new());
    follower_reader.add_order(order.order_id, order_to_data(&order)).await;
    let follower_chain = Arc::new(MockChainBuilder::new().build());
    let follower_keypair = test_keypair(1);
    let follower_peer_id = test_peer_id(1);

    let follower = BridgeOrchestrator::new(
        config.clone(),
        follower_reader,
        follower_chain,
        follower_keypair,
        follower_peer_id,
        1,
    );

    // Validate proposal
    let is_valid = follower.validate_bridge_proposal(&proposal).await.unwrap();
    assert!(is_valid);
}

// =============================================================================
// Test 3: Follower rejects proposal with mismatched data
// =============================================================================

#[tokio::test]
async fn test_follower_rejects_mismatched_proposal() {
    let config = test_config();
    let order = test_cross_chain_order();

    // Setup leader with correct data
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    leader_reader.add_order(order.order_id, order_to_data(&order)).await;
    let leader_chain = Arc::new(MockChainBuilder::new().build());
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        leader_chain,
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    let proposal = leader.propose_bridge_arb_to_l3(&order).unwrap();

    // Setup follower with DIFFERENT amount in on-chain data
    let mut wrong_data = order_to_data(&order);
    wrong_data.amount = U256::from(999); // Different amount

    let follower_reader = Arc::new(MockCrossChainOrderReader::new());
    follower_reader.add_order(order.order_id, wrong_data).await;
    let follower_chain = Arc::new(MockChainBuilder::new().build());

    let follower = BridgeOrchestrator::new(
        config.clone(),
        follower_reader,
        follower_chain,
        test_keypair(1),
        test_peer_id(1),
        1,
    );

    // Validation should fail with mismatch error
    let result = follower.validate_bridge_proposal(&proposal).await;
    assert!(matches!(result, Err(BridgeError::ProposalMismatch { field }) if field == "amount"));
}

// =============================================================================
// Test 4: Follower rejects proposal for non-existent order
// =============================================================================

#[tokio::test]
async fn test_follower_rejects_nonexistent_order() {
    let config = test_config();
    let order = test_cross_chain_order();

    // Leader creates proposal
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    leader_reader.add_order(order.order_id, order_to_data(&order)).await;
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        Arc::new(MockChainBuilder::new().build()),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    let proposal = leader.propose_bridge_arb_to_l3(&order).unwrap();

    // Follower has EMPTY reader (no orders)
    let follower_reader = Arc::new(MockCrossChainOrderReader::new());
    let follower = BridgeOrchestrator::new(
        config.clone(),
        follower_reader,
        Arc::new(MockChainBuilder::new().build()),
        test_keypair(1),
        test_peer_id(1),
        1,
    );

    // Validation should fail with order not found
    let result = follower.validate_bridge_proposal(&proposal).await;
    assert!(result.is_err());
}

// =============================================================================
// Test 5: Follower signs validated proposal
// =============================================================================

#[tokio::test]
async fn test_follower_signs_validated_proposal() {
    let config = test_config();
    let order = test_cross_chain_order();

    // Setup leader
    let leader_reader = Arc::new(MockCrossChainOrderReader::new());
    leader_reader.add_order(order.order_id, order_to_data(&order)).await;
    let leader = BridgeOrchestrator::new(
        config.clone(),
        leader_reader,
        Arc::new(MockChainBuilder::new().build()),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    let proposal = leader.propose_bridge_arb_to_l3(&order).unwrap();

    // Setup follower
    let follower_reader = Arc::new(MockCrossChainOrderReader::new());
    follower_reader.add_order(order.order_id, order_to_data(&order)).await;
    let follower = BridgeOrchestrator::new(
        config.clone(),
        follower_reader,
        Arc::new(MockChainBuilder::new().build()),
        test_keypair(1),
        test_peer_id(1),
        1,
    );

    // Sign proposal
    let signature = follower.sign_bridge_proposal(&proposal).unwrap();

    // Verify signature is valid BLS signature
    assert_eq!(signature.0.len(), 64);
    assert!(signature.0.iter().any(|&b| b != 0));
}

// =============================================================================
// Test 6: Signature aggregation reaches threshold with 2 of 3 nodes
// =============================================================================

#[tokio::test]
async fn test_signature_aggregation_threshold() {
    let config = test_config();
    let order = test_cross_chain_order();

    // Setup shared mock reader
    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(order.order_id, order_to_data(&order)).await;

    // Create 3 orchestrators (1 leader + 2 followers)
    let l3_chain = Arc::new(MockChainBuilder::new().build());

    let leader = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    let follower1 = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(1),
        test_peer_id(1),
        1,
    );

    let follower2 = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(2),
        test_peer_id(2),
        2,
    );

    // Leader creates proposal and starts collection
    let proposal = leader.propose_bridge_arb_to_l3(&order).unwrap();
    leader.start_signature_collection(order.order_id, proposal.leader_signature.clone()).await;

    // Follower 1 signs
    let sig1 = follower1.sign_bridge_proposal(&proposal).unwrap();

    // Add follower 1's signature - should not reach threshold yet
    let result = leader.add_follower_signature(order.order_id, 1, sig1).await.unwrap();
    // With leader (index 0) + follower1 (index 1) = 2 signatures, threshold (2) is reached
    assert!(result.is_some());

    let bridge_result = result.unwrap();
    assert_eq!(bridge_result.signature_count, 2);
    assert!(bridge_result.signer_bitmap.bit(0)); // Leader signed
    assert!(bridge_result.signer_bitmap.bit(1)); // Follower1 signed
    assert!(!bridge_result.signer_bitmap.bit(2)); // Follower2 did not sign

    // Follower 2 signs (optional, threshold already reached)
    let sig2 = follower2.sign_bridge_proposal(&proposal).unwrap();
    let result = leader.add_follower_signature(order.order_id, 2, sig2).await.unwrap();
    // Should return aggregated result with 3 signatures now
    assert!(result.is_some());
    let bridge_result = result.unwrap();
    assert_eq!(bridge_result.signature_count, 3);
}

// =============================================================================
// Test 7: Full flow - CrossChainOrder → proposal → signatures → execution
// =============================================================================

#[tokio::test]
async fn test_full_bridge_flow_3_nodes() {
    let config = test_config();
    let order = test_cross_chain_order();

    // Setup shared mock reader
    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(order.order_id, order_to_data(&order)).await;

    // Setup L3 chain
    let l3_chain = Arc::new(MockChainBuilder::new().build());

    // Create leader orchestrator
    let leader = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    // Create follower orchestrators
    let follower1 = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(1),
        test_peer_id(1),
        1,
    );

    let follower2 = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(2),
        test_peer_id(2),
        2,
    );

    // Step 1: Leader creates proposal
    let proposal = leader.propose_bridge_arb_to_l3(&order).unwrap();
    assert_eq!(proposal.order_id, order.order_id);

    // Step 2: Leader starts signature collection with its own signature
    leader.start_signature_collection(order.order_id, proposal.leader_signature.clone()).await;

    // Step 3: Followers validate and sign
    assert!(follower1.validate_bridge_proposal(&proposal).await.unwrap());
    let sig1 = follower1.sign_bridge_proposal(&proposal).unwrap();

    assert!(follower2.validate_bridge_proposal(&proposal).await.unwrap());
    let _sig2 = follower2.sign_bridge_proposal(&proposal).unwrap();

    // Step 4: Leader collects signatures
    let result1 = leader.add_follower_signature(order.order_id, 1, sig1).await.unwrap();
    // With 2 signatures (leader + follower1), threshold is reached
    let bridge_result = result1.expect("should have bridge result after reaching threshold");
    assert!(bridge_result.signature_count >= config.min_signatures);

    // Step 5: Execute bridge (mint L3Usdc)
    let tx_hash = leader.execute_bridge_arb_to_l3(&proposal, &bridge_result).await.unwrap();

    // Verify tx_hash is not zero
    assert_ne!(tx_hash, H256::zero());

    // Verify order status is updated
    let status = leader.get_order_status(&order.order_id).await;
    assert_eq!(status, Some(BridgeOrderStatus::BridgedToL3));

    // Verify order is marked as processed (replay protection)
    assert!(leader.is_order_processed(&order.order_id).await);
}

// =============================================================================
// Test 8: L3Usdc mint transaction is built correctly
// =============================================================================

#[tokio::test]
async fn test_l3_usdc_mint_transaction_format() {
    let config = test_config();
    let order = test_cross_chain_order();

    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(order.order_id, order_to_data(&order)).await;

    let l3_chain = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        mock_reader,
        l3_chain.clone(),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    let proposal = orchestrator.propose_bridge_arb_to_l3(&order).unwrap();

    // Create a minimal bridge result
    let bridge_result = issuer::bridge::BridgeResult {
        aggregated_signature: common::types::BLSSignature(vec![0u8; 64]),
        signer_bitmap: U256::from(3), // bits 0 and 1 set
        signature_count: 2,
    };

    // Execute bridge
    let tx_hash = orchestrator.execute_bridge_arb_to_l3(&proposal, &bridge_result).await.unwrap();

    // Verify transaction was submitted
    assert_ne!(tx_hash, H256::zero());

    // The MockChain doesn't allow us to inspect calldata directly, but we can verify:
    // 1. Transaction was submitted successfully (no error)
    // 2. Order is now marked as processed
    // 3. Order status is BridgedToL3
    assert!(orchestrator.is_order_processed(&order.order_id).await);
    assert_eq!(
        orchestrator.get_order_status(&order.order_id).await,
        Some(BridgeOrderStatus::BridgedToL3)
    );
}

// =============================================================================
// Test 9: Duplicate signature is rejected
// =============================================================================

#[tokio::test]
async fn test_duplicate_signature_rejected() {
    let config = test_config();
    let order = test_cross_chain_order();

    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(order.order_id, order_to_data(&order)).await;

    let l3_chain = Arc::new(MockChainBuilder::new().build());

    let leader = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    let follower = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(1),
        test_peer_id(1),
        1,
    );

    let proposal = leader.propose_bridge_arb_to_l3(&order).unwrap();
    leader.start_signature_collection(order.order_id, proposal.leader_signature.clone()).await;

    let sig = follower.sign_bridge_proposal(&proposal).unwrap();

    // First signature should succeed and reach threshold
    let result1 = leader.add_follower_signature(order.order_id, 1, sig.clone()).await.unwrap();
    assert!(result1.is_some()); // Threshold reached

    // Duplicate signature from same signer should return None (signature ignored, no new aggregation)
    let result2 = leader.add_follower_signature(order.order_id, 1, sig).await.unwrap();
    // Result is None because the duplicate was rejected and no new signatures were added
    assert!(result2.is_none());
}

// =============================================================================
// Test 10: Expired order is rejected during validation
// =============================================================================

#[tokio::test]
async fn test_expired_order_rejected() {
    let config = test_config();

    // Create an order with past deadline
    let mut expired_order = test_cross_chain_order();
    expired_order.deadline = U256::from(1000u64); // Year 1970 - definitely expired

    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(expired_order.order_id, order_to_data(&expired_order)).await;

    let l3_chain = Arc::new(MockChainBuilder::new().build());

    // Leader creates proposal (doesn't check expiration at proposal time)
    let leader = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    let proposal = leader.propose_bridge_arb_to_l3(&expired_order).unwrap();

    // Follower should reject during validation due to expired deadline
    let follower = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(1),
        test_peer_id(1),
        1,
    );

    let result = follower.validate_bridge_proposal(&proposal).await;
    assert!(matches!(result, Err(BridgeError::OrderExpired { .. })));
}

// =============================================================================
// Test 11: Replay protection prevents double processing
// =============================================================================

#[tokio::test]
async fn test_replay_protection() {
    let config = test_config();
    let order = test_cross_chain_order();

    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(order.order_id, order_to_data(&order)).await;

    let l3_chain = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        mock_reader,
        l3_chain.clone(),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    // Create and execute first bridge
    let proposal = orchestrator.propose_bridge_arb_to_l3(&order).unwrap();
    let bridge_result = issuer::bridge::BridgeResult {
        aggregated_signature: common::types::BLSSignature(vec![0u8; 64]),
        signer_bitmap: U256::from(3),
        signature_count: 2,
    };
    orchestrator.execute_bridge_arb_to_l3(&proposal, &bridge_result).await.unwrap();

    // Order should now be marked as processed
    assert!(orchestrator.is_order_processed(&order.order_id).await);

    // Validation should reject already-processed order
    let is_valid = orchestrator.validate_bridge_proposal(&proposal).await.unwrap();
    assert!(!is_valid);
}

// =============================================================================
// Test 12: Message hash is deterministic across nodes
// =============================================================================

#[tokio::test]
async fn test_message_hash_deterministic_across_nodes() {
    let config = test_config();
    let order = test_cross_chain_order();

    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(order.order_id, order_to_data(&order)).await;

    let l3_chain = Arc::new(MockChainBuilder::new().build());

    // Create 3 different orchestrators
    let node0 = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    let node1 = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(1),
        test_peer_id(1),
        1,
    );

    let node2 = BridgeOrchestrator::new(
        config.clone(),
        mock_reader.clone(),
        l3_chain.clone(),
        test_keypair(2),
        test_peer_id(2),
        2,
    );

    // All nodes should compute the same message hash
    let proposal0 = node0.propose_bridge_arb_to_l3(&order).unwrap();
    let proposal1 = node1.propose_bridge_arb_to_l3(&order).unwrap();
    let proposal2 = node2.propose_bridge_arb_to_l3(&order).unwrap();

    assert_eq!(proposal0.message_hash, proposal1.message_hash);
    assert_eq!(proposal1.message_hash, proposal2.message_hash);
}

// =============================================================================
// Test 13: Stale collector cleanup
// =============================================================================

#[tokio::test]
async fn test_stale_collector_cleanup() {
    let config = test_config();
    let order = test_cross_chain_order();

    let mock_reader = Arc::new(MockCrossChainOrderReader::new());
    mock_reader.add_order(order.order_id, order_to_data(&order)).await;

    let l3_chain = Arc::new(MockChainBuilder::new().build());

    let orchestrator = BridgeOrchestrator::new(
        config.clone(),
        mock_reader,
        l3_chain.clone(),
        test_keypair(0),
        test_peer_id(0),
        0,
    );

    // Start collection
    let proposal = orchestrator.propose_bridge_arb_to_l3(&order).unwrap();
    orchestrator.start_signature_collection(order.order_id, proposal.leader_signature.clone()).await;

    // Cleanup with very small max_age should remove the collector
    // Wait a tiny bit to ensure elapsed time is > 0
    tokio::time::sleep(Duration::from_millis(5)).await;
    orchestrator.cleanup_stale_collectors(1).await; // 1ms max age

    // Trying to add signature should fail since collector was removed
    let result = orchestrator.add_follower_signature(
        order.order_id,
        1,
        common::types::BLSSignature(vec![0u8; 64]),
    ).await;
    assert!(matches!(result, Err(BridgeError::OrderNotFound { .. })));
}
