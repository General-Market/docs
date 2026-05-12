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
use tracing::{debug, info, warn};

use common::error::Error;
use common::traits::ChainWriter;
use common::types::{Fill, TxHash};

use super::gas::{GasConfig, GasEstimator};
use super::nonce::{get_or_init_nonce_manager, NonceManager};
use super::retry::{with_retry, RetryConfig};

/// Contract addresses for Index L3 chain writer
#[derive(Debug, Clone)]
pub struct WriterContractAddresses {
    /// Index.sol contract address for batch/fill operations
    pub index: Address,
    /// L3BridgeCustody.sol contract address for bridge operations
    pub l3_bridge_custody: Address,
    /// Vision.sol contract address for Vision prediction market operations
    pub vision: Address,
    /// VisionReconciler.sol helper — bundled vault reconciles. `Address::zero()`
    /// falls back to the per-player loop.
    pub vision_reconciler: Address,
}

impl Default for WriterContractAddresses {
    fn default() -> Self {
        Self {
            index: Address::zero(),
            l3_bridge_custody: Address::zero(),
            vision: Address::zero(),
            vision_reconciler: Address::zero(),
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
/// One unit of a `settleBatches` bundle. Each item carries its own BLS proof
/// so on-chain consensus semantics match the per-batch path exactly.
#[derive(Debug, Clone)]
pub struct SettleBatchItem {
    pub batch_id: u64,
    pub players: Vec<Address>,
    pub payouts: Vec<U256>,
    pub bls_sig: Vec<u8>,
    pub ref_nonce: u64,
    pub signers_bitmask: U256,
}

pub struct EthersChainWriter {
    /// Signer middleware (provider + wallet)
    client: Arc<SignerClient>,
    /// Configuration
    config: ChainWriterConfig,
    /// Nonce manager — singleton per (chain_id, signer address) across the process.
    nonce_manager: Arc<NonceManager>,
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
            .map_err(|e| Error::ChainWrite(format!("Failed to create provider: {}", e)))?
            .interval(std::time::Duration::from_millis(50)); // L3 has instant finality, poll fast

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

        // Fetch the singleton nonce manager for this (chain, address). Two
        // writers built independently against the same key share one broker.
        let nonce_manager = get_or_init_nonce_manager(config.chain_id, address, provider_arc);

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
        let pending = PendingTransaction::new(tx_hash, self.client.provider())
            .interval(std::time::Duration::from_millis(50));

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
    /// Encodes: Index.confirmBatch(cycleNumber, orderIds, blsSignature, referenceNonce, signersBitmask)
    fn build_confirm_batch_tx(
        &self,
        cycle_number: u64,
        order_ids: Vec<u64>,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: confirmBatch(uint256,uint256[],bytes,uint256,uint256)
        // Selector = keccak256("confirmBatch(uint256,uint256[],bytes,uint256,uint256)")[:4]
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
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
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
    /// Encodes: Index.confirmFills(cycleNumber, fills, blsSignature, referenceNonce, signersBitmask)
    fn build_confirm_fills_tx(
        &self,
        cycle_number: u64,
        fills: Vec<Fill>,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: confirmFills(uint256,(uint256,uint256,uint256,uint256,bytes32)[],bytes,uint256,uint256)
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
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
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
    /// Encodes: L3BridgeCustody.initiateBridge(destChainId, amount, blsSignature, referenceNonce, signersBitmask)
    fn build_initiate_bridge_tx(
        &self,
        dest_chain_id: u64,
        amount: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: initiateBridge(uint256,uint256,bytes,uint256,uint256)
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
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        // encode_input includes the 4-byte selector + ABI-encoded params
        // SAFETY: ABI encoding is deterministic for valid tokens; failure indicates a code bug.
        let calldata = function.encode_input(&tokens).expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(self.config.contracts.l3_bridge_custody)
            .data(calldata)
            .into()
    }

    /// Build a createBatch transaction
    ///
    /// Encodes: Vision.createBatch(sourceId, configHash, tickDuration, lockOffset, settlementGrace, blsSignature, referenceNonce, signersBitmask)
    fn build_create_batch_tx(
        &self,
        source_id: H256,
        config_hash: H256,
        tick_duration: u64,
        lock_offset: u64,
        settlement_grace: u64,
        bls_sig: &[u8],
        ref_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: createBatch(bytes32,bytes32,uint256,uint256,uint256,bytes,uint256,uint256)
        let function = ethers::abi::Function {
            name: "createBatch".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "sourceId".to_string(),
                    kind: ethers::abi::ParamType::FixedBytes(32),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "configHash".to_string(),
                    kind: ethers::abi::ParamType::FixedBytes(32),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "tickDuration".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "lockOffset".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "settlementGrace".to_string(),
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
            outputs: vec![
                ethers::abi::Param {
                    name: "batchId".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
            ],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::FixedBytes(source_id.as_bytes().to_vec()),
            ethers::abi::Token::FixedBytes(config_hash.as_bytes().to_vec()),
            ethers::abi::Token::Uint(U256::from(tick_duration)),
            ethers::abi::Token::Uint(U256::from(lock_offset)),
            ethers::abi::Token::Uint(U256::from(settlement_grace)),
            ethers::abi::Token::Bytes(bls_sig.to_vec()),
            ethers::abi::Token::Uint(U256::from(ref_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        let calldata = function.encode_input(&tokens).expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(self.config.contracts.vision)
            .data(calldata)
            .into()
    }

    /// Submit a createBatch transaction to Vision.sol on L3.
    ///
    /// Returns `(tx_hash, on_chain_batch_id)`. The `on_chain_batch_id` is parsed
    /// from the `BatchCreated` event in the receipt logs. This is the contract-assigned
    /// batch ID that the scheduler and other subsystems must use for tracking.
    #[allow(clippy::too_many_arguments)]
    pub async fn create_batch(
        &self,
        source_id: H256,
        config_hash: H256,
        tick_duration: u64,
        lock_offset: u64,
        settlement_grace: u64,
        bls_sig: Vec<u8>,
        ref_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<(TxHash, u64), Error> {
        info!(
            source_id = ?source_id,
            config_hash = ?config_hash,
            tick_duration,
            lock_offset,
            settlement_grace,
            signature_len = bls_sig.len(),
            ref_nonce,
            signers_bitmask = %signers_bitmask,
            "Building createBatch transaction"
        );

        let tx = self.build_create_batch_tx(
            source_id, config_hash, tick_duration, lock_offset, settlement_grace,
            &bls_sig, ref_nonce, signers_bitmask,
        );
        let (tx_hash, receipt) = self.submit_tx_with_receipt(tx, "create_batch").await?;

        // Parse on-chain batchId from BatchCreated event in receipt logs.
        // Event: BatchCreated(uint256 indexed batchId, bytes32 indexed sourceId, address indexed creator, ...)
        // batchId is topics[1] (first indexed param).
        let batch_created_topic = H256::from(ethers::utils::keccak256(
            b"BatchCreated(uint256,bytes32,address,bytes32,uint256,uint256,uint256)",
        ));

        let on_chain_batch_id = receipt.logs.iter()
            .find(|log| log.topics.first() == Some(&batch_created_topic))
            .and_then(|log| log.topics.get(1))
            .map(|topic| U256::from(topic.as_bytes()).as_u64())
            .ok_or_else(|| Error::ChainWrite(format!(
                "createBatch tx {:?} succeeded but no BatchCreated event found in receipt logs",
                tx_hash,
            )))?;

        info!(
            tx_hash = ?tx_hash,
            on_chain_batch_id,
            "Parsed on-chain batchId from BatchCreated event"
        );

        Ok((tx_hash, on_chain_batch_id))
    }

    /// Build a settleBatch transaction
    ///
    /// Encodes: Vision.settleBatch(batchId, players, payouts, blsSignature, referenceNonce, signersBitmask)
    fn build_settle_batch_tx(
        &self,
        batch_id: u64,
        players: &[Address],
        payouts: &[U256],
        bls_sig: &[u8],
        ref_nonce: u64,
        signers_bitmask: U256,
    ) -> TypedTransaction {
        // Function signature: settleBatch(uint256,address[],uint256[],bytes,uint256,uint256)
        let function = ethers::abi::Function {
            name: "settleBatch".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "batchId".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "players".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Address)),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "payouts".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
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
            ethers::abi::Token::Uint(U256::from(batch_id)),
            ethers::abi::Token::Array(
                players
                    .iter()
                    .map(|&a| ethers::abi::Token::Address(a))
                    .collect(),
            ),
            ethers::abi::Token::Array(
                payouts
                    .iter()
                    .map(|&p| ethers::abi::Token::Uint(p))
                    .collect(),
            ),
            ethers::abi::Token::Bytes(bls_sig.to_vec()),
            ethers::abi::Token::Uint(U256::from(ref_nonce)),
            ethers::abi::Token::Uint(signers_bitmask),
        ];

        // SAFETY: ABI encoding is deterministic for valid tokens; failure indicates a code bug.
        let calldata = function.encode_input(&tokens).expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(self.config.contracts.vision)
            .data(calldata)
            .into()
    }

    /// Submit a settleBatch transaction to Vision.sol on L3.
    pub async fn settle_batch(
        &self,
        batch_id: u64,
        players: Vec<Address>,
        payouts: Vec<U256>,
        bls_sig: Vec<u8>,
        ref_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        debug!(
            batch_id = batch_id,
            player_count = players.len(),
            signature_len = bls_sig.len(),
            ref_nonce = ref_nonce,
            signers_bitmask = %signers_bitmask,
            "Building settleBatch transaction"
        );

        let tx = self.build_settle_batch_tx(batch_id, &players, &payouts, &bls_sig, ref_nonce, signers_bitmask);
        self.submit_tx(tx, "settle_batch").await
    }

    /// Build a settleBatches transaction.
    ///
    /// Encodes: Vision.settleBatches(uint256[], address[][], uint256[][], bytes[],
    ///                               uint256[], uint256[])
    fn build_settle_batches_tx(&self, items: &[SettleBatchItem]) -> TypedTransaction {
        let function = ethers::abi::Function {
            name: "settleBatches".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "batchIds".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "players".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(
                        ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Address)),
                    )),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "payouts".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(
                        ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
                    )),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "blsSignatures".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Bytes)),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "referenceNonces".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "signersBitmasks".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let batch_ids = ethers::abi::Token::Array(
            items.iter().map(|i| ethers::abi::Token::Uint(U256::from(i.batch_id))).collect(),
        );
        let players = ethers::abi::Token::Array(
            items
                .iter()
                .map(|i| {
                    ethers::abi::Token::Array(
                        i.players.iter().map(|&a| ethers::abi::Token::Address(a)).collect(),
                    )
                })
                .collect(),
        );
        let payouts = ethers::abi::Token::Array(
            items
                .iter()
                .map(|i| {
                    ethers::abi::Token::Array(
                        i.payouts.iter().map(|&p| ethers::abi::Token::Uint(p)).collect(),
                    )
                })
                .collect(),
        );
        let sigs = ethers::abi::Token::Array(
            items
                .iter()
                .map(|i| ethers::abi::Token::Bytes(i.bls_sig.clone()))
                .collect(),
        );
        let ref_nonces = ethers::abi::Token::Array(
            items.iter().map(|i| ethers::abi::Token::Uint(U256::from(i.ref_nonce))).collect(),
        );
        let bitmasks = ethers::abi::Token::Array(
            items.iter().map(|i| ethers::abi::Token::Uint(i.signers_bitmask)).collect(),
        );

        let calldata = function
            .encode_input(&[batch_ids, players, payouts, sigs, ref_nonces, bitmasks])
            .expect("ABI encoding should not fail");

        Eip1559TransactionRequest::new()
            .to(self.config.contracts.vision)
            .data(calldata)
            .into()
    }

    /// Submit a settleBatches transaction to Vision.sol on L3.
    ///
    /// One nonce, one tx header, N sub-settlements. Each item keeps its own BLS
    /// signature — consensus protocol unchanged. The caller is responsible for
    /// chunking by block gas; the contract enforces no upper bound on `items.len()`.
    pub async fn settle_batches(&self, items: Vec<SettleBatchItem>) -> Result<TxHash, Error> {
        if items.is_empty() {
            return Err(Error::InvalidArgument("settle_batches: empty items".to_string()));
        }
        debug!(
            count = items.len(),
            batch_ids = ?items.iter().map(|i| i.batch_id).collect::<Vec<_>>(),
            "Building settleBatches transaction"
        );
        let tx = self.build_settle_batches_tx(&items);
        self.submit_tx(tx, "settle_batches").await
    }

    /// Call `VisionVault.reconcile(batchId, settlementPayout)` on each player address.
    /// Vaults update their NAV/TVL accounting; non-vault addresses revert harmlessly.
    /// Payouts are the GROSS amounts from settleBatch — net payout after Vision's
    /// protocol fee is slightly lower, but close enough for PnL reporting.
    pub async fn reconcile_vaults(&self, batch_id: u64, players: &[Address], payouts: &[U256]) {
        // Bundled path: one tx through VisionReconciler.reconcileMany when wired.
        if self.config.contracts.vision_reconciler != Address::zero() {
            if let Err(e) = self.reconcile_vaults_bundled(batch_id, players, payouts).await {
                warn!(
                    batch_id,
                    error = %e,
                    "Bundled vault reconcile failed — falling back to per-player loop"
                );
            } else {
                return;
            }
        }

        // reconcile(uint256,uint256) selector = keccak256("reconcile(uint256,uint256)")[:4]
        let selector: [u8; 4] = [0x49, 0xe2, 0x7d, 0x69];

        for (i, player) in players.iter().enumerate() {
            let payout = if i < payouts.len() { payouts[i] } else { U256::zero() };
            let batch_token = ethers::abi::Token::Uint(U256::from(batch_id));
            let payout_token = ethers::abi::Token::Uint(payout);
            let encoded_args = ethers::abi::encode(&[batch_token, payout_token]);
            let mut calldata = selector.to_vec();
            calldata.extend_from_slice(&encoded_args);

            let tx: TypedTransaction = Eip1559TransactionRequest::new()
                .to(*player)
                .data(calldata)
                .into();

            match self.submit_tx(tx, "vault_reconcile").await {
                Ok(tx_hash) => {
                    info!(
                        batch_id,
                        vault = %player,
                        tx = %tx_hash,
                        "Vault reconciled"
                    );
                }
                Err(e) => {
                    // Expected for non-vault addresses or already-reconciled vaults
                    let err_str = e.to_string().to_lowercase();
                    if err_str.contains("revert") || err_str.contains("already") {
                        debug!(batch_id, address = %player, "Not a vault or already reconciled — skipping");
                    } else {
                        warn!(batch_id, address = %player, error = %e, "Vault reconcile failed unexpectedly");
                    }
                }
            }
        }
    }

    /// One tx through VisionReconciler.reconcileMany — fan-out happens inside
    /// the helper contract. Per-vault failures are swallowed by the contract
    /// (the loop is `(bool ok, ) = vault.call(...)`); EOAs and already-reconciled
    /// vaults remain harmless. Returns the bundle tx hash on success.
    async fn reconcile_vaults_bundled(
        &self,
        batch_id: u64,
        players: &[Address],
        payouts: &[U256],
    ) -> Result<TxHash, Error> {
        if players.is_empty() {
            return Err(Error::InvalidArgument("reconcile_vaults_bundled: empty players".to_string()));
        }
        // Pad payouts to match players length — older callers may pass a shorter slice.
        let padded_payouts: Vec<U256> = (0..players.len())
            .map(|i| if i < payouts.len() { payouts[i] } else { U256::zero() })
            .collect();

        let function = ethers::abi::Function {
            name: "reconcileMany".to_string(),
            inputs: vec![
                ethers::abi::Param {
                    name: "vaults".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Address)),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "batchId".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
                    internal_type: None,
                },
                ethers::abi::Param {
                    name: "payouts".to_string(),
                    kind: ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Uint(256))),
                    internal_type: None,
                },
            ],
            outputs: vec![],
            #[allow(deprecated)]
            constant: None,
            state_mutability: ethers::abi::StateMutability::NonPayable,
        };

