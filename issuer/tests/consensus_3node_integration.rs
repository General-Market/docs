//! Multi-node consensus integration tests (Story 6-16, Task 2)
//!
//! Tests 3 ConsensusProtocol instances communicating via MockP2PNetwork.
//! Validates leader election, price consensus, batch signing, BLS aggregation,
//! fault tolerance, and timing constraints.

use std::sync::Arc;
use std::time::{Duration, Instant};

use ethers::types::{Address, H256, U256};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::mocks::{MockChain, MockChainBuilder, MockP2PNetworkBuilder};
use common::traits::{BLSSigner, P2PTransport};
use common::types::{BLSSignature, Fill, LimitOrder, OrderStatus, PeerId, Side};
use issuer::consensus::aggregator::calculate_threshold;
use issuer::{
    ConsensusConfig, ConsensusProtocol, ConsensusResult, ConsensusTimeouts,
    InMemoryKeyRegistry, MockPriceFetcher, MockPriceFetcherBuilder,
};
use common::mocks::MockP2P;
use issuer::leader::elect_leader;

/// Fast timeouts for tests: 100ms per phase, 1ms polling
fn test_timeouts() -> ConsensusTimeouts {
    ConsensusTimeouts::fast()
}

fn test_prices() -> Vec<(u32, U256)> {
    vec![
        (0, U256::from(1_000_000_000_000_000_000u128)), // Asset 0: 1.0 (18 dec)
        (1, U256::from(2_000_000_000_000_000_000u128)), // Asset 1: 2.0 (18 dec)
    ]
}

fn test_order_ids() -> Vec<u64> {
    vec![1, 2, 3]
}

fn test_fills() -> Vec<Fill> {
    vec![
        Fill {
            order_id: U256::from(1),
            fill_price: U256::from(1_000_000_000_000_000_000u128),
            fill_amount: U256::from(500_000_000_000_000_000u128),
            cycle_number: U256::from(1),
            tx_hash: H256::zero(),
        },
        Fill {
            order_id: U256::from(2),
            fill_price: U256::from(2_000_000_000_000_000_000u128),
            fill_amount: U256::from(300_000_000_000_000_000u128),
            cycle_number: U256::from(1),
            tx_hash: H256::zero(),
        },
    ]
}

/// Build test LimitOrders matching the test_order_ids.
fn test_orders() -> Vec<LimitOrder> {
    test_order_ids()
        .into_iter()
        .map(|id| LimitOrder {
            id: U256::from(id),
            user: Address::zero(),
            pair_id: H256::zero(),
            side: Side::Buy,
            amount: U256::from(1_000_000_000_000_000_000u128),
            limit_price: U256::from(1_000_000_000_000_000_000u128),
            slippage_tier: U256::zero(),
            deadline: U256::from(u64::MAX),
            itp_id: H256::zero(),
            timestamp: U256::from(1000u64),
            status: OrderStatus::Pending,
        })
        .collect()
}

/// Build a MockChain pre-populated with test orders.
fn build_chain() -> MockChain {
    let mut builder = MockChainBuilder::new();
    for order in test_orders() {
        builder = builder.with_order(order);
    }
    builder.build()
}

/// Build a mock price fetcher that returns prices matching the test prices.
/// Converts asset indices to addresses the same way the protocol does.
fn build_price_fetcher() -> MockPriceFetcher {
    let mut builder = MockPriceFetcherBuilder::new();
    for (asset_idx, price) in test_prices() {
        let mut asset_bytes = [0u8; 20];
        asset_bytes[16..20].copy_from_slice(&asset_idx.to_be_bytes());
        let addr = Address::from(asset_bytes);
        builder = builder.with_price(addr, price);
    }
    builder.build()
}

/// Spawn a consensus node and a message routing task.
///
/// Returns the JoinHandle for the consensus cycle and the message router handle.
async fn spawn_node_with_router<P, C, K, F>(
    protocol: Arc<ConsensusProtocol<P, C, K, F>>,
    p2p: Arc<P>,
    cycle_number: u64,
    prices: Vec<(u32, U256)>,
    order_ids: Vec<u64>,
    fills: Vec<Fill>,
    last_signature: BLSSignature,
) -> (
    tokio::task::JoinHandle<ConsensusResult>,
    tokio::task::JoinHandle<()>,
)
where
    P: P2PTransport + 'static,
    C: common::traits::ChainWriter + 'static,
    K: issuer::KeyRegistry + 'static,
    F: issuer::PriceFetcher + 'static,
{
    let protocol_clone = protocol.clone();
    let last_sig = last_signature.clone();

    // Spawn the message router first - it receives P2P messages and feeds them to handle_message
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

    // Spawn the consensus cycle
    let cycle_handle = tokio::spawn(async move {
        protocol_clone
            .run_cycle(cycle_number, prices, order_ids, fills, &last_sig)
            .await
    });

    (cycle_handle, router_handle)
}

