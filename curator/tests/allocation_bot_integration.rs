//! Decision logic tests for the Allocation Bot
//!
//! NOTE: These tests validate the allocation DECISION LOGIC using mock market data.
//! They do NOT test actual contract interaction or require a running anvil instance.
//!
//! For true end-to-end integration tests with deployed contracts, see the
//! Foundry tests in contracts/test/MorphoE2E.t.sol.
//!
//! What these tests cover:
//! - Utilization threshold detection (high/low/critical/target range)
//! - Tier cap enforcement (A=30%, B=20%, C=10%, D=5%)
//! - Priority ordering of allocation decisions
//! - Default tier assignment for unconfigured markets

use curator::allocator::{
    AllocationAction, AllocationBot, AllocationDecision, MarketMetrics, MarketParamsData,
    TARGET_UTILIZATION_MAX, TARGET_UTILIZATION_MIN, UTILIZATION_CRITICAL_HIGH,
    UTILIZATION_CRITICAL_LOW,
};
use curator::tier_config::{RiskTier, RiskTierConfig};
use ethers::types::{Address, U256};
use std::collections::HashMap;

/// Helper to create mock market metrics for testing decision logic
fn make_market_metrics(
    id: u8,
    total_supply: u64,
    total_borrow: u64,
    vault_supply: u64,
) -> MarketMetrics {
    let mut market_id = [0u8; 32];
    market_id[0] = id;

    let ts = U256::from(total_supply);
    let tb = U256::from(total_borrow);

    let utilization_pct = if total_supply == 0 {
        0
    } else {
        ((total_borrow as u128 * 100) / total_supply as u128) as u8
    };

    MarketMetrics {
        market_id,
        total_supply: ts,
        total_borrow: tb,
        total_supply_shares: ts,
        utilization_pct,
        vault_supply: U256::from(vault_supply),
        market_params: MarketParamsData {
            loan_token: Address::zero(),
            collateral_token: Address::zero(),
            oracle: Address::zero(),
            irm: Address::zero(),
            lltv: U256::zero(),
        },
    }
}

#[test]
fn test_allocation_bot_single_market_high_utilization() {
    // Test: Single market with high utilization should get supply decision
    let metrics = vec![make_market_metrics(1, 1000, 900, 50)]; // 90% util
    let vault_total = U256::from(1000);

    let mut tier_configs = HashMap::new();
    tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::A)); // 30% cap

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    assert_eq!(decisions.len(), 1);
    assert_eq!(decisions[0].action, AllocationAction::Supply);
    assert!(decisions[0].utilization_pct() >= UTILIZATION_CRITICAL_HIGH);

    // Max cap = 30% of 1000 = 300, current = 50, headroom = 250
    assert_eq!(decisions[0].amount, U256::from(250));
}

#[test]
fn test_allocation_bot_single_market_low_utilization() {
    // Test: Single market with low utilization should get withdrawal candidate decision
    let metrics = vec![make_market_metrics(1, 1000, 400, 500)]; // 40% util
    let vault_total = U256::from(1000);
    let tier_configs = HashMap::new();

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    assert_eq!(decisions.len(), 1);
    assert_eq!(decisions[0].action, AllocationAction::Withdraw);
    assert!(decisions[0].utilization_pct() <= UTILIZATION_CRITICAL_LOW);
}

#[test]
fn test_allocation_bot_multi_market_rebalance() {
    // Test: Two markets - high util gets supply from low util withdrawal
    let metrics = vec![
        make_market_metrics(1, 1000, 950, 100), // 95% util - needs supply
        make_market_metrics(2, 1000, 400, 400), // 40% util - withdrawal candidate
    ];
    let vault_total = U256::from(1000);

    let mut tier_configs = HashMap::new();
    tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::A));
    tier_configs.insert(metrics[1].market_id, RiskTierConfig::new(RiskTier::B));

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    assert_eq!(decisions.len(), 2);

    // High utilization should be prioritized (first)
    let supply_decision = decisions.iter().find(|d| d.action == AllocationAction::Supply);
    let withdraw_decision = decisions.iter().find(|d| d.action == AllocationAction::Withdraw);

    assert!(supply_decision.is_some());
    assert!(withdraw_decision.is_some());

    // Supply decision should have higher priority
    assert!(supply_decision.unwrap().priority > withdraw_decision.unwrap().priority);
}

#[test]
fn test_allocation_respects_tier_a_cap() {
    // Test: Tier A cap (30%) should limit supply amount
    let metrics = vec![make_market_metrics(1, 1000, 900, 280)]; // 90% util, already near cap
    let vault_total = U256::from(1000);

    let mut tier_configs = HashMap::new();
    tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::A));

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    // Max cap = 30% of 1000 = 300, current = 280, headroom = 20
    assert_eq!(decisions[0].amount, U256::from(20));
}

#[test]
fn test_allocation_respects_tier_b_cap() {
    // Test: Tier B cap (20%) should limit supply amount
    let metrics = vec![make_market_metrics(1, 1000, 900, 150)]; // 90% util
    let vault_total = U256::from(1000);

    let mut tier_configs = HashMap::new();
    tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::B));

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    // Max cap = 20% of 1000 = 200, current = 150, headroom = 50
    assert_eq!(decisions[0].amount, U256::from(50));
}

