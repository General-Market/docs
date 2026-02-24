//! Key registry for consensus signature verification
//!
//! Provides lookup of BLS public keys for peer verification.

use std::collections::HashMap;
use std::sync::RwLock;

use common::bls::BLSKeyPair;
use common::error::Error;
use common::types::{BLSPublicKey, PeerId};

/// Trait for looking up BLS public keys by peer ID
pub trait KeyRegistry: Send + Sync {
    /// Get the public key for a peer
    fn get_public_key(&self, peer_id: &PeerId) -> Option<BLSPublicKey>;

    /// Check if a peer is registered
    fn is_registered(&self, peer_id: &PeerId) -> bool {
        self.get_public_key(peer_id).is_some()
    }

    /// Get all registered peer IDs
    fn registered_peers(&self) -> Vec<PeerId>;

    /// Get the number of registered peers
    fn peer_count(&self) -> usize;
}

/// In-memory key registry for issuer BLS public keys
///
/// In production, this would be populated from on-chain IssuerRegistry contract.
/// For now, it provides a simple in-memory store that can be pre-populated.
pub struct InMemoryKeyRegistry {
    /// Map of peer ID to BLS public key
    keys: RwLock<HashMap<PeerId, BLSPublicKey>>,
}

impl InMemoryKeyRegistry {
    /// Create a new empty key registry
    pub fn new() -> Self {
        Self {
            keys: RwLock::new(HashMap::new()),
        }
    }

    /// Create a key registry with pre-populated keys
    pub fn with_keys(keys: HashMap<PeerId, BLSPublicKey>) -> Self {
        Self {
            keys: RwLock::new(keys),
        }
    }

    /// Register a new peer with their public key
    pub fn register(&self, peer_id: PeerId, public_key: BLSPublicKey) -> Result<(), Error> {
        let mut keys = self.keys.write().map_err(|_| {
            Error::P2PConnection("Failed to acquire key registry lock".to_string())
        })?;

        keys.insert(peer_id, public_key);
        Ok(())
    }

    /// Register a peer from their keypair
    pub fn register_keypair(&self, peer_id: PeerId, keypair: &BLSKeyPair) -> Result<(), Error> {
        self.register(peer_id, keypair.public_key())
    }

    /// Unregister a peer
    pub fn unregister(&self, peer_id: &PeerId) -> Result<Option<BLSPublicKey>, Error> {
        let mut keys = self.keys.write().map_err(|_| {
            Error::P2PConnection("Failed to acquire key registry lock".to_string())
        })?;

        Ok(keys.remove(peer_id))
    }

    /// Create a test registry with generated keypairs
    ///
    /// Generates `count` deterministic keypairs for testing.
    pub fn generate_test_registry(count: usize) -> (Self, Vec<(PeerId, BLSKeyPair)>) {
        Self::generate_test_registry_with_offset(count, 0)
    }

    /// Create a test registry with generated keypairs and a peer_id offset
    ///
    /// Generates `count` deterministic keypairs for testing.
    /// The peer_id[0] values will be offset + i (for i in 0..count),
    /// but seed indices remain 0..count for deterministic key generation.
    ///
    /// This is useful when the on-chain IssuerRegistry has keys registered
    /// at different indices than the seed indices used to generate them.
    pub fn generate_test_registry_with_offset(count: usize, offset: usize) -> (Self, Vec<(PeerId, BLSKeyPair)>) {
        let mut keys = HashMap::new();
        let mut keypairs = Vec::new();

        for i in 0..count {
            let mut peer_id = [0u8; 32];
            // +1 to match generate_peer_id() which avoids all-zeros sentinel
            peer_id[0] = (offset + i + 1) as u8;

            // Generate deterministic keypair from seed (must match bls-tool: vec![idx; 32])
            let seed = vec![i as u8; 32];
            let keypair = BLSKeyPair::from_seed(&seed).expect("valid seed");

            keys.insert(peer_id, keypair.public_key());
            keypairs.push((peer_id, keypair));
        }

        (Self::with_keys(keys), keypairs)
    }
}

impl Default for InMemoryKeyRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyRegistry for InMemoryKeyRegistry {
    fn get_public_key(&self, peer_id: &PeerId) -> Option<BLSPublicKey> {
        self.keys
            .read()
            .ok()
            .and_then(|keys| keys.get(peer_id).cloned())
    }

