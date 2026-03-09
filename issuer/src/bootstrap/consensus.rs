//! Consensus protocol and BLS key builders

use super::{
    BootstrapError, BootstrapParams, ChainComponents, ConsensusComponents, ConsensusKeyComponents,
    IssuerMetrics, P2PComponents, PriceComponents,
};
use crate::p2p::TcpP2PTransport;
use crate::{
    BridgeConfig, BridgeOrchestrator, ConsensusConfig, ConsensusProtocol,
    ConsensusTimeouts, ContractAddresses, CycleConfig, CycleLeaderState, CycleManager,
    EthersChainWriter, InMemoryKeyRegistry, IssuerConfig, ItpCreationConfig,
    LeaderElector, PriceFetcher,
};
use common::adapters::BitgetVaultReader;
use common::bls::BLSKeyPair;
use common::traits::ChainReader;
use ethers::prelude::Middleware;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use super::types::generate_peer_id;

/// Builder for consensus-related components
pub struct ConsensusBuilder<'a> {
    config: &'a IssuerConfig,
    params: &'a BootstrapParams,
    node_id: u32,
    contract_addresses: &'a ContractAddresses,
    chain_reader: &'a Arc<dyn ChainReader>,
}

impl<'a> ConsensusBuilder<'a> {
    pub fn new(
        config: &'a IssuerConfig,
        params: &'a BootstrapParams,
        node_id: u32,
        contract_addresses: &'a ContractAddresses,
        chain_reader: &'a Arc<dyn ChainReader>,
    ) -> Self {
        Self {
            config,
            params,
            node_id,
            contract_addresses,
            chain_reader,
        }
    }

    /// Build BLS keypair and key registry
    pub async fn build_keys(&self) -> Result<ConsensusKeyComponents, BootstrapError> {
        // Build BLS keypair first — needed for chain-based index derivation
        let bls_keypair = self.build_bls_keypair().await;

        // Build key registry
        let key_registry = self.build_key_registry().await;

        // Derive indices: try chain-based derivation using BLS pubkey matching,
        // fall back to CLI args if chain query fails or no BLS key available
        let (issuer_registry_index, node_index) = match self.derive_indices_from_chain(&bls_keypair).await {
            Ok((reg_idx, dense_idx)) => {
                info!(
                    self.node_id,
                    issuer_registry_index = reg_idx,
                    node_index = dense_idx,
                    "Derived indices from on-chain registry"
                );
                (reg_idx, dense_idx)
            }
            Err(e) => {
                let fallback_node_index = (self.node_id - 1) as u8;
                let fallback_registry_index = self.params.on_chain_issuer_id.unwrap_or(fallback_node_index);
                warn!(
                    self.node_id,
                    error = %e,
                    fallback_node_index,
                    fallback_registry_index,
                    "Failed to derive indices from chain, falling back to CLI args"
                );
                (fallback_registry_index, fallback_node_index)
            }
        };

        // Generate peer_id from the resolved issuer_registry_index
        let peer_id = generate_peer_id(issuer_registry_index as u32);

        Ok(ConsensusKeyComponents {
            bls_keypair,
            key_registry,
            peer_id,
            node_index,
            issuer_registry_index,
        })
    }

    /// Derive issuer_registry_index and node_index from on-chain registry by matching BLS pubkey.
    ///
    /// - `issuer_registry_index`: The on-chain issuer ID (used in signerBitmap)
    /// - `node_index`: Dense index = count of active issuers with ID < ours (used for leader election)
    async fn derive_indices_from_chain(&self, bls_keypair: &Option<common::bls::BLSKeyPair>) -> Result<(u8, u8), BootstrapError> {
        let keypair = bls_keypair.as_ref()
            .ok_or_else(|| BootstrapError::Config("Cannot derive chain indices: no BLS keypair available".to_string()))?;

        let my_bls_pubkey_bytes = keypair.public_key_bytes();

        let issuers = self.chain_reader.get_issuer_registry().await
            .map_err(|e| BootstrapError::Config(format!("Failed to query issuer registry for index derivation: {e}")))?;

        // Find our on-chain record by matching BLS pubkey
        let my_issuer = issuers.iter()
            .find(|i| {
                i.status == ethers::types::U256::one() && i.bls_pubkey.as_ref() == my_bls_pubkey_bytes.as_slice()
            })
            .ok_or_else(|| BootstrapError::Config(
                "This node's BLS pubkey not found among active issuers in on-chain registry".to_string()
            ))?;

        let issuer_registry_index = my_issuer.id as u8;

        // Dense index = count of active issuers with ID strictly less than ours
        let node_index = issuers.iter()
            .filter(|i| i.status == ethers::types::U256::one() && i.id < my_issuer.id)
            .count() as u8;

        Ok((issuer_registry_index, node_index))
    }

