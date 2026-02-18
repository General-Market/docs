mod api;
mod backfill;
mod cg_backfill;
mod cg_collector;
mod coingecko;
mod collector;
mod config;
mod db;
mod itp_collector;
mod kline_collector;
mod liquidity_collector;
mod listing_sync;
pub mod live_cache;
mod logo_downloader;
mod simulation;
mod trade_collector;

use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use clap::Parser;
use ethers::prelude::*;
use tracing::info;

use crate::api::AppState;
use crate::collector::CollectorState;
use crate::config::{Cli, Command};
use crate::live_cache::LiveTickerCache;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Command::Serve(args) => run_serve(args).await,
        Command::Backfill(args) => backfill::run(args).await,
        Command::CgBackfill(args) => cg_backfill::run(args).await,
        Command::SyncLogos(args) => run_sync_logos(args).await,
        Command::SyncListings(args) => listing_sync::run(args).await,
    }
}

async fn run_serve(args: config::ServeArgs) -> Result<(), Box<dyn std::error::Error>> {
    // Init tracing
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&args.log_level));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    info!("data-node starting (serve mode)");

    // Database
    let pool = db::create_pool(&args.database_url).await?;
    db::run_migrations(&pool).await?;
    info!("Database connected and migrated");

    // Load symbol map for verify-nav
    let symbol_map = api::load_symbol_map(&args.symbol_map)?;

    // Shared collector state
    let collector_state = Arc::new(CollectorState::new());

    // Start collector in background
    let collector_pool = pool.clone();
    let collector_state_clone = Arc::clone(&collector_state);
    let assets_file = args.assets_file.clone();
    let poll_interval = args.poll_interval;
    let retention_days = args.retention_days;

    tokio::spawn(async move {
        collector::run(
            collector_pool,
            collector_state_clone,
            assets_file,
            poll_interval,
            retention_days,
        )
        .await;
    });

    // Start ITP collector in background (if index_address is configured)
    if let Some(ref index_address) = args.index_address {
        let itp_pool = pool.clone();
        let itp_rpc_url = args.rpc_url.clone();
        let itp_index_address = index_address.clone();
        let itp_poll_interval = args.itp_poll_interval;

        tokio::spawn(async move {
            itp_collector::run(
                itp_pool,
                Arc::new(itp_collector::ItpCollectorState::new()),
                itp_rpc_url,
                itp_index_address,
                itp_poll_interval,
            )
            .await;
        });

        info!("ITP collector started");

        // Start trade collector in background (same guard as ITP collector)
        let trade_pool = pool.clone();
        let trade_rpc_url = args.rpc_url.clone();
        let trade_index_address = index_address.clone();
        let trade_poll_interval = args.itp_poll_interval;

        tokio::spawn(async move {
            trade_collector::run(
                trade_pool,
                Arc::new(trade_collector::TradeCollectorState::new()),
                trade_rpc_url,
                trade_index_address,
                trade_poll_interval,
            )
            .await;
        });

        info!("Trade collector started");
    } else {
        info!("ITP collector skipped (no INDEX_ADDRESS configured)");
    }

    // Start kline collector in background
    let kline_pool = pool.clone();
    let kline_symbol_map = args.symbol_map.clone();
    tokio::spawn(async move {
        kline_collector::run(kline_pool, kline_symbol_map).await;
    });
    info!("Kline collector started");

    // Start liquidity collector in background (all symbols from symbol-map)
    {
        let liq_pool = pool.clone();
        let all_symbols: Vec<String> = symbol_map.values().cloned().collect::<HashSet<_>>().into_iter().collect();
        let liq_poll_interval = args.liquidity_poll_interval;
        let liq_retention = args.retention_days;
        let symbol_count = all_symbols.len();
        tokio::spawn(async move {
            liquidity_collector::run(liq_pool, all_symbols, liq_poll_interval, liq_retention).await;
        });
        info!(symbols = symbol_count, poll_secs = liq_poll_interval, "Liquidity collector started");
    }

    // Start CoinGecko market-cap collector (if API key configured)
    let logos_dir = std::path::PathBuf::from(&args.logos_dir);
    if let Some(ref cg_api_key) = args.coingecko_api_key {
        let cg_pool = pool.clone();
        let cg_state = Arc::new(cg_collector::CgCollectorState::new());
        let cg_key = cg_api_key.clone();
        let cg_poll = args.cg_poll_interval;
        let cg_logos_dir = logos_dir.clone();
        tokio::spawn(async move {
            cg_collector::run(cg_pool, cg_state, cg_key, cg_poll, cg_logos_dir).await;
        });
        info!("CoinGecko market-cap collector started");
    } else {
        info!("CoinGecko collector skipped (no COINGECKO_API_KEY configured)");
    }

    // Start daily listing sync in background
    if args.listing_sync_interval > 0 {
        let listing_pool = pool.clone();
        let listing_interval = args.listing_sync_interval;
        tokio::spawn(async move {
            listing_sync::run_daily(listing_pool, listing_interval).await;
        });
        info!(interval_secs = args.listing_sync_interval, "Listing sync started");
    } else {
        info!("Listing sync disabled (interval = 0)");
    }

    // Create live ticker cache and start fast poller
    let live_cache = Arc::new(LiveTickerCache::new());
    {
        let fast_cache = Arc::clone(&live_cache);
        let fast_interval = Duration::from_secs(args.fast_poll_secs);
        let assets_file_for_fast = args.assets_file.clone();
        tokio::spawn(async move {
            let tracked = match load_tracked_symbols(&assets_file_for_fast) {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!(%e, "Fast poller: failed to load assets file");
                    return;
                }
            };
            live_cache::run_fast_poller(fast_cache, tracked, fast_interval).await;
        });
        info!(fast_poll_secs = args.fast_poll_secs, "Fast poller started");
    }

    // Create L3 + ARB providers
    let l3_provider = Arc::new(Provider::<Http>::try_from(&args.rpc_url)
        .expect("Failed to create L3 provider"));
    let arb_provider = Arc::new(Provider::<Http>::try_from(&args.arb_rpc_url)
        .expect("Failed to create ARB provider"));
    info!(l3_rpc = %args.rpc_url, arb_rpc = %args.arb_rpc_url, "RPC providers created");

    // Load deployment JSONs
    let deployment: serde_json::Value = {
        let content = std::fs::read_to_string(&args.deployment_file)
            .unwrap_or_else(|_| {
                info!(path = %args.deployment_file, "Deployment file not found, using empty object");
                "{}".to_string()
            });
        serde_json::from_str(&content).unwrap_or_default()
    };
    let morpho_deployment: serde_json::Value = {
        let content = std::fs::read_to_string(&args.morpho_deployment_file)
            .unwrap_or_else(|_| {
                info!(path = %args.morpho_deployment_file, "Morpho deployment file not found, using empty object");
                "{}".to_string()
            });
        serde_json::from_str(&content).unwrap_or_default()
    };
    info!("Deployment files loaded");

    // HTTP server
    let app_state = Arc::new(AppState {
        pool,
        collector: collector_state,
        symbol_map,
        cache: api::PriceCache::new(5), // 5-second TTL
        live_cache,
        l3_provider,
        arb_provider,
        deployment,
        morpho_deployment,
        logos_dir,
    });

    let app = api::router(app_state);
    let addr = SocketAddr::from(([0, 0, 0, 0], args.port));
    info!(%addr, "HTTP server listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("data-node shut down");
    Ok(())
}

