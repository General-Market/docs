//! Hand-coded GTFS-Realtime protobuf definitions (from gtfs-realtime.proto)
//!
//! Only the fields we need for vehicle position and trip update tracking.
//! We manually define these using prost derive macros rather than using a build
//! script, since the GTFS-RT proto spec is simple and stable.

/// Top-level feed message containing header and entities.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct FeedMessage {
    /// Metadata about the feed (version, timestamp).
    #[prost(message, optional, tag = "1")]
    pub header: ::core::option::Option<FeedHeader>,
    /// Contents of the feed (vehicles, trip updates, alerts).
    #[prost(message, repeated, tag = "2")]
    pub entity: ::prost::alloc::vec::Vec<FeedEntity>,
}

/// Feed metadata.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct FeedHeader {
    /// Version of the GTFS-realtime specification (e.g. "2.0").
    #[prost(string, tag = "1")]
    pub gtfs_realtime_version: ::prost::alloc::string::String,
    /// Timestamp when the feed was generated (POSIX time).
    #[prost(uint64, optional, tag = "2")]
    pub timestamp: ::core::option::Option<u64>,
}

/// A single entity in the feed (vehicle, trip update, or alert).
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct FeedEntity {
    /// Unique identifier for this entity within the feed.
    #[prost(string, tag = "1")]
    pub id: ::prost::alloc::string::String,
    /// Whether this entity should be deleted (used for differential feeds).
    #[prost(bool, optional, tag = "2")]
    pub is_deleted: ::core::option::Option<bool>,
    /// Trip update data (arrival/departure predictions).
    #[prost(message, optional, tag = "3")]
    pub trip_update: ::core::option::Option<TripUpdate>,
    /// Real-time vehicle position data.
    #[prost(message, optional, tag = "4")]
    pub vehicle: ::core::option::Option<VehiclePosition>,
    // Note: tag 5 = Alert (not needed for our use case)
}

/// Real-time trip update with stop time predictions.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct TripUpdate {
    /// The trip this update applies to.
    #[prost(message, optional, tag = "1")]
    pub trip: ::core::option::Option<TripDescriptor>,
    /// The vehicle serving this trip (optional).
    #[prost(message, optional, tag = "3")]
    pub vehicle: ::core::option::Option<VehicleDescriptor>,
    /// Updates to arrival/departure times at individual stops.
    #[prost(message, repeated, tag = "2")]
    pub stop_time_update: ::prost::alloc::vec::Vec<StopTimeUpdate>,
    /// Feed-provider timestamp for this trip update.
    #[prost(uint64, optional, tag = "4")]
    pub timestamp: ::core::option::Option<u64>,
}

/// Predicted arrival/departure at a specific stop.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct StopTimeUpdate {
    /// Stop sequence index.
    #[prost(uint32, optional, tag = "1")]
    pub stop_sequence: ::core::option::Option<u32>,
    /// Stop ID.
    #[prost(string, optional, tag = "4")]
    pub stop_id: ::core::option::Option<::prost::alloc::string::String>,
    /// Predicted arrival time.
    #[prost(message, optional, tag = "2")]
    pub arrival: ::core::option::Option<StopTimeEvent>,
    /// Predicted departure time.
    #[prost(message, optional, tag = "3")]
    pub departure: ::core::option::Option<StopTimeEvent>,
}

/// A single arrival or departure event at a stop.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct StopTimeEvent {
    /// Delay in seconds (positive = late, negative = early).
    #[prost(int32, optional, tag = "1")]
    pub delay: ::core::option::Option<i32>,
    /// Predicted POSIX time of arrival/departure.
    #[prost(int64, optional, tag = "2")]
    pub time: ::core::option::Option<i64>,
    /// Uncertainty in seconds.
    #[prost(int32, optional, tag = "3")]
    pub uncertainty: ::core::option::Option<i32>,
}

