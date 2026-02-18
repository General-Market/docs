//! 1inch Rate Limit Handler with multi-key rotation and exponential backoff
//!
//! Implements Strategy 1 (Multiple API Keys) and Strategy 2 (Exponential Backoff)
//! from architecture.md Section 14 (1inch API Rate Limit Strategy).
//!
//! # Architecture
//!
//! ```text
//! Issuer Cycle → Price Fetching → OneInchRateLimitHandler
//!                                     ├─ key rotation + retry
//!                                     ├─ Creates temp OneInchQuoteClient per request
//!                                     └─ (on total failure) → caller uses OnchainQuoteClient (Story 5.9)
//! ```
//!
//! The rate limit handler creates temporary quote clients with the selected API key
//! for each request. It does NOT directly invoke the on-chain fallback;
//! instead it returns `MaxRetriesExceeded` that the caller uses to trigger fallback.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use reqwest::Client;
use tokio::sync::RwLock;
use tracing::{debug, trace, warn};

use super::client::{OneInchQuoteClient, QuoteClientConfig};
use super::error::OneInchError;
use super::types::{Quote, SupportedChain};

/// Configuration for rate limit handling with exponential backoff
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Base delay for exponential backoff (default: 1 second)
    pub base_delay: Duration,
    /// Backoff multiplier (default: 2)
    pub multiplier: u32,
    /// Maximum retries per key before marking exhausted (default: 5)
    pub max_retries_per_key: u32,
    /// Duration a key stays exhausted before recovery (default: 60 seconds)
    pub exhaustion_cooldown: Duration,
    /// Maximum total retry attempts across all keys (default: 15)
    pub max_total_retries: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            base_delay: Duration::from_secs(1),
            multiplier: 2,
            max_retries_per_key: 5,
            exhaustion_cooldown: Duration::from_secs(60),
            max_total_retries: 15, // 5 retries × 3 keys before giving up
        }
    }
}

impl RateLimitConfig {
    /// Create a new config with custom values
    pub fn new(
        base_delay: Duration,
        multiplier: u32,
        max_retries_per_key: u32,
        exhaustion_cooldown: Duration,
        max_total_retries: u32,
    ) -> Self {
        Self {
            base_delay,
            multiplier,
            max_retries_per_key,
            exhaustion_cooldown,
            max_total_retries,
        }
    }

    /// Calculate backoff delay for a given retry attempt (0-indexed)
    pub fn backoff_delay(&self, attempt: u32) -> Duration {
        // Cap at max_retries_per_key - 1 to prevent overflow
        let capped_attempt = attempt.min(self.max_retries_per_key.saturating_sub(1));
        let multiplier = self.multiplier.saturating_pow(capped_attempt);
        self.base_delay.saturating_mul(multiplier)
    }
}

/// State tracking for an individual API key
pub struct ApiKeyState {
    /// The API key (stored securely, never logged)
    api_key: String,
    /// Total requests sent using this key
    pub requests_sent: AtomicU64,
    /// Number of rate limit responses received
    pub rate_limits_received: AtomicU64,
    /// Consecutive failures (reset on success)
    pub consecutive_failures: AtomicU32,
    /// Time until which this key is marked exhausted (None if healthy)
    /// Using std::sync::RwLock for synchronous access to avoid async in hot path
    exhausted_until: std::sync::RwLock<Option<Instant>>,
}

impl ApiKeyState {
    /// Create a new key state
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            requests_sent: AtomicU64::new(0),
            rate_limits_received: AtomicU64::new(0),
            consecutive_failures: AtomicU32::new(0),
            exhausted_until: std::sync::RwLock::new(None),
        }
    }

    /// Get the API key (for use in requests)
    pub fn key(&self) -> &str {
        &self.api_key
    }

    /// Check if this key is currently exhausted (synchronous for efficiency)
    pub fn is_exhausted(&self) -> bool {
        let exhausted = self.exhausted_until.read().unwrap();
        match *exhausted {
            Some(until) => Instant::now() < until,
            None => false,
        }
    }

    /// Mark this key as exhausted for the cooldown period
    pub fn mark_exhausted(&self, cooldown: Duration) {
        let mut exhausted = self.exhausted_until.write().unwrap();
        *exhausted = Some(Instant::now() + cooldown);
    }

    /// Reset the exhausted state and consecutive failures
    pub fn reset(&self) {
        let mut exhausted = self.exhausted_until.write().unwrap();
        *exhausted = None;
        self.consecutive_failures.store(0, Ordering::Relaxed);
    }

    /// Record a successful request
    pub fn record_success(&self) {
        self.requests_sent.fetch_add(1, Ordering::Relaxed);
        self.consecutive_failures.store(0, Ordering::Relaxed);
    }

    /// Record a rate limit response
    pub fn record_rate_limit(&self) {
        self.requests_sent.fetch_add(1, Ordering::Relaxed);
        self.rate_limits_received.fetch_add(1, Ordering::Relaxed);
        self.consecutive_failures.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a retryable error (not rate limit)
    pub fn record_retryable_error(&self) {
        self.requests_sent.fetch_add(1, Ordering::Relaxed);
        self.consecutive_failures.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a non-retryable error
    pub fn record_non_retryable_error(&self) {
        self.requests_sent.fetch_add(1, Ordering::Relaxed);
    }
}

// Custom Debug implementation to redact API key
impl std::fmt::Debug for ApiKeyState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApiKeyState")
            .field("api_key", &"[REDACTED]")
            .field("requests_sent", &self.requests_sent.load(Ordering::Relaxed))
            .field(
                "rate_limits_received",
                &self.rate_limits_received.load(Ordering::Relaxed),
            )
            .field(
                "consecutive_failures",
                &self.consecutive_failures.load(Ordering::Relaxed),
            )
            .finish()
    }
}

