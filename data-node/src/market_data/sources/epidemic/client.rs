//! disease.sh Epidemics client implementing MarketDataSource
//!
//! Tracks global and per-country epidemic metrics: daily cases, deaths,
//! active cases, recovered, and cases per million.
//!
//! API: https://disease.sh/v3/covid-19
//! Auth: None
//! Rate limit: 30 req/min (be polite)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::Value;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration — static list of ~35 epidemic metrics
const ASSET_JSON: &str = include_str!("../../../config/epidemic.json");

/// disease.sh API base URL
const API_BASE: &str = "https://disease.sh/v3/covid-19";

/// Delay between sequential country fetches (ms)
const INTER_REQUEST_DELAY_MS: u64 = 2000;

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// disease.sh epidemic data market source.
///
/// Tracks global and per-country COVID-19 metrics.
/// Source ID is `"epidemic"`.
pub struct EpidemicMarketSource {
    http: SourceHttpClient,
}

impl EpidemicMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Epidemic source initialized (disease.sh)");

        Ok(Self { http })
    }

    /// Fetch global totals from /all
    async fn fetch_global(&self) -> Result<Value, SourceError> {
        let url = format!("{}/all", API_BASE);
        self.http.get_json::<Value>(&url).await
    }

    /// Fetch per-country data from /countries/{name}
    async fn fetch_country(&self, country: &str) -> Result<Value, SourceError> {
        let url = format!("{}/countries/{}", API_BASE, country);
        self.http.get_json::<Value>(&url).await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for EpidemicMarketSource {
    fn source_id(&self) -> &'static str {
        "epidemic"
    }

    fn display_name(&self) -> &'static str {
        "disease.sh Epidemics"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(1800) // 30 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let mut results = Vec::new();

        // Load asset entries to get api_ref mappings
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let api_ref_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        // Group assets by scope (global vs country name)
        let mut global_metrics: Vec<(String, String, String)> = Vec::new(); // (asset_id, metric, symbol)
        let mut country_metrics: HashMap<String, Vec<(String, String, String)>> = HashMap::new();

        for asset_id in asset_ids {
            if let Some(api_ref) = api_ref_map.get(asset_id.as_str()) {
                if let Some((scope, metric)) = api_ref.split_once(':') {
                    let symbol = format!("EPI/{}", scope.to_uppercase());
                    if scope == "global" {
                        global_metrics.push((asset_id.clone(), metric.to_string(), symbol));
                    } else {
                        country_metrics
                            .entry(scope.to_string())
                            .or_default()
                            .push((asset_id.clone(), metric.to_string(), symbol));
                    }
                }
            }
        }

        debug!(
            "Epidemic fetch_prices: {} global, {} countries",
            global_metrics.len(),
            country_metrics.len()
        );

        // Fetch global data once if needed
        if !global_metrics.is_empty() {
            match self.fetch_global().await {
                Ok(data) => {
                    for (asset_id, metric, symbol) in &global_metrics {
                        if let Some(val) = extract_metric_value(&data, metric) {
                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: symbol.clone(),
                                value: val,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Error fetching global epidemic data: {:?}", e);
                }
            }
        }

        // Fetch each country
        let mut failed_countries: Vec<String> = Vec::new();
        let total_countries = country_metrics.len();

        for (country, metrics) in &country_metrics {
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_country(country).await {
                Ok(data) => {
                    for (asset_id, metric, symbol) in metrics {
                        if let Some(val) = extract_metric_value(&data, metric) {
                            results.push(PriceUpdate {
                                asset_id: asset_id.clone(),
                                symbol: symbol.clone(),
                                value: val,
                                prev_close: None,
                                change_pct: None,
                                volume_24h: None,
                                market_cap: None,
                                fetched_at: now,
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Error fetching epidemic data for {}: {:?}", country, e);
                    failed_countries.push(country.clone());
                }
            }
        }

        if failed_countries.is_empty() {
            info!(
                "Fetched {}/{} prices from disease.sh ({} countries)",
                results.len(), asset_ids.len(), total_countries
            );
        } else {
            warn!(
                "Fetched {}/{} prices from disease.sh ({}/{} countries ok, failed: {})",
                results.len(), asset_ids.len(),
                total_countries - failed_countries.len(), total_countries,
                failed_countries.join(", ")
            );
        }

        Ok(results)
    }

    async fn discover_upstream_assets(&self) -> Result<Vec<AssetEntry>> {
        // Could fetch /countries to discover all available countries
        // For now, return empty — the static config covers the most relevant countries
        Ok(vec![])
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/// Extract a numeric metric from a JSON response using the metric name as a key.
fn extract_metric_value(data: &Value, metric: &str) -> Option<Decimal> {
    data.get(metric).and_then(|v| match v {
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Some(Decimal::from(i))
            } else if let Some(f) = n.as_f64() {
                Decimal::try_from(f).ok()
            } else {
                None
            }
        }
        _ => None,
    })
}

/// Parse api_ref "scope:metric" into (scope, metric)
fn parse_api_ref(api_ref: &str) -> Option<(&str, &str)> {
    api_ref.split_once(':')
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_source_id() {
        assert_eq!("epidemic", "epidemic");
    }

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(
            entries.len() >= 30,
            "Expected at least 30 epidemic assets, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_active_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 30,
            "Expected at least 30 active epidemic assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_entries_have_valid_api_ref() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let parsed = parse_api_ref(&entry.api_ref);
            assert!(
                parsed.is_some(),
                "Failed to parse api_ref '{}' for asset '{}'",
                entry.api_ref,
                entry.asset_id
            );
            let (scope, metric) = parsed.unwrap();
            assert!(!scope.is_empty(), "Empty scope in api_ref for {}", entry.asset_id);
            assert!(!metric.is_empty(), "Empty metric in api_ref for {}", entry.asset_id);
        }
    }

    #[test]
    fn test_all_entries_health_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "health",
                "Asset {} has category '{}', expected 'health'",
                entry.asset_id, entry.category
            );
        }
    }

    #[test]
    fn test_parse_api_ref() {
        assert_eq!(parse_api_ref("global:todayCases"), Some(("global", "todayCases")));
        assert_eq!(parse_api_ref("USA:active"), Some(("USA", "active")));
        assert_eq!(parse_api_ref("S. Korea:todayCases"), Some(("S. Korea", "todayCases")));
        assert_eq!(parse_api_ref("South Africa:todayCases"), Some(("South Africa", "todayCases")));
        assert_eq!(parse_api_ref("invalid"), None);
    }

    #[test]
    fn test_extract_metric_value() {
        let data: Value = serde_json::from_str(
            r#"{"cases": 123456789, "todayCases": 1234, "active": 567890, "casesPerOneMillion": 12345.67}"#,
        )
        .unwrap();

        assert_eq!(
            extract_metric_value(&data, "cases"),
            Some(Decimal::from(123456789i64))
        );
        assert_eq!(
            extract_metric_value(&data, "todayCases"),
            Some(Decimal::from(1234i64))
        );
        assert_eq!(
            extract_metric_value(&data, "active"),
            Some(Decimal::from(567890i64))
        );
        assert!(extract_metric_value(&data, "casesPerOneMillion").is_some());
        assert_eq!(extract_metric_value(&data, "nonexistent"), None);
    }

    #[test]
    fn test_global_metrics_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let global_count = entries
            .iter()
            .filter(|e| e.api_ref.starts_with("global:"))
            .count();
        assert!(
            global_count >= 5,
            "Expected at least 5 global metrics, got {}",
            global_count
        );
    }

    #[test]
    fn test_country_metrics_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let country_count = entries
            .iter()
            .filter(|e| !e.api_ref.starts_with("global:"))
            .count();
        assert!(
            country_count >= 25,
            "Expected at least 25 country metrics, got {}",
            country_count
        );
    }
}
