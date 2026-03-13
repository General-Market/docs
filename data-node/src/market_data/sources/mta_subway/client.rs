//! NYC MTA Subway alerts source implementing MarketDataSource
//!
//! Tracks subway line disruption severity using the goodservice.io (subwaynow)
//! real-time status API. Each subway line is an asset; its value represents
//! disruption severity (0 = good service, higher = more disrupted).
//!
//! Assets are static -- defined in config/mta_subway.json.
//!
//! API: https://api.subwaynow.app/routes (public, no auth)
//! Rate limit: Conservative 60 req/5min
//!
//! Status mapping:
//!   0 = Good Service
//!   1 = Service Change (planned work, not delays)
//!   2 = Slow (minor delays)
//!   3 = Delay (significant delays)
//!   4 = Not Good (major disruption)
//!   -1 = Not Scheduled (line not running at this time)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/mta_subway.json");

/// SubwayNow (goodservice.io) API endpoint -- returns all route statuses in one call
const API_URL: &str = "https://api.subwaynow.app/routes";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Top-level response from the SubwayNow routes API.
/// Routes are keyed by route ID (e.g. "1", "A", "GS", "SI").
#[derive(Debug, Deserialize)]
struct SubwayNowResponse {
    routes: HashMap<String, RouteStatus>,
    #[allow(dead_code)]
    timestamp: Option<i64>,
}

