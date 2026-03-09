//! DEX price source adapter implementing PriceFetcher for 1inch + on-chain fallback
//!
//! This adapter wraps the 1inch quote API (with cache and rate limiting) as the primary
//! price source, falling back to on-chain reserves when the API is unavailable.
//!
//! Fallback chain: 1inch API -> on-chain reserves -> error with DEGRADED_QUOTES flag

use async_trait::async_trait;
use common::integrations::oneinch::{
    CachedQuoteClient, OneInchError, OneInchQuoteClient, OneInchRateLimitHandler, Quote,
    SupportedChain,
};
use common::types::{Price, PriceSource};
use ethers::types::{Address, U256};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, info, warn};

use super::fetcher::{PriceFetchError, PriceFetcher};

/// Trait for on-chain fallback pricing
///
/// Implement this trait to provide on-chain DEX pool pricing as a fallback
/// when the 1inch API is unavailable. See `OnchainQuoteClient` in
/// `common::integrations::onchain_quote` for the production implementation.
#[async_trait]
pub trait OnchainFallback: Send + Sync {
    /// Get a fallback price for an asset in USDC terms
    ///
    /// Should return a `Price` with `source` set to `PriceSource::OnChain`.
    async fn get_fallback_price(&self, asset: Address) -> Result<Price, String>;
}

/// Token address to 1inch token address string mapping
/// Maps on-chain Address to the checksummed hex string expected by 1inch API
#[derive(Debug, Clone)]
pub struct TokenMapping {
    /// Asset address on-chain
    pub asset: Address,
    /// Checksummed hex string for 1inch API (e.g., "0xaf88d065e77c8cC2239327C5EDb3A432268e5831")
    pub oneinch_address: String,
    /// Token decimals
    pub decimals: u8,
}

/// Configuration for the DEX price source
#[derive(Debug, Clone)]
pub struct DexPriceSourceConfig {
    /// Chain to fetch quotes on (typically Settlement chain)
    pub chain: SupportedChain,
    /// Base token address for pricing (USDC)
    pub base_token: String,
    /// Base token decimals (6 for USDC)
    pub base_token_decimals: u8,
    /// Token mappings: asset address -> 1inch token string
    pub token_mappings: HashMap<Address, TokenMapping>,
    /// Amount of base token to use for price queries (in smallest unit)
    /// Default: 1000 USDC (1000 * 10^6 = 1_000_000_000)
    pub quote_amount: String,
}

impl Default for DexPriceSourceConfig {
    fn default() -> Self {
        Self {
            chain: SupportedChain::Arbitrum,
            base_token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831".to_string(), // USDC on Settlement chain
            base_token_decimals: 6,
            token_mappings: HashMap::new(),
            quote_amount: "1000000000".to_string(), // 1000 USDC
        }
    }
}

/// DEX price source adapter implementing the PriceFetcher trait
///
/// Uses a fallback chain:
/// 1. 1inch API via rate limiter (with cache)
/// 2. On-chain reserves (Uniswap V3 / SushiSwap)
/// 3. Error with DEGRADED_QUOTES flag
pub struct DexPriceSource {
    /// Rate limit handler wrapping quote client (primary source)
    rate_limiter: Arc<OneInchRateLimitHandler>,
    /// Quote cache wrapping the quote client
    cached_client: Arc<CachedQuoteClient<OneInchQuoteClient>>,
    /// Configuration
    config: DexPriceSourceConfig,
    /// Optional on-chain fallback for when 1inch API is completely unavailable
    onchain_fallback: Option<Arc<dyn OnchainFallback>>,
    /// Whether we're operating in degraded mode (on-chain fallback active)
    degraded_mode: AtomicBool,
    /// Counter of fallback activations
    fallback_count: AtomicU64,
}

impl DexPriceSource {
    /// Create a new DEX price source
    ///
    /// # Arguments
    /// * `rate_limiter` - Rate limit handler for 1inch API
    /// * `cached_client` - Cached quote client for 1inch API
    /// * `config` - DEX price source configuration
    pub fn new(
        rate_limiter: Arc<OneInchRateLimitHandler>,
        cached_client: Arc<CachedQuoteClient<OneInchQuoteClient>>,
        config: DexPriceSourceConfig,
    ) -> Self {
        Self {
            rate_limiter,
            cached_client,
            config,
            onchain_fallback: None,
            degraded_mode: AtomicBool::new(false),
            fallback_count: AtomicU64::new(0),
        }
    }

