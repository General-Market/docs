//! Arbitration consensus hash builders
//!
//! Builds message hashes for BLS signing during arbitration consensus.
//! Follows same pattern as `oracle/src/bridge/types.rs` hash builders
//! (e.g. `build_rebalance_hash`) — using `ethers::abi::encode` with `Token` types
//! so that the resulting hash matches Solidity's `keccak256(abi.encode(...))`.

use ethers::abi::{encode, Token};
use ethers::types::{Address, H256, U256};
use ethers::utils::keccak256;

/// Build hash for an arbitration settlement outcome (signed in phase 3).
///
/// MUST match ArbitrationSettlement.sol:
/// ```solidity
/// keccak256(abi.encode(block.chainid, address(this), "settleBet", betId, creatorWins))
/// ```
pub fn build_outcome_hash(
    chain_id: u64,
    settlement_address: Address,
    bet_id: U256,
    creator_wins: bool,
) -> H256 {
    H256::from(keccak256(encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(settlement_address),
        Token::String("settleBet".to_string()),
        Token::Uint(bet_id),
        Token::Bool(creator_wins),
    ])))
}

/// Build hash for a price proposal (signed in phase 1).
///
/// Used by the leader when broadcasting `ArbitrationPriceProposal` via P2P.
/// Followers recompute this hash locally to verify the leader's signature.
///
/// Format: `keccak256(abi.encode(betId, pricesHash, timestamp))`
/// where `pricesHash = keccak256(abi.encode(prices))` to keep the top-level hash
/// a fixed size regardless of the number of trades.
pub fn build_price_proposal_hash(
    bet_id: U256,
    prices: &[(u32, String, i64)],
    timestamp: u64,
) -> H256 {
    // Hash the prices array first to keep the outer hash fixed-size
    let prices_hash = {
        let tokens: Vec<Token> = prices
            .iter()
            .map(|(idx, symbol, price)| {
                Token::Tuple(vec![
                    Token::Uint(U256::from(*idx)),
                    Token::String(symbol.clone()),
                    Token::Int(U256::from(*price as u64)),
                ])
            })
            .collect();
        H256::from(keccak256(encode(&tokens)))
    };

    H256::from(keccak256(encode(&[
        Token::Uint(bet_id),
        Token::FixedBytes(prices_hash.as_bytes().to_vec()),
        Token::Uint(U256::from(timestamp)),
    ])))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_outcome_hash_deterministic() {
        let addr = Address::from([0x11u8; 20]);
        let h1 = build_outcome_hash(111222333, addr, U256::from(42), true);
        let h2 = build_outcome_hash(111222333, addr, U256::from(42), true);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_outcome_hash_differs_by_winner() {
        let addr = Address::from([0x11u8; 20]);
        let h1 = build_outcome_hash(111222333, addr, U256::from(42), true);
        let h2 = build_outcome_hash(111222333, addr, U256::from(42), false);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_outcome_hash_differs_by_bet_id() {
        let addr = Address::from([0x11u8; 20]);
        let h1 = build_outcome_hash(111222333, addr, U256::from(42), true);
        let h2 = build_outcome_hash(111222333, addr, U256::from(43), true);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_outcome_hash_differs_by_chain_id() {
        let addr = Address::from([0x11u8; 20]);
        let h1 = build_outcome_hash(111222333, addr, U256::from(42), true);
        let h2 = build_outcome_hash(1, addr, U256::from(42), true);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_outcome_hash_differs_by_settlement_address() {
        let addr1 = Address::from([0x11u8; 20]);
        let addr2 = Address::from([0x22u8; 20]);
        let h1 = build_outcome_hash(111222333, addr1, U256::from(42), true);
        let h2 = build_outcome_hash(111222333, addr2, U256::from(42), true);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_outcome_hash_is_not_zero() {
        let addr = Address::from([0x11u8; 20]);
        let h = build_outcome_hash(111222333, addr, U256::from(1), true);
        assert_ne!(h, H256::zero());
    }

    #[test]
    fn test_price_proposal_hash_deterministic() {
        let prices = vec![(0, "AAPL".to_string(), 15023i64)];
        let h1 = build_price_proposal_hash(U256::from(1), &prices, 1000);
        let h2 = build_price_proposal_hash(U256::from(1), &prices, 1000);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_price_proposal_hash_differs_by_prices() {
        let prices_a = vec![(0, "AAPL".to_string(), 15023i64)];
        let prices_b = vec![(0, "AAPL".to_string(), 15024i64)];
        let h1 = build_price_proposal_hash(U256::from(1), &prices_a, 1000);
        let h2 = build_price_proposal_hash(U256::from(1), &prices_b, 1000);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_price_proposal_hash_differs_by_timestamp() {
        let prices = vec![(0, "AAPL".to_string(), 15023i64)];
        let h1 = build_price_proposal_hash(U256::from(1), &prices, 1000);
        let h2 = build_price_proposal_hash(U256::from(1), &prices, 1001);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_price_proposal_hash_differs_by_bet_id() {
        let prices = vec![(0, "AAPL".to_string(), 15023i64)];
        let h1 = build_price_proposal_hash(U256::from(1), &prices, 1000);
        let h2 = build_price_proposal_hash(U256::from(2), &prices, 1000);
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_price_proposal_hash_multi_price() {
        let prices = vec![
            (0, "AAPL".to_string(), 15023i64),
            (1, "MSFT".to_string(), 41520i64),
            (2, "GOOGL".to_string(), 17850i64),
        ];
        let h = build_price_proposal_hash(U256::from(42), &prices, 1700000000);
        assert_ne!(h, H256::zero());
    }

    #[test]
    fn test_price_proposal_hash_empty_prices() {
        let prices: Vec<(u32, String, i64)> = vec![];
        let h = build_price_proposal_hash(U256::from(1), &prices, 1000);
        assert_ne!(h, H256::zero());
    }
}
