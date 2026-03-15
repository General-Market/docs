//! 1inch Quote Cache for reducing API calls
//!
//! Provides a TTL-based caching layer for 1inch quote API calls.
//! Multiple orders in the same oracle cycle (1 second) reuse cached quotes,
//! reducing API calls by 60-80%.
//!
//! # Architecture
//!
//! From architecture.md Section 14 (1inch API Rate Limit Strategy):
//! - Quote caching is Strategy 3 of 4 for handling 1inch rate limits
//! - Cache TTL: 5 seconds (configurable)
//! - DEX pairs (1inch): 30-second staleness limit (NFR5)
//! - Cache TTL of 5 seconds is well within the 30-second staleness window

use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;
use tracing::{debug, trace};

use super::error::OneInchError;
use super::types::{Quote, SupportedChain};

/// Default cache TTL in seconds
pub const DEFAULT_TTL_SECS: u64 = 5;

/// Configuration for the quote cache
#[derive(Debug, Clone)]
pub struct QuoteCacheConfig {
    /// Time-to-live for cached quotes in seconds
    pub ttl_secs: u64,
}

impl Default for QuoteCacheConfig {
    fn default() -> Self {
        Self {
            ttl_secs: DEFAULT_TTL_SECS,
        }
    }
}

impl QuoteCacheConfig {
    /// Create a new config with custom TTL
    pub fn new(ttl_secs: u64) -> Self {
        Self { ttl_secs }
    }
}

/// Cache entry storing a quote with its insertion time
#[derive(Debug, Clone)]
struct CacheEntry {
    /// The cached quote
    quote: Quote,
    /// When this entry was inserted (for TTL calculation)
    inserted_at: Instant,
}

/// Snapshot of cache metrics
#[derive(Debug, Clone, Default)]
pub struct QuoteCacheSnapshot {
    /// Number of cache hits
    pub hits: u64,
    /// Number of cache misses
    pub misses: u64,
    /// Number of expired entries evicted
    pub evictions: u64,
}

/// Metrics for quote cache operations
///
/// Fields are private to prevent external mutation. Use [`QuoteCacheMetrics::snapshot()`]
/// to read current values, or [`CachedQuoteClient::metrics()`] for the public API.
#[derive(Debug, Default)]
pub struct QuoteCacheMetrics {
    hits: AtomicU64,
    misses: AtomicU64,
    evictions: AtomicU64,
}

impl QuoteCacheMetrics {
    /// Get a snapshot of current metrics
    pub fn snapshot(&self) -> QuoteCacheSnapshot {
        QuoteCacheSnapshot {
            hits: self.hits.load(Ordering::Relaxed),
            misses: self.misses.load(Ordering::Relaxed),
            evictions: self.evictions.load(Ordering::Relaxed),
        }
    }

    /// Record a cache hit
    fn record_hit(&self) {
        self.hits.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a cache miss
    fn record_miss(&self) {
        self.misses.fetch_add(1, Ordering::Relaxed);
    }

    /// Record evictions
    fn record_evictions(&self, count: u64) {
        self.evictions.fetch_add(count, Ordering::Relaxed);
    }
}

/// Trait for quote providers, enabling clean testing and extensibility
///
/// Both `OneInchQuoteClient` and mock implementations can implement this trait,
/// allowing `CachedQuoteClient` to be generic over the inner provider.
#[async_trait]
pub trait QuoteProvider: Send + Sync {
    /// Fetch a quote for a token swap
    ///
    /// # Arguments
    /// * `from_token` - Source token address
    /// * `to_token` - Destination token address
    /// * `amount` - Amount in smallest unit (wei)
    /// * `chain` - Chain to execute on
    async fn get_quote(
        &self,
        from_token: &str,
        to_token: &str,
        amount: &str,
        chain: SupportedChain,
    ) -> Result<Quote, OneInchError>;
}

/// Cached quote client that wraps a QuoteProvider with TTL-based caching
///
/// Uses `DashMap` for lock-free concurrent access, matching the established
/// pattern in `common/src/integrations/onchain_quote/client.rs`.
///
/// # Cache Key Format
///
/// Cache keys are formatted as: `"{chain_id}:{from_token}:{to_token}:{amount}"`
/// where token addresses are lowercased for case-insensitive matching.
///
/// # Example
///
/// ```ignore
/// let inner_client = OneInchQuoteClient::new("api-key", None)?;
/// let cached_client = CachedQuoteClient::new(inner_client, None);
///
/// // First call: cache miss, fetches from API
/// let quote1 = cached_client.get_quote("0x...", "0x...", "1000", SupportedChain::Arbitrum).await?;
///
/// // Second call within 5 seconds: cache hit, returns cached quote
/// let quote2 = cached_client.get_quote("0x...", "0x...", "1000", SupportedChain::Arbitrum).await?;
/// ```
pub struct CachedQuoteClient<T: QuoteProvider> {
    /// The underlying quote provider
    inner: T,
    /// Cache configuration
    config: QuoteCacheConfig,
    /// Cached quotes: key -> (quote, inserted_at)
    cache: DashMap<String, CacheEntry>,
    /// Cache metrics
    metrics: QuoteCacheMetrics,
}

impl<T: QuoteProvider> CachedQuoteClient<T> {
    /// Create a new cached quote client wrapping the given provider
    ///
    /// # Arguments
    /// * `inner` - The underlying quote provider to wrap
    /// * `config` - Optional configuration (uses defaults if None)
    pub fn new(inner: T, config: Option<QuoteCacheConfig>) -> Self {
        Self {
            inner,
            config: config.unwrap_or_default(),
            cache: DashMap::new(),
            metrics: QuoteCacheMetrics::default(),
        }
    }

