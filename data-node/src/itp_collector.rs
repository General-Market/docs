use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use ethers::prelude::*;
use ethers::types::{Address, H256, U256};
use futures::future::join_all;
use rand::seq::SliceRandom;
use sqlx::PgPool;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::chain_cache::{CachedItpState, ChainCache};
use crate::db;
use crate::evm_init::create_provider_and_address;

abigen!(
    IndexCollector,
    r#"[
        function getItpCount() external view returns (uint256)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
        function getITP(bytes32 itpId) external view returns (bytes32 name, bytes32 symbol, address creator, uint256 createdAt, uint256 feeRate, uint256 status, uint256 totalSupply, uint256 totalValue, uint256 assetCount)
        function itpVaults(bytes32 itpId) external view returns (address)
        event ITPCreated(bytes32 indexed itpId, address indexed creator, bytes32 name, bytes32 symbol, address[] assets, uint256[] weights)
        event Rebalanced(bytes32 indexed itpId, address[] newAssets, uint256[] newWeights, uint256[] newInventory, uint256 nav)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
        event OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
        event SharesUpdated(bytes32 indexed itpId, address indexed user, uint256 newTotalSupply, uint256 userNewBalance)
        event OrderCancelled(uint256 indexed orderId, address indexed user, uint256 amount, uint8 side)
        event OrderRefunded(uint256 indexed orderId, address indexed user, uint256 refundAmount)
    ]"#
);

pub struct ItpCollectorState {
    pub last_block: RwLock<u64>,
    pub itp_count: RwLock<u64>,
    pub order_to_itp: RwLock<HashMap<U256, H256>>,
    pub last_poll_at: RwLock<Option<DateTime<Utc>>>,
}

impl ItpCollectorState {
    pub fn new() -> Self {
        Self {
            last_block: RwLock::new(0),
            itp_count: RwLock::new(0),
            order_to_itp: RwLock::new(HashMap::new()),
            last_poll_at: RwLock::new(None),
        }
    }
}


async fn get_block_timestamp(
    _provider: &Provider<Http>,
    _block_number: u64,
) -> Result<DateTime<Utc>, Box<dyn std::error::Error + Send + Sync>> {
    // Use wall-clock time instead of block timestamp.
    // Anvil's block.timestamp can be far ahead of UTC, causing snapshots
    // to have future valid_from and be invisible to queries using NOW().
    Ok(Utc::now())
}

async fn store_itp_state(
    pool: &PgPool,
    contract: &IndexCollector<Provider<Http>>,
    provider: &Provider<Http>,
    itp_id_bytes: [u8; 32],
    block_number: u64,
    event_type: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));

    // The L3 RPC behind nginx flaps under concurrent load — the raw call here
    // would surface as `Failed to store created ITP` and stall the collector
    // cursor. fetch_itp_state_with_retry already does 3 attempts with backoff.
    let (_id, _creator, total_supply, nav, assets, weights, inventory) =
        fetch_itp_state_with_retry(contract, itp_id_bytes).await?;

    let ts = get_block_timestamp(provider, block_number).await?;

    let assets_strs: Vec<String> = assets
        .iter()
        .map(|a| format!("{:?}", a).to_lowercase())
        .collect();
    let inventory_strs: Vec<String> = inventory.iter().map(|v| v.to_string()).collect();
    let weights_strs: Vec<String> = weights.iter().map(|v| v.to_string()).collect();
    let nav_str = nav.to_string();
    let total_supply_str = total_supply.to_string();

    db::upsert_itp_snapshot(
        pool,
        &itp_id_hex,
        &assets_strs,
        &inventory_strs,
        &nav_str,
        ts,
        event_type,
        &total_supply_str,
        &weights_strs,
    )
    .await?;

    // Clean up stale snapshots from previous deployments (different asset count)
    if event_type == "init" {
        let deleted = db::delete_stale_snapshots(pool, &itp_id_hex, assets_strs.len() as i32).await?;
        if deleted > 0 {
            info!(itp_id = %itp_id_hex, deleted, "Cleaned up stale snapshots from previous deployments");
        }
    }

    info!(
        itp_id = %itp_id_hex,
        event_type,
        assets = assets_strs.len(),
        total_supply = %total_supply_str,
        "Stored ITP snapshot"
    );

    Ok(())
}