async fn run_sync_logos(args: config::SyncLogosArgs) -> Result<(), Box<dyn std::error::Error>> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&args.log_level));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    info!("Fetching all coins from CoinGecko for logo sync...");

    let limiter = coingecko::RateLimiter::coingecko_pro();
    let client = coingecko::CoinGeckoClient::with_limiter(&args.coingecko_api_key, limiter)?;
    let coins = client.fetch_all_markets().await.map_err(|e| format!("{e}"))?;

    let coin_images: Vec<(String, Option<String>)> = coins
        .into_iter()
        .map(|c| (c.id, c.image))
        .collect();

    info!(total = coin_images.len(), "Starting logo sync");
    let logos_dir = std::path::PathBuf::from(&args.logos_dir);
    let downloaded = logo_downloader::sync_logos(&logos_dir, &coin_images).await;
    info!(downloaded, "Logo sync finished");

    Ok(())
}

fn load_tracked_symbols(assets_file: &str) -> Result<HashSet<String>, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(assets_file)?;
    let assets: Vec<serde_json::Value> = serde_json::from_str(&content)?;
    let symbols: HashSet<String> = assets
        .iter()
        .filter_map(|a| a.get("bitget").and_then(|v| v.as_str()).map(String::from))
        .collect();
    Ok(symbols)
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C handler");
    info!("Shutdown signal received");
}
