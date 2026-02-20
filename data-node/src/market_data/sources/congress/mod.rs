//! Congress.gov Legislative Tracking data source
//!
//! Fetches legislative activity data from https://api.congress.gov/v3/
//! Data updated daily.
//!
//! Provides 10 aggregate metrics tracking bills, nominations, and legislative activity.

mod client;

pub use client::CongressMarketSource;
