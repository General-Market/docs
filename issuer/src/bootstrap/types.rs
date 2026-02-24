//! Shared types for bootstrap module

use crate::{
    ArbitrumChainReader, ArbitrumChainWriter, BridgeOrchestrator, ConsensusConfig,
    ConsensusProtocol, CycleConfig, CycleManager, EthersChainReader, EthersChainWriter,
    HeartbeatMetrics, HeartbeatMonitor, InMemoryKeyRegistry, IssuerState, ItpCreationConfig,
    PeerHealthTracker, PriceFetcher, RegistrySyncCache,
};
use crate::execution::{
    crosschain_orchestrator::CrossChainOrchestrator,
    swap_orchestrator::SwapOrchestrator,
};
use crate::p2p::TcpP2PTransport;
use crate::{CustodyWriter, DexPriceSource, RoutingConfig};
use common::adapters::BitgetVaultReader;
use common::bls::BLSKeyPair;
use common::integrations::oneinch::{CachedQuoteClient, OneInchQuoteClient};
use common::traits::ChainReader;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Error type for bootstrap operations
#[derive(Debug, thiserror::Error)]
pub enum BootstrapError {
    #[error("Missing node_id in config")]
    MissingNodeId,

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Chain connection error: {0}")]
    Chain(String),

    #[error("P2P error: {0}")]
    P2P(String),

    #[error("Consensus setup error: {0}")]
    Consensus(String),

    #[error("State reconstruction error: {0}")]
    State(String),
}

/// Chain-related components
pub struct ChainComponents {
    pub reader: Arc<dyn ChainReader>,
    pub writer: Option<Arc<EthersChainWriter>>,
    pub arbitrum_reader: Option<Arc<ArbitrumChainReader<ethers::providers::Provider<ethers::providers::Http>>>>,
    pub arbitrum_writer: Option<Arc<ArbitrumChainWriter>>,
    pub rpc_url: String,
}

/// Price-related components
pub struct PriceComponents {
    pub fetcher: Arc<dyn PriceFetcher>,
    pub symbol_map: crate::SymbolMap,
    pub dex_source: Option<Arc<DexPriceSource>>,
    pub shared_cached_client: Option<Arc<CachedQuoteClient<OneInchQuoteClient>>>,
}

/// Execution-related components
pub struct ExecutionComponents {
    pub custody_writer: Option<Arc<CustodyWriter>>,
    pub swap_orchestrator: Option<Arc<SwapOrchestrator>>,
    pub crosschain_orchestrator: Option<Arc<CrossChainOrchestrator>>,
    pub routing_config: RoutingConfig,
}

/// P2P and networking components
pub struct P2PComponents {
    pub transport: Option<Arc<TcpP2PTransport>>,
    pub heartbeat_monitor: Option<Arc<HeartbeatMonitor<TcpP2PTransport>>>,
    pub heartbeat_metrics: Arc<HeartbeatMetrics>,
    pub heartbeat_tracker: Arc<RwLock<PeerHealthTracker>>,
    pub health_port: u16,
}

/// BLS keys and registry
pub struct ConsensusKeyComponents {
    pub bls_keypair: Option<BLSKeyPair>,
    pub key_registry: Option<Arc<InMemoryKeyRegistry>>,
    pub peer_id: [u8; 32],
    pub node_index: u8,
    pub issuer_registry_index: u8,
}

/// Consensus-related components
pub struct ConsensusComponents {
    pub protocol: Option<Arc<ConsensusProtocol<TcpP2PTransport, EthersChainWriter, InMemoryKeyRegistry, Arc<dyn PriceFetcher>>>>,
    pub config: ConsensusConfig,
    pub cycle_manager: CycleManager,
    pub cycle_config: CycleConfig,
    pub fill_verifier: Option<Arc<BitgetVaultReader>>,
    pub itp_creation_config: Option<ItpCreationConfig>,
    pub bridge_orchestrator: Option<Arc<RwLock<BridgeOrchestrator>>>,
    pub keys: ConsensusKeyComponents,
    pub metrics: Arc<IssuerMetrics>,
}

