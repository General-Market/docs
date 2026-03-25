use std::sync::Arc;
use std::time::Duration;

use chrono::{Utc, TimeZone};
use ethers::prelude::*;
use ethers::types::Address;
use sqlx::PgPool;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::db;
use crate::evm_init::create_provider_and_address;

abigen!(
    TradeIndex,
    r#"[
        event OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
    ]"#
);

pub struct TradeCollectorState {
    pub last_block: RwLock<u64>,
}

impl TradeCollectorState {
    pub fn new() -> Self {
        Self {
            last_block: RwLock::new(0),
        }
    }
}

/// Backfill OrderSubmitted + FillConfirmed events in paginated batches with retry.
async fn backfill_trade_events(
    pool: &PgPool,
    contract: &TradeIndex<Provider<Http>>,
    from: u64,
    to: u64,
) {
    crate::backfill_util::backfill_paginated("trade", from, to, |batch_from, batch_to| {
        Box::pin(async move {
            let count = backfill_batch(pool, contract, batch_from, batch_to).await?;
            db::set_collector_cursor(pool, "trade_collector", batch_to).await.ok();
            Ok(count)
        })
    }).await;
}

/// Fetch block timestamp from chain, with cache to avoid redundant RPC calls.
async fn block_timestamp(
    provider: &Provider<Http>,
    block_num: u64,
    cache: &mut std::collections::HashMap<u64, chrono::DateTime<Utc>>,
) -> chrono::DateTime<Utc> {
    if let Some(ts) = cache.get(&block_num) {
        return *ts;
    }
    let ts = match provider.get_block(block_num).await {
        Ok(Some(block)) => Utc.timestamp_opt(block.timestamp.as_u64() as i64, 0)
            .single()
            .unwrap_or_else(Utc::now),
        _ => Utc::now(),
    };
    cache.insert(block_num, ts);
    ts
}

/// Process a single batch of blocks: query OrderSubmitted + FillConfirmed and store.
async fn backfill_batch(
    pool: &PgPool,
    contract: &TradeIndex<Provider<Http>>,
    from: u64,
    to: u64,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let mut count = 0;
    let provider = contract.client();
    let mut ts_cache = std::collections::HashMap::new();

    // OrderSubmitted
    let order_events = contract
        .order_submitted_filter()
        .from_block(from)
        .to_block(to)
        .query_with_meta()
        .await?;

    for (event, meta) in &order_events {
        let itp_id_hex = format!("0x{}", hex::encode(event.itp_id));
        let user_addr = format!("{:?}", event.user).to_lowercase();
        let ts = block_timestamp(&provider, meta.block_number.as_u64(), &mut ts_cache).await;
        if let Err(e) = db::upsert_trade(
            pool,
            event.order_id.as_u64() as i64,
            &user_addr,
            &itp_id_hex,
            event.side as i16,
            &event.amount.to_string(),
            &event.limit_price.to_string(),
            None,
            None,
            0,
            ts,
            None,
            meta.block_number.as_u64() as i64,
        )
        .await
        {
            warn!(order_id = ?event.order_id, %e, "Failed to upsert historical order");
        }
    }
    count += order_events.len();

    // FillConfirmed
    let fill_events = contract
        .fill_confirmed_filter()
        .from_block(from)
        .to_block(to)
        .query_with_meta()
        .await?;

    for (event, meta) in &fill_events {
        let ts = block_timestamp(&provider, meta.block_number.as_u64(), &mut ts_cache).await;
        sqlx::query(
            "UPDATE trades SET fill_price = $1, fill_amount = $2, status = 2, fill_timestamp = $3
             WHERE order_id = $4",
        )
        .bind(event.fill_price.to_string())
        .bind(event.fill_amount.to_string())
        .bind(ts)
        .bind(event.order_id.as_u64() as i64)
        .execute(pool)
        .await
        .ok();
    }
    count += fill_events.len();

    Ok(count)
}

