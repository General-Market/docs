//! USGS Volcanoes client implementing MarketDataSource
//!
//! Tracks volcanic alert levels from the USGS Volcano Hazards Program.
//! Each volcano is an asset; its value is the numeric alert level:
//! Normal=0, Advisory=1, Watch=2, Warning=3.
//!
//! **KNOWN LIMITATION:** The USGS /elevated endpoint only covers US volcanoes
//! (Hawaii, Alaska, Cascades, Yellowstone). Non-US volcanoes in our config
//! (Etna, Fuji, Merapi, Eyjafjallajokull, etc.) will ALWAYS report Normal (0)
//! regardless of actual activity. To fix this, we need to integrate the
//! Smithsonian GVP (Global Volcanism Program) VONA/weekly report feed.
//!
//! Assets are static — defined in config/volcano.json (~50 volcanoes).
//!
//! API: https://volcanoes.usgs.gov/vsc/api/volcanoApi
//! Auth: None
//! Rate limit: 30 req/min (government API, generous)

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
    load_assets_from_json, AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate,
};

/// Asset configuration
const ASSET_JSON: &str = include_str!("../../../config/volcano.json");

/// USGS Volcano API base URL
const API_URL: &str = "https://volcanoes.usgs.gov/vsc/api/volcanoApi";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/// A volcano entry from the USGS elevated alert API
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsgsVolcano {
    /// Volcano name (e.g., "Kilauea")
    #[serde(rename = "vName")]
    v_name: String,
    /// Alert level: Normal, Advisory, Watch, Warning
    #[serde(rename = "vAlertLevel")]
    v_alert_level: String,
    /// Color code: Green, Yellow, Orange, Red
    #[serde(rename = "vColorCode")]
    #[allow(dead_code)]
    v_color_code: String,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// USGS Volcanoes market data source.
///
/// Tracks volcanic alert levels for ~50 notable volcanoes.
/// Source ID is `"volcano"`.
pub struct VolcanoMarketSource {
    http: SourceHttpClient,
}

impl VolcanoMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 30,
                duration: Duration::from_secs(60),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());

        info!("USGS Volcanoes source initialized");

        Ok(Self { http })
    }
}

#[async_trait::async_trait]
impl MarketDataSource for VolcanoMarketSource {
    fn source_id(&self) -> &'static str {
        "volcano"
    }

    fn display_name(&self) -> &'static str {
        "USGS Volcanoes"
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
        info!("Volcano fetch_assets: {} assets loaded from config", assets.len());
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

        // Fetch elevated volcanoes from USGS API
        let url = format!("{}/elevated", API_URL);
        let elevated: Vec<UsgsVolcano> = match self.http.get_json(&url).await {
            Ok(data) => data,
            Err(e) => {
                warn!("Error fetching USGS volcano data: {:?}", e);
                // On error, return all zeros (Normal) rather than failing
                Vec::new()
            }
        };

        // Build lookup map: normalized volcano name -> alert level numeric
        let mut alert_map: HashMap<String, Decimal> = HashMap::new();
        for volcano in &elevated {
            let key = normalize_volcano_name(&volcano.v_name);
            let level = alert_to_numeric(&volcano.v_alert_level);
            debug!(
                "Elevated volcano: {} ({}) -> alert={} ({})",
                volcano.v_name, key, volcano.v_alert_level, level
            );
            alert_map.insert(key, level);
        }

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            // Extract volcano name from asset_id (strip "volcano_" prefix)
            let volcano_key = asset_id.strip_prefix("volcano_").unwrap_or(asset_id);

            // Look up alert level; default to 0 (Normal) if not in elevated list
            let value = alert_map
                .get(volcano_key)
                .copied()
                .unwrap_or(Decimal::ZERO);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: format!("VOLC/{}", volcano_key.to_uppercase()),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        info!(
            "Fetched {}/{} prices from USGS Volcanoes ({} elevated)",
            results.len(),
            asset_ids.len(),
            elevated.len()
        );

        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::ENVIRONMENTAL
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Convert a USGS volcano name to our normalized form.
/// Lowercases, removes periods and apostrophes, and replaces spaces/hyphens
/// with underscores. E.g., "Mount St. Helens" -> "mount_st_helens".
fn normalize_volcano_name(name: &str) -> String {
    name.to_lowercase()
        .replace('.', "")
        .replace('\'', "")
        .replace(' ', "_")
        .replace('-', "_")
}

/// Convert alert level string to numeric value.
/// Normal=0, Advisory=1, Watch=2, Warning=3
fn alert_to_numeric(level: &str) -> Decimal {
    match level {
        "Normal" => Decimal::ZERO,
        "Advisory" => Decimal::from(1),
        "Watch" => Decimal::from(2),
        "Warning" => Decimal::from(3),
        _ => {
            warn!("Unknown volcano alert level: {}", level);
            Decimal::ZERO
        }
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
            entries.len() >= 40,
            "Expected >= 40 volcano entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 40,
            "Expected >= 40 active volcano assets, got {}",
            assets.len()
        );
    }

    #[test]
    fn test_config_has_exactly_50_entries() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 50);
    }

    #[test]
    fn test_all_entries_active() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(entry.active, "Entry {} should be active", entry.asset_id);
        }
    }

    #[test]
    fn test_all_entries_geophysical_category() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert_eq!(
                entry.category, "geophysical",
                "Entry {} should have geophysical category",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "volcano",
                "Entry {} should have volcano subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("volcano_"),
                "Asset ID {} should start with 'volcano_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_alert_to_numeric() {
        assert_eq!(alert_to_numeric("Normal"), Decimal::ZERO);
        assert_eq!(alert_to_numeric("Advisory"), Decimal::from(1));
        assert_eq!(alert_to_numeric("Watch"), Decimal::from(2));
        assert_eq!(alert_to_numeric("Warning"), Decimal::from(3));
        assert_eq!(alert_to_numeric("Unknown"), Decimal::ZERO);
    }

    #[test]
    fn test_normalize_volcano_name() {
        assert_eq!(normalize_volcano_name("Kilauea"), "kilauea");
        assert_eq!(normalize_volcano_name("Mauna Loa"), "mauna_loa");
        assert_eq!(normalize_volcano_name("Mount St. Helens"), "mount_st_helens");
        assert_eq!(normalize_volcano_name("Ol Doinyo Lengai"), "ol_doinyo_lengai");
        assert_eq!(normalize_volcano_name("Piton de la Fournaise"), "piton_de_la_fournaise");
    }

    #[test]
    fn test_normalize_volcano_name_hyphens() {
        assert_eq!(normalize_volcano_name("Some-Volcano"), "some_volcano");
        assert_eq!(normalize_volcano_name("Already_normalized"), "already_normalized");
    }

    #[test]
    fn test_normalize_volcano_name_periods_and_apostrophes() {
        // Periods should be removed
        assert_eq!(normalize_volcano_name("Mt. Rainier"), "mt_rainier");
        assert_eq!(normalize_volcano_name("St. Augustine"), "st_augustine");
        // Apostrophes should be removed
        assert_eq!(normalize_volcano_name("Ol'Doinyo"), "oldoinyo");
        // Combined
        assert_eq!(normalize_volcano_name("Mt. O'Brien"), "mt_obrien");
    }

    #[test]
    fn test_known_volcanoes_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"volcano_kilauea"));
        assert!(ids.contains(&"volcano_etna"));
        assert!(ids.contains(&"volcano_yellowstone"));
        assert!(ids.contains(&"volcano_fuji"));
        assert!(ids.contains(&"volcano_eyjafjallajokull"));
    }
}