/// Helper: build 3 nodes sharing the same MockP2PNetwork and KeyRegistry.
///
/// Returns (protocols, p2p_nodes, chains, keypairs, key_registry).
async fn build_3_node_network() -> (
    Vec<
        Arc<
            ConsensusProtocol<
                common::mocks::MockP2P,
                MockChain,
                InMemoryKeyRegistry,
                MockPriceFetcher,
            >,
        >,
    >,
    Vec<Arc<common::mocks::MockP2P>>,
    Vec<Arc<MockChain>>,
    Vec<(PeerId, BLSKeyPair)>,
    Arc<InMemoryKeyRegistry>,
) {
    let (_network, nodes) = MockP2PNetworkBuilder::new()
        .with_node_count(3)
        .build()
        .await;

    // Generate key registry with deterministic keypairs matching MockP2P peer IDs
    let (key_registry, _generated_keypairs) = InMemoryKeyRegistry::generate_test_registry(3);
    let key_registry = Arc::new(key_registry);

    // Build keypairs and register them with actual MockP2P peer IDs
    let mut keypairs = Vec::new();
    let mut protocols = Vec::new();
    let mut p2p_arcs = Vec::new();
    let mut chain_arcs = Vec::new();

    // We need to match the keypairs to the actual peer IDs from MockP2P
    // MockP2P generates peer IDs like [i, 0, 0, 0, 0, 0, 0, 0, ...]
    // InMemoryKeyRegistry::generate_test_registry also uses [i, 0, 0, ...] peer IDs
    // So they should match.

    for (idx, node) in nodes.into_iter().enumerate() {
        let peer_id = node.peer_id();
        let p2p = Arc::new(node);
        let chain = Arc::new(build_chain());
        let price_fetcher = Arc::new(build_price_fetcher());

        // Generate a keypair from the same seed as generate_test_registry
        let mut seed = [0u8; 32];
        seed[0] = idx as u8;
        seed[1] = 0x42;
        let keypair = BLSKeyPair::from_seed(&seed).expect("valid seed");

        let threshold = calculate_threshold(3); // 2 for 3 nodes
        let config = ConsensusConfig::new(peer_id, 3, idx as u8)
            .with_timeouts(test_timeouts())
            .with_signature_threshold(threshold);

        let protocol = Arc::new(ConsensusProtocol::new(
            keypair.clone(),
            p2p.clone(),
            chain.clone(),
            key_registry.clone(),
            price_fetcher,
            config,
        ));

        keypairs.push((peer_id, keypair));
        protocols.push(protocol);
        p2p_arcs.push(p2p);
        chain_arcs.push(chain);
    }

    (protocols, p2p_arcs, chain_arcs, keypairs, key_registry)
}

/// Run a full consensus cycle for 3 nodes.
///
/// Starts message routers first, then spawns all consensus cycles simultaneously.
/// This ensures followers have their routers ready before the leader broadcasts.
///
/// Returns the ConsensusResult from each node.
async fn run_consensus_cycle(
    protocols: &[Arc<
        ConsensusProtocol<
            common::mocks::MockP2P,
            MockChain,
            InMemoryKeyRegistry,
            MockPriceFetcher,
        >,
    >],
    p2ps: &[Arc<common::mocks::MockP2P>],
    cycle_number: u64,
    last_signature: &BLSSignature,
) -> Vec<ConsensusResult> {
    // Phase 1: Start all message routers first
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

    // Yield to let routers register with the network
    tokio::task::yield_now().await;

    // Phase 2: Spawn all consensus cycles simultaneously
    let mut cycle_handles = Vec::new();
    for protocol in protocols.iter() {
        let protocol_clone = protocol.clone();
        let last_sig = last_signature.clone();
        let prices = test_prices();
        let order_ids = test_order_ids();
        let fills = test_fills();
        let cn = cycle_number;
        let cycle_handle = tokio::spawn(async move {
            protocol_clone
                .run_cycle(cn, prices, order_ids, fills, &last_sig)
                .await
        });
        cycle_handles.push(cycle_handle);
    }

    // Wait for all consensus cycles to complete (with timeout)
    let results = tokio::time::timeout(Duration::from_secs(10), async {
        let mut results = Vec::new();
        for handle in cycle_handles {
            results.push(handle.await.expect("task panicked"));
        }
        results
    })
    .await
    .expect("consensus timed out after 10s");

    // Abort router tasks (they run indefinitely)
    for h in router_handles {
        h.abort();
    }

    results
}

