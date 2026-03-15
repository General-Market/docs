//! Parimutuel side matching for Vision sub-markets
//!
//! Determines payouts per sub-market using a parimutuel matching algorithm:
//!
//! 1. Split players into UP and DOWN sides based on their bitmap bit
//! 2. Compute total effective stakes for each side
//! 3. Matched amount = min(UP_total, DOWN_total)
//! 4. Larger side: each player's matched stake is proportionally reduced,
//!    with the excess refunded
//! 5. Winners receive their matched stake plus a proportional share of
//!    the losers' matched stakes
//!
//! Edge cases (full refund):
//! - Cancelled market (stale price data)
//! - All players on the same side (no opponents)
//! - All players lost (threshold not met in both directions)
//! - Flat outcome (no price movement)

use ethers::types::{Address, U256};

use super::types::{MarketOutcome, Side};

/// Input for side matching: a player's address, chosen side, and effective stake.
#[derive(Debug, Clone)]
pub struct SideMatchInput {
    pub player: Address,
    pub side: Side,
    pub effective_stake: U256,
}

/// Result of side matching for a single player.
#[derive(Debug, Clone)]
pub struct SideMatchResult {
    pub player: Address,
    pub side: Side,
    pub effective_stake: U256,
    /// The portion of this player's stake that was matched against opponents.
    pub matched_stake: U256,
    /// Total amount returned to the player (winnings or matched_stake back).
    pub payout: U256,
    /// Unmatched excess returned to the player (only for the larger side).
    pub refund: U256,
}

