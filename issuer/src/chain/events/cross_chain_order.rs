//! CrossChainOrder Event Types (Story 7.1)
//!
//! This module provides parsing and validation for cross-chain order events
//! from the SettlementBridgeCustody contract on the Settlement chain.
//!
//! Types are defined in `common::types::settlement` and re-exported here.
//! Parsing logic (from raw logs) stays in this module.
//!
//! ## Decimal Handling (Story 7-6b)
//!
//! The `CrossChainOrderCreated` event emits `amount` in **18-decimal internal format**.
//! This is because the SettlementBridgeCustody contract converts user-provided 6-decimal USDC
//! to 18-decimal internal representation at order creation time.
//!
//! No conversion is needed when parsing these events - amounts are already normalized.
//!
//! Events:
//! - `CrossChainOrderCreated` - User initiates ITP purchase from Settlement chain
//! - `CrossChainSellOrderCreated` - User initiates ITP sell from Settlement chain

use std::time::{SystemTime, UNIX_EPOCH};

use ethers::types::{Address, H256, Log, U256, U64};
use thiserror::Error;
use tracing::warn;

// Re-export shared types from common
pub use common::types::{
    CrossChainOrder, CrossChainOrderData, CrossChainOrderEvent, CrossChainSellOrderEvent,
};

/// Minimum expected amount in 18-decimal internal format (1e12)
/// Amounts below this are likely 6-decimal USDC values that weren't properly converted.
/// 1e12 = 0.000001 USDC in 18 decimals, which is our minimum precision.
const SUSPICIOUS_AMOUNT_THRESHOLD: u128 = 1_000_000_000_000; // 1e12

/// Event signature for CrossChainSellOrderCreated
/// `keccak256("CrossChainSellOrderCreated(uint256,bytes32,address,address,uint256)")`
///
/// Topics layout (3 indexed):
/// - topics[0]: event signature hash
/// - topics[1]: orderId (uint256, indexed)
/// - topics[2]: itpId (bytes32, indexed)
/// - topics[3]: user (address, indexed - last 20 bytes of 32-byte topic)
///
/// Data layout (2 non-indexed params):
/// - data[0..32]: bridgedItpAddress (address at offset 12..32)
/// - data[32..64]: amount (uint256)
pub const CROSS_CHAIN_SELL_ORDER_CREATED_SIGNATURE: &str =
    "CrossChainSellOrderCreated(uint256,bytes32,address,address,uint256)";

/// Event signature for CrossChainOrderCreated
/// `keccak256("CrossChainOrderCreated(uint256,bytes32,address,uint256)")`
///
/// Topics layout (ALL indexed):
/// - topics[0]: event signature hash
/// - topics[1]: orderId (uint256, indexed)
/// - topics[2]: itpId (bytes32, indexed)
/// - topics[3]: user (address, indexed - last 20 bytes of 32-byte topic)
///
/// Data layout (only non-indexed params):
/// - data[0-32]: amount (uint256)
pub const CROSS_CHAIN_ORDER_CREATED_SIGNATURE: &str =
    "CrossChainOrderCreated(uint256,bytes32,address,uint256)";

/// Error parsing CrossChainOrder events from logs
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CrossChainOrderParseError {
    #[error("missing topic at index {index}")]
    MissingTopic { index: usize },

    #[error("invalid topic length at index {index}: expected 32, got {length}")]
    InvalidTopicLength { index: usize, length: usize },

    #[error("failed to decode event data: {reason}")]
    DecodeError { reason: String },

    #[error("unexpected event signature")]
    UnexpectedSignature,

    #[error("missing block metadata")]
    MissingBlockMetadata,

    #[error("invalid address: user is zero address")]
    ZeroUserAddress,

    #[error("invalid amount: amount is zero")]
    ZeroAmount,
}

