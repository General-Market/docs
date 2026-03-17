//! Market Deployer — Auto-detect new ITPs and deploy Morpho lending markets.
//!
//! Periodically scans the Index contract for ITPs without Morpho markets.
//! For each missing market: deploys ITPNAVOracle → creates Morpho market →
//! submits + accepts MetaMorpho vault cap → updates supply queue.

use ethers::prelude::*;
use ethers::providers::{Http, Provider};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info};

use crate::config::MarketDeployerConfig;

/// Default LLTV: 77% in WAD (1e18 scale)
const DEFAULT_LLTV: &str = "770000000000000000";

/// Default initial oracle price: $1 in Morpho 36-decimal format
const DEFAULT_INITIAL_PRICE: &str = "1000000000000000000000000000000000000";

/// Max supply cap per market (type(uint184).max)
const SUPPLY_CAP: &str = "24519928653854221733733552434404946937899825954937634816";

#[derive(Debug, thiserror::Error)]
pub enum DeployerError {
    #[error("RPC error: {0}")]
    Rpc(String),
    #[error("Transaction failed: {0}")]
    TxFailed(String),
    #[error("Bytecode error: {0}")]
    Bytecode(String),
    #[error("Timeout: {0}")]
    Timeout(String),
}

pub struct MarketDeployer {
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,
    index_address: Address,
    morpho_address: Address,
    vault_address: Address,
    mirror_registry: Address,
    curator_irm: Address,
    loan_token: Address,
    oracle_bytecode: Vec<u8>,
    scan_interval: Duration,
}

impl MarketDeployer {
    pub fn new(config: &MarketDeployerConfig) -> Result<Self, DeployerError> {
        let provider = Provider::<Http>::try_from(&config.rpc_url)
            .map_err(|e| DeployerError::Rpc(format!("Invalid RPC URL: {e}")))?;

        let key_hex = config.private_key.strip_prefix("0x").unwrap_or(&config.private_key);
        let wallet: LocalWallet = key_hex
            .parse()
            .map_err(|e| DeployerError::Rpc(format!("Invalid private key: {e}")))?;

        let bytecode = Self::load_bytecode(&config.oracle_bytecode_path)?;

        Ok(Self {
            provider: Arc::new(provider),
            wallet,
            index_address: config.index_address,
            morpho_address: config.morpho_address,
            vault_address: config.vault_address,
            mirror_registry: config.mirror_registry,
            curator_irm: config.curator_irm,
            loan_token: config.loan_token,
            oracle_bytecode: bytecode,
            scan_interval: config.scan_interval,
        })
    }

    fn load_bytecode(path: &str) -> Result<Vec<u8>, DeployerError> {
        // Try as forge artifact JSON first, then raw hex
        let contents = std::fs::read_to_string(path)
            .map_err(|e| DeployerError::Bytecode(format!("Cannot read {path}: {e}")))?;

        let hex_str = if contents.trim_start().starts_with('{') {
            // Forge artifact JSON: {"bytecode": {"object": "0x..."}}
            let val: serde_json::Value = serde_json::from_str(&contents)
                .map_err(|e| DeployerError::Bytecode(format!("Invalid JSON: {e}")))?;
            val["bytecode"]["object"]
                .as_str()
                .ok_or_else(|| DeployerError::Bytecode("Missing bytecode.object in JSON".into()))?
                .to_string()
        } else {
            contents.trim().to_string()
        };

        let hex = hex_str.strip_prefix("0x").unwrap_or(&hex_str);
        ethers::utils::hex::decode(hex)
            .map_err(|e| DeployerError::Bytecode(format!("Invalid hex: {e}")))
    }

    // ── Main loop ──

    pub async fn run_loop(&self, shutdown: Arc<AtomicBool>) {
        info!("Market deployer started (scan every {:?})", self.scan_interval);

        // Initial delay — let other services stabilize
        tokio::time::sleep(Duration::from_secs(30)).await;

        loop {
            if shutdown.load(Ordering::Relaxed) {
                break;
            }

            match self.scan_and_deploy().await {
                Ok(0) => info!("Market scan: all ITPs have markets"),
                Ok(n) => info!(deployed = n, "Deployed new lending markets"),
                Err(e) => error!(error = %e, "Market deployer scan failed"),
            }

            tokio::time::sleep(self.scan_interval).await;
        }

        info!("Market deployer stopped");
    }

