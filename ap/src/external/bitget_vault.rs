//! On-chain MockBitgetVault client for E2E testing
//!
//! When both `--mock-bitget` and `--bitget-vault` are set, the AP executes
//! real ERC20 token swaps on-chain via MockBitgetVault.executeTrade().
//!
//! This enables full E2E testing with real token transfers while still using
//! the mock order matching logic.

use ethers::prelude::*;
use ethers::types::U256;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use thiserror::Error;
use tracing::{debug, info};

use common::adapters::abi::{ERC20Contract, MockBitgetVaultContract};
use common::adapters::BitgetVaultFill;

/// Signer type alias
type SignerProvider = SignerMiddleware<Provider<Http>, LocalWallet>;

/// BitgetVault client errors
#[derive(Error, Debug)]
pub enum BitgetVaultError {
    #[error("Failed to create provider: {0}")]
    ProviderError(String),

    #[error("Failed to parse wallet: {0}")]
    WalletError(String),

    #[error("Transaction failed: {0}")]
    TransactionFailed(String),

    #[error("Approval failed: {0}")]
    ApprovalFailed(String),
}

/// On-chain MockBitgetVault client
///
/// Executes real ERC20 token swaps on the MockBitgetVault contract.
pub struct BitgetVaultClient {
    vault_contract: MockBitgetVaultContract<SignerProvider>,
    client: Arc<SignerProvider>,
    vault_address: Address,
    /// Atomic nonce counter for parallel sends (avoids NonceManagerMiddleware init race)
    nonce: AtomicU64,
}

