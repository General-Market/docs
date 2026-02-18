//! 1inch DEX aggregator integration
//!
//! Provides quote fetching and cross-chain swap capabilities via:
//! - Quote API: Same-chain DEX pricing
//! - Fusion+: Cross-chain swap intents
//!
//! Supported chains:
//! - Arbitrum (Chain ID: 42161) - Hub for Fusion+
//! - Ethereum (Chain ID: 1)
//! - Base (Chain ID: 8453)
//! - Optimism (Chain ID: 10)
//! - Solana (special handling for non-EVM)

mod cache;
mod client;
mod error;
mod fusion_plus;
mod rate_limiter;
mod swap_builder;
mod types;

pub use cache::*;
pub use client::*;
pub use error::*;
pub use fusion_plus::*;
pub use rate_limiter::*;
pub use swap_builder::*;
pub use types::*;
