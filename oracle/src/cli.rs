//! CLI argument parsing for the oracle node binary.

use clap::Parser;
use std::path::PathBuf;

/// Index L3 Oracle Node
///
/// Participates in order batching, BLS consensus, and trade execution.
///
/// Configuration priority: CLI args > Environment variables > Config file > Defaults
#[derive(Parser, Debug)]
#[command(name = "oracle")]
#[command(author = "Index Team")]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(about = "Index L3 Oracle Node - participates in consensus and order execution")]
#[command(long_about = None)]
pub(crate) struct Args {
    /// Oracle node ID (1-20). Can also be set via ORACLE_NODE_ID env var or config file.
    #[arg(long)]
    pub node_id: Option<u32>,

    /// P2P listen port (default: 9000 + node_id). Can also be set via ORACLE_PORT env var.
    #[arg(long)]
    pub port: Option<u16>,

    /// Chain RPC endpoint. Can also be set via ORACLE_RPC_URL env var.
    #[arg(long)]
    pub rpc: Option<String>,

    /// Path to configuration file (YAML format)
    #[arg(long)]
    pub config: Option<PathBuf>,

    /// Log level (trace, debug, info, warn, error). Can also be set via ORACLE_LOG_LEVEL env var.
    #[arg(long)]
    pub log_level: Option<String>,

    /// Log output directory. Can also be set via ORACLE_LOG_DIR env var.
    #[arg(long)]
    pub log_dir: Option<PathBuf>,

    /// Output logs as JSON. Can also be set via ORACLE_JSON_LOGS env var.
    #[arg(long)]
    pub json_logs: bool,

    /// Path to BLS key file. Can also be set via ORACLE_BLS_KEY_PATH env var.
    #[arg(long)]
    pub bls_key_path: Option<PathBuf>,

    /// Peer addresses to connect to (can be specified multiple times).
    /// Format: "ip:port". Can also be set via ORACLE_PEERS env var (comma-separated).
    #[arg(long = "peer", value_name = "ADDRESS")]
    pub peers: Vec<String>,

    /// Cycle duration in milliseconds (default: 1000ms for 1-second cycles).
    /// Acts as the heartbeat interval in demand-driven mode.
    #[arg(long, default_value = "1000")]
    pub cycle_duration_ms: u64,

    /// Minimum gap between fast (work-driven) cycles in milliseconds.
    /// Only applies when there's pending work (bridge orders in flight).
    #[arg(long, default_value = "50")]
    pub min_cycle_gap_ms: u64,

    /// BLS sign timeout for consensus rounds in milliseconds (default: 500).
    /// All oracles are co-located on the same VPS (~1ms P2P latency), so 500ms is generous.
    #[arg(long, default_value = "500")]
    pub sign_timeout_ms: u64,

    /// Disable TLS for P2P connections (development only)
    #[arg(long)]
    pub no_tls: bool,

    /// Maximum connections allowed from a single IP address (default: 2).
    /// Set to 0 for unlimited. Loopback IPs (127.x.x.x) are always exempt.
    #[arg(long, default_value = "2")]
    pub p2p_max_per_ip: usize,

    /// Rate limit: messages per second per peer connection (default: 100).
    #[arg(long, default_value = "100")]
    pub p2p_rate_limit: f64,

    /// Rate burst: maximum burst size / token bucket capacity (default: 100).
    #[arg(long, default_value = "100")]
    pub p2p_rate_burst: f64,

    /// Use mock chain reader/writer instead of real RPC connections (development mode)
    #[arg(long)]
    pub mock: bool,

    /// Path to deployment JSON file containing contract addresses.
    #[arg(long)]
    pub deployment_file: Option<PathBuf>,

    /// Start state reconstruction from specific block number (ignores checkpoint)
    #[arg(long)]
    pub from_block: Option<u64>,

    /// Maximum gas limit for transactions (default: 50M, supports ~1000 players/batch).
    #[arg(long, default_value = "50000000")]
    pub max_gas_limit: u64,

    /// Receipt wait timeout in seconds (default: 30, increase for heavy L3 load).
    #[arg(long, default_value = "30")]
    pub receipt_timeout_secs: u64,

