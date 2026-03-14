use std::collections::HashMap;

use ethers::types::{Address, U256};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use tracing::{info, warn};

use crate::data_node::SimHolding;
use crate::token_registry::TokenRegistry;

/// Minimum weight per asset: 0.25% = 25e14 in 1e18 scale.
const MIN_WEIGHT: u128 = 2_500_000_000_000_000; // 25e14

/// 1e18 as u128.
const SCALE_1E18: u128 = 1_000_000_000_000_000_000;

pub struct RebalanceDiff {
    /// Indices into the on-chain asset array to remove, sorted DESCENDING
    /// (required by the contract's swap-and-pop removal).
    pub remove_indices: Vec<usize>,
    /// New assets to append after removals.
    pub add_assets: Vec<Address>,
    /// Weights for the final asset list (removals applied, adds appended). Sum = exactly 1e18.
    pub new_weights: Vec<U256>,
    /// Maximum weight drift observed across all assets (percentage points).
    pub max_drift_pct: f64,
    /// Human-readable note for the on-chain rebalance request.
    pub note: String,
}

/// Convert an on-chain U256 weight (1e18 scale) to an f64 fraction (0.0–1.0).
fn weight_u256_to_f64(w: U256) -> f64 {
    // Safe: weights are at most 1e18 which fits in u128.
    let w128 = w.as_u128();
    w128 as f64 / SCALE_1E18 as f64
}

/// Convert an f64 weight (0.0–1.0) to a U256 weight (1e18 scale) via `rust_decimal`
/// to avoid floating-point precision loss.
fn weight_f64_to_u256(w: f64) -> U256 {
    let weight_dec = Decimal::try_from(w).unwrap_or_default();
    let scale = Decimal::from(SCALE_1E18 as i64);
    let scaled = weight_dec * scale;
    let val = scaled.to_u128().unwrap_or(0);
    U256::from(val)
}

