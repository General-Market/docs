//! eBird API v2 client implementing MarketDataSource
//!
//! Tracks bird observation data from the eBird API (Cornell Lab of Ornithology).
//! Three types of metrics:
//! - Regional daily stats (species count, checklists)
//! - Recent observation counts by region
//! - Notable/rare sightings count by region
//!
//! Assets are static — defined in config/ebird.json (~23 assets).
//!
//! API: https://api.ebird.org/v2
//! Auth: X-eBird-Api-Token header
//! Rate limit: 100 requests/hour (free tier), we use 10 req/min conservatively

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration
const ASSET_JSON: &str = include_str!("../../../config/ebird.json");

/// eBird API v2 base URL
const API_BASE: &str = "https://api.ebird.org/v2";

/// Delay between API requests (2 seconds)
const REQUEST_DELAY: Duration = Duration::from_secs(2);

/// How many days back to look for observations (1 day misses data if run early in the day)
const OBS_BACK_DAYS: u8 = 3;

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// Regional statistics response from /product/stats/{region}/{y}/{m}/{d}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EbirdStats {
    /// Number of checklists submitted
    num_checklists: Option<u64>,
    /// Number of unique contributors
    #[allow(dead_code)]
    num_contributors: Option<u64>,
    /// Number of unique species observed
    num_species: Option<u64>,
}

/// A single observation from /data/obs/{region}/recent or notable endpoints.
/// We only need to count these, so minimal fields are deserialized.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EbirdObservation {
    /// Species code (e.g., "norcar")
    #[allow(dead_code)]
    species_code: Option<String>,
}

/// Parsed api_ref — determines which endpoint to call
#[derive(Debug, Clone)]
enum ApiRef {
    /// stats:{region}:{field} — calls /product/stats/{region}/{y}/{m}/{d}
    Stats { region: String, field: String },
    /// obs:{region}:count — calls /data/obs/{region}/recent?back=1, counts results
    Obs { region: String },
    /// notable:{region}:count — calls /data/obs/{region}/recent/notable?back=1, counts results
    Notable { region: String },
}

impl ApiRef {
    /// Parse an api_ref string like "stats:US:numSpecies" or "obs:US-CA:count"
    fn parse(api_ref: &str) -> Option<Self> {
        let parts: Vec<&str> = api_ref.split(':').collect();
        if parts.len() < 3 {
            return None;
        }
        match parts[0] {
            "stats" => Some(ApiRef::Stats {
                region: parts[1].to_string(),
                field: parts[2].to_string(),
            }),
            "obs" => Some(ApiRef::Obs {
                region: parts[1].to_string(),
            }),
            "notable" => Some(ApiRef::Notable {
                region: parts[1].to_string(),
            }),
            _ => None,
        }
    }

    /// Get the region code for grouping requests
    fn region(&self) -> &str {
        match self {
            ApiRef::Stats { region, .. } => region,
            ApiRef::Obs { region } => region,
            ApiRef::Notable { region } => region,
        }
    }

    /// Get a unique endpoint key for deduplication (same endpoint + region = one request)
    fn endpoint_key(&self) -> String {
        match self {
            ApiRef::Stats { region, .. } => format!("stats:{}", region),
            ApiRef::Obs { region } => format!("obs:{}", region),
            ApiRef::Notable { region } => format!("notable:{}", region),
        }
    }
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// eBird market data source.
///
/// Tracks bird observation metrics from the eBird API v2.
/// Source ID is `"ebird"`.
///
/// When `api_key` is `None` (env var not set) or the key is expired/invalid (403),
/// the source emits zero-value prices so the sync engine still writes records,
/// keeping the source "alive" in the DB rather than producing NO_DATA.
pub struct EbirdMarketSource {
    http: SourceHttpClient,
    /// None = no API key configured; source will emit zeros
    api_key: Option<String>,
    /// Set to true after a 403 is received, so we stop wasting requests
    api_key_invalid: std::sync::atomic::AtomicBool,
}

impl EbirdMarketSource {
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("EBIRD_API_KEY").ok().filter(|k| !k.is_empty());

        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        if api_key.is_some() {
            info!("eBird source initialized (API key set)");
        } else {
            warn!("eBird source initialized WITHOUT API key — will emit zero-value prices. Set EBIRD_API_KEY (get one at https://ebird.org/api/keygen)");
        }

        Ok(Self {
            http,
            api_key,
            api_key_invalid: std::sync::atomic::AtomicBool::new(false),
        })
    }

