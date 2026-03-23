//! AP (Authorized Participant) / Keeper service binary for Index L3
//!
//! Monitors events, manages order queues, and executes trades on Bitget.

mod cli;
mod event_processor;
mod http_api;
mod runner;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use ap::config::{APConfig, ConfigBuilder};
use clap::Parser;
use tokio::signal;
use tracing::{error, warn};

use crate::cli::Args;
use crate::runner::run_ap;

fn setup_logging(config: &APConfig) -> Result<(), Box<dyn std::error::Error>> {
    let log_config = common::logging::LogConfig {
        level: config.effective_log_level(),
        dir: config.effective_log_dir(),
        json_enabled: config.effective_json_logs(),
        component_name: "ap".to_string(),
        node_id: None,
    };
    common::logging::init_logging(&log_config)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Build configuration using the layered resolution chain:
    // CLI > ENV > Config file > Defaults
    // Resolve bitget testnet/mainnet from CLI flags
    let bitget_testnet_cli = if args.bitget_mainnet {
        Some(false) // --bitget-mainnet means testnet=false
    } else if args.bitget_testnet {
        Some(true)
    } else {
        None // Let env/config/default decide
    };

    let config = ConfigBuilder::new()
        .with_config_file(args.config.clone())
        .with_cli_args(
            Some(args.port),
            Some(args.rpc.clone()),
            if args.mock_bitget { Some(true) } else { None },
            Some(args.log_level.clone()),
            Some(args.log_dir.clone()),
            if args.json_logs { Some(true) } else { None },
            args.index_contract.clone(),
            bitget_testnet_cli,
        )
        .with_deployment_file(args.deployment_file.clone())
        .with_mock_chain(if args.mock_chain { Some(true) } else { None })
        .with_bitget_vault(args.bitget_vault.clone())
        .with_chain_id(args.chain_id)
        .with_mock_usdt(args.mock_usdt.clone())
        .with_data_node_url(args.data_node_url.clone())
        .with_settlement_rpc_url(args.settlement_rpc)
        .with_settlement_chain_id(args.settlement_chain_id)
        .with_exchange_mode(args.exchange_mode)
        .build()
        .map_err(|e| {
            eprintln!("Configuration error: {}", e);
            e
        })?;

    setup_logging(&config)?;

    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = shutdown.clone();

    tokio::spawn(async move {
        let ctrl_c = async {
            // SAFETY: Signal handler installation only fails if the OS refuses,
            // which is an unrecoverable environment issue at startup.
            signal::ctrl_c()
                .await
                .expect("Failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            // SAFETY: Signal handler installation only fails if the OS refuses.
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("Failed to install signal handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {
                warn!("Received Ctrl+C, initiating shutdown");
            }
            _ = terminate => {
                warn!("Received SIGTERM, initiating shutdown");
            }
        }

        shutdown_clone.store(true, Ordering::Relaxed);
    });

    if let Err(e) = run_ap(config, shutdown).await {
        error!(code = "E008", error = %e, "AP service error");
        std::process::exit(1);
    }

    Ok(())
}
