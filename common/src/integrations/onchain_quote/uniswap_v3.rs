//! Uniswap V3 pool interaction
//!
//! This module provides functions to read state from Uniswap V3 pools,
//! including `slot0` for price and `liquidity` for pool depth.

use super::error::{OnchainQuoteError, Result};
use super::types::FeeTier;
use ethers::prelude::*;
use std::sync::Arc;
use tracing::{debug, instrument};

// ABI definitions for Uniswap V3 pool
abigen!(
    IUniswapV3Pool,
    r#"[
        function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)
        function liquidity() external view returns (uint128)
        function token0() external view returns (address)
        function token1() external view returns (address)
        function fee() external view returns (uint24)
    ]"#
);

// ABI definitions for Uniswap V3 factory
abigen!(
    IUniswapV3Factory,
    r#"[
        function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)
    ]"#
);

/// State of a Uniswap V3 pool from slot0
#[derive(Debug, Clone, Copy)]
pub struct PoolSlot0 {
    /// sqrt(price) * 2^96
    pub sqrt_price_x96: U256,
    /// Current tick
    pub tick: i32,
    /// Whether the pool is unlocked (not in a callback)
    pub unlocked: bool,
}

/// Complete pool state for quote calculation
#[derive(Debug, Clone)]
pub struct PoolState {
    /// Pool address
    pub pool_address: Address,
    /// slot0 data
    pub slot0: PoolSlot0,
    /// Active liquidity
    pub liquidity: u128,
    /// Token0 address (lower address)
    pub token0: Address,
    /// Token1 address (higher address)
    pub token1: Address,
    /// Fee tier in hundredths of a bip (e.g., 3000 = 0.30%)
    pub fee: u32,
}

impl PoolState {
    /// Check if the pool has meaningful liquidity
    pub fn has_liquidity(&self) -> bool {
        self.liquidity > 0
    }

    /// Get the fee tier as a FeeTier enum
    pub fn fee_tier(&self) -> Option<FeeTier> {
        FeeTier::from_bps(self.fee)
    }
}

/// Uniswap V3 pool reader
pub struct UniswapV3Reader<M: Middleware> {
    provider: Arc<M>,
}

impl<M: Middleware + 'static> UniswapV3Reader<M> {
    /// Create a new pool reader
    pub fn new(provider: Arc<M>) -> Self {
        Self { provider }
    }

    /// Get pool state from a pool address
    ///
    /// Fetches slot0 first (price-critical), then remaining fields in parallel
    /// to minimize RPC latency on the fallback path.
    #[instrument(skip(self), fields(pool = %pool_address))]
    pub async fn get_pool_state(&self, pool_address: Address) -> Result<PoolState> {
        let pool = IUniswapV3Pool::new(pool_address, self.provider.clone());

        // Fetch slot0 first (most important for price, and we need unlocked check)
        let slot0_data = pool.slot_0().call().await.map_err(|e| OnchainQuoteError::rpc(e))?;
        let slot0 = PoolSlot0 {
            sqrt_price_x96: slot0_data.0.into(),
            tick: slot0_data.1.into(),
            unlocked: slot0_data.6,
        };

        // Check if pool is locked (in a callback)
        if !slot0.unlocked {
            debug!(%pool_address, "Pool is locked (in callback)");
        }

        // Bind contract call builders so temporaries live long enough for .call()
        let liquidity_builder = pool.liquidity();
        let token0_builder = pool.token_0();
        let token1_builder = pool.token_1();
        let fee_builder = pool.fee();

        // Fetch remaining data in parallel to reduce RPC latency
        let (liquidity_res, token0_res, token1_res, fee_res) = tokio::join!(
            liquidity_builder.call(),
            token0_builder.call(),
            token1_builder.call(),
            fee_builder.call(),
        );

        let liquidity = liquidity_res.map_err(|e| OnchainQuoteError::rpc(e))?;
        let token0 = token0_res.map_err(|e| OnchainQuoteError::rpc(e))?;
        let token1 = token1_res.map_err(|e| OnchainQuoteError::rpc(e))?;
        let fee = fee_res.map_err(|e| OnchainQuoteError::rpc(e))?;

        Ok(PoolState {
            pool_address,
            slot0,
            liquidity,
            token0,
            token1,
            fee: fee.into(),
        })
    }

    /// Get just the slot0 data (faster if you only need price)
    #[instrument(skip(self), fields(pool = %pool_address))]
    pub async fn get_slot0(&self, pool_address: Address) -> Result<PoolSlot0> {
        let pool = IUniswapV3Pool::new(pool_address, self.provider.clone());

        let slot0_data = pool.slot_0().call().await.map_err(|e| OnchainQuoteError::rpc(e))?;

        Ok(PoolSlot0 {
            sqrt_price_x96: slot0_data.0.into(),
            tick: slot0_data.1.into(),
            unlocked: slot0_data.6,
        })
    }

    /// Get pool address from factory
    #[instrument(skip(self), fields(factory = %factory_address))]
    pub async fn get_pool_from_factory(
        &self,
        factory_address: Address,
        token_a: Address,
        token_b: Address,
        fee_tier: FeeTier,
    ) -> Result<Option<Address>> {
        let factory = IUniswapV3Factory::new(factory_address, self.provider.clone());

        let pool_address = factory
            .get_pool(token_a, token_b, fee_tier.as_bps().into())
            .call()
            .await
            .map_err(|e| OnchainQuoteError::rpc(e))?;

        if pool_address == Address::zero() {
            Ok(None)
        } else {
            Ok(Some(pool_address))
        }
    }
}

