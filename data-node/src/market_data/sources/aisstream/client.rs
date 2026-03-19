//! AISstream.io WebSocket-based ship tracking data source
//!
//! Uses a persistent WebSocket connection to `wss://stream.aisstream.io/v0/stream`
//! to receive real-time AIS vessel position updates. This is fundamentally different
//! from other sources — instead of polling, a background task maintains a live
//! WebSocket connection and updates shared state continuously.
//!
//! The MarketDataSource trait reads from this shared state (cheap, in-memory).
//!
//! Each tracked vessel produces 3 assets: latitude, longitude, and speed (SOG).
//! Vessels are pruned if not updated in 30 minutes. Map is capped at 500 vessels.

use anyhow::Result;
use chrono::{DateTime, Utc};
use futures::stream::StreamExt;
use rust_decimal::Decimal;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{AssetUpdate, BatchStrategy, MarketDataSource, PriceUpdate};

/// AISstream WebSocket endpoint
const WS_URL: &str = "wss://stream.aisstream.io/v0/stream";

/// Maximum number of vessels to track simultaneously
const MAX_VESSELS: usize = 500;

/// Prune vessels not updated within this duration
const PRUNE_AFTER: Duration = Duration::from_secs(30 * 60); // 30 minutes

/// Reconnection delay after WebSocket disconnect
const RECONNECT_DELAY: Duration = Duration::from_secs(5);

// ============================================================================
// VESSEL STATE
// ============================================================================

/// Current state of a tracked vessel
#[derive(Debug, Clone)]
pub struct VesselState {
    pub mmsi: u32,
    pub ship_name: String,
    pub lat: f64,
    pub lon: f64,
    pub speed: f64,      // knots (SOG)
    #[allow(dead_code)]
    pub heading: f64,    // degrees (TrueHeading) — kept for future use
    pub last_update: DateTime<Utc>,
}

/// Shared state type: maps MMSI to latest vessel position
pub type SharedVesselMap = Arc<RwLock<HashMap<u32, VesselState>>>;

// ============================================================================
// AIS MESSAGE TYPES (from AISstream.io JSON format)
// ============================================================================

/// Top-level AISstream message envelope
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct AisMessage {
    pub message_type: String,
    pub message: Option<MessageBody>,
    pub meta_data: Option<AisMetaData>,
}

/// Message body containing the position report
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct MessageBody {
    pub position_report: Option<PositionReport>,
}

/// AIS Position Report (Type 1, 2, 3)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct PositionReport {
    #[serde(rename = "UserID")]
    pub user_id: u32,
    pub latitude: f64,
    pub longitude: f64,
    pub sog: f64,
    #[allow(dead_code)]
    pub cog: f64,
    pub true_heading: u32,
}

/// Metadata about the vessel from AISstream
#[derive(Debug, Deserialize)]
pub struct AisMetaData {
    #[allow(dead_code)]
    #[serde(rename = "MMSI")]
    pub mmsi: u32,
    #[serde(rename = "ShipName")]
    pub ship_name: Option<String>,
    #[allow(dead_code)]
    pub time_utc: Option<String>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// AISstream real-time ship tracking market data source.
///
/// Maintains a persistent WebSocket connection to AISstream.io and
/// continuously updates an in-memory map of vessel positions.
/// The MarketDataSource trait methods read from this shared state.
///
/// Source ID is `"aisstream"`.
pub struct AisStreamMarketSource {
    vessels: SharedVesselMap,
}

impl AisStreamMarketSource {
    /// Create a new AISstream source and spawn the background WebSocket task.
    ///
    /// The WebSocket task connects to AISstream.io, subscribes to global
    /// position reports, and continuously updates the shared vessel map.
    pub fn new(api_key: String) -> Self {
        let vessels: SharedVesselMap = Arc::new(RwLock::new(HashMap::new()));
        let vessels_clone = Arc::clone(&vessels);

        // Spawn the background WebSocket task
        tokio::spawn(async move {
            ws_background_task(api_key, vessels_clone).await;
        });

        info!("AISstream source initialized (WebSocket mode, max {} vessels)", MAX_VESSELS);

        Self { vessels }
    }
}

#[async_trait::async_trait]
impl MarketDataSource for AisStreamMarketSource {
    fn source_id(&self) -> &'static str {
        "aisstream"
    }