impl BitgetVaultClient {
    /// Create a new BitgetVaultClient
    ///
    /// # Arguments
    /// * `rpc_url` - RPC endpoint URL
    /// * `private_key` - Hex-encoded private key (with or without 0x prefix)
    /// * `vault_address` - MockBitgetVault contract address
    /// * `chain_id` - Chain ID for wallet
    pub fn new(
        rpc_url: &str,
        private_key: &str,
        vault_address: [u8; 20],
        chain_id: u64,
    ) -> Result<Self, BitgetVaultError> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| BitgetVaultError::ProviderError(e.to_string()))?;

        let wallet: LocalWallet = private_key
            .parse()
            .map_err(|e: WalletError| BitgetVaultError::WalletError(e.to_string()))?;
        let wallet = wallet.with_chain_id(chain_id);

        let client = Arc::new(SignerMiddleware::new(provider, wallet));
        let vault_address = Address::from(vault_address);
        let vault_contract = MockBitgetVaultContract::new(vault_address, client.clone());

        Ok(Self {
            vault_contract,
            client,
            vault_address,
            nonce: AtomicU64::new(0),
        })
    }

    /// Initialize the nonce counter from on-chain state.
    /// Must be called once before parallel sends to avoid races.
    pub async fn initialize_nonce(&self) -> Result<(), BitgetVaultError> {
        let addr = self.client.address();
        let count = self.client.get_transaction_count(addr, None)
            .await
            .map_err(|e| BitgetVaultError::ProviderError(format!("nonce fetch: {}", e)))?;
        self.nonce.store(count.as_u64(), Ordering::SeqCst);
        info!(nonce = count.as_u64(), "BitgetVaultClient nonce initialized");
        Ok(())
    }

    /// Get and increment the next nonce atomically
    fn next_nonce(&self) -> U256 {
        U256::from(self.nonce.fetch_add(1, Ordering::SeqCst))
    }

    /// Approve sellToken for the vault to spend
    pub async fn approve_token(
        &self,
        token_address: Address,
        amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        let erc20 = ERC20Contract::new(token_address, self.client.clone());

        // Check current allowance
        let owner = self.client.address();
        let current_allowance = erc20
            .allowance(owner, self.vault_address)
            .call()
            .await
            .map_err(|e| BitgetVaultError::ApprovalFailed(format!("allowance check failed: {}", e)))?;

        if current_allowance >= amount {
            debug!(
                token = ?token_address,
                current_allowance = %current_allowance,
                required = %amount,
                "Token already approved"
            );
            return Ok(TxHash::zero());
        }

        // Approve max uint256 for convenience
        let call = erc20.approve(self.vault_address, U256::MAX).nonce(self.next_nonce());
        let pending = call
            .send()
            .await
            .map_err(|e| BitgetVaultError::ApprovalFailed(format!("approve send failed: {}", e)))?;

        let receipt = pending
            .await
            .map_err(|e| BitgetVaultError::ApprovalFailed(format!("approve receipt failed: {}", e)))?
            .ok_or_else(|| BitgetVaultError::ApprovalFailed("no receipt".to_string()))?;

        info!(
            token = ?token_address,
            tx_hash = ?receipt.transaction_hash,
            "Token approved for MockBitgetVault"
        );

        Ok(receipt.transaction_hash)
    }

    /// Execute a trade on MockBitgetVault
    ///
    /// Vault uses its own balance of sellToken (deposited via custody release).
    /// Bought tokens stay in the vault (simulating CEX internal balance).
    pub async fn execute_trade(
        &self,
        trade_id: u64,
        sell_token: Address,
        buy_token: Address,
        sell_amount: U256,
        buy_amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        // Execute the trade (vault uses its own balance, no approval needed)
        let call = self.vault_contract.execute_trade(
            U256::from(trade_id),
            sell_token,
            buy_token,
            sell_amount,
            buy_amount,
        ).nonce(self.next_nonce());

        let pending = call
            .send()
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("executeTrade send failed: {}", e)))?;

        let receipt = pending
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("executeTrade receipt failed: {}", e)))?
            .ok_or_else(|| BitgetVaultError::TransactionFailed("no receipt".to_string()))?;

        info!(
            trade_id,
            sell_token = ?sell_token,
            buy_token = ?buy_token,
            sell_amount = %sell_amount,
            buy_amount = %buy_amount,
            tx_hash = ?receipt.transaction_hash,
            "Trade executed on MockBitgetVault"
        );

        Ok(receipt.transaction_hash)
    }

    /// Set the price for an asset on MockBitgetVault (Story 7.11)
    ///
    /// Called before trade execution to set real Bitget prices.
    /// Requires the AP to be set as priceSetter on the vault.
    pub async fn set_price(
        &self,
        asset: Address,
        price: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        let call = self.vault_contract.set_price(asset, price).nonce(self.next_nonce());

        let pending = call
            .send()
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("setPrice send failed: {}", e)))?;

        let receipt = pending
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("setPrice receipt failed: {}", e)))?
            .ok_or_else(|| BitgetVaultError::TransactionFailed("no receipt".to_string()))?;

        info!(
            asset = ?asset,
            price = %price,
            tx_hash = ?receipt.transaction_hash,
            "Price set on MockBitgetVault"
        );

        Ok(receipt.transaction_hash)
    }

    /// Get the price for an asset from MockBitgetVault
    pub async fn get_price(&self, asset: Address) -> Result<U256, BitgetVaultError> {
        let price = self
            .vault_contract
            .get_price(asset)
            .call()
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("getPrice failed: {}", e)))?;

        Ok(price)
    }

    /// Swap stablecoins at 1:1 rate on MockBitgetVault (Story 7.18)
    ///
    /// Used when custody release deposits USDC but the trade needs USDT.
    /// Vault swaps internally using its own balance (no approval needed).
    pub async fn swap_stable(
        &self,
        from_token: Address,
        to_token: Address,
        amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        let call = self.vault_contract.swap_stable(from_token, to_token, amount).nonce(self.next_nonce());

        let pending = call
            .send()
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("swapStable send failed: {}", e)))?;

        let receipt = pending
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("swapStable receipt failed: {}", e)))?
            .ok_or_else(|| BitgetVaultError::TransactionFailed("no receipt".to_string()))?;

        info!(
            from_token = ?from_token,
            to_token = ?to_token,
            amount = %amount,
            tx_hash = ?receipt.transaction_hash,
            "Stable swap executed on MockBitgetVault"
        );

        Ok(receipt.transaction_hash)
    }

    /// Withdraw deposited tokens from the vault to the AP
    ///
    /// Called after custody release deposits USDC into the vault.
    /// AP withdraws to hold the tokens before swapStable/executeTrade.
    pub async fn withdraw(
        &self,
        token: Address,
        amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        let call = self.vault_contract.withdraw(token, amount).nonce(self.next_nonce());

        let pending = call
            .send()
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("withdraw send failed: {}", e)))?;

        let receipt = pending
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("withdraw receipt failed: {}", e)))?
            .ok_or_else(|| BitgetVaultError::TransactionFailed("no receipt".to_string()))?;

        info!(
            token = ?token,
            amount = %amount,
            tx_hash = ?receipt.transaction_hash,
            "Withdrawn from MockBitgetVault to AP"
        );

        Ok(receipt.transaction_hash)
    }

    /// Get fill data for a trade (FR13: read-only verification)
    pub async fn get_fill(&self, trade_id: u64) -> Result<BitgetVaultFill, BitgetVaultError> {
        let fill = self
            .vault_contract
            .get_fill(U256::from(trade_id))
            .call()
            .await
            .map_err(|e| BitgetVaultError::TransactionFailed(format!("getFill failed: {}", e)))?;

        Ok(BitgetVaultFill {
            trade_id: fill.0.as_u64(),
            sell_token: fill.1,
            buy_token: fill.2,
            sell_amount: fill.3,
            buy_amount: fill.4,
            trader: fill.5,
            timestamp: fill.6.as_u64(),
        })
    }
}

