//! Curator service binary
//!
//! Supports four operational modes:
//! - **Oracle Collector Mode** (default): Collects BLS-signed NAV prices from oracles
//! - **Allocation Bot Mode** (--allocation-mode): Rebalances vault supply across markets
//! - **Health Monitor Mode** (--health-monitor-mode): Monitors Morpho protocol health
//! - **Unified Mode** (--unified-mode): Runs all tasks concurrently in a single process
//!
//! In unified mode, concurrent tasks include:
//! - Oracle collector loop
//! - Allocation bot loop
//! - Health monitor + crisis detection loop
//! - Alert dispatcher (Telegram or log)

use clap::Parser;
use curator::alerting::{AlertDispatcher, LogAlerter, TelegramAlerter};
use curator::allocator::AllocationBot;
use curator::collector::{NavCollector, OraclePusher};
use curator::config::{
    AlertingConfig, AllocationConfig, CuratorArgs, CuratorConfig, HealthMonitorConfig,
};
use curator::data_node_client::DataNodeClient;
use curator::health_monitor::{write_report_to_file, HealthMonitor, Severity};
use curator::shared_state::SharedCuratorState;
use ethers::types::{Address, U256};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

fn setup_logging(level: &str) -> Result<(), Box<dyn std::error::Error>> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(level));

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();

    Ok(())
}

// ============================================================================
// Oracle Collector Loop
// ============================================================================

async fn run_collection_round(
    collector: &NavCollector,
    pusher: &OraclePusher,
    itp_address: Address,
    total_oracles: usize,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let collection = collector.collect_all(itp_address).await?;

    let consensus = NavCollector::validate_consensus(&collection.responses, total_oracles)?;

    let (agg_sig, bitmask) = NavCollector::aggregate_nav_signatures(&collection.responses)?;

    let last_cycle = pusher.read_last_cycle_number().await?;

    if consensus.cycle_number <= last_cycle {
        info!(
            on_chain_cycle = last_cycle,
            new_cycle = consensus.cycle_number,
            "Skipping push: cycle number not newer than on-chain"
        );
        return Ok(());
    }

    let tx_hash = pusher
        .push_price(
            consensus.price,
            U256::from(consensus.timestamp),
            U256::from(consensus.cycle_number),
            agg_sig,
            bitmask,
        )
        .await?;

    info!(
        price = %consensus.price,
        cycle = consensus.cycle_number,
        tx = ?tx_hash,
        signers = %bitmask,
        "Oracle updated"
    );

    Ok(())
}

async fn run_collector_loop(
    config: CuratorConfig,
    shutdown: Arc<AtomicBool>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let collector = NavCollector::new(config.oracle_urls.clone());
    let mut pusher = OraclePusher::new(
        &config.rpc_url,
        &config.private_key,
        config.oracle_address,
    )?;

    // Wire data-node client for last-cycle reads when configured
    if let Some(ref url) = config.data_node_url {
        pusher.set_data_node_client(DataNodeClient::new(url));
        info!(url = %url, "Collector using data-node for lastCycleNumber reads");
    }

    let total_oracles = config.oracle_urls.len();

    info!(
        oracle_count = total_oracles,
        oracle = ?config.oracle_address,
        itp = ?config.itp_address,
        interval_secs = config.update_interval.as_secs(),
        "Curator oracle collector starting"
    );

    loop {
        if shutdown.load(Ordering::Relaxed) {
            info!("Shutdown requested, exiting collector loop");
            break;
        }

        if let Err(e) =
            run_collection_round(&collector, &pusher, config.itp_address, total_oracles).await
        {
            warn!(error = %e, "Collection round failed, will retry next interval");
        }

        tokio::time::sleep(config.update_interval).await;
    }

    info!("Curator oracle collector stopped");
    Ok(())
}

// ============================================================================
// Allocation Bot Loop
// ============================================================================