    async fn scan_and_deploy(&self) -> Result<usize, DeployerError> {
        let chain_id = self.provider.get_chainid().await
            .map_err(|e| DeployerError::Rpc(format!("get_chainid: {e}")))?;
        let wallet = self.wallet.clone().with_chain_id(chain_id.as_u64());

        // 1. Read ITP count from Index
        let count = self.read_itp_count().await?;
        if count == 0 {
            return Ok(0);
        }

        // 2. Get all vault addresses
        let vaults = self.get_all_vaults(count).await?;

        // 3. Get existing supply queue (these markets already exist)
        let existing_ids = self.read_supply_queue().await?;
        let existing_collaterals = self.get_collaterals_for_markets(&existing_ids).await?;

        // 4. Find ITPs without markets
        let missing: Vec<(u64, Address)> = vaults
            .iter()
            .filter(|(_, addr)| !existing_collaterals.contains(addr))
            .cloned()
            .collect();

        if missing.is_empty() {
            return Ok(0);
        }

        info!(
            total = count,
            existing = existing_ids.len(),
            missing = missing.len(),
            "Found ITPs without lending markets"
        );

        // 5. Deploy markets for missing ITPs
        let client = SignerMiddleware::new(self.provider.clone(), wallet);
        let mut new_market_ids: Vec<[u8; 32]> = Vec::new();

        for (itp_num, vault_addr) in &missing {
            match self.deploy_market_for_itp(&client, *vault_addr).await {
                Ok(market_id) => {
                    info!(itp = itp_num, market = %ethers::utils::hex::encode(market_id), "Market deployed");
                    new_market_ids.push(market_id);
                }
                Err(e) => {
                    error!(itp = itp_num, addr = %vault_addr, error = %e, "Failed to deploy market");
                    // Continue with remaining ITPs
                }
            }
        }

        // 6. Update supply queue with all markets (existing + new)
        if !new_market_ids.is_empty() {
            let mut all_ids = existing_ids.clone();
            all_ids.extend_from_slice(&new_market_ids);

            if let Err(e) = self.set_supply_queue(&client, &all_ids).await {
                error!(error = %e, "Failed to update supply queue");
            } else {
                info!(total = all_ids.len(), new = new_market_ids.len(), "Supply queue updated");
            }
        }

        Ok(new_market_ids.len())
    }

    // ── Contract reads ──

    async fn read_itp_count(&self) -> Result<u64, DeployerError> {
        let selector = &ethers::utils::keccak256(b"getItpCount()")[..4];
        let tx = TransactionRequest::new()
            .to(self.index_address)
            .data(selector.to_vec());

        let result = self.provider.call(&tx.into(), None).await
            .map_err(|e| DeployerError::Rpc(format!("getItpCount: {e}")))?;

        if result.len() < 32 {
            return Err(DeployerError::Rpc("getItpCount: short response".into()));
        }
        let count = U256::from_big_endian(&result[..32]);
        Ok(count.as_u64())
    }

    async fn get_all_vaults(&self, count: u64) -> Result<Vec<(u64, Address)>, DeployerError> {
        let selector = &ethers::utils::keccak256(b"itpVaults(bytes32)")[..4];
        let mut vaults = Vec::new();

        for i in 1..=count {
            let itp_id = U256::from(i);
            let mut itp_id_bytes = [0u8; 32];
            itp_id.to_big_endian(&mut itp_id_bytes);

            let encoded = ethers::abi::encode(&[ethers::abi::Token::FixedBytes(itp_id_bytes.to_vec())]);
            let mut calldata = selector.to_vec();
            calldata.extend_from_slice(&encoded);

            let tx = TransactionRequest::new()
                .to(self.index_address)
                .data(calldata);

            match self.provider.call(&tx.into(), None).await {
                Ok(result) if result.len() >= 32 => {
                    let addr = Address::from_slice(&result[12..32]);
                    if addr != Address::zero() {
                        vaults.push((i, addr));
                    }
                }
                _ => {} // skip failed reads
            }
        }

        Ok(vaults)
    }

