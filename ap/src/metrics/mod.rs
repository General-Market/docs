//! AP Metrics & Health module
//!
//! Provides comprehensive metrics collection and health reporting for the AP service.
//! Metrics are exposed in Prometheus format via `/metrics` and health status via `/health`.
//!
//! ## Metrics Collected
//!
//! - `orders_processed`: Total orders processed successfully
//! - `orders_failed`: Total orders that failed
//! - `queue_depth`: Current order queue depth
//! - `avg_fill_time`: Rolling average fill time (last 100 orders)
//! - `buffer_balance_usd`: Current buffer balance in USD
//! - `violations_24h`: Limit violations in last 24 hours
//! - `timeouts_24h`: Order timeouts in last 24 hours
//!
//! ## Health Status
//!
//! Health is calculated based on thresholds:
//! - `healthy`: All metrics within normal bounds
//! - `degraded`: queue_depth > 100 OR violations_24h > 0
//! - `unhealthy`: queue_depth > 500 OR violations_24h > 3

pub mod health;
pub mod prometheus;

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;

pub use health::{HealthDetails, HealthStatus, MetricsSnapshot, Thresholds};
pub use prometheus::PrometheusFormatter;

/// Default rolling window size for fill time calculations
const DEFAULT_ROLLING_WINDOW_SIZE: usize = 100;

/// Event window duration (24 hours in seconds)
const EVENT_WINDOW_SECS: u64 = 24 * 60 * 60;


/// Thread-safe AP metrics collection
///
/// All counters use atomic operations for lock-free concurrent access.
/// Rolling windows use RwLock for synchronized mutation.
#[derive(Debug)]
pub struct APMetrics {
    inner: Arc<APMetricsInner>,
}

#[derive(Debug)]
struct APMetricsInner {
    // Counters (lock-free atomics)
    orders_processed: AtomicU64,
    orders_failed: AtomicU64,
    /// Events received from EventMonitor (Story 4.2)
    events_received: AtomicU64,

    // Gauges (lock-free atomics)
    queue_depth: AtomicU64,
    /// Buffer balance stored as cents (integer) for precision
    buffer_balance_cents: AtomicU64,

    // Rolling windows (need RwLock for mutation)
    /// Fill times for rolling average calculation
    fill_times: RwLock<VecDeque<Duration>>,
    /// Timestamps of violations in the last 24h
    violations: RwLock<VecDeque<Instant>>,
    /// Timestamps of timeouts in the last 24h
    timeouts: RwLock<VecDeque<Instant>>,

    // Configuration
    rolling_window_size: usize,
    event_window: Duration,

    // Health thresholds
    thresholds: HealthThresholds,
}

/// Configuration for health status thresholds
#[derive(Debug, Clone, Copy)]
pub struct HealthThresholds {
    /// Queue depth warning threshold (triggers degraded)
    pub queue_depth_warning: u64,
    /// Queue depth critical threshold (triggers unhealthy)
    pub queue_depth_critical: u64,
    /// Violations count that triggers degraded (> 0)
    pub violations_degraded: u64,
    /// Violations count that triggers unhealthy (> 3)
    pub violations_unhealthy: u64,
}

impl Default for HealthThresholds {
    fn default() -> Self {
        Self {
            queue_depth_warning: 100,
            queue_depth_critical: 500,
            violations_degraded: 0,
            violations_unhealthy: 3,
        }
    }
}

impl APMetrics {
    /// Create new APMetrics with default configuration
    pub fn new() -> Self {
        Self::with_config(DEFAULT_ROLLING_WINDOW_SIZE, HealthThresholds::default())
    }

    /// Create APMetrics with custom configuration
    pub fn with_config(rolling_window_size: usize, thresholds: HealthThresholds) -> Self {
        Self {
            inner: Arc::new(APMetricsInner {
                orders_processed: AtomicU64::new(0),
                orders_failed: AtomicU64::new(0),
                events_received: AtomicU64::new(0),
                queue_depth: AtomicU64::new(0),
                buffer_balance_cents: AtomicU64::new(0),
                fill_times: RwLock::new(VecDeque::with_capacity(rolling_window_size)),
                violations: RwLock::new(VecDeque::new()),
                timeouts: RwLock::new(VecDeque::new()),
                rolling_window_size,
                event_window: Duration::from_secs(EVENT_WINDOW_SECS),
                thresholds,
            }),
        }
    }

    // ========== Counter Methods (AC: #1) ==========

