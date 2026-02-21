//! EthersChainWriter implementation using ethers-rs
//!
//! Implements the `ChainWriter` trait from common crate to submit transactions
//! to the Index L3 chain using ethers-rs with nonce management, gas estimation,
//! and retry logic.

use std::path::Path;
use std::sync::Arc;

use async_trait::async_trait;
use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use tracing::{debug, info};

use common::error::Error;
use common::traits::ChainWriter;
use common::types::{Fill, TxHash};

use super::gas::{GasConfig, GasEstimator};
use super::nonce::NonceManager;
use super::retry::{with_retry, RetryConfig};

/// Contract addresses for Index L3 chain writer
#[derive(Debug, Clone)]
pub struct WriterContractAddresses {
    /// Index.sol contract address for batch/fill operations
    pub index: Address,
    /// L3BridgeCustody.sol contract address for bridge operations
    pub l3_bridge_custody: Address,
}

impl Default for WriterContractAddresses {
    fn default() -> Self {
        Self {
            index: Address::zero(),
            l3_bridge_custody: Address::zero(),
        }
    }
}

/// Configuration for EthersChainWriter
#[derive(Debug, Clone)]
pub struct ChainWriterConfig {
    /// RPC endpoint URL
    pub rpc_url: String,
    /// Contract addresses
    pub contracts: WriterContractAddresses,
    /// Chain ID (111222333 for Index L3)
    pub chain_id: u64,
    /// Gas configuration
    pub gas_config: GasConfig,
    /// Retry configuration
    pub retry_config: RetryConfig,
}

impl Default for ChainWriterConfig {
    fn default() -> Self {
        Self {
            rpc_url: "http://localhost:8545".to_string(),
            contracts: WriterContractAddresses::default(),
            chain_id: 111222333, // Index L3 Orbit
            gas_config: GasConfig::default(),
            retry_config: RetryConfig::default(),
        }
    }
}

/// Type alias for the signer middleware
pub type SignerClient = SignerMiddleware<Provider<Http>, LocalWallet>;

/// ChainWriter implementation using ethers-rs
///
/// Submits transactions to the Index L3 chain with:
/// - Nonce management for concurrent submissions
/// - Gas estimation with configurable multiplier
/// - Retry logic with exponential backoff
pub struct EthersChainWriter {
    /// Signer middleware (provider + wallet)
    client: Arc<SignerClient>,
    /// Configuration
    config: ChainWriterConfig,
    /// Nonce manager
    nonce_manager: NonceManager,
    /// Gas estimator
    gas_estimator: GasEstimator<SignerClient>,
}

impl EthersChainWriter {
    /// Create a new EthersChainWriter
    ///
    /// # Arguments
    /// * `config` - Configuration including RPC URL and contract addresses
    /// * `private_key` - Hex-encoded private key (with or without 0x prefix)
    ///
    /// # Errors
    /// Returns error if unable to connect to RPC endpoint or parse private key
    pub fn new(config: ChainWriterConfig, private_key: &str) -> Result<Self, Error> {
        let provider = Provider::<Http>::try_from(&config.rpc_url)
            .map_err(|e| Error::ChainWrite(format!("Failed to create provider: {}", e)))?;

        // Parse private key (handle both with and without 0x prefix)
        let key_hex = private_key.trim_start_matches("0x");
        let wallet: LocalWallet = key_hex
            .parse::<LocalWallet>()
            .map_err(|e| Error::ChainWrite(format!("Failed to parse private key: {}", e)))?
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
            "EthersChainWriter initialized"
        );