    async fn read_supply_queue(&self) -> Result<Vec<[u8; 32]>, DeployerError> {
        // supplyQueueLength()
        let len_selector = &ethers::utils::keccak256(b"supplyQueueLength()")[..4];
        let tx = TransactionRequest::new()
            .to(self.vault_address)
            .data(len_selector.to_vec());

        let result = self.provider.call(&tx.into(), None).await
            .map_err(|e| DeployerError::Rpc(format!("supplyQueueLength: {e}")))?;

        let queue_len = if result.len() >= 32 {
            U256::from_big_endian(&result[..32]).as_u64()
        } else {
            0
        };

        let mut ids = Vec::new();
        let queue_selector = &ethers::utils::keccak256(b"supplyQueue(uint256)")[..4];

        for i in 0..queue_len {
            let encoded = ethers::abi::encode(&[ethers::abi::Token::Uint(U256::from(i))]);
            let mut calldata = queue_selector.to_vec();
            calldata.extend_from_slice(&encoded);

            let tx = TransactionRequest::new()
                .to(self.vault_address)
                .data(calldata);

            match self.provider.call(&tx.into(), None).await {
                Ok(result) if result.len() >= 32 => {
                    let mut id = [0u8; 32];
                    id.copy_from_slice(&result[..32]);
                    ids.push(id);
                }
                _ => {}
            }
        }

        Ok(ids)
    }

    async fn get_collaterals_for_markets(&self, market_ids: &[[u8; 32]]) -> Result<std::collections::HashSet<Address>, DeployerError> {
        let selector = &ethers::utils::keccak256(b"idToMarketParams(bytes32)")[..4];
        let mut collaterals = std::collections::HashSet::new();

        for id in market_ids {
            let encoded = ethers::abi::encode(&[ethers::abi::Token::FixedBytes(id.to_vec())]);
            let mut calldata = selector.to_vec();
            calldata.extend_from_slice(&encoded);

            let tx = TransactionRequest::new()
                .to(self.morpho_address)
                .data(calldata);

            match self.provider.call(&tx.into(), None).await {
                Ok(result) if result.len() >= 64 => {
                    // Returns: (loanToken, collateralToken, oracle, irm, lltv)
                    // collateralToken is at offset 32..64
                    let addr = Address::from_slice(&result[44..64]);
                    if addr != Address::zero() {
                        collaterals.insert(addr);
                    }
                }
                _ => {}
            }
        }

        Ok(collaterals)
    }

    // ── Contract writes ──

    async fn deploy_market_for_itp(
        &self,
        client: &SignerMiddleware<Arc<Provider<Http>>, LocalWallet>,
        collateral_token: Address,
    ) -> Result<[u8; 32], DeployerError> {
        // 1. Deploy ITPNAVOracle
        let oracle_addr = self.deploy_oracle(client, collateral_token).await?;
        info!(oracle = %oracle_addr, collateral = %collateral_token, "Oracle deployed");

        // 2. Create Morpho market
        let market_id = self.create_market(client, collateral_token, oracle_addr).await?;

        // 3. Submit + accept vault cap (MIN_TIMELOCK=0 allows immediate accept)
        self.submit_cap(client, collateral_token, oracle_addr).await?;
        self.accept_cap(client, collateral_token, oracle_addr).await?;

        Ok(market_id)
    }