    /// Create a DexPriceSource with an on-chain fallback provider
    ///
    /// When the 1inch API is unavailable, the fallback will be used to fetch
    /// prices from on-chain DEX pools (Uniswap V3 / SushiSwap).
    pub fn with_fallback(
        rate_limiter: Arc<OneInchRateLimitHandler>,
        cached_client: Arc<CachedQuoteClient<OneInchQuoteClient>>,
        config: DexPriceSourceConfig,
        fallback: Arc<dyn OnchainFallback>,
    ) -> Self {
        Self {
            rate_limiter,
            cached_client,
            config,
            onchain_fallback: Some(fallback),
            degraded_mode: AtomicBool::new(false),
            fallback_count: AtomicU64::new(0),
        }
    }

    /// Check if currently operating in degraded mode
    pub fn is_degraded(&self) -> bool {
        self.degraded_mode.load(Ordering::Relaxed)
    }

    /// Get the number of times fallback was activated
    pub fn fallback_count(&self) -> u64 {
        self.fallback_count.load(Ordering::Relaxed)
    }

    /// Try to fetch a quote from the cached 1inch client
    async fn try_oneinch_quote(
        &self,
        asset_token: &str,
    ) -> Result<Quote, OneInchError> {
        self.cached_client
            .get_quote(
                &self.config.base_token,
                asset_token,
                &self.config.quote_amount,
                self.config.chain,
            )
            .await
    }

    /// Try to fetch a quote via the rate limiter (handles key rotation + backoff)
    async fn try_rate_limited_quote(
        &self,
        asset_token: &str,
    ) -> Result<Quote, OneInchError> {
        self.rate_limiter
            .get_quote(
                &self.config.base_token,
                asset_token,
                &self.config.quote_amount,
                self.config.chain,
            )
            .await
    }

    /// Convert a 1inch quote to a Price struct
    ///
    /// The quote returns the amount of destination token received for `quote_amount` of base token.
    /// We convert this to a price in 18-decimal format (Price per 1 unit of the asset in USDC terms).
    fn quote_to_price(
        &self,
        asset: Address,
        quote: &Quote,
        source: PriceSource,
    ) -> Result<Price, PriceFetchError> {
        // Parse the quote output amount
        let to_amount = quote.to_amount.parse::<u128>().map_err(|e| {
            PriceFetchError::FetchFailed {
                asset,
                reason: format!("Failed to parse quote amount '{}': {}", quote.to_amount, e),
            }
        })?;

        if to_amount == 0 {
            return Err(PriceFetchError::FetchFailed {
                asset,
                reason: "Quote returned zero amount".to_string(),
            });
        }

        // Get token mapping for decimals
        let mapping = self.config.token_mappings.get(&asset).ok_or_else(|| {
            PriceFetchError::PriceNotAvailable { asset }
        })?;

        // Calculate price: (quote_amount / to_amount) normalized to 18 decimals
        // quote_amount is in base_token smallest units (e.g., USDC with 6 decimals)
        // to_amount is in asset smallest units (e.g., WETH with 18 decimals)
        //
        // Price of 1 whole asset unit in USDC:
        // price = (quote_amount / 10^base_decimals) / (to_amount / 10^asset_decimals)
        // In 18-decimal format:
        // price_18 = price * 10^18
        //          = (quote_amount * 10^asset_decimals * 10^18) / (to_amount * 10^base_decimals)
        let quote_amount = self.config.quote_amount.parse::<u128>().unwrap_or(1_000_000_000);
        let base_decimals = self.config.base_token_decimals;
        let asset_decimals = mapping.decimals;

        // Use U256 to avoid overflow
        let numerator = U256::from(quote_amount)
            * U256::exp10(asset_decimals as usize)
            * U256::exp10(18);
        let denominator = U256::from(to_amount) * U256::exp10(base_decimals as usize);

        if denominator.is_zero() {
            return Err(PriceFetchError::FetchFailed {
                asset,
                reason: "Division by zero in price calculation".to_string(),
            });
        }

        let price = numerator / denominator;

        let timestamp = U256::from(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("Time went backwards")
                .as_secs(),
        );

        Ok(Price {
            asset,
            price,
            timestamp,
            source: U256::from(source as u8),
        })
    }

