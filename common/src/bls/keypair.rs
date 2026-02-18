//! BLS keypair generation and serialization for BN254 curve

use ark_bn254::{Fr, G2Projective};
use ark_ec::PrimeGroup;
use ark_ff::{PrimeField, UniformRand};
use ark_std::rand::rngs::StdRng;
use ark_std::rand::SeedableRng;
use rand::RngCore;

use crate::error::Error;
use crate::types::BLSPublicKey;

/// BLS keypair for BN254 curve
///
/// Contains a private key (scalar field element) and
/// public key (G2 point = private_key * G2_generator).
#[derive(Clone)]
pub struct BLSKeyPair {
    /// Private key as scalar field element
    private_key: Fr,
    /// Public key as G2 point
    public_key: G2Projective,
}

impl BLSKeyPair {
    /// Size of private key in bytes (32 bytes - scalar field element)
    pub const PRIVATE_KEY_SIZE: usize = 32;

    /// Size of public key in bytes (128 bytes - uncompressed G2 point)
    /// Format: [x_im (32 bytes), x_re (32 bytes), y_im (32 bytes), y_re (32 bytes)]
    pub const PUBLIC_KEY_SIZE: usize = 128;

    /// Generate a new random keypair
    ///
    /// Uses system randomness for key generation.
    pub fn generate() -> Self {
        let mut rng = rand::thread_rng();
        let mut seed = [0u8; 32];
        rng.fill_bytes(&mut seed);

        let mut ark_rng = StdRng::from_seed(seed);
        let private_key = Fr::rand(&mut ark_rng);
        let public_key = G2Projective::generator() * private_key;

        Self {
            private_key,
            public_key,
        }
    }

    /// Generate keypair from a deterministic seed
    ///
    /// Useful for testing with known keys.
    ///
    /// # Arguments
    /// * `seed` - 32-byte seed for deterministic generation
    pub fn from_seed(seed: &[u8]) -> Result<Self, Error> {
        if seed.len() < 32 {
            return Err(Error::InvalidArgument(
                "seed must be at least 32 bytes".to_string(),
            ));
        }

        let mut seed_array = [0u8; 32];
        seed_array.copy_from_slice(&seed[..32]);

        let mut rng = StdRng::from_seed(seed_array);
        let private_key = Fr::rand(&mut rng);
        let public_key = G2Projective::generator() * private_key;

        Ok(Self {
            private_key,
            public_key,
        })
    }

    /// Deserialize keypair from private key bytes
    ///
    /// # Arguments
    /// * `bytes` - 32-byte private key (big-endian scalar)
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
        if bytes.len() != Self::PRIVATE_KEY_SIZE {
            return Err(Error::InvalidArgument(format!(
                "private key must be {} bytes, got {}",
                Self::PRIVATE_KEY_SIZE,
                bytes.len()
            )));
        }

        // Parse as big-endian scalar (matching Solidity convention)
        let private_key = Fr::from_be_bytes_mod_order(bytes);

        // Check for zero key
        if private_key == Fr::from(0u64) {
            return Err(Error::InvalidArgument(
                "private key cannot be zero".to_string(),
            ));
        }

        let public_key = G2Projective::generator() * private_key;

        Ok(Self {
            private_key,
            public_key,
        })
    }

    /// Serialize private key to bytes
    ///
    /// Returns 32 bytes in big-endian format.
    pub fn private_key_bytes(&self) -> Vec<u8> {
        // Convert Fr to big-endian bytes
        let bigint = self.private_key.into_bigint();
        let mut bytes = vec![0u8; Self::PRIVATE_KEY_SIZE];

        // BigInt limbs are in little-endian order (limb[0] is least significant)
        // Each limb is a u64 in native endianness
        let limbs = bigint.0;

        // Write limbs in reverse order (most significant first) and each limb in big-endian
        for (i, limb) in limbs.iter().rev().enumerate() {
            let limb_bytes = limb.to_be_bytes();
            bytes[i * 8..(i + 1) * 8].copy_from_slice(&limb_bytes);
        }

        bytes
    }

    /// Serialize public key to bytes
    ///
    /// Returns 128 bytes: [x_im, x_re, y_im, y_re] (32 bytes each)
    /// This format matches Solidity BLSLib.verifyBLS expectations.
    pub fn public_key_bytes(&self) -> Vec<u8> {
        serialize_g2_point(&self.public_key)
    }

    /// Get the public key as BLSPublicKey type
    pub fn public_key(&self) -> BLSPublicKey {
        BLSPublicKey(self.public_key_bytes())
    }

    /// Get the raw private key bytes for signing
    pub fn private_key_raw(&self) -> Vec<u8> {
        self.private_key_bytes()
    }

    /// Get the internal Fr element (for signing operations)
    pub(crate) fn private_key_fr(&self) -> &Fr {
        &self.private_key
    }
}