    /// Increment orders processed counter
    pub fn increment_orders_processed(&self) {
        self.inner
            .orders_processed
            .fetch_add(1, Ordering::Relaxed);
    }

    /// Increment orders failed counter
    pub fn increment_orders_failed(&self) {
        self.inner.orders_failed.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a fill time for rolling average calculation
    pub async fn record_fill_time(&self, duration: Duration) {
        let mut fill_times = self.inner.fill_times.write().await;

        // Maintain rolling window size
        if fill_times.len() >= self.inner.rolling_window_size {
            fill_times.pop_front();
        }
        fill_times.push_back(duration);
    }

    /// Get total orders processed
    pub fn get_orders_processed(&self) -> u64 {
        self.inner.orders_processed.load(Ordering::Relaxed)
    }

    /// Get total orders failed
    pub fn get_orders_failed(&self) -> u64 {
        self.inner.orders_failed.load(Ordering::Relaxed)
    }

    /// Increment events received counter (called when EventMonitor receives an event)
    pub fn increment_events_received(&self) {
        self.inner.events_received.fetch_add(1, Ordering::Relaxed);
    }

    /// Get total events received
    pub fn get_events_received(&self) -> u64 {
        self.inner.events_received.load(Ordering::Relaxed)
    }

    /// Calculate average fill time from rolling window (in milliseconds)
    pub async fn get_avg_fill_time_ms(&self) -> u64 {
        let fill_times = self.inner.fill_times.read().await;
        if fill_times.is_empty() {
            return 0;
        }

        let total_ms: u128 = fill_times.iter().map(|d| d.as_millis()).sum();
        (total_ms / fill_times.len() as u128) as u64
    }

    // ========== Gauge Methods (AC: #2) ==========

    /// Set current queue depth
    pub fn set_queue_depth(&self, depth: u64) {
        self.inner.queue_depth.store(depth, Ordering::Relaxed);
    }

    /// Get current queue depth
    pub fn get_queue_depth(&self) -> u64 {
        self.inner.queue_depth.load(Ordering::Relaxed)
    }

    /// Set buffer balance in USD (stored as cents internally)
    ///
    /// Uses rounding to avoid truncation errors (e.g., 850.999 -> 85100 cents, not 85099)
    pub fn set_buffer_balance(&self, balance_usd: f64) {
        let cents = (balance_usd * 100.0).round() as u64;
        self.inner
            .buffer_balance_cents
            .store(cents, Ordering::Relaxed);
    }

    /// Get buffer balance in USD
    pub fn get_buffer_balance_usd(&self) -> f64 {
        let cents = self.inner.buffer_balance_cents.load(Ordering::Relaxed);
        cents as f64 / 100.0
    }

    /// Increment violations counter with 24h window tracking
    pub async fn increment_violations(&self) {
        let mut violations = self.inner.violations.write().await;
        violations.push_back(Instant::now());
    }

    /// Increment timeouts counter with 24h window tracking
    pub async fn increment_timeouts(&self) {
        let mut timeouts = self.inner.timeouts.write().await;
        timeouts.push_back(Instant::now());
    }

    /// Get violations count in the last 24 hours
    pub async fn get_violations_24h(&self) -> u64 {
        let mut violations = self.inner.violations.write().await;
        let cutoff = Instant::now() - self.inner.event_window;

        // Prune old entries
        while let Some(front) = violations.front() {
            if *front < cutoff {
                violations.pop_front();
            } else {
                break;
            }
        }

        violations.len() as u64
    }

    /// Get timeouts count in the last 24 hours
    pub async fn get_timeouts_24h(&self) -> u64 {
        let mut timeouts = self.inner.timeouts.write().await;
        let cutoff = Instant::now() - self.inner.event_window;

        // Prune old entries
        while let Some(front) = timeouts.front() {
            if *front < cutoff {
                timeouts.pop_front();
            } else {
                break;
            }
        }

        timeouts.len() as u64
    }

    // ========== Health Status (AC: #3, #4, #5) ==========

    /// Get current health status based on thresholds
    pub async fn get_health_status(&self) -> HealthStatus {
        let queue_depth = self.get_queue_depth();
        let violations = self.get_violations_24h().await;
        let thresholds = &self.inner.thresholds;

        // Critical thresholds -> Unhealthy
        if queue_depth > thresholds.queue_depth_critical
            || violations > thresholds.violations_unhealthy
        {
            return HealthStatus::Unhealthy;
        }

        // Warning thresholds -> Degraded
        if queue_depth > thresholds.queue_depth_warning || violations > thresholds.violations_degraded
        {
            return HealthStatus::Degraded;
        }

        HealthStatus::Healthy
    }

    /// Get full health details including all metrics and thresholds
    ///
    /// This method takes a consistent snapshot of all metrics to avoid
    /// inconsistencies from multiple lock acquisitions.
    pub async fn get_health_details(&self) -> HealthDetails {
        // Take a consistent snapshot first
        let snapshot = self.snapshot().await;

        // Calculate health status from snapshot values
        let status = self.calculate_health_status_from_values(
            snapshot.queue_depth,
            snapshot.violations_24h,
        );

        // Display thresholds as the actual boundary values (> X means display X)
        let thresholds = Thresholds {
            queue_depth_warning: self.inner.thresholds.queue_depth_warning,
            queue_depth_critical: self.inner.thresholds.queue_depth_critical,
            violations_degraded: self.inner.thresholds.violations_degraded,
            violations_unhealthy: self.inner.thresholds.violations_unhealthy,
        };

        HealthDetails {
            status: status.as_str().to_string(),
            service: "ap".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            metrics: snapshot,
            thresholds,
        }
    }

    /// Calculate health status from pre-fetched values (avoids re-locking)
    fn calculate_health_status_from_values(&self, queue_depth: u64, violations: u64) -> HealthStatus {
        let thresholds = &self.inner.thresholds;

        // Critical thresholds -> Unhealthy
        if queue_depth > thresholds.queue_depth_critical
            || violations > thresholds.violations_unhealthy
        {
            return HealthStatus::Unhealthy;
        }

        // Warning thresholds -> Degraded
        if queue_depth > thresholds.queue_depth_warning || violations > thresholds.violations_degraded
        {
            return HealthStatus::Degraded;
        }

        HealthStatus::Healthy
    }

    /// Get a snapshot of all metrics (for JSON serialization)
    ///
    /// Note: This method acquires locks sequentially, so the snapshot may have
    /// minor inconsistencies during high activity. For health status calculation,
    /// use get_health_details() which uses calculated values from this snapshot.
    pub async fn snapshot(&self) -> MetricsSnapshot {
        // Acquire all async locks in a predictable order to minimize inconsistency window
        let violations_24h = self.get_violations_24h().await;
        let timeouts_24h = self.get_timeouts_24h().await;
        let avg_fill_time_ms = self.get_avg_fill_time_ms().await;

        MetricsSnapshot {
            queue_depth: self.get_queue_depth(),
            violations_24h,
            timeouts_24h,
            orders_processed: self.get_orders_processed(),
            orders_failed: self.get_orders_failed(),
            events_received: self.get_events_received(),
            avg_fill_time_ms,
            buffer_balance_usd: self.get_buffer_balance_usd(),
        }
    }

    /// Get thresholds configuration
    pub fn get_thresholds(&self) -> &HealthThresholds {
        &self.inner.thresholds
    }
}

impl Default for APMetrics {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for APMetrics {
    fn clone(&self) -> Self {
        Self {
            inner: Arc::clone(&self.inner),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_counter_increments() {
        let metrics = APMetrics::new();

        assert_eq!(metrics.get_orders_processed(), 0);
        assert_eq!(metrics.get_orders_failed(), 0);
        assert_eq!(metrics.get_events_received(), 0);

        metrics.increment_orders_processed();
        metrics.increment_orders_processed();
        metrics.increment_orders_failed();
        metrics.increment_events_received();
        metrics.increment_events_received();
        metrics.increment_events_received();

        assert_eq!(metrics.get_orders_processed(), 2);
        assert_eq!(metrics.get_orders_failed(), 1);
        assert_eq!(metrics.get_events_received(), 3);
    }

    #[tokio::test]
    async fn test_gauge_set_get() {
        let metrics = APMetrics::new();

        assert_eq!(metrics.get_queue_depth(), 0);

        metrics.set_queue_depth(42);
        assert_eq!(metrics.get_queue_depth(), 42);

        metrics.set_queue_depth(100);
        assert_eq!(metrics.get_queue_depth(), 100);
    }

    #[tokio::test]
    async fn test_buffer_balance() {
        let metrics = APMetrics::new();

        metrics.set_buffer_balance(850.50);
        let balance = metrics.get_buffer_balance_usd();
        assert!((balance - 850.50).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_rolling_average_fill_time() {
        let metrics = APMetrics::with_config(3, HealthThresholds::default());

        // Initially zero
        assert_eq!(metrics.get_avg_fill_time_ms().await, 0);

        // Add some fill times
        metrics.record_fill_time(Duration::from_millis(100)).await;
        metrics.record_fill_time(Duration::from_millis(200)).await;
        metrics.record_fill_time(Duration::from_millis(300)).await;

        // Average of 100, 200, 300 = 200
        assert_eq!(metrics.get_avg_fill_time_ms().await, 200);

        // Add one more, should push out oldest (100)
        metrics.record_fill_time(Duration::from_millis(400)).await;

        // Average of 200, 300, 400 = 300
        assert_eq!(metrics.get_avg_fill_time_ms().await, 300);
    }

    #[tokio::test]
    async fn test_violations_24h_tracking() {
        let metrics = APMetrics::new();

        assert_eq!(metrics.get_violations_24h().await, 0);

        metrics.increment_violations().await;
        metrics.increment_violations().await;

        assert_eq!(metrics.get_violations_24h().await, 2);
    }

    #[tokio::test]
    async fn test_timeouts_24h_tracking() {
        let metrics = APMetrics::new();

        assert_eq!(metrics.get_timeouts_24h().await, 0);

        metrics.increment_timeouts().await;
        metrics.increment_timeouts().await;
        metrics.increment_timeouts().await;

        assert_eq!(metrics.get_timeouts_24h().await, 3);
    }

    #[tokio::test]
    async fn test_health_status_healthy() {
        let metrics = APMetrics::new();

        // Default state should be healthy
        assert_eq!(metrics.get_health_status().await, HealthStatus::Healthy);
    }

    #[tokio::test]
    async fn test_health_status_degraded_queue_depth() {
        let metrics = APMetrics::new();

        // Queue depth > 100 triggers degraded
        metrics.set_queue_depth(101);
        assert_eq!(metrics.get_health_status().await, HealthStatus::Degraded);
    }

    #[tokio::test]
    async fn test_health_status_degraded_violations() {
        let metrics = APMetrics::new();

        // violations > 0 triggers degraded
        metrics.increment_violations().await;
        assert_eq!(metrics.get_health_status().await, HealthStatus::Degraded);
    }

    #[tokio::test]
    async fn test_health_status_unhealthy_queue_depth() {
        let metrics = APMetrics::new();

        // Queue depth > 500 triggers unhealthy
        metrics.set_queue_depth(501);
        assert_eq!(metrics.get_health_status().await, HealthStatus::Unhealthy);
    }

    #[tokio::test]
    async fn test_health_status_unhealthy_violations() {
        let metrics = APMetrics::new();

        // violations > 3 triggers unhealthy
        for _ in 0..4 {
            metrics.increment_violations().await;
        }
        assert_eq!(metrics.get_health_status().await, HealthStatus::Unhealthy);
    }

    #[tokio::test]
    async fn test_health_details() {
        let metrics = APMetrics::new();

        metrics.increment_orders_processed();
        metrics.increment_orders_processed();
        metrics.increment_orders_failed();
        metrics.set_queue_depth(45);
        metrics.set_buffer_balance(850.00);
        metrics.record_fill_time(Duration::from_millis(150)).await;

        let details = metrics.get_health_details().await;

        assert_eq!(details.status, "healthy");
        assert_eq!(details.service, "ap");
        assert_eq!(details.metrics.orders_processed, 2);
        assert_eq!(details.metrics.orders_failed, 1);
        assert_eq!(details.metrics.queue_depth, 45);
        assert!((details.metrics.buffer_balance_usd - 850.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_metrics_clone_shares_state() {
        let metrics1 = APMetrics::new();
        let metrics2 = metrics1.clone();

        metrics1.increment_orders_processed();

        // Both should see the same value (shared inner)
        assert_eq!(metrics1.get_orders_processed(), 1);
        assert_eq!(metrics2.get_orders_processed(), 1);
    }

    #[tokio::test]
    async fn test_snapshot() {
        let metrics = APMetrics::new();

        metrics.increment_orders_processed();
        metrics.increment_orders_failed();
        metrics.set_queue_depth(50);
        metrics.set_buffer_balance(1000.00);

        let snapshot = metrics.snapshot().await;

        assert_eq!(snapshot.orders_processed, 1);
        assert_eq!(snapshot.orders_failed, 1);
        assert_eq!(snapshot.queue_depth, 50);
        assert!((snapshot.buffer_balance_usd - 1000.0).abs() < 0.01);
    }
}