async fn run_allocation_loop(
    config: AllocationConfig,
    shutdown: Arc<AtomicBool>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut bot = AllocationBot::new(
        &config.rpc_url,
        &config.private_key,
        config.morpho_address,
        config.vault_address,
        config.market_ids.clone(),
        config.tier_configs.clone(),
    )?;

    info!(
        morpho = ?config.morpho_address,
        vault = ?config.vault_address,
        initial_markets = config.market_ids.len(),
        interval_secs = config.allocation_interval.as_secs(),
        "Curator allocation bot starting"
    );

    let mut cycle_count = 0u64;

    loop {
        if shutdown.load(Ordering::Relaxed) {
            info!("Shutdown requested, exiting allocation loop");
            break;
        }

        cycle_count += 1;

        // Detect new markets on each cycle
        match bot.detect_new_markets().await {
            Ok(new_count) if new_count > 0 => {
                info!(new_markets = new_count, "Added new markets from supply queue");
            }
            Err(e) => {
                warn!(error = %e, "Failed to detect new markets");
            }
            _ => {}
        }

        // Run allocation cycle
        match bot.run_allocation_cycle().await {
            Ok(report) => {
                if report.success {
                    if let Some(tx) = report.tx_hash {
                        info!(
                            cycle = cycle_count,
                            markets_analyzed = report.markets_analyzed,
                            tx_hash = ?tx,
                            "Allocation cycle completed successfully"
                        );
                    } else {
                        info!(
                            cycle = cycle_count,
                            markets_analyzed = report.markets_analyzed,
                            "Allocation cycle completed (no reallocation needed)"
                        );
                    }
                } else {
                    warn!(
                        cycle = cycle_count,
                        error = ?report.error,
                        "Allocation cycle failed"
                    );
                }
            }
            Err(e) => {
                error!(
                    cycle = cycle_count,
                    error = %e,
                    "Allocation cycle error"
                );
            }
        }

        tokio::time::sleep(config.allocation_interval).await;
    }

    info!("Curator allocation bot stopped");
    Ok(())
}

// ============================================================================
// Health Monitor Loop
// ============================================================================

async fn run_health_monitor_loop(
    config: HealthMonitorConfig,
    shutdown: Arc<AtomicBool>,
    alert_dispatcher: Option<Arc<RwLock<AlertDispatcher>>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut monitor = HealthMonitor::new(
        &config.rpc_url,
        &config.l3_rpc_url,
        config.morpho_address,
        config.vault_address,
        config.oracle_addresses.clone(),
        config.itp_addresses.clone(),
        config.mirror_registry_address,
        config.l3_registry_address,
        config.market_ids.clone(),
        config.alert_config.clone(),
    )?;

    if let Some(url) = &config.data_node_url {
        monitor.set_data_node_url(url.clone());
    }

    info!(
        morpho = ?config.morpho_address,
        vault = ?config.vault_address,
        oracles = config.oracle_addresses.len(),
        markets = config.market_ids.len(),
        interval_secs = config.scan_interval.as_secs(),
        "Curator health monitor starting"
    );

    let mut cycle_count = 0u64;

    loop {
        if shutdown.load(Ordering::Relaxed) {
            info!("Shutdown requested, exiting health monitor loop");
            break;
        }

        cycle_count += 1;

        match monitor.run_scan_cycle().await {
            Ok(report) => {
                let alert_count = report.alerts.len();
                let critical_count = report
                    .alerts
                    .iter()
                    .filter(|a| matches!(a.severity, Severity::Critical))
                    .count();

                // Dispatch alerts if dispatcher available
                if let Some(ref dispatcher) = alert_dispatcher {
                    dispatcher.write().await.process_report(&report).await;
                }

                if let Some(ref path) = config.report_path {
                    if let Err(e) = write_report_to_file(&report, Path::new(path)) {
                        error!(error = %e, "Failed to write health report to file");
                    } else {
                        info!(
                            cycle = cycle_count,
                            alerts = alert_count,
                            critical = critical_count,
                            positions = report.positions.len(),
                            crisis_levels = report.crisis_levels.len(),
                            path = %path,
                            "Health scan completed, report written"
                        );
                    }
                } else {
                    info!(
                        cycle = cycle_count,
                        alerts = alert_count,
                        critical = critical_count,
                        positions = report.positions.len(),
                        oracles = report.oracles.len(),
                        mirror_synced = report.mirror_sync.is_synced,
                        vault_util = %format!("{}%", report.vault_metrics.utilization_pct),
                        crisis_levels = report.crisis_levels.len(),
                        "Health scan completed"
                    );

                    for alert in &report.alerts {
                        if matches!(alert.severity, Severity::Critical) {
                            error!(
                                category = ?alert.category,
                                message = %alert.message,
                                "CRITICAL ALERT"
                            );
                        }
                    }
                }
            }
            Err(e) => {
                error!(
                    cycle = cycle_count,
                    error = %e,
                    "Health scan cycle error"
                );
            }
        }

        tokio::time::sleep(config.scan_interval).await;
    }

    info!("Curator health monitor stopped");
    Ok(())
}

