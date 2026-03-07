//! Integration tests for the Netting Engine
//!
//! These tests verify the complete netting pipeline and cross-module interactions.

use super::*;
use common::types::{LimitOrder, OrderStatus, Side};
use ethers::types::{Address, H256, U256};

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
fn usdc_pair() -> H256 {
    let mut bytes = [0u8; 32];
    bytes[0] = 0x10;
    bytes[1] = 0x01; // Different pair
    H256::from(bytes)
}

/// Create a USDT pair ID (first byte >= 0x80)
fn usdt_pair() -> H256 {
    let mut bytes = [0u8; 32];
    bytes[0] = 0x80;
    bytes[1] = 0x01;
    H256::from(bytes)
}

// Chain IDs for testing
const L3: u64 = 111222333;
const SETTLEMENT: u64 = 42161;

fn u(val: u64) -> U256 {
    U256::from(val)
}

#[test]
fn test_netting_engine_creation() {
    let engine = NettingEngine::new();
    assert!(!engine.depeg_state().is_depegged);
    assert_eq!(engine.depeg_state().last_rate, 1.0);
}

#[test]
fn test_netting_engine_default() {
    let engine = NettingEngine::default();
    assert!(!engine.depeg_state().is_depegged);
}

#[test]
fn test_full_netting_pipeline() {
    let mut engine = NettingEngine::new();

    // Create orders for netting
    let pair_btc = H256::random();
    let orders = vec![
        create_order(1, pair_btc, Side::Buy, 10000, 1),
        create_order(2, pair_btc, Side::Sell, 3000, 1),
    ];

    // Create bridge requests
    let bridges = vec![
        BridgeRequest::new(u(L3), u(SETTLEMENT), u(50000)),
        BridgeRequest::new(u(SETTLEMENT), u(L3), u(30000)),
    ];

    // Run pipeline
    let result = engine.run_netting_pipeline(orders, bridges, 1.0, U256::zero());

    // Verify pair netting
    assert_eq!(result.merged_orders.len(), 1);
    let merged = result.merged_orders.get(&pair_btc).unwrap();
    assert_eq!(merged.side, Side::Buy);
    assert_eq!(merged.net_amount, u(7000));
    assert_eq!(merged.source_orders.len(), 2);

    // Verify bridge netting
    assert_eq!(result.bridge_result.bridges.len(), 1);
    assert_eq!(result.bridge_result.bridges[0].amount, u(20000));
    assert_eq!(result.bridge_result.internal_matches.len(), 1);

    // Verify USDT netting (no depeg)
    assert!(!result.usdt_result.netting_disabled);
}

#[test]
fn test_netting_pipeline_with_depeg() {
    let mut engine = NettingEngine::new();

    let orders = vec![
        create_order(1, usdt_pair(), Side::Buy, 5000, 1),
        create_order(2, usdt_pair(), Side::Sell, 3000, 1),
    ];

    // Run pipeline with depegged rate
    let result = engine.run_netting_pipeline(orders, vec![], 0.99, U256::zero());

    // USDT netting should be disabled
    assert!(result.usdt_result.netting_disabled);
    assert!(engine.depeg_state().is_depegged);
    assert_eq!(result.usdt_result.swaps_at_market_rate.len(), 2);
}

#[test]
fn test_netting_pipeline_empty_inputs() {
    let mut engine = NettingEngine::new();

    let result = engine.run_netting_pipeline(vec![], vec![], 1.0, U256::zero());

    assert!(result.merged_orders.is_empty());
    assert!(result.bridge_result.bridges.is_empty());
    assert!(!result.usdt_result.netting_disabled);
}

#[test]
fn test_netting_pipeline_multiple_pairs() {
    let mut engine = NettingEngine::new();

    let pair_btc = H256::random();
    let pair_eth = H256::random();

    let orders = vec![
        // BTC pair: net buy
        create_order(1, pair_btc, Side::Buy, 10000, 1),
        create_order(2, pair_btc, Side::Sell, 3000, 1),
        // ETH pair: net sell
        create_order(3, pair_eth, Side::Buy, 2000, 2),
        create_order(4, pair_eth, Side::Sell, 8000, 0),
    ];

    let result = engine.run_netting_pipeline(orders, vec![], 1.0, U256::zero());

    assert_eq!(result.merged_orders.len(), 2);

    let btc_merged = result.merged_orders.get(&pair_btc).unwrap();
    assert_eq!(btc_merged.side, Side::Buy);
    assert_eq!(btc_merged.net_amount, u(7000));

    let eth_merged = result.merged_orders.get(&pair_eth).unwrap();
    assert_eq!(eth_merged.side, Side::Sell);
    assert_eq!(eth_merged.net_amount, u(6000));
}

