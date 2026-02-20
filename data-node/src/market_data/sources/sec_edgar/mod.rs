//! SEC EDGAR 13F Fund Holdings data source
//!
//! Fetches institutional investor holdings from SEC EDGAR.
//! Data updated quarterly (45 days after quarter end).
//!
//! Provides 45 assets: 15 major funds × 3 metrics (AUM, top 10 concentration, position count).

mod client;

pub use client::SecEdgarMarketSource;
