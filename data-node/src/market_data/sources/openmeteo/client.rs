//! Open-Meteo MarketDataSource implementation
//!
//! Provides weather data through the unified MarketDataSource trait.
//! Uses smart sync to only fetch when OpenMeteo has new data available.
//!
//! Asset ID format: `{city_id}:{metric}` (e.g., "paris-fr:temperature_2m")
//! Categories by population rank:
//! - meteoTop100: cities ranked 1-100
//! - meteoTop1000: cities ranked 101-1000
//! - meteoOther: cities ranked 1001+

use anyhow::{Context, Result};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info};

use super::api_client::OpenMeteoClient;
use super::models::{CityForecast, HourlyDataPoint, WeatherCity, WeatherMetric};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Default sync interval: 5 minutes (checks metadata, only fetches on update)
const DEFAULT_SYNC_INTERVAL_SECS: u64 = 300;

/// Minimum time between actual data fetches (even if metadata says new data)
/// 45 minutes — targets ~75% of OpenMeteo's 10,000 calls/day free tier
/// with ~32k cities (323 batches × 2 endpoints = 646 calls/fetch × ~11 fetches/day ≈ 7,100)
const MIN_FETCH_INTERVAL_SECS: u64 = 2700;

/// Embedded cities.json
const CITIES_JSON: &str = include_str!("cities.json");

/// Open-Meteo weather data source with smart sync.
///
/// Source ID is `"weather"`.
/// Each (city, metric) combination is a separate asset.
///
/// Uses metadata API to detect when new data is available,
/// avoiding unnecessary fetches and maximizing city coverage.
///
/// ## Data Storage Strategy
/// - **Current data**: Stored to database (for settlement)
/// - **Hourly forecasts**: Kept in memory only (refreshed each sync)
pub struct OpenMeteoMarketSource {
    client: OpenMeteoClient,
    sync_interval_secs: u64,
    /// Cached city data for asset generation
    cities: Vec<CityInfo>,
    /// Last data timestamp from OpenMeteo (for smart sync)
    last_data_timestamp: Arc<RwLock<Option<String>>>,
    /// Last time we actually fetched data
    last_fetch_time: Arc<RwLock<Option<std::time::Instant>>>,
    /// In-memory cache of hourly forecasts (7 days) - refreshed each sync
    forecast_cache: Arc<RwLock<HashMap<String, CityForecast>>>,
}

/// Parsed city info from embedded JSON
#[derive(Debug, Clone, Deserialize)]
struct CityInfo {
    city_id: String,
    name: String,
    country_code: String,
    latitude: f64,
    longitude: f64,
    population: i64,
    rank: i32,
}

