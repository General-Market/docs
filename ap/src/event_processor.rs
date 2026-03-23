//! Event processing loop for the AP service.
//!
//! Pipeline: TradeRequest -> place order -> track timeout -> verify fills -> validate limits
//! Optional: when on_chain_settlement is set, also execute trades on-chain via MockBitgetVault

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use ethers::prelude::*;
use ethers::types::Address as EthAddress;
use tokio::sync::RwLock;
use tracing::{debug, info, warn, error};

use ap::circuit_breaker::CircuitBreaker;
use ap::event_queue::{APEvent, EventReceiver};
use ap::limit_enforcer::{LimitOrderEnforcer, ValidationResult, LIMIT_TOLERANCE_BPS, BPS_DENOMINATOR};
use ap::metrics::APMetrics;
use ap::timeout::TimeoutHandler;
use common::traits::APClient;
use common::types::{LimitOrder, OrderStatus};

use crate::cli::OnChainSettlement;

/// Process events from the event queue with full pipeline wiring (Story 6.4, 6.17)
///
/// Pipeline: TradeRequest -> place order -> track timeout -> verify fills -> validate limits
/// Optional: when on_chain_settlement is set, also execute trades on-chain via MockBitgetVault
pub(crate) async fn process_events(
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

    // Track order_id -> (itp_id, side) for FillConfirmed decomposition.
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
                                                        if let Err(e) = settlement.vault_client.set_price(asset_addr, rp).await {
                                                            warn!(asset = ?asset_addr, error = %e, "set_price failed — trades may use stale price");
                                                        }
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

                            // Pre-trade swap: BUY with non-USDC quote -> swap USDC->quoteToken
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

                                    // Post-trade swap: SELL with non-USDC quote -> swap quoteToken->USDC
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
                            if let Err(e) = settlement.vault_client.set_price(assets[i], prices[i]).await {
                                warn!(order_id, asset = ?assets[i], error = %e, "set_price failed — trade may use stale price");
                            }

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
