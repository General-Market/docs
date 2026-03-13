//! Open-Meteo market data source
//!
//! Provides weather data as a MarketDataSource.
//! Each (city, metric) combination is a separate asset.
//!
//! Asset ID format: `{city_id}:{metric}` (e.g., "paris-fr:temperature_2m")
//! Source ID: "weather"
//!
//! ## Data Strategy
//! - **Current data**: Stored to database (for settlement)
//! - **Hourly forecast (7 days)**: Kept in memory, refreshed each sync
//!
//! ## Stability
//! - Cities that haven't produced data in 3+ days are auto-deactivated
//! - Batch order is shuffled each fetch to distribute budget-cap impact fairly
//! - New cities get a 24h grace period before deactivation can occur

pub mod api_client;
pub mod client;
pub mod models;

pub use client::OpenMeteoMarketSource;
pub use models::{CityForecast, HourlyDataPoint, WeatherMetric};
