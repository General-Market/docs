//! Type definitions for the Netting Engine
//!
//! These types represent the results of various netting operations.

use common::types::{LimitOrder, Side};
use ethers::types::{H256, U256};

/// Result of pair netting - merged order for a single pair
///
/// Contains the net amount and all source orders for fill allocation.
#[derive(Debug, Clone)]
pub struct MergedOrder {
    /// The pair ID this merged order is for
    pub pair_id: H256,
    /// Final side after netting (Buy if net positive, Sell if net negative)
    pub side: Side,
    /// Absolute net amount after netting buys vs sells
    pub net_amount: U256,
    /// All source orders that contributed to this merged order
    pub source_orders: Vec<LimitOrder>,
    /// Sum of (amount × slippage_tier) for weighted average calculation
    pub total_slippage_weight: U256,
    /// Sum of absolute amounts from all source orders
    pub total_amount: U256,
}

impl Default for MergedOrder {
    fn default() -> Self {
        Self {
            pair_id: H256::zero(),
            side: Side::Buy,
            net_amount: U256::zero(),
            source_orders: Vec::new(),
            total_slippage_weight: U256::zero(),
            total_amount: U256::zero(),
        }
    }
}

impl MergedOrder {
    /// Create a new MergedOrder for a given pair
    pub fn new(pair_id: H256) -> Self {
        Self {
            pair_id,
            ..Default::default()
        }
    }

    /// Calculate the weighted average slippage tier
    ///
    /// Formula: Σ(amount × slippage_tier) / Σ(amount)
    ///
    /// # Returns
    ///
    /// The weighted average slippage tier, or 0 if total_amount is zero
    pub fn weighted_avg_slippage(&self) -> U256 {
        if self.total_amount.is_zero() {
            return U256::zero();
        }
        self.total_slippage_weight / self.total_amount
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merged_order_default() {
        let merged = MergedOrder::default();
        assert_eq!(merged.pair_id, H256::zero());
        assert_eq!(merged.side, Side::Buy);
        assert_eq!(merged.net_amount, U256::zero());
        assert!(merged.source_orders.is_empty());
        assert_eq!(merged.total_slippage_weight, U256::zero());
        assert_eq!(merged.total_amount, U256::zero());
    }

    #[test]
    fn test_merged_order_new() {
        let pair_id = H256::random();
        let merged = MergedOrder::new(pair_id);
        assert_eq!(merged.pair_id, pair_id);
    }

    #[test]
    fn test_weighted_avg_slippage_zero_amount() {
        let merged = MergedOrder::default();
        assert_eq!(merged.weighted_avg_slippage(), U256::zero());
    }

    #[test]
    fn test_weighted_avg_slippage_calculation() {
        let mut merged = MergedOrder::default();
        // Simulate: 5000 @ tier 0, 5000 @ tier 2
        // Weight = 5000*0 + 5000*2 = 10000
        // Total = 10000
        // Avg = 10000 / 10000 = 1
        merged.total_slippage_weight = U256::from(10000);
        merged.total_amount = U256::from(10000);

        assert_eq!(merged.weighted_avg_slippage(), U256::from(1));
    }

    #[test]
    fn test_weighted_avg_slippage_unequal_amounts() {
        let mut merged = MergedOrder::default();
        // Simulate: 3000 @ tier 0, 7000 @ tier 2
        // Weight = 3000*0 + 7000*2 = 14000
        // Total = 10000
        // Avg = 14000 / 10000 = 1 (integer division)
        merged.total_slippage_weight = U256::from(14000);
        merged.total_amount = U256::from(10000);

        assert_eq!(merged.weighted_avg_slippage(), U256::from(1));
    }
}
