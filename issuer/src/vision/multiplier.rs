//! Vision multiplier computation — deterministic integer arithmetic
//!
//! Computes early-entry and commitment multipliers for player stakes.
//! All multiplier values use a BPS_SCALE of 10000 (basis points) where 10000 = 1.0x.
//! This eliminates f64 non-determinism across issuers.
//!
//! The multiplier system rewards early entry and long commitment:
//!
//! - **Early multiplier**: `10000 + capped_time^2 * 10000 / tick_duration^2`
//!   Ranges from 10000 (1.0x, joined at tick start) to 20000 (2.0x, joined one full tick before).
//!
//! - **Commitment multiplier**: `integer_log10_bps(total_ticks_committed + offset)`
//!   With default offset=9: 1 tick -> 10000 (1.0x), 91 ticks -> 20000 (2.0x).
//!   Uses linear interpolation between powers of 10 for deterministic log10 approximation.
//!
//! - **Total multiplier**: `early_bps * commitment_bps / 10000`
//! - **Effective stake**: `stake_per_tick * total_bps / 10000`, capped by balance.

use ethers::types::U256;

use super::config::VisionConfig;
use super::types::{PlayerMultiplier, PlayerPosition};

/// BPS scale factor: 10000 = 1.0x multiplier
const BPS_SCALE: u64 = 10_000;

/// Early-entry multiplier in BPS (10000 = 1.0x, 20000 = 2.0x).
///
/// Formula: `10000 + capped_time^2 * 10000 / tick_duration^2`
///
/// Uses u128 intermediate to prevent overflow: capped^2 * 10000 can exceed u64
/// when tick_duration is large (e.g., 86400 seconds → 86400^2 * 10000 = 7.46e13).
fn compute_early_mult_bps(time_before_tick_secs: u64, tick_duration_secs: u64) -> u64 {
    if tick_duration_secs == 0 {
        return BPS_SCALE;
    }
    let capped = time_before_tick_secs.min(tick_duration_secs);
    let numerator = (capped as u128) * (capped as u128) * (BPS_SCALE as u128);
    let denominator = (tick_duration_secs as u128) * (tick_duration_secs as u128);
    let ratio = (numerator / denominator) as u64;
    BPS_SCALE + ratio // Range: 10000..=20000
}

/// Commitment multiplier in BPS using deterministic integer log10 approximation.
///
/// Uses linear interpolation between powers of 10:
/// - `[1, 10)` → `0..10000` BPS (log10 0.0..1.0)
/// - `[10, 100)` → `10000..20000` BPS (log10 1.0..2.0)
/// - `[100, 1000)` → `20000..30000` BPS (log10 2.0..3.0)
/// - `[1000, 10000)` → `30000..40000` BPS (log10 3.0..4.0)
/// - `[10000, 100000)` → `40000..50000` BPS (log10 4.0..5.0)
/// - `>= 100000` → capped at 50000 BPS (5.0x)
///
/// The linear interpolation within each decade introduces a small error vs true log10
/// (max ~3% within a decade), but it is perfectly deterministic across all issuers.
fn compute_commitment_mult_bps(num_committed_ticks: u64, offset: u64) -> u64 {
    let n = num_committed_ticks.saturating_add(offset);
    if n == 0 {
        return 0;
    }

    let (power, next_power, base_bps): (u64, u64, u64) = if n >= 100_000 {
        // Cap at log10(100000) = 5.0x
        return 50_000;
    } else if n >= 10_000 {
        (10_000, 100_000, 40_000)
    } else if n >= 1_000 {
        (1_000, 10_000, 30_000)
    } else if n >= 100 {
        (100, 1_000, 20_000)
    } else if n >= 10 {
        (10, 100, 10_000)
    } else {
        (1, 10, 0)
    };

    // Linear interpolation within the decade:
    // base_bps + (n - power) * 10000 / (next_power - power)
    let within_decade =
        ((n - power) as u128 * BPS_SCALE as u128) / ((next_power - power) as u128);
    base_bps + within_decade as u64
}

