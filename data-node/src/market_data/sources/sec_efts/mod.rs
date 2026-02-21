//! SEC EFTS Filing Volume Counts data source
//!
//! Fetches daily filing counts by form type from SEC EDGAR Full-Text Search.
//! Data updates multiple times daily (35 form types tracked).
//!
//! Provides 35 assets: filing counts for each tracked SEC form type.

mod client;

pub use client::SecEftsMarketSource;
