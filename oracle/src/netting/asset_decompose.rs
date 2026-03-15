//! Asset decomposition and cross-ITP netting for oracle-driven settlement
//!
//! Decomposes ITP-level orders into per-asset USDC amounts, then nets same
//! assets across all ITPs in a cycle. The result is a minimal set of
//! `AssetTrade` instructions emitted on-chain for the AP to execute.
//!
//! ## Flow
//!
//! 1. For each order (itp_id, side, usdc_amount):
//!    - Read ITP inventory: [(asset, qty_per_share)]
//!    - Compute NAV = Σ(qty[i] * price[i]) / 1e18
//!    - shares = usdc_amount * 1e18 / NAV
//!    - usdc_for_asset[i] = shares * qty[i] * price[i] / 1e36
//! 2. Accumulate into HashMap<Address, I256> (signed for netting):
//!    - BUY adds, SELL subtracts
//! 3. Convert to Vec<AssetTrade> with net side + amount

use std::collections::HashMap;

use ethers::types::{Address, I256, U256};
use tracing::{debug, trace, warn};

use crate::bridge::AssetTrade;

/// One unit in 18 decimal precision (1e18)
const WAD: u128 = 1_000_000_000_000_000_000;

/// ITP state needed for decomposition: per-share inventory and NAV
#[derive(Debug, Clone)]
pub struct ItpDecompState {
    /// Per-share inventory: (asset_address, qty_per_share) in 18 decimals
    pub inventory: Vec<(Address, U256)>,
    /// NAV per share in 18 decimals
    pub nav: U256,
}

/// An order that was rejected during decomposition due to zero NAV
#[derive(Debug, Clone)]
pub struct ZeroNavOrder {
    pub itp_id: ethers::types::H256,
    pub side: u8,
    pub usdc_amount: U256,
}

/// Result of decomposition: trades + rejected zero-NAV orders
#[derive(Debug)]
pub struct DecompositionResult {
    /// Netted asset trades for on-chain emission
    pub trades: Vec<AssetTrade>,
    /// Orders rejected due to zero NAV (should be routed to refund)
    pub zero_nav_orders: Vec<ZeroNavOrder>,
    /// Orders rejected due to too many missing asset prices (>10%)
    pub missing_price_orders: Vec<ZeroNavOrder>,
}

/// Maximum fraction of assets allowed to have zero price before rejecting the entire ITP order
const MAX_MISSING_ASSET_FRACTION: f64 = 0.10;

/// Decompose ITP orders into per-asset net trades (cross-ITP netting).
///
/// For each order: read ITP inventory, compute per-asset USDC proportions.
/// Then net same-asset amounts across all orders (BUY vs SELL).
///
/// # Arguments
///
/// * `orders` - (itp_id, side: 0=BUY/1=SELL, usdc_amount)
/// * `itp_states` - ITP decomposition state from getITPState calls
/// * `prices` - Current asset prices (18 decimals)
/// * `quote_tokens` - Optional map of asset address → quote token address (USDC or USDT).
///   If None or asset not found, defaults to Address::zero() (= use default USDC).
///
/// # Returns
///
/// `DecompositionResult` with netted trades and rejected orders.
pub fn decompose_and_net_orders_checked(
    orders: &[(ethers::types::H256, u8, U256)],
    itp_states: &HashMap<ethers::types::H256, ItpDecompState>,
    prices: &HashMap<Address, U256>,
    quote_tokens: Option<&HashMap<Address, Address>>,
) -> DecompositionResult {
    let result = decompose_and_net_orders_internal(orders, itp_states, prices, quote_tokens);
    result
}

/// Legacy API — returns only trades, silently drops zero-NAV orders.
/// Prefer `decompose_and_net_orders_checked` for production.
pub fn decompose_and_net_orders(
    orders: &[(ethers::types::H256, u8, U256)],
    itp_states: &HashMap<ethers::types::H256, ItpDecompState>,
    prices: &HashMap<Address, U256>,
    quote_tokens: Option<&HashMap<Address, Address>>,
) -> Vec<AssetTrade> {
    decompose_and_net_orders_internal(orders, itp_states, prices, quote_tokens).trades
}

