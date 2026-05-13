//! Vision configuration
//!
//! Configuration for the Vision prediction market subsystem (round-based only).

use serde::{Deserialize, Serialize};

/// Configuration for the Vision subsystem.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionConfig {
    /// Whether the Vision subsystem is enabled.
    pub enabled: bool,
    /// Address of the Vision contract on L3.
    pub vision_address: String,
    /// URL of the data-node for price feeds.
    pub data_node_url: String,
    /// PostgreSQL connection string for Vision state.
    pub database_url: String,
    /// WebSocket RPC URL for chain event subscriptions.
    pub rpc_ws_url: String,
    /// Block number to start syncing events from.
    pub start_block: u64,
    /// Maximum age (in seconds) for price data before it is considered stale.
    pub staleness_threshold_secs: u64,
    /// Optional bearer token for authenticating data-node HTTP requests.
    pub data_node_token: Option<String>,
    /// Shared HMAC secret for verifying snapshot responses from data-node (IS-7).
    pub snapshot_hmac_secret: Option<String>,

    // =========================================================================
    // BLS consensus fields
    // =========================================================================

    /// L3 chain ID for BLS hash domain separation. Default: 111222333 (Index L3).
    pub chain_id: u64,
    /// Number of active oracles in the network. Default: 1 (single-oracle, no consensus).
    pub num_oracles: usize,
    /// This oracle's node index (0-based) for signer bitmap computation.
    pub node_index: u8,

    // =========================================================================
    // Settlement / cross-chain fields
    // =========================================================================

    /// Settlement RPC URL.
    pub settlement_rpc_url: String,
    /// SettlementBridgeCustody contract address on Settlement.
    pub settlement_bridge_custody_address: String,
    /// Settlement chain ID (42161 for mainnet, 421614 for Sepolia).
    pub settlement_chain_id: u64,
    /// Polling interval (ms) for checking new Settlement deposit events.
    pub deposit_poll_interval_ms: u64,
    /// Number of Settlement confirmations before considering a deposit finalized.
    pub deposit_finality_confirmations: u64,
    /// GM gas drip amount for new users (wei). Default: 0.01 GM = 10^16 wei.
    pub gas_drip_amount_wei: String,
    /// Minimum GM balance threshold below which a gas drip is sent.
    pub gas_drip_threshold_wei: String,
    /// Auto-refund timeout for stuck `pending` deposits (seconds). Default: 7200 (2h).
    pub deposit_auto_refund_timeout_secs: u64,

    // =========================================================================
    // Round-based batch lifecycle fields
    // =========================================================================

    /// OracleRegistry contract address on L3.
    #[serde(default)]
    pub oracle_registry_address: String,

    /// VisionReconciler helper for bundled vault reconciles. Empty falls back
    /// to per-player calls.
    #[serde(default)]
    pub vision_reconciler_address: String,

    /// Enable single-aggregated-BLS bundle path (settleBatchesSingle). OFF by
    /// default — only activate after the on-chain Vision contract has the
    /// `settleBatchesSingle` selector. Without the contract upgrade, bundle
    /// submissions revert and tagged per-batch proofs stay un-claimable.
    #[serde(default)]
    pub bundle_single_sig_enabled: bool,

    /// When set, lifecycle resolves existing batches but does NOT create new ones.
    /// Used to drain the legacy Vision contract before cutting over to Vision v4
    /// without orphaning batches mid-tick.
    #[serde(default)]
    pub legacy_drain_only: bool,
}

impl Default for VisionConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            vision_address: String::new(),
            data_node_url: "http://localhost:8200".into(),
            database_url: "postgres://localhost:5432/vision".into(),
            rpc_ws_url: "ws://localhost:8546".into(),
            start_block: 0,
            staleness_threshold_secs: 1800,
            data_node_token: None,
            snapshot_hmac_secret: None,
            // BLS consensus defaults
            chain_id: 111222333,
            num_oracles: 1,
            node_index: 0,
            // Settlement defaults
            settlement_rpc_url: "https://arb1.arbitrum.io/rpc".into(),
            settlement_bridge_custody_address: String::new(),
            settlement_chain_id: 42161,
            deposit_poll_interval_ms: 1000,
            deposit_finality_confirmations: 3,
            gas_drip_amount_wei: "10000000000000000".into(),
            gas_drip_threshold_wei: "5000000000000000".into(),
            deposit_auto_refund_timeout_secs: 7200,
            // Round-based lifecycle
            oracle_registry_address: String::new(),
            vision_reconciler_address: String::new(),
            bundle_single_sig_enabled: false,
            legacy_drain_only: false,
        }
    }
}
