//! Chain reader/writer builders

use super::{BootstrapError, BootstrapParams, ChainComponents};
use crate::{
    SettlementChainReader, SettlementChainReaderConfig, SettlementChainWriter,
    SettlementChainWriterConfig, SettlementReader, ChainReaderConfig, ChainWriterConfig,
    ContractAddresses, EthersChainReader, EthersChainWriter, GasConfig, IssuerConfig,
};
use crate::chain::DataNodeSettlementReader;
use common::adapters::DataNodeChainReader;
use common::mocks::MockChainBuilder;
use common::traits::ChainReader;
use ethers::prelude::Middleware;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Builder for chain-related components
pub struct ChainBuilder<'a> {
    config: &'a IssuerConfig,
    params: &'a BootstrapParams,
    contract_addresses: &'a ContractAddresses,
    target_chain_id: u64,
}

impl<'a> ChainBuilder<'a> {
    pub fn new(
        config: &'a IssuerConfig,
        params: &'a BootstrapParams,
        contract_addresses: &'a ContractAddresses,
        target_chain_id: u64,
    ) -> Self {
        Self {
            config,
            params,
            contract_addresses,
            target_chain_id,
        }
    }

    pub async fn build(self) -> Result<ChainComponents, BootstrapError> {
        let node_id = self.config.node_id.unwrap_or(0);
        let rpc_url = self.config.effective_rpc_url();

        // Build chain reader
        let reader = self.build_reader(node_id, &rpc_url).await?;
        let reader: Arc<dyn ChainReader> = Arc::from(reader);

        // Build chain writer
        let writer = self.build_writer(node_id, &rpc_url).await?;

        // Build Settlement chain components
        let (settlement_reader, settlement_writer) = self.build_settlement(node_id).await?;

        Ok(ChainComponents {
            reader,
            writer,
            settlement_reader,
            settlement_writer,
            rpc_url,
        })
    }

    async fn build_reader(&self, node_id: u32, rpc_url: &str) -> Result<Box<dyn ChainReader>, BootstrapError> {
        if self.params.mock_chain {
            info!(node_id, "Initializing MockChain for local development");
            let mock = MockChainBuilder::new().build();
            info!(node_id, "MockChain initialized (ChainReader)");
            return Ok(Box::new(mock));
        }

        // Use DataNodeChainReader when DATA_NODE_URL is configured
        if let Some(ref data_node_url) = self.config.data_node_url {
            info!(node_id, url = %data_node_url, "Using DataNodeChainReader (reads via data-node)");
            let reader = DataNodeChainReader::new(data_node_url.clone());
            return Ok(Box::new(reader));
        }

        info!(node_id, rpc = %rpc_url, "Initializing EthersChainReader for production");

        // RPC connectivity check
        let provider = ethers::providers::Provider::<ethers::providers::Http>::try_from(rpc_url)
            .map_err(|e| BootstrapError::Chain(format!("Failed to create provider: {}", e)))?;

        match provider.get_chainid().await {
            Ok(chain_id) => {
                if chain_id.as_u64() != self.target_chain_id {
                    return Err(BootstrapError::Chain(format!(
                        "Chain ID mismatch: expected {}, got {}. Check RPC URL: {} (use --chain-id to override)",
                        self.target_chain_id, chain_id, rpc_url
                    )));
                }
                info!(node_id, chain_id = %chain_id, "RPC connectivity verified");
            }
            Err(e) => {
                return Err(BootstrapError::Chain(format!(
                    "Cannot connect to RPC at {}: {}",
                    rpc_url, e
                )));
            }
        }

        // On-chain prices are dead; hardcode asset_count to 0
        let asset_count = 0u64;

        let reader_config = ChainReaderConfig {
            rpc_url: rpc_url.to_string(),
            contracts: self.contract_addresses.clone(),
            chain_id: self.target_chain_id,
            max_orders_per_batch: 100,
            asset_count,
            from_block: self.params.from_block,
        };

        let reader = EthersChainReader::new(reader_config)
            .map_err(|e| BootstrapError::Chain(format!("Failed to create EthersChainReader: {}", e)))?;

        info!(
            node_id,
            index = ?self.contract_addresses.index,
            governance = ?self.contract_addresses.governance,
            issuer_registry = ?self.contract_addresses.issuer_registry,
            "EthersChainReader initialized"
        );

        Ok(Box::new(reader))
    }

    async fn build_writer(
        &self,
        node_id: u32,
        rpc_url: &str,
    ) -> Result<Option<Arc<EthersChainWriter>>, BootstrapError> {
        if self.params.mock_chain {
            info!(node_id, "Mock mode: skipping ChainWriter initialization");
            return Ok(None);
        }

        let private_key = match self.config.effective_private_key() {
            Ok(Some(key)) => key,
            Ok(None) => {
                warn!(code = "INFRA-002", node_id, "No private key configured - ChainWriter unavailable");
                return Ok(None);
            }
            Err(e) => {
                warn!(code = "INFRA-002", node_id, error = %e, "Failed to load private key");
                return Ok(None);
            }
        };

        let writer_addresses = self.config.effective_writer_addresses()
            .map_err(|e| BootstrapError::Chain(e.to_string()))?;

        let writer_config = ChainWriterConfig {
            rpc_url: rpc_url.to_string(),
            contracts: writer_addresses,
            chain_id: self.target_chain_id,
            gas_config: GasConfig::default().with_max_gas_limit(self.params.max_gas_limit),
            ..Default::default()
        };

        match EthersChainWriter::new(writer_config, &private_key) {
            Ok(writer) => {
                info!(node_id, address = ?writer.address(), "EthersChainWriter initialized");
                self.check_signer_balance(&writer, rpc_url, node_id).await;
                Ok(Some(Arc::new(writer)))
            }
            Err(e) => {
                warn!(code = "INFRA-002", node_id, error = %e, "Failed to create ChainWriter");
                Ok(None)
            }
        }
    }

