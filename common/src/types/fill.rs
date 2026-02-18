//! Fill types for Index L3
//!
//! Matches Solidity TypesLib.sol definitions for cross-language compatibility.

use ethers::types::{H256, U256};
use serde::{Deserialize, Serialize};

/// Transaction hash type (32 bytes)
pub type TxHash = H256;

/// Fill struct - represents a filled order
/// Maps to TypesLib.Fill
///
/// All monetary values use 18 decimals precision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fill {
    /// Reference to the original order
    pub order_id: U256,
    /// Actual execution price (18 decimals)
    pub fill_price: U256,
    /// Amount filled in USDC (18 decimals)
    pub fill_amount: U256,
    /// Cycle when filled
    pub cycle_number: U256,
    /// Optional CEX transaction reference
    pub tx_hash: TxHash,
}