    /// Build the full consensus protocol (needs keys, P2P, chain, price components)
    pub async fn build_protocol(
        &self,
        keys: ConsensusKeyComponents,
        p2p: &P2PComponents,
        chain: &ChainComponents,
        price: &PriceComponents,
        target_chain_id: u64,
    ) -> Result<ConsensusComponents, BootstrapError> {
        // Calculate signature threshold — prefer on-chain activeIssuerCount, fall back to CLI --num-issuers
        let on_chain_active = match self.chain_reader.get_active_issuer_count().await {
            Ok(count) => {
                info!(self.node_id, on_chain_active_count = count, "Using on-chain activeIssuerCount for threshold");
                count as usize
            }
            Err(e) => {
                warn!(self.node_id, error = %e,
                    "Failed to query on-chain activeIssuerCount, falling back to --num-issuers CLI arg ({})",
                    self.params.num_issuers
                );
                self.params.num_issuers as usize
            }
        };
        let sig_threshold = self.params.signature_threshold_override.unwrap_or_else(|| {
            crate::consensus::aggregator::compute_threshold(on_chain_active)
        });

        // Build consensus timeouts (use CLI override or defaults)
        let timeouts = if let Some(total_ms) = self.params.consensus_timeout_ms {
            // Distribute: 15% proposal, 20% vote, 15% batch proposal, 50% batch sign
            // Batch signing needs the most time (collect from N-1 peers + BLS verify)
            let proposal = total_ms * 15 / 100;
            let vote = total_ms * 20 / 100;
            let batch_proposal = total_ms * 15 / 100;
            let batch_sign = total_ms - proposal - vote - batch_proposal;
            ConsensusTimeouts::new(
                std::time::Duration::from_millis(proposal),
                std::time::Duration::from_millis(vote),
                std::time::Duration::from_millis(batch_proposal),
                std::time::Duration::from_millis(batch_sign),
            )
        } else {
            ConsensusTimeouts::default()
        };

        // Startup assertion: consensus timeouts must fit within cycle duration
        timeouts.assert_fits_in_cycle(self.params.cycle_duration_ms);

        // Build ConsensusConfig
        let consensus_config = ConsensusConfig::new(keys.peer_id, self.params.num_issuers, keys.node_index)
            .with_timeouts(timeouts)
            .with_issuer_registry_index(keys.issuer_registry_index)
            .with_signature_threshold(sig_threshold);

        info!(
            self.node_id,
            num_issuers = self.params.num_issuers,
            node_index = keys.node_index,
            issuer_registry_index = keys.issuer_registry_index,
            signature_threshold = consensus_config.signature_threshold,
            "ConsensusConfig created"
        );

        // Build CycleManager
        let cycle_config = CycleConfig::with_duration_ms(self.params.cycle_duration_ms)
            .with_issuer_id(self.node_id)
            .with_min_cycle_gap_ms(self.params.min_cycle_gap_ms);
        let cycle_manager = if let Some(starting_cycle) = self.params.start_cycle {
            // Explicit --start-cycle: use interval-based timing (legacy mode)
            info!(
                self.node_id,
                cycle_duration_ms = self.params.cycle_duration_ms,
                phase_duration_ms = self.params.cycle_duration_ms / 5,
                starting_cycle,
                "CycleManager initialized (interval mode, explicit --start-cycle)"
            );
            CycleManager::new(cycle_config.clone())
                .with_starting_cycle(starting_cycle)
        } else {
            // Default: wall-clock aligned mode — all nodes derive the same
            // cycle number from unix_timestamp_ms / cycle_duration_ms
            info!(
                self.node_id,
                cycle_duration_ms = self.params.cycle_duration_ms,
                phase_duration_ms = self.params.cycle_duration_ms / 5,
                "CycleManager initialized (wall-clock aligned)"
            );
            CycleManager::new(cycle_config.clone())
        };

        // Build fill verifier
        let fill_verifier = self.build_fill_verifier(&chain.rpc_url);

        // Build ITP creation config
        let itp_creation_config = self.build_itp_creation_config(sig_threshold);

        // Build BridgeOrchestrator
        let bridge_orchestrator = self.build_bridge_orchestrator(
            chain,
            &keys,
            sig_threshold,
            target_chain_id,
        );

        // Build metrics and leader state
        let metrics = Arc::new(IssuerMetrics::new());
        let leader_elector = LeaderElector::new(keys.node_index, self.params.num_issuers);
        let leader_state = CycleLeaderState::genesis_with_issuers(self.params.num_issuers);

        // Record initial election
        let genesis_leader = leader_state.get_current_leader();
        let is_genesis_leader = keys.node_index == genesis_leader;
        metrics.record_election(is_genesis_leader);

        if is_genesis_leader {
            info!(self.node_id, genesis_leader, "This node is the genesis leader (cycle 0)");
        } else {
            info!(self.node_id, genesis_leader, "Genesis leader is node {}", genesis_leader + 1);
        }

        // Set heartbeat metrics
        metrics.set_heartbeat_metrics(p2p.heartbeat_metrics.clone());

        // Build ConsensusProtocol
        let protocol = self.build_consensus_protocol(
            &keys,
            p2p,
            chain,
            price,
            &consensus_config,
            &fill_verifier,
            &itp_creation_config,
            &bridge_orchestrator,
        ).await;

        Ok(ConsensusComponents {
            protocol,
            config: consensus_config,
            cycle_manager,
            cycle_config,
            fill_verifier,
            itp_creation_config,
            bridge_orchestrator,
            keys,
            metrics,
        })
    }

