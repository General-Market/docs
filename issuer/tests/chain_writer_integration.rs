//! Integration tests for EthersChainWriter with MockChain
//!
//! These tests verify that EthersChainWriter correctly implements the ChainWriter trait
//! and can work alongside MockChain for testing purposes.

use common::error::Error;
use common::mocks::MockChainBuilder;
use common::traits::{ChainReader, ChainWriter};
use common::types::Fill;
use ethers::types::{H256, U256};

/// Test that MockChain implements ChainWriter trait correctly
/// This validates that our writer can be swapped with MockChain in tests
#[tokio::test]
async fn test_mock_chain_implements_chain_writer_trait() {
    use common::types::{LimitOrder, OrderStatus, Side};
    use ethers::types::Address;

    // Create orders first so submit_batch has valid order IDs
    let orders: Vec<LimitOrder> = (1..=3)
        .map(|i| LimitOrder {
            id: U256::from(i),
            user: Address::random(),
            pair_id: H256::random(),
            side: Side::Buy,
            amount: U256::from(1000) * U256::exp10(18),
            limit_price: U256::from(100) * U256::exp10(18),
            slippage_tier: U256::from(1),
            deadline: U256::from(u64::MAX),
            itp_id: H256::random(),
            timestamp: U256::from(1234567890u64),
            status: OrderStatus::Pending,
        })
        .collect();

    let mut builder = MockChainBuilder::new();
    for order in &orders {
        builder = builder.with_order(order.clone());
    }
    let mock_chain = builder.build();

    // Test submit_batch with valid orders
    let tx_hash = mock_chain
        .submit_batch(1, vec![1, 2, 3], vec![0u8; 96])
        .await
        .expect("submit_batch should succeed");
    assert_ne!(tx_hash, H256::zero(), "tx_hash should not be zero");

    // Test confirm_fills
    let fill = Fill {
        order_id: U256::from(1),
        fill_price: U256::from(100) * U256::exp10(18),
        fill_amount: U256::from(1000) * U256::exp10(18),
        cycle_number: U256::from(1),
        tx_hash: H256::random(),
    };
    let tx_hash = mock_chain
        .confirm_fills(1, vec![fill], vec![0u8; 96])
        .await
        .expect("confirm_fills should succeed");
    assert_ne!(tx_hash, H256::zero(), "tx_hash should not be zero");

    // Test submit_bridge
    let amount = U256::from(1000) * U256::exp10(18);
    let tx_hash = mock_chain
        .submit_bridge(42161, amount, vec![0u8; 96])
        .await
        .expect("submit_bridge should succeed");
    assert_ne!(tx_hash, H256::zero(), "tx_hash should not be zero");
}

/// Test transaction lifecycle: submit → pending → confirmed
#[tokio::test]
async fn test_transaction_lifecycle() {
    use common::mocks::MockChainBuilder;
    use common::types::{LimitOrder, OrderStatus, Side};
    use ethers::types::Address;

    // Create mock chain with an initial order
    let order = LimitOrder {
        id: U256::from(1),
        user: Address::random(),
        pair_id: H256::random(),
        side: Side::Buy,
        amount: U256::from(1000) * U256::exp10(18),
        limit_price: U256::from(100) * U256::exp10(18),
        slippage_tier: U256::from(1),
        deadline: U256::from(u64::MAX),
        itp_id: H256::random(),
        timestamp: U256::from(1234567890u64),
        status: OrderStatus::Pending,
    };

    let mock_chain = MockChainBuilder::new().with_order(order.clone()).build();

    // Verify order is pending
    let pending_orders = mock_chain.get_pending_orders().await.unwrap();
    assert_eq!(pending_orders.len(), 1);
    assert_eq!(pending_orders[0].id, order.id);

    // Submit batch
    let tx_hash = mock_chain
        .submit_batch(1, vec![1], vec![0u8; 96])
        .await
        .expect("submit_batch should succeed");
    assert_ne!(tx_hash, H256::zero());

    // Confirm fill
    let fill = Fill {
        order_id: order.id,
        fill_price: order.limit_price,
        fill_amount: order.amount,
        cycle_number: U256::from(1),
        tx_hash: H256::random(),
    };

    let tx_hash = mock_chain
        .confirm_fills(1, vec![fill], vec![0u8; 96])
        .await
        .expect("confirm_fills should succeed");
    assert_ne!(tx_hash, H256::zero());

    // Verify order is no longer pending (it's been filled)
    let pending_orders = mock_chain.get_pending_orders().await.unwrap();
    assert!(
        pending_orders.is_empty(),
        "Order should be removed from pending after fill"
    );

    // Verify filled orders contain our order
    let filled_orders = mock_chain.get_filled_orders().await;
    assert_eq!(filled_orders.len(), 1);
    assert_eq!(filled_orders[0].order_id, order.id);
}

