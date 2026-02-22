//! Movebank GPS Animal Tracking client implementing MarketDataSource
//!
//! Tracks real GPS positions of tagged animals from the Movebank database
//! (Max Planck Institute of Animal Behavior). Each tracked animal produces
//! two assets: latitude and longitude. Values are the raw GPS coordinates.
//!
//! Assets are fully dynamic -- discovered from the Movebank API by querying
//! public GPS studies, then enumerating individuals within each study.
//!
//! API: https://www.movebank.org/movebank/service/direct-read
//! Auth: HTTP Basic Auth (username:password)
//! Rate limit: 1 concurrent request per IP, very conservative (2 req/min)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::{HashMap, HashSet};
use std::str::FromStr;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};

/// Asset configuration (empty -- all assets are dynamic)
const ASSET_JSON: &str = include_str!("../../../config/movebank.json");

/// Movebank API base URL
const MOVEBANK_API_URL: &str = "https://www.movebank.org/movebank/service/direct-read";

/// Delay between sequential API requests (ms) -- very conservative
const INTER_REQUEST_DELAY_MS: u64 = 3000;

/// Maximum number of studies to discover
const MAX_STUDIES: usize = 15;

/// Maximum individuals per study (skip studies with too many)
const MAX_INDIVIDUALS_PER_STUDY: u64 = 50;

/// Minimum individuals per study (skip empty/tiny studies)
const MIN_INDIVIDUALS_PER_STUDY: u64 = 1;

/// GPS sensor type ID in Movebank
const GPS_SENSOR_TYPE_ID: u64 = 653;

// ============================================================================
// CSV PARSING
// ============================================================================

/// Parse a CSV response into a list of rows (each row is a HashMap of column_name -> value).
/// Handles quoted fields containing commas.
fn parse_csv(csv_text: &str) -> Vec<HashMap<String, String>> {
    let mut lines = csv_text.lines();

    // Parse header
    let header_line = match lines.next() {
        Some(h) => h,
        None => return Vec::new(),
    };
    let headers = parse_csv_row(header_line);

    let mut rows = Vec::new();
    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let fields = parse_csv_row(line);
        if fields.len() != headers.len() {
            debug!(
                "CSV row field count mismatch: expected {}, got {} -- skipping",
                headers.len(),
                fields.len()
            );
            continue;
        }
        let mut row = HashMap::new();
        for (i, header) in headers.iter().enumerate() {
            row.insert(header.clone(), fields[i].clone());
        }
        rows.push(row);
    }

    rows
}

/// Parse a single CSV row, handling quoted fields (commas inside quotes).
fn parse_csv_row(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    for ch in line.chars() {
        match ch {
            '"' => {
                in_quotes = !in_quotes;
            }
            ',' if !in_quotes => {
                fields.push(current.trim().to_string());
                current = String::new();
            }
            _ => {
                current.push(ch);
            }
        }
    }
    fields.push(current.trim().to_string());

    fields
}

/// Sanitize an animal/study name for use in asset IDs.
/// Lowercases, replaces non-alphanumeric with underscore, collapses runs, trims.
fn sanitize_name(name: &str) -> String {
    let sanitized: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    // Collapse multiple underscores
    let mut result = String::new();
    let mut prev_underscore = false;
    for ch in sanitized.chars() {
        if ch == '_' {
            if !prev_underscore {
                result.push('_');
            }
            prev_underscore = true;
        } else {
            result.push(ch);
            prev_underscore = false;
        }
    }
    result.trim_matches('_').to_string()
}

/// Truncate a string to max_len, appending "..." if truncated.
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// Movebank GPS Animal Tracking market data source.
///
/// Tracks GPS positions of tagged animals from public Movebank studies.
/// Source ID is `"movebank"`.
pub struct MovebankMarketSource {
    http: SourceHttpClient,
    user: String,
    password: String,
}

impl MovebankMarketSource {
    /// Create a new MovebankMarketSource from provided credentials.
    pub fn new(user: String, password: String) -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("Movebank GPS animal tracking source initialized");

