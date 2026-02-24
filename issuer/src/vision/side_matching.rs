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

    let mut results = Vec::with_capacity(inputs.len());

    for input in inputs {
        if input.effective_stake.is_zero() {
            // Zero-stake players get nothing
            results.push(SideMatchResult {
                player: input.player,
                side: input.side,
                effective_stake: input.effective_stake,
                matched_stake: U256::zero(),
                payout: U256::zero(),
                refund: U256::zero(),
            });
            continue;
        }

        let is_winner = input.side == winning_side;
        let side_total = if is_winner { winning_total } else { losing_total };

        // Compute this player's matched stake:
        //   matched_stake = effective_stake * matched / side_total
        // Using checked math: multiply first, then divide, to maintain precision.
        let matched_stake = input
            .effective_stake
            .checked_mul(matched)
            .expect("matched_stake overflow")
            .checked_div(side_total)
            .expect("side_total is non-zero");

        // Refund = unmatched portion
        let refund = input.effective_stake - matched_stake;

        if is_winner {
            // Winners receive: matched_stake + share of losing matched pool
            // payout = matched_stake + matched_stake * losing_matched / winning_matched
            //
            // winning_matched = matched (by definition, min of the two sides)
            // losing_matched = matched (same amount, the smaller side is fully matched)
            //
            // But we need the actual winning_matched total to distribute proportionally.
            // winning_matched_total = sum of all winners' matched_stakes = matched (when winning >= losing)
            //                      or = winning_total (when winning < losing)
            // Actually: winning_matched_total = min(winning_total, matched) = matched if winning >= losing
            //           winning_matched_total = winning_total if winning < losing
            // Simpler: winning_matched_total = sum(matched_stake for winners) = matched (always)
            // Because: sum(stake_i * matched / side_total) for winners = winning_total * matched / winning_total = matched (if winning side)
            //          OR = winning_total * matched / winning_total = matched... wait no.
            //
            // Let's think again:
            // - If winning_total >= losing_total: matched = losing_total
            //   winning side is larger -> matched_stake_i = stake_i * losing_total / winning_total
            //   sum = winning_total * losing_total / winning_total = losing_total = matched ✓
            //
            // - If winning_total < losing_total: matched = winning_total
            //   winning side is smaller -> matched_stake_i = stake_i * winning_total / winning_total = stake_i
            //   sum = winning_total = matched ✓
            //
            // So winning_matched_total = matched, and losing_matched_total = matched.
            // Each winner gets: matched_stake + matched_stake * matched / matched = 2 * matched_stake
            // That's wrong for asymmetric sides. Let's reconsider.
            //
            // The pool available to winners = losing side's matched total = matched.
            // Each winner's share of the pool is proportional to their matched_stake / winning_matched_total.
            // winner_profit = matched * (matched_stake / matched) = matched_stake
            // winner_payout = matched_stake + matched_stake = 2 * matched_stake
            //
            // Hmm, that simplifies to 2x. But that IS correct for parimutuel:
            // - Each winner's profit from the losing pool is proportional to their matched stake
            // - The entire losing matched pool is distributed to winners
            // - Since winning_matched_total = losing_matched_total = matched,
            //   each winner gets exactly their matched_stake as profit.
            //
            // For a 70/30 split (UP=70, DOWN=30):
            //   matched = 30
            //   UP player with stake 70: matched_stake = 70 * 30/70 = 30, refund = 40
            //   payout = 30 + 30 = 60... but they staked 70 total and get back 40 + 60 = 100
            //   Wait no: they staked 70. matched = 30 from each side. Winner gets the whole pool (60).
            //   But proportionally: this one winner gets all 60 back.
            //   Their refund = 70 - 30 = 40. Total received = 60 + 40 = 100. Started with 70. Profit = 30. ✓
            //
            // So payout (from the matched pool) = 2 * matched_stake for winners.
            let payout = matched_stake * 2;

            results.push(SideMatchResult {
                player: input.player,
                side: input.side,
                effective_stake: input.effective_stake,
                matched_stake,
                payout,
                refund,
            });
        } else {
            // Losers: their matched_stake goes to the winning pool
            // They only get back the unmatched refund
            results.push(SideMatchResult {
                player: input.player,
                side: input.side,
                effective_stake: input.effective_stake,
                matched_stake,
                payout: U256::zero(),
                refund,
            });
        }
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
}
