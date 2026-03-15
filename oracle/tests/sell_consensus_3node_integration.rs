//! Multi-node SELL consensus integration tests (Story 7-14, Task 2.5)
//!
//! Tests 3 ConsensusProtocol instances with Side::Sell orders.
//! Validates leader election, batch signing, BLS aggregation for sell flows.

use std::sync::Arc;
use std::time::Duration;

use ethers::types::{Address, H256, U256};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::mocks::{MockChain, MockChainBuilder, MockP2PNetworkBuilder};
use common::traits::{BLSSigner, P2PTransport};
use common::types::{BLSSignature, Fill, LimitOrder, OrderStatus, PeerId, Side};
use oracle::consensus::aggregator::calculate_threshold;
use oracle::{
    ConsensusConfig, ConsensusProtocol, ConsensusResult, ConsensusTimeouts,
    InMemoryKeyRegistry, MockPriceFetcher, MockPriceFetcherBuilder,
};
use oracle::leader::elect_leader;

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

/// Build test LimitOrders with Side::Sell
fn test_sell_orders() -> Vec<LimitOrder> {
    test_order_ids()
        .into_iter()
        .map(|id| LimitOrder {
            id: U256::from(id),
            user: Address::zero(),
            pair_id: H256::zero(),
            side: Side::Sell,
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

/// Build a MockChain pre-populated with SELL orders.
fn build_chain() -> MockChain {
    let mut builder = MockChainBuilder::new();
    for order in test_sell_orders() {
        builder = builder.with_order(order);
    }
    builder.build()
}

/// Build a mock price fetcher.
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

/// Helper: build 3 nodes sharing the same MockP2PNetwork and KeyRegistry.
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

    let (key_registry, _generated_keypairs) = InMemoryKeyRegistry::generate_test_registry(3);
    let key_registry = Arc::new(key_registry);

    let mut keypairs = Vec::new();
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

/// Run a full consensus cycle for 3 nodes with SELL orders.
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
// Test: 3-node SELL consensus cycle succeeds
// =============================================================================

#[tokio::test]
async fn test_3node_sell_consensus_success() {
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
            panic!("Leader SELL consensus failed: {}", reason);
        }
        ConsensusResult::Timeout { phase, .. } => {
            panic!("Leader SELL consensus timed out in phase {:?}", phase);
        }
        ConsensusResult::EmergencyPause { .. } => {
            panic!("Unexpected emergency pause");
        }
        ConsensusResult::ItpCreated { .. } => {
            panic!("Unexpected ITP creation result in SELL consensus test");
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
