//! Bitget API client module
//!
//! Provides authenticated access to Bitget Spot API for order placement.
//!
//! # Architecture
//!
//! This module implements the AP's integration with Bitget CEX for executing
//! user orders received from the Index L3 chain. Per architecture.md Section 3,
//! the AP has trade access on Bitget (order placement).
//!
//! # Usage
//!
//! ```ignore
//! use ap::external::bitget::{BitgetClient, BitgetConfig, OrderSide};
//! use rust_decimal::Decimal;
//!
//! // Create client with testnet configuration
//! let config = BitgetConfig::testnet();
//! let mut client = BitgetClient::new(config);
//!
//! // Authenticate with API credentials
//! client.authenticate(
//!     std::env::var("BITGET_API_KEY").unwrap(),
//!     std::env::var("BITGET_API_SECRET").unwrap(),
//!     std::env::var("BITGET_PASSPHRASE").unwrap(),
//! )?;
//!
//! // Place a limit order
//! let order_id = client.place_limit_order(
//!     "BTC/USDC",
//!     OrderSide::Buy,
//!     Decimal::new(1, 3),    // 0.001 BTC
//!     Decimal::new(42000, 0), // $42,000
//! ).await?;
//! ```
//!
//! # Security
//!
//! - API secrets are never logged (redacted in Debug implementations)
//! - All requests use HTTPS
//! - Request signing uses HMAC-SHA256 per Bitget specification
//!
//! # Error Handling
//!
//! All Bitget API errors are mapped to typed `BitgetError` variants for
//! appropriate handling (rate limiting, insufficient balance, etc.).

mod auth;
mod client;
mod error;
pub mod rate_limited;
#[cfg(test)]
mod tests;
mod types;

pub use auth::BitgetCredentials;
pub use client::{
    bitget_status_to_order_status, decimal_to_u256, side_to_order_side, u256_to_decimal,
    BitgetClient, BitgetConfig,
};
pub use error::{map_bitget_error_code, BitgetError};
pub use rate_limited::RateLimitedBitgetClient;
pub use types::{
    FillData, FillsResponse, OrderDetailData, OrderDetailResponse, OrderSide, OrderType,
    PlaceOrderData, PlaceOrderRequest, PlaceOrderResponse, TimeInForce, TradingPair,
};

// Re-export for convenience
pub use rust_decimal::Decimal;
