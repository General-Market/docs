//! GTFS-Realtime transit data client implementing MarketDataSource
//!
//! Tracks real-time bus and subway vehicle positions / active trips from
//! US transit agencies that provide open GTFS-RT feeds (no API key required).
//!
//! Currently supported agencies:
//! - **NYC MTA Subway** — 8 feeds covering all subway lines (primarily TripUpdate data)
//! - **BART (San Francisco)** — trip updates for Bay Area Rapid Transit
//!
//! The MTA subway feeds are primarily TripUpdate feeds (arrival predictions),
//! not VehiclePosition feeds. We count active trips per line group as the
//! primary metric. If any feed contains VehiclePosition entities, we also
//! report those counts.
//!
//! Assets are static — defined in `config/gtfs_rt.json`.
//!
//! Auth: None
//! Rate limit: 30 req/min (self-imposed, MTA has no documented limit)

use anyhow::{Context, Result};
use chrono::Utc;
use prost::Message;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};

use super::proto::FeedMessage;

/// Asset configuration JSON (embedded at compile time).
const ASSET_JSON: &str = include_str!("../../../config/gtfs_rt.json");

// ============================================================================
// FEED CONFIGURATION
// ============================================================================

/// A single GTFS-RT feed endpoint.
struct GtfsFeed {
    /// Human-readable label for this feed.
    label: &'static str,
    /// URL to fetch protobuf data from.
    url: &'static str,
    /// Which agency this feed belongs to.
    agency: &'static str,
    /// Which line group(s) this feed covers (for per-line metrics).
    line_groups: &'static [&'static str],
}

/// All configured GTFS-RT feeds.
const FEEDS: &[GtfsFeed] = &[
    // NYC MTA Subway feeds (TripUpdate + possibly VehiclePosition)
    GtfsFeed {
        label: "MTA 1/2/3/4/5/6/7",
        url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
        agency: "mta",
        line_groups: &["123", "4567"],
    },
    GtfsFeed {
        label: "MTA A/C/E",
        url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
        agency: "mta",
        line_groups: &["ace"],
    },
    GtfsFeed {
        label: "MTA B/D/F/M",
        url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
        agency: "mta",
        line_groups: &["bdfm"],
    },
    GtfsFeed {
        label: "MTA G",
        url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
        agency: "mta",
        line_groups: &["g"],
    },
    GtfsFeed {
        label: "MTA J/Z",
        url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
        agency: "mta",
        line_groups: &["jz"],
    },
    GtfsFeed {
        label: "MTA N/Q/R/W",
        url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
        agency: "mta",
        line_groups: &["nqrw"],
    },
    GtfsFeed {
        label: "MTA L",
        url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
        agency: "mta",
        line_groups: &["l"],
    },
    GtfsFeed {
        label: "MTA SI",
        url: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si",
        agency: "mta",
        line_groups: &["si"],
    },
    // BART (San Francisco)
    GtfsFeed {
        label: "BART Trip Updates",
        url: "http://api.bart.gov/gtfsrt/tripupdate.aspx",
        agency: "bart",
        line_groups: &["bart"],
    },
];

// ============================================================================
// FEED METRICS
// ============================================================================

/// Aggregated metrics extracted from a single GTFS-RT feed.
#[derive(Debug, Default)]
struct FeedMetrics {
    /// Number of trip update entities in the feed.
    trip_update_count: u32,
    /// Number of vehicle position entities in the feed.
    vehicle_position_count: u32,
    /// Sum of speeds from vehicle positions (for averaging).
    speed_sum: f32,
    /// Number of vehicles reporting speed.
    speed_count: u32,
    /// Per-route trip counts (route_id -> count).
    route_trip_counts: HashMap<String, u32>,
}

/// Extract metrics from a decoded GTFS-RT FeedMessage.
fn extract_metrics(feed: &FeedMessage) -> FeedMetrics {
    let mut metrics = FeedMetrics::default();

    for entity in &feed.entity {
        // Count trip updates
        if let Some(ref tu) = entity.trip_update {
            metrics.trip_update_count += 1;

            // Track per-route counts
            if let Some(ref trip) = tu.trip {
                if let Some(ref route_id) = trip.route_id {
                    *metrics.route_trip_counts.entry(route_id.clone()).or_insert(0) += 1;
                }
            }
        }

        // Count vehicle positions
        if let Some(ref vp) = entity.vehicle {
            metrics.vehicle_position_count += 1;

            // Accumulate speed if available
            if let Some(ref pos) = vp.position {
                if let Some(speed) = pos.speed {
                    if speed >= 0.0 {
                        metrics.speed_sum += speed;
                        metrics.speed_count += 1;
                    }
                }
            }
        }
    }

    metrics
}

