//! FRED (Federal Reserve Economic Data) market source
//!
//! Fetches interest rates, treasury yields, and other economic data from FRED API.
//! Implements schedule-aware fetching:
//! - Daily series (DFF, DGS10, etc.) fetched after 6 PM ET
//! - Weekly series (MORTGAGE30US) fetched Thursday morning
//! - FOMC days: burst mode every 30 minutes 2-6 PM ET

mod client;

pub use client::FredMarketSource;