/// Snapshot of rate limit metrics
#[derive(Debug, Clone, Default)]
pub struct RateLimitMetricsSnapshot {
    /// Total rate limit responses received
    pub rate_limits_hit: u64,
    /// Total retry attempts
    pub retries_total: u64,
    /// Times fallback was triggered (all keys exhausted)
    pub fallbacks_triggered: u64,
    /// Number of times a key was marked exhausted
    pub keys_exhausted: u64,
    /// Total network errors encountered
    pub network_errors: u64,
}

/// Metrics for rate limit handling
#[derive(Debug, Default)]
pub struct RateLimitMetrics {
    /// Total rate limit responses received
    pub rate_limits_hit: AtomicU64,
    /// Total retry attempts
    pub retries_total: AtomicU64,
    /// Times fallback was triggered (all keys exhausted)
    pub fallbacks_triggered: AtomicU64,
    /// Number of times a key was marked exhausted
    pub keys_exhausted: AtomicU64,
    /// Total network errors encountered
    pub network_errors: AtomicU64,
}

impl RateLimitMetrics {
    /// Get a snapshot of current metrics
    pub fn snapshot(&self) -> RateLimitMetricsSnapshot {
        RateLimitMetricsSnapshot {
            rate_limits_hit: self.rate_limits_hit.load(Ordering::Relaxed),
            retries_total: self.retries_total.load(Ordering::Relaxed),
            fallbacks_triggered: self.fallbacks_triggered.load(Ordering::Relaxed),
            keys_exhausted: self.keys_exhausted.load(Ordering::Relaxed),
            network_errors: self.network_errors.load(Ordering::Relaxed),
        }
    }

    fn record_rate_limit(&self) {
        self.rate_limits_hit.fetch_add(1, Ordering::Relaxed);
    }

    fn record_retry(&self) {
        self.retries_total.fetch_add(1, Ordering::Relaxed);
    }

    fn record_fallback(&self) {
        self.fallbacks_triggered.fetch_add(1, Ordering::Relaxed);
    }

    fn record_key_exhausted(&self) {
        self.keys_exhausted.fetch_add(1, Ordering::Relaxed);
    }

    fn record_network_error(&self) {
        self.network_errors.fetch_add(1, Ordering::Relaxed);
    }
}

/// Rate limit handler with multi-key rotation and exponential backoff
///
/// This handler manages a pool of API keys and creates temporary `OneInchQuoteClient`
/// instances for each request using the selected key. This provides:
/// - Multiple API key support with automatic rotation
/// - Exponential backoff: 1s, 2s, 4s, 8s, 16s
/// - Key exhaustion after 5 consecutive failures (60s cooldown)
/// - Metrics for monitoring rate limit events
///
/// # Key Rotation
///
/// Unlike a generic wrapper approach, this handler ACTUALLY uses different API keys
/// by creating temporary clients per request. Each request:
/// 1. Selects the healthiest (least-loaded, non-exhausted) key
/// 2. Creates a temporary `OneInchQuoteClient` with that key
/// 3. Makes the request
/// 4. On failure, applies backoff and potentially rotates to next key
///
/// # Example
///
/// ```ignore
/// let handler = OneInchRateLimitHandler::new(None, None)?;
/// handler.add_key("key1".to_string()).await;
/// handler.add_key("key2".to_string()).await;
///
/// // Automatically handles rate limits, retries, and key rotation
/// let quote = handler.get_quote(
///     "0xaf88...", "0x82af...", "1000000", SupportedChain::Arbitrum
/// ).await?;
/// ```
pub struct OneInchRateLimitHandler {
    /// Shared HTTP client for all requests (connection pooling)
    http_client: Client,
    /// Configuration for the quote client
    client_config: QuoteClientConfig,
    /// Pool of API keys with their states
    keys: RwLock<Vec<Arc<ApiKeyState>>>,
    /// Configuration for rate limit handling
    config: RateLimitConfig,
    /// Metrics for monitoring
    metrics: RateLimitMetrics,
}

impl OneInchRateLimitHandler {
    /// Create a new rate limit handler
    ///
    /// Note: You must add at least one API key using `add_key()` before making requests.
    ///
    /// # Arguments
    /// * `rate_limit_config` - Optional rate limit configuration (uses defaults if None)
    /// * `client_config` - Optional client configuration (uses defaults if None)
    pub fn new(
        rate_limit_config: Option<RateLimitConfig>,
        client_config: Option<QuoteClientConfig>,
    ) -> Result<Self, OneInchError> {
        let client_config = client_config.unwrap_or_default();
        let http_client = Client::builder()
            .timeout(client_config.timeout)
            .build()?;

        Ok(Self {
            http_client,
            client_config,
            keys: RwLock::new(Vec::new()),
            config: rate_limit_config.unwrap_or_default(),
            metrics: RateLimitMetrics::default(),
        })
    }

    /// Create a new rate limit handler with an initial API key
    pub fn with_key(
        api_key: String,
        rate_limit_config: Option<RateLimitConfig>,
        client_config: Option<QuoteClientConfig>,
    ) -> Result<Self, OneInchError> {
        let client_config = client_config.unwrap_or_default();
        let http_client = Client::builder()
            .timeout(client_config.timeout)
            .build()?;

        let keys = vec![Arc::new(ApiKeyState::new(api_key))];

        Ok(Self {
            http_client,
            client_config,
            keys: RwLock::new(keys),
            config: rate_limit_config.unwrap_or_default(),
            metrics: RateLimitMetrics::default(),
        })
    }

