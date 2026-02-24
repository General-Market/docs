//! Price validation for staleness and tolerance checks
//!
//! Provides validators for ensuring price freshness and agreement between issuers.

use common::types::{Price, PriceSource};
use ethers::types::{Address, U256};
use tracing::warn;

use super::tolerance;

/// Result of staleness validation
#[derive(Debug, Clone)]
pub struct StalenessResult {
    /// Whether all prices are fresh (not stale)
    pub is_valid: bool,
    /// List of prices that are stale
    pub stale_prices: Vec<StalePrice>,
}

/// Information about a stale price
#[derive(Debug, Clone)]
pub struct StalePrice {
    /// The asset with the stale price
    pub asset: Address,
    /// How old the price is in seconds
    pub age_seconds: u64,
    /// The maximum allowed age for this source
    pub limit_seconds: u64,
    /// The price source type
    pub source: PriceSource,
}

/// Validator for price staleness
#[derive(Debug, Clone, Default)]
pub struct StalenessValidator;

impl StalenessValidator {
    /// Create a new staleness validator
    pub fn new() -> Self {
        Self
    }

    /// Validate that all prices are fresh
    ///
    /// Uses the `Price::is_stale()` method from the common crate which
    /// applies per-source staleness limits:
    /// - CEX (Bitget): 10 seconds
    /// - DEX (1inch): 30 seconds
    /// - On-chain: 60 seconds
    pub fn validate_staleness(&self, prices: &[Price], current_time: U256) -> StalenessResult {
        let mut stale_prices = Vec::new();

        for price in prices {
            if price.is_stale(current_time) {
                let source = price.source_enum();
                let limit_seconds = match source {
                    PriceSource::Bitget => 10,
                    PriceSource::OneInch => 30,
                    PriceSource::OnChain => 60,
                };

                let age_seconds = current_time
                    .saturating_sub(price.timestamp)
                    .as_u64();

                warn!(
                    code = "E005",
                    asset = ?price.asset,
                    age_seconds,
                    limit_seconds,
                    source = ?source,
                    "Stale price detected"
                );

                stale_prices.push(StalePrice {
                    asset: price.asset,
                    age_seconds,
                    limit_seconds,
                    source,
                });
            }
        }

        StalenessResult {
            is_valid: stale_prices.is_empty(),
            stale_prices,
        }
    }
}

/// Result of price comparison between this node and leader prices
#[derive(Debug, Clone)]
pub struct ComparisonResult {
    /// Whether all prices agree within tolerance
    pub agrees: bool,
    /// List of price disagreements
    pub disagreements: Vec<PriceDisagreement>,
}

/// Information about a price disagreement
#[derive(Debug, Clone)]
pub struct PriceDisagreement {
    /// The asset with disagreeing prices
    pub asset: Address,
    /// This node's price
    pub my_price: U256,
    /// The leader's price
    pub leader_price: U256,
    /// The difference in basis points (e.g., 500 = 5%)
    pub difference_bps: u64,
    /// The tolerance threshold in basis points (e.g., 200 = 2%)
    pub tolerance_bps: u64,
}

/// Well-known stablecoin addresses (Ethereum mainnet reference only)
///
/// **IMPORTANT:** These mainnet addresses are only for reference and will NOT match
/// on Index L3 (Chain ID 111222333). For production use on Index L3, you MUST
/// configure custom addresses using `ToleranceValidator::new().with_stablecoins(addresses)`.
///
/// Without configuration, all assets will use DEFAULT tolerance (2%).
const STABLECOIN_ADDRESSES: &[&str] = &[
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC (mainnet)
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT (mainnet)
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI (mainnet)
];

/// Well-known BTC/ETH addresses (Ethereum mainnet wrapped versions reference only)
///
/// **IMPORTANT:** These mainnet addresses are only for reference and will NOT match
/// on Index L3 (Chain ID 111222333). For production use on Index L3, you MUST
/// configure custom addresses using `ToleranceValidator::new().with_btc_eth(addresses)`.
const BTC_ETH_ADDRESSES: &[&str] = &[
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC (mainnet)
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH (mainnet)
];

