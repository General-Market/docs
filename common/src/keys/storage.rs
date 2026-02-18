//! Encrypted key storage for Ed25519 keys
//!
//! Keys are encrypted at rest using AES-256-GCM with Argon2id key derivation.
//! Storage is separate from BLS keys (key isolation principle).

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use rand::rngs::OsRng;
use rand::RngCore;
use zeroize::{Zeroize, Zeroizing};

use super::ed25519::{Ed25519Error, Ed25519Keypair};

/// Trait for Ed25519 key storage backends
pub trait Ed25519KeyStorage {
    /// Load a keypair from storage
    fn load_keypair(&self) -> Result<Ed25519Keypair, Ed25519Error>;

    /// Save a keypair to storage
    fn save_keypair(&self, keypair: &Ed25519Keypair) -> Result<(), Ed25519Error>;

    /// Check if a keypair exists in storage
    fn exists(&self) -> bool;

    /// Delete the stored keypair
    fn delete(&self) -> Result<(), Ed25519Error>;
}

/// In-memory storage for testing (no encryption)
pub struct InMemoryStorage {
    data: RwLock<Option<[u8; 32]>>,
}

impl InMemoryStorage {
    pub fn new() -> Self {
        Self {
            data: RwLock::new(None),
        }
    }
}

impl Default for InMemoryStorage {
    fn default() -> Self {
        Self::new()
    }
}

impl Ed25519KeyStorage for InMemoryStorage {
    fn load_keypair(&self) -> Result<Ed25519Keypair, Ed25519Error> {
        let guard = self
            .data
            .read()
            .map_err(|e| Ed25519Error::StorageError(format!("Lock poisoned: {}", e)))?;

        match *guard {
            Some(ref bytes) => Ed25519Keypair::from_bytes(bytes),
            None => Err(Ed25519Error::KeyNotFound),
        }
    }

    fn save_keypair(&self, keypair: &Ed25519Keypair) -> Result<(), Ed25519Error> {
        let mut guard = self
            .data
            .write()
            .map_err(|e| Ed25519Error::StorageError(format!("Lock poisoned: {}", e)))?;

        *guard = Some(keypair.private_key_bytes());
        Ok(())
    }

    fn exists(&self) -> bool {
        self.data.read().map(|g| g.is_some()).unwrap_or(false)
    }

    fn delete(&self) -> Result<(), Ed25519Error> {
        let mut guard = self
            .data
            .write()
            .map_err(|e| Ed25519Error::StorageError(format!("Lock poisoned: {}", e)))?;

        if let Some(ref mut bytes) = *guard {
            bytes.zeroize();
        }
        *guard = None;
        Ok(())
    }
}

/// Encrypted file storage using AES-256-GCM with Argon2id key derivation
///
/// File format:
/// - Bytes 0-15: Salt (16 bytes) for Argon2id
/// - Bytes 16-27: Nonce (12 bytes) for AES-256-GCM
/// - Bytes 28+: Encrypted private key (32 bytes + 16 byte auth tag = 48 bytes)
///
/// Total file size: 76 bytes (16 + 12 + 32 + 16)
pub struct EncryptedFileStorage {
    path: PathBuf,
    password: Zeroizing<String>,
}

