//! P2Pool configuration
//!
//! Configuration for the P2Pool prediction market subsystem.

use serde::{Deserialize, Serialize};

/// Configuration for the P2Pool subsystem.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2PoolConfig {
    /// Whether the P2Pool subsystem is enabled.
    pub enabled: bool,
    /// Address of the Vision contract on L3.
    pub vision_address: String,
    /// URL of the data-node for price feeds.
    pub data_node_url: String,
    /// PostgreSQL connection string for P2Pool state.
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
}

impl Default for P2PoolConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            vision_address: String::new(),
            data_node_url: "http://localhost:8200".into(),
            database_url: "postgres://localhost:5432/p2pool".into(),
            rpc_ws_url: "ws://localhost:8546".into(),
            start_block: 0,
            reveal_window_secs: 600,
            commitment_offset: 9,
            staleness_threshold_secs: 300,
            tick_poll_interval_ms: 1000,
        }
    }
}
