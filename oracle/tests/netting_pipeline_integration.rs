//! Netting Pipeline Integration Tests
//!
//! Comprehensive tests for the 7-step netting pipeline from architecture.md Section 8:
//!
//! STEP 1: Pair Netting     - Group by pairId, net buys vs sells
//! STEP 2: Fill Priority    - Query liquidity (execution layer concern - not in netting)
//! STEP 3: Slippage Filter  - Exclude orders above tier limit
//! STEP 4: Chain Grouping   - Batch by chain (execution layer concern - not in netting)
//! STEP 5: Bridge Netting   - Net opposite-direction bridges
//! STEP 6: USDT Netting     - Net USDC↔USDT swaps, depeg check
//! STEP 7: Fee Allocation   - Distribute costs by order size

use ethers::types::{Address, H256, U256};
use issuer::netting::{BridgeRequest, NettingEngine};
use rust_decimal::Decimal;

// Re-export common types
use common::types::{LimitOrder, OrderStatus, Side};

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

/// Create a USDC pair ID (first byte < 0x80)
fn usdc_pair(id: u8) -> H256 {
    let mut bytes = [0u8; 32];
    bytes[0] = 0x10;
    bytes[1] = id;
    H256::from(bytes)
}

/// Create a USDT pair ID (first byte >= 0x80)
fn usdt_pair_id(id: u8) -> H256 {
    let mut bytes = [0u8; 32];
    bytes[0] = 0x80;
    bytes[1] = id;
    H256::from(bytes)
}

fn u(val: u64) -> U256 {
    U256::from(val)
}

const L3: u64 = 111222333;
const ARB: u64 = 42161;

// =============================================================================
// Full Pipeline Integration Tests (AC: 6)
// =============================================================================

#[test]
fn test_full_pipeline_multi_itp_orders_netting() {
    // Scenario: Multiple ITPs submit orders for same pair
    // BTC pair: ITP-A buys $10k, ITP-B sells $3k → net buy $7k
    let mut engine = NettingEngine::new();
    let btc_pair = usdc_pair(1);

    let orders = vec![
        create_order(1, btc_pair, Side::Buy, 10_000, 1),  // ITP-A
        create_order(2, btc_pair, Side::Sell, 3_000, 1),  // ITP-B
        create_order(3, btc_pair, Side::Buy, 2_000, 1),   // ITP-C
    ];

    let result = engine.run_netting_pipeline(orders, vec![], 1.0, U256::zero());

    // Verify netting: 10k - 3k + 2k = 9k net buy
    let merged = result.merged_orders.get(&btc_pair).unwrap();
    assert_eq!(merged.side, Side::Buy);
    assert_eq!(merged.net_amount, u(9_000));
    assert_eq!(merged.source_orders.len(), 3);

    // Volume reduction: 15k → 9k (40% savings)
    let original_volume = 10_000 + 3_000 + 2_000;
    let savings_pct = (original_volume - 9_000) * 100 / original_volume;
    assert!(savings_pct > 30); // At least 30% savings
}

#[test]
fn test_full_pipeline_slippage_tier_filtering() {
    let mut engine = NettingEngine::new();
    let pair_id = usdc_pair(2);

    // Mixed tiers with 0.8% spread
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 5_000, 0),  // Tier 0 (0.3%) - excluded
        create_order(2, pair_id, Side::Buy, 3_000, 1),  // Tier 1 (1%) - included
        create_order(3, pair_id, Side::Sell, 2_000, 2), // Tier 2 (3%) - included
    ];

    let spread = Decimal::new(8, 3); // 0.8%
    let result =
        engine.run_netting_pipeline_with_slippage(orders, vec![], 1.0, U256::zero(), spread);

    // Tier 0 excluded, net = 3000 - 2000 = 1000 buy
    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.net_amount, u(1_000));
    assert_eq!(merged.source_orders.len(), 2);

    // Verify excluded order
    assert_eq!(result.excluded_orders.len(), 1);
    assert_eq!(result.excluded_orders[0].slippage_tier, u(0));
}

#[test]
fn test_full_pipeline_usdt_depeg_circuit_breaker() {
    let mut engine = NettingEngine::new();
    let usdt_pair = usdt_pair_id(1);
    let usdc_pair = usdc_pair(1);

    // Mix of USDT and USDC pairs
    let orders = vec![
        create_order(1, usdt_pair, Side::Buy, 5_000, 1),
        create_order(2, usdt_pair, Side::Sell, 3_000, 1),
        create_order(3, usdc_pair, Side::Buy, 4_000, 1),
    ];

    // Trigger depeg with 1% deviation (> 0.5% threshold)
    let result = engine.run_netting_pipeline(orders, vec![], 0.99, U256::zero());

    // USDT netting should be disabled
    assert!(result.usdt_result.netting_disabled);
    assert_eq!(result.usdt_result.swaps_at_market_rate.len(), 2); // Both USDT orders

    // Normal pair netting still works
    assert!(result.merged_orders.contains_key(&usdt_pair));
    assert!(result.merged_orders.contains_key(&usdc_pair));
}