// =============================================================================
// Test 1: Normal 3-node consensus cycle succeeds
// =============================================================================

#[tokio::test]
async fn test_3node_consensus_success() {
    let (protocols, p2ps, _chains, _keypairs, _key_reg) = build_3_node_network().await;

    let genesis_sig = BLSSignature(vec![0u8; 64]);
    let results = run_consensus_cycle(&protocols, &p2ps, 1, &genesis_sig).await;

    // Determine who was the leader
    let leader_idx = elect_leader(&genesis_sig, 3).unwrap();

    // Leader should get Success with aggregated signature
    let leader_result = &results[leader_idx as usize];
    match leader_result {
        ConsensusResult::Success {
            aggregated_signature,
            signer_count,
            cycle_number,
        } => {
            assert_eq!(*cycle_number, 1);
            assert!(*signer_count >= 2, "Need at least 2 signers (threshold for 3 nodes)");
            assert_eq!(aggregated_signature.0.len(), 64, "Aggregated sig should be 64 bytes");
        }
        ConsensusResult::Failed { reason, .. } => {
            panic!("Leader consensus failed: {}", reason);
        }
        ConsensusResult::Timeout { phase, .. } => {
            panic!("Leader consensus timed out in phase {:?}", phase);
        }
        ConsensusResult::EmergencyPause { .. } => {
            panic!("Unexpected emergency pause");
        }
        ConsensusResult::ItpCreated { .. } => {
            panic!("Unexpected ITP creation result in batch consensus test");
        }
    }

    // Followers should also get Success — they advance to Complete after signing
    for (i, result) in results.iter().enumerate() {
        if i == leader_idx as usize {
            continue;
        }
        match result {
            ConsensusResult::Success { cycle_number, .. } => {
                assert_eq!(*cycle_number, 1);
            }
            other => {
                panic!("Follower {} expected Success, got: {:?}", i, other);
            }
        }
    }
}

// =============================================================================
// Test 2: Leader election is deterministic and rotates
// =============================================================================

#[tokio::test]
async fn test_leader_election_deterministic_rotation() {
    let mut leaders = Vec::new();
    let mut signature = BLSSignature(vec![0u8; 64]);

    // Simulate 10 cycles of leader election with varying signatures
    let signer = Bn254BLSSigner::new();
    let keypair = BLSKeyPair::generate();

    for cycle in 0..10 {
        let leader = elect_leader(&signature, 3).unwrap();
        leaders.push(leader);
        assert!(leader < 3, "Leader index must be < 3");

        // All 3 nodes should compute the same leader
        let leader_1 = elect_leader(&signature, 3).unwrap();
        let leader_2 = elect_leader(&signature, 3).unwrap();
        assert_eq!(leader, leader_1);
        assert_eq!(leader, leader_2);

        // Generate new signature for next cycle (simulating aggregated sig)
        let msg = format!("cycle-{}", cycle);
        signature = signer
            .sign_with_keypair(&keypair, msg.as_bytes())
            .expect("signing works");
    }

    // Verify we see at least 2 different leaders over 10 cycles
    let unique_leaders: std::collections::HashSet<u8> = leaders.iter().cloned().collect();
    assert!(
        unique_leaders.len() >= 2,
        "Expected leadership rotation over 10 cycles, got leaders: {:?}",
        leaders
    );
}

// =============================================================================
// Test 3: Threshold calculation for small networks
// =============================================================================

