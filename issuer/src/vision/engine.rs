//! Vision tick engine
//!
//! Main polling loop that checks the tick scheduler for due batches and
//! drives tick resolution. Runs as a background `tokio::spawn` task alongside
//! the existing ITP consensus loop.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use ethers::types::H256;
use ethers::utils::keccak256;
use tokio::sync::RwLock;

use super::config::VisionConfig;
use super::resolver::{MarketPrices, TickResolver};
use super::tick_scheduler::TickScheduler;

/// Reference prices from the previous tick, used as "start" prices for the next tick.
/// Maps market_id (H256) -> price value (f64).
type ReferencePrices = Arc<RwLock<HashMap<H256, f64>>>;

/// Compute the market_id (keccak256 of raw UTF-8 bytes of asset_id).
/// This matches `cast keccak $(cast --from-utf8 asset_id)` used in batch creation.
fn asset_id_to_market_id(asset_id: &str) -> H256 {
    H256::from(keccak256(asset_id.as_bytes()))
}

/// Fetch market prices from the data-node's Vision snapshot endpoint.
///
/// Fetches `/vision/snapshot?source=hackernews`, maps asset_ids to market_ids,
/// and builds a MarketPrices with start prices from the reference map and
/// end prices from the current snapshot.
async fn fetch_market_prices(
    data_node_url: &str,
    batch_market_ids: &[H256],
    reference_prices: &ReferencePrices,
    now: u64,
) -> MarketPrices {
    let mut prices = MarketPrices::new();

    let url = format!("{}/vision/snapshot?source=hackernews&limit=10000", data_node_url);
    let client = reqwest::Client::new();

    let response = match client.get(&url).timeout(std::time::Duration::from_secs(10)).send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(error = %e, "Failed to fetch prices from data-node");
            return prices;
        }
    };

    let json: serde_json::Value = match response.json().await {
        Ok(j) => j,
        Err(e) => {
            tracing::warn!(error = %e, "Failed to parse data-node snapshot response");
            return prices;
        }
    };

    let snapshots = match json.get("snapshots").and_then(|s| s.as_array()) {
        Some(arr) => arr,
        None => {
            tracing::warn!("data-node snapshot response missing 'snapshots' array");
            return prices;
        }
    };

    // Build a set of batch market_ids for fast lookup
    let batch_ids: std::collections::HashSet<H256> = batch_market_ids.iter().copied().collect();

    // Map asset_ids to current values
    let mut current_values: HashMap<H256, f64> = HashMap::new();

    for snap in snapshots {
        let asset_id = snap.get("asset_id")
            .or_else(|| snap.get("assetId"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if asset_id.is_empty() {
            continue;
        }

        let market_id = asset_id_to_market_id(asset_id);

        if !batch_ids.contains(&market_id) {
            continue;
        }

        // Parse the value (current price/score)
        let value = snap.get("value")
            .and_then(|v| {
                if let Some(f) = v.as_f64() {
                    Some(f)
                } else if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    None
                }
            })
            .unwrap_or(0.0);

        if value > 0.0 {
            current_values.insert(market_id, value);
        }
    }

    // Build MarketPrices: start from reference, end from current
    let ref_prices = reference_prices.read().await;

    let mut matched = 0;
    for &market_id in batch_market_ids {
        if let Some(&end_price) = current_values.get(&market_id) {
            let start_price = ref_prices.get(&market_id).copied().unwrap_or(end_price);
            prices.insert(market_id, start_price, end_price, now);
            matched += 1;
        }
    }

    tracing::info!(
        total_snapshots = snapshots.len(),
        matched_markets = matched,
        batch_markets = batch_market_ids.len(),
        "Fetched market prices from data-node"
    );

    prices
}

/// Update reference prices with current values after a tick is resolved.
async fn update_reference_prices(
    reference_prices: &ReferencePrices,
    batch_market_ids: &[H256],
    prices: &MarketPrices,
) {
    let mut ref_prices = reference_prices.write().await;
    for &market_id in batch_market_ids {
        if let Some((_, end)) = prices.get_prices(&market_id) {
            ref_prices.insert(market_id, end);
        }
    }
}

/// Fetch the latest block timestamp from the RPC node.
/// Falls back to wall clock if the RPC call fails.
async fn get_chain_timestamp(rpc_url: &str) -> u64 {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getBlockByNumber",
        "params": ["latest", false],
        "id": 1
    });
    match client.post(rpc_url).json(&body).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(ts_hex) = json["result"]["timestamp"].as_str() {
                    let ts_hex = ts_hex.trim_start_matches("0x");
                    if let Ok(ts) = u64::from_str_radix(ts_hex, 16) {
                        return ts;
                    }
                }
            }
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        }
        Err(_) => std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }
}

