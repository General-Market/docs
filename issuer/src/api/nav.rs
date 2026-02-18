//! NAV (Net Asset Value) calculation for ITPs
//!
//! Computes NAV per share based on ITP per-share inventory quantities and current asset prices.
//!
//! ## Formula
//!
//! NAV = Σ(qty_i * price_i) / 1e18
//!
//! Where:
//! - qty_i is the per-share quantity of asset i (from Index.sol inventory, 18 decimals)
//! - price_i is the current price of asset i (from PriceFetcher / Bitget API, 18 decimals)

use async_trait::async_trait;
use ethers::types::{Address, U256};
use thiserror::Error;

use crate::price::{PriceFetchError, PriceFetcher};

/// Errors that can occur during NAV calculation
#[derive(Debug, Error)]
pub enum NavCalculatorError {
    /// Failed to fetch price for an asset
    #[error("Price fetch failed: {0}")]
    PriceFetchFailed(#[from] PriceFetchError),

    /// Empty inventory (no assets)
    #[error("Empty inventory: no assets in ITP")]
    EmptyComposition,

    /// Arithmetic overflow during calculation
    #[error("Arithmetic overflow during NAV calculation")]
    Overflow,
}

/// Trait for NAV calculation
#[async_trait]
pub trait NavCalculator: Send + Sync {
    /// Calculate NAV for an ITP given its per-share inventory quantities
    ///
    /// Takes inventory as [(asset_address, qty_per_share)] where qty is 18 decimals.
    /// Returns NAV in 18 decimals (caller should scale to 36 for Morpho).
    /// Formula: NAV = Σ(qty * price) / 1e18
    async fn calculate_nav(
        &self,
        inventory: &[(Address, U256)],
    ) -> Result<U256, NavCalculatorError>;
}

#[async_trait]
impl NavCalculator for Box<dyn NavCalculator> {
    async fn calculate_nav(
        &self,
        inventory: &[(Address, U256)],
    ) -> Result<U256, NavCalculatorError> {
        (**self).calculate_nav(inventory).await
    }
}

/// Default NAV calculator using a PriceFetcher
pub struct DefaultNavCalculator<PF> {
    price_fetcher: PF,
}

impl<PF> DefaultNavCalculator<PF> {
    /// Creates a new NAV calculator with the given price fetcher
    pub fn new(price_fetcher: PF) -> Self {
        Self { price_fetcher }
    }
}

#[async_trait]
impl<PF: PriceFetcher> NavCalculator for DefaultNavCalculator<PF> {
    async fn calculate_nav(
        &self,
        inventory: &[(Address, U256)],
    ) -> Result<U256, NavCalculatorError> {
        if inventory.is_empty() {
            return Err(NavCalculatorError::EmptyComposition);
        }

        // Collect asset addresses
        let assets: Vec<Address> = inventory.iter().map(|(addr, _)| *addr).collect();

        // Fetch all prices
        let prices = self.price_fetcher.fetch_prices(&assets).await?;

        // Build price map
        let price_map: std::collections::HashMap<Address, U256> = prices
            .into_iter()
            .map(|p| (p.asset, p.price))
            .collect();

        let scale = U256::exp10(18);
        let mut nav = U256::zero();

        // NAV = Σ(qty * price) / 1e18
        for (asset, qty) in inventory {
            let price = price_map.get(asset).ok_or(PriceFetchError::PriceNotAvailable {
                asset: *asset,
            })?;

            let contribution = qty
                .checked_mul(*price)
                .ok_or(NavCalculatorError::Overflow)?;
            nav = nav
                .checked_add(contribution / scale)
                .ok_or(NavCalculatorError::Overflow)?;
        }

        Ok(nav)
    }
}

/// Mock NAV calculator for testing
pub struct MockNavCalculator {
    /// Fixed NAV to return (18 decimals)
    pub fixed_nav: U256,
}

impl MockNavCalculator {
    /// Creates a mock calculator that always returns the given NAV
    pub fn new(nav_18_decimals: U256) -> Self {
        Self {
            fixed_nav: nav_18_decimals,
        }
    }

