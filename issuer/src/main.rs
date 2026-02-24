//! Issuer node binary for Index L3
//!
//! Runs an issuer node that participates in order batching, consensus, and execution.

use clap::Parser;
use issuer::bootstrap::{BootstrapParams, IssuerBootstrap, IssuerComponents, IssuerMetrics};
use issuer::bridge::Fill;
use issuer::p2p::TcpP2PTransport;
use issuer::{
    handle_nav_sign_request, BackendNavCalculator, ConfigBuilder, ConsensusResult,
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

    /// Disable TLS for P2P connections (development only)
    #[arg(long)]
    no_tls: bool,

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

    /// IssuerCustody Arbitrum contract address (Story 7.7).
    #[arg(long)]
    issuer_custody_arb: Option<String>,

    /// ArbBridgeCustody contract address (Story 7.8).
    #[arg(long)]
    arb_custody: Option<String>,

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
    /// and serves BLS-signed registry state proofs for MirrorIssuerRegistry sync on Arbitrum.
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

    /// Bearer token for authenticating data-node HTTP requests.
    /// Used by Vision, Arbitration, and NAV subsystems to authenticate with the data-node.
    #[arg(long, env = "DATA_NODE_TOKEN")]
    data_node_token: Option<String>,
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

/// Shared state for the issuer HTTP API (health, nav-sign, registry-sync).
/// All issuer endpoints and optional Vision endpoints share one axum server.
struct IssuerApiState {
    node_id: u32,
    p2p_transport: Option<Arc<TcpP2PTransport>>,
    metrics: Arc<IssuerMetrics>,
    registry_sync_cache: Option<RegistrySyncCache>,
    nav_sign_handler: Option<Arc<IssuerNavSignHandler>>,
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

    let status = if http_status == 200 { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    (status, [(header::CONTENT_TYPE, "application/json")], body.to_string()).into_response()
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

/// Build the core issuer API router (health, nav-sign, registry-sync).
fn issuer_api_routes(state: Arc<IssuerApiState>) -> axum::Router {
    axum::Router::new()
        .route("/health", axum::routing::get(axum_health_handler))
        .route("/", axum::routing::get(axum_root_health_handler))
        .route("/api/nav-sign", axum::routing::get(axum_nav_sign_handler))
        .route("/api/registry-sync", axum::routing::get(axum_registry_sync_handler))
        .with_state(state)
}

async fn run_main_loop(mut components: IssuerComponents, api_enabled: bool, data_node_url: Option<String>, itp_id: String, mock_usdt_addr: Option<ethers::types::Address>, vision_router: Option<axum::Router>) -> Result<(), Box<dyn std::error::Error>> {
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

    // Spawn consensus coordination task
    let consensus_shutdown = shutdown.clone();
    let consensus_metrics = components.consensus.metrics.clone();
    let consensus_chain_reader = components.chain.reader.clone();
    let consensus_chain_writer_for_task = components.chain.writer.clone();
    let has_bls_keypair = components.consensus.keys.bls_keypair.is_some();
    let consensus_protocol_for_task = components.consensus.protocol.clone();
    let arbitrum_reader_for_task = components.chain.arbitrum_reader.clone();
    let arbitrum_writer_for_task = components.chain.arbitrum_writer.clone();
    let itp_creation_config_for_task = components.consensus.itp_creation_config.clone();
    let bridge_orchestrator_for_task = components.consensus.bridge_orchestrator.clone();
    let node_index_for_task = components.consensus.keys.node_index;
    let consensus_config = components.consensus.config.clone();
    let price_fetcher_for_task: Arc<dyn PriceFetcher> = components.price.fetcher.clone();
    let known_asset_addresses: Vec<ethers::types::Address> = components.price.symbol_map.assets().copied().collect();
    let symbol_map_for_task = components.price.symbol_map.clone();
    let data_node_url_for_task = data_node_url.clone();
    let itp_id_for_task = itp_id.clone();
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

    let consensus_handle = tokio::spawn(async move {
        let mut state_rx = cycle_state_rx;
        let mut last_cycle: u64 = 0;
        let mut last_signature = common::types::BLSSignature(vec![0u8; 64]);
        let mut first_seen_orders: HashMap<u64, std::time::Instant> = HashMap::new();

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

                consensus_metrics.record_consensus_start();
                let start_time = std::time::Instant::now();

                if let Some(ref protocol) = consensus_protocol_for_task {
                    // Real consensus
                    // Fetch prices from price fetcher (backend or Bitget depending on config).
                    // Falls back to on-chain prices if unavailable.
                    let prices: Vec<(u32, ethers::types::U256)> = if !known_asset_addresses.is_empty() {
                        match price_fetcher_for_task.fetch_prices(&known_asset_addresses).await {
                            Ok(p) if !p.is_empty() => {
                                if current_cycle % 100 == 1 {
                                    debug!(
                                        cycle = current_cycle,
                                        count = p.len(),
                                        "Using price fetcher prices for consensus"
                                    );
                                }
                                p.iter().enumerate().map(|(i, price)| (i as u32, price.price)).collect()
                            }
                            Err(e) => {
                                warn!(cycle = current_cycle, error = %e, "Price fetch failed, falling back to on-chain");
                                match consensus_chain_reader.get_prices().await {
                                    Ok(p) if !p.is_empty() => {
                                        p.iter().enumerate().map(|(i, price)| (i as u32, price.price)).collect()
                                    }
                                    _ => vec![]
                                }
                            }
                            _ => {
                                // Fetcher returned empty — fall back to on-chain
                                match consensus_chain_reader.get_prices().await {
                                    Ok(p) if !p.is_empty() => {
                                        p.iter().enumerate().map(|(i, price)| (i as u32, price.price)).collect()
                                    }
                                    _ => vec![]
                                }
                            }
                        }
                    } else {
                        // No known assets in symbol map — use on-chain prices
                        match consensus_chain_reader.get_prices().await {
                            Ok(p) if !p.is_empty() => {
                                p.iter().enumerate().map(|(i, price)| (i as u32, price.price)).collect()
                            }
                            _ => vec![]
                        }
                    };

                    let orders_result = consensus_chain_reader.get_pending_orders().await;

                    // Get L3 order IDs tracked by bridge pipeline to exclude from regular consensus
                    let bridge_tracked_l3_ids: Vec<u64> = if let Some(ref orch) = bridge_orchestrator_for_task {
                        orch.read().await.get_tracked_l3_order_ids().await
                    } else {
                        vec![]
                    };

                    let order_ids: Vec<u64> = match &orders_result {
                        Ok(orders) => orders.iter()
                            .map(|o| o.id.as_u64())
                            .filter(|id| !bridge_tracked_l3_ids.contains(id))
                            .collect(),
                        Err(e) => { warn!(cycle = current_cycle, error = %e, "Failed to fetch orders"); vec![] }
                    };

                    let fills = vec![];
                    let result = protocol.run_cycle(current_cycle, prices, order_ids, fills, &last_signature).await;
                    let elapsed_ms = start_time.elapsed().as_millis() as u64;

                    match result {
                        ConsensusResult::Success { ref aggregated_signature, signer_count, cycle_number } => {
                            info!(cycle = cycle_number, signer_count, elapsed_ms, "Consensus cycle completed");
                            last_signature = aggregated_signature.clone();
                            consensus_metrics.record_consensus_result(true, signer_count, elapsed_ms);
                        }
                        ConsensusResult::Failed { ref reason, cycle_number } => {
                            warn!(cycle = cycle_number, reason, elapsed_ms, "Consensus cycle failed");
                            consensus_metrics.record_consensus_result(false, 0, elapsed_ms);
                        }
                        ConsensusResult::Timeout { ref phase, cycle_number } => {
                            warn!(cycle = cycle_number, phase = %phase, elapsed_ms, "Consensus cycle timed out");
                            consensus_metrics.record_consensus_result(false, 0, elapsed_ms);
                        }
                        ConsensusResult::EmergencyPause { cycle_number } => {
                            error!(cycle = cycle_number, elapsed_ms, "Emergency pause triggered");
                            consensus_metrics.record_consensus_result(false, 0, elapsed_ms);
                        }
                        ConsensusResult::ItpCreated { nonce, ref aggregated_signature, signer_count } => {
                            info!(nonce = %nonce, signer_count, elapsed_ms, "ITP creation consensus completed");
                            last_signature = aggregated_signature.clone();
                            consensus_metrics.record_consensus_result(true, signer_count, elapsed_ms);
                        }
                    }

                    // ITP creation phase
                    if let (Some(ref arb_reader), Some(ref arb_writer), Some(ref itp_config)) =
                        (&arbitrum_reader_for_task, &arbitrum_writer_for_task, &itp_creation_config_for_task)
                    {
                        run_itp_creation_phase(
                            &protocol, arb_reader, arb_writer, &consensus_chain_writer_for_task,
                            itp_config, current_cycle, node_index_for_task, consensus_config.num_issuers,
                        ).await;
                    }

                    // Compute local NAV from on-chain inventory + Bitget prices.
                    // Used as fallback when data-node backend is unavailable (e.g. no PostgreSQL).
                    let local_nav_fallback = {
                        let itp_bytes: [u8; 32] = {
                            let hex = itp_id_for_task.trim_start_matches("0x");
                            let mut b = [0u8; 32];
                            if hex.len() == 64 { hex::decode_to_slice(hex, &mut b).ok(); }
                            b
                        };
                        match consensus_chain_reader.get_itp_inventory_state(itp_bytes).await {
                            Ok(state) if !state.assets.is_empty() => {
                                let asset_count = state.assets.len();
                                let qty_count = state.quantities.len();
                                match price_fetcher_for_task.fetch_prices(&state.assets).await {
                                    Ok(prices) if !prices.is_empty() => {
                                        let price_count = prices.len();
                                        let price_map: std::collections::HashMap<ethers::types::Address, ethers::types::U256> =
                                            prices.into_iter().map(|p| (p.asset, p.price)).collect();
                                        let scale = ethers::types::U256::exp10(18);
                                        let mut nav = ethers::types::U256::zero();
                                        let mut matched = 0u32;
                                        for (asset, qty) in state.assets.iter().zip(state.quantities.iter()) {
                                            if let Some(price) = price_map.get(asset) {
                                                matched += 1;
                                                if let Some(contribution) = qty.checked_mul(*price) {
                                                    nav = nav + contribution / scale;
                                                }
                                            }
                                        }
                                        if nav.is_zero() {
                                            info!(cycle = current_cycle, asset_count, price_count, matched, "Local NAV = 0, falling back to $1");
                                            ethers::types::U256::exp10(18)
                                        } else {
                                            info!(cycle = current_cycle, nav = %nav, asset_count, price_count, matched, "Local NAV computed from chain+Bitget");
                                            nav
                                        }
                                    }
                                    Ok(_) => {
                                        info!(cycle = current_cycle, asset_count, qty_count, "Prices empty, falling back to $1");
                                        ethers::types::U256::exp10(18)
                                    }
                                    Err(e) => {
                                        info!(cycle = current_cycle, error = %e, "Price fetch error, falling back to $1");
                                        ethers::types::U256::exp10(18)
                                    }
                                }
                            }
                            Ok(_) => {
                                if current_cycle % 50 == 1 {
                                    info!(cycle = current_cycle, "ITP inventory empty, falling back to $1");
                                }
                                ethers::types::U256::exp10(18)
                            }
                            Err(e) => {
                                if current_cycle % 50 == 1 {
                                    info!(cycle = current_cycle, error = %e, "ITP inventory read error, falling back to $1");
                                }
                                ethers::types::U256::exp10(18)
                            }
                        }
                    };

                    // Cross-chain order processing
                    if let (Some(ref arb_reader), Some(ref orchestrator), Some(ref arb_writer)) =
                        (&arbitrum_reader_for_task, &bridge_orchestrator_for_task, &arbitrum_writer_for_task)
                    {
                        run_cross_chain_processing(
                            &protocol, arb_reader, orchestrator, arb_writer,
                            &consensus_chain_reader,
                            current_cycle, node_index_for_task, consensus_config.num_issuers,
                            &data_node_url_for_task, &itp_id_for_task,
                            local_nav_fallback,
                            &quote_tokens_for_task,
                        ).await;
                    } else if arbitrum_reader_for_task.is_some() && bridge_orchestrator_for_task.is_none() {
                        if current_cycle % 100 == 1 {
                            debug!(cycle = current_cycle, "Skipping cross-chain: BridgeOrchestrator not initialized");
                        }
                    }

                    // Cross-chain SELL order processing
                    if let (Some(ref arb_reader), Some(ref orchestrator), Some(ref arb_writer)) =
                        (&arbitrum_reader_for_task, &bridge_orchestrator_for_task, &arbitrum_writer_for_task)
                    {
                        run_cross_chain_sell_processing(
                            &protocol, arb_reader, orchestrator, arb_writer,
                            &consensus_chain_reader,
                            current_cycle, node_index_for_task, consensus_config.num_issuers,
                            &data_node_url_for_task, &itp_id_for_task,
                            local_nav_fallback,
                            &quote_tokens_for_task,
                        ).await;
                    }

                    // L3-native order processing (sell orders, direct L3 buys)
                    if let Some(ref orchestrator) = bridge_orchestrator_for_task {
                        if let Some(ref protocol) = consensus_protocol_for_task {
                            run_l3_native_order_processing(
                                protocol,
                                orchestrator,
                                &consensus_chain_reader,
                                current_cycle,
                                node_index_for_task,
                                consensus_config.num_issuers,
                                &mut first_seen_orders,
                                &data_node_url_for_task,
                                &itp_id_for_task,
                                local_nav_fallback,
                                &quote_tokens_for_task,
                            ).await;
                        }
                    }

                    // Rebalance processing: ONLY on heartbeat cycles (not rushed by fast cycles)
                    if is_heartbeat {
                        if let Some(ref orchestrator) = bridge_orchestrator_for_task {
                            if let Some(ref protocol) = consensus_protocol_for_task {
                                run_rebalance_processing(
                                    protocol,
                                    orchestrator,
                                    &consensus_chain_reader,
                                    current_cycle,
                                    node_index_for_task,
                                    consensus_config.num_issuers,
                                    &price_fetcher_for_task,
                                    &symbol_map_for_task,
                                    &quote_tokens_for_task,
                                ).await;
                            }
                        }
                    }

                    // Stale order watchdog: ONLY on heartbeat cycles, check every 50
                    if is_heartbeat && current_cycle % 50 == 0 {
                        if let Some(ref orchestrator) = bridge_orchestrator_for_task {
                            let orch = orchestrator.read().await;
                            let stale_orders = orch.get_stale_orders().await;
                            if !stale_orders.is_empty() {
                                warn!(
                                    cycle = current_cycle,
                                    count = stale_orders.len(),
                                    "Stale order watchdog: found stuck orders, resetting for retry"
                                );
                                drop(orch);
                                let orch = orchestrator.read().await;
                                for (order_id, status) in &stale_orders {
                                    warn!(
                                        order_id = %order_id,
                                        status = ?status,
                                        "Resetting stale order"
                                    );
                                    orch.reset_stale_order(order_id).await;

                                    // For cross-chain orders, also clear from ArbitrumReader dedup
                                    if matches!(status,
                                        issuer::bridge::BridgeOrderStatus::Pending |
                                        issuer::bridge::BridgeOrderStatus::BridgedToL3
                                    ) {
                                        if let Some(ref arb_reader) = arbitrum_reader_for_task {
                                            let chain_id = arb_reader.config().chain_id;
                                            arb_reader.remove_seen_order(chain_id, *order_id).await;
                                        }
                                    }
                                }
                            }

                            // Periodic watchdog cleanup
                            if current_cycle % 500 == 0 {
                                let orch = orchestrator.read().await;
                                orch.cleanup_watchdog().await;
                            }
                        }
                    }

                    // Signal CycleManager: has pending work → trigger fast cycle
                    let has_pending = if let Some(ref orch) = bridge_orchestrator_for_task {
                        orch.read().await.has_in_flight_orders().await
                    } else {
                        false
                    };
                    let _ = work_tx_for_task.try_send(has_pending);
                } else {
                    // Mock consensus
                    run_mock_consensus(
                        &consensus_chain_reader, &consensus_chain_writer_for_task,
                        has_bls_keypair, current_cycle, &consensus_metrics, start_time,
                        &arbitrum_reader_for_task,
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

    // Build unified HTTP API server (health + nav-sign + registry-sync + optional Vision)
    let issuer_state = Arc::new(IssuerApiState {
        node_id,
        p2p_transport: components.p2p.transport.clone(),
        metrics: components.consensus.metrics.clone(),
        registry_sync_cache: components.registry_sync_cache.clone(),
        nav_sign_handler: nav_sign_handler.clone(),
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

async fn run_itp_creation_phase<P, W, K, PF>(
    protocol: &Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    arb_reader: &Arc<issuer::ArbitrumChainReader<ethers::providers::Provider<ethers::providers::Http>>>,
    arb_writer: &Arc<issuer::ArbitrumChainWriter>,
    l3_writer: &Option<Arc<issuer::EthersChainWriter>>,
    itp_config: &issuer::ItpCreationConfig,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    match arb_reader.get_all_pending_requests().await {
        Ok(pending_requests) => {
            if !pending_requests.is_empty() {
                info!(cycle = current_cycle, count = pending_requests.len(), "Found pending ITP creation requests");

                let am_leader = calculate_bridge_leader(current_cycle, num_issuers, node_index);

                for request in pending_requests {
                    info!(nonce = %request.nonce, admin = ?request.admin, name = %request.name, am_leader, "Processing ITP creation request");

                    match protocol.run_itp_creation_phase(&request, itp_config, am_leader).await {
                        Ok(result) => {
                            info!(nonce = %result.nonce, signer_count = result.signature_count, "ITP creation consensus succeeded");

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

                                // Step 2: Complete on Arb with the L3 itpId (deploys BridgedITP ERC20)
                                if let Some(itp_id) = l3_itp_id {
                                    const RECEIPT_TIMEOUT_SECS: u64 = 60;
                                    match arb_writer.complete_create_itp_and_wait(
                                        result.nonce, itp_id,
                                        result.aggregated_signature.clone(),
                                        RECEIPT_TIMEOUT_SECS,
                                    ).await {
                                        Ok(receipt) => {
                                            info!(nonce = %result.nonce, itp_id = ?itp_id, tx_hash = ?receipt.transaction_hash, "ITP creation confirmed on both L3 and Arbitrum");
                                        }
                                        Err(e) => {
                                            error!(nonce = %result.nonce, error = %e, "Failed to complete ITP creation on Arbitrum (L3 succeeded)");
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
    protocol: &Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    arb_reader: &Arc<issuer::ArbitrumChainReader<ethers::providers::Provider<ethers::providers::Http>>>,
    orchestrator: &Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    arb_writer: &Arc<issuer::ArbitrumChainWriter>,
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    data_node_url_for_task: &Option<String>,
    itp_id_for_task: &str,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: &Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    let confirmed_block = match arb_reader.get_confirmed_block().await {
        Ok(block) => block,
        Err(e) => { debug!(cycle = current_cycle, error = %e, "Failed to get confirmed block"); return; }
    };

    if confirmed_block == 0 { return; }

    let from_block = confirmed_block.saturating_sub(10000);

    match arb_reader.get_confirmed_cross_chain_orders(from_block, confirmed_block).await {
        Ok(orders) if !orders.is_empty() => {
            // Filter out orders already known to orchestrator (already processed or in-progress)
            let mut new_orders = Vec::new();
            {
                let orch = orchestrator.read().await;
                for order in orders {
                    if orch.get_order_status(&order.order_id).await.is_none() {
                        new_orders.push(order);
                    }
                }
            }
            if new_orders.is_empty() {
                debug!(cycle = current_cycle, "All cross-chain orders already processed");
            } else {
                info!(cycle = current_cycle, order_count = new_orders.len(), from_block, to_block = confirmed_block, "Found cross-chain orders");
            }

            for order in new_orders {
                // Use order_id for leader election (not cycle) — all nodes detect the same order
                // at potentially different cycles, so cycle-based election causes no-leader scenarios.
                let am_leader = calculate_bridge_leader(order.order_id.as_u64(), num_issuers, node_index);
                info!(order_id = %order.order_id, itp_id = ?order.itp_id, user = ?order.user, amount = %order.amount, am_leader, "Processing cross-chain order");

                {
                    let orch_write = orchestrator.write().await;
                    orch_write.set_order_amount(order.order_id, order.amount).await;
                    orch_write.set_order_limit_price(order.order_id, order.limit_price, 0).await; // 0 = BUY
                    orch_write.set_order_status(order.order_id, issuer::BridgeOrderStatus::Pending).await;
                }

                let chain_id = arb_reader.config().chain_id;
                match protocol.run_bridge_arb_to_l3_phase(&order, am_leader).await {
                    Ok(result) => {
                        info!(order_id = %order.order_id, signer_count = result.signature_count, "Bridge Arb→L3 consensus completed");

                        // Only advance to submit phase if BLS consensus actually happened.
                        // signer_count==0 means no proposal was received (follower raced ahead
                        // of leader), so advancing would cause status collisions when the
                        // leader's proposal arrives later.
                        if result.signature_count == 0 {
                            debug!(order_id = %order.order_id, "Bridge phase had no signers, skipping submit (will retry next cycle)");
                            continue;
                        }

                        match protocol.run_submit_order_phase(&order, am_leader).await {
                            Ok(submit_result) => {
                                info!(order_id = %order.order_id, signer_count = submit_result.signature_count, "Submit order consensus completed");

                                if submit_result.signature_count == 0 {
                                    debug!(order_id = %order.order_id, "Submit phase had no signers, skipping advancement (will retry next cycle)");
                                    continue;
                                }

                                // Mark as processed so it won't be retried
                                arb_reader.mark_order_processed(chain_id, order.order_id).await;
                                // ALL nodes must advance to SubmittedOnL3 so that:
                                // 1. get_submitted_bridged_orders() returns the order on all nodes
                                // 2. The L3-native guard sees it and skips (prevents double-registration)
                                // 3. Batch leader election uses the same batch_key everywhere
                                // (Leader already set this in protocol.rs, but followers haven't.)
                                {
                                    let orch = orchestrator.write().await;
                                    orch.set_order_status(order.order_id, issuer::BridgeOrderStatus::SubmittedOnL3).await;
                                    orch.set_order_amount(order.order_id, order.amount).await;
                                    // Store mapping on ALL nodes (leader already stored via execute_submit_order,
                                    // but followers need it too for mintBridgedShares user lookup).
                                    let l3_id = submit_result.l3_order_id.unwrap_or(order.order_id);
                                    orch.store_order_mapping(issuer::bridge::OrderMapping {
                                        arb_order_id: order.order_id,
                                        l3_order_id: l3_id,
                                        original_user: order.user,
                                        created_at: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_secs(),
                                    }).await;
                                }
                            }
                            Err(e) => {
                                warn!(order_id = %order.order_id, error = %e, "Submit order consensus failed");
                                arb_reader.increment_retry_count(chain_id, order.order_id).await;
                            }
                        }
                    }
                    Err(e) => {
                        warn!(order_id = %order.order_id, error = %e, am_leader, "Bridge Arb→L3 consensus failed");
                        arb_reader.increment_retry_count(chain_id, order.order_id).await;
                    }
                }
            }
        }
        Ok(_) => { debug!(cycle = current_cycle, "No new cross-chain orders"); }
        Err(e) => { warn!(cycle = current_cycle, error = %e, "Failed to fetch cross-chain orders"); }
    }

    // Process batch for SubmittedOnL3 orders
    let submitted_orders = {
        let o = orchestrator.read().await;
        o.get_submitted_bridged_orders().await
    };

    if !submitted_orders.is_empty() {
        // Resolve Arb order IDs → L3 order IDs for BLS hash and on-chain calls.
        // The contract uses L3 IDs, so the BLS hash must match.
        // On the leader, resolve_l3_order_ids uses stored mappings.
        // On followers, it falls back to arb IDs (but followers don't create proposals —
        // they receive L3 IDs from the leader's P2P broadcast and sign those).
        let l3_order_ids = {
            let o = orchestrator.read().await;
            o.resolve_l3_order_ids(&submitted_orders).await
        };
        // Reverse lookup: L3 ID → Arb ID (for post-fill operations that need Arb IDs)
        let l3_to_arb: std::collections::HashMap<ethers::types::U256, ethers::types::U256> =
            l3_order_ids.iter().zip(submitted_orders.iter()).map(|(l3, arb)| (*l3, *arb)).collect();

        info!(
            cycle = current_cycle,
            arb_order_ids = ?submitted_orders.iter().map(|id| id.as_u64()).collect::<Vec<_>>(),
            l3_order_ids = ?l3_order_ids.iter().map(|id| id.as_u64()).collect::<Vec<_>>(),
            "Resolved Arb→L3 order IDs for batch/fills"
        );

        // Use order-based leader election (same node as submit leader, which has the arb→L3 mapping)
        let batch_key = submitted_orders.first().map(|id| id.as_u64()).unwrap_or(current_cycle);
        let batch_am_leader = calculate_bridge_leader(batch_key, num_issuers, node_index);
        info!(cycle = current_cycle, order_count = submitted_orders.len(), batch_am_leader, "Processing batch for SubmittedOnL3 orders");

        let nav = fetch_nav(&data_node_url_for_task, &itp_id_for_task, local_nav_fallback).await;
        info!(cycle = current_cycle, nav = %nav, local_nav_fallback = %local_nav_fallback, "NAV for batch confirm fills");
        let prices: Vec<ethers::types::U256> = l3_order_ids.iter()
            .map(|_| nav)
            .collect();

        match protocol.run_batch_confirm_phase(current_cycle, l3_order_ids.clone(), prices, batch_am_leader).await {
            Ok(batch_result) => {
                info!(cycle = current_cycle, signer_count = batch_result.signature_count, "Batch confirmation completed");

                // Mark orders as Batched using ARB IDs (not L3 IDs) to avoid namespace collisions
                {
                    let orch = orchestrator.write().await;
                    for oid in &submitted_orders {
                        orch.set_order_status(*oid, issuer::BridgeOrderStatus::Batched).await;
                    }
                }

                // Emit per-asset trades for cross-chain buy orders
                if let Ok(itp_h256) = itp_id_for_task.parse::<ethers::types::H256>() {
                    let asset_trade_orders: Vec<(ethers::types::H256, u8, ethers::types::U256)> = {
                        let o = orchestrator.read().await;
                        let mut trades = Vec::new();
                        for order_id in &submitted_orders {
                            let amount = o.get_order_amount(order_id).await
                                .unwrap_or(ethers::types::U256::exp10(18));
                            trades.push((itp_h256, 0u8 /* BUY */, amount));
                        }
                        trades
                    };

                    match protocol.run_asset_trades_phase(current_cycle, &asset_trade_orders, chain_reader, batch_am_leader, quote_tokens.as_ref()).await {
                        Ok(at_result) => {
                            info!(
                                cycle = current_cycle,
                                signer_count = at_result.signature_count,
                                "Cross-chain asset trades emitted"
                            );
                        }
                        Err(e) => {
                            warn!(cycle = current_cycle, error = %e, "Asset trades emission failed (fills will proceed)");
                        }
                    }
                }

                // completeBuyOrder: ArbBridgeCustody → vault (BLS consensus required)
                {
                    let vault = orchestrator.read().await.config().bitget_vault;
                    for order_id in &submitted_orders {
                        match protocol.run_complete_buy_order_phase(
                            current_cycle, *order_id, vault, batch_am_leader,
                        ).await {
                            Ok(cbo_result) => {
                                info!(cycle = current_cycle, order_id = %order_id, signer_count = cbo_result.signature_count, "CompleteBuyOrder consensus completed");
                                if batch_am_leader && !cbo_result.aggregated_signature.0.is_empty() {
                                    match arb_writer.complete_buy_order(*order_id, vault, cbo_result.aggregated_signature.0.clone()).await {
                                        Ok(tx_hash) => info!(?tx_hash, order_id = %order_id, "completeBuyOrder submitted"),
                                        Err(e) => warn!(error = %e, order_id = %order_id, "completeBuyOrder failed"),
                                    }
                                }
                            }
                            Err(e) => warn!(error = %e, order_id = %order_id, "CompleteBuyOrder consensus failed"),
                        }
                    }
                }

                // Build fills with L3 order IDs (for BLS hash + on-chain), amounts from Arb ID lookup
                // Filter out orders where fill price violates limit (E126 guard)
                let fills: Vec<Fill> = {
                    let o = orchestrator.read().await;
                    let mut fills = Vec::new();
                    for (l3_id, arb_id) in l3_order_ids.iter().zip(submitted_orders.iter()) {
                        let amount = o.get_order_amount(arb_id).await
                            .unwrap_or(ethers::types::U256::exp10(18));
                        // Check limit price from orchestrator (stored when order was first tracked)
                        if let Some((limit_price, side)) = o.get_order_limit_price(arb_id).await {
                            let order_side = common::types::Side::from(side);
                            if !fill_price_respects_limit(nav, limit_price, order_side) {
                                warn!(order_id = %arb_id, l3_id = %l3_id, nav = %nav, limit_price = %limit_price,
                                    "Skipping cross-chain fill: NAV violates limit price (E126 guard)");
                                continue;
                            }
                        }
                        fills.push(Fill {
                            order_id: *l3_id, // L3 ID for on-chain confirmFills
                            fill_price: nav,
                            fill_amount: amount,
                        });
                    }
                    fills
                };

                match protocol.run_fills_confirm_phase(current_cycle, fills.clone(), batch_am_leader).await {
                    Ok(fills_result) => {
                        info!(cycle = current_cycle, signer_count = fills_result.signature_count, "Fills confirmed");

                        // Step 8: Mint BridgedITP shares on Arbitrum
                        if let Ok(itp_h256) = itp_id_for_task.parse::<ethers::types::H256>() {
                            let bridge_proxy = orchestrator.read().await.config().bridge_proxy;
                            for fill in &fills {
                                // Look up original user from order mapping (using Arb ID)
                                let arb_id = l3_to_arb.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                let mapping = orchestrator.read().await.get_order_mapping(&arb_id).await;
                                if let Some(mapping) = mapping {
                                    // shares = fill_amount * 1e18 / fill_price
                                    let shares = if fill.fill_price > ethers::types::U256::zero() {
                                        (fill.fill_amount * ethers::types::U256::exp10(18)) / fill.fill_price
                                    } else {
                                        fill.fill_amount
                                    };

                                    match protocol.run_mint_bridged_shares_phase(
                                        current_cycle, itp_h256, mapping.original_user, shares, bridge_proxy, batch_am_leader,
                                    ).await {
                                        Ok(mint_result) => {
                                            info!(cycle = current_cycle, user = ?mapping.original_user, shares = %shares, signer_count = mint_result.signature_count, "MintBridgedShares consensus completed");
                                            // Leader executes the Arb transaction
                                            if batch_am_leader && !mint_result.aggregated_signature.0.is_empty() {
                                                match arb_writer.mint_bridged_shares(itp_h256, mapping.original_user, shares, mint_result.aggregated_signature.0.clone()).await {
                                                    Ok(tx_hash) => {
                                                        info!(?tx_hash, user = ?mapping.original_user, shares = %shares, "mintBridgedShares tx submitted on Arb");
                                                        let orch = orchestrator.write().await;
                                                        orch.mark_orders_shares_bridged(&[arb_id]).await;
                                                    }
                                                    Err(e) => warn!(error = %e, user = ?mapping.original_user, "mintBridgedShares tx failed"),
                                                }
                                            }
                                        }
                                        Err(e) => warn!(cycle = current_cycle, error = %e, order_id = %fill.order_id, "MintBridgedShares consensus failed"),
                                    }
                                } else {
                                    warn!(order_id = %fill.order_id, "No order mapping found — cannot bridge shares");
                                }
                            }
                        }
                    }
                    Err(e) => { warn!(cycle = current_cycle, error = %e, "Fills confirmation failed"); }
                }
            }
            Err(e) => {
                let err_str = format!("{}", e);
                if err_str.contains("E021") || err_str.contains("7a5425d1") || err_str.contains("AlreadyBatched") {
                    // Order was already batched (e.g. by regular consensus). Skip to fills directly.
                    info!(cycle = current_cycle, "Orders already batched (E021), skipping to fills");

                    // E021: completeBuyOrder (may already be done, E125 is benign)
                    {
                        let vault = orchestrator.read().await.config().bitget_vault;
                        for order_id in &submitted_orders {
                            match protocol.run_complete_buy_order_phase(
                                current_cycle, *order_id, vault, batch_am_leader,
                            ).await {
                                Ok(cbo_result) => {
                                    info!(cycle = current_cycle, order_id = %order_id, signer_count = cbo_result.signature_count, "CompleteBuyOrder consensus (E021 path)");
                                    if batch_am_leader && !cbo_result.aggregated_signature.0.is_empty() {
                                        match arb_writer.complete_buy_order(*order_id, vault, cbo_result.aggregated_signature.0.clone()).await {
                                            Ok(tx_hash) => info!(?tx_hash, order_id = %order_id, "completeBuyOrder submitted (E021 path)"),
                                            Err(e) => info!(error = %e, order_id = %order_id, "completeBuyOrder already done or failed (E021 path)"),
                                        }
                                    }
                                }
                                Err(e) => warn!(error = %e, order_id = %order_id, "CompleteBuyOrder consensus failed (E021 path)"),
                            }
                        }
                    }

                    // E021 fallback: use L3 IDs for fills, Arb IDs for internal tracking
                    let fills: Vec<Fill> = {
                        let o = orchestrator.read().await;
                        let mut fills = Vec::new();
                        for (l3_id, arb_id) in l3_order_ids.iter().zip(submitted_orders.iter()) {
                            let amount = o.get_order_amount(arb_id).await
                                .unwrap_or(ethers::types::U256::exp10(18));
                            fills.push(Fill {
                                order_id: *l3_id, // L3 ID for on-chain confirmFills
                                fill_price: nav,
                                fill_amount: amount,
                            });
                        }
                        fills
                    };

                    match protocol.run_fills_confirm_phase(current_cycle, fills.clone(), batch_am_leader).await {
                        Ok(fills_result) => {
                            info!(cycle = current_cycle, signer_count = fills_result.signature_count, "Fills confirmed (after E021 batch skip)");
                            {
                                let orch = orchestrator.write().await;
                                for oid in &submitted_orders {
                                    orch.set_order_status(*oid, issuer::BridgeOrderStatus::Filled).await;
                                }
                            }

                            // Step 8: Mint BridgedITP shares on Arbitrum (E021 path)
                            if let Ok(itp_h256) = itp_id_for_task.parse::<ethers::types::H256>() {
                                let bridge_proxy = orchestrator.read().await.config().bridge_proxy;
                                for fill in &fills {
                                    let arb_id = l3_to_arb.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                    let mapping = orchestrator.read().await.get_order_mapping(&arb_id).await;
                                    if let Some(mapping) = mapping {
                                        let shares = if fill.fill_price > ethers::types::U256::zero() {
                                            (fill.fill_amount * ethers::types::U256::exp10(18)) / fill.fill_price
                                        } else {
                                            fill.fill_amount
                                        };

                                        match protocol.run_mint_bridged_shares_phase(
                                            current_cycle, itp_h256, mapping.original_user, shares, bridge_proxy, batch_am_leader,
                                        ).await {
                                            Ok(mint_result) => {
                                                if batch_am_leader && !mint_result.aggregated_signature.0.is_empty() {
                                                    match arb_writer.mint_bridged_shares(itp_h256, mapping.original_user, shares, mint_result.aggregated_signature.0.clone()).await {
                                                        Ok(tx_hash) => {
                                                            info!(?tx_hash, user = ?mapping.original_user, shares = %shares, "mintBridgedShares tx submitted (E021 path)");
                                                            let orch = orchestrator.write().await;
                                                            orch.mark_orders_shares_bridged(&[arb_id]).await;
                                                        }
                                                        Err(e) => warn!(error = %e, "mintBridgedShares tx failed (E021 path)"),
                                                    }
                                                }
                                            }
                                            Err(e) => warn!(cycle = current_cycle, error = %e, "MintBridgedShares failed (E021 path)"),
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            let fills_err = format!("{}", e);
                            if fills_err.contains("6e6e29cb") || fills_err.contains("already") {
                                // Order already filled on-chain. Mark as Filled and proceed to mint.
                                info!(cycle = current_cycle, "Order already filled on-chain, proceeding to mint");
                                {
                                    let orch = orchestrator.write().await;
                                    for oid in &submitted_orders {
                                        orch.set_order_status(*oid, issuer::BridgeOrderStatus::Filled).await;
                                    }
                                }

                                // Mint BridgedITP shares (already-filled path)
                                if let Ok(itp_h256) = itp_id_for_task.parse::<ethers::types::H256>() {
                                    let bridge_proxy = orchestrator.read().await.config().bridge_proxy;
                                    for fill in &fills {
                                        let arb_id = l3_to_arb.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                        let mapping = orchestrator.read().await.get_order_mapping(&arb_id).await;
                                        if let Some(mapping) = mapping {
                                            let shares = if fill.fill_price > ethers::types::U256::zero() {
                                                (fill.fill_amount * ethers::types::U256::exp10(18)) / fill.fill_price
                                            } else {
                                                fill.fill_amount
                                            };

                                            match protocol.run_mint_bridged_shares_phase(
                                                current_cycle, itp_h256, mapping.original_user, shares, bridge_proxy, batch_am_leader,
                                            ).await {
                                                Ok(mint_result) => {
                                                    if batch_am_leader && !mint_result.aggregated_signature.0.is_empty() {
                                                        match arb_writer.mint_bridged_shares(itp_h256, mapping.original_user, shares, mint_result.aggregated_signature.0.clone()).await {
                                                            Ok(tx_hash) => {
                                                                info!(?tx_hash, user = ?mapping.original_user, shares = %shares, "mintBridgedShares tx submitted (already-filled path)");
                                                                let orch = orchestrator.write().await;
                                                                orch.mark_orders_shares_bridged(&[arb_id]).await;
                                                            }
                                                            Err(e) => warn!(error = %e, "mintBridgedShares tx failed (already-filled path)"),
                                                        }
                                                    }
                                                }
                                                Err(e) => warn!(cycle = current_cycle, error = %e, "MintBridgedShares failed (already-filled path)"),
                                            }
                                        } else {
                                            warn!(order_id = %fill.order_id, "No order mapping found (already-filled path)");
                                        }
                                    }
                                }
                            } else {
                                warn!(cycle = current_cycle, error = %e, "Fills confirmation also failed after E021");
                            }
                        }
                    }
                } else {
                    warn!(cycle = current_cycle, error = %e, "Batch confirmation failed");
                }
            }
        }
    }

    if current_cycle % 1000 == 0 {
        arb_reader.clear_old_seen_orders(100_000).await;
    }

}

/// Cross-chain SELL order processing from Arbitrum
///
/// Full 3-phase consensus-driven sell flow:
/// Phase A: Submit sell on L3 (consensus) — submitOrderFor(SELL)
/// Phase B: Batch/trades/fills (reuse existing consensus phases)
/// Phase C: Complete sell on Arb (consensus) — completeSellOrder()
async fn run_cross_chain_sell_processing<P, W, K, PF>(
    protocol: &Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    arb_reader: &Arc<issuer::ArbitrumChainReader<ethers::providers::Provider<ethers::providers::Http>>>,
    orchestrator: &Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    arb_writer: &Arc<issuer::ArbitrumChainWriter>,
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    data_node_url_for_task: &Option<String>,
    itp_id_for_task: &str,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: &Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    let confirmed_block = match arb_reader.get_confirmed_block().await {
        Ok(block) => block,
        Err(e) => { debug!(cycle = current_cycle, error = %e, "Failed to get confirmed block for sell orders"); return; }
    };

    if confirmed_block == 0 { return; }

    let from_block = confirmed_block.saturating_sub(10000);

    // ====== Phase A: Detect new sell orders and submit on L3 via consensus ======
    match arb_reader.get_confirmed_cross_chain_sell_orders(from_block, confirmed_block).await {
        Ok(sell_orders) if !sell_orders.is_empty() => {
            let mut new_sell_orders = Vec::new();
            {
                let orch = orchestrator.read().await;
                for order in sell_orders {
                    if orch.get_sell_order_status(&order.order_id).await.is_none() {
                        new_sell_orders.push(order);
                    }
                }
            }
            if new_sell_orders.is_empty() {
                debug!(cycle = current_cycle, "All cross-chain sell orders already processed");
            } else {
                info!(cycle = current_cycle, order_count = new_sell_orders.len(), from_block, to_block = confirmed_block, "Found cross-chain sell orders");
            }

            for sell_order in new_sell_orders {
                let am_leader = calculate_bridge_leader(sell_order.order_id.as_u64(), num_issuers, node_index);
                info!(
                    order_id = %sell_order.order_id,
                    itp_id = ?sell_order.itp_id,
                    user = ?sell_order.user,
                    bridged_itp_address = ?sell_order.bridged_itp_address,
                    amount = %sell_order.amount,
                    am_leader,
                    "Processing cross-chain sell order"
                );

                // Mark as SellPending and store amount
                {
                    let orch_write = orchestrator.write().await;
                    orch_write.set_sell_order_status(sell_order.order_id, issuer::BridgeOrderStatus::SellPending).await;
                    orch_write.set_sell_order_amount(sell_order.order_id, sell_order.amount).await;
                }

                let chain_id = arb_reader.config().chain_id;

                // Phase A: Submit sell order on L3 via consensus
                match protocol.run_submit_sell_order_phase(
                    sell_order.order_id,
                    sell_order.itp_id,
                    sell_order.user,
                    sell_order.bridged_itp_address,
                    sell_order.amount,
                    am_leader,
                ).await {
                    Ok(submit_result) => {
                        info!(
                            order_id = %sell_order.order_id,
                            signer_count = submit_result.signature_count,
                            "Submit sell order consensus completed"
                        );
                        // Mark as SellSubmittedOnL3 and mark processed in arb_reader
                        {
                            let orch_write = orchestrator.write().await;
                            orch_write.set_sell_order_status(sell_order.order_id, issuer::BridgeOrderStatus::SellSubmittedOnL3).await;
                        }
                        arb_reader.mark_sell_order_processed(chain_id, sell_order.order_id).await;
                    }
                    Err(e) => {
                        warn!(order_id = %sell_order.order_id, error = %e, am_leader, "Submit sell order consensus failed");
                        arb_reader.mark_sell_order_processed(chain_id, sell_order.order_id).await;
                        // Mark to avoid re-processing (will retry on next detection)
                    }
                }
            }
        }
        Ok(_) => { debug!(cycle = current_cycle, "No new cross-chain sell orders"); }
        Err(e) => { warn!(cycle = current_cycle, error = %e, "Failed to fetch cross-chain sell orders"); }
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

        // Resolve arb sell IDs → L3 order IDs
        let l3_order_ids = {
            let o = orchestrator.read().await;
            o.resolve_sell_l3_order_ids(&submitted_sell_orders).await
        };

        if l3_order_ids.is_empty() && batch_am_leader {
            warn!(cycle = current_cycle, "No L3 order IDs resolved for sell orders (leader only has mappings)");
        }

        // Use L3 order IDs if available, otherwise use arb IDs (followers don't have mappings)
        let order_ids_for_batch = if !l3_order_ids.is_empty() {
            l3_order_ids
        } else {
            submitted_sell_orders.clone()
        };

        let nav = fetch_nav(data_node_url_for_task, itp_id_for_task, local_nav_fallback).await;
        info!(cycle = current_cycle, nav = %nav, "NAV for sell batch/fills");
        let prices: Vec<ethers::types::U256> = order_ids_for_batch.iter()
            .map(|_| nav)
            .collect();

        match protocol.run_batch_confirm_phase(current_cycle, order_ids_for_batch.clone(), prices, batch_am_leader).await {
            Ok(batch_result) => {
                info!(cycle = current_cycle, signer_count = batch_result.signature_count, "Sell batch confirmation completed");

                // Emit per-asset SELL trades
                if let Ok(itp_h256) = itp_id_for_task.parse::<ethers::types::H256>() {
                    let asset_trade_orders: Vec<(ethers::types::H256, u8, ethers::types::U256)> = {
                        let o = orchestrator.read().await;
                        let mut trades = Vec::new();
                        for order_id in &submitted_sell_orders {
                            let amount = o.get_sell_order_amount(order_id).await
                                .unwrap_or(ethers::types::U256::exp10(18));
                            trades.push((itp_h256, 1u8 /* SELL */, amount));
                        }
                        trades
                    };

                    match protocol.run_asset_trades_phase(current_cycle, &asset_trade_orders, chain_reader, batch_am_leader, quote_tokens.as_ref()).await {
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

                // Confirm fills for sell orders
                let fills: Vec<Fill> = {
                    let o = orchestrator.read().await;
                    let mut fills = Vec::new();
                    for (i, order_id) in order_ids_for_batch.iter().enumerate() {
                        let arb_order_id = submitted_sell_orders.get(i).unwrap_or(order_id);
                        let amount = o.get_sell_order_amount(arb_order_id).await
                            .unwrap_or(ethers::types::U256::exp10(18));
                        fills.push(Fill {
                            order_id: *order_id,
                            fill_price: nav,
                            fill_amount: amount,
                        });
                    }
                    fills
                };

                match protocol.run_fills_confirm_phase(current_cycle, fills, batch_am_leader).await {
                    Ok(fills_result) => {
                        info!(cycle = current_cycle, signer_count = fills_result.signature_count, "Sell fills confirmed");

                        // Mark all as SellFilled
                        let orch = orchestrator.write().await;
                        for oid in &submitted_sell_orders {
                            orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::SellFilled).await;
                        }
                    }
                    Err(e) => {
                        let fills_err = format!("{}", e);
                        if fills_err.contains("6e6e29cb") || fills_err.contains("already") {
                            info!(cycle = current_cycle, "Sell order already filled on-chain, marking as SellFilled");
                            let orch = orchestrator.write().await;
                            for oid in &submitted_sell_orders {
                                orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::SellFilled).await;
                            }
                        } else {
                            warn!(cycle = current_cycle, error = %e, "Sell fills confirmation failed");
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
                        for order_id in &order_ids_for_batch {
                            let amount = o.get_sell_order_amount(order_id).await
                                .unwrap_or(ethers::types::U256::exp10(18));
                            fills.push(Fill {
                                order_id: *order_id,
                                fill_price: nav,
                                fill_amount: amount,
                            });
                        }
                        fills
                    };

                    match protocol.run_fills_confirm_phase(current_cycle, fills, batch_am_leader).await {
                        Ok(fills_result) => {
                            info!(cycle = current_cycle, signer_count = fills_result.signature_count, "Sell fills confirmed (after E021)");
                            let orch = orchestrator.write().await;
                            for oid in &submitted_sell_orders {
                                orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::SellFilled).await;
                            }
                        }
                        Err(e) => {
                            let fills_err = format!("{}", e);
                            if fills_err.contains("6e6e29cb") || fills_err.contains("already") {
                                info!(cycle = current_cycle, "Sell order already filled, marking as SellFilled");
                                let orch = orchestrator.write().await;
                                for oid in &submitted_sell_orders {
                                    orch.set_sell_order_status(*oid, issuer::BridgeOrderStatus::SellFilled).await;
                                }
                            } else {
                                warn!(cycle = current_cycle, error = %e, "Sell fills also failed after E021");
                            }
                        }
                    }
                } else {
                    warn!(cycle = current_cycle, error = %e, "Sell batch confirmation failed");
                }
            }
        }
    }

    // ====== Phase C: Complete sell on Arb for SellFilled orders ======
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

        // Calculate usdc_proceeds = (fill_amount * nav) / 1e18, then convert to 6 decimals
        // amount is 18-dec shares, nav is 18-dec price → result is 18-dec USDC value
        // ARB_USDC has 6 decimals, so divide by 1e12 to convert
        let usdc_proceeds = {
            let o = orchestrator.read().await;
            let amount = o.get_sell_order_amount(&order_id).await
                .unwrap_or(ethers::types::U256::exp10(18));
            let nav = fetch_nav(data_node_url_for_task, itp_id_for_task, local_nav_fallback).await;
            // proceeds_18dec = amount * nav / 1e18, then convert to 6dec
            let proceeds_18dec = amount * nav / ethers::types::U256::exp10(18);
            proceeds_18dec / ethers::types::U256::exp10(12)
        };

        info!(
            order_id = %order_id,
            usdc_proceeds = %usdc_proceeds,
            am_leader,
            "Phase C: Completing sell order on Arbitrum"
        );

        // fundSellOrder: vault → ArbBridgeCustody (pull USDC before completeSellOrder pays user)
        if am_leader {
            let vault = orchestrator.read().await.config().bitget_vault;
            match arb_writer.fund_sell_order(order_id, vault, usdc_proceeds, vec![]).await {
                Ok(tx_hash) => info!(?tx_hash, order_id = %order_id, "fundSellOrder submitted"),
                Err(e) => warn!(error = %e, order_id = %order_id, "fundSellOrder failed"),
            }
        }

        match protocol.run_complete_sell_order_phase(order_id, usdc_proceeds, am_leader).await {
            Ok(result) => {
                info!(
                    order_id = %order_id,
                    signer_count = result.signature_count,
                    "Complete sell order consensus succeeded"
                );

                // Leader: call arb_writer.complete_sell_order
                if am_leader && !result.aggregated_signature.0.is_empty() {
                    match arb_writer.complete_sell_order(
                        order_id,
                        usdc_proceeds,
                        result.aggregated_signature.0.clone(),
                    ).await {
                        Ok(tx_hash) => {
                            info!(
                                order_id = %order_id,
                                tx_hash = ?tx_hash,
                                "completeSellOrder transaction submitted"
                            );

                            // Wait for receipt
                            const RECEIPT_TIMEOUT_SECS: u64 = 60;
                            match arb_writer.wait_for_receipt(tx_hash, RECEIPT_TIMEOUT_SECS).await {
                                Ok(receipt) => {
                                    info!(
                                        order_id = %order_id,
                                        tx_hash = ?tx_hash,
                                        block = ?receipt.block_number,
                                        "completeSellOrder confirmed"
                                    );
                                    let orch = orchestrator.write().await;
                                    orch.mark_sell_order_processed(order_id, tx_hash).await;
                                }
                                Err(e) => {
                                    warn!(order_id = %order_id, error = %e, "completeSellOrder receipt timeout");
                                    // Still mark as completed to avoid re-processing
                                    let orch = orchestrator.write().await;
                                    orch.mark_sell_order_processed(order_id, tx_hash).await;
                                }
                            }
                        }
                        Err(e) => {
                            warn!(order_id = %order_id, error = %e, "completeSellOrder transaction failed");
                        }
                    }
                } else if !am_leader {
                    // Follower: mark as completed (leader handles the tx)
                    let orch = orchestrator.write().await;
                    orch.set_sell_order_status(order_id, issuer::BridgeOrderStatus::SellCompleted).await;
                }
            }
            Err(e) => {
                warn!(order_id = %order_id, error = %e, am_leader, "Complete sell order consensus failed");
            }
        }
    }

    // Periodic cleanup
    if current_cycle % 1000 == 0 {
        arb_reader.clear_old_seen_sell_orders(100_000).await;
    }
}

/// Story 7-14: Process pending rebalances via single-phase consensus
///
/// Scans L3 for RebalanceRequested events via chain_reader and runs a single
/// consensus phase per ITP, calling `rebalance()` on-chain (matches contract).
async fn run_rebalance_processing<P, W, K, PF>(
    protocol: &Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    orchestrator: &Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    price_fetcher: &Arc<dyn PriceFetcher>,
    symbol_map: &issuer::SymbolMap,
    quote_tokens: &Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    // 1. Query pending rebalances from L3
    let pending_rebalances = match chain_reader.get_pending_rebalances().await {
        Ok(rebalances) => rebalances,
        Err(e) => {
            if current_cycle % 500 == 0 {
                debug!(cycle = current_cycle, error = %e, "Failed to fetch pending rebalances");
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

    // 1b. Filter out ITPs already being processed by another cycle (dedup)
    let orch_read = orchestrator.read().await;
    let mut filtered_rebalances = Vec::new();
    let mut filtered_itp_ids = Vec::new();
    for rebalance in &pending_rebalances {
        let itp_h256 = ethers::types::H256::from(rebalance.itp_id);
        if orch_read.is_rebalance_in_progress(&itp_h256).await {
            debug!(
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
        debug!(cycle = current_cycle, "All pending rebalances already in progress");
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
/// CrossChainOrderCreated events from Arbitrum). This function runs confirmBatch +
/// confirmFills via BLS consensus for any pending orders not already tracked by
/// the BridgeOrchestrator.
async fn run_l3_native_order_processing<P, W, K, PF>(
    protocol: &Arc<issuer::ConsensusProtocol<P, W, K, PF>>,
    orchestrator: &Arc<tokio::sync::RwLock<issuer::BridgeOrchestrator>>,
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_issuers: u8,
    first_seen_orders: &mut HashMap<u64, std::time::Instant>,
    data_node_url_for_task: &Option<String>,
    itp_id_for_task: &str,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: &Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: issuer::KeyRegistry + Send + Sync + 'static,
    PF: issuer::PriceFetcher + Send + Sync + 'static,
{
    // Guard: Skip L3-native processing when ANY cross-chain order is active.
    // Must check ALL non-terminal statuses (Pending, BridgedToL3, SubmittedOnL3, Batched),
    // not just SubmittedOnL3. Otherwise, during the bridge/submit phase the guard passes
    // and L3-native picks up the same physical order under the L3 order ID, causing
    // split-brain leader election (different nodes see different order IDs).
    {
        let orch = orchestrator.read().await;
        if orch.has_any_active_bridge_orders().await {
            debug!(
                cycle = current_cycle,
                "Skipping L3-native: cross-chain orders in-flight (processed by bridge pipeline)"
            );
            return;
        }
    }

    // 1. Fetch all pending orders from L3
    let pending_orders = match chain_reader.get_pending_orders().await {
        Ok(orders) => orders,
        Err(e) => {
            debug!(cycle = current_cycle, error = %e, "Failed to fetch pending orders for L3-native processing");
            vec![]
        }
    };

    // 2. Filter out bridge-tracked orders (already managed by cross-chain pipeline)
    let l3_native_orders: Vec<_> = if !pending_orders.is_empty() {
        let orch = orchestrator.read().await;
        let mut native = Vec::new();
        for order in &pending_orders {
            if orch.get_order_status(&order.id).await.is_none() {
                native.push(order.clone());
            }
        }
        native
    } else {
        vec![]
    };

    if !l3_native_orders.is_empty() {
    // 3. Leader assignment: cycle derived from min order ID (deterministic across issuers)
    let min_order_id = l3_native_orders.iter().map(|o| o.id.as_u64()).min().unwrap();
    let l3_cycle = min_order_id + 500_000_000;

    // 4. Leader election with infinite failover rotation
    let detected_at = *first_seen_orders.entry(l3_cycle).or_insert_with(std::time::Instant::now);
    let attempt = detected_at.elapsed().as_secs() / LEADER_TIMEOUT_SECS;
    let am_leader = calculate_bridge_leader_with_failover(l3_cycle, num_issuers, node_index, attempt);

    info!(
        cycle = current_cycle, l3_cycle, attempt, am_leader,
        count = l3_native_orders.len(),
        order_ids = ?l3_native_orders.iter().map(|o| o.id.as_u64()).collect::<Vec<_>>(),
        "Processing L3-native pending orders"
    );

    // 5. Register orders in orchestrator for BLS signature tracking
    {
        let orch = orchestrator.write().await;
        for order in &l3_native_orders {
            orch.set_order_amount(order.id, order.amount).await;
            orch.set_order_status(order.id, issuer::BridgeOrderStatus::SubmittedOnL3).await;
        }
    }

    let order_ids: Vec<ethers::types::U256> = l3_native_orders.iter().map(|o| o.id).collect();
    let nav = fetch_nav(&data_node_url_for_task, &itp_id_for_task, local_nav_fallback).await;
    let prices: Vec<ethers::types::U256> = l3_native_orders.iter()
        .map(|_| nav)
        .collect();

    // 6. Run confirmBatch via BLS consensus
    match protocol.run_batch_confirm_phase(l3_cycle, order_ids.clone(), prices, am_leader).await {
        Ok(batch_result) => {
            info!(
                cycle = current_cycle, l3_cycle,
                signer_count = batch_result.signature_count,
                order_count = order_ids.len(),
                "L3-native batch confirmation completed"
            );

            // Note: Do NOT set order_status here — L3-native order IDs can collide
            // with Arb order IDs in the orchestrator's status map.

            // 6b. Emit per-asset trades (issuer decomposition + cross-ITP netting)
            let asset_trade_orders: Vec<(ethers::types::H256, u8, ethers::types::U256)> = l3_native_orders.iter()
                .map(|o| (o.itp_id, o.side as u8, o.amount))
                .collect();

            match protocol.run_asset_trades_phase(l3_cycle, &asset_trade_orders, chain_reader, am_leader, quote_tokens.as_ref()).await {
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
            let fills: Vec<Fill> = l3_native_orders.iter().filter_map(|order| {
                if !fill_price_respects_limit(nav, order.limit_price, order.side) {
                    warn!(order_id = %order.id, nav = %nav, limit_price = %order.limit_price, side = ?order.side,
                        "Skipping fill: NAV violates order limit price (E126 guard)");
                    return None;
                }
                Some(Fill {
                    order_id: order.id,
                    fill_price: nav,
                    fill_amount: order.amount,
                })
            }).collect();

            if fills.is_empty() {
                warn!(cycle = current_cycle, "All L3-native fills skipped due to limit price violations");
            }

            match protocol.run_fills_confirm_phase(l3_cycle, fills, am_leader).await {
                Ok(fills_result) => {
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
                    first_seen_orders.remove(&l3_cycle);
                }
                Err(e) => {
                    warn!(cycle = current_cycle, l3_cycle, error = %e, "L3-native fills confirmation failed");
                }
            }
        }
        Err(e) => {
            // If batch failed because orders are already batched (E021), try fills only
            let err_str = format!("{}", e);
            if err_str.contains("E021") || err_str.contains("already") {
                info!(cycle = current_cycle, "Orders already batched, attempting fills only");

                let fills: Vec<Fill> = l3_native_orders.iter().filter_map(|order| {
                    if !fill_price_respects_limit(nav, order.limit_price, order.side) {
                        warn!(order_id = %order.id, nav = %nav, limit_price = %order.limit_price,
                            "Skipping fill (E021 retry): NAV violates limit price");
                        return None;
                    }
                    Some(Fill {
                        order_id: order.id,
                        fill_price: nav,
                        fill_amount: order.amount,
                    })
                }).collect();

                match protocol.run_fills_confirm_phase(l3_cycle, fills, am_leader).await {
                    Ok(fills_result) => {
                        info!(cycle = current_cycle, signer_count = fills_result.signature_count, "L3-native fills confirmed (after batch skip)");
                        let orch = orchestrator.write().await;
                        for oid in &order_ids {
                            orch.set_order_status(*oid, issuer::BridgeOrderStatus::Filled).await;
                        }
                        drop(orch);
                        first_seen_orders.remove(&l3_cycle);
                    }
                    Err(e) => {
                        warn!(cycle = current_cycle, error = %e, "L3-native fills also failed");
                    }
                }
            } else {
                warn!(cycle = current_cycle, l3_cycle, error = %e, "L3-native batch confirmation failed");
            }

            // Clean up orchestrator tracking on failure so orders can be retried next cycle
            // (don't leave stale SubmittedOnL3 entries that would be picked up by bridge pipeline)
        }
    }
    } // end if !l3_native_orders.is_empty()

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

    // Include all BATCHED orders — they need fills regardless of tracking source.
    // The pending section may have set orchestrator entries, and bridge orders
    // that are genuinely BATCHED also need fills. confirmFills is idempotent
    // (reverts if already FILLED), so double-attempts are safe.
    let l3_batched_orders = batched_orders;

    if l3_batched_orders.is_empty() {
        return;
    }

    // Leader assignment for fills: cycle derived from min order ID (deterministic across issuers)
    let min_batched_id = l3_batched_orders.iter().map(|o| o.id.as_u64()).min().unwrap();
    let fills_cycle = min_batched_id + 500_000_001;

    let detected_at = *first_seen_orders.entry(fills_cycle).or_insert_with(std::time::Instant::now);
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
    // since L3 order IDs can collide with Arb order IDs in the status map)
    {
        let orch = orchestrator.write().await;
        for order in &l3_batched_orders {
            orch.set_order_amount(order.id, order.amount).await;
        }
    }

    let mut nav = fetch_nav(&data_node_url_for_task, &itp_id_for_task, local_nav_fallback).await;
    if nav.is_zero() {
        warn!("NAV is zero after fetch, using local fallback");
        nav = local_nav_fallback;
    }
    let fills: Vec<Fill> = l3_batched_orders.iter().filter_map(|order| {
        if !fill_price_respects_limit(nav, order.limit_price, order.side) {
            warn!(order_id = %order.id, nav = %nav, limit_price = %order.limit_price, side = ?order.side,
                "Skipping BATCHED fill: NAV violates order limit price (E126 guard)");
            return None;
        }
        Some(Fill {
            order_id: order.id,
            fill_price: nav,
            fill_amount: order.amount,
        })
    }).collect();

    if fills.is_empty() {
        info!(cycle = current_cycle, fills_cycle, "No fillable BATCHED orders (all limit-violated), skipping");
        return;
    }

    match protocol.run_fills_confirm_phase(fills_cycle, fills, fills_am_leader).await {
        Ok(fills_result) => {
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
            first_seen_orders.remove(&fills_cycle);
        }
        Err(e) => {
            warn!(cycle = current_cycle, fills_cycle, error = %e, "BATCHED L3-native fills confirmation failed");
        }
    }
}

/// Fetch live NAV from the data-node backend.
///
/// Returns NAV as U256 (18 decimals). Falls back to `local_nav_fallback` if unavailable.
/// The fallback is computed from on-chain inventory + live Bitget prices in the caller.
async fn fetch_nav(
    data_node_url: &Option<String>,
    itp_id: &str,
    local_nav_fallback: ethers::types::U256,
) -> ethers::types::U256 {
    let url = match data_node_url {
        Some(ref base) => format!("{}/itp-price?itp_id={}", base, itp_id),
        None => {
            if local_nav_fallback != ethers::types::U256::exp10(18) {
                debug!(nav = %local_nav_fallback, "No data_node_url, using local NAV from chain+Bitget");
            } else {
                debug!("No data_node_url configured, using $1 fallback for NAV");
            }
            return local_nav_fallback;
        }
    };

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return local_nav_fallback,
    };

    #[derive(serde::Deserialize)]
    struct ItpPriceResp {
        nav: String,
    }

    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            if local_nav_fallback != ethers::types::U256::exp10(18) {
                debug!(url = %url, status = %r.status(), nav = %local_nav_fallback, "Data-node failed, using local NAV");
            } else {
                debug!(url = %url, status = %r.status(), "NAV fetch failed, using $1 fallback");
            }
            return local_nav_fallback;
        }
        Err(e) => {
            if local_nav_fallback != ethers::types::U256::exp10(18) {
                debug!(url = %url, error = %e, nav = %local_nav_fallback, "Data-node failed, using local NAV");
            } else {
                debug!(url = %url, error = %e, "NAV fetch failed, using $1 fallback");
            }
            return local_nav_fallback;
        }
    };

    let body: ItpPriceResp = match resp.json().await {
        Ok(b) => b,
        Err(_) => return local_nav_fallback,
    };

    let parsed = ethers::types::U256::from_dec_str(&body.nav).unwrap_or(local_nav_fallback);
    if parsed.is_zero() {
        warn!("Backend returned nav=0, using local NAV fallback for fills");
        local_nav_fallback
    } else {
        parsed
    }
}

async fn run_mock_consensus(
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    chain_writer: &Option<Arc<issuer::EthersChainWriter>>,
    has_bls_keypair: bool,
    current_cycle: u64,
    metrics: &Arc<IssuerMetrics>,
    start_time: std::time::Instant,
    arb_reader: &Option<Arc<issuer::ArbitrumChainReader<ethers::providers::Provider<ethers::providers::Http>>>>,
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
    if let Some(ref arb_reader) = arb_reader {
        if let Ok(pending_requests) = arb_reader.get_all_pending_requests().await {
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
        .with_issuer_custody_arb(args.issuer_custody_arb.clone())
        .with_arb_custody(args.arb_custody.clone())
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

    // --- Production guards: dev-only flags must not be used without --mock ---
    if !args.mock {
        if args.no_tls {
            panic!("FATAL: --no-tls requires --mock. Do not disable TLS in production.");
        }
        if args.bls_key_seed_index.is_some() {
            panic!("FATAL: --bls-key-seed-index requires --mock. Deterministic keys are insecure.");
        }
        if args.skip_reconstruction {
            panic!("FATAL: --skip-reconstruction requires --mock. Production nodes must reconstruct state.");
        }
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
    };

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

    let bootstrap = IssuerBootstrap::new(config, params);
    let mut components = bootstrap.build(shutdown).await.map_err(|e| {
        error!(code = "E008", error = %e, "Bootstrap failed");
        e
    })?;

    // GAP 1: Startup diagnostics for cross-chain buy flow
    if components.consensus.bridge_orchestrator.is_none() && components.chain.arbitrum_reader.is_some() {
        warn!(node_id, code = "BRIDGE-010",
              "Cross-chain buy flow DISABLED despite ArbitrumReader being available. Check BRIDGE-00x warnings above.");
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
                    initial_scan_blocks: 10_000,
                };

                let mut handler = RegistrySyncHandler::new(
                    provider,
                    sync_config,
                    components.chain.reader.clone(),
                    bls_keypair.clone(),
                    components.consensus.keys.node_index,
                    cache.clone(),
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
            tokio::spawn(async move {
                issuer::vision::engine::run(
                    engine_scheduler,
                    engine_resolver,
                    engine_config,
                    engine_shutdown,
                ).await;
            });

            // Initialize Postgres pool, chain listener, and API routes
            match sqlx::PgPool::connect(&vision_cfg.database_url).await {
                Ok(pool) => {
                    // Spawn chain listener (unified event indexer: scheduler + Postgres)
                    let vision_address: ethers::types::Address = vision_cfg.vision_address
                        .parse()
                        .expect("valid Vision contract address");
                    let l3_rpc_url = components.chain.rpc_url.clone();
                    let cl_provider = Arc::new(
                        ethers::providers::Provider::<ethers::providers::Http>::try_from(&l3_rpc_url)
                            .expect("valid L3 RPC URL for chain listener")
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

    if let Err(e) = run_main_loop(components, args.api_enabled, args.data_node_url, args.itp_id, mock_usdt_addr, vision_api_router).await {
        error!(code = "E008", error = %e, "Issuer node error");
        std::process::exit(1);
    }

    Ok(())
}