    /// Create a new rate limit handler with multiple initial API keys
    pub fn with_keys(
        api_keys: Vec<String>,
        rate_limit_config: Option<RateLimitConfig>,
        client_config: Option<QuoteClientConfig>,
    ) -> Result<Self, OneInchError> {
        let client_config = client_config.unwrap_or_default();
        let http_client = Client::builder()
            .timeout(client_config.timeout)
            .build()?;

        let keys: Vec<Arc<ApiKeyState>> = api_keys
            .into_iter()
            .map(|k| Arc::new(ApiKeyState::new(k)))
            .collect();

        Ok(Self {
            http_client,
            client_config,
            keys: RwLock::new(keys),
            config: rate_limit_config.unwrap_or_default(),
            metrics: RateLimitMetrics::default(),
        })
    }

    /// Add an API key to the pool
    pub async fn add_key(&self, api_key: String) {
        let mut keys = self.keys.write().await;
        keys.push(Arc::new(ApiKeyState::new(api_key)));
        debug!(total_keys = keys.len(), "Added API key to pool");
    }

    /// Get the number of keys in the pool
    pub async fn key_count(&self) -> usize {
        self.keys.read().await.len()
    }

    /// Get the healthy key with the lowest request count (least-loaded)
    ///
    /// Returns `None` if all keys are exhausted.
    /// Uses synchronous exhaustion checks for efficiency under concurrent load.
    pub async fn get_healthy_key(&self) -> Option<Arc<ApiKeyState>> {
        let keys = self.keys.read().await;

        let mut best_key: Option<Arc<ApiKeyState>> = None;
        let mut lowest_count = u64::MAX;

        for key in keys.iter() {
            // Use synchronous is_exhausted() to avoid holding async lock during iteration
            if key.is_exhausted() {
                continue;
            }

            let count = key.requests_sent.load(Ordering::Relaxed);
            if count < lowest_count {
                lowest_count = count;
                best_key = Some(key.clone());
            }
        }

        best_key
    }

    /// Get a snapshot of current metrics
    pub fn metrics(&self) -> RateLimitMetricsSnapshot {
        self.metrics.snapshot()
    }

    /// Execute a quote request with retry logic and key rotation
    ///
    /// The retry strategy is:
    /// 1. Select the healthiest (least-loaded, non-exhausted) key
    /// 2. Create a temporary `OneInchQuoteClient` with that key
    /// 3. Retry with exponential backoff until:
    ///    - Success: return the result
    ///    - Non-retryable error: return the error immediately
    ///    - Key exhausted (5 consecutive failures): switch to next healthy key
    /// 4. If all keys are exhausted, return `MaxRetriesExceeded`
    pub async fn get_quote(
        &self,
        from_token: &str,
        to_token: &str,
        amount: &str,
        chain: SupportedChain,
    ) -> Result<Quote, OneInchError> {
        let mut total_attempts = 0u32;

        // Outer loop: iterate over keys
        loop {
            // Check if we've exceeded total retries
            if total_attempts >= self.config.max_total_retries {
                self.metrics.record_fallback();
                warn!(
                    code = "INFRA-012",
                    total_attempts,
                    max_total = self.config.max_total_retries,
                    "All retry attempts exhausted"
                );
                return Err(OneInchError::MaxRetriesExceeded {
                    attempts: total_attempts,
                });
            }

            // Get a healthy key - this key will be used until exhausted or success
            let key = match self.get_healthy_key().await {
                Some(k) => k,
                None => {
                    self.metrics.record_fallback();
                    warn!(code = "INFRA-012", "All API keys exhausted, no healthy keys available");
                    return Err(OneInchError::MaxRetriesExceeded {
                        attempts: total_attempts,
                    });
                }
            };

            // Create a temporary client with the selected API key
            let client = OneInchQuoteClient::with_client(
                key.key(),
                self.http_client.clone(),
                Some(self.client_config.clone()),
            );

            // Inner loop: retry with the same key until exhausted or success
            loop {
                // Check if we've exceeded total retries
                if total_attempts >= self.config.max_total_retries {
                    self.metrics.record_fallback();
                    warn!(
                        code = "INFRA-012",
                        total_attempts,
                        max_total = self.config.max_total_retries,
                        "All retry attempts exhausted"
                    );
                    return Err(OneInchError::MaxRetriesExceeded {
                        attempts: total_attempts,
                    });
                }

                // Attempt the request using the temporary client with the selected key
                let result = client.get_quote(from_token, to_token, amount, chain).await;

                match result {
                    Ok(quote) => {
                        key.record_success();
                        trace!(
                            requests = key.requests_sent.load(Ordering::Relaxed),
                            "Quote request successful"
                        );
                        return Ok(quote);
                    }
                    Err(ref err) if err.is_retryable() => {
                        total_attempts += 1;
                        self.metrics.record_retry();

                        let is_rate_limited = matches!(err, OneInchError::RateLimited { .. });
                        let is_network_error = matches!(err, OneInchError::NetworkError { .. });

                        if is_rate_limited {
                            key.record_rate_limit();
                            self.metrics.record_rate_limit();
                        } else {
                            key.record_retryable_error();
                            if is_network_error {
                                self.metrics.record_network_error();
                            }
                        }

                        let consecutive = key.consecutive_failures.load(Ordering::Relaxed);

                        // Check if we should mark this key as exhausted
                        if consecutive >= self.config.max_retries_per_key {
                            key.mark_exhausted(self.config.exhaustion_cooldown);
                            self.metrics.record_key_exhausted();
                            warn!(
                                code = "INFRA-012",
                                consecutive_failures = consecutive,
                                cooldown_secs = self.config.exhaustion_cooldown.as_secs(),
                                "API key marked as exhausted"
                            );
                            // Break inner loop to try next key
                            break;
                        }

                        // Calculate backoff delay
                        let retry_attempt = consecutive.saturating_sub(1);
                        let backoff = if is_rate_limited {
                            // Use API-provided retry-after if available, otherwise exponential backoff
                            err.retry_after()
                                .map(|ms| Duration::from_millis(ms))
                                .unwrap_or_else(|| self.config.backoff_delay(retry_attempt))
                        } else {
                            self.config.backoff_delay(retry_attempt)
                        };

                        debug!(
                            attempt = total_attempts,
                            backoff_ms = backoff.as_millis(),
                            error = %err,
                            "Retrying after backoff"
                        );

                        tokio::time::sleep(backoff).await;
                    }
                    Err(err) => {
                        // Non-retryable error - return immediately
                        key.record_non_retryable_error();
                        debug!(error = %err, "Non-retryable error, returning immediately");
                        return Err(err);
                    }
                }
            }
        }
    }

