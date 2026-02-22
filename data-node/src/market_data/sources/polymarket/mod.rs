//! Polymarket prediction markets data source
//!
//! Fetches market data from Polymarket's Gamma API:
//! - Market metadata (condition_id, question, category)
//! - Prices (outcomePrices)
//! - Volume and liquidity
//!
//! API: https://gamma-api.polymarket.com

mod client;

pub use client::PolymarketMarketSource;
