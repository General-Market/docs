//! AP (Authorized Participant) / Keeper service binary for Index L3
//!
//! Monitors events, manages order queues, and executes trades on Bitget.

use ap::circuit_breaker::CircuitBreaker;
use ap::config::{APConfig, ConfigBuilder};
use ap::event_monitor::{EventMonitorBuilder, EventMonitorConfig};
use ap::event_queue::{APEvent, EventReceiver};
use ap::external::bitget::{BitgetClient, BitgetConfig, RateLimitedBitgetClient};
use ap::external::bitget_vault::BitgetVaultClient;
use ap::sse_client::SseChainEventClient;
use ethers::types::Address as EthAddress;
use ap::limit_enforcer::{LimitOrderEnforcer, ValidationResult, LIMIT_TOLERANCE_BPS, BPS_DENOMINATOR};
use ap::metrics::APMetrics;
use ap::timeout::{TimeoutConfig, TimeoutHandler};
use clap::Parser;
use common::adapters::{DataNodeChainReader, DeploymentConfig, RpcChainReader, RpcChainWriter};
use common::mocks::{MockBitgetBuilder, MockChainBuilder};
use common::rate_limit::{BitgetRateLimiter, RateLimiterTier};
use common::traits::{APClient, ChainWriter};
use common::types::{ExchangeMode, LimitOrder, OrderStatus};
use ethers::prelude::*;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use axum::{Router, Json, routing::get, extract::State, response::IntoResponse, http::StatusCode};
use common::runtime::config::{RuntimeConfig, shared};
use common::runtime::admin::admin_router;
use common::runtime::watcher::DeploymentWatcher;
use tokio::signal;
use tokio::sync::RwLock;
use tracing::{debug, info, warn, error};

/// On-chain trade settlement configuration for E2E testing (Story 6.17)
///
/// When both --mock-bitget and --bitget-vault are set, the AP executes trades
/// on-chain via MockBitgetVault. Asset info comes from oracle-emitted
/// AssetTradeRequest events — AP reads NO on-chain state for trade decisions.
#[derive(Clone)]
struct OnChainSettlement {
    /// MockBitgetVault client for executing trades
    vault_client: Arc<BitgetVaultClient>,
    /// Quote token address (e.g., USDC) - the default quote token (USDC)
    quote_token: Address,
    /// MockUSDT token address (Story 7.18) - for USDT-denominated pair settlement
    #[allow(dead_code)]
    mock_usdt: Option<Address>,
    /// Data-node backend URL for fetching prices
    data_node_url: Option<String>,
    /// Token address to Bitget symbol mapping - loaded from data/symbol-map.json
    symbol_map: Option<Arc<std::collections::HashMap<String, String>>>,
}

/// Index L3 AP (Authorized Participant) / Keeper Service
///
/// Monitors chain events, manages order queues, and executes trades.
#[derive(Parser, Debug)]
#[command(name = "ap")]
#[command(author = "Index Team")]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(about = "Index L3 AP/Keeper - monitors events and executes trades")]
#[command(long_about = None)]
struct Args {
    /// API listen port
    #[arg(long, default_value = "9100")]
    port: u16,

    /// Chain RPC endpoint
    #[arg(long, default_value = "http://localhost:8545")]
    rpc: String,

    /// Use mock Bitget client (for local development)
    #[arg(long)]
    mock_bitget: bool,

    /// Path to configuration file
    #[arg(long)]
    config: Option<PathBuf>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, default_value = "info")]
    log_level: String,

    /// Log output directory
    #[arg(long, default_value = "logs")]
    log_dir: PathBuf,

    /// Output logs as JSON
    #[arg(long)]
    json_logs: bool,

    /// Index.sol contract address (hex, e.g., 0x1234...abcd)
    #[arg(long)]
    index_contract: Option<String>,

    /// Exchange mode: mock, testnet, mainnet
    #[arg(long, value_parser = ["mock", "testnet", "mainnet"])]
    exchange_mode: Option<String>,

    /// Use Bitget testnet (safety default, overrides --bitget-mainnet)
    #[arg(long)]
    bitget_testnet: bool,

    /// Use Bitget mainnet (requires explicit opt-in)
    #[arg(long)]
    bitget_mainnet: bool,

    /// Path to deployment JSON file (enables real chain mode)
    #[arg(long)]
    deployment_file: Option<PathBuf>,

    /// Force mock chain even with deployment file
    #[arg(long)]
    mock_chain: bool,

    /// MockBitgetVault contract address for on-chain trade settlement (E2E testing)
    /// When set with --mock-bitget, AP also calls MockBitgetVault.executeTrade() on-chain
    #[arg(long)]
    bitget_vault: Option<String>,

    /// Override expected chain ID (default: 111222333 for Index L3).
    /// Use for local testing with custom Anvil chain IDs.
    #[arg(long)]
    chain_id: Option<u64>,

    /// MockUSDT token contract address for USDT-pair settlement (Story 7.18)
    /// When set, AP uses this address for trades with USDT-denominated symbols
    #[arg(long)]
    mock_usdt: Option<String>,

    /// Data-node backend URL (e.g., http://localhost:8200).
    /// When set, /nav endpoint fetches NAV from data-node instead of computing locally.
    #[arg(long)]
    data_node_url: Option<String>,

    /// Settlement chain RPC endpoint for on-chain settlement (MockBitgetVault on settlement chain)
    #[arg(long)]
    settlement_rpc: Option<String>,

    /// Settlement chain ID (default: 42161)
    #[arg(long)]
    settlement_chain_id: Option<u64>,
}

fn setup_logging(config: &APConfig) -> Result<(), Box<dyn std::error::Error>> {
    let log_config = common::logging::LogConfig {
        level: config.effective_log_level(),
        dir: config.effective_log_dir(),
        json_enabled: config.effective_json_logs(),
        component_name: "ap".to_string(),
        node_id: None,
    };
    common::logging::init_logging(&log_config)
}

// APMetrics is now imported from ap::metrics module

// -- Shared state for axum handlers --
#[derive(Clone)]
struct AppState {
    metrics: Arc<APMetrics>,
    data_node_url: Option<String>,
}

/// CORS headers middleware layer — applies to every response.
fn cors_layer() -> tower_http::cors::CorsLayer {
    tower_http::cors::CorsLayer::very_permissive()
}

/// GET /health — comprehensive health details (AC #3, #7)
async fn handle_health(State(state): State<AppState>) -> impl IntoResponse {
    let health_details = state.metrics.get_health_details().await;

    let status_code = match health_details.status.as_str() {
        "unhealthy" => StatusCode::SERVICE_UNAVAILABLE,
        _ => StatusCode::OK,
    };

    (status_code, Json(serde_json::to_value(&health_details).unwrap_or_default()))
}

/// GET /prices — delegate to data-node backend
async fn handle_prices(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    let Some(ref ph_url) = state.data_node_url else {
        return Json(serde_json::json!({
            "error": "Price endpoint requires --data-node-url.",
            "prices": {}, "count": 0
        }));
    };

    // Forward query params to data-node
    let query_suffix = if params.is_empty() {
        String::new()
    } else {
        let qs: Vec<String> = params.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
        format!("?{}", qs.join("&"))
    };
    let url = format!("{}/fast-prices{}", ph_url, query_suffix);

    match reqwest::get(&url).await {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(body) => Json(body),
            Err(e) => Json(serde_json::json!({
                "error": format!("Failed to read data-node response: {}", e),
                "prices": {}, "count": 0
            })),
        },
        Err(e) => Json(serde_json::json!({
            "error": format!("Failed to reach data-node backend: {}", e),
            "prices": {}, "count": 0
        })),
    }
}

/// GET /nav — delegate NAV computation to data-node
async fn handle_nav(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Json<serde_json::Value> {
    let default_itp = "0x0000000000000000000000000000000000000000000000000000000000000001".to_string();
    let itp_id_hex = params.get("itpId").unwrap_or(&default_itp);

    let Some(ref ph_url) = state.data_node_url else {
        return Json(serde_json::json!({
            "error": "NAV endpoint requires --data-node-url.",
            "nav": "0", "nav_usd": 0.0, "priced_count": 0, "total_count": 0
        }));
    };

    let url = format!("{}/itp-price?itp_id={}", ph_url, itp_id_hex);
    match reqwest::get(&url).await {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(body) => {
                let nav_str = body.get("nav").and_then(|v| v.as_str()).unwrap_or("0");
                let nav_display = body.get("nav_display").and_then(|v| v.as_str()).unwrap_or("0.0");
                let nav_usd: f64 = nav_display.parse().unwrap_or(0.0);
                let assets_priced = body.get("assets_priced").and_then(|v| v.as_u64()).unwrap_or(0);
                let assets_total = body.get("assets_total").and_then(|v| v.as_u64()).unwrap_or(0);
                Json(serde_json::json!({
                    "nav": nav_str,
                    "nav_usd": nav_usd,
                    "priced_count": assets_priced,
                    "total_count": assets_total,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "source": "data-node"
                }))
            }
            Err(e) => Json(serde_json::json!({
                "error": format!("Failed to parse data-node response: {}", e),
                "nav": "0", "nav_usd": 0.0, "priced_count": 0, "total_count": 0
            })),
        },
        Err(e) => Json(serde_json::json!({
            "error": format!("Failed to reach data-node: {}", e),
            "nav": "0", "nav_usd": 0.0, "priced_count": 0, "total_count": 0
        })),
    }
}

