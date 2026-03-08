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
mod issuer_health_collector;
mod itp_collector;
mod kline_collector;
mod liquidity_collector;
mod listing_sync;
mod orderbook_aggregator;
pub mod live_cache;
mod logo_downloader;
mod simulation;
mod trade_collector;
mod work_queue;
mod market_data;
mod vision_api;
mod vision_batch_cache;
mod vision_ws;

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
    // Load .env file BEFORE clap parses args (clap reads env vars during parse).
    // Try CWD/.env first, then data-node/.env (when running from project root).
    if dotenvy::dotenv().is_err() {
        dotenvy::from_filename("data-node/.env").ok();
    }

    let cli = Cli::parse();

    match cli.command {
        Command::Serve(args) => run_serve(args).await,
        Command::Backfill(args) => backfill::run(args).await,
        Command::CgBackfill(args) => cg_backfill::run(args).await,
        Command::SyncLogos(args) => run_sync_logos(args).await,
        Command::SyncListings(args) => listing_sync::run(args).await,
        Command::DlBackfill(args) => dl_backfill::run(args).await,
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

    // Backfill market_prices_latest from market_prices if cache table is empty
    // (one-time seed after migration 025 creates the table)
    let latest_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM market_prices_latest")
        .fetch_one(&pool)
        .await
        .unwrap_or((0,));
    if latest_count.0 == 0 {
        info!("market_prices_latest is empty — backfilling from market_prices...");
        let backfilled = sqlx::query(r#"
            INSERT INTO market_prices_latest (source, asset_id, symbol, name, value, change_pct, volume_24h, market_cap, category, fetched_at)
            SELECT DISTINCT ON (source, asset_id)
                source, asset_id, symbol, '', value, change_pct, volume_24h, market_cap, NULL, fetched_at
            FROM market_prices
            ORDER BY source, asset_id, fetched_at DESC
            ON CONFLICT (source, asset_id) DO NOTHING
        "#)
            .execute(&pool)
            .await;
        match backfilled {
            Ok(r) => info!("Backfilled {} rows into market_prices_latest", r.rows_affected()),
            Err(e) => tracing::warn!("market_prices_latest backfill failed (may be empty DB): {e}"),
        }
    }

    // Handle --reset-session: truncate session tables and reset cursors BEFORE collectors start
    if args.reset_session {
        info!("--reset-session: truncating session tables and resetting cursors");
        sqlx::query("TRUNCATE itp_snapshots, trades CASCADE")
            .execute(&pool)
            .await
            .expect("truncate failed");
        db::reset_collector_cursors(&pool)
            .await
            .expect("cursor reset failed");
    }

    // Load global simulation data cache FIRST (before collectors steal pool connections).
    // This loads all Bitget-eligible coin prices into memory for instant simulations.
    let sim_cache_inner = simulation::SimDataCache::load(&pool).await
        .unwrap_or_else(|e| {
            tracing::warn!(error = %e, "Failed to load sim data cache, simulations will fail");
            std::sync::Arc::new(simulation::SimDataCache {
                all_dates: vec![],
                category_coins: std::collections::HashMap::new(),
                coin_symbol_map: std::collections::HashMap::new(),
                bitget_lookup: std::collections::HashMap::new(),
                prices: std::collections::HashMap::new(),
                mcap_rankings: std::collections::HashMap::new(),
                categories: vec![],
                defi_metrics: std::collections::HashMap::new(),
                defi_history: std::collections::HashMap::new(),
                fng_index: std::collections::HashMap::new(),
                btc_dominance: std::collections::HashMap::new(),
                eth_dominance: std::collections::HashMap::new(),
            })
        });
    let sim_cache = Arc::new(tokio::sync::RwLock::new(sim_cache_inner));

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

    // Shared CoinGecko rate limiter — used by BOTH the market source (crypto prices)
    // and cg_collector (snapshots, backfill, categories) to avoid 429 collisions.
    let cg_limiter = {
        let is_pro = args.coingecko_api_key.as_deref()
            .map(|k| !k.trim().is_empty() && !k.starts_with("CG-"))
            .unwrap_or(false);
        if is_pro {
            coingecko::RateLimiter::coingecko_pro()
        } else {
            coingecko::RateLimiter::coingecko_demo()
        }
    };

    // Start CoinGecko market-cap collector (always — free tier fallback if no key)
    let logos_dir = std::path::PathBuf::from(&args.logos_dir);
    {
        let cg_pool = pool.clone();
        let cg_state = Arc::new(cg_collector::CgCollectorState::new());
        let cg_key = args.coingecko_api_key.clone().unwrap_or_default();
        let cg_poll = args.cg_poll_interval;
        let cg_logos_dir = logos_dir.clone();
        let cg_lim = cg_limiter.clone();
        let tier_label = if cg_key.starts_with("CG-") { "demo" } else if cg_key.is_empty() { "free" } else { "pro" };
        tokio::spawn(async move {
            cg_collector::run(cg_pool, cg_state, cg_key, cg_poll, cg_logos_dir, cg_lim).await;
        });
        info!("CoinGecko market-cap collector started (tier: {tier_label})");
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

    // Start DefiLlama collector in background
    if args.dl_poll_interval > 0 {
        let dl_pool = pool.clone();
        let dl_poll = args.dl_poll_interval;
        let dl_sim_cache = sim_cache.clone();
        let dl_reload_pool = pool.clone();
        tokio::spawn(async move {
            // Run first sync, then reload sim cache to pick up DL categories
            dl_collector::run_once(&dl_pool).await;
            info!("DefiLlama first sync done, reloading sim cache...");
            match simulation::SimDataCache::load(&dl_reload_pool).await {
                Ok(new_cache) => {
                    let dl_cats = new_cache.categories.iter().filter(|c| c.source == "defillama").count();
                    let mut cache = dl_sim_cache.write().await;
                    *cache = new_cache;
                    info!(dl_categories = dl_cats, "Sim cache reloaded with DefiLlama data");
                }
                Err(e) => {
                    tracing::error!(%e, "Failed to reload sim cache after DL sync");
                }
            }
            // Then continue with the regular collector loop
            dl_collector::run(dl_pool, dl_poll).await;
        });
        info!(interval_secs = args.dl_poll_interval, "DefiLlama collector started");
    } else {
        info!("DefiLlama collector disabled (interval = 0)");
    }

    // Start FNG collector in background
    if args.fng_poll_interval > 0 {
        let fng_pool = pool.clone();
        let fng_poll = args.fng_poll_interval;
        tokio::spawn(async move {
            fng_collector::run(fng_pool, fng_poll).await;
        });
        info!(interval_secs = args.fng_poll_interval, "FNG collector started");
    } else {
        info!("FNG collector disabled (interval = 0)");
    }

    // ── Auto-reload sim cache daily ──────────────────────────────────────
    // The sim cache is loaded once at startup and can go stale as new CoinGecko
    // snapshots arrive. This background task reloads it every 24h so the
    // backtester chart always has up-to-date prices.
    {
        let reload_pool = pool.clone();
        let reload_sim_cache = sim_cache.clone();
        tokio::spawn(async move {
            // Wait 24h before the first auto-reload (startup already loaded it).
            let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
            interval.tick().await; // first tick fires immediately — skip it
            loop {
                interval.tick().await;
                tracing::info!("Auto-reloading sim data cache...");
                match simulation::SimDataCache::load(&reload_pool).await {
                    Ok(new_cache) => {
                        let date_count = new_cache.all_dates.len();
                        let cat_count = new_cache.categories.len();
                        let latest = new_cache.all_dates.last().copied();
                        let mut cache = reload_sim_cache.write().await;
                        *cache = new_cache;
                        tracing::info!(
                            dates = date_count,
                            categories = cat_count,
                            latest_date = ?latest,
                            "Sim data cache auto-reloaded"
                        );
                    }
                    Err(e) => {
                        tracing::error!(%e, "Failed to auto-reload sim cache, will retry in 24h");
                    }
                }
            }
        });
        info!("Sim cache auto-reload scheduled (every 24h)");
    }

    // ── Market data providers (from AA) ──────────────────────────────────
    // Initialize global error tracker and sync registry before starting any sources
    market_data::error_tracker::init_global();
    market_data::sync_registry::init_global();

    // Price broadcast hub — shared by all sync engines and AppState for WebSocket streaming
    let broadcast_hub = Arc::new(crate::market_data::broadcast::PriceBroadcastHub::new());

    // Each provider is gated on its config key. We use SyncEngine (fixed interval)
    // for simple sources and ScheduledSyncEngine for schedule-aware sources.

    // 1. Finnhub (stocks) — gated on API key
    if let Some(ref key) = args.finnhub_api_key {
        std::env::set_var("FINNHUB_API_KEY", key);
        std::env::set_var("FINNHUB_SYNC_INTERVAL_SECS", args.finnhub_sync_interval.to_string());
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::finnhub::FinnhubClient::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Finnhub init failed: {e}"),
            }
        });
        info!("Finnhub stock provider started");
    }

    // 2. FRED (rates) — gated on API key, schedule-aware
    if let Some(ref key) = args.fred_api_key {
        std::env::set_var("FRED_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::fred::FredMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("FRED init failed: {e}"),
            }
        });
        info!("FRED interest rates provider started");
    }

    // 3. BLS (employment/inflation) — gated on API key, schedule-aware
    if let Some(ref key) = args.bls_api_key {
        std::env::set_var("BLS_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::bls::BlsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("BLS init failed: {e}"),
            }
        });
        info!("BLS employment/inflation provider started");
    }

    // 4. Treasury (bonds) — gated on treasury_api_key, schedule-aware
    if let Some(key) = args.treasury_api_key.as_ref().filter(|k| !k.trim().is_empty()) {
        std::env::set_var("NASDAQ_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::treasury::TreasuryMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Treasury init failed: {e}"),
            }
        });
        info!("Treasury yield provider started");
    }

    // 5. ECB (euro rates) — gated on ecb_enabled flag, schedule-aware
    if args.ecb_enabled {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::ecb::EcbMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("ECB init failed: {e}"),
            }
        });
        info!("ECB euro rates provider started");
    }

    // 6. EIA (energy) — gated on API key, schedule-aware
    if let Some(ref key) = args.eia_api_key {
        std::env::set_var("EIA_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::eia::EiaMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("EIA init failed: {e}"),
            }
        });
        info!("EIA energy data provider started");
    }

    // 7. Nasdaq sources (CFTC, CHRIS, OPEC, IMF) — gated on nasdaq_api_key
    let nasdaq_key_valid = args.nasdaq_api_key.as_ref().filter(|k| !k.trim().is_empty());
    if let Some(key) = nasdaq_key_valid {
        std::env::set_var("NASDAQ_API_KEY", key);

        // CFTC
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::CftcMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("CFTC init failed: {e}"),
            }
        });

        // CHRIS (continuous futures)
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::ChrisMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("CHRIS init failed: {e}"),
            }
        });

        // OPEC
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::OpecMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("OPEC init failed: {e}"),
            }
        });

        // IMF
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::ImfMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("IMF init failed: {e}"),
            }
        });

        info!("Nasdaq Data Link providers started (CFTC, CHRIS, OPEC, IMF)");
    }

    // 7b. BCHAIN (bitcoin on-chain) — uses blockchain.info, NO API key needed.
    // Previously gated behind nasdaq_api_key by mistake.
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::BchainMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("BCHAIN init failed: {e}"),
            }
        });
        info!("BCHAIN blockchain metrics provider started (blockchain.info, no key needed)");
    }

    // 8. OpenMeteo (weather) — gated on sync interval > 0
    if args.openmeteo_sync_interval > 0 {
        std::env::set_var("OPENMETEO_SYNC_INTERVAL_SECS", args.openmeteo_sync_interval.to_string());
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::openmeteo::OpenMeteoMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("OpenMeteo init failed: {e}"),
            }
        });
        info!(interval_secs = args.openmeteo_sync_interval, "OpenMeteo weather provider started");
    }

    // 9. Free/no-key providers — always enabled
    // SEC EDGAR 13F Filings (no auth, User-Agent only)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::sec_edgar::SecEdgarMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("SEC EDGAR init failed: {e}"),
            }
        });
    }

    // SEC EFTS Filing Counts (no auth required)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::sec_efts::SecEftsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("SEC EFTS init failed: {e}"),
            }
        });
    }

    // SEC Form 4 Insider Trading (no auth required)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::sec_insider::SecInsiderMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("SEC Insider init failed: {e}"),
            }
        });
    }

    // FINRA Daily Short Volume — OAuth (client_id + client_secret)
    if let Some(ref id) = args.finra_client_id {
        if let Some(ref secret) = args.finra_client_secret {
            std::env::set_var("FINRA_CLIENT_ID", id);
            std::env::set_var("FINRA_CLIENT_SECRET", secret);
            let pool_c = pool.clone();
            let bh = broadcast_hub.clone();
            tokio::spawn(async move {
                match market_data::sources::finra::FinraMarketSource::from_env() {
                    Ok(source) => {
                        let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                        engine.run().await;
                    }
                    Err(e) => tracing::error!("FINRA init failed: {e}"),
                }
            });
            info!("FINRA short volume provider started");
        } else {
            info!("FINRA skipped (FINRA_CLIENT_SECRET not configured)");
        }
    } else {
        info!("FINRA skipped (FINRA_CLIENT_ID not configured)");
    }

    // FINRA Daily Short Volume (public endpoint, no API key needed)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::finra_short_vol::FinraShortVolMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("FINRA Short Volume init failed: {e}"),
            }
        });
    }

    // Congress (requires CONGRESS_API_KEY — skip silently if not set)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::congress::CongressMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::warn!("Congress provider skipped: {e}"),
            }
        });
    }

    info!("Free market data providers started (SEC EFTS, SEC Insider, Congress)");

    // ── New market data providers (from AA market-data-lib) ─────────────
    // 10. No-key sources — always enabled

    // npm package downloads
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::npm::NpmMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("npm init failed: {e}"),
            }
        });
    }

    // PyPI package downloads
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::pypi::PypiMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("PyPI init failed: {e}"),
            }
        });
    }

    // crates.io Rust package downloads
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::crates_io::CratesIoMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("crates.io init failed: {e}"),
            }
        });
    }

    // Steam concurrent player counts
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::steam::SteamMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Steam init failed: {e}"),
            }
        });
    }

    // Hacker News story scores
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::hackernews::HackerNewsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("HackerNews init failed: {e}"),
            }
        });
    }

    // 4chan board activity
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::fourchan::FourchanMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("4chan init failed: {e}"),
            }
        });
    }

    // AniList anime/manga popularity
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::anilist::AniListMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("AniList init failed: {e}"),
            }
        });
    }

    // TWSE (Taiwan Stock Exchange)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::twse::TwseMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("TWSE init failed: {e}"),
            }
        });
    }

    // Polymarket prediction markets
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::polymarket::PolymarketMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Polymarket init failed: {e}"),
            }
        });
    }

    // DefiLlama (chain TVL, protocol TVL, DEX volumes)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::defillama::DefiLlamaMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("DefiLlama market source init failed: {e}"),
            }
        });
    }

    // Zillow — free public CSV data, no API key needed
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::zillow::ZillowMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Zillow init failed: {e}"),
            }
        });
    }

    info!("No-key market data providers started (npm, PyPI, crates.io, Steam, HackerNews, 4chan, AniList, TWSE, Polymarket, DefiLlama)");

    // 11. API-key-gated new sources

    // Twitch — gated on client ID + secret
    if let Some(ref client_id) = args.twitch_client_id {
        if let Some(ref client_secret) = args.twitch_client_secret {
            std::env::set_var("TWITCH_CLIENT_ID", client_id);
            std::env::set_var("TWITCH_CLIENT_SECRET", client_secret);
            let pool_c = pool.clone();
            let bh = broadcast_hub.clone();
            tokio::spawn(async move {
                match market_data::sources::twitch::TwitchMarketSource::from_env() {
                    Ok(source) => {
                        let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                        engine.run().await;
                    }
                    Err(e) => tracing::error!("Twitch init failed: {e}"),
                }
            });
            info!("Twitch live streaming provider started");
        } else {
            info!("Twitch skipped (TWITCH_CLIENT_SECRET not configured)");
        }
    }

    // TMDb — gated on API key
    if let Some(ref key) = args.tmdb_api_key {
        std::env::set_var("TMDB_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::tmdb::TmdbMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("TMDb init failed: {e}"),
            }
        });
        info!("TMDb movie/TV/celebrity provider started");
    }

    // Last.fm — gated on API key
    if let Some(ref key) = args.lastfm_api_key {
        std::env::set_var("LASTFM_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::lastfm::LastfmMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Last.fm init failed: {e}"),
            }
        });
        info!("Last.fm music artist provider started");
    }

    // backpack.tf — gated on API key
    if let Some(ref key) = args.backpacktf_api_key {
        std::env::set_var("BACKPACKTF_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::backpacktf::BackpackTfMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("backpack.tf init failed: {e}"),
            }
        });
        info!("backpack.tf TF2 item provider started");
    }

    // GitHub — works with or without token (unauthenticated = lower rate limits)
    {
        if let Some(ref token) = args.github_token {
            std::env::set_var("GITHUB_TOKEN", token);
        }
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::github::GithubMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("GitHub init failed: {e}"),
            }
        });
        info!("GitHub repository star provider started");
    }

    // Cloudflare Radar — gated on token
    if let Some(ref token) = args.cloudflare_radar_token {
        std::env::set_var("CLOUDFLARE_RADAR_TOKEN", token);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::cloudflare::CloudflareRadarMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Cloudflare Radar init failed: {e}"),
            }
        });
        info!("Cloudflare Radar internet metrics provider started");
    }

    // CoinGecko market source (crypto prices via SyncEngine)
    // Works with Pro key, Demo key (CG- prefix), or no key (free tier fallback)
    {
        if let Some(ref cg_api_key) = args.coingecko_api_key {
            if !cg_api_key.trim().is_empty() {
                std::env::set_var("COINGECKO_API_KEY", cg_api_key);
            }
        }
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        let cg_lim = cg_limiter.clone();
        let tier_label = match args.coingecko_api_key.as_deref().map(|k| k.trim()) {
            Some(k) if !k.is_empty() && k.starts_with("CG-") => "demo",
            Some(k) if !k.is_empty() => "pro",
            _ => "free (no API key)",
        };
        tokio::spawn(async move {
            match market_data::sources::coingecko::CoinGeckoMarketSource::from_env(cg_lim) {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("CoinGecko market source init failed: {e}"),
            }
        });
        info!("CoinGecko market source (crypto prices) started — tier: {}", tier_label);
    }

    // ── Bet on Everything sources (10) ────────────────────────────────────

    // Volcano — USGS (no key)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::volcano::VolcanoMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Volcano init failed: {e}"),
            }
        });
    }

    // Earthquake — USGS (no key)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::earthquake::EarthquakeMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Earthquake init failed: {e}"),
            }
        });
    }

    // Space Weather — NOAA (no key)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::spaceweather::SpaceweatherMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Space Weather init failed: {e}"),
            }
        });
    }

    // Wildfire — NASA FIRMS (gated on API key)
    if let Some(ref key) = args.nasa_firms_key {
        std::env::set_var("NASA_FIRMS_MAP_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::wildfire::WildfireMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Wildfire init failed: {e}"),
            }
        });
        info!("NASA FIRMS wildfire provider started");
    }

    // Flights — adsb.lol (no key, single-call strategy)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::flights::FlightsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Flights init failed: {e}"),
            }
        });
    }

    // Military Aircraft — adsb.lol (no key, community ADS-B API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::mil_aircraft::MilAircraftMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("MilAircraft init failed: {e}"),
            }
        });
    }

    // Maritime — Digitraffic AIS (free, no API key required)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::maritime::MaritimeMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Maritime init failed: {e}"),
            }
        });
        info!("AIS maritime vessel provider started (Digitraffic)");
    }

    // AISstream WebSocket ship tracking (gated on API key)
    if let Some(ref key) = args.aisstream_api_key {
        std::env::set_var("AISSTREAM_API_KEY", key);

        let aisstream_key = key.clone();
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            let source = market_data::sources::aisstream::AisStreamMarketSource::new(aisstream_key);
            let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
            engine.run().await;
        });
        info!("AISstream ship tracking provider started");
    }

    // Epidemic — disease.sh (no key)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::epidemic::EpidemicMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Epidemic init failed: {e}"),
            }
        });
    }

    // Sports — ESPN (no key)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::sports::SportsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Sports init failed: {e}"),
            }
        });
    }

    // ISS Position — Open Notify (no key)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::iss::IssMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("ISS init failed: {e}"),
            }
        });
    }

    // Weather Alerts — NWS (no key, User-Agent only)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::weather_alerts::WeatherAlertsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Weather Alerts init failed: {e}"),
            }
        });
    }

    // Animals — GBIF + iNaturalist (no key)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::animals::AnimalsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Animals init failed: {e}"),
            }
        });
    }

    // Movebank GPS Animal Tracking — gated on username + password
    if let Some(ref mb_user) = args.movebank_user {
        if let Some(ref mb_pass) = args.movebank_password {
            let mb_user_c = mb_user.clone();
            let mb_pass_c = mb_pass.clone();
            let pool_c = pool.clone();
            let bh = broadcast_hub.clone();
            tokio::spawn(async move {
                match market_data::sources::movebank::MovebankMarketSource::new(mb_user_c, mb_pass_c) {
                    Ok(source) => {
                        let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                        engine.run().await;
                    }
                    Err(e) => tracing::error!("Movebank init failed: {e}"),
                }
            });
            info!("Movebank GPS animal tracking provider started");
        } else {
            info!("Movebank skipped (MOVEBANK_PASSWORD not configured)");
        }
    }

    // eBird — gated on API key
    if let Some(ref key) = args.ebird_api_key {
        std::env::set_var("EBIRD_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::ebird::EbirdMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("eBird init failed: {e}"),
            }
        });
        info!("eBird bird observation provider started");
    }

    info!("Bet on Everything sources started (volcano, earthquake, spaceweather, flights, epidemic, sports, iss, weather_alerts, animals + key-gated: wildfire, maritime, movebank, ebird)");

    // GTFS-RT Transit (NYC MTA Subway, BART — no API key needed)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            let source = market_data::sources::gtfs_rt::GtfsRtMarketSource::new();
            let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
            engine.run().await;
        });
        info!("GTFS-RT transit provider started");
    }

    // USASpending.gov — US federal defense spending (no key needed)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::usa_spending::UsaSpendingMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("USASpending init failed: {e}"),
            }
        });
        info!("USASpending.gov defense spending provider started");
    }

    // Pump.fun — Dexscreener-only (no API key required)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::pumpfun::PumpfunMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("PumpFun init failed: {e}"),
            }
        });
        info!("Pump.fun token tracker started (Dexscreener)");
    }

    // Reddit — always-on (public JSON API fallback when no OAuth credentials)
    {
        if let Some(ref client_id) = args.reddit_client_id {
            std::env::set_var("REDDIT_CLIENT_ID", client_id);
        }
        if let Some(ref client_secret) = args.reddit_client_secret {
            std::env::set_var("REDDIT_CLIENT_SECRET", client_secret);
        }
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::reddit::RedditMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Reddit init failed: {e}"),
            }
        });
        info!("Reddit community tracker started");
    }

    // Shelter — always-on, no auth needed (Austin Animal Center Socrata SODA)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::shelter::ShelterMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Shelter init failed: {e}"),
            }
        });
        info!("Animal shelter tracker started");
    }

    // Chaturbate — requires CHATURBATE_WM affiliate ID
    if std::env::var("CHATURBATE_WM").is_ok() {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::chaturbate::ChaturbateMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Chaturbate init failed: {e}"),
            }
        });
        info!("Chaturbate live cam tracker started");
    }

    // PandaScore Esports — always-on (token hardcoded in source, overridable via env)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::pandascore::PandascoreMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("PandaScore esports init failed: {e}"),
            }
        });
        info!("PandaScore esports tracker started");
    }

    // USGS Water — no key needed
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::usgs_water::UsgsWaterMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("USGS Water init failed: {e}"),
            }
        });
        info!("USGS Water monitoring started");
    }

    // NOAA Tides — no key needed
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::noaa_tides::NoaaTidesMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("NOAA Tides init failed: {e}"),
            }
        });
        info!("NOAA Tides & Currents monitoring started");
    }

    // NRC Nuclear Reactors — no key needed (daily data, hourly sync)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::nrc_nuclear::NrcNuclearMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("NRC Nuclear init failed: {e}"),
            }
        });
        info!("NRC Nuclear reactor status started");
    }

    // CityBikes — no key needed
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::citybikes::CityBikesMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("CityBikes init failed: {e}"),
            }
        });
        info!("CityBikes bike sharing started");
    }

    // NDBC Ocean Buoys — no key needed
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::ndbc::NdbcMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("NDBC Buoys init failed: {e}"),
            }
        });
        info!("NDBC Ocean Buoys started");
    }

    // NOAA Ocean Meteorology — no key needed
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::noaa_met::NoaaMetMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("NOAA Met init failed: {e}"),
            }
        });
        info!("NOAA Ocean Meteorology started");
    }

    // NWPS River Gauges — no key needed
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::nwps::NwpsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("NWPS River Gauges init failed: {e}"),
            }
        });
        info!("NWPS River Gauges started");
    }

    // AirNow AQI — gated on AIRNOW_API_KEY env var
    if std::env::var("AIRNOW_API_KEY").is_ok() {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::airnow::AirnowMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("AirNow AQI init failed: {e}"),
            }
        });
        info!("AirNow Air Quality started");
    }

    // CourtListener — always-on (public API, works without auth at lower rate limits)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::courtlistener::CourtListenerMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("CourtListener init failed: {e}"),
            }
        });
        info!("CourtListener federal courts started");
    }

    // OpenAlex Scholarly Works — no key needed (email optional via OPENALEX_EMAIL env)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::openalex::OpenAlexMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("OpenAlex init failed: {e}"),
            }
        });
        info!("OpenAlex scholarly works started");
    }

    // Crossref DOI Registry — no key needed (email optional via CROSSREF_EMAIL env)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::crossref::CrossrefMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Crossref init failed: {e}"),
            }
        });
        info!("Crossref DOI registry started");
    }

    // PubMed Biomedical Research — no key needed (API key optional via NCBI_API_KEY env)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::pubmed::PubMedMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("PubMed init failed: {e}"),
            }
        });
        info!("PubMed biomedical research started");
    }

    // Stack Exchange — gated on STACKEXCHANGE_KEY env var
    if std::env::var("STACKEXCHANGE_KEY").is_ok() {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::stackexchange::StackExchangeMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Stack Exchange init failed: {e}"),
            }
        });
        info!("Stack Exchange developer Q&A started");
    }

    // Queue-Times — theme park wait times (no key)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::queue_times::QueueTimesMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Queue-Times init failed: {e}"),
            }
        });
        info!("Queue-Times theme park wait times started");
    }

    // ParkAPI Parking Garages — no key needed
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::parking::ParkingMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("ParkAPI Parking init failed: {e}"),
            }
        });
        info!("ParkAPI parking garages started");
    }

    // TomTom Traffic Flow — gated on TOMTOM_API_KEY env var
    if std::env::var("TOMTOM_API_KEY").is_ok() {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::tomtom_traffic::TomtomTrafficMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("TomTom Traffic init failed: {e}"),
            }
        });
        info!("TomTom Traffic flow started");
    }

    // TomTom EV Charging — gated on TOMTOM_API_KEY env var
    if std::env::var("TOMTOM_API_KEY").is_ok() {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::tomtom_evcharge::TomtomEvchargeMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("TomTom EV Charging init failed: {e}"),
            }
        });
        info!("TomTom EV charging started");
    }

    // BoardGameGeek — always-on, no auth needed (BGG XML API2 /hot is public)
    {
        if let Some(ref token) = args.bgg_api_token {
            std::env::set_var("BGG_API_TOKEN", token);
        }
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::bgg::BggMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("BGG init failed: {e}"),
            }
        });
        info!("BoardGameGeek hotness tracker started");
    }

    // Best Buy Products — gated on BESTBUY_API_KEY
    if let Some(ref key) = args.bestbuy_api_key {
        std::env::set_var("BESTBUY_API_KEY", key);
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::bestbuy::BestBuyMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Best Buy init failed: {e}"),
            }
        });
        info!("Best Buy product price tracker started");
    }

    // Adzuna Job Market — gated on app ID + app key
    if let Some(ref app_id) = args.adzuna_app_id {
        if let Some(ref app_key) = args.adzuna_app_key {
            std::env::set_var("ADZUNA_APP_ID", app_id);
            std::env::set_var("ADZUNA_APP_KEY", app_key);
            let pool_c = pool.clone();
            let bh = broadcast_hub.clone();
            tokio::spawn(async move {
                match market_data::sources::adzuna::AdzunaMarketSource::from_env() {
                    Ok(source) => {
                        let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                        engine.run().await;
                    }
                    Err(e) => tracing::error!("Adzuna init failed: {e}"),
                }
            });
            info!("Adzuna job market tracker started");
        } else {
            info!("Adzuna skipped (ADZUNA_APP_KEY not configured)");
        }
    }

    // CBP Border Wait Times — no key needed (US government API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::cbp_border::CbpBorderMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("CBP Border Wait Times init failed: {e}"),
            }
        });
        info!("CBP Border Wait Times started");
    }

    // FAA Airport Delays — no key needed (US government API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::faa_delays::FaaDelaysMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("FAA Airport Delays init failed: {e}"),
            }
        });
        info!("FAA Airport Delays monitoring started");
    }

    // Yahoo Finance Drink Markets — no key needed (unofficial API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::yahoo_drinks::YahooDrinksMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Yahoo Drink Markets init failed: {e}"),
            }
        });
        info!("Yahoo Drink Markets started");
    }

    // Deutsche Bahn Train Delays — no key needed (free public API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::db_trains::DbTrainsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Deutsche Bahn Train Delays init failed: {e}"),
            }
        });
        info!("Deutsche Bahn Train Delays started");
    }

    // NYC 311 Complaints — no key needed (free Socrata Open Data API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::nyc311::Nyc311MarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("NYC 311 Complaints init failed: {e}"),
            }
        });
        info!("NYC 311 Complaints started");
    }

    // McBroken Ice Cream — no key needed (public API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::mcbroken::McBrokenMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("McBroken Ice Cream init failed: {e}"),
            }
        });
        info!("McBroken Ice Cream started");
    }

    // TfL London Tube Status — no key needed (free public API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::tfl_tube::TflTubeMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("TfL Tube Status init failed: {e}"),
            }
        });
        info!("TfL Tube Status started");
    }

    // Paris Metro Status — no key needed (free PRIM API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::paris_metro::ParisMetroMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Paris Metro Status init failed: {e}"),
            }
        });
        info!("Paris Metro Status started");
    }

    // NYC MTA Subway Alerts — no key needed (free GTFS-RT feed)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::mta_subway::MtaSubwayMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("MTA Subway Alerts init failed: {e}"),
            }
        });
        info!("MTA Subway Alerts started");
    }

    // Ryanair Flight Delays — no key needed (free OpenSky + Ryanair schedule APIs)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::ryanair::RyanairMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("Ryanair Flight Delays init failed: {e}"),
            }
        });
        info!("Ryanair Flight Delays started");
    }

    // IODA Internet Outage Detection — no key needed (free CAIDA API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::ioda::IodaMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("IODA Internet Outages init failed: {e}"),
            }
        });
        info!("IODA Internet Outages started");
    }

    // US Power Outages — no key needed (free PowerOutage.us/ODIN API)
    {
        let pool_c = pool.clone();
        let bh = broadcast_hub.clone();
        tokio::spawn(async move {
            match market_data::sources::power_outages::PowerOutagesMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source), bh);
                    engine.run().await;
                }
                Err(e) => tracing::error!("US Power Outages init failed: {e}"),
            }
        });
        info!("US Power Outages started");
    }

    // Record not_started for any source that was gated off (missing keys, disabled flags)
    {
        let tracker = market_data::error_tracker::global();
        // Finnhub
        if args.finnhub_api_key.is_none() {
            tracker.record_not_started("stocks", "Missing --finnhub-api-key");
        }
        // FRED
        if args.fred_api_key.is_none() {
            tracker.record_not_started("rates", "Missing --fred-api-key");
        }
        // BLS
        if args.bls_api_key.is_none() {
            tracker.record_not_started("bls", "Missing --bls-api-key");
        }
        // Treasury
        if args.treasury_api_key.as_ref().filter(|k| !k.trim().is_empty()).is_none() {
            tracker.record_not_started("bonds", "Missing --treasury-api-key");
        }
        // ECB
        if !args.ecb_enabled {
            tracker.record_not_started("ecb", "ECB disabled (--ecb-enabled not set)");
        }
        // EIA
        if args.eia_api_key.is_none() {
            tracker.record_not_started("eia", "Missing --eia-api-key");
        }
        // Nasdaq family (CFTC, CHRIS, OPEC, IMF) — BCHAIN moved out, uses blockchain.info (no key)
        if args.nasdaq_api_key.as_ref().filter(|k| !k.trim().is_empty()).is_none() {
            for src in &["cftc", "futures", "opec", "imf"] {
                tracker.record_not_started(src, "Missing --nasdaq-api-key (get a free key at https://data.nasdaq.com/sign-up)");
            }
        }
        // OpenMeteo
        if args.openmeteo_sync_interval == 0 {
            tracker.record_not_started("weather", "OpenMeteo disabled (sync interval = 0)");
        }
        // Twitch
        if args.twitch_client_id.is_none() || args.twitch_client_secret.is_none() {
            tracker.record_not_started("twitch", "Missing --twitch-client-id / --twitch-client-secret");
        }
        // TMDb
        if args.tmdb_api_key.is_none() {
            tracker.record_not_started("tmdb", "Missing --tmdb-api-key");
        }
        // Last.fm
        if args.lastfm_api_key.is_none() {
            tracker.record_not_started("lastfm", "Missing --lastfm-api-key");
        }
        // backpack.tf
        if args.backpacktf_api_key.is_none() {
            tracker.record_not_started("backpacktf", "Missing --backpacktf-api-key");
        }
        // GitHub — always starts (works unauthenticated with lower rate limits)
        // Cloudflare Radar
        if args.cloudflare_radar_token.is_none() {
            tracker.record_not_started("cloudflare", "Missing --cloudflare-radar-token");
        }
        // CoinGecko (market_data source) — always starts, free tier fallback
        // (no longer gated on API key)
        // Wildfire (NASA FIRMS)
        if args.nasa_firms_key.is_none() {
            tracker.record_not_started("wildfire", "Missing --nasa-firms-key");
        }
        // Maritime — always-on (Digitraffic, no key needed)
        // AISstream (individual vessel tracking via WebSocket, needs paid API key)
        if args.aisstream_api_key.is_none() {
            tracker.record_not_started("aisstream", "Missing --aisstream-api-key");
        }
        // Movebank
        if args.movebank_user.is_none() || args.movebank_password.is_none() {
            tracker.record_not_started("movebank", "Missing --movebank-user / --movebank-password");
        }
        // eBird
        if args.ebird_api_key.is_none() {
            tracker.record_not_started("ebird", "Missing --ebird-api-key");
        }
        // FINRA
        if args.finra_client_id.is_none() || args.finra_client_secret.is_none() {
            tracker.record_not_started("finra", "Missing --finra-client-id / --finra-client-secret");
        }
        // Pump.fun — always-on (Dexscreener, no key needed)
        // Reddit — always-on (public fallback), no not_started needed
        // Chaturbate
        if std::env::var("CHATURBATE_WM").is_err() {
            tracker.record_not_started("chaturbate", "Missing CHATURBATE_WM env var");
        }
        // CourtListener — always-on (public API), no not_started needed
        // AirNow
        if std::env::var("AIRNOW_API_KEY").is_err() {
            tracker.record_not_started("airnow", "Missing AIRNOW_API_KEY env var");
        }
        // Stack Exchange
        if std::env::var("STACKEXCHANGE_KEY").is_err() {
            tracker.record_not_started("stackexchange", "Missing STACKEXCHANGE_KEY env var");
        }
        // TomTom (Traffic + EV Charging)
        if std::env::var("TOMTOM_API_KEY").is_err() {
            tracker.record_not_started("tomtom_traffic", "Missing TOMTOM_API_KEY env var");
            tracker.record_not_started("tomtom_evcharge", "Missing TOMTOM_API_KEY env var");
        }
        // BoardGameGeek — always-on (public API), no not_started needed
        // Best Buy
        if args.bestbuy_api_key.is_none() {
            tracker.record_not_started("bestbuy", "Missing --bestbuy-api-key");
        }
        // Adzuna
        if args.adzuna_app_id.is_none() || args.adzuna_app_key.is_none() {
            tracker.record_not_started("adzuna", "Missing --adzuna-app-id / --adzuna-app-key");
        }

    }

    // Issuer health collector
    if let Some(ref urls_str) = args.issuer_health_urls {
        let urls: Vec<String> = urls_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        if !urls.is_empty() {
            issuer_health_collector::validate_issuer_urls(&urls);
            let node_count = urls.len();
            let pool_clone = pool.clone();
            let interval = args.issuer_health_poll_interval;
            tokio::spawn(async move {
                issuer_health_collector::run_issuer_health_collector(pool_clone, urls, interval).await;
            });
            info!(node_count, poll_secs = args.issuer_health_poll_interval, "Issuer health collector spawned");
        }
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

    // Create L3 + Settlement providers
    let l3_provider = Arc::new(Provider::<Http>::try_from(&args.rpc_url)
        .map_err(|e| format!("Failed to create L3 provider from {}: {}", args.rpc_url, e))?);
    let settlement_provider = Arc::new(Provider::<Http>::try_from(&args.settlement_rpc_url)
        .map_err(|e| format!("Failed to create Settlement provider from {}: {}", args.settlement_rpc_url, e))?);
    info!(l3_rpc = %args.rpc_url, settlement_rpc = %args.settlement_rpc_url, "RPC providers created");

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

    // Chain cache for SSE pollers
    let chain_cache = Arc::new(chain_cache::ChainCache::new());

    // Background health stats cache (refreshes every 60s)
    let health_stats_cache = Arc::new(api::HealthStatsCache::new());
    api::spawn_health_stats_refresh(pool.clone(), Arc::clone(&health_stats_cache));

    // Start batch engine
    let batch_state = Arc::new(batch_engine::BatchEngineState::new());
    {
        let batch_pool = pool.clone();
        let batch_state_clone = Arc::clone(&batch_state);
        tokio::spawn(async move {
            batch_engine::run(batch_pool, batch_state_clone, batch_engine::BATCH_SOURCES).await;
        });
        info!("BatchEngine started");
    }

    // Bitget read-only client (env config → real client, fallback → mock)
    let bitget_client: Arc<dyn common::BitgetReadOnlyClient + Send + Sync> = {
        use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};
        match BitgetReadOnlyConfig::from_env() {
            Ok(config) => match BitgetReadOnlyClientImpl::new(config) {
                Ok(c) => {
                    info!("Bitget read-only client initialized (real)");
                    Arc::new(c)
                }
                Err(e) => {
                    tracing::warn!(?e, "Failed to create Bitget client, using mock");
                    Arc::new(common::MockBitgetReadOnlyClient::new())
                }
            },
            Err(e) => {
                tracing::warn!(?e, "No Bitget config found, using mock client");
                Arc::new(common::MockBitgetReadOnlyClient::new())
            }
        }
    };

    let orderbook_cache = Arc::new(orderbook_aggregator::OrderbookCache::new(2)); // 2s TTL for live ticking

    // Chain event broadcast channel for SSE consumers
    let (chain_event_tx, _) = tokio::sync::broadcast::channel::<crate::chain_event_scanner::ChainEventEnvelope>(
        crate::chain_event_scanner::CHAIN_EVENT_CHANNEL_SIZE,
    );

    // HTTP server
    let app_state = Arc::new(AppState {
        pool,
        collector: collector_state,
        symbol_map,
        cache: api::PriceCache::new(5), // 5-second TTL
        live_cache,
        l3_provider,
        settlement_provider,
        deployment,
        morpho_deployment,
        logos_dir,
        sim_cache,
        chain_cache,
        admin_token: args.admin_token.clone().filter(|t| !t.is_empty()),
        cors_origins: args.cors_origin.clone(),
        health_stats_cache,
        batch_engine: batch_state,
        bitget_client,
        orderbook_cache,
        price_broadcast: broadcast_hub.clone(),
        vision_batch_cache: Arc::new(crate::vision_batch_cache::VisionBatchCache::new(
            std::env::var("ISSUER_URL").unwrap_or_else(|_| "http://localhost:8100".to_string()),
            format!("http://{}:{}", args.bind, args.port),
        )),
        snapshot_hmac_secret: args.snapshot_hmac_secret.clone().filter(|s| !s.is_empty()),
        chain_event_tx: chain_event_tx.clone(),
    });

    // Spawn chain pollers via run_collector_loop
    macro_rules! spawn_poller {
        ($name:expr, $secs:expr, $fn:path) => {{
            let s = Arc::clone(&app_state);
            tokio::spawn(collector_loop::run_collector_loop($name, Duration::from_secs($secs), move || {
                let s = Arc::clone(&s);
                async move { $fn(&s).await }
            }));
        }};
    }
    spawn_poller!("nav",          1, chain_pollers::poll_nav_once);
    spawn_poller!("oracle",       2, chain_pollers::poll_oracle_once);
    spawn_poller!("balances",     1, chain_pollers::poll_user_balances_once);
    spawn_poller!("allowances",   3, chain_pollers::poll_user_allowances_once);
    spawn_poller!("orders",       1, chain_pollers::poll_user_orders_once);
    spawn_poller!("positions",    3, chain_pollers::poll_user_positions_once);
    spawn_poller!("cost_basis",   5, chain_pollers::poll_user_cost_basis_once);
    // Backend chain state pollers (for issuer/AP HTTP endpoints)
    spawn_poller!("pending_orders",     1, chain_pollers::poll_pending_orders_once);
    spawn_poller!("batched_orders",     2, chain_pollers::poll_batched_orders_once);
    spawn_poller!("issuer_registry",   10, chain_pollers::poll_issuer_registry_once);
    spawn_poller!("cycle_metadata",     2, chain_pollers::poll_cycle_metadata_once);
    spawn_poller!("registry_metadata", 10, chain_pollers::poll_registry_metadata_once);
    spawn_poller!("settlement_state",   2, chain_pollers::poll_settlement_state_once);
    info!("Chain pollers started (NAV=1s, Oracle=2s, Balances=1s, Allowances=3s, Orders=1s, Positions=3s, CostBasis=5s, PendingOrders=1s, BatchedOrders=2s, IssuerRegistry=10s, CycleMetadata=2s, RegistryMetadata=10s, SettlementState=2s)");

    // Spawn chain event scanner (L3 + Settlement log subscriptions)
    {
        let scanner = crate::chain_event_scanner::ChainEventScanner::new(
            Arc::clone(&app_state.l3_provider),
            Arc::clone(&app_state.settlement_provider),
            app_state.deployment.clone(),
            chain_event_tx.clone(),
        );
        let (_l3_handle, _settlement_handle) = scanner.start().await;
        info!("Chain event scanner started (L3 + Settlement)");
    }

    // Clone pool for explorer API before app_state is moved into the main router
    let explorer_pool = app_state.pool.clone();
    let mut app = api::router(app_state);

    // Explorer API — only registered if token is configured (fail-closed)
    if let Some(ref token) = args.explorer_token {
        app = app.merge(explorer_api::explorer_routes(explorer_pool, token.clone()));
    }

    // P2.9: Use configurable bind address
    let bind_ip: std::net::IpAddr = args.bind.parse().unwrap_or_else(|e| {
        tracing::warn!(bind = %args.bind, error = %e, "Invalid bind address, falling back to 0.0.0.0");
        std::net::IpAddr::V4(std::net::Ipv4Addr::new(0, 0, 0, 0))
    });
    let addr = SocketAddr::from((bind_ip, args.port));
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

    let limiter = coingecko::RateLimiter::coingecko_demo();
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
