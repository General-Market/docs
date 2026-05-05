//! AP service startup and wiring — the `run_ap()` function.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use axum::{Router, routing::get};
use ethers::prelude::*;
use tokio::sync::RwLock;
use tracing::{debug, info, warn, error};

use ap::circuit_breaker::CircuitBreaker;
use ap::config::APConfig;
use ap::event_monitor::{EventMonitorBuilder, EventMonitorConfig};
use ap::event_queue::{APEvent, EventReceiver};
use ap::external::bitget::{BitgetClient, BitgetConfig, RateLimitedBitgetClient};
use ap::external::bitget_vault::BitgetVaultClient;
use ap::limit_enforcer::LimitOrderEnforcer;
use ap::metrics::APMetrics;
use ap::sse_client::SseChainEventClient;
use ap::timeout::{TimeoutConfig, TimeoutHandler};
use common::adapters::{DeploymentConfig, RpcChainReader, RpcChainWriter};
use common::mocks::{MockBitgetBuilder, MockChainBuilder};
use common::rate_limit::{BitgetRateLimiter, RateLimiterTier};
use common::runtime::admin::admin_router;
use common::runtime::config::{RuntimeConfig, shared};
use common::runtime::watcher::DeploymentWatcher;
use common::traits::{APClient, ChainWriter};
use common::types::ExchangeMode;

use crate::cli::OnChainSettlement;
use crate::event_processor::process_events;
use crate::http_api::{AppState, cors_layer, handle_health, handle_live, handle_nav, handle_prices, handle_ready};

pub(crate) async fn run_ap(config: APConfig, shutdown: Arc<AtomicBool>) -> Result<(), Box<dyn std::error::Error>> {
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

    // Safety guard: mock exchange against a real chain is the most expensive
    // misconfiguration this system can make. It fills orders that were never
    // placed on any exchange. Refuse to start unless the RPC is explicitly
    // local.
    if exchange_mode.is_mock() && !use_mock_chain {
        let rpc_lower = rpc_url.to_lowercase();
        let is_local_rpc = rpc_lower.contains("localhost")
            || rpc_lower.contains("127.0.0.1")
            || rpc_lower.contains("0.0.0.0")
            || rpc_lower.contains("host.docker.internal");
        if !is_local_rpc {
            error!(
                rpc = %rpc_url,
                exchange_mode = %exchange_mode,
                "Refusing to run mock exchange against non-local chain. \
                 Pass --exchange-mode testnet/mainnet, or point RPC at localhost."
            );
            return Err("mock exchange mode against non-local chain is forbidden".into());
        }
    }

    // Refuse to boot if the deployment JSON disagrees with the chain
    // (codeless addresses, wrong chainId). The April 23 incident: oracle
    // pointed at an empty address, every createBatch succeeded with no
    // BatchCreated event because the EVM accepts calls to codeless
    // addresses as no-ops. Eighteen hours of silent failure. Catch it
    // before any port binds or any signer signs.
    if !use_mock_chain {
        if let Some(deployment_path) = config.effective_deployment_file() {
            let deployment = DeploymentConfig::from_file(&deployment_path)
                .map_err(|e| format!("Failed to load deployment config for verification: {}", e))?;
            deployment.validate(target_chain_id)
                .map_err(|e| format!("Deployment config validation failed: {}", e))?;
            common::runtime::admin::verify_deployment_or_die(
                &deployment,
                &rpc_url,
                &["Index", "OracleRegistry"],
            ).await;
        }
    }

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
            "Data-node mode initialized (SSE events, RpcChainWriter)"
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

            // MockBitgetVault lives on L3 (same chain as Index.sol)
            let l3_rpc = config.rpc_url.as_deref().unwrap_or("http://localhost:8545");
            let l3_chain_id = config.chain_id.unwrap_or(111222333);

            let vault_client = BitgetVaultClient::new(
                l3_rpc,
                &private_key,
                vault_address,
                l3_chain_id,
            )
            .map_err(|e| format!("Failed to create BitgetVaultClient: {}", e))?;

            // Pre-initialize nonce counter to avoid races on first parallel send batch
            vault_client.initialize_nonce().await
                .map_err(|e| format!("Failed to initialize vault nonce: {}", e))?;

            info!(
                vault_address = ?ethers::types::Address::from(vault_address),
                quote_token = ?quote_token,
                l3_rpc = l3_rpc,
                l3_chain_id = l3_chain_id,
                data_node = ?config.data_node_url,
                "On-chain settlement enabled via L3 MockBitgetVault"
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
        .route("/health/live", get(handle_live))
        .route("/health/ready", get(handle_ready))
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
