//! Price fetcher trait for Index L3 Oracle
//!
//! Provides the `PriceFetcher` trait definition.
//!
//! Story 7.12: MockPriceFetcher moved to test module in bitget.rs.
//! For tests, use `BitgetPriceFetcher<TestBitgetClient>`.

use async_trait::async_trait;
use common::types::Price;
use ethers::types::Address;
use thiserror::Error;

/// Errors that can occur during price fetching
#[derive(Debug, Error)]
pub enum PriceFetchError {
    /// Failed to fetch price for a specific asset
    #[error("Failed to fetch price for asset {asset:?}: {reason}")]
    FetchFailed { asset: Address, reason: String },

    /// Price not available for the requested asset
    #[error("Price not available for asset {asset:?}")]
    PriceNotAvailable { asset: Address },

    /// Simulated failure (for testing)
    #[error("Simulated failure for asset {asset:?}")]
    SimulatedFailure { asset: Address },
}

/// Trait for fetching asset prices
///
/// Implementations can fetch prices from various sources such as:
/// - Bitget CEX API
/// - 1inch DEX aggregator
/// - On-chain oracles
#[async_trait]
pub trait PriceFetcher: Send + Sync {
    /// Fetch prices for multiple assets
    ///
    /// Returns a vector of prices with timestamps for each requested asset.
    /// The order of returned prices may not match the input order.
    async fn fetch_prices(&self, assets: &[Address]) -> Result<Vec<Price>, PriceFetchError>;

    /// Fetch price for a single asset
    ///
    /// Returns the price with timestamp for the requested asset.
    async fn fetch_price(&self, asset: Address) -> Result<Price, PriceFetchError>;
}

/// Blanket impl so `Arc<dyn PriceFetcher>` can be used as the generic `F: PriceFetcher`
/// parameter in ConsensusProtocol and other generic contexts.
#[async_trait]
impl PriceFetcher for std::sync::Arc<dyn PriceFetcher> {
    async fn fetch_prices(&self, assets: &[Address]) -> Result<Vec<Price>, PriceFetchError> {
        (**self).fetch_prices(assets).await
    }

    async fn fetch_price(&self, asset: Address) -> Result<Price, PriceFetchError> {
        (**self).fetch_price(asset).await
    }
}
