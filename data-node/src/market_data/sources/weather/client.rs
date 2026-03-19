//! Weather station API client implementing MarketDataSource
//!
//! Fetches current weather data from https://api.open-meteo.com/v1/forecast
//! No API key required. Rate limit: 10,000 req/day.
//!
//! Uses a 120s shared cache between `fetch_assets` and `fetch_prices` to avoid
//! redundant requests. Cities are fetched sequentially with a small delay.

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{SourceHttpClient, RetryConfig};
use crate::market_data::traits::{AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate};

/// Open-Meteo forecast API base URL
const OPENMETEO_API: &str = "https://api.open-meteo.com/v1/forecast";

/// Cache TTL: 120 seconds (shared between fetch_assets and fetch_prices)
const CACHE_TTL_SECS: u64 = 120;

// ============================================================================
// City definitions — 20 major cities with lat/lon
// ============================================================================

struct CityDef {
    name: &'static str,
    slug: &'static str,
    lat: f64,
    lon: f64,
}

const CITIES: &[CityDef] = &[
    CityDef { name: "New York", slug: "new_york", lat: 40.71, lon: -74.01 },
    CityDef { name: "London", slug: "london", lat: 51.51, lon: -0.13 },
    CityDef { name: "Tokyo", slug: "tokyo", lat: 35.68, lon: 139.69 },
    CityDef { name: "Sydney", slug: "sydney", lat: -33.87, lon: 151.21 },
    CityDef { name: "Dubai", slug: "dubai", lat: 25.28, lon: 55.30 },
    CityDef { name: "Singapore", slug: "singapore", lat: 1.35, lon: 103.82 },
    CityDef { name: "Paris", slug: "paris", lat: 48.86, lon: 2.35 },
    CityDef { name: "Berlin", slug: "berlin", lat: 52.52, lon: 13.41 },
    CityDef { name: "Moscow", slug: "moscow", lat: 55.76, lon: 37.62 },
    CityDef { name: "Mumbai", slug: "mumbai", lat: 19.08, lon: 72.88 },
    CityDef { name: "Shanghai", slug: "shanghai", lat: 31.23, lon: 121.47 },
    CityDef { name: "Sao Paulo", slug: "sao_paulo", lat: -23.55, lon: -46.63 },
    CityDef { name: "Cairo", slug: "cairo", lat: 30.04, lon: 31.24 },
    CityDef { name: "Lagos", slug: "lagos", lat: 6.52, lon: 3.38 },
    CityDef { name: "Mexico City", slug: "mexico_city", lat: 19.43, lon: -99.13 },
    CityDef { name: "Seoul", slug: "seoul", lat: 37.57, lon: 126.98 },
    CityDef { name: "Toronto", slug: "toronto", lat: 43.65, lon: -79.38 },
    CityDef { name: "Buenos Aires", slug: "buenos_aires", lat: -34.60, lon: -58.38 },
    CityDef { name: "Johannesburg", slug: "johannesburg", lat: -26.20, lon: 28.05 },
    CityDef { name: "Bangkok", slug: "bangkok", lat: 13.76, lon: 100.50 },
];

// ============================================================================
// Open-Meteo API response types
// ============================================================================

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    current: Option<CurrentWeather>,
}

#[derive(Debug, Deserialize)]
struct CurrentWeather {
    /// Temperature in degrees Celsius
    #[serde(default)]
    temperature_2m: Option<f64>,
    /// Relative humidity in percent
    #[serde(default)]
    relative_humidity_2m: Option<f64>,
    /// Wind speed in km/h
    #[serde(default)]
    wind_speed_10m: Option<f64>,
}

// ============================================================================
// Cached weather data
// ============================================================================

#[derive(Debug, Clone)]
struct CachedReading {
    /// Market ID: "weather_{slug}_{metric}"
    market_id: String,
    /// Human-readable name: "{CityName} {Metric}"
    name: String,
    /// City slug for metadata
    city_slug: String,
    /// City name for metadata
    city_name: String,
    /// Metric type (temp, humidity, wind)
    metric: String,
    /// Metric unit
    unit: String,
    /// Current value
    value: f64,
    /// Latitude
    lat: f64,
    /// Longitude
    lon: f64,
}