fn decompose_and_net_orders_internal(
    orders: &[(ethers::types::H256, u8, U256)],
    itp_states: &HashMap<ethers::types::H256, ItpDecompState>,
    prices: &HashMap<Address, U256>,
    quote_tokens: Option<&HashMap<Address, Address>>,
) -> DecompositionResult {
    let wad = U256::from(WAD);

    // Accumulate signed USDC amounts per asset: positive = BUY, negative = SELL
    let mut net_usdc: HashMap<Address, I256> = HashMap::new();
    let mut zero_nav_orders = Vec::new();
    let mut missing_price_orders = Vec::new();

    for (itp_id, side, usdc_amount) in orders {
        let state = match itp_states.get(itp_id) {
            Some(s) => s,
            None => {
                warn!(
                    itp_id = ?itp_id,
                    "ITP state not found for decomposition, skipping order"
                );
                continue;
            }
        };

        if state.nav.is_zero() {
            warn!(
                itp_id = ?itp_id,
                "ITP NAV is zero, rejecting order for refund"
            );
            zero_nav_orders.push(ZeroNavOrder {
                itp_id: *itp_id,
                side: *side,
                usdc_amount: *usdc_amount,
            });
            continue;
        }

        // Check for too many missing asset prices (>10% threshold)
        if !state.inventory.is_empty() {
            let missing_count = state.inventory.iter()
                .filter(|(asset, _)| prices.get(asset).copied().unwrap_or(U256::zero()).is_zero())
                .count();
            let missing_fraction = missing_count as f64 / state.inventory.len() as f64;
            if missing_fraction > MAX_MISSING_ASSET_FRACTION {
                warn!(
                    itp_id = ?itp_id,
                    missing_count,
                    total = state.inventory.len(),
                    missing_pct = %format!("{:.1}%", missing_fraction * 100.0),
                    "Too many missing asset prices, rejecting entire ITP order"
                );
                missing_price_orders.push(ZeroNavOrder {
                    itp_id: *itp_id,
                    side: *side,
                    usdc_amount: *usdc_amount,
                });
                continue;
            }
        }

        // shares = usdc_amount * 1e18 / NAV
        let shares = *usdc_amount * wad / state.nav;

        for (asset, qty) in &state.inventory {
            let asset_price = prices.get(asset).copied().unwrap_or(U256::zero());
            if asset_price.is_zero() {
                warn!(
                    asset = ?asset,
                    itp_id = ?itp_id,
                    "Asset price is zero, skipping asset in decomposition"
                );
                continue;
            }

            // usdc_for_asset = shares * qty * price / 1e36
            // Break into two steps to avoid overflow:
            //   step1 = shares * qty / 1e18
            //   usdc_for_asset = step1 * price / 1e18
            let step1 = shares * *qty / wad;
            let usdc_for_asset = step1 * asset_price / wad;

            if usdc_for_asset.is_zero() {
                continue;
            }

            // Convert to I256 (safe because usdc amounts are bounded)
            let signed_amount = i256_from_u256(usdc_for_asset);

            // BUY (side=0) adds, SELL (side=1) subtracts
            let delta = if *side == 0 {
                signed_amount
            } else {
                -signed_amount
            };

            *net_usdc.entry(*asset).or_insert(I256::zero()) += delta;

            trace!(
                itp_id = ?itp_id,
                asset = ?asset,
                side = side,
                usdc_for_asset = %usdc_for_asset,
                delta = %delta,
                "Decomposed asset contribution"
            );
        }
    }

    // Convert net amounts to AssetTrade instructions
    let mut trades = Vec::new();

    for (asset, net_amount) in &net_usdc {
        if net_amount.is_zero() {
            debug!(
                asset = ?asset,
                "Asset fully netted across ITPs, no external trade needed"
            );
            continue;
        }

        let (side, usdc_amount) = if net_amount.is_positive() {
            (0u8, u256_from_i256(*net_amount))
        } else {
            (1u8, u256_from_i256(-*net_amount))
        };

        // Use the current price for this asset
        let price = prices.get(asset).copied().unwrap_or(U256::zero());

        // Resolve quote token from symbol map (Address::zero() = default USDC)
        let quote_token = quote_tokens
            .and_then(|qt| qt.get(asset).copied())
            .unwrap_or(Address::zero());

        trades.push(AssetTrade {
            asset: *asset,
            side,
            usdc_amount,
            price,
            quote_token,
        });

        debug!(
            asset = ?asset,
            side = if side == 0 { "BUY" } else { "SELL" },
            usdc_amount = %usdc_amount,
            "Net asset trade after cross-ITP netting"
        );
    }

    // Sort by asset address for deterministic ordering (important for consensus)
    trades.sort_by_key(|t| t.asset);

    DecompositionResult {
        trades,
        zero_nav_orders,
        missing_price_orders,
    }
}