#[test]
fn test_merged_order_weighted_slippage_integration() {
    let mut engine = NettingEngine::new();

    let pair_id = H256::random();
    // Mix of tiers: 5k @ tier 0, 3k @ tier 1, 2k @ tier 2
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 5000, 0), // 5000 * 0 = 0
        create_order(2, pair_id, Side::Buy, 3000, 1), // 3000 * 1 = 3000
        create_order(3, pair_id, Side::Buy, 2000, 2), // 2000 * 2 = 4000
    ];
    // Total weight: 7000
    // Total amount: 10000
    // Weighted avg: 7000 / 10000 = 0 (integer division)

    let result = engine.run_netting_pipeline(orders, vec![], 1.0, U256::zero());

    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.total_slippage_weight, u(7000));
    assert_eq!(merged.total_amount, u(10000));
    // Integer division: 7000 / 10000 = 0
    assert_eq!(merged.weighted_avg_slippage(), U256::zero());
}

#[test]
fn test_fee_allocation_integration() {
    let orders = vec![
        create_order(1, H256::random(), Side::Buy, 2000, 1), // 20%
        create_order(2, H256::random(), Side::Buy, 5000, 1), // 50%
        create_order(3, H256::random(), Side::Buy, 3000, 1), // 30%
    ];

    let total_fee = u(1000);
    let allocations = fee_allocation(&orders, total_fee, FeeType::Bridge).unwrap();

    assert_eq!(allocations.len(), 3);

    // Verify proportional distribution
    // Order 1: 1000 * 2000 / 10000 = 200
    // Order 2: 1000 * 5000 / 10000 = 500
    // Order 3: 1000 * 3000 / 10000 = 300
    assert_eq!(allocations[0].fee, u(200));
    assert_eq!(allocations[1].fee, u(500));
    assert_eq!(allocations[2].fee, u(300));

    // Sum should equal total
    let sum: U256 = allocations.iter().map(|a| a.fee).fold(U256::zero(), |a, b| a + b);
    assert_eq!(sum, total_fee);
}

#[test]
fn test_bridge_netting_volume_savings() {
    let bridges = vec![
        BridgeRequest::new(u(L3), u(SETTLEMENT), u(100_000)),
        BridgeRequest::new(u(SETTLEMENT), u(L3), u(60_000)),
    ];

    let result = bridge_netting(bridges);
    let (original, netted) = result.volume_reduction();

    // Original: 100k + 60k internal + 40k net = 200k
    // Wait, let me recalculate...
    // Internal match: $60k each way (because min(100k, 60k) = 60k)
    // Net bridge: $40k L3 → Settlement
    // volume_reduction returns:
    //   original = bridges + internal = 40k + (60k + 60k) = 160k
    //   netted = bridges = 40k
    assert_eq!(original, u(160_000));
    assert_eq!(netted, u(40_000));

    // 75% reduction
    assert!(netted < original / u(2));
}

#[test]
fn test_depeg_state_persists_across_calls() {
    let mut engine = NettingEngine::new();

    // First call with depeg
    let _ = engine.run_netting_pipeline(vec![], vec![], 0.99, U256::zero());
    assert!(engine.depeg_state().is_depegged);

    // Second call - still depegged (rate still bad)
    let _ = engine.run_netting_pipeline(vec![], vec![], 0.985, U256::zero());
    assert!(engine.depeg_state().is_depegged);

    // Rate recovers but needs 1 hour stability
    let _ = engine.run_netting_pipeline(vec![], vec![], 0.998, U256::zero());
    assert!(engine.depeg_state().is_depegged); // Still depegged
    assert!(engine.depeg_state().stable_since.is_some()); // But tracking
}

