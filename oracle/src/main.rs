//! Oracle node binary for Index L3
//!
//! Runs an oracle node that participates in order batching, consensus, and execution.

mod cli;
mod api_handlers;
mod phases;
mod helpers;
mod main_loop;

use clap::Parser;
use oracle::bootstrap::{BootstrapParams, OracleBootstrap};
use oracle::{ConfigBuilder, MIN_CYCLE_DURATION_MS};
use oracle::arbitration::types::ArbitrationConfig;
use common::types::P2PMessage;
use common::P2PTransport;
use common::runtime::config::{RuntimeConfig, shared};
use common::runtime::watcher::DeploymentWatcher;
use common::runtime::validate::StartupValidator;
use common::runtime::migrate::run_migrations;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::signal;
use tracing::{debug, info, warn, error};

use cli::Args;
use helpers::setup_logging;
use main_loop::run_main_loop;

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
        .with_oracle_custody_l3(args.oracle_custody_l3.clone())
        .with_oracle_custody_settlement(args.oracle_custody_settlement.clone())
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
        .with_data_node_url(args.data_node_url.clone())
        .with_data_node_token(args.data_node_token.clone())
        .with_nav_oracle(args.nav_oracle.clone(), args.itp_token.clone())
        .with_mirror_registry(args.mirror_registry.clone())
        .with_vision(if args.vision_enabled {
            let mut vision_cfg = oracle::vision::config::VisionConfig {
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
            // reveal_window_secs and tick_poll_interval_ms deleted (round-only purge)
            vision_cfg.data_node_token = args.data_node_token.clone();
            // Cross-chain deposit config — CLI args first, then env var fallbacks
            if let Some(ref url) = args.vision_settlement_rpc_url {
                vision_cfg.settlement_rpc_url = url.clone();
            } else if let Ok(url) = std::env::var("ORACLE_SETTLEMENT_RPC_URL") {
                vision_cfg.settlement_rpc_url = url;
            }
            if let Some(ref addr) = args.vision_settlement_bridge_custody {
                vision_cfg.settlement_bridge_custody_address = addr.clone();
            } else if let Ok(addr) = std::env::var("ORACLE_VISION_SETTLEMENT_BRIDGE_CUSTODY_ADDRESS") {
                vision_cfg.settlement_bridge_custody_address = addr;
            } else if let Ok(addr) = std::env::var("ORACLE_SETTLEMENT_CUSTODY") {
                vision_cfg.settlement_bridge_custody_address = addr;
            }
            if let Some(chain_id) = args.vision_settlement_chain_id {
                vision_cfg.settlement_chain_id = chain_id;
            } else if let Ok(chain_id) = std::env::var("ORACLE_SETTLEMENT_CHAIN_ID").and_then(|s| s.parse::<u64>().map_err(|_| std::env::VarError::NotPresent)) {
                vision_cfg.settlement_chain_id = chain_id;
            }
            // BLS proof generation config
            vision_cfg.num_oracles = args.num_oracles as usize;
            // node_id is 1-indexed (u32), node_index is 0-indexed (u8)
            vision_cfg.node_index = args.node_id.map(|id| (id.saturating_sub(1)) as u8).unwrap_or(0);
            // round_based_sources deleted — all sources are round-based
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
            eprintln!("Error: node-id is required. Set via --node-id, ORACLE_NODE_ID env var, or config file.");
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

    if args.num_oracles == 0 || args.num_oracles > 20 {
        eprintln!("Error: --num-oracles must be between 1 and 20 (got {})", args.num_oracles);
        std::process::exit(1);
    }

    // --- Mandatory registry-sync for multi-oracle deployments ---
    // Without registry-sync, oracles cannot detect join/leave events and will
    // desync their key registries, causing BLS aggregation failures.
    if args.num_oracles > 1 && !args.registry_sync {
        error!("ERROR: --registry-sync required for multi-oracle deployments (num_oracles={}). Refusing to start.", args.num_oracles);
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
    // --test-key-seeds implies non-production (testnet), so relax HTTP check
    let is_non_production = args.mock || args.test_key_seeds;
    if let Some(ref url) = args.data_node_url {
        oracle::config::validate_data_node_url(url, is_non_production)
            .unwrap_or_else(|e| panic!("FATAL: {}", e));
    }
    if let Some(ref url) = args.vision_data_node_url {
        oracle::config::validate_data_node_url(url, is_non_production)
            .unwrap_or_else(|e| panic!("FATAL: {}", e));
    }
    if let Some(ref url) = args.arbitration_data_node_url {
        oracle::config::validate_data_node_url(url, is_non_production)
            .unwrap_or_else(|e| panic!("FATAL: {}", e));
    }

    setup_logging(&config)?;

    // --- SharedConfig: hot-reloadable runtime configuration ---
    let deployment_path = config.deployment_file.clone()
        .unwrap_or_else(|| PathBuf::from("deployments/active-deployment.json"));
    let rpc_url = config.effective_rpc_url();
    let index_addr = config.effective_contract_addresses()
        .ok()
        .map(|ca| ca.index);

    let runtime_config = match RuntimeConfig::load(&deployment_path, &rpc_url, index_addr).await {
        Ok(cfg) => cfg,
        Err(e) => {
            warn!("RuntimeConfig load with nonce failed ({e}), retrying without nonce");
            RuntimeConfig::load(&deployment_path, &rpc_url, None).await
                .unwrap_or_else(|e2| panic!("RuntimeConfig load failed — deployment file unreadable: {e2}"))
        }
    };

    // Advisory startup validation (does not block startup)
    let validation_errors = StartupValidator::validate(&runtime_config).await;
    if !validation_errors.is_empty() {
        for e in &validation_errors {
            warn!("Startup validation: {e}");
        }
    }

    // Auto-migrate if migrations directory exists and DATABASE_URL is set
    let vision_db_url = config.vision.as_ref()
        .filter(|v| v.enabled)
        .map(|v| v.database_url.clone());
    if let Some(ref db_url) = vision_db_url {
        if !db_url.is_empty() {
            let migrations_dir = std::path::Path::new("migrations");
            if migrations_dir.exists() {
                match sqlx::PgPool::connect(db_url).await {
                    Ok(migration_pool) => {
                        match run_migrations(&migration_pool, migrations_dir).await {
                            Ok(count) => {
                                if count > 0 {
                                    info!(count, "Auto-migrations applied");
                                }
                            }
                            Err(e) => warn!("Auto-migration failed (non-fatal): {e}"),
                        }
                    }
                    Err(e) => warn!("Could not connect for migrations: {e}"),
                }
            }
        }
    }

    let shared_config = shared(runtime_config);

    // Spawn DeploymentWatcher with flush callback for nonce changes
    let flushing = Arc::new(AtomicBool::new(false));
    {
        let watcher_config = shared_config.clone();
        let watcher_path = deployment_path.clone();
        let flush_flag = flushing.clone();
        let flush_db_url = vision_db_url.clone();

        DeploymentWatcher::new(watcher_config, watcher_path)
            .with_nonce_poll_interval(std::time::Duration::from_secs(60))
            .on_nonce_change(move |old_nonce, new_nonce| {
                tracing::warn!("DEPLOYMENT NONCE CHANGED: {old_nonce} -> {new_nonce}. Flushing all state.");
                let flushing_flag = flush_flag.clone();
                let db_url = flush_db_url.clone();

                // Set flushing BEFORE spawn to close the race window.
                // If set inside the spawn, a request arriving between spawn() and the first
                // line of the async block would see flushing=false and hit a TRUNCATE.
                flushing_flag.store(true, Ordering::SeqCst);

                tokio::spawn(async move {
                    // Drop guard that clears flushing flag even on panic.
                    // Without this, a panic during TRUNCATE leaves flushing=true forever,
                    // and the service returns 503 on every request until restart.
                    struct FlushGuard(Arc<AtomicBool>);
                    impl Drop for FlushGuard {
                        fn drop(&mut self) {
                            self.0.store(false, Ordering::SeqCst);
                        }
                    }
                    let _guard = FlushGuard(flushing_flag);

                    let start = std::time::Instant::now();

                    // 1. Truncate all contract-dependent tables (if DB available)
                    if let Some(ref url) = db_url {
                        match sqlx::PgPool::connect(url).await {
                            Ok(pool) => {
                                let tables = [
                                    "vision_batches", "vision_batch_state", "vision_bitmaps",
                                    "vision_positions", "vision_tick_results", "vision_user_balances",
                                    // vision_deposit_orders, vision_withdraw_orders, vision_balance_proofs dropped (round-only purge)
                                    "vision_kv_store", "vision_player_tick_deltas",
                                    "signed_batch_configs", "batch_configs", "batch_settlements",
                                    "oracle_health_snapshots", "vision_last_resolved", "vision_reference_prices",
                                ];
                                for table in &tables {
                                    let sql = format!("TRUNCATE TABLE {table} CASCADE");
                                    if let Err(e) = sqlx::query(&sql).execute(&pool).await {
                                        tracing::warn!("Failed to truncate {table}: {e}");
                                    }
                                }

                                // 3. Reset chain_listener bookmark
                                sqlx::query("DELETE FROM vision_kv_store WHERE key = 'chain_listener_last_block'")
                                    .execute(&pool).await.ok();
                            }
                            Err(e) => {
                                tracing::warn!("Flush: could not connect to DB for truncation: {e}");
                            }
                        }
                    }

                    // 2. Delete consensus WAL files
                    for entry in std::fs::read_dir("logs").into_iter().flatten() {
                        if let Ok(entry) = entry {
                            if entry.file_name().to_string_lossy().starts_with("consensus-")
                                && entry.file_name().to_string_lossy().ends_with(".wal")
                            {
                                let _ = std::fs::remove_file(entry.path());
                            }
                        }
                    }

                    // 4. Log BLS re-registration warning if OracleRegistry address changed
                    tracing::warn!("Check if OracleRegistry address changed — may need BLS re-registration");

                    // FlushGuard::drop clears flushing=false (even on panic)
                    let elapsed = start.elapsed();
                    tracing::info!("Oracle flush complete for nonce change (took {elapsed:?})");
                });
            })
            .spawn();
    }

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
        num_oracles: args.num_oracles,
        signature_threshold_override: args.signature_threshold,
        bls_key_seed_index: args.bls_key_seed_index,
        on_chain_oracle_id: args.on_chain_oracle_id,
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
        consensus_round_timeout_secs: args.consensus_round_timeout_secs,
    };

    // Warning for emergency threshold override
    if args.signature_threshold.is_some() {
        warn!(
            "EMERGENCY OVERRIDE: --emergency-threshold-override is active. \
             Threshold is normally auto-computed from on-chain activeOracleCount using BFT 2/3+1 formula. \
             The override is honoured for this run. Remove it once the emergency is resolved."
        );
    }

    // Bootstrap and run
    // Save NTP config before config is consumed by bootstrap
    let config_ntp_tolerance = config.ntp_tolerance_ms.unwrap_or(200);

    // Save registry sync config before config is consumed (Story 8.4, Task 7.3)
    let registry_sync_enabled = config.effective_registry_sync_enabled();
    let registry_sync_poll_interval_ms = config.effective_registry_sync_poll_interval_ms();
    let oracle_registry_address_str = config.oracle_registry_address.clone();

    // Save mock USDT address before config is consumed
    let mock_usdt_addr = config.effective_mock_usdt();

    // Save arbitration config before config is consumed
    let arb_config = ArbitrationConfig::from_oracle_config(&config);

    // Save Vision config before config is consumed
    let mut vision_config = config.vision.clone();
    // Propagate oracle_registry_address into VisionConfig for createBatch nonce reads.
    // The VisionConfig is built inside with_vision() where `config` is not in scope, so we patch here.
    if let Some(ref mut vc) = vision_config {
        if vc.oracle_registry_address.is_empty() {
            if let Some(ref addr) = config.oracle_registry_address {
                vc.oracle_registry_address = addr.clone();
            }
        }
    }

    // Shared PendingOpsQueue: deposit watcher (in main) enqueues ops,
    // vision ops consensus task (in run_main_loop) drains and submits them.
    // PendingOpsQueue deleted (round-only purge)

    // Parse oracle + mirror configs before config is consumed by bootstrap
    let nav_oracle_address: Option<ethers::types::Address> = config.nav_oracle_address.as_ref().and_then(|s| s.parse().ok());
    let itp_token_address: Option<ethers::types::Address> = config.itp_token_address.as_ref().and_then(|s| s.parse().ok());
    let settlement_chain_id: Option<u64> = config.effective_settlement_chain_id().ok();
    let mirror_registry_address: Option<ethers::types::Address> = config.mirror_registry_address.as_ref().and_then(|s| s.parse().ok());
    if let Some(addr) = mirror_registry_address {
        info!(?addr, "Mirror registry sync enabled");
    }
    let oracle_registry_for_sync: Option<ethers::types::Address> = config.oracle_registry_address.as_ref().and_then(|s| s.parse().ok());

    let bootstrap = OracleBootstrap::new(config, params);
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
        let ntp_sync = oracle::cycle::NtpSync::new(&args.ntp_server, config_ntp_tolerance, 60);
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
            // Parse OracleRegistry address
            let oracle_registry_address = oracle_registry_address_str
                .as_ref()
                .and_then(|addr| addr.parse::<ethers::types::Address>().ok())
                .unwrap_or_else(ethers::types::Address::zero);

            if oracle_registry_address == ethers::types::Address::zero() {
                warn!(node_id, "Registry sync enabled but OracleRegistry address not configured, skipping handler");
                None
            } else if mirror_registry_address.is_none() {
                warn!(node_id, "Registry sync enabled but MirrorOracleRegistry address not configured (set ORACLE_MIRROR_REGISTRY_ADDRESS or wire it via deployment.json), skipping handler");
                None
            } else {
                let mirror_address = mirror_registry_address.expect("checked above");

                // Create provider from L3 RPC URL
                let l3_rpc_url = components.chain.rpc_url.clone();
                let provider = Arc::new(
                    ethers::providers::Provider::<ethers::providers::Http>::try_from(&l3_rpc_url)
                        .expect("valid L3 RPC URL")
                );

                let sync_config = oracle::RegistrySyncConfig {
                    oracle_registry_address,
                    poll_interval_ms: registry_sync_poll_interval_ms,
                    max_block_range: 1000,
                    initial_scan_blocks: 86_400, // 24h downtime tolerance at 1s blocks
                };

                let mut handler = oracle::RegistrySyncHandler::new(
                    provider,
                    sync_config,
                    components.chain.reader.clone(),
                    bls_keypair.clone(),
                    components.consensus.keys.node_index,
                    components.consensus.keys.oracle_registry_index as u64,
                    cache.clone(),
                    components.target_chain_id,
                    mirror_address,
                );

                // Wire key registry for runtime updates on oracle join/leave
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
                    oracle_registry = ?oracle_registry_address,
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
            let (arb_msg_tx, arb_msg_rx) = oracle::arbitration::arbitration_channel();
            let arb_p2p: Arc<dyn common::traits::P2PTransport> =
                components.p2p.transport.clone().unwrap();
            let arb_writer = components.chain.writer.clone().unwrap();
            let arb_keypair = components.consensus.keys.bls_keypair.clone().unwrap();
            let arb_index = components.consensus.keys.node_index;
            let arb_rpc = components.chain.rpc_url.clone();

            let subsystem = oracle::arbitration::ArbitrationSubsystem::new(
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
    //
    // Dedicated tokio runtime for vision heartbeat / settlement-sweep /
    // bitmap-writer / batch-config-orchestrator / broadcast-relay tasks.
    // The shared #[tokio::main] runtime drives the ITP cycle, mirror sync,
    // P2P transport, and HTTP. Under ITP-cycle load, the LEADER heartbeat's
    // `await sign_rx.recv()` was being starved — cosigns arrived in millis,
    // the future never woke. A dedicated runtime fixes the starvation by
    // giving vision its own workers. `Arc`-wrapped state (cosign_router
    // DashMap, BLS keypair, P2P transport, PgPool) crosses runtimes safely.
    let mut vision_api_router: Option<axum::Router> = None;
    let mut _vision_runtime: Option<tokio::runtime::Runtime> = None;
    if let Some(ref vision_cfg) = vision_config {
        if vision_cfg.enabled {
            // Initialize Vision components
            let bitmap_store = Arc::new(oracle::vision::bitmap_store::BitmapStore::new());
            let scheduler = Arc::new(oracle::vision::tick_scheduler::TickScheduler::new());
            let resolver = Arc::new(oracle::vision::resolver::TickResolver::new(
                bitmap_store.clone(),
                vision_cfg.clone(),
            ));

            // Build the dedicated vision runtime. Four workers — enough for
            // heartbeat per source + settlement-recovery sweep + bitmap-writer
            // + orchestrator + broadcast-relay + headroom. The runtime lives
            // for the lifetime of `main`; dropping it would kill its tasks.
            let vision_workers: usize = 4;
            let vision_runtime = tokio::runtime::Builder::new_multi_thread()
                .worker_threads(vision_workers)
                .thread_name("vision-rt")
                .enable_all()
                .build()
                .expect("failed to build vision tokio runtime");
            let vision_handle = vision_runtime.handle().clone();
            _vision_runtime = Some(vision_runtime);
            info!(
                node_id,
                workers = vision_workers,
                "Vision runtime: {} dedicated workers started",
                vision_workers
            );

            // --- P2P channels for Vision engine ---
            // broadcast_tx: engine sends P2PMessage here; relay task calls transport.broadcast()
            let (vision_broadcast_tx, mut vision_broadcast_rx) =
                tokio::sync::mpsc::channel::<common::types::P2PMessage>(256);

            // Relay task: drain broadcast_rx and call transport.broadcast() for each message.
            // Spawned on the vision runtime so it isn't starved by ITP cycle bursts.
            if let Some(ref transport) = components.p2p.transport {
                let relay_transport = transport.clone();
                let relay_shutdown = components.shutdown.clone();
                vision_handle.spawn(async move {
                    while !relay_shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                        match tokio::time::timeout(
                            std::time::Duration::from_millis(100),
                            vision_broadcast_rx.recv(),
                        ).await {
                            Ok(Some(msg)) => {
                                if let Err(e) = relay_transport.broadcast(msg).await {
                                    warn!(error = %e, "Vision P2P broadcast relay failed");
                                }
                            }
                            Ok(None) => break, // sender dropped
                            Err(_) => continue, // timeout — check shutdown
                        }
                    }
                    debug!("Vision P2P broadcast relay task exited");
                });
            }

            // Initialize Postgres pool, chain listener, and API routes.
            // PgBouncer (transaction mode) sits in front: statement_cache_capacity(0)
            // and application_name set explicitly. Pool dropped 15→8 since
            // PgBouncer absorbs burst.
            use std::str::FromStr;
            let pool_opts = match sqlx::postgres::PgConnectOptions::from_str(&vision_cfg.database_url) {
                Ok(o) => o.application_name(&format!("oracle-{}", node_id)).statement_cache_capacity(0),
                Err(e) => {
                    error!(error = %e, "Failed to parse vision database URL: {}", e);
                    std::process::exit(1);
                }
            };
            match sqlx::postgres::PgPoolOptions::new()
                .max_connections(8)
                .idle_timeout(std::time::Duration::from_secs(300))
                .connect_with(pool_opts).await {
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

                    // Preflight: Vision must have bytecode. 2026-04-23 incident: a stale
                    // active-deployment.json pointed the oracle at an empty account. Every
                    // createBatch tx "succeeded" with no BatchCreated event because EVM
                    // accepts calls to codeless addresses as no-ops. Eighteen hours of
                    // silent failure followed. Refuse to boot if the pattern repeats.
                    {
                        use ethers::providers::Middleware;
                        match cl_provider.get_code(vision_address, None).await {
                            Ok(code) if code.0.is_empty() => {
                                error!(
                                    ?vision_address,
                                    rpc = %vision_rpc_url,
                                    "Vision contract has no bytecode — refusing to boot. \
                                     Check --vision-address / ORACLE_VISION_ADDRESS against the \
                                     live deployment. See 2026-04-23 incident notes."
                                );
                                std::process::exit(1);
                            }
                            Ok(code) => info!(
                                ?vision_address,
                                code_bytes = code.0.len(),
                                "Vision contract code verified at startup"
                            ),
                            Err(e) => warn!(
                                ?vision_address,
                                error = %e,
                                "eth_getCode failed during Vision startup verification — proceeding"
                            ),
                        }
                    }

                    // Build the on-demand chain refresher first so we can share the
                    // same HTTP provider between the event listener and the bitmap
                    // submission fallback path.
                    let chain_refresher = std::sync::Arc::new(
                        oracle::vision::chain_refresh::ChainRefresher::new(
                            cl_provider.clone(),
                            vision_address,
                        ),
                    );

                    let chain_listener = oracle::vision::chain_listener::ChainListener::new(
                        cl_provider,
                        vision_address,
                        scheduler.clone(),
                        pool.clone(),
                        vision_cfg.start_block,
                    );
                    // Repair zero/empty config_hashes synchronously BEFORE the HTTP server
                    // starts serving requests. The async repair inside chain_listener.run()
                    // fires too late — the API may already be returning stale hashes.
                    chain_listener.repair_zero_config_hashes().await;
                    let cl_shutdown = components.shutdown.clone();
                    tokio::spawn(async move {
                        chain_listener.run(cl_shutdown).await;
                    });

                    // VisionDepositWatcher deleted (round-only purge)

                    // Settlement SSE broadcast channel — shared between lifecycle manager and API.
                    let (settlement_tx, _) = tokio::sync::broadcast::channel::<oracle::vision::api::SettlementEvent>(64);

                    // Build the cosign aggregator. Lives for the process lifetime,
                    // shared by the lifecycle manager (writer side), the consensus
                    // protocol (receive side), and the submitter loop (drain side).
                    // Max age is 30 min — long enough that even a stalled batch
                    // gets aggregated before being garbage-collected.
                    let cosign_aggregator: oracle::vision::cosign_aggregator::SharedCosignAggregator =
                        std::sync::Arc::new(
                            oracle::vision::cosign_aggregator::CosignAggregator::new(
                                std::time::Duration::from_secs(1800),
                            ),
                        );
                    info!(node_id, "Cosign aggregator initialized (30-minute max age)");

                    // Share the protocol's DashMap-based co-sign router with the lifecycle manager.
                    // No Option wrapper, no mutex dance — both sides reference the same DashMap.
                    if let Some(ref protocol) = components.consensus.protocol {
                                let cosign_router = protocol.cosign_router.clone();
                                info!(node_id, "cosign_router shared with lifecycle manager (DashMap)");

                                // Attach the aggregator to the protocol so the receive-side
                                // dispatch arm fans out cosigns into it. The legacy router
                                // is preserved for settle paths and the pending-creates sweeper.
                                protocol.set_vision_cosign_aggregator(cosign_aggregator.clone()).await;
                                info!(node_id, "Cosign aggregator attached to consensus protocol");

                                // Spawn BatchLifecycleManager for round-based sources
                                let lm_chain_writer = components.chain.writer.clone();
                                let lm_bls_keypair = components.consensus.keys.bls_keypair.clone().map(Arc::new);
                                let lm_broadcast_tx = if components.p2p.transport.is_some() {
                                    Some(vision_broadcast_tx.clone())
                                } else {
                                    None
                                };
                                let lm_peer_id: [u8; 32] = components.consensus.keys.peer_id;
                                let lm = oracle::vision::lifecycle::BatchLifecycleManager::new(
                                    vision_cfg.clone(),
                                    scheduler.clone(),
                                    resolver.clone(),
                                    bitmap_store.clone(),
                                    pool.clone(),
                                    components.shutdown.clone(),
                                    lm_chain_writer,
                                    lm_bls_keypair,
                                    lm_broadcast_tx,
                                    cosign_router,
                                    cosign_aggregator.clone(),
                                    lm_peer_id,
                                    settlement_tx.clone(),
                                );
                                let lm = std::sync::Arc::new(lm);
                                let lm_recovery = lm.clone();
                                let lm_pending = lm.clone();
                                let lm_submitter = lm.clone();
                                // Spawn on the vision runtime so the submitter loop is
                                // woken on its 1 s cadence even while the shared
                                // runtime is buried under ITP cycle work.
                                vision_handle.spawn(async move { lm.run().await });
                                vision_handle.spawn(async move { lm_recovery.run_settlement_recovery().await });
                                vision_handle.spawn(async move { lm_pending.run_pending_creates_sweep().await });
                                vision_handle.spawn(async move { lm_submitter.run_submitter_loop().await });
                                info!(
                                    sources = ?Vec::<String>::new() /* round_based_sources deleted */,
                                    "BatchLifecycleManager spawned on vision runtime (P2P co-sign + settlement recovery + pending-creates sweep + submitter)"
                                );
                    }

                    // Spawn BatchConfigOrchestrator (independent async task, NOT inside run_cycle)
                    let orch_data_node_url = vision_cfg.data_node_url.clone();
                    // If data-node enforces admin auth (ADMIN_TOKEN set there),
                    // the orchestrator MUST send a matching token or every admin
                    // route returns 401 forever. If data-node leaves admin auth
                    // unset, the orchestrator can call freely with any string.
                    // We can't tell from here which mode the peer runs in, so we
                    // warn loudly when unset and proceed with empty — the actual
                    // 401 will surface in the orchestrator's error path if it
                    // happens, instead of preventing the oracle from booting at
                    // all (which is what the previous panic caused).
                    let orch_admin_token = vision_cfg.data_node_token.clone().unwrap_or_else(|| {
                        warn!(
                            "ORACLE_DATA_NODE_TOKEN unset — BatchConfigOrchestrator \
                             will call data-node admin routes anonymously. If the \
                             peer enforces ADMIN_TOKEN every call returns 401. Set \
                             ORACLE_DATA_NODE_TOKEN or --data-node-token to match \
                             the data-node's admin token."
                        );
                        String::new()
                    });
                    vision_handle.spawn(async move {
                        let mut orchestrator = oracle::vision::batch_config_orchestrator::BatchConfigOrchestrator::new(
                            orch_data_node_url,
                            orch_admin_token,
                        );
                        orchestrator.run().await;
                    });

                    // Spawn BatchLifecycleManager for round-based sources (no-P2P fallback).
                    // The P2P path above spawns it inside `if let Some(ref protocol)`.
                    // This path handles single-oracle dev mode where protocol is None.
                    if !Vec::<String>::new() /* round_based_sources deleted */.is_empty() && components.consensus.protocol.is_none() {
                        let lm_chain_writer = components.chain.writer.clone();
                        let lm_bls_keypair = components.consensus.keys.bls_keypair.clone().map(Arc::new);
                        let lm_peer_id: [u8; 32] = components.consensus.keys.peer_id;
                        let fallback_aggregator: oracle::vision::cosign_aggregator::SharedCosignAggregator =
                            std::sync::Arc::new(
                                oracle::vision::cosign_aggregator::CosignAggregator::new(
                                    std::time::Duration::from_secs(1800),
                                ),
                            );
                        let lm = oracle::vision::lifecycle::BatchLifecycleManager::new(
                            vision_cfg.clone(),
                            scheduler.clone(),
                            resolver.clone(),
                            bitmap_store.clone(),
                            pool.clone(),
                            components.shutdown.clone(),
                            lm_chain_writer,
                            lm_bls_keypair,
                            None, // no broadcast_tx
                            std::sync::Arc::new(dashmap::DashMap::new()), // empty router (no P2P)
                            fallback_aggregator,
                            lm_peer_id,
                            settlement_tx.clone(),
                        );
                        let lm = std::sync::Arc::new(lm);
                        let lm_recovery = lm.clone();
                        let lm_pending = lm.clone();
                        let lm_submitter = lm.clone();
                        // No-P2P fallback — still gets its own runtime so the
                        // heartbeat keeps its scheduling budget.
                        vision_handle.spawn(async move { lm.run().await });
                        vision_handle.spawn(async move { lm_recovery.run_settlement_recovery().await });
                        vision_handle.spawn(async move { lm_pending.run_pending_creates_sweep().await });
                        vision_handle.spawn(async move { lm_submitter.run_submitter_loop().await });
                        info!(
                            sources = ?Vec::<String>::new() /* round_based_sources deleted */,
                            "BatchLifecycleManager spawned on vision runtime (no-P2P mode + settlement recovery + pending-creates sweep + submitter)"
                        );
                    }

                    // Spawn 4-hour epoch points worker
                    {
                        let epoch_pool = pool.clone();
                        let epoch_shutdown = components.shutdown.clone();
                        let epoch_node_index = vision_cfg.node_index;
                        tokio::spawn(async move {
                            oracle::vision::epoch_points::run(epoch_pool, epoch_shutdown, epoch_node_index).await;
                        });
                        info!("EpochPoints worker spawned");
                    }

                    // Spawn the batched vision_bitmaps writer. Single-row
                    // INSERTs were 22 % of total Postgres time; the writer
                    // coalesces them at 100 ms / 200-row intervals. Runs on
                    // the vision runtime — bitmap flushes shouldn't compete
                    // with the ITP cycle for scheduling.
                    bitmap_store
                        .clone()
                        .spawn_writer_on(pool.clone(), components.shutdown.clone(), &vision_handle);

                    // vision_broadcast_tx is consumed by the lifecycle manager via clones
                    // taken above; the original handle is dropped when this scope ends so
                    // the relay task exits cleanly on shutdown.
                    let _ = vision_broadcast_tx;

                    let vision_state = Arc::new(oracle::vision::api::VisionState {
                        pool,
                        scheduler: scheduler.clone(),
                        bitmap_store: bitmap_store.clone(),
                        config: vision_cfg.clone(),
                        settlement_tx: settlement_tx.clone(),
                        chain_refresh: Some(chain_refresher.clone()),
                    });

                    // Build the Vision router (merged into health port in run_main_loop)
                    vision_api_router = Some(oracle::vision::api::routes(vision_state));

                    info!(
                        node_id,
                        vision_address = %vision_cfg.vision_address,
                        "Vision subsystem enabled (round-based only)"
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
                match oracle::p2p::wal::ConsensusWAL::open(wal_path, oracle::p2p::wal::WalSyncMode::None) {
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

    if let Err(e) = run_main_loop(components, args.api_enabled, args.data_node_url, args.itp_id, mock_usdt_addr, vision_api_router, nav_oracle_address, itp_token_address, settlement_chain_id, mirror_registry_address, oracle_registry_for_sync, vision_config, shared_config, flushing).await {
        error!(code = "E008", error = %e, "Oracle node error");
        std::process::exit(1);
    }

    Ok(())
}