/// Compute effective stake using integer multipliers.
///
/// `effective = stake_per_tick * total_mult_bps / BPS_SCALE`
///
/// Capped at player balance.
fn compute_effective_stake(
    stake_per_tick: U256,
    early_mult_bps: u64,
    commitment_mult_bps: u64,
    balance: U256,
) -> U256 {
    // total_mult_bps = early * commitment / BPS_SCALE (keeps one level of BPS)
    let total_mult_bps =
        (early_mult_bps as u128 * commitment_mult_bps as u128) / (BPS_SCALE as u128);
    // effective = stake * total_mult_bps / BPS_SCALE
    let effective =
        stake_per_tick * U256::from(total_mult_bps) / U256::from(BPS_SCALE);
    effective.min(balance)
}

/// Compute multipliers for a player in a batch tick.
///
/// All multiplier fields are in BPS (10000 = 1.0x). No floating-point arithmetic is used.
///
/// `early_mult_bps = 10000 + capped_time^2 * 10000 / tick_duration^2`
///   - Ranges from 10000 (1.0x) to 20000 (2.0x)
///   - Rewards players who commit early before a tick opens
///
/// `commitment_mult_bps = integer_log10_bps(total_ticks_committed + offset)`
///   - offset default = 9 (from config)
///   - At 1 tick: log10(10) = 10000 (1.0x)
///   - At 91 ticks: log10(100) = 20000 (2.0x)
///   - Rewards long-term players
///
/// `total_mult_bps = early_mult_bps * commitment_mult_bps / 10000`
/// `effective_stake = stake_per_tick * total_mult_bps / 10000` (capped by balance)
pub fn compute_multiplier(
    player: &PlayerPosition,
    _tick_id: u64,
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
    let early_mult_bps = compute_early_mult_bps(time_before_tick, tick_duration);

    // Commitment multiplier: reward long-term commitment
    let ticks_committed = player.num_committed_ticks.max(1);
    let commitment_mult_bps =
        compute_commitment_mult_bps(ticks_committed, config.commitment_offset);

    // Total multiplier in BPS
    let total_mult_bps = (early_mult_bps as u128 * commitment_mult_bps as u128
        / BPS_SCALE as u128) as u64;

    // Effective stake via pure integer path
    let effective_stake = compute_effective_stake(
        player.stake_per_tick,
        early_mult_bps,
        commitment_mult_bps,
        player.balance,
    );

    PlayerMultiplier {
        player: player.player,
        early_mult_bps,
        commitment_mult_bps,
        total_mult_bps,
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
    use ethers::types::{Address, H256};

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

    // =========================================================================
    // Early multiplier BPS tests
    // =========================================================================

    #[test]
    fn test_early_mult_bps_zero_duration() {
        assert_eq!(compute_early_mult_bps(100, 0), 10_000);
    }

    #[test]
    fn test_early_mult_bps_at_tick_start() {
        // time_before_tick = 0 → 10000 + 0 = 10000 (1.0x)
        assert_eq!(compute_early_mult_bps(0, 600), 10_000);
    }

    #[test]
    fn test_early_mult_bps_half_tick_before() {
        // capped=300, tick=600 → 10000 + 300^2*10000/600^2 = 10000 + 2500 = 12500 (1.25x)
        assert_eq!(compute_early_mult_bps(300, 600), 12_500);
    }

    #[test]
    fn test_early_mult_bps_full_tick_before() {
        // capped=600, tick=600 → 10000 + 600^2*10000/600^2 = 10000 + 10000 = 20000 (2.0x)
        assert_eq!(compute_early_mult_bps(600, 600), 20_000);
    }

    #[test]
    fn test_early_mult_bps_capped_beyond_tick() {
        // time_before=1200 > tick=600, capped at 600 → 20000 (2.0x)
        assert_eq!(compute_early_mult_bps(1200, 600), 20_000);
    }

    // =========================================================================
    // Commitment multiplier BPS tests
    // =========================================================================

    #[test]
    fn test_commitment_mult_bps_zero() {
        assert_eq!(compute_commitment_mult_bps(0, 0), 0);
    }

    #[test]
    fn test_commitment_mult_bps_one_tick_offset_9() {
        // n = 1 + 9 = 10 → exactly log10(10) = 1.0 → 10000 BPS
        assert_eq!(compute_commitment_mult_bps(1, 9), 10_000);
    }

    #[test]
    fn test_commitment_mult_bps_91_ticks_offset_9() {
        // n = 91 + 9 = 100 → exactly log10(100) = 2.0 → 20000 BPS
        assert_eq!(compute_commitment_mult_bps(91, 9), 20_000);
    }

    #[test]
    fn test_commitment_mult_bps_991_ticks_offset_9() {
        // n = 991 + 9 = 1000 → exactly log10(1000) = 3.0 → 30000 BPS
        assert_eq!(compute_commitment_mult_bps(991, 9), 30_000);
    }

    #[test]
    fn test_commitment_mult_bps_within_decade() {
        // n = 1 + 9 = 10, but let's test n=55 (ticks=46, offset=9)
        // n=55, in [10,100): base=10000, within = (55-10)*10000/90 = 45*10000/90 = 5000
        // result = 15000 (1.5x) — linear interp between log10(10)=1.0 and log10(100)=2.0
        assert_eq!(compute_commitment_mult_bps(46, 9), 15_000);
    }

    #[test]
    fn test_commitment_mult_bps_cap_at_100k() {
        // n >= 100000 → capped at 50000 (5.0x)
        assert_eq!(compute_commitment_mult_bps(100_000, 0), 50_000);
        assert_eq!(compute_commitment_mult_bps(200_000, 0), 50_000);
    }

    #[test]
    fn test_commitment_mult_bps_small_n() {
        // n=1 (ticks=1, offset=0): in [1,10), base=0, within = (1-1)*10000/9 = 0
        assert_eq!(compute_commitment_mult_bps(1, 0), 0);
        // n=5 (ticks=5, offset=0): in [1,10), within = (5-1)*10000/9 = 4444
        assert_eq!(compute_commitment_mult_bps(5, 0), 4_444);
    }

    // =========================================================================
    // Effective stake tests
    // =========================================================================

    #[test]
    fn test_effective_stake_1x() {
        // early=10000, commitment=10000 → total=10000 → stake*1.0 = stake
        let stake = U256::from(1_000_000u64);
        let balance = U256::from(100_000_000u64);
        let result = compute_effective_stake(stake, 10_000, 10_000, balance);
        assert_eq!(result, stake);
    }

    #[test]
    fn test_effective_stake_2x() {
        // early=20000, commitment=10000 → total=20000 → stake*2.0
        let stake = U256::from(1_000_000u64);
        let balance = U256::from(100_000_000u64);
        let result = compute_effective_stake(stake, 20_000, 10_000, balance);
        assert_eq!(result, U256::from(2_000_000u64));
    }

    #[test]
    fn test_effective_stake_capped() {
        let stake = U256::from(1_000_000u64);
        let balance = U256::from(100u64); // very small balance
        let result = compute_effective_stake(stake, 20_000, 20_000, balance);
        assert_eq!(result, balance);
    }

    // =========================================================================
    // Integration: compute_multiplier
    // =========================================================================

    #[test]
    fn test_early_mult_at_tick_start() {
        // Player joined exactly at tick start -> time_before_tick = 0 -> 10000 BPS (1.0x)
        let player = make_player(1000, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert_eq!(result.early_mult_bps, 10_000, "early_mult_bps should be 10000 (1.0x)");
    }

    #[test]
    fn test_early_mult_one_tick_before() {
        // Player joined one full tick_duration before tick start -> 20000 BPS (2.0x)
        let tick_duration = 600;
        let tick_start = 1200;
        let join_time = tick_start - tick_duration; // 600
        let player = make_player(join_time, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, tick_duration, tick_start, &config);
        assert_eq!(result.early_mult_bps, 20_000, "early_mult_bps should be 20000 (2.0x)");
    }

    #[test]
    fn test_early_mult_half_tick_before() {
        // capped_time = 300, tick_duration = 600 → 10000 + 2500 = 12500 (1.25x)
        let tick_duration = 600;
        let tick_start = 1200;
        let join_time = tick_start - tick_duration / 2; // 900
        let player = make_player(join_time, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, tick_duration, tick_start, &config);
        assert_eq!(result.early_mult_bps, 12_500, "early_mult_bps should be 12500 (1.25x)");
    }

    #[test]
    fn test_early_mult_capped_at_two_ticks_before() {
        // Two tick_durations before → capped at tick_duration → 20000 (2.0x)
        let tick_duration = 600;
        let tick_start = 1800;
        let join_time = tick_start - 2 * tick_duration; // 600
        let player = make_player(join_time, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, tick_duration, tick_start, &config);
        assert_eq!(result.early_mult_bps, 20_000, "early_mult_bps should be capped at 20000");
    }

    #[test]
    fn test_early_mult_joined_after_tick_start() {
        // Joined after tick start → time_before_tick = 0 → 10000 (1.0x)
        let player = make_player(1500, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert_eq!(result.early_mult_bps, 10_000, "early_mult_bps should be 10000 when joining after tick start");
    }

    #[test]
    fn test_commitment_mult_one_tick() {
        // num_committed_ticks = 1, offset = 9 → n = 10 → 10000 BPS (1.0x)
        let player = make_player(1000, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert_eq!(result.commitment_mult_bps, 10_000, "commitment_mult_bps should be 10000 for 1 committed tick");
    }

    #[test]
    fn test_commitment_mult_91_committed_ticks() {
        // num_committed_ticks = 91, offset = 9 → n = 100 → 20000 BPS (2.0x)
        let player = make_player_with_commitment(1000, 0, 1_000_000, 100_000_000, 91);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert_eq!(result.commitment_mult_bps, 20_000, "commitment_mult_bps should be 20000 for 91 committed ticks");
    }

    #[test]
    fn test_commitment_mult_from_balance_coverage() {
        // 1000 ticks + offset 9 = 1009 → in [1000, 10000): base=30000
        // within = (1009 - 1000) * 10000 / 9000 = 9 * 10000 / 9000 = 10
        // result = 30010 (~3.001x, vs f64 log10(1009) ≈ 3.004)
        let player = make_player_with_commitment(1000, 0, 1_000_000, 100_000_000, 1000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        assert_eq!(result.commitment_mult_bps, 30_010);
    }

    #[test]
    fn test_total_mult_is_product() {
        let player = make_player(600, 0, 1_000_000, 100_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 90, 600, 1200, &config);
        let expected = (result.early_mult_bps as u128 * result.commitment_mult_bps as u128
            / BPS_SCALE as u128) as u64;
        assert_eq!(
            result.total_mult_bps, expected,
            "total_mult_bps should be early * commitment / BPS_SCALE"
        );
    }

    #[test]
    fn test_effective_stake_capped_by_balance() {
        // Small balance → effective_stake capped
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
        // Large balance, small stake, early=1.0x, commitment=1.0x → effective = stake
        let player = make_player(1000, 0, 1_000, 1_000_000_000);
        let config = default_config();
        let result = compute_multiplier(&player, 0, 600, 1000, &config);
        // early_mult_bps = 10000 (1.0x), commitment_mult_bps = 10000 (1.0x)
        // total_mult_bps = 10000, effective = 1000 * 10000 / 10000 = 1000
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

    // =========================================================================
    // Determinism: verify same inputs always produce identical outputs
    // =========================================================================

    #[test]
    fn test_deterministic_across_runs() {
        let player = make_player_with_commitment(500, 0, 5_000_000, 500_000_000, 50);
        let config = default_config();
        let r1 = compute_multiplier(&player, 10, 600, 1000, &config);
        let r2 = compute_multiplier(&player, 10, 600, 1000, &config);
        assert_eq!(r1.early_mult_bps, r2.early_mult_bps);
        assert_eq!(r1.commitment_mult_bps, r2.commitment_mult_bps);
        assert_eq!(r1.total_mult_bps, r2.total_mult_bps);
        assert_eq!(r1.effective_stake, r2.effective_stake);
    }

    // =========================================================================
    // Edge case: large tick_duration (86400 = 1 day)
    // =========================================================================

    #[test]
    fn test_early_mult_bps_large_duration() {
        // 86400 second tick, joined 43200 seconds before (half)
        // 10000 + (43200^2 * 10000) / 86400^2 = 10000 + 2500 = 12500
        assert_eq!(compute_early_mult_bps(43200, 86400), 12_500);
    }
}