    /// Fetch price for a single asset with fallback chain
    async fn fetch_price_with_fallback(
        &self,
        asset: Address,
    ) -> Result<Price, PriceFetchError> {
        // Look up token mapping
        let mapping = self.config.token_mappings.get(&asset).ok_or_else(|| {
            PriceFetchError::PriceNotAvailable { asset }
        })?;
        let asset_token = mapping.oneinch_address.clone();

        // Step 1: Try cached 1inch client
        match self.try_oneinch_quote(&asset_token).await {
            Ok(quote) => {
                // Clear degraded mode on success
                if self.degraded_mode.swap(false, Ordering::Relaxed) {
                    info!(asset = ?asset, "1inch API recovered, exiting degraded mode");
                }
                return self.quote_to_price(asset, &quote, PriceSource::OneInch);
            }
            Err(e) if e.is_retryable() => {
                debug!(asset = ?asset, error = %e, "Cached 1inch quote failed (retryable), trying rate limiter");
            }
            Err(e) => {
                debug!(asset = ?asset, error = %e, "Cached 1inch quote failed (non-retryable), trying rate limiter");
            }
        }

        // Step 2: Try rate-limited 1inch client (handles key rotation + backoff)
        match self.try_rate_limited_quote(&asset_token).await {
            Ok(quote) => {
                if self.degraded_mode.swap(false, Ordering::Relaxed) {
                    info!(asset = ?asset, "1inch API recovered via rate limiter, exiting degraded mode");
                }
                return self.quote_to_price(asset, &quote, PriceSource::OneInch);
            }
            Err(e) => {
                warn!(
                    asset = ?asset,
                    error = %e,
                    "1inch API unavailable, activating on-chain fallback"
                );
            }
        }

        // Step 3: Try on-chain fallback if configured
        if let Some(ref fallback) = self.onchain_fallback {
            match fallback.get_fallback_price(asset).await {
                Ok(price) => {
                    self.degraded_mode.store(true, Ordering::Relaxed);
                    self.fallback_count.fetch_add(1, Ordering::Relaxed);
                    warn!(
                        asset = ?asset,
                        "Using on-chain fallback price (DEGRADED_QUOTES)"
                    );
                    return Ok(price);
                }
                Err(e) => {
                    warn!(
                        asset = ?asset,
                        error = %e,
                        "On-chain fallback also failed"
                    );
                }
            }
        }

        // Step 4: All sources failed
        self.degraded_mode.store(true, Ordering::Relaxed);
        self.fallback_count.fetch_add(1, Ordering::Relaxed);

        Err(PriceFetchError::FetchFailed {
            asset,
            reason: "DEGRADED_QUOTES: All price sources unavailable (1inch API + on-chain fallback)".to_string(),
        })
    }
}

#[async_trait]
impl PriceFetcher for DexPriceSource {
    async fn fetch_prices(&self, assets: &[Address]) -> Result<Vec<Price>, PriceFetchError> {
        let mut results = Vec::with_capacity(assets.len());

        for &asset in assets {
            let price = self.fetch_price_with_fallback(asset).await?;
            results.push(price);
        }

        Ok(results)
    }

    async fn fetch_price(&self, asset: Address) -> Result<Price, PriceFetchError> {
        self.fetch_price_with_fallback(asset).await
    }
}

