//! BLS signature operations using BN254 curve
//!
//! This module provides BLS signature functionality compatible with
//! the Solidity BLSLib.sol implementation using EVM precompiles.
//!
//! # Architecture
//! - Uses arkworks BN254 implementation
//! - Private keys are Fr (scalar field) elements
//! - Public keys are G2 points (128 bytes serialized)
//! - Signatures are G1 points (64 bytes serialized)
//!
//! # Compatibility
//! The hash-to-curve and serialization formats are designed to match
//! the Solidity implementation for cross-chain verification.

pub mod keypair;
pub mod signer;
mod utils;

#[cfg(test)]
mod test_vectors;

pub use keypair::BLSKeyPair;
pub use signer::Bn254BLSSigner;
pub use utils::{aggregate_pubkeys, deserialize_g1_point, hash_to_g1, serialize_g1_point};
