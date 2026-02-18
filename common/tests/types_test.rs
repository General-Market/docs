//! Tests for shared types serialization and conversions
//!
//! Verifies that Rust types properly serialize/deserialize and
//! that enum conversions match Solidity definitions.

use common::{
    CollateralMove, Fill, ITPCore, ITPStatus, LimitOrder, OrderStatus, PendingLock, Price,
    PriceSource, Side, TxType, string_to_bytes32,
};
use ethers::types::{Address, H256, U256};

#[test]
fn test_side_conversion() {
    assert_eq!(Side::Buy as u8, 0);
    assert_eq!(Side::Sell as u8, 1);
    assert_eq!(Side::from(0u8), Side::Buy);
    assert_eq!(Side::from(1u8), Side::Sell);
}

#[test]
fn test_order_status_conversion() {
    assert_eq!(OrderStatus::Pending as u8, 0);
    assert_eq!(OrderStatus::Batched as u8, 1);
    assert_eq!(OrderStatus::Filled as u8, 2);
    assert_eq!(OrderStatus::Cancelled as u8, 3);
    assert_eq!(OrderStatus::Expired as u8, 4);

    assert_eq!(OrderStatus::from(0u8), OrderStatus::Pending);
    assert_eq!(OrderStatus::from(1u8), OrderStatus::Batched);
    assert_eq!(OrderStatus::from(2u8), OrderStatus::Filled);
    assert_eq!(OrderStatus::from(3u8), OrderStatus::Cancelled);
    assert_eq!(OrderStatus::from(4u8), OrderStatus::Expired);
}

#[test]
fn test_itp_status_conversion() {
    assert_eq!(ITPStatus::Inactive as u8, 0);
    assert_eq!(ITPStatus::Active as u8, 1);
    assert_eq!(ITPStatus::Paused as u8, 2);
    assert_eq!(ITPStatus::Delisting as u8, 3);

    assert_eq!(ITPStatus::from(0u8), ITPStatus::Inactive);
    assert_eq!(ITPStatus::from(U256::from(1)), ITPStatus::Active);
}

#[test]
fn test_tx_type_conversion() {
    assert_eq!(TxType::Bridge as u8, 0);
    assert_eq!(TxType::SwapIn as u8, 1);
    assert_eq!(TxType::SwapOut as u8, 2);
    assert_eq!(TxType::Buy as u8, 3);
    assert_eq!(TxType::Sell as u8, 4);
}

#[test]
fn test_price_source_conversion() {
    assert_eq!(PriceSource::Bitget as u8, 0);
    assert_eq!(PriceSource::OneInch as u8, 1);
    assert_eq!(PriceSource::OnChain as u8, 2);
}

#[test]
fn test_limit_order_serde() {
    let order = LimitOrder {
        id: U256::from(1),
        user: Address::zero(),
        pair_id: H256::zero(),
        side: Side::Buy,
        amount: U256::from(1000) * U256::exp10(18), // 1000 USDC
        limit_price: U256::exp10(18),               // 1.0
        slippage_tier: U256::from(1),
        deadline: U256::from(1700000000),
        itp_id: H256::zero(),
        timestamp: U256::from(1699999000),
        status: OrderStatus::Pending,
    };

    let serialized = serde_json::to_string(&order).unwrap();
    let deserialized: LimitOrder = serde_json::from_str(&serialized).unwrap();
    assert_eq!(order, deserialized);
}

#[test]
fn test_itp_core_serde() {
    let itp = ITPCore {
        name: string_to_bytes32("Test ITP"),
        symbol: string_to_bytes32("TITP"),
        creator: Address::zero(),
        created_at: U256::from(1699999000),
        fee_rate: U256::from(100), // 1%
        status: U256::from(1),     // Active
        total_supply: U256::from(1000000) * U256::exp10(18),
        total_value: U256::from(1000000) * U256::exp10(18),
        asset_count: U256::from(5),
    };

    let serialized = serde_json::to_string(&itp).unwrap();
    let deserialized: ITPCore = serde_json::from_str(&serialized).unwrap();
    assert_eq!(itp, deserialized);

    // Test helper methods
    assert_eq!(itp.name_string(), "Test ITP");
    assert_eq!(itp.symbol_string(), "TITP");
    assert_eq!(itp.status_enum(), ITPStatus::Active);
}

#[test]
fn test_fill_serde() {
    let fill = Fill {
        order_id: U256::from(123),
        fill_price: U256::exp10(18),
        fill_amount: U256::from(500) * U256::exp10(18),
        cycle_number: U256::from(42),
        tx_hash: H256::zero(),
    };

    let serialized = serde_json::to_string(&fill).unwrap();
    let deserialized: Fill = serde_json::from_str(&serialized).unwrap();
    assert_eq!(fill, deserialized);
}

#[test]
fn test_price_staleness() {
    let price = Price {
        asset: Address::zero(),
        price: U256::exp10(18),
        timestamp: U256::from(1000),
        source: U256::from(0), // Bitget (10s limit)
    };

    // Not stale at 1005 (5s elapsed, limit is 10s)
    assert!(!price.is_stale(U256::from(1005)));

    // Stale at 1015 (15s elapsed, limit is 10s)
    assert!(price.is_stale(U256::from(1015)));
}

#[test]
fn test_pending_lock() {
    let lock = PendingLock {
        amount: U256::from(1000) * U256::exp10(18),
        dest_chain_id: U256::from(42161), // Arbitrum
        locked_at: U256::from(1000),
        locked_block: U256::from(100),
        locked_block_hash: H256::zero(),
        released: false,
        reversed: false,
    };

    assert!(lock.is_pending());

    // Can't reverse before timeout (1 hour = 3600s)
    assert!(!lock.can_reverse(U256::from(1000 + 3599)));

    // Can reverse after timeout
    assert!(lock.can_reverse(U256::from(1000 + 3601)));
}

#[test]
fn test_collateral_move_serde() {
    let movement = CollateralMove {
        itp_id: H256::zero(),
        from_chain: U256::from(111222333), // L3
        to_chain: U256::from(42161),       // Arbitrum
        amount: U256::from(1000) * U256::exp10(18),
        tx_type: TxType::Bridge,
    };

    let serialized = serde_json::to_string(&movement).unwrap();
    let deserialized: CollateralMove = serde_json::from_str(&serialized).unwrap();
    assert_eq!(movement, deserialized);
}

#[test]
fn test_string_to_bytes32() {
    let bytes = string_to_bytes32("Hello");
    assert_eq!(bytes.as_bytes()[0], b'H');
    assert_eq!(bytes.as_bytes()[1], b'e');
    assert_eq!(bytes.as_bytes()[2], b'l');
    assert_eq!(bytes.as_bytes()[3], b'l');
    assert_eq!(bytes.as_bytes()[4], b'o');
    assert_eq!(bytes.as_bytes()[5], 0); // Padded with zeros
}
