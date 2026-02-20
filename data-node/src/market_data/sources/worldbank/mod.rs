//! World Bank Global Indicators data source
//!
//! Fetches economic indicators from https://api.worldbank.org/v2/
//! Data updated annually.
//!
//! Provides 150+ series: 15 indicators × 10+ countries.

mod client;

pub use client::WorldBankMarketSource;
