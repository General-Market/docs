//! Fill Allocator for distributing fills to source orders
//!
//! After execution, fills are distributed proportionally to source orders
//! based on their contribution to the merged order.

use common::types::LimitOrder;
use ethers::types::U256;

/// Context for a merged order containing source orders
#[derive(Debug, Clone)]
pub struct MergedOrderContext {
    /// Original orders that were merged
    pub source_orders: Vec<LimitOrder>,
    /// Total amount of all source orders combined
    pub total_amount: U256,
}

/// Result of allocating a fill to a source order
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceFill {
    /// ID of the source order
    pub order_id: U256,
    /// Amount allocated to this order
    pub allocated_amount: U256,
    /// Effective fill price (same for all source orders - fair distribution)
    pub allocated_price: U256,
}

/// Error type for fill allocation
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AllocationError {
    /// Merged order has zero total amount
    ZeroTotalAmount,
    /// No source orders provided
    EmptySourceOrders,
}

impl std::fmt::Display for AllocationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AllocationError::ZeroTotalAmount => write!(f, "Merged order has zero total amount"),
            AllocationError::EmptySourceOrders => write!(f, "No source orders provided"),
        }
    }
}

impl std::error::Error for AllocationError {}

/// Allocate fills proportionally to source orders
///
/// Distributes the fill amount to source orders based on their proportion
/// of the total merged amount.
///
/// # Formula
///
/// For each source order:
/// ```ignore
/// source_fill = total_fill × (order.amount / total_merged_amount)
/// ```
///
/// # Rounding
///
/// Rounding errors are assigned to the largest source order to ensure
/// `sum(allocations) == fill_amount`.
///
/// # Arguments
///
/// * `merged` - The merged order context containing source orders
/// * `fill_amount` - Total amount to distribute
/// * `fill_price` - Execution price (same for all allocations)
///
/// # Returns
///
/// Vector of `SourceFill` with allocated amounts, or error if input is invalid.
///
/// # Example
///
/// ```ignore
/// let merged = MergedOrderContext {
///     source_orders: vec![order_5k, order_5k],
///     total_amount: U256::from(10_000),
/// };
/// let fills = allocate_fills(&merged, U256::from(10_000), U256::from(price))?;
/// // Each gets $5k allocation
/// ```
pub fn allocate_fills(
    merged: &MergedOrderContext,
    fill_amount: U256,
    fill_price: U256,
) -> Result<Vec<SourceFill>, AllocationError> {
    // Validate inputs
    if merged.source_orders.is_empty() {
        return Err(AllocationError::EmptySourceOrders);
    }
    if merged.total_amount.is_zero() {
        return Err(AllocationError::ZeroTotalAmount);
    }

    let mut allocations = Vec::with_capacity(merged.source_orders.len());
    let mut cumulative_allocated = U256::zero();
    let mut largest_order_idx = 0;
    let mut largest_amount = U256::zero();

    // First pass: calculate proportional allocations and find largest order
    for (idx, order) in merged.source_orders.iter().enumerate() {
        // proportion = order.amount / total_amount
        // source_fill = fill_amount * proportion = fill_amount * order.amount / total_amount
        let allocation = (fill_amount * order.amount) / merged.total_amount;

        cumulative_allocated += allocation;

        allocations.push(SourceFill {
            order_id: order.id,
            allocated_amount: allocation,
            allocated_price: fill_price,
        });

        // Track largest order for remainder assignment
        if order.amount > largest_amount {
            largest_amount = order.amount;
            largest_order_idx = idx;
        }
    }

    // Second pass: assign any remainder to the largest order
    if cumulative_allocated < fill_amount {
        let remainder = fill_amount - cumulative_allocated;
        allocations[largest_order_idx].allocated_amount += remainder;

        tracing::debug!(
            remainder = %remainder,
            order_id = %allocations[largest_order_idx].order_id,
            "Assigned rounding remainder to largest order"
        );
    }

    tracing::info!(
        source_count = allocations.len(),
        fill_amount = %fill_amount,
        "Fill allocated to source orders"
    );

    Ok(allocations)
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::{OrderStatus, Side};
    use ethers::types::{Address, H256};

    /// Helper to create a test order
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
    fn test_fill_allocation_equal_amounts() {
        let source_orders = vec![create_order(1, 5000), create_order(2, 5000)];
        let merged = MergedOrderContext {
            total_amount: U256::from(10000),
            source_orders,
        };
        let fill_amount = U256::from(10000);
        let fill_price = U256::from(1000);

        let allocations = allocate_fills(&merged, fill_amount, fill_price).unwrap();

        assert_eq!(allocations.len(), 2);
        assert_eq!(allocations[0].allocated_amount, U256::from(5000));
        assert_eq!(allocations[1].allocated_amount, U256::from(5000));

        // Both get same price
        assert_eq!(allocations[0].allocated_price, fill_price);
        assert_eq!(allocations[1].allocated_price, fill_price);
    }

    #[test]
    fn test_fill_allocation_unequal_amounts() {
        let source_orders = vec![
            create_order(1, 3000), // 30%
            create_order(2, 7000), // 70%
        ];
        let merged = MergedOrderContext {
            total_amount: U256::from(10000),
            source_orders,
        };
        let fill_amount = U256::from(10000);
        let fill_price = U256::from(1000);

        let allocations = allocate_fills(&merged, fill_amount, fill_price).unwrap();

        assert_eq!(allocations.len(), 2);
        assert_eq!(allocations[0].allocated_amount, U256::from(3000));
        assert_eq!(allocations[1].allocated_amount, U256::from(7000));
    }

    #[test]
    fn test_fill_allocation_partial_fill() {
        // Merged order $10k, but only $5k filled
        let source_orders = vec![create_order(1, 5000), create_order(2, 5000)];
        let merged = MergedOrderContext {
            total_amount: U256::from(10000),
            source_orders,
        };
        let fill_amount = U256::from(5000); // 50% fill
        let fill_price = U256::from(1000);

        let allocations = allocate_fills(&merged, fill_amount, fill_price).unwrap();

        assert_eq!(allocations.len(), 2);
        assert_eq!(allocations[0].allocated_amount, U256::from(2500));
        assert_eq!(allocations[1].allocated_amount, U256::from(2500));
    }

    #[test]
    fn test_fill_allocation_rounding_remainder_to_largest() {
        // Three orders where division creates remainder
        let source_orders = vec![
            create_order(1, 333),
            create_order(2, 333),
            create_order(3, 334), // Largest
        ];
        let merged = MergedOrderContext {
            total_amount: U256::from(1000),
            source_orders,
        };
        let fill_amount = U256::from(1000);
        let fill_price = U256::from(1000);

        let allocations = allocate_fills(&merged, fill_amount, fill_price).unwrap();

        // Sum should equal fill amount exactly
        let total: U256 = allocations
            .iter()
            .fold(U256::zero(), |acc, a| acc + a.allocated_amount);
        assert_eq!(total, fill_amount);

        // Largest order (index 2) should have the remainder
        // 333 * 1000 / 1000 = 333
        // 333 * 1000 / 1000 = 333
        // 334 * 1000 / 1000 = 334
        // Total = 1000, no remainder in this case
        assert_eq!(allocations[2].allocated_amount, U256::from(334));
    }

    #[test]
    fn test_fill_allocation_rounding_with_actual_remainder() {
        // Create a case where integer division loses precision
        let source_orders = vec![
            create_order(1, 1),   // Small
            create_order(2, 100), // Largest
        ];
        let merged = MergedOrderContext {
            total_amount: U256::from(101),
            source_orders,
        };
        let fill_amount = U256::from(100);
        let fill_price = U256::from(1000);

        let allocations = allocate_fills(&merged, fill_amount, fill_price).unwrap();

        // Sum should equal fill amount exactly
        let total: U256 = allocations
            .iter()
            .fold(U256::zero(), |acc, a| acc + a.allocated_amount);
        assert_eq!(total, fill_amount);
    }

    #[test]
    fn test_edge_case_single_order() {
        let source_orders = vec![create_order(1, 1000)];
        let merged = MergedOrderContext {
            total_amount: U256::from(1000),
            source_orders,
        };
        let fill_amount = U256::from(1000);
        let fill_price = U256::from(1000);

        let allocations = allocate_fills(&merged, fill_amount, fill_price).unwrap();

        assert_eq!(allocations.len(), 1);
        assert_eq!(allocations[0].allocated_amount, fill_amount);
    }

    #[test]
    fn test_error_empty_source_orders() {
        let merged = MergedOrderContext {
            total_amount: U256::from(1000),
            source_orders: vec![],
        };
        let fill_amount = U256::from(1000);
        let fill_price = U256::from(1000);

        let result = allocate_fills(&merged, fill_amount, fill_price);
        assert_eq!(result, Err(AllocationError::EmptySourceOrders));
    }

    #[test]
    fn test_error_zero_total_amount() {
        let source_orders = vec![create_order(1, 1000)];
        let merged = MergedOrderContext {
            total_amount: U256::zero(),
            source_orders,
        };
        let fill_amount = U256::from(1000);
        let fill_price = U256::from(1000);

        let result = allocate_fills(&merged, fill_amount, fill_price);
        assert_eq!(result, Err(AllocationError::ZeroTotalAmount));
    }

    #[test]
    fn test_all_orders_get_same_price() {
        let source_orders = vec![create_order(1, 3000), create_order(2, 7000)];
        let merged = MergedOrderContext {
            total_amount: U256::from(10000),
            source_orders,
        };
        let fill_amount = U256::from(10000);
        let fill_price = U256::from(12345); // Specific price

        let allocations = allocate_fills(&merged, fill_amount, fill_price).unwrap();

        // Fair distribution - all get same price
        for alloc in &allocations {
            assert_eq!(alloc.allocated_price, fill_price);
        }
    }

    #[test]
    fn test_many_orders_allocation() {
        let source_orders: Vec<LimitOrder> = (1..=10).map(|i| create_order(i, 100)).collect();
        let merged = MergedOrderContext {
            total_amount: U256::from(1000),
            source_orders,
        };
        let fill_amount = U256::from(1000);
        let fill_price = U256::from(1000);

        let allocations = allocate_fills(&merged, fill_amount, fill_price).unwrap();

        assert_eq!(allocations.len(), 10);
        for alloc in &allocations {
            assert_eq!(alloc.allocated_amount, U256::from(100));
        }

        let total: U256 = allocations
            .iter()
            .fold(U256::zero(), |acc, a| acc + a.allocated_amount);
        assert_eq!(total, fill_amount);
    }
}
