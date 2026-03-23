//! ChainReader trait for reading blockchain state

use async_trait::async_trait;
use futures::stream::BoxStream;
use serde::{Deserialize, Serialize};

use crate::error::Error;
use crate::types::{Oracle, ITPCore, LimitOrder, Price};

/// Filter for blockchain events
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventFilter {
    /// Filter by contract address (optional)
    pub address: Option<[u8; 20]>,
    /// Filter by event topics (optional)
    pub topics: Vec<[u8; 32]>,
    /// Start block (optional)
    pub from_block: Option<u64>,
    /// End block (optional)
    pub to_block: Option<u64>,
}

/// Blockchain event types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChainEvent {
    /// Order was submitted
    OrderSubmitted {
        order_id: u64,
        user: [u8; 20],
        itp_id: [u8; 32],
        /// Trade side: 0=BUY, 1=SELL (extracted from event data)
        side: u8,
    },
    /// Fill was confirmed
    FillConfirmed {
        order_id: u64,
        fill_price: ethers::types::U256,
        fill_amount: ethers::types::U256,
    },
    /// ITP was created
    ITPCreated {
        itp_id: [u8; 32],
        name: String,
        symbol: String,
    },
    /// Batch was confirmed on-chain
    BatchConfirmed {
        cycle_number: u64,
        order_count: u64,
    },
    /// Trade request event from Index.sol (for AP monitoring)
    TradeRequest {
        cycle_number: u64,
        pair_id: [u8; 32],
        side: u8,
        amount: ethers::types::U256,
        limit_price: ethers::types::U256,
        block_number: u64,
        tx_hash: [u8; 32],
        log_index: u64,
    },
    /// Withdrawal request event (placeholder - not yet in contracts)
    WithdrawalRequest {
        itp_id: [u8; 32],
        amount: ethers::types::U256,
        destination: [u8; 20],
        block_number: u64,
        tx_hash: [u8; 32],
        log_index: u64,
    },
    /// Per-asset trade request from oracle decomposition + cross-ITP netting
    AssetTradeRequest {
        cycle_number: u64,
        asset: [u8; 20],
        side: u8,
        usdc_amount: ethers::types::U256,
        price: ethers::types::U256,
        /// Quote token for settlement (all-zeros = default USDC)
        quote_token: [u8; 20],
        block_number: u64,
        tx_hash: [u8; 32],
        log_index: u64,
    },
}

/// Stream of blockchain events
pub type EventStream = BoxStream<'static, Result<ChainEvent, Error>>;

/// Pending rebalance detected from on-chain RebalanceRequested events
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PendingRebalance {
    /// ITP identifier
    pub itp_id: [u8; 32],
    /// New target weights for the ITP's assets
    pub new_weights: Vec<ethers::types::U256>,
    /// Block number when the rebalance was proposed
    pub proposed_at_block: u64,
    /// New inventory quantities (per-share) after rebalance
    pub new_inventory: Vec<ethers::types::U256>,
    /// NAV at time of rebalance (18 decimals)
    pub nav: ethers::types::U256,
    /// Indices of assets to remove (sorted descending), can be empty
    pub remove_indices: Vec<ethers::types::U256>,
    /// New asset addresses to add, can be empty
    pub add_assets: Vec<ethers::types::Address>,
    /// Current asset addresses for the ITP (from getITPState)
    pub current_assets: Vec<ethers::types::Address>,
}

/// ITP inventory state for decomposition (per-share quantities + NAV)
#[derive(Debug, Clone)]
pub struct ItpInventoryState {
    /// Asset addresses
    pub assets: Vec<ethers::types::Address>,
    /// Per-share quantities (18 decimals) — parallel to `assets`
    pub quantities: Vec<ethers::types::U256>,
    /// NAV per share (18 decimals)
    pub nav: ethers::types::U256,
}

