//! CustodyWriter for Arbitrum BLSCustody execution
//!
//! Submits swap execution transactions to BLSCustody.execute() on Arbitrum.
//! Uses the same ethers-rs patterns as EthersChainWriter but targets Arbitrum chain.

use ethers::abi::{encode, Token};
use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use ethers::utils::keccak256;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use thiserror::Error;
use tracing::{debug, info, warn};

/// Errors from CustodyWriter operations
#[derive(Debug, Error)]
pub enum CustodyWriterError {
    /// Failed to create provider
    #[error("Failed to create provider: {0}")]
    ProviderError(String),

    /// Failed to parse wallet key
    #[error("Failed to parse private key: {0}")]
    WalletError(String),

    /// Transaction submission failed
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),

    /// Invalid custody address (zero)
    #[error("Invalid BLSCustody address: zero address")]
    InvalidCustodyAddress,

    /// BLS signature verification would fail
    #[error("BLS signature invalid or missing")]
    InvalidBLSSignature,

    /// Nonce already used
    #[error("Nonce {0} already used")]
    NonceAlreadyUsed(U256),
}

/// Configuration for CustodyWriter
#[derive(Debug, Clone)]
pub struct CustodyWriterConfig {
    /// Arbitrum RPC URL
    pub rpc_url: String,
    /// BLSCustody proxy address on Arbitrum
    pub custody_address: Address,
    /// Arbitrum chain ID (42161)
    pub chain_id: u64,
    /// Gas multiplier for estimation (1.2 = 20% buffer)
    pub gas_multiplier: f64,
    /// Maximum gas price in Gwei
    pub max_gas_price_gwei: u64,
}

impl Default for CustodyWriterConfig {
    fn default() -> Self {
        Self {
            rpc_url: "https://arb1.arbitrum.io/rpc".to_string(),
            custody_address: Address::zero(),
            chain_id: 42161,
            gas_multiplier: 1.2,
            max_gas_price_gwei: 100,
        }
    }
}

/// Type alias for Arbitrum signer
type ArbSignerClient = SignerMiddleware<Provider<Http>, LocalWallet>;

/// Bitmap-based nonce tracker matching BLSCustody.sol pattern.
///
/// Each U256 word holds 256 nonce bits. Nonce N maps to:
/// - Word index: N / 256
/// - Bit position: N % 256
struct NonceBitmap {
    words: dashmap::DashMap<U256, U256>,
}

impl NonceBitmap {
    fn new() -> Self {
        Self {
            words: dashmap::DashMap::new(),
        }
    }

    /// Check if a nonce has been used
    fn is_used(&self, nonce: U256) -> bool {
        let word_index = nonce / 256;
        let bit_index = (nonce % 256).low_u64() as usize;
        self.words
            .get(&word_index)
            .map(|word| (*word >> bit_index) & U256::one() == U256::one())
            .unwrap_or(false)
    }

    /// Mark a nonce as used
    fn mark_used(&self, nonce: U256) {
        let word_index = nonce / 256;
        let bit_index = (nonce % 256).low_u64() as usize;
        let mut entry = self.words.entry(word_index).or_insert(U256::zero());
        *entry |= U256::one() << bit_index;
    }

    /// Get the next available nonce (sequential scan)
    fn next_available(&self) -> U256 {
        let mut nonce = U256::zero();
        loop {
            if !self.is_used(nonce) {
                return nonce;
            }
            nonce += U256::one();
        }
    }

    /// Count of used nonces across all bitmap words
    fn used_count(&self) -> usize {
        let mut count = 0usize;
        for entry in self.words.iter() {
            let mut w = *entry.value();
            while !w.is_zero() {
                count += 1;
                w = w & (w - U256::one()); // Brian Kernighan's bit counting
            }
        }
        count
    }
}

/// CustodyWriter for executing swaps via BLSCustody on Arbitrum
///
/// This writer handles:
/// - Message hash construction matching BLSCustody.sol line 106
/// - Nonce management via bitmap pattern (matching BLSCustody.sol)
/// - Transaction submission to Arbitrum with gas limit and price checks
pub struct CustodyWriter {
    /// Signer middleware for Arbitrum
    client: Arc<ArbSignerClient>,
    /// Configuration
    config: CustodyWriterConfig,
    /// Bitmap nonce tracker matching BLSCustody.sol pattern
    nonce_bitmap: NonceBitmap,
    /// Transaction count for metrics
    tx_count: AtomicU64,
}

