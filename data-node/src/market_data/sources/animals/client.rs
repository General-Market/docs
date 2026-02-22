//! Wildlife Observations client implementing MarketDataSource
//!
//! Tracks animal observation counts from GBIF (Global Biodiversity Information
//! Facility) and iNaturalist. Each asset represents a taxon group or species;
//! its value is the number of observations recorded in the past 24 hours.
//!
//! Assets are static — defined in config/animals.json (~24 entries).
//!
//! APIs:
//!   GBIF:        https://api.gbif.org/v1/occurrence/search
//!   iNaturalist: https://api.inaturalist.org/v1/observations
//! Auth: None (both are free, no-auth APIs)
//! Rate limit: 30 req/min (conservative, shared across both APIs)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration
const ASSET_JSON: &str = include_str!("../../../config/animals.json");

/// GBIF Occurrence Search API base URL
const GBIF_API_URL: &str = "https://api.gbif.org/v1/occurrence/search";

/// iNaturalist Observations API base URL
const INAT_API_URL: &str = "https://api.inaturalist.org/v1/observations";

/// Delay between individual API requests (milliseconds)
const INTER_REQUEST_DELAY_MS: u64 = 2000;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// GBIF occurrence search response (we only need the count field)
#[derive(Debug, Deserialize)]
struct GbifResponse {
    /// Total number of matching occurrences
    count: u64,
}

/// iNaturalist observations response (we only need total_results)
#[derive(Debug, Deserialize)]
struct InatResponse {
    /// Total number of matching observations
    total_results: u64,
}

// ============================================================================
// API REFERENCE PARSING
// ============================================================================

/// Parsed API reference from the config's `api_ref` field.
#[derive(Debug, Clone)]
enum ApiRef {
    /// GBIF occurrence search by taxon key (e.g., "gbif:359" for mammals)
    Gbif { taxon_key: u64 },
    /// iNaturalist observations by taxon ID (e.g., "inat:42048" for gray wolf)
    Inat { taxon_id: u64 },
    /// iNaturalist endangered species observations (e.g., "inat_endangered:1")
    InatEndangered { taxon_id: u64 },
}