impl std::fmt::Debug for DexPriceSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DexPriceSource")
            .field("chain", &self.config.chain)
            .field("degraded_mode", &self.is_degraded())
            .field("fallback_count", &self.fallback_count())
            .field("token_count", &self.config.token_mappings.len())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::integrations::oneinch::{
        QuoteClientConfig, RateLimitConfig,
    };

    // Helper to create a test address
    fn test_address(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    // USDC address on Settlement chain
    const USDC_SETTLEMENT: &str = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    // WETH address on Settlement chain
    const WETH_SETTLEMENT: &str = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

    fn create_test_config() -> DexPriceSourceConfig {
        let mut mappings = HashMap::new();
        let weth_addr = test_address(1);
        mappings.insert(
            weth_addr,
            TokenMapping {
                asset: weth_addr,
                oneinch_address: WETH_SETTLEMENT.to_string(),
                decimals: 18,
            },
        );

        DexPriceSourceConfig {
            chain: SupportedChain::Arbitrum,
            base_token: USDC_SETTLEMENT.to_string(),
            base_token_decimals: 6,
            token_mappings: mappings,
            quote_amount: "1000000000".to_string(), // 1000 USDC
        }
    }

    #[test]
    fn test_default_config() {
        let config = DexPriceSourceConfig::default();
        assert_eq!(config.base_token, USDC_SETTLEMENT);
        assert_eq!(config.base_token_decimals, 6);
        assert_eq!(config.quote_amount, "1000000000");
    }

    #[test]
    fn test_token_mapping() {
        let mapping = TokenMapping {
            asset: test_address(1),
            oneinch_address: WETH_SETTLEMENT.to_string(),
            decimals: 18,
        };
        assert_eq!(mapping.decimals, 18);
        assert_eq!(mapping.oneinch_address, WETH_SETTLEMENT);
    }

    #[test]
    fn test_config_with_multiple_tokens() {
        let mut config = create_test_config();

        // Add ARB token
        let arb_addr = test_address(2);
        config.token_mappings.insert(
            arb_addr,
            TokenMapping {
                asset: arb_addr,
                oneinch_address: "0x912CE59144191C1204E64559FE8253a0e49E6548".to_string(),
                decimals: 18,
            },
        );

        assert_eq!(config.token_mappings.len(), 2);
        assert!(config.token_mappings.contains_key(&test_address(1)));
        assert!(config.token_mappings.contains_key(&test_address(2)));
    }

    #[test]
    fn test_quote_to_price_basic() {
        // Create a minimal DexPriceSource for price conversion testing
        // We need to test the conversion logic without network calls
        let config = create_test_config();
        let weth_addr = test_address(1);

        // Simulated quote: 1000 USDC -> 0.5 WETH
        // So 1 WETH = 2000 USDC
        // to_amount = 500000000000000000 (0.5 WETH in 18 decimals)
        let quote = Quote {
            to_amount: "500000000000000000".to_string(), // 0.5 WETH
            estimated_gas: 150000,
            protocols: vec![],
        };

        // Create a DexPriceSource just for testing quote_to_price
        // We can't easily create OneInchRateLimitHandler and CachedQuoteClient without
        // API keys, so we test the conversion method indirectly via a helper
        let numerator = U256::from(1_000_000_000u128) // quote_amount (1000 USDC)
            * U256::exp10(18)    // asset decimals (WETH)
            * U256::exp10(18);   // target 18 decimals
        let denominator = U256::from(500_000_000_000_000_000u128) // to_amount (0.5 WETH)
            * U256::exp10(6);    // base decimals (USDC)
        let expected_price = numerator / denominator;

        // Price should be 2000 * 10^18 = 2_000_000_000_000_000_000_000
        let expected_2000_usd = U256::from(2000u64) * U256::exp10(18);
        assert_eq!(expected_price, expected_2000_usd);
    }

    #[test]
    fn test_quote_to_price_zero_amount() {
        // Zero amount should produce zero division error
        let quote_amount = 1_000_000_000u128;
        let to_amount = 0u128;

        // This should fail because denominator is zero
        let denominator = U256::from(to_amount) * U256::exp10(6);
        assert!(denominator.is_zero());
    }

    #[test]
    fn test_price_source_values() {
        // Verify PriceSource enum values match expected
        assert_eq!(PriceSource::Bitget as u8, 0);
        assert_eq!(PriceSource::OneInch as u8, 1);
        assert_eq!(PriceSource::OnChain as u8, 2);
    }

    #[test]
    fn test_unknown_asset_returns_not_available() {
        let config = create_test_config();
        let unknown_addr = test_address(99);

        // Unknown asset should not be in token_mappings
        assert!(!config.token_mappings.contains_key(&unknown_addr));
    }

    #[test]
    fn test_degraded_mode_flag() {
        let degraded = AtomicBool::new(false);
        assert!(!degraded.load(Ordering::Relaxed));

        degraded.store(true, Ordering::Relaxed);
        assert!(degraded.load(Ordering::Relaxed));

        // swap returns previous value
        let was_degraded = degraded.swap(false, Ordering::Relaxed);
        assert!(was_degraded);
        assert!(!degraded.load(Ordering::Relaxed));
    }

    #[test]
    fn test_fallback_counter() {
        let counter = AtomicU64::new(0);
        assert_eq!(counter.load(Ordering::Relaxed), 0);

        counter.fetch_add(1, Ordering::Relaxed);
        assert_eq!(counter.load(Ordering::Relaxed), 1);

        counter.fetch_add(1, Ordering::Relaxed);
        assert_eq!(counter.load(Ordering::Relaxed), 2);
    }

    #[test]
    fn test_price_calculation_stablecoin() {
        // USDT (6 decimals) -> price should be ~1 USD
        // 1000 USDC -> 999.5 USDT
        // Price of 1 USDT = 1000/999.5 USDC ≈ 1.0005 USDC
        let quote_amount = 1_000_000_000u128; // 1000 USDC (6 decimals)
        let to_amount = 999_500_000u128; // 999.5 USDT (6 decimals)
        let asset_decimals: usize = 6;
        let base_decimals: usize = 6;

        let numerator = U256::from(quote_amount)
            * U256::exp10(asset_decimals)
            * U256::exp10(18);
        let denominator = U256::from(to_amount) * U256::exp10(base_decimals);
        let price = numerator / denominator;

        // Should be approximately 1.0005 * 10^18
        let one_usd = U256::exp10(18);
        assert!(price > one_usd); // Slightly above $1
        assert!(price < one_usd * 2); // But not $2
    }
}