        let tokens = vec![
            ethers::abi::Token::Array(
                players.iter().map(|&a| ethers::abi::Token::Address(a)).collect(),
            ),
            ethers::abi::Token::Uint(U256::from(batch_id)),
            ethers::abi::Token::Array(
                padded_payouts.iter().map(|&p| ethers::abi::Token::Uint(p)).collect(),
            ),
        ];

        let calldata = function.encode_input(&tokens).expect("ABI encoding should not fail");

        let tx: TypedTransaction = Eip1559TransactionRequest::new()
            .to(self.config.contracts.vision_reconciler)
            .data(calldata)
            .into();

        let tx_hash = self.submit_tx(tx, "vault_reconcile_bundled").await?;
        info!(
            batch_id,
            count = players.len(),
            tx = %tx_hash,
            reconciler = %self.config.contracts.vision_reconciler,
            "Vault reconciles bundled in one tx"
        );
        Ok(tx_hash)
    }

    /// Submit a transaction with nonce management, gas estimation, and retry logic.
    ///
    /// Includes nonce-level retry: when concurrent L3 operations cause "nonce too low",
    /// resyncs the nonce manager and retries with a fresh nonce (up to 3 attempts).
    /// This handles the case where bridge buy/sell/batch operations compete for nonces.
    async fn submit_tx(&self, tx: TypedTransaction, operation: &str) -> Result<TxHash, Error> {
        let (tx_hash, _receipt) = self.submit_tx_with_receipt(tx, operation).await?;
        Ok(tx_hash)
    }

    /// Like `submit_tx` but also returns the `TransactionReceipt`.
    /// Callers that need event logs (e.g. `create_batch` parsing `BatchCreated`) use this.
    async fn submit_tx_with_receipt(
        &self,
        tx: TypedTransaction,
        operation: &str,
    ) -> Result<(TxHash, TransactionReceipt), Error> {
        const MAX_NONCE_RETRIES: u32 = 3;

        for nonce_attempt in 0..=MAX_NONCE_RETRIES {
            let tx_start = std::time::Instant::now();

            // Estimate gas BEFORE nonce (gas estimation may fail on contract revert,
            // and we don't want to consume a nonce for a tx that won't be sent)
            let t0 = std::time::Instant::now();
            let gas = self.gas_estimator.estimate_gas(&tx.clone().into()).await?;
            let gas_est_ms = t0.elapsed().as_millis();

            // Get nonce (fresh on each attempt after resync)
            let nonce = self.nonce_manager.get_next_nonce().await?;
            let mut tx_with_nonce = tx.clone();
            tx_with_nonce.set_nonce(nonce);
            tx_with_nonce.set_gas(gas);

            // Get gas price
            let t1 = std::time::Instant::now();
            let gas_price = self.gas_estimator.get_gas_price().await?;
            if let TypedTransaction::Eip1559(ref mut eip1559_tx) = tx_with_nonce {
                gas_price.apply_to_tx(eip1559_tx);
            }
            let gas_price_ms = t1.elapsed().as_millis();

            debug!(
                operation = operation,
                nonce = ?nonce,
                gas = ?gas,
                nonce_attempt = nonce_attempt,
                to = ?tx_with_nonce.to(),
                gas_est_ms = gas_est_ms,
                gas_price_ms = gas_price_ms,
                "Submitting transaction"
            );

            // Submit with retry (handles transient errors like timeouts, 5xx)
            let client = self.client.clone();
            let retry_config = self.config.retry_config.clone();

            let t2 = std::time::Instant::now();
            let result = with_retry(&retry_config, operation, || {
                let tx_clone = tx_with_nonce.clone();
                let client_clone = client.clone();
                async move {
                    let send_start = std::time::Instant::now();
                    let pending_tx = client_clone
                        .send_transaction(tx_clone, None)
                        .await
                        .map_err(|e| e.to_string())?;

                    let tx_hash = pending_tx.tx_hash();
                    let send_ms = send_start.elapsed().as_millis();

                    // Wait for receipt and verify on-chain success.
                    // L3 has instant finality — provider interval set to 50ms at construction.
                    let receipt_start = std::time::Instant::now();
                    let receipt = pending_tx
                        .confirmations(0)
                        .await
                        .map_err(|e| format!("waiting for receipt: {e}"))?
                        .ok_or_else(|| "receipt not found after confirmation".to_string())?;
                    let receipt_ms = receipt_start.elapsed().as_millis();

                    tracing::info!(
                        ?tx_hash,
                        send_ms = send_ms,
                        receipt_ms = receipt_ms,
                        "L3 tx timing breakdown"
                    );

                    // status == Some(0) means the TX reverted on-chain
                    if receipt.status == Some(ethers::types::U64::zero()) {
                        return Err(format!(
                            "transaction {tx_hash:?} reverted on-chain (status=0)"
                        ));
                    }

                    Ok::<_, String>((tx_hash, receipt))
                }
            })
            .await;
            let submit_total_ms = t2.elapsed().as_millis();

            info!(
                operation = operation,
                gas_est_ms = gas_est_ms,
                gas_price_ms = gas_price_ms,
                submit_total_ms = submit_total_ms,
                total_ms = tx_start.elapsed().as_millis(),
                "submit_tx timing"
            );

            match result {
                Ok((tx_hash, receipt)) => {
                    // Track the pending transaction
                    self.nonce_manager.track_pending(nonce, tx_hash);

                    if nonce_attempt > 0 {
                        info!(
                            operation = operation,
                            tx_hash = ?tx_hash,
                            nonce = ?nonce,
                            nonce_attempt = nonce_attempt,
                            "Transaction submitted successfully after nonce retry"
                        );
                    } else {
                        info!(
                            operation = operation,
                            tx_hash = ?tx_hash,
                            nonce = ?nonce,
                            "Transaction submitted successfully"
                        );
                    }

                    return Ok((tx_hash, receipt));
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    self.nonce_manager.handle_failure(nonce, &error_msg).await?;

                    // Check if this is a nonce conflict from concurrent operations
                    // or local-counter drift after a reorg.
                    let is_nonce_error = {
                        let lower = error_msg.to_lowercase();
                        lower.contains("nonce too low")
                            || lower.contains("nonce has already been used")
                            || lower.contains("nonce too high")
                    };

                    if is_nonce_error && nonce_attempt < MAX_NONCE_RETRIES {
                        warn!(
                            code = "INFRA-002",
                            operation = operation,
                            nonce = ?nonce,
                            nonce_attempt = nonce_attempt,
                            "Nonce conflict (concurrent operations), retrying with fresh nonce"
                        );
                        continue;
                    }

                    return Err(Error::TransactionFailed(format!(
                        "{}: {}",
                        operation, error_msg
                    )));
                }
            }
        }

        Err(Error::TransactionFailed(format!(
            "{}: max nonce retries exceeded",
            operation
        )))
    }
}

