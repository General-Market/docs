//! Postgres writer. Consumes parsed events, upserts by signature.
//!
//! All inserts use `ON CONFLICT (signature) DO NOTHING`. Replays of the
//! same log stream are idempotent — a crash during a write batch is
//! recoverable by restarting the subscriber.
//!
//! `log_index` records the position of the event within the transaction
//! so downstream queries can order multi-event transactions correctly.

use anyhow::{Context, Result};
use deadpool_postgres::Pool;
use solana_commitment_config::CommitmentConfig;
use solana_client::nonblocking::rpc_client::RpcClient;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::Receiver;
use tokio::sync::Mutex;
use tracing::{debug, error, warn};

use crate::config::Config;
use crate::parser::{self, Event};
use crate::subscriber::RawLog;

pub async fn run(cfg: Config, pool: Pool, mut rx: Receiver<RawLog>) -> Result<()> {
    // Block-time cache — logsSubscribe delivers slots but not timestamps.
    // We fetch on demand and memoize the result so a burst of events
    // from the same slot hits Postgres once.
    let rpc = Arc::new(RpcClient::new_with_commitment(
        cfg.rpc_http_url.clone(),
        CommitmentConfig::confirmed(),
    ));
    let block_time_cache: Arc<Mutex<HashMap<u64, Option<i64>>>> =
        Arc::new(Mutex::new(HashMap::new()));

    while let Some(raw) = rx.recv().await {
        // Skip failed transactions — they never committed state; any
        // event logs inside them are informational only and would
        // pollute queries.
        if raw.err.is_some() {
            debug!(sig = %raw.signature, err = ?raw.err, "skipping failed tx");
            continue;
        }

        let events = parser::parse_logs(&raw.logs);
        if events.is_empty() {
            continue;
        }

        let block_time = fetch_block_time(&rpc, &block_time_cache, raw.slot).await;

        if let Err(e) = write_batch(&pool, &raw, block_time, &events).await {
            error!(sig = %raw.signature, error = %e, "failed to write event batch");
            // Don't bail — keep processing. The offending batch can be
            // reconciled from on-chain logs later.
        }
    }
    Ok(())
}

async fn fetch_block_time(
    rpc: &RpcClient,
    cache: &Mutex<HashMap<u64, Option<i64>>>,
    slot: u64,
) -> Option<i64> {
    {
        let guard = cache.lock().await;
        if let Some(v) = guard.get(&slot) {
            return *v;
        }
    }
    let resolved = match rpc.get_block_time(slot).await {
        Ok(t) => Some(t),
        Err(e) => {
            warn!(slot, error = %e, "get_block_time failed; storing null");
            None
        }
    };
    let mut guard = cache.lock().await;
    // Bound the cache — drop everything older than the current slot - 10k
    // to keep memory flat over long runs.
    if guard.len() > 20_000 {
        let threshold = slot.saturating_sub(10_000);
        guard.retain(|k, _| *k >= threshold);
    }
    guard.insert(slot, resolved);
    resolved
}

