//! On-chain MockBitgetVault client for E2E testing
//!
//! When both `--mock-bitget` and `--bitget-vault` are set, the AP executes
//! real ERC20 token swaps on-chain via MockBitgetVault.executeTrade().
//!
//! This enables full E2E testing with real token transfers while still using
//! the mock order matching logic.
//!
//! All settlement RPC operations retry on connection errors with exponential
//! backoff (1s, 2s, 4s) up to 3 attempts before returning the error.

use ethers::prelude::*;
use ethers::types::U256;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, info, warn, error};

use common::adapters::abi::{ERC20Contract, MockBitgetVaultContract};
use common::adapters::BitgetVaultFill;

const GAS_LIMIT_APPROVE: u64 = 100_000;
const GAS_LIMIT_TRADE: u64 = 500_000;
const GAS_LIMIT_SET_PRICE: u64 = 100_000;
const GAS_LIMIT_SWAP: u64 = 300_000;
const GAS_LIMIT_WITHDRAW: u64 = 200_000;

/// Maximum retries for settlement RPC connection errors
const SETTLEMENT_RPC_MAX_RETRIES: u32 = 3;
/// Base delay for exponential backoff (1s, 2s, 4s)
const SETTLEMENT_RPC_BASE_DELAY_MS: u64 = 1000;

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

impl BitgetVaultError {
    /// Returns true if this error likely stems from a dead or unreachable RPC connection.
    /// Transport-level failures, timeouts, and DNS errors are retriable.
    /// Contract reverts and wallet parse errors are not.
    pub fn is_connection_error(&self) -> bool {
        let msg = self.to_string().to_lowercase();
        msg.contains("connection refused")
            || msg.contains("connection reset")
            || msg.contains("broken pipe")
            || msg.contains("timed out")
            || msg.contains("timeout")
            || msg.contains("dns error")
            || msg.contains("eof")
            || msg.contains("hyper")
            || msg.contains("transport")
            || msg.contains("connection closed")
            || msg.contains("unreachable")
            // Provider-level errors generally indicate RPC is down
            || matches!(self, BitgetVaultError::ProviderError(_))
    }
}

/// Log a retry attempt and sleep for exponential backoff.
/// Returns the delay used (for testing/observability).
async fn backoff_delay(op: &str, attempt: u32, err: &BitgetVaultError) -> u64 {
    let delay_ms = SETTLEMENT_RPC_BASE_DELAY_MS * (1u64 << attempt);
    warn!(
        op,
        attempt = attempt + 1,
        max_retries = SETTLEMENT_RPC_MAX_RETRIES,
        delay_ms,
        error = %err,
        "Settlement RPC connection error, retrying"
    );
    tokio::time::sleep(Duration::from_millis(delay_ms)).await;
    delay_ms
}

/// Log a final failure after all retries exhausted.
fn log_retry_exhausted(op: &str, attempts: u32, err: &BitgetVaultError) {
    error!(
        op,
        attempts,
        error = %err,
        "Settlement RPC operation failed after all retries"
    );
}