    async fn build_bls_keypair(&self) -> Option<BLSKeyPair> {
        // Try loading from file first
        let mut keypair = if let Some(ref bls_key_path) = self.config.bls_key_path {
            match std::fs::read(bls_key_path) {
                Ok(key_bytes) => {
                    match BLSKeyPair::from_bytes(&key_bytes) {
                        Ok(kp) => {
                            info!(self.node_id, bls_key_path = %bls_key_path.display(), "BLS keypair loaded from file");
                            self.verify_bls_key_registration(&kp).await;
                            Some(kp)
                        }
                        Err(e) => {
                            warn!(code = "INFRA-001", self.node_id, error = %e, "Failed to parse BLS key file");
                            None
                        }
                    }
                }
                Err(e) => {
                    warn!(code = "INFRA-001", self.node_id, error = %e, "Failed to read BLS key file");
                    None
                }
            }
        } else {
            if !self.params.mock_chain {
                warn!(self.node_id, "No BLS key path configured");
            }
            None
        };

        // Override with deterministic seed if specified
        if let Some(seed_idx) = self.params.bls_key_seed_index {
            // Must match bls-tool's keypair_from_seed_index: vec![idx; 32]
            let seed = vec![seed_idx; 32];
            match BLSKeyPair::from_seed(&seed) {
                Ok(kp) => {
                    info!(self.node_id, seed_index = seed_idx, "BLS keypair from deterministic seed");
                    keypair = Some(kp);
                }
                Err(e) => {
                    warn!(self.node_id, error = %e, "Failed to generate BLS keypair from seed");
                }
            }
        }

        if keypair.is_some() {
            info!(self.node_id, "BLS keypair ready for consensus signing");
        }

        keypair
    }

    async fn verify_bls_key_registration(&self, keypair: &BLSKeyPair) {
        if self.params.mock_chain {
            return;
        }

        let pub_key = keypair.public_key();
        info!(self.node_id, pub_key_len = pub_key.0.len(), "BLS public key derived");

        // Query IssuerRegistry for aggregated pubkey (informational)
        if self.contract_addresses.issuer_registry != ethers::types::Address::zero() {
            let rpc_url = self.config.effective_rpc_url();
            if let Ok(provider) = ethers::providers::Provider::<ethers::providers::Http>::try_from(&rpc_url) {
                let agg_pk_selector = ethers::utils::keccak256("getAggregatedPubkey()");
                let call_data = ethers::types::Bytes::from(agg_pk_selector[..4].to_vec());
                let tx = ethers::types::TransactionRequest::new()
                    .to(self.contract_addresses.issuer_registry)
                    .data(call_data);

                match provider.call(&tx.into(), None).await {
                    Ok(result) => {
                        info!(self.node_id, aggregated_pubkey_len = result.len(), "Aggregated pubkey retrieved");
                    }
                    Err(e) => {
                        warn!(code = "INFRA-001", self.node_id, error = %e, "Failed to query aggregated pubkey");
                    }
                }
            }
        }
    }