impl CustodyWriter {
    /// Create a new CustodyWriter
    ///
    /// # Arguments
    /// * `config` - Arbitrum-specific configuration
    /// * `private_key` - Hex private key for transaction signing
    pub fn new(config: CustodyWriterConfig, private_key: &str) -> Result<Self, CustodyWriterError> {
        if config.custody_address == Address::zero() {
            return Err(CustodyWriterError::InvalidCustodyAddress);
        }

        let provider = Provider::<Http>::try_from(&config.rpc_url)
            .map_err(|e| CustodyWriterError::ProviderError(e.to_string()))?;

        let key_hex = private_key.strip_prefix("0x").unwrap_or(private_key);
        let wallet: LocalWallet = key_hex
            .parse::<LocalWallet>()
            .map_err(|e| CustodyWriterError::WalletError(e.to_string()))?
            .with_chain_id(config.chain_id);

        let client = SignerMiddleware::new(provider, wallet);

        Ok(Self {
            client: Arc::new(client),
            config,
            nonce_bitmap: NonceBitmap::new(),
            tx_count: AtomicU64::new(0),
        })
    }

    /// Get the signer address
    pub fn address(&self) -> Address {
        self.client.address()
    }

    /// Get the BLSCustody contract address
    pub fn custody_address(&self) -> Address {
        self.config.custody_address
    }

    /// Get the chain ID
    pub fn chain_id(&self) -> u64 {
        self.config.chain_id
    }

    /// Get number of transactions submitted
    pub fn tx_count(&self) -> u64 {
        self.tx_count.load(Ordering::Relaxed)
    }

    /// Construct the message hash matching BLSCustody.sol line 106
    ///
    /// ```solidity
    /// bytes32 message = keccak256(abi.encode(
    ///     block.chainid,
    ///     address(this),
    ///     target,
    ///     data,
    ///     nonce
    /// ));
    /// ```
    pub fn compute_message_hash(
        &self,
        target: Address,
        calldata: &[u8],
        nonce: U256,
    ) -> [u8; 32] {
        let chain_id = U256::from(self.config.chain_id);

        let encoded = encode(&[
            Token::Uint(chain_id),
            Token::Address(self.config.custody_address),
            Token::Address(target),
            Token::Bytes(calldata.to_vec()),
            Token::Uint(nonce),
        ]);

        keccak256(encoded)
    }

    /// Execute a swap via BLSCustody.execute()
    ///
    /// # Arguments
    /// * `target` - Target contract (1inch Router)
    /// * `calldata` - Swap calldata
    /// * `bls_signature` - Aggregated BLS signature bytes
    /// * `nonce` - Unique nonce (bitmap pattern)
    ///
    /// # Returns
    /// Transaction hash on success
    pub async fn execute_swap(
        &self,
        target: Address,
        calldata: &[u8],
        bls_signature: &[u8],
        nonce: U256,
    ) -> Result<H256, CustodyWriterError> {
        // Check nonce hasn't been used (bitmap lookup)
        if self.nonce_bitmap.is_used(nonce) {
            return Err(CustodyWriterError::NonceAlreadyUsed(nonce));
        }

        // Build execute(address target, bytes calldata, bytes signature, uint256 nonce) call
        let execute_selector = &keccak256("execute(address,bytes,bytes,uint256)")[..4];

        let encoded_params = encode(&[
            Token::Address(target),
            Token::Bytes(calldata.to_vec()),
            Token::Bytes(bls_signature.to_vec()),
            Token::Uint(nonce),
        ]);

        let mut tx_data = Vec::with_capacity(4 + encoded_params.len());
        tx_data.extend_from_slice(execute_selector);
        tx_data.extend_from_slice(&encoded_params);

        debug!(
            target = ?target,
            nonce = %nonce,
            calldata_len = calldata.len(),
            sig_len = bls_signature.len(),
            "Submitting BLSCustody.execute() on Arbitrum"
        );

        // Build transaction
        let tx = Eip1559TransactionRequest::new()
            .to(self.config.custody_address)
            .data(tx_data)
            .chain_id(self.config.chain_id);

        let mut typed_tx: TypedTransaction = tx.into();

        // Estimate gas and apply buffer
        let gas_estimate = self
            .client
            .estimate_gas(&typed_tx, None)
            .await
            .map_err(|e| CustodyWriterError::TransactionFailed(format!("Gas estimation failed: {}", e)))?;

        let gas_with_buffer = gas_estimate.as_u64() as f64 * self.config.gas_multiplier;
        let gas_limit = U256::from(gas_with_buffer as u64);
        typed_tx.set_gas(gas_limit);

        // Check current gas price against configured maximum
        let gas_price = self
            .client
            .get_gas_price()
            .await
            .map_err(|e| CustodyWriterError::TransactionFailed(format!("Gas price query failed: {}", e)))?;
        let max_gas_price = U256::from(self.config.max_gas_price_gwei) * U256::exp10(9);
        if gas_price > max_gas_price {
            return Err(CustodyWriterError::TransactionFailed(format!(
                "Gas price {} exceeds maximum {} Gwei",
                gas_price, self.config.max_gas_price_gwei
            )));
        }

        // Submit transaction with gas limit applied
        let pending_tx = self
            .client
            .send_transaction(typed_tx, None)
            .await
            .map_err(|e| CustodyWriterError::TransactionFailed(format!("Send failed: {}", e)))?;

        let tx_hash = pending_tx.tx_hash();

        info!(
            tx_hash = ?tx_hash,
            custody = ?self.config.custody_address,
            target = ?target,
            nonce = %nonce,
            gas_limit = %gas_limit,
            "BLSCustody.execute() submitted on Arbitrum"
        );

        // Mark nonce as used in bitmap
        self.nonce_bitmap.mark_used(nonce);
        self.tx_count.fetch_add(1, Ordering::Relaxed);

        Ok(tx_hash)
    }

