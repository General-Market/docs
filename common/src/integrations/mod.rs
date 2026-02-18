//! External service integrations
//!
//! This module contains clients for external services like Bitget, 1inch, Squads, Jupiter, etc.

pub mod bitget;
pub mod jupiter;
pub mod onchain_quote;
pub mod oneinch;
pub mod squads;

// Re-export bitget types
pub use bitget::*;

// Re-export jupiter types (prefixed to avoid conflicts)
pub use jupiter::{
    DexInfo, JupiterClient, JupiterConfig, JupiterError, Route, RouteStep, RoutePlanStep,
    SwapInfo,
};
pub use jupiter::{
    QuoteRequest as JupiterQuoteRequest, QuoteResponse as JupiterQuoteResponse,
    SwapRequest as JupiterSwapRequest, SwapResponse as JupiterSwapResponse,
};
pub use jupiter::{BONK_MINT, SOL_MINT, USDC_MINT, USDT_MINT};

// Re-export onchain_quote types
pub use onchain_quote::*;

// Re-export oneinch types
pub use oneinch::*;

// Re-export squads types
pub use squads::*;
