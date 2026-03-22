//! Timeout metrics tracking
//!
//! Tracks timeout counts, retries, failures, and in-flight orders.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tokio::time::Instant;

/// Time-bucketed record for windowed counting
#[derive(Debug, Clone)]
struct TimeRecord {
    timestamp: Instant,
    count: u64,
}

/// Timeout metrics collector
pub struct TimeoutMetrics {
    /// Total number of order timeouts
    timeouts_total: AtomicU64,
    /// Total number of order retries
    retries_total: AtomicU64,
    /// Total number of permanently failed orders
    failures_total: AtomicU64,
    /// Current number of orders being tracked
    in_flight: AtomicU64,
    /// Time-bucketed timeout records for windowed queries
    timeout_records: Mutex<VecDeque<TimeRecord>>,
    /// Window retention period
    retention_period: Duration,
}

impl TimeoutMetrics {
    /// Create new metrics collector
    pub fn new() -> Self {
        Self::with_retention(Duration::from_secs(3600)) // 1 hour default
    }

    /// Create metrics collector with custom retention period
    pub fn with_retention(retention_period: Duration) -> Self {
        Self {
            timeouts_total: AtomicU64::new(0),
            retries_total: AtomicU64::new(0),
            failures_total: AtomicU64::new(0),
            in_flight: AtomicU64::new(0),
            timeout_records: Mutex::new(VecDeque::new()),
            retention_period,
        }
    }

    /// Record a timeout event
    pub fn record_timeout(&self) {
        self.timeouts_total.fetch_add(1, Ordering::SeqCst);

        // Add time-bucketed record
        if let Ok(mut records) = self.timeout_records.lock() {
            records.push_back(TimeRecord {
                timestamp: Instant::now(),
                count: 1,
            });

            // Clean up old records
            let cutoff = Instant::now() - self.retention_period;
            while let Some(front) = records.front() {
                if front.timestamp < cutoff {
                    records.pop_front();
                } else {
                    break;
                }
            }
        }
    }

    /// Record a retry event
    pub fn record_retry(&self) {
        self.retries_total.fetch_add(1, Ordering::SeqCst);
    }

    /// Record a permanent failure
    pub fn record_failure(&self) {
        self.failures_total.fetch_add(1, Ordering::SeqCst);
    }

    /// Increment in-flight counter
    pub fn increment_in_flight(&self) {
        self.in_flight.fetch_add(1, Ordering::SeqCst);
    }

    /// Decrement in-flight counter
    pub fn decrement_in_flight(&self) {
        // Atomically decrement, clamping at 0 to prevent underflow
        let _ = self.in_flight.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |val| {
            Some(val.saturating_sub(1))
        });
    }

    /// Get count of timeouts within a time window
    pub fn get_timeout_count(&self, time_window: Duration) -> u64 {
        if let Ok(records) = self.timeout_records.lock() {
            let cutoff = Instant::now() - time_window;
            records
                .iter()
                .filter(|r| r.timestamp >= cutoff)
                .map(|r| r.count)
                .sum()
        } else {
            0
        }
    }

    /// Get total timeout count (all time)
    pub fn total_timeouts(&self) -> u64 {
        self.timeouts_total.load(Ordering::SeqCst)
    }

    /// Get total retry count (all time)
    pub fn total_retries(&self) -> u64 {
        self.retries_total.load(Ordering::SeqCst)
    }

    /// Get total failure count (all time)
    pub fn total_failures(&self) -> u64 {
        self.failures_total.load(Ordering::SeqCst)
    }

    /// Get current in-flight count
    pub fn current_in_flight(&self) -> u64 {
        self.in_flight.load(Ordering::SeqCst)
    }

    /// Get snapshot of all metrics
    pub fn snapshot(&self) -> TimeoutMetricsSnapshot {
        TimeoutMetricsSnapshot {
            timeouts_total: self.total_timeouts(),
            retries_total: self.total_retries(),
            failures_total: self.total_failures(),
            in_flight: self.current_in_flight(),
        }
    }

}

impl Default for TimeoutMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Snapshot of timeout metrics at a point in time
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TimeoutMetricsSnapshot {
    /// Total number of order timeouts
    pub timeouts_total: u64,
    /// Total number of order retries
    pub retries_total: u64,
    /// Total number of permanently failed orders
    pub failures_total: u64,
    /// Current number of orders being tracked
    pub in_flight: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_creation() {
        let metrics = TimeoutMetrics::new();
        assert_eq!(metrics.total_timeouts(), 0);
        assert_eq!(metrics.total_retries(), 0);
        assert_eq!(metrics.total_failures(), 0);
        assert_eq!(metrics.current_in_flight(), 0);
    }

    #[test]
    fn test_record_timeout() {
        let metrics = TimeoutMetrics::new();
        metrics.record_timeout();
        metrics.record_timeout();
        metrics.record_timeout();
        assert_eq!(metrics.total_timeouts(), 3);
    }

    #[test]
    fn test_record_retry() {
        let metrics = TimeoutMetrics::new();
        metrics.record_retry();
        metrics.record_retry();
        assert_eq!(metrics.total_retries(), 2);
    }

    #[test]
    fn test_record_failure() {
        let metrics = TimeoutMetrics::new();
        metrics.record_failure();
        assert_eq!(metrics.total_failures(), 1);
    }

    #[test]
    fn test_in_flight_tracking() {
        let metrics = TimeoutMetrics::new();
        metrics.increment_in_flight();
        metrics.increment_in_flight();
        assert_eq!(metrics.current_in_flight(), 2);

        metrics.decrement_in_flight();
        assert_eq!(metrics.current_in_flight(), 1);

        // Test underflow protection
        metrics.decrement_in_flight();
        metrics.decrement_in_flight();
        assert_eq!(metrics.current_in_flight(), 0);
    }

    #[test]
    fn test_windowed_timeout_count() {
        let metrics = TimeoutMetrics::with_retention(Duration::from_secs(3600));

        metrics.record_timeout();
        metrics.record_timeout();
        metrics.record_timeout();

        // All 3 should be within a 1-minute window
        let count = metrics.get_timeout_count(Duration::from_secs(60));
        assert_eq!(count, 3);

        // 0 within a 0-second window (boundary check)
        let count = metrics.get_timeout_count(Duration::from_secs(0));
        assert_eq!(count, 0);
    }

    #[test]
    fn test_snapshot() {
        let metrics = TimeoutMetrics::new();
        metrics.record_timeout();
        metrics.record_retry();
        metrics.record_failure();
        metrics.increment_in_flight();

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.timeouts_total, 1);
        assert_eq!(snapshot.retries_total, 1);
        assert_eq!(snapshot.failures_total, 1);
        assert_eq!(snapshot.in_flight, 1);
    }

}