#[async_trait]
impl ChainWriter for EthersChainWriter {
    async fn submit_batch(
        &self,
        cycle_number: u64,
        order_ids: Vec<u64>,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        debug!(
            cycle_number = cycle_number,
            order_count = order_ids.len(),
            signature_len = bls_signature.len(),
            reference_nonce = reference_nonce,
            signers_bitmask = %signers_bitmask,
            "Building confirmBatch transaction"
        );

        let tx = self.build_confirm_batch_tx(cycle_number, order_ids.clone(), bls_signature, reference_nonce, signers_bitmask);
        self.submit_tx(tx, "submit_batch").await
    }

    async fn confirm_fills(
        &self,
        cycle_number: u64,
        fills: Vec<Fill>,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        debug!(
            cycle_number = cycle_number,
            fill_count = fills.len(),
            signature_len = bls_signature.len(),
            reference_nonce = reference_nonce,
            signers_bitmask = %signers_bitmask,
            "Building confirmFills transaction"
        );

        let tx = self.build_confirm_fills_tx(cycle_number, fills, bls_signature, reference_nonce, signers_bitmask);
        self.submit_tx(tx, "confirm_fills").await
    }

    async fn submit_bridge(
        &self,
        dest_chain_id: u64,
        amount: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        debug!(
            dest_chain_id = dest_chain_id,
            amount = ?amount,
            signature_len = bls_signature.len(),
            reference_nonce = reference_nonce,
            signers_bitmask = %signers_bitmask,
            "Building initiateBridge transaction"
        );

        let tx = self.build_initiate_bridge_tx(dest_chain_id, amount, bls_signature, reference_nonce, signers_bitmask);
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
        EthersChainWriter::create_itp(self, name, symbol, weights, assets, prices, bridge_nonce).await
    }

