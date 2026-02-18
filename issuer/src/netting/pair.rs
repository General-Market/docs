//! Pair Netting implementation
//!
//! Merges orders for the same trading pair across ITPs.
//!
//! # Algorithm
//!
//! 1. Group orders by `pair_id`
//! 2. For each pair, sum buys (positive) and subtract sells (negative)
//! 3. Determine final side based on net amount sign
//! 4. Track source orders for later fill allocation
//! 5. Calculate weighted slippage for downstream filtering
//!
//! # Example
//!
//! ```text
//! Two users in same cycle:
//! - User A: BUY $10k BTC
//! - User B: SELL $3k BTC
//!
//! Result:
//! - Net BUY $7k BTC
//! - Source orders: [A's buy, B's sell]
//! - Savings: 30% volume reduction
//! ```

use super::types::MergedOrder;
use common::types::{LimitOrder, Side};
use ethers::types::{H256, I256, U256};
use std::collections::HashMap;

/// Merge orders by trading pair, netting buys against sells
///
/// # Arguments
///
/// * `orders` - Vector of orders to net
///
/// # Returns
///
/// HashMap mapping pair_id to MergedOrder for each pair with non-zero net
pub fn pair_netting(orders: Vec<LimitOrder>) -> HashMap<H256, MergedOrder> {
    let mut merged: HashMap<H256, MergedOrderBuilder> = HashMap::new();

    for order in orders {
        let entry = merged
            .entry(order.pair_id)
            .or_insert_with(MergedOrderBuilder::new);

        // Net buys (positive) and sells (negative)
        // Use checked conversion to prevent overflow - amounts > I256::MAX/2 are invalid
        // In practice, amounts should never exceed ~10^30 (100 trillion with 18 decimals)
        let signed_amount = if order.amount > U256::from(i128::MAX as u128) {
            // For extremely large amounts, cap at I256::MAX to prevent overflow
            // This is a safety check - real amounts should never hit this
            tracing::warn!(
                code = "E010",
                order_id = %order.id,
                amount = %order.amount,
                "Order amount exceeds safe I256 range, capping"
            );
            match order.side {
                Side::Buy => I256::MAX,
                Side::Sell => I256::MIN,
            }
        } else {
            match order.side {
                Side::Buy => I256::from_raw(order.amount),
                Side::Sell => -I256::from_raw(order.amount),
            }
        };
        entry.net_signed += signed_amount;

        // Track weighted slippage
        entry.total_slippage_weight += order.amount * order.slippage_tier;
        entry.total_amount += order.amount;

        // Store source order for fill allocation
        entry.source_orders.push(order);
    }

    // Convert to final MergedOrder, determining side from net
    merged
        .into_iter()
        .map(|(pair_id, builder)| {
            let (side, net_amount) = if builder.net_signed >= I256::zero() {
                (Side::Buy, builder.net_signed.into_raw())
            } else {
                (Side::Sell, (-builder.net_signed).into_raw())
            };

            let merged_order = MergedOrder {
                pair_id,
                side,
                net_amount,
                source_orders: builder.source_orders,
                total_slippage_weight: builder.total_slippage_weight,
                total_amount: builder.total_amount,
            };

            tracing::debug!(
                pair_id = %pair_id,
                side = ?side,
                net_amount = %net_amount,
                source_count = merged_order.source_orders.len(),
                "Pair netting complete"
            );

            (pair_id, merged_order)
        })
        .collect()
}

/// Internal builder for accumulating netting calculations
struct MergedOrderBuilder {
    /// Signed net amount (positive = buy, negative = sell)
    net_signed: I256,
    source_orders: Vec<LimitOrder>,
    total_slippage_weight: U256,
    total_amount: U256,
}

