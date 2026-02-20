//! Open-Meteo API client
//!
//! Fetches weather data from Open-Meteo free API.
//! Handles batching (50 cities per request), rate limiting, and retries.

use anyhow::{Context, Result};
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use super::models::{WeatherCity, WeatherMetric};

/// Open-Meteo Forecast API URL
const FORECAST_URL: &str = "https://api.open-meteo.com/v1/forecast";

/// Open-Meteo Air Quality API URL
const AIR_QUALITY_URL: &str = "https://air-quality-api.open-meteo.com/v1/air-quality";

/// Request timeout in seconds
const REQUEST_TIMEOUT_SECS: u64 = 60;

/// Maximum cities per batch request
const BATCH_SIZE: usize = 50;

/// Maximum retries per request
const MAX_RETRIES: u32 = 3;

/// Minimum delay between API requests (ms)
const MIN_REQUEST_DELAY_MS: u64 = 200;

/// Response from Open-Meteo Forecast API
#[derive(Debug, Deserialize)]
pub struct ForecastResponse {
    pub latitude: f64,
    pub longitude: f64,
    pub current: Option<CurrentWeather>,
}

#[derive(Debug, Deserialize)]
pub struct CurrentWeather {
    pub temperature_2m: Option<f64>,
    pub rain: Option<f64>,
    pub wind_speed_10m: Option<f64>,
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

/// Weather data for a single city
#[derive(Debug, Clone)]
pub struct CityWeatherData {
    pub city_id: String,
    pub readings: HashMap<WeatherMetric, Decimal>,
}

/// Open-Meteo API client with batching and rate limiting
#[derive(Clone)]
pub struct OpenMeteoClient {
    client: reqwest::Client,
    last_request: std::sync::Arc<tokio::sync::Mutex<std::time::Instant>>,
}

impl OpenMeteoClient {
    /// Create a new Open-Meteo API client
    pub fn new() -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            client,
            last_request: std::sync::Arc::new(tokio::sync::Mutex::new(std::time::Instant::now())),
        })
    }

    /// Enforce rate limiting before making a request
    async fn rate_limit(&self) {
        let mut last = self.last_request.lock().await;
        let elapsed = last.elapsed();
        let min_delay = Duration::from_millis(MIN_REQUEST_DELAY_MS);

        if elapsed < min_delay {
            let sleep_time = min_delay - elapsed;
            tokio::time::sleep(sleep_time).await;
        }

        *last = std::time::Instant::now();
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

        let url = format!(
            "{}?latitude={}&longitude={}&current=temperature_2m,rain,wind_speed_10m&timezone=auto",
            FORECAST_URL,
            latitudes.join(","),
            longitudes.join(",")
        );

        debug!(url = %url, city_count = cities.len(), "Fetching forecast data");

        let mut last_error = None;

        for attempt in 0..MAX_RETRIES {
            self.rate_limit().await;

            match self.client.get(&url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
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
                let delay = Duration::from_secs(2u64.pow(attempt));
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

            match self.client.get(&url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
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
                let delay = Duration::from_secs(2u64.pow(attempt));
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

        let mut all_data: HashMap<String, CityWeatherData> = HashMap::new();
        let total_batches = (cities.len() + BATCH_SIZE - 1) / BATCH_SIZE;

        info!(
            "Fetching weather for {} cities in {} batches",
            cities.len(),
            total_batches
        );

        for (batch_idx, chunk) in cities.chunks(BATCH_SIZE).enumerate() {
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
        info!(
            "Fetched weather data for {} cities with readings",
            results.len()
        );

        Ok(results)
    }

    fn map_forecast_responses(
        &self,
        cities: &[WeatherCity],
        responses: Vec<ForecastResponse>,
    ) -> Vec<CityWeatherData> {
        let mut results = Vec::new();

        for (i, response) in responses.into_iter().enumerate() {
            if i >= cities.len() {
                break;
            }

            let city = &cities[i];
            let mut readings = HashMap::new();

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

            results.push(CityWeatherData {
                city_id: city.city_id.clone(),
                readings,
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