#[test]
fn test_allocation_respects_tier_c_cap() {
    // Test: Tier C cap (10%) should limit supply amount
    let metrics = vec![make_market_metrics(1, 1000, 900, 80)]; // 90% util
    let vault_total = U256::from(1000);

    let mut tier_configs = HashMap::new();
    tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::C));

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    // Max cap = 10% of 1000 = 100, current = 80, headroom = 20
    assert_eq!(decisions[0].amount, U256::from(20));
}

#[test]
fn test_allocation_respects_tier_d_cap() {
    // Test: Tier D cap (5%) should limit supply amount
    let metrics = vec![make_market_metrics(1, 1000, 900, 40)]; // 90% util
    let vault_total = U256::from(1000);

    let mut tier_configs = HashMap::new();
    tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::D));

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    // Max cap = 5% of 1000 = 50, current = 40, headroom = 10
    assert_eq!(decisions[0].amount, U256::from(10));
}

#[test]
fn test_allocation_at_cap_no_action() {
    // Test: Market at tier cap should get NoChange even with high utilization
    let metrics = vec![make_market_metrics(1, 1000, 900, 300)]; // 90% util, at 30% cap
    let vault_total = U256::from(1000);

    let mut tier_configs = HashMap::new();
    tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::A));

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    // At cap (300 = 30% of 1000), no action despite high utilization
    assert_eq!(decisions[0].action, AllocationAction::NoChange);
}

#[test]
fn test_allocation_within_target_range_no_action() {
    // Test: Market within target range (70-85%) should get NoChange
    let metrics = vec![make_market_metrics(1, 1000, 780, 100)]; // 78% util
    let vault_total = U256::from(1000);
    let tier_configs = HashMap::new();

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    assert_eq!(decisions[0].action, AllocationAction::NoChange);
}

#[test]
fn test_allocation_default_tier_d() {
    // Test: Unconfigured market defaults to Tier D (most restrictive)
    let metrics = vec![make_market_metrics(1, 1000, 900, 10)]; // 90% util
    let vault_total = U256::from(1000);
    let tier_configs = HashMap::new(); // No config = Tier D

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    // Max cap = 5% of 1000 = 50, current = 10, headroom = 40
    assert_eq!(decisions[0].amount, U256::from(40));
}

#[test]
fn test_allocation_prioritizes_critical_utilization() {
    // Test: Critical high utilization (95%) prioritized over regular high (86%)
    let metrics = vec![
        make_market_metrics(1, 1000, 860, 100), // 86% - high but not critical
        make_market_metrics(2, 1000, 950, 100), // 95% - critical high
    ];
    let vault_total = U256::from(10000);
    let tier_configs = HashMap::new();

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    // Critical market (id=2) should be first in sorted decisions
    assert_eq!(decisions[0].market_id[0], 2);
    assert_eq!(decisions[0].priority, 100); // Critical high priority
    assert_eq!(decisions[1].market_id[0], 1);
    assert_eq!(decisions[1].priority, 80); // Regular high priority
}

#[test]
fn test_allocation_zero_supply_market() {
    // Test: Empty market should have 0% utilization
    let metrics = vec![make_market_metrics(1, 0, 0, 0)];
    let vault_total = U256::from(1000);
    let tier_configs = HashMap::new();

    let decisions =
        AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

    // 0% utilization is below 70%, should be withdrawal candidate
    // But vault supply is 0, so partial withdrawal = 0
    assert_eq!(decisions[0].action, AllocationAction::Withdraw);
}

#[test]
fn test_utilization_boundaries() {
    // Test boundary conditions
    let test_cases = [
        (69, true, false),  // 69% - below target, low utilization
        (70, false, false), // 70% - at min target, in range
        (77, false, false), // 77% - mid target, in range
        (85, false, false), // 85% - at max target, in range
        (86, false, true),  // 86% - above target, high utilization
    ];

    for (util, is_low, is_high) in test_cases {
        let supply = 100u64;
        let borrow = (supply as u128 * util as u128 / 100) as u64;
        let m = make_market_metrics(1, supply, borrow, 10);

        assert_eq!(
            m.is_low_utilization(),
            is_low,
            "Util {}% is_low should be {}",
            util,
            is_low
        );
        assert_eq!(
            m.is_high_utilization(),
            is_high,
            "Util {}% is_high should be {}",
            util,
            is_high
        );
    }
}

// Helper trait to get utilization from decision
trait DecisionExt {
    fn utilization_pct(&self) -> u8;
}

impl DecisionExt for AllocationDecision {
    fn utilization_pct(&self) -> u8 {
        // Extract from reason string (hacky but works for tests)
        if let Some(start) = self.reason.find('(') {
            if let Some(end) = self.reason.find('%') {
                if let Ok(val) = self.reason[start + 1..end].parse::<u8>() {
                    return val;
                }
            }
        }
        0
    }
}
