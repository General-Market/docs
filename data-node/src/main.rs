mod api;
mod backfill;
mod backfill_util;
mod batch_engine;
mod bitget_init;
mod cg_backfill;
mod cg_collector;
pub mod chain_cache;
pub mod chain_event_scanner;
mod chain_pollers;
mod coingecko;
mod collector;
mod collector_loop;
mod config;
mod db;
mod defillama;
mod evm_init;
mod explorer_api;
mod dl_backfill;
mod dl_collector;
mod fng_client;
mod fng_collector;
mod oracle_health_collector;
mod itp_collector;
mod kline_collector;
mod liquidity_collector;
mod listing_sync;
mod orderbook_aggregator;
pub mod live_cache;
mod logo_downloader;
mod simulation;
mod source_registry;
mod trade_collector;
mod work_queue;
mod market_data;
mod points;
mod pvp;
mod pvp_cohort;
mod vision_api;
mod vision_batch_cache;
mod vision_ws;
mod sse_limiter;

mod helpers;
mod logo_sync;
mod serve;

use clap::Parser;
use crate::config::{Cli, Command, VerifyDeploymentArgs};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file BEFORE clap parses args (clap reads env vars during parse).
    // Try CWD/.env first, then data-node/.env (when running from project root).
    if dotenvy::dotenv().is_err() {
        dotenvy::from_filename("data-node/.env").ok();
    }

    let cli = Cli::parse();

    match cli.command {
        Command::Serve(args) => serve::run_serve(args).await,
        Command::Backfill(args) => backfill::run(args).await,
        Command::CgBackfill(args) => cg_backfill::run(args).await,
        Command::SyncLogos(args) => logo_sync::run_sync_logos(args).await,
        Command::SyncListings(args) => listing_sync::run(args).await,
        Command::DlBackfill(args) => dl_backfill::run(args).await,
        Command::VerifyDeployment(args) => run_verify_deployment(args).await,
    }
}

/// CI-friendly one-shot verifier. Loads deployment JSON, runs the same
/// verifier the long-running services use, exits non-zero on mismatch.
/// Routes through the same path as boot so CI failure modes match prod.
async fn run_verify_deployment(args: VerifyDeploymentArgs) -> Result<(), Box<dyn std::error::Error>> {
    use std::path::PathBuf;

    let deployment_path = PathBuf::from(&args.deployment_file);
    let deployment = common::adapters::DeploymentConfig::from_file(&deployment_path)
        .map_err(|e| format!("Failed to read {}: {}", args.deployment_file, e))?;

    let labels: Vec<&str> = args.labels.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if labels.is_empty() {
        return Err("--labels must contain at least one contract name".into());
    }

    // verify_deployment_or_die panics on failure, which is the right shape
    // for long-running services. For the CLI, we reach into the verifier
    // directly so we exit cleanly with a non-zero status code instead.
    let mut resolved: Vec<(&str, ethers::types::Address)> = Vec::with_capacity(labels.len());
    let mut missing: Vec<&str> = Vec::new();
    for label in &labels {
        match deployment.get_contract_address(label) {
            Ok(addr) => resolved.push((*label, addr)),
            Err(_) => missing.push(*label),
        }
    }
    if !missing.is_empty() {
        eprintln!(
            "verify-deployment: missing contracts {:?} in {}",
            missing, args.deployment_file
        );
        std::process::exit(2);
    }

    let verifier = common::adapters::DeploymentVerifier::new(&args.rpc_url, deployment.chain_id);
    match verifier.verify(&resolved).await {
        Ok(()) => {
            println!(
                "verify-deployment: OK — {} contracts present on chainId {} via {}",
                resolved.len(),
                deployment.chain_id,
                args.rpc_url
            );
            Ok(())
        }
        Err(e) => {
            eprintln!("verify-deployment: FAIL — {}", e);
            std::process::exit(1);
        }
    }
}