        Ok(Self {
            http,
            user,
            password,
        })
    }

    /// Make an authenticated GET request to the Movebank API, returning raw CSV text.
    async fn api_get(&self, query_params: &str) -> Result<String, anyhow::Error> {
        let url = format!("{}?{}", MOVEBANK_API_URL, query_params);

        // Use the inner reqwest client with basic auth
        self.http.rate_limiter().wait_for_permit().await;

        let response = self
            .http
            .inner()
            .get(&url)
            .basic_auth(&self.user, Some(&self.password))
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Movebank request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Movebank API error (HTTP {}): {}",
                status.as_u16(),
                truncate(&body, 200)
            ));
        }

        let text = response
            .text()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read Movebank response body: {}", e))?;

        // Movebank may return a license agreement page instead of data.
        // Detect this and report it clearly.
        if text.contains("License Terms") || text.contains("accept the license") {
            return Err(anyhow::anyhow!(
                "Movebank returned a license agreement page. \
                 The user may need to accept study-level licenses via the Movebank web UI."
            ));
        }

        Ok(text)
    }

    /// Fetch list of public GPS studies.
    async fn fetch_studies(&self) -> Result<Vec<StudyInfo>> {
        let params = format!(
            "entity_type=study&i_can_see_data=true&sensor_type_id={}&attributes=id,name,number_of_individuals",
            GPS_SENSOR_TYPE_ID
        );

        let csv_text = self.api_get(&params).await?;
        let rows = parse_csv(&csv_text);

        let mut studies = Vec::new();
        for row in &rows {
            let id = match row.get("id").and_then(|v| v.parse::<u64>().ok()) {
                Some(id) => id,
                None => continue,
            };
            let name = row
                .get("name")
                .cloned()
                .unwrap_or_else(|| format!("Study {}", id));
            let num_individuals = row
                .get("number_of_individuals")
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0);

            studies.push(StudyInfo {
                id,
                name,
                num_individuals,
            });
        }

        info!("Movebank: discovered {} public GPS studies", studies.len());
        Ok(studies)
    }

    /// Fetch individuals for a given study.
    async fn fetch_individuals(&self, study_id: u64) -> Result<Vec<IndividualInfo>> {
        let params = format!(
            "entity_type=individual&study_id={}&attributes=id,local_identifier,taxon_canonical_name",
            study_id
        );

        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

        let csv_text = match self.api_get(&params).await {
            Ok(text) => text,
            Err(e) => {
                warn!(
                    "Movebank: failed to fetch individuals for study {}: {}",
                    study_id, e
                );
                return Ok(Vec::new());
            }
        };

        let rows = parse_csv(&csv_text);
        let mut individuals = Vec::new();

        for row in &rows {
            let id = match row.get("id").and_then(|v| v.parse::<u64>().ok()) {
                Some(id) => id,
                None => continue,
            };
            let local_identifier = row
                .get("local_identifier")
                .cloned()
                .unwrap_or_else(|| format!("Animal_{}", id));
            let taxon = row
                .get("taxon_canonical_name")
                .cloned()
                .unwrap_or_default();

            individuals.push(IndividualInfo {
                id,
                local_identifier,
                taxon,
            });
        }

        debug!(
            "Movebank: study {} has {} individuals",
            study_id,
            individuals.len()
        );
        Ok(individuals)
    }

    /// Fetch latest GPS events for all individuals in a study.
    /// Returns a map of local_identifier -> (latitude, longitude).
    async fn fetch_latest_events(
        &self,
        study_id: u64,
    ) -> Result<HashMap<String, (f64, f64)>> {
        let params = format!(
            "entity_type=event&study_id={}&sensor_type_id={}&attributes=timestamp,location_lat,location_long,individual_local_identifier&max_events_per_individual=1",
            study_id, GPS_SENSOR_TYPE_ID
        );

        tokio::time::sleep(Duration::from_millis(INTER_REQUEST_DELAY_MS)).await;

        let csv_text = match self.api_get(&params).await {
            Ok(text) => text,
            Err(e) => {
                warn!(
                    "Movebank: failed to fetch events for study {}: {}",
                    study_id, e
                );
                return Ok(HashMap::new());
            }
        };

        let rows = parse_csv(&csv_text);
        let mut events = HashMap::new();

        for row in &rows {
            let identifier = match row.get("individual_local_identifier") {
                Some(id) if !id.is_empty() => id.clone(),
                _ => continue,
            };
            let lat = match row
                .get("location_lat")
                .and_then(|v| v.parse::<f64>().ok())
            {
                Some(lat) => lat,
                None => continue,
            };
            let lon = match row
                .get("location_long")
                .and_then(|v| v.parse::<f64>().ok())
            {
                Some(lon) => lon,
                None => continue,
            };

            events.insert(identifier, (lat, lon));
        }

        debug!(
            "Movebank: study {} returned {} GPS events",
            study_id,
            events.len()
        );
        Ok(events)
    }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/// A Movebank study (GPS tracking project)
