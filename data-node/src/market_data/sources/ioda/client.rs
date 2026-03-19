//! CAIDA IODA Internet Outage Detection source implementing MarketDataSource
//!
//! Monitors internet outages by country using the IODA API.
//! Each country is an asset; its value represents the latest BGP signal
//! (number of visible BGP prefixes, normalized). A drop indicates an outage.
//!
//! Assets are static -- defined in config/ioda.json.
//!
//! API: https://api.ioda.inetintel.cc.gatech.edu/v2/
//! Auth: None
//! Rate limit: Conservative 60 req/5min (academic API)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/ioda.json");

/// IODA API base URL
const API_BASE: &str = "https://api.ioda.inetintel.cc.gatech.edu/v2";

/// Delay between sequential country requests (ms). Academic API — be polite.
const INTER_REQUEST_DELAY_MS: u64 = 250;

/// How many seconds of historical signal data to request (1 hour)
const LOOKBACK_SECS: i64 = 3600;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// A single data series from the IODA signals endpoint.
/// Each series corresponds to one datasource (bgp, active-probing, darknet).
#[derive(Debug)]
struct SignalSeries {
    datasource: String,
    /// Time-series values as `[timestamp, value]` pairs.
    /// Values can be null (represented as None).
    values: Vec<(i64, Option<f64>)>,
}

/// Parse the IODA signals response JSON into signal series.
///
/// Response format:
/// ```json
/// {
///   "data": [
///     {
///       "entityType": "country",
///       "entityCode": "US",
///       "datasource": "bgp",
///       "values": [[timestamp, value], ...],
///       "from": ..., "until": ..., "step": ...
///     }
///   ]
/// }
/// ```
fn parse_signals_response(json: &serde_json::Value) -> Vec<SignalSeries> {
    let mut series = Vec::new();

    let data = match json.get("data").and_then(|d| d.as_array()) {
        Some(d) => d,
        None => return series,
    };

    for entry in data {
        let datasource = entry
            .get("datasource")
            .and_then(|d| d.as_str())
            .unwrap_or("")
            .to_string();

        let raw_values = match entry.get("values").and_then(|v| v.as_array()) {
            Some(v) => v,
            None => continue,
        };

        let mut values = Vec::with_capacity(raw_values.len());
        for pair in raw_values {
            if let Some(arr) = pair.as_array() {
                if arr.len() >= 2 {
                    let ts = arr[0].as_i64().unwrap_or(0);
                    let val = arr[1].as_f64(); // None if null
                    values.push((ts, val));
                }
            }
        }

        series.push(SignalSeries { datasource, values });
    }

    series
}

