//! DefiLlama one-shot backfill CLI command.
//!
//! Usage: `./data-node dl-backfill --database-url postgres://... --concurrency 3`
//! Resumable via defillama_backfill_progress table.

use std::sync::Arc;
use std::time::Duration;

use sqlx::PgPool;
use tracing::{error, info, warn};

use crate::coingecko::RateLimiter;
use crate::config::DlBackfillArgs;
use crate::db;
use crate::defillama::DlClient;

pub async fn run(args: DlBackfillArgs) -> Result<(), Box<dyn std::error::Error>> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&args.log_level));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    info!("DefiLlama backfill starting");

    let pool = db::create_pool(&args.database_url).await?;
    db::run_migrations(&pool).await?;

    // First sync protocols if table is empty
    let proto_count = db::dl_protocol_count(&pool).await?;
    if proto_count == 0 {
        info!("No protocols in DB, fetching from DefiLlama first...");
        let client = DlClient::new();
        let protocols = client.fetch_protocols().await.map_err(|e| format!("{e}"))?;
        let rows: Vec<_> = protocols.iter().map(|p| {
            (p.slug.clone(), p.name.clone(), p.gecko_id.clone(), p.symbol.clone(),
             p.category.clone(), p.chains.clone(), p.tvl, p.change_1d, p.change_7d, p.mcap)
        }).collect();
        db::dl_batch_upsert_protocols(&pool, &rows).await?;
        info!(count = protocols.len(), "Protocols synced");
    }

    let all_slugs = db::dl_query_all_protocol_slugs(&pool).await?;
    info!(total = all_slugs.len(), "Total protocols to backfill");

    for metric_type in &["tvl", "fees", "volume"] {
        let already_done = db::dl_get_backfilled_slugs(&pool, metric_type).await?;
        let need_backfill: Vec<String> = all_slugs
            .iter()
            .filter(|s| !already_done.contains(*s))
            .cloned()
            .collect();

        if need_backfill.is_empty() {
            info!(metric = metric_type, "All protocols already backfilled");
            continue;
        }

        info!(
            metric = metric_type,
            remaining = need_backfill.len(),
            already_done = already_done.len(),
            "Starting backfill"
        );

        let work_queue = Arc::new(tokio::sync::Mutex::new(need_backfill.clone()));
        let done_count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let total_slugs = need_backfill.len();

        let mut handles = tokio::task::JoinSet::new();

        for _ in 0..args.concurrency {
            let queue = Arc::clone(&work_queue);
            let pool = pool.clone();
            let done = Arc::clone(&done_count);
            let mt = metric_type.to_string();
            let limiter = RateLimiter::new(Duration::from_millis(100));
            let client = DlClient::with_limiter(limiter);

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

                    match backfill_one(&pool, &client, &slug, &mt).await {
                        Ok(rows) => {
                            if count % 100 == 0 || count == total_slugs {
                                info!(
                                    metric = mt,
                                    "[{count}/{total_slugs}] {slug} = {rows} rows"
                                );
                            }
                        }
                        Err(e) => {
                            if !e.contains("400") && !e.contains("404") {
                                warn!(slug, metric = mt, %e, "Backfill failed");
                            }
                            let _ = db::dl_mark_backfill_done(&pool, &slug, &mt, 0).await;
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

        info!(
            metric = metric_type,
            done = done_count.load(std::sync::atomic::Ordering::Relaxed),
            "Backfill complete for metric"
        );
    }

    info!("DefiLlama backfill complete");
    Ok(())
}

async fn backfill_one(
    pool: &PgPool,
    client: &DlClient,
    slug: &str,
    metric_type: &str,
) -> Result<usize, String> {
    let rows: Vec<(String, chrono::NaiveDate, String, f64)> = match metric_type {
        "tvl" => {
            let detail = client.fetch_protocol_tvl_history(slug).await.map_err(|e| e.to_string())?;
            detail.tvl.iter().filter_map(|dp| {
                let dt = chrono::DateTime::from_timestamp(dp.date, 0)?;
                let value = dp.total_liquidity_usd?;
                if value > 0.0 {
                    Some((slug.to_string(), dt.date_naive(), "tvl".to_string(), value))
                } else {
                    None
                }
            }).collect()
        }
        "fees" => {
            let resp = client.fetch_protocol_fee_history(slug).await.map_err(|e| e.to_string())?;
            resp.total_data_chart.iter().filter_map(|e| {
                let dt = chrono::DateTime::from_timestamp(e.timestamp, 0)?;
                if e.value > 0.0 {
                    Some((slug.to_string(), dt.date_naive(), "fees".to_string(), e.value))
                } else {
                    None
                }
            }).collect()
        }
        "volume" => {
            let resp = client.fetch_protocol_volume_history(slug).await.map_err(|e| e.to_string())?;
            resp.total_data_chart.iter().filter_map(|e| {
                let dt = chrono::DateTime::from_timestamp(e.timestamp, 0)?;
                if e.value > 0.0 {
                    Some((slug.to_string(), dt.date_naive(), "volume".to_string(), e.value))
                } else {
                    None
                }
            }).collect()
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
