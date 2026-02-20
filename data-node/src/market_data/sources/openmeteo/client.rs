//! Open-Meteo MarketDataSource implementation
//!
//! Provides weather data through the unified MarketDataSource trait.
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
use std::time::Duration;
use tracing::info;

use super::api_client::OpenMeteoClient;
use super::models::{WeatherCity, WeatherMetric};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

/// Default sync interval: 30 minutes
const DEFAULT_SYNC_INTERVAL_SECS: u64 = 1800;

/// Embedded cities.json
const CITIES_JSON: &str = include_str!("cities.json");

/// Open-Meteo weather data source.
///
/// Source ID is `"weather"`.
/// Each (city, metric) combination is a separate asset.
pub struct OpenMeteoMarketSource {
    client: OpenMeteoClient,
    sync_interval_secs: u64,
    /// Cached city data for asset generation
    cities: Vec<CityInfo>,
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
    /// Create a new Open-Meteo market source
    pub fn new(sync_interval_secs: u64) -> Result<Self> {
        let client = OpenMeteoClient::new()?;
        let cities = parse_cities_json(CITIES_JSON)?;

        info!(
            "OpenMeteoMarketSource initialized with {} cities",
            cities.len()
        );

        Ok(Self {
            client,
            sync_interval_secs,
            cities,
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

    /// Determine category based on city population rank
    fn get_category(rank: i32) -> String {
        if rank <= 100 {
            "meteoTop100".to_string()
        } else if rank <= 1000 {
            "meteoTop1000".to_string()
        } else {
            "meteoOther".to_string()
        }
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

    /// Get display name for a metric
    fn metric_display_name(metric: &str) -> &'static str {
        match metric {
            "temperature_2m" => "Temperature",
            "rain" => "Rainfall",
            "wind_speed_10m" => "Wind Speed",
            "pm2_5" => "PM2.5",
            "ozone" => "Ozone",
            _ => "Unknown",
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

    fn rate_limit_config(&self) -> RateLimitConfig {
        // Open-Meteo free tier: 10,000 calls/day
        // Conservative: 200 req/min to stay safe
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 200,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let metrics = WeatherMetric::all();
        let mut assets = Vec::new();

        for city in &self.cities {
            let category = Self::get_category(city.rank);

            for metric in metrics {
                let metric_str = metric.as_str();
                let asset_id = format!("{}:{}", city.city_id, metric_str);
                let symbol = asset_id.clone();
                let name = format!("{} {}", city.name, Self::metric_display_name(metric_str));

                assets.push(AssetUpdate {
                    asset_id,
                    symbol,
                    name,
                    category: Some(category.clone()),
                    metadata: serde_json::json!({
                        "city_id": city.city_id,
                        "city_name": city.name,
                        "country_code": city.country_code,
                        "latitude": city.latitude,
                        "longitude": city.longitude,
                        "population": city.population,
                        "rank": city.rank,
                        "metric": metric_str,
                        "unit": metric.unit(),
                    }),
                });
            }
        }

        info!(
            "Generated {} weather assets ({} cities x {} metrics)",
            assets.len(),
            self.cities.len(),
            metrics.len()
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
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

        // Fetch weather data
        let weather_data = self.client.fetch_all_weather(&weather_cities).await?;
        let now = Utc::now();
        let mut results = Vec::new();

        for data in weather_data {
            for (metric, value) in data.readings {
                let metric_str = metric.as_str();
                let asset_id = format!("{}:{}", data.city_id, metric_str);

                // Only include if this asset was requested
                if asset_ids.contains(&asset_id) {
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: asset_id,
                        value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
            }
        }

        info!(
            "Fetched {}/{} weather readings from Open-Meteo",
            results.len(),
            asset_ids.len()
        );

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

        let first = &cities[0];
        assert!(!first.city_id.is_empty());
        assert!(!first.name.is_empty());
        assert!(first.rank > 0);
    }

    #[test]
    fn test_category_assignment() {
        assert_eq!(OpenMeteoMarketSource::get_category(1), "meteoTop100");
        assert_eq!(OpenMeteoMarketSource::get_category(100), "meteoTop100");
        assert_eq!(OpenMeteoMarketSource::get_category(101), "meteoTop1000");
        assert_eq!(OpenMeteoMarketSource::get_category(1000), "meteoTop1000");
        assert_eq!(OpenMeteoMarketSource::get_category(1001), "meteoOther");
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
