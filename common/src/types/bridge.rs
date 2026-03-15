//! Bridge types for Index L3
//!
//! Matches Solidity TypesLib.sol definitions for cross-language compatibility.

use ethers::types::{H256, U256};
use serde::{Deserialize, Serialize};

/// Transaction types for collateral movement tracking
/// Maps to Solidity: enum TxType { BRIDGE, SWAP_IN, SWAP_OUT, BUY, SELL }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum TxType {
    /// Cross-chain bridge transfer
    Bridge = 0,
    /// DEX swap - assets coming in
    SwapIn = 1,
    /// DEX swap - assets going out
    SwapOut = 2,
    /// CEX buy order
    Buy = 3,
    /// CEX sell order
    Sell = 4,
}

impl TxType {
    /// Fallible conversion from u8. Returns error for invalid values.
    pub fn try_from_u8(value: u8) -> Result<Self, super::EnumConversionError> {
        match value {
            0 => Ok(TxType::Bridge),
            1 => Ok(TxType::SwapIn),
            2 => Ok(TxType::SwapOut),
            3 => Ok(TxType::Buy),
            4 => Ok(TxType::Sell),
            _ => Err(super::EnumConversionError {
                enum_name: "TxType",
                invalid_value: value,
            }),
        }
    }
}

impl From<u8> for TxType {
    /// Converts u8 to TxType. Defaults to Bridge for invalid values.
    /// For fallible conversion, use `TxType::try_from_u8()`.
    fn from(value: u8) -> Self {
        TxType::try_from_u8(value).unwrap_or(TxType::Bridge)
    }
}

impl From<TxType> for u8 {
    fn from(tx_type: TxType) -> Self {
        tx_type as u8
    }
}

/// Pending bridge lock awaiting release
/// Maps to TypesLib.PendingLock
///
/// Used for two-phase bridge with source lock verification:
/// 1. Lock funds on source chain
/// 2. Verify lock on destination chain
/// 3. Release funds on destination (or reverse on timeout)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PendingLock {
    /// Amount locked (18 decimals)
    pub amount: U256,
    /// Destination chain ID
    pub dest_chain_id: U256,
    /// Timestamp when locked
    pub locked_at: U256,
    /// Block number when locked
    pub locked_block: U256,
    /// Block hash for verification
    pub locked_block_hash: H256,
    /// Whether funds have been released on destination
    pub released: bool,
    /// Whether lock was reversed (timeout/failure)
    pub reversed: bool,
}

impl PendingLock {
    /// Check if this lock is still pending (not released or reversed)
    pub fn is_pending(&self) -> bool {
        !self.released && !self.reversed
    }

    /// Check if this lock can be reversed (after 1 hour timeout)
    /// Requires 15/20 oracle threshold for reversal
    pub fn can_reverse(&self, current_timestamp: U256) -> bool {
        const BRIDGE_TIMEOUT_SECONDS: u64 = 3600; // 1 hour
        self.is_pending()
            && current_timestamp.saturating_sub(self.locked_at) > U256::from(BRIDGE_TIMEOUT_SECONDS)
    }
}

/// Collateral movement tracking for inventory
/// Maps to TypesLib.CollateralMove
///
/// Used for emitting CollateralMoved events.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CollateralMove {
    /// ITP this movement belongs to
    pub itp_id: H256,
    /// Source chain ID (0 for L3)
    pub from_chain: U256,
    /// Destination chain ID (0 for L3)
    pub to_chain: U256,
    /// Amount moved (18 decimals)
    pub amount: U256,
    /// Type of transaction (BRIDGE, SWAP_IN, etc.)
    pub tx_type: TxType,
}

/// Proof data for bridge release on destination chain
/// Maps to TypesLib.ReleaseProof
///
/// Used to verify source chain lock before releasing funds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReleaseProof {
    /// Chain where funds were locked
    pub source_chain_id: U256,
    /// Block number of the lock transaction
    pub source_block_number: U256,
    /// Block hash for verification
    pub source_block_hash: H256,
    /// Transaction hash of the lock
    pub source_tx_hash: H256,
}

/// Constants for bridge operations
pub mod bridge_constants {
    /// Bridge timeout in seconds (1 hour)
    pub const TIMEOUT_SECONDS: u64 = 3600;
    /// Threshold for bridge reversal (15/20 oracles)
    pub const REVERSAL_THRESHOLD: u8 = 15;
    /// Total oracles for threshold calculation
    pub const TOTAL_ORACLES: u8 = 20;
}
