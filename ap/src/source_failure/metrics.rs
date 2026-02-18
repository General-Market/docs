//! Metrics for source failure handling
//!
//! Exposes suspension-related metrics in Prometheus format.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tokio::time::Instant;

/// Metrics collector for source failure handling
#[derive(Debug)]
pub struct SourceFailureMetrics {
    /// Whether AP is currently suspended (0 = active, 1 = suspended)
    suspended: AtomicU64,
    /// Current count of orders awaiting refund
    pending_refunds: AtomicU64,
    /// Total number of orders auto-refunded
    auto_refunds_total: AtomicU64,
    /// Total number of suspensions
    suspensions_total: AtomicU64,
    /// Total number of restorations
    restorations_total: AtomicU64,
    /// Last suspension timestamp (for duration calculation)
    suspension_start: std::sync::RwLock<Option<Instant>>,
    /// Histogram buckets for suspension duration
    suspension_duration_buckets: std::sync::RwLock<SuspensionDurationBuckets>,
}

/// Histogram buckets for suspension duration (in seconds)
#[derive(Debug, Default)]
struct SuspensionDurationBuckets {
    /// Count of suspensions <= 5 minutes
    le_300: u64,
    /// Count of suspensions <= 10 minutes
    le_600: u64,
    /// Count of suspensions <= 30 minutes
    le_1800: u64,
    /// Count of suspensions <= 1 hour
    le_3600: u64,
    /// Total sum of all suspension durations (for average calculation)
    sum_seconds: f64,
    /// Total count of suspensions recorded
    count: u64,
}

impl SuspensionDurationBuckets {
    fn record(&mut self, duration: Duration) {
        let secs = duration.as_secs();
        if secs <= 300 {
            self.le_300 += 1;
        }
        if secs <= 600 {
            self.le_600 += 1;
        }
        if secs <= 1800 {
            self.le_1800 += 1;
        }
        if secs <= 3600 {
            self.le_3600 += 1;
        }
        self.sum_seconds += duration.as_secs_f64();
        self.count += 1;
    }
}

impl SourceFailureMetrics {
    /// Create new metrics collector
    pub fn new() -> Self {
        Self {
            suspended: AtomicU64::new(0),
            pending_refunds: AtomicU64::new(0),
            auto_refunds_total: AtomicU64::new(0),
            suspensions_total: AtomicU64::new(0),
            restorations_total: AtomicU64::new(0),
            suspension_start: std::sync::RwLock::new(None),
            suspension_duration_buckets: std::sync::RwLock::new(SuspensionDurationBuckets::default()),
        }
    }

    /// Mark AP as suspended
    pub fn set_suspended(&self) {
        self.suspended.store(1, Ordering::Relaxed);
        self.suspensions_total.fetch_add(1, Ordering::Relaxed);
        if let Ok(mut start) = self.suspension_start.write() {
            *start = Some(Instant::now());
        }
    }

    /// Mark AP as active (not suspended)
    pub fn set_active(&self) {
        self.suspended.store(0, Ordering::Relaxed);
        self.restorations_total.fetch_add(1, Ordering::Relaxed);

        // Record suspension duration
        if let Ok(mut start) = self.suspension_start.write() {
            if let Some(suspension_start) = start.take() {
                let duration = suspension_start.elapsed();
                if let Ok(mut buckets) = self.suspension_duration_buckets.write() {
                    buckets.record(duration);
                }
            }
        }
    }

    /// Check if AP is currently suspended
    pub fn is_suspended(&self) -> bool {
        self.suspended.load(Ordering::Relaxed) == 1
    }

    /// Set current pending refunds count
    pub fn set_pending_refunds(&self, count: u64) {
        self.pending_refunds.store(count, Ordering::Relaxed);
    }

    /// Get current pending refunds count
    pub fn get_pending_refunds(&self) -> u64 {
        self.pending_refunds.load(Ordering::Relaxed)
    }

