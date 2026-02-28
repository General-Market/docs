use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use chrono::{TimeZone, Utc};
use sqlx::PgPool;
use tracing::{error, info, warn};

use common::integrations::bitget::BitgetReadOnlyClientImpl;

use crate::bitget_init::create_bitget_client;
use crate::db;

/// Maximum backfill window (3 days). Caps how far back we'll ever look.
const MAX_BACKFILL_MS: u64 = 3 * 86_400_000;

/// Chunk size for incremental backfill (30 minutes). Keeps DB pool free between chunks.
const BACKFILL_CHUNK_MS: u64 = 30 * 60_000;

/// Pause between backfill chunks (seconds). Lets API queries get DB connections.
const BACKFILL_PAUSE_SECS: u64 = 5;

/// Load symbol-map.json and return the set of unique Bitget pair symbols (the values).
fn load_bitget_symbols(path: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(path)?;
    let raw: std::collections::HashMap<String, serde_json::Value> = serde_json::from_str(&content)?;

    let mut symbols: HashSet<String> = HashSet::new();
    for (_address, entry) in raw {
        if let Some(pair) = entry.get("pair").and_then(|v| v.as_str()) {
            symbols.insert(pair.to_string());
        }
    }

    let list: Vec<String> = symbols.into_iter().collect();
    info!(count = list.len(), path, "Kline collector: loaded symbols from symbol map");
    Ok(list)
}

pub async fn run(pool: PgPool, symbol_map_path: String) {
    let symbols = match load_bitget_symbols(&symbol_map_path) {
        Ok(s) => s,
        Err(e) => {
            error!(%e, "Kline collector: failed to load symbol map, cannot start");
            return;
        }
    };

    if symbols.is_empty() {
        warn!("Kline collector: no symbols found in symbol map, exiting");
        return;
    }

    let client = match create_bitget_client("kline_collector") {
        Some(c) => Arc::new(c),
        None => return,
    };

    // Unified loop: always backfill in small chunks, then poll for recent data.
    // On first run or after long downtime, this gradually catches up 30min at a time
    // with pauses so the API stays responsive. Once caught up, it polls every 60s.
    info!("Kline collector: entering main loop");

    loop {
        let now_ms = Utc::now().timestamp_millis() as u64;
        let symbol_refs: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();

        let gap_start_ms = match db::query_kline_staleness(&pool, &symbol_refs).await {
            Ok(Some(oldest_latest)) => {
                let stale_ms = oldest_latest.timestamp_millis() as u64;
                let gap_ms = now_ms.saturating_sub(stale_ms);

                if gap_ms <= 2 * 60_000 {
                    // Fresh — just fetch last few candles and sleep
                    fetch_recent_klines(&pool, &client, &symbols, now_ms, 5).await;
                    tokio::time::sleep(Duration::from_secs(60)).await;
                    continue;
                }

                // Cap at MAX_BACKFILL_MS
                if gap_ms > MAX_BACKFILL_MS { now_ms - MAX_BACKFILL_MS } else { stale_ms }
            }
            Ok(None) => {
                info!("Kline collector: no klines in DB, starting full backfill");
                now_ms - MAX_BACKFILL_MS
            }
            Err(e) => {
                warn!(%e, "Kline collector: staleness check failed, fetching recent only");
                fetch_recent_klines(&pool, &client, &symbols, now_ms, 10).await;
                tokio::time::sleep(Duration::from_secs(60)).await;
                continue;
            }
        };

        // Backfill one chunk (30 min window)
        let chunk_end = (gap_start_ms + BACKFILL_CHUNK_MS).min(now_ms);
        let gap_mins = (chunk_end - gap_start_ms) / 60_000;
        let remaining_mins = (now_ms - gap_start_ms) / 60_000;
        info!(
            chunk_minutes = gap_mins,
            remaining_minutes = remaining_mins,
            "Kline collector: backfilling chunk"
        );

        backfill_klines(&pool, &client, &symbols, gap_start_ms, chunk_end).await;

        // Pause between chunks so API can serve requests
        tokio::time::sleep(Duration::from_secs(BACKFILL_PAUSE_SECS)).await;
    }
}

