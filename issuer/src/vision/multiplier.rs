//! Vision multiplier computation
//!
//! Computes early-entry and commitment multipliers for player stakes.
//!
//! The multiplier system rewards early entry and long commitment:
//!
//! - **Early multiplier**: `1 + min(time_before_tick, tick_duration)^2 / tick_duration^2`
//!   Ranges from 1.0 (joined at tick start) to 2.0 (joined one full tick before).
//!
//! - **Commitment multiplier**: `log10(total_ticks_committed + offset)`
//!   With default offset=9: 1 tick -> 1.0, 91 ticks -> 2.0.
//!
//! - **Total multiplier**: `early_mult * commitment_mult`
//! - **Effective stake**: `stake_per_tick * total_mult`, capped by balance.

use ethers::types::{Address, U256};

use super::config::VisionConfig;
use super::types::{PlayerMultiplier, PlayerPosition};

/// Compute multipliers for a player in a batch tick.
///
/// `early_mult = 1 + min(time_before_tick, tick_duration)^2 / tick_duration^2`
///   - Ranges from 1.0 (joined at tick start) to 2.0 (joined one full tick before)
///   - Rewards players who commit early before a tick opens
///
/// `commitment_mult = log10(total_ticks_committed + offset)`
///   - offset default = 9 (from config)
///   - At 1 tick: log10(10) = 1.0
///   - At 91 ticks: log10(100) = 2.0
///   - Rewards long-term players
///
/// `total_mult = early_mult * commitment_mult`
/// `effective_stake = stake_per_tick * total_mult` (capped by balance)
pub fn compute_multiplier(
    player: &PlayerPosition,
    tick_id: u64,
    tick_duration: u64,
    tick_start_time: u64,
    config: &VisionConfig,
) -> PlayerMultiplier {
    // Early multiplier: reward joining before the tick opens
    let time_before_tick = if player.join_timestamp < tick_start_time {
        tick_start_time - player.join_timestamp
    } else {
        0
    };
    let capped_time = time_before_tick.min(tick_duration);
    let early_mult = 1.0 + (capped_time as f64).powi(2) / (tick_duration as f64).powi(2);

    // Commitment multiplier: reward long-term commitment (from balance coverage: balance / stake_per_tick)
    let ticks_committed = player.num_committed_ticks.max(1);
    let commitment_mult = ((ticks_committed + config.commitment_offset) as f64).log10();

    // Total multiplier
    let total_mult = early_mult * commitment_mult;

    // Effective stake (in raw U256)
    let stake_f64 = player.stake_per_tick.as_u128() as f64;
    let effective_f64 = stake_f64 * total_mult;
    let effective_stake = U256::from(effective_f64 as u128);

    // Cap effective stake by balance
    let effective_stake = if effective_stake > player.balance {
        player.balance
    } else {
        effective_stake
    };

    PlayerMultiplier {
        player: player.player,
        early_mult,
        commitment_mult,
        total_mult,
        effective_stake,
    }
}

