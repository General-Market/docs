//! CoinGecko historical market-cap backfill.
//!
//! Fetches monthly market_chart data for every coin that has a market cap and
//! stores it in the `coingecko_market_caps` table.

use std::sync::Arc;
use std::time::Instant;

use tokio::sync::Mutex;
use tracing::{error, info, warn};

use crate::coingecko::{CoinGeckoClient, RateLimiter};
use crate::config::CgBackfillArgs;
use crate::db;

pub async fn run(args: CgBackfillArgs) -> Result<(), Box<dyn std::error::Error>> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&args.log_level));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    let started = Instant::now();

    // Connect to DB
    let pool = db::create_pool(&args.database_url).await?;
    db::run_migrations(&pool).await?;

    // Single shared rate limiter for ALL workers — respects Pro plan 500 req/min
    let limiter = RateLimiter::coingecko_pro();
    let client = CoinGeckoClient::with_limiter(&args.coingecko_api_key, limiter.clone())?;

    // Step 1: Fetch all coins with market cap using /coins/markets
    info!("Step 1: Fetching all coins with market cap from CoinGecko...");
    let all_coins = client.fetch_all_markets().await?;

    // Filter to coins with market cap, deduplicate by coin_id, and apply limit
    let mut seen = std::collections::HashSet::new();
    let coins_with_mcap: Vec<_> = all_coins
        .into_iter()
        .filter(|c| c.market_cap.map(|m| m > 0.0).unwrap_or(false))
        .filter(|c| seen.insert(c.id.clone()))
        .collect();

    let total = coins_with_mcap.len();
    let to_process = if args.top_n > 0 {
        coins_with_mcap[..total.min(args.top_n as usize)].to_vec()
    } else {
        coins_with_mcap
    };

    info!(
        total_with_mcap = total,
        processing = to_process.len(),
        "Coins discovered"
    );

    // Step 2: Also store today's snapshot from the markets data we already fetched
    info!("Step 2: Storing today's snapshot from markets data...");
    let today = chrono::Utc::now().date_naive();

    let today_rows: Vec<db::CgMarketCapRow> = to_process
        .iter()
        .map(|c| db::CgMarketCapRow {
            coin_id: c.id.clone(),
            symbol: c.symbol.clone(),
            name: c.name.clone(),
            market_cap_usd: c.market_cap,
            price_usd: c.current_price,
            total_volume_usd: c.total_volume,
            market_cap_rank: c.market_cap_rank,
            snapshot_date: today,
        })
        .collect();

    let stored = db::cg_batch_upsert_market_caps(&pool, &today_rows).await?;
    info!(stored, date = %today, "Today's snapshot stored");

    // Step 3: Determine which coins need historical backfill
    let work: Vec<(String, Option<String>, Option<String>)> = if args.skip_existing {
        info!("Step 3: Checking which coins already have historical data...");
        let existing = db::cg_coins_with_history(&pool).await?;
        let need_backfill: Vec<_> = to_process
            .iter()
            .filter(|c| !existing.contains(&c.id))
            .map(|c| (c.id.clone(), c.symbol.clone(), c.name.clone()))
            .collect();
        let skipped = to_process.len() - need_backfill.len();
        info!(
            need_backfill = need_backfill.len(),
            skipped,
            "Coins after skip-existing filter"
        );
        need_backfill
    } else {
        to_process
            .iter()
            .map(|c| (c.id.clone(), c.symbol.clone(), c.name.clone()))
            .collect()
    };

    if work.is_empty() {
        info!("All coins already have historical data. Nothing to backfill.");
        return Ok(());
    }

    // Step 4: Backfill historical monthly data per coin
    info!(
        "Step 4: Backfilling historical daily market caps ({} coins, {} workers)...",
        work.len(),
        args.concurrency
    );

    let work_queue = Arc::new(Mutex::new(work.clone()));
    let total_inserted = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let coins_done = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let coins_failed = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let coins_total = work.len() as u64;

    let backfill_start = Instant::now();

    let mut handles = tokio::task::JoinSet::new();
    for worker_id in 0..args.concurrency {
        let queue = Arc::clone(&work_queue);
        let pool = pool.clone();
        let inserted_counter = Arc::clone(&total_inserted);
        let done_counter = Arc::clone(&coins_done);
        let failed_counter = Arc::clone(&coins_failed);
        let api_key = args.coingecko_api_key.clone();
        let shared_limiter = limiter.clone();

        handles.spawn(async move {
            // All workers share the same rate limiter
            let client = match CoinGeckoClient::with_limiter(&api_key, shared_limiter) {
                Ok(c) => c,
                Err(e) => {
                    error!(?e, worker = worker_id, "Failed to create CoinGecko client");
                    return;
                }
            };

            loop {
                let item = {
                    let mut q = queue.lock().await;
                    q.pop()
                };

                let (coin_id, symbol, name) = match item {
                    Some(i) => i,
                    None => break,
                };

                let done = done_counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;

                match client.fetch_daily_market_chart(&coin_id).await {
                    Ok(data_points) => {
                        if data_points.is_empty() {
                            info!(
                                worker = worker_id,
                                coin = %coin_id,
                                "[{done}/{coins_total}] No historical data"
                            );
                            continue;
                        }

                        let rows: Vec<db::CgMarketCapRow> = data_points
                            .iter()
                            .map(|dp| db::CgMarketCapRow {
                                coin_id: coin_id.clone(),
                                symbol: symbol.clone(),
                                name: name.clone(),
                                market_cap_usd: Some(dp.market_cap),
                                price_usd: Some(dp.price),
                                total_volume_usd: Some(dp.volume),
                                market_cap_rank: None, // not available in historical data
                                snapshot_date: dp.date,
                            })
                            .collect();

                        let count = rows.len();
                        match db::cg_batch_upsert_market_caps(&pool, &rows).await {
                            Ok(inserted) => {
                                inserted_counter
                                    .fetch_add(inserted, std::sync::atomic::Ordering::Relaxed);

                                // Log progress every coin, with ETA every 100
                                if done % 100 == 0 || done == coins_total {
                                    let elapsed = backfill_start.elapsed().as_secs_f64();
                                    let rate = done as f64 / elapsed;
                                    let remaining = (coins_total - done) as f64 / rate;
                                    info!(
                                        worker = worker_id,
                                        coin = %coin_id,
                                        days = count,
                                        "[{done}/{coins_total}] OK — ETA {remaining:.0}s ({rate:.1} coins/s)"
                                    );
                                } else {
                                    info!(
                                        worker = worker_id,
                                        coin = %coin_id,
                                        days = count,
                                        "[{done}/{coins_total}] OK"
                                    );
                                }
                            }
                            Err(e) => {
                                failed_counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                                error!(
                                    worker = worker_id,
                                    coin = %coin_id,
                                    %e,
                                    "DB insert failed"
                                );
                            }
                        }
                    }
                    Err(e) => {
                        failed_counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                        warn!(
                            worker = worker_id,
                            coin = %coin_id,
                            %e,
                            "[{done}/{coins_total}] Failed to fetch market chart"
                        );
                    }
                }
            }
        });
    }

    while let Some(result) = handles.join_next().await {
        if let Err(e) = result {
            error!(%e, "Worker task panicked");
        }
    }

    let total = total_inserted.load(std::sync::atomic::Ordering::Relaxed);
    let failed = coins_failed.load(std::sync::atomic::Ordering::Relaxed);
    let elapsed = started.elapsed();

    info!(
        coins_requested = work.len(),
        rows_inserted = total,
        failed,
        elapsed_secs = elapsed.as_secs(),
        "CoinGecko backfill complete"
    );

    if failed > 0 {
        warn!(
            failed,
            "Some coins failed. Re-run with --skip-existing to resume."
        );
    }

    Ok(())
}
