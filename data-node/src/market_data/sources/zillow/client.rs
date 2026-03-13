//! Zillow Real Estate data source
//!
//! Fetches housing market data from Zillow's free public CSV research files.
//! Data is published monthly at files.zillowstatic.com.
//!
//! Metrics tracked:
//! - ZHVI (Zillow Home Value Index): typical home value by metro
//! - ZORI (Zillow Observed Rent Index): typical rent by metro
//! - Inventory: for-sale housing inventory (national)
//! - Days on Market: mean days to pending sale (national)
//! - Price Cuts: % of listings with a price cut (national)
//!
//! No API key required — all CSVs are publicly accessible.

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration loaded from JSON at compile time
const ASSET_JSON: &str = include_str!("../../../config/zillow.json");

/// Zillow Research public CSV base URL
const CSV_BASE: &str = "https://files.zillowstatic.com/research/public_csvs";

/// CSV URLs for each metric type
const ZHVI_CSV: &str = "zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv";
const ZORI_CSV: &str = "zori/Metro_zori_uc_sfrcondomfr_sm_month.csv";
const INVENTORY_CSV: &str = "invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv";
const DOM_CSV: &str = "mean_doz_pending/Metro_mean_doz_pending_uc_sfrcondo_sm_month.csv";
const PRICE_CUTS_CSV: &str =
    "perc_listings_price_cut/Metro_perc_listings_price_cut_uc_sfrcondo_sm_month.csv";

/// Delay between CSV downloads (ms)
const INTER_REQUEST_DELAY_MS: u64 = 2000;

/// Map from api_ref region prefix to Zillow RegionName in CSV
fn region_name_for(region: &str) -> Option<&'static str> {
    match region {
        "national" => Some("United States"),
        "nyc" => Some("New York, NY"),
        "la" => Some("Los Angeles, CA"),
        "sf" => Some("San Francisco, CA"),
        "miami" => Some("Miami, FL"),
        "austin" => Some("Austin, TX"),
        _ => None,
    }
}

/// Map from api_ref metric suffix to CSV path
fn csv_path_for(metric: &str) -> Option<&'static str> {
    match metric {
        "zhvi" => Some(ZHVI_CSV),
        "zori" => Some(ZORI_CSV),
        "inventory" => Some(INVENTORY_CSV),
        "dom" => Some(DOM_CSV),
        "price_cuts" => Some(PRICE_CUTS_CSV),
        _ => None,
    }
}

/// Parse api_ref like "national:zhvi" into (region, metric)
fn parse_api_ref(api_ref: &str) -> Option<(&str, &str)> {
    api_ref.split_once(':')
}

/// Zillow market data source
pub struct ZillowMarketSource {
    http: SourceHttpClient,
}

impl ZillowMarketSource {
    /// Create the Zillow client (no API key required)
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Zillow source initialized (public CSV data)");

        Ok(Self { http })
    }

}

/// Extract a specific field from a CSV line (handling quoted fields with commas)
fn extract_csv_field(line: &str, target_index: usize) -> Option<&str> {
    let fields = split_csv_line(line);
    fields.get(target_index).copied()
}

/// Extract the last non-empty numeric value from a CSV data line.
/// Columns 0-4 are metadata (RegionID, SizeRank, RegionName, RegionType, StateName).
/// Columns 5+ are date values.
fn extract_last_value(header: &str, line: &str) -> Option<Decimal> {
    // Split both header and data, working backwards from the end
    let data_fields: Vec<&str> = split_csv_line(line);

    // Work backwards to find the last non-empty numeric value
    for i in (5..data_fields.len()).rev() {
        let val = data_fields[i].trim();
        if !val.is_empty() {
            if let Ok(d) = Decimal::from_str(val) {
                return Some(d);
            }
        }
    }

    None
}

/// Split a CSV line into fields, handling quoted fields
fn split_csv_line(line: &str) -> Vec<&str> {
    let mut fields = Vec::new();
    let mut i = 0;
    let bytes = line.as_bytes();
    let len = bytes.len();
    let mut after_comma = false;

    while i < len {
        after_comma = false;
        if bytes[i] == b'"' {
            i += 1; // skip opening quote
            let start = i;
            while i < len && bytes[i] != b'"' {
                i += 1;
            }
            fields.push(&line[start..i]);
            if i < len {
                i += 1; // skip closing quote
            }
            if i < len && bytes[i] == b',' {
                i += 1; // skip comma
                after_comma = true;
            }
        } else {
            let start = i;
            while i < len && bytes[i] != b',' {
                i += 1;
            }
            fields.push(&line[start..i]);
            if i < len {
                i += 1; // skip comma
                after_comma = true;
            }
        }
    }

    // Handle trailing comma (empty last field)
    if after_comma {
        fields.push("");
    }

    fields
}