/// Validator for price tolerance between nodes
#[derive(Debug, Clone, Default)]
pub struct ToleranceValidator {
    /// Custom stablecoin addresses (overrides defaults if set)
    stablecoin_addresses: Vec<Address>,
    /// Custom BTC/ETH addresses (overrides defaults if set)
    btc_eth_addresses: Vec<Address>,
}

impl ToleranceValidator {
    /// Create a new tolerance validator with default asset classifications
    pub fn new() -> Self {
        Self {
            stablecoin_addresses: Vec::new(),
            btc_eth_addresses: Vec::new(),
        }
    }

    /// Set custom stablecoin addresses
    pub fn with_stablecoins(mut self, addresses: Vec<Address>) -> Self {
        self.stablecoin_addresses = addresses;
        self
    }

    /// Set custom BTC/ETH addresses
    pub fn with_btc_eth(mut self, addresses: Vec<Address>) -> Self {
        self.btc_eth_addresses = addresses;
        self
    }

    /// Get the tolerance for a specific asset
    fn get_tolerance(&self, asset: Address) -> f64 {
        // Check custom addresses first
        if !self.stablecoin_addresses.is_empty() {
            if self.stablecoin_addresses.contains(&asset) {
                return tolerance::STABLECOINS;
            }
        } else {
            // Use default stablecoin addresses
            let asset_hex = format!("{:?}", asset).to_lowercase();
            for &stable in STABLECOIN_ADDRESSES {
                if asset_hex.contains(stable) {
                    return tolerance::STABLECOINS;
                }
            }
        }

        // Check custom BTC/ETH addresses
        if !self.btc_eth_addresses.is_empty() {
            if self.btc_eth_addresses.contains(&asset) {
                return tolerance::BTC_ETH;
            }
        } else {
            // Use default BTC/ETH addresses
            let asset_hex = format!("{:?}", asset).to_lowercase();
            for &btc_eth in BTC_ETH_ADDRESSES {
                if asset_hex.contains(btc_eth) {
                    return tolerance::BTC_ETH;
                }
            }
        }

        // Default tolerance for unknown assets
        tolerance::DEFAULT
    }

    /// Compare this node's prices with leader prices
    ///
    /// Returns agreement status and any disagreements that exceed tolerance.
    pub fn compare_prices(&self, mine: &[Price], leaders: &[Price]) -> ComparisonResult {
        let mut disagreements = Vec::new();

        // Create a map of leader prices for quick lookup
        let leader_map: std::collections::HashMap<Address, &Price> =
            leaders.iter().map(|p| (p.asset, p)).collect();

        for my_price in mine {
            if let Some(&leader_price) = leader_map.get(&my_price.asset) {
                let tolerance = self.get_tolerance(my_price.asset);

                // Calculate difference using pure U256 arithmetic
                let diff = if my_price.price >= leader_price.price {
                    my_price.price - leader_price.price
                } else {
                    leader_price.price - my_price.price
                };

                // Tolerance in basis points (e.g., 0.02 => 200 bps)
                let tolerance_bps = (tolerance * 10000.0) as u64;
                let exceeds_tolerance = if leader_price.price.is_zero() {
                    !my_price.price.is_zero() // zero vs non-zero = infinite difference
                } else {
                    // difference_bps = (diff * 10000) / leader_price
                    let diff_bps = (diff * U256::from(10000u64)) / leader_price.price;
                    diff_bps > U256::from(tolerance_bps)
                };

                if exceeds_tolerance {
                    // Compute diff_bps for logging/storage (safe: only reached when leader != 0 or special case)
                    let diff_bps_val = if leader_price.price.is_zero() {
                        u64::MAX // infinite difference marker
                    } else {
                        ((diff * U256::from(10000u64)) / leader_price.price).as_u64()
                    };

                    warn!(
                        code = "E005",
                        asset = ?my_price.asset,
                        my_price = %my_price.price,
                        leader_price = %leader_price.price,
                        difference_bps = diff_bps_val,
                        tolerance_bps = tolerance_bps,
                        "Price disagreement detected"
                    );

                    disagreements.push(PriceDisagreement {
                        asset: my_price.asset,
                        my_price: my_price.price,
                        leader_price: leader_price.price,
                        difference_bps: diff_bps_val,
                        tolerance_bps,
                    });
                }
            }
            // Note: If leader doesn't have a price for this asset, we don't flag disagreement
            // This allows for partial price sets
        }

        ComparisonResult {
            agrees: disagreements.is_empty(),
            disagreements,
        }
    }
}