#[test]
fn test_netting_example_from_spec() {
    // From architecture spec:
    // User A: BUY $10k "BTC Max" ITP (100% BTC)
    // User B: SELL $3k "Crypto Blend" ITP (40% BTC = $1.2k BTC)
    //
    // Result:
    // - Net BUY $7k BTC (if we simplify to single pair)

    let mut engine = NettingEngine::new();
    let btc_pair = H256::random();

    let orders = vec![
        create_order(1, btc_pair, Side::Buy, 10_000, 1),
        create_order(2, btc_pair, Side::Sell, 3_000, 1),
    ];

    let result = engine.run_netting_pipeline(orders, vec![], 1.0, U256::zero());

    let merged = result.merged_orders.get(&btc_pair).unwrap();
    assert_eq!(merged.side, Side::Buy);
    assert_eq!(merged.net_amount, u(7_000));

    // Volume reduction: (10k + 3k) - 7k = 6k saved
    // Original volume: 13k
    // New volume: 7k
    // Savings: 46%
    assert!(merged.net_amount < merged.total_amount);
}

#[test]
fn test_zero_net_amount_handling() {
    let mut engine = NettingEngine::new();
    let pair_id = H256::random();

    // Equal buy and sell = zero net
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 5000, 1),
        create_order(2, pair_id, Side::Sell, 5000, 1),
    ];

    let result = engine.run_netting_pipeline(orders, vec![], 1.0, U256::zero());

    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.net_amount, U256::zero());
    assert_eq!(merged.source_orders.len(), 2); // Both tracked for allocation
}

// =============================================================================
// Slippage Filtering Integration Tests (AC: 3)
// =============================================================================

#[test]
fn test_slippage_filtering_mixed_tiers() {
    use rust_decimal::Decimal;

    let mut engine = NettingEngine::new();
    let pair_id = H256::random();

    // Mixed tiers: tier 0 (0.3%), tier 1 (1%), tier 2 (3%)
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 3000, 0), // Strict 0.3%
        create_order(2, pair_id, Side::Buy, 5000, 1), // Normal 1%
        create_order(3, pair_id, Side::Buy, 2000, 2), // Relaxed 3%
    ];

    // Run with 0.8% spread - excludes tier 0, includes tier 1 and 2
    let spread = Decimal::new(8, 3); // 0.008 = 0.8%
    let result = engine.run_netting_pipeline_with_slippage(orders, vec![], 1.0, U256::zero(), spread);

    // Only tier 1 and tier 2 orders should be included
    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.source_orders.len(), 2);
    assert_eq!(merged.net_amount, u(7000)); // 5000 + 2000

    // Tier 0 order should be excluded
    assert_eq!(result.excluded_orders.len(), 1);
    assert_eq!(result.excluded_orders[0].id, u(1));
}

#[test]
fn test_slippage_filtering_all_excluded() {
    use rust_decimal::Decimal;

    let mut engine = NettingEngine::new();
    let pair_id = H256::random();

    // All tier 0 orders
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 3000, 0),
        create_order(2, pair_id, Side::Buy, 5000, 0),
    ];

    // Run with 0.8% spread - excludes all tier 0
    let spread = Decimal::new(8, 3);
    let result = engine.run_netting_pipeline_with_slippage(orders, vec![], 1.0, U256::zero(), spread);

    // No merged orders (all excluded)
    assert!(result.merged_orders.is_empty());

    // All orders excluded
    assert_eq!(result.excluded_orders.len(), 2);
}

#[test]
fn test_slippage_filtering_all_included() {
    use rust_decimal::Decimal;

    let mut engine = NettingEngine::new();
    let pair_id = H256::random();

    // All tier 2 orders
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 3000, 2),
        create_order(2, pair_id, Side::Buy, 5000, 2),
    ];

    // Run with 0.8% spread - includes all tier 2 (max 3%)
    let spread = Decimal::new(8, 3);
    let result = engine.run_netting_pipeline_with_slippage(orders, vec![], 1.0, U256::zero(), spread);

    // All orders included
    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.source_orders.len(), 2);
    assert_eq!(merged.net_amount, u(8000));

    // No orders excluded
    assert!(result.excluded_orders.is_empty());
}

#[test]
fn test_slippage_filtering_zero_spread_includes_all() {
    use rust_decimal::Decimal;

    let mut engine = NettingEngine::new();
    let pair_id = H256::random();

    // Mixed tiers including strict tier 0
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 3000, 0),
        create_order(2, pair_id, Side::Buy, 5000, 1),
        create_order(3, pair_id, Side::Buy, 2000, 2),
    ];

    // Zero spread - all orders included (even tier 0)
    let result = engine.run_netting_pipeline_with_slippage(
        orders,
        vec![],
        1.0,
        U256::zero(),
        Decimal::ZERO,
    );

    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.source_orders.len(), 3);
    assert_eq!(merged.net_amount, u(10000));
    assert!(result.excluded_orders.is_empty());
}

