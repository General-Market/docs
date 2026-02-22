//! Open-Meteo API client
//!
//! Fetches weather data from Open-Meteo free API with optimized rate limiting.
//!
//! ## Rate Limit Strategy
//!
//! - Free tier: 10,000 calls/day
//! - Smart sync: ~6 fetches/day (only when data updates, min 1h interval)
//! - Budget per fetch: 10,000 / 6 ≈ 1,666 calls
//! - With 5,000 cities: 50 batches × 2 APIs = 100 calls per fetch
//! - Daily usage: 100 × 6 = 600 calls (6% of limit)
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

/// Maximum retries per request
const MAX_RETRIES: u32 = 3;

/// Base delay between API requests (ms) - increases adaptively
const BASE_REQUEST_DELAY_MS: u64 = 100;

/// Maximum delay between requests (ms) - when approaching rate limit
const MAX_REQUEST_DELAY_MS: u64 = 2000;

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

/// Open-Meteo API client with adaptive rate limiting
#[derive(Clone)]
pub struct OpenMeteoClient {
    client: reqwest::Client,
    /// Last request timestamp for rate limiting
    last_request: std::sync::Arc<tokio::sync::Mutex<std::time::Instant>>,
    /// Daily API call counter (resets at midnight UTC)
    daily_calls: std::sync::Arc<AtomicU64>,
    /// Date of last counter reset
    counter_date: std::sync::Arc<tokio::sync::RwLock<DateTime<Utc>>>,
    /// Current adaptive delay multiplier (1.0 = normal, higher = slower)
    delay_multiplier: std::sync::Arc<AtomicU64>,
}

