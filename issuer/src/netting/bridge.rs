//! Bridge Netting implementation
//!
//! Nets opposite-direction bridge transfers to reduce cross-chain volume.
//!
//! # Algorithm
//!
//! 1. Group bridge requests by chain pair (source, dest)
//! 2. Find opposite direction requests (A→B and B→A)
//! 3. Net the amounts - only bridge the difference
//! 4. Track internal matches (no actual bridge needed)
//!
//! # Example
//!
//! ```text
//! Bridge requests:
//! - L3 → Arb: $50k
//! - Arb → L3: $30k
//!
//! Result after netting:
//! - L3 → Arb: $20k (actual bridge)
//! - Internal match: $30k (no bridge needed)
//!
//! Savings: 60% fewer bridge operations
//! ```

use ethers::types::U256;
use std::collections::HashMap;

/// A request for a bridge transfer between chains
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeRequest {
    /// Source chain ID
    pub source_chain: U256,
    /// Destination chain ID
    pub dest_chain: U256,
    /// Amount to bridge (18 decimals)
    pub amount: U256,
    /// Order IDs that contributed to this bridge request (for traceability)
    pub source_order_ids: Vec<U256>,
}

impl BridgeRequest {
    /// Create a new bridge request
    pub fn new(source_chain: U256, dest_chain: U256, amount: U256) -> Self {
        Self {
            source_chain,
            dest_chain,
            amount,
            source_order_ids: Vec::new(),
        }
    }

    /// Create a bridge request with associated order IDs
    pub fn with_orders(source_chain: U256, dest_chain: U256, amount: U256, order_ids: Vec<U256>) -> Self {
        Self {
            source_chain,
            dest_chain,
            amount,
            source_order_ids: order_ids,
        }
    }

    /// Get the chain pair key for grouping (ordered by chain ID)
    fn chain_pair_key(&self) -> (U256, U256) {
        if self.source_chain < self.dest_chain {
            (self.source_chain, self.dest_chain)
        } else {
            (self.dest_chain, self.source_chain)
        }
    }

    /// Check if this request is in the "forward" direction (source < dest)
    fn is_forward_direction(&self) -> bool {
        self.source_chain < self.dest_chain
    }
}

/// Result of bridge netting
#[derive(Debug, Clone, Default)]
pub struct NettedBridgeTransfers {
    /// Actual bridges needed after netting (only the net difference)
    pub bridges: Vec<BridgeRequest>,
    /// Internal matches - amounts that cancel out (no bridge needed)
    /// Each tuple is (forward request matched, reverse request matched)
    pub internal_matches: Vec<(BridgeRequest, BridgeRequest)>,
}

impl NettedBridgeTransfers {
    /// Calculate total volume reduction from netting
    pub fn volume_reduction(&self) -> (U256, U256) {
        let original: U256 = self
            .bridges
            .iter()
            .map(|b| b.amount)
            .fold(U256::zero(), |a, b| a + b)
            + self
                .internal_matches
                .iter()
                .map(|(f, r)| f.amount + r.amount)
                .fold(U256::zero(), |a, b| a + b);

        let netted: U256 = self
            .bridges
            .iter()
            .map(|b| b.amount)
            .fold(U256::zero(), |a, b| a + b);

        (original, netted)
    }
}

/// Internal accumulator for netting within a chain pair
#[derive(Default)]
struct ChainPairAccumulator {
    /// Amount flowing in forward direction (source < dest)
    forward_amount: U256,
    /// Amount flowing in reverse direction (source > dest)
    reverse_amount: U256,
    /// Source chain of forward direction
    chain_low: U256,
    /// Destination chain of forward direction
    chain_high: U256,
}