/// Parse CrossChainSellOrderCreated event from a raw log
///
/// Event: CrossChainSellOrderCreated(uint256 indexed orderId, bytes32 indexed itpId, address indexed user, address bridgedItpAddress, uint256 amount)
///
/// Topics (3 indexed params):
/// - [0]: event signature hash
/// - [1]: orderId (uint256, indexed - full 32 bytes)
/// - [2]: itpId (bytes32, indexed - full 32 bytes)
/// - [3]: user (address, indexed - last 20 bytes of 32-byte topic)
///
/// Data (2 non-indexed params):
/// - [0..32]: bridgedItpAddress (address, last 20 bytes of 32-byte slot)
/// - [32..64]: amount (uint256)
pub fn parse_cross_chain_sell_order_event(
    log: &Log,
) -> Result<CrossChainSellOrderEvent, CrossChainOrderParseError> {
    // Verify we have enough topics (signature + 3 indexed params)
    if log.topics.len() < 4 {
        return Err(CrossChainOrderParseError::MissingTopic {
            index: log.topics.len(),
        });
    }

    // Extract orderId from topic[1] (full 32 bytes as U256)
    let order_id = U256::from_big_endian(log.topics[1].as_bytes());

    // Extract itpId from topic[2] (full 32 bytes as H256)
    let itp_id = log.topics[2];

    // Extract user from topic[3] (last 20 bytes of 32-byte topic)
    let user = Address::from_slice(&log.topics[3].as_bytes()[12..32]);

    // Decode bridgedItpAddress and amount from data (non-indexed params)
    let data = &log.data.0;
    if data.len() < 64 {
        return Err(CrossChainOrderParseError::DecodeError {
            reason: format!(
                "data too short for sell order: expected 64, got {}",
                data.len()
            ),
        });
    }
    let bridged_itp_address = Address::from_slice(&data[12..32]);
    let amount = U256::from_big_endian(&data[32..64]);

    // Get block metadata
    let block_number = log
        .block_number
        .ok_or(CrossChainOrderParseError::MissingBlockMetadata)?
        .as_u64();
    let tx_hash = log
        .transaction_hash
        .ok_or(CrossChainOrderParseError::MissingBlockMetadata)?;

    // Basic validation
    if user.is_zero() {
        return Err(CrossChainOrderParseError::ZeroUserAddress);
    }
    if amount.is_zero() {
        return Err(CrossChainOrderParseError::ZeroAmount);
    }

    Ok(CrossChainSellOrderEvent {
        order_id,
        itp_id,
        user,
        bridged_itp_address,
        amount,
        block_number,
        tx_hash,
    })
}

/// Topic hash for CrossChainSellOrderCreated event
pub fn cross_chain_sell_order_topic() -> H256 {
    H256::from_slice(&ethers::utils::keccak256(
        CROSS_CHAIN_SELL_ORDER_CREATED_SIGNATURE,
    ))
}

/// Parse CrossChainOrderCreated event from a raw log
///
/// Event: CrossChainOrderCreated(uint256 indexed orderId, bytes32 indexed itpId, address indexed user, uint256 amount)
///
/// Topics (ALL 3 params are INDEXED):
/// - [0]: event signature hash
/// - [1]: orderId (uint256, indexed - full 32 bytes)
/// - [2]: itpId (bytes32, indexed - full 32 bytes)
/// - [3]: user (address, indexed - last 20 bytes of 32-byte topic)
///
/// Data (only non-indexed params):
/// - [0-32]: amount (uint256)
pub fn parse_cross_chain_order_event(
    log: &Log,
) -> Result<CrossChainOrderEvent, CrossChainOrderParseError> {
    // Verify we have enough topics (signature + 3 indexed params)
    if log.topics.len() < 4 {
        return Err(CrossChainOrderParseError::MissingTopic {
            index: log.topics.len(),
        });
    }

    // Extract orderId from topic[1] (full 32 bytes as U256)
    let order_id = U256::from_big_endian(log.topics[1].as_bytes());

    // Extract itpId from topic[2] (full 32 bytes as H256)
    let itp_id = log.topics[2];

    // Extract user from topic[3] (last 20 bytes of 32-byte topic)
    let user = Address::from_slice(&log.topics[3].as_bytes()[12..32]);

    // Decode amount from data (only non-indexed param)
    let data = &log.data.0;
    if data.len() < 32 {
        return Err(CrossChainOrderParseError::DecodeError {
            reason: format!("data too short for amount: expected 32, got {}", data.len()),
        });
    }
    let amount = U256::from_big_endian(&data[0..32]);

    // Get block metadata
    let block_number = log
        .block_number
        .ok_or(CrossChainOrderParseError::MissingBlockMetadata)?
        .as_u64();
    let tx_hash = log
        .transaction_hash
        .ok_or(CrossChainOrderParseError::MissingBlockMetadata)?;

    // Basic validation
    if user.is_zero() {
        return Err(CrossChainOrderParseError::ZeroUserAddress);
    }
    if amount.is_zero() {
        return Err(CrossChainOrderParseError::ZeroAmount);
    }

    Ok(CrossChainOrderEvent {
        order_id,
        itp_id,
        user,
        amount,
        block_number,
        tx_hash,
    })
}