/// Fetch a single ITP state from chain with retry (3 attempts, exponential backoff).
/// Returns (itp_id_hex, creator, total_supply, nav, assets, weights, inventory) on success.
async fn fetch_itp_state_with_retry(
    contract: &IndexCollector<Provider<Http>>,
    itp_id_bytes: [u8; 32],
) -> Result<(String, Address, U256, U256, Vec<Address>, Vec<U256>, Vec<U256>), Box<dyn std::error::Error + Send + Sync>> {
    let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));

    for attempt in 1..=3u32 {
        match contract.get_itp_state(itp_id_bytes.into()).call().await {
            Ok((creator, total_supply, nav, assets, weights, inventory)) => {
                return Ok((itp_id_hex, creator, total_supply, nav, assets, weights, inventory));
            }
            Err(e) if attempt < 3 => {
                warn!(itp_id = %itp_id_hex, attempt, %e, "Hydration RPC failed, retrying");
                tokio::time::sleep(Duration::from_millis(500 * 2u64.pow(attempt))).await;
            }
            Err(e) => {
                return Err(Box::new(e));
            }
        }
    }
    unreachable!()
}

/// Decode a Solidity bytes32 (right-padded with zeros) into a UTF-8 string.
fn bytes32_to_string(b: [u8; 32]) -> String {
    let end = b.iter().position(|&x| x == 0).unwrap_or(32);
    String::from_utf8_lossy(&b[..end]).to_string()
}

/// Fetch name and symbol for an ITP from chain via getITP(). Falls back to empty strings on failure.
async fn fetch_name_symbol(
    contract: &IndexCollector<Provider<Http>>,
    itp_id_bytes: [u8; 32],
) -> (String, String) {
    match contract.get_itp(itp_id_bytes.into()).call().await {
        Ok((name_b32, symbol_b32, _creator, _created, _fee, _status, _supply, _value, _count)) =>
            (bytes32_to_string(name_b32), bytes32_to_string(symbol_b32)),
        Err(e) => {
            debug!(itp_id = %format!("0x{}", hex::encode(itp_id_bytes)), %e, "getITP failed, using empty");
            (String::new(), String::new())
        }
    }
}

/// Backfill the orderId->itpId map by scanning OrderSubmitted events in batches with retry.
async fn backfill_order_map(
    contract: &IndexCollector<Provider<Http>>,
    order_to_itp: &RwLock<HashMap<U256, H256>>,
    from: u64,
    to: u64,
) {
    crate::backfill_util::backfill_paginated("order_map", from, to, |batch_from, batch_to| {
        Box::pin(async move {
            let events = contract
                .order_submitted_filter()
                .from_block(batch_from)
                .to_block(batch_to)
                .query()
                .await?;
            let mut map = order_to_itp.write().await;
            for event in &events {
                map.insert(event.order_id, H256::from_slice(&event.itp_id));
            }
            Ok(events.len())
        })
    }).await;
}

/// Compute NAV from inventory × latest DB prices (same formula as /itp-price).
/// Returns the NAV as a raw sum string (divide by 1e18 for USD).
async fn compute_nav_from_db(
    pool: &PgPool,
    cached: &CachedItpState,
    symbol_map: &HashMap<String, String>,
) -> Option<String> {
    // Map asset addresses to symbols
    let mut symbols: Vec<String> = Vec::new();
    let mut asset_symbol_idx: Vec<Option<usize>> = Vec::new();

    for asset in &cached.assets {
        let addr = format!("{:?}", asset).to_lowercase();
        if let Some(pair) = symbol_map.get(&addr) {
            if let Some(existing) = symbols.iter().position(|s| s == pair) {
                asset_symbol_idx.push(Some(existing));
            } else {
                asset_symbol_idx.push(Some(symbols.len()));
                symbols.push(pair.clone());
            }
        } else {
            asset_symbol_idx.push(None);
        }
    }

    if symbols.is_empty() {
        return None;
    }

    // Fetch latest prices from DB
    let symbol_refs: Vec<&str> = symbols.iter().map(|s| s.as_str()).collect();
    let price_rows = db::query_freshest_prices_batch(pool, &symbol_refs).await.ok()?;

    let price_map: HashMap<&str, f64> = price_rows
        .iter()
        .filter_map(|r| r.price.parse::<f64>().ok().map(|p| (r.symbol.as_str(), p)))
        .collect();

    // NAV = sum(inventory[i] * price[i])
    let mut nav_sum: f64 = 0.0;
    for (i, inv) in cached.inventory.iter().enumerate() {
        let inv_val: f64 = inv.to_string().parse().unwrap_or(0.0);
        if let Some(Some(sym_idx)) = asset_symbol_idx.get(i) {
            if let Some(&price) = price_map.get(symbols[*sym_idx].as_str()) {
                nav_sum += inv_val * price;
            }
        }
    }

    if nav_sum > 0.0 {
        Some(format!("{:.0}", nav_sum))
    } else {
        None
    }
}

