//! Open-Meteo market data source
//!
//! Provides weather data as a MarketDataSource.
//! Each (city, metric) combination is a separate asset.
//!
//! Asset ID format: `{city_id}:{metric}` (e.g., "paris-fr:temperature_2m")
//! Source ID: "weather"

pub mod api_client;
pub mod client;
pub mod models;

pub use client::OpenMeteoMarketSource;
