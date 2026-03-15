//! Price fetching and validation module for Index L3 Oracle
//!
//! This module provides:
//! - `PriceFetcher` trait for fetching asset prices from various sources
//! - `BitgetPriceFetcher` for real Bitget API integration
//! - Price staleness and tolerance validation
//!
//! Story 7.12: MockPriceFetcher moved to common::mocks for test-only use.
//! Re-exported here with PriceFetcher implementation for test compatibility.

pub mod backend;
pub mod bitget;
pub mod dex_price_source;
mod fetcher;
pub mod symbol_map;
mod validator;

pub use backend::BackendPriceFetcher;
pub use bitget::BitgetPriceFetcher;
pub use dex_price_source::{DexPriceSource, DexPriceSourceConfig, OnchainFallback, TokenMapping};
pub use fetcher::{PriceFetchError, PriceFetcher};
pub use symbol_map::{SymbolMap, SymbolMapError};
pub use validator::{
    BatchRejectReason, BatchValidationResult, ComparisonResult, PriceDisagreement, PriceValidator,
    StalePrice, StalenessResult, StalenessValidator, ToleranceValidator,
};

// Re-export MockPriceFetcher from common::mocks for test compatibility
pub use common::mocks::{MockPriceFetcher, MockPriceFetcherBuilder};

use async_trait::async_trait;

/// PriceFetcher implementation for MockPriceFetcher
///
/// Story 7.12: Enables using MockPriceFetcher with ConsensusProtocol in tests.
#[async_trait]
impl PriceFetcher for MockPriceFetcher {
    async fn fetch_prices(&self, assets: &[ethers::types::Address]) -> Result<Vec<common::types::Price>, PriceFetchError> {
        MockPriceFetcher::fetch_prices(self, assets)
            .await
            .map_err(|e| PriceFetchError::FetchFailed {
                asset: ethers::types::Address::zero(),
                reason: e.to_string(),
            })
    }

    async fn fetch_price(&self, asset: ethers::types::Address) -> Result<common::types::Price, PriceFetchError> {
        MockPriceFetcher::fetch_price(self, asset)
            .await
            .map_err(|e| match e {
                common::mocks::MockPriceFetchError::NotFound(a) => PriceFetchError::PriceNotAvailable { asset: a },
                common::mocks::MockPriceFetchError::SimulatedFailure(a) => PriceFetchError::SimulatedFailure { asset: a },
            })
    }
}

/// Price tolerance constants for different asset types
pub mod tolerance {
    /// Tolerance for stablecoins (0.5% = 50 basis points)
    pub const STABLECOINS: f64 = 0.005;
    /// Tolerance for BTC/ETH (2% = 200 basis points)
    pub const BTC_ETH: f64 = 0.02;
    /// Default tolerance for other assets (2% = 200 basis points)
    pub const DEFAULT: f64 = 0.02;
}

#[cfg(test)]
mod tests {
    use super::tolerance;

    #[test]
    fn test_tolerance_constants() {
        assert!((tolerance::STABLECOINS - 0.005).abs() < f64::EPSILON);
        assert!((tolerance::BTC_ETH - 0.02).abs() < f64::EPSILON);
        assert!((tolerance::DEFAULT - 0.02).abs() < f64::EPSILON);
    }
}
