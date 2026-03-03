//! Deutsche Bahn train delays source implementing MarketDataSource
//!
//! Tracks average departure delay (in minutes) at ~58 major German train stations
//! using DB's internal IRIS-TTS API (free, no auth, highly reliable).
//!
//! Each station is an asset; its value is the average delay in minutes across
//! departures in the current hour. A value of 0.0 means all trains are on time.
//!
//! Assets are static -- defined in config/db_trains.json (58 stations).
//!
//! Strategy: Two API calls per station:
//!   1. /timetable/plan/{eva}/{YYMMdd/HH} → planned departure times
//!   2. /timetable/fchg/{eva} → changed (actual) departure times
//! Delay = changed_time - planned_time for each departure.
//!
//! Pattern B (grouped calls), ~116 calls per sync (2 per station).
//!
//! API: https://iris.noncd.db.de/iris-tts/timetable/
//! Auth: None
//! Rate limit: Undocumented (DB internal), conservative 200 req/5min

use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::sources::http_client::{RetryConfig, SourceHttpClient};
use crate::market_data::traits::{
    load_assets_from_json, AssetEntry, AssetUpdate, MarketDataSource, PriceUpdate,
};

const ASSET_JSON: &str = include_str!("../../../config/db_trains.json");

const IRIS_BASE: &str = "https://iris.noncd.db.de/iris-tts/timetable";

/// Delay between requests to individual stations (ms)
const INTER_REQUEST_DELAY: Duration = Duration::from_millis(200);

pub struct DbTrainsMarketSource {
    http: SourceHttpClient,
}

impl DbTrainsMarketSource {
    pub fn from_env() -> Result<Self> {
        let rate_limit = RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 200,
                duration: Duration::from_secs(300),
            }],
        };
        let http = SourceHttpClient::new(rate_limit, RetryConfig::default());
        info!("Deutsche Bahn train delays source initialized (IRIS-TTS API)");
        Ok(Self { http })
    }

    /// Parse planned departure times from the plan XML.
    /// Returns map: stop_id → planned_time (as YYMMddHHmm string)
    fn parse_plan_departures(xml: &str) -> HashMap<String, String> {
        let mut map = HashMap::new();
        // Each stop: <s id="..."> ... <dp pt="YYMMddHHmm" .../>
        let mut pos = 0;
        while let Some(s_start) = xml[pos..].find("<s id=\"") {
            let abs = pos + s_start + 7;
            let id_end = match xml[abs..].find('"') {
                Some(e) => e,
                None => break,
            };
            let stop_id = &xml[abs..abs + id_end];

            // Find end of this <s> element
            let s_end_pos = xml[abs..].find("</s>").unwrap_or(xml.len() - abs);
            let s_block = &xml[abs..abs + s_end_pos];

            // Look for <dp pt="YYMMddHHmm"
            if let Some(dp_pos) = s_block.find("<dp ") {
                let dp_block = &s_block[dp_pos..];
                if let Some(pt_pos) = dp_block.find("pt=\"") {
                    let pt_start = pt_pos + 4;
                    if let Some(pt_end) = dp_block[pt_start..].find('"') {
                        let pt = &dp_block[pt_start..pt_start + pt_end];
                        if pt.len() == 10 {
                            map.insert(stop_id.to_string(), pt.to_string());
                        }
                    }
                }
            }

            pos = abs + s_end_pos;
        }
        map
    }

    /// Parse changed departure times from the fchg XML.
    /// Returns map: stop_id → changed_time (as YYMMddHHmm string)
    fn parse_changed_departures(xml: &str) -> HashMap<String, String> {
        let mut map = HashMap::new();
        let mut pos = 0;
        while let Some(s_start) = xml[pos..].find("<s id=\"") {
            let abs = pos + s_start + 7;
            let id_end = match xml[abs..].find('"') {
                Some(e) => e,
                None => break,
            };
            let stop_id = &xml[abs..abs + id_end];

            let s_end_pos = xml[abs..].find("</s>").unwrap_or(xml.len() - abs);
            let s_block = &xml[abs..abs + s_end_pos];

            // Look for <dp ct="YYMMddHHmm" (ct = changed time)
            if let Some(dp_pos) = s_block.find("<dp ct=\"") {
                let ct_start = dp_pos + 8;
                if let Some(ct_end) = s_block[ct_start..].find('"') {
                    let ct = &s_block[ct_start..ct_start + ct_end];
                    if ct.len() == 10 {
                        map.insert(stop_id.to_string(), ct.to_string());
                    }
                }
            }

            pos = abs + s_end_pos;
        }
        map
    }

    /// Parse a YYMMddHHmm timestamp into minutes since midnight.
    fn parse_hhmm(ts: &str) -> Option<i64> {
        if ts.len() != 10 {
            return None;
        }
        let hh: i64 = ts[6..8].parse().ok()?;
        let mm: i64 = ts[8..10].parse().ok()?;
        Some(hh * 60 + mm)
    }

    /// Compute average delay for a station using IRIS plan + fchg endpoints.
    async fn fetch_station_delay(&self, station_id: &str) -> Result<Option<Decimal>> {
        let now = Utc::now();
        let hour_path = now.format("%y%m%d/%H").to_string();

        // 1. Fetch planned timetable for current hour
        let plan_url = format!("{}/plan/{}/{}", IRIS_BASE, station_id, hour_path);
        let plan_xml = match self.http.get_raw(&plan_url).await {
            Ok(text) => text,
            Err(e) => {
                warn!("DB Trains: plan fetch failed for {}: {:?}", station_id, e);
                return Ok(None);
            }
        };

        let planned = Self::parse_plan_departures(&plan_xml);
        if planned.is_empty() {
            return Ok(Some(Decimal::ZERO));
        }

        // 2. Fetch live changes (delays)
        let fchg_url = format!("{}/fchg/{}", IRIS_BASE, station_id);
        let fchg_xml = match self.http.get_raw(&fchg_url).await {
            Ok(text) => text,
            Err(e) => {
                warn!("DB Trains: fchg fetch failed for {}: {:?}", station_id, e);
                // No changes data → assume on time
                return Ok(Some(Decimal::ZERO));
            }
        };

        let changed = Self::parse_changed_departures(&fchg_xml);

        // 3. Compute average delay across departures that have changes
        let mut total_delay_mins: f64 = 0.0;
        let mut count = 0usize;

        for (stop_id, planned_ts) in &planned {
            let planned_mins = match Self::parse_hhmm(planned_ts) {
                Some(m) => m,
                None => continue,
            };

            if let Some(changed_ts) = changed.get(stop_id) {
                let changed_mins = match Self::parse_hhmm(changed_ts) {
                    Some(m) => m,
                    None => continue,
                };
                // Delay = changed - planned (can be negative for early trains)
                let delay = (changed_mins - planned_mins).max(0);
                total_delay_mins += delay as f64;
            }
            // No change entry → on time, contributes 0
            count += 1;
        }

        if count == 0 {
            return Ok(Some(Decimal::ZERO));
        }

        let avg = total_delay_mins / count as f64;
        let rounded = (avg * 10.0).round() / 10.0;
        Ok(Some(
            Decimal::from_f64_retain(rounded).unwrap_or(Decimal::ZERO),
        ))
    }
}

