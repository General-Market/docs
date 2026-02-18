//! Test vectors for cross-language BLS testing
//!
//! These vectors are used to verify compatibility between
//! Rust BLS implementation and Solidity BLSLib.sol.
//!
//! Vector Format:
//! - Private key: 32 bytes (big-endian scalar)
//! - Public key: 128 bytes (G2 point: x_im, x_re, y_im, y_re)
//! - Message: variable length bytes (hashed with keccak256)
//! - Signature: 64 bytes (G1 point: x, y)

use super::keypair::BLSKeyPair;
use super::signer::Bn254BLSSigner;
use super::utils::aggregate_pubkeys;
use crate::traits::BLSSigner;
use crate::types::{BLSPublicKey, BLSSignature};

/// Test vector for a single signer
#[derive(Debug, Clone)]
pub struct TestVector {
    /// Human-readable name for the test
    pub name: &'static str,
    /// Private key seed (32 bytes) - used to generate deterministic keypair
    pub private_key_seed: [u8; 32],
    /// Message to sign
    pub message: &'static [u8],
}

/// Computed test vector with all derived values
#[derive(Debug, Clone)]
pub struct ComputedTestVector {
    pub name: String,
    pub private_key: Vec<u8>,
    pub public_key: Vec<u8>,
    pub message: Vec<u8>,
    pub message_hash: [u8; 32],
    pub signature: Vec<u8>,
}

impl ComputedTestVector {
    /// Format as Solidity test case
    pub fn to_solidity_test(&self) -> String {
        format!(
            r#"
    // Test vector: {}
    function test_rustVector_{}() public view {{
        bytes memory pubkey = hex"{}";
        bytes32 message = 0x{};
        bytes memory signature = hex"{}";

        bool valid = _verifyBLS(pubkey, message, signature);
        assertTrue(valid, "Rust-generated signature should verify in Solidity");
    }}
"#,
            self.name,
            self.name.replace(' ', "_").replace('-', "_"),
            hex::encode(&self.public_key),
            hex::encode(self.message_hash),
            hex::encode(&self.signature),
        )
    }
}

/// Standard test vectors for compatibility testing
pub const TEST_VECTORS: &[TestVector] = &[
    TestVector {
        name: "basic_signing",
        private_key_seed: [1u8; 32],
        message: b"Hello, BLS!",
    },
    TestVector {
        name: "empty_message",
        private_key_seed: [2u8; 32],
        message: b"",
    },
    TestVector {
        name: "long_message",
        private_key_seed: [3u8; 32],
        message: b"This is a longer message that exceeds the typical hash input size and should still work correctly with the BLS signature scheme.",
    },
    TestVector {
        name: "binary_message",
        private_key_seed: [4u8; 32],
        message: &[0x00, 0xFF, 0x01, 0xFE, 0x02, 0xFD, 0x03, 0xFC],
    },
    TestVector {
        name: "consensus_batch",
        private_key_seed: [5u8; 32],
        // Simulates a batch confirmation message
        message: b"\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x02\x00\x00\x00\x00\x00\x00\x00\x03",
    },
];

/// Generate computed test vectors from the standard vectors
pub fn generate_test_vectors() -> Vec<ComputedTestVector> {
    let signer = Bn254BLSSigner::new();
    let mut results = Vec::new();

    for tv in TEST_VECTORS {
        let keypair = BLSKeyPair::from_seed(&tv.private_key_seed)
            .expect("valid seed should generate keypair");

        let signature = signer
            .sign_with_keypair(&keypair, tv.message)
            .expect("signing should succeed");

        let message_hash = ethers::utils::keccak256(tv.message);

        results.push(ComputedTestVector {
            name: tv.name.to_string(),
            private_key: keypair.private_key_raw(),
            public_key: keypair.public_key_bytes(),
            message: tv.message.to_vec(),
            message_hash,
            signature: signature.0,
        });
    }

    results
}

/// Test vector for aggregated signatures
#[derive(Debug, Clone)]
pub struct AggregatedTestVector {
    pub name: String,
    pub signers: Vec<ComputedTestVector>,
    pub aggregated_pubkey: Vec<u8>,
    pub aggregated_signature: Vec<u8>,
    pub message: Vec<u8>,
    pub message_hash: [u8; 32],
}

