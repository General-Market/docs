//! CoinGecko market-cap collector.
//!
//! Runs in background with two tasks:
//! 1. Daily snapshot: fetches all coins from `/coins/markets` and stores today's data
//! 2. Backfill (every 4h): fetches historical daily data for any coins missing history

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use chrono::{NaiveDate, Utc};
use sqlx::PgPool;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::coingecko::{CoinGeckoClient, MarketCoin, RateLimiter};
use crate::db::{self, CgCategoryRow};
use crate::logo_downloader;

/// 4 hours between backfill cycles
const BACKFILL_INTERVAL_SECS: u64 = 4 * 3600;
/// 24 hours between full category coin sync cycles
const CATEGORY_COIN_SYNC_INTERVAL_SECS: u64 = 24 * 3600;

pub struct CgCollectorState {
    pub last_snapshot_date: RwLock<Option<NaiveDate>>,
    pub total_coins: RwLock<usize>,
}

impl CgCollectorState {
    pub fn new() -> Self {
        Self {
            last_snapshot_date: RwLock::new(None),
            total_coins: RwLock::new(0),
        }
    }
}

/// Run the CoinGecko market-cap collector loop.
///
/// Spawns two independent tasks:
/// 1. Snapshot + logo sync + backfill (slow, runs daily/4h)
/// 2. Category sync (fast metadata + slower coin-membership, runs independently)
pub async fn run(
    pool: PgPool,
    _state: Arc<CgCollectorState>,
    api_key: String,
    poll_interval_secs: u64,
    logos_dir: PathBuf,
) {
    let limiter = RateLimiter::coingecko_pro();

    info!(
        poll_secs = poll_interval_secs,
        backfill_interval_secs = BACKFILL_INTERVAL_SECS,
        "CoinGecko collector started (snapshot + backfill + categories)"
    );

    // Spawn category sync as an independent task so it doesn't wait behind
    // the slow logo sync / backfill.
    let cat_pool = pool.clone();
    let cat_key = api_key.clone();
    let cat_limiter = limiter.clone();
    tokio::spawn(async move {
        run_category_sync(cat_pool, cat_key, cat_limiter).await;
    });

    // Main loop: snapshot + logos + backfill
    let client = match CoinGeckoClient::with_limiter(&api_key, limiter.clone()) {
        Ok(c) => c,
        Err(e) => {
            error!(?e, "Failed to create CoinGecko client");
            return;
        }
    };

    let poll_interval = Duration::from_secs(poll_interval_secs);
    let backfill_interval = Duration::from_secs(BACKFILL_INTERVAL_SECS);
    let mut last_backfill = tokio::time::Instant::now() - backfill_interval;

    loop {
        let today = Utc::now().date_naive();

        // --- Task 1: Daily snapshot ---
        let mut snapshot_coins: Option<Vec<MarketCoin>> = None;
        match db::cg_has_snapshot_for_date(&pool, today).await {
            Ok(true) => {
                info!(%today, "CoinGecko snapshot already exists for today");
            }
            Ok(false) => {
                info!(%today, "Taking CoinGecko daily snapshot");
                match snapshot_all_markets(&pool, &client, today).await {
                    Ok(coins) => {
                        snapshot_coins = Some(coins);
                    }
                    Err(e) => {
                        error!(%e, "CoinGecko snapshot failed");
                    }
                }
            }
            Err(e) => {
                warn!(%e, "Failed to check CoinGecko snapshot status");
            }
        }

        // --- Task 1b: Sync logos ---
        if let Some(coins) = snapshot_coins {
            let coin_images: Vec<(String, Option<String>)> = coins
                .iter()
                .map(|c| (c.id.clone(), c.image.clone()))
                .collect();
            let downloaded = logo_downloader::sync_logos(&logos_dir, &coin_images).await;
            if downloaded > 0 {
                info!(downloaded, "Logo sync complete");
            }
        }

        // --- Task 2: Backfill missing historical data (every 4h) ---
        if last_backfill.elapsed() >= backfill_interval {
            info!("Starting CoinGecko historical backfill cycle");
            match backfill_missing(&pool, &api_key, limiter.clone()).await {
                Ok(count) => {
                    if count > 0 {
                        info!(backfilled = count, "CoinGecko backfill cycle complete");
                    } else {
                        info!("CoinGecko backfill: all coins up to date");
                    }
                }
                Err(e) => {
                    error!(%e, "CoinGecko backfill cycle failed");
                }
            }
            last_backfill = tokio::time::Instant::now();
        }

        tokio::time::sleep(poll_interval).await;
    }
}

