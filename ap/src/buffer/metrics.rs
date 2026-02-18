//! Buffer metrics for AP/Keeper service
//!
//! Provides Prometheus metrics and health status tracking for buffer management.

use ethers::types::U256;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Buffer metrics for monitoring and health checks
#[derive(Debug, Clone)]
pub struct BufferMetrics {
    inner: Arc<BufferMetricsInner>,
}

#[derive(Debug)]
struct BufferMetricsInner {
    /// Counter of instant fills from buffer
    instant_fills_count: AtomicU64,
    /// Counter of replenishment orders triggered
    replenishment_count: AtomicU64,
    /// Counter of buffer fills rejected due to insufficient balance
    insufficient_rejections: AtomicU64,
    /// Counter of orders too large for buffer
    too_large_rejections: AtomicU64,
}

impl BufferMetrics {
    /// Create new buffer metrics
    pub fn new() -> Self {
        Self {
            inner: Arc::new(BufferMetricsInner {
                instant_fills_count: AtomicU64::new(0),
                replenishment_count: AtomicU64::new(0),
                insufficient_rejections: AtomicU64::new(0),
                too_large_rejections: AtomicU64::new(0),
            }),
        }
    }

    /// Increment instant fills counter
    pub fn record_instant_fill(&self) {
        self.inner.instant_fills_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment replenishment counter
    pub fn record_replenishment(&self) {
        self.inner.replenishment_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment insufficient buffer rejections
    pub fn record_insufficient_rejection(&self) {
        self.inner
            .insufficient_rejections
            .fetch_add(1, Ordering::Relaxed);
    }

    /// Increment too large rejections
    pub fn record_too_large_rejection(&self) {
        self.inner.too_large_rejections.fetch_add(1, Ordering::Relaxed);
    }

    /// Get total instant fills count
    pub fn instant_fills_count(&self) -> u64 {
        self.inner.instant_fills_count.load(Ordering::Relaxed)
    }

    /// Get total replenishment count
    pub fn replenishment_count(&self) -> u64 {
        self.inner.replenishment_count.load(Ordering::Relaxed)
    }

    /// Get total insufficient rejections
    pub fn insufficient_rejections(&self) -> u64 {
        self.inner.insufficient_rejections.load(Ordering::Relaxed)
    }

    /// Get total too large rejections
    pub fn too_large_rejections(&self) -> u64 {
        self.inner.too_large_rejections.load(Ordering::Relaxed)
    }

    /// Get all metrics as a snapshot
    pub fn snapshot(&self) -> BufferMetricsSnapshot {
        BufferMetricsSnapshot {
            instant_fills_count: self.instant_fills_count(),
            replenishment_count: self.replenishment_count(),
            insufficient_rejections: self.insufficient_rejections(),
            too_large_rejections: self.too_large_rejections(),
        }
    }
}

impl Default for BufferMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Snapshot of buffer metrics at a point in time
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BufferMetricsSnapshot {
    pub instant_fills_count: u64,
    pub replenishment_count: u64,
    pub insufficient_rejections: u64,
    pub too_large_rejections: u64,
}

/// Health status for buffer
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BufferHealthStatus {
    /// Buffer balance is healthy (>= warning threshold)
    Healthy,
    /// Buffer balance is below warning threshold but above critical
    Warning,
    /// Buffer balance is below critical threshold
    Critical,
}

impl BufferHealthStatus {
    /// Determine health status from total buffer USD value and thresholds
    pub fn from_balance(total_usd: U256, warning_threshold: U256, critical_threshold: U256) -> Self {
        if total_usd < critical_threshold {
            BufferHealthStatus::Critical
        } else if total_usd < warning_threshold {
            BufferHealthStatus::Warning
        } else {
            BufferHealthStatus::Healthy
        }
    }

    /// Returns true if status is healthy
    pub fn is_healthy(&self) -> bool {
        matches!(self, BufferHealthStatus::Healthy)
    }

    /// Returns string representation for health endpoint
    pub fn as_str(&self) -> &'static str {
        match self {
            BufferHealthStatus::Healthy => "healthy",
            BufferHealthStatus::Warning => "warning",
            BufferHealthStatus::Critical => "critical",
        }
    }
}

/// Buffer health check result for /health endpoint
#[derive(Debug, Clone)]
pub struct BufferHealthCheck {
    pub status: BufferHealthStatus,
    pub total_buffer_usd: U256,
    pub total_debt_usd: U256,
    pub warning_threshold: U256,
    pub critical_threshold: U256,
    pub metrics: BufferMetricsSnapshot,
}

impl BufferHealthCheck {
    /// Check if buffer is healthy for service operation
    pub fn is_healthy(&self) -> bool {
        self.status.is_healthy()
    }