/// Real-time vehicle position.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct VehiclePosition {
    /// The trip the vehicle is serving.
    #[prost(message, optional, tag = "1")]
    pub trip: ::core::option::Option<TripDescriptor>,
    /// Geographic position of the vehicle.
    #[prost(message, optional, tag = "2")]
    pub position: ::core::option::Option<Position>,
    /// Vehicle descriptor (ID, label, etc.).
    #[prost(message, optional, tag = "8")]
    pub vehicle: ::core::option::Option<VehicleDescriptor>,
    /// Timestamp of this position report (POSIX time).
    #[prost(uint64, optional, tag = "5")]
    pub timestamp: ::core::option::Option<u64>,
}

/// Geographic position (WGS 84).
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Position {
    /// Latitude in degrees (WGS 84).
    #[prost(float, tag = "1")]
    pub latitude: f32,
    /// Longitude in degrees (WGS 84).
    #[prost(float, tag = "2")]
    pub longitude: f32,
    /// Bearing in degrees (0 = North, 90 = East, clockwise).
    #[prost(float, optional, tag = "3")]
    pub bearing: ::core::option::Option<f32>,
    /// Speed in meters per second.
    #[prost(float, optional, tag = "4")]
    pub speed: ::core::option::Option<f32>,
}

/// Identifies a particular trip.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct TripDescriptor {
    /// The trip ID from the GTFS static feed.
    #[prost(string, optional, tag = "1")]
    pub trip_id: ::core::option::Option<::prost::alloc::string::String>,
    /// The route ID from the GTFS static feed.
    #[prost(string, optional, tag = "5")]
    pub route_id: ::core::option::Option<::prost::alloc::string::String>,
    /// Direction of travel (0 or 1).
    #[prost(uint32, optional, tag = "6")]
    pub direction_id: ::core::option::Option<u32>,
    /// Start time of the trip (HH:MM:SS format).
    #[prost(string, optional, tag = "2")]
    pub start_time: ::core::option::Option<::prost::alloc::string::String>,
    /// Start date of the trip (YYYYMMDD format).
    #[prost(string, optional, tag = "3")]
    pub start_date: ::core::option::Option<::prost::alloc::string::String>,
}

/// Identifies a vehicle.
#[derive(Clone, PartialEq, ::prost::Message)]
pub struct VehicleDescriptor {
    /// Internal system ID of the vehicle.
    #[prost(string, optional, tag = "1")]
    pub id: ::core::option::Option<::prost::alloc::string::String>,
    /// User-visible label (e.g. train number).
    #[prost(string, optional, tag = "2")]
    pub label: ::core::option::Option<::prost::alloc::string::String>,
    /// License plate number.
    #[prost(string, optional, tag = "3")]
    pub license_plate: ::core::option::Option<::prost::alloc::string::String>,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use prost::Message;

    #[test]
    fn test_empty_feed_roundtrip() {
        let feed = FeedMessage {
            header: Some(FeedHeader {
                gtfs_realtime_version: "2.0".to_string(),
                timestamp: Some(1700000000),
            }),
            entity: vec![],
        };

        let bytes = feed.encode_to_vec();
        let decoded = FeedMessage::decode(bytes.as_slice()).unwrap();

        assert_eq!(decoded.header.as_ref().unwrap().gtfs_realtime_version, "2.0");
        assert_eq!(decoded.header.as_ref().unwrap().timestamp, Some(1700000000));
        assert!(decoded.entity.is_empty());
    }

    #[test]
    fn test_feed_with_trip_update() {
        let feed = FeedMessage {
            header: Some(FeedHeader {
                gtfs_realtime_version: "2.0".to_string(),
                timestamp: Some(1700000000),
            }),
            entity: vec![FeedEntity {
                id: "trip1".to_string(),
                is_deleted: None,
                trip_update: Some(TripUpdate {
                    trip: Some(TripDescriptor {
                        trip_id: Some("A20250222_0800".to_string()),
                        route_id: Some("A".to_string()),
                        direction_id: Some(0),
                        start_time: None,
                        start_date: None,
                    }),
                    vehicle: None,
                    stop_time_update: vec![StopTimeUpdate {
                        stop_sequence: Some(1),
                        stop_id: Some("A01".to_string()),
                        arrival: Some(StopTimeEvent {
                            delay: Some(30),
                            time: Some(1700000030),
                            uncertainty: None,
                        }),
                        departure: None,
                    }],
                    timestamp: Some(1700000000),
                }),
                vehicle: None,
            }],
        };

        let bytes = feed.encode_to_vec();
        let decoded = FeedMessage::decode(bytes.as_slice()).unwrap();

        assert_eq!(decoded.entity.len(), 1);
        let entity = &decoded.entity[0];
        assert_eq!(entity.id, "trip1");
        let tu = entity.trip_update.as_ref().unwrap();
        assert_eq!(tu.trip.as_ref().unwrap().route_id, Some("A".to_string()));
        assert_eq!(tu.stop_time_update.len(), 1);
        assert_eq!(tu.stop_time_update[0].arrival.as_ref().unwrap().delay, Some(30));
    }

