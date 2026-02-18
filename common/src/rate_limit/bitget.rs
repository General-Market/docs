//! Bitget API Rate Limiter
//!
//! Implements a sliding window rate limiter for Bitget API calls with:
//! - Separate limits for order placement vs read APIs
//! - Configurable limits for different API tiers (testnet/mainnet/premium)
//! - Thread-safe concurrent access
//! - Metrics for monitoring throttling behavior

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;

/// Type of API endpoint for rate limiting purposes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EndpointType {
    /// Order placement endpoints (limited to ~10/sec per NFR4)
    OrderPlacement,
    /// Read-only endpoints (account info, order status, fills)
    ReadOnly,
}

/// Rate limiter tier configuration
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RateLimiterTier {
    /// Testnet tier - higher limits for development
    Testnet,
    /// Mainnet standard tier
    Mainnet,
    /// Premium tier with higher limits
    Premium,
}

impl RateLimiterTier {
    /// Get default limits for this tier
    pub fn default_limits(&self) -> (usize, usize) {
        match self {
            // (order_limit, read_limit) per second
            RateLimiterTier::Testnet => (20, 50),
            RateLimiterTier::Mainnet => (10, 20),
            RateLimiterTier::Premium => (30, 100),
        }
    }
}

/// Configuration for the rate limiter
#[derive(Debug, Clone)]
pub struct RateLimiterConfig {
    /// Maximum order placement requests per window
    pub order_limit: usize,
    /// Maximum read-only requests per window
    pub read_limit: usize,
    /// Sliding window duration (default: 1 second)
    pub window_duration: Duration,
}

impl Default for RateLimiterConfig {
    fn default() -> Self {
        // Default to mainnet tier per NFR4: ~10 orders/sec
        let (order_limit, read_limit) = RateLimiterTier::Mainnet.default_limits();
        Self {
            order_limit,
            read_limit,
            window_duration: Duration::from_secs(1),
        }
    }
}

impl RateLimiterConfig {
    /// Create config from a tier
    pub fn from_tier(tier: RateLimiterTier) -> Self {
        let (order_limit, read_limit) = tier.default_limits();
        Self {
            order_limit,
            read_limit,
            window_duration: Duration::from_secs(1),
        }
    }

    /// Create config with custom limits
    pub fn custom(order_limit: usize, read_limit: usize, window_duration: Duration) -> Self {
        Self {
            order_limit,
            read_limit,
            window_duration,
        }
    }
}

/// Metrics collected by the rate limiter
#[derive(Debug, Clone, Default)]
pub struct RateLimiterMetrics {
    /// Number of requests that were throttled (had to wait)
    pub requests_throttled: u64,
    /// Total wait time in milliseconds
    pub total_wait_time_ms: u64,
    /// Number of successful acquires
    pub total_requests: u64,
}

impl RateLimiterMetrics {
    /// Calculate average wait time in milliseconds
    pub fn avg_wait_time_ms(&self) -> f64 {
        if self.requests_throttled == 0 {
            0.0
        } else {
            self.total_wait_time_ms as f64 / self.requests_throttled as f64
        }
    }
}

/// Internal state for a single endpoint type's sliding window
#[derive(Debug)]
struct SlidingWindow {
    timestamps: VecDeque<Instant>,
    limit: usize,
    window_duration: Duration,
}

impl SlidingWindow {
    fn new(limit: usize, window_duration: Duration) -> Self {
        Self {
            timestamps: VecDeque::with_capacity(limit),
            limit,
            window_duration,
        }
    }

    /// Remove expired timestamps from the window
    fn cleanup(&mut self) {
        let cutoff = Instant::now() - self.window_duration;
        while self.timestamps.front().map_or(false, |t| *t < cutoff) {
            self.timestamps.pop_front();
        }
    }

    /// Get remaining capacity after cleanup
    fn remaining(&mut self) -> usize {
        self.cleanup();
        self.limit.saturating_sub(self.timestamps.len())
    }