    async fn build_key_registry(&self) -> Option<Arc<InMemoryKeyRegistry>> {
        // 1. Try chain-based bootstrap (production path)
        if let Ok(issuers) = self.chain_reader.get_issuer_registry().await {
            let active_issuers: Vec<_> = issuers
                .iter()
                .filter(|i| i.status == ethers::types::U256::one())
                .collect();

            if !active_issuers.is_empty() {
                let registry = InMemoryKeyRegistry::new();
                let mut registered = 0usize;

                for issuer in &active_issuers {
                    let peer_id = generate_peer_id(issuer.id as u32);
                    let pubkey_bytes: &[u8] = issuer.bls_pubkey.as_ref();

                    if pubkey_bytes.len() != BLSKeyPair::PUBLIC_KEY_SIZE {
                        warn!(
                            issuer_id = issuer.id,
                            pubkey_len = pubkey_bytes.len(),
                            expected = BLSKeyPair::PUBLIC_KEY_SIZE,
                            "Skipping issuer: BLS pubkey wrong length"
                        );
                        continue;
                    }

                    // Validate the G2 point is on-curve before registering
                    if let Err(e) = common::bls::keypair::deserialize_g2_point(pubkey_bytes) {
                        warn!(
                            issuer_id = issuer.id,
                            error = %e,
                            "Skipping issuer: BLS pubkey is not a valid G2 point"
                        );
                        continue;
                    }

                    let pubkey = common::types::BLSPublicKey(pubkey_bytes.to_vec());
                    if let Err(e) = registry.register(peer_id, pubkey) {
                        warn!(
                            issuer_id = issuer.id,
                            error = %e,
                            "Failed to register BLS pubkey for issuer"
                        );
                    } else {
                        registered += 1;
                    }
                }

                if registered > 0 {
                    // Bootstrap registry nonce from chain
                    if let Ok(nonce) = self.chain_reader.get_registry_nonce().await {
                        registry.set_registry_nonce(nonce);
                        info!(registry_nonce = nonce, "Bootstrapped registry nonce from chain");
                    } else {
                        warn!("Failed to bootstrap registry nonce from chain, defaulting to 0");
                    }

                    info!(
                        peer_count = registered,
                        active_issuers = active_issuers.len(),
                        "InMemoryKeyRegistry built from on-chain issuer registry"
                    );
                    return Some(Arc::new(registry));
                }

                warn!("On-chain registry had active issuers but none had valid BLS pubkeys");
            }
        }

        // 2. Fallback: deterministic test seeds (local dev / E2E)
        if self.params.test_key_seeds {
            let (registry, keypairs) = InMemoryKeyRegistry::generate_test_registry_with_offset(
                self.params.num_issuers as usize,
                self.params.key_registry_offset as usize,
            );

            info!(
                self.node_id,
                peer_count = keypairs.len(),
                key_registry_offset = self.params.key_registry_offset,
                "InMemoryKeyRegistry built from deterministic test seeds"
            );

            return Some(Arc::new(registry));
        }

        warn!("No key registry available — consensus disabled");
        None
    }

    fn build_fill_verifier(&self, rpc_url: &str) -> Option<Arc<BitgetVaultReader>> {
        let vault_address = self.config.effective_bitget_vault()?;

        match BitgetVaultReader::new(rpc_url, vault_address) {
            Ok(reader) => {
                info!(
                    self.node_id,
                    vault_address = ?ethers::types::Address::from(vault_address),
                    "BitgetVaultReader initialized for on-chain fill verification (FR13)"
                );
                Some(Arc::new(reader))
            }
            Err(e) => {
                warn!(self.node_id, error = %e, "Failed to create BitgetVaultReader");
                None
            }
        }
    }

