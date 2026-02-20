//! US Treasury market source via Nasdaq Data Link
//!
//! Fetches Treasury yield curves, bill rates, and real yields.
//! Data published daily at 3:30 PM ET.

mod client;

pub use client::TreasuryMarketSource;