/// Compare the target holdings from the simulator against on-chain state and
/// produce a [`RebalanceDiff`] describing the changes needed. Returns `None`
/// if the maximum drift is below `drift_threshold_pct` (no rebalance needed).
pub fn compute_rebalance_diff(
    on_chain_assets: &[Address],
    on_chain_weights: &[U256],
    target_holdings: &[SimHolding],
    registry: &TokenRegistry,
    drift_threshold_pct: f64,
) -> Option<RebalanceDiff> {
    // 1. Build on-chain map: address → (index, weight as f64).
    let on_chain_map: HashMap<Address, (usize, f64)> = on_chain_assets
        .iter()
        .enumerate()
        .zip(on_chain_weights.iter())
        .map(|((idx, &addr), w)| (addr, (idx, weight_u256_to_f64(*w))))
        .collect();

    // 2. Build target map: address → target weight (f64 0.0–1.0).
    let mut target_map: HashMap<Address, f64> = HashMap::new();
    for h in target_holdings {
        match registry.get_address(&h.symbol) {
            Some(addr) => {
                // Accumulate in case duplicates appear (shouldn't, but defensive).
                *target_map.entry(addr).or_insert(0.0) += h.weight;
            }
            None => {
                warn!(symbol = %h.symbol, "unknown symbol — skipping (not in token registry)");
            }
        }
    }

    // 3. Compute max drift across all assets.
    let mut max_drift: f64 = 0.0;

    // Drift for assets present on-chain.
    for (&addr, &(_idx, oc_weight)) in &on_chain_map {
        let target_weight = target_map.get(&addr).copied().unwrap_or(0.0);
        let drift = (target_weight - oc_weight).abs() * 100.0; // in pct
        if drift > max_drift {
            max_drift = drift;
        }
    }

    // Drift for new assets (not yet on-chain).
    for (&addr, &target_weight) in &target_map {
        if !on_chain_map.contains_key(&addr) {
            let drift = target_weight * 100.0; // from 0 → target
            if drift > max_drift {
                max_drift = drift;
            }
        }
    }

    info!(max_drift_pct = max_drift, threshold = drift_threshold_pct, "drift check");

    // 4. If drift is below threshold, no rebalance needed.
    if max_drift < drift_threshold_pct {
        info!("max drift {:.4}% < threshold {:.4}% — skipping rebalance", max_drift, drift_threshold_pct);
        return None;
    }

    // 5. Compute removes: on-chain assets not in target.
    let mut remove_indices: Vec<usize> = on_chain_assets
        .iter()
        .enumerate()
        .filter(|(_idx, addr)| !target_map.contains_key(addr))
        .map(|(idx, addr)| {
            let sym = registry.get_symbol(addr).unwrap_or("???");
            info!(index = idx, symbol = sym, "removing asset");
            idx
        })
        .collect();

    // Sort descending (required by contract swap-and-pop).
    remove_indices.sort_unstable_by(|a, b| b.cmp(a));

    // 6. Compute adds: target assets not on-chain.
    let add_assets: Vec<Address> = target_map
        .keys()
        .filter(|addr| !on_chain_map.contains_key(addr))
        .copied()
        .collect();

    for &addr in &add_assets {
        let sym = registry.get_symbol(&addr).unwrap_or("???");
        info!(symbol = sym, "adding asset");
    }

    // 7. Build final asset list by simulating swap-and-pop removals, then appending adds.
    let mut final_assets: Vec<Address> = on_chain_assets.to_vec();
    for &idx in &remove_indices {
        // swap-and-pop: move last element to idx, then truncate.
        let last = final_assets.len() - 1;
        final_assets.swap(idx, last);
        final_assets.pop();
    }
    // Append new assets.
    final_assets.extend_from_slice(&add_assets);

    // 8. Compute new_weights for the final asset list from target_map.
    //    Assets in final_assets that have no target get weight 0 (shouldn't happen
    //    since we removed assets not in target, but handle defensively).
    let mut raw_weights: Vec<(usize, f64)> = final_assets
        .iter()
        .enumerate()
        .map(|(i, addr)| (i, target_map.get(addr).copied().unwrap_or(0.0)))
        .collect();

    // Drop assets below MIN_WEIGHT and redistribute.
    loop {
        let min_f64 = MIN_WEIGHT as f64 / SCALE_1E18 as f64;
        let below: Vec<usize> = raw_weights
            .iter()
            .filter(|(_, w)| *w > 0.0 && *w < min_f64)
            .map(|(i, _)| *i)
            .collect();

        if below.is_empty() {
            break;
        }

        for &idx in &below {
            let sym = registry
                .get_symbol(&final_assets[idx])
                .unwrap_or("???");
            warn!(
                symbol = sym,
                weight_pct = raw_weights[idx].1 * 100.0,
                "weight below MIN_WEIGHT (0.25%) — dropping asset"
            );
            raw_weights[idx].1 = 0.0;
        }

        // Renormalize remaining weights so they sum to 1.0.
        let sum: f64 = raw_weights.iter().map(|(_, w)| w).sum();
        if sum > 0.0 {
            for entry in raw_weights.iter_mut() {
                if entry.1 > 0.0 {
                    entry.1 /= sum;
                }
            }
        }
    }

    // Convert to U256 via rust_decimal.
    let mut weight_u256s: Vec<U256> = raw_weights
        .iter()
        .map(|(_, w)| weight_f64_to_u256(*w))
        .collect();

    // Normalize so weights sum to exactly 1e18.
    let target_sum = U256::from(SCALE_1E18);
    let actual_sum: U256 = weight_u256s.iter().copied().fold(U256::zero(), |a, b| a + b);

    if actual_sum != target_sum && !weight_u256s.is_empty() {
        // Find the index of the largest weight — it's most tolerant of small adjustments.
        let largest_idx = weight_u256s
            .iter()
            .enumerate()
            .max_by_key(|(_, w)| *w)
            .map(|(i, _)| i)
            .unwrap_or(0);

        if actual_sum > target_sum {
            let diff = actual_sum - target_sum;
            weight_u256s[largest_idx] = weight_u256s[largest_idx].saturating_sub(diff);
        } else {
            let diff = target_sum - actual_sum;
            weight_u256s[largest_idx] = weight_u256s[largest_idx] + diff;
        }

        let final_sum: U256 = weight_u256s.iter().copied().fold(U256::zero(), |a, b| a + b);
        debug_assert_eq!(final_sum, target_sum, "weight normalization failed");
    }

    // Build summary note.
    let note = format!(
        "rebalance: -{} assets, +{} assets, max_drift={:.2}%",
        remove_indices.len(),
        add_assets.len(),
        max_drift
    );

    info!(
        removes = remove_indices.len(),
        adds = add_assets.len(),
        final_count = final_assets.len(),
        max_drift_pct = max_drift,
        "rebalance diff computed"
    );

    Some(RebalanceDiff {
        remove_indices,
        add_assets,
        new_weights: weight_u256s,
        max_drift_pct: max_drift,
        note,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static TEST_COUNTER: AtomicU32 = AtomicU32::new(0);

    /// Helper to build a minimal TokenRegistry for tests.
    fn test_registry(pairs: &[(&str, Address)]) -> TokenRegistry {
        // We can't use TokenRegistry::from_deployed_assets in tests easily,
        // so we construct one via a JSON roundtrip.
        let entries: Vec<serde_json::Value> = pairs
            .iter()
            .map(|(sym, addr)| {
                serde_json::json!({
                    "symbol": sym,
                    "address": format!("{:?}", addr),
                })
            })
            .collect();

        let json = serde_json::to_string(&entries).unwrap();
        let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let tmp = std::env::temp_dir().join(format!("test_deployed_assets_{}.json", id));
        std::fs::write(&tmp, &json).unwrap();
        TokenRegistry::from_deployed_assets(tmp.to_str().unwrap()).unwrap()
    }

    fn addr(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    fn w(pct: f64) -> U256 {
        weight_f64_to_u256(pct / 100.0)
    }

    #[test]
    fn no_rebalance_when_drift_below_threshold() {
        let assets = vec![addr(1), addr(2)];
        let weights = vec![w(50.0), w(50.0)];

        let registry = test_registry(&[("BTC", addr(1)), ("ETH", addr(2))]);

        let holdings = vec![
            SimHolding { coin_id: "btc".into(), symbol: "BTC".into(), weight: 0.50, price_usd: 50000.0 },
            SimHolding { coin_id: "eth".into(), symbol: "ETH".into(), weight: 0.50, price_usd: 3000.0 },
        ];

        let result = compute_rebalance_diff(&assets, &weights, &holdings, &registry, 5.0);
        assert!(result.is_none(), "should skip rebalance when drift < threshold");
    }

    #[test]
    fn detects_drift_and_produces_diff() {
        let assets = vec![addr(1), addr(2)];
        let weights = vec![w(50.0), w(50.0)];

        let registry = test_registry(&[("BTC", addr(1)), ("ETH", addr(2))]);

        // Target is 70/30 — 20% drift.
        let holdings = vec![
            SimHolding { coin_id: "btc".into(), symbol: "BTC".into(), weight: 0.70, price_usd: 50000.0 },
            SimHolding { coin_id: "eth".into(), symbol: "ETH".into(), weight: 0.30, price_usd: 3000.0 },
        ];

        let diff = compute_rebalance_diff(&assets, &weights, &holdings, &registry, 5.0)
            .expect("should produce a diff");

        assert!(diff.remove_indices.is_empty());
        assert!(diff.add_assets.is_empty());
        assert_eq!(diff.new_weights.len(), 2);
        assert!(diff.max_drift_pct >= 19.9);

        // Weights must sum to exactly 1e18.
        let sum: U256 = diff.new_weights.iter().copied().fold(U256::zero(), |a, b| a + b);
        assert_eq!(sum, U256::from(SCALE_1E18));
    }

    #[test]
    fn removes_and_adds_assets() {
        let assets = vec![addr(1), addr(2), addr(3)];
        let weights = vec![w(40.0), w(30.0), w(30.0)];

        let registry = test_registry(&[
            ("BTC", addr(1)),
            ("ETH", addr(2)),
            ("SOL", addr(3)),
            ("AVAX", addr(4)),
        ]);

        // Target drops SOL (addr 3), adds AVAX (addr 4).
        let holdings = vec![
            SimHolding { coin_id: "btc".into(), symbol: "BTC".into(), weight: 0.50, price_usd: 50000.0 },
            SimHolding { coin_id: "eth".into(), symbol: "ETH".into(), weight: 0.30, price_usd: 3000.0 },
            SimHolding { coin_id: "avax".into(), symbol: "AVAX".into(), weight: 0.20, price_usd: 30.0 },
        ];

        let diff = compute_rebalance_diff(&assets, &weights, &holdings, &registry, 1.0)
            .expect("should produce a diff");

        assert_eq!(diff.remove_indices, vec![2]); // SOL index, descending
        assert_eq!(diff.add_assets, vec![addr(4)]);
        assert_eq!(diff.new_weights.len(), 3); // BTC, ETH, AVAX

        let sum: U256 = diff.new_weights.iter().copied().fold(U256::zero(), |a, b| a + b);
        assert_eq!(sum, U256::from(SCALE_1E18));
    }

    #[test]
    fn weights_below_min_are_dropped() {
        let assets = vec![addr(1)];
        let weights = vec![w(100.0)];

        let registry = test_registry(&[
            ("BTC", addr(1)),
            ("DUST", addr(2)),
        ]);

        // Target: BTC 99.9%, DUST 0.1% — DUST is below MIN_WEIGHT (0.25%).
        let holdings = vec![
            SimHolding { coin_id: "btc".into(), symbol: "BTC".into(), weight: 0.999, price_usd: 50000.0 },
            SimHolding { coin_id: "dust".into(), symbol: "DUST".into(), weight: 0.001, price_usd: 0.01 },
        ];

        let diff = compute_rebalance_diff(&assets, &weights, &holdings, &registry, 0.01)
            .expect("should produce a diff");

        // DUST should be dropped, only BTC remains.
        // The final weights should still sum to 1e18.
        let sum: U256 = diff.new_weights.iter().copied().fold(U256::zero(), |a, b| a + b);
        assert_eq!(sum, U256::from(SCALE_1E18));

        // All non-zero weights should be >= MIN_WEIGHT.
        for w in &diff.new_weights {
            if *w > U256::zero() {
                assert!(*w >= U256::from(MIN_WEIGHT));
            }
        }
    }
}
