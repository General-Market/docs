//! Slippage Filter & Fill Allocation module for Index L3
//!
//! This module provides:
//! - Slippage tier filtering: filters orders based on current market spread
//! - Fill allocation: distributes fills proportionally to source orders
//!
//! # Slippage Tiers
//!
//! | Tier | Max Slippage | Use Case |
//! |------|--------------|----------|
//! | 0 - Strict | ≤0.3% | Stablecoins, large caps, tight spread |
//! | 1 - Normal | ≤1.0% | Most assets, default tier |
//! | 2 - Relaxed | ≤3.0% | Memecoins, low liquidity, urgent fills |

mod fill_allocator;

pub use fill_allocator::{allocate_fills, AllocationError, MergedOrderContext, SourceFill};

use common::types::LimitOrder;
use ethers::types::U256;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Slippage tolerance tier for orders
///
/// Determines the maximum acceptable spread for an order to be included
/// in the current execution cycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SlippageTier {
    /// Strict: max 0.3% slippage - for stablecoins and large caps
    Strict,
    /// Normal: max 1.0% slippage - default for most assets
    Normal,
    /// Relaxed: max 3.0% slippage - for memecoins and urgent fills
    Relaxed,
}

impl SlippageTier {
    /// Convert from U256 value stored in LimitOrder
    ///
    /// - 0 → Strict (0.3%)
    /// - 1 → Normal (1.0%)
    /// - 2+ → Relaxed (3.0%) - defaults to relaxed for safety
    pub fn from_u256(val: U256) -> Self {
        match val.as_u64() {
            0 => SlippageTier::Strict,
            1 => SlippageTier::Normal,
            _ => SlippageTier::Relaxed,
        }
    }

    /// Get the maximum allowed slippage for this tier as a decimal
    ///
    /// Returns:
    /// - Strict: 0.003 (0.3%)
    /// - Normal: 0.01 (1.0%)
    /// - Relaxed: 0.03 (3.0%)
    pub fn max_slippage(&self) -> Decimal {
        match self {
            SlippageTier::Strict => Decimal::new(3, 3), // 0.003 = 0.3%
            SlippageTier::Normal => Decimal::new(1, 2), // 0.01 = 1%
            SlippageTier::Relaxed => Decimal::new(3, 2), // 0.03 = 3%
        }
    }
}

/// Result of filtering orders by slippage tier
#[derive(Debug, Clone)]
pub struct FilterResult {
    /// Orders within their tier's slippage tolerance (included in this cycle)
    pub included: Vec<LimitOrder>,
    /// Orders exceeding their tier's slippage tolerance (queued for next cycle)
    pub excluded: Vec<LimitOrder>,
}

/// Result of filtering a merged order - recalculates amounts after filtering
#[derive(Debug, Clone)]
pub struct FilteredMergedOrder {
    /// The pair ID this merged order is for
    pub pair_id: ethers::types::H256,
    /// Recalculated net amount after filtering
    pub net_amount: U256,
    /// Orders that passed slippage filter (included in execution)
    pub included_orders: Vec<LimitOrder>,
    /// Orders that failed slippage filter (queued for next cycle)
    pub excluded_orders: Vec<LimitOrder>,
}

/// Filter orders based on current market spread and their slippage tier
///
/// Orders are included only if `current_spread <= tier_max_slippage`.
/// Excluded orders remain pending and are queued for the next cycle.
///
/// # Arguments
///
/// * `orders` - Slice of orders to filter
/// * `current_spread` - Current market spread as a decimal (e.g., 0.008 for 0.8%). Must be non-negative.
///
/// # Returns
///
/// `FilterResult` containing included and excluded orders
///
/// # Panics
///
/// Panics if `current_spread` is negative (invalid spread).
///
/// # Example
///
/// ```ignore
/// use rust_decimal::Decimal;
/// let spread = Decimal::new(8, 3); // 0.8%
/// let result = filter_by_slippage(&orders, spread);
/// // Tier 0 (0.3%) excluded, Tier 1 (1%) and 2 (3%) included
/// ```
pub fn filter_by_slippage(orders: &[LimitOrder], current_spread: Decimal) -> FilterResult {
    // Validate spread is non-negative
    assert!(
        !current_spread.is_sign_negative(),
        "current_spread must be non-negative, got {current_spread}"
    );
    let mut included = Vec::new();
    let mut excluded = Vec::new();

    for order in orders {
        let tier = SlippageTier::from_u256(order.slippage_tier);
        let max_slippage = tier.max_slippage();

        if current_spread <= max_slippage {
            included.push(order.clone());
        } else {
            excluded.push(order.clone());
            tracing::debug!(
                order_id = %order.id,
                tier = ?tier,
                max_slippage = %max_slippage,
                current_spread = %current_spread,
                "Order excluded due to slippage tier"
            );
        }
    }

    tracing::info!(
        spread = %current_spread,
        included_count = included.len(),
        excluded_count = excluded.len(),
        "Slippage filtering complete"
    );

    FilterResult { included, excluded }
}