    /// Increment auto refunds counter
    pub fn record_auto_refund(&self) {
        self.auto_refunds_total.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment auto refunds by count
    pub fn record_auto_refunds(&self, count: u64) {
        self.auto_refunds_total.fetch_add(count, Ordering::Relaxed);
    }

    /// Get total auto refunds
    pub fn get_auto_refunds_total(&self) -> u64 {
        self.auto_refunds_total.load(Ordering::Relaxed)
    }

    /// Get total suspensions
    pub fn get_suspensions_total(&self) -> u64 {
        self.suspensions_total.load(Ordering::Relaxed)
    }

    /// Get total restorations
    pub fn get_restorations_total(&self) -> u64 {
        self.restorations_total.load(Ordering::Relaxed)
    }

    /// Get current suspension duration (if suspended)
    pub fn current_suspension_duration(&self) -> Option<Duration> {
        if self.is_suspended() {
            if let Ok(start) = self.suspension_start.read() {
                return start.map(|s| s.elapsed());
            }
        }
        None
    }

    /// Get snapshot of all metrics
    pub fn snapshot(&self) -> SourceFailureMetricsSnapshot {
        SourceFailureMetricsSnapshot {
            suspended: self.is_suspended(),
            pending_refunds: self.get_pending_refunds(),
            auto_refunds_total: self.get_auto_refunds_total(),
            suspensions_total: self.get_suspensions_total(),
            restorations_total: self.get_restorations_total(),
            current_suspension_duration: self.current_suspension_duration(),
        }
    }

    /// Format metrics in Prometheus format
    pub fn to_prometheus(&self) -> String {
        let mut output = String::new();

        // ap_suspended gauge
        output.push_str("# HELP ap_suspended Whether AP is currently suspended (0=active, 1=suspended)\n");
        output.push_str("# TYPE ap_suspended gauge\n");
        output.push_str(&format!(
            "ap_suspended {}\n",
            self.suspended.load(Ordering::Relaxed)
        ));

        // ap_pending_refunds gauge
        output.push_str("\n# HELP ap_pending_refunds Current number of orders awaiting refund\n");
        output.push_str("# TYPE ap_pending_refunds gauge\n");
        output.push_str(&format!(
            "ap_pending_refunds {}\n",
            self.pending_refunds.load(Ordering::Relaxed)
        ));

        // ap_auto_refunds_total counter
        output.push_str("\n# HELP ap_auto_refunds_total Total number of orders auto-refunded due to timeout\n");
        output.push_str("# TYPE ap_auto_refunds_total counter\n");
        output.push_str(&format!(
            "ap_auto_refunds_total {}\n",
            self.auto_refunds_total.load(Ordering::Relaxed)
        ));

        // ap_suspensions_total counter
        output.push_str("\n# HELP ap_suspensions_total Total number of AP suspensions\n");
        output.push_str("# TYPE ap_suspensions_total counter\n");
        output.push_str(&format!(
            "ap_suspensions_total {}\n",
            self.suspensions_total.load(Ordering::Relaxed)
        ));

        // ap_restorations_total counter
        output.push_str("\n# HELP ap_restorations_total Total number of AP restorations\n");
        output.push_str("# TYPE ap_restorations_total counter\n");
        output.push_str(&format!(
            "ap_restorations_total {}\n",
            self.restorations_total.load(Ordering::Relaxed)
        ));

        // ap_suspension_duration_seconds histogram
        if let Ok(buckets) = self.suspension_duration_buckets.read() {
            output.push_str("\n# HELP ap_suspension_duration_seconds Histogram of suspension durations\n");
            output.push_str("# TYPE ap_suspension_duration_seconds histogram\n");
            output.push_str(&format!(
                "ap_suspension_duration_seconds_bucket{{le=\"300\"}} {}\n",
                buckets.le_300
            ));
            output.push_str(&format!(
                "ap_suspension_duration_seconds_bucket{{le=\"600\"}} {}\n",
                buckets.le_600
            ));
            output.push_str(&format!(
                "ap_suspension_duration_seconds_bucket{{le=\"1800\"}} {}\n",
                buckets.le_1800
            ));
            output.push_str(&format!(
                "ap_suspension_duration_seconds_bucket{{le=\"3600\"}} {}\n",
                buckets.le_3600
            ));
            output.push_str(&format!(
                "ap_suspension_duration_seconds_bucket{{le=\"+Inf\"}} {}\n",
                buckets.count
            ));
            output.push_str(&format!(
                "ap_suspension_duration_seconds_sum {}\n",
                buckets.sum_seconds
            ));
            output.push_str(&format!(
                "ap_suspension_duration_seconds_count {}\n",
                buckets.count
            ));
        }

        output
    }
}

impl Default for SourceFailureMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Snapshot of source failure metrics
#[derive(Debug, Clone)]
pub struct SourceFailureMetricsSnapshot {
    /// Whether AP is currently suspended
    pub suspended: bool,
    /// Current pending refunds count
    pub pending_refunds: u64,
    /// Total auto refunds
    pub auto_refunds_total: u64,
    /// Total suspensions
    pub suspensions_total: u64,
    /// Total restorations
    pub restorations_total: u64,
    /// Current suspension duration (if suspended)
    pub current_suspension_duration: Option<Duration>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_creation() {
        let metrics = SourceFailureMetrics::new();
        assert!(!metrics.is_suspended());
        assert_eq!(metrics.get_pending_refunds(), 0);
        assert_eq!(metrics.get_auto_refunds_total(), 0);
    }

    #[test]
    fn test_suspension_toggle() {
        let metrics = SourceFailureMetrics::new();

        metrics.set_suspended();
        assert!(metrics.is_suspended());
        assert_eq!(metrics.get_suspensions_total(), 1);

        metrics.set_active();
        assert!(!metrics.is_suspended());
        assert_eq!(metrics.get_restorations_total(), 1);
    }

    #[test]
    fn test_pending_refunds() {
        let metrics = SourceFailureMetrics::new();

        metrics.set_pending_refunds(5);
        assert_eq!(metrics.get_pending_refunds(), 5);

        metrics.set_pending_refunds(3);
        assert_eq!(metrics.get_pending_refunds(), 3);
    }

    #[test]
    fn test_auto_refunds() {
        let metrics = SourceFailureMetrics::new();

        metrics.record_auto_refund();
        metrics.record_auto_refund();
        assert_eq!(metrics.get_auto_refunds_total(), 2);

        metrics.record_auto_refunds(3);
        assert_eq!(metrics.get_auto_refunds_total(), 5);
    }

    #[test]
    fn test_prometheus_format() {
        let metrics = SourceFailureMetrics::new();
        metrics.set_pending_refunds(5);
        metrics.record_auto_refunds(10);
        metrics.set_suspended();

        let output = metrics.to_prometheus();
        assert!(output.contains("ap_suspended 1"));
        assert!(output.contains("ap_pending_refunds 5"));
        assert!(output.contains("ap_auto_refunds_total 10"));
        assert!(output.contains("# TYPE ap_suspended gauge"));
        assert!(output.contains("# TYPE ap_auto_refunds_total counter"));
    }

    #[test]
    fn test_snapshot() {
        let metrics = SourceFailureMetrics::new();
        metrics.set_pending_refunds(3);
        metrics.record_auto_refunds(7);

        let snapshot = metrics.snapshot();
        assert!(!snapshot.suspended);
        assert_eq!(snapshot.pending_refunds, 3);
        assert_eq!(snapshot.auto_refunds_total, 7);
    }
}