    fn build_itp_creation_config(&self, sig_threshold: usize) -> Option<ItpCreationConfig> {
        let bp_str = self.params.bridge_proxy.as_ref()?;

        let settlement_chain_id = match self.config.effective_settlement_chain_id() {
            Ok(id) => id,
            Err(e) => {
                warn!(self.node_id, error = %e, "ITP creation config disabled: Settlement chain ID not configured");
                return None;
            }
        };

        Some(ItpCreationConfig {
            settlement_chain_id,
            bridge_proxy_address: bp_str.parse().unwrap_or_default(),
            proposal_timeout_ms: self.params.sign_timeout_ms,
            sign_timeout_ms: self.params.sign_timeout_ms,
            min_signatures: sig_threshold,
        })
    }

    fn build_bridge_orchestrator(
        &self,
        chain: &ChainComponents,
        keys: &ConsensusKeyComponents,
        sig_threshold: usize,
        target_chain_id: u64,
    ) -> Option<Arc<RwLock<BridgeOrchestrator>>> {
        if chain.settlement_reader.is_none() {
            warn!(code = "BRIDGE-001", self.node_id,
                  "BridgeOrchestrator DISABLED: no SettlementChainReader (check ISSUER_SETTLEMENT_RPC_URL)");
            return None;
        }
        if chain.writer.is_none() {
            warn!(code = "BRIDGE-002", self.node_id,
                  "BridgeOrchestrator DISABLED: no L3 ChainWriter (check ISSUER_PRIVATE_KEY)");
            return None;
        }
        if keys.bls_keypair.is_none() {
            warn!(code = "BRIDGE-003", self.node_id,
                  "BridgeOrchestrator DISABLED: no BLS keypair");
            return None;
        }
        let settlement_reader = chain.settlement_reader.as_ref().unwrap();
        let chain_writer = chain.writer.as_ref().unwrap();
        let bls_keypair = keys.bls_keypair.as_ref().unwrap();

        let bridge_config = BridgeConfig {
            issuer_custody_l3: self.config.effective_issuer_custody_l3().unwrap_or_default(),
            l3_usdc_address: self.config.effective_l3_usdc().unwrap_or_default(),
            settlement_custody_address: self.config.effective_settlement_custody().unwrap_or_default(),
            settlement_chain_id: match self.config.effective_settlement_chain_id() {
                Ok(id) => id,
                Err(e) => {
                    warn!(code = "BRIDGE-004", self.node_id, error = %e,
                          "BridgeOrchestrator DISABLED: Settlement chain ID not configured");
                    return None;
                }
            },
            l3_chain_id: target_chain_id,
            index_address: self.config.effective_contract_addresses()
                .map(|c| c.index)
                .unwrap_or_default(),
            min_signatures: sig_threshold,
            proposal_timeout_ms: self.params.sign_timeout_ms,
            sign_timeout_ms: self.params.sign_timeout_ms,
            issuer_custody_settlement: self.config.effective_issuer_custody_settlement().unwrap_or_default(),
            settlement_usdc_address: self.config.effective_settlement_usdc().unwrap_or_default(),
            bitget_vault: self.config.effective_bitget_vault()
                .map(ethers::types::Address::from)
                .unwrap_or_default(),
            signer_address: chain_writer.address(),
            collateral_registry: self.config.collateral_registry_address
                .as_ref()
                .and_then(|a| a.parse::<ethers::types::Address>().ok())
                .unwrap_or_default(),
            bridge_proxy: self.params.bridge_proxy.as_ref()
                .and_then(|a| a.parse::<ethers::types::Address>().ok())
                .or_else(|| self.config.effective_bridge_proxy_address())
                .unwrap_or_default(),
            mirror_registry_address: self.config.mirror_registry_address
                .as_ref()
                .and_then(|a| a.parse::<ethers::types::Address>().ok()),
        };

        // Validate critical bridge config addresses
        if bridge_config.index_address == ethers::types::Address::zero() {
            warn!(code = "BRIDGE-004", self.node_id,
                  "BridgeConfig.index_address is zero — bridge orchestrator may not function correctly");
        }
        if bridge_config.issuer_custody_l3 == ethers::types::Address::zero() {
            warn!(code = "BRIDGE-005", self.node_id,
                  "BridgeConfig.issuer_custody_l3 is zero address");
        }
        if bridge_config.l3_usdc_address == ethers::types::Address::zero() {
            warn!(code = "BRIDGE-006", self.node_id,
                  "BridgeConfig.l3_usdc_address is zero address");
        }
        if bridge_config.settlement_custody_address == ethers::types::Address::zero() {
            warn!(code = "BRIDGE-007", self.node_id,
                  "BridgeConfig.settlement_custody_address is zero address");
        }

        info!(
            self.node_id,
            node_index = keys.node_index,
            settlement_custody = ?self.config.effective_settlement_custody(),
            issuer_custody_l3 = ?self.config.effective_issuer_custody_l3(),
            bridge_proxy = ?bridge_config.bridge_proxy,
            settlement_chain_id = bridge_config.settlement_chain_id,
            min_signatures = sig_threshold,
            "BridgeOrchestrator initialized"
        );

        let order_reader = Arc::new(crate::chain::SettlementOrderReader(settlement_reader.clone()));
        let orchestrator = BridgeOrchestrator::new(
            bridge_config,
            order_reader,
            chain_writer.clone(),
            bls_keypair.clone(),
            keys.peer_id,
            keys.node_index,
        );

        Some(Arc::new(RwLock::new(orchestrator)))
    }

