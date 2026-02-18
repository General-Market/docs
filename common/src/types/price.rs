//! Price types for Index L3
//!
//! Matches Solidity TypesLib.sol definitions for cross-language compatibility.

use ethers::types::{Address, U256};
use serde::{Deserialize, Serialize};

/// Price source type
/// Maps to Solidity Price.source field values
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(u8)]
pub enum PriceSource {
    /// Bitget CEX
    Bitget = 0,
    /// 1inch DEX aggregator
    OneInch = 1,
    /// On-chain oracle
    OnChain = 2,
}

impl PriceSource {
    /// Fallible conversion from u8. Returns error for invalid values.
    pub fn try_from_u8(value: u8) -> Result<Self, super::EnumConversionError> {
        match value {
            0 => Ok(PriceSource::Bitget),
            1 => Ok(PriceSource::OneInch),
            2 => Ok(PriceSource::OnChain),
            _ => Err(super::EnumConversionError {
                enum_name: "PriceSource",
                invalid_value: value,
            }),
        }
    }
}

impl From<u8> for PriceSource {
    /// Converts u8 to PriceSource. Defaults to Bitget for invalid values.
    /// For fallible conversion, use `PriceSource::try_from_u8()`.
    fn from(value: u8) -> Self {
        PriceSource::try_from_u8(value).unwrap_or(PriceSource::Bitget)
    }
}

impl From<PriceSource> for u8 {
    fn from(source: PriceSource) -> Self {
        source as u8
    }
}

impl From<U256> for PriceSource {
    fn from(value: U256) -> Self {
        let val: u64 = value.as_u64();
        (val as u8).into()
    }
}

/// Price struct with source and freshness info
/// Maps to TypesLib.Price
///
/// All price values use 18 decimals precision.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Price {
    /// Asset address
    pub asset: Address,
    /// Price in USDC (18 decimals)
    pub price: U256,
    /// When price was fetched (Unix timestamp)
    pub timestamp: U256,
    /// Price source: 0=Bitget, 1=1inch, 2=on-chain
    pub source: U256,
}

impl Price {
    /// Get the source as an enum
    pub fn source_enum(&self) -> PriceSource {
        PriceSource::from(self.source)
    }

    /// Check if price is stale based on source type
    ///
    /// Staleness limits:
    /// - CEX (Bitget): 10 seconds
    /// - DEX (1inch): 30 seconds
    /// - Low liquidity: 60 seconds
    pub fn is_stale(&self, current_timestamp: U256) -> bool {
        let staleness_limit = match self.source_enum() {
            PriceSource::Bitget => U256::from(10),
            PriceSource::OneInch => U256::from(30),
            PriceSource::OnChain => U256::from(60),
        };

        current_timestamp.saturating_sub(self.timestamp) > staleness_limit
    }
}

/// Constants for price staleness limits (in seconds)
pub mod staleness {
    /// CEX (Bitget) staleness limit
    pub const CEX: u64 = 10;
    /// DEX (1inch) staleness limit
    pub const DEX: u64 = 30;
    /// Low liquidity asset staleness limit
    pub const LOW_LIQUIDITY: u64 = 60;
}
