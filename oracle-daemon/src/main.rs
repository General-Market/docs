//! Prediction-market oracle daemon.
//!
//! Stateless by construction (MR8). Chain is the source of truth. On each
//! wake the daemon asks three questions:
//!   1. Which markets have passed `close_time` with no baseline?
//!   2. Which markets have a baseline and passed `settlement_time` unresolved?
//!   3. Which resolved markets still hold open positions?
//! It cranks each in turn. No local cache. No baseline file. No tick store.

use anyhow::Result;
use tracing::{error, info};

mod config;
mod feed;
mod identity;
mod metrics;
mod payload;
mod scanner;
mod scheduler;
mod submitter;

use solana_commitment_config::CommitmentConfig;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use std::sync::Arc;

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

    let identity = Arc::new(identity::Identity::load(&cfg.oracle_keypair_path)?);
    info!(pubkey = %identity.pubkey, "identity verified");

    let rpc = Arc::new(RpcClient::new_with_commitment(
        cfg.rpc_url.clone(),
        CommitmentConfig::confirmed(),
    ));
    let metrics_bundle = metrics::Metrics::new()?;

    // SA14 — refuse to start if under-funded.
    match metrics::check_boot_balance(&rpc, &identity.pubkey, cfg.min_sol_balance).await {
        Ok(sol) => metrics_bundle.keypair_sol_balance.set(sol),
        Err(e) => {
            error!(error = %e, "boot balance check failed");
            return Err(e);
        }
    }

    let stake_mint = scheduler::fetch_stake_mint(&rpc, &cfg.program_id).await?;
    info!(%stake_mint, "resolved stake mint from GlobalConfig");

    metrics::spawn_server(metrics_bundle.clone(), cfg.metrics_port);

    let feed = feed::Feed::new(cfg.data_node_url.clone());
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

    let state = Arc::new(scheduler::SchedulerState {
        rpc: rpc.clone(),
        feed,
        identity: identity.clone(),
        program_id: cfg.program_id,
        metrics: metrics_bundle.clone(),
        stake_mint,
        poll_interval: cfg.poll_interval,
    });

    let scheduler_handle = tokio::spawn({
        let state = state.clone();
        async move {
            if let Err(e) = scheduler::run(state, shutdown_rx).await {
                error!(error = %e, "scheduler exited with error");
            }
        }
    });

    // Install signal handlers: SIGINT and SIGTERM both trigger a graceful
    // shutdown. Systemd sends SIGTERM; operators Ctrl-C during smoke.
    wait_for_signal().await;
    info!("shutdown signal received; stopping scheduler");
    let _ = shutdown_tx.send(true);
    let _ = scheduler_handle.await;
    info!("exit");
    Ok(())
}

async fn wait_for_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{signal, SignalKind};
        let mut term = signal(SignalKind::terminate()).expect("sigterm handler");
        let mut int = signal(SignalKind::interrupt()).expect("sigint handler");
        tokio::select! {
            _ = term.recv() => info!("SIGTERM"),
            _ = int.recv() => info!("SIGINT"),
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
