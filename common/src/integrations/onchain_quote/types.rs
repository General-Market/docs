//! Types for on-chain quote fallback

use ethers::types::{Address, U256};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// DEX source for on-chain quotes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DexType {
    /// Uniswap V3
    UniswapV3,
    /// Sushiswap V3
    SushiswapV3,
}

impl DexType {
    /// Get the human-readable name
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::UniswapV3 => "Uniswap V3",
            Self::SushiswapV3 => "Sushiswap V3",
        }
    }
}

impl std::fmt::Display for DexType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Quote source indicating where the price came from
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuoteSource {
    /// Quote from external API (e.g., 1inch)
    Api {
        /// API name
        name: String,
    },
    /// Quote from on-chain DEX pool read
    Onchain {
        /// DEX type
        dex: DexType,
    },
    /// Cached quote
    Cached {
        /// Original source
        original_source: Box<QuoteSource>,
        /// Age in seconds
        age_secs: u64,
    },
}

impl QuoteSource {
    /// Check if this is an on-chain (degraded) source
    pub fn is_onchain(&self) -> bool {
        matches!(self, Self::Onchain { .. })
    }

    /// Check if this is an API source
    pub fn is_api(&self) -> bool {
        matches!(self, Self::Api { .. })
    }
}

/// Quote status for tracking degradation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuoteStatus {
    /// Fresh quote from API
    Fresh,
    /// Cached quote (may be slightly stale)
    Cached,
    /// Degraded fallback quote (on-chain)
    Degraded,
}

impl QuoteStatus {
    /// Check if this is a degraded status
    pub fn is_degraded(&self) -> bool {
        matches!(self, Self::Degraded)
    }
}

/// On-chain quote result
#[derive(Debug, Clone)]
pub struct OnchainQuote {
    /// Calculated price (token1 per token0)
    pub price: Decimal,
    /// Source of the quote
    pub source: QuoteSource,
    /// Whether this is a degraded fallback quote
    pub degraded: bool,
    /// Pool liquidity (in base units)
    pub liquidity: U256,
    /// Estimated price impact in basis points
    pub price_impact_bps: u16,
    /// Pool address the quote came from
    pub pool_address: Address,
    /// Fee tier in basis points (e.g., 30 = 0.3%)
    pub fee_tier_bps: u32,
    /// Timestamp when the quote was fetched
    pub fetched_at: std::time::SystemTime,
}

impl OnchainQuote {
    /// Check if this quote is degraded
    pub fn is_degraded(&self) -> bool {
        self.degraded
    }

    /// Get the quote status
    pub fn status(&self) -> QuoteStatus {
        if self.degraded {
            QuoteStatus::Degraded
        } else {
            QuoteStatus::Fresh
        }
    }

    /// Get the age of this quote
    pub fn age(&self) -> Duration {
        self.fetched_at
            .elapsed()
            .unwrap_or(Duration::ZERO)
    }
}

/// Uniswap V3 fee tiers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FeeTier {
    /// 0.01% (1 bps) - Stablecoin pairs
    Lowest = 100,
    /// 0.05% (5 bps) - Stablecoin-like pairs
    Low = 500,
    /// 0.30% (30 bps) - Most pairs
    Medium = 3000,
    /// 1.00% (100 bps) - Exotic pairs
    High = 10000,
}

impl FeeTier {
    /// Get all fee tiers
    pub fn all() -> &'static [FeeTier] {
        &[
            FeeTier::Lowest,
            FeeTier::Low,
            FeeTier::Medium,
            FeeTier::High,
        ]
    }

    /// Get fee tier from basis points
    pub fn from_bps(bps: u32) -> Option<Self> {
        match bps {
            100 => Some(Self::Lowest),
            500 => Some(Self::Low),
            3000 => Some(Self::Medium),
            10000 => Some(Self::High),
            _ => None,
        }
    }

    /// Get fee as basis points
    pub fn as_bps(&self) -> u32 {
        *self as u32
    }

    /// Get fee as percentage string
    pub fn as_percentage(&self) -> &'static str {
        match self {
            Self::Lowest => "0.01%",
            Self::Low => "0.05%",
            Self::Medium => "0.30%",
            Self::High => "1.00%",
        }
    }
}