impl EncryptedFileStorage {
    /// Create a new encrypted file storage
    ///
    /// # Arguments
    /// * `path` - Path to the encrypted key file (e.g., "~/.index/keys/ed25519.enc")
    /// * `password` - Password for encryption/decryption (typically from ED25519_KEY_PASSWORD env var)
    pub fn new(path: impl AsRef<Path>, password: impl Into<String>) -> Result<Self, Ed25519Error> {
        let path = expand_tilde(path.as_ref());

        // Create parent directories if they don't exist
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                Ed25519Error::StorageError(format!("Failed to create directory: {}", e))
            })?;
        }

        Ok(Self {
            path,
            password: Zeroizing::new(password.into()),
        })
    }

    /// Derive an AES-256 key from password and salt using Argon2id
    fn derive_key(&self, salt: &[u8; 16]) -> Result<[u8; 32], Ed25519Error> {
        let salt_string = SaltString::encode_b64(salt)
            .map_err(|e| Ed25519Error::StorageError(format!("Salt encoding failed: {}", e)))?;

        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(self.password.as_bytes(), &salt_string)
            .map_err(|e| Ed25519Error::StorageError(format!("Key derivation failed: {}", e)))?;

        let hash_bytes = hash.hash.ok_or_else(|| {
            Ed25519Error::StorageError("Key derivation produced no output".into())
        })?;

        let mut key = [0u8; 32];
        key.copy_from_slice(&hash_bytes.as_bytes()[..32]);
        Ok(key)
    }

    /// Encrypt private key bytes
    fn encrypt(&self, private_key: &[u8; 32]) -> Result<Vec<u8>, Ed25519Error> {
        // Generate random salt and nonce using OS-provided CSPRNG
        let mut salt = [0u8; 16];
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut salt);
        OsRng.fill_bytes(&mut nonce_bytes);

        // Derive key from password
        let mut key = self.derive_key(&salt)?;

        // Encrypt the private key
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| Ed25519Error::StorageError(format!("Cipher init failed: {}", e)))?;

        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, private_key.as_ref())
            .map_err(|e| Ed25519Error::StorageError(format!("Encryption failed: {}", e)))?;

        // Zeroize the derived key
        key.zeroize();

        // Combine salt + nonce + ciphertext
        let mut result = Vec::with_capacity(16 + 12 + ciphertext.len());
        result.extend_from_slice(&salt);
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    /// Decrypt private key bytes
    fn decrypt(&self, data: &[u8]) -> Result<[u8; 32], Ed25519Error> {
        if data.len() < 16 + 12 + 32 {
            return Err(Ed25519Error::StorageError(
                "Encrypted file too short".into(),
            ));
        }

        // Extract salt, nonce, and ciphertext
        let salt: [u8; 16] = data[..16]
            .try_into()
            .map_err(|_| Ed25519Error::StorageError("Failed to read salt from encrypted file".into()))?;
        let nonce_bytes: [u8; 12] = data[16..28]
            .try_into()
            .map_err(|_| Ed25519Error::StorageError("Failed to read nonce from encrypted file".into()))?;
        let ciphertext = &data[28..];

        // Derive key from password
        let mut key = self.derive_key(&salt)?;

        // Decrypt the private key
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| Ed25519Error::StorageError(format!("Cipher init failed: {}", e)))?;

        let nonce = Nonce::from_slice(&nonce_bytes);
        let mut plaintext = cipher.decrypt(nonce, ciphertext).map_err(|_| {
            Ed25519Error::StorageError("Decryption failed (wrong password?)".into())
        })?;

        // Zeroize the derived key
        key.zeroize();

        if plaintext.len() != 32 {
            plaintext.zeroize();
            return Err(Ed25519Error::StorageError(
                "Decrypted key has wrong length".into(),
            ));
        }

        let mut result = [0u8; 32];
        result.copy_from_slice(&plaintext);
        plaintext.zeroize();

        Ok(result)
    }
}

impl Ed25519KeyStorage for EncryptedFileStorage {
    fn load_keypair(&self) -> Result<Ed25519Keypair, Ed25519Error> {
        if !self.path.exists() {
            return Err(Ed25519Error::KeyNotFound);
        }

        let mut file = File::open(&self.path)
            .map_err(|e| Ed25519Error::StorageError(format!("Failed to open key file: {}", e)))?;

        let mut data = Vec::new();
        file.read_to_end(&mut data)
            .map_err(|e| Ed25519Error::StorageError(format!("Failed to read key file: {}", e)))?;

        let mut private_key = self.decrypt(&data)?;
        let result = Ed25519Keypair::from_bytes(&private_key);
        private_key.zeroize();

        result
    }

    fn save_keypair(&self, keypair: &Ed25519Keypair) -> Result<(), Ed25519Error> {
        let encrypted = self.encrypt(&keypair.private_key_bytes())?;

        let mut file = File::create(&self.path)
            .map_err(|e| Ed25519Error::StorageError(format!("Failed to create key file: {}", e)))?;

        file.write_all(&encrypted)
            .map_err(|e| Ed25519Error::StorageError(format!("Failed to write key file: {}", e)))?;

        // Set restrictive permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o600);
            fs::set_permissions(&self.path, perms).map_err(|e| {
                Ed25519Error::StorageError(format!("Failed to set file permissions: {}", e))
            })?;
        }

        Ok(())
    }

    fn exists(&self) -> bool {
        self.path.exists()
    }

    fn delete(&self) -> Result<(), Ed25519Error> {
        if self.path.exists() {
            // Overwrite with zeros before deleting
            if let Ok(metadata) = fs::metadata(&self.path) {
                let len = metadata.len() as usize;
                if let Ok(mut file) = File::create(&self.path) {
                    let zeros = vec![0u8; len];
                    let _ = file.write_all(&zeros);
                }
            }

            fs::remove_file(&self.path).map_err(|e| {
                Ed25519Error::StorageError(format!("Failed to delete key file: {}", e))
            })?;
        }
        Ok(())
    }
}