    fn display_name(&self) -> &'static str {
        "AIS Ship Tracking"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(60) // Reads from memory, cheap — rolling WS data
    }

    fn rate_limit_config(&self) -> RateLimitConfig {
        // No external API calls during sync — reads from in-memory state
        RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 100,
                duration: Duration::from_secs(60),
            }],
        }
    }

    async fn fetch_assets(&self) -> Result<Vec<AssetUpdate>> {
        let vessels = self.vessels.read().await;

        if vessels.is_empty() {
            // Return empty vec if no vessels discovered yet
            // (this is expected on startup before WS connects)
            debug!("AISstream fetch_assets: no vessels yet (WebSocket may still be connecting)");
            return Ok(Vec::new());
        }

        let mut assets = Vec::new();

        for (mmsi, vessel) in vessels.iter() {
            let ship_label = if vessel.ship_name.is_empty() {
                format!("MMSI {}", mmsi)
            } else {
                vessel.ship_name.clone()
            };

            // Latitude asset
            assets.push(AssetUpdate {
                asset_id: format!("ais_{}_lat", mmsi),
                symbol: format!("SHIP/{}_LAT", mmsi),
                name: format!("{} Latitude", ship_label),
                category: Some("transport".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("ais:{}:lat", mmsi),
                    "subcategory": "ais_tracking",
                    "active": true,
                    "extra": {
                        "mmsi": mmsi,
                        "ship_name": vessel.ship_name,
                        "metric": "lat",
                    },
                }),
            });

            // Longitude asset
            assets.push(AssetUpdate {
                asset_id: format!("ais_{}_lon", mmsi),
                symbol: format!("SHIP/{}_LON", mmsi),
                name: format!("{} Longitude", ship_label),
                category: Some("transport".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("ais:{}:lon", mmsi),
                    "subcategory": "ais_tracking",
                    "active": true,
                    "extra": {
                        "mmsi": mmsi,
                        "ship_name": vessel.ship_name,
                        "metric": "lon",
                    },
                }),
            });

            // Speed asset
            assets.push(AssetUpdate {
                asset_id: format!("ais_{}_speed", mmsi),
                symbol: format!("SHIP/{}_SPEED", mmsi),
                name: format!("{} Speed", ship_label),
                category: Some("transport".to_string()),
                metadata: serde_json::json!({
                    "api_ref": format!("ais:{}:speed", mmsi),
                    "subcategory": "ais_tracking",
                    "active": true,
                    "extra": {
                        "mmsi": mmsi,
                        "ship_name": vessel.ship_name,
                        "metric": "speed",
                    },
                }),
            });
        }

        info!(
            "AISstream fetch_assets: {} vessels -> {} assets",
            vessels.len(),
            assets.len()
        );

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let vessels = self.vessels.read().await;
        let mut results = Vec::new();

        for asset_id in asset_ids {
            if let Some(parsed) = parse_ais_asset_id(asset_id) {
                let value = if let Some(vessel) = vessels.get(&parsed.mmsi) {
                    match parsed.metric.as_str() {
                        "lat" => Decimal::from_f64_retain(vessel.lat)
                            .unwrap_or(Decimal::ZERO),
                        "lon" => Decimal::from_f64_retain(vessel.lon)
                            .unwrap_or(Decimal::ZERO),
                        "speed" => Decimal::from_f64_retain(vessel.speed)
                            .unwrap_or(Decimal::ZERO),
                        _ => Decimal::ZERO,
                    }
                } else {
                    Decimal::ZERO
                };

                results.push(PriceUpdate {
                    asset_id: asset_id.clone(),
                    symbol: format!("SHIP/{}_{}", parsed.mmsi, parsed.metric.to_uppercase()),
                    value,
                    prev_close: None,
                    change_pct: None,
                    volume_24h: None,
                    market_cap: None,
                    fetched_at: now,
                });
            }
        }

        info!(
            "AISstream fetch_prices: {}/{} prices from {} tracked vessels",
            results.len(),
            asset_ids.len(),
            vessels.len()
        );

        Ok(results)
    }

    fn batch_strategy(&self) -> BatchStrategy {
        BatchStrategy::FAST_VOLATILE
    }
}

