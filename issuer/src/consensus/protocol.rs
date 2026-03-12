//! ConsensusProtocol coordinator
//!
//! Main entry point for running consensus rounds.
//! Coordinates price consensus, batch consensus, and signature aggregation.

use std::sync::Arc;

use common::adapters::BitgetVaultReader;
use common::bls::{aggregate_pubkeys, BLSKeyPair, Bn254BLSSigner};
use common::error::Error;
use common::traits::{BLSSigner, ChainWriter, P2PTransport};
use common::types::{Fill, P2PMessage, PeerId, Price};
use common::BLSSignature;
use ethers::types::{Address, H256, U256};
use tokio::sync::RwLock;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

use super::ConsensusError;
use super::handler_macros::{bridge_proposal_handler, bridge_sign_handler};
use super::itp_creation::{
    build_message_hash, compute_assets_hash, compute_weights_hash, verify_proposal_matches_request,
    ItpCreationConfig, ItpCreationError, ItpCreationResult,
};

// Story 7.9: Import bridge types for BridgeOrchestrator integration
use crate::bridge::{
    build_bridge_settlement_to_l3_hash, BridgeError, BridgeOrchestrator, BridgeProposal, BridgeResult,
};

// Story 7.10: Import L3→Settlement and custody release types
use crate::bridge::{
    build_bridge_l3_to_settlement_hash, build_release_to_vault_hash, BridgeL3ToSettlementProposal,
    BridgeL3ToSettlementResult, ReleaseToVaultProposal, ReleaseToVaultResult,
};

// Story 7.3: Import submit order types
use crate::bridge::{
    build_submit_order_hash, SubmitOrderProposal, SubmitOrderResult,
};

// Story 7.4: Import batch and fills types
use crate::bridge::{
    build_confirm_batch_hash, build_confirm_fills_hash, BatchProposal, BatchResult,
    FillsProposal, FillsResult,
};

// Story 7-14: Import rebalance consensus types
use crate::bridge::{
    build_rebalance_batch_hash, build_update_weights_hash,
    RebalanceBatchResult, UpdateWeightsResult,
    // Single-phase rebalance
    build_rebalance_hash, RebalanceResult,
    // setItpNav consensus (pre-rebalance NAV push)
    build_set_itp_nav_hash, SetItpNavResult,
    // NAV oracle (ITPNAVOracle on Arb — Phase 2B)
    build_nav_oracle_hash,
    // MirrorIssuerRegistry sync (Step 12)
    build_mirror_registry_sync_hash, build_mirror_registry_sync_calldata,
};

// Asset trades: Issuer-driven per-asset settlement
use crate::bridge::{AssetTrade, AssetTradesProposal, AssetTradesResult};
use crate::netting::{decompose_and_net_orders, ItpDecompState};

// Cross-chain sell flow
use crate::bridge::{
    build_sell_bridge_hash, build_complete_sell_order_consensus_hash,
    SellBridgeProposal, SellSubmitOrderResult, CompleteSellProposal, CompleteSellOrderResult,
    build_burn_sell_order_hash, BurnSellOrderProposal, BurnSellOrderResult,
};

// 8-step bridge: RecordCollateralMove + MintBridgedShares consensus
use crate::bridge::{
    build_record_collateral_move_hash, RecordCollateralMoveProposal, RecordCollateralMoveResult,
    build_mint_bridged_shares_hash, MintBridgedSharesProposal, MintBridgedSharesResult,
};

// completeBuyOrder BLS consensus
use crate::bridge::{
    build_complete_buy_order_hash, CompleteBuyOrderResult,
};

use crate::arbitration::ArbitrationMessageSender;
use crate::bootstrap::extract_issuer_id;
use crate::leader::LeaderElector;
use crate::p2p::peer_scoring::PeerScorer;
use crate::price::{PriceFetcher, ToleranceValidator};

use super::aggregator::{
    AggregationStatus, SignatureAggregator, DISAGREEMENT_PERCENT,
    MAX_PRICE_RETRIES, compute_threshold,
};
use super::equivocation::{content_hash, is_vote_or_sign, msg_variant_tag, EquivocationDetector};
use super::keys::KeyRegistry;
use super::messages::{ConsensusMessageHandler, MessageHandleResult};
use super::state::{ConsensusPhase, ConsensusState, ConsensusTimeouts, PriceVote};

/// Extract `cycle_number` from a consensus message.
/// Used as fallback when local state has no current round (e.g. during startup).
fn message_cycle_number(msg: &P2PMessage) -> Option<u64> {
    match msg {
        P2PMessage::CycleStart { cycle_number, .. }
        | P2PMessage::PriceProposal { cycle_number, .. }
        | P2PMessage::PriceVote { cycle_number, .. }
        | P2PMessage::BatchProposal { cycle_number, .. }
        | P2PMessage::BatchSign { cycle_number, .. }
        | P2PMessage::NavOracleProposal { cycle_number, .. }
        | P2PMessage::ConfirmBatchProposal { cycle_number, .. }
        | P2PMessage::ConfirmBatchSign { cycle_number, .. } => Some(*cycle_number),
        _ => None,
    }
}

/// Config update pushed by RegistrySyncHandler when the issuer set changes.
///
/// Contains all the information needed to reconfigure the consensus protocol
/// at the start of the next cycle: active count, BFT threshold, and the two
/// indices this node uses (dense index for leader election, on-chain ID for
/// signer bitmaps).
#[derive(Debug, Clone)]
pub struct ConfigUpdate {
    /// Number of currently active issuers
    pub active_count: u8,
    /// BFT signature threshold: compute_threshold(active_count)
    pub threshold: usize,
    /// Dense 0-based index among active issuers (for LeaderElector)
    pub node_index: u8,
    /// On-chain issuer ID from IssuerRegistry (for signer bitmaps)
    pub issuer_registry_index: u8,
}

/// Runtime-mutable subset of ConsensusConfig.
///
/// These fields can change when the issuer set changes (issuer join/leave).
/// Uses atomics for lock-free interior mutability since ConsensusProtocol methods
/// take `&self` (not `&mut self`).
pub struct RuntimeConfig {
    /// This node's dense index in the active issuer set (0-based, for leader election)
    pub node_index: std::sync::atomic::AtomicU8,
    /// Total number of active issuers
    pub num_issuers: std::sync::atomic::AtomicU8,
    /// On-chain IssuerRegistry index for signer bitmap
    pub issuer_registry_index: std::sync::atomic::AtomicU8,
    /// Signature threshold (BFT: floor(2n/3)+1)
    pub signature_threshold: std::sync::atomic::AtomicUsize,
}

impl RuntimeConfig {
    fn new(config: &ConsensusConfig) -> Self {
        use std::sync::atomic::{AtomicU8, AtomicUsize};
        Self {
            node_index: AtomicU8::new(config.node_index),
            num_issuers: AtomicU8::new(config.num_issuers),
            issuer_registry_index: AtomicU8::new(config.issuer_registry_index),
            signature_threshold: AtomicUsize::new(config.signature_threshold),
        }
    }

    /// Get the current issuer_registry_index (for signer bitmaps)
    #[inline]
    pub fn issuer_registry_index(&self) -> u8 {
        self.issuer_registry_index.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Get the current node_index (for leader election)
    #[inline]
    pub fn node_index(&self) -> u8 {
        self.node_index.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Get the current num_issuers
    #[inline]
    pub fn num_issuers(&self) -> u8 {
        self.num_issuers.load(std::sync::atomic::Ordering::Relaxed)
    }
}

impl std::fmt::Debug for RuntimeConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RuntimeConfig")
            .field("node_index", &self.node_index())
            .field("num_issuers", &self.num_issuers())
            .field("issuer_registry_index", &self.issuer_registry_index())
            .field("signature_threshold", &self.signature_threshold.load(std::sync::atomic::Ordering::Relaxed))
            .finish()
    }
}

/// Result of a consensus round
#[derive(Debug)]
pub enum ConsensusResult {
    /// Consensus completed successfully
    Success {
        /// The aggregated BLS signature
        aggregated_signature: BLSSignature,
        /// Number of signatures that were aggregated
        signer_count: usize,
        /// The cycle number
        cycle_number: u64,
    },
    /// Consensus failed
    Failed {
        /// Reason for failure
        reason: String,
        /// The cycle number
        cycle_number: u64,
    },
    /// Consensus timed out
    Timeout {
        /// Phase that timed out
        phase: ConsensusPhase,
        /// The cycle number
        cycle_number: u64,
    },
    /// Emergency pause triggered (3 price retries failed)
    EmergencyPause {
        /// The cycle number
        cycle_number: u64,
    },
    /// ITP creation completed successfully (Story 6.21)
    ItpCreated {
        /// Request nonce from BridgeProxy
        nonce: U256,
        /// Aggregated BLS signature
        aggregated_signature: BLSSignature,
        /// Number of signatures collected
        signer_count: usize,
    },
    /// Price consensus agreed — carries real BLS signature for oracle submission
    PriceAgreed {
        /// The aggregated BLS signature over the oracle message hash
        aggregated_signature: BLSSignature,
        /// Number of signers
        signer_count: usize,
        /// Bitmask of which issuers signed
        signers_bitmask: U256,
        /// Cycle number
        cycle_number: u64,
    },
}

/// Configuration for ConsensusProtocol
#[derive(Debug, Clone)]
pub struct ConsensusConfig {
    /// This node's peer ID
    pub peer_id: PeerId,
    /// Total number of issuers
    pub num_issuers: u8,
    /// This node's index in the issuer set (0-indexed, for leader election)
    pub node_index: u8,
    /// On-chain IssuerRegistry index for signer bitmap (may differ from node_index)
    pub issuer_registry_index: u8,
    /// Timeout configuration
    pub timeouts: ConsensusTimeouts,
    /// Signature threshold (BFT: floor(2n/3)+1)
    pub signature_threshold: usize,
}

impl ConsensusConfig {
    /// Create a new consensus config with BFT threshold derived from num_issuers
    pub fn new(peer_id: PeerId, num_issuers: u8, node_index: u8) -> Self {
        Self {
            peer_id,
            num_issuers,
            node_index,
            issuer_registry_index: node_index, // Default: same as node_index
            timeouts: ConsensusTimeouts::default(),
            signature_threshold: compute_threshold(num_issuers as usize),
        }
    }

    /// Set the on-chain issuer registry index (for signer bitmap)
    pub fn with_issuer_registry_index(mut self, index: u8) -> Self {
        self.issuer_registry_index = index;
        self
    }

    /// Set custom timeouts
    pub fn with_timeouts(mut self, timeouts: ConsensusTimeouts) -> Self {
        self.timeouts = timeouts;
        self
    }

    /// Set custom signature threshold
    pub fn with_signature_threshold(mut self, threshold: usize) -> Self {
        self.signature_threshold = threshold;
        self
    }
}

/// ConsensusProtocol coordinates consensus rounds between issuers
pub struct ConsensusProtocol<P, C, K, F>
where
    P: P2PTransport,
    C: ChainWriter,
    K: KeyRegistry,
    F: PriceFetcher,
{
    /// BLS signer
    bls_signer: Bn254BLSSigner,
    /// BLS keypair for this node
    bls_keypair: BLSKeyPair,
    /// P2P transport
    p2p: Arc<P>,
    /// Chain writer for on-chain submission
    chain_writer: Arc<C>,
    /// Key registry for looking up peer public keys
    key_registry: Arc<K>,
    /// Price fetcher for getting local prices
    price_fetcher: Arc<F>,
    /// Leader elector
    leader_elector: RwLock<LeaderElector>,
    /// Consensus state
    state: RwLock<ConsensusState>,
    /// Message handler
    message_handler: RwLock<ConsensusMessageHandler>,
    /// Signature aggregator
    aggregator: RwLock<SignatureAggregator>,
    /// Dedicated state for price-only consensus — prevents corruption when bridge tasks run concurrently
    price_state: RwLock<ConsensusState>,
    /// Dedicated aggregator for price-only consensus
    price_aggregator: RwLock<SignatureAggregator>,
    /// Price tolerance validator
    price_validator: ToleranceValidator,
    /// Configuration (immutable initial values — for fields that change at runtime, see `runtime_config`)
    config: ConsensusConfig,
    /// Runtime-mutable config subset (node_index, num_issuers, issuer_registry_index, threshold).
    /// Updated by `apply_pending_config_update` when the issuer set changes.
    /// Uses atomics for lock-free interior mutability.
    runtime_config: RuntimeConfig,
    /// Optional fill verifier for on-chain verification (FR13)
    fill_verifier: Option<Arc<BitgetVaultReader>>,
    /// Optional ITP creation config for handling cross-chain ITP creation (Story 6.24)
    itp_creation_config: RwLock<Option<ItpCreationConfig>>,
    /// Optional BridgeOrchestrator reference for cross-chain bridge consensus (Story 7.9)
    bridge_orchestrator: RwLock<Option<Arc<RwLock<BridgeOrchestrator>>>>,
    /// Shared cell for pending consensus config updates (registry auto-update)
    /// Written by RegistrySyncHandler, read at cycle start.
    pending_config_update: Arc<RwLock<Option<ConfigUpdate>>>,
    /// Optional sender for forwarding arbitration P2P messages to the ArbitrationSubsystem
    arbitration_tx: RwLock<Option<ArbitrationMessageSender>>,
    /// Ordered list of PeerIds for index->PeerId mapping (sorted by on-chain issuer ID).
    /// Populated at startup from the key registry and updated when the issuer set changes.
    peer_registry: Arc<RwLock<Vec<PeerId>>>,
    /// Optional peer scorer for recording peer reputation events (e.g. non-leader proposals).
    peer_scorer: Option<Arc<PeerScorer>>,
    /// Equivocation detector: tracks (peer, cycle, phase) -> content_hash to
    /// detect peers that send conflicting votes/signatures in the same round.
    equivocation_detector: EquivocationDetector,
    /// Optional Write-Ahead Log for crash recovery
    wal: Option<std::sync::Mutex<crate::p2p::wal::ConsensusWAL>>,
    /// When true, suppress P2P broadcasts (during WAL replay)
    replay_mode: std::sync::atomic::AtomicBool,
    /// Cache of last successfully fetched prices (asset → (price, timestamp_secs))
    last_prices: RwLock<std::collections::HashMap<Address, (U256, u64)>>,
    /// Ordered list of known asset addresses — used by followers to convert
    /// leader's (asset_index, price) tuples back to real addresses for independent
    /// price verification. Index `i` maps to `known_assets[i]`.
    known_assets: RwLock<Vec<Address>>,
}

/// Macro for the common bridge-orchestrator signature collection polling loop.
///
/// All bridge-orchestrator-based `collect_*_signatures` functions share this
/// exact pattern: poll check_threshold -> timeout check -> sleep 10ms -> repeat.
/// Only the method names and key expressions differ.
///
/// Both `check` and `count` expressions receive the orchestrator read-guard as
/// `$orch` and must include their own `.await` (and any `.unwrap_or(0)` etc.).
macro_rules! collect_sigs_loop {
    ($self:ident, $timeout_ms:expr, |$orch:ident| {
        check: $check_expr:expr,
        count: $count_expr:expr $(,)?
    }) => {{
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis($timeout_ms);
        loop {
            let bridge_orch_guard = $self.bridge_orchestrator.read().await;
            if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                let $orch = bridge_orch.read().await;
                if let Some(result) = $check_expr {
                    return Ok(result);
                }
                if tokio::time::Instant::now() >= deadline {
                    let received = $count_expr;
                    return Err(ConsensusError::SigningTimeout { received, timeout_ms: $timeout_ms }.into());
                }
            } else if tokio::time::Instant::now() >= deadline {
                return Err(ConsensusError::SigningTimeout { received: 0, timeout_ms: $timeout_ms }.into());
            }
            drop(bridge_orch_guard);
            sleep(std::time::Duration::from_millis(2)).await;
        }
    }};
}