/// Configuration for on-chain quote client
#[derive(Debug, Clone)]
pub struct OnchainQuoteConfig {
    /// RPC URL for the chain
    pub rpc_url: String,
    /// Chain ID
    pub chain_id: u64,
    /// Uniswap V3 factory address
    pub uniswap_v3_factory: Address,
    /// Sushiswap V3 factory address
    pub sushiswap_v3_factory: Address,
    /// Pool init code hash (for CREATE2 address calculation)
    pub pool_init_code_hash: [u8; 32],
    /// RPC call timeout
    pub timeout: Duration,
    /// Number of retry attempts
    pub max_retries: u32,
    /// Delay between retries
    pub retry_delay: Duration,
    /// Token registry for address-to-decimals lookup
    pub token_registry: TokenRegistry,
}

impl OnchainQuoteConfig {
    /// Create configuration for Arbitrum
    pub fn arbitrum(rpc_url: impl Into<String>) -> Self {
        Self {
            rpc_url: rpc_url.into(),
            chain_id: 42161,
            // Uniswap V3 factory on Arbitrum
            uniswap_v3_factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984"
                .parse()
                .unwrap(),
            // Sushiswap V3 factory on Arbitrum
            sushiswap_v3_factory: "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e"
                .parse()
                .unwrap(),
            // Uniswap V3 pool init code hash
            pool_init_code_hash: hex_literal::hex!(
                "e34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54"
            ),
            timeout: Duration::from_secs(5),
            max_retries: 3,
            retry_delay: Duration::from_millis(500),
            token_registry: TokenRegistry::arbitrum(),
        }
    }

    /// Set custom timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Set custom retry configuration
    pub fn with_retries(mut self, max_retries: u32, retry_delay: Duration) -> Self {
        self.max_retries = max_retries;
        self.retry_delay = retry_delay;
        self
    }

    /// Set custom token registry
    pub fn with_token_registry(mut self, registry: TokenRegistry) -> Self {
        self.token_registry = registry;
        self
    }

    /// Register an additional token
    pub fn with_token(mut self, address: Address, decimals: u8) -> Self {
        self.token_registry.register(address, decimals);
        self
    }
}

/// Token registry for configurable token addresses and decimals
///
/// Allows customization of known tokens beyond the hardcoded Arbitrum defaults.
/// This is useful for testing with mock tokens or supporting additional chains.
#[derive(Debug, Clone, Default)]
pub struct TokenRegistry {
    /// Custom token entries: (address, decimals)
    tokens: std::collections::HashMap<Address, u8>,
}

impl TokenRegistry {
    /// Create an empty registry
    pub fn new() -> Self {
        Self {
            tokens: std::collections::HashMap::new(),
        }
    }

    /// Create a registry pre-populated with Arbitrum tokens
    pub fn arbitrum() -> Self {
        let mut registry = Self::new();
        registry.register(arbitrum_tokens::usdc(), 6);
        registry.register(arbitrum_tokens::usdc_e(), 6);
        registry.register(arbitrum_tokens::usdt(), 6);
        registry.register(arbitrum_tokens::wbtc(), 8);
        registry.register(arbitrum_tokens::weth(), 18);
        registry.register(arbitrum_tokens::arb(), 18);
        registry
    }

    /// Register a token with its decimals
    pub fn register(&mut self, address: Address, decimals: u8) {
        self.tokens.insert(address, decimals);
    }

    /// Get decimals for a token, checking custom registry first, then Arbitrum defaults
    pub fn decimals(&self, token: Address) -> Option<u8> {
        self.tokens
            .get(&token)
            .copied()
            .or_else(|| arbitrum_tokens::decimals(token))
    }

    /// Check if a token is registered (either custom or Arbitrum default)
    pub fn is_registered(&self, token: Address) -> bool {
        self.tokens.contains_key(&token) || arbitrum_tokens::decimals(token).is_some()
    }

    /// Get all registered token addresses
    pub fn registered_tokens(&self) -> Vec<Address> {
        let mut tokens: Vec<Address> = self.tokens.keys().copied().collect();
        // Add Arbitrum defaults if not already present
        for addr in [
            arbitrum_tokens::usdc(),
            arbitrum_tokens::usdc_e(),
            arbitrum_tokens::usdt(),
            arbitrum_tokens::wbtc(),
            arbitrum_tokens::weth(),
            arbitrum_tokens::arb(),
        ] {
            if !tokens.contains(&addr) {
                tokens.push(addr);
            }
        }
        tokens
    }
}

/// Common token addresses on Arbitrum
pub mod arbitrum_tokens {
    use ethers::types::Address;

    /// USDC (native) on Arbitrum - 6 decimals
    pub fn usdc() -> Address {
        "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
            .parse()
            .unwrap()
    }

