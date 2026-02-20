//! ECB (European Central Bank) market source
//!
//! Fetches Euro area interest rates and economic data.
//! - Interest rates: Update on ECB meeting days (8/year) at 14:15 CET
//! - Daily data: Published at 16:00 CET
//! - No API key required

mod client;

pub use client::EcbMarketSource;
