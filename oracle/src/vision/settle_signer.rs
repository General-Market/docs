//! BLS signing for settleBatch() — computes the same hash as Vision.sol.

use ethers::abi::{encode, Token};
use ethers::types::{Address, U256};
use ethers::utils::keccak256;

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::types::BLSSignature;

/// Compute the SETTLE_BATCH message hash matching Vision.sol:
///   keccak256(abi.encode(chainId, visionAddress, "SETTLE_BATCH", batchId, payoutsHash))
/// where payoutsHash = keccak256(abi.encode(players, payouts))
pub fn compute_settle_batch_hash(
    chain_id: u64,
    vision_address: Address,
    batch_id: u64,
    players: &[Address],
    payouts: &[U256],
) -> [u8; 32] {
    // First: hash the players+payouts arrays (same as Solidity's abi.encode)
    let player_tokens: Vec<Token> = players.iter().map(|a| Token::Address(*a)).collect();
    let payout_tokens: Vec<Token> = payouts.iter().map(|p| Token::Uint(*p)).collect();
    let payouts_hash = keccak256(&encode(&[
        Token::Array(player_tokens),
        Token::Array(payout_tokens),
    ]));

    // Then: hash the full message
    keccak256(&encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(vision_address),
        Token::String("SETTLE_BATCH".to_string()),
        Token::Uint(U256::from(batch_id)),
        Token::FixedBytes(payouts_hash.to_vec()),
    ]))
}

/// Sign a settlement for a batch. Returns the BLS signature.
pub fn sign_settlement(
    keypair: &BLSKeyPair,
    chain_id: u64,
    vision_address: Address,
    batch_id: u64,
    players: &[Address],
    payouts: &[U256],
) -> Result<BLSSignature, String> {
    let hash = compute_settle_batch_hash(chain_id, vision_address, batch_id, players, payouts);
    let signer = Bn254BLSSigner::new();
    signer
        .sign_message_hash(keypair, &hash)
        .map_err(|e| format!("{e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settle_hash_deterministic() {
        let addr: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        let players = vec![addr];
        let payouts = vec![U256::from(1000u64)];

        let h1 = compute_settle_batch_hash(111222333, addr, 42, &players, &payouts);
        let h2 = compute_settle_batch_hash(111222333, addr, 42, &players, &payouts);
        assert_eq!(h1, h2);

        // Different batch_id = different hash
        let h3 = compute_settle_batch_hash(111222333, addr, 43, &players, &payouts);
        assert_ne!(h1, h3);
    }
}