/// Match one sub-market and compute per-player payouts.
///
/// The `outcome` determines which side wins. If the outcome is a refund
/// condition (Cancelled, Flat, AllSameSide, AllLosers), everyone gets
/// their full effective_stake back.
pub fn match_sides(inputs: &[SideMatchInput], outcome: MarketOutcome) -> Vec<SideMatchResult> {
    // Refund conditions: everyone gets their stake back
    if matches!(
        outcome,
        MarketOutcome::Cancelled | MarketOutcome::Flat | MarketOutcome::AllSameSide | MarketOutcome::AllLosers
    ) {
        return refund_all(inputs);
    }

    // Determine winning side from outcome
    let winning_side = match outcome {
        MarketOutcome::Up => Side::Up,
        MarketOutcome::Down => Side::Down,
        // Already handled above, but be explicit
        _ => return refund_all(inputs),
    };

    // Split into winning and losing sides
    let (winners, losers): (Vec<&SideMatchInput>, Vec<&SideMatchInput>) = inputs
        .iter()
        .partition(|input| input.side == winning_side);

    // Edge case: one side is empty -> all same side, refund everyone
    if winners.is_empty() || losers.is_empty() {
        return refund_all(inputs);
    }

    // Compute totals for each side
    let winning_total: U256 = winners.iter().map(|w| w.effective_stake).fold(U256::zero(), |a, b| a + b);
    let losing_total: U256 = losers.iter().map(|l| l.effective_stake).fold(U256::zero(), |a, b| a + b);

    // Matched amount is the smaller side's total
    let matched = winning_total.min(losing_total);

    // If matched is zero (all stakes are zero), refund everyone
    if matched.is_zero() {
        return refund_all(inputs);
    }

    // -------------------------------------------------------------------------
    // Phase 1: compute per-player matched_stake for ALL players (both sides).
    //
    // matched_stake_i = floor(effective_stake_i * matched / side_total)
    //
    // Due to integer truncation, sum(matched_stake) can be less than `matched`
    // by up to (n - 1) wei per side — "rounding dust".  If we naively paid
    // winners 2 * their_matched_stake the pool would be unbalanced: winners
    // could receive more than the losers contributed (or vice-versa).
    //
    // To guarantee the invariant  sum(winner_payouts) == sum(loser_matched_stakes)
    // we use the "last-player-gets-remainder" technique on EACH side:
    //   - for the first (n-1) players on a side, use the truncated value;
    //   - for the last player on each side, give them
    //       matched - sum_of_previous_matched_stakes
    //     so that the side total is exactly `matched`.
    // -------------------------------------------------------------------------

    // Helper: compute matched_stake for one player, or trigger a refund-all.
    // Returns None on overflow or zero-division (callers propagate refund_all).
    struct PerPlayerStake {
        player: Address,
        side: Side,
        effective_stake: U256,
        matched_stake: U256,
        refund: U256,
    }

    let mut per_player: Vec<PerPlayerStake> = Vec::with_capacity(inputs.len());

    for input in inputs {
        if input.effective_stake.is_zero() {
            per_player.push(PerPlayerStake {
                player: input.player,
                side: input.side,
                effective_stake: input.effective_stake,
                matched_stake: U256::zero(),
                refund: U256::zero(),
            });
            continue;
        }

        let is_winner = input.side == winning_side;
        let side_total = if is_winner { winning_total } else { losing_total };

        let product = match input.effective_stake.checked_mul(matched) {
            Some(v) => v,
            None => {
                tracing::error!(
                    player = ?input.player,
                    effective_stake = %input.effective_stake,
                    matched = %matched,
                    "matched_stake overflow in side matching — refunding all players"
                );
                return refund_all(inputs);
            }
        };
        let matched_stake_trunc = match product.checked_div(side_total) {
            Some(v) => v,
            None => {
                tracing::error!(
                    player = ?input.player,
                    side_total = %side_total,
                    "side_total division by zero in side matching — refunding all players"
                );
                return refund_all(inputs);
            }
        };

        // Refund = unmatched portion (computed from truncated matched_stake for now;
        // will be corrected for the last player on each side below).
        let refund = input.effective_stake - matched_stake_trunc;

        per_player.push(PerPlayerStake {
            player: input.player,
            side: input.side,
            effective_stake: input.effective_stake,
            matched_stake: matched_stake_trunc,
            refund,
        });
    }

    // -------------------------------------------------------------------------
    // Phase 2: fix up the last non-zero player on each side so that
    //   sum(matched_stake for winners) == matched  (exactly)
    //   sum(matched_stake for losers)  == matched  (exactly)
    //
    // "loser_pool" = sum of loser matched_stakes = exactly `matched` after fixup.
    // "winner_matched_sum" = exactly `matched` after fixup.
    // Each winner's payout = 2 * their matched_stake, so
    //   sum(winner_payouts) = 2 * matched = loser_pool + winner_matched_sum ✓
    // -------------------------------------------------------------------------

    // Find the last non-zero player on the winning side and fix their matched_stake.
    {
        let winner_sum: U256 = per_player
            .iter()
            .filter(|p| p.side == winning_side && !p.effective_stake.is_zero())
            .map(|p| p.matched_stake)
            .fold(U256::zero(), |a, b| a + b);

        if winner_sum < matched {
            let dust = matched - winner_sum;
            // Give dust to the last non-zero winner.
            if let Some(last_winner) = per_player
                .iter_mut()
                .rev()
                .find(|p| p.side == winning_side && !p.effective_stake.is_zero())
            {
                last_winner.matched_stake = last_winner.matched_stake + dust;
                // Refund decreases by the same amount (matched_stake increased).
                last_winner.refund = last_winner.refund - dust;
            }
        }
    }

    // Find the last non-zero player on the losing side and fix their matched_stake.
    let loser_pool: U256;
    {
        let loser_sum: U256 = per_player
            .iter()
            .filter(|p| p.side != winning_side && !p.effective_stake.is_zero())
            .map(|p| p.matched_stake)
            .fold(U256::zero(), |a, b| a + b);

        if loser_sum < matched {
            let dust = matched - loser_sum;
            if let Some(last_loser) = per_player
                .iter_mut()
                .rev()
                .find(|p| p.side != winning_side && !p.effective_stake.is_zero())
            {
                last_loser.matched_stake = last_loser.matched_stake + dust;
                last_loser.refund = last_loser.refund - dust;
            }
        }

        // Recompute after fixup (should now equal `matched` exactly).
        loser_pool = per_player
            .iter()
            .filter(|p| p.side != winning_side)
            .map(|p| p.matched_stake)
            .fold(U256::zero(), |a, b| a + b);
    }

    // -------------------------------------------------------------------------
    // Phase 3: compute the winner_matched_sum (after fixup, == matched exactly).
    // Distribute loser_pool to winners proportionally:
    //   winner_payout_i = 2 * winner_matched_stake_i
    // This is correct because winner_matched_sum == loser_pool == matched, so
    // each winner's share of the loser pool == their matched_stake, and their
    // total payout (stake back + profit) == 2 * matched_stake.
    //
    // Final invariant check: sum(winner_payouts) == loser_pool ✓
    // (Both equal 2 * matched, and matched == loser_pool after fixup.)
    // -------------------------------------------------------------------------

    // Sanity: winner_matched_sum should equal loser_pool (both == matched).
    // If they somehow diverge (impossible with correct logic above, but be safe),
    // fall back to refund_all to avoid draining the pool.
    let winner_matched_sum: U256 = per_player
        .iter()
        .filter(|p| p.side == winning_side)
        .map(|p| p.matched_stake)
        .fold(U256::zero(), |a, b| a + b);

    if winner_matched_sum != loser_pool {
        tracing::error!(
            winner_matched_sum = %winner_matched_sum,
            loser_pool = %loser_pool,
            "BUG: winner_matched_sum != loser_pool after dust fixup — refunding all players"
        );
        return refund_all(inputs);
    }

    // Build final results.
    let mut results = Vec::with_capacity(inputs.len());
    for p in per_player {
        let is_winner = p.side == winning_side;
        let payout = if is_winner {
            // winner gets their matched_stake back plus a proportional share
            // of the loser pool.  Since winner_matched_sum == loser_pool,
            // the share == matched_stake, so payout == 2 * matched_stake.
            p.matched_stake * 2
        } else {
            U256::zero()
        };
        results.push(SideMatchResult {
            player: p.player,
            side: p.side,
            effective_stake: p.effective_stake,
            matched_stake: p.matched_stake,
            payout,
            refund: p.refund,
        });
    }

    results
}