    /// Calculate wait time if at capacity
    fn wait_time(&mut self) -> Duration {
        self.cleanup();
        if self.timestamps.len() >= self.limit {
            if let Some(oldest) = self.timestamps.front() {
                let expires_at = *oldest + self.window_duration;
                return expires_at.saturating_duration_since(Instant::now());
            }
        }
        Duration::ZERO
    }

    /// Record a successful acquire
    fn record(&mut self) {
        self.timestamps.push_back(Instant::now());
    }

    /// Update the limit (for runtime adjustment)
    fn set_limit(&mut self, limit: usize) {
        self.limit = limit;
    }
}

/// Thread-safe rate limiter for Bitget API calls
///
/// Uses a sliding window algorithm to provide smooth rate limiting over time.
/// Supports separate limits for order placement and read-only endpoints.
///
/// # Example
///
/// ```rust,no_run
/// use common::rate_limit::{BitgetRateLimiter, EndpointType};
///
/// # async fn example() {
/// let limiter = BitgetRateLimiter::default();
///
/// // Acquire a slot for order placement
/// limiter.acquire(EndpointType::OrderPlacement).await;
///
/// // Check remaining capacity
/// let remaining = limiter.get_remaining(EndpointType::OrderPlacement).await;
/// # }
/// ```
pub struct BitgetRateLimiter {
    /// Sliding window for order placement endpoints
    order_window: Arc<RwLock<SlidingWindow>>,
    /// Sliding window for read-only endpoints
    read_window: Arc<RwLock<SlidingWindow>>,
    /// Metrics tracking
    requests_throttled: AtomicU64,
    total_wait_time_ms: AtomicU64,
    total_requests: AtomicU64,
}

impl BitgetRateLimiter {
    /// Create a new rate limiter with the given configuration
    pub fn new(config: RateLimiterConfig) -> Self {
        Self {
            order_window: Arc::new(RwLock::new(SlidingWindow::new(
                config.order_limit,
                config.window_duration,
            ))),
            read_window: Arc::new(RwLock::new(SlidingWindow::new(
                config.read_limit,
                config.window_duration,
            ))),
            requests_throttled: AtomicU64::new(0),
            total_wait_time_ms: AtomicU64::new(0),
            total_requests: AtomicU64::new(0),
        }
    }

    /// Create a rate limiter from a tier preset
    pub fn from_tier(tier: RateLimiterTier) -> Self {
        Self::new(RateLimiterConfig::from_tier(tier))
    }

    /// Get the appropriate window for an endpoint type
    fn get_window(&self, endpoint_type: EndpointType) -> &Arc<RwLock<SlidingWindow>> {
        match endpoint_type {
            EndpointType::OrderPlacement => &self.order_window,
            EndpointType::ReadOnly => &self.read_window,
        }
    }

    /// Acquire a rate limit slot, blocking until one is available
    ///
    /// Returns the duration waited (zero if no wait was needed)
    pub async fn acquire(&self, endpoint_type: EndpointType) -> Duration {
        let window = self.get_window(endpoint_type);
        let mut total_wait = Duration::ZERO;

        loop {
            let wait_time = {
                let mut w = window.write().await;
                let wait = w.wait_time();
                if wait.is_zero() {
                    w.record();
                    break;
                }
                wait
            };

            // Track that we're being throttled
            if total_wait.is_zero() {
                self.requests_throttled.fetch_add(1, Ordering::Relaxed);
            }

            tokio::time::sleep(wait_time).await;
            total_wait += wait_time;
        }

        // Update metrics
        self.total_requests.fetch_add(1, Ordering::Relaxed);
        if !total_wait.is_zero() {
            self.total_wait_time_ms
                .fetch_add(total_wait.as_millis() as u64, Ordering::Relaxed);
        }

        total_wait
    }

