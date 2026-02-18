//! BLS utility functions: hash-to-curve, aggregation, serialization

use ark_bn254::{Fq, G1Affine, G1Projective};
use ark_ff::{BigInteger256, Field, PrimeField};

use crate::error::Error;
use crate::types::{BLSPublicKey, BLSSignature};

use super::keypair::deserialize_g2_point;


/// Hash a message to a G1 curve point using try-and-increment
///
/// This matches the Solidity BLSLib.hashToG1 implementation:
/// 1. x = uint256(keccak256(abi.encode(message))) % P
/// 2. Try incrementing x until we find a valid y coordinate
///
/// # Arguments
/// * `message` - The message hash (bytes32 in Solidity terms)
///
/// # Returns
/// A G1 point on the BN254 curve
///
/// # Note on Iteration Limit
/// The function tries up to 256 x-coordinates before failing. For BN254,
/// approximately half of x-coordinates yield valid points (quadratic residues),
/// so the probability of needing 256 attempts is astronomically small (~2^-256).
/// In practice, most inputs find a valid point within 1-3 iterations.
pub fn hash_to_g1(message: &[u8; 32]) -> Result<G1Projective, Error> {
    // Match Solidity: x = uint256(keccak256(abi.encode(message))) % P
    // abi.encode(bytes32) pads to 32 bytes (no-op for bytes32)
    let encoded = ethers::abi::encode(&[ethers::abi::Token::FixedBytes(message.to_vec())]);
    let hash = ethers::utils::keccak256(&encoded);

    // Reduce mod P
    let mut x = bytes_to_fq(&hash);

    // Try-and-increment: find x where x³ + 3 has a square root
    for _ in 0..256 {
        // y² = x³ + 3
        let x_cubed = x * x * x;
        let y_squared = x_cubed + Fq::from(3u64);

        // Try to compute square root
        if let Some(y) = sqrt_fq(&y_squared) {
            // Verify y² = y_squared
            if y * y == y_squared {
                let point = G1Affine::new_unchecked(x, y);
                if point.is_on_curve() {
                    return Ok(G1Projective::from(point));
                }
            }
        }

        // Increment x
        x += Fq::from(1u64);
    }

    Err(Error::BlsSigning(
        "hashToG1: no valid point found after 256 attempts".to_string(),
    ))
}

/// Hash a message to G1 using Solidity-compatible keccak256
///
/// This version takes raw message bytes and hashes them.
/// The flow is:
/// 1. `msgHash = keccak256(message)` - hash the raw message
/// 2. `hash_to_g1(msgHash)` - which internally does `keccak256(abi.encode(msgHash))`
///
/// For Solidity compatibility, ensure the Solidity side uses:
/// ```solidity
/// bytes32 msgHash = keccak256(message);
/// G1Point memory point = BLSLib.hashToG1(msgHash);
/// ```
///
/// This matches the Solidity BLSLib.hashToG1 which expects a bytes32.
pub fn hash_to_g1_solidity(message: &[u8]) -> Result<G1Projective, Error> {
    // Use ethers keccak256 for Solidity compatibility
    let hash = ethers::utils::keccak256(message);
    hash_to_g1(&hash)
}

/// Compute modular square root using Tonelli-Shanks for BN254
///
/// For BN254, P ≡ 3 (mod 4), so sqrt(a) = a^((P+1)/4) mod P
fn sqrt_fq(a: &Fq) -> Option<Fq> {
    if *a == Fq::from(0u64) {
        return Some(Fq::from(0u64));
    }

    // (P+1)/4 as BigInteger
    // 0x0c19139cb84c680a6e14116da060561765e05aa45a1c72a34f082305b61f3f52
    let exp = BigInteger256::new([
        0x4f082305b61f3f52,
        0x65e05aa45a1c72a3,
        0x6e14116da0605617,
        0x0c19139cb84c680a,
    ]);

    let result = (*a).pow(exp);

    // Verify it's actually a square root
    if result * result == *a {
        Some(result)
    } else {
        None
    }
}

