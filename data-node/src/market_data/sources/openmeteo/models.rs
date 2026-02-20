//! Weather models for Open-Meteo data
//!
//! Used by the MarketDataSource implementation.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Weather metric types supported by Open-Meteo
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WeatherMetric {
    /// Temperature at 2 meters height (C)
    Temperature2m,
    /// Rainfall (mm)
    Rain,
    /// Wind speed at 10 meters height (km/h)
    WindSpeed10m,
    /// PM2.5 particulate matter (ug/m3)
    Pm25,
    /// Ozone concentration (ug/m3)
    Ozone,
}

impl WeatherMetric {
    pub fn as_str(&self) -> &'static str {
        match self {
            WeatherMetric::Temperature2m => "temperature_2m",
            WeatherMetric::Rain => "rain",
            WeatherMetric::WindSpeed10m => "wind_speed_10m",
            WeatherMetric::Pm25 => "pm2_5",
            WeatherMetric::Ozone => "ozone",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "temperature_2m" => Some(WeatherMetric::Temperature2m),
            "rain" => Some(WeatherMetric::Rain),
            "wind_speed_10m" => Some(WeatherMetric::WindSpeed10m),
            "pm2_5" | "pm25" => Some(WeatherMetric::Pm25),
            "ozone" => Some(WeatherMetric::Ozone),
            _ => None,
        }
    }

    pub fn unit(&self) -> &'static str {
        match self {
            WeatherMetric::Temperature2m => "C",
            WeatherMetric::Rain => "mm",
            WeatherMetric::WindSpeed10m => "km/h",
            WeatherMetric::Pm25 => "ug/m3",
            WeatherMetric::Ozone => "ug/m3",
        }
    }

    /// All supported weather metrics
    pub fn all() -> &'static [WeatherMetric] {
        &[
            WeatherMetric::Temperature2m,
            WeatherMetric::Rain,
            WeatherMetric::WindSpeed10m,
            WeatherMetric::Pm25,
            WeatherMetric::Ozone,
        ]
    }
}

impl std::fmt::Display for WeatherMetric {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// City data for weather lookups (minimal struct for API requests)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherCity {
    pub city_id: String,
    pub name: String,
    pub country_code: String,
    pub latitude: Decimal,
    pub longitude: Decimal,
    pub population: i64,
    pub rank: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}