    /// Get remaining capacity for an endpoint type without acquiring
    ///
    /// Note: This takes a write lock because it cleans up expired entries.
    /// Under high concurrency, consider caching this value or using `try_get_remaining()`
    /// if available in a future version.
    pub async fn get_remaining(&self, endpoint_type: EndpointType) -> usize {
        let window = self.get_window(endpoint_type);
        let mut w = window.write().await;
        w.remaining()
    }

    /// Get current metrics
    ///
    /// Note: Uses relaxed memory ordering so values may be slightly inconsistent
    /// across the three counters when read under high concurrency. This is acceptable
    /// for monitoring purposes where approximate values are sufficient.
    pub fn get_metrics(&self) -> RateLimiterMetrics {
        RateLimiterMetrics {
            requests_throttled: self.requests_throttled.load(Ordering::Relaxed),
            total_wait_time_ms: self.total_wait_time_ms.load(Ordering::Relaxed),
            total_requests: self.total_requests.load(Ordering::Relaxed),
        }
    }

    /// Update the limit for a specific endpoint type at runtime
    pub async fn set_limit(&self, endpoint_type: EndpointType, limit: usize) {
        let window = self.get_window(endpoint_type);
        let mut w = window.write().await;
        w.set_limit(limit);
    }
}

impl Default for BitgetRateLimiter {
    fn default() -> Self {
        Self::new(RateLimiterConfig::default())
    }
}

impl std::fmt::Debug for BitgetRateLimiter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BitgetRateLimiter")
            .field(
                "requests_throttled",
                &self.requests_throttled.load(Ordering::Relaxed),
            )
            .field(
                "total_requests",
                &self.total_requests.load(Ordering::Relaxed),
            )
            .finish_non_exhaustive()
    }
}

/// Builder for BitgetRateLimiter with fluent configuration
pub struct BitgetRateLimiterBuilder {
    config: RateLimiterConfig,
}

impl BitgetRateLimiterBuilder {
    /// Create a new builder with default configuration
    pub fn new() -> Self {
        Self {
            config: RateLimiterConfig::default(),
        }
    }

    /// Use a predefined tier
    pub fn with_tier(mut self, tier: RateLimiterTier) -> Self {
        let (order_limit, read_limit) = tier.default_limits();
        self.config.order_limit = order_limit;
        self.config.read_limit = read_limit;
        self
    }

    /// Set order placement limit per window
    pub fn with_order_limit(mut self, limit: usize) -> Self {
        self.config.order_limit = limit;
        self
    }

    /// Set read-only limit per window
    pub fn with_read_limit(mut self, limit: usize) -> Self {
        self.config.read_limit = limit;
        self
    }

    /// Set the sliding window duration
    pub fn with_window_duration(mut self, duration: Duration) -> Self {
        self.config.window_duration = duration;
        self
    }

    /// Build the rate limiter
    ///
    /// # Panics
    /// Panics if order_limit or read_limit is zero, as this would cause
    /// `acquire()` to block forever.
    pub fn build(self) -> BitgetRateLimiter {
        assert!(
            self.config.order_limit > 0,
            "order_limit must be > 0, got 0"
        );
        assert!(self.config.read_limit > 0, "read_limit must be > 0, got 0");
        BitgetRateLimiter::new(self.config)
    }
}

