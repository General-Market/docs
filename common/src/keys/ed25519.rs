//! Ed25519 keypair operations for Solana/Squads signing
//!
//! Uses ed25519-dalek for cryptographic operations (same library Solana uses internally).

use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use thiserror::Error;
use zeroize::ZeroizeOnDrop;

use super::storage::Ed25519KeyStorage;

/// Ed25519 key manager errors
#[derive(Debug, Error)]
pub enum Ed25519Error {
    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Invalid public key: {0}")]
    InvalidPublicKey(String),

    #[error("Invalid private key")]
    InvalidPrivateKey,

    #[error("Base58 decode error: {0}")]
    Base58DecodeError(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Key not found")]
    KeyNotFound,
}

/// Ed25519 keypair with zeroization on drop
///
/// The signing key (private key) is automatically cleared from memory
/// when this struct is dropped.
#[derive(ZeroizeOnDrop)]
pub struct Ed25519Keypair {
    #[zeroize(skip)] // VerifyingKey doesn't contain sensitive data
    verifying_key: VerifyingKey,
    signing_key: SigningKey,
}

impl Ed25519Keypair {
    /// Generate a new Ed25519 keypair using OS-provided cryptographically secure RNG
    pub fn generate() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();

        Self {
            verifying_key,
            signing_key,
        }
    }

    /// Create a keypair from raw private key bytes (32 bytes)
    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self, Ed25519Error> {
        let signing_key = SigningKey::from_bytes(bytes);
        let verifying_key = signing_key.verifying_key();

        Ok(Self {
            verifying_key,
            signing_key,
        })
    }

    /// Sign a message and return a 64-byte signature
    pub fn sign(&self, message: &[u8]) -> Signature {
        self.signing_key.sign(message)
    }

    /// Verify a signature against a message
    pub fn verify(&self, message: &[u8], signature: &Signature) -> bool {
        self.verifying_key.verify(message, signature).is_ok()
    }

    /// Export the public key in Solana format (Base58 encoded)
    ///
    /// Returns a string like "4K3Dyjzvzp8eMZFZw2qepWH8rMAzCGMTcB2EscMTHX9j"
    pub fn export_pubkey(&self) -> String {
        bs58::encode(self.verifying_key.as_bytes()).into_string()
    }

    /// Get the raw public key bytes (32 bytes)
    pub fn public_key_bytes(&self) -> [u8; 32] {
        self.verifying_key.to_bytes()
    }

    /// Get the raw private key bytes (32 bytes)
    ///
    /// # Security Warning
    /// Handle with extreme care. The returned bytes contain the private key.
    /// Avoid logging or storing in insecure locations.
    pub fn private_key_bytes(&self) -> [u8; 32] {
        self.signing_key.to_bytes()
    }

    /// Get the verifying (public) key reference
    pub fn verifying_key(&self) -> &VerifyingKey {
        &self.verifying_key
    }
}

/// Parse a Solana-format public key (Base58 encoded) into a VerifyingKey
pub fn pubkey_from_base58(s: &str) -> Result<VerifyingKey, Ed25519Error> {
    let bytes = bs58::decode(s)
        .into_vec()
        .map_err(|e| Ed25519Error::Base58DecodeError(e.to_string()))?;

    if bytes.len() != 32 {
        return Err(Ed25519Error::InvalidPublicKey(format!(
            "Expected 32 bytes, got {}",
            bytes.len()
        )));
    }

    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);

    VerifyingKey::from_bytes(&arr).map_err(|e| Ed25519Error::InvalidPublicKey(e.to_string()))
}

/// Verify a signature using a public key, message, and signature
///
/// This is a standalone verification function for cases where you only have
/// the public key (not the full keypair).
pub fn verify_signature(public_key: &VerifyingKey, message: &[u8], signature: &Signature) -> bool {
    public_key.verify(message, signature).is_ok()
}

/// Ed25519 key manager with pluggable storage backend
pub struct Ed25519KeyManager<S: Ed25519KeyStorage> {
    storage: S,
}

impl<S: Ed25519KeyStorage> Ed25519KeyManager<S> {
    /// Create a new key manager with the given storage backend
    pub fn new(storage: S) -> Self {
        Self { storage }
    }

    /// Load an existing keypair or generate a new one if none exists
    pub fn load_or_generate(&self) -> Result<Ed25519Keypair, Ed25519Error> {
        match self.storage.load_keypair() {
            Ok(keypair) => Ok(keypair),
            Err(Ed25519Error::KeyNotFound) => {
                let keypair = Ed25519Keypair::generate();
                self.storage.save_keypair(&keypair)?;
                // Load from storage to return a clean copy (original was passed by ref to save)
                self.storage.load_keypair()
            }
            Err(e) => Err(e),
        }
    }

    /// Load an existing keypair (returns error if none exists)
    pub fn load_keypair(&self) -> Result<Ed25519Keypair, Ed25519Error> {
        self.storage.load_keypair()
    }

    /// Save a keypair to storage
    pub fn save_keypair(&self, keypair: &Ed25519Keypair) -> Result<(), Ed25519Error> {
        self.storage.save_keypair(keypair)
    }