/// Compute pool address using CREATE2
///
/// This is faster than querying the factory but requires knowing the init code hash.
///
/// # Arguments
///
/// * `factory` - Factory address
/// * `token_a` - First token address
/// * `token_b` - Second token address
/// * `fee` - Fee tier
/// * `init_code_hash` - Pool init code hash (chain-specific)
pub fn compute_pool_address(
    factory: Address,
    token_a: Address,
    token_b: Address,
    fee: FeeTier,
    init_code_hash: [u8; 32],
) -> Address {
    // Sort tokens
    let (token0, token1) = if token_a < token_b {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };

    // Compute salt: keccak256(abi.encode(token0, token1, fee))
    let mut salt_input = Vec::with_capacity(96);
    salt_input.extend_from_slice(&[0u8; 12]); // padding for address
    salt_input.extend_from_slice(token0.as_bytes());
    salt_input.extend_from_slice(&[0u8; 12]); // padding for address
    salt_input.extend_from_slice(token1.as_bytes());
    let fee_bytes = (fee.as_bps() as u32).to_be_bytes();
    salt_input.extend_from_slice(&[0u8; 28]); // padding for uint24
    salt_input.extend_from_slice(&fee_bytes);

    let salt = ethers::utils::keccak256(&salt_input);

    // Compute CREATE2 address
    // address = keccak256(0xff ++ factory ++ salt ++ init_code_hash)[12:]
    let mut create2_input = Vec::with_capacity(85);
    create2_input.push(0xff);
    create2_input.extend_from_slice(factory.as_bytes());
    create2_input.extend_from_slice(&salt);
    create2_input.extend_from_slice(&init_code_hash);

    let hash = ethers::utils::keccak256(&create2_input);
    Address::from_slice(&hash[12..])
}

#[cfg(test)]
mod tests {
    use super::*;

    // Known pool addresses on Arbitrum for verification
    // These can be verified via Arbiscan

    #[test]
    fn test_compute_pool_address() {
        // Uniswap V3 USDC/WETH pool on Arbitrum
        let factory: Address = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
            .parse()
            .unwrap();
        let usdc: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
            .parse()
            .unwrap();
        let weth: Address = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            .parse()
            .unwrap();
        let init_code_hash: [u8; 32] = hex_literal::hex!(
            "e34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54"
        );

        let pool_address = compute_pool_address(factory, usdc, weth, FeeTier::Medium, init_code_hash);

        // The computed address should be a valid address (non-zero)
        assert_ne!(pool_address, Address::zero());

        // Test that token order doesn't matter
        let pool_address_reversed =
            compute_pool_address(factory, weth, usdc, FeeTier::Medium, init_code_hash);
        assert_eq!(pool_address, pool_address_reversed);
    }

    #[test]
    fn test_pool_slot0_defaults() {
        let slot0 = PoolSlot0 {
            sqrt_price_x96: U256::from(1000000u64),
            tick: 0,
            unlocked: true,
        };
        assert!(slot0.unlocked);
        assert_eq!(slot0.tick, 0);
    }

    #[test]
    fn test_pool_state_has_liquidity() {
        let state = PoolState {
            pool_address: Address::zero(),
            slot0: PoolSlot0 {
                sqrt_price_x96: U256::one(),
                tick: 0,
                unlocked: true,
            },
            liquidity: 0,
            token0: Address::zero(),
            token1: Address::zero(),
            fee: 3000,
        };
        assert!(!state.has_liquidity());

        let state_with_liquidity = PoolState {
            liquidity: 1000000,
            ..state
        };
        assert!(state_with_liquidity.has_liquidity());
    }

    #[test]
    fn test_pool_state_fee_tier() {
        let state = PoolState {
            pool_address: Address::zero(),
            slot0: PoolSlot0 {
                sqrt_price_x96: U256::one(),
                tick: 0,
                unlocked: true,
            },
            liquidity: 0,
            token0: Address::zero(),
            token1: Address::zero(),
            fee: 3000,
        };
        assert_eq!(state.fee_tier(), Some(FeeTier::Medium));

        let state_high = PoolState {
            fee: 10000,
            ..state
        };
        assert_eq!(state_high.fee_tier(), Some(FeeTier::High));

        let state_unknown = PoolState {
            fee: 1234,
            ..state
        };
        assert_eq!(state_unknown.fee_tier(), None);
    }
}
