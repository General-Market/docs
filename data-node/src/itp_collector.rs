use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use ethers::prelude::*;
use ethers::types::{Address, H256, U256};
use sqlx::PgPool;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::db;

abigen!(
    IndexCollector,
    r#"[
        function getItpCount() external view returns (uint256)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
        event ITPCreated(bytes32 indexed itpId, address indexed creator, bytes32 name, bytes32 symbol, address[] assets, uint256[] weights)
        event Rebalanced(bytes32 indexed itpId, address[] newAssets, uint256[] newWeights, uint256[] newInventory, uint256 nav)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
        event OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
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

const BACKFILL_BATCH_SIZE: u64 = 10_000;
const MAX_RETRIES: u32 = 3;

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

    let (_creator, total_supply, nav, assets, weights, inventory) = contract
        .get_itp_state(itp_id_bytes.into())
        .call()
        .await?;

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

/// Backfill the orderId→itpId map by scanning OrderSubmitted events in batches with retry.
async fn backfill_order_map(
    contract: &IndexCollector<Provider<Http>>,
    order_to_itp: &RwLock<HashMap<U256, H256>>,
    from: u64,
    to: u64,
) {
    let mut cursor = from;
    while cursor < to {
        let batch_end = (cursor + BACKFILL_BATCH_SIZE).min(to);

        let mut success = false;
        for attempt in 1..=MAX_RETRIES {
            match contract
                .order_submitted_filter()
                .from_block(cursor)
                .to_block(batch_end)
                .query()
                .await
            {
                Ok(events) => {
                    let mut map = order_to_itp.write().await;
                    for event in &events {
                        map.insert(event.order_id, H256::from_slice(&event.itp_id));
                    }
                    debug!(from = cursor, to = batch_end, count = events.len(), "Backfilled order map batch");
                    success = true;
                    break;
                }
                Err(e) if attempt < MAX_RETRIES => {
                    warn!(from = cursor, to = batch_end, attempt, %e, "Order map backfill batch failed, retrying");
                    tokio::time::sleep(Duration::from_secs(2u64.pow(attempt))).await;
                }
                Err(e) => {
                    error!(from = cursor, to = batch_end, %e, "Order map backfill batch failed after {MAX_RETRIES} attempts, skipping");
                }
            }
        }

        if !success {
            warn!(from = cursor, to = batch_end, "Skipped order map batch due to failures — some fills may lack ITP association");
        }

        cursor = batch_end + 1;
    }
}

pub async fn run(
    pool: PgPool,
    state: Arc<ItpCollectorState>,
    rpc_url: String,
    index_address: String,
    poll_interval_secs: u64,
) {
    let provider = match Provider::<Http>::try_from(&rpc_url) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            error!(%e, "Failed to create RPC provider for ITP collector");
            return;
        }
    };

    let addr: Address = match index_address.parse() {
        Ok(a) => a,
        Err(e) => {
            error!(%e, "Failed to parse INDEX_ADDRESS");
            return;
        }
    };

    let contract = IndexCollector::new(addr, provider.clone());
    let poll_interval = Duration::from_secs(poll_interval_secs);

    // === STARTUP ===
    info!("ITP collector starting — initializing state from chain...");

    // 1a. Get ITP count and store initial snapshots
    let itp_count = match contract.get_itp_count().call().await {
        Ok(count) => count.as_u64(),
        Err(e) => {
            error!(%e, "Failed to get ITP count");
            return;
        }
    };

    *state.itp_count.write().await = itp_count;
    info!(itp_count, "Found ITPs on chain");

    // 1b. For each ITP, get current state
    let current_block = match provider.get_block_number().await {
        Ok(b) => b.as_u64(),
        Err(e) => {
            error!(%e, "Failed to get current block number");
            return;
        }
    };

    for i in 1..=itp_count {
        let mut itp_id_bytes = [0u8; 32];
        U256::from(i).to_big_endian(&mut itp_id_bytes);
        let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));

        // Skip if an init snapshot already exists — preserve the original creation timestamp
        match db::has_init_snapshot(&pool, &itp_id_hex).await {
            Ok(true) => {
                info!(itp = i, "Init snapshot already exists, skipping");
                continue;
            }
            Ok(false) => {}
            Err(e) => {
                warn!(itp = i, %e, "Failed to check for existing snapshot");
            }
        }

        if let Err(e) = store_itp_state(
            &pool,
            &contract,
            &provider,
            itp_id_bytes,
            current_block,
            "init",
        )
        .await
        {
            warn!(itp = i, %e, "Failed to store initial ITP state");
        }
    }

    // 1c. Resume from persisted cursor and backfill order map from there
    let persisted_block = db::get_collector_cursor(&pool, "itp_collector")
        .await
        .unwrap_or(0);

    info!(from = persisted_block, to = current_block, "Building orderId→itpId map (paginated)...");
    backfill_order_map(&contract, &state.order_to_itp, persisted_block, current_block).await;
    {
        let map = state.order_to_itp.read().await;
        info!(orders = map.len(), "Built orderId→itpId map");
    }

    *state.last_block.write().await = current_block;
    *state.last_poll_at.write().await = Some(Utc::now());
    db::set_collector_cursor(&pool, "itp_collector", current_block)
        .await
        .ok();
    info!(current_block, "ITP collector initialized, entering poll loop");

    // Periodic snapshot: every 5 minutes, snapshot all ITPs regardless of events
    let periodic_interval_secs: u64 = 300; // 5 minutes
    let mut last_periodic = std::time::Instant::now();

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

        // 2a. Query ITPCreated
        let created_filter = contract
            .itp_created_filter()
            .from_block(from_block)
            .to_block(to_block);

        if let Ok(events) = created_filter.query_with_meta().await {
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
                }
            }
            if !events.is_empty() {
                // Update ITP count
                if let Ok(count) = contract.get_itp_count().call().await {
                    *state.itp_count.write().await = count.as_u64();
                }
                info!(count = events.len(), "Processed ITPCreated events");
            }
        }

        // 2b. Query Rebalanced
        let rebal_filter = contract
            .rebalanced_filter()
            .from_block(from_block)
            .to_block(to_block);

        if let Ok(events) = rebal_filter.query_with_meta().await {
            for (event, meta) in &events {
                let itp_id_bytes: [u8; 32] = event.itp_id.into();
                if let Err(e) = store_itp_state(
                    &pool,
                    &contract,
                    &provider,
                    itp_id_bytes,
                    meta.block_number.as_u64(),
                    "rebalanced",
                )
                .await
                {
                    error!(itp_id = ?event.itp_id, %e, "Failed to store rebalanced ITP");
                }
            }
            if !events.is_empty() {
                info!(count = events.len(), "Processed Rebalanced events");
            }
        }

        // 2c. Query FillConfirmed -> lookup orderId -> dedupe by itpId -> getITPState
        let fill_filter = contract
            .fill_confirmed_filter()
            .from_block(from_block)
            .to_block(to_block);

        if let Ok(events) = fill_filter.query_with_meta().await {
            let order_map = state.order_to_itp.read().await;
            let mut seen_itps: HashMap<H256, u64> = HashMap::new(); // itpId -> block

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
                }
            }
            if !seen_itps.is_empty() {
                info!(fills = events.len(), unique_itps = seen_itps.len(), "Processed FillConfirmed events");
            }
        }

        // 2d. Query OrderSubmitted -> update orderId→itpId map
        let order_filter = contract
            .order_submitted_filter()
            .from_block(from_block)
            .to_block(to_block);

        if let Ok(events) = order_filter.query().await {
            if !events.is_empty() {
                let mut map = state.order_to_itp.write().await;
                for event in &events {
                    map.insert(event.order_id, H256::from_slice(&event.itp_id));
                }
                info!(new_orders = events.len(), total_orders = map.len(), "Updated orderId→itpId map");
            }
        }

        // 2e. Periodic snapshot: every 5 minutes, snapshot all ITPs for continuous chart data
        if last_periodic.elapsed().as_secs() >= periodic_interval_secs {
            let itp_count = *state.itp_count.read().await;
            for i in 1..=itp_count {
                let mut itp_id_bytes = [0u8; 32];
                U256::from(i).to_big_endian(&mut itp_id_bytes);
                if let Err(e) = store_itp_state(
                    &pool,
                    &contract,
                    &provider,
                    itp_id_bytes,
                    to_block,
                    "periodic",
                )
                .await
                {
                    warn!(itp = i, %e, "Failed to store periodic ITP snapshot");
                }
            }
            if itp_count > 0 {
                info!(itp_count, "Stored periodic snapshots");
            }
            last_periodic = std::time::Instant::now();
        }

        *state.last_block.write().await = to_block;
        *state.last_poll_at.write().await = Some(Utc::now());
        db::set_collector_cursor(&pool, "itp_collector", to_block).await.ok();
    }
}
