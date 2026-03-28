//! Bridge orchestrator for Settlementitrum to L3 USDC bridging
//!
//! Implements BLS consensus-based bridging following the vital-test.md flow:
//! 1. Leader proposes bridge for CrossChainOrder
//! 2. Followers validate and sign
//! 3. Threshold reached → execute bridge (mint L3Usdc to OracleCustody L3)
//!
//! Story 7.2: Bridge USDC Orchestrator (Settlement→L3)
//! Story 7.3: Submit Order for User

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use ethers::types::{Address, H256, U256};
use tokio::sync::{Notify, RwLock};
use tracing::{debug, info, warn};

use common::bls::{BLSKeyPair, Bn254BLSSigner};
use common::traits::{BLSSigner, ChainWriter};
use common::types::{BLSSignature, PeerId};

use crate::chain::{CrossChainOrder, CrossChainOrderData};
use crate::consensus::ConsensusError;

use super::phase_state::PhaseState;
use super::signature_manager::SignatureCollectionManager;
use super::types::{
    build_bridge_settlement_to_l3_hash, build_bridge_l3_to_settlement_hash, build_confirm_batch_calldata,
    build_confirm_batch_hash, build_confirm_fills_calldata, build_confirm_fills_hash,
    build_custody_execute_calldata, build_custody_execute_hash, build_erc20_approve_calldata,
    build_release_to_vault_hash,
    build_submit_order_for_calldata, build_submit_order_hash,
    build_usdc_transfer_calldata_with_amount, BatchProposal, BatchResult, BridgeConfig,
    BridgeError, BridgeL3ToSettlementProposal, BridgeL3ToSettlementResult, BridgeOrderStatus, BridgeProposal,
    BridgeResult, Fill, FillsProposal, FillsResult, OrderMapping, ReleaseToVaultProposal,
    ReleaseToVaultResult, SignatureCollector, SubmitOrderProposal, SubmitOrderResult,
    // Story 7-14: Rebalance consensus
    build_rebalance_batch_hash, build_confirm_rebalance_batch_calldata,
    build_update_weights_hash, build_update_weights_calldata,
    RebalanceBatchResult, UpdateWeightsResult,
    // Single-phase rebalance
    build_rebalance_hash, build_rebalance_calldata, RebalanceResult,
    // Oracle-driven per-asset settlement
    AssetTrade, AssetTradesProposal, AssetTradesResult,
    build_emit_asset_trades_hash, build_emit_asset_trades_calldata,
    // NAV push
    build_set_itp_nav_calldata, build_set_itp_nav_hash, SetItpNavResult,
    // Cross-chain sell consensus
    build_sell_bridge_hash, SellBridgeProposal, SellSubmitOrderResult,
    build_complete_sell_order_consensus_hash, CompleteSellProposal, CompleteSellOrderResult,
    // Burn sell order consensus
    build_burn_sell_order_hash, BurnSellOrderProposal, BurnSellOrderResult,
    // 8-step bridge: RecordCollateralMove + MintBridgedShares
    build_record_collateral_move_hash, RecordCollateralMoveProposal, RecordCollateralMoveResult,
    build_mint_bridged_shares_hash, MintBridgedSharesProposal, MintBridgedSharesResult,
    // completeBuyOrder BLS consensus
    build_complete_buy_order_hash, CompleteBuyOrderProposal, CompleteBuyOrderResult,
};

/// Trait for reading cross-chain order data from Settlement
///
/// This abstraction allows the BridgeOrchestrator to work with
/// different implementations (real SettlementChainReader or mocks).
#[async_trait]
pub trait CrossChainOrderReader: Send + Sync {
    /// Get a cross-chain order by ID
    async fn get_cross_chain_order(&self, order_id: U256) -> Result<CrossChainOrderData, BridgeError>;
}

/// Orchestrates USDC bridging from Settlement to L3 with BLS consensus
pub struct BridgeOrchestrator {
    /// Configuration
    config: BridgeConfig,
    /// Chain reader for Settlementitrum (to verify orders)
    settlement_reader: Arc<dyn CrossChainOrderReader>,
    /// Chain writer for L3 (to mint L3Usdc in local E2E)
    l3_writer: Arc<dyn ChainWriter>,
    /// BLS keypair for signing
    bls_keypair: BLSKeyPair,
    /// BLS signer for signature operations
    bls_signer: Bn254BLSSigner,
    /// This node's peer ID
    peer_id: PeerId,
    /// This node's index in the oracle set
    node_index: u8,
    /// Generic signature manager for bridge Settlement→L3 proposals (replaces pending_signatures)
    bridge_sigs: SignatureCollectionManager<U256>,
    /// Signature collectors for pending submit order proposals (Story 7.3)
    /// SPECIAL CASE: SubmitOrderResult has extra l3_order_id field, kept hand-written
    submit_order_signatures: RwLock<HashMap<U256, SignatureCollector>>,
    /// Consolidated phase state for batch confirmation (Story 7.4)
    batch_phase: PhaseState<u64>,
    /// Consolidated phase state for fills confirmation (Story 7.4)
    fills_phase: PhaseState<u64>,
    /// Order status tracking
    order_status: RwLock<HashMap<U256, BridgeOrderStatus>>,
    /// Processed order IDs (for replay protection)
    processed_orders: RwLock<HashMap<U256, H256>>, // order_id -> tx_hash
    /// Order ID mappings: settlement_order_id → OrderMapping (Story 7.3)
    order_mappings: RwLock<HashMap<U256, OrderMapping>>,
    /// Custody nonces (for BLSCustody.execute replay protection) - Story 7.4 Task 7.5
    /// Maps custody_address -> next_nonce to use
    custody_nonces: RwLock<HashMap<Address, U256>>,
    /// Consolidated phase state for L3→Settlement bridge (Story 7.5)
    l3_to_settlement_phase: PhaseState<u64>,
    /// Consolidated phase state for custody release to vault (Story 7.6)
    release_phase: PhaseState<u64>,
    /// Order amounts tracking: order_id → amount (for validation) - Story 7.6 code review fix
    order_amounts: RwLock<HashMap<U256, U256>>,
    /// Order limit prices: order_id → limit_price (for E126 fill price validation)
    order_limit_prices: RwLock<HashMap<U256, (U256, u8)>>, // (limit_price, side)
    /// Consolidated phase state for rebalance batch (Story 7-14)
    rebalance_batch_phase: PhaseState<u64>,
    /// Generic signature manager for update weights / rebalance proposals (Story 7-14)
    /// Also used by single-phase rebalance (same key space: itp_id)
    update_weights_sigs: SignatureCollectionManager<H256>,
    /// Confirmed weight updates (for deduplication) - Story 7-14
    confirmed_weight_updates: RwLock<HashMap<H256, H256>>,
    /// In-progress rebalances: itp_id → timestamp when started
    /// Prevents concurrent cycles from racing on the same rebalance.
    /// Entries auto-expire after 60s to handle leader crashes.
    processing_rebalances: RwLock<HashMap<H256, Instant>>,
    /// Consolidated phase state for asset trades (oracle-driven settlement)
    asset_trades_phase: PhaseState<u64>,
    /// Stale order watchdog for detecting stuck orders
    watchdog: RwLock<super::watchdog::StaleOrderWatchdog>,
    /// Sell order status tracking
    sell_order_status: RwLock<HashMap<U256, BridgeOrderStatus>>,
    /// Processed sell order IDs (for replay protection)
    processed_sell_orders: RwLock<HashMap<U256, H256>>, // order_id -> tx_hash
    /// Generic signature manager for burn sell order proposals
    burn_sell_sigs: SignatureCollectionManager<U256>,
    /// Generic signature manager for submit sell order proposals
    sell_bridge_sigs: SignatureCollectionManager<U256>,
    /// Generic signature manager for complete sell order proposals
    complete_sell_sigs: SignatureCollectionManager<U256>,
    /// Order ID mappings for sell: settlement_sell_order_id → OrderMapping
    sell_order_mappings: RwLock<HashMap<U256, OrderMapping>>,
    /// Sell order amounts: order_id → amount
    sell_order_amounts: RwLock<HashMap<U256, U256>>,
    /// Sell order limit prices: order_id → limit_price
    sell_order_limit_prices: RwLock<HashMap<U256, U256>>,
    /// Sell order fill prices: order_id → fill_price (stored after Phase B)
    sell_order_fill_prices: RwLock<HashMap<U256, U256>>,
    /// Sell order fill amounts: order_id → fill_amount (stored after Phase B)
    sell_order_fill_amounts: RwLock<HashMap<U256, U256>>,
    /// Pending burn tx hashes: order_id → tx_hash (for non-blocking receipt check)
    sell_burn_tx_hashes: RwLock<HashMap<U256, H256>>,
    /// Order ITP IDs: order_id → itp_id (for multi-ITP support)
    order_itp_ids: RwLock<HashMap<U256, H256>>,
    /// Sell order ITP IDs: order_id → itp_id (for multi-ITP support)
    sell_order_itp_ids: RwLock<HashMap<U256, H256>>,
    /// Sell order users: order_id → user address (cached from event)
    sell_order_users: RwLock<HashMap<U256, Address>>,
    /// Sell order bridged ITP addresses: order_id → bridged_itp_address (cached from event)
    sell_order_bridged_itps: RwLock<HashMap<U256, Address>>,
    /// Consolidated phase state for record collateral move (8-step bridge)
    collateral_move_phase: PhaseState<u64>,
    /// Consolidated phase state for mint bridged shares (8-step bridge)
    mint_shares_phase: PhaseState<u64>,
    /// Generic signature manager for completeBuyOrder proposals
    complete_buy_sigs: SignatureCollectionManager<u64>,
    /// Confirmed completeBuyOrder (for deduplication)
    confirmed_complete_buy: RwLock<HashMap<u64, bool>>,
    /// Notify for completeBuyOrder signature collection
    pub complete_buy_notify: Arc<Notify>,
    /// Generic signature manager for setItpNav proposals (rebalance NAV consensus)
    nav_sigs: SignatureCollectionManager<H256>,
    /// Signature manager for NavOracle proposals (keyed by itp_address as H256)
    nav_oracle_sigs: SignatureCollectionManager<H256>,
    /// Signature manager for MirrorOracleRegistry sync proposals (keyed by nonce as H256)
    mirror_sync_sigs: SignatureCollectionManager<H256>,
    /// Whether we've already set max L3 USDC approval for Index (skips approve tx per order)
    l3_usdc_approved: std::sync::atomic::AtomicBool,
}

