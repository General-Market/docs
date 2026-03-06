//! Buffer Manager implementation for AP/Keeper service
//!
//! Manages buffer balances per asset for instant fills of small orders.
//! Buffer can go into debt and triggers replenishment when debt accumulates.

use crate::buffer::config::BufferConfig;
use crate::buffer::metrics::{BufferHealthCheck, BufferHealthStatus, BufferMetrics};
use ethers::types::{Address, U256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Balance state for a single asset
#[derive(Debug, Clone)]
pub struct AssetBalance {
    /// Current balance (can be negative when represented as debt)
    /// Positive = available balance, Negative/zero with debt = in debt
    pub current: U256,
    /// Accumulated debt (always positive or zero)
    pub debt: U256,
    /// Timestamp of last replenishment
    pub last_replenish: Option<Instant>,
}

impl AssetBalance {
    /// Create a new AssetBalance with initial balance
    pub fn new(initial_balance: U256) -> Self {
        Self {
            current: initial_balance,
            debt: U256::zero(),
            last_replenish: None,
        }
    }

    /// Get the effective balance (current - debt, can be negative conceptually)
    /// Returns (balance, is_in_debt)
    pub fn effective_balance(&self) -> (U256, bool) {
        if self.debt > self.current {
            (self.debt - self.current, true)
        } else {
            (self.current - self.debt, false)
        }
    }
}

/// Buffer Manager for managing instant fills of small orders
///
/// Maintains per-asset buffer balances and handles debt accumulation
/// with automatic replenishment triggering when debt threshold is reached.
pub struct BufferManager {
    /// Configuration for buffer management
    config: BufferConfig,
    /// Per-asset balance state (thread-safe)
    balances: Arc<RwLock<HashMap<Address, AssetBalance>>>,
    /// Metrics for monitoring
    metrics: BufferMetrics,
}

impl BufferManager {
    /// Create a new BufferManager with the given configuration
    pub fn new(config: BufferConfig) -> Self {
        let mut balances = HashMap::new();

        // Initialize balances for all configured assets
        for (asset, asset_config) in &config.assets {
            balances.insert(*asset, AssetBalance::new(asset_config.initial_balance));
        }

        info!(
            asset_count = config.assets.len(),
            "BufferManager initialized"
        );

        Self {
            config,
            balances: Arc::new(RwLock::new(balances)),
            metrics: BufferMetrics::new(),
        }
    }

    /// Get the metrics instance for monitoring
    pub fn metrics(&self) -> &BufferMetrics {
        &self.metrics
    }

    /// Get the buffer balance for a specific asset
    /// Returns signed i128 representation: positive = balance, negative = debt
    pub async fn get_buffer_balance(&self, asset: &Address) -> i128 {
        let balances = self.balances.read().await;
        match balances.get(asset) {
            Some(balance) => {
                let (amount, is_debt) = balance.effective_balance();
                // Safe conversion: clamp to i128::MAX if value overflows.
                // With 18 decimals this covers balances up to ~$170 trillion.
                let value = if amount > U256::from(i128::MAX as u128) {
                    warn!(
                        code = "E008",
                        asset = ?asset,
                        amount = %amount,
                        "Buffer balance exceeds i128::MAX, clamping"
                    );
                    i128::MAX
                } else {
                    amount.low_u128() as i128
                };
                if is_debt {
                    -value
                } else {
                    value
                }
            }
            None => 0,
        }
    }

    /// Get total buffer value in USD across all assets (net of debt)
    /// For MVP, assumes all assets are denominated in same units (USDC equivalent)
    pub async fn get_total_buffer_usd(&self) -> U256 {
        let balances = self.balances.read().await;
        let mut positive = U256::zero();
        let mut negative = U256::zero();

        for balance in balances.values() {
            let (amount, is_debt) = balance.effective_balance();
            if is_debt {
                negative = negative.saturating_add(amount);
            } else {
                positive = positive.saturating_add(amount);
            }
        }

        positive.saturating_sub(negative)
    }

    /// Get total debt in USD across all assets
    pub async fn get_total_debt_usd(&self) -> U256 {
        let balances = self.balances.read().await;
        let mut total_debt = U256::zero();

        for balance in balances.values() {
            total_debt = total_debt.saturating_add(balance.debt);
        }

        total_debt
    }

    /// Check health status based on total buffer USD value
    /// Returns: "healthy", "warning", or "critical"
    pub async fn health_status(&self) -> &'static str {
        let total = self.get_total_buffer_usd().await;

        if total < self.config.critical_threshold_usd {
            "critical"
        } else if total < self.config.warning_threshold_usd {
            "warning"
        } else {
            "healthy"
        }
    }

    /// Get full health check result for /health endpoint
    pub async fn health_check(&self) -> BufferHealthCheck {
        let total = self.get_total_buffer_usd().await;
        let total_debt = self.get_total_debt_usd().await;
        let status = BufferHealthStatus::from_balance(
            total,
            self.config.warning_threshold_usd,
            self.config.critical_threshold_usd,
        );

        BufferHealthCheck {
            status,
            total_buffer_usd: total,
            total_debt_usd: total_debt,
            warning_threshold: self.config.warning_threshold_usd,
            critical_threshold: self.config.critical_threshold_usd,
            metrics: self.metrics.snapshot(),
        }
    }

    /// Get the configuration
    pub fn config(&self) -> &BufferConfig {
        &self.config
    }

    /// Check if an asset is configured in the buffer
    pub fn is_asset_configured(&self, asset: &Address) -> bool {
        self.config.assets.contains_key(asset)
    }

    /// Get min buy amount for an asset (for replenishment threshold check)
    pub fn get_min_buy_amount(&self, asset: &Address) -> Option<U256> {
        self.config
            .assets
            .get(asset)
            .map(|c| c.min_buy_amount)
    }

    /// Get max debt for an asset
    pub fn get_max_debt(&self, asset: &Address) -> Option<U256> {
        self.config.assets.get(asset).map(|c| c.max_debt)
    }

    /// Get current debt for an asset
    pub async fn get_debt(&self, asset: &Address) -> U256 {
        let balances = self.balances.read().await;
        balances
            .get(asset)
            .map(|b| b.debt)
            .unwrap_or(U256::zero())
    }

    /// Internal: deduct from buffer (called during fill)
    /// Returns true if deduction was successful (within debt limits)
    pub(crate) async fn deduct(&self, asset: &Address, amount: U256) -> bool {
        let mut balances = self.balances.write().await;

        let balance = match balances.get_mut(asset) {
            Some(b) => b,
            None => return false,
        };

        let max_debt = self
            .config
            .assets
            .get(asset)
            .map(|c| c.max_debt)
            .unwrap_or(U256::zero());

        // Compute new state in one place
        let (new_current, new_debt) = if amount <= balance.current {
            (balance.current - amount, balance.debt)
        } else {
            let overflow = amount - balance.current;
            (U256::zero(), balance.debt + overflow)
        };

        // Check debt limit before applying
        if new_debt > max_debt {
            warn!(
                code = "E008",
                asset = ?asset,
                current_debt = %balance.debt,
                requested = %amount,
                max_debt = %max_debt,
                "Buffer deduction rejected: would exceed max debt"
            );
            return false;
        }

        // Apply
        balance.current = new_current;
        balance.debt = new_debt;

        debug!(
            asset = ?asset,
            amount = %amount,
            new_balance = %balance.current,
            new_debt = %balance.debt,
            "Buffer deducted"
        );

        true
    }

    /// Internal: replenish buffer and clear debt
    pub(crate) async fn replenish(&self, asset: &Address, amount: U256) {
        let mut balances = self.balances.write().await;

        if let Some(balance) = balances.get_mut(asset) {
            // Apply replenishment: first clear debt, then add to balance
            if amount >= balance.debt {
                let remainder = amount - balance.debt;
                balance.debt = U256::zero();
                balance.current = balance.current + remainder;
            } else {
                balance.debt = balance.debt - amount;
            }
            balance.last_replenish = Some(Instant::now());

            info!(
                asset = ?asset,
                amount = %amount,
                new_balance = %balance.current,
                remaining_debt = %balance.debt,
                "Buffer replenished"
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::buffer::config::AssetBufferConfig;

    fn test_config() -> BufferConfig {
        let usdc = Address::from_low_u64_be(1);
        let btc = Address::from_low_u64_be(2);

        BufferConfig::new()
            .with_asset(
                usdc,
                AssetBufferConfig {
                    initial_balance: U256::from(1000) * U256::exp10(18), // $1000
                    max_debt: U256::from(500) * U256::exp10(18),         // $500
                    min_buy_amount: U256::from(5) * U256::exp10(18),     // $5
                },
            )
            .with_asset(
                btc,
                AssetBufferConfig {
                    initial_balance: U256::from(100) * U256::exp10(18), // $100
                    max_debt: U256::from(200) * U256::exp10(18),        // $200
                    min_buy_amount: U256::from(5) * U256::exp10(18),    // $5
                },
            )
            .with_warning_threshold(U256::from(500) * U256::exp10(18))
            .with_critical_threshold(U256::from(100) * U256::exp10(18))
    }

    #[tokio::test]
    async fn test_new_buffer_manager() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let usdc = Address::from_low_u64_be(1);
        let btc = Address::from_low_u64_be(2);

        // Check initial balances
        let usdc_balance = manager.get_buffer_balance(&usdc).await;
        let btc_balance = manager.get_buffer_balance(&btc).await;

        assert!(usdc_balance > 0);
        assert!(btc_balance > 0);
    }

    #[tokio::test]
    async fn test_get_buffer_balance() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let usdc = Address::from_low_u64_be(1);
        let unknown = Address::from_low_u64_be(999);

        // Known asset has positive balance
        let balance = manager.get_buffer_balance(&usdc).await;
        assert!(balance > 0);

        // Unknown asset returns 0
        let unknown_balance = manager.get_buffer_balance(&unknown).await;
        assert_eq!(unknown_balance, 0);
    }

    #[tokio::test]
    async fn test_is_asset_configured() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let usdc = Address::from_low_u64_be(1);
        let unknown = Address::from_low_u64_be(999);

        assert!(manager.is_asset_configured(&usdc));
        assert!(!manager.is_asset_configured(&unknown));
    }

    #[tokio::test]
    async fn test_deduct_within_balance() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let usdc = Address::from_low_u64_be(1);
        let initial = manager.get_buffer_balance(&usdc).await;

        // Deduct small amount
        let deduct_amount = U256::from(100) * U256::exp10(18);
        let success = manager.deduct(&usdc, deduct_amount).await;

        assert!(success);
        let new_balance = manager.get_buffer_balance(&usdc).await;
        assert!(new_balance < initial);
    }

    #[tokio::test]
    async fn test_deduct_into_debt() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let btc = Address::from_low_u64_be(2);
        // BTC has $100 initial, $200 max debt

        // Deduct more than balance (goes into debt)
        let deduct_amount = U256::from(150) * U256::exp10(18);
        let success = manager.deduct(&btc, deduct_amount).await;

        assert!(success);
        let balance = manager.get_buffer_balance(&btc).await;
        assert!(balance < 0); // Now in debt

        let debt = manager.get_debt(&btc).await;
        assert!(debt > U256::zero());
    }

    #[tokio::test]
    async fn test_deduct_exceeds_max_debt() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let btc = Address::from_low_u64_be(2);
        // BTC has $100 initial, $200 max debt

        // Try to deduct way more than max debt allows
        let deduct_amount = U256::from(400) * U256::exp10(18); // Would exceed $200 max debt
        let success = manager.deduct(&btc, deduct_amount).await;

        assert!(!success); // Should be rejected
    }

    #[tokio::test]
    async fn test_replenish_clears_debt() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let btc = Address::from_low_u64_be(2);

        // First, put into debt
        let deduct_amount = U256::from(150) * U256::exp10(18);
        manager.deduct(&btc, deduct_amount).await;

        let debt_before = manager.get_debt(&btc).await;
        assert!(debt_before > U256::zero());

        // Replenish
        let replenish_amount = U256::from(100) * U256::exp10(18);
        manager.replenish(&btc, replenish_amount).await;

        let debt_after = manager.get_debt(&btc).await;
        assert!(debt_after < debt_before);
    }

    #[tokio::test]
    async fn test_health_status() {
        // Create config with low thresholds for testing
        let usdc = Address::from_low_u64_be(1);
        let config = BufferConfig::new()
            .with_asset(
                usdc,
                AssetBufferConfig {
                    initial_balance: U256::from(600) * U256::exp10(18),
                    max_debt: U256::from(1000) * U256::exp10(18),
                    min_buy_amount: U256::from(5) * U256::exp10(18),
                },
            )
            .with_warning_threshold(U256::from(500) * U256::exp10(18))
            .with_critical_threshold(U256::from(100) * U256::exp10(18));

        let manager = BufferManager::new(config);

        // With $600 balance, should be healthy
        assert_eq!(manager.health_status().await, "healthy");
    }

    #[tokio::test]
    async fn test_get_total_buffer_usd() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let total = manager.get_total_buffer_usd().await;
        // USDC ($1000) + BTC ($100) = $1100
        assert_eq!(total, U256::from(1100) * U256::exp10(18));
    }

    #[tokio::test]
    async fn test_get_total_buffer_usd_with_debt() {
        let config = test_config();
        let manager = BufferManager::new(config);

        let btc = Address::from_low_u64_be(2);
        // BTC has $100 initial, put it $50 into debt
        let deduct_amount = U256::from(150) * U256::exp10(18);
        manager.deduct(&btc, deduct_amount).await;

        // USDC $1000 net + BTC -$50 net = $950 total
        let total = manager.get_total_buffer_usd().await;
        assert_eq!(total, U256::from(950) * U256::exp10(18));

        // Total debt should be $50
        let debt = manager.get_total_debt_usd().await;
        assert_eq!(debt, U256::from(50) * U256::exp10(18));
    }
}