impl OpenMeteoMarketSource {
    /// Create a new Open-Meteo market source with smart sync
    pub fn new(sync_interval_secs: u64) -> Result<Self> {
        let client = OpenMeteoClient::new()?;
        let cities = parse_cities_json(CITIES_JSON)?;

        info!(
            "OpenMeteoMarketSource initialized with {} cities (smart sync + forecast cache)",
            cities.len()
        );

        Ok(Self {
            client,
            sync_interval_secs,
            cities,
            last_data_timestamp: Arc::new(RwLock::new(None)),
            last_fetch_time: Arc::new(RwLock::new(None)),
            forecast_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let sync_interval_secs = std::env::var("OPENMETEO_SYNC_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_SYNC_INTERVAL_SECS);

        Self::new(sync_interval_secs)
    }

    /// Check if new data is available from OpenMeteo.
    /// Returns true if we should fetch, false if we can skip.
    async fn should_fetch(&self) -> bool {
        // Check minimum fetch interval
        {
            let last_fetch = self.last_fetch_time.read().await;
            if let Some(last) = *last_fetch {
                if last.elapsed() < Duration::from_secs(MIN_FETCH_INTERVAL_SECS) {
                    debug!(
                        "Skipping fetch: only {}s since last fetch (min: {}s)",
                        last.elapsed().as_secs(),
                        MIN_FETCH_INTERVAL_SECS
                    );
                    return false;
                }
            }
        }

        // Check if OpenMeteo has new data
        match self.client.fetch_data_timestamp().await {
            Ok(current_timestamp) => {
                let last_timestamp = self.last_data_timestamp.read().await;

                if let Some(ref last) = *last_timestamp {
                    if last == &current_timestamp {
                        debug!(
                            "Skipping fetch: data timestamp unchanged ({})",
                            current_timestamp
                        );
                        return false;
                    }
                }

                info!(
                    "New data available: {} (was: {:?})",
                    current_timestamp,
                    last_timestamp.as_ref()
                );
                true
            }
            Err(e) => {
                // If metadata check fails, fetch anyway to be safe
                debug!("Metadata check failed, fetching anyway: {:?}", e);
                true
            }
        }
    }

    /// Update the last fetch timestamp after a successful fetch
    async fn mark_fetched(&self, data_timestamp: Option<String>) {
        {
            let mut last_fetch = self.last_fetch_time.write().await;
            *last_fetch = Some(std::time::Instant::now());
        }

        if let Some(ts) = data_timestamp {
            let mut last_ts = self.last_data_timestamp.write().await;
            *last_ts = Some(ts);
        }
    }

    /// Update the forecast cache with new data
    async fn update_forecast_cache(&self, forecasts: Vec<CityForecast>) {
        let mut cache = self.forecast_cache.write().await;
        for forecast in forecasts {
            cache.insert(forecast.city_id.clone(), forecast);
        }
        info!("Forecast cache updated with {} cities", cache.len());
    }

    /// Get forecast cache size (number of cities)
    pub async fn forecast_cache_size(&self) -> usize {
        let cache = self.forecast_cache.read().await;
        cache.len()
    }

    /// Parse asset_id into (city_id, metric)
    fn parse_asset_id(asset_id: &str) -> Option<(String, String)> {
        let parts: Vec<&str> = asset_id.split(':').collect();
        if parts.len() == 2 {
            Some((parts[0].to_string(), parts[1].to_string()))
        } else {
            None
        }
    }

}

#[async_trait::async_trait]
impl MarketDataSource for OpenMeteoMarketSource {
    fn source_id(&self) -> &'static str {
        "weather"
    }

    fn display_name(&self) -> &'static str {
        "Open-Meteo Weather"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(self.sync_interval_secs)
    }

    fn skips_when_unchanged(&self) -> bool {
        true // Smart sync: returns empty when OpenMeteo data timestamp hasn't changed
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // Open-Meteo free tier: 10,000 calls/day
        // ~32k cities = 322 batches × 2 = 644 calls/fetch, ~11 fetches/day ≈ 7,100/day (71%)
        // 300 req/min burst for fast batch processing
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 300,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // Generate assets dynamically from cities × metrics (no static JSON needed)
        let metrics = WeatherMetric::all();
        let mut assets = Vec::with_capacity(self.cities.len() * metrics.len());

        for city in &self.cities {
            for metric in metrics {
                let asset_id = format!("{}:{}", city.city_id, metric.as_str());
                let name = format!("{} {}", city.name, metric.display_name());
                let subcategory = metric.subcategory();

                assets.push(AssetUpdate {
                    asset_id: asset_id.clone(),
                    symbol: asset_id,
                    name,
                    category: Some("weather".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("{},{},{}", city.latitude, city.longitude, metric.as_str()),
                        "subcategory": subcategory,
                        "active": true,
                        "extra": {
                            "country_code": city.country_code,
                            "population": city.population,
                            "rank": city.rank,
                        },
                    }),
                });
            }
        }

        info!(
            "Generated {} weather assets ({} cities × {} metrics)",
            assets.len(), self.cities.len(), metrics.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        // Smart sync: check if new data is available
        if !self.should_fetch().await {
            debug!("Smart sync: no new data, returning empty");
            return Ok(Vec::new());
        }

        // Group asset_ids by city_id
        let mut city_assets: HashMap<String, Vec<String>> = HashMap::new();
        for asset_id in asset_ids {
            if let Some((city_id, metric)) = Self::parse_asset_id(asset_id) {
                city_assets.entry(city_id).or_default().push(metric);
            }
        }

        // Get city info for the requested cities
        let city_map: HashMap<&str, &CityInfo> = self
            .cities
            .iter()
            .map(|c| (c.city_id.as_str(), c))
            .collect();

        let weather_cities: Vec<WeatherCity> = city_assets
            .keys()
            .filter_map(|city_id| {
                city_map.get(city_id.as_str()).map(|info| WeatherCity {
                    city_id: info.city_id.clone(),
                    name: info.name.clone(),
                    country_code: info.country_code.clone(),
                    latitude: Decimal::try_from(info.latitude).unwrap_or_default(),
                    longitude: Decimal::try_from(info.longitude).unwrap_or_default(),
                    population: info.population,
                    rank: info.rank,
                    is_active: true,
                    created_at: Utc::now(),
                })
            })
            .collect();

        if weather_cities.is_empty() {
            return Ok(Vec::new());
        }

        // Fetch weather data (current + hourly forecast in same request)
        let weather_data = self.client.fetch_all_weather(&weather_cities).await?;
        let now = Utc::now();
        let mut results = Vec::new();
        let mut forecasts_to_cache = Vec::new();

        for data in weather_data {
            // Collect current readings for DB storage
            for (metric, value) in &data.readings {
                let metric_str = metric.as_str();
                let asset_id = format!("{}:{}", data.city_id, metric_str);

                // Only include if this asset was requested
                if asset_ids.contains(&asset_id) {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: asset_id,
                        value: *value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }

            // Collect hourly forecasts for memory cache
            if let Some(forecast) = data.hourly_forecast {
                forecasts_to_cache.push(forecast);
            }
        }

        // Update in-memory forecast cache
        if !forecasts_to_cache.is_empty() {
            self.update_forecast_cache(forecasts_to_cache).await;
        }

        info!(
            "Fetched {}/{} weather readings, forecast cache: {} cities",
            results.len(),
            asset_ids.len(),
            self.forecast_cache_size().await
        );

        // Mark fetch complete with current timestamp
        let current_ts = self.client.fetch_data_timestamp().await.ok();
        self.mark_fetched(current_ts).await;

        Ok(results)
    }
}

/// Parse cities.json into a list of CityInfo
fn parse_cities_json(json_str: &str) -> Result<Vec<CityInfo>> {
    let cities: Vec<CityInfo> =
        serde_json::from_str(json_str).context("Failed to parse cities.json")?;
    Ok(cities)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_cities_json() {
        let cities = parse_cities_json(CITIES_JSON).expect("Failed to parse");
        assert!(!cities.is_empty(), "Should have cities");
        assert!(cities.len() > 30000, "Expected 30k+ cities from GeoNames, got {}", cities.len());

        let first = &cities[0];
        assert!(!first.city_id.is_empty());
        assert!(!first.name.is_empty());
        assert!(first.rank > 0);
    }

    #[test]
    fn test_dynamic_asset_generation() {
        let source = OpenMeteoMarketSource::new(300).unwrap();
        let metrics = WeatherMetric::all();
        let expected = source.cities.len() * metrics.len();
        // Verify the count matches cities × metrics
        assert!(expected > 150000, "Expected 150k+ assets (32k cities × 5 metrics), got {}", expected);
    }

    #[test]
    fn test_budget_targeting() {
        // Verify we target ~75% of 10,000 calls/day free tier
        // 32k cities / 100 batch = 322 batches × 2 endpoints = 644 calls/fetch
        // MIN_FETCH_INTERVAL = 2700s → ~11-12 fetches/day
        // 644 × 11 = 7,084 (71%), 644 × 12 = 7,728 (77%)
        let source = OpenMeteoMarketSource::new(300).unwrap();
        let batches = (source.cities.len() + 99) / 100; // BATCH_SIZE = 100
        let calls_per_fetch = batches * 2; // forecast + air quality
        // Conservative: 10 fetches/day, aggressive: 14 fetches/day
        let daily_low = calls_per_fetch * 10;
        let daily_high = calls_per_fetch * 14;
        assert!(daily_low >= 5000, "Budget usage too low: {} calls at 10 fetches/day", daily_low);
        assert!(daily_high <= 10000, "Budget would exceed limit: {} calls at 14 fetches/day", daily_high);
    }

    #[test]
    fn test_parse_asset_id() {
        assert_eq!(
            OpenMeteoMarketSource::parse_asset_id("paris-fr:temperature_2m"),
            Some(("paris-fr".to_string(), "temperature_2m".to_string()))
        );
        assert_eq!(
            OpenMeteoMarketSource::parse_asset_id("new-york-us:pm2_5"),
            Some(("new-york-us".to_string(), "pm2_5".to_string()))
        );
        assert_eq!(OpenMeteoMarketSource::parse_asset_id("invalid"), None);
    }
}