    async fn deploy_oracle(
        &self,
        client: &SignerMiddleware<Arc<Provider<Http>>, LocalWallet>,
        itp_address: Address,
    ) -> Result<Address, DeployerError> {
        let initial_price = U256::from_dec_str(DEFAULT_INITIAL_PRICE)
            .map_err(|e| DeployerError::Bytecode(format!("Bad initial price: {e}")))?;

        // Constructor args: (address oracleRegistry, address itpAddress, uint256 initialPrice)
        let constructor_args = ethers::abi::encode(&[
            ethers::abi::Token::Address(self.mirror_registry),
            ethers::abi::Token::Address(itp_address),
            ethers::abi::Token::Uint(initial_price),
        ]);

        let mut deploy_data = self.oracle_bytecode.clone();
        deploy_data.extend_from_slice(&constructor_args);

        let tx = TransactionRequest::new().data(deploy_data);

        let pending = client.send_transaction(tx, None).await
            .map_err(|e| DeployerError::TxFailed(format!("Deploy oracle tx: {e}")))?;
        let tx_hash = pending.tx_hash();

        let receipt = tokio::time::timeout(Duration::from_secs(120), pending).await
            .map_err(|_| DeployerError::Timeout(format!("Oracle deploy timeout (tx: {tx_hash:?})")))?
            .map_err(|e| DeployerError::TxFailed(format!("Oracle deploy: {e}")))?;

        match receipt {
            Some(r) if r.status == Some(1.into()) => {
                r.contract_address
                    .ok_or_else(|| DeployerError::TxFailed("No contract address in receipt".into()))
            }
            Some(r) => Err(DeployerError::TxFailed(format!(
                "Oracle deploy reverted (tx: {:?})",
                r.transaction_hash
            ))),
            None => Err(DeployerError::TxFailed("No receipt for oracle deploy".into())),
        }
    }

    /// Encode MarketParams tuple: (loanToken, collateralToken, oracle, irm, lltv)
    fn encode_market_params(&self, collateral: Address, oracle: Address) -> Vec<ethers::abi::Token> {
        let lltv = U256::from_dec_str(DEFAULT_LLTV).unwrap();
        vec![ethers::abi::Token::Tuple(vec![
            ethers::abi::Token::Address(self.loan_token),
            ethers::abi::Token::Address(collateral),
            ethers::abi::Token::Address(oracle),
            ethers::abi::Token::Address(self.curator_irm),
            ethers::abi::Token::Uint(lltv),
        ])]
    }

    /// Compute Morpho market ID = keccak256(abi.encode(loanToken, collateralToken, oracle, irm, lltv))
    fn compute_market_id(&self, collateral: Address, oracle: Address) -> [u8; 32] {
        let lltv = U256::from_dec_str(DEFAULT_LLTV).unwrap();
        let encoded = ethers::abi::encode(&[
            ethers::abi::Token::Address(self.loan_token),
            ethers::abi::Token::Address(collateral),
            ethers::abi::Token::Address(oracle),
            ethers::abi::Token::Address(self.curator_irm),
            ethers::abi::Token::Uint(lltv),
        ]);
        ethers::utils::keccak256(encoded)
    }

    async fn create_market(
        &self,
        client: &SignerMiddleware<Arc<Provider<Http>>, LocalWallet>,
        collateral: Address,
        oracle: Address,
    ) -> Result<[u8; 32], DeployerError> {
        // createMarket((address,address,address,address,uint256))
        let selector = &ethers::utils::keccak256(
            b"createMarket((address,address,address,address,uint256))"
        )[..4];

        let params = self.encode_market_params(collateral, oracle);
        let encoded = ethers::abi::encode(&params);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded);

        let tx = TransactionRequest::new()
            .to(self.morpho_address)
            .data(calldata);

        let pending = client.send_transaction(tx, None).await
            .map_err(|e| DeployerError::TxFailed(format!("createMarket tx: {e}")))?;

        let receipt = tokio::time::timeout(Duration::from_secs(60), pending).await
            .map_err(|_| DeployerError::Timeout("createMarket timeout".into()))?
            .map_err(|e| DeployerError::TxFailed(format!("createMarket: {e}")))?;

