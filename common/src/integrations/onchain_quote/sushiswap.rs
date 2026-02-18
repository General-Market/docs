//! Sushiswap V3 pool interaction
//!
//! Sushiswap V3 uses the same interface as Uniswap V3, so this module
//! reuses the Uniswap V3 types and provides Sushiswap-specific factory addresses.

use super::error::Result;
use super::types::FeeTier;
use super::uniswap_v3::{compute_pool_address, PoolState, UniswapV3Reader};
use ethers::prelude::*;
use std::sync::Arc;
use tracing::instrument;

/// Sushiswap V3 factory address on Arbitrum
pub const SUSHISWAP_V3_FACTORY_ARBITRUM: &str = "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e";

/// Sushiswap V3 uses the same init code hash as Uniswap V3
pub const SUSHISWAP_V3_INIT_CODE_HASH: [u8; 32] = hex_literal::hex!(
    "e34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54"
);

/// Sushiswap V3 pool reader
///
/// Uses the same underlying reader as Uniswap V3 since the interface is identical.
pub struct SushiswapV3Reader<M: Middleware> {
    inner: UniswapV3Reader<M>,
    factory_address: Address,
}

impl<M: Middleware + 'static> SushiswapV3Reader<M> {
    /// Create a new Sushiswap V3 reader for Arbitrum
    pub fn arbitrum(provider: Arc<M>) -> Self {
        Self {
            inner: UniswapV3Reader::new(provider),
            factory_address: SUSHISWAP_V3_FACTORY_ARBITRUM.parse().unwrap(),
        }
    }

    /// Create a new Sushiswap V3 reader with custom factory address
    pub fn new(provider: Arc<M>, factory_address: Address) -> Self {
        Self {
            inner: UniswapV3Reader::new(provider),
            factory_address,
        }
    }

    /// Get pool state from a pool address
    #[instrument(skip(self), fields(pool = %pool_address))]
    pub async fn get_pool_state(&self, pool_address: Address) -> Result<PoolState> {
        self.inner.get_pool_state(pool_address).await
    }

    /// Get pool address from factory
    #[instrument(skip(self))]
    pub async fn get_pool_from_factory(
        &self,
        token_a: Address,
        token_b: Address,
        fee_tier: FeeTier,
    ) -> Result<Option<Address>> {
        self.inner
            .get_pool_from_factory(self.factory_address, token_a, token_b, fee_tier)
            .await
    }

    /// Compute pool address using CREATE2 (faster than factory lookup)
    pub fn compute_pool_address(
        &self,
        token_a: Address,
        token_b: Address,
        fee_tier: FeeTier,
    ) -> Address {
        compute_pool_address(
            self.factory_address,
            token_a,
            token_b,
            fee_tier,
            SUSHISWAP_V3_INIT_CODE_HASH,
        )
    }

    /// Get the factory address
    pub fn factory_address(&self) -> Address {
        self.factory_address
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sushiswap_factory_address() {
        let addr: Address = SUSHISWAP_V3_FACTORY_ARBITRUM.parse().unwrap();
        assert_ne!(addr, Address::zero());
    }

    #[test]
    fn test_compute_pool_address_deterministic() {
        use ethers::providers::{MockProvider, Provider};

        let (provider, _mock) = Provider::mocked();
        let reader = SushiswapV3Reader::arbitrum(Arc::new(provider));

        let usdc: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
            .parse()
            .unwrap();
        let weth: Address = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            .parse()
            .unwrap();

        let addr1 = reader.compute_pool_address(usdc, weth, FeeTier::Medium);
        let addr2 = reader.compute_pool_address(weth, usdc, FeeTier::Medium);

        // Token order shouldn't matter
        assert_eq!(addr1, addr2);
        assert_ne!(addr1, Address::zero());
    }
}
