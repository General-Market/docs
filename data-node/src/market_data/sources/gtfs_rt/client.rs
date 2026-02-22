//! GTFS-Realtime transit data client implementing MarketDataSource
//!
//! Tracks real-time bus and subway vehicle positions / active trips from
//! US transit agencies that provide open GTFS-RT feeds (no API key required).
//!
//! Currently supported agencies:
//! - **NYC MTA Subway** — 8 feeds covering all subway lines (TripUpdate + VehiclePosition data)
//! - **BART (San Francisco)** — trip updates for Bay Area Rapid Transit
//!
//! Assets:
//! - **Static aggregates** (13): total trips, per-line trips, vehicle counts, avg speed
//!   — defined in `config/gtfs_rt.json`
//! - **Dynamic per-vehicle GPS** (up to 1000): individual vehicle lat/lon from VehiclePosition
//!   entities — discovered at runtime and cached in a Mutex (same pattern as mil_aircraft)
//!
//! Auth: None
//! Rate limit: 30 req/min (self-imposed, MTA has no documented limit)

use anyhow::{Context, Result};
use chrono::Utc;
use prost::Message;
use rust_decimal::Decimal;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::market_data::rate_limiter::{RateLimitConfig, RateWindow};
use crate::market_data::traits::{load_assets_from_json, AssetUpdate, MarketDataSource, PriceUpdate};

use super::proto::FeedMessage;

/// Asset configuration JSON (embedded at compile time).
const ASSET_JSON: &str = include_str!("../../../config/gtfs_rt.json");

/// Maximum number of individual vehicles to track (prevents DB bloat).
const MAX_VEHICLES: usize = 500;

// ============================================================================
// CACHED VEHICLE STATE (for dynamic per-vehicle assets)
// ============================================================================

