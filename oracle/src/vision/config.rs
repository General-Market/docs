//! Vision configuration
//!
//! Configuration for the Vision prediction market subsystem.

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
    /// Window (in seconds) for players to reveal bitmaps after commitment.
    pub reveal_window_secs: u64,
    /// Number of ticks before the current tick that commitments target.
    pub commitment_offset: u64,
    /// Maximum age (in seconds) for price data before it is considered stale.
    pub staleness_threshold_secs: u64,
    /// Interval (in milliseconds) between tick polling checks.
    pub tick_poll_interval_ms: u64,
    /// Optional bearer token for authenticating data-node HTTP requests.
    pub data_node_token: Option<String>,
    /// Shared HMAC secret for verifying snapshot responses from data-node (IS-7).
    /// If set, snapshot responses must include a valid X-Snapshot-HMAC header.
    pub snapshot_hmac_secret: Option<String>,

    // =========================================================================
    // BLS tick consensus fields (T-32)
    // =========================================================================

    /// L3 chain ID for BLS hash domain separation. Default: 111222333 (Index L3).
    pub chain_id: u64,
    /// Number of active oracles in the network. Default: 1 (single-oracle, no consensus).
    pub num_oracles: usize,
    /// This oracle's node index (0-based) for signer bitmap computation.
    pub node_index: u8,

    // =========================================================================
    // Dual-balance / cross-chain deposit fields (Vision First Deposit)
    // =========================================================================

    /// Settlement RPC URL for watching VisionDepositCreated events.
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
            reveal_window_secs: 600,
            commitment_offset: 9,
            staleness_threshold_secs: 300,
            tick_poll_interval_ms: 1000,
            data_node_token: None,
            snapshot_hmac_secret: None,
            // BLS tick consensus defaults
            chain_id: 111222333,
            num_oracles: 1,
            node_index: 0,
            // Cross-chain deposit defaults
            settlement_rpc_url: "https://arb1.arbitrum.io/rpc".into(),
            settlement_bridge_custody_address: String::new(),
            settlement_chain_id: 42161,
            deposit_poll_interval_ms: 1000,  // Fast polling for bridge speed
            deposit_finality_confirmations: 3,  // Sonic has instant finality (was 15)
            gas_drip_amount_wei: "10000000000000000".into(), // 0.01 GM
            gas_drip_threshold_wei: "5000000000000000".into(), // 0.005 GM
            deposit_auto_refund_timeout_secs: 7200, // 2 hours
        }
    }
}
