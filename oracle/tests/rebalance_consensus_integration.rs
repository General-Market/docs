//! Rebalance consensus integration tests (Story 7-14, Task 4.5)
//!
//! Tests 3 ConsensusProtocol instances with BridgeOrchestrators communicating
//! via MockP2PNetwork. Validates rebalance batch and update weights consensus:
//! - run_rebalance_batch_phase achieves 2/3 threshold
//! - run_update_weights_phase achieves 2/3 threshold
//! - BLS signature aggregation produces valid output

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use ethers::types::{Address, H256, U256};
use tokio::sync::RwLock;

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::mocks::{MockChainBuilder, MockP2PNetworkBuilder};
use common::traits::{BLSSigner, P2PTransport};
use common::types::{BLSSignature, PeerId};
use oracle::bridge::{BridgeConfig, BridgeError, BridgeOrchestrator, CrossChainOrderReader};
use oracle::chain::CrossChainOrderData;
use oracle::consensus::aggregator::calculate_threshold;
use oracle::{
    ConsensusConfig, ConsensusProtocol, ConsensusTimeouts,
    InMemoryKeyRegistry, MockPriceFetcher, MockPriceFetcherBuilder,
};

/// Test timeouts
const TEST_TIMEOUT_MS: u64 = 500;

fn test_timeouts() -> ConsensusTimeouts {
    ConsensusTimeouts::new(
        Duration::from_millis(TEST_TIMEOUT_MS),
        Duration::from_millis(TEST_TIMEOUT_MS),
        Duration::from_millis(TEST_TIMEOUT_MS),
        Duration::from_millis(TEST_TIMEOUT_MS),
    )
}

fn test_bridge_config() -> BridgeConfig {
    BridgeConfig {
        oracle_custody_l3: Address::from([0x11u8; 20]),
        l3_usdc_address: Address::from([0x22u8; 20]),
        settlement_custody_address: Address::from([0x33u8; 20]),
        settlement_chain_id: 42161,
        l3_chain_id: 111222333,
        index_address: Address::from([0x44u8; 20]),
        min_signatures: 2,
        proposal_timeout_ms: TEST_TIMEOUT_MS,
        sign_timeout_ms: TEST_TIMEOUT_MS,
        oracle_custody_settlement: Address::from([0x55u8; 20]),
        settlement_usdc_address: Address::from([0x66u8; 20]),
        bitget_vault: Address::from([0x77u8; 20]),
        signer_address: Address::from([0x88; 20]),
        collateral_registry: Address::zero(),
        bridge_proxy: Address::zero(),
    }
}

/// Mock CrossChainOrderReader (required by BridgeOrchestrator)
struct MockCrossChainOrderReader;

#[async_trait]
impl CrossChainOrderReader for MockCrossChainOrderReader {
    async fn get_cross_chain_order(
        &self,
        order_id: U256,
    ) -> Result<CrossChainOrderData, BridgeError> {
        Err(BridgeError::OrderNotFound { order_id })
    }
}

fn test_peer_id(idx: u8) -> PeerId {
    let mut p = [0u8; 32];
    p[0] = idx;
    p
}

fn test_keypair(idx: u8) -> BLSKeyPair {
    let mut seed = [0u8; 32];
    seed[0] = idx;
    seed[1] = 0x42;
    BLSKeyPair::from_seed(&seed).expect("valid seed")
}

fn build_price_fetcher() -> MockPriceFetcher {
    let builder = MockPriceFetcherBuilder::new();
    builder.build()
}

/// Build 3-node network with BridgeOrchestrators attached.
async fn build_3_node_network_with_orchestrators() -> (
    Vec<
        Arc<
            ConsensusProtocol<
                common::mocks::MockP2P,
                common::mocks::MockChain,
                InMemoryKeyRegistry,
                MockPriceFetcher,
            >,
        >,
    >,
    Vec<Arc<common::mocks::MockP2P>>,
) {
    let (_network, nodes) = MockP2PNetworkBuilder::new()
        .with_node_count(3)
        .build()
        .await;

    let (key_registry, _generated_keypairs) = InMemoryKeyRegistry::generate_test_registry(3);
    let key_registry = Arc::new(key_registry);

    let config = test_bridge_config();
    let mut protocols = Vec::new();
    let mut p2p_arcs = Vec::new();

    for (idx, node) in nodes.into_iter().enumerate() {
        let peer_id = node.peer_id();
        let p2p = Arc::new(node);
        let chain = Arc::new(MockChainBuilder::new().build());
        let price_fetcher = Arc::new(build_price_fetcher());
        let keypair = test_keypair(idx as u8);

        let threshold = calculate_threshold(3); // 2
        let consensus_config = ConsensusConfig::new(peer_id, 3, idx as u8)
            .with_timeouts(test_timeouts())
            .with_signature_threshold(threshold);

        let protocol = Arc::new(ConsensusProtocol::new(
            keypair.clone(),
            p2p.clone(),
            chain.clone(),
            key_registry.clone(),
            price_fetcher,
            consensus_config,
        ));

        // Create BridgeOrchestrator for this node
        let mock_reader = Arc::new(MockCrossChainOrderReader);
        let l3_chain = Arc::new(MockChainBuilder::new().build());
        let orchestrator = BridgeOrchestrator::new(
            config.clone(),
            mock_reader,
            l3_chain,
            keypair,
            peer_id,
            idx as u8,
        );
        let orchestrator = Arc::new(RwLock::new(orchestrator));
        protocol.set_bridge_orchestrator(orchestrator).await;

        protocols.push(protocol);
        p2p_arcs.push(p2p);
    }

    (protocols, p2p_arcs)
}

