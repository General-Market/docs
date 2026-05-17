//! Global Morpho event collector.
//!
//! Scans the L3 Morpho contract for the six loan-side events used by the
//! DTF Fills chart and the order-lifecycle chart. The per-user RPC scan in
//! `/morpho-history` answers a different question (a single account's
//! position history) — this one writes an append-only ledger keyed by
//! (block_number, log_index) that any aggregate query can lean on.

use std::sync::Arc;
use std::time::Duration;

use chrono::{TimeZone, Utc};
use ethers::prelude::*;
use ethers::types::{Address, H256};
use sqlx::PgPool;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::db;
use crate::evm_init::create_provider_and_address;

const CURSOR_NAME: &str = "morpho_collector";

pub struct MorphoCollectorState {
    pub last_block: RwLock<u64>,
}

impl MorphoCollectorState {
    pub fn new() -> Self {
        Self { last_block: RwLock::new(0) }
    }
}

#[derive(Clone, Copy, Debug)]
struct EventDesc {
    kind: i16,
    token: &'static str,
    amount_offset: usize,
    sig: H256,
}

fn event_table() -> [EventDesc; 6] {
    let kc = ethers::core::utils::keccak256;
    [
        // Supply(bytes32 id, address caller, address onBehalf, uint256 assets, uint256 shares)
        // data layout: [assets, shares]
        EventDesc { kind: 0, token: "WUSDC", amount_offset: 0,
            sig: H256::from(kc("Supply(bytes32,address,address,uint256,uint256)")) },
        // Withdraw(bytes32 id, address caller, address onBehalf, address receiver, uint256 assets, uint256 shares)
        // data layout: [receiver, assets, shares]
        EventDesc { kind: 1, token: "WUSDC", amount_offset: 32,
            sig: H256::from(kc("Withdraw(bytes32,address,address,address,uint256,uint256)")) },
        // Borrow(bytes32 id, address caller, address onBehalf, address receiver, uint256 assets, uint256 shares)
        // data layout: [receiver, assets, shares]
        EventDesc { kind: 2, token: "WUSDC", amount_offset: 32,
            sig: H256::from(kc("Borrow(bytes32,address,address,address,uint256,uint256)")) },
        // Repay(bytes32 id, address caller, address onBehalf, uint256 assets, uint256 shares)
        // data layout: [assets, shares]
        EventDesc { kind: 3, token: "WUSDC", amount_offset: 0,
            sig: H256::from(kc("Repay(bytes32,address,address,uint256,uint256)")) },
        // SupplyCollateral(bytes32 id, address caller, address onBehalf, uint256 assets)
        // data layout: [assets]
        EventDesc { kind: 4, token: "ITP", amount_offset: 0,
            sig: H256::from(kc("SupplyCollateral(bytes32,address,address,uint256)")) },
        // WithdrawCollateral(bytes32 id, address caller, address onBehalf, address receiver, uint256 assets)
        // data layout: [receiver, assets]
        EventDesc { kind: 5, token: "ITP", amount_offset: 32,
            sig: H256::from(kc("WithdrawCollateral(bytes32,address,address,address,uint256)")) },
    ]
}

fn classify(topic0: H256) -> Option<EventDesc> {
    event_table().into_iter().find(|d| d.sig == topic0)
}

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

async fn insert_log(
    pool: &PgPool,
    provider: &Provider<Http>,
    log: &Log,
    desc: EventDesc,
    ts_cache: &mut std::collections::HashMap<u64, chrono::DateTime<Utc>>,
) -> Result<(), sqlx::Error> {
    let block_num = log.block_number.map(|b| b.as_u64()).unwrap_or(0);
    let log_index = log.log_index.map(|i| i.as_u32() as i32).unwrap_or(0);

    // topic1 = market_id (bytes32). topic3 = onBehalf account.
    let market_id_hex = log.topics.get(1)
        .map(|t| format!("0x{}", hex::encode(t.as_bytes())))
        .unwrap_or_else(|| "0x".to_string());
    let account_hex = log.topics.get(3)
        .map(|t| {
            // topic is 32 bytes; address is rightmost 20
            let bytes = t.as_bytes();
            format!("0x{}", hex::encode(&bytes[12..]))
        })
        .unwrap_or_else(|| "0x".to_string());

    let amount_dec = if log.data.len() >= desc.amount_offset + 32 {
        U256::from_big_endian(&log.data[desc.amount_offset..desc.amount_offset + 32]).to_string()
    } else {
        "0".to_string()
    };

    let ts = block_timestamp(provider, block_num, ts_cache).await;
    let tx_hash = log.transaction_hash
        .map(|h| format!("0x{}", hex::encode(h.as_bytes())))
        .unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO lending_events
            (block_number, block_time, log_index, event_kind,
             account, market_id, amount, token, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8, $9)
        ON CONFLICT (block_number, log_index) DO NOTHING
        "#,
    )
    .bind(block_num as i64)
    .bind(ts)
    .bind(log_index)
    .bind(desc.kind)
    .bind(&account_hex)
    .bind(&market_id_hex)
    .bind(&amount_dec)
    .bind(desc.token)
    .bind(&tx_hash)
    .execute(pool)
    .await?;

    Ok(())
}

