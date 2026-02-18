//! BN254 BLS Signer implementation

use ark_bn254::{Fr, G1Projective, G2Projective};
use ark_ec::AffineRepr;
use ark_ff::PrimeField;

use crate::error::Error;
use crate::traits::BLSSigner;
use crate::types::{BLSPublicKey, BLSSignature};

use super::keypair::{deserialize_g2_point, BLSKeyPair};
use super::utils::{
    aggregate_signatures_internal, deserialize_g1_point, g1_to_signature, hash_to_g1,
    hash_to_g1_solidity, signature_to_g1,
};

/// BLS signer using BN254 curve
///
/// Implements the BLSSigner trait with real BLS cryptography
/// compatible with Solidity BLSLib.sol verification.
#[derive(Clone, Default)]
pub struct Bn254BLSSigner;

impl Bn254BLSSigner {
    /// Create a new BN254 BLS signer
    pub fn new() -> Self {
        Self
    }

    /// Sign a message using an Fr private key directly
    ///
    /// More efficient than going through bytes.
    /// NOTE: This hashes the message with keccak256 first. For pre-hashed messages
    /// (e.g., from build_message_hash), use sign_message_hash instead.
    pub fn sign_with_keypair(
        &self,
        keypair: &BLSKeyPair,
        message: &[u8],
    ) -> Result<BLSSignature, Error> {
        // Hash message to G1 point
        let msg_point = hash_to_g1_solidity(message)?;

        // Signature = private_key * H(message)
        let signature_point = msg_point * keypair.private_key_fr();

        Ok(g1_to_signature(&signature_point))
    }

    /// Sign a pre-computed message hash (32 bytes)
    ///
    /// Use this when you already have a keccak256 hash (e.g., from build_message_hash).
    /// This matches Solidity's flow where:
    /// 1. messageHash = keccak256(abi.encodePacked(...))
    /// 2. hashToG1(messageHash) derives the G1 point
    ///
    /// IMPORTANT: Do NOT use sign_with_keypair for pre-hashed messages, as it adds
    /// an extra keccak256 that breaks Solidity compatibility.
    pub fn sign_message_hash(
        &self,
        keypair: &BLSKeyPair,
        message_hash: &[u8; 32],
    ) -> Result<BLSSignature, Error> {
        // Derive G1 point directly from hash (matches Solidity hashToG1)
        let msg_point = hash_to_g1(message_hash)?;

        // Signature = private_key * H(message)
        let signature_point = msg_point * keypair.private_key_fr();

        Ok(g1_to_signature(&signature_point))
    }

    /// Verify a BLS signature for a pre-computed message hash
    ///
    /// Use this when you have a 32-byte keccak256 hash (e.g., from build_message_hash).
    /// This matches Solidity's verification flow.
    pub fn verify_message_hash(
        &self,
        public_key: &BLSPublicKey,
        message_hash: &[u8; 32],
        signature: &BLSSignature,
    ) -> Result<bool, Error> {
        // Validate input lengths
        if public_key.0.len() != 128 {
            return Err(Error::BlsVerification(format!(
                "public key must be 128 bytes, got {}",
                public_key.0.len()
            )));
        }

        if signature.0.len() != 64 {
            return Err(Error::BlsVerification(format!(
                "signature must be 64 bytes, got {}",
                signature.0.len()
            )));
        }

        // Parse public key (G2 point)
        let pk = match deserialize_g2_point(&public_key.0) {
            Ok(pk) => pk,
            Err(_) => return Ok(false),
        };

        // Parse signature (G1 point)
        let sig = match deserialize_g1_point(&signature.0) {
            Ok(sig) => sig,
            Err(_) => return Ok(false),
        };

        // Verify with pairing using hash directly
        self.verify_pairing_hash(&pk, message_hash, &sig)
    }

    /// Verify a BLS signature with pairing check (for pre-hashed messages)
    fn verify_pairing_hash(
        &self,
        public_key: &G2Projective,
        message_hash: &[u8; 32],
        signature: &G1Projective,
    ) -> Result<bool, Error> {
        use ark_bn254::{Bn254, G1Affine, G2Affine};
        use ark_ec::pairing::Pairing;

        // Hash directly to G1 (no extra keccak)
        let msg_point = hash_to_g1(message_hash)?;

        // Convert to affine for pairing
        let sig_affine = G1Affine::from(*signature);
        let msg_affine = G1Affine::from(msg_point);
        let g2_gen_affine = G2Affine::generator();
        let pk_affine = G2Affine::from(*public_key);

        // Compute pairings
        let lhs = Bn254::pairing(sig_affine, g2_gen_affine);
        let rhs = Bn254::pairing(msg_affine, pk_affine);

        Ok(lhs == rhs)
    }

