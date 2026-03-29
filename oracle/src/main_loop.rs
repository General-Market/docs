//! The main consensus loop for the oracle node.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use oracle::bootstrap::OracleComponents;
use oracle::{
    BackendNavCalculator, NavCalculator, NavSignHandler, PriceFetcher, StubItpRegistryReader,
};
use common::types::P2PMessage;
use common::runtime::config::SharedConfig;
use tokio::net::TcpListener;
use tracing::{debug, info, warn, error};

use crate::api_handlers::{OracleApiState, OracleNavSignHandler, oracle_api_routes};
use crate::helpers::compute_nav;
use crate::phases::{
    run_price_update, run_itp_creation_phase, run_cross_chain_processing,
    run_cross_chain_buy_post_processing, run_cross_chain_sell_processing,
    run_rebalance_processing, run_mock_consensus, mirror_sync_task,
};

pub(crate) async fn run_main_loop(mut components: OracleComponents, api_enabled: bool, data_node_url: Option<String>, itp_id: String, mock_usdt_addr: Option<ethers::types::Address>, vision_router: Option<axum::Router>, nav_oracle_address: Option<ethers::types::Address>, itp_token_address: Option<ethers::types::Address>, settlement_chain_id: Option<u64>, mirror_registry_address: Option<ethers::types::Address>, oracle_registry_address_for_sync: Option<ethers::types::Address>, _vision_config: Option<oracle::vision::config::VisionConfig>, shared_config: SharedConfig, flushing: Arc<AtomicBool>) -> Result<(), Box<dyn std::error::Error>> {
    let node_id = components.node_id;
    let shutdown = components.shutdown.clone();

    // Bind HTTP API listener (health + nav-sign + registry-sync + optional Vision)
    let listener = TcpListener::bind(format!("0.0.0.0:{}", components.p2p.health_port)).await?;
    info!(node_id, health_port = components.p2p.health_port, "HTTP API listening");

    info!(node_id, "Oracle node initialized, entering main loop");

    // Create work signal channel for demand-driven cycling
    let (work_tx, work_rx) = tokio::sync::mpsc::channel::<bool>(1);
    components.consensus.cycle_manager = components.consensus.cycle_manager.with_work_channel(work_rx);

    // Get cycle state receiver
    let cycle_state_rx = components.consensus.cycle_manager.subscribe();

    // Create P2P metrics early so the router can increment counters
    let p2p_metrics = Arc::new(oracle::p2p::P2PMetrics::default());

    // Attach metrics to transport for outbound message counting
    if let Some(ref transport) = components.p2p.transport {
        transport.set_metrics(p2p_metrics.clone());
    }

    // Spawn P2P message router when ConsensusProtocol exists
    let router_handle: Option<tokio::task::JoinHandle<()>> = if let (Some(protocol), Some(p2p)) =
        (&components.consensus.protocol, &components.p2p.transport)
    {
        let router_protocol = Arc::clone(protocol);
        let router_p2p = Arc::clone(p2p);
        let router_heartbeat_monitor = components.p2p.heartbeat_monitor.clone();
        let router_p2p_metrics = p2p_metrics.clone();
        Some(tokio::spawn(async move {
            use common::traits::P2PTransport;
            match router_p2p.receive().await {
                Ok(stream) => {
                    use futures::StreamExt;
                    tokio::pin!(stream);
                    while let Some(Ok((from, message))) = stream.next().await {
                        router_p2p_metrics.messages_received.fetch_add(1, Ordering::Relaxed);
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
    let num_oracles = components.consensus.config.num_oracles;
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
        let custody_addr = orch.config().oracle_custody_l3;
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

    // Initialize registry nonce from mirror's lastSnapshotNonce on startup.
    // Initialize L3 registry nonce from on-chain OracleRegistry.lastSnapshotNonce.
    // L3 BLS operations (submitBatch, confirmBatch, setItpNav, etc.) use this as referenceNonce.
    if let Some(ref protocol) = consensus_protocol_for_task {
        match consensus_chain_reader.get_registry_nonce().await {
            Ok(l3_nonce) if l3_nonce > 0 => {
                protocol.set_registry_nonce(l3_nonce);
                info!(l3_nonce, "Startup: initialized L3 registry nonce from OracleRegistry.lastSnapshotNonce");
            }
            Ok(_) => info!("Startup: L3 lastSnapshotNonce is 0, L3 registry nonce stays at default"),
            Err(e) => warn!(error = %e, "Startup: failed to read L3 registry nonce"),
        }
    }

    // Initialize Settlement mirror registry nonce from mirror's lastSnapshotNonce.
    // Settlement BLS operations (completeBuyOrder, mintBridgedShares, etc.) use this.
    if let (Some(ref protocol), Some(ref settlement_writer), Some(mirror_addr)) =
        (&consensus_protocol_for_task, &settlement_writer_for_task, mirror_registry_address)
    {
        let lsn_selector = &ethers::utils::keccak256(b"lastSnapshotNonce()")[..4];
        match settlement_writer.static_call(mirror_addr, lsn_selector.to_vec()).await {
            Ok(bytes) if bytes.len() >= 32 => {
                let mirror_nonce = ethers::types::U256::from_big_endian(&bytes[..32]).as_u64();
                if mirror_nonce > 0 {
                    protocol.set_settlement_registry_nonce(mirror_nonce);
                    info!(mirror_nonce, "Startup: initialized Settlement registry nonce from mirror lastSnapshotNonce");
                } else {
                    info!("Startup: mirror lastSnapshotNonce is 0, Settlement registry nonce stays at default");
                }
            }
            Ok(_) => warn!("Startup: unexpected response length from mirror lastSnapshotNonce"),
            Err(e) => warn!(error = %e, "Startup: failed to read mirror lastSnapshotNonce, Settlement ops may fail until first sync"),
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
    let oracle_registry_for_sync_task = oracle_registry_address_for_sync;
    let work_tx_for_task = work_tx;

    // Vision ops consensus task deleted (round-only purge)

    // Build quote_tokens map: asset address → quote token address (USDC or USDT)
    // Oracle determines which quote token each asset trades against based on Bitget pair suffix
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
        let mut cycle_start_instant = std::time::Instant::now();
        let itp_first_seen: Arc<tokio::sync::Mutex<std::collections::HashMap<ethers::types::U256, (std::time::Instant, u32)>>> = Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new()));

        // In-flight guards: prevent duplicate spawns of the same processing phase
        let price_active = Arc::new(AtomicBool::new(false));
        let buy_active = Arc::new(AtomicBool::new(false));
        let bridge_buy_post_active = Arc::new(AtomicBool::new(false));
        let sell_active = Arc::new(AtomicBool::new(false));
        let itp_active = Arc::new(AtomicBool::new(false));
        let rebalance_active = Arc::new(AtomicBool::new(false));
        let mirror_sync_active = Arc::new(AtomicBool::new(false));
        let mirror_sync_first = Arc::new(AtomicBool::new(true)); // Trigger sync on first eligible cycle
        let mirror_sync_needed = Arc::new(AtomicBool::new(false)); // Set by SnapshotTooOld errors to trigger immediate retry
        // vision_ops_active deleted (round-only purge)

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
                // Update cycle duration for the previous cycle
                if last_cycle > 0 {
                    let cycle_ms = cycle_start_instant.elapsed().as_millis() as u64;
                    consensus_metrics.record_cycle_duration(cycle_ms);
                }
                cycle_start_instant = std::time::Instant::now();
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
                            match tokio::time::timeout(
                                std::time::Duration::from_secs(30),
                                async {
                                    let success = run_price_update(p, pf, cr, l3w, oracle_addr, itp_addr, cid, addrs, cycle, metrics, rpc_ts, nav).await;
                                    let _ = ptx.send(success).await;
                                },
                            ).await {
                                Ok(()) => {},
                                Err(_) => warn!(cycle, "Price update timed out after 30s, releasing flag"),
                            }
                        });
                    }

                    // Settlement tasks — poll every 1s for bridge detection
                    // Skip bridge processing during P2P startup grace period (15s)
                    // Also skip until first mirror sync completes (prevents nonce collisions with sync tx)
                    let bridge_ready = std::time::Instant::now() >= bridge_ready_after;
                    let mirror_sync_pending = mirror_registry_for_task.is_some() && mirror_sync_first.load(Ordering::Acquire);
                    let settlement_poll_due = bridge_ready && !mirror_sync_pending && last_settlement_poll.elapsed() >= std::time::Duration::from_secs(1);
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
                            let nu = consensus_config.num_oracles;
                            let msn_itp = mirror_sync_needed.clone();
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                match tokio::time::timeout(
                                    std::time::Duration::from_secs(60),
                                    run_itp_creation_phase(p, ar, aw, cw, ic, cycle, ni, nu, fs, msn_itp),
                                ).await {
                                    Ok(()) => {},
                                    Err(_) => warn!(cycle, "ITP creation timed out after 60s, releasing flag"),
                                }
                            });
                        }
                    }

                    // Cross-chain BUY — detect + bridge + submit + immediate batch/fills/mint (merged pipeline)
                    if current_cycle % 100 == 0 {
                        info!(cycle = current_cycle, settlement_poll_due, bridge_ready, mirror_sync_pending,
                            buy_active = buy_active.load(Ordering::Acquire),
                            has_reader = settlement_reader_for_task.is_some(),
                            has_orch = bridge_orchestrator_for_task.is_some(),
                            has_writer = settlement_writer_for_task.is_some(),
                            "Cross-chain buy gate check");
                    }
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
                            let nu = consensus_config.num_oracles;
                            let cursor = settlement_buy_cursor.clone();
                            let bpr = Arc::new(AtomicBool::new(false)); // unused, kept for fn sig
                            let sbo = startup_buy_orders.clone();
                            let msn = mirror_sync_needed.clone();
                            let met = consensus_metrics.clone();
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                match tokio::time::timeout(
                                    std::time::Duration::from_secs(300),
                                    run_cross_chain_processing(
                                        p, ar, orch, aw, cr, cycle, ni, nu, dnu, iid, nav, qt, cursor, bpr, sbo, msn, met,
                                    ),
                                ).await {
                                    Ok(()) => {},
                                    Err(_) => warn!(cycle, "Cross-chain buy processing timed out after 300s, releasing flag"),
                                }
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
                            let nu = consensus_config.num_oracles;
                            let msn = mirror_sync_needed.clone();
                            let met = consensus_metrics.clone();
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                match tokio::time::timeout(
                                    std::time::Duration::from_secs(300),
                                    run_cross_chain_buy_post_processing(
                                        p, ar, orch, aw, cr, cycle, ni, nu, dnu, iid, nav, qt, None, msn, met,
                                    ),
                                ).await {
                                    Ok(()) => {},
                                    Err(_) => warn!(cycle, "Cross-chain buy post-processing timed out after 300s, releasing flag"),
                                }
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
                            let nu = consensus_config.num_oracles;
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
                                                        match aw.mint_bridged_shares(itp_id, user, shares, order_id, mint_result.aggregated_signature.0.clone(), p.settlement_registry_nonce(), mint_result.signer_bitmap).await {
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
                            let nu = consensus_config.num_oracles;
                            let cursor = settlement_sell_cursor.clone();
                            let sso = startup_sell_orders.clone();
                            let msn = mirror_sync_needed.clone();
                            let met = consensus_metrics.clone();
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                match tokio::time::timeout(
                                    std::time::Duration::from_secs(60),
                                    run_cross_chain_sell_processing(
                                        p, ar, orch, aw, cr, cycle, ni, nu, dnu, iid, nav, qt, cursor, sso, msn, met,
                                    ),
                                ).await {
                                    Ok(()) => {},
                                    Err(_) => warn!(cycle, "Cross-chain sell processing timed out after 60s, releasing flag"),
                                }
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
                            let nu = consensus_config.num_oracles;
                            tokio::spawn(async move {
                                let _guard = FlagGuard(flag);
                                match tokio::time::timeout(
                                    std::time::Duration::from_secs(60),
                                    run_rebalance_processing(
                                        p, orch, cr, cycle, ni, nu, pf, sm, qt,
                                    ),
                                ).await {
                                    Ok(()) => {},
                                    Err(_) => warn!(cycle, "Rebalance processing timed out after 60s, releasing flag"),
                                }
                            });
                        }
                    }

                    // Mirror registry sync — only node_index 0 proposes (Step 12).
                    // Other nodes participate as followers when they receive MirrorSyncProposal.
                    // Triggers every 500 cycles (~8 min) + once shortly after startup.
                    // Always refreshes the snapshot to prevent BLSVerifier__SnapshotTooOld (86400 block limit).
                    let is_sync_leader = node_index_for_task == 0;
                    let first_sync = mirror_sync_first.load(Ordering::Acquire);
                    let snapshot_stale = mirror_sync_needed.load(Ordering::Acquire);
                    // Followers: clear mirror_sync_first after grace period so settlement
                    // polling is not permanently blocked. The leader proposes the sync;
                    // followers participate via P2P handlers. If the sync never arrives
                    // (leader crashed, consensus failed), followers must still be able to
                    // poll settlement for cross-chain orders.
                    if !is_sync_leader && first_sync && bridge_ready {
                        mirror_sync_first.store(false, Ordering::Release);
                        info!(cycle = current_cycle, node_index = node_index_for_task,
                            "Follower: clearing mirror_sync_first (grace period passed)");
                    }
                    if is_sync_leader && (first_sync || snapshot_stale || current_cycle % 500 == 0) && !mirror_sync_active.load(Ordering::Acquire) {
                        if let Some(ref protocol) = consensus_protocol_for_task {
                            if let Some(ref settlement_writer) = settlement_writer_for_task {
                                if let (Some(mirror_addr), Some(_oracle_reg_addr)) = (mirror_registry_for_task, oracle_registry_for_sync_task) {
                                    mirror_sync_first.store(false, Ordering::Release);
                                    // NOTE: Do NOT clear mirror_sync_needed here — clear it inside
                                    // the sync task ONLY on success. Clearing before the task runs
                                    // causes a race: downstream SnapshotTooOld errors re-set the flag
                                    // but the sync hasn't completed yet, creating a livelock.
                                    let settlement_cid = settlement_chain_id_for_task.expect(
                                        "ORACLE_SETTLEMENT_CHAIN_ID must be set — refusing to use wrong default"
                                    );
                                    mirror_sync_active.store(true, Ordering::Release);
                                    let flag = mirror_sync_active.clone();
                                    let p = Arc::clone(protocol);
                                    let aw = Arc::clone(settlement_writer);
                                    let cr = consensus_chain_reader.clone();
                                    let cycle = current_cycle;
                                    let msn_sync = mirror_sync_needed.clone();
                                    tokio::spawn(async move {
                                        let _guard = FlagGuard(flag);
                                        match tokio::time::timeout(
                                            std::time::Duration::from_secs(90),
                                            mirror_sync_task(&cr, &aw, &p, mirror_addr, settlement_cid, cycle),
                                        ).await {
                                            Ok(Err(e)) => warn!(cycle, error = %e, "Mirror registry sync failed"),
                                            Ok(Ok(())) => {
                                                // Only clear on confirmed success
                                                msn_sync.store(false, Ordering::Release);
                                            },
                                            Err(_) => warn!(cycle, "Mirror registry sync timed out after 90s, releasing flag"),
                                        }
                                    });
                                }
                            }
                        }
                    }

                    // Vision ops consensus task deleted (round-only purge)

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
                                                    oracle::bridge::BridgeOrderStatus::SellPending |
                                                    oracle::bridge::BridgeOrderStatus::SellBurnPending |
                                                    oracle::bridge::BridgeOrderStatus::SellBurned |
                                                    oracle::bridge::BridgeOrderStatus::SellSubmittedOnL3 |
                                                    oracle::bridge::BridgeOrderStatus::SellFilled
                                                ) {
                                                    // Task 4: Status-aware reset for burn states
                                                    if matches!(status, oracle::bridge::BridgeOrderStatus::SellBurnPending) {
                                                        // Check on-chain state to resolve ambiguous SellBurnPending
                                                        if let Some(ref settlement_reader) = settlement_reader_for_task {
                                                            let on_chain_burned = settlement_reader
                                                                .get_cross_chain_sell_order(*order_id).await
                                                                .ok().flatten().map(|o| o.burned)
                                                                .unwrap_or(false);
                                                            if on_chain_burned {
                                                                warn!(order_id = %order_id, "Stale SellBurnPending but burn confirmed on-chain — advancing to SellBurned");
                                                                orch.set_sell_order_status(*order_id, oracle::BridgeOrderStatus::SellBurned).await;
                                                            } else {
                                                                warn!(order_id = %order_id, "Stale SellBurnPending and burn NOT on-chain — resetting to SellPending");
                                                                orch.set_sell_order_status(*order_id, oracle::BridgeOrderStatus::SellPending).await;
                                                            }
                                                        }
                                                    } else if matches!(status, oracle::bridge::BridgeOrderStatus::SellBurned) {
                                                        // Don't reset — keep at SellBurned, Phase A sub-step 3 retries L3 submit
                                                        warn!(order_id = %order_id, "Stale SellBurned order — retrying L3 submit only");
                                                    } else if matches!(status, oracle::bridge::BridgeOrderStatus::SellSubmittedOnL3) {
                                                        // Don't reset — L3 order exists, Phase B retries fill confirmation
                                                        warn!(order_id = %order_id, "Stale SellSubmittedOnL3 order — retrying fills only");
                                                    } else if matches!(status, oracle::bridge::BridgeOrderStatus::SellFilled) {
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
                                                        oracle::bridge::BridgeOrderStatus::Pending |
                                                        oracle::bridge::BridgeOrderStatus::BridgedToL3
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
                    // in-flight orders. Active task flags (buy_active, sell_active, etc.)
                    // must NOT trigger WorkDriven — they cause a feedback loop where
                    // running tasks → work signal → cycle advance → re-check → still running
                    // → work signal → ... causing rapid cycle divergence across oracles
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
    let nav_sign_handler: Option<Arc<OracleNavSignHandler>> =
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
                components.consensus.keys.oracle_registry_index,
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
    let oracle_state = Arc::new(OracleApiState {
        node_id,
        p2p_transport: components.p2p.transport.clone(),
        metrics: components.consensus.metrics.clone(),
        p2p_metrics: p2p_metrics.clone(),
        registry_sync_cache: components.registry_sync_cache.clone(),
        nav_sign_handler: nav_sign_handler.clone(),
        num_oracles,
        bls_keypair_loaded,
        last_rpc_success_ms: last_rpc_success_ms.clone(),
        runtime_config: shared_config,
        flushing,
    });
    let mut api_router = oracle_api_routes(oracle_state);
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
        let watchdog = Arc::new(oracle::delisting_watchdog::DelistingWatchdog::new(
            dn_url.clone(),
            components.chain.reader.clone(),
            writer.clone() as Arc<dyn common::traits::ChainWriter>,
            components.price.symbol_map.clone(),
            index_address,
        ));
        let wd_leader = Arc::new(tokio::sync::RwLock::new(
            oracle::LeaderElector::new(
                components.consensus.keys.node_index,
                components.consensus.config.num_oracles,
            ),
        ));
        let wd_shutdown = shutdown.clone();
        tokio::spawn(async move {
            oracle::delisting_watchdog::run_daily(
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

    info!(node_id, "Oracle node shutting down gracefully");
    Ok(())
}
