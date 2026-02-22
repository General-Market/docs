//! NWS Severe Weather Alerts implementing MarketDataSource
//!
//! Tracks active weather alerts/warnings from the National Weather Service.
//! Fundamentally different from Open-Meteo (forecasts) — NWS provides
//! official discrete warning events with severity, urgency, and certainty.
//!
//! API: https://api.weather.gov/alerts/active
//! Auth: User-Agent header only (no key)
//! Rate limit: ~30 req/min (be polite to gov API)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{info, warn};

use crate::market_data::sources::error::SourceError;
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate,
};
use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};

const ASSET_JSON: &str = include_str!("../../../config/weather_alerts.json");
const API_URL: &str = "https://api.weather.gov/alerts/active?status=actual&message_type=alert";
const USER_AGENT: &str = "IndexDataNode/1.0 (market data indexer; contact@agiarena.org)";

/// Severity numeric mapping: Unknown=0, Minor=1, Moderate=2, Severe=3, Extreme=4
fn severity_to_numeric(severity: &str) -> u32 {
    match severity {
        "Minor" => 1,
        "Moderate" => 2,
        "Severe" => 3,
        "Extreme" => 4,
        _ => 0,
    }
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
struct AlertsResponse {
    features: Vec<AlertFeature>,
}

#[derive(Debug, Deserialize)]
struct AlertFeature {
    properties: AlertProperties,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AlertProperties {
    event: Option<String>,
    severity: Option<String>,
    #[allow(dead_code)]
    urgency: Option<String>,
    #[allow(dead_code)]
    certainty: Option<String>,
    area_desc: Option<String>,
}

// ============================================================================
// REGION MAPPING
// ============================================================================

/// US regions mapped from state names found in NWS areaDesc field.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum UsRegion {
    Northeast,
    Southeast,
    Midwest,
    Southwest,
    Northwest,
}

/// Map a state name to its US region. Returns None if not a recognized US state.
fn state_to_region(state: &str) -> Option<UsRegion> {
    match state {
        // Northeast
        "Connecticut" | "CT" | "Delaware" | "DE" | "Maine" | "ME" | "Maryland" | "MD"
        | "Massachusetts" | "MA" | "New Hampshire" | "NH" | "New Jersey" | "NJ" | "New York"
        | "NY" | "Pennsylvania" | "PA" | "Rhode Island" | "RI" | "Vermont" | "VT" => {
            Some(UsRegion::Northeast)
        }
        // Southeast
        "Alabama" | "AL" | "Arkansas" | "AR" | "Florida" | "FL" | "Georgia" | "GA"
        | "Kentucky" | "KY" | "Louisiana" | "LA" | "Mississippi" | "MS" | "North Carolina"
        | "NC" | "South Carolina" | "SC" | "Tennessee" | "TN" | "Virginia" | "VA"
        | "West Virginia" | "WV" => Some(UsRegion::Southeast),
        // Midwest
        "Illinois" | "IL" | "Indiana" | "IN" | "Iowa" | "IA" | "Kansas" | "KS" | "Michigan"
        | "MI" | "Minnesota" | "MN" | "Missouri" | "MO" | "Nebraska" | "NE" | "North Dakota"
        | "ND" | "Ohio" | "OH" | "South Dakota" | "SD" | "Wisconsin" | "WI" => {
            Some(UsRegion::Midwest)
        }
        // Southwest
        "Arizona" | "AZ" | "New Mexico" | "NM" | "Oklahoma" | "OK" | "Texas" | "TX" => {
            Some(UsRegion::Southwest)
        }
        // Northwest
        "Alaska" | "AK" | "Colorado" | "CO" | "Hawaii" | "HI" | "Idaho" | "ID" | "Montana"
        | "MT" | "Nevada" | "NV" | "Oregon" | "OR" | "Utah" | "UT" | "Washington" | "WA"
        | "Wyoming" | "WY" | "California" | "CA" => Some(UsRegion::Northwest),
        _ => None,
    }
}

/// Extract state names from an NWS areaDesc string.
/// The areaDesc field contains descriptions like "Los Angeles, CA; San Francisco, CA"
/// or "Cook County, IL; Lake County, IN". We look for two-letter state abbreviations
/// and full state names.
fn extract_regions_from_area_desc(area_desc: &str) -> Vec<UsRegion> {
    let mut regions = Vec::new();

    // Split by semicolons and commas, then check each token
    for part in area_desc.split(';') {
        let part = part.trim();
        // Try to find a two-letter state abbreviation at the end
        // NWS often uses "County, ST" format
        let tokens: Vec<&str> = part.split(',').collect();
        for token in &tokens {
            let token = token.trim();
            // Check if the token is a state abbreviation (2 uppercase letters)
            if token.len() == 2 && token.chars().all(|c| c.is_ascii_uppercase()) {
                if let Some(region) = state_to_region(token) {
                    regions.push(region);
                }
            }
            // Also check full state names
            if let Some(region) = state_to_region(token) {
                regions.push(region);
            }
        }
    }

    regions.dedup();
    regions
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

pub struct WeatherAlertsMarketSource {
    http: SourceHttpClient,
}

impl WeatherAlertsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("NWS Weather Alerts source initialized");
        Ok(Self { http })
    }

    async fn fetch_alerts(&self) -> Result<AlertsResponse, SourceError> {
        self.http
            .get_json_with_headers::<AlertsResponse>(
                API_URL,
                &[
                    ("User-Agent", USER_AGENT),
                    ("Accept", "application/geo+json"),
                ],
            )
            .await
    }
}