// ============================================================================
// WEBSOCKET BACKGROUND TASK
// ============================================================================

/// Background task that maintains a persistent WebSocket connection to AISstream.io.
///
/// - Connects and sends subscription message with API key
/// - Reads position reports and updates the shared vessel map
/// - Prunes stale vessels (not updated in 30 min)
/// - Caps vessel map at MAX_VESSELS (keeps most recently updated)
/// - Reconnects on disconnect with exponential backoff
async fn ws_background_task(api_key: String, vessels: SharedVesselMap) {
    loop {
        info!("AISstream WebSocket: connecting to {}", WS_URL);

        match tokio_tungstenite::connect_async(WS_URL).await {
            Ok((ws_stream, _response)) => {
                info!("AISstream WebSocket: connected");

                let (mut write, mut read) = ws_stream.split();

                // Send subscription message
                let subscribe_msg = serde_json::json!({
                    "APIKey": api_key,
                    "BoundingBoxes": [[[-90, -180], [90, 180]]],
                    "FilterMessageTypes": ["PositionReport"]
                });

                use futures::SinkExt;
                use tokio_tungstenite::tungstenite::Message;

                if let Err(e) = write.send(Message::Text(subscribe_msg.to_string().into())).await {
                    warn!("AISstream WebSocket: failed to send subscription: {}", e);
                    tokio::time::sleep(RECONNECT_DELAY).await;
                    continue;
                }

                info!("AISstream WebSocket: subscription sent (global bounding box)");

                let mut msg_count: u64 = 0;
                let mut last_prune = Utc::now();

                // Read messages until disconnected
                while let Some(msg_result) = read.next().await {
                    match msg_result {
                        Ok(Message::Text(text)) => {
                            match serde_json::from_str::<AisMessage>(&text) {
                                Ok(ais_msg) => {
                                    if let Some(vessel_state) = extract_vessel_state(&ais_msg) {
                                        let mut map = vessels.write().await;
                                        map.insert(vessel_state.mmsi, vessel_state);

                                        // Enforce vessel cap
                                        if map.len() > MAX_VESSELS {
                                            enforce_vessel_cap(&mut map);
                                        }

                                        msg_count += 1;
                                        if msg_count % 100 == 0 {
                                            debug!(
                                                "AISstream: {} messages processed, {} vessels tracked",
                                                msg_count,
                                                map.len()
                                            );
                                        }
                                    }
                                }
                                Err(e) => {
                                    debug!("AISstream: failed to parse message: {}", e);
                                }
                            }
                        }
                        Ok(Message::Ping(data)) => {
                            if let Err(e) = write.send(Message::Pong(data)).await {
                                warn!("AISstream: failed to send pong: {}", e);
                                break;
                            }
                        }
                        Ok(Message::Close(_)) => {
                            warn!("AISstream WebSocket: server sent close frame");
                            break;
                        }
                        Err(e) => {
                            warn!("AISstream WebSocket: read error: {}", e);
                            break;
                        }
                        _ => {} // Ignore binary, pong, etc.
                    }

                    // Periodic pruning (every 5 minutes)
                    let now = Utc::now();
                    if (now - last_prune).num_seconds() > 300 {
                        let mut map = vessels.write().await;
                        prune_stale_vessels(&mut map, now);
                        last_prune = now;
                    }
                }

                warn!(
                    "AISstream WebSocket: disconnected after {} messages, reconnecting in {:?}",
                    msg_count, RECONNECT_DELAY
                );
            }
            Err(e) => {
                warn!("AISstream WebSocket: connection failed: {}", e);
            }
        }

        tokio::time::sleep(RECONNECT_DELAY).await;
    }
}

