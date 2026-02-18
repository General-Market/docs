//! Buffer configuration for AP/Keeper service
//!
//! Defines configuration for buffer balance tracking, debt limits, and replenishment thresholds.

use ethers::types::{Address, U256};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Configuration for a single asset's buffer
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetBufferConfig {
    /// Initial buffer balance for this asset (18 decimals)
    pub initial_balance: U256,
    /// Maximum allowed debt before refusing fills (18 decimals)
    pub max_debt: U256,
    /// Minimum buy amount threshold from on-chain Index.sol (18 decimals)
    /// When debt >= min_buy_amount, replenishment is triggered
    pub min_buy_amount: U256,
}

impl Default for AssetBufferConfig {
    fn default() -> Self {
        Self {
            initial_balance: U256::zero(),
            max_debt: U256::from(1000) * U256::exp10(18), // $1000 default max debt
            min_buy_amount: U256::from(5) * U256::exp10(18), // $5 default min buy amount
        }
    }
}

/// Configuration for the buffer manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BufferConfig {
    /// Per-asset buffer configurations, keyed by asset address
    pub assets: HashMap<Address, AssetBufferConfig>,
    /// WARNING threshold for total buffer USD value
    pub warning_threshold_usd: U256,
    /// CRITICAL threshold for total buffer USD value
    pub critical_threshold_usd: U256,
}

impl Default for BufferConfig {
    fn default() -> Self {
        Self {
            assets: HashMap::new(),
            warning_threshold_usd: U256::from(500) * U256::exp10(18), // $500
            critical_threshold_usd: U256::from(100) * U256::exp10(18), // $100
        }
    }
}

impl BufferConfig {
    /// Create a new BufferConfig with default thresholds
    pub fn new() -> Self {
        Self::default()
    }

    /// Add or update configuration for an asset
    pub fn with_asset(mut self, asset: Address, config: AssetBufferConfig) -> Self {
        self.assets.insert(asset, config);
        self
    }

    /// Set the warning threshold
    pub fn with_warning_threshold(mut self, threshold: U256) -> Self {
        self.warning_threshold_usd = threshold;
        self
    }

    /// Set the critical threshold
    pub fn with_critical_threshold(mut self, threshold: U256) -> Self {
        self.critical_threshold_usd = threshold;
        self
    }

    /// Get configuration for a specific asset
    pub fn get_asset_config(&self, asset: &Address) -> Option<&AssetBufferConfig> {
        self.assets.get(asset)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = BufferConfig::default();
        assert!(config.assets.is_empty());
        assert_eq!(config.warning_threshold_usd, U256::from(500) * U256::exp10(18));
        assert_eq!(config.critical_threshold_usd, U256::from(100) * U256::exp10(18));
    }

    #[test]
    fn test_with_asset() {
        let asset = Address::random();
        let asset_config = AssetBufferConfig {
            initial_balance: U256::from(1000) * U256::exp10(18),
            max_debt: U256::from(500) * U256::exp10(18),
            min_buy_amount: U256::from(10) * U256::exp10(18),
        };

        let config = BufferConfig::new().with_asset(asset, asset_config.clone());

        assert_eq!(config.assets.len(), 1);
        assert_eq!(config.get_asset_config(&asset), Some(&asset_config));
    }

    #[test]
    fn test_builder_pattern() {
        let asset1 = Address::random();
        let asset2 = Address::random();

        let config = BufferConfig::new()
            .with_asset(
                asset1,
                AssetBufferConfig {
                    initial_balance: U256::from(100) * U256::exp10(18),
                    ..Default::default()
                },
            )
            .with_asset(
                asset2,
                AssetBufferConfig {
                    initial_balance: U256::from(200) * U256::exp10(18),
                    ..Default::default()
                },
            )
            .with_warning_threshold(U256::from(1000) * U256::exp10(18))
            .with_critical_threshold(U256::from(200) * U256::exp10(18));

        assert_eq!(config.assets.len(), 2);
        assert_eq!(config.warning_threshold_usd, U256::from(1000) * U256::exp10(18));
        assert_eq!(config.critical_threshold_usd, U256::from(200) * U256::exp10(18));
    }
}
