//! Health status types for AP service
//!
//! Defines health status enum and response structures for the /health endpoint.

use serde::{Deserialize, Serialize};

/// Health status for the AP service
///
/// Determined by monitoring thresholds:
/// - `Healthy`: All metrics within normal bounds
/// - `Degraded`: Warning thresholds exceeded (queue_depth > 100, violations > 0)
/// - `Unhealthy`: Critical thresholds exceeded (queue_depth > 500, violations > 3)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    /// All metrics within normal bounds
    Healthy,
    /// Warning thresholds exceeded, but still operational
    Degraded,
    /// Critical thresholds exceeded, service impaired
    Unhealthy,
}

impl HealthStatus {
    /// Get string representation for API response
    pub fn as_str(&self) -> &'static str {
        match self {
            HealthStatus::Healthy => "healthy",
            HealthStatus::Degraded => "degraded",
            HealthStatus::Unhealthy => "unhealthy",
        }
    }

    /// Check if status is healthy
    pub fn is_healthy(&self) -> bool {
        matches!(self, HealthStatus::Healthy)
    }

    /// Check if status is degraded or worse
    pub fn is_degraded_or_worse(&self) -> bool {
        !matches!(self, HealthStatus::Healthy)
    }

    /// Check if status is unhealthy
    pub fn is_unhealthy(&self) -> bool {
        matches!(self, HealthStatus::Unhealthy)
    }

}

impl std::fmt::Display for HealthStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Full health details for /health endpoint JSON response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthDetails {
    /// Current health status string ("healthy", "degraded", "unhealthy")
    pub status: String,
    /// Service name
    pub service: String,
    /// ISO8601 timestamp
    pub timestamp: String,
    /// Current metrics snapshot
    pub metrics: MetricsSnapshot,
    /// Threshold configuration
    pub thresholds: Thresholds,
}

/// Snapshot of all metrics at a point in time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    /// Current order queue depth
    pub queue_depth: u64,
    /// Limit violations in last 24 hours
    pub violations_24h: u64,
    /// Order timeouts in last 24 hours
    pub timeouts_24h: u64,
    /// Total orders processed successfully
    pub orders_processed: u64,
    /// Total orders that failed
    pub orders_failed: u64,
    /// Total events received from EventMonitor
    pub events_received: u64,
    /// Average fill time in milliseconds (rolling window)
    pub avg_fill_time_ms: u64,
    /// Buffer balance in USD
    pub buffer_balance_usd: f64,
}

/// Threshold values for health status determination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thresholds {
    /// Queue depth that triggers degraded status
    pub queue_depth_warning: u64,
    /// Queue depth that triggers unhealthy status
    pub queue_depth_critical: u64,
    /// Violations count that triggers degraded status
    pub violations_degraded: u64,
    /// Violations count that triggers unhealthy status
    pub violations_unhealthy: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_as_str() {
        assert_eq!(HealthStatus::Healthy.as_str(), "healthy");
        assert_eq!(HealthStatus::Degraded.as_str(), "degraded");
        assert_eq!(HealthStatus::Unhealthy.as_str(), "unhealthy");
    }

    #[test]
    fn test_health_status_is_methods() {
        assert!(HealthStatus::Healthy.is_healthy());
        assert!(!HealthStatus::Degraded.is_healthy());
        assert!(!HealthStatus::Unhealthy.is_healthy());

        assert!(!HealthStatus::Healthy.is_degraded_or_worse());
        assert!(HealthStatus::Degraded.is_degraded_or_worse());
        assert!(HealthStatus::Unhealthy.is_degraded_or_worse());

        assert!(!HealthStatus::Healthy.is_unhealthy());
        assert!(!HealthStatus::Degraded.is_unhealthy());
        assert!(HealthStatus::Unhealthy.is_unhealthy());
    }


    #[test]
    fn test_health_status_display() {
        assert_eq!(format!("{}", HealthStatus::Healthy), "healthy");
        assert_eq!(format!("{}", HealthStatus::Degraded), "degraded");
        assert_eq!(format!("{}", HealthStatus::Unhealthy), "unhealthy");
    }

    #[test]
    fn test_health_details_serialization() {
        let details = HealthDetails {
            status: "healthy".to_string(),
            service: "ap".to_string(),
            timestamp: "2026-01-29T12:00:00Z".to_string(),
            metrics: MetricsSnapshot {
                queue_depth: 45,
                violations_24h: 0,
                timeouts_24h: 2,
                orders_processed: 12345,
                orders_failed: 5,
                events_received: 12500,
                avg_fill_time_ms: 150,
                buffer_balance_usd: 850.00,
            },
            thresholds: Thresholds {
                queue_depth_warning: 100,
                queue_depth_critical: 500,
                violations_degraded: 0,  // Degraded when > 0
                violations_unhealthy: 3, // Unhealthy when > 3
            },
        };

        let json = serde_json::to_string_pretty(&details).unwrap();
        assert!(json.contains("\"status\": \"healthy\""));
        assert!(json.contains("\"queue_depth\": 45"));
        assert!(json.contains("\"buffer_balance_usd\": 850.0"));
        assert!(json.contains("\"events_received\": 12500"));
    }

    #[test]
    fn test_metrics_snapshot_serialization() {
        let snapshot = MetricsSnapshot {
            queue_depth: 100,
            violations_24h: 1,
            timeouts_24h: 3,
            orders_processed: 5000,
            orders_failed: 10,
            events_received: 5100,
            avg_fill_time_ms: 200,
            buffer_balance_usd: 1000.50,
        };

        let json = serde_json::to_string(&snapshot).unwrap();
        let deserialized: MetricsSnapshot = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.queue_depth, 100);
        assert_eq!(deserialized.violations_24h, 1);
        assert_eq!(deserialized.events_received, 5100);
        assert!((deserialized.buffer_balance_usd - 1000.50).abs() < 0.01);
    }
}