    /// Get a quote using a QuoteRequest struct
    pub async fn get_quote_from_request(
        &self,
        request: &super::types::QuoteRequest,
    ) -> Result<Quote, OneInchError> {
        self.get_quote(
            &request.from_token,
            &request.to_token,
            &request.amount,
            request.chain,
        )
        .await
    }
}

impl std::fmt::Debug for OneInchRateLimitHandler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OneInchRateLimitHandler")
            .field("client_config", &self.client_config)
            .field("config", &self.config)
            .field("metrics", &self.metrics.snapshot())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use std::sync::Mutex as StdMutex;

    // =========================================================================
    // Test Helpers
    // =========================================================================

    /// Mock quote provider for testing rate limit handling
    /// This simulates the behavior of OneInchQuoteClient without making real HTTP calls
    struct MockQuoteProvider {
        /// Count of calls made
        call_count: AtomicUsize,
        /// Queue of responses to return
        responses: StdMutex<Vec<Result<Quote, OneInchError>>>,
    }

    impl MockQuoteProvider {
        fn new() -> Self {
            Self {
                call_count: AtomicUsize::new(0),
                responses: StdMutex::new(Vec::new()),
            }
        }

        fn with_responses(responses: Vec<Result<Quote, OneInchError>>) -> Self {
            Self {
                call_count: AtomicUsize::new(0),
                responses: StdMutex::new(responses),
            }
        }

        fn call_count(&self) -> usize {
            self.call_count.load(Ordering::SeqCst)
        }

        async fn get_quote(
            &self,
            _from_token: &str,
            _to_token: &str,
            _amount: &str,
            _chain: SupportedChain,
        ) -> Result<Quote, OneInchError> {
            self.call_count.fetch_add(1, Ordering::SeqCst);

            let mut responses = self.responses.lock().unwrap();
            if responses.is_empty() {
                Ok(mock_quote())
            } else {
                responses.remove(0)
            }
        }
    }

    impl std::fmt::Debug for MockQuoteProvider {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.debug_struct("MockQuoteProvider")
                .field("call_count", &self.call_count())
                .finish()
        }
    }

    /// Test-only rate limit handler that uses mock provider instead of real HTTP
    struct TestRateLimitHandler {
        mock: Arc<MockQuoteProvider>,
        keys: RwLock<Vec<Arc<ApiKeyState>>>,
        config: RateLimitConfig,
        metrics: RateLimitMetrics,
    }

    impl TestRateLimitHandler {
        fn new(mock: MockQuoteProvider, config: Option<RateLimitConfig>) -> Self {
            Self {
                mock: Arc::new(mock),
                keys: RwLock::new(Vec::new()),
                config: config.unwrap_or_default(),
                metrics: RateLimitMetrics::default(),
            }
        }

        fn with_key(mock: MockQuoteProvider, api_key: String, config: Option<RateLimitConfig>) -> Self {
            let keys = vec![Arc::new(ApiKeyState::new(api_key))];
            Self {
                mock: Arc::new(mock),
                keys: RwLock::new(keys),
                config: config.unwrap_or_default(),
                metrics: RateLimitMetrics::default(),
            }
        }

        async fn add_key(&self, api_key: String) {
            let mut keys = self.keys.write().await;
            keys.push(Arc::new(ApiKeyState::new(api_key)));
        }

        async fn key_count(&self) -> usize {
            self.keys.read().await.len()
        }

        async fn get_healthy_key(&self) -> Option<Arc<ApiKeyState>> {
            let keys = self.keys.read().await;
            let mut best_key: Option<Arc<ApiKeyState>> = None;
            let mut lowest_count = u64::MAX;

            for key in keys.iter() {
                if key.is_exhausted() {
                    continue;
                }
                let count = key.requests_sent.load(Ordering::Relaxed);
                if count < lowest_count {
                    lowest_count = count;
                    best_key = Some(key.clone());
                }
            }
            best_key
        }

        fn metrics(&self) -> RateLimitMetricsSnapshot {
            self.metrics.snapshot()
        }

        fn mock(&self) -> &MockQuoteProvider {
            &self.mock
        }

        async fn get_quote(
            &self,
            from_token: &str,
            to_token: &str,
            amount: &str,
            chain: SupportedChain,
        ) -> Result<Quote, OneInchError> {
            let mut total_attempts = 0u32;

            loop {
                if total_attempts >= self.config.max_total_retries {
                    self.metrics.record_fallback();
                    return Err(OneInchError::MaxRetriesExceeded { attempts: total_attempts });
                }

                let key = match self.get_healthy_key().await {
                    Some(k) => k,
                    None => {
                        self.metrics.record_fallback();
                        return Err(OneInchError::MaxRetriesExceeded { attempts: total_attempts });
                    }
                };

                loop {
                    if total_attempts >= self.config.max_total_retries {
                        self.metrics.record_fallback();
                        return Err(OneInchError::MaxRetriesExceeded { attempts: total_attempts });
                    }

                    let result = self.mock.get_quote(from_token, to_token, amount, chain).await;

                    match result {
                        Ok(quote) => {
                            key.record_success();
                            return Ok(quote);
                        }
                        Err(ref err) if err.is_retryable() => {
                            total_attempts += 1;
                            self.metrics.record_retry();

                            let is_rate_limited = matches!(err, OneInchError::RateLimited { .. });
                            let is_network_error = matches!(err, OneInchError::NetworkError { .. });

                            if is_rate_limited {
                                key.record_rate_limit();
                                self.metrics.record_rate_limit();
                            } else {
                                key.record_retryable_error();
                                if is_network_error {
                                    self.metrics.record_network_error();
                                }
                            }

                            let consecutive = key.consecutive_failures.load(Ordering::Relaxed);

                            if consecutive >= self.config.max_retries_per_key {
                                key.mark_exhausted(self.config.exhaustion_cooldown);
                                self.metrics.record_key_exhausted();
                                break;
                            }

                            let retry_attempt = consecutive.saturating_sub(1);
                            let backoff = if is_rate_limited {
                                err.retry_after()
                                    .map(|ms| Duration::from_millis(ms))
                                    .unwrap_or_else(|| self.config.backoff_delay(retry_attempt))
                            } else {
                                self.config.backoff_delay(retry_attempt)
                            };

                            tokio::time::sleep(backoff).await;
                        }
                        Err(err) => {
                            key.record_non_retryable_error();
                            return Err(err);
                        }
                    }
                }
            }
        }
    }

    fn mock_quote() -> Quote {
        Quote {
            to_amount: "999500000000000000".to_string(),
            estimated_gas: 150000,
            protocols: vec![],
        }
    }

    const USDC_ARBITRUM: &str = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_ARBITRUM: &str = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

    // =========================================================================
    // Task 1: Config and State Tests
    // =========================================================================

    #[test]
    fn test_default_config() {
        let config = RateLimitConfig::default();
        assert_eq!(config.base_delay, Duration::from_secs(1));
        assert_eq!(config.multiplier, 2);
        assert_eq!(config.max_retries_per_key, 5);
        assert_eq!(config.exhaustion_cooldown, Duration::from_secs(60));
        assert_eq!(config.max_total_retries, 15);
    }

    #[test]
    fn test_backoff_delay_calculation() {
        let config = RateLimitConfig::default();

        // Expected: 1s, 2s, 4s, 8s, 16s
        assert_eq!(config.backoff_delay(0), Duration::from_secs(1));
        assert_eq!(config.backoff_delay(1), Duration::from_secs(2));
        assert_eq!(config.backoff_delay(2), Duration::from_secs(4));
        assert_eq!(config.backoff_delay(3), Duration::from_secs(8));
        assert_eq!(config.backoff_delay(4), Duration::from_secs(16));

        // Should cap at max retries
        assert_eq!(config.backoff_delay(100), Duration::from_secs(16));
    }

    #[test]
    fn test_api_key_state_debug_redacts_key() {
        let state = ApiKeyState::new("super-secret-api-key".to_string());
        let debug_str = format!("{:?}", state);
        assert!(!debug_str.contains("super-secret-api-key"));
        assert!(debug_str.contains("[REDACTED]"));
    }

    #[test]
    fn test_api_key_state_exhaustion() {
        let state = ApiKeyState::new("test-key".to_string());

        // Initially not exhausted
        assert!(!state.is_exhausted());

        // Mark exhausted
        state.mark_exhausted(Duration::from_secs(60));
        assert!(state.is_exhausted());

        // Reset
        state.reset();
        assert!(!state.is_exhausted());
    }

    #[test]
    fn test_api_key_state_counters() {
        let state = ApiKeyState::new("test-key".to_string());

        // Record success
        state.record_success();
        assert_eq!(state.requests_sent.load(Ordering::Relaxed), 1);
        assert_eq!(state.consecutive_failures.load(Ordering::Relaxed), 0);

        // Record rate limit
        state.record_rate_limit();
        assert_eq!(state.requests_sent.load(Ordering::Relaxed), 2);
        assert_eq!(state.rate_limits_received.load(Ordering::Relaxed), 1);
        assert_eq!(state.consecutive_failures.load(Ordering::Relaxed), 1);

        // Success resets consecutive failures
        state.record_success();
        assert_eq!(state.consecutive_failures.load(Ordering::Relaxed), 0);
    }

    // =========================================================================
    // Task 2: API Key Pool and Selection Tests
    // =========================================================================

    #[tokio::test]
    async fn test_add_key() {
        let handler = TestRateLimitHandler::new(MockQuoteProvider::new(), None);

        assert_eq!(handler.key_count().await, 0);

        handler.add_key("key1".to_string()).await;
        assert_eq!(handler.key_count().await, 1);

        handler.add_key("key2".to_string()).await;
        assert_eq!(handler.key_count().await, 2);
    }

    #[tokio::test]
    async fn test_with_key_constructor() {
        let handler = TestRateLimitHandler::with_key(
            MockQuoteProvider::new(),
            "initial-key".to_string(),
            None,
        );

        assert_eq!(handler.key_count().await, 1);
    }

    #[tokio::test]
    async fn test_get_healthy_key_selects_least_loaded() {
        let handler = TestRateLimitHandler::new(MockQuoteProvider::new(), None);

        handler.add_key("key1".to_string()).await;
        handler.add_key("key2".to_string()).await;

        // Simulate key1 having more requests
        {
            let keys = handler.keys.read().await;
            keys[0].requests_sent.store(10, Ordering::Relaxed);
            keys[1].requests_sent.store(2, Ordering::Relaxed);
        }

        // Should select key2 (least loaded)
        let selected = handler.get_healthy_key().await.unwrap();
        assert_eq!(selected.requests_sent.load(Ordering::Relaxed), 2);
    }

    #[tokio::test]
    async fn test_get_healthy_key_skips_exhausted() {
        let handler = TestRateLimitHandler::new(MockQuoteProvider::new(), None);

        handler.add_key("key1".to_string()).await;
        handler.add_key("key2".to_string()).await;

        // Mark key1 as exhausted
        {
            let keys = handler.keys.read().await;
            keys[0].mark_exhausted(Duration::from_secs(60));
        }

        // Should select key2 (key1 is exhausted)
        let selected = handler.get_healthy_key().await.unwrap();
        // key2 has 0 requests since it's the only healthy one
        assert_eq!(selected.requests_sent.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn test_get_healthy_key_none_when_all_exhausted() {
        let handler = TestRateLimitHandler::new(MockQuoteProvider::new(), None);

        handler.add_key("key1".to_string()).await;
        handler.add_key("key2".to_string()).await;

        // Mark both keys as exhausted
        {
            let keys = handler.keys.read().await;
            keys[0].mark_exhausted(Duration::from_secs(60));
            keys[1].mark_exhausted(Duration::from_secs(60));
        }

        assert!(handler.get_healthy_key().await.is_none());
    }

    // =========================================================================
    // Task 3: Exponential Backoff Retry Tests
    // =========================================================================

    #[tokio::test(start_paused = true)]
    async fn test_exponential_backoff_timing() {
        // Test with deterministic time control using tokio's paused time
        let responses = vec![
            Err(OneInchError::RateLimited {
                retry_after_ms: None,
            }),
            Err(OneInchError::RateLimited {
                retry_after_ms: None,
            }),
            Ok(mock_quote()),
        ];

        let handler = TestRateLimitHandler::with_key(
            MockQuoteProvider::with_responses(responses),
            "test-key".to_string(),
            None,
        );

        // Use tokio::time::Instant for paused time tests
        let start = tokio::time::Instant::now();
        let result = handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await;

        assert!(result.is_ok());

        // Should have waited: 1s (first retry) + 2s (second retry) = 3s
        let elapsed = start.elapsed();
        assert!(
            elapsed >= Duration::from_secs(3),
            "Expected at least 3s delay, got {:?}",
            elapsed
        );
    }

    #[tokio::test(start_paused = true)]
    async fn test_retry_after_header_respected() {
        // API tells us to wait 5 seconds
        let responses = vec![
            Err(OneInchError::RateLimited {
                retry_after_ms: Some(5000),
            }),
            Ok(mock_quote()),
        ];

        let handler = TestRateLimitHandler::with_key(
            MockQuoteProvider::with_responses(responses),
            "test-key".to_string(),
            None,
        );

        // Use tokio::time::Instant for paused time tests
        let start = tokio::time::Instant::now();
        let result = handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await;

        assert!(result.is_ok());

        // Should have waited 5s (from retry-after)
        let elapsed = start.elapsed();
        assert!(
            elapsed >= Duration::from_secs(5),
            "Expected at least 5s delay, got {:?}",
            elapsed
        );
    }

    #[tokio::test]
    async fn test_key_exhaustion_after_consecutive_failures() {
        // 5 rate limits should exhaust the key
        let responses: Vec<_> = (0..5)
            .map(|_| {
                Err(OneInchError::RateLimited {
                    retry_after_ms: Some(1), // Very short delay for testing
                })
            })
            .chain(std::iter::once(Ok(mock_quote())))
            .collect();

        let config = RateLimitConfig {
            base_delay: Duration::from_millis(1),
            max_retries_per_key: 5,
            max_total_retries: 10,
            ..Default::default()
        };
        let handler = TestRateLimitHandler::new(MockQuoteProvider::with_responses(responses), Some(config));
        handler.add_key("key1".to_string()).await;
        handler.add_key("key2".to_string()).await;

        let result = handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await;

        assert!(result.is_ok());

        // Check that key1 was exhausted
        {
            let keys = handler.keys.read().await;
            assert!(keys[0].is_exhausted());
            assert!(!keys[1].is_exhausted());
        }

        // Check metrics
        let metrics = handler.metrics();
        assert!(metrics.keys_exhausted >= 1);
    }

    #[tokio::test]
    async fn test_all_keys_exhausted_returns_max_retries() {
        // More failures than we can handle
        let responses: Vec<_> = (0..20)
            .map(|_| {
                Err(OneInchError::RateLimited {
                    retry_after_ms: Some(1),
                })
            })
            .collect();

        let config = RateLimitConfig {
            base_delay: Duration::from_millis(1),
            max_retries_per_key: 5,
            max_total_retries: 10,
            exhaustion_cooldown: Duration::from_secs(60),
            ..Default::default()
        };
        let handler = TestRateLimitHandler::new(MockQuoteProvider::with_responses(responses), Some(config));
        handler.add_key("key1".to_string()).await;

        let result = handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await;

        assert!(matches!(
            result,
            Err(OneInchError::MaxRetriesExceeded { .. })
        ));

        // Check metrics
        let metrics = handler.metrics();
        assert!(metrics.fallbacks_triggered >= 1);
    }

    #[tokio::test]
    async fn test_non_retryable_error_returns_immediately() {
        let responses = vec![
            Err(OneInchError::InvalidApiKey),
        ];

        let handler = TestRateLimitHandler::with_key(
            MockQuoteProvider::with_responses(responses),
            "test-key".to_string(),
            None,
        );

        let result = handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await;

        assert!(matches!(result, Err(OneInchError::InvalidApiKey)));

        // Should have only made 1 attempt
        assert_eq!(handler.mock().call_count(), 1);

        // No retries should have been recorded
        let metrics = handler.metrics();
        assert_eq!(metrics.retries_total, 0);
    }

    #[tokio::test]
    async fn test_timeout_error_is_retried() {
        // Timeout errors are retryable
        let responses = vec![
            Err(OneInchError::Timeout { timeout_ms: 10000 }),
            Ok(mock_quote()),
        ];

        let config = RateLimitConfig {
            base_delay: Duration::from_millis(1),
            ..Default::default()
        };
        let handler = TestRateLimitHandler::with_key(
            MockQuoteProvider::with_responses(responses),
            "test-key".to_string(),
            Some(config),
        );

        let result = handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await;

        assert!(result.is_ok());
        assert_eq!(handler.mock().call_count(), 2);
    }

    // =========================================================================
    // Task 4: Rate-Limited Quote Client Tests
    // =========================================================================

    #[tokio::test]
    async fn test_successful_quote_request() {
        let handler = TestRateLimitHandler::with_key(
            MockQuoteProvider::with_responses(vec![Ok(mock_quote())]),
            "test-key".to_string(),
            None,
        );

        let result = handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await;

        assert!(result.is_ok());
        let quote = result.unwrap();
        assert_eq!(quote.to_amount, "999500000000000000");
        assert_eq!(quote.estimated_gas, 150000);
    }

    // =========================================================================
    // Task 5: Metrics Tests
    // =========================================================================

    #[tokio::test]
    async fn test_metrics_rate_limit_tracking() {
        let responses = vec![
            Err(OneInchError::RateLimited {
                retry_after_ms: Some(1),
            }),
            Ok(mock_quote()),
        ];

        let config = RateLimitConfig {
            base_delay: Duration::from_millis(1),
            ..Default::default()
        };
        let handler = TestRateLimitHandler::with_key(
            MockQuoteProvider::with_responses(responses),
            "test-key".to_string(),
            Some(config),
        );

        handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();

        let metrics = handler.metrics();
        assert_eq!(metrics.rate_limits_hit, 1);
        assert_eq!(metrics.retries_total, 1);
        assert_eq!(metrics.fallbacks_triggered, 0);
    }

    #[tokio::test]
    async fn test_metrics_network_error_tracking() {
        let responses = vec![
            Err(OneInchError::Timeout { timeout_ms: 1000 }),
            Ok(mock_quote()),
        ];

        let config = RateLimitConfig {
            base_delay: Duration::from_millis(1),
            ..Default::default()
        };
        let handler = TestRateLimitHandler::with_key(
            MockQuoteProvider::with_responses(responses),
            "test-key".to_string(),
            Some(config),
        );

        handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();

        let metrics = handler.metrics();
        assert_eq!(metrics.retries_total, 1);
        // Timeout is not a NetworkError, but we track network errors separately now
        assert_eq!(metrics.network_errors, 0);
    }

    #[test]
    fn test_metrics_snapshot_default() {
        let snapshot = RateLimitMetricsSnapshot::default();
        assert_eq!(snapshot.rate_limits_hit, 0);
        assert_eq!(snapshot.retries_total, 0);
        assert_eq!(snapshot.fallbacks_triggered, 0);
        assert_eq!(snapshot.keys_exhausted, 0);
        assert_eq!(snapshot.network_errors, 0);
    }

    // =========================================================================
    // Task 6: Key Rotation Tests
    // =========================================================================

    #[tokio::test]
    async fn test_key_rotation_on_rate_limit() {
        // Key 1 gets rate limited 5 times, then we should switch to key 2
        let responses: Vec<_> = (0..5)
            .map(|_| {
                Err(OneInchError::RateLimited {
                    retry_after_ms: Some(1),
                })
            })
            .chain(std::iter::once(Ok(mock_quote())))
            .collect();

        let config = RateLimitConfig {
            base_delay: Duration::from_millis(1),
            max_retries_per_key: 5,
            max_total_retries: 10,
            ..Default::default()
        };
        let handler = TestRateLimitHandler::new(MockQuoteProvider::with_responses(responses), Some(config));
        handler.add_key("key1".to_string()).await;
        handler.add_key("key2".to_string()).await;

        let result = handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await;

        assert!(result.is_ok());

        // Key1 should be exhausted, key2 should have 1 successful request
        let keys = handler.keys.read().await;
        assert!(keys[0].is_exhausted());
        assert!(!keys[1].is_exhausted());
        assert_eq!(keys[1].requests_sent.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn test_multi_key_load_balancing() {
        // Multiple successful requests should be distributed
        let responses: Vec<_> = (0..4).map(|_| Ok(mock_quote())).collect();

        let handler = TestRateLimitHandler::new(MockQuoteProvider::with_responses(responses), None);
        handler.add_key("key1".to_string()).await;
        handler.add_key("key2".to_string()).await;

        // Make 4 requests
        for _ in 0..4 {
            handler
                .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
                .await
                .unwrap();
        }

        // Both keys should have requests (least-loaded selection)
        let keys = handler.keys.read().await;
        let total_requests: u64 = keys
            .iter()
            .map(|k| k.requests_sent.load(Ordering::Relaxed))
            .sum();
        assert_eq!(total_requests, 4);

        // With least-loaded selection, they should be roughly balanced
        let key1_requests = keys[0].requests_sent.load(Ordering::Relaxed);
        let key2_requests = keys[1].requests_sent.load(Ordering::Relaxed);
        assert_eq!(key1_requests, 2);
        assert_eq!(key2_requests, 2);
    }

    #[tokio::test]
    async fn test_key_recovery_after_exhaustion_timeout() {
        // Test key recovery with a very short cooldown (real time, not paused)
        let responses: Vec<_> = (0..5)
            .map(|_| {
                Err(OneInchError::RateLimited {
                    retry_after_ms: Some(1),
                })
            })
            .chain(std::iter::once(Ok(mock_quote())))
            .chain(std::iter::once(Ok(mock_quote())))
            .collect();

        let config = RateLimitConfig {
            base_delay: Duration::from_millis(1),
            max_retries_per_key: 5,
            exhaustion_cooldown: Duration::from_millis(50), // Very short cooldown for testing
            max_total_retries: 10,
            ..Default::default()
        };
        let handler = TestRateLimitHandler::new(MockQuoteProvider::with_responses(responses), Some(config));
        handler.add_key("key1".to_string()).await;
        handler.add_key("key2".to_string()).await;

        // First request exhausts key1, uses key2
        handler
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();

        // Verify key1 is exhausted
        {
            let keys = handler.keys.read().await;
            assert!(keys[0].is_exhausted(), "Key1 should be exhausted after 5 failures");
        }

        // Wait for cooldown to expire (real time)
        tokio::time::sleep(Duration::from_millis(60)).await;

        // key1 should be recovered now
        {
            let keys = handler.keys.read().await;
            assert!(!keys[0].is_exhausted(), "Key should recover after cooldown expires");
        }
    }

    // =========================================================================
    // Concurrent Access Tests (Issue #3 fix)
    // =========================================================================

    #[tokio::test]
    async fn test_concurrent_access_safety() {
        // Test that multiple concurrent requests don't cause issues
        let responses: Vec<_> = (0..50).map(|_| Ok(mock_quote())).collect();

        let handler = Arc::new(TestRateLimitHandler::new(
            MockQuoteProvider::with_responses(responses),
            None,
        ));
        handler.add_key("key1".to_string()).await;
        handler.add_key("key2".to_string()).await;

        let mut handles = Vec::new();

        // Spawn 50 concurrent tasks
        for _ in 0..50 {
            let h = handler.clone();
            handles.push(tokio::spawn(async move {
                h.get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
                    .await
            }));
        }

        // All tasks should complete without panic
        let mut success_count = 0;
        for handle in handles {
            let result = handle.await.expect("Task should not panic");
            if result.is_ok() {
                success_count += 1;
            }
        }

        // All requests should succeed
        assert_eq!(success_count, 50, "All 50 concurrent requests should succeed");

        // Both keys should have been used
        let keys = handler.keys.read().await;
        let total_requests: u64 = keys
            .iter()
            .map(|k| k.requests_sent.load(Ordering::Relaxed))
            .sum();
        assert_eq!(total_requests, 50, "Total requests should equal 50");
    }

    // =========================================================================
    // Real Handler Tests (integration-style)
    // =========================================================================

    #[tokio::test]
    async fn test_real_handler_creation() {
        // Test that the real handler can be created
        let handler = OneInchRateLimitHandler::new(None, None).unwrap();
        assert_eq!(handler.key_count().await, 0);
    }

    #[tokio::test]
    async fn test_real_handler_with_key() {
        // Test handler creation with initial key
        let handler = OneInchRateLimitHandler::with_key(
            "test-api-key".to_string(),
            None,
            None,
        ).unwrap();
        assert_eq!(handler.key_count().await, 1);
    }

    #[tokio::test]
    async fn test_real_handler_with_multiple_keys() {
        // Test handler creation with multiple keys
        let handler = OneInchRateLimitHandler::with_keys(
            vec!["key1".to_string(), "key2".to_string(), "key3".to_string()],
            None,
            None,
        ).unwrap();
        assert_eq!(handler.key_count().await, 3);
    }

    #[tokio::test]
    async fn test_real_handler_add_key() {
        let handler = OneInchRateLimitHandler::new(None, None).unwrap();
        assert_eq!(handler.key_count().await, 0);

        handler.add_key("key1".to_string()).await;
        assert_eq!(handler.key_count().await, 1);

        handler.add_key("key2".to_string()).await;
        assert_eq!(handler.key_count().await, 2);
    }

    #[tokio::test]
    async fn test_real_handler_get_healthy_key() {
        let handler = OneInchRateLimitHandler::with_keys(
            vec!["key1".to_string(), "key2".to_string()],
            None,
            None,
        ).unwrap();

        // Simulate key1 having more requests
        {
            let keys = handler.keys.read().await;
            keys[0].requests_sent.store(10, Ordering::Relaxed);
            keys[1].requests_sent.store(2, Ordering::Relaxed);
        }

        // Should select key2 (least loaded)
        let selected = handler.get_healthy_key().await.unwrap();
        assert_eq!(selected.requests_sent.load(Ordering::Relaxed), 2);
    }

    #[tokio::test]
    async fn test_real_handler_debug_output() {
        let handler = OneInchRateLimitHandler::with_key(
            "secret-key".to_string(),
            None,
            None,
        ).unwrap();

        let debug_str = format!("{:?}", handler);
        assert!(!debug_str.contains("secret-key"), "Debug output should not contain API key");
    }
}