/// Serialize a G2 point to 128 bytes matching Solidity format
///
/// Format: [x_im (32 bytes), x_re (32 bytes), y_im (32 bytes), y_re (32 bytes)]
pub fn serialize_g2_point(point: &G2Projective) -> Vec<u8> {
    use ark_bn254::G2Affine;
    use ark_ff::PrimeField as _;

    let affine = G2Affine::from(*point);
    let mut result = vec![0u8; 128];

    // G2 point has coordinates in Fp2 = Fp + i*Fp
    // x = x_re + i*x_im, y = y_re + i*y_im

    // x imaginary part (c1)
    let x_im = affine.x.c1.into_bigint();
    write_bigint_be(&x_im, &mut result[0..32]);

    // x real part (c0)
    let x_re = affine.x.c0.into_bigint();
    write_bigint_be(&x_re, &mut result[32..64]);

    // y imaginary part (c1)
    let y_im = affine.y.c1.into_bigint();
    write_bigint_be(&y_im, &mut result[64..96]);

    // y real part (c0)
    let y_re = affine.y.c0.into_bigint();
    write_bigint_be(&y_re, &mut result[96..128]);

    result
}

/// Write a BigInt to a byte slice in big-endian format
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

/// Deserialize a G2 point from 128 bytes
pub fn deserialize_g2_point(bytes: &[u8]) -> Result<G2Projective, Error> {
    use ark_bn254::{Fq2, G2Affine};

    if bytes.len() != 128 {
        return Err(Error::InvalidArgument(format!(
            "G2 point must be 128 bytes, got {}",
            bytes.len()
        )));
    }

    // Parse each 32-byte component as big-endian field element
    let x_im = parse_fq(&bytes[0..32])?;
    let x_re = parse_fq(&bytes[32..64])?;
    let y_im = parse_fq(&bytes[64..96])?;
    let y_re = parse_fq(&bytes[96..128])?;

    let x = Fq2::new(x_re, x_im);
    let y = Fq2::new(y_re, y_im);

    let affine = G2Affine::new_unchecked(x, y);

    // Verify point is on curve
    if !affine.is_on_curve() {
        return Err(Error::InvalidArgument(
            "G2 point is not on curve".to_string(),
        ));
    }

    Ok(G2Projective::from(affine))
}

/// Parse 32 big-endian bytes as Fq field element
fn parse_fq(bytes: &[u8]) -> Result<ark_bn254::Fq, Error> {
    use ark_bn254::Fq;

    if bytes.len() != 32 {
        return Err(Error::InvalidArgument("Fq must be 32 bytes".to_string()));
    }

    let mut arr = [0u8; 32];
    arr.copy_from_slice(bytes);

    // Use from_be_bytes_mod_order which safely handles reduction
    Ok(Fq::from_be_bytes_mod_order(&arr))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair() {
        let kp1 = BLSKeyPair::generate();
        let kp2 = BLSKeyPair::generate();

        // Keys should be different
        assert_ne!(kp1.private_key_bytes(), kp2.private_key_bytes());
        assert_ne!(kp1.public_key_bytes(), kp2.public_key_bytes());
    }

    #[test]
    fn test_from_seed_deterministic() {
        let seed = [42u8; 32];

        let kp1 = BLSKeyPair::from_seed(&seed).unwrap();
        let kp2 = BLSKeyPair::from_seed(&seed).unwrap();

        assert_eq!(kp1.private_key_bytes(), kp2.private_key_bytes());
        assert_eq!(kp1.public_key_bytes(), kp2.public_key_bytes());
    }

    #[test]
    fn test_from_seed_different_seeds() {
        let seed1 = [1u8; 32];
        let seed2 = [2u8; 32];

        let kp1 = BLSKeyPair::from_seed(&seed1).unwrap();
        let kp2 = BLSKeyPair::from_seed(&seed2).unwrap();

        assert_ne!(kp1.private_key_bytes(), kp2.private_key_bytes());
    }

    #[test]
    fn test_private_key_serialization_roundtrip() {
        let kp = BLSKeyPair::generate();
        let bytes = kp.private_key_bytes();

        assert_eq!(bytes.len(), BLSKeyPair::PRIVATE_KEY_SIZE);

        let kp2 = BLSKeyPair::from_bytes(&bytes).unwrap();

        assert_eq!(kp.private_key_bytes(), kp2.private_key_bytes());
        assert_eq!(kp.public_key_bytes(), kp2.public_key_bytes());
    }

    #[test]
    fn test_public_key_size() {
        let kp = BLSKeyPair::generate();
        let pk_bytes = kp.public_key_bytes();

        assert_eq!(pk_bytes.len(), BLSKeyPair::PUBLIC_KEY_SIZE);
    }

    #[test]
    fn test_from_bytes_zero_key_rejected() {
        let zero_key = [0u8; 32];
        let result = BLSKeyPair::from_bytes(&zero_key);

        assert!(result.is_err());
    }

    #[test]
    fn test_from_bytes_invalid_length() {
        let short_key = [1u8; 16];
        let result = BLSKeyPair::from_bytes(&short_key);

        assert!(result.is_err());
    }

    #[test]
    fn test_from_seed_short_seed_rejected() {
        let short_seed = [1u8; 16];
        let result = BLSKeyPair::from_seed(&short_seed);

        assert!(result.is_err());
    }

    #[test]
    fn print_node_pubkeys_for_deployment() {
        // This test prints the G2 pubkeys for node-ids 0, 1, 2
        // Used to get the correct values for on-chain registration
        for node_id in 0..3u8 {
            let mut seed = [0u8; 32];
            seed[0] = node_id;
            seed[1] = 0x42;

            let keypair = BLSKeyPair::from_seed(&seed).expect("valid seed");
            let pubkey = keypair.public_key_bytes();

            println!("\n=== Node ID {} ===", node_id);
            println!("G2 Pubkey ({} bytes):", pubkey.len());
            println!("0x{}", hex::encode(&pubkey));
        }
    }
}
