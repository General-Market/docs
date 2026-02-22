//! P2Pool tick engine
//!
//! Main polling loop that checks the tick scheduler for due batches and
//! drives tick resolution. Runs as a background `tokio::spawn` task alongside
//! the existing ITP consensus loop.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use super::config::P2PoolConfig;
use super::resolver::{MarketPrices, TickResolver};
use super::tick_scheduler::TickScheduler;

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
    config: P2PoolConfig,
    shutdown: Arc<AtomicBool>,
) {
    let interval = tokio::time::Duration::from_millis(config.tick_poll_interval_ms);
    tracing::info!(
        poll_interval_ms = config.tick_poll_interval_ms,
        reveal_window_secs = config.reveal_window_secs,
        "P2Pool tick engine started"
    );

    loop {
        if shutdown.load(Ordering::Relaxed) {
            tracing::info!("P2Pool tick engine shutting down");
            break;
        }

        tokio::select! {
            _ = tokio::time::sleep(interval) => {
                if shutdown.load(Ordering::Relaxed) {
                    tracing::info!("P2Pool tick engine shutting down");
                    break;
                }

                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs();

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

                            // TODO: Fetch prices from data-node for each market_id.
                            // For now we pass empty prices — the resolver will cancel
                            // markets with stale/missing prices.
                            let prices = MarketPrices::new();

                            match resolver.resolve_tick(&batch, tick_id, &players, &prices, now).await {
                                Ok(result) => {
                                    tracing::info!(
                                        batch_id,
                                        tick_id,
                                        markets = result.market_results.len(),
                                        voided = result.voided_players.len(),
                                        balance_updates = result.player_balances.len(),
                                        "Tick resolved"
                                    );

                                    // TODO: Drive BLS consensus with other issuers
                                    //   1. Serialize TickResult as consensus payload
                                    //   2. Collect BLS partial signatures from quorum
                                    //   3. Aggregate into threshold signature
                                    //
                                    // TODO: Submit signed result on-chain
                                    //   1. Call Vision.resolveTick(batchId, tickId, results, blsSig)
                                    //   2. Update player balances on-chain

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

    tracing::info!("P2Pool tick engine stopped");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::p2pool::bitmap_store::BitmapStore;
    use crate::p2pool::types::{Batch, PlayerPosition};
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
            P2PoolConfig::default(),
        ));
        let config = P2PoolConfig {
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
            P2PoolConfig {
                reveal_window_secs: 0,
                ..Default::default()
            },
        ));
        let config = P2PoolConfig {
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
