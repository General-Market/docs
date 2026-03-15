//! External service integrations
//!
//! This module contains clients for external APIs used by the AP service.
//!
//! # Modules
//!
//! - `bitget` - Bitget CEX API client for order placement (Story 5.1)
//! - `bitget_vault` - On-chain MockBitgetVault for E2E testing (Story 6.17)
//!
//! # Future Modules
//!
//! - `bitget_readonly` - Bitget read-only API for Oracles (Story 5.2)
//! - `1inch` - 1inch aggregator integration (Stories 5.4-5.8)
//! - `uniswap` - On-chain fallback execution (Story 5.9)

pub mod bitget;
pub mod bitget_vault;

pub use bitget::{BitgetClient, BitgetConfig, BitgetCredentials, BitgetError, OrderSide};
pub use bitget_vault::{BitgetVaultClient, BitgetVaultError};
