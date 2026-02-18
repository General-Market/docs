//! Order routing module for classifying merged orders by execution venue
//!
//! Routes merged orders from the netting engine to the appropriate execution path:
//! - CEX pairs -> TradeRequest event to AP (existing flow)
//! - DEX pairs on Arbitrum -> SwapOrchestrator (BLSCustody + 1inch Router)
//! - Cross-chain DEX (Fusion+) -> CrossChainOrchestrator (Arbitrum hub)

use ethers::types::H256;
use std::collections::{HashMap, HashSet};

use crate::netting::MergedOrder;

/// Execution venue for a merged order
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ExecutionVenue {
    /// CEX execution via AP (Bitget)
    Cex,
    /// DEX swap on Arbitrum via BLSCustody + 1inch Router
    DexArbitrum,
    /// Cross-chain swap via Fusion+ (through Arbitrum hub)
    CrossChain {
        /// Destination chain ID
        dst_chain_id: u64,
    },
}

/// Routing configuration
#[derive(Debug, Clone)]
pub struct RoutingConfig {
    /// Pair IDs that route to DEX on Arbitrum
    pub dex_pair_ids: HashSet<H256>,
    /// Pair IDs that route to cross-chain via Fusion+
    /// Maps pair_id -> destination chain ID
    pub crosschain_pair_ids: HashMap<H256, u64>,
}

impl Default for RoutingConfig {
    fn default() -> Self {
        Self {
            dex_pair_ids: HashSet::new(),
            crosschain_pair_ids: HashMap::new(),
        }
    }
}

/// Result of routing merged orders
#[derive(Debug)]
pub struct RoutingResult {
    /// Orders routed to CEX (AP/Bitget)
    pub cex_orders: Vec<MergedOrder>,
    /// Orders routed to DEX on Arbitrum (SwapOrchestrator)
    pub dex_orders: Vec<MergedOrder>,
    /// Orders routed to cross-chain (CrossChainOrchestrator)
    /// Tuple: (merged_order, destination_chain_id)
    pub crosschain_orders: Vec<(MergedOrder, u64)>,
}

/// Route merged orders from the netting engine to execution venues
///
/// Per architecture Section 14:
/// - CEX pair (Bitget)? -> TradeRequest event to AP (existing flow)
/// - DEX pair on Arbitrum? -> Execute via BLSCustody + 1inch Router
/// - Cross-chain DEX (Fusion+)? -> Route through Arbitrum hub
///
/// Unknown pair IDs default to CEX routing.
pub fn route_merged_orders(
    orders: Vec<MergedOrder>,
    config: &RoutingConfig,
) -> RoutingResult {
    let mut cex_orders = Vec::new();
    let mut dex_orders = Vec::new();
    let mut crosschain_orders = Vec::new();

    for order in orders {
        if config.dex_pair_ids.contains(&order.pair_id) {
            dex_orders.push(order);
        } else if let Some(&dst_chain_id) = config.crosschain_pair_ids.get(&order.pair_id) {
            crosschain_orders.push((order, dst_chain_id));
        } else {
            // Default: route to CEX
            cex_orders.push(order);
        }
    }

    RoutingResult {
        cex_orders,
        dex_orders,
        crosschain_orders,
    }
}