/// Generate aggregated signature test vectors
pub fn generate_aggregated_test_vectors() -> Vec<AggregatedTestVector> {
    let signer = Bn254BLSSigner::new();
    let mut results = Vec::new();

    // Test with 2 signers
    {
        let message = b"aggregated_2_signers";
        let message_hash = ethers::utils::keccak256(message);

        let kp1 = BLSKeyPair::from_seed(&[10u8; 32]).unwrap();
        let kp2 = BLSKeyPair::from_seed(&[11u8; 32]).unwrap();

        let sig1 = signer.sign_with_keypair(&kp1, message).unwrap();
        let sig2 = signer.sign_with_keypair(&kp2, message).unwrap();

        let agg_sig = signer.aggregate_signatures(vec![sig1.clone(), sig2.clone()]).unwrap();
        let agg_pk = aggregate_pubkeys(&[kp1.public_key(), kp2.public_key()]).unwrap();

        results.push(AggregatedTestVector {
            name: "aggregated_2_signers".to_string(),
            signers: vec![
                ComputedTestVector {
                    name: "signer_1".to_string(),
                    private_key: kp1.private_key_raw(),
                    public_key: kp1.public_key_bytes(),
                    message: message.to_vec(),
                    message_hash,
                    signature: sig1.0,
                },
                ComputedTestVector {
                    name: "signer_2".to_string(),
                    private_key: kp2.private_key_raw(),
                    public_key: kp2.public_key_bytes(),
                    message: message.to_vec(),
                    message_hash,
                    signature: sig2.0,
                },
            ],
            aggregated_pubkey: agg_pk.0,
            aggregated_signature: agg_sig.0,
            message: message.to_vec(),
            message_hash,
        });
    }

    // Test with 11 signers (consensus threshold)
    {
        let message = b"aggregated_11_signers_consensus";
        let message_hash = ethers::utils::keccak256(message);

        let mut signers = Vec::new();
        let mut signatures = Vec::new();
        let mut pubkeys = Vec::new();

        for i in 0..11 {
            let mut seed = [0u8; 32];
            seed[0] = 20 + i as u8;
            let kp = BLSKeyPair::from_seed(&seed).unwrap();
            let sig = signer.sign_with_keypair(&kp, message).unwrap();

            signers.push(ComputedTestVector {
                name: format!("signer_{}", i + 1),
                private_key: kp.private_key_raw(),
                public_key: kp.public_key_bytes(),
                message: message.to_vec(),
                message_hash,
                signature: sig.0.clone(),
            });

            signatures.push(sig);
            pubkeys.push(kp.public_key());
        }

        let agg_sig = signer.aggregate_signatures(signatures).unwrap();
        let agg_pk = aggregate_pubkeys(&pubkeys).unwrap();

        results.push(AggregatedTestVector {
            name: "aggregated_11_signers".to_string(),
            signers,
            aggregated_pubkey: agg_pk.0,
            aggregated_signature: agg_sig.0,
            message: message.to_vec(),
            message_hash,
        });
    }

    // Test with 20 signers (full issuer set)
    {
        let message = b"aggregated_20_signers_full";
        let message_hash = ethers::utils::keccak256(message);

        let mut signers = Vec::new();
        let mut signatures = Vec::new();
        let mut pubkeys = Vec::new();

        for i in 0..20 {
            let mut seed = [0u8; 32];
            seed[0] = 40 + i as u8;
            let kp = BLSKeyPair::from_seed(&seed).unwrap();
            let sig = signer.sign_with_keypair(&kp, message).unwrap();

            signers.push(ComputedTestVector {
                name: format!("signer_{}", i + 1),
                private_key: kp.private_key_raw(),
                public_key: kp.public_key_bytes(),
                message: message.to_vec(),
                message_hash,
                signature: sig.0.clone(),
            });

            signatures.push(sig);
            pubkeys.push(kp.public_key());
        }

        let agg_sig = signer.aggregate_signatures(signatures).unwrap();
        let agg_pk = aggregate_pubkeys(&pubkeys).unwrap();

        results.push(AggregatedTestVector {
            name: "aggregated_20_signers".to_string(),
            signers,
            aggregated_pubkey: agg_pk.0,
            aggregated_signature: agg_sig.0,
            message: message.to_vec(),
            message_hash,
        });
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_test_vectors() {
        let vectors = generate_test_vectors();

        assert!(!vectors.is_empty(), "should generate test vectors");

        for v in &vectors {
            assert_eq!(v.private_key.len(), 32, "private key should be 32 bytes");
            assert_eq!(v.public_key.len(), 128, "public key should be 128 bytes");
            assert_eq!(v.signature.len(), 64, "signature should be 64 bytes");
            assert_eq!(v.message_hash.len(), 32, "message hash should be 32 bytes");
        }
    }

    #[test]
    fn test_vectors_verify() {
        let signer = Bn254BLSSigner::new();
        let vectors = generate_test_vectors();

        for v in &vectors {
            let pubkey = BLSPublicKey(v.public_key.clone());
            let signature = BLSSignature(v.signature.clone());

            let valid = signer
                .verify(&pubkey, &v.message, &signature)
                .expect("verification should succeed");

            assert!(valid, "test vector {} should verify", v.name);
        }
    }

    #[test]
    fn test_aggregated_vectors_verify() {
        let signer = Bn254BLSSigner::new();
        let vectors = generate_aggregated_test_vectors();

        for v in &vectors {
            let agg_pk = BLSPublicKey(v.aggregated_pubkey.clone());
            let agg_sig = BLSSignature(v.aggregated_signature.clone());

            let valid = signer
                .verify(&agg_pk, &v.message, &agg_sig)
                .expect("verification should succeed");

            assert!(valid, "aggregated test vector {} should verify", v.name);
        }
    }

    #[test]
    fn test_vectors_deterministic() {
        let vectors1 = generate_test_vectors();
        let vectors2 = generate_test_vectors();

        assert_eq!(vectors1.len(), vectors2.len());

        for (v1, v2) in vectors1.iter().zip(vectors2.iter()) {
            assert_eq!(v1.private_key, v2.private_key, "private keys should match");
            assert_eq!(v1.public_key, v2.public_key, "public keys should match");
            assert_eq!(v1.signature, v2.signature, "signatures should match");
        }
    }

    #[test]
    fn test_solidity_format() {
        let vectors = generate_test_vectors();
        let v = &vectors[0];

        let solidity_test = v.to_solidity_test();

        assert!(solidity_test.contains("function test_rustVector_"));
        assert!(solidity_test.contains("bytes memory pubkey"));
        assert!(solidity_test.contains("bytes32 message"));
        assert!(solidity_test.contains("bytes memory signature"));
        assert!(solidity_test.contains("_verifyBLS"));
    }

    #[test]
    fn print_test_vectors_for_solidity() {
        // This test prints vectors that can be copied to Solidity tests
        // Run with: cargo test -p common print_test_vectors_for_solidity -- --nocapture

        let vectors = generate_test_vectors();

        println!("\n// ============ RUST-GENERATED TEST VECTORS ============");
        println!("// Copy these to contracts/test/libraries/BLSLib.t.sol");
        println!();

        for v in &vectors {
            println!("{}", v.to_solidity_test());
        }

        println!("// ============ AGGREGATED TEST VECTORS ============");
        println!();

        let agg_vectors = generate_aggregated_test_vectors();
        for v in &agg_vectors {
            println!(
                r#"
    // Aggregated test vector: {} ({} signers)
    function test_rustVector_aggregated_{}() public view {{
        bytes memory aggPubkey = hex"{}";
        bytes32 message = 0x{};
        bytes memory aggSignature = hex"{}";

        bool valid = _verifyBLS(aggPubkey, message, aggSignature);
        assertTrue(valid, "Rust-generated aggregated signature should verify in Solidity");
    }}
"#,
                v.name,
                v.signers.len(),
                v.name.replace(' ', "_").replace('-', "_"),
                hex::encode(&v.aggregated_pubkey),
                hex::encode(v.message_hash),
                hex::encode(&v.aggregated_signature),
            );
        }
    }
}