/// Write ITP snapshot to DB from cache data (zero RPC).
/// For periodic snapshots, computes NAV from inventory × latest prices
/// instead of using the on-chain _itpNavs (which may be stale/wrong).
async fn store_snapshot_from_cache(
    pool: &PgPool,
    itp_id_hex: &str,
    cached: &CachedItpState,
    event_type: &str,
    symbol_map: &HashMap<String, String>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let assets_strs: Vec<String> = cached.assets.iter().map(|a| format!("{:?}", a).to_lowercase()).collect();
    let inventory_strs: Vec<String> = cached.inventory.iter().map(|v| v.to_string()).collect();
    let weights_strs: Vec<String> = cached.weights.iter().map(|v| v.to_string()).collect();
    let total_supply_str = cached.total_supply.to_string();

    // Compute NAV from real prices; fall back to on-chain value if unavailable
    let nav_str = match compute_nav_from_db(pool, cached, symbol_map).await {
        Some(computed) => computed,
        None => cached.nav.to_string(),
    };

    let ts = Utc::now();

    db::upsert_itp_snapshot(
        pool,
        itp_id_hex,
        &assets_strs,
        &inventory_strs,
        &nav_str,
        ts,
        event_type,
        &total_supply_str,
        &weights_strs,
    )
    .await?;

    Ok(())
}

