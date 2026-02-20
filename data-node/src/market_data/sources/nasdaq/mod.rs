//! Nasdaq Data Link market data sources
//!
//! This module provides implementations for multiple market data sources
//! available through the Nasdaq Data Link API (formerly Quandl):
//!
//! - **CFTC** - Commitment of Traders reports
//! - **CHRIS** - Continuous futures contracts
//! - **BCHAIN** - Bitcoin on-chain metrics
//! - **OPEC** - OPEC reference basket price
//! - **IMF/ODA** - World Economic Outlook data
//!
//! All sources share the same API key (`NASDAQ_API_KEY`) and rate limits.

pub mod bchain;
pub mod cftc;
pub mod chris;
mod client;
pub mod imf;
pub mod opec;

pub use bchain::BchainMarketSource;
pub use cftc::CftcMarketSource;
pub use chris::ChrisMarketSource;
pub use client::NasdaqClient;
pub use imf::ImfMarketSource;
pub use opec::OpecMarketSource;
