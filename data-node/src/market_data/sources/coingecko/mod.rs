//! CoinGecko API client implementing MarketDataSource
//!
//! Source ID: `crypto`
//! Fetches cryptocurrency prices from CoinGecko Pro API.
//!
//! Rate limits: ~500 req/min on Pro tier (we use 400 to stay safe).

pub mod client;

pub use client::CoinGeckoMarketSource;