#[async_trait::async_trait]
impl MarketDataSource for DbTrainsMarketSource {
    fn source_id(&self) -> &'static str {
        "db_trains"
    }

    fn display_name(&self) -> &'static str {
        "Deutsche Bahn Train Delays"
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
                max_requests: 200,
                duration: Duration::from_secs(300),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let assets = load_assets_from_json(ASSET_JSON)?;
        info!(
            "DB Trains fetch_assets: {} stations loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();

        // Load config to get station IDs from api_ref
        let entries: Vec<AssetEntry> = serde_json::from_str(ASSET_JSON)?;
        let ref_map: HashMap<String, (String, String)> = entries
            .into_iter()
            .map(|e| (e.asset_id.clone(), (e.api_ref.clone(), e.symbol.clone())))
            .collect();

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let (station_id, symbol) = match ref_map.get(asset_id) {
                Some(pair) => pair,
                None => {
                    warn!("No api_ref (station ID) for asset {}", asset_id);
                    continue;
                }
            };

            match self.fetch_station_delay(station_id).await {
                Ok(Some(value)) => {
                    debug!("DB {} avg_delay={}min", station_id, value);
                    results.push(PriceUpdate {
                        asset_id: asset_id.clone(),
                        symbol: symbol.clone(),
                        value,
                        prev_close: None,
                        change_pct: None,
                        volume_24h: None,
                        market_cap: None,
                        fetched_at: now,
                    });
                }
                Ok(None) => {
                    debug!("DB {} skipped (no data)", station_id);
                }
                Err(e) => {
                    warn!("DB {} error: {:?}", station_id, e);
                }
            }

            tokio::time::sleep(INTER_REQUEST_DELAY).await;
        }

        info!(
            "Fetched {}/{} prices from Deutsche Bahn ({} station calls)",
            results.len(),
            asset_ids.len(),
            asset_ids.len()
        );
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::load_all_asset_entries;

    #[test]
    fn test_config_loads() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert_eq!(entries.len(), 58, "Expected 58 station entries");
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert_eq!(assets.len(), 58, "Expected 58 active station assets");
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
                "{} should be transport",
                entry.asset_id
            );
            assert_eq!(
                entry.subcategory, "rail",
                "{} should be rail subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("db_trains_"),
                "Asset ID {} should start with 'db_trains_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_symbols_start_with_db() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.symbol.starts_with("DB/"),
                "Symbol '{}' should start with 'DB/'",
                entry.symbol
            );
        }
    }

    #[test]
    fn test_unique_asset_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        ids.sort();
        let orig_len = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), orig_len, "All asset IDs should be unique");
    }

    #[test]
    fn test_unique_symbols() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut symbols: Vec<&str> = entries.iter().map(|e| e.symbol.as_str()).collect();
        symbols.sort();
        let orig_len = symbols.len();
        symbols.dedup();
        assert_eq!(symbols.len(), orig_len, "All symbols should be unique");
    }

    #[test]
    fn test_unique_station_ids() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let mut refs: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        refs.sort();
        let orig_len = refs.len();
        refs.dedup();
        assert_eq!(refs.len(), orig_len, "All station IDs should be unique");
    }

    #[test]
    fn test_station_ids_are_numeric() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.api_ref.chars().all(|c| c.is_ascii_digit()),
                "Station ID '{}' for {} should be all digits",
                entry.api_ref,
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_known_stations_present() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.api_ref.as_str()).collect();
        assert!(ids.contains(&"8011160"), "Berlin Hbf should be present");
        assert!(ids.contains(&"8000261"), "München Hbf should be present");
        assert!(ids.contains(&"8002549"), "Hamburg Hbf should be present");
        assert!(ids.contains(&"8000105"), "Frankfurt Hbf should be present");
    }

    #[test]
    fn test_parse_plan_departures() {
        let xml = r#"<?xml version='1.0' encoding='UTF-8'?><timetable station='Test'>
            <s id="abc-123"><dp pt="2603031520" pp="13"/></s>
            <s id="def-456"><ar pt="2603031510" pp="5"/><dp pt="2603031512" pp="5"/></s>
            <s id="ghi-789"><ar pt="2603031530" pp="2"/></s>
        </timetable>"#;

        let plan = DbTrainsMarketSource::parse_plan_departures(xml);
        assert_eq!(plan.len(), 2); // only 2 have <dp>
        assert_eq!(plan.get("abc-123").unwrap(), "2603031520");
        assert_eq!(plan.get("def-456").unwrap(), "2603031512");
        assert!(!plan.contains_key("ghi-789")); // arrival only
    }

    #[test]
    fn test_parse_changed_departures() {
        let xml = r#"<timetable station="Test" eva="8011160">
            <s id="abc-123" eva="8011160"><dp ct="2603031535"/></s>
            <s id="def-456" eva="8011160"><dp ct="2603031512"/></s>
        </timetable>"#;

        let changed = DbTrainsMarketSource::parse_changed_departures(xml);
        assert_eq!(changed.len(), 2);
        assert_eq!(changed.get("abc-123").unwrap(), "2603031535");
        assert_eq!(changed.get("def-456").unwrap(), "2603031512");
    }

    #[test]
    fn test_parse_hhmm() {
        assert_eq!(DbTrainsMarketSource::parse_hhmm("2603031520"), Some(15 * 60 + 20));
        assert_eq!(DbTrainsMarketSource::parse_hhmm("2603030000"), Some(0));
        assert_eq!(DbTrainsMarketSource::parse_hhmm("2603032359"), Some(23 * 60 + 59));
        assert_eq!(DbTrainsMarketSource::parse_hhmm("short"), None);
    }

    #[test]
    fn test_delay_calculation() {
        // Plan: 15:20, Changed: 15:35 → 15 min delay
        let planned = 15 * 60 + 20; // 920
        let changed = 15 * 60 + 35; // 935
        assert_eq!((changed - planned).max(0), 15);

        // Early train: Plan 15:20, Changed 15:18 → 0 (clamped)
        let changed_early = 15 * 60 + 18;
        assert_eq!((changed_early - planned).max(0), 0);
    }
}