/// Quote currency for a trading pair (Story 7.18)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuoteCurrency {
    USDC,
    USDT,
}

/// Determine the quote currency from a Bitget symbol suffix (Story 7.18)
///
/// Parses the trading pair symbol to determine settlement currency:
/// - "BTCUSDT", "ETHUSDT" → USDT
/// - "ETHUSDC" → USDC
/// - Unknown suffix → defaults to USDT (Bitget convention)
pub fn quote_currency_for_symbol(symbol: &str) -> QuoteCurrency {
    if symbol.ends_with("USDC") {
        QuoteCurrency::USDC
    } else {
        // Default to USDT (most Bitget pairs are USDT-denominated)
        QuoteCurrency::USDT
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bitget_vault_error_display() {
        let err = BitgetVaultError::TransactionFailed("test error".to_string());
        assert!(err.to_string().contains("test error"));
    }

    #[test]
    fn test_bitget_vault_client_creation_fails_with_invalid_rpc() {
        // Invalid RPC URL should fail
        let result = BitgetVaultClient::new(
            "not-a-valid-url",
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            [0u8; 20],
            111222333,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_bitget_vault_client_creation_fails_with_invalid_key() {
        // Invalid private key should fail
        let result = BitgetVaultClient::new(
            "http://localhost:8545",
            "not-a-valid-key",
            [0u8; 20],
            111222333,
        );
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

    #[test]
    fn test_quote_currency_for_symbol_usdt() {
        assert_eq!(quote_currency_for_symbol("BTCUSDT"), QuoteCurrency::USDT);
        assert_eq!(quote_currency_for_symbol("ETHUSDT"), QuoteCurrency::USDT);
        assert_eq!(quote_currency_for_symbol("ARBUSDT"), QuoteCurrency::USDT);
        assert_eq!(quote_currency_for_symbol("ATOMUSDT"), QuoteCurrency::USDT);
    }

    #[test]
    fn test_quote_currency_for_symbol_usdc() {
        assert_eq!(quote_currency_for_symbol("ETHUSDC"), QuoteCurrency::USDC);
        assert_eq!(quote_currency_for_symbol("BTCUSDC"), QuoteCurrency::USDC);
        assert_eq!(quote_currency_for_symbol("USDCUSDC"), QuoteCurrency::USDC);
    }

    #[test]
    fn test_quote_currency_for_symbol_default_usdt() {
        // Unknown suffix defaults to USDT
        assert_eq!(quote_currency_for_symbol("BTCEUR"), QuoteCurrency::USDT);
        assert_eq!(quote_currency_for_symbol("UNKNOWN"), QuoteCurrency::USDT);
    }
}