/// Start message routers for all nodes.
fn start_routers<P, C, K, F>(
    protocols: &[Arc<ConsensusProtocol<P, C, K, F>>],
    p2ps: &[Arc<P>],
) -> Vec<tokio::task::JoinHandle<()>>
where
    P: P2PTransport + 'static,
    C: common::traits::ChainWriter + 'static,
    K: oracle::KeyRegistry + 'static,
    F: oracle::PriceFetcher + 'static,
{
    let mut router_handles = Vec::new();
    for (protocol, p2p) in protocols.iter().zip(p2ps.iter()) {
        let router_protocol = protocol.clone();
        let router_p2p = p2p.clone();
        let router_handle = tokio::spawn(async move {
            use futures::StreamExt;
            let stream = match router_p2p.receive().await {
                Ok(s) => s,
                Err(_) => return,
            };
            tokio::pin!(stream);
            while let Some(Ok((from, message))) = stream.next().await {
                let _ = router_protocol.handle_message(from, message).await;
            }
        });
        router_handles.push(router_handle);
    }
    router_handles
}

// =============================================================================
// Test 1: Rebalance batch consensus achieves threshold with 3 nodes
// =============================================================================

#[tokio::test]
async fn test_3node_rebalance_batch_consensus() {
    let (protocols, p2ps) = build_3_node_network_with_orchestrators().await;

    // Start message routers
    let router_handles = start_routers(&protocols, &p2ps);
    tokio::task::yield_now().await;

    let cycle_number = 1u64;
    let itp_ids = vec![
        H256::from([0x01u8; 32]),
        H256::from([0x02u8; 32]),
    ];

    // Leader is node 0 for this test
    let leader_idx = 0usize;

    // Spawn all 3 nodes running the rebalance batch phase
    let mut handles = Vec::new();
    for (idx, protocol) in protocols.iter().enumerate() {
        let p = protocol.clone();
        let ids = itp_ids.clone();
        let am_leader = idx == leader_idx;
        handles.push(tokio::spawn(async move {
            p.run_rebalance_batch_phase(cycle_number, ids, am_leader).await
        }));
    }

    // Wait for results with timeout
    let results = tokio::time::timeout(Duration::from_secs(5), async {
        let mut results = Vec::new();
        for handle in handles {
            results.push(handle.await.expect("task panicked"));
        }
        results
    })
    .await
    .expect("rebalance batch consensus timed out");

    // Abort routers
    for h in router_handles {
        h.abort();
    }

    // Leader should have a successful result with threshold signatures
    let leader_result = &results[leader_idx];
    match leader_result {
        Ok(result) => {
            assert!(
                result.signature_count >= 2,
                "Need at least 2 signatures (threshold for 3 nodes), got {}",
                result.signature_count
            );
            assert_eq!(
                result.aggregated_signature.0.len(),
                64,
                "Aggregated signature should be 64 bytes"
            );
            assert!(
                result.aggregated_signature.0.iter().any(|&b| b != 0),
                "Aggregated signature should not be all zeros"
            );
        }
        Err(e) => {
            panic!("Leader rebalance batch consensus failed: {}", e);
        }
    }
}

// =============================================================================
// Test 2: Update weights consensus achieves threshold with 3 nodes
// =============================================================================

