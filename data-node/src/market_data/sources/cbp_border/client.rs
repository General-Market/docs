//! CBP Border Wait Times client implementing MarketDataSource
//!
//! Tracks US border crossing wait times from CBP (Customs and Border Protection).
//! Each crossing is an asset; its value is the passenger vehicle delay in minutes.
//!
//! **Dynamic discovery** — fetch_assets() calls the API and returns ALL ports (~102).
//! Single API call returns everything (Pattern A), so adding more ports costs nothing.
//!
//! API: https://bwt.cbp.gov/api/waittimes
//! Auth: None
//! Rate limit: None (US government API)

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{AssetUpdate, MarketDataSource, PriceUpdate};

const API_URL: &str = "https://bwt.cbp.gov/api/waittimes";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// A single port entry from the CBP wait times API.
///
/// NOTE: The CBP API returns ALL numeric fields as JSON strings (e.g. "45" not 45),
/// and empty strings for absent values. We use `serde(default)` and custom parsing
/// to handle this gracefully.
#[derive(Debug, Deserialize)]
struct CbpPort {
    port_number: String,
    port_name: String,
    border: Option<String>,
    crossing_name: Option<String>,
    #[allow(dead_code)]
    port_status: Option<String>,
    #[serde(default)]
    passenger_vehicle_lanes: Option<CbpLaneGroup>,
    #[allow(dead_code)]
    #[serde(default)]
    pedestrian_lanes: Option<CbpLaneGroup>,
    #[allow(dead_code)]
    #[serde(default)]
    commercial_vehicle_lanes: Option<CbpLaneGroup>,
}

/// Lane group containing standard, NEXUS/SENTRI, and ready lanes.
/// Uses `serde(default)` for all fields since the API may omit them.
#[derive(Debug, Deserialize)]
struct CbpLaneGroup {
    #[serde(default)]
    standard_lanes: Option<CbpLane>,
    #[allow(dead_code)]
    #[serde(alias = "NEXUS_SENTRI_lanes", default)]
    nexus_sentri_lanes: Option<CbpLane>,
    #[allow(dead_code)]
    #[serde(default)]
    ready_lanes: Option<CbpLane>,
}

/// A single lane type with delay and lanes open.
///
/// The CBP API returns these as strings: "45" for 45 minutes, "" for no data.
/// We deserialize strings and parse to u64 via a helper.
#[derive(Debug, Deserialize)]
struct CbpLane {
    #[serde(default, deserialize_with = "deserialize_string_u64")]
    delay_minutes: Option<u64>,
    #[allow(dead_code)]
    #[serde(default, deserialize_with = "deserialize_string_u64")]
    lanes_open: Option<u64>,
}

/// Deserialize a numeric string (or empty string) into Option<u64>.
/// CBP API sends "45" or "" for numeric fields.
fn deserialize_string_u64<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s: Option<String> = Option::deserialize(deserializer)?;
    match s {
        Some(ref val) if !val.is_empty() => match val.parse::<u64>() {
            Ok(n) => Ok(Some(n)),
            Err(_) => Ok(None),
        },
        _ => Ok(None),
    }
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// CBP Border Wait Times market data source.
///
/// Dynamically discovers ALL US border crossings (~102 ports) from the API.
/// Source ID is `"cbp_border"`.
pub struct CbpBorderMarketSource {
    http: SourceHttpClient,
}

