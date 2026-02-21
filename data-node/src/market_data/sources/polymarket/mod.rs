//! Polymarket prediction market data source
//!
//! Fetches active prediction markets from Polymarket's Gamma API.
//! - Markets: Active events with outcome prices and volume
//! - No API key required (public API)
//! - Rate limit: 30 requests/minute

mod client;

pub use client::PolymarketSource;