/// Determine the execution venue for a single pair_id
pub fn get_venue_for_pair(pair_id: &H256, config: &RoutingConfig) -> ExecutionVenue {
    if config.dex_pair_ids.contains(pair_id) {
        ExecutionVenue::DexArbitrum
    } else if let Some(&dst_chain_id) = config.crosschain_pair_ids.get(pair_id) {
        ExecutionVenue::CrossChain { dst_chain_id }
    } else {
        ExecutionVenue::Cex
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::U256;
    use common::types::Side;

    fn make_order(pair_id: H256) -> MergedOrder {
        MergedOrder {
            pair_id,
            side: Side::Buy,
            net_amount: U256::from(1_000_000u64),
            source_orders: vec![],
            total_slippage_weight: U256::zero(),
            total_amount: U256::from(1_000_000u64),
        }
    }

    fn pair_id(n: u8) -> H256 {
        let mut bytes = [0u8; 32];
        bytes[31] = n;
        H256::from(bytes)
    }

    #[test]
    fn test_route_all_cex_by_default() {
        let orders = vec![make_order(pair_id(1)), make_order(pair_id(2))];
        let config = RoutingConfig::default();

        let result = route_merged_orders(orders, &config);

        assert_eq!(result.cex_orders.len(), 2);
        assert_eq!(result.dex_orders.len(), 0);
        assert_eq!(result.crosschain_orders.len(), 0);
    }

    #[test]
    fn test_route_dex_pairs() {
        let dex_pair = pair_id(1);
        let cex_pair = pair_id(2);

        let orders = vec![make_order(dex_pair), make_order(cex_pair)];

        let mut dex_pair_ids = HashSet::new();
        dex_pair_ids.insert(dex_pair);

        let config = RoutingConfig {
            dex_pair_ids,
            crosschain_pair_ids: HashMap::new(),
        };

        let result = route_merged_orders(orders, &config);

        assert_eq!(result.dex_orders.len(), 1);
        assert_eq!(result.dex_orders[0].pair_id, dex_pair);
        assert_eq!(result.cex_orders.len(), 1);
        assert_eq!(result.cex_orders[0].pair_id, cex_pair);
    }

    #[test]
    fn test_route_crosschain_pairs() {
        let crosschain_pair = pair_id(3);
        let cex_pair = pair_id(4);

        let orders = vec![make_order(crosschain_pair), make_order(cex_pair)];

        let mut crosschain_pair_ids = HashMap::new();
        crosschain_pair_ids.insert(crosschain_pair, 1u64); // Ethereum

        let config = RoutingConfig {
            dex_pair_ids: HashSet::new(),
            crosschain_pair_ids,
        };

        let result = route_merged_orders(orders, &config);

        assert_eq!(result.crosschain_orders.len(), 1);
        assert_eq!(result.crosschain_orders[0].0.pair_id, crosschain_pair);
        assert_eq!(result.crosschain_orders[0].1, 1); // Ethereum
        assert_eq!(result.cex_orders.len(), 1);
    }

    #[test]
    fn test_route_mixed_venues() {
        let dex_pair = pair_id(1);
        let crosschain_pair = pair_id(2);
        let cex_pair = pair_id(3);

        let orders = vec![
            make_order(dex_pair),
            make_order(crosschain_pair),
            make_order(cex_pair),
        ];

        let mut dex_pair_ids = HashSet::new();
        dex_pair_ids.insert(dex_pair);

        let mut crosschain_pair_ids = HashMap::new();
        crosschain_pair_ids.insert(crosschain_pair, 8453); // Base

        let config = RoutingConfig {
            dex_pair_ids,
            crosschain_pair_ids,
        };

        let result = route_merged_orders(orders, &config);

        assert_eq!(result.dex_orders.len(), 1);
        assert_eq!(result.crosschain_orders.len(), 1);
        assert_eq!(result.cex_orders.len(), 1);
    }

    #[test]
    fn test_route_empty_orders() {
        let config = RoutingConfig::default();
        let result = route_merged_orders(vec![], &config);

        assert!(result.cex_orders.is_empty());
        assert!(result.dex_orders.is_empty());
        assert!(result.crosschain_orders.is_empty());
    }

    #[test]
    fn test_get_venue_for_pair() {
        let dex_pair = pair_id(1);
        let crosschain_pair = pair_id(2);
        let cex_pair = pair_id(3);

        let mut dex_pair_ids = HashSet::new();
        dex_pair_ids.insert(dex_pair);

        let mut crosschain_pair_ids = HashMap::new();
        crosschain_pair_ids.insert(crosschain_pair, 1u64);

        let config = RoutingConfig {
            dex_pair_ids,
            crosschain_pair_ids,
        };

        assert_eq!(get_venue_for_pair(&dex_pair, &config), ExecutionVenue::DexArbitrum);
        assert_eq!(
            get_venue_for_pair(&crosschain_pair, &config),
            ExecutionVenue::CrossChain { dst_chain_id: 1 }
        );
        assert_eq!(get_venue_for_pair(&cex_pair, &config), ExecutionVenue::Cex);
    }

    #[test]
    fn test_execution_venue_equality() {
        assert_eq!(ExecutionVenue::Cex, ExecutionVenue::Cex);
        assert_eq!(ExecutionVenue::DexArbitrum, ExecutionVenue::DexArbitrum);
        assert_ne!(ExecutionVenue::Cex, ExecutionVenue::DexArbitrum);
        assert_eq!(
            ExecutionVenue::CrossChain { dst_chain_id: 1 },
            ExecutionVenue::CrossChain { dst_chain_id: 1 }
        );
        assert_ne!(
            ExecutionVenue::CrossChain { dst_chain_id: 1 },
            ExecutionVenue::CrossChain { dst_chain_id: 8453 }
        );
    }

    #[test]
    fn test_dex_pair_precedence_over_crosschain() {
        // If a pair is in both dex and crosschain sets, DEX takes precedence
        let pair = pair_id(1);

        let mut dex_pair_ids = HashSet::new();
        dex_pair_ids.insert(pair);

        let mut crosschain_pair_ids = HashMap::new();
        crosschain_pair_ids.insert(pair, 1u64);

        let config = RoutingConfig {
            dex_pair_ids,
            crosschain_pair_ids,
        };

        let orders = vec![make_order(pair)];
        let result = route_merged_orders(orders, &config);

        // DEX should win
        assert_eq!(result.dex_orders.len(), 1);
        assert_eq!(result.crosschain_orders.len(), 0);
    }
}
