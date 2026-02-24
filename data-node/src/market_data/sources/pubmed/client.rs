//! PubMed / NCBI E-utilities client implementing MarketDataSource
//!
//! Tracks daily new biomedical article counts from PubMed (NCBI).
//! Each asset is a medical/scientific topic; value is articles indexed today.
//! Hundreds of new articles indexed daily across topics.
//!
//! Assets are static — defined in config/pubmed.json (25 entries: 24 topics + total).
//!
//! API: NCBI E-utilities — https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
//! Auth: Optional NCBI API key (increases from 3 to 10 req/s)
//! Rate limit: 3 req/s without key, 10 req/s with key

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

const ASSET_JSON: &str = include_str!("../../../config/pubmed.json");
const API_BASE: &str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct ESearchResponse {
    esearchresult: ESearchResult,
}

#[derive(Debug, Deserialize)]
struct ESearchResult {
    count: String,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct PubMedMarketSource {
    http: SourceHttpClient,
    api_key: String,
}

impl PubMedMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("NCBI_API_KEY").unwrap_or_default();
        let max_req = if api_key.is_empty() { 3 } else { 10 };
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: max_req,
                duration: Duration::from_secs(1),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!(has_key = !api_key.is_empty(), "PubMed E-utilities source initialized");
        Ok(Self { http, api_key })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for PubMedMarketSource {
    fn source_id(&self) -> &'static str { "pubmed" }
    fn display_name(&self) -> &'static str { "PubMed Biomedical Literature" }
    fn default_resolution(&self) -> &'static str { "deterministic" }
    fn sync_interval(&self) -> Duration { Duration::from_secs(600) }

    fn rate_limit_config(&self) -> RateLimitConfig {
        let max_req = if self.api_key.is_empty() { 3 } else { 10 };
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: max_req,
                duration: Duration::from_secs(1),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("PubMed fetch_assets: {} assets loaded from config", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        // PubMed uses YYYY/MM/DD format
        let today = now.format("%Y/%m/%d").to_string();

        let entries = load_all_asset_entries(ASSET_JSON)?;
        let config_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id, e.api_ref))
            .collect();

        let api_key_param = if self.api_key.is_empty() {
            String::new()
        } else {
            format!("&api_key={}", self.api_key)
        };

        let mut cache: HashMap<String, u64> = HashMap::new();
        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let api_ref = config_map.get(asset_id.as_str()).cloned().unwrap_or_default();

            if !cache.contains_key(&api_ref) {
                let url = if api_ref == "total" {
                    format!(
                        "{}/esearch.fcgi?db=pubmed&datetype=edat&mindate={}&maxdate={}&retmode=json{}",
                        API_BASE, today, today, api_key_param
                    )
                } else {
                    let term = api_ref.replace(' ', "+");
                    format!(
                        "{}/esearch.fcgi?db=pubmed&term={}&datetype=edat&mindate={}&maxdate={}&retmode=json{}",
                        API_BASE, term, today, today, api_key_param
                    )
                };

                let count = match self.http.get_json::<ESearchResponse>(&url).await {
                    Ok(resp) => resp.esearchresult.count.parse::<u64>().unwrap_or(0),
                    Err(e) => {
                        warn!("PubMed API error for {}: {:?}", api_ref, e);
                        0
                    }
                };

                debug!("PubMed {} = {} (date={})", api_ref, count, today);
                cache.insert(api_ref.clone(), count);

                // 350ms delay between calls (conservative for 3 req/s without key)
                tokio::time::sleep(Duration::from_millis(350)).await;
            }

            let value = Decimal::from(cache.get(&api_ref).copied().unwrap_or(0));
            let suffix = asset_id.strip_prefix("pubmed_").unwrap_or(asset_id);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("PMED/{}", suffix.to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!("Fetched {}/{} prices from PubMed (date={})", results.len(), asset_ids.len(), today);
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
        assert_eq!(entries.len(), 25, "Expected 25 PubMed entries, got {}", entries.len());
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 25);
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
            assert_eq!(e.subcategory, "biomedical_research");
        }
    }

    #[test]
    fn test_asset_id_prefix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for e in &entries {
            assert!(e.asset_id.starts_with("pubmed_"), "{} bad prefix", e.asset_id);
        }
    }

    #[test]
    fn test_has_total() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(entries.iter().any(|e| e.api_ref == "total"));
    }

    #[test]
    fn test_known_topics() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"pubmed_cancer"));
        assert!(ids.contains(&"pubmed_covid"));
        assert!(ids.contains(&"pubmed_total"));
    }

    #[test]
    fn test_response_deserialize() {
        let json = r#"{"header":{"type":"esearch","version":"0.3"},"esearchresult":{"count":"12345","retmax":"0","retstart":"0","idlist":[]}}"#;
        let resp: ESearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.esearchresult.count, "12345");
    }
}