/// Convert 32 big-endian bytes to Fq field element
fn bytes_to_fq(bytes: &[u8; 32]) -> Fq {
    // Use from_be_bytes_mod_order which safely reduces mod P
    Fq::from_be_bytes_mod_order(bytes)
}

/// Serialize a G1 point to 64 bytes (uncompressed)
///
/// Format: [x (32 bytes big-endian), y (32 bytes big-endian)]
pub fn serialize_g1_point(point: &G1Projective) -> Vec<u8> {
    let affine = G1Affine::from(*point);
    let mut result = vec![0u8; 64];

    // x coordinate
    let x_bigint = affine.x.into_bigint();
    write_bigint_be(&x_bigint, &mut result[0..32]);

    // y coordinate
    let y_bigint = affine.y.into_bigint();
    write_bigint_be(&y_bigint, &mut result[32..64]);

    result
}

/// Write a BigInt to a byte slice in big-endian format
///
/// Note: This function is also defined in keypair.rs. Both are kept as
/// private functions in their respective modules for encapsulation.
fn write_bigint_be<const N: usize>(bigint: &ark_ff::BigInt<N>, output: &mut [u8]) {
    // Limbs are in little-endian order (limb[0] is least significant)
    // Write limbs in reverse order (most significant first) with each limb in big-endian
    let limbs = bigint.0;
    for (i, limb) in limbs.iter().rev().enumerate() {
        let bytes = limb.to_be_bytes();
        let start = i * 8;
        let end = (start + 8).min(output.len());
        let copy_len = end - start;
        if copy_len > 0 {
            output[start..end].copy_from_slice(&bytes[..copy_len]);
        }
    }
}

/// Deserialize a G1 point from 64 bytes
///
/// Verifies the point is on the curve and in the correct subgroup.
/// For BN254 G1, the subgroup check is implicit since G1 has prime order.
pub fn deserialize_g1_point(bytes: &[u8]) -> Result<G1Projective, Error> {
    if bytes.len() != 64 {
        return Err(Error::InvalidArgument(format!(
            "G1 point must be 64 bytes, got {}",
            bytes.len()
        )));
    }

    let mut x_bytes = [0u8; 32];
    let mut y_bytes = [0u8; 32];
    x_bytes.copy_from_slice(&bytes[0..32]);
    y_bytes.copy_from_slice(&bytes[32..64]);

    let x = bytes_to_fq(&x_bytes);
    let y = bytes_to_fq(&y_bytes);

    let affine = G1Affine::new_unchecked(x, y);

    // Handle point at infinity
    if x == Fq::from(0u64) && y == Fq::from(0u64) {
        return Ok(G1Projective::from(affine));
    }

    // Verify point is on curve
    if !affine.is_on_curve() {
        return Err(Error::InvalidArgument(
            "G1 point is not on curve".to_string(),
        ));
    }

    // For BN254, G1 has prime order r, so any point on the curve (except identity)
    // is in the correct subgroup. No explicit subgroup check needed.
    // This is different from curves like BLS12-381 where G1 has cofactor.

    Ok(G1Projective::from(affine))
}

/// Aggregate multiple BLS signatures into one
///
/// Aggregated signature = sig1 + sig2 + ... + sigN (point addition on G1)
///
/// # Arguments
/// * `signatures` - List of signatures to aggregate
///
/// # Returns
/// Single aggregated signature
pub fn aggregate_signatures_internal(
    signatures: &[G1Projective],
) -> Result<G1Projective, Error> {
    if signatures.is_empty() {
        return Err(Error::SignatureAggregation(
            "no signatures to aggregate".to_string(),
        ));
    }

    let mut aggregated = signatures[0];
    for sig in &signatures[1..] {
        aggregated += sig;
    }

    Ok(aggregated)
}