#[test]
fn test_full_pipeline_fee_allocation_proportionality() {
    let mut engine = NettingEngine::new();
    let pair_id = usdc_pair(3);

    // Three orders: 20%, 50%, 30% of total
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 2_000, 1), // 20%
        create_order(2, pair_id, Side::Buy, 5_000, 1), // 50%
        create_order(3, pair_id, Side::Buy, 3_000, 1), // 30%
    ];

    let total_fee = u(1_000);
    let result = engine.run_netting_pipeline(orders, vec![], 1.0, total_fee);

    // Verify fee allocations
    let fees = result.fee_allocations.unwrap();
    assert_eq!(fees.len(), 3);

    // Order 1: 1000 * 2000 / 10000 = 200
    // Order 2: 1000 * 5000 / 10000 = 500
    // Order 3: 1000 * 3000 / 10000 = 300
    assert_eq!(fees[0].fee, u(200));
    assert_eq!(fees[1].fee, u(500));
    assert_eq!(fees[2].fee, u(300));

    // Sum should equal total
    let sum: U256 = fees.iter().map(|f| f.fee).fold(U256::zero(), |a, b| a + b);
    assert_eq!(sum, total_fee);
}

#[test]
fn test_full_pipeline_bridge_netting() {
    let mut engine = NettingEngine::new();

    // Opposite-direction bridges
    let bridges = vec![
        BridgeRequest::new(u(L3), u(ARB), u(100_000)), // L3 → ARB $100k
        BridgeRequest::new(u(ARB), u(L3), u(40_000)),  // ARB → L3 $40k
    ];

    let result = engine.run_netting_pipeline(vec![], bridges, 1.0, U256::zero());

    // Net bridge: $60k L3 → ARB (100k - 40k = 60k)
    assert_eq!(result.bridge_result.bridges.len(), 1);
    assert_eq!(result.bridge_result.bridges[0].amount, u(60_000));
    assert_eq!(result.bridge_result.bridges[0].source_chain, u(L3));
    assert_eq!(result.bridge_result.bridges[0].dest_chain, u(ARB));

    // Internal match: $40k each way (tuple of forward, reverse)
    assert_eq!(result.bridge_result.internal_matches.len(), 1);
    assert_eq!(result.bridge_result.internal_matches[0].0.amount, u(40_000));
}

#[test]
fn test_full_pipeline_mixed_orders_comprehensive() {
    // Comprehensive test with all pipeline steps
    let mut engine = NettingEngine::new();

    // Multiple pairs, multiple tiers
    let btc_pair = usdc_pair(1);
    let eth_pair = usdc_pair(2);
    let sol_pair = usdt_pair_id(1);

    let orders = vec![
        // BTC: mixed tiers
        create_order(1, btc_pair, Side::Buy, 10_000, 0),  // Strict - excluded at 0.8%
        create_order(2, btc_pair, Side::Sell, 3_000, 1),  // Normal - included
        create_order(3, btc_pair, Side::Buy, 5_000, 2),   // Relaxed - included
        // ETH: all included
        create_order(4, eth_pair, Side::Buy, 8_000, 1),
        create_order(5, eth_pair, Side::Sell, 12_000, 1),
        // SOL (USDT pair): all included
        create_order(6, sol_pair, Side::Buy, 4_000, 2),
        create_order(7, sol_pair, Side::Sell, 2_000, 2),
    ];

    let bridges = vec![
        BridgeRequest::new(u(L3), u(ARB), u(50_000)),
        BridgeRequest::new(u(ARB), u(L3), u(30_000)),
    ];

    let spread = Decimal::new(8, 3); // 0.8%
    let total_fee = u(500);

    let result = engine.run_netting_pipeline_with_slippage(orders, bridges, 1.0, total_fee, spread);

    // BTC: 5000 - 3000 = 2000 buy (tier 0 excluded)
    let btc_merged = result.merged_orders.get(&btc_pair).unwrap();
    assert_eq!(btc_merged.net_amount, u(2_000));

    // ETH: 8000 - 12000 = 4000 sell
    let eth_merged = result.merged_orders.get(&eth_pair).unwrap();
    assert_eq!(eth_merged.side, Side::Sell);
    assert_eq!(eth_merged.net_amount, u(4_000));

    // SOL: 4000 - 2000 = 2000 buy
    let sol_merged = result.merged_orders.get(&sol_pair).unwrap();
    assert_eq!(sol_merged.net_amount, u(2_000));

    // Bridge netting: 50k - 30k = 20k L3 → ARB
    assert_eq!(result.bridge_result.bridges[0].amount, u(20_000));

    // Excluded orders (tier 0)
    assert_eq!(result.excluded_orders.len(), 1);

    // USDT netting working (not depegged)
    assert!(!result.usdt_result.netting_disabled);

    // Fees allocated
    assert!(result.fee_allocations.is_some());
}

