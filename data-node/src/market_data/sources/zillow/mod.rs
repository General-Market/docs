//! Zillow Real Estate data source
//!
//! Fetches housing market data from Zillow's free public CSV research files.
//! No API key required.
//!
//! Provides:
//! - National Home Value Index (ZHVI)
//! - National Rent Index (ZORI)
//! - Metro-level home values (NYC, LA, SF, Miami, Austin)
//! - Market health metrics (inventory, days on market, price cuts)

mod client;

pub use client::ZillowMarketSource;