    /// Check if buffer needs attention (warning or critical)
    pub fn needs_attention(&self) -> bool {
        !self.is_healthy()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_counters() {
        let metrics = BufferMetrics::new();

        assert_eq!(metrics.instant_fills_count(), 0);
        assert_eq!(metrics.replenishment_count(), 0);

        metrics.record_instant_fill();
        metrics.record_instant_fill();
        metrics.record_replenishment();

        assert_eq!(metrics.instant_fills_count(), 2);
        assert_eq!(metrics.replenishment_count(), 1);
    }

    #[test]
    fn test_metrics_snapshot() {
        let metrics = BufferMetrics::new();

        metrics.record_instant_fill();
        metrics.record_instant_fill();
        metrics.record_instant_fill();
        metrics.record_replenishment();
        metrics.record_insufficient_rejection();

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.instant_fills_count, 3);
        assert_eq!(snapshot.replenishment_count, 1);
        assert_eq!(snapshot.insufficient_rejections, 1);
        assert_eq!(snapshot.too_large_rejections, 0);
    }

    #[test]
    fn test_metrics_clone_independence() {
        let metrics1 = BufferMetrics::new();
        let metrics2 = metrics1.clone();

        metrics1.record_instant_fill();

        // Both should see the same value (shared inner)
        assert_eq!(metrics1.instant_fills_count(), 1);
        assert_eq!(metrics2.instant_fills_count(), 1);
    }

    #[test]
    fn test_health_status_healthy() {
        let total = U256::from(600) * U256::exp10(18);
        let warning = U256::from(500) * U256::exp10(18);
        let critical = U256::from(100) * U256::exp10(18);

        let status = BufferHealthStatus::from_balance(total, warning, critical);
        assert_eq!(status, BufferHealthStatus::Healthy);
        assert!(status.is_healthy());
        assert_eq!(status.as_str(), "healthy");
    }

    #[test]
    fn test_health_status_warning() {
        let total = U256::from(300) * U256::exp10(18);
        let warning = U256::from(500) * U256::exp10(18);
        let critical = U256::from(100) * U256::exp10(18);

        let status = BufferHealthStatus::from_balance(total, warning, critical);
        assert_eq!(status, BufferHealthStatus::Warning);
        assert!(!status.is_healthy());
        assert_eq!(status.as_str(), "warning");
    }

    #[test]
    fn test_health_status_critical() {
        let total = U256::from(50) * U256::exp10(18);
        let warning = U256::from(500) * U256::exp10(18);
        let critical = U256::from(100) * U256::exp10(18);

        let status = BufferHealthStatus::from_balance(total, warning, critical);
        assert_eq!(status, BufferHealthStatus::Critical);
        assert!(!status.is_healthy());
        assert_eq!(status.as_str(), "critical");
    }

    #[test]
    fn test_health_check() {
        let metrics = BufferMetrics::new();
        metrics.record_instant_fill();

        let health = BufferHealthCheck {
            status: BufferHealthStatus::Warning,
            total_buffer_usd: U256::from(300) * U256::exp10(18),
            total_debt_usd: U256::from(50) * U256::exp10(18),
            warning_threshold: U256::from(500) * U256::exp10(18),
            critical_threshold: U256::from(100) * U256::exp10(18),
            metrics: metrics.snapshot(),
        };

        assert!(!health.is_healthy());
        assert!(health.needs_attention());
    }
}