/// Parse an api_ref string into a structured ApiRef.
///
/// Formats:
///   "gbif:{taxon_key}"           -> ApiRef::Gbif
///   "inat:{taxon_id}"            -> ApiRef::Inat
///   "inat_endangered:{taxon_id}" -> ApiRef::InatEndangered
fn parse_api_ref(api_ref: &str) -> Option<ApiRef> {
    if let Some(key_str) = api_ref.strip_prefix("gbif:") {
        key_str.parse::<u64>().ok().map(|taxon_key| ApiRef::Gbif { taxon_key })
    } else if let Some(id_str) = api_ref.strip_prefix("inat_endangered:") {
        id_str.parse::<u64>().ok().map(|taxon_id| ApiRef::InatEndangered { taxon_id })
    } else if let Some(id_str) = api_ref.strip_prefix("inat:") {
        id_str.parse::<u64>().ok().map(|taxon_id| ApiRef::Inat { taxon_id })
    } else {
        None
    }
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Wildlife Observations market data source.
///
/// Tracks animal observation counts from GBIF and iNaturalist.
/// Source ID is `"animals"`.
pub struct AnimalsMarketSource {
    http: SourceHttpClient,
}

impl AnimalsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Wildlife Observations source initialized");

        Ok(Self { http })
    }

    /// Build a GBIF occurrence search URL for a given taxon key with a 7-day lookback window.
    ///
    /// GBIF has significant data ingestion lag (days to weeks), so querying only
    /// the last 24h returns 0 for all taxon groups. A 7-day window ensures
    /// meaningful non-zero counts while still reflecting recent activity.
    fn gbif_url(&self, taxon_key: u64) -> String {
        let now = Utc::now();
        let week_ago = (now - chrono::Duration::days(7)).format("%Y-%m-%d");
        let today = now.format("%Y-%m-%d");
        format!(
            "{}?limit=0&taxonKey={}&eventDate={},{}",
            GBIF_API_URL, taxon_key, week_ago, today
        )
    }

    /// Build an iNaturalist observations URL for a given taxon ID with yesterday's date filter.
    fn inat_url(&self, taxon_id: u64) -> String {
        let yesterday = (Utc::now() - chrono::Duration::days(1)).format("%Y-%m-%d");
        format!(
            "{}?taxon_id={}&per_page=0&d1={}",
            INAT_API_URL, taxon_id, yesterday
        )
    }

    /// Build an iNaturalist URL for endangered species (IUCN threatened categories).
    fn inat_endangered_url(&self, taxon_id: u64) -> String {
        let yesterday = (Utc::now() - chrono::Duration::days(1)).format("%Y-%m-%d");
        format!(
            "{}?taxon_id={}&per_page=0&d1={}&threatened=true",
            INAT_API_URL, taxon_id, yesterday
        )
    }

    /// Fetch the observation count for a single asset.
    async fn fetch_single(&self, api_ref: &ApiRef) -> Result<u64, SourceError> {
        match api_ref {
            ApiRef::Gbif { taxon_key } => {
                let url = self.gbif_url(*taxon_key);
                let resp: GbifResponse = self.http.get_json(&url).await?;
                Ok(resp.count)
            }
            ApiRef::Inat { taxon_id } => {
                let url = self.inat_url(*taxon_id);
                let resp: InatResponse = self.http.get_json(&url).await?;
                Ok(resp.total_results)
            }
            ApiRef::InatEndangered { taxon_id } => {
                let url = self.inat_endangered_url(*taxon_id);
                let resp: InatResponse = self.http.get_json(&url).await?;
                Ok(resp.total_results)
            }
        }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for AnimalsMarketSource {
    fn source_id(&self) -> &'static str {
        "animals"
    }

    fn display_name(&self) -> &'static str {
        "Wildlife Observations"
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
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("Animals fetch_assets: {} assets loaded from config", assets.len());
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config entries to get api_ref for each asset_id
        let entries: Vec<crate::market_data::traits::AssetEntry> =
            serde_json::from_str(ASSET_JSON)?;
        let ref_map: std::collections::HashMap<&str, &str> = entries
            .iter()
            .map(|e| (e.asset_id.as_str(), e.api_ref.as_str()))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());
        let mut success_count = 0u32;
        let mut error_count = 0u32;

        for asset_id in asset_ids {
            let api_ref_str = match ref_map.get(asset_id.as_str()) {
                Some(r) => *r,
                None => {
                    warn!("No api_ref found for asset_id: {}", asset_id);
                    error_count += 1;
                    continue;
                }
            };

            let parsed = match parse_api_ref(api_ref_str) {
                Some(p) => p,
                None => {
                    warn!("Failed to parse api_ref '{}' for asset_id: {}", api_ref_str, asset_id);
                    error_count += 1;
                    continue;
                }
            };

            // Fetch observation count
            let value = match self.fetch_single(&parsed).await {
                Ok(count) => {
                    debug!("Animal {}: {} observations", asset_id, count);
                    success_count += 1;
                    Decimal::from(count)
                }
                Err(e) => {
                    warn!("Error fetching animal data for {}: {:?}", asset_id, e);
                    error_count += 1;
                    // Return 0 on error rather than skipping
                    Decimal::ZERO
                }
            };

            // Determine symbol from the asset_id
            let symbol = ref_map
                .get(asset_id.as_str())
                .map(|_| {
                    entries
                        .iter()
                        .find(|e| e.asset_id == *asset_id)
                        .map(|e| e.symbol.clone())
                        .unwrap_or_else(|| format!("WILD/{}", asset_id.to_uppercase()))
                })
                .unwrap_or_else(|| format!("WILD/{}", asset_id.to_uppercase()));

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol,
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });

            // Inter-request delay to be respectful to APIs
            tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;
        }

        info!(
            "Fetched {}/{} prices from Wildlife Observations ({} errors)",
            success_count,
            asset_ids.len(),
            error_count
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
            "Expected >= 20 animal entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 20,
            "Expected >= 20 active animal assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_config_has_24_entries() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 24, "Expected exactly 24 entries, got {}", entries.len());
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Entry {} should be active", entry.asset_id);
        }
    }

    #[test]
    fn test_all_entries_environment_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "environment",
                "Entry {} should have environment category",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "wildlife",
                "Entry {} should have wildlife subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("animal_"),
                "Asset ID {} should start with 'animal_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_parse_api_ref_gbif() {
        let parsed = parse_api_ref("gbif:359").unwrap();
        match parsed {
            ApiRef::Gbif { taxon_key } => assert_eq!(taxon_key, 359),
            _ => panic!("Expected ApiRef::Gbif"),
        }
    }

    #[test]
    fn test_parse_api_ref_inat() {
        let parsed = parse_api_ref("inat:42048").unwrap();
        match parsed {
            ApiRef::Inat { taxon_id } => assert_eq!(taxon_id, 42048),
            _ => panic!("Expected ApiRef::Inat"),
        }
    }

    #[test]
    fn test_parse_api_ref_inat_endangered() {
        let parsed = parse_api_ref("inat_endangered:1").unwrap();
        match parsed {
            ApiRef::InatEndangered { taxon_id } => assert_eq!(taxon_id, 1),
            _ => panic!("Expected ApiRef::InatEndangered"),
        }
    }

    #[test]
    fn test_parse_api_ref_invalid() {
        assert!(parse_api_ref("unknown:123").is_none());
        assert!(parse_api_ref("").is_none());
        assert!(parse_api_ref("gbif:notanumber").is_none());
    }

    #[test]
    fn test_all_api_refs_parseable() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let parsed = parse_api_ref(&entry.api_ref);
            assert!(
                parsed.is_some(),
                "Failed to parse api_ref '{}' for asset '{}'",
                entry.api_ref, entry.asset_id
            );
        }
    }

    #[test]
    fn test_gbif_entries_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let gbif_count = entries.iter().filter(|e| e.api_ref.starts_with("gbif:")).count();
        assert_eq!(gbif_count, 6, "Expected 6 GBIF entries");
    }

    #[test]
    fn test_inat_entries_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let inat_count = entries.iter().filter(|e| e.api_ref.starts_with("inat:")).count();
        assert!(
            inat_count >= 15,
            "Expected >= 15 iNaturalist entries, got {}",
            inat_count
        );
    }

    #[test]
    fn test_known_assets_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"animal_mammals_observations"));
        assert!(ids.contains(&"animal_birds_observations"));
        assert!(ids.contains(&"animal_gray_wolf"));
        assert!(ids.contains(&"animal_bald_eagle"));
        assert!(ids.contains(&"animal_blue_whale"));
        assert!(ids.contains(&"animal_total_observations_24h"));
        assert!(ids.contains(&"animal_endangered_sightings_24h"));
    }

    #[test]
    fn test_symbols_use_wild_prefix() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("WILD/"),
                "Symbol {} should start with 'WILD/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_gbif_response_parsing() {
        let json = r#"{"offset":0,"limit":0,"endOfRecords":true,"count":12345,"results":[]}"#;
        let resp: GbifResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.count, 12345);
    }

    #[test]
    fn test_inat_response_parsing() {
        let json = r#"{"total_results":42,"page":1,"per_page":0,"results":[]}"#;
        let resp: InatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.total_results, 42);
    }
}