/// Independent category sync loop. Runs immediately on start, then daily.
async fn run_category_sync(pool: PgPool, api_key: String, limiter: RateLimiter) {
    let client = match CoinGeckoClient::with_limiter(&api_key, limiter) {
        Ok(c) => c,
        Err(e) => {
            error!(?e, "Failed to create CoinGecko client for category sync");
            return;
        }
    };

    let category_coin_sync_interval = Duration::from_secs(CATEGORY_COIN_SYNC_INTERVAL_SECS);

    loop {
        // Step 1: Sync category metadata (1 API call, fast)
        match sync_categories(&pool, &client).await {
            Ok(count) => {
                info!(categories = count, "CoinGecko categories synced");
            }
            Err(e) => {
                error!(%e, "CoinGecko category sync failed");
            }
        }

        // Step 2: Sync all category coins (1 call per category, slow)
        info!("Starting CoinGecko category coin sync");
        match sync_all_category_coins(&pool, &client).await {
            Ok((cats, coins)) => {
                info!(categories = cats, total_coins = coins, "CoinGecko category coin sync complete");
            }
            Err(e) => {
                error!(%e, "CoinGecko category coin sync failed");
            }
        }

        // Wait before next full cycle
        tokio::time::sleep(category_coin_sync_interval).await;
    }
}

/// Fetch all coins from /coins/markets and store as a daily snapshot.
/// Returns the full list of coins (with image URLs) for logo sync.
async fn snapshot_all_markets(
    pool: &PgPool,
    client: &CoinGeckoClient,
    snapshot_date: NaiveDate,
) -> Result<Vec<MarketCoin>, Box<dyn std::error::Error + Send + Sync>> {
    let coins = client.fetch_all_markets().await?;
    let total = coins.len();
    info!(total, %snapshot_date, "Fetched all CoinGecko markets");

    // Filter to coins with market cap, deduplicate by coin_id
    let mut seen = std::collections::HashSet::new();
    let with_mcap: Vec<_> = coins
        .into_iter()
        .filter(|c| c.market_cap.map(|m| m > 0.0).unwrap_or(false))
        .filter(|c| seen.insert(c.id.clone()))
        .collect();

    info!(
        with_market_cap = with_mcap.len(),
        total,
        "Coins with market cap"
    );

    // Batch insert
    let rows: Vec<db::CgMarketCapRow> = with_mcap
        .iter()
        .map(|c| db::CgMarketCapRow {
            coin_id: c.id.clone(),
            symbol: c.symbol.clone(),
            name: c.name.clone(),
            market_cap_usd: c.market_cap,
            price_usd: c.current_price,
            total_volume_usd: c.total_volume,
            market_cap_rank: c.market_cap_rank,
            snapshot_date,
        })
        .collect();

    let inserted = db::cg_batch_upsert_market_caps(pool, &rows).await?;
    info!(inserted, coins = rows.len(), %snapshot_date, "CoinGecko snapshot stored");

    Ok(with_mcap)
}

/// Fetch all categories from CoinGecko and upsert into DB.
async fn sync_categories(
    pool: &PgPool,
    client: &CoinGeckoClient,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let categories = client.fetch_categories().await?;
    let total = categories.len();

    let rows: Vec<CgCategoryRow> = categories
        .into_iter()
        .map(|c| CgCategoryRow {
            id: c.id,
            name: c.name,
            market_cap: c.market_cap,
            market_cap_change_24h: c.market_cap_change_24h,
            volume_24h: c.volume_24h,
            top_3_coins: c.top_3_coins,
        })
        .collect();

    db::cg_batch_upsert_categories(pool, &rows).await?;
    Ok(total)
}

