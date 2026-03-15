//! Fee Allocation implementation
//!
//! Distributes execution fees proportionally to order size.
//!
//! # Formula
//!
//! ```text
//! user_fee = total_fee × (user_order_amount / total_batch_amount)
//! ```
//!
//! # Example
//!
//! ```text
//! - User A order: $1000 (20%) → pays 20% of bridge fee
//! - User B order: $3000 (60%) → pays 60% of bridge fee
//! - User C order: $1000 (20%) → pays 20% of bridge fee
//! ```
//!
//! # Rounding
//!
//! Rounding errors are assigned to the largest order to ensure
//! `sum(allocations) == total_fee`.

use common::types::LimitOrder;
use ethers::types::U256;

/// Type of fee being allocated
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeeType {
    /// Bridge fees (cross-chain transfers)
    Bridge,
    /// Gas fees (on-chain transactions)
    Gas,
    /// Combined bridge and gas fees
    Combined,
}

/// Fee allocation for a single order
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeeAllocation {
    /// ID of the order this fee is for
    pub order_id: U256,
    /// Fee amount allocated to this order
    pub fee: U256,
    /// Type of fee
    pub fee_type: FeeType,
}

/// Error type for fee allocation
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FeeAllocationError {
    /// No orders provided
    EmptyOrders,
    /// Total batch amount is zero
    ZeroTotalAmount,
}

impl std::fmt::Display for FeeAllocationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FeeAllocationError::EmptyOrders => write!(f, "No orders provided for fee allocation"),
            FeeAllocationError::ZeroTotalAmount => write!(f, "Total batch amount is zero"),
        }
    }
}

impl std::error::Error for FeeAllocationError {}

/// Allocate fees proportionally to order sizes
///
/// Each order pays a share of the total fee proportional to its amount.
///
/// # Arguments
///
/// * `orders` - Slice of orders in the batch
/// * `total_fee` - Total fee to distribute
/// * `fee_type` - Type of fee being allocated
///
/// # Returns
///
/// Vector of `FeeAllocation` or error if inputs are invalid
///
/// # Example
///
/// ```ignore
/// let allocations = fee_allocation(&orders, U256::from(100), FeeType::Bridge)?;
/// // Each order gets fee proportional to its amount
/// ```
pub fn fee_allocation(
    orders: &[LimitOrder],
    total_fee: U256,
    fee_type: FeeType,
) -> Result<Vec<FeeAllocation>, FeeAllocationError> {
    if orders.is_empty() {
        return Err(FeeAllocationError::EmptyOrders);
    }

    // Calculate total batch amount
    let total_amount: U256 = orders.iter().map(|o| o.amount).fold(U256::zero(), |a, b| a + b);

    if total_amount.is_zero() {
        return Err(FeeAllocationError::ZeroTotalAmount);
    }

    let mut allocations = Vec::with_capacity(orders.len());
    let mut cumulative_fee = U256::zero();
    let mut largest_idx = 0;
    let mut largest_amount = U256::zero();

    // First pass: calculate proportional fees and find largest order
    for (idx, order) in orders.iter().enumerate() {
        // fee = total_fee × (order.amount / total_amount)
        let fee = (total_fee * order.amount) / total_amount;
        cumulative_fee += fee;

        allocations.push(FeeAllocation {
            order_id: order.id,
            fee,
            fee_type,
        });

        // Track largest order for remainder assignment
        if order.amount > largest_amount {
            largest_amount = order.amount;
            largest_idx = idx;
        }
    }

    // Second pass: assign any remainder to the largest order
    if cumulative_fee < total_fee {
        let remainder = total_fee - cumulative_fee;
        allocations[largest_idx].fee += remainder;

        tracing::debug!(
            remainder = %remainder,
            order_id = %allocations[largest_idx].order_id,
            "Assigned fee remainder to largest order"
        );
    }

    tracing::info!(
        order_count = allocations.len(),
        total_fee = %total_fee,
        fee_type = ?fee_type,
        "Fee allocation complete"
    );

    Ok(allocations)
}

