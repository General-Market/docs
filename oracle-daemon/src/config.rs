//! Env-driven configuration (MR8 — no config file, no state dir).
//!
//! The daemon reads every setting from the environment at boot. Restart is the
//! only reconfiguration primitive. The less state on disk, the less drift
//! between what operators believe and what the process remembers.

use anyhow::{anyhow, Context, Result};
use solana_pubkey::Pubkey;
use std::str::FromStr;
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct Config {
    /// Solana RPC endpoint. WebSocket is derived by swapping the scheme.
    pub rpc_url: String,
    /// Deployed program ID. Defaults to the program's `declare_id!`.
    pub program_id: Pubkey,
    /// Absolute path to the daemon's Solana keypair JSON file.
    pub oracle_keypair_path: String,
    /// Base URL of the data-node HTTP service (without trailing slash).
    pub data_node_url: String,
    /// Prometheus exporter bind port.
    pub metrics_port: u16,
    /// Seconds between chain scans.
    pub poll_interval: Duration,
    /// Minimum SOL balance required at boot. Refuse to start below this.
    pub min_sol_balance: f64,
}

const DEFAULT_PROGRAM_ID: &str = "DQwMnwQGYuLDvciSFZNgUvcHkA3Buyhk3ejgbACvSydA";

impl Config {
    pub fn from_env() -> Result<Self> {
        let rpc_url = std::env::var("RPC_URL")
            .context("RPC_URL is required")?;

        let program_id = match std::env::var("PROGRAM_ID") {
            Ok(s) => Pubkey::from_str(&s).context("PROGRAM_ID is not a valid base58 pubkey")?,
            Err(_) => Pubkey::from_str(DEFAULT_PROGRAM_ID).unwrap(),
        };

        let oracle_keypair_path = std::env::var("ORACLE_KEYPAIR")
            .context("ORACLE_KEYPAIR path is required")?;

        let data_node_url = std::env::var("DATA_NODE_URL")
            .context("DATA_NODE_URL is required")?
            .trim_end_matches('/')
            .to_string();

        let metrics_port = std::env::var("METRICS_PORT")
            .ok()
            .map(|s| s.parse::<u16>())
            .transpose()
            .map_err(|e| anyhow!("METRICS_PORT invalid: {e}"))?
            .unwrap_or(9091);

        let poll_secs = std::env::var("POLL_INTERVAL_SECS")
            .ok()
            .map(|s| s.parse::<u64>())
            .transpose()
            .map_err(|e| anyhow!("POLL_INTERVAL_SECS invalid: {e}"))?
            .unwrap_or(30);

        let min_sol_balance = std::env::var("MIN_SOL_BALANCE")
            .ok()
            .map(|s| s.parse::<f64>())
            .transpose()
            .map_err(|e| anyhow!("MIN_SOL_BALANCE invalid: {e}"))?
            .unwrap_or(0.1);

        Ok(Self {
            rpc_url,
            program_id,
            oracle_keypair_path,
            data_node_url,
            metrics_port,
            poll_interval: Duration::from_secs(poll_secs),
            min_sol_balance,
        })
    }
}