/// Compute multipliers for all active players in a batch.
///
/// Filters out zero-balance players before computing.
pub fn compute_all_multipliers(
    players: &[PlayerPosition],
    tick_id: u64,
    tick_duration: u64,
    tick_start_time: u64,
    config: &VisionConfig,
) -> Vec<PlayerMultiplier> {
    players
        .iter()
        .filter(|p| !p.balance.is_zero())
        .map(|p| compute_multiplier(p, tick_id, tick_duration, tick_start_time, config))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::H256;

    fn make_player(
        join_timestamp: u64,
        start_tick: u64,
        stake_per_tick: u128,
        balance: u128,
    ) -> PlayerPosition {
        make_player_with_commitment(join_timestamp, start_tick, stake_per_tick, balance, 1)
    }

    fn make_player_with_commitment(
        join_timestamp: u64,
        start_tick: u64,
        stake_per_tick: u128,
        balance: u128,
        num_committed_ticks: u64,
    ) -> PlayerPosition {
        PlayerPosition {
            player: Address::zero(),
            bitmap_hash: H256::zero(),
            stake_per_tick: U256::from(stake_per_tick),
            start_tick,
            balance: U256::from(balance),
            initial_deposit: U256::from(balance),
            join_timestamp,
            num_committed_ticks,
        }
    }

    fn default_config() -> VisionConfig {
        VisionConfig::default() // commitment_offset = 9
    }

    #[test]
    fn test_early_mult_at_tick_start() {
        // Player joined exactly at tick start -> time_before_tick = 0 -> early_mult = 1.0
        let player = make_player(1000, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert!(
            (result.early_mult - 1.0).abs() < 1e-10,
            "early_mult should be 1.0, got {}",
            result.early_mult
        );
    }

    #[test]
    fn test_early_mult_one_tick_before() {
        // Player joined one full tick_duration before tick start -> early_mult = 2.0
        let tick_duration = 600;
        let tick_start = 1200;
        let join_time = tick_start - tick_duration; // 600
        let player = make_player(join_time, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, tick_duration, tick_start, &config);
        assert!(
            (result.early_mult - 2.0).abs() < 1e-10,
            "early_mult should be 2.0, got {}",
            result.early_mult
        );
    }

    #[test]
    fn test_early_mult_half_tick_before() {
        // Player joined half a tick_duration before -> capped_time = tick_duration/2
        // early_mult = 1 + (300^2 / 600^2) = 1 + 0.25 = 1.25
        let tick_duration = 600;
        let tick_start = 1200;
        let join_time = tick_start - tick_duration / 2; // 900
        let player = make_player(join_time, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, tick_duration, tick_start, &config);
        assert!(
            (result.early_mult - 1.25).abs() < 1e-10,
            "early_mult should be 1.25, got {}",
            result.early_mult
        );
    }

    #[test]
    fn test_early_mult_capped_at_two_ticks_before() {
        // Player joined two tick_durations before -> capped at tick_duration -> early_mult = 2.0
        let tick_duration = 600;
        let tick_start = 1800;
        let join_time = tick_start - 2 * tick_duration; // 600
        let player = make_player(join_time, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, tick_duration, tick_start, &config);
        assert!(
            (result.early_mult - 2.0).abs() < 1e-10,
            "early_mult should be capped at 2.0, got {}",
            result.early_mult
        );
    }

    #[test]
    fn test_early_mult_joined_after_tick_start() {
        // Player joined after tick start -> time_before_tick = 0 -> early_mult = 1.0
        let player = make_player(1500, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert!(
            (result.early_mult - 1.0).abs() < 1e-10,
            "early_mult should be 1.0 when joining after tick start, got {}",
            result.early_mult
        );
    }

    #[test]
    fn test_commitment_mult_one_tick() {
        // num_committed_ticks = 1
        // commitment_mult = log10(1 + 9) = log10(10) = 1.0
        let player = make_player(1000, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert!(
            (result.commitment_mult - 1.0).abs() < 1e-10,
            "commitment_mult should be 1.0 for 1 committed tick, got {}",
            result.commitment_mult
        );
    }

    #[test]
    fn test_commitment_mult_91_committed_ticks() {
        // num_committed_ticks = 91
        // commitment_mult = log10(91 + 9) = log10(100) = 2.0
        let player = make_player_with_commitment(1000, 0, 1_000_000, 100_000_000, 91);
        let config = default_config();
        // tick_id doesn't matter for commitment_mult anymore
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert!(
            (result.commitment_mult - 2.0).abs() < 1e-10,
            "commitment_mult should be 2.0 for 91 committed ticks, got {}",
            result.commitment_mult
        );
    }

    #[test]
    fn test_commitment_mult_from_balance_coverage() {
        // Player committed to 1000 ticks upfront → log10(1000 + 9) = log10(1009) ≈ 3.0
        let player = make_player_with_commitment(1000, 0, 1_000_000, 100_000_000, 1000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        let expected = (1009.0_f64).log10(); // ≈ 3.004
        assert!(
            (result.commitment_mult - expected).abs() < 1e-10,
            "commitment_mult should be ~3.0 for 1000 committed ticks, got {}",
            result.commitment_mult
        );
    }

    #[test]
    fn test_total_mult_is_product() {
        let player = make_player(600, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 90, 600, 1200, &config);
        let expected = result.early_mult * result.commitment_mult;
        assert!(
            (result.total_mult - expected).abs() < 1e-10,
            "total_mult should be early * commitment"
        );
    }

    #[test]
    fn test_effective_stake_capped_by_balance() {
        // Set a very small balance so effective_stake gets capped
        let player = make_player(0, 0, 1_000_000, 100); // balance = 100
        let config = default_config();
        let result = compute_multiplier(&player, 90, 600, 600, &config);
        assert_eq!(
            result.effective_stake,
            U256::from(100),
            "effective_stake should be capped by balance"
        );
    }

    #[test]
    fn test_effective_stake_not_capped_when_balance_sufficient() {
        // Large balance, small stake
        let player = make_player(1000, 0, 1_000, 1_000_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        // early_mult = 1.0, commitment_mult = 1.0 -> total_mult = 1.0
        // effective_stake = 1_000 * 1.0 = 1_000
        assert_eq!(
            result.effective_stake,
            U256::from(1_000),
            "effective_stake should not be capped"
        );
    }

    #[test]
    fn test_zero_balance_excluded() {
        let players = vec![
            make_player(1000, 0, 1_000_000, 100_000_000), // active
            make_player(1000, 0, 1_000_000, 0),           // zero balance
            make_player(1000, 0, 1_000_000, 50_000_000),  // active
        ];
        let config = default_config();
        let results = compute_all_multipliers(&players, 0, 600, 1000, &config);
        assert_eq!(
            results.len(),
            2,
            "zero-balance player should be filtered out"
        );
    }

    #[test]
    fn test_compute_all_multipliers_empty() {
        let config = default_config();
        let results = compute_all_multipliers(&[], 0, 600, 1000, &config);
        assert!(results.is_empty(), "empty input should return empty output");
    }
}