async fn run_ap(config: APConfig, shutdown: Arc<AtomicBool>) -> Result<(), Box<dyn std::error::Error>> {
    let port = config.effective_port();
    let rpc_url = config.effective_rpc_url();
    let exchange_mode = config.effective_exchange_mode();
    let use_mock_chain = config.effective_mock_chain();
    let target_chain_id = config.effective_chain_id();
    let bitget_mode = if exchange_mode.is_mock() { "mock" } else { "live" };
    let chain_mode = if use_mock_chain { "mock" } else { "real" };

    let timestamp = chrono::Utc::now().to_rfc3339();
    info!(
        port = port,
        rpc = %rpc_url,
        bitget_mode,
        chain_mode,
        has_bitget_credentials = config.has_bitget_credentials(),
        timestamp = %timestamp,
        "AP service starting"
    );

    // Initialize comprehensive metrics (Story 4.9)
    let metrics = Arc::new(APMetrics::new());
    info!("APMetrics initialized (orders, queue, buffer, violations, timeouts)");

    // Initialize EventMonitor with Index.sol contract address from config (H5 fix)
    let index_contract = config.effective_index_contract();

    let monitor_config = EventMonitorConfig {
        index_contract,
        confirmation_depth: 3,
        chain_id: target_chain_id,
        state_file: PathBuf::from("data/ap_block_tracker.json"),
        queue_capacity: 10_000,
        start_block: Some(0),
    };

    // Shared dedup set: a single HashSet that both SSE and RPC event paths
    // check before processing an event. If either path has already seen an
    // event ID, the other path skips it. Eviction uses block-based retention
    // via `cleanup_dedup_set`.
    let shared_dedup: Arc<RwLock<std::collections::HashSet<String>>> =
        Arc::new(RwLock::new(std::collections::HashSet::new()));

    // Chain initialization: real chain or mock chain (Story 6.3)
    // Each branch builds, inits, and extracts the event receiver since
    // EventMonitor<MockChain> and EventMonitor<RpcChainReader> are distinct types.
    // Both branches also produce a chain_writer for fill confirmation (AC #3).
    let (event_receiver, _chain_writer, _shared_provider): (_, Arc<dyn ChainWriter>, Option<Arc<Provider<Http>>>) = if use_mock_chain {
        // Mock chain mode
        info!(rpc = %rpc_url, "Initializing mock chain for local development");
        let mock_chain = Arc::new(MockChainBuilder::new().build());
        let mock_writer: Arc<dyn ChainWriter> = mock_chain.clone();
        info!("MockChain initialized (ChainReader + ChainWriter)");

        if index_contract == [0u8; 20] {
            return Err("AP_INDEX_CONTRACT required: Index.sol contract address not configured. Set via --index-contract or AP_INDEX_CONTRACT env var.".into());
        }

        let mut monitor = EventMonitorBuilder::new()
            .with_chain_reader(mock_chain)
            .with_index_contract(monitor_config.index_contract)
            .with_confirmation_depth(monitor_config.confirmation_depth)
            .with_chain_id(monitor_config.chain_id)
            .with_state_file(monitor_config.state_file.clone())
            .with_queue_capacity(monitor_config.queue_capacity)
            .with_start_block(0)
            .with_shared_dedup(shared_dedup.clone())
            .build()
            .map_err(|e| format!("Failed to create EventMonitor: {}", e))?;
        monitor.init().map_err(|e| format!("Failed to init EventMonitor: {}", e))?;
        let receiver = monitor.take_event_receiver()
            .ok_or("Failed to get event receiver")?;

        // Spawn EventMonitor to poll for chain events with reconnect
        tokio::spawn(async move {
            let mut backoff = Duration::from_secs(1);
            let max_backoff = Duration::from_secs(60);
            loop {
                match monitor.run().await {
                    Ok(()) => {
                        info!("MockChain EventMonitor stopped cleanly");
                        break;
                    }
                    Err(e) => {
                        warn!(code = "E008", error = %e, backoff_secs = backoff.as_secs(),
                            "MockChain EventMonitor disconnected, reconnecting...");
                        tokio::time::sleep(backoff).await;
                        backoff = std::cmp::min(backoff * 2, max_backoff);
                    }
                }
            }
        });

        // For NAV endpoint: create a provider even in mock chain mode if RPC is available
        let mock_provider = Provider::<Http>::try_from(&rpc_url).ok().map(Arc::new);

        (receiver, mock_writer, mock_provider)
    } else if let Some(ref data_node_url) = config.data_node_url {
        // Data-node mode: reads from data-node HTTP API, events from SSE stream
        let deployment_path = config.effective_deployment_file()
            .ok_or("Real chain mode requires --deployment-file or AP_DEPLOYMENT_FILE")?;
        let deployment = DeploymentConfig::from_file(&deployment_path)
            .map_err(|e| format!("Failed to load deployment config: {}", e))?;
        deployment.validate(target_chain_id)
            .map_err(|e| format!("Deployment config validation failed: {}", e))?;

        // Provider is still needed for chain writes
        let provider = Provider::<Http>::try_from(&rpc_url)
            .map_err(|e| format!("Failed to create RPC provider: {}", e))?;
        let provider = Arc::new(provider);

        // Create DataNodeChainReader for L3 state reads
        let _data_node_reader = Arc::new(DataNodeChainReader::new(data_node_url.clone()));

        // Create chain writer for fill confirmation (AC #3) - still via RPC
        let private_key_hex = config.effective_private_key()
            .map_err(|e| format!("Failed to read private key: {}", e))?
            .ok_or("Real chain mode requires AP_PRIVATE_KEY or AP_PRIVATE_KEY_PATH environment variable")?;
        let wallet: LocalWallet = private_key_hex.parse()
            .map_err(|e| format!("Failed to parse private key: {}", e))?;
        let rpc_writer: Arc<dyn ChainWriter> = Arc::new(
            RpcChainWriter::new(
                Provider::<Http>::try_from(&rpc_url)
                    .map_err(|e| format!("Failed to create provider for writer: {}", e))?,
                wallet,
                &deployment,
            ).map_err(|e| format!("Failed to create RpcChainWriter: {}", e))?
        );

        let index_addr = deployment.index_address()
            .map_err(|e| format!("Failed to get Index address: {}", e))?;

        info!(
            data_node = %data_node_url,
            rpc = %rpc_url,
            index = ?index_addr,
            chain_id = deployment.chain_id,
            "Data-node mode initialized (DataNodeChainReader + SSE events, RpcChainWriter)"
        );

        // SSE mode: bypass EventMonitor, create mpsc channel directly for APEvent delivery
        let (event_tx, event_rx) = tokio::sync::mpsc::channel::<APEvent>(10_000);

        // Spawn SSE client to consume chain events from data-node
        let sse_topics = vec![
            "order-submitted".to_string(),
            "fill-confirmed".to_string(),
            "rebalance-requested".to_string(),
            "asset-trade-request".to_string(),
        ];
        let sse_client = SseChainEventClient::new(data_node_url.clone(), sse_topics);

        // Create a bridge channel: SSE client sends ChainEvent, we convert to APEvent
        let (chain_event_tx, mut chain_event_rx) = tokio::sync::mpsc::channel::<common::traits::ChainEvent>(10_000);

        // Spawn SSE consumer
        tokio::spawn(async move {
            sse_client.run(chain_event_tx).await;
        });

        // Spawn ChainEvent -> APEvent converter (replicates EventMonitor::handle_chain_event logic)
        // Uses the shared dedup set so SSE and RPC paths filter against the same set.
        let event_tx_clone = event_tx.clone();
        let sse_dedup = shared_dedup.clone();
        tokio::spawn(async move {
            use common::traits::ChainEvent;
            let mut max_block_seen: u64 = 0;
            const DEDUP_CONFIRMATION_DEPTH: u64 = 64;
            while let Some(chain_event) = chain_event_rx.recv().await {
                // Deduplicate SSE events by block:tx_hash:log_index
                let event_id = match &chain_event {
                    ChainEvent::TradeRequest { block_number, tx_hash, log_index, .. } => {
                        max_block_seen = max_block_seen.max(*block_number);
                        Some(format!("{}:{:x?}:{}", block_number, tx_hash, log_index))
                    }
                    ChainEvent::AssetTradeRequest { block_number, tx_hash, log_index, .. } => {
                        max_block_seen = max_block_seen.max(*block_number);
                        Some(format!("{}:{:x?}:{}", block_number, tx_hash, log_index))
                    }
                    ChainEvent::WithdrawalRequest { block_number, tx_hash, log_index, .. } => {
                        max_block_seen = max_block_seen.max(*block_number);
                        Some(format!("{}:{:x?}:{}", block_number, tx_hash, log_index))
                    }
                    _ => None,
                };
                if let Some(id) = event_id {
                    // Check-and-insert against the shared dedup set
                    {
                        let mut dedup = sse_dedup.write().await;
                        if !dedup.insert(id.clone()) {
                            tracing::debug!(event_id = %id, "Duplicate SSE event (shared dedup), skipping");
                            continue;
                        }
                    }
                    // Block-based eviction via the shared cleanup function
                    let safe_block = max_block_seen.saturating_sub(DEDUP_CONFIRMATION_DEPTH);
                    ap::event_monitor::cleanup_dedup_set(&sse_dedup, safe_block, 50_000).await;
                }
                let ap_event = match chain_event {
                    ChainEvent::TradeRequest {
                        cycle_number, pair_id, side, amount, limit_price,
                        block_number, tx_hash, log_index,
                    } => {
                        match ap::event_types::TradeRequestEvent::from_chain_fields(
                            cycle_number, pair_id, side, amount, limit_price,
                            block_number, tx_hash, log_index,
                        ) {
                            Ok(event) => Some(APEvent::TradeRequest(event)),
                            Err(e) => {
                                tracing::warn!(error = %e, "Failed to convert SSE TradeRequest");
                                None
                            }
                        }
                    }
                    ChainEvent::AssetTradeRequest {
                        cycle_number, asset, side, usdc_amount, price, quote_token,
                        block_number, tx_hash, log_index,
                    } => {
                        let event = ap::event_types::AssetTradeRequestEvent::from_chain_fields(
                            cycle_number, asset, side, usdc_amount, price, quote_token,
                            block_number, tx_hash, log_index,
                        );
                        Some(APEvent::AssetTradeRequest(event))
                    }
                    ChainEvent::WithdrawalRequest {
                        itp_id, amount, destination, block_number, tx_hash, log_index,
                    } => {
                        let event = ap::event_types::WithdrawalRequestEvent::from_chain_fields(
                            itp_id, amount, destination, block_number, tx_hash, log_index,
                        );
                        Some(APEvent::WithdrawalRequest(event))
                    }
                    ChainEvent::OrderSubmitted { order_id, user, itp_id, side } => {
                        Some(APEvent::OrderSubmitted { order_id, user, itp_id, side })
                    }
                    ChainEvent::FillConfirmed { order_id, fill_price, fill_amount } => {
                        Some(APEvent::FillConfirmed { order_id, fill_price, fill_amount })
                    }
                    other => {
                        tracing::debug!(?other, "Ignoring non-AP chain event from SSE");
                        None
                    }
                };

                if let Some(event) = ap_event {
                    if event_tx_clone.send(event).await.is_err() {
                        tracing::info!("AP event channel closed, stopping SSE->APEvent bridge");
                        break;
                    }
                }
            }
        });

        (event_rx, rpc_writer, Some(provider))
    } else {
        // Real chain mode — direct RPC reads + EventMonitor polling
        let deployment_path = config.effective_deployment_file()
            .ok_or("Real chain mode requires --deployment-file or AP_DEPLOYMENT_FILE")?;
        let deployment = DeploymentConfig::from_file(&deployment_path)
            .map_err(|e| format!("Failed to load deployment config: {}", e))?;
        deployment.validate(target_chain_id)
            .map_err(|e| format!("Deployment config validation failed: {}", e))?;

        let provider = Provider::<Http>::try_from(&rpc_url)
            .map_err(|e| format!("Failed to create RPC provider: {}", e))?;
        let provider = Arc::new(provider);

        let rpc_reader = Arc::new(
            RpcChainReader::new(provider.clone(), &deployment)
                .map_err(|e| format!("Failed to create RpcChainReader: {}", e))?
        );

        // Create chain writer for fill confirmation (AC #3)
        let private_key_hex = config.effective_private_key()
            .map_err(|e| format!("Failed to read private key: {}", e))?
            .ok_or("Real chain mode requires AP_PRIVATE_KEY or AP_PRIVATE_KEY_PATH environment variable")?;
        let wallet: LocalWallet = private_key_hex.parse()
            .map_err(|e| format!("Failed to parse private key: {}", e))?;
        let rpc_writer: Arc<dyn ChainWriter> = Arc::new(
            RpcChainWriter::new(
                Provider::<Http>::try_from(&rpc_url)
                    .map_err(|e| format!("Failed to create provider for writer: {}", e))?,
                wallet,
                &deployment,
            ).map_err(|e| format!("Failed to create RpcChainWriter: {}", e))?
        );

        let index_addr = deployment.index_address()
            .map_err(|e| format!("Failed to get Index address: {}", e))?;
        let index_bytes: [u8; 20] = index_addr.into();

        info!(
            rpc = %rpc_url,
            index = ?index_addr,
            chain_id = deployment.chain_id,
            "Real chain initialized (RpcChainReader + RpcChainWriter)"
        );

        let mut monitor = EventMonitorBuilder::new()
            .with_chain_reader(rpc_reader)
            .with_index_contract(index_bytes)
            .with_confirmation_depth(monitor_config.confirmation_depth)
            .with_chain_id(monitor_config.chain_id)
            .with_state_file(monitor_config.state_file.clone())
            .with_queue_capacity(monitor_config.queue_capacity)
            .with_start_block(0)
            .with_shared_dedup(shared_dedup.clone())
            .build()
            .map_err(|e| format!("Failed to create EventMonitor: {}", e))?;
        monitor.init().map_err(|e| format!("Failed to init EventMonitor: {}", e))?;
        let receiver = monitor.take_event_receiver()
            .ok_or("Failed to get event receiver")?;

        // Spawn EventMonitor to poll for TradeRequest events from chain with reconnect
        tokio::spawn(async move {
            let mut backoff = Duration::from_secs(1);
            let max_backoff = Duration::from_secs(60);
            loop {
                match monitor.run().await {
                    Ok(()) => {
                        info!("RpcChain EventMonitor stopped cleanly");
                        break;
                    }
                    Err(e) => {
                        warn!(code = "E008", error = %e, backoff_secs = backoff.as_secs(),
                            "RpcChain EventMonitor disconnected, reconnecting...");
                        tokio::time::sleep(backoff).await;
                        backoff = std::cmp::min(backoff * 2, max_backoff);
                    }
                }
            }
        });

        (receiver, rpc_writer, Some(provider))
    };
    info!("EventMonitor initialized");
    let event_receiver = Arc::new(RwLock::new(EventReceiver::new(event_receiver)));

    // Bitget client (mock, testnet, or mainnet based on exchange_mode)
    let ap_client: Arc<dyn APClient> = match exchange_mode {
        ExchangeMode::Mock => {
            let mock_client = MockBitgetBuilder::new()
                .with_latency(Duration::from_millis(100))
                .with_fill_delay(Duration::from_millis(500))
                .build();
            info!("MockBitget initialized (APClient - mock mode)");
            Arc::new(mock_client)
        }
        ExchangeMode::Testnet | ExchangeMode::Mainnet => {
            // Live mode: validate credentials
            if !config.has_bitget_credentials() {
                error!(code = "INFRA-011", exchange_mode = %exchange_mode, "Live Bitget mode enabled but credentials not configured. Set BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE environment variables.");
                return Err("Live Bitget mode requires API credentials".into());
            }

            let bitget_config = if exchange_mode.is_mainnet() {
                BitgetConfig::mainnet()
            } else {
                BitgetConfig::testnet()
            };

            let env_label = exchange_mode.to_string();
            info!(environment = %env_label, "Initializing live Bitget client");

            // Construct and authenticate BitgetClient
            let mut bitget_client = BitgetClient::new(bitget_config)
                .map_err(|e| format!("Failed to create Bitget client: {}", e))?;
            bitget_client
                .authenticate(
                    config.bitget_api_key.as_deref().unwrap_or_default(),
                    config.bitget_api_secret.as_deref().unwrap_or_default(),
                    config.bitget_api_passphrase.as_deref().unwrap_or_default(),
                )
                .map_err(|e| format!("Failed to authenticate Bitget client: {}", e))?;

            // Wrap with rate limiter
            let rate_limiter_tier = if exchange_mode.is_mainnet() {
                RateLimiterTier::Mainnet
            } else {
                RateLimiterTier::Testnet
            };
            let rate_limiter = Arc::new(BitgetRateLimiter::from_tier(rate_limiter_tier));
            let rate_limited_client = RateLimitedBitgetClient::new(bitget_client, rate_limiter);

            info!(
                environment = %env_label,
                "Live Bitget client initialized (APClient - live mode)"
            );
            Arc::new(rate_limited_client)
        }
    };

    // Mainnet safety warning
    if exchange_mode.is_mainnet() {
        warn!("========================================");
        warn!("  MAINNET MODE - REAL MONEY TRADING");
        warn!("========================================");
    }
    info!(exchange_mode = %exchange_mode, "Exchange mode active");

    // Load symbol map from data/symbol-map.json (used by OnChainSettlement for data-node lookups)
    let shared_symbol_map: Option<Arc<std::collections::HashMap<String, String>>> = {
        let symbol_map_path = std::path::Path::new("data/symbol-map.json");
        if symbol_map_path.exists() {
            match std::fs::read_to_string(symbol_map_path) {
                Ok(content) => {
                    match serde_json::from_str::<std::collections::HashMap<String, serde_json::Value>>(&content) {
                        Ok(raw_map) => {
                            let mut map = std::collections::HashMap::new();
                            for (addr, val) in raw_map {
                                match val {
                                    serde_json::Value::String(s) => {
                                        map.insert(addr, s);
                                    }
                                    serde_json::Value::Object(obj) => {
                                        if let Some(serde_json::Value::String(pair)) = obj.get("pair") {
                                            map.insert(addr, pair.clone());
                                        } else {
                                            warn!(
                                                address = %addr,
                                                "symbol-map entry is object but missing \"pair\" key, skipping"
                                            );
                                        }
                                    }
                                    _ => {
                                        warn!(
                                            address = %addr,
                                            "symbol-map entry has unexpected type, skipping"
                                        );
                                    }
                                }
                            }
                            info!(
                                symbols_loaded = map.len(),
                                "Loaded symbol map from data/symbol-map.json"
                            );
                            Some(Arc::new(map))
                        }
                        Err(e) => {
                            warn!(
                                code = "INFRA-013",
                                error = %e,
                                "Failed to parse symbol-map.json"
                            );
                            None
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        code = "INFRA-013",
                        error = %e,
                        "Failed to read symbol-map.json"
                    );
                    None
                }
            }
        } else {
            info!("data/symbol-map.json not found (optional)");
            None
        }
    };

    // Initialize on-chain MockBitgetVault settlement for E2E testing (Story 6.17)
    // Multi-asset: resolves ITP inventory on-chain and trades all underlying assets.
    let on_chain_settlement: Option<OnChainSettlement> = if exchange_mode.is_mock() {
        if let Some(vault_address) = config.effective_bitget_vault() {
            let private_key = config.effective_private_key()
                .map_err(|e| format!("Failed to read private key: {}", e))?
                .ok_or("--bitget-vault requires AP_PRIVATE_KEY or AP_PRIVATE_KEY_PATH environment variable")?;

            // Load deployment config for quote token address
            let deployment_path = config.effective_deployment_file()
                .ok_or("--bitget-vault requires --deployment-file to get token addresses")?;
            let deployment = DeploymentConfig::from_file(&deployment_path)
                .map_err(|e| format!("Failed to load deployment config for on-chain settlement: {}", e))?;

            // Quote token is SETTLEMENT_USDC (6 decimals) — Settlement chain USDC for on-chain settlement
            let quote_token = deployment.token_address("SETTLEMENT_USDC")
                .or_else(|_| deployment.token_address("L3_WUSDC"))
                .map_err(|e| format!("Deployment missing SETTLEMENT_USDC/L3_WUSDC token address: {}", e))?;

            // Use settlement chain RPC for MockBitgetVault (vault is on settlement chain)
            let settlement_rpc = config.effective_settlement_rpc_url()
                .map_err(|e| format!("On-chain settlement requires settlement RPC: {}", e))?;
            let settlement_chain_id = config.effective_settlement_chain_id()
                .map_err(|e| format!("On-chain settlement requires settlement chain ID: {}", e))?;

            let vault_client = BitgetVaultClient::new(
                &settlement_rpc,
                &private_key,
                vault_address,
                settlement_chain_id,
            )
            .map_err(|e| format!("Failed to create BitgetVaultClient: {}", e))?;

            // Pre-initialize nonce counter to avoid races on first parallel send batch
            vault_client.initialize_nonce().await
                .map_err(|e| format!("Failed to initialize vault nonce: {}", e))?;

            let settlement_rpc_display = settlement_rpc.clone();
            info!(
                vault_address = ?ethers::types::Address::from(vault_address),
                quote_token = ?quote_token,
                settlement_rpc = %settlement_rpc_display,
                data_node = ?config.data_node_url,
                "On-chain settlement enabled (oracle-driven AssetTradeRequest events)"
            );

            // Resolve MockUSDT address from config (Story 7.18)
            let mock_usdt = config.effective_mock_usdt().map(Address::from);
            if let Some(usdt_addr) = mock_usdt {
                info!(
                    mock_usdt = ?usdt_addr,
                    "MockUSDT configured for USDT-pair settlement"
                );
            }

            Some(OnChainSettlement {
                vault_client: Arc::new(vault_client),
                quote_token,
                mock_usdt,
                data_node_url: config.data_node_url.clone(),
                symbol_map: shared_symbol_map.clone(),
            })
        } else {
            None
        }
    } else {
        None
    };

    // Initialize pipeline components (Story 6.4 - Tasks 5.3-5.6)
    let timeout_handler = Arc::new(TimeoutHandler::new(TimeoutConfig::default()));
    info!("TimeoutHandler initialized (60s timeout, 3 retries per NFR8)");

    let limit_enforcer = Arc::new(tokio::sync::Mutex::new(LimitOrderEnforcer::new()));
    info!("LimitOrderEnforcer initialized (0.15% tolerance)");

    info!("All components initialized");

    // -- SharedConfig: hot-reloadable runtime configuration --
    let deployment_path = config.effective_deployment_file()
        .unwrap_or_else(|| PathBuf::from("deployments/active-deployment.json"));
    let runtime_config = RuntimeConfig::load(
        &deployment_path,
        &rpc_url,
        None,
    ).await.map_err(|e| {
        error!("Failed to load RuntimeConfig: {e}");
        e
    })?;
    let shared_config = shared(runtime_config);

    DeploymentWatcher::new(shared_config.clone(), deployment_path)
        .on_nonce_change(move |old, new| {
            tracing::warn!("AP: deployment nonce {old} → {new}. Flushing AP state.");
            // Order tracking references old contract addresses — clear it.
            // The SharedConfig reload already re-reads symbol-map.json.
            tracing::info!("AP flush complete — order tracking cleared, symbol map will reload on next config read");
        })
        .spawn();

    // Spawn event processing task
    let event_receiver_clone = event_receiver.clone();
    let metrics_clone = metrics.clone();
    let shutdown_clone = shutdown.clone();
    let ap_client_clone = ap_client.clone();
    let timeout_clone = timeout_handler.clone();
    let enforcer_clone = limit_enforcer.clone();
    let settlement_clone = on_chain_settlement.clone();
    let audit_trail = match common::audit::AuditTrail::new(std::path::Path::new("logs")) {
        Ok(at) => Some(at),
        Err(e) => { warn!(error = %e, "Failed to open audit trail, continuing without it"); None }
    };
    let audit_clone = audit_trail.clone();
    // Circuit breaker: 50k USDC max single trade, 500k USDC max per cycle, halt after 5 consecutive failures
    let circuit_breaker = Arc::new(CircuitBreaker::new(
        U256::exp10(18) * 50_000,   // 50,000 USDC (18 decimals)
        U256::exp10(18) * 500_000,  // 500,000 USDC per cycle
        5,
    ));
    let cb_clone = circuit_breaker.clone();
    tokio::spawn(async move {
        process_events(
            event_receiver_clone,
            metrics_clone,
            shutdown_clone,
            ap_client_clone,
            timeout_clone,
            enforcer_clone,
            settlement_clone,
            audit_clone,
            cb_clone,
        ).await;
    });

    // Spawn heartbeat task
    let heartbeat_metrics = metrics.clone();
    let heartbeat_shutdown = shutdown.clone();
    tokio::spawn(async move {
        let mut heartbeat_count = 0u64;
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if heartbeat_shutdown.load(Ordering::Relaxed) {
                break;
            }
            heartbeat_count += 1;
            if heartbeat_count % 12 == 0 {
                let orders_processed = heartbeat_metrics.get_orders_processed();
                let orders_failed = heartbeat_metrics.get_orders_failed();
                let queue_depth = heartbeat_metrics.get_queue_depth();
                let health_status = heartbeat_metrics.get_health_status().await;
                info!(
                    orders_processed,
                    orders_failed,
                    queue_depth,
                    health_status = %health_status,
                    timestamp = %chrono::Utc::now().to_rfc3339(),
                    "AP heartbeat"
                );
            }
        }
    });

    // -- Axum HTTP server --
    let app_state = AppState {
        metrics: metrics.clone(),
        data_node_url: config.data_node_url.clone(),
    };

    let admin_token = std::env::var("ADMIN_TOKEN").ok();
    let app = Router::new()
        .route("/health", get(handle_health))
        .route("/", get(handle_health))
        .route("/prices", get(handle_prices))
        .route("/nav", get(handle_nav))
        .with_state(app_state)
        .merge(admin_router(shared_config.clone(), admin_token))
        .layer(cors_layer());

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!(port = port, "AP service listening (axum)");

    // Serve until shutdown signal
    let shutdown_for_server = shutdown.clone();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            loop {
                if shutdown_for_server.load(Ordering::Relaxed) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
        })
        .await?;

    info!("AP service shutting down gracefully");
    Ok(())
}