// ============================================================================
// Health Monitor Loop with Shared State (for unified mode)
// ============================================================================

async fn run_health_monitor_loop_with_state(
    config: HealthMonitorConfig,
    shutdown: Arc<AtomicBool>,
    alert_dispatcher: Option<Arc<RwLock<AlertDispatcher>>>,
    shared_state: SharedCuratorState,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut monitor = HealthMonitor::new(
        &config.rpc_url,
        &config.l3_rpc_url,
        config.morpho_address,
        config.vault_address,
        config.oracle_addresses.clone(),
        config.itp_addresses.clone(),
        config.mirror_registry_address,
        config.l3_registry_address,
        config.market_ids.clone(),
        config.alert_config.clone(),
    )?;

    if let Some(url) = &config.data_node_url {
        monitor.set_data_node_url(url.clone());
    }

    info!(
        morpho = ?config.morpho_address,
        vault = ?config.vault_address,
        oracles = config.oracle_addresses.len(),
        markets = config.market_ids.len(),
        interval_secs = config.scan_interval.as_secs(),
        "Curator health monitor starting (with shared state)"
    );

    let mut cycle_count = 0u64;

    loop {
        if shutdown.load(Ordering::Relaxed) {
            info!("Shutdown requested, exiting health monitor loop");
            break;
        }

        cycle_count += 1;

        match monitor.run_scan_cycle().await {
            Ok(report) => {
                // Write crisis levels to shared state
                shared_state
                    .update_crisis_levels(report.crisis_levels.clone())
                    .await;

                let alert_count = report.alerts.len();
                let critical_count = report
                    .alerts
                    .iter()
                    .filter(|a| matches!(a.severity, Severity::Critical))
                    .count();

                if let Some(ref dispatcher) = alert_dispatcher {
                    dispatcher.write().await.process_report(&report).await;
                }

                if let Some(ref path) = config.report_path {
                    if let Err(e) = write_report_to_file(&report, Path::new(path)) {
                        error!(error = %e, "Failed to write health report to file");
                    }
                }

                info!(
                    cycle = cycle_count,
                    alerts = alert_count,
                    critical = critical_count,
                    positions = report.positions.len(),
                    crisis_levels = report.crisis_levels.len(),
                    "Health scan completed (shared state updated)"
                );
            }
            Err(e) => {
                error!(
                    cycle = cycle_count,
                    error = %e,
                    "Health scan cycle error"
                );
            }
        }

        tokio::time::sleep(config.scan_interval).await;
    }

    info!("Curator health monitor stopped");
    Ok(())
}

// ============================================================================
// Unified Mode — All Tasks Concurrent
// ============================================================================

