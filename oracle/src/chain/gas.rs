//! Gas estimation and configuration for chain transactions
//!
//! Provides dynamic gas estimation with configurable multiplier and fallback values.

use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use tracing::{debug, warn};

use common::error::Error;

/// Configuration for gas estimation
#[derive(Debug, Clone)]
pub struct GasConfig {
    /// Multiplier applied to estimated gas (e.g., 1.2 for 20% buffer)
    pub gas_multiplier: f64,
    /// Maximum gas limit cap to prevent runaway costs
    pub max_gas_limit: u64,
    /// Fallback gas limit if estimation fails
    pub fallback_gas_limit: u64,
    /// Whether to use EIP-1559 gas pricing
    pub use_eip1559: bool,
    /// Max priority fee per gas for EIP-1559 (in wei)
    pub max_priority_fee: Option<U256>,
    /// Max fee per gas for EIP-1559 (in wei)
    pub max_fee_per_gas: Option<U256>,
    /// Legacy gas price (in wei)
    pub legacy_gas_price: Option<U256>,
}

impl Default for GasConfig {
    fn default() -> Self {
        Self {
            gas_multiplier: 1.2, // 20% buffer
            max_gas_limit: 15_000_000, // 15M gas max (100-asset ITP needs ~9.65M)
            fallback_gas_limit: 2_000_000, // 2M fallback
            use_eip1559: true,
            max_priority_fee: None, // Use network defaults
            max_fee_per_gas: None,  // Use network defaults
            legacy_gas_price: None, // Use network defaults
        }
    }
}

impl GasConfig {
    /// Create a new GasConfig with default values
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the gas multiplier
    pub fn with_multiplier(mut self, multiplier: f64) -> Self {
        self.gas_multiplier = multiplier;
        self
    }

    /// Set the max gas limit
    pub fn with_max_gas_limit(mut self, limit: u64) -> Self {
        self.max_gas_limit = limit;
        self
    }

    /// Set the fallback gas limit
    pub fn with_fallback_gas_limit(mut self, limit: u64) -> Self {
        self.fallback_gas_limit = limit;
        self
    }

    /// Configure for legacy gas pricing
    pub fn with_legacy_gas_price(mut self, gas_price: U256) -> Self {
        self.use_eip1559 = false;
        self.legacy_gas_price = Some(gas_price);
        self
    }

    /// Configure for EIP-1559 gas pricing
    pub fn with_eip1559(mut self, max_priority_fee: U256, max_fee_per_gas: U256) -> Self {
        self.use_eip1559 = true;
        self.max_priority_fee = Some(max_priority_fee);
        self.max_fee_per_gas = Some(max_fee_per_gas);
        self
    }
}

/// Gas estimator for transactions
pub struct GasEstimator<M: Middleware> {
    provider: std::sync::Arc<M>,
    config: GasConfig,
}

impl<M: Middleware> GasEstimator<M> {
    /// Create a new GasEstimator
    pub fn new(provider: std::sync::Arc<M>, config: GasConfig) -> Self {
        Self { provider, config }
    }

    /// Estimate gas for a transaction
    ///
    /// Calls `eth_estimateGas` and applies the configured multiplier,
    /// capped at max_gas_limit. Falls back to fallback_gas_limit on error.
    pub async fn estimate_gas(&self, tx: &TypedTransaction) -> Result<U256, Error> {
        match self.provider.estimate_gas(tx, None).await {
            Ok(estimated) => {
                // Apply multiplier with overflow protection
                // Use U256 arithmetic to avoid u64 overflow
                let estimated_u128: u128 = estimated.low_u128();
                let multiplier_scaled = (self.config.gas_multiplier * 1000.0) as u128;
                let with_buffer_u128 = estimated_u128.saturating_mul(multiplier_scaled) / 1000;

                // Cap at max and convert safely
                let final_gas = std::cmp::min(with_buffer_u128, self.config.max_gas_limit as u128) as u64;

                debug!(
                    estimated = %estimated,
                    with_buffer = with_buffer_u128,
                    final_gas = final_gas,
                    multiplier = self.config.gas_multiplier,
                    "Gas estimation completed"
                );

                Ok(U256::from(final_gas))
            }
            Err(e) => {
                let err_str = format!("{}", e);
                // Contract reverts (code 3) mean the tx WILL fail on-chain.
                // Don't use fallback gas — propagate the error so the caller can skip.
                if err_str.contains("execution reverted") {
                    warn!(
                        code = "INFRA-002",
                        error = %e,
                        "Gas estimation failed: contract revert — skipping tx"
                    );
                    return Err(Error::ChainWrite(format!(
                        "Contract revert during gas estimation: {}", e
                    )));
                }
                // For non-revert errors (RPC timeout, etc.), use fallback gas
                warn!(
                    code = "INFRA-002",
                    error = %e,
                    fallback = self.config.fallback_gas_limit,
                    "Gas estimation failed, using fallback"
                );
                Ok(U256::from(self.config.fallback_gas_limit))
            }
        }
    }

    /// Get gas price configuration for a transaction
    ///
    /// Returns either EIP-1559 or legacy gas price settings based on config.
    pub async fn get_gas_price(&self) -> Result<GasPriceResult, Error> {
        if self.config.use_eip1559 {
            self.get_eip1559_fees().await
        } else {
            self.get_legacy_gas_price().await
        }
    }

