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

/// Compute the per-batch payouts hash. Same as the inner hash inside
/// `compute_settle_batch_hash` — exposed so the bundle hash can be built
/// from a list of already-computed payouts hashes without rehashing
/// players + payouts repeatedly.
pub fn compute_payouts_hash(players: &[Address], payouts: &[U256]) -> [u8; 32] {
    let player_tokens: Vec<Token> = players.iter().map(|a| Token::Address(*a)).collect();
    let payout_tokens: Vec<Token> = payouts.iter().map(|p| Token::Uint(*p)).collect();
    keccak256(&encode(&[
        Token::Array(player_tokens),
        Token::Array(payout_tokens),
    ]))
}

/// Compute the bundle hash matching Vision.settleBatchesSingle:
///   keccak256(chainId, vision, "SETTLE_BATCHES_SINGLE_V1", batchIds, payoutsHashes)
/// Caller must pre-compute `payouts_hashes[i] = compute_payouts_hash(players[i], payouts[i])`.
pub fn compute_settle_batches_single_hash(
    chain_id: u64,
    vision_address: Address,
    batch_ids: &[u64],
    payouts_hashes: &[[u8; 32]],
) -> [u8; 32] {
    let batch_id_tokens: Vec<Token> =
        batch_ids.iter().map(|b| Token::Uint(U256::from(*b))).collect();
    let payouts_hash_tokens: Vec<Token> = payouts_hashes
        .iter()
        .map(|h| Token::FixedBytes(h.to_vec()))
        .collect();
    keccak256(&encode(&[
        Token::Uint(U256::from(chain_id)),
        Token::Address(vision_address),
        Token::String("SETTLE_BATCHES_SINGLE_V1".to_string()),
        Token::Array(batch_id_tokens),
        Token::Array(payouts_hash_tokens),
    ]))
}

/// Sign a settle-batches bundle. Returns the BLS signature over the bundle hash.
pub fn sign_settle_batches_bundle(
    keypair: &BLSKeyPair,
    chain_id: u64,
    vision_address: Address,
    batch_ids: &[u64],
    payouts_hashes: &[[u8; 32]],
) -> Result<BLSSignature, String> {
    let hash = compute_settle_batches_single_hash(chain_id, vision_address, batch_ids, payouts_hashes);
    let signer = Bn254BLSSigner::new();
    signer
        .sign_message_hash(keypair, &hash)
        .map_err(|e| format!("{e}"))
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
