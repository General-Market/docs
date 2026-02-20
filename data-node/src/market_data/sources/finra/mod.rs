//! FINRA Short Interest data source
//!
//! Fetches short interest data from FINRA API.
//! Data updated bi-weekly (mid-month and end-of-month).
//!
//! Tracks 25 high-interest securities across meme stocks, mega cap tech,
//! EV/clean energy, biotech, and financials.

mod client;

pub use client::FinraMarketSource;
