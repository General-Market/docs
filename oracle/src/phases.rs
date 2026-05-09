//! Phase execution functions for the oracle consensus cycle.
//!
//! Each function runs a specific phase of the oracle's consensus loop:
//! price updates, ITP creation, cross-chain buy/sell processing, rebalancing,
//! and mirror registry sync.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use oracle::bootstrap::OracleMetrics;
use oracle::bridge::Fill;
use oracle::PriceFetcher;
use tracing::{debug, info, warn, error};

use crate::helpers::{fill_price_respects_limit, is_snapshot_too_old_error, is_nonce_future_error, calculate_bridge_leader};

/// Known confirmFills error selectors that encode an orderId as their first ABI parameter.
///
/// Solidity errors whose first param is `uint256 orderId`:
///   E022_OrderNotFound(uint256)                             → 0x0cf46178
///   E023_FillExceedsOrder(uint256,uint256,uint256)          → 0xa1f4d58b
///   E024_InvalidOrderStatus(uint256,uint256,uint256)        → 0x6e6e29cb
///   E036_FillCycleMismatch(uint256,uint256)                 → 0xe6aac9f3
///   E126_FillPriceViolatesLimit(uint256,uint256,uint256,uint8) → 0xcbaa4cd6
///   E021_OrderAlreadyBatched(uint256)                       → 0x7a5425d1
const FILL_ERROR_SELECTORS: &[&str] = &[
    "0cf46178", // E022
    "a1f4d58b", // E023
    "6e6e29cb", // E024
    "e6aac9f3", // E036
    "cbaa4cd6", // E126
    "7a5425d1", // E021
];

/// Resolve an order mapping, rebuilding from Settlement on-chain state if the
/// in-memory mapping has been lost (e.g. after an oracle restart).
///
/// Oracle mappings live only in memory — a restart between submitOrder and
/// mintBridgedShares otherwise leaves the order permanently unmintable and
/// the user's USDC stranded. Settlement's getCrossChainOrder() returns the
/// original user, which is all we need to rebuild the mapping on demand.
async fn resolve_or_rebuild_mapping(
    orchestrator: &Arc<tokio::sync::RwLock<oracle::BridgeOrchestrator>>,
    settlement_reader: &Arc<dyn oracle::SettlementReader>,
    settlement_id: ethers::types::U256,
    l3_order_id: ethers::types::U256,
) -> Option<oracle::bridge::OrderMapping> {
    let initial = {
        let o = orchestrator.read().await;
        match o.get_order_mapping(&settlement_id).await {
            Some(m) => Some(m),
            None => o.get_mapping_by_l3_id(&l3_order_id).await,
        }
    };
    if let Some(m) = initial {
        return Some(m);
    }
    match settlement_reader.get_cross_chain_order(settlement_id).await {
        Ok(Some(data)) => {
            let rebuilt = oracle::bridge::OrderMapping {
                settlement_order_id: settlement_id,
                l3_order_id,
                original_user: data.user,
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            };
            info!(
                settlement_id = %settlement_id,
                l3_order_id = %l3_order_id,
                user = ?data.user,
                "Reconstructed order mapping from Settlement on-chain state"
            );
            orchestrator.write().await.store_order_mapping(rebuilt.clone()).await;
            Some(rebuilt)
        }
        Ok(None) => {
            // Settlement does not know this order — either L3-direct (user
            // called Index.submitOrder on L3 without going through the bridge;
            // Index.fillOrder will mint shares natively) or already completed
            // and removed from Settlement's map. Either way, no bridge-side
            // mint is possible. Return None; the caller skips mint for this
            // order while the batch/fills pipeline keeps running normally.
            debug!(order_id = %settlement_id, "Settlement has no record of this cross-chain order — skipping bridge mint (L3-direct or already settled)");
            None
        }
        Err(e) => {
            warn!(order_id = %settlement_id, error = %e, "Failed to read Settlement order for mapping reconstruction");
            None
        }
    }
}

/// Attempt to extract the offending orderId from a confirmFills revert string.
///
/// The error string from ethers typically contains the hex-encoded revert data,
/// e.g. `"execution reverted: 0x6e6e29cb<32-byte orderId>..."`. We locate a known
/// selector, then decode the next 32 hex chars (64 nibbles) as a U256 orderId.
///
/// Returns `None` if the error doesn't match any known fill selector or if the
/// orderId can't be parsed.
fn extract_order_id_from_fill_revert(err: &str) -> Option<ethers::types::U256> {
    for selector in FILL_ERROR_SELECTORS {
        if let Some(pos) = err.find(selector) {
            // orderId starts right after the 8-char selector
            let id_start = pos + selector.len();
            if err.len() >= id_start + 64 {
                let id_hex = &err[id_start..id_start + 64];
                if let Ok(bytes) = hex::decode(id_hex) {
                    return Some(ethers::types::U256::from_big_endian(&bytes));
                }
            }
        }
    }
    None
}