pub async fn run(
    pool: PgPool,
    state: Arc<TradeCollectorState>,
    rpc_url: String,
    index_address: String,
    poll_interval_secs: u64,
) {
    let (provider, addr) = match create_provider_and_address(&rpc_url, &index_address, "trade_collector") {
        Some(pa) => pa,
        None => return,
    };

    let contract = TradeIndex::new(addr, provider.clone());
    let poll_interval = Duration::from_secs(poll_interval_secs);

    // === STARTUP: resume from persisted cursor ===
    let persisted_block = db::get_collector_cursor(&pool, "trade_collector")
        .await
        .unwrap_or(0);

    let current_block = match provider.get_block_number().await {
        Ok(b) => b.as_u64(),
        Err(e) => {
            error!(%e, "Failed to get current block number");
            return;
        }
    };

    if persisted_block < current_block {
        info!(from = persisted_block, to = current_block, "Backfilling missed trade events");
        backfill_trade_events(&pool, &contract, persisted_block, current_block).await;
    } else {
        info!(persisted_block, "Trade collector resuming — no backfill needed");
    }

    *state.last_block.write().await = current_block;
    db::set_collector_cursor(&pool, "trade_collector", current_block)
        .await
        .ok();
    info!(current_block, "Trade collector initialized, entering poll loop");

    // === POLL LOOP ===
    loop {
        tokio::time::sleep(poll_interval).await;

        let from_block = *state.last_block.read().await + 1;
        let to_block = match provider.get_block_number().await {
            Ok(b) => b.as_u64(),
            Err(e) => {
                warn!(%e, "Trade collector: failed to get block number");
                continue;
            }
        };

        if to_block < from_block {
            continue;
        }

        let mut ts_cache = std::collections::HashMap::new();

        // Query new OrderSubmitted events
        let order_filter = contract
            .order_submitted_filter()
            .from_block(from_block)
            .to_block(to_block);

        if let Ok(events) = order_filter.query_with_meta().await {
            for (event, meta) in &events {
                let itp_id_hex = format!("0x{}", hex::encode(event.itp_id));
                let user_addr = format!("{:?}", event.user).to_lowercase();
                let ts = block_timestamp(&provider, meta.block_number.as_u64(), &mut ts_cache).await;
                if let Err(e) = db::upsert_trade(
                    &pool,
                    event.order_id.as_u64() as i64,
                    &user_addr,
                    &itp_id_hex,
                    event.side as i16,
                    &event.amount.to_string(),
                    &event.limit_price.to_string(),
                    None,
                    None,
                    0, // pending
                    ts,
                    None,
                    meta.block_number.as_u64() as i64,
                )
                .await
                {
                    error!(order_id = ?event.order_id, %e, "Failed to upsert order");
                }
            }
            if !events.is_empty() {
                info!(count = events.len(), "Processed new OrderSubmitted events");
            }
        }

        // Query new FillConfirmed events
        let fill_filter = contract
            .fill_confirmed_filter()
            .from_block(from_block)
            .to_block(to_block);

        if let Ok(events) = fill_filter.query_with_meta().await {
            for (event, meta) in &events {
                let ts = block_timestamp(&provider, meta.block_number.as_u64(), &mut ts_cache).await;
                if let Err(e) = sqlx::query(
                    "UPDATE trades SET fill_price = $1, fill_amount = $2, status = 2, fill_timestamp = $3
                     WHERE order_id = $4",
                )
                .bind(event.fill_price.to_string())
                .bind(event.fill_amount.to_string())
                .bind(ts)
                .bind(event.order_id.as_u64() as i64)
                .execute(&pool)
                .await
                {
                    error!(order_id = ?event.order_id, %e, "Failed to update fill");
                }
            }
            if !events.is_empty() {
                info!(count = events.len(), "Processed new FillConfirmed events");
            }
        }

        *state.last_block.write().await = to_block;
        db::set_collector_cursor(&pool, "trade_collector", to_block).await.ok();
    }
}