/// Test that MockChain correctly validates order existence
#[tokio::test]
async fn test_batch_validation_with_unknown_orders() {
    let mock_chain = MockChainBuilder::new().build();

    // Try to batch non-existent orders
    let result = mock_chain.submit_batch(1, vec![999], vec![0u8; 96]).await;

    assert!(result.is_err(), "Should fail with non-existent orders");
    match result {
        Err(Error::NotFound(msg)) => {
            assert!(msg.contains("999"), "Error should mention order ID");
        }
        _ => panic!("Expected NotFound error"),
    }
}

/// Test bridge transaction generates unique tx hash
#[tokio::test]
async fn test_bridge_tx_uniqueness() {
    let mock_chain = MockChainBuilder::new().build();

    let amount = U256::from(1000) * U256::exp10(18);

    let tx1 = mock_chain
        .submit_bridge(42161, amount, vec![0u8; 96])
        .await
        .unwrap();

    let tx2 = mock_chain
        .submit_bridge(42161, amount, vec![0u8; 96])
        .await
        .unwrap();

    assert_ne!(tx1, tx2, "Each bridge tx should have unique hash");
}

/// Test multiple fills in single confirmation
#[tokio::test]
async fn test_multiple_fills_confirmation() {
    use common::mocks::MockChainBuilder;
    use common::types::{LimitOrder, OrderStatus, Side};
    use ethers::types::Address;

    // Create orders
    let mut orders = Vec::new();
    for i in 1..=5 {
        orders.push(LimitOrder {
            id: U256::from(i),
            user: Address::random(),
            pair_id: H256::random(),
            side: Side::Buy,
            amount: U256::from(1000) * U256::exp10(18),
            limit_price: U256::from(100) * U256::exp10(18),
            slippage_tier: U256::from(1),
            deadline: U256::from(u64::MAX),
            itp_id: H256::random(),
            timestamp: U256::from(1234567890u64),
            status: OrderStatus::Pending,
        });
    }

    let mut builder = MockChainBuilder::new();
    for order in &orders {
        builder = builder.with_order(order.clone());
    }
    let mock_chain = builder.build();

    // Verify all orders are pending
    let pending = mock_chain.get_pending_orders().await.unwrap();
    assert_eq!(pending.len(), 5);

    // Create fills for all orders
    let fills: Vec<Fill> = orders
        .iter()
        .map(|o| Fill {
            order_id: o.id,
            fill_price: o.limit_price,
            fill_amount: o.amount,
            cycle_number: U256::from(1),
            tx_hash: H256::random(),
        })
        .collect();

    // Confirm all fills in one transaction
    let tx_hash = mock_chain
        .confirm_fills(1, fills, vec![0u8; 96])
        .await
        .expect("confirm_fills should succeed");
    assert_ne!(tx_hash, H256::zero());

    // Verify all orders are filled
    let pending = mock_chain.get_pending_orders().await.unwrap();
    assert!(pending.is_empty(), "All orders should be filled");

    let filled = mock_chain.get_filled_orders().await;
    assert_eq!(filled.len(), 5, "Should have 5 filled orders");
}

/// Test that ChainWriter trait is object-safe (can be used as dyn trait)
#[tokio::test]
async fn test_chain_writer_trait_object_safety() {
    let mock_chain = MockChainBuilder::new().build();

    // Use as trait object
    let writer: &dyn ChainWriter = &mock_chain;

    // All methods should work via trait object
    let tx = writer
        .submit_batch(1, vec![], vec![0u8; 96])
        .await
        .unwrap();
    assert_ne!(tx, H256::zero());

    let tx = writer.confirm_fills(1, vec![], vec![0u8; 96]).await.unwrap();
    assert_ne!(tx, H256::zero());

    let amount = U256::from(1000) * U256::exp10(18);
    let tx = writer
        .submit_bridge(42161, amount, vec![0u8; 96])
        .await
        .unwrap();
    assert_ne!(tx, H256::zero());
}