async fn run_unified(args: CuratorArgs) -> Result<(), Box<dyn std::error::Error>> {
    // Build all configs from the same args
    // For unified mode, collector config may fail if not all fields are present.
    // That's fine — we'll skip tasks whose config is incomplete.

    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = shutdown.clone();

    tokio::spawn(async move {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
        warn!("Received Ctrl+C, initiating graceful shutdown of all tasks");
        shutdown_clone.store(true, Ordering::Relaxed);
    });

    // Set up alert dispatcher from CLI args
    let alerting_config = AlertingConfig {
        telegram_bot_token: args.telegram_bot_token.clone(),
        telegram_chat_id: args.telegram_chat_id.clone(),
    };
    let dispatcher = if alerting_config.has_telegram() {
        let alerter = TelegramAlerter::new(
            alerting_config.telegram_bot_token.clone(),
            alerting_config.telegram_chat_id.clone(),
        );
        Arc::new(RwLock::new(AlertDispatcher::new(Box::new(alerter))))
    } else {
        info!("No Telegram config, using log-based alerting");
        Arc::new(RwLock::new(AlertDispatcher::new(Box::new(LogAlerter))))
    };

    // Shared state for cross-task communication
    let shared_state = SharedCuratorState::new();

    let mut handles: Vec<tokio::task::JoinHandle<()>> = Vec::new();

    // Task 1: Oracle Collector (if config is valid)
    let collector_args = args.clone();
    if let Ok(config) = CuratorConfig::from_args(collector_args) {
        let sd = shutdown.clone();
        handles.push(tokio::spawn(async move {
            if let Err(e) = run_collector_loop(config, sd).await {
                error!(error = %e, "Collector task failed");
            }
        }));
        info!("Spawned: Oracle collector task");
    } else {
        info!("Skipping collector task (incomplete config)");
    }

    // Task 2: Allocation Bot (if config is valid)
    let alloc_args = args.clone();
    if let Ok(config) = AllocationConfig::from_args(alloc_args) {
        let sd = shutdown.clone();
        handles.push(tokio::spawn(async move {
            if let Err(e) = run_allocation_loop(config, sd).await {
                error!(error = %e, "Allocation task failed");
            }
        }));
        info!("Spawned: Allocation bot task");
    } else {
        info!("Skipping allocation task (incomplete config)");
    }

    // Task 3: Health Monitor (if config is valid)
    let health_args = args.clone();
    if let Ok(config) = HealthMonitorConfig::from_args(health_args) {
        let sd = shutdown.clone();
        let disp = Some(dispatcher.clone());
        let state_for_monitor = shared_state.clone();
        handles.push(tokio::spawn(async move {
            if let Err(e) = run_health_monitor_loop_with_state(config, sd, disp, state_for_monitor).await {
                error!(error = %e, "Health monitor task failed");
            }
        }));
        info!("Spawned: Health monitor + crisis detection task");
    } else {
        info!("Skipping health monitor task (incomplete config)");
    }

    // Task 4: Quote API HTTP Server
    {
        let api_keys: Vec<String> = args
            .quote_api_keys
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let state_for_quote = shared_state.clone();
        let listen_addr = args.quote_api_listen.clone();
        let market_configs_path = args.market_configs_path.clone();

        // Build rate push config if IRM address is provided
        let rate_push_config = if !args.curator_irm_address.is_empty() {
            match args.curator_irm_address.parse::<ethers::types::Address>() {
                Ok(irm_addr) => {
                    match args.effective_private_key() {
                        Ok(private_key) => {
                            let rpc_url = args.settlement_rpc_url.clone().unwrap_or(args.rpc_url.clone());
                            Some(curator::quote_server::RatePushConfig {
                                rpc_url,
                                private_key,
                                irm_address: irm_addr,
                            })
                        }
                        Err(e) => {
                            warn!(error = %e, "No private key for rate pushing, disabling");
                            None
                        }
                    }
                }
                Err(e) => {
                    warn!(error = %e, addr = %args.curator_irm_address, "Invalid CuratorRateIRM address, rate pushing disabled");
                    None
                }
            }
        } else {
            None
        };

        let sd = shutdown.clone();
        handles.push(tokio::spawn(async move {
            if let Err(e) = curator::quote_server::run_quote_api_server(
                &listen_addr,
                api_keys,
                market_configs_path,
                state_for_quote,
                rate_push_config,
                sd,
            )
            .await
            {
                error!(error = %e, "Quote API server failed");
            }
        }));
        info!(listen = %args.quote_api_listen, "Spawned: Quote API server");
    }

    // Task 5: Market Deployer (if config is valid — auto-deploys Morpho markets for new ITPs)
    if let Ok(config) = curator::config::MarketDeployerConfig::from_args(&args) {
        let sd = shutdown.clone();
        match curator::market_deployer::MarketDeployer::new(&config) {
            Ok(deployer) => {
                handles.push(tokio::spawn(async move {
                    deployer.run_loop(sd).await;
                }));
                info!("Spawned: Market deployer task (scan every {}s)", args.market_deploy_interval_secs);
            }
            Err(e) => {
                warn!(error = %e, "Market deployer initialization failed, skipping");
            }
        }
    } else {
        info!("Skipping market deployer task (incomplete config)");
    }

    if handles.is_empty() {
        error!("No tasks could be started — check configuration");
        return Err("No tasks configured".into());
    }

    info!(
        tasks = handles.len(),
        "Unified curator service running"
    );

    // Wait for all tasks (they'll exit on shutdown signal)
    for handle in handles {
        let _ = handle.await;
    }

    info!("Unified curator service stopped");
    Ok(())
}

