//! DefiLlama data collector.
//!
//! Two tasks:
//! 1. Daily sync (every 24h): protocols, fees, revenue, volume, yields, raises
//! 2. Incremental backfill (every 4h): historical TVL/fees/volume per protocol

use std::sync::Arc;
use std::time::Duration;

use chrono::{NaiveDate, Utc};
use sqlx::PgPool;
use tracing::{error, info, warn};

use crate::coingecko::RateLimiter;
use crate::db;
use crate::defillama::DlClient;

/// 4 hours between backfill cycles
const BACKFILL_INTERVAL_SECS: u64 = 4 * 3600;
/// Max concurrent workers for backfill
const BACKFILL_CONCURRENCY: usize = 3;

/// Run a single DefiLlama sync cycle (protocols + metrics). Called before the loop
/// to ensure DL data is available for sim cache reload.
pub async fn run_once(pool: &PgPool) {
    let limiter = RateLimiter::new(Duration::from_millis(100));
    let client = DlClient::with_limiter(limiter);
    match run_daily_sync(pool, &client).await {
        Ok(count) => info!(protocols = count, "DefiLlama initial sync complete"),
        Err(e) => error!(%e, "DefiLlama initial sync failed"),
    }
}

/// Run the DefiLlama collector loop (called from main.rs).
pub async fn run(pool: PgPool, poll_interval_secs: u64) {
    let limiter = RateLimiter::new(Duration::from_millis(100));

    info!(
        poll_secs = poll_interval_secs,
        backfill_interval_secs = BACKFILL_INTERVAL_SECS,
        "DefiLlama collector started"
    );

    let poll_interval = Duration::from_secs(poll_interval_secs);
    let backfill_interval = Duration::from_secs(BACKFILL_INTERVAL_SECS);
    let mut last_backfill = tokio::time::Instant::now() - backfill_interval;

    loop {
        // --- Daily sync ---
        let client = DlClient::with_limiter(limiter.clone());

        match run_daily_sync(&pool, &client).await {
            Ok(count) => {
                info!(protocols = count, "DefiLlama daily sync complete");
            }
            Err(e) => {
                error!(%e, "DefiLlama daily sync failed");
            }
        }

        // --- Incremental backfill (every 4h) ---
        if last_backfill.elapsed() >= backfill_interval {
            info!("Starting DefiLlama incremental backfill");
            let bf_client = DlClient::with_limiter(limiter.clone());
            match run_incremental_backfill(&pool, &bf_client).await {
                Ok(count) => {
                    info!(protocols_backfilled = count, "DefiLlama backfill cycle complete");
                }
                Err(e) => {
                    error!(%e, "DefiLlama backfill cycle failed");
                }
            }
            last_backfill = tokio::time::Instant::now();
        }

        tokio::time::sleep(poll_interval).await;
    }
}