#[tokio::test]
async fn test_3node_update_weights_consensus() {
    let (protocols, p2ps) = build_3_node_network_with_orchestrators().await;

    // Start message routers
    let router_handles = start_routers(&protocols, &p2ps);
    tokio::task::yield_now().await;

    let itp_id = H256::from([0x01u8; 32]);
    let new_weights = vec![
        U256::from(5000u64), // 50%
        U256::from(3000u64), // 30%
        U256::from(2000u64), // 20%
    ];

    let leader_idx = 0usize;

    // Spawn all 3 nodes running the update weights phase
    let mut handles = Vec::new();
    for (idx, protocol) in protocols.iter().enumerate() {
        let p = protocol.clone();
        let weights = new_weights.clone();
        let id = itp_id;
        let am_leader = idx == leader_idx;
        handles.push(tokio::spawn(async move {
            p.run_update_weights_phase(id, weights, vec![], U256::zero(), am_leader).await
        }));
    }

    // Wait for results
    let results = tokio::time::timeout(Duration::from_secs(5), async {
        let mut results = Vec::new();
        for handle in handles {
            results.push(handle.await.expect("task panicked"));
        }
        results
    })
    .await
    .expect("update weights consensus timed out");

    // Abort routers
    for h in router_handles {
        h.abort();
    }

    // Leader should have a successful result
    let leader_result = &results[leader_idx];
    match leader_result {
        Ok(result) => {
            assert!(
                result.signature_count >= 2,
                "Need at least 2 signatures (threshold for 3 nodes), got {}",
                result.signature_count
            );
            assert_eq!(
                result.aggregated_signature.0.len(),
                64,
                "Aggregated signature should be 64 bytes"
            );
        }
        Err(e) => {
            panic!("Leader update weights consensus failed: {}", e);
        }
    }
}

// =============================================================================
// Test 3: Rebalance batch hash is deterministic across nodes
// =============================================================================

#[tokio::test]
async fn test_rebalance_batch_hash_deterministic() {
    use oracle::bridge::build_rebalance_batch_hash;

    let chain_id = 111222333u64;
    let index_address = Address::from([0x44u8; 20]);
    let cycle_number = 42u64;
    let itp_ids = vec![
        H256::from([0x01u8; 32]),
        H256::from([0x02u8; 32]),
    ];

    let hash1 = build_rebalance_batch_hash(chain_id, index_address, cycle_number, &itp_ids);
    let hash2 = build_rebalance_batch_hash(chain_id, index_address, cycle_number, &itp_ids);

    assert_eq!(hash1, hash2, "Hash must be deterministic");
    assert_ne!(hash1, H256::zero(), "Hash should not be zero");
}

// =============================================================================
// Test 4: Update weights hash is deterministic across nodes
// =============================================================================

#[tokio::test]
async fn test_update_weights_hash_deterministic() {
    use oracle::bridge::build_update_weights_hash;

    let chain_id = 111222333u64;
    let index_address = Address::from([0x44u8; 20]);
    let itp_id = H256::from([0x01u8; 32]);
    let new_weights = vec![U256::from(5000u64), U256::from(5000u64)];
    let new_inventory = vec![U256::from(100u64), U256::from(200u64)];
    let nav = U256::from(1_000_000_000_000_000_000u64);

    let hash1 = build_update_weights_hash(chain_id, index_address, itp_id, &new_weights, &new_inventory, nav);
    let hash2 = build_update_weights_hash(chain_id, index_address, itp_id, &new_weights, &new_inventory, nav);

    assert_eq!(hash1, hash2, "Hash must be deterministic");
    assert_ne!(hash1, H256::zero(), "Hash should not be zero");
}

// =============================================================================
// Test 5: Rebalance batch with single ITP
// =============================================================================

#[tokio::test]
async fn test_rebalance_batch_single_itp() {
    let (protocols, p2ps) = build_3_node_network_with_orchestrators().await;

    let router_handles = start_routers(&protocols, &p2ps);
    tokio::task::yield_now().await;

    let cycle_number = 1u64;
    let itp_ids = vec![H256::from([0xAA; 32])]; // single ITP

    let leader_idx = 0usize;

    let mut handles = Vec::new();
    for (idx, protocol) in protocols.iter().enumerate() {
        let p = protocol.clone();
        let ids = itp_ids.clone();
        let am_leader = idx == leader_idx;
        handles.push(tokio::spawn(async move {
            p.run_rebalance_batch_phase(cycle_number, ids, am_leader).await
        }));
    }

    let results = tokio::time::timeout(Duration::from_secs(5), async {
        let mut results = Vec::new();
        for handle in handles {
            results.push(handle.await.expect("task panicked"));
        }
        results
    })
    .await
    .expect("rebalance batch consensus timed out");

    for h in router_handles {
        h.abort();
    }

    // Leader should succeed even with single ITP
    assert!(results[leader_idx].is_ok(), "Single ITP rebalance batch should succeed");
    let result = results[leader_idx].as_ref().unwrap();
    assert!(result.signature_count >= 2);
}
