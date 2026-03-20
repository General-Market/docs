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
        // Both bet UP, market goes UP. No losers → everyone refunded.
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
                        matched_stake: U256::zero(),
                        payout: U256::from(100),
                        refund: U256::from(100),
                    },
                    PlayerMarketResult {
                        player: addr(2),
                        side: Side::Up,
                        effective_stake: U256::from(100),
                        matched_stake: U256::zero(),
                        payout: U256::from(100),
                        refund: U256::from(100),
                    },
                ],
            }],
            player_balances: vec![],
            voided_players: vec![],
        };

        let deposits = vec![(addr(1), U256::from(100)), (addr(2), U256::from(100))];
        let settlement = compute_settlement(&result, &deposits);

        // Everyone gets refunded — payout = refund = 100
        assert_eq!(settlement.payouts[0], U256::from(200)); // payout + refund
        assert_eq!(settlement.payouts[1], U256::from(200));
    }

    #[test]
    fn test_voided_players_get_deposit_back() {
        // Player 3 has no bitmap → voided → gets deposit back
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![],
            player_balances: vec![],
            voided_players: vec![addr(3)],
        };

        let deposits = vec![
            (addr(1), U256::from(100)),
            (addr(3), U256::from(50)),
        ];
        let settlement = compute_settlement(&result, &deposits);

        // addr(1) gets 0 (not voided, no markets)
        // addr(3) gets 50 (voided, full refund)
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
}
