//! Integration tests for CrossChainOrder event handling (Story 7.1)
//!
//! Tests the full flow of parsing CrossChainOrderCreated events from logs
//! and enriching them with getCrossChainOrder() data.

use ethers::types::{Address, Bytes, H256, Log, U256, U64};
use issuer::chain::events::{
    CrossChainOrder, CrossChainOrderEvent, CrossChainOrderParseError,
    CROSS_CHAIN_ORDER_CREATED_SIGNATURE,
};

/// Create a realistic Log structure matching what would come from Settlement chain
fn create_mock_cross_chain_order_log(
    order_id: u64,
    itp_id: [u8; 32],
    user: [u8; 20],
    amount: u64,
    block_number: u64,
    tx_hash: [u8; 32],
) -> Log {
    // Build topics
    let mut topics = Vec::with_capacity(4);

    // topic[0]: event signature hash
    let sig_hash = H256::from_slice(&ethers::utils::keccak256(
        CROSS_CHAIN_ORDER_CREATED_SIGNATURE,
    ));
    topics.push(sig_hash);

    // topic[1]: orderId (U256 as 32 bytes)
    let mut order_id_bytes = [0u8; 32];
    U256::from(order_id).to_big_endian(&mut order_id_bytes);
    topics.push(H256::from_slice(&order_id_bytes));

    // topic[2]: itpId (bytes32)
    topics.push(H256::from_slice(&itp_id));

    // topic[3]: user (address, padded to 32 bytes - last 20 bytes)
    let mut user_bytes = [0u8; 32];
    user_bytes[12..32].copy_from_slice(&user);
    topics.push(H256::from_slice(&user_bytes));

    // Build data: only amount (U256)
    let mut data = vec![0u8; 32];
    U256::from(amount).to_big_endian(&mut data[0..32]);

    Log {
        address: Address::from([0x11u8; 20]),
        topics,
        data: Bytes::from(data),
        block_hash: Some(H256::from([0x22u8; 32])),
        block_number: Some(U64::from(block_number)),
        transaction_hash: Some(H256::from_slice(&tx_hash)),
        transaction_index: Some(U64::from(0)),
        log_index: Some(U256::from(0)),
        transaction_log_index: None,
        log_type: None,
        removed: Some(false),
    }
}

#[test]
fn test_parse_cross_chain_order_event_full_flow() {
    // Create a realistic log
    let log = create_mock_cross_chain_order_log(
        12345,                               // order_id
        [0xAA; 32],                          // itp_id
        [0xBB; 20],                          // user
        1_000_000_000_000_000_000,           // amount (1e18 = 1 USDC in 18 decimals)
        100_000,                             // block_number
        [0xCC; 32],                          // tx_hash
    );

    // Parse the event
    let event = CrossChainOrderEvent::from_log(&log).unwrap();

    // Verify all fields parsed correctly
    assert_eq!(event.order_id, U256::from(12345));
    assert_eq!(event.itp_id, H256::from([0xAA; 32]));
    assert_eq!(event.user, Address::from([0xBB; 20]));
    assert_eq!(event.amount, U256::from(1_000_000_000_000_000_000u64));
    assert_eq!(event.block_number, 100_000);
    assert_eq!(event.tx_hash, H256::from([0xCC; 32]));
}

#[test]
fn test_convert_event_to_full_order() {
    // Create and parse a log
    let log = create_mock_cross_chain_order_log(
        42,                                  // order_id
        [0xAA; 32],                          // itp_id
        [0xBB; 20],                          // user
        500_000_000_000_000_000,             // amount (0.5 USDC)
        200_000,                             // block_number
        [0xDD; 32],                          // tx_hash
    );

    let event = CrossChainOrderEvent::from_log(&log).unwrap();

    // Simulate data from getCrossChainOrder() call
    let limit_price = U256::from(1_500_000_000_000_000_000u64); // 1.5 in 18 decimals
    let slippage_tier = 1u8; // normal (1%)
    let deadline = U256::from(u64::MAX - 1000); // Far future
    let created_at = U256::from(1700000000u64);
    let chain_id = 42161u64; // Settlement

    // Convert to full order
    let full_order = event.into_full_order(limit_price, slippage_tier, deadline, created_at, chain_id);

    // Verify all fields
    assert_eq!(full_order.order_id, U256::from(42));
    assert_eq!(full_order.itp_id, H256::from([0xAA; 32]));
    assert_eq!(full_order.user, Address::from([0xBB; 20]));
    assert_eq!(full_order.amount, U256::from(500_000_000_000_000_000u64));
    assert_eq!(full_order.limit_price, limit_price);
    assert_eq!(full_order.slippage_tier, 1);
    assert_eq!(full_order.deadline, deadline);
    assert_eq!(full_order.created_at, created_at);
    assert_eq!(full_order.chain_id, 42161);
    assert_eq!(full_order.block_number, 200_000);
    assert_eq!(full_order.tx_hash, H256::from([0xDD; 32]));
}

#[test]
fn test_order_not_expired() {
    let order = CrossChainOrder {
        order_id: U256::from(1),
        itp_id: H256::from([0xAA; 32]),
        user: Address::from([0xBB; 20]),
        amount: U256::from(1000),
        limit_price: U256::from(500),
        slippage_tier: 1,
        deadline: U256::from(u64::MAX - 1000), // Far future
        created_at: U256::from(1700000000u64),
        chain_id: 42161,
        block_number: 100,
        tx_hash: H256::from([0xCC; 32]),
    };

    assert!(!order.is_expired());
    assert!(order.validate().is_none()); // Valid order
}

