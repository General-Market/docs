use ethers::abi::Token;
use ethers::types::{Address, H256, U256};

fn main() {
    let chain_id: u64 = 14601;
    let mirror_address: Address = "0x015e39eefbab8f5d317dc7900465ea2673bf8424".parse().unwrap();
    let nonce: u64 = 4;
    let active_bitmask = U256::from(7);
    let active_count: u64 = 3;
    let threshold: u64 = 2;

    let pk0 = hex::decode("0eb702456546a23dedf661a1de566f5577e41085f67bb03d52f325d7a8c5d1bd21cc6c2f152efd0c207653da5190ea396f3c66412f2fd771bae5b9ec0834e9f7120b5cb07493b8823cd51b04e51dec1a806b8fbede7ea459c149f59f526fdd7e2c41648dcaf9c2c536e7092a762ebdbd93df6f80851979a0ce67f6baf982161d").unwrap();
    let pk1 = hex::decode("0fd1e1a44bceee1adbf120f6ab7412d7d0d6b06ccdd670b28093f00ad20ab7ff16aca4de00dc1804e8d2997234f4788833faf522d15ae136f0040c4b9337e1da00818b4b2c1aa3106ed6e9983d060dc94174e996e59604fc806c3bb1ec6a3679089f6ade3c34e86ffa9f8c36a4842a0c0416b6db5a1c184835c026c1d7f23155").unwrap();
    let pk2 = hex::decode("0a2b99ccc213b30a719a7548c5f8935ca08c22566a9ca0d1e588a538f0db4a6512af24753e246c5dcb22413e2657ac2f5165b10af07c2243f7cf5c1f44befc5c155d01b12b2d27f9410e329d2d43b727bfd2db4f3c23ef71e7bf39f5a5ed65f10c53552fef266c83c2d00508af0ec75d85d8f39dfb4e568f3beec8af6db1cc2d").unwrap();

    let pubkeys = vec![pk0, pk1, pk2];
    let ids: Vec<u64> = vec![0, 1, 2];

    // Inner hash: keccak256(abi.encode(oraclePubkeys, oracleIds))
    let pubkeys_token = Token::Array(
        pubkeys.iter().map(|pk| Token::Bytes(pk.clone())).collect()
    );
    let ids_token = Token::Array(
        ids.iter().map(|id| Token::Uint(U256::from(*id))).collect()
    );
    let inner_encoded = ethers::abi::encode(&[pubkeys_token, ids_token]);
    let inner_hash = ethers::utils::keccak256(&inner_encoded);
    println!("Inner hash: 0x{}", hex::encode(&inner_hash));

    // Outer hash
    let tokens = vec![
        Token::String("REGISTRY_SYNC".to_string()),
        Token::Uint(U256::from(chain_id)),
        Token::Address(mirror_address),
        Token::Uint(U256::from(nonce)),
        Token::FixedBytes(inner_hash.to_vec()),
        Token::Uint(active_bitmask),
        Token::Uint(U256::from(active_count)),
        Token::Uint(U256::from(threshold)),
    ];
    let outer_encoded = ethers::abi::encode(&tokens);
    let msg_hash = ethers::utils::keccak256(&outer_encoded);
    println!("Message hash: 0x{}", hex::encode(&msg_hash));

    let expected = "a54ee6f36b76fc34878fcd6a054ce7e6d278824948f4e8c1ae1791e3eda39f51";
    if hex::encode(&msg_hash) == expected {
        println!("MATCH!");
    } else {
        println!("MISMATCH! Expected: 0x{}", expected);
    }
}