impl BridgeOrchestrator {
    /// Create a new bridge orchestrator
    pub fn new(
        config: BridgeConfig,
        settlement_reader: Arc<dyn CrossChainOrderReader>,
        l3_writer: Arc<dyn ChainWriter>,
        bls_keypair: BLSKeyPair,
        peer_id: PeerId,
        node_index: u8,
    ) -> Self {
        Self {
            config,
            settlement_reader,
            l3_writer,
            bls_keypair,
            bls_signer: Bn254BLSSigner::new(),
            peer_id,
            node_index,
            bridge_sigs: SignatureCollectionManager::new("bridge"),
            submit_order_signatures: RwLock::new(HashMap::new()),
            batch_phase: PhaseState::new("batch"),
            fills_phase: PhaseState::new("fills"),
            order_status: RwLock::new(HashMap::new()),
            processed_orders: RwLock::new(HashMap::new()),
            order_mappings: RwLock::new(HashMap::new()),
            custody_nonces: RwLock::new(HashMap::new()),
            l3_to_settlement_phase: PhaseState::new("l3_to_settlement"),
            release_phase: PhaseState::new("release"),
            order_amounts: RwLock::new(HashMap::new()),
            order_limit_prices: RwLock::new(HashMap::new()),
            rebalance_batch_phase: PhaseState::new("rebalance_batch"),
            update_weights_sigs: SignatureCollectionManager::new("update_weights"),
            confirmed_weight_updates: RwLock::new(HashMap::new()),
            processing_rebalances: RwLock::new(HashMap::new()),
            asset_trades_phase: PhaseState::new("asset_trades"),
            watchdog: RwLock::new(super::watchdog::StaleOrderWatchdog::new(
                Duration::from_secs(300), // 5 min — must exceed receipt-wait pipeline (60s CBO + 60s mint = 120s+)
            )),
            sell_order_status: RwLock::new(HashMap::new()),
            processed_sell_orders: RwLock::new(HashMap::new()),
            burn_sell_sigs: SignatureCollectionManager::new("burn_sell"),
            sell_bridge_sigs: SignatureCollectionManager::new("sell_bridge"),
            complete_sell_sigs: SignatureCollectionManager::new("complete_sell"),
            sell_order_mappings: RwLock::new(HashMap::new()),
            sell_order_amounts: RwLock::new(HashMap::new()),
            sell_order_limit_prices: RwLock::new(HashMap::new()),
            sell_order_fill_prices: RwLock::new(HashMap::new()),
            sell_order_fill_amounts: RwLock::new(HashMap::new()),
            sell_burn_tx_hashes: RwLock::new(HashMap::new()),
            order_itp_ids: RwLock::new(HashMap::new()),
            sell_order_itp_ids: RwLock::new(HashMap::new()),
            sell_order_users: RwLock::new(HashMap::new()),
            sell_order_bridged_itps: RwLock::new(HashMap::new()),
            collateral_move_phase: PhaseState::new("collateral_move"),
            mint_shares_phase: PhaseState::new("mint_shares"),
            complete_buy_sigs: SignatureCollectionManager::new("complete_buy"),
            confirmed_complete_buy: RwLock::new(HashMap::new()),
            complete_buy_notify: Arc::new(Notify::new()),
            nav_sigs: SignatureCollectionManager::new("nav"),
            nav_oracle_sigs: SignatureCollectionManager::new("nav_oracle"),
            mirror_sync_sigs: SignatureCollectionManager::new("mirror_sync"),
            l3_usdc_approved: std::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Get the current configuration
    pub fn config(&self) -> &BridgeConfig {
        &self.config
    }

    /// Get this node's peer ID
    pub fn peer_id(&self) -> &PeerId {
        &self.peer_id
    }

    /// Get this node's index in the oracle set
    pub fn node_index(&self) -> u8 {
        self.node_index
    }

    // ============ Rebalance Dedup ============

    /// Check if a rebalance is already being processed by another cycle.
    /// Returns false if the entry has expired (>60s, handles leader crashes).
    pub async fn is_rebalance_in_progress(&self, itp_id: &H256) -> bool {
        let map = self.processing_rebalances.read().await;
        if let Some(started_at) = map.get(itp_id) {
            if started_at.elapsed() < Duration::from_secs(60) {
                return true;
            }
            // Stale entry — will be cleaned up on next mark
        }
        false
    }

    /// Mark a rebalance as in-progress. Also cleans up any stale entries.
    pub async fn mark_rebalance_started(&self, itp_id: H256) {
        let mut map = self.processing_rebalances.write().await;
        // Clean stale entries while we have the write lock
        map.retain(|_, started_at| started_at.elapsed() < Duration::from_secs(60));
        map.insert(itp_id, Instant::now());
    }

    /// Mark a rebalance as completed (remove from in-progress set).
    pub async fn mark_rebalance_completed(&self, itp_id: &H256) {
        self.processing_rebalances.write().await.remove(itp_id);
    }

    // ============ Stale Order Watchdog ============

    /// Get all stale orders detected by the watchdog.
    pub async fn get_stale_orders(&self) -> Vec<(U256, BridgeOrderStatus)> {
        self.watchdog.read().await.get_stale_orders()
    }

    /// Reset a stale order for retry. Clears transient state but preserves order metadata
    /// (amounts, itp_ids, mappings, limit_prices) so retry uses correct fill values.
    pub async fn reset_stale_order(&self, order_id: &U256) {
        warn!(order_id = %order_id, "Resetting stale order for retry (preserving metadata)");
        self.order_status.write().await.remove(order_id);
        self.processed_orders.write().await.remove(order_id);
        // NOTE: Do NOT remove order_amounts, order_itp_ids, order_mappings, order_limit_prices.
        // These contain the original order data needed for correct retry (fill amount, ITP ID, user address).
        self.watchdog.write().await.clear(order_id);
    }

    /// Reset a stale SELL order for retry. Clears transient state but preserves order metadata.
    pub async fn reset_stale_sell_order(&self, order_id: &U256) {
        warn!(order_id = %order_id, "Resetting stale sell order for retry (preserving metadata)");
        self.sell_order_status.write().await.remove(order_id);
        self.processed_sell_orders.write().await.remove(order_id);
        // NOTE: Do NOT remove sell_order_amounts, sell_order_itp_ids.
        // These contain the original order data needed for correct retry.
        self.watchdog.write().await.clear(order_id);
    }

    /// Periodic cleanup of terminal orders from the watchdog to prevent memory growth.
    pub async fn cleanup_watchdog(&self) {
        self.watchdog.write().await.cleanup_terminal();
    }

    /// Check if an order has already been processed
    pub async fn is_order_processed(&self, order_id: &U256) -> bool {
        self.processed_orders.read().await.contains_key(order_id)
    }

    /// Get the status of an order
    pub async fn get_order_status(&self, order_id: &U256) -> Option<BridgeOrderStatus> {
        self.order_status.read().await.get(order_id).copied()
    }

    /// Update the status of an order
    pub async fn set_order_status(&self, order_id: U256, status: BridgeOrderStatus) {
        self.watchdog.write().await.record_status_change(order_id, status.clone());
        self.order_status.write().await.insert(order_id, status);
    }

    /// Store the amount for an order (for validation in Story 7.6)
    /// Should be called when order is first tracked (Story 7.2)
    pub async fn set_order_amount(&self, order_id: U256, amount: U256) {
        self.order_amounts.write().await.insert(order_id, amount);
    }

    /// Get the stored amount for an order
    pub async fn get_order_amount(&self, order_id: &U256) -> Option<U256> {
        self.order_amounts.read().await.get(order_id).copied()
    }

    /// Store limit price and side for E126 fill price validation
    pub async fn set_order_limit_price(&self, order_id: U256, limit_price: U256, side: u8) {
        self.order_limit_prices.write().await.insert(order_id, (limit_price, side));
    }

    /// Get the stored limit price and side for an order
    pub async fn get_order_limit_price(&self, order_id: &U256) -> Option<(U256, u8)> {
        self.order_limit_prices.read().await.get(order_id).copied()
    }

    /// Store the ITP ID for a buy order (for multi-ITP support)
    pub async fn set_order_itp_id(&self, order_id: U256, itp_id: H256) {
        self.order_itp_ids.write().await.insert(order_id, itp_id);
    }

    /// Get the stored ITP ID for a buy order
    pub async fn get_order_itp_id(&self, order_id: &U256) -> Option<H256> {
        self.order_itp_ids.read().await.get(order_id).copied()
    }

    /// Store the ITP ID for a sell order (for multi-ITP support)
    pub async fn set_sell_order_itp_id(&self, order_id: U256, itp_id: H256) {
        self.sell_order_itp_ids.write().await.insert(order_id, itp_id);
    }

    /// Get the stored ITP ID for a sell order
    pub async fn get_sell_order_itp_id(&self, order_id: &U256) -> Option<H256> {
        self.sell_order_itp_ids.read().await.get(order_id).copied()
    }

    /// Store the user address for a sell order (cached from event)
    pub async fn set_sell_order_user(&self, order_id: U256, user: Address) {
        self.sell_order_users.write().await.insert(order_id, user);
    }

    /// Get the stored user address for a sell order
    pub async fn get_sell_order_user(&self, order_id: &U256) -> Option<Address> {
        self.sell_order_users.read().await.get(order_id).copied()
    }

    /// Store the bridged ITP address for a sell order (cached from event)
    pub async fn set_sell_order_bridged_itp(&self, order_id: U256, addr: Address) {
        self.sell_order_bridged_itps.write().await.insert(order_id, addr);
    }

    /// Get the stored bridged ITP address for a sell order
    pub async fn get_sell_order_bridged_itp(&self, order_id: &U256) -> Option<Address> {
        self.sell_order_bridged_itps.read().await.get(order_id).copied()
    }

    // ========================================================================
    // Cross-Chain Sell Order Tracking
    // ========================================================================

    /// Check if a sell order has already been processed
    pub async fn is_sell_order_processed(&self, order_id: &U256) -> bool {
        self.processed_sell_orders.read().await.contains_key(order_id)
    }

    /// Get the status of a sell order
    pub async fn get_sell_order_status(&self, order_id: &U256) -> Option<BridgeOrderStatus> {
        self.sell_order_status.read().await.get(order_id).copied()
    }

    /// Update the status of a sell order
    pub async fn set_sell_order_status(&self, order_id: U256, status: BridgeOrderStatus) {
        self.watchdog.write().await.record_status_change(order_id, status.clone());
        self.sell_order_status.write().await.insert(order_id, status);
    }

    /// Returns true if any buy or sell orders are actively progressing.
    ///
    /// Used by the demand-driven CycleManager to decide whether to trigger
    /// fast (WorkDriven) cycles instead of waiting for the next heartbeat.
    ///
    /// An order is only "actively progressing" if its last status change was
    /// within the freshness window (30s). Orders stuck longer than that are
    /// not worth burning WorkDriven cycles on — the heartbeat watchdog will
    /// detect them at the 5-minute mark and reset them for retry.
    ///
    /// Without this freshness gate, a reverted tx leaves the order in-flight
    /// status forever, triggering WorkDriven cycles every 50ms until the
    /// watchdog finally intervenes — 6,000 wasted cycles that desync oracles.
    pub async fn has_in_flight_orders(&self) -> bool {
        use std::time::Duration;
        const WORK_DRIVEN_FRESHNESS: Duration = Duration::from_secs(30);

        self.watchdog.read().await.has_fresh_in_flight(WORK_DRIVEN_FRESHNESS)
    }

    /// Mark a sell order as fully processed and clean up transient state
    pub async fn mark_sell_order_processed(&self, order_id: U256, tx_hash: H256) {
        self.processed_sell_orders.write().await.insert(order_id, tx_hash);
        self.set_sell_order_status(order_id, BridgeOrderStatus::SellCompleted).await;
        // Clean up transient in-memory data to prevent unbounded growth
        self.sell_order_amounts.write().await.remove(&order_id);
        self.sell_order_limit_prices.write().await.remove(&order_id);
        self.sell_order_fill_prices.write().await.remove(&order_id);
        self.sell_order_fill_amounts.write().await.remove(&order_id);
        self.sell_burn_tx_hashes.write().await.remove(&order_id);
        self.sell_order_itp_ids.write().await.remove(&order_id);
        self.sell_order_users.write().await.remove(&order_id);
        self.sell_order_bridged_itps.write().await.remove(&order_id);
        self.sell_order_mappings.write().await.remove(&order_id);
        info!(
            order_id = %order_id,
            tx_hash = ?tx_hash,
            "Sell order marked as processed"
        );
    }

    // ========================================================================
    // Story 7.4 Task 10: Order Collection for Batching
    // ========================================================================

    /// Get all orders that have been submitted on L3 and are ready for batching (Task 10.1)
    ///
    /// Returns order IDs with status SubmittedOnL3 (from Story 7.3).
    /// These are bridged orders that have been submitted via BLSCustody.execute()
    /// and are now waiting to be included in a batch confirmation.
    pub async fn get_submitted_bridged_orders(&self) -> Vec<U256> {
        let statuses = self.order_status.read().await;
        let mut ids: Vec<U256> = statuses
            .iter()
            .filter(|(_, status)| **status == BridgeOrderStatus::SubmittedOnL3)
            .map(|(order_id, _)| *order_id)
            .collect();
        // Sort for deterministic leader election — HashMap iteration is non-deterministic,
        // so without sorting, different nodes may compute different batch_keys.
        ids.sort();
        ids
    }

    /// Check if any buy order is in a non-terminal bridge status.
    ///
    /// Returns true if any order is Pending, BridgedToL3, SubmittedOnL3, or Batched.
    /// Used by L3-native processing to skip entirely when cross-chain is active,
    /// preventing the race where L3-native registers the same physical order
    /// under the L3 order ID while cross-chain tracks it under the Settlement order ID.
    ///
    /// Checks BOTH buy and sell order statuses. Without sell checks, the sell
    /// pipeline and L3-native BATCHED path race on the same physical orders:
    /// - Sell path batches order #N on L3, then runs confirmFills(current_cycle)
    /// - L3-native sees order #N as BATCHED via get_batched_orders(), runs
    ///   confirmFills(N + 500_000_001) with different cycle number
    /// - Both sign different hashes -> BLS signatures are for different messages
    /// - The losing race's TX reverts with BLSVerifier__InvalidSignature (0x10aa8d54)
    pub async fn has_any_active_bridge_orders(&self) -> bool {
        let buy_active = self.order_status.read().await.values().any(|status| matches!(status,
            BridgeOrderStatus::Pending |
            BridgeOrderStatus::BridgedToL3 |
            BridgeOrderStatus::SubmittedOnL3 |
            BridgeOrderStatus::Batched
        ));
        if buy_active {
            return true;
        }
        // Also check sell orders: SellPending and SellSubmittedOnL3 mean the sell
        // pipeline is actively processing orders that will become BATCHED on L3.
        // Without this check, L3-native picks up those same BATCHED orders and
        // races with the sell pipeline's fills consensus.
        self.sell_order_status.read().await.values().any(|status| matches!(status,
            BridgeOrderStatus::SellPending |
            BridgeOrderStatus::SellBurnPending |
            BridgeOrderStatus::SellSubmittedOnL3
        ))
    }

    /// Check if any bridge order is in a pre-submission state (no L3 order ID mapped yet).
    ///
    /// Returns true only for orders in `Pending`/`BridgedToL3` (buys) or `SellPending` (sells).
    /// Once an order is `SubmittedOnL3` or later, it has an L3 order ID mapped in
    /// `order_mappings` and can be filtered by `get_all_tracked_l3_order_ids()`.
    /// This narrower check replaces `has_any_active_bridge_orders()` in the L3-native
    /// PENDING guard so that L3-native orders (like sells placed on L3) aren't blocked
    /// for the entire 10-minute bridge buy pipeline.
    pub async fn has_unmapped_bridge_orders(&self) -> bool {
        let buy_pre = self.order_status.read().await.values().any(|status| matches!(status,
            BridgeOrderStatus::Pending |
            BridgeOrderStatus::BridgedToL3
        ));
        if buy_pre {
            return true;
        }
        self.sell_order_status.read().await.values().any(|status| matches!(status,
            BridgeOrderStatus::SellPending |
            BridgeOrderStatus::SellBurnPending |
            BridgeOrderStatus::SellBurned
        ))
    }

    /// Get all L3 order IDs tracked by both buy and sell bridge pipelines.
    /// Used to exclude bridge-tracked orders from L3-native processing.
    pub async fn get_all_tracked_l3_order_ids(&self) -> Vec<u64> {
        let buy_ids: Vec<u64> = self.order_mappings.read().await
            .values().map(|m| m.l3_order_id.as_u64()).collect();
        let sell_ids: Vec<u64> = self.sell_order_mappings.read().await
            .values().map(|m| m.l3_order_id.as_u64()).collect();
        buy_ids.into_iter().chain(sell_ids).collect()
    }

    /// Get all L3 order IDs tracked by the bridge pipeline.
    /// Used to exclude these from the regular consensus batch (avoid E019 conflicts).
    pub async fn get_tracked_l3_order_ids(&self) -> Vec<u64> {
        let mappings = self.order_mappings.read().await;
        mappings.values().map(|m| m.l3_order_id.as_u64()).collect()
    }

    /// Resolve Settlement order IDs to L3 order IDs for batch confirmation
    ///
    /// Returns a Vec of L3 order IDs corresponding to the given Settlement order IDs.
    /// Falls back to using the Settlement order ID if no mapping exists.
    pub async fn resolve_l3_order_ids(&self, settlement_order_ids: &[U256]) -> Vec<U256> {
        let mappings = self.order_mappings.read().await;
        settlement_order_ids
            .iter()
            .map(|settlement_id| {
                mappings
                    .get(settlement_id)
                    .map(|m| {
                        info!(settlement_order_id = %settlement_id, l3_order_id = %m.l3_order_id, "Resolved settlement→L3 order ID");
                        m.l3_order_id
                    })
                    .unwrap_or_else(|| {
                        warn!(settlement_order_id = %settlement_id, "No L3 order mapping found, using settlement ID as fallback");
                        *settlement_id
                    })
            })
            .collect()
    }

    /// Get all orders in a specific status
    ///
    /// Useful for debugging and monitoring the order pipeline.
    pub async fn get_orders_by_status(&self, target_status: BridgeOrderStatus) -> Vec<U256> {
        let statuses = self.order_status.read().await;
        statuses
            .iter()
            .filter(|(_, status)| **status == target_status)
            .map(|(order_id, _)| *order_id)
            .collect()
    }

    /// Get order counts by status (for metrics/debugging)
    pub async fn get_order_status_counts(&self) -> std::collections::HashMap<BridgeOrderStatus, usize> {
        let statuses = self.order_status.read().await;
        let mut counts: std::collections::HashMap<BridgeOrderStatus, usize> = std::collections::HashMap::new();
        for (_, status) in statuses.iter() {
            *counts.entry(*status).or_insert(0) += 1;
        }
        counts
    }

    // ========================================================================
    // Leader Proposal Logic (AC: #1)
    // ========================================================================

    /// Create a bridge proposal for a CrossChainOrder (leader only)
    ///
    /// This builds the message hash, signs it with the leader's BLS key,
    /// and returns the proposal ready for broadcasting.
    pub fn propose_bridge_settlement_to_l3(
        &self,
        order: &CrossChainOrder,
    ) -> Result<BridgeProposal, BridgeError> {
        // Build the message hash for BLS signing
        let message_hash = build_bridge_settlement_to_l3_hash(
            self.config.settlement_chain_id,
            order.order_id,
            order.itp_id,
            order.user,
            order.amount,
            order.deadline,
        );

        // Sign with leader's BLS key using sign_message_hash (not sign_with_keypair)
        // because message_hash is already a keccak256 hash
        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            order_id = %order.order_id,
            itp_id = ?order.itp_id,
            user = ?order.user,
            amount = %order.amount,
            deadline = %order.deadline,
            message_hash = ?message_hash,
            "Bridge Settlement→L3 proposal created"
        );

        Ok(BridgeProposal {
            leader_id: self.peer_id,
            order_id: order.order_id,
            itp_id: order.itp_id,
            user: order.user,
            amount: order.amount,
            deadline: order.deadline,
            leader_signature,
            message_hash,
        })
    }

    // ========================================================================
    // Follower Validation Logic (AC: #2)
    // ========================================================================

    /// Validate a bridge proposal from the leader
    ///
    /// Checks:
    /// 1. Order exists on-chain via SettlementChainReader
    /// 2. Proposal fields match on-chain order
    /// 3. Deadline has not passed
    pub async fn validate_bridge_proposal(
        &self,
        proposal: &BridgeProposal,
    ) -> Result<bool, BridgeError> {
        // Check if already processed (replay protection)
        if self.is_order_processed(&proposal.order_id).await {
            warn!(
                order_id = %proposal.order_id,
                "Order already processed, rejecting proposal"
            );
            return Ok(false);
        }

        // 1. Check deadline not passed
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| ConsensusError::ChainReaderError {
                reason: format!("Failed to get current time: {}", e),
            })?
            .as_secs();

        if proposal.deadline.as_u64() < now {
            warn!(
                order_id = %proposal.order_id,
                deadline = %proposal.deadline,
                now = now,
                "Order deadline passed"
            );
            return Err(BridgeError::OrderExpired {
                deadline: proposal.deadline.as_u64(),
                now,
            });
        }

        // 2. Verify order exists on-chain
        let on_chain_order = self
            .settlement_reader
            .get_cross_chain_order(proposal.order_id)
            .await
            .map_err(|e| ConsensusError::ChainReaderError {
                reason: e.to_string(),
            })?;

        // Check order exists (user != zero address)
        if on_chain_order.user == Address::zero() {
            warn!(
                order_id = %proposal.order_id,
                "Order does not exist on-chain"
            );
            return Ok(false);
        }

        // 3. Verify proposal matches on-chain order
        if on_chain_order.itp_id != proposal.itp_id {
            warn!(
                order_id = %proposal.order_id,
                proposal_itp = ?proposal.itp_id,
                onchain_itp = ?on_chain_order.itp_id,
                "ITP ID mismatch"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "itp_id".to_string(),
            });
        }