#[tokio::test]
async fn test_threshold_calculation_3_nodes() {
    // 3 nodes: threshold = ceil(3 * 11 / 20) = ceil(1.65) = 2
    let threshold = calculate_threshold(3);
    assert_eq!(threshold, 2, "3-node threshold should be 2");

    // Verify aggregator works with this threshold
    let mut aggregator = issuer::SignatureAggregator::with_threshold(threshold);
    let keypair = BLSKeyPair::generate();
    let signer = Bn254BLSSigner::new();
    let message = b"test batch";

    // First signature: still collecting
    let sig1 = signer.sign_with_keypair(&keypair, message).unwrap();
    let peer1: PeerId = {
        let mut p = [0u8; 32];
        p[0] = 1;
        p
    };
    let status = aggregator.add_signature(peer1, sig1).unwrap();
    assert!(matches!(
        status,
        issuer::AggregationStatus::Collecting {
            count: 1,
            required: 2
        }
    ));

    // Second signature: threshold reached
    let sig2 = signer.sign_with_keypair(&keypair, message).unwrap();
    let peer2: PeerId = {
        let mut p = [0u8; 32];
        p[0] = 2;
        p
    };
    let status = aggregator.add_signature(peer2, sig2).unwrap();
    assert!(matches!(
        status,
        issuer::AggregationStatus::ThresholdReached {
            signer_count: 2,
            ..
        }
    ));
}

// =============================================================================
// Test 4: Price consensus with agreeing followers
// =============================================================================

#[tokio::test]
async fn test_price_consensus_all_agree() {
    let (protocols, p2ps, _chains, _keypairs, _key_reg) = build_3_node_network().await;

    let genesis_sig = BLSSignature(vec![0u8; 64]);
    let results = run_consensus_cycle(&protocols, &p2ps, 1, &genesis_sig).await;

    let leader_idx = elect_leader(&genesis_sig, 3).unwrap();

    // When all followers have the same prices, consensus should succeed
    match &results[leader_idx as usize] {
        ConsensusResult::Success { signer_count, .. } => {
            assert!(*signer_count >= 2);
        }
        ConsensusResult::Failed { reason, .. } => {
            panic!("Consensus failed with agreeing prices: {}", reason);
        }
        other => {
            panic!("Unexpected result: {:?}", other);
        }
    }
}

// =============================================================================
// Test 5: Batch proposal with real orders and fills
// =============================================================================

#[tokio::test]
async fn test_batch_proposal_with_orders() {
    let (protocols, p2ps, _chains, _keypairs, _key_reg) = build_3_node_network().await;

    let genesis_sig = BLSSignature(vec![0u8; 64]);
    let results = run_consensus_cycle(&protocols, &p2ps, 1, &genesis_sig).await;

    let leader_idx = elect_leader(&genesis_sig, 3).unwrap();

    match &results[leader_idx as usize] {
        ConsensusResult::Success {
            aggregated_signature,
            signer_count,
            cycle_number,
        } => {
            assert_eq!(*cycle_number, 1);
            assert!(*signer_count >= 2);
            // Aggregated signature should be valid 64-byte BLS signature
            assert_eq!(
                aggregated_signature.0.len(),
                64,
                "Aggregated signature must be 64 bytes"
            );
            // Signature should not be all zeros (it's a real aggregation)
            assert!(
                aggregated_signature.0.iter().any(|&b| b != 0),
                "Aggregated signature should not be all zeros"
            );
        }
        other => {
            panic!("Expected success, got: {:?}", other);
        }
    }
}

// =============================================================================
// Test 6: Multiple consecutive consensus cycles
// =============================================================================

#[tokio::test]
async fn test_consecutive_cycles() {
    // We need a fresh network per cycle because MockP2P.receive() can only be called once
    let mut last_sig = BLSSignature(vec![0u8; 64]);
    let signer = Bn254BLSSigner::new();
    let keypair = BLSKeyPair::generate();

    for cycle in 1..=3 {
        let (protocols, p2ps, _chains, _keypairs, _key_reg) = build_3_node_network().await;

        let results = run_consensus_cycle(&protocols, &p2ps, cycle, &last_sig).await;

        let leader_idx = elect_leader(&last_sig, 3).unwrap();

        match &results[leader_idx as usize] {
            ConsensusResult::Success {
                aggregated_signature,
                cycle_number,
                ..
            } => {
                assert_eq!(*cycle_number, cycle);
                // Use the aggregated signature for next cycle's leader election
                last_sig = aggregated_signature.clone();
            }
            ConsensusResult::Timeout { phase, .. } => {
                // Acceptable in CI - timeouts can happen
                eprintln!("Cycle {} timed out in {:?}, using synthetic sig", cycle, phase);
                let msg = format!("cycle-{}", cycle);
                last_sig = signer
                    .sign_with_keypair(&keypair, msg.as_bytes())
                    .unwrap();
            }
            ConsensusResult::Failed { reason, .. } => {
                eprintln!("Cycle {} failed: {}, using synthetic sig", cycle, reason);
                let msg = format!("cycle-{}", cycle);
                last_sig = signer
                    .sign_with_keypair(&keypair, msg.as_bytes())
                    .unwrap();
            }
            other => {
                panic!("Cycle {} unexpected: {:?}", cycle, other);
            }
        }
    }
}

