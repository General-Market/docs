//! Settlement Chain Writer for BridgeProxy transactions (Story 6.21)
//!
//! Provides functionality to submit transactions to the BridgeProxy contract on Settlement,
//! specifically `completeCreateItp()` for finalizing cross-chain ITP creation.

use std::sync::Arc;

use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use tracing::{debug, info, warn};

use super::gas::{GasConfig, GasEstimator};
use super::nonce::NonceManager;
use super::retry::RetryConfig;

/// Configuration for SettlementChainWriter
#[derive(Debug, Clone)]
pub struct SettlementChainWriterConfig {
    /// Settlement RPC endpoint URL
    pub rpc_url: String,
    /// BridgeProxy contract address
    pub bridge_proxy_address: Address,
    /// SettlementBridgeCustody contract address (for cross-chain sell order completion)
    pub settlement_custody_address: Address,
    /// Chain ID (42161 for Settlement chain)
    pub chain_id: u64,
    /// Gas configuration
    pub gas_config: GasConfig,
    /// Retry configuration
    pub retry_config: RetryConfig,
}

impl Default for SettlementChainWriterConfig {
    fn default() -> Self {
        Self {
            rpc_url: "https://arb1.arbitrum.io/rpc".to_string(),
            bridge_proxy_address: Address::zero(),
            settlement_custody_address: Address::zero(),
            chain_id: 42161,
            gas_config: GasConfig::default(),
            retry_config: RetryConfig::default(),
        }
    }
}

/// Type alias for the signer middleware
pub type SettlementSignerClient = SignerMiddleware<Provider<Http>, LocalWallet>;

/// Settlement Chain Writer for BridgeProxy transactions
///
/// Submits transactions to the BridgeProxy contract on Settlement with:
/// - Nonce management for concurrent submissions
/// - Gas estimation with configurable multiplier
/// - Retry logic with exponential backoff
pub struct SettlementChainWriter {
    /// Signer middleware (provider + wallet)
    client: Arc<SettlementSignerClient>,
    /// Configuration
    config: SettlementChainWriterConfig,
    /// Nonce manager
    nonce_manager: NonceManager,
    /// Gas estimator
    gas_estimator: GasEstimator<SettlementSignerClient>,
}