/// Net opposite-direction bridge transfers
///
/// # Arguments
///
/// * `requests` - Vector of bridge requests to net
///
/// # Returns
///
/// `NettedBridgeTransfers` containing actual bridges needed and internal matches
pub fn bridge_netting(requests: Vec<BridgeRequest>) -> NettedBridgeTransfers {
    if requests.is_empty() {
        return NettedBridgeTransfers::default();
    }

    // Group by chain pair and accumulate amounts by direction
    let mut accumulators: HashMap<(U256, U256), ChainPairAccumulator> = HashMap::new();

    for request in &requests {
        let key = request.chain_pair_key();
        let acc = accumulators.entry(key).or_insert_with(|| ChainPairAccumulator {
            chain_low: key.0,
            chain_high: key.1,
            ..Default::default()
        });

        if request.is_forward_direction() {
            acc.forward_amount += request.amount;
        } else {
            acc.reverse_amount += request.amount;
        }
    }

    let mut result = NettedBridgeTransfers::default();

    // Process each chain pair
    for (_, acc) in accumulators {
        if acc.forward_amount.is_zero() && acc.reverse_amount.is_zero() {
            continue;
        }

        // Calculate matched amount (the smaller of the two directions)
        let matched = std::cmp::min(acc.forward_amount, acc.reverse_amount);

        // Record internal match if any
        if !matched.is_zero() {
            let forward_match = BridgeRequest::new(acc.chain_low, acc.chain_high, matched);
            let reverse_match = BridgeRequest::new(acc.chain_high, acc.chain_low, matched);
            result.internal_matches.push((forward_match, reverse_match));

            tracing::debug!(
                chain_low = %acc.chain_low,
                chain_high = %acc.chain_high,
                matched_amount = %matched,
                "Bridge internal match found"
            );
        }

        // Calculate net bridge needed
        if acc.forward_amount > acc.reverse_amount {
            let net = acc.forward_amount - acc.reverse_amount;
            result
                .bridges
                .push(BridgeRequest::new(acc.chain_low, acc.chain_high, net));

            tracing::debug!(
                source = %acc.chain_low,
                dest = %acc.chain_high,
                net_amount = %net,
                "Net bridge forward"
            );
        } else if acc.reverse_amount > acc.forward_amount {
            let net = acc.reverse_amount - acc.forward_amount;
            result
                .bridges
                .push(BridgeRequest::new(acc.chain_high, acc.chain_low, net));

            tracing::debug!(
                source = %acc.chain_high,
                dest = %acc.chain_low,
                net_amount = %net,
                "Net bridge reverse"
            );
        }
        // If equal, no bridge needed (fully matched internally)
    }

    tracing::info!(
        original_requests = requests.len(),
        netted_bridges = result.bridges.len(),
        internal_matches = result.internal_matches.len(),
        "Bridge netting complete"
    );

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    // Chain IDs for testing
    const L3: u64 = 111222333;
    const ARB: u64 = 42161;
    const ETH: u64 = 1;

    fn u(val: u64) -> U256 {
        U256::from(val)
    }

    #[test]
    fn test_bridge_netting_no_netting_same_direction() {
        let requests = vec![
            BridgeRequest::new(u(L3), u(ARB), u(50000)),
            BridgeRequest::new(u(L3), u(ARB), u(30000)),
        ];

        let result = bridge_netting(requests);

        // No internal matches (all same direction)
        assert!(result.internal_matches.is_empty());
        assert_eq!(result.bridges.len(), 1);
        // Total should be 80000 in same direction
        assert_eq!(result.bridges[0].amount, u(80000));
    }

    #[test]
    fn test_bridge_netting_opposite_directions_partial() {
        let requests = vec![
            BridgeRequest::new(u(L3), u(ARB), u(50000)), // L3 → ARB
            BridgeRequest::new(u(ARB), u(L3), u(30000)), // ARB → L3
        ];

        let result = bridge_netting(requests);

        // Should have one internal match of $30k
        assert_eq!(result.internal_matches.len(), 1);
        let (fwd, rev) = &result.internal_matches[0];
        assert_eq!(fwd.amount, u(30000));
        assert_eq!(rev.amount, u(30000));

        // Net bridge should be $20k L3 → ARB
        // Direction analysis: ARB (42161) < L3 (111222333)
        // So forward = ARB → L3, reverse = L3 → ARB
        // forward_amount = 30000 (ARB → L3 request)
        // reverse_amount = 50000 (L3 → ARB request)
        // Since reverse > forward, net bridge is in reverse direction (L3 → ARB)
        // Net = 50000 - 30000 = 20000
        assert_eq!(result.bridges.len(), 1);
        assert_eq!(result.bridges[0].source_chain, u(L3));
        assert_eq!(result.bridges[0].dest_chain, u(ARB));
        assert_eq!(result.bridges[0].amount, u(20000));
    }

    #[test]
    fn test_bridge_netting_opposite_directions_full_match() {
        let requests = vec![
            BridgeRequest::new(u(L3), u(ARB), u(50000)),
            BridgeRequest::new(u(ARB), u(L3), u(50000)),
        ];

        let result = bridge_netting(requests);

        // Full match - no bridges needed
        assert!(result.bridges.is_empty());
        assert_eq!(result.internal_matches.len(), 1);
        assert_eq!(result.internal_matches[0].0.amount, u(50000));
    }

    #[test]
    fn test_bridge_netting_multiple_chain_pairs() {
        let requests = vec![
            // L3 ↔ ARB
            BridgeRequest::new(u(L3), u(ARB), u(50000)),
            BridgeRequest::new(u(ARB), u(L3), u(30000)),
            // ETH ↔ ARB
            BridgeRequest::new(u(ETH), u(ARB), u(20000)),
            BridgeRequest::new(u(ARB), u(ETH), u(20000)), // Full match
        ];

        let result = bridge_netting(requests);

        // L3 ↔ ARB: net $20k one direction, $30k internal match
        // ETH ↔ ARB: $20k internal match, no net bridge

        // One bridge (L3 ↔ ARB), one full match (ETH ↔ ARB)
        assert_eq!(result.bridges.len(), 1);
        assert_eq!(result.internal_matches.len(), 2);
    }

    #[test]
    fn test_bridge_netting_empty_input() {
        let result = bridge_netting(vec![]);

        assert!(result.bridges.is_empty());
        assert!(result.internal_matches.is_empty());
    }

    #[test]
    fn test_bridge_netting_single_request() {
        let requests = vec![BridgeRequest::new(u(L3), u(ARB), u(50000))];

        let result = bridge_netting(requests);

        // No netting possible with single request
        assert!(result.internal_matches.is_empty());
        assert_eq!(result.bridges.len(), 1);
        assert_eq!(result.bridges[0].amount, u(50000));
    }

    #[test]
    fn test_bridge_netting_three_way() {
        // Multiple requests in same direction accumulate
        let requests = vec![
            BridgeRequest::new(u(L3), u(ARB), u(30000)),
            BridgeRequest::new(u(L3), u(ARB), u(20000)),
            BridgeRequest::new(u(ARB), u(L3), u(40000)),
        ];

        let result = bridge_netting(requests);

        // Forward: 30k + 20k = 50k (L3 → ARB direction, but L3 > ARB so this is reverse)
        // Reverse: 40k (ARB → L3 direction, which is forward since ARB < L3)
        // ARB < L3, so:
        //   forward = ARB → L3 = 40k
        //   reverse = L3 → ARB = 50k
        // Match: 40k
        // Net: 50k - 40k = 10k in reverse direction (L3 → ARB)

        assert_eq!(result.internal_matches.len(), 1);
        assert_eq!(result.internal_matches[0].0.amount, u(40000));

        assert_eq!(result.bridges.len(), 1);
        assert_eq!(result.bridges[0].source_chain, u(L3));
        assert_eq!(result.bridges[0].dest_chain, u(ARB));
        assert_eq!(result.bridges[0].amount, u(10000));
    }

    #[test]
    fn test_volume_reduction_calculation() {
        let requests = vec![
            BridgeRequest::new(u(L3), u(ARB), u(50000)),
            BridgeRequest::new(u(ARB), u(L3), u(30000)),
        ];

        let result = bridge_netting(requests);
        let (original, netted) = result.volume_reduction();

        // Original: 50k + 30k internal match amounts + 20k net = 80k
        // Wait, let me recalculate:
        // internal_matches has $30k each side
        // bridges has $20k
        // original = 20k (bridges) + 30k + 30k (internal) = 80k
        // netted = 20k (bridges)
        assert_eq!(original, u(80000));
        assert_eq!(netted, u(20000));
        // 75% reduction
    }
}
