// Quick script to generate BLS signature for ITP completion
// Run with: cargo script scripts/sign-itp-completion.rs

use ethers::types::{Address, H256, U256};

fn main() {
    // Chain ID (Index L3)
    let chain_id = 111222333u64;

    // BridgeProxy address
    let bridge_proxy = "0xfBaBC11c9F238556880589b092fb199AF273849B"
        .parse::<Address>()
        .unwrap();

    // Admin (requester) from pending creation
    let admin = "0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4"
        .parse::<Address>()
        .unwrap();

    // Nonce
    let nonce = U256::from(0);

    // Example weights and assets for hash computation
    // (must match the requestCreateItp call being completed)
    let weights: Vec<U256> = vec![U256::from(5) * U256::from(10u64.pow(17))]; // 50% weight
    let assets: Vec<Address> = vec!["0x0000000000000000000000000000000000000001"
        .parse::<Address>()
        .unwrap()];

    // Build message hash (must match BridgeProxy.sol)
    // Hash format: chainid + bridgeProxy + admin + nonce + weightsHash + assetsHash
    // NOTE: orbitItpId is NOT in the hash — it's created atomically in completeCreateItp

    // Compute weightsHash = keccak256(abi.encodePacked(weights))
    let mut weights_packed = Vec::new();
    for w in &weights {
        let mut w_bytes = [0u8; 32];
        w.to_big_endian(&mut w_bytes);
        weights_packed.extend_from_slice(&w_bytes);
    }
    let weights_hash = ethers::utils::keccak256(&weights_packed);

    // Compute assetsHash = keccak256(abi.encodePacked(assets))
    let mut assets_packed = Vec::new();
    for a in &assets {
        assets_packed.extend_from_slice(a.as_bytes());
    }
    let assets_hash = ethers::utils::keccak256(&assets_packed);

    let mut data = Vec::with_capacity(168);

    // chain_id as uint256 (32 bytes, packed)
    let mut chain_bytes = [0u8; 32];
    U256::from(chain_id).to_big_endian(&mut chain_bytes);
    data.extend_from_slice(&chain_bytes);

    // bridge_proxy as address (20 bytes, packed)
    data.extend_from_slice(bridge_proxy.as_bytes());

    // admin as address (20 bytes, packed)
    data.extend_from_slice(admin.as_bytes());

    // nonce as uint256 (32 bytes)
    let mut nonce_bytes = [0u8; 32];
    nonce.to_big_endian(&mut nonce_bytes);
    data.extend_from_slice(&nonce_bytes);

    // weightsHash (32 bytes)
    data.extend_from_slice(&weights_hash);

    // assetsHash (32 bytes)
    data.extend_from_slice(&assets_hash);

    // Hash
    let message_hash = ethers::utils::keccak256(&data);

    println!("Message hash: 0x{}", hex::encode(&message_hash));

    // Generate BLS signature with deterministic test key
    // Seed: [0, 0x42, 0, ...]
    let mut seed = [0u8; 32];
    seed[0] = 0;
    seed[1] = 0x42;

    // This requires the common crate's BLS implementation
    // Run this as a cargo test in the oracle crate instead
    println!("Run 'cargo test test_sign_itp_completion -- --nocapture' in oracle/");
}
