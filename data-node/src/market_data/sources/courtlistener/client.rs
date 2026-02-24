//! CourtListener Federal Courts client implementing MarketDataSource
//!
//! Tracks daily federal court filing activity from CourtListener (Free Law Project).
//! Each asset represents a court + metric pair; its value is the count of filings today.
//!
//! **Metrics per court:**
//! - opinions: opinion clusters filed today
//! - entries: docket entries created today
//! - cases: new dockets (cases) created today
//!
//! Values climb from 0 throughout business hours (~100k new docket entries/day across
//! all courts). District courts like SDNY have hundreds of entries per day.
//!
//! Assets are static — defined in config/courtlistener.json (102 entries: 34 courts × 3 metrics).
//!
//! API: CourtListener REST API v4 — https://www.courtlistener.com/api/rest/v4/
//! Auth: Token-based (Authorization: Token <key>)
//! Rate limit: 5,000 req/hr (we use 4,000 conservatively)

use anyhow::Result;
use chrono::Utc;
use chrono_tz::US::Eastern;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration
const ASSET_JSON: &str = include_str!("../../../config/courtlistener.json");

/// CourtListener API v4 base URL
const API_BASE: &str = "https://www.courtlistener.com/api/rest/v4";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Paginated response from CourtListener — we only need the `count` field.
#[derive(Debug, Deserialize)]
struct PaginatedResponse {
    count: u64,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// CourtListener Federal Courts market data source.
///
/// Tracks daily filing counts (opinions, docket entries, new cases) for
/// 34 federal courts. Source ID is `"courtlistener"`.
pub struct CourtListenerMarketSource {
    http: SourceHttpClient,
    api_token: String,
}

impl CourtListenerMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_token = std::env::var("COURTLISTENER_TOKEN")
            .map_err(|_| anyhow::anyhow!("COURTLISTENER_TOKEN env var not set"))?;

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 4000,
                duration: Duration::from_secs(3600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("CourtListener Federal Courts source initialized");

        Ok(Self { http, api_token })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for CourtListenerMarketSource {
    fn source_id(&self) -> &'static str {
        "courtlistener"
    }

    fn display_name(&self) -> &'static str {
        "CourtListener Federal Courts"
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
                max_requests: 4000,
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "CourtListener fetch_assets: {} assets loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Today's date in Eastern time (courts operate on ET)
        let today_et = now.with_timezone(&Eastern).format("%Y-%m-%d").to_string();

        // Build a lookup from asset_id -> (court_id, metric)
        let mut lookups: Vec<(&str, String, String)> = Vec::new();
        for asset_id in asset_ids {
            if let Some((court_id, metric)) = parse_asset_id(asset_id) {
                lookups.push((asset_id.as_str(), court_id, metric));
            } else {
                warn!("Could not parse asset_id: {}", asset_id);
            }
        }

        // Deduplicate API calls: (court_id, metric) -> count
        let mut cache: HashMap<(String, String), Decimal> = HashMap::new();

        for (_, court_id, metric) in &lookups {
            let key = (court_id.clone(), metric.clone());
            if cache.contains_key(&key) {
                continue;
            }

            let url = build_api_url(court_id, metric, &today_et);
            let auth_header = format!("Token {}", self.api_token);

            let count = match self
                .http
                .get_json_with_headers::<PaginatedResponse>(
                    &url,
                    &[("Authorization", &auth_header)],
                )
                .await
            {
                Ok(resp) => Decimal::from(resp.count),
                Err(e) => {
                    warn!(
                        "CourtListener API error for {}_{}: {:?}",
                        court_id, metric, e
                    );
                    Decimal::ZERO
                }
            };

            debug!(
                "CourtListener {}_{} = {} (date={})",
                court_id, metric, count, today_et
            );

            cache.insert(key, count);

            // 100ms delay between API calls to be respectful
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        // Build results
        let mut results = Vec::with_capacity(asset_ids.len());
        for (asset_id, court_id, metric) in &lookups {
            let key = (court_id.clone(), metric.clone());
            let value = cache.get(&key).copied().unwrap_or(Decimal::ZERO);

            results.push(PriceUpdate {
                asset_id: asset_id.to_string(),
                symbol: format!(
                    "{}/{}",
                    court_id.to_uppercase(),
                    metric_symbol(metric)
                ),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from CourtListener (date={})",
            results.len(),
            asset_ids.len(),
            today_et
        );

        Ok(results)
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Parse an asset_id like "court_ca9_opinions" into ("ca9", "opinions").
/// Returns None if the format is invalid.
fn parse_asset_id(asset_id: &str) -> Option<(String, String)> {
    let rest = asset_id.strip_prefix("court_")?;

    // The metric is the last segment: opinions, entries, or cases
    for suffix in &["_opinions", "_entries", "_cases"] {
        if let Some(court_id) = rest.strip_suffix(suffix) {
            let metric = &suffix[1..]; // strip leading underscore
            return Some((court_id.to_string(), metric.to_string()));
        }
    }

    None
}

/// Build the CourtListener API URL for a given court + metric + date.
fn build_api_url(court_id: &str, metric: &str, today: &str) -> String {
    match metric {
        "opinions" => {
            format!(
                "{}/clusters/?court={}&date_filed__gte={}&format=json",
                API_BASE, court_id, today
            )
        }
        "entries" => {
            format!(
                "{}/docket-entries/?docket__court={}&date_created__gte={}&format=json",
                API_BASE, court_id, today
            )
        }
        "cases" => {
            format!(
                "{}/dockets/?court={}&date_created__gte={}&format=json",
                API_BASE, court_id, today
            )
        }
        _ => {
            warn!("Unknown metric: {}", metric);
            format!("{}/clusters/?court={}&format=json", API_BASE, court_id)
        }
    }
}

/// Convert a metric name to a short symbol for the trading symbol.
fn metric_symbol(metric: &str) -> &str {
    match metric {
        "opinions" => "OPIN",
        "entries" => "ENTR",
        "cases" => "CASE",
        _ => "UNK",
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            102,
            "Expected exactly 102 courtlistener entries (34 courts × 3 metrics), got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(
            assets.len(),
            102,
            "Expected 102 active courtlistener assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Entry {} should be active", entry.asset_id);
        }
    }

    #[test]
    fn test_all_entries_government_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "government",
                "Entry {} should have government category",
                entry.asset_id
            );
            assert!(
                entry.subcategory == "federal_courts" || entry.subcategory == "district_courts",
                "Entry {} should have federal_courts or district_courts subcategory, got {}",
                entry.asset_id,
                entry.subcategory
            );
        }
    }

