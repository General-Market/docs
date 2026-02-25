//! RpcChainWriter — real chain adapter implementing ChainWriter trait
//!
//! Uses ethers SignerMiddleware to submit transactions to L3 Orbit contracts.
//! Includes gas estimation with a 1.2x safety multiplier.

use std::sync::Arc;
use async_trait::async_trait;
use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use ethers::types::{Bytes, U256};
use tracing::{debug, info};

use crate::error::Error;
use crate::traits::ChainWriter;
use crate::types::{Fill, TxHash};

use super::abi::{IndexContract, L3BridgeCustodyContract};
use super::deployment_config::DeploymentConfig;

/// Signer type alias for convenience
type SignerProvider = SignerMiddleware<Provider<Http>, LocalWallet>;

/// Gas estimation multiplier (120% = 1.2x)
const GAS_MULTIPLIER_NUM: u64 = 120;
const GAS_MULTIPLIER_DEN: u64 = 100;

/// RPC-based chain writer for real L3 contracts
pub struct RpcChainWriter {
    index_contract: IndexContract<SignerProvider>,
    bridge_contract: L3BridgeCustodyContract<SignerProvider>,
    client: Arc<SignerProvider>,
}

impl RpcChainWriter {
    /// Create a new RpcChainWriter from a provider, wallet, and deployment config
    pub fn new(
        provider: Provider<Http>,
        wallet: LocalWallet,
        deployment: &DeploymentConfig,
    ) -> Result<Self, Error> {
        let chain_id = deployment.chain_id;
        let wallet = wallet.with_chain_id(chain_id);
        let client = Arc::new(SignerMiddleware::new(provider, wallet));

        let index_address = deployment.index_address()?;
        let bridge_address = deployment.l3_bridge_custody_address()?;

        let index_contract = IndexContract::new(index_address, client.clone());
        let bridge_contract =
            L3BridgeCustodyContract::new(bridge_address, client.clone());

        Ok(Self {
            index_contract,
            bridge_contract,
            client,
        })
    }

    /// Estimate gas and apply the 1.2x multiplier
    async fn estimate_gas_with_multiplier(
        &self,
        tx: &TypedTransaction,
    ) -> Result<U256, Error> {
        let estimate = self
            .client
            .estimate_gas(tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("Gas estimation failed: {}", e)))?;

        let adjusted = estimate * GAS_MULTIPLIER_NUM / GAS_MULTIPLIER_DEN;
        debug!(
            estimated = %estimate,
            adjusted = %adjusted,
            "Gas estimate with 1.2x multiplier"
        );
        Ok(adjusted)
    }
}

