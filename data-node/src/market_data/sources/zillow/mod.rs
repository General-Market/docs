//! Zillow Real Estate data source (Stub)
//!
//! NOTE: This source requires Bridge Interactive API access which requires
//! a business relationship with Zillow. This is a placeholder implementation.
//!
//! Would provide:
//! - National Home Value Index (ZHVI)
//! - National Rent Index (ZORI)
//! - Metro-level home values (NYC, LA, SF, Miami, Austin)
//! - Market health metrics (inventory, days on market, price cuts)

mod client;

pub use client::ZillowMarketSource;
