//! SEC Form 4 Insider Trading Aggregates data source
//!
//! Fetches daily Form 4 filings from SEC EDGAR EFTS and parses XML
//! to aggregate insider buy/sell activity.
//!
//! Provides 157 assets: 7 market-wide aggregates + 50 tickers x 3 metrics.

mod client;

pub use client::SecInsiderMarketSource;