    #[test]
    fn test_asset_id_prefix_and_suffix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let valid_suffixes = ["_opinions", "_entries", "_cases"];
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("court_"),
                "Asset ID {} should start with 'court_'",
                entry.asset_id
            );
            assert!(
                valid_suffixes.iter().any(|s| entry.asset_id.ends_with(s)),
                "Asset ID {} should end with a valid metric suffix",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_34_courts_with_3_metrics_each() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut courts: HashMap<String, Vec<String>> = HashMap::new();

        for entry in &entries {
            if let Some((court_id, metric)) = parse_asset_id(&entry.asset_id) {
                courts.entry(court_id).or_default().push(metric);
            }
        }

        assert_eq!(
            courts.len(),
            34,
            "Expected 34 courts, got {}",
            courts.len()
        );

        for (court_id, metrics) in &courts {
            let mut sorted = metrics.clone();
            sorted.sort();
            assert_eq!(
                sorted,
                vec!["cases", "entries", "opinions"],
                "Court {} should have exactly 3 metrics (cases, entries, opinions), got {:?}",
                court_id,
                sorted
            );
        }
    }

    #[test]
    fn test_parse_asset_id() {
        assert_eq!(
            parse_asset_id("court_ca9_opinions"),
            Some(("ca9".to_string(), "opinions".to_string()))
        );
        assert_eq!(
            parse_asset_id("court_nysd_entries"),
            Some(("nysd".to_string(), "entries".to_string()))
        );
        assert_eq!(
            parse_asset_id("court_scotus_cases"),
            Some(("scotus".to_string(), "cases".to_string()))
        );
        assert_eq!(
            parse_asset_id("court_ca10_opinions"),
            Some(("ca10".to_string(), "opinions".to_string()))
        );
        assert_eq!(parse_asset_id("invalid_id"), None);
        assert_eq!(parse_asset_id("court_"), None);
    }

    #[test]
    fn test_build_api_url_opinions() {
        let url = build_api_url("ca9", "opinions", "2026-02-24");
        assert!(url.contains("/clusters/"));
        assert!(url.contains("court=ca9"));
        assert!(url.contains("date_filed__gte=2026-02-24"));
    }

    #[test]
    fn test_build_api_url_entries() {
        let url = build_api_url("nysd", "entries", "2026-02-24");
        assert!(url.contains("/docket-entries/"));
        assert!(url.contains("docket__court=nysd"));
        assert!(url.contains("date_created__gte=2026-02-24"));
    }

    #[test]
    fn test_build_api_url_cases() {
        let url = build_api_url("scotus", "cases", "2026-02-24");
        assert!(url.contains("/dockets/"));
        assert!(url.contains("court=scotus"));
        assert!(url.contains("date_created__gte=2026-02-24"));
    }

    #[test]
    fn test_metric_symbol() {
        assert_eq!(metric_symbol("opinions"), "OPIN");
        assert_eq!(metric_symbol("entries"), "ENTR");
        assert_eq!(metric_symbol("cases"), "CASE");
        assert_eq!(metric_symbol("unknown"), "UNK");
    }

    #[test]
    fn test_paginated_response_deserialize() {
        let json = r#"{"count": 42, "next": "http://example.com/?page=2", "previous": null, "results": []}"#;
        let resp: PaginatedResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.count, 42);
    }

    #[test]
    fn test_known_courts_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();

        // Appellate courts
        assert!(ids.contains(&"court_scotus_opinions"));
        assert!(ids.contains(&"court_ca9_entries"));
        assert!(ids.contains(&"court_cadc_cases"));
        assert!(ids.contains(&"court_cafc_opinions"));

        // District courts
        assert!(ids.contains(&"court_nysd_entries"));
        assert!(ids.contains(&"court_cacd_opinions"));
        assert!(ids.contains(&"court_ilnd_cases"));
        assert!(ids.contains(&"court_dcd_entries"));
    }
}