    async fn send_transaction(
        &self,
        to: Address,
        calldata: Vec<u8>,
        value: U256,
    ) -> Result<TxHash, Error> {
        let tx: TypedTransaction = Eip1559TransactionRequest::new()
            .to(to)
            .data(Bytes::from(calldata))
            .value(value)
            .into();
        self.submit_tx(tx, "send_transaction").await
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
    /// Encodes: Index.createITP(name, symbol, weights, assets, prices, bridgeNonce)
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
        // Must match Investment.sol exactly — contract uses msg.sender as creator
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

        // No ITPCreated event — the contract's idempotency check returned the existing
        // ITP without emitting an event. Query _bridgeNonceToItpId(nonce) to get the ID.
        let calldata = {
            // _bridgeNonceToItpId(uint256) selector = keccak256("_bridgeNonceToItpId(uint256)")[..4]
            let selector = &ethers::utils::keccak256(b"_bridgeNonceToItpId(uint256)")[..4];
            let mut data = selector.to_vec();
            let mut nonce_bytes = [0u8; 32];
            bridge_nonce.to_big_endian(&mut nonce_bytes);
            data.extend_from_slice(&nonce_bytes);
            data
        };

        let call_tx = Eip1559TransactionRequest::new()
            .to(self.config.contracts.index)
            .data(calldata);
        match self.client.call(&call_tx.into(), None).await {
            Ok(result) if result.len() >= 32 => {
                let itp_id = H256::from_slice(&result[..32]);
                if itp_id != H256::zero() {
                    info!(
                        tx_hash = ?tx_hash,
                        itp_id = ?itp_id,
                        bridge_nonce = %bridge_nonce,
                        "ITP already exists on L3 (idempotent)"
                    );
                    return Ok(itp_id);
                }
            }
            _ => {}
        }

        Err(Error::ChainWrite(
            "ItpCreated event not found in receipt".to_string(),
        ))
    }