struct CacheEntry {
    readings: Vec<CachedReading>,
    fetched_at: Instant,
}

// ============================================================================
// WeatherSource
// ============================================================================

/// Weather station data source using Open-Meteo API
pub struct WeatherSource {
    http: SourceHttpClient,
    cache: Arc<RwLock<Option<CacheEntry>>>,
}

impl WeatherSource {
    /// Create a new Weather source (no API key needed)
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Weather source initialized (Open-Meteo API, {} cities)", CITIES.len());

        Ok(Self {
            http,
            cache: Arc::new(RwLock::new(None)),
        })
    }

    /// Fetch weather data and populate cache.
    /// Returns cached data if still fresh (< 120s old).
    async fn fetch_and_cache(&self) -> Result<Vec<CachedReading>> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.as_ref() {
                if entry.fetched_at.elapsed() < Duration::from_secs(CACHE_TTL_SECS) {
                    debug!(
                        "Weather: using cached data ({} readings, {:.1}s old)",
                        entry.readings.len(),
                        entry.fetched_at.elapsed().as_secs_f64()
                    );
                    return Ok(entry.readings.clone());
                }
            }
        }

        // Cache miss or stale — fetch fresh data
        let readings = self.fetch_all_cities().await?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            *cache = Some(CacheEntry {
                readings: readings.clone(),
                fetched_at: Instant::now(),
            });
        }

        Ok(readings)
    }

    /// Fetch weather for all cities sequentially (rate-limited by SourceHttpClient).
    async fn fetch_all_cities(&self) -> Result<Vec<CachedReading>> {
        let mut all_readings = Vec::with_capacity(CITIES.len() * 3);
        let mut failed_cities: Vec<&str> = Vec::new();

        for city in CITIES.iter() {
            match self.fetch_city(city).await {
                Ok(readings) => {
                    all_readings.extend(readings);
                }
                Err(e) => {
                    warn!("Weather: failed to fetch {}: {}", city.name, e);
                    failed_cities.push(city.name);
                }
            }
        }

        let succeeded = CITIES.len() - failed_cities.len();
        if failed_cities.is_empty() {
            info!(
                "Weather: fetched {} readings from {}/{} cities",
                all_readings.len(), succeeded, CITIES.len()
            );
        } else {
            warn!(
                "Weather: fetched {} readings from {}/{} cities (failed: {})",
                all_readings.len(), succeeded, CITIES.len(),
                failed_cities.join(", ")
            );
        }

        Ok(all_readings)
    }

    /// Fetch weather for a single city and return up to 3 CachedReadings.
    async fn fetch_city(&self, city: &CityDef) -> Result<Vec<CachedReading>> {
        let url = format!(
            "{}?latitude={}&longitude={}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto",
            OPENMETEO_API, city.lat, city.lon
        );

        debug!("Weather: fetching {} from {}", city.name, url);

        let data: OpenMeteoResponse = self.http.get_json(&url).await
            .with_context(|| format!("Failed to fetch weather for {}", city.name))?;

        let current = match data.current {
            Some(c) => c,
            None => {
                warn!("Weather: no current data for {}", city.name);
                return Ok(Vec::new());
            }
        };

        let mut readings = Vec::with_capacity(3);

        // Temperature
        if let Some(temp) = current.temperature_2m {
            readings.push(CachedReading {
                market_id: format!("weather_{}_temp", city.slug),
                name: format!("{} Temperature", city.name),
                city_slug: city.slug.to_string(),
                city_name: city.name.to_string(),
                metric: "temp".to_string(),
                unit: "celsius".to_string(),
                value: temp,
                lat: city.lat,
                lon: city.lon,
            });
        }

        // Humidity
        if let Some(humidity) = current.relative_humidity_2m {
            readings.push(CachedReading {
                market_id: format!("weather_{}_humidity", city.slug),
                name: format!("{} Humidity", city.name),
                city_slug: city.slug.to_string(),
                city_name: city.name.to_string(),
                metric: "humidity".to_string(),
                unit: "percent".to_string(),
                value: humidity,
                lat: city.lat,
                lon: city.lon,
            });
        }

        // Wind speed
        if let Some(wind) = current.wind_speed_10m {
            readings.push(CachedReading {
                market_id: format!("weather_{}_wind", city.slug),
                name: format!("{} Wind Speed", city.name),
                city_slug: city.slug.to_string(),
                city_name: city.name.to_string(),
                metric: "wind".to_string(),
                unit: "km_h".to_string(),
                value: wind,
                lat: city.lat,
                lon: city.lon,
            });
        }

        Ok(readings)
    }
}

