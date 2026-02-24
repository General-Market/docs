//! Vision tick resolver
//!
//! Orchestrates the full tick resolution pipeline for a batch:
//!
//! 1. Filter active players (balance > 0)
//! 2. Check bitmap reveals (non-revealed players are voided, stake refunded)
//! 3. Compute multipliers (early + commitment)
//! 4. For each market:
//!    a. Fetch start/end prices, check staleness
//!    b. Compute % change and determine outcome
//!    c. Decode bitmaps to player sides
//!    d. Run parimutuel side matching
//! 5. Aggregate per-player balance changes
//! 6. Return TickResult

use std::collections::HashMap;
use std::sync::Arc;

use ethers::types::{Address, H256, U256};

use super::bitmap_store::BitmapStore;
use super::config::VisionConfig;
use super::multiplier;
use super::side_matching::{self, SideMatchInput};
use super::types::*;

/// Price data for tick resolution.
///
/// Maps market_id to (start_price, end_price, last_update_timestamp).
pub struct MarketPrices {
    prices: HashMap<H256, (f64, f64, u64)>,
}

impl MarketPrices {
    pub fn new() -> Self {
        Self {
            prices: HashMap::new(),
        }
    }

    /// Insert price data for a market.
    pub fn insert(&mut self, market_id: H256, start: f64, end: f64, last_update: u64) {
        self.prices.insert(market_id, (start, end, last_update));
    }

