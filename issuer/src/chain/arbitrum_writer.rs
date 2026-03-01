//! Arbitrum Chain Writer for BridgeProxy transactions (Story 6.21)
//!
//! Provides functionality to submit transactions to the BridgeProxy contract on Arbitrum,
//! specifically `completeCreateItp()` for finalizing cross-chain ITP creation.

use std::sync::Arc;

use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use tracing::{debug, info, warn};

use super::gas::{GasConfig, GasEstimator};
use super::nonce::NonceManager;
use super::retry::{with_retry, RetryConfig};

/// Configuration for ArbitrumChainWriter
#[derive(Debug, Clone)]
pub struct ArbitrumChainWriterConfig {
    /// Arbitrum RPC endpoint URL
    pub rpc_url: String,
    /// BridgeProxy contract address
    pub bridge_proxy_address: Address,
    /// ArbBridgeCustody contract address (for cross-chain sell order completion)
    pub arb_custody_address: Address,
    /// Chain ID (42161 for Arbitrum One)
    pub chain_id: u64,
    /// Gas configuration
    pub gas_config: GasConfig,
    /// Retry configuration
    pub retry_config: RetryConfig,
}

impl Default for ArbitrumChainWriterConfig {
    fn default() -> Self {
        Self {
            rpc_url: "https://arb1.arbitrum.io/rpc".to_string(),
            bridge_proxy_address: Address::zero(),
            arb_custody_address: Address::zero(),
            chain_id: 42161,
            gas_config: GasConfig::default(),
            retry_config: RetryConfig::default(),
        }
    }
}

/// Type alias for the signer middleware
pub type ArbitrumSignerClient = SignerMiddleware<Provider<Http>, LocalWallet>;

/// Arbitrum Chain Writer for BridgeProxy transactions
///
/// Submits transactions to the BridgeProxy contract on Arbitrum with:
/// - Nonce management for concurrent submissions
/// - Gas estimation with configurable multiplier
/// - Retry logic with exponential backoff
pub struct ArbitrumChainWriter {
    /// Signer middleware (provider + wallet)
    client: Arc<ArbitrumSignerClient>,
    /// Configuration
    config: ArbitrumChainWriterConfig,
    /// Nonce manager
    nonce_manager: NonceManager,
    /// Gas estimator
    gas_estimator: GasEstimator<ArbitrumSignerClient>,
}

impl ArbitrumChainWriter {
    /// Create a new ArbitrumChainWriter
    ///
    /// # Arguments
    /// * `config` - Configuration including RPC URL and contract addresses
    /// * `private_key` - Hex-encoded private key (with or without 0x prefix)
    ///
    /// # Errors
    /// Returns error if unable to connect to RPC endpoint or parse private key
    pub fn new(
        config: ArbitrumChainWriterConfig,
        private_key: &str,
    ) -> Result<Self, ArbitrumWriterError> {
        let provider = Provider::<Http>::try_from(&config.rpc_url)
            .map_err(|e| ArbitrumWriterError::ProviderError(format!("Failed to create provider: {}", e)))?;

        // Parse private key (handle both with and without 0x prefix)
        let key_hex = private_key.trim_start_matches("0x");
        let wallet: LocalWallet = key_hex
            .parse::<LocalWallet>()
            .map_err(|e| ArbitrumWriterError::KeyError(format!("Failed to parse private key: {}", e)))?
            .with_chain_id(config.chain_id);

        let address = wallet.address();
        let provider_arc = Arc::new(provider);
        let client = SignerMiddleware::new((*provider_arc).clone(), wallet);
        let client_arc = Arc::new(client);

        // Create nonce manager with the underlying provider
        let nonce_manager = NonceManager::new(address, provider_arc);

        // Create gas estimator
        let gas_estimator = GasEstimator::new(client_arc.clone(), config.gas_config.clone());

        info!(
            address = ?address,
            rpc_url = %config.rpc_url,
            chain_id = config.chain_id,
            bridge_proxy = ?config.bridge_proxy_address,
            "ArbitrumChainWriter initialized"
        );

        Ok(Self {
            client: client_arc,
            config,
            nonce_manager,
            gas_estimator,
        })
    }

    /// Get the signer address
    pub fn address(&self) -> Address {
        self.client.address()
    }

