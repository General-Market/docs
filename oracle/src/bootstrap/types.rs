//! Shared types for bootstrap module

use crate::{
    SettlementChainWriter, SettlementReader, BridgeOrchestrator, ConsensusConfig,
    ConsensusProtocol, CycleConfig, CycleManager, EthersChainWriter,
    HeartbeatMetrics, HeartbeatMonitor, InMemoryKeyRegistry, OracleState, ItpCreationConfig,
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
    pub settlement_reader: Option<Arc<dyn SettlementReader>>,
    pub settlement_writer: Option<Arc<SettlementChainWriter>>,
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
    pub oracle_registry_index: u8,
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
    pub metrics: Arc<OracleMetrics>,
}

/// All oracle components bundled together
pub struct OracleComponents {
    pub node_id: u32,
    pub target_chain_id: u64,
    pub chain: ChainComponents,
    pub oracle_state: OracleState,
    pub price: PriceComponents,
    pub execution: ExecutionComponents,
    pub p2p: P2PComponents,
    pub consensus: ConsensusComponents,
    pub shutdown: Arc<AtomicBool>,
    /// Registry sync cache for GET /api/registry-sync endpoint (Story 8.4)
    pub registry_sync_cache: Option<RegistrySyncCache>,
}

/// Shared metrics state for leader election and consensus tracking
pub struct OracleMetrics {
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
    /// Consecutive consensus cycles observed with zero signers.
    /// Reset when any consensus result has signer_count > 0.
    pub consecutive_zero_signer_cycles: AtomicU64,
    /// Set to 1 when the oracle considers itself stalled (>= 3 zero-signer
    /// cycles). Exposed via /health for scraping.
    pub oracle_stalled: AtomicU64,
}

impl OracleMetrics {
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
            consecutive_zero_signer_cycles: AtomicU64::new(0),
            oracle_stalled: AtomicU64::new(0),
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

    /// Record a follower-side consensus observation (Success with signer_count=0
    /// for price cycles, or NAV cycles where this oracle wasn't the aggregator).
    /// Increments rounds but NEVER touches the stalled breaker — a follower
    /// legitimately has zero local signatures every cycle it isn't leader.
    pub fn record_consensus_heartbeat(&self, duration_ms: u64) {
        self.consensus_rounds_total.fetch_add(1, Ordering::Relaxed);
        self.consensus_success_total.fetch_add(1, Ordering::Relaxed);
        self.last_consensus_time_ms.store(duration_ms, Ordering::Relaxed);
        self.consensus_in_progress.store(false, Ordering::Relaxed);
    }

    /// Record a consensus failure from THIS oracle's view (timeout, P2P glitch,
    /// leader-didn't-respond). Increments rounds + failures, but doesn't flip
    /// the stalled breaker — a follower timing out doesn't mean this oracle
    /// has stopped producing signatures, only that one cycle went sideways.
    pub fn record_consensus_failure(&self, duration_ms: u64) {
        self.consensus_rounds_total.fetch_add(1, Ordering::Relaxed);
        self.consensus_failed_total.fetch_add(1, Ordering::Relaxed);
        self.last_consensus_time_ms.store(duration_ms, Ordering::Relaxed);
        self.consensus_in_progress.store(false, Ordering::Relaxed);
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

        // Circuit breaker: three consecutive cycles with zero signers escalates
        // from warning to error and flips oracle_stalled=1. The 2026-04 outage
        // had signer_count=0 for days logged at INFO; nothing above noticed.
        if signer_count == 0 {
            let n = self
                .consecutive_zero_signer_cycles
                .fetch_add(1, Ordering::Relaxed)
                + 1;
            if n >= 3 {
                if self.oracle_stalled.swap(1, Ordering::Relaxed) == 0 {
                    tracing::error!(
                        consecutive_zero_signer_cycles = n,
                        "oracle_stalled: {} consecutive consensus cycles with zero signers. \
                         This oracle is signing nothing. Investigate peers, BLS keys, and registry.",
                        n
                    );
                } else {
                    tracing::error!(
                        consecutive_zero_signer_cycles = n,
                        "oracle_stalled still set: signer_count=0 cycle #{}",
                        n
                    );
                }
            } else {
                tracing::warn!(
                    consecutive_zero_signer_cycles = n,
                    "consensus cycle completed with zero signers"
                );
            }
        } else {
            // Recovery: any cycle with signers clears the breaker.
            let prev = self
                .consecutive_zero_signer_cycles
                .swap(0, Ordering::Relaxed);
            if self.oracle_stalled.swap(0, Ordering::Relaxed) == 1 {
                tracing::info!(
                    prev_consecutive_zero_cycles = prev,
                    "oracle_stalled cleared: consensus produced signatures again"
                );
            }
        }
    }

    pub fn record_cycle_duration(&self, duration_ms: u64) {
        self.last_cycle_duration_ms.store(duration_ms, Ordering::Relaxed);
    }

    pub fn record_orders_processed(&self, count: u64) {
        self.orders_processed_last_60s.fetch_add(count, Ordering::Relaxed);
    }

    pub fn update_pending_order_count(&self, count: u64) {
        self.pending_order_count.store(count, Ordering::Relaxed);
    }
}

impl Default for OracleMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Generate a deterministic peer ID from node_id.
/// Adds 1 to avoid producing all-zeros ([0u8; 32]) which the P2P layer
/// uses as a sentinel for "unknown/unidentified peer".
///
/// The encoding stores `(node_id + 1)` as a little-endian u32 in bytes [0..4].
/// Use [`extract_oracle_id`] to recover the original node_id from a peer_id.
pub fn generate_peer_id(node_id: u32) -> [u8; 32] {
    let mut peer_id = [0u8; 32];
    peer_id[0..4].copy_from_slice(&(node_id + 1).to_le_bytes());
    peer_id
}

/// Extract the oracle/node ID from a peer_id generated by [`generate_peer_id`].
///
/// Returns the original `node_id` that was passed to `generate_peer_id`.
/// This is the on-chain oracle ID used for bitmap computation.
pub fn extract_oracle_id(peer_id: &[u8; 32]) -> u32 {
    let encoded = u32::from_le_bytes([peer_id[0], peer_id[1], peer_id[2], peer_id[3]]);
    encoded.saturating_sub(1)
}
