//! Mock price fetcher for testing
//!
//! Story 7.12: MockPriceFetcher moved from issuer to common/src/mocks for test-only use.

use async_trait::async_trait;
use ethers::types::{Address, U256};
use std::collections::HashMap;
use std::sync::RwLock;

use crate::types::{Price, PriceSource};

/// Error type for mock price fetcher
#[derive(Debug, Clone)]
pub enum MockPriceFetchError {
    /// Asset not found in mock data
    NotFound(Address),
    /// Simulated failure
    SimulatedFailure(Address),
}

impl std::fmt::Display for MockPriceFetchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MockPriceFetchError::NotFound(addr) => write!(f, "Price not found for {:?}", addr),
            MockPriceFetchError::SimulatedFailure(addr) => {
                write!(f, "Simulated failure for {:?}", addr)
            }
        }
    }
}

impl std::error::Error for MockPriceFetchError {}

/// Mock implementation of PriceFetcher for testing
///
/// Stores prices in-memory and returns them on fetch.
/// Can be configured to fail for specific assets.
#[derive(Debug, Default)]
pub struct MockPriceFetcher {
    prices: RwLock<HashMap<Address, U256>>,
    fail_assets: RwLock<Vec<Address>>,
}

impl MockPriceFetcher {
    /// Create a new empty MockPriceFetcher
    pub fn new() -> Self {
        Self::default()
    }

    /// Set a price for an asset
    pub fn set_price(&self, asset: Address, price: U256) {
        self.prices.write().unwrap().insert(asset, price);
    }

    /// Configure an asset to fail on fetch
    pub fn set_fail(&self, asset: Address) {
        self.fail_assets.write().unwrap().push(asset);
    }

    /// Clear all failures
    pub fn clear_failures(&self) {
        self.fail_assets.write().unwrap().clear();
    }

    /// Fetch price for an asset
    pub async fn fetch_price(&self, asset: Address) -> Result<Price, MockPriceFetchError> {
        // Check if this asset should fail
        if self.fail_assets.read().unwrap().contains(&asset) {
            return Err(MockPriceFetchError::SimulatedFailure(asset));
        }

        let price = self
            .prices
            .read()
            .unwrap()
            .get(&asset)
            .copied()
            .ok_or(MockPriceFetchError::NotFound(asset))?;

        Ok(Price {
            asset,
            price,
            timestamp: U256::from(1700000000u64),
            source: U256::from(PriceSource::Bitget as u8),
        })
    }

    /// Fetch prices for multiple assets
    pub async fn fetch_prices(&self, assets: &[Address]) -> Result<Vec<Price>, MockPriceFetchError> {
        let mut prices = Vec::with_capacity(assets.len());
        for &asset in assets {
            prices.push(self.fetch_price(asset).await?);
        }
        Ok(prices)
    }
}

/// Builder for MockPriceFetcher
#[derive(Default)]
pub struct MockPriceFetcherBuilder {
    prices: HashMap<Address, U256>,
}

impl MockPriceFetcherBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a price for an asset
    pub fn with_price(mut self, asset: Address, price: U256) -> Self {
        self.prices.insert(asset, price);
        self
    }

    /// Build the MockPriceFetcher
    pub fn build(self) -> MockPriceFetcher {
        let fetcher = MockPriceFetcher::new();
        for (asset, price) in self.prices {
            fetcher.set_price(asset, price);
        }
        fetcher
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

    #[tokio::test]
    async fn test_mock_price_fetcher_basic() {
        let fetcher = MockPriceFetcherBuilder::new()
            .with_price(test_address(1), U256::from(100))
            .build();

        let price = fetcher.fetch_price(test_address(1)).await.unwrap();
        assert_eq!(price.price, U256::from(100));
    }

    #[tokio::test]
    async fn test_mock_price_fetcher_not_found() {
        let fetcher = MockPriceFetcher::new();
        let result = fetcher.fetch_price(test_address(99)).await;
        assert!(matches!(result, Err(MockPriceFetchError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_mock_price_fetcher_simulated_failure() {
        let fetcher = MockPriceFetcherBuilder::new()
            .with_price(test_address(1), U256::from(100))
            .build();

        fetcher.set_fail(test_address(1));
        let result = fetcher.fetch_price(test_address(1)).await;
        assert!(matches!(result, Err(MockPriceFetchError::SimulatedFailure(_))));
    }

    #[tokio::test]
    async fn test_mock_price_fetcher_multiple() {
        let fetcher = MockPriceFetcherBuilder::new()
            .with_price(test_address(1), U256::from(100))
            .with_price(test_address(2), U256::from(200))
            .build();

        let prices = fetcher.fetch_prices(&[test_address(1), test_address(2)]).await.unwrap();
        assert_eq!(prices.len(), 2);
        assert_eq!(prices[0].price, U256::from(100));
        assert_eq!(prices[1].price, U256::from(200));
    }
}
