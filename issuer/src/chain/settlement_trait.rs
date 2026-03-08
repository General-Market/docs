//! SettlementReader trait — abstract interface for settlement chain reads.
//!
//! Allows swapping between direct RPC (SettlementChainReader) and
//! data-node-backed (DataNodeSettlementReader) implementations.

use async_trait::async_trait;
use ethers::types::U256;

use crate::bridge::{BridgeError, CrossChainOrderReader};
use crate::chain::events::{
    CrossChainOrder, CrossChainOrderData, CrossChainOrderEvent, CrossChainSellOrderEvent,
    ItpCreatedEvent, ItpCreationRequest,
};
use common::types::CrossChainSellOrderData;
use crate::chain::settlement_reader::SettlementReaderError;
use crate::consensus::ConsensusError;

/// Abstract interface for reading settlement chain state.
///
/// The existing `SettlementChainReader<M>` implements this via direct RPC.
/// `DataNodeSettlementReader` implements it via data-node HTTP + SSE.
///
/// Deduplication state (seen_orders, retry_counts) is per-implementation,
/// since each issuer maintains its own processing state.
#[async_trait]
pub trait SettlementReader: Send + Sync {
    /// Settlement chain ID
    fn chain_id(&self) -> u64;

    /// Get the current confirmed block number (latest - confirmations)
    async fn get_confirmed_block(&self) -> Result<u64, SettlementReaderError>;

    // ── ITP Creation ────────────────────────────────────────────

    /// Get CreateItpRequested events in a block range
    async fn get_create_itp_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<ItpCreationRequest>, SettlementReaderError>;

    /// Get ItpCreated events in a block range
    async fn get_itp_created_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<ItpCreatedEvent>, SettlementReaderError>;

    /// Check if a specific nonce is pending
    async fn is_pending(&self, nonce: U256) -> Result<bool, SettlementReaderError>;

    /// Get the next creation nonce from BridgeProxy
    async fn get_next_nonce(&self) -> Result<U256, SettlementReaderError>;

    /// Get pending creation details for a specific nonce
    async fn get_pending_creation(
        &self,
        nonce: U256,
    ) -> Result<Option<ItpCreationRequest>, SettlementReaderError>;

    /// Get all pending ITP creation requests
    async fn get_all_pending_requests(
        &self,
    ) -> Result<Vec<ItpCreationRequest>, SettlementReaderError>;

    // ── Cross-Chain Buy Orders ──────────────────────────────────

    /// Get CrossChainOrderCreated events in a block range
    async fn get_cross_chain_order_events(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainOrderEvent>, SettlementReaderError>;

    /// Get full CrossChainOrder data by order ID
    async fn get_cross_chain_order(
        &self,
        order_id: U256,
    ) -> Result<Option<CrossChainOrderData>, SettlementReaderError>;

    /// Query a single cross-chain sell order by ID. Returns None if deleted (user = address(0)).
    async fn get_cross_chain_sell_order(
        &self,
        order_id: U256,
    ) -> Result<Option<CrossChainSellOrderData>, SettlementReaderError>;

    /// Scan all cross-chain orders by ID (not events). Returns unfilled buy and sell orders.
    /// Used on startup to eliminate the 5000-block event scan window.
    async fn get_all_unfilled_orders(
        &self,
    ) -> Result<(Vec<CrossChainOrder>, Vec<CrossChainSellOrderEvent>), SettlementReaderError>;

    /// Get confirmed, deduplicated cross-chain orders ready for processing
    async fn get_confirmed_cross_chain_orders(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainOrder>, SettlementReaderError>;

    /// Mark an order as successfully processed (dedup)
    async fn mark_order_processed(&self, chain_id: u64, order_id: U256);

    /// Increment retry count for a failed order, returns new count
    async fn increment_retry_count(&self, chain_id: u64, order_id: U256) -> u8;

    /// Remove an order from the dedup set (for stale order watchdog)
    async fn remove_seen_order(&self, chain_id: u64, order_id: U256);

    /// Clear old entries from dedup set to prevent unbounded growth
    async fn clear_old_seen_orders(&self, max_size: usize);

    // ── Cross-Chain Sell Orders ─────────────────────────────────

    /// Get confirmed, deduplicated cross-chain sell orders
    async fn get_confirmed_cross_chain_sell_orders(
        &self,
        from_block: u64,
        to_block: u64,
    ) -> Result<Vec<CrossChainSellOrderEvent>, SettlementReaderError>;

    /// Mark a sell order as successfully processed (dedup)
    async fn mark_sell_order_processed(&self, chain_id: u64, order_id: U256);

    /// Increment retry count for a failed sell order, returns new count
    async fn increment_sell_retry_count(&self, chain_id: u64, order_id: U256) -> u8;

    /// Remove a sell order from the dedup set
    async fn remove_seen_sell_order(&self, chain_id: u64, order_id: U256);

    /// Clear old entries from sell order dedup set
    async fn clear_old_seen_sell_orders(&self, max_size: usize);
}

// ── Adapter: SettlementReader → CrossChainOrderReader ──────────────

use std::sync::Arc;

/// Wraps an `Arc<dyn SettlementReader>` to implement `CrossChainOrderReader`.
/// Use this to pass a settlement reader to `BridgeOrchestrator::new()`.
pub struct SettlementOrderReader(pub Arc<dyn SettlementReader>);

#[async_trait]
impl CrossChainOrderReader for SettlementOrderReader {
    async fn get_cross_chain_order(
        &self,
        order_id: U256,
    ) -> Result<CrossChainOrderData, BridgeError> {
        match self.0.get_cross_chain_order(order_id).await {
            Ok(Some(data)) => Ok(data),
            Ok(None) => Err(ConsensusError::ChainReaderError {
                reason: format!(
                    "Order {} not found on-chain (user is zero address)",
                    order_id
                ),
            }
            .into()),
            Err(e) => Err(ConsensusError::ChainReaderError {
                reason: format!("Failed to fetch order {}: {}", order_id, e),
            }
            .into()),
        }
    }
}
