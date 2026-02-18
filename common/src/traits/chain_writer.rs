//! ChainWriter trait for writing to the blockchain

use async_trait::async_trait;
use ethers::types::{Address, H256, U256};

use crate::error::Error;
use crate::types::{Fill, TxHash};

/// Trait for writing to the blockchain
/// Defines methods for submitting transactions
#[async_trait]
pub trait ChainWriter: Send + Sync {
    /// Submit a batch of orders for the given cycle
    ///
    /// # Arguments
    /// * `cycle_number` - The cycle number this batch belongs to
    /// * `order_ids` - List of order IDs to include in the batch
    /// * `bls_signature` - Aggregated BLS signature from issuer quorum
    ///
    /// # Returns
    /// Transaction hash of the submitted transaction
    async fn submit_batch(
        &self,
        cycle_number: u64,
        order_ids: Vec<u64>,
        bls_signature: Vec<u8>,
    ) -> Result<TxHash, Error>;

    /// Confirm fills for orders in a cycle
    ///
    /// # Arguments
    /// * `cycle_number` - The cycle number these fills belong to
    /// * `fills` - List of fill data
    /// * `bls_signature` - Aggregated BLS signature from issuer quorum
    ///
    /// # Returns
    /// Transaction hash of the submitted transaction
    async fn confirm_fills(
        &self,
        cycle_number: u64,
        fills: Vec<Fill>,
        bls_signature: Vec<u8>,
    ) -> Result<TxHash, Error>;

    /// Submit a bridge transaction to move funds cross-chain
    ///
    /// # Arguments
    /// * `dest_chain_id` - Destination chain ID
    /// * `amount` - Amount to bridge (18 decimals)
    /// * `bls_signature` - Aggregated BLS signature from issuer quorum
    ///
    /// # Returns
    /// Transaction hash of the submitted transaction
    async fn submit_bridge(
        &self,
        dest_chain_id: u64,
        amount: U256,
        bls_signature: Vec<u8>,
    ) -> Result<TxHash, Error>;

    /// Create an ITP on the L3 chain (Story 6.24)
    ///
    /// Called by the consensus leader to create an ITP on L3 before
    /// collecting signatures for cross-chain completion.
    ///
    /// # Arguments
    /// * `name` - ITP name
    /// * `symbol` - ITP symbol
    /// * `weights` - Asset weights (18 decimals, must sum to 1e18)
    /// * `assets` - Asset addresses
    ///
    /// # Returns
    /// The L3 ITP ID (bytes32) on success
    async fn create_itp(
        &self,
        name: &str,
        symbol: &str,
        weights: &[U256],
        assets: &[Address],
        prices: &[U256],
        bridge_nonce: U256,
    ) -> Result<H256, Error>;

    /// Send a raw transaction to a contract (Story 7.2)
    ///
    /// Used for arbitrary contract calls like minting tokens in local E2E.
    ///
    /// # Arguments
    /// * `to` - Target contract address
    /// * `calldata` - Encoded function call data
    /// * `value` - ETH value to send (usually 0)
    ///
    /// # Returns
    /// Transaction hash on success
    async fn send_transaction(
        &self,
        to: Address,
        calldata: Vec<u8>,
        value: U256,
    ) -> Result<TxHash, Error>;

    /// Perform a read-only static call to a contract (Story 7.13)
    ///
    /// Used to read contract state without submitting a transaction.
    ///
    /// # Arguments
    /// * `to` - Target contract address
    /// * `calldata` - Encoded function call data
    ///
    /// # Returns
    /// Raw return data bytes on success
    async fn static_call(
        &self,
        to: Address,
        calldata: Vec<u8>,
    ) -> Result<Vec<u8>, Error> {
        let _ = (to, calldata);
        Err(Error::ChainWrite("static_call not implemented".to_string()))
    }

    /// Get the latest block timestamp from the chain
    ///
    /// # Returns
    /// The block timestamp as U256 on success
    async fn get_block_timestamp(&self) -> Result<U256, Error> {
        Err(Error::ChainWrite("get_block_timestamp not implemented".to_string()))
    }
}