use common::types::Side;

/// Filter a merged order from the netting engine and recalculate amounts
///
/// Takes a merged order (from pair netting) and filters its source orders
/// by slippage tier, then recalculates the net amount based on remaining orders.
///
/// # Arguments
///
/// * `pair_id` - The pair ID for this merged order
/// * `source_orders` - All source orders from the merged order
/// * `current_spread` - Current market spread as a decimal
///
/// # Returns
///
/// `FilteredMergedOrder` with recalculated net amount and separated orders
pub fn filter_merged_order(
    pair_id: ethers::types::H256,
    source_orders: Vec<LimitOrder>,
    current_spread: Decimal,
) -> FilteredMergedOrder {
    // Filter by slippage tier
    let filter_result = filter_by_slippage(&source_orders, current_spread);

    // Recalculate net amount from included orders only
    let mut net_signed = ethers::types::I256::zero();
    for order in &filter_result.included {
        let i256_amount = ethers::types::I256::try_from(order.amount).unwrap_or_else(|_| {
            panic!(
                "Order {} amount {} exceeds I256::MAX -- cannot net safely",
                order.id, order.amount
            )
        });
        let signed_amount = match order.side {
            Side::Buy => i256_amount,
            Side::Sell => -i256_amount,
        };
        net_signed += signed_amount;
    }

    // Convert to absolute value
    let net_amount = if net_signed >= ethers::types::I256::zero() {
        net_signed.into_raw()
    } else {
        (-net_signed).into_raw()
    };

    tracing::info!(
        pair_id = %pair_id,
        original_orders = source_orders.len(),
        included = filter_result.included.len(),
        excluded = filter_result.excluded.len(),
        net_amount = %net_amount,
        "Merged order filtered by slippage"
    );

    FilteredMergedOrder {
        pair_id,
        net_amount,
        included_orders: filter_result.included,
        excluded_orders: filter_result.excluded,
    }
}

