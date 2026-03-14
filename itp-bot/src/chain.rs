//! L3 RPC client for reading ITP state and submitting rebalance requests.

use std::sync::Arc;

use ethers::prelude::*;
use tracing::info;

// Generate contract bindings for ITP-related functions on Index.sol
abigen!(
    IInvestment,
    r#"[
        function getITPState(bytes32 itpId) view returns (address[] assets, uint256[] weights, uint256[] inventory, uint256 nav, uint256 totalSupply)
        function getITPInfo(bytes32 itpId) view returns (string name, string symbol, address creator, uint256 createdAt, uint8 status, uint256 assetCount)
        function itpCount() view returns (uint256)
        function requestRebalance(bytes32 itpId, uint256[] removeIndices, address[] addAssets, uint256[] newWeights, string note)
        function createITP(string name, string symbol, uint256[] weights, address[] assets, uint256[] prices, uint256 bridgeNonce) returns (bytes32 itpId)
    ]"#
);

/// Type alias for the signer middleware used throughout.
pub type SignerClient = SignerMiddleware<Provider<Http>, LocalWallet>;

/// L3 chain client for ITP operations.
pub struct ChainClient {
    contract: IInvestment<SignerClient>,
}

impl ChainClient {
    /// Create a new ChainClient connected to the L3 RPC.
    ///
    /// # Arguments
    /// * `rpc_url` - L3 RPC endpoint
    /// * `contract_addr` - Index.sol contract address on L3
    /// * `wallet` - Local wallet for signing transactions
    pub fn new(
        rpc_url: &str,
        contract_addr: Address,
        wallet: LocalWallet,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let provider = Provider::<Http>::try_from(rpc_url)?
            .interval(std::time::Duration::from_millis(50));

        let client = SignerMiddleware::new(provider, wallet);
        let client = Arc::new(client);

        let contract = IInvestment::new(contract_addr, client);

        info!(
            contract = ?contract_addr,
            rpc = %rpc_url,
            "ChainClient initialized"
        );

        Ok(Self { contract })
    }

    /// Return the total number of ITPs that exist on-chain.
    pub async fn itp_count(&self) -> Result<U256, Box<dyn std::error::Error>> {
        let count = self.contract.itp_count().call().await?;
        Ok(count)
    }

    /// Read full ITP state: (assets, weights, inventory, nav, totalSupply).
    pub async fn get_itp_state(
        &self,
        itp_id: [u8; 32],
    ) -> Result<(Vec<Address>, Vec<U256>, Vec<U256>, U256, U256), Box<dyn std::error::Error>> {
        let state = self.contract.get_itp_state(itp_id).call().await?;
        Ok(state)
    }

    /// Submit an on-chain rebalance request for the given ITP.
    pub async fn request_rebalance(
        &self,
        itp_id: [u8; 32],
        remove_indices: Vec<U256>,
        add_assets: Vec<Address>,
        new_weights: Vec<U256>,
        note: String,
    ) -> Result<TransactionReceipt, Box<dyn std::error::Error>> {
        let tx = self
            .contract
            .request_rebalance(itp_id, remove_indices, add_assets, new_weights, note);

        let pending = tx.send().await?;
        let receipt = pending
            .await?
            .ok_or("Transaction dropped from mempool")?;

        info!(
            tx_hash = ?receipt.transaction_hash,
            "Rebalance request confirmed"
        );

        Ok(receipt)
    }
}