        Ok(Self {
            client: client_arc,
            config,
            nonce_manager,
            gas_estimator,
        })
    }

    /// Create a new EthersChainWriter from a key file
    ///
    /// # Arguments
    /// * `config` - Configuration including RPC URL and contract addresses
    /// * `key_path` - Path to file containing private key (hex or encrypted)
    ///
    /// # Errors
    /// Returns error if unable to read key file
    pub fn from_key_file<P: AsRef<Path>>(config: ChainWriterConfig, key_path: P) -> Result<Self, Error> {
        let key_content = std::fs::read_to_string(key_path.as_ref())
            .map_err(|e| Error::ChainWrite(format!("Failed to read key file: {}", e)))?;

        // Trim whitespace and newlines
        let private_key = key_content.trim();

        Self::new(config, private_key)
    }

    /// Get the signer address
    pub fn address(&self) -> Address {
        self.client.address()
    }

    /// Get the configuration
    pub fn config(&self) -> &ChainWriterConfig {
        &self.config
    }

    /// Wait for a transaction receipt with timeout
    ///
    /// # Arguments
    /// * `tx_hash` - Transaction hash to wait for
    /// * `timeout_secs` - Maximum seconds to wait (default: 30)
    ///
    /// # Returns
    /// Transaction receipt on success
    async fn wait_for_receipt(
        &self,
        tx_hash: H256,
        timeout_secs: u64,
    ) -> Result<TransactionReceipt, Error> {
        let pending = PendingTransaction::new(tx_hash, self.client.provider());

        tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            pending,
        )
        .await
        .map_err(|_| Error::ChainWrite(format!(
            "Timeout waiting for receipt after {}s: {:?}",
            timeout_secs, tx_hash
        )))?
        .map_err(|e| Error::ChainWrite(format!("Failed to get receipt: {}", e)))?
        .ok_or_else(|| Error::ChainWrite(format!("Receipt not found: {:?}", tx_hash)))
    }

    /// Build a confirmBatch transaction
    ///
    /// Encodes: Index.confirmBatch(cycleNumber, orderIds, blsSignature)
    fn build_confirm_batch_tx(
        &self,
        cycle_number: u64,
        order_ids: Vec<u64>,
        bls_signature: Vec<u8>,
    ) -> TypedTransaction {
        // Function signature: confirmBatch(uint256,uint256[],bytes)
        // Selector = keccak256("confirmBatch(uint256,uint256[],bytes)")[:4]
        let function = ethers::abi::Function {
            name: "confirmBatch".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "cycleNumber".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "orderIds".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        // ABI encode the parameters
        let order_ids_u256: Vec<U256> = order_ids.iter().map(|&id| U256::from(id)).collect();

        let tokens = vec![
            ethers::abi::Token::Uint(U256::from(cycle_number)),
            ethers::abi::Token::Array(
                order_ids_u256
                    .iter()
                    .map(|&id| ethers::abi::Token::Uint(id))
                    .collect(),
            ),
            ethers::abi::Token::Bytes(bls_signature),
        ];

        // encode_input includes the 4-byte selector + ABI-encoded params
        // SAFETY: ABI encoding is deterministic for valid tokens; failure indicates a code bug.
        let calldata = function.encode_input(&tokens).expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(self.config.contracts.index)
            .data(calldata)
            .into()
    }

    /// Build a confirmFills transaction
    ///
    /// Encodes: Index.confirmFills(cycleNumber, fills, blsSignature)
    fn build_confirm_fills_tx(
        &self,
        cycle_number: u64,
        fills: Vec<Fill>,
        bls_signature: Vec<u8>,
    ) -> TypedTransaction {
        // Function signature: confirmFills(uint256,(uint256,uint256,uint256,uint256,bytes32)[],bytes)
        // Fill struct: (orderId, fillPrice, fillAmount, cycleNumber, txHash)
        let fill_tuple_type = ethers::abi::ParamType::Tuple(vec![
            ethers::abi::ParamType::Uint(256), // orderId
            ethers::abi::ParamType::Uint(256), // fillPrice
            ethers::abi::ParamType::Uint(256), // fillAmount
            ethers::abi::ParamType::Uint(256), // cycleNumber
            ethers::abi::ParamType::FixedBytes(32), // txHash
        ]);

        let function = ethers::abi::Function {
            name: "confirmFills".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "cycleNumber".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "fills".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(fill_tuple_type)),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        // Encode fills as array of tuples
        let fill_tokens: Vec<ethers::abi::Token> = fills
            .iter()
            .map(|fill| {
                ethers::abi::Token::Tuple(vec![
                    ethers::abi::Token::Uint(fill.order_id),
                    ethers::abi::Token::Uint(fill.fill_price),
                    ethers::abi::Token::Uint(fill.fill_amount),
                    ethers::abi::Token::Uint(fill.cycle_number),
                    ethers::abi::Token::FixedBytes(fill.tx_hash.as_bytes().to_vec()),
                ])
            })
            .collect();

        let tokens = vec![
            ethers::abi::Token::Uint(U256::from(cycle_number)),
            ethers::abi::Token::Array(fill_tokens),
            ethers::abi::Token::Bytes(bls_signature),
        ];

        // encode_input includes the 4-byte selector + ABI-encoded params
        // SAFETY: ABI encoding is deterministic for valid tokens; failure indicates a code bug.
        let calldata = function.encode_input(&tokens).expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(self.config.contracts.index)
            .data(calldata)
            .into()
    }

    /// Build an initiateBridge transaction
    ///
    /// Encodes: L3BridgeCustody.initiateBridge(destChainId, amount, blsSignature)
    fn build_initiate_bridge_tx(
        &self,
        dest_chain_id: u64,
        amount: U256,
        bls_signature: Vec<u8>,
    ) -> TypedTransaction {
        // Function signature: initiateBridge(uint256,uint256,bytes)
        let function = ethers::abi::Function {
            name: "initiateBridge".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "destChainId".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "amount".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
            ],
            outputs: vec![
                ethers::abi::Param {
                    name: "nonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::Uint(U256::from(dest_chain_id)),
            ethers::abi::Token::Uint(amount),
            ethers::abi::Token::Bytes(bls_signature),
        ];

        // encode_input includes the 4-byte selector + ABI-encoded params
        // SAFETY: ABI encoding is deterministic for valid tokens; failure indicates a code bug.
        let calldata = function.encode_input(&tokens).expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(self.config.contracts.l3_bridge_custody)
            .data(calldata)
            .into()
    }

    /// Submit a transaction with nonce management, gas estimation, and retry logic
    async fn submit_tx(&self, mut tx: TypedTransaction, operation: &str) -> Result<TxHash, Error> {
        // Get nonce
        let nonce = self.nonce_manager.get_next_nonce().await?;
        tx.set_nonce(nonce);

        // Estimate gas
        let gas = self.gas_estimator.estimate_gas(&tx).await?;
        tx.set_gas(gas);

        // Get gas price
        let gas_price = self.gas_estimator.get_gas_price().await?;
        if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx {
            gas_price.apply_to_tx(eip1559_tx);
        }

        debug!(
            operation = operation,
            nonce = ?nonce,
            gas = ?gas,
            to = ?tx.to(),
            "Submitting transaction"
        );

        // Submit with retry
        let client = self.client.clone();
        let retry_config = self.config.retry_config.clone();

        let result = with_retry(&retry_config, operation, || {
            let tx_clone = tx.clone();
            let client_clone = client.clone();
            async move {
                let pending_tx = client_clone
                    .send_transaction(tx_clone, None)
                    .await
                    .map_err(|e| e.to_string())?;

                let tx_hash = pending_tx.tx_hash();
                Ok::<_, String>(tx_hash)
            }
        })
        .await;

        match result {
            Ok(tx_hash) => {
                // Track the pending transaction
                self.nonce_manager.track_pending(nonce, tx_hash);

                info!(
                    operation = operation,
                    tx_hash = ?tx_hash,
                    nonce = ?nonce,
                    "Transaction submitted successfully"
                );

                Ok(tx_hash)
            }
            Err(e) => {
                // Handle failure - update nonce manager
                let error_msg = e.to_string();
                self.nonce_manager.handle_failure(nonce, &error_msg).await?;

                Err(Error::TransactionFailed(format!(
                    "{}: {}",
                    operation, error_msg
                )))
            }
        }
    }
}

#[async_trait]
impl ChainWriter for EthersChainWriter {
    async fn submit_batch(
        &self,
        cycle_number: u64,
        order_ids: Vec<u64>,
        bls_signature: Vec<u8>,
    ) -> Result<TxHash, Error> {
        debug!(
            cycle_number = cycle_number,
            order_count = order_ids.len(),
            signature_len = bls_signature.len(),
            "Building confirmBatch transaction"
        );

        let tx = self.build_confirm_batch_tx(cycle_number, order_ids.clone(), bls_signature);
        self.submit_tx(tx, "submit_batch").await
    }

    async fn confirm_fills(
        &self,
        cycle_number: u64,
        fills: Vec<Fill>,
        bls_signature: Vec<u8>,
    ) -> Result<TxHash, Error> {
        debug!(
            cycle_number = cycle_number,
            fill_count = fills.len(),
            signature_len = bls_signature.len(),
            "Building confirmFills transaction"
        );

        let tx = self.build_confirm_fills_tx(cycle_number, fills, bls_signature);
        self.submit_tx(tx, "confirm_fills").await
    }

    async fn submit_bridge(
        &self,
        dest_chain_id: u64,
        amount: U256,
        bls_signature: Vec<u8>,
    ) -> Result<TxHash, Error> {
        debug!(
            dest_chain_id = dest_chain_id,
            amount = ?amount,
            signature_len = bls_signature.len(),
            "Building initiateBridge transaction"
        );

        let tx = self.build_initiate_bridge_tx(dest_chain_id, amount, bls_signature);
        self.submit_tx(tx, "submit_bridge").await
    }

    async fn create_itp(
        &self,
        name: &str,
        symbol: &str,
        weights: &[U256],
        assets: &[Address],
        prices: &[U256],
        bridge_nonce: U256,
    ) -> Result<H256, Error> {
        // Delegate to inherent method
        EthersChainWriter::create_itp(self, name, symbol, weights, assets, prices, bridge_nonce).await
    }

    async fn send_transaction(
        &self,
        to: Address,
        calldata: Vec<u8>,
        value: U256,
    ) -> Result<TxHash, Error> {
        // Build transaction
        let tx: TypedTransaction = Eip1559TransactionRequest::new()
            .to(to)
            .data(calldata)
            .value(value)
            .into();

        // Estimate gas
        let gas = self
            .client
            .estimate_gas(&tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("gas estimation failed: {}", e)))?;

        // Apply 1.2x multiplier
        let gas_with_buffer = gas * 12 / 10;

        // Create final transaction with gas
        let mut final_tx = tx.clone();
        final_tx.set_gas(gas_with_buffer);

        // Send transaction
        let pending = self
            .client
            .send_transaction(final_tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("send_transaction failed: {}", e)))?;

        // Wait for confirmation
        match pending.await {
            Ok(Some(receipt)) => {
                info!(
                    tx_hash = ?receipt.transaction_hash,
                    to = ?to,
                    "send_transaction confirmed"
                );
                Ok(receipt.transaction_hash)
            }
            Ok(None) => Err(Error::TransactionFailed(
                "send_transaction: no receipt".to_string(),
            )),
            Err(e) => Err(Error::TransactionFailed(format!(
                "send_transaction receipt error: {}",
                e
            ))),
        }
    }

    async fn static_call(
        &self,
        to: Address,
        calldata: Vec<u8>,
    ) -> Result<Vec<u8>, Error> {
        let tx: TypedTransaction = Eip1559TransactionRequest::new()
            .to(to)
            .data(calldata)
            .into();

        let result = self
            .client
            .call(&tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("static_call failed: {}", e)))?;

        Ok(result.to_vec())
    }

    async fn get_block_timestamp(&self) -> Result<U256, Error> {
        let block = self
            .client
            .get_block(ethers::types::BlockNumber::Latest)
            .await
            .map_err(|e| Error::ChainWrite(format!("get_block failed: {}", e)))?
            .ok_or_else(|| Error::ChainWrite("latest block not found".to_string()))?;
        Ok(U256::from(block.timestamp.as_u64()))
    }
}

