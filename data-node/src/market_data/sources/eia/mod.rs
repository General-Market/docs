//! EIA (Energy Information Administration) market data source
//!
//! Fetches energy data from https://api.eia.gov/v2/
//!
//! Data publishes on specific schedules:
//! - Petroleum Status Report: Wednesday 10:30 AM ET
//! - Natural Gas Storage: Thursday 10:30 AM ET
//! - Rig Count: Friday

mod client;

pub use client::EiaMarketSource;
