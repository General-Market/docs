//! Crossref DOI registry client implementing MarketDataSource
//!
//! Tracks daily new DOI registrations from Crossref (crossref.org).
//! Each asset is a document type; value is count of new DOIs registered today.
//! Thousands of new DOIs registered daily. Values climb throughout the day.
//!
//! Assets are static — defined in config/crossref.json (12 entries: 11 types + total).
//!
//! API: Crossref REST API — https://api.crossref.org/
//! Auth: None (mailto for polite pool)
//! Rate limit: ~50 req/s polite pool

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
    load_all_asset_entries, load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/crossref.json");
const API_BASE: &str = "https://api.crossref.org";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct CrossrefResponse {
    message: CrossrefMessage,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
struct CrossrefMessage {
    total_results: u64,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct CrossrefMarketSource {
    http: SourceHttpClient,
    mailto: String,
}

impl CrossrefMarketSource {
    pub fn from_env() -> Result<Self> {
        let mailto = std::env::var("CROSSREF_EMAIL").unwrap_or_default();
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2000,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Crossref DOI registry source initialized");
        Ok(Self { http, mailto })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for CrossrefMarketSource {
    fn source_id(&self) -> &'static str { "crossref" }
    fn display_name(&self) -> &'static str { "Crossref DOI Registry" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(600) }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2000,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("Crossref fetch_assets: {} assets loaded from config", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let today = now.format("%Y-%m-%d").to_string();

        // Build config lookup
        let entries = load_all_asset_entries(ASSET_JSON)?;
        let config_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        let mailto_param = if self.mailto.is_empty() {
            String::new()
        } else {
            format!("&mailto={}", self.mailto)
        };

        // Deduplicate API calls
        let mut cache: HashMap<String, u64> = HashMap::new();
        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let api_ref = config_map.get(asset_id.as_str()).cloned().unwrap_or_default();

            if !cache.contains_key(&api_ref) {
                let url = if api_ref == "total" {
                    format!(
                        "{}/works?filter=from-created-date:{}&rows=0{}",
                        API_BASE, today, mailto_param
                    )
                } else {
                    format!(
                        "{}/works?filter=from-created-date:{},type:{}&rows=0{}",
                        API_BASE, today, api_ref, mailto_param
                    )
                };

                let count = match self.http.get_json::<CrossrefResponse>(&url).await {
                    Ok(resp) => resp.message.total_results,
                    Err(e) => {
                        warn!("Crossref API error for {}: {:?}", api_ref, e);
                        0
                    }
                };

                debug!("Crossref {} = {} (date={})", api_ref, count, today);
                cache.insert(api_ref.clone(), count);

                // 200ms delay between calls to be respectful
                tokio::time::sleep(Duration::from_millis(200)).await;
            }

            let value = Decimal::from(cache.get(&api_ref).copied().unwrap_or(0));
            let suffix = asset_id.strip_prefix("crossref_").unwrap_or(asset_id);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("CREF/{}", suffix.to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!("Fetched {}/{} prices from Crossref (date={})", results.len(), asset_ids.len(), today);
        Ok(results)
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
        assert_eq!(entries.len(), 12, "Expected 12 Crossref entries, got {}", entries.len());
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 12);
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
            assert_eq!(e.category, "education", "{} bad category", e.asset_id);
            assert_eq!(e.subcategory, "doi_registry");
        }
    }

    #[test]
    fn test_asset_id_prefix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries {
            assert!(e.asset_id.starts_with("crossref_"), "{} bad prefix", e.asset_id);
        }
    }

    #[test]
    fn test_has_total() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().any(|e| e.api_ref == "total"));
    }

    #[test]
    fn test_response_deserialize() {
        let json = r#"{"status":"ok","message-type":"work-list","message":{"total-results":12345,"items":[],"items-per-page":0,"query":{"start-index":0,"search-terms":null}}}"#;
        let resp: CrossrefResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.message.total_results, 12345);
    }
}