/// Extract the latest non-null value from a signal series.
/// Iterates from the end to find the most recent data point.
fn latest_value(series: &SignalSeries) -> Option<f64> {
    series
        .values
        .iter()
        .rev()
        .find_map(|(_ts, val)| *val)
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct IodaMarketSource {
    http: SourceHttpClient,
}

impl IodaMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("IODA internet outage detection source initialized");
        Ok(Self { http })
    }

    /// Fetch BGP signal data for a single country from the IODA API.
    /// Returns the latest non-null BGP value, or None if no data available.
    async fn fetch_country_bgp(&self, country_code: &str) -> Option<f64> {
        let now = Utc::now().timestamp();
        let from = now - LOOKBACK_SECS;

        let url = format!(
            "{}/signals/raw/country/{}?from={}&until={}&sourceParams=",
            API_BASE, country_code, from, now
        );

        match self.http.get_json::<serde_json::Value>(&url).await {
            Ok(json) => {
                let series_list = parse_signals_response(&json);

                // Find the BGP series — primary connectivity signal
                let bgp_series = series_list.iter().find(|s| s.datasource == "bgp");

                match bgp_series {
                    Some(s) => {
                        let val = latest_value(s);
                        if val.is_none() {
                            debug!("IODA {}: BGP series present but all values null", country_code);
                        }
                        val
                    }
                    None => {
                        // Fall back to active-probing if BGP not available
                        let alt = series_list.iter().find(|s| s.datasource == "merit-nt");
                        match alt {
                            Some(s) => {
                                let val = latest_value(s);
                                if val.is_some() {
                                    debug!(
                                        "IODA {}: using merit-nt fallback (no BGP series)",
                                        country_code
                                    );
                                }
                                val
                            }
                            None => {
                                debug!("IODA {}: no BGP or merit-nt series in response", country_code);
                                None
                            }
                        }
                    }
                }
            }
            Err(e) => {
                warn!("IODA: failed to fetch signals for {}: {:?}", country_code, e);
                None
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for IodaMarketSource {
    fn source_id(&self) -> &'static str {
        "ioda"
    }

    fn display_name(&self) -> &'static str {
        "Internet Outage Detection (IODA)"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        }
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::STATUS
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("IODA fetch_assets: {} countries loaded from config", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get country codes from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let (country_code, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (country code) for asset {}", asset_id);
                    continue;
                }
            };

            // Rate-limit: delay between requests to be polite to academic API
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

            match self.fetch_country_bgp(country_code).await {
                Some(bgp_value) => {
                    let value = Decimal::from_f64_retain(bgp_value)
                        .unwrap_or(Decimal::ZERO);

                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: symbol.clone(),
                        value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });

                    debug!(
                        "IODA {}: BGP signal = {} (country={})",
                        asset_id, value, country_code
                    );
                }
                None => {
                    debug!(
                        "IODA {}: no data available, skipping",
                        asset_id
                    );
                }
            }
        }

        info!(
            "Fetched {}/{} prices from IODA",
            results.len(),
            asset_ids.len(),
        );
        Ok(results)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 50, "Expected 50 IODA country entries");
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 50);
    }

    #[test]
    fn test_all_entries_environment_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(entry.category, "environment");
            assert_eq!(entry.subcategory, "internet_outage");
        }
    }

    #[test]
    fn test_api_ref_is_country_code() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            // api_ref should be a 2-letter ISO country code
            assert_eq!(
                entry.api_ref.len(), 2,
                "api_ref '{}' for {} should be 2-letter country code",
                entry.api_ref, entry.asset_id
            );
            assert!(
                entry.api_ref.chars().all(|c| c.is_ascii_uppercase()),
                "api_ref '{}' should be uppercase",
                entry.api_ref
            );
        }
    }

    #[test]
    fn test_asset_id_prefix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("ioda_"),
                "asset_id '{}' should start with 'ioda_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_parse_signals_response_bgp() {
        let json: serde_json::Value = serde_json::from_str(
            r#"{
                "data": [
                    {
                        "entityType": "country",
                        "entityCode": "US",
                        "datasource": "bgp",
                        "values": [[1710000000, 150000.5], [1710000300, 150100.0], [1710000600, null]],
                        "from": 1710000000,
                        "until": 1710003600,
                        "step": 300
                    },
                    {
                        "entityType": "country",
                        "entityCode": "US",
                        "datasource": "merit-nt",
                        "values": [[1710000000, 9500.0], [1710000300, 9600.0]],
                        "from": 1710000000,
                        "until": 1710003600,
                        "step": 300
                    }
                ]
            }"#,
        )
        .unwrap();

        let series = parse_signals_response(&json);
        assert_eq!(series.len(), 2);
        assert_eq!(series[0].datasource, "bgp");
        assert_eq!(series[1].datasource, "merit-nt");

        // BGP values
        assert_eq!(series[0].values.len(), 3);
        assert_eq!(series[0].values[0].0, 1710000000);
        assert!((series[0].values[0].1.unwrap() - 150000.5).abs() < 0.01);
        assert!(series[0].values[2].1.is_none()); // null value
    }

    #[test]
    fn test_parse_signals_response_empty() {
        let json: serde_json::Value = serde_json::from_str(r#"{"data": []}"#).unwrap();
        let series = parse_signals_response(&json);
        assert!(series.is_empty());
    }

    #[test]
    fn test_parse_signals_response_no_data_key() {
        let json: serde_json::Value = serde_json::from_str(r#"{"error": "not found"}"#).unwrap();
        let series = parse_signals_response(&json);
        assert!(series.is_empty());
    }

    #[test]
    fn test_latest_value_skips_nulls() {
        let series = SignalSeries {
            datasource: "bgp".to_string(),
            values: vec![
                (1710000000, Some(150000.0)),
                (1710000300, Some(150100.0)),
                (1710000600, None),
                (1710000900, None),
            ],
        };
        let val = latest_value(&series);
        assert!(val.is_some());
        assert!((val.unwrap() - 150100.0).abs() < 0.01);
    }

    #[test]
    fn test_latest_value_all_nulls() {
        let series = SignalSeries {
            datasource: "bgp".to_string(),
            values: vec![
                (1710000000, None),
                (1710000300, None),
            ],
        };
        assert!(latest_value(&series).is_none());
    }

    #[test]
    fn test_latest_value_empty() {
        let series = SignalSeries {
            datasource: "bgp".to_string(),
            values: vec![],
        };
        assert!(latest_value(&series).is_none());
    }

    #[test]
    fn test_latest_value_single() {
        let series = SignalSeries {
            datasource: "bgp".to_string(),
            values: vec![(1710000000, Some(42.0))],
        };
        assert!((latest_value(&series).unwrap() - 42.0).abs() < 0.01);
    }

    #[test]
    fn test_latest_value_uses_last_non_null() {
        let series = SignalSeries {
            datasource: "bgp".to_string(),
            values: vec![
                (1, Some(100.0)),
                (2, Some(200.0)),
                (3, Some(300.0)),
                (4, None),
            ],
        };
        // Should return 300.0 (last non-null)
        assert!((latest_value(&series).unwrap() - 300.0).abs() < 0.01);
    }

    #[test]
    fn test_key_countries_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let codes: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        // Spot-check key countries
        assert!(codes.contains(&"US"), "Missing US");
        assert!(codes.contains(&"CN"), "Missing CN");
        assert!(codes.contains(&"BR"), "Missing BR");
        assert!(codes.contains(&"IN"), "Missing IN");
        assert!(codes.contains(&"DE"), "Missing DE");
    }
}
