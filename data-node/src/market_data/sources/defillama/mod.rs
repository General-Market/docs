//! DefiLlama API client implementing MarketDataSource
//!
//! Source ID: `defi`
//! Fetches DeFi data from DefiLlama free API:
//! - Chain TVL (Total Value Locked per blockchain)
//! - Protocol TVL (Total Value Locked per protocol)
//! - DEX volumes (24h and 30d trading volumes)
//!
//! Rate limits: 500 req/min (free tier). We use batch endpoints so only 3 requests per sync.

pub mod client;

pub use client::DefiLlamaMarketSource;
