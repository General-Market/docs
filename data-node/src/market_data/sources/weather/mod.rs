//! Weather station data source
//!
//! Fetches current weather conditions from Open-Meteo API (free, no auth).
//! - Tracks 20 major cities worldwide (temperature, humidity, wind speed)
//! - 3 markets per city: temp, humidity, wind
//! - Rate limit: Open-Meteo allows 10,000 req/day
//! - Sync interval: 15 minutes (weather doesn't change fast)

mod client;

pub use client::WeatherSource;
