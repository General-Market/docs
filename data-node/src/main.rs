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
mod vision_api;
mod vision_batch_cache;
mod vision_ws;
mod sse_limiter;

mod helpers;
mod logo_sync;
mod serve;

use clap::Parser;
use crate::config::{Cli, Command};

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
    }
}
