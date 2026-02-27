//! FAA Airport Delays client implementing MarketDataSource
//!
//! Tracks US airport delay status from the FAA NAS Status API.
//! Each airport is an asset; its value is 0 (no delay) or 1 (delay active).
//!
//! Assets are static -- defined in config/faa_delays.json (~30 major airports).
//!
//! Strategy: ONE call to the XML endpoint fetches all current delays/closures,
//! then we check each tracked airport against the delayed set.
//!
//! API: https://nasstatus.faa.gov/api/airport-status-information
//! Auth: None
//! Rate limit: None documented (US government)
//! Format: XML (parsed via string matching -- no XML crate dependency needed)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

// ============================================================================
// CONSTANTS
// ============================================================================

/// Asset configuration -- 30 major US airports
const ASSET_JSON: &str = include_str!("../../../config/faa_delays.json");

/// FAA NAS Status API endpoint (returns XML with all delays/closures)
const API_URL: &str = "https://nasstatus.faa.gov/api/airport-status-information";

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// FAA Airport Delays market data source.
///
/// Tracks delay status for ~30 major US airports via the FAA NAS Status API.
/// Source ID is `"faa_delays"`.
pub struct FaaDelaysMarketSource {
    http: SourceHttpClient,
}

impl FaaDelaysMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 10,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("FAA Airport Delays source initialized (NAS Status API)");
        Ok(Self { http })
    }

    /// Extract all airport IATA codes mentioned in the XML delay/closure data.
    /// Parses <ARPT>XXX</ARPT> tags from the XML response.
    fn extract_delayed_airports(xml: &str) -> HashSet<String> {
        let mut delayed = HashSet::new();
        let tag = "<ARPT>";
        let end_tag = "</ARPT>";

        let mut search_pos = 0;
        while let Some(start) = xml[search_pos..].find(tag) {
            let abs_start = search_pos + start + tag.len();
            if let Some(end) = xml[abs_start..].find(end_tag) {
                let code = xml[abs_start..abs_start + end].trim();
                if !code.is_empty() && code.len() <= 4 {
                    delayed.insert(code.to_uppercase());
                }
                search_pos = abs_start + end + end_tag.len();
            } else {
                break;
            }
        }

        delayed
    }
}

