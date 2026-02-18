//! Ed25519 Key Management for Solana/Squads operations
//!
//! This module provides Ed25519 keypair generation, signing, verification,
//! and encrypted storage for use with Solana Squads multisig operations.
//!
//! # Architecture
//!
//! Ed25519 keys are stored separately from BLS keys (key isolation principle).
//! Compromise of one key type does not expose the other.
//!
//! # Security
//!
//! - Keys are encrypted at rest using AES-256-GCM
//! - Key derivation uses Argon2id (memory-hard)
//! - Private keys are zeroized on drop
//! - Never log private keys or encryption passwords

mod ed25519;
mod storage;

pub use ed25519::{pubkey_from_base58, verify_signature, Ed25519Error, Ed25519KeyManager, Ed25519Keypair};
pub use storage::{Ed25519KeyStorage, EncryptedFileStorage, InMemoryStorage};
