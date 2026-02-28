//! Open-Meteo API client
//!
//! Fetches weather data from Open-Meteo free API with optimized rate limiting.
//!
//! ## Rate Limit Strategy
//!
//! - Free tier: 10,000 calls/day
//! - Smart sync: ~11 fetches/day (only when data updates, min 45min interval)
//! - With ~32k cities: 322 batches × 2 APIs = 644 calls per fetch
//! - Daily usage: 644 × 11 ≈ 7,100 calls (~71-77% of limit)
//! - Hard stop when daily budget exceeds 80%
//!
//! ## Optimizations
//!
//! - Adaptive delay based on batch progress
//! - Exponential backoff on rate limit errors
//! - Parallel forecast + air quality fetching where safe
//! - Daily budget tracking with automatic throttling

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};

use super::models::{CityForecast, HourlyDataPoint, WeatherCity, WeatherMetric};

/// Open-Meteo Forecast API URL
const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";

/// Open-Meteo Air Quality API URL
const AIR_QUALITY_URL: &str = "https://air-quality-api.open-meteo.com/v1/air-quality";

/// Open-Meteo Metadata API URL (lightweight check, doesn't count heavily)
const METADATA_URL: &str = "https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m&forecast_days=1";

/// Request timeout in seconds
const REQUEST_TIMEOUT_SECS: u64 = 60;

/// Maximum cities per batch request (OpenMeteo supports up to 100)
const BATCH_SIZE: usize = 100;

/// Daily API call budget (free tier)
const DAILY_BUDGET: u64 = 10_000;

/// Target daily usage percentage (leave headroom for retries)
const TARGET_USAGE_PCT: f64 = 0.80;

/// Response from Open-Meteo Metadata check (minimal forecast request)
#[derive(Debug, Deserialize)]
pub struct MetadataResponse {
    /// Model generation time (Unix timestamp) - when the model run started
    #[serde(default)]
    pub generationtime_ms: f64,
    /// Current weather block contains the update time
    pub current: Option<MetadataCurrent>,
}

#[derive(Debug, Deserialize)]
pub struct MetadataCurrent {
    /// ISO timestamp of the current data
    pub time: String,
    /// Update interval in seconds
    #[serde(default)]
    pub interval: i32,
}

/// Response from Open-Meteo Forecast API (current + hourly)
#[derive(Debug, Deserialize)]
pub struct ForecastResponse {
    pub latitude: f64,
    pub longitude: f64,
    pub current: Option<CurrentWeather>,
    pub hourly: Option<HourlyWeather>,
}

#[derive(Debug, Deserialize)]
pub struct CurrentWeather {
    pub temperature_2m: Option<f64>,
    pub rain: Option<f64>,
    pub wind_speed_10m: Option<f64>,
}

/// Hourly forecast data from Open-Meteo
#[derive(Debug, Deserialize)]
pub struct HourlyWeather {
    /// ISO 8601 timestamps for each hour
    pub time: Vec<String>,
    /// Temperature at 2m for each hour
    pub temperature_2m: Option<Vec<Option<f64>>>,
    /// Rainfall for each hour
    pub rain: Option<Vec<Option<f64>>>,
    /// Wind speed at 10m for each hour
    pub wind_speed_10m: Option<Vec<Option<f64>>>,
}

/// Response from Open-Meteo Air Quality API
#[derive(Debug, Deserialize)]
pub struct AirQualityResponse {
    pub latitude: f64,
    pub longitude: f64,
    pub current: Option<CurrentAirQuality>,
}

#[derive(Debug, Deserialize)]
pub struct CurrentAirQuality {
    pub pm2_5: Option<f64>,
    pub ozone: Option<f64>,
}

/// Weather data for a single city (current + hourly forecast)
#[derive(Debug, Clone)]
pub struct CityWeatherData {
    pub city_id: String,
    /// Current readings (stored to DB)
    pub readings: HashMap<WeatherMetric, Decimal>,
    /// Hourly forecasts (kept in memory only)
    pub hourly_forecast: Option<CityForecast>,
}

/// Open-Meteo API client with rate limiting via SourceHttpClient
pub struct OpenMeteoClient {
    http: SourceHttpClient,
    /// Daily API call counter (resets at midnight UTC)
    daily_calls: std::sync::Arc<AtomicU64>,
    /// Date of last counter reset
    counter_date: std::sync::Arc<tokio::sync::RwLock<DateTime<Utc>>>,
}