    #[test]
    fn test_feed_with_vehicle_position() {
        let feed = FeedMessage {
            header: Some(FeedHeader {
                gtfs_realtime_version: "2.0".to_string(),
                timestamp: Some(1700000000),
            }),
            entity: vec![FeedEntity {
                id: "veh1".to_string(),
                is_deleted: None,
                trip_update: None,
                vehicle: Some(VehiclePosition {
                    trip: Some(TripDescriptor {
                        trip_id: Some("trip_42".to_string()),
                        route_id: Some("L".to_string()),
                        direction_id: None,
                        start_time: None,
                        start_date: None,
                    }),
                    position: Some(Position {
                        latitude: 40.7128,
                        longitude: -74.0060,
                        bearing: Some(180.0),
                        speed: Some(12.5),
                    }),
                    vehicle: Some(VehicleDescriptor {
                        id: Some("veh_001".to_string()),
                        label: Some("Train 42".to_string()),
                        license_plate: None,
                    }),
                    timestamp: Some(1700000000),
                }),
            }],
        };

        let bytes = feed.encode_to_vec();
        let decoded = FeedMessage::decode(bytes.as_slice()).unwrap();

        assert_eq!(decoded.entity.len(), 1);
        let veh = decoded.entity[0].vehicle.as_ref().unwrap();
        let pos = veh.position.as_ref().unwrap();
        assert!((pos.latitude - 40.7128).abs() < 0.001);
        assert!((pos.longitude - (-74.0060)).abs() < 0.001);
        assert_eq!(pos.speed, Some(12.5));
        assert_eq!(veh.vehicle.as_ref().unwrap().label, Some("Train 42".to_string()));
    }

    #[test]
    fn test_decode_empty_bytes() {
        // Empty bytes should decode to an empty FeedMessage
        let decoded = FeedMessage::decode(&[] as &[u8]).unwrap();
        assert!(decoded.header.is_none());
        assert!(decoded.entity.is_empty());
    }

    #[test]
    fn test_mixed_entity_types() {
        let feed = FeedMessage {
            header: Some(FeedHeader {
                gtfs_realtime_version: "2.0".to_string(),
                timestamp: Some(1700000000),
            }),
            entity: vec![
                // Trip update entity
                FeedEntity {
                    id: "tu1".to_string(),
                    is_deleted: None,
                    trip_update: Some(TripUpdate {
                        trip: Some(TripDescriptor {
                            trip_id: Some("trip_1".to_string()),
                            route_id: Some("1".to_string()),
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
                // Vehicle position entity
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
                            speed: None,
                        }),
                        vehicle: None,
                        timestamp: None,
                    }),
                },
                // Entity with neither (e.g., alert placeholder)
                FeedEntity {
                    id: "alert1".to_string(),
                    is_deleted: None,
                    trip_update: None,
                    vehicle: None,
                },
            ],
        };

        let bytes = feed.encode_to_vec();
        let decoded = FeedMessage::decode(bytes.as_slice()).unwrap();

        assert_eq!(decoded.entity.len(), 3);

        // Count entity types
        let trip_updates = decoded.entity.iter().filter(|e| e.trip_update.is_some()).count();
        let vehicle_positions = decoded.entity.iter().filter(|e| e.vehicle.is_some()).count();
        let neither = decoded
            .entity
            .iter()
            .filter(|e| e.trip_update.is_none() && e.vehicle.is_none())
            .count();

        assert_eq!(trip_updates, 1);
        assert_eq!(vehicle_positions, 1);
        assert_eq!(neither, 1);
    }
}