#[async_trait]
impl ChainWriter for RpcChainWriter {
    async fn submit_batch(
        &self,
        cycle_number: u64,
        order_ids: Vec<u64>,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        let cycle = U256::from(cycle_number);
        let ids: Vec<U256> = order_ids.iter().map(|&id| U256::from(id)).collect();
        let sig = Bytes::from(bls_signature);
        let ref_nonce = U256::from(reference_nonce);

        let contract = self.index_contract.clone();
        let client = self.client.clone();

        // Build and estimate gas, then send
        let call = contract.confirm_batch(cycle, ids.clone(), sig.clone(), ref_nonce, signers_bitmask);
        let mut tx: TypedTransaction = call.tx.clone();
        let gas = self.estimate_gas_with_multiplier(&tx).await?;
        tx.set_gas(gas);

        let pending = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("confirmBatch send failed: {}", e)))?;

        match pending.await {
            Ok(Some(receipt)) => {
                info!(
                    tx_hash = ?receipt.transaction_hash,
                    cycle_number,
                    order_count = ids.len(),
                    "confirmBatch confirmed"
                );
                Ok(receipt.transaction_hash)
            }
            Ok(None) => Err(Error::TransactionFailed(
                "confirmBatch: no receipt".to_string(),
            )),
            Err(e) => Err(Error::TransactionFailed(format!(
                "confirmBatch receipt error: {}",
                e
            ))),
        }
    }

    async fn confirm_fills(
        &self,
        cycle_number: u64,
        fills: Vec<Fill>,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        let cycle = U256::from(cycle_number);
        let sig = Bytes::from(bls_signature);
        let ref_nonce = U256::from(reference_nonce);

        // Convert Fill structs to ABI tuple format
        let abi_fills: Vec<(U256, U256, U256, U256, [u8; 32])> = fills
            .iter()
            .map(|f| {
                (
                    f.order_id,
                    f.fill_price,
                    f.fill_amount,
                    f.cycle_number,
                    f.tx_hash.into(),
                )
            })
            .collect();

        let contract = self.index_contract.clone();
        let client = self.client.clone();

        let call = contract.confirm_fills(cycle, abi_fills, sig.clone(), ref_nonce, signers_bitmask);
        let mut tx: TypedTransaction = call.tx.clone();
        let gas = self.estimate_gas_with_multiplier(&tx).await?;
        tx.set_gas(gas);

        let pending = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("confirmFills send failed: {}", e)))?;

        match pending.await {
            Ok(Some(receipt)) => {
                info!(
                    tx_hash = ?receipt.transaction_hash,
                    cycle_number,
                    fill_count = fills.len(),
                    "confirmFills confirmed"
                );
                Ok(receipt.transaction_hash)
            }
            Ok(None) => Err(Error::TransactionFailed(
                "confirmFills: no receipt".to_string(),
            )),
            Err(e) => Err(Error::TransactionFailed(format!(
                "confirmFills receipt error: {}",
                e
            ))),
        }
    }

    async fn submit_bridge(
        &self,
        dest_chain_id: u64,
        amount: U256,
        bls_signature: Vec<u8>,
        reference_nonce: u64,
        signers_bitmask: U256,
    ) -> Result<TxHash, Error> {
        let dest = U256::from(dest_chain_id);
        let sig = Bytes::from(bls_signature);
        let ref_nonce = U256::from(reference_nonce);

        let contract = self.bridge_contract.clone();
        let client = self.client.clone();

        let call = contract.initiate_bridge(dest, amount, sig.clone(), ref_nonce, signers_bitmask);
        let mut tx: TypedTransaction = call.tx.clone();
        let gas = self.estimate_gas_with_multiplier(&tx).await?;
        tx.set_gas(gas);

        let pending = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("initiateBridge send failed: {}", e)))?;

        match pending.await {
            Ok(Some(receipt)) => {
                info!(
                    tx_hash = ?receipt.transaction_hash,
                    dest_chain_id,
                    amount = %amount,
                    "initiateBridge confirmed"
                );
                Ok(receipt.transaction_hash)
            }
            Ok(None) => Err(Error::TransactionFailed(
                "initiateBridge: no receipt".to_string(),
            )),
            Err(e) => Err(Error::TransactionFailed(format!(
                "initiateBridge receipt error: {}",
                e
            ))),
        }
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
        // RpcChainWriter doesn't support create_itp directly - use EthersChainWriter instead
        // This is a placeholder that returns an error as RpcChainWriter is ABI-binding based
        // and doesn't have the Index.createITP binding.
        let _ = (name, symbol, weights, assets, prices, bridge_nonce);
        Err(Error::ChainWrite(
            "RpcChainWriter.create_itp not implemented - use EthersChainWriter".to_string(),
        ))
    }

    async fn send_transaction(
        &self,
        to: Address,
        calldata: Vec<u8>,
        value: U256,
    ) -> Result<TxHash, Error> {
        // Build raw transaction
        let mut tx = TypedTransaction::default();
        tx.set_to(to);
        tx.set_data(Bytes::from(calldata));
        tx.set_value(value);

        // Estimate gas
        let gas = self.estimate_gas_with_multiplier(&tx).await?;
        tx.set_gas(gas);

        // Send transaction
        let pending = self
            .client
            .send_transaction(tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("send_transaction failed: {}", e)))?;

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
        let mut tx = TypedTransaction::default();
        tx.set_to(to);
        tx.set_data(Bytes::from(calldata));

        let result = self
            .client
            .call(&tx, None)
            .await
            .map_err(|e| Error::ChainWrite(format!("static_call failed: {}", e)))?;

        Ok(result.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gas_multiplier_constants() {
        // Verify the multiplier produces 1.2x
        let estimate = U256::from(100_000u64);
        let adjusted = estimate * GAS_MULTIPLIER_NUM / GAS_MULTIPLIER_DEN;
        assert_eq!(adjusted, U256::from(120_000u64));
    }
}