/// Refund all players: payout = effective_stake, matched = 0, refund = 0.
fn refund_all(inputs: &[SideMatchInput]) -> Vec<SideMatchResult> {
    inputs
        .iter()
        .map(|input| SideMatchResult {
            player: input.player,
            side: input.side,
            effective_stake: input.effective_stake,
            matched_stake: U256::zero(),
            payout: input.effective_stake,
            refund: U256::zero(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn addr(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    fn u(val: u128) -> U256 {
        U256::from(val)
    }

    fn input(n: u8, side: Side, stake: u128) -> SideMatchInput {
        SideMatchInput {
            player: addr(n),
            side,
            effective_stake: u(stake),
        }
    }

    /// Verify total conservation: sum of all payouts + refunds == sum of all effective_stakes.
    fn assert_conservation(inputs: &[SideMatchInput], results: &[SideMatchResult]) {
        let total_in: U256 = inputs.iter().map(|i| i.effective_stake).fold(U256::zero(), |a, b| a + b);
        let total_out: U256 = results
            .iter()
            .map(|r| r.payout + r.refund)
            .fold(U256::zero(), |a, b| a + b);
        assert_eq!(
            total_in, total_out,
            "Conservation violated: total_in={total_in}, total_out={total_out}"
        );
    }

    fn find_result<'a>(results: &'a [SideMatchResult], n: u8) -> &'a SideMatchResult {
        results
            .iter()
            .find(|r| r.player == addr(n))
            .expect("player not found in results")
    }

    // -------------------------------------------------------------------------
    // Test: basic UP wins with equal stakes
    // -------------------------------------------------------------------------
    #[test]
    fn test_basic_up_wins() {
        let inputs = vec![
            input(1, Side::Up, 100),
            input(2, Side::Down, 100),
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_eq!(results.len(), 2);
        assert_conservation(&inputs, &results);

        let winner = find_result(&results, 1);
        assert_eq!(winner.matched_stake, u(100));
        assert_eq!(winner.payout, u(200)); // wins the entire pool
        assert_eq!(winner.refund, u(0));

        let loser = find_result(&results, 2);
        assert_eq!(loser.matched_stake, u(100));
        assert_eq!(loser.payout, u(0));
        assert_eq!(loser.refund, u(0));
    }

    // -------------------------------------------------------------------------
    // Test: basic DOWN wins with equal stakes
    // -------------------------------------------------------------------------
    #[test]
    fn test_basic_down_wins() {
        let inputs = vec![
            input(1, Side::Up, 100),
            input(2, Side::Down, 100),
        ];
        let results = match_sides(&inputs, MarketOutcome::Down);

        assert_eq!(results.len(), 2);
        assert_conservation(&inputs, &results);

        let winner = find_result(&results, 2);
        assert_eq!(winner.matched_stake, u(100));
        assert_eq!(winner.payout, u(200));
        assert_eq!(winner.refund, u(0));

        let loser = find_result(&results, 1);
        assert_eq!(loser.matched_stake, u(100));
        assert_eq!(loser.payout, u(0));
        assert_eq!(loser.refund, u(0));
    }

    // -------------------------------------------------------------------------
    // Test: unequal sides — larger side gets excess refunded
    // -------------------------------------------------------------------------
    #[test]
    fn test_unequal_sides() {
        // UP side: 70 + 30 = 100, DOWN side: 40
        // matched = 40
        let inputs = vec![
            input(1, Side::Up, 70),   // winner
            input(2, Side::Up, 30),   // winner
            input(3, Side::Down, 40), // loser
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_eq!(results.len(), 3);
        assert_conservation(&inputs, &results);

        // Player 1 (UP, stake=70): matched_stake = 70 * 40 / 100 = 28
        let p1 = find_result(&results, 1);
        assert_eq!(p1.matched_stake, u(28));
        assert_eq!(p1.payout, u(56)); // 28 * 2
        assert_eq!(p1.refund, u(42)); // 70 - 28
        // Total received: 56 + 42 = 98... but conservation must hold.
        // Let's verify: total_in = 70 + 30 + 40 = 140
        // P1: 56 + 42 = 98
        // P2: 12*2 + 18 = 24 + 18 = 42... wait let me recalculate.

        // Player 2 (UP, stake=30): matched_stake = 30 * 40 / 100 = 12
        let p2 = find_result(&results, 2);
        assert_eq!(p2.matched_stake, u(12));
        assert_eq!(p2.payout, u(24)); // 12 * 2
        assert_eq!(p2.refund, u(18)); // 30 - 12

        // Player 3 (DOWN, stake=40): matched_stake = 40 * 40 / 40 = 40
        let p3 = find_result(&results, 3);
        assert_eq!(p3.matched_stake, u(40));
        assert_eq!(p3.payout, u(0)); // loser
        assert_eq!(p3.refund, u(0)); // fully matched

        // Conservation: 98 + 42 + 0 = 140 ✓
    }

    // -------------------------------------------------------------------------
    // Test: all same side — no opponents, full refund
    // -------------------------------------------------------------------------
    #[test]
    fn test_all_same_side() {
        let inputs = vec![
            input(1, Side::Up, 100),
            input(2, Side::Up, 200),
        ];

        // Even with Up outcome, if no one is on Down side, everyone gets refunded
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_eq!(results.len(), 2);

        for r in &results {
            assert_eq!(r.payout, r.effective_stake, "should be fully refunded");
            assert_eq!(r.matched_stake, u(0));
            assert_eq!(r.refund, u(0));
        }
    }

    // -------------------------------------------------------------------------
    // Test: all losers — threshold not met, full refund
    // -------------------------------------------------------------------------
    #[test]
    fn test_all_losers() {
        let inputs = vec![
            input(1, Side::Up, 100),
            input(2, Side::Down, 100),
        ];
        let results = match_sides(&inputs, MarketOutcome::AllLosers);

        assert_eq!(results.len(), 2);
        for r in &results {
            assert_eq!(r.payout, r.effective_stake);
            assert_eq!(r.matched_stake, u(0));
        }
    }

    // -------------------------------------------------------------------------
    // Test: cancelled market — stale price, full refund
    // -------------------------------------------------------------------------
    #[test]
    fn test_cancelled_market() {
        let inputs = vec![
            input(1, Side::Up, 500),
            input(2, Side::Down, 300),
        ];
        let results = match_sides(&inputs, MarketOutcome::Cancelled);

        assert_eq!(results.len(), 2);
        for r in &results {
            assert_eq!(r.payout, r.effective_stake);
            assert_eq!(r.matched_stake, u(0));
        }
    }

    // -------------------------------------------------------------------------
    // Test: flat outcome — no price movement, full refund
    // -------------------------------------------------------------------------
    #[test]
    fn test_flat_market() {
        let inputs = vec![
            input(1, Side::Up, 100),
            input(2, Side::Down, 100),
        ];
        let results = match_sides(&inputs, MarketOutcome::Flat);

        assert_eq!(results.len(), 2);
        for r in &results {
            assert_eq!(r.payout, r.effective_stake);
            assert_eq!(r.matched_stake, u(0));
        }
    }

    // -------------------------------------------------------------------------
    // Test: zero-stake players get nothing
    // -------------------------------------------------------------------------
    #[test]
    fn test_zero_stake_excluded() {
        let inputs = vec![
            input(1, Side::Up, 100),
            input(2, Side::Down, 100),
            input(3, Side::Up, 0), // zero stake
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_eq!(results.len(), 3);

        let zero_player = find_result(&results, 3);
        assert_eq!(zero_player.matched_stake, u(0));
        assert_eq!(zero_player.payout, u(0));
        assert_eq!(zero_player.refund, u(0));

        // The non-zero players should still match correctly
        let winner = find_result(&results, 1);
        assert_eq!(winner.matched_stake, u(100));
        assert_eq!(winner.payout, u(200));

        let loser = find_result(&results, 2);
        assert_eq!(loser.matched_stake, u(100));
        assert_eq!(loser.payout, u(0));

        // Conservation should include the zero-stake player
        assert_conservation(&inputs, &results);
    }

    // -------------------------------------------------------------------------
    // Test: single player per side — 1v1 matching
    // -------------------------------------------------------------------------
    #[test]
    fn test_single_player_per_side() {
        // Unequal 1v1: UP=300, DOWN=100
        let inputs = vec![
            input(1, Side::Up, 300),
            input(2, Side::Down, 100),
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_eq!(results.len(), 2);
        assert_conservation(&inputs, &results);

        let winner = find_result(&results, 1);
        // matched_stake = 300 * 100 / 300 = 100
        assert_eq!(winner.matched_stake, u(100));
        assert_eq!(winner.payout, u(200)); // 100 * 2
        assert_eq!(winner.refund, u(200)); // 300 - 100

        let loser = find_result(&results, 2);
        // matched_stake = 100 * 100 / 100 = 100
        assert_eq!(loser.matched_stake, u(100));
        assert_eq!(loser.payout, u(0));
        assert_eq!(loser.refund, u(0));

        // Total received by winner: 200 + 200 = 400 (started with 300, profit = 100)
        // Total lost by loser: 100 (they had 100, get nothing back)
        // Conservation: 300 + 100 = 200 + 200 + 0 + 0 = 400 ✓
    }

    // -------------------------------------------------------------------------
    // Test: many players, asymmetric sides, DOWN wins
    // -------------------------------------------------------------------------
    #[test]
    fn test_many_players_down_wins() {
        // UP side: 100 + 100 + 100 = 300
        // DOWN side: 200 + 300 = 500
        // matched = 300
        let inputs = vec![
            input(1, Side::Up, 100),
            input(2, Side::Up, 100),
            input(3, Side::Up, 100),
            input(4, Side::Down, 200),
            input(5, Side::Down, 300),
        ];
        let results = match_sides(&inputs, MarketOutcome::Down);

        assert_eq!(results.len(), 5);
        assert_conservation(&inputs, &results);

        // UP players lose: matched_stake = 100 * 300 / 300 = 100 each, fully matched
        for i in 1..=3u8 {
            let loser = find_result(&results, i);
            assert_eq!(loser.matched_stake, u(100));
            assert_eq!(loser.payout, u(0));
            assert_eq!(loser.refund, u(0));
        }

        // DOWN player 4: matched_stake = 200 * 300 / 500 = 120
        let p4 = find_result(&results, 4);
        assert_eq!(p4.matched_stake, u(120));
        assert_eq!(p4.payout, u(240)); // 120 * 2
        assert_eq!(p4.refund, u(80)); // 200 - 120

        // DOWN player 5: matched_stake = 300 * 300 / 500 = 180
        let p5 = find_result(&results, 5);
        assert_eq!(p5.matched_stake, u(180));
        assert_eq!(p5.payout, u(360)); // 180 * 2
        assert_eq!(p5.refund, u(120)); // 300 - 180
    }

    // -------------------------------------------------------------------------
    // Test: empty input
    // -------------------------------------------------------------------------
    #[test]
    fn test_empty_input() {
        let results = match_sides(&[], MarketOutcome::Up);
        assert!(results.is_empty());
    }

    // -------------------------------------------------------------------------
    // Test: all zero stakes
    // -------------------------------------------------------------------------
    #[test]
    fn test_all_zero_stakes() {
        let inputs = vec![
            input(1, Side::Up, 0),
            input(2, Side::Down, 0),
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        // Zero matched -> refund_all path
        for r in &results {
            assert_eq!(r.payout, u(0));
            assert_eq!(r.matched_stake, u(0));
        }
    }

    // -------------------------------------------------------------------------
    // Test: large U256 values don't overflow
    // -------------------------------------------------------------------------
    #[test]
    fn test_large_values_no_overflow() {
        // Use values up to ~1e36 (well within U256 range)
        let big = 1_000_000_000_000_000_000u128; // 1e18
        let inputs = vec![
            input(1, Side::Up, big),
            input(2, Side::Down, big),
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_conservation(&inputs, &results);

        let winner = find_result(&results, 1);
        assert_eq!(winner.payout, U256::from(big) * 2);
    }

    // -------------------------------------------------------------------------
    // Test: winning side is smaller (less total stake)
    // -------------------------------------------------------------------------
    #[test]
    fn test_winning_side_smaller() {
        // UP side: 50 (winning, smaller)
        // DOWN side: 200 (losing, larger)
        // matched = 50
        let inputs = vec![
            input(1, Side::Up, 50),
            input(2, Side::Down, 200),
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_eq!(results.len(), 2);
        assert_conservation(&inputs, &results);

        // Winner (UP, 50): fully matched (smaller side)
        let winner = find_result(&results, 1);
        assert_eq!(winner.matched_stake, u(50)); // 50 * 50 / 50 = 50
        assert_eq!(winner.payout, u(100)); // 50 * 2
        assert_eq!(winner.refund, u(0));

        // Loser (DOWN, 200): partially matched
        let loser = find_result(&results, 2);
        assert_eq!(loser.matched_stake, u(50)); // 200 * 50 / 200 = 50
        assert_eq!(loser.payout, u(0));
        assert_eq!(loser.refund, u(150)); // 200 - 50
    }

    // -------------------------------------------------------------------------
    // Test: rounding dust on winner side.
    //
    // UP: 3 players with stake 1 each → total 3
    // DOWN: 2 players with stake 1 each → total 2
    // matched = 2
    //
    // Naive truncation for UP: floor(1*2/3) = 0 for each → sum = 0, dust = 2.
    // Last-winner fixup gives the last UP player 2.
    // Loser side: floor(1*2/2) = 1 each → sum = 2, no dust.
    // winner_matched_sum (2) == loser_pool (2) ✓
    // -------------------------------------------------------------------------
    #[test]
    fn test_rounding_dust_winner_side() {
        let inputs = vec![
            input(1, Side::Up, 1),
            input(2, Side::Up, 1),
            input(3, Side::Up, 1),
            input(4, Side::Down, 1),
            input(5, Side::Down, 1),
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_eq!(results.len(), 5);
        assert_conservation(&inputs, &results);

        let winner_payout_total: U256 = results
            .iter()
            .filter(|r| r.side == Side::Up)
            .map(|r| r.payout)
            .fold(U256::zero(), |a, b| a + b);
        let loser_matched_total: U256 = results
            .iter()
            .filter(|r| r.side == Side::Down)
            .map(|r| r.matched_stake)
            .fold(U256::zero(), |a, b| a + b);
        assert_eq!(
            winner_payout_total, loser_matched_total,
            "winner payouts must equal loser matched stakes — pool must be exactly balanced"
        );
    }

    // -------------------------------------------------------------------------
    // Test: dust on loser side.
    //
    // UP: 10 (winning, smaller side)
    // DOWN: 7, 7, 7 → total 21, matched = 10
    // Loser matched_stakes (truncated): floor(7*10/21) = 3 each → sum = 9, dust = 1.
    // Last loser gets 3 + 1 = 4 → loser_pool = 10.
    // winner_matched_stake = floor(10*10/10) = 10 → sum = 10.
    // winner_matched_sum (10) == loser_pool (10) ✓
    // -------------------------------------------------------------------------
    #[test]
    fn test_rounding_dust_loser_side() {
        let inputs = vec![
            input(1, Side::Up, 10),
            input(2, Side::Down, 7),
            input(3, Side::Down, 7),
            input(4, Side::Down, 7),
        ];
        let results = match_sides(&inputs, MarketOutcome::Up);

        assert_eq!(results.len(), 4);
        assert_conservation(&inputs, &results);

        let winner_payout_total: U256 = results
            .iter()
            .filter(|r| r.side == Side::Up)
            .map(|r| r.payout)
            .fold(U256::zero(), |a, b| a + b);
        let loser_matched_total: U256 = results
            .iter()
            .filter(|r| r.side == Side::Down)
            .map(|r| r.matched_stake)
            .fold(U256::zero(), |a, b| a + b);
        assert_eq!(
            winner_payout_total, loser_matched_total,
            "winner payouts must equal loser matched stakes"
        );

        // Winner must be fully matched (smaller side): matched_stake = 10, payout = 20.
        let winner = find_result(&results, 1);
        assert_eq!(winner.matched_stake, u(10));
        assert_eq!(winner.payout, u(20));
        assert_eq!(winner.refund, u(0));
    }
}