#[async_trait::async_trait]
impl MarketDataSource for WeatherAlertsMarketSource {
    fn source_id(&self) -> &'static str {
        "weather_alerts"
    }

    fn display_name(&self) -> &'static str {
        "NWS Severe Weather"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(300) // 5 minutes
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 20,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        load_assets_from_json(ASSET_JSON)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Fetch all active alerts in one request
        let alerts = match self.fetch_alerts().await {
            Ok(resp) => resp.features,
            Err(e) => {
                warn!("Failed to fetch NWS alerts: {:?}", e);
                Vec::new()
            }
        };

        // Count alerts by event type and by region
        let mut event_counts: HashMap<String, u32> = HashMap::new();
        let mut region_counts: HashMap<UsRegion, u32> = HashMap::new();
        let mut max_severity: u32 = 0;

        for alert in &alerts {
            if let Some(event) = &alert.properties.event {
                *event_counts.entry(event.clone()).or_insert(0) += 1;
            }
            if let Some(severity) = &alert.properties.severity {
                let sev_num = severity_to_numeric(severity);
                if sev_num > max_severity {
                    max_severity = sev_num;
                }
            }
            // Count by region from areaDesc
            if let Some(area_desc) = &alert.properties.area_desc {
                let regions = extract_regions_from_area_desc(area_desc);
                for region in regions {
                    *region_counts.entry(region).or_insert(0) += 1;
                }
            }
        }

        let total_alerts = alerts.len() as u32;

        // Build results
        let mut results = Vec::new();

        for asset_id in asset_ids {
            // Load the asset's api_ref from config
            let api_ref = get_api_ref(asset_id);

            let value = match api_ref.as_str() {
                "_total" => Decimal::from(total_alerts),
                "_max_severity" => Decimal::from(max_severity),
                "_region_northeast" => {
                    Decimal::from(region_counts.get(&UsRegion::Northeast).copied().unwrap_or(0))
                }
                "_region_southeast" => {
                    Decimal::from(region_counts.get(&UsRegion::Southeast).copied().unwrap_or(0))
                }
                "_region_midwest" => {
                    Decimal::from(region_counts.get(&UsRegion::Midwest).copied().unwrap_or(0))
                }
                "_region_southwest" => {
                    Decimal::from(region_counts.get(&UsRegion::Southwest).copied().unwrap_or(0))
                }
                "_region_northwest" => {
                    Decimal::from(region_counts.get(&UsRegion::Northwest).copied().unwrap_or(0))
                }
                event_type => {
                    let count = event_counts.get(event_type).copied().unwrap_or(0);
                    Decimal::from(count)
                }
            };

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("NWS/{}", asset_id.strip_prefix("nws_").unwrap_or(asset_id).to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} weather alert metrics ({} total active alerts)",
            results.len(),
            asset_ids.len(),
            total_alerts
        );

        Ok(results)
    }
}

