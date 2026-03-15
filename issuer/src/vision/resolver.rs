//! Vision tick resolver
//!
//! Orchestrates the full tick resolution pipeline for a batch:
//!
//! 1. Filter active players (balance > 0)
//! 2. Check bitmap reveals (non-revealed players are voided, stake refunded)
//! 3. For each market:
//!    a. Fetch start/end prices, check staleness
//!    b. Compute % change and determine outcome
//!    c. Decode bitmaps to player sides (flat stakePerTick split evenly across markets)
//!    d. Run parimutuel side matching
//! 4. Aggregate per-player balance changes
//! 5. Return TickResult

use std::collections::HashMap;
use std::sync::Arc;

use ethers::types::{Address, H256, U256};

use super::bitmap_store::BitmapStore;
use super::config::VisionConfig;
use super::side_matching::{self, SideMatchInput};
use super::types::*;

/// Price data for tick resolution.
///
/// Maps market_id to (start_price, end_price, last_update_timestamp).
/// Prices are stored as i128 scaled by 1e8 (fixed-point, 8 decimal places).
/// Signed to accommodate negative-valued markets (interest rates, temperatures, etc.).
#[derive(Clone)]
pub struct MarketPrices {
    prices: HashMap<H256, (i128, i128, u64)>,
}

impl MarketPrices {
    pub fn new() -> Self {
        Self {
            prices: HashMap::new(),
        }
    }

    /// Insert price data for a market. Prices must be pre-scaled by 1e8.
    pub fn insert(&mut self, market_id: H256, start: i128, end: i128, last_update: u64) {
        self.prices.insert(market_id, (start, end, last_update));
    }

    /// Get start and end prices for a market (i128, scaled by 1e8).
    pub fn get_prices(&self, market_id: &H256) -> Option<(i128, i128)> {
        self.prices.get(market_id).map(|(s, e, _)| (*s, *e))
    }