    /// Get a quote, using cache when available
    ///
    /// This is the main entry point. It checks the cache first and only
    /// calls the inner provider on cache miss or expiry.
    ///
    /// # Note on concurrent expiry
    ///
    /// There is a known TOCTOU gap: the DashMap read lock is released before
    /// the async provider call, so multiple concurrent callers may all observe
    /// the same expired entry and issue redundant fetches. This is functionally
    /// safe (same params yield identical results, and DashMap insert is atomic),
    /// but may produce duplicate API calls at TTL boundaries under high
    /// concurrency. A single-flight pattern would eliminate this but adds
    /// complexity not warranted at current load levels.
    ///
    /// # Arguments
    /// * `from_token` - Source token address
    /// * `to_token` - Destination token address
    /// * `amount` - Amount in smallest unit (wei)
    /// * `chain` - Chain to execute on
    pub async fn get_quote(
        &self,
        from_token: &str,
        to_token: &str,
        amount: &str,
        chain: SupportedChain,
    ) -> Result<Quote, OneInchError> {
        let cache_key = self.cache_key(from_token, to_token, amount, chain);
        let ttl = std::time::Duration::from_secs(self.config.ttl_secs);

        // Check cache
        if let Some(entry) = self.cache.get(&cache_key) {
            if entry.inserted_at.elapsed() < ttl {
                // Cache hit
                self.metrics.record_hit();
                trace!(cache_key = %cache_key, "Cache hit");
                return Ok(entry.quote.clone());
            }
            // Entry expired, will be replaced below
            debug!(cache_key = %cache_key, "Cache entry expired");
        }

        // Cache miss - fetch from inner provider
        self.metrics.record_miss();
        trace!(cache_key = %cache_key, "Cache miss, fetching from provider");

        let quote = self.inner.get_quote(from_token, to_token, amount, chain).await?;

        // Insert into cache
        self.cache.insert(
            cache_key,
            CacheEntry {
                quote: quote.clone(),
                inserted_at: Instant::now(),
            },
        );

        Ok(quote)
    }

    /// Get a quote using a QuoteRequest struct
    ///
    /// Convenience method that wraps `get_quote` with a structured request.
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

    /// Clear all cache entries
    ///
    /// Note: This does not increment the evictions metric. The evictions
    /// counter tracks only TTL-driven evictions via `evict_expired()`.
    pub fn clear_cache(&self) {
        let count = self.cache.len();
        self.cache.clear();
        if count > 0 {
            debug!(count, "Cleared all cache entries");
        }
    }

    /// Get current cache size (number of entries)
    pub fn cache_size(&self) -> usize {
        self.cache.len()
    }

    /// Remove entries older than TTL, returning count evicted
    pub fn evict_expired(&self) -> usize {
        let ttl = std::time::Duration::from_secs(self.config.ttl_secs);
        let mut evicted = 0usize;

        self.cache.retain(|_key, entry| {
            if entry.inserted_at.elapsed() >= ttl {
                evicted += 1;
                false
            } else {
                true
            }
        });

        if evicted > 0 {
            self.metrics.record_evictions(evicted as u64);
            debug!(evicted, "Evicted expired cache entries");
        }

        evicted
    }