    /// Consensus timeout total in milliseconds (default: 800, must be < cycle_duration_ms).
    #[arg(long)]
    pub consensus_timeout_ms: Option<u64>,

    /// Hard timeout for an entire consensus round in seconds (default: 120).
    /// If a round exceeds this, it is abandoned and the next cycle proceeds.
    #[arg(long, default_value = "120")]
    pub consensus_round_timeout_secs: u64,

    /// Path to checkpoint file for faster restart
    #[arg(long, default_value = "./checkpoint.json")]
    pub checkpoint_path: String,

    /// Skip state reconstruction (start with empty state, for testing)
    #[arg(long)]
    pub skip_reconstruction: bool,

    /// Emergency override for BLS signature threshold (default: auto-calculate from oracle count).
    #[arg(long = "emergency-threshold-override", alias = "signature-threshold")]
    pub signature_threshold: Option<usize>,

    /// Number of oracles in the network (default: 3).
    #[arg(long, default_value = "3")]
    pub num_oracles: u8,

    /// Generate deterministic BLS key from seed [N, 0x42, 0, ...] (for testing).
    #[arg(long)]
    pub bls_key_seed_index: Option<u8>,

    /// Override the on-chain oracle ID used in signerBitmap (for testing).
    #[arg(long)]
    pub on_chain_oracle_id: Option<u8>,

    /// Build InMemoryKeyRegistry from deterministic seeds for all num_oracles nodes.
    #[arg(long)]
    pub test_key_seeds: bool,

    /// Offset for peer_ids in the test key registry.
    #[arg(long, default_value = "0")]
    pub key_registry_offset: u8,

    /// MockBitgetVault contract address for on-chain fill verification (E2E testing).
    #[arg(long)]
    pub bitget_vault: Option<String>,

    /// BridgeProxy contract address for watching ITP creation requests.
    #[arg(long)]
    pub bridge_proxy: Option<String>,

    /// Path to custom symbol map JSON file for asset-to-Bitget-symbol mappings.
    #[arg(long)]
    pub symbol_map_file: Option<PathBuf>,

    /// Override expected chain ID (default: 111222333 for Index L3).
    #[arg(long)]
    pub chain_id: Option<u64>,

    /// OracleCustody L3 contract address (Story 7.7).
    #[arg(long)]
    pub oracle_custody_l3: Option<String>,

    /// OracleCustody Settlement contract address (Story 7.7).
    #[arg(long)]
    pub oracle_custody_settlement: Option<String>,

    /// SettlementBridgeCustody contract address (Story 7.8).
    #[arg(long)]
    pub settlement_custody: Option<String>,

    /// Enable the NAV signing API endpoint (GET /api/nav-sign).
    /// The endpoint returns BLS-signed NAV prices for ITPs (Story 8.3).
    #[arg(long, default_value = "true")]
    pub api_enabled: bool,

    /// Starting cycle number for on-chain submissions.
    /// Use this to avoid E019_CycleAlreadyProcessed errors when cycles were
    /// already used during manual testing. Defaults to 0 if not specified.
    /// Recommended: use a high value like 10000000 for fresh deployments.
    #[arg(long)]
    pub start_cycle: Option<u64>,

    /// NTP server address for time synchronization (default: pool.ntp.org).
    /// Set to empty string to disable NTP sync.
    #[arg(long, default_value = "pool.ntp.org")]
    pub ntp_server: String,

    /// Enable the registry sync endpoint (GET /api/registry-sync).
    /// When enabled, the oracle watches for RegistryStateChanged events from L3 OracleRegistry
    /// and serves BLS-signed registry state proofs for MirrorOracleRegistry sync on Settlement.
    /// (Story 8.4, Task 7.1)
    #[arg(long)]
    pub registry_sync: bool,

    /// MockUSDT token contract address for USDT-pair fill verification (Story 7.18).
    /// When set, oracle fill verification accepts this address as a valid USDT token.
    #[arg(long)]
    pub mock_usdt: Option<String>,

    /// Override asset count for bootstrap (used when on-chain assetCount() returns 0
    /// because setPriceAdmin hasn't been called yet). Prices will be fetched from
    /// Bitget instead of on-chain.
    #[arg(long)]
    pub asset_count: Option<u64>,

