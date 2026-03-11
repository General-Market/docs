//! Issuer node binary for Index L3
//!
//! Runs an issuer node that participates in order batching, consensus, and execution.

use clap::Parser;
use issuer::bootstrap::{BootstrapParams, IssuerBootstrap, IssuerComponents, IssuerMetrics};
use issuer::bridge::Fill;
use issuer::p2p::TcpP2PTransport;
use issuer::{
    handle_nav_sign_request, BackendNavCalculator, ConfigBuilder,
    NavCalculator, NavSignHandler, PriceFetcher,
    RegistrySyncCache, RegistrySyncConfig, RegistrySyncHandler, StubItpRegistryReader,
    MIN_CYCLE_DURATION_MS,
};
use issuer::arbitration::{self, ArbitrationSubsystem};
use issuer::arbitration::types::ArbitrationConfig;
use common::types::P2PMessage;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::signal;
use tracing::{debug, info, warn, error};
use chrono::Utc;

/// Index L3 Issuer Node
///
/// Participates in order batching, BLS consensus, and trade execution.
///
/// Configuration priority: CLI args > Environment variables > Config file > Defaults
#[derive(Parser, Debug)]
#[command(name = "issuer")]
#[command(author = "Index Team")]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(about = "Index L3 Issuer Node - participates in consensus and order execution")]
#[command(long_about = None)]
struct Args {
    /// Issuer node ID (1-20). Can also be set via ISSUER_NODE_ID env var or config file.
    #[arg(long)]
    node_id: Option<u32>,

    /// P2P listen port (default: 9000 + node_id). Can also be set via ISSUER_PORT env var.
    #[arg(long)]
    port: Option<u16>,

    /// Chain RPC endpoint. Can also be set via ISSUER_RPC_URL env var.
    #[arg(long)]
    rpc: Option<String>,

    /// Path to configuration file (YAML format)
    #[arg(long)]
    config: Option<PathBuf>,

    /// Log level (trace, debug, info, warn, error). Can also be set via ISSUER_LOG_LEVEL env var.
    #[arg(long)]
    log_level: Option<String>,

    /// Log output directory. Can also be set via ISSUER_LOG_DIR env var.
    #[arg(long)]
    log_dir: Option<PathBuf>,

    /// Output logs as JSON. Can also be set via ISSUER_JSON_LOGS env var.
    #[arg(long)]
    json_logs: bool,

    /// Path to BLS key file. Can also be set via ISSUER_BLS_KEY_PATH env var.
    #[arg(long)]
    bls_key_path: Option<PathBuf>,

    /// Peer addresses to connect to (can be specified multiple times).
    /// Format: "ip:port". Can also be set via ISSUER_PEERS env var (comma-separated).
    #[arg(long = "peer", value_name = "ADDRESS")]
    peers: Vec<String>,

    /// Cycle duration in milliseconds (default: 1000ms for 1-second cycles).
    /// Acts as the heartbeat interval in demand-driven mode.
    #[arg(long, default_value = "1000")]
    cycle_duration_ms: u64,

    /// Minimum gap between fast (work-driven) cycles in milliseconds.
    /// Only applies when there's pending work (bridge orders in flight).
    #[arg(long, default_value = "50")]
    min_cycle_gap_ms: u64,

    /// BLS sign timeout for consensus rounds in milliseconds (default: 500).
    /// All issuers are co-located on the same VPS (~1ms P2P latency), so 500ms is generous.
    #[arg(long, default_value = "500")]
    sign_timeout_ms: u64,

    /// Disable TLS for P2P connections (development only)
    #[arg(long)]
    no_tls: bool,

    /// Maximum connections allowed from a single IP address (default: 2).
    /// Set to 0 for unlimited. Loopback IPs (127.x.x.x) are always exempt.
    #[arg(long, default_value = "2")]
    p2p_max_per_ip: usize,

    /// Rate limit: messages per second per peer connection (default: 100).
    #[arg(long, default_value = "100")]
    p2p_rate_limit: f64,

    /// Rate burst: maximum burst size / token bucket capacity (default: 100).
    #[arg(long, default_value = "100")]
    p2p_rate_burst: f64,

    /// Use mock chain reader/writer instead of real RPC connections (development mode)
    #[arg(long)]
    mock: bool,

    /// Path to deployment JSON file containing contract addresses.
    #[arg(long)]
    deployment_file: Option<PathBuf>,

    /// Start state reconstruction from specific block number (ignores checkpoint)
    #[arg(long)]
    from_block: Option<u64>,

    /// Maximum gas limit for transactions (default: 15M for large ITP operations).
    #[arg(long, default_value = "15000000")]
    max_gas_limit: u64,

    /// Receipt wait timeout in seconds (default: 30, increase for heavy L3 load).
    #[arg(long, default_value = "30")]
    receipt_timeout_secs: u64,

    /// Consensus timeout total in milliseconds (default: 800, must be < cycle_duration_ms).
    #[arg(long)]
    consensus_timeout_ms: Option<u64>,

    /// Path to checkpoint file for faster restart
    #[arg(long, default_value = "./checkpoint.json")]
    checkpoint_path: String,

    /// Skip state reconstruction (start with empty state, for testing)
    #[arg(long)]
    skip_reconstruction: bool,

    /// Signature threshold for BLS consensus (default: auto-calculate from issuer count).
    #[arg(long)]
    signature_threshold: Option<usize>,

    /// Number of issuers in the network (default: 3).
    #[arg(long, default_value = "3")]
    num_issuers: u8,

    /// Generate deterministic BLS key from seed [N, 0x42, 0, ...] (for testing).
    #[arg(long)]
    bls_key_seed_index: Option<u8>,

    /// Override the on-chain issuer ID used in signerBitmap (for testing).
    #[arg(long)]
    on_chain_issuer_id: Option<u8>,

    /// Build InMemoryKeyRegistry from deterministic seeds for all num_issuers nodes.
    #[arg(long)]
    test_key_seeds: bool,

    /// Offset for peer_ids in the test key registry.
    #[arg(long, default_value = "0")]
    key_registry_offset: u8,

    /// MockBitgetVault contract address for on-chain fill verification (E2E testing).
    #[arg(long)]
    bitget_vault: Option<String>,

    /// BridgeProxy contract address for watching ITP creation requests.
    #[arg(long)]
    bridge_proxy: Option<String>,

    /// Path to custom symbol map JSON file for asset-to-Bitget-symbol mappings.
    #[arg(long)]
    symbol_map_file: Option<PathBuf>,

    /// Override expected chain ID (default: 111222333 for Index L3).
    #[arg(long)]
    chain_id: Option<u64>,

    /// IssuerCustody L3 contract address (Story 7.7).
    #[arg(long)]
    issuer_custody_l3: Option<String>,

    /// IssuerCustody Settlement contract address (Story 7.7).
    #[arg(long)]
    issuer_custody_settlement: Option<String>,

    /// SettlementBridgeCustody contract address (Story 7.8).
    #[arg(long)]
    settlement_custody: Option<String>,

    /// Enable the NAV signing API endpoint (GET /api/nav-sign).
    /// The endpoint returns BLS-signed NAV prices for ITPs (Story 8.3).
    #[arg(long, default_value = "true")]
    api_enabled: bool,

    /// Starting cycle number for on-chain submissions.
    /// Use this to avoid E019_CycleAlreadyProcessed errors when cycles were
    /// already used during manual testing. Defaults to 0 if not specified.
    /// Recommended: use a high value like 10000000 for fresh deployments.
    #[arg(long)]
    start_cycle: Option<u64>,

    /// NTP server address for time synchronization (default: pool.ntp.org).
    /// Set to empty string to disable NTP sync.
    #[arg(long, default_value = "pool.ntp.org")]
    ntp_server: String,

    /// Enable the registry sync endpoint (GET /api/registry-sync).
    /// When enabled, the issuer watches for RegistryStateChanged events from L3 IssuerRegistry
    /// and serves BLS-signed registry state proofs for MirrorIssuerRegistry sync on Settlement.
    /// (Story 8.4, Task 7.1)
    #[arg(long)]
    registry_sync: bool,

    /// MockUSDT token contract address for USDT-pair fill verification (Story 7.18).
    /// When set, issuer fill verification accepts this address as a valid USDT token.
    #[arg(long)]
    mock_usdt: Option<String>,

    /// Override asset count for bootstrap (used when on-chain assetCount() returns 0
    /// because setPriceAdmin hasn't been called yet). Prices will be fetched from
    /// Bitget instead of on-chain.
    #[arg(long)]
    asset_count: Option<u64>,

    /// Data-node backend URL (e.g., http://localhost:8200).
    /// Required when --api-enabled=true. NAV is fetched from data-node service.
    #[arg(long, env = "DATA_NODE_URL")]
    data_node_url: Option<String>,

    /// ITP ID for data-node NAV lookup (default: 0x...01).
    /// Used with --data-node-url to identify the ITP.
    #[arg(long, default_value = "0x0000000000000000000000000000000000000000000000000000000000000001")]
    itp_id: String,

    /// Enable arbitration subsystem
    #[arg(long)]
    arbitration_enabled: Option<bool>,

    /// CollateralVault address for arbitration
    #[arg(long)]
    arbitration_vault: Option<String>,

    /// ArbitrationSettlement contract address
    #[arg(long)]
    arbitration_settlement: Option<String>,

    /// BLS threshold for arbitration (default: 2)
    #[arg(long)]
    arbitration_threshold: Option<usize>,

    /// Data-node URL for arbitration price queries
    #[arg(long)]
    arbitration_data_node_url: Option<String>,

    // --- Vision subsystem ---
    /// Enable the Vision prediction market subsystem.
    /// When enabled, the tick engine, scheduler, and API routes run alongside ITP consensus.
    #[arg(long)]
    vision_enabled: bool,

    /// Vision contract address on L3.
    #[arg(long)]
    vision_address: Option<String>,

    /// PostgreSQL connection string for Vision state storage.
    #[arg(long)]
    vision_database_url: Option<String>,

    /// Data-node URL for Vision price feeds (defaults to --data-node-url if set).
    #[arg(long)]
    vision_data_node_url: Option<String>,

    /// WebSocket RPC URL for Vision chain event subscriptions.
    #[arg(long)]
    vision_rpc_ws_url: Option<String>,

    /// Block number to start syncing Vision events from.
    #[arg(long)]
    vision_start_block: Option<u64>,

    /// Reveal window in seconds for Vision bitmap commits (default: 600).
    #[arg(long)]
    vision_reveal_window_secs: Option<u64>,

    /// Tick poll interval in milliseconds for Vision engine (default: 1000).
    #[arg(long)]
    vision_tick_poll_interval_ms: Option<u64>,

    /// Settlement RPC URL for watching Vision deposit events.
    #[arg(long)]
    vision_settlement_rpc_url: Option<String>,

    /// SettlementBridgeCustody contract address on Settlement (for Vision deposits).
    #[arg(long)]
    vision_settlement_bridge_custody: Option<String>,

    /// Settlement chain ID (default: 42161).
    #[arg(long)]
    vision_settlement_chain_id: Option<u64>,

    /// Bearer token for authenticating data-node HTTP requests.
    /// Used by Vision, Arbitration, and NAV subsystems to authenticate with the data-node.
    #[arg(long, env = "DATA_NODE_TOKEN")]
    data_node_token: Option<String>,

    /// ITPNAVOracle contract address on Settlement.
    #[arg(long)]
    nav_oracle: Option<String>,

    /// ITP token address for the NAV oracle.
    #[arg(long)]
    itp_token: Option<String>,

    /// Path to the consensus Write-Ahead Log file.
    /// Default: ./consensus-{node_id}.wal
    #[arg(long)]
    wal_path: Option<PathBuf>,

    /// WAL sync mode: fdatasync, fsync, or none.
    /// Auto-detect: none if cycle < 500ms, fdatasync otherwise.
    #[arg(long)]
    wal_sync_mode: Option<String>,

    /// Skip WAL replay on startup.
    #[arg(long)]
    skip_wal_replay: bool,

    /// MirrorIssuerRegistry contract address on Settlement (Step 12).
    /// When set, the issuer actively syncs L3 registry state to the mirror on Settlement.
    #[arg(long)]
    mirror_registry: Option<String>,
}

fn setup_logging(config: &issuer::IssuerConfig) -> Result<(), Box<dyn std::error::Error>> {
    let node_id = config.node_id.unwrap_or(0);
    let log_config = common::logging::LogConfig {
        level: config.effective_log_level(),
        dir: config.effective_log_dir(),
        json_enabled: config.effective_json_logs(),
        component_name: format!("issuer-{}", node_id),
        node_id: config.node_id,
    };
    common::logging::init_logging(&log_config)
}

/// Type alias for the NAV sign handler used in the issuer node
type IssuerNavSignHandler = NavSignHandler<Box<dyn NavCalculator>, StubItpRegistryReader>;

/// Shared state for the issuer HTTP API (health, nav-sign, registry-sync, ready).
/// All issuer endpoints and optional Vision endpoints share one axum server.
struct IssuerApiState {
    node_id: u32,
    p2p_transport: Option<Arc<TcpP2PTransport>>,
    metrics: Arc<IssuerMetrics>,
    p2p_metrics: Arc<issuer::p2p::P2PMetrics>,
    registry_sync_cache: Option<RegistrySyncCache>,
    nav_sign_handler: Option<Arc<IssuerNavSignHandler>>,
    /// Number of issuers in the network (for threshold computation)
    num_issuers: u8,
    /// Whether this node has a BLS keypair loaded
    bls_keypair_loaded: bool,
    /// Epoch-millis timestamp of last successful RPC call (updated by consensus loop)
    last_rpc_success_ms: Arc<std::sync::atomic::AtomicU64>,
}

/// GET /health — issuer health check with metrics
async fn axum_health_handler(
    axum::extract::State(state): axum::extract::State<Arc<IssuerApiState>>,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;

    let (p2p_mode, connected_peers) = if let Some(ref transport) = state.p2p_transport {
        let count = transport.connected_peer_count().await;
        ("tcp", count)
    } else {
        ("mock", 0)
    };

    let m = &state.metrics;
    let is_leader = m.is_leader.load(Ordering::Relaxed);
    let elections_count = m.elections_count.load(Ordering::Relaxed);
    let tenure_cycles = m.tenure_cycles.load(Ordering::Relaxed);
    let consensus_rounds = m.consensus_rounds_total.load(Ordering::Relaxed);
    let consensus_success = m.consensus_success_total.load(Ordering::Relaxed);
    let consensus_failed = m.consensus_failed_total.load(Ordering::Relaxed);
    let signatures_collected = m.signatures_collected_total.load(Ordering::Relaxed);
    let last_consensus_ms = m.last_consensus_time_ms.load(Ordering::Relaxed);
    let consensus_in_progress = m.consensus_in_progress.load(Ordering::Relaxed);

    let mut heartbeat = serde_json::Map::new();
    if let Ok(guard) = m.heartbeat_metrics.read() {
        if let Some(ref hb) = *guard {
            heartbeat.insert("sent_total".into(), hb.get_heartbeats_sent().into());
            heartbeat.insert("received_total".into(), hb.get_heartbeats_received().into());
            heartbeat.insert("peers_healthy".into(), hb.get_peers_healthy().into());
            heartbeat.insert("peers_unhealthy".into(), hb.get_peers_unhealthy().into());
            heartbeat.insert("kick_proposals".into(), hb.get_kick_votes_proposed().into());
        }
    }

    let (health_status, http_status) = m.health_status(connected_peers);
    let last_cycle_duration_ms = m.last_cycle_duration_ms.load(Ordering::Relaxed);
    let orders_processed = m.orders_processed_last_60s.load(Ordering::Relaxed);
    let pending_orders = m.pending_order_count.load(Ordering::Relaxed);

    let mut body = serde_json::json!({
        "status": health_status,
        "node_id": state.node_id,
        "p2p_mode": p2p_mode,
        "connected_peers": connected_peers,
        "is_leader": is_leader,
        "leader_elections_count": elections_count,
        "leader_tenure_cycles": tenure_cycles,
        "consensus": {
            "rounds_total": consensus_rounds,
            "success_total": consensus_success,
            "failed_total": consensus_failed,
            "signatures_collected": signatures_collected,
            "last_time_ms": last_consensus_ms,
            "in_progress": consensus_in_progress,
        },
        "orders_processed_last_60s": orders_processed,
        "last_cycle_duration_ms": last_cycle_duration_ms,
        "pending_order_count": pending_orders,
        "timestamp": Utc::now().to_rfc3339(),
    });
    if !heartbeat.is_empty() {
        body.as_object_mut().unwrap().insert("heartbeat".into(), serde_json::Value::Object(heartbeat));
    }

    // P2P subsystem metrics (rate limiting, bans, WAL, equivocations, etc.)
    let p2p_snap = state.p2p_metrics.snapshot();
    body.as_object_mut().unwrap().insert(
        "p2p".into(),
        serde_json::to_value(&p2p_snap).unwrap_or_default(),
    );

    let status = if http_status == 200 { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    (status, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
}

/// GET /ready — readiness check for deployment orchestration
///
/// Returns 200 OK if the node can participate in consensus (if unpaused):
/// - Enough peers connected (>= threshold - 1)
/// - BLS keypair loaded
/// - Chain reader operational (last RPC success < 30s ago)
/// - Registry sync caught up (if enabled)
///
/// Returns 503 with JSON body indicating which checks failed.
/// Does NOT check consensusPaused — that is intentional to avoid deadlocking
/// the deployment ceremony (step 7 waits for /ready, step 8 unpauses).
async fn axum_ready_handler(
    axum::extract::State(state): axum::extract::State<Arc<IssuerApiState>>,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;

    let threshold = issuer::consensus::aggregator::compute_threshold(state.num_issuers as usize);
    let required_peers = if threshold > 0 { threshold - 1 } else { 0 };

    // Check 1: peer count
    let connected_peers = if let Some(ref transport) = state.p2p_transport {
        transport.connected_peer_count().await
    } else {
        0
    };
    let peers_ok = connected_peers >= required_peers;

    // Check 2: BLS keypair
    let bls_ok = state.bls_keypair_loaded;

    // Check 3: chain reader (last RPC success < 30s ago)
    let last_rpc_epoch_ms = state.last_rpc_success_ms.load(Ordering::Relaxed);
    let now_epoch_ms = Utc::now().timestamp_millis() as u64;
    let last_success_ms_ago = if last_rpc_epoch_ms > 0 {
        now_epoch_ms.saturating_sub(last_rpc_epoch_ms)
    } else {
        u64::MAX // never succeeded
    };
    let chain_reader_ok = last_success_ms_ago < 30_000;

    // Check 4: registry sync (if enabled)
    let (registry_ok, registry_caught_up) = if let Some(ref cache) = state.registry_sync_cache {
        let guard = cache.read().await;
        if guard.is_some() {
            (true, true)
        } else {
            (false, false)
        }
    } else {
        // Registry sync not enabled — pass the check (single-issuer or not configured)
        (true, true)
    };

    let all_ok = peers_ok && bls_ok && chain_reader_ok && registry_ok;
    let status_code = if all_ok { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };

    let body = serde_json::json!({
        "ready": all_ok,
        "checks": {
            "peers": {
                "ok": peers_ok,
                "connected": connected_peers,
                "required": required_peers,
            },
            "bls_keypair": {
                "ok": bls_ok,
            },
            "chain_reader": {
                "ok": chain_reader_ok,
                "last_success_ms_ago": if last_rpc_epoch_ms > 0 { last_success_ms_ago } else { 0 },
            },
            "registry_sync": {
                "ok": registry_ok,
                "caught_up": registry_caught_up,
            },
        }
    });

    (status_code, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
}

/// GET /api/nav-sign — BLS-signed NAV price for an ITP
async fn axum_nav_sign_handler(
    axum::extract::State(state): axum::extract::State<Arc<IssuerApiState>>,
    axum::extract::RawQuery(query): axum::extract::RawQuery,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;

    let Some(ref handler) = state.nav_sign_handler else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            [(header::CONTENT_TYPE, "application/json")],
            r#"{"error":"NAV sign API not enabled"}"#.to_string(),
        ).into_response();
    };

    let query_str = query.as_deref().unwrap_or("");
    let (status, content_type, body) = handle_nav_sign_request(handler.as_ref(), query_str).await;
    let sc = StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    (sc, [(header::CONTENT_TYPE, content_type)], body).into_response()
}

/// GET /api/registry-sync — registry sync state
async fn axum_registry_sync_handler(
    axum::extract::State(state): axum::extract::State<Arc<IssuerApiState>>,
) -> axum::response::Response {
    use axum::http::{header, StatusCode};
    use axum::response::IntoResponse;

    let Some(ref cache) = state.registry_sync_cache else {
        return (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "application/json")],
            r#"{"error":"Registry sync not enabled"}"#.to_string(),
        ).into_response();
    };

    let guard = cache.read().await;
    if let Some(ref sync_state) = *guard {
        let json = sync_state.to_json_response();
        (StatusCode::OK, [(header::CONTENT_TYPE, "application/json")], json.to_string()).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            [(header::CONTENT_TYPE, "application/json")],
            r#"{"error":"No sync data available"}"#.to_string(),
        ).into_response()
    }
}

/// GET / — alias for health check
async fn axum_root_health_handler(
    state: axum::extract::State<Arc<IssuerApiState>>,
) -> axum::response::Response {
    axum_health_handler(state).await
}

/// Build the core issuer API router (health, ready, nav-sign, registry-sync).
fn issuer_api_routes(state: Arc<IssuerApiState>) -> axum::Router {
    axum::Router::new()
        .route("/health", axum::routing::get(axum_health_handler))
        .route("/ready", axum::routing::get(axum_ready_handler))
        .route("/", axum::routing::get(axum_root_health_handler))
        .route("/api/nav-sign", axum::routing::get(axum_nav_sign_handler))
        .route("/api/registry-sync", axum::routing::get(axum_registry_sync_handler))
        .with_state(state)
}