#[async_trait::async_trait]
impl MarketDataSource for ZillowMarketSource {
    fn source_id(&self) -> &'static str {
        "zillow"
    }

    fn display_name(&self) -> &'static str {
        "Zillow Real Estate"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        // Monthly data — check daily
        Duration::from_secs(24 * 3600)
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(60),
            }],
        }
    }

    fn always_record_price(&self) -> bool {
        // Zillow CSV data is monthly — values don't change between monthly updates.
        // Without this, the sync engine's change detection skips writing a price when
        // the value matches the in-memory cache, leaving assets stuck at 1 row.
        // Same pattern as BLS and SEC EDGAR.
        true
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let all_entries = load_all_asset_entries(ASSET_JSON)?;
        let entry_map: HashMap<&str, &str> = all_entries
            .iter()
            .map(|e| (e.asset_id.as_str(), e.api_ref.as_str()))
            .collect();

        // Group assets by CSV to minimize downloads.
        // Key: csv_path, Value: Vec<(asset_id, symbol, region_name)>
        let mut csv_groups: HashMap<&str, Vec<(&str, &str, &str)>> = HashMap::new();

        for asset_id in asset_ids {
            let api_ref = match entry_map.get(asset_id.as_str()) {
                Some(r) => *r,
                None => {
                    warn!("Zillow: unknown asset_id '{}', skipping", asset_id);
                    continue;
                }
            };

            let (region, metric) = match parse_api_ref(api_ref) {
                Some(r) => r,
                None => {
                    warn!(
                        "Zillow: invalid api_ref '{}' for {}, skipping",
                        api_ref, asset_id
                    );
                    continue;
                }
            };

            let csv_path = match csv_path_for(metric) {
                Some(p) => p,
                None => {
                    warn!("Zillow: unknown metric '{}' for {}, skipping", metric, asset_id);
                    continue;
                }
            };

            let region_name = match region_name_for(region) {
                Some(n) => n,
                None => {
                    warn!(
                        "Zillow: unknown region '{}' for {}, skipping",
                        region, asset_id
                    );
                    continue;
                }
            };

            // Find symbol for this asset
            let symbol = all_entries
                .iter()
                .find(|e| e.asset_id == asset_id.as_str())
                .map(|e| e.symbol.as_str())
                .unwrap_or("UNKNOWN");

            csv_groups
                .entry(csv_path)
                .or_default()
                .push((asset_id.as_str(), symbol, region_name));
        }

        let mut results = Vec::new();
        let mut first = true;

        for (csv_path, assets) in &csv_groups {
            if !first {
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }
            first = false;

            // Download the CSV once
            let url = format!("{}/{}", CSV_BASE, csv_path);
            let body = match self.http.get_raw(&url).await {
                Ok(b) => b,
                Err(e) => {
                    warn!("Zillow: failed to download {}: {:?}", csv_path, e);
                    continue;
                }
            };

            // Parse all needed regions from this CSV
            let mut lines = body.lines();
            let header = match lines.next() {
                Some(h) => h,
                None => {
                    warn!("Zillow: empty CSV {}", csv_path);
                    continue;
                }
            };

            // Build a region -> latest value map
            let needed_regions: std::collections::HashSet<&str> =
                assets.iter().map(|(_, _, region)| *region).collect();
            let mut region_values: HashMap<&str, Decimal> = HashMap::new();

            for line in lines {
                let region_col = extract_csv_field(line, 2);
                if let Some(name) = region_col {
                    if needed_regions.contains(name) {
                        if let Some(val) = extract_last_value(header, line) {
                            region_values.insert(
                                needed_regions.iter().find(|&&r| r == name).unwrap(),
                                val,
                            );
                        }
                    }
                }
            }

            // Build PriceUpdate for each asset
            for (asset_id, symbol, region_name) in assets {
                if let Some(value) = region_values.get(region_name) {
                    results.push(PriceUpdate {
                        asset_id: asset_id.to_string(),
                        symbol: symbol.to_string(),
                        value: *value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                } else {
                    debug!(
                        "Zillow: no data found for {} (region={}) in {}",
                        asset_id, region_name, csv_path
                    );
                }
            }
        }

        info!(
            "Zillow: fetched {}/{} prices from public CSVs",
            results.len(),
            asset_ids.len()
        );
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metric_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 10);
    }

    #[test]
    fn test_categories() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().all(|e| e.category == "macro"));
        assert!(entries.iter().all(|e| e.subcategory == "housing"));
    }

    #[test]
    fn test_api_ref_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let (region, metric) = parse_api_ref(&entry.api_ref).unwrap_or_else(|| {
                panic!("Invalid api_ref '{}' for {}", entry.api_ref, entry.asset_id)
            });
            assert!(
                region_name_for(region).is_some(),
                "Unknown region '{}' in api_ref for {}",
                region,
                entry.asset_id
            );
            assert!(
                csv_path_for(metric).is_some(),
                "Unknown metric '{}' in api_ref for {}",
                metric,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_extract_csv_field_simple() {
        let line = "102001,0,United States,country,";
        assert_eq!(extract_csv_field(line, 0), Some("102001"));
        assert_eq!(extract_csv_field(line, 1), Some("0"));
        assert_eq!(extract_csv_field(line, 2), Some("United States"));
        assert_eq!(extract_csv_field(line, 3), Some("country"));
        assert_eq!(extract_csv_field(line, 4), Some(""));
    }

    #[test]
    fn test_extract_csv_field_quoted() {
        let line = r#"394913,1,"New York, NY",msa,NY"#;
        assert_eq!(extract_csv_field(line, 0), Some("394913"));
        assert_eq!(extract_csv_field(line, 1), Some("1"));
        assert_eq!(extract_csv_field(line, 2), Some("New York, NY"));
        assert_eq!(extract_csv_field(line, 3), Some("msa"));
        assert_eq!(extract_csv_field(line, 4), Some("NY"));
    }

    #[test]
    fn test_extract_last_value() {
        let header = "RegionID,SizeRank,RegionName,RegionType,StateName,2024-01-31,2024-02-29,2024-03-31";
        let line = "102001,0,United States,country,,350000.5,351000.0,352000.75";
        let val = extract_last_value(header, line).unwrap();
        assert_eq!(val, Decimal::from_str("352000.75").unwrap());
    }

    #[test]
    fn test_extract_last_value_trailing_empty() {
        let header = "RegionID,SizeRank,RegionName,RegionType,StateName,2024-01-31,2024-02-29,2024-03-31";
        let line = "102001,0,United States,country,,350000.5,351000.0,";
        let val = extract_last_value(header, line).unwrap();
        assert_eq!(val, Decimal::from_str("351000.0").unwrap());
    }

    #[test]
    fn test_region_name_mapping() {
        assert_eq!(region_name_for("national"), Some("United States"));
        assert_eq!(region_name_for("nyc"), Some("New York, NY"));
        assert_eq!(region_name_for("la"), Some("Los Angeles, CA"));
        assert_eq!(region_name_for("sf"), Some("San Francisco, CA"));
        assert_eq!(region_name_for("miami"), Some("Miami, FL"));
        assert_eq!(region_name_for("austin"), Some("Austin, TX"));
        assert_eq!(region_name_for("unknown"), None);
    }

    #[test]
    fn test_csv_path_mapping() {
        assert!(csv_path_for("zhvi").is_some());
        assert!(csv_path_for("zori").is_some());
        assert!(csv_path_for("inventory").is_some());
        assert!(csv_path_for("dom").is_some());
        assert!(csv_path_for("price_cuts").is_some());
        assert!(csv_path_for("unknown").is_none());
    }

    #[test]
    fn test_parse_api_ref() {
        assert_eq!(parse_api_ref("national:zhvi"), Some(("national", "zhvi")));
        assert_eq!(parse_api_ref("nyc:zhvi"), Some(("nyc", "zhvi")));
        assert_eq!(parse_api_ref("national:inventory"), Some(("national", "inventory")));
        assert_eq!(parse_api_ref("invalid"), None);
    }

    #[test]
    fn test_split_csv_line_quoted() {
        let line = r#"394913,1,"New York, NY",msa,NY,100.5,200.0"#;
        let fields = split_csv_line(line);
        assert_eq!(fields.len(), 7);
        assert_eq!(fields[0], "394913");
        assert_eq!(fields[1], "1");
        assert_eq!(fields[2], "New York, NY");
        assert_eq!(fields[3], "msa");
        assert_eq!(fields[4], "NY");
        assert_eq!(fields[5], "100.5");
        assert_eq!(fields[6], "200.0");
    }
}