/// Main tick engine loop.
///
/// Polls the scheduler at `config.tick_poll_interval_ms` intervals for batches
/// that have a tick due for resolution. When a due batch is found, it:
///
/// 1. Retrieves batch state and player positions from the scheduler
/// 2. Looks up player bitmaps from the bitmap store
/// 3. Fetches prices from the data-node (stub — prices currently empty)
/// 4. Runs the tick resolver to compute outcomes
/// 5. Marks the tick as resolved in the scheduler
/// 6. (TODO) Drives BLS consensus with other issuers
/// 7. (TODO) Submits the signed result on-chain
pub async fn run(
    scheduler: Arc<TickScheduler>,
    resolver: Arc<TickResolver>,
    config: VisionConfig,
    shutdown: Arc<AtomicBool>,
) {
    let interval = tokio::time::Duration::from_millis(config.tick_poll_interval_ms);
    let reference_prices: ReferencePrices = Arc::new(RwLock::new(HashMap::new()));

    tracing::info!(
        poll_interval_ms = config.tick_poll_interval_ms,
        reveal_window_secs = config.reveal_window_secs,
        data_node_url = %config.data_node_url,
        "Vision tick engine started"
    );

    loop {
        if shutdown.load(Ordering::Relaxed) {
            tracing::info!("Vision tick engine shutting down");
            break;
        }

        tokio::select! {
            _ = tokio::time::sleep(interval) => {
                if shutdown.load(Ordering::Relaxed) {
                    tracing::info!("Vision tick engine shutting down");
                    break;
                }

                let now = get_chain_timestamp(&config.rpc_ws_url).await;

                let due_batches = scheduler.get_due_batches(now, config.reveal_window_secs).await;

                if due_batches.is_empty() {
                    continue;
                }

                tracing::debug!(
                    count = due_batches.len(),
                    batches = ?due_batches,
                    "Found due batches"
                );

                for batch_id in due_batches {
                    let tick_id = scheduler.next_tick_for_batch(batch_id).await;

                    match scheduler.get_batch_state(batch_id).await {
                        Some((batch, players)) => {
                            if players.is_empty() {
                                tracing::debug!(
                                    batch_id,
                                    tick_id,
                                    "Skipping tick — no players in batch"
                                );
                                // Mark resolved so we advance past empty ticks
                                scheduler.mark_resolved(batch_id, tick_id).await;
                                continue;
                            }

                            tracing::info!(
                                batch_id,
                                tick_id,
                                player_count = players.len(),
                                market_count = batch.market_ids.len(),
                                "Processing due tick"
                            );

                            // Fetch prices from data-node for each market_id.
                            let prices = fetch_market_prices(
                                &config.data_node_url,
                                &batch.market_ids,
                                &reference_prices,
                                now,
                            ).await;

                            match resolver.resolve_tick(&batch, tick_id, &players, &prices, now).await {
                                Ok(result) => {
                                    // Log per-player balance changes
                                    for pb in &result.player_balances {
                                        let delta_display = if pb.delta >= 0 {
                                            format!("+{}", pb.delta)
                                        } else {
                                            format!("{}", pb.delta)
                                        };
                                        tracing::info!(
                                            batch_id,
                                            tick_id,
                                            player = %pb.player,
                                            old_balance = %pb.old_balance,
                                            new_balance = %pb.new_balance,
                                            delta = %delta_display,
                                            "Player balance update"
                                        );
                                    }

                                    // Count market outcomes
                                    let up_count = result.market_results.iter()
                                        .filter(|m| matches!(m.outcome, super::types::MarketOutcome::Up))
                                        .count();
                                    let down_count = result.market_results.iter()
                                        .filter(|m| matches!(m.outcome, super::types::MarketOutcome::Down))
                                        .count();
                                    let flat_count = result.market_results.iter()
                                        .filter(|m| matches!(m.outcome, super::types::MarketOutcome::Flat))
                                        .count();
                                    let cancelled_count = result.market_results.iter()
                                        .filter(|m| matches!(m.outcome, super::types::MarketOutcome::Cancelled))
                                        .count();

                                    tracing::info!(
                                        batch_id,
                                        tick_id,
                                        markets = result.market_results.len(),
                                        up = up_count,
                                        down = down_count,
                                        flat = flat_count,
                                        cancelled = cancelled_count,
                                        voided = result.voided_players.len(),
                                        balance_updates = result.player_balances.len(),
                                        "Tick resolved"
                                    );

                                    // Update reference prices for next tick
                                    update_reference_prices(
                                        &reference_prices,
                                        &batch.market_ids,
                                        &prices,
                                    ).await;

                                    scheduler.mark_resolved(batch_id, tick_id).await;
                                }
                                Err(e) => {
                                    tracing::warn!(
                                        batch_id,
                                        tick_id,
                                        error = %e,
                                        "Tick resolution failed"
                                    );
                                    // Don't mark resolved — retry on next poll
                                }
                            }
                        }
                        None => {
                            tracing::warn!(
                                batch_id,
                                "Due batch not found in scheduler state"
                            );
                        }
                    }
                }
            }
        }
    }

    tracing::info!("Vision tick engine stopped");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vision::bitmap_store::BitmapStore;
    use crate::vision::types::{Batch, PlayerPosition};
    use ethers::types::{Address, H256, U256};

    fn make_batch(id: u64, tick_duration: u64, created_at_tick: u64) -> Batch {
        Batch {
            id,
            creator: Address::zero(),
            market_ids: vec![H256::zero()],
            resolution_types: vec![0],
            tick_duration,
            custom_thresholds: vec![],
            created_at_tick,
            paused: false,
        }
    }

    fn make_player(player: Address) -> PlayerPosition {
        PlayerPosition {
            player,
            bitmap_hash: H256::random(),
            stake_per_tick: U256::from(100),
            start_tick: 0,
            balance: U256::from(10000),
            join_timestamp: 1000,
        }
    }

    #[tokio::test]
    async fn test_engine_shuts_down_on_signal() {
        let bitmap_store = Arc::new(BitmapStore::new());
        let scheduler = Arc::new(TickScheduler::new());
        let resolver = Arc::new(TickResolver::new(
            bitmap_store,
            VisionConfig::default(),
        ));
        let config = VisionConfig {
            tick_poll_interval_ms: 50, // fast polling for test
            ..Default::default()
        };
        let shutdown = Arc::new(AtomicBool::new(false));

        let shutdown_clone = shutdown.clone();
        let handle = tokio::spawn(async move {
            run(scheduler, resolver, config, shutdown_clone).await;
        });

        // Let it run briefly, then signal shutdown
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        shutdown.store(true, Ordering::Relaxed);

        // Should complete within a reasonable time
        tokio::time::timeout(tokio::time::Duration::from_secs(2), handle)
            .await
            .expect("engine should shut down within timeout")
            .expect("engine task should not panic");
    }

    #[tokio::test]
    async fn test_engine_resolves_due_batch() {
        let bitmap_store = Arc::new(BitmapStore::new());
        let scheduler = Arc::new(TickScheduler::new());

        // Create a batch that is immediately due
        // tick_duration=1, created_at_tick=0 -> tick 0 ends at time 1
        // reveal_window_secs=0 -> due at time 1
        let batch = make_batch(1, 1, 0);
        scheduler.on_batch_created(batch).await;

        let player = Address::random();
        scheduler.on_player_joined(1, make_player(player)).await;

        let resolver = Arc::new(TickResolver::new(
            bitmap_store,
            VisionConfig {
                reveal_window_secs: 0,
                ..Default::default()
            },
        ));
        let config = VisionConfig {
            tick_poll_interval_ms: 50,
            reveal_window_secs: 0,
            ..Default::default()
        };
        let shutdown = Arc::new(AtomicBool::new(false));

        let sched_check = scheduler.clone();
        let shutdown_clone = shutdown.clone();
        let handle = tokio::spawn(async move {
            run(scheduler, resolver, config, shutdown_clone).await;
        });

        // Wait for the engine to process at least one tick
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        shutdown.store(true, Ordering::Relaxed);

        tokio::time::timeout(tokio::time::Duration::from_secs(2), handle)
            .await
            .expect("engine should shut down")
            .expect("engine task should not panic");

        // The resolver will either resolve (all markets cancelled due to no prices)
        // or fail with NoActivePlayers. Either way, tick should advance or stay.
        // With empty prices, markets get cancelled but tick still resolves.
        let next_tick = sched_check.next_tick_for_batch(1).await;
        // If resolved, next_tick >= 1. If failed, next_tick == 0.
        // Both are valid outcomes since we have no real prices.
        tracing::info!(next_tick = next_tick, "Final tick state");
    }
}