impl<P, C, K, F> ConsensusProtocol<P, C, K, F>
where
    P: P2PTransport + 'static,
    C: ChainWriter + 'static,
    K: KeyRegistry + 'static,
    F: PriceFetcher + 'static,
{
    /// Create a new ConsensusProtocol
    pub fn new(
        bls_keypair: BLSKeyPair,
        p2p: Arc<P>,
        chain_writer: Arc<C>,
        key_registry: Arc<K>,
        price_fetcher: Arc<F>,
        config: ConsensusConfig,
    ) -> Self {
        let leader_elector = LeaderElector::new(config.node_index, config.num_issuers);
        let state = ConsensusState::with_timeouts(config.timeouts.clone());
        let aggregator = SignatureAggregator::with_threshold(config.signature_threshold);
        let runtime_config = RuntimeConfig::new(&config);

        // Build ordered peer registry from key registry (sorted by on-chain issuer ID)
        let mut peers = key_registry.registered_peers();
        peers.sort_by_key(|p| extract_issuer_id(p));

        Self {
            bls_signer: Bn254BLSSigner::new(),
            bls_keypair,
            p2p,
            chain_writer,
            key_registry,
            price_fetcher,
            leader_elector: RwLock::new(leader_elector),
            state: RwLock::new(state),
            message_handler: RwLock::new(ConsensusMessageHandler::new()),
            aggregator: RwLock::new(aggregator),
            price_state: RwLock::new(ConsensusState::new()),
            price_aggregator: RwLock::new(SignatureAggregator::with_threshold(config.signature_threshold)),
            price_validator: ToleranceValidator::new(),
            config,
            runtime_config,
            fill_verifier: None,
            itp_creation_config: RwLock::new(None),
            bridge_orchestrator: RwLock::new(None),
            pending_config_update: Arc::new(RwLock::new(None)),
            arbitration_tx: RwLock::new(None),
            peer_registry: Arc::new(RwLock::new(peers)),
            peer_scorer: None,
            equivocation_detector: EquivocationDetector::new(),
            wal: None,
            replay_mode: std::sync::atomic::AtomicBool::new(false),
            last_prices: RwLock::new(std::collections::HashMap::new()),
            known_assets: RwLock::new(Vec::new()),
        }
    }

    /// Set the ordered list of known asset addresses for follower price validation.
    /// Must match the same order the leader uses when building (index, price) tuples.
    pub async fn set_known_assets(&self, assets: Vec<Address>) {
        *self.known_assets.write().await = assets;
    }

    /// Get a handle to the pending config update cell for RegistrySyncHandler
    ///
    /// The handler writes a `ConfigUpdate` when the issuer set changes.
    /// The consensus loop reads it at cycle start and applies updates.
    pub fn pending_config_handle(&self) -> Arc<RwLock<Option<ConfigUpdate>>> {
        self.pending_config_update.clone()
    }

    /// Get the L3 registry nonce for BLS reference_nonce in L3 calldata
    pub fn registry_nonce(&self) -> u64 {
        self.key_registry.registry_nonce()
    }

    /// Update the L3 registry nonce
    pub fn set_registry_nonce(&self, nonce: u64) {
        self.key_registry.set_registry_nonce(nonce);
    }

    /// Get the Settlement mirror registry nonce for BLS reference_nonce in Settlement calldata
    pub fn settlement_registry_nonce(&self) -> u64 {
        self.key_registry.settlement_registry_nonce()
    }

    /// Update the Settlement mirror registry nonce
    pub fn set_settlement_registry_nonce(&self, nonce: u64) {
        self.key_registry.set_settlement_registry_nonce(nonce);
    }

    /// Get the configured number of issuers
    pub fn num_issuers(&self) -> u8 {
        self.runtime_config.num_issuers()
    }

    /// Check if this node is the leader for a given cycle (for mirror sync leader election)
    pub async fn is_leader_for_cycle(&self, cycle: u64) -> bool {
        self.leader_elector.write().await.is_leader_for_cycle(cycle)
    }

    /// Apply any pending config update at cycle start
    ///
    /// Updates leader elector (using dense node_index), signature aggregator
    /// (using BFT threshold), and runtime config (node_index, num_issuers,
    /// issuer_registry_index) if RegistrySyncHandler has written a new config.
    pub async fn apply_pending_config_update(&self) {
        let update = {
            let mut guard = self.pending_config_update.write().await;
            guard.take()
        };
        if let Some(cfg) = update {
            info!(
                active_count = cfg.active_count,
                threshold = cfg.threshold,
                node_index = cfg.node_index,
                issuer_registry_index = cfg.issuer_registry_index,
                "Applying consensus config update from registry sync"
            );
            // Update leader elector with dense node index
            *self.leader_elector.write().await =
                LeaderElector::new(cfg.node_index, cfg.active_count);
            // Update BFT signature threshold (both shared and price-dedicated aggregators)
            self.aggregator
                .write()
                .await
                .set_threshold(cfg.threshold);
            self.price_aggregator
                .write()
                .await
                .set_threshold(cfg.threshold);
            // Update runtime config (node_index, num_issuers, issuer_registry_index)
            use std::sync::atomic::Ordering::Relaxed;
            self.runtime_config.node_index.store(cfg.node_index, Relaxed);
            self.runtime_config.num_issuers.store(cfg.active_count, Relaxed);
            self.runtime_config.issuer_registry_index.store(cfg.issuer_registry_index, Relaxed);
            self.runtime_config.signature_threshold.store(cfg.threshold, Relaxed);

            // Refresh peer registry to match updated issuer set
            self.refresh_peer_registry().await;
        }
    }

    /// Set BridgeOrchestrator for handling cross-chain bridge consensus (Story 7.9)
    ///
    /// When set, the protocol can handle BridgeSettlementToL3Proposal messages from the leader
    /// and respond with signed BridgeSettlementToL3Sign messages.
    pub async fn set_bridge_orchestrator(&self, orchestrator: Arc<RwLock<BridgeOrchestrator>>) {
        let mut bridge_orch = self.bridge_orchestrator.write().await;
        *bridge_orch = Some(orchestrator);
    }

    /// Set ITP creation config for handling cross-chain ITP creation proposals (Story 6.24)
    ///
    /// When set, the protocol can handle ItpCreationProposal messages from the leader
    /// and respond with signed ItpCreationSign messages.
    pub async fn set_itp_creation_config(&self, config: ItpCreationConfig) {
        let mut itp_config = self.itp_creation_config.write().await;
        *itp_config = Some(config);
    }

    /// Set the arbitration message sender for forwarding P2P messages to the ArbitrationSubsystem.
    ///
    /// When set, `ForwardToArbitration` messages are sent to the arbitration subsystem
    /// instead of being logged and dropped.
    pub async fn set_arbitration_sender(&self, tx: ArbitrationMessageSender) {
        let mut arb_tx = self.arbitration_tx.write().await;
        *arb_tx = Some(tx);
    }

    /// Set a fill verifier for on-chain fill verification (FR13)
    ///
    /// When set, the protocol will verify fills against MockBitgetVault.getFill()
    /// before signing batch proposals.
    pub fn with_fill_verifier(mut self, verifier: Arc<BitgetVaultReader>) -> Self {
        self.fill_verifier = Some(verifier);
        self
    }

    /// Set the peer scorer for recording peer reputation events.
    ///
    /// When set, non-leader proposals will trigger `record_invalid_message`
    /// on the scorer, feeding into the peer scoring / auto-ban pipeline.
    pub fn with_peer_scorer(mut self, scorer: Arc<PeerScorer>) -> Self {
        self.peer_scorer = Some(scorer);
        self
    }

    /// Set the Write-Ahead Log for crash recovery.
    ///
    /// When set, all incoming consensus messages are persisted to the WAL
    /// before being processed, enabling replay after a crash.
    pub fn with_wal(mut self, wal: crate::p2p::wal::ConsensusWAL) -> Self {
        self.wal = Some(std::sync::Mutex::new(wal));
        self
    }

    /// Enable or disable replay mode.
    ///
    /// When replay mode is active, WAL appends are suppressed to avoid
    /// re-logging messages that are already persisted.
    pub fn set_replay_mode(&self, enabled: bool) {
        self.replay_mode.store(enabled, std::sync::atomic::Ordering::SeqCst);
    }

    /// Check if the protocol is currently in replay mode.
    pub fn is_replay_mode(&self) -> bool {
        self.replay_mode.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Refresh the peer_registry from the key registry.
    ///
    /// Called when the issuer set changes (e.g. after a config update)
    /// to keep the ordered PeerId list in sync.
    pub async fn refresh_peer_registry(&self) {
        let mut peers = self.key_registry.registered_peers();
        peers.sort_by_key(|p| extract_issuer_id(p));
        let mut registry = self.peer_registry.write().await;
        *registry = peers;
    }

    /// Get this node's peer ID
    pub fn peer_id(&self) -> PeerId {
        self.config.peer_id
    }

    /// Check if a PeerId is the zeroed sentinel (all bytes zero).
    ///
    /// Zeroed PeerIds are used before re-keying completes; skip leader
    /// verification for these since they can't be mapped to a dense index.
    fn is_zeroed_peer_id(peer: &PeerId) -> bool {
        peer.iter().all(|&b| b == 0)
    }

    /// Check if a PeerId is a temporary/placeholder ID.
    ///
    /// Temp PeerIds (first byte 0xFE or 0xFF) are used during bootstrap
    /// before re-keying assigns a real identity. Skip leader verification
    /// for these as well.
    fn is_temp_peer_id(peer: &PeerId) -> bool {
        peer[0] == 0xFE || peer[0] == 0xFF
    }

    /// Compute the dense index (0-based position among active issuers) for a given PeerId.
    ///
    /// Uses the key registry to get all registered peers, sorts them by on-chain issuer ID,
    /// and returns the position of the sender in that sorted list.
    /// Returns `None` if the peer is not in the registry.
    fn get_dense_index(&self, peer_id: &PeerId) -> Option<u8> {
        let mut peers = self.key_registry.registered_peers();
        // Sort by on-chain issuer ID to get deterministic dense ordering
        peers.sort_by_key(|p| extract_issuer_id(p));
        peers.iter().position(|p| p == peer_id).map(|i| i as u8)
    }

    /// Verify that the sender is the expected leader for this cycle.
    ///
    /// During config propagation (~5s window), accept proposals from
    /// the leader under current OR +-1 num_issuers count to tolerate
    /// nodes that haven't yet seen the latest registry update.
    ///
    /// Zeroed and temp PeerIds are always accepted (they'll be re-verified
    /// after re-keying assigns a real identity).
    ///
    /// When a non-leader proposal is detected and a `peer_scorer` is available,
    /// records an `invalid_message` event against the offending peer.
    fn is_valid_leader(&self, sender_id: &PeerId, cycle: u64) -> bool {
        // Skip verification for zeroed or temp PeerIds — they can't be
        // mapped to a dense index and will be re-verified after re-keying.
        if Self::is_zeroed_peer_id(sender_id) || Self::is_temp_peer_id(sender_id) {
            return true;
        }

        let current_count = self.runtime_config.num_issuers() as u64;
        if current_count == 0 {
            return true; // Safety: can't verify without count
        }

        let sender_index = match self.get_dense_index(sender_id) {
            Some(idx) => idx as u64,
            None => {
                warn!(
                    code = "CONSENSUS-020",
                    ?sender_id,
                    "Leader check: sender not in key registry"
                );
                // Record invalid message for unregistered peer attempting proposals
                if let Some(ref scorer) = self.peer_scorer {
                    scorer.record_invalid_message(sender_id);
                }
                return false;
            }
        };

        // Accept if leader under current config
        if sender_index == cycle % current_count {
            return true;
        }

        // Also accept under previous config (-1 issuer) for propagation tolerance
        if current_count > 1 {
            let prev_count = current_count - 1;
            if sender_index == cycle % prev_count {
                return true;
            }
        }

        // Also accept under next config (+1 issuer) for propagation tolerance
        let next_count = current_count + 1;
        if sender_index == cycle % next_count {
            return true;
        }

        // Not the leader under any acceptable config — record violation
        if let Some(ref scorer) = self.peer_scorer {
            warn!(
                code = "CONSENSUS-020",
                ?sender_id,
                cycle,
                sender_index,
                current_count,
                "Non-leader proposal detected, penalizing peer"
            );
            scorer.record_invalid_message(sender_id);
        }

        false
    }

    /// Run a consensus cycle
    ///
    /// # Arguments
    /// * `cycle_number` - The current cycle number
    /// * `prices` - Price proposals (asset_index, price)
    /// * `order_ids` - Order IDs to include in batch
    /// * `fills` - Fill information for the orders
    /// * `last_signature` - BLS signature from previous cycle (for leader election)
    /// Price-only consensus cycle. Updates on-chain prices without batching orders.
    /// Order batching is handled independently by L3-native and cross-chain tasks.
    pub async fn run_price_cycle(
        &self,
        cycle_number: u64,
        prices: Vec<(u32, U256)>,
        nav_price: Option<U256>,           // Morpho-scaled NAV (None if no oracle configured)
        timestamp: u64,
        oracle_address: Option<Address>,
        itp_address: Option<Address>,
        chain_id: Option<u64>,
    ) -> ConsensusResult {
        // Apply any pending config update from RegistrySyncHandler
        self.apply_pending_config_update().await;

        info!(cycle_number, "Starting price consensus cycle");

        // Initialize price-dedicated round state (NOT shared state)
        {
            let mut state = self.price_state.write().await;
            state.start_round(cycle_number);
            self.price_aggregator.write().await.reset();
        }

        // GC equivocation detector: remove entries older than current_cycle - 2
        self.equivocation_detector.gc(cycle_number);

        // GC WAL: retain only current cycle entries
        if let Some(ref wal) = self.wal {
            if let Ok(mut wal) = wal.lock() {
                if let Err(e) = wal.gc(cycle_number) {
                    tracing::warn!(code = "INFRA-022", error = %e, "WAL GC failed");
                }
            }
        }

        // Replay any messages that arrived early (buffered as "future" in previous cycles).
        // Also clear stale messages to prevent unbounded buffer growth.
        {
            let buffered = {
                let mut handler = self.message_handler.write().await;
                handler.clear_stale_messages(cycle_number);
                handler.get_buffered_for_cycle(cycle_number)
            };
            if !buffered.is_empty() {
                info!(cycle_number, count = buffered.len(), "Replaying buffered messages");
                for (from, msg) in buffered {
                    if let Err(e) = self.handle_message(from, msg).await {
                        debug!(cycle_number, error = %e, "Error replaying buffered message");
                    }
                }
            }
        }

        // Determine if we're the leader using deterministic cycle-based rotation.
        let am_leader = self.leader_elector.write().await.is_leader_for_cycle(cycle_number);

        if am_leader {
            info!(cycle_number, "This node is the leader (price-only)");
            // Price consensus only — no batch
            match self.leader_price_consensus(cycle_number, prices).await {
                Ok(()) => {
                    // Mark round complete (skip batch phases)
                    {
                        let mut state = self.price_state.write().await;
                        if let Some(round) = state.current_round_mut() {
                            round.set_phase(ConsensusPhase::Complete);
                        }
                    }

                    // Oracle signing: if oracle params are provided, run a second
                    // mini-round to collect BLS signatures on the oracle hash
                    if let (Some(nav), Some(oracle_addr), Some(itp_addr), Some(cid)) =
                        (nav_price, oracle_address, itp_address, chain_id)
                    {
                        match self.run_nav_oracle_signing(
                            cycle_number, nav, timestamp, oracle_addr, itp_addr, cid,
                        ).await {
                            Ok((agg_sig, count, bitmask)) => {
                                return ConsensusResult::PriceAgreed {
                                    aggregated_signature: agg_sig,
                                    signer_count: count,
                                    signers_bitmask: bitmask,
                                    cycle_number,
                                };
                            }
                            Err(e) => {
                                warn!(cycle_number, error = %e, "Oracle signing failed, returning PriceAgreed without oracle sig");
                            }
                        }
                    }

                    ConsensusResult::PriceAgreed {
                        aggregated_signature: BLSSignature(vec![0; 64]),
                        signer_count: 0,
                        signers_bitmask: U256::zero(),
                        cycle_number,
                    }
                }
                Err(e) => {
                    // Price-only: disagreement just means skip this cycle, try next.
                    // No emergency pause — prices will converge.
                    ConsensusResult::Failed {
                        reason: e.to_string(),
                        cycle_number,
                    }
                }
            }
        } else {
            debug!(cycle_number, "This node is a follower (price-only)");
            self.run_follower_protocol_price_only(cycle_number).await
        }
    }

    /// Leader: run oracle signing mini-round after price consensus succeeds.
    /// Computes oracle hash, signs it, initializes signature collection,
    /// broadcasts NavOracleProposal, and waits for threshold.
    async fn run_nav_oracle_signing(
        &self,
        cycle_number: u64,
        nav_price: U256,
        timestamp: u64,
        oracle_address: Address,
        itp_address: Address,
        chain_id: u64,
    ) -> Result<(BLSSignature, usize, U256), Error> {
        // 1. Compute oracle hash
        let oracle_hash = build_nav_oracle_hash(
            chain_id, oracle_address, itp_address, nav_price, timestamp, cycle_number,
        );
        let hash_bytes: [u8; 32] = oracle_hash.into();

        // 2. Sign with own BLS key
        let leader_sig = self.bls_signer.sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| Error::BlsVerification(format!("Failed to sign oracle hash: {}", e)))?;

        // Self-verify to detect keypair/pubkey mismatch early
        if let Some(self_pubkey) = self.key_registry.get_public_key(&self.config.peer_id) {
            match self.bls_signer.verify_message_hash(&self_pubkey, &hash_bytes, &leader_sig) {
                Ok(true) => debug!(?itp_address, "NavOracle self-verification passed"),
                Ok(false) => {
                    warn!(?itp_address, "NavOracle self-verification FAILED — keypair/pubkey mismatch!");
                }
                Err(e) => warn!(?itp_address, error = %e, "NavOracle self-verification error"),
            }
        }

        // 3. Initialize BridgeOrchestrator signature collection
        let itp_key = H256::from(itp_address);
        {
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                let orch = bridge_orch.read().await;
                orch.start_nav_oracle_signature_collection(itp_key, leader_sig.clone()).await;
            } else {
                return Err(Error::BlsVerification("BridgeOrchestrator not configured for oracle signing".to_string()));
            }
        }

        // 4. Broadcast NavOracleProposal to all peers
        let ref_nonce = self.key_registry.registry_nonce();
        let proposal = P2PMessage::NavOracleProposal {
            leader_id: self.config.peer_id,
            itp_address,
            oracle_address,
            nav_price,
            timestamp,
            cycle_number,
            chain_id,
            reference_nonce: ref_nonce as u64,
            leader_signature: leader_sig,
        };
        self.p2p.broadcast(proposal).await?;

        // 5. Wait for signature threshold (use bridge config sign_timeout_ms, fallback 500ms)
        let timeout_ms = {
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            bridge_orch_guard.as_ref().map(|b| {
                // Can't await inside map, use try_read
                b.try_read().map(|o| o.config().sign_timeout_ms).unwrap_or(500)
            }).unwrap_or(500)
        };
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
        loop {
            {
                let bridge_orch_guard = self.bridge_orchestrator.read().await;
                if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                    let orch = bridge_orch.read().await;
                    if let Some(result) = orch.check_nav_oracle_threshold(itp_key).await {
                        info!(
                            ?itp_address,
                            signature_count = result.signature_count,
                            "NavOracle signature threshold reached"
                        );
                        return Ok((
                            result.aggregated_signature,
                            result.signature_count,
                            result.signer_bitmap,
                        ));
                    }
                }
            }

            if tokio::time::Instant::now() >= deadline {
                warn!(cycle_number, ?itp_address, timeout_ms, "NavOracle signature collection timed out");
                return Err(Error::BlsVerification("NavOracle signature collection timed out".to_string()));
            }

            sleep(std::time::Duration::from_millis(2)).await;
        }
    }

    /// Full consensus cycle with price + batch. Used by L3-native order processing.
    pub async fn run_cycle(
        &self,
        cycle_number: u64,
        prices: Vec<(u32, U256)>,
        order_ids: Vec<u64>,
        fills: Vec<Fill>,
        last_signature: &BLSSignature,
    ) -> ConsensusResult {
        // Apply any pending config update from RegistrySyncHandler
        self.apply_pending_config_update().await;

        info!(cycle_number, "Starting consensus cycle");

        // Initialize round state
        {
            let mut state = self.state.write().await;
            state.start_round(cycle_number);
            self.aggregator.write().await.reset();
        }

        // GC equivocation detector: remove entries older than current_cycle - 2
        self.equivocation_detector.gc(cycle_number);

        // GC WAL: retain only current cycle entries
        if let Some(ref wal) = self.wal {
            if let Ok(mut wal) = wal.lock() {
                if let Err(e) = wal.gc(cycle_number) {
                    tracing::warn!(code = "INFRA-022", error = %e, "WAL GC failed");
                }
            }
        }

        // Replay any messages that arrived early (buffered as "future" in previous cycles).
        // Also clear stale messages to prevent unbounded buffer growth.
        {
            let buffered = {
                let mut handler = self.message_handler.write().await;
                handler.clear_stale_messages(cycle_number);
                handler.get_buffered_for_cycle(cycle_number)
            };
            if !buffered.is_empty() {
                info!(cycle_number, count = buffered.len(), "Replaying buffered messages");
                for (from, msg) in buffered {
                    if let Err(e) = self.handle_message(from, msg).await {
                        debug!(cycle_number, error = %e, "Error replaying buffered message");
                    }
                }
            }
        }

        // Determine if we're the leader using deterministic cycle-based rotation.
        // This ensures all nodes agree on the leader without needing to propagate
        // aggregated BLS signatures from leader to followers.
        let am_leader = self.leader_elector.write().await.is_leader_for_cycle(cycle_number);

        if am_leader {
            info!(cycle_number, "This node is the leader");
            self.run_leader_protocol(cycle_number, prices, order_ids, fills)
                .await
        } else {
            debug!(cycle_number, "This node is a follower");
            self.run_follower_protocol(cycle_number).await
        }
    }

    /// Run the leader protocol
    ///
    /// Price consensus is eliminated from the regular cycle — all issuers compute
    /// the same NAV from on-chain inventory + shared price feed, so they always agree.
    /// Price updates are handled by standalone `run_price_cycle` when there are no orders.
    async fn run_leader_protocol(
        &self,
        cycle_number: u64,
        _prices: Vec<(u32, U256)>,
        order_ids: Vec<u64>,
        fills: Vec<Fill>,
    ) -> ConsensusResult {
        // Batch consensus only — price round eliminated (all issuers compute same NAV)
        match self
            .leader_batch_consensus(cycle_number, order_ids, fills)
            .await
        {
            Ok(result) => result,
            Err(e) => ConsensusResult::Failed {
                reason: e.to_string(),
                cycle_number,
            },
        }
    }

    /// Leader: Propose prices and collect votes
    async fn leader_price_consensus(
        &self,
        cycle_number: u64,
        prices: Vec<(u32, U256)>,
    ) -> Result<(), Error> {
        let ref_nonce = self.key_registry.registry_nonce();
        let mut retry_count = 0u8;

        loop {
            // Advance to PriceProposal phase (use price_state, not shared state)
            {
                let mut state = self.price_state.write().await;
                if let Some(round) = state.current_round_mut() {
                    round.set_phase(ConsensusPhase::PriceProposal);
                }
            }

            // Sign the price proposal
            let proposal_bytes = self.encode_price_proposal(cycle_number, &prices);
            let signature = self
                .bls_signer
                .sign_with_keypair(&self.bls_keypair, &proposal_bytes)?;

            // Broadcast PRICE_PROPOSAL
            let message = P2PMessage::PriceProposal {
                cycle_number,
                prices: prices.clone(),
                proposer_signature: BLSSignature(signature.0.clone()),
                reference_nonce: ref_nonce,
            };

            debug!(cycle_number, "Broadcasting PRICE_PROPOSAL");
            self.p2p.broadcast(message).await?;
            info!(cycle_number, "PriceProposal broadcast sent");

            // Advance to PriceVoting phase (use price_state, not shared state)
            {
                let mut state = self.price_state.write().await;
                state.advance();
            }

            // Collect votes with timeout
            let vote_timeout = self.config.timeouts.price_vote_timeout;
            let vote_result = self.collect_price_votes(cycle_number, vote_timeout).await;

            match vote_result {
                Ok(disagreement_percent) => {
                    if disagreement_percent >= DISAGREEMENT_PERCENT {
                        retry_count += 1;
                        warn!(
                            code = "E008",
                            cycle_number,
                            retry_count,
                            disagreement_percent,
                            "Price disagreement >= 20%, retrying"
                        );

                        if retry_count >= MAX_PRICE_RETRIES {
                            error!(
                                code = "E008",
                                cycle_number,
                                "Max price retries exceeded, triggering emergency pause"
                            );
                            return Err(Error::P2PBroadcast(
                                "emergency pause triggered: max price retries exceeded".to_string(),
                            ));
                        }

                        // Reset for retry (use price_state, not shared state)
                        {
                            let mut state = self.price_state.write().await;
                            if let Some(round) = state.current_round_mut() {
                                round.reset_for_retry();
                            }
                        }

                        continue;
                    }

                    info!(
                        cycle_number,
                        disagreement_percent, "Price consensus achieved"
                    );
                    return Ok(());
                }
                Err(e) => {
                    return Err(e);
                }
            }
        }
    }

    /// Collect price votes from followers
    async fn collect_price_votes(
        &self,
        cycle_number: u64,
        vote_timeout: std::time::Duration,
    ) -> Result<u8, Error> {
        let expected_voters = (self.runtime_config.num_issuers() - 1) as usize;
        info!(
            cycle_number,
            vote_timeout_ms = vote_timeout.as_millis() as u64,
            expected_voters,
            "Leader collecting price votes"
        );
        let deadline = tokio::time::Instant::now() + vote_timeout;

        loop {
            if tokio::time::Instant::now() >= deadline {
                // Timeout - calculate with votes we have
                let state = self.price_state.read().await;
                if let Some(round) = state.current_round() {
                    let votes = round.price_votes.len();
                    info!(cycle_number, votes, expected_voters, "Vote collection timed out");
                    return Ok(round.disagreement_percent());
                }
                return Ok(0);
            }

            // Small sleep to avoid busy loop
            sleep(self.config.timeouts.polling_interval).await;

            // Check current vote counts (read from price_state, matching vote storage)
            let state = self.price_state.read().await;
            if let Some(round) = state.current_round() {
                // If we have enough votes, we can evaluate early
                let total_votes = round.price_votes.len();

                if total_votes >= expected_voters {
                    info!(cycle_number, total_votes, expected_voters, "All votes collected");
                    return Ok(round.disagreement_percent());
                }
            }
        }
    }

    /// Leader: Propose batch and collect signatures
    async fn leader_batch_consensus(
        &self,
        cycle_number: u64,
        order_ids: Vec<u64>,
        fills: Vec<Fill>,
    ) -> Result<ConsensusResult, Error> {
        let ref_nonce = self.key_registry.registry_nonce();

        // Advance to BatchProposal phase
        {
            let mut state = self.state.write().await;
            if let Some(round) = state.current_round_mut() {
                round.set_phase(ConsensusPhase::BatchProposal);
            }
        }

        // Compute on-chain-compatible hash for BLS signing
        // Must match Solidity: keccak256(abi.encode(block.chainid, address(this), cycleNumber, orderIds))
        let (l3_chain_id, index_address) = {
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
                Error::BlsVerification("BridgeOrchestrator not configured for batch hash".to_string())
            })?;
            let orch = bridge_orch.read().await;
            let config = orch.config();
            (config.l3_chain_id, config.index_address)
        };
        let order_ids_u256: Vec<U256> = order_ids.iter().map(|&id| U256::from(id)).collect();
        let on_chain_hash = build_confirm_batch_hash(l3_chain_id, index_address, cycle_number, &order_ids_u256);
        let hash_bytes: [u8; 32] = on_chain_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)?;

        // Add our own signature to aggregator
        {
            let mut aggregator = self.aggregator.write().await;
            aggregator.add_signature(self.config.peer_id, self.runtime_config.issuer_registry_index(), signature.clone())?;
        }

        // Broadcast BATCH_PROPOSAL
        let message = P2PMessage::BatchProposal {
            cycle_number,
            order_ids: order_ids.clone(),
            fills: fills.clone(),
            proposer_signature: BLSSignature(signature.0.clone()),
            reference_nonce: ref_nonce,
        };

        debug!(cycle_number, "Broadcasting BATCH_PROPOSAL");
        self.p2p.broadcast(message).await?;

        // Advance to BatchSigning phase
        {
            let mut state = self.state.write().await;
            state.advance();
        }

        // Collect signatures with timeout
        let sign_timeout = self.config.timeouts.batch_sign_timeout;
        match self.collect_batch_signatures(cycle_number, sign_timeout).await {
            Ok(status) => match status {
                AggregationStatus::ThresholdReached {
                    aggregated_signature,
                    signer_count,
                    signers_bitmask,
                } => {
                    info!(
                        cycle_number,
                        signer_count, "Batch consensus achieved, submitting on-chain"
                    );

                    // Skip on-chain submission for empty batches to avoid burning cycle numbers
                    // (E019_CycleAlreadyProcessed would block bridge pipeline from using this cycle)
                    if order_ids.is_empty() {
                        info!(cycle_number, "Empty batch, skipping on-chain submission");
                    } else {
                        // Submit to chain
                        let tx_hash = self
                            .chain_writer
                            .submit_batch(cycle_number, order_ids, aggregated_signature.0.clone(), ref_nonce, signers_bitmask)
                            .await?;

                        info!(cycle_number, ?tx_hash, "Batch submitted on-chain");
                    }

                    // Advance to Complete
                    {
                        let mut state = self.state.write().await;
                        state.advance();
                    }

                    Ok(ConsensusResult::Success {
                        aggregated_signature,
                        signer_count,
                        cycle_number,
                    })
                }
                AggregationStatus::Collecting { count, required } => {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        count, required, "Batch signature timeout, not enough signatures"
                    );
                    Ok(ConsensusResult::Timeout {
                        phase: ConsensusPhase::BatchSigning,
                        cycle_number,
                    })
                }
                AggregationStatus::AlreadySubmitted => {
                    // This shouldn't happen in normal flow
                    Ok(ConsensusResult::Failed {
                        reason: "Batch already submitted".to_string(),
                        cycle_number,
                    })
                }
            },
            Err(e) => Ok(ConsensusResult::Failed {
                reason: e.to_string(),
                cycle_number,
            }),
        }
    }

    /// Collect batch signatures from followers
    async fn collect_batch_signatures(
        &self,
        cycle_number: u64,
        sign_timeout: std::time::Duration,
    ) -> Result<AggregationStatus, Error> {
        let deadline = tokio::time::Instant::now() + sign_timeout;

        loop {
            if tokio::time::Instant::now() >= deadline {
                // Timeout - return current status
                let aggregator = self.aggregator.read().await;
                return Ok(AggregationStatus::Collecting {
                    count: aggregator.collected_count(),
                    required: aggregator.required_signatures(),
                });
            }

            // Check if threshold reached
            {
                let aggregator = self.aggregator.read().await;
                if aggregator.is_threshold_reached() {
                    // Need to get the aggregated signature
                    drop(aggregator);

                    // Re-aggregate to get result
                    let aggregator = self.aggregator.read().await;
                    let signatures: Vec<BLSSignature> = aggregator
                        .get_signatures()
                        .values()
                        .cloned()
                        .collect();

                    let aggregated = self.bls_signer.aggregate_signatures(signatures)?;

                    return Ok(AggregationStatus::ThresholdReached {
                        aggregated_signature: aggregated,
                        signer_count: aggregator.collected_count(),
                        signers_bitmask: aggregator.signers_bitmask(),
                    });
                }
            }

            // Small sleep to avoid busy loop
            sleep(self.config.timeouts.polling_interval).await;
        }
    }

    /// Run the follower protocol
    ///
    /// Price round is eliminated from regular cycles — follower waits directly for
    /// BatchProposal from the leader. Price phases still work for standalone run_price_cycle.
    async fn run_follower_protocol(&self, cycle_number: u64) -> ConsensusResult {
        // Batch-only timeout — price round eliminated from regular cycle
        let total_timeout = self.config.timeouts.batch_proposal_timeout
            + self.config.timeouts.batch_sign_timeout;

        let deadline = tokio::time::Instant::now() + total_timeout;

        debug!(cycle_number, "Follower waiting for batch consensus messages");

        // Poll for state changes driven by incoming messages
        loop {
            if tokio::time::Instant::now() >= deadline {
                let state = self.state.read().await;
                let current_phase = state
                    .current_round()
                    .map(|r| r.phase)
                    .unwrap_or(ConsensusPhase::Idle);

                warn!(
                    code = "INFRA-007",
                    cycle_number,
                    ?current_phase,
                    "Follower consensus timeout"
                );

                return ConsensusResult::Timeout {
                    phase: current_phase,
                    cycle_number,
                };
            }

            // Check current state
            let state = self.state.read().await;
            if let Some(round) = state.current_round() {
                match round.phase {
                    ConsensusPhase::Complete => {
                        info!(cycle_number, "Follower consensus completed");
                        return ConsensusResult::Success {
                            aggregated_signature: BLSSignature(vec![0; 64]),
                            signer_count: 0,
                            cycle_number,
                        };
                    }
                    ConsensusPhase::Idle => {
                        // Waiting for batch proposal from leader (price round skipped)
                        debug!(cycle_number, "Follower waiting for batch proposal");
                    }
                    ConsensusPhase::PriceProposal | ConsensusPhase::PriceVoting => {
                        // Price messages may still arrive from run_price_cycle path — handle gracefully
                        debug!(cycle_number, phase = %round.phase, "Follower in price phase (standalone price cycle)");
                    }
                    ConsensusPhase::BatchProposal | ConsensusPhase::BatchSigning => {
                        debug!(cycle_number, phase = %round.phase, "Follower in batch phase");
                    }
                }
            }
            drop(state);

            // Small sleep to avoid busy loop - messages arrive via handle_message
            sleep(self.config.timeouts.polling_interval).await;
        }
    }

    /// Price-only follower protocol. Rejects BatchProposal messages.
    /// Only waits for PriceProposal -> PriceVoting -> Complete.
    /// Uses dedicated `price_state` (NOT shared `state`).
    async fn run_follower_protocol_price_only(&self, cycle_number: u64) -> ConsensusResult {
        let total_timeout = self.config.timeouts.price_proposal_timeout
            + self.config.timeouts.price_vote_timeout;
        let deadline = tokio::time::Instant::now() + total_timeout;

        let leader_index = self.leader_elector.read().await.last_leader_index();
        info!(cycle_number, ?leader_index, "Follower waiting for PriceProposal from leader");

        debug!(cycle_number, "Price-only follower waiting for consensus messages");

        loop {
            if tokio::time::Instant::now() >= deadline {
                let state = self.price_state.read().await;
                let current_phase = state
                    .current_round()
                    .map(|r| r.phase)
                    .unwrap_or(ConsensusPhase::Idle);

                warn!(
                    code = "INFRA-007",
                    cycle_number,
                    ?current_phase,
                    "Price-only follower consensus timeout"
                );

                return ConsensusResult::Timeout {
                    phase: current_phase,
                    cycle_number,
                };
            }

            // Check price_state (NOT shared state)
            let state = self.price_state.read().await;
            if let Some(round) = state.current_round() {
                match round.phase {
                    ConsensusPhase::Complete => {
                        info!(cycle_number, "Price-only follower consensus completed");
                        return ConsensusResult::PriceAgreed {
                            aggregated_signature: BLSSignature(vec![0; 64]),
                            signer_count: 0,
                            signers_bitmask: U256::zero(),
                            cycle_number,
                        };
                    }
                    ConsensusPhase::Idle => {
                        debug!(cycle_number, "Price-only follower waiting for price proposal");
                    }
                    ConsensusPhase::PriceProposal | ConsensusPhase::PriceVoting => {
                        debug!(cycle_number, phase = %round.phase, "Price-only follower in price phase");
                    }
                    ConsensusPhase::BatchProposal | ConsensusPhase::BatchSigning => {
                        // Reject — this is a price-only round, batch messages are invalid
                        warn!(cycle_number, "Price-only follower received batch phase — ignoring");
                    }
                }
            }
            drop(state);

            sleep(self.config.timeouts.polling_interval).await;
        }
    }

    /// Handle an incoming consensus message
    pub async fn handle_message(&self, from: PeerId, message: P2PMessage) -> Result<(), Error> {
        // Determine if this is a price message — use dedicated price_state
        let is_price_msg = matches!(&message,
            P2PMessage::PriceProposal { .. } | P2PMessage::PriceVote { .. }
        );

        let (cycle_number, phase) = if is_price_msg {
            let state = self.price_state.read().await;
            if let Some(round) = state.current_round() {
                (round.cycle_number, round.phase)
            } else {
                let msg_cycle = message_cycle_number(&message).unwrap_or(0);
                (msg_cycle, ConsensusPhase::Idle)
            }
        } else {
            let state = self.state.read().await;
            if let Some(round) = state.current_round() {
                (round.cycle_number, round.phase)
            } else {
                // Use message's cycle number instead of 0 when local state
                // isn't initialized (e.g. during simultaneous startup)
                let msg_cycle = message_cycle_number(&message).unwrap_or(0);
                (msg_cycle, ConsensusPhase::Idle)
            }
        };

        // For price messages, use "price" round type; for others, use "bridge"
        let round_type = if is_price_msg { "price" } else { "bridge" };

        // Equivocation detection: for vote/sign messages, check if this peer
        // already sent a *different* payload for the same (cycle, phase, msg_type).
        if is_vote_or_sign(&message) {
            let hash = content_hash(&message);
            let variant = msg_variant_tag(&message);
            if self.equivocation_detector.check(&from, cycle_number, phase, variant, round_type, hash) {
                error!(
                    code = "CONSENSUS-021",
                    ?from,
                    cycle_number,
                    ?phase,
                    "EQUIVOCATION DETECTED: peer sent conflicting vote/sign"
                );
                // Double penalty via peer scorer
                if let Some(ref scorer) = self.peer_scorer {
                    scorer.record_invalid_message(&from);
                    scorer.record_invalid_message(&from);
                }
                return Ok(());
            }
        }

        // WAL: log the message before processing so it survives crashes
        if let Some(ref wal_mutex) = self.wal {
            if !self.is_replay_mode() {
                if let Ok(mut wal) = wal_mutex.lock() {
                    let entry = crate::p2p::wal::WALEntry {
                        cycle_number,
                        phase: format!("{:?}", phase),
                        from,
                        message_bytes: rmp_serde::to_vec(&message).unwrap_or_default(),
                        role: crate::p2p::wal::WalRole::Follower,
                        timestamp_ms: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64,
                    };
                    if let Err(e) = wal.append(&entry) {
                        tracing::warn!(code = "INFRA-022", error = %e, "WAL append failed");
                    }
                }
            }
        }

        let result = {
            let mut handler = self.message_handler.write().await;
            handler.handle_message(from, message, cycle_number, phase)
        };

        // Leader identity verification: reject proposals from non-leaders.
        // Only for price-based proposals which use cycle_number % N election.
        // Bridge proposals (batch confirm, fills, sell, rebalance, trades) use
        // l3_cycle-based leader election with failover and are authenticated
        // via BLS signatures in the processing handlers instead.
        if let Some(proposal_sender) = result.proposal_sender() {
            let is_price_proposal = matches!(&result,
                MessageHandleResult::ProcessPriceProposal { .. }
                | MessageHandleResult::ProcessNavOracleProposal { .. }
            );
            if is_price_proposal && !self.is_valid_leader(&proposal_sender, cycle_number) {
                warn!(
                    code = "CONSENSUS-020",
                    ?proposal_sender,
                    cycle_number,
                    "Proposal from non-leader, rejecting"
                );
                return Ok(());
            }
        }

        // Track whether message was successfully processed (for peer scoring reward)
        let is_actionable = !matches!(
            result,
            MessageHandleResult::Ignored
                | MessageHandleResult::Stale
                | MessageHandleResult::Buffered
                | MessageHandleResult::UnexpectedPhase
        );

        match result {
            MessageHandleResult::ProcessPriceVote {
                from,
                approved,
                signature,
            } => {
                debug!(?from, approved, "Processing PriceVote");
                // Store in price_state (not shared state) — matches leader_price_consensus
                let mut state = self.price_state.write().await;
                if let Some(round) = state.current_round_mut() {
                    round.price_votes.insert(
                        from,
                        PriceVote {
                            approved,
                            signature: BLSSignature(signature.0),
                        },
                    );
                }
            }
            MessageHandleResult::ProcessBatchSign { from, signature } => {
                debug!(?from, "Processing BatchSign");
                let signer_index = extract_issuer_id(&from) as u8;
                let mut aggregator = self.aggregator.write().await;
                aggregator.add_signature(from, signer_index, BLSSignature(signature.0))?;
            }
            MessageHandleResult::ProcessPriceProposal {
                from,
                cycle_number: proposal_cycle,
                prices,
                proposer_signature,
            } => {
                // Follower: validate and vote on prices
                debug!(?from, "Processing PriceProposal as follower");
                self.handle_price_proposal_as_follower(from, proposal_cycle, prices, proposer_signature)
                    .await?;
            }
            MessageHandleResult::ProcessBatchProposal {
                from,
                order_ids,
                fills,
                proposer_signature,
            } => {
                // Follower: validate and sign batch
                debug!(?from, "Processing BatchProposal as follower");
                self.handle_batch_proposal_as_follower(from, order_ids, fills, proposer_signature)
                    .await?;
            }
            MessageHandleResult::ProcessItpCreationProposal {
                from,
                leader_id,
                admin,
                nonce,
                name,
                symbol,
                weights,
                assets,
                leader_signature,
            } => {
                // Follower: validate and sign ITP creation proposal (Story 6.24 fix)
                debug!(
                    ?from,
                    nonce = %nonce,
                    "Processing ItpCreationProposal as follower"
                );

                // Check if ITP creation config is set
                let itp_config_guard = self.itp_creation_config.read().await;
                if let Some(ref itp_config) = *itp_config_guard {
                    // We have config - handle the proposal inline
                    let itp_config_clone = itp_config.clone();
                    drop(itp_config_guard); // Release lock before async call

                    if let Err(e) = self.handle_itp_creation_proposal(
                        from,
                        leader_id,
                        admin,
                        nonce,
                        name,
                        symbol,
                        weights,
                        assets,
                        leader_signature,
                        &itp_config_clone,
                        None, // No pending request lookup in message handler
                    ).await {
                        warn!(
                            code = "INFRA-007",
                            nonce = %nonce,
                            error = %e,
                            "Failed to handle ITP creation proposal"
                        );
                    }
                } else {
                    warn!(
                        code = "INFRA-007",
                        nonce = %nonce,
                        "ItpCreationProposal received but no itp_creation_config set - ignoring"
                    );
                }
            }
            MessageHandleResult::ProcessItpCreationSign { from, signer_index, nonce, signature } => {
                // Handle ITP creation signature from follower
                debug!(?from, signer_index, nonce = %nonce, "Processing ItpCreationSign");
                self.handle_itp_creation_sign(from, signer_index, nonce, BLSSignature(signature.0))
                    .await?;
            }
            // Story 7.2/7.9: Bridge Settlement→L3 messages - handled via BridgeOrchestrator
            MessageHandleResult::ProcessBridgeSettlementToL3Proposal {
                from,
                leader_id,
                order_id,
                itp_id,
                user,
                amount,
                deadline,
                leader_signature,
            } => {
                // Follower: validate and sign bridge proposal (Story 7.9 Task 5)
                debug!(
                    ?from,
                    order_id = %order_id,
                    itp_id = ?itp_id,
                    user = ?user,
                    amount = %amount,
                    deadline = %deadline,
                    "Processing BridgeSettlementToL3Proposal as follower"
                );

                if let Err(e) = self.handle_bridge_settlement_to_l3_proposal(
                    from,
                    leader_id,
                    order_id,
                    itp_id,
                    user,
                    amount,
                    deadline,
                    BLSSignature(leader_signature.0),
                ).await {
                    warn!(
                        code = "INFRA-007",
                        order_id = %order_id,
                        error = %e,
                        "Failed to handle bridge proposal"
                    );
                }
            }
            MessageHandleResult::ProcessBridgeSettlementToL3Sign {
                from,
                signer_index,
                order_id,
                signature,
            } => {
                // Leader: collect follower signature (Story 7.9 Task 6)
                debug!(
                    ?from,
                    signer_index,
                    order_id = %order_id,
                    "Processing BridgeSettlementToL3Sign as leader"
                );

                if let Err(e) = self.handle_bridge_settlement_to_l3_sign(
                    from,
                    signer_index,
                    order_id,
                    BLSSignature(signature.0),
                ).await {
                    warn!(
                        code = "INFRA-007",
                        order_id = %order_id,
                        error = %e,
                        "Failed to handle bridge signature"
                    );
                }
            }
            // Story 7.3: Submit Order for User messages - routed to ConsensusProtocol handlers
            MessageHandleResult::ProcessSubmitOrderForUserProposal {
                from,
                leader_id,
                settlement_order_id,
                itp_id,
                user,
                amount,
                limit_price,
                slippage_tier,
                deadline,
                leader_signature,
            } => {
                // Route to handle_submit_order_proposal (follower handler)
                debug!(
                    ?from,
                    settlement_order_id = %settlement_order_id,
                    itp_id = ?itp_id,
                    user = ?user,
                    amount = %amount,
                    "Received SubmitOrderForUserProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_submit_order_proposal(
                        from,
                        leader_id,
                        settlement_order_id,
                        itp_id,
                        user,
                        amount,
                        limit_price,
                        slippage_tier,
                        deadline,
                        BLSSignature(leader_signature.0),
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        settlement_order_id = %settlement_order_id,
                        error = %e,
                        "Failed to handle submit order proposal"
                    );
                }
            }
            MessageHandleResult::ProcessSubmitOrderForUserSign {
                from,
                signer_index,
                settlement_order_id,
                signature,
            } => {
                // Route to handle_submit_order_sign (leader handler)
                debug!(
                    ?from,
                    signer_index,
                    settlement_order_id = %settlement_order_id,
                    "Received SubmitOrderForUserSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_submit_order_sign(
                        from,
                        signer_index,
                        settlement_order_id,
                        BLSSignature(signature.0),
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        settlement_order_id = %settlement_order_id,
                        error = %e,
                        "Failed to handle submit order signature"
                    );
                }
            }
            // Story 7.4: Batch and Fill confirmation messages - routed to ConsensusProtocol handlers
            MessageHandleResult::ProcessConfirmBatchProposal {
                from,
                leader_id,
                cycle_number,
                order_ids,
                prices,
                leader_signature,
            } => {
                // Route to handle_confirm_batch_proposal (follower handler)
                debug!(
                    ?from,
                    cycle_number,
                    num_orders = order_ids.len(),
                    "Received ConfirmBatchProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_confirm_batch_proposal(
                        from,
                        leader_id,
                        cycle_number,
                        order_ids,
                        prices,
                        BLSSignature(leader_signature.0),
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle confirm batch proposal"
                    );
                }
            }
            MessageHandleResult::ProcessConfirmBatchSign {
                from,
                signer_index,
                cycle_number,
                signature,
            } => {
                // Route to handle_confirm_batch_sign (leader handler)
                debug!(
                    ?from,
                    signer_index,
                    cycle_number,
                    "Received ConfirmBatchSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_confirm_batch_sign(
                        from,
                        signer_index,
                        cycle_number,
                        BLSSignature(signature.0),
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle confirm batch signature"
                    );
                }
            }
            MessageHandleResult::ProcessConfirmFillsProposal {
                from,
                leader_id,
                cycle_number,
                fills,
                leader_signature,
            } => {
                // Route to handle_confirm_fills_proposal (follower handler)
                debug!(
                    ?from,
                    cycle_number,
                    num_fills = fills.len(),
                    "Received ConfirmFillsProposal - routing to handler"
                );
                // Convert common::types::Fill to crate::bridge::Fill for handler
                let bridge_fills: Vec<crate::bridge::Fill> = fills.iter().map(|f| crate::bridge::Fill {
                    order_id: f.order_id,
                    fill_price: f.fill_price,
                    fill_amount: f.fill_amount,
                }).collect();
                if let Err(e) = self
                    .handle_confirm_fills_proposal(
                        from,
                        leader_id,
                        cycle_number,
                        bridge_fills,
                        BLSSignature(leader_signature.0),
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle confirm fills proposal"
                    );
                }
            }
            MessageHandleResult::ProcessConfirmFillsSign {
                from,
                signer_index,
                cycle_number,
                signature,
            } => {
                // Route to handle_confirm_fills_sign (leader handler)
                debug!(
                    ?from,
                    signer_index,
                    cycle_number,
                    "Received ConfirmFillsSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_confirm_fills_sign(
                        from,
                        signer_index,
                        cycle_number,
                        BLSSignature(signature.0),
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle confirm fills signature"
                    );
                }
            }
            // Story 7.10: Bridge L3 to Arb messages - routed to ConsensusProtocol handlers
            MessageHandleResult::ProcessBridgeL3ToSettlementProposal {
                from,
                leader_id,
                cycle_number,
                order_ids,
                total_amount,
                destination,
                leader_signature,
            } => {
                // Route to handle_bridge_l3_to_settlement_proposal (follower handler)
                debug!(
                    ?from,
                    cycle_number,
                    num_orders = order_ids.len(),
                    total_amount = %total_amount,
                    destination = ?destination,
                    "Received BridgeL3ToSettlementProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_bridge_l3_to_settlement_proposal(
                        from,
                        leader_id,
                        cycle_number,
                        order_ids,
                        total_amount,
                        destination,
                        leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle BridgeL3ToSettlementProposal"
                    );
                }
            }
            MessageHandleResult::ProcessBridgeL3ToSettlementSign {
                from,
                signer_index,
                cycle_number,
                signature,
            } => {
                // Route to handle_bridge_l3_to_settlement_sign (leader handler)
                debug!(
                    ?from,
                    signer_index,
                    cycle_number,
                    "Received BridgeL3ToSettlementSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_bridge_l3_to_settlement_sign(from, signer_index, cycle_number, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle BridgeL3ToSettlementSign"
                    );
                }
            }
            // Story 7.10: Custody release to vault messages - routed to ConsensusProtocol handlers
            MessageHandleResult::ProcessReleaseToVaultProposal {
                from,
                leader_id,
                cycle_number,
                order_ids,
                total_amount,
                vault_address,
                leader_signature,
            } => {
                // Route to handle_release_to_vault_proposal (follower handler)
                debug!(
                    ?from,
                    cycle_number,
                    num_orders = order_ids.len(),
                    total_amount = %total_amount,
                    vault_address = ?vault_address,
                    "Received ReleaseToVaultProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_release_to_vault_proposal(
                        from,
                        leader_id,
                        cycle_number,
                        order_ids,
                        total_amount,
                        vault_address,
                        leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle ReleaseToVaultProposal"
                    );
                }
            }
            MessageHandleResult::ProcessReleaseToVaultSign {
                from,
                signer_index,
                cycle_number,
                signature,
            } => {
                // Route to handle_release_to_vault_sign (leader handler)
                debug!(
                    ?from,
                    signer_index,
                    cycle_number,
                    "Received ReleaseToVaultSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_release_to_vault_sign(from, signer_index, cycle_number, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle ReleaseToVaultSign"
                    );
                }
            }
            // Story 7-14: Rebalance batch consensus messages
            MessageHandleResult::ProcessRebalanceBatchProposal {
                from,
                leader_id,
                cycle_number,
                itp_ids,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    cycle_number,
                    itp_count = itp_ids.len(),
                    "Received RebalanceBatchProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_rebalance_batch_proposal(from, leader_id, cycle_number, itp_ids, leader_signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle RebalanceBatchProposal"
                    );
                }
            }
            MessageHandleResult::ProcessRebalanceBatchSign {
                from,
                signer_index,
                cycle_number,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    cycle_number,
                    "Received RebalanceBatchSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_rebalance_batch_sign(from, signer_index, cycle_number, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number,
                        error = %e,
                        "Failed to handle RebalanceBatchSign"
                    );
                }
            }
            // Story 7-14: Update weights consensus messages
            MessageHandleResult::ProcessUpdateWeightsProposal {
                from,
                leader_id,
                itp_id,
                new_weights,
                new_inventory,
                nav,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    itp_id = ?itp_id,
                    weight_count = new_weights.len(),
                    "Received UpdateWeightsProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_update_weights_proposal(from, leader_id, itp_id, new_weights, new_inventory, nav, leader_signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        itp_id = ?itp_id,
                        error = %e,
                        "Failed to handle UpdateWeightsProposal"
                    );
                }
            }
            MessageHandleResult::ProcessUpdateWeightsSign {
                from,
                signer_index,
                itp_id,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    itp_id = ?itp_id,
                    "Received UpdateWeightsSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_update_weights_sign(from, signer_index, itp_id, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        itp_id = ?itp_id,
                        error = %e,
                        "Failed to handle UpdateWeightsSign"
                    );
                }
            }
            // Single-phase rebalance consensus messages
            MessageHandleResult::ProcessRebalanceProposal {
                from,
                leader_id,
                itp_id,
                remove_indices,
                add_assets,
                new_weights,
                prices,
                quote_tokens,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    itp_id = ?itp_id,
                    weight_count = new_weights.len(),
                    "Received RebalanceProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_rebalance_proposal(from, leader_id, itp_id, remove_indices, add_assets, new_weights, prices, quote_tokens, leader_signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        itp_id = ?itp_id,
                        error = %e,
                        "Failed to handle RebalanceProposal"
                    );
                }
            }
            MessageHandleResult::ProcessRebalanceSign {
                from,
                signer_index,
                itp_id,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    itp_id = ?itp_id,
                    "Received RebalanceSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_rebalance_sign(from, signer_index, itp_id, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        itp_id = ?itp_id,
                        error = %e,
                        "Failed to handle RebalanceSign"
                    );
                }
            }
            MessageHandleResult::ProcessAssetTradesProposal {
                from,
                leader_id,
                cycle_number: msg_cycle,
                trades_data,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    cycle_number = msg_cycle,
                    trade_count = trades_data.len(),
                    "Received AssetTradesProposal - validating and signing"
                );
                // Reconstruct trades from data tuples
                let trades: Vec<AssetTrade> = trades_data.iter()
                    .map(|(asset, side, usdc_amount, price, quote_token)| AssetTrade {
                        asset: *asset,
                        side: *side,
                        usdc_amount: *usdc_amount,
                        price: *price,
                        quote_token: *quote_token,
                    })
                    .collect();

                let bridge_orch_guard = self.bridge_orchestrator.read().await;
                if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                    // Compute the message hash for verification
                    let message_hash = {
                        let orch = bridge_orch.read().await;
                        crate::bridge::build_emit_asset_trades_hash(
                            orch.config().l3_chain_id,
                            orch.config().index_address,
                            msg_cycle,
                            &trades_data.iter()
                                .map(|(asset, side, usdc_amount, price, quote_token)| AssetTrade {
                                    asset: *asset, side: *side, usdc_amount: *usdc_amount, price: *price, quote_token: *quote_token,
                                })
                                .collect::<Vec<_>>(),
                        )
                    };

                    // Verify leader's BLS signature before signing
                    self.verify_leader_bls(&leader_id, &message_hash, &leader_signature, "asset_trades")?;

                    let proposal = AssetTradesProposal {
                        leader_id,
                        cycle_number: msg_cycle,
                        trades,
                        leader_signature: BLSSignature(leader_signature.0.clone()),
                        message_hash,
                    };

                    match {
                        let orch = bridge_orch.read().await;
                        orch.sign_asset_trades_proposal(&proposal)
                    } {
                        Ok(signature) => {
                            let sign_msg = P2PMessage::AssetTradesSign {
                                signer_id: self.config.peer_id,
                                signer_index: self.runtime_config.issuer_registry_index(),
                                cycle_number: msg_cycle,
                                signature: signature.clone(),
                            };
                            if let Err(e) = self.p2p.broadcast(sign_msg).await {
                                warn!(cycle_number = msg_cycle, error = %e, "Failed to broadcast asset trades signature");
                            } else {
                                info!(cycle_number = msg_cycle, "Signed and broadcast asset trades proposal");
                            }
                        }
                        Err(e) => {
                            warn!(cycle_number = msg_cycle, error = %e, "Failed to sign asset trades proposal");
                        }
                    }
                }
            }
            MessageHandleResult::ProcessAssetTradesSign {
                from,
                signer_index,
                cycle_number: msg_cycle,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    cycle_number = msg_cycle,
                    "Received AssetTradesSign - adding to collector"
                );
                let bridge_orch_guard = self.bridge_orchestrator.read().await;
                if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                    let mut orch = bridge_orch.write().await;
                    match orch.add_asset_trades_follower_signature(
                        msg_cycle,
                        signer_index,
                        BLSSignature(signature.0.clone()),
                    ).await {
                        Ok(Some(result)) => {
                            info!(
                                cycle_number = msg_cycle,
                                signer_count = result.signature_count,
                                "Asset trades signature threshold reached"
                            );
                        }
                        Ok(None) => {
                            debug!(cycle_number = msg_cycle, "Asset trades signature collected, waiting for more");
                        }
                        Err(e) => {
                            warn!(cycle_number = msg_cycle, error = %e, "Failed to add asset trades signature");
                        }
                    }
                } else {
                    debug!(cycle_number = msg_cycle, "No bridge orchestrator, ignoring AssetTradesSign");
                }
            }
            // Cross-chain sell flow messages
            MessageHandleResult::ProcessSubmitSellOrderProposal {
                from,
                leader_id,
                order_id,
                itp_id,
                user,
                bridged_itp_address,
                amount,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    order_id = %order_id,
                    "Received SubmitSellOrderProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_submit_sell_order_proposal(
                        from, leader_id, order_id, itp_id, user, bridged_itp_address, amount, leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        order_id = %order_id,
                        error = %e,
                        "Failed to handle SubmitSellOrderProposal"
                    );
                }
            }
            MessageHandleResult::ProcessSubmitSellOrderSign {
                from,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    order_id = %order_id,
                    "Received SubmitSellOrderSign - adding to collector"
                );
                if let Err(e) = self
                    .handle_submit_sell_order_sign(from, signer_index, order_id, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        order_id = %order_id,
                        error = %e,
                        "Failed to handle SubmitSellOrderSign"
                    );
                }
            }
            MessageHandleResult::ProcessCompleteSellOrderProposal {
                from,
                leader_id,
                order_id,
                usdc_proceeds,
                vault,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    order_id = %order_id,
                    usdc_proceeds = %usdc_proceeds,
                    ?vault,
                    "Received CompleteSellOrderProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_complete_sell_order_proposal(
                        from, leader_id, order_id, usdc_proceeds, vault, leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        order_id = %order_id,
                        error = %e,
                        "Failed to handle CompleteSellOrderProposal"
                    );
                }
            }
            MessageHandleResult::ProcessCompleteSellOrderSign {
                from,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    order_id = %order_id,
                    "Received CompleteSellOrderSign - adding to collector"
                );
                if let Err(e) = self
                    .handle_complete_sell_order_sign(from, signer_index, order_id, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        order_id = %order_id,
                        error = %e,
                        "Failed to handle CompleteSellOrderSign"
                    );
                }
            }
            MessageHandleResult::ProcessBurnSellOrderProposal {
                from,
                leader_id,
                order_id,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?leader_id,
                    order_id = %order_id,
                    "Received BurnSellOrderProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_burn_sell_order_proposal(
                        from, leader_id, order_id, leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        order_id = %order_id,
                        error = %e,
                        "Failed to handle BurnSellOrderProposal"
                    );
                }
            }
            MessageHandleResult::ProcessBurnSellOrderSign {
                from,
                signer_index,
                order_id,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    order_id = %order_id,
                    "Received BurnSellOrderSign - adding to collector"
                );
                if let Err(e) = self
                    .handle_burn_sell_order_sign(from, signer_index, order_id, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        order_id = %order_id,
                        error = %e,
                        "Failed to handle BurnSellOrderSign"
                    );
                }
            }
            // 8-step bridge: RecordCollateralMove consensus
            MessageHandleResult::ProcessRecordCollateralMoveProposal {
                from,
                leader_id,
                cycle_number: msg_cycle,
                itp_id,
                from_chain,
                to_chain,
                amount,
                tx_type,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    cycle_number = msg_cycle,
                    itp_id = ?itp_id,
                    "Received RecordCollateralMoveProposal - validating and signing"
                );
                if let Err(e) = self
                    .handle_record_collateral_move_proposal(
                        from, leader_id, msg_cycle, itp_id, from_chain, to_chain, amount, tx_type, leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number = msg_cycle,
                        error = %e,
                        "Failed to handle RecordCollateralMoveProposal"
                    );
                }
            }
            MessageHandleResult::ProcessRecordCollateralMoveSign {
                from,
                signer_index,
                cycle_number: msg_cycle,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    cycle_number = msg_cycle,
                    "Received RecordCollateralMoveSign - adding to collector"
                );
                if let Err(e) = self
                    .handle_record_collateral_move_sign(from, signer_index, msg_cycle, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number = msg_cycle,
                        error = %e,
                        "Failed to handle RecordCollateralMoveSign"
                    );
                }
            }
            // 8-step bridge: MintBridgedShares consensus
            MessageHandleResult::ProcessMintBridgedSharesProposal {
                from,
                leader_id,
                cycle_number: msg_cycle,
                itp_id,
                user,
                amount,
                order_id,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    cycle_number = msg_cycle,
                    itp_id = ?itp_id,
                    "Received MintBridgedSharesProposal - validating and signing"
                );
                if let Err(e) = self
                    .handle_mint_bridged_shares_proposal(
                        from, leader_id, msg_cycle, itp_id, user, amount, order_id, leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number = msg_cycle,
                        error = %e,
                        "Failed to handle MintBridgedSharesProposal"
                    );
                }
            }
            MessageHandleResult::ProcessMintBridgedSharesSign {
                from,
                signer_index,
                cycle_number: msg_cycle,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    cycle_number = msg_cycle,
                    "Received MintBridgedSharesSign - adding to collector"
                );
                if let Err(e) = self
                    .handle_mint_bridged_shares_sign(from, signer_index, msg_cycle, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        cycle_number = msg_cycle,
                        error = %e,
                        "Failed to handle MintBridgedSharesSign"
                    );
                }
            }
            // completeBuyOrder BLS consensus messages
            MessageHandleResult::ProcessCompleteBuyOrderProposal {
                from,
                leader_id,
                cycle_number: msg_cycle,
                order_id,
                vault,
                leader_signature,
            } => {
                debug!(
                    ?leader_id,
                    cycle_number = msg_cycle,
                    order_id = %order_id,
                    "Received CompleteBuyOrderProposal - validating and signing"
                );

                let bridge_orch_guard = self.bridge_orchestrator.read().await;
                let bridge_orch = match bridge_orch_guard.as_ref() {
                    Some(orch) => orch,
                    None => {
                        warn!(code = "INFRA-008", cycle_number = msg_cycle, "BridgeOrchestrator not configured");
                        return Ok(());
                    }
                };

                let orch = bridge_orch.read().await;
                let config = orch.config();

                // Validate vault address matches our config — prevents leader redirecting USDC
                if vault != config.bitget_vault {
                    warn!(
                        code = "INFRA-007",
                        cycle_number = msg_cycle,
                        expected = ?config.bitget_vault,
                        received = ?vault,
                        "CompleteBuyOrder proposal rejected: vault address mismatch"
                    );
                    return Ok(());
                }

                let message_hash = build_complete_buy_order_hash(
                    config.settlement_chain_id,
                    config.settlement_custody_address,
                    order_id,
                    vault,
                );

                // Verify leader's BLS signature before signing
                self.verify_leader_bls(&leader_id, &message_hash, &leader_signature, "complete_buy_order")?;

                let hash_bytes: [u8; 32] = message_hash.into();
                let signature = self
                    .bls_signer
                    .sign_message_hash(&self.bls_keypair, &hash_bytes)
                    .map_err(|e| Error::BlsVerification(format!("Failed to sign CompleteBuyOrder: {}", e)))?;

                drop(orch);
                drop(bridge_orch_guard);

                let message = P2PMessage::CompleteBuyOrderSign {
                    signer_id: self.config.peer_id,
                    signer_index: self.runtime_config.issuer_registry_index(),
                    cycle_number: msg_cycle,
                    signature,
                };
                self.p2p.send_to(from, message).await?;
            }
            MessageHandleResult::ProcessCompleteBuyOrderSign {
                from: signer_id,
                signer_index,
                cycle_number: msg_cycle,
                signature,
            } => {
                debug!(
                    ?signer_id,
                    signer_index,
                    cycle_number = msg_cycle,
                    "Received CompleteBuyOrderSign - adding to collector"
                );

                let bridge_orch_guard = self.bridge_orchestrator.read().await;
                if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                    let orch = bridge_orch.write().await;
                    match orch.add_complete_buy_order_signature(
                        msg_cycle,
                        signer_index,
                        BLSSignature(signature.0),
                    ).await {
                        Ok(Some(result)) => {
                            info!(cycle_number = msg_cycle, signature_count = result.signature_count, "CompleteBuyOrder threshold reached");
                        }
                        Ok(None) => {
                            debug!(cycle_number = msg_cycle, signer_index, "CompleteBuyOrder signature added, waiting for more");
                        }
                        Err(e) => {
                            warn!(cycle_number = msg_cycle, error = %e, "Failed to add CompleteBuyOrder signature");
                        }
                    }
                }
            }
            // Rebalance NAV consensus: setItpNav
            MessageHandleResult::ProcessSetItpNavProposal {
                from,
                leader_id,
                itp_id,
                nav,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    itp_id = ?itp_id,
                    nav = %nav,
                    "Received SetItpNavProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_set_itp_nav_proposal(from, leader_id, itp_id, nav, leader_signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        itp_id = ?itp_id,
                        error = %e,
                        "Failed to handle SetItpNavProposal"
                    );
                }
            }
            MessageHandleResult::ProcessSetItpNavSign {
                from,
                signer_index,
                itp_id,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    itp_id = ?itp_id,
                    "Received SetItpNavSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_set_itp_nav_sign(from, signer_index, itp_id, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        itp_id = ?itp_id,
                        error = %e,
                        "Failed to handle SetItpNavSign"
                    );
                }
            }
            // NAV oracle price update (Arb ITPNAVOracle)
            MessageHandleResult::ProcessNavOracleProposal {
                from,
                leader_id,
                itp_address,
                oracle_address,
                nav_price,
                timestamp,
                cycle_number,
                chain_id,
                reference_nonce,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    ?itp_address,
                    nav_price = %nav_price,
                    "Received NavOracleProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_nav_oracle_proposal(
                        from, leader_id, itp_address, oracle_address, nav_price,
                        timestamp, cycle_number, chain_id, reference_nonce, leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        ?itp_address,
                        error = %e,
                        "Failed to handle NavOracleProposal"
                    );
                }
            }
            MessageHandleResult::ProcessNavOracleSign {
                from,
                signer_index,
                itp_address,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    ?itp_address,
                    "Received NavOracleSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_nav_oracle_sign(from, signer_index, itp_address, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        ?itp_address,
                        error = %e,
                        "Failed to handle NavOracleSign"
                    );
                }
            }
            // MirrorIssuerRegistry sync (Step 12)
            MessageHandleResult::ProcessMirrorSyncProposal {
                from,
                leader_id,
                nonce,
                issuer_pubkeys,
                issuer_ids,
                active_bitmask,
                active_count,
                threshold,
                chain_id,
                mirror_address,
                reference_nonce,
                leader_signature,
            } => {
                debug!(
                    ?from,
                    nonce,
                    active_count,
                    "Received MirrorSyncProposal - routing to handler"
                );
                if let Err(e) = self
                    .handle_mirror_sync_proposal(
                        from, leader_id, nonce, issuer_pubkeys, issuer_ids,
                        active_bitmask, active_count, threshold,
                        chain_id, mirror_address, reference_nonce, leader_signature,
                    )
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        nonce,
                        error = %e,
                        "Failed to handle MirrorSyncProposal"
                    );
                }
            }
            MessageHandleResult::ProcessMirrorSyncSign {
                from,
                signer_index,
                nonce,
                signature,
            } => {
                debug!(
                    ?from,
                    signer_index,
                    nonce,
                    "Received MirrorSyncSign - routing to handler"
                );
                if let Err(e) = self
                    .handle_mirror_sync_sign(from, signer_index, nonce, signature)
                    .await
                {
                    warn!(
                        code = "INFRA-007",
                        nonce,
                        error = %e,
                        "Failed to handle MirrorSyncSign"
                    );
                }
            }
            // AA keeper arbitration — forward to arbitration subsystem
            MessageHandleResult::ForwardToArbitration(msg) => {
                let arb_tx = self.arbitration_tx.read().await;
                if let Some(ref tx) = *arb_tx {
                    if let Err(e) = tx.send(msg) {
                        warn!(error = %e, "Failed to forward message to arbitration subsystem");
                    }
                } else {
                    debug!("Arbitration message received but subsystem not enabled");
                }
            }
            MessageHandleResult::Stale => {
                debug!("Stale message ignored");
            }
            MessageHandleResult::Buffered => {
                debug!("Message buffered for future cycle");
            }
            MessageHandleResult::UnexpectedPhase => {
                warn!(code = "INFRA-007", "Message received in unexpected phase");
            }
            MessageHandleResult::Ignored => {}
        }

        // Reward peer for valid consensus participation (scores only went down
        // before this fix — now good messages counteract penalties)
        if is_actionable {
            if let Some(ref scorer) = self.peer_scorer {
                scorer.record_good_message(&from);
            }
        }

        Ok(())
    }

    /// Verify a leader's BLS signature on a pre-hashed message.
    ///
    /// Returns Ok(()) if valid. Returns Err(BlsVerification) if:
    /// - Leader not in key registry (unknown issuer)
    /// - Signature invalid (tampered or wrong key)
    /// - Verification failed (BLS error)
    fn verify_leader_bls(
        &self,
        leader_id: &PeerId,
        message_hash: &H256,
        leader_signature: &BLSSignature,
        label: &str,
    ) -> Result<(), Error> {
        let leader_pubkey = self.key_registry.get_public_key(leader_id).ok_or_else(|| {
            warn!(
                code = "INFRA-007",
                ?leader_id,
                label,
                "Leader public key not found in registry, REJECTING proposal"
            );
            Error::BlsVerification(format!(
                "Leader {:?} not found in key registry -- refusing to sign {}",
                leader_id, label
            ))
        })?;

        let hash_bytes: [u8; 32] = (*message_hash).into();
        match self
            .bls_signer
            .verify_message_hash(&leader_pubkey, &hash_bytes, leader_signature)
        {
            Ok(true) => Ok(()),
            Ok(false) => {
                warn!(
                    code = "INFRA-007",
                    label,
                    "Invalid leader signature on proposal"
                );
                Err(Error::BlsVerification(format!(
                    "Invalid leader signature on {} proposal",
                    label
                )))
            }
            Err(e) => {
                warn!(
                    code = "INFRA-007",
                    label,
                    error = %e,
                    "Failed to verify leader signature"
                );
                Err(e)
            }
        }
    }

    /// Follower: Handle price proposal
    async fn handle_price_proposal_as_follower(
        &self,
        leader_id: PeerId,
        cycle_number: u64,
        prices: Vec<(u32, U256)>,
        proposer_signature: BLSSignature,
    ) -> Result<(), Error> {

        // Verify proposer signature using key registry
        if let Some(leader_pubkey) = self.key_registry.get_public_key(&leader_id) {
            let proposal_bytes = self.encode_price_proposal(cycle_number, &prices);
            match self.bls_signer.verify(&leader_pubkey, &proposal_bytes, &proposer_signature) {
                Ok(true) => {
                    debug!(cycle_number, "Leader signature verified");
                }
                Ok(false) => {
                    warn!(code = "INFRA-007", cycle_number, "Invalid proposer signature on price proposal");
                    return Err(Error::BlsVerification(
                        "Invalid proposer signature on price proposal".to_string(),
                    ));
                }
                Err(e) => {
                    warn!(code = "INFRA-007", cycle_number, error = %e, "Failed to verify proposer signature");
                    return Err(e);
                }
            }
        } else {
            warn!(
                code = "INFRA-007",
                cycle_number,
                ?leader_id,
                "Leader public key not found in registry, REJECTING proposal"
            );
            return Err(Error::BlsVerification(
                format!("Leader {:?} not found in key registry -- refusing to sign", leader_id)
            ));
        }

        // Convert leader's (asset_index, price) tuples to Price structs
        let current_time = U256::from(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        );

        // Convert asset indices to real addresses using the known_assets registry.
        // The leader sends (index, price) where index maps to known_assets[index].
        let known = self.known_assets.read().await;
        let asset_addresses: Vec<ethers::types::Address> = prices
            .iter()
            .map(|(asset_idx, _)| {
                let idx = *asset_idx as usize;
                if idx < known.len() {
                    known[idx]
                } else {
                    warn!(asset_idx, known_len = known.len(), "Asset index out of range — fabricating placeholder");
                    let mut asset_bytes = [0u8; 20];
                    asset_bytes[16..20].copy_from_slice(&asset_idx.to_be_bytes());
                    ethers::types::Address::from(asset_bytes)
                }
            })
            .collect();
        drop(known);

        let leader_prices: Vec<Price> = prices
            .iter()
            .zip(asset_addresses.iter())
            .map(|((_, price), addr)| {
                Price {
                    asset: *addr,
                    price: *price,
                    timestamp: current_time,
                    source: U256::zero(), // Bitget source
                }
            })
            .collect();

        // Fetch our own prices from the price fetcher.
        // On failure, fall back to last known prices if they are <30s old.
        // If stale (>30s), reject the proposal — don't blindly approve.
        let my_prices = match self.price_fetcher.fetch_prices(&asset_addresses).await {
            Ok(prices) => {
                // Cache successful prices
                let now_secs = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let mut cache = self.last_prices.write().await;
                for p in &prices {
                    cache.insert(p.asset, (p.price, now_secs));
                }
                prices
            }
            Err(e) => {
                // Try last known prices
                let now_secs = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let cache = self.last_prices.read().await;
                let mut fallback = Vec::new();
                let mut stale = false;
                for addr in &asset_addresses {
                    if let Some((price, ts)) = cache.get(addr) {
                        if now_secs.saturating_sub(*ts) > 30 {
                            stale = true;
                            break;
                        }
                        fallback.push(Price {
                            asset: *addr,
                            price: *price,
                            timestamp: U256::from(*ts),
                            source: U256::zero(),
                        });
                    } else {
                        stale = true; // no cached price for this asset
                        break;
                    }
                }
                drop(cache);

                if stale || fallback.is_empty() {
                    warn!(code = "INFRA-007", cycle_number, error = %e, "Failed to fetch prices and no recent cache — rejecting proposal");
                    let vote_bytes = self.encode_price_vote(cycle_number, false);
                    let signature = self
                        .bls_signer
                        .sign_with_keypair(&self.bls_keypair, &vote_bytes)?;
                    let message = P2PMessage::PriceVote {
                        cycle_number,
                        voter_id: self.config.peer_id,
                        approved: false,
                        signature: BLSSignature(signature.0),
                    };
                    return self.p2p.send_to(leader_id, message).await;
                }

                warn!(code = "INFRA-007", cycle_number, error = %e, "Using cached prices (< 30s old) for validation");
                fallback
            }
        };

        // Compare leader's prices against our own using tolerance validator
        let comparison = self.price_validator.compare_prices(&my_prices, &leader_prices);
        let approved = comparison.agrees;

        if !approved {
            warn!(
                code = "E008",
                cycle_number,
                disagreement_count = comparison.disagreements.len(),
                "Price disagreement detected, voting to reject"
            );
            for disagreement in &comparison.disagreements {
                debug!(
                    cycle_number,
                    asset = ?disagreement.asset,
                    my_price = %disagreement.my_price,
                    leader_price = %disagreement.leader_price,
                    diff_bps = disagreement.difference_bps,
                    "Price disagreement detail"
                );
            }
        }

        // Sign the vote
        let vote_bytes = self.encode_price_vote(cycle_number, approved);
        let signature = self
            .bls_signer
            .sign_with_keypair(&self.bls_keypair, &vote_bytes)?;

        // Send vote to leader
        let message = P2PMessage::PriceVote {
            cycle_number,
            voter_id: self.config.peer_id,
            approved,
            signature: BLSSignature(signature.0),
        };

        info!(cycle_number, approved, "Sending PriceVote to leader");
        self.p2p.send_to(leader_id, message).await
    }

    /// Follower: Handle batch proposal
    async fn handle_batch_proposal_as_follower(
        &self,
        leader_id: PeerId,
        order_ids: Vec<u64>,
        fills: Vec<Fill>,
        proposer_signature: BLSSignature,
    ) -> Result<(), Error> {
        let cycle_number = {
            let state = self.state.read().await;
            state
                .current_round()
                .map(|r| r.cycle_number)
                .unwrap_or(0)
        };

        // Compute on-chain-compatible hash for BLS verification
        let (l3_chain_id, index_address) = {
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
                Error::BlsVerification("BridgeOrchestrator not configured for batch hash".to_string())
            })?;
            let orch = bridge_orch.read().await;
            let config = orch.config();
            (config.l3_chain_id, config.index_address)
        };
        let order_ids_u256: Vec<U256> = order_ids.iter().map(|&id| U256::from(id)).collect();
        let on_chain_hash = build_confirm_batch_hash(l3_chain_id, index_address, cycle_number, &order_ids_u256);
        let hash_bytes: [u8; 32] = on_chain_hash.into();

        // Verify proposer signature using on-chain hash format
        if let Some(leader_pubkey) = self.key_registry.get_public_key(&leader_id) {
            match self.bls_signer.verify_message_hash(&leader_pubkey, &hash_bytes, &proposer_signature) {
                Ok(true) => {
                    debug!(cycle_number, "Batch proposal signature verified");
                }
                Ok(false) => {
                    warn!(code = "INFRA-007", cycle_number, "Invalid proposer signature on batch proposal");
                    return Err(Error::BlsVerification(
                        "Invalid proposer signature on batch proposal".to_string(),
                    ));
                }
                Err(e) => {
                    warn!(code = "INFRA-007", cycle_number, error = %e, "Failed to verify batch proposal signature");
                    return Err(e);
                }
            }
        } else {
            warn!(
                code = "INFRA-007",
                cycle_number,
                ?leader_id,
                "Leader public key not found in registry, REJECTING proposal"
            );
            return Err(Error::BlsVerification(
                format!("Leader {:?} not found in key registry -- refusing to sign", leader_id)
            ));
        }

        // Validate the batch
        // 1. Verify order_ids are not empty (basic sanity check)
        if order_ids.is_empty() && fills.is_empty() {
            warn!(code = "INFRA-007", cycle_number, "Empty batch proposal received");
            // Still sign empty batches - they're valid for cycles with no orders
        }

        // 2. Verify fills have valid structure (non-zero amounts, prices)
        for fill in &fills {
            if fill.fill_amount.is_zero() {
                warn!(
                    code = "INFRA-007",
                    cycle_number,
                    order_id = %fill.order_id,
                    "Fill with zero amount in batch proposal"
                );
                return Err(Error::BlsVerification(
                    "Fill with zero amount in batch proposal".to_string(),
                ));
            }
            if fill.fill_price.is_zero() {
                warn!(
                    code = "INFRA-007",
                    cycle_number,
                    order_id = %fill.order_id,
                    "Fill with zero price in batch proposal"
                );
                return Err(Error::BlsVerification(
                    "Fill with zero price in batch proposal".to_string(),
                ));
            }
        }

        // 3. Verify fill order_ids match the proposed order_ids
        for fill in &fills {
            let fill_order_id = fill.order_id.as_u64();
            if !order_ids.contains(&fill_order_id) {
                warn!(
                    code = "INFRA-007",
                    cycle_number,
                    order_id = fill_order_id,
                    "Fill references order not in batch"
                );
                return Err(Error::BlsVerification(format!(
                    "Fill references order {} not in batch",
                    fill_order_id
                )));
            }
        }

        // 4. Verify fills against on-chain MockBitgetVault if verifier is set (FR13)
        if let Some(ref verifier) = self.fill_verifier {
            for fill in &fills {
                let trade_id = fill.order_id.as_u64();
                match verifier.get_fill(trade_id).await {
                    Ok(Some(on_chain_fill)) => {
                        // Verify amounts match (allowing some tolerance for rounding)
                        let amount_match = on_chain_fill.sell_amount == fill.fill_amount
                            || on_chain_fill.buy_amount == fill.fill_amount;
                        if !amount_match {
                            warn!(
                                code = "INFRA-007",
                                cycle_number,
                                order_id = trade_id,
                                on_chain_sell = %on_chain_fill.sell_amount,
                                on_chain_buy = %on_chain_fill.buy_amount,
                                proposed_amount = %fill.fill_amount,
                                "On-chain fill amount mismatch"
                            );
                            return Err(Error::BlsVerification(format!(
                                "On-chain fill amount mismatch for order {}",
                                trade_id
                            )));
                        }
                        debug!(
                            order_id = trade_id,
                            "Fill verified against on-chain MockBitgetVault (FR13)"
                        );
                    }
                    Ok(None) => {
                        warn!(
                            code = "INFRA-007",
                            cycle_number,
                            order_id = trade_id,
                            "Fill not found on-chain in MockBitgetVault"
                        );
                        return Err(Error::BlsVerification(format!(
                            "Fill for order {} not found on-chain",
                            trade_id
                        )));
                    }
                    Err(e) => {
                        warn!(
                            code = "INFRA-007",
                            cycle_number,
                            order_id = trade_id,
                            error = %e,
                            "Failed to verify fill on-chain"
                        );
                        // Don't fail the batch for read errors - log warning and continue
                        // This allows graceful degradation if the vault is unreachable
                    }
                }
            }
        }

        debug!(
            cycle_number,
            order_count = order_ids.len(),
            fill_count = fills.len(),
            "Batch proposal validated, signing"
        );

        // Sign with on-chain-compatible hash (already computed above as hash_bytes)
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)?;

        // Send signature to leader
        let message = P2PMessage::BatchSign {
            cycle_number,
            signer_id: self.config.peer_id,
            signature: BLSSignature(signature.0),
        };

        debug!(cycle_number, "Sending BatchSign to leader");
        self.p2p.send_to(leader_id, message).await?;

        // Advance follower state to Complete — we've done everything we can
        // (validated + signed + sent). No need to wait for leader aggregation.
        {
            let mut state = self.state.write().await;
            if let Some(round) = state.current_round_mut() {
                round.set_phase(ConsensusPhase::Complete);
            }
        }

        Ok(())
    }

    // =========================================================================
    // ITP Creation Phase (Story 6.21)
    // =========================================================================

    /// Run ITP creation consensus for a pending request
    ///
    /// This is called when a `CreateItpRequested` event is detected from the Settlement chain's
    /// BridgeProxy contract. The leader creates the ITP on L3, then coordinates
    /// BLS signature collection from followers.
    ///
    /// # Arguments
    /// * `request` - The pending ITP creation request from the Settlement chain
    /// * `itp_config` - ITP creation configuration (chain_id, bridge_proxy, timeouts)
    /// * `am_leader` - Whether this node is the current leader
    ///
    /// # Returns
    /// `ItpCreationResult` with aggregated signature and ITP ID on success
    pub async fn run_itp_creation_phase(
        &self,
        request: &crate::chain::events::ItpCreationRequest,
        itp_config: &ItpCreationConfig,
        am_leader: bool,
    ) -> Result<ItpCreationResult, ItpCreationError> {
        info!(
            nonce = %request.nonce,
            admin = ?request.admin,
            name = %request.name,
            am_leader,
            "Starting ITP creation consensus"
        );

        // Reset aggregator for this ITP creation
        {
            let mut aggregator = self.aggregator.write().await;
            aggregator.reset();
        }

        if am_leader {
            self.run_itp_creation_as_leader(request, itp_config).await
        } else {
            self.run_itp_creation_as_follower(request, itp_config).await
        }
    }

    /// Leader: Propose ITP creation and collect signatures
    ///
    /// With atomic creation, the leader does NOT call createITP on L3.
    /// Instead, BridgeProxy.completeCreateItp() atomically calls Index.createITP().
    /// The leader only needs to collect BLS signatures over the request params.
    async fn run_itp_creation_as_leader(
        &self,
        request: &crate::chain::events::ItpCreationRequest,
        itp_config: &ItpCreationConfig,
    ) -> Result<ItpCreationResult, ItpCreationError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(
            nonce = %request.nonce,
            name = %request.name,
            "Leader: Building ITP creation proposal (atomic flow)"
        );

        // Step 1: Build message hash for BLS signing
        // Uses weightsHash + assetsHash (orbitItpId is created atomically by BridgeProxy)
        let weights_hash = compute_weights_hash(&request.weights);
        let assets_hash = compute_assets_hash(&request.assets);
        let message_hash = build_message_hash(
            itp_config.settlement_chain_id,
            itp_config.bridge_proxy_address,
            request.admin,
            request.nonce,
            weights_hash,
            assets_hash,
        );

        // Step 2: Sign with our own key
        // Use sign_message_hash since message_hash is already keccak256'd
        let hash_bytes: [u8; 32] = message_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        // Add our signature to aggregator using real peer_id (generated by generate_peer_id).
        {
            let mut aggregator = self.aggregator.write().await;
            aggregator
                .add_signature(self.config.peer_id, self.runtime_config.issuer_registry_index(), signature.clone())
                .map_err(|e| ConsensusError::BlsSigningError {
                    reason: e.to_string(),
                })?;
        }

        // Step 3: Broadcast ItpCreationProposal (include leader_id for routing)
        let message = P2PMessage::ItpCreationProposal {
            leader_id: self.config.peer_id,
            admin: request.admin,
            nonce: request.nonce,
            name: request.name.clone(),
            symbol: request.symbol.clone(),
            weights: request.weights.clone(),
            assets: request.assets.clone(),
            leader_signature: signature,
            reference_nonce: ref_nonce,
        };

        self.p2p
            .broadcast(message)
            .await
            .map_err(|e| ItpCreationError::L3CreationFailed {
                reason: format!("Failed to broadcast proposal: {}", e),
            })?;

        // Step 4: Collect signatures with timeout
        let result = self
            .collect_itp_creation_signatures(
                request.nonce,
                itp_config.sign_timeout_ms,
                itp_config.min_signatures,
            )
            .await?;

        info!(
            nonce = %request.nonce,
            signer_count = result.signature_count,
            "Leader: ITP creation consensus achieved"
        );

        Ok(result)
    }

    /// Collect ITP creation signatures from followers
    async fn collect_itp_creation_signatures(
        &self,
        nonce: U256,
        timeout_ms: u64,
        min_signatures: usize,
    ) -> Result<ItpCreationResult, ItpCreationError> {
        let deadline =
            tokio::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);

        loop {
            if tokio::time::Instant::now() >= deadline {
                let aggregator = self.aggregator.read().await;
                let count = aggregator.collected_count();
                if count >= min_signatures {
                    break;
                }
                return Err(ConsensusError::SigningTimeout {
                    received: count,
                    timeout_ms,
                }
                .into());
            }

            // Check if threshold reached
            {
                let aggregator = self.aggregator.read().await;
                if aggregator.collected_count() >= min_signatures {
                    break;
                }
            }

            sleep(std::time::Duration::from_millis(2)).await;
        }

        // Aggregate signatures and compute signer bitmap + aggregated pubkey
        let aggregator = self.aggregator.read().await;
        let signature_map = aggregator.get_signatures();
        let signer_count = signature_map.len();

        // Collect signatures and compute signer bitmap
        let mut signatures = Vec::with_capacity(signer_count);
        let mut signer_pubkeys = Vec::with_capacity(signer_count);
        let mut signer_bitmap = U256::zero();

        for (peer_id, signature) in signature_map.iter() {
            signatures.push(signature.clone());

            // Extract issuer ID from peer_id (inverse of generate_peer_id)
            let issuer_index = extract_issuer_id(peer_id);
            signer_bitmap = signer_bitmap | (U256::one() << issuer_index);

            // Get pubkey from key registry
            if let Some(pubkey) = self.key_registry.get_public_key(peer_id) {
                signer_pubkeys.push(pubkey);
            }
        }

        // Aggregate signatures
        let aggregated_sig = self
            .bls_signer
            .aggregate_signatures(signatures)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        // Aggregate public keys (G2 addition, done off-chain)
        let aggregated_pubkey = aggregate_pubkeys(&signer_pubkeys).map_err(|e| {
            ConsensusError::BlsSigningError {
                reason: format!("Failed to aggregate pubkeys: {}", e),
            }
        })?;

        Ok(ItpCreationResult {
            nonce,
            signer_bitmap,
            aggregated_pubkey: aggregated_pubkey.0,
            aggregated_signature: aggregated_sig.0,
            signature_count: signer_count,
        })
    }

    /// Follower: Wait for proposal and sign
    async fn run_itp_creation_as_follower(
        &self,
        request: &crate::chain::events::ItpCreationRequest,
        itp_config: &ItpCreationConfig,
    ) -> Result<ItpCreationResult, ItpCreationError> {
        debug!(
            nonce = %request.nonce,
            "Follower: Waiting for ITP creation proposal"
        );

        // Followers participate via handle_itp_creation_proposal when they receive
        // the ItpCreationProposal message. This method is a placeholder that waits
        // for the result to be confirmed via chain events.
        //
        // The actual signing happens in handle_itp_creation_proposal_as_follower
        // which is called from handle_message.

        // Return a placeholder result - followers don't drive the consensus
        Ok(ItpCreationResult {
            nonce: request.nonce,
            signer_bitmap: U256::zero(),
            aggregated_pubkey: vec![],
            aggregated_signature: vec![],
            signature_count: 0,
        })
    }

    /// Handle incoming ItpCreationProposal message (as follower)
    pub async fn handle_itp_creation_proposal(
        &self,
        from: PeerId,
        leader_id: PeerId,
        admin: Address,
        nonce: U256,
        name: String,
        symbol: String,
        weights: Vec<U256>,
        assets: Vec<Address>,
        leader_signature: BLSSignature,
        itp_config: &ItpCreationConfig,
        pending_request: Option<&crate::chain::events::ItpCreationRequest>,
    ) -> Result<(), Error> {
        info!(
            nonce = %nonce,
            "Follower: Received ITP creation proposal"
        );

        // Step 1: Verify the proposal matches the on-chain request
        if let Some(request) = pending_request {
            if !verify_proposal_matches_request(
                request, &admin, &nonce, &name, &symbol, &weights, &assets,
            ) {
                warn!(
                    code = "INFRA-007",
                    nonce = %nonce,
                    "ITP creation proposal does not match on-chain request"
                );
                return Err(Error::BlsVerification(
                    "Proposal does not match on-chain request".to_string(),
                ));
            }
        } else {
            warn!(
                code = "INFRA-007",
                nonce = %nonce,
                "No pending request found for ITP creation proposal"
            );
            // Continue anyway - the on-chain request may not be synced yet
        }

        // Step 2: Verify leader signature
        // Use verify_message_hash since message_hash is already keccak256'd
        let weights_hash = compute_weights_hash(&weights);
        let assets_hash = compute_assets_hash(&assets);
        if let Some(leader_pubkey) = self.key_registry.get_public_key(&leader_id) {
            let message_hash = build_message_hash(
                itp_config.settlement_chain_id,
                itp_config.bridge_proxy_address,
                admin,
                nonce,
                weights_hash,
                assets_hash,
            );

            let hash_bytes: [u8; 32] = message_hash.into();
            match self
                .bls_signer
                .verify_message_hash(&leader_pubkey, &hash_bytes, &leader_signature)
            {
                Ok(true) => {
                    debug!(nonce = %nonce, "Leader signature verified");
                }
                Ok(false) => {
                    warn!(
                        code = "INFRA-007",
                        nonce = %nonce,
                        "Invalid leader signature on ITP creation proposal"
                    );
                    return Err(Error::BlsVerification(
                        "Invalid leader signature on ITP creation proposal".to_string(),
                    ));
                }
                Err(e) => {
                    warn!(
                        code = "INFRA-007",
                        nonce = %nonce,
                        error = %e,
                        "Failed to verify leader signature"
                    );
                    return Err(e);
                }
            }
        } else {
            warn!(
                code = "INFRA-007",
                nonce = %nonce,
                ?leader_id,
                "Leader public key not found in registry, REJECTING proposal"
            );
            return Err(Error::BlsVerification(
                format!("Leader {:?} not found in key registry -- refusing to sign", leader_id)
            ));
        }

        // Step 3: Sign the same message
        // Use sign_message_hash since message_hash is already keccak256'd
        let message_hash = build_message_hash(
            itp_config.settlement_chain_id,
            itp_config.bridge_proxy_address,
            admin,
            nonce,
            weights_hash,
            assets_hash,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)?;

        // Step 4: Send signature to leader (include signer_id and signer_index for routing and bitmap)
        let message = P2PMessage::ItpCreationSign {
            signer_id: self.config.peer_id,
            signer_index: self.runtime_config.issuer_registry_index(),
            nonce,
            signature: BLSSignature(signature.0),
        };

        debug!(
            nonce = %nonce,
            signer_index = self.runtime_config.issuer_registry_index(),
            "Follower: Sending ITP creation signature to leader"
        );
        self.p2p.send_to(from, message).await
    }

    /// Handle incoming ItpCreationSign message (as leader)
    ///
    /// # Arguments
    /// * `from` - Signer's peer ID
    /// * `signer_index` - Signer's index in issuer set (for bitmap calculation)
    /// * `nonce` - Request nonce
    /// * `signature` - BLS signature
    pub async fn handle_itp_creation_sign(
        &self,
        from: PeerId,
        signer_index: u8,
        nonce: U256,
        signature: BLSSignature,
    ) -> Result<(), Error> {
        debug!(
            ?from,
            signer_index,
            issuer_id_from_peer = extract_issuer_id(&from),
            nonce = %nonce,
            "Leader: Received ITP creation signature"
        );

        // Add signature keyed by the real peer_id (generated by generate_peer_id).
        // signer_index extracted from peer_id for bitmask computation.
        let signer_idx = extract_issuer_id(&from) as u8;
        let mut aggregator = self.aggregator.write().await;
        aggregator.add_signature(from, signer_idx, signature)?;

        Ok(())
    }

    // =========================================================================
    // Bridge Settlement→L3 Phase (Story 7.9)
    // =========================================================================

    /// Run bridge Settlement→L3 consensus for a cross-chain order
    ///
    /// This is called when a `CrossChainOrderCreated` event is detected from the Settlement chain's
    /// SettlementBridgeCustody contract. The leader creates a bridge proposal, collects BLS
    /// signatures from followers, and executes the bridge (mint L3Usdc).
    ///
    /// # Arguments
    /// * `order` - The cross-chain order from the Settlement chain
    /// * `am_leader` - Whether this node is the current leader
    ///
    /// # Returns
    /// `BridgeResult` with aggregated signature on success
    pub async fn run_bridge_settlement_to_l3_phase(
        &self,
        order: &crate::chain::CrossChainOrder,
        am_leader: bool,
    ) -> Result<BridgeResult, BridgeError> {
        info!(
            order_id = %order.order_id,
            itp_id = ?order.itp_id,
            user = ?order.user,
            amount = %order.amount,
            am_leader,
            "Starting bridge Settlement→L3 consensus"
        );

        // Get bridge orchestrator reference
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Acquire write lock for the duration of the operation
        let orch = bridge_orch.write().await;

        // Check if already processed (replay protection)
        if orch.is_order_processed(&order.order_id).await {
            debug!(
                order_id = %order.order_id,
                "Order already processed, skipping"
            );
            return Err(BridgeError::AlreadyProcessed {
                order_id: order.order_id,
            });
        }

        if am_leader {
            drop(orch); // Release lock before async leader flow
            drop(bridge_orch_guard);
            self.run_bridge_settlement_to_l3_as_leader(order).await
        } else {
            // Follower just waits - actual signing happens via handle_message
            drop(orch);
            drop(bridge_orch_guard);
            self.run_bridge_settlement_to_l3_as_follower(order).await
        }
    }

    /// Leader: Create bridge proposal and collect signatures
    async fn run_bridge_settlement_to_l3_as_leader(
        &self,
        order: &crate::chain::CrossChainOrder,
    ) -> Result<BridgeResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(
            order_id = %order.order_id,
            "Leader: Creating bridge Settlement→L3 proposal"
        );

        // Get bridge orchestrator
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let orch = bridge_orch.read().await;
        let proposal = orch.propose_bridge_settlement_to_l3(order)?;
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection with leader's signature
        drop(orch);
        {
            let orch = bridge_orch.write().await;
            orch.start_signature_collection(order.order_id, leader_signature).await;
        }

        // Step 3: Broadcast proposal to followers via P2P
        let message = P2PMessage::BridgeSettlementToL3Proposal {
            leader_id: self.config.peer_id,
            order_id: order.order_id,
            itp_id: order.itp_id,
            user: order.user,
            amount: order.amount,
            deadline: order.deadline,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        drop(bridge_orch_guard); // Release before async P2P call

        self.p2p
            .broadcast(message)
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("Failed to broadcast bridge proposal: {}", e),
            })?;

        info!(
            order_id = %order.order_id,
            "Leader: Bridge proposal broadcast, collecting signatures"
        );

        // Step 4: Collect signatures with timeout
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };

        drop(bridge_orch_guard);

        let result = self
            .collect_bridge_signatures(
                order.order_id,
                config.sign_timeout_ms,
                config.min_signatures,
            )
            .await?;

        info!(
            order_id = %order.order_id,
            signer_count = result.signature_count,
            signer_bitmap = %result.signer_bitmap,
            "Leader: Bridge signature threshold reached"
        );

        // Step 5: Execute bridge (mint L3Usdc to IssuerCustody L3)
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let orch = bridge_orch.write().await;
        let tx_hash = orch.execute_bridge_settlement_to_l3(&proposal, &result).await?;

        info!(
            order_id = %order.order_id,
            tx_hash = ?tx_hash,
            "Leader: Bridge Settlement→L3 executed successfully"
        );

        Ok(result)
    }

    /// Follower: Wait for proposal and participate via message handler
    async fn run_bridge_settlement_to_l3_as_follower(
        &self,
        order: &crate::chain::CrossChainOrder,
    ) -> Result<BridgeResult, BridgeError> {
        debug!(
            order_id = %order.order_id,
            "Follower: Waiting for bridge Settlement→L3 proposal"
        );

        // Followers participate via handle_bridge_settlement_to_l3_proposal when they receive
        // the BridgeSettlementToL3Proposal message. This method is a placeholder that returns
        // a dummy result - the actual signing happens in handle_message.
        Ok(BridgeResult {
            aggregated_signature: BLSSignature(vec![]),
            signer_bitmap: U256::zero(),
            signature_count: 0,
        })
    }

    /// Collect bridge signatures from followers (Task 3)
    ///
    /// Event-driven: wakes instantly when a signature arrives via Notify,
    /// with a 10ms fallback poll to avoid races.
    async fn collect_bridge_signatures(
        &self,
        order_id: U256,
        timeout_ms: u64,
        min_signatures: usize,
    ) -> Result<BridgeResult, BridgeError> {
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);

        loop {
            // Check if threshold reached via orchestrator
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                let orch = bridge_orch.read().await;
                if let Some(result) = orch.check_threshold_reached(&order_id).await {
                    info!(
                        order_id = %order_id,
                        signature_count = result.signature_count,
                        "Bridge signature threshold reached"
                    );
                    return Ok(result);
                }

                // Check for timeout - query actual count for better diagnostics
                if tokio::time::Instant::now() >= deadline {
                    let received = orch.get_signature_count(&order_id).await.unwrap_or(0);
                    warn!(
                        order_id = %order_id,
                        timeout_ms,
                        min_signatures,
                        received,
                        "Bridge signature collection timed out"
                    );
                    return Err(ConsensusError::SigningTimeout {
                        received,
                        timeout_ms,
                    }
                    .into());
                }

                // Get notifier — wake instantly when a signature arrives
                let notifier = orch.get_notifier(&order_id).await;
                drop(orch);
                drop(bridge_orch_guard);

                let remaining = deadline - tokio::time::Instant::now();
                if let Some(notify) = notifier {
                    // Wait for signature arrival OR 10ms fallback OR timeout
                    tokio::select! {
                        _ = notify.notified() => {}
                        _ = sleep(std::time::Duration::from_millis(10).min(remaining)) => {}
                    }
                } else {
                    sleep(std::time::Duration::from_millis(10).min(remaining)).await;
                }
            } else {
                drop(bridge_orch_guard);
                if tokio::time::Instant::now() >= deadline {
                    warn!(
                        order_id = %order_id,
                        timeout_ms,
                        "Bridge signature collection timed out (no orchestrator)"
                    );
                    return Err(ConsensusError::SigningTimeout {
                        received: 0,
                        timeout_ms,
                    }
                    .into());
                }
                sleep(std::time::Duration::from_millis(2)).await;
            }
        }
    }

    // =========================================================================
    // Story 7.3/7.4: Submit Order and Batch/Fill Phase Methods
    // These methods chain after bridge Settlement→L3 to complete the buy flow
    // =========================================================================

    /// Run submit order phase - submits bridged order on L3 (Story 7.3)
    ///
    /// After bridge Settlement→L3 completes (order status: BridgedToL3), this submits
    /// the order to the Index contract on L3 via BLSCustody.execute().
    ///
    /// # Returns
    /// `SubmitOrderResult` with L3 order ID and aggregated signature
    pub async fn run_submit_order_phase(
        &self,
        order: &crate::chain::CrossChainOrder,
        am_leader: bool,
    ) -> Result<SubmitOrderResult, BridgeError> {
        info!(
            order_id = %order.order_id,
            am_leader,
            "Starting submit order consensus (Story 7.3)"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        if am_leader {
            drop(bridge_orch_guard);
            self.run_submit_order_as_leader(order).await
        } else {
            drop(bridge_orch_guard);
            // Follower participates via handle_submit_order_proposal
            Ok(SubmitOrderResult {
                l3_order_id: None,
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    /// Leader: Create submit order proposal and collect signatures
    async fn run_submit_order_as_leader(
        &self,
        order: &crate::chain::CrossChainOrder,
    ) -> Result<SubmitOrderResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(order_id = %order.order_id, "Leader: Creating submit order proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_submit_order(order).await?
        };
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_submit_order_signature_collection(order.order_id, leader_signature).await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::SubmitOrderForUserProposal {
            leader_id: self.config.peer_id,
            settlement_order_id: order.order_id,
            itp_id: order.itp_id,
            user: order.user,
            amount: order.amount,
            limit_price: order.limit_price,
            slippage_tier: U256::from(order.slippage_tier),
            deadline: order.deadline,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast submit order proposal: {}", e),
        })?;

        info!(order_id = %order.order_id, "Leader: Submit order proposal broadcast");

        // Step 4: Collect signatures
        let result = self.collect_submit_order_signatures(
            order.order_id,
            config.sign_timeout_ms,
            config.min_signatures,
        ).await?;

        info!(
            order_id = %order.order_id,
            signer_count = result.signature_count,
            "Leader: Submit order signature threshold reached"
        );

        // Step 5: Execute submitOrder on L3 Index contract
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        {
            let orch = bridge_orch.read().await;
            match orch.execute_submit_order(order).await {
                Ok(tx_hash) => {
                    info!(order_id = %order.order_id, ?tx_hash, "Leader: submitOrder executed on L3");
                }
                Err(e) => {
                    warn!(order_id = %order.order_id, error = %e, "Leader: submitOrder on L3 failed");
                    return Err(e);
                }
            }
        }

        // Mark order as submitted on L3
        let orch = bridge_orch.write().await;
        orch.mark_order_submitted_on_l3(order.order_id).await;

        // Read actual L3 order ID from the mapping stored by execute_submit_order
        let l3_order_id = orch.get_l3_order_id(&order.order_id).await;

        info!(
            order_id = %order.order_id,
            ?l3_order_id,
            "Leader: Submit order consensus completed"
        );

        Ok(SubmitOrderResult {
            l3_order_id,
            aggregated_signature: result.aggregated_signature,
            signer_bitmap: result.signer_bitmap,
            signature_count: result.signature_count,
        })
    }

    /// Collect submit order signatures from followers
    async fn collect_submit_order_signatures(
        &self,
        order_id: U256,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<SubmitOrderResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_submit_order_threshold_reached(&order_id).await,
            count: orch.get_submit_order_signature_count(&order_id).await.unwrap_or(0),
        })
    }

    /// Run batch confirmation phase - confirms batch of orders (Story 7.4)
    ///
    /// After orders are submitted on L3 (status: SubmittedOnL3), this confirms
    /// the batch via Index.confirmBatch() with BLS signature.
    pub async fn run_batch_confirm_phase(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        prices: Vec<U256>,
        am_leader: bool,
    ) -> Result<BatchResult, BridgeError> {
        info!(
            cycle_number,
            order_count = order_ids.len(),
            am_leader,
            "Starting batch confirmation consensus (Story 7.4)"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        if am_leader {
            drop(bridge_orch_guard);
            self.run_batch_confirm_as_leader(cycle_number, order_ids, prices).await
        } else {
            drop(bridge_orch_guard);
            Ok(BatchResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    /// Leader: Create batch proposal and collect signatures
    async fn run_batch_confirm_as_leader(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        prices: Vec<U256>,
    ) -> Result<BatchResult, BridgeError> {
        let ref_nonce = self.key_registry.registry_nonce();

        info!(cycle_number, order_count = order_ids.len(), "Leader: Creating batch proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_confirm_batch(cycle_number, order_ids.clone(), prices.clone())?
        };
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_batch_signature_collection(cycle_number, leader_signature).await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::ConfirmBatchProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            order_ids: order_ids.clone(),
            prices: prices.clone(),
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast batch proposal: {}", e),
        })?;

        // Step 4: Collect signatures
        let result = self.collect_batch_confirm_signatures(
            cycle_number,
            config.sign_timeout_ms,
        ).await?;

        info!(cycle_number, signer_count = result.signature_count, "Leader: Batch signature threshold reached");

        // Step 5: Execute confirmBatch on L3
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let orch = bridge_orch.write().await;
        let _tx_hash = orch.execute_confirm_batch(cycle_number, &order_ids, &result, ref_nonce).await?;
        // NOTE: Do NOT call mark_orders_batched here — order_ids are L3 IDs (not Arb IDs).
        // Status updates happen in main.rs using Arb IDs (submitted_orders) to avoid
        // namespace collisions in the order_status map.

        info!(cycle_number, "Leader: Batch confirmed on L3");

        Ok(result)
    }

    /// Collect batch confirmation signatures
    async fn collect_batch_confirm_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
    ) -> Result<BatchResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_batch_threshold_reached(cycle_number).await,
            count: orch.get_batch_signature_count(cycle_number).await.unwrap_or(0),
        })
    }

    // ========================================================================
    // Asset Trades Phase: Issuer-driven per-asset settlement
    // ========================================================================

    /// Run asset trades phase after batch confirmation.
    ///
    /// Decomposes ITP-level orders into per-asset trades, nets same assets across
    /// all ITPs in the cycle, then runs BLS consensus to emit AssetTradeRequest
    /// events on-chain for the AP to execute.
    ///
    /// # Arguments
    /// * `cycle_number` - Cycle for which batch was just confirmed
    /// * `orders` - (itp_id, side as u8, usdc_amount) for each order in the batch
    /// * `chain_reader` - Chain reader for fetching ITP inventory state
    /// * `am_leader` - Whether this node is the consensus leader
    pub async fn run_asset_trades_phase(
        &self,
        cycle_number: u64,
        orders: &[(H256, u8, U256)],
        chain_reader: &Arc<dyn common::traits::ChainReader>,
        am_leader: bool,
        quote_tokens: Option<&std::collections::HashMap<Address, Address>>,
    ) -> Result<AssetTradesResult, BridgeError> {
        info!(
            cycle_number,
            order_count = orders.len(),
            am_leader,
            "Starting asset trades phase (issuer decomposition + cross-ITP netting)"
        );

        if orders.is_empty() {
            info!(cycle_number, "No orders to decompose, skipping asset trades phase");
            return Ok(AssetTradesResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            });
        }

        // Step 1: Fetch ITP states for each unique ITP
        let mut itp_states = std::collections::HashMap::new();
        for (itp_id, _, _) in orders {
            if itp_states.contains_key(itp_id) {
                continue;
            }
            match chain_reader.get_itp_inventory_state((*itp_id).into()).await {
                Ok(state) => {
                    let inventory: Vec<(Address, U256)> = state.assets
                        .into_iter()
                        .zip(state.quantities.into_iter())
                        .collect();
                    itp_states.insert(*itp_id, ItpDecompState {
                        inventory,
                        nav: state.nav,
                    });
                    debug!(itp_id = ?itp_id, "Fetched ITP inventory state for decomposition");
                }
                Err(e) => {
                    warn!(itp_id = ?itp_id, error = %e, "Failed to fetch ITP state, skipping");
                }
            }
        }

        // Step 2: Fetch prices from the price fetcher for all assets in ITPs
        let all_assets: Vec<Address> = itp_states.values()
            .flat_map(|s| s.inventory.iter().map(|(addr, _)| *addr))
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        let mut prices_map = std::collections::HashMap::new();
        match self.price_fetcher.fetch_prices(&all_assets).await {
            Ok(fetched) => {
                for (i, price) in fetched.iter().enumerate() {
                    if i < all_assets.len() {
                        prices_map.insert(all_assets[i], price.price);
                    }
                }
                info!(
                    cycle_number,
                    price_count = prices_map.len(),
                    asset_count = all_assets.len(),
                    "Fetched asset prices for decomposition"
                );
            }
            Err(e) => {
                warn!(cycle_number, error = %e, "Failed to fetch prices for asset decomposition");
                return Err(ConsensusError::ChainWriterError {
                    reason: format!("Price fetch failed for asset trades: {}", e),
                }
                .into());
            }
        }

        // Step 3: Decompose + net (quote_tokens determines USDC vs USDT per asset)
        let trades = decompose_and_net_orders(orders, &itp_states, &prices_map, quote_tokens);

        info!(
            cycle_number,
            input_orders = orders.len(),
            output_trades = trades.len(),
            "Cross-ITP netting complete"
        );

        if trades.is_empty() {
            info!(cycle_number, "All assets fully netted, no external trades needed");
            return Ok(AssetTradesResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            });
        }

        // Step 4: BLS consensus
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        if am_leader {
            drop(bridge_orch_guard);
            self.run_asset_trades_as_leader(cycle_number, trades).await
        } else {
            drop(bridge_orch_guard);
            // Follower: will sign via P2P message handler
            Ok(AssetTradesResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    /// Leader: propose asset trades, collect signatures, execute on-chain
    async fn run_asset_trades_as_leader(
        &self,
        cycle_number: u64,
        trades: Vec<AssetTrade>,
    ) -> Result<AssetTradesResult, BridgeError> {
        let ref_nonce = self.key_registry.registry_nonce();

        info!(cycle_number, trade_count = trades.len(), "Leader: Creating asset trades proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_asset_trades(cycle_number, trades.clone())?
        };
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_asset_trades_signature_collection(cycle_number, leader_signature).await;
        }

        // Step 3: Broadcast proposal
        let trades_data: Vec<(Address, u8, U256, U256, Address)> = trades.iter()
            .map(|t| (t.asset, t.side, t.usdc_amount, t.price, t.quote_token))
            .collect();

        let message = P2PMessage::AssetTradesProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            trades_data,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast asset trades proposal: {}", e),
        })?;

        // Step 4: Collect signatures
        let result = self.collect_asset_trades_signatures(
            cycle_number,
            config.sign_timeout_ms,
        ).await?;

        info!(cycle_number, signer_count = result.signature_count, "Leader: Asset trades signature threshold reached");

        // Step 5: Execute emitAssetTrades on L3
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let orch = bridge_orch.write().await;
        let _tx_hash = orch.execute_emit_asset_trades(cycle_number, &trades, &result, ref_nonce).await?;

        info!(cycle_number, "Leader: Asset trades emitted on L3");

        Ok(result)
    }

    /// Collect asset trades signatures until threshold or timeout
    async fn collect_asset_trades_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
    ) -> Result<AssetTradesResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_asset_trades_threshold_reached(cycle_number).await,
            count: orch.asset_trades_signature_count(cycle_number).await,
        })
    }

    /// Run fills confirmation phase - confirms fills for batched orders (Story 7.4)
    pub async fn run_fills_confirm_phase(
        &self,
        cycle_number: u64,
        fills: Vec<crate::bridge::Fill>,
        am_leader: bool,
    ) -> Result<FillsResult, BridgeError> {
        info!(
            cycle_number,
            fill_count = fills.len(),
            am_leader,
            "Starting fills confirmation consensus (Story 7.4)"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        if am_leader {
            drop(bridge_orch_guard);
            self.run_fills_confirm_as_leader(cycle_number, fills).await
        } else {
            drop(bridge_orch_guard);
            debug!(cycle = cycle_number, fills_count = fills.len(), "Follower: waiting for leader fills proposal");
            Ok(FillsResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    /// Leader: Create fills proposal and collect signatures
    async fn run_fills_confirm_as_leader(
        &self,
        cycle_number: u64,
        fills: Vec<crate::bridge::Fill>,
    ) -> Result<FillsResult, BridgeError> {
        let ref_nonce = self.key_registry.registry_nonce();

        info!(cycle_number, fill_count = fills.len(), "Leader: Creating fills proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_confirm_fills(cycle_number, fills.clone())?
        };
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_fills_signature_collection(cycle_number, leader_signature).await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::ConfirmFillsProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            fills: fills.iter().map(|f| common::types::OrderFill {
                order_id: f.order_id,
                fill_price: f.fill_price,
                fill_amount: f.fill_amount,
            }).collect(),
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast fills proposal: {}", e),
        })?;

        // Step 4: Collect signatures
        let result = self.collect_fills_confirm_signatures(
            cycle_number,
            config.sign_timeout_ms,
        ).await?;

        info!(cycle_number, signer_count = result.signature_count, "Leader: Fills signature threshold reached");

        // Step 5: Execute confirmFills on L3
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let orch = bridge_orch.write().await;
        let _tx_hash = orch.execute_confirm_fills(cycle_number, &fills, &result, ref_nonce).await?;

        info!(cycle_number, "Leader: Fills confirmed on L3");

        Ok(result)
    }

    /// Collect fills confirmation signatures
    async fn collect_fills_confirm_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
    ) -> Result<FillsResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_fills_threshold_reached(cycle_number).await,
            count: orch.get_fills_signature_count(cycle_number).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_bridge_settlement_to_l3_proposal,
        label = "bridge_settlement_to_l3",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, order_id: U256, itp_id: H256, user: Address, amount: U256, deadline: U256, leader_signature: BLSSignature),
        hash = |cfg| build_bridge_settlement_to_l3_hash(
            cfg.settlement_chain_id, order_id, itp_id, user, amount, deadline,
        ),
        validate = |orch, mh| orch.validate_bridge_proposal(&BridgeProposal {
            leader_id, order_id, itp_id, user, amount, deadline,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_bridge_proposal(&BridgeProposal {
            leader_id, order_id, itp_id, user, amount, deadline,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::BridgeSettlementToL3Sign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            order_id,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_bridge_settlement_to_l3_sign,
        label = "bridge_settlement_to_l3",
        key_param = (order_id: U256),
        add_sig = |orch, si, sig| orch.add_follower_signature(order_id, si, sig).await,
    );

    // =========================================================================
    // Story 7.10: Bridge L3→Settlement Phase Methods (Task 1)
    // =========================================================================

    /// Run bridge L3→Settlement consensus phase (Step 5 of vital-test.md)
    ///
    /// This method runs consensus for bridging USDC from L3 back to Settlement
    /// after batch confirmation. USDC goes to IssuerCustody on Settlement.
    ///
    /// # Arguments
    /// * `cycle_number` - The batch cycle number
    /// * `order_ids` - Order IDs included in this batch
    /// * `total_amount` - Total USDC amount to bridge (18 decimals internal format)
    /// * `am_leader` - Whether this node is the current leader
    ///
    /// # Returns
    /// `BridgeL3ToSettlementResult` with aggregated signature on success
    pub async fn run_bridge_l3_to_settlement_phase(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        total_amount: U256,
        am_leader: bool,
    ) -> Result<BridgeL3ToSettlementResult, BridgeError> {
        info!(
            cycle_number,
            order_count = order_ids.len(),
            total_amount = %total_amount,
            am_leader,
            "Starting bridge L3→Settlement consensus"
        );

        // Get bridge orchestrator reference
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Check if already processed (replay protection)
        {
            let orch = bridge_orch.read().await;
            if orch.is_l3_to_settlement_confirmed(cycle_number).await {
                debug!(
                    cycle_number,
                    "L3→Settlement bridge already processed for this cycle, skipping"
                );
                return Err(BridgeError::BridgeL3ToSettlementAlreadyProcessed { cycle_number });
            }
        }

        if am_leader {
            drop(bridge_orch_guard); // Release lock before async leader flow
            self.run_bridge_l3_to_settlement_as_leader(cycle_number, order_ids, total_amount)
                .await
        } else {
            // Follower just waits - actual signing happens via handle_message
            drop(bridge_orch_guard);
            self.run_bridge_l3_to_settlement_as_follower(cycle_number).await
        }
    }

    /// Leader: Create L3→Settlement bridge proposal and collect signatures
    async fn run_bridge_l3_to_settlement_as_leader(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        total_amount: U256,
    ) -> Result<BridgeL3ToSettlementResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(
            cycle_number,
            order_count = order_ids.len(),
            total_amount = %total_amount,
            "Leader: Creating bridge L3→Settlement proposal"
        );

        // Get bridge orchestrator
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal using non-deprecated method
        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_bridge_l3_to_settlement_with_amount(cycle_number, order_ids.clone(), total_amount)?
        };
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection with leader's signature
        {
            let orch = bridge_orch.write().await;
            orch.start_l3_to_settlement_signature_collection(cycle_number, leader_signature)
                .await;
        }

        // Step 3: Broadcast proposal to followers via P2P
        let message = P2PMessage::BridgeL3ToSettlementProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            order_ids: proposal.order_ids.clone(),
            total_amount: proposal.total_amount,
            destination: proposal.destination,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        drop(bridge_orch_guard); // Release before async P2P call

        self.p2p
            .broadcast(message)
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("Failed to broadcast L3→Settlement bridge proposal: {}", e),
            })?;

        info!(
            cycle_number,
            "Leader: L3→Settlement bridge proposal broadcast, collecting signatures"
        );

        // Step 4: Collect signatures with timeout
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };

        drop(bridge_orch_guard);

        let result = self
            .collect_l3_to_settlement_signatures(cycle_number, config.sign_timeout_ms, config.min_signatures)
            .await?;

        info!(
            cycle_number,
            signer_count = result.signature_count,
            signer_bitmap = %result.signer_bitmap,
            "Leader: L3→Settlement bridge signature threshold reached"
        );

        // Step 5: Execute bridge (transfer USDC to IssuerCustody Settlement)
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let orch = bridge_orch.write().await;
        let tx_hash = orch.execute_bridge_l3_to_settlement(&proposal, &result).await?;

        info!(
            cycle_number,
            tx_hash = ?tx_hash,
            "Leader: Bridge L3→Settlement executed successfully"
        );

        Ok(result)
    }

    /// Follower: Wait for L3→Settlement proposal and participate via message handler
    async fn run_bridge_l3_to_settlement_as_follower(
        &self,
        cycle_number: u64,
    ) -> Result<BridgeL3ToSettlementResult, BridgeError> {
        debug!(
            cycle_number,
            "Follower: Waiting for bridge L3→Settlement proposal"
        );

        // Followers participate via handle_bridge_l3_to_settlement_proposal when they receive
        // the BridgeL3ToSettlementProposal message. This method is a placeholder that returns
        // a dummy result - the actual signing happens in handle_message.
        Ok(BridgeL3ToSettlementResult {
            aggregated_signature: BLSSignature(vec![]),
            signer_bitmap: U256::zero(),
            signature_count: 0,
        })
    }

    /// Collect L3→Settlement bridge signatures from followers (Task 1.4)
    ///
    /// Polls the BridgeOrchestrator's signature collector until threshold is reached
    /// or timeout occurs.
    async fn collect_l3_to_settlement_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<BridgeL3ToSettlementResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_l3_to_settlement_threshold_reached(cycle_number).await,
            count: orch.get_l3_to_settlement_signature_count(cycle_number).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_bridge_l3_to_settlement_proposal,
        label = "bridge_l3_to_settlement",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, cycle_number: u64, order_ids: Vec<U256>, total_amount: U256, destination: Address, leader_signature: BLSSignature),
        hash = |cfg| build_bridge_l3_to_settlement_hash(
            cfg.l3_chain_id, cycle_number, &order_ids, total_amount, destination,
        ),
        validate = |orch, mh| orch.validate_bridge_l3_to_settlement_proposal(&BridgeL3ToSettlementProposal {
            leader_id, cycle_number, order_ids: order_ids.clone(), total_amount, destination,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_bridge_l3_to_settlement_proposal(&BridgeL3ToSettlementProposal {
            leader_id, cycle_number, order_ids: order_ids.clone(), total_amount, destination,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::BridgeL3ToSettlementSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            cycle_number,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_bridge_l3_to_settlement_sign,
        label = "bridge_l3_to_settlement",
        key_param = (cycle_number: u64),
        add_sig = |orch, si, sig| orch.add_l3_to_settlement_follower_signature(cycle_number, si, sig).await,
    );

    // =========================================================================
    // Story 7.10: Custody Release Phase Methods (Task 4)
    // =========================================================================

    /// Run custody release to vault consensus phase (Step 6 of vital-test.md)
    ///
    /// This method runs consensus for releasing USDC from IssuerCustody on Settlement
    /// to MockBitgetVault for AP trading.
    ///
    /// # Arguments
    /// * `cycle_number` - The batch cycle number
    /// * `order_ids` - Order IDs included in this batch
    /// * `total_amount` - Total USDC amount to release (18 decimals internal format)
    /// * `am_leader` - Whether this node is the current leader
    ///
    /// # Returns
    /// `ReleaseToVaultResult` with aggregated signature on success
    pub async fn run_release_to_vault_phase(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        total_amount: U256,
        am_leader: bool,
    ) -> Result<ReleaseToVaultResult, BridgeError> {
        info!(
            cycle_number,
            order_count = order_ids.len(),
            total_amount = %total_amount,
            am_leader,
            "Starting custody release to vault consensus"
        );

        // Get bridge orchestrator reference
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Check if already processed (replay protection)
        {
            let orch = bridge_orch.read().await;
            if orch.is_release_confirmed(cycle_number).await {
                debug!(
                    cycle_number,
                    "Custody release already processed for this cycle, skipping"
                );
                return Err(BridgeError::ReleaseAlreadyProcessed { cycle_number });
            }
        }

        if am_leader {
            drop(bridge_orch_guard); // Release lock before async leader flow
            self.run_release_to_vault_as_leader(cycle_number, order_ids, total_amount)
                .await
        } else {
            // Follower just waits - actual signing happens via handle_message
            drop(bridge_orch_guard);
            self.run_release_to_vault_as_follower(cycle_number).await
        }
    }

    /// Leader: Create custody release proposal and collect signatures
    async fn run_release_to_vault_as_leader(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        total_amount: U256,
    ) -> Result<ReleaseToVaultResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(
            cycle_number,
            order_count = order_ids.len(),
            total_amount = %total_amount,
            "Leader: Creating custody release to vault proposal"
        );

        // Get bridge orchestrator
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_release_to_vault(cycle_number, order_ids.clone(), total_amount)
                .await?
        };
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection with leader's signature
        {
            let orch = bridge_orch.write().await;
            orch.start_release_signature_collection(cycle_number, leader_signature)
                .await;
        }

        // Step 3: Broadcast proposal to followers via P2P
        let message = P2PMessage::ReleaseToVaultProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            order_ids: proposal.order_ids.clone(),
            total_amount: proposal.total_amount,
            vault_address: proposal.vault_address,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        drop(bridge_orch_guard); // Release before async P2P call

        self.p2p
            .broadcast(message)
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("Failed to broadcast custody release proposal: {}", e),
            })?;

        info!(
            cycle_number,
            "Leader: Custody release proposal broadcast, collecting signatures"
        );

        // Step 4: Collect signatures with timeout
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };

        drop(bridge_orch_guard);

        let result = self
            .collect_release_signatures(cycle_number, config.sign_timeout_ms, config.min_signatures)
            .await?;

        info!(
            cycle_number,
            signer_count = result.signature_count,
            signer_bitmap = %result.signer_bitmap,
            "Leader: Custody release signature threshold reached"
        );

        // Step 5: Execute custody release (transfer to MockBitgetVault)
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let orch = bridge_orch.write().await;
        let tx_hash = orch.execute_release_to_vault(&proposal, &result, ref_nonce).await?;

        info!(
            cycle_number,
            tx_hash = ?tx_hash,
            "Leader: Custody release to vault executed successfully - AP can now trade"
        );

        Ok(result)
    }

    /// Follower: Wait for custody release proposal and participate via message handler
    async fn run_release_to_vault_as_follower(
        &self,
        cycle_number: u64,
    ) -> Result<ReleaseToVaultResult, BridgeError> {
        debug!(
            cycle_number,
            "Follower: Waiting for custody release proposal"
        );

        // Followers participate via handle_release_to_vault_proposal when they receive
        // the ReleaseToVaultProposal message. This method is a placeholder that returns
        // a dummy result - the actual signing happens in handle_message.
        Ok(ReleaseToVaultResult {
            aggregated_signature: BLSSignature(vec![]),
            signer_bitmap: U256::zero(),
            signature_count: 0,
        })
    }

    /// Collect custody release signatures from followers (Task 4.4)
    ///
    /// Polls the BridgeOrchestrator's signature collector until threshold is reached
    /// or timeout occurs.
    async fn collect_release_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<ReleaseToVaultResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_release_threshold_reached(cycle_number).await,
            count: orch.get_release_signature_count(cycle_number).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_release_to_vault_proposal,
        label = "release_to_vault",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, cycle_number: u64, order_ids: Vec<U256>, total_amount: U256, vault_address: Address, leader_signature: BLSSignature),
        hash = |cfg| build_release_to_vault_hash(
            cfg.settlement_chain_id, cfg.issuer_custody_settlement, cycle_number, &order_ids, total_amount, vault_address,
        ),
        validate = |orch, mh| orch.validate_release_proposal(&ReleaseToVaultProposal {
            leader_id, cycle_number, order_ids: order_ids.clone(), total_amount, vault_address,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_release_proposal(&ReleaseToVaultProposal {
            leader_id, cycle_number, order_ids: order_ids.clone(), total_amount, vault_address,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::ReleaseToVaultSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            cycle_number,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_release_to_vault_sign,
        label = "release_to_vault",
        key_param = (cycle_number: u64),
        add_sig = |orch, si, sig| orch.add_release_follower_signature(cycle_number, si, sig).await,
    );

    // =========================================================================
    // Story 7.3: Submit Order for User Handler Methods
    // =========================================================================

    bridge_proposal_handler!(
        handle_submit_order_proposal,
        label = "submit_order",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, settlement_order_id: U256, itp_id: H256, user: Address, amount: U256, limit_price: U256, slippage_tier: U256, deadline: U256, leader_signature: BLSSignature),
        hash = |cfg| build_submit_order_hash(
            cfg.l3_chain_id, settlement_order_id, itp_id, user, amount, limit_price, slippage_tier, deadline,
        ),
        validate = |orch, mh| orch.validate_submit_order_proposal(&SubmitOrderProposal {
            leader_id, settlement_order_id, itp_id, user, amount, limit_price, slippage_tier, deadline,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_submit_order_proposal(&SubmitOrderProposal {
            leader_id, settlement_order_id, itp_id, user, amount, limit_price, slippage_tier, deadline,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::SubmitOrderForUserSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            settlement_order_id,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_submit_order_sign,
        label = "submit_order",
        key_param = (settlement_order_id: U256),
        add_sig = |orch, si, sig| orch.add_submit_order_follower_signature(settlement_order_id, si, sig).await,
    );

    // =========================================================================
    // Story 7.4: Batch and Fill Confirmation Handler Methods
    // =========================================================================

    bridge_proposal_handler!(
        handle_confirm_batch_proposal,
        label = "confirm_batch",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, cycle_number: u64, order_ids: Vec<U256>, prices: Vec<U256>, leader_signature: BLSSignature),
        hash = |cfg| build_confirm_batch_hash(
            cfg.l3_chain_id, cfg.index_address, cycle_number, &order_ids,
        ),
        validate = |orch, mh| orch.validate_batch_proposal(&BatchProposal {
            leader_id, cycle_number, order_ids: order_ids.clone(), prices: prices.clone(),
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_batch_proposal(&BatchProposal {
            leader_id, cycle_number, order_ids: order_ids.clone(), prices: prices.clone(),
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::ConfirmBatchSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            cycle_number,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_confirm_batch_sign,
        label = "confirm_batch",
        key_param = (cycle_number: u64),
        add_sig = |orch, si, sig| orch.add_batch_follower_signature(cycle_number, si, sig).await,
    );

    bridge_proposal_handler!(
        handle_confirm_fills_proposal,
        label = "confirm_fills",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, cycle_number: u64, fills: Vec<crate::bridge::Fill>, leader_signature: BLSSignature),
        hash = |cfg| build_confirm_fills_hash(
            cfg.l3_chain_id, cfg.index_address, cycle_number, &fills,
        ),
        validate = |orch, mh| orch.validate_fills_proposal(&FillsProposal {
            leader_id, cycle_number, fills: fills.clone(),
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_fills_proposal(&FillsProposal {
            leader_id, cycle_number, fills: fills.clone(),
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::ConfirmFillsSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            cycle_number,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_confirm_fills_sign,
        label = "confirm_fills",
        key_param = (cycle_number: u64),
        add_sig = |orch, si, sig| orch.add_fills_follower_signature(cycle_number, si, sig).await,
    );

    // =========================================================================
    // Encoding helpers
    // =========================================================================

    /// Encode price proposal for signing
    fn encode_price_proposal(&self, cycle_number: u64, prices: &[(u32, U256)]) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"PRICE_PROPOSAL");
        bytes.extend_from_slice(&cycle_number.to_be_bytes());
        for (asset_idx, price) in prices {
            bytes.extend_from_slice(&asset_idx.to_be_bytes());
            let mut price_bytes = [0u8; 32];
            price.to_big_endian(&mut price_bytes);
            bytes.extend_from_slice(&price_bytes);
        }
        bytes
    }

    /// Encode price vote for signing
    fn encode_price_vote(&self, cycle_number: u64, approved: bool) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"PRICE_VOTE");
        bytes.extend_from_slice(&cycle_number.to_be_bytes());
        bytes.push(if approved { 1 } else { 0 });
        bytes
    }

    /// Encode batch proposal for signing
    fn encode_batch_proposal(
        &self,
        cycle_number: u64,
        order_ids: &[u64],
        fills: &[Fill],
    ) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"BATCH_PROPOSAL");
        bytes.extend_from_slice(&cycle_number.to_be_bytes());
        for id in order_ids {
            bytes.extend_from_slice(&id.to_be_bytes());
        }
        for fill in fills {
            let mut fill_bytes = [0u8; 32];
            fill.order_id.to_big_endian(&mut fill_bytes);
            bytes.extend_from_slice(&fill_bytes);
            fill.fill_price.to_big_endian(&mut fill_bytes);
            bytes.extend_from_slice(&fill_bytes);
            fill.fill_amount.to_big_endian(&mut fill_bytes);
            bytes.extend_from_slice(&fill_bytes);
        }
        bytes
    }

    // =========================================================================
    // Story 7-14: Rebalance Batch Consensus Phase (Task 4.2)
    // =========================================================================

    /// Run rebalance batch consensus phase
    ///
    /// This method runs consensus for confirming a rebalance batch on L3.
    ///
    /// # Arguments
    /// * `cycle_number` - The rebalance cycle number
    /// * `itp_ids` - ITP IDs included in this rebalance
    /// * `am_leader` - Whether this node is the current leader
    ///
    /// # Returns
    /// `RebalanceBatchResult` with aggregated signature on success
    pub async fn run_rebalance_batch_phase(
        &self,
        cycle_number: u64,
        itp_ids: Vec<H256>,
        am_leader: bool,
    ) -> Result<RebalanceBatchResult, BridgeError> {
        info!(
            cycle_number,
            itp_count = itp_ids.len(),
            am_leader,
            "Starting rebalance batch consensus"
        );

        // Get bridge orchestrator reference
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Check if already processed (replay protection)
        {
            let orch = bridge_orch.read().await;
            if orch.is_rebalance_batch_confirmed(cycle_number).await {
                debug!(
                    cycle_number,
                    "Rebalance batch already processed for this cycle, skipping"
                );
                return Err(BridgeError::ReleaseAlreadyProcessed { cycle_number });
            }
        }

        if am_leader {
            drop(bridge_orch_guard);
            self.run_rebalance_batch_as_leader(cycle_number, itp_ids)
                .await
        } else {
            drop(bridge_orch_guard);
            self.run_rebalance_batch_as_follower(cycle_number).await
        }
    }

    /// Leader: Create rebalance batch proposal and collect signatures
    async fn run_rebalance_batch_as_leader(
        &self,
        cycle_number: u64,
        itp_ids: Vec<H256>,
    ) -> Result<RebalanceBatchResult, BridgeError> {
        let ref_nonce = self.key_registry.registry_nonce();

        info!(
            cycle_number,
            itp_count = itp_ids.len(),
            "Leader: Creating rebalance batch proposal"
        );

        // Get bridge orchestrator
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let (_message_hash, leader_signature) = {
            let orch = bridge_orch.read().await;
            orch.propose_rebalance_batch(cycle_number, itp_ids.clone())
                .await?
        };

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_rebalance_batch_signature_collection(cycle_number, leader_signature.clone())
                .await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::RebalanceBatchProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            itp_ids: itp_ids.clone(),
            leader_signature,
            reference_nonce: ref_nonce,
        };

        drop(bridge_orch_guard);

        self.p2p
            .broadcast(message)
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("Failed to broadcast rebalance batch proposal: {}", e),
            })?;

        info!(
            cycle_number,
            "Leader: Rebalance batch proposal broadcast, collecting signatures"
        );

        // Step 4: Collect signatures with timeout
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };

        drop(bridge_orch_guard);

        self.collect_rebalance_batch_signatures(cycle_number, config.sign_timeout_ms, config.min_signatures)
            .await
    }

    /// Follower: Wait for rebalance batch proposal
    async fn run_rebalance_batch_as_follower(
        &self,
        cycle_number: u64,
    ) -> Result<RebalanceBatchResult, BridgeError> {
        debug!(
            cycle_number,
            "Follower: Waiting for rebalance batch proposal"
        );

        Ok(RebalanceBatchResult {
            aggregated_signature: BLSSignature(vec![]),
            signer_bitmap: U256::zero(),
            signature_count: 0,
        })
    }

    /// Collect rebalance batch signatures (leader)
    async fn collect_rebalance_batch_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<RebalanceBatchResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_rebalance_batch_threshold(cycle_number).await,
            count: orch.get_rebalance_batch_signature_count(cycle_number).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_rebalance_batch_proposal,
        label = "rebalance_batch",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, cycle_number: u64, itp_ids: Vec<H256>, leader_signature: BLSSignature),
        hash = |cfg| build_rebalance_batch_hash(
            cfg.l3_chain_id, cfg.index_address, cycle_number, &itp_ids,
        ),
        sign = |orch, _hb| orch.sign_rebalance_batch(cycle_number, &itp_ids),
        respond = |s, sig| P2PMessage::RebalanceBatchSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            cycle_number,
            signature: sig,
        },
    );

    bridge_sign_handler!(
        handle_rebalance_batch_sign,
        label = "rebalance_batch",
        key_param = (cycle_number: u64),
        add_sig = |orch, si, sig| orch.add_rebalance_batch_follower_signature(cycle_number, si, sig).await,
    );

    // =========================================================================
    // Story 7-14: Update Weights Consensus Phase (Task 4.3)
    // =========================================================================

    /// Run update weights consensus phase
    ///
    /// Called once per ITP after rebalance batch confirms.
    ///
    /// # Arguments
    /// * `itp_id` - The ITP ID to update weights for
    /// * `new_weights` - The new target weights
    /// * `am_leader` - Whether this node is the current leader
    ///
    /// # Returns
    /// `UpdateWeightsResult` with aggregated signature on success
    pub async fn run_update_weights_phase(
        &self,
        itp_id: H256,
        new_weights: Vec<U256>,
        new_inventory: Vec<U256>,
        nav: U256,
        am_leader: bool,
    ) -> Result<UpdateWeightsResult, BridgeError> {
        info!(
            itp_id = ?itp_id,
            weight_count = new_weights.len(),
            am_leader,
            "Starting update weights consensus"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Check if already processed
        {
            let orch = bridge_orch.read().await;
            if orch.is_weights_updated(&itp_id).await {
                debug!(
                    itp_id = ?itp_id,
                    "Weights already updated for this ITP, skipping"
                );
                return Err(ConsensusError::ChainWriterError {
                    reason: format!("Weights already updated for ITP {}", itp_id),
                }
                .into());
            }
        }

        if am_leader {
            drop(bridge_orch_guard);
            self.run_update_weights_as_leader(itp_id, new_weights, new_inventory, nav)
                .await
        } else {
            drop(bridge_orch_guard);
            self.run_update_weights_as_follower(itp_id).await
        }
    }

    /// Leader: Create update weights proposal and collect signatures
    async fn run_update_weights_as_leader(
        &self,
        itp_id: H256,
        new_weights: Vec<U256>,
        new_inventory: Vec<U256>,
        nav: U256,
    ) -> Result<UpdateWeightsResult, BridgeError> {
        let ref_nonce = self.key_registry.registry_nonce();

        info!(
            itp_id = ?itp_id,
            weight_count = new_weights.len(),
            "Leader: Creating update weights proposal"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let (_message_hash, leader_signature) = {
            let orch = bridge_orch.read().await;
            orch.propose_update_weights(itp_id, &new_weights, &new_inventory, nav).await?
        };

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_update_weights_signature_collection(itp_id, leader_signature.clone())
                .await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::UpdateWeightsProposal {
            leader_id: self.config.peer_id,
            itp_id,
            new_weights: new_weights.clone(),
            new_inventory: new_inventory.clone(),
            nav,
            leader_signature,
            reference_nonce: ref_nonce,
        };

        drop(bridge_orch_guard);

        self.p2p
            .broadcast(message)
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("Failed to broadcast update weights proposal: {}", e),
            })?;

        info!(
            itp_id = ?itp_id,
            "Leader: Update weights proposal broadcast, collecting signatures"
        );

        // Step 4: Collect signatures with timeout
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };

        drop(bridge_orch_guard);

        self.collect_update_weights_signatures(itp_id, config.sign_timeout_ms, config.min_signatures)
            .await
    }

    /// Follower: Wait for update weights proposal
    async fn run_update_weights_as_follower(
        &self,
        itp_id: H256,
    ) -> Result<UpdateWeightsResult, BridgeError> {
        debug!(
            itp_id = ?itp_id,
            "Follower: Waiting for update weights proposal"
        );

        Ok(UpdateWeightsResult {
            aggregated_signature: BLSSignature(vec![]),
            signer_bitmap: U256::zero(),
            signature_count: 0,
        })
    }

    /// Collect update weights signatures (leader)
    async fn collect_update_weights_signatures(
        &self,
        itp_id: H256,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<UpdateWeightsResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_update_weights_threshold(itp_id).await,
            count: orch.get_update_weights_signature_count(&itp_id).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_update_weights_proposal,
        label = "update_weights",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, itp_id: H256, new_weights: Vec<U256>, new_inventory: Vec<U256>, nav: U256, leader_signature: BLSSignature),
        hash = |cfg| build_update_weights_hash(
            cfg.l3_chain_id, cfg.index_address, itp_id, &new_weights, &new_inventory, nav,
        ),
        sign = |orch, _hb| orch.sign_update_weights(itp_id, &new_weights, &new_inventory, nav),
        respond = |s, sig| P2PMessage::UpdateWeightsSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            itp_id,
            signature: sig,
        },
    );

    bridge_sign_handler!(
        handle_update_weights_sign,
        label = "update_weights",
        key_param = (itp_id: H256),
        add_sig = |orch, si, sig| orch.add_update_weights_follower_signature(itp_id, si, sig).await,
    );

    // =========================================================================
    // Single-Phase Rebalance Consensus (replaces 2-phase for on-chain call)
    // =========================================================================

    /// Run single-phase rebalance consensus
    ///
    /// Signs and submits Index.rebalance(itpId, removeIndices, addAssets, newWeights, prices, blsSig)
    pub async fn run_rebalance_phase(
        &self,
        itp_id: H256,
        remove_indices: Vec<U256>,
        add_assets: Vec<Address>,
        new_weights: Vec<U256>,
        prices: Vec<U256>,
        quote_tokens: Vec<Address>,
        am_leader: bool,
    ) -> Result<RebalanceResult, BridgeError> {
        info!(
            itp_id = ?itp_id,
            weight_count = new_weights.len(),
            price_count = prices.len(),
            am_leader,
            "Starting single-phase rebalance consensus"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Check if already processed
        {
            let orch = bridge_orch.read().await;
            if orch.is_weights_updated(&itp_id).await {
                debug!(itp_id = ?itp_id, "Rebalance already executed for this ITP, skipping");
                return Err(ConsensusError::ChainWriterError {
                    reason: format!("Rebalance already executed for ITP {}", itp_id),
                }
                .into());
            }
        }

        if am_leader {
            drop(bridge_orch_guard);
            self.run_rebalance_as_leader(itp_id, remove_indices, add_assets, new_weights, prices, quote_tokens).await
        } else {
            drop(bridge_orch_guard);
            self.run_rebalance_as_follower(itp_id).await
        }
    }

    /// Leader: Create rebalance proposal and collect signatures
    async fn run_rebalance_as_leader(
        &self,
        itp_id: H256,
        remove_indices: Vec<U256>,
        add_assets: Vec<Address>,
        new_weights: Vec<U256>,
        prices: Vec<U256>,
        quote_tokens: Vec<Address>,
    ) -> Result<RebalanceResult, BridgeError> {
        let ref_nonce = self.key_registry.registry_nonce();

        info!(itp_id = ?itp_id, "Leader: Creating rebalance proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let (_message_hash, leader_signature) = {
            let orch = bridge_orch.read().await;
            orch.propose_rebalance(itp_id, &remove_indices, &add_assets, &new_weights, &prices, &quote_tokens).await?
        };

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_rebalance_signature_collection(itp_id, leader_signature.clone()).await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::RebalanceProposal {
            leader_id: self.config.peer_id,
            itp_id,
            remove_indices,
            add_assets,
            new_weights,
            prices,
            quote_tokens,
            leader_signature,
            reference_nonce: ref_nonce,
        };

        drop(bridge_orch_guard);

        self.p2p
            .broadcast(message)
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("Failed to broadcast rebalance proposal: {}", e),
            })?;

        info!(itp_id = ?itp_id, "Leader: Rebalance proposal broadcast, collecting signatures");

        // Step 4: Collect signatures
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };

        drop(bridge_orch_guard);

        self.collect_rebalance_signatures(itp_id, config.sign_timeout_ms, config.min_signatures).await
    }

    /// Follower: return empty result (follower signs via handle_rebalance_proposal)
    async fn run_rebalance_as_follower(
        &self,
        itp_id: H256,
    ) -> Result<RebalanceResult, BridgeError> {
        debug!(itp_id = ?itp_id, "Follower: Waiting for rebalance proposal");
        Ok(RebalanceResult {
            aggregated_signature: BLSSignature(vec![]),
            signer_bitmap: U256::zero(),
            signature_count: 0,
        })
    }

    /// Collect rebalance signatures (leader)
    async fn collect_rebalance_signatures(
        &self,
        itp_id: H256,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<RebalanceResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_rebalance_threshold(itp_id).await,
            count: orch.get_rebalance_signature_count(&itp_id).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_rebalance_proposal,
        label = "rebalance",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, itp_id: H256, remove_indices: Vec<U256>, add_assets: Vec<Address>,
                  new_weights: Vec<U256>, prices: Vec<U256>, quote_tokens: Vec<Address>, leader_signature: BLSSignature),
        hash = |cfg| build_rebalance_hash(
            cfg.l3_chain_id, cfg.index_address, itp_id,
            &remove_indices, &add_assets, &new_weights, &prices, &quote_tokens,
        ),
        direct_sign = true,
        respond = |s, sig| P2PMessage::RebalanceSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            itp_id,
            signature: sig,
        },
    );

    bridge_sign_handler!(
        handle_rebalance_sign,
        label = "rebalance",
        key_param = (itp_id: H256),
        add_sig = |orch, si, sig| orch.add_rebalance_signature(itp_id, si, sig).await,
    );

    // ============================================================================
    // setItpNav BLS Consensus (pre-rebalance NAV push)
    // ============================================================================

    /// Run setItpNav consensus phase before rebalance
    pub async fn run_set_itp_nav_phase(
        &self,
        itp_id: H256,
        nav: U256,
        am_leader: bool,
    ) -> Result<SetItpNavResult, BridgeError> {
        info!(
            itp_id = ?itp_id,
            nav = %nav,
            am_leader,
            "Starting setItpNav consensus phase"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;
        drop(bridge_orch_guard);

        if am_leader {
            self.run_set_itp_nav_as_leader(itp_id, nav).await
        } else {
            self.run_set_itp_nav_as_follower(itp_id).await
        }
    }

    /// Leader: Create setItpNav proposal and collect signatures
    async fn run_set_itp_nav_as_leader(
        &self,
        itp_id: H256,
        nav: U256,
    ) -> Result<SetItpNavResult, BridgeError> {
        let ref_nonce = self.key_registry.registry_nonce();

        info!(itp_id = ?itp_id, nav = %nav, "Leader: Creating setItpNav proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal (sign the nav hash)
        let (_message_hash, leader_signature) = {
            let orch = bridge_orch.read().await;
            orch.propose_set_itp_nav(itp_id, nav).await?
        };

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_nav_signature_collection(itp_id, leader_signature.clone()).await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::SetItpNavProposal {
            leader_id: self.config.peer_id,
            itp_id,
            nav,
            leader_signature,
            reference_nonce: ref_nonce,
        };

        drop(bridge_orch_guard);

        self.p2p
            .broadcast(message)
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("Failed to broadcast setItpNav proposal: {}", e),
            })?;

        info!(itp_id = ?itp_id, "Leader: setItpNav proposal broadcast, collecting signatures");

        // Step 4: Collect signatures
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };

        drop(bridge_orch_guard);

        self.collect_nav_signatures(itp_id, config.sign_timeout_ms, config.min_signatures).await
    }

    /// Follower: return empty result (follower signs via handle_set_itp_nav_proposal)
    async fn run_set_itp_nav_as_follower(
        &self,
        itp_id: H256,
    ) -> Result<SetItpNavResult, BridgeError> {
        debug!(itp_id = ?itp_id, "Follower: Waiting for setItpNav proposal");
        Ok(SetItpNavResult {
            aggregated_signature: BLSSignature(vec![]),
            signer_bitmap: U256::zero(),
            signature_count: 0,
        })
    }

    /// Collect setItpNav signatures (leader)
    async fn collect_nav_signatures(
        &self,
        itp_id: H256,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<SetItpNavResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_nav_threshold(itp_id).await,
            count: orch.get_nav_signature_count(&itp_id).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_set_itp_nav_proposal,
        label = "set_itp_nav",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, itp_id: H256, nav: U256, leader_signature: BLSSignature),
        hash = |cfg| build_set_itp_nav_hash(
            cfg.l3_chain_id, cfg.index_address, itp_id, nav,
        ),
        direct_sign = true,
        respond = |s, sig| P2PMessage::SetItpNavSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            itp_id,
            signature: sig,
        },
    );

    bridge_sign_handler!(
        handle_set_itp_nav_sign,
        label = "set_itp_nav",
        key_param = (itp_id: H256),
        add_sig = |orch, si, sig| orch.add_nav_signature(itp_id, si, sig).await,
    );

    // ============================================================================
    // NAV Oracle (ITPNAVOracle on Arb) — Phase 2B
    // ============================================================================

    /// Handle incoming NavOracleProposal message (as follower).
    /// Verifies leader's BLS signature on the oracle hash, signs it, and sends back.
    pub async fn handle_nav_oracle_proposal(
        &self,
        from: PeerId,
        leader_id: PeerId,
        itp_address: Address,
        oracle_address: Address,
        nav_price: U256,
        timestamp: u64,
        cycle_number: u64,
        chain_id: u64,
        _reference_nonce: u64,
        leader_signature: BLSSignature,
    ) -> Result<(), Error> {
        info!(?itp_address, nav_price = %nav_price, "Follower: Received NavOracleProposal");

        // Validate chain_id against own config (prevents cross-chain replay / misdirection)
        {
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                let orch = bridge_orch.read().await;
                let cfg = orch.config();
                if chain_id != cfg.settlement_chain_id {
                    warn!(
                        proposed_chain_id = chain_id,
                        expected_chain_id = cfg.settlement_chain_id,
                        "NavOracle: Rejecting proposal with wrong chain_id"
                    );
                    return Ok(());
                }
            }
        }

        // Compute oracle hash
        let message_hash = build_nav_oracle_hash(
            chain_id,
            oracle_address,
            itp_address,
            nav_price,
            timestamp,
            cycle_number,
        );
        // Verify leader's BLS signature
        self.verify_leader_bls(&leader_id, &message_hash, &leader_signature, "nav_oracle")?;

        // Sign the oracle hash with own BLS key
        let hash_bytes: [u8; 32] = message_hash.into();
        let signature = self.bls_signer.sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| Error::BlsVerification(format!("Failed to sign NavOracleProposal: {}", e)))?;

        // Send signature back to leader
        let message = P2PMessage::NavOracleSign {
            signer_id: self.config.peer_id,
            signer_index: self.runtime_config.issuer_registry_index(),
            itp_address,
            signature,
        };

        debug!(?itp_address, signer_index = self.runtime_config.issuer_registry_index(), "Follower: Sending NavOracleSign to leader");
        self.p2p.send_to(from, message).await
    }

    /// Handle incoming NavOracleSign message (as leader).
    /// Routes to BridgeOrchestrator's existing nav signature collection.
    pub async fn handle_nav_oracle_sign(
        &self,
        from: PeerId,
        signer_index: u8,
        itp_address: Address,
        signature: BLSSignature,
    ) -> Result<(), Error> {
        debug!(?from, signer_index, ?itp_address, "Leader: Received NavOracleSign");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = match bridge_orch_guard.as_ref() {
            Some(orch) => orch,
            None => {
                warn!(?itp_address, "BridgeOrchestrator not configured, ignoring NavOracleSign");
                return Ok(());
            }
        };

        // Use dedicated nav_oracle signature collection keyed by H256(itp_address)
        let itp_key = H256::from(itp_address);
        let orch = bridge_orch.write().await;
        match orch.add_nav_oracle_signature(itp_key, signer_index, signature).await {
            Ok(Some(result)) => {
                info!(?itp_address, signature_count = result.signature_count, "NavOracle signature threshold reached");
            }
            Ok(None) => {
                debug!(?itp_address, signer_index, "NavOracle signature added, threshold not yet reached");
            }
            Err(e) => {
                warn!(code = "INFRA-007", ?itp_address, error = %e, "Failed to add NavOracle signature");
            }
        }

        Ok(())
    }

    // ============================================================================
    // MirrorIssuerRegistry Sync (Step 12)
    // ============================================================================

    /// Handle incoming MirrorSyncProposal message (as follower).
    ///
    /// Verifies leader's BLS signature on the sync hash, verifies the proposed
    /// state matches L3 registry, then signs and broadcasts back.
    pub async fn handle_mirror_sync_proposal(
        &self,
        from: PeerId,
        leader_id: PeerId,
        nonce: u64,
        issuer_pubkeys: Vec<Vec<u8>>,
        issuer_ids: Vec<u64>,
        active_bitmask: U256,
        active_count: u64,
        threshold: u64,
        chain_id: u64,
        mirror_address: Address,
        reference_nonce: u64,
        leader_signature: BLSSignature,
    ) -> Result<(), Error> {
        info!(nonce, active_count, "Follower: Received MirrorSyncProposal");

        // Validate chain_id and mirror_address against own config
        {
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                let orch = bridge_orch.read().await;
                let cfg = orch.config();
                if chain_id != cfg.settlement_chain_id {
                    warn!(
                        proposed_chain_id = chain_id,
                        expected_chain_id = cfg.settlement_chain_id,
                        "MirrorSync: Rejecting proposal with wrong chain_id"
                    );
                    return Ok(());
                }
                if let Some(expected_mirror) = cfg.mirror_registry_address {
                    if mirror_address != expected_mirror {
                        warn!(
                            ?mirror_address,
                            ?expected_mirror,
                            "MirrorSync: Rejecting proposal with wrong mirror_address"
                        );
                        return Ok(());
                    }
                }
            }
        }

        // Compute the sync hash
        let message_hash = build_mirror_registry_sync_hash(
            chain_id,
            mirror_address,
            nonce,
            &issuer_pubkeys,
            &issuer_ids,
            active_bitmask,
            active_count,
            threshold,
        );

        // Verify leader's BLS signature
        self.verify_leader_bls(&leader_id, &message_hash, &leader_signature, "mirror_sync")?;

        // TODO: Verify proposed state matches L3 IssuerRegistry via chain_reader
        // Currently trusts leader's proposal after chain_id + address validation above.
        // Full L3 state verification should be added as defense-in-depth.

        // Sign the sync hash with own BLS key
        let hash_bytes: [u8; 32] = message_hash.into();
        let signature = self.bls_signer.sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| Error::BlsVerification(format!("Failed to sign MirrorSync: {}", e)))?;

        // Send signature back to leader
        let message = P2PMessage::MirrorSyncSign {
            signer_id: self.config.peer_id,
            signer_index: self.runtime_config.issuer_registry_index(),
            nonce,
            signature,
        };

        debug!(nonce, signer_index = self.runtime_config.issuer_registry_index(), "Follower: Sending MirrorSync signature to leader");
        self.p2p.send_to(from, message).await
    }

    /// Handle incoming MirrorSyncSign message (as leader).
    ///
    /// Routes to BridgeOrchestrator's nav_signatures collection using a
    /// dedicated key derived from the nonce.
    pub async fn handle_mirror_sync_sign(
        &self,
        from: PeerId,
        signer_index: u8,
        nonce: u64,
        signature: BLSSignature,
    ) -> Result<(), Error> {
        debug!(?from, signer_index, nonce, "Leader: Received MirrorSyncSign");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = match bridge_orch_guard.as_ref() {
            Some(orch) => orch,
            None => {
                warn!(nonce, "BridgeOrchestrator not configured, ignoring MirrorSyncSign");
                return Ok(());
            }
        };

        // Use dedicated mirror_sync signature collection keyed by H256(nonce)
        let sync_key = H256::from_low_u64_be(nonce);
        let orch = bridge_orch.write().await;
        match orch.add_mirror_sync_signature(sync_key, signer_index, signature).await {
            Ok(Some(result)) => {
                info!(nonce, signature_count = result.signature_count, "MirrorSync signature threshold reached");
            }
            Ok(None) => {
                debug!(nonce, signer_index, "MirrorSync signature added, threshold not yet reached");
            }
            Err(e) => {
                warn!(code = "INFRA-007", nonce, error = %e, "Failed to add MirrorSync signature");
            }
        }

        Ok(())
    }

    /// Leader-initiated: run MirrorIssuerRegistry sync BLS consensus.
    ///
    /// Called by the main loop when L3 nonce > mirror nonce. The caller is
    /// responsible for reading on-chain state and submitting the final tx.
    ///
    /// Returns the sync calldata for the caller to submit to Settlement.
    pub async fn run_mirror_sync_consensus(
        &self,
        l3_nonce: u64,
        issuer_pubkeys: Vec<Vec<u8>>,
        issuer_ids: Vec<u64>,
        active_bitmask: U256,
        active_count: u64,
        threshold: u64,
        settlement_chain_id: u64,
        mirror_registry_address: Address,
        reference_nonce: u64,
        min_signatures: usize,
    ) -> Result<Vec<u8>, Error> {
        // Step 1: Compute sync hash and sign
        let message_hash = build_mirror_registry_sync_hash(
            settlement_chain_id,
            mirror_registry_address,
            l3_nonce,
            &issuer_pubkeys,
            &issuer_ids,
            active_bitmask,
            active_count,
            threshold,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_sig = self.bls_signer.sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| Error::BlsVerification(format!("Failed to sign MirrorSync hash: {}", e)))?;

        // Initialize signature collection in bridge orchestrator (must use start_collection, not add_follower)
        {
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                let orch = bridge_orch.write().await;
                let sync_key = H256::from_low_u64_be(l3_nonce);
                orch.start_mirror_sync_signature_collection(sync_key, leader_sig.clone()).await;
            }
        }

        // Step 2: Broadcast MirrorSyncProposal to all peers
        let proposal = P2PMessage::MirrorSyncProposal {
            leader_id: self.config.peer_id,
            nonce: l3_nonce,
            issuer_pubkeys: issuer_pubkeys.clone(),
            issuer_ids: issuer_ids.clone(),
            active_bitmask,
            active_count,
            threshold,
            chain_id: settlement_chain_id,
            mirror_address: mirror_registry_address,
            reference_nonce,
            leader_signature: leader_sig,
        };

        self.p2p.broadcast(proposal).await?;

        // Step 3: Wait for threshold signatures
        let sync_key = H256::from_low_u64_be(l3_nonce);
        let timeout = self.config.timeouts.batch_sign_timeout.max(std::time::Duration::from_secs(10));
        let deadline = tokio::time::Instant::now() + timeout;

        let sync_result = loop {
            let bridge_orch_guard = self.bridge_orchestrator.read().await;
            if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                let orch = bridge_orch.read().await;
                if let Some(result) = orch.check_mirror_sync_threshold(sync_key, min_signatures).await {
                    info!(
                        nonce = l3_nonce,
                        signature_count = result.signature_count,
                        "MirrorSync signature threshold reached"
                    );
                    break result;
                }
            }
            drop(bridge_orch_guard);

            if tokio::time::Instant::now() >= deadline {
                warn!(
                    nonce = l3_nonce,
                    timeout_secs = ?timeout,
                    min_signatures,
                    "MirrorSync signature collection timed out"
                );
                return Err(Error::Timeout(format!(
                    "MirrorSync timeout: nonce={}, min_sig={}",
                    l3_nonce, min_signatures
                )));
            }

            sleep(std::time::Duration::from_millis(50)).await;
        };

        // Step 4: Build calldata for the caller to submit
        let calldata = build_mirror_registry_sync_calldata(
            &issuer_pubkeys,
            &issuer_ids,
            active_bitmask,
            active_count,
            threshold,
            l3_nonce,
            &sync_result.aggregated_signature.0,
            reference_nonce,
            sync_result.signer_bitmap,
        );

        info!(
            nonce = l3_nonce,
            signature_count = sync_result.signature_count,
            "MirrorSync consensus complete, returning calldata"
        );

        Ok(calldata)
    }

    // ============================================================================
    // Cross-Chain Sell Flow Consensus Methods
    // ============================================================================

    /// Run submit sell order phase (consensus to submit sell on L3)
    pub async fn run_submit_sell_order_phase(
        &self,
        order_id: U256,
        itp_id: H256,
        user: Address,
        bridged_itp_address: Address,
        amount: U256,
        am_leader: bool,
    ) -> Result<SellSubmitOrderResult, BridgeError> {
        info!(
            order_id = %order_id,
            am_leader,
            "Starting submit sell order consensus"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        if am_leader {
            drop(bridge_orch_guard);
            self.run_submit_sell_order_as_leader(order_id, itp_id, user, bridged_itp_address, amount).await
        } else {
            drop(bridge_orch_guard);
            // Follower participates via handle_submit_sell_order_proposal
            Ok(SellSubmitOrderResult {
                l3_order_id: None,
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    /// Leader: create submit sell order proposal and collect signatures
    async fn run_submit_sell_order_as_leader(
        &self,
        order_id: U256,
        itp_id: H256,
        user: Address,
        bridged_itp_address: Address,
        amount: U256,
    ) -> Result<SellSubmitOrderResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(order_id = %order_id, "Leader: Creating submit sell order proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_submit_sell_order(order_id, itp_id, user, bridged_itp_address, amount).await?
        };
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_submit_sell_order_signature_collection(order_id, leader_signature).await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::SubmitSellOrderProposal {
            leader_id: self.config.peer_id,
            order_id,
            itp_id,
            user,
            bridged_itp_address,
            amount,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast submit sell order proposal: {}", e),
        })?;

        info!(order_id = %order_id, "Leader: Submit sell order proposal broadcast");

        // Step 4: Collect signatures
        let result = self.collect_submit_sell_order_signatures(
            order_id,
            config.sign_timeout_ms,
            config.min_signatures,
        ).await?;

        info!(
            order_id = %order_id,
            signer_count = result.signature_count,
            "Leader: Submit sell order signature threshold reached"
        );

        // Step 5: Execute submitOrderFor(SELL) on L3 Index contract
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        {
            let orch = bridge_orch.read().await;
            match orch.execute_submit_sell_order(order_id, user, itp_id, amount).await {
                Ok(tx_hash) => {
                    info!(order_id = %order_id, ?tx_hash, "Leader: submitOrderFor(SELL) executed on L3");
                }
                Err(e) => {
                    warn!(order_id = %order_id, error = %e, "Leader: submitOrderFor(SELL) on L3 failed");
                    return Err(e);
                }
            }
        }

        // Mark as SellSubmittedOnL3
        {
            let orch = bridge_orch.write().await;
            orch.set_sell_order_status(order_id, crate::bridge::BridgeOrderStatus::SellSubmittedOnL3).await;
        }

        // Read actual L3 order ID
        let l3_order_id = {
            let orch = bridge_orch.read().await;
            orch.get_sell_l3_order_id(&order_id).await
        };

        info!(
            order_id = %order_id,
            ?l3_order_id,
            "Leader: Submit sell order consensus completed"
        );

        Ok(SellSubmitOrderResult {
            l3_order_id,
            aggregated_signature: result.aggregated_signature,
            signer_bitmap: result.signer_bitmap,
            signature_count: result.signature_count,
        })
    }

    /// Collect signatures for submit sell order
    async fn collect_submit_sell_order_signatures(
        &self,
        order_id: U256,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<SellSubmitOrderResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_submit_sell_order_threshold_reached(&order_id).await,
            count: orch.get_submit_sell_order_signature_count(&order_id).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_submit_sell_order_proposal,
        label = "submit_sell_order",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, order_id: U256, itp_id: H256, user: Address, bridged_itp_address: Address, amount: U256, leader_signature: BLSSignature),
        hash = |cfg| build_sell_bridge_hash(
            cfg.settlement_chain_id, order_id, itp_id, user, bridged_itp_address, amount,
        ),
        validate = |orch, mh| orch.validate_submit_sell_order_proposal(&SellBridgeProposal {
            leader_id, order_id, itp_id, user, bridged_itp_address, amount,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_submit_sell_order_proposal(&SellBridgeProposal {
            leader_id, order_id, itp_id, user, bridged_itp_address, amount,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::SubmitSellOrderSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            order_id,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_submit_sell_order_sign,
        label = "submit_sell_order",
        key_param = (order_id: U256),
        add_sig = |orch, si, sig| orch.add_submit_sell_order_follower_signature(order_id, si, sig).await,
    );

    // ========================================================================
    // Burn Sell Order Consensus (Task 4)
    // ========================================================================

    pub async fn run_burn_sell_order_phase(
        &self,
        order_id: U256,
        am_leader: bool,
    ) -> Result<BurnSellOrderResult, BridgeError> {
        info!(
            order_id = %order_id,
            am_leader,
            "Starting burn sell order consensus"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        if am_leader {
            drop(bridge_orch_guard);
            self.run_burn_sell_order_as_leader(order_id).await
        } else {
            drop(bridge_orch_guard);
            Ok(BurnSellOrderResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    async fn run_burn_sell_order_as_leader(
        &self,
        order_id: U256,
    ) -> Result<BurnSellOrderResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(order_id = %order_id, "Leader: Creating burn sell order proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_burn_sell_order(order_id).await?
        };
        let leader_signature = proposal.leader_signature.clone();

        {
            let orch = bridge_orch.write().await;
            orch.start_burn_sell_order_signature_collection(order_id, leader_signature).await;
        }

        let message = P2PMessage::BurnSellOrderProposal {
            leader_id: self.config.peer_id,
            order_id,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast burn sell order proposal: {}", e),
        })?;

        info!(order_id = %order_id, "Leader: Burn sell order proposal broadcast");

        let result = self.collect_burn_sell_order_signatures(
            order_id,
            config.sign_timeout_ms,
            config.min_signatures,
        ).await?;

        info!(
            order_id = %order_id,
            signer_count = result.signature_count,
            "Leader: Burn sell order signature threshold reached"
        );

        Ok(result)
    }

    async fn collect_burn_sell_order_signatures(
        &self,
        order_id: U256,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<BurnSellOrderResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_burn_sell_order_threshold_reached(&order_id).await,
            count: orch.get_burn_sell_order_signature_count(&order_id).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_burn_sell_order_proposal,
        label = "burn_sell_order",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, order_id: U256, leader_signature: BLSSignature),
        hash = |cfg| build_burn_sell_order_hash(
            cfg.settlement_chain_id, cfg.settlement_custody_address, order_id,
        ),
        validate = |orch, mh| orch.validate_burn_sell_order_proposal(&BurnSellOrderProposal {
            leader_id, order_id,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_burn_sell_order_proposal(&BurnSellOrderProposal {
            leader_id, order_id,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::BurnSellOrderSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            order_id,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_burn_sell_order_sign,
        label = "burn_sell_order",
        key_param = (order_id: U256),
        add_sig = |orch, si, sig| orch.add_burn_sell_order_follower_signature(order_id, si, sig).await,
    );

    // ---- Complete Sell Order Consensus ----

    /// Run complete sell order phase (consensus to call completeSellOrder on Arb)
    pub async fn run_complete_sell_order_phase(
        &self,
        order_id: U256,
        usdc_proceeds: U256,
        vault: Address,
        am_leader: bool,
    ) -> Result<CompleteSellOrderResult, BridgeError> {
        info!(
            order_id = %order_id,
            usdc_proceeds = %usdc_proceeds,
            ?vault,
            am_leader,
            "Starting complete sell order consensus"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        if am_leader {
            drop(bridge_orch_guard);
            self.run_complete_sell_order_as_leader(order_id, usdc_proceeds, vault).await
        } else {
            drop(bridge_orch_guard);
            // Follower participates via handle_complete_sell_order_proposal
            Ok(CompleteSellOrderResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    /// Leader: create complete sell order proposal and collect signatures
    async fn run_complete_sell_order_as_leader(
        &self,
        order_id: U256,
        usdc_proceeds: U256,
        vault: Address,
    ) -> Result<CompleteSellOrderResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(order_id = %order_id, usdc_proceeds = %usdc_proceeds, ?vault, "Leader: Creating complete sell order proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        // Step 1: Create proposal
        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_complete_sell_order(order_id, usdc_proceeds, vault).await?
        };
        let leader_signature = proposal.leader_signature.clone();

        // Step 2: Start signature collection
        {
            let orch = bridge_orch.write().await;
            orch.start_complete_sell_order_signature_collection(order_id, leader_signature).await;
        }

        // Step 3: Broadcast proposal
        let message = P2PMessage::CompleteSellOrderProposal {
            leader_id: self.config.peer_id,
            order_id,
            usdc_proceeds,
            vault,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast complete sell order proposal: {}", e),
        })?;

        info!(order_id = %order_id, "Leader: Complete sell order proposal broadcast");

        // Step 4: Collect signatures
        let result = self.collect_complete_sell_order_signatures(
            order_id,
            config.sign_timeout_ms,
            config.min_signatures,
        ).await?;

        info!(
            order_id = %order_id,
            signer_count = result.signature_count,
            "Leader: Complete sell order signature threshold reached"
        );

        Ok(result)
    }

    /// Collect signatures for complete sell order
    async fn collect_complete_sell_order_signatures(
        &self,
        order_id: U256,
        timeout_ms: u64,
        _min_signatures: usize,
    ) -> Result<CompleteSellOrderResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_complete_sell_order_threshold_reached(&order_id).await,
            count: orch.get_complete_sell_order_signature_count(&order_id).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_complete_sell_order_proposal,
        label = "complete_sell_order",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, order_id: U256, usdc_proceeds: U256, vault: Address, leader_signature: BLSSignature),
        hash = |cfg| build_complete_sell_order_consensus_hash(
            cfg.settlement_chain_id, cfg.settlement_custody_address, order_id, usdc_proceeds, vault,
        ),
        validate = |orch, mh| orch.validate_complete_sell_order_proposal(&CompleteSellProposal {
            leader_id, order_id, usdc_proceeds,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }).await,
        sign = |orch, mh| orch.sign_complete_sell_order_proposal(&CompleteSellProposal {
            leader_id, order_id, usdc_proceeds,
            leader_signature: leader_signature.clone(),
            message_hash: mh,
        }),
        respond = |s, sig| P2PMessage::CompleteSellOrderSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            order_id,
            signature: common::types::BLSSignature(sig.0),
        },
    );

    bridge_sign_handler!(
        handle_complete_sell_order_sign,
        label = "complete_sell_order",
        key_param = (order_id: U256),
        add_sig = |orch, si, sig| orch.add_complete_sell_order_follower_signature(order_id, si, sig).await,
    );

    // ========================================================================
    // 8-step bridge: RecordCollateralMove consensus phase
    // ========================================================================

    /// Run RecordCollateralMove consensus (Step 3 of 8-step bridge)
    pub async fn run_record_collateral_move_phase(
        &self,
        cycle_number: u64,
        itp_id: H256,
        from_chain: U256,
        to_chain: U256,
        amount: U256,
        tx_type: u8,
        collateral_registry: Address,
        am_leader: bool,
    ) -> Result<RecordCollateralMoveResult, BridgeError> {
        info!(
            cycle_number,
            itp_id = ?itp_id,
            amount = %amount,
            am_leader,
            "Starting RecordCollateralMove consensus (8-step bridge Step 3)"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        {
            let orch = bridge_orch.read().await;
            if orch.is_collateral_move_confirmed(cycle_number).await {
                return Err(BridgeError::CollateralMoveAlreadyRecorded { cycle_number });
            }
        }

        if am_leader {
            drop(bridge_orch_guard);
            self.run_record_collateral_move_as_leader(
                cycle_number, itp_id, from_chain, to_chain, amount, tx_type, collateral_registry,
            ).await
        } else {
            drop(bridge_orch_guard);
            Ok(RecordCollateralMoveResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    async fn run_record_collateral_move_as_leader(
        &self,
        cycle_number: u64,
        itp_id: H256,
        from_chain: U256,
        to_chain: U256,
        amount: U256,
        tx_type: u8,
        collateral_registry: Address,
    ) -> Result<RecordCollateralMoveResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(cycle_number, "Leader: Creating RecordCollateralMove proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_record_collateral_move(
                cycle_number, itp_id, from_chain, to_chain, amount, tx_type, collateral_registry,
            )?
        };
        let leader_signature = proposal.leader_signature.clone();

        {
            let orch = bridge_orch.write().await;
            orch.start_collateral_move_signature_collection(cycle_number, leader_signature).await;
        }

        let message = P2PMessage::RecordCollateralMoveProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            itp_id,
            from_chain,
            to_chain,
            amount,
            tx_type,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast RecordCollateralMove proposal: {}", e),
        })?;

        let result = self.collect_collateral_move_signatures(
            cycle_number, config.sign_timeout_ms,
        ).await?;

        info!(cycle_number, signer_count = result.signature_count, "Leader: RecordCollateralMove threshold reached");

        // Record as confirmed (the actual on-chain tx is done by the caller)
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
            let orch = bridge_orch.write().await;
            orch.confirm_collateral_move(cycle_number, H256::zero()).await;
        }

        Ok(result)
    }

    async fn collect_collateral_move_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
    ) -> Result<RecordCollateralMoveResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_collateral_move_threshold_reached(cycle_number).await,
            count: orch.get_collateral_move_signature_count(cycle_number).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_record_collateral_move_proposal,
        label = "record_collateral_move",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, cycle_number: u64, itp_id: H256, from_chain: U256,
                  to_chain: U256, amount: U256, tx_type: u8, leader_signature: BLSSignature),
        hash = |cfg| build_record_collateral_move_hash(
            cfg.l3_chain_id, cfg.collateral_registry,
            itp_id, from_chain, to_chain, amount, tx_type,
        ),
        validate = |orch, msg_hash| orch.validate_record_collateral_move_proposal(
            &RecordCollateralMoveProposal {
                leader_id, cycle_number, itp_id, from_chain, to_chain, amount, tx_type,
                leader_signature: leader_signature.clone(),
                message_hash: msg_hash,
            },
            orch.config().collateral_registry,
        ).await,
        direct_sign = true,
        respond = |s, sig| P2PMessage::RecordCollateralMoveSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            cycle_number,
            signature: sig,
        },
    );

    bridge_sign_handler!(
        handle_record_collateral_move_sign,
        label = "record_collateral_move",
        key_param = (cycle_number: u64),
        add_sig = |orch, si, sig| orch.add_collateral_move_follower_signature(cycle_number, si, sig).await,
    );

    // ========================================================================
    // 8-step bridge: MintBridgedShares consensus phase
    // ========================================================================

    /// Run MintBridgedShares consensus (Step 8 of 8-step bridge)
    pub async fn run_mint_bridged_shares_phase(
        &self,
        cycle_number: u64,
        itp_id: H256,
        user: Address,
        amount: U256,
        bridge_proxy: Address,
        order_id: U256,
        am_leader: bool,
    ) -> Result<MintBridgedSharesResult, BridgeError> {
        info!(
            cycle_number,
            itp_id = ?itp_id,
            user = ?user,
            amount = %amount,
            order_id = %order_id,
            am_leader,
            "Starting MintBridgedShares consensus (8-step bridge Step 8)"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        {
            let orch = bridge_orch.read().await;
            if orch.is_mint_shares_confirmed(cycle_number).await {
                return Err(BridgeError::MintBridgedSharesAlreadyProcessed { cycle_number });
            }
        }

        if am_leader {
            drop(bridge_orch_guard);
            self.run_mint_bridged_shares_as_leader(cycle_number, itp_id, user, amount, bridge_proxy, order_id).await
        } else {
            drop(bridge_orch_guard);
            Ok(MintBridgedSharesResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    async fn run_mint_bridged_shares_as_leader(
        &self,
        cycle_number: u64,
        itp_id: H256,
        user: Address,
        amount: U256,
        bridge_proxy: Address,
        order_id: U256,
    ) -> Result<MintBridgedSharesResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(cycle_number, itp_id = ?itp_id, user = ?user, order_id = %order_id, "Leader: Creating MintBridgedShares proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_mint_bridged_shares(cycle_number, itp_id, user, amount, bridge_proxy, order_id)?
        };
        let leader_signature = proposal.leader_signature.clone();

        {
            let orch = bridge_orch.write().await;
            orch.start_mint_shares_signature_collection(cycle_number, leader_signature).await;
        }

        let message = P2PMessage::MintBridgedSharesProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            itp_id,
            user,
            amount,
            order_id,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast MintBridgedShares proposal: {}", e),
        })?;

        let result = self.collect_mint_shares_signatures(
            cycle_number, config.sign_timeout_ms,
        ).await?;

        info!(cycle_number, signer_count = result.signature_count, "Leader: MintBridgedShares threshold reached");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
            let orch = bridge_orch.write().await;
            orch.confirm_mint_shares(cycle_number, H256::zero()).await;
        }

        Ok(result)
    }

    async fn collect_mint_shares_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
    ) -> Result<MintBridgedSharesResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_mint_shares_threshold_reached(cycle_number).await,
            count: orch.get_mint_shares_signature_count(cycle_number).await.unwrap_or(0),
        })
    }

    bridge_proposal_handler!(
        handle_mint_bridged_shares_proposal,
        label = "mint_bridged_shares",
        leader = (leader_id, leader_signature),
        params = (leader_id: PeerId, cycle_number: u64, itp_id: H256, user: Address,
                  amount: U256, order_id: U256, leader_signature: BLSSignature),
        hash = |cfg| build_mint_bridged_shares_hash(
            cfg.settlement_chain_id, cfg.bridge_proxy,
            itp_id, user, amount, order_id,
        ),
        validate = |orch, msg_hash| orch.validate_mint_bridged_shares_proposal(
            &MintBridgedSharesProposal {
                leader_id, cycle_number, itp_id, user, amount, order_id,
                leader_signature: leader_signature.clone(),
                message_hash: msg_hash,
            },
            orch.config().bridge_proxy,
        ).await,
        direct_sign = true,
        respond = |s, sig| P2PMessage::MintBridgedSharesSign {
            signer_id: s.config.peer_id,
            signer_index: s.runtime_config.issuer_registry_index(),
            cycle_number,
            signature: sig,
        },
    );

    bridge_sign_handler!(
        handle_mint_bridged_shares_sign,
        label = "mint_bridged_shares",
        key_param = (cycle_number: u64),
        add_sig = |orch, si, sig| orch.add_mint_shares_follower_signature(cycle_number, si, sig).await,
    );

    // ========================================================================
    // completeBuyOrder BLS consensus
    // ========================================================================

    pub async fn run_complete_buy_order_phase(
        &self,
        cycle_number: u64,
        order_id: U256,
        vault: Address,
        am_leader: bool,
    ) -> Result<CompleteBuyOrderResult, BridgeError> {
        info!(
            cycle_number,
            order_id = %order_id,
            vault = ?vault,
            am_leader,
            "Starting CompleteBuyOrder consensus"
        );

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let _bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        if am_leader {
            drop(bridge_orch_guard);
            self.run_complete_buy_order_as_leader(cycle_number, order_id, vault).await
        } else {
            drop(bridge_orch_guard);
            Ok(CompleteBuyOrderResult {
                aggregated_signature: BLSSignature(vec![]),
                signer_bitmap: U256::zero(),
                signature_count: 0,
            })
        }
    }

    async fn run_complete_buy_order_as_leader(
        &self,
        cycle_number: u64,
        order_id: U256,
        vault: Address,
    ) -> Result<CompleteBuyOrderResult, BridgeError> {
        let ref_nonce = self.key_registry.settlement_registry_nonce();

        info!(cycle_number, order_id = %order_id, "Leader: Creating CompleteBuyOrder proposal");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        let bridge_orch = bridge_orch_guard.as_ref().ok_or_else(|| {
            ConsensusError::ChainWriterError {
                reason: "BridgeOrchestrator not configured".to_string(),
            }
        })?;

        let proposal = {
            let orch = bridge_orch.read().await;
            orch.propose_complete_buy_order(cycle_number, order_id, vault)?
        };
        let leader_signature = proposal.leader_signature.clone();

        {
            let orch = bridge_orch.write().await;
            orch.start_complete_buy_order_signature_collection(cycle_number, leader_signature).await;
        }

        let message = P2PMessage::CompleteBuyOrderProposal {
            leader_id: self.config.peer_id,
            cycle_number,
            order_id,
            vault,
            leader_signature: proposal.leader_signature.clone(),
            reference_nonce: ref_nonce,
        };

        let config = {
            let orch = bridge_orch.read().await;
            orch.config().clone()
        };
        drop(bridge_orch_guard);

        self.p2p.broadcast(message).await.map_err(|e| ConsensusError::ChainWriterError {
            reason: format!("Failed to broadcast CompleteBuyOrder proposal: {}", e),
        })?;

        // Collect signatures with timeout
        let timeout_ms = config.sign_timeout_ms;
        let result = self.collect_complete_buy_order_signatures(
            cycle_number, timeout_ms,
        ).await?;

        info!(cycle_number, signer_count = result.signature_count, "Leader: CompleteBuyOrder threshold reached");

        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
            let orch = bridge_orch.write().await;
            orch.mark_complete_buy_order_confirmed(cycle_number).await;
        }

        Ok(result)
    }

    async fn collect_complete_buy_order_signatures(
        &self,
        cycle_number: u64,
        timeout_ms: u64,
    ) -> Result<CompleteBuyOrderResult, BridgeError> {
        collect_sigs_loop!(self, timeout_ms, |orch| {
            check: orch.check_complete_buy_order_threshold(cycle_number).await,
            count: orch.get_complete_buy_order_signature_count(cycle_number).await.unwrap_or(0),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::keys::InMemoryKeyRegistry;
    use crate::price::MockPriceFetcherBuilder;
    use common::mocks::{MockChain, MockChainBuilder, MockP2P, MockP2PNetworkBuilder};
    use std::sync::Arc;

    fn test_peer_id(n: u8) -> PeerId {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    async fn create_test_protocol(
        peer_idx: u8,
        num_issuers: u8,
    ) -> (
        ConsensusProtocol<MockP2P, MockChain, InMemoryKeyRegistry, crate::price::MockPriceFetcher>,
        Arc<MockP2P>,
        Arc<MockChain>,
    ) {
        let (_network, nodes) = MockP2PNetworkBuilder::new()
            .with_node_count(num_issuers as usize)
            .build()
            .await;

        let p2p = Arc::new(nodes.into_iter().nth(peer_idx as usize).unwrap());
        let chain_writer = Arc::new(MockChainBuilder::new().build());
        let keypair = BLSKeyPair::generate();

        // Create key registry with test keys
        let (key_registry, _) = InMemoryKeyRegistry::generate_test_registry(num_issuers as usize);
        let key_registry = Arc::new(key_registry);

        // Create mock price fetcher
        let price_fetcher = Arc::new(MockPriceFetcherBuilder::new().build());

        let config = ConsensusConfig::new(p2p.peer_id(), num_issuers, peer_idx);

        let protocol = ConsensusProtocol::new(
            keypair,
            p2p.clone(),
            chain_writer.clone(),
            key_registry,
            price_fetcher,
            config,
        );

        (protocol, p2p, chain_writer)
    }

    #[test]
    fn test_consensus_config_default() {
        let config = ConsensusConfig::new(test_peer_id(0), 20, 0);
        assert_eq!(config.num_issuers, 20);
        assert_eq!(config.node_index, 0);
        assert_eq!(config.signature_threshold, compute_threshold(20)); // BFT: 14
    }

    #[tokio::test]
    async fn test_encode_price_proposal() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        let prices = vec![(1u32, U256::from(1000)), (2u32, U256::from(2000))];
        let encoded = protocol.encode_price_proposal(42, &prices);

        assert!(encoded.starts_with(b"PRICE_PROPOSAL"));
        assert!(encoded.len() > 14); // Header + cycle_number + prices
    }

    #[tokio::test]
    async fn test_encode_price_vote() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        let encoded_approve = protocol.encode_price_vote(42, true);
        let encoded_reject = protocol.encode_price_vote(42, false);

        assert!(encoded_approve.starts_with(b"PRICE_VOTE"));
        assert!(encoded_reject.starts_with(b"PRICE_VOTE"));
        assert_ne!(encoded_approve, encoded_reject);
    }

    #[tokio::test]
    async fn test_encode_batch_proposal() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        let order_ids = vec![1, 2, 3];
        let fills = vec![];
        let encoded = protocol.encode_batch_proposal(42, &order_ids, &fills);

        assert!(encoded.starts_with(b"BATCH_PROPOSAL"));
    }

    #[tokio::test]
    async fn test_consensus_protocol_creation() {
        let (protocol, p2p, _) = create_test_protocol(0, 3).await;

        assert_eq!(protocol.peer_id(), p2p.peer_id());
    }

    // =========================================================================
    // Story 7.10: L3→Settlement and Custody Release Tests
    // =========================================================================

    #[tokio::test]
    async fn test_run_bridge_l3_to_settlement_phase_no_orchestrator() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        // Without setting a BridgeOrchestrator, the method should fail
        let result = protocol
            .run_bridge_l3_to_settlement_phase(
                1,                            // cycle_number
                vec![U256::from(1)],          // order_ids
                U256::from(1000),             // total_amount
                true,                         // am_leader
            )
            .await;

        assert!(result.is_err());
        match result {
            Err(BridgeError::Consensus(ConsensusError::ChainWriterError { reason })) => {
                assert!(reason.contains("BridgeOrchestrator not configured"));
            }
            _ => panic!("Expected ChainWriterError"),
        }
    }

    #[tokio::test]
    async fn test_run_release_to_vault_phase_no_orchestrator() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        // Without setting a BridgeOrchestrator, the method should fail
        let result = protocol
            .run_release_to_vault_phase(
                1,                            // cycle_number
                vec![U256::from(1)],          // order_ids
                U256::from(1000),             // total_amount
                true,                         // am_leader
            )
            .await;

        assert!(result.is_err());
        match result {
            Err(BridgeError::Consensus(ConsensusError::ChainWriterError { reason })) => {
                assert!(reason.contains("BridgeOrchestrator not configured"));
            }
            _ => panic!("Expected ChainWriterError"),
        }
    }

    #[tokio::test]
    async fn test_handle_bridge_l3_to_settlement_proposal_no_orchestrator() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        // Without orchestrator, handler should return Ok(()) and log warning
        let result = protocol
            .handle_bridge_l3_to_settlement_proposal(
                test_peer_id(1),              // from
                test_peer_id(1),              // leader_id
                1,                            // cycle_number
                vec![U256::from(1)],          // order_ids
                U256::from(1000),             // total_amount
                Address::zero(),              // destination
                BLSSignature(vec![]),         // leader_signature
            )
            .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_handle_bridge_l3_to_settlement_sign_no_orchestrator() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        // Without orchestrator, handler should return Ok(()) and log warning
        let result = protocol
            .handle_bridge_l3_to_settlement_sign(
                test_peer_id(1),              // from
                1,                            // signer_index
                1,                            // cycle_number
                BLSSignature(vec![]),         // signature
            )
            .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_handle_release_to_vault_proposal_no_orchestrator() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        // Without orchestrator, handler should return Ok(()) and log warning
        let result = protocol
            .handle_release_to_vault_proposal(
                test_peer_id(1),              // from
                test_peer_id(1),              // leader_id
                1,                            // cycle_number
                vec![U256::from(1)],          // order_ids
                U256::from(1000),             // total_amount
                Address::zero(),              // vault_address
                BLSSignature(vec![]),         // leader_signature
            )
            .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_handle_release_to_vault_sign_no_orchestrator() {
        let (protocol, _, _) = create_test_protocol(0, 3).await;

        // Without orchestrator, handler should return Ok(()) and log warning
        let result = protocol
            .handle_release_to_vault_sign(
                test_peer_id(1),              // from
                1,                            // signer_index
                1,                            // cycle_number
                BLSSignature(vec![]),         // signature
            )
            .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_run_bridge_l3_to_settlement_phase_orchestrator_check_before_role_branch() {
        let (protocol, _, _) = create_test_protocol(1, 3).await;

        // Tests that orchestrator validation happens BEFORE the leader/follower branch.
        // Without orchestrator configured, the method fails early regardless of role.
        // This ensures the orchestrator guard is checked first.
        let result = protocol
            .run_bridge_l3_to_settlement_phase(
                1,                            // cycle_number
                vec![U256::from(1)],          // order_ids
                U256::from(1000),             // total_amount
                false,                        // am_leader = false (follower)
            )
            .await;

        // Without orchestrator, it fails before the leader/follower branch
        assert!(result.is_err());
        match result {
            Err(BridgeError::Consensus(ConsensusError::ChainWriterError { reason })) => {
                assert!(reason.contains("BridgeOrchestrator not configured"));
            }
            _ => panic!("Expected ChainWriterError for missing orchestrator"),
        }
    }

    #[tokio::test]
    async fn test_run_release_to_vault_phase_orchestrator_check_before_role_branch() {
        let (protocol, _, _) = create_test_protocol(1, 3).await;

        // Tests that orchestrator validation happens BEFORE the leader/follower branch.
        // Without orchestrator configured, the method fails early regardless of role.
        let result = protocol
            .run_release_to_vault_phase(
                1,                            // cycle_number
                vec![U256::from(1)],          // order_ids
                U256::from(1000),             // total_amount
                false,                        // am_leader = false (follower)
            )
            .await;

        // Without orchestrator, it fails before the leader/follower branch
        assert!(result.is_err());
        match result {
            Err(BridgeError::Consensus(ConsensusError::ChainWriterError { reason })) => {
                assert!(reason.contains("BridgeOrchestrator not configured"));
            }
            _ => panic!("Expected ChainWriterError for missing orchestrator"),
        }
    }

    // Integration tests would require more setup with multiple nodes,
    // BridgeOrchestrator, and proper message passing, which is covered
    // in issuer/tests/bridge_l3_to_settlement_integration.rs and
    // issuer/tests/custody_release_integration.rs
}
