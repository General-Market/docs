//! Heartbeat metrics for monitoring
//!
//! Provides atomic counters for heartbeat monitoring metrics.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};

/// Metrics for heartbeat monitoring
#[derive(Debug, Default)]
pub struct HeartbeatMetrics {
    /// Total number of heartbeats sent
    pub heartbeats_sent: AtomicU64,
    /// Total number of heartbeats received
    pub heartbeats_received: AtomicU64,
    /// Current count of healthy peers
    pub peers_healthy: AtomicU32,
    /// Current count of unhealthy peers
    pub peers_unhealthy: AtomicU32,
    /// Total kick vote proposals made
    pub kick_votes_proposed: AtomicU64,
    /// Time of last health check in milliseconds (unix epoch)
    pub last_check_time_ms: AtomicU64,
}

impl HeartbeatMetrics {
    /// Create new metrics with all counters at zero
    pub fn new() -> Self {
        Self::default()
    }

    /// Increment heartbeats sent counter
    pub fn increment_heartbeats_sent(&self) {
        self.heartbeats_sent.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment heartbeats received counter
    pub fn increment_heartbeats_received(&self) {
        self.heartbeats_received.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment kick votes proposed counter
    pub fn increment_kick_votes_proposed(&self) {
        self.kick_votes_proposed.fetch_add(1, Ordering::Relaxed);
    }

    /// Update peer health counts
    pub fn update_peer_counts(&self, healthy: u32, unhealthy: u32) {
        self.peers_healthy.store(healthy, Ordering::Relaxed);
        self.peers_unhealthy.store(unhealthy, Ordering::Relaxed);
    }

    /// Update last check time
    pub fn update_last_check_time(&self, time_ms: u64) {
        self.last_check_time_ms.store(time_ms, Ordering::Relaxed);
    }

    /// Get total heartbeats sent
    pub fn get_heartbeats_sent(&self) -> u64 {
        self.heartbeats_sent.load(Ordering::Relaxed)
    }

    /// Get total heartbeats received
    pub fn get_heartbeats_received(&self) -> u64 {
        self.heartbeats_received.load(Ordering::Relaxed)
    }

    /// Get current healthy peer count
    pub fn get_peers_healthy(&self) -> u32 {
        self.peers_healthy.load(Ordering::Relaxed)
    }

    /// Get current unhealthy peer count
    pub fn get_peers_unhealthy(&self) -> u32 {
        self.peers_unhealthy.load(Ordering::Relaxed)
    }

    /// Get total kick votes proposed
    pub fn get_kick_votes_proposed(&self) -> u64 {
        self.kick_votes_proposed.load(Ordering::Relaxed)
    }

    /// Get last check time in milliseconds
    pub fn get_last_check_time_ms(&self) -> u64 {
        self.last_check_time_ms.load(Ordering::Relaxed)
    }

    /// Convert metrics to JSON string for health endpoint
    pub fn to_json(&self) -> String {
        format!(
            r#"{{"heartbeats_sent":{},"heartbeats_received":{},"peers_healthy":{},"peers_unhealthy":{},"kick_votes_proposed":{},"last_check_time_ms":{}}}"#,
            self.get_heartbeats_sent(),
            self.get_heartbeats_received(),
            self.get_peers_healthy(),
            self.get_peers_unhealthy(),
            self.get_kick_votes_proposed(),
            self.get_last_check_time_ms(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_metrics_are_zero() {
        let metrics = HeartbeatMetrics::new();

        assert_eq!(metrics.get_heartbeats_sent(), 0);
        assert_eq!(metrics.get_heartbeats_received(), 0);
        assert_eq!(metrics.get_peers_healthy(), 0);
        assert_eq!(metrics.get_peers_unhealthy(), 0);
        assert_eq!(metrics.get_kick_votes_proposed(), 0);
        assert_eq!(metrics.get_last_check_time_ms(), 0);
    }

    #[test]
    fn test_increment_heartbeats_sent() {
        let metrics = HeartbeatMetrics::new();

        metrics.increment_heartbeats_sent();
        metrics.increment_heartbeats_sent();
        metrics.increment_heartbeats_sent();

        assert_eq!(metrics.get_heartbeats_sent(), 3);
    }

    #[test]
    fn test_increment_heartbeats_received() {
        let metrics = HeartbeatMetrics::new();

        metrics.increment_heartbeats_received();
        metrics.increment_heartbeats_received();

        assert_eq!(metrics.get_heartbeats_received(), 2);
    }

    #[test]
    fn test_increment_kick_votes_proposed() {
        let metrics = HeartbeatMetrics::new();

        metrics.increment_kick_votes_proposed();

        assert_eq!(metrics.get_kick_votes_proposed(), 1);
    }

    #[test]
    fn test_update_peer_counts() {
        let metrics = HeartbeatMetrics::new();

        metrics.update_peer_counts(15, 3);

        assert_eq!(metrics.get_peers_healthy(), 15);
        assert_eq!(metrics.get_peers_unhealthy(), 3);
    }

    #[test]
    fn test_update_last_check_time() {
        let metrics = HeartbeatMetrics::new();

        metrics.update_last_check_time(1706745600000);

        assert_eq!(metrics.get_last_check_time_ms(), 1706745600000);
    }

    #[test]
    fn test_to_json() {
        let metrics = HeartbeatMetrics::new();

        metrics.increment_heartbeats_sent();
        metrics.increment_heartbeats_sent();
        metrics.increment_heartbeats_received();
        metrics.update_peer_counts(10, 2);
        metrics.increment_kick_votes_proposed();
        metrics.update_last_check_time(1234567890);

        let json = metrics.to_json();

        assert!(json.contains("\"heartbeats_sent\":2"));
        assert!(json.contains("\"heartbeats_received\":1"));
        assert!(json.contains("\"peers_healthy\":10"));
        assert!(json.contains("\"peers_unhealthy\":2"));
        assert!(json.contains("\"kick_votes_proposed\":1"));
        assert!(json.contains("\"last_check_time_ms\":1234567890"));
    }
}