pub async fn run(
    pool: PgPool,
    state: Arc<ItpCollectorState>,
    rpc_url: String,
    index_address: String,
    poll_interval_secs: u64,
    chain_cache: Arc<ChainCache>,
    symbol_map: Arc<HashMap<String, String>>,
) {
    let (provider, addr) = match create_provider_and_address(&rpc_url, &index_address, "itp_collector") {
        Some(pa) => pa,
        None => return,
    };

    let contract = IndexCollector::new(addr, provider.clone());
    let poll_interval = Duration::from_secs(poll_interval_secs);

    // === STARTUP ===
    info!("ITP collector starting — initializing state from chain...");

    // 1a. Get ITP count
    let itp_count = match contract.get_itp_count().call().await {
        Ok(count) => count.as_u64(),
        Err(e) => {
            error!(%e, "Failed to get ITP count");
            return;
        }
    };

    *state.itp_count.write().await = itp_count;
    info!(itp_count, "Found ITPs on chain");

    // 1b. Get current block
    let current_block = match provider.get_block_number().await {
        Ok(b) => b.as_u64(),
        Err(e) => {
            error!(%e, "Failed to get current block number");
            return;
        }
    };

    // 1c. Parallel hydration in batches of 50, with retry
    let batch_size = 50usize;
    let mut total_ok = 0u64;
    let mut total_fail = 0u64;

    let itp_indices: Vec<u64> = (1..=itp_count).collect();

    for chunk in itp_indices.chunks(batch_size) {
        let futures: Vec<_> = chunk.iter().map(|&i| {
            let contract_ref = &contract;
            let pool_ref = &pool;
            async move {
                let mut itp_id_bytes = [0u8; 32];
                U256::from(i).to_big_endian(&mut itp_id_bytes);
                let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));

                // Check if init snapshot already exists
                match db::has_init_snapshot(pool_ref, &itp_id_hex).await {
                    Ok(true) => {
                        debug!(itp = i, "Init snapshot exists, hydrating cache only");
                        // Still need to fetch chain state for cache population
                    }
                    Ok(false) => {}
                    Err(e) => {
                        warn!(itp = i, %e, "Failed to check for existing snapshot");
                    }
                }

                match fetch_itp_state_with_retry(contract_ref, itp_id_bytes).await {
                    Ok((id_hex, creator, total_supply, nav, assets, weights, inventory)) => {
                        Ok((i, id_hex, creator, total_supply, nav, assets, weights, inventory))
                    }
                    Err(e) => {
                        warn!(itp = i, %e, "Failed to hydrate ITP state");
                        Err(i)
                    }
                }
            }
        }).collect();

        let results = join_all(futures).await;

        for result in results {
            match result {
                Ok((i, itp_id_hex, creator, total_supply, nav, assets, weights, inventory)) => {
                    // Store init snapshot if needed
                    match db::has_init_snapshot(&pool, &itp_id_hex).await {
                        Ok(false) => {
                            let assets_strs: Vec<String> = assets.iter().map(|a| format!("{:?}", a).to_lowercase()).collect();
                            let inventory_strs: Vec<String> = inventory.iter().map(|v| v.to_string()).collect();
                            let weights_strs: Vec<String> = weights.iter().map(|v| v.to_string()).collect();
                            let total_supply_str = total_supply.to_string();

                            if let Err(e) = db::upsert_itp_snapshot(
                                &pool,
                                &itp_id_hex,
                                &assets_strs,
                                &inventory_strs,
                                &nav.to_string(), // Use on-chain NAV (1e18 at creation)
                                Utc::now(),
                                "init",
                                &total_supply_str,
                                &weights_strs,
                            ).await {
                                warn!(itp = i, %e, "Failed to store init snapshot");
                            }

                            // Clean stale
                            if let Ok(deleted) = db::delete_stale_snapshots(&pool, &itp_id_hex, assets_strs.len() as i32).await {
                                if deleted > 0 {
                                    info!(itp_id = %itp_id_hex, deleted, "Cleaned stale snapshots");
                                }
                            }
                        }
                        _ => {}
                    }

                    // Fetch name/symbol from chain
                    let hex_str = itp_id_hex.strip_prefix("0x").unwrap_or(&itp_id_hex);
                    let mut itp_id_bytes = [0u8; 32];
                    let _ = hex::decode_to_slice(hex_str, &mut itp_id_bytes);
                    let (name, symbol) = fetch_name_symbol(&contract, itp_id_bytes).await;

                    // Fetch vault address
                    let vault_address = match contract.itp_vaults(itp_id_bytes.into()).call().await {
                        Ok(addr) if addr != ethers::types::Address::zero() =>
                            Some(format!("{:?}", addr).to_lowercase()),
                        _ => None,
                    };

                    // Skip spam ITPs with empty name/symbol (permissionless createITP abuse).
                    if name.trim().is_empty() || symbol.trim().is_empty() {
                        total_ok += 1;
                        continue;
                    }

                    // Populate cache
                    let cached = CachedItpState {
                        creator,
                        total_supply,
                        assets,
                        weights,
                        inventory,
                        nav,
                        name,
                        symbol,
                        settlement_address: None,
                        vault_address,
                    };
                    {
                        let mut cache = chain_cache.itp_states.write().await;
                        cache.states.insert(itp_id_hex, cached);
                    }
                    total_ok += 1;
                }
                Err(_i) => {
                    total_fail += 1;
                }
            }
        }
    }

    // Abort if >10% of hydrations failed
    let total = total_ok + total_fail;
    if total > 0 && total_fail * 10 > total {
        error!(ok = total_ok, failed = total_fail, "Hydration failure rate exceeds 10%, aborting");
        return;
    }

    chain_cache.hydration_complete.store(true, Ordering::Release);
    info!(ok = total_ok, failed = total_fail, "ITP cache hydration complete");

    // 1d. Resume from persisted cursor and backfill order map from there
    let persisted_block = db::get_collector_cursor(&pool, "itp_collector")
        .await
        .unwrap_or(0);

    info!(from = persisted_block, to = current_block, "Building orderId->itpId map (paginated)...");
    backfill_order_map(&contract, &state.order_to_itp, persisted_block, current_block).await;
    {
        let map = state.order_to_itp.read().await;
        info!(orders = map.len(), "Built orderId->itpId map");
    }

    // 1e. Backfill user_shares from historical SharesUpdated events if table is empty
    {
        let shares_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user_shares")
            .fetch_one(&pool)
            .await
            .unwrap_or((0,));

        if shares_count.0 == 0 {
            info!("Backfilling user_shares from SharesUpdated events (block 0..{current_block})...");
            let page_size = 10_000u64;
            let mut from = 0u64;
            let mut total_events = 0u64;
            while from <= current_block {
                let to = (from + page_size).min(current_block);
                match contract
                    .shares_updated_filter()
                    .from_block(from)
                    .to_block(to)
                    .query()
                    .await
                {
                    Ok(events) => {
                        for event in &events {
                            let itp_id_hex = format!("0x{}", hex::encode(event.itp_id));
                            let user_addr = format!("{:?}", event.user).to_lowercase();
                            db::upsert_user_shares(
                                &pool,
                                &user_addr,
                                &itp_id_hex,
                                &event.user_new_balance.to_string(),
                            )
                            .await
                            .ok();
                        }
                        total_events += events.len() as u64;
                    }
                    Err(e) => {
                        warn!(from, to, %e, "SharesUpdated backfill page failed");
                    }
                }
                from = to + 1;
            }
            info!(total_events, "user_shares backfill complete");
        }
    }

    *state.last_block.write().await = current_block;
    *state.last_poll_at.write().await = Some(Utc::now());
    db::set_collector_cursor(&pool, "itp_collector", current_block)
        .await
        .ok();
    info!(current_block, "ITP collector initialized, entering poll loop");

    // Periodic snapshot from cache: every 5 minutes
    let periodic_interval_secs: u64 = 300;
    let mut last_periodic = std::time::Instant::now();

    // Reconciliation: every 30 minutes, sample 10 ITPs from cache vs chain
    let reconciliation_interval_secs: u64 = 1800;
    let mut last_reconciliation = std::time::Instant::now();

    // === POLL LOOP ===
    loop {
        tokio::time::sleep(poll_interval).await;

        let from_block = *state.last_block.read().await + 1;
        let to_block = match provider.get_block_number().await {
            Ok(b) => b.as_u64(),
            Err(e) => {
                warn!(%e, "Failed to get block number");
                continue;
            }
        };

        if to_block < from_block {
            continue;
        }

        // Track whether all event queries succeeded — only advance cursor if so
        let mut all_queries_ok = true;

        // 2a. Query ITPCreated
        let created_filter = contract
            .itp_created_filter()
            .from_block(from_block)
            .to_block(to_block);

        match created_filter.query_with_meta().await {
            Ok(events) => {
                for (event, meta) in &events {
                    let itp_id_bytes: [u8; 32] = event.itp_id.into();
                    if let Err(e) = store_itp_state(
                        &pool,
                        &contract,
                        &provider,
                        itp_id_bytes,
                        meta.block_number.as_u64(),
                        "created",
                    )
                    .await
                    {
                        error!(itp_id = ?event.itp_id, %e, "Failed to store created ITP");
                        all_queries_ok = false;
                    } else {
                        // Populate cache from the freshly-fetched state
                        let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));
                        if let Ok((_id, creator, total_supply, nav, assets, weights, inventory)) =
                            fetch_itp_state_with_retry(&contract, itp_id_bytes).await
                        {
                            // Decode name/symbol from event bytes32 fields
                            let name = bytes32_to_string(event.name);
                            let symbol = bytes32_to_string(event.symbol);
                            // Drop spam — empty name/symbol is the bot signature.
                            if name.trim().is_empty() || symbol.trim().is_empty() {
                                continue;
                            }
                            let cached = CachedItpState {
                                creator,
                                total_supply,
                                assets,
                                weights,
                                inventory,
                                nav,
                                name,
                                symbol,
                                settlement_address: None,
                                vault_address: None,
                            };
                            let mut cache = chain_cache.itp_states.write().await;
                            cache.states.insert(itp_id_hex, cached);
                        }
                    }
                }
                if !events.is_empty() {
                    if let Ok(count) = contract.get_itp_count().call().await {
                        *state.itp_count.write().await = count.as_u64();
                    }
                    info!(count = events.len(), "Processed ITPCreated events");
                }
            }
            Err(e) => {
                warn!(%e, "ITPCreated query failed");
                all_queries_ok = false;
            }
        }

        // 2b. Query Rebalanced — update cache directly from event data (zero RPC)
        let rebal_filter = contract
            .rebalanced_filter()
            .from_block(from_block)
            .to_block(to_block);

        match rebal_filter.query_with_meta().await {
            Ok(events) => {
                for (event, meta) in &events {
                    let itp_id_bytes: [u8; 32] = event.itp_id.into();
                    let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));

                    // Update cache directly from event data
                    {
                        let mut cache = chain_cache.itp_states.write().await;
                        if let Some(itp) = cache.states.get_mut(&itp_id_hex) {
                            itp.assets = event.new_assets.clone();
                            itp.weights = event.new_weights.clone();
                            itp.inventory = event.new_inventory.clone();
                        }
                    }

                    // Still write snapshot to DB for chart data
                    let assets_strs: Vec<String> = event.new_assets.iter().map(|a| format!("{:?}", a).to_lowercase()).collect();
                    let inventory_strs: Vec<String> = event.new_inventory.iter().map(|v| v.to_string()).collect();
                    let weights_strs: Vec<String> = event.new_weights.iter().map(|v| v.to_string()).collect();
                    let nav_str = event.nav.to_string();

                    // Read total_supply from cache
                    let total_supply_str = {
                        let cache = chain_cache.itp_states.read().await;
                        cache.states.get(&itp_id_hex)
                            .map(|s| s.total_supply.to_string())
                            .unwrap_or_else(|| "0".to_string())
                    };

                    let ts = get_block_timestamp(&provider, meta.block_number.as_u64()).await.unwrap_or_else(|_| Utc::now());
                    if let Err(e) = db::upsert_itp_snapshot(
                        &pool,
                        &itp_id_hex,
                        &assets_strs,
                        &inventory_strs,
                        &nav_str,
                        ts,
                        "rebalanced",
                        &total_supply_str,
                        &weights_strs,
                    ).await {
                        error!(itp_id = %itp_id_hex, %e, "Failed to store rebalanced snapshot");
                        all_queries_ok = false;
                    }
                }
                if !events.is_empty() {
                    info!(count = events.len(), "Processed Rebalanced events");
                }
            }
            Err(e) => {
                warn!(%e, "Rebalanced query failed");
                all_queries_ok = false;
            }
        }

        // 2c. Query FillConfirmed -> lookup orderId -> dedupe by itpId -> getITPState
        let fill_filter = contract
            .fill_confirmed_filter()
            .from_block(from_block)
            .to_block(to_block);

        match fill_filter.query_with_meta().await {
            Ok(events) => {
                let order_map = state.order_to_itp.read().await;
                let mut seen_itps: HashMap<H256, u64> = HashMap::new();

                for (event, meta) in &events {
                    if let Some(&itp_id) = order_map.get(&event.order_id) {
                        seen_itps
                            .entry(itp_id)
                            .or_insert(meta.block_number.as_u64());
                    } else {
                        warn!(order_id = ?event.order_id, "FillConfirmed for unknown orderId");
                    }
                }
                drop(order_map);

                for (itp_id, block_num) in &seen_itps {
                    let itp_id_bytes: [u8; 32] = (*itp_id).into();
                    if let Err(e) = store_itp_state(
                        &pool,
                        &contract,
                        &provider,
                        itp_id_bytes,
                        *block_num,
                        "fill",
                    )
                    .await
                    {
                        error!(itp_id = ?itp_id, %e, "Failed to store fill snapshot");
                        all_queries_ok = false;
                    } else {
                        // Update cache from the fresh RPC data
                        let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));
                        if let Ok((_id, creator, total_supply, nav, assets, weights, inventory)) =
                            fetch_itp_state_with_retry(&contract, itp_id_bytes).await
                        {
                            // Preserve existing name/symbol from cache (set at creation time)
                            let mut cache = chain_cache.itp_states.write().await;
                            let (prev_name, prev_symbol, prev_settlement, prev_vault) = cache
                                .states
                                .get(&itp_id_hex)
                                .map(|s| (s.name.clone(), s.symbol.clone(), s.settlement_address.clone(), s.vault_address.clone()))
                                .unwrap_or_default();
                            // Don't reintroduce spam ITPs the cache already filtered out.
                            if prev_name.trim().is_empty() || prev_symbol.trim().is_empty() {
                                continue;
                            }
                            let cached = CachedItpState {
                                creator,
                                total_supply,
                                assets,
                                weights,
                                inventory,
                                nav,
                                name: prev_name,
                                symbol: prev_symbol,
                                settlement_address: prev_settlement,
                                vault_address: prev_vault,
                            };
                            cache.states.insert(itp_id_hex, cached);
                        }
                    }
                }
                if !seen_itps.is_empty() {
                    info!(fills = events.len(), unique_itps = seen_itps.len(), "Processed FillConfirmed events");
                }
            }
            Err(e) => {
                warn!(%e, "FillConfirmed query failed");
                all_queries_ok = false;
            }
        }

        // 2d. Query SharesUpdated -> update ITP cache + persist user balances
        let shares_filter = contract
            .shares_updated_filter()
            .from_block(from_block)
            .to_block(to_block);

        match shares_filter.query().await {
            Ok(events) => {
                for event in &events {
                    let itp_id_hex = format!("0x{}", hex::encode(event.itp_id));

                    // Update ITP totalSupply in cache
                    {
                        let mut cache = chain_cache.itp_states.write().await;
                        if let Some(itp) = cache.states.get_mut(&itp_id_hex) {
                            itp.total_supply = event.new_total_supply;
                        }
                    }

                    // Persist user shares to DB (source of truth for reconnects)
                    let user_addr = format!("{:?}", event.user).to_lowercase();
                    if let Err(e) = db::upsert_user_shares(
                        &pool,
                        &user_addr,
                        &itp_id_hex,
                        &event.user_new_balance.to_string(),
                    ).await {
                        warn!(%e, "Failed to persist user shares");
                        all_queries_ok = false;
                    }

                    // Update in-memory UserCache if user is connected
                    {
                        let users = chain_cache.users.read().await;
                        if let Some(user_lock) = users.get(&user_addr) {
                            let mut user = user_lock.write().await;
                            user.balances.itp_shares.insert(
                                itp_id_hex.clone(),
                                event.user_new_balance.to_string(),
                            );
                            user.balances_gen.bump();
                        }
                    }
                }
                if !events.is_empty() {
                    info!(count = events.len(), "Processed SharesUpdated events");
                }
            }
            Err(e) => {
                warn!(%e, "SharesUpdated query failed");
                all_queries_ok = false;
            }
        }

        // 2e. Query OrderCancelled -> update trade status to 3
        let cancel_filter = contract
            .order_cancelled_filter()
            .from_block(from_block)
            .to_block(to_block);

        match cancel_filter.query().await {
            Ok(events) => {
                for event in &events {
                    let order_id = event.order_id.as_u64() as i64;
                    if let Err(e) = db::update_trade_status(&pool, order_id, 3).await {
                        warn!(order_id, %e, "Failed to update cancelled trade status");
                        all_queries_ok = false;
                    }
                }
                if !events.is_empty() {
                    info!(count = events.len(), "Processed OrderCancelled events");
                }
            }
            Err(e) => {
                warn!(%e, "OrderCancelled query failed");
                all_queries_ok = false;
            }
        }

        // 2f. Query OrderRefunded -> update trade status to 4
        let refund_filter = contract
            .order_refunded_filter()
            .from_block(from_block)
            .to_block(to_block);

        match refund_filter.query().await {
            Ok(events) => {
                for event in &events {
                    let order_id = event.order_id.as_u64() as i64;
                    if let Err(e) = db::update_trade_status(&pool, order_id, 4).await {
                        warn!(order_id, %e, "Failed to update refunded trade status");
                        all_queries_ok = false;
                    }
                }
                if !events.is_empty() {
                    info!(count = events.len(), "Processed OrderRefunded events");
                }
            }
            Err(e) => {
                warn!(%e, "OrderRefunded query failed");
                all_queries_ok = false;
            }
        }

        // 2g. Query OrderSubmitted -> update orderId->itpId map
        let order_filter = contract
            .order_submitted_filter()
            .from_block(from_block)
            .to_block(to_block);

        match order_filter.query().await {
            Ok(events) => {
                if !events.is_empty() {
                    let mut map = state.order_to_itp.write().await;
                    for event in &events {
                        map.insert(event.order_id, H256::from_slice(&event.itp_id));
                    }
                    info!(new_orders = events.len(), total_orders = map.len(), "Updated orderId->itpId map");
                }
            }
            Err(e) => {
                warn!(%e, "OrderSubmitted query failed");
                all_queries_ok = false;
            }
        }

        // 2g2. ITP count reconciliation: detect ITPs created outside the event window
        // (e.g., created before data-node started, or cursor was ahead of creation blocks)
        if let Ok(on_chain_count) = contract.get_itp_count().call().await {
            let on_chain = on_chain_count.as_u64();
            let cached = *state.itp_count.read().await;
            if on_chain > cached {
                info!(cached, on_chain, new = on_chain - cached, "Detected new ITPs — hydrating");
                for i in (cached + 1)..=on_chain {
                    let mut itp_id_bytes = [0u8; 32];
                    ethers::types::U256::from(i).to_big_endian(&mut itp_id_bytes);
                    let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));
                    if let Ok((_id, creator, total_supply, nav, assets, weights, inventory)) =
                        fetch_itp_state_with_retry(&contract, itp_id_bytes).await
                    {
                        let (name, symbol) = fetch_name_symbol(&contract, itp_id_bytes).await;
                        // Skip empty-name/symbol spam ITPs at the reconciliation hydration path too.
                        if name.trim().is_empty() || symbol.trim().is_empty() {
                            continue;
                        }
                        let cached_state = CachedItpState {
                            creator,
                            total_supply,
                            assets,
                            weights,
                            inventory,
                            nav,
                            name,
                            symbol,
                            settlement_address: None,
                            vault_address: None,
                        };
                        let mut cache = chain_cache.itp_states.write().await;
                        cache.states.insert(itp_id_hex, cached_state);
                    }
                }
                *state.itp_count.write().await = on_chain;
            }
        }

        // 2h. Periodic snapshot from cache (zero RPC)
        if last_periodic.elapsed().as_secs() >= periodic_interval_secs {
            let cache = chain_cache.itp_states.read().await;
            let mut snapshot_count = 0u64;
            for (itp_id_hex, cached) in &cache.states {
                if let Err(e) = store_snapshot_from_cache(&pool, itp_id_hex, cached, "periodic", &symbol_map).await {
                    warn!(itp_id = %itp_id_hex, %e, "Failed to store periodic snapshot from cache");
                }
                snapshot_count += 1;
            }
            drop(cache);
            if snapshot_count > 0 {
                info!(snapshot_count, "Stored periodic snapshots from cache (zero RPC)");
            }
            last_periodic = std::time::Instant::now();
        }

        // 2i. Reconciliation: every 30 min, sample 10 ITPs from cache and verify against chain
        if last_reconciliation.elapsed().as_secs() >= reconciliation_interval_secs {
            let sample_keys: Vec<String> = {
                let cache = chain_cache.itp_states.read().await;
                let keys: Vec<String> = cache.states.keys().cloned().collect();
                let mut rng = rand::thread_rng();
                keys.choose_multiple(&mut rng, 10.min(keys.len()))
                    .cloned()
                    .collect()
            };

            let mut corrections = 0u32;
            for itp_id_hex in &sample_keys {
                // Decode hex back to bytes
                let hex_str = itp_id_hex.strip_prefix("0x").unwrap_or(itp_id_hex);
                let mut itp_id_bytes = [0u8; 32];
                if hex::decode_to_slice(hex_str, &mut itp_id_bytes).is_err() {
                    continue;
                }

                match contract.get_itp_state(itp_id_bytes.into()).call().await {
                    Ok((creator, total_supply, _nav, assets, weights, inventory)) => {
                        let needs_name_backfill;
                        {
                            let mut cache = chain_cache.itp_states.write().await;
                            if let Some(cached) = cache.states.get_mut(itp_id_hex) {
                                // Check for drift
                                let supply_drifted = cached.total_supply != total_supply;
                                let assets_drifted = cached.assets != assets;
                                let inventory_drifted = cached.inventory != inventory;

                                if supply_drifted || assets_drifted || inventory_drifted {
                                    info!(
                                        itp_id = %itp_id_hex,
                                        supply_drifted,
                                        assets_drifted,
                                        inventory_drifted,
                                        "Reconciliation: correcting cache drift"
                                    );
                                    cached.creator = creator;
                                    cached.total_supply = total_supply;
                                    cached.assets = assets;
                                    cached.weights = weights;
                                    cached.inventory = inventory;
                                    corrections += 1;
                                }
                                needs_name_backfill = cached.name.is_empty();
                            } else {
                                needs_name_backfill = false;
                            }
                        }
                        // Backfill name/symbol if still empty (legacy cache entries)
                        if needs_name_backfill {
                            let (name, symbol) = fetch_name_symbol(&contract, itp_id_bytes).await;
                            if !name.is_empty() {
                                let mut cache = chain_cache.itp_states.write().await;
                                if let Some(cached) = cache.states.get_mut(itp_id_hex) {
                                    cached.name = name;
                                    cached.symbol = symbol;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        warn!(itp_id = %itp_id_hex, %e, "Reconciliation RPC failed");
                    }
                }
            }
            info!(sampled = sample_keys.len(), corrections, "Reconciliation sweep complete");
            last_reconciliation = std::time::Instant::now();
        }

        // Only advance cursor if all event queries succeeded
        if all_queries_ok {
            *state.last_block.write().await = to_block;
            *state.last_poll_at.write().await = Some(Utc::now());
            db::set_collector_cursor(&pool, "itp_collector", to_block).await.ok();
        } else {
            warn!(from_block, to_block, "Some event queries failed — cursor NOT advanced, will retry next tick");
        }
    }
}
