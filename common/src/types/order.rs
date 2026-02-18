//! Order types for Index L3
//!
//! Matches Solidity TypesLib.sol definitions for cross-language compatibility.

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};
use std::fmt;

/// Error type for enum conversion failures
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnumConversionError {
    pub enum_name: &'static str,
    pub invalid_value: u8,
}

impl fmt::Display for EnumConversionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Invalid {} value: {}", self.enum_name, self.invalid_value)
    }
}

impl std::error::Error for EnumConversionError {}

/// Side of an order (Buy or Sell)
/// Maps to Solidity: enum Side { BUY, SELL }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum Side {
    Buy = 0,
    Sell = 1,
}

impl Side {
    /// Fallible conversion from u8. Returns error for invalid values.
    pub fn try_from_u8(value: u8) -> Result<Self, EnumConversionError> {
        match value {
            0 => Ok(Side::Buy),
            1 => Ok(Side::Sell),
            _ => Err(EnumConversionError {
                enum_name: "Side",
                invalid_value: value,
            }),
        }
    }
}

impl From<u8> for Side {
    /// Converts u8 to Side. Defaults to Buy for invalid values.
    /// For fallible conversion, use `Side::try_from_u8()`.
    fn from(value: u8) -> Self {
        Side::try_from_u8(value).unwrap_or(Side::Buy)
    }
}

impl From<Side> for u8 {
    fn from(side: Side) -> Self {
        side as u8
    }
}

/// Status of an order
/// Maps to Solidity: enum OrderStatus { PENDING, BATCHED, FILLED, CANCELLED, EXPIRED }
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum OrderStatus {
    /// Order submitted, awaiting processing
    Pending = 0,
    /// Order included in a batch, awaiting execution
    Batched = 1,
    /// Order fully executed
    Filled = 2,
    /// Order cancelled by user or system
    Cancelled = 3,
    /// Order deadline passed without execution
    Expired = 4,
}

impl OrderStatus {
    /// Fallible conversion from u8. Returns error for invalid values.
    pub fn try_from_u8(value: u8) -> Result<Self, EnumConversionError> {
        match value {
            0 => Ok(OrderStatus::Pending),
            1 => Ok(OrderStatus::Batched),
            2 => Ok(OrderStatus::Filled),
            3 => Ok(OrderStatus::Cancelled),
            4 => Ok(OrderStatus::Expired),
            _ => Err(EnumConversionError {
                enum_name: "OrderStatus",
                invalid_value: value,
            }),
        }
    }
}

impl From<u8> for OrderStatus {
    /// Converts u8 to OrderStatus. Defaults to Pending for invalid values.
    /// For fallible conversion, use `OrderStatus::try_from_u8()`.
    fn from(value: u8) -> Self {
        OrderStatus::try_from_u8(value).unwrap_or(OrderStatus::Pending)
    }
}

impl From<OrderStatus> for u8 {
    fn from(status: OrderStatus) -> Self {
        status as u8
    }
}

/// LimitOrder struct matching Solidity definition
/// Maps to TypesLib.LimitOrder
///
/// All orders are limit orders (no market orders in the system).
/// All monetary values use 18 decimals precision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LimitOrder {
    /// Global unique ID across all ITPs
    pub id: U256,
    /// Address of the order submitter
    pub user: Address,
    /// Identifies asset + source (see architecture Section 12)
    pub pair_id: H256,
    /// BUY or SELL
    pub side: Side,
    /// USDC amount (quote currency, 18 decimals)
    pub amount: U256,
    /// Worst acceptable price (18 decimals)
    pub limit_price: U256,
    /// 0=strict(0.3%), 1=normal(1%), 2=relaxed(3%)
    pub slippage_tier: U256,
    /// Unix timestamp - order expires after this
    pub deadline: U256,
    /// Which ITP this order belongs to
    pub itp_id: H256,
    /// Order creation time
    pub timestamp: U256,
    /// Current order status (Pending, Batched, Filled, Cancelled, Expired)
    pub status: OrderStatus,
}

/// Order identifier type alias
pub type OrderId = U256;
