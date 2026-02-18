//! Rate pusher — pushes SERM-computed rates to CuratorRateIRM on-chain
//!
//! Pattern follows OraclePusher in collector.rs for ethers tx construction.
//! Rates are pushed on-demand (not on a cadence):
//! - Before returning a quote (quote API)
//! - Before liquidation (liquidation bot)
//! - On crisis detection (health monitor)

use ethers::prelude::*;
use ethers::types::{Address, TransactionRequest, U256};
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, info};

/// Errors from rate pushing
#[derive(Debug, Error)]
pub enum RatePushError {
    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Transaction failed: {0}")]
    Transaction(String),

    #[error("ABI encoding error: {0}")]
    AbiEncoding(String),
}

/// Pushes rates to CuratorRateIRM contract
pub struct RatePusher {
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,
    irm_address: Address,
}

impl RatePusher {
    pub fn new(
        rpc_url: &str,
        private_key: &str,
        irm_address: Address,
    ) -> Result<Self, RatePushError> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| RatePushError::Provider(format!("Failed to create provider: {}", e)))?;

        let wallet: LocalWallet = private_key
            .parse()
            .map_err(|e| RatePushError::Provider(format!("Failed to parse private key: {}", e)))?;

        Ok(Self {
            provider: Arc::new(provider),
            wallet,
            irm_address,
        })
    }

    /// Read the current rate for a market from CuratorRateIRM
    pub async fn read_current_rate(&self, market_id: [u8; 32]) -> Result<U256, RatePushError> {
        // Function selector for rates(bytes32): keccak256("rates(bytes32)")[:4]
        let selector = &ethers::utils::keccak256(b"rates(bytes32)")[..4];

        let encoded_params = ethers::abi::encode(&[
            ethers::abi::Token::FixedBytes(market_id.to_vec()),
        ]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded_params);

        let tx = TransactionRequest::new()
            .to(self.irm_address)
            .data(calldata);

        let result = self
            .provider
            .call(&tx.into(), None)
            .await
            .map_err(|e| RatePushError::Provider(format!("eth_call failed: {}", e)))?;

        if result.len() < 32 {
            return Ok(U256::zero());
        }

        Ok(U256::from_big_endian(&result))
    }

    /// Read the last rate update timestamp for a market
    pub async fn read_last_update(&self, market_id: [u8; 32]) -> Result<U256, RatePushError> {
        let selector = &ethers::utils::keccak256(b"lastRateUpdate(bytes32)")[..4];

        let encoded_params = ethers::abi::encode(&[
            ethers::abi::Token::FixedBytes(market_id.to_vec()),
        ]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded_params);

        let tx = TransactionRequest::new()
            .to(self.irm_address)
            .data(calldata);

        let result = self
            .provider
            .call(&tx.into(), None)
            .await
            .map_err(|e| RatePushError::Provider(format!("eth_call failed: {}", e)))?;

        if result.len() < 32 {
            return Ok(U256::zero());
        }

        Ok(U256::from_big_endian(&result))
    }

    /// Push a single rate to CuratorRateIRM.setRate(Id, uint256)
    pub async fn push_rate(
        &self,
        market_id: [u8; 32],
        rate_per_second: U256,
    ) -> Result<H256, RatePushError> {
        // Function selector for setRate(bytes32,uint256)
        let selector = &ethers::utils::keccak256(b"setRate(bytes32,uint256)")[..4];

        let encoded_params = ethers::abi::encode(&[
            ethers::abi::Token::FixedBytes(market_id.to_vec()),
            ethers::abi::Token::Uint(rate_per_second),
        ]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded_params);

        self.send_tx(calldata).await
    }

    /// Push rates for multiple markets via CuratorRateIRM.setRates(Id[], uint256[])
    pub async fn push_rates(
        &self,
        market_ids: &[[u8; 32]],
        rates_per_second: &[U256],
    ) -> Result<H256, RatePushError> {
        if market_ids.len() != rates_per_second.len() {
            return Err(RatePushError::AbiEncoding(
                "market_ids and rates arrays must have same length".to_string(),
            ));
        }

        // Function selector for setRates(bytes32[],uint256[])
        let selector = &ethers::utils::keccak256(b"setRates(bytes32[],uint256[])")[..4];

        let ids_tokens: Vec<ethers::abi::Token> = market_ids
            .iter()
            .map(|id| ethers::abi::Token::FixedBytes(id.to_vec()))
            .collect();

        let rates_tokens: Vec<ethers::abi::Token> = rates_per_second
            .iter()
            .map(|r| ethers::abi::Token::Uint(*r))
            .collect();

        let encoded_params = ethers::abi::encode(&[
            ethers::abi::Token::Array(ids_tokens),
            ethers::abi::Token::Array(rates_tokens),
        ]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded_params);

        self.send_tx(calldata).await
    }

    /// Check if rate should be pushed (changed significantly from current on-chain rate)
    pub fn should_push(current_rate: U256, new_rate: U256, threshold_bps: u64) -> bool {
        if current_rate.is_zero() {
            return true; // Always push if no rate set
        }

        // Calculate absolute difference as basis points of current rate
        let diff = if new_rate > current_rate {
            new_rate - current_rate
        } else {
            current_rate - new_rate
        };

        // diff_bps = (diff * 10000) / current_rate
        let diff_bps = (diff * U256::from(10000u64)) / current_rate;
        diff_bps >= U256::from(threshold_bps)
    }

    /// Push rate if it changed significantly, return whether it was pushed
    pub async fn push_rate_if_changed(
        &self,
        market_id: [u8; 32],
        new_rate: U256,
        threshold_bps: u64,
    ) -> Result<Option<H256>, RatePushError> {
        let current = self.read_current_rate(market_id).await?;

        if Self::should_push(current, new_rate, threshold_bps) {
            info!(
                market = hex::encode(market_id),
                current_rate = %current,
                new_rate = %new_rate,
                "Pushing updated rate to CuratorRateIRM"
            );
            let tx_hash = self.push_rate(market_id, new_rate).await?;
            Ok(Some(tx_hash))
        } else {
            debug!(
                market = hex::encode(market_id),
                "Rate unchanged (within threshold), skipping push"
            );
            Ok(None)
        }
    }

    /// Internal: send a transaction with calldata
    async fn send_tx(&self, calldata: Vec<u8>) -> Result<H256, RatePushError> {
        let chain_id = self
            .provider
            .get_chainid()
            .await
            .map_err(|e| RatePushError::Provider(format!("Failed to get chain ID: {}", e)))?;

        let wallet = self.wallet.clone().with_chain_id(chain_id.as_u64());
        let client = SignerMiddleware::new(self.provider.clone(), wallet);

        let tx = TransactionRequest::new()
            .to(self.irm_address)
            .data(calldata);

        let pending_tx = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| RatePushError::Transaction(format!("Failed to send transaction: {}", e)))?;

        let tx_hash = pending_tx.tx_hash();

        let receipt = tokio::time::timeout(Duration::from_secs(60), pending_tx)
            .await
            .map_err(|_| RatePushError::Transaction("Transaction receipt timeout (60s)".to_string()))?
            .map_err(|e| RatePushError::Transaction(format!("Failed to get receipt: {}", e)))?;

        match receipt {
            Some(receipt) => {
                if receipt.status == Some(1.into()) {
                    Ok(tx_hash)
                } else {
                    Err(RatePushError::Transaction(format!(
                        "Transaction reverted: tx={}",
                        tx_hash
                    )))
                }
            }
            None => Err(RatePushError::Transaction(format!(
                "No receipt for tx={}",
                tx_hash
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_push_no_current_rate() {
        assert!(RatePusher::should_push(U256::zero(), U256::from(1000u64), 100));
    }

    #[test]
    fn test_should_push_significant_change() {
        let current = U256::from(1_000_000u64);
        let new_rate = U256::from(1_050_000u64); // 5% higher
        // 5% = 500 bps, threshold 100 bps -> should push
        assert!(RatePusher::should_push(current, new_rate, 100));
    }

    #[test]
    fn test_should_not_push_small_change() {
        let current = U256::from(1_000_000u64);
        let new_rate = U256::from(1_005_000u64); // 0.5% higher
        // 0.5% = 50 bps, threshold 100 bps -> should not push
        assert!(!RatePusher::should_push(current, new_rate, 100));
    }

    #[test]
    fn test_should_push_decrease() {
        let current = U256::from(1_000_000u64);
        let new_rate = U256::from(900_000u64); // 10% lower
        // 10% = 1000 bps, threshold 100 bps -> should push
        assert!(RatePusher::should_push(current, new_rate, 100));
    }

    #[test]
    fn test_should_push_exact_threshold() {
        let current = U256::from(10000u64);
        let new_rate = U256::from(10100u64); // exactly 1% = 100 bps
        assert!(RatePusher::should_push(current, new_rate, 100));
    }

    #[test]
    fn test_should_push_below_threshold() {
        let current = U256::from(10000u64);
        let new_rate = U256::from(10099u64); // 99 bps
        assert!(!RatePusher::should_push(current, new_rate, 100));
    }
}
