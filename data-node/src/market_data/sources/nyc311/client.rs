//! NYC 311 Complaints data source implementing MarketDataSource
//!
//! Tracks complaint counts by complaint type from the NYC 311 service.
//! Data comes from the Socrata Open Data API (SODA) endpoint for NYC 311
//! service requests. Each asset represents a complaint type (e.g. "Noise -
//! Residential", "Rodent", "Illegal Parking"); its value is the number of
//! complaints filed in the last 48 hours (NYC 311 data has ~24-36h publishing delay).
//!
//! Assets are static -- defined in config/nyc311.json (30 complaint types).
//!
//! Strategy: Single API call fetches grouped counts for all complaint types
//! in the last 24 hours, then matched to config assets by `api_ref`.
//!
//! API: https://data.cityofnewyork.us/resource/erm2-nwe9.json
//! Auth: None (public Socrata dataset, 1000 req/hr throttle)
//! Rate limit: 20 req/600s (conservative)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/nyc311.json");

/// NYC 311 SODA endpoint
const API_BASE: &str = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";

/// Response row from the grouped complaint count query
#[derive(Debug, Deserialize)]
struct ComplaintCountRow {
    complaint_type: String,
    count: String,
}

/// NYC 311 Complaints data source.
///
/// Tracks 24-hour rolling complaint counts for 30 complaint categories.
/// Source ID is `"nyc311"`.
pub struct Nyc311MarketSource {
    http: SourceHttpClient,
}

impl Nyc311MarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("NYC 311 Complaints source initialized (Socrata SODA API)");
        Ok(Self { http })
    }

    /// Build the SODA query URL for grouped complaint counts in the last 48h.
    /// NYC 311 data has a ~24-36h publishing delay, so 48h window ensures
    /// we always capture the latest published data.
    fn build_query_url() -> String {
        let yesterday = Utc::now() - chrono::Duration::hours(48);
        let since = yesterday.format("%Y-%m-%dT%H:%M:%S").to_string();

        // URL-encode the query parameters
        // $select=complaint_type,count(*)
        // $group=complaint_type
        // $order=count(*) DESC
        // $limit=50
        // $where=created_date>'YYYY-MM-DDTHH:MM:SS'
        format!(
            "{}?$select=complaint_type,count(*)&$group=complaint_type&$order=count(*)%20DESC&$limit=50&$where=created_date>'{}'",
            API_BASE, since
        )
    }
}

#[async_trait::async_trait]
impl MarketDataSource for Nyc311MarketSource {
    fn source_id(&self) -> &'static str {
        "nyc311"
    }

    fn display_name(&self) -> &'static str {
        "NYC 311 Complaints"
    }

    fn default_resolution(&self) -> &'static str {
        "latest"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(600) // 10 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "NYC 311 fetch_assets: {} complaint types loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to build api_ref → (asset_id, symbol) lookup
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.api_ref.clone(), (e.asset_id.clone(), e.symbol.clone())))
            .collect();

        // Build set of requested asset IDs for filtering
        let requested: std::collections::HashSet<&str> =
            asset_ids.iter().map(|s| s.as_str()).collect();

        // Fetch grouped complaint counts from SODA API
        let url = Self::build_query_url();
        let rows: Vec<ComplaintCountRow> = match self.http.get_json(&url).await {
            Ok(data) => data,
            Err(e) => {
                warn!("NYC 311: complaint count query failed: {:?}", e);
                return Ok(Vec::new());
            }
        };

        let mut results = Vec::new();

        for row in &rows {
            // Look up this complaint_type in our config
            if let Some((asset_id, symbol)) = ref_map.get(&row.complaint_type) {
                // Only include if this asset was requested
                if !requested.contains(asset_id.as_str()) {
                    continue;
                }

                let count_val = match u64::from_str(&row.count) {
                    Ok(v) => v,
                    Err(_) => {
                        warn!(
                            "NYC 311: invalid count '{}' for '{}'",
                            row.count, row.complaint_type
                        );
                        continue;
                    }
                };

                let value =
                    Decimal::from_str(&count_val.to_string()).unwrap_or(Decimal::ZERO);

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
        }

        info!(
            "Fetched {}/{} prices from NYC 311 (1 API call, {} complaint types returned)",
            results.len(),
            asset_ids.len(),
            rows.len()
        );
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 30, "Expected 30 complaint type entries");
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 30, "Expected 30 active complaint type assets");
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
            assert_eq!(
                entry.subcategory, "complaints",
                "{} should be complaints subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("nyc311_"),
                "Asset ID {} should start with 'nyc311_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_311() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("311/"),
                "Symbol '{}' should start with '311/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        ids.sort();
        let orig_len = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), orig_len, "All asset IDs should be unique");
    }

    #[test]
    fn test_unique_symbols() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut symbols: Vec<&str> = entries.iter().map(|e| e.symbol.as_str()).collect();
        symbols.sort();
        let orig_len = symbols.len();
        symbols.dedup();
        assert_eq!(symbols.len(), orig_len, "All symbols should be unique");
    }

    #[test]
    fn test_unique_api_refs() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        let orig_len = refs.len();
        refs.dedup();
        assert_eq!(refs.len(), orig_len, "All api_refs should be unique");
    }

    #[test]
    fn test_known_complaint_types_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(refs.contains(&"Noise - Residential"), "Noise - Residential should be present");
        assert!(refs.contains(&"Rodent"), "Rodent should be present");
        assert!(refs.contains(&"Illegal Parking"), "Illegal Parking should be present");
        assert!(refs.contains(&"HEAT/HOT WATER"), "HEAT/HOT WATER should be present");
    }

    #[test]
    fn test_complaint_count_parsing() {
        let json = r#"[{"complaint_type": "Noise - Residential", "count": "1234"}]"#;
        let rows: Vec<ComplaintCountRow> = serde_json::from_str(json).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].complaint_type, "Noise - Residential");
        assert_eq!(rows[0].count.parse::<u64>().unwrap(), 1234);
    }

    #[test]
    fn test_query_url_format() {
        let url = Nyc311MarketSource::build_query_url();
        assert!(url.starts_with(API_BASE), "URL should start with API_BASE");
        assert!(url.contains("complaint_type"), "URL should select complaint_type");
        assert!(url.contains("count(*)"), "URL should select count(*)");
        assert!(url.contains("$group=complaint_type"), "URL should group by complaint_type");
        assert!(url.contains("$limit=50"), "URL should limit to 50");
        assert!(url.contains("created_date>"), "URL should filter by created_date");
    }
}
