//! Finnhub API client for stock market data
//!
//! Source ID: `stocks`
//! Internally uses Finnhub API (https://finnhub.io) to fetch US & international stock prices.
//!
//! Rate limits: 60 req/min on free tier.

pub mod client;

pub use client::FinnhubClient;