// ============================================================================
// AGGREGATED AGENCY METRICS
// ============================================================================

/// Aggregated metrics across all feeds for a single agency.
#[derive(Debug, Default)]
struct AgencyMetrics {
    /// Total trip updates across all feeds.
    total_trips: u32,
    /// Total vehicle positions across all feeds.
    total_vehicles: u32,
    /// Total speed sum (for averaging across all vehicles).
    total_speed_sum: f32,
    /// Total vehicles reporting speed.
    total_speed_count: u32,
    /// Per-line-group trip counts.
    line_group_trips: HashMap<String, u32>,
    /// Per-line-group vehicle counts.
    line_group_vehicles: HashMap<String, u32>,
}

// ============================================================================
// SOURCE IMPLEMENTATION
// ============================================================================

/// GTFS-Realtime transit market data source.
///
/// Tracks real-time transit metrics (active trips, vehicle positions) from
/// US transit agencies. Source ID is `"gtfs_transit"`.
pub struct GtfsRtMarketSource {
    http: reqwest::Client,
}

impl GtfsRtMarketSource {
    /// Create a new GTFS-RT source. No API keys needed.
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("IndexDataNode/1.0 (transit-tracker)")
            .build()
            .expect("Failed to build reqwest client");

        info!("GTFS-RT transit source initialized ({} feeds configured)", FEEDS.len());

        Self { http }
    }

    /// Fetch and decode a single GTFS-RT protobuf feed.
    async fn fetch_feed(&self, feed: &GtfsFeed) -> Result<FeedMessage> {
        debug!("Fetching GTFS-RT feed: {} ({})", feed.label, feed.url);

        let response = self
            .http
            .get(feed.url)
            .send()
            .await
            .with_context(|| format!("HTTP request failed for {}", feed.label))?;

        let status = response.status();
        if !status.is_success() {
            anyhow::bail!(
                "HTTP {} from {} ({})",
                status.as_u16(),
                feed.label,
                feed.url
            );
        }

        let bytes = response
            .bytes()
            .await
            .with_context(|| format!("Failed to read response body from {}", feed.label))?;

        let feed_msg = FeedMessage::decode(bytes.as_ref())
            .with_context(|| format!("Failed to decode protobuf from {}", feed.label))?;

        debug!(
            "Decoded {} entities from {} (feed timestamp: {:?})",
            feed_msg.entity.len(),
            feed.label,
            feed_msg.header.as_ref().and_then(|h| h.timestamp)
        );

        Ok(feed_msg)
    }

    /// Fetch all feeds and aggregate metrics per agency.
    async fn fetch_all_metrics(&self) -> HashMap<String, AgencyMetrics> {
        let mut agency_metrics: HashMap<String, AgencyMetrics> = HashMap::new();

        for feed in FEEDS {
            match self.fetch_feed(feed).await {
                Ok(feed_msg) => {
                    let metrics = extract_metrics(&feed_msg);

                    debug!(
                        "{}: {} trip_updates, {} vehicle_positions",
                        feed.label, metrics.trip_update_count, metrics.vehicle_position_count
                    );

                    let agency = agency_metrics
                        .entry(feed.agency.to_string())
                        .or_default();

                    agency.total_trips += metrics.trip_update_count;
                    agency.total_vehicles += metrics.vehicle_position_count;
                    agency.total_speed_sum += metrics.speed_sum;
                    agency.total_speed_count += metrics.speed_count;

                    // Aggregate per line group
                    for line_group in feed.line_groups {
                        *agency
                            .line_group_trips
                            .entry(line_group.to_string())
                            .or_insert(0) += metrics.trip_update_count;
                        *agency
                            .line_group_vehicles
                            .entry(line_group.to_string())
                            .or_insert(0) += metrics.vehicle_position_count;
                    }
                }
                Err(e) => {
                    warn!("Failed to fetch feed {}: {:#}", feed.label, e);
                }
            }
        }

        agency_metrics
    }
}

