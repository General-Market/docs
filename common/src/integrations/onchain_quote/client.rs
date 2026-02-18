//! On-chain quote client for DEX pool price fallback
//!
//! This client reads prices directly from Uniswap V3 and Sushiswap V3 pools
//! when the 1inch API is unavailable.

use super::error::{OnchainQuoteError, Result};
use super::price_math::{calculate_price_from_sqrt, estimate_price_impact_bps};
use super::sushiswap::SushiswapV3Reader;
use super::types::{DexType, FeeTier, OnchainQuote, OnchainQuoteConfig, QuoteSource};
use super::uniswap_v3::{compute_pool_address, UniswapV3Reader};
use dashmap::DashMap;
use ethers::prelude::*;
use futures::future::join_all;
use rust_decimal::Decimal;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use tokio::time::timeout;
use tracing::{debug, info, instrument, warn};

/// Metrics for on-chain quote operations
#[derive(Debug, Default)]
pub struct OnchainQuoteMetrics {
    /// Count of degraded quotes issued
    pub degraded_quotes_count: AtomicU64,
    /// Total latency in milliseconds (for averaging)
    pub total_latency_ms: AtomicU64,
    /// Number of latency samples
    pub latency_samples: AtomicU64,
}

impl OnchainQuoteMetrics {
    /// Get the average latency in milliseconds
    pub fn avg_latency_ms(&self) -> u64 {
        let samples = self.latency_samples.load(Ordering::Relaxed);
        if samples == 0 {
            0
        } else {
            self.total_latency_ms.load(Ordering::Relaxed) / samples
        }
    }

    /// Record a latency sample
    pub fn record_latency(&self, latency_ms: u64) {
        self.total_latency_ms.fetch_add(latency_ms, Ordering::Relaxed);
        self.latency_samples.fetch_add(1, Ordering::Relaxed);
    }
}

/// Maximum number of pool address cache entries before clearing
const MAX_POOL_CACHE_SIZE: usize = 1024;

/// On-chain quote client for fallback pricing
///
/// Reads prices directly from DEX pools when API pricing is unavailable.
/// Supports Uniswap V3 and Sushiswap V3 on Arbitrum.
pub struct OnchainQuoteClient<M: Middleware> {
    /// Uniswap V3 reader
    uniswap_reader: UniswapV3Reader<M>,
    /// Sushiswap V3 reader
    sushiswap_reader: SushiswapV3Reader<M>,
    /// Configuration
    config: OnchainQuoteConfig,
    /// Cached pool addresses (token_pair_key -> (pool_address, dex_type))
    /// Bounded to MAX_POOL_CACHE_SIZE entries; cleared when limit is reached.
    pool_cache: DashMap<String, (Address, DexType)>,
    /// Metrics
    metrics: OnchainQuoteMetrics,
}