/// Convert a CrossChainOrderEvent to full CrossChainOrder by adding data from getCrossChainOrder() call
pub fn cross_chain_event_into_full_order(
    event: CrossChainOrderEvent,
    limit_price: U256,
    slippage_tier: u8,
    deadline: U256,
    created_at: U256,
    chain_id: u64,
) -> CrossChainOrder {
    CrossChainOrder {
        order_id: event.order_id,
        itp_id: event.itp_id,
        user: event.user,
        amount: event.amount,
        limit_price,
        slippage_tier,
        deadline,
        created_at,
        chain_id,
        block_number: event.block_number,
        tx_hash: event.tx_hash,
    }
}

/// Check if the order has expired based on its deadline using system clock
///
/// Returns true if current time >= deadline
///
/// Note: Prefer `cross_chain_order_is_expired_at()` when a block timestamp is available,
/// as system clock may differ from chain time (e.g., Anvil with evm_increaseTime).
pub fn cross_chain_order_is_expired(order: &CrossChainOrder) -> bool {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    cross_chain_order_is_expired_at(order, now)
}

/// Check if the order has expired at a given timestamp
///
/// Use this with a block timestamp to avoid system clock vs chain time drift
/// (e.g., when Anvil's evm_increaseTime shifts chain time ahead of wall clock).
pub fn cross_chain_order_is_expired_at(order: &CrossChainOrder, timestamp: u64) -> bool {
    // deadline is U256, but should fit in u64 for reasonable timestamps
    if let Some(deadline_secs) = order.deadline.try_into().ok() {
        let deadline_secs: u64 = deadline_secs;
        timestamp >= deadline_secs
    } else {
        // If deadline is larger than u64::MAX, it's effectively never expired
        // (would be year 584 billion+)
        false
    }
}

/// Check if the order is valid for processing (uses system clock for expiry)
///
/// Returns None if valid, or Some(reason) if invalid
pub fn cross_chain_order_validate(order: &CrossChainOrder) -> Option<&'static str> {
    if order.user.is_zero() {
        return Some("user address is zero");
    }
    if order.amount.is_zero() {
        return Some("amount is zero");
    }
    if cross_chain_order_is_expired(order) {
        return Some("order has expired");
    }
    None
}

/// Check if the order is valid for processing at a given timestamp
///
/// Returns None if valid, or Some(reason) if invalid
pub fn cross_chain_order_validate_at(
    order: &CrossChainOrder,
    timestamp: u64,
) -> Option<&'static str> {
    if order.user.is_zero() {
        return Some("user address is zero");
    }
    if order.amount.is_zero() {
        return Some("amount is zero");
    }
    if cross_chain_order_is_expired_at(order, timestamp) {
        return Some("order has expired");
    }
    None
}

/// Log a warning if the order is expired (for use in event handler)
pub fn cross_chain_order_log_if_expired(order: &CrossChainOrder) {
    if cross_chain_order_is_expired(order) {
        warn!(
            order_id = %order.order_id,
            itp_id = ?order.itp_id,
            user = ?order.user,
            deadline = %order.deadline,
            code = "ORDER-001",
            "Skipping expired cross-chain order"
        );
    }
}

/// Get the deduplication key for this order
///
/// Returns (chain_id, order_id) tuple for use in HashSet
pub fn cross_chain_order_dedup_key(order: &CrossChainOrder) -> (u64, U256) {
    (order.chain_id, order.order_id)
}

/// Check if the amount looks like it might be in 6-decimal format
///
/// Story 7-6b: Amounts should be in 18-decimal internal format.
/// If amount < 1e12 (SUSPICIOUS_AMOUNT_THRESHOLD), it's likely a
/// 6-decimal USDC value that wasn't properly converted.
///
/// Returns true if amount is suspiciously small.
pub fn cross_chain_order_has_suspicious_amount(order: &CrossChainOrder) -> bool {
    order.amount < U256::from(SUSPICIOUS_AMOUNT_THRESHOLD)
}

