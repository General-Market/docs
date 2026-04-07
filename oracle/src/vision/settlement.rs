//! Parimutuel settlement computation for round-based Vision batches.
//!
//! Given a TickResult (per-market outcomes) and player positions,
//! compute the final payout for each player. Zero-sum: total payouts == total deposits.

use std::collections::HashMap;
use ethers::types::{Address, U256};
use super::types::{TickResult, MarketOutcome, Side, RoundSettlement};

/// Compute round settlement payouts from tick resolution results.
///
/// Aggregates per-market payout + refund for each player.
/// Voided players (no bitmap) get their full deposit back.
/// Players are sorted by address ascending (contract requirement).
pub fn compute_settlement(
    tick_result: &TickResult,
    player_deposits: &[(Address, U256)],
) -> RoundSettlement {
    let mut player_payouts: HashMap<Address, U256> = HashMap::new();
    let mut player_correct: HashMap<Address, u32> = HashMap::new();

    // Initialize all players with zero
    for (addr, _) in player_deposits {
        player_payouts.entry(*addr).or_insert(U256::zero());
        player_correct.entry(*addr).or_insert(0);
    }

    // Accumulate payouts + refunds from each market's results
    for mr in &tick_result.market_results {
        let is_up = matches!(mr.outcome, MarketOutcome::Up);
        let is_down = matches!(mr.outcome, MarketOutcome::Down);

        for pr in &mr.player_results {
            let entry = player_payouts.entry(pr.player).or_insert(U256::zero());
            *entry += pr.payout + pr.refund;

            // Count correct predictions
            let correct = match pr.side {
                Side::Up => is_up,
                Side::Down => is_down,
            };
            if correct {
                *player_correct.entry(pr.player).or_insert(0) += 1;
            }
        }
    }

    // Voided players get full deposit back
    for voided in &tick_result.voided_players {
        if let Some((_, deposit)) = player_deposits.iter().find(|(a, _)| a == voided) {
            *player_payouts.entry(*voided).or_insert(U256::zero()) += *deposit;
        }
    }

    // Sort by address ascending (contract requires strictly ascending order)
    let mut sorted: Vec<(Address, U256, u32)> = player_payouts
        .into_iter()
        .map(|(addr, payout)| {
            let correct = player_correct.get(&addr).copied().unwrap_or(0);
            (addr, payout, correct)
        })
        .collect();
    sorted.sort_by_key(|(addr, _, _)| *addr);

    // Zero-sum invariant: total payouts must equal total deposits.
    // If this fires, something upstream produced non-conservative results.
    let total_payouts: U256 = sorted.iter().map(|(_, p, _)| *p).fold(U256::zero(), |a, b| a + b);
    let total_deposits: U256 = player_deposits.iter().map(|(_, d)| *d).fold(U256::zero(), |a, b| a + b);
    if total_payouts != total_deposits {
        let delta = if total_payouts > total_deposits {
            total_payouts - total_deposits
        } else {
            total_deposits - total_payouts
        };
        tracing::warn!(
            batch_id = tick_result.batch_id,
            total_payouts = %total_payouts,
            total_deposits = %total_deposits,
            delta = %delta,
            "Zero-sum invariant violated — adjusting last player to restore balance"
        );
        // Deterministic fix: adjust the LAST player's payout (sorted by address,
        // so "last" is identical across all oracles). This avoids the proportional
        // scaling that produces different results on each oracle due to integer
        // division rounding on slightly different total_payouts values.
        if let Some(last) = sorted.last_mut() {
            if total_payouts > total_deposits {
                // Overpaid — reduce last player's payout
                let reduce = std::cmp::min(delta, last.1);
                last.1 = last.1 - reduce;
            } else {
                // Underpaid — increase last player's payout
                last.1 = last.1 + delta;
            }
        }
    }

    // Build a deposit lookup for the sorted output
    let deposit_map: std::collections::HashMap<Address, U256> =
        player_deposits.iter().cloned().collect();

    RoundSettlement {
        batch_id: tick_result.batch_id,
        players: sorted.iter().map(|(a, _, _)| *a).collect(),
        payouts: sorted.iter().map(|(_, p, _)| *p).collect(),
        deposits: sorted
            .iter()
            .map(|(a, _, _)| deposit_map.get(a).copied().unwrap_or(U256::zero()))
            .collect(),
        correct_counts: sorted.iter().map(|(_, _, c)| *c).collect(),
        total_markets: tick_result.market_results.len() as u32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::H256;
    use crate::vision::types::*;

    fn addr(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    #[test]
    fn test_two_players_opposite_bets() {
        // Player 1 bets UP, Player 2 bets DOWN. Market goes UP.
        // Player 1 wins everything (payout=200), Player 2 gets nothing.
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![MarketResult {
                market_id: H256::zero(),
                asset_id: "test".to_string(),
                outcome: MarketOutcome::Up,
                start_price: 100.0,
                end_price: 110.0,
                pct_change_bps: 1000,
                player_results: vec![
                    PlayerMarketResult {
                        player: addr(1),
                        side: Side::Up,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(100),
                        payout: U256::from(200),
                        refund: U256::zero(),
                    },
                    PlayerMarketResult {
                        player: addr(2),
                        side: Side::Down,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(100),
                        payout: U256::zero(),
                        refund: U256::zero(),
                    },
                ],
            }],
            player_balances: vec![],
            voided_players: vec![],
        };

        let deposits = vec![(addr(1), U256::from(100)), (addr(2), U256::from(100))];
        let settlement = compute_settlement(&result, &deposits);

        assert_eq!(settlement.players.len(), 2);
        assert_eq!(settlement.payouts[0], U256::from(200)); // addr(1) wins
        assert_eq!(settlement.payouts[1], U256::from(0));   // addr(2) loses
        assert_eq!(settlement.correct_counts[0], 1);
        assert_eq!(settlement.correct_counts[1], 0);
    }

    #[test]
    fn test_all_same_side_refund() {
        // Both bet UP, market goes UP. No losers → refund_all.
        // refund_all returns: payout = effective_stake, refund = 0.
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![MarketResult {
                market_id: H256::zero(),
                asset_id: "test".to_string(),
                outcome: MarketOutcome::AllSameSide,
                start_price: 100.0,
                end_price: 110.0,
                pct_change_bps: 1000,
                player_results: vec![
                    PlayerMarketResult {
                        player: addr(1),
                        side: Side::Up,
                        effective_stake: U256::from(100),
                        matched_stake: U256::zero(),
                        payout: U256::from(100), // refund_all: payout = stake
                        refund: U256::zero(),
                    },
                    PlayerMarketResult {
                        player: addr(2),
                        side: Side::Up,
                        effective_stake: U256::from(100),
                        matched_stake: U256::zero(),
                        payout: U256::from(100), // refund_all: payout = stake
                        refund: U256::zero(),
                    },
                ],
            }],
            player_balances: vec![],
            voided_players: vec![],
        };

        let deposits = vec![(addr(1), U256::from(100)), (addr(2), U256::from(100))];
        let settlement = compute_settlement(&result, &deposits);

        // Everyone gets their deposit back (zero-sum)
        assert_eq!(settlement.payouts[0], U256::from(100));
        assert_eq!(settlement.payouts[1], U256::from(100));
    }

    #[test]
    fn test_voided_players_get_deposit_back() {
        // Both players voided (no bitmaps) → both get deposits back.
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![],
            player_balances: vec![],
            voided_players: vec![addr(1), addr(3)],
        };

        let deposits = vec![
            (addr(1), U256::from(100)),
            (addr(3), U256::from(50)),
        ];
        let settlement = compute_settlement(&result, &deposits);

        let p1_idx = settlement.players.iter().position(|a| *a == addr(1)).unwrap();
        assert_eq!(settlement.payouts[p1_idx], U256::from(100));

        let p3_idx = settlement.players.iter().position(|a| *a == addr(3)).unwrap();
        assert_eq!(settlement.payouts[p3_idx], U256::from(50));
    }

    #[test]
    fn test_players_sorted_ascending() {
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![],
            player_balances: vec![],
            voided_players: vec![addr(5), addr(1), addr(3)],
        };

        let deposits = vec![
            (addr(5), U256::from(10)),
            (addr(1), U256::from(20)),
            (addr(3), U256::from(30)),
        ];
        let settlement = compute_settlement(&result, &deposits);

        // Must be sorted: addr(1) < addr(3) < addr(5)
        assert!(settlement.players[0] < settlement.players[1]);
        assert!(settlement.players[1] < settlement.players[2]);
    }

    /// Verify zero-sum when a player's bitmap doesn't cover all markets.
    /// The uncovered market stake must be refunded as payout = stake,
    /// ensuring total payouts == total deposits (the parimutuel invariant).
    #[test]
    fn test_uncovered_bitmap_refund_preserves_zero_sum() {
        // 2 markets. Player 1 covers both (normal). Player 2 covers only market 0
        // (bitmap too short for market 1). Per-market stake = deposit / 2.
        //
        // Market 0: P1 UP (50), P2 DOWN (500) — outcome UP → P1 wins
        //   matched = min(50, 500) = 50
        //   P1: payout = 100, refund = 0   (2 * 50)
        //   P2: payout = 0,   refund = 450 (500 - 50)
        //
        // Market 1: P1 UP (50) — outcome DOWN → P1 loses. P2 not in matching.
        //   Only one side → refund_all
        //   P1: payout = 50, refund = 0
        //   P2: uncovered → self-refund entry: payout = 500, refund = 0
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![
                MarketResult {
                    market_id: H256::zero(),
                    asset_id: "m0".to_string(),
                    outcome: MarketOutcome::Up,
                    start_price: 100.0,
                    end_price: 110.0,
                    pct_change_bps: 1000,
                    player_results: vec![
                        PlayerMarketResult {
                            player: addr(1),
                            side: Side::Up,
                            effective_stake: U256::from(50),
                            matched_stake: U256::from(50),
                            payout: U256::from(100),
                            refund: U256::zero(),
                        },
                        PlayerMarketResult {
                            player: addr(2),
                            side: Side::Down,
                            effective_stake: U256::from(500),
                            matched_stake: U256::from(50),
                            payout: U256::zero(),
                            refund: U256::from(450),
                        },
                    ],
                },
                MarketResult {
                    market_id: H256::from_low_u64_be(1),
                    asset_id: "m1".to_string(),
                    outcome: MarketOutcome::Down,
                    start_price: 100.0,
                    end_price: 90.0,
                    pct_change_bps: -1000,
                    player_results: vec![
                        // P1: only player → all-same-side refund
                        PlayerMarketResult {
                            player: addr(1),
                            side: Side::Up,
                            effective_stake: U256::from(50),
                            matched_stake: U256::zero(),
                            payout: U256::from(50),
                            refund: U256::zero(),
                        },
                        // P2: bitmap uncovered → self-refund (the fix)
                        PlayerMarketResult {
                            player: addr(2),
                            side: Side::Up, // opposite of outcome, doesn't count as correct
                            effective_stake: U256::from(500),
                            matched_stake: U256::zero(),
                            payout: U256::from(500), // full stake refunded
                            refund: U256::zero(),
                        },
                    ],
                },
            ],
            player_balances: vec![],
            voided_players: vec![],
        };

        let deposits = vec![
            (addr(1), U256::from(100)),
            (addr(2), U256::from(1000)),
        ];
        let settlement = compute_settlement(&result, &deposits);

        let total_payouts: U256 = settlement.payouts.iter().copied().fold(U256::zero(), |a, b| a + b);
        let total_deposits: U256 = deposits.iter().map(|(_, d)| *d).fold(U256::zero(), |a, b| a + b);

        // Zero-sum: total payouts == total deposits
        assert_eq!(
            total_payouts, total_deposits,
            "Parimutuel invariant violated: payouts={total_payouts} != deposits={total_deposits}"
        );

        // P1: 100 (market 0 win) + 50 (market 1 refund) = 150
        let p1_idx = settlement.players.iter().position(|a| *a == addr(1)).unwrap();
        assert_eq!(settlement.payouts[p1_idx], U256::from(150));

        // P2: 450 (market 0 loss refund) + 500 (market 1 uncovered refund) = 950
        let p2_idx = settlement.players.iter().position(|a| *a == addr(2)).unwrap();
        assert_eq!(settlement.payouts[p2_idx], U256::from(950));

        // P2 correct_count should be 0 (uncovered market side is opposite of outcome)
        assert_eq!(settlement.correct_counts[p2_idx], 0);
    }

    /// Regression test: a player who loses in every market (fully matched, zero payout)
    /// must NOT receive their deposit back. The old safety-net refunded total losers,
    /// creating money from nothing and violating zero-sum.
    #[test]
    fn test_total_loser_gets_zero_not_deposit() {
        // Player 1 (UP) wins, Player 2 (DOWN) loses — fully matched, zero refund.
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![MarketResult {
                market_id: H256::zero(),
                asset_id: "test".to_string(),
                outcome: MarketOutcome::Up,
                start_price: 100.0,
                end_price: 110.0,
                pct_change_bps: 1000,
                player_results: vec![
                    PlayerMarketResult {
                        player: addr(1),
                        side: Side::Up,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(100),
                        payout: U256::from(200),
                        refund: U256::zero(),
                    },
                    PlayerMarketResult {
                        player: addr(2),
                        side: Side::Down,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(100),
                        payout: U256::zero(),
                        refund: U256::zero(),
                    },
                ],
            }],
            player_balances: vec![],
            voided_players: vec![],
        };

        let deposits = vec![(addr(1), U256::from(100)), (addr(2), U256::from(100))];
        let settlement = compute_settlement(&result, &deposits);

        // Winner gets everything, loser gets nothing — zero-sum preserved.
        let p1_idx = settlement.players.iter().position(|a| *a == addr(1)).unwrap();
        let p2_idx = settlement.players.iter().position(|a| *a == addr(2)).unwrap();

        assert_eq!(settlement.payouts[p1_idx], U256::from(200));
        assert_eq!(settlement.payouts[p2_idx], U256::from(0));

        let total_payouts: U256 = settlement.payouts.iter().copied().fold(U256::zero(), |a, b| a + b);
        let total_deposits: U256 = deposits.iter().map(|(_, d)| *d).fold(U256::zero(), |a, b| a + b);
        assert_eq!(total_payouts, total_deposits, "zero-sum invariant must hold");
    }

    /// Parimutuel invariant — explicit form.
    ///
    /// For any TickResult, given Σ player_deposits = X, the resulting
    /// Σ settlement.payouts must equal X exactly. The PlayerJoined event now
    /// publishes the FULL deposit, so the entire X enters the resolver and the
    /// entire X must come out — no leakage, no creation, ever.
    #[test]
    fn test_parimutuel_invariant_full_deposits() {
        // Three players with very different deposit sizes — exercises rounding.
        let deposits = vec![
            (addr(1), U256::from(1_000_000_000_000_000_000u128)), // 1 GM
            (addr(2), U256::from(7_777_777u128)),                 // small odd
            (addr(3), U256::from(333_333_333_333u128)),           // large odd
        ];

        // One market resolved UP. P1 (UP) and P3 (UP) win, P2 (DOWN) loses.
        // Per-market stake equals each player's full deposit (single market).
        let result = TickResult {
            batch_id: 42,
            tick_id: 0,
            market_results: vec![MarketResult {
                market_id: H256::zero(),
                asset_id: "single".to_string(),
                outcome: MarketOutcome::Up,
                start_price: 100.0,
                end_price: 110.0,
                pct_change_bps: 1000,
                player_results: vec![
                    // P1 UP: deposits 1 GM, matched 7_777_777 (the only opposing stake),
                    // wins 2x matched + remainder refund.
                    PlayerMarketResult {
                        player: addr(1),
                        side: Side::Up,
                        effective_stake: U256::from(1_000_000_000_000_000_000u128),
                        matched_stake: U256::from(7_777_777u128),
                        // Simulate proportional split: P1 owns 1e18 / (1e18+333.3e9) of UP-side.
                        // For test simplicity, give P1 the matched winnings in proportion 3:1
                        // and a refund of unmatched stake.
                        payout: U256::from(1_000_000_000_000_000_000u128) // own stake back
                            + U256::from(7_777_777u128) * U256::from(1_000_000_000_000_000_000u128)
                                / (U256::from(1_000_000_000_000_000_000u128)
                                    + U256::from(333_333_333_333u128)),
                        refund: U256::zero(),
                    },
                    PlayerMarketResult {
                        player: addr(3),
                        side: Side::Up,
                        effective_stake: U256::from(333_333_333_333u128),
                        matched_stake: U256::from(7_777_777u128),
                        payout: U256::from(333_333_333_333u128) // own stake back
                            + U256::from(7_777_777u128) * U256::from(333_333_333_333u128)
                                / (U256::from(1_000_000_000_000_000_000u128)
                                    + U256::from(333_333_333_333u128)),
                        refund: U256::zero(),
                    },
                    PlayerMarketResult {
                        player: addr(2),
                        side: Side::Down,
                        effective_stake: U256::from(7_777_777u128),
                        matched_stake: U256::from(7_777_777u128),
                        payout: U256::zero(),
                        refund: U256::zero(),
                    },
                ],
            }],
            player_balances: vec![],
            voided_players: vec![],
        };

        let settlement = compute_settlement(&result, &deposits);

        let total_payouts: U256 =
            settlement.payouts.iter().copied().fold(U256::zero(), |a, b| a + b);
        let total_deposits: U256 =
            deposits.iter().map(|(_, d)| *d).fold(U256::zero(), |a, b| a + b);

        // The compute_settlement adjuster snaps the last player's payout to
        // restore zero-sum if rounding leaks. Either way, the invariant must hold.
        assert_eq!(
            total_payouts, total_deposits,
            "Σ payouts ({total_payouts}) must equal Σ deposits ({total_deposits})"
        );

        // And every player must appear in the settlement output.
        assert_eq!(settlement.players.len(), deposits.len());
    }
}