    /// Get a snapshot of current cache metrics
    pub fn metrics(&self) -> QuoteCacheSnapshot {
        self.metrics.snapshot()
    }

    /// Get the cache hit rate (0.0 to 1.0)
    ///
    /// Returns 0.0 if no requests have been made.
    pub fn hit_rate(&self) -> f64 {
        let hits = self.metrics.hits.load(Ordering::Relaxed);
        let misses = self.metrics.misses.load(Ordering::Relaxed);
        let total = hits + misses;

        if total == 0 {
            0.0
        } else {
            hits as f64 / total as f64
        }
    }

    /// Get the inner provider (for accessing underlying client methods)
    pub fn inner(&self) -> &T {
        &self.inner
    }

    /// Build cache key from parameters
    ///
    /// Format: `"{chain_id}:{from_token}:{to_token}:{amount}"`
    /// Token addresses are lowercased for case-insensitive matching.
    fn cache_key(
        &self,
        from_token: &str,
        to_token: &str,
        amount: &str,
        chain: SupportedChain,
    ) -> String {
        format!(
            "{}:{}:{}:{}",
            chain.chain_id(),
            from_token.to_lowercase(),
            to_token.to_lowercase(),
            amount
        )
    }
}

impl<T: QuoteProvider + std::fmt::Debug> std::fmt::Debug for CachedQuoteClient<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CachedQuoteClient")
            .field("inner", &self.inner)
            .field("config", &self.config)
            .field("cache_size", &self.cache.len())
            .field("metrics", &self.metrics.snapshot())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use std::sync::Arc;
    use std::sync::Mutex as StdMutex;

    /// Mock quote provider for testing
    struct MockQuoteProvider {
        /// Count of calls made to get_quote
        call_count: AtomicUsize,
        /// Queue of quotes to return (or errors) - use std::sync::Mutex for sync initialization
        responses: StdMutex<Vec<Result<Quote, OneInchError>>>,
    }

    impl MockQuoteProvider {
        fn new() -> Self {
            Self {
                call_count: AtomicUsize::new(0),
                responses: StdMutex::new(Vec::new()),
            }
        }

        fn with_quote(quote: Quote) -> Self {
            // Pre-populate with many copies of the same quote
            let mut responses = Vec::new();
            for _ in 0..100 {
                responses.push(Ok(quote.clone()));
            }
            Self {
                call_count: AtomicUsize::new(0),
                responses: StdMutex::new(responses),
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
    }

    #[async_trait]
    impl QuoteProvider for MockQuoteProvider {
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

    fn mock_quote() -> Quote {
        Quote {
            to_amount: "999500000000000000".to_string(),
            estimated_gas: 150000,
            protocols: vec![],
        }
    }

    fn mock_quote_2() -> Quote {
        Quote {
            to_amount: "888000000000000000".to_string(),
            estimated_gas: 200000,
            protocols: vec![],
        }
    }

    const USDC_ARBITRUM: &str = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const WETH_ARBITRUM: &str = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

    // =========================================================================
    // Task 6: Unit tests for cache behavior
    // =========================================================================

    #[tokio::test]
    async fn test_cache_hit_within_ttl() {
        // AC #2: Given a quote was fetched less than 5 seconds ago for the same parameters
        // When get_quote() is called with the same parameters
        // Then the cached quote is returned without making an API call

        let provider = MockQuoteProvider::with_quote(mock_quote());
        let client = CachedQuoteClient::new(provider, None);

        // First call: cache miss, fetches from provider
        let quote1 = client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 1);

        // Second call: cache hit, returns cached quote
        let quote2 = client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 1); // Still 1 - no new API call

        // Quotes should be identical
        assert_eq!(quote1.to_amount, quote2.to_amount);
        assert_eq!(quote1.estimated_gas, quote2.estimated_gas);

        // Metrics check
        let metrics = client.metrics();
        assert_eq!(metrics.hits, 1);
        assert_eq!(metrics.misses, 1);
    }