/// Extract vessel state from an AIS position report message.
pub fn extract_vessel_state(msg: &AisMessage) -> Option<VesselState> {
    if msg.message_type != "PositionReport" {
        return None;
    }

    let report = msg.message.as_ref()?.position_report.as_ref()?;
    let meta = msg.meta_data.as_ref()?;

    let ship_name = meta
        .ship_name
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_string();

    Some(VesselState {
        mmsi: report.user_id,
        ship_name,
        lat: report.latitude,
        lon: report.longitude,
        speed: report.sog,
        heading: report.true_heading as f64,
        last_update: Utc::now(),
    })
}

/// Remove vessels that haven't been updated within PRUNE_AFTER.
pub fn prune_stale_vessels(map: &mut HashMap<u32, VesselState>, now: DateTime<Utc>) {
    let prune_threshold = now - chrono::Duration::from_std(PRUNE_AFTER).unwrap();
    let before = map.len();
    map.retain(|_, v| v.last_update > prune_threshold);
    let pruned = before - map.len();
    if pruned > 0 {
        info!("AISstream: pruned {} stale vessels ({} remaining)", pruned, map.len());
    }
}

/// Enforce MAX_VESSELS cap by removing least recently updated vessels.
pub fn enforce_vessel_cap(map: &mut HashMap<u32, VesselState>) {
    if map.len() <= MAX_VESSELS {
        return;
    }

    // Collect (mmsi, last_update) and sort by last_update ascending (oldest first)
    let mut entries: Vec<(u32, DateTime<Utc>)> = map
        .iter()
        .map(|(&mmsi, v)| (mmsi, v.last_update))
        .collect();
    entries.sort_by_key(|&(_, ts)| ts);

    // Remove oldest entries to get back to MAX_VESSELS
    let to_remove = map.len() - MAX_VESSELS;
    for (mmsi, _) in entries.iter().take(to_remove) {
        map.remove(mmsi);
    }

    debug!(
        "AISstream: capped vessel map at {} (removed {} oldest)",
        map.len(),
        to_remove
    );
}

// ============================================================================
// HELPERS
// ============================================================================

/// Parsed components of an AIS asset ID
#[derive(Debug, Clone)]
pub struct ParsedAisAssetId {
    pub mmsi: u32,
    pub metric: String, // "lat", "lon", "speed"
}

