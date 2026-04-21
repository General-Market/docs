//! Prediction-market oracle daemon.
//!
//! Stateless by construction (MR8). Chain is the source of truth. On each
//! wake the daemon asks three questions:
//!   1. Which markets have passed `close_time` with no baseline?
//!   2. Which markets have a baseline and passed `settlement_time` unresolved?
//!   3. Which resolved markets still hold open positions?
//! It cranks each in turn. No local cache. No baseline file. No tick store.
//!
//! Chunk 1 wires the bones — config, feed, metrics, identity, boot balance.
//! The chain-scanning and submitter machinery lands in later chunks.

use anyhow::Result;
use tracing::{error, info};

mod config;
mod feed;
mod identity;
mod metrics;

use solana_rpc_client::nonblocking::rpc_client::RpcClient;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,prediction_market_oracle=debug".into()),
        )
        .init();

    info!("prediction-market oracle booting");

    let cfg = config::Config::from_env()?;
    info!(program_id = %cfg.program_id, rpc = %cfg.rpc_url, "config loaded");

    let identity = identity::Identity::load(&cfg.oracle_keypair_path)?;
    info!(pubkey = %identity.pubkey, "identity verified");

    let rpc = RpcClient::new(cfg.rpc_url.clone());
    let metrics = metrics::Metrics::new()?;

    // SA14 — refuse to start if under-funded.
    match metrics::check_boot_balance(&rpc, &identity.pubkey, cfg.min_sol_balance).await {
        Ok(sol) => metrics.keypair_sol_balance.set(sol),
        Err(e) => {
            error!(error = %e, "boot balance check failed");
            return Err(e);
        }
    }

    metrics::spawn_server(metrics.clone(), cfg.metrics_port);

    // Scheduler lands in Chunk 3. For now the process holds open and prints
    // a heartbeat so systemd treats it as alive during scaffolding smoke
    // tests. This branch gets replaced with `scheduler::run(...)`.
    info!("scaffolding running; scheduler wiring lands in a later chunk");
    let shutdown = tokio::signal::ctrl_c();
    tokio::select! {
        _ = shutdown => {
            info!("shutdown requested; exiting");
        }
    }
    Ok(())
}
