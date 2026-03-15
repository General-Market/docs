//! Execution component builders (custody, swap, cross-chain orchestrators)

use super::{BootstrapError, ExecutionComponents};
use crate::execution::crosschain_orchestrator::{CrossChainOrchestrator, CrossChainOrchestratorConfig};
use crate::execution::swap_orchestrator::{SwapOrchestrator, SwapOrchestratorConfig};
use crate::{CustodyWriter, CustodyWriterConfig, OracleConfig, RoutingConfig};
use common::integrations::oneinch::{
    CachedQuoteClient, FusionPlusClient, FusionPlusConfig, OneInchConfig, OneInchQuoteClient,
    SwapCalldataBuilder,
};
use std::sync::Arc;
use tracing::{info, warn};

/// Builder for execution-related components
pub struct ExecutionBuilder<'a> {
    config: &'a OracleConfig,
    node_id: u32,
    cached_client: &'a Option<Arc<CachedQuoteClient<OneInchQuoteClient>>>,
}

impl<'a> ExecutionBuilder<'a> {
    pub fn new(
        config: &'a OracleConfig,
        node_id: u32,
        cached_client: &'a Option<Arc<CachedQuoteClient<OneInchQuoteClient>>>,
    ) -> Self {
        Self {
            config,
            node_id,
            cached_client,
        }
    }

    pub async fn build(self) -> Result<ExecutionComponents, BootstrapError> {
        // Build custody writer
        let custody_writer = self.build_custody_writer();

        // Build swap orchestrator (needs custody writer)
        let swap_orchestrator = self.build_swap_orchestrator(&custody_writer);

        // Build cross-chain orchestrator
        let crosschain_orchestrator = self.build_crosschain_orchestrator();

        // Build routing config
        let routing_config = self.build_routing_config();

        Ok(ExecutionComponents {
            custody_writer,
            swap_orchestrator,
            crosschain_orchestrator,
            routing_config,
        })
    }

    fn build_custody_writer(&self) -> Option<Arc<CustodyWriter>> {
        let settlement_custody_addr = self.config.effective_settlement_custody_address()?;
        let settlement_rpc = match self.config.effective_settlement_rpc_url() {
            Ok(url) => url,
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "CustodyWriter unavailable: Settlement RPC not configured");
                return None;
            }
        };

        let private_key = match self.config.effective_private_key() {
            Ok(Some(key)) => key,
            Ok(None) => {
                info!(self.node_id, "No private key configured - CustodyWriter unavailable");
                return None;
            }
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "Failed to load private key for CustodyWriter");
                return None;
            }
        };

        let settlement_chain_id = match self.config.effective_settlement_chain_id() {
            Ok(id) => id,
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "CustodyWriter unavailable: Settlement chain ID not configured");
                return None;
            }
        };

        let custody_config = CustodyWriterConfig {
            rpc_url: settlement_rpc.clone(),
            custody_address: settlement_custody_addr,
            chain_id: settlement_chain_id,
            ..Default::default()
        };

        match CustodyWriter::new(custody_config, &private_key) {
            Ok(writer) => {
                info!(
                    self.node_id,
                    custody_address = ?settlement_custody_addr,
                    settlement_rpc = %settlement_rpc,
                    "CustodyWriter initialized"
                );
                Some(Arc::new(writer))
            }
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "Failed to create CustodyWriter");
                None
            }
        }
    }

    fn build_swap_orchestrator(&self, custody: &Option<Arc<CustodyWriter>>) -> Option<Arc<SwapOrchestrator>> {
        let custody = custody.as_ref()?;
        let cached_client = self.cached_client.as_ref()?;
        let api_key = self.config.oneinch_api_key.as_ref()?;

        let settlement_chain_id = match self.config.effective_settlement_chain_id() {
            Ok(id) => id,
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "SwapOrchestrator unavailable: Settlement chain ID not configured");
                return None;
            }
        };

        let oneinch_config = OneInchConfig {
            api_key: api_key.clone(),
            chain_id: settlement_chain_id,
            custody_address: self.config.effective_settlement_custody_address().unwrap_or_default(),
            timeout: std::time::Duration::from_secs(5),
            base_url: "https://api.1inch.dev".to_string(),
        };

        match SwapCalldataBuilder::new(oneinch_config) {
            Ok(calldata_builder) => {
                let orchestrator = SwapOrchestrator::new(
                    cached_client.clone(),
                    Arc::new(calldata_builder),
                    custody.clone(),
                    SwapOrchestratorConfig::default(),
                );
                info!(self.node_id, "SwapOrchestrator initialized");
                Some(Arc::new(orchestrator))
            }
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "Failed to create SwapCalldataBuilder");
                None
            }
        }
    }

    fn build_crosschain_orchestrator(&self) -> Option<Arc<CrossChainOrchestrator>> {
        let fusion_api_key = self.config.oneinch_fusion_api_key.as_ref()
            .or(self.config.oneinch_api_key.as_ref())?;

        let src_chain_id = match self.config.effective_settlement_chain_id() {
            Ok(id) => id,
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "CrossChainOrchestrator unavailable: Settlement chain ID not configured");
                return None;
            }
        };

        let fusion_config = FusionPlusConfig::new(fusion_api_key.clone());

        match FusionPlusClient::new(fusion_config) {
            Ok(fusion_client) => {
                let cc_config = CrossChainOrchestratorConfig {
                    src_chain_id,
                    ..CrossChainOrchestratorConfig::default()
                };
                let orchestrator = CrossChainOrchestrator::new(
                    Arc::new(fusion_client),
                    cc_config,
                );
                info!(self.node_id, src_chain_id, "CrossChainOrchestrator initialized");
                Some(Arc::new(orchestrator))
            }
            Err(e) => {
                warn!(code = "INFRA-002", self.node_id, error = %e, "Failed to create FusionPlusClient");
                None
            }
        }
    }

    fn build_routing_config(&self) -> RoutingConfig {
        let config = RoutingConfig::default();
        info!(
            self.node_id,
            dex_pairs = config.dex_pair_ids.len(),
            crosschain_pairs = config.crosschain_pair_ids.len(),
            "Order routing configured (default: all CEX)"
        );
        config
    }
}