    /// Get EIP-1559 gas fees
    async fn get_eip1559_fees(&self) -> Result<GasPriceResult, Error> {
        // If configured, use the configured values
        if let (Some(max_priority), Some(max_fee)) =
            (self.config.max_priority_fee, self.config.max_fee_per_gas)
        {
            return Ok(GasPriceResult::Eip1559 {
                max_priority_fee_per_gas: max_priority,
                max_fee_per_gas: max_fee,
            });
        }

        // Otherwise, estimate from network
        // Try to get base fee and calculate appropriate values
        match self.provider.get_block(BlockNumber::Latest).await {
            Ok(Some(block)) => {
                let base_fee = block.base_fee_per_gas.unwrap_or(U256::from(1_000_000_000)); // 1 gwei default
                let max_priority_fee = U256::from(1_500_000_000); // 1.5 gwei tip
                let max_fee = base_fee * 2 + max_priority_fee; // 2x base + tip

                debug!(
                    base_fee = ?base_fee,
                    max_priority_fee = ?max_priority_fee,
                    max_fee = ?max_fee,
                    "Calculated EIP-1559 fees from block"
                );

                Ok(GasPriceResult::Eip1559 {
                    max_priority_fee_per_gas: max_priority_fee,
                    max_fee_per_gas: max_fee,
                })
            }
            _ => {
                // Fallback to defaults
                let max_priority_fee = U256::from(1_500_000_000); // 1.5 gwei
                let max_fee = U256::from(50_000_000_000u64); // 50 gwei

                warn!(code = "INFRA-002", "Could not get latest block, using fallback EIP-1559 fees");

                Ok(GasPriceResult::Eip1559 {
                    max_priority_fee_per_gas: max_priority_fee,
                    max_fee_per_gas: max_fee,
                })
            }
        }
    }

    /// Get legacy gas price
    async fn get_legacy_gas_price(&self) -> Result<GasPriceResult, Error> {
        // If configured, use the configured value
        if let Some(gas_price) = self.config.legacy_gas_price {
            return Ok(GasPriceResult::Legacy { gas_price });
        }

        // Otherwise, query from network
        match self.provider.get_gas_price().await {
            Ok(gas_price) => {
                debug!(gas_price = ?gas_price, "Got legacy gas price from network");
                Ok(GasPriceResult::Legacy { gas_price })
            }
            Err(e) => {
                warn!(code = "INFRA-002", error = %e, "Failed to get gas price, using fallback");
                // Fallback to 20 gwei
                Ok(GasPriceResult::Legacy {
                    gas_price: U256::from(20_000_000_000u64),
                })
            }
        }
    }

    /// Get the gas configuration
    pub fn config(&self) -> &GasConfig {
        &self.config
    }
}

/// Result of gas price estimation
#[derive(Debug, Clone)]
pub enum GasPriceResult {
    /// EIP-1559 gas pricing
    Eip1559 {
        max_priority_fee_per_gas: U256,
        max_fee_per_gas: U256,
    },
    /// Legacy gas pricing
    Legacy { gas_price: U256 },
}

impl GasPriceResult {
    /// Apply this gas price to a transaction request
    pub fn apply_to_tx(&self, tx: &mut Eip1559TransactionRequest) {
        match self {
            GasPriceResult::Eip1559 {
                max_priority_fee_per_gas,
                max_fee_per_gas,
            } => {
                tx.max_priority_fee_per_gas = Some(*max_priority_fee_per_gas);
                tx.max_fee_per_gas = Some(*max_fee_per_gas);
            }
            GasPriceResult::Legacy { gas_price } => {
                // For legacy, set both to the same value
                tx.max_priority_fee_per_gas = Some(*gas_price);
                tx.max_fee_per_gas = Some(*gas_price);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gas_config_default() {
        let config = GasConfig::default();
        assert!((config.gas_multiplier - 1.2).abs() < 0.001);
        assert_eq!(config.max_gas_limit, 15_000_000);
        assert_eq!(config.fallback_gas_limit, 2_000_000);
        assert!(config.use_eip1559);
    }

    #[test]
    fn test_gas_config_builder() {
        let config = GasConfig::new()
            .with_multiplier(1.5)
            .with_max_gas_limit(5_000_000)
            .with_fallback_gas_limit(1_000_000);

        assert!((config.gas_multiplier - 1.5).abs() < 0.001);
        assert_eq!(config.max_gas_limit, 5_000_000);
        assert_eq!(config.fallback_gas_limit, 1_000_000);
    }

    #[test]
    fn test_gas_config_legacy() {
        let gas_price = U256::from(25_000_000_000u64); // 25 gwei
        let config = GasConfig::new().with_legacy_gas_price(gas_price);

        assert!(!config.use_eip1559);
        assert_eq!(config.legacy_gas_price, Some(gas_price));
    }

    #[test]
    fn test_gas_config_eip1559() {
        let max_priority = U256::from(2_000_000_000u64); // 2 gwei
        let max_fee = U256::from(100_000_000_000u64); // 100 gwei
        let config = GasConfig::new().with_eip1559(max_priority, max_fee);

        assert!(config.use_eip1559);
        assert_eq!(config.max_priority_fee, Some(max_priority));
        assert_eq!(config.max_fee_per_gas, Some(max_fee));
    }

    #[test]
    fn test_gas_price_result_apply() {
        let mut tx = Eip1559TransactionRequest::new();

        let result = GasPriceResult::Eip1559 {
            max_priority_fee_per_gas: U256::from(1_500_000_000u64),
            max_fee_per_gas: U256::from(50_000_000_000u64),
        };

        result.apply_to_tx(&mut tx);

        assert_eq!(tx.max_priority_fee_per_gas, Some(U256::from(1_500_000_000u64)));
        assert_eq!(tx.max_fee_per_gas, Some(U256::from(50_000_000_000u64)));
    }
}