        match receipt {
            Some(r) if r.status == Some(1.into()) => {
                Ok(self.compute_market_id(collateral, oracle))
            }
            Some(r) => Err(DeployerError::TxFailed(format!(
                "createMarket reverted (tx: {:?})",
                r.transaction_hash
            ))),
            None => Err(DeployerError::TxFailed("No receipt for createMarket".into())),
        }
    }

    async fn submit_cap(
        &self,
        client: &SignerMiddleware<Arc<Provider<Http>>, LocalWallet>,
        collateral: Address,
        oracle: Address,
    ) -> Result<(), DeployerError> {
        // submitCap((address,address,address,address,uint256),uint256)
        let selector = &ethers::utils::keccak256(
            b"submitCap((address,address,address,address,uint256),uint256)"
        )[..4];

        let cap = U256::from_dec_str(SUPPLY_CAP)
            .map_err(|e| DeployerError::TxFailed(format!("Bad supply cap: {e}")))?;

        let mut params = self.encode_market_params(collateral, oracle);
        params.push(ethers::abi::Token::Uint(cap));
        let encoded = ethers::abi::encode(&params);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded);

        let tx = TransactionRequest::new()
            .to(self.vault_address)
            .data(calldata);

        let pending = client.send_transaction(tx, None).await
            .map_err(|e| DeployerError::TxFailed(format!("submitCap tx: {e}")))?;

        let receipt = tokio::time::timeout(Duration::from_secs(60), pending).await
            .map_err(|_| DeployerError::Timeout("submitCap timeout".into()))?
            .map_err(|e| DeployerError::TxFailed(format!("submitCap: {e}")))?;

        match receipt {
            Some(r) if r.status == Some(1.into()) => Ok(()),
            Some(r) => Err(DeployerError::TxFailed(format!(
                "submitCap reverted (tx: {:?})",
                r.transaction_hash
            ))),
            None => Err(DeployerError::TxFailed("No receipt for submitCap".into())),
        }
    }

    async fn accept_cap(
        &self,
        client: &SignerMiddleware<Arc<Provider<Http>>, LocalWallet>,
        collateral: Address,
        oracle: Address,
    ) -> Result<(), DeployerError> {
        // acceptCap((address,address,address,address,uint256))
        let selector = &ethers::utils::keccak256(
            b"acceptCap((address,address,address,address,uint256))"
        )[..4];

        let params = self.encode_market_params(collateral, oracle);
        let encoded = ethers::abi::encode(&params);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded);

        let tx = TransactionRequest::new()
            .to(self.vault_address)
            .data(calldata);

        let pending = client.send_transaction(tx, None).await
            .map_err(|e| DeployerError::TxFailed(format!("acceptCap tx: {e}")))?;

        let receipt = tokio::time::timeout(Duration::from_secs(60), pending).await
            .map_err(|_| DeployerError::Timeout("acceptCap timeout".into()))?
            .map_err(|e| DeployerError::TxFailed(format!("acceptCap: {e}")))?;

        match receipt {
            Some(r) if r.status == Some(1.into()) => Ok(()),
            Some(r) => Err(DeployerError::TxFailed(format!(
                "acceptCap reverted (tx: {:?})",
                r.transaction_hash
            ))),
            None => Err(DeployerError::TxFailed("No receipt for acceptCap".into())),
        }
    }

    async fn set_supply_queue(
        &self,
        client: &SignerMiddleware<Arc<Provider<Http>>, LocalWallet>,
        market_ids: &[[u8; 32]],
    ) -> Result<(), DeployerError> {
        // setSupplyQueue(bytes32[])
        let selector = &ethers::utils::keccak256(b"setSupplyQueue(bytes32[])")[..4];

        let tokens: Vec<ethers::abi::Token> = market_ids
            .iter()
            .map(|id| ethers::abi::Token::FixedBytes(id.to_vec()))
            .collect();
        let encoded = ethers::abi::encode(&[ethers::abi::Token::Array(tokens)]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded);

        let tx = TransactionRequest::new()
            .to(self.vault_address)
            .data(calldata);

        let pending = client.send_transaction(tx, None).await
            .map_err(|e| DeployerError::TxFailed(format!("setSupplyQueue tx: {e}")))?;

        let receipt = tokio::time::timeout(Duration::from_secs(60), pending).await
            .map_err(|_| DeployerError::Timeout("setSupplyQueue timeout".into()))?
            .map_err(|e| DeployerError::TxFailed(format!("setSupplyQueue: {e}")))?;

        match receipt {
            Some(r) if r.status == Some(1.into()) => Ok(()),
            Some(r) => Err(DeployerError::TxFailed(format!(
                "setSupplyQueue reverted (tx: {:?})",
                r.transaction_hash
            ))),
            None => Err(DeployerError::TxFailed("No receipt for setSupplyQueue".into())),
        }
    }
}