    /// Get start and end prices for a market.
    pub fn get_prices(&self, market_id: &H256) -> Option<(f64, f64)> {
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
    bitmap_store: Arc<BitmapStore>,
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
    pub async fn resolve_tick(
        &self,
        batch: &Batch,
        tick_id: u64,
        players: &[PlayerPosition],
        prices: &MarketPrices,
        now: u64,
    ) -> Result<TickResult, ResolverError> {
        let tick_duration = batch.tick_duration;
        let tick_start_time = (batch.created_at_tick + tick_id) * tick_duration;

        // 1. Filter active players (balance > 0)
        let active: Vec<&PlayerPosition> = players.iter().filter(|p| !p.balance.is_zero()).collect();

        if active.is_empty() {
            return Err(ResolverError::NoActivePlayers(batch.id));
        }

        // 2. Check bitmap reveals
        let bitmaps = self.bitmap_store.get_all_for_batch(batch.id).await;
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

        // 3. Compute multipliers for revealed players
        let revealed_positions: Vec<PlayerPosition> =
            revealed_players.iter().map(|(p, _)| (*p).clone()).collect();
        let multipliers = multiplier::compute_all_multipliers(
            &revealed_positions,
            tick_id,
            tick_duration,
            tick_start_time,
            &self.config,
        );

        // Build a lookup: player -> multiplier
        let mult_map: HashMap<Address, &PlayerMultiplier> =
            multipliers.iter().map(|m| (m.player, m)).collect();

        // 4. Resolve each market
        let mut market_results = Vec::new();
        let mut player_deltas: HashMap<Address, i128> = HashMap::new();

        for (market_idx, market_id) in batch.market_ids.iter().enumerate() {
            // Get prices
            let (start_price, end_price) = match prices.get_prices(market_id) {
                Some(p) => p,
                None => {
                    // No price data -> cancelled market
                    market_results.push(MarketResult {
                        market_id: *market_id,
                        outcome: MarketOutcome::Cancelled,
                        pct_change: 0.0,
                        player_results: vec![],
                    });
                    continue;
                }
            };

            // Check staleness
            if prices.is_stale(market_id, self.config.staleness_threshold_secs, now) {
                market_results.push(MarketResult {
                    market_id: *market_id,
                    outcome: MarketOutcome::Cancelled,
                    pct_change: 0.0,
                    player_results: vec![],
                });
                continue;
            }

            // Compute % change
            let pct_change = if start_price != 0.0 {
                (end_price - start_price) / start_price * 100.0
            } else {
                0.0
            };

            // Determine outcome based on resolution type
            let resolution_type = batch.resolution_types[market_idx];
            let threshold = batch
                .custom_thresholds
                .get(market_idx)
                .map(|t| t.as_u64() as f64 / 100.0) // threshold stored as basis points
                .unwrap_or(0.0);
            let outcome = resolve_outcome(pct_change, resolution_type, threshold);

            // Decode bitmaps -> player sides for this market
            let mut side_inputs = Vec::new();
            for (player, bitmap) in &revealed_players {
                if let Some(mult) = mult_map.get(&player.player) {
                    let bit = get_bitmap_bit(bitmap, market_idx);
                    let side = if bit { Side::Up } else { Side::Down };
                    side_inputs.push(SideMatchInput {
                        player: player.player,
                        side,
                        effective_stake: mult.effective_stake,
                    });
                }
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
                market_id: *market_id,
                outcome,
                pct_change,
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

        Ok(TickResult {
            batch_id: batch.id,
            tick_id,
            market_results,
            player_balances,
            voided_players,
        })
    }
}

/// Determine market outcome from % change and resolution type.
///
/// Resolution types:
/// - 0: UP_0 — any positive move is UP
/// - 1: UP_30 — UP requires > 0.3% move
/// - 2: UP_X — UP requires > custom threshold %
/// - 3: DOWN_0 — any negative move is DOWN
/// - 4: DOWN_30 — DOWN requires > 0.3% negative move
/// - 5: DOWN_X — DOWN requires > custom threshold % negative move
/// - 6: FLAT_0 — flat if < 0.01% absolute move
/// - 7: FLAT_X — flat if < custom threshold %
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
        // UP_30: UP requires > 0.3%
        1 => {
            if pct_change > 0.3 {
                MarketOutcome::Up
            } else if pct_change < -0.3 {
                MarketOutcome::Down
            } else {
                MarketOutcome::Flat
            }
        }
        // UP_X: UP requires > threshold%
        2 => {
            if pct_change > threshold {
                MarketOutcome::Up
            } else if pct_change < -threshold {
                MarketOutcome::Down
            } else {
                MarketOutcome::Flat
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
        // DOWN_30: DOWN requires > 0.3% negative
        4 => {
            if pct_change < -0.3 {
                MarketOutcome::Down
            } else if pct_change > 0.3 {
                MarketOutcome::Up
            } else {
                MarketOutcome::Flat
            }
        }
        // DOWN_X: DOWN requires > threshold% negative
        5 => {
            if pct_change < -threshold {
                MarketOutcome::Down
            } else if pct_change > threshold {
                MarketOutcome::Up
            } else {
                MarketOutcome::Flat
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
        // Unknown resolution type -> cancelled
        _ => MarketOutcome::Cancelled,
    }
}

/// Get a specific bit from a bitmap (0-indexed, big-endian bit order within each byte).
///
/// Bit 0 is the most significant bit of byte 0.
fn get_bitmap_bit(bitmap: &[u8], index: usize) -> bool {
    let byte_idx = index / 8;
    let bit_idx = 7 - (index % 8); // big-endian bit order
    if byte_idx >= bitmap.len() {
        return false;
    }
    (bitmap[byte_idx] >> bit_idx) & 1 == 1
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

    fn make_batch(
        id: u64,
        market_ids: Vec<H256>,
        resolution_types: Vec<u8>,
        tick_duration: u64,
    ) -> Batch {
        Batch {
            id,
            creator: Address::zero(),
            market_ids,
            resolution_types,
            tick_duration,
            custom_thresholds: vec![],
            created_at_tick: 0,
            paused: false,
        }
    }

    fn make_player(
        address: Address,
        stake_per_tick: u128,
        balance: u128,
        join_timestamp: u64,
    ) -> PlayerPosition {
        PlayerPosition {
            player: address,
            bitmap_hash: H256::zero(),
            stake_per_tick: U256::from(stake_per_tick),
            start_tick: 0,
            balance: U256::from(balance),
            join_timestamp,
        }
    }

    /// Store a bitmap for a player, computing the hash automatically.
    async fn store_bitmap(store: &BitmapStore, player: Address, batch_id: u64, bitmap: Vec<u8>) {
        let hash = H256::from(keccak256(&bitmap));
        store
            .store(player, batch_id, bitmap, hash)
            .await
            .expect("bitmap store should succeed");
    }

    // -------------------------------------------------------------------------
    // Test: bitmap bit extraction
    // -------------------------------------------------------------------------
    #[test]
    fn test_bitmap_bit_extraction() {
        // 0b10110000 = 0xB0 = 176
        let bitmap = vec![0b1011_0000u8];
        assert!(get_bitmap_bit(&bitmap, 0)); // bit 7 (MSB) = 1
        assert!(!get_bitmap_bit(&bitmap, 1)); // bit 6 = 0
        assert!(get_bitmap_bit(&bitmap, 2)); // bit 5 = 1
        assert!(get_bitmap_bit(&bitmap, 3)); // bit 4 = 1
        assert!(!get_bitmap_bit(&bitmap, 4)); // bit 3 = 0
        assert!(!get_bitmap_bit(&bitmap, 5)); // bit 2 = 0
        assert!(!get_bitmap_bit(&bitmap, 6)); // bit 1 = 0
        assert!(!get_bitmap_bit(&bitmap, 7)); // bit 0 = 0

        // Out of bounds returns false
        assert!(!get_bitmap_bit(&bitmap, 8));
        assert!(!get_bitmap_bit(&bitmap, 100));

        // Multi-byte: 0xFF 0x00 = all 1s then all 0s
        let bitmap2 = vec![0xFF, 0x00];
        for i in 0..8 {
            assert!(get_bitmap_bit(&bitmap2, i), "bit {i} should be 1");
        }
        for i in 8..16 {
            assert!(!get_bitmap_bit(&bitmap2, i), "bit {i} should be 0");
        }

        // Empty bitmap
        assert!(!get_bitmap_bit(&[], 0));
    }

    // -------------------------------------------------------------------------
    // Test: resolve_outcome variants
    // -------------------------------------------------------------------------
    #[test]
    fn test_resolve_outcome_up_0() {
        assert!(matches!(resolve_outcome(0.5, 0, 0.0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome(-0.5, 0, 0.0), MarketOutcome::Down));
        assert!(matches!(resolve_outcome(0.0, 0, 0.0), MarketOutcome::Flat));
    }

    #[test]
    fn test_resolve_outcome_up_30() {
        assert!(matches!(resolve_outcome(0.31, 1, 0.0), MarketOutcome::Up));
        assert!(matches!(
            resolve_outcome(-0.31, 1, 0.0),
            MarketOutcome::Down
        ));
        assert!(matches!(resolve_outcome(0.29, 1, 0.0), MarketOutcome::Flat));
        assert!(matches!(
            resolve_outcome(-0.29, 1, 0.0),
            MarketOutcome::Flat
        ));
        assert!(matches!(resolve_outcome(0.0, 1, 0.0), MarketOutcome::Flat));
    }

    #[test]
    fn test_resolve_outcome_up_x() {
        let threshold = 1.5;
        assert!(matches!(
            resolve_outcome(1.6, 2, threshold),
            MarketOutcome::Up
        ));
        assert!(matches!(
            resolve_outcome(-1.6, 2, threshold),
            MarketOutcome::Down
        ));
        assert!(matches!(
            resolve_outcome(1.4, 2, threshold),
            MarketOutcome::Flat
        ));
    }

    #[test]
    fn test_resolve_outcome_down_0() {
        // DOWN_0 is the same as UP_0 logically (just named differently)
        assert!(matches!(resolve_outcome(-0.5, 3, 0.0), MarketOutcome::Down));
        assert!(matches!(resolve_outcome(0.5, 3, 0.0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome(0.0, 3, 0.0), MarketOutcome::Flat));
    }

    #[test]
    fn test_resolve_outcome_down_30() {
        assert!(matches!(
            resolve_outcome(-0.31, 4, 0.0),
            MarketOutcome::Down
        ));
        assert!(matches!(resolve_outcome(0.31, 4, 0.0), MarketOutcome::Up));
        assert!(matches!(resolve_outcome(0.0, 4, 0.0), MarketOutcome::Flat));
    }

    #[test]
    fn test_resolve_outcome_down_x() {
        let threshold = 2.0;
        assert!(matches!(
            resolve_outcome(-2.1, 5, threshold),
            MarketOutcome::Down
        ));
        assert!(matches!(
            resolve_outcome(2.1, 5, threshold),
            MarketOutcome::Up
        ));
        assert!(matches!(
            resolve_outcome(1.9, 5, threshold),
            MarketOutcome::Flat
        ));
    }

    #[test]
    fn test_resolve_outcome_flat_0() {
        assert!(matches!(resolve_outcome(0.005, 6, 0.0), MarketOutcome::Flat));
        assert!(matches!(resolve_outcome(0.5, 6, 0.0), MarketOutcome::Up));
        assert!(matches!(
            resolve_outcome(-0.5, 6, 0.0),
            MarketOutcome::Down
        ));
    }

    #[test]
    fn test_resolve_outcome_flat_x() {
        let threshold = 0.5;
        assert!(matches!(
            resolve_outcome(0.3, 7, threshold),
            MarketOutcome::Flat
        ));
        assert!(matches!(
            resolve_outcome(0.6, 7, threshold),
            MarketOutcome::Up
        ));
        assert!(matches!(
            resolve_outcome(-0.6, 7, threshold),
            MarketOutcome::Down
        ));
    }

    #[test]
    fn test_resolve_outcome_unknown_type() {
        assert!(matches!(
            resolve_outcome(1.0, 99, 0.0),
            MarketOutcome::Cancelled
        ));
    }

    // -------------------------------------------------------------------------
    // Test: basic UP resolution with 2 players
    // -------------------------------------------------------------------------
    #[tokio::test]
    async fn test_resolve_basic_up() {
        let store = Arc::new(BitmapStore::new());
        let config = default_config();
        let resolver = TickResolver::new(store.clone(), config);

        let market_id = H256::random();
        let batch = make_batch(1, vec![market_id], vec![0], 600); // UP_0 resolution

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
        prices.insert(market_id, 100.0, 105.0, 1000);

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000)
            .await
            .expect("resolve should succeed");

        assert_eq!(result.batch_id, 1);
        assert_eq!(result.tick_id, 0);
        assert_eq!(result.market_results.len(), 1);
        assert!(result.voided_players.is_empty());

        let market = &result.market_results[0];
        assert!(matches!(market.outcome, MarketOutcome::Up));
        assert!((market.pct_change - 5.0).abs() < 0.001);

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

        let market_id = H256::random();
        let batch = make_batch(1, vec![market_id], vec![0], 600);

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
        prices.insert(market_id, 100.0, 102.0, 1000);

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000)
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

        let market_id = H256::random();
        let batch = make_batch(1, vec![market_id], vec![0], 600);

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
            .resolve_tick(&batch, 0, &players, &prices, 1000)
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

        let market_id = H256::random();
        let batch = make_batch(1, vec![market_id], vec![0], 600);

        store_bitmap(&store, addr(1), 1, vec![0b1000_0000]).await;
        store_bitmap(&store, addr(2), 1, vec![0b0000_0000]).await;

        let players = vec![
            make_player(addr(1), 1000, 100_000, 0),
            make_player(addr(2), 1000, 100_000, 0),
        ];

        // Price data is old (last_update=100, now=1000, threshold=300 -> stale)
        let mut prices = MarketPrices::new();
        prices.insert(market_id, 100.0, 105.0, 100);

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000)
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

        let market_id = H256::random();
        let batch = make_batch(1, vec![market_id], vec![0], 600);

        // All players have zero balance
        let players = vec![
            make_player(addr(1), 1000, 0, 0),
            make_player(addr(2), 1000, 0, 0),
        ];

        let prices = MarketPrices::new();

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000)
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

        let market_a = H256::random();
        let market_b = H256::random();
        let batch = make_batch(1, vec![market_a, market_b], vec![0, 0], 600);

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
        prices.insert(market_a, 100.0, 110.0, 1000); // UP 10%
        prices.insert(market_b, 100.0, 90.0, 1000); // DOWN 10%

        let result = resolver
            .resolve_tick(&batch, 0, &players, &prices, 1000)
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
    // Test: MarketPrices staleness check
    // -------------------------------------------------------------------------
    #[test]
    fn test_market_prices_staleness() {
        let mut prices = MarketPrices::new();
        let market_id = H256::random();

        // No data -> stale
        assert!(prices.is_stale(&market_id, 300, 1000));

        // Fresh data (last_update=900, now=1000, threshold=300)
        prices.insert(market_id, 100.0, 105.0, 900);
        assert!(!prices.is_stale(&market_id, 300, 1000));

        // Stale data (last_update=600, now=1000, threshold=300 -> 400 > 300)
        prices.insert(market_id, 100.0, 105.0, 600);
        assert!(prices.is_stale(&market_id, 300, 1000));

        // Exactly at threshold (last_update=700, now=1000 -> 300 == 300, not stale)
        prices.insert(market_id, 100.0, 105.0, 700);
        assert!(!prices.is_stale(&market_id, 300, 1000));
    }
}