/// Trait for reading blockchain state
/// Defines methods for querying on-chain data
#[async_trait]
pub trait ChainReader: Send + Sync {
    /// Get all pending orders from the chain
    async fn get_pending_orders(&self) -> Result<Vec<LimitOrder>, Error>;

    /// Get ITP data by ID
    async fn get_itp(&self, itp_id: [u8; 32]) -> Result<ITPCore, Error>;

    /// Get current prices for all assets
    async fn get_prices(&self) -> Result<Vec<Price>, Error>;

    /// Get all registered oracles
    async fn get_oracle_registry(&self) -> Result<Vec<Oracle>, Error>;

    /// Subscribe to blockchain events matching the filter
    async fn subscribe_events(&self, filter: EventFilter) -> Result<EventStream, Error>;

    /// Get the last processed cycle number from the Index contract
    ///
    /// Used by oracles to auto-discover the next available cycle on restart.
    /// Returns 0 if no cycles have been processed yet.
    ///
    /// Default implementation returns 0 for backwards compatibility.
    async fn get_last_processed_cycle(&self) -> Result<u64, Error> {
        Ok(0)
    }

    /// Get pending rebalances from on-chain RebalanceProposed events.
    ///
    /// Returns active pending rebalances that haven't been executed yet.
    /// Default implementation returns empty for backwards compatibility.
    async fn get_pending_rebalances(&self) -> Result<Vec<PendingRebalance>, Error> {
        Ok(Vec::new())
    }

    /// Get the next order ID from the Index contract.
    ///
    /// Returns the value of `nextOrderId` which is the ID that will be assigned
    /// to the next order submitted. Used by followers to derive the L3 order ID
    /// after a submit order consensus phase completes.
    /// Default implementation returns 0 for backwards compatibility.
    async fn get_next_order_id(&self) -> Result<u64, Error> {
        Ok(0)
    }

    /// Get orders in BATCHED state (status=1) that need fills confirmation
    async fn get_batched_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        Ok(vec![])
    }

    /// Get ITP inventory state for asset decomposition.
    ///
    /// Returns per-share asset quantities and NAV, used by oracles to decompose
    /// ITP-level orders into per-asset trades for cross-ITP netting.
    async fn get_itp_inventory_state(&self, itp_id: [u8; 32]) -> Result<ItpInventoryState, Error> {
        let _ = itp_id;
        Err(Error::NotFound("get_itp_inventory_state not implemented".to_string()))
    }

    /// Get the number of currently active oracles from OracleRegistry.activeOracleCount().
    ///
    /// Used to compute the BFT threshold without relying on CLI `--num-oracles`.
    /// Default implementation returns an error for backwards compatibility.
    async fn get_active_oracle_count(&self) -> Result<u64, Error> {
        Err(Error::ChainRead("get_active_oracle_count not implemented".to_string()))
    }

    /// Get the registry nonce from OracleRegistry.registryNonce().
    ///
    /// Incremented on every state change (add/remove oracle, key rotation).
    /// Used for sync tracking and replay protection.
    /// Default implementation returns an error for backwards compatibility.
    async fn get_registry_nonce(&self) -> Result<u64, Error> {
        Err(Error::ChainRead("get_registry_nonce not implemented".to_string()))
    }

    /// Get the aggregated BLS public key from OracleRegistry.getAggregatedPubkey().
    ///
    /// Returns the precomputed aggregated G2 pubkey stored on-chain.
    /// Default implementation returns an error for backwards compatibility.
    async fn get_aggregated_pubkey(&self) -> Result<Vec<u8>, Error> {
        Err(Error::ChainRead("get_aggregated_pubkey not implemented".to_string()))
    }

    /// Check if consensus is paused on-chain (OracleRegistry.consensusPaused()).
    ///
    /// Used at cycle start to skip consensus during deployment ceremonies.
    /// Default implementation returns false for backwards compatibility.
    async fn is_consensus_paused(&self) -> Result<bool, Error> {
        Ok(false)
    }
}