    async fn build_consensus_protocol(
        &self,
        keys: &ConsensusKeyComponents,
        p2p: &P2PComponents,
        chain: &ChainComponents,
        price: &PriceComponents,
        consensus_config: &ConsensusConfig,
        fill_verifier: &Option<Arc<BitgetVaultReader>>,
        itp_creation_config: &Option<ItpCreationConfig>,
        bridge_orchestrator: &Option<Arc<RwLock<BridgeOrchestrator>>>,
    ) -> Option<Arc<ConsensusProtocol<TcpP2PTransport, EthersChainWriter, InMemoryKeyRegistry, Arc<dyn PriceFetcher>>>> {
        let p2p_transport = p2p.transport.as_ref()?;
        let bls_keypair = keys.bls_keypair.as_ref()?;
        let chain_writer = chain.writer.as_ref()?;
        let key_registry = keys.key_registry.as_ref()?;

        let price_fetcher = price.fetcher.clone();

        let mut protocol = ConsensusProtocol::new(
            bls_keypair.clone(),
            p2p_transport.clone(),
            chain_writer.clone(),
            key_registry.clone(),
            Arc::new(price_fetcher),
            consensus_config.clone(),
        );

        // Attach fill verifier if available
        if let Some(verifier) = fill_verifier {
            protocol = protocol.with_fill_verifier(verifier.clone());
            info!(self.node_id, "ConsensusProtocol with on-chain fill verifier (FR13)");
        }

        // Attach peer scorer from transport for leader identity verification
        protocol = protocol.with_peer_scorer(p2p_transport.peer_scorer().clone());
        info!(self.node_id, "ConsensusProtocol with peer scorer for leader verification");

        // Attach WAL if configured
        if let Some(ref wal_path) = self.params.wal_path {
            let sync_mode = match self.params.wal_sync_mode.as_deref() {
                Some("fsync") => crate::p2p::wal::WalSyncMode::Fsync,
                Some("none") => crate::p2p::wal::WalSyncMode::None,
                _ => crate::p2p::wal::WalSyncMode::Fdatasync, // default
            };
            match crate::p2p::wal::ConsensusWAL::open(wal_path, sync_mode) {
                Ok(wal) => {
                    protocol = protocol.with_wal(wal);
                    info!(self.node_id, wal_path = %wal_path.display(), "ConsensusProtocol with WAL");
                }
                Err(e) => {
                    warn!(self.node_id, error = %e, wal_path = %wal_path.display(),
                          "Failed to open WAL, continuing without WAL");
                }
            }
        }

        let protocol = Arc::new(protocol);

        // Set ITP creation config
        if let Some(ref itp_config) = itp_creation_config {
            protocol.set_itp_creation_config(itp_config.clone()).await;
            info!(self.node_id, "ConsensusProtocol configured with ITP creation config");
        }

        // Set BridgeOrchestrator
        if let Some(ref orch) = bridge_orchestrator {
            protocol.set_bridge_orchestrator(orch.clone()).await;
            info!(self.node_id, "ConsensusProtocol configured with BridgeOrchestrator");
        }

        info!(self.node_id, "ConsensusProtocol constructed (real P2P + BLS + ChainWriter + KeyRegistry)");
        Some(protocol)
    }
}