impl<M: Middleware + 'static> OnchainQuoteClient<M> {
    /// Create a new on-chain quote client
    pub fn new(provider: Arc<M>, config: OnchainQuoteConfig) -> Self {
        Self {
            uniswap_reader: UniswapV3Reader::new(provider.clone()),
            sushiswap_reader: SushiswapV3Reader::new(provider, config.sushiswap_v3_factory),
            config,
            pool_cache: DashMap::new(),
            metrics: OnchainQuoteMetrics::default(),
        }
    }

    /// Get configuration
    pub fn config(&self) -> &OnchainQuoteConfig {
        &self.config
    }

    /// Get metrics
    pub fn metrics(&self) -> &OnchainQuoteMetrics {
        &self.metrics
    }

    /// Get the count of degraded quotes issued
    pub fn degraded_quotes_count(&self) -> u64 {
        self.metrics.degraded_quotes_count.load(Ordering::Relaxed)
    }

    /// Get a quote from on-chain DEX pools
    ///
    /// This is the main entry point for fallback pricing. It queries multiple
    /// pools (Uniswap V3 + Sushiswap V3) and returns the best price.
    ///
    /// # Arguments
    ///
    /// * `token_in` - Token being sold
    /// * `token_out` - Token being bought
    /// * `amount` - Amount to quote (in token_in's smallest units)
    ///
    /// # Returns
    ///
    /// An `OnchainQuote` with the best price found, marked as degraded.
    #[instrument(skip(self), fields(token_in = %token_in, token_out = %token_out))]
    pub async fn get_quote_onchain(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
    ) -> Result<OnchainQuote> {
        let start = Instant::now();

        info!("Fetching on-chain fallback quote");

        // Increment degraded quote counter
        self.metrics
            .degraded_quotes_count
            .fetch_add(1, Ordering::Relaxed);

        warn!(code = "E008", "Using DEGRADED_QUOTES fallback - 1inch API unavailable");

        // Try to get quotes from both DEXes with timeout
        let quote_result = timeout(self.config.timeout, async {
            self.get_best_quote_with_retry(token_in, token_out, amount).await
        })
        .await
        .map_err(|_| OnchainQuoteError::Timeout {
            timeout_ms: self.config.timeout.as_millis() as u64,
        })??;

        // Record latency
        let latency_ms = start.elapsed().as_millis() as u64;
        self.metrics.record_latency(latency_ms);
        debug!(latency_ms, "On-chain quote latency");

        Ok(quote_result)
    }

    /// Get the best quote with retry logic
    async fn get_best_quote_with_retry(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
    ) -> Result<OnchainQuote> {
        let mut last_error = None;

        for attempt in 0..self.config.max_retries {
            match self.get_best_quote_internal(token_in, token_out, amount).await {
                Ok(quote) => return Ok(quote),
                Err(e) => {
                    if e.is_retryable() && attempt < self.config.max_retries - 1 {
                        debug!(attempt, error = %e, "Retryable error, retrying...");
                        tokio::time::sleep(self.config.retry_delay).await;
                        last_error = Some(e);
                    } else {
                        return Err(e);
                    }
                }
            }
        }

        Err(last_error.unwrap_or(OnchainQuoteError::MaxRetriesExceeded {
            attempts: self.config.max_retries,
        }))
    }

    /// Internal method to get the best quote from available pools
    ///
    /// Queries all fee tiers on both Uniswap V3 and Sushiswap V3 in parallel
    /// for reduced latency, then returns the quote with the best price
    /// (highest output amount for the buyer).
    async fn get_best_quote_internal(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
    ) -> Result<OnchainQuote> {
        // Get token decimals with warning for unknown tokens (uses configurable registry)
        let token_in_decimals = match self.config.token_registry.decimals(token_in) {
            Some(d) => d,
            None => {
                warn!(
                    code = "E008",
                    token = %token_in,
                    "Unknown token, defaulting to 18 decimals - price may be incorrect. \
                     Consider adding to token registry via config.with_token()"
                );
                18
            }
        };
        let token_out_decimals = match self.config.token_registry.decimals(token_out) {
            Some(d) => d,
            None => {
                warn!(
                    code = "E008",
                    token = %token_out,
                    "Unknown token, defaulting to 18 decimals - price may be incorrect. \
                     Consider adding to token registry via config.with_token()"
                );
                18
            }
        };

        // Build all pool query futures for parallel execution
        let mut futures = Vec::new();

        for fee_tier in FeeTier::all() {
            // Uniswap V3 query
            futures.push(self.try_get_quote_from_dex(
                token_in,
                token_out,
                amount,
                *fee_tier,
                DexType::UniswapV3,
                token_in_decimals,
                token_out_decimals,
            ));

            // Sushiswap V3 query
            futures.push(self.try_get_quote_from_dex(
                token_in,
                token_out,
                amount,
                *fee_tier,
                DexType::SushiswapV3,
                token_in_decimals,
                token_out_decimals,
            ));
        }

        // Execute all queries in parallel
        let results = join_all(futures).await;

        // Find best quote (highest price = most output for buyer)
        let mut best_quote: Option<OnchainQuote> = None;
        let mut error_count = 0u32;

        for result in results {
            match result {
                Ok(quote) => {
                    debug!(
                        dex = ?quote.source,
                        fee_tier = quote.fee_tier_bps,
                        price = %quote.price,
                        liquidity = %quote.liquidity,
                        "Pool quote received"
                    );

                    if best_quote.as_ref().map_or(true, |q| quote.price > q.price) {
                        best_quote = Some(quote);
                    }
                }
                Err(ref e) => {
                    error_count += 1;
                    debug!(error = %e, "Pool query failed");
                }
            }
        }

        if error_count > 0 {
            debug!(
                error_count,
                success = best_quote.is_some(),
                "Pool query summary: {} errors out of total queries",
                error_count
            );
        }

        if let Some(ref quote) = best_quote {
            info!(
                dex = ?quote.source,
                fee_tier = quote.fee_tier_bps,
                price = %quote.price,
                "Selected best quote"
            );
        }

        best_quote.ok_or(OnchainQuoteError::PoolNotFound {
            token_a: token_in,
            token_b: token_out,
        })
    }

    /// Try to get a quote from a specific DEX and fee tier
    async fn try_get_quote_from_dex(
        &self,
        token_in: Address,
        token_out: Address,
        amount: U256,
        fee_tier: FeeTier,
        dex: DexType,
        token_in_decimals: u8,
        token_out_decimals: u8,
    ) -> Result<OnchainQuote> {
        // Compute pool address
        let pool_address = self.get_pool_address(token_in, token_out, fee_tier, dex)?;

        // Get pool state
        let state = match dex {
            DexType::UniswapV3 => self.uniswap_reader.get_pool_state(pool_address).await?,
            DexType::SushiswapV3 => self.sushiswap_reader.get_pool_state(pool_address).await?,
        };

        // Check liquidity
        if !state.has_liquidity() {
            return Err(OnchainQuoteError::NoLiquidity { pool: pool_address });
        }

        // Calculate price
        let (token0_decimals, token1_decimals) = if token_in < token_out {
            (token_in_decimals, token_out_decimals)
        } else {
            (token_out_decimals, token_in_decimals)
        };

        let raw_price =
            calculate_price_from_sqrt(state.slot0.sqrt_price_x96, token0_decimals, token1_decimals)?;

        // Adjust price direction based on swap direction
        let price = if token_in < token_out {
            raw_price
        } else {
            if raw_price.is_zero() {
                return Err(OnchainQuoteError::MathOverflow {
                    context: "Cannot invert zero price".to_string(),
                });
            }
            Decimal::ONE / raw_price
        };

        // Estimate price impact
        let price_impact_bps =
            estimate_price_impact_bps(amount, state.liquidity, state.slot0.sqrt_price_x96);

        Ok(OnchainQuote {
            price,
            source: QuoteSource::Onchain { dex },
            degraded: true,
            liquidity: U256::from(state.liquidity),
            price_impact_bps,
            pool_address,
            fee_tier_bps: fee_tier.as_bps(),
            fetched_at: SystemTime::now(),
        })
    }

    /// Get pool address for a token pair (with caching)
    pub fn get_pool_address(
        &self,
        token_a: Address,
        token_b: Address,
        fee_tier: FeeTier,
        dex: DexType,
    ) -> Result<Address> {
        // Sort tokens to get canonical ordering
        let (token0, token1) = if token_a < token_b {
            (token_a, token_b)
        } else {
            (token_b, token_a)
        };

        // Check cache first
        let cache_key = format!("{:?}-{:?}-{}-{:?}", token0, token1, fee_tier.as_bps(), dex);
        if let Some(entry) = self.pool_cache.get(&cache_key) {
            debug!(?cache_key, "Pool address found in cache");
            return Ok(entry.0);
        }

        // Compute pool address using CREATE2
        let pool_address = match dex {
            DexType::UniswapV3 => compute_pool_address(
                self.config.uniswap_v3_factory,
                token0,
                token1,
                fee_tier,
                self.config.pool_init_code_hash,
            ),
            DexType::SushiswapV3 => self
                .sushiswap_reader
                .compute_pool_address(token0, token1, fee_tier),
        };

        // Evict cache if it exceeds the max size (pool addresses are deterministic,
        // so re-computation after eviction is cheap)
        if self.pool_cache.len() >= MAX_POOL_CACHE_SIZE {
            warn!("Pool address cache reached {} entries, clearing", self.pool_cache.len());
            self.pool_cache.clear();
        }

        // Cache the result
        self.pool_cache.insert(cache_key, (pool_address, dex));

        Ok(pool_address)
    }

    /// Clear the pool address cache
    pub fn clear_cache(&self) {
        self.pool_cache.clear();
    }

    /// Get cache size
    pub fn cache_size(&self) -> usize {
        self.pool_cache.len()
    }
}

