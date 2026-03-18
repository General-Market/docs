//! State reconstruction builder

use super::{BootstrapError, BootstrapParams};
use crate::{ContractAddresses, OracleConfig, OracleState, ReconstructorConfig, StateReconstructor};
use common::traits::ChainReader;
use std::sync::Arc;
use tracing::{info, warn};

/// Builder for oracle state (reconstruction or fresh)
pub struct StateBuilder<'a> {
    config: &'a OracleConfig,
    params: &'a BootstrapParams,
    contract_addresses: &'a ContractAddresses,
    target_chain_id: u64,
}

impl<'a> StateBuilder<'a> {
    pub fn new(
        config: &'a OracleConfig,
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

    pub async fn build(self, _chain_reader: &Arc<dyn ChainReader>) -> Result<OracleState, BootstrapError> {
        let node_id = self.config.node_id.unwrap_or(0);

        let mut state = if self.params.skip_reconstruction {
            info!(node_id, "Skipping state reconstruction (--skip-reconstruction)");
            OracleState::new()
        } else if !self.params.mock_chain {
            self.reconstruct_state(node_id).await
        } else {
            info!(node_id, "Mock mode: skipping state reconstruction");
            OracleState::new()
        };

        // Skip observation period — observe_cycle() is never called in the main loop,
        // so any non-zero value permanently locks the oracle in price-only mode.
        state.set_observation_period(0);

        info!(
            node_id,
            pending_orders = state.pending_order_count(),
            itps = state.itp_count(),
            current_cycle = %state.current_cycle,
            observation_cycles = state.observation_cycles_remaining,
            can_participate = state.can_participate(),
            "Oracle state ready"
        );

        Ok(state)
    }

    async fn reconstruct_state(&self, node_id: u32) -> OracleState {
        info!(node_id, "Starting state reconstruction...");

        let rpc_url = self.config.effective_rpc_url();

        // Try to load checkpoint first (unless --from-block specified)
        if self.params.from_block.is_none() {
            if let Some(state) = self.try_load_checkpoint(node_id).await {
                return state;
            }
        } else {
            info!(node_id, from_block = self.params.from_block.unwrap(), "Using --from-block, ignoring checkpoint");
        }

        // Reconstruct from chain
        self.reconstruct_from_chain(node_id, &rpc_url).await
    }

    async fn try_load_checkpoint(&self, node_id: u32) -> Option<OracleState> {
        match StateReconstructor::<ethers::providers::Provider<ethers::providers::Http>>::load_checkpoint(&self.params.checkpoint_path) {
            Ok(Some(cp)) => {
                info!(
                    node_id,
                    checkpoint_block = cp.block_number,
                    "Loaded checkpoint from {}",
                    self.params.checkpoint_path
                );
                info!(
                    node_id,
                    pending_orders = cp.state.pending_order_count(),
                    itps = cp.state.itp_count(),
                    cycle = %cp.state.current_cycle,
                    "Using state from checkpoint"
                );
                Some(cp.state)
            }
            Ok(None) => {
                info!(node_id, "No checkpoint found, will reconstruct from genesis");
                None
            }
            Err(e) => {
                warn!(code = "INFRA-001", node_id, error = %e, "Failed to load checkpoint");
                None
            }
        }
    }

    async fn reconstruct_from_chain(&self, node_id: u32, rpc_url: &str) -> OracleState {
        let collateral_registry_addr = self.config.collateral_registry_address.as_ref()
            .and_then(|addr| addr.parse::<ethers::types::Address>().ok());

        let usdc_addr = "0x183A81F735430AAF58227aF4c0D7B35bC8e0f8B6"
            .parse::<ethers::types::Address>()
            .ok();

        let mut custody_contracts = std::collections::HashMap::new();
        if let Some(ref bls_custody_str) = self.config.bls_custody_address {
            if let Ok(addr) = bls_custody_str.parse::<ethers::types::Address>() {
                custody_contracts.insert(self.target_chain_id, addr);
            }
        }

        let reconstructor_config = ReconstructorConfig {
            rpc_url: rpc_url.to_string(),
            index_contract: self.contract_addresses.index,
            collateral_registry: collateral_registry_addr,
            custody_contracts,
            usdc_address: usdc_addr,
            checkpoint_path: Some(self.params.checkpoint_path.clone()),
            from_block: self.params.from_block,
            ..Default::default()
        };

        match StateReconstructor::new(reconstructor_config) {
            Ok(reconstructor) => {
                match reconstructor.reconstruct_state().await {
                    Ok((state, stats)) => {
                        info!(
                            node_id,
                            duration_ms = stats.duration_ms,
                            pending_orders = stats.pending_orders,
                            itps_loaded = stats.itps_loaded,
                            current_cycle = %stats.current_cycle,
                            "State reconstruction complete"
                        );
                        state
                    }
                    Err(e) => {
                        warn!(code = "INFRA-001", node_id, error = %e, "State reconstruction failed, using empty state");
                        OracleState::new()
                    }
                }
            }
            Err(e) => {
                warn!(code = "INFRA-001", node_id, error = %e, "Failed to create StateReconstructor");
                OracleState::new()
            }
        }
    }
}