    /// USDC.e (bridged) on Arbitrum - 6 decimals
    pub fn usdc_e() -> Address {
        "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
            .parse()
            .unwrap()
    }

    /// WETH on Arbitrum - 18 decimals
    pub fn weth() -> Address {
        "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            .parse()
            .unwrap()
    }

    /// WBTC on Arbitrum - 8 decimals
    pub fn wbtc() -> Address {
        "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
            .parse()
            .unwrap()
    }

    /// ARB token on Arbitrum - 18 decimals
    pub fn arb() -> Address {
        "0x912CE59144191C1204E64559FE8253a0e49E6548"
            .parse()
            .unwrap()
    }

    /// USDT on Arbitrum - 6 decimals
    pub fn usdt() -> Address {
        "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
            .parse()
            .unwrap()
    }

    /// Get token decimals for known Arbitrum tokens
    pub fn decimals(token: Address) -> Option<u8> {
        if token == usdc() || token == usdc_e() || token == usdt() {
            Some(6)
        } else if token == wbtc() {
            Some(8)
        } else if token == weth() || token == arb() {
            Some(18)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dex_type_display() {
        assert_eq!(DexType::UniswapV3.to_string(), "Uniswap V3");
        assert_eq!(DexType::SushiswapV3.to_string(), "Sushiswap V3");
    }

    #[test]
    fn test_quote_source_is_onchain() {
        let onchain = QuoteSource::Onchain {
            dex: DexType::UniswapV3,
        };
        assert!(onchain.is_onchain());
        assert!(!onchain.is_api());

        let api = QuoteSource::Api {
            name: "1inch".to_string(),
        };
        assert!(!api.is_onchain());
        assert!(api.is_api());
    }

    #[test]
    fn test_quote_status_is_degraded() {
        assert!(!QuoteStatus::Fresh.is_degraded());
        assert!(!QuoteStatus::Cached.is_degraded());
        assert!(QuoteStatus::Degraded.is_degraded());
    }

    #[test]
    fn test_fee_tier_values() {
        assert_eq!(FeeTier::Lowest.as_bps(), 100);
        assert_eq!(FeeTier::Low.as_bps(), 500);
        assert_eq!(FeeTier::Medium.as_bps(), 3000);
        assert_eq!(FeeTier::High.as_bps(), 10000);
    }

    #[test]
    fn test_fee_tier_from_bps() {
        assert_eq!(FeeTier::from_bps(100), Some(FeeTier::Lowest));
        assert_eq!(FeeTier::from_bps(500), Some(FeeTier::Low));
        assert_eq!(FeeTier::from_bps(3000), Some(FeeTier::Medium));
        assert_eq!(FeeTier::from_bps(10000), Some(FeeTier::High));
        assert_eq!(FeeTier::from_bps(999), None);
    }

    #[test]
    fn test_fee_tier_percentage() {
        assert_eq!(FeeTier::Lowest.as_percentage(), "0.01%");
        assert_eq!(FeeTier::Low.as_percentage(), "0.05%");
        assert_eq!(FeeTier::Medium.as_percentage(), "0.30%");
        assert_eq!(FeeTier::High.as_percentage(), "1.00%");
    }

    #[test]
    fn test_arbitrum_config() {
        let config = OnchainQuoteConfig::arbitrum("https://arb1.arbitrum.io/rpc");
        assert_eq!(config.chain_id, 42161);
        assert_eq!(
            config.uniswap_v3_factory,
            "0x1F98431c8aD98523631AE4a59f267346ea31F984"
                .parse::<Address>()
                .unwrap()
        );
        assert_eq!(
            config.sushiswap_v3_factory,
            "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e"
                .parse::<Address>()
                .unwrap()
        );
    }

    #[test]
    fn test_arbitrum_tokens() {
        use arbitrum_tokens::*;

        // Verify addresses are correctly parsed
        assert_eq!(
            usdc(),
            "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
                .parse::<Address>()
                .unwrap()
        );
        assert_eq!(
            weth(),
            "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
                .parse::<Address>()
                .unwrap()
        );
    }

    #[test]
    fn test_token_decimals() {
        use arbitrum_tokens::*;
        assert_eq!(decimals(usdc()), Some(6));
        assert_eq!(decimals(usdc_e()), Some(6));
        assert_eq!(decimals(usdt()), Some(6));
        assert_eq!(decimals(wbtc()), Some(8));
        assert_eq!(decimals(weth()), Some(18));
        assert_eq!(decimals(arb()), Some(18));
        assert_eq!(decimals(Address::zero()), None);
    }

    // =========================================================================
    // TokenRegistry Tests
    // =========================================================================

    #[test]
    fn test_token_registry_new_is_empty() {
        let registry = TokenRegistry::new();
        let unknown_token: Address = "0x1111111111111111111111111111111111111111"
            .parse()
            .unwrap();
        // Empty registry falls back to arbitrum_tokens
        assert_eq!(registry.decimals(arbitrum_tokens::usdc()), Some(6));
        // Unknown token returns None
        assert_eq!(registry.decimals(unknown_token), None);
    }

    #[test]
    fn test_token_registry_arbitrum_has_defaults() {
        let registry = TokenRegistry::arbitrum();
        assert_eq!(registry.decimals(arbitrum_tokens::usdc()), Some(6));
        assert_eq!(registry.decimals(arbitrum_tokens::weth()), Some(18));
        assert_eq!(registry.decimals(arbitrum_tokens::wbtc()), Some(8));
    }

    #[test]
    fn test_token_registry_register_custom_token() {
        let mut registry = TokenRegistry::new();
        let custom_token: Address = "0x2222222222222222222222222222222222222222"
            .parse()
            .unwrap();

        assert_eq!(registry.decimals(custom_token), None);

        registry.register(custom_token, 12);

        assert_eq!(registry.decimals(custom_token), Some(12));
    }

    #[test]
    fn test_token_registry_custom_overrides_default() {
        let mut registry = TokenRegistry::new();
        // USDC normally has 6 decimals
        assert_eq!(registry.decimals(arbitrum_tokens::usdc()), Some(6));

        // Override to 18 decimals (for testing purposes)
        registry.register(arbitrum_tokens::usdc(), 18);

        // Custom registration takes precedence
        assert_eq!(registry.decimals(arbitrum_tokens::usdc()), Some(18));
    }

    #[test]
    fn test_token_registry_is_registered() {
        let mut registry = TokenRegistry::new();
        let custom_token: Address = "0x3333333333333333333333333333333333333333"
            .parse()
            .unwrap();

        // Arbitrum default is registered
        assert!(registry.is_registered(arbitrum_tokens::usdc()));
        // Custom token is not registered yet
        assert!(!registry.is_registered(custom_token));

        registry.register(custom_token, 9);

        // Now it's registered
        assert!(registry.is_registered(custom_token));
    }

    #[test]
    fn test_token_registry_registered_tokens() {
        let mut registry = TokenRegistry::new();
        let custom_token: Address = "0x4444444444444444444444444444444444444444"
            .parse()
            .unwrap();

        registry.register(custom_token, 6);

        let tokens = registry.registered_tokens();

        // Should include the custom token
        assert!(tokens.contains(&custom_token));
        // Should include Arbitrum defaults
        assert!(tokens.contains(&arbitrum_tokens::usdc()));
        assert!(tokens.contains(&arbitrum_tokens::weth()));
    }

    #[test]
    fn test_config_token_registry_default() {
        let config = OnchainQuoteConfig::arbitrum("https://test.rpc");
        // Default config should have Arbitrum tokens
        assert_eq!(
            config.token_registry.decimals(arbitrum_tokens::usdc()),
            Some(6)
        );
    }

    #[test]
    fn test_config_with_token_builder() {
        let custom_token: Address = "0x5555555555555555555555555555555555555555"
            .parse()
            .unwrap();

        let config = OnchainQuoteConfig::arbitrum("https://test.rpc")
            .with_token(custom_token, 8)
            .with_token(arbitrum_tokens::usdc(), 18); // Override default

        assert_eq!(config.token_registry.decimals(custom_token), Some(8));
        assert_eq!(
            config.token_registry.decimals(arbitrum_tokens::usdc()),
            Some(18)
        );
    }

    #[test]
    fn test_config_with_token_registry_builder() {
        let mut registry = TokenRegistry::new();
        registry.register(
            "0x6666666666666666666666666666666666666666"
                .parse()
                .unwrap(),
            7,
        );

        let config =
            OnchainQuoteConfig::arbitrum("https://test.rpc").with_token_registry(registry);

        assert_eq!(
            config.token_registry.decimals(
                "0x6666666666666666666666666666666666666666"
                    .parse()
                    .unwrap()
            ),
            Some(7)
        );
        // Arbitrum defaults still work via fallback
        assert_eq!(
            config.token_registry.decimals(arbitrum_tokens::weth()),
            Some(18)
        );
    }
}