    /// Submit an arbitration settlement on-chain
    ///
    /// Encodes: ArbitrationSettlement.settleBet(uint256 betId, bool creatorWins, bytes blsSignature, uint256 referenceNonce, uint256 signerBitmap)
    ///
    /// # Arguments
    /// * `settlement_contract` - ArbitrationSettlement contract address
    /// * `bet_id` - The bet ID to settle
    /// * `creator_wins` - Whether the creator wins
    /// * `bls_signature` - Aggregated BLS signature (threshold)
    /// * `reference_nonce` - Reference nonce for replay protection
    /// * `signer_bitmap` - Bitmap of signing oracle indices
    pub async fn submit_settlement(
        &self,
        settlement_contract: Address,
        bet_id: U256,
        creator_wins: bool,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signer_bitmap: U256,
    ) -> Result<TxHash, Error> {
        info!(
            bet_id = %bet_id,
            creator_wins = creator_wins,
            sig_len = bls_signature.len(),
            reference_nonce = reference_nonce,
            bitmap = %signer_bitmap,
            settlement = ?settlement_contract,
            "Building settleBet transaction"
        );

        let tx = self.build_settle_bet_tx(
            settlement_contract,
            bet_id,
            creator_wins,
            bls_signature,
            reference_nonce,
            signer_bitmap,
        );
        self.submit_tx(tx, "settle_bet").await
    }