/// Log a warning if the amount looks suspiciously small
///
/// Story 7-6b: Detect potential 6-decimal vs 18-decimal confusion.
pub fn cross_chain_order_log_if_suspicious_amount(order: &CrossChainOrder) {
    if cross_chain_order_has_suspicious_amount(order) {
        warn!(
            order_id = %order.order_id,
            amount = %order.amount,
            threshold = SUSPICIOUS_AMOUNT_THRESHOLD,
            code = "DECIMAL-001",
            "CrossChainOrder amount is suspiciously small - may be 6-decimal value instead of 18-decimal"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::Bytes;

    fn create_test_log(
        order_id: u64,
        itp_id: [u8; 32],
        user: [u8; 20],
        amount: u64,
    ) -> Log {
        // Build topics
        let mut topics = Vec::with_capacity(4);

        // topic[0]: event signature (not used in from_log but must be present)
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

        // topic[3]: user (address, last 20 bytes)
        let mut user_bytes = [0u8; 32];
        user_bytes[12..32].copy_from_slice(&user);
        topics.push(H256::from_slice(&user_bytes));

        // Build data: amount (U256)
        let mut data = vec![0u8; 32];
        U256::from(amount).to_big_endian(&mut data[0..32]);

        Log {
            address: Address::from([0x11u8; 20]),
            topics,
            data: Bytes::from(data),
            block_hash: Some(H256::from([0x22u8; 32])),
            block_number: Some(U64::from(12345)),
            transaction_hash: Some(H256::from([0x33u8; 32])),
            transaction_index: Some(U64::from(0)),
            log_index: Some(U256::from(0)),
            transaction_log_index: None,
            log_type: None,
            removed: Some(false),
        }
    }

    #[test]
    fn test_parse_cross_chain_order_event() {
        let log = create_test_log(
            42,                       // order_id
            [0xAAu8; 32],             // itp_id
            [0xBBu8; 20],             // user
            1_000_000_000_000_000_000, // amount (1e18)
        );

        let event = parse_cross_chain_order_event(&log).unwrap();

        assert_eq!(event.order_id, U256::from(42));
        assert_eq!(event.itp_id, H256::from([0xAAu8; 32]));
        assert_eq!(event.user, Address::from([0xBBu8; 20]));
        assert_eq!(event.amount, U256::from(1_000_000_000_000_000_000u64));
        assert_eq!(event.block_number, 12345);
        assert_eq!(event.tx_hash, H256::from([0x33u8; 32]));
    }

    #[test]
    fn test_parse_missing_topics() {
        let mut log = create_test_log(42, [0xAA; 32], [0xBB; 20], 1000);
        log.topics.truncate(3); // Remove user topic

        let result = parse_cross_chain_order_event(&log);
        assert!(matches!(
            result,
            Err(CrossChainOrderParseError::MissingTopic { index: 3 })
        ));
    }

    #[test]
    fn test_parse_missing_data() {
        let mut log = create_test_log(42, [0xAA; 32], [0xBB; 20], 1000);
        log.data = Bytes::from(vec![0u8; 16]); // Too short

        let result = parse_cross_chain_order_event(&log);
        assert!(matches!(
            result,
            Err(CrossChainOrderParseError::DecodeError { .. })
        ));
    }

    #[test]
    fn test_parse_zero_user_address() {
        let log = create_test_log(42, [0xAA; 32], [0x00; 20], 1000);

        let result = parse_cross_chain_order_event(&log);
        assert!(matches!(
            result,
            Err(CrossChainOrderParseError::ZeroUserAddress)
        ));
    }

    #[test]
    fn test_parse_zero_amount() {
        let log = create_test_log(42, [0xAA; 32], [0xBB; 20], 0);

        let result = parse_cross_chain_order_event(&log);
        assert!(matches!(
            result,
            Err(CrossChainOrderParseError::ZeroAmount)
        ));
    }

    #[test]
    fn test_parse_missing_block_metadata() {
        let mut log = create_test_log(42, [0xAA; 32], [0xBB; 20], 1000);
        log.block_number = None;

        let result = parse_cross_chain_order_event(&log);
        assert!(matches!(
            result,
            Err(CrossChainOrderParseError::MissingBlockMetadata)
        ));
    }

    #[test]
    fn test_into_full_order() {
        let log = create_test_log(42, [0xAA; 32], [0xBB; 20], 1000);
        let event = parse_cross_chain_order_event(&log).unwrap();

        let full_order = cross_chain_event_into_full_order(
            event,
            U256::from(500_000_000_000_000_000u64), // limit_price
            1,                                       // slippage_tier (normal)
            U256::from(1700000000u64),              // deadline
            U256::from(1699000000u64),              // created_at
            42161,                                   // chain_id (Settlement)
        );

        assert_eq!(full_order.order_id, U256::from(42));
        assert_eq!(full_order.limit_price, U256::from(500_000_000_000_000_000u64));
        assert_eq!(full_order.slippage_tier, 1);
        assert_eq!(full_order.deadline, U256::from(1700000000u64));
        assert_eq!(full_order.chain_id, 42161);
    }

    #[test]
    fn test_is_expired() {
        // Past deadline
        let mut order = create_test_order();
        order.deadline = U256::from(1000u64); // Year 1970
        assert!(cross_chain_order_is_expired(&order));

        // Future deadline
        order.deadline = U256::from(u64::MAX - 1000);
        assert!(!cross_chain_order_is_expired(&order));

        // Very large deadline (effectively never expires)
        order.deadline = U256::MAX;
        assert!(!cross_chain_order_is_expired(&order));
    }

    #[test]
    fn test_is_expired_at() {
        let mut order = create_test_order();
        order.deadline = U256::from(1000u64);

        // At deadline - expired
        assert!(cross_chain_order_is_expired_at(&order, 1000));
        // After deadline - expired
        assert!(cross_chain_order_is_expired_at(&order, 2000));
        // Before deadline - not expired
        assert!(!cross_chain_order_is_expired_at(&order, 999));
        // At zero - not expired (unless deadline is also 0)
        assert!(!cross_chain_order_is_expired_at(&order, 0));

        // Very large deadline
        order.deadline = U256::MAX;
        assert!(!cross_chain_order_is_expired_at(&order, u64::MAX));
    }

    #[test]
    fn test_validate_at() {
        let mut order = create_test_order();
        order.deadline = U256::from(1000u64);

        // Expired at timestamp 2000
        assert_eq!(cross_chain_order_validate_at(&order, 2000), Some("order has expired"));
        // Not expired at timestamp 500
        assert_eq!(cross_chain_order_validate_at(&order, 500), None);
    }

    #[test]
    fn test_validate_zero_user() {
        let mut order = create_test_order();
        order.user = Address::zero();
        assert_eq!(cross_chain_order_validate(&order), Some("user address is zero"));
    }

    #[test]
    fn test_validate_zero_amount() {
        let mut order = create_test_order();
        order.amount = U256::zero();
        assert_eq!(cross_chain_order_validate(&order), Some("amount is zero"));
    }

    #[test]
    fn test_validate_expired() {
        let mut order = create_test_order();
        order.deadline = U256::from(1000u64); // Past deadline
        assert_eq!(cross_chain_order_validate(&order), Some("order has expired"));
    }

    #[test]
    fn test_validate_success() {
        let order = create_test_order();
        assert_eq!(cross_chain_order_validate(&order), None);
    }

    #[test]
    fn test_dedup_key() {
        let order = create_test_order();
        let key = cross_chain_order_dedup_key(&order);
        assert_eq!(key, (42161, U256::from(42)));
    }

    fn create_test_order() -> CrossChainOrder {
        CrossChainOrder {
            order_id: U256::from(42),
            itp_id: H256::from([0xAA; 32]),
            user: Address::from([0xBB; 20]),
            amount: U256::from(1_000_000_000_000_000_000u64),
            limit_price: U256::from(500_000_000_000_000_000u64),
            slippage_tier: 1, // normal (1%)
            deadline: U256::from(u64::MAX - 1000), // Far future
            created_at: U256::from(1699000000u64),
            chain_id: 42161,
            block_number: 12345,
            tx_hash: H256::from([0x33; 32]),
        }
    }

    // Story 7-6b: Decimal validation tests
    #[test]
    fn test_suspicious_amount_detection_6_decimal() {
        let mut order = create_test_order();
        // 100 USDC in 6-decimal format (suspicious - should be 18 decimal)
        order.amount = U256::from(100_000_000u64); // 100 * 10^6
        assert!(cross_chain_order_has_suspicious_amount(&order));
    }

    #[test]
    fn test_suspicious_amount_detection_18_decimal_ok() {
        let mut order = create_test_order();
        // 100 USDC in 18-decimal format (correct)
        order.amount = U256::from(100u64) * U256::exp10(18);
        assert!(!cross_chain_order_has_suspicious_amount(&order));
    }

    #[test]
    fn test_suspicious_amount_threshold_boundary() {
        let mut order = create_test_order();

        // Just below threshold (suspicious)
        order.amount = U256::from(SUSPICIOUS_AMOUNT_THRESHOLD - 1);
        assert!(cross_chain_order_has_suspicious_amount(&order));

        // At threshold (OK)
        order.amount = U256::from(SUSPICIOUS_AMOUNT_THRESHOLD);
        assert!(!cross_chain_order_has_suspicious_amount(&order));

        // Above threshold (OK)
        order.amount = U256::from(SUSPICIOUS_AMOUNT_THRESHOLD + 1);
        assert!(!cross_chain_order_has_suspicious_amount(&order));
    }

    #[test]
    fn test_suspicious_amount_small_valid_order() {
        let mut order = create_test_order();
        // 0.000001 USDC in 18 decimals = 1e12 (minimum valid)
        order.amount = U256::exp10(12);
        assert!(!cross_chain_order_has_suspicious_amount(&order));
    }
}
