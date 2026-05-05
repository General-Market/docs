//! ITP deployer — creates new ITPs on-chain via `createITP`.

use ethers::types::{Address, U256};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use tracing::{error, info, warn};

use crate::chain::ChainClient;
use crate::data_node::{DataNodeClient, SimHolding};
use crate::manifest::ItpConfig;
use crate::token_registry::TokenRegistry;

/// Minimum weight per asset: 0.25% = 25e14 in 1e18 scale.
const MIN_WEIGHT: u128 = 2_500_000_000_000_000; // 25e14

/// 1e18 as u128.
const SCALE_18: u128 = 1_000_000_000_000_000_000;

/// Deploy a new ITP on-chain.
///
/// Returns `Ok(None)` on dry run or if deployment is skipped.
/// Returns `Ok(Some(itp_id))` on successful deployment (TODO: parse from logs).
pub async fn deploy_itp(
    itp: &ItpConfig,
    dn: &DataNodeClient,
    chain: &ChainClient,
    registry: &TokenRegistry,
    dry_run: bool,
) -> Result<Option<[u8; 32]>, Box<dyn std::error::Error>> {
    let ticker = &itp.ticker;

    // ── 1. Get target holdings from data-node ─────────────────────────────
    let holdings = dn.get_target_holdings(&itp.config).await?;
    info!(
        "[{}] Got {} target holdings from data-node",
        ticker,
        holdings.len()
    );

    // ── 2. Resolve symbols to addresses, skip unknowns ────────────────────
    let mut resolved: Vec<(SimHolding, Address)> = Vec::with_capacity(holdings.len());
    for h in &holdings {
        match registry.get_address(&h.symbol) {
            Some(addr) => resolved.push((h.clone(), addr)),
            None => {
                warn!(
                    "[{}] Unknown symbol '{}' — skipping from ITP deployment",
                    ticker, h.symbol
                );
            }
        }
    }

    if resolved.is_empty() {
        error!("[{}] No resolved assets — cannot deploy", ticker);
        return Ok(None);
    }

    // ── 3. Convert weights f64 → U256 via Decimal (no f64 * 1e18) ─────────
    let scale = Decimal::from(SCALE_18);
    let mut weights_u128: Vec<u128> = Vec::with_capacity(resolved.len());

    for (h, _) in &resolved {
        let weight_dec = match Decimal::try_from(h.weight) {
            Ok(d) => d,
            Err(_) => {
                warn!("Invalid f64 weight {}: NaN or Infinity, treating as zero", h.weight);
                Decimal::ZERO
            }
        };
        // u128 overflow on (weight * 1e18) means the asset would silently
        // get weight=0, the basket would still pass the total != 0 check,
        // and we'd ship an ITP with a missing leg. Refuse instead.
        let w = match (weight_dec * scale).to_u128() {
            Some(v) => v,
            None => {
                error!("[{}] weight {} overflows u128 after scaling — aborting deploy",
                    ticker, h.weight);
                return Ok(None);
            }
        };
        weights_u128.push(w);
    }

    // ── 4. Convert prices f64 → U256 via Decimal ──────────────────────────
    let mut prices_u256: Vec<U256> = Vec::with_capacity(resolved.len());
    for (h, _) in &resolved {
        let price_dec = match Decimal::try_from(h.price_usd) {
            Ok(d) => d,
            Err(_) => {
                warn!("Invalid f64 price {}: NaN or Infinity, treating as zero", h.price_usd);
                Decimal::ZERO
            }
        };
        // Same reasoning as weights — a silently-zeroed price corrupts NAV
        // computation at creation time and mints with garbage qty.
        let p = match (price_dec * scale).to_u128() {
            Some(v) => v,
            None => {
                error!("[{}] price {} for '{}' overflows u128 — aborting deploy",
                    ticker, h.price_usd, h.symbol);
                return Ok(None);
            }
        };
        prices_u256.push(U256::from(p));
    }

    // ── 5. Normalize weights to sum exactly to 1e18 ───────────────────────
    let total: u128 = weights_u128.iter().sum();
    if total == 0 {
        error!("[{}] Total weight is zero — cannot deploy", ticker);
        return Ok(None);
    }

    // Find largest weight index for adjustment
    let largest_idx = weights_u128
        .iter()
        .enumerate()
        .max_by_key(|(_, w)| **w)
        .map(|(i, _)| i)
        .unwrap(); // safe: resolved is non-empty

    if total != SCALE_18 {
        let diff = SCALE_18 as i128 - total as i128;
        let adjusted = weights_u128[largest_idx] as i128 + diff;
        if adjusted <= 0 {
            error!(
                "[{}] Weight normalization would make largest weight non-positive",
                ticker
            );
            return Ok(None);
        }
        weights_u128[largest_idx] = adjusted as u128;
        info!(
            "[{}] Normalized weights: adjusted index {} by {} (total was {})",
            ticker, largest_idx, diff, total
        );
    }

    // ── 6. Enforce MIN_WEIGHT (0.25%) ─────────────────────────────────────
    for (i, w) in weights_u128.iter().enumerate() {
        if *w < MIN_WEIGHT {
            let (h, _) = &resolved[i];
            error!(
                "[{}] Weight for '{}' is {} < MIN_WEIGHT {} (0.25%) — aborting deployment",
                ticker, h.symbol, w, MIN_WEIGHT
            );
            return Ok(None);
        }
    }

    // Build final U256 vectors
    let weights_u256: Vec<U256> = weights_u128.iter().map(|w| U256::from(*w)).collect();
    let assets: Vec<Address> = resolved.iter().map(|(_, addr)| *addr).collect();

    // ── 7. Dry run ────────────────────────────────────────────────────────
    if dry_run {
        info!(
            "[{}] DRY RUN — would createITP: name='{}', symbol='{}', {} assets",
            ticker, itp.name, itp.ticker, assets.len()
        );
        for (i, ((h, addr), w)) in resolved.iter().zip(weights_u256.iter()).enumerate() {
            info!(
                "[{}]   #{}: {} ({:?}) weight={} price={}",
                ticker, i, h.symbol, addr, w, prices_u256[i]
            );
        }
        return Ok(None);
    }

    // ── 8. Submit createITP transaction ───────────────────────────────────
    info!(
        "[{}] Deploying ITP: name='{}', symbol='{}', {} assets",
        ticker, itp.name, itp.ticker, assets.len()
    );

    // U256::MAX signals non-bridge call (Investment.sol line 650-657)
    let receipt = chain
        .create_itp(
            itp.name.clone(),
            itp.ticker.clone(),
            weights_u256,
            assets,
            prices_u256,
            U256::MAX,
        )
        .await?;

    info!(
        "[{}] ITP deployed: tx={:?}",
        ticker, receipt.transaction_hash
    );

    // TODO: parse itpId from receipt logs
    Ok(None)
}