/// On-chain MockBitgetVault client
///
/// Executes real ERC20 token swaps on the MockBitgetVault contract.
/// All RPC operations retry on connection errors with exponential backoff.
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

    /// Test settlement RPC connectivity by fetching the current block number.
    /// Returns the block number on success, or a ProviderError if the RPC is unreachable.
    pub async fn health_check(&self) -> Result<u64, BitgetVaultError> {
        let block = self.client.get_block_number()
            .await
            .map_err(|e| BitgetVaultError::ProviderError(format!("health check failed: {}", e)))?;
        debug!(block = block.as_u64(), "Settlement RPC health check passed");
        Ok(block.as_u64())
    }

    /// Get and increment the next nonce atomically
    fn next_nonce(&self) -> U256 {
        U256::from(self.nonce.fetch_add(1, Ordering::SeqCst))
    }

    /// Decrement the nonce counter (undo a next_nonce that was never sent on-chain)
    fn rollback_nonce(&self) {
        self.nonce.fetch_sub(1, Ordering::SeqCst);
    }

    /// Approve sellToken for the vault to spend.
    /// Retries on settlement RPC connection errors with exponential backoff.
    pub async fn approve_token(
        &self,
        token_address: Address,
        amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        for attempt in 0..=SETTLEMENT_RPC_MAX_RETRIES {
            let result = self.approve_token_once(token_address, amount).await;
            match result {
                Ok(val) => {
                    if attempt > 0 {
                        info!(op = "approve_token", attempt, "Settlement RPC reconnected after retry");
                    }
                    return Ok(val);
                }
                Err(e) => {
                    if !e.is_connection_error() || attempt == SETTLEMENT_RPC_MAX_RETRIES {
                        if attempt > 0 { log_retry_exhausted("approve_token", attempt + 1, &e); }
                        return Err(e);
                    }
                    backoff_delay("approve_token", attempt, &e).await;
                }
            }
        }
        unreachable!()
    }

    /// Single attempt at approve_token (no retry).
    async fn approve_token_once(
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
        let nonce = self.next_nonce();
        let call = erc20.approve(self.vault_address, U256::MAX)
            .nonce(nonce)
            .gas(GAS_LIMIT_APPROVE);
        let pending = match call.send().await {
            Ok(p) => p,
            Err(e) => {
                let err = BitgetVaultError::ApprovalFailed(format!("approve send failed: {}", e));
                if err.is_connection_error() {
                    self.rollback_nonce();
                }
                return Err(err);
            }
        };

        let receipt = match pending.await {
            Ok(Some(r)) => r,
            Ok(None) => {
                warn!("approve sent but no receipt returned, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::ApprovalFailed("no receipt".to_string()));
            }
            Err(e) => {
                warn!(error = %e, "approve receipt failed, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::ApprovalFailed(format!("approve receipt failed: {}", e)));
            }
        };

        if receipt.status == Some(ethers::types::U64::from(0)) {
            return Err(BitgetVaultError::TransactionFailed(format!("tx reverted: {:?}", receipt.transaction_hash)));
        }

        info!(
            token = ?token_address,
            tx_hash = ?receipt.transaction_hash,
            "Token approved for MockBitgetVault"
        );

        Ok(receipt.transaction_hash)
    }

    /// Execute a trade on MockBitgetVault.
    /// Retries on settlement RPC connection errors with exponential backoff.
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
        for attempt in 0..=SETTLEMENT_RPC_MAX_RETRIES {
            let result = self.execute_trade_once(
                trade_id, sell_token, buy_token, sell_amount, buy_amount,
            ).await;
            match result {
                Ok(val) => {
                    if attempt > 0 {
                        info!(op = "execute_trade", attempt, "Settlement RPC reconnected after retry");
                    }
                    return Ok(val);
                }
                Err(e) => {
                    if !e.is_connection_error() || attempt == SETTLEMENT_RPC_MAX_RETRIES {
                        if attempt > 0 { log_retry_exhausted("execute_trade", attempt + 1, &e); }
                        return Err(e);
                    }
                    backoff_delay("execute_trade", attempt, &e).await;
                }
            }
        }
        unreachable!()
    }

    /// Single attempt at execute_trade (no retry).
    async fn execute_trade_once(
        &self,
        trade_id: u64,
        sell_token: Address,
        buy_token: Address,
        sell_amount: U256,
        buy_amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        let nonce = self.next_nonce();
        let call = self.vault_contract.execute_trade(
            U256::from(trade_id),
            sell_token,
            buy_token,
            sell_amount,
            buy_amount,
        ).nonce(nonce).gas(GAS_LIMIT_TRADE);

        let pending = match call.send().await {
            Ok(p) => p,
            Err(e) => {
                let err = BitgetVaultError::TransactionFailed(format!("executeTrade send failed: {}", e));
                if err.is_connection_error() {
                    self.rollback_nonce();
                }
                return Err(err);
            }
        };

        let receipt = match pending.await {
            Ok(Some(r)) => r,
            Ok(None) => {
                // Transaction sent but no receipt — nonce consumed on-chain, resync
                warn!("executeTrade sent but no receipt returned, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::TransactionFailed("no receipt".to_string()));
            }
            Err(e) => {
                // Receipt timeout/error — tx may have landed on-chain, resync nonce
                warn!(error = %e, "executeTrade receipt failed, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::TransactionFailed(format!("executeTrade receipt failed: {}", e)));
            }
        };

        if receipt.status == Some(ethers::types::U64::from(0)) {
            return Err(BitgetVaultError::TransactionFailed(format!("tx reverted: {:?}", receipt.transaction_hash)));
        }

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

    /// Set the price for an asset on MockBitgetVault (Story 7.11).
    /// Retries on settlement RPC connection errors with exponential backoff.
    ///
    /// Called before trade execution to set real Bitget prices.
    /// Requires the AP to be set as priceSetter on the vault.
    pub async fn set_price(
        &self,
        asset: Address,
        price: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        for attempt in 0..=SETTLEMENT_RPC_MAX_RETRIES {
            let result = self.set_price_once(asset, price).await;
            match result {
                Ok(val) => {
                    if attempt > 0 {
                        info!(op = "set_price", attempt, "Settlement RPC reconnected after retry");
                    }
                    return Ok(val);
                }
                Err(e) => {
                    if !e.is_connection_error() || attempt == SETTLEMENT_RPC_MAX_RETRIES {
                        if attempt > 0 { log_retry_exhausted("set_price", attempt + 1, &e); }
                        return Err(e);
                    }
                    backoff_delay("set_price", attempt, &e).await;
                }
            }
        }
        unreachable!()
    }

    /// Single attempt at set_price (no retry).
    async fn set_price_once(
        &self,
        asset: Address,
        price: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        let nonce = self.next_nonce();
        let call = self.vault_contract.set_price(asset, price)
            .nonce(nonce)
            .gas(GAS_LIMIT_SET_PRICE);

        let pending = match call.send().await {
            Ok(p) => p,
            Err(e) => {
                let err = BitgetVaultError::TransactionFailed(format!("setPrice send failed: {}", e));
                if err.is_connection_error() {
                    self.rollback_nonce();
                }
                return Err(err);
            }
        };

        let receipt = match pending.await {
            Ok(Some(r)) => r,
            Ok(None) => {
                warn!("setPrice sent but no receipt returned, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::TransactionFailed("no receipt".to_string()));
            }
            Err(e) => {
                warn!(error = %e, "setPrice receipt failed, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::TransactionFailed(format!("setPrice receipt failed: {}", e)));
            }
        };

        if receipt.status == Some(ethers::types::U64::from(0)) {
            return Err(BitgetVaultError::TransactionFailed(format!("tx reverted: {:?}", receipt.transaction_hash)));
        }

        info!(
            asset = ?asset,
            price = %price,
            tx_hash = ?receipt.transaction_hash,
            "Price set on MockBitgetVault"
        );

        Ok(receipt.transaction_hash)
    }

    /// Get the price for an asset from MockBitgetVault.
    /// Retries on settlement RPC connection errors with exponential backoff.
    pub async fn get_price(&self, asset: Address) -> Result<U256, BitgetVaultError> {
        for attempt in 0..=SETTLEMENT_RPC_MAX_RETRIES {
            let result = self.vault_contract
                .get_price(asset)
                .call()
                .await
                .map_err(|e| BitgetVaultError::TransactionFailed(format!("getPrice failed: {}", e)));
            match result {
                Ok(val) => {
                    if attempt > 0 {
                        info!(op = "get_price", attempt, "Settlement RPC reconnected after retry");
                    }
                    return Ok(val);
                }
                Err(e) => {
                    if !e.is_connection_error() || attempt == SETTLEMENT_RPC_MAX_RETRIES {
                        if attempt > 0 { log_retry_exhausted("get_price", attempt + 1, &e); }
                        return Err(e);
                    }
                    backoff_delay("get_price", attempt, &e).await;
                }
            }
        }
        unreachable!()
    }

    /// Swap stablecoins at 1:1 rate on MockBitgetVault (Story 7.18).
    /// Retries on settlement RPC connection errors with exponential backoff.
    ///
    /// Used when custody release deposits USDC but the trade needs USDT.
    /// Vault swaps internally using its own balance (no approval needed).
    pub async fn swap_stable(
        &self,
        from_token: Address,
        to_token: Address,
        amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        for attempt in 0..=SETTLEMENT_RPC_MAX_RETRIES {
            let result = self.swap_stable_once(from_token, to_token, amount).await;
            match result {
                Ok(val) => {
                    if attempt > 0 {
                        info!(op = "swap_stable", attempt, "Settlement RPC reconnected after retry");
                    }
                    return Ok(val);
                }
                Err(e) => {
                    if !e.is_connection_error() || attempt == SETTLEMENT_RPC_MAX_RETRIES {
                        if attempt > 0 { log_retry_exhausted("swap_stable", attempt + 1, &e); }
                        return Err(e);
                    }
                    backoff_delay("swap_stable", attempt, &e).await;
                }
            }
        }
        unreachable!()
    }

    /// Single attempt at swap_stable (no retry).
    async fn swap_stable_once(
        &self,
        from_token: Address,
        to_token: Address,
        amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        let nonce = self.next_nonce();
        let call = self.vault_contract.swap_stable(from_token, to_token, amount)
            .nonce(nonce)
            .gas(GAS_LIMIT_SWAP);

        let pending = match call.send().await {
            Ok(p) => p,
            Err(e) => {
                let err = BitgetVaultError::TransactionFailed(format!("swapStable send failed: {}", e));
                if err.is_connection_error() {
                    self.rollback_nonce();
                }
                return Err(err);
            }
        };

        let receipt = match pending.await {
            Ok(Some(r)) => r,
            Ok(None) => {
                warn!("swapStable sent but no receipt returned, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::TransactionFailed("no receipt".to_string()));
            }
            Err(e) => {
                warn!(error = %e, "swapStable receipt failed, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::TransactionFailed(format!("swapStable receipt failed: {}", e)));
            }
        };

        if receipt.status == Some(ethers::types::U64::from(0)) {
            return Err(BitgetVaultError::TransactionFailed(format!("tx reverted: {:?}", receipt.transaction_hash)));
        }

        info!(
            from_token = ?from_token,
            to_token = ?to_token,
            amount = %amount,
            tx_hash = ?receipt.transaction_hash,
            "Stable swap executed on MockBitgetVault"
        );

        Ok(receipt.transaction_hash)
    }

    /// Withdraw deposited tokens from the vault to the AP.
    /// Retries on settlement RPC connection errors with exponential backoff.
    ///
    /// Called after custody release deposits USDC into the vault.
    /// AP withdraws to hold the tokens before swapStable/executeTrade.
    pub async fn withdraw(
        &self,
        token: Address,
        amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        for attempt in 0..=SETTLEMENT_RPC_MAX_RETRIES {
            let result = self.withdraw_once(token, amount).await;
            match result {
                Ok(val) => {
                    if attempt > 0 {
                        info!(op = "withdraw", attempt, "Settlement RPC reconnected after retry");
                    }
                    return Ok(val);
                }
                Err(e) => {
                    if !e.is_connection_error() || attempt == SETTLEMENT_RPC_MAX_RETRIES {
                        if attempt > 0 { log_retry_exhausted("withdraw", attempt + 1, &e); }
                        return Err(e);
                    }
                    backoff_delay("withdraw", attempt, &e).await;
                }
            }
        }
        unreachable!()
    }

    /// Single attempt at withdraw (no retry).
    async fn withdraw_once(
        &self,
        token: Address,
        amount: U256,
    ) -> Result<TxHash, BitgetVaultError> {
        let nonce = self.next_nonce();
        let call = self.vault_contract.withdraw(token, amount)
            .nonce(nonce)
            .gas(GAS_LIMIT_WITHDRAW);

        let pending = match call.send().await {
            Ok(p) => p,
            Err(e) => {
                let err = BitgetVaultError::TransactionFailed(format!("withdraw send failed: {}", e));
                if err.is_connection_error() {
                    self.rollback_nonce();
                }
                return Err(err);
            }
        };

        let receipt = match pending.await {
            Ok(Some(r)) => r,
            Ok(None) => {
                warn!("withdraw sent but no receipt returned, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::TransactionFailed("no receipt".to_string()));
            }
            Err(e) => {
                warn!(error = %e, "withdraw receipt failed, resyncing nonce");
                let _ = self.resync_nonce().await;
                return Err(BitgetVaultError::TransactionFailed(format!("withdraw receipt failed: {}", e)));
            }
        };

        if receipt.status == Some(ethers::types::U64::from(0)) {
            return Err(BitgetVaultError::TransactionFailed(format!("tx reverted: {:?}", receipt.transaction_hash)));
        }

        info!(
            token = ?token,
            amount = %amount,
            tx_hash = ?receipt.transaction_hash,
            "Withdrawn from MockBitgetVault to AP"
        );

        Ok(receipt.transaction_hash)
    }

    /// Re-synchronize the local nonce counter from on-chain pending count.
    pub async fn resync_nonce(&self) -> Result<(), BitgetVaultError> {
        let addr = self.client.address();
        let count = self.client.get_transaction_count(addr, Some(ethers::types::BlockId::Number(ethers::types::BlockNumber::Pending)))
            .await
            .map_err(|e| BitgetVaultError::ProviderError(format!("nonce resync: {}", e)))?;
        let old = self.nonce.swap(count.as_u64(), Ordering::SeqCst);
        tracing::warn!(old_nonce = old, new_nonce = count.as_u64(), "Nonce resynced from chain");
        Ok(())
    }

    /// Get fill data for a trade (FR13: read-only verification).
    /// Retries on settlement RPC connection errors with exponential backoff.
    pub async fn get_fill(&self, trade_id: u64) -> Result<BitgetVaultFill, BitgetVaultError> {
        for attempt in 0..=SETTLEMENT_RPC_MAX_RETRIES {
            let result = self.vault_contract
                .get_fill(U256::from(trade_id))
                .call()
                .await
                .map_err(|e| BitgetVaultError::TransactionFailed(format!("getFill failed: {}", e)));
            match result {
                Ok(fill) => {
                    if attempt > 0 {
                        info!(op = "get_fill", attempt, "Settlement RPC reconnected after retry");
                    }
                    return Ok(BitgetVaultFill {
                        trade_id: fill.trade_id.as_u64(),
                        sell_token: fill.sell_token,
                        buy_token: fill.buy_token,
                        sell_amount: fill.sell_amount,
                        buy_amount: fill.buy_amount,
                        trader: fill.trader,
                        timestamp: fill.timestamp.as_u64(),
                    });
                }
                Err(e) => {
                    if !e.is_connection_error() || attempt == SETTLEMENT_RPC_MAX_RETRIES {
                        if attempt > 0 { log_retry_exhausted("get_fill", attempt + 1, &e); }
                        return Err(e);
                    }
                    backoff_delay("get_fill", attempt, &e).await;
                }
            }
        }
        unreachable!()
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

    #[test]
    fn test_connection_error_classification() {
        // Connection-level errors should be classified as retriable
        assert!(BitgetVaultError::ProviderError("anything".into()).is_connection_error());
        assert!(BitgetVaultError::TransactionFailed("connection refused".into()).is_connection_error());
        assert!(BitgetVaultError::TransactionFailed("timed out".into()).is_connection_error());
        assert!(BitgetVaultError::TransactionFailed("dns error".into()).is_connection_error());
        assert!(BitgetVaultError::ApprovalFailed("connection reset".into()).is_connection_error());
        assert!(BitgetVaultError::TransactionFailed("hyper error".into()).is_connection_error());

        // Contract-level errors should NOT be retriable
        assert!(!BitgetVaultError::TransactionFailed("tx reverted: 0x1234".into()).is_connection_error());
        assert!(!BitgetVaultError::WalletError("invalid key".into()).is_connection_error());
        assert!(!BitgetVaultError::TransactionFailed("execution reverted".into()).is_connection_error());
        assert!(!BitgetVaultError::ApprovalFailed("no receipt".into()).is_connection_error());
    }
}