    /// Perform a read-only static call to a contract on Arbitrum.
    pub async fn static_call(
        &self,
        to: Address,
        calldata: Vec<u8>,
    ) -> Result<Vec<u8>, ArbitrumWriterError> {
        use ethers::providers::Middleware;
        let tx = ethers::types::TransactionRequest::new()
            .to(to)
            .data(calldata);
        let result = self.client.call(&tx.into(), None).await
            .map_err(|e| ArbitrumWriterError::ProviderError(format!("static_call: {}", e)))?;
        Ok(result.to_vec())
    }

    /// Get the configuration
    pub fn config(&self) -> &ArbitrumChainWriterConfig {
        &self.config
    }

    /// Send a generic transaction with calldata to an arbitrary address on Arbitrum.
    /// Used by oracle price submission and other generic contract calls.
    pub async fn send_transaction(
        &self,
        to: Address,
        calldata: Vec<u8>,
        value: U256,
    ) -> Result<ethers::types::TxHash, ArbitrumWriterError> {
        // Resync nonce from chain
        if let Err(e) = self.nonce_manager.resync().await {
            debug!(error = %e, "Nonce resync failed, using cached value");
        }
        let tx_nonce = U256::from(self.nonce_manager.current_nonce());
        let _ = self.nonce_manager.get_next_nonce().await;

        let mut tx: TypedTransaction = ethers::types::Eip1559TransactionRequest::new()
            .to(to)
            .data(calldata)
            .value(value)
            .nonce(tx_nonce)
            .chain_id(self.config.chain_id)
            .into();

        // Estimate gas
        let gas = self.gas_estimator.estimate_gas(&tx).await
            .map_err(|e| ArbitrumWriterError::GasEstimationError(format!("send_transaction gas: {}", e)))?;
        tx.set_gas(gas);

        // Get gas price
        let gas_price = self.gas_estimator.get_gas_price().await
            .map_err(|e| ArbitrumWriterError::GasEstimationError(format!("send_transaction gas price: {}", e)))?;
        if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
            gas_price.apply_to_tx(eip1559_tx);
        }

