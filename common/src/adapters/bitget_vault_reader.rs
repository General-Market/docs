//! Read-only MockBitgetVault client for fill verification (FR13)
//!
//! Oracles use this to verify fills via on-chain read-only calls to
//! MockBitgetVault.getFill() without direct AP communication.

use ethers::prelude::*;
use ethers::types::{I256, U256};
use std::sync::Arc;
use thiserror::Error;

use super::abi::{ERC20Contract, MockBitgetVaultContract};

/// BitgetVaultReader errors
#[derive(Error, Debug)]
pub enum BitgetVaultReaderError {
    #[error("Failed to create provider: {0}")]
    ProviderError(String),

    #[error("Contract call failed: {0}")]
    ContractCallFailed(String),
}

/// Read-only MockBitgetVault client for fill verification
///
/// Used by oracles to verify fills on-chain (FR13: no direct AP communication).
pub struct BitgetVaultReader {
    vault_contract: MockBitgetVaultContract<Provider<Http>>,
    client: Arc<Provider<Http>>,
}

impl BitgetVaultReader {
    /// Create a new BitgetVaultReader
    ///
    /// # Arguments
    /// * `rpc_url` - RPC endpoint URL
    /// * `vault_address` - MockBitgetVault contract address
    pub fn new(rpc_url: &str, vault_address: [u8; 20]) -> Result<Self, BitgetVaultReaderError> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| BitgetVaultReaderError::ProviderError(e.to_string()))?;

        let client = Arc::new(provider);
        let vault_address = Address::from(vault_address);
        let vault_contract = MockBitgetVaultContract::new(vault_address, client.clone());

        Ok(Self { vault_contract, client })
    }

    /// Get fill data for a trade (FR13: read-only verification)
    ///
    /// Returns None if the trade doesn't exist (trade_id = 0 in response).
    pub async fn get_fill(&self, trade_id: u64) -> Result<Option<BitgetVaultFill>, BitgetVaultReaderError> {
        let fill = self
            .vault_contract
            .get_fill(U256::from(trade_id))
            .call()
            .await
            .map_err(|e| BitgetVaultReaderError::ContractCallFailed(format!("getFill failed: {}", e)))?;

        // Check if trade exists (trade_id in response is 0 for non-existent trades)
        if fill.0.is_zero() && trade_id != 0 {
            return Ok(None);
        }

        Ok(Some(BitgetVaultFill {
            trade_id: fill.0.as_u64(),
            sell_token: fill.1,
            buy_token: fill.2,
            sell_amount: fill.3,
            buy_amount: fill.4,
            trader: fill.5,
            timestamp: fill.6.as_u64(),
        }))
    }

    /// Get the ERC20 balance of a token for a specific account (Story 7.18)
    ///
    /// Used by oracles to verify that the AP actually holds acquired tokens.
    pub async fn get_account_balance(
        &self,
        token: Address,
        account: Address,
    ) -> Result<U256, BitgetVaultReaderError> {
        let erc20 = ERC20Contract::new(token, self.client.clone());
        let balance = erc20
            .balance_of(account)
            .call()
            .await
            .map_err(|e| BitgetVaultReaderError::ContractCallFailed(format!("balanceOf failed: {}", e)))?;
        Ok(balance)
    }

    /// Get net position for a token from MockBitgetVault (Story 7.18)
    ///
    /// Returns cumulative minted minus burned (int256).
    /// Positive = net minted, Negative = net burned.
    pub async fn get_net_position(
        &self,
        token: Address,
    ) -> Result<I256, BitgetVaultReaderError> {
        let position = self
            .vault_contract
            .get_net_position(token)
            .call()
            .await
            .map_err(|e| BitgetVaultReaderError::ContractCallFailed(format!("getNetPosition failed: {}", e)))?;
        Ok(position)
    }

    /// Verify a fill matches expected values
    ///
    /// Returns true if the on-chain fill matches the expected fill data.
    pub async fn verify_fill(
        &self,
        trade_id: u64,
        expected_sell_amount: U256,
        expected_buy_amount: U256,
    ) -> Result<bool, BitgetVaultReaderError> {
        match self.get_fill(trade_id).await? {
            Some(fill) => {
                // Verify amounts match (with some tolerance for rounding)
                let sell_matches = fill.sell_amount == expected_sell_amount;
                let buy_matches = fill.buy_amount == expected_buy_amount;
                Ok(sell_matches && buy_matches)
            }
            None => Ok(false), // Trade doesn't exist
        }
    }
}

/// Fill data from MockBitgetVault
#[derive(Debug, Clone)]
pub struct BitgetVaultFill {
    pub trade_id: u64,
    pub sell_token: Address,
    pub buy_token: Address,
    pub sell_amount: U256,
    pub buy_amount: U256,
    pub trader: Address,
    pub timestamp: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bitget_vault_reader_error_display() {
        let err = BitgetVaultReaderError::ContractCallFailed("test error".to_string());
        assert!(err.to_string().contains("test error"));
    }

    #[test]
    fn test_bitget_vault_reader_creation_fails_with_invalid_rpc() {
        let result = BitgetVaultReader::new("not-a-valid-url", [0u8; 20]);
        assert!(result.is_err());
    }

    #[test]
    fn test_bitget_vault_fill_struct() {
        let fill = BitgetVaultFill {
            trade_id: 42,
            sell_token: Address::zero(),
            buy_token: Address::zero(),
            sell_amount: U256::from(1000),
            buy_amount: U256::from(500),
            trader: Address::zero(),
            timestamp: 1234567890,
        };
        assert_eq!(fill.trade_id, 42);
        assert_eq!(fill.sell_amount, U256::from(1000));
        assert_eq!(fill.buy_amount, U256::from(500));
    }
}