/// Daily sync: fetch all protocols, metrics, yields, raises.
async fn run_daily_sync(
    pool: &PgPool,
    client: &DlClient,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let today = Utc::now().date_naive();

    // 1. Fetch all protocols
    let protocols = client.fetch_protocols().await?;
    let protocol_count = protocols.len();
    info!(count = protocol_count, "Fetched DefiLlama protocols");

    let protocol_rows: Vec<_> = protocols
        .iter()
        .map(|p| {
            (
                p.slug.clone(),
                p.name.clone(),
                p.gecko_id.clone(),
                p.symbol.clone(),
                p.category.clone(),
                p.chains.clone(),
                p.tvl,
                p.change_1d,
                p.change_7d,
                p.mcap,
            )
        })
        .collect();

    db::dl_batch_upsert_protocols(pool, &protocol_rows).await?;
    info!(count = protocol_count, "Upserted DefiLlama protocols");

    // 2. Fetch fees overview
    match client.fetch_fees_overview().await {
        Ok(resp) => {
            let rows: Vec<_> = resp.protocols.iter().filter_map(|p| {
                let slug = p.defillama_id.as_ref()?;
                Some((slug.clone(), today, "fees".to_string(), p.total24h, p.total7d, p.total30d))
            }).collect();
            let count = rows.len();
            db::dl_batch_upsert_metrics(pool, &rows).await?;
            info!(count, "Synced DefiLlama fees metrics");
        }
        Err(e) => warn!(%e, "Failed to fetch fees overview"),
    }

    // 3. Fetch revenue overview
    match client.fetch_revenue_overview().await {
        Ok(resp) => {
            let rows: Vec<_> = resp.protocols.iter().filter_map(|p| {
                let slug = p.defillama_id.as_ref()?;
                Some((slug.clone(), today, "revenue".to_string(), p.total24h, p.total7d, p.total30d))
            }).collect();
            let count = rows.len();
            db::dl_batch_upsert_metrics(pool, &rows).await?;
            info!(count, "Synced DefiLlama revenue metrics");
        }
        Err(e) => warn!(%e, "Failed to fetch revenue overview"),
    }

    // 4. Fetch volume: DEX + derivatives + options + aggregators → all type=volume
    let mut volume_rows = Vec::new();
    for (name, fetcher) in [
        ("dex", client.fetch_dex_overview().await),
        ("derivatives", client.fetch_derivatives_overview().await),
        ("options", client.fetch_options_overview().await),
        ("aggregators", client.fetch_aggregators_overview().await),
    ] {
        match fetcher {
            Ok(resp) => {
                for p in &resp.protocols {
                    if let Some(slug) = &p.defillama_id {
                        volume_rows.push((slug.clone(), today, "volume".to_string(), p.total24h, p.total7d, p.total30d));
                    }
                }
                info!(source = name, count = resp.protocols.len(), "Fetched volume overview");
            }
            Err(e) => warn!(source = name, %e, "Failed to fetch volume overview"),
        }
    }
    if !volume_rows.is_empty() {
        let count = volume_rows.len();
        db::dl_batch_upsert_metrics(pool, &volume_rows).await?;
        info!(count, "Synced DefiLlama volume metrics");
    }

    // 5. Fetch yield pools
    match client.fetch_yield_pools().await {
        Ok(resp) => {
            let rows: Vec<_> = resp.data.iter().map(|p| {
                (
                    p.pool.clone(),
                    p.chain.clone().unwrap_or_default(),
                    p.project.clone().unwrap_or_default(),
                    p.symbol.clone(),
                    p.tvl_usd,
                    p.apy,
                    p.apy_base,
                    p.apy_reward,
                )
            }).collect();
            let count = rows.len();
            db::dl_batch_upsert_yield_pools(pool, &rows).await?;
            info!(count, "Synced DefiLlama yield pools");
        }
        Err(e) => warn!(%e, "Failed to fetch yield pools"),
    }

    // 6. Fetch raises
    match client.fetch_raises().await {
        Ok(resp) => {
            let rows: Vec<_> = resp.raises.iter().map(|r| {
                let raise_date = r.date.and_then(|ts| {
                    chrono::DateTime::from_timestamp(ts, 0).map(|dt| dt.date_naive())
                });
                (
                    r.name.clone().unwrap_or_default(),
                    r.defillama_id.clone(),
                    r.round.clone(),
                    r.amount,
                    r.valuation,
                    raise_date,
                    r.category.clone(),
                    r.chains.clone(),
                    r.lead_investors.clone(),
                    r.other_investors.clone(),
                    r.source.clone(),
                )
            }).collect();
            let count = rows.len();
            db::dl_batch_upsert_raises(pool, &rows).await?;
            info!(count, "Synced DefiLlama raises");
        }
        Err(e) => warn!(%e, "Failed to fetch raises"),
    }

    Ok(protocol_count)
}