/// Get the api_ref for an asset_id by looking it up in the compiled JSON config.
fn get_api_ref(asset_id: &str) -> String {
    // Parse the config JSON to find the api_ref for this asset_id
    let entries: Vec<serde_json::Value> = serde_json::from_str(ASSET_JSON).unwrap_or_default();
    for entry in &entries {
        if entry.get("asset_id").and_then(|v| v.as_str()) == Some(asset_id) {
            return entry
                .get("api_ref")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
        }
    }
    // Fallback: try to derive event type from asset_id
    asset_id.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 20, "Expected 20 weather alert types");
    }

    #[test]
    fn test_severity_mapping() {
        assert_eq!(severity_to_numeric("Minor"), 1);
        assert_eq!(severity_to_numeric("Moderate"), 2);
        assert_eq!(severity_to_numeric("Severe"), 3);
        assert_eq!(severity_to_numeric("Extreme"), 4);
        assert_eq!(severity_to_numeric("Unknown"), 0);
    }

    #[test]
    fn test_api_ref_lookup() {
        assert_eq!(get_api_ref("nws_tornado_warning"), "Tornado Warning");
        assert_eq!(get_api_ref("nws_total_active"), "_total");
        assert_eq!(get_api_ref("nws_max_severity"), "_max_severity");
        assert_eq!(get_api_ref("nws_region_northeast"), "_region_northeast");
        assert_eq!(get_api_ref("nws_region_southeast"), "_region_southeast");
        assert_eq!(get_api_ref("nws_region_midwest"), "_region_midwest");
        assert_eq!(get_api_ref("nws_region_southwest"), "_region_southwest");
        assert_eq!(get_api_ref("nws_region_northwest"), "_region_northwest");
    }

    #[test]
    fn test_all_categories_valid() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(entry.category, "environment");
            assert_eq!(entry.subcategory, "weather_alerts");
        }
    }

    #[test]
    fn test_state_to_region() {
        assert_eq!(state_to_region("NY"), Some(UsRegion::Northeast));
        assert_eq!(state_to_region("New York"), Some(UsRegion::Northeast));
        assert_eq!(state_to_region("FL"), Some(UsRegion::Southeast));
        assert_eq!(state_to_region("Florida"), Some(UsRegion::Southeast));
        assert_eq!(state_to_region("IL"), Some(UsRegion::Midwest));
        assert_eq!(state_to_region("Illinois"), Some(UsRegion::Midwest));
        assert_eq!(state_to_region("TX"), Some(UsRegion::Southwest));
        assert_eq!(state_to_region("Texas"), Some(UsRegion::Southwest));
        assert_eq!(state_to_region("WA"), Some(UsRegion::Northwest));
        assert_eq!(state_to_region("Washington"), Some(UsRegion::Northwest));
        assert_eq!(state_to_region("California"), Some(UsRegion::Northwest));
        assert_eq!(state_to_region("XX"), None);
    }

    #[test]
    fn test_extract_regions_from_area_desc() {
        // Typical NWS format: "Cook County, IL; Lake County, IN"
        let regions = extract_regions_from_area_desc("Cook County, IL; Lake County, IN");
        assert!(regions.contains(&UsRegion::Midwest));

        // "Los Angeles, CA"
        let regions = extract_regions_from_area_desc("Los Angeles, CA");
        assert!(regions.contains(&UsRegion::Northwest));

        // "Miami-Dade, FL; Broward, FL"
        let regions = extract_regions_from_area_desc("Miami-Dade, FL; Broward, FL");
        assert!(regions.contains(&UsRegion::Southeast));

        // Empty string
        let regions = extract_regions_from_area_desc("");
        assert!(regions.is_empty());
    }
}