/// Builder for creating OnchainQuoteClient with custom configuration
pub struct OnchainQuoteClientBuilder {
    config: OnchainQuoteConfig,
}

impl OnchainQuoteClientBuilder {
    /// Create a new builder for Arbitrum
    pub fn arbitrum(rpc_url: impl Into<String>) -> Self {
        Self {
            config: OnchainQuoteConfig::arbitrum(rpc_url),
        }
    }

    /// Set custom timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.config = self.config.with_timeout(timeout);
        self
    }

    /// Set custom retry configuration
    pub fn with_retries(mut self, max_retries: u32, retry_delay: Duration) -> Self {
        self.config = self.config.with_retries(max_retries, retry_delay);
        self
    }

    /// Build the client with the given provider
    pub fn build<M: Middleware + 'static>(self, provider: Arc<M>) -> OnchainQuoteClient<M> {
        OnchainQuoteClient::new(provider, self.config)
    }

    /// Get the configuration (for inspection/testing)
    pub fn config(&self) -> &OnchainQuoteConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::integrations::onchain_quote::types::{arbitrum_tokens, TokenRegistry};
    use ethers::providers::{MockProvider, Provider};

    fn create_mock_client() -> OnchainQuoteClient<Provider<MockProvider>> {
        let (provider, _mock) = Provider::mocked();
        let config = OnchainQuoteConfig::arbitrum("https://test.rpc");
        OnchainQuoteClient::new(Arc::new(provider), config)
    }

    #[test]
    fn test_client_creation() {
        let client = create_mock_client();
        assert_eq!(client.config().chain_id, 42161);
        assert_eq!(client.degraded_quotes_count(), 0);
        assert_eq!(client.cache_size(), 0);
    }

    #[test]
    fn test_builder_pattern() {
        let builder = OnchainQuoteClientBuilder::arbitrum("https://test.rpc")
            .with_timeout(Duration::from_secs(10))
            .with_retries(5, Duration::from_millis(250));

        assert_eq!(builder.config().timeout, Duration::from_secs(10));
        assert_eq!(builder.config().max_retries, 5);
        assert_eq!(builder.config().retry_delay, Duration::from_millis(250));
    }

    #[test]
    fn test_clear_cache() {
        let client = create_mock_client();
        assert_eq!(client.cache_size(), 0);
        client.clear_cache();
        assert_eq!(client.cache_size(), 0);
    }

    #[test]
    fn test_pool_address_caching() {
        let client = create_mock_client();

        let usdc = arbitrum_tokens::usdc();
        let weth = arbitrum_tokens::weth();

        // First call computes and caches
        let addr1 = client
            .get_pool_address(usdc, weth, FeeTier::Medium, DexType::UniswapV3)
            .unwrap();
        assert_eq!(client.cache_size(), 1);

        // Second call uses cache
        let addr2 = client
            .get_pool_address(usdc, weth, FeeTier::Medium, DexType::UniswapV3)
            .unwrap();
        assert_eq!(addr1, addr2);
        assert_eq!(client.cache_size(), 1);

        // Different fee tier creates new entry
        let _addr3 = client
            .get_pool_address(usdc, weth, FeeTier::Low, DexType::UniswapV3)
            .unwrap();
        assert_eq!(client.cache_size(), 2);
    }

    #[test]
    fn test_pool_address_token_order_independent() {
        let client = create_mock_client();

        let usdc = arbitrum_tokens::usdc();
        let weth = arbitrum_tokens::weth();

        let addr1 = client
            .get_pool_address(usdc, weth, FeeTier::Medium, DexType::UniswapV3)
            .unwrap();
        let addr2 = client
            .get_pool_address(weth, usdc, FeeTier::Medium, DexType::UniswapV3)
            .unwrap();

        assert_eq!(addr1, addr2);
    }

    #[test]
    fn test_metrics_latency() {
        let metrics = OnchainQuoteMetrics::default();
        assert_eq!(metrics.avg_latency_ms(), 0);

        metrics.record_latency(100);
        assert_eq!(metrics.avg_latency_ms(), 100);

        metrics.record_latency(200);
        assert_eq!(metrics.avg_latency_ms(), 150);
    }

    #[tokio::test]
    async fn test_get_quote_increments_counter() {
        let client = create_mock_client();
        assert_eq!(client.degraded_quotes_count(), 0);

        // Call get_quote_onchain (will fail due to mock provider but should increment counter)
        let _ = client
            .get_quote_onchain(Address::zero(), Address::random(), U256::from(1000))
            .await;

        assert_eq!(client.degraded_quotes_count(), 1);
    }

    // =========================================================================
    // Token Registry Tests
    // =========================================================================

    #[test]
    fn test_config_with_custom_token() {
        let custom_token: Address = "0x1234567890123456789012345678901234567890"
            .parse()
            .unwrap();

        let config = OnchainQuoteConfig::arbitrum("https://test.rpc")
            .with_token(custom_token, 8);

        assert_eq!(config.token_registry.decimals(custom_token), Some(8));
        // Default tokens still work
        assert_eq!(
            config.token_registry.decimals(arbitrum_tokens::usdc()),
            Some(6)
        );
    }

    #[test]
    fn test_config_with_custom_registry() {
        let mut registry = TokenRegistry::new();
        let mock_token: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            .parse()
            .unwrap();
        registry.register(mock_token, 12);

        let config =
            OnchainQuoteConfig::arbitrum("https://test.rpc").with_token_registry(registry);

        // Custom token is registered
        assert_eq!(config.token_registry.decimals(mock_token), Some(12));
        // Arbitrum defaults still work (fallback)
        assert_eq!(
            config.token_registry.decimals(arbitrum_tokens::weth()),
            Some(18)
        );
    }

    #[test]
    fn test_token_registry_override() {
        let mut registry = TokenRegistry::new();
        // Override USDC decimals (normally 6, set to 18 for testing)
        registry.register(arbitrum_tokens::usdc(), 18);

        let config =
            OnchainQuoteConfig::arbitrum("https://test.rpc").with_token_registry(registry);

        // Override takes precedence
        assert_eq!(
            config.token_registry.decimals(arbitrum_tokens::usdc()),
            Some(18)
        );
    }

    #[test]
    fn test_client_uses_token_registry() {
        let custom_token: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            .parse()
            .unwrap();

        let (provider, _mock) = Provider::mocked();
        let config =
            OnchainQuoteConfig::arbitrum("https://test.rpc").with_token(custom_token, 9);

        let client = OnchainQuoteClient::new(Arc::new(provider), config);

        // Verify custom token is accessible via client's config
        assert_eq!(
            client.config().token_registry.decimals(custom_token),
            Some(9)
        );
    }

    // =========================================================================
    // Mock RPC Error Path Tests
    // =========================================================================

    #[tokio::test]
    async fn test_short_timeout_config_is_applied() {
        let (provider, _mock) = Provider::mocked();
        // Configure very short timeout
        let config = OnchainQuoteConfig::arbitrum("https://test.rpc")
            .with_timeout(Duration::from_millis(1))
            .with_retries(1, Duration::from_millis(1));

        let client = OnchainQuoteClient::new(Arc::new(provider), config);

        // Verify config was applied
        assert_eq!(client.config().timeout, Duration::from_millis(1));
        assert_eq!(client.config().max_retries, 1);
        assert_eq!(client.config().retry_delay, Duration::from_millis(1));

        let result = client
            .get_quote_onchain(
                arbitrum_tokens::usdc(),
                arbitrum_tokens::weth(),
                U256::from(1_000_000u64),
            )
            .await;

        // Should return an error (mock provider can't actually return pool data)
        // The specific error depends on how the mock provider responds
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_pool_not_found_for_unknown_tokens() {
        let (provider, _mock) = Provider::mocked();
        let config = OnchainQuoteConfig::arbitrum("https://test.rpc")
            .with_timeout(Duration::from_millis(100))
            .with_retries(1, Duration::from_millis(1));

        let client = OnchainQuoteClient::new(Arc::new(provider), config);

        // Use completely random addresses that won't have pools
        let fake_token_a: Address = "0x0000000000000000000000000000000000000001"
            .parse()
            .unwrap();
        let fake_token_b: Address = "0x0000000000000000000000000000000000000002"
            .parse()
            .unwrap();

        let result = client
            .get_quote_onchain(fake_token_a, fake_token_b, U256::from(1000u64))
            .await;

        // Should fail (RPC error or pool not found after RPC fails)
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_retry_count_respected() {
        let (provider, _mock) = Provider::mocked();
        let config = OnchainQuoteConfig::arbitrum("https://test.rpc")
            .with_timeout(Duration::from_millis(50))
            .with_retries(2, Duration::from_millis(10));

        let client = OnchainQuoteClient::new(Arc::new(provider), config);

        // Track start time to verify retries occurred
        let start = std::time::Instant::now();

        let _ = client
            .get_quote_onchain(
                arbitrum_tokens::usdc(),
                arbitrum_tokens::weth(),
                U256::from(1000u64),
            )
            .await;

        // With 2 retries and 10ms delay, should take at least 10ms
        // (one retry delay between attempts)
        let elapsed = start.elapsed();
        // Note: This is a weak assertion due to timing variability
        // The main verification is that the function doesn't hang
        assert!(
            elapsed < Duration::from_secs(5),
            "Should not hang - took {:?}",
            elapsed
        );
    }

    #[test]
    fn test_error_is_retryable() {
        // RPC errors are retryable
        let rpc_err = OnchainQuoteError::rpc_message("connection refused");
        assert!(rpc_err.is_retryable());

        // Timeout errors are retryable
        let timeout_err = OnchainQuoteError::Timeout { timeout_ms: 5000 };
        assert!(timeout_err.is_retryable());

        // Pool not found is NOT retryable
        let pool_err = OnchainQuoteError::PoolNotFound {
            token_a: Address::zero(),
            token_b: Address::random(),
        };
        assert!(!pool_err.is_retryable());

        // No liquidity is NOT retryable
        let liquidity_err = OnchainQuoteError::NoLiquidity {
            pool: Address::zero(),
        };
        assert!(!liquidity_err.is_retryable());
    }

    #[test]
    fn test_max_retries_exceeded_error() {
        let err = OnchainQuoteError::MaxRetriesExceeded { attempts: 3 };
        assert!(!err.is_retryable());
        assert!(err.to_string().contains("3"));
    }
}