/// Status for a single subway route.
#[derive(Debug, Deserialize)]
struct RouteStatus {
    #[allow(dead_code)]
    id: Option<String>,
    #[allow(dead_code)]
    name: Option<String>,
    status: Option<String>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct MtaSubwayMarketSource {
    http: SourceHttpClient,
}

impl MtaSubwayMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("MTA Subway alerts source initialized (SubwayNow API)");
        Ok(Self { http })
    }

    /// Map a status string from the API to a numeric disruption severity.
    ///
    /// Returns:
    ///   0 = Good Service
    ///   1 = Service Change (planned work)
    ///   2 = Slow (minor delays)
    ///   3 = Delay (significant delays)
    ///   4 = Not Good (major disruption)
    ///  -1 = Not Scheduled
    fn status_to_severity(status: &str) -> Decimal {
        match status {
            "Good Service" => Decimal::ZERO,
            "Service Change" => Decimal::ONE,
            "Slow" => Decimal::from(2),
            "Delay" => Decimal::from(3),
            "Not Good" => Decimal::from(4),
            "Not Scheduled" => Decimal::NEGATIVE_ONE,
            other => {
                warn!("MTA: unknown status '{}', defaulting to severity 0", other);
                Decimal::ZERO
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for MtaSubwayMarketSource {
    fn source_id(&self) -> &'static str {
        "mta_subway"
    }

    fn display_name(&self) -> &'static str {
        "NYC MTA Subway Alerts"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300) // 5 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 60,
                duration: Duration::from_secs(300),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "MTA Subway fetch_assets: {} lines loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get line references from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        // ONE call to get all route statuses
        let response: SubwayNowResponse = match self.http.get_json(API_URL).await {
            Ok(data) => data,
            Err(e) => {
                warn!("MTA: failed to fetch SubwayNow status: {:?}", e);
                return Ok(Vec::new());
            }
        };

        debug!(
            "MTA: received status for {} routes (timestamp: {:?})",
            response.routes.len(),
            response.timestamp
        );

        let mut results = Vec::with_capacity(asset_ids.len());
        let mut disrupted_count = 0u32;

        for asset_id in asset_ids {
            let (line_ref, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (line ID) for asset {}", asset_id);
                    continue;
                }
            };

            // Look up status by api_ref (e.g. "1", "A", "GS", "SI")
            let value = match response.routes.get(line_ref) {
                Some(route) => {
                    let status_str = route.status.as_deref().unwrap_or("Good Service");
                    let severity = Self::status_to_severity(status_str);
                    debug!(
                        "MTA {} ({}): status='{}' severity={}",
                        line_ref, symbol, status_str, severity
                    );
                    if severity > Decimal::ZERO {
                        disrupted_count += 1;
                    }
                    severity
                }
                None => {
                    debug!(
                        "MTA: no status data for line {} ({}), defaulting to 0",
                        line_ref, symbol
                    );
                    Decimal::ZERO
                }
            };

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
        }

        info!(
            "Fetched {}/{} prices from MTA Subway (1 API call, {} lines disrupted)",
            results.len(),
            asset_ids.len(),
            disrupted_count
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
        assert!(
            entries.len() >= 20,
            "Expected >= 20 subway line entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 20,
            "Expected >= 20 active subway assets, got {}",
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
    fn test_all_entries_transport_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "transport",
                "Entry {} should have transport category",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "subway",
                "Entry {} should have subway subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("mta_subway_"),
                "Asset ID {} should start with 'mta_subway_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_mta() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("MTA/"),
                "Symbol '{}' should start with 'MTA/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), entries.len(), "All asset IDs should be unique");
    }

    #[test]
    fn test_unique_symbols() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut symbols: Vec<&str> = entries.iter().map(|e| e.symbol.as_str()).collect();
        symbols.sort();
        symbols.dedup();
        assert_eq!(
            symbols.len(),
            entries.len(),
            "All symbols should be unique"
        );
    }

    #[test]
    fn test_unique_api_refs() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        refs.dedup();
        assert_eq!(
            refs.len(),
            entries.len(),
            "All api_refs should be unique"
        );
    }

    #[test]
    fn test_known_lines_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let api_refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(api_refs.contains(&"1"), "Line 1 should be present");
        assert!(api_refs.contains(&"A"), "Line A should be present");
        assert!(api_refs.contains(&"7"), "Line 7 should be present");
        assert!(api_refs.contains(&"L"), "Line L should be present");
        assert!(api_refs.contains(&"GS"), "S shuttle (GS) should be present");
        assert!(api_refs.contains(&"SI"), "Staten Island Railway (SI) should be present");
    }

    #[test]
    fn test_entry_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            24,
            "Expected exactly 24 subway entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_status_to_severity_good_service() {
        assert_eq!(
            MtaSubwayMarketSource::status_to_severity("Good Service"),
            Decimal::ZERO
        );
    }

    #[test]
    fn test_status_to_severity_service_change() {
        assert_eq!(
            MtaSubwayMarketSource::status_to_severity("Service Change"),
            Decimal::ONE
        );
    }

    #[test]
    fn test_status_to_severity_slow() {
        assert_eq!(
            MtaSubwayMarketSource::status_to_severity("Slow"),
            Decimal::from(2)
        );
    }

    #[test]
    fn test_status_to_severity_delay() {
        assert_eq!(
            MtaSubwayMarketSource::status_to_severity("Delay"),
            Decimal::from(3)
        );
    }

    #[test]
    fn test_status_to_severity_not_good() {
        assert_eq!(
            MtaSubwayMarketSource::status_to_severity("Not Good"),
            Decimal::from(4)
        );
    }

    #[test]
    fn test_status_to_severity_not_scheduled() {
        assert_eq!(
            MtaSubwayMarketSource::status_to_severity("Not Scheduled"),
            Decimal::NEGATIVE_ONE
        );
    }

    #[test]
    fn test_status_to_severity_unknown_defaults_zero() {
        assert_eq!(
            MtaSubwayMarketSource::status_to_severity("Something Else"),
            Decimal::ZERO
        );
    }

    #[test]
    fn test_severity_ordering() {
        // Verify the severity scale is ordered correctly
        let good = MtaSubwayMarketSource::status_to_severity("Good Service");
        let change = MtaSubwayMarketSource::status_to_severity("Service Change");
        let slow = MtaSubwayMarketSource::status_to_severity("Slow");
        let delay = MtaSubwayMarketSource::status_to_severity("Delay");
        let not_good = MtaSubwayMarketSource::status_to_severity("Not Good");

        assert!(good < change);
        assert!(change < slow);
        assert!(slow < delay);
        assert!(delay < not_good);
    }

    #[test]
    fn test_deserialize_api_response() {
        let json = r#"{
            "routes": {
                "1": {"id": "1", "name": "1", "status": "Good Service", "color": "D82233", "text_color": "FFFFFF"},
                "A": {"id": "A", "name": "A", "status": "Delay", "color": "0039A6", "text_color": "FFFFFF"},
                "GS": {"id": "GS", "name": "S", "status": "Not Scheduled", "color": "808183", "text_color": "FFFFFF"}
            },
            "timestamp": 1773443660,
            "blog_post": {"link": "https://example.com", "title": "Test"}
        }"#;

        let response: SubwayNowResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.routes.len(), 3);
        assert_eq!(
            response.routes["1"].status.as_deref(),
            Some("Good Service")
        );
        assert_eq!(response.routes["A"].status.as_deref(), Some("Delay"));
        assert_eq!(
            response.routes["GS"].status.as_deref(),
            Some("Not Scheduled")
        );
        assert_eq!(response.timestamp, Some(1773443660));
    }
}