        match self.client.send_transaction(tx, None).await {
            Ok(pending_tx) => {
                let tx_hash = pending_tx.tx_hash();
                info!(tx = ?tx_hash, "Generic Arb transaction submitted");
                self.nonce_manager.track_pending(tx_nonce, tx_hash);
                Ok(tx_hash)
            }
            Err(e) => {
                warn!(error = %e, "Generic Arb transaction failed");
                Err(ArbitrumWriterError::TransactionError(format!("send_transaction: {}", e)))
            }
        }
    }

    /// Build a completeCreateItp transaction
    ///
    /// Encodes: BridgeProxy.completeCreateItp(nonce, orbitItpId, blsSignature)
    fn build_complete_create_itp_tx(
        &self,
        nonce: U256,
        orbit_itp_id: H256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: completeCreateItp(uint256,bytes32,bytes,uint256,uint256)
        let function = ethers::abi::Function {
            name: "completeCreateItp".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "nonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "orbitItpId".to_string(),
                    kind: ethers::abi::ParamType::FixedBytes(32),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "referenceNonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "signersBitmask".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            outputs: vec![ethers::abi::Param {
                name: "bridgedItpAddress".to_string(),
                kind: ethers::abi::ParamType::Address,
                internal_type: None,
            }],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::Uint(nonce),
            ethers::abi::Token::FixedBytes(orbit_itp_id.as_bytes().to_vec()),
            ethers::abi::Token::Bytes(bls_signature),
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        let call_data = function
            .encode_input(&tokens)
            .expect("ABI encoding should not fail");

        let mut tx = TypedTransaction::default();
        tx.set_to(self.config.bridge_proxy_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit completeCreateItp transaction to BridgeProxy
    ///
    /// This finalizes cross-chain ITP creation by:
    /// 1. Submitting the aggregated BLS signature
    /// 2. BridgeProxy atomically creates ITP on L3 via Index.createITP()
    /// 3. Deploying the BridgedITP token on Arbitrum
    /// 4. Setting up bidirectional mappings
    ///
    /// # Arguments
    /// * `nonce` - Request nonce from BridgeProxy.requestCreateItp()
    /// * `orbit_itp_id` - ITP ID from L3
    /// * `bls_signature` - Aggregated BLS signature (threshold)
    ///
    /// # Returns
    /// Transaction hash on success
    ///
    /// # Stateless Design
    /// Each attempt queries fresh nonce from chain to handle concurrent submissions
    /// and "nonce too low" errors without relying on cached local state.
    pub async fn complete_create_itp(
        &self,
        nonce: U256,
        orbit_itp_id: H256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<H256, ArbitrumWriterError> {
        info!(
            nonce = %nonce,
            orbit_itp_id = ?orbit_itp_id,
            sig_len = bls_signature.len(),
            "Submitting completeCreateItp transaction"
        );

        let max_attempts = self.config.retry_config.max_retries + 1;

        for attempt in 0..max_attempts {
            // STATELESS: Resync nonce from chain each attempt
            // This handles "nonce too low" by getting fresh state
            if let Err(e) = self.nonce_manager.resync().await {
                debug!(attempt, error = %e, "Nonce resync failed, using cached value");
            }

            let tx_nonce = U256::from(self.nonce_manager.current_nonce());
            // Increment for next potential concurrent tx
            let _ = self.nonce_manager.get_next_nonce().await;

            // Build the transaction with fresh nonce
            let mut tx = self.build_complete_create_itp_tx(
                nonce,
                orbit_itp_id,
                bls_signature.clone(),
                reference_nonce,
                signers_bitmask,
            );
            tx.set_nonce(tx_nonce);

            // Estimate gas (fresh each attempt in case state changed)
            let gas = match self.gas_estimator.estimate_gas(&tx).await {
                Ok(g) => g,
                Err(e) => {
                    if attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Gas estimation failed, retrying");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            // Get gas price
            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| ArbitrumWriterError::GasEstimationError(e.to_string()))?;

            // Apply gas price (for EIP-1559 transactions)
            if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
                gas_price.apply_to_tx(eip1559_tx);
            }

            debug!(
                attempt,
                nonce = %tx_nonce,
                gas_limit = %gas,
                "Attempting transaction submission"
            );

            // Submit transaction
            match self.client.send_transaction(tx, None).await {
                Ok(pending_tx) => {
                    let tx_hash = pending_tx.tx_hash();
                    info!(
                        tx_hash = ?tx_hash,
                        request_nonce = %nonce,
                        tx_nonce = %tx_nonce,
                        attempt,
                        "completeCreateItp transaction submitted"
                    );

                    // Track the pending transaction
                    self.nonce_manager.track_pending(tx_nonce, tx_hash);

                    return Ok(tx_hash);
                }
                Err(e) => {
                    let err_str = e.to_string().to_lowercase();

                    // Check if retryable
                    let is_nonce_error = err_str.contains("nonce too low")
                        || err_str.contains("nonce has already been used")
                        || err_str.contains("replacement transaction underpriced");

                    if is_nonce_error && attempt < max_attempts - 1 {
                        debug!(
                            attempt,
                            error = %e,
                            "Nonce-related error, will resync and retry"
                        );
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }

                    // Non-retryable or exhausted
                    return Err(ArbitrumWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(ArbitrumWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for completeCreateItp",
            max_attempts
        )))
    }

    /// Wait for transaction receipt with timeout
    ///
    /// # Arguments
    /// * `tx_hash` - Transaction hash to wait for
    /// * `timeout_secs` - Maximum seconds to wait
    ///
    /// # Returns
    /// Transaction receipt on success
    pub async fn wait_for_receipt(
        &self,
        tx_hash: H256,
        timeout_secs: u64,
    ) -> Result<TransactionReceipt, ArbitrumWriterError> {
        let pending = PendingTransaction::new(tx_hash, self.client.provider());

        tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            pending,
        )
        .await
        .map_err(|_| ArbitrumWriterError::ReceiptTimeout { tx_hash, timeout_secs })?
        .map_err(|e| ArbitrumWriterError::ProviderError(e.to_string()))?
        .ok_or_else(|| ArbitrumWriterError::ReceiptNotFound(tx_hash))
    }

    /// Complete ITP creation with receipt confirmation
    ///
    /// Combines `complete_create_itp` and `wait_for_receipt` for convenience.
    ///
    /// # Arguments
    /// * `nonce` - Request nonce
    /// * `orbit_itp_id` - ITP ID from L3
    /// * `bls_signature` - Aggregated BLS signature
    /// * `timeout_secs` - Receipt wait timeout
    ///
    /// # Returns
    /// Transaction receipt on success
    pub async fn complete_create_itp_and_wait(
        &self,
        nonce: U256,
        orbit_itp_id: H256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
        timeout_secs: u64,
    ) -> Result<TransactionReceipt, ArbitrumWriterError> {
        let tx_hash = self
            .complete_create_itp(nonce, orbit_itp_id, bls_signature, reference_nonce, signers_bitmask)
            .await?;

        let receipt = self.wait_for_receipt(tx_hash, timeout_secs).await?;

        // Check transaction status
        if receipt.status == Some(U64::from(0)) {
            return Err(ArbitrumWriterError::TransactionReverted {
                tx_hash,
                receipt: Box::new(receipt),
            });
        }

        info!(
            tx_hash = ?tx_hash,
            block_number = ?receipt.block_number,
            gas_used = ?receipt.gas_used,
            "completeCreateItp transaction confirmed"
        );

        Ok(receipt)
    }

    /// Build a completeRebalance transaction
    ///
    /// Encodes: BridgeProxy.completeRebalance(nonce, blsSignature)
    fn build_complete_rebalance_tx(
        &self,
        nonce: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: completeRebalance(uint256,bytes,uint256,uint256)
        let function = ethers::abi::Function {
            name: "completeRebalance".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "nonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "referenceNonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "signersBitmask".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::Uint(nonce),
            ethers::abi::Token::Bytes(bls_signature),
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        let call_data = function
            .encode_input(&tokens)
            .expect("ABI encoding should not fail");

        let mut tx = TypedTransaction::default();
        tx.set_to(self.config.bridge_proxy_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit completeRebalance transaction to BridgeProxy
    ///
    /// This finalizes cross-chain ITP rebalance by:
    /// 1. Submitting the aggregated BLS signature
    /// 2. BridgeProxy atomically rebalances ITP on L3 via Index.updateWeights()
    ///
    /// # Arguments
    /// * `nonce` - Request nonce from BridgeProxy.requestRebalance()
    /// * `bls_signature` - Aggregated BLS signature (threshold)
    ///
    /// # Returns
    /// Transaction hash on success
    ///
    /// # Stateless Design
    /// Each attempt queries fresh nonce from chain to handle concurrent submissions
    /// and "nonce too low" errors without relying on cached local state.
    pub async fn complete_rebalance(
        &self,
        nonce: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<H256, ArbitrumWriterError> {
        info!(
            nonce = %nonce,
            sig_len = bls_signature.len(),
            "Submitting completeRebalance transaction"
        );

        let max_attempts = self.config.retry_config.max_retries + 1;

        for attempt in 0..max_attempts {
            // STATELESS: Resync nonce from chain each attempt
            // This handles "nonce too low" by getting fresh state
            if let Err(e) = self.nonce_manager.resync().await {
                debug!(attempt, error = %e, "Nonce resync failed, using cached value");
            }

            let tx_nonce = U256::from(self.nonce_manager.current_nonce());
            // Increment for next potential concurrent tx
            let _ = self.nonce_manager.get_next_nonce().await;

            // Build the transaction with fresh nonce
            let mut tx = self.build_complete_rebalance_tx(
                nonce,
                bls_signature.clone(),
                reference_nonce,
                signers_bitmask,
            );
            tx.set_nonce(tx_nonce);

            // Estimate gas (fresh each attempt in case state changed)
            let gas = match self.gas_estimator.estimate_gas(&tx).await {
                Ok(g) => g,
                Err(e) => {
                    if attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Gas estimation failed, retrying");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            // Get gas price
            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| ArbitrumWriterError::GasEstimationError(e.to_string()))?;

            // Apply gas price (for EIP-1559 transactions)
            if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
                gas_price.apply_to_tx(eip1559_tx);
            }

            debug!(
                attempt,
                nonce = %tx_nonce,
                gas_limit = %gas,
                "Attempting transaction submission"
            );

            // Submit transaction
            match self.client.send_transaction(tx, None).await {
                Ok(pending_tx) => {
                    let tx_hash = pending_tx.tx_hash();
                    info!(
                        tx_hash = ?tx_hash,
                        request_nonce = %nonce,
                        tx_nonce = %tx_nonce,
                        attempt,
                        "completeRebalance transaction submitted"
                    );

                    // Track the pending transaction
                    self.nonce_manager.track_pending(tx_nonce, tx_hash);

                    return Ok(tx_hash);
                }
                Err(e) => {
                    let err_str = e.to_string().to_lowercase();

                    // Check if retryable
                    let is_nonce_error = err_str.contains("nonce too low")
                        || err_str.contains("nonce has already been used")
                        || err_str.contains("replacement transaction underpriced");

                    if is_nonce_error && attempt < max_attempts - 1 {
                        debug!(
                            attempt,
                            error = %e,
                            "Nonce-related error, will resync and retry"
                        );
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }

                    // Non-retryable or exhausted
                    return Err(ArbitrumWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(ArbitrumWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for completeRebalance",
            max_attempts
        )))
    }

    /// Complete ITP rebalance with receipt confirmation
    ///
    /// Combines `complete_rebalance` and `wait_for_receipt` for convenience.
    ///
    /// # Arguments
    /// * `nonce` - Request nonce
    /// * `bls_signature` - Aggregated BLS signature
    /// * `timeout_secs` - Receipt wait timeout
    ///
    /// # Returns
    /// Transaction receipt on success
    pub async fn complete_rebalance_and_wait(
        &self,
        nonce: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
        timeout_secs: u64,
    ) -> Result<TransactionReceipt, ArbitrumWriterError> {
        let tx_hash = self
            .complete_rebalance(nonce, bls_signature, reference_nonce, signers_bitmask)
            .await?;

        let receipt = self.wait_for_receipt(tx_hash, timeout_secs).await?;

        // Check transaction status
        if receipt.status == Some(U64::from(0)) {
            return Err(ArbitrumWriterError::TransactionReverted {
                tx_hash,
                receipt: Box::new(receipt),
            });
        }

        info!(
            tx_hash = ?tx_hash,
            block_number = ?receipt.block_number,
            gas_used = ?receipt.gas_used,
            "completeRebalance transaction confirmed"
        );

        Ok(receipt)
    }
    // ============ Cross-Chain Sell Order Methods ============

    /// Build a completeSellOrder transaction
    ///
    /// Encodes: ArbBridgeCustody.completeSellOrder(orderId, usdcProceeds, blsSignature)
    fn build_complete_sell_order_tx(
        &self,
        order_id: U256,
        usdc_proceeds: U256,
        vault: Address,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: completeSellOrder(uint256,uint256,address,bytes,uint256,uint256)
        let function = ethers::abi::Function {
            name: "completeSellOrder".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "orderId".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "usdcProceeds".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "vault".to_string(),
                    kind: ethers::abi::ParamType::Address,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "referenceNonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "signersBitmask".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::Uint(order_id),
            ethers::abi::Token::Uint(usdc_proceeds),
            ethers::abi::Token::Address(vault),
            ethers::abi::Token::Bytes(bls_signature),
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        let call_data = function
            .encode_input(&tokens)
            .expect("ABI encoding should not fail");

        let mut tx = TypedTransaction::default();
        tx.set_to(self.config.arb_custody_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit completeSellOrder transaction to ArbBridgeCustody
    ///
    /// This finalizes a cross-chain sell order by:
    /// 1. Providing the USDC proceeds amount from the L3 sell
    /// 2. Providing the aggregated BLS signature as consensus proof
    /// 3. ArbBridgeCustody releases USDC to the original user
    ///
    /// # Arguments
    /// * `order_id` - Sell order ID from ArbBridgeCustody
    /// * `usdc_proceeds` - USDC amount to return to user
    /// * `aggregated_signature` - Aggregated BLS signature
    ///
    /// # Returns
    /// Transaction hash on success
    pub async fn complete_sell_order(
        &self,
        order_id: U256,
        usdc_proceeds: U256,
        vault: Address,
        aggregated_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<H256, ArbitrumWriterError> {
        info!(
            order_id = %order_id,
            usdc_proceeds = %usdc_proceeds,
            sig_len = aggregated_signature.len(),
            "Submitting completeSellOrder transaction"
        );

        let max_attempts = self.config.retry_config.max_retries + 1;

        for attempt in 0..max_attempts {
            // STATELESS: Resync nonce from chain each attempt
            if let Err(e) = self.nonce_manager.resync().await {
                debug!(attempt, error = %e, "Nonce resync failed, using cached value");
            }

            let tx_nonce = U256::from(self.nonce_manager.current_nonce());
            let _ = self.nonce_manager.get_next_nonce().await;

            let mut tx = self.build_complete_sell_order_tx(
                order_id,
                usdc_proceeds,
                vault,
                aggregated_signature.clone(),
                reference_nonce,
                signers_bitmask,
            );
            tx.set_nonce(tx_nonce);

            // Estimate gas
            let gas = match self.gas_estimator.estimate_gas(&tx).await {
                Ok(g) => g,
                Err(e) => {
                    if attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Gas estimation failed, retrying");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            // Get gas price
            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| ArbitrumWriterError::GasEstimationError(e.to_string()))?;

            if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
                gas_price.apply_to_tx(eip1559_tx);
            }

            debug!(
                attempt,
                nonce = %tx_nonce,
                gas_limit = %gas,
                "Attempting completeSellOrder submission"
            );

            match self.client.send_transaction(tx, None).await {
                Ok(pending_tx) => {
                    let tx_hash = pending_tx.tx_hash();
                    info!(
                        tx_hash = ?tx_hash,
                        order_id = %order_id,
                        tx_nonce = %tx_nonce,
                        attempt,
                        "completeSellOrder transaction submitted"
                    );
                    self.nonce_manager.track_pending(tx_nonce, tx_hash);
                    return Ok(tx_hash);
                }
                Err(e) => {
                    let err_str = e.to_string().to_lowercase();
                    let is_nonce_error = err_str.contains("nonce too low")
                        || err_str.contains("nonce has already been used")
                        || err_str.contains("replacement transaction underpriced");

                    if is_nonce_error && attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Nonce-related error, will resync and retry");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(ArbitrumWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for completeSellOrder",
            max_attempts
        )))
    }

    /// Build a refundSellOrder transaction
    ///
    /// Encodes: ArbBridgeCustody.refundSellOrder(orderId, blsSignature)
    fn build_refund_sell_order_tx(
        &self,
        order_id: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: refundSellOrder(uint256,bytes,uint256,uint256)
        let function = ethers::abi::Function {
            name: "refundSellOrder".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "orderId".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "referenceNonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "signersBitmask".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::Uint(order_id),
            ethers::abi::Token::Bytes(bls_signature),
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        let call_data = function
            .encode_input(&tokens)
            .expect("ABI encoding should not fail");

        let mut tx = TypedTransaction::default();
        tx.set_to(self.config.arb_custody_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit refundSellOrder transaction to ArbBridgeCustody
    ///
    /// This refunds a cross-chain sell order by:
    /// 1. Providing the aggregated BLS signature as consensus proof
    /// 2. ArbBridgeCustody returns ITP tokens to the original user
    ///
    /// # Arguments
    /// * `order_id` - Sell order ID from ArbBridgeCustody
    /// * `aggregated_signature` - Aggregated BLS signature
    ///
    /// # Returns
    /// Transaction hash on success
    pub async fn refund_sell_order(
        &self,
        order_id: U256,
        aggregated_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<H256, ArbitrumWriterError> {
        info!(
            order_id = %order_id,
            sig_len = aggregated_signature.len(),
            "Submitting refundSellOrder transaction"
        );

        let max_attempts = self.config.retry_config.max_retries + 1;

        for attempt in 0..max_attempts {
            if let Err(e) = self.nonce_manager.resync().await {
                debug!(attempt, error = %e, "Nonce resync failed, using cached value");
            }

            let tx_nonce = U256::from(self.nonce_manager.current_nonce());
            let _ = self.nonce_manager.get_next_nonce().await;

            let mut tx = self.build_refund_sell_order_tx(
                order_id,
                aggregated_signature.clone(),
                reference_nonce,
                signers_bitmask,
            );
            tx.set_nonce(tx_nonce);

            let gas = match self.gas_estimator.estimate_gas(&tx).await {
                Ok(g) => g,
                Err(e) => {
                    if attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Gas estimation failed, retrying");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| ArbitrumWriterError::GasEstimationError(e.to_string()))?;

            if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
                gas_price.apply_to_tx(eip1559_tx);
            }

            debug!(
                attempt,
                nonce = %tx_nonce,
                gas_limit = %gas,
                "Attempting refundSellOrder submission"
            );

            match self.client.send_transaction(tx, None).await {
                Ok(pending_tx) => {
                    let tx_hash = pending_tx.tx_hash();
                    info!(
                        tx_hash = ?tx_hash,
                        order_id = %order_id,
                        tx_nonce = %tx_nonce,
                        attempt,
                        "refundSellOrder transaction submitted"
                    );
                    self.nonce_manager.track_pending(tx_nonce, tx_hash);
                    return Ok(tx_hash);
                }
                Err(e) => {
                    let err_str = e.to_string().to_lowercase();
                    let is_nonce_error = err_str.contains("nonce too low")
                        || err_str.contains("nonce has already been used")
                        || err_str.contains("replacement transaction underpriced");

                    if is_nonce_error && attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Nonce-related error, will resync and retry");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(ArbitrumWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for refundSellOrder",
            max_attempts
        )))
    }

    // ============ Buy/Sell Order Custody Methods ============

    /// Build a completeBuyOrder transaction
    ///
    /// Encodes: ArbBridgeCustody.completeBuyOrder(orderId, vault, blsSignature)
    fn build_complete_buy_order_tx(
        &self,
        order_id: U256,
        vault: Address,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        let function = ethers::abi::Function {
            name: "completeBuyOrder".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "orderId".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "vault".to_string(),
                    kind: ethers::abi::ParamType::Address,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "referenceNonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "signersBitmask".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::Uint(order_id),
            ethers::abi::Token::Address(vault),
            ethers::abi::Token::Bytes(bls_signature),
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        let call_data = function
            .encode_input(&tokens)
            .expect("ABI encoding should not fail");

        let mut tx = TypedTransaction::default();
        tx.set_to(self.config.arb_custody_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit completeBuyOrder transaction to ArbBridgeCustody
    ///
    /// Transfers escrowed USDC from custody to vault after L3 order processing.
    ///
    /// # Arguments
    /// * `order_id` - Cross-chain order ID
    /// * `vault` - Destination vault address for USDC
    /// * `bls_signature` - Aggregated BLS signature
    ///
    /// # Returns
    /// Transaction hash on success
    pub async fn complete_buy_order(
        &self,
        order_id: U256,
        vault: Address,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<H256, ArbitrumWriterError> {
        info!(
            order_id = %order_id,
            vault = ?vault,
            sig_len = bls_signature.len(),
            "Submitting completeBuyOrder transaction"
        );

        let max_attempts = self.config.retry_config.max_retries + 1;

        for attempt in 0..max_attempts {
            if let Err(e) = self.nonce_manager.resync().await {
                debug!(attempt, error = %e, "Nonce resync failed, using cached value");
            }

            let tx_nonce = U256::from(self.nonce_manager.current_nonce());
            let _ = self.nonce_manager.get_next_nonce().await;

            let mut tx = self.build_complete_buy_order_tx(
                order_id,
                vault,
                bls_signature.clone(),
                reference_nonce,
                signers_bitmask,
            );
            tx.set_nonce(tx_nonce);

            let gas = match self.gas_estimator.estimate_gas(&tx).await {
                Ok(g) => g,
                Err(e) => {
                    if attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Gas estimation failed, retrying");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| ArbitrumWriterError::GasEstimationError(e.to_string()))?;

            if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
                gas_price.apply_to_tx(eip1559_tx);
            }

            debug!(
                attempt,
                nonce = %tx_nonce,
                gas_limit = %gas,
                "Attempting completeBuyOrder submission"
            );

            match self.client.send_transaction(tx, None).await {
                Ok(pending_tx) => {
                    let tx_hash = pending_tx.tx_hash();
                    info!(
                        tx_hash = ?tx_hash,
                        order_id = %order_id,
                        tx_nonce = %tx_nonce,
                        attempt,
                        "completeBuyOrder transaction submitted"
                    );
                    self.nonce_manager.track_pending(tx_nonce, tx_hash);
                    return Ok(tx_hash);
                }
                Err(e) => {
                    let err_str = e.to_string().to_lowercase();
                    let is_nonce_error = err_str.contains("nonce too low")
                        || err_str.contains("nonce has already been used")
                        || err_str.contains("replacement transaction underpriced");

                    if is_nonce_error && attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Nonce-related error, will resync and retry");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(ArbitrumWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for completeBuyOrder",
            max_attempts
        )))
    }

    /// Mint BridgedITP shares on Arbitrum via BridgeProxy (8-step bridge Step 8)
    ///
    /// Calls BridgeProxy.mintBridgedShares(itpId, user, amount, blsSignature, referenceNonce, signersBitmask)
    pub async fn mint_bridged_shares(
        &self,
        itp_id: H256,
        user: Address,
        amount: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<H256, ArbitrumWriterError> {
        info!(
            itp_id = ?itp_id,
            user = ?user,
            amount = %amount,
            sig_len = bls_signature.len(),
            "Submitting mintBridgedShares transaction"
        );

        let calldata = crate::bridge::build_mint_bridged_shares_calldata(
            itp_id, user, amount, &bls_signature, reference_nonce, signers_bitmask,
        );

        let max_attempts = self.config.retry_config.max_retries + 1;

        for attempt in 0..max_attempts {
            if let Err(e) = self.nonce_manager.resync().await {
                debug!(attempt, error = %e, "Nonce resync failed, using cached value");
            }

            let tx_nonce = U256::from(self.nonce_manager.current_nonce());
            let _ = self.nonce_manager.get_next_nonce().await;

            let mut tx: TypedTransaction = Eip1559TransactionRequest::new()
                .to(self.config.bridge_proxy_address)
                .data(calldata.clone())
                .chain_id(self.config.chain_id)
                .into();
            tx.set_nonce(tx_nonce);

            let gas = match self.gas_estimator.estimate_gas(&tx).await {
                Ok(g) => g,
                Err(e) => {
                    if attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Gas estimation failed, retrying");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| ArbitrumWriterError::GasEstimationError(e.to_string()))?;

            if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
                gas_price.apply_to_tx(eip1559_tx);
            }

            debug!(
                attempt,
                nonce = %tx_nonce,
                gas_limit = %gas,
                "Attempting mintBridgedShares submission"
            );

            match self.client.send_transaction(tx, None).await {
                Ok(pending_tx) => {
                    let tx_hash = pending_tx.tx_hash();
                    info!(
                        tx_hash = ?tx_hash,
                        itp_id = ?itp_id,
                        user = ?user,
                        amount = %amount,
                        "mintBridgedShares transaction submitted"
                    );
                    self.nonce_manager.track_pending(tx_nonce, tx_hash);
                    return Ok(tx_hash);
                }
                Err(e) => {
                    let err_str = e.to_string().to_lowercase();
                    let is_nonce_error = err_str.contains("nonce too low")
                        || err_str.contains("nonce has already been used")
                        || err_str.contains("replacement transaction underpriced");

                    if is_nonce_error && attempt < max_attempts - 1 {
                        debug!(attempt, error = %e, "Nonce-related error, will resync and retry");
                        let delay = self.config.retry_config.delay_for_attempt(attempt);
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ArbitrumWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(ArbitrumWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for mintBridgedShares",
            max_attempts
        )))
    }

}

/// Errors for ArbitrumChainWriter operations
#[derive(Debug, thiserror::Error)]
pub enum ArbitrumWriterError {
    #[error("provider error: {0}")]
    ProviderError(String),

    #[error("key error: {0}")]
    KeyError(String),

    #[error("nonce error: {0}")]
    NonceError(String),

    #[error("gas estimation error: {0}")]
    GasEstimationError(String),

    #[error("transaction error: {0}")]
    TransactionError(String),

    #[error("retry exhausted: {0}")]
    RetryExhausted(String),

    #[error("receipt timeout: tx {tx_hash:?} not confirmed within {timeout_secs}s")]
    ReceiptTimeout { tx_hash: H256, timeout_secs: u64 },

    #[error("receipt not found: {0:?}")]
    ReceiptNotFound(H256),

    #[error("transaction reverted: {tx_hash:?}")]
    TransactionReverted {
        tx_hash: H256,
        receipt: Box<TransactionReceipt>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = ArbitrumChainWriterConfig::default();
        assert_eq!(config.rpc_url, "https://arb1.arbitrum.io/rpc");
        assert_eq!(config.chain_id, 42161);
        assert_eq!(config.bridge_proxy_address, Address::zero());
    }

    #[test]
    fn test_build_complete_create_itp_tx() {
        let nonce = U256::from(42);
        let orbit_itp_id = H256::from([0x01u8; 32]);
        let bls_signature = vec![0x01, 0x02, 0x03, 0x04];
        let reference_nonce: u64 = 1;
        let signers_bitmask = U256::from(0b11u64);

        // Build the function call directly without creating the full writer
        let function = ethers::abi::Function {
            name: "completeCreateItp".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "nonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "orbitItpId".to_string(),
                    kind: ethers::abi::ParamType::FixedBytes(32),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "referenceNonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "signersBitmask".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::Uint(nonce),
            ethers::abi::Token::FixedBytes(orbit_itp_id.as_bytes().to_vec()),
            ethers::abi::Token::Bytes(bls_signature.clone()),
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        let call_data = function.encode_input(&tokens).unwrap();

        // Verify selector (first 4 bytes)
        // completeCreateItp(uint256,bytes32,bytes,uint256,uint256) selector
        let expected_selector = &ethers::utils::keccak256(b"completeCreateItp(uint256,bytes32,bytes,uint256,uint256)")[..4];
        assert_eq!(&call_data[..4], expected_selector);

        // Verify data length is reasonable
        assert!(call_data.len() >= 100);
    }

    #[test]
    fn test_function_selector() {
        // Verify the function selector matches Solidity
        let selector = &ethers::utils::keccak256(b"completeCreateItp(uint256,bytes32,bytes,uint256,uint256)")[..4];

        // This should be non-zero
        assert_ne!(selector, &[0u8; 4]);

        // Log for verification against Solidity
        println!("completeCreateItp selector: 0x{}", hex::encode(selector));
    }
}