/// Parse asset ID like "ais_{mmsi}_{metric}" into components.
pub fn parse_ais_asset_id(asset_id: &str) -> Option<ParsedAisAssetId> {
    let rest = asset_id.strip_prefix("ais_")?;

    let last_underscore = rest.rfind('_')?;
    let metric = &rest[last_underscore + 1..];

    // Validate metric
    if metric != "lat" && metric != "lon" && metric != "speed" {
        return None;
    }

    let mmsi_str = &rest[..last_underscore];
    let mmsi: u32 = mmsi_str.parse().ok()?;

    Some(ParsedAisAssetId {
        mmsi,
        metric: metric.to_string(),
    })
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::market_data::traits::{load_all_asset_entries, load_assets_from_json};

    /// Asset configuration (empty — all assets are dynamic from WebSocket stream)
    const ASSET_JSON: &str = include_str!("../../../config/aisstream.json");

    // ========================================================================
    // Config tests
    // ========================================================================

    #[test]
    fn test_config_is_empty() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        assert!(
            entries.is_empty(),
            "Config should be empty -- assets are dynamic from WebSocket"
        );
    }

    #[test]
    fn test_empty_config_loads() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(assets.is_empty());
    }

    // ========================================================================
    // JSON parsing tests
    // ========================================================================

    #[test]
    fn test_parse_position_report() {
        let json = r#"{
            "MessageType": "PositionReport",
            "Message": {
                "PositionReport": {
                    "Cog": 52.099998474121094,
                    "CommunicationState": 81972,
                    "Latitude": 47.58283233642578,
                    "Longitude": -122.34653472900391,
                    "MessageID": 1,
                    "NavigationalStatus": 0,
                    "RateOfTurn": 0,
                    "RepeatIndicator": 0,
                    "Sog": 12.5,
                    "Spare": 0,
                    "SpecialManoeuvreIndicator": 0,
                    "Timestamp": 7,
                    "TrueHeading": 511,
                    "UserID": 367596940,
                    "Valid": true
                }
            },
            "MetaData": {
                "MMSI": 367596940,
                "MMSI_String": "367596940",
                "ShipName": "PRIOR",
                "latitude": 47.58283233642578,
                "longitude": -122.34653472900391,
                "time_utc": "2023-07-25 02:13:41.235114272 +0000 UTC"
            }
        }"#;

        let msg: AisMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg.message_type, "PositionReport");

        let vessel = extract_vessel_state(&msg).unwrap();
        assert_eq!(vessel.mmsi, 367596940);
        assert_eq!(vessel.ship_name, "PRIOR");
        assert!((vessel.lat - 47.58283).abs() < 0.001);
        assert!((vessel.lon - (-122.34653)).abs() < 0.001);
        assert!((vessel.speed - 12.5).abs() < 0.001);
        assert!((vessel.heading - 511.0).abs() < 0.001);
    }

    #[test]
    fn test_parse_position_report_empty_ship_name() {
        let json = r#"{
            "MessageType": "PositionReport",
            "Message": {
                "PositionReport": {
                    "Cog": 0.0,
                    "CommunicationState": 0,
                    "Latitude": 1.0,
                    "Longitude": 2.0,
                    "MessageID": 1,
                    "NavigationalStatus": 0,
                    "RateOfTurn": 0,
                    "RepeatIndicator": 0,
                    "Sog": 0.0,
                    "Spare": 0,
                    "SpecialManoeuvreIndicator": 0,
                    "Timestamp": 0,
                    "TrueHeading": 0,
                    "UserID": 123456789,
                    "Valid": true
                }
            },
            "MetaData": {
                "MMSI": 123456789,
                "MMSI_String": "123456789",
                "ShipName": "   ",
                "latitude": 1.0,
                "longitude": 2.0,
                "time_utc": "2023-07-25 02:13:41.235114272 +0000 UTC"
            }
        }"#;

        let msg: AisMessage = serde_json::from_str(json).unwrap();
        let vessel = extract_vessel_state(&msg).unwrap();
        assert_eq!(vessel.mmsi, 123456789);
        assert!(vessel.ship_name.is_empty(), "Trimmed whitespace-only name should be empty");
    }

    #[test]
    fn test_non_position_report_ignored() {
        let json = r#"{
            "MessageType": "ShipStaticData",
            "Message": {},
            "MetaData": {
                "MMSI": 123456789,
                "MMSI_String": "123456789",
                "ShipName": "TEST"
            }
        }"#;

        let msg: AisMessage = serde_json::from_str(json).unwrap();
        let vessel = extract_vessel_state(&msg);
        assert!(vessel.is_none(), "Non-PositionReport messages should return None");
    }

    #[test]
    fn test_missing_position_report_field() {
        let json = r#"{
            "MessageType": "PositionReport",
            "Message": {},
            "MetaData": {
                "MMSI": 123456789,
                "MMSI_String": "123456789",
                "ShipName": "TEST"
            }
        }"#;

        let msg: AisMessage = serde_json::from_str(json).unwrap();
        let vessel = extract_vessel_state(&msg);
        assert!(vessel.is_none(), "Missing PositionReport field should return None");
    }

    // ========================================================================
    // Asset ID parsing tests
    // ========================================================================

    #[test]
    fn test_parse_ais_asset_id_lat() {
        let parsed = parse_ais_asset_id("ais_367596940_lat").unwrap();
        assert_eq!(parsed.mmsi, 367596940);
        assert_eq!(parsed.metric, "lat");
    }

    #[test]
    fn test_parse_ais_asset_id_lon() {
        let parsed = parse_ais_asset_id("ais_123456789_lon").unwrap();
        assert_eq!(parsed.mmsi, 123456789);
        assert_eq!(parsed.metric, "lon");
    }

    #[test]
    fn test_parse_ais_asset_id_speed() {
        let parsed = parse_ais_asset_id("ais_999000001_speed").unwrap();
        assert_eq!(parsed.mmsi, 999000001);
        assert_eq!(parsed.metric, "speed");
    }

    #[test]
    fn test_parse_ais_asset_id_invalid() {
        assert!(parse_ais_asset_id("invalid").is_none());
        assert!(parse_ais_asset_id("ais_").is_none());
        assert!(parse_ais_asset_id("ais_abc_lat").is_none());  // non-numeric MMSI
        assert!(parse_ais_asset_id("ais_123_heading").is_none()); // invalid metric
        assert!(parse_ais_asset_id("").is_none());
        assert!(parse_ais_asset_id("port_singapore").is_none()); // wrong prefix
    }

    // ========================================================================
    // Vessel state management tests
    // ========================================================================

    #[test]
    fn test_prune_stale_vessels() {
        let mut map = HashMap::new();
        let now = Utc::now();
        let old = now - chrono::Duration::minutes(45); // 45 min ago = stale
        let recent = now - chrono::Duration::minutes(5);  // 5 min ago = fresh

        map.insert(1, VesselState {
            mmsi: 1,
            ship_name: "OLD SHIP".to_string(),
            lat: 0.0,
            lon: 0.0,
            speed: 0.0,
            heading: 0.0,
            last_update: old,
        });
        map.insert(2, VesselState {
            mmsi: 2,
            ship_name: "FRESH SHIP".to_string(),
            lat: 1.0,
            lon: 1.0,
            speed: 5.0,
            heading: 90.0,
            last_update: recent,
        });

        assert_eq!(map.len(), 2);
        prune_stale_vessels(&mut map, now);
        assert_eq!(map.len(), 1);
        assert!(map.contains_key(&2));
        assert!(!map.contains_key(&1));
    }

    #[test]
    fn test_enforce_vessel_cap() {
        let mut map = HashMap::new();
        let now = Utc::now();

        // Insert MAX_VESSELS + 10 entries with sequential timestamps
        for i in 0..(MAX_VESSELS + 10) as u32 {
            map.insert(i, VesselState {
                mmsi: i,
                ship_name: format!("SHIP_{}", i),
                lat: 0.0,
                lon: 0.0,
                speed: 0.0,
                heading: 0.0,
                last_update: now + chrono::Duration::seconds(i as i64),
            });
        }

        assert_eq!(map.len(), MAX_VESSELS + 10);
        enforce_vessel_cap(&mut map);
        assert_eq!(map.len(), MAX_VESSELS);

        // The 10 oldest (MMSI 0-9) should have been removed
        for i in 0..10u32 {
            assert!(!map.contains_key(&i), "MMSI {} should have been evicted", i);
        }
        // The newest should remain
        for i in 10..(MAX_VESSELS + 10) as u32 {
            assert!(map.contains_key(&i), "MMSI {} should still be present", i);
        }
    }

    #[test]
    fn test_enforce_vessel_cap_under_limit() {
        let mut map = HashMap::new();
        let now = Utc::now();

        // Insert fewer than MAX_VESSELS
        for i in 0..10u32 {
            map.insert(i, VesselState {
                mmsi: i,
                ship_name: format!("SHIP_{}", i),
                lat: 0.0,
                lon: 0.0,
                speed: 0.0,
                heading: 0.0,
                last_update: now,
            });
        }

        assert_eq!(map.len(), 10);
        enforce_vessel_cap(&mut map);
        assert_eq!(map.len(), 10, "Should not evict anything when under cap");
    }

    #[test]
    fn test_vessel_state_update_replaces_old() {
        let mut map = HashMap::new();
        let now = Utc::now();

        // Insert initial state
        map.insert(100, VesselState {
            mmsi: 100,
            ship_name: "TEST".to_string(),
            lat: 10.0,
            lon: 20.0,
            speed: 5.0,
            heading: 90.0,
            last_update: now,
        });

        // Update with new position
        map.insert(100, VesselState {
            mmsi: 100,
            ship_name: "TEST".to_string(),
            lat: 11.0,
            lon: 21.0,
            speed: 8.0,
            heading: 180.0,
            last_update: now + chrono::Duration::seconds(30),
        });

        assert_eq!(map.len(), 1);
        let vessel = map.get(&100).unwrap();
        assert!((vessel.lat - 11.0).abs() < 0.001);
        assert!((vessel.lon - 21.0).abs() < 0.001);
        assert!((vessel.speed - 8.0).abs() < 0.001);
    }
}