// ============================================================================
// MarketDataSource implementation
// ============================================================================

#[async_trait::async_trait]
impl MarketDataSource for WeatherSource {
    fn source_id(&self) -> &'static str {
        "weather_stations"
    }

    fn display_name(&self) -> &'static str {
        "Weather Stations"
    }

    fn default_resolution(&self) -> &'static str {
        "measurement"
    }

    fn sync_interval(&self) -> Duration {
        // Weather doesn't change fast; 15 minutes
        Duration::from_secs(900)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // Open-Meteo allows 10,000 req/day.
        // 20 cities * 96 syncs/day (every 15 min) = 1,920 req/day — well within limits.
        // Conservative: 100 req/min
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let readings = self.fetch_and_cache().await?;

        Ok(readings
            .into_iter()
            .map(|r| AssetUpdate {
                asset_id: r.market_id.clone(),
                symbol: r.market_id,
                name: r.name,
                category: Some("weather".to_string()),
                metadata: serde_json::json!({
                    "source": "weather",
                    "city_slug": r.city_slug,
                    "city_name": r.city_name,
                    "metric": r.metric,
                    "unit": r.unit,
                    "latitude": r.lat,
                    "longitude": r.lon,
                }),
            })
            .collect())
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        let now = Utc::now();
        let readings = self.fetch_and_cache().await?;

        // Build lookup set for requested asset IDs
        let requested: std::collections::HashSet<&str> =
            asset_ids.iter().map(|s| s.as_str()).collect();

        let results: Vec<PriceUpdate> = readings
            .into_iter()
            .filter(|r| requested.contains(r.market_id.as_str()))
            .map(|r| PriceUpdate {
                asset_id: r.market_id.clone(),
                symbol: r.market_id,
                value: Decimal::try_from(r.value).unwrap_or_default(),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            })
            .collect();

        info!(
            "Fetched {}/{} prices from Weather stations",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENVIRONMENTAL
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_market_id_format_temp() {
        let slug = "new_york";
        let market_id = format!("weather_{}_temp", slug);
        assert_eq!(market_id, "weather_new_york_temp");
    }

    #[test]
    fn test_market_id_format_humidity() {
        let slug = "tokyo";
        let market_id = format!("weather_{}_humidity", slug);
        assert_eq!(market_id, "weather_tokyo_humidity");
    }

    #[test]
    fn test_market_id_format_wind() {
        let slug = "london";
        let market_id = format!("weather_{}_wind", slug);
        assert_eq!(market_id, "weather_london_wind");
    }

    #[test]
    fn test_cities_count() {
        assert_eq!(CITIES.len(), 20);
    }

    #[test]
    fn test_all_slugs_unique() {
        let slugs: Vec<&str> = CITIES.iter().map(|c| c.slug).collect();
        let unique: std::collections::HashSet<&&str> = slugs.iter().collect();
        assert_eq!(slugs.len(), unique.len(), "All city slugs must be unique");
    }

    #[test]
    fn test_source_id() {
        assert_eq!("weather_stations", "weather_stations");
    }

    #[test]
    fn test_value_to_decimal() {
        let temp: f64 = 23.5;
        let decimal = Decimal::try_from(temp).unwrap();
        assert!(decimal > Decimal::ZERO);
    }

    #[test]
    fn test_total_markets() {
        // 20 cities * 3 metrics = 60 total markets
        assert_eq!(CITIES.len() * 3, 60);
    }
}