/// Price update task — fetches prices, runs price consensus, logs result.
/// Same pattern as every other task: detect work, propose, settle.
/// Returns `true` on consensus success, `false` on failure/timeout.
pub(crate) async fn run_price_update<P, W, K, PF>(
    protocol: Arc<oracle::ConsensusProtocol<P, W, K, PF>>,
    price_fetcher: Arc<dyn oracle::PriceFetcher>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    l3_writer: Option<Arc<dyn common::traits::ChainWriter>>,
    oracle_address: Option<ethers::types::Address>,
    itp_address: Option<ethers::types::Address>,
    chain_id: Option<u64>,
    known_assets: Vec<ethers::types::Address>,
    current_cycle: u64,
    metrics: Arc<oracle::bootstrap::OracleMetrics>,
    rpc_timestamp: Arc<std::sync::atomic::AtomicU64>,
    nav_fallback: ethers::types::U256,
) -> bool where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: oracle::KeyRegistry + Send + Sync + 'static,
    PF: oracle::PriceFetcher + Send + Sync + 'static,
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
        oracle::ConsensusResult::Success { signer_count, cycle_number, .. } => {
            // Same split as PriceAgreed below (see commit ee97857a): Success carries either a
            // real aggregated batch signature (signer_count > 0) or a follower-side placeholder
            // (signer_count == 0, zero-filled signature, no chain submission). Logging them
            // identically at INFO conflates a consensus event with a passive state observation.
            if signer_count > 0 {
                info!(cycle = cycle_number, signer_count, elapsed_ms, "Price consensus agreed — batch signature collected");
                metrics.record_consensus_result(true, signer_count, elapsed_ms);
            } else {
                debug!(
                    cycle = cycle_number,
                    elapsed_ms,
                    "Price consensus heartbeat — follower observed Complete phase (no signatures aggregated locally)"
                );
                // Follower passive observation — don't trip the stalled breaker.
                metrics.record_consensus_heartbeat(elapsed_ms);
            }
            rpc_timestamp.store(
                chrono::Utc::now().timestamp_millis() as u64,
                std::sync::atomic::Ordering::Relaxed,
            );
            true
        }
        oracle::ConsensusResult::Failed { ref reason, cycle_number } => {
            warn!(cycle = cycle_number, reason, elapsed_ms, "Price update failed");
            // Followers see Failed when they time out waiting for a leader-side
            // message. That's a system-level blip, not this oracle being stalled.
            // Leader-side failures go through Success with signer_count=0 above.
            metrics.record_consensus_failure(elapsed_ms);
            false
        }
        oracle::ConsensusResult::Timeout { ref phase, cycle_number } => {
            warn!(cycle = cycle_number, phase = %phase, elapsed_ms, "Price update timed out");
            metrics.record_consensus_failure(elapsed_ms);
            false
        }
        oracle::ConsensusResult::EmergencyPause { cycle_number } => {
            warn!(cycle = cycle_number, elapsed_ms, "Price update triggered pause (will retry next cycle)");
            metrics.record_consensus_failure(elapsed_ms);
            false
        }
        oracle::ConsensusResult::ItpCreated { .. } => { true } // won't happen for price cycle
        oracle::ConsensusResult::PriceAgreed { ref aggregated_signature, signer_count, signers_bitmask, cycle_number } => {
            // Two sub-cases hide behind PriceAgreed:
            //   (a) signer_count > 0 — a real NAV signature was aggregated and will be pushed on-chain.
            //   (b) signer_count == 0 — no ITPNAVOracle / itp_address configured for this deployment,
            //       so the leader returned a placeholder (zero-filled signature, no chain submission).
            // Logging them identically at INFO pretends both are the same event. They are not.
            if signer_count > 0 {
                info!(cycle = cycle_number, signer_count, elapsed_ms, "NAV consensus agreed — signature collected");
                metrics.record_consensus_result(true, signer_count, elapsed_ms);
            } else {
                debug!(
                    cycle = cycle_number,
                    elapsed_ms,
                    "Price consensus heartbeat — NAV signing skipped (ITPNAVOracle not configured on this deployment)"
                );
                // NAV-less heartbeat — don't trip the stalled breaker.
                metrics.record_consensus_heartbeat(elapsed_ms);
            }
            rpc_timestamp.store(
                chrono::Utc::now().timestamp_millis() as u64,
                std::sync::atomic::Ordering::Relaxed,
            );

            // Submit to oracle on L3 if configured and we have a real signature
            if let (Some(ref writer), Some(oracle_addr), Some(morpho_price)) = (&l3_writer, oracle_address, morpho_nav) {
                if signer_count > 0 {
                    let ref_nonce = protocol.registry_nonce();
                    let calldata = oracle::build_update_price_calldata(
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

pub(crate) async fn run_itp_creation_phase<P, W, K, PF>(
    protocol: Arc<oracle::ConsensusProtocol<P, W, K, PF>>,
    settlement_reader: Arc<dyn oracle::SettlementReader>,
    settlement_writer: Arc<oracle::SettlementChainWriter>,
    l3_writer: Option<Arc<oracle::EthersChainWriter>>,
    itp_config: oracle::ItpCreationConfig,
    current_cycle: u64,
    node_index: u8,
    num_oracles: u8,
    first_seen: Arc<tokio::sync::Mutex<std::collections::HashMap<ethers::types::U256, (std::time::Instant, u32)>>>,
    mirror_sync_needed: Arc<AtomicBool>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: oracle::KeyRegistry + Send + Sync + 'static,
    PF: oracle::PriceFetcher + Send + Sync + 'static,
{
    /// Max age before skipping a stale ITP creation request (1 hour)
    const MAX_REQUEST_AGE: std::time::Duration = std::time::Duration::from_secs(3600);
    /// Max creation requests to process per cycle (prevent Phase A from monopolizing)
    const MAX_CREATIONS_PER_CYCLE: usize = 2;
    /// Skip nonce after this many consecutive failures
    const CREATION_FAIL_THRESHOLD: u32 = 3;

    match settlement_reader.get_all_pending_requests().await {
        Ok(pending_requests) => {
            if !pending_requests.is_empty() {
                info!(cycle = current_cycle, count = pending_requests.len(), "Found pending ITP creation requests");

                let am_leader = calculate_bridge_leader(current_cycle, num_oracles, node_index);
                let mut processed_this_cycle = 0usize;

                for request in pending_requests {
                    if processed_this_cycle >= MAX_CREATIONS_PER_CYCLE {
                        debug!(cycle = current_cycle, "Reached max ITP creations per cycle, deferring rest");
                        break;
                    }

                    // Track first-seen time and failure count for staleness/skip detection
                    let (seen_at, fail_count) = {
                        let mut fs = first_seen.lock().await;
                        let entry = fs.entry(request.nonce).or_insert_with(|| (std::time::Instant::now(), 0));
                        (entry.0, entry.1)
                    };
                    if seen_at.elapsed() > MAX_REQUEST_AGE {
                        debug!(nonce = %request.nonce, age_secs = seen_at.elapsed().as_secs(),
                               "Skipping stale ITP creation request (>1h old)");
                        continue;
                    }
                    if fail_count >= CREATION_FAIL_THRESHOLD {
                        debug!(nonce = %request.nonce, fail_count,
                               "Skipping ITP creation request — exceeded failure threshold");
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
                                            // Increment failure count so we skip after threshold
                                            let mut fs = first_seen.lock().await;
                                            if let Some(entry) = fs.get_mut(&request.nonce) {
                                                entry.1 += 1;
                                                warn!(nonce = %request.nonce, fail_count = entry.1, threshold = CREATION_FAIL_THRESHOLD,
                                                      "ITP L3 write failure recorded");
                                            }
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
                                        protocol.settlement_registry_nonce(), result.signer_bitmap,
                                        RECEIPT_TIMEOUT_SECS,
                                    ).await {
                                        Ok(receipt) => {
                                            info!(nonce = %result.nonce, itp_id = ?itp_id, tx_hash = ?receipt.transaction_hash, "ITP creation confirmed on both L3 and Settlement");
                                        }
                                        Err(e) => {
                                            let err_str = format!("{}", e);
                                            error!(nonce = %result.nonce, error = %e, "Failed to complete ITP creation on Settlement (L3 succeeded)");
                                            // Increment failure count for Settlement failures too (prevents infinite retry loop)
                                            {
                                                let mut fs = first_seen.lock().await;
                                                if let Some(entry) = fs.get_mut(&request.nonce) {
                                                    entry.1 += 1;
                                                    warn!(nonce = %request.nonce, fail_count = entry.1, threshold = CREATION_FAIL_THRESHOLD,
                                                          "ITP Settlement write failure recorded");
                                                }
                                            }
                                            // If SnapshotTooOld, signal mirror sync needed
                                            if is_snapshot_too_old_error(&err_str) {
                                                warn!(nonce = %request.nonce, "ITP creation hit SnapshotTooOld — requesting mirror sync");
                                                mirror_sync_needed.store(true, std::sync::atomic::Ordering::Release);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            warn!(nonce = %request.nonce, error = %e, "ITP creation consensus failed");
                        }
                    }
                    processed_this_cycle += 1;
                }
            }
        }
        Err(e) => {
            warn!(cycle = current_cycle, error = %e, "Failed to get pending ITP creation requests");
        }
    }
}

pub(crate) async fn run_cross_chain_processing<P, W, K, PF>(
    protocol: Arc<oracle::ConsensusProtocol<P, W, K, PF>>,
    settlement_reader: Arc<dyn oracle::SettlementReader>,
    orchestrator: Arc<tokio::sync::RwLock<oracle::BridgeOrchestrator>>,
    settlement_writer: Arc<oracle::SettlementChainWriter>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_oracles: u8,
    data_node_url_for_task: Option<String>,
    itp_id_for_task: String,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
    block_cursor: Arc<std::sync::atomic::AtomicU64>,
    _bridge_post_ready: Arc<AtomicBool>,
    startup_buy_orders: Arc<tokio::sync::Mutex<Vec<common::types::CrossChainOrder>>>,
    mirror_sync_needed: Arc<AtomicBool>,
    mirror_registry_addr: Option<ethers::types::Address>,
    metrics: Arc<OracleMetrics>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: oracle::KeyRegistry + Send + Sync + 'static,
    PF: oracle::PriceFetcher + Send + Sync + 'static,
{
    let confirmed_block = match settlement_reader.get_confirmed_block().await {
        Ok(block) => block,
        Err(e) => { warn!(cycle = current_cycle, error = %e, "Failed to get confirmed block"); return; }
    };

    if confirmed_block == 0 {
        info!(cycle = current_cycle, "Cross-chain detection: confirmed_block=0, skipping");
        return;
    }

    // Use cursor for incremental scanning (fallback: 10000 blocks back on first run ~2h on Sonic).
    // Must be generous — a restart that misses in-flight orders leaves them stuck permanently.
    let cursor_val = block_cursor.load(Ordering::Relaxed);
    let from_block = if cursor_val > 0 { cursor_val } else { confirmed_block.saturating_sub(10_000) };
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

            // Merge startup-discovered orders (retry until processed)
            // Orders are only removed from the queue when the orchestrator has
            // recorded their status (meaning consensus succeeded and the order
            // was submitted to L3). Unprocessed orders stay for the next cycle.
            {
                let mut startup = startup_buy_orders.lock().await;
                if !startup.is_empty() {
                    let orch = orchestrator.read().await;
                    let mut keep = Vec::new();
                    let mut injected = 0u32;
                    for order in startup.drain(..) {
                        if orch.get_order_status(&order.order_id).await.is_some() {
                            // Already processed — drop from queue
                            continue;
                        }
                        if order.deadline.as_u64() > 0 && order.deadline.as_u64() < now_secs {
                            // Expired — drop from queue
                            continue;
                        }
                        new_orders.push(order.clone());
                        keep.push(order);
                        injected += 1;
                    }
                    if injected > 0 {
                        info!(count = injected, "Injecting startup-discovered buy orders into pipeline (retained for retry)");
                    }
                    // Put unprocessed orders back for the next cycle
                    *startup = keep;
                }
            }

            // Deduplicate by order_id (event scan + startup injection may overlap)
            new_orders.sort_by_key(|o| o.order_id);
            new_orders.dedup_by_key(|o| o.order_id);

            metrics.update_pending_order_count(new_orders.len() as u64);

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
                        orch_write.set_order_status(order.order_id, oracle::BridgeOrderStatus::Pending).await;
                    }
                }

                let chain_id = settlement_reader.chain_id();
                // Track which orders successfully complete Phase 1 (submitOrder)
                let mut just_submitted_ids: Vec<ethers::types::U256> = Vec::new();
                // Process orders SEQUENTIALLY to avoid P2P consensus contention.
                // When multiple bridge proposals are in-flight simultaneously, leaders
                // time out because followers are also busy being leaders for other orders.
                for order in new_orders {
                    let am_leader = calculate_bridge_leader(order.order_id.as_u64(), num_oracles, node_index);
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
                                        orch_w.store_order_mapping(oracle::bridge::OrderMapping {
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
                                            orch_w.set_order_status(order.order_id, oracle::BridgeOrderStatus::SubmittedOnL3).await;
                                            orch_w.set_order_amount(order.order_id, order.amount).await;
                                            let l3_id = submit_result.l3_order_id.unwrap_or(order.order_id);
                                            orch_w.store_order_mapping(oracle::bridge::OrderMapping {
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
                                        metrics.record_orders_processed(1);
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
                        num_oracles,
                        data_node_url_for_task.clone(),
                        itp_id_for_task.clone(),
                        local_nav_fallback,
                        quote_tokens.clone(),
                        Some(just_submitted_ids),
                        mirror_sync_needed.clone(),
                        mirror_registry_addr,
                        metrics.clone(),
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
pub(crate) async fn run_cross_chain_buy_post_processing<P, W, K, PF>(
    protocol: Arc<oracle::ConsensusProtocol<P, W, K, PF>>,
    settlement_reader: Arc<dyn oracle::SettlementReader>,
    orchestrator: Arc<tokio::sync::RwLock<oracle::BridgeOrchestrator>>,
    settlement_writer: Arc<oracle::SettlementChainWriter>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_oracles: u8,
    _data_node_url_for_task: Option<String>,
    itp_id_for_task: String,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
    target_orders: Option<Vec<ethers::types::U256>>,
    mirror_sync_needed: Arc<AtomicBool>,
    mirror_registry_addr: Option<ethers::types::Address>,
    _metrics: Arc<OracleMetrics>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: oracle::KeyRegistry + Send + Sync + 'static,
    PF: oracle::PriceFetcher + Send + Sync + 'static,
{
    // Process batch for SubmittedOnL3 orders
    info!("Scanning for L3 pending orders...");
    let mut submitted_orders = if let Some(ref targets) = target_orders {
        // Inline path: only process the just-submitted orders (prevents stale L3-native orders
        // from poisoning the batch — their L3 IDs can collide with settlement order IDs).
        targets.clone()
    } else {
        // Recovery path: process all SubmittedOnL3 orders from bridge
        let bridge_orders = {
            let o = orchestrator.read().await;
            o.get_submitted_bridged_orders().await
        };
        if !bridge_orders.is_empty() {
            // Process bridge orders, but ALSO check for L3 direct orders
            let mut all_orders = bridge_orders;
            if let Ok(pending) = chain_reader.get_pending_orders().await {
                if !pending.is_empty() {
                    info!(count = pending.len(), "Also found L3 direct pending orders alongside bridge orders");
                    let mut orch = orchestrator.write().await;
                    for order in &pending {
                        orch.set_order_itp_id(order.id, order.itp_id).await;
                        orch.set_order_amount(order.id, order.amount).await;
                        let side_u8 = match order.side { common::types::Side::Buy => 0u8, common::types::Side::Sell => 1u8 };
                        orch.set_order_limit_price(order.id, order.limit_price, side_u8).await;
                    }
                    let ids: Vec<ethers::types::U256> = pending.iter().map(|o| o.id).collect();
                    all_orders.extend(ids);
                }
            }
            all_orders
        } else {
            // No bridge orders — scan for L3 direct orders
            info!("Scanning for L3 pending orders...");
            match chain_reader.get_pending_orders().await {
                Ok(orders) if !orders.is_empty() => {
                    let ids: Vec<ethers::types::U256> = orders.iter().map(|o| o.id).collect();
                    info!(count = ids.len(), "Found L3 direct pending orders");
                    {
                        let mut orch = orchestrator.write().await;
                        for order in &orders {
                            orch.set_order_itp_id(order.id, order.itp_id).await;
                            orch.set_order_amount(order.id, order.amount).await;
                            let side_u8 = match order.side { common::types::Side::Buy => 0u8, common::types::Side::Sell => 1u8 };
                            orch.set_order_limit_price(order.id, order.limit_price, side_u8).await;
                        }
                    }
                    ids
                }
                Ok(_) => {
                    // Check for stranded batched orders
                    match chain_reader.get_batched_orders().await {
                        Ok(orders) if !orders.is_empty() => {
                            let ids: Vec<ethers::types::U256> = orders.iter().map(|o| o.id).collect();
                            info!(count = ids.len(), "Recovering stranded Batched orders");
                            {
                                let mut orch = orchestrator.write().await;
                                for order in &orders {
                                    orch.set_order_itp_id(order.id, order.itp_id).await;
                                    orch.set_order_amount(order.id, order.amount).await;
                                    let side_u8 = match order.side { common::types::Side::Buy => 0u8, common::types::Side::Sell => 1u8 };
                                    orch.set_order_limit_price(order.id, order.limit_price, side_u8).await;
                                }
                            }
                            ids
                        }
                        _ => Vec::new(),
                    }
                }
                Err(e) => {
                    warn!(error = %e, "Failed to scan L3 pending orders");
                    Vec::new()
                }
            }
        }
    };

    info!(found = submitted_orders.len(), "L3 pending order scan complete");

    // Recovery path can discover 100+ orders. Cap per-cycle work to 100 — the rest will be
    // picked up on subsequent settlement_poll_due ticks.
    if submitted_orders.len() > 100 {
        info!(total = submitted_orders.len(), "Limiting batch to 100 orders per cycle");
        submitted_orders.truncate(100);
    }

    // Filter out orders already batched/filled/cancelled on-chain.
    // The data-node cache can lag — verify via the trait's on-chain status check.
    {
        let pre = submitted_orders.len();
        let mut keep = Vec::new();
        for oid in &submitted_orders {
            match chain_reader.get_order_on_chain_status(*oid).await {
                Some(0) => keep.push(*oid),
                Some(s) => info!(order_id = %oid, on_chain_status = s, "Skipping already-processed order"),
                None => keep.push(*oid),
            }
        }
        if keep.len() < pre {
            info!(before = pre, after = keep.len(), "Filtered stale orders");
        }
        submitted_orders = keep;
    }

    // Previous code filtered out orders the local orchestrator had marked
    // Failed (per-order fill-revert eviction, e.g. E126 limit-price violation).
    // The intent was a gas-estimation optimization. The effect was a silent
    // consensus break: a Failed mark is *local*, not replicated over P2P, so
    // when the marking node happened to be the deterministic batch leader for
    // those orders, its `submitted_orders` emptied here and it returned at
    // the early-empty check below — never reaching the leader-eligibility
    // computation, never proposing the batch, while the other two oracles
    // sat at `am_leader=false` waiting forever.
    //
    // The on-chain status is the only ledger every node can agree on. We
    // burn a few gas-estimation rounds on doomed orders until their on-chain
    // state changes; that is cheaper than a wedged pipeline. If gas savings
    // become a real cost, replicate the Failed decision over consensus
    // instead of letting one node quarantine an order silently.


    if submitted_orders.is_empty() {
        debug!("No L3 orders to process");
        return;
    }

    info!(count = submitted_orders.len(), "Processing L3 orders");

    {
        // Resolve Settlement order IDs → L3 order IDs for BLS hash and on-chain calls.
        // The contract uses L3 IDs, so the BLS hash must match.
        // On the leader, resolve_l3_order_ids uses stored mappings.
        // On followers, it falls back to settlement IDs (but followers don't create proposals —
        // they receive L3 IDs from the leader's P2P broadcast and sign those).
        let mut l3_order_ids = {
            let o = orchestrator.read().await;
            o.resolve_l3_order_ids(&submitted_orders).await
        };

        // Re-check L3 on-chain status with the resolved L3 IDs. The earlier filter
        // (line ~786) checks via settlement IDs, which silently fails on ABI
        // mismatches and lets terminal-status orders survive into confirmFills,
        // where they revert with E024_InvalidOrderStatus. All three oracles see
        // the same L3 chain state, so no leader-silence wedge: empty after the
        // filter is empty for everyone, and consensus stays in lockstep.
        if !l3_order_ids.is_empty() {
            let pre = submitted_orders.len();
            let mut keep_settlement: Vec<ethers::types::U256> = Vec::with_capacity(pre);
            let mut keep_l3: Vec<ethers::types::U256> = Vec::with_capacity(pre);
            for (settlement_id, l3_id) in submitted_orders.iter().zip(l3_order_ids.iter()) {
                match chain_reader.get_order_on_chain_status(*l3_id).await {
                    Some(0) => {
                        keep_settlement.push(*settlement_id);
                        keep_l3.push(*l3_id);
                    }
                    Some(s) => info!(
                        l3_order_id = %l3_id,
                        settlement_order_id = %settlement_id,
                        on_chain_status = s,
                        "Dropping non-PENDING L3 order from batch (post-resolve)"
                    ),
                    None => {
                        keep_settlement.push(*settlement_id);
                        keep_l3.push(*l3_id);
                    }
                }
            }
            if keep_settlement.len() < pre {
                info!(
                    before = pre,
                    after = keep_settlement.len(),
                    "Filtered terminal-status L3 orders post-resolve"
                );
                submitted_orders = keep_settlement;
                l3_order_ids = keep_l3;
            }
        }

        if submitted_orders.is_empty() {
            debug!("All L3 orders filtered as terminal — nothing to confirm");
            return;
        }

        // Reverse lookup: L3 ID → Settlement ID (for post-fill operations that need Settlement IDs)
        let l3_to_settlement: std::collections::HashMap<ethers::types::U256, ethers::types::U256> =
            l3_order_ids.iter().zip(submitted_orders.iter()).map(|(l3, settlement)| (*l3, *settlement)).collect();

        info!(
            cycle = current_cycle,
            settlement_order_ids = ?submitted_orders.iter().map(|id| id.as_u64()).collect::<Vec<_>>(),
            l3_order_ids = ?l3_order_ids.iter().map(|id| id.as_u64()).collect::<Vec<_>>(),
            "Resolved Settlement→L3 order IDs for batch/fills"
        );

        // Use order-based leader election (same node as submit leader, which has the settlement→L3 mapping).
        // Use min() not .first() — chain reads can return the same set in different
        // orders on different nodes, and disagreement on the first element means
        // disagreement on the leader. min() is order-independent over a set.
        let batch_key = submitted_orders.iter().map(|id| id.as_u64()).min().unwrap_or(current_cycle);
        let batch_am_leader = calculate_bridge_leader(batch_key, num_oracles, node_index);
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
                    // Honest log: distinguish leader-on-chain-success, leader-failure (no signatures),
                    // and follower-voted. The previous unconditional "Batch confirmation completed"
                    // hid every leader cycle that gathered zero signatures, making weeks-long stalls
                    // invisible. See backlog 20260415 task #16.
                    if !batch_am_leader {
                        debug!(cycle = current_cycle, "Follower: batch vote forwarded");
                    } else if batch_result.signature_count == 0 {
                        warn!(
                            cycle = current_cycle,
                            "Leader: batch confirmation gathered zero signatures — no on-chain tx submitted"
                        );
                    } else {
                        info!(
                            cycle = current_cycle,
                            signer_count = batch_result.signature_count,
                            "Leader: batch confirmation submitted on-chain"
                        );
                    }
                    true
                }
                Err(e) => {
                    let err_str = format!("{}", e);
                    if err_str.contains("E021") || err_str.contains("7a5425d1") || err_str.contains("AlreadyBatched") {
                        info!(cycle = current_cycle, "Orders already batched (E021), proceeding to CBO/fills");
                        true
                    } else {
                        if is_snapshot_too_old_error(&err_str) {
                            warn!(cycle = current_cycle, "Buy batch hit SnapshotTooOld — requesting immediate mirror sync");
                            mirror_sync_needed.store(true, Ordering::Release);
                        } else {
                            warn!(cycle = current_cycle, error = %e, "Batch confirmation failed");
                        }
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
                    orch.set_order_status(*oid, oracle::BridgeOrderStatus::Batched).await;
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

            // completeBuyOrder: only needed for bridge orders (USDC on Settlement).
            // L3 direct orders lock USDC atomically in submitOrder — CBO is unnecessary.
            let is_l3_direct = target_orders.is_none() && {
                let o = orchestrator.read().await;
                o.get_submitted_bridged_orders().await.is_empty()
            };
            // Outcome of a per-order CBO attempt. Separates transient (retryable)
            // failures from permanent ones so we don't mark a recoverable order
            // terminal Failed when the mirror snapshot is stale.
            enum CboOutcome {
                Confirmed,
                NeedsRetry,
                Failed,
            }
            let cbo_confirmed_orders: Vec<ethers::types::U256> = if is_l3_direct {
                info!(cycle = current_cycle, count = submitted_orders.len(),
                    "L3 direct orders: skipping completeBuyOrder (USDC locked atomically)");
                submitted_orders.clone()
            } else {
                let vault = orchestrator.read().await.config().bitget_vault;
                let mut confirmed = Vec::new();
                for order_id in &submitted_orders {
                    info!(order_id = %order_id, "Starting order processing");
                    let order_result = tokio::time::timeout(
                        std::time::Duration::from_secs(20),
                        async {
                            match protocol.run_complete_buy_order_phase(
                                current_cycle, *order_id, vault, batch_am_leader,
                            ).await {
                                Ok(cbo_result) => {
                                    info!(cycle = current_cycle, order_id = %order_id, signer_count = cbo_result.signature_count, "CompleteBuyOrder consensus completed");
                                    if batch_am_leader && !cbo_result.aggregated_signature.0.is_empty() {
                                        match settlement_writer.complete_buy_order(*order_id, vault, cbo_result.aggregated_signature.0.clone(), protocol.settlement_registry_nonce(), cbo_result.signer_bitmap).await {
                                            Ok(tx_hash) => {
                                                info!(?tx_hash, order_id = %order_id, "completeBuyOrder submitted, waiting for receipt");
                                                const RECEIPT_TIMEOUT_SECS: u64 = 15;
                                                match settlement_writer.wait_for_receipt(tx_hash, RECEIPT_TIMEOUT_SECS).await {
                                                    Ok(receipt) => {
                                                        let success = receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false);
                                                        if success {
                                                            info!(?tx_hash, order_id = %order_id, "completeBuyOrder CONFIRMED");
                                                            return CboOutcome::Confirmed;
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
                                                    return CboOutcome::Confirmed;
                                                } else if is_snapshot_too_old_error(&err_str) {
                                                    // Mirror snapshot is stale. Trigger immediate sync so the next
                                                    // retry attempt will find a fresh snapshot. The order is left in
                                                    // its current (Batched) status — the watchdog will re-drive CBO
                                                    // after the sync lands, rather than marking it terminal Failed.
                                                    warn!(order_id = %order_id, "completeBuyOrder hit SnapshotTooOld — requesting immediate mirror sync, order will be retried");
                                                    mirror_sync_needed.store(true, Ordering::Release);
                                                    return CboOutcome::NeedsRetry;
                                                } else if is_nonce_future_error(&err_str) {
                                                    // The oracle's cached settlement_registry_nonce has drifted ahead
                                                    // of the mirror's lastSnapshotNonce. Correct the cache from an
                                                    // authoritative on-chain read, flag the next mirror sync, and
                                                    // retry. Without this the order would be marked terminal Failed
                                                    // and the user's Settlement USDC would be permanently locked.
                                                    warn!(order_id = %order_id, "completeBuyOrder hit NonceFuture — correcting cached registry nonce from on-chain");
                                                    if let Some(mirror_addr) = mirror_registry_addr {
                                                        let lsn_selector = &ethers::utils::keccak256(b"lastSnapshotNonce()")[..4];
                                                        match settlement_writer.static_call(mirror_addr, lsn_selector.to_vec()).await {
                                                            Ok(bytes) if bytes.len() >= 32 => {
                                                                let on_chain = ethers::types::U256::from_big_endian(&bytes[..32]).as_u64();
                                                                let cached = protocol.settlement_registry_nonce();
                                                                protocol.reset_settlement_registry_nonce(on_chain);
                                                                info!(order_id = %order_id, cached, on_chain, "Registry nonce cache corrected");
                                                            }
                                                            Ok(_) => warn!(order_id = %order_id, "Unexpected response length reading mirror lastSnapshotNonce"),
                                                            Err(rd) => warn!(order_id = %order_id, error = %rd, "Failed to re-read mirror lastSnapshotNonce"),
                                                        }
                                                    } else {
                                                        warn!(order_id = %order_id, "No mirror registry address configured — cannot correct cache");
                                                    }
                                                    mirror_sync_needed.store(true, Ordering::Release);
                                                    return CboOutcome::NeedsRetry;
                                                } else {
                                                    warn!(error = %e, order_id = %order_id, "completeBuyOrder failed — will NOT mint");
                                                }
                                            }
                                        }
                                    } else if !batch_am_leader {
                                        // Followers trust consensus — if consensus succeeded, CBO is confirmed
                                        return CboOutcome::Confirmed;
                                    }
                                }
                                Err(e) => warn!(error = %e, order_id = %order_id, "CompleteBuyOrder consensus failed — will NOT mint"),
                            }
                            CboOutcome::Failed
                        }
                    ).await;
                    match order_result {
                        Ok(CboOutcome::Confirmed) => {
                            info!(order_id = %order_id, "Order processed successfully");
                            confirmed.push(*order_id);
                        }
                        Ok(CboOutcome::NeedsRetry) => {
                            // Transient failure (stale BLS mirror snapshot). Don't mark Failed.
                            // The mirror_sync_needed flag will trigger an immediate sync,
                            // and the watchdog will re-drive this order on the next cycle.
                            info!(order_id = %order_id, "completeBuyOrder transient failure — will retry after mirror sync");
                        }
                        Ok(CboOutcome::Failed) => {
                            // CBO reverted/failed/timed-out — no retry path exists.
                            // Mark Failed immediately to prevent stale in-flight status
                            // from triggering a WorkDriven feedback loop.
                            warn!(order_id = %order_id, "completeBuyOrder not confirmed — marking Failed");
                            let orch = orchestrator.write().await;
                            orch.mark_orders_failed(&[*order_id]).await;
                            drop(orch);
                        }
                        Err(_) => {
                            warn!(order_id = %order_id, "Order processing timed out — marking Failed");
                            let orch = orchestrator.write().await;
                            orch.mark_orders_failed(&[*order_id]).await;
                            drop(orch);
                        }
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
            // Retry loop: on per-order revert, remove the offending order and re-run
            // BLS consensus with the remaining fills. Max 3 retries to bound the cost
            // of pathological batches where multiple orders are independently broken.
            const MAX_FILL_RETRIES: usize = 3;
            let mut remaining_fills = fills.clone();
            let mut retry_count = 0usize;

            loop {
                if remaining_fills.is_empty() {
                    warn!(cycle = current_cycle, "No fills left after evictions — nothing to confirm");
                    break;
                }

                match protocol.run_fills_confirm_phase(current_cycle, remaining_fills.clone(), batch_am_leader).await {
                    Ok(fills_result) => {
                        if !batch_am_leader {
                            debug!(
                                cycle = current_cycle,
                                fill_count = remaining_fills.len(),
                                "Follower: fills vote forwarded"
                            );
                        } else if fills_result.signature_count == 0 {
                            warn!(
                                cycle = current_cycle,
                                retries = retry_count,
                                fill_count = remaining_fills.len(),
                                "Leader: fills confirmation gathered zero signatures — no on-chain tx submitted"
                            );
                        } else {
                            info!(
                                cycle = current_cycle,
                                signer_count = fills_result.signature_count,
                                retries = retry_count,
                                fill_count = remaining_fills.len(),
                                "Leader: fills confirmed on-chain"
                            );
                        }
                        // Mint BridgedITP shares on Settlement (using each order's actual itp_id)
                        {
                            let bridge_proxy = orchestrator.read().await.config().bridge_proxy;
                            for fill in &remaining_fills {
                                // Look up original user from order mapping (using Settlement ID)
                                let settlement_id = l3_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                let order_itp = orchestrator.read().await.get_order_itp_id(&settlement_id).await
                                    .unwrap_or_else(|| itp_id_for_task.parse::<ethers::types::H256>().unwrap_or_default());
                                let mapping = resolve_or_rebuild_mapping(&orchestrator, &settlement_reader, settlement_id, fill.order_id).await;
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
                                            if !batch_am_leader {
                                                debug!(cycle = current_cycle, user = ?mapping.original_user, "Follower: MintBridgedShares vote forwarded");
                                            } else if mint_result.signature_count == 0 {
                                                warn!(cycle = current_cycle, user = ?mapping.original_user, shares = %shares, "Leader: MintBridgedShares gathered zero signatures — no on-chain tx submitted");
                                            } else {
                                                info!(cycle = current_cycle, user = ?mapping.original_user, shares = %shares, signer_count = mint_result.signature_count, "Leader: MintBridgedShares signed");
                                            }
                                            // Only LEADER marks SharesBridged after confirmed receipt
                                            if batch_am_leader && !mint_result.aggregated_signature.0.is_empty() {
                                                match settlement_writer.mint_bridged_shares(order_itp, mapping.original_user, shares, settlement_id, mint_result.aggregated_signature.0.clone(), protocol.settlement_registry_nonce(), mint_result.signer_bitmap).await {
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
                                                        } else if is_nonce_future_error(&err_str) {
                                                            warn!(order_id = %settlement_id, "mintBridgedShares hit NonceFuture — correcting cached registry nonce from on-chain");
                                                            if let Some(mirror_addr) = mirror_registry_addr {
                                                                let lsn_selector = &ethers::utils::keccak256(b"lastSnapshotNonce()")[..4];
                                                                if let Ok(bytes) = settlement_writer.static_call(mirror_addr, lsn_selector.to_vec()).await {
                                                                    if bytes.len() >= 32 {
                                                                        let on_chain = ethers::types::U256::from_big_endian(&bytes[..32]).as_u64();
                                                                        let cached = protocol.settlement_registry_nonce();
                                                                        protocol.reset_settlement_registry_nonce(on_chain);
                                                                        info!(order_id = %settlement_id, cached, on_chain, "Registry nonce cache corrected (mint path)");
                                                                    }
                                                                }
                                                            }
                                                            mirror_sync_needed.store(true, Ordering::Release);
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
                                    debug!(order_id = %fill.order_id, "No order mapping — skipping bridge mint (L3-direct order: shares minted natively by Index.fillOrder)");
                                }
                            }
                        }

                        // Emit asset trades with a 15s timeout — not fire-and-forget but won't block
                        // the buy pipeline indefinitely if BLS consensus stalls.
                        {
                            let p = protocol.clone();
                            let cr = chain_reader.clone();
                            let qt = quote_tokens.clone();
                            let at = asset_trade_orders.clone();
                            match tokio::time::timeout(
                                std::time::Duration::from_secs(15),
                                p.run_asset_trades_phase(current_cycle, &at, &cr, batch_am_leader, qt.as_ref()),
                            ).await {
                                Ok(Ok(at_result)) => {
                                    if !batch_am_leader {
                                        debug!(cycle = current_cycle, "Follower: asset trades vote forwarded");
                                    } else if at_result.signature_count == 0 {
                                        warn!(cycle = current_cycle, "Leader: asset trades phase gathered zero signatures — no AssetTradeRequest emitted");
                                    } else {
                                        info!(cycle = current_cycle, signer_count = at_result.signature_count, "Leader: asset trades emitted on-chain");
                                    }
                                }
                                Ok(Err(e)) => warn!(cycle = current_cycle, error = %e, "Asset trades emission failed"),
                                Err(_) => warn!(cycle = current_cycle, "Asset trades emission timed out after 15s"),
                            }
                        }

                        break; // success — exit retry loop
                    }
                    Err(e) => {
                        let fills_err = format!("{}", e);
                        // Determine if we should proceed to mint:
                        // 1. Chain revert (already filled): 0x6e6e29cb / "already" / "reverted on-chain"
                        // 2. BLS timeout: fills loop likely filled the order concurrently
                        let is_already_filled = fills_err.contains("6e6e29cb") || fills_err.contains("already") || fills_err.contains("reverted on-chain");
                        let is_timeout = fills_err.contains("signing timeout");
                        let is_fill_exceeds = fills_err.contains("a1f4d58b") || fills_err.contains("FillExceedsOrder") || fills_err.contains("E023");
                        let is_already_batched = fills_err.contains("7a5425d1") || fills_err.contains("OrderAlreadyBatched") || fills_err.contains("E021");

                        // Per-order fill error: extract the offending orderId from revert data,
                        // evict it, mark it failed, and retry confirmFills with the survivors.
                        // This catches E022 (not found), E024 (wrong status), E036 (cycle mismatch),
                        // E126 (price violates limit), as well as E023/E021 when we can isolate
                        // which order triggered it.
                        let is_fill_error = FILL_ERROR_SELECTORS.iter().any(|sel| fills_err.contains(sel))
                            || fills_err.contains("E022") || fills_err.contains("E024")
                            || fills_err.contains("E036") || fills_err.contains("E126")
                            || fills_err.contains("OrderNotFound") || fills_err.contains("InvalidOrderStatus")
                            || fills_err.contains("FillCycleMismatch") || fills_err.contains("FillPriceViolatesLimit");

                        if is_fill_error && retry_count < MAX_FILL_RETRIES {
                            // Try to identify the specific bad order from revert data
                            let bad_order_id = extract_order_id_from_fill_revert(&fills_err);

                            if let Some(bad_id) = bad_order_id {
                                let prev_count = remaining_fills.len();
                                remaining_fills.retain(|f| f.order_id != bad_id);
                                let evicted = prev_count - remaining_fills.len();

                                if evicted == 0 {
                                    // Parsed orderId doesn't match any fill in the batch.
                                    // Treat as unparseable — mark all failed to avoid infinite loop.
                                    warn!(
                                        cycle = current_cycle,
                                        bad_order = %bad_id,
                                        "Extracted orderId not in fills batch — marking all failed: {}",
                                        fills_err
                                    );
                                    let orch = orchestrator.write().await;
                                    let all_ids: Vec<ethers::types::U256> = remaining_fills.iter().map(|f| f.order_id).collect();
                                    orch.mark_orders_failed(&all_ids).await;
                                    break;
                                }

                                warn!(
                                    cycle = current_cycle,
                                    bad_order = %bad_id,
                                    retry = retry_count,
                                    evicted = evicted,
                                    remaining = remaining_fills.len(),
                                    "Per-order fill revert — evicting bad order and retrying: {}",
                                    fills_err
                                );

                                // Mark the bad order as failed so it won't be retried in future cycles
                                let orch = orchestrator.write().await;
                                orch.mark_orders_failed(&[bad_id]).await;
                                drop(orch);
                            } else {
                                // Revert matched a fill error selector but we couldn't parse the orderId.
                                // Fall through to terminal handling — mark all and stop.
                                warn!(
                                    cycle = current_cycle,
                                    retry = retry_count,
                                    "Fill revert detected but orderId not parseable — marking all failed: {}",
                                    fills_err
                                );
                                let orch = orchestrator.write().await;
                                let all_ids: Vec<ethers::types::U256> = remaining_fills.iter().map(|f| f.order_id).collect();
                                orch.mark_orders_failed(&all_ids).await;
                                break;
                            }

                            retry_count += 1;
                            continue; // retry with reduced fills
                        } else if is_fill_exceeds || is_already_batched {
                            let order_ids: Vec<String> = remaining_fills.iter().map(|f| f.order_id.to_string()).collect();
                            warn!(
                                cycle = current_cycle,
                                orders = ?order_ids,
                                fill_exceeds = is_fill_exceeds,
                                already_batched = is_already_batched,
                                "Terminal fill error — marking orders failed and skipping: {}",
                                fills_err
                            );
                            // Mark these orders as terminal so they are not retried
                            let orch = orchestrator.write().await;
                            let terminal_ids: Vec<ethers::types::U256> = remaining_fills.iter().map(|f| f.order_id).collect();
                            orch.mark_orders_failed(&terminal_ids).await;
                            // Continue processing remaining orders — do not retry these
                        } else if is_already_filled || is_timeout {
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
                                            let all_filled = remaining_fills.iter().all(|f| !batched_ids.contains(&f.order_id));
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
                                for fill in &remaining_fills {
                                    let settlement_id = l3_to_settlement.get(&fill.order_id).copied().unwrap_or(fill.order_id);
                                    let order_itp = orchestrator.read().await.get_order_itp_id(&settlement_id).await
                                        .unwrap_or_else(|| itp_id_for_task.parse::<ethers::types::H256>().unwrap_or_default());
                                    let mapping = resolve_or_rebuild_mapping(&orchestrator, &settlement_reader, settlement_id, fill.order_id).await;
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
                                                    match settlement_writer.mint_bridged_shares(order_itp, mapping.original_user, shares, settlement_id, mint_result.aggregated_signature.0.clone(), protocol.settlement_registry_nonce(), mint_result.signer_bitmap).await {
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
                                                            } else if is_nonce_future_error(&err_str) {
                                                                warn!(order_id = %settlement_id, "mintBridgedShares (post-fills) hit NonceFuture — correcting cached registry nonce from on-chain");
                                                                if let Some(mirror_addr) = mirror_registry_addr {
                                                                    let lsn_selector = &ethers::utils::keccak256(b"lastSnapshotNonce()")[..4];
                                                                    if let Ok(bytes) = settlement_writer.static_call(mirror_addr, lsn_selector.to_vec()).await {
                                                                        if bytes.len() >= 32 {
                                                                            let on_chain = ethers::types::U256::from_big_endian(&bytes[..32]).as_u64();
                                                                            let cached = protocol.settlement_registry_nonce();
                                                                            protocol.reset_settlement_registry_nonce(on_chain);
                                                                            info!(order_id = %settlement_id, cached, on_chain, "Registry nonce cache corrected (mint post-fills path)");
                                                                        }
                                                                    }
                                                                }
                                                                mirror_sync_needed.store(true, Ordering::Release);
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
                                        debug!(order_id = %fill.order_id, "No order mapping — skipping bridge mint post-fills (L3-direct order)");
                                    }
                                }
                            }
                        } else if is_fill_error && retry_count >= MAX_FILL_RETRIES {
                            // Exhausted retries — mark all remaining as failed
                            warn!(
                                cycle = current_cycle,
                                retries = retry_count,
                                remaining = remaining_fills.len(),
                                "Fill retry limit reached — marking all remaining orders failed: {}",
                                fills_err
                            );
                            let orch = orchestrator.write().await;
                            let all_ids: Vec<ethers::types::U256> = remaining_fills.iter().map(|f| f.order_id).collect();
                            orch.mark_orders_failed(&all_ids).await;
                        } else {
                            warn!(cycle = current_cycle, error = %e, "Fills confirmation failed");
                        }

                        break; // non-retryable error — exit loop
                    }
                }
            } // end fills retry loop
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
pub(crate) async fn run_cross_chain_sell_processing<P, W, K, PF>(
    protocol: Arc<oracle::ConsensusProtocol<P, W, K, PF>>,
    settlement_reader: Arc<dyn oracle::SettlementReader>,
    orchestrator: Arc<tokio::sync::RwLock<oracle::BridgeOrchestrator>>,
    settlement_writer: Arc<oracle::SettlementChainWriter>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_oracles: u8,
    _data_node_url_for_task: Option<String>,
    itp_id_for_task: String,
    local_nav_fallback: ethers::types::U256,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
    block_cursor: Arc<std::sync::atomic::AtomicU64>,
    startup_sell_orders: Arc<tokio::sync::Mutex<Vec<common::types::CrossChainSellOrderEvent>>>,
    mirror_sync_needed: Arc<AtomicBool>,
    metrics: Arc<OracleMetrics>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: oracle::KeyRegistry + Send + Sync + 'static,
    PF: oracle::PriceFetcher + Send + Sync + 'static,
{
    let confirmed_block = match settlement_reader.get_confirmed_block().await {
        Ok(block) => block,
        Err(e) => { info!(cycle = current_cycle, error = %e, "Sell: failed to get confirmed block"); return; }
    };

    if confirmed_block == 0 { info!(cycle = current_cycle, "Sell: confirmed_block=0, skipping"); return; }

    // Use cursor for incremental scanning (fallback: 10000 blocks back on first run ~2h on Sonic).
    // Must be generous — a restart that misses in-flight orders leaves them stuck permanently.
    let cursor_val = block_cursor.load(Ordering::Relaxed);
    let from_block = if cursor_val > 0 { cursor_val } else { confirmed_block.saturating_sub(10_000) };

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

            metrics.update_pending_order_count(new_sell_orders.len() as u64);

            if new_sell_orders.is_empty() {
                debug!(cycle = current_cycle, "No new cross-chain sell orders");
            } else {
                info!(cycle = current_cycle, order_count = new_sell_orders.len(), from_block, to_block = confirmed_block, "Found cross-chain sell orders");

                // Set initial status for all sell orders before spawning
                {
                    let orch_write = orchestrator.write().await;
                    for sell_order in &new_sell_orders {
                        orch_write.set_sell_order_status(sell_order.order_id, oracle::BridgeOrderStatus::SellPending).await;
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
                    let am_leader = calculate_bridge_leader(sell_order.order_id.as_u64(), num_oracles, node_index);
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
                                    protocol.settlement_registry_nonce(),
                                    burn_result.signer_bitmap,
                                ).await {
                                    Ok(tx_hash) => {
                                        info!(order_id = %sell_order.order_id, ?tx_hash, "burnSellOrderShares tx submitted (non-blocking)");
                                        let orch = orchestrator.write().await;
                                        orch.set_sell_burn_tx_hash(sell_order.order_id, tx_hash).await;
                                        orch.set_sell_order_status(sell_order.order_id, oracle::BridgeOrderStatus::SellBurnPending).await;
                                        metrics.record_orders_processed(1);
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
                                            orch.set_sell_order_status(sell_order.order_id, oracle::BridgeOrderStatus::SellBurned).await;
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
                                orch.set_sell_order_status(sell_order.order_id, oracle::BridgeOrderStatus::SellBurned).await;
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
                .filter(|(_, s)| matches!(s, oracle::BridgeOrderStatus::SellPending))
                .map(|(id, _)| *id)
                .collect()
        };
        for order_id in pending_sell_orders {
            let am_leader = calculate_bridge_leader(order_id.as_u64(), num_oracles, node_index);
            info!(order_id = %order_id, am_leader, "Retrying burn consensus for SellPending order");
            match protocol.run_burn_sell_order_phase(order_id, am_leader).await {
                Ok(burn_result) => {
                    if am_leader && !burn_result.aggregated_signature.0.is_empty() {
                        match settlement_writer.burn_sell_order_shares(
                            order_id,
                            burn_result.aggregated_signature.0.clone(),
                            protocol.settlement_registry_nonce(),
                            burn_result.signer_bitmap,
                        ).await {
                            Ok(tx_hash) => {
                                info!(order_id = %order_id, ?tx_hash, "burnSellOrderShares tx submitted (retry)");
                                let orch = orchestrator.write().await;
                                orch.set_sell_burn_tx_hash(order_id, tx_hash).await;
                                orch.set_sell_order_status(order_id, oracle::BridgeOrderStatus::SellBurnPending).await;
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
                        orch.set_sell_order_status(order_id, oracle::BridgeOrderStatus::SellBurned).await;
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
        let am_leader = calculate_bridge_leader(order_id.as_u64(), num_oracles, node_index);
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
                            orch.set_sell_order_status(order_id, oracle::BridgeOrderStatus::SellBurned).await;
                            orch.clear_sell_burn_tx_hash(&order_id).await;
                            drop(orch);
                            info!(order_id = %order_id, "Status set to SellBurned, proceeding to sub-step 3");
                        } else {
                            warn!(order_id = %order_id, ?tx_hash, "burnSellOrderShares REVERTED — resetting to SellPending");
                            let orch = orchestrator.write().await;
                            orch.set_sell_order_status(order_id, oracle::BridgeOrderStatus::SellPending).await;
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
            orch.set_sell_order_status(order_id, oracle::BridgeOrderStatus::SellBurned).await;
        }
    }

    // ====== Phase A sub-step 3: Submit SellBurned orders on L3 ======
    let burned_sell_orders = {
        let o = orchestrator.read().await;
        o.get_burned_sell_orders().await
    };
    info!(cycle = current_cycle, burned_count = burned_sell_orders.len(), "Phase A sub-step 3: checking SellBurned orders");
    for order_id in burned_sell_orders {
        let am_leader = calculate_bridge_leader(order_id.as_u64(), num_oracles, node_index);
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
                orch_write.set_sell_order_status(order_id, oracle::BridgeOrderStatus::SellSubmittedOnL3).await;
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
        // min() not .first() — chain reads can return the same set in different
        // orders on different nodes, splitting leader agreement. Same fix as the
        // buy path. Order-independent over a set keeps every node on the same
        // leader for the same batch.
        let batch_key = submitted_sell_orders.iter().map(|id| id.as_u64()).min().unwrap_or(current_cycle);
        let batch_am_leader = calculate_bridge_leader(batch_key, num_oracles, node_index);
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
                            orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::SellFilled).await;
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
                                orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::SellFilled).await;
                            }
                        } else {
                            warn!(cycle = current_cycle, error = %e, "Sell fills confirmation failed");
                            let orch = orchestrator.write().await;
                            // Mark only filled orders as Failed (skipped orders stay SellSubmittedOnL3)
                            let filled_settlement_ids: Vec<ethers::types::U256> = fills.iter()
                                .map(|f| fill_to_settlement.get(&f.order_id).copied().unwrap_or(f.order_id))
                                .collect();
                            for oid in &filled_settlement_ids {
                                orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
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
                            if !batch_am_leader {
                                debug!(cycle = current_cycle, "Follower: sell fills vote forwarded (after E021)");
                            } else if fills_result.signature_count == 0 {
                                warn!(cycle = current_cycle, "Leader: sell fills gathered zero signatures (after E021) — no on-chain tx submitted");
                            } else {
                                info!(cycle = current_cycle, signer_count = fills_result.signature_count, "Leader: sell fills confirmed on-chain (after E021)");
                            }
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
                                orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::SellFilled).await;
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
                                    orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::SellFilled).await;
                                }
                            } else {
                                warn!(cycle = current_cycle, error = %e, "Sell fills also failed after E021");
                                let orch = orchestrator.write().await;
                                let filled_settlement_ids: Vec<ethers::types::U256> = fills.iter()
                                    .map(|f| fill_to_settlement.get(&f.order_id).copied().unwrap_or(f.order_id))
                                    .collect();
                                for oid in &filled_settlement_ids {
                                    orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
                                }
                                drop(orch);
                            }
                        }
                    }
                } else {
                    if is_snapshot_too_old_error(&err_str) {
                        warn!(cycle = current_cycle, "Sell batch hit SnapshotTooOld — requesting immediate mirror sync");
                        mirror_sync_needed.store(true, Ordering::Release);
                    } else {
                        warn!(cycle = current_cycle, error = %e, "Sell batch confirmation failed");
                    }
                    let orch = orchestrator.write().await;
                    for oid in &submitted_sell_orders {
                        orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
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
            .filter(|(_, status)| **status == oracle::BridgeOrderStatus::SellFilled)
            .map(|(order_id, _)| *order_id)
            .collect()
    };

    for order_id in filled_sell_orders {
        let am_leader = calculate_bridge_leader(order_id.as_u64(), num_oracles, node_index);

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
                        protocol.settlement_registry_nonce(),
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
                    orch.set_sell_order_status(order_id, oracle::BridgeOrderStatus::SellCompleted).await;
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
pub(crate) async fn run_rebalance_processing<P, W, K, PF>(
    protocol: Arc<oracle::ConsensusProtocol<P, W, K, PF>>,
    orchestrator: Arc<tokio::sync::RwLock<oracle::BridgeOrchestrator>>,
    chain_reader: Arc<dyn common::traits::ChainReader>,
    current_cycle: u64,
    node_index: u8,
    num_oracles: u8,
    price_fetcher: Arc<dyn PriceFetcher>,
    _symbol_map: oracle::SymbolMap,
    quote_tokens: Option<std::collections::HashMap<ethers::types::Address, ethers::types::Address>>,
) where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: oracle::KeyRegistry + Send + Sync + 'static,
    PF: oracle::PriceFetcher + Send + Sync + 'static,
{
    debug!(cycle = current_cycle, "Rebalance processing: starting scan");
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

    if current_cycle % 60 == 0 {
        info!(cycle = current_cycle, count = pending_rebalances.len(), "Rebalance processing: found pending rebalances");
    }

    // 1b. Filter out ITPs already being processed by another cycle (dedup)
    let orch_read = orchestrator.read().await;
    let mut filtered_rebalances = Vec::new();
    let mut filtered_itp_ids = Vec::new();
    for rebalance in &pending_rebalances {
        let itp_h256 = ethers::types::H256::from(rebalance.itp_id);
        if orch_read.is_rebalance_in_progress(&itp_h256).await {
            if current_cycle % 60 == 0 {
                debug!(
                    itp_id = ?itp_h256,
                    cycle = current_cycle,
                    "Skipping rebalance: already in progress from another cycle"
                );
            }
            continue;
        }
        filtered_rebalances.push(rebalance);
        filtered_itp_ids.push(itp_h256);
    }
    drop(orch_read);

    if filtered_rebalances.is_empty() {
        if current_cycle % 60 == 0 {
            debug!(cycle = current_cycle, "All pending rebalances already in progress");
        }
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
            if current_cycle % 60 == 0 {
                warn!(cycle = current_cycle, error = %e, "Price fetch failed for rebalance prices");
            }
            HashMap::new()
        }
    };

    // 4. Cycle offset to avoid collision with buy (+0) and sell (+500M) cycles
    let rebalance_cycle = current_cycle + 1_000_000_000;

    // 5. Leader election
    let am_leader = calculate_bridge_leader(rebalance_cycle, num_oracles, node_index);

    if current_cycle % 60 == 0 {
        info!(
            cycle = current_cycle,
            rebalance_cycle,
            count = filtered_rebalances.len(),
            price_count = price_map.len(),
            am_leader,
            "Found pending rebalances (after dedup)"
        );
    }

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
                    if current_cycle % 60 == 0 {
                        warn!(itp_id = ?itp_h256, asset = ?addr, "Missing or zero price for asset, skipping ITP");
                    }
                    missing_price = true;
                    break;
                }
            }
        }

        if missing_price || prices.is_empty() {
            if current_cycle % 60 == 0 {
                warn!(itp_id = ?itp_h256, "Stalling rebalance — missing prices, will retry");
            }
            orchestrator.read().await.mark_rebalance_completed(&itp_h256).await;
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
                    if current_cycle % 60 == 0 {
                        warn!(itp_id = ?itp_h256, asset = ?add_addr, "Missing price for added asset, stalling rebalance");
                    }
                    missing_add_price = true;
                    break;
                }
            }
        }
        if missing_add_price {
            warn!(itp_id = ?itp_h256, "Stalling rebalance — missing added asset prices, will retry next cycle");
            orchestrator.read().await.mark_rebalance_completed(&itp_h256).await;
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
                    // Extract nav BLS signature AND signer bitmap from NAV consensus result.
                    // The signer bitmap must match the NAV signature — using the rebalance
                    // bitmap instead causes BLSVerifier__InvalidSignature because different
                    // oracles may have signed each phase.
                    let (nav_sig, nav_signer_bitmap) = match &nav_result {
                        Ok(result) if !result.aggregated_signature.0.is_empty() => {
                            (result.aggregated_signature.0.clone(), result.signer_bitmap)
                        }
                        Ok(_) => {
                            warn!(itp_id = ?itp_h256, "setItpNav consensus returned empty signature");
                            (vec![], ethers::types::U256::zero())
                        }
                        Err(e) => {
                            warn!(itp_id = ?itp_h256, error = %e, "setItpNav consensus failed, proceeding with empty signature");
                            (vec![], ethers::types::U256::zero())
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
                        nav_signer_bitmap,
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

pub(crate) async fn run_mock_consensus(
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    chain_writer: &Option<Arc<oracle::EthersChainWriter>>,
    has_bls_keypair: bool,
    current_cycle: u64,
    metrics: &Arc<OracleMetrics>,
    start_time: std::time::Instant,
    settlement_reader: &Option<Arc<dyn oracle::SettlementReader>>,
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

/// Mirror registry sync task (Step 12).
///
/// Reads L3 registry nonce and Settlement mirror nonce, runs BLS consensus if stale,
/// and submits the sync transaction to Settlement.
///
/// Also refreshes the L3 OracleRegistry snapshot to prevent BLSVerifier__SnapshotTooOld.
/// The L3 snapshot's blockNumber goes stale after 86400 blocks (~6h on Orbit).
/// Without periodic refresh, ALL BLS-verified calls (createBatch, settleBatch) fail.
pub(crate) async fn mirror_sync_task<P, W, K, PF>(
    chain_reader: &Arc<dyn common::traits::ChainReader>,
    settlement_writer: &Arc<oracle::SettlementChainWriter>,
    protocol: &Arc<oracle::ConsensusProtocol<P, W, K, PF>>,
    mirror_addr: ethers::types::Address,
    settlement_chain_id: u64,
    cycle: u64,
    l3_writer: Option<&Arc<oracle::EthersChainWriter>>,
    l3_registry_addr: Option<ethers::types::Address>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    P: common::traits::P2PTransport + Send + Sync + 'static,
    W: common::traits::ChainWriter + Send + Sync + 'static,
    K: oracle::KeyRegistry + Send + Sync + 'static,
    PF: oracle::PriceFetcher + Send + Sync + 'static,
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

    // Step 4: Read active oracles — try L3 chain reader first, fall back to mirror registry
    let oracles = match chain_reader.get_oracle_registry().await {
        Ok(list) => list,
        Err(e) => {
            warn!(cycle, error = %e, "L3 chain reader failed for oracle registry, falling back to mirror");
            Vec::new()
        }
    };

    let active_oracles: Vec<_> = oracles.iter().filter(|i| i.is_active()).collect();

    let (oracle_pubkeys, oracle_ids, mut active_bitmask, mut active_count, mut threshold);
    if !active_oracles.is_empty() {
        // Use L3 registry data
        let mut bitmask = U256::zero();
        for oracle in &active_oracles {
            bitmask = bitmask | (U256::one() << oracle.id as usize);
        }
        active_bitmask = bitmask;
        active_count = active_oracles.len() as u64;
        threshold = oracle::registry_sync::compute_threshold(active_count);
        let mut sorted: Vec<_> = active_oracles.iter().collect();
        sorted.sort_by_key(|i| i.id);
        oracle_pubkeys = sorted.iter().map(|i| i.bls_pubkey.to_vec()).collect();
        oracle_ids = sorted.iter().map(|i| i.id).collect();
    } else {
        // Fallback: read current state from mirror registry itself.
        // NOTE: Use correct selectors:
        //   activeOracleCount() — explicit getter in deployed implementation
        //   activeBitmask() — auto-generated from `uint256 public activeBitmask`
        //   threshold is computed from activeCount (no getter deployed)
        let ac_sel = &ethers::utils::keccak256(b"activeOracleCount()")[..4];
        let ab_sel = &ethers::utils::keccak256(b"activeBitmask()")[..4];

        let ac_bytes = settlement_writer.static_call(mirror_addr, ac_sel.to_vec()).await
            .map_err(|e| format!("Failed to read mirror activeOracleCount: {}", e))?;
        let ab_bytes = settlement_writer.static_call(mirror_addr, ab_sel.to_vec()).await
            .map_err(|e| format!("Failed to read mirror activeBitmask: {}", e))?;

        active_count = if ac_bytes.len() >= 32 { U256::from_big_endian(&ac_bytes[..32]).as_u64() } else { 0 };
        active_bitmask = if ab_bytes.len() >= 32 { U256::from_big_endian(&ab_bytes[..32]) } else { U256::zero() };
        threshold = oracle::registry_sync::compute_threshold(active_count);

        if active_count == 0 {
            return Err("No active oracles on L3 or mirror".into());
        }

        // Read individual pubkeys via batch call: getOraclePubkeys(uint256[])
        // The deployed mirror only has the batch getter, not singular getOraclePubkey(uint256)
        let mut id_list = Vec::new();
        for bit in 0..256u32 {
            if active_bitmask.bit(bit as usize) {
                id_list.push(bit as u64);
            }
        }

        // ABI-encode: getOraclePubkeys(uint256[])
        let tokens = vec![ethers::abi::Token::Array(
            id_list.iter().map(|&id| ethers::abi::Token::Uint(U256::from(id))).collect()
        )];
        let mut calldata = ethers::utils::keccak256(b"getOraclePubkeys(uint256[])")[..4].to_vec();
        calldata.extend_from_slice(&ethers::abi::encode(&tokens));

        let result_bytes = settlement_writer.static_call(mirror_addr, calldata).await
            .map_err(|e| format!("Failed to read mirror getOraclePubkeys: {}", e))?;

        // Decode ABI response: bytes[] — outer offset + array length + per-element offsets + data
        let decoded = ethers::abi::decode(
            &[ethers::abi::ParamType::Array(Box::new(ethers::abi::ParamType::Bytes))],
            &result_bytes,
        ).map_err(|e| format!("Failed to decode getOraclePubkeys response: {}", e))?;

        let mut ids = Vec::new();
        let mut pubkeys = Vec::new();
        if let Some(ethers::abi::Token::Array(pk_tokens)) = decoded.into_iter().next() {
            for (i, token) in pk_tokens.into_iter().enumerate() {
                if let ethers::abi::Token::Bytes(pk) = token {
                    if pk.len() == 128 {
                        pubkeys.push(pk);
                        ids.push(id_list[i]);
                    } else if !pk.is_empty() {
                        warn!(cycle, id = id_list[i], len = pk.len(), "Unexpected pubkey length from mirror, skipping");
                    }
                }
            }
        }

        if pubkeys.is_empty() {
            // Third fallback: construct from deterministic BLS seed indices.
            // When both L3 data-node and mirror are empty (fresh mirror deploy),
            // derive pubkeys from the same seeds used by bls-tool and oracle bootstrap.
            let num_oracles = protocol.num_oracles();
            if num_oracles == 0 {
                return Err("Failed to read any oracle pubkeys from mirror or local config".into());
            }
            info!(cycle, num_oracles, "Deriving oracle pubkeys from deterministic seeds (L3 and mirror both empty)");
            for seed_idx in 0..num_oracles {
                let seed = vec![seed_idx; 32];
                let kp = common::bls::BLSKeyPair::from_seed(&seed)
                    .map_err(|e| format!("Failed to derive keypair from seed {}: {}", seed_idx, e))?;
                let pk = kp.public_key_bytes();
                pubkeys.push(pk);
                ids.push(seed_idx as u64);
            }
            let mut bitmask = U256::zero();
            for &id in &ids {
                bitmask = bitmask | (U256::one() << id as usize);
            }
            active_bitmask = bitmask;
            active_count = ids.len() as u64;
            threshold = oracle::registry_sync::compute_threshold(active_count);
        }
        oracle_pubkeys = pubkeys;
        oracle_ids = ids;
        info!(cycle, count = oracle_ids.len(), "Read oracle data from mirror registry or local config (L3 returned empty)");
    }

    // reference_nonce = the L3 lastSnapshotNonce (for BLS verification via historical snapshot)
    let reference_nonce = protocol.registry_nonce();

    // For the TOFU first sync (mirror_nonce == 0), the contract verifies against
    // the full aggregated pubkey, so ALL oracles must sign. For subsequent syncs,
    // the contract uses multi-pairing with threshold verification.
    let min_signatures = if mirror_nonce == 0 {
        active_count as usize
    } else {
        threshold as usize
    };
    info!(cycle, mirror_nonce, min_signatures, "Mirror sync min_signatures (TOFU={}, threshold={})", mirror_nonce == 0, threshold);

    // Step 5: Run BLS consensus — returns calldata if threshold reached
    let calldata = protocol.run_mirror_sync_consensus(
        sync_nonce,
        oracle_pubkeys,
        oracle_ids,
        active_bitmask,
        active_count,
        threshold,
        settlement_chain_id,
        mirror_addr,
        reference_nonce,
        min_signatures,
    ).await
        .map_err(|e| format!("Mirror sync BLS consensus failed: {}", e))?;

    // Step 6: Submit sync transaction to Settlement (retry once on nonce errors)
    let mut tx_result = settlement_writer.send_transaction(mirror_addr, calldata.clone(), U256::zero()).await;
    if let Err(ref e) = tx_result {
        let err_str = format!("{}", e);
        if err_str.contains("nonce") || err_str.contains("underpriced") {
            warn!(cycle, error = %e, "Mirror sync tx nonce collision, retrying in 3s");
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
            tx_result = settlement_writer.send_transaction(mirror_addr, calldata, U256::zero()).await;
        }
    }
    let tx_hash = tx_result.map_err(|e| format!("Mirror sync tx submission failed: {}", e))?;

    info!(
        cycle,
        sync_nonce,
        l3_nonce,
        mirror_nonce,
        ?tx_hash,
        "Mirror registry sync tx submitted"
    );

    // Step 7: Wait for receipt, then read back CONFIRMED lastSnapshotNonce from mirror.
    // CRITICAL: Do NOT trust the computed sync_nonce — the tx may revert or the mirror
    // may have a different nonce than expected. Always read the actual on-chain state.
    // This eliminates race conditions where bridge ops use a referenceNonce that doesn't
    // exist on-chain yet (causing NonceFuture) or points to a stale snapshot (SnapshotTooOld).
    const MIRROR_SYNC_RECEIPT_TIMEOUT: u64 = 30;
    let mut mirror_reverted = false;
    match settlement_writer.wait_for_receipt(tx_hash, MIRROR_SYNC_RECEIPT_TIMEOUT).await {
        Ok(receipt) => {
            let status = receipt.status.map(|s| s.as_u64()).unwrap_or(0);
            if status == 1 {
                // Tx confirmed — read back actual lastSnapshotNonce from mirror.
                // Use reset_ (authoritative) rather than set_ (monotonic) so the
                // cache tracks on-chain truth even if it had drifted forward.
                let lsn_selector = &ethers::utils::keccak256(b"lastSnapshotNonce()")[..4];
                match settlement_writer.static_call(mirror_addr, lsn_selector.to_vec()).await {
                    Ok(bytes) if bytes.len() >= 32 => {
                        let confirmed_nonce = U256::from_big_endian(&bytes[..32]).as_u64();
                        protocol.reset_settlement_registry_nonce(confirmed_nonce);
                        info!(cycle, confirmed_nonce, sync_nonce, "Mirror sync confirmed — registry nonce set from on-chain lastSnapshotNonce");
                    }
                    Ok(_) => {
                        // Fallback: use sync_nonce if read fails (shouldn't happen)
                        protocol.reset_settlement_registry_nonce(sync_nonce);
                        warn!(cycle, sync_nonce, "Mirror sync confirmed but lastSnapshotNonce read returned unexpected data, using sync_nonce");
                    }
                    Err(e) => {
                        protocol.reset_settlement_registry_nonce(sync_nonce);
                        warn!(cycle, sync_nonce, error = %e, "Mirror sync confirmed but failed to read lastSnapshotNonce, using sync_nonce");
                    }
                }
            } else {
                // Tx reverted — do NOT update nonce, keep old valid one
                mirror_reverted = true;
                warn!(cycle, sync_nonce, ?tx_hash, "Mirror sync tx reverted (status=0), keeping previous registry nonce");
            }
        }
        Err(e) => {
            // Receipt timeout — read current mirror state anyway (tx may have landed)
            warn!(cycle, error = %e, "Mirror sync receipt timeout, reading current mirror nonce");
            let lsn_selector = &ethers::utils::keccak256(b"lastSnapshotNonce()")[..4];
            match settlement_writer.static_call(mirror_addr, lsn_selector.to_vec()).await {
                Ok(bytes) if bytes.len() >= 32 => {
                    let current_nonce = U256::from_big_endian(&bytes[..32]).as_u64();
                    protocol.reset_settlement_registry_nonce(current_nonce);
                    info!(cycle, current_nonce, "Set registry nonce from mirror lastSnapshotNonce after receipt timeout");
                }
                _ => {
                    // Last resort: keep whatever nonce we had before
                    warn!(cycle, "Could not read mirror nonce after receipt timeout, keeping previous registry nonce");
                }
            }
        }
    }

    // ── L3 OracleRegistry snapshot refresh ──
    // The L3 OracleRegistry's snapshot has a blockNumber that goes stale after 86400 blocks.
    // BLSVerifier__SnapshotTooOld then bricks ALL BLS-verified calls (createBatch, settleBatch).
    // Call refreshSnapshot() — callable by any registered oracle, updates blockNumber only.
    if let (Some(writer), Some(reg_addr)) = (l3_writer, l3_registry_addr) {
        use common::traits::ChainWriter as _;
        let refresh_sel = &ethers::utils::keccak256(b"refreshSnapshot()")[..4];
        match writer.send_transaction(reg_addr, refresh_sel.to_vec(), U256::zero()).await {
            Ok(tx_hash) => {
                info!(cycle, ?tx_hash, "L3 snapshot refresh: refreshSnapshot submitted");
            }
            Err(e) => {
                warn!(cycle, error = %e, "L3 snapshot refresh failed");
            }
        }
    }

    if mirror_reverted {
        return Err("Mirror sync tx reverted (INFRA-002)".into());
    }

    Ok(())
}