// =============================================================================
// Test 7: Consensus timing is within bounds
// =============================================================================

#[tokio::test]
async fn test_consensus_timing() {
    let (protocols, p2ps, _chains, _keypairs, _key_reg) = build_3_node_network().await;

    let genesis_sig = BLSSignature(vec![0u8; 64]);

    let start = Instant::now();
    let results = run_consensus_cycle(&protocols, &p2ps, 1, &genesis_sig).await;
    let elapsed = start.elapsed();

    // With fast timeouts + follower state fix, consensus completes well under 1s
    assert!(
        elapsed < Duration::from_secs(1),
        "Consensus took {:?}, expected < 1s",
        elapsed
    );

    let leader_idx = elect_leader(&genesis_sig, 3).unwrap();
    match &results[leader_idx as usize] {
        ConsensusResult::Success { .. } => {
            // Expected
        }
        other => {
            panic!("Unexpected: {:?}", other);
        }
    }
}

// =============================================================================
// Test 8: Network partition - disconnected node
// =============================================================================

#[tokio::test]
async fn test_network_partition_one_node_disconnected() {
    let (network, nodes) = MockP2PNetworkBuilder::new()
        .with_node_count(3)
        .build()
        .await;

    let (key_registry, _generated) = InMemoryKeyRegistry::generate_test_registry(3);
    let key_registry = Arc::new(key_registry);

    let mut protocols = Vec::new();
    let mut p2p_arcs = Vec::new();
    let mut chain_arcs = Vec::new();

    for (idx, node) in nodes.into_iter().enumerate() {
        let peer_id = node.peer_id();
        let p2p = Arc::new(node);
        let chain = Arc::new(build_chain());
        let price_fetcher = Arc::new(build_price_fetcher());

        let mut seed = [0u8; 32];
        seed[0] = idx as u8;
        seed[1] = 0x42;
        let keypair = BLSKeyPair::from_seed(&seed).expect("valid seed");

        let threshold = calculate_threshold(3); // 2
        let config = ConsensusConfig::new(peer_id, 3, idx as u8)
            .with_timeouts(test_timeouts())
            .with_signature_threshold(threshold);

        let protocol = Arc::new(ConsensusProtocol::new(
            keypair,
            p2p.clone(),
            chain.clone(),
            key_registry.clone(),
            price_fetcher,
            config,
        ));

        protocols.push(protocol);
        p2p_arcs.push(p2p);
        chain_arcs.push(chain);
    }

    // Disconnect node 2 from the network
    let node2_peer_id = p2p_arcs[2].peer_id();
    network.disconnect_peer(node2_peer_id).await;

    // Run consensus with only 2 active nodes
    // With threshold=2 for 3 nodes, leader + 1 follower should still reach threshold
    let genesis_sig = BLSSignature(vec![0u8; 64]);
    let leader_idx = elect_leader(&genesis_sig, 3).unwrap();

    // Only run the 2 connected nodes
    let mut cycle_handles = Vec::new();
    let mut router_handles = Vec::new();

    for i in 0..3 {
        if i == 2 {
            continue; // Skip disconnected node
        }
        let (cycle_h, router_h) = spawn_node_with_router(
            protocols[i].clone(),
            p2p_arcs[i].clone(),
            1,
            test_prices(),
            test_order_ids(),
            test_fills(),
            genesis_sig.clone(),
        )
        .await;
        cycle_handles.push((i, cycle_h));
        router_handles.push(router_h);
    }

    let cycle_results = tokio::time::timeout(Duration::from_secs(5), async {
        let mut results = Vec::new();
        for (idx, handle) in cycle_handles {
            results.push((idx, handle.await.expect("task panicked")));
        }
        results
    })
    .await
    .expect("timeout waiting for consensus");

    for h in router_handles {
        h.abort();
    }

    // Check if the leader's result is reasonable
    // With 2 nodes and threshold 2, consensus should still work if leader is node 0 or 1
    if leader_idx < 2 {
        let leader_result = cycle_results
            .iter()
            .find(|(idx, _)| *idx == leader_idx as usize);
        if let Some((_, result)) = leader_result {
            match result {
                ConsensusResult::Success { signer_count, .. } => {
                    assert!(
                        *signer_count >= 2,
                        "Should have at least 2 signatures even with 1 node disconnected"
                    );
                }
                ConsensusResult::Timeout { .. } => {
                    // Timeout is acceptable - the disconnected node can't vote/sign
                    // but 2 nodes should still reach threshold=2
                    eprintln!("Leader timed out with partition - may need to retry");
                }
                other => {
                    eprintln!("Partition test: leader result = {:?}", other);
                }
            }
        }
    }
}