    /// Check if price data is stale (last update older than threshold).
    /// A market with no price data is considered stale.
    pub fn is_stale(&self, market_id: &H256, threshold_secs: u64, now: u64) -> bool {
        match self.prices.get(market_id) {
            Some((_, _, last_update)) => now.saturating_sub(*last_update) > threshold_secs,
            None => true,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ResolverError {
    #[error("No active players in batch {0}")]
    NoActivePlayers(u64),
    #[error("Price fetch failed: {0}")]
    PriceFetchError(String),
}

/// Tick resolver: orchestrates settlement of a single tick.
pub struct TickResolver {
    pub(crate) bitmap_store: Arc<BitmapStore>,
    config: VisionConfig,
}

impl TickResolver {
    pub fn new(bitmap_store: Arc<BitmapStore>, config: VisionConfig) -> Self {
        Self {
            bitmap_store,
            config,
        }
    }

    /// Resolve a single tick for a batch.
    ///
    /// See module-level docs for the full pipeline.
    /// `market_configs` provides per-market resolution_type + threshold from off-chain config.
    pub async fn resolve_tick(
        &self,
        batch: &Batch,
        tick_id: u64,
        players: &[PlayerPosition],
        prices: &MarketPrices,
        now: u64,
        market_configs: &[MarketConfig],
    ) -> Result<TickResult, ResolverError> {
        // 1. Filter active players (balance > 0)
        let active: Vec<&PlayerPosition> = players.iter().filter(|p| !p.balance.is_zero()).collect();

        if active.is_empty() {
            return Err(ResolverError::NoActivePlayers(batch.id));
        }

        // 2. Check bitmap reveals
        let bitmaps = self.bitmap_store.get_all_active_for_batch(batch.id).await;
        let mut revealed_players: Vec<(&PlayerPosition, Vec<u8>)> = Vec::new();
        let mut voided_players: Vec<Address> = Vec::new();

        for player in &active {
            if let Some(bitmap) = bitmaps.iter().find(|b| b.player == player.player) {
                revealed_players.push((player, bitmap.bitmap.clone()));
            } else {
                // Voided: no bitmap revealed. Player keeps their stake (refunded).
                voided_players.push(player.player);
            }
        }

        // 3. Resolve each market using market_configs
        // Flat stake weighting: each player's stake_per_tick is split evenly across markets.
        // Remainder distributed one-unit-extra to the first N markets where N = remainder.
        let mut market_results = Vec::new();
        let mut player_deltas: HashMap<Address, i128> = HashMap::new();
        let num_markets = U256::from(market_configs.len() as u64);

        for (market_idx, mc) in market_configs.iter().enumerate() {
            let market_id = mc.market_id;

            // Get prices
            let (start_price, end_price) = match prices.get_prices(&market_id) {
                Some(p) => p,
                None => {
                    // No price data -> cancelled market (skipped, no weight redistribution)
                    tracing::info!(
                        batch_id = batch.id,
                        market_id = ?market_id,
                        "Market resolved as Cancelled — no price data"
                    );
                    market_results.push(MarketResult {
                        market_id,
                        asset_id: mc.asset_id.clone(),
                        outcome: MarketOutcome::Cancelled,
                        start_price: 0.0,
                        end_price: 0.0,
                        pct_change_bps: 0,
                        player_results: vec![],
                    });
                    continue;
                }
            };

            // Check staleness
            if prices.is_stale(&market_id, self.config.staleness_threshold_secs, now) {
                tracing::info!(
                    batch_id = batch.id,
                    market_id = ?market_id,
                    last_update_age_secs = now.saturating_sub(
                        prices.prices.get(&market_id).map(|(_, _, ts)| *ts).unwrap_or(0)
                    ),
                    threshold_secs = self.config.staleness_threshold_secs,
                    "Market resolved as Cancelled — stale price data"
                );
                market_results.push(MarketResult {
                    market_id,
                    asset_id: mc.asset_id.clone(),
                    outcome: MarketOutcome::Cancelled,
                    start_price: start_price as f64 / 1e8,
                    end_price: end_price as f64 / 1e8,
                    pct_change_bps: 0,
                    player_results: vec![],
                });
                continue;
            }

            // Prices are already i128 scaled by 1e8 — no conversion needed.
            // All arithmetic is integer — deterministic across issuers.
            let start_price_scaled = start_price;
            let end_price_scaled = end_price;

            // Compute % change in basis points (integer)
            let pct_change_bps = compute_pct_change_bps(start_price_scaled, end_price_scaled);

            // Determine outcome from MarketConfig resolution_type + threshold_bps (integer)
            let resolution_type = mc.resolution_type;
            let outcome = resolve_outcome_bps(pct_change_bps, resolution_type, mc.threshold_bps);

            // Log if market resolves as cancelled
            if matches!(outcome, MarketOutcome::Cancelled) {
                tracing::info!(
                    batch_id = batch.id,
                    market_id = ?market_id,
                    resolution_type = resolution_type,
                    pct_change_bps = pct_change_bps,
                    "Market resolved as Cancelled — invalid resolution type or other condition"
                );
            }

            // Decode bitmaps -> player sides for this market
            let mut side_inputs = Vec::new();
            for (player, bitmap) in &revealed_players {
                // Flat indexing: one bitmap per tick, bit_index = market position in config
                let bit_index = market_idx;
                let bit = get_bitmap_bit(bitmap, bit_index);
                // IS-6: if bitmap doesn't cover this market, skip the player
                let side = match bit {
                    Some(true) => Side::Up,
                    Some(false) => Side::Down,
                    None => continue, // player didn't cover this market
                };
                // Flat stake: split stake_per_tick evenly across all markets.
                // Remainder (stake_per_tick % num_markets) is distributed one unit extra
                // to the first N markets where N = remainder.
                let per_market_stake = if num_markets.is_zero() {
                    U256::zero()
                } else {
                    let base = player.stake_per_tick / num_markets;
                    let remainder = player.stake_per_tick % num_markets;
                    if U256::from(market_idx as u64) < remainder {
                        base + U256::one()
                    } else {
                        base
                    }
                };
                side_inputs.push(SideMatchInput {
                    player: player.player,
                    side,
                    effective_stake: per_market_stake,
                });
            }

            // Debug: log per-market side assignments for non-flat outcomes
            if !matches!(outcome, MarketOutcome::Flat | MarketOutcome::Cancelled) {
                let sides_str: Vec<String> = side_inputs.iter().map(|s| {
                    format!("{}={:?}({})", &format!("{:?}", s.player)[..8], s.side, s.effective_stake)
                }).collect();
                tracing::info!(
                    batch_id = batch.id,
                    market_idx,
                    asset = %mc.asset_id,
                    outcome = ?outcome,
                    start_price = %format!("{:.8}", start_price as f64 / 1e8),
                    end_price = %format!("{:.8}", end_price as f64 / 1e8),
                    pct_change_bps = pct_change_bps,
                    sides = %sides_str.join(", "),
                    "Market side assignment"
                );
            }

            // Run side matching
            let match_results = side_matching::match_sides(&side_inputs, outcome.clone());

            // Accumulate per-player deltas
            for result in &match_results {
                // delta = (payout + refund) - effective_stake
                // This is the net change from this market for this player.
                let payout_plus_refund =
                    result.payout.as_u128() as i128 + result.refund.as_u128() as i128;
                let stake = result.effective_stake.as_u128() as i128;
                let delta = payout_plus_refund - stake;

                // Trace per-market deltas for non-flat outcomes
                if !matches!(outcome, MarketOutcome::Flat | MarketOutcome::Cancelled) {
                    tracing::info!(
                        batch_id = batch.id,
                        market_idx,
                        player = %result.player,
                        side = ?result.side,
                        effective_stake = %result.effective_stake,
                        matched_stake = %result.matched_stake,
                        payout = %result.payout,
                        refund = %result.refund,
                        delta,
                        "Per-market player result"
                    );
                }

                *player_deltas.entry(result.player).or_insert(0) += delta;
            }

            // Build PlayerMarketResult for this market
            let player_results = match_results
                .iter()
                .map(|r| PlayerMarketResult {
                    player: r.player,
                    side: r.side,
                    effective_stake: r.effective_stake,
                    matched_stake: r.matched_stake,
                    payout: r.payout,
                    refund: r.refund,
                })
                .collect();

            market_results.push(MarketResult {
                market_id,
                asset_id: mc.asset_id.clone(),
                outcome,
                start_price: start_price as f64 / 1e8,
                end_price: end_price as f64 / 1e8,
                pct_change_bps,
                player_results,
            });
        }

        // 5. Compute final player balances
        let player_balances: Vec<PlayerBalance> = active
            .iter()
            .map(|p| {
                let delta = player_deltas.get(&p.player).copied().unwrap_or(0);
                let new_balance = if delta >= 0 {
                    p.balance + U256::from(delta as u128)
                } else {
                    p.balance.saturating_sub(U256::from((-delta) as u128))
                };
                PlayerBalance {
                    player: p.player,
                    old_balance: p.balance,
                    new_balance,
                    delta,
                }
            })
            .collect();

        // Log summary of cancelled markets
        let cancelled_count = market_results.iter().filter(|mr| matches!(mr.outcome, MarketOutcome::Cancelled)).count();
        if cancelled_count > 0 {
            tracing::warn!(
                batch_id = batch.id,
                tick_id = tick_id,
                cancelled = cancelled_count,
                total = market_results.len(),
                "Tick had cancelled markets"
            );
        }

        Ok(TickResult {
            batch_id: batch.id,
            tick_id,
            market_results,
            player_balances,
            voided_players,
        })
    }
}

/// Compute percent change in basis points (integer arithmetic).
///
/// 1 bps = 0.01%, so 100 bps = 1%, 30 bps = 0.3%, 300 bps = 3%, etc.
/// Formula: pct_bps = (end - start) * 10000 / start
///
/// Prices are expected as i128 scaled by 1e8 (8 decimal places).
/// Signed arithmetic supports negative-valued markets (interest rates, temperatures, etc.).
/// Division by negative start_price is well-defined: the sign of the result is correct.
fn compute_pct_change_bps(start_price: i128, end_price: i128) -> i64 {
    if start_price == 0 {
        return 0;
    }
    // (end - start) * 10000 / start — all i128, sign handled automatically.
    // Saturate to i64 range to avoid pathological inputs (e.g. huge leveraged derivatives).
    let diff = end_price.wrapping_sub(start_price);
    let bps = diff.saturating_mul(10_000).wrapping_div(start_price);
    bps.clamp(i64::MIN as i128, i64::MAX as i128) as i64
}

/// Resolve market outcome using integer basis points.
///
/// `pct_change_bps`: percent change in basis points (100 = 1%).
/// `threshold_bps`: threshold in basis points from MarketConfig.
///
/// Resolution types:
/// - 0: UP_0 — any positive move is UP (ternary: Up/Down/Flat)
/// - 1: UP_30 — UP requires > 30 bps (0.3%) move (binary: Up or Down)
/// - 2: UP_X — UP requires > threshold bps (binary: Up or Down)
/// - 3: DOWN_0 — any negative move is DOWN (ternary: Up/Down/Flat)
/// - 4: DOWN_30 — DOWN requires > 30 bps negative (binary: Down or Up)
/// - 5: DOWN_X — DOWN requires > threshold bps negative (binary: Down or Up)
/// - 6: FLAT_0 — flat if < 1 bps absolute (ternary: Flat/Up/Down)
/// - 7: FLAT_X — flat if < threshold bps (ternary: Flat/Up/Down)
/// - 8: UP_300 — UP requires > 300 bps (3%) (binary: Up or Down)
/// - 9: UP_3000 — UP requires > 3000 bps (30%) (binary: Up or Down)
/// - 10: DOWN_300 — DOWN requires > 300 bps negative (binary: Down or Up)
/// - 11: DOWN_3000 — DOWN requires > 3000 bps negative (binary: Down or Up)
/// - 12: FLAT_300 — flat if < 300 bps (3%) (ternary: Flat/Up/Down)
/// - 13: FLAT_3000 — flat if < 3000 bps (30%) (ternary: Flat/Up/Down)
fn resolve_outcome_bps(pct_change_bps: i64, resolution_type: u8, threshold_bps: u32) -> MarketOutcome {
    let threshold = threshold_bps as i64;
    match resolution_type {
        // UP_0: any positive is UP
        0 => {
            if pct_change_bps > 0 {
                MarketOutcome::Up
            } else if pct_change_bps < 0 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Flat
            }
        }
        // UP_30: UP requires > 30 bps (0.3%)
        1 => {
            if pct_change_bps > 30 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // UP_X: UP requires > threshold bps
        2 => {
            if pct_change_bps > threshold {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // DOWN_0: any negative is DOWN
        3 => {
            if pct_change_bps < 0 {
                MarketOutcome::Down
            } else if pct_change_bps > 0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Flat
            }
        }
        // DOWN_30: DOWN requires > 30 bps negative
        4 => {
            if pct_change_bps < -30 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Up
            }
        }
        // DOWN_X: DOWN requires > threshold bps negative
        5 => {
            if pct_change_bps < -threshold {
                MarketOutcome::Down
            } else {
                MarketOutcome::Up
            }
        }
        // FLAT_0: flat if < 1 bps absolute
        6 => {
            if (pct_change_bps.unsigned_abs() as i64) < 1 {
                MarketOutcome::Flat
            } else if pct_change_bps > 0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // FLAT_X: flat if < threshold bps
        7 => {
            if (pct_change_bps.unsigned_abs() as i64) < threshold {
                MarketOutcome::Flat
            } else if pct_change_bps > 0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // UP_300: UP requires > 300 bps (3%)
        8 => {
            if pct_change_bps > 300 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // UP_3000: UP requires > 3000 bps (30%)
        9 => {
            if pct_change_bps > 3000 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // DOWN_300: DOWN requires > 300 bps negative
        10 => {
            if pct_change_bps < -300 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Up
            }
        }
        // DOWN_3000: DOWN requires > 3000 bps negative
        11 => {
            if pct_change_bps < -3000 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Up
            }
        }
        // FLAT_300: flat if < 300 bps (3%)
        12 => {
            if (pct_change_bps.unsigned_abs() as i64) < 300 {
                MarketOutcome::Flat
            } else if pct_change_bps > 0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // FLAT_3000: flat if < 3000 bps (30%)
        13 => {
            if (pct_change_bps.unsigned_abs() as i64) < 3000 {
                MarketOutcome::Flat
            } else if pct_change_bps > 0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // Unknown resolution type -> cancelled
        _ => MarketOutcome::Cancelled,
    }
}

/// Legacy f64 resolution function, retained only for cross-validation tests.
#[cfg(test)]
fn resolve_outcome(pct_change: f64, resolution_type: u8, threshold: f64) -> MarketOutcome {
    match resolution_type {
        // UP_0: any positive is UP
        0 => {
            if pct_change > 0.0 {
                MarketOutcome::Up
            } else if pct_change < 0.0 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Flat
            }
        }
        // UP_30: UP requires > 0.3% (binary: met or not)
        1 => {
            if pct_change > 0.3 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // UP_X: UP requires > threshold% (binary: met or not)
        2 => {
            if pct_change > threshold {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // DOWN_0: any negative is DOWN
        3 => {
            if pct_change < 0.0 {
                MarketOutcome::Down
            } else if pct_change > 0.0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Flat
            }
        }
        // DOWN_30: DOWN requires > 0.3% negative (binary: met or not)
        4 => {
            if pct_change < -0.3 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Up
            }
        }
        // DOWN_X: DOWN requires > threshold% negative (binary: met or not)
        5 => {
            if pct_change < -threshold {
                MarketOutcome::Down
            } else {
                MarketOutcome::Up
            }
        }
        // FLAT_0: flat if < 0.01% absolute
        6 => {
            if pct_change.abs() < 0.01 {
                MarketOutcome::Flat
            } else if pct_change > 0.0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // FLAT_X: flat if < threshold%
        7 => {
            if pct_change.abs() < threshold {
                MarketOutcome::Flat
            } else if pct_change > 0.0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // UP_300: UP requires > 3% (300 bps)
        8 => {
            if pct_change > 3.0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // UP_3000: UP requires > 30% (3000 bps)
        9 => {
            if pct_change > 30.0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // DOWN_300: DOWN requires > 3% negative
        10 => {
            if pct_change < -3.0 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Up
            }
        }
        // DOWN_3000: DOWN requires > 30% negative
        11 => {
            if pct_change < -30.0 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Up
            }
        }
        // FLAT_300: flat if < 3%
        12 => {
            if pct_change.abs() < 3.0 {
                MarketOutcome::Flat
            } else if pct_change > 0.0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // FLAT_3000: flat if < 30%
        13 => {
            if pct_change.abs() < 30.0 {
                MarketOutcome::Flat
            } else if pct_change > 0.0 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Down
            }
        }
        // Unknown resolution type -> cancelled
        _ => MarketOutcome::Cancelled,
    }
}

/// Get a specific bit from a bitmap (0-indexed, big-endian bit order within each byte).
///
/// Bit 0 is the most significant bit of byte 0.
/// Returns `None` if the index is out of bounds (bitmap too short to cover this market).
fn get_bitmap_bit(bitmap: &[u8], index: usize) -> Option<bool> {
    let byte_idx = index / 8;
    let bit_idx = 7 - (index % 8); // big-endian bit order
    if byte_idx >= bitmap.len() {
        return None; // Not covered by bitmap
    }
    Some((bitmap[byte_idx] >> bit_idx) & 1 == 1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::core::utils::keccak256;
    use std::sync::Arc;

    fn addr(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    fn default_config() -> VisionConfig {
        VisionConfig::default()
    }

    fn make_batch(id: u64, tick_duration: u64) -> Batch {
        Batch {
            id,
            creator: Address::zero(),
            source_id: H256::zero(),
            config_hash: H256::zero(),
            next_config_hash: H256::zero(),
            tick_duration,
            lock_offset: 0,
            next_lock_offset: 0,
            created_at_tick: 0,
            last_promotion_tick: 0,
            paused: false,
        }
    }

    /// Build MarketConfig entries from asset names and resolution types.
    fn make_market_configs(
        assets: &[(&str, u8)],
    ) -> Vec<MarketConfig> {
        assets.iter().map(|(name, res_type)| {
            MarketConfig {
                asset_id: name.to_string(),
                market_id: H256::from(keccak256(name.as_bytes())),
                resolution_type: *res_type,
                threshold_bps: 0,
            }
        }).collect()
    }

    fn make_market_configs_with_threshold(
        assets: &[(&str, u8, u32)],
    ) -> Vec<MarketConfig> {
        assets.iter().map(|(name, res_type, bps)| {
            MarketConfig {
                asset_id: name.to_string(),
                market_id: H256::from(keccak256(name.as_bytes())),
                resolution_type: *res_type,
                threshold_bps: *bps,
            }
        }).collect()
    }

    fn make_player(
        address: Address,
        stake_per_tick: u128,
        balance: u128,
        _join_timestamp: u64,
    ) -> PlayerPosition {
        PlayerPosition {
            player: address,
            bitmap_hash: H256::zero(),
            stake_per_tick: U256::from(stake_per_tick),
            start_tick: 0,
            balance: U256::from(balance),
            initial_deposit: U256::from(balance),
        }
    }

    /// Store a bitmap for a player in the active slot (pending → flip → active).
    async fn store_bitmap(store: &BitmapStore, player: Address, batch_id: u64, bitmap: Vec<u8>) {
        let hash = H256::from(keccak256(&bitmap));
        store
            .store_pending(player, batch_id, bitmap, hash, H256::zero(), 0)
            .await
            .expect("bitmap store should succeed");
        store.flip(batch_id).await;
    }

    // -------------------------------------------------------------------------
    // Test: bitmap bit extraction
    // -------------------------------------------------------------------------
    #[test]
    fn test_bitmap_bit_extraction() {
        // 0b10110000 = 0xB0 = 176
        let bitmap = vec![0b1011_0000u8];
        assert_eq!(get_bitmap_bit(&bitmap, 0), Some(true));  // bit 7 (MSB) = 1
        assert_eq!(get_bitmap_bit(&bitmap, 1), Some(false)); // bit 6 = 0
        assert_eq!(get_bitmap_bit(&bitmap, 2), Some(true));  // bit 5 = 1
        assert_eq!(get_bitmap_bit(&bitmap, 3), Some(true));  // bit 4 = 1
        assert_eq!(get_bitmap_bit(&bitmap, 4), Some(false)); // bit 3 = 0
        assert_eq!(get_bitmap_bit(&bitmap, 5), Some(false)); // bit 2 = 0
        assert_eq!(get_bitmap_bit(&bitmap, 6), Some(false)); // bit 1 = 0
        assert_eq!(get_bitmap_bit(&bitmap, 7), Some(false)); // bit 0 = 0

        // Out of bounds returns None (IS-6: bitmap doesn't cover this market)
        assert_eq!(get_bitmap_bit(&bitmap, 8), None);
        assert_eq!(get_bitmap_bit(&bitmap, 100), None);

        // Multi-byte: 0xFF 0x00 = all 1s then all 0s
        let bitmap2 = vec![0xFF, 0x00];
        for i in 0..8 {
            assert_eq!(get_bitmap_bit(&bitmap2, i), Some(true), "bit {i} should be Some(true)");
        }
        for i in 8..16 {
            assert_eq!(get_bitmap_bit(&bitmap2, i), Some(false), "bit {i} should be Some(false)");
        }

        // Empty bitmap
        assert_eq!(get_bitmap_bit(&[], 0), None);
    }

    // -------------------------------------------------------------------------
    // Test: compute_pct_change_bps
    // -------------------------------------------------------------------------
    #[test]
    fn test_compute_pct_change_bps() {
        // 100 -> 105 = 5% = 500 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 105_00000000), 500);

        // 100 -> 100.3 = 0.3% = 30 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 100_30000000), 30);

        // 100 -> 99.7 = -0.3% = -30 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 99_70000000), -30);

        // 100 -> 130 = 30% = 3000 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 130_00000000), 3000);

        // 100 -> 70 = -30% = -3000 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 70_00000000), -3000);

        // 100 -> 100 = 0% = 0 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 100_00000000), 0);

        // start_price = 0 -> returns 0
        assert_eq!(compute_pct_change_bps(0, 100_00000000), 0);

        // 100 -> 103 = 3% = 300 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 103_00000000), 300);

        // 100 -> 97 = -3% = -300 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 97_00000000), -300);

        // Small move: 100 -> 100.005 = 0.005% = 0 bps (truncated)
        assert_eq!(compute_pct_change_bps(100_00000000, 100_00500000), 0);

        // Tiny move: 100 -> 100.01 = 0.01% = 1 bps
        assert_eq!(compute_pct_change_bps(100_00000000, 100_01000000), 1);
    }

    // -------------------------------------------------------------------------
    // Test: resolve_outcome_bps variants (all use integer BPS)
    // -------------------------------------------------------------------------
    #[test]
    fn test_resolve_outcome_bps_up_0() {
        // 50 bps = 0.5%
        assert!(matches!(resolve_outcome_bps(50, 0, 0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(-50, 0, 0), MarketOutcome::Down));
        assert!(matches!(resolve_outcome_bps(0, 0, 0), MarketOutcome::Flat));
    }

    #[test]
    fn test_resolve_outcome_bps_up_30() {
        // 31 bps = 0.31%
        assert!(matches!(resolve_outcome_bps(31, 1, 0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(-31, 1, 0), MarketOutcome::Down));
        // Binary: below threshold -> Down (no Flat)
        assert!(matches!(resolve_outcome_bps(29, 1, 0), MarketOutcome::Down));
        assert!(matches!(resolve_outcome_bps(-29, 1, 0), MarketOutcome::Down));
        assert!(matches!(resolve_outcome_bps(0, 1, 0), MarketOutcome::Down));
    }

    #[test]
    fn test_resolve_outcome_bps_up_x() {
        // threshold = 150 bps = 1.5%
        let threshold_bps = 150;
        // 160 bps = 1.6%
        assert!(matches!(resolve_outcome_bps(160, 2, threshold_bps), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(-160, 2, threshold_bps), MarketOutcome::Down));
        // 140 bps = 1.4%, below threshold
        assert!(matches!(resolve_outcome_bps(140, 2, threshold_bps), MarketOutcome::Down));
    }

    #[test]
    fn test_resolve_outcome_bps_down_0() {
        assert!(matches!(resolve_outcome_bps(-50, 3, 0), MarketOutcome::Down));
        assert!(matches!(resolve_outcome_bps(50, 3, 0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(0, 3, 0), MarketOutcome::Flat));
    }

    #[test]
    fn test_resolve_outcome_bps_down_30() {
        // -31 bps = -0.31%
        assert!(matches!(resolve_outcome_bps(-31, 4, 0), MarketOutcome::Down));
        assert!(matches!(resolve_outcome_bps(31, 4, 0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(0, 4, 0), MarketOutcome::Up));
    }

    #[test]
    fn test_resolve_outcome_bps_down_x() {
        // threshold = 200 bps = 2.0%
        let threshold_bps = 200;
        // -210 bps = -2.1%
        assert!(matches!(resolve_outcome_bps(-210, 5, threshold_bps), MarketOutcome::Down));
        assert!(matches!(resolve_outcome_bps(210, 5, threshold_bps), MarketOutcome::Up));
        // -190 bps = -1.9%, above -threshold
        assert!(matches!(resolve_outcome_bps(190, 5, threshold_bps), MarketOutcome::Up));
    }

    #[test]
    fn test_resolve_outcome_bps_flat_0() {
        // 0 bps < 1 bps threshold -> Flat
        assert!(matches!(resolve_outcome_bps(0, 6, 0), MarketOutcome::Flat));
        // 50 bps = 0.5% -> Up
        assert!(matches!(resolve_outcome_bps(50, 6, 0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(-50, 6, 0), MarketOutcome::Down));
    }

    #[test]
    fn test_resolve_outcome_bps_flat_x() {
        // threshold = 50 bps = 0.5%
        let threshold_bps = 50;
        // 30 bps = 0.3% < 50 bps threshold -> Flat
        assert!(matches!(resolve_outcome_bps(30, 7, threshold_bps), MarketOutcome::Flat));
        // 60 bps = 0.6% > 50 bps threshold -> Up
        assert!(matches!(resolve_outcome_bps(60, 7, threshold_bps), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(-60, 7, threshold_bps), MarketOutcome::Down));
    }

    #[test]
    fn test_resolve_outcome_bps_up_300() {
        // 350 bps = 3.5%
        assert!(matches!(resolve_outcome_bps(350, 8, 0), MarketOutcome::Up));
        // 250 bps = 2.5%
        assert!(matches!(resolve_outcome_bps(250, 8, 0), MarketOutcome::Down));
        assert!(matches!(resolve_outcome_bps(-500, 8, 0), MarketOutcome::Down));
    }

    #[test]
    fn test_resolve_outcome_bps_up_3000() {
        // 3500 bps = 35%
        assert!(matches!(resolve_outcome_bps(3500, 9, 0), MarketOutcome::Up));
        // 2500 bps = 25%
        assert!(matches!(resolve_outcome_bps(2500, 9, 0), MarketOutcome::Down));
    }

    #[test]
    fn test_resolve_outcome_bps_down_300() {
        // -350 bps = -3.5%
        assert!(matches!(resolve_outcome_bps(-350, 10, 0), MarketOutcome::Down));
        // -250 bps = -2.5%
        assert!(matches!(resolve_outcome_bps(-250, 10, 0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(500, 10, 0), MarketOutcome::Up));
    }

    #[test]
    fn test_resolve_outcome_bps_down_3000() {
        // -3500 bps = -35%
        assert!(matches!(resolve_outcome_bps(-3500, 11, 0), MarketOutcome::Down));
        // -2500 bps = -25%
        assert!(matches!(resolve_outcome_bps(-2500, 11, 0), MarketOutcome::Up));
    }

    #[test]
    fn test_resolve_outcome_bps_flat_300() {
        // 250 bps = 2.5% < 300 -> Flat
        assert!(matches!(resolve_outcome_bps(250, 12, 0), MarketOutcome::Flat));
        // 350 bps = 3.5% > 300 -> Up
        assert!(matches!(resolve_outcome_bps(350, 12, 0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(-350, 12, 0), MarketOutcome::Down));
    }

    #[test]
    fn test_resolve_outcome_bps_flat_3000() {
        // 2500 bps = 25% < 3000 -> Flat
        assert!(matches!(resolve_outcome_bps(2500, 13, 0), MarketOutcome::Flat));
        // 3500 bps = 35% > 3000 -> Up
        assert!(matches!(resolve_outcome_bps(3500, 13, 0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome_bps(-3500, 13, 0), MarketOutcome::Down));
    }

    #[test]
    fn test_resolve_outcome_bps_unknown_type() {
        assert!(matches!(resolve_outcome_bps(100, 99, 0), MarketOutcome::Cancelled));
    }

    // -------------------------------------------------------------------------
    // Cross-validation: integer BPS results match f64 for common inputs
    // -------------------------------------------------------------------------
    #[test]
    fn test_bps_cross_validation_with_f64() {
        // Test a range of price movements and verify both paths agree.
        let test_cases: Vec<(f64, f64, u8, u32)> = vec![
            // (start, end, resolution_type, threshold_bps)
            (100.0, 105.0, 0, 0),     // 5% up, UP_0
            (100.0, 95.0, 0, 0),      // 5% down, UP_0
            (100.0, 100.0, 0, 0),     // flat, UP_0
            (100.0, 100.31, 1, 0),    // 0.31% up, UP_30
            (100.0, 99.69, 1, 0),     // 0.31% down, UP_30
            (100.0, 100.29, 1, 0),    // 0.29% up (below threshold), UP_30
            (100.0, 101.6, 2, 150),   // 1.6% up, UP_X (threshold=1.5%)
            (100.0, 101.4, 2, 150),   // 1.4% up (below), UP_X
            (100.0, 97.9, 5, 200),    // 2.1% down, DOWN_X (threshold=2%)
            (100.0, 103.5, 8, 0),     // 3.5% up, UP_300
            (100.0, 96.5, 10, 0),     // 3.5% down, DOWN_300
            (100.0, 135.0, 9, 0),     // 35% up, UP_3000
            (100.0, 65.0, 11, 0),     // 35% down, DOWN_3000
            (100.0, 102.5, 12, 0),    // 2.5% up (flat zone), FLAT_300
            (100.0, 125.0, 13, 0),    // 25% up (flat zone), FLAT_3000
        ];

        for (start, end, res_type, threshold_bps) in test_cases {
            // f64 path
            let pct_change_f64 = if start != 0.0 {
                (end - start) / start * 100.0
            } else {
                0.0
            };
            let threshold_f64 = threshold_bps as f64 / 100.0;
            let outcome_f64 = resolve_outcome(pct_change_f64, res_type, threshold_f64);

            // Integer BPS path
            let start_scaled = (start * 1e8) as u128;
            let end_scaled = (end * 1e8) as u128;
            let pct_bps = compute_pct_change_bps(start_scaled, end_scaled);
            let outcome_bps = resolve_outcome_bps(pct_bps, res_type, threshold_bps);

            // Both paths must agree
            assert_eq!(
                std::mem::discriminant(&outcome_f64),
                std::mem::discriminant(&outcome_bps),
                "Mismatch for start={start}, end={end}, res_type={res_type}, threshold_bps={threshold_bps}: \
                 f64={outcome_f64:?} (pct={pct_change_f64:.4}%) vs bps={outcome_bps:?} (bps={pct_bps})"
            );
        }
    }

    // -------------------------------------------------------------------------
    // Test: basic UP resolution with 2 players
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_resolve_basic_up() {
        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        let market_configs = make_market_configs(&[("testmarket", 0)]); // UP_0 resolution
        let market_id = market_configs[0].market_id;
        let batch = make_batch(1, 600);

        let player_a = addr(1);
        let player_b = addr(2);

        // Player A picks UP (bit=1), Player B picks DOWN (bit=0)
        // Bitmap for 1 market: byte = 0b10000000 for UP, 0b00000000 for DOWN
        let bitmap_a = vec![0b1000_0000u8]; // bit 0 = 1 -> UP
        let bitmap_b = vec![0b0000_0000u8]; // bit 0 = 0 -> DOWN

        let players = vec![
            make_player(player_a, 1000, 100_000, 0),
            make_player(player_b, 1000, 100_000, 0),
        ];

        store_bitmap(&store, player_a, 1, bitmap_a).await;
        store_bitmap(&store, player_b, 1, bitmap_b).await;

        // Price went UP: 100 -> 105 (5%)
        let mut prices = MarketPrices::new();
        prices.insert(market_id, 10_000_000_000, 10_500_000_000, 1000);

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await
            .expect("resolve should succeed");

        assert_eq!(result.batch_id, 1);
        assert_eq!(result.tick_id, 0);
        assert_eq!(result.market_results.len(), 1);
        assert!(result.voided_players.is_empty());

        let market = &result.market_results[0];
        assert!(matches!(market.outcome, MarketOutcome::Up));
        // 5% = 500 bps
        assert_eq!(market.pct_change_bps, 500);

        // Player A (UP) should have won, Player B (DOWN) should have lost
        let pa = market
            .player_results
            .iter()
            .find(|r| r.player == player_a)
            .unwrap();
        assert!(matches!(pa.side, Side::Up));
        assert!(pa.payout > U256::zero(), "winner should have payout > 0");

        let pb = market
            .player_results
            .iter()
            .find(|r| r.player == player_b)
            .unwrap();
        assert!(matches!(pb.side, Side::Down));
        assert_eq!(pb.payout, U256::zero(), "loser should have payout = 0");

        // Check balance deltas: winner gains, loser loses
        let bal_a = result
            .player_balances
            .iter()
            .find(|b| b.player == player_a)
            .unwrap();
        assert!(bal_a.delta > 0, "winner delta should be positive");

        let bal_b = result
            .player_balances
            .iter()
            .find(|b| b.player == player_b)
            .unwrap();
        assert!(bal_b.delta < 0, "loser delta should be negative");
    }

    // -------------------------------------------------------------------------
    // Test: voided player (no bitmap)
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_resolve_voided_player() {
        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        let market_configs = make_market_configs(&[("testmarket", 0)]);
        let market_id = market_configs[0].market_id;
        let batch = make_batch(1, 600);

        let player_a = addr(1);
        let player_b = addr(2);
        let player_c = addr(3); // This player will NOT submit a bitmap

        // Only A and B submit bitmaps
        store_bitmap(&store, player_a, 1, vec![0b1000_0000]).await; // UP
        store_bitmap(&store, player_b, 1, vec![0b0000_0000]).await; // DOWN

        let players = vec![
            make_player(player_a, 1000, 100_000, 0),
            make_player(player_b, 1000, 100_000, 0),
            make_player(player_c, 1000, 50_000, 0), // No bitmap
        ];

        let mut prices = MarketPrices::new();
        prices.insert(market_id, 10_000_000_000, 10_200_000_000, 1000);

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await
            .expect("resolve should succeed");

        // Player C should be voided
        assert_eq!(result.voided_players.len(), 1);
        assert_eq!(result.voided_players[0], player_c);

        // Player C should not appear in market_results
        let market = &result.market_results[0];
        assert!(
            !market.player_results.iter().any(|r| r.player == player_c),
            "voided player should not appear in market results"
        );

        // Voided player's balance should remain unchanged (delta = 0)
        let bal_c = result
            .player_balances
            .iter()
            .find(|b| b.player == player_c)
            .unwrap();
        assert_eq!(bal_c.delta, 0, "voided player delta should be 0");
        assert_eq!(
            bal_c.old_balance, bal_c.new_balance,
            "voided player balance unchanged"
        );
    }

    // -------------------------------------------------------------------------
    // Test: cancelled market (missing price data)
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_resolve_cancelled_market() {
        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        let market_configs = make_market_configs(&[("testmarket", 0)]);
        let batch = make_batch(1, 600);

        let player_a = addr(1);
        let player_b = addr(2);

        store_bitmap(&store, player_a, 1, vec![0b1000_0000]).await;
        store_bitmap(&store, player_b, 1, vec![0b0000_0000]).await;

        let players = vec![
            make_player(player_a, 1000, 100_000, 0),
            make_player(player_b, 1000, 100_000, 0),
        ];

        // NO prices inserted -> cancelled
        let prices = MarketPrices::new();

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await
            .expect("resolve should succeed");

        assert_eq!(result.market_results.len(), 1);
        assert!(matches!(
            result.market_results[0].outcome,
            MarketOutcome::Cancelled
        ));

        // All players should have delta=0 (no change from cancelled market)
        for bal in &result.player_balances {
            assert_eq!(
                bal.delta, 0,
                "cancelled market should not change player balances"
            );
            assert_eq!(bal.old_balance, bal.new_balance);
        }
    }

    // -------------------------------------------------------------------------
    // Test: stale price data causes cancellation
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_resolve_stale_price_cancelled() {
        let store = Arc::new(BitmapStore::new());
        let mut config = default_config();
        config.staleness_threshold_secs = 300;
        let resolver = TickResolver::new(store.clone(), config);

        let market_configs = make_market_configs(&[("testmarket", 0)]);
        let market_id = market_configs[0].market_id;
        let batch = make_batch(1, 600);

        store_bitmap(&store, addr(1), 1, vec![0b1000_0000]).await;
        store_bitmap(&store, addr(2), 1, vec![0b0000_0000]).await;

        let players = vec![
            make_player(addr(1), 1000, 100_000, 0),
            make_player(addr(2), 1000, 100_000, 0),
        ];

        // Price data is old (last_update=100, now=1000, threshold=300 -> stale)
        let mut prices = MarketPrices::new();
        prices.insert(market_id, 10_000_000_000, 10_500_000_000, 100);

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await
            .expect("resolve should succeed");

        assert!(matches!(
            result.market_results[0].outcome,
            MarketOutcome::Cancelled
        ));
    }

    // -------------------------------------------------------------------------
    // Test: no active players returns error
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_resolve_no_active_players() {
        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        let market_configs = make_market_configs(&[("testmarket", 0)]);
        let batch = make_batch(1, 600);

        // All players have zero balance
        let players = vec![
            make_player(addr(1), 1000, 0, 0),
            make_player(addr(2), 1000, 0, 0),
        ];

        let prices = MarketPrices::new();

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await;

        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            ResolverError::NoActivePlayers(1)
        ));
    }

    // -------------------------------------------------------------------------
    // Test: multiple markets in one batch
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_resolve_multiple_markets() {
        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        let market_configs = make_market_configs(&[("market_a", 0), ("market_b", 0)]);
        let market_a = market_configs[0].market_id;
        let market_b = market_configs[1].market_id;
        let batch = make_batch(1, 600);

        let player_1 = addr(1);
        let player_2 = addr(2);

        // Player 1: UP on market_a (bit 0), DOWN on market_b (bit 1)
        // Bitmap: 0b10000000 -> bit 0 = 1 (UP), bit 1 = 0 (DOWN)
        store_bitmap(&store, player_1, 1, vec![0b1000_0000]).await;

        // Player 2: DOWN on market_a (bit 0), UP on market_b (bit 1)
        // Bitmap: 0b01000000 -> bit 0 = 0 (DOWN), bit 1 = 1 (UP)
        store_bitmap(&store, player_2, 1, vec![0b0100_0000]).await;

        let players = vec![
            make_player(player_1, 1000, 100_000, 0),
            make_player(player_2, 1000, 100_000, 0),
        ];

        let mut prices = MarketPrices::new();
        prices.insert(market_a, 10_000_000_000, 11_000_000_000, 1000); // UP 10%
        prices.insert(market_b, 10_000_000_000, 9_000_000_000, 1000); // DOWN 10%

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await
            .expect("resolve should succeed");

        assert_eq!(result.market_results.len(), 2);

        // Market A: UP -> Player 1 wins, Player 2 loses
        let mkt_a = result
            .market_results
            .iter()
            .find(|m| m.market_id == market_a)
            .unwrap();
        assert!(matches!(mkt_a.outcome, MarketOutcome::Up));

        // Market B: DOWN -> Player 2 wins, Player 1 loses
        let mkt_b = result
            .market_results
            .iter()
            .find(|m| m.market_id == market_b)
            .unwrap();
        assert!(matches!(mkt_b.outcome, MarketOutcome::Down));
    }

    // -------------------------------------------------------------------------
    // Test: multi-market zero-sum (DEV-1 verification)
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_multi_market_zero_sum() {
        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        // 5 markets, all UP_0 resolution
        let market_configs = make_market_configs(&[
            ("btc", 0), ("eth", 0), ("sol", 0), ("avax", 0), ("matic", 0),
        ]);
        let batch = make_batch(1, 600);

        let player_a = addr(1);
        let player_b = addr(2);

        // Player A: UP on all 5 markets (bits 0-4 = 1)
        // 0b11111000 = 0xF8
        store_bitmap(&store, player_a, 1, vec![0b1111_1000u8]).await;

        // Player B: DOWN on all 5 markets (bits 0-4 = 0)
        store_bitmap(&store, player_b, 1, vec![0b0000_0000u8]).await;

        let players = vec![
            make_player(player_a, 1000, 100_000, 0),
            make_player(player_b, 1000, 100_000, 0),
        ];

        // All markets go UP → Player A wins all, Player B loses all
        let mut prices = MarketPrices::new();
        for mc in &market_configs {
            prices.insert(mc.market_id, 10_000_000_000, 11_000_000_000, 1000);
        }

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await
            .expect("resolve should succeed");

        // Zero-sum: sum of all deltas must be 0
        let total_delta: i128 = result.player_balances.iter().map(|b| b.delta).sum();
        assert_eq!(total_delta, 0, "sum of deltas must be zero (got {total_delta})");

        // Balance conservation: sum of new balances == sum of old balances
        let total_old: U256 = result.player_balances.iter().map(|b| b.old_balance).fold(U256::zero(), |a, b| a + b);
        let total_new: U256 = result.player_balances.iter().map(|b| b.new_balance).fold(U256::zero(), |a, b| a + b);
        assert_eq!(total_old, total_new, "total balance must be conserved");

        // Winner gains, loser loses
        let bal_a = result.player_balances.iter().find(|b| b.player == player_a).unwrap();
        let bal_b = result.player_balances.iter().find(|b| b.player == player_b).unwrap();
        assert!(bal_a.delta > 0, "winner should gain");
        assert!(bal_b.delta < 0, "loser should lose");
        assert_eq!(bal_a.delta, -bal_b.delta, "winner's gain = loser's loss");
    }

    // -------------------------------------------------------------------------
    // Test: per-market stake matches brief example (DEV-1)
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_per_market_stake_matches_brief_example() {
        // Brief line 422-453: 4 players, 3 markets
        // Stake ratios: Alice:Bob:Carol:Dave = 4:2:1:1
        // Each player's per-market stake = effective_stake / 3
        // Verify the splitting property and zero-sum conservation.

        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        let market_configs = make_market_configs(&[("mkt_a", 0), ("mkt_b", 0), ("mkt_c", 0)]);
        let num_markets = market_configs.len();
        let batch = make_batch(1, 600);

        let alice = addr(1);
        let bob = addr(2);
        let carol = addr(3);
        let dave = addr(4);

        // Alice: UP on all 3 markets (bits 0,1,2 = 1) → 0b11100000
        store_bitmap(&store, alice, 1, vec![0b1110_0000u8]).await;
        // Bob: DOWN on all 3 (bits 0,1,2 = 0) → 0b00000000
        store_bitmap(&store, bob, 1, vec![0b0000_0000u8]).await;
        // Carol: UP on mkt_a, DOWN on mkt_b, UP on mkt_c → 0b10100000
        store_bitmap(&store, carol, 1, vec![0b1010_0000u8]).await;
        // Dave: DOWN on mkt_a, UP on mkt_b, DOWN on mkt_c → 0b01000000
        store_bitmap(&store, dave, 1, vec![0b0100_0000u8]).await;

        let players = vec![
            make_player(alice, 1200, 1_000_000, 0),
            make_player(bob, 600, 1_000_000, 0),
            make_player(carol, 300, 1_000_000, 0),
            make_player(dave, 300, 1_000_000, 0),
        ];

        // All markets go UP
        let mut prices = MarketPrices::new();
        for mc in &market_configs {
            prices.insert(mc.market_id, 10_000_000_000, 11_000_000_000, 1000);
        }

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await
            .expect("resolve should succeed");

        // Verify per-market stakes are split by num_markets and maintain ordering.
        // NOTE: exact ratios depend on commitment multiplier (log10 of balance/stake + offset),
        // which differs per player. We verify ordering and Carol=Dave (same params).
        let market = &result.market_results[0]; // check first market
        let alice_stake = market.player_results.iter().find(|r| r.player == alice).unwrap().effective_stake;
        let bob_stake = market.player_results.iter().find(|r| r.player == bob).unwrap().effective_stake;
        let carol_stake = market.player_results.iter().find(|r| r.player == carol).unwrap().effective_stake;
        let dave_stake = market.player_results.iter().find(|r| r.player == dave).unwrap().effective_stake;

        // Ordering check: Alice > Bob > Carol = Dave (raw stakes are 1200:600:300:300)
        assert!(alice_stake > bob_stake, "Alice should have higher stake than Bob");
        assert!(bob_stake > carol_stake, "Bob should have higher stake than Carol");
        assert_eq!(carol_stake, dave_stake, "Carol should equal Dave (same stake + same params)");

        // Per-market stake should be total_effective / num_markets
        // Check all markets have consistent stakes (same per-market split)
        for market in &result.market_results {
            let a = market.player_results.iter().find(|r| r.player == alice).unwrap().effective_stake;
            assert_eq!(a, alice_stake, "Alice's stake should be the same across all markets");
        }

        // Per-market stake × num_markets should approximately equal the total effective stake
        // (integer division may lose up to num_markets-1 wei)
        let alice_total = alice_stake * U256::from(num_markets);
        // The multiplier is applied, so total_effective >= stake_per_tick
        assert!(alice_total >= U256::from(1200u64), "alice per-market × 3 should be >= raw stake");

        // Zero-sum: allow rounding tolerance from integer division in parimutuel matching
        // (at most 1 wei per market due to floor division of matched_stake)
        let total_delta: i128 = result.player_balances.iter().map(|b| b.delta).sum();
        assert!(
            total_delta.abs() <= num_markets as i128,
            "zero-sum violated beyond rounding tolerance: {total_delta} (max allowed: {num_markets})"
        );
    }

    // -------------------------------------------------------------------------
    // Test: tick-major bitmap indexing (DEV-3 verification)
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_bitmap_tick_major_indexing() {
        // 2-tick bitmap with 3 markets = 6 bits total
        // Tick 0: bits 0,1,2 (markets 0,1,2)
        // Tick 1: bits 3,4,5 (markets 0,1,2)
        //
        // Bitmap: 0b10110100 (only first 6 bits used)
        //   Tick 0: bit0=1(UP), bit1=0(DOWN), bit2=1(UP)
        //   Tick 1: bit3=1(UP), bit4=0(DOWN), bit5=1(UP) ... wait
        //
        // Actually let's use different patterns per tick to verify:
        //   Tick 0: UP, DOWN, UP  → bits 0,1,2 = 1,0,1
        //   Tick 1: DOWN, UP, DOWN → bits 3,4,5 = 0,1,0
        //   Bitmap byte: 0b10101000 = 0xA8
        //   Actually: bit0=1, bit1=0, bit2=1, bit3=0, bit4=1, bit5=0
        //   Byte: MSB first → bit0 is MSB of byte 0 → 0b101010_00 = 0xA8

        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        let market_configs = make_market_configs(&[("mkt_x", 0), ("mkt_y", 0), ("mkt_z", 0)]);
        let batch = make_batch(1, 600);

        let player_a = addr(1);
        let player_b = addr(2);

        // Player A: 2-tick bitmap
        // Tick 0: UP(1), DOWN(0), UP(1)  → bits 0-2 = 1,0,1
        // Tick 1: DOWN(0), UP(1), DOWN(0) → bits 3-5 = 0,1,0
        // Big-endian bit order in byte: bit0=MSB → 10101000 = 0xA8
        let bitmap_a = vec![0b1010_1000u8];
        store_bitmap(&store, player_a, 1, bitmap_a).await;

        // Player B: opposite of A at tick 0
        // Tick 0: DOWN(0), UP(1), DOWN(0) → bits 0-2 = 0,1,0
        // Tick 1: UP(1), DOWN(0), UP(1)   → bits 3-5 = 1,0,1
        let bitmap_b = vec![0b0101_0100u8];
        store_bitmap(&store, player_b, 1, bitmap_b).await;

        let players = vec![
            make_player(player_a, 1000, 100_000, 0),
            make_player(player_b, 1000, 100_000, 0),
        ];

        // === Tick 0 ===
        let mut prices = MarketPrices::new();
        for mc in &market_configs {
            prices.insert(mc.market_id, 10_000_000_000, 11_000_000_000, 1000); // All UP
        }

        let result_t0 = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000, &market_configs)
            .await
            .expect("tick 0 should resolve");

        // At tick 0: Player A has UP on mkt_x, DOWN on mkt_y, UP on mkt_z
        let mkt_x = &result_t0.market_results[0];
        let a_x = mkt_x.player_results.iter().find(|r| r.player == player_a).unwrap();
        assert!(matches!(a_x.side, Side::Up), "tick 0, mkt_x: A should be UP");

        let mkt_y = &result_t0.market_results[1];
        let a_y = mkt_y.player_results.iter().find(|r| r.player == player_a).unwrap();
        assert!(matches!(a_y.side, Side::Down), "tick 0, mkt_y: A should be DOWN");

        let mkt_z = &result_t0.market_results[2];
        let a_z = mkt_z.player_results.iter().find(|r| r.player == player_a).unwrap();
        assert!(matches!(a_z.side, Side::Up), "tick 0, mkt_z: A should be UP");

        // === Tick 1 ===
        // Player A at tick 1 should have DIFFERENT sides: DOWN, UP, DOWN
        let result_t1 = resolver
            .resolve_tick(&batch, 1, &players, &prices, 1000, &market_configs)
            .await
            .expect("tick 1 should resolve");

        let mkt_x_t1 = &result_t1.market_results[0];
        let a_x_t1 = mkt_x_t1.player_results.iter().find(|r| r.player == player_a).unwrap();
        assert!(matches!(a_x_t1.side, Side::Down), "tick 1, mkt_x: A should be DOWN (flipped from tick 0)");

        let mkt_y_t1 = &result_t1.market_results[1];
        let a_y_t1 = mkt_y_t1.player_results.iter().find(|r| r.player == player_a).unwrap();
        assert!(matches!(a_y_t1.side, Side::Up), "tick 1, mkt_y: A should be UP (flipped from tick 0)");

        let mkt_z_t1 = &result_t1.market_results[2];
        let a_z_t1 = mkt_z_t1.player_results.iter().find(|r| r.player == player_a).unwrap();
        assert!(matches!(a_z_t1.side, Side::Down), "tick 1, mkt_z: A should be DOWN (flipped from tick 0)");

        // Zero-sum for both ticks
        let delta_t0: i128 = result_t0.player_balances.iter().map(|b| b.delta).sum();
        assert_eq!(delta_t0, 0, "tick 0 zero-sum violated");
        let delta_t1: i128 = result_t1.player_balances.iter().map(|b| b.delta).sum();
        assert_eq!(delta_t1, 0, "tick 1 zero-sum violated");
    }

    // -------------------------------------------------------------------------
    // Test: MarketPrices staleness check
    // -------------------------------------------------------------------------
    #[test]
    fn test_market_prices_staleness() {
        let mut prices = MarketPrices::new();
        let market_id = H256::random();

        // No data -> stale
        assert!(prices.is_stale(&market_id, 300, 1000));

        // Fresh data (last_update=900, now=1000, threshold=300)
        prices.insert(market_id, 10_000_000_000, 10_500_000_000, 900);
        assert!(!prices.is_stale(&market_id, 300, 1000));

        // Stale data (last_update=600, now=1000, threshold=300 -> 400 > 300)
        prices.insert(market_id, 10_000_000_000, 10_500_000_000, 600);
        assert!(prices.is_stale(&market_id, 300, 1000));

        // Exactly at threshold (last_update=700, now=1000 -> 300 == 300, not stale)
        prices.insert(market_id, 10_000_000_000, 10_500_000_000, 700);
        assert!(!prices.is_stale(&market_id, 300, 1000));
    }
}