async fn run_main_loop(mut components: IssuerComponents, api_enabled: bool, data_node_url: Option<String>, itp_id: String, mock_usdt_addr: Option<ethers::types::Address>, vision_router: Option<axum::Router>, nav_oracle_address: Option<ethers::types::Address>, itp_token_address: Option<ethers::types::Address>, settlement_chain_id: Option<u64>, mirror_registry_address: Option<ethers::types::Address>, issuer_registry_address_for_sync: Option<ethers::types::Address>) -> Result<(), Box<dyn std::error::Error>> {
    let node_id = components.node_id;
    let shutdown = components.shutdown.clone();

    // Bind HTTP API listener (health + nav-sign + registry-sync + optional Vision)
    let listener = TcpListener::bind(format!("0.0.0.0:{}", components.p2p.health_port)).await?;
    info!(node_id, health_port = components.p2p.health_port, "HTTP API listening");

    info!(node_id, "Issuer node initialized, entering main loop");

    // Create work signal channel for demand-driven cycling
    let (work_tx, work_rx) = tokio::sync::mpsc::channel::<bool>(1);
    components.consensus.cycle_manager = components.consensus.cycle_manager.with_work_channel(work_rx);

    // Get cycle state receiver
    let cycle_state_rx = components.consensus.cycle_manager.subscribe();

    // Spawn P2P message router when ConsensusProtocol exists
    let router_handle: Option<tokio::task::JoinHandle<()>> = if let (Some(protocol), Some(p2p)) =
        (&components.consensus.protocol, &components.p2p.transport)
    {
        let router_protocol = Arc::clone(protocol);
        let router_p2p = Arc::clone(p2p);
        let router_heartbeat_monitor = components.p2p.heartbeat_monitor.clone();
        Some(tokio::spawn(async move {
            use common::traits::P2PTransport;
            match router_p2p.receive().await {
                Ok(stream) => {
                    use futures::StreamExt;
                    tokio::pin!(stream);
                    while let Some(Ok((from, message))) = stream.next().await {
                        if let P2PMessage::Heartbeat { sender_id, timestamp } = &message {
                            if let Some(ref monitor) = router_heartbeat_monitor {
                                monitor.on_heartbeat_received(*sender_id, *timestamp).await;
                            }
                            continue;
                        }
                        if let Err(e) = router_protocol.handle_message(from, message).await {
                            warn!(error = %e, "Error handling P2P consensus message");
                        }
                    }
                }
                Err(e) => {
                    error!(error = %e, "Failed to start P2P message receiver");
                }
            }
        }))
    } else {
        None
    };

    // Shared readiness state for /ready endpoint
    let last_rpc_success_ms = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let last_rpc_success_ms_for_task = last_rpc_success_ms.clone();
    let num_issuers = components.consensus.config.num_issuers;
    let bls_keypair_loaded = components.consensus.keys.bls_keypair.is_some();

    // Spawn consensus coordination task
    let consensus_shutdown = shutdown.clone();
    let consensus_metrics = components.consensus.metrics.clone();
    let consensus_chain_reader = components.chain.reader.clone();
    let consensus_chain_writer_for_task = components.chain.writer.clone();
    let has_bls_keypair = components.consensus.keys.bls_keypair.is_some();
    let consensus_protocol_for_task = components.consensus.protocol.clone();
    let settlement_reader_for_task = components.chain.settlement_reader.clone();
    let settlement_writer_for_task = components.chain.settlement_writer.clone();
    let itp_creation_config_for_task = components.consensus.itp_creation_config.clone();
    let bridge_orchestrator_for_task = components.consensus.bridge_orchestrator.clone();

    // Initialize BLSCustody nonce from on-chain state on startup
    if let Some(ref orchestrator) = bridge_orchestrator_for_task {
        let orch = orchestrator.read().await;
        let custody_addr = orch.config().issuer_custody_l3;
        drop(orch);
        if !custody_addr.is_zero() {
            let l3_rpc = components.chain.rpc_url.clone();
            if let Ok(provider) = ethers::providers::Provider::<ethers::providers::Http>::try_from(l3_rpc.as_str()) {
                use ethers::providers::Middleware;
                let nonce_selector = &ethers::utils::keccak256("nonce()")[..4];
                let tx = ethers::types::TransactionRequest::new()
                    .to(custody_addr)
                    .data(nonce_selector.to_vec());
                match provider.call(&tx.into(), None).await {
                    Ok(data) if data.len() >= 32 => {
                        let nonce = ethers::types::U256::from_big_endian(&data);
                        orchestrator.write().await.init_custody_nonce(custody_addr, nonce).await;
                    }
                    Ok(_) => warn!("Unexpected nonce() response length"),
                    Err(e) => warn!(error = %e, "Failed to read custody nonce on startup"),
                }
            }
        }
    }

    let node_index_for_task = components.consensus.keys.node_index;
    let consensus_config = components.consensus.config.clone();
    let price_fetcher_for_task: Arc<dyn PriceFetcher> = components.price.fetcher.clone();
    let known_asset_addresses: Vec<ethers::types::Address> = components.price.symbol_map.assets().copied().collect();
    let symbol_map_for_task = components.price.symbol_map.clone();
    let data_node_url_for_task = data_node_url.clone();
    let itp_id_for_task = itp_id.clone();
    let nav_oracle_address_for_task = nav_oracle_address;
    let itp_token_address_for_task = itp_token_address;
    let settlement_chain_id_for_task = settlement_chain_id;
    let l3_chain_id_for_task = components.target_chain_id;
    let mirror_registry_for_task = mirror_registry_address;
    let issuer_registry_for_sync_task = issuer_registry_address_for_sync;
    let work_tx_for_task = work_tx;

    // Build quote_tokens map: asset address → quote token address (USDC or USDT)
    // Issuer determines which quote token each asset trades against based on Bitget pair suffix
    let quote_tokens_for_task: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>> = {
        if let Some(usdt_addr) = mock_usdt_addr {
            let mut qt_map = std::collections::HashMap::new();
            for asset in components.price.symbol_map.assets() {
                if let Some(symbol) = components.price.symbol_map.get_symbol(asset) {
                    if !symbol.ends_with("USDC") {
                        // USDT (default for Bitget) or other → use USDT
                        qt_map.insert(*asset, usdt_addr);
                    }
                    // USDC pairs: don't insert → defaults to Address::zero() (= use default USDC)
                }
            }
            if !qt_map.is_empty() {
                info!(usdt_pairs = qt_map.len(), "Built quote_tokens map for USDT pair settlement");
                Some(qt_map)
            } else {
                None
            }
        } else {
            None
        }
    };

    /// Drop guard that resets an AtomicBool flag when the task completes or panics.
    /// Prevents permanent task starvation if a spawned task panics.
    struct FlagGuard(Arc<AtomicBool>);
    impl Drop for FlagGuard {
        fn drop(&mut self) {
            self.0.store(false, Ordering::Release);
        }
    }

    // Continuous NAV computation — background task computes from on-chain inventory + Bitget prices
    // every 200ms. All consumers read from the watch channel instead of computing inline or HTTP fetching.
    let (nav_tx, nav_rx) = tokio::sync::watch::channel(ethers::types::U256::exp10(18));
    {
        let nav_chain_reader = consensus_chain_reader.clone();
        let nav_price_fetcher = price_fetcher_for_task.clone();
        let nav_itp_id = itp_id_for_task.clone();
        let nav_shutdown = shutdown.clone();
        tokio::spawn(async move {
            loop {
                if nav_shutdown.load(Ordering::Relaxed) { break; }
                let nav = compute_nav(&nav_chain_reader, &nav_price_fetcher, &nav_itp_id).await;
                let _ = nav_tx.send(nav);
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            }
        });
    }

    // Channel for price task result reporting (success/failure tracking)
    let (price_result_tx, mut price_result_rx) = tokio::sync::mpsc::channel::<bool>(4);

    // Startup: scan ALL Settlement orders by ID (non-blocking background task)
    let startup_buy_orders: Arc<tokio::sync::Mutex<Vec<common::types::CrossChainOrder>>> =
        Arc::new(tokio::sync::Mutex::new(Vec::new()));
    let startup_sell_orders: Arc<tokio::sync::Mutex<Vec<common::types::CrossChainSellOrderEvent>>> =
        Arc::new(tokio::sync::Mutex::new(Vec::new()));

    // Spawn as background task so main loop starts immediately
    if let Some(ref settlement_reader) = settlement_reader_for_task {
        let sr = settlement_reader.clone();
        let buy_arc = startup_buy_orders.clone();
        let sell_arc = startup_sell_orders.clone();
        let stagger_secs = (node_id - 1) as u64 * 5; // node 1: 0s, node 2: 5s, node 3: 10s
        tokio::spawn(async move {
            if stagger_secs > 0 {
                info!(stagger_secs, "Staggering startup ID scan to avoid RPC rate limits");
                tokio::time::sleep(std::time::Duration::from_secs(stagger_secs)).await;
            }
            match sr.get_all_unfilled_orders().await {
                Ok((buys, sells)) => {
                    if !buys.is_empty() || !sells.is_empty() {
                        info!(buys = buys.len(), sells = sells.len(),
                            "Startup ID scan complete: found unfilled Settlement orders");
                        *buy_arc.lock().await = buys;
                        *sell_arc.lock().await = sells;
                    } else {
                        info!("Startup ID scan complete: no unfilled orders found");
                    }
                }
                Err(e) => warn!(error = %e, "Startup Settlement ID scan failed, falling back to event scan"),
            }
        });
    }
    // Main loop starts immediately — doesn't wait for scan to complete

    let consensus_handle = tokio::spawn(async move {
        let mut state_rx = cycle_state_rx;
        let mut last_cycle: u64 = 0;
        let first_seen_orders: Arc<tokio::sync::Mutex<HashMap<u64, std::time::Instant>>> = Arc::new(tokio::sync::Mutex::new(HashMap::new()));
        let itp_first_seen: Arc<tokio::sync::Mutex<std::collections::HashMap<ethers::types::U256, std::time::Instant>>> = Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new()));

        // In-flight guards: prevent duplicate spawns of the same processing phase
        let price_active = Arc::new(AtomicBool::new(false));
        let buy_active = Arc::new(AtomicBool::new(false));
        let bridge_buy_post_active = Arc::new(AtomicBool::new(false));
        let sell_active = Arc::new(AtomicBool::new(false));
        let l3_active = Arc::new(AtomicBool::new(false));
        let itp_active = Arc::new(AtomicBool::new(false));
        let rebalance_active = Arc::new(AtomicBool::new(false));
        let mirror_sync_active = Arc::new(AtomicBool::new(false));

        // Consecutive price failure counter (circuit breaker)
        let mut consecutive_price_failures: u32 = 0;

        // Throttle settlement calls — poll every 100ms (near-instant bridge detection)
        let mut last_settlement_poll = std::time::Instant::now() - std::time::Duration::from_secs(10);
        // Track last scanned settlement block to avoid re-scanning 10k blocks every poll
        let settlement_buy_cursor: Arc<std::sync::atomic::AtomicU64> = Arc::new(std::sync::atomic::AtomicU64::new(0));
        let settlement_sell_cursor: Arc<std::sync::atomic::AtomicU64> = Arc::new(std::sync::atomic::AtomicU64::new(0));
        // Grace period: skip bridge processing until P2P mesh is likely established
        let bridge_ready_after = std::time::Instant::now() + std::time::Duration::from_secs(15);
        // One-time: recover pending mints (CBO'd but not yet minted) on startup
        let pending_mint_recovery_done = Arc::new(AtomicBool::new(false));

        loop {
            if consensus_shutdown.load(Ordering::Relaxed) {
                info!("Consensus task shutting down");
                break;
            }

            if state_rx.changed().await.is_err() {
                break;
            }

            let state = state_rx.borrow().clone();
            let current_cycle = state.get_current_cycle();
            let is_heartbeat = state.is_heartbeat();
            let trigger = state.get_trigger();

            if current_cycle > last_cycle {
                last_cycle = current_cycle;
                info!(cycle = current_cycle, trigger = ?trigger, "Entering consensus cycle");

                // Phase -1a: On-chain consensus pause check (fail-safe: treat RPC errors as paused)
                // Use timeout to prevent main loop from blocking on hung RPC
                match tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    consensus_chain_reader.is_consensus_paused()
                ).await {
                    Ok(Ok(true)) => {
                        warn!(cycle = current_cycle, "Consensus paused on-chain, skipping cycle");
                        continue;
                    }
                    Ok(Err(e)) => {
                        error!(cycle = current_cycle, error = %e,
                            "Failed to check consensusPaused, treating as paused (fail-safe)");
                        continue;
                    }
                    Err(_) => {
                        warn!(cycle = current_cycle, "consensusPaused check timed out (5s), skipping cycle");
                        continue;
                    }
                    Ok(Ok(false)) => {} // proceed normally
                }

                let start_time = std::time::Instant::now();

                if let Some(ref protocol) = consensus_protocol_for_task {

                    // Read cached NAV from background computation task (updated every 200ms)
                    let local_nav_fallback = *nav_rx.borrow();

                    // Price update — spawn if not already running
                    if !price_active.load(Ordering::Acquire) {
                        price_active.store(true, Ordering::Release);
                        let flag = price_active.clone();
                        let p = protocol.clone();
                        let pf = price_fetcher_for_task.clone();
                        let cr = consensus_chain_reader.clone();
                        let l3w: Option<Arc<dyn common::traits::ChainWriter>> = consensus_chain_writer_for_task.clone().map(|w| w as Arc<dyn common::traits::ChainWriter>);
                        let oracle_addr = nav_oracle_address_for_task;
                        let itp_addr = itp_token_address_for_task;
                        // NavOracle is on L3 — use L3 chain ID for hash (block.chainid in Solidity)
                        let cid = if oracle_addr.is_some() { Some(l3_chain_id_for_task) } else { settlement_chain_id_for_task };
                        let addrs = known_asset_addresses.clone();
                        let cycle = current_cycle;
                        let metrics = consensus_metrics.clone();
                        let rpc_ts = last_rpc_success_ms_for_task.clone();
                        let ptx = price_result_tx.clone();
                        let nav = local_nav_fallback;
                        tokio::spawn(async move {
                            let _guard = FlagGuard(flag);
                            let success = run_price_update(p, pf, cr, l3w, oracle_addr, itp_addr, cid, addrs, cycle, metrics, rpc_ts, nav).await;
                            let _ = ptx.send(success).await;
                        });
                    }

                    // Settlement tasks — poll every 1s for bridge detection
                    // Skip bridge processing during P2P startup grace period (15s)
                    let bridge_ready = std::time::Instant::now() >= bridge_ready_after;
                    let settlement_poll_due = bridge_ready && last_settlement_poll.elapsed() >= std::time::Duration::from_secs(1);
                    if settlement_poll_due {
                        last_settlement_poll = std::time::Instant::now();
                    }

                    // ITP creation — spawn if not already running (throttled)
                    if settlement_poll_due && !itp_active.load(Ordering::Acquire) {
                        if let (Some(ref settlement_reader), Some(ref settlement_writer), Some(ref itp_config)) =
                            (&settlement_reader_for_task, &settlement_writer_for_task, &itp_creation_config_for_task)
                        {
                            itp_active.store(true, Ordering::Release);
                            let flag = itp_active.clone();
                            let p = protocol.clone();
                            let ar = Arc::clone(settlement_reader);
                            let aw = Arc::clone(settlement_writer);
                            let cw = consensus_chain_writer_for_task.clone();
                            let ic = itp_config.clone();
                            let fs = itp_first_seen.clone();
                            let cycle = current_cycle;
                            let ni = node_index_for_task;
                            let nu = consensus_config.num_issuers;
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                run_itp_creation_phase(p, ar, aw, cw, ic, cycle, ni, nu, fs).await;
                            });
                        }
                    }

                    // Cross-chain BUY — detect + bridge + submit + immediate batch/fills/mint (merged pipeline)
                    if settlement_poll_due && !buy_active.load(Ordering::Acquire) {
                        if let (Some(ref settlement_reader), Some(ref orchestrator), Some(ref settlement_writer)) =
                            (&settlement_reader_for_task, &bridge_orchestrator_for_task, &settlement_writer_for_task)
                        {
                            buy_active.store(true, Ordering::Release);
                            let flag = buy_active.clone();
                            let p = protocol.clone();
                            let ar = Arc::clone(settlement_reader);
                            let orch = Arc::clone(orchestrator);
                            let aw = Arc::clone(settlement_writer);
                            let cr = consensus_chain_reader.clone();
                            let dnu = data_node_url_for_task.clone();
                            let iid = itp_id_for_task.clone();
                            let nav = local_nav_fallback;
                            let qt = quote_tokens_for_task.clone();
                            let cycle = current_cycle;
                            let ni = node_index_for_task;
                            let nu = consensus_config.num_issuers;
                            let cursor = settlement_buy_cursor.clone();
                            let bpr = Arc::new(AtomicBool::new(false)); // unused, kept for fn sig
                            let sbo = startup_buy_orders.clone();
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                run_cross_chain_processing(
                                    p, ar, orch, aw, cr, cycle, ni, nu, dnu, iid, nav, qt, cursor, bpr, sbo,
                                ).await;
                            });
                        }
                    }

                    // Cross-chain BUY post-processing (RECOVERY) — picks up orders stuck at SubmittedOnL3
                    // (e.g., node crashed between submit and batch). Normally finds nothing because
                    // Phase 1 now handles batch/fills/mint inline.
                    if settlement_poll_due && !bridge_buy_post_active.load(Ordering::Acquire) {
                        if let (Some(ref settlement_reader), Some(ref orchestrator), Some(ref settlement_writer)) =
                            (&settlement_reader_for_task, &bridge_orchestrator_for_task, &settlement_writer_for_task)
                        {
                            bridge_buy_post_active.store(true, Ordering::Release);
                            let flag = bridge_buy_post_active.clone();
                            let p = protocol.clone();
                            let ar = Arc::clone(settlement_reader);
                            let orch = Arc::clone(orchestrator);
                            let aw = Arc::clone(settlement_writer);
                            let cr = consensus_chain_reader.clone();
                            let dnu = data_node_url_for_task.clone();
                            let iid = itp_id_for_task.clone();
                            let nav = local_nav_fallback;
                            let qt = quote_tokens_for_task.clone();
                            let cycle = current_cycle;
                            let ni = node_index_for_task;
                            let nu = consensus_config.num_issuers;
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                run_cross_chain_buy_post_processing(
                                    p, ar, orch, aw, cr, cycle, ni, nu, dnu, iid, nav, qt, None,
                                ).await;
                            });
                        }
                    }

                    // One-time: recover pending mints from crash between CBO and mint
                    if bridge_ready && !pending_mint_recovery_done.load(Ordering::Acquire) {
                        pending_mint_recovery_done.store(true, Ordering::Release);
                        if let (Some(ref settlement_reader), Some(ref orchestrator), Some(ref settlement_writer)) =
                            (&settlement_reader_for_task, &bridge_orchestrator_for_task, &settlement_writer_for_task)
                        {
                            let p = protocol.clone();
                            let ar = Arc::clone(settlement_reader);
                            let orch = Arc::clone(orchestrator);
                            let aw = Arc::clone(settlement_writer);
                            let iid = itp_id_for_task.clone();
                            let cycle = current_cycle;
                            let ni = node_index_for_task;
                            let nu = consensus_config.num_issuers;
                            tokio::spawn(async move {
                                let bridge_proxy = orch.read().await.config().bridge_proxy;
                                match ar.get_pending_mints(bridge_proxy).await {
                                    Ok(pending) if !pending.is_empty() => {
                                        warn!(count = pending.len(), "Recovering pending mints from previous crash");
                                        for (order_id, itp_id, user, amount) in pending {
                                            let shares = amount;
                                            let batch_am_leader = (order_id.low_u64() % nu as u64) as u8 == ni;
                                            info!(%order_id, ?itp_id, ?user, %shares, am_leader = batch_am_leader,
                                                "Recovering pending mint");
                                            // Inject order metadata into orchestrator for BLS consensus
                                            orch.write().await.set_order_itp_id(order_id, itp_id).await;
                                            match p.run_mint_bridged_shares_phase(
                                                cycle, itp_id, user, shares, bridge_proxy, order_id, batch_am_leader,
                                            ).await {
                                                Ok(mint_result) => {
                                                    if batch_am_leader && !mint_result.aggregated_signature.0.is_empty() {
                                                        match aw.mint_bridged_shares(itp_id, user, shares, order_id, mint_result.aggregated_signature.0.clone(), p.registry_nonce(), mint_result.signer_bitmap).await {
                                                            Ok(tx_hash) => {
                                                                info!(?tx_hash, %order_id, "Pending mint recovered — submitted");
                                                                match aw.wait_for_receipt(tx_hash, 60).await {
                                                                    Ok(receipt) => {
                                                                        let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
                                                                        if success {
                                                                            info!(?tx_hash, %order_id, "Pending mint CONFIRMED");
                                                                            orch.write().await.mark_orders_shares_bridged(&[order_id]).await;
                                                                            // Clean up pendingMints entry on settlement
                                                                            if let Err(e) = aw.clear_pending_mint(order_id).await {
                                                                                debug!(%order_id, error = %e, "clearPendingMint failed (non-critical)");
                                                                            }
                                                                        } else {
                                                                            warn!(?tx_hash, %order_id, "Pending mint REVERTED — will retry next startup");
                                                                        }
                                                                    }
                                                                    Err(e) => warn!(error = %e, %order_id, "Pending mint receipt timeout"),
                                                                }
                                                            }
                                                            Err(e) => {
                                                                let err_str = format!("{}", e);
                                                                if err_str.contains("MintAlreadyProcessed") || err_str.contains("E139") {
                                                                    info!(%order_id, "Pending mint already processed (E139)");
                                                                    orch.write().await.mark_orders_shares_bridged(&[order_id]).await;
                                                                    if let Err(e) = aw.clear_pending_mint(order_id).await {
                                                                        debug!(%order_id, error = %e, "clearPendingMint failed (non-critical)");
                                                                    }
                                                                } else {
                                                                    warn!(error = %e, %order_id, "Pending mint recovery failed");
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                Err(e) => warn!(error = %e, %order_id, "Pending mint BLS consensus failed"),
                                            }
                                        }
                                    }
                                    Ok(_) => info!("No pending mints to recover"),
                                    Err(e) => warn!(error = %e, "Failed to scan for pending mints"),
                                }
                            });
                        }
                    }

                    // Cross-chain SELL — spawn if not already running (throttled)
                    if settlement_poll_due && !sell_active.load(Ordering::Acquire) {
                        if let (Some(ref settlement_reader), Some(ref orchestrator), Some(ref settlement_writer)) =
                            (&settlement_reader_for_task, &bridge_orchestrator_for_task, &settlement_writer_for_task)
                        {
                            sell_active.store(true, Ordering::Release);
                            let flag = sell_active.clone();
                            let p = protocol.clone();
                            let ar = Arc::clone(settlement_reader);
                            let orch = Arc::clone(orchestrator);
                            let aw = Arc::clone(settlement_writer);
                            let cr = consensus_chain_reader.clone();
                            let dnu = data_node_url_for_task.clone();
                            let iid = itp_id_for_task.clone();
                            let nav = local_nav_fallback;
                            let qt = quote_tokens_for_task.clone();
                            let cycle = current_cycle;
                            let ni = node_index_for_task;
                            let nu = consensus_config.num_issuers;
                            let cursor = settlement_sell_cursor.clone();
                            let sso = startup_sell_orders.clone();
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                run_cross_chain_sell_processing(
                                    p, ar, orch, aw, cr, cycle, ni, nu, dnu, iid, nav, qt, cursor, sso,
                                ).await;
                            });
                        }
                    }

                    // L3-native — spawn if not already running
                    if !l3_active.load(Ordering::Acquire) {
                        if let (Some(ref orchestrator), Some(ref protocol)) =
                            (&bridge_orchestrator_for_task, &consensus_protocol_for_task)
                        {
                            l3_active.store(true, Ordering::Release);
                            let flag = l3_active.clone();
                            let p = Arc::clone(protocol);
                            let orch = Arc::clone(orchestrator);
                            let cr = consensus_chain_reader.clone();
                            let fso = first_seen_orders.clone();
                            let dnu = data_node_url_for_task.clone();
                            let iid = itp_id_for_task.clone();
                            let nav = local_nav_fallback;
                            let qt = quote_tokens_for_task.clone();
                            let cycle = current_cycle;
                            let ni = node_index_for_task;
                            let nu = consensus_config.num_issuers;
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                run_l3_native_order_processing(
                                    p, orch, cr, cycle, ni, nu, fso, dnu, iid, nav, qt,
                                ).await;
                            });
                        }
                    }

                    // Rebalance — spawn on heartbeat if not already running
                    if is_heartbeat && !rebalance_active.load(Ordering::Acquire) {
                        if let (Some(ref orchestrator), Some(ref protocol)) =
                            (&bridge_orchestrator_for_task, &consensus_protocol_for_task)
                        {
                            rebalance_active.store(true, Ordering::Release);
                            let flag = rebalance_active.clone();
                            let p = Arc::clone(protocol);
                            let orch = Arc::clone(orchestrator);
                            let cr = consensus_chain_reader.clone();
                            let pf = price_fetcher_for_task.clone();
                            let sm = symbol_map_for_task.clone();
                            let qt = quote_tokens_for_task.clone();
                            let cycle = current_cycle;
                            let ni = node_index_for_task;
                            let nu = consensus_config.num_issuers;
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                run_rebalance_processing(
                                    p, orch, cr, cycle, ni, nu, pf, sm, qt,
                                ).await;
                            });
                        }
                    }

                    // Mirror registry sync — spawn every 500 cycles (~8 min) if not already running (Step 12)
                    // Always refreshes the snapshot to prevent BLSVerifier__SnapshotTooOld (86400 block limit).
                    if current_cycle % 500 == 0 && !mirror_sync_active.load(Ordering::Acquire) {
                        if let Some(ref protocol) = consensus_protocol_for_task {
                            if let Some(ref settlement_writer) = settlement_writer_for_task {
                                if let (Some(mirror_addr), Some(_issuer_reg_addr)) = (mirror_registry_for_task, issuer_registry_for_sync_task) {
                                    let settlement_cid = settlement_chain_id_for_task.unwrap_or(42161);
                                    mirror_sync_active.store(true, Ordering::Release);
                                    let flag = mirror_sync_active.clone();
                                    let p = Arc::clone(protocol);
                                    let aw = Arc::clone(settlement_writer);
                                    let cr = consensus_chain_reader.clone();
                                    let cycle = current_cycle;
                                    tokio::spawn(async move {
                                        let _guard = FlagGuard(flag);
                                        if let Err(e) = mirror_sync_task(&cr, &aw, &p, mirror_addr, settlement_cid, cycle).await {
                                            warn!(cycle, error = %e, "Mirror registry sync failed");
                                        }
                                    });
                                }
                            }
                        }
                    }

                    // Stale order watchdog: ONLY on heartbeat cycles, check every 50
                    // Non-blocking: skip if orchestrator lock is held by spawned tasks
                    if is_heartbeat && current_cycle % 50 == 0 {
                        let any_order_task_active = buy_active.load(Ordering::Acquire)
                            || bridge_buy_post_active.load(Ordering::Acquire)
                            || sell_active.load(Ordering::Acquire);
                        if !any_order_task_active {
                            if let Some(ref orchestrator) = bridge_orchestrator_for_task {
                                if let Ok(orch) = orchestrator.try_read() {
                                    let stale_orders = orch.get_stale_orders().await;
                                    if !stale_orders.is_empty() {
                                        warn!(
                                            cycle = current_cycle,
                                            count = stale_orders.len(),
                                            "Stale order watchdog: found stuck orders, resetting for retry"
                                        );
                                        drop(orch);
                                        if let Ok(orch) = orchestrator.try_read() {
                                            for (order_id, status) in &stale_orders {
                                                warn!(
                                                    order_id = %order_id,
                                                    status = ?status,
                                                    "Resetting stale order"
                                                );
                                                if matches!(status,
                                                    issuer::bridge::BridgeOrderStatus::SellPending |
                                                    issuer::bridge::BridgeOrderStatus::SellBurnPending |
                                                    issuer::bridge::BridgeOrderStatus::SellBurned |
                                                    issuer::bridge::BridgeOrderStatus::SellSubmittedOnL3 |
                                                    issuer::bridge::BridgeOrderStatus::SellFilled
                                                ) {
                                                    // Task 4: Status-aware reset for burn states
                                                    if matches!(status, issuer::bridge::BridgeOrderStatus::SellBurnPending) {
                                                        // Check on-chain state to resolve ambiguous SellBurnPending
                                                        if let Some(ref settlement_reader) = settlement_reader_for_task {
                                                            let on_chain_burned = settlement_reader
                                                                .get_cross_chain_sell_order(*order_id).await
                                                                .ok().flatten().map(|o| o.burned)
                                                                .unwrap_or(false);
                                                            if on_chain_burned {
                                                                warn!(order_id = %order_id, "Stale SellBurnPending but burn confirmed on-chain — advancing to SellBurned");
                                                                orch.set_sell_order_status(*order_id, issuer::BridgeOrderStatus::SellBurned).await;
                                                            } else {
                                                                warn!(order_id = %order_id, "Stale SellBurnPending and burn NOT on-chain — resetting to SellPending");
                                                                orch.set_sell_order_status(*order_id, issuer::BridgeOrderStatus::SellPending).await;
                                                            }
                                                        }
                                                    } else if matches!(status, issuer::bridge::BridgeOrderStatus::SellBurned) {
                                                        // Don't reset — keep at SellBurned, Phase A sub-step 3 retries L3 submit
                                                        warn!(order_id = %order_id, "Stale SellBurned order — retrying L3 submit only");
                                                    } else if matches!(status, issuer::bridge::BridgeOrderStatus::SellSubmittedOnL3) {
                                                        // Don't reset — L3 order exists, Phase B retries fill confirmation
                                                        warn!(order_id = %order_id, "Stale SellSubmittedOnL3 order — retrying fills only");
                                                    } else if matches!(status, issuer::bridge::BridgeOrderStatus::SellFilled) {
                                                        // Don't reset — fills confirmed, Phase C retries completeSellOrder
                                                        warn!(order_id = %order_id, "Stale SellFilled order — retrying complete only");
                                                    } else {
                                                        orch.reset_stale_sell_order(order_id).await;
                                                    }
                                                    // Clear from seen_sell_orders dedup so event scan re-discovers it
                                                    if let Some(ref settlement_reader) = settlement_reader_for_task {
                                                        let chain_id = settlement_reader.chain_id();
                                                        settlement_reader.remove_seen_sell_order(chain_id, *order_id).await;
                                                    }
                                                } else {
                                                    orch.reset_stale_order(order_id).await;
                                                    // Clear from seen_orders dedup so event scan re-discovers it
                                                    if matches!(status,
                                                        issuer::bridge::BridgeOrderStatus::Pending |
                                                        issuer::bridge::BridgeOrderStatus::BridgedToL3
                                                    ) {
                                                        if let Some(ref settlement_reader) = settlement_reader_for_task {
                                                            let chain_id = settlement_reader.chain_id();
                                                            settlement_reader.remove_seen_order(chain_id, *order_id).await;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Periodic watchdog cleanup
                                    if current_cycle % 500 == 0 {
                                        if let Ok(orch) = orchestrator.try_read() {
                                            orch.cleanup_watchdog().await;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Check price results (non-blocking)
                    while let Ok(success) = price_result_rx.try_recv() {
                        if success {
                            consecutive_price_failures = 0;
                        } else {
                            consecutive_price_failures += 1;
                            if consecutive_price_failures >= 10 {
                                error!(cycle = current_cycle, consecutive_failures = consecutive_price_failures,
                                    "CRITICAL: Price consensus stalled for 10+ consecutive cycles");
                            }
                        }
                    }

                    // Signal CycleManager: only trigger WorkDriven when bridge has
                    // in-flight orders. Active task flags (l3_active, buy_active, etc.)
                    // must NOT trigger WorkDriven — they cause a feedback loop where
                    // running tasks → work signal → cycle advance → re-check → still running
                    // → work signal → ... causing rapid cycle divergence across issuers
                    // and 0-signature consensus failures.
                    let has_bridge_work = if let Some(ref orch) = bridge_orchestrator_for_task {
                        match orch.try_read() {
                            Ok(o) => o.has_in_flight_orders().await,
                            Err(_) => false, // write lock held → don't trigger extra cycles
                        }
                    } else {
                        false
                    };
                    let _ = work_tx_for_task.try_send(has_bridge_work);
                } else {
                    // Mock consensus
                    run_mock_consensus(
                        &consensus_chain_reader, &consensus_chain_writer_for_task,
                        has_bls_keypair, current_cycle, &consensus_metrics, start_time,
                        &settlement_reader_for_task,
                    ).await;
                }
            }
        }
    });

    // Create NAV sign handler (Story 8.3) if API is enabled and BLS keypair is available
    // Uses StubItpRegistryReader for now - in production, wire up EthersItpRegistryReader
    let nav_sign_handler: Option<Arc<IssuerNavSignHandler>> =
        if api_enabled && components.consensus.keys.bls_keypair.is_some() {
            let url = data_node_url.as_ref().unwrap_or_else(|| {
                panic!("--data-node-url is required when NAV API is enabled (--api-enabled=true)")
            });
            info!(url = %url, itp_id = %itp_id, "Using BackendNavCalculator (data-node)");
            let nav_calculator: Box<dyn NavCalculator> =
                Box::new(BackendNavCalculator::new(url.clone(), itp_id.clone()));
            let handler = NavSignHandler::new(
                nav_calculator,
                StubItpRegistryReader::new(),
                components.consensus.keys.bls_keypair.clone(),
                components.consensus.keys.issuer_registry_index,
                components.consensus.cycle_manager.get_current_cycle(),
            );
            info!(node_id, api_enabled, "NAV sign API handler initialized");
            Some(Arc::new(handler))
        } else if !api_enabled {
            info!(node_id, "NAV sign API disabled via --api-enabled=false");
            None
        } else {
            warn!(node_id, "NAV sign API disabled: BLS keypair not configured");
            None
        };

    // Spawn NAV handler cycle sync task (HIGH-4 fix: keep cycle_number in sync with CycleManager)
    let _nav_cycle_sync_handle = if let Some(ref handler) = nav_sign_handler {
        let nav_handler_for_sync = Arc::clone(handler);
        let nav_cycle_rx = components.consensus.cycle_manager.subscribe();
        let nav_sync_shutdown = shutdown.clone();
        Some(tokio::spawn(async move {
            let mut rx = nav_cycle_rx;
            loop {
                if nav_sync_shutdown.load(Ordering::Relaxed) {
                    break;
                }
                if rx.changed().await.is_err() {
                    break;
                }
                let state = rx.borrow().clone();
                let current_cycle = state.get_current_cycle();
                nav_handler_for_sync.set_cycle_number(current_cycle);
                // Clear old cache entries every 100 cycles (MEDIUM-1 fix: prevent unbounded memory growth)
                if current_cycle % 100 == 0 {
                    nav_handler_for_sync.clear_old_cache(current_cycle, 10).await;
                }
            }
        }))
    } else {
        None
    };

    // Build unified HTTP API server (health + ready + nav-sign + registry-sync + optional Vision)
    let p2p_metrics = Arc::new(issuer::p2p::P2PMetrics::default());
    let issuer_state = Arc::new(IssuerApiState {
        node_id,
        p2p_transport: components.p2p.transport.clone(),
        metrics: components.consensus.metrics.clone(),
        p2p_metrics: p2p_metrics.clone(),
        registry_sync_cache: components.registry_sync_cache.clone(),
        nav_sign_handler: nav_sign_handler.clone(),
        num_issuers,
        bls_keypair_loaded,
        last_rpc_success_ms: last_rpc_success_ms.clone(),
    });
    let mut api_router = issuer_api_routes(issuer_state);
    if let Some(vision) = vision_router {
        api_router = api_router.merge(vision);
        info!(node_id, "Vision API routes merged into health port");
    }
    let health_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, api_router).await {
            error!(error = %e, "HTTP API server error");
        }
    });

    // Start delisting watchdog (daily background task)
    if let (Some(ref dn_url), Some(ref writer)) = (&data_node_url, &components.chain.writer) {
        let index_address = writer.config().contracts.index;
        let watchdog = Arc::new(issuer::delisting_watchdog::DelistingWatchdog::new(
            dn_url.clone(),
            components.chain.reader.clone(),
            writer.clone() as Arc<dyn common::traits::ChainWriter>,
            components.price.symbol_map.clone(),
            index_address,
        ));
        let wd_leader = Arc::new(tokio::sync::RwLock::new(
            issuer::LeaderElector::new(
                components.consensus.keys.node_index,
                components.consensus.config.num_issuers,
            ),
        ));
        let wd_shutdown = shutdown.clone();
        tokio::spawn(async move {
            issuer::delisting_watchdog::run_daily(
                watchdog,
                wd_leader,
                std::time::Duration::from_secs(86400),
                wd_shutdown,
            ).await;
        });
        info!(node_id, "Delisting watchdog started (daily, leader-only)");
    } else {
        info!(node_id, "Delisting watchdog skipped (no data-node-url or chain writer)");
    }

    // Start heartbeat monitor
    let heartbeat_handles: Option<(tokio::task::JoinHandle<()>, tokio::task::JoinHandle<()>)> =
        if let Some(ref monitor) = components.p2p.heartbeat_monitor {
            let handles = monitor.start().await;
            info!(node_id, "Heartbeat monitor started");
            Some(handles)
        } else {
            None
        };

    // Run cycle manager (blocks until shutdown)
    components.consensus.cycle_manager.start(shutdown.clone()).await;

    // Graceful shutdown
    if let Some(ref monitor) = components.p2p.heartbeat_monitor {
        monitor.shutdown();
        info!(node_id, "Heartbeat monitor shutdown signaled");
    }

    if let Some(transport) = components.p2p.transport {
        info!(node_id, "Shutting down P2P transport");
        transport.shutdown().await;
    }

    if let Some(handle) = router_handle {
        handle.abort();
    }

    if let Some((sender_handle, checker_handle)) = heartbeat_handles {
        let _ = tokio::time::timeout(std::time::Duration::from_secs(2), sender_handle).await;
        let _ = tokio::time::timeout(std::time::Duration::from_secs(2), checker_handle).await;
        info!(node_id, "Heartbeat monitor tasks stopped");
    }

    let _ = consensus_handle.await;
    let _ = health_handle.await;

    info!(node_id, "Issuer node shutting down gracefully");
    Ok(())
}

/// Price update task — fetches prices, runs price consensus, logs result.
/// Same pattern as every other task: detect work, propose, settle.
/// Returns `true` on consensus success, `false` on failure/timeout.
async fn run_price_update<P, W, K, PF>(
    protocol: Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    price_fetcher: Arc<dyn issuer::PriceFetcher>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    l3_writer: Option<Arc<dyn common::traits::ChainWriter>>,
    oracle_address: Option<ethers::types::Address>,
    itp_address: Option<ethers::types::Address>,
    chain_id: Option<u64>,
    known_assets: Vec<ethers::types::Address>,
    current_cycle: u64,
    metrics: Arc<issuer::bootstrap::IssuerMetrics>,
    rpc_timestamp: Arc<std::sync::atomic::AtomicU64>,
    nav_fallback: ethers::types::U256,
) -> bool where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    // 1. Fetch prices — map each returned price to its index in known_assets
    //    so followers can look up the correct address via known_assets[index].
    //    fetch_prices may return results in a different order than the input.
    let prices: Vec<(u32, ethers::types::U256)> = if !known_assets.is_empty() {
        match price_fetcher.fetch_prices(&known_assets).await {
            Ok(p) if !p.is_empty() => {
                p.iter().filter_map(|price| {
                    known_assets.iter().position(|a| *a == price.asset)
                        .map(|idx| (idx as u32, price.price))
                }).collect()
            }
            Ok(_) | Err(_) => {
                // Fallback to on-chain
                match chain_reader.get_prices().await {
                    Ok(p) if !p.is_empty() => {
                        p.iter().enumerate().map(|(i, price)| (i as u32, price.price)).collect()
                    }
                    _ => vec![]
                }
            }
        }
    } else {
        match chain_reader.get_prices().await {
            Ok(p) if !p.is_empty() => {
                p.iter().enumerate().map(|(i, price)| (i as u32, price.price)).collect()
            }
            _ => vec![]
        }
    };

    // Compute Morpho-scaled NAV: multiply by 1e18 (NAV is 18 dec, Morpho wants 36 dec for same-dec pair)
    let morpho_nav = if oracle_address.is_some() {
        Some(nav_fallback.saturating_mul(ethers::types::U256::exp10(18)))
    } else {
        None
    };
    let timestamp = chrono::Utc::now().timestamp() as u64;

    // 2. Run price consensus (with optional oracle signing)
    metrics.record_consensus_start();
    let start = std::time::Instant::now();
    let result = protocol.run_price_cycle(
        current_cycle, prices,
        morpho_nav, timestamp, oracle_address, itp_address, chain_id,
    ).await;
    let elapsed_ms = start.elapsed().as_millis() as u64;

    // 3. Log result and return success/failure
    match result {
        issuer::ConsensusResult::Success { signer_count, cycle_number, .. } => {
            info!(cycle = cycle_number, signer_count, elapsed_ms, "Price update completed");
            metrics.record_consensus_result(true, signer_count, elapsed_ms);
            rpc_timestamp.store(
                chrono::Utc::now().timestamp_millis() as u64,
                std::sync::atomic::Ordering::Relaxed,
            );
            true
        }
        issuer::ConsensusResult::Failed { ref reason, cycle_number } => {
            warn!(cycle = cycle_number, reason, elapsed_ms, "Price update failed");
            metrics.record_consensus_result(false, 0, elapsed_ms);
            false
        }
        issuer::ConsensusResult::Timeout { ref phase, cycle_number } => {
            warn!(cycle = cycle_number, phase = %phase, elapsed_ms, "Price update timed out");
            metrics.record_consensus_result(false, 0, elapsed_ms);
            false
        }
        issuer::ConsensusResult::EmergencyPause { cycle_number } => {
            warn!(cycle = cycle_number, elapsed_ms, "Price update triggered pause (will retry next cycle)");
            metrics.record_consensus_result(false, 0, elapsed_ms);
            false
        }
        issuer::ConsensusResult::ItpCreated { .. } => { true } // won't happen for price cycle
        issuer::ConsensusResult::PriceAgreed { ref aggregated_signature, signer_count, signers_bitmask, cycle_number } => {
            info!(cycle = cycle_number, signer_count, elapsed_ms, "Price consensus agreed");
            metrics.record_consensus_result(true, signer_count, elapsed_ms);
            rpc_timestamp.store(
                chrono::Utc::now().timestamp_millis() as u64,
                std::sync::atomic::Ordering::Relaxed,
            );

            // Submit to oracle on L3 if configured and we have a real signature
            if let (Some(ref writer), Some(oracle_addr), Some(morpho_price)) = (&l3_writer, oracle_address, morpho_nav) {
                if signer_count > 0 {
                    let ref_nonce = protocol.registry_nonce();
                    let calldata = issuer::build_update_price_calldata(
                        morpho_price,
                        timestamp,
                        cycle_number,
                        &aggregated_signature.0,
                        ref_nonce,
                        signers_bitmask,
                    );
                    match writer.send_transaction(oracle_addr, calldata, ethers::types::U256::zero()).await {
                        Ok(tx) => info!(cycle = cycle_number, tx = %tx, "Oracle price updated on L3"),
                        Err(e) => warn!(cycle = cycle_number, error = %e, "Oracle price update on L3 failed"),
                    }
                }
            }

            true
        }
    }
}

async fn run_itp_creation_phase<P, W, K, PF>(
    protocol: Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    settlement_reader: Arc<dyn issuer::SettlementReader>,
    settlement_writer: Arc<issuer::SettlementChainWriter>,
    l3_writer: Option<Arc<issuer::EthersChainWriter>>,
    itp_config: issuer::ItpCreationConfig,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    first_seen: Arc<tokio::sync::Mutex<std::collections::HashMap<ethers::types::U256, std::time::Instant>>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    /// Max age before skipping a stale ITP creation request (1 hour)
    const MAX_REQUEST_AGE: std::time::Duration = std::time::Duration::from_secs(3600);

    match settlement_reader.get_all_pending_requests().await {
        Ok(pending_requests) => {
            if !pending_requests.is_empty() {
                info!(cycle = current_cycle, count = pending_requests.len(), "Found pending ITP creation requests");

                let am_leader = calculate_bridge_leader(current_cycle, num_issuers, node_index);

                for request in pending_requests {
                    // Track first-seen time for staleness detection
                    let seen_at = {
                        let mut fs = first_seen.lock().await;
                        *fs.entry(request.nonce).or_insert_with(std::time::Instant::now)
                    };
                    if seen_at.elapsed() > MAX_REQUEST_AGE {
                        debug!(nonce = %request.nonce, age_secs = seen_at.elapsed().as_secs(),
                               "Skipping stale ITP creation request (>1h old)");
                        continue;
                    }

                    info!(nonce = %request.nonce, admin = ?request.admin, name = %request.name, am_leader, "Processing ITP creation request");

                    match protocol.run_itp_creation_phase(&request, &itp_config, am_leader).await {
                        Ok(result) => {
                            if result.signature_count == 0 {
                                debug!(nonce = %result.nonce, am_leader,
                                       "ITP creation: no signatures collected (follower placeholder)");
                            } else {
                                info!(nonce = %result.nonce, signer_count = result.signature_count,
                                      "ITP creation consensus succeeded");
                            }

                            if am_leader && !result.aggregated_signature.is_empty() {
                                // Step 1: Create ITP on L3 first (Index.sol only exists on L3)
                                let l3_itp_id = if let Some(ref writer) = l3_writer {
                                    match writer.create_itp(
                                        &request.name,
                                        &request.symbol,
                                        &request.weights,
                                        &request.assets,
                                        &request.prices,
                                        request.nonce,
                                    ).await {
                                        Ok(itp_id) => {
                                            info!(nonce = %request.nonce, itp_id = ?itp_id, "ITP created on L3");
                                            Some(itp_id)
                                        }
                                        Err(e) => {
                                            error!(nonce = %request.nonce, error = %e, "Failed to create ITP on L3");
                                            None
                                        }
                                    }
                                } else {
                                    error!(nonce = %request.nonce, "No L3 chain writer available — cannot create ITP");
                                    None
                                };

                                // Step 2: Complete on Settlement with the L3 itpId (deploys BridgedITP ERC20)
                                if let Some(itp_id) = l3_itp_id {
                                    const RECEIPT_TIMEOUT_SECS: u64 = 60;
                                    match settlement_writer.complete_create_itp_and_wait(
                                        result.nonce, itp_id,
                                        result.aggregated_signature.clone(),
                                        protocol.registry_nonce(), result.signer_bitmap,
                                        RECEIPT_TIMEOUT_SECS,
                                    ).await {
                                        Ok(receipt) => {
                                            info!(nonce = %result.nonce, itp_id = ?itp_id, tx_hash = ?receipt.transaction_hash, "ITP creation confirmed on both L3 and Settlement");
                                        }
                                        Err(e) => {
                                            error!(nonce = %result.nonce, error = %e, "Failed to complete ITP creation on Settlement (L3 succeeded)");
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            warn!(nonce = %request.nonce, error = %e, "ITP creation consensus failed");
                        }
                    }
                }
            }
        }
        Err(e) => {
            warn!(cycle = current_cycle, error = %e, "Failed to get pending ITP creation requests");
        }
    }
}

async fn run_cross_chain_processing<P, W, K, PF>(
    protocol: Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    settlement_reader: Arc<dyn issuer::SettlementReader>,
    orchestrator: Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    settlement_writer: Arc<issuer::SettlementChainWriter>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    data_node_url_for_task: Option<String>,
    itp_id_for_task: String,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
    block_cursor: Arc<std::sync::atomic::AtomicU64>,
    _bridge_post_ready: Arc<AtomicBool>,
    startup_buy_orders: Arc<tokio::sync::Mutex<Vec<common::types::CrossChainOrder>>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    let confirmed_block = match settlement_reader.get_confirmed_block().await {
        Ok(block) => block,
        Err(e) => { warn!(cycle = current_cycle, error = %e, "Failed to get confirmed block"); return; }
    };

    if confirmed_block == 0 {
        info!(cycle = current_cycle, "Cross-chain detection: confirmed_block=0, skipping");
        return;
    }

    // Use cursor for incremental scanning (fallback: 200 blocks back on first run ~3 min on Sonic).
    // Kept short to avoid re-processing stale bridge orders from previous issuer sessions.
    let cursor_val = block_cursor.load(Ordering::Relaxed);
    let from_block = if cursor_val > 0 { cursor_val } else { confirmed_block.saturating_sub(200) };
    // Log every 60th scan to avoid spamming (scans every ~5s)
    if current_cycle % 60 == 0 {
        info!(cycle = current_cycle, confirmed_block, from_block, "Cross-chain detection: scanning Settlement chain");
    }

    match settlement_reader.get_confirmed_cross_chain_orders(from_block, confirmed_block).await {
        Ok(orders) => {
            let now_secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            // Filter event-discovered orders (same as before)
            let mut new_orders = Vec::new();
            {
                let orch = orchestrator.read().await;
                for order in orders {
                    if orch.get_order_status(&order.order_id).await.is_some() {
                        continue;
                    }
                    let deadline_secs = order.deadline.as_u64();
                    if deadline_secs > 0 && deadline_secs < now_secs {
                        info!(order_id = %order.order_id, deadline = deadline_secs, now = now_secs, "Skipping expired cross-chain order");
                        continue;
                    }
                    new_orders.push(order);
                }
            }

            // Merge startup-discovered orders (one-time drain from background scan)
            {
                let mut startup = startup_buy_orders.lock().await;
                if !startup.is_empty() {
                    let extra_orders = std::mem::take(&mut *startup);
                    info!(count = extra_orders.len(), "Injecting startup-discovered buy orders into pipeline");
                    let orch = orchestrator.read().await;
                    for order in extra_orders {
                        if orch.get_order_status(&order.order_id).await.is_some() {
                            continue;
                        }
                        if order.deadline.as_u64() > 0 && order.deadline.as_u64() < now_secs {
                            continue;
                        }
                        new_orders.push(order);
                    }
                }
            }

            // Deduplicate by order_id (event scan + startup injection may overlap)
            new_orders.sort_by_key(|o| o.order_id);
            new_orders.dedup_by_key(|o| o.order_id);

            if new_orders.is_empty() {
                debug!(cycle = current_cycle, "No new cross-chain orders");
            } else {
                info!(cycle = current_cycle, order_count = new_orders.len(), from_block, to_block = confirmed_block, "Found cross-chain orders");

                // Set initial status for all orders before spawning (serialized write lock)
                {
                    let orch_write = orchestrator.write().await;
                    for order in &new_orders {
                        orch_write.set_order_amount(order.order_id, order.amount).await;
                        orch_write.set_order_limit_price(order.order_id, order.limit_price, 0).await; // 0 = BUY
                        orch_write.set_order_itp_id(order.order_id, order.itp_id).await;
                        orch_write.set_order_status(order.order_id, issuer::BridgeOrderStatus::Pending).await;
                    }
                }

                let chain_id = settlement_reader.chain_id();
                // Track which orders successfully complete Phase 1 (submitOrder)
                let mut just_submitted_ids: Vec<ethers::types::U256> = Vec::new();
                // Process orders SEQUENTIALLY to avoid P2P consensus contention.
                // When multiple bridge proposals are in-flight simultaneously, leaders
                // time out because followers are also busy being leaders for other orders.
                for order in new_orders {
                    let am_leader = calculate_bridge_leader(order.order_id.as_u64(), num_issuers, node_index);
                    info!(order_id = %order.order_id, itp_id = ?order.itp_id, user = ?order.user, amount = %order.amount, am_leader, "Processing cross-chain order");

                    {
                        let p = protocol.clone();
                        let ar = settlement_reader.clone();
                        let orch = orchestrator.clone();
                        let cid = chain_id;

                        match p.run_bridge_settlement_to_l3_phase(&order, am_leader).await {
                            Ok(result) => {
                                if result.signature_count == 0 {
                                    // Follower: store mapping for MintBridgedShares, but don't run
                                    // inline pipeline (batch/fills/mint happen via P2P handlers)
                                    debug!(order_id = %order.order_id, am_leader, "Bridge Settlement→L3: follower — storing mapping only");
                                    ar.mark_order_processed(cid, order.order_id).await;
                                    {
                                        let orch_w = orch.write().await;
                                        // Don't set SubmittedOnL3 — let P2P handlers manage status
                                        orch_w.set_order_amount(order.order_id, order.amount).await;
                                        orch_w.store_order_mapping(issuer::bridge::OrderMapping {
                                            settlement_order_id: order.order_id,
                                            l3_order_id: order.order_id, // placeholder — leader knows actual L3 ID
                                            original_user: order.user,
                                            created_at: std::time::SystemTime::now()
                                                .duration_since(std::time::UNIX_EPOCH)
                                                .unwrap_or_default()
                                                .as_secs(),
                                        }).await;
                                    }
                                    continue;
                                }
                                info!(order_id = %order.order_id, signer_count = result.signature_count, "Bridge Settlement→L3 consensus completed");

                                match p.run_submit_order_phase(&order, am_leader).await {
                                    Ok(submit_result) => {
                                        if submit_result.signature_count == 0 {
                                            debug!(order_id = %order.order_id, am_leader, "Submit order: no signatures collected (follower placeholder)");
                                            continue;
                                        }
                                        info!(order_id = %order.order_id, signer_count = submit_result.signature_count, "Submit order consensus completed");

                                        ar.mark_order_processed(cid, order.order_id).await;
                                        {
                                            let orch_w = orch.write().await;
                                            orch_w.set_order_status(order.order_id, issuer::BridgeOrderStatus::SubmittedOnL3).await;
                                            orch_w.set_order_amount(order.order_id, order.amount).await;
                                            let l3_id = submit_result.l3_order_id.unwrap_or(order.order_id);
                                            orch_w.store_order_mapping(issuer::bridge::OrderMapping {
                                                settlement_order_id: order.order_id,
                                                l3_order_id: l3_id,
                                                original_user: order.user,
                                                created_at: std::time::SystemTime::now()
                                                    .duration_since(std::time::UNIX_EPOCH)
                                                    .unwrap_or_default()
                                                    .as_secs(),
                                            }).await;
                                        }
                                        just_submitted_ids.push(order.order_id);
                                        // Immediately continue to batch/fills/mint (merged Phase 1+2)
                                        // instead of returning and waiting for poll-driven Phase 2
                                        info!(order_id = %order.order_id, "Phase 1 complete, continuing to batch/fills/mint inline");
                                    }
                                    Err(e) => {
                                        warn!(order_id = %order.order_id, error = %e, "Submit order consensus failed");
                                        ar.increment_retry_count(cid, order.order_id).await;
                                    }
                                }
                            }
                            Err(e) => {
                                warn!(order_id = %order.order_id, error = %e, am_leader, "Bridge Settlement→L3 consensus failed");
                                ar.increment_retry_count(cid, order.order_id).await;
                            }
                        }
                    }
                }

                // Merged Phase 2: immediately run batch/fills/mint for the just-submitted orders
                // (no poll wait — orders were just submitted above)
                if !just_submitted_ids.is_empty() {
                    run_cross_chain_buy_post_processing(
                        protocol.clone(),
                        settlement_reader.clone(),
                        orchestrator.clone(),
                        settlement_writer.clone(),
                        chain_reader.clone(),
                        current_cycle,
                        node_index,
                        num_issuers,
                        data_node_url_for_task.clone(),
                        itp_id_for_task.clone(),
                        local_nav_fallback,
                        quote_tokens.clone(),
                        Some(just_submitted_ids),
                    ).await;
                }
            }
        }
        Err(e) => {
            warn!(cycle = current_cycle, error = %e, "Failed to fetch cross-chain orders");
            // Don't advance cursor on error — retry from same block
            return;
        }
    }

    // Advance cursor to confirmed_block (next poll starts from here)
    block_cursor.store(confirmed_block, Ordering::Relaxed);

    if current_cycle % 1000 == 0 {
        settlement_reader.clear_old_seen_orders(100_000).await;
    }

}

/// Cross-chain BUY post-processing — batch/fills/mint for SubmittedOnL3 orders
///
/// Primary path: called inline from run_cross_chain_processing after submit completes.
///   `target_orders = Some(ids)` — only process the just-submitted orders (avoids stale order pollution).
/// Recovery path: spawned on settlement_poll_due for orders stuck at SubmittedOnL3
///   `target_orders = None` — process all SubmittedOnL3 orders.
async fn run_cross_chain_buy_post_processing<P, W, K, PF>(
    protocol: Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    _settlement_reader: Arc<dyn issuer::SettlementReader>,
    orchestrator: Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    settlement_writer: Arc<issuer::SettlementChainWriter>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    _data_node_url_for_task: Option<String>,
    itp_id_for_task: String,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
    target_orders: Option<Vec<ethers::types::U256>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    // Process batch for SubmittedOnL3 orders
    let submitted_orders = if let Some(ref targets) = target_orders {
        // Inline path: only process the just-submitted orders (prevents stale L3-native orders
        // from poisoning the batch — their L3 IDs can collide with settlement order IDs).
        targets.clone()
    } else {
        // Recovery path: process all SubmittedOnL3 orders
        let o = orchestrator.read().await;
        o.get_submitted_bridged_orders().await
    };

    if !submitted_orders.is_empty() {
        // Resolve Settlement order IDs → L3 order IDs for BLS hash and on-chain calls.
        // The contract uses L3 IDs, so the BLS hash must match.
        // On the leader, resolve_l3_order_ids uses stored mappings.
        // On followers, it falls back to settlement IDs (but followers don't create proposals —
        // they receive L3 IDs from the leader's P2P broadcast and sign those).
        let l3_order_ids = {
            let o = orchestrator.read().await;
            o.resolve_l3_order_ids(&submitted_orders).await
        };
        // Reverse lookup: L3 ID → Settlement ID (for post-fill operations that need Settlement IDs)
        let l3_to_settlement: std::collections::HashMap<ethers::types::U256, ethers::types::U256> =
            l3_order_ids.iter().zip(submitted_orders.iter()).map(|(l3, settlement)| (*l3, *settlement)).collect();

        info!(
            cycle = current_cycle,
            settlement_order_ids = ?submitted_orders.iter().map(|id| id.as_u64()).collect::<Vec<_>>(),
            l3_order_ids = ?l3_order_ids.iter().map(|id| id.as_u64()).collect::<Vec<_>>(),
            "Resolved Settlement→L3 order IDs for batch/fills"
        );

        // Use order-based leader election (same node as submit leader, which has the settlement→L3 mapping)
        let batch_key = submitted_orders.first().map(|id| id.as_u64()).unwrap_or(current_cycle);
        let batch_am_leader = calculate_bridge_leader(batch_key, num_issuers, node_index);
        info!(cycle = current_cycle, order_count = submitted_orders.len(), batch_am_leader, "Processing batch for SubmittedOnL3 orders");

        // Fetch NAV per unique ITP (multi-ITP support)
        let mut nav_cache: HashMap<String, ethers::types::U256> = HashMap::new();
        let prices: Vec<ethers::types::U256> = {
            let o = orchestrator.read().await;
            let mut p = Vec::new();
            for order_id in &submitted_orders {
                let itp_id_str = if let Some(itp_h256) = o.get_order_itp_id(order_id).await {
                    format!("{:#066x}", itp_h256)
                } else {
                    itp_id_for_task.clone()
                };
                let nav = if let Some(cached) = nav_cache.get(&itp_id_str) {
                    *cached
                } else {
                    let fetched = local_nav_fallback;
                    nav_cache.insert(itp_id_str.clone(), fetched);
                    fetched
                };
                p.push(nav);
            }
            p
        };
        info!(cycle = current_cycle, nav_cache = ?nav_cache, local_nav_fallback = %local_nav_fallback, "NAV(s) for batch confirm fills");

        // Pre-check: if L3 orders are already batched on-chain, skip batch phase.
        // Avoids wasted consensus round + reverted tx when the regular cycle already batched them.
        let orders_already_batched = match chain_reader.get_batched_orders().await {
            Ok(batched) => {
                let batched_ids: std::collections::HashSet<ethers::types::U256> = batched.iter().map(|o| o.id).collect();
                l3_order_ids.iter().all(|id| batched_ids.contains(id))
            }
            Err(_) => false,
        };

        let batch_phase_ok = if orders_already_batched {
            info!(cycle = current_cycle, "L3 orders already batched on-chain — skipping batch phase");
            true
        } else {
            match protocol.run_batch_confirm_phase(current_cycle, l3_order_ids.clone(), prices.clone(), batch_am_leader).await {
                Ok(batch_result) => {
                    info!(cycle = current_cycle, signer_count = batch_result.signature_count, "Batch confirmation completed");
                    true
                }
                Err(e) => {
                    let err_str = format!("{}", e);
                    if err_str.contains("E021") || err_str.contains("7a5425d1") || err_str.contains("AlreadyBatched") {
                        info!(cycle = current_cycle, "Orders already batched (E021), proceeding to CBO/fills");
                        true
                    } else {
                        warn!(cycle = current_cycle, error = %e, "Batch confirmation failed");
                        false
                    }
                }
            }
        };

        if batch_phase_ok {
            // Mark orders as Batched using Settlement IDs (not L3 IDs) to avoid namespace collisions
            {
                let orch = orchestrator.write().await;
                for oid in &submitted_orders {
                    orch.set_order_status(*oid, issuer::BridgeOrderStatus::Batched).await;
                }
            }

            // Collect asset trade data upfront (needed for fire-and-forget after fills)
            let asset_trade_orders: Vec<(ethers::types::H256, u8, ethers::types::U256)> = {
                let o = orchestrator.read().await;
                let mut trades = Vec::new();
                for order_id in &submitted_orders {
                    let order_itp = o.get_order_itp_id(order_id).await
                        .unwrap_or_else(|| itp_id_for_task.parse::<ethers::types::H256>().unwrap_or_default());
                    let amount = match o.get_order_amount(order_id).await {
                        Some(a) => a,
                        None => { warn!(order_id = %order_id, "Buy order amount missing — skipping trade"); continue; }
                    };
                    trades.push((order_itp, 0u8 /* BUY */, amount));
                }
                trades
            };

            // completeBuyOrder: SettlementBridgeCustody → vault (BLS consensus required)
            // Track which orders are confirmed — only confirmed orders proceed to fills
            let cbo_confirmed_orders: Vec<ethers::types::U256> = {
                let vault = orchestrator.read().await.config().bitget_vault;
                let mut confirmed = Vec::new();
                for order_id in &submitted_orders {
                    match protocol.run_complete_buy_order_phase(
                        current_cycle, *order_id, vault, batch_am_leader,
                    ).await {
                        Ok(cbo_result) => {
                            info!(cycle = current_cycle, order_id = %order_id, signer_count = cbo_result.signature_count, "CompleteBuyOrder consensus completed");
                            if batch_am_leader && !cbo_result.aggregated_signature.0.is_empty() {
                                match settlement_writer.complete_buy_order(*order_id, vault, cbo_result.aggregated_signature.0.clone(), protocol.registry_nonce(), cbo_result.signer_bitmap).await {
                                    Ok(tx_hash) => {
                                        info!(?tx_hash, order_id = %order_id, "completeBuyOrder submitted, waiting for receipt");
                                        const RECEIPT_TIMEOUT_SECS: u64 = 60;
                                        match settlement_writer.wait_for_receipt(tx_hash, RECEIPT_TIMEOUT_SECS).await {
                                            Ok(receipt) => {
                                                let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
                                                if success {
                                                    info!(?tx_hash, order_id = %order_id, "completeBuyOrder CONFIRMED");
                                                    confirmed.push(*order_id);
                                                } else {
                                                    warn!(?tx_hash, order_id = %order_id, "completeBuyOrder REVERTED — will NOT mint");
                                                }
                                            }
                                            Err(e) => {
                                                warn!(order_id = %order_id, error = %e, "completeBuyOrder receipt timeout — will NOT mint");
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        let err_str = format!("{}", e);
                                        if err_str.contains("E125") || err_str.contains("BuyOrderNotFound") {
                                            info!(order_id = %order_id, "completeBuyOrder already done (E125) — confirmed");
                                            confirmed.push(*order_id);
                                        } else {
                                            warn!(error = %e, order_id = %order_id, "completeBuyOrder failed — will NOT mint");
                                        }
                                    }
                                }
                            } else if !batch_am_leader {
                                // Followers trust consensus — if consensus succeeded, CBO is confirmed
                                confirmed.push(*order_id);
                            }
                        }
                        Err(e) => warn!(error = %e, order_id = %order_id, "CompleteBuyOrder consensus failed — will NOT mint"),
                    }
                }
                confirmed
            };

            // Build fills with L3 order IDs (for BLS hash + on-chain), amounts from Settlement ID lookup
            // Filter out orders where fill price violates limit (E126 guard)
            // Uses per-order NAV from prices vector (multi-ITP support)
            let fills: Vec<Fill> = {
                let o = orchestrator.read().await;
                let mut fills = Vec::new();
                for (i, (l3_id, settlement_id)) in l3_order_ids.iter().zip(submitted_orders.iter()).enumerate() {
                    // Only include orders confirmed by completeBuyOrder
                    if !cbo_confirmed_orders.contains(settlement_id) {
                        continue;
                    }
                    let order_nav = prices.get(i).copied().unwrap_or(local_nav_fallback);
                    let amount = match o.get_order_amount(settlement_id).await {
                        Some(a) => a,
                        None => { warn!(order_id = %settlement_id, "Buy order amount missing — skipping fill"); continue; }
                    };
                    // Check limit price from orchestrator (stored when order was first tracked)
                    if let Some((limit_price, side)) = o.get_order_limit_price(settlement_id).await {
                        let order_side = common::types::Side::from(side);
                        if !fill_price_respects_limit(order_nav, limit_price, order_side) {
                            warn!(order_id = %settlement_id, l3_id = %l3_id, nav = %order_nav, limit_price = %limit_price,
                                "Skipping cross-chain fill: NAV violates limit price (E126 guard)");
                            continue;
                        }
                    }
                    fills.push(Fill {
                        order_id: *l3_id, // L3 ID for on-chain confirmFills
                        fill_price: order_nav,
                        fill_amount: amount,
                    });
                }
                fills
            };

            if cbo_confirmed_orders.is_empty() {
                warn!(cycle = current_cycle, "No orders had completeBuyOrder confirmed — skipping fills to prevent unbacked ITP");
            } else {
            match protocol.run_fills_confirm_phase(current_cycle, fills.clone(), batch_am_leader).await {
                Ok(fills_result) => {
                    info!(cycle = current_cycle, signer_count = fills_result.signature_count, "Fills confirmed");

                    // Mint BridgedITP shares on Settlement (using each order's actual itp_id)
                    {
                        let bridge_proxy = orchestrator.read().await.config().bridge_proxy;
                        for fill in &fills {
                            // Look up original user from order mapping (using Settlement ID)
                            let settlement_id = l3_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                            let order_itp = orchestrator.read().await.get_order_itp_id(&settlement_id).await
                                .unwrap_or_else(|| itp_id_for_task.parse::<ethers::types::H256>().unwrap_or_default());
                            let mapping = orchestrator.read().await.get_order_mapping(&settlement_id).await
                                .or(orchestrator.read().await.get_mapping_by_l3_id(&fill.order_id).await);
                            if let Some(mapping) = mapping {
                                // shares = fill_amount * 1e18 / fill_price
                                let shares = if fill.fill_price > ethers::types::U256::zero() {
                                    (fill.fill_amount * ethers::types::U256::exp10(18)) / fill.fill_price
                                } else {
                                    fill.fill_amount
                                };

                                match protocol.run_mint_bridged_shares_phase(
                                    current_cycle, order_itp, mapping.original_user, shares, bridge_proxy, settlement_id, batch_am_leader,
                                ).await {
                                    Ok(mint_result) => {
                                        info!(cycle = current_cycle, user = ?mapping.original_user, shares = %shares, signer_count = mint_result.signature_count, "MintBridgedShares consensus completed");
                                        // Only LEADER marks SharesBridged after confirmed receipt
                                        if batch_am_leader && !mint_result.aggregated_signature.0.is_empty() {
                                            match settlement_writer.mint_bridged_shares(order_itp, mapping.original_user, shares, settlement_id, mint_result.aggregated_signature.0.clone(), protocol.registry_nonce(), mint_result.signer_bitmap).await {
                                                Ok(tx_hash) => {
                                                    info!(?tx_hash, user = ?mapping.original_user, "mintBridgedShares submitted, waiting for receipt");
                                                    const RECEIPT_TIMEOUT_SECS: u64 = 60;
                                                    match settlement_writer.wait_for_receipt(tx_hash, RECEIPT_TIMEOUT_SECS).await {
                                                        Ok(receipt) => {
                                                            let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
                                                            if success {
                                                                info!(?tx_hash, "mintBridgedShares CONFIRMED");
                                                                let orch = orchestrator.write().await;
                                                                orch.mark_orders_shares_bridged(&[settlement_id]).await;
                                                            } else {
                                                                warn!(?tx_hash, "mintBridgedShares REVERTED — order stays Batched for retry");
                                                            }
                                                        }
                                                        Err(e) => warn!(error = %e, "mintBridgedShares receipt timeout — stays Batched for retry"),
                                                    }
                                                }
                                                Err(e) => {
                                                    let err_str = format!("{}", e);
                                                    if err_str.contains("MintAlreadyProcessed") || err_str.contains("E139") {
                                                        info!(order_id = %settlement_id, "mintBridgedShares already processed — marking SharesBridged");
                                                        let orch = orchestrator.write().await;
                                                        orch.mark_orders_shares_bridged(&[settlement_id]).await;
                                                    } else {
                                                        warn!(error = %e, user = ?mapping.original_user, "mintBridgedShares failed — stays Batched");
                                                    }
                                                }
                                            }
                                        }
                                        // Followers do NOT mark SharesBridged — they cannot know if
                                        // the leader's on-chain tx succeeded. Marking terminal would
                                        // prevent BLS participation in retry if leader's tx reverts.
                                        // Memory cleanup happens on watchdog stale reset or process restart.
                                    }
                                    Err(e) => warn!(cycle = current_cycle, error = %e, order_id = %fill.order_id, "MintBridgedShares consensus failed"),
                                }
                            } else {
                                warn!(order_id = %fill.order_id, "No order mapping found — cannot bridge shares");
                            }
                        }
                    }

                    // Fire-and-forget: emit asset trades after critical path completes
                    {
                        let p = protocol.clone();
                        let cr = chain_reader.clone();
                        let qt = quote_tokens.clone();
                        let at = asset_trade_orders.clone();
                        tokio::spawn(async move {
                            match p.run_asset_trades_phase(current_cycle, &at, &cr, batch_am_leader, qt.as_ref()).await {
                                Ok(at_result) => info!(cycle = current_cycle, signer_count = at_result.signature_count, "Cross-chain asset trades emitted"),
                                Err(e) => warn!(cycle = current_cycle, error = %e, "Asset trades emission failed (non-critical)"),
                            }
                        });
                    }
                }
                Err(e) => {
                    let fills_err = format!("{}", e);
                    // Determine if we should proceed to mint:
                    // 1. Chain revert (already filled): 0x6e6e29cb / "already" / "reverted on-chain"
                    // 2. BLS timeout: fills loop likely filled the order concurrently
                    let is_already_filled = fills_err.contains("6e6e29cb") || fills_err.contains("already") || fills_err.contains("reverted on-chain");
                    let is_timeout = fills_err.contains("signing timeout");

                    if is_already_filled || is_timeout {
                        let should_mint = if is_timeout {
                            // BLS timeout: fills loop may have confirmed. Wait briefly, then
                            // verify on-chain before proceeding to mint.
                            info!(cycle = current_cycle, "Fills BLS timeout — waiting for fills loop to confirm on-chain");
                            let mut filled_on_chain = false;
                            for attempt in 0..10u32 {
                                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                                // Check if orders are now FILLED on L3 (no longer in batched set)
                                match chain_reader.get_batched_orders().await {
                                    Ok(batched) => {
                                        let batched_ids: std::collections::HashSet<ethers::types::U256> =
                                            batched.iter().map(|o| o.id).collect();
                                        let all_filled = fills.iter().all(|f| !batched_ids.contains(&f.order_id));
                                        if all_filled {
                                            info!(cycle = current_cycle, attempt, "Orders confirmed FILLED on L3 by fills loop");
                                            filled_on_chain = true;
                                            break;
                                        }
                                    }
                                    Err(e) => debug!(error = %e, "Failed to check batched orders"),
                                }
                            }
                            if !filled_on_chain {
                                warn!(cycle = current_cycle, "Orders still not filled after 10s wait — skipping mint");
                            }
                            filled_on_chain
                        } else {
                            info!(cycle = current_cycle, "Order already filled on-chain, proceeding to mint");
                            true
                        };

                        // Mint BridgedITP shares (post-fills path)
                        if should_mint
                        {
                            let bridge_proxy = orchestrator.read().await.config().bridge_proxy;
                            for fill in &fills {
                                let settlement_id = l3_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                let order_itp = orchestrator.read().await.get_order_itp_id(&settlement_id).await
                                    .unwrap_or_else(|| itp_id_for_task.parse::<ethers::types::H256>().unwrap_or_default());
                                let mapping = orchestrator.read().await.get_order_mapping(&settlement_id).await
                                    .or(orchestrator.read().await.get_mapping_by_l3_id(&fill.order_id).await);
                                if let Some(mapping) = mapping {
                                    let shares = if fill.fill_price > ethers::types::U256::zero() {
                                        (fill.fill_amount * ethers::types::U256::exp10(18)) / fill.fill_price
                                    } else {
                                        fill.fill_amount
                                    };

                                    match protocol.run_mint_bridged_shares_phase(
                                        current_cycle, order_itp, mapping.original_user, shares, bridge_proxy, settlement_id, batch_am_leader,
                                    ).await {
                                        Ok(mint_result) => {
                                            if batch_am_leader && !mint_result.aggregated_signature.0.is_empty() {
                                                match settlement_writer.mint_bridged_shares(order_itp, mapping.original_user, shares, settlement_id, mint_result.aggregated_signature.0.clone(), protocol.registry_nonce(), mint_result.signer_bitmap).await {
                                                    Ok(tx_hash) => {
                                                        info!(?tx_hash, user = ?mapping.original_user, "mintBridgedShares submitted (post-fills), waiting for receipt");
                                                        const RECEIPT_TIMEOUT_SECS: u64 = 60;
                                                        match settlement_writer.wait_for_receipt(tx_hash, RECEIPT_TIMEOUT_SECS).await {
                                                            Ok(receipt) => {
                                                                let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
                                                                if success {
                                                                    info!(?tx_hash, "mintBridgedShares CONFIRMED (post-fills)");
                                                                    let orch = orchestrator.write().await;
                                                                    orch.mark_orders_shares_bridged(&[settlement_id]).await;
                                                                } else {
                                                                    warn!(?tx_hash, "mintBridgedShares REVERTED (post-fills) — stays Batched");
                                                                }
                                                            }
                                                            Err(e) => warn!(error = %e, "mintBridgedShares receipt timeout (post-fills) — stays Batched"),
                                                        }
                                                    }
                                                    Err(e) => {
                                                        let err_str = format!("{}", e);
                                                        if err_str.contains("MintAlreadyProcessed") || err_str.contains("E139") {
                                                            info!(order_id = %settlement_id, "mintBridgedShares already processed — marking SharesBridged");
                                                            let orch = orchestrator.write().await;
                                                            orch.mark_orders_shares_bridged(&[settlement_id]).await;
                                                        } else {
                                                            warn!(error = %e, "mintBridgedShares failed (post-fills) — stays Batched");
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        Err(e) => warn!(cycle = current_cycle, error = %e, "MintBridgedShares failed (post-fills path)"),
                                    }
                                } else {
                                    warn!(order_id = %fill.order_id, "No order mapping found (post-fills path)");
                                }
                            }
                        }
                    } else {
                        warn!(cycle = current_cycle, error = %e, "Fills confirmation failed");
                    }
                }
            }
            } // end cbo_confirmed_orders guard
        }
    }
}

/// Cross-chain SELL order processing from Settlement
///
/// Full 3-phase consensus-driven sell flow:
/// Phase A: Submit sell on L3 (consensus) — submitOrderFor(SELL)
/// Phase B: Batch/trades/fills (reuse existing consensus phases)
/// Phase C: Complete sell on Settlement (consensus) — completeSellOrder()
async fn run_cross_chain_sell_processing<P, W, K, PF>(
    protocol: Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    settlement_reader: Arc<dyn issuer::SettlementReader>,
    orchestrator: Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    settlement_writer: Arc<issuer::SettlementChainWriter>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    _data_node_url_for_task: Option<String>,
    itp_id_for_task: String,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
    block_cursor: Arc<std::sync::atomic::AtomicU64>,
    startup_sell_orders: Arc<tokio::sync::Mutex<Vec<common::types::CrossChainSellOrderEvent>>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    let confirmed_block = match settlement_reader.get_confirmed_block().await {
        Ok(block) => block,
        Err(e) => { info!(cycle = current_cycle, error = %e, "Sell: failed to get confirmed block"); return; }
    };

    if confirmed_block == 0 { info!(cycle = current_cycle, "Sell: confirmed_block=0, skipping"); return; }

    // Use cursor for incremental scanning (fallback: 200 blocks back on first run ~3 min on Sonic).
    // Kept short to avoid re-processing stale bridge orders from previous issuer sessions.
    let cursor_val = block_cursor.load(Ordering::Relaxed);
    let from_block = if cursor_val > 0 { cursor_val } else { confirmed_block.saturating_sub(200) };

    // ====== Phase A: Detect new sell orders and submit on L3 via consensus ======
    match settlement_reader.get_confirmed_cross_chain_sell_orders(from_block, confirmed_block).await {
        Ok(sell_orders) => {
            let raw_count = sell_orders.len();
            // Filter event-discovered sell orders
            let mut new_sell_orders = Vec::new();
            {
                let orch = orchestrator.read().await;
                for order in &sell_orders {
                    if orch.get_sell_order_status(&order.order_id).await.is_none() {
                        new_sell_orders.push(order.clone());
                    }
                }
            }
            if raw_count > 0 || cursor_val == 0 {
                info!(cycle = current_cycle, from_block, to_block = confirmed_block, raw_count, new_count = new_sell_orders.len(), "Sell scan results");
            }

            // Merge startup-discovered sell orders (one-time drain)
            {
                let mut startup = startup_sell_orders.lock().await;
                if !startup.is_empty() {
                    let extra_orders = std::mem::take(&mut *startup);
                    info!(count = extra_orders.len(), "Injecting startup-discovered sell orders into pipeline");
                    let orch = orchestrator.read().await;
                    for order in extra_orders {
                        if orch.get_sell_order_status(&order.order_id).await.is_some() {
                            continue;
                        }
                        new_sell_orders.push(order);
                    }
                }
            }

            // Deduplicate by order_id (event scan + startup injection may overlap)
            new_sell_orders.sort_by_key(|o| o.order_id);
            new_sell_orders.dedup_by_key(|o| o.order_id);

            if new_sell_orders.is_empty() {
                debug!(cycle = current_cycle, "No new cross-chain sell orders");
            } else {
                info!(cycle = current_cycle, order_count = new_sell_orders.len(), from_block, to_block = confirmed_block, "Found cross-chain sell orders");

                // Set initial status for all sell orders before spawning
                {
                    let orch_write = orchestrator.write().await;
                    for sell_order in &new_sell_orders {
                        orch_write.set_sell_order_status(sell_order.order_id, issuer::BridgeOrderStatus::SellPending).await;
                        orch_write.set_sell_order_amount(sell_order.order_id, sell_order.amount).await;
                        orch_write.set_sell_order_itp_id(sell_order.order_id, sell_order.itp_id).await;
                        // Task 2: store limit price from settlement event
                        orch_write.set_sell_order_limit_price(sell_order.order_id, sell_order.limit_price).await;
                        // Cache user + bridged_itp_address from event (avoids needing to re-read from settlement)
                        orch_write.set_sell_order_user(sell_order.order_id, sell_order.user).await;
                        orch_write.set_sell_order_bridged_itp(sell_order.order_id, sell_order.bridged_itp_address).await;
                    }
                }

                let chain_id = settlement_reader.chain_id();
                // Task 4: Phase A sub-step 1 — burn BridgedITP on Settlement (non-blocking)
                // Process SellPending orders: run burn consensus, submit burn tx, advance to SellBurnPending
                for sell_order in new_sell_orders {
                    let am_leader = calculate_bridge_leader(sell_order.order_id.as_u64(), num_issuers, node_index);
                    info!(
                        order_id = %sell_order.order_id,
                        itp_id = ?sell_order.itp_id,
                        user = ?sell_order.user,
                        amount = %sell_order.amount,
                        am_leader,
                        "Phase A burn: Processing cross-chain sell order"
                    );

                    match protocol.run_burn_sell_order_phase(sell_order.order_id, am_leader).await {
                        Ok(burn_result) => {
                            if am_leader && !burn_result.aggregated_signature.0.is_empty() {
                                // Leader: submit burn tx (fire-and-forget, don't wait for receipt)
                                match settlement_writer.burn_sell_order_shares(
                                    sell_order.order_id,
                                    burn_result.aggregated_signature.0.clone(),
                                    protocol.registry_nonce(),
                                    burn_result.signer_bitmap,
                                ).await {
                                    Ok(tx_hash) => {
                                        info!(order_id = %sell_order.order_id, ?tx_hash, "burnSellOrderShares tx submitted (non-blocking)");
                                        let orch = orchestrator.write().await;
                                        orch.set_sell_burn_tx_hash(sell_order.order_id, tx_hash).await;
                                        orch.set_sell_order_status(sell_order.order_id, issuer::BridgeOrderStatus::SellBurnPending).await;
                                    }
                                    Err(e) => {
                                        // Check on-chain state instead of string matching
                                        let on_chain_burned = settlement_reader
                                            .get_cross_chain_sell_order(sell_order.order_id).await
                                            .ok().flatten().map(|o| o.burned)
                                            .unwrap_or(false);
                                        if on_chain_burned {
                                            info!(order_id = %sell_order.order_id, "burnSellOrderShares already confirmed on-chain — marking SellBurned");
                                            let orch = orchestrator.write().await;
                                            orch.set_sell_order_status(sell_order.order_id, issuer::BridgeOrderStatus::SellBurned).await;
                                        } else {
                                            warn!(order_id = %sell_order.order_id, error = %e, "burn tx failed — stays SellPending for retry");
                                        }
                                    }
                                }
                            } else if !am_leader {
                                // Follower: trust consensus — leader will submit burn tx with valid BLS proof.
                                // Advance directly to SellBurned; the L3 submit phase also requires consensus.
                                info!(order_id = %sell_order.order_id, "Burn consensus succeeded — follower advancing to SellBurned");
                                let orch = orchestrator.write().await;
                                orch.set_sell_order_status(sell_order.order_id, issuer::BridgeOrderStatus::SellBurned).await;
                            }
                        }
                        Err(e) => warn!(order_id = %sell_order.order_id, error = %e, "Burn consensus failed — stays SellPending"),
                    }

                    settlement_reader.mark_sell_order_processed(chain_id, sell_order.order_id).await;
                }
            }
        }
        Err(e) => { warn!(cycle = current_cycle, error = %e, "Failed to fetch cross-chain sell orders"); }
    }

    // ====== Phase A retry: Re-attempt burn consensus for SellPending orders ======
    {
        let pending_sell_orders: Vec<ethers::types::U256> = {
            let o = orchestrator.read().await;
            o.sell_order_status_snapshot().await.iter()
                .filter(|(_, s)| matches!(s, issuer::BridgeOrderStatus::SellPending))
                .map(|(id, _)| *id)
                .collect()
        };
        for order_id in pending_sell_orders {
            let am_leader = calculate_bridge_leader(order_id.as_u64(), num_issuers, node_index);
            info!(order_id = %order_id, am_leader, "Retrying burn consensus for SellPending order");
            match protocol.run_burn_sell_order_phase(order_id, am_leader).await {
                Ok(burn_result) => {
                    if am_leader && !burn_result.aggregated_signature.0.is_empty() {
                        match settlement_writer.burn_sell_order_shares(
                            order_id,
                            burn_result.aggregated_signature.0.clone(),
                            protocol.registry_nonce(),
                            burn_result.signer_bitmap,
                        ).await {
                            Ok(tx_hash) => {
                                info!(order_id = %order_id, ?tx_hash, "burnSellOrderShares tx submitted (retry)");
                                let orch = orchestrator.write().await;
                                orch.set_sell_burn_tx_hash(order_id, tx_hash).await;
                                orch.set_sell_order_status(order_id, issuer::BridgeOrderStatus::SellBurnPending).await;
                            }
                            Err(e) => {
                                warn!(order_id = %order_id, error = %e, "burn tx failed on retry — stays SellPending");
                            }
                        }
                    }
                    if !am_leader {
                        // Follower: trust consensus — advance to SellBurned
                        info!(order_id = %order_id, "Burn consensus succeeded on retry — follower advancing to SellBurned");
                        let orch = orchestrator.write().await;
                        orch.set_sell_order_status(order_id, issuer::BridgeOrderStatus::SellBurned).await;
                    }
                }
                Err(e) => warn!(order_id = %order_id, error = %e, "Burn consensus retry failed — stays SellPending"),
            }
        }
    }

    // ====== Phase A sub-step 2: Check SellBurnPending receipts (non-blocking) ======
    let burn_pending_orders = {
        let o = orchestrator.read().await;
        o.get_burn_pending_sell_orders().await
    };
    for order_id in burn_pending_orders {
        let am_leader = calculate_bridge_leader(order_id.as_u64(), num_issuers, node_index);
        if am_leader {
            // Leader: check receipt for stored tx_hash
            // Extract read into separate binding to ensure RwLockReadGuard drops before write
            let maybe_tx_hash = {
                let o = orchestrator.read().await;
                o.get_sell_burn_tx_hash(&order_id).await
            };
            if let Some(tx_hash) = maybe_tx_hash {
                match settlement_writer.wait_for_receipt(tx_hash, 5).await {
                    Ok(receipt) => {
                        let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
                        if success {
                            info!(order_id = %order_id, ?tx_hash, "burnSellOrderShares CONFIRMED on-chain");
                            let orch = orchestrator.write().await;
                            orch.set_sell_order_status(order_id, issuer::BridgeOrderStatus::SellBurned).await;
                            orch.clear_sell_burn_tx_hash(&order_id).await;
                            drop(orch);
                            info!(order_id = %order_id, "Status set to SellBurned, proceeding to sub-step 3");
                        } else {
                            warn!(order_id = %order_id, ?tx_hash, "burnSellOrderShares REVERTED — resetting to SellPending");
                            let orch = orchestrator.write().await;
                            orch.set_sell_order_status(order_id, issuer::BridgeOrderStatus::SellPending).await;
                            orch.clear_sell_burn_tx_hash(&order_id).await;
                        }
                    }
                    Err(_) => {
                        // Receipt not ready yet — stay SellBurnPending, will check next cycle
                        debug!(order_id = %order_id, "burnSellOrderShares receipt not ready yet");
                    }
                }
            }
        } else {
            // Follower: consensus already succeeded (that's how we got to SellBurnPending).
            // Trust that the leader's burn tx will confirm and advance to SellBurned.
            info!(order_id = %order_id, "Follower at SellBurnPending — advancing to SellBurned (consensus already passed)");
            let orch = orchestrator.write().await;
            orch.set_sell_order_status(order_id, issuer::BridgeOrderStatus::SellBurned).await;
        }
    }

    // ====== Phase A sub-step 3: Submit SellBurned orders on L3 ======
    let burned_sell_orders = {
        let o = orchestrator.read().await;
        o.get_burned_sell_orders().await
    };
    info!(cycle = current_cycle, burned_count = burned_sell_orders.len(), "Phase A sub-step 3: checking SellBurned orders");
    for order_id in burned_sell_orders {
        let am_leader = calculate_bridge_leader(order_id.as_u64(), num_issuers, node_index);
        // Read all cached fields from orchestrator (stored when event was first detected)
        let (itp_id, amount, user, bridged_itp_address) = {
            let orch_r = orchestrator.read().await;
            let itp_id = orch_r.get_sell_order_itp_id(&order_id).await.unwrap_or_default();
            let amount = orch_r.get_sell_order_amount(&order_id).await;
            let user = orch_r.get_sell_order_user(&order_id).await;
            let bridged_itp = orch_r.get_sell_order_bridged_itp(&order_id).await;
            (itp_id, amount, user, bridged_itp)
        };
        let amount = match amount {
            Some(a) => a,
            None => {
                warn!(order_id = %order_id, "Sell order amount not found — skipping");
                continue;
            }
        };
        let user = match user {
            Some(u) => u,
            None => {
                warn!(order_id = %order_id, "Sell order user not cached — skipping");
                continue;
            }
        };
        let bridged_itp_address = match bridged_itp_address {
            Some(a) => a,
            None => {
                warn!(order_id = %order_id, "Sell order bridged_itp not cached — skipping");
                continue;
            }
        };

        info!(order_id = %order_id, am_leader, "Phase A sub-step 3: Submitting burned sell order on L3");

        match protocol.run_submit_sell_order_phase(
            order_id, itp_id, user, bridged_itp_address, amount, am_leader,
        ).await {
            Ok(submit_result) => {
                info!(order_id = %order_id, signer_count = submit_result.signature_count, "Submit sell order consensus completed");
                let orch_write = orchestrator.write().await;
                orch_write.set_sell_order_status(order_id, issuer::BridgeOrderStatus::SellSubmittedOnL3).await;
            }
            Err(e) => {
                warn!(order_id = %order_id, error = %e, am_leader, "Submit sell order consensus failed — will retry");
            }
        }
    }

    // ====== Phase B: Batch/trades/fills for SellSubmittedOnL3 orders ======
    let submitted_sell_orders = {
        let o = orchestrator.read().await;
        o.get_submitted_sell_orders().await
    };

    if !submitted_sell_orders.is_empty() {
        let batch_key = submitted_sell_orders.first().map(|id| id.as_u64()).unwrap_or(current_cycle);
        let batch_am_leader = calculate_bridge_leader(batch_key, num_issuers, node_index);
        info!(cycle = current_cycle, order_count = submitted_sell_orders.len(), batch_am_leader, "Processing batch for SellSubmittedOnL3 orders");

        // Resolve settlement sell IDs → L3 order IDs
        let l3_order_ids = {
            let o = orchestrator.read().await;
            o.resolve_sell_l3_order_ids(&submitted_sell_orders).await
        };

        if l3_order_ids.is_empty() && batch_am_leader {
            warn!(cycle = current_cycle, "No L3 order IDs resolved for sell orders (leader only has mappings)");
        }

        // Use L3 order IDs if available, otherwise use settlement IDs (followers don't have mappings)
        let order_ids_for_batch = if !l3_order_ids.is_empty() {
            l3_order_ids
        } else {
            submitted_sell_orders.clone()
        };

        // Build fill-order-id → settlement-id lookup (handles skips correctly)
        let fill_to_settlement: HashMap<ethers::types::U256, ethers::types::U256> =
            order_ids_for_batch.iter().zip(submitted_sell_orders.iter())
                .map(|(l3_id, settlement_id)| (*l3_id, *settlement_id))
                .collect();

        // Fetch NAV per unique ITP for sell orders (multi-ITP support)
        let mut sell_nav_cache: HashMap<String, ethers::types::U256> = HashMap::new();
        let prices: Vec<ethers::types::U256> = {
            let o = orchestrator.read().await;
            let mut p = Vec::new();
            for order_id in &submitted_sell_orders {
                let itp_id_str = if let Some(itp_h256) = o.get_sell_order_itp_id(order_id).await {
                    format!("{:#066x}", itp_h256)
                } else {
                    itp_id_for_task.clone()
                };
                let nav = if let Some(cached) = sell_nav_cache.get(&itp_id_str) {
                    *cached
                } else {
                    let fetched = local_nav_fallback;
                    sell_nav_cache.insert(itp_id_str.clone(), fetched);
                    fetched
                };
                p.push(nav);
            }
            p
        };
        info!(cycle = current_cycle, nav_cache = ?sell_nav_cache, "NAV(s) for sell batch/fills");

        match protocol.run_batch_confirm_phase(current_cycle, order_ids_for_batch.clone(), prices.clone(), batch_am_leader).await {
            Ok(batch_result) => {
                info!(cycle = current_cycle, signer_count = batch_result.signature_count, "Sell batch confirmation completed");

                // Emit per-asset SELL trades (using each order's actual itp_id)
                {
                    let asset_trade_orders: Vec<(ethers::types::H256, u8, ethers::types::U256)> = {
                        let o = orchestrator.read().await;
                        let mut trades = Vec::new();
                        for order_id in &submitted_sell_orders {
                            let order_itp = o.get_sell_order_itp_id(order_id).await
                                .unwrap_or_else(|| itp_id_for_task.parse::<ethers::types::H256>().unwrap_or_default());
                            let amount = match o.get_sell_order_amount(order_id).await {
                                Some(a) => a,
                                None => { warn!(order_id = %order_id, "Sell order amount missing — skipping trade"); continue; }
                            };
                            trades.push((order_itp, 1u8 /* SELL */, amount));
                        }
                        trades
                    };

                    match protocol.run_asset_trades_phase(current_cycle, &asset_trade_orders, &chain_reader, batch_am_leader, quote_tokens.as_ref()).await {
                        Ok(at_result) => {
                            info!(
                                cycle = current_cycle,
                                signer_count = at_result.signature_count,
                                "Cross-chain sell asset trades emitted (side=1)"
                            );
                        }
                        Err(e) => {
                            warn!(cycle = current_cycle, error = %e, "Sell asset trades emission failed (fills will proceed)");
                        }
                    }
                }

                // Confirm fills for sell orders (per-order NAV from prices vector)
                let fills: Vec<Fill> = {
                    let o = orchestrator.read().await;
                    let mut fills = Vec::new();
                    for (i, order_id) in order_ids_for_batch.iter().enumerate() {
                        let settlement_order_id = submitted_sell_orders.get(i).unwrap_or(order_id);
                        let order_nav = prices.get(i).copied().unwrap_or(local_nav_fallback);
                        let amount = match o.get_sell_order_amount(settlement_order_id).await {
                            Some(a) => a,
                            None => { warn!(order_id = %order_id, "Sell order amount missing — skipping fill"); continue; }
                        };
                        // Task 2: Check limit price before filling
                        if let Some(limit_price) = o.get_sell_order_limit_price(settlement_order_id).await {
                            if !limit_price.is_zero() && !fill_price_respects_limit(order_nav, limit_price, common::types::Side::Sell) {
                                warn!(order_id = %order_id, nav = %order_nav, limit = %limit_price, "Skipping sell fill: NAV violates limit price");
                                continue;
                            }
                        }
                        fills.push(Fill {
                            order_id: *order_id,
                            fill_price: order_nav,
                            fill_amount: amount,
                        });
                    }
                    fills
                };

                match protocol.run_fills_confirm_phase(current_cycle, fills.clone(), batch_am_leader).await {
                    Ok(fills_result) => {
                        info!(cycle = current_cycle, signer_count = fills_result.signature_count, "Sell fills confirmed");

                        // Task 3: Store actual fill data for Phase C proceeds calculation
                        {
                            let orch = orchestrator.write().await;
                            for fill in fills.iter() {
                                let settlement_id = fill_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                orch.set_sell_order_fill_price(settlement_id, fill.fill_price).await;
                                orch.set_sell_order_fill_amount(settlement_id, fill.fill_amount).await;
                            }
                        }

                        // Mark only FILLED orders as SellFilled (orders skipped by limit price stay SellSubmittedOnL3)
                        let filled_settlement_ids: Vec<ethers::types::U256> = fills.iter()
                            .map(|f| fill_to_settlement.get(&f.order_id).copied().unwrap_or(f.order_id))
                            .collect();
                        let orch = orchestrator.write().await;
                        for oid in &filled_settlement_ids {
                            orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::SellFilled).await;
                        }
                    }
                    Err(e) => {
                        let fills_err = format!("{}", e);
                        if fills_err.contains("6e6e29cb") || fills_err.contains("already") || fills_err.contains("reverted on-chain") {
                            info!(cycle = current_cycle, "Sell order already filled on-chain, marking as SellFilled");
                            // Store fill data even on already-filled path (H2 fix)
                            let orch = orchestrator.write().await;
                            for fill in fills.iter() {
                                let settlement_id = fill_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                orch.set_sell_order_fill_price(settlement_id, fill.fill_price).await;
                                orch.set_sell_order_fill_amount(settlement_id, fill.fill_amount).await;
                            }
                            // Mark only filled orders (skipped orders stay SellSubmittedOnL3)
                            let filled_settlement_ids: Vec<ethers::types::U256> = fills.iter()
                                .map(|f| fill_to_settlement.get(&f.order_id).copied().unwrap_or(f.order_id))
                                .collect();
                            for oid in &filled_settlement_ids {
                                orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::SellFilled).await;
                            }
                        } else {
                            warn!(cycle = current_cycle, error = %e, "Sell fills confirmation failed");
                            let orch = orchestrator.write().await;
                            // Mark only filled orders as Failed (skipped orders stay SellSubmittedOnL3)
                            let filled_settlement_ids: Vec<ethers::types::U256> = fills.iter()
                                .map(|f| fill_to_settlement.get(&f.order_id).copied().unwrap_or(f.order_id))
                                .collect();
                            for oid in &filled_settlement_ids {
                                orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::Failed).await;
                            }
                            drop(orch);
                        }
                    }
                }
            }
            Err(e) => {
                let err_str = format!("{}", e);
                if err_str.contains("E021") || err_str.contains("7a5425d1") || err_str.contains("AlreadyBatched") {
                    info!(cycle = current_cycle, "Sell orders already batched (E021), skipping to fills");
                    let fills: Vec<Fill> = {
                        let o = orchestrator.read().await;
                        let mut fills = Vec::new();
                        for (i, order_id) in order_ids_for_batch.iter().enumerate() {
                            let settlement_order_id = submitted_sell_orders.get(i).unwrap_or(order_id);
                            let order_nav = prices.get(i).copied().unwrap_or(local_nav_fallback);
                            let amount = match o.get_sell_order_amount(settlement_order_id).await {
                                Some(a) => a,
                                None => { warn!(order_id = %order_id, "Sell order amount missing (E021 path) — skipping"); continue; }
                            };
                            // Limit price check (same as normal path)
                            if let Some(limit_price) = o.get_sell_order_limit_price(settlement_order_id).await {
                                if !limit_price.is_zero() && !fill_price_respects_limit(order_nav, limit_price, common::types::Side::Sell) {
                                    warn!(order_id = %order_id, nav = %order_nav, limit = %limit_price, "Skipping sell fill (E021): NAV violates limit price");
                                    continue;
                                }
                            }
                            fills.push(Fill {
                                order_id: *order_id,
                                fill_price: order_nav,
                                fill_amount: amount,
                            });
                        }
                        fills
                    };

                    match protocol.run_fills_confirm_phase(current_cycle, fills.clone(), batch_am_leader).await {
                        Ok(fills_result) => {
                            info!(cycle = current_cycle, signer_count = fills_result.signature_count, "Sell fills confirmed (after E021)");
                            // Store fill data for Phase C
                            {
                                let orch = orchestrator.write().await;
                                for fill in fills.iter() {
                                    let settlement_id = fill_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                    orch.set_sell_order_fill_price(settlement_id, fill.fill_price).await;
                                    orch.set_sell_order_fill_amount(settlement_id, fill.fill_amount).await;
                                }
                            }
                            // Mark only filled orders (skipped orders stay SellSubmittedOnL3)
                            let filled_settlement_ids: Vec<ethers::types::U256> = fills.iter()
                                .map(|f| fill_to_settlement.get(&f.order_id).copied().unwrap_or(f.order_id))
                                .collect();
                            let orch = orchestrator.write().await;
                            for oid in &filled_settlement_ids {
                                orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::SellFilled).await;
                            }
                        }
                        Err(e) => {
                            let fills_err = format!("{}", e);
                            if fills_err.contains("6e6e29cb") || fills_err.contains("already") {
                                info!(cycle = current_cycle, "Sell order already filled (E021), marking as SellFilled");
                                // Store fill data even on already-filled path (H2 fix)
                                let orch = orchestrator.write().await;
                                for fill in fills.iter() {
                                    let settlement_id = fill_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                    orch.set_sell_order_fill_price(settlement_id, fill.fill_price).await;
                                    orch.set_sell_order_fill_amount(settlement_id, fill.fill_amount).await;
                                }
                                let filled_settlement_ids: Vec<ethers::types::U256> = fills.iter()
                                    .map(|f| fill_to_settlement.get(&f.order_id).copied().unwrap_or(f.order_id))
                                    .collect();
                                for oid in &filled_settlement_ids {
                                    orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::SellFilled).await;
                                }
                            } else {
                                warn!(cycle = current_cycle, error = %e, "Sell fills also failed after E021");
                                let orch = orchestrator.write().await;
                                let filled_settlement_ids: Vec<ethers::types::U256> = fills.iter()
                                    .map(|f| fill_to_settlement.get(&f.order_id).copied().unwrap_or(f.order_id))
                                    .collect();
                                for oid in &filled_settlement_ids {
                                    orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::Failed).await;
                                }
                                drop(orch);
                            }
                        }
                    }
                } else {
                    warn!(cycle = current_cycle, error = %e, "Sell batch confirmation failed");
                    let orch = orchestrator.write().await;
                    for oid in &submitted_sell_orders {
                        orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::Failed).await;
                    }
                    drop(orch);
                }
            }
        }
    }

    // ====== Phase C: Complete sell on Settlement for SellFilled orders ======
    let filled_sell_orders: Vec<ethers::types::U256> = {
        let o = orchestrator.read().await;
        let snapshot = o.sell_order_status_snapshot().await;
        snapshot.iter()
            .filter(|(_, status)| **status == issuer::BridgeOrderStatus::SellFilled)
            .map(|(order_id, _)| *order_id)
            .collect()
    };

    for order_id in filled_sell_orders {
        let am_leader = calculate_bridge_leader(order_id.as_u64(), num_issuers, node_index);

        // Task 3/12: Use STORED fill price (not fresh NAV) for proceeds — prevents NAV drift
        let usdc_proceeds = {
            let o = orchestrator.read().await;
            let fill_amount = o.get_sell_order_fill_amount(&order_id).await;
            let fill_price = o.get_sell_order_fill_price(&order_id).await;

            let fill_amount = match fill_amount {
                Some(a) if !a.is_zero() => a,
                _ => {
                    warn!(order_id = %order_id, "Cannot calculate proceeds — no fill amount");
                    continue;
                }
            };
            let fill_price = match fill_price {
                Some(p) if !p.is_zero() => p,
                _ => {
                    warn!(order_id = %order_id, "Cannot calculate proceeds — no fill price");
                    continue;
                }
            };

            // proceeds_18dec = fill_amount * fill_price / 1e18, then /1e12 for 6-dec
            let proceeds_18dec = fill_amount * fill_price / ethers::types::U256::exp10(18);
            let proceeds_6dec = proceeds_18dec / ethers::types::U256::exp10(12);

            // If proceeds round to zero, DON'T skip — call completeSellOrder with 0
            // to cleanly delete the order on-chain (contract handles usdcProceeds=0 gracefully)
            if proceeds_6dec.is_zero() {
                warn!(order_id = %order_id, fill_amount = %fill_amount, fill_price = %fill_price,
                      "Proceeds round to zero after decimal conversion — completing with 0 to close order");
            }

            proceeds_6dec
        };

        info!(
            order_id = %order_id,
            usdc_proceeds = %usdc_proceeds,
            am_leader,
            "Phase C: Completing sell order on Settlement"
        );

        let vault = orchestrator.read().await.config().bitget_vault;

        match protocol.run_complete_sell_order_phase(order_id, usdc_proceeds, vault, am_leader).await {
            Ok(result) => {
                info!(
                    order_id = %order_id,
                    signer_count = result.signature_count,
                    "Complete sell order consensus succeeded"
                );

                // Leader: call settlement_writer.complete_sell_order (atomically pulls from vault→user)
                if am_leader && !result.aggregated_signature.0.is_empty() {
                    match settlement_writer.complete_sell_order(
                        order_id,
                        usdc_proceeds,
                        vault,
                        result.aggregated_signature.0.clone(),
                        protocol.registry_nonce(),
                        result.signer_bitmap,
                    ).await {
                        Ok(tx_hash) => {
                            info!(
                                order_id = %order_id,
                                tx_hash = ?tx_hash,
                                "completeSellOrder transaction submitted"
                            );

                            // Wait for receipt
                            const RECEIPT_TIMEOUT_SECS: u64 = 60;
                            match settlement_writer.wait_for_receipt(tx_hash, RECEIPT_TIMEOUT_SECS).await {
                                Ok(receipt) => {
                                    let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
                                    if success {
                                        info!(
                                            order_id = %order_id,
                                            tx_hash = ?tx_hash,
                                            block = ?receipt.block_number,
                                            "completeSellOrder CONFIRMED"
                                        );
                                        let orch = orchestrator.write().await;
                                        orch.mark_sell_order_processed(order_id, tx_hash).await;
                                    } else {
                                        warn!(order_id = %order_id, tx_hash = ?tx_hash, "completeSellOrder REVERTED — leaving SellFilled for retry");
                                    }
                                }
                                Err(e) => {
                                    warn!(order_id = %order_id, error = %e, "completeSellOrder receipt timeout — leaving SellFilled for retry");
                                    // Do NOT mark as completed — order stays SellFilled for watchdog retry
                                }
                            }
                        }
                        Err(e) => {
                            let err_str = format!("{}", e);
                            if err_str.contains("E119") || err_str.contains("SellOrderNotFound") {
                                info!(order_id = %order_id, "completeSellOrder already done (E119) — marking completed");
                                let orch = orchestrator.write().await;
                                orch.mark_sell_order_processed(order_id, ethers::types::H256::zero()).await;
                            } else {
                                warn!(order_id = %order_id, error = %e, "completeSellOrder failed — leaving SellFilled for retry");
                            }
                        }
                    }
                } else if !am_leader {
                    // Follower: consensus succeeded, leader will submit tx.
                    // Set SellCompleted to prevent stale watchdog retry loop.
                    // Do NOT call mark_sell_order_processed — keep fill data
                    // intact so we can still verify proceeds if leader retries.
                    let orch = orchestrator.write().await;
                    orch.set_sell_order_status(order_id, issuer::BridgeOrderStatus::SellCompleted).await;
                }
            }
            Err(e) => {
                warn!(order_id = %order_id, error = %e, am_leader, "Complete sell order consensus failed");
            }
        }
    }

    // Advance cursor to confirmed_block (next poll starts from here)
    block_cursor.store(confirmed_block, Ordering::Relaxed);

    // Periodic cleanup
    if current_cycle % 1000 == 0 {
        settlement_reader.clear_old_seen_sell_orders(100_000).await;
    }
}

/// Story 7-14: Process pending rebalances via single-phase consensus
///
/// Scans L3 for RebalanceRequested events via chain_reader and runs a single
/// consensus phase per ITP, calling `rebalance()` on-chain (matches contract).
async fn run_rebalance_processing<P, W, K, PF>(
    protocol: Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    orchestrator: Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    price_fetcher: Arc<dyn PriceFetcher>,
    _symbol_map: issuer::SymbolMap,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    info!(cycle = current_cycle, "Rebalance processing: starting scan");
    // 1. Query pending rebalances from L3
    let pending_rebalances = match chain_reader.get_pending_rebalances().await {
        Ok(rebalances) => rebalances,
        Err(e) => {
            if current_cycle % 100 == 0 {
                warn!(cycle = current_cycle, error = %e, "Failed to fetch pending rebalances");
            }
            return;
        }
    };

    if pending_rebalances.is_empty() {
        if current_cycle % 500 == 0 {
            debug!(cycle = current_cycle, "Rebalance processing: no pending rebalances");
        }
        return;
    }

    info!(cycle = current_cycle, count = pending_rebalances.len(), "Rebalance processing: found pending rebalances");

    // 1b. Filter out ITPs already being processed by another cycle (dedup)
    let orch_read = orchestrator.read().await;
    let mut filtered_rebalances = Vec::new();
    let mut filtered_itp_ids = Vec::new();
    for rebalance in &pending_rebalances {
        let itp_h256 = ethers::types::H256::from(rebalance.itp_id);
        if orch_read.is_rebalance_in_progress(&itp_h256).await {
            info!(
                itp_id = ?itp_h256,
                cycle = current_cycle,
                "Skipping rebalance: already in progress from another cycle"
            );
            continue;
        }
        filtered_rebalances.push(rebalance);
        filtered_itp_ids.push(itp_h256);
    }
    drop(orch_read);

    if filtered_rebalances.is_empty() {
        info!(cycle = current_cycle, "All pending rebalances already in progress");
        return;
    }

    // Mark all as in-progress before starting consensus
    {
        let orch_read = orchestrator.read().await;
        for itp_id in &filtered_itp_ids {
            orch_read.mark_rebalance_started(*itp_id).await;
        }
    }

    // 2. Collect all unique asset addresses from all pending rebalances
    let mut all_assets: Vec<ethers::types::Address> = Vec::new();
    for rebalance in &filtered_rebalances {
        for addr in &rebalance.current_assets {
            if !all_assets.contains(addr) {
                all_assets.push(*addr);
            }
        }
        for addr in &rebalance.add_assets {
            if !all_assets.contains(addr) {
                all_assets.push(*addr);
            }
        }
    }

    // 3. Fetch prices via the configured price fetcher (backend or Bitget depending on config)
    let price_map: HashMap<ethers::types::Address, ethers::types::U256> = match price_fetcher.fetch_prices(&all_assets).await {
        Ok(fetched) => fetched.into_iter().map(|p| (p.asset, p.price)).collect(),
        Err(e) => {
            warn!(cycle = current_cycle, error = %e, "Price fetch failed for rebalance prices");
            HashMap::new()
        }
    };

    // 4. Cycle offset to avoid collision with buy (+0) and sell (+500M) cycles
    let rebalance_cycle = current_cycle + 1_000_000_000;

    // 5. Leader election
    let am_leader = calculate_bridge_leader(rebalance_cycle, num_issuers, node_index);

    info!(
        cycle = current_cycle,
        rebalance_cycle,
        count = filtered_rebalances.len(),
        price_count = price_map.len(),
        am_leader,
        "Found pending rebalances (after dedup)"
    );

    // 6. For each ITP, run single-phase rebalance consensus + on-chain submission
    for rebalance in &filtered_rebalances {
        let itp_h256 = ethers::types::H256::from(rebalance.itp_id);

        // Look up prices for this ITP's current assets from the price map
        let mut prices: Vec<ethers::types::U256> = Vec::with_capacity(rebalance.current_assets.len());
        let mut missing_price = false;
        for addr in &rebalance.current_assets {
            match price_map.get(addr) {
                Some(&price) if !price.is_zero() => prices.push(price),
                _ => {
                    warn!(itp_id = ?itp_h256, asset = ?addr, "Missing or zero price for asset, skipping ITP");
                    missing_price = true;
                    break;
                }
            }
        }

        if missing_price || prices.is_empty() {
            warn!(itp_id = ?itp_h256, "Stalling rebalance — missing prices, will retry next cycle");
            continue;
        }

        // Build prices vector for the final asset list after removes + adds.
        // Contract does swap-and-pop in descending order, then appends new assets.
        let mut rebalance_prices = prices.clone();

        // Apply swap-and-pop in descending order (matches contract logic)
        for remove_idx in &rebalance.remove_indices {
            let idx = remove_idx.as_usize();
            if idx < rebalance_prices.len() {
                let last = rebalance_prices.len() - 1;
                if idx != last {
                    rebalance_prices.swap(idx, last);
                }
                rebalance_prices.pop();
            }
        }

        // For added assets, look up price from price_map
        let mut missing_add_price = false;
        for add_addr in &rebalance.add_assets {
            match price_map.get(add_addr) {
                Some(&price) if !price.is_zero() => rebalance_prices.push(price),
                _ => {
                    warn!(itp_id = ?itp_h256, asset = ?add_addr, "Missing price for added asset, stalling rebalance");
                    missing_add_price = true;
                    break;
                }
            }
        }
        if missing_add_price {
            warn!(itp_id = ?itp_h256, "Stalling rebalance — missing added asset prices, will retry next cycle");
            continue;
        }

        // Ensure prices match expected final count
        let final_asset_count = prices.len()
            - rebalance.remove_indices.len()
            + rebalance.add_assets.len();
        rebalance_prices.truncate(final_asset_count);

        // Build quote_tokens vector matching final asset order (same swap-and-pop + add)
        let rebalance_quote_tokens: Vec<ethers::types::Address> = {
            // Start with current assets' quote tokens
            let mut qt: Vec<ethers::types::Address> = rebalance.current_assets.iter().map(|addr| {
                quote_tokens.as_ref()
                    .and_then(|qt_map| qt_map.get(addr).copied())
                    .unwrap_or_else(ethers::types::Address::zero)
            }).collect();

            // Apply same swap-and-pop as prices
            for remove_idx in &rebalance.remove_indices {
                let idx = remove_idx.as_usize();
                if idx < qt.len() {
                    let last = qt.len() - 1;
                    if idx != last {
                        qt.swap(idx, last);
                    }
                    qt.pop();
                }
            }

            // Add quote tokens for added assets
            for add_addr in &rebalance.add_assets {
                let qt_addr = quote_tokens.as_ref()
                    .and_then(|qt_map| qt_map.get(add_addr).copied())
                    .unwrap_or_else(ethers::types::Address::zero);
                qt.push(qt_addr);
            }

            qt.truncate(final_asset_count);
            qt
        };

        match protocol.run_rebalance_phase(
            itp_h256,
            rebalance.remove_indices.clone(),
            rebalance.add_assets.clone(),
            rebalance.new_weights.clone(),
            rebalance_prices.clone(),
            rebalance_quote_tokens.clone(),
            am_leader,
        ).await {
            Ok(rebalance_result) => {
                info!(
                    itp_id = ?itp_h256,
                    signer_count = rebalance_result.signature_count,
                    "Rebalance consensus complete"
                );

                // Compute NAV from on-chain inventory + live prices.
                // This fixes the stale _itpNavs bug: the on-chain NAV is
                // stuck at 1e18 from createITP and never updated. Without
                // this, rebalance resets all quantities as if NAV=$1.00.
                // All nodes compute this so leader can propose and followers
                // can verify independently if needed.
                let computed_nav = {
                    let itp_bytes: [u8; 32] = itp_h256.into();
                    match chain_reader.get_itp_inventory_state(itp_bytes).await {
                        Ok(state) if !state.quantities.is_empty() => {
                            let scale = ethers::types::U256::exp10(18);
                            let mut nav = ethers::types::U256::zero();
                            for (asset, qty) in state.assets.iter().zip(state.quantities.iter()) {
                                if let Some(&price) = price_map.get(asset) {
                                    if let Some(contribution) = qty.checked_mul(price) {
                                        nav = nav + contribution / scale;
                                    }
                                }
                            }
                            if nav.is_zero() { scale } else { nav }
                        }
                        _ => ethers::types::U256::exp10(18),
                    }
                };

                // Run setItpNav BLS consensus to get a valid signature.
                // setItpNav calls _verifyBLS on-chain and will revert
                // without a properly aggregated signature.
                let nav_result = protocol.run_set_itp_nav_phase(
                    itp_h256,
                    computed_nav,
                    am_leader,
                ).await;

                // Leader submits rebalance() on-chain
                if am_leader {
                    // Extract nav BLS signature from consensus result
                    let nav_sig = match &nav_result {
                        Ok(result) if !result.aggregated_signature.0.is_empty() => {
                            result.aggregated_signature.0.clone()
                        }
                        Ok(_) => {
                            warn!(itp_id = ?itp_h256, "setItpNav consensus returned empty signature");
                            vec![]
                        }
                        Err(e) => {
                            warn!(itp_id = ?itp_h256, error = %e, "setItpNav consensus failed, proceeding with empty signature");
                            vec![]
                        }
                    };

                    let ref_nonce = protocol.registry_nonce();
                    let orch = orchestrator.read().await;
                    match orch.execute_rebalance(
                        itp_h256,
                        &rebalance.remove_indices,
                        &rebalance.add_assets,
                        &rebalance.new_weights,
                        &rebalance_prices,
                        &rebalance_quote_tokens,
                        &rebalance_result,
                        computed_nav,
                        &nav_sig,
                        ref_nonce,
                    ).await {
                        Ok(tx_hash) => {
                            info!(
                                itp_id = ?itp_h256,
                                tx_hash = ?tx_hash,
                                "Weights updated on-chain"
                            );
                        }
                        Err(e) => {
                            warn!(
                                itp_id = ?itp_h256,
                                error = %e,
                                "Failed to execute rebalance on-chain"
                            );
                        }
                    }
                }

                // Mark completed
                let orch_read = orchestrator.read().await;
                orch_read.mark_rebalance_completed(&itp_h256).await;
            }
            Err(e) => {
                warn!(
                    itp_id = ?itp_h256,
                    error = %e,
                    "Rebalance consensus failed"
                );
                // Clear in-progress on failure
                let orch_read = orchestrator.read().await;
                orch_read.mark_rebalance_completed(&itp_h256).await;
            }
        }
    }
}

/// Check if a fill price respects an order's limit price (E126 guard).
/// Returns true if the fill can proceed, false if it would violate the limit.
fn fill_price_respects_limit(
    fill_price: ethers::types::U256,
    limit_price: ethers::types::U256,
    side: common::types::Side,
) -> bool {
    if limit_price.is_zero() {
        return true; // No limit set
    }
    match side {
        common::types::Side::Buy => fill_price <= limit_price,
        common::types::Side::Sell => fill_price >= limit_price,
    }
}

/// Auto-process L3-native pending orders (sell orders, direct L3 buys).
///
/// These orders are NOT handled by the bridge pipeline (which only processes
/// CrossChainOrderCreated events from Settlement). This function runs confirmBatch +
/// confirmFills via BLS consensus for any pending orders not already tracked by
/// the BridgeOrchestrator.
async fn run_l3_native_order_processing<P, W, K, PF>(
    protocol: Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    orchestrator: Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    first_seen_orders: Arc<tokio::sync::Mutex<HashMap<u64, std::time::Instant>>>,
    _data_node_url_for_task: Option<String>,
    _itp_id_for_task: String,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    // Note: The old has_unmapped_bridge_orders() guard was removed because:
    // 1. Bridge orders in Pending/BridgedToL3 state don't have L3 counterparts on-chain yet,
    //    so get_pending_orders() won't see them anyway.
    // 2. Once they reach SubmittedOnL3, they have L3 IDs in order_mappings and step 2 filters them.
    // 3. The guard caused permanent blocking when bridge orders got stuck at Pending status.
    {

    // 1. Fetch all pending orders from L3
    let pending_orders = match chain_reader.get_pending_orders().await {
        Ok(orders) => orders,
        Err(e) => {
            debug!(cycle = current_cycle, error = %e, "Failed to fetch pending orders for L3-native processing");
            vec![]
        }
    };

    // 2. Filter out bridge-tracked orders (already managed by cross-chain pipeline)
    // Uses get_all_tracked_l3_order_ids() which checks order_mappings (keyed by settlement_id
    // but contains l3_order_id). The old get_order_status(l3_id) didn't work because
    // order_status is keyed by settlement_id, not l3_id.
    let l3_native_orders: Vec<_> = if !pending_orders.is_empty() {
        let orch = orchestrator.read().await;
        let tracked_l3_ids = orch.get_all_tracked_l3_order_ids().await;
        let mut native = Vec::new();
        for order in &pending_orders {
            let l3_id = order.id.as_u64();
            if !tracked_l3_ids.contains(&l3_id) {
                native.push(order.clone());
            }
        }
        native
    } else {
        vec![]
    };

    if !l3_native_orders.is_empty() {
    // 3. Leader assignment: cycle derived from max order ID (deterministic across issuers).
    // Using max ensures that when NEW orders arrive, the cycle number changes, avoiding
    // collision with previously-confirmed (or reverted) cycles from stale order sets.
    let max_order_id = l3_native_orders.iter().map(|o| o.id.as_u64()).max().unwrap();
    let l3_cycle = max_order_id + 500_000_000;

    // 4. Leader election with infinite failover rotation
    let detected_at = {
        let mut fso = first_seen_orders.lock().await;
        *fso.entry(l3_cycle).or_insert_with(std::time::Instant::now)
    };
    let attempt = detected_at.elapsed().as_secs() / LEADER_TIMEOUT_SECS;
    let am_leader = calculate_bridge_leader_with_failover(l3_cycle, num_issuers, node_index, attempt);

    info!(
        cycle = current_cycle, l3_cycle, attempt, am_leader,
        count = l3_native_orders.len(),
        order_ids = ?l3_native_orders.iter().map(|o| o.id.as_u64()).collect::<Vec<_>>(),
        "Processing L3-native pending orders"
    );

    // 5. Register order amounts in orchestrator for BLS signature tracking.
    // Do NOT set order_status here — L3-native order IDs can collide with
    // Settlement order IDs in the orchestrator's status map (see 3443 comment).
    {
        let orch = orchestrator.write().await;
        for order in &l3_native_orders {
            orch.set_order_amount(order.id, order.amount).await;
        }
    }

    let order_ids: Vec<ethers::types::U256> = l3_native_orders.iter().map(|o| o.id).collect();
    // Fetch NAV per unique ITP (multi-ITP support for L3-native orders)
    let mut l3_nav_cache: HashMap<String, ethers::types::U256> = HashMap::new();
    let prices: Vec<ethers::types::U256> = {
        let mut p = Vec::new();
        for order in &l3_native_orders {
            let itp_id_str = format!("{:#066x}", order.itp_id);
            let nav = if let Some(cached) = l3_nav_cache.get(&itp_id_str) {
                *cached
            } else {
                let fetched = local_nav_fallback;
                l3_nav_cache.insert(itp_id_str.clone(), fetched);
                fetched
            };
            p.push(nav);
        }
        p
    };

    // 6. Run confirmBatch via BLS consensus
    match protocol.run_batch_confirm_phase(l3_cycle, order_ids.clone(), prices.clone(), am_leader).await {
        Ok(batch_result) => {
            info!(
                cycle = current_cycle, l3_cycle,
                signer_count = batch_result.signature_count,
                order_count = order_ids.len(),
                "L3-native batch confirmation completed"
            );

            // Note: Do NOT set order_status here — L3-native order IDs can collide
            // with Settlement order IDs in the orchestrator's status map.

            // 6b. Emit per-asset trades (issuer decomposition + cross-ITP netting)
            let asset_trade_orders: Vec<(ethers::types::H256, u8, ethers::types::U256)> = l3_native_orders.iter()
                .map(|o| (o.itp_id, o.side as u8, o.amount))
                .collect();

            match protocol.run_asset_trades_phase(l3_cycle, &asset_trade_orders, &chain_reader, am_leader, quote_tokens.as_ref()).await {
                Ok(at_result) => {
                    info!(
                        cycle = current_cycle, l3_cycle,
                        signer_count = at_result.signature_count,
                        "L3-native asset trades emitted"
                    );
                }
                Err(e) => {
                    warn!(cycle = current_cycle, l3_cycle, error = %e, "Asset trades emission failed (fills will proceed)");
                }
            }

            // 7. Build fills and run confirmFills via BLS consensus
            // Filter out orders where fill price would violate limit (E126 guard)
            // Uses per-order NAV from prices vector (multi-ITP support)
            let fills: Vec<Fill> = l3_native_orders.iter().enumerate().filter_map(|(i, order)| {
                let order_nav = prices.get(i).copied().unwrap_or(local_nav_fallback);
                if !fill_price_respects_limit(order_nav, order.limit_price, order.side) {
                    warn!(order_id = %order.id, nav = %order_nav, limit_price = %order.limit_price, side = ?order.side,
                        "Skipping fill: NAV violates order limit price (E126 guard)");
                    return None;
                }
                Some(Fill {
                    order_id: order.id,
                    fill_price: order_nav,
                    fill_amount: order.amount,
                })
            }).collect();

            if fills.is_empty() {
                warn!(cycle = current_cycle, "All L3-native fills skipped due to limit price violations");
            }

            match protocol.run_fills_confirm_phase(l3_cycle, fills, am_leader).await {
                Ok(fills_result) => {
                    if fills_result.signature_count > 0 {
                        info!(
                            cycle = current_cycle, l3_cycle,
                            signer_count = fills_result.signature_count,
                            order_count = order_ids.len(),
                            "L3-native fills confirmed"
                        );

                        // Clean up orchestrator tracking
                        let orch = orchestrator.write().await;
                        for oid in &order_ids {
                            orch.set_order_status(*oid, issuer::BridgeOrderStatus::Filled).await;
                        }
                        drop(orch);
                        first_seen_orders.lock().await.remove(&l3_cycle);
                    } else {
                        warn!(cycle = current_cycle, l3_cycle, attempt,
                            "L3-native fills got 0 signatures, waiting for leader failover");
                    }
                }
                Err(e) => {
                    warn!(cycle = current_cycle, l3_cycle, error = %e, "L3-native fills confirmation failed");
                    let orch = orchestrator.write().await;
                    for oid in &order_ids {
                        orch.set_order_status(*oid, issuer::BridgeOrderStatus::Failed).await;
                    }
                    drop(orch);
                }
            }
        }
        Err(e) => {
            // If batch failed because orders are already batched (E021), try fills only
            let err_str = format!("{}", e);
            if err_str.contains("E021") || err_str.contains("already") {
                info!(cycle = current_cycle, "Orders already batched, attempting fills only");

                let fills: Vec<Fill> = l3_native_orders.iter().enumerate().filter_map(|(i, order)| {
                    let order_nav = prices.get(i).copied().unwrap_or(local_nav_fallback);
                    if !fill_price_respects_limit(order_nav, order.limit_price, order.side) {
                        warn!(order_id = %order.id, nav = %order_nav, limit_price = %order.limit_price,
                            "Skipping fill (E021 retry): NAV violates limit price");
                        return None;
                    }
                    Some(Fill {
                        order_id: order.id,
                        fill_price: order_nav,
                        fill_amount: order.amount,
                    })
                }).collect();

                match protocol.run_fills_confirm_phase(l3_cycle, fills, am_leader).await {
                    Ok(fills_result) => {
                        if fills_result.signature_count > 0 {
                            info!(cycle = current_cycle, signer_count = fills_result.signature_count, "L3-native fills confirmed (after batch skip)");
                            let orch = orchestrator.write().await;
                            for oid in &order_ids {
                                orch.set_order_status(*oid, issuer::BridgeOrderStatus::Filled).await;
                            }
                            drop(orch);
                            first_seen_orders.lock().await.remove(&l3_cycle);
                        } else {
                            warn!(cycle = current_cycle, l3_cycle, attempt,
                                "L3-native fills (E021 retry) got 0 signatures, waiting for leader failover");
                        }
                    }
                    Err(e) => {
                        let e_str = format!("{}", e);
                        if e_str.contains("already") {
                            // Both batch AND fills already confirmed for this cycle but orders
                            // are still Pending on-chain. Previous TX likely reverted.
                            // Clean up tracking so next iteration with a potentially different
                            // order set (and thus different max-based cycle) can proceed.
                            warn!(cycle = current_cycle, l3_cycle,
                                "Both batch and fills already confirmed but orders still pending — clearing stale cycle");
                            first_seen_orders.lock().await.remove(&l3_cycle);
                        } else {
                            warn!(cycle = current_cycle, error = %e, "L3-native fills also failed");
                        }
                        let orch = orchestrator.write().await;
                        for oid in &order_ids {
                            orch.set_order_status(*oid, issuer::BridgeOrderStatus::Failed).await;
                        }
                        drop(orch);
                    }
                }
            } else {
                warn!(cycle = current_cycle, l3_cycle, error = %e, "L3-native batch confirmation failed");
                let orch = orchestrator.write().await;
                for oid in &order_ids {
                    orch.set_order_status(*oid, issuer::BridgeOrderStatus::Failed).await;
                }
                drop(orch);
            }

            // Clean up orchestrator tracking on failure so orders can be retried next cycle
            // (don't leave stale SubmittedOnL3 entries that would be picked up by bridge pipeline)
        }
    }
    } // end if !l3_native_orders.is_empty()
    } // end pending orders block

    // Also process orders that are already BATCHED but not yet FILLED
    // (e.g., batched by regular consensus which doesn't handle fills)
    let batched_orders = match chain_reader.get_batched_orders().await {
        Ok(orders) => orders,
        Err(e) => {
            debug!(cycle = current_cycle, error = %e, "Failed to fetch batched orders");
            return;
        }
    };

    if batched_orders.is_empty() {
        return;
    }

    // The fills loop runs fills for ALL batched orders. For bridge orders,
    // the inline pipeline also runs fills (with a different cycle number).
    // When the fills loop wins the race, the inline path falls to the
    // "already-filled" path which still handles mintBridgedShares correctly.
    let l3_batched_orders = batched_orders;

    if l3_batched_orders.is_empty() {
        return;
    }

    // Leader assignment for fills: cycle derived from max order ID (deterministic across issuers)
    let max_batched_id = l3_batched_orders.iter().map(|o| o.id.as_u64()).max().unwrap();
    let fills_cycle = max_batched_id + 500_000_001;

    let detected_at = {
        let mut fso = first_seen_orders.lock().await;
        *fso.entry(fills_cycle).or_insert_with(std::time::Instant::now)
    };
    let attempt = detected_at.elapsed().as_secs() / LEADER_TIMEOUT_SECS;
    let fills_am_leader = calculate_bridge_leader_with_failover(fills_cycle, num_issuers, node_index, attempt);

    info!(
        cycle = current_cycle, fills_cycle, attempt, fills_am_leader,
        count = l3_batched_orders.len(),
        order_ids = ?l3_batched_orders.iter().map(|o| o.id.as_u64()).collect::<Vec<_>>(),
        "Processing BATCHED L3-native orders (fills only)"
    );

    let batched_order_ids: Vec<ethers::types::U256> = l3_batched_orders.iter().map(|o| o.id).collect();

    // Register amounts in orchestrator for BLS tracking (but NOT status,
    // since L3 order IDs can collide with Settlement order IDs in the status map)
    {
        let orch = orchestrator.write().await;
        for order in &l3_batched_orders {
            orch.set_order_amount(order.id, order.amount).await;
        }
    }

    // Fetch NAV per unique ITP for BATCHED orders (multi-ITP support)
    let mut batched_nav_cache: HashMap<String, ethers::types::U256> = HashMap::new();
    let fills: Vec<Fill> = {
        let mut result = Vec::new();
        for order in &l3_batched_orders {
            let itp_id_str = format!("{:#066x}", order.itp_id);
            let mut order_nav = if let Some(cached) = batched_nav_cache.get(&itp_id_str) {
                *cached
            } else {
                let fetched = local_nav_fallback;
                batched_nav_cache.insert(itp_id_str.clone(), fetched);
                fetched
            };
            if order_nav.is_zero() {
                warn!(order_id = %order.id, "NAV is zero after fetch, using local fallback");
                order_nav = local_nav_fallback;
            }
            if !fill_price_respects_limit(order_nav, order.limit_price, order.side) {
                warn!(order_id = %order.id, nav = %order_nav, limit_price = %order.limit_price, side = ?order.side,
                    "Skipping BATCHED fill: NAV violates order limit price (E126 guard)");
                continue;
            }
            result.push(Fill {
                order_id: order.id,
                fill_price: order_nav,
                fill_amount: order.amount,
            });
        }
        result
    };

    if fills.is_empty() {
        info!(cycle = current_cycle, fills_cycle, "No fillable BATCHED orders (all limit-violated), skipping");
        return;
    }

    match protocol.run_fills_confirm_phase(fills_cycle, fills, fills_am_leader).await {
        Ok(fills_result) => {
            if fills_result.signature_count > 0 {
                info!(
                    cycle = current_cycle, fills_cycle,
                    signer_count = fills_result.signature_count,
                    order_count = batched_order_ids.len(),
                    "BATCHED L3-native fills confirmed"
                );
                let orch = orchestrator.write().await;
                for oid in &batched_order_ids {
                    orch.set_order_status(*oid, issuer::BridgeOrderStatus::Filled).await;
                }
                drop(orch);
                first_seen_orders.lock().await.remove(&fills_cycle);
            } else {
                // No signatures — leader didn't propose (may not be running this code path).
                // Keep first_seen_orders entry so `attempt` advances and leader rotates via failover.
                warn!(
                    cycle = current_cycle, fills_cycle, attempt,
                    "BATCHED fills got 0 signatures, waiting for leader failover"
                );
            }
        }
        Err(e) => {
            warn!(cycle = current_cycle, fills_cycle, error = %e, "BATCHED L3-native fills confirmation failed");
        }
    }
}

/// Compute NAV from on-chain ITP inventory + live Bitget prices.
///
/// NAV = sum(qty[i] * price[i]) / 1e18 — same formula as the contract.
/// Returns $1 (1e18) if inventory is empty or prices are unavailable.
async fn compute_nav(
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    price_fetcher: &Arc<dyn PriceFetcher>,
    itp_id: &str,
) -> ethers::types::U256 {
    let one = ethers::types::U256::exp10(18);
    let itp_bytes: [u8; 32] = {
        let hex = itp_id.trim_start_matches("0x");
        let mut b = [0u8; 32];
        if hex.len() == 64 { hex::decode_to_slice(hex, &mut b).ok(); }
        b
    };
    match chain_reader.get_itp_inventory_state(itp_bytes).await {
        Ok(state) if !state.assets.is_empty() => {
            match price_fetcher.fetch_prices(&state.assets).await {
                Ok(prices) if !prices.is_empty() => {
                    let price_map: std::collections::HashMap<ethers::types::Address, ethers::types::U256> =
                        prices.into_iter().map(|p| (p.asset, p.price)).collect();
                    let scale = ethers::types::U256::exp10(18);
                    let mut nav = ethers::types::U256::zero();
                    for (asset, qty) in state.assets.iter().zip(state.quantities.iter()) {
                        if let Some(price) = price_map.get(asset) {
                            if let Some(contribution) = qty.checked_mul(*price) {
                                nav = nav + contribution / scale;
                            }
                        }
                    }
                    if nav.is_zero() { one } else { nav }
                }
                _ => one,
            }
        }
        _ => one,
    }
}

async fn run_mock_consensus(
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    chain_writer: &Option<Arc<issuer::EthersChainWriter>>,
    has_bls_keypair: bool,
    current_cycle: u64,
    metrics: &Arc<IssuerMetrics>,
    start_time: std::time::Instant,
    settlement_reader: &Option<Arc<dyn issuer::SettlementReader>>,
) {
    let prices_result = chain_reader.get_prices().await;
    let orders_result = chain_reader.get_pending_orders().await;

    let consensus_success = match (&prices_result, &orders_result) {
        (Ok(prices), Ok(orders)) => {
            info!(cycle = current_cycle, price_count = prices.len(), order_count = orders.len(), "Chain data fetched (mock mode)");
            let has_writer = chain_writer.is_some();
            if has_writer && has_bls_keypair {
                info!(cycle = current_cycle, "Consensus components ready (mock mode)");
                true
            } else {
                debug!(cycle = current_cycle, has_chain_writer = has_writer, has_bls_keypair, "Missing components (mock mode)");
                false
            }
        }
        (Err(e), _) => { warn!(cycle = current_cycle, error = %e, "Failed to fetch prices"); false }
        (_, Err(e)) => { warn!(cycle = current_cycle, error = %e, "Failed to fetch orders"); false }
    };

    let elapsed_ms = start_time.elapsed().as_millis() as u64;
    metrics.record_consensus_result(consensus_success, 0, elapsed_ms);
    info!(cycle = current_cycle, elapsed_ms, success = consensus_success, "Consensus phase completed (mock mode)");

    // ITP creation in mock mode
    if let Some(ref settlement_reader) = settlement_reader {
        if let Ok(pending_requests) = settlement_reader.get_all_pending_requests().await {
            if !pending_requests.is_empty() {
                info!(cycle = current_cycle, count = pending_requests.len(), "Found pending ITP creation requests (mock mode)");
                for request in pending_requests {
                    info!(nonce = %request.nonce, admin = ?request.admin, name = %request.name, "Pending ITP creation (mock mode - manual completion required)");
                }
            }
        }
    }
}

/// Deterministic leader election for bridge operations.
/// Uses cycle number (identical on all nodes) instead of last_signature
/// (which may differ between nodes before consensus completes).
fn calculate_bridge_leader(cycle: u64, num_issuers: u8, node_index: u8) -> bool {
    let leader_idx = (cycle % num_issuers as u64) as u8;
    node_index == leader_idx
}

/// Leader timeout for failover rotation (seconds).
/// If the elected leader stalls, the next node takes over after this interval.
const LEADER_TIMEOUT_SECS: u64 = 5;

/// Deterministic leader election with infinite failover rotation.
/// `attempt` shifts the leader index: 0→primary, 1→next, 2→next, wrapping forever.
fn calculate_bridge_leader_with_failover(
    cycle: u64, num_issuers: u8, node_index: u8, attempt: u64,
) -> bool {
    let leader_idx = ((cycle + attempt) % num_issuers as u64) as u8;
    node_index == leader_idx
}

/// Mirror registry sync task (Step 12).
///
/// Reads L3 registry nonce and Settlement mirror nonce, runs BLS consensus if stale,
/// and submits the sync transaction to Settlement.
async fn mirror_sync_task<P, W, K, PF>(
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    settlement_writer: &Arc<issuer::SettlementChainWriter>,
    protocol: &Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    mirror_addr: ethers::types::Address,
    settlement_chain_id: u64,
    cycle: u64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    use ethers::types::U256;

    // Step 1: Read L3 registry nonce (lastSnapshotNonce)
    let l3_nonce = chain_reader.get_registry_nonce().await
        .map_err(|e| format!("Failed to read L3 registry nonce: {}", e))?;

    // Step 2: Read Settlement mirror registryNonce via static_call
    // Selector for registryNonce() = keccak256("registryNonce()")[:4]
    let selector = &ethers::utils::keccak256(b"registryNonce()")[..4];
    let mirror_nonce_bytes = settlement_writer.static_call(mirror_addr, selector.to_vec()).await
        .map_err(|e| format!("Failed to read mirror registryNonce: {}", e))?;
    let mirror_nonce = if mirror_nonce_bytes.len() >= 32 {
        U256::from_big_endian(&mirror_nonce_bytes[..32]).as_u64()
    } else {
        0u64
    };

    // Step 3: Determine sync nonce.
    // Always sync with nonce = max(l3_nonce, mirror_nonce) + 1 to refresh snapshot.blockNumber.
    // Without periodic refreshes, BLSVerifier__SnapshotTooOld fires after 86400 blocks
    // even when the registry state hasn't changed. The contract accepts any nonce > current.
    let sync_nonce = std::cmp::max(l3_nonce, mirror_nonce) + 1;
    info!(cycle, l3_nonce, mirror_nonce, sync_nonce, "Mirror registry sync: refreshing snapshot");

    // Step 4: Read active issuers from L3
    let issuers = chain_reader.get_issuer_registry().await
        .map_err(|e| format!("Failed to fetch L3 issuer registry: {}", e))?;

    let active_issuers: Vec<_> = issuers.iter().filter(|i| i.is_active()).collect();
    if active_issuers.is_empty() {
        return Err("No active issuers on L3".into());
    }

    // Compute active_bitmask (bit i set if issuer with on-chain id i is active)
    let mut active_bitmask = U256::zero();
    for issuer in &active_issuers {
        active_bitmask = active_bitmask | (U256::one() << issuer.id as usize);
    }

    let active_count = active_issuers.len() as u64;
    let threshold = issuer::registry_sync::compute_threshold(active_count);

    // Extract pubkeys and IDs (sorted by ID for deterministic ordering)
    let mut sorted_issuers: Vec<_> = active_issuers.iter().collect();
    sorted_issuers.sort_by_key(|i| i.id);

    let issuer_pubkeys: Vec<Vec<u8>> = sorted_issuers.iter().map(|i| i.bls_pubkey.to_vec()).collect();
    let issuer_ids: Vec<u64> = sorted_issuers.iter().map(|i| i.id).collect();

    // reference_nonce = the L3 lastSnapshotNonce (for BLS verification via historical snapshot)
    let reference_nonce = protocol.registry_nonce();

    // Step 5: Run BLS consensus — returns calldata if threshold reached
    let calldata = protocol.run_mirror_sync_consensus(
        sync_nonce,
        issuer_pubkeys,
        issuer_ids,
        active_bitmask,
        active_count,
        threshold,
        settlement_chain_id,
        mirror_addr,
        reference_nonce,
    ).await
        .map_err(|e| format!("Mirror sync BLS consensus failed: {}", e))?;

    // Step 6: Submit sync transaction to Settlement
    let tx_hash = settlement_writer.send_transaction(mirror_addr, calldata, U256::zero()).await
        .map_err(|e| format!("Mirror sync tx submission failed: {}", e))?;

    info!(
        cycle,
        sync_nonce,
        l3_nonce,
        mirror_nonce,
        ?tx_hash,
        "Mirror registry sync tx submitted"
    );

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Build configuration
    let config = ConfigBuilder::new()
        .with_config_file(args.config.clone())
        .with_deployment_file(args.deployment_file.clone())
        .with_cli_args(
            args.node_id, args.port, args.rpc, args.bls_key_path,
            args.log_level, args.log_dir,
            if args.json_logs { Some(true) } else { None },
            args.peers,
        )
        .with_bitget_vault(args.bitget_vault.clone())
        .with_issuer_custody_l3(args.issuer_custody_l3.clone())
        .with_issuer_custody_settlement(args.issuer_custody_settlement.clone())
        .with_settlement_custody(args.settlement_custody.clone())
        .with_mock_usdt(args.mock_usdt.clone())
        .with_registry_sync(args.registry_sync)
        .with_arbitration(
            args.arbitration_enabled,
            args.arbitration_vault.clone(),
            args.arbitration_settlement.clone(),
            args.arbitration_threshold,
            args.arbitration_data_node_url.clone(),
        )
        .with_data_node_token(args.data_node_token.clone())
        .with_nav_oracle(args.nav_oracle.clone(), args.itp_token.clone())
        .with_mirror_registry(args.mirror_registry.clone())
        .with_vision(if args.vision_enabled {
            let mut vision_cfg = issuer::vision::config::VisionConfig {
                enabled: true,
                ..Default::default()
            };
            if let Some(ref addr) = args.vision_address {
                vision_cfg.vision_address = addr.clone();
            }
            if let Some(ref url) = args.vision_database_url {
                vision_cfg.database_url = url.clone();
            }
            if let Some(ref url) = args.vision_data_node_url {
                vision_cfg.data_node_url = url.clone();
            } else if let Some(ref url) = args.data_node_url {
                vision_cfg.data_node_url = url.clone();
            }
            if let Some(ref url) = args.vision_rpc_ws_url {
                vision_cfg.rpc_ws_url = url.clone();
            }
            if let Some(block) = args.vision_start_block {
                vision_cfg.start_block = block;
            }
            if let Some(secs) = args.vision_reveal_window_secs {
                vision_cfg.reveal_window_secs = secs;
            }
            if let Some(ms) = args.vision_tick_poll_interval_ms {
                vision_cfg.tick_poll_interval_ms = ms;
            }
            vision_cfg.data_node_token = args.data_node_token.clone();
            // Cross-chain deposit config — CLI args first, then env var fallbacks
            if let Some(ref url) = args.vision_settlement_rpc_url {
                vision_cfg.settlement_rpc_url = url.clone();
            } else if let Ok(url) = std::env::var("ISSUER_SETTLEMENT_RPC_URL") {
                vision_cfg.settlement_rpc_url = url;
            }
            if let Some(ref addr) = args.vision_settlement_bridge_custody {
                vision_cfg.settlement_bridge_custody_address = addr.clone();
            } else if let Ok(addr) = std::env::var("ISSUER_VISION_SETTLEMENT_BRIDGE_CUSTODY_ADDRESS") {
                vision_cfg.settlement_bridge_custody_address = addr;
            } else if let Ok(addr) = std::env::var("ISSUER_SETTLEMENT_CUSTODY") {
                vision_cfg.settlement_bridge_custody_address = addr;
            }
            if let Some(chain_id) = args.vision_settlement_chain_id {
                vision_cfg.settlement_chain_id = chain_id;
            } else if let Ok(chain_id) = std::env::var("ISSUER_SETTLEMENT_CHAIN_ID").and_then(|s| s.parse::<u64>().map_err(|_| std::env::VarError::NotPresent)) {
                vision_cfg.settlement_chain_id = chain_id;
            }
            // BLS proof generation config
            vision_cfg.num_issuers = args.num_issuers as usize;
            // node_id is 1-indexed (u32), node_index is 0-indexed (u8)
            vision_cfg.node_index = args.node_id.map(|id| (id.saturating_sub(1)) as u8).unwrap_or(0);
            Some(vision_cfg)
        } else {
            None
        })
        .build()
        .map_err(|e| { eprintln!("Configuration error: {}", e); e })?;

    // Validate node_id
    let node_id = match config.node_id {
        Some(id) => id,
        None => {
            eprintln!("Error: node-id is required. Set via --node-id, ISSUER_NODE_ID env var, or config file.");
            std::process::exit(1);
        }
    };

    if node_id == 0 || node_id > 20 {
        eprintln!("Error: node-id must be between 1 and 20");
        std::process::exit(1);
    }

    if args.cycle_duration_ms < MIN_CYCLE_DURATION_MS {
        eprintln!("Error: --cycle-duration-ms must be at least {}ms (got {}ms)", MIN_CYCLE_DURATION_MS, args.cycle_duration_ms);
        std::process::exit(1);
    }

    if args.num_issuers == 0 || args.num_issuers > 20 {
        eprintln!("Error: --num-issuers must be between 1 and 20 (got {})", args.num_issuers);
        std::process::exit(1);
    }

    // --- Mandatory registry-sync for multi-issuer deployments ---
    // Without registry-sync, issuers cannot detect join/leave events and will
    // desync their key registries, causing BLS aggregation failures.
    if args.num_issuers > 1 && !args.registry_sync {
        error!("ERROR: --registry-sync required for multi-issuer deployments (num_issuers={}). Refusing to start.", args.num_issuers);
        std::process::exit(1);
    }

    // --- Production guards ---
    // --no-tls and --test-key-seeds are allowed in local dev without --mock.
    // --mock fully disables chain writer (no on-chain writes at all).
    // --skip-reconstruction still requires --mock (production nodes must reconstruct).
    if !args.mock && args.skip_reconstruction {
        panic!("FATAL: --skip-reconstruction requires --mock. Production nodes must reconstruct state.");
    }

    // --- Validate data-node URLs use HTTPS in production ---
    if let Some(ref url) = args.data_node_url {
        issuer::config::validate_data_node_url(url, args.mock)
            .unwrap_or_else(|e| panic!("FATAL: {}", e));
    }
    if let Some(ref url) = args.vision_data_node_url {
        issuer::config::validate_data_node_url(url, args.mock)
            .unwrap_or_else(|e| panic!("FATAL: {}", e));
    }
    if let Some(ref url) = args.arbitration_data_node_url {
        issuer::config::validate_data_node_url(url, args.mock)
            .unwrap_or_else(|e| panic!("FATAL: {}", e));
    }

    setup_logging(&config)?;

    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = shutdown.clone();

    tokio::spawn(async move {
        let ctrl_c = async {
            signal::ctrl_c().await.expect("Failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("Failed to install signal handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => { warn!("Received Ctrl+C, initiating shutdown"); }
            _ = terminate => { warn!("Received SIGTERM, initiating shutdown"); }
        }

        shutdown_clone.store(true, Ordering::Relaxed);
    });

    // Build bootstrap params
    let params = BootstrapParams {
        mock_chain: args.mock,
        no_tls: args.no_tls,
        skip_reconstruction: args.skip_reconstruction,
        from_block: args.from_block,
        checkpoint_path: args.checkpoint_path,
        cycle_duration_ms: args.cycle_duration_ms,
        num_issuers: args.num_issuers,
        signature_threshold_override: args.signature_threshold,
        bls_key_seed_index: args.bls_key_seed_index,
        on_chain_issuer_id: args.on_chain_issuer_id,
        test_key_seeds: args.test_key_seeds,
        key_registry_offset: args.key_registry_offset,
        bridge_proxy: args.bridge_proxy,
        symbol_map_file: args.symbol_map_file,
        chain_id_override: args.chain_id,
        start_cycle: args.start_cycle,
        asset_count_override: args.asset_count,
        min_cycle_gap_ms: args.min_cycle_gap_ms,
        max_gas_limit: args.max_gas_limit,
        receipt_timeout_secs: args.receipt_timeout_secs,
        consensus_timeout_ms: args.consensus_timeout_ms,
        p2p_max_per_ip: args.p2p_max_per_ip,
        p2p_rate_limit: args.p2p_rate_limit,
        p2p_rate_burst: args.p2p_rate_burst,
        wal_path: args.wal_path.clone(),
        wal_sync_mode: args.wal_sync_mode.clone(),
        skip_wal_replay: args.skip_wal_replay,
        sign_timeout_ms: args.sign_timeout_ms,
    };

    // Deprecation warning for --signature-threshold
    if args.signature_threshold.is_some() {
        warn!(
            "DEPRECATED: --signature-threshold is deprecated and will be removed in a future release. \
             Threshold is now auto-computed from on-chain activeIssuerCount using BFT 2/3+1 formula. \
             The override is still honoured for this run, but please remove it from your launch config."
        );
    }

    // Bootstrap and run
    // Save NTP config before config is consumed by bootstrap
    let config_ntp_tolerance = config.ntp_tolerance_ms.unwrap_or(200);

    // Save registry sync config before config is consumed (Story 8.4, Task 7.3)
    let registry_sync_enabled = config.effective_registry_sync_enabled();
    let registry_sync_poll_interval_ms = config.effective_registry_sync_poll_interval_ms();
    let issuer_registry_address_str = config.issuer_registry_address.clone();

    // Save mock USDT address before config is consumed
    let mock_usdt_addr = config.effective_mock_usdt();

    // Save arbitration config before config is consumed
    let arb_config = ArbitrationConfig::from_issuer_config(&config);

    // Save Vision config before config is consumed
    let vision_config = config.vision.clone();

    // Parse oracle + mirror configs before config is consumed by bootstrap
    let nav_oracle_address: Option<ethers::types::Address> = config.nav_oracle_address.as_ref().and_then(|s| s.parse().ok());
    let itp_token_address: Option<ethers::types::Address> = config.itp_token_address.as_ref().and_then(|s| s.parse().ok());
    let settlement_chain_id: Option<u64> = config.effective_settlement_chain_id().ok();
    let mirror_registry_address: Option<ethers::types::Address> = config.mirror_registry_address.as_ref().and_then(|s| s.parse().ok());
    let issuer_registry_for_sync: Option<ethers::types::Address> = config.issuer_registry_address.as_ref().and_then(|s| s.parse().ok());

    let bootstrap = IssuerBootstrap::new(config, params);
    let mut components = bootstrap.build(shutdown).await.map_err(|e| {
        error!(code = "E008", error = %e, "Bootstrap failed");
        e
    })?;

    // GAP 1: Startup diagnostics for cross-chain buy flow
    if components.consensus.bridge_orchestrator.is_none() && components.chain.settlement_reader.is_some() {
        warn!(node_id, code = "BRIDGE-010",
              "Cross-chain buy flow DISABLED despite SettlementReader being available. Check BRIDGE-00x warnings above.");
    } else if components.consensus.bridge_orchestrator.is_some() {
        info!(node_id, "Cross-chain buy flow ENABLED");
    }

    // Initialize NTP time synchronization and wire into CycleManager
    let _ntp_handle = if !args.ntp_server.is_empty() {
        let ntp_sync = issuer::cycle::NtpSync::new(&args.ntp_server, config_ntp_tolerance, 60);
        let ntp_state = ntp_sync.state();
        ntp_sync.initial_sync();
        components.consensus.cycle_manager.set_ntp_state(ntp_state);
        let handle = ntp_sync.start_periodic();
        info!(node_id, ntp_server = %args.ntp_server, tolerance_ms = config_ntp_tolerance, "NTP sync started and wired to CycleManager");
        Some(handle)
    } else {
        info!(node_id, "NTP sync disabled");
        None
    };

    // Spawn RegistrySyncHandler if enabled (Story 8.4, Task 7.3)
    let _registry_sync_handle = if registry_sync_enabled {
        if let (Some(ref cache), Some(ref bls_keypair)) = (
            &components.registry_sync_cache,
            &components.consensus.keys.bls_keypair,
        ) {
            // Parse IssuerRegistry address
            let issuer_registry_address = issuer_registry_address_str
                .as_ref()
                .and_then(|addr| addr.parse::<ethers::types::Address>().ok())
                .unwrap_or_else(ethers::types::Address::zero);

            if issuer_registry_address == ethers::types::Address::zero() {
                warn!(node_id, "Registry sync enabled but IssuerRegistry address not configured, skipping handler");
                None
            } else {
                // Create provider from L3 RPC URL
                let l3_rpc_url = components.chain.rpc_url.clone();
                let provider = Arc::new(
                    ethers::providers::Provider::<ethers::providers::Http>::try_from(&l3_rpc_url)
                        .expect("valid L3 RPC URL")
                );

                let sync_config = RegistrySyncConfig {
                    issuer_registry_address,
                    poll_interval_ms: registry_sync_poll_interval_ms,
                    max_block_range: 1000,
                    initial_scan_blocks: 86_400, // 24h downtime tolerance at 1s blocks
                };

                // TODO: wire mirror_address from config (L2 MirrorIssuerRegistry contract address)
                let mirror_address = ethers::types::Address::zero();

                let mut handler = RegistrySyncHandler::new(
                    provider,
                    sync_config,
                    components.chain.reader.clone(),
                    bls_keypair.clone(),
                    components.consensus.keys.node_index,
                    components.consensus.keys.issuer_registry_index as u64,
                    cache.clone(),
                    components.target_chain_id,
                    mirror_address,
                );

                // Wire key registry for runtime updates on issuer join/leave
                if let Some(ref kr) = components.consensus.keys.key_registry {
                    handler = handler.with_key_registry(kr.clone());
                }

                // Wire pending config update cell from consensus protocol
                if let Some(ref protocol) = components.consensus.protocol {
                    handler = handler.with_pending_config_update(protocol.pending_config_handle());
                }

                let handler_shutdown = components.shutdown.clone();
                let handle = tokio::spawn(async move {
                    handler.run(handler_shutdown).await;
                });

                info!(
                    node_id,
                    issuer_registry = ?issuer_registry_address,
                    poll_interval_ms = registry_sync_poll_interval_ms,
                    "RegistrySyncHandler started"
                );
                Some(handle)
            }
        } else {
            warn!(node_id, "Registry sync enabled but BLS keypair not available, skipping handler");
            None
        }
    } else {
        None
    };

    // --- Arbitration subsystem (optional) ---
    if let Some(arb_cfg) = arb_config {
        // Require BLS keypair, P2P transport, and chain writer for arbitration
        let arb_ready = components.consensus.keys.bls_keypair.is_some()
            && components.p2p.transport.is_some()
            && components.chain.writer.is_some();

        if arb_ready {
            let (arb_msg_tx, arb_msg_rx) = arbitration::arbitration_channel();
            let arb_p2p: Arc<dyn common::traits::P2PTransport> =
                components.p2p.transport.clone().unwrap();
            let arb_writer = components.chain.writer.clone().unwrap();
            let arb_keypair = components.consensus.keys.bls_keypair.clone().unwrap();
            let arb_index = components.consensus.keys.node_index;
            let arb_rpc = components.chain.rpc_url.clone();

            let subsystem = ArbitrationSubsystem::new(
                arb_cfg,
                arb_msg_rx,
                arb_p2p,
                arb_writer,
                arb_keypair,
                arb_index,
                arb_rpc,
            );
            let arb_shutdown = components.shutdown.clone();
            tokio::spawn(async move {
                subsystem.run(arb_shutdown).await;
            });
            // Wire the sender into the consensus protocol so ForwardToArbitration messages get delivered
            if let Some(ref protocol) = components.consensus.protocol {
                protocol.set_arbitration_sender(arb_msg_tx).await;
            }
            info!(node_id, "Arbitration subsystem enabled");
        } else {
            warn!(
                node_id,
                has_bls = components.consensus.keys.bls_keypair.is_some(),
                has_p2p = components.p2p.transport.is_some(),
                has_writer = components.chain.writer.is_some(),
                "Arbitration configured but missing dependencies, skipping"
            );
        }
    } else {
        info!(node_id, "Arbitration subsystem disabled (not configured)");
    }

    // --- Vision subsystem (optional) ---
    let mut vision_api_router: Option<axum::Router> = None;
    if let Some(vision_cfg) = vision_config {
        if vision_cfg.enabled {
            // Initialize Vision components
            let bitmap_store = Arc::new(issuer::vision::bitmap_store::BitmapStore::new());
            let scheduler = Arc::new(issuer::vision::tick_scheduler::TickScheduler::new());
            let resolver = Arc::new(issuer::vision::resolver::TickResolver::new(
                bitmap_store.clone(),
                vision_cfg.clone(),
            ));

            // Spawn tick engine
            let engine_scheduler = scheduler.clone();
            let engine_resolver = resolver.clone();
            let engine_config = vision_cfg.clone();
            let engine_shutdown = components.shutdown.clone();
            let engine_bls_keypair = components.consensus.keys.bls_keypair.clone().map(Arc::new);
            tokio::spawn(async move {
                issuer::vision::engine::run(
                    engine_scheduler,
                    engine_resolver,
                    engine_config,
                    engine_shutdown,
                    engine_bls_keypair,
                ).await;
            });

            // Initialize Postgres pool, chain listener, and API routes
            match sqlx::postgres::PgPoolOptions::new()
                .max_connections(3)
                .idle_timeout(std::time::Duration::from_secs(300))
                .connect(&vision_cfg.database_url).await {
                Ok(pool) => {
                    // Restore scheduler state from DB (crash recovery)
                    if let Err(e) = scheduler.load_from_db(&pool).await {
                        tracing::warn!(error = %e, "Failed to restore vision scheduler from DB");
                    }
                    // Restore bitmaps from DB (crash recovery)
                    if let Err(e) = bitmap_store.load_from_db(&pool).await {
                        tracing::warn!(error = %e, "Failed to restore vision bitmaps from DB");
                    }

                    // Spawn chain listener (unified event indexer: scheduler + Postgres)
                    let vision_address: ethers::types::Address = vision_cfg.vision_address
                        .parse()
                        .expect("valid Vision contract address");
                    let vision_rpc_url = vision_cfg.rpc_ws_url.clone();
                    let cl_provider = Arc::new(
                        ethers::providers::Provider::<ethers::providers::Http>::try_from(&vision_rpc_url)
                            .expect("valid Vision RPC URL for chain listener")
                    );
                    let chain_listener = issuer::vision::chain_listener::ChainListener::new(
                        cl_provider,
                        vision_address,
                        scheduler.clone(),
                        pool.clone(),
                        vision_cfg.start_block,
                    );
                    let cl_shutdown = components.shutdown.clone();
                    tokio::spawn(async move {
                        chain_listener.run(cl_shutdown).await;
                    });

                    // Spawn VisionDepositWatcher (cross-chain deposit/withdraw orchestrator)
                    {
                        let settlement_rpc_url = vision_cfg.settlement_rpc_url.clone();
                        let settlement_custody_address: ethers::types::Address = vision_cfg
                            .settlement_bridge_custody_address
                            .parse()
                            .unwrap_or_else(|_| {
                                warn!("Invalid settlement_bridge_custody_address, deposit watcher will have zeroed address");
                                ethers::types::Address::zero()
                            });

                        let dw_settlement_provider = Arc::new(
                            ethers::providers::Provider::<ethers::providers::Http>::try_from(&settlement_rpc_url)
                                .expect("valid Settlement RPC URL for deposit watcher"),
                        );
                        let dw_l3_provider = Arc::new(
                            ethers::providers::Provider::<ethers::providers::Http>::try_from(&vision_cfg.rpc_ws_url)
                                .expect("valid L3 RPC URL for deposit watcher"),
                        );

                        // BLS keypair for signing cross-chain operations
                        let dw_bls_keypair = components.consensus.keys.bls_keypair.clone();
                        // L3 chain writer for creditBalance + gas drip
                        let dw_l3_writer: Option<Arc<dyn common::traits::ChainWriter>> =
                            components.chain.writer.clone().map(|w| w as Arc<dyn common::traits::ChainWriter>);
                        // Settlement chain writer: delegates send_transaction/static_call to SettlementChainWriter
                        let dw_settlement_writer: Option<Arc<dyn common::traits::ChainWriter>> =
                            components.chain.settlement_writer.clone().map(|w| w as Arc<dyn common::traits::ChainWriter>);
                        let dw_node_index = components.consensus.keys.node_index;

                        // IssuerRegistry address: used for reading lastSnapshotNonce (BLS referenceNonce).
                        // On L3 testnet the same registry is used for both chains.
                        // In production with separate chains, settlement_registry would be a MirrorIssuerRegistry.
                        let dw_registry_address: ethers::types::Address = issuer_registry_address_str
                            .as_ref()
                            .and_then(|addr| addr.parse::<ethers::types::Address>().ok())
                            .unwrap_or_else(|| {
                                warn!("IssuerRegistry address not configured for deposit watcher, using zero address");
                                ethers::types::Address::zero()
                            });

                        let deposit_watcher = issuer::vision::deposit_watcher::VisionDepositWatcher::new(
                            dw_settlement_provider,
                            dw_l3_provider,
                            vision_address,
                            settlement_custody_address,
                            dw_registry_address, // l3_registry_address
                            dw_registry_address, // settlement_registry_address (same on L3 testnet)
                            pool.clone(),
                            vision_cfg.clone(),
                            dw_bls_keypair,
                            dw_l3_writer,
                            dw_settlement_writer,
                            dw_node_index,
                        );

                        let dw_shutdown = components.shutdown.clone();
                        tokio::spawn(async move {
                            deposit_watcher.run(dw_shutdown).await;
                        });
                        info!(node_id, "VisionDepositWatcher spawned");
                    }

                    // Spawn BatchConfigOrchestrator (independent async task, NOT inside run_cycle)
                    let orch_data_node_url = vision_cfg.data_node_url.clone();
                    let orch_admin_token = vision_cfg.data_node_token.clone().unwrap_or_default();
                    tokio::spawn(async move {
                        let mut orchestrator = issuer::vision::batch_config_orchestrator::BatchConfigOrchestrator::new(
                            orch_data_node_url,
                            orch_admin_token,
                        );
                        orchestrator.run().await;
                    });

                    let vision_state = Arc::new(issuer::vision::api::VisionState {
                        pool,
                        scheduler: scheduler.clone(),
                        bitmap_store: bitmap_store.clone(),
                        config: vision_cfg.clone(),
                    });

                    // Build the Vision router (merged into health port in run_main_loop)
                    vision_api_router = Some(issuer::vision::api::routes(vision_state));

                    info!(
                        node_id,
                        vision_address = %vision_cfg.vision_address,
                        "Vision subsystem enabled (tick engine + API on health port)"
                    );
                }
                Err(e) => {
                    warn!(
                        node_id,
                        error = %e,
                        db_url = %vision_cfg.database_url,
                        "Vision Postgres connection failed — tick engine running without API"
                    );
                }
            }
        } else {
            info!(node_id, "Vision subsystem disabled (enabled=false)");
        }
    } else {
        debug!(node_id, "Vision subsystem not configured");
    }

    // WAL replay: re-ingest messages from the current cycle's WAL entries before starting
    // the consensus loop. This recovers partial-cycle state after a crash/restart.
    if !args.skip_wal_replay {
        if let Some(ref wal_path) = args.wal_path {
            if let Some(ref protocol) = components.consensus.protocol {
                match issuer::p2p::wal::ConsensusWAL::open(wal_path, issuer::p2p::wal::WalSyncMode::None) {
                    Ok(wal) => {
                        let current_cycle = components.consensus.cycle_manager.get_current_cycle();
                        match wal.read_cycle(current_cycle) {
                            Ok(entries) if !entries.is_empty() => {
                                info!(
                                    node_id,
                                    cycle = current_cycle,
                                    count = entries.len(),
                                    "Replaying WAL entries for current cycle"
                                );
                                protocol.set_replay_mode(true);
                                for entry in entries {
                                    match rmp_serde::from_slice::<P2PMessage>(&entry.message_bytes) {
                                        Ok(message) => {
                                            if let Err(e) = protocol.handle_message(entry.from, message).await {
                                                debug!(error = %e, "WAL replay message failed (non-fatal)");
                                            }
                                        }
                                        Err(e) => {
                                            debug!(error = %e, "WAL replay: failed to deserialize message, skipping");
                                        }
                                    }
                                }
                                protocol.set_replay_mode(false);
                                info!(node_id, cycle = current_cycle, "WAL replay complete");
                            }
                            Ok(_) => {
                                debug!(node_id, "WAL replay: no entries for current cycle");
                            }
                            Err(e) => {
                                warn!(node_id, error = %e, "WAL replay: failed to read cycle entries");
                            }
                        }
                    }
                    Err(e) => {
                        warn!(node_id, error = %e, wal_path = %wal_path.display(),
                              "WAL replay: failed to open WAL file, skipping replay");
                    }
                }
            }
        }
    }

    if let Err(e) = run_main_loop(components, args.api_enabled, args.data_node_url, args.itp_id, mock_usdt_addr, vision_api_router, nav_oracle_address, itp_token_address, settlement_chain_id, mirror_registry_address, issuer_registry_for_sync).await {
        error!(code = "E008", error = %e, "Issuer node error");
        std::process::exit(1);
    }

    Ok(())
}