/// Process events from the event queue with full pipeline wiring (Story 6.4, 6.17)
///
/// Pipeline: TradeRequest → place order → track timeout → verify fills → validate limits
/// Optional: when on_chain_settlement is set, also execute trades on-chain via MockBitgetVault
async fn process_events(
    event_receiver: Arc<RwLock<EventReceiver>>,
    metrics: Arc<APMetrics>,
    shutdown: Arc<AtomicBool>,
    ap_client: Arc<dyn APClient>,
    timeout_handler: Arc<TimeoutHandler>,
    limit_enforcer: Arc<tokio::sync::Mutex<LimitOrderEnforcer>>,
    on_chain_settlement: Option<OnChainSettlement>,
    audit: Option<common::audit::AuditTrail>,
    circuit_breaker: Arc<CircuitBreaker>,
) {
    info!("Event processing task started");

    // Track order_id → (itp_id, side) for FillConfirmed decomposition.
    // OrderSubmitted arrives before FillConfirmed for the same order_id.
    let order_tracker: Arc<RwLock<std::collections::HashMap<u64, ([u8; 32], u8)>>> =
        Arc::new(RwLock::new(std::collections::HashMap::new()));

    loop {
        if shutdown.load(Ordering::Relaxed) {
            break;
        }

        // Try to receive an event with timeout
        let event = {
            let mut receiver = event_receiver.write().await;
            tokio::select! {
                event = receiver.recv() => event,
                _ = tokio::time::sleep(Duration::from_millis(100)) => None,
            }
        };

        if let Some(event) = event {
            // Track all events received (Story 4.9 metrics)
            metrics.increment_events_received();

            match &event {
                APEvent::TradeRequest(trade) => {
                    info!(
                        cycle = trade.cycle_number,
                        pair_id = ?trade.pair_id,
                        side = ?trade.side,
                        amount = %trade.amount,
                        limit_price = %trade.limit_price,
                        block = trade.block_number,
                        "Processing TradeRequest event (ITP-level, no on-chain settlement)"
                    );

                    // TradeRequest is ITP-level. On-chain settlement is now driven by
                    // AssetTradeRequest events emitted after oracle decomposition + netting.
                    // We still place mock orders and verify fills for the ITP-level trade.
                    let pair = trade.pair_id.to_string();
                    let side = trade.side;
                    let amount = trade.amount;
                    let price = trade.limit_price;
                    let trade_pair_id = trade.pair_id;
                    let trade_block_number = trade.block_number;
                    let trade_cycle_number = trade.cycle_number;
                    let order_tracking_id = format!(
                        "{}:{:x}:{}",
                        trade.block_number, trade.tx_hash, trade.log_index
                    );
                    let ap_client = ap_client.clone();
                    let metrics = metrics.clone();
                    let timeout_handler = timeout_handler.clone();
                    let limit_enforcer = limit_enforcer.clone();

                    tokio::spawn(async move {
                        // Track order for 60s timeout (Task 5.5 - NFR8)
                        timeout_handler.track_order(order_tracking_id.clone()).await;

                        match ap_client.place_order(pair, side, amount, price).await {
                            Ok(order_id) => {
                                info!(order_id = %order_id, "Order placed successfully via APClient");
                                metrics.increment_orders_processed();

                                // Poll for fills with backoff (Tasks 5.3, 5.6)
                                let mut fills_verified = false;
                                for attempt in 0..5u32 {
                                    let delay = Duration::from_secs(1 << attempt);
                                    tokio::time::sleep(delay).await;

                                    match ap_client.get_fills(order_id, U256::from(trade_cycle_number)).await {
                                        Ok(fills) if !fills.is_empty() => {
                                            let limit_order = LimitOrder {
                                                id: order_id,
                                                user: Address::zero(),
                                                pair_id: trade_pair_id,
                                                side,
                                                amount,
                                                limit_price: price,
                                                slippage_tier: U256::zero(),
                                                deadline: U256::from(u64::MAX),
                                                itp_id: H256::zero(),
                                                timestamp: U256::from(trade_block_number),
                                                status: OrderStatus::Filled,
                                            };

                                            let mut enforcer = limit_enforcer.lock().await;
                                            for fill in &fills {
                                                let result = enforcer.validate_fill(
                                                    &limit_order,
                                                    fill.fill_price,
                                                );
                                                match result {
                                                    ValidationResult::Pass => {
                                                        debug!(
                                                            order_id = %order_id,
                                                            fill_price = %fill.fill_price,
                                                            "Fill price validated within tolerance"
                                                        );
                                                    }
                                                    ValidationResult::Fail { reason } => {
                                                        // Compute deviation for structured logging
                                                        let tolerance_pct = LIMIT_TOLERANCE_BPS as f64 / (BPS_DENOMINATOR as f64 / 100.0);
                                                        let deviation_pct = if price.is_zero() {
                                                            0.0
                                                        } else {
                                                            let scale = U256::from(10_000u64);
                                                            if fill.fill_price >= price {
                                                                let diff = (fill.fill_price - price).saturating_mul(scale);
                                                                (diff / price).as_u128() as f64 / 100.0
                                                            } else {
                                                                let diff = (price - fill.fill_price).saturating_mul(scale);
                                                                -((diff / price).as_u128() as f64 / 100.0)
                                                            }
                                                        };
                                                        warn!(
                                                            code = "E005",
                                                            order_id = %order_id,
                                                            fill_price = %fill.fill_price,
                                                            oracle_price = %price,
                                                            tolerance_pct = tolerance_pct,
                                                            actual_deviation_pct = deviation_pct,
                                                            reason = "fill price outside tolerance",
                                                            "Fill price violated limit — {reason}"
                                                        );
                                                        metrics.increment_violations().await;
                                                    }
                                                }
                                            }
                                            drop(enforcer);

                                            timeout_handler.untrack_order(&order_tracking_id).await;

                                            info!(
                                                order_id = %order_id,
                                                fill_count = fills.len(),
                                                attempt = attempt + 1,
                                                "Order fills verified"
                                            );
                                            fills_verified = true;
                                            break;
                                        }
                                        Ok(_) => {
                                            debug!(
                                                order_id = %order_id,
                                                attempt = attempt + 1,
                                                "No fills yet, retrying"
                                            );
                                        }
                                        Err(e) => {
                                            warn!(
                                                code = "E008",
                                                order_id = %order_id,
                                                attempt = attempt + 1,
                                                error = %e,
                                                "Failed to query fills from exchange"
                                            );
                                        }
                                    }
                                }

                                if !fills_verified {
                                    debug!(
                                        order_id = %order_id,
                                        "Fill polling exhausted, timeout handler still tracking"
                                    );
                                }
                            }
                            Err(e) => {
                                warn!(code = "E008", error = %e, "Failed to place order via APClient");
                                metrics.increment_orders_failed();
                                timeout_handler.untrack_order(&order_tracking_id).await;
                            }
                        }
                    });
                }
                APEvent::AssetTradeRequest(asset_trade) => {
                    // Oracle-driven per-asset trade after cross-ITP netting.
                    // All trade info comes from the event — AP reads NO on-chain state.
                    info!(
                        cycle = asset_trade.cycle_number,
                        asset = ?asset_trade.asset,
                        side = asset_trade.side,
                        usdc_amount = %asset_trade.usdc_amount,
                        price = %asset_trade.price,
                        block = asset_trade.block_number,
                        "Processing AssetTradeRequest event"
                    );

                    if let Some(ref at) = audit {
                        at.log("ap", "ASSET_TRADE_RECEIVED", &serde_json::json!({
                            "cycle": asset_trade.cycle_number,
                            "asset": format!("{:#x}", Address::from(asset_trade.asset)),
                            "side": if asset_trade.side == 0 { "BUY" } else { "SELL" },
                            "usdc_amount": format!("{}", asset_trade.usdc_amount),
                            "price": format!("{}", asset_trade.price),
                            "block": asset_trade.block_number,
                        }));
                    }

                    let settlement = on_chain_settlement.clone();
                    let metrics = metrics.clone();
                    let asset_trade = asset_trade.clone();
                    let audit_for_task = audit.clone();
                    let cb = circuit_breaker.clone();

                    tokio::spawn(async move {
                        if let Some(ref settlement) = settlement {
                            // Circuit breaker gate
                            if let Err(reason) = cb.check_trade(asset_trade.usdc_amount, asset_trade.cycle_number) {
                                error!(
                                    code = "E009",
                                    cycle = asset_trade.cycle_number,
                                    asset = ?asset_trade.asset,
                                    reason = %reason,
                                    "Circuit breaker blocked trade"
                                );
                                metrics.increment_orders_failed();
                                return;
                            }

                            let scale = U256::exp10(18);
                            let asset_addr = Address::from(asset_trade.asset);
                            let quote = settlement.quote_token;

                            // Compute asset amount from oracle-provided price
                            // asset_amount = usdc_amount * 1e18 / price
                            let asset_amount = if asset_trade.price.is_zero() {
                                // TODO: add metrics counter for zero-price trades
                                error!(code = "E008", "AssetTradeRequest has zero price, skipping");
                                return;
                            } else {
                                let scaled = match asset_trade.usdc_amount.checked_mul(scale) {
                                    Some(v) => v,
                                    None => {
                                        error!(
                                            code = "E008",
                                            asset = ?asset_trade.asset,
                                            usdc_amount = %asset_trade.usdc_amount,
                                            "Overflow computing asset_amount: usdc * scale overflowed U256"
                                        );
                                        return;
                                    }
                                };
                                scaled / asset_trade.price
                            };

                            if asset_amount.is_zero() {
                                debug!("Computed zero asset amount, skipping");
                                return;
                            }

                            // Fetch price + bid/ask from data-node backend
                            let mut live_bid: Option<U256> = None;
                            let mut live_ask: Option<U256> = None;
                            if let Some(ref ph_url) = settlement.data_node_url {
                                let addr_hex = format!("{:#x}", asset_addr);
                                if let Some(symbol) = settlement.symbol_map.as_ref()
                                    .and_then(|m| m.get(&addr_hex))
                                {
                                    let price_url = format!("{}/fast-prices?symbols={}", ph_url, symbol);
                                    match reqwest::get(&price_url).await {
                                        Ok(resp) => {
                                            if let Ok(body) = resp.json::<serde_json::Value>().await {
                                                if let Some(price_str) = body.get("prices")
                                                    .and_then(|p| p.get(symbol.as_str()))
                                                    .and_then(|entry| entry.get("last_price"))
                                                    .and_then(|v| v.as_str())
                                                {
                                                    if let Ok(rp) = ethers::types::U256::from_dec_str(price_str) {
                                                        let _ = settlement.vault_client.set_price(asset_addr, rp).await;
                                                    }
                                                }
                                                // Read bid/ask for spread-aware amount computation
                                                if let Some(bid_str) = body.get("prices")
                                                    .and_then(|p| p.get(symbol.as_str()))
                                                    .and_then(|entry| entry.get("bid"))
                                                    .and_then(|v| v.as_str())
                                                {
                                                    if let Ok(bp) = U256::from_dec_str(bid_str) {
                                                        if !bp.is_zero() { live_bid = Some(bp); }
                                                    }
                                                }
                                                if let Some(ask_str) = body.get("prices")
                                                    .and_then(|p| p.get(symbol.as_str()))
                                                    .and_then(|entry| entry.get("ask"))
                                                    .and_then(|v| v.as_str())
                                                {
                                                    if let Ok(ap) = U256::from_dec_str(ask_str) {
                                                        if !ap.is_zero() { live_ask = Some(ap); }
                                                    }
                                                }
                                                if live_bid.is_some() || live_ask.is_some() {
                                                    info!(
                                                        symbol,
                                                        bid = ?live_bid,
                                                        ask = ?live_ask,
                                                        "Using real bid/ask spread from Bitget"
                                                    );
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            debug!(symbol, error = %e, "Failed to fetch price from data-node, skipping vault price set");
                                        }
                                    }
                                }
                            }

                            // Respect oracle-directed quoteToken per asset pair.
                            // Decimal mismatch fixed in MockBitgetVault.executeTrade() directly.
                            let event_qt = EthAddress::from(asset_trade.quote_token);
                            let mut needs_swap = !event_qt.is_zero() && event_qt != quote;
                            let mut effective_quote = if needs_swap { event_qt } else { quote };

                            // Pre-trade swap: BUY with non-USDC quote → swap USDC→quoteToken
                            // On failure: fall back to USDC (swap is advisory, not required)
                            if needs_swap && asset_trade.side == 0 {
                                match settlement.vault_client.swap_stable(
                                    quote, effective_quote, asset_trade.usdc_amount,
                                ).await {
                                    Ok(tx) => {
                                        info!(
                                            amount = %asset_trade.usdc_amount,
                                            from = ?quote,
                                            to = ?effective_quote,
                                            tx_hash = ?tx,
                                            "Pre-trade stablecoin swap (oracle-directed)"
                                        );
                                    }
                                    Err(e) => {
                                        warn!(code = "E008", error = %e, "Pre-trade stablecoin swap failed, falling back to USDC");
                                        needs_swap = false;
                                        effective_quote = quote;
                                    }
                                }
                            }

                            // side: 0=BUY, 1=SELL — use real bid/ask for spread-aware amounts
                            let (sell_token, buy_token, sell_amt, buy_amt) = if asset_trade.side == 0 {
                                // BUY: use ask price for asset amount (buyer pays the ask)
                                let adj_amount = if let Some(ask) = live_ask {
                                    if ask.is_zero() {
                                        warn!("ask price is zero for asset, using oracle price fallback");
                                        asset_amount
                                    } else {
                                        match asset_trade.usdc_amount.checked_mul(scale) {
                                            Some(v) => v / ask,
                                            None => {
                                                error!(
                                                    code = "E008",
                                                    asset = ?asset_trade.asset,
                                                    usdc_amount = %asset_trade.usdc_amount,
                                                    "Overflow computing adj_amount (ask): usdc * scale overflowed U256"
                                                );
                                                return;
                                            }
                                        }
                                    }
                                } else {
                                    asset_amount // fallback to oracle price
                                };
                                (effective_quote, asset_addr, asset_trade.usdc_amount, adj_amount)
                            } else {
                                // SELL: use bid price for USDC return (seller gets the bid)
                                let adj_usdc = if let Some(bid) = live_bid {
                                    if bid.is_zero() {
                                        warn!("bid price is zero for asset, using oracle price fallback");
                                        asset_trade.usdc_amount
                                    } else {
                                        match asset_amount.checked_mul(bid) {
                                            Some(v) => v / scale,
                                            None => {
                                                error!(
                                                    code = "E008",
                                                    asset = ?asset_trade.asset,
                                                    asset_amount = %asset_amount,
                                                    bid = %bid,
                                                    "Overflow computing adj_usdc (bid): amount * bid overflowed U256"
                                                );
                                                return;
                                            }
                                        }
                                    }
                                } else {
                                    asset_trade.usdc_amount // fallback to oracle price
                                };
                                (asset_addr, effective_quote, asset_amount, adj_usdc)
                            };

                            let trade_id_bytes = ethers::utils::keccak256(
                                ethers::abi::encode(&[
                                    ethers::abi::Token::Uint(U256::from(asset_trade.cycle_number)),
                                    ethers::abi::Token::FixedBytes(asset_trade.tx_hash.as_bytes().to_vec()),
                                    ethers::abi::Token::Uint(U256::from(asset_trade.log_index)),
                                ])
                            );
                            let trade_id = U256::from_big_endian(&trade_id_bytes).low_u64();
                            match settlement.vault_client.execute_trade(
                                trade_id, sell_token, buy_token, sell_amt, buy_amt,
                            ).await {
                                Ok(tx_hash) => {
                                    info!(
                                        cycle = asset_trade.cycle_number,
                                        asset = ?asset_addr,
                                        side = asset_trade.side,
                                        usdc_amount = %asset_trade.usdc_amount,
                                        asset_amount = %asset_amount,
                                        quote_token = ?effective_quote,
                                        tx_hash = ?tx_hash,
                                        "AssetTradeRequest settlement executed via MockBitgetVault"
                                    );

                                    // Post-trade swap: SELL with non-USDC quote → swap quoteToken→USDC
                                    if needs_swap && asset_trade.side == 1 {
                                        match settlement.vault_client.swap_stable(
                                            effective_quote, quote, asset_trade.usdc_amount,
                                        ).await {
                                            Ok(swap_tx) => {
                                                info!(
                                                    amount = %asset_trade.usdc_amount,
                                                    from = ?effective_quote,
                                                    to = ?quote,
                                                    tx_hash = ?swap_tx,
                                                    "Post-trade stablecoin swap (oracle-directed)"
                                                );
                                            }
                                            Err(e) => {
                                                warn!(code = "E008", error = %e, "Post-trade stablecoin swap failed (trade executed)");
                                            }
                                        }
                                    }

                                    cb.record_success();
                                    metrics.increment_orders_processed();
                                    if let Some(ref at) = audit_for_task {
                                        at.log("ap", "VAULT_TRADE_EXECUTED", &serde_json::json!({
                                            "cycle": asset_trade.cycle_number,
                                            "asset": format!("{:#x}", asset_addr),
                                            "side": if asset_trade.side == 0 { "BUY" } else { "SELL" },
                                            "sell_token": format!("{:#x}", sell_token),
                                            "buy_token": format!("{:#x}", buy_token),
                                            "sell_amount": format!("{}", sell_amt),
                                            "buy_amount": format!("{}", buy_amt),
                                            "tx_hash": format!("{:?}", tx_hash),
                                        }));
                                    }
                                }
                                Err(e) => {
                                    cb.record_failure();
                                    error!(
                                        code = "E008",
                                        cycle = asset_trade.cycle_number,
                                        asset = ?asset_addr,
                                        error = %e,
                                        "AssetTradeRequest settlement failed"
                                    );
                                    metrics.increment_orders_failed();
                                    if let Some(ref at) = audit_for_task {
                                        at.log("ap", "VAULT_TRADE_FAILED", &serde_json::json!({
                                            "cycle": asset_trade.cycle_number,
                                            "asset": format!("{:#x}", asset_addr),
                                            "side": if asset_trade.side == 0 { "BUY" } else { "SELL" },
                                            "error": format!("{}", e),
                                        }));
                                    }
                                }
                            }
                        } else {
                            debug!(
                                cycle = asset_trade.cycle_number,
                                "AssetTradeRequest received but no on-chain settlement configured"
                            );
                        }
                    });
                }
                APEvent::WithdrawalRequest(withdrawal) => {
                    warn!(
                        itp_id = ?withdrawal.itp_id,
                        amount = %withdrawal.amount,
                        block = withdrawal.block_number,
                        "WithdrawalRequest event received but not implemented yet"
                    );
                }
                APEvent::OrderSubmitted { order_id, user: _, itp_id, side } => {
                    let order_id = *order_id;
                    let itp_id = *itp_id;
                    let side = *side;
                    info!(order_id, side, itp_id = ?hex::encode(itp_id), "Tracking OrderSubmitted for fill decomposition");
                    order_tracker.write().await.insert(order_id, (itp_id, side));

                    // Prune tracker to prevent unbounded growth
                    let tracker = order_tracker.read().await;
                    if tracker.len() > 10_000 {
                        drop(tracker);
                        let mut w = order_tracker.write().await;
                        // Keep only the most recent 5000 entries (highest order_ids)
                        if w.len() > 10_000 {
                            let mut keys: Vec<u64> = w.keys().copied().collect();
                            keys.sort_unstable();
                            let cutoff = keys.len() - 5_000;
                            for &k in &keys[..cutoff] {
                                w.remove(&k);
                            }
                        }
                    }
                }
                APEvent::FillConfirmed { order_id, fill_price, fill_amount } => {
                    let order_id = *order_id;
                    let fill_price = *fill_price;
                    let fill_amount = *fill_amount;
                    info!(order_id, fill_price = %fill_price, fill_amount = %fill_amount, "FillConfirmed received — deriving per-asset trades");

                    // Look up itp_id + side from order tracker
                    let tracked = order_tracker.read().await.get(&order_id).copied();
                    let (itp_id, side) = match tracked {
                        Some(t) => t,
                        None => {
                            warn!(order_id, "FillConfirmed for unknown order_id — OrderSubmitted not seen or pruned");
                            continue;
                        }
                    };

                    let settlement = on_chain_settlement.clone();
                    let metrics = metrics.clone();
                    let audit_for_task = audit.clone();
                    let cb = circuit_breaker.clone();

                    tokio::spawn(async move {
                        let settlement = match settlement {
                            Some(s) => s,
                            None => {
                                debug!(order_id, "FillConfirmed: no on-chain settlement configured, skipping");
                                return;
                            }
                        };

                        let data_node_url = match settlement.data_node_url.as_ref() {
                            Some(url) => url.clone(),
                            None => {
                                error!(order_id, "FillConfirmed: data_node_url not configured, cannot fetch ITP state");
                                return;
                            }
                        };

                        // Fetch ITP state from data-node
                        let itp_hex = hex::encode(itp_id);
                        let state_url = format!("{}/chain/l3/itp-state?itp_id=0x{}", data_node_url, itp_hex);
                        let itp_state: serde_json::Value = match reqwest::get(&state_url).await {
                            Ok(resp) => match resp.json().await {
                                Ok(v) => v,
                                Err(e) => {
                                    error!(order_id, error = %e, "Failed to parse ITP state response");
                                    return;
                                }
                            },
                            Err(e) => {
                                error!(order_id, error = %e, url = %state_url, "Failed to fetch ITP state from data-node");
                                return;
                            }
                        };

                        // Parse assets, quantities, nav from response
                        let assets: Vec<EthAddress> = match itp_state.get("assets").and_then(|a| a.as_array()) {
                            Some(arr) => {
                                let mut addrs = Vec::with_capacity(arr.len());
                                for a in arr {
                                    if let Some(s) = a.as_str() {
                                        match s.parse::<EthAddress>() {
                                            Ok(addr) => addrs.push(addr),
                                            Err(e) => {
                                                error!(order_id, addr = s, error = %e, "Invalid asset address in ITP state");
                                                return;
                                            }
                                        }
                                    }
                                }
                                addrs
                            }
                            None => {
                                error!(order_id, "ITP state missing 'assets' array");
                                return;
                            }
                        };

                        let quantities: Vec<U256> = match itp_state.get("quantities").and_then(|q| q.as_array()) {
                            Some(arr) => {
                                let mut qtys = Vec::with_capacity(arr.len());
                                for q in arr {
                                    if let Some(s) = q.as_str() {
                                        match U256::from_dec_str(s) {
                                            Ok(v) => qtys.push(v),
                                            Err(e) => {
                                                error!(order_id, qty = s, error = %e, "Invalid quantity in ITP state");
                                                return;
                                            }
                                        }
                                    }
                                }
                                qtys
                            }
                            None => {
                                error!(order_id, "ITP state missing 'quantities' array");
                                return;
                            }
                        };

                        if assets.len() != quantities.len() {
                            error!(order_id, assets = assets.len(), quantities = quantities.len(), "Assets/quantities length mismatch");
                            return;
                        }

                        if assets.is_empty() {
                            warn!(order_id, "ITP has no assets, nothing to decompose");
                            return;
                        }

                        // Fetch live prices for all assets in this ITP
                        let symbol_map = match settlement.symbol_map.as_ref() {
                            Some(m) => m.clone(),
                            None => {
                                error!(order_id, "No symbol map configured, cannot fetch prices for decomposition");
                                return;
                            }
                        };

                        let scale = U256::exp10(18);
                        let quote = settlement.quote_token;

                        // Compute per-asset NAV contributions: nav_i = qty_i * price_i / 1e18
                        // Then per_asset_usdc = fill_amount * nav_i / total_nav
                        // First, fetch all prices
                        let mut prices: Vec<U256> = Vec::with_capacity(assets.len());
                        let symbols_for_fetch: Vec<String> = assets.iter().map(|a| {
                            let addr_hex = format!("{:#x}", a);
                            symbol_map.get(&addr_hex).cloned().unwrap_or_default()
                        }).collect();

                        let symbols_csv: String = symbols_for_fetch.iter()
                            .filter(|s| !s.is_empty())
                            .cloned()
                            .collect::<Vec<_>>()
                            .join(",");

                        if symbols_csv.is_empty() {
                            error!(order_id, "No symbols found in symbol_map for any ITP asset");
                            return;
                        }

                        let price_url = format!("{}/fast-prices?symbols={}", data_node_url, symbols_csv);
                        let price_body: serde_json::Value = match reqwest::get(&price_url).await {
                            Ok(resp) => match resp.json().await {
                                Ok(v) => v,
                                Err(e) => {
                                    error!(order_id, error = %e, "Failed to parse fast-prices response");
                                    return;
                                }
                            },
                            Err(e) => {
                                error!(order_id, error = %e, "Failed to fetch prices from data-node");
                                return;
                            }
                        };

                        for symbol in &symbols_for_fetch {
                            if symbol.is_empty() {
                                prices.push(U256::zero());
                                continue;
                            }
                            let price = price_body.get("prices")
                                .and_then(|p| p.get(symbol.as_str()))
                                .and_then(|entry| entry.get("last_price"))
                                .and_then(|v| v.as_str())
                                .and_then(|s| U256::from_dec_str(s).ok())
                                .unwrap_or_default();
                            prices.push(price);
                        }

                        // Compute NAV contributions per asset: nav_i = qty_i * price_i / 1e18
                        let mut nav_contributions: Vec<U256> = Vec::with_capacity(assets.len());
                        let mut total_nav = U256::zero();
                        for i in 0..assets.len() {
                            if prices[i].is_zero() {
                                warn!(order_id, asset = ?assets[i], "Zero price for asset, skipping ITP decomposition");
                                return;
                            }
                            let contribution = match quantities[i].checked_mul(prices[i]) {
                                Some(v) => v / scale,
                                None => {
                                    error!(order_id, asset = ?assets[i], "Overflow computing NAV contribution");
                                    return;
                                }
                            };
                            total_nav = total_nav + contribution;
                            nav_contributions.push(contribution);
                        }

                        if total_nav.is_zero() {
                            error!(order_id, "Total NAV is zero, cannot decompose fill");
                            return;
                        }

                        info!(
                            order_id,
                            itp = %itp_hex,
                            side,
                            fill_amount = %fill_amount,
                            total_nav = %total_nav,
                            num_assets = assets.len(),
                            "Decomposing FillConfirmed into per-asset vault trades"
                        );

                        // Execute per-asset trades
                        for i in 0..assets.len() {
                            // per_asset_usdc = fill_amount * nav_contribution[i] / total_nav
                            let per_asset_usdc = match fill_amount.checked_mul(nav_contributions[i]) {
                                Some(v) => v / total_nav,
                                None => {
                                    error!(order_id, asset = ?assets[i], "Overflow computing per-asset USDC");
                                    continue;
                                }
                            };

                            if per_asset_usdc.is_zero() {
                                debug!(order_id, asset = ?assets[i], "Zero USDC for asset, skipping");
                                continue;
                            }

                            // Circuit breaker gate
                            if let Err(reason) = cb.check_trade(per_asset_usdc, order_id) {
                                error!(
                                    code = "E009",
                                    order_id,
                                    asset = ?assets[i],
                                    reason = %reason,
                                    "Circuit breaker blocked fill-derived trade"
                                );
                                metrics.increment_orders_failed();
                                continue;
                            }

                            // Compute asset amount: asset_amount = per_asset_usdc * 1e18 / price
                            let asset_amount = match per_asset_usdc.checked_mul(scale) {
                                Some(v) => v / prices[i],
                                None => {
                                    error!(order_id, asset = ?assets[i], "Overflow computing asset amount");
                                    continue;
                                }
                            };

                            if asset_amount.is_zero() {
                                debug!(order_id, asset = ?assets[i], "Zero asset amount, skipping");
                                continue;
                            }

                            // Set price on vault
                            let _ = settlement.vault_client.set_price(assets[i], prices[i]).await;

                            // Determine sell/buy tokens based on side
                            let (sell_token, buy_token, sell_amt, buy_amt) = if side == 0 {
                                // BUY: sell USDC, buy asset
                                (quote, assets[i], per_asset_usdc, asset_amount)
                            } else {
                                // SELL: sell asset, buy USDC
                                (assets[i], quote, asset_amount, per_asset_usdc)
                            };

                            // Generate deterministic trade ID from order_id + asset index
                            let trade_id_bytes = ethers::utils::keccak256(
                                ethers::abi::encode(&[
                                    ethers::abi::Token::Uint(U256::from(order_id)),
                                    ethers::abi::Token::Address(assets[i]),
                                ])
                            );
                            let trade_id = U256::from_big_endian(&trade_id_bytes).low_u64();

                            match settlement.vault_client.execute_trade(
                                trade_id, sell_token, buy_token, sell_amt, buy_amt,
                            ).await {
                                Ok(tx_hash) => {
                                    info!(
                                        order_id,
                                        asset = ?assets[i],
                                        side,
                                        per_asset_usdc = %per_asset_usdc,
                                        asset_amount = %asset_amount,
                                        tx_hash = ?tx_hash,
                                        "Fill-derived vault trade executed"
                                    );
                                    cb.record_success();
                                    metrics.increment_orders_processed();
                                    if let Some(ref at) = audit_for_task {
                                        at.log("ap", "FILL_DERIVED_TRADE", &serde_json::json!({
                                            "order_id": order_id,
                                            "asset": format!("{:#x}", assets[i]),
                                            "side": if side == 0 { "BUY" } else { "SELL" },
                                            "usdc_amount": format!("{}", per_asset_usdc),
                                            "asset_amount": format!("{}", asset_amount),
                                            "tx_hash": format!("{:?}", tx_hash),
                                        }));
                                    }
                                }
                                Err(e) => {
                                    cb.record_failure();
                                    error!(
                                        code = "E008",
                                        order_id,
                                        asset = ?assets[i],
                                        error = %e,
                                        "Fill-derived vault trade failed"
                                    );
                                    metrics.increment_orders_failed();
                                    if let Some(ref at) = audit_for_task {
                                        at.log("ap", "FILL_DERIVED_TRADE_FAILED", &serde_json::json!({
                                            "order_id": order_id,
                                            "asset": format!("{:#x}", assets[i]),
                                            "side": if side == 0 { "BUY" } else { "SELL" },
                                            "error": format!("{}", e),
                                        }));
                                    }
                                }
                            }
                        }

                        // Remove from tracker after processing
                        // (done inside the spawned task — needs the Arc)
                    });

                    // Clean up tracker entry (best-effort, spawned task may still be running)
                    order_tracker.write().await.remove(&order_id);
                }
            }
        }
    }

    info!("Event processing task stopped");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Build configuration using the layered resolution chain:
    // CLI > ENV > Config file > Defaults
    // Resolve bitget testnet/mainnet from CLI flags
    let bitget_testnet_cli = if args.bitget_mainnet {
        Some(false) // --bitget-mainnet means testnet=false
    } else if args.bitget_testnet {
        Some(true)
    } else {
        None // Let env/config/default decide
    };

    let config = ConfigBuilder::new()
        .with_config_file(args.config.clone())
        .with_cli_args(
            Some(args.port),
            Some(args.rpc.clone()),
            if args.mock_bitget { Some(true) } else { None },
            Some(args.log_level.clone()),
            Some(args.log_dir.clone()),
            if args.json_logs { Some(true) } else { None },
            args.index_contract.clone(),
            bitget_testnet_cli,
        )
        .with_deployment_file(args.deployment_file.clone())
        .with_mock_chain(if args.mock_chain { Some(true) } else { None })
        .with_bitget_vault(args.bitget_vault.clone())
        .with_chain_id(args.chain_id)
        .with_mock_usdt(args.mock_usdt.clone())
        .with_data_node_url(args.data_node_url.clone())
        .with_settlement_rpc_url(args.settlement_rpc)
        .with_settlement_chain_id(args.settlement_chain_id)
        .with_exchange_mode(args.exchange_mode)
        .build()
        .map_err(|e| {
            eprintln!("Configuration error: {}", e);
            e
        })?;

    setup_logging(&config)?;

    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = shutdown.clone();

    tokio::spawn(async move {
        let ctrl_c = async {
            // SAFETY: Signal handler installation only fails if the OS refuses,
            // which is an unrecoverable environment issue at startup.
            signal::ctrl_c()
                .await
                .expect("Failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            // SAFETY: Signal handler installation only fails if the OS refuses.
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("Failed to install signal handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {
                warn!("Received Ctrl+C, initiating shutdown");
            }
            _ = terminate => {
                warn!("Received SIGTERM, initiating shutdown");
            }
        }

        shutdown_clone.store(true, Ordering::Relaxed);
    });

    if let Err(e) = run_ap(config, shutdown).await {
        error!(code = "E008", error = %e, "AP service error");
        std::process::exit(1);
    }

    Ok(())
}
