//! Issuer types for Index L3
//!
//! Matches Solidity TypesLib.sol definitions for cross-language compatibility.

use ethers::types::{Address, Bytes, H256, U256};
use serde::{Deserialize, Serialize};

/// Issuer status values
/// Maps to Solidity Issuer.status field
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum IssuerStatus {
    /// Issuer is not active
    Inactive = 0,
    /// Issuer is actively participating
    Active = 1,
    /// Issuer is temporarily suspended
    Suspended = 2,
}

impl IssuerStatus {
    /// Fallible conversion from u8. Returns error for invalid values.
    pub fn try_from_u8(value: u8) -> Result<Self, super::EnumConversionError> {
        match value {
            0 => Ok(IssuerStatus::Inactive),
            1 => Ok(IssuerStatus::Active),
            2 => Ok(IssuerStatus::Suspended),
            _ => Err(super::EnumConversionError {
                enum_name: "IssuerStatus",
                invalid_value: value,
            }),
        }
    }
}

impl From<u8> for IssuerStatus {
    /// Converts u8 to IssuerStatus. Defaults to Inactive for invalid values.
    /// For fallible conversion, use `IssuerStatus::try_from_u8()`.
    fn from(value: u8) -> Self {
        IssuerStatus::try_from_u8(value).unwrap_or(IssuerStatus::Inactive)
    }
}

impl From<IssuerStatus> for u8 {
    fn from(status: IssuerStatus) -> Self {
        status as u8
    }
}

impl From<U256> for IssuerStatus {
    fn from(value: U256) -> Self {
        let val: u64 = value.as_u64();
        (val as u8).into()
    }
}

/// Issuer node registration data
/// Maps to TypesLib.Issuer
///
/// Stored in IssuerRegistry contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Issuer {
    /// Issuer's Ethereum address for rewards/governance
    pub addr: Address,
    /// IP address for P2P communication (packed bytes32)
    pub ip: H256,
    /// BLS public key for signature aggregation
    pub bls_pubkey: Bytes,
    /// Status: 0=inactive, 1=active, 2=suspended
    pub status: U256,
    /// Registration timestamp
    pub registered_at: U256,
}

impl Issuer {
    /// Get status as enum
    pub fn status_enum(&self) -> IssuerStatus {
        IssuerStatus::from(self.status)
    }

    /// Check if issuer is active
    pub fn is_active(&self) -> bool {
        self.status_enum() == IssuerStatus::Active
    }

    /// Convert IP bytes32 to string (for display/logging)
    pub fn ip_string(&self) -> String {
        let bytes = self.ip.as_bytes();
        let trimmed: Vec<u8> = bytes.iter().copied().take_while(|&b| b != 0).collect();
        String::from_utf8_lossy(&trimmed).to_string()
    }
}

/// Key rotation request for issuer
/// Maps to TypesLib.KeyRotation
///
/// Tracks pending key rotations with approval state.
/// Requires 10/19 approval threshold + safe period.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KeyRotation {
    /// Issuer requesting rotation
    pub issuer_id: U256,
    /// Proposed new BLS public key
    pub new_pubkey: Bytes,
    /// Timestamp of rotation request
    pub requested_at: U256,
    /// Number of approvals received
    pub approval_count: U256,
    /// Whether rotation has been executed
    pub executed: bool,
}

impl KeyRotation {
    /// Check if rotation has enough approvals (10/19 threshold)
    pub fn has_enough_approvals(&self) -> bool {
        self.approval_count >= U256::from(10)
    }

    /// Check if safe period has passed (10 cycles)
    /// Safe period allows old key to remain valid during transition
    pub fn safe_period_elapsed(&self, current_cycle: U256, rotation_cycle: U256) -> bool {
        current_cycle.saturating_sub(rotation_cycle) >= U256::from(10)
    }
}

/// Pending rebalance operation for an ITP
/// Maps to TypesLib.PendingRebalance
///
/// Tracks rebalances in progress before BLS confirmation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PendingRebalance {
    /// ITP being rebalanced
    pub itp_id: H256,
    /// Asset being reduced
    pub from_asset: Address,
    /// Asset being increased
    pub to_asset: Address,
    /// Amount being rebalanced (18 decimals)
    pub amount: U256,
    /// Timestamp when rebalance was initiated
    pub initiated_at: U256,
    /// Cycle in which rebalance was requested
    pub cycle_number: U256,
}

/// Constants for issuer operations
pub mod issuer_constants {
    /// Key rotation approval threshold (10/19)
    pub const KEY_ROTATION_THRESHOLD: u8 = 10;
    /// Total issuers for threshold calculation (minus self)
    pub const KEY_ROTATION_TOTAL: u8 = 19;
    /// Safe period for key rotation (10 cycles)
    pub const KEY_ROTATION_SAFE_PERIOD: u64 = 10;
    /// Stuck rotation admin escape hatch (48 hours in seconds)
    pub const STUCK_ROTATION_TIMEOUT: u64 = 48 * 3600;
}