#[test]
fn test_slippage_filtering_recalculates_net_amount() {
    use rust_decimal::Decimal;

    let mut engine = NettingEngine::new();
    let pair_id = H256::random();

    // BUY and SELL with different tiers
    let orders = vec![
        create_order(1, pair_id, Side::Buy, 10000, 0),  // Strict - excluded
        create_order(2, pair_id, Side::Sell, 3000, 1),  // Normal - included
        create_order(3, pair_id, Side::Buy, 5000, 2),   // Relaxed - included
    ];

    // 0.8% spread excludes tier 0 BUY
    let spread = Decimal::new(8, 3);
    let result = engine.run_netting_pipeline_with_slippage(orders, vec![], 1.0, U256::zero(), spread);

    // After filtering: SELL 3000 + BUY 5000 = net BUY 2000
    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.source_orders.len(), 2);
    assert_eq!(merged.side, Side::Buy);
    assert_eq!(merged.net_amount, u(2000)); // 5000 - 3000

    // Tier 0 BUY excluded
    assert_eq!(result.excluded_orders.len(), 1);
    assert_eq!(result.excluded_orders[0].id, u(1));
}

#[test]
fn test_slippage_filtering_multiple_pairs() {
    use rust_decimal::Decimal;

    let mut engine = NettingEngine::new();
    let pair_btc = H256::random();
    let pair_eth = H256::random();

    let orders = vec![
        // BTC pair: tier 0 excluded, tier 1 included
        create_order(1, pair_btc, Side::Buy, 5000, 0),
        create_order(2, pair_btc, Side::Buy, 3000, 1),
        // ETH pair: all tier 2 included
        create_order(3, pair_eth, Side::Buy, 8000, 2),
        create_order(4, pair_eth, Side::Sell, 2000, 2),
    ];

    let spread = Decimal::new(8, 3); // 0.8%
    let result = engine.run_netting_pipeline_with_slippage(orders, vec![], 1.0, U256::zero(), spread);

    // BTC: only tier 1 order (3000)
    let btc_merged = result.merged_orders.get(&pair_btc).unwrap();
    assert_eq!(btc_merged.net_amount, u(3000));
    assert_eq!(btc_merged.source_orders.len(), 1);

    // ETH: both tier 2 orders (8000 - 2000 = 6000)
    let eth_merged = result.merged_orders.get(&pair_eth).unwrap();
    assert_eq!(eth_merged.net_amount, u(6000));
    assert_eq!(eth_merged.source_orders.len(), 2);

    // One excluded order (BTC tier 0)
    assert_eq!(result.excluded_orders.len(), 1);
}

#[test]
fn test_slippage_filtering_with_rebalance() {
    use rust_decimal::Decimal;

    let mut engine = NettingEngine::new();
    let pair_id = H256::random();

    let orders = vec![
        create_order(1, pair_id, Side::Buy, 5000, 0), // Excluded
        create_order(2, pair_id, Side::Buy, 3000, 1), // Included
    ];

    let rebalance_trades = vec![
        RebalanceTrade {
            asset_idx: U256::from(0),
            side: Side::Buy,
            amount: U256::from(1000),
            source_itps: vec![H256::random()],
            is_rebalance: true,
        },
    ];

    let spread = Decimal::new(8, 3);
    let result = engine.run_netting_pipeline_with_rebalance_and_slippage(
        orders,
        rebalance_trades,
        vec![],
        1.0,
        U256::zero(),
        100, // total capacity
        spread,
    );

    // Verify slippage filtering applied
    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.net_amount, u(3000));
    assert_eq!(result.excluded_orders.len(), 1);

    // Verify rebalance trades included
    assert_eq!(result.rebalance_trades.len(), 1);
}

#[test]
fn test_legacy_api_backwards_compatible() {
    // Test that the legacy API (without spread) still works
    let mut engine = NettingEngine::new();
    let pair_id = H256::random();

    let orders = vec![
        create_order(1, pair_id, Side::Buy, 5000, 0), // Tier 0
        create_order(2, pair_id, Side::Buy, 3000, 1), // Tier 1
    ];

    // Legacy API uses ZERO spread internally (includes all)
    let result = engine.run_netting_pipeline(orders, vec![], 1.0, U256::zero());

    let merged = result.merged_orders.get(&pair_id).unwrap();
    assert_eq!(merged.source_orders.len(), 2);
    assert_eq!(merged.net_amount, u(8000));
    assert!(result.excluded_orders.is_empty());
}