#[test]
fn test_order_expired() {
    let order = CrossChainOrder {
        order_id: U256::from(1),
        itp_id: H256::from([0xAA; 32]),
        user: Address::from([0xBB; 20]),
        amount: U256::from(1000),
        limit_price: U256::from(500),
        slippage_tier: 1,
        deadline: U256::from(1000), // Year 1970 - definitely past
        created_at: U256::from(500),
        chain_id: 42161,
        block_number: 100,
        tx_hash: H256::from([0xCC; 32]),
    };

    assert!(order.is_expired());
    assert_eq!(order.validate(), Some("order has expired"));
}

#[test]
fn test_dedup_key_uniqueness() {
    let order1 = CrossChainOrder {
        order_id: U256::from(1),
        itp_id: H256::from([0xAA; 32]),
        user: Address::from([0xBB; 20]),
        amount: U256::from(1000),
        limit_price: U256::from(500),
        slippage_tier: 1,
        deadline: U256::from(u64::MAX - 1000),
        created_at: U256::from(1700000000u64),
        chain_id: 42161, // Settlement
        block_number: 100,
        tx_hash: H256::from([0xCC; 32]),
    };

    let order2 = CrossChainOrder {
        order_id: U256::from(1), // Same order_id
        chain_id: 421614,        // Different chain (Settlement Sepolia)
        ..order1.clone()
    };

    let order3 = CrossChainOrder {
        order_id: U256::from(2), // Different order_id
        chain_id: 42161,         // Same chain
        ..order1.clone()
    };

    // Same chain + same order_id = same dedup key
    assert_eq!(order1.dedup_key(), (42161, U256::from(1)));

    // Different chain = different dedup key (even with same order_id)
    assert_ne!(order1.dedup_key(), order2.dedup_key());

    // Different order_id = different dedup key
    assert_ne!(order1.dedup_key(), order3.dedup_key());
}

#[test]
fn test_event_signature_matches_solidity() {
    // The event signature should match IBridge.sol:159-164:
    // event CrossChainOrderCreated(
    //     uint256 indexed orderId,
    //     bytes32 indexed itpId,
    //     address indexed user,
    //     uint256 amount
    // );
    //
    // Signature: CrossChainOrderCreated(uint256,bytes32,address,uint256)

    let expected_sig = "CrossChainOrderCreated(uint256,bytes32,address,uint256)";
    assert_eq!(CROSS_CHAIN_ORDER_CREATED_SIGNATURE, expected_sig);

    // Compute the topic hash
    let topic_hash = H256::from_slice(&ethers::utils::keccak256(expected_sig));

    // The hash should be non-zero and consistent
    assert_ne!(topic_hash, H256::zero());

    // Compute again to verify determinism
    let topic_hash2 = H256::from_slice(&ethers::utils::keccak256(expected_sig));
    assert_eq!(topic_hash, topic_hash2);
}

#[test]
fn test_parse_malformed_log_missing_data() {
    let mut log = create_mock_cross_chain_order_log(1, [0xAA; 32], [0xBB; 20], 1000, 100, [0xCC; 32]);

    // Set data to be too short (less than 32 bytes)
    log.data = Bytes::from(vec![0u8; 16]);

    let result = CrossChainOrderEvent::from_log(&log);
    assert!(matches!(
        result,
        Err(CrossChainOrderParseError::DecodeError { .. })
    ));
}

#[test]
fn test_parse_log_with_zero_user_fails() {
    let log = create_mock_cross_chain_order_log(
        1,
        [0xAA; 32],
        [0x00; 20], // Zero user address
        1000,
        100,
        [0xCC; 32],
    );

    let result = CrossChainOrderEvent::from_log(&log);
    assert!(matches!(
        result,
        Err(CrossChainOrderParseError::ZeroUserAddress)
    ));
}

#[test]
fn test_parse_log_with_zero_amount_fails() {
    let log = create_mock_cross_chain_order_log(
        1,
        [0xAA; 32],
        [0xBB; 20],
        0, // Zero amount
        100,
        [0xCC; 32],
    );

    let result = CrossChainOrderEvent::from_log(&log);
    assert!(matches!(
        result,
        Err(CrossChainOrderParseError::ZeroAmount)
    ));
}

#[test]
fn test_multiple_events_parsing() {
    // Parse multiple events to simulate batch processing
    let logs: Vec<Log> = (1..=5)
        .map(|i| {
            create_mock_cross_chain_order_log(
                i as u64,
                [i as u8; 32],
                [(i + 0x10) as u8; 20],
                1_000_000_000_000_000_000u64 * i as u64,
                100_000 + i as u64,
                [(i + 0xC0) as u8; 32],
            )
        })
        .collect();

    let events: Vec<CrossChainOrderEvent> = logs
        .iter()
        .map(|log| CrossChainOrderEvent::from_log(log).unwrap())
        .collect();

    assert_eq!(events.len(), 5);

    // Verify each event has unique order_id
    for (i, event) in events.iter().enumerate() {
        assert_eq!(event.order_id, U256::from(i as u64 + 1));
    }
}
