//! Swap execution orchestrator for same-chain DEX swaps via BLSCustody
//!
//! Coordinates the flow: quote -> calldata -> BLS sign -> execute
//! for DEX-routed merged orders from the netting engine.

use common::integrations::oneinch::{
    CachedQuoteClient, OneInchQuoteClient, OneInchError,
    SwapCalldataBuilder, SwapParams, calculate_min_return, slippage_tier_to_bps,
};
use ethers::types::{Address, H256, U256};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, info, warn};

use crate::chain::custody_writer::{CustodyWriter, CustodyWriterError};

/// 1inch Router V6 address (same on all EVM chains)
pub const ONEINCH_ROUTER_V6: &str = "0x111111125421cA6dc452d289314280a0f8842A65";

/// Default swap timeout (30 minutes per architecture Section 16)
const SWAP_TIMEOUT_SECS: u64 = 1800;

/// Errors from swap orchestration
#[derive(Debug, Error)]
pub enum SwapError {
    /// Quote fetch failed
    #[error("Quote failed for {from_token} -> {to_token}: {reason}")]
    QuoteFailed {
        from_token: String,
        to_token: String,
        reason: String,
    },

    /// Calldata build failed
    #[error("Calldata build failed: {0}")]
    CalldataBuildFailed(String),

    /// BLS signing failed
    #[error("BLS signing failed: {0}")]
    BLSSigningFailed(String),

    /// Custody execution failed
    #[error("Custody execution failed: {0}")]
    ExecutionFailed(String),

    /// Swap timeout
    #[error("Swap timed out after {timeout_secs}s")]
    Timeout { timeout_secs: u64 },