    /// Creates a mock calculator returning 1.0 (10^18)
    pub fn one() -> Self {
        Self::new(U256::exp10(18))
    }
}

#[async_trait]
impl NavCalculator for MockNavCalculator {
    async fn calculate_nav(
        &self,
        inventory: &[(Address, U256)],
    ) -> Result<U256, NavCalculatorError> {
        if inventory.is_empty() {
            return Err(NavCalculatorError::EmptyComposition);
        }
        Ok(self.fixed_nav)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::price::MockPriceFetcher;

    #[tokio::test]
    async fn test_nav_calculation_single_asset() {
        // Setup: single asset with qty 1e18, price 2.0 (2e18)
        // NAV = (1e18 * 2e18) / 1e18 = 2e18
        let asset: Address = "0x1111111111111111111111111111111111111111"
            .parse()
            .unwrap();
        let inventory = vec![(asset, U256::exp10(18))]; // qty = 1.0

        let mut price_fetcher = MockPriceFetcher::new();
        price_fetcher.set_price(asset, U256::exp10(18) * 2); // price = $2

        let calculator = DefaultNavCalculator::new(price_fetcher);
        let nav = calculator.calculate_nav(&inventory).await.unwrap();

        // NAV = (1e18 * 2e18) / 1e18 = 2e18
        assert_eq!(nav, U256::exp10(18) * 2);
    }

    #[tokio::test]
    async fn test_nav_calculation_multiple_assets() {
        // Setup: ITP = $1, two equal-weight assets (50%/50%)
        // Asset1 price $4 → qty = (0.5e18 * 1e18) / 4e18 = 0.125e18
        // Asset2 price $2 → qty = (0.5e18 * 1e18) / 2e18 = 0.25e18
        // NAV = (0.125e18 * 4e18 + 0.25e18 * 2e18) / 1e18 = (0.5e18 + 0.5e18) = 1e18
        let asset1: Address = "0x1111111111111111111111111111111111111111"
            .parse()
            .unwrap();
        let asset2: Address = "0x2222222222222222222222222222222222222222"
            .parse()
            .unwrap();

        let qty1 = U256::exp10(18) / 8; // 0.125e18
        let qty2 = U256::exp10(18) / 4; // 0.25e18
        let inventory = vec![(asset1, qty1), (asset2, qty2)];

        let mut price_fetcher = MockPriceFetcher::new();
        price_fetcher.set_price(asset1, U256::exp10(18) * 4); // $4
        price_fetcher.set_price(asset2, U256::exp10(18) * 2); // $2

        let calculator = DefaultNavCalculator::new(price_fetcher);
        let nav = calculator.calculate_nav(&inventory).await.unwrap();

        assert_eq!(nav, U256::exp10(18)); // NAV = $1
    }

    #[tokio::test]
    async fn test_nav_calculation_price_movement() {
        // ITP starts at $1 with 1% BTC weight, BTC = $100k
        // qty_btc = (1e16 * 1e18) / 100000e18 = 1e11
        // BTC doubles to $200k
        // contribution = (1e11 * 200000e18) / 1e18 = 2e16 = $0.02
        let btc: Address = "0x1111111111111111111111111111111111111111"
            .parse()
            .unwrap();

        let qty_btc = U256::from(10u64.pow(11)); // 1e11
        let inventory = vec![(btc, qty_btc)];

        let mut price_fetcher = MockPriceFetcher::new();
        price_fetcher.set_price(btc, U256::exp10(18) * 200000); // $200k

        let calculator = DefaultNavCalculator::new(price_fetcher);
        let nav = calculator.calculate_nav(&inventory).await.unwrap();

        // NAV = (1e11 * 200000e18) / 1e18 = 2e16 = $0.02
        assert_eq!(nav, U256::from(2u64) * U256::exp10(16));
    }

    #[tokio::test]
    async fn test_nav_empty_inventory_fails() {
        let price_fetcher = MockPriceFetcher::new();
        let calculator = DefaultNavCalculator::new(price_fetcher);

        let result = calculator.calculate_nav(&[]).await;
        assert!(matches!(result, Err(NavCalculatorError::EmptyComposition)));
    }

    #[tokio::test]
    async fn test_nav_missing_price_fails() {
        let asset: Address = "0x1111111111111111111111111111111111111111"
            .parse()
            .unwrap();
        let inventory = vec![(asset, U256::exp10(18))];

        // Don't set any prices
        let price_fetcher = MockPriceFetcher::new();
        let calculator = DefaultNavCalculator::new(price_fetcher);

        let result = calculator.calculate_nav(&inventory).await;
        assert!(matches!(result, Err(NavCalculatorError::PriceFetchFailed(_))));
    }

    #[tokio::test]
    async fn test_mock_nav_calculator() {
        let calculator = MockNavCalculator::one();
        let asset: Address = "0x1111111111111111111111111111111111111111"
            .parse()
            .unwrap();
        let inventory = vec![(asset, U256::exp10(18))];

        let nav = calculator.calculate_nav(&inventory).await.unwrap();
        assert_eq!(nav, U256::exp10(18));
    }

    #[tokio::test]
    async fn test_mock_nav_calculator_empty_fails() {
        let calculator = MockNavCalculator::one();
        let result = calculator.calculate_nav(&[]).await;
        assert!(matches!(result, Err(NavCalculatorError::EmptyComposition)));
    }
}
