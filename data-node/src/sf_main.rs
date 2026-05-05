//! sfdata-node — isolated scrape-heavy data-node.
//!
//! This is a thin wrapper around the full `data-node` serve path. Before
//! dispatching, it sets `SF_MODE=1`, which causes `helpers::spawn_resilient`
//! to skip every source not in `SF_MODE_ALLOWED`. Effectively, only the
//! tube and cam sources spawn.
//!
//! **Why a separate binary, not just an env var?** Deployment clarity: on
//! VPS 3 the systemd unit / docker-compose runs `sfdata-node`; on VPS 1 it
//! runs `data-node`. No chance of forgetting to set SF_MODE on the wrong
//! machine. Same Rust code, same Docker image build path, different
//! entrypoint.
//!
//! All CLI subcommands still work — only `Serve` behaves differently.
//! Backfill, SyncListings, etc. are unchanged and can be run on either
//! binary. In practice the sfdata-node only needs `Serve`.

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
use crate::config::{Cli, Command};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Enforce SF_MODE for this binary. Any accidental unset on the deploy
    // host is corrected here; any accidental set on the main data-node is
    // impossible because that binary is a different crate target entirely.
    std::env::set_var("SF_MODE", "1");

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
        Command::VerifyDeployment(_) => {
            Err("verify-deployment is not available in sfdata-node — use the main data-node binary".into())
        }
    }
}