impl SettlementChainWriter {
    /// Create a new SettlementChainWriter
    ///
    /// # Arguments
    /// * `config` - Configuration including RPC URL and contract addresses
    /// * `private_key` - Hex-encoded private key (with or without 0x prefix)
    ///
    /// # Errors
    /// Returns error if unable to connect to RPC endpoint or parse private key
    pub fn new(
        config: SettlementChainWriterConfig,
        private_key: &str,
    ) -> Result<Self, SettlementWriterError> {
        let provider = Provider::<Http>::try_from(&config.rpc_url)
            .map_err(|e| SettlementWriterError::ProviderError(format!("Failed to create provider: {}", e)))?
            .interval(std::time::Duration::from_millis(500)); // Sonic: 500ms blocks, poll faster than default 7s

        // Parse private key (handle both with and without 0x prefix)
        let key_hex = private_key.trim_start_matches("0x");
        let wallet: LocalWallet = key_hex
            .parse::<LocalWallet>()
            .map_err(|e| SettlementWriterError::KeyError(format!("Failed to parse private key: {}", e)))?
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
            "SettlementChainWriter initialized"
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

    /// Get the native token balance of the signer wallet
    pub async fn get_balance(&self) -> Result<U256, SettlementWriterError> {
        use ethers::providers::Middleware;
        self.client.get_balance(self.client.address(), None).await
            .map_err(|e| SettlementWriterError::ProviderError(format!("get_balance: {}", e)))
    }

    /// Check if the settlement wallet has enough native gas. Returns error if not.
    /// DOES NOT BLOCK — caller decides what to do (skip cycle, retry later).
    async fn check_gas_available(&self) -> Result<(), SettlementWriterError> {
        use ethers::providers::Middleware;
        let min_balance = U256::from(1_000_000_000_000_000u64); // 0.001 native tokens (reduced for testnet)
        let balance = self.client.get_balance(self.client.address(), None).await
            .map_err(|e| SettlementWriterError::ProviderError(format!("gas balance check: {}", e)))?;
        if balance < min_balance {
            return Err(SettlementWriterError::InsufficientGas {
                address: self.client.address(),
                balance,
                required: min_balance,
            });
        }
        Ok(())
    }

    /// Perform a read-only static call to a contract on Settlement.
    pub async fn static_call(
        &self,
        to: Address,
        calldata: Vec<u8>,
    ) -> Result<Vec<u8>, SettlementWriterError> {
        use ethers::providers::Middleware;
        let tx = ethers::types::TransactionRequest::new()
            .to(to)
            .data(calldata);
        let result = self.client.call(&tx.into(), None).await
            .map_err(|e| SettlementWriterError::ProviderError(format!("static_call: {}", e)))?;
        Ok(result.to_vec())
    }

    /// Get the configuration
    pub fn config(&self) -> &SettlementChainWriterConfig {
        &self.config
    }

    /// Send a generic transaction with calldata to an arbitrary address on Settlement.
    /// Used by oracle price submission and other generic contract calls.
    pub async fn send_transaction(
        &self,
        to: Address,
        calldata: Vec<u8>,
        value: U256,
    ) -> Result<ethers::types::TxHash, SettlementWriterError> {
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
            .map_err(|e| SettlementWriterError::GasEstimationError(format!("send_transaction gas: {}", e)))?;
        tx.set_gas(gas);

        // Get gas price
        let gas_price = self.gas_estimator.get_gas_price().await
            .map_err(|e| SettlementWriterError::GasEstimationError(format!("send_transaction gas price: {}", e)))?;
        if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
            gas_price.apply_to_tx(eip1559_tx);
        }

        match self.client.send_transaction(tx, None).await {
            Ok(pending_tx) => {
                let tx_hash = pending_tx.tx_hash();
                info!(tx = ?tx_hash, "Generic Settlement transaction submitted");
                self.nonce_manager.track_pending(tx_nonce, tx_hash);
                Ok(tx_hash)
            }
            Err(e) => {
                warn!(error = %e, "Generic Settlement transaction failed");
                Err(SettlementWriterError::TransactionError(format!("send_transaction: {}", e)))
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
    /// 3. Deploying the BridgedITP token on Settlement
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
    ) -> Result<H256, SettlementWriterError> {
        info!(
            nonce = %nonce,
            orbit_itp_id = ?orbit_itp_id,
            sig_len = bls_signature.len(),
            "Submitting completeCreateItp transaction"
        );

        self.check_gas_available().await?;

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
                    return Err(SettlementWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            // Get gas price
            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;

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
                    return Err(SettlementWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(SettlementWriterError::RetryExhausted(format!(
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
    ) -> Result<TransactionReceipt, SettlementWriterError> {
        let pending = PendingTransaction::new(tx_hash, self.client.provider())
            .interval(std::time::Duration::from_millis(500));

        tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            pending,
        )
        .await
        .map_err(|_| SettlementWriterError::ReceiptTimeout { tx_hash, timeout_secs })?
        .map_err(|e| SettlementWriterError::ProviderError(e.to_string()))?
        .ok_or_else(|| SettlementWriterError::ReceiptNotFound(tx_hash))
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
    ) -> Result<TransactionReceipt, SettlementWriterError> {
        let tx_hash = self
            .complete_create_itp(nonce, orbit_itp_id, bls_signature, reference_nonce, signers_bitmask)
            .await?;

        let receipt = self.wait_for_receipt(tx_hash, timeout_secs).await?;

        // Check transaction status
        if receipt.status == Some(U64::from(0)) {
            return Err(SettlementWriterError::TransactionReverted {
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
    ) -> Result<H256, SettlementWriterError> {
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
                    return Err(SettlementWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            // Get gas price
            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;

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
                    return Err(SettlementWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(SettlementWriterError::RetryExhausted(format!(
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
    ) -> Result<TransactionReceipt, SettlementWriterError> {
        let tx_hash = self
            .complete_rebalance(nonce, bls_signature, reference_nonce, signers_bitmask)
            .await?;

        let receipt = self.wait_for_receipt(tx_hash, timeout_secs).await?;

        // Check transaction status
        if receipt.status == Some(U64::from(0)) {
            return Err(SettlementWriterError::TransactionReverted {
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
    /// Encodes: SettlementBridgeCustody.completeSellOrder(orderId, usdcProceeds, blsSignature)
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
        tx.set_to(self.config.settlement_custody_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit completeSellOrder transaction to SettlementBridgeCustody
    ///
    /// This finalizes a cross-chain sell order by:
    /// 1. Providing the USDC proceeds amount from the L3 sell
    /// 2. Providing the aggregated BLS signature as consensus proof
    /// 3. SettlementBridgeCustody releases USDC to the original user
    ///
    /// # Arguments
    /// * `order_id` - Sell order ID from SettlementBridgeCustody
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
    ) -> Result<H256, SettlementWriterError> {
        info!(
            order_id = %order_id,
            usdc_proceeds = %usdc_proceeds,
            sig_len = aggregated_signature.len(),
            "Submitting completeSellOrder transaction"
        );

        self.check_gas_available().await?;

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
                    return Err(SettlementWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            // Get gas price
            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;

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
                    return Err(SettlementWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(SettlementWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for completeSellOrder",
            max_attempts
        )))
    }

    // ========================================================================
    // Burn Sell Order Shares (Task 4)
    // ========================================================================

    /// Build a burnSellOrderShares transaction
    fn build_burn_sell_order_tx(
        &self,
        order_id: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        let function = ethers::abi::Function {
            name: "burnSellOrderShares".to_string(),
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
        tx.set_to(self.config.settlement_custody_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit burnSellOrderShares transaction to SettlementBridgeCustody
    ///
    /// Burns escrowed BridgedITP before submitting sell on L3. This is the
    /// sell-side gate — symmetric with completeBuyOrder for buys.
    pub async fn burn_sell_order_shares(
        &self,
        order_id: U256,
        aggregated_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<H256, SettlementWriterError> {
        info!(
            order_id = %order_id,
            sig_len = aggregated_signature.len(),
            "Submitting burnSellOrderShares transaction"
        );

        self.check_gas_available().await?;

        let max_attempts = self.config.retry_config.max_retries + 1;

        for attempt in 0..max_attempts {
            if let Err(e) = self.nonce_manager.resync().await {
                debug!(attempt, error = %e, "Nonce resync failed, using cached value");
            }

            let tx_nonce = U256::from(self.nonce_manager.current_nonce());
            let _ = self.nonce_manager.get_next_nonce().await;

            let mut tx = self.build_burn_sell_order_tx(
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
                    return Err(SettlementWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;

            if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
                gas_price.apply_to_tx(eip1559_tx);
            }

            debug!(
                attempt,
                nonce = %tx_nonce,
                gas_limit = %gas,
                "Attempting burnSellOrderShares submission"
            );

            match self.client.send_transaction(tx, None).await {
                Ok(pending_tx) => {
                    let tx_hash = pending_tx.tx_hash();
                    info!(
                        tx_hash = ?tx_hash,
                        order_id = %order_id,
                        tx_nonce = %tx_nonce,
                        attempt,
                        "burnSellOrderShares transaction submitted"
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
                    return Err(SettlementWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(SettlementWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for burnSellOrderShares",
            max_attempts
        )))
    }

    /// Build a refundSellOrder transaction
    ///
    /// Encodes: SettlementBridgeCustody.refundSellOrder(orderId, blsSignature)
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
        tx.set_to(self.config.settlement_custody_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit refundSellOrder transaction to SettlementBridgeCustody
    ///
    /// This refunds a cross-chain sell order by:
    /// 1. Providing the aggregated BLS signature as consensus proof
    /// 2. SettlementBridgeCustody returns ITP tokens to the original user
    ///
    /// # Arguments
    /// * `order_id` - Sell order ID from SettlementBridgeCustody
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
    ) -> Result<H256, SettlementWriterError> {
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
                    return Err(SettlementWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;

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
                    return Err(SettlementWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(SettlementWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for refundSellOrder",
            max_attempts
        )))
    }

    // ============ Buy/Sell Order Custody Methods ============

    /// Build a completeBuyOrder transaction
    ///
    /// Encodes: SettlementBridgeCustody.completeBuyOrder(orderId, vault, blsSignature)
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
        tx.set_to(self.config.settlement_custody_address);
        tx.set_data(call_data.into());
        tx.set_chain_id(self.config.chain_id);

        tx
    }

    /// Submit completeBuyOrder transaction to SettlementBridgeCustody
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
    ) -> Result<H256, SettlementWriterError> {
        info!(
            order_id = %order_id,
            vault = ?vault,
            sig_len = bls_signature.len(),
            "Submitting completeBuyOrder transaction"
        );

        self.check_gas_available().await?;

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
                    return Err(SettlementWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;

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
                    return Err(SettlementWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(SettlementWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for completeBuyOrder",
            max_attempts
        )))
    }

    /// Mint BridgedITP shares on Settlement via BridgeProxy (8-step bridge Step 8)
    ///
    /// Calls BridgeProxy.mintBridgedShares(itpId, user, amount, blsSignature, referenceNonce, signersBitmask)
    pub async fn mint_bridged_shares(
        &self,
        itp_id: H256,
        user: Address,
        amount: U256,
        order_id: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<H256, SettlementWriterError> {
        info!(
            itp_id = ?itp_id,
            user = ?user,
            amount = %amount,
            order_id = %order_id,
            sig_len = bls_signature.len(),
            "Submitting mintBridgedShares transaction"
        );

        self.check_gas_available().await?;

        let calldata = crate::bridge::build_mint_bridged_shares_calldata(
            itp_id, user, amount, order_id, &bls_signature, reference_nonce, signers_bitmask,
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
                    return Err(SettlementWriterError::GasEstimationError(e.to_string()));
                }
            };
            tx.set_gas(gas);

            let gas_price = self
                .gas_estimator
                .get_gas_price()
                .await
                .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;

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
                    return Err(SettlementWriterError::TransactionError(e.to_string()));
                }
            }
        }

        Err(SettlementWriterError::RetryExhausted(format!(
            "Max attempts ({}) exceeded for mintBridgedShares",
            max_attempts
        )))
    }

    /// Call clearPendingMint(orderId) on SettlementBridgeCustody.
    /// No BLS needed — anyone can call after mint is processed.
    pub async fn clear_pending_mint(
        &self,
        order_id: U256,
    ) -> Result<H256, SettlementWriterError> {
        // selector: clearPendingMint(uint256)
        let selector = &ethers::utils::keccak256(b"clearPendingMint(uint256)")[..4];
        let mut calldata = Vec::with_capacity(36);
        calldata.extend_from_slice(selector);
        calldata.extend_from_slice(&ethers::abi::encode(&[ethers::abi::Token::Uint(order_id)]));

        if let Err(e) = self.nonce_manager.resync().await {
            debug!(error = %e, "Nonce resync failed for clearPendingMint");
        }
        let tx_nonce = U256::from(self.nonce_manager.current_nonce());
        let _ = self.nonce_manager.get_next_nonce().await;

        let mut tx: TypedTransaction = Eip1559TransactionRequest::new()
            .to(self.config.settlement_custody_address)
            .data(calldata)
            .chain_id(self.config.chain_id)
            .into();
        tx.set_nonce(tx_nonce);

        let gas = self.gas_estimator.estimate_gas(&tx).await
            .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;
        tx.set_gas(gas);

        let gas_price = self.gas_estimator.get_gas_price().await
            .map_err(|e| SettlementWriterError::GasEstimationError(e.to_string()))?;
        if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
            gas_price.apply_to_tx(eip1559_tx);
        }

        match self.client.send_transaction(tx, None).await {
            Ok(pending_tx) => {
                let tx_hash = pending_tx.tx_hash();
                info!(%order_id, ?tx_hash, "clearPendingMint submitted");
                self.nonce_manager.track_pending(tx_nonce, tx_hash);
                Ok(tx_hash)
            }
            Err(e) => Err(SettlementWriterError::TransactionError(e.to_string())),
        }
    }

}

// ── ChainWriter adapter for VisionDepositWatcher ──────────────────────
// The deposit watcher expects `Arc<dyn ChainWriter>` for Settlement operations.
// Only `send_transaction` and `static_call` are used; other methods are L3-specific.

#[async_trait::async_trait]
impl common::traits::ChainWriter for SettlementChainWriter {
    async fn submit_batch(
        &self, _: u64, _: Vec<u64>, _: Vec<u8>, _: u64, _: U256,
    ) -> Result<common::types::TxHash, common::error::Error> {
        Err(common::error::Error::ChainWrite("submit_batch not supported on Settlement".into()))
    }

    async fn confirm_fills(
        &self, _: u64, _: Vec<common::types::Fill>, _: Vec<u8>, _: u64, _: U256,
    ) -> Result<common::types::TxHash, common::error::Error> {
        Err(common::error::Error::ChainWrite("confirm_fills not supported on Settlement".into()))
    }

    async fn submit_bridge(
        &self, _: u64, _: U256, _: Vec<u8>, _: u64, _: U256,
    ) -> Result<common::types::TxHash, common::error::Error> {
        Err(common::error::Error::ChainWrite("submit_bridge not supported on Settlement".into()))
    }

    async fn create_itp(
        &self, _: &str, _: &str, _: &[U256], _: &[Address], _: &[U256], _: U256,
    ) -> Result<H256, common::error::Error> {
        Err(common::error::Error::ChainWrite("create_itp not supported on Settlement".into()))
    }

    async fn send_transaction(
        &self,
        to: Address,
        calldata: Vec<u8>,
        value: U256,
    ) -> Result<common::types::TxHash, common::error::Error> {
        SettlementChainWriter::send_transaction(self, to, calldata, value)
            .await
            .map_err(|e| common::error::Error::ChainWrite(e.to_string()))
    }

    async fn static_call(
        &self,
        to: Address,
        calldata: Vec<u8>,
    ) -> Result<Vec<u8>, common::error::Error> {
        SettlementChainWriter::static_call(self, to, calldata)
            .await
            .map_err(|e| common::error::Error::ChainWrite(e.to_string()))
    }
}

/// Errors for SettlementChainWriter operations
#[derive(Debug, thiserror::Error)]
pub enum SettlementWriterError {
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

    #[error("insufficient gas: address {address:?} has {balance} but needs at least {required}")]
    InsufficientGas { address: Address, balance: U256, required: U256 },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = SettlementChainWriterConfig::default();
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