/// Aggregate multiple BLS public keys
///
/// Aggregated pubkey = pk1 + pk2 + ... + pkN (point addition on G2)
///
/// # Arguments
/// * `pubkeys` - List of public keys to aggregate
///
/// # Returns
/// Single aggregated public key
///
/// # Security: Rogue-Key Attack Prevention
///
/// **WARNING**: Plain BLS aggregation is vulnerable to rogue-key attacks.
/// An attacker who knows other signers' public keys can generate a malicious
/// key that allows forging aggregated signatures.
///
/// To prevent this, the protocol MUST use one of:
/// 1. **Proof-of-Possession (PoP)**: Each signer proves knowledge of their private key
///    by signing their public key. This is verified during issuer registration.
/// 2. **Key Aggregation with Coefficients**: Use MuSig2-style aggregation with
///    commitment-based coefficients.
///
/// This implementation assumes PoP is verified at the protocol level during
/// issuer onboarding (IssuerRegistry.registerIssuer verifies PoP signature).
pub fn aggregate_pubkeys(pubkeys: &[BLSPublicKey]) -> Result<BLSPublicKey, Error> {
    if pubkeys.is_empty() {
        return Err(Error::SignatureAggregation(
            "no public keys to aggregate".to_string(),
        ));
    }

    // Parse first pubkey
    let mut aggregated = deserialize_g2_point(&pubkeys[0].0)?;

    // Add remaining pubkeys
    for pk in &pubkeys[1..] {
        let point = deserialize_g2_point(&pk.0)?;
        aggregated += point;
    }

    // Serialize result
    Ok(BLSPublicKey(super::keypair::serialize_g2_point(&aggregated)))
}

/// Convert BLSSignature to G1 point
pub fn signature_to_g1(sig: &BLSSignature) -> Result<G1Projective, Error> {
    deserialize_g1_point(&sig.0)
}

/// Convert G1 point to BLSSignature
pub fn g1_to_signature(point: &G1Projective) -> BLSSignature {
    BLSSignature(serialize_g1_point(point))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_to_g1_produces_valid_point() {
        let message = [42u8; 32];
        let point = hash_to_g1(&message).unwrap();

        // Convert to affine and verify on curve
        let affine = G1Affine::from(point);
        assert!(affine.is_on_curve(), "hashed point should be on curve");
    }

    #[test]
    fn test_hash_to_g1_deterministic() {
        let message = [123u8; 32];
        let point1 = hash_to_g1(&message).unwrap();
        let point2 = hash_to_g1(&message).unwrap();

        assert_eq!(
            serialize_g1_point(&point1),
            serialize_g1_point(&point2),
            "hash should be deterministic"
        );
    }

    #[test]
    fn test_hash_to_g1_different_messages() {
        let msg1 = [1u8; 32];
        let msg2 = [2u8; 32];

        let point1 = hash_to_g1(&msg1).unwrap();
        let point2 = hash_to_g1(&msg2).unwrap();

        assert_ne!(
            serialize_g1_point(&point1),
            serialize_g1_point(&point2),
            "different messages should produce different points"
        );
    }

    #[test]
    fn test_g1_serialization_roundtrip() {
        let message = [77u8; 32];
        let point = hash_to_g1(&message).unwrap();

        let bytes = serialize_g1_point(&point);
        assert_eq!(bytes.len(), 64);

        let recovered = deserialize_g1_point(&bytes).unwrap();
        let recovered_bytes = serialize_g1_point(&recovered);

        assert_eq!(bytes, recovered_bytes, "G1 roundtrip should preserve point");
    }

    #[test]
    fn test_deserialize_g1_invalid_length() {
        let short = vec![0u8; 32];
        assert!(deserialize_g1_point(&short).is_err());

        let long = vec![0u8; 128];
        assert!(deserialize_g1_point(&long).is_err());
    }

    #[test]
    fn test_aggregate_signatures_empty() {
        let result = aggregate_signatures_internal(&[]);
        assert!(result.is_err());
    }

    #[test]
    fn test_aggregate_signatures_single() {
        let message = [99u8; 32];
        let sig = hash_to_g1(&message).unwrap();

        let aggregated = aggregate_signatures_internal(&[sig]).unwrap();

        assert_eq!(
            serialize_g1_point(&sig),
            serialize_g1_point(&aggregated),
            "single signature aggregation should return unchanged"
        );
    }
}