    /// Generate a new keypair and save it (overwrites any existing keypair)
    pub fn generate_and_save(&self) -> Result<Ed25519Keypair, Ed25519Error> {
        let keypair = Ed25519Keypair::generate();
        self.storage.save_keypair(&keypair)?;
        // Return a fresh copy (the original gets moved during save)
        Ed25519Keypair::from_bytes(&keypair.private_key_bytes())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys::InMemoryStorage;

    #[test]
    fn test_keypair_generation() {
        let keypair = Ed25519Keypair::generate();

        // Public key should be 32 bytes
        assert_eq!(keypair.public_key_bytes().len(), 32);

        // Base58 export should produce a non-empty string
        let pubkey_b58 = keypair.export_pubkey();
        assert!(!pubkey_b58.is_empty());
    }

    #[test]
    fn test_sign_and_verify() {
        let keypair = Ed25519Keypair::generate();
        let message = b"Hello, Solana!";

        let signature = keypair.sign(message);

        // Signature should be 64 bytes
        assert_eq!(signature.to_bytes().len(), 64);

        // Verification should succeed with correct message
        assert!(keypair.verify(message, &signature));
    }

    #[test]
    fn test_verify_rejects_wrong_message() {
        let keypair = Ed25519Keypair::generate();
        let message = b"Hello, Solana!";
        let wrong_message = b"Hello, Ethereum!";

        let signature = keypair.sign(message);

        // Verification should fail with wrong message
        assert!(!keypair.verify(wrong_message, &signature));
    }

    #[test]
    fn test_verify_rejects_wrong_pubkey() {
        let keypair1 = Ed25519Keypair::generate();
        let keypair2 = Ed25519Keypair::generate();
        let message = b"Hello, Solana!";

        let signature = keypair1.sign(message);

        // Verification should fail with wrong keypair's public key
        assert!(!keypair2.verify(message, &signature));
    }

    #[test]
    fn test_base58_roundtrip() {
        let keypair = Ed25519Keypair::generate();

        let pubkey_b58 = keypair.export_pubkey();
        let recovered = pubkey_from_base58(&pubkey_b58).unwrap();

        assert_eq!(recovered.as_bytes(), keypair.verifying_key().as_bytes());
    }

    #[test]
    fn test_base58_invalid_length() {
        // Valid Base58 characters but too short (only 6 bytes when decoded)
        let result = pubkey_from_base58("abc123");
        assert!(matches!(result, Err(Ed25519Error::InvalidPublicKey(_))));
    }

    #[test]
    fn test_base58_invalid_characters() {
        // Invalid Base58 character (underscore is not valid)
        let result = pubkey_from_base58("too_short");
        assert!(matches!(result, Err(Ed25519Error::Base58DecodeError(_))));
    }

    #[test]
    fn test_from_bytes_roundtrip() {
        let original = Ed25519Keypair::generate();
        let bytes = original.private_key_bytes();

        let restored = Ed25519Keypair::from_bytes(&bytes).unwrap();

        assert_eq!(original.public_key_bytes(), restored.public_key_bytes());

        // Sign with both and verify signatures are identical for same message
        let message = b"test message";
        let sig1 = original.sign(message);
        let sig2 = restored.sign(message);
        assert_eq!(sig1.to_bytes(), sig2.to_bytes());
    }

    #[test]
    fn test_standalone_verify_signature() {
        let keypair = Ed25519Keypair::generate();
        let message = b"test message";
        let signature = keypair.sign(message);

        // Verify using standalone function
        assert!(verify_signature(
            keypair.verifying_key(),
            message,
            &signature
        ));
        assert!(!verify_signature(
            keypair.verifying_key(),
            b"wrong message",
            &signature
        ));
    }

    #[test]
    fn test_rfc8032_test_vector() {
        // RFC 8032 Test Vector 1 (empty message)
        let secret_hex = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
        let expected_pubkey_hex =
            "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
        let expected_sig_hex = "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";

        let secret_bytes: [u8; 32] = hex::decode(secret_hex).unwrap().try_into().unwrap();

        let keypair = Ed25519Keypair::from_bytes(&secret_bytes).unwrap();

        // Verify public key matches expected
        let pubkey_hex = hex::encode(keypair.public_key_bytes());
        assert_eq!(pubkey_hex, expected_pubkey_hex);

        // Sign empty message
        let message: &[u8] = b"";
        let signature = keypair.sign(message);

        // Verify signature matches expected
        let sig_hex = hex::encode(signature.to_bytes());
        assert_eq!(sig_hex, expected_sig_hex);

        // Verify the signature is valid
        assert!(keypair.verify(message, &signature));
    }

    #[test]
    fn test_key_manager_load_or_generate() {
        let storage = InMemoryStorage::new();
        let manager = Ed25519KeyManager::new(storage);

        // First call should generate
        let keypair1 = manager.load_or_generate().unwrap();

        // Second call should load the same key
        let keypair2 = manager.load_or_generate().unwrap();

        assert_eq!(keypair1.public_key_bytes(), keypair2.public_key_bytes());
    }

    #[test]
    fn test_key_manager_save_and_load() {
        let storage = InMemoryStorage::new();
        let manager = Ed25519KeyManager::new(storage);

        let keypair = Ed25519Keypair::generate();
        let pubkey = keypair.export_pubkey();

        manager.save_keypair(&keypair).unwrap();

        let loaded = manager.load_keypair().unwrap();
        assert_eq!(loaded.export_pubkey(), pubkey);
    }
}
