use std::collections::HashMap;
use std::time::Duration;

use chrono::Utc;
use sqlx::PgPool;
use tracing::{error, info, warn};

use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};
use common::BitgetReadOnlyClient;

use crate::db;

pub async fn run(
    pool: PgPool,
    symbols: Vec<String>,
    poll_interval_secs: u64,
    retention_days: u32,
) {
    let bitget_config = match BitgetReadOnlyConfig::from_env() {
        Ok(c) => c,
        Err(e) => {
            error!(?e, "Liquidity collector: failed to load Bitget config");
            return;
        }
    };

    let client = match BitgetReadOnlyClientImpl::new(bitget_config) {
        Ok(c) => c,
        Err(e) => {
            error!(?e, "Liquidity collector: failed to create Bitget client");
            return;
        }
    };

    let poll_interval = Duration::from_secs(poll_interval_secs);
    let mut prune_counter: u64 = 0;
    let prune_every = 86400 / poll_interval_secs; // once per day

    info!(
        poll_interval_secs,
        symbols = symbols.len(),
        "Liquidity collector started"
    );

    loop {
        let sweep_start = std::time::Instant::now();

        // 1. Fetch all tickers once for 24h volume
        let volume_map: HashMap<String, f32> = match client.get_all_tickers().await {
            Ok(tickers) => tickers
                .into_iter()
                .filter_map(|t| {
                    let vol: f32 = t.usdt_volume.parse().ok()?;
                    Some((t.symbol, vol))
                })
                .collect(),
            Err(e) => {
                warn!(?e, "Liquidity collector: failed to fetch tickers for volume");
                HashMap::new()
            }
        };

        // 2. Fetch orderbook for each symbol and compute metrics
        let mut rows: Vec<db::LiquidityRow> = Vec::with_capacity(symbols.len());
        let mut errors: usize = 0;
        let now = Utc::now();

        for symbol in &symbols {
            match client.get_orderbook(symbol, 50).await {
                Ok(book) => {
                    if book.bids.is_empty() || book.asks.is_empty() {
                        continue;
                    }

                    let best_bid = book.bids[0].0;
                    let best_ask = book.asks[0].0;
                    let mid = (best_bid + best_ask) / 2.0;

                    if mid <= 0.0 {
                        continue;
                    }

                    let spread_bps = ((best_ask - best_bid) / mid * 10_000.0) as f32;

                    // Compute cumulative USD depth within percentage thresholds
                    let bid_depth_1pct = cumulative_depth(&book.bids, mid, 0.01, true);
                    let ask_depth_1pct = cumulative_depth(&book.asks, mid, 0.01, false);
                    let bid_depth_2pct = cumulative_depth(&book.bids, mid, 0.02, true);
                    let ask_depth_2pct = cumulative_depth(&book.asks, mid, 0.02, false);

                    let volume_24h_usd = volume_map.get(symbol.as_str()).copied().unwrap_or(0.0);

                    rows.push(db::LiquidityRow {
                        symbol: symbol.clone(),
                        spread_bps,
                        bid_depth_1pct,
                        ask_depth_1pct,
                        bid_depth_2pct,
                        ask_depth_2pct,
                        volume_24h_usd,
                        mid_price: format!("{}", mid),
                        fetched_at: now,
                    });
                }
                Err(e) => {
                    errors += 1;
                    if errors <= 5 {
                        warn!(symbol, ?e, "Liquidity collector: orderbook fetch failed");
                    }
                }
            }

            // Throttle: ~5 req/sec (200ms gap) to stay within rate limits
            tokio::time::sleep(Duration::from_millis(200)).await;
        }

        let elapsed = sweep_start.elapsed();

        // 3. Batch insert
        match db::batch_insert_liquidity(&pool, &rows).await {
            Ok(inserted) => {
                info!(
                    symbols_fetched = rows.len(),
                    errors,
                    inserted,
                    elapsed_secs = elapsed.as_secs(),
                    "Liquidity sweep complete"
                );
            }
            Err(e) => {
                error!(%e, "Liquidity collector: failed to insert into database");
            }
        }

        // 4. Periodic retention pruning
        prune_counter += 1;
        if prune_counter >= prune_every {
            prune_counter = 0;
            if let Err(e) = db::prune_old_liquidity(&pool, retention_days).await {
                warn!(%e, "Failed to prune old liquidity records");
            }
        }

        // Sleep until next poll (subtract sweep time)
        let sleep_dur = poll_interval.saturating_sub(elapsed);
        if !sleep_dur.is_zero() {
            tokio::time::sleep(sleep_dur).await;
        }
    }
}

/// Cumulative USD depth within a percentage of mid price.
/// For bids: levels where price >= mid * (1 - pct)
/// For asks: levels where price <= mid * (1 + pct)
fn cumulative_depth(levels: &[(f64, f64)], mid: f64, pct: f64, is_bid: bool) -> f32 {
    let mut total_usd: f64 = 0.0;
    for &(price, size) in levels {
        let within = if is_bid {
            price >= mid * (1.0 - pct)
        } else {
            price <= mid * (1.0 + pct)
        };
        if within {
            total_usd += price * size;
        }
    }
    total_usd as f32
}
