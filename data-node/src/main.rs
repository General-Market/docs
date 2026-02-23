mod api;
mod backfill;
mod cg_backfill;
mod cg_collector;
pub mod chain_cache;
mod chain_pollers;
mod coingecko;
mod collector;
mod config;
mod db;
mod defillama;
mod dl_backfill;
mod dl_collector;
mod fng_client;
mod fng_collector;
mod itp_collector;
mod kline_collector;
mod liquidity_collector;
mod listing_sync;
pub mod live_cache;
mod logo_downloader;
mod simulation;
mod trade_collector;
mod market_data;
mod vision_api;

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

    // ── Market data providers (from AA) ──────────────────────────────────
    // Initialize global error tracker and sync registry before starting any sources
    market_data::error_tracker::init_global();
    market_data::sync_registry::init_global();

    // Each provider is gated on its config key. We use SyncEngine (fixed interval)
    // for simple sources and ScheduledSyncEngine for schedule-aware sources.

    // 1. Finnhub (stocks) — gated on API key
    if let Some(ref key) = args.finnhub_api_key {
        std::env::set_var("FINNHUB_API_KEY", key);
        std::env::set_var("FINNHUB_SYNC_INTERVAL_SECS", args.finnhub_sync_interval.to_string());
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::finnhub::FinnhubClient::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::fred::FredMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::bls::BlsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("BLS init failed: {e}"),
            }
        });
        info!("BLS employment/inflation provider started");
    }

    // 4. Treasury (bonds) — gated on treasury_api_key, schedule-aware
    if let Some(ref key) = args.treasury_api_key {
        std::env::set_var("NASDAQ_API_KEY", key);
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::treasury::TreasuryMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::ecb::EcbMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::eia::EiaMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("EIA init failed: {e}"),
            }
        });
        info!("EIA energy data provider started");
    }

    // 7. Nasdaq sources (CFTC, CHRIS, OPEC, IMF) — gated on nasdaq_api_key
    if let Some(ref key) = args.nasdaq_api_key {
        std::env::set_var("NASDAQ_API_KEY", key);

        // CFTC
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::CftcMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("CFTC init failed: {e}"),
            }
        });

        // CHRIS (continuous futures)
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::ChrisMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("CHRIS init failed: {e}"),
            }
        });

        // OPEC
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::OpecMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("OPEC init failed: {e}"),
            }
        });

        // IMF
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::nasdaq::ImfMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::nasdaq::BchainMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::openmeteo::OpenMeteoMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::sec_edgar::SecEdgarMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("SEC EDGAR init failed: {e}"),
            }
        });
    }

    // SEC EFTS Filing Counts (no auth required)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::sec_efts::SecEftsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("SEC EFTS init failed: {e}"),
            }
        });
    }

    // SEC Form 4 Insider Trading (no auth required)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::sec_insider::SecInsiderMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
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
            tokio::spawn(async move {
                match market_data::sources::finra::FinraMarketSource::from_env() {
                    Ok(source) => {
                        let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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

    // Congress (requires CONGRESS_API_KEY — skip silently if not set)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::congress::CongressMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::warn!("Congress provider skipped: {e}"),
            }
        });
    }

    // World Bank
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::worldbank::WorldBankMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("World Bank init failed: {e}"),
            }
        });
    }

    info!("Free market data providers started (SEC EFTS, SEC Insider, Congress, World Bank)");

    // ── New market data providers (from AA market-data-lib) ─────────────
    // 10. No-key sources — always enabled

    // npm package downloads
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::npm::NpmMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("npm init failed: {e}"),
            }
        });
    }

    // PyPI package downloads
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::pypi::PypiMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("PyPI init failed: {e}"),
            }
        });
    }

    // crates.io Rust package downloads
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::crates_io::CratesIoMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("crates.io init failed: {e}"),
            }
        });
    }

    // Steam concurrent player counts
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::steam::SteamMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Steam init failed: {e}"),
            }
        });
    }

    // Hacker News story scores
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::hackernews::HackerNewsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("HackerNews init failed: {e}"),
            }
        });
    }

    // 4chan board activity
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::fourchan::FourchanMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("4chan init failed: {e}"),
            }
        });
    }

    // AniList anime/manga popularity
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::anilist::AniListMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("AniList init failed: {e}"),
            }
        });
    }

    // TWSE (Taiwan Stock Exchange)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::twse::TwseMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("TWSE init failed: {e}"),
            }
        });
    }

    // Polymarket prediction markets
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::polymarket::PolymarketMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Polymarket init failed: {e}"),
            }
        });
    }

    // DefiLlama (chain TVL, protocol TVL, DEX volumes)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::defillama::DefiLlamaMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("DefiLlama market source init failed: {e}"),
            }
        });
    }

    // DISABLED: unimplemented stub — Zillow requires Bridge Interactive API which was never integrated.
    // Registers assets that never get prices.
    // {
    //     let pool_c = pool.clone();
    //     tokio::spawn(async move {
    //         match market_data::sources::zillow::ZillowMarketSource::from_env() {
    //             Ok(source) => {
    //                 let engine = market_data::ScheduledSyncEngine::new(pool_c, Box::new(source));
    //                 engine.run().await;
    //             }
    //             Err(e) => tracing::error!("Zillow init failed: {e}"),
    //         }
    //     });
    // }

    info!("No-key market data providers started (npm, PyPI, crates.io, Steam, HackerNews, 4chan, AniList, TWSE, Polymarket, DefiLlama)");

    // 11. API-key-gated new sources

    // Twitch — gated on client ID + secret
    if let Some(ref client_id) = args.twitch_client_id {
        if let Some(ref client_secret) = args.twitch_client_secret {
            std::env::set_var("TWITCH_CLIENT_ID", client_id);
            std::env::set_var("TWITCH_CLIENT_SECRET", client_secret);
            let pool_c = pool.clone();
            tokio::spawn(async move {
                match market_data::sources::twitch::TwitchMarketSource::from_env() {
                    Ok(source) => {
                        let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::tmdb::TmdbMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("TMDb init failed: {e}"),
            }
        });
        info!("TMDb movie/TV provider started");
    }

    // backpack.tf — gated on API key
    if let Some(ref key) = args.backpacktf_api_key {
        std::env::set_var("BACKPACKTF_API_KEY", key);
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::backpacktf::BackpackTfMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("backpack.tf init failed: {e}"),
            }
        });
        info!("backpack.tf TF2 item provider started");
    }

    // GitHub — gated on token
    if let Some(ref token) = args.github_token {
        std::env::set_var("GITHUB_TOKEN", token);
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::github::GithubMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::cloudflare::CloudflareRadarMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Cloudflare Radar init failed: {e}"),
            }
        });
        info!("Cloudflare Radar internet metrics provider started");
    }

    // CoinGecko market source (crypto prices via SyncEngine) — reuses existing coingecko_api_key
    if let Some(ref cg_api_key) = args.coingecko_api_key {
        std::env::set_var("COINGECKO_API_KEY", cg_api_key);
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::coingecko::CoinGeckoMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("CoinGecko market source init failed: {e}"),
            }
        });
        info!("CoinGecko market source (crypto prices) started");
    }

    // ── Bet on Everything sources (10) ────────────────────────────────────

    // Volcano — USGS (no key)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::volcano::VolcanoMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Volcano init failed: {e}"),
            }
        });
    }

    // Earthquake — USGS (no key)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::earthquake::EarthquakeMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Earthquake init failed: {e}"),
            }
        });
    }

    // Space Weather — NOAA (no key)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::spaceweather::SpaceweatherMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::wildfire::WildfireMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::flights::FlightsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Flights init failed: {e}"),
            }
        });
    }

    // Military Aircraft — adsb.lol (no key, community ADS-B API)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::mil_aircraft::MilAircraftMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("MilAircraft init failed: {e}"),
            }
        });
    }

    // Maritime — AIS Stream (gated on API key)
    if let Some(ref key) = args.aisstream_api_key {
        std::env::set_var("AISSTREAM_API_KEY", key);
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::maritime::MaritimeMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Maritime init failed: {e}"),
            }
        });
        info!("AIS maritime vessel provider started");

        // AISstream WebSocket ship tracking (reuses same API key)
        let aisstream_key = key.clone();
        let pool_c = pool.clone();
        tokio::spawn(async move {
            let source = market_data::sources::aisstream::AisStreamMarketSource::new(aisstream_key);
            let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
            engine.run().await;
        });
        info!("AISstream ship tracking provider started");
    }

    // Epidemic — disease.sh (no key)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::epidemic::EpidemicMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Epidemic init failed: {e}"),
            }
        });
    }

    // Sports — ESPN (no key)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::sports::SportsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Sports init failed: {e}"),
            }
        });
    }

    // ISS Position — Open Notify (no key)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::iss::IssMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("ISS init failed: {e}"),
            }
        });
    }

    // Weather Alerts — NWS (no key, User-Agent only)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::weather_alerts::WeatherAlertsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("Weather Alerts init failed: {e}"),
            }
        });
    }

    // Animals — GBIF + iNaturalist (no key)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::animals::AnimalsMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
            tokio::spawn(async move {
                match market_data::sources::movebank::MovebankMarketSource::new(mb_user_c, mb_pass_c) {
                    Ok(source) => {
                        let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            match market_data::sources::ebird::EbirdMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
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
        tokio::spawn(async move {
            let source = market_data::sources::gtfs_rt::GtfsRtMarketSource::new();
            let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
            engine.run().await;
        });
        info!("GTFS-RT transit provider started");
    }

    // USASpending.gov — US federal defense spending (no key needed)
    {
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::usa_spending::UsaSpendingMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("USASpending init failed: {e}"),
            }
        });
        info!("USASpending.gov defense spending provider started");
    }

    // Pump.fun — Helius RPC + Dexscreener (gated on API key)
    if let Some(ref key) = args.helius_api_key {
        std::env::set_var("HELIUS_API_KEY", key);
        let pool_c = pool.clone();
        tokio::spawn(async move {
            match market_data::sources::pumpfun::PumpfunMarketSource::from_env() {
                Ok(source) => {
                    let engine = market_data::SyncEngine::new(pool_c, Box::new(source));
                    engine.run().await;
                }
                Err(e) => tracing::error!("PumpFun init failed: {e}"),
            }
        });
        info!("Pump.fun token tracker started (Helius + Dexscreener)");
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
        if args.treasury_api_key.is_none() {
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
        if args.nasdaq_api_key.is_none() {
            for src in &["cftc", "futures", "opec", "imf"] {
                tracker.record_not_started(src, "Missing --nasdaq-api-key");
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
        // backpack.tf
        if args.backpacktf_api_key.is_none() {
            tracker.record_not_started("backpacktf", "Missing --backpacktf-api-key");
        }
        // GitHub
        if args.github_token.is_none() {
            tracker.record_not_started("github", "Missing --github-token");
        }
        // Cloudflare Radar
        if args.cloudflare_radar_token.is_none() {
            tracker.record_not_started("cloudflare", "Missing --cloudflare-radar-token");
        }
        // CoinGecko (market_data source)
        if args.coingecko_api_key.is_none() {
            tracker.record_not_started("crypto", "Missing --coingecko-api-key");
        }
        // Wildfire (NASA FIRMS)
        if args.nasa_firms_key.is_none() {
            tracker.record_not_started("wildfire", "Missing --nasa-firms-key");
        }
        // Maritime + AISstream
        if args.aisstream_api_key.is_none() {
            tracker.record_not_started("maritime", "Missing --aisstream-api-key");
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
        // Pump.fun (Helius)
        if args.helius_api_key.is_none() {
            tracker.record_not_started("pumpfun", "Missing --helius-api-key");
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

    // Create L3 + ARB providers
    let l3_provider = Arc::new(Provider::<Http>::try_from(&args.rpc_url)
        .map_err(|e| format!("Failed to create L3 provider from {}: {}", args.rpc_url, e))?);
    let arb_provider = Arc::new(Provider::<Http>::try_from(&args.arb_rpc_url)
        .map_err(|e| format!("Failed to create ARB provider from {}: {}", args.arb_rpc_url, e))?);
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

    // Chain cache for SSE pollers
    let chain_cache = Arc::new(chain_cache::ChainCache::new());

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
        sim_cache,
        chain_cache,
        admin_token: args.admin_token.clone(),
        cors_origins: args.cors_origin.clone(),
    });

    // Spawn chain pollers (NAV=1s, Oracle=2s)
    tokio::spawn(chain_pollers::poll_nav(Arc::clone(&app_state)));
    tokio::spawn(chain_pollers::poll_oracle(Arc::clone(&app_state)));
    // Per-user pollers (balances=1s, allowances=3s, orders=1s, positions=3s, cost_basis=5s)
    tokio::spawn(chain_pollers::poll_user_balances(Arc::clone(&app_state)));
    tokio::spawn(chain_pollers::poll_user_allowances(Arc::clone(&app_state)));
    tokio::spawn(chain_pollers::poll_user_orders(Arc::clone(&app_state)));
    tokio::spawn(chain_pollers::poll_user_positions(Arc::clone(&app_state)));
    tokio::spawn(chain_pollers::poll_user_cost_basis(Arc::clone(&app_state)));
    info!("Chain pollers started (NAV=1s, Oracle=2s, Balances=1s, Allowances=3s, Orders=1s, Positions=3s, CostBasis=5s)");

    let app = api::router(app_state);
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