    /// Whether the API is usable (key present and not known-invalid)
    fn api_available(&self) -> bool {
        self.api_key.is_some()
            && !self.api_key_invalid.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Mark the API key as invalid after receiving a 403
    fn mark_key_invalid(&self) {
        if !self.api_key_invalid.load(std::sync::atomic::Ordering::Relaxed) {
            warn!(
                "eBird API key is invalid/expired (403). Source will emit zero-value prices. \
                 Get a new key at https://ebird.org/api/keygen and set EBIRD_API_KEY"
            );
            self.api_key_invalid.store(true, std::sync::atomic::Ordering::Relaxed);
        }
    }

    /// Fetch regional stats for a given region code.
    /// Tries today first, falls back to yesterday if today has no species data
    /// (common early in the day or for regions with low activity).
    async fn fetch_stats(&self, region: &str) -> Result<EbirdStats, SourceError> {
        let key = self.api_key.as_deref().ok_or_else(|| {
            SourceError::AuthFailed("EBIRD_API_KEY not set".to_string())
        })?;
        let headers = [("X-eBird-Api-Token", key)];

        // Try today first
        let today = Utc::now();
        let url = format!(
            "{}/product/stats/{}/{}/{}/{}",
            API_BASE,
            region,
            today.format("%Y"),
            today.format("%-m"),
            today.format("%-d"),
        );
        match self.http.get_json_with_headers::<EbirdStats>(&url, &headers).await {
            Ok(stats) if stats.num_species.unwrap_or(0) > 0 => return Ok(stats),
            Ok(_) => {
                debug!("eBird stats for {} today returned 0 species, trying yesterday", region);
            }
            Err(e) => return Err(e),
        }

        // Fall back to yesterday
        tokio::time::sleep(REQUEST_DELAY).await;
        let yesterday = today - chrono::Duration::days(1);
        let url = format!(
            "{}/product/stats/{}/{}/{}/{}",
            API_BASE,
            region,
            yesterday.format("%Y"),
            yesterday.format("%-m"),
            yesterday.format("%-d"),
        );
        self.http
            .get_json_with_headers::<EbirdStats>(&url, &headers)
            .await
    }

    /// Fetch recent observations for a region (last OBS_BACK_DAYS days)
    async fn fetch_obs(&self, region: &str) -> Result<Vec<EbirdObservation>, SourceError> {
        let key = self.api_key.as_deref().ok_or_else(|| {
            SourceError::AuthFailed("EBIRD_API_KEY not set".to_string())
        })?;
        let url = format!(
            "{}/data/obs/{}/recent?back={}",
            API_BASE, region, OBS_BACK_DAYS,
        );
        let headers = [("X-eBird-Api-Token", key)];
        self.http
            .get_json_with_headers::<Vec<EbirdObservation>>(&url, &headers)
            .await
    }

    /// Fetch notable/rare observations for a region (last OBS_BACK_DAYS days)
    async fn fetch_notable(&self, region: &str) -> Result<Vec<EbirdObservation>, SourceError> {
        let key = self.api_key.as_deref().ok_or_else(|| {
            SourceError::AuthFailed("EBIRD_API_KEY not set".to_string())
        })?;
        // "world" is a special pseudo-region — aggregate notable from top birding regions
        if region == "world" {
            return self.fetch_global_notable().await;
        }
        let url = format!(
            "{}/data/obs/{}/recent/notable?back={}",
            API_BASE, region, OBS_BACK_DAYS,
        );
        let headers = [("X-eBird-Api-Token", key)];
        self.http
            .get_json_with_headers::<Vec<EbirdObservation>>(&url, &headers)
            .await
    }

    /// Fetch global notable by aggregating top birding regions.
    /// eBird has no single "global notable" endpoint, so we query a few
    /// major regions and sum them up.
    async fn fetch_global_notable(&self) -> Result<Vec<EbirdObservation>, SourceError> {
        let key = self.api_key.as_deref().ok_or_else(|| {
            SourceError::AuthFailed("EBIRD_API_KEY not set".to_string())
        })?;
        let regions = ["US", "GB", "AU", "CR", "CO", "BR", "IN"];
        let mut all = Vec::new();
        for region in &regions {
            tokio::time::sleep(REQUEST_DELAY).await;
            match self.fetch_notable_raw(region, key).await {
                Ok(obs) => all.extend(obs),
                Err(e) => {
                    warn!("eBird global notable: failed for {}: {:?}", region, e);
                }
            }
        }
        Ok(all)
    }

    /// Raw notable fetch for a single region (no "world" handling)
    async fn fetch_notable_raw(&self, region: &str, key: &str) -> Result<Vec<EbirdObservation>, SourceError> {
        let url = format!(
            "{}/data/obs/{}/recent/notable?back={}",
            API_BASE, region, OBS_BACK_DAYS,
        );
        let headers = [("X-eBird-Api-Token", key)];
        self.http
            .get_json_with_headers::<Vec<EbirdObservation>>(&url, &headers)
            .await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for EbirdMarketSource {
    fn source_id(&self) -> &'static str {
        "ebird"
    }

    fn display_name(&self) -> &'static str {
        "eBird Observations"
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
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!("eBird fetch_assets: {} assets loaded from config", assets.len());
        Ok(assets)
    }

    /// Whether to always write a price record even when the value hasn't changed.
    /// When the API key is missing/invalid, we emit zeros — this ensures they get written.
    fn always_record_price(&self) -> bool {
        true
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get api_ref for each asset_id
        let entries: Vec<crate::market_data::traits::AssetEntry> =
            serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<&str, &str> = entries
            .iter()
            .map(|e| (e.asset_id.as_str(), e.api_ref.as_str()))
            .collect();
        let symbol_map: HashMap<&str, &str> = entries
            .iter()
            .map(|e| (e.asset_id.as_str(), e.symbol.as_str()))
            .collect();

        // Parse api_refs for requested assets
        let mut asset_refs: Vec<(&str, ApiRef)> = Vec::new();
        for id in asset_ids {
            if let Some(api_ref_str) = ref_map.get(id.as_str()) {
                if let Some(parsed) = ApiRef::parse(api_ref_str) {
                    asset_refs.push((id.as_str(), parsed));
                } else {
                    warn!("eBird: unknown api_ref format '{}' for {}", api_ref_str, id);
                }
            } else {
                warn!("eBird: no api_ref found for asset_id '{}'", id);
            }
        }

        // If API is not available (no key or key invalid), emit zeros for all assets
        if !self.api_available() {
            warn!(
                "eBird: API unavailable (key missing or invalid) — emitting zero-value prices for {} assets",
                asset_refs.len()
            );
            let results: Vec<PriceUpdate> = asset_refs
                .iter()
                .map(|(asset_id, _)| {
                    let symbol = symbol_map
                        .get(asset_id)
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| format!("BIRD/{}", asset_id.to_uppercase()));
                    PriceUpdate {
                        asset_id: asset_id.to_string(),
                        symbol,
                        value: Decimal::ZERO,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    }
                })
                .collect();
            return Ok(results);
        }

        // Deduplicate requests by endpoint key.
        // Multiple assets may share the same API call (e.g., stats:US:numSpecies and stats:US:numChecklists
        // both come from the same /product/stats/US/... call).
        let mut stats_cache: HashMap<String, EbirdStats> = HashMap::new();
        let mut obs_cache: HashMap<String, Vec<EbirdObservation>> = HashMap::new();
        let mut notable_cache: HashMap<String, Vec<EbirdObservation>> = HashMap::new();

        // Collect unique endpoint keys
        let mut needed_endpoints: Vec<(String, ApiRef)> = Vec::new();
        {
            let mut seen = std::collections::HashSet::new();
            for (_, ref api_ref) in &asset_refs {
                let key = api_ref.endpoint_key();
                if seen.insert(key.clone()) {
                    needed_endpoints.push((key, api_ref.clone()));
                }
            }
        }

        // Fetch each unique endpoint with a 2s delay between requests.
        // If we get an auth error (403), mark key as invalid and emit zeros for remaining.
        let mut auth_failed = false;
        for (key, ref api_ref) in &needed_endpoints {
            if auth_failed {
                break;
            }
            tokio::time::sleep(REQUEST_DELAY).await;

            match api_ref {
                ApiRef::Stats { region, .. } => {
                    match self.fetch_stats(region).await {
                        Ok(stats) => {
                            debug!("eBird stats for {}: species={:?}, checklists={:?}",
                                region, stats.num_species, stats.num_checklists);
                            stats_cache.insert(key.clone(), stats);
                        }
                        Err(SourceError::AuthFailed(ref msg)) => {
                            warn!("eBird: auth failed (API key expired/invalid?): {}", msg);
                            self.mark_key_invalid();
                            auth_failed = true;
                        }
                        Err(e) => {
                            warn!("eBird: failed to fetch stats for {}: {:?}", region, e);
                        }
                    }
                }
                ApiRef::Obs { region } => {
                    match self.fetch_obs(region).await {
                        Ok(obs) => {
                            debug!("eBird obs for {}: {} observations", region, obs.len());
                            obs_cache.insert(key.clone(), obs);
                        }
                        Err(SourceError::AuthFailed(ref msg)) => {
                            warn!("eBird: auth failed (API key expired/invalid?): {}", msg);
                            self.mark_key_invalid();
                            auth_failed = true;
                        }
                        Err(e) => {
                            warn!("eBird: failed to fetch obs for {}: {:?}", region, e);
                        }
                    }
                }
                ApiRef::Notable { region } => {
                    match self.fetch_notable(region).await {
                        Ok(obs) => {
                            debug!("eBird notable for {}: {} sightings", region, obs.len());
                            notable_cache.insert(key.clone(), obs);
                        }
                        Err(SourceError::AuthFailed(ref msg)) => {
                            warn!("eBird: auth failed (API key expired/invalid?): {}", msg);
                            self.mark_key_invalid();
                            auth_failed = true;
                        }
                        Err(e) => {
                            warn!("eBird: failed to fetch notable for {}: {:?}", region, e);
                        }
                    }
                }
            }
        }

        // Build results — emit zero for any asset that didn't get real data
        let mut results = Vec::with_capacity(asset_ids.len());

        for (asset_id, ref api_ref) in &asset_refs {
            let key = api_ref.endpoint_key();

            let value = match api_ref {
                ApiRef::Stats { field, .. } => {
                    stats_cache.get(&key).and_then(|stats| {
                        match field.as_str() {
                            "numSpecies" => stats.num_species.map(Decimal::from),
                            "numChecklists" => stats.num_checklists.map(Decimal::from),
                            "numContributors" => stats.num_contributors.map(Decimal::from),
                            _ => {
                                warn!("eBird: unknown stats field '{}'", field);
                                None
                            }
                        }
                    })
                }
                ApiRef::Obs { .. } => {
                    obs_cache.get(&key).map(|obs| Decimal::from(obs.len() as u64))
                }
                ApiRef::Notable { .. } => {
                    notable_cache.get(&key).map(|obs| Decimal::from(obs.len() as u64))
                }
            };

            // If API call failed or returned no data, emit zero instead of skipping
            let value = value.unwrap_or_else(|| {
                debug!("eBird: no data for {} (API failure or no data), emitting zero", asset_id);
                Decimal::ZERO
            });

            let symbol = symbol_map
                .get(asset_id)
                .map(|s| s.to_string())
                .unwrap_or_else(|| format!("BIRD/{}", asset_id.to_uppercase()));

            results.push(PriceUpdate {
                asset_id: asset_id.to_string(),
                symbol,
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from eBird ({} zero-filled, {} unique API calls)",
            results.len(),
            asset_ids.len(),
            results.iter().filter(|r| r.value == Decimal::ZERO).count(),
            needed_endpoints.len(),
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
            entries.len() >= 23,
            "Expected >= 23 ebird entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 23,
            "Expected >= 23 active ebird assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_config_has_exactly_23_entries() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 23, "Expected exactly 23 entries, got {}", entries.len());
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
                entry.subcategory, "birds",
                "Entry {} should have birds subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("ebird_"),
                "Asset ID {} should start with 'ebird_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_api_ref_parse_stats() {
        let parsed = ApiRef::parse("stats:US:numSpecies").unwrap();
        match parsed {
            ApiRef::Stats { region, field } => {
                assert_eq!(region, "US");
                assert_eq!(field, "numSpecies");
            }
            _ => panic!("Expected Stats variant"),
        }
    }

    #[test]
    fn test_api_ref_parse_stats_with_subregion() {
        let parsed = ApiRef::parse("stats:US-CA:numSpecies").unwrap();
        match parsed {
            ApiRef::Stats { region, field } => {
                assert_eq!(region, "US-CA");
                assert_eq!(field, "numSpecies");
            }
            _ => panic!("Expected Stats variant"),
        }
    }

    #[test]
    fn test_api_ref_parse_obs() {
        let parsed = ApiRef::parse("obs:US:count").unwrap();
        match parsed {
            ApiRef::Obs { region } => {
                assert_eq!(region, "US");
            }
            _ => panic!("Expected Obs variant"),
        }
    }

    #[test]
    fn test_api_ref_parse_notable() {
        let parsed = ApiRef::parse("notable:GB:count").unwrap();
        match parsed {
            ApiRef::Notable { region } => {
                assert_eq!(region, "GB");
            }
            _ => panic!("Expected Notable variant"),
        }
    }

    #[test]
    fn test_api_ref_parse_notable_world() {
        let parsed = ApiRef::parse("notable:world:count").unwrap();
        match parsed {
            ApiRef::Notable { region } => {
                assert_eq!(region, "world");
            }
            _ => panic!("Expected Notable variant"),
        }
    }

    #[test]
    fn test_api_ref_parse_invalid() {
        assert!(ApiRef::parse("invalid").is_none());
        assert!(ApiRef::parse("bad:format").is_none());
        assert!(ApiRef::parse("unknown:US:field").is_none());
    }

    #[test]
    fn test_api_ref_endpoint_key_dedup() {
        // Two stats for the same region should share endpoint key
        let a = ApiRef::parse("stats:US:numSpecies").unwrap();
        let b = ApiRef::parse("stats:US:numChecklists").unwrap();
        assert_eq!(a.endpoint_key(), b.endpoint_key());
        assert_eq!(a.endpoint_key(), "stats:US");

        // Different regions should have different keys
        let c = ApiRef::parse("stats:GB:numSpecies").unwrap();
        assert_ne!(a.endpoint_key(), c.endpoint_key());
    }

    #[test]
    fn test_api_ref_region() {
        let a = ApiRef::parse("stats:US-CA:numSpecies").unwrap();
        assert_eq!(a.region(), "US-CA");

        let b = ApiRef::parse("obs:AU:count").unwrap();
        assert_eq!(b.region(), "AU");

        let c = ApiRef::parse("notable:world:count").unwrap();
        assert_eq!(c.region(), "world");
    }

    #[test]
    fn test_stats_response_parsing() {
        let json = r#"{"numChecklists": 1234, "numContributors": 567, "numSpecies": 89}"#;
        let stats: EbirdStats = serde_json::from_str(json).unwrap();
        assert_eq!(stats.num_checklists, Some(1234));
        assert_eq!(stats.num_contributors, Some(567));
        assert_eq!(stats.num_species, Some(89));
    }

    #[test]
    fn test_stats_response_parsing_empty() {
        // Stats endpoint can return zeros or null for days with no data
        let json = r#"{"numChecklists": 0, "numContributors": 0, "numSpecies": 0}"#;
        let stats: EbirdStats = serde_json::from_str(json).unwrap();
        assert_eq!(stats.num_checklists, Some(0));
        assert_eq!(stats.num_species, Some(0));
    }

    #[test]
    fn test_obs_response_parsing() {
        let json = r#"[
            {"speciesCode":"norcar","comName":"Northern Cardinal"},
            {"speciesCode":"blujay","comName":"Blue Jay"},
            {"speciesCode":"amecro","comName":"American Crow"}
        ]"#;
        let obs: Vec<EbirdObservation> = serde_json::from_str(json).unwrap();
        assert_eq!(obs.len(), 3);
    }

    #[test]
    fn test_obs_count_extraction() {
        let json = r#"[
            {"speciesCode":"norcar"},
            {"speciesCode":"blujay"}
        ]"#;
        let obs: Vec<EbirdObservation> = serde_json::from_str(json).unwrap();
        let count = Decimal::from(obs.len() as u64);
        assert_eq!(count, Decimal::from(2u64));
    }

    #[test]
    fn test_known_assets_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"ebird_us_species"));
        assert!(ids.contains(&"ebird_us_checklists"));
        assert!(ids.contains(&"ebird_us_ca_species"));
        assert!(ids.contains(&"ebird_gb_species"));
        assert!(ids.contains(&"ebird_au_species"));
        assert!(ids.contains(&"ebird_us_obs_count"));
        assert!(ids.contains(&"ebird_us_notable"));
        assert!(ids.contains(&"ebird_global_notable"));
    }

    #[test]
    fn test_all_api_refs_parseable() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            let parsed = ApiRef::parse(&entry.api_ref);
            assert!(
                parsed.is_some(),
                "api_ref '{}' for asset '{}' should be parseable",
                entry.api_ref,
                entry.asset_id,
            );
        }
    }

    #[test]
    fn test_region_codes_valid() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        // All region codes should be uppercase ISO-3166 or sub-regions
        for entry in &entries {
            let parsed = ApiRef::parse(&entry.api_ref).unwrap();
            let region = parsed.region();
            // "world" is our special pseudo-region
            if region == "world" {
                continue;
            }
            assert!(
                region.chars().all(|c| c.is_ascii_uppercase() || c == '-'),
                "Region '{}' in api_ref '{}' should be uppercase ISO format",
                region,
                entry.api_ref,
            );
        }
    }
}