// ============================================================================
// Main
// ============================================================================

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = CuratorArgs::parse();

    let log_level = args.log_level.clone();

    if args.unified_mode {
        // Unified Mode — all tasks concurrent
        setup_logging(&log_level)?;
        info!("Starting in Unified mode (all tasks concurrent)");

        if let Err(e) = run_unified(args).await {
            error!(error = %e, "Unified service error");
            std::process::exit(1);
        }
    } else if args.health_monitor_mode {
        // Health Monitor Mode (legacy)
        let config = HealthMonitorConfig::from_args(args)?;
        setup_logging(&log_level)?;

        info!("Starting in Health Monitor mode");

        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_clone = shutdown.clone();
        tokio::spawn(async move {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to install Ctrl+C handler");
            warn!("Received Ctrl+C, initiating shutdown");
            shutdown_clone.store(true, Ordering::Relaxed);
        });

        if let Err(e) = run_health_monitor_loop(config, shutdown, None).await {
            error!(error = %e, "Health monitor error");
            std::process::exit(1);
        }
    } else if args.allocation_mode {
        // Allocation Bot Mode (legacy)
        let config = AllocationConfig::from_args(args)?;
        setup_logging(&log_level)?;

        info!("Starting in Allocation Bot mode");

        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_clone = shutdown.clone();
        tokio::spawn(async move {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to install Ctrl+C handler");
            warn!("Received Ctrl+C, initiating shutdown");
            shutdown_clone.store(true, Ordering::Relaxed);
        });

        if let Err(e) = run_allocation_loop(config, shutdown).await {
            error!(error = %e, "Allocation bot error");
            std::process::exit(1);
        }
    } else {
        // Oracle Collector Mode (default, legacy)
        let config = CuratorConfig::from_args(args)?;
        setup_logging(&log_level)?;

        info!("Starting in Oracle Collector mode");

        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_clone = shutdown.clone();
        tokio::spawn(async move {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to install Ctrl+C handler");
            warn!("Received Ctrl+C, initiating shutdown");
            shutdown_clone.store(true, Ordering::Relaxed);
        });

        if let Err(e) = run_collector_loop(config, shutdown).await {
            error!(error = %e, "Curator service error");
            std::process::exit(1);
        }
    }

    Ok(())
}