#[async_trait::async_trait]
impl MarketDataSource for FaaDelaysMarketSource {
    fn source_id(&self) -> &'static str {
        "faa_delays"
    }

    fn display_name(&self) -> &'static str {
        "FAA Airport Delays"
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
        info!(
            "FAA Delays fetch_assets: {} airports loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get IATA codes from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, String> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), e.api_ref.clone()))
            .collect();

        // ONE call to get all current delays/closures as XML
        let xml = match self.http.get_raw(API_URL).await {
            Ok(text) => text,
            Err(e) => {
                warn!("FAA: failed to fetch NAS status: {:?}", e);
                return Ok(Vec::new());
            }
        };

        // Extract set of all currently delayed/closed airports
        let delayed_airports = Self::extract_delayed_airports(&xml);
        debug!(
            "FAA: {} airports with active delays/closures: {:?}",
            delayed_airports.len(),
            delayed_airports
        );

        // Check each tracked airport against the delayed set
        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let iata = match ref_map.get(asset_id) {
                Some(code) => code,
                None => {
                    warn!("No api_ref (IATA code) for asset {}", asset_id);
                    continue;
                }
            };

            let has_delay = delayed_airports.contains(&iata.to_uppercase());
            let value = if has_delay {
                Decimal::from(1)
            } else {
                Decimal::ZERO
            };

            debug!("FAA {} delay={}", iata, has_delay);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("FAA/{}", iata.to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from FAA (1 XML call, {} airports delayed)",
            results.len(),
            asset_ids.len(),
            delayed_airports.len()
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
            entries.len() >= 25,
            "Expected >= 25 airport entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 25,
            "Expected >= 25 active airport assets, got {}",
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
                entry.subcategory, "airport",
                "Entry {} should have airport subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("faa_delays_"),
                "Asset ID {} should start with 'faa_delays_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_faa() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("FAA/"),
                "Symbol '{}' should start with 'FAA/'",
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
    fn test_unique_iata_codes() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        refs.dedup();
        assert_eq!(
            refs.len(),
            entries.len(),
            "All IATA codes (api_ref) should be unique"
        );
    }

    #[test]
    fn test_iata_codes_are_uppercase_3char() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.api_ref.len(),
                3,
                "IATA code '{}' for {} should be 3 characters",
                entry.api_ref,
                entry.asset_id
            );
            assert!(
                entry.api_ref.chars().all(|c| c.is_ascii_uppercase()),
                "IATA code '{}' for {} should be all uppercase ASCII",
                entry.api_ref,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_known_airports_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let iata_codes: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(iata_codes.contains(&"JFK"), "JFK should be present");
        assert!(iata_codes.contains(&"LAX"), "LAX should be present");
        assert!(iata_codes.contains(&"ORD"), "ORD should be present");
        assert!(iata_codes.contains(&"ATL"), "ATL should be present");
        assert!(iata_codes.contains(&"SFO"), "SFO should be present");
        assert!(iata_codes.contains(&"DEN"), "DEN should be present");
    }

    #[test]
    fn test_entry_count() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(
            entries.len(),
            30,
            "Expected exactly 30 airport entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_extract_delayed_airports_basic() {
        let xml = r#"<AIRPORT_STATUS_INFORMATION>
            <Delay_type><Name>Ground Delay Programs</Name>
            <Ground_Delay_List>
                <Ground_Delay><ARPT>JFK</ARPT><Reason>snow</Reason></Ground_Delay>
                <Ground_Delay><ARPT>ORD</ARPT><Reason>wind</Reason></Ground_Delay>
            </Ground_Delay_List></Delay_type>
            <Delay_type><Name>General Arrival/Departure Delay Info</Name>
            <Arrival_Departure_Delay_List>
                <Delay><ARPT>DEN</ARPT><Reason>WX:Wind</Reason></Delay>
            </Arrival_Departure_Delay_List></Delay_type>
        </AIRPORT_STATUS_INFORMATION>"#;

        let delayed = FaaDelaysMarketSource::extract_delayed_airports(xml);
        assert!(delayed.contains("JFK"), "JFK should be delayed");
        assert!(delayed.contains("ORD"), "ORD should be delayed");
        assert!(delayed.contains("DEN"), "DEN should be delayed");
        assert!(!delayed.contains("LAX"), "LAX should NOT be delayed");
        assert_eq!(delayed.len(), 3);
    }

    #[test]
    fn test_extract_delayed_airports_closures() {
        let xml = r#"<Delay_type><Name>Airport Closures</Name>
            <Airport_Closure_List>
                <Airport><ARPT>MVY</ARPT><Reason>closed</Reason></Airport>
                <Airport><ARPT>SNA</ARPT><Reason>closed</Reason></Airport>
            </Airport_Closure_List></Delay_type>"#;

        let delayed = FaaDelaysMarketSource::extract_delayed_airports(xml);
        assert!(delayed.contains("MVY"));
        assert!(delayed.contains("SNA"));
        assert_eq!(delayed.len(), 2);
    }

    #[test]
    fn test_extract_delayed_airports_empty() {
        let xml = r#"<AIRPORT_STATUS_INFORMATION>
            <Update_Time>Mon Jan 01 00:00:00 2024 GMT</Update_Time>
        </AIRPORT_STATUS_INFORMATION>"#;

        let delayed = FaaDelaysMarketSource::extract_delayed_airports(xml);
        assert!(delayed.is_empty(), "No delays should produce empty set");
    }

    #[test]
    fn test_extract_delayed_airports_duplicates() {
        // Airport can appear in multiple delay types
        let xml = r#"<Ground_Delay><ARPT>JFK</ARPT></Ground_Delay>
            <Delay><ARPT>JFK</ARPT></Delay>
            <Airport><ARPT>JFK</ARPT></Airport>"#;

        let delayed = FaaDelaysMarketSource::extract_delayed_airports(xml);
        assert!(delayed.contains("JFK"));
        assert_eq!(delayed.len(), 1, "Duplicates should be deduplicated");
    }
}