#[async_trait::async_trait]
impl MarketDataSource for GtfsRtMarketSource {
    fn source_id(&self) -> &'static str {
        "gtfs_transit"
    }

    fn display_name(&self) -> &'static str {
        "GTFS Transit"
    }

    fn default_resolution(&self) -> &'static str {
        "deterministic"
    }

    fn sync_interval(&self) -> Duration {
        Duration::from_secs(120)
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
        info!(
            "GTFS-RT fetch_assets: {} assets loaded from config",
            assets.len()
        );
        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let agency_metrics = self.fetch_all_metrics().await;

        let mut results = Vec::with_capacity(asset_ids.len());

        for asset_id in asset_ids {
            let value = resolve_asset_value(asset_id, &agency_metrics);

            results.push(PriceUpdate {
                asset_id: asset_id.clone(),
                symbol: asset_id_to_symbol(asset_id),
                value,
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        // Log summary
        for (agency, metrics) in &agency_metrics {
            info!(
                "GTFS-RT {}: {} active trips, {} vehicle positions",
                agency, metrics.total_trips, metrics.total_vehicles
            );
        }

        info!(
            "Fetched {}/{} GTFS-RT transit metrics",
            results.len(),
            asset_ids.len()
        );

        Ok(results)
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Resolve an asset ID to its current metric value from agency metrics.
fn resolve_asset_value(asset_id: &str, metrics: &HashMap<String, AgencyMetrics>) -> Decimal {
    // Parse asset_id format: transit_{agency}_{metric}
    // e.g., transit_mta_active_trips, transit_mta_line_ace_trips
    let parts: Vec<&str> = asset_id.splitn(3, '_').collect();
    if parts.len() < 3 || parts[0] != "transit" {
        warn!("Unrecognized transit asset_id format: {}", asset_id);
        return Decimal::ZERO;
    }

    let agency = parts[1];
    let metric_key = parts[2];

    let agency_data = match metrics.get(agency) {
        Some(data) => data,
        None => {
            debug!("No metrics for agency '{}' (asset: {})", agency, asset_id);
            return Decimal::ZERO;
        }
    };

    match metric_key {
        "active_trips" => Decimal::from(agency_data.total_trips),
        "total_vehicles" => Decimal::from(agency_data.total_vehicles),
        "avg_speed" => {
            if agency_data.total_speed_count > 0 {
                let avg = agency_data.total_speed_sum / agency_data.total_speed_count as f32;
                // Convert m/s to km/h for readability, round to 1 decimal
                let kmh = avg * 3.6;
                Decimal::from_f32_retain(kmh).unwrap_or(Decimal::ZERO)
            } else {
                Decimal::ZERO
            }
        }
        key if key.starts_with("line_") && key.ends_with("_trips") => {
            // Extract line group: "line_ace_trips" -> "ace"
            let line = key
                .strip_prefix("line_")
                .and_then(|s| s.strip_suffix("_trips"))
                .unwrap_or("");
            let count = agency_data
                .line_group_trips
                .get(line)
                .copied()
                .unwrap_or(0);
            Decimal::from(count)
        }
        key if key.starts_with("line_") && key.ends_with("_vehicles") => {
            let line = key
                .strip_prefix("line_")
                .and_then(|s| s.strip_suffix("_vehicles"))
                .unwrap_or("");
            let count = agency_data
                .line_group_vehicles
                .get(line)
                .copied()
                .unwrap_or(0);
            Decimal::from(count)
        }
        _ => {
            debug!("Unknown metric key '{}' for asset {}", metric_key, asset_id);
            Decimal::ZERO
        }
    }
}

/// Convert an asset_id to a trading symbol.
/// e.g., "transit_mta_active_trips" -> "TRANSIT/MTA_TRIPS"
fn asset_id_to_symbol(asset_id: &str) -> String {
    let upper = asset_id.to_uppercase();
    if let Some(rest) = upper.strip_prefix("TRANSIT_") {
        format!("TRANSIT/{}", rest)
    } else {
        upper
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
            entries.len() >= 10,
            "Expected >= 10 GTFS-RT transit entries, got {}",
            entries.len()
        );
    }

    #[test]
    fn test_config_loads_as_assets() {
        let assets = load_assets_from_json(ASSET_JSON).unwrap();
        assert!(
            assets.len() >= 10,
            "Expected >= 10 active transit assets, got {}",
            assets.len()
        );
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
                entry.subcategory, "transit",
                "Entry {} should have transit subcategory",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_format() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        for entry in &entries {
            assert!(
                entry.asset_id.starts_with("transit_"),
                "Asset ID {} should start with 'transit_'",
                entry.asset_id
            );
        }
    }

    #[test]
    fn test_asset_id_to_symbol() {
        assert_eq!(
            asset_id_to_symbol("transit_mta_active_trips"),
            "TRANSIT/MTA_ACTIVE_TRIPS"
        );
        assert_eq!(
            asset_id_to_symbol("transit_bart_active_trips"),
            "TRANSIT/BART_ACTIVE_TRIPS"
        );
        assert_eq!(
            asset_id_to_symbol("transit_mta_line_ace_trips"),
            "TRANSIT/MTA_LINE_ACE_TRIPS"
        );
    }

    #[test]
    fn test_resolve_asset_value_active_trips() {
        let mut metrics = HashMap::new();
        metrics.insert(
            "mta".to_string(),
            AgencyMetrics {
                total_trips: 150,
                total_vehicles: 0,
                total_speed_sum: 0.0,
                total_speed_count: 0,
                line_group_trips: HashMap::new(),
                line_group_vehicles: HashMap::new(),
            },
        );

        assert_eq!(
            resolve_asset_value("transit_mta_active_trips", &metrics),
            Decimal::from(150)
        );
    }

    #[test]
    fn test_resolve_asset_value_line_trips() {
        let mut line_trips = HashMap::new();
        line_trips.insert("ace".to_string(), 42);
        line_trips.insert("l".to_string(), 15);

        let mut metrics = HashMap::new();
        metrics.insert(
            "mta".to_string(),
            AgencyMetrics {
                total_trips: 100,
                total_vehicles: 0,
                total_speed_sum: 0.0,
                total_speed_count: 0,
                line_group_trips: line_trips,
                line_group_vehicles: HashMap::new(),
            },
        );

        assert_eq!(
            resolve_asset_value("transit_mta_line_ace_trips", &metrics),
            Decimal::from(42)
        );
        assert_eq!(
            resolve_asset_value("transit_mta_line_l_trips", &metrics),
            Decimal::from(15)
        );
        // Unknown line group -> 0
        assert_eq!(
            resolve_asset_value("transit_mta_line_xyz_trips", &metrics),
            Decimal::ZERO
        );
    }

    #[test]
    fn test_resolve_asset_value_avg_speed() {
        let mut metrics = HashMap::new();
        metrics.insert(
            "mta".to_string(),
            AgencyMetrics {
                total_trips: 0,
                total_vehicles: 10,
                total_speed_sum: 100.0, // 100 m/s total across 10 vehicles = 10 m/s avg
                total_speed_count: 10,
                line_group_trips: HashMap::new(),
                line_group_vehicles: HashMap::new(),
            },
        );

        let value = resolve_asset_value("transit_mta_avg_speed", &metrics);
        // 10 m/s * 3.6 = 36 km/h
        assert!(value > Decimal::from(35) && value < Decimal::from(37));
    }

    #[test]
    fn test_resolve_asset_value_missing_agency() {
        let metrics = HashMap::new();
        assert_eq!(
            resolve_asset_value("transit_mta_active_trips", &metrics),
            Decimal::ZERO
        );
    }

    #[test]
    fn test_resolve_asset_value_bad_format() {
        let metrics = HashMap::new();
        assert_eq!(
            resolve_asset_value("not_a_transit_asset", &metrics),
            Decimal::ZERO
        );
    }

    #[test]
    fn test_extract_metrics_empty_feed() {
        let feed = FeedMessage {
            header: Some(super::super::proto::FeedHeader {
                gtfs_realtime_version: "2.0".to_string(),
                timestamp: Some(1700000000),
            }),
            entity: vec![],
        };
        let metrics = extract_metrics(&feed);
        assert_eq!(metrics.trip_update_count, 0);
        assert_eq!(metrics.vehicle_position_count, 0);
        assert_eq!(metrics.speed_count, 0);
    }

    #[test]
    fn test_extract_metrics_trip_updates() {
        use super::super::proto::*;

        let feed = FeedMessage {
            header: Some(FeedHeader {
                gtfs_realtime_version: "2.0".to_string(),
                timestamp: Some(1700000000),
            }),
            entity: vec![
                FeedEntity {
                    id: "tu1".to_string(),
                    is_deleted: None,
                    trip_update: Some(TripUpdate {
                        trip: Some(TripDescriptor {
                            trip_id: Some("t1".to_string()),
                            route_id: Some("A".to_string()),
                            direction_id: None,
                            start_time: None,
                            start_date: None,
                        }),
                        vehicle: None,
                        stop_time_update: vec![],
                        timestamp: None,
                    }),
                    vehicle: None,
                },
                FeedEntity {
                    id: "tu2".to_string(),
                    is_deleted: None,
                    trip_update: Some(TripUpdate {
                        trip: Some(TripDescriptor {
                            trip_id: Some("t2".to_string()),
                            route_id: Some("A".to_string()),
                            direction_id: None,
                            start_time: None,
                            start_date: None,
                        }),
                        vehicle: None,
                        stop_time_update: vec![],
                        timestamp: None,
                    }),
                    vehicle: None,
                },
                FeedEntity {
                    id: "tu3".to_string(),
                    is_deleted: None,
                    trip_update: Some(TripUpdate {
                        trip: Some(TripDescriptor {
                            trip_id: Some("t3".to_string()),
                            route_id: Some("C".to_string()),
                            direction_id: None,
                            start_time: None,
                            start_date: None,
                        }),
                        vehicle: None,
                        stop_time_update: vec![],
                        timestamp: None,
                    }),
                    vehicle: None,
                },
            ],
        };

        let metrics = extract_metrics(&feed);
        assert_eq!(metrics.trip_update_count, 3);
        assert_eq!(metrics.vehicle_position_count, 0);
        assert_eq!(metrics.route_trip_counts.get("A"), Some(&2));
        assert_eq!(metrics.route_trip_counts.get("C"), Some(&1));
    }

    #[test]
    fn test_extract_metrics_vehicle_positions_with_speed() {
        use super::super::proto::*;

        let feed = FeedMessage {
            header: Some(FeedHeader {
                gtfs_realtime_version: "2.0".to_string(),
                timestamp: Some(1700000000),
            }),
            entity: vec![
                FeedEntity {
                    id: "vp1".to_string(),
                    is_deleted: None,
                    trip_update: None,
                    vehicle: Some(VehiclePosition {
                        trip: None,
                        position: Some(Position {
                            latitude: 40.0,
                            longitude: -74.0,
                            bearing: None,
                            speed: Some(10.0),
                        }),
                        vehicle: None,
                        timestamp: None,
                    }),
                },
                FeedEntity {
                    id: "vp2".to_string(),
                    is_deleted: None,
                    trip_update: None,
                    vehicle: Some(VehiclePosition {
                        trip: None,
                        position: Some(Position {
                            latitude: 40.1,
                            longitude: -74.1,
                            bearing: None,
                            speed: Some(20.0),
                        }),
                        vehicle: None,
                        timestamp: None,
                    }),
                },
            ],
        };

        let metrics = extract_metrics(&feed);
        assert_eq!(metrics.vehicle_position_count, 2);
        assert_eq!(metrics.speed_count, 2);
        assert!((metrics.speed_sum - 30.0).abs() < 0.01);
    }

    #[test]
    fn test_known_assets_in_config() {
        let entries = load_all_asset_entries(ASSET_JSON).unwrap();
        let ids: Vec<&str> = entries.iter().map(|e| e.asset_id.as_str()).collect();
        assert!(ids.contains(&"transit_mta_active_trips"));
        assert!(ids.contains(&"transit_bart_active_trips"));
    }

    #[test]
    fn test_feeds_configured() {
        assert!(FEEDS.len() >= 9, "Expected >= 9 feeds, got {}", FEEDS.len());

        // Check MTA feeds exist
        let mta_feeds: Vec<_> = FEEDS.iter().filter(|f| f.agency == "mta").collect();
        assert_eq!(mta_feeds.len(), 8, "Expected 8 MTA feeds");

        // Check BART feed exists
        let bart_feeds: Vec<_> = FEEDS.iter().filter(|f| f.agency == "bart").collect();
        assert_eq!(bart_feeds.len(), 1, "Expected 1 BART feed");
    }
}
