//! FINRA Daily Short Sale Volume data source
//!
//! Fetches daily short sale volume from FINRA's CDN (pipe-delimited text).
//! File published by ~6 PM ET on trading days.
//!
//! Provides 105 assets: 5 market-wide aggregates + 50 tickers x 2 metrics.

mod client;

pub use client::FinraShortVolMarketSource;