    /// Build a settleBet transaction
    ///
    /// Encodes: settleBet(uint256 betId, bool creatorWins, bytes memory blsSignature, uint256 referenceNonce, uint256 signerBitmap)
    fn build_settle_bet_tx(
        &self,
        settlement_contract: Address,
        bet_id: U256,
        creator_wins: bool,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
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
                    name: "referenceNonce".to_string(),
                    kind: ethers::abi::ParamType::Uint(256),
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
            ethers::abi::Token::Uint(U256::from(reference_nonce)),
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

        let tx = writer.build_confirm_batch_tx(1, vec![1, 2, 3], vec![0u8; 96], 0, U256::from(7));

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        // Verify function selector is correct for confirmBatch(uint256,uint256[],bytes,uint256,uint256)
        let calldata = tx.data().unwrap();
        let expected_selector = ethers::utils::keccak256("confirmBatch(uint256,uint256[],bytes,uint256,uint256)");
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
        let tx = writer.build_confirm_batch_tx(42, vec![100, 200], vec![0xaa; 48], 5, U256::from(3));
        let calldata = tx.data().unwrap();

        // Calldata should have: 4 byte selector + ABI encoded params
        // Minimum size: 4 + 32 (cycle) + 32 (offset to array) + 32 (offset to bytes) + 32 (refNonce) + 32 (bitmask) + ...
        assert!(calldata.len() > 4 + 32 * 5, "Calldata should contain encoded parameters");
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

        let tx = writer.build_confirm_fills_tx(1, vec![fill], vec![0u8; 96], 0, U256::from(7));

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        // Verify function selector is correct for confirmFills(uint256,(uint256,uint256,uint256,uint256,bytes32)[],bytes,uint256,uint256)
        let calldata = tx.data().unwrap();
        let expected_selector = ethers::utils::keccak256(
            "confirmFills(uint256,(uint256,uint256,uint256,uint256,bytes32)[],bytes,uint256,uint256)"
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
        let tx = writer.build_initiate_bridge_tx(42161, amount, vec![0u8; 96], 0, U256::from(7));

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        // Verify function selector is correct for initiateBridge(uint256,uint256,bytes,uint256,uint256)
        let calldata = tx.data().unwrap();
        let expected_selector = ethers::utils::keccak256("initiateBridge(uint256,uint256,bytes,uint256,uint256)");
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
            10, // reference_nonce
            U256::from(5), // bitmap: bits 0 and 2
        );

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        let calldata = tx.data().unwrap();
        let expected_selector =
            ethers::utils::keccak256("settleBet(uint256,bool,bytes,uint256,uint256)");
        assert_eq!(
            &calldata[0..4],
            &expected_selector[0..4],
            "Function selector should match keccak256 of settleBet signature"
        );

        // Calldata should contain encoded parameters
        assert!(
            calldata.len() > 4 + 32 * 5,
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

    #[test]
    fn test_build_settle_batch_tx() {
        let private_key = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        let mut config = ChainWriterConfig::default();
        config.contracts.vision = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
            .parse()
            .unwrap();

        let writer = EthersChainWriter::new(config, private_key).unwrap();

        let players = vec![Address::from([0x11u8; 20]), Address::from([0x22u8; 20])];
        let payouts = vec![U256::from(1_000_000u64), U256::from(2_000_000u64)];
        let tx = writer.build_settle_batch_tx(7, &players, &payouts, &[0u8; 96], 3, U256::from(3));

        assert!(tx.to().is_some());
        assert!(tx.data().is_some());

        // Verify function selector: settleBatch(uint256,address[],uint256[],bytes,uint256,uint256)
        let calldata = tx.data().unwrap();
        let expected_selector = ethers::utils::keccak256(
            "settleBatch(uint256,address[],uint256[],bytes,uint256,uint256)"
        );
        assert_eq!(
            &calldata[0..4],
            &expected_selector[0..4],
            "Function selector should match keccak256 of settleBatch signature"
        );

        // Selector + 6 params (each offset or value = 32 bytes) at minimum
        assert!(calldata.len() > 4 + 32 * 6, "Calldata should contain encoded parameters");
    }
}
