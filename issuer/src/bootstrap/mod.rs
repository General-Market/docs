//! Bootstrap module for Issuer node initialization
//!
//! Extracts component initialization from main.rs into composable builders.

mod chain;
mod consensus;
mod execution;
mod p2p;
mod price;
mod state;
mod types;

pub use chain::ChainBuilder;
pub use consensus::ConsensusBuilder;
pub use execution::ExecutionBuilder;
pub use p2p::P2PBuilder;
pub use price::PriceBuilder;
pub use state::StateBuilder;
pub use types::*;

use crate::{IssuerConfig, ContractAddresses, new_registry_sync_cache};
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tracing::info;

/// Runtime parameters from CLI args that affect bootstrap
#[derive(Clone)]
pub struct BootstrapParams {
    pub mock_chain: bool,
    pub no_tls: bool,
    pub skip_reconstruction: bool,
    pub from_block: Option<u64>,
    pub checkpoint_path: String,
    pub cycle_duration_ms: u64,
    pub num_issuers: u8,
    pub signature_threshold_override: Option<usize>,
    pub bls_key_seed_index: Option<u8>,
    pub on_chain_issuer_id: Option<u8>,
    pub test_key_seeds: bool,
    pub key_registry_offset: u8,
    pub bridge_proxy: Option<String>,
    pub symbol_map_file: Option<std::path::PathBuf>,
    pub chain_id_override: Option<u64>,
    /// Starting cycle number for on-chain submissions (avoids E019_CycleAlreadyProcessed).
    /// If None, starts from 0. Set to a high value (e.g., 10000000) for fresh deployments
    /// where earlier cycles may have been used during manual testing.
    pub start_cycle: Option<u64>,
    /// Override asset count for bootstrap when on-chain assetCount() returns 0.
    pub asset_count_override: Option<u64>,
    /// Minimum gap between fast (work-driven) cycles in milliseconds (default: 50ms).
    pub min_cycle_gap_ms: u64,
    /// Maximum gas limit for transactions (default: 15M).
    pub max_gas_limit: u64,
    /// Receipt wait timeout in seconds (default: 30).
    pub receipt_timeout_secs: u64,
    /// Custom consensus timeout total in milliseconds (overrides default 800ms).
    pub consensus_timeout_ms: Option<u64>,
    /// Maximum connections allowed from a single IP address (0 = unlimited, default: 2).
    /// Loopback IPs (127.x.x.x) are always exempt for local dev.
    pub p2p_max_per_ip: usize,
    /// Rate limit: tokens refilled per second per peer connection (default: 100).
    pub p2p_rate_limit: f64,
    /// Rate burst: maximum burst size / token bucket capacity (default: 100).
    pub p2p_rate_burst: f64,
}

/// Main bootstrap orchestrator
pub struct IssuerBootstrap {
    config: IssuerConfig,
    params: BootstrapParams,
}

impl IssuerBootstrap {
    pub fn new(config: IssuerConfig, params: BootstrapParams) -> Self {
        Self { config, params }
    }

    /// Build all issuer components
    pub async fn build(mut self, shutdown: Arc<AtomicBool>) -> Result<IssuerComponents, BootstrapError> {
        let node_id = self.config.node_id.ok_or(BootstrapError::MissingNodeId)?;
        let target_chain_id = self.params.chain_id_override.unwrap_or(111222333);

        info!(node_id, "Starting issuer bootstrap");

        // Resolve contract addresses
        let contract_addresses = if self.params.mock_chain {
            ContractAddresses::default()
        } else {
            self.config.effective_contract_addresses()
                .map_err(|e| BootstrapError::Config(e.to_string()))?
        };

        // Build chain components
        let chain = ChainBuilder::new(&self.config, &self.params, &contract_addresses, target_chain_id)
            .build()
            .await?;

        // Log last processed cycle for diagnostics (wall-clock mode uses unix-time-derived cycles)
        if self.params.start_cycle.is_none() && !self.params.mock_chain && !self.params.skip_reconstruction {
            match chain.reader.get_last_processed_cycle().await {
                Ok(last_cycle) => {
                    info!(
                        node_id,
                        last_processed_cycle = last_cycle,
                        "Last on-chain cycle (wall-clock mode: cycles derived from unix timestamp)"
                    );
                    // Do NOT set start_cycle — wall-clock aligned mode will derive
                    // cycle numbers from unix_timestamp_ms / cycle_duration_ms
                }
                Err(e) => {
                    info!(
                        node_id,
                        error = %e,
                        "Could not query lastProcessedCycleNumber (wall-clock mode active)"
                    );
                }
            }
        }

        // Build state
        let issuer_state = StateBuilder::new(&self.config, &self.params, &contract_addresses, target_chain_id)
            .build(&chain.reader)
            .await?;

        // Build price components
        let price = PriceBuilder::new(&self.config, &self.params, node_id)
            .build()
            .await?;

        // Build execution components
        let execution = ExecutionBuilder::new(&self.config, &self.params, node_id, &price.shared_cached_client)
            .build()
            .await?;

        // Build consensus components (BLS, key registry)
        let consensus_keys = ConsensusBuilder::new(&self.config, &self.params, node_id, &contract_addresses, &chain.reader)
            .build_keys()
            .await?;

        // Build P2P components
        let p2p = P2PBuilder::new(&self.config, &self.params, node_id, &consensus_keys.peer_id, &chain)
            .build()
            .await?;

        // Build consensus protocol (needs P2P and other components)
        let consensus = ConsensusBuilder::new(&self.config, &self.params, node_id, &contract_addresses, &chain.reader)
            .build_protocol(
                consensus_keys,
                &p2p,
                &chain,
                &price,
                target_chain_id,
            )
            .await?;

        // Create registry sync cache if enabled (Story 8.4, Task 7.2)
        let registry_sync_cache = if self.config.effective_registry_sync_enabled() {
            info!(node_id, "Registry sync enabled, creating cache");
            Some(new_registry_sync_cache())
        } else {
            None
        };

        info!(node_id, "Bootstrap complete");

        Ok(IssuerComponents {
            node_id,
            target_chain_id,
            chain,
            issuer_state,
            price,
            execution,
            p2p,
            consensus,
            shutdown,
            registry_sync_cache,
        })
    }
}