/// Convert U256 to I256 (panics if > I256::MAX)
fn i256_from_u256(v: U256) -> I256 {
    I256::try_from(v).expect("U256 value exceeds I256::MAX -- amount overflow")
}

/// Convert positive I256 to U256
fn u256_from_i256(v: I256) -> U256 {
    v.into_raw()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::H256;

    fn addr(n: u8) -> Address {
        Address::from([n; 20])
    }

    fn itp(n: u8) -> H256 {
        H256::from([n; 32])
    }

    fn wad() -> U256 {
        U256::from(WAD)
    }

    #[test]
    fn test_single_buy_order_decomposes_to_per_asset_trades() {
        // ITP has 2 assets: addr(1) at $100, addr(2) at $50
        // Inventory: 0.005 of asset1, 0.01 of asset2 per share
        // NAV = 0.005 * 100 + 0.01 * 50 = 0.5 + 0.5 = 1.0
        let mut states = HashMap::new();
        states.insert(
            itp(1),
            ItpDecompState {
                inventory: vec![
                    (addr(1), U256::from(5) * wad() / U256::from(1000)),  // 0.005
                    (addr(2), U256::from(10) * wad() / U256::from(1000)), // 0.01
                ],
                nav: wad(), // NAV = $1
            },
        );

        let mut prices = HashMap::new();
        prices.insert(addr(1), U256::from(100) * wad()); // $100
        prices.insert(addr(2), U256::from(50) * wad());  // $50

        // BUY $1000 of ITP-1
        let orders = vec![(itp(1), 0u8, U256::from(1000) * wad())];

        let trades = decompose_and_net_orders(&orders, &states, &prices, None);

        assert_eq!(trades.len(), 2);
        // Both should be BUY
        for trade in &trades {
            assert_eq!(trade.side, 0);
        }

        // Total USDC across trades should equal order amount
        let total: U256 = trades.iter().map(|t| t.usdc_amount).fold(U256::zero(), |a, b| a + b);
        assert_eq!(total, U256::from(1000) * wad());
    }

    #[test]
    fn test_cross_itp_netting_reduces_volume() {
        // ITP-A and ITP-B both contain asset(1)
        // ITP-A: BUY $200 → needs +$200 of asset(1)
        // ITP-B: SELL $100 → needs -$100 of asset(1)
        // Net: BUY $100 of asset(1)
        let mut states = HashMap::new();

        // Both ITPs are 100% asset(1) at $1
        let state = ItpDecompState {
            inventory: vec![(addr(1), wad())], // 1 unit per share
            nav: wad(),                        // NAV = $1
        };
        states.insert(itp(1), state.clone());
        states.insert(itp(2), state);

        let mut prices = HashMap::new();
        prices.insert(addr(1), wad()); // $1

        let orders = vec![
            (itp(1), 0u8, U256::from(200) * wad()), // BUY $200
            (itp(2), 1u8, U256::from(100) * wad()), // SELL $100
        ];

        let trades = decompose_and_net_orders(&orders, &states, &prices, None);

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].side, 0); // BUY
        assert_eq!(trades[0].usdc_amount, U256::from(100) * wad()); // Net $100
    }

    #[test]
    fn test_fully_netted_produces_no_trade() {
        let mut states = HashMap::new();
        let state = ItpDecompState {
            inventory: vec![(addr(1), wad())],
            nav: wad(),
        };
        states.insert(itp(1), state.clone());
        states.insert(itp(2), state);

        let mut prices = HashMap::new();
        prices.insert(addr(1), wad());

        // Equal BUY and SELL → fully netted
        let orders = vec![
            (itp(1), 0u8, U256::from(500) * wad()),
            (itp(2), 1u8, U256::from(500) * wad()),
        ];

        let trades = decompose_and_net_orders(&orders, &states, &prices, None);
        assert!(trades.is_empty());
    }

    #[test]
    fn test_missing_itp_state_is_skipped() {
        let states = HashMap::new(); // no states
        let prices = HashMap::new();
        let orders = vec![(itp(1), 0u8, U256::from(100) * wad())];

        let trades = decompose_and_net_orders(&orders, &states, &prices, None);
        assert!(trades.is_empty());
    }

    #[test]
    fn test_zero_nav_is_skipped() {
        let mut states = HashMap::new();
        states.insert(
            itp(1),
            ItpDecompState {
                inventory: vec![(addr(1), wad())],
                nav: U256::zero(),
            },
        );

        let mut prices = HashMap::new();
        prices.insert(addr(1), wad());

        let orders = vec![(itp(1), 0u8, U256::from(100) * wad())];
        let trades = decompose_and_net_orders(&orders, &states, &prices, None);
        assert!(trades.is_empty());
    }

    #[test]
    fn test_zero_nav_returns_rejected_orders() {
        let mut states = HashMap::new();
        states.insert(
            itp(1),
            ItpDecompState {
                inventory: vec![(addr(1), wad())],
                nav: U256::zero(),
            },
        );

        let mut prices = HashMap::new();
        prices.insert(addr(1), wad());

        let orders = vec![(itp(1), 0u8, U256::from(100) * wad())];
        let result = decompose_and_net_orders_checked(&orders, &states, &prices, None);
        assert!(result.trades.is_empty());
        assert_eq!(result.zero_nav_orders.len(), 1);
        assert_eq!(result.zero_nav_orders[0].itp_id, itp(1));
    }

    #[test]
    fn test_too_many_missing_prices_rejects_order() {
        // 10-asset ITP, 3 missing prices (30% > 10% threshold)
        let mut inventory = Vec::new();
        for i in 1..=10u8 {
            inventory.push((addr(i), wad() / U256::from(10)));
        }

        let mut states = HashMap::new();
        states.insert(
            itp(1),
            ItpDecompState {
                inventory,
                nav: wad(),
            },
        );

        // Only provide prices for 7 of 10 assets
        let mut prices = HashMap::new();
        for i in 1..=7u8 {
            prices.insert(addr(i), wad());
        }

        let orders = vec![(itp(1), 0u8, U256::from(100) * wad())];
        let result = decompose_and_net_orders_checked(&orders, &states, &prices, None);
        assert!(result.trades.is_empty());
        assert_eq!(result.missing_price_orders.len(), 1);
    }

    #[test]
    fn test_few_missing_prices_still_processes() {
        // 10-asset ITP, 1 missing price (10% = threshold, not exceeded)
        let mut inventory = Vec::new();
        for i in 1..=10u8 {
            inventory.push((addr(i), wad() / U256::from(10)));
        }

        let mut states = HashMap::new();
        states.insert(
            itp(1),
            ItpDecompState {
                inventory,
                nav: wad(),
            },
        );

        // Provide prices for 9 of 10 assets (10% missing = at threshold, not exceeded)
        let mut prices = HashMap::new();
        for i in 1..=9u8 {
            prices.insert(addr(i), wad());
        }

        let orders = vec![(itp(1), 0u8, U256::from(100) * wad())];
        let result = decompose_and_net_orders_checked(&orders, &states, &prices, None);
        // Should proceed (1/10 = 10% = threshold, not exceeded)
        assert!(!result.trades.is_empty());
        assert!(result.missing_price_orders.is_empty());
    }

    #[test]
    fn test_trades_sorted_by_asset_address() {
        let mut states = HashMap::new();
        states.insert(
            itp(1),
            ItpDecompState {
                inventory: vec![
                    (addr(3), wad() / U256::from(2)),
                    (addr(1), wad() / U256::from(2)),
                ],
                nav: wad(),
            },
        );

        let mut prices = HashMap::new();
        prices.insert(addr(1), wad());
        prices.insert(addr(3), wad());

        let orders = vec![(itp(1), 0u8, U256::from(100) * wad())];
        let trades = decompose_and_net_orders(&orders, &states, &prices, None);

        assert_eq!(trades.len(), 2);
        assert!(trades[0].asset < trades[1].asset, "Trades should be sorted by asset address");
    }
}
