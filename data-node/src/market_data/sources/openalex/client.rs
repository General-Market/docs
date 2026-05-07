//! OpenAlex scholarly works client implementing MarketDataSource
//!
//! Tracks daily new scholarly work counts from OpenAlex (openalex.org).
//! Each asset is a research field; value is number of new works published today.
//! ~50,000 new works indexed daily. Values climb throughout the day globally.
//!
//! Assets are static — defined in config/openalex.json (26 entries: 25 fields + total).
//!
//! API: OpenAlex REST API — https://docs.openalex.org/
//! Auth: None required (email for polite pool)
//! Rate limit: 10 req/s, 100k calls/day

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
    load_all_asset_entries, load_assets_from_json, AssetUpdate, BatchStrategy, MarketDataSource,
    PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/openalex.json");
const API_BASE: &str = "https://api.openalex.org";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct OpenAlexResponse {
    meta: OpenAlexMeta,
    group_by: Option<Vec<GroupByEntry>>,
}

#[derive(Debug, Deserialize)]
struct OpenAlexMeta {
    count: u64,
}

#[derive(Debug, Deserialize)]
struct GroupByEntry {
    key_display_name: String,
    count: u64,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct OpenAlexMarketSource {
    http: SourceHttpClient,
    mailto: String,
}

impl OpenAlexMarketSource {
    pub fn from_env() -> Result<Self> {
        let mailto = std::env::var("OPENALEX_EMAIL").unwrap_or_default();
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 500,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("OpenAlex scholarly works source initialized");
        Ok(Self { http, mailto })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for OpenAlexMarketSource {
    fn source_id(&self) -> &'static str { "openalex" }
    fn display_name(&self) -> &'static str { "OpenAlex Scholarly Works" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(600) }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 500,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("OpenAlex fetch_assets: {} assets loaded from config", assets.len());
        Ok(assets)
    }

    fn always_record_price(&self) -> bool {
        true // counter-style metric: write a row every tick so fetched_at advances even when value is identical (otherwise batch_engine excludes the source)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let today = now.format("%Y-%m-%d").to_string();

        // Build the asset config lookup: asset_id -> api_ref
        let entries = load_all_asset_entries(ASSET_JSON)?;
        let config_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        // One API call: group_by field to get counts per field
        // Note: from_created_date now requires API key; use from_publication_date instead.
        // Note: group_by=primary_topic.field.display_name was removed; use field.id
        //       (response still includes key_display_name for matching).
        let mailto_param = if self.mailto.is_empty() {
            String::new()
        } else {
            format!("&mailto={}", self.mailto)
        };
        let url = format!(
            "{}/works?filter=from_publication_date:{}&group_by=primary_topic.field.id&per_page=200{}",
            API_BASE, today, mailto_param
        );

        let response: OpenAlexResponse = match self.http.get_json(&url).await {
            Ok(r) => r,
            Err(e) => {
                warn!("OpenAlex API error: {:?}", e);
                return Ok(Vec::new());
            }
        };

        // Build lookup: normalized field display name -> count
        let mut field_counts: HashMap<String, u64> = HashMap::new();
        if let Some(groups) = &response.group_by {
            for g in groups {
                field_counts.insert(g.key_display_name.to_lowercase(), g.count);
            }
        }

        let total_count = response.meta.count;

        let mut results = Vec::with_capacity(asset_ids.len());
        for asset_id in asset_ids {
            let api_ref = config_map.get(asset_id.as_str()).cloned().unwrap_or_default();
            let value = if api_ref == "total" {
                Decimal::from(total_count)
            } else {
                // Match field name (case-insensitive)
                let count = field_counts.get(&api_ref.to_lowercase()).copied().unwrap_or(0);
                Decimal::from(count)
            };

            let symbol_suffix = asset_id.strip_prefix("openalex_").unwrap_or(asset_id);
            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("OALEX/{}", symbol_suffix.to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });

            debug!("OpenAlex {} = {} (ref={})", asset_id, value, api_ref);
        }

        info!("Fetched {}/{} prices from OpenAlex (total works today: {})", results.len(), asset_ids.len(), total_count);
        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENGAGEMENT
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
        assert_eq!(entries.len(), 26, "Expected 26 OpenAlex entries (25 fields + total), got {}", entries.len());
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 26);
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries { assert!(e.active, "{} should be active", e.asset_id); }
    }

    #[test]
    fn test_all_entries_education_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries {
            assert_eq!(e.category, "education", "{} should be education", e.asset_id);
            assert_eq!(e.subcategory, "scholarly_works", "{} bad subcategory", e.asset_id);
        }
    }

    #[test]
    fn test_asset_id_prefix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries {
            assert!(e.asset_id.starts_with("openalex_"), "{} should start with openalex_", e.asset_id);
        }
    }

    #[test]
    fn test_has_total() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().any(|e| e.api_ref == "total"), "Should have a total entry");
    }

    #[test]
    fn test_known_fields() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"openalex_cs"));
        assert!(ids.contains(&"openalex_medicine"));
        assert!(ids.contains(&"openalex_physics"));
        assert!(ids.contains(&"openalex_total"));
    }

    #[test]
    fn test_response_deserialize() {
        // Response from group_by=primary_topic.field.id (key is URL, key_display_name is field name)
        let json = r#"{"meta":{"count":50000,"db_response_time_ms":100,"page":1,"per_page":200,"groups_count":25},"results":[],"group_by":[{"key":"https://openalex.org/fields/17","key_display_name":"Computer Science","count":5234},{"key":"https://openalex.org/fields/27","key_display_name":"Medicine","count":12000}]}"#;
        let resp: OpenAlexResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.meta.count, 50000);
        let groups = resp.group_by.unwrap();
        assert_eq!(groups.len(), 2);
        // key_display_name still provides the human-readable field name for matching
        assert_eq!(groups[0].key_display_name, "Computer Science");
        assert_eq!(groups[0].count, 5234);
    }
}