    async fn check_signer_balance(&self, writer: &EthersChainWriter, rpc_url: &str, node_id: u32) {
        let signer_address = writer.address();
        let provider = match ethers::providers::Provider::<ethers::providers::Http>::try_from(rpc_url) {
            Ok(p) => p,
            Err(_) => return,
        };

        match provider.get_balance(signer_address, None).await {
            Ok(balance) => {
                let min_balance = ethers::types::U256::exp10(17); // 0.1 IND
                if balance < min_balance {
                    warn!(
                        code = "INFRA-002",
                        node_id,
                        address = ?signer_address,
                        balance = %balance,
                        "Signer balance is low"
                    );
                } else {
                    info!(node_id, address = ?signer_address, balance = %balance, "Signer balance OK");
                }
            }
            Err(e) => {
                warn!(code = "INFRA-002", node_id, error = %e, "Failed to check signer balance");
            }
        }
    }

    async fn build_settlement(
        &self,
        node_id: u32,
    ) -> Result<(
        Option<Arc<dyn SettlementReader>>,
        Option<Arc<SettlementChainWriter>>,
    ), BootstrapError> {
        let bridge_proxy = match &self.params.bridge_proxy {
            Some(bp) => bp,
            None => {
                debug!(node_id, "Bridge ITP creation not configured (no --bridge-proxy flag)");
                return Ok((None, None));
            }
        };

        let settlement_rpc = self.config.effective_settlement_rpc_url()
            .map_err(|e| BootstrapError::Chain(e))?;
        let settlement_chain_id = self.config.effective_settlement_chain_id()
            .map_err(|e| BootstrapError::Chain(e))?;

        // Build SettlementChainReader (or DataNodeSettlementReader when data_node_url is set)
        let settlement_reader: Option<Arc<dyn SettlementReader>> = if let Some(ref data_node_url) = self.config.data_node_url {
            info!(node_id, url = %data_node_url, chain_id = settlement_chain_id, "Using DataNodeSettlementReader (reads via data-node)");
            Some(Arc::new(DataNodeSettlementReader::new(data_node_url.clone(), settlement_chain_id)) as Arc<dyn SettlementReader>)
        } else {
            let settlement_config = SettlementChainReaderConfig {
                rpc_url: settlement_rpc.clone(),
                bridge_proxy_address: bridge_proxy.parse().unwrap_or_default(),
                settlement_custody_address: self.config.effective_settlement_custody().unwrap_or_default(),
                chain_id: settlement_chain_id,
                confirmations: 2,
                max_block_range: 10_000,
            };

            match SettlementChainReader::new(settlement_config) {
                Ok(reader) => {
                    info!(node_id, bridge_proxy = %bridge_proxy, settlement_rpc = %settlement_rpc, "SettlementChainReader initialized");
                    Some(Arc::new(reader) as Arc<dyn SettlementReader>)
                }
                Err(e) => {
                    warn!(node_id, error = %e, "Failed to create SettlementChainReader");
                    None
                }
            }
        };

        // Build SettlementChainWriter
        // Use settlement_private_key if set (e.g. when issuer keys are EIP-7702 on settlement chain),
        // otherwise fall back to the issuer's own key.
        let settlement_key = self.config.settlement_private_key.clone()
            .or_else(|| self.config.effective_private_key().ok().flatten());
        let settlement_writer = match settlement_key {
            Some(ref private_key) => {
                let settlement_config = SettlementChainWriterConfig {
                    rpc_url: settlement_rpc.clone(),
                    bridge_proxy_address: bridge_proxy.parse().unwrap_or_default(),
                    settlement_custody_address: self.config.effective_settlement_custody().unwrap_or_default(),
                    chain_id: settlement_chain_id,
                    gas_config: GasConfig::default()
                        .with_multiplier(1.05)  // minimal 5% buffer
                        .with_eip1559(
                            ethers::types::U256::from(100_000_000u64),   // 0.1 gwei priority fee
                            ethers::types::U256::from(1_100_000_000u64), // 1.1 gwei max fee (Sonic base=1 gwei)
                        ),
                    ..Default::default()
                };

                match SettlementChainWriter::new(settlement_config, private_key) {
                    Ok(writer) => {
                        info!(node_id, bridge_proxy = %bridge_proxy, "SettlementChainWriter initialized");
                        Some(Arc::new(writer))
                    }
                    Err(e) => {
                        warn!(node_id, error = %e, "Failed to create SettlementChainWriter");
                        None
                    }
                }
            }
            _ => None,
        };

        // Log status
        match (&settlement_reader, &settlement_writer) {
            (Some(_), Some(_)) => {
                info!(node_id, bridge_proxy = %bridge_proxy, "Bridge ITP creation ENABLED");
            }
            (Some(_), None) => {
                warn!(code = "INFRA-002", node_id, "Bridge ITP creation PARTIAL: can detect but not complete");
            }
            (None, _) => {
                warn!(code = "INFRA-002", node_id, "Bridge ITP creation DISABLED");
            }
        }

        Ok((settlement_reader, settlement_writer))
    }
}