/// Backfill klines from `start_ms` to `end_ms` for all symbols.
async fn backfill_klines(
    pool: &PgPool,
    client: &Arc<BitgetReadOnlyClientImpl>,
    symbols: &[String],
    start_ms: u64,
    end_ms: u64,
) {
    if end_ms <= start_ms {
        info!("Kline backfill: nothing to backfill (start >= end)");
        return;
    }

    let gap_mins = (end_ms - start_ms) / 60_000;
    info!(
        symbols = symbols.len(),
        gap_minutes = gap_mins,
        "Kline backfill: starting"
    );

    let pool = pool.clone();
    let client = Arc::clone(client);

    let total = crate::work_queue::run_work_queue(symbols.to_vec(), 5, move |symbol: String| {
        let pool = pool.clone();
        let client = Arc::clone(&client);
        async move {
            let mut cursor = end_ms;
            let mut symbol_total: u64 = 0;

            loop {
                match client.get_history_candles_ohlc(&symbol, "1min", cursor, 200).await {
                    Ok(candles) => {
                        if candles.is_empty() { break; }
                        let oldest_ts = candles[0].0;

                        let rows: Vec<_> = candles.iter()
                            .filter(|(ts, _, _, _, _)| *ts >= start_ms)
                            .filter_map(|(ts, open, high, low, close)| {
                                let base_secs = (*ts / 1000) as i64;
                                Utc.timestamp_opt(base_secs, 0).single().map(|dt| {
                                    (symbol.clone(), dt, open.clone(), high.clone(), low.clone(), close.clone())
                                })
                            })
                            .collect();

                        let in_range = candles.iter().filter(|(ts, _, _, _, _)| *ts >= start_ms).count() as u64;
                        match db::batch_upsert_klines(&pool, &rows).await {
                            Ok(inserted) => { symbol_total += inserted; }
                            Err(e) => { error!(symbol = %symbol, %e, "Kline backfill: failed to insert"); break; }
                        }

                        if oldest_ts <= start_ms || in_range == 0 { break; }
                        cursor = oldest_ts - 1;
                    }
                    Err(e) => {
                        warn!(symbol = %symbol, %e, "Kline backfill: failed to fetch, skipping remainder");
                        break;
                    }
                }
            }

            if symbol_total > 0 {
                info!(symbol = %symbol, rows = symbol_total, "Kline backfill: symbol done");
            }
            symbol_total
        }
    }).await;

    info!(total_rows = total, "Kline backfill: complete");
}

/// Quick fetch of the N most recent klines per symbol (no pagination needed).
async fn fetch_recent_klines(
    pool: &PgPool,
    client: &Arc<BitgetReadOnlyClientImpl>,
    symbols: &[String],
    now_ms: u64,
    limit: u32,
) {
    let pool = pool.clone();
    let client = Arc::clone(client);

    let total = crate::work_queue::run_work_queue(symbols.to_vec(), 5, move |symbol: String| {
        let pool = pool.clone();
        let client = Arc::clone(&client);
        async move {
            match client.get_history_candles_ohlc(&symbol, "1min", now_ms, limit).await {
                Ok(candles) => {
                    let rows: Vec<_> = candles
                        .iter()
                        .filter_map(|(ts, open, high, low, close)| {
                            let base_secs = (*ts / 1000) as i64;
                            Utc.timestamp_opt(base_secs, 0).single().map(|dt| {
                                (symbol.clone(), dt, open.clone(), high.clone(), low.clone(), close.clone())
                            })
                        })
                        .collect();
                    match db::batch_upsert_klines(&pool, &rows).await {
                        Ok(inserted) => inserted,
                        Err(e) => { warn!(symbol = %symbol, %e, "Kline poll: failed to upsert"); 0 }
                    }
                }
                Err(e) => { warn!(symbol = %symbol, %e, "Kline poll: failed to fetch"); 0 }
            }
        }
    }).await;

    info!(upserted = total, "Kline poll cycle complete");
}