impl Default for BitgetRateLimiterBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[tokio::test(start_paused = true)]
    async fn test_basic_throttling() {
        // Use a short window for testing (time is paused so timing is deterministic)
        let limiter = BitgetRateLimiterBuilder::new()
            .with_order_limit(3)
            .with_window_duration(Duration::from_millis(100))
            .build();

        // First 3 should not wait
        for _ in 0..3 {
            let wait = limiter.acquire(EndpointType::OrderPlacement).await;
            assert!(wait.is_zero(), "First 3 requests should not wait");
        }

        // 4th should wait for ~100ms until window slides
        let wait = limiter.acquire(EndpointType::OrderPlacement).await;
        assert!(
            !wait.is_zero(),
            "4th request should have waited, got zero wait"
        );
        // With paused time, the wait should be exactly 100ms
        assert!(
            wait >= Duration::from_millis(100),
            "Wait should be >= 100ms, was {:?}",
            wait
        );
    }

    #[tokio::test(start_paused = true)]
    async fn test_sliding_window_behavior() {
        let limiter = BitgetRateLimiterBuilder::new()
            .with_order_limit(2)
            .with_window_duration(Duration::from_millis(50))
            .build();

        // Fill the window
        limiter.acquire(EndpointType::OrderPlacement).await;
        limiter.acquire(EndpointType::OrderPlacement).await;

        // Advance time past window duration (deterministic with paused time)
        tokio::time::advance(Duration::from_millis(60)).await;

        // Should now have capacity again
        let remaining = limiter.get_remaining(EndpointType::OrderPlacement).await;
        assert_eq!(remaining, 2, "Window should have cleared");

        // Next request should not wait
        let wait = limiter.acquire(EndpointType::OrderPlacement).await;
        assert!(
            wait.is_zero(),
            "Request after window slide should not wait"
        );
    }

    #[tokio::test(start_paused = true)]
    async fn test_concurrent_access() {
        let limiter = Arc::new(
            BitgetRateLimiterBuilder::new()
                .with_order_limit(5)
                .with_window_duration(Duration::from_millis(100))
                .build(),
        );

        let mut handles = vec![];

        // Spawn 10 tasks trying to acquire simultaneously
        for _ in 0..10 {
            let limiter_clone = limiter.clone();
            handles.push(tokio::spawn(async move {
                limiter_clone.acquire(EndpointType::OrderPlacement).await
            }));
        }

        let results: Vec<_> = futures::future::join_all(handles).await;

        // All should complete successfully
        for result in &results {
            assert!(result.is_ok(), "All acquires should complete");
        }

        // Some should have waited
        let waited_count = results
            .iter()
            .filter(|r| r.as_ref().map_or(false, |d| !d.is_zero()))
            .count();
        assert!(waited_count > 0, "Some requests should have waited");

        // Metrics should reflect this
        let metrics = limiter.get_metrics();
        assert_eq!(metrics.total_requests, 10);
        assert!(metrics.requests_throttled > 0);
    }

    #[tokio::test(start_paused = true)]
    async fn test_separate_endpoint_limits() {
        let limiter = BitgetRateLimiterBuilder::new()
            .with_order_limit(2)
            .with_read_limit(3)
            .with_window_duration(Duration::from_millis(100))
            .build();

        // Fill order window
        limiter.acquire(EndpointType::OrderPlacement).await;
        limiter.acquire(EndpointType::OrderPlacement).await;

        // Read window should still have capacity
        let read_remaining = limiter.get_remaining(EndpointType::ReadOnly).await;
        assert_eq!(read_remaining, 3, "Read window should be independent");

        // Order window should be at capacity
        let order_remaining = limiter.get_remaining(EndpointType::OrderPlacement).await;
        assert_eq!(order_remaining, 0, "Order window should be full");

        // Fill read window
        limiter.acquire(EndpointType::ReadOnly).await;
        limiter.acquire(EndpointType::ReadOnly).await;
        limiter.acquire(EndpointType::ReadOnly).await;

        let read_remaining = limiter.get_remaining(EndpointType::ReadOnly).await;
        assert_eq!(read_remaining, 0, "Read window should now be full");
    }

    #[tokio::test(start_paused = true)]
    async fn test_metrics_accuracy() {
        let limiter = BitgetRateLimiterBuilder::new()
            .with_order_limit(2)
            .with_window_duration(Duration::from_millis(50))
            .build();

        // First 2 should not wait
        limiter.acquire(EndpointType::OrderPlacement).await;
        limiter.acquire(EndpointType::OrderPlacement).await;

        // 3rd should wait
        limiter.acquire(EndpointType::OrderPlacement).await;

        let metrics = limiter.get_metrics();
        assert_eq!(metrics.total_requests, 3);
        assert_eq!(
            metrics.requests_throttled, 1,
            "One request should have been throttled"
        );
        // With paused time, wait should be exactly 50ms
        assert_eq!(
            metrics.total_wait_time_ms, 50,
            "Wait time should be 50ms, was {}",
            metrics.total_wait_time_ms
        );
    }

    #[tokio::test(start_paused = true)]
    async fn test_get_remaining_accuracy() {
        let limiter = BitgetRateLimiterBuilder::new()
            .with_order_limit(5)
            .with_window_duration(Duration::from_millis(100))
            .build();

        assert_eq!(limiter.get_remaining(EndpointType::OrderPlacement).await, 5);

        limiter.acquire(EndpointType::OrderPlacement).await;
        assert_eq!(limiter.get_remaining(EndpointType::OrderPlacement).await, 4);

        limiter.acquire(EndpointType::OrderPlacement).await;
        limiter.acquire(EndpointType::OrderPlacement).await;
        assert_eq!(limiter.get_remaining(EndpointType::OrderPlacement).await, 2);
    }

    #[tokio::test(start_paused = true)]
    async fn test_runtime_limit_adjustment() {
        let limiter = BitgetRateLimiterBuilder::new()
            .with_order_limit(2)
            .with_window_duration(Duration::from_millis(100))
            .build();

        // Fill with initial limit
        limiter.acquire(EndpointType::OrderPlacement).await;
        limiter.acquire(EndpointType::OrderPlacement).await;

        assert_eq!(limiter.get_remaining(EndpointType::OrderPlacement).await, 0);

        // Increase limit at runtime
        limiter.set_limit(EndpointType::OrderPlacement, 5).await;

        // Should now have capacity again
        assert_eq!(limiter.get_remaining(EndpointType::OrderPlacement).await, 3);
    }

    #[tokio::test]
    async fn test_tier_defaults() {
        let testnet = BitgetRateLimiter::from_tier(RateLimiterTier::Testnet);
        assert_eq!(
            testnet.get_remaining(EndpointType::OrderPlacement).await,
            20
        );
        assert_eq!(testnet.get_remaining(EndpointType::ReadOnly).await, 50);

        let mainnet = BitgetRateLimiter::from_tier(RateLimiterTier::Mainnet);
        assert_eq!(
            mainnet.get_remaining(EndpointType::OrderPlacement).await,
            10
        );
        assert_eq!(mainnet.get_remaining(EndpointType::ReadOnly).await, 20);

        let premium = BitgetRateLimiter::from_tier(RateLimiterTier::Premium);
        assert_eq!(
            premium.get_remaining(EndpointType::OrderPlacement).await,
            30
        );
        assert_eq!(premium.get_remaining(EndpointType::ReadOnly).await, 100);
    }

    #[tokio::test]
    async fn test_avg_wait_time_calculation() {
        let metrics = RateLimiterMetrics {
            requests_throttled: 4,
            total_wait_time_ms: 200,
            total_requests: 10,
        };

        assert!((metrics.avg_wait_time_ms() - 50.0).abs() < 0.01);

        let empty_metrics = RateLimiterMetrics::default();
        assert_eq!(empty_metrics.avg_wait_time_ms(), 0.0);
    }

    #[test]
    #[should_panic(expected = "order_limit must be > 0")]
    fn test_zero_order_limit_panics() {
        BitgetRateLimiterBuilder::new()
            .with_order_limit(0)
            .build();
    }

    #[test]
    #[should_panic(expected = "read_limit must be > 0")]
    fn test_zero_read_limit_panics() {
        BitgetRateLimiterBuilder::new()
            .with_read_limit(0)
            .build();
    }
}
