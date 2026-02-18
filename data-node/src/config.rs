use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(name = "data-node", about = "Historical price storage service for Index")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Run the HTTP server + live price collector
    Serve(ServeArgs),
    /// Backfill historical prices from Bitget and store ITP snapshots
    Backfill(BackfillArgs),
    /// Backfill monthly historical market caps from CoinGecko
    CgBackfill(CgBackfillArgs),
    /// Download all missing CoinGecko coin logos
    SyncLogos(SyncLogosArgs),
    /// Fetch Bitget spot listing/delisting dates and store in DB
    SyncListings(SyncListingsArgs),
}

#[derive(Parser, Debug)]
pub struct ServeArgs {
    /// HTTP server port
    #[arg(long, default_value = "8200", env = "DATA_NODE_PORT")]
    pub port: u16,

    /// PostgreSQL connection URL
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: String,

    /// Path to assets.json file
    #[arg(long, default_value = "assets.json", env = "DATA_NODE_ASSETS_FILE")]
    pub assets_file: String,

    /// Price polling interval in seconds
    #[arg(long, default_value = "30", env = "DATA_NODE_POLL_INTERVAL_SECS")]
    pub poll_interval: u64,

    /// Data retention in days
    #[arg(long, default_value = "90", env = "DATA_NODE_RETENTION_DAYS")]
    pub retention_days: u32,

    /// Log level
    #[arg(long, default_value = "info", env = "DATA_NODE_LOG_LEVEL")]
    pub log_level: String,

    /// Path to symbol-map.json (address → Bitget pair)
    #[arg(long, default_value = "data/symbol-map.json", env = "DATA_NODE_SYMBOL_MAP")]
    pub symbol_map: String,

    /// RPC endpoint for the Index chain
    #[arg(long, default_value = "https://index.rpc.zeeve.net", env = "INDEX_RPC_URL")]
    pub rpc_url: String,

    /// Index contract address
    #[arg(long, env = "INDEX_ADDRESS")]
    pub index_address: Option<String>,

    /// ITP collector poll interval in seconds
    #[arg(long, default_value = "30", env = "ITP_POLL_INTERVAL_SECS")]
    pub itp_poll_interval: u64,

    /// Fast ticker poll interval in seconds (in-memory cache, not DB)
    #[arg(long, default_value = "2", env = "DATA_NODE_FAST_POLL_SECS")]
    pub fast_poll_secs: u64,

    /// Liquidity polling interval in seconds (default: hourly)
    #[arg(long, default_value = "3600", env = "LIQUIDITY_POLL_INTERVAL_SECS")]
    pub liquidity_poll_interval: u64,

    /// CoinGecko Pro API key (enables monthly market-cap collector)
    #[arg(long, env = "COINGECKO_API_KEY")]
    pub coingecko_api_key: Option<String>,

    /// CoinGecko collector poll interval in seconds (default: 24h)
    #[arg(long, default_value = "86400", env = "CG_POLL_INTERVAL_SECS")]
    pub cg_poll_interval: u64,

    /// RPC endpoint for Arbitrum chain (balances, allowances, Morpho)
    #[arg(long, default_value = "http://localhost:8546", env = "ARB_RPC_URL")]
    pub arb_rpc_url: String,

    /// Path to active-deployment.json
    #[arg(long, default_value = "deployments/active-deployment.json", env = "DEPLOYMENT_FILE")]
    pub deployment_file: String,

    /// Path to morpho-e2e.json
    #[arg(long, default_value = "deployments/morpho-e2e.json", env = "MORPHO_DEPLOYMENT_FILE")]
    pub morpho_deployment_file: String,

    /// Directory to store CoinGecko coin logos
    #[arg(long, default_value = "data/logos", env = "LOGOS_DIR")]
    pub logos_dir: String,

    /// Listing sync interval in seconds (default: 24h). Set to 0 to disable.
    #[arg(long, default_value = "86400", env = "LISTING_SYNC_INTERVAL_SECS")]
    pub listing_sync_interval: u64,
}

#[derive(Parser, Debug)]
pub struct BackfillArgs {
    /// PostgreSQL connection URL
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: String,

    /// RPC endpoint for the Index chain
    #[arg(long, default_value = "http://localhost:8545", env = "BACKFILL_RPC")]
    pub rpc: String,

    /// Index contract address
    #[arg(long, env = "INDEX_ADDRESS")]
    pub index_address: String,

    /// Path to symbol-map.json (address → Bitget pair)
    #[arg(long, default_value = "data/symbol-map.json", env = "DATA_NODE_SYMBOL_MAP")]
    pub symbol_map: String,

    /// Number of days to backfill
    #[arg(long, default_value = "30")]
    pub days: u32,

    /// Concurrent workers for kline fetching
    #[arg(long, default_value = "3")]
    pub concurrency: usize,

    /// Log level
    #[arg(long, default_value = "info", env = "DATA_NODE_LOG_LEVEL")]
    pub log_level: String,

    /// Skip chain discovery (Phase A/B) and read symbols from existing DB snapshots
    #[arg(long, default_value = "false")]
    pub skip_chain: bool,
}

#[derive(Parser, Debug)]
pub struct CgBackfillArgs {
    /// PostgreSQL connection URL
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: String,

    /// CoinGecko Pro API key
    #[arg(long, env = "COINGECKO_API_KEY")]
    pub coingecko_api_key: String,

    /// Only backfill top N coins by market cap (0 = all)
    #[arg(long, default_value = "0")]
    pub top_n: u32,

    /// Skip coins that already have historical data in DB (for resumable runs)
    #[arg(long, default_value = "false")]
    pub skip_existing: bool,

    /// Concurrent workers for historical fetching
    #[arg(long, default_value = "5")]
    pub concurrency: usize,

    /// Log level
    #[arg(long, default_value = "info", env = "DATA_NODE_LOG_LEVEL")]
    pub log_level: String,
}

#[derive(Parser, Debug)]
pub struct SyncLogosArgs {
    /// CoinGecko Pro API key
    #[arg(long, env = "COINGECKO_API_KEY")]
    pub coingecko_api_key: String,

    /// Directory to store logos
    #[arg(long, default_value = "data/logos", env = "LOGOS_DIR")]
    pub logos_dir: String,

    /// Log level
    #[arg(long, default_value = "info", env = "DATA_NODE_LOG_LEVEL")]
    pub log_level: String,
}

#[derive(Parser, Debug)]
pub struct SyncListingsArgs {
    /// PostgreSQL connection URL
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: String,

    /// Log level
    #[arg(long, default_value = "info", env = "DATA_NODE_LOG_LEVEL")]
    pub log_level: String,
}