#[derive(Debug, Clone)]
struct StudyInfo {
    id: u64,
    name: String,
    num_individuals: u64,
}

/// An individual tracked animal within a study
#[derive(Debug, Clone)]
struct IndividualInfo {
    id: u64,
    local_identifier: String,
    taxon: String,
}

// ============================================================================
// MarketDataSource IMPLEMENTATION
// ============================================================================

#[async_trait::async_trait]
impl MarketDataSource for MovebankMarketSource {
    fn source_id(&self) -> &'static str {
        "movebank"
    }

    fn display_name(&self) -> &'static str {
        "Movebank Animal GPS"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(1800) // 30 minutes -- GPS updates are infrequent
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 2,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        // If config JSON has static entries, use them
        let static_assets = load_assets_from_json(ASSET_JSON)?;
        if !static_assets.is_empty() {
            return Ok(static_assets);
        }

        // Dynamic discovery from Movebank API
        let studies = match self.fetch_studies().await {
            Ok(s) => s,
            Err(e) => {
                warn!("Movebank: failed to discover studies: {}", e);
                return Ok(Vec::new());
            }
        };

        // Filter to studies with a reasonable number of individuals
        let mut eligible_studies: Vec<&StudyInfo> = studies
            .iter()
            .filter(|s| {
                s.num_individuals >= MIN_INDIVIDUALS_PER_STUDY
                    && s.num_individuals <= MAX_INDIVIDUALS_PER_STUDY
            })
            .collect();

        // Sort by number of individuals descending (prefer richer studies)
        eligible_studies.sort_by(|a, b| b.num_individuals.cmp(&a.num_individuals));
        eligible_studies.truncate(MAX_STUDIES);

        info!(
            "Movebank: selected {} studies from {} eligible (of {} total)",
            eligible_studies.len(),
            studies
                .iter()
                .filter(|s| {
                    s.num_individuals >= MIN_INDIVIDUALS_PER_STUDY
                        && s.num_individuals <= MAX_INDIVIDUALS_PER_STUDY
                })
                .count(),
            studies.len()
        );

        let mut assets = Vec::new();

        for study in &eligible_studies {
            let individuals = match self.fetch_individuals(study.id).await {
                Ok(indivs) => indivs,
                Err(e) => {
                    warn!(
                        "Movebank: failed to fetch individuals for study {} ({}): {}",
                        study.id, study.name, e
                    );
                    continue;
                }
            };

            for individual in &individuals {
                let animal_name_san = sanitize_name(&individual.local_identifier);
                let species_display = if individual.taxon.is_empty() {
                    "Unknown species".to_string()
                } else {
                    individual.taxon.clone()
                };
                let animal_display = truncate(&individual.local_identifier, 40);

                // Latitude asset
                let lat_asset_id = format!(
                    "mb_{}_{}_lat",
                    study.id, individual.id
                );
                assets.push(AssetUpdate {
                    asset_id: lat_asset_id,
                    symbol: format!(
                        "MB/{}/LAT",
                        animal_name_san.to_uppercase()
                    ),
                    name: format!(
                        "{} ({}) - Latitude",
                        animal_display, species_display
                    ),
                    category: Some("environment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("{}:{}", study.id, individual.id),
                        "subcategory": "animal_tracking",
                        "active": true,
                        "extra": {
                            "study_id": study.id,
                            "study_name": study.name,
                            "individual_id": individual.id,
                            "local_identifier": individual.local_identifier,
                            "taxon": individual.taxon,
                            "coord": "lat",
                        },
                    }),
                });

                // Longitude asset
                let lon_asset_id = format!(
                    "mb_{}_{}_lon",
                    study.id, individual.id
                );
                assets.push(AssetUpdate {
                    asset_id: lon_asset_id,
                    symbol: format!(
                        "MB/{}/LON",
                        animal_name_san.to_uppercase()
                    ),
                    name: format!(
                        "{} ({}) - Longitude",
                        animal_display, species_display
                    ),
                    category: Some("environment".to_string()),
                    metadata: serde_json::json!({
                        "api_ref": format!("{}:{}", study.id, individual.id),
                        "subcategory": "animal_tracking",
                        "active": true,
                        "extra": {
                            "study_id": study.id,
                            "study_name": study.name,
                            "individual_id": individual.id,
                            "local_identifier": individual.local_identifier,
                            "taxon": individual.taxon,
                            "coord": "lon",
                        },
                    }),
                });
            }
        }

        info!(
            "Movebank fetch_assets: {} studies -> {} assets ({} animals)",
            eligible_studies.len(),
            assets.len(),
            assets.len() / 2
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Group asset_ids by study_id.
        // Asset ID format: "mb_{study_id}_{individual_id}_{lat|lon}"
        let mut study_assets: HashMap<u64, Vec<&String>> = HashMap::new();
        let mut requested: HashSet<String> = HashSet::new();

        for asset_id in asset_ids {
            requested.insert(asset_id.clone());
            if let Some(study_id) = parse_study_id(asset_id) {
                study_assets
                    .entry(study_id)
                    .or_default()
                    .push(asset_id);
            }
        }

        debug!(
            "Movebank fetch_prices: {} asset_ids -> {} unique studies",
            asset_ids.len(),
            study_assets.len()
        );

        let mut results = Vec::new();

        for (study_id, _study_asset_ids) in &study_assets {
            let events = match self.fetch_latest_events(*study_id).await {
                Ok(evts) => evts,
                Err(e) => {
                    warn!(
                        "Movebank: failed to fetch events for study {}: {}",
                        study_id, e
                    );
                    continue;
                }
            };

            // Build lookup from individual_id -> (lat, lon) by matching identifiers.
            // We need to map from the asset_id (which contains individual numeric ID)
            // back to the event data (which is keyed by local_identifier).
            // Since we don't have the identifier->ID mapping at price time,
            // we match all events and build individual assets from what we have.
            //
            // Actually, the events are keyed by local_identifier, but our asset IDs
            // use the numeric individual_id. We need to fetch the individual list too
            // to create the mapping. But that's expensive. Instead, we fetch events
            // with individual_id included.
            //
            // Alternative: fetch events with individual_id attribute too.
            // For now, fetch individuals to build the mapping.

            // Fetch individuals to build local_identifier -> id mapping
            let individuals = match self.fetch_individuals(*study_id).await {
                Ok(indivs) => indivs,
                Err(e) => {
                    warn!(
                        "Movebank: failed to fetch individuals for mapping in study {}: {}",
                        study_id, e
                    );
                    continue;
                }
            };

            // Build identifier -> numeric_id mapping
            let id_map: HashMap<String, u64> = individuals
                .iter()
                .map(|ind| (ind.local_identifier.clone(), ind.id))
                .collect();

            for (identifier, (lat, lon)) in &events {
                let individual_id = match id_map.get(identifier) {
                    Some(id) => *id,
                    None => {
                        debug!(
                            "Movebank: no ID mapping for identifier '{}' in study {}",
                            identifier, study_id
                        );
                        continue;
                    }
                };

                let lat_asset_id = format!("mb_{}_{}_lat", study_id, individual_id);
                let lon_asset_id = format!("mb_{}_{}_lon", study_id, individual_id);

                let animal_name_san = sanitize_name(identifier);

                if requested.contains(&lat_asset_id) {
                    if let Ok(value) = Decimal::from_str(&format!("{:.6}", lat)) {
                        results.push(PriceUpdate {
                            asset_id: lat_asset_id,
                            symbol: format!("MB/{}/LAT", animal_name_san.to_uppercase()),
                            value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }

                if requested.contains(&lon_asset_id) {
                    if let Ok(value) = Decimal::from_str(&format!("{:.6}", lon)) {
                        results.push(PriceUpdate {
                            asset_id: lon_asset_id,
                            symbol: format!("MB/{}/LON", animal_name_san.to_uppercase()),
                            value,
                            prev_close: None,
                            change_pct: None,
                            volume_24h: None,
                            market_cap: None,
                            fetched_at: now,
                        });
                    }
                }
            }
        }

        info!(
            "Fetched {}/{} prices from Movebank GPS ({} studies)",
            results.len(),
            asset_ids.len(),
            study_assets.len()
        );

        Ok(results)
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Parse study_id from an asset_id like "mb_{study_id}_{individual_id}_{lat|lon}"
fn parse_study_id(asset_id: &str) -> Option<u64> {
    let rest = asset_id.strip_prefix("mb_")?;
    let first_part = rest.split('_').next()?;
    first_part.parse::<u64>().ok()
}

/// Parse (study_id, individual_id) from an asset_id.
#[allow(dead_code)]
fn parse_asset_ids(asset_id: &str) -> Option<(u64, u64)> {
    let rest = asset_id.strip_prefix("mb_")?;
    let parts: Vec<&str> = rest.split('_').collect();
    if parts.len() < 3 {
        return None;
    }
    let study_id = parts[0].parse::<u64>().ok()?;
    let individual_id = parts[1].parse::<u64>().ok()?;
    Some((study_id, individual_id))
}

/// Parse the coordinate type (lat/lon) from an asset_id.
#[allow(dead_code)]
fn parse_coord_type(asset_id: &str) -> Option<&str> {
    if asset_id.ends_with("_lat") {
        Some("lat")
    } else if asset_id.ends_with("_lon") {
        Some("lon")
    } else {
        None
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
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(
            entries.is_empty(),
            "Config should be empty -- assets are dynamic"
        );
    }

    #[test]
    fn test_empty_config_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    #[test]
    fn test_parse_study_id() {
        assert_eq!(parse_study_id("mb_2911040_12345_lat"), Some(2911040));
        assert_eq!(parse_study_id("mb_10763606_67890_lon"), Some(10763606));
        assert_eq!(parse_study_id("invalid"), None);
        assert_eq!(parse_study_id("mb_"), None);
        assert_eq!(parse_study_id("mb_abc_123_lat"), None);
        assert_eq!(parse_study_id(""), None);
    }

    #[test]
    fn test_parse_asset_ids() {
        assert_eq!(
            parse_asset_ids("mb_2911040_12345_lat"),
            Some((2911040, 12345))
        );
        assert_eq!(
            parse_asset_ids("mb_10763606_67890_lon"),
            Some((10763606, 67890))
        );
        assert_eq!(parse_asset_ids("mb_123"), None);
        assert_eq!(parse_asset_ids("invalid"), None);
        assert_eq!(parse_asset_ids(""), None);
    }

    #[test]
    fn test_parse_coord_type() {
        assert_eq!(parse_coord_type("mb_123_456_lat"), Some("lat"));
        assert_eq!(parse_coord_type("mb_123_456_lon"), Some("lon"));
        assert_eq!(parse_coord_type("mb_123_456_other"), None);
        assert_eq!(parse_coord_type(""), None);
    }

    #[test]
    fn test_sanitize_name() {
        assert_eq!(sanitize_name("Albatross_01"), "albatross_01");
        assert_eq!(sanitize_name("White Stork (Germany)"), "white_stork_germany");
        assert_eq!(
            sanitize_name("Animal #42 - GPS"),
            "animal_42_gps"
        );
        assert_eq!(sanitize_name("simple"), "simple");
        assert_eq!(sanitize_name("  spaces  "), "spaces");
        assert_eq!(sanitize_name("a--b__c"), "a_b_c");
    }

    #[test]
    fn test_sanitize_name_special_chars() {
        assert_eq!(sanitize_name("Eagle/Hawk"), "eagle_hawk");
        assert_eq!(sanitize_name("Lat: -23.5"), "lat_23_5");
    }

    #[test]
    fn test_truncate() {
        assert_eq!(truncate("short", 10), "short");
        assert_eq!(truncate("exactly ten", 11), "exactly ten");
        assert_eq!(truncate("this is a longer string", 10), "this is...");
    }

    #[test]
    fn test_parse_csv_simple() {
        let csv = "id,name,count\n1,Alpha,10\n2,Beta,20\n";
        let rows = parse_csv(csv);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].get("id").unwrap(), "1");
        assert_eq!(rows[0].get("name").unwrap(), "Alpha");
        assert_eq!(rows[0].get("count").unwrap(), "10");
        assert_eq!(rows[1].get("id").unwrap(), "2");
        assert_eq!(rows[1].get("name").unwrap(), "Beta");
    }

    #[test]
    fn test_parse_csv_quoted_fields() {
        let csv = "id,name,notes\n1,\"Smith, John\",\"has, commas\"\n2,Plain,simple\n";
        let rows = parse_csv(csv);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].get("name").unwrap(), "Smith, John");
        assert_eq!(rows[0].get("notes").unwrap(), "has, commas");
        assert_eq!(rows[1].get("name").unwrap(), "Plain");
    }

    #[test]
    fn test_parse_csv_empty() {
        let csv = "";
        let rows = parse_csv(csv);
        assert!(rows.is_empty());
    }

    #[test]
    fn test_parse_csv_header_only() {
        let csv = "id,name,value\n";
        let rows = parse_csv(csv);
        assert!(rows.is_empty());
    }

    #[test]
    fn test_parse_csv_movebank_study_response() {
        let csv = concat!(
            "id,name,number_of_individuals\n",
            "2911040,\"Galapagos Albatrosses\",25\n",
            "10763606,\"White Stork Germany\",100\n",
        );
        let rows = parse_csv(csv);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].get("id").unwrap(), "2911040");
        assert_eq!(rows[0].get("name").unwrap(), "Galapagos Albatrosses");
        assert_eq!(rows[0].get("number_of_individuals").unwrap(), "25");
    }

    #[test]
    fn test_parse_csv_movebank_event_response() {
        let csv = concat!(
            "timestamp,location_lat,location_long,individual_local_identifier\n",
            "2026-02-20 14:30:00.000,1.234567,-80.654321,Albatross_01\n",
            "2026-02-20 15:00:00.000,-0.456789,-91.123456,Albatross_02\n",
        );
        let rows = parse_csv(csv);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].get("location_lat").unwrap(), "1.234567");
        assert_eq!(rows[0].get("location_long").unwrap(), "-80.654321");
        assert_eq!(
            rows[0].get("individual_local_identifier").unwrap(),
            "Albatross_01"
        );
    }

    #[test]
    fn test_parse_csv_row_basic() {
        let fields = parse_csv_row("a,b,c");
        assert_eq!(fields, vec!["a", "b", "c"]);
    }

    #[test]
    fn test_parse_csv_row_quoted() {
        let fields = parse_csv_row("\"hello, world\",42,\"another, field\"");
        assert_eq!(fields, vec!["hello, world", "42", "another, field"]);
    }

    #[test]
    fn test_study_to_asset_grouping() {
        let asset_ids = vec![
            "mb_100_1_lat".to_string(),
            "mb_100_1_lon".to_string(),
            "mb_100_2_lat".to_string(),
            "mb_200_3_lat".to_string(),
        ];

        let mut study_assets: HashMap<u64, Vec<&String>> = HashMap::new();
        for aid in &asset_ids {
            if let Some(study_id) = parse_study_id(aid) {
                study_assets.entry(study_id).or_default().push(aid);
            }
        }

        assert_eq!(study_assets.len(), 2);
        assert_eq!(study_assets[&100].len(), 3);
        assert_eq!(study_assets[&200].len(), 1);
    }

    #[test]
    fn test_decimal_from_gps_coordinate() {
        // Positive latitude
        let lat = 37.7749;
        let dec = Decimal::from_str(&format!("{:.6}", lat)).unwrap();
        assert_eq!(dec.to_string(), "37.774900");

        // Negative longitude
        let lon = -122.4194;
        let dec = Decimal::from_str(&format!("{:.6}", lon)).unwrap();
        assert_eq!(dec.to_string(), "-122.419400");

        // Zero
        let zero = 0.0_f64;
        let dec = Decimal::from_str(&format!("{:.6}", zero)).unwrap();
        assert_eq!(dec.to_string(), "0.000000");
    }
}