    #[tokio::test]
    async fn test_cache_miss_after_ttl_expiry() {
        // AC #3: Given a cached quote is older than 5 seconds
        // When get_quote() is called
        // Then a fresh quote is fetched from 1inch API and the cache is updated

        // Use very short TTL for testing
        let config = QuoteCacheConfig::new(0); // 0 second TTL = immediate expiry
        let responses = vec![Ok(mock_quote()), Ok(mock_quote_2())];
        let provider = MockQuoteProvider::with_responses(responses);
        let client = CachedQuoteClient::new(provider, Some(config));

        // First call
        let quote1 = client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 1);

        // Wait a tiny bit to ensure TTL expires (TTL is 0)
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        // Second call: cache miss due to expiry
        let quote2 = client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 2); // New API call made

        // Quotes should be different (second response)
        assert_ne!(quote1.to_amount, quote2.to_amount);
    }

    #[tokio::test]
    async fn test_cache_miss_on_different_params() {
        // AC #2/3: Different parameters = different cache key = new fetch

        let provider = MockQuoteProvider::with_quote(mock_quote());
        let client = CachedQuoteClient::new(provider, None);

        // First call with amount 1000000
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 1);

        // Second call with different amount
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "2000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 2); // New API call for different amount

        // Third call with different tokens
        client
            .get_quote(WETH_ARBITRUM, USDC_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 3); // New API call for different pair

        // Fourth call with different chain
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Ethereum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 4); // New API call for different chain
    }

    #[tokio::test]
    async fn test_concurrent_access_safety() {
        // AC #4: Given cache operations occurring from multiple async tasks concurrently
        // When concurrent reads and writes happen
        // Then the cache is thread-safe with no data races or panics

        let provider = Arc::new(MockQuoteProvider::with_quote(mock_quote()));
        let client = Arc::new(CachedQuoteClient::new(
            MockQuoteProviderWrapper(provider.clone()),
            None,
        ));

        let mut handles = Vec::new();

        // Spawn 50 concurrent tasks
        for i in 0..50 {
            let client = client.clone();
            let amount = format!("{}", 1000000 + (i % 5)); // 5 unique amounts

            handles.push(tokio::spawn(async move {
                client
                    .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, &amount, SupportedChain::Arbitrum)
                    .await
            }));
        }

        // All tasks should complete without panic
        for handle in handles {
            let result = handle.await.expect("Task should not panic");
            assert!(result.is_ok());
        }

        // Cache should have entries
        assert!(client.cache_size() > 0);
    }

    /// Wrapper to make Arc<MockQuoteProvider> implement QuoteProvider
    struct MockQuoteProviderWrapper(Arc<MockQuoteProvider>);

    #[async_trait]
    impl QuoteProvider for MockQuoteProviderWrapper {
        async fn get_quote(
            &self,
            from_token: &str,
            to_token: &str,
            amount: &str,
            chain: SupportedChain,
        ) -> Result<Quote, OneInchError> {
            self.0.get_quote(from_token, to_token, amount, chain).await
        }
    }

    #[tokio::test]
    async fn test_clear_cache() {
        let provider = MockQuoteProvider::with_quote(mock_quote());
        let client = CachedQuoteClient::new(provider, None);

        // Add entries
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.cache_size(), 1);

        // Clear cache
        client.clear_cache();
        assert_eq!(client.cache_size(), 0);

        // New call should miss cache
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 2);
    }

    #[tokio::test]
    async fn test_evict_expired() {
        // Use very short TTL
        let config = QuoteCacheConfig::new(0); // Immediate expiry
        let provider = MockQuoteProvider::with_quote(mock_quote());
        let client = CachedQuoteClient::new(provider, Some(config));

        // Add entries
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "2000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.cache_size(), 2);

        // Wait for expiry
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        // Evict expired
        let evicted = client.evict_expired();
        assert_eq!(evicted, 2);
        assert_eq!(client.cache_size(), 0);

        // Check metrics
        let metrics = client.metrics();
        assert_eq!(metrics.evictions, 2);
    }

    #[tokio::test]
    async fn test_metrics_accuracy() {
        // AC #5: Given cache metrics are exposed
        // When monitoring the cache
        // Then hits, misses, and evictions counters are available

        let provider = MockQuoteProvider::with_quote(mock_quote());
        let client = CachedQuoteClient::new(provider, None);

        // Initial state
        let metrics = client.metrics();
        assert_eq!(metrics.hits, 0);
        assert_eq!(metrics.misses, 0);
        assert_eq!(metrics.evictions, 0);

        // First call: miss
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();

        let metrics = client.metrics();
        assert_eq!(metrics.hits, 0);
        assert_eq!(metrics.misses, 1);

        // Second call: hit
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();

        let metrics = client.metrics();
        assert_eq!(metrics.hits, 1);
        assert_eq!(metrics.misses, 1);

        // Clear cache does NOT increment evictions (only TTL-driven eviction does)
        client.clear_cache();

        let metrics = client.metrics();
        assert_eq!(metrics.evictions, 0);
    }

    #[test]
    fn test_hit_rate_calculation() {
        let provider = MockQuoteProvider::new();
        let client = CachedQuoteClient::new(provider, None);

        // No requests: 0.0
        assert_eq!(client.hit_rate(), 0.0);

        // Simulate metrics
        client.metrics.misses.store(3, Ordering::SeqCst);
        client.metrics.hits.store(7, Ordering::SeqCst);

        // 7 / (7 + 3) = 0.7
        assert!((client.hit_rate() - 0.7).abs() < 0.001);
    }

    #[tokio::test]
    async fn test_configurable_ttl() {
        // Test non-default TTL value

        // 1 second TTL
        let config = QuoteCacheConfig::new(1);
        let responses = vec![Ok(mock_quote()), Ok(mock_quote_2())];
        let provider = MockQuoteProvider::with_responses(responses);
        let client = CachedQuoteClient::new(provider, Some(config));

        // First call
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();

        // Immediate second call: should hit cache
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 1);

        // Wait for TTL to expire
        tokio::time::sleep(tokio::time::Duration::from_millis(1100)).await;

        // Third call: should miss cache
        client
            .get_quote(USDC_ARBITRUM, WETH_ARBITRUM, "1000000", SupportedChain::Arbitrum)
            .await
            .unwrap();
        assert_eq!(client.inner().call_count(), 2);
    }

    #[test]
    fn test_cache_key_format() {
        let provider = MockQuoteProvider::new();
        let client = CachedQuoteClient::new(provider, None);

        let key = client.cache_key(
            "0xAF88D065E77C8CC2239327C5EDB3A432268E5831", // Mixed case
            "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // Lowercase
            "1000000",
            SupportedChain::Arbitrum,
        );

        // Should be lowercased and properly formatted
        assert_eq!(
            key,
            "42161:0xaf88d065e77c8cc2239327c5edb3a432268e5831:0x82af49447d8a07e3bd95bd0d56f35241523fbab1:1000000"
        );
    }

    #[test]
    fn test_cache_key_case_insensitive() {
        let provider = MockQuoteProvider::new();
        let client = CachedQuoteClient::new(provider, None);

        let key1 = client.cache_key(
            "0xAF88D065E77C8CC2239327C5EDB3A432268E5831",
            "0x82AF49447D8A07E3BD95BD0D56F35241523FBAB1",
            "1000000",
            SupportedChain::Arbitrum,
        );

        let key2 = client.cache_key(
            "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
            "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "1000000",
            SupportedChain::Arbitrum,
        );

        assert_eq!(key1, key2);
    }

    #[tokio::test]
    async fn test_get_quote_from_request() {
        use super::super::types::QuoteRequest;

        let provider = MockQuoteProvider::with_quote(mock_quote());
        let client = CachedQuoteClient::new(provider, None);

        let request = QuoteRequest {
            from_token: USDC_ARBITRUM.to_string(),
            to_token: WETH_ARBITRUM.to_string(),
            amount: "1000000".to_string(),
            chain: SupportedChain::Arbitrum,
        };

        let quote = client.get_quote_from_request(&request).await.unwrap();
        assert_eq!(quote.to_amount, "999500000000000000");
    }

    #[test]
    fn test_default_config() {
        let config = QuoteCacheConfig::default();
        assert_eq!(config.ttl_secs, DEFAULT_TTL_SECS);
        assert_eq!(config.ttl_secs, 5);
    }

    #[test]
    fn test_cache_snapshot_default() {
        let snapshot = QuoteCacheSnapshot::default();
        assert_eq!(snapshot.hits, 0);
        assert_eq!(snapshot.misses, 0);
        assert_eq!(snapshot.evictions, 0);
    }
}