#[test]
fn test_pipeline_netting_savings_calculation() {
    // Validate that netting actually reduces volume
    let mut engine = NettingEngine::new();
    let pair_id = usdc_pair(4);

    // Perfect offset: 10k buy, 10k sell = 0 net
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 10_000, 1),
        create_order(2, pair_id, Side::Sell, 10_000, 1),
    ];

    let result = engine.run_netting_pipeline(orders, vec![], 1.0, U256::zero());

    let merged = result.merged_orders.get(&pair_id).unwrap();

    // Net is zero
    assert_eq!(merged.net_amount, U256::zero());

    // But both orders are tracked for fill allocation
    assert_eq!(merged.source_orders.len(), 2);
    assert_eq!(merged.total_amount, u(20_000));

    // 100% volume reduction!
    let savings = merged.total_amount - merged.net_amount;
    assert_eq!(savings, u(20_000));
}

// =============================================================================
// Rebalance Pipeline Tests
// =============================================================================

#[test]
fn test_pipeline_with_rebalance_slot_allocation() {
    use issuer::netting::RebalanceTrade;

    let mut engine = NettingEngine::new();
    let pair_id = usdc_pair(5);

    let orders = vec![
        create_order(1, pair_id, Side::Buy, 5_000, 1),
        create_order(2, pair_id, Side::Sell, 2_000, 1),
    ];

    let rebalance_trades = vec![
        RebalanceTrade {
            asset_idx: U256::zero(),
            side: Side::Buy,
            amount: U256::from(3_000),
            source_itps: vec![H256::random()],
            is_rebalance: true,
        },
        RebalanceTrade {
            asset_idx: U256::one(),
            side: Side::Sell,
            amount: U256::from(2_000),
            source_itps: vec![H256::random()],
            is_rebalance: true,
        },
    ];

    let total_capacity = 10;
    let spread = Decimal::new(5, 3); // 0.5%

    let result = engine.run_netting_pipeline_with_rebalance_and_slippage(
        orders,
        rebalance_trades,
        vec![],
        1.0,
        U256::zero(),
        total_capacity,
        spread,
    );

    // With rebalance active, slots split 50/50
    assert_eq!(result.rebalance_slots, 5);
    assert_eq!(result.user_slots, 5);

    // All user orders included (spread 0.5% < tier 1 limit 1%)
    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.net_amount, u(3_000)); // 5000 - 2000

    // Rebalance trades limited to allocated slots
    assert!(result.rebalance_trades.len() <= result.rebalance_slots);
}

// =============================================================================
// Edge Cases
// =============================================================================

#[test]
fn test_pipeline_empty_input() {
    let mut engine = NettingEngine::new();
    let result = engine.run_netting_pipeline(vec![], vec![], 1.0, U256::zero());

    assert!(result.merged_orders.is_empty());
    assert!(result.bridge_result.bridges.is_empty());
    assert!(!result.usdt_result.netting_disabled);
    assert!(result.fee_allocations.is_none());
    assert!(result.excluded_orders.is_empty());
}

#[test]
fn test_pipeline_single_order() {
    let mut engine = NettingEngine::new();
    let pair_id = usdc_pair(6);

    let orders = vec![create_order(1, pair_id, Side::Buy, 5_000, 1)];

    let result = engine.run_netting_pipeline(orders, vec![], 1.0, u(100));

    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.net_amount, u(5_000));
    assert_eq!(merged.source_orders.len(), 1);

    // Fee allocated to single order
    let fees = result.fee_allocations.unwrap();
    assert_eq!(fees.len(), 1);
    assert_eq!(fees[0].fee, u(100));
}

#[test]
fn test_pipeline_all_orders_excluded() {
    let mut engine = NettingEngine::new();
    let pair_id = usdc_pair(7);

    // All tier 0 orders with high spread
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 5_000, 0),
        create_order(2, pair_id, Side::Sell, 3_000, 0),
    ];

    let spread = Decimal::new(8, 3); // 0.8% > 0.3% tier limit
    let result =
        engine.run_netting_pipeline_with_slippage(orders, vec![], 1.0, U256::zero(), spread);

    // No merged orders (all excluded)
    assert!(result.merged_orders.is_empty());

    // Both orders excluded for retry
    assert_eq!(result.excluded_orders.len(), 2);
}