/// Reason for batch rejection
#[derive(Debug, Clone)]
pub enum BatchRejectReason {
    /// Batch rejected due to stale prices
    StalePrices {
        /// Number of stale prices
        count: usize,
    },
    /// Batch rejected due to price disagreement
    PriceDisagreement {
        /// Number of assets with disagreements
        disagreement_count: usize,
        /// Percentage of compared prices that disagree
        disagreement_percent: f64,
    },
}

/// Result of batch validation
#[derive(Debug, Clone)]
pub struct BatchValidationResult {
    /// Whether the batch is valid
    pub is_valid: bool,
    /// Reason for rejection, if invalid
    pub reject_reason: Option<BatchRejectReason>,
    /// Staleness validation result
    pub staleness_result: StalenessResult,
    /// Comparison result (if leader prices provided)
    pub comparison_result: Option<ComparisonResult>,
}

/// Combined price validator for batch validation
#[derive(Debug, Clone)]
pub struct PriceValidator {
    staleness_validator: StalenessValidator,
    tolerance_validator: ToleranceValidator,
}

impl Default for PriceValidator {
    fn default() -> Self {
        Self::new()
    }
}

impl PriceValidator {
    /// Create a new price validator with default settings
    pub fn new() -> Self {
        Self {
            staleness_validator: StalenessValidator::new(),
            tolerance_validator: ToleranceValidator::new(),
        }
    }

    /// Create a price validator with custom tolerance validator
    pub fn with_tolerance_validator(tolerance_validator: ToleranceValidator) -> Self {
        Self {
            staleness_validator: StalenessValidator::new(),
            tolerance_validator,
        }
    }

    /// Validate a batch of prices
    ///
    /// Checks for staleness and optionally compares with leader prices.
    /// A batch is rejected if:
    /// - ANY price is stale
    /// - Price disagreement exists (when leader prices provided)
    pub fn validate_batch(
        &self,
        prices: &[Price],
        current_time: U256,
        leader_prices: Option<&[Price]>,
    ) -> BatchValidationResult {
        // Check staleness first
        let staleness_result = self.staleness_validator.validate_staleness(prices, current_time);

        if !staleness_result.is_valid {
            return BatchValidationResult {
                is_valid: false,
                reject_reason: Some(BatchRejectReason::StalePrices {
                    count: staleness_result.stale_prices.len(),
                }),
                staleness_result,
                comparison_result: None,
            };
        }

        // Check price comparison if leader prices provided
        let comparison_result = leader_prices.map(|leaders| {
            self.tolerance_validator.compare_prices(prices, leaders)
        });

        if let Some(ref comparison) = comparison_result {
            if !comparison.agrees {
                let total_prices = prices.len().max(1);
                let disagreement_percent =
                    comparison.disagreements.len() as f64 / total_prices as f64;

                return BatchValidationResult {
                    is_valid: false,
                    reject_reason: Some(BatchRejectReason::PriceDisagreement {
                        disagreement_count: comparison.disagreements.len(),
                        disagreement_percent,
                    }),
                    staleness_result,
                    comparison_result,
                };
            }
        }

        BatchValidationResult {
            is_valid: true,
            reject_reason: None,
            staleness_result,
            comparison_result,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_address(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    fn make_price(asset: Address, price: U256, timestamp: U256, source: PriceSource) -> Price {
        Price {
            asset,
            price,
            timestamp,
            source: U256::from(source as u8),
        }
    }

    // Staleness tests

    #[test]
    fn test_staleness_validator_fresh_prices() {
        let validator = StalenessValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![
            make_price(
                test_address(1),
                U256::from(1_000_000_000_000_000_000u128),
                U256::from(995u64), // 5 seconds old, Bitget limit is 10
                PriceSource::Bitget,
            ),
            make_price(
                test_address(2),
                U256::from(2_000_000_000_000_000_000u128),
                U256::from(980u64), // 20 seconds old, OneInch limit is 30
                PriceSource::OneInch,
            ),
        ];

        let result = validator.validate_staleness(&prices, current_time);

        assert!(result.is_valid);
        assert!(result.stale_prices.is_empty());
    }

    #[test]
    fn test_staleness_validator_stale_cex_price() {
        let validator = StalenessValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(985u64), // 15 seconds old, exceeds Bitget 10s limit
            PriceSource::Bitget,
        )];

        let result = validator.validate_staleness(&prices, current_time);

        assert!(!result.is_valid);
        assert_eq!(result.stale_prices.len(), 1);
        assert_eq!(result.stale_prices[0].age_seconds, 15);
        assert_eq!(result.stale_prices[0].limit_seconds, 10);
    }

    #[test]
    fn test_staleness_validator_stale_dex_price() {
        let validator = StalenessValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(960u64), // 40 seconds old, exceeds OneInch 30s limit
            PriceSource::OneInch,
        )];