    /// Data-node backend URL (e.g., http://localhost:8200).
    /// Required when --api-enabled=true. NAV is fetched from data-node service.
    #[arg(long, env = "DATA_NODE_URL")]
    pub data_node_url: Option<String>,

    /// ITP ID for data-node NAV lookup (default: 0x...01).
    /// Used with --data-node-url to identify the ITP.
    #[arg(long, default_value = "0x0000000000000000000000000000000000000000000000000000000000000001")]
    pub itp_id: String,

    /// Enable arbitration subsystem
    #[arg(long)]
    pub arbitration_enabled: Option<bool>,

    /// CollateralVault address for arbitration
    #[arg(long)]
    pub arbitration_vault: Option<String>,

    /// ArbitrationSettlement contract address
    #[arg(long)]
    pub arbitration_settlement: Option<String>,

    /// BLS threshold for arbitration (default: 2)
    #[arg(long)]
    pub arbitration_threshold: Option<usize>,

    /// Data-node URL for arbitration price queries
    #[arg(long)]
    pub arbitration_data_node_url: Option<String>,

    // --- Vision subsystem ---
    /// Enable the Vision prediction market subsystem.
    /// When enabled, the tick engine, scheduler, and API routes run alongside ITP consensus.
    #[arg(long)]
    pub vision_enabled: bool,

    /// Vision contract address on L3.
    #[arg(long)]
    pub vision_address: Option<String>,

    /// PostgreSQL connection string for Vision state storage.
    #[arg(long)]
    pub vision_database_url: Option<String>,

    /// Data-node URL for Vision price feeds (defaults to --data-node-url if set).
    #[arg(long)]
    pub vision_data_node_url: Option<String>,

    /// WebSocket RPC URL for Vision chain event subscriptions.
    #[arg(long)]
    pub vision_rpc_ws_url: Option<String>,

    /// Block number to start syncing Vision events from.
    #[arg(long)]
    pub vision_start_block: Option<u64>,

    /// Skip the in-memory bootstrap of all player positions on startup, and
    /// serve authoritative position reads from Postgres on demand. Cuts the
    /// scheduler's steady-state RSS by ~200 MB per 100 k positions. Roll out
    /// one oracle at a time and watch RSS before flipping the rest.
    #[arg(long, env = "ORACLE_LAZY_VISION_STATE")]
    pub lazy_vision_state: bool,

    // vision_reveal_window_secs and vision_tick_poll_interval_ms deleted (round-only purge)

    /// Settlement RPC URL for watching Vision deposit events.
    #[arg(long)]
    pub vision_settlement_rpc_url: Option<String>,

    /// SettlementBridgeCustody contract address on Settlement (for Vision deposits).
    #[arg(long)]
    pub vision_settlement_bridge_custody: Option<String>,

    /// Settlement chain ID (default: 42161).
    #[arg(long)]
    pub vision_settlement_chain_id: Option<u64>,

    /// Bearer token for authenticating data-node HTTP requests.
    /// Used by Vision, Arbitration, and NAV subsystems to authenticate with the data-node.
    #[arg(long, env = "DATA_NODE_TOKEN")]
    pub data_node_token: Option<String>,

    /// ITPNAVOracle contract address on Settlement.
    #[arg(long)]
    pub nav_oracle: Option<String>,

    /// ITP token address for the NAV oracle.
    #[arg(long)]
    pub itp_token: Option<String>,

    /// Path to the consensus Write-Ahead Log file.
    /// Default: ./consensus-{node_id}.wal
    #[arg(long)]
    pub wal_path: Option<PathBuf>,

    /// WAL sync mode: fdatasync, fsync, or none.
    /// Auto-detect: none if cycle < 500ms, fdatasync otherwise.
    #[arg(long)]
    pub wal_sync_mode: Option<String>,

    /// Skip WAL replay on startup.
    #[arg(long)]
    pub skip_wal_replay: bool,

    /// MirrorOracleRegistry contract address on Settlement (Step 12).
    /// When set, the oracle actively syncs L3 registry state to the mirror on Settlement.
    #[arg(long)]
    pub mirror_registry: Option<String>,
}
