//! ITP (Index Token Product) types for Index L3
//!
//! Matches Solidity TypesLib.sol definitions for cross-language compatibility.

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// ITP status lifecycle
/// Maps to Solidity: enum ITPStatus { INACTIVE, ACTIVE, PAUSED, DELISTING }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum ITPStatus {
    /// ITP not yet activated
    Inactive = 0,
    /// ITP is operational
    Active = 1,
    /// ITP temporarily paused
    Paused = 2,
    /// ITP being wound down
    Delisting = 3,
}

impl ITPStatus {
    /// Fallible conversion from u8. Returns error for invalid values.
    pub fn try_from_u8(value: u8) -> Result<Self, super::EnumConversionError> {
        match value {
            0 => Ok(ITPStatus::Inactive),
            1 => Ok(ITPStatus::Active),
            2 => Ok(ITPStatus::Paused),
            3 => Ok(ITPStatus::Delisting),
            _ => Err(super::EnumConversionError {
                enum_name: "ITPStatus",
                invalid_value: value,
            }),
        }
    }
}

impl From<u8> for ITPStatus {
    /// Converts u8 to ITPStatus. Defaults to Inactive for invalid values.
    /// For fallible conversion, use `ITPStatus::try_from_u8()`.
    fn from(value: u8) -> Self {
        ITPStatus::try_from_u8(value).unwrap_or(ITPStatus::Inactive)
    }
}

impl From<ITPStatus> for u8 {
    fn from(status: ITPStatus) -> Self {
        status as u8
    }
}

impl From<U256> for ITPStatus {
    fn from(value: U256) -> Self {
        let val: u64 = value.as_u64();
        (val as u8).into()
    }
}

/// ITPCore struct - core ITP data structure
/// Maps to TypesLib.ITPCore
///
/// ERC4626-compliant wrapper stored separately.
/// All monetary values use 18 decimals precision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ITPCore {
    /// ITP name (packed bytes32)
    pub name: H256,
    /// ITP symbol (packed bytes32)
    pub symbol: H256,
    /// Address that created the ITP
    pub creator: Address,
    /// Creation timestamp
    pub created_at: U256,
    /// Fee rate in basis points (10000 = 100%)
    pub fee_rate: U256,
    /// ITP lifecycle status
    pub status: U256,
    /// Total ITP tokens in circulation
    pub total_supply: U256,
    /// Cached NAV * supply (18 decimals)
    pub total_value: U256,
    /// Number of assets in this ITP
    pub asset_count: U256,
}

impl ITPCore {
    /// Get the status as an enum
    pub fn status_enum(&self) -> ITPStatus {
        ITPStatus::from(self.status)
    }

    /// Convert name bytes32 to String (UTF-8)
    pub fn name_string(&self) -> String {
        bytes32_to_string(&self.name)
    }

    /// Convert symbol bytes32 to String (UTF-8)
    pub fn symbol_string(&self) -> String {
        bytes32_to_string(&self.symbol)
    }
}

/// Helper to convert bytes32 to string, trimming trailing zeros
fn bytes32_to_string(bytes: &H256) -> String {
    let trimmed: Vec<u8> = bytes.as_bytes().iter().copied().take_while(|&b| b != 0).collect();
    String::from_utf8_lossy(&trimmed).to_string()
}

/// Helper to convert string to bytes32
pub fn string_to_bytes32(s: &str) -> H256 {
    let mut bytes = [0u8; 32];
    let src = s.as_bytes();
    let len = src.len().min(32);
    bytes[..len].copy_from_slice(&src[..len]);
    H256::from(bytes)
}

/// ITP identifier type alias (bytes32)
pub type ITPId = H256;