/// Convert from slippage module's MergedOrderContext to fill allocation
///
/// This bridges between the netting module's MergedOrder and the
/// fill allocator's MergedOrderContext.
impl From<&FilteredMergedOrder> for MergedOrderContext {
    fn from(filtered: &FilteredMergedOrder) -> Self {
        let total_amount = filtered
            .included_orders
            .iter()
            .map(|o| o.amount)
            .fold(U256::zero(), |a, b| a + b);

        MergedOrderContext {
            source_orders: filtered.included_orders.clone(),
            total_amount,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::{OrderStatus, Side};
    use ethers::types::{Address, H256};

    /// Helper to create a test order with a specific slippage tier
    fn create_order_with_tier(id: u64, tier: u64, amount: u64) -> LimitOrder {
        LimitOrder {
            id: U256::from(id),
            user: Address::zero(),
            pair_id: H256::zero(),
            side: Side::Buy,
            amount: U256::from(amount),
            limit_price: U256::from(1000_u64) * U256::exp10(18),
            slippage_tier: U256::from(tier),
            deadline: U256::from(u64::MAX),
            itp_id: H256::zero(),
            timestamp: U256::from(0),
            status: OrderStatus::Pending,
        }
    }

    #[test]
    fn test_slippage_tier_from_u256() {
        assert_eq!(SlippageTier::from_u256(U256::from(0)), SlippageTier::Strict);
        assert_eq!(SlippageTier::from_u256(U256::from(1)), SlippageTier::Normal);
        assert_eq!(
            SlippageTier::from_u256(U256::from(2)),
            SlippageTier::Relaxed
        );
        // Invalid values default to Relaxed
        assert_eq!(
            SlippageTier::from_u256(U256::from(99)),
            SlippageTier::Relaxed
        );
    }

    #[test]
    fn test_slippage_tier_max_slippage() {
        assert_eq!(SlippageTier::Strict.max_slippage(), Decimal::new(3, 3)); // 0.003
        assert_eq!(SlippageTier::Normal.max_slippage(), Decimal::new(1, 2)); // 0.01
        assert_eq!(SlippageTier::Relaxed.max_slippage(), Decimal::new(3, 2)); // 0.03
    }

    #[test]
    fn test_tier_0_filtering_strict() {
        // Tier 0 (strict) max is 0.3%
        let orders = vec![create_order_with_tier(1, 0, 1000)];

        // Spread at 0.2% - should include
        let result = filter_by_slippage(&orders, Decimal::new(2, 3));
        assert_eq!(result.included.len(), 1);
        assert_eq!(result.excluded.len(), 0);

        // Spread at 0.4% - should exclude
        let result = filter_by_slippage(&orders, Decimal::new(4, 3));
        assert_eq!(result.included.len(), 0);
        assert_eq!(result.excluded.len(), 1);
    }

    #[test]
    fn test_tier_1_filtering_normal() {
        // Tier 1 (normal) max is 1.0%
        let orders = vec![create_order_with_tier(1, 1, 1000)];

        // Spread at 0.8% - should include
        let result = filter_by_slippage(&orders, Decimal::new(8, 3));
        assert_eq!(result.included.len(), 1);
        assert_eq!(result.excluded.len(), 0);

        // Spread at 1.5% - should exclude
        let result = filter_by_slippage(&orders, Decimal::new(15, 3));
        assert_eq!(result.included.len(), 0);
        assert_eq!(result.excluded.len(), 1);
    }

    #[test]
    fn test_tier_2_filtering_relaxed() {
        // Tier 2 (relaxed) max is 3.0%
        let orders = vec![create_order_with_tier(1, 2, 1000)];

        // Spread at 2.5% - should include
        let result = filter_by_slippage(&orders, Decimal::new(25, 3));
        assert_eq!(result.included.len(), 1);
        assert_eq!(result.excluded.len(), 0);

        // Spread at 3.5% - should exclude
        let result = filter_by_slippage(&orders, Decimal::new(35, 3));
        assert_eq!(result.included.len(), 0);
        assert_eq!(result.excluded.len(), 1);
    }

    #[test]
    fn test_mixed_tiers_with_various_spreads() {
        let orders = vec![
            create_order_with_tier(1, 0, 1000), // Strict 0.3%
            create_order_with_tier(2, 1, 1000), // Normal 1%
            create_order_with_tier(3, 2, 1000), // Relaxed 3%
        ];

        // Spread at 0.8%: excludes tier 0, includes tier 1 and 2
        let result = filter_by_slippage(&orders, Decimal::new(8, 3));
        assert_eq!(result.included.len(), 2);
        assert_eq!(result.excluded.len(), 1);
        assert_eq!(result.excluded[0].id, U256::from(1)); // Tier 0 excluded

        // Spread at 0.2%: includes all
        let result = filter_by_slippage(&orders, Decimal::new(2, 3));
        assert_eq!(result.included.len(), 3);
        assert_eq!(result.excluded.len(), 0);

        // Spread at 1.8%: excludes tier 0 and 1, includes tier 2
        let result = filter_by_slippage(&orders, Decimal::new(18, 3));
        assert_eq!(result.included.len(), 1);
        assert_eq!(result.excluded.len(), 2);
        assert_eq!(result.included[0].id, U256::from(3)); // Only tier 2 included
    }

    #[test]
    fn test_tier_filtering_at_boundary() {
        // Test spread exactly at tier limit (should include - <= comparison)
        let orders = vec![
            create_order_with_tier(1, 0, 1000), // Strict 0.3%
            create_order_with_tier(2, 1, 1000), // Normal 1%
        ];

        // Spread exactly at 0.3% - tier 0 should be included
        let result = filter_by_slippage(&orders, Decimal::new(3, 3));
        assert_eq!(result.included.len(), 2);
        assert_eq!(result.excluded.len(), 0);

        // Spread exactly at 1.0% - both should be included
        let result = filter_by_slippage(&orders, Decimal::new(1, 2));
        assert_eq!(result.included.len(), 2);
        assert_eq!(result.excluded.len(), 0);
    }

    #[test]
    fn test_edge_case_single_order() {
        let orders = vec![create_order_with_tier(1, 1, 1000)];

        let result = filter_by_slippage(&orders, Decimal::new(5, 3));
        assert_eq!(result.included.len(), 1);
        assert_eq!(result.excluded.len(), 0);
    }

    #[test]
    fn test_edge_case_empty_orders() {
        let orders: Vec<LimitOrder> = vec![];

        let result = filter_by_slippage(&orders, Decimal::new(5, 3));
        assert_eq!(result.included.len(), 0);
        assert_eq!(result.excluded.len(), 0);
    }

    #[test]
    fn test_edge_case_all_same_tier() {
        let orders = vec![
            create_order_with_tier(1, 1, 1000),
            create_order_with_tier(2, 1, 2000),
            create_order_with_tier(3, 1, 3000),
        ];

        // All same tier - all included or all excluded
        let result = filter_by_slippage(&orders, Decimal::new(5, 3)); // 0.5%
        assert_eq!(result.included.len(), 3);
        assert_eq!(result.excluded.len(), 0);

        let result = filter_by_slippage(&orders, Decimal::new(15, 3)); // 1.5%
        assert_eq!(result.included.len(), 0);
        assert_eq!(result.excluded.len(), 3);
    }

    #[test]
    fn test_excluded_orders_remain_pending() {
        // Verify excluded orders keep their Pending status (not cancelled)
        let orders = vec![create_order_with_tier(1, 0, 1000)];

        let result = filter_by_slippage(&orders, Decimal::new(5, 3)); // 0.5% > 0.3%
        assert_eq!(result.excluded.len(), 1);
        assert_eq!(result.excluded[0].status, OrderStatus::Pending);
    }
}