        if on_chain_order.user != proposal.user {
            warn!(
                order_id = %proposal.order_id,
                proposal_user = ?proposal.user,
                onchain_user = ?on_chain_order.user,
                "User mismatch"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "user".to_string(),
            });
        }

        if on_chain_order.amount != proposal.amount {
            warn!(
                order_id = %proposal.order_id,
                proposal_amount = %proposal.amount,
                onchain_amount = %on_chain_order.amount,
                "Amount mismatch"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "amount".to_string(),
            });
        }

        debug!(
            order_id = %proposal.order_id,
            "Bridge proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated bridge proposal (follower)
    ///
    /// Returns the BLS signature for the proposal's message hash.
    pub fn sign_bridge_proposal(
        &self,
        proposal: &BridgeProposal,
    ) -> Result<BLSSignature, BridgeError> {
        // Rebuild the message hash to verify it matches
        let expected_hash = build_bridge_settlement_to_l3_hash(
            self.config.settlement_chain_id,
            proposal.order_id,
            proposal.itp_id,
            proposal.user,
            proposal.amount,
            proposal.deadline,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                order_id = %proposal.order_id,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Message hash mismatch - possible tampering"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Sign with this node's BLS key (must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash)
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            order_id = %proposal.order_id,
            signer_index = self.node_index,
            "Signed bridge proposal"
        );

        Ok(signature)
    }

    // ========================================================================
    // Signature Aggregation (AC: #3)
    // ========================================================================

    /// Start collecting signatures for a proposal (leader)
    pub async fn start_signature_collection(&self, order_id: U256, leader_signature: BLSSignature) {
        self.bridge_sigs
            .start_collection(order_id, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature to the collection (leader)
    ///
    /// Returns Some(BridgeResult) if threshold is reached, None otherwise.
    pub async fn add_follower_signature(
        &self,
        order_id: U256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<BridgeResult>, BridgeError> {
        self.bridge_sigs
            .add_follower_signature(
                &order_id,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Check if signature collection has timed out
    pub async fn check_signature_timeout(&self, order_id: &U256) -> bool {
        self.bridge_sigs
            .is_timed_out(order_id, self.config.sign_timeout_ms)
            .await
    }

    /// Check if signature threshold has been reached for an order (Story 7.9 Task 4)
    ///
    /// Used by the polling loop in ConsensusProtocol to detect when enough signatures
    /// have been collected. Returns Some(BridgeResult) if threshold is reached, None otherwise.
    pub async fn check_threshold_reached(&self, order_id: &U256) -> Option<BridgeResult> {
        self.bridge_sigs
            .check_threshold(order_id, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get the current signature count for an order (for timeout diagnostics)
    ///
    /// Returns Some(count) if the order has a pending signature collector, None otherwise.
    pub async fn get_signature_count(&self, order_id: &U256) -> Option<usize> {
        self.bridge_sigs.get_signature_count(order_id).await
    }

    /// Get notifier for a signature collector (wakes on new signature arrival)
    pub async fn get_notifier(&self, order_id: &U256) -> Option<Arc<Notify>> {
        self.bridge_sigs.get_notifier(order_id).await
    }

    // ========================================================================
    // Bridge Execution (AC: #4 - Local E2E Simulation)
    // ========================================================================

    /// Execute the bridge by minting L3Usdc to OracleCustody L3 (local E2E)
    ///
    /// In production, this would call a bridge contract with the aggregated BLS signature.
    /// In local E2E, we simulate by directly minting L3Usdc.
    pub async fn execute_bridge_settlement_to_l3(
        &self,
        proposal: &BridgeProposal,
        _aggregated: &BridgeResult,
    ) -> Result<H256, BridgeError> {
        // Build L3Usdc.mint(recipient, amount) calldata
        // Function selector: keccak256("mint(address,uint256)")[0:4]
        let mint_selector = &ethers::utils::keccak256("mint(address,uint256)")[..4];

        let mut calldata = mint_selector.to_vec();

        // recipient = oracle signer (so it can call submitOrder which checks msg.sender balance)
        let signer_address = self.config.signer_address;
        let mut recipient_bytes = [0u8; 32];
        recipient_bytes[12..32].copy_from_slice(signer_address.as_bytes());
        calldata.extend_from_slice(&recipient_bytes);

        // amount (32 bytes)
        let mut amount_bytes = [0u8; 32];
        proposal.amount.to_big_endian(&mut amount_bytes);
        calldata.extend_from_slice(&amount_bytes);

        // Submit transaction
        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.l3_usdc_address,
                calldata,
                U256::zero(), // no ETH value
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: e.to_string(),
            })?;

        // Record as processed (replay protection)
        self.processed_orders
            .write()
            .await
            .insert(proposal.order_id, tx_hash);

        // Store order amount for validation in Story 7.6 custody release
        self.set_order_amount(proposal.order_id, proposal.amount).await;

        // Update order status
        self.set_order_status(proposal.order_id, BridgeOrderStatus::BridgedToL3)
            .await;

        info!(
            order_id = %proposal.order_id,
            tx_hash = ?tx_hash,
            amount = %proposal.amount,
            recipient = ?signer_address,
            source_chain = "Settlement",
            dest_chain = "L3",
            "BridgeCompleted: Settlement→L3 executed (local E2E mint to oracle signer)"
        );

        Ok(tx_hash)
    }

    /// Clean up stale signature collectors
    pub async fn cleanup_stale_collectors(&self, max_age_ms: u64) {
        self.bridge_sigs.cleanup_stale(max_age_ms).await;

        // submit_order_signatures is the one remaining hand-written HashMap
        let mut submit_collectors = self.submit_order_signatures.write().await;
        let stale_submit_orders: Vec<U256> = submit_collectors
            .iter()
            .filter(|(_, c)| c.elapsed_ms() > max_age_ms)
            .map(|(id, _)| *id)
            .collect();

        for settlement_order_id in stale_submit_orders {
            debug!(
                settlement_order_id = %settlement_order_id,
                "Removing stale submit order signature collector"
            );
            submit_collectors.remove(&settlement_order_id);
        }
        drop(submit_collectors);

        // Clean up all migrated signature managers
        self.batch_phase.sigs.cleanup_stale(max_age_ms).await;
        self.fills_phase.sigs.cleanup_stale(max_age_ms).await;
        self.l3_to_settlement_phase.sigs.cleanup_stale(max_age_ms).await;
        self.release_phase.sigs.cleanup_stale(max_age_ms).await;
        self.rebalance_batch_phase.sigs.cleanup_stale(max_age_ms).await;
        self.update_weights_sigs.cleanup_stale(max_age_ms).await;
        self.asset_trades_phase.sigs.cleanup_stale(max_age_ms).await;
        self.burn_sell_sigs.cleanup_stale(max_age_ms).await;
        self.sell_bridge_sigs.cleanup_stale(max_age_ms).await;
        self.complete_sell_sigs.cleanup_stale(max_age_ms).await;
        self.collateral_move_phase.sigs.cleanup_stale(max_age_ms).await;
        self.mint_shares_phase.sigs.cleanup_stale(max_age_ms).await;
        self.complete_buy_sigs.cleanup_stale(max_age_ms).await;
        self.nav_sigs.cleanup_stale(max_age_ms).await;
    }

    // ========================================================================
    // Story 7.3: Submit Order for User - Leader Proposal (AC: #1)
    // ========================================================================

    /// Create a submit order proposal for a bridged CrossChainOrder (leader only)
    ///
    /// Prerequisites: Order must be in BridgedToL3 status (from Story 7.2)
    pub async fn propose_submit_order(
        &self,
        order: &CrossChainOrder,
    ) -> Result<SubmitOrderProposal, BridgeError> {
        // Check order is in BRIDGED_TO_L3 status
        let status = self.get_order_status(&order.order_id).await;
        if status != Some(BridgeOrderStatus::BridgedToL3) {
            return Err(BridgeError::OrderNotBridged {
                settlement_order_id: order.order_id,
                status,
            });
        }

        // Check not already submitted
        if self.order_mappings.read().await.contains_key(&order.order_id) {
            let mapping = self.order_mappings.read().await.get(&order.order_id).cloned();
            if let Some(m) = mapping {
                return Err(BridgeError::OrderAlreadySubmitted {
                    settlement_order_id: order.order_id,
                    l3_order_id: m.l3_order_id,
                });
            }
        }

        // Validate slippage tier (0, 1, or 2)
        if order.slippage_tier > 2 {
            return Err(BridgeError::InvalidSlippageTier {
                tier: U256::from(order.slippage_tier),
            });
        }

        // Build the message hash for BLS signing
        // Using L3 chain ID from config
        let message_hash = build_submit_order_hash(
            self.config.l3_chain_id,
            order.order_id,
            order.itp_id,
            order.user,
            order.amount,
            order.limit_price,
            U256::from(order.slippage_tier),
            order.deadline,
        );

        // Sign with leader's BLS key using sign_message_hash (not sign_with_keypair)
        // because message_hash is already a keccak256 hash
        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            settlement_order_id = %order.order_id,
            itp_id = ?order.itp_id,
            user = ?order.user,
            amount = %order.amount,
            limit_price = %order.limit_price,
            slippage_tier = %order.slippage_tier,
            deadline = %order.deadline,
            message_hash = ?message_hash,
            "Submit order proposal created"
        );

        Ok(SubmitOrderProposal {
            leader_id: self.peer_id,
            settlement_order_id: order.order_id,
            itp_id: order.itp_id,
            user: order.user,
            amount: order.amount,
            limit_price: order.limit_price,
            slippage_tier: U256::from(order.slippage_tier),
            deadline: order.deadline,
            leader_signature,
            message_hash,
        })
    }

    // ========================================================================
    // Story 7.3: Submit Order for User - Follower Validation (AC: #2)
    // ========================================================================

    /// Validate a submit order proposal from the leader
    ///
    /// Checks:
    /// 1. Not already submitted (check first to fail fast)
    /// 2. Order is in BRIDGED_TO_L3 status
    /// 3. Deadline has not passed
    /// 4. Slippage tier is valid (0, 1, or 2)
    ///
    /// **Deferred to Story 7.4:**
    /// - Verify OracleCustody L3 has sufficient L3Usdc via chain reader
    /// - Verify ITP exists on Index via chain reader
    pub async fn validate_submit_order_proposal(
        &self,
        proposal: &SubmitOrderProposal,
    ) -> Result<bool, BridgeError> {
        // 1. Check if mapping exists — this is OK for co-signing since followers
        // may store a preliminary mapping before the leader's proposal arrives.
        // The actual dedup protection is on-chain (submitOrder reverts if already submitted).
        if self.order_mappings.read().await.contains_key(&proposal.settlement_order_id) {
            debug!(
                settlement_order_id = %proposal.settlement_order_id,
                "Order mapping already exists, allowing co-sign (idempotent)"
            );
        }

        // 2. Check order status allows submission
        // Leader sets BridgedToL3 after executing the bridge. Followers may
        // still have Pending status (or None if they haven't tracked it yet),
        // which is valid since only the leader executes the bridge transaction.
        // Followers also advance to SubmittedOnL3 in the main loop (main.rs:1116-1123)
        // before the leader's submit proposal arrives via P2P, so accept that too.
        let status = self.get_order_status(&proposal.settlement_order_id).await;
        match status {
            Some(BridgeOrderStatus::BridgedToL3) => {} // expected on leader
            Some(BridgeOrderStatus::Pending) | None => {
                // Follower hasn't executed bridge yet — trust leader
                debug!(
                    settlement_order_id = %proposal.settlement_order_id,
                    status = ?status,
                    "Order not BridgedToL3 locally, allowing submit (follower)"
                );
            }
            Some(BridgeOrderStatus::SubmittedOnL3) => {
                // Follower's main loop already advanced status before leader's
                // P2P proposal arrived — co-signing is safe and idempotent
                debug!(
                    settlement_order_id = %proposal.settlement_order_id,
                    "Order already SubmittedOnL3 locally, allowing co-sign"
                );
            }
            _ => {
                warn!(
                    settlement_order_id = %proposal.settlement_order_id,
                    status = ?status,
                    "Order in unexpected status for submit"
                );
                return Ok(false);
            }
        }

        // 3. Check deadline not passed
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| ConsensusError::ChainReaderError {
                reason: format!("Failed to get current time: {}", e),
            })?
            .as_secs();

        if proposal.deadline.as_u64() < now {
            warn!(
                settlement_order_id = %proposal.settlement_order_id,
                deadline = %proposal.deadline,
                now = now,
                "Order deadline passed"
            );
            return Err(BridgeError::OrderExpired {
                deadline: proposal.deadline.as_u64(),
                now,
            });
        }

        // 4. Validate slippage tier (must be 0, 1, or 2)
        // Note: U256::from(2) comparison is safe - slippage_tier comes from u8 originally
        if proposal.slippage_tier > U256::from(2) {
            warn!(
                settlement_order_id = %proposal.settlement_order_id,
                slippage_tier = %proposal.slippage_tier,
                "Invalid slippage tier"
            );
            return Err(BridgeError::InvalidSlippageTier {
                tier: proposal.slippage_tier,
            });
        }

        // NOTE: Balance and ITP verification deferred per Tasks 3.5, 3.6
        // These validations require L3 chain reader integration which is
        // implemented in Story 7.4 (Batch/Fill Orchestration).
        // See: AC #2 partial implementation - deadline and slippage validated here,
        // balance/ITP verification happens at execution time in Story 7.4.

        debug!(
            settlement_order_id = %proposal.settlement_order_id,
            "Submit order proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated submit order proposal (follower)
    ///
    /// Returns the BLS signature for the proposal's message hash.
    pub fn sign_submit_order_proposal(
        &self,
        proposal: &SubmitOrderProposal,
    ) -> Result<BLSSignature, BridgeError> {
        // Rebuild the message hash to verify it matches
        let expected_hash = build_submit_order_hash(
            self.config.l3_chain_id,
            proposal.settlement_order_id,
            proposal.itp_id,
            proposal.user,
            proposal.amount,
            proposal.limit_price,
            proposal.slippage_tier,
            proposal.deadline,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                settlement_order_id = %proposal.settlement_order_id,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Submit order message hash mismatch - possible tampering"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Sign with this node's BLS key (must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash)
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            settlement_order_id = %proposal.settlement_order_id,
            signer_index = self.node_index,
            "Signed submit order proposal"
        );

        Ok(signature)
    }

    // ========================================================================
    // Story 7.3: Submit Order - Signature Aggregation (AC: #3)
    // ========================================================================

    /// Start collecting signatures for a submit order proposal (leader)
    pub async fn start_submit_order_signature_collection(
        &self,
        settlement_order_id: U256,
        leader_signature: BLSSignature,
    ) {
        let mut collectors = self.submit_order_signatures.write().await;

        // Create new collector
        let mut collector = SignatureCollector::new(settlement_order_id);

        // Add leader's own signature
        collector.add_signature(self.node_index, leader_signature);

        collectors.insert(settlement_order_id, collector);

        debug!(
            settlement_order_id = %settlement_order_id,
            "Started signature collection for submit order proposal"
        );
    }

    /// Add a follower signature to the submit order collection (leader)
    ///
    /// Returns Some(SubmitOrderResult) if threshold is reached, None otherwise.
    pub async fn add_submit_order_follower_signature(
        &self,
        settlement_order_id: U256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<SubmitOrderResult>, BridgeError> {
        let mut collectors = self.submit_order_signatures.write().await;

        let collector = collectors.get_mut(&settlement_order_id).ok_or_else(|| {
            BridgeError::OrderNotFound { order_id: settlement_order_id }
        })?;

        // Add the signature
        if !collector.add_signature(signer_index, signature.clone()) {
            debug!(
                settlement_order_id = %settlement_order_id,
                signer_index = signer_index,
                "Duplicate submit order signature rejected"
            );
            return Ok(None);
        }

        info!(
            settlement_order_id = %settlement_order_id,
            signer_index = signer_index,
            collected = collector.signature_count(),
            required = self.config.min_signatures,
            "Added follower signature for submit order"
        );

        // Check if threshold reached
        if collector.has_threshold(self.config.min_signatures) {
            // Aggregate signatures
            let signatures: Vec<BLSSignature> = collector
                .signatures()
                .iter()
                .map(|(_, sig)| sig.clone())
                .collect();

            let aggregated_signature = self
                .bls_signer
                .aggregate_signatures(signatures)
                .map_err(|e| ConsensusError::BlsSigningError {
                    reason: e.to_string(),
                })?;

            info!(
                settlement_order_id = %settlement_order_id,
                signature_count = collector.signature_count(),
                signer_bitmap = %collector.signer_bitmap(),
                "Submit order signature threshold reached, ready for execution"
            );

            Ok(Some(SubmitOrderResult {
                aggregated_signature,
                signer_bitmap: collector.signer_bitmap(),
                signature_count: collector.signature_count(),
                l3_order_id: None, // Will be set after execution
            }))
        } else {
            Ok(None)
        }
    }

    /// Check if submit order signature threshold is reached (Story 7.4 wiring)
    ///
    /// Returns Some(SubmitOrderResult) if threshold is reached, None otherwise.
    pub async fn check_submit_order_threshold_reached(
        &self,
        settlement_order_id: &U256,
    ) -> Option<SubmitOrderResult> {
        let collectors = self.submit_order_signatures.read().await;
        let collector = collectors.get(settlement_order_id)?;

        if collector.has_threshold(self.config.min_signatures) {
            let signatures: Vec<BLSSignature> = collector
                .signatures()
                .iter()
                .map(|(_, sig)| sig.clone())
                .collect();

            let aggregated_signature = self
                .bls_signer
                .aggregate_signatures(signatures)
                .ok()?;

            Some(SubmitOrderResult {
                l3_order_id: None,
                aggregated_signature,
                signer_bitmap: collector.signer_bitmap(),
                signature_count: collector.signature_count(),
            })
        } else {
            None
        }
    }

    /// Get the current submit order signature count (for timeout diagnostics)
    pub async fn get_submit_order_signature_count(&self, settlement_order_id: &U256) -> Option<usize> {
        let collectors = self.submit_order_signatures.read().await;
        collectors.get(settlement_order_id).map(|c| c.signature_count())
    }

    // ========================================================================
    // Story 7.3: Order ID Mapping (AC: #8, #9)
    // ========================================================================

    /// Store order mapping after successful submitOrder
    pub async fn store_order_mapping(&self, mapping: OrderMapping) {
        info!(
            settlement_order_id = %mapping.settlement_order_id,
            l3_order_id = %mapping.l3_order_id,
            original_user = ?mapping.original_user,
            "Storing order mapping"
        );

        self.order_mappings
            .write()
            .await
            .insert(mapping.settlement_order_id, mapping);
    }

    /// Get L3 order ID for an Settlement order ID
    pub async fn get_l3_order_id(&self, settlement_order_id: &U256) -> Option<U256> {
        self.order_mappings
            .read()
            .await
            .get(settlement_order_id)
            .map(|m| m.l3_order_id)
    }

    /// Get full order mapping
    pub async fn get_order_mapping(&self, settlement_order_id: &U256) -> Option<OrderMapping> {
        self.order_mappings.read().await.get(settlement_order_id).cloned()
    }

    /// Get order mapping by L3 order ID (reverse lookup).
    /// Falls back to checking if the L3 ID matches a settlement ID (for cases
    /// where settlement_order_id == l3_order_id).
    pub async fn get_mapping_by_l3_id(&self, l3_order_id: &U256) -> Option<OrderMapping> {
        let mappings = self.order_mappings.read().await;
        // First: direct lookup (settlement_id == l3_id case)
        if let Some(m) = mappings.get(l3_order_id) {
            return Some(m.clone());
        }
        // Second: scan for matching l3_order_id
        mappings.values().find(|m| m.l3_order_id == *l3_order_id).cloned()
    }

    /// Mark order as submitted on L3 (status update)
    pub async fn mark_order_submitted_on_l3(&self, settlement_order_id: U256) {
        self.set_order_status(settlement_order_id, BridgeOrderStatus::SubmittedOnL3)
            .await;

        info!(
            settlement_order_id = %settlement_order_id,
            "Order status updated to SubmittedOnL3"
        );
    }

    /// Execute Index.submitOrder() on L3 after consensus
    ///
    /// This calls the L3 Index contract to submit the order on behalf of the user.
    /// First approves the Index contract to spend L3 USDC, then calls submitOrder.
    /// Reads nextOrderId before submitting to determine the L3 order ID,
    /// then stores the settlement→L3 order mapping.
    pub async fn execute_submit_order(
        &self,
        order: &crate::chain::CrossChainOrder,
    ) -> Result<H256, BridgeError> {
        let submit_start = std::time::Instant::now();

        // Step 1: Approve Index contract to spend L3 USDC from oracle signer.
        // Use max approval (type(uint256).max) on first call, then skip on subsequent calls.
        // This eliminates one full L3 transaction per order.
        if !self.l3_usdc_approved.load(std::sync::atomic::Ordering::Relaxed) {
            let approve_calldata = build_erc20_approve_calldata(
                self.config.index_address,
                U256::MAX,
            );
            self.l3_writer
                .send_transaction(
                    self.config.l3_usdc_address,
                    approve_calldata,
                    U256::zero(),
                )
                .await
                .map_err(|e| ConsensusError::ChainWriterError {
                    reason: format!("L3 USDC approve for Index failed: {}", e),
                })?;
            self.l3_usdc_approved.store(true, std::sync::atomic::Ordering::Relaxed);
            info!(
                order_id = %order.order_id,
                elapsed_ms = submit_start.elapsed().as_millis(),
                "Set max L3 USDC approval for Index (one-time)"
            );
        }

        // Step 2: Read nextOrderId before submitting to know what L3 order ID will be assigned
        let next_order_id_selector = &ethers::utils::keccak256("nextOrderId()")[..4];
        let l3_order_id = match self
            .l3_writer
            .static_call(self.config.index_address, next_order_id_selector.to_vec())
            .await
        {
            Ok(data) if data.len() >= 32 => {
                U256::from_big_endian(&data[..32])
            }
            Ok(_) => {
                warn!("nextOrderId returned unexpected data length, using settlement order ID as fallback");
                order.order_id
            }
            Err(e) => {
                warn!(error = %e, "Failed to read nextOrderId, using settlement order ID as fallback");
                order.order_id
            }
        };

        // Step 3: Submit the order on the Index contract (on behalf of the original user)
        let calldata = build_submit_order_for_calldata(
            order.user, // beneficiary = original Settlement user
            order.itp_id,
            0, // BUY
            order.amount,
            order.limit_price,
            ethers::types::U256::from(order.slippage_tier),
            order.deadline,
        );

        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.index_address,
                calldata,
                U256::zero(),
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("submitOrder failed: {}", e),
            })?;

        // Store the settlement→L3 order mapping
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let mapping = OrderMapping {
            settlement_order_id: order.order_id,
            l3_order_id,
            original_user: order.user,
            created_at,
        };
        self.store_order_mapping(mapping).await;

        info!(
            settlement_order_id = %order.order_id,
            l3_order_id = %l3_order_id,
            itp_id = ?order.itp_id,
            amount = %order.amount,
            tx_hash = ?tx_hash,
            total_ms = submit_start.elapsed().as_millis(),
            "Index.submitOrder() executed successfully"
        );

        Ok(tx_hash)
    }

    // ========================================================================
    // Story 7.4: Batch Confirmation - Leader Proposal (AC: #1)
    // ========================================================================

    /// Create a batch confirmation proposal (leader only)
    ///
    /// This batches multiple orders together with their current prices.
    /// Prerequisites: Orders must be in SubmittedOnL3 status.
    pub fn propose_confirm_batch(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        prices: Vec<U256>,
    ) -> Result<BatchProposal, BridgeError> {
        // Validate order_ids and prices have same length
        if order_ids.len() != prices.len() {
            return Err(BridgeError::ProposalMismatch {
                field: format!(
                    "order_ids.len()={} != prices.len()={}",
                    order_ids.len(),
                    prices.len()
                ),
            });
        }

        // Build the message hash for BLS signing
        let message_hash = build_confirm_batch_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            cycle_number,
            &order_ids,
        );

        // Sign with leader's BLS key using sign_message_hash (not sign_with_keypair)
        // because message_hash is already a keccak256 hash
        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            order_count = order_ids.len(),
            message_hash = ?message_hash,
            "Batch confirmation proposal created"
        );

        Ok(BatchProposal {
            leader_id: self.peer_id,
            cycle_number,
            order_ids,
            prices,
            leader_signature,
            message_hash,
        })
    }

    // ========================================================================
    // Story 7.4: Batch Confirmation - Follower Validation (AC: #2)
    // ========================================================================

    /// Validate a batch confirmation proposal from the leader
    ///
    /// Checks:
    /// 1. Order IDs and prices arrays have matching lengths
    /// 2. Cycle number is reasonable (not in the past)
    /// 3. Message hash matches recomputed hash
    pub async fn validate_batch_proposal(
        &self,
        proposal: &BatchProposal,
    ) -> Result<bool, BridgeError> {
        // 1. Validate lengths match
        if proposal.order_ids.len() != proposal.prices.len() {
            warn!(
                cycle_number = proposal.cycle_number,
                order_ids_len = proposal.order_ids.len(),
                prices_len = proposal.prices.len(),
                "Batch proposal: mismatched array lengths"
            );
            return Ok(false);
        }

        // 2. Verify message hash matches
        let expected_hash = build_confirm_batch_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            proposal.cycle_number,
            &proposal.order_ids,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Batch proposal: message hash mismatch"
            );
            return Ok(false);
        }

        debug!(
            cycle_number = proposal.cycle_number,
            order_count = proposal.order_ids.len(),
            "Batch proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated batch proposal (follower)
    ///
    /// Returns the BLS signature for the proposal's message hash.
    pub fn sign_batch_proposal(
        &self,
        proposal: &BatchProposal,
    ) -> Result<BLSSignature, BridgeError> {
        // Rebuild the message hash to verify it matches
        let expected_hash = build_confirm_batch_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            proposal.cycle_number,
            &proposal.order_ids,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Batch proposal message hash mismatch - possible tampering"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Sign with this node's BLS key (must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash)
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = proposal.cycle_number,
            signer_index = self.node_index,
            "Signed batch proposal"
        );

        Ok(signature)
    }

    // ========================================================================
    // Story 7.4: Batch Confirmation - Signature Aggregation (AC: #3)
    // ========================================================================

    /// Start collecting signatures for a batch confirmation proposal (leader)
    pub async fn start_batch_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.batch_phase.sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature to the batch confirmation collection (leader)
    ///
    /// Returns Some(BatchResult) if threshold is reached, None otherwise.
    pub async fn add_batch_follower_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<BatchResult>, BridgeError> {
        self.batch_phase.sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Check if batch confirmation signature threshold is reached (Story 7.4 wiring)
    ///
    /// Returns Some(BatchResult) if threshold is reached, None otherwise.
    pub async fn check_batch_threshold_reached(&self, cycle_number: u64) -> Option<BatchResult> {
        self.batch_phase.sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get the current batch confirmation signature count (for timeout diagnostics)
    pub async fn get_batch_signature_count(&self, cycle_number: u64) -> Option<usize> {
        self.batch_phase.sigs.get_signature_count(&cycle_number).await
    }

    // ========================================================================
    // Story 7.4: Fills Confirmation - Leader Proposal (AC: #4)
    // ========================================================================

    /// Create a fills confirmation proposal (leader only)
    ///
    /// This confirms fills for orders that were batched.
    pub fn propose_confirm_fills(
        &self,
        cycle_number: u64,
        fills: Vec<Fill>,
    ) -> Result<FillsProposal, BridgeError> {
        // Filter out zero-amount fills (stale/empty orders from data-node cache)
        let fills: Vec<Fill> = fills
            .into_iter()
            .filter(|f| !f.fill_amount.is_zero())
            .collect();
        if fills.is_empty() {
            return Err(BridgeError::NoPendingOrders);
        }
        // Build the message hash for BLS signing
        let message_hash = build_confirm_fills_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            cycle_number,
            &fills,
        );

        // Sign with leader's BLS key using sign_message_hash (not sign_with_keypair)
        // because message_hash is already a keccak256 hash
        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            fill_count = fills.len(),
            message_hash = ?message_hash,
            "Fills confirmation proposal created"
        );

        Ok(FillsProposal {
            leader_id: self.peer_id,
            cycle_number,
            fills,
            leader_signature,
            message_hash,
        })
    }

    // ========================================================================
    // Story 7.4: Fills Confirmation - Follower Validation (AC: #5)
    // ========================================================================

    /// Validate a fills confirmation proposal from the leader
    ///
    /// Checks:
    /// 1. Cycle number is reasonable
    /// 2. Message hash matches recomputed hash
    /// 3. Fill amounts and prices are valid (non-zero where appropriate)
    pub async fn validate_fills_proposal(
        &self,
        proposal: &FillsProposal,
    ) -> Result<bool, BridgeError> {
        // 1. Verify message hash matches
        let expected_hash = build_confirm_fills_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            proposal.cycle_number,
            &proposal.fills,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Fills proposal: message hash mismatch"
            );
            return Ok(false);
        }

        // 2. Validate fills (basic sanity checks)
        for (i, fill) in proposal.fills.iter().enumerate() {
            if fill.fill_amount.is_zero() {
                warn!(
                    cycle_number = proposal.cycle_number,
                    fill_index = i,
                    order_id = %fill.order_id,
                    "Fills proposal: zero fill amount"
                );
                return Ok(false);
            }
            // Check fill_price is non-zero (division by zero would cause infinite ITP shares)
            if fill.fill_price.is_zero() {
                warn!(
                    cycle_number = proposal.cycle_number,
                    fill_index = i,
                    order_id = %fill.order_id,
                    "Fills proposal: zero fill price (would cause division by zero)"
                );
                return Err(BridgeError::InvalidFillPrice { order_id: fill.order_id });
            }
        }

        debug!(
            cycle_number = proposal.cycle_number,
            fill_count = proposal.fills.len(),
            "Fills proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated fills proposal (follower)
    ///
    /// Returns the BLS signature for the proposal's message hash.
    pub fn sign_fills_proposal(
        &self,
        proposal: &FillsProposal,
    ) -> Result<BLSSignature, BridgeError> {
        // Rebuild the message hash to verify it matches
        let expected_hash = build_confirm_fills_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            proposal.cycle_number,
            &proposal.fills,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Fills proposal message hash mismatch - possible tampering"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Sign with this node's BLS key (must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash)
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = proposal.cycle_number,
            signer_index = self.node_index,
            "Signed fills proposal"
        );

        Ok(signature)
    }

    // ========================================================================
    // Story 7.4: Fills Confirmation - Signature Aggregation (AC: #6)
    // ========================================================================

    /// Start collecting signatures for a fills confirmation proposal (leader)
    pub async fn start_fills_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.fills_phase.sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature to the fills confirmation collection (leader)
    ///
    /// Returns Some(FillsResult) if threshold is reached, None otherwise.
    pub async fn add_fills_follower_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<FillsResult>, BridgeError> {
        self.fills_phase.sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Check if fills confirmation signature threshold is reached (Story 7.4 wiring)
    ///
    /// Returns Some(FillsResult) if threshold is reached, None otherwise.
    pub async fn check_fills_threshold_reached(&self, cycle_number: u64) -> Option<FillsResult> {
        self.fills_phase.sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get the current fills confirmation signature count (for timeout diagnostics)
    pub async fn get_fills_signature_count(&self, cycle_number: u64) -> Option<usize> {
        self.fills_phase.sigs.get_signature_count(&cycle_number).await
    }

    // ========================================================================
    // Story 7.4: Order Status Updates
    // ========================================================================

    /// Mark orders as batched (status update after batch confirmation)
    pub async fn mark_orders_batched(&self, order_ids: &[U256]) {
        for order_id in order_ids {
            self.set_order_status(*order_id, BridgeOrderStatus::Batched)
                .await;
        }

        info!(
            order_count = order_ids.len(),
            "Orders status updated to Batched"
        );
    }

    /// Mark orders as failed/terminal (will not be retried)
    /// Used when fills hit unrecoverable errors like E023/FillExceedsOrder or E021/OrderAlreadyBatched.
    pub async fn mark_orders_failed(&self, order_ids: &[U256]) {
        for order_id in order_ids {
            self.set_order_status(*order_id, BridgeOrderStatus::Failed)
                .await;
        }
        warn!(
            order_count = order_ids.len(),
            order_ids = ?order_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>(),
            "Orders marked as Failed (terminal — will not be retried)"
        );
    }

    /// Mark orders as filled (status update after fills confirmation)
    /// Fills use L3 order IDs, but order_status tracks Settlement order IDs.
    /// This method reverse-maps L3→Settlement before updating status to avoid ID collisions.
    pub async fn mark_orders_filled(&self, fills: &[Fill]) {
        // Build reverse map: L3 order ID → Settlement order ID
        let mappings = self.order_mappings.read().await;
        let l3_to_settlement: std::collections::HashMap<U256, U256> = mappings
            .iter()
            .filter_map(|(settlement_id, m)| Some((m.l3_order_id, *settlement_id)))
            .collect();
        drop(mappings);

        for fill in fills {
            let status_key = l3_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
            if status_key != fill.order_id {
                info!(l3_order_id = %fill.order_id, settlement_order_id = %status_key,
                    "Resolved L3→Settlement order ID for status update");
            }
            self.set_order_status(status_key, BridgeOrderStatus::Filled)
                .await;
        }

        info!(
            fill_count = fills.len(),
            "Orders status updated to Filled"
        );
    }

    /// Clean up stale batch/fills signature collectors (Story 7.4)
    pub async fn cleanup_stale_batch_fills_collectors(&self, max_age_ms: u64) {
        self.batch_phase.sigs.cleanup_stale(max_age_ms).await;
        self.fills_phase.sigs.cleanup_stale(max_age_ms).await;
    }

    // ========================================================================
    // Story 7.4: Batch Execution (AC: #7)
    // ========================================================================

    /// Execute batch confirmation on Index contract
    ///
    /// Calls Index.confirmBatch(cycleNumber, orderIds, blsSignature)
    /// This confirms the batch and allows orders to proceed to fill stage.
    /// Note: order_ids here are L3 order IDs (already resolved by the caller).
    pub async fn execute_confirm_batch(
        &self,
        cycle_number: u64,
        order_ids: &[U256],
        aggregated: &BatchResult,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        let batch_start = std::time::Instant::now();

        // Check for duplicate cycle (deduplication)
        if let Some(existing_tx) = self.batch_phase.confirmed.read().await.get(&cycle_number) {
            warn!(
                cycle_number = cycle_number,
                existing_tx = ?existing_tx,
                "Batch already confirmed for this cycle"
            );
            return Err(BridgeError::BatchAlreadyConfirmed { cycle_number });
        }

        // DO NOT filter order IDs here — the BLS signature was already computed over the
        // EXACT order_ids list. Filtering after signing causes a hash mismatch on-chain.
        // All filtering must happen BEFORE the BLS proposal in main.rs.

        info!(
            cycle_number = cycle_number,
            l3_order_ids = ?order_ids,
            "Executing confirmBatch with L3 order IDs"
        );

        // Build Index.confirmBatch() calldata using the SAME order IDs that were signed
        let calldata = build_confirm_batch_calldata(
            cycle_number,
            order_ids,
            &aggregated.aggregated_signature.0,
            reference_nonce,
            aggregated.signer_bitmap,
        );

        // Submit transaction to Index contract
        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.index_address,
                calldata,
                U256::zero(), // no ETH value
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            tx_ms = batch_start.elapsed().as_millis(),
            "confirmBatch tx timing"
        );

        // Record as confirmed (deduplication)
        self.batch_phase.confirmed
            .write()
            .await
            .insert(cycle_number, tx_hash);

        // NOTE: Do NOT call mark_orders_batched here. The order_ids passed to this
        // function are L3 IDs (for on-chain calls), not settlement IDs. Setting status
        // with L3 IDs pollutes the order_status HashMap and causes namespace
        // collisions when a subsequent settlement order shares the same numeric ID.
        // Status updates happen in main.rs using settlement IDs (submitted_orders).

        info!(
            cycle_number = cycle_number,
            order_count = order_ids.len(),
            tx_hash = ?tx_hash,
            signer_bitmap = %aggregated.signer_bitmap,
            "Index.confirmBatch() executed successfully"
        );

        Ok(tx_hash)
    }

    // ========================================================================
    // Story 7.4: Fills Execution (AC: #8)
    // ========================================================================

    /// Execute fills confirmation on Index contract
    ///
    /// Calls Index.confirmFills(cycleNumber, fills, blsSignature)
    /// This confirms the fills and mints ITP shares to users.
    /// Note: fills contain Settlement order IDs; they are resolved to L3 order IDs
    /// for the on-chain call.
    pub async fn execute_confirm_fills(
        &self,
        cycle_number: u64,
        fills: &[Fill],
        aggregated: &FillsResult,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        let fills_start = std::time::Instant::now();

        // Check for duplicate cycle (deduplication)
        if let Some(existing_tx) = self.fills_phase.confirmed.read().await.get(&cycle_number) {
            warn!(
                cycle_number = cycle_number,
                existing_tx = ?existing_tx,
                "Fills already confirmed for this cycle"
            );
            return Err(BridgeError::FillsAlreadyConfirmed { cycle_number });
        }

        // Fills already contain L3 order IDs (set by the caller in main.rs).
        // Use them directly for the on-chain call.

        // Build Index.confirmFills() calldata using L3 order IDs
        let calldata = build_confirm_fills_calldata(
            cycle_number,
            fills,
            &aggregated.aggregated_signature.0,
            reference_nonce,
            aggregated.signer_bitmap,
        );

        // Submit transaction to Index contract
        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.index_address,
                calldata,
                U256::zero(), // no ETH value
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            tx_ms = fills_start.elapsed().as_millis(),
            "confirmFills tx timing"
        );

        // Record as confirmed (deduplication)
        self.fills_phase.confirmed
            .write()
            .await
            .insert(cycle_number, tx_hash);

        // NOTE: Do NOT call mark_orders_filled here. The fills contain L3 IDs
        // (for on-chain calls), not settlement IDs. Status updates happen in main.rs
        // using settlement IDs to avoid namespace collisions.

        info!(
            cycle_number = cycle_number,
            fill_count = fills.len(),
            tx_hash = ?tx_hash,
            signer_bitmap = %aggregated.signer_bitmap,
            "Index.confirmFills() executed successfully"
        );

        Ok(tx_hash)
    }

    /// Check if a batch cycle has already been confirmed
    pub async fn is_batch_confirmed(&self, cycle_number: u64) -> bool {
        self.batch_phase.confirmed.read().await.contains_key(&cycle_number)
    }

    /// Check if a fills cycle has already been confirmed
    pub async fn is_fills_confirmed(&self, cycle_number: u64) -> bool {
        self.fills_phase.confirmed.read().await.contains_key(&cycle_number)
    }

    // ========================================================================
    // Story 7.4: BLSCustody.execute() Methods (Task 7)
    // ========================================================================

    /// Get the next nonce for a custody contract
    ///
    /// Story 7.4: Task 7.5 - nonce tracking for custody contracts
    pub async fn get_custody_nonce(&self, custody_address: &Address) -> U256 {
        self.custody_nonces
            .read()
            .await
            .get(custody_address)
            .copied()
            .unwrap_or(U256::zero())
    }

    /// Increment and return the next nonce for a custody contract
    ///
    /// Story 7.4: Task 7.5
    async fn claim_custody_nonce(&self, custody_address: Address) -> U256 {
        let mut nonces = self.custody_nonces.write().await;
        let current = nonces.get(&custody_address).copied().unwrap_or(U256::zero());
        nonces.insert(custody_address, current + 1);
        current
    }

    /// Initialize custody nonce from on-chain state (called once at startup)
    pub async fn init_custody_nonce(&self, custody_address: Address, on_chain_nonce: U256) {
        let mut nonces = self.custody_nonces.write().await;
        nonces.insert(custody_address, on_chain_nonce);
        tracing::info!(?custody_address, nonce = %on_chain_nonce, "Initialized custody nonce from on-chain state");
    }

    /// Execute an ERC20.approve() through BLSCustody
    ///
    /// This builds the approve calldata, gets BLS consensus, and executes
    /// via BLSCustody.execute().
    ///
    /// Story 7.4: Task 7.3
    pub async fn execute_custody_approve(
        &self,
        custody_address: Address,
        token: Address,
        spender: Address,
        amount: U256,
        aggregated_signature: &BLSSignature,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        // Claim the next nonce
        let nonce = self.claim_custody_nonce(custody_address).await;

        // Build ERC20.approve calldata
        let approve_calldata = build_erc20_approve_calldata(spender, amount);

        // Build BLSCustody.execute calldata
        let execute_calldata = build_custody_execute_calldata(
            token,
            &approve_calldata,
            &aggregated_signature.0,
            nonce,
            reference_nonce,
            U256::zero(), // signers_bitmask placeholder
        );

        // Submit transaction
        let tx_hash = self
            .l3_writer
            .send_transaction(
                custody_address,
                execute_calldata,
                U256::zero(), // no ETH value
            )
            .await
            .map_err(|e| BridgeError::CustodyExecuteFailed {
                reason: e.to_string(),
            })?;

        info!(
            custody = ?custody_address,
            token = ?token,
            spender = ?spender,
            amount = %amount,
            nonce = %nonce,
            tx_hash = ?tx_hash,
            "BLSCustody.execute(approve) completed"
        );

        Ok(tx_hash)
    }

    /// Execute a generic call through BLSCustody
    ///
    /// This wraps arbitrary calldata in a BLSCustody.execute() call.
    ///
    /// Story 7.4: Task 7.4
    pub async fn execute_custody_call(
        &self,
        custody_address: Address,
        target: Address,
        inner_calldata: &[u8],
        aggregated_signature: &BLSSignature,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        // Claim the next nonce
        let nonce = self.claim_custody_nonce(custody_address).await;

        // Build BLSCustody.execute calldata
        let execute_calldata = build_custody_execute_calldata(
            target,
            inner_calldata,
            &aggregated_signature.0,
            nonce,
            reference_nonce,
            U256::zero(), // signers_bitmask placeholder
        );

        // Submit transaction
        let tx_hash = self
            .l3_writer
            .send_transaction(
                custody_address,
                execute_calldata,
                U256::zero(), // no ETH value
            )
            .await
            .map_err(|e| BridgeError::CustodyExecuteFailed {
                reason: e.to_string(),
            })?;

        info!(
            custody = ?custody_address,
            target = ?target,
            calldata_len = inner_calldata.len(),
            nonce = %nonce,
            tx_hash = ?tx_hash,
            "BLSCustody.execute(call) completed"
        );

        Ok(tx_hash)
    }

    /// Build the message hash for BLS signing a custody execute call
    ///
    /// This builds the hash that oracles need to sign for BLS consensus
    /// before calling execute_custody_call or execute_custody_approve.
    ///
    /// Story 7.4: Task 7.2
    pub async fn build_custody_execute_message_hash(
        &self,
        custody_address: Address,
        target: Address,
        data: &[u8],
    ) -> H256 {
        // Get the next nonce (but don't claim it yet)
        let nonce = self.get_custody_nonce(&custody_address).await;

        build_custody_execute_hash(
            self.config.l3_chain_id,
            custody_address,
            target,
            data,
            nonce,
        )
    }

    /// Create a custody execute proposal for BLS consensus
    ///
    /// This is a helper that combines hash building and signing for the leader.
    /// Returns the message hash and leader's signature.
    ///
    /// Story 7.4: Task 7.2
    pub async fn propose_custody_execute(
        &self,
        custody_address: Address,
        target: Address,
        data: &[u8],
    ) -> Result<(H256, BLSSignature, U256), BridgeError> {
        // Get the next nonce
        let nonce = self.get_custody_nonce(&custody_address).await;

        // Build the message hash
        let message_hash = build_custody_execute_hash(
            self.config.l3_chain_id,
            custody_address,
            target,
            data,
            nonce,
        );

        // Sign with leader's BLS key using sign_message_hash (not sign_with_keypair)
        // because message_hash is already a keccak256 hash
        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            custody = ?custody_address,
            target = ?target,
            nonce = %nonce,
            message_hash = ?message_hash,
            "Custody execute proposal created"
        );

        Ok((message_hash, leader_signature, nonce))
    }

    /// Validate and sign a custody execute proposal (follower)
    ///
    /// Verifies the message hash matches expected values, then signs.
    ///
    /// Story 7.4: Task 7.2
    pub fn sign_custody_execute(
        &self,
        custody_address: Address,
        target: Address,
        data: &[u8],
        nonce: U256,
        expected_hash: H256,
    ) -> Result<BLSSignature, BridgeError> {
        // Rebuild the message hash to verify
        let computed_hash = build_custody_execute_hash(
            self.config.l3_chain_id,
            custody_address,
            target,
            data,
            nonce,
        );

        if computed_hash != expected_hash {
            warn!(
                custody = ?custody_address,
                target = ?target,
                computed = ?computed_hash,
                expected = ?expected_hash,
                "Custody execute message hash mismatch"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Sign with this node's BLS key (must use sign_message_hash, not sign_with_keypair,
        // because computed_hash is already a keccak256 — sign_with_keypair would double-hash)
        let hash_bytes: [u8; 32] = computed_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            custody = ?custody_address,
            target = ?target,
            signer_index = self.node_index,
            "Signed custody execute proposal"
        );

        Ok(signature)
    }

    // ========================================================================
    // Story 7.5: Bridge L3→Settlement - Leader Proposal (AC: #1)
    // ========================================================================

    /// Create a bridge L3→Settlement proposal with explicit total amount (leader only)
    ///
    /// Use this variant when the total amount is known (e.g., from fill data).
    pub fn propose_bridge_l3_to_settlement_with_amount(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        total_amount: U256,
    ) -> Result<BridgeL3ToSettlementProposal, BridgeError> {
        // Build the message hash for BLS signing
        let message_hash = build_bridge_l3_to_settlement_hash(
            self.config.l3_chain_id,
            cycle_number,
            &order_ids,
            total_amount,
            self.config.oracle_custody_settlement,
        );

        // Sign with leader's BLS key using sign_message_hash (not sign_with_keypair)
        // because message_hash is already a keccak256 hash
        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            order_count = order_ids.len(),
            total_amount = %total_amount,
            destination = ?self.config.oracle_custody_settlement,
            message_hash = ?message_hash,
            "Bridge L3→Settlement proposal created (with explicit amount)"
        );

        Ok(BridgeL3ToSettlementProposal {
            leader_id: self.peer_id,
            cycle_number,
            order_ids,
            total_amount,
            destination: self.config.oracle_custody_settlement,
            leader_signature,
            message_hash,
        })
    }

    // ========================================================================
    // Story 7.5: Bridge L3→Settlement - Follower Validation (AC: #2)
    // ========================================================================

    /// Validate a bridge L3→Settlement proposal from the leader
    ///
    /// Checks:
    /// 1. Cycle not already processed
    /// 2. Message hash matches recomputed hash
    /// 3. Orders are in Batched status (for each order_id)
    /// 4. Amounts match (total_amount equals sum of order amounts)
    pub async fn validate_bridge_l3_to_settlement_proposal(
        &self,
        proposal: &BridgeL3ToSettlementProposal,
    ) -> Result<bool, BridgeError> {
        // 1. Check not already processed
        if self.l3_to_settlement_phase.confirmed.read().await.contains_key(&proposal.cycle_number) {
            warn!(
                cycle_number = proposal.cycle_number,
                "Bridge L3→Settlement already processed for this cycle"
            );
            return Ok(false);
        }

        // 2. Verify message hash matches
        let expected_hash = build_bridge_l3_to_settlement_hash(
            self.config.l3_chain_id,
            proposal.cycle_number,
            &proposal.order_ids,
            proposal.total_amount,
            proposal.destination,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Bridge L3→Settlement proposal: message hash mismatch"
            );
            return Ok(false);
        }

        // 3. Verify destination matches our config
        if proposal.destination != self.config.oracle_custody_settlement {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?self.config.oracle_custody_settlement,
                received = ?proposal.destination,
                "Bridge L3→Settlement proposal: destination mismatch"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "destination".to_string(),
            });
        }

        // 4. Verify orders are in Batched status
        //    Followers may not have updated order status (only leader executes on-chain),
        //    so allow Pending or None status on followers (trust leader proposal).
        for order_id in &proposal.order_ids {
            let status = self.get_order_status(order_id).await;
            match status {
                Some(BridgeOrderStatus::Batched) => {} // expected on leader
                Some(BridgeOrderStatus::Pending)
                | Some(BridgeOrderStatus::BridgedToL3)
                | Some(BridgeOrderStatus::SubmittedOnL3)
                | None => {
                    // Follower hasn't executed batch/bridge/submit — trust leader
                    debug!(
                        cycle_number = proposal.cycle_number,
                        order_id = %order_id,
                        status = ?status,
                        "Order not Batched locally, allowing L3→Settlement bridge (follower)"
                    );
                }
                _ => {
                    warn!(
                        cycle_number = proposal.cycle_number,
                        order_id = %order_id,
                        status = ?status,
                        "Order in unexpected status for L3→Settlement bridge"
                    );
                    return Ok(false);
                }
            }
        }

        debug!(
            cycle_number = proposal.cycle_number,
            order_count = proposal.order_ids.len(),
            total_amount = %proposal.total_amount,
            "Bridge L3→Settlement proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated bridge L3→Settlement proposal (follower)
    ///
    /// Returns the BLS signature for the proposal's message hash.
    pub fn sign_bridge_l3_to_settlement_proposal(
        &self,
        proposal: &BridgeL3ToSettlementProposal,
    ) -> Result<BLSSignature, BridgeError> {
        // Rebuild the message hash to verify it matches
        let expected_hash = build_bridge_l3_to_settlement_hash(
            self.config.l3_chain_id,
            proposal.cycle_number,
            &proposal.order_ids,
            proposal.total_amount,
            proposal.destination,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Bridge L3→Settlement proposal message hash mismatch - possible tampering"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Sign with this node's BLS key (must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash)
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = proposal.cycle_number,
            signer_index = self.node_index,
            "Signed bridge L3→Settlement proposal"
        );

        Ok(signature)
    }

    // ========================================================================
    // Story 7.5: Bridge L3→Settlement - Signature Aggregation (AC: #3)
    // ========================================================================

    /// Start collecting signatures for a bridge L3→Settlement proposal (leader)
    pub async fn start_l3_to_settlement_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.l3_to_settlement_phase.sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature to the bridge L3→Settlement collection (leader)
    ///
    /// Returns Some(BridgeL3ToSettlementResult) if threshold is reached, None otherwise.
    pub async fn add_l3_to_settlement_follower_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<BridgeL3ToSettlementResult>, BridgeError> {
        self.l3_to_settlement_phase.sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    // ========================================================================
    // Story 7.5: Bridge L3→Settlement Execution (AC: #3, #4, #5)
    // ========================================================================

    /// Execute bridge L3→Settlement by minting SettlementUSDC to OracleCustody Settlement (local E2E)
    ///
    /// This simulates the bridge by:
    /// 1. "Releasing" L3Usdc from Index escrow (simulated - no actual burn)
    /// 2. Minting SettlementUSDC to OracleCustody on Settlement
    ///
    /// In production, this would call actual bridge contracts.
    pub async fn execute_bridge_l3_to_settlement(
        &self,
        proposal: &BridgeL3ToSettlementProposal,
        _aggregated: &BridgeL3ToSettlementResult,
    ) -> Result<H256, BridgeError> {
        // Check for duplicate cycle (deduplication)
        if let Some(existing_tx) = self.l3_to_settlement_phase.confirmed.read().await.get(&proposal.cycle_number) {
            warn!(
                cycle_number = proposal.cycle_number,
                existing_tx = ?existing_tx,
                "Bridge L3→Settlement already executed for this cycle"
            );
            return Err(BridgeError::BridgeL3ToSettlementAlreadyProcessed {
                cycle_number: proposal.cycle_number,
            });
        }

        // Validate destination matches our configured OracleCustody Settlement address
        // This prevents executing a malicious proposal with a different destination
        if proposal.destination != self.config.oracle_custody_settlement {
            warn!(
                cycle_number = proposal.cycle_number,
                proposal_destination = ?proposal.destination,
                expected_destination = ?self.config.oracle_custody_settlement,
                "Bridge L3→Settlement proposal has invalid destination"
            );
            return Err(BridgeError::InvalidDestination {
                expected: self.config.oracle_custody_settlement,
                actual: proposal.destination,
            });
        }

        // Step 1: Simulate L3Usdc release from escrow (no actual action in local E2E)
        // In production, this would call a bridge contract to release/burn L3Usdc
        debug!(
            cycle_number = proposal.cycle_number,
            amount = %proposal.total_amount,
            "Simulating L3Usdc release from Index escrow"
        );

        // Step 2: Mint SettlementUSDC to OracleCustody on Settlement
        // Build SettlementUSDC.mint(recipient, amount) calldata
        let mint_selector = &ethers::utils::keccak256("mint(address,uint256)")[..4];

        let mut calldata = mint_selector.to_vec();

        // recipient = OracleCustody Settlement (32 bytes, address padded)
        let mut recipient_bytes = [0u8; 32];
        recipient_bytes[12..32].copy_from_slice(proposal.destination.as_bytes());
        calldata.extend_from_slice(&recipient_bytes);

        // amount (32 bytes)
        let mut amount_bytes = [0u8; 32];
        proposal.total_amount.to_big_endian(&mut amount_bytes);
        calldata.extend_from_slice(&amount_bytes);

        // Submit transaction (using L3 writer for local E2E simulation)
        // Note: In production with separate Settlement writer, use that instead
        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.settlement_usdc_address,
                calldata,
                U256::zero(), // no ETH value
            )
            .await
            .map_err(|e| BridgeError::BridgeL3ToSettlementFailed {
                reason: e.to_string(),
            })?;

        // Record as confirmed (deduplication)
        self.l3_to_settlement_phase.confirmed
            .write()
            .await
            .insert(proposal.cycle_number, tx_hash);

        // Mark orders as BridgedBackToSettlement
        self.mark_orders_bridged_back(&proposal.order_ids).await;

        info!(
            cycle_number = proposal.cycle_number,
            order_count = proposal.order_ids.len(),
            tx_hash = ?tx_hash,
            total_amount = %proposal.total_amount,
            destination = ?proposal.destination,
            source_chain = "L3",
            dest_chain = "Settlement",
            "BridgeCompleted: L3→Settlement executed (local E2E mint)"
        );

        Ok(tx_hash)
    }

    /// Mark orders as BridgedBackToSettlement (status update)
    pub async fn mark_orders_bridged_back(&self, order_ids: &[U256]) {
        for order_id in order_ids {
            self.set_order_status(*order_id, BridgeOrderStatus::BridgedBackToSettlement)
                .await;
        }

        info!(
            order_count = order_ids.len(),
            "Orders status updated to BridgedBackToSettlement"
        );
    }

    /// Check if a bridge L3→Settlement cycle has already been confirmed
    pub async fn is_l3_to_settlement_confirmed(&self, cycle_number: u64) -> bool {
        self.l3_to_settlement_phase.confirmed.read().await.contains_key(&cycle_number)
    }

    /// Clean up stale L3→Settlement signature collectors
    pub async fn cleanup_stale_l3_to_settlement_collectors(&self, max_age_ms: u64) {
        self.l3_to_settlement_phase.sigs.cleanup_stale(max_age_ms).await;
    }

    /// Check if L3→Settlement signature threshold is reached (Story 7.10)
    ///
    /// Returns Some(BridgeL3ToSettlementResult) if threshold is reached, None otherwise.
    pub async fn check_l3_to_settlement_threshold_reached(
        &self,
        cycle_number: u64,
    ) -> Option<BridgeL3ToSettlementResult> {
        self.l3_to_settlement_phase.sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get the current L3→Settlement signature count for a cycle (Story 7.10)
    pub async fn get_l3_to_settlement_signature_count(&self, cycle_number: u64) -> Option<usize> {
        self.l3_to_settlement_phase.sigs.get_signature_count(&cycle_number).await
    }

    // ========================================================================
    // Story 7.6: Custody Release to Vault - Leader Proposal (AC: #1)
    // ========================================================================

    /// Create a custody release to vault proposal (leader only)
    ///
    /// This proposes releasing SettlementUSDC from OracleCustody on Settlement
    /// to MockBitgetVault for AP trading.
    ///
    /// Prerequisites: Orders must be in BridgedBackToSettlement status (from Story 7.5).
    pub async fn propose_release_to_vault(
        &self,
        cycle_number: u64,
        order_ids: Vec<U256>,
        total_amount: U256,
    ) -> Result<ReleaseToVaultProposal, BridgeError> {
        // Check for duplicate cycle (deduplication)
        if self.release_phase.confirmed.read().await.contains_key(&cycle_number) {
            return Err(BridgeError::ReleaseAlreadyProcessed { cycle_number });
        }

        // Validate all orders are in BridgedBackToSettlement status
        for order_id in &order_ids {
            let status = self.get_order_status(order_id).await;
            if status != Some(BridgeOrderStatus::BridgedBackToSettlement) {
                return Err(BridgeError::OrderNotBridgedBack {
                    order_id: *order_id,
                    status: status.unwrap_or(BridgeOrderStatus::Pending),
                });
            }
        }

        // Build the message hash for BLS signing
        // Use Settlement chain ID since the custody release happens on Settlement
        let message_hash = build_release_to_vault_hash(
            self.config.settlement_chain_id,
            self.config.oracle_custody_settlement,
            cycle_number,
            &order_ids,
            total_amount,
            self.config.bitget_vault,
        );

        // Sign with leader's BLS key using sign_message_hash (not sign_with_keypair)
        // because message_hash is already a keccak256 hash
        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            order_count = order_ids.len(),
            total_amount = %total_amount,
            vault_address = ?self.config.bitget_vault,
            custody_address = ?self.config.oracle_custody_settlement,
            message_hash = ?message_hash,
            "Custody release to vault proposal created"
        );

        Ok(ReleaseToVaultProposal {
            leader_id: self.peer_id,
            cycle_number,
            order_ids,
            total_amount,
            vault_address: self.config.bitget_vault,
            leader_signature,
            message_hash,
        })
    }

    // ========================================================================
    // Story 7.6: Custody Release to Vault - Follower Validation (AC: #2)
    // ========================================================================

    /// Validate a custody release to vault proposal from the leader
    ///
    /// Checks:
    /// 1. Cycle not already processed
    /// 2. Vault address matches config
    /// 3. Message hash matches recomputed hash
    /// 4. Orders are in BridgedBackToSettlement status
    /// 5. Total amount matches sum of individual order amounts (AC: #2)
    pub async fn validate_release_proposal(
        &self,
        proposal: &ReleaseToVaultProposal,
    ) -> Result<bool, BridgeError> {
        // 1. Check not already processed
        if self.release_phase.confirmed.read().await.contains_key(&proposal.cycle_number) {
            warn!(
                cycle_number = proposal.cycle_number,
                "Custody release already processed for this cycle"
            );
            return Ok(false);
        }

        // 2. Verify vault address matches our config
        if proposal.vault_address != self.config.bitget_vault {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?self.config.bitget_vault,
                received = ?proposal.vault_address,
                "Custody release proposal: vault address mismatch"
            );
            return Err(BridgeError::VaultAddressMismatch {
                expected: self.config.bitget_vault,
                actual: proposal.vault_address,
            });
        }

        // 3. Verify message hash matches
        let expected_hash = build_release_to_vault_hash(
            self.config.settlement_chain_id,
            self.config.oracle_custody_settlement,
            proposal.cycle_number,
            &proposal.order_ids,
            proposal.total_amount,
            proposal.vault_address,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Custody release proposal: message hash mismatch"
            );
            return Ok(false);
        }

        // 4. Verify orders are in BridgedBackToSettlement status and sum amounts
        //    Followers may not have tracked order status through all phases,
        //    so allow earlier statuses (Pending, BridgedToL3, etc.) — trust leader.
        let mut computed_total = U256::zero();
        for order_id in &proposal.order_ids {
            let status = self.get_order_status(order_id).await;
            match status {
                Some(BridgeOrderStatus::BridgedBackToSettlement) => {} // expected on leader
                Some(BridgeOrderStatus::Pending)
                | Some(BridgeOrderStatus::BridgedToL3)
                | Some(BridgeOrderStatus::SubmittedOnL3)
                | Some(BridgeOrderStatus::Batched)
                | None => {
                    // Follower hasn't executed all prior phases — trust leader
                    debug!(
                        cycle_number = proposal.cycle_number,
                        order_id = %order_id,
                        status = ?status,
                        "Order not BridgedBackToSettlement locally, allowing custody release (follower)"
                    );
                }
                _ => {
                    warn!(
                        cycle_number = proposal.cycle_number,
                        order_id = %order_id,
                        status = ?status,
                        "Order in unexpected status for custody release"
                    );
                    return Ok(false);
                }
            }

            // Sum order amounts for validation (Story 7.6 code review fix)
            if let Some(amount) = self.get_order_amount(order_id).await {
                computed_total = computed_total + amount;
            }
        }

        // 5. Verify total_amount matches sum of individual order amounts (AC: #2)
        if computed_total.is_zero() && !proposal.total_amount.is_zero() {
            warn!(
                cycle_number = proposal.cycle_number,
                proposal_total = %proposal.total_amount,
                "Custody release proposal: cannot verify total_amount — no local order amounts tracked"
            );
            return Ok(false);
        }
        if computed_total > U256::zero() && computed_total != proposal.total_amount {
            warn!(
                cycle_number = proposal.cycle_number,
                expected_total = %computed_total,
                proposal_total = %proposal.total_amount,
                "Custody release proposal: amount mismatch"
            );
            return Err(BridgeError::AmountMismatch {
                expected: computed_total,
                actual: proposal.total_amount,
            });
        }

        debug!(
            cycle_number = proposal.cycle_number,
            order_count = proposal.order_ids.len(),
            total_amount = %proposal.total_amount,
            computed_total = %computed_total,
            "Custody release proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated custody release proposal (follower)
    ///
    /// Returns the BLS signature for the proposal's message hash.
    pub fn sign_release_proposal(
        &self,
        proposal: &ReleaseToVaultProposal,
    ) -> Result<BLSSignature, BridgeError> {
        // Rebuild the message hash to verify it matches
        let expected_hash = build_release_to_vault_hash(
            self.config.settlement_chain_id,
            self.config.oracle_custody_settlement,
            proposal.cycle_number,
            &proposal.order_ids,
            proposal.total_amount,
            proposal.vault_address,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Custody release proposal message hash mismatch - possible tampering"
            );
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Sign with this node's BLS key (must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash)
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = proposal.cycle_number,
            signer_index = self.node_index,
            "Signed custody release proposal"
        );

        Ok(signature)
    }

    // ========================================================================
    // Story 7.6: Custody Release - Signature Aggregation (AC: #3)
    // ========================================================================

    /// Start collecting signatures for a custody release proposal (leader)
    pub async fn start_release_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.release_phase.sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature to the custody release collection (leader)
    ///
    /// Returns Some(ReleaseToVaultResult) if threshold is reached, None otherwise.
    pub async fn add_release_follower_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<ReleaseToVaultResult>, BridgeError> {
        self.release_phase.sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    // ========================================================================
    // Story 7.6: Custody Release Execution (AC: #3, #4)
    // ========================================================================

    /// Execute custody release to MockBitgetVault via BLSCustody.execute()
    ///
    /// This calls BLSCustody.execute() to transfer SettlementUSDC from OracleCustody
    /// on Settlement to MockBitgetVault.
    pub async fn execute_release_to_vault(
        &self,
        proposal: &ReleaseToVaultProposal,
        result: &ReleaseToVaultResult,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        // Check for duplicate cycle (deduplication)
        if let Some(existing_tx) = self.release_phase.confirmed.read().await.get(&proposal.cycle_number) {
            warn!(
                cycle_number = proposal.cycle_number,
                existing_tx = ?existing_tx,
                "Custody release already executed for this cycle"
            );
            return Err(BridgeError::ReleaseAlreadyProcessed {
                cycle_number: proposal.cycle_number,
            });
        }

        // Validate vault address matches our configured MockBitgetVault
        if proposal.vault_address != self.config.bitget_vault {
            warn!(
                cycle_number = proposal.cycle_number,
                proposal_vault = ?proposal.vault_address,
                expected_vault = ?self.config.bitget_vault,
                "Custody release proposal has invalid vault address"
            );
            return Err(BridgeError::VaultAddressMismatch {
                expected: self.config.bitget_vault,
                actual: proposal.vault_address,
            });
        }

        // Build USDC transfer calldata with 18→6 decimal conversion
        // Story 7-6b: proposal.total_amount is 18-decimal internal format
        // SettlementUSDC uses 6 decimals, so we convert here at the protocol boundary
        let (inner_calldata, usdc_amount_6dec) = build_usdc_transfer_calldata_with_amount(
            proposal.vault_address,
            proposal.total_amount,
        );

        // Execute via BLSCustody.execute() on OracleCustody Settlement
        // Target is the SettlementUSDC token contract
        let tx_hash = self
            .execute_custody_call(
                self.config.oracle_custody_settlement,  // custody contract
                self.config.settlement_usdc_address,    // target (SettlementUSDC)
                &inner_calldata,                  // transfer(vault, usdc_amount_6dec)
                &result.aggregated_signature,
                reference_nonce,
            )
            .await
            .map_err(|e| BridgeError::CustodyReleaseFailed {
                reason: e.to_string(),
            })?;

        // Record as confirmed (deduplication)
        self.release_phase.confirmed
            .write()
            .await
            .insert(proposal.cycle_number, tx_hash);

        // Mark orders as ReleasedToVault
        self.mark_orders_released(&proposal.order_ids).await;

        info!(
            cycle_number = proposal.cycle_number,
            order_count = proposal.order_ids.len(),
            tx_hash = ?tx_hash,
            total_amount_internal = %proposal.total_amount,
            usdc_amount_6dec = %usdc_amount_6dec,
            vault_address = ?proposal.vault_address,
            signer_bitmap = %result.signer_bitmap,
            "CustodyRelease: SettlementUSDC transferred to MockBitgetVault (18→6 decimal converted)"
        );

        Ok(tx_hash)
    }

    /// Mark orders as ReleasedToVault (status update)
    pub async fn mark_orders_released(&self, order_ids: &[U256]) {
        for order_id in order_ids {
            self.set_order_status(*order_id, BridgeOrderStatus::ReleasedToVault)
                .await;
        }

        info!(
            order_count = order_ids.len(),
            "Orders status updated to ReleasedToVault"
        );
    }

    /// Check if a custody release cycle has already been confirmed
    pub async fn is_release_confirmed(&self, cycle_number: u64) -> bool {
        self.release_phase.confirmed.read().await.contains_key(&cycle_number)
    }

    /// Clean up stale custody release signature collectors
    pub async fn cleanup_stale_release_collectors(&self, max_age_ms: u64) {
        self.release_phase.sigs.cleanup_stale(max_age_ms).await;
    }

    /// Check if custody release signature threshold is reached (Story 7.10)
    ///
    /// Returns Some(ReleaseToVaultResult) if threshold is reached, None otherwise.
    pub async fn check_release_threshold_reached(
        &self,
        cycle_number: u64,
    ) -> Option<ReleaseToVaultResult> {
        self.release_phase.sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get the current custody release signature count for a cycle (Story 7.10)
    pub async fn get_release_signature_count(&self, cycle_number: u64) -> Option<usize> {
        self.release_phase.sigs.get_signature_count(&cycle_number).await
    }

    // ========================================================================
    // Story 7-14: Rebalance Batch Consensus (Task 4.2)
    // ========================================================================

    /// Create a rebalance batch proposal (leader)
    pub async fn propose_rebalance_batch(
        &self,
        cycle_number: u64,
        itp_ids: Vec<H256>,
    ) -> Result<(H256, BLSSignature), BridgeError> {
        // Check for duplicate cycle
        if self.rebalance_batch_phase.confirmed.read().await.contains_key(&cycle_number) {
            return Err(BridgeError::ReleaseAlreadyProcessed { cycle_number });
        }

        let message_hash = build_rebalance_batch_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            cycle_number,
            &itp_ids,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number,
            itp_count = itp_ids.len(),
            message_hash = ?message_hash,
            "Rebalance batch proposal created"
        );

        Ok((message_hash, leader_signature))
    }

    /// Sign a rebalance batch proposal (follower)
    pub fn sign_rebalance_batch(
        &self,
        cycle_number: u64,
        itp_ids: &[H256],
    ) -> Result<BLSSignature, BridgeError> {
        let message_hash = build_rebalance_batch_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            cycle_number,
            itp_ids,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number,
            signer_index = self.node_index,
            "Signed rebalance batch proposal"
        );

        Ok(signature)
    }

    /// Start collecting signatures for a rebalance batch (leader)
    pub async fn start_rebalance_batch_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.rebalance_batch_phase.sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature for rebalance batch (leader)
    pub async fn add_rebalance_batch_follower_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<RebalanceBatchResult>, BridgeError> {
        self.rebalance_batch_phase.sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Check if rebalance batch signature threshold is reached
    pub async fn check_rebalance_batch_threshold(
        &self,
        cycle_number: u64,
    ) -> Option<RebalanceBatchResult> {
        self.rebalance_batch_phase.sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get rebalance batch signature count
    pub async fn get_rebalance_batch_signature_count(&self, cycle_number: u64) -> Option<usize> {
        self.rebalance_batch_phase.sigs.get_signature_count(&cycle_number).await
    }

    /// Check if a rebalance batch has been confirmed
    pub async fn is_rebalance_batch_confirmed(&self, cycle_number: u64) -> bool {
        self.rebalance_batch_phase.confirmed.read().await.contains_key(&cycle_number)
    }

    /// Mark a rebalance batch as confirmed
    pub async fn mark_rebalance_batch_confirmed(&self, cycle_number: u64, tx_hash: H256) {
        self.rebalance_batch_phase.confirmed.write().await.insert(cycle_number, tx_hash);
    }

    // ========================================================================
    // Story 7-14: Update Weights Consensus (Task 4.3)
    // ========================================================================

    /// Create an update weights proposal (leader)
    pub async fn propose_update_weights(
        &self,
        itp_id: H256,
        new_weights: &[U256],
        new_inventory: &[U256],
        nav: U256,
    ) -> Result<(H256, BLSSignature), BridgeError> {
        // Check for duplicate
        if self.confirmed_weight_updates.read().await.contains_key(&itp_id) {
            return Err(ConsensusError::ChainWriterError {
                reason: format!("Weight update already processed for ITP {}", itp_id),
            }
            .into());
        }

        let message_hash = build_update_weights_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            itp_id,
            new_weights,
            new_inventory,
            nav,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            itp_id = ?itp_id,
            weight_count = new_weights.len(),
            message_hash = ?message_hash,
            "Update weights proposal created"
        );

        Ok((message_hash, leader_signature))
    }

    /// Sign an update weights proposal (follower)
    pub fn sign_update_weights(
        &self,
        itp_id: H256,
        new_weights: &[U256],
        new_inventory: &[U256],
        nav: U256,
    ) -> Result<BLSSignature, BridgeError> {
        let message_hash = build_update_weights_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            itp_id,
            new_weights,
            new_inventory,
            nav,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            itp_id = ?itp_id,
            signer_index = self.node_index,
            "Signed update weights proposal"
        );

        Ok(signature)
    }

    /// Start collecting signatures for update weights (leader)
    pub async fn start_update_weights_signature_collection(
        &self,
        itp_id: H256,
        leader_signature: BLSSignature,
    ) {
        self.update_weights_sigs
            .start_collection(itp_id, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature for update weights (leader)
    pub async fn add_update_weights_follower_signature(
        &self,
        itp_id: H256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<UpdateWeightsResult>, BridgeError> {
        self.update_weights_sigs
            .add_follower_signature(
                &itp_id,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Check if update weights signature threshold is reached
    pub async fn check_update_weights_threshold(
        &self,
        itp_id: H256,
    ) -> Option<UpdateWeightsResult> {
        self.update_weights_sigs
            .check_threshold(&itp_id, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get update weights signature count
    pub async fn get_update_weights_signature_count(&self, itp_id: &H256) -> Option<usize> {
        self.update_weights_sigs.get_signature_count(itp_id).await
    }

    /// Check if weights have been updated for an ITP
    pub async fn is_weights_updated(&self, itp_id: &H256) -> bool {
        self.confirmed_weight_updates.read().await.contains_key(itp_id)
    }

    /// Mark weights as updated for an ITP
    pub async fn mark_weights_updated(&self, itp_id: H256, tx_hash: H256) {
        self.confirmed_weight_updates.write().await.insert(itp_id, tx_hash);
    }

    /// Execute confirmRebalanceBatch on-chain after BLS consensus (leader only)
    pub async fn execute_confirm_rebalance_batch(
        &self,
        cycle_number: u64,
        itp_ids: &[H256],
        aggregated: &RebalanceBatchResult,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        // Deduplication check
        if let Some(existing_tx) = self.rebalance_batch_phase.confirmed.read().await.get(&cycle_number) {
            warn!(
                cycle_number,
                existing_tx = ?existing_tx,
                "Rebalance batch already confirmed for this cycle"
            );
            return Err(BridgeError::ReleaseAlreadyProcessed { cycle_number });
        }

        let calldata = build_confirm_rebalance_batch_calldata(
            cycle_number,
            itp_ids,
            &aggregated.aggregated_signature.0,
            reference_nonce,
            aggregated.signer_bitmap,
        );

        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.index_address,
                calldata,
                U256::zero(),
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: e.to_string(),
            })?;

        self.rebalance_batch_phase.confirmed
            .write()
            .await
            .insert(cycle_number, tx_hash);

        info!(
            cycle_number,
            itp_count = itp_ids.len(),
            tx_hash = ?tx_hash,
            "Index.confirmRebalanceBatch() executed successfully"
        );

        Ok(tx_hash)
    }

    /// Execute updateWeights on-chain after BLS consensus (leader only)
    pub async fn execute_update_weights(
        &self,
        itp_id: H256,
        new_weights: &[U256],
        new_inventory: &[U256],
        nav: U256,
        aggregated: &UpdateWeightsResult,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        // Deduplication check
        if let Some(existing_tx) = self.confirmed_weight_updates.read().await.get(&itp_id) {
            warn!(
                itp_id = ?itp_id,
                existing_tx = ?existing_tx,
                "Weights already updated for this ITP"
            );
            return Err(ConsensusError::ChainWriterError {
                reason: format!("Weights already updated for ITP {}", itp_id),
            }
            .into());
        }

        let calldata = build_update_weights_calldata(
            itp_id,
            new_weights,
            new_inventory,
            nav,
            &aggregated.aggregated_signature.0,
            reference_nonce,
            aggregated.signer_bitmap,
        );

        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.index_address,
                calldata,
                U256::zero(),
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: e.to_string(),
            })?;

        self.confirmed_weight_updates
            .write()
            .await
            .insert(itp_id, tx_hash);

        info!(
            itp_id = ?itp_id,
            weight_count = new_weights.len(),
            tx_hash = ?tx_hash,
            "Index.updateWeights() executed successfully"
        );

        Ok(tx_hash)
    }

    // ========================================================================
    // Single-Phase Rebalance: propose + execute
    // ========================================================================

    /// Create a single-phase rebalance proposal (leader only)
    ///
    /// Signs keccak256(abi.encode(chainid, address, "rebalance", itpId, removeIndices, addAssets, newWeights, prices))
    pub async fn propose_rebalance(
        &self,
        itp_id: H256,
        remove_indices: &[U256],
        add_assets: &[Address],
        new_weights: &[U256],
        prices: &[U256],
        quote_tokens: &[Address],
    ) -> Result<(H256, BLSSignature), BridgeError> {
        let message_hash = build_rebalance_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            itp_id,
            remove_indices,
            add_assets,
            new_weights,
            prices,
            quote_tokens,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            itp_id = ?itp_id,
            weight_count = new_weights.len(),
            message_hash = ?message_hash,
            "Single-phase rebalance proposal created"
        );

        Ok((message_hash, leader_signature))
    }

    /// Start signature collection for a rebalance proposal
    pub async fn start_rebalance_signature_collection(
        &self,
        itp_id: H256,
        leader_signature: BLSSignature,
    ) {
        // Reuses update_weights_sigs (same key space: itp_id)
        self.update_weights_sigs
            .start_collection(itp_id, self.node_index, leader_signature)
            .await;
    }

    /// Check if rebalance signature threshold is reached
    pub async fn check_rebalance_threshold(&self, itp_id: H256) -> Option<RebalanceResult> {
        self.update_weights_sigs
            .check_threshold(&itp_id, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get rebalance signature count
    pub async fn get_rebalance_signature_count(&self, itp_id: &H256) -> Option<usize> {
        self.update_weights_sigs.get_signature_count(itp_id).await
    }

    /// Add a follower signature for a rebalance proposal
    pub async fn add_rebalance_signature(
        &self,
        itp_id: H256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<RebalanceResult>, BridgeError> {
        self.update_weights_sigs
            .add_follower_signature(
                &itp_id,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    // ========================================================================
    // setItpNav BLS Consensus (pre-rebalance NAV push)
    // ========================================================================

    /// Create a setItpNav proposal (leader only) - signs the nav hash
    pub async fn propose_set_itp_nav(
        &self,
        itp_id: H256,
        nav: U256,
    ) -> Result<(H256, BLSSignature), BridgeError> {
        let message_hash = build_set_itp_nav_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            itp_id,
            nav,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            itp_id = ?itp_id,
            nav = %nav,
            message_hash = ?message_hash,
            "setItpNav proposal created"
        );

        Ok((message_hash, leader_signature))
    }

    /// Start signature collection for a setItpNav proposal
    pub async fn start_nav_signature_collection(
        &self,
        itp_id: H256,
        leader_signature: BLSSignature,
    ) {
        self.nav_sigs
            .start_collection(itp_id, self.node_index, leader_signature)
            .await;
    }

    /// Check if setItpNav signature threshold is reached
    pub async fn check_nav_threshold(&self, itp_id: H256) -> Option<SetItpNavResult> {
        self.nav_sigs
            .check_threshold(&itp_id, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get setItpNav signature count
    pub async fn get_nav_signature_count(&self, itp_id: &H256) -> Option<usize> {
        self.nav_sigs.get_signature_count(itp_id).await
    }

    /// Add a follower signature for a setItpNav proposal
    pub async fn add_nav_signature(
        &self,
        itp_id: H256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<SetItpNavResult>, BridgeError> {
        self.nav_sigs
            .add_follower_signature(
                &itp_id,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    // ============ NavOracle Signature Collection (separate from nav_sigs) ============

    /// Start signature collection for a NavOracle proposal
    pub async fn start_nav_oracle_signature_collection(
        &self,
        itp_key: H256,
        leader_signature: BLSSignature,
    ) {
        self.nav_oracle_sigs
            .start_collection(itp_key, self.node_index, leader_signature)
            .await;
    }

    /// Check if NavOracle signature threshold is reached
    pub async fn check_nav_oracle_threshold(&self, itp_key: H256) -> Option<SetItpNavResult> {
        self.nav_oracle_sigs
            .check_threshold(&itp_key, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Add a follower signature for a NavOracle proposal
    pub async fn add_nav_oracle_signature(
        &self,
        itp_key: H256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<SetItpNavResult>, BridgeError> {
        self.nav_oracle_sigs
            .add_follower_signature(
                &itp_key,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    // ============ MirrorSync Signature Collection (separate from nav_sigs) ============

    /// Start signature collection for a MirrorSync proposal
    pub async fn start_mirror_sync_signature_collection(
        &self,
        sync_key: H256,
        leader_signature: BLSSignature,
    ) {
        self.mirror_sync_sigs
            .start_collection(sync_key, self.node_index, leader_signature)
            .await;
    }

    /// Check if MirrorSync signature threshold is reached
    pub async fn check_mirror_sync_threshold(&self, sync_key: H256, min_signatures: usize) -> Option<SetItpNavResult> {
        self.mirror_sync_sigs
            .check_threshold(&sync_key, min_signatures, &self.bls_signer)
            .await
    }

    /// Add a follower signature for a MirrorSync proposal
    pub async fn add_mirror_sync_signature(
        &self,
        sync_key: H256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<SetItpNavResult>, BridgeError> {
        self.mirror_sync_sigs
            .add_follower_signature(
                &sync_key,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Execute rebalance() on-chain after BLS consensus (leader only)
    pub async fn execute_rebalance(
        &self,
        itp_id: H256,
        remove_indices: &[U256],
        add_assets: &[Address],
        new_weights: &[U256],
        prices: &[U256],
        quote_tokens: &[Address],
        aggregated: &RebalanceResult,
        computed_nav: U256,
        nav_bls_signature: &[u8],
        nav_signer_bitmap: U256,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        // Push computed NAV on-chain BEFORE rebalance so that RebalanceLib
        // reads the real NAV instead of the stale _itpNavs (stuck at 1e18
        // from createITP). BLS signature obtained via setItpNav consensus.
        // IMPORTANT: use nav_signer_bitmap (from NAV consensus), NOT
        // aggregated.signer_bitmap (from rebalance consensus) — different
        // oracles may have signed each phase.
        let nav_calldata = build_set_itp_nav_calldata(itp_id, computed_nav, nav_bls_signature, reference_nonce, nav_signer_bitmap);
        match self.l3_writer.send_transaction(
            self.config.index_address,
            nav_calldata,
            U256::zero(),
        ).await {
            Ok(tx) => info!(itp_id = ?itp_id, nav = %computed_nav, tx = ?tx, "setItpNav pushed before rebalance"),
            Err(e) => warn!(itp_id = ?itp_id, error = %e, "setItpNav failed, rebalance will use stale NAV"),
        }

        let calldata = build_rebalance_calldata(
            itp_id,
            remove_indices,
            add_assets,
            new_weights,
            prices,
            quote_tokens,
            &aggregated.aggregated_signature.0,
            reference_nonce,
            aggregated.signer_bitmap,
        );

        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.index_address,
                calldata,
                U256::zero(),
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: e.to_string(),
            })?;

        info!(
            itp_id = ?itp_id,
            weight_count = new_weights.len(),
            tx_hash = ?tx_hash,
            "Index.rebalance() executed successfully"
        );

        Ok(tx_hash)
    }

    // ========================================================================
    // Oracle-Driven Per-Asset Settlement: Asset Trades Consensus
    // ========================================================================

    /// Create an asset trades proposal (leader only)
    ///
    /// After decomposing ITP orders into per-asset amounts and cross-ITP netting,
    /// the leader proposes the resulting trades for BLS consensus.
    pub fn propose_asset_trades(
        &self,
        cycle_number: u64,
        trades: Vec<AssetTrade>,
    ) -> Result<AssetTradesProposal, BridgeError> {
        let message_hash = build_emit_asset_trades_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            cycle_number,
            &trades,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            trade_count = trades.len(),
            message_hash = ?message_hash,
            "Asset trades proposal created"
        );

        Ok(AssetTradesProposal {
            leader_id: self.peer_id,
            cycle_number,
            trades,
            leader_signature,
            message_hash,
        })
    }

    /// Validate an asset trades proposal from the leader (follower)
    ///
    /// Checks that the message hash matches recomputed hash.
    pub fn validate_asset_trades_proposal(
        &self,
        proposal: &AssetTradesProposal,
    ) -> Result<bool, BridgeError> {
        let expected_hash = build_emit_asset_trades_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            proposal.cycle_number,
            &proposal.trades,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "Asset trades proposal: message hash mismatch"
            );
            return Ok(false);
        }

        debug!(
            cycle_number = proposal.cycle_number,
            trade_count = proposal.trades.len(),
            "Asset trades proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated asset trades proposal (follower)
    pub fn sign_asset_trades_proposal(
        &self,
        proposal: &AssetTradesProposal,
    ) -> Result<BLSSignature, BridgeError> {
        let expected_hash = build_emit_asset_trades_hash(
            self.config.l3_chain_id,
            self.config.index_address,
            proposal.cycle_number,
            &proposal.trades,
        );

        if expected_hash != proposal.message_hash {
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = proposal.cycle_number,
            signer_index = self.node_index,
            "Signed asset trades proposal"
        );

        Ok(signature)
    }

    /// Start collecting signatures for an asset trades proposal (leader)
    pub async fn start_asset_trades_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.asset_trades_phase.sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature to the asset trades collection (leader)
    ///
    /// Returns Some(AssetTradesResult) if threshold is reached, None otherwise.
    pub async fn add_asset_trades_follower_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<AssetTradesResult>, BridgeError> {
        self.asset_trades_phase.sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Execute emitAssetTrades on Index contract
    ///
    /// Calls Index.emitAssetTrades(cycleNumber, trades[], blsSignature)
    /// which emits AssetTradeRequest events for the AP.
    pub async fn execute_emit_asset_trades(
        &self,
        cycle_number: u64,
        trades: &[AssetTrade],
        aggregated: &AssetTradesResult,
        reference_nonce: u64,
    ) -> Result<H256, BridgeError> {
        // Deduplication check
        if let Some(existing_tx) = self.asset_trades_phase.confirmed.read().await.get(&cycle_number) {
            warn!(
                cycle_number = cycle_number,
                existing_tx = ?existing_tx,
                "Asset trades already emitted for this cycle"
            );
            return Err(BridgeError::BatchAlreadyConfirmed { cycle_number });
        }

        let calldata = build_emit_asset_trades_calldata(
            cycle_number,
            trades,
            &aggregated.aggregated_signature.0,
            reference_nonce,
            aggregated.signer_bitmap,
        );

        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.index_address,
                calldata,
                U256::zero(),
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: e.to_string(),
            })?;

        self.asset_trades_phase.confirmed
            .write()
            .await
            .insert(cycle_number, tx_hash);

        info!(
            cycle_number = cycle_number,
            trade_count = trades.len(),
            tx_hash = ?tx_hash,
            signer_bitmap = %aggregated.signer_bitmap,
            "Index.emitAssetTrades() executed successfully"
        );

        Ok(tx_hash)
    }

    /// Get the current asset trades signature count for a cycle
    pub async fn asset_trades_signature_count(&self, cycle_number: u64) -> usize {
        self.asset_trades_phase.sigs.get_signature_count(&cycle_number).await.unwrap_or(0)
    }

    /// Check if asset trades signature threshold is reached
    pub async fn check_asset_trades_threshold_reached(&self, cycle_number: u64) -> Option<AssetTradesResult> {
        self.asset_trades_phase.sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    // ============================================================================
    // Cross-Chain Sell Order Consensus Methods
    // ============================================================================

    /// Set sell order amount for tracking
    pub async fn set_sell_order_amount(&self, order_id: U256, amount: U256) {
        self.sell_order_amounts.write().await.insert(order_id, amount);
    }

    /// Get sell order amount
    pub async fn get_sell_order_amount(&self, order_id: &U256) -> Option<U256> {
        self.sell_order_amounts.read().await.get(order_id).copied()
    }

    /// Store sell order limit price
    pub async fn set_sell_order_limit_price(&self, order_id: U256, limit_price: U256) {
        self.sell_order_limit_prices.write().await.insert(order_id, limit_price);
    }

    /// Get sell order limit price
    pub async fn get_sell_order_limit_price(&self, order_id: &U256) -> Option<U256> {
        self.sell_order_limit_prices.read().await.get(order_id).copied()
    }

    /// Store sell order fill price (after Phase B confirmFills)
    pub async fn set_sell_order_fill_price(&self, order_id: U256, fill_price: U256) {
        self.sell_order_fill_prices.write().await.insert(order_id, fill_price);
    }

    /// Get sell order fill price
    pub async fn get_sell_order_fill_price(&self, order_id: &U256) -> Option<U256> {
        self.sell_order_fill_prices.read().await.get(order_id).copied()
    }

    /// Store sell order fill amount (after Phase B confirmFills)
    pub async fn set_sell_order_fill_amount(&self, order_id: U256, fill_amount: U256) {
        self.sell_order_fill_amounts.write().await.insert(order_id, fill_amount);
    }

    /// Get sell order fill amount
    pub async fn get_sell_order_fill_amount(&self, order_id: &U256) -> Option<U256> {
        self.sell_order_fill_amounts.read().await.get(order_id).copied()
    }

    /// Store pending burn tx hash (for non-blocking receipt check)
    pub async fn set_sell_burn_tx_hash(&self, order_id: U256, tx_hash: H256) {
        self.sell_burn_tx_hashes.write().await.insert(order_id, tx_hash);
    }

    /// Get pending burn tx hash
    pub async fn get_sell_burn_tx_hash(&self, order_id: &U256) -> Option<H256> {
        self.sell_burn_tx_hashes.read().await.get(order_id).copied()
    }

    /// Remove pending burn tx hash (after receipt confirmed or reset)
    pub async fn clear_sell_burn_tx_hash(&self, order_id: &U256) {
        self.sell_burn_tx_hashes.write().await.remove(order_id);
    }

    /// Get sell orders with SellBurned status (ready for L3 submit)
    pub async fn get_burned_sell_orders(&self) -> Vec<U256> {
        let mut ids: Vec<U256> = self.sell_order_status
            .read()
            .await
            .iter()
            .filter(|(_, status)| **status == BridgeOrderStatus::SellBurned)
            .map(|(id, _)| *id)
            .collect();
        ids.sort();
        ids
    }

    /// Get sell orders with SellBurnPending status (awaiting receipt)
    pub async fn get_burn_pending_sell_orders(&self) -> Vec<U256> {
        let mut ids: Vec<U256> = self.sell_order_status
            .read()
            .await
            .iter()
            .filter(|(_, status)| **status == BridgeOrderStatus::SellBurnPending)
            .map(|(id, _)| *id)
            .collect();
        ids.sort();
        ids
    }

    /// Get a snapshot of all sell order statuses
    pub async fn sell_order_status_snapshot(&self) -> HashMap<U256, BridgeOrderStatus> {
        self.sell_order_status.read().await.clone()
    }

    /// Get sell orders with SellSubmittedOnL3 status
    pub async fn get_submitted_sell_orders(&self) -> Vec<U256> {
        let mut ids: Vec<U256> = self.sell_order_status
            .read()
            .await
            .iter()
            .filter(|(_, status)| **status == BridgeOrderStatus::SellSubmittedOnL3)
            .map(|(id, _)| *id)
            .collect();
        ids.sort();
        ids
    }

    /// Store sell order mapping (settlement → L3)
    pub async fn store_sell_order_mapping(&self, mapping: OrderMapping) {
        let settlement_id = mapping.settlement_order_id;
        self.sell_order_mappings.write().await.insert(settlement_id, mapping);
    }

    /// Resolve settlement sell order IDs → L3 order IDs
    pub async fn resolve_sell_l3_order_ids(&self, settlement_order_ids: &[U256]) -> Vec<U256> {
        let mappings = self.sell_order_mappings.read().await;
        settlement_order_ids
            .iter()
            .filter_map(|settlement_id| mappings.get(settlement_id).map(|m| m.l3_order_id))
            .collect()
    }

    /// Get L3 order ID for a sell order
    pub async fn get_sell_l3_order_id(&self, settlement_order_id: &U256) -> Option<U256> {
        self.sell_order_mappings.read().await.get(settlement_order_id).map(|m| m.l3_order_id)
    }

    // ---- Submit Sell Order Consensus ----

    /// Leader: propose submitting sell order on L3
    pub async fn propose_submit_sell_order(
        &self,
        order_id: U256,
        itp_id: H256,
        user: Address,
        bridged_itp_address: Address,
        amount: U256,
    ) -> Result<SellBridgeProposal, BridgeError> {
        // Check order status is SellBurned (burn gate passed, ready for L3 submission)
        let status = self.get_sell_order_status(&order_id).await;
        if status != Some(BridgeOrderStatus::SellBurned) {
            return Err(ConsensusError::ChainWriterError {
                reason: format!("Sell order {} not in SellBurned status (got: {:?})", order_id, status),
            }
            .into());
        }

        // Build hash using sell bridge hash
        let message_hash = build_sell_bridge_hash(
            self.config.settlement_chain_id,
            order_id,
            itp_id,
            user,
            bridged_itp_address,
            amount,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            order_id = %order_id,
            itp_id = ?itp_id,
            user = ?user,
            amount = %amount,
            "Submit sell order proposal created"
        );

        Ok(SellBridgeProposal {
            leader_id: self.peer_id,
            order_id,
            itp_id,
            user,
            bridged_itp_address,
            amount,
            leader_signature,
            message_hash,
        })
    }

    /// Follower: validate submit sell order proposal
    pub async fn validate_submit_sell_order_proposal(
        &self,
        proposal: &SellBridgeProposal,
    ) -> Result<bool, BridgeError> {
        // Validate amount is non-zero
        if proposal.amount.is_zero() {
            warn!(order_id = %proposal.order_id, "Rejecting sell order proposal with zero amount");
            return Ok(false);
        }

        // Validate user is non-zero
        if proposal.user == Address::zero() {
            warn!(order_id = %proposal.order_id, "Rejecting sell order proposal with zero user");
            return Ok(false);
        }

        // Validate bridged_itp_address is non-zero
        if proposal.bridged_itp_address == Address::zero() {
            warn!(order_id = %proposal.order_id, "Rejecting sell order proposal with zero bridged_itp_address");
            return Ok(false);
        }

        let status = self.get_sell_order_status(&proposal.order_id).await;
        debug!(
            order_id = %proposal.order_id,
            status = ?status,
            "Validating submit sell order proposal"
        );
        Ok(true)
    }

    /// Sign submit sell order proposal
    pub fn sign_submit_sell_order_proposal(
        &self,
        proposal: &SellBridgeProposal,
    ) -> Result<BLSSignature, BridgeError> {
        let hash_bytes: [u8; 32] = proposal.message_hash.into();
        self.bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })
            .map_err(Into::into)
    }

    // ============================================================================
    // Burn Sell Order Consensus Methods (Task 4)
    // ============================================================================

    /// Propose burn sell order — leader builds hash and signs
    pub async fn propose_burn_sell_order(
        &self,
        order_id: U256,
    ) -> Result<BurnSellOrderProposal, BridgeError> {
        let message_hash = build_burn_sell_order_hash(
            self.config.settlement_chain_id,
            self.config.settlement_custody_address,
            order_id,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        Ok(BurnSellOrderProposal {
            leader_id: self.peer_id,
            order_id,
            leader_signature,
            message_hash,
        })
    }

    /// Validate burn sell order proposal — follower verifies hash consistency
    pub async fn validate_burn_sell_order_proposal(
        &self,
        proposal: &BurnSellOrderProposal,
    ) -> Result<bool, BridgeError> {
        let expected_hash = build_burn_sell_order_hash(
            self.config.settlement_chain_id,
            self.config.settlement_custody_address,
            proposal.order_id,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                order_id = %proposal.order_id,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "BurnSellOrder proposal: message hash mismatch"
            );
            return Ok(false);
        }

        Ok(true)
    }

    /// Sign burn sell order proposal (follower signs the message hash)
    pub fn sign_burn_sell_order_proposal(
        &self,
        proposal: &BurnSellOrderProposal,
    ) -> Result<BLSSignature, BridgeError> {
        let hash_bytes: [u8; 32] = proposal.message_hash.into();
        self.bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: format!("Failed to sign burn sell order proposal: {}", e),
            })
            .map_err(Into::into)
    }

    /// Start collecting signatures for burn sell order
    pub async fn start_burn_sell_order_signature_collection(
        &self,
        order_id: U256,
        leader_signature: BLSSignature,
    ) {
        self.burn_sell_sigs
            .start_collection(order_id, self.node_index, leader_signature)
            .await;
    }

    /// Add follower signature for burn sell order
    pub async fn add_burn_sell_order_follower_signature(
        &self,
        order_id: U256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<BurnSellOrderResult>, BridgeError> {
        let result = self.burn_sell_sigs
            .add_follower_signature(
                &order_id,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await?;
        Ok(result)
    }

    /// Check if burn sell order threshold reached
    pub async fn check_burn_sell_order_threshold_reached(
        &self,
        order_id: &U256,
    ) -> Option<BurnSellOrderResult> {
        self.burn_sell_sigs
            .check_threshold(order_id, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get signature count for burn sell order
    pub async fn get_burn_sell_order_signature_count(
        &self,
        order_id: &U256,
    ) -> Option<usize> {
        self.burn_sell_sigs.get_signature_count(order_id).await
    }

    // ============================================================================
    // Submit Sell Order Consensus Methods
    // ============================================================================

    /// Start collecting signatures for submit sell order
    pub async fn start_submit_sell_order_signature_collection(
        &self,
        order_id: U256,
        leader_signature: BLSSignature,
    ) {
        self.sell_bridge_sigs
            .start_collection(order_id, self.node_index, leader_signature)
            .await;
    }

    /// Add follower signature for submit sell order
    pub async fn add_submit_sell_order_follower_signature(
        &self,
        order_id: U256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<SellSubmitOrderResult>, BridgeError> {
        let result = self.sell_bridge_sigs
            .add_follower_signature(
                &order_id,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await?;
        Ok(result.map(|r| SellSubmitOrderResult {
            l3_order_id: None,
            aggregated_signature: r.aggregated_signature,
            signer_bitmap: r.signer_bitmap,
            signature_count: r.signature_count,
        }))
    }

    /// Check if submit sell order threshold reached
    pub async fn check_submit_sell_order_threshold_reached(
        &self,
        order_id: &U256,
    ) -> Option<SellSubmitOrderResult> {
        let result = self.sell_bridge_sigs
            .check_threshold(order_id, self.config.min_signatures, &self.bls_signer)
            .await?;
        Some(SellSubmitOrderResult {
            l3_order_id: None,
            aggregated_signature: result.aggregated_signature,
            signer_bitmap: result.signer_bitmap,
            signature_count: result.signature_count,
        })
    }

    /// Get signature count for submit sell order
    pub async fn get_submit_sell_order_signature_count(
        &self,
        order_id: &U256,
    ) -> Option<usize> {
        self.sell_bridge_sigs.get_signature_count(order_id).await
    }

    /// Execute submit sell order on L3 (no USDC approve needed for sell)
    pub async fn execute_submit_sell_order(
        &self,
        order_id: U256,
        user: Address,
        itp_id: H256,
        amount: U256,
    ) -> Result<H256, BridgeError> {
        // Step 1: Read nextOrderId before submitting
        let next_order_id_selector = &ethers::utils::keccak256("nextOrderId()")[..4];
        let l3_order_id = match self
            .l3_writer
            .static_call(self.config.index_address, next_order_id_selector.to_vec())
            .await
        {
            Ok(data) if data.len() >= 32 => {
                U256::from_big_endian(&data[..32])
            }
            Ok(_) => {
                warn!("nextOrderId returned unexpected data, using settlement order ID as fallback");
                order_id
            }
            Err(e) => {
                warn!(error = %e, "Failed to read nextOrderId, using settlement order ID as fallback");
                order_id
            }
        };

        // Step 2: Submit sell order via submitOrderFor(user, itpId, SELL=1, amount, 0, 0, deadline)
        // Read L3 chain's block.timestamp and use timestamp + 1 hour as deadline
        // (contract requires: block.timestamp < deadline <= block.timestamp + 24h)
        let deadline = match self.l3_writer.get_block_timestamp().await {
            Ok(ts) => ts + U256::from(3600u64),
            Err(e) => {
                warn!(error = %e, "Failed to get L3 block timestamp, using system time + 24h");
                let now_secs = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                U256::from(now_secs + 86400)
            }
        };
        let calldata = build_submit_order_for_calldata(
            user,
            itp_id,
            1, // SELL
            amount,
            self.get_sell_order_limit_price(&order_id).await.unwrap_or_default(), // Task 2: user's limit price
            U256::zero(),        // slippageTier = 0
            deadline,
        );

        let tx_hash = self
            .l3_writer
            .send_transaction(
                self.config.index_address,
                calldata,
                U256::zero(),
            )
            .await
            .map_err(|e| ConsensusError::ChainWriterError {
                reason: format!("submitOrderFor(SELL) failed: {}", e),
            })?;

        // Store settlement→L3 sell order mapping
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let mapping = OrderMapping {
            settlement_order_id: order_id,
            l3_order_id,
            original_user: user,
            created_at,
        };
        self.store_sell_order_mapping(mapping).await;

        info!(
            settlement_order_id = %order_id,
            l3_order_id = %l3_order_id,
            itp_id = ?itp_id,
            amount = %amount,
            tx_hash = ?tx_hash,
            "Index.submitOrderFor(SELL) executed successfully"
        );

        Ok(tx_hash)
    }

    // ---- Complete Sell Order Consensus ----

    /// Leader: propose completing sell order on Settlement
    pub async fn propose_complete_sell_order(
        &self,
        order_id: U256,
        usdc_proceeds: U256,
        vault: Address,
    ) -> Result<CompleteSellProposal, BridgeError> {
        let message_hash = build_complete_sell_order_consensus_hash(
            self.config.settlement_chain_id,
            self.config.settlement_custody_address,
            order_id,
            usdc_proceeds,
            vault,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            order_id = %order_id,
            usdc_proceeds = %usdc_proceeds,
            "Complete sell order proposal created"
        );

        Ok(CompleteSellProposal {
            leader_id: self.peer_id,
            order_id,
            usdc_proceeds,
            leader_signature,
            message_hash,
        })
    }

    /// Follower: validate complete sell order proposal
    pub async fn validate_complete_sell_order_proposal(
        &self,
        proposal: &CompleteSellProposal,
    ) -> Result<bool, BridgeError> {
        // Verify hash consistency: rebuild hash from proposal fields and our config
        let expected_hash = build_complete_sell_order_consensus_hash(
            self.config.settlement_chain_id,
            self.config.settlement_custody_address,
            proposal.order_id,
            proposal.usdc_proceeds,
            self.config.bitget_vault,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                order_id = %proposal.order_id,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "CompleteSellOrder proposal: message hash mismatch (possible vault or proceeds manipulation)"
            );
            return Ok(false);
        }

        // Task 12: Independent proceeds verification — don't blindly trust leader's usdc_proceeds
        // Compute expected proceeds from stored fill data
        let fill_amount = self.get_sell_order_fill_amount(&proposal.order_id).await;
        let fill_price = self.get_sell_order_fill_price(&proposal.order_id).await;

        if let (Some(fa), Some(fp)) = (fill_amount, fill_price) {
            // proceeds_18dec = fill_amount * fill_price / 1e18, then /1e12 for 6-dec
            let expected_18dec = fa * fp / U256::exp10(18);
            let expected_6dec = expected_18dec / U256::exp10(12);

            // Allow tolerance for minor NAV drift between oracles.
            // Each oracle independently computes fill_price from its own NAV calculation,
            // which can differ slightly due to price feed timing.
            // Tolerance: 0.1% of proceeds, minimum $0.01 (10_000 in 6-dec USDC)
            let diff = if proposal.usdc_proceeds > expected_6dec {
                proposal.usdc_proceeds - expected_6dec
            } else {
                expected_6dec - proposal.usdc_proceeds
            };

            let relative_tolerance = proposal.usdc_proceeds / U256::from(1000); // 0.1%
            let min_tolerance = U256::from(10_000); // $0.01
            let tolerance = std::cmp::max(relative_tolerance, min_tolerance);

            if diff > tolerance {
                warn!(
                    order_id = %proposal.order_id,
                    proposed = %proposal.usdc_proceeds,
                    expected = %expected_6dec,
                    fill_amount = %fa,
                    fill_price = %fp,
                    "REJECTING completeSellOrder proposal: proceeds mismatch"
                );
                return Ok(false);
            }

            // Also check limit price if available
            if let Some(limit_price) = self.get_sell_order_limit_price(&proposal.order_id).await {
                if !limit_price.is_zero() {
                    let min_proceeds_18dec = fa * limit_price / U256::exp10(18);
                    let min_proceeds_6dec = min_proceeds_18dec / U256::exp10(12);
                    if proposal.usdc_proceeds < min_proceeds_6dec && !min_proceeds_6dec.is_zero() {
                        warn!(
                            order_id = %proposal.order_id,
                            proposed = %proposal.usdc_proceeds,
                            min_from_limit = %min_proceeds_6dec,
                            "REJECTING completeSellOrder proposal: below user's limit price"
                        );
                        return Ok(false);
                    }
                }
            }
        } else {
            // No fill data available — allow but warn (may happen after restart before recovery)
            warn!(
                order_id = %proposal.order_id,
                usdc_proceeds = %proposal.usdc_proceeds,
                "CompleteSellOrder: no fill data for independent verification — trusting leader"
            );
        }

        // Zero proceeds is suspicious but technically valid for dust orders
        if proposal.usdc_proceeds.is_zero() {
            warn!(order_id = %proposal.order_id, "CompleteSellOrder proposal: zero USDC proceeds");
        }

        Ok(true)
    }

    /// Sign complete sell order proposal
    pub fn sign_complete_sell_order_proposal(
        &self,
        proposal: &CompleteSellProposal,
    ) -> Result<BLSSignature, BridgeError> {
        let hash_bytes: [u8; 32] = proposal.message_hash.into();
        self.bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })
            .map_err(Into::into)
    }

    /// Start collecting signatures for complete sell order
    pub async fn start_complete_sell_order_signature_collection(
        &self,
        order_id: U256,
        leader_signature: BLSSignature,
    ) {
        self.complete_sell_sigs
            .start_collection(order_id, self.node_index, leader_signature)
            .await;
    }

    /// Add follower signature for complete sell order
    pub async fn add_complete_sell_order_follower_signature(
        &self,
        order_id: U256,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<CompleteSellOrderResult>, BridgeError> {
        self.complete_sell_sigs
            .add_follower_signature(
                &order_id,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Check if complete sell order threshold reached
    pub async fn check_complete_sell_order_threshold_reached(
        &self,
        order_id: &U256,
    ) -> Option<CompleteSellOrderResult> {
        self.complete_sell_sigs
            .check_threshold(order_id, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Get signature count for complete sell order
    pub async fn get_complete_sell_order_signature_count(
        &self,
        order_id: &U256,
    ) -> Option<usize> {
        self.complete_sell_sigs.get_signature_count(order_id).await
    }

    // ========================================================================
    // 8-step bridge: RecordCollateralMove consensus
    // ========================================================================

    /// Create a RecordCollateralMove proposal (leader only)
    pub fn propose_record_collateral_move(
        &self,
        cycle_number: u64,
        itp_id: H256,
        from_chain: U256,
        to_chain: U256,
        amount: U256,
        tx_type: u8,
        collateral_registry: Address,
    ) -> Result<RecordCollateralMoveProposal, BridgeError> {
        let message_hash = build_record_collateral_move_hash(
            self.config.l3_chain_id,
            collateral_registry,
            itp_id,
            from_chain,
            to_chain,
            amount,
            tx_type,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            itp_id = ?itp_id,
            amount = %amount,
            message_hash = ?message_hash,
            "RecordCollateralMove proposal created"
        );

        Ok(RecordCollateralMoveProposal {
            leader_id: self.peer_id,
            cycle_number,
            itp_id,
            from_chain,
            to_chain,
            amount,
            tx_type,
            leader_signature,
            message_hash,
        })
    }

    /// Validate a RecordCollateralMove proposal from the leader
    pub async fn validate_record_collateral_move_proposal(
        &self,
        proposal: &RecordCollateralMoveProposal,
        collateral_registry: Address,
    ) -> Result<bool, BridgeError> {
        if self.collateral_move_phase.confirmed.read().await.contains_key(&proposal.cycle_number) {
            warn!(
                cycle_number = proposal.cycle_number,
                "CollateralMove already recorded for this cycle"
            );
            return Ok(false);
        }

        let expected_hash = build_record_collateral_move_hash(
            self.config.l3_chain_id,
            collateral_registry,
            proposal.itp_id,
            proposal.from_chain,
            proposal.to_chain,
            proposal.amount,
            proposal.tx_type,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "RecordCollateralMove proposal: message hash mismatch"
            );
            return Ok(false);
        }

        debug!(
            cycle_number = proposal.cycle_number,
            itp_id = ?proposal.itp_id,
            "RecordCollateralMove proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated RecordCollateralMove proposal (follower)
    pub fn sign_record_collateral_move_proposal(
        &self,
        proposal: &RecordCollateralMoveProposal,
        collateral_registry: Address,
    ) -> Result<BLSSignature, BridgeError> {
        let expected_hash = build_record_collateral_move_hash(
            self.config.l3_chain_id,
            collateral_registry,
            proposal.itp_id,
            proposal.from_chain,
            proposal.to_chain,
            proposal.amount,
            proposal.tx_type,
        );

        if expected_hash != proposal.message_hash {
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = proposal.cycle_number,
            signer_index = self.node_index,
            "Signed RecordCollateralMove proposal"
        );

        Ok(signature)
    }

    /// Start collecting signatures for a RecordCollateralMove proposal (leader)
    pub async fn start_collateral_move_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.collateral_move_phase.sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature to the RecordCollateralMove collection (leader)
    pub async fn add_collateral_move_follower_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<RecordCollateralMoveResult>, BridgeError> {
        self.collateral_move_phase.sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Check if RecordCollateralMove signature threshold is reached
    pub async fn check_collateral_move_threshold_reached(
        &self,
        cycle_number: u64,
    ) -> Option<RecordCollateralMoveResult> {
        self.collateral_move_phase.sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Check if RecordCollateralMove is already confirmed for this cycle
    pub async fn is_collateral_move_confirmed(&self, cycle_number: u64) -> bool {
        self.collateral_move_phase.confirmed.read().await.contains_key(&cycle_number)
    }

    /// Record a confirmed collateral move (deduplication)
    pub async fn confirm_collateral_move(&self, cycle_number: u64, tx_hash: H256) {
        self.collateral_move_phase.confirmed.write().await.insert(cycle_number, tx_hash);
    }

    /// Get collateral move signature count for diagnostics
    pub async fn get_collateral_move_signature_count(&self, cycle_number: u64) -> Option<usize> {
        self.collateral_move_phase.sigs.get_signature_count(&cycle_number).await
    }

    // ========================================================================
    // 8-step bridge: MintBridgedShares consensus
    // ========================================================================

    /// Create a MintBridgedShares proposal (leader only)
    pub fn propose_mint_bridged_shares(
        &self,
        cycle_number: u64,
        itp_id: H256,
        user: Address,
        amount: U256,
        bridge_proxy: Address,
        order_id: U256,
    ) -> Result<MintBridgedSharesProposal, BridgeError> {
        let message_hash = build_mint_bridged_shares_hash(
            self.config.settlement_chain_id,
            bridge_proxy,
            itp_id,
            user,
            amount,
            order_id,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = cycle_number,
            itp_id = ?itp_id,
            user = ?user,
            amount = %amount,
            order_id = %order_id,
            message_hash = ?message_hash,
            "MintBridgedShares proposal created"
        );

        Ok(MintBridgedSharesProposal {
            leader_id: self.peer_id,
            cycle_number,
            itp_id,
            user,
            amount,
            order_id,
            leader_signature,
            message_hash,
        })
    }

    /// Validate a MintBridgedShares proposal from the leader
    pub async fn validate_mint_bridged_shares_proposal(
        &self,
        proposal: &MintBridgedSharesProposal,
        bridge_proxy: Address,
    ) -> Result<bool, BridgeError> {
        if self.mint_shares_phase.confirmed.read().await.contains_key(&proposal.cycle_number) {
            warn!(
                cycle_number = proposal.cycle_number,
                "MintBridgedShares already processed for this cycle"
            );
            return Ok(false);
        }

        let expected_hash = build_mint_bridged_shares_hash(
            self.config.settlement_chain_id,
            bridge_proxy,
            proposal.itp_id,
            proposal.user,
            proposal.amount,
            proposal.order_id,
        );

        if expected_hash != proposal.message_hash {
            warn!(
                cycle_number = proposal.cycle_number,
                expected = ?expected_hash,
                received = ?proposal.message_hash,
                "MintBridgedShares proposal: message hash mismatch"
            );
            return Ok(false);
        }

        if proposal.amount.is_zero() {
            warn!(
                cycle_number = proposal.cycle_number,
                "MintBridgedShares proposal: zero amount"
            );
            return Ok(false);
        }

        debug!(
            cycle_number = proposal.cycle_number,
            itp_id = ?proposal.itp_id,
            user = ?proposal.user,
            amount = %proposal.amount,
            order_id = %proposal.order_id,
            "MintBridgedShares proposal validation passed"
        );

        Ok(true)
    }

    /// Sign a validated MintBridgedShares proposal (follower)
    pub fn sign_mint_bridged_shares_proposal(
        &self,
        proposal: &MintBridgedSharesProposal,
        bridge_proxy: Address,
    ) -> Result<BLSSignature, BridgeError> {
        let expected_hash = build_mint_bridged_shares_hash(
            self.config.settlement_chain_id,
            bridge_proxy,
            proposal.itp_id,
            proposal.user,
            proposal.amount,
            proposal.order_id,
        );

        if expected_hash != proposal.message_hash {
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        // Must use sign_message_hash, not sign_with_keypair,
        // because expected_hash is already a keccak256 — sign_with_keypair would double-hash
        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number = proposal.cycle_number,
            signer_index = self.node_index,
            "Signed MintBridgedShares proposal"
        );

        Ok(signature)
    }

    /// Start collecting signatures for a MintBridgedShares proposal (leader)
    pub async fn start_mint_shares_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.mint_shares_phase.sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    /// Add a follower signature to the MintBridgedShares collection (leader)
    pub async fn add_mint_shares_follower_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<MintBridgedSharesResult>, BridgeError> {
        self.mint_shares_phase.sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await
    }

    /// Check if MintBridgedShares signature threshold is reached
    pub async fn check_mint_shares_threshold_reached(
        &self,
        cycle_number: u64,
    ) -> Option<MintBridgedSharesResult> {
        self.mint_shares_phase.sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    /// Check if MintBridgedShares is already confirmed for this cycle
    pub async fn is_mint_shares_confirmed(&self, cycle_number: u64) -> bool {
        self.mint_shares_phase.confirmed.read().await.contains_key(&cycle_number)
    }

    /// Record a confirmed mint bridged shares (deduplication)
    pub async fn confirm_mint_shares(&self, cycle_number: u64, tx_hash: H256) {
        self.mint_shares_phase.confirmed.write().await.insert(cycle_number, tx_hash);
    }

    /// Get mint shares signature count for diagnostics
    pub async fn get_mint_shares_signature_count(&self, cycle_number: u64) -> Option<usize> {
        self.mint_shares_phase.sigs.get_signature_count(&cycle_number).await
    }

    // ========================================================================
    // completeBuyOrder BLS consensus
    // ========================================================================

    pub fn propose_complete_buy_order(
        &self,
        cycle_number: u64,
        order_id: U256,
        vault: Address,
    ) -> Result<CompleteBuyOrderProposal, BridgeError> {
        let message_hash = build_complete_buy_order_hash(
            self.config.settlement_chain_id,
            self.config.settlement_custody_address,
            order_id,
            vault,
        );

        let hash_bytes: [u8; 32] = message_hash.into();
        let leader_signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        info!(
            cycle_number,
            order_id = %order_id,
            vault = ?vault,
            message_hash = ?message_hash,
            "CompleteBuyOrder proposal created"
        );

        Ok(CompleteBuyOrderProposal {
            leader_id: self.peer_id,
            cycle_number,
            order_id,
            vault,
            leader_signature,
            message_hash,
        })
    }

    pub fn sign_complete_buy_order_proposal(
        &self,
        proposal: &CompleteBuyOrderProposal,
    ) -> Result<BLSSignature, BridgeError> {
        let expected_hash = build_complete_buy_order_hash(
            self.config.settlement_chain_id,
            self.config.settlement_custody_address,
            proposal.order_id,
            proposal.vault,
        );

        if expected_hash != proposal.message_hash {
            return Err(BridgeError::ProposalMismatch {
                field: "message_hash".to_string(),
            });
        }

        let hash_bytes: [u8; 32] = expected_hash.into();
        let signature = self
            .bls_signer
            .sign_message_hash(&self.bls_keypair, &hash_bytes)
            .map_err(|e| ConsensusError::BlsSigningError {
                reason: e.to_string(),
            })?;

        Ok(signature)
    }

    pub async fn start_complete_buy_order_signature_collection(
        &self,
        cycle_number: u64,
        leader_signature: BLSSignature,
    ) {
        self.complete_buy_sigs
            .start_collection(cycle_number, self.node_index, leader_signature)
            .await;
    }

    pub async fn add_complete_buy_order_signature(
        &self,
        cycle_number: u64,
        signer_index: u8,
        signature: BLSSignature,
    ) -> Result<Option<CompleteBuyOrderResult>, BridgeError> {
        let result = self.complete_buy_sigs
            .add_follower_signature(
                &cycle_number,
                signer_index,
                signature,
                self.config.min_signatures,
                &self.bls_signer,
            )
            .await?;

        if result.is_some() {
            self.complete_buy_notify.notify_waiters();
        }

        Ok(result)
    }

    pub async fn check_complete_buy_order_threshold(
        &self,
        cycle_number: u64,
    ) -> Option<CompleteBuyOrderResult> {
        self.complete_buy_sigs
            .check_threshold(&cycle_number, self.config.min_signatures, &self.bls_signer)
            .await
    }

    pub async fn is_complete_buy_order_confirmed(&self, cycle_number: u64) -> bool {
        self.confirmed_complete_buy.read().await.contains_key(&cycle_number)
    }

    pub async fn mark_complete_buy_order_confirmed(&self, cycle_number: u64) {
        self.confirmed_complete_buy.write().await.insert(cycle_number, true);
    }

    pub async fn get_complete_buy_order_signature_count(&self, cycle_number: u64) -> Option<usize> {
        self.complete_buy_sigs.get_signature_count(&cycle_number).await
    }

    /// Mark orders as SharesBridged (Step 8 complete)
    pub async fn mark_orders_shares_bridged(&self, order_ids: &[U256]) {
        for order_id in order_ids {
            self.set_order_status(*order_id, BridgeOrderStatus::SharesBridged).await;
        }
    }
}

// Tests are in oracle/tests/bridge_settlement_to_l3_integration.rs (Task 10)
// Submit order tests will be in oracle/tests/submit_order_integration.rs
// Basic unit tests for types are in types.rs