    fn registered_peers(&self) -> Vec<PeerId> {
        self.keys
            .read()
            .map(|keys| keys.keys().cloned().collect())
            .unwrap_or_default()
    }

    fn peer_count(&self) -> usize {
        self.keys.read().map(|keys| keys.len()).unwrap_or(0)
    }
}

impl std::fmt::Debug for InMemoryKeyRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let count = self.peer_count();
        f.debug_struct("InMemoryKeyRegistry")
            .field("peer_count", &count)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_peer_id(n: u8) -> PeerId {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    #[test]
    fn test_empty_registry() {
        let registry = InMemoryKeyRegistry::new();
        assert_eq!(registry.peer_count(), 0);
        assert!(registry.get_public_key(&test_peer_id(0)).is_none());
        assert!(!registry.is_registered(&test_peer_id(0)));
    }

    #[test]
    fn test_register_and_lookup() {
        let registry = InMemoryKeyRegistry::new();
        let keypair = BLSKeyPair::generate();
        let peer_id = test_peer_id(1);

        registry.register(peer_id, keypair.public_key()).unwrap();

        assert_eq!(registry.peer_count(), 1);
        assert!(registry.is_registered(&peer_id));

        let retrieved = registry.get_public_key(&peer_id).unwrap();
        assert_eq!(retrieved.0, keypair.public_key().0);
    }

    #[test]
    fn test_register_keypair() {
        let registry = InMemoryKeyRegistry::new();
        let keypair = BLSKeyPair::generate();
        let peer_id = test_peer_id(2);

        registry.register_keypair(peer_id, &keypair).unwrap();

        assert!(registry.is_registered(&peer_id));
    }

    #[test]
    fn test_unregister() {
        let registry = InMemoryKeyRegistry::new();
        let keypair = BLSKeyPair::generate();
        let peer_id = test_peer_id(3);

        registry.register(peer_id, keypair.public_key()).unwrap();
        assert!(registry.is_registered(&peer_id));

        let removed = registry.unregister(&peer_id).unwrap();
        assert!(removed.is_some());
        assert!(!registry.is_registered(&peer_id));
    }

    #[test]
    fn test_registered_peers() {
        let registry = InMemoryKeyRegistry::new();

        for i in 0..5u8 {
            let keypair = BLSKeyPair::generate();
            registry.register(test_peer_id(i), keypair.public_key()).unwrap();
        }

        let peers = registry.registered_peers();
        assert_eq!(peers.len(), 5);
    }

    #[test]
    fn test_generate_test_registry() {
        let (registry, keypairs) = InMemoryKeyRegistry::generate_test_registry(20);

        assert_eq!(registry.peer_count(), 20);
        assert_eq!(keypairs.len(), 20);

        // Verify all keypairs are registered
        for (peer_id, keypair) in &keypairs {
            assert!(registry.is_registered(peer_id));
            let pubkey = registry.get_public_key(peer_id).unwrap();
            assert_eq!(pubkey.0, keypair.public_key().0);
        }
    }

    #[test]
    fn test_print_bls_pubkeys() {
        // Print BLS public keys for first 3 test seeds
        // These need to match IssuerRegistry for BLS verification to work
        // Seed format must match bls-tool: vec![idx; 32]
        for i in 0..3 {
            let seed = vec![i as u8; 32];
            let keypair = BLSKeyPair::from_seed(&seed).expect("valid seed");
            let pubkey = keypair.public_key();
            println!("Index {}: pubkey = 0x{}", i, hex::encode(&pubkey.0));
        }
    }

    #[test]
    fn test_with_keys() {
        let mut keys = HashMap::new();
        let keypair1 = BLSKeyPair::generate();
        let keypair2 = BLSKeyPair::generate();

        keys.insert(test_peer_id(1), keypair1.public_key());
        keys.insert(test_peer_id(2), keypair2.public_key());

        let registry = InMemoryKeyRegistry::with_keys(keys);

        assert_eq!(registry.peer_count(), 2);
        assert!(registry.is_registered(&test_peer_id(1)));
        assert!(registry.is_registered(&test_peer_id(2)));
        assert!(!registry.is_registered(&test_peer_id(3)));
    }
}
