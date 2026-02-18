//! On-chain quote fallback for DEX pricing
//!
//! This module provides fallback pricing by reading directly from DEX pools
//! when the 1inch API is unavailable or rate-limited.
//!
//! Supports:
//! - Uniswap V3 on Arbitrum
//! - Sushiswap V3 on Arbitrum
//!
//! # Architecture
//!
//! The fallback system is triggered when:
//! 1. 1inch API returns rate limit errors
//! 2. 1inch API is completely unavailable
//! 3. Network errors prevent API access
//!
//! # Usage
//!
//! ```ignore
//! use common::integrations::onchain_quote::{OnchainQuoteClient, OnchainQuoteConfig};
//!
//! let config = OnchainQuoteConfig::arbitrum("https://arb1.arbitrum.io/rpc");
//! let client = OnchainQuoteClient::new(provider, config);
//!
//! // Get fallback quote when 1inch is unavailable
//! let quote = client.get_quote_onchain(usdc, weth, amount).await?;
//! assert!(quote.is_degraded()); // Always true for on-chain quotes
//! ```
//!
//! # Price Calculation
//!
//! Uniswap V3 stores price as `sqrtPriceX96`:
//! ```text
//! sqrtPriceX96 = sqrt(price) * 2^96
//! price = (sqrtPriceX96 / 2^96)^2
//! ```
//!
//! For token1/token0 price with decimals:
//! ```text
//! adjusted_price = price * 10^(token0_decimals - token1_decimals)
//! ```

mod client;
mod error;
mod price_math;
mod sushiswap;
mod types;
mod uniswap_v3;

pub use client::{OnchainQuoteClient, OnchainQuoteClientBuilder, OnchainQuoteMetrics};
pub use error::{OnchainQuoteError, Result};
pub use price_math::{
    calculate_inverse_price, calculate_output_amount, calculate_price_from_sqrt,
    estimate_price_impact_bps, get_price_for_swap,
};
pub use sushiswap::{SushiswapV3Reader, SUSHISWAP_V3_FACTORY_ARBITRUM, SUSHISWAP_V3_INIT_CODE_HASH};
pub use types::{
    arbitrum_tokens, DexType, FeeTier, OnchainQuote, OnchainQuoteConfig, QuoteSource, QuoteStatus,
    TokenRegistry,
};
pub use uniswap_v3::{
    compute_pool_address, IUniswapV3Factory, IUniswapV3Pool, PoolSlot0, PoolState, UniswapV3Reader,
};