impl OpenMeteoClient {
    /// Create a new Open-Meteo API client with adaptive rate limiting
    pub fn new() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            client,
            last_request: std::sync::Arc::new(tokio::sync::Mutex::new(std::time::Instant::now())),
            daily_calls: std::sync::Arc::new(AtomicU64::new(0)),
            counter_date: std::sync::Arc::new(tokio::sync::RwLock::new(Utc::now())),
            delay_multiplier: std::sync::Arc::new(AtomicU64::new(100)), // 1.0 as fixed point (×100)
        })
    }

    /// Check if new data is available by fetching metadata.
    /// Returns the current data timestamp if successful.
    /// This is a lightweight call that doesn't count heavily against rate limits.
    pub async fn fetch_data_timestamp(&self) -> Result<String> {
        let response = self
            .client
            .get(METADATA_URL)
            .send()
            .await
            .context("Failed to fetch metadata")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Metadata request failed: {}",
                response.status()
            ));
        }

        let metadata: MetadataResponse = response
            .json()
            .await
            .context("Failed to parse metadata response")?;

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
                self.delay_multiplier.store(100, Ordering::SeqCst);
                info!("Daily API counter reset");
            }
        }
    }

    /// Get current daily usage percentage
    pub fn daily_usage_pct(&self) -> f64 {
        let calls = self.daily_calls.load(Ordering::SeqCst);
        (calls as f64 / DAILY_BUDGET as f64) * 100.0
    }

    /// Calculate adaptive delay based on daily budget usage
    fn calculate_delay(&self) -> Duration {
        let calls = self.daily_calls.load(Ordering::SeqCst);
        let usage_pct = calls as f64 / DAILY_BUDGET as f64;

        // Ramp up delay as we approach budget
        let delay_ms = if usage_pct < 0.5 {
            // Under 50%: minimum delay
            BASE_REQUEST_DELAY_MS
        } else if usage_pct < 0.7 {
            // 50-70%: slight increase
            BASE_REQUEST_DELAY_MS * 2
        } else if usage_pct < 0.85 {
            // 70-85%: moderate increase
            BASE_REQUEST_DELAY_MS * 5
        } else {
            // 85%+: maximum delay
            MAX_REQUEST_DELAY_MS
        };

        // Apply any temporary multiplier from rate limit errors
        let multiplier = self.delay_multiplier.load(Ordering::SeqCst) as f64 / 100.0;
        let final_delay = (delay_ms as f64 * multiplier) as u64;

        Duration::from_millis(final_delay.min(MAX_REQUEST_DELAY_MS))
    }

    /// Enforce adaptive rate limiting before making a request
    async fn rate_limit(&self) {
        self.maybe_reset_daily_counter().await;

        let mut last = self.last_request.lock().await;
        let elapsed = last.elapsed();
        let min_delay = self.calculate_delay();

        if elapsed < min_delay {
            let sleep_time = min_delay - elapsed;
            debug!("Rate limiting: sleeping {}ms", sleep_time.as_millis());
            tokio::time::sleep(sleep_time).await;
        }

        *last = std::time::Instant::now();
    }

    /// Record an API call for budget tracking
    fn record_call(&self) {
        self.daily_calls.fetch_add(1, Ordering::SeqCst);
    }

    /// Handle rate limit error by increasing delay multiplier
    fn handle_rate_limit(&self) {
        let current = self.delay_multiplier.load(Ordering::SeqCst);
        let new_value = (current * 2).min(1000); // Max 10x multiplier
        self.delay_multiplier.store(new_value, Ordering::SeqCst);
        warn!(
            "Rate limit hit, increasing delay multiplier to {}x",
            new_value as f64 / 100.0
        );
    }

    /// Gradually reduce delay multiplier after successful requests
    fn handle_success(&self) {
        let current = self.delay_multiplier.load(Ordering::SeqCst);
        if current > 100 {
            let new_value = ((current as f64 * 0.9) as u64).max(100);
            self.delay_multiplier.store(new_value, Ordering::SeqCst);
        }
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

        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            self.rate_limit().await;
            self.record_call();

            match self.client.get(&url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        self.handle_success();
                        let body = response
                            .text()
                            .await
                            .context("Failed to read response body")?;

                        let data = if cities.len() == 1 {
                            let single: ForecastResponse = serde_json::from_str(&body)
                                .context("Failed to parse single forecast response")?;
                            vec![single]
                        } else {
                            serde_json::from_str::<Vec<ForecastResponse>>(&body)
                                .context("Failed to parse batch forecast response")?
                        };

                        return Ok(self.map_forecast_responses(cities, data));
                    } else {
                        let status = response.status();
                        let body = response.text().await.unwrap_or_default();

                        // Check for rate limit (429) or server overload (503)
                        if status.as_u16() == 429 || status.as_u16() == 503 {
                            self.handle_rate_limit();
                        }

                        warn!(
                            "Open-Meteo API error (attempt {}/{}): status {}, body: {}",
                            attempt + 1,
                            MAX_RETRIES,
                            status,
                            body
                        );
                        last_error = Some(format!("HTTP {}: {}", status, body));
                    }
                }
                Err(e) => {
                    warn!(
                        "Request failed (attempt {}/{}): {:?}",
                        attempt + 1,
                        MAX_RETRIES,
                        e
                    );
                    last_error = Some(e.to_string());
                }
            }

            if attempt < MAX_RETRIES - 1 {
                // Exponential backoff
                let delay = Duration::from_secs(2u64.pow(attempt + 1));
                tokio::time::sleep(delay).await;
            }
        }

        Err(anyhow::anyhow!(
            "Failed to fetch forecast after {} retries: {:?}",
            MAX_RETRIES,
            last_error
        ))
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

        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            self.rate_limit().await;
            self.record_call();

            match self.client.get(&url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        self.handle_success();
                        let body = response
                            .text()
                            .await
                            .context("Failed to read response body")?;

                        let data = if cities.len() == 1 {
                            let single: AirQualityResponse = serde_json::from_str(&body)
                                .context("Failed to parse single air quality response")?;
                            vec![single]
                        } else {
                            serde_json::from_str::<Vec<AirQualityResponse>>(&body)
                                .context("Failed to parse batch air quality response")?
                        };

                        return Ok(self.map_air_quality_responses(cities, data));
                    } else {
                        let status = response.status();
                        let body = response.text().await.unwrap_or_default();

                        // Check for rate limit (429) or server overload (503)
                        if status.as_u16() == 429 || status.as_u16() == 503 {
                            self.handle_rate_limit();
                        }

                        warn!(
                            "Open-Meteo API error (attempt {}/{}): status {}, body: {}",
                            attempt + 1,
                            MAX_RETRIES,
                            status,
                            body
                        );
                        last_error = Some(format!("HTTP {}: {}", status, body));
                    }
                }
                Err(e) => {
                    warn!(
                        "Request failed (attempt {}/{}): {:?}",
                        attempt + 1,
                        MAX_RETRIES,
                        e
                    );
                    last_error = Some(e.to_string());
                }
            }

            if attempt < MAX_RETRIES - 1 {
                // Exponential backoff
                let delay = Duration::from_secs(2u64.pow(attempt + 1));
                tokio::time::sleep(delay).await;
            }
        }

        Err(anyhow::anyhow!(
            "Failed to fetch air quality after {} retries: {:?}",
            MAX_RETRIES,
            last_error
        ))
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
    fn test_adaptive_delay_calculation() {
        let client = OpenMeteoClient::new().unwrap();

        // At 0% usage, should be base delay
        let delay = client.calculate_delay();
        assert_eq!(delay, Duration::from_millis(BASE_REQUEST_DELAY_MS));

        // Simulate 60% usage
        client.daily_calls.store(6000, Ordering::SeqCst);
        let delay = client.calculate_delay();
        assert!(delay > Duration::from_millis(BASE_REQUEST_DELAY_MS));

        // Simulate 90% usage
        client.daily_calls.store(9000, Ordering::SeqCst);
        let delay = client.calculate_delay();
        assert_eq!(delay, Duration::from_millis(MAX_REQUEST_DELAY_MS));
    }

    #[test]
    fn test_rate_limit_backoff() {
        let client = OpenMeteoClient::new().unwrap();

        // Initial multiplier is 1.0 (100 in fixed point)
        assert_eq!(client.delay_multiplier.load(Ordering::SeqCst), 100);

        // After rate limit, should double
        client.handle_rate_limit();
        assert_eq!(client.delay_multiplier.load(Ordering::SeqCst), 200);

        // Success should gradually reduce
        client.handle_success();
        assert!(client.delay_multiplier.load(Ordering::SeqCst) < 200);
    }
}