    /// Verify a BLS signature with pairing check
    ///
    /// Verifies: e(signature, G2) == e(H(message), pubkey)
    ///
    /// This is equivalent to checking:
    /// e(-signature, G2) * e(H(message), pubkey) == 1
    pub fn verify_pairing(
        &self,
        public_key: &G2Projective,
        message: &[u8],
        signature: &G1Projective,
    ) -> Result<bool, Error> {
        use ark_bn254::{Bn254, G1Affine, G2Affine};
        use ark_ec::pairing::Pairing;

        // Hash message to G1
        let msg_point = hash_to_g1_solidity(message)?;

        // Convert to affine for pairing
        let sig_affine = G1Affine::from(*signature);
        let msg_affine = G1Affine::from(msg_point);
        let g2_gen_affine = G2Affine::generator();
        let pk_affine = G2Affine::from(*public_key);

        // Compute pairings
        // e(sig, G2) should equal e(H(msg), pk)
        let lhs = Bn254::pairing(sig_affine, g2_gen_affine);
        let rhs = Bn254::pairing(msg_affine, pk_affine);

        Ok(lhs == rhs)
    }
}

impl BLSSigner for Bn254BLSSigner {
    fn sign(&self, private_key: &[u8], message: &[u8]) -> Result<BLSSignature, Error> {
        // Parse private key
        if private_key.len() != 32 {
            return Err(Error::BlsSigning(format!(
                "private key must be 32 bytes, got {}",
                private_key.len()
            )));
        }

        // Convert private key bytes to Fr
        let sk = Fr::from_be_bytes_mod_order(private_key);
        if sk == Fr::from(0u64) {
            return Err(Error::BlsSigning("private key cannot be zero".to_string()));
        }

        // Hash message to G1 point
        let msg_point = hash_to_g1_solidity(message)?;

        // Signature = private_key * H(message)
        let signature_point = msg_point * sk;

        Ok(g1_to_signature(&signature_point))
    }

    fn aggregate_signatures(&self, signatures: Vec<BLSSignature>) -> Result<BLSSignature, Error> {
        if signatures.is_empty() {
            return Err(Error::SignatureAggregation(
                "no signatures to aggregate".to_string(),
            ));
        }

        // Parse all signatures to G1 points
        let mut points = Vec::with_capacity(signatures.len());
        for sig in &signatures {
            let point = signature_to_g1(sig)?;
            points.push(point);
        }

        // Aggregate (point addition)
        let aggregated = aggregate_signatures_internal(&points)?;

        Ok(g1_to_signature(&aggregated))
    }