/// Incremental backfill: fetch history for protocols not yet backfilled.
/// 3 concurrent workers, resumable via defillama_backfill_progress table.
async fn run_incremental_backfill(
    pool: &PgPool,
    client: &DlClient,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let all_slugs = db::dl_query_all_protocol_slugs(pool).await?;

    // Process each metric type
    let mut total_done = 0usize;
    for metric_type in &["tvl", "fees", "volume"] {
        let already_done = db::dl_get_backfilled_slugs(pool, metric_type).await?;
        let need_backfill: Vec<String> = all_slugs
            .iter()
            .filter(|s| !already_done.contains(*s))
            .cloned()
            .collect();

        if need_backfill.is_empty() {
            continue;
        }

        info!(
            metric = metric_type,
            remaining = need_backfill.len(),
            already_done = already_done.len(),
            "DefiLlama backfill: starting"
        );

        let work_queue = Arc::new(tokio::sync::Mutex::new(need_backfill.clone()));
        let done_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let total_slugs = need_backfill.len();

        // Limit to 50 protocols per cycle to avoid monopolizing the rate limiter
        let max_per_cycle = 50;
        let mut handles = tokio::task::JoinSet::new();

        for _ in 0..BACKFILL_CONCURRENCY {
            let queue = Arc::clone(&work_queue);
            let pool = pool.clone();
            let done = Arc::clone(&done_count);
            let mt = metric_type.to_string();
            let limiter = RateLimiter::new(Duration::from_millis(100));
            let worker_client = DlClient::with_limiter(limiter);

            handles.spawn(async move {
                loop {
                    let slug = {
                        let mut q = queue.lock().await;
                        q.pop()
                    };
                    let slug = match slug {
                        Some(s) => s,
                        None => break,
                    };

                    let count = done.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                    if count > max_per_cycle {
                        break;
                    }

                    match backfill_one_protocol(&pool, &worker_client, &slug, &mt).await {
                        Ok(rows) => {
                            if count % 50 == 0 || count == total_slugs.min(max_per_cycle) {
                                info!(
                                    metric = mt,
                                    "[dl-backfill {count}/{total_slugs}] {slug} = {rows} rows"
                                );
                            }
                        }
                        Err(e) => {
                            // 400/404 is expected for protocols without this metric
                            if !e.contains("400") && !e.contains("404") {
                                warn!(slug, metric = mt, %e, "Backfill failed");
                            }
                            // Mark as done anyway (no data available)
                            let _ = db::dl_mark_backfill_done(&pool, &slug, &mt, 0).await;
                        }
                    }
                }
            });
        }

        while let Some(result) = handles.join_next().await {
            if let Err(e) = result {
                error!(%e, "DefiLlama backfill worker panicked");
            }
        }

        let cycle_done = done_count.load(std::sync::atomic::Ordering::Relaxed);
        total_done += cycle_done;
    }

    Ok(total_done)
}

/// Backfill history for one protocol + one metric type.
async fn backfill_one_protocol(
    pool: &PgPool,
    client: &DlClient,
    slug: &str,
    metric_type: &str,
) -> Result<usize, String> {
    let rows: Vec<(String, NaiveDate, String, f64)> = match metric_type {
        "tvl" => {
            let detail = client.fetch_protocol_tvl_history(slug).await.map_err(|e| e.to_string())?;
            detail
                .tvl
                .iter()
                .filter_map(|dp| {
                    let dt = chrono::DateTime::from_timestamp(dp.date, 0)?;
                    let value = dp.total_liquidity_usd?;
                    if value > 0.0 {
                        Some((slug.to_string(), dt.date_naive(), "tvl".to_string(), value))
                    } else {
                        None
                    }
                })
                .collect()
        }
        "fees" => {
            let resp = client.fetch_protocol_fee_history(slug).await.map_err(|e| e.to_string())?;
            resp.total_data_chart
                .iter()
                .filter_map(|entry| {
                    let dt = chrono::DateTime::from_timestamp(entry.timestamp, 0)?;
                    if entry.value > 0.0 {
                        Some((slug.to_string(), dt.date_naive(), "fees".to_string(), entry.value))
                    } else {
                        None
                    }
                })
                .collect()
        }
        "volume" => {
            let resp = client.fetch_protocol_volume_history(slug).await.map_err(|e| e.to_string())?;
            resp.total_data_chart
                .iter()
                .filter_map(|entry| {
                    let dt = chrono::DateTime::from_timestamp(entry.timestamp, 0)?;
                    if entry.value > 0.0 {
                        Some((slug.to_string(), dt.date_naive(), "volume".to_string(), entry.value))
                    } else {
                        None
                    }
                })
                .collect()
        }
        _ => return Err(format!("unknown metric type: {metric_type}")),
    };

    let count = rows.len();
    if !rows.is_empty() {
        db::dl_batch_upsert_history(pool, &rows).await.map_err(|e| e.to_string())?;
    }
    db::dl_mark_backfill_done(pool, slug, metric_type, count as i64).await.map_err(|e| e.to_string())?;

    Ok(count)
}