/// Check if a fee would exceed a percentage of the order amount
///
/// Used for mini order protection - warn if fee > 2% of order.
///
/// # Arguments
///
/// * `fee` - Fee amount
/// * `order_amount` - Order amount
/// * `threshold_percent` - Warning threshold (e.g., 2 for 2%)
///
/// # Returns
///
/// true if fee exceeds threshold percentage of order amount
#[allow(dead_code)] // Part of public API for mini-order protection
pub fn exceeds_fee_threshold(fee: U256, order_amount: U256, threshold_percent: u64) -> bool {
    if order_amount.is_zero() {
        return true; // Zero amount always exceeds
    }

    // fee > order_amount * threshold / 100
    // Rearranged to avoid overflow: fee * 100 > order_amount * threshold
    fee * U256::from(100) > order_amount * U256::from(threshold_percent)
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::{OrderStatus, Side};
    use ethers::types::{Address, H256};

    fn create_order(id: u64, amount: u64) -> LimitOrder {
        LimitOrder {
            id: U256::from(id),
            user: Address::zero(),
            pair_id: H256::zero(),
            side: Side::Buy,
            amount: U256::from(amount),
            limit_price: U256::from(1000_u64) * U256::exp10(18),
            slippage_tier: U256::from(1),
            deadline: U256::from(u64::MAX),
            itp_id: H256::zero(),
            timestamp: U256::from(0),
            status: OrderStatus::Pending,
        }
    }

    #[test]
    fn test_fee_allocation_equal_orders() {
        let orders = vec![
            create_order(1, 5000),
            create_order(2, 5000),
        ];
        let total_fee = U256::from(100);

        let allocations = fee_allocation(&orders, total_fee, FeeType::Bridge).unwrap();

        assert_eq!(allocations.len(), 2);
        assert_eq!(allocations[0].fee, U256::from(50));
        assert_eq!(allocations[1].fee, U256::from(50));

        // Sum should equal total
        let sum: U256 = allocations.iter().map(|a| a.fee).fold(U256::zero(), |a, b| a + b);
        assert_eq!(sum, total_fee);
    }

    #[test]
    fn test_fee_allocation_proportional() {
        // 20%, 60%, 20%
        let orders = vec![
            create_order(1, 1000), // 20%
            create_order(2, 3000), // 60%
            create_order(3, 1000), // 20%
        ];
        let total_fee = U256::from(100);

        let allocations = fee_allocation(&orders, total_fee, FeeType::Bridge).unwrap();

        assert_eq!(allocations.len(), 3);
        assert_eq!(allocations[0].fee, U256::from(20));
        assert_eq!(allocations[1].fee, U256::from(60));
        assert_eq!(allocations[2].fee, U256::from(20));
    }

    #[test]
    fn test_fee_allocation_rounding_remainder() {
        // 3 equal orders, fee of 100 doesn't divide evenly by 3
        let orders = vec![
            create_order(1, 1000),
            create_order(2, 1000),
            create_order(3, 1000),
        ];
        let total_fee = U256::from(100);

        let allocations = fee_allocation(&orders, total_fee, FeeType::Gas).unwrap();

        // Sum should equal total exactly (remainder assigned to largest)
        let sum: U256 = allocations.iter().map(|a| a.fee).fold(U256::zero(), |a, b| a + b);
        assert_eq!(sum, total_fee);
    }

    #[test]
    fn test_fee_allocation_single_order() {
        let orders = vec![create_order(1, 5000)];
        let total_fee = U256::from(100);

        let allocations = fee_allocation(&orders, total_fee, FeeType::Combined).unwrap();

        assert_eq!(allocations.len(), 1);
        assert_eq!(allocations[0].fee, total_fee);
        assert_eq!(allocations[0].fee_type, FeeType::Combined);
    }

    #[test]
    fn test_fee_allocation_empty_orders() {
        let orders: Vec<LimitOrder> = vec![];
        let result = fee_allocation(&orders, U256::from(100), FeeType::Bridge);

        assert_eq!(result, Err(FeeAllocationError::EmptyOrders));
    }

    #[test]
    fn test_fee_allocation_zero_fee() {
        let orders = vec![
            create_order(1, 5000),
            create_order(2, 5000),
        ];
        let total_fee = U256::zero();

        let allocations = fee_allocation(&orders, total_fee, FeeType::Bridge).unwrap();

        assert_eq!(allocations[0].fee, U256::zero());
        assert_eq!(allocations[1].fee, U256::zero());
    }

    #[test]
    fn test_fee_allocation_remainder_to_largest() {
        // Unequal orders where largest gets remainder
        let orders = vec![
            create_order(1, 333),
            create_order(2, 1000), // Largest
            create_order(3, 333),
        ];
        let total_fee = U256::from(1000);
        // Total: 1666
        // Order 1: 1000 * 333 / 1666 = 199
        // Order 2: 1000 * 1000 / 1666 = 600
        // Order 3: 1000 * 333 / 1666 = 199
        // Sum: 998, remainder: 2 → goes to order 2 (largest)

        let allocations = fee_allocation(&orders, total_fee, FeeType::Bridge).unwrap();

        // Sum should equal total exactly
        let sum: U256 = allocations.iter().map(|a| a.fee).fold(U256::zero(), |a, b| a + b);
        assert_eq!(sum, total_fee);

        // Largest order (index 1) should have the most
        assert!(allocations[1].fee > allocations[0].fee);
    }

    #[test]
    fn test_exceeds_fee_threshold() {
        // Fee is exactly 2% of order
        assert!(!exceeds_fee_threshold(U256::from(2), U256::from(100), 2));

        // Fee is 3% of order (exceeds 2%)
        assert!(exceeds_fee_threshold(U256::from(3), U256::from(100), 2));

        // Fee is 1% of order (below 2%)
        assert!(!exceeds_fee_threshold(U256::from(1), U256::from(100), 2));

        // Zero order amount always exceeds
        assert!(exceeds_fee_threshold(U256::from(1), U256::zero(), 2));
    }

    #[test]
    fn test_fee_type_variants() {
        let orders = vec![create_order(1, 1000)];

        let bridge = fee_allocation(&orders, U256::from(10), FeeType::Bridge).unwrap();
        assert_eq!(bridge[0].fee_type, FeeType::Bridge);

        let gas = fee_allocation(&orders, U256::from(10), FeeType::Gas).unwrap();
        assert_eq!(gas[0].fee_type, FeeType::Gas);

        let combined = fee_allocation(&orders, U256::from(10), FeeType::Combined).unwrap();
        assert_eq!(combined[0].fee_type, FeeType::Combined);
    }
}