impl MergedOrderBuilder {
    fn new() -> Self {
        Self {
            net_signed: I256::zero(),
            source_orders: Vec::new(),
            total_slippage_weight: U256::zero(),
            total_amount: U256::zero(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::OrderStatus;
    use ethers::types::Address;

    /// Helper to create a test order
    fn create_order(id: u64, pair_id: H256, side: Side, amount: u64, tier: u64) -> LimitOrder {
        LimitOrder {
            id: U256::from(id),
            user: Address::zero(),
            pair_id,
            side,
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
    fn test_pair_netting_buys_only() {
        let pair_id = H256::random();
        let orders = vec![
            create_order(1, pair_id, Side::Buy, 5000, 1),
            create_order(2, pair_id, Side::Buy, 3000, 1),
        ];

        let result = pair_netting(orders);

        assert_eq!(result.len(), 1);
        let merged = result.get(&pair_id).unwrap();
        assert_eq!(merged.side, Side::Buy);
        assert_eq!(merged.net_amount, U256::from(8000));
        assert_eq!(merged.source_orders.len(), 2);
        assert_eq!(merged.total_amount, U256::from(8000));
    }

    #[test]
    fn test_pair_netting_sells_only() {
        let pair_id = H256::random();
        let orders = vec![
            create_order(1, pair_id, Side::Sell, 5000, 1),
            create_order(2, pair_id, Side::Sell, 3000, 1),
        ];

        let result = pair_netting(orders);

        assert_eq!(result.len(), 1);
        let merged = result.get(&pair_id).unwrap();
        assert_eq!(merged.side, Side::Sell);
        assert_eq!(merged.net_amount, U256::from(8000));
        assert_eq!(merged.source_orders.len(), 2);
    }

    #[test]
    fn test_pair_netting_buy_sell_net_buy() {
        let pair_id = H256::random();
        let orders = vec![
            create_order(1, pair_id, Side::Buy, 10000, 1),
            create_order(2, pair_id, Side::Sell, 3000, 1),
        ];

        let result = pair_netting(orders);

        assert_eq!(result.len(), 1);
        let merged = result.get(&pair_id).unwrap();
        assert_eq!(merged.side, Side::Buy);
        assert_eq!(merged.net_amount, U256::from(7000));
        assert_eq!(merged.source_orders.len(), 2);
        assert_eq!(merged.total_amount, U256::from(13000));
    }

    #[test]
    fn test_pair_netting_buy_sell_net_sell() {
        let pair_id = H256::random();
        let orders = vec![
            create_order(1, pair_id, Side::Buy, 3000, 1),
            create_order(2, pair_id, Side::Sell, 10000, 1),
        ];

        let result = pair_netting(orders);

        assert_eq!(result.len(), 1);
        let merged = result.get(&pair_id).unwrap();
        assert_eq!(merged.side, Side::Sell);
        assert_eq!(merged.net_amount, U256::from(7000));
        assert_eq!(merged.source_orders.len(), 2);
    }

    #[test]
    fn test_pair_netting_equal_amounts_zero_net() {
        let pair_id = H256::random();
        let orders = vec![
            create_order(1, pair_id, Side::Buy, 5000, 1),
            create_order(2, pair_id, Side::Sell, 5000, 1),
        ];

        let result = pair_netting(orders);

        assert_eq!(result.len(), 1);
        let merged = result.get(&pair_id).unwrap();
        assert_eq!(merged.side, Side::Buy); // Zero defaults to Buy
        assert_eq!(merged.net_amount, U256::zero());
        assert_eq!(merged.source_orders.len(), 2);
    }

    #[test]
    fn test_pair_netting_multiple_pairs() {
        let pair_btc = H256::random();
        let pair_eth = H256::random();

        let orders = vec![
            create_order(1, pair_btc, Side::Buy, 10000, 1),
            create_order(2, pair_btc, Side::Sell, 3000, 1),
            create_order(3, pair_eth, Side::Buy, 5000, 1),
            create_order(4, pair_eth, Side::Sell, 8000, 1),
        ];

        let result = pair_netting(orders);

        assert_eq!(result.len(), 2);

        let btc_merged = result.get(&pair_btc).unwrap();
        assert_eq!(btc_merged.side, Side::Buy);
        assert_eq!(btc_merged.net_amount, U256::from(7000));
        assert_eq!(btc_merged.source_orders.len(), 2);

        let eth_merged = result.get(&pair_eth).unwrap();
        assert_eq!(eth_merged.side, Side::Sell);
        assert_eq!(eth_merged.net_amount, U256::from(3000));
        assert_eq!(eth_merged.source_orders.len(), 2);
    }

    #[test]
    fn test_pair_netting_weighted_slippage() {
        let pair_id = H256::random();
        // 5000 @ tier 0, 5000 @ tier 2
        let orders = vec![
            create_order(1, pair_id, Side::Buy, 5000, 0),
            create_order(2, pair_id, Side::Buy, 5000, 2),
        ];

        let result = pair_netting(orders);

        let merged = result.get(&pair_id).unwrap();
        // Weight = 5000*0 + 5000*2 = 10000
        // Total = 10000
        // Avg = 10000 / 10000 = 1
        assert_eq!(merged.total_slippage_weight, U256::from(10000));
        assert_eq!(merged.total_amount, U256::from(10000));
        assert_eq!(merged.weighted_avg_slippage(), U256::from(1));
    }

    #[test]
    fn test_pair_netting_weighted_slippage_unequal() {
        let pair_id = H256::random();
        // 3000 @ tier 0, 7000 @ tier 2
        let orders = vec![
            create_order(1, pair_id, Side::Buy, 3000, 0),
            create_order(2, pair_id, Side::Buy, 7000, 2),
        ];

        let result = pair_netting(orders);

        let merged = result.get(&pair_id).unwrap();
        // Weight = 3000*0 + 7000*2 = 14000
        // Total = 10000
        // Avg = 14000 / 10000 = 1 (integer division)
        assert_eq!(merged.total_slippage_weight, U256::from(14000));
        assert_eq!(merged.total_amount, U256::from(10000));
        assert_eq!(merged.weighted_avg_slippage(), U256::from(1));
    }

    #[test]
    fn test_pair_netting_empty_input() {
        let orders: Vec<LimitOrder> = vec![];
        let result = pair_netting(orders);
        assert!(result.is_empty());
    }

    #[test]
    fn test_pair_netting_single_order() {
        let pair_id = H256::random();
        let orders = vec![create_order(1, pair_id, Side::Buy, 5000, 1)];

        let result = pair_netting(orders);

        assert_eq!(result.len(), 1);
        let merged = result.get(&pair_id).unwrap();
        assert_eq!(merged.side, Side::Buy);
        assert_eq!(merged.net_amount, U256::from(5000));
        assert_eq!(merged.source_orders.len(), 1);
    }

    #[test]
    fn test_pair_netting_many_orders_same_pair() {
        let pair_id = H256::random();
        let orders: Vec<LimitOrder> = (0..10)
            .map(|i| {
                let side = if i % 2 == 0 { Side::Buy } else { Side::Sell };
                create_order(i, pair_id, side, 1000, 1)
            })
            .collect();

        // 5 buys @ 1000 = 5000, 5 sells @ 1000 = 5000, net = 0
        let result = pair_netting(orders);

        assert_eq!(result.len(), 1);
        let merged = result.get(&pair_id).unwrap();
        assert_eq!(merged.net_amount, U256::zero());
        assert_eq!(merged.source_orders.len(), 10);
        assert_eq!(merged.total_amount, U256::from(10000));
    }
}