/// All issuer components bundled together
pub struct IssuerComponents {
    pub node_id: u32,
    pub target_chain_id: u64,
    pub chain: ChainComponents,
    pub issuer_state: IssuerState,
    pub price: PriceComponents,
    pub execution: ExecutionComponents,
    pub p2p: P2PComponents,
    pub consensus: ConsensusComponents,
    pub shutdown: Arc<AtomicBool>,
    /// Registry sync cache for GET /api/registry-sync endpoint (Story 8.4)
    pub registry_sync_cache: Option<RegistrySyncCache>,
}

/// Shared metrics state for leader election and consensus tracking
pub struct IssuerMetrics {
    pub elections_count: AtomicU64,
    pub tenure_cycles: AtomicU64,
    pub is_leader: AtomicBool,
    pub consensus_rounds_total: AtomicU64,
    pub consensus_success_total: AtomicU64,
    pub consensus_failed_total: AtomicU64,
    pub signatures_collected_total: AtomicU64,
    pub last_consensus_time_ms: AtomicU64,
    pub consensus_in_progress: AtomicBool,
    pub heartbeat_metrics: std::sync::RwLock<Option<Arc<HeartbeatMetrics>>>,
    /// Orders processed in the last 60 seconds (rolling counter)
    pub orders_processed_last_60s: AtomicU64,
    /// Last cycle duration in milliseconds
    pub last_cycle_duration_ms: AtomicU64,
    /// Current pending order count from chain
    pub pending_order_count: AtomicU64,
}

impl IssuerMetrics {
    pub fn new() -> Self {
        Self {
            elections_count: AtomicU64::new(0),
            tenure_cycles: AtomicU64::new(0),
            is_leader: AtomicBool::new(false),
            consensus_rounds_total: AtomicU64::new(0),
            consensus_success_total: AtomicU64::new(0),
            consensus_failed_total: AtomicU64::new(0),
            signatures_collected_total: AtomicU64::new(0),
            last_consensus_time_ms: AtomicU64::new(0),
            consensus_in_progress: AtomicBool::new(false),
            heartbeat_metrics: std::sync::RwLock::new(None),
            orders_processed_last_60s: AtomicU64::new(0),
            last_cycle_duration_ms: AtomicU64::new(0),
            pending_order_count: AtomicU64::new(0),
        }
    }

    /// Determine health status based on metrics
    /// Returns ("healthy", 200), ("degraded", 200), or ("unhealthy", 503)
    pub fn health_status(&self, connected_peers: usize) -> (&'static str, u16) {
        // No peers = unhealthy (can't participate in consensus)
        if connected_peers == 0 {
            return ("unhealthy", 503);
        }

        let last_cycle_ms = self.last_cycle_duration_ms.load(Ordering::Relaxed);

        // Cycle taking more than 2x the 1s target = degraded
        if last_cycle_ms > 2000 {
            return ("degraded", 200);
        }

        ("healthy", 200)
    }

    pub fn set_heartbeat_metrics(&self, metrics: Arc<HeartbeatMetrics>) {
        if let Ok(mut guard) = self.heartbeat_metrics.write() {
            *guard = Some(metrics);
        }
    }

    pub fn record_election(&self, is_leader: bool) {
        self.elections_count.fetch_add(1, Ordering::Relaxed);
        self.is_leader.store(is_leader, Ordering::Relaxed);
        if is_leader {
            self.tenure_cycles.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn record_consensus_start(&self) {
        self.consensus_in_progress.store(true, Ordering::Relaxed);
    }

    pub fn record_consensus_result(&self, success: bool, signer_count: usize, duration_ms: u64) {
        self.consensus_rounds_total.fetch_add(1, Ordering::Relaxed);
        if success {
            self.consensus_success_total.fetch_add(1, Ordering::Relaxed);
            self.signatures_collected_total
                .fetch_add(signer_count as u64, Ordering::Relaxed);
        } else {
            self.consensus_failed_total.fetch_add(1, Ordering::Relaxed);
        }
        self.last_consensus_time_ms.store(duration_ms, Ordering::Relaxed);
        self.consensus_in_progress.store(false, Ordering::Relaxed);
    }
}

impl Default for IssuerMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Generate a deterministic peer ID from node_id.
/// Adds 1 to avoid producing all-zeros ([0u8; 32]) which the P2P layer
/// uses as a sentinel for "unknown/unidentified peer".
pub fn generate_peer_id(node_id: u32) -> [u8; 32] {
    let mut peer_id = [0u8; 32];
    peer_id[0..4].copy_from_slice(&(node_id + 1).to_le_bytes());
    peer_id
}