/// Fetch coins for every category and store the memberships + market data.
/// This is expensive (one API call per category), so we only run it daily.
async fn sync_all_category_coins(
    pool: &PgPool,
    client: &CoinGeckoClient,
) -> Result<(usize, usize), Box<dyn std::error::Error + Send + Sync>> {
    let today = Utc::now().date_naive();
    // Get all category IDs from DB
    let categories = db::cg_query_all_categories(pool).await?;
    let total_cats = categories.len();
    let mut total_coins = 0usize;

    for (i, cat) in categories.iter().enumerate() {
        match client.fetch_all_category_coins(&cat.id).await {
            Ok(coins) => {
                let coin_ids: Vec<String> = coins.iter().map(|c| c.id.clone()).collect();
                let count = coin_ids.len();

                // Store category → coin memberships
                if let Err(e) = db::cg_replace_category_coins(pool, &cat.id, &coin_ids).await {
                    warn!(category = %cat.id, %e, "Failed to store category coins");
                    continue;
                }

                // Also persist each coin's market data into coingecko_market_caps
                // so coins only appearing in categories (not in global top) have data
                let mut seen = std::collections::HashSet::new();
                let market_rows: Vec<db::CgMarketCapRow> = coins
                    .iter()
                    .filter(|c| seen.insert(c.id.clone()))
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

                if let Err(e) = db::cg_batch_upsert_market_caps(pool, &market_rows).await {
                    warn!(category = %cat.id, %e, "Failed to upsert category coin market data");
                }

                total_coins += count;
                if (i + 1) % 50 == 0 || i + 1 == total_cats {
                    info!(
                        "[cat-sync {}/{total_cats}] {} = {} coins",
                        i + 1, cat.id, count
                    );
                }
            }
            Err(e) => {
                warn!(category = %cat.id, %e, "Failed to fetch category coins");
            }
        }
    }

    Ok((total_cats, total_coins))
}

/// Backfill historical daily data for coins that only have 1 snapshot (today's).
/// Uses 3 concurrent workers sharing the global rate limiter.
async fn backfill_missing(
    pool: &PgPool,
    api_key: &str,
    limiter: RateLimiter,
) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
    // Find coins with no historical data (only today's snapshot or less)
    let existing = db::cg_coins_with_history(pool).await?;

    // Get all coin_ids in our DB
    let all_coins = db::cg_all_coin_ids(pool).await?;

    let need_backfill: Vec<String> = all_coins
        .into_iter()
        .filter(|id| !existing.contains(id))
        .collect();

    if need_backfill.is_empty() {
        return Ok(0);
    }

    info!(
        need_backfill = need_backfill.len(),
        already_done = existing.len(),
        "Coins needing historical backfill"
    );

    let work_queue = Arc::new(tokio::sync::Mutex::new(need_backfill.clone()));
    let total_inserted = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let coins_done = Arc::new(std::sync::atomic::AtomicU64::new(0));
    let coins_total = need_backfill.len() as u64;

    let mut handles = tokio::task::JoinSet::new();
    let concurrency = 3usize; // conservative for background task

    for worker_id in 0..concurrency {
        let queue = Arc::clone(&work_queue);
        let pool = pool.clone();
        let inserted_counter = Arc::clone(&total_inserted);
        let done_counter = Arc::clone(&coins_done);
        let key = api_key.to_string();
        let shared_limiter = limiter.clone();

        handles.spawn(async move {
            let client = match CoinGeckoClient::with_limiter(&key, shared_limiter) {
                Ok(c) => c,
                Err(e) => {
                    error!(?e, worker = worker_id, "Failed to create CoinGecko client");
                    return;
                }
            };

            loop {
                let coin_id = {
                    let mut q = queue.lock().await;
                    q.pop()
                };
                let coin_id = match coin_id {
                    Some(id) => id,
                    None => break,
                };

                let done = done_counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;

                match client.fetch_daily_market_chart(&coin_id).await {
                    Ok(data_points) => {
                        if data_points.is_empty() {
                            continue;
                        }
                        let rows: Vec<db::CgMarketCapRow> = data_points
                            .iter()
                            .map(|dp| db::CgMarketCapRow {
                                coin_id: coin_id.clone(),
                                symbol: None,
                                name: None,
                                market_cap_usd: Some(dp.market_cap),
                                price_usd: Some(dp.price),
                                total_volume_usd: Some(dp.volume),
                                market_cap_rank: None,
                                snapshot_date: dp.date,
                            })
                            .collect();

                        match db::cg_batch_upsert_market_caps(&pool, &rows).await {
                            Ok(inserted) => {
                                inserted_counter
                                    .fetch_add(inserted, std::sync::atomic::Ordering::Relaxed);
                                if done % 100 == 0 || done == coins_total {
                                    info!(
                                        coin = %coin_id,
                                        "[backfill {done}/{coins_total}] OK"
                                    );
                                }
                            }
                            Err(e) => {
                                error!(coin = %coin_id, %e, "Backfill DB insert failed");
                            }
                        }
                    }
                    Err(e) => {
                        warn!(
                            coin = %coin_id,
                            %e,
                            "[backfill {done}/{coins_total}] Failed"
                        );
                    }
                }
            }
        });
    }

    while let Some(result) = handles.join_next().await {
        if let Err(e) = result {
            error!(%e, "Backfill worker panicked");
        }
    }

    Ok(total_inserted.load(std::sync::atomic::Ordering::Relaxed))
}