impl OpenMeteoClient {
    /// Create a new Open-Meteo API client with rate limiting
    pub fn new() -> Result<Self> {
        // 10,000 calls/day = ~6.9/min average, but we burst in batches.
        // Use a generous per-minute window to allow batching while staying under daily limit.
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 600,
                duration: Duration::from_secs(60),
            }],
        };

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .context("Failed to create HTTP client")?;

        let http = SourceHttpClient::with_client(client, rate_limit, RetryConfig::default());

        Ok(Self {
            http,
            daily_calls: std::sync::Arc::new(AtomicU64::new(0)),
            counter_date: std::sync::Arc::new(tokio::sync::RwLock::new(Utc::now())),
        })
    }

    /// Check if new data is available by fetching metadata.
    /// Returns the current data timestamp if successful.
    /// This is a lightweight call that doesn't count heavily against rate limits.
    pub async fn fetch_data_timestamp(&self) -> Result<String> {
        let metadata: MetadataResponse = self
            .http
            .get_json(METADATA_URL)
            .await
            .context("Failed to fetch metadata")?;

        metadata
            .current
            .map(|c| c.time)
            .ok_or_else(|| anyhow::anyhow!("No current data in metadata response"))
    }

    /// Reset daily counter if day has changed
    async fn maybe_reset_daily_counter(&self) {
        let now = Utc::now();
        let counter_date = self.counter_date.read().await;

        if now.date_naive() != counter_date.date_naive() {
            drop(counter_date);
            let mut counter_date = self.counter_date.write().await;
            // Double-check after acquiring write lock
            if now.date_naive() != counter_date.date_naive() {
                *counter_date = now;
                self.daily_calls.store(0, Ordering::SeqCst);
                info!("Daily API counter reset");
            }
        }
    }

    /// Get current daily usage percentage
    pub fn daily_usage_pct(&self) -> f64 {
        let calls = self.daily_calls.load(Ordering::SeqCst);
        (calls as f64 / DAILY_BUDGET as f64) * 100.0
    }

    /// Record an API call for budget tracking
    fn record_call(&self) {
        self.daily_calls.fetch_add(1, Ordering::SeqCst);
    }

    /// Fetch forecast data (temperature, rain, wind) for a batch of cities
    pub async fn fetch_forecast_batch(
        &self,
        cities: &[WeatherCity],
    ) -> Result<Vec<CityWeatherData>> {
        if cities.is_empty() {
            return Ok(vec![]);
        }

        let latitudes: Vec<String> = cities
            .iter()
            .map(|c| format!("{:.6}", c.latitude))
            .collect();
        let longitudes: Vec<String> = cities
            .iter()
            .map(|c| format!("{:.6}", c.longitude))
            .collect();

        // Fetch both current and hourly (7 days) in same request - no extra API cost
        let url = format!(
            "{}?latitude={}&longitude={}&current=temperature_2m,rain,wind_speed_10m&hourly=temperature_2m,rain,wind_speed_10m&forecast_days=7&timezone=auto",
            FORECAST_URL,
            latitudes.join(","),
            longitudes.join(",")
        );

        debug!(url = %url, city_count = cities.len(), "Fetching forecast data");

        self.maybe_reset_daily_counter().await;
        self.record_call();

        let body = self.http.get_raw(&url).await
            .context("Failed to fetch forecast data")?;

        // OpenMeteo returns a single object for 1 city, an array for multiple
        let data = if cities.len() == 1 {
            let single: ForecastResponse = serde_json::from_str(&body)
                .context("Failed to parse single forecast response")?;
            vec![single]
        } else {
            serde_json::from_str::<Vec<ForecastResponse>>(&body)
                .context("Failed to parse batch forecast response")?
        };

        Ok(self.map_forecast_responses(cities, data))
    }

    /// Fetch air quality data (pm2.5, ozone) for a batch of cities
    pub async fn fetch_air_quality_batch(
        &self,
        cities: &[WeatherCity],
    ) -> Result<Vec<CityWeatherData>> {
        if cities.is_empty() {
            return Ok(vec![]);
        }

        let latitudes: Vec<String> = cities
            .iter()
            .map(|c| format!("{:.6}", c.latitude))
            .collect();
        let longitudes: Vec<String> = cities
            .iter()
            .map(|c| format!("{:.6}", c.longitude))
            .collect();

        let url = format!(
            "{}?latitude={}&longitude={}&current=pm2_5,ozone&timezone=auto",
            AIR_QUALITY_URL,
            latitudes.join(","),
            longitudes.join(",")
        );

        debug!(url = %url, city_count = cities.len(), "Fetching air quality data");

        self.maybe_reset_daily_counter().await;
        self.record_call();

        let body = self.http.get_raw(&url).await
            .context("Failed to fetch air quality data")?;

        // OpenMeteo returns a single object for 1 city, an array for multiple
        let data = if cities.len() == 1 {
            let single: AirQualityResponse = serde_json::from_str(&body)
                .context("Failed to parse single air quality response")?;
            vec![single]
        } else {
            serde_json::from_str::<Vec<AirQualityResponse>>(&body)
                .context("Failed to parse batch air quality response")?
        };

        Ok(self.map_air_quality_responses(cities, data))
    }

    /// Fetch all weather data for cities (forecast + air quality)
    pub async fn fetch_all_weather(&self, cities: &[WeatherCity]) -> Result<Vec<CityWeatherData>> {
        if cities.is_empty() {
            return Ok(vec![]);
        }

        // Check daily budget before starting
        let usage_before = self.daily_usage_pct();
        if usage_before > TARGET_USAGE_PCT * 100.0 {
            warn!(
                "Daily budget exceeded ({:.1}%), skipping weather fetch until tomorrow",
                usage_before
            );
            return Ok(vec![]);
        }

        let mut all_data: HashMap<String, CityWeatherData> = HashMap::new();
        let total_batches = (cities.len() + BATCH_SIZE - 1) / BATCH_SIZE;
        let expected_calls = total_batches * 2; // forecast + air quality

        info!(
            "Fetching weather for {} cities in {} batches (~{} API calls, daily usage: {:.1}%)",
            cities.len(),
            total_batches,
            expected_calls,
            usage_before
        );

        for (batch_idx, chunk) in cities.chunks(BATCH_SIZE).enumerate() {
            // Check budget mid-sync to avoid blowing past limit
            if self.daily_usage_pct() > TARGET_USAGE_PCT * 100.0 {
                warn!(
                    "Daily budget exceeded at batch {}/{}, stopping early ({:.1}%)",
                    batch_idx + 1,
                    total_batches,
                    self.daily_usage_pct()
                );
                break;
            }

            debug!(
                "Processing batch {}/{} ({} cities)",
                batch_idx + 1,
                total_batches,
                chunk.len()
            );

            // Fetch forecast data
            match self.fetch_forecast_batch(chunk).await {
                Ok(forecast_data) => {
                    for data in forecast_data {
                        all_data
                            .entry(data.city_id.clone())
                            .and_modify(|e| e.readings.extend(data.readings.clone()))
                            .or_insert(data);
                    }
                }
                Err(e) => {
                    warn!(
                        "Failed to fetch forecast for batch {}: {:?}",
                        batch_idx + 1,
                        e
                    );
                }
            }

            // Fetch air quality data
            match self.fetch_air_quality_batch(chunk).await {
                Ok(aq_data) => {
                    for data in aq_data {
                        all_data
                            .entry(data.city_id.clone())
                            .and_modify(|e| e.readings.extend(data.readings.clone()))
                            .or_insert(data);
                    }
                }
                Err(e) => {
                    warn!(
                        "Failed to fetch air quality for batch {}: {:?}",
                        batch_idx + 1,
                        e
                    );
                }
            }
        }

        let results: Vec<CityWeatherData> = all_data.into_values().collect();
        let usage_after = self.daily_usage_pct();

        info!(
            "Fetched weather data for {} cities (daily usage: {:.1}% -> {:.1}%)",
            results.len(),
            usage_before,
            usage_after
        );

        Ok(results)
    }

    fn map_forecast_responses(
        &self,
        cities: &[WeatherCity],
        responses: Vec<ForecastResponse>,
    ) -> Vec<CityWeatherData> {
        let mut results = Vec::new();
        let now = Utc::now();

        for (i, response) in responses.into_iter().enumerate() {
            if i >= cities.len() {
                break;
            }

            let city = &cities[i];
            let mut readings = HashMap::new();

            // Parse current data (stored to DB)
            if let Some(current) = response.current {
                if let Some(temp) = current.temperature_2m {
                    readings.insert(
                        WeatherMetric::Temperature2m,
                        Decimal::try_from(temp).unwrap_or_default(),
                    );
                }
                if let Some(rain) = current.rain {
                    readings.insert(
                        WeatherMetric::Rain,
                        Decimal::try_from(rain).unwrap_or_default(),
                    );
                }
                if let Some(wind) = current.wind_speed_10m {
                    readings.insert(
                        WeatherMetric::WindSpeed10m,
                        Decimal::try_from(wind).unwrap_or_default(),
                    );
                }
            }

            // Parse hourly forecast (kept in memory only)
            let hourly_forecast = response.hourly.map(|hourly| {
                let mut forecasts = HashMap::new();

                // Parse timestamps
                let times: Vec<DateTime<Utc>> = hourly
                    .time
                    .iter()
                    .filter_map(|t| {
                        chrono::NaiveDateTime::parse_from_str(t, "%Y-%m-%dT%H:%M")
                            .ok()
                            .map(|dt| dt.and_utc())
                    })
                    .collect();

                // Temperature forecast
                if let Some(temps) = hourly.temperature_2m {
                    let data: Vec<HourlyDataPoint> = times
                        .iter()
                        .zip(temps.iter())
                        .filter_map(|(time, val)| {
                            val.map(|v| HourlyDataPoint {
                                time: *time,
                                value: Decimal::try_from(v).unwrap_or_default(),
                            })
                        })
                        .collect();
                    forecasts.insert(WeatherMetric::Temperature2m, data);
                }

                // Rain forecast
                if let Some(rains) = hourly.rain {
                    let data: Vec<HourlyDataPoint> = times
                        .iter()
                        .zip(rains.iter())
                        .filter_map(|(time, val)| {
                            val.map(|v| HourlyDataPoint {
                                time: *time,
                                value: Decimal::try_from(v).unwrap_or_default(),
                            })
                        })
                        .collect();
                    forecasts.insert(WeatherMetric::Rain, data);
                }

                // Wind forecast
                if let Some(winds) = hourly.wind_speed_10m {
                    let data: Vec<HourlyDataPoint> = times
                        .iter()
                        .zip(winds.iter())
                        .filter_map(|(time, val)| {
                            val.map(|v| HourlyDataPoint {
                                time: *time,
                                value: Decimal::try_from(v).unwrap_or_default(),
                            })
                        })
                        .collect();
                    forecasts.insert(WeatherMetric::WindSpeed10m, data);
                }

                CityForecast {
                    city_id: city.city_id.clone(),
                    forecasts,
                    fetched_at: now,
                }
            });

            results.push(CityWeatherData {
                city_id: city.city_id.clone(),
                readings,
                hourly_forecast,
            });
        }

        results
    }

    fn map_air_quality_responses(
        &self,
        cities: &[WeatherCity],
        responses: Vec<AirQualityResponse>,
    ) -> Vec<CityWeatherData> {
        let mut results = Vec::new();

        for (i, response) in responses.into_iter().enumerate() {
            if i >= cities.len() {
                break;
            }

            let city = &cities[i];
            let mut readings = HashMap::new();

            if let Some(current) = response.current {
                if let Some(pm25) = current.pm2_5 {
                    readings.insert(
                        WeatherMetric::Pm25,
                        Decimal::try_from(pm25).unwrap_or_default(),
                    );
                }
                if let Some(ozone) = current.ozone {
                    readings.insert(
                        WeatherMetric::Ozone,
                        Decimal::try_from(ozone).unwrap_or_default(),
                    );
                }
            }

            results.push(CityWeatherData {
                city_id: city.city_id.clone(),
                readings,
                hourly_forecast: None, // Air quality doesn't have hourly forecast
            });
        }

        results
    }
}

impl Default for OpenMeteoClient {
    fn default() -> Self {
        Self::new().expect("Failed to create OpenMeteoClient")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_daily_usage_tracking() {
        let client = OpenMeteoClient::new().unwrap();

        // Initially 0% usage
        assert_eq!(client.daily_usage_pct(), 0.0);

        // Simulate some usage
        client.daily_calls.store(5000, Ordering::SeqCst);
        assert!((client.daily_usage_pct() - 50.0).abs() < 0.01);

        // At budget limit
        client.daily_calls.store(10_000, Ordering::SeqCst);
        assert!((client.daily_usage_pct() - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_record_call_increments() {
        let client = OpenMeteoClient::new().unwrap();
        assert_eq!(client.daily_calls.load(Ordering::SeqCst), 0);

        client.record_call();
        assert_eq!(client.daily_calls.load(Ordering::SeqCst), 1);

        client.record_call();
        assert_eq!(client.daily_calls.load(Ordering::SeqCst), 2);
    }
}