impl CbpBorderMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("CBP Border Wait Times source initialized (dynamic discovery)");
        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for CbpBorderMarketSource {
    fn source_id(&self) -> &'static str {
        "cbp_border"
    }

    fn display_name(&self) -> &'static str {
        "CBP Border Wait Times"
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
        // Dynamic discovery — fetch ALL ports from the API
        let ports: Vec<CbpPort> = match self.http.get_json(API_URL).await {
            Ok(data) => data,
            Err(e) => {
                warn!("Error fetching CBP ports for asset discovery: {:?}", e);
                return Ok(Vec::new());
            }
        };

        let mut seen = std::collections::HashSet::new();
        let mut assets = Vec::with_capacity(ports.len());

        for port in &ports {
            let asset_id = format!("cbp_border_{}", port.port_number);

            // Deduplicate (API sometimes returns duplicate port_numbers)
            if !seen.insert(asset_id.clone()) {
                continue;
            }

            let border_label = port.border.as_deref().unwrap_or("Unknown");
            let crossing = port
                .crossing_name
                .as_deref()
                .unwrap_or(&port.port_name);
            let display_name = format!("{} [{}]", crossing, border_label);

            assets.push(AssetUpdate {
                asset_id,
                symbol: format!("CBP/{}", normalize_port_name(&port.port_name)),
                name: display_name,
                category: Some("transport".to_string()),
                metadata: serde_json::json!({
                    "api_ref": port.port_number,
                    "subcategory": "border_crossing",
                    "active": true,
                    "extra": {
                        "border": border_label,
                        "port_name": port.port_name,
                        "crossing_name": port.crossing_name,
                    },
                }),
            });
        }

        info!(
            "CBP Border fetch_assets: {} crossings discovered from API",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Single API call — fetch all border wait times
        let ports: Vec<CbpPort> = match self.http.get_json(API_URL).await {
            Ok(data) => data,
            Err(e) => {
                warn!("Error fetching CBP border wait times: {:?}", e);
                return Ok(Vec::new());
            }
        };

        // Build lookup: "cbp_border_{port_number}" -> delay_minutes
        let mut delay_map: HashMap<String, u64> = HashMap::new();
        let mut name_map: HashMap<String, String> = HashMap::new();
        for port in &ports {
            let key = format!("cbp_border_{}", port.port_number);
            let delay = port
                .passenger_vehicle_lanes
                .as_ref()
                .and_then(|lanes| lanes.standard_lanes.as_ref())
                .and_then(|lane| lane.delay_minutes)
                .unwrap_or(0);
            delay_map.insert(key.clone(), delay);
            name_map.insert(key, port.port_name.clone());
        }

        let mut results = Vec::with_capacity(asset_ids.len());
        for asset_id in asset_ids {
            let delay = delay_map.get(asset_id).copied().unwrap_or(0);
            let port_name = name_map
                .get(asset_id)
                .map(|n| normalize_port_name(n))
                .unwrap_or_else(|| {
                    asset_id
                        .strip_prefix("cbp_border_")
                        .unwrap_or(asset_id)
                        .to_uppercase()
                });

            debug!("CBP {} ({}): {} min delay", asset_id, port_name, delay);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("CBP/{}", port_name),
                value: Decimal::from(delay),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from CBP Border ({} ports in API response)",
            results.len(),
            asset_ids.len(),
            ports.len()
        );
        Ok(results)
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Normalize a port name into a short uppercase symbol.
/// E.g., "San Ysidro" -> "SAN_YSIDRO"
fn normalize_port_name(name: &str) -> String {
    name.to_uppercase()
        .replace([' ', '-'], "_")
        .replace(['.', '\'', ',', '(', ')'], "")
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_port_name() {
        assert_eq!(normalize_port_name("San Ysidro"), "SAN_YSIDRO");
        assert_eq!(normalize_port_name("El Paso"), "EL_PASO");
        assert_eq!(normalize_port_name("Sault Ste. Marie"), "SAULT_STE_MARIE");
        assert_eq!(normalize_port_name("Peace Bridge"), "PEACE_BRIDGE");
    }

    #[test]
    fn test_cbp_port_deserialization() {
        // Real CBP API returns ALL numeric values as strings
        let json = r#"[{
            "port_number": "250401",
            "port_name": "San Ysidro",
            "border": "US-Mexico",
            "crossing_name": "San Ysidro",
            "port_status": "Open",
            "passenger_vehicle_lanes": {
                "maximum_lanes": "20",
                "standard_lanes": {
                    "update_time": "At Noon PST",
                    "operational_status": "delay",
                    "delay_minutes": "45",
                    "lanes_open": "12"
                },
                "NEXUS_SENTRI_lanes": {
                    "update_time": "At Noon PST",
                    "operational_status": "no delay",
                    "delay_minutes": "10",
                    "lanes_open": "3"
                },
                "ready_lanes": {
                    "update_time": "",
                    "operational_status": "N/A",
                    "delay_minutes": "",
                    "lanes_open": ""
                }
            },
            "pedestrian_lanes": {
                "maximum_lanes": "5",
                "standard_lanes": {
                    "update_time": "",
                    "operational_status": "N/A",
                    "delay_minutes": "",
                    "lanes_open": ""
                }
            },
            "commercial_vehicle_lanes": {
                "maximum_lanes": "8",
                "standard_lanes": {
                    "update_time": "At Noon PST",
                    "operational_status": "no delay",
                    "delay_minutes": "15",
                    "lanes_open": "8"
                }
            }
        }]"#;

        let ports: Vec<CbpPort> = serde_json::from_str(json).unwrap();
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].port_number, "250401");
        assert_eq!(ports[0].port_name, "San Ysidro");

        let delay = ports[0]
            .passenger_vehicle_lanes
            .as_ref()
            .and_then(|lanes| lanes.standard_lanes.as_ref())
            .and_then(|lane| lane.delay_minutes)
            .unwrap_or(0);
        assert_eq!(delay, 45);
    }

    #[test]
    fn test_cbp_port_empty_string_delay() {
        // CBP API returns "" for absent numeric values, not null
        let json = r#"[{
            "port_number": "999999",
            "port_name": "Closed Port",
            "port_status": "Closed",
            "passenger_vehicle_lanes": {
                "maximum_lanes": "0",
                "standard_lanes": {
                    "update_time": "",
                    "operational_status": "N/A",
                    "delay_minutes": "",
                    "lanes_open": ""
                }
            }
        }]"#;

        let ports: Vec<CbpPort> = serde_json::from_str(json).unwrap();
        assert_eq!(ports.len(), 1);

        let delay = ports[0]
            .passenger_vehicle_lanes
            .as_ref()
            .and_then(|lanes| lanes.standard_lanes.as_ref())
            .and_then(|lane| lane.delay_minutes)
            .unwrap_or(0);
        assert_eq!(delay, 0, "Empty string delay should parse as None -> default 0");
    }

    #[test]
    fn test_cbp_port_missing_lanes() {
        let json = r#"[{
            "port_number": "999999",
            "port_name": "Closed Port",
            "port_status": "Closed"
        }]"#;

        let ports: Vec<CbpPort> = serde_json::from_str(json).unwrap();
        assert_eq!(ports.len(), 1);

        let delay = ports[0]
            .passenger_vehicle_lanes
            .as_ref()
            .and_then(|lanes| lanes.standard_lanes.as_ref())
            .and_then(|lane| lane.delay_minutes)
            .unwrap_or(0);
        assert_eq!(delay, 0, "Missing lanes should default to 0 delay");
    }

    #[test]
    fn test_asset_id_from_port_number() {
        let port_number = "250401";
        let asset_id = format!("cbp_border_{}", port_number);
        assert_eq!(asset_id, "cbp_border_250401");
        assert!(asset_id.starts_with("cbp_border_"));
    }

    #[test]
    fn test_dynamic_asset_building() {
        let json = r#"[
            {"port_number": "250401", "port_name": "San Ysidro", "border": "US-Mexico", "crossing_name": "San Ysidro"},
            {"port_number": "040201", "port_name": "Buffalo-Niagara Falls", "border": "US-Canada", "crossing_name": "Peace Bridge"}
        ]"#;

        let ports: Vec<CbpPort> = serde_json::from_str(json).unwrap();
        assert_eq!(ports.len(), 2);

        // Simulate asset building
        let mut assets = Vec::new();
        for port in &ports {
            let asset_id = format!("cbp_border_{}", port.port_number);
            let border_label = port.border.as_deref().unwrap_or("Unknown");
            let crossing = port.crossing_name.as_deref().unwrap_or(&port.port_name);
            let display_name = format!("{} [{}]", crossing, border_label);
            assets.push((asset_id, display_name));
        }

        assert_eq!(assets[0].0, "cbp_border_250401");
        assert_eq!(assets[0].1, "San Ysidro [US-Mexico]");
        assert_eq!(assets[1].0, "cbp_border_040201");
        assert_eq!(assets[1].1, "Peace Bridge [US-Canada]");
    }

    #[test]
    fn test_deduplication() {
        let json = r#"[
            {"port_number": "250401", "port_name": "San Ysidro", "border": "US-Mexico"},
            {"port_number": "250401", "port_name": "San Ysidro Dup", "border": "US-Mexico"}
        ]"#;

        let ports: Vec<CbpPort> = serde_json::from_str(json).unwrap();
        let mut seen = std::collections::HashSet::new();
        let mut count = 0;
        for port in &ports {
            let asset_id = format!("cbp_border_{}", port.port_number);
            if seen.insert(asset_id) {
                count += 1;
            }
        }
        assert_eq!(count, 1, "Duplicate port_numbers should be deduplicated");
    }
}