async fn scan_range(
    pool: &PgPool,
    provider: &Provider<Http>,
    morpho_addr: Address,
    from: u64,
    to: u64,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    let filter = Filter::new()
        .address(morpho_addr)
        .from_block(from)
        .to_block(to);
    let logs = provider.get_logs(&filter).await?;
    let mut ts_cache = std::collections::HashMap::new();
    let mut written = 0usize;
    for log in &logs {
        let topic0 = match log.topics.first() {
            Some(t) => *t,
            None => continue,
        };
        let Some(desc) = classify(topic0) else { continue };
        if let Err(e) = insert_log(pool, provider, log, desc, &mut ts_cache).await {
            warn!(%e, "lending_events insert failed");
            continue;
        }
        written += 1;
    }
    Ok(written)
}

pub async fn run(
    pool: PgPool,
    state: Arc<MorphoCollectorState>,
    rpc_url: String,
    morpho_address: String,
    poll_interval_secs: u64,
    deploy_block: u64,
) {
    let (provider_arc, addr) = match create_provider_and_address(&rpc_url, &morpho_address, "morpho_collector") {
        Some(pa) => pa,
        None => return,
    };
    let provider = (*provider_arc).clone();
    let poll_interval = Duration::from_secs(poll_interval_secs);

    let persisted = db::get_collector_cursor(&pool, CURSOR_NAME).await.unwrap_or(0);
    let effective_start = persisted.max(deploy_block);

    let current = match provider.get_block_number().await {
        Ok(b) => b.as_u64(),
        Err(e) => {
            error!(%e, "morpho_collector: failed to get current block");
            return;
        }
    };

    if effective_start < current {
        info!(from = effective_start, to = current, "Backfilling Morpho lending events");
        let pool_ref = &pool;
        let provider_ref = &provider;
        let _ = crate::backfill_util::backfill_paginated(
            "morpho",
            effective_start,
            current,
            |batch_from, batch_to| {
                Box::pin(async move {
                    let n = scan_range(pool_ref, provider_ref, addr, batch_from, batch_to).await?;
                    db::set_collector_cursor(pool_ref, CURSOR_NAME, batch_to).await.ok();
                    Ok::<_, Box<dyn std::error::Error + Send + Sync>>(n)
                })
            },
        ).await;
    }

    *state.last_block.write().await = current;
    db::set_collector_cursor(&pool, CURSOR_NAME, current).await.ok();
    info!(current_block = current, "morpho_collector initialized, entering poll loop");

    loop {
        tokio::time::sleep(poll_interval).await;

        let from_block = *state.last_block.read().await + 1;
        let to_block = match provider.get_block_number().await {
            Ok(b) => b.as_u64(),
            Err(e) => {
                warn!(%e, "morpho_collector: get_block_number failed");
                continue;
            }
        };
        if to_block < from_block {
            continue;
        }

        match scan_range(&pool, &provider, addr, from_block, to_block).await {
            Ok(n) if n > 0 => info!(count = n, "Wrote new Morpho lending events"),
            Ok(_) => {}
            Err(e) => {
                warn!(%e, "morpho_collector: scan failed, will retry");
                continue;
            }
        }

        *state.last_block.write().await = to_block;
        db::set_collector_cursor(&pool, CURSOR_NAME, to_block).await.ok();
    }
}
