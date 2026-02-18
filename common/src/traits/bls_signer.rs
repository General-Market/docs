//! BLSSigner trait for BLS signature operations

use crate::error::Error;
use crate::types::{BLSPublicKey, BLSSignature};

/// Trait for BLS signature operations
/// Uses BN254 curve (compatible with EVM precompile 0x06)
pub trait BLSSigner: Send + Sync {
    /// Sign a message with a BLS private key
    ///
    /// # Arguments
    /// * `private_key` - BLS private key bytes
    /// * `message` - Message to sign
    ///
    /// # Returns
    /// BLS signature
    fn sign(&self, private_key: &[u8], message: &[u8]) -> Result<BLSSignature, Error>;

    /// Aggregate multiple BLS signatures into one
    ///
    /// # Arguments
    /// * `signatures` - List of signatures to aggregate
    ///
    /// # Returns
    /// Aggregated BLS signature
    fn aggregate_signatures(&self, signatures: Vec<BLSSignature>) -> Result<BLSSignature, Error>;

    /// Verify a BLS signature
    ///
    /// # Arguments
    /// * `public_key` - BLS public key bytes
    /// * `message` - Original message that was signed
    /// * `signature` - Signature to verify
    ///
    /// # Returns
    /// true if signature is valid, false otherwise
    fn verify(
        &self,
        public_key: &BLSPublicKey,
        message: &[u8],
        signature: &BLSSignature,
    ) -> Result<bool, Error>;
}
