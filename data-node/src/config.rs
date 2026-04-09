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
    /// Backfill DefiLlama TVL/fees/volume history
    DlBackfill(DlBackfillArgs),
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
    #[arg(long, default_value = "http://142.132.164.24/", env = "INDEX_RPC_URL")]
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

    /// RPC endpoint for Settlement chain (balances, allowances, Morpho)
    #[arg(long, default_value = "http://localhost:8546", env = "SETTLEMENT_RPC_URL")]
    pub settlement_rpc_url: String,

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

    /// DefiLlama collector interval in seconds (default: 24h). Set to 0 to disable.
    #[arg(long, default_value = "86400", env = "DL_POLL_INTERVAL_SECS")]
    pub dl_poll_interval: u64,

    /// FNG collector interval in seconds (default: 24h). Set to 0 to disable.
    #[arg(long, default_value = "86400", env = "FNG_POLL_INTERVAL_SECS")]
    pub fng_poll_interval: u64,

    // === Market data providers (from AA) ===

    /// Finnhub API key (enables stock price polling)
    #[arg(long, env = "FINNHUB_API_KEY")]
    pub finnhub_api_key: Option<String>,

    /// Finnhub poll interval in seconds (default: 10 min)
    #[arg(long, default_value = "600", env = "FINNHUB_SYNC_INTERVAL_SECS")]
    pub finnhub_sync_interval: u64,

    /// FRED API key (enables Federal Reserve economic data)
    #[arg(long, env = "FRED_API_KEY")]
    pub fred_api_key: Option<String>,

    /// BLS API key (enables employment/inflation data)
    #[arg(long, env = "BLS_API_KEY")]
    pub bls_api_key: Option<String>,

    /// Nasdaq Data Link API key (enables CFTC, CHRIS, BCHAIN, OPEC, IMF)
    #[arg(long, env = "NASDAQ_API_KEY")]
    pub nasdaq_api_key: Option<String>,

    /// Treasury API key (Nasdaq Data Link, enables yield curves)
    #[arg(long, env = "TREASURY_API_KEY")]
    pub treasury_api_key: Option<String>,

    /// EIA API key (enables energy data)
    #[arg(long, env = "EIA_API_KEY")]
    pub eia_api_key: Option<String>,

    /// OpenMeteo sync interval in seconds (0 = disabled, no key needed)
    #[arg(long, default_value = "0", env = "OPENMETEO_SYNC_INTERVAL_SECS")]
    pub openmeteo_sync_interval: u64,

    /// FINRA OAuth client ID (enables short interest data)
    #[arg(long, env = "FINRA_CLIENT_ID")]
    pub finra_client_id: Option<String>,

    /// FINRA OAuth client secret
    #[arg(long, env = "FINRA_CLIENT_SECRET")]
    pub finra_client_secret: Option<String>,

    // === New market data providers ===

    /// Twitch client ID (enables Twitch live streaming data)
    #[arg(long, env = "TWITCH_CLIENT_ID")]
    pub twitch_client_id: Option<String>,

    /// Twitch client secret
    #[arg(long, env = "TWITCH_CLIENT_SECRET")]
    pub twitch_client_secret: Option<String>,

    /// TMDb API key (enables movie/TV/celebrity popularity tracking)
    #[arg(long, env = "TMDB_API_KEY")]
    pub tmdb_api_key: Option<String>,

    /// Last.fm API key (enables music artist listener/scrobble tracking)
    #[arg(long, env = "LASTFM_API_KEY")]
    pub lastfm_api_key: Option<String>,

    /// backpack.tf API key (enables TF2 item price tracking)
    #[arg(long, env = "BACKPACKTF_API_KEY")]
    pub backpacktf_api_key: Option<String>,

    /// GitHub token (enables repository star tracking)
    #[arg(long, env = "GITHUB_TOKEN")]
    pub github_token: Option<String>,

    /// Cloudflare Radar token (enables internet metrics tracking)
    #[arg(long, env = "CLOUDFLARE_RADAR_TOKEN")]
    pub cloudflare_radar_token: Option<String>,

    /// Admin token for protecting destructive admin endpoints (/admin/*)
    #[arg(long, env = "ADMIN_TOKEN")]
    pub admin_token: Option<String>,

    /// Bearer token for protecting sim API endpoints (/sim/*)
    /// If unset, sim endpoints are open (backwards compatible for local dev)
    #[arg(long, env = "SIM_AUTH_TOKEN")]
    pub sim_auth_token: Option<String>,

    /// Enable Polymarket prediction market data (no key needed)
    #[arg(long, default_value = "false", env = "POLYMARKET_ENABLED")]
    pub polymarket_enabled: bool,

    /// Enable HackerNews story score collector (no key needed)
    #[arg(long, default_value = "false", env = "HACKERNEWS_ENABLED")]
    pub hackernews_enabled: bool,

    /// Enable Weather station collector (no key needed, Open-Meteo API)
    #[arg(long, default_value = "false", env = "WEATHER_ENABLED")]
    pub weather_enabled: bool,

    // === Bet on Everything sources ===

    /// NASA FIRMS MAP key (enables wildfire hotspot tracking)
    #[arg(long, env = "NASA_FIRMS_MAP_KEY")]
    pub nasa_firms_key: Option<String>,

    /// AIS Stream API key (enables maritime vessel tracking)
    #[arg(long, env = "AISSTREAM_API_KEY")]
    pub aisstream_api_key: Option<String>,

    /// Movebank username (enables GPS animal tracking from Movebank)
    #[arg(long, env = "MOVEBANK_USER")]
    pub movebank_user: Option<String>,

    /// Movebank password
    #[arg(long, env = "MOVEBANK_PASSWORD")]
    pub movebank_password: Option<String>,

    /// eBird API key (enables bird observation tracking)
    #[arg(long, env = "EBIRD_API_KEY")]
    pub ebird_api_key: Option<String>,

    /// Helius API key (enables Pump.fun token tracking via Solana RPC)
    #[arg(long, env = "HELIUS_API_KEY")]
    pub helius_api_key: Option<String>,

    /// Reddit client ID (enables subreddit popularity tracking)
    #[arg(long, env = "REDDIT_CLIENT_ID")]
    pub reddit_client_id: Option<String>,

    /// Reddit client secret
    #[arg(long, env = "REDDIT_CLIENT_SECRET")]
    pub reddit_client_secret: Option<String>,

    /// Best Buy API key (enables product price tracking)
    #[arg(long, env = "BESTBUY_API_KEY")]
    pub bestbuy_api_key: Option<String>,

    /// Adzuna app ID (enables job market tracking)
    #[arg(long, env = "ADZUNA_APP_ID")]
    pub adzuna_app_id: Option<String>,

    /// Adzuna app key
    #[arg(long, env = "ADZUNA_APP_KEY")]
    pub adzuna_app_key: Option<String>,

    /// P2.8: Allowed CORS origins (repeat for multiple). Empty = allow all.
    #[arg(long, env = "CORS_ORIGIN")]
    pub cors_origin: Vec<String>,

    /// P2.9: Bind address for the HTTP server (default: 0.0.0.0)
    #[arg(long, default_value = "0.0.0.0", env = "BIND_ADDRESS")]
    pub bind: String,

    /// Reset session data (truncate trades/snapshots, clear cursors) before starting collectors.
    #[arg(long, default_value = "false", env = "DATA_NODE_RESET_SESSION")]
    pub reset_session: bool,

    /// Shared HMAC secret for authenticating snapshot responses (IS-7).
    /// If set, snapshot responses will be signed with HMAC-SHA256.
    /// The signature is sent as the X-Snapshot-HMAC header.
    #[arg(long, env = "SNAPSHOT_HMAC_SECRET")]
    pub snapshot_hmac_secret: Option<String>,

    /// Comma-separated oracle health endpoint URLs (e.g., "http://localhost:8100,http://localhost:8101,http://localhost:8102")
    #[arg(long, env = "ORACLE_HEALTH_URLS")]
    pub oracle_health_urls: Option<String>,

    /// Oracle health polling interval in seconds (default: 300 = 5 minutes)
    #[arg(long, default_value = "300", env = "ORACLE_HEALTH_POLL_INTERVAL_SECS")]
    pub oracle_health_poll_interval: u64,

    /// Shared secret token for authenticating explorer API requests (frontend-only access)
    #[arg(long, env = "EXPLORER_TOKEN")]
    pub explorer_token: Option<String>,

    /// Path to sources-display.json (canonical source registry shared with frontend)
    #[arg(long, default_value = "../frontend/data/sources-display.json", env = "SOURCES_DISPLAY_FILE")]
    pub sources_display_file: String,
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

    /// Only fetch data from this date onwards (YYYY-MM-DD). Uses range API instead of full history.
    #[arg(long)]
    pub since: Option<String>,

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

#[derive(Parser, Debug)]
pub struct DlBackfillArgs {
    /// PostgreSQL connection URL
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: String,

    /// Concurrent workers for backfill fetching
    #[arg(long, default_value = "5")]
    pub concurrency: usize,

    /// Log level
    #[arg(long, default_value = "info", env = "DATA_NODE_LOG_LEVEL")]
    pub log_level: String,
}