    /// 1inch error
    #[error("1inch API error: {0}")]
    OneInchError(#[from] OneInchError),

    /// Custody writer error
    #[error("Custody writer error: {0}")]
    CustodyError(#[from] CustodyWriterError),
}

/// Result of a swap execution
#[derive(Debug, Clone)]
pub struct SwapResult {
    /// Transaction hash on Settlement chain
    pub tx_hash: H256,
    /// Source token
    pub from_token: Address,
    /// Destination token
    pub to_token: Address,
    /// Amount swapped (in smallest units)
    pub amount: U256,
    /// Expected output from quote
    pub expected_output: String,
    /// Nonce used
    pub nonce: U256,
    /// Whether this used degraded (on-chain) pricing
    pub degraded_quotes: bool,
}

/// Configuration for the swap orchestrator
#[derive(Debug, Clone)]
pub struct SwapOrchestratorConfig {
    /// Swap timeout in seconds (default: 1800 = 30 minutes)
    pub timeout_secs: u64,
    /// Default slippage tier (0=0.3%, 1=1%, 2=3%)
    pub default_slippage_tier: u8,
}

impl Default for SwapOrchestratorConfig {
    fn default() -> Self {
        Self {
            timeout_secs: SWAP_TIMEOUT_SECS,
            default_slippage_tier: 1, // 1% default
        }
    }
}

/// Request to execute a swap
#[derive(Debug, Clone)]
pub struct SwapRequest {
    /// Source token address string (for 1inch API)
    pub from_token: String,
    /// Destination token address string (for 1inch API)
    pub to_token: String,
    /// Amount in smallest units
    pub amount: String,
    /// Source token on-chain address
    pub from_address: Address,
    /// Destination token on-chain address
    pub to_address: Address,
    /// Slippage tier (0=0.3%, 1=1%, 2=3%)
    pub slippage_tier: u8,
}

/// Swap execution orchestrator
///
/// Coordinates: quote -> calldata -> BLS sign -> execute for same-chain DEX swaps
pub struct SwapOrchestrator {
    /// Cached quote client for pricing
    cached_client: Arc<CachedQuoteClient<OneInchQuoteClient>>,
    /// Swap calldata builder
    calldata_builder: Arc<SwapCalldataBuilder>,
    /// Custody writer for Settlement chain BLSCustody execution
    custody_writer: Arc<CustodyWriter>,
    /// Configuration
    config: SwapOrchestratorConfig,
    /// Successful swap count
    success_count: AtomicU64,
    /// Failed swap count
    failure_count: AtomicU64,
}

impl SwapOrchestrator {
    /// Create a new swap orchestrator
    pub fn new(
        cached_client: Arc<CachedQuoteClient<OneInchQuoteClient>>,
        calldata_builder: Arc<SwapCalldataBuilder>,
        custody_writer: Arc<CustodyWriter>,
        config: SwapOrchestratorConfig,
    ) -> Self {
        Self {
            cached_client,
            calldata_builder,
            custody_writer,
            config,
            success_count: AtomicU64::new(0),
            failure_count: AtomicU64::new(0),
        }
    }

    /// Get the number of successful swaps
    pub fn success_count(&self) -> u64 {
        self.success_count.load(Ordering::Relaxed)
    }

    /// Get the number of failed swaps
    pub fn failure_count(&self) -> u64 {
        self.failure_count.load(Ordering::Relaxed)
    }

    /// Execute a swap for a DEX-routed merged order
    ///
    /// Flow:
    /// 1. Get quote from 1inch (cached)
    /// 2. Build swap calldata via SwapCalldataBuilder
    /// 3. Wrap calldata for BLSCustody.execute()
    /// 4. BLS sign the message (via consensus)
    /// 5. Submit via CustodyWriter
    pub async fn execute_swap(
        &self,
        request: &SwapRequest,
        bls_signature: &[u8],
    ) -> Result<SwapResult, SwapError> {
        let custody_address = self.custody_writer.custody_address();

        info!(
            from = %request.from_token,
            to = %request.to_token,
            amount = %request.amount,
            "Starting swap execution"
        );

        // Step 1: Get quote
        let quote = self
            .cached_client
            .get_quote(
                &request.from_token,
                &request.to_token,
                &request.amount,
                common::integrations::oneinch::SupportedChain::Arbitrum,
            )
            .await
            .map_err(|e| SwapError::QuoteFailed {
                from_token: request.from_token.clone(),
                to_token: request.to_token.clone(),
                reason: e.to_string(),
            })?;

        debug!(
            to_amount = %quote.to_amount,
            gas = quote.estimated_gas,
            "Quote received"
        );

        // Step 2: Calculate min return with slippage protection
        let expected_output: U256 = quote.to_amount.parse().unwrap_or(U256::zero());
        let slippage_bps = slippage_tier_to_bps(request.slippage_tier);
        let min_return = calculate_min_return(expected_output, slippage_bps);

        // Step 3: Build swap calldata
        let swap_params = SwapParams::new(
            request.from_token.clone(),
            request.to_token.clone(),
            request.amount.clone(),
            min_return.to_string(),
            format!("{:?}", custody_address),
        );

        let calldata = self
            .calldata_builder
            .build_swap(&swap_params)
            .await
            .map_err(|e| SwapError::CalldataBuildFailed(e.to_string()))?;

        // Step 4: Wrap for BLSCustody.execute()
        let nonce = self.custody_writer.next_nonce();
        let custody_params = self.calldata_builder.encode_for_custody(&calldata, nonce);

        debug!(
            target = ?custody_params.target,
            nonce = %nonce,
            calldata_len = calldata.len(),
            message_hash = ?hex::encode(custody_params.message_to_sign),
            "Custody params prepared"
        );

        // Step 5: Submit via CustodyWriter
        let tx_hash = self
            .custody_writer
            .execute_swap(
                custody_params.target,
                &custody_params.data,
                bls_signature,
                nonce,
            )
            .await?;

        let amount: U256 = request.amount.parse().unwrap_or(U256::zero());
        self.success_count.fetch_add(1, Ordering::Relaxed);

        info!(
            tx_hash = ?tx_hash,
            from = %request.from_token,
            to = %request.to_token,
            amount = %amount,
            expected_output = %quote.to_amount,
            "Swap executed successfully"
        );

        Ok(SwapResult {
            tx_hash,
            from_token: request.from_address,
            to_token: request.to_address,
            amount,
            expected_output: quote.to_amount,
            nonce,
            degraded_quotes: false,
        })
    }

    /// Monitor swap confirmation and handle rollback (30 min timeout per architecture Section 16)
    ///
    /// Polls the Settlement chain for the transaction receipt. If the transaction is not
    /// confirmed within the configured timeout, returns a timeout error signaling that
    /// the caller should initiate a refund. If the transaction reverts, returns an
    /// execution error.
    pub async fn handle_rollback(&self, tx_hash: H256) -> Result<(), SwapError> {
        let timeout = Duration::from_secs(self.config.timeout_secs);
        let poll_interval = Duration::from_secs(5);
        let start = std::time::Instant::now();

        info!(
            tx_hash = ?tx_hash,
            timeout_secs = self.config.timeout_secs,
            "Monitoring swap confirmation on Settlement chain"
        );

        loop {
            if start.elapsed() > timeout {
                self.failure_count.fetch_add(1, Ordering::Relaxed);
                warn!(
                    tx_hash = ?tx_hash,
                    elapsed_secs = start.elapsed().as_secs(),
                    "Swap rollback: timeout exceeded, initiating refund"
                );
                return Err(SwapError::Timeout {
                    timeout_secs: self.config.timeout_secs,
                });
            }

            match self.custody_writer.check_receipt(tx_hash).await {
                Ok(Some(true)) => {
                    info!(tx_hash = ?tx_hash, "Swap confirmed on Settlement chain");
                    return Ok(());
                }
                Ok(Some(false)) => {
                    self.failure_count.fetch_add(1, Ordering::Relaxed);
                    warn!(tx_hash = ?tx_hash, "Swap transaction reverted on Settlement chain");
                    return Err(SwapError::ExecutionFailed(
                        "Transaction reverted on-chain".to_string(),
                    ));
                }
                Ok(None) => {
                    debug!(tx_hash = ?tx_hash, "Swap not yet confirmed, polling...");
                }
                Err(e) => {
                    warn!(tx_hash = ?tx_hash, error = %e, "Failed to check swap receipt");
                }
            }

            tokio::time::sleep(poll_interval).await;
        }
    }
}

impl std::fmt::Debug for SwapOrchestrator {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SwapOrchestrator")
            .field("config", &self.config)
            .field("success_count", &self.success_count())
            .field("failure_count", &self.failure_count())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = SwapOrchestratorConfig::default();
        assert_eq!(config.timeout_secs, 1800);
        assert_eq!(config.default_slippage_tier, 1);
    }

    #[test]
    fn test_swap_request() {
        let request = SwapRequest {
            from_token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831".to_string(),
            to_token: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1".to_string(),
            amount: "1000000000".to_string(),
            from_address: Address::zero(),
            to_address: Address::zero(),
            slippage_tier: 1,
        };

        assert_eq!(request.slippage_tier, 1);
        assert_eq!(request.amount, "1000000000");
    }

    #[test]
    fn test_swap_result() {
        let result = SwapResult {
            tx_hash: H256::zero(),
            from_token: Address::zero(),
            to_token: Address::zero(),
            amount: U256::from(1000000000u64),
            expected_output: "999500000000000000".to_string(),
            nonce: U256::from(0),
            degraded_quotes: false,
        };

        assert!(!result.degraded_quotes);
        assert_eq!(result.nonce, U256::from(0));
    }

    #[test]
    fn test_slippage_calculation() {
        // 1% slippage on 1 ETH quote
        let expected = U256::from(1_000_000_000_000_000_000u128);
        let min = calculate_min_return(expected, 100);
        assert_eq!(min, U256::from(990_000_000_000_000_000u128));

        // 0.3% slippage
        let min_low = calculate_min_return(expected, 30);
        assert_eq!(min_low, U256::from(997_000_000_000_000_000u128));
    }

    #[test]
    fn test_slippage_tiers() {
        assert_eq!(slippage_tier_to_bps(0), 30);  // 0.3%
        assert_eq!(slippage_tier_to_bps(1), 100); // 1%
        assert_eq!(slippage_tier_to_bps(2), 300); // 3%
    }

    #[test]
    fn test_swap_error_display() {
        let err = SwapError::QuoteFailed {
            from_token: "USDC".to_string(),
            to_token: "WETH".to_string(),
            reason: "rate limited".to_string(),
        };
        assert!(err.to_string().contains("USDC"));
        assert!(err.to_string().contains("WETH"));

        let err = SwapError::Timeout { timeout_secs: 1800 };
        assert!(err.to_string().contains("1800"));
    }

    #[test]
    fn test_1inch_router_address() {
        let addr: Address = ONEINCH_ROUTER_V6.parse().unwrap();
        assert_ne!(addr, Address::zero());
    }
}