    /// Check if a nonce has been used (bitmap lookup)
    pub fn is_nonce_used(&self, nonce: &U256) -> bool {
        self.nonce_bitmap.is_used(*nonce)
    }

    /// Get the next available nonce using bitmap scan
    pub fn next_nonce(&self) -> U256 {
        self.nonce_bitmap.next_available()
    }

    /// Check if a transaction has been confirmed on Arbitrum
    ///
    /// Returns `Some(true)` if confirmed and successful, `Some(false)` if reverted,
    /// `None` if not yet confirmed.
    pub async fn check_receipt(&self, tx_hash: H256) -> Result<Option<bool>, CustodyWriterError> {
        let receipt = self
            .client
            .get_transaction_receipt(tx_hash)
            .await
            .map_err(|e| CustodyWriterError::TransactionFailed(format!("Receipt query failed: {}", e)))?;

        Ok(receipt.map(|r| r.status.map(|s| s == U64::from(1)).unwrap_or(false)))
    }
}

impl std::fmt::Debug for CustodyWriter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CustodyWriter")
            .field("custody_address", &self.config.custody_address)
            .field("chain_id", &self.config.chain_id)
            .field("tx_count", &self.tx_count())
            .field("used_nonces", &self.nonce_bitmap.used_count())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_PRIVATE_KEY: &str = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const CUSTODY_ADDRESS: &str = "0x1234567890123456789012345678901234567890";
    const ONEINCH_ROUTER: &str = "0x111111125421cA6dc452d289314280a0f8842A65";

    fn test_config() -> CustodyWriterConfig {
        CustodyWriterConfig {
            rpc_url: "http://localhost:8545".to_string(),
            custody_address: CUSTODY_ADDRESS.parse().unwrap(),
            chain_id: 42161,
            gas_multiplier: 1.2,
            max_gas_price_gwei: 100,
        }
    }

    #[test]
    fn test_custody_writer_creation() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY);
        assert!(writer.is_ok());

        let writer = writer.unwrap();
        assert_eq!(writer.chain_id(), 42161);
        assert_eq!(writer.custody_address(), CUSTODY_ADDRESS.parse::<Address>().unwrap());
        assert_eq!(writer.tx_count(), 0);
    }

    #[test]
    fn test_custody_writer_with_0x_prefix() {
        let config = test_config();
        let writer = CustodyWriter::new(config, &format!("0x{}", TEST_PRIVATE_KEY));
        assert!(writer.is_ok());
    }

    #[test]
    fn test_custody_writer_zero_address_fails() {
        let config = CustodyWriterConfig {
            custody_address: Address::zero(),
            ..test_config()
        };
        let result = CustodyWriter::new(config, TEST_PRIVATE_KEY);
        assert!(matches!(result, Err(CustodyWriterError::InvalidCustodyAddress)));
    }

    #[test]
    fn test_custody_writer_invalid_key() {
        let config = test_config();
        let result = CustodyWriter::new(config, "invalid-key");
        assert!(matches!(result, Err(CustodyWriterError::WalletError(_))));
    }

    #[test]
    fn test_message_hash_construction() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();

        let target: Address = ONEINCH_ROUTER.parse().unwrap();
        let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];
        let nonce = U256::from(1);

        let hash = writer.compute_message_hash(target, &calldata, nonce);

        // Hash should be 32 bytes
        assert_eq!(hash.len(), 32);
        // Hash should not be all zeros
        assert_ne!(hash, [0u8; 32]);
    }

    #[test]
    fn test_message_hash_deterministic() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();

        let target: Address = ONEINCH_ROUTER.parse().unwrap();
        let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];
        let nonce = U256::from(42);

        let hash1 = writer.compute_message_hash(target, &calldata, nonce);
        let hash2 = writer.compute_message_hash(target, &calldata, nonce);

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_message_hash_varies_with_nonce() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();

        let target: Address = ONEINCH_ROUTER.parse().unwrap();
        let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];

        let hash1 = writer.compute_message_hash(target, &calldata, U256::from(1));
        let hash2 = writer.compute_message_hash(target, &calldata, U256::from(2));

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_message_hash_varies_with_target() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();

        let target1: Address = ONEINCH_ROUTER.parse().unwrap();
        let target2: Address = "0x2222222222222222222222222222222222222222".parse().unwrap();
        let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];
        let nonce = U256::from(1);

        let hash1 = writer.compute_message_hash(target1, &calldata, nonce);
        let hash2 = writer.compute_message_hash(target2, &calldata, nonce);

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_message_hash_varies_with_calldata() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();

        let target: Address = ONEINCH_ROUTER.parse().unwrap();
        let nonce = U256::from(1);

        let hash1 = writer.compute_message_hash(target, &[0x12, 0xaa], nonce);
        let hash2 = writer.compute_message_hash(target, &[0x34, 0xbb], nonce);

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_message_hash_matches_swap_builder() {
        // Verify our message hash matches the SwapCalldataBuilder's hash
        // Both should produce keccak256(abi.encode(chainId, custodyAddr, target, data, nonce))
        use common::integrations::oneinch::{OneInchConfig, SwapCalldataBuilder};

        let custody_addr: Address = CUSTODY_ADDRESS.parse().unwrap();
        let target: Address = ONEINCH_ROUTER.parse().unwrap();
        let calldata = vec![0x12, 0xaa, 0x3c, 0xaf];
        let nonce = U256::from(42);

        // CustodyWriter hash
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();
        let writer_hash = writer.compute_message_hash(target, &calldata, nonce);

        // SwapCalldataBuilder hash (via encode_for_custody)
        let oneinch_config = OneInchConfig::new(
            "test-key".to_string(),
            42161,
            custody_addr,
        );
        let builder = SwapCalldataBuilder::new(oneinch_config).unwrap();
        let custody_params = builder.encode_for_custody(&calldata, nonce);

        assert_eq!(writer_hash, custody_params.message_to_sign);
    }

    #[test]
    fn test_nonce_tracking() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();

        assert!(!writer.is_nonce_used(&U256::from(0)));
        assert_eq!(writer.next_nonce(), U256::from(0));

        // Mark nonce as used via bitmap
        writer.nonce_bitmap.mark_used(U256::from(0));
        assert!(writer.is_nonce_used(&U256::from(0)));
        assert_eq!(writer.next_nonce(), U256::from(1));

        // Non-sequential nonce usage (bitmap pattern)
        writer.nonce_bitmap.mark_used(U256::from(5));
        assert!(writer.is_nonce_used(&U256::from(5)));
        assert!(!writer.is_nonce_used(&U256::from(3)));
        // next_nonce() returns first free slot: still 1
        assert_eq!(writer.next_nonce(), U256::from(1));
    }

    #[test]
    fn test_nonce_bitmap_word_boundary() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();

        // Nonce 255 is last bit in word 0
        writer.nonce_bitmap.mark_used(U256::from(255));
        assert!(writer.is_nonce_used(&U256::from(255)));
        assert!(!writer.is_nonce_used(&U256::from(256)));

        // Nonce 256 is first bit in word 1
        writer.nonce_bitmap.mark_used(U256::from(256));
        assert!(writer.is_nonce_used(&U256::from(256)));
    }

    #[test]
    fn test_default_config() {
        let config = CustodyWriterConfig::default();
        assert_eq!(config.chain_id, 42161);
        assert_eq!(config.custody_address, Address::zero());
        assert!((config.gas_multiplier - 1.2).abs() < f64::EPSILON);
    }

    #[test]
    fn test_debug_output() {
        let config = test_config();
        let writer = CustodyWriter::new(config, TEST_PRIVATE_KEY).unwrap();
        let debug_str = format!("{:?}", writer);
        assert!(debug_str.contains("CustodyWriter"));
        assert!(debug_str.contains("42161"));
    }
}