/// Cached state for a single vehicle reporting a GPS position.
#[derive(Debug, Clone)]
pub struct CachedVehicle {
    pub vehicle_id: String,
    pub route_id: String,
    pub lat: f32,
    pub lon: f32,
    /// Speed in m/s (reserved for future per-vehicle speed assets).
    #[allow(dead_code)]
    pub speed: Option<f32>,
}

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
    /// Individual vehicle positions extracted from VehiclePosition entities.
    individual_vehicles: Vec<CachedVehicle>,
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

        // Count vehicle positions and collect individual GPS data
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

                // Extract individual vehicle position for dynamic tracking.
                // Try multiple ID sources: VehicleDescriptor > entity ID > trip_id
                // Note: MTA subway feeds have VehiclePosition entities but with
                // has_pos=false (no GPS). Dynamic tracking only works for agencies
                // that populate the Position field (e.g. bus feeds, non-MTA).
                let vehicle_id = vp
                    .vehicle
                    .as_ref()
                    .and_then(|v| v.id.clone().or_else(|| v.label.clone()))
                    .or_else(|| {
                        let eid = &entity.id;
                        if !eid.is_empty() { Some(eid.clone()) } else { None }
                    })
                    .or_else(|| {
                        vp.trip.as_ref().and_then(|t| t.trip_id.clone())
                    });

                if let Some(vid) = vehicle_id {
                    if !vid.is_empty() && (pos.latitude != 0.0 || pos.longitude != 0.0) {
                        let route_id = vp
                            .trip
                            .as_ref()
                            .and_then(|t| t.route_id.clone())
                            .unwrap_or_else(|| "UNK".to_string());

                        metrics.individual_vehicles.push(CachedVehicle {
                            vehicle_id: vid,
                            route_id,
                            lat: pos.latitude,
                            lon: pos.longitude,
                            speed: pos.speed,
                        });
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
///
/// Dynamic per-vehicle GPS assets are generated from VehiclePosition entities
/// and cached in `cached_vehicles` (same pattern as MilAircraftMarketSource).
pub struct GtfsRtMarketSource {
    http: reqwest::Client,
    /// Cached vehicle states from last fetch (used by fetch_assets for dynamic assets).
    cached_vehicles: Mutex<Vec<CachedVehicle>>,
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

        Self {
            http,
            cached_vehicles: Mutex::new(Vec::new()),
        }
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
    /// Also collects individual vehicle positions into `cached_vehicles`.
    async fn fetch_all_metrics(&self) -> HashMap<String, AgencyMetrics> {
        let mut agency_metrics: HashMap<String, AgencyMetrics> = HashMap::new();
        let mut all_vehicles: Vec<CachedVehicle> = Vec::new();

        for feed in FEEDS {
            match self.fetch_feed(feed).await {
                Ok(feed_msg) => {
                    let metrics = extract_metrics(&feed_msg);

                    debug!(
                        "{}: {} trip_updates, {} vehicle_positions, {} individual vehicles",
                        feed.label,
                        metrics.trip_update_count,
                        metrics.vehicle_position_count,
                        metrics.individual_vehicles.len()
                    );

                    // Collect individual vehicle positions
                    all_vehicles.extend(metrics.individual_vehicles);

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

        // Cap at MAX_VEHICLES and update cached state
        all_vehicles.truncate(MAX_VEHICLES);
        {
            let mut cached = self.cached_vehicles.lock().unwrap();
            *cached = all_vehicles;
            debug!("GTFS-RT: cached {} individual vehicle positions", cached.len());
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
        // Static assets from config JSON
        let mut assets = load_assets_from_json(ASSET_JSON)?;
        let static_count = assets.len();

        // Dynamic assets from cached vehicle positions
        let cached = self.cached_vehicles.lock().unwrap().clone();
        if !cached.is_empty() {
            let dynamic = build_dynamic_assets(&cached);
            info!(
                "GTFS-RT fetch_assets: {} static + {} dynamic vehicle assets",
                static_count,
                dynamic.len()
            );
            assets.extend(dynamic);
        } else {
            info!(
                "GTFS-RT fetch_assets: {} static assets (no cached vehicles yet)",
                static_count
            );
        }

        Ok(assets)
    }

    async fn fetch_prices(&self, asset_ids: &[String]) -> Result<Vec<PriceUpdate>> {
        if asset_ids.is_empty() {
            return Ok(Vec::new());
        }

        let now = Utc::now();
        let agency_metrics = self.fetch_all_metrics().await;

        let mut results = Vec::with_capacity(asset_ids.len());

        // Process static aggregate assets
        for asset_id in asset_ids {
            if asset_id.starts_with("transit_veh_") {
                // Dynamic vehicle assets are handled below
                continue;
            }

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

        // Process dynamic per-vehicle asset requests
        let cached = self.cached_vehicles.lock().unwrap().clone();
        let dynamic_prices = build_dynamic_prices(&cached, asset_ids, now);
        let dynamic_count = dynamic_prices.len();
        let cached_count = cached.len();
        results.extend(dynamic_prices);

        // Log summary
        for (agency, metrics) in &agency_metrics {
            info!(
                "GTFS-RT {}: {} active trips, {} vehicle positions",
                agency, metrics.total_trips, metrics.total_vehicles
            );
        }

        info!(
            "GTFS-RT: fetched {}/{} prices ({} static, {} dynamic, {} vehicles cached)",
            results.len(),
            asset_ids.len(),
            results.len() - dynamic_count,
            dynamic_count,
            cached_count
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
// DYNAMIC VEHICLE HELPERS (pub for testing)
// ============================================================================

/// Sanitize a vehicle ID for use in asset_id: replace non-alphanumeric chars with underscore.
pub fn sanitize_vehicle_id(raw: &str) -> String {
    raw.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect()
}

/// Sanitize a route ID for use in asset_id/symbol: keep only alphanumeric chars.
pub fn sanitize_route_id(raw: &str) -> String {
    raw.chars().filter(|c| c.is_alphanumeric()).collect()
}

/// Convert f32 to Decimal, rounding to 6 decimal places.
fn decimal_from_f32(v: f32) -> Decimal {
    Decimal::from_f32_retain(v)
        .unwrap_or(Decimal::ZERO)
        .round_dp(6)
}

/// Build dynamic asset updates for individual vehicle GPS data.
pub fn build_dynamic_assets(vehicles: &[CachedVehicle]) -> Vec<AssetUpdate> {
    let mut assets = Vec::new();

    for v in vehicles {
        let safe_vid = sanitize_vehicle_id(&v.vehicle_id);
        let safe_route = sanitize_route_id(&v.route_id);
        let base_id = format!("transit_veh_{}_{}", safe_vid, safe_route);

        // Latitude asset
        assets.push(AssetUpdate {
            asset_id: format!("{}_lat", base_id),
            symbol: format!("TRANSIT/{}_{}_LAT", safe_route.to_uppercase(), safe_vid),
            name: format!("MTA {} Train {} Latitude", v.route_id, v.vehicle_id),
            category: Some("transport".to_string()),
            metadata: serde_json::json!({
                "api_ref": format!("gps:{}:{}:lat", v.route_id, v.vehicle_id),
                "subcategory": "transit",
                "active": true,
                "extra": {
                    "vehicle_id": v.vehicle_id,
                    "route_id": v.route_id,
                    "metric": "latitude",
                },
            }),
        });

        // Longitude asset
        assets.push(AssetUpdate {
            asset_id: format!("{}_lon", base_id),
            symbol: format!("TRANSIT/{}_{}_LON", safe_route.to_uppercase(), safe_vid),
            name: format!("MTA {} Train {} Longitude", v.route_id, v.vehicle_id),
            category: Some("transport".to_string()),
            metadata: serde_json::json!({
                "api_ref": format!("gps:{}:{}:lon", v.route_id, v.vehicle_id),
                "subcategory": "transit",
                "active": true,
                "extra": {
                    "vehicle_id": v.vehicle_id,
                    "route_id": v.route_id,
                    "metric": "longitude",
                },
            }),
        });
    }

    assets
}

/// Build dynamic price updates for individual vehicle GPS data.
fn build_dynamic_prices(
    vehicles: &[CachedVehicle],
    asset_ids: &[String],
    now: chrono::DateTime<Utc>,
) -> Vec<PriceUpdate> {
    let mut results = Vec::new();
    let requested: HashSet<&str> = asset_ids.iter().map(|s| s.as_str()).collect();

    for v in vehicles {
        let safe_vid = sanitize_vehicle_id(&v.vehicle_id);
        let safe_route = sanitize_route_id(&v.route_id);
        let base_id = format!("transit_veh_{}_{}", safe_vid, safe_route);

        // Latitude
        let lat_id = format!("{}_lat", base_id);
        if requested.contains(lat_id.as_str()) {
            results.push(PriceUpdate {
                asset_id: lat_id,
                symbol: format!("TRANSIT/{}_{}_LAT", safe_route.to_uppercase(), safe_vid),
                value: decimal_from_f32(v.lat),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }

        // Longitude
        let lon_id = format!("{}_lon", base_id);
        if requested.contains(lon_id.as_str()) {
            results.push(PriceUpdate {
                asset_id: lon_id,
                symbol: format!("TRANSIT/{}_{}_LON", safe_route.to_uppercase(), safe_vid),
                value: decimal_from_f32(v.lon),
                prev_close: None,
                change_pct: None,
                volume_24h: None,
                market_cap: None,
                fetched_at: now,
            });
        }
    }

    results
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

    // ========================================================================
    // Dynamic vehicle asset generation tests
    // ========================================================================

    #[test]
    fn test_dynamic_vehicle_asset_generation() {
        let vehicles = vec![
            CachedVehicle {
                vehicle_id: "0A".to_string(),
                route_id: "A".to_string(),
                lat: 40.7128,
                lon: -74.006,
                speed: Some(10.0),
            },
            CachedVehicle {
                vehicle_id: "1B".to_string(),
                route_id: "L".to_string(),
                lat: 40.7500,
                lon: -73.950,
                speed: None,
            },
        ];

        let assets = build_dynamic_assets(&vehicles);

        // 2 vehicles * 2 assets each (lat + lon) = 4
        assert_eq!(assets.len(), 4, "Expected 4 dynamic assets for 2 vehicles");

        // Verify first vehicle lat
        assert_eq!(assets[0].asset_id, "transit_veh_0A_A_lat");
        assert_eq!(assets[0].symbol, "TRANSIT/A_0A_LAT");
        assert_eq!(assets[0].name, "MTA A Train 0A Latitude");
        assert_eq!(assets[0].category, Some("transport".to_string()));

        // Verify first vehicle lon
        assert_eq!(assets[1].asset_id, "transit_veh_0A_A_lon");
        assert_eq!(assets[1].symbol, "TRANSIT/A_0A_LON");
        assert_eq!(assets[1].name, "MTA A Train 0A Longitude");

        // Verify second vehicle lat
        assert_eq!(assets[2].asset_id, "transit_veh_1B_L_lat");
        assert_eq!(assets[2].symbol, "TRANSIT/L_1B_LAT");
        assert_eq!(assets[2].name, "MTA L Train 1B Latitude");

        // Verify second vehicle lon
        assert_eq!(assets[3].asset_id, "transit_veh_1B_L_lon");
        assert_eq!(assets[3].symbol, "TRANSIT/L_1B_LON");
    }

    #[test]
    fn test_dynamic_vehicle_price_resolution() {
        let vehicles = vec![
            CachedVehicle {
                vehicle_id: "T42".to_string(),
                route_id: "7".to_string(),
                lat: 40.7500,
                lon: -73.9000,
                speed: Some(12.5),
            },
        ];

        let now = Utc::now();
        let asset_ids = vec![
            "transit_veh_T42_7_lat".to_string(),
            "transit_veh_T42_7_lon".to_string(),
            "transit_mta_active_trips".to_string(), // static, should be skipped
        ];

        let prices = build_dynamic_prices(&vehicles, &asset_ids, now);

        assert_eq!(prices.len(), 2, "Expected 2 prices (lat + lon)");

        // Verify latitude price
        let lat_price = prices.iter().find(|p| p.asset_id == "transit_veh_T42_7_lat").unwrap();
        assert_eq!(lat_price.symbol, "TRANSIT/7_T42_LAT");
        let lat_val: f64 = lat_price.value.try_into().unwrap();
        assert!((lat_val - 40.75).abs() < 0.001, "Latitude should be ~40.75, got {}", lat_val);

        // Verify longitude price
        let lon_price = prices.iter().find(|p| p.asset_id == "transit_veh_T42_7_lon").unwrap();
        assert_eq!(lon_price.symbol, "TRANSIT/7_T42_LON");
        let lon_val: f64 = lon_price.value.try_into().unwrap();
        assert!((lon_val - (-73.9)).abs() < 0.001, "Longitude should be ~-73.9, got {}", lon_val);
    }

    #[test]
    fn test_vehicle_id_sanitization() {
        // Dashes, dots, slashes should become underscores
        assert_eq!(sanitize_vehicle_id("train-42.1/A"), "train_42_1_A");
        // Pure alphanumeric should pass through
        assert_eq!(sanitize_vehicle_id("ABC123"), "ABC123");
        // Empty string
        assert_eq!(sanitize_vehicle_id(""), "");
        // All special chars
        assert_eq!(sanitize_vehicle_id("!@#$%"), "_____");

        // Route sanitization strips non-alphanumeric entirely
        assert_eq!(sanitize_route_id("A-Express"), "AExpress");
        assert_eq!(sanitize_route_id("7X"), "7X");
        assert_eq!(sanitize_route_id(""), "");
    }

    #[test]
    fn test_max_vehicle_cap() {
        // Create 600 vehicles (above MAX_VEHICLES=500)
        let mut vehicles: Vec<CachedVehicle> = Vec::new();
        for i in 0..600 {
            vehicles.push(CachedVehicle {
                vehicle_id: format!("V{}", i),
                route_id: "A".to_string(),
                lat: 40.0 + (i as f32) * 0.001,
                lon: -74.0 + (i as f32) * 0.001,
                speed: None,
            });
        }

        // Simulate what fetch_all_metrics does
        vehicles.truncate(MAX_VEHICLES);
        assert_eq!(vehicles.len(), 500, "Should be capped at 500 vehicles");

        // Verify assets are generated only for the capped set
        let assets = build_dynamic_assets(&vehicles);
        assert_eq!(assets.len(), 1000, "500 vehicles * 2 (lat+lon) = 1000 assets");
    }

    #[test]
    fn test_extract_metrics_collects_individual_vehicles() {
        use super::super::proto::*;

        let feed = FeedMessage {
            header: Some(FeedHeader {
                gtfs_realtime_version: "2.0".to_string(),
                timestamp: Some(1700000000),
            }),
            entity: vec![
                // Vehicle with full data
                FeedEntity {
                    id: "vp1".to_string(),
                    is_deleted: None,
                    trip_update: None,
                    vehicle: Some(VehiclePosition {
                        trip: Some(TripDescriptor {
                            trip_id: Some("trip_1".to_string()),
                            route_id: Some("L".to_string()),
                            direction_id: None,
                            start_time: None,
                            start_date: None,
                        }),
                        position: Some(Position {
                            latitude: 40.7128,
                            longitude: -74.006,
                            bearing: None,
                            speed: Some(10.0),
                        }),
                        vehicle: Some(VehicleDescriptor {
                            id: Some("VEH001".to_string()),
                            label: Some("Train 42".to_string()),
                            license_plate: None,
                        }),
                        timestamp: None,
                    }),
                },
                // Vehicle without descriptor (should not be collected)
                FeedEntity {
                    id: "vp2".to_string(),
                    is_deleted: None,
                    trip_update: None,
                    vehicle: Some(VehiclePosition {
                        trip: None,
                        position: Some(Position {
                            latitude: 40.0,
                            longitude: -74.0,
                            bearing: None,
                            speed: None,
                        }),
                        vehicle: None,
                        timestamp: None,
                    }),
                },
                // Vehicle with label only (no id) — should use label
                FeedEntity {
                    id: "vp3".to_string(),
                    is_deleted: None,
                    trip_update: None,
                    vehicle: Some(VehiclePosition {
                        trip: Some(TripDescriptor {
                            trip_id: None,
                            route_id: Some("7".to_string()),
                            direction_id: None,
                            start_time: None,
                            start_date: None,
                        }),
                        position: Some(Position {
                            latitude: 40.75,
                            longitude: -73.95,
                            bearing: None,
                            speed: None,
                        }),
                        vehicle: Some(VehicleDescriptor {
                            id: None,
                            label: Some("Express99".to_string()),
                            license_plate: None,
                        }),
                        timestamp: None,
                    }),
                },
                // Vehicle without route (should default to UNK)
                FeedEntity {
                    id: "vp4".to_string(),
                    is_deleted: None,
                    trip_update: None,
                    vehicle: Some(VehiclePosition {
                        trip: None,
                        position: Some(Position {
                            latitude: 40.8,
                            longitude: -73.9,
                            bearing: None,
                            speed: Some(5.0),
                        }),
                        vehicle: Some(VehicleDescriptor {
                            id: Some("VEH999".to_string()),
                            label: None,
                            license_plate: None,
                        }),
                        timestamp: None,
                    }),
                },
            ],
        };

        let metrics = extract_metrics(&feed);

        // All 4 entities have vehicle positions
        assert_eq!(metrics.vehicle_position_count, 4);

        // But only 3 have vehicle descriptors with IDs
        assert_eq!(
            metrics.individual_vehicles.len(),
            3,
            "Should collect 3 vehicles (1 without descriptor is skipped)"
        );

        // Verify first vehicle
        assert_eq!(metrics.individual_vehicles[0].vehicle_id, "VEH001");
        assert_eq!(metrics.individual_vehicles[0].route_id, "L");
        assert!((metrics.individual_vehicles[0].lat - 40.7128).abs() < 0.001);

        // Verify label-only vehicle
        assert_eq!(metrics.individual_vehicles[1].vehicle_id, "Express99");
        assert_eq!(metrics.individual_vehicles[1].route_id, "7");

        // Verify no-route vehicle defaults to UNK
        assert_eq!(metrics.individual_vehicles[2].vehicle_id, "VEH999");
        assert_eq!(metrics.individual_vehicles[2].route_id, "UNK");
    }

    #[test]
    fn test_dynamic_assets_empty_vehicles() {
        let vehicles: Vec<CachedVehicle> = vec![];
        let assets = build_dynamic_assets(&vehicles);
        assert!(assets.is_empty(), "No vehicles should produce no assets");
    }

    #[test]
    fn test_dynamic_prices_unrequested_assets() {
        let vehicles = vec![CachedVehicle {
            vehicle_id: "T1".to_string(),
            route_id: "A".to_string(),
            lat: 40.0,
            lon: -74.0,
            speed: None,
        }];

        let now = Utc::now();
        // Request only static assets, no dynamic ones
        let asset_ids = vec!["transit_mta_active_trips".to_string()];
        let prices = build_dynamic_prices(&vehicles, &asset_ids, now);
        assert!(prices.is_empty(), "Should not return prices for unrequested dynamic assets");
    }

    #[test]
    fn test_decimal_from_f32_precision() {
        let val = decimal_from_f32(40.712776);
        // f32 has ~7 significant digits, so we expect approximately 40.712776
        let f: f64 = val.try_into().unwrap();
        assert!((f - 40.712776).abs() < 0.001, "Expected ~40.712776, got {}", f);

        let neg = decimal_from_f32(-74.005974);
        let f2: f64 = neg.try_into().unwrap();
        assert!((f2 - (-74.005974)).abs() < 0.001, "Expected ~-74.005974, got {}", f2);

        let zero = decimal_from_f32(0.0);
        assert_eq!(zero, Decimal::ZERO);
    }
}