async fn write_batch(
    pool: &Pool,
    raw: &RawLog,
    block_time: Option<i64>,
    events: &[Event],
) -> Result<()> {
    let mut client = pool.get().await.context("checkout failed")?;
    let tx = client.transaction().await?;

    // Upsert the transaction metadata once. Every event row also stores
    // slot/block_time denormalized to keep query paths one-table.
    tx.execute(
        "INSERT INTO transactions (signature, slot, block_time) \
         VALUES ($1, $2, $3) \
         ON CONFLICT (signature) DO NOTHING",
        &[&raw.signature, &(raw.slot as i64), &block_time],
    ).await.context("transactions upsert failed")?;

    for (idx, ev) in events.iter().enumerate() {
        let log_index = idx as i32;
        match ev {
            Event::BetPlaced { market, owner, side, amount } => {
                tx.execute(
                    "INSERT INTO bet_placed \
                     (signature, slot, block_time, log_index, market, owner, side, amount) \
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::numeric) \
                     ON CONFLICT (signature) DO NOTHING",
                    &[&raw.signature, &(raw.slot as i64), &block_time, &log_index,
                      &bs58_encode(market), &bs58_encode(owner), &(*side as i16),
                      &u64_to_numeric_string(*amount)],
                ).await?;
            }
            Event::BetExited { market, owner, side, amount } => {
                tx.execute(
                    "INSERT INTO bet_exited \
                     (signature, slot, block_time, log_index, market, owner, side, amount) \
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::numeric) \
                     ON CONFLICT (signature) DO NOTHING",
                    &[&raw.signature, &(raw.slot as i64), &block_time, &log_index,
                      &bs58_encode(market), &bs58_encode(owner), &(*side as i16),
                      &u64_to_numeric_string(*amount)],
                ).await?;
            }
            Event::MarketInstantiated { market, source_id, close_time, settlement_time, threshold_bps, creator } => {
                tx.execute(
                    "INSERT INTO market_instantiated \
                     (signature, slot, block_time, log_index, market, source_id, close_time, settlement_time, threshold_bps, creator) \
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) \
                     ON CONFLICT (signature) DO NOTHING",
                    &[&raw.signature, &(raw.slot as i64), &block_time, &log_index,
                      &bs58_encode(market), &(*source_id as i64), close_time, settlement_time,
                      threshold_bps, &bs58_encode(creator)],
                ).await?;
            }
            Event::MarketClosed { market, baseline_price } => {
                tx.execute(
                    "INSERT INTO market_closed \
                     (signature, slot, block_time, log_index, market, baseline_price) \
                     VALUES ($1,$2,$3,$4,$5,$6::numeric) \
                     ON CONFLICT (signature) DO NOTHING",
                    &[&raw.signature, &(raw.slot as i64), &block_time, &log_index,
                      &bs58_encode(market), &u128_to_numeric_string(*baseline_price)],
                ).await?;
            }
            Event::MarketResolved { market, baseline_price, final_price, outcome_yes, force_resolved } => {
                tx.execute(
                    "INSERT INTO market_resolved \
                     (signature, slot, block_time, log_index, market, baseline_price, final_price, outcome_yes, force_resolved) \
                     VALUES ($1,$2,$3,$4,$5,$6::numeric,$7::numeric,$8,$9) \
                     ON CONFLICT (signature) DO NOTHING",
                    &[&raw.signature, &(raw.slot as i64), &block_time, &log_index,
                      &bs58_encode(market),
                      &u128_to_numeric_string(*baseline_price),
                      &u128_to_numeric_string(*final_price),
                      outcome_yes, force_resolved],
                ).await?;
            }
            Event::Claimed { market, owner, net, fee, stranded } => {
                tx.execute(
                    "INSERT INTO claimed \
                     (signature, slot, block_time, log_index, market, owner, net, fee, stranded) \
                     VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8::numeric,$9) \
                     ON CONFLICT (signature) DO NOTHING",
                    &[&raw.signature, &(raw.slot as i64), &block_time, &log_index,
                      &bs58_encode(market), &bs58_encode(owner),
                      &u64_to_numeric_string(*net), &u64_to_numeric_string(*fee),
                      stranded],
                ).await?;
            }
        }
    }

    tx.commit().await.context("commit failed")?;
    debug!(sig = %raw.signature, count = events.len(), "wrote events");
    Ok(())
}

fn bs58_encode(bytes: &[u8; 32]) -> String {
    bs58::encode(bytes).into_string()
}

/// tokio-postgres has no built-in u64 / u128 binding for NUMERIC. We
/// send the value as a stringified decimal, which Postgres casts to
/// NUMERIC at insert time. Clean; avoids pulling in rust_decimal just
/// to shuttle unsigned 64/128-bit integers across the wire.
fn u64_to_numeric_string(v: u64) -> String { v.to_string() }
fn u128_to_numeric_string(v: u128) -> String { v.to_string() }

// Silence unused import if this module is compiled with no Event variants.
#[allow(dead_code)]
const _KEEPALIVE: Duration = Duration::from_secs(0);
