//! Small utility functions used across the oracle binary.

use std::sync::Arc;
use oracle::PriceFetcher;

/// Check if a fill price respects an order's limit price (E126 guard).
/// Returns true if the fill can proceed, false if it would violate the limit.
/// Includes a 15% tolerance for NAV drift between order submission and fill execution.
pub(crate) fn fill_price_respects_limit(
    fill_price: ethers::types::U256,
    limit_price: ethers::types::U256,
    side: common::types::Side,
) -> bool {
    if limit_price.is_zero() {
        return true; // No limit set
    }
    // Apply 15% tolerance for NAV drift during consensus delay
    let tolerance_bps = ethers::types::U256::from(1500u64); // 15%
    let bps_base = ethers::types::U256::from(10000u64);
    match side {
        common::types::Side::Buy => {
            let buffered_limit = limit_price + (limit_price * tolerance_bps / bps_base);
            fill_price <= buffered_limit
        }
        common::types::Side::Sell => {
            let buffered_limit = if limit_price > limit_price * tolerance_bps / bps_base {
                limit_price - (limit_price * tolerance_bps / bps_base)
            } else {
                ethers::types::U256::zero()
            };
            fill_price >= buffered_limit
        }
    }
}

/// Check if an error string contains the BLSVerifier__SnapshotTooOld selector (0x6724c448).
/// When detected, signals that a mirror sync is urgently needed.
pub(crate) fn is_snapshot_too_old_error(err_str: &str) -> bool {
    err_str.contains("6724c448") || err_str.contains("SnapshotTooOld")
}

/// Check if an error string contains the BLSVerifier__NonceFuture selector (0xe181e596).
/// Raised when the referenceNonce passed to a BLS-verified call exceeds the
/// contract's lastSnapshotNonce. Indicates the oracle's cached
/// settlement_registry_nonce has drifted ahead of on-chain state; the cache
/// needs to be corrected from an authoritative on-chain read before retry.
pub(crate) fn is_nonce_future_error(err_str: &str) -> bool {
    err_str.contains("e181e596") || err_str.contains("NonceFuture")
}

/// Compute NAV from on-chain ITP inventory + live Bitget prices.
///
/// NAV = sum(qty[i] * price[i]) / 1e18 — same formula as the contract.
/// Returns $1 (1e18) if inventory is empty or prices are unavailable.
pub(crate) async fn compute_nav(
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    price_fetcher: &Arc<dyn PriceFetcher>,
    itp_id: &str,
) -> ethers::types::U256 {
    let one = ethers::types::U256::exp10(18);
    let itp_bytes: [u8; 32] = {
        let hex = itp_id.trim_start_matches("0x");
        let mut b = [0u8; 32];
        if hex.len() == 64 { hex::decode_to_slice(hex, &mut b).ok(); }
        b
    };
    match chain_reader.get_itp_inventory_state(itp_bytes).await {
        Ok(state) if !state.assets.is_empty() => {
            match price_fetcher.fetch_prices(&state.assets).await {
                Ok(prices) if !prices.is_empty() => {
                    let price_map: std::collections::HashMap<ethers::types::Address, ethers::types::U256> =
                        prices.into_iter().map(|p| (p.asset, p.price)).collect();
                    let scale = ethers::types::U256::exp10(18);
                    let mut nav = ethers::types::U256::zero();
                    for (asset, qty) in state.assets.iter().zip(state.quantities.iter()) {
                        if let Some(price) = price_map.get(asset) {
                            if let Some(contribution) = qty.checked_mul(*price) {
                                nav = nav + contribution / scale;
                            }
                        }
                    }
                    if nav.is_zero() { one } else { nav }
                }
                _ => one,
            }
        }
        _ => one,
    }
}

/// Deterministic leader election for bridge operations.
/// Uses cycle number (identical on all nodes) instead of last_signature
/// (which may differ between nodes before consensus completes).
pub(crate) fn calculate_bridge_leader(cycle: u64, num_oracles: u8, node_index: u8) -> bool {
    let leader_idx = (cycle % num_oracles as u64) as u8;
    node_index == leader_idx
}

pub(crate) fn setup_logging(config: &oracle::OracleConfig) -> Result<(), Box<dyn std::error::Error>> {
    let node_id = config.node_id.unwrap_or(0);
    let log_config = common::logging::LogConfig {
        level: config.effective_log_level(),
        dir: config.effective_log_dir(),
        json_enabled: config.effective_json_logs(),
        component_name: format!("oracle-{}", node_id),
        node_id: config.node_id,
    };
    common::logging::init_logging(&log_config)
}