/// Expand ~ to home directory
fn expand_tilde(path: &Path) -> PathBuf {
    if path.starts_with("~") {
        if let Some(home) = dirs_home() {
            return home.join(path.strip_prefix("~").unwrap());
        }
    }
    path.to_path_buf()
}

/// Get home directory
fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use tempfile::tempdir;

    #[test]
    fn test_in_memory_storage() {
        let storage = InMemoryStorage::new();

        // Initially empty
        assert!(!storage.exists());
        assert!(matches!(
            storage.load_keypair(),
            Err(Ed25519Error::KeyNotFound)
        ));

        // Save a keypair
        let keypair = Ed25519Keypair::generate();
        let pubkey = keypair.export_pubkey();
        storage.save_keypair(&keypair).unwrap();

        // Should exist now
        assert!(storage.exists());

        // Load should return same public key
        let loaded = storage.load_keypair().unwrap();
        assert_eq!(loaded.export_pubkey(), pubkey);

        // Delete
        storage.delete().unwrap();
        assert!(!storage.exists());
    }

    #[test]
    fn test_encrypted_file_storage() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test_key.enc");
        let password = "test_password_123";

        let storage = EncryptedFileStorage::new(&path, password).unwrap();

        // Initially empty
        assert!(!storage.exists());
        assert!(matches!(
            storage.load_keypair(),
            Err(Ed25519Error::KeyNotFound)
        ));

        // Save a keypair
        let keypair = Ed25519Keypair::generate();
        let pubkey = keypair.export_pubkey();
        let private_bytes = keypair.private_key_bytes();
        storage.save_keypair(&keypair).unwrap();

        // Should exist now
        assert!(storage.exists());

        // File should be exactly 64 bytes (16 salt + 12 nonce + 32 key + 16 tag)
        let metadata = fs::metadata(&path).unwrap();
        assert_eq!(metadata.len(), 76); // 16 + 12 + 48 (32 + 16 auth tag)

        // Load should return same keypair
        let loaded = storage.load_keypair().unwrap();
        assert_eq!(loaded.export_pubkey(), pubkey);
        assert_eq!(loaded.private_key_bytes(), private_bytes);

        // Wrong password should fail
        let wrong_storage = EncryptedFileStorage::new(&path, "wrong_password").unwrap();
        assert!(wrong_storage.load_keypair().is_err());

        // Delete
        storage.delete().unwrap();
        assert!(!storage.exists());
    }

    #[test]
    fn test_encrypted_storage_creates_dirs() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("subdir1").join("subdir2").join("key.enc");

        let storage = EncryptedFileStorage::new(&path, "password").unwrap();

        let keypair = Ed25519Keypair::generate();
        storage.save_keypair(&keypair).unwrap();

        assert!(path.exists());
    }

    #[test]
    fn test_key_isolation_separate_storage() {
        // Verify two EncryptedFileStorage instances with different paths
        // store and retrieve independent keys (key isolation principle)
        let dir = tempdir().unwrap();
        let path_a = dir.path().join("ed25519.enc");
        let path_b = dir.path().join("bls_sim.enc");

        let storage_a = EncryptedFileStorage::new(&path_a, "password_a").unwrap();
        let storage_b = EncryptedFileStorage::new(&path_b, "password_b").unwrap();

        let keypair_a = Ed25519Keypair::generate();
        let keypair_b = Ed25519Keypair::generate();

        storage_a.save_keypair(&keypair_a).unwrap();
        storage_b.save_keypair(&keypair_b).unwrap();

        // Each storage returns its own key, not the other's
        let loaded_a = storage_a.load_keypair().unwrap();
        let loaded_b = storage_b.load_keypair().unwrap();

        assert_eq!(loaded_a.public_key_bytes(), keypair_a.public_key_bytes());
        assert_eq!(loaded_b.public_key_bytes(), keypair_b.public_key_bytes());
        assert_ne!(loaded_a.public_key_bytes(), loaded_b.public_key_bytes());
    }

    #[test]
    #[cfg(unix)]
    fn test_file_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir().unwrap();
        let path = dir.path().join("key.enc");

        let storage = EncryptedFileStorage::new(&path, "password").unwrap();
        let keypair = Ed25519Keypair::generate();
        storage.save_keypair(&keypair).unwrap();

        let perms = fs::metadata(&path).unwrap().permissions();
        assert_eq!(perms.mode() & 0o777, 0o600);
    }
}