        let result = validator.validate_staleness(&prices, current_time);

        assert!(!result.is_valid);
        assert_eq!(result.stale_prices.len(), 1);
        assert_eq!(result.stale_prices[0].age_seconds, 40);
        assert_eq!(result.stale_prices[0].limit_seconds, 30);
    }

    #[test]
    fn test_staleness_validator_stale_low_liquidity_price() {
        let validator = StalenessValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(930u64), // 70 seconds old, exceeds OnChain 60s limit
            PriceSource::OnChain,
        )];

        let result = validator.validate_staleness(&prices, current_time);

        assert!(!result.is_valid);
        assert_eq!(result.stale_prices.len(), 1);
        assert_eq!(result.stale_prices[0].age_seconds, 70);
        assert_eq!(result.stale_prices[0].limit_seconds, 60);
    }

    #[test]
    fn test_staleness_validator_empty_prices() {
        let validator = StalenessValidator::new();
        let current_time = U256::from(1000u64);

        let result = validator.validate_staleness(&[], current_time);

        assert!(result.is_valid);
        assert!(result.stale_prices.is_empty());
    }

    // Tolerance tests

    #[test]
    fn test_tolerance_validator_prices_agree() {
        let validator = ToleranceValidator::new();

        let mine = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128), // 1.0
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        let leaders = vec![make_price(
            test_address(1),
            U256::from(1_010_000_000_000_000_000u128), // 1.01 (1% difference, within 2% tolerance)
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        let result = validator.compare_prices(&mine, &leaders);

        assert!(result.agrees);
        assert!(result.disagreements.is_empty());
    }

    #[test]
    fn test_tolerance_validator_prices_disagree() {
        let validator = ToleranceValidator::new();

        let mine = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128), // 1.0
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        let leaders = vec![make_price(
            test_address(1),
            U256::from(1_050_000_000_000_000_000u128), // 1.05 (5% difference, exceeds 2% tolerance)
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        let result = validator.compare_prices(&mine, &leaders);

        assert!(!result.agrees);
        assert_eq!(result.disagreements.len(), 1);
        assert!(result.disagreements[0].difference_bps > 200); // > 2% = 200 bps
    }

    #[test]
    fn test_tolerance_validator_stablecoin_tight_tolerance() {
        // Create validator with custom stablecoin address
        let stablecoin = test_address(1);
        let validator = ToleranceValidator::new().with_stablecoins(vec![stablecoin]);

        let mine = vec![make_price(
            stablecoin,
            U256::from(1_000_000_000_000_000_000u128), // 1.0
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        // 0.6% difference - exceeds 0.5% stablecoin tolerance
        let leaders = vec![make_price(
            stablecoin,
            U256::from(1_006_000_000_000_000_000u128), // 1.006
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        let result = validator.compare_prices(&mine, &leaders);

        assert!(!result.agrees);
        assert_eq!(result.disagreements.len(), 1);
        assert_eq!(result.disagreements[0].tolerance_bps, 50); // 0.5% = 50 bps
    }

    #[test]
    fn test_tolerance_validator_btc_eth_tolerance() {
        // Create validator with custom BTC address
        let btc = test_address(2);
        let validator = ToleranceValidator::new().with_btc_eth(vec![btc]);

        let mine = vec![make_price(
            btc,
            U256::from(50_000_000_000_000_000_000_000u128), // 50000
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        // 1.5% difference - within 2% BTC/ETH tolerance
        let leaders = vec![make_price(
            btc,
            U256::from(50_750_000_000_000_000_000_000u128), // 50750
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        let result = validator.compare_prices(&mine, &leaders);

        assert!(result.agrees);
        assert!(result.disagreements.is_empty());
    }

    #[test]
    fn test_tolerance_validator_empty_prices() {
        let validator = ToleranceValidator::new();

        let result = validator.compare_prices(&[], &[]);

        assert!(result.agrees);
        assert!(result.disagreements.is_empty());
    }

    #[test]
    fn test_tolerance_validator_missing_leader_price() {
        let validator = ToleranceValidator::new();

        let mine = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(1000u64),
            PriceSource::Bitget,
        )];

        // Empty leader prices - should not cause disagreement
        let result = validator.compare_prices(&mine, &[]);

        assert!(result.agrees);
        assert!(result.disagreements.is_empty());
    }

    // Batch validation tests

    #[test]
    fn test_batch_validation_valid() {
        let validator = PriceValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(995u64), // Fresh
            PriceSource::Bitget,
        )];

        let result = validator.validate_batch(&prices, current_time, None);

        assert!(result.is_valid);
        assert!(result.reject_reason.is_none());
    }

    #[test]
    fn test_batch_validation_stale_rejection() {
        let validator = PriceValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(980u64), // 20 seconds old, stale for Bitget
            PriceSource::Bitget,
        )];

        let result = validator.validate_batch(&prices, current_time, None);

        assert!(!result.is_valid);
        assert!(matches!(
            result.reject_reason,
            Some(BatchRejectReason::StalePrices { count: 1 })
        ));
    }

    #[test]
    fn test_batch_validation_disagreement_rejection() {
        let validator = PriceValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(995u64),
            PriceSource::Bitget,
        )];

        let leader_prices = vec![make_price(
            test_address(1),
            U256::from(1_100_000_000_000_000_000u128), // 10% difference
            U256::from(995u64),
            PriceSource::Bitget,
        )];

        let result = validator.validate_batch(&prices, current_time, Some(&leader_prices));

        assert!(!result.is_valid);
        assert!(matches!(
            result.reject_reason,
            Some(BatchRejectReason::PriceDisagreement { .. })
        ));
    }

    #[test]
    fn test_batch_validation_with_agreement() {
        let validator = PriceValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(995u64),
            PriceSource::Bitget,
        )];

        let leader_prices = vec![make_price(
            test_address(1),
            U256::from(1_010_000_000_000_000_000u128), // 1% difference, within tolerance
            U256::from(995u64),
            PriceSource::Bitget,
        )];

        let result = validator.validate_batch(&prices, current_time, Some(&leader_prices));

        assert!(result.is_valid);
        assert!(result.reject_reason.is_none());
        assert!(result.comparison_result.is_some());
        assert!(result.comparison_result.unwrap().agrees);
    }

    #[test]
    fn test_batch_validation_all_stale() {
        let validator = PriceValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![
            make_price(
                test_address(1),
                U256::from(1_000_000_000_000_000_000u128),
                U256::from(980u64), // Stale
                PriceSource::Bitget,
            ),
            make_price(
                test_address(2),
                U256::from(2_000_000_000_000_000_000u128),
                U256::from(960u64), // Also stale
                PriceSource::Bitget,
            ),
        ];

        let result = validator.validate_batch(&prices, current_time, None);

        assert!(!result.is_valid);
        assert!(matches!(
            result.reject_reason,
            Some(BatchRejectReason::StalePrices { count: 2 })
        ));
    }

    #[test]
    fn test_batch_validation_single_price() {
        let validator = PriceValidator::new();
        let current_time = U256::from(1000u64);

        let prices = vec![make_price(
            test_address(1),
            U256::from(1_000_000_000_000_000_000u128),
            U256::from(995u64),
            PriceSource::Bitget,
        )];

        let result = validator.validate_batch(&prices, current_time, None);

        assert!(result.is_valid);
    }
}