    fn verify(
        &self,
        public_key: &BLSPublicKey,
        message: &[u8],
        signature: &BLSSignature,
    ) -> Result<bool, Error> {
        // Validate input lengths
        if public_key.0.len() != 128 {
            return Err(Error::BlsVerification(format!(
                "public key must be 128 bytes, got {}",
                public_key.0.len()
            )));
        }

        if signature.0.len() != 64 {
            return Err(Error::BlsVerification(format!(
                "signature must be 64 bytes, got {}",
                signature.0.len()
            )));
        }

        // Parse public key (G2 point)
        let pk = match deserialize_g2_point(&public_key.0) {
            Ok(pk) => pk,
            Err(_) => return Ok(false), // Invalid pubkey = invalid signature
        };

        // Parse signature (G1 point)
        let sig = match deserialize_g1_point(&signature.0) {
            Ok(sig) => sig,
            Err(_) => return Ok(false), // Invalid signature format
        };

        // Verify with pairing
        self.verify_pairing(&pk, message, &sig)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_and_verify() {
        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();

        let message = b"test message for BLS signature";
        let signature = signer
            .sign_with_keypair(&keypair, message)
            .expect("signing should succeed");

        assert_eq!(signature.0.len(), 64, "signature should be 64 bytes");

        let valid = signer
            .verify(&keypair.public_key(), message, &signature)
            .expect("verification should succeed");

        assert!(valid, "signature should be valid");
    }

    #[test]
    fn test_sign_via_trait() {
        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();

        let message = b"trait-based signing test";
        let signature = signer
            .sign(&keypair.private_key_raw(), message)
            .expect("signing should succeed");

        let valid = signer
            .verify(&keypair.public_key(), message, &signature)
            .expect("verification should succeed");

        assert!(valid, "signature should be valid");
    }

    #[test]
    fn test_signature_determinism() {
        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::from_seed(&[42u8; 32]).unwrap();

        let message = b"determinism test";

        let sig1 = signer.sign_with_keypair(&keypair, message).unwrap();
        let sig2 = signer.sign_with_keypair(&keypair, message).unwrap();

        assert_eq!(sig1.0, sig2.0, "same key + message should produce same signature");
    }

    #[test]
    fn test_different_messages_different_signatures() {
        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();

        let sig1 = signer.sign_with_keypair(&keypair, b"message 1").unwrap();
        let sig2 = signer.sign_with_keypair(&keypair, b"message 2").unwrap();

        assert_ne!(sig1.0, sig2.0, "different messages should produce different signatures");
    }

    #[test]
    fn test_different_keys_different_signatures() {
        let signer = Bn254BLSSigner::new();
        let kp1 = BLSKeyPair::generate();
        let kp2 = BLSKeyPair::generate();

        let message = b"same message";

        let sig1 = signer.sign_with_keypair(&kp1, message).unwrap();
        let sig2 = signer.sign_with_keypair(&kp2, message).unwrap();

        assert_ne!(sig1.0, sig2.0, "different keys should produce different signatures");
    }

    #[test]
    fn test_wrong_message_fails_verification() {
        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();

        let signature = signer
            .sign_with_keypair(&keypair, b"original message")
            .unwrap();

        let valid = signer
            .verify(&keypair.public_key(), b"wrong message", &signature)
            .unwrap();

        assert!(!valid, "wrong message should fail verification");
    }

    #[test]
    fn test_wrong_key_fails_verification() {
        let signer = Bn254BLSSigner::new();
        let kp1 = BLSKeyPair::generate();
        let kp2 = BLSKeyPair::generate();

        let message = b"test message";
        let signature = signer.sign_with_keypair(&kp1, message).unwrap();

        let valid = signer.verify(&kp2.public_key(), message, &signature).unwrap();

        assert!(!valid, "wrong public key should fail verification");
    }

    #[test]
    fn test_aggregate_signatures() {
        let signer = Bn254BLSSigner::new();

        let kp1 = BLSKeyPair::generate();
        let kp2 = BLSKeyPair::generate();
        let kp3 = BLSKeyPair::generate();

        let message = b"message to be signed by all";

        let sig1 = signer.sign_with_keypair(&kp1, message).unwrap();
        let sig2 = signer.sign_with_keypair(&kp2, message).unwrap();
        let sig3 = signer.sign_with_keypair(&kp3, message).unwrap();

        let aggregated = signer
            .aggregate_signatures(vec![sig1, sig2, sig3])
            .expect("aggregation should succeed");

        assert_eq!(aggregated.0.len(), 64, "aggregated signature should be 64 bytes");

        // Note: Verifying aggregated signature requires aggregated pubkey
        // which is tested separately
    }

    #[test]
    fn test_aggregate_empty_fails() {
        let signer = Bn254BLSSigner::new();
        let result = signer.aggregate_signatures(vec![]);
        assert!(result.is_err(), "empty aggregation should fail");
    }

    #[test]
    fn test_aggregate_single_unchanged() {
        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();

        let signature = signer
            .sign_with_keypair(&keypair, b"test")
            .unwrap();

        let aggregated = signer
            .aggregate_signatures(vec![signature.clone()])
            .unwrap();

        assert_eq!(
            signature.0, aggregated.0,
            "single signature aggregation should return unchanged"
        );
    }

    #[test]
    fn test_aggregated_signature_verification() {
        use super::super::utils::aggregate_pubkeys;

        let signer = Bn254BLSSigner::new();

        let kp1 = BLSKeyPair::generate();
        let kp2 = BLSKeyPair::generate();

        let message = b"aggregated verification test";

        // Sign with both keys
        let sig1 = signer.sign_with_keypair(&kp1, message).unwrap();
        let sig2 = signer.sign_with_keypair(&kp2, message).unwrap();

        // Aggregate signatures
        let agg_sig = signer
            .aggregate_signatures(vec![sig1, sig2])
            .unwrap();

        // Aggregate public keys
        let agg_pk = aggregate_pubkeys(&[kp1.public_key(), kp2.public_key()])
            .expect("pubkey aggregation should succeed");

        // Verify aggregated signature with aggregated pubkey
        let valid = signer
            .verify(&agg_pk, message, &agg_sig)
            .expect("verification should succeed");

        assert!(valid, "aggregated signature should verify with aggregated pubkey");
    }

    #[test]
    fn test_invalid_private_key_length() {
        let signer = Bn254BLSSigner::new();
        let short_key = vec![1u8; 16];

        let result = signer.sign(&short_key, b"test");
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_public_key_length() {
        let signer = Bn254BLSSigner::new();
        let short_pk = BLSPublicKey(vec![0u8; 64]);
        let signature = BLSSignature(vec![0u8; 64]);

        let result = signer.verify(&short_pk, b"test", &signature);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_signature_length() {
        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();
        let short_sig = BLSSignature(vec![0u8; 32]);

        let result = signer.verify(&keypair.public_key(), b"test", &short_sig);
        assert!(result.is_err());
    }

    /// Regression test for BLS message hash signing (session 20260203-0200-bls3)
    ///
    /// This test verifies that sign_message_hash and verify_message_hash work correctly
    /// for pre-computed keccak256 hashes. The bug was that hash_to_g1_solidity was adding
    /// an extra keccak256 when the input was already a hash, causing Rust-Solidity mismatch.
    #[test]
    fn test_sign_and_verify_message_hash() {
        let signer = Bn254BLSSigner::new();
        let keypair = BLSKeyPair::generate();

        // Simulate a pre-computed message hash (like from build_message_hash)
        let message_hash: [u8; 32] = ethers::utils::keccak256(b"test message for BLS signing");

        // Sign using the message hash method
        let signature = signer
            .sign_message_hash(&keypair, &message_hash)
            .expect("signing should succeed");

        assert_eq!(signature.0.len(), 64, "signature should be 64 bytes");

        // Verify using the message hash method
        let valid = signer
            .verify_message_hash(&keypair.public_key(), &message_hash, &signature)
            .expect("verification should succeed");

        assert!(valid, "signature should be valid with message hash methods");

        // CRITICAL: Verify that using the wrong method fails
        // If we sign with message_hash but verify with regular verify (which adds extra hash),
        // it should fail. This catches the original bug.
        let invalid = signer
            .verify(&keypair.public_key(), &message_hash, &signature)
            .expect("verification should complete");

        assert!(
            !invalid,
            "sign_message_hash signature should NOT verify with regular verify method \
            (this catches the double-hashing bug)"
        );
    }

    /// Test that aggregated signatures with message hash methods work correctly
    #[test]
    fn test_aggregated_signature_message_hash() {
        use super::super::utils::aggregate_pubkeys;

        let signer = Bn254BLSSigner::new();

        let kp1 = BLSKeyPair::generate();
        let kp2 = BLSKeyPair::generate();

        // Pre-computed message hash
        let message_hash: [u8; 32] = ethers::utils::keccak256(b"aggregated test");

        // Sign with both keys using message hash method
        let sig1 = signer.sign_message_hash(&kp1, &message_hash).unwrap();
        let sig2 = signer.sign_message_hash(&kp2, &message_hash).unwrap();

        // Aggregate signatures
        let agg_sig = signer
            .aggregate_signatures(vec![sig1, sig2])
            .unwrap();

        // Aggregate public keys
        let agg_pk = aggregate_pubkeys(&[kp1.public_key(), kp2.public_key()])
            .expect("pubkey aggregation should succeed");

        // Verify aggregated signature with aggregated pubkey using message hash method
        let valid = signer
            .verify_message_hash(&agg_pk, &message_hash, &agg_sig)
            .expect("verification should succeed");

        assert!(valid, "aggregated signature should verify with message hash method");
    }
}
