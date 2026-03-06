//! Stack Exchange API client implementing MarketDataSource
//!
//! Tracks daily new question counts on StackOverflow by tag.
//! Each asset is a popular tag (or total); value is number of questions asked today.
//! ~8,000 new questions per day across all tags.
//!
//! Assets are static — defined in config/stackexchange.json (30 entries: 29 tags + total).
//!
//! API: Stack Exchange REST API v2.3 — https://api.stackexchange.com/docs
//! Auth: API key via `key` query parameter (required — 300 req/day without key is insufficient)
//! Rate limit: 10,000 req/day with key → budget 200/hour window

use anyhow::{bail, Result};
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

const ASSET_JSON: &str = include_str!("../../../config/stackexchange.json");
const API_BASE: &str = "https://api.stackexchange.com/2.3";
const INTER_REQUEST_DELAY_MS: u64 = 350;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct StackExchangeResponse {
    total: u64,
    #[serde(default)]
    quota_remaining: Option<u64>,
    #[serde(default)]
    backoff: Option<u64>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct StackExchangeMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl StackExchangeMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = match std::env::var("STACKEXCHANGE_KEY") {
            Ok(k) if !k.is_empty() => k,
            _ => bail!("STACKEXCHANGE_KEY env var is required (300 req/day without key is insufficient for 30 feeds)"),
        };
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 200,
                duration: Duration::from_secs(3600),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Stack Exchange source initialized");
        Ok(Self { http, api_key })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for StackExchangeMarketSource {
    fn source_id(&self) -> &'static str { "stackexchange" }
    fn display_name(&self) -> &'static str { "Stack Exchange Developer Q&A" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(600) }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 200,
                duration: Duration::from_secs(3600),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("StackExchange fetch_assets: {} assets loaded from config", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        // Start of today UTC as unix timestamp
        let today_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap();
        let fromdate = today_start.and_utc().timestamp();

        // Build config lookup: asset_id -> api_ref
        let entries = load_all_asset_entries(ASSET_JSON)?;
        let config_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        // Deduplicate API calls (multiple asset_ids could map to same api_ref)
        let mut cache: HashMap<String, u64> = HashMap::new();
        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let api_ref = config_map.get(asset_id.as_str()).cloned().unwrap_or_default();

            if !cache.contains_key(&api_ref) {
                let url = if api_ref == "total" {
                    format!(
                        "{}/questions?site=stackoverflow&fromdate={}&pagesize=1&key={}&filter=total",
                        API_BASE, fromdate, self.api_key
                    )
                } else {
                    format!(
                        "{}/questions?tagged={}&site=stackoverflow&fromdate={}&pagesize=1&key={}&filter=total",
                        API_BASE, api_ref, fromdate, self.api_key
                    )
                };

                match self.http.get_json::<StackExchangeResponse>(&url).await {
                    Ok(resp) => {
                        if let Some(remaining) = resp.quota_remaining {
                            debug!("StackExchange quota remaining: {}", remaining);
                        }
                        if let Some(backoff) = resp.backoff {
                            warn!("StackExchange backoff requested: {}s", backoff);
                            tokio::time::sleep(Duration::from_secs(backoff)).await;
                        }
                        debug!("StackExchange {} = {} (fromdate={})", api_ref, resp.total, fromdate);
                        cache.insert(api_ref.clone(), resp.total);
                    }
                    Err(e) => {
                        warn!("StackExchange API error for {}: {:?} — skipping", api_ref, e);
                        // Don't insert 0 into cache on API error
                    }
                };

                // 350ms delay between calls
                tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
            }

            let count = match cache.get(&api_ref).copied() {
                Some(c) => c,
                None => continue, // API error — don't submit false 0
            };
            let value = Decimal::from(count);
            let suffix = asset_id.strip_prefix("stackexchange_").unwrap_or(asset_id);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("SE/{}", suffix.to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!("Fetched {}/{} prices from StackExchange (fromdate={})", results.len(), asset_ids.len(), fromdate);
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
        assert_eq!(entries.len(), 30, "Expected 30 StackExchange entries (29 tags + total), got {}", entries.len());
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 30);
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
            assert_eq!(e.subcategory, "developer_community", "{} bad subcategory", e.asset_id);
        }
    }

    #[test]
    fn test_asset_id_prefix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries {
            assert!(e.asset_id.starts_with("stackexchange_"), "{} should start with stackexchange_", e.asset_id);
        }
    }

    #[test]
    fn test_has_total() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().any(|e| e.api_ref == "total"), "Should have a total entry");
    }

    #[test]
    fn test_known_tags() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"stackexchange_javascript"), "Missing javascript");
        assert!(ids.contains(&"stackexchange_python"), "Missing python");
        assert!(ids.contains(&"stackexchange_rust"), "Missing rust");
    }

    #[test]
    fn test_response_deserialize() {
        let json = r#"{"total":142,"quota_remaining":9876,"quota_max":10000,"has_more":false,"backoff":null}"#;
        let resp: StackExchangeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.total, 142);
        assert_eq!(resp.quota_remaining, Some(9876));
    }
}