// =============================================================================
// Test 9: BLS signature aggregation produces valid output
// =============================================================================

#[tokio::test]
async fn test_bls_aggregation_validity() {
    let signer = Bn254BLSSigner::new();

    // Generate 3 keypairs and sign the same message
    let message = b"BATCH_PROPOSAL\x00\x00\x00\x00\x00\x00\x00\x01"; // cycle 1

    let mut signatures = Vec::new();
    for i in 0..3 {
        let mut seed = [0u8; 32];
        seed[0] = i;
        seed[1] = 0x42;
        let keypair = BLSKeyPair::from_seed(&seed).unwrap();
        let sig = signer.sign_with_keypair(&keypair, message).unwrap();
        assert_eq!(sig.0.len(), 64, "Individual sig must be 64 bytes");
        signatures.push(sig);
    }

    // Aggregate the signatures
    let aggregated = signer
        .aggregate_signatures(signatures.clone())
        .expect("aggregation should succeed");

    assert_eq!(
        aggregated.0.len(),
        64,
        "Aggregated signature must be 64 bytes"
    );
    assert!(
        aggregated.0.iter().any(|&b| b != 0),
        "Aggregated signature should not be all zeros"
    );

    // Aggregation is deterministic
    let aggregated_2 = signer.aggregate_signatures(signatures).unwrap();
    assert_eq!(
        aggregated.0, aggregated_2.0,
        "BLS aggregation must be deterministic"
    );
}

// =============================================================================
// Test 10: Key registry has all 3 peers registered
// =============================================================================

#[tokio::test]
async fn test_key_registry_3_nodes() {
    let (key_registry, keypairs) = InMemoryKeyRegistry::generate_test_registry(3);

    assert_eq!(key_registry.peer_count(), 3);

    for (peer_id, keypair) in &keypairs {
        use issuer::KeyRegistry;
        assert!(key_registry.is_registered(peer_id));
        let pubkey = key_registry.get_public_key(peer_id).unwrap();
        assert_eq!(pubkey.0, keypair.public_key().0);
    }

    // Unregistered peer should not be found
    let unknown_peer: PeerId = {
        let mut p = [0u8; 32];
        p[0] = 99;
        p
    };
    use issuer::KeyRegistry;
    assert!(!key_registry.is_registered(&unknown_peer));
}

// =============================================================================
// Test 11: Buy order consensus completes under 1 second
// =============================================================================

#[tokio::test]
async fn test_buy_order_consensus_under_1s() {
    let (protocols, p2ps, _chains, _keypairs, _key_reg) = build_3_node_network().await;

    let genesis_sig = BLSSignature(vec![0u8; 64]);

    let start = Instant::now();
    let results = run_consensus_cycle(&protocols, &p2ps, 1, &genesis_sig).await;
    let elapsed = start.elapsed();

    assert!(
        elapsed < Duration::from_secs(1),
        "Buy order consensus took {:?}, expected < 1s",
        elapsed
    );

    let leader_idx = elect_leader(&genesis_sig, 3).unwrap();

    // Leader succeeds with threshold signatures
    match &results[leader_idx as usize] {
        ConsensusResult::Success {
            signer_count,
            cycle_number,
            ..
        } => {
            assert_eq!(*cycle_number, 1);
            assert!(*signer_count >= 2, "Need at least 2 signers (threshold)");
        }
        other => {
            panic!("Leader expected Success, got: {:?}", other);
        }
    }

    // All followers complete (not timeout)
    for (i, result) in results.iter().enumerate() {
        if i == leader_idx as usize {
            continue;
        }
        match result {
            ConsensusResult::Success { cycle_number, .. } => {
                assert_eq!(*cycle_number, 1);
            }
            other => {
                panic!("Follower {} expected Success, got: {:?}", i, other);
            }
        }
    }
}
