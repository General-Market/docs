//! Common crate for Index L3 - shared traits and types
//!
//! This crate provides the core abstractions used by both the Oracle and AP services.
//! Types match Solidity TypesLib.sol definitions for cross-language compatibility.

pub mod adapters;
pub mod audit;
pub mod bindings;
pub mod bls;
pub mod component;
pub mod consensus;
pub mod decimals;
pub mod error;
pub mod errors;
pub mod integrations;
pub mod keys;
pub mod logging;
pub mod mocks;
pub mod observer;
pub mod rate_limit;
pub mod runtime;
pub mod traits;
pub mod types;

pub use bindings::*;
pub use bls::{BLSKeyPair, Bn254BLSSigner};
pub use component::*;
pub use error::Error;
pub use errors::IndexError;
pub use keys::{
    pubkey_from_base58, verify_signature, Ed25519Error, Ed25519KeyManager, Ed25519Keypair,
    Ed25519KeyStorage, EncryptedFileStorage, InMemoryStorage,
};
pub use mocks::*;
pub use observer::*;
pub use rate_limit::*;
pub use traits::*;
pub use types::*;