impl EthersChainWriter {
    /// Build a createITP transaction
    ///
    /// Encodes: Index.createITP(name, symbol, weights, assets)
    /// Returns the L3 ITP ID (bytes32)
    fn build_create_itp_tx(
        &self,
        name: &str,
        symbol: &str,
        weights: &[U256],
        assets: &[Address],
        prices: &[U256],
        bridge_nonce: U256,
    ) -> TypedTransaction {
        // Function signature: createITP(string,string,uint256[],address[],uint256[],uint256)
        let function = ethers::abi::Function {
            name: "createITP".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "name".to_string(),
                    kind: ethers::abi::ParamType::String,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "symbol".to_string(),
                    kind: ethers::abi::ParamType::String,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "weights".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "assets".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Address)),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "prices".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "bridgeNonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            outputs: vec![ethers::abi::Param {
                name: "itpId".to_string(),
                kind: ethers::abi::ParamType::FixedBytes(32),
                internal_type: None,
            }],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::String(name.to_string()),
            ethers::abi::Token::String(symbol.to_string()),
            ethers::abi::Token::Array(
                weights
                    .iter()
                    .map(|&w| ethers::abi::Token::Uint(w))
                    .collect(),
            ),
            ethers::abi::Token::Array(
                assets
                    .iter()
                    .map(|&a| ethers::abi::Token::Address(a))
                    .collect(),
            ),
            ethers::abi::Token::Array(
                prices
                    .iter()
                    .map(|&p| ethers::abi::Token::Uint(p))
                    .collect(),
            ),
            ethers::abi::Token::Uint(bridge_nonce),
        ];

        let calldata = function
            .encode_input(&tokens)
            .expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(self.config.contracts.index)
            .data(calldata)
            .into()
    }

    /// Create an ITP on L3 and return the ITP ID
    ///
    /// # Arguments
    /// * `name` - ITP name
    /// * `symbol` - ITP symbol
    /// * `weights` - Asset weights (sum to 1e18)
    /// * `assets` - Asset addresses
    ///
    /// # Returns
    /// The L3 ITP ID (bytes32) on success
    pub async fn create_itp(
        &self,
        name: &str,
        symbol: &str,
        weights: &[U256],
        assets: &[Address],
        prices: &[U256],
        bridge_nonce: U256,
    ) -> Result<H256, Error> {
        debug!(
            name = name,
            symbol = symbol,
            weight_count = weights.len(),
            asset_count = assets.len(),
            price_count = prices.len(),
            bridge_nonce = %bridge_nonce,
            "Building createITP transaction"
        );

        let tx = self.build_create_itp_tx(name, symbol, weights, assets, prices, bridge_nonce);
        let tx_hash = self.submit_tx(tx, "create_itp").await?;

        // Wait for receipt with 30 second timeout
        let receipt = self.wait_for_receipt(tx_hash, 30).await?;

        // Check if transaction succeeded
        if receipt.status != Some(U64::from(1)) {
            return Err(Error::TransactionFailed(format!(
                "createITP transaction reverted: {:?}",
                tx_hash
            )));
        }

        // Parse the ITP ID from the logs (ITPCreated event)
        // Event signature: ITPCreated(bytes32 indexed itpId, address indexed admin, bytes32 name, bytes32 symbol, address[] assets, uint256[] weights)
        let itp_created_topic = ethers::utils::keccak256(b"ITPCreated(bytes32,address,bytes32,bytes32,address[],uint256[])");

        for log in receipt.logs {
            if log.topics.first() == Some(&H256::from(itp_created_topic)) {
                // The itpId is the second topic (indexed)
                if let Some(itp_id) = log.topics.get(1) {
                    info!(
                        tx_hash = ?tx_hash,
                        itp_id = ?itp_id,
                        "ITP created on L3"
                    );
                    return Ok(*itp_id);
                }
            }
        }

        Err(Error::ChainWrite(
            "ItpCreated event not found in receipt".to_string(),
        ))
    }

    /// Submit an arbitration settlement on-chain
    ///
    /// Encodes: ArbitrationSettlement.settleBet(uint256 betId, bool creatorWins, bytes blsSignature, uint256 signerBitmap)
    ///
    /// # Arguments
    /// * `settlement_contract` - ArbitrationSettlement contract address
    /// * `bet_id` - The bet ID to settle
    /// * `creator_wins` - Whether the creator wins
    /// * `bls_signature` - Aggregated BLS signature (threshold)
    /// * `signer_bitmap` - Bitmap of signing issuer indices
    pub async fn submit_settlement(
        &self,
        settlement_contract: Address,
        bet_id: U256,
        creator_wins: bool,
        bls_signature: Vec<u8>,
        signer_bitmap: U256,
    ) -> Result<TxHash, Error> {
        info!(
            bet_id = %bet_id,
            creator_wins = creator_wins,
            sig_len = bls_signature.len(),
            bitmap = %signer_bitmap,
            settlement = ?settlement_contract,
            "Building settleBet transaction"
        );

        let tx = self.build_settle_bet_tx(
            settlement_contract,
            bet_id,
            creator_wins,
            bls_signature,
            signer_bitmap,
        );
        self.submit_tx(tx, "settle_bet").await
    }

    /// Build a settleBet transaction
    ///
    /// Encodes: settleBet(uint256 betId, bool creatorWins, bytes memory blsSignature, uint256 signerBitmap)
    fn build_settle_bet_tx(
        &self,
        settlement_contract: Address,
        bet_id: U256,
        creator_wins: bool,
        bls_signature: Vec<u8>,
        signer_bitmap: U256,
    ) -> TypedTransaction {
        let function = ethers::abi::Function {
            name: "settleBet".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "betId".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "creatorWins".to_string(),
                    kind: ethers::abi::ParamType::Bool,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignature".to_string(),
                    kind: ethers::abi::ParamType::Bytes,
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "signerBitmap".to_string(),
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
            ethers::abi::Token::Uint(bet_id),
            ethers::abi::Token::Bool(creator_wins),
            ethers::abi::Token::Bytes(bls_signature),
            ethers::abi::Token::Uint(signer_bitmap),
        ];

        let calldata = function
            .encode_input(&tokens)
            .expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(settlement_contract)
            .data(calldata)
            .into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_writer_config_default() {
        let config = ChainWriterConfig::default();
        assert_eq!(config.rpc_url, "http://localhost:8545");
        assert_eq!(config.chain_id, 111222333);
        assert_eq!(config.contracts.index, Address::zero());
        assert_eq!(config.contracts.l3_bridge_custody, Address::zero());
    }

    #[test]
    fn test_writer_contract_addresses_default() {
        let addresses = WriterContractAddresses::default();
        assert_eq!(addresses.index, Address::zero());
        assert_eq!(addresses.l3_bridge_custody, Address::zero());
    }

    #[test]
    fn test_writer_creation_with_valid_key() {
        // Use a well-known test private key
        let private_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let config = ChainWriterConfig::default();

        let result = EthersChainWriter::new(config, private_key);
        assert!(result.is_ok());

        let writer = result.unwrap();
        // The corresponding address for this key
        assert_eq!(
            format!("{:?}", writer.address()),
            "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
        );
    }

    #[test]
    fn test_writer_creation_without_0x_prefix() {
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let config = ChainWriterConfig::default();

        let result = EthersChainWriter::new(config, private_key);
        assert!(result.is_ok());
    }

    #[test]
    fn test_writer_creation_with_invalid_key() {
        let private_key = "invalid_key";
        let config = ChainWriterConfig::default();

        let result = EthersChainWriter::new(config, private_key);
        assert!(result.is_err());
    }

    #[test]
    fn test_build_confirm_batch_tx() {
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let mut config = ChainWriterConfig::default();
        config.contracts.index = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
            .parse()
            .unwrap();

        let writer = EthersChainWriter::new(config, private_key).unwrap();

        let tx = writer.build_confirm_batch_tx(1, vec![1, 2, 3], vec![0u8; 96]);

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        // Verify function selector is correct for confirmBatch(uint256,uint256[],bytes)
        let calldata = tx.data().unwrap();
        let expected_selector = ethers::utils::keccak256("confirmBatch(uint256,uint256[],bytes)");
        assert_eq!(
            &calldata[0..4],
            &expected_selector[0..4],
            "Function selector should match keccak256 of signature"
        );
    }

    #[test]
    fn test_confirm_batch_tx_calldata_structure() {
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let mut config = ChainWriterConfig::default();
        config.contracts.index = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
            .parse()
            .unwrap();

        let writer = EthersChainWriter::new(config, private_key).unwrap();

        // Build with known values
        let tx = writer.build_confirm_batch_tx(42, vec![100, 200], vec![0xaa; 48]);
        let calldata = tx.data().unwrap();

        // Calldata should have: 4 byte selector + ABI encoded params
        // Minimum size: 4 + 32 (cycle) + 32 (offset to array) + 32 (offset to bytes) + 32 (array len) + 64 (2 elements) + 32 (bytes len) + 64 (48 bytes padded)
        assert!(calldata.len() > 4 + 32 * 3, "Calldata should contain encoded parameters");
    }

    #[test]
    fn test_build_confirm_fills_tx() {
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let mut config = ChainWriterConfig::default();
        config.contracts.index = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
            .parse()
            .unwrap();

        let writer = EthersChainWriter::new(config, private_key).unwrap();

        let fill = Fill {
            order_id: U256::from(1),
            fill_price: U256::from(100) * U256::exp10(18),
            fill_amount: U256::from(1000) * U256::exp10(18),
            cycle_number: U256::from(1),
            tx_hash: H256::zero(),
        };

        let tx = writer.build_confirm_fills_tx(1, vec![fill], vec![0u8; 96]);

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        // Verify function selector is correct for confirmFills(uint256,(uint256,uint256,uint256,uint256,bytes32)[],bytes)
        let calldata = tx.data().unwrap();
        let expected_selector = ethers::utils::keccak256(
            "confirmFills(uint256,(uint256,uint256,uint256,uint256,bytes32)[],bytes)"
        );
        assert_eq!(
            &calldata[0..4],
            &expected_selector[0..4],
            "Function selector should match keccak256 of signature"
        );
    }

    #[test]
    fn test_build_initiate_bridge_tx() {
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let mut config = ChainWriterConfig::default();
        config.contracts.l3_bridge_custody = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
            .parse()
            .unwrap();

        let writer = EthersChainWriter::new(config, private_key).unwrap();

        let amount = U256::from(1000) * U256::exp10(18);
        let tx = writer.build_initiate_bridge_tx(42161, amount, vec![0u8; 96]);

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        // Verify function selector is correct for initiateBridge(uint256,uint256,bytes)
        let calldata = tx.data().unwrap();
        let expected_selector = ethers::utils::keccak256("initiateBridge(uint256,uint256,bytes)");
        assert_eq!(
            &calldata[0..4],
            &expected_selector[0..4],
            "Function selector should match keccak256 of signature"
        );
    }

    #[test]
    fn test_build_settle_bet_tx() {
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let config = ChainWriterConfig::default();
        let writer = EthersChainWriter::new(config, private_key).unwrap();

        let settlement = "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
            .parse::<Address>()
            .unwrap();
        let tx = writer.build_settle_bet_tx(
            settlement,
            U256::from(42),
            true,
            vec![0xAA; 64],
            U256::from(5), // bitmap: bits 0 and 2
        );

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        let calldata = tx.data().unwrap();
        let expected_selector =
            ethers::utils::keccak256("settleBet(uint256,bool,bytes,uint256)");
        assert_eq!(
            &calldata[0..4],
            &expected_selector[0..4],
            "Function selector should match keccak256 of settleBet signature"
        );

        // Calldata should contain encoded parameters
        assert!(
            calldata.len() > 4 + 32 * 4,
            "Calldata should contain encoded parameters"
        );
    }

    #[test]
    fn test_chain_writer_implements_trait() {
        // Verify EthersChainWriter can be used as a trait object (object safety)
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let config = ChainWriterConfig::default();
        let writer = EthersChainWriter::new(config, private_key).unwrap();

        // This compiles only if ChainWriter is object-safe
        let _trait_obj: &dyn ChainWriter = &writer;
    }

    #[test]
    fn test_build_create_itp_tx() {
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let mut config = ChainWriterConfig::default();
        config.contracts.index = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
            .parse()
            .unwrap();

        let writer = EthersChainWriter::new(config, private_key).unwrap();

        let name = "Test ITP";
        let symbol = "TITP";
        let weights = vec![U256::from(500_000_000_000_000_000u64), U256::from(500_000_000_000_000_000u64)];
        let assets = vec![
            Address::from([0x11u8; 20]),
            Address::from([0x22u8; 20]),
        ];
        let prices = vec![U256::from(10u64).pow(U256::from(18)), U256::from(10u64).pow(U256::from(18))];
        let bridge_nonce = U256::MAX; // Sentinel for non-bridge calls

        let tx = writer.build_create_itp_tx(name, symbol, &weights, &assets, &prices, bridge_nonce);

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        // Verify function selector is correct for createITP(string,string,uint256[],address[],uint256[],uint256)
        let calldata = tx.data().unwrap();
        let expected_selector = ethers::utils::keccak256("createITP(string,string,uint256[],address[],uint256[],uint256)");
        assert_eq!(
            &calldata[0..4],
            &expected_selector[0..4],
            "Function selector should match keccak256 of signature"
        );

        // Calldata should contain encoded parameters
        // 4 (selector) + offsets + data
        assert!(calldata.len() > 4 + 32 * 6, "Calldata should contain encoded parameters");
    }
}
