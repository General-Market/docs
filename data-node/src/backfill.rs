use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;

use chrono::{DateTime, TimeZone, Utc};
use ethers::prelude::*;
use ethers::types::{Address, U256};
use tokio::sync::Mutex;
use tracing::{error, info, warn};

use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};

use crate::config::BackfillArgs;
use crate::db;

// ABI for reading ITPs + events
abigen!(
    IndexReader,
    r#"[
        function getItpCount() external view returns (uint256)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
        event ITPCreated(bytes32 indexed itpId, address indexed creator, bytes32 name, bytes32 symbol, address[] assets, uint256[] weights)
        event Rebalanced(bytes32 indexed itpId, address[] newAssets, uint256[] newWeights, uint256[] newInventory, uint256 nav)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
        event OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
    ]"#
);

#[derive(Debug)]
struct ItpEventData {
    assets: Vec<Address>,
    inventory: Vec<U256>,
    weights: Vec<U256>,
    total_supply: U256,
    nav: U256,
    block_timestamp: DateTime<Utc>,
    event_type: String,
}

fn format_itp_id(index: u64) -> String {
    format!("0x{:064x}", index)
}

fn load_symbol_map(path: &str) -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(path)?;
    let raw: HashMap<String, serde_json::Value> = serde_json::from_str(&content)?;

    let mut map = HashMap::new();
    for (address, entry) in raw {
        if let Some(pair) = entry.get("pair").and_then(|v| v.as_str()) {
            map.insert(address.to_lowercase(), pair.to_string());
        }
    }

    info!(entries = map.len(), path, "Loaded symbol map");
    Ok(map)
}

pub async fn run(args: BackfillArgs) -> Result<(), Box<dyn std::error::Error>> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&args.log_level));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    let started = Instant::now();

    // Connect to DB
    let pool = db::create_pool(&args.database_url).await?;
    db::run_migrations(&pool).await?;

    // Load symbol map
    let symbol_map = load_symbol_map(&args.symbol_map)?;

    let unique_symbols: HashSet<String>;
    let snapshots_stored: u64;
    let n: u64;

    if args.skip_chain {
        // Skip chain discovery — use all symbols from symbol map
        info!("Phase A/B: Skipped (--skip-chain). Using all symbols from symbol map...");

        let syms: HashSet<String> = symbol_map.values().cloned().collect();
        n = 0;
        snapshots_stored = 0;

        info!(
            unique_symbols = syms.len(),
            "Loaded symbols from symbol map"
        );
        unique_symbols = syms;
    } else {
    // Connect to chain
    let provider = Provider::<Http>::try_from(&args.rpc)?;
    let provider = Arc::new(provider);
    let index_address: Address = args.index_address.parse()?;
    let contract = IndexReader::new(index_address, provider.clone());

    // Phase A: Discover all ITPs and their historical assets
    info!("Phase A: Discovering ITPs from chain...");

    let itp_count: U256 = contract.get_itp_count().call().await?;
    n = itp_count.as_u64();
    info!(itp_count = n, "Found ITPs on chain");

    let mut all_asset_addresses: HashSet<String> = HashSet::new();
    let mut all_events: Vec<(String, Vec<ItpEventData>)> = Vec::new();
    let mut rebalance_asset_count: usize = 0;

    for i in 1..=n {
        let mut itp_id_bytes = [0u8; 32];
        U256::from(i).to_big_endian(&mut itp_id_bytes);
        let itp_id_hex = format_itp_id(i);

        let mut events: Vec<ItpEventData> = Vec::new();

        // Query ITPCreated event
        let created_filter = contract
            .itp_created_filter()
            .topic1(ethers::types::H256::from(itp_id_bytes))
            .from_block(0u64);

        match created_filter.query_with_meta().await {
            Ok(created_events) => {
                for (event, meta) in &created_events {
                    let block = provider
                        .get_block(meta.block_number)
                        .await?
                        .ok_or("Block not found")?;
                    let ts = Utc.timestamp_opt(block.timestamp.as_u64() as i64, 0)
                        .single()
                        .unwrap_or_else(Utc::now);

                    for addr in &event.assets {
                        all_asset_addresses.insert(format!("{:?}", addr).to_lowercase());
                    }

                    // Call getITPState for authoritative inventory (event only has weights)
                    match contract.get_itp_state(itp_id_bytes.into()).call().await {
                        Ok((_creator, total_supply, nav, _assets, weights, inventory)) => {
                            events.push(ItpEventData {
                                assets: event.assets.clone(),
                                inventory,
                                weights: weights.clone(),
                                total_supply,
                                nav,
                                block_timestamp: ts,
                                event_type: "created".to_string(),
                            });
                        }
                        Err(e) => {
                            warn!(itp = i, %e, "Failed to get ITP state for created event, using weights as fallback");
                            events.push(ItpEventData {
                                assets: event.assets.clone(),
                                inventory: event.weights.clone(),
                                weights: event.weights.clone(),
                                total_supply: U256::zero(),
                                nav: U256::exp10(18),
                                block_timestamp: ts,
                                event_type: "created".to_string(),
                            });
                        }
                    }
                }
            }
            Err(e) => {
                warn!(itp = i, %e, "Failed to query ITPCreated events");
            }
        }

        // Query Rebalanced events
        let rebal_filter = contract
            .rebalanced_filter()
            .topic1(ethers::types::H256::from(itp_id_bytes))
            .from_block(0u64);

        match rebal_filter.query_with_meta().await {
            Ok(rebal_events) => {
                for (event, meta) in &rebal_events {
                    let block = provider
                        .get_block(meta.block_number)
                        .await?
                        .ok_or("Block not found")?;
                    let ts = Utc.timestamp_opt(block.timestamp.as_u64() as i64, 0)
                        .single()
                        .unwrap_or_else(Utc::now);

                    for addr in &event.new_assets {
                        all_asset_addresses.insert(format!("{:?}", addr).to_lowercase());
                        rebalance_asset_count += 1;
                    }

                    // Call getITPState for total_supply (not in Rebalanced event)
                    let total_supply = match contract.get_itp_state(itp_id_bytes.into()).call().await {
                        Ok((_creator, ts_val, _nav, _assets, _weights, _inv)) => ts_val,
                        Err(_) => U256::zero(),
                    };

                    events.push(ItpEventData {
                        assets: event.new_assets.clone(),
                        inventory: event.new_inventory.clone(),
                        weights: event.new_weights.clone(),
                        total_supply,
                        nav: event.nav,
                        block_timestamp: ts,
                        event_type: "rebalanced".to_string(),
                    });
                }
            }
            Err(e) => {
                warn!(itp = i, %e, "Failed to query Rebalanced events");
            }
        }

        // Also get current on-chain state
        match contract.get_itp_state(itp_id_bytes.into()).call().await {
            Ok((_creator, total_supply, nav, assets, weights, inventory)) => {
                for addr in &assets {
                    all_asset_addresses.insert(format!("{:?}", addr).to_lowercase());
                }

                // Store current state as a snapshot (use now as timestamp)
                events.push(ItpEventData {
                    assets,
                    inventory,
                    weights,
                    total_supply,
                    nav,
                    block_timestamp: Utc::now(),
                    event_type: "current".to_string(),
                });
            }
            Err(e) => {
                warn!(itp = i, %e, "Failed to fetch current ITP state");
            }
        }

        all_events.push((itp_id_hex, events));
    }

    // Query OrderSubmitted to build orderId→itpId map, then query FillConfirmed for supply changes
    info!("Phase A.2: Querying FillConfirmed events for totalSupply changes...");

    let order_filter = contract
        .order_submitted_filter()
        .from_block(0u64);

    let mut order_to_itp: HashMap<U256, (ethers::types::H256, u64)> = HashMap::new();
    if let Ok(events) = order_filter.query_with_meta().await {
        for (event, meta) in &events {
            let mut itp_bytes = [0u8; 32];
            itp_bytes.copy_from_slice(event.itp_id.as_ref());
            order_to_itp.insert(event.order_id, (ethers::types::H256::from(itp_bytes), meta.block_number.as_u64()));
        }
        info!(orders = order_to_itp.len(), "Built orderId→itpId map from OrderSubmitted events");
    }

    let fill_filter = contract
        .fill_confirmed_filter()
        .from_block(0u64);

    if let Ok(events) = fill_filter.query_with_meta().await {
        // Deduplicate by itpId — take the last fill block per ITP
        let mut itp_fill_blocks: HashMap<ethers::types::H256, u64> = HashMap::new();
        for (event, meta) in &events {
            if let Some((itp_id, _)) = order_to_itp.get(&event.order_id) {
                let entry = itp_fill_blocks.entry(*itp_id).or_insert(0);
                *entry = (*entry).max(meta.block_number.as_u64());
            }
        }

        for (itp_id_h256, block_num) in &itp_fill_blocks {
            let itp_id_bytes: [u8; 32] = (*itp_id_h256).into();
            let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));

            match contract.get_itp_state(itp_id_bytes.into()).call().await {
                Ok((_creator, total_supply, nav, assets, weights, inventory)) => {
                    let ts = {
                        let block = provider.get_block(*block_num).await?.ok_or("Block not found")?;
                        Utc.timestamp_opt(block.timestamp.as_u64() as i64, 0)
                            .single()
                            .unwrap_or_else(Utc::now)
                    };

                    // Find or create the events vec for this ITP
                    if let Some(entry) = all_events.iter_mut().find(|(id, _)| id == &itp_id_hex) {
                        entry.1.push(ItpEventData {
                            assets,
                            inventory,
                            weights,
                            total_supply,
                            nav,
                            block_timestamp: ts,
                            event_type: "fill".to_string(),
                        });
                    }
                }
                Err(e) => {
                    warn!(itp_id = %itp_id_hex, %e, "Failed to get ITP state for fill event");
                }
            }
        }

        info!(
            fills = events.len(),
            unique_itps = itp_fill_blocks.len(),
            "Phase A.2 complete: processed FillConfirmed events"
        );
    }

    // Map addresses to Bitget symbols
    let mut syms: HashSet<String> = HashSet::new();
    let mut unmapped: Vec<String> = Vec::new();

    for addr in &all_asset_addresses {
        match symbol_map.get(addr) {
            Some(pair) => {
                syms.insert(pair.clone());
            }
            None => {
                unmapped.push(addr.clone());
            }
        }
    }

    if !unmapped.is_empty() {
        warn!(
            count = unmapped.len(),
            "Asset addresses not found in symbol map (will skip price backfill)"
        );
    }

    info!(
        itps = n,
        unique_symbols = syms.len(),
        from_rebalances = rebalance_asset_count,
        unmapped = unmapped.len(),
        "Phase A complete: discovered all assets"
    );

    // Phase B: Store ITP inventory snapshots
    info!("Phase B: Storing ITP inventory snapshots...");

    let mut snapshots_stored_mut = 0u64;
    for (itp_id_hex, events) in &all_events {
        for event in events {
            let assets_strs: Vec<String> = event
                .assets
                .iter()
                .map(|a| format!("{:?}", a).to_lowercase())
                .collect();
            let inventory_strs: Vec<String> = event
                .inventory
                .iter()
                .map(|v| v.to_string())
                .collect();
            let weights_strs: Vec<String> = event
                .weights
                .iter()
                .map(|v| v.to_string())
                .collect();
            let nav_str = event.nav.to_string();
            let total_supply_str = event.total_supply.to_string();

            if let Err(e) = db::insert_itp_snapshot(
                &pool,
                itp_id_hex,
                &assets_strs,
                &inventory_strs,
                &nav_str,
                event.block_timestamp,
                &event.event_type,
                &total_supply_str,
                &weights_strs,
            )
            .await
            {
                error!(itp = %itp_id_hex, %e, "Failed to insert snapshot");
            } else {
                snapshots_stored_mut += 1;
            }
        }
    }
    snapshots_stored = snapshots_stored_mut;

    info!(snapshots_stored, "Phase B complete: snapshots stored");
    unique_symbols = syms;
    }; // end if !skip_chain

    // Phase C: Backfill kline prices
    info!("Phase C: Backfilling historical candles...");

    let bitget_config = BitgetReadOnlyConfig::from_env()?;
    let client = Arc::new(BitgetReadOnlyClientImpl::new(bitget_config)?);

    let symbols: Vec<String> = unique_symbols.into_iter().collect();
    let work_queue = Arc::new(Mutex::new(symbols.clone()));
    let total_inserted = Arc::new(std::sync::atomic::AtomicU64::new(0));

    let now_ms = Utc::now().timestamp_millis() as u64;
    let start_ms = now_ms - (args.days as u64) * 86_400_000;

    let mut handles = tokio::task::JoinSet::new();
    for worker_id in 0..args.concurrency {
        let queue = Arc::clone(&work_queue);
        let client = Arc::clone(&client);
        let pool = pool.clone();
        let inserted_counter = Arc::clone(&total_inserted);

        handles.spawn(async move {
            loop {
                let symbol = {
                    let mut q = queue.lock().await;
                    q.pop()
                };

                let symbol = match symbol {
                    Some(s) => s,
                    None => break,
                };

                info!(worker = worker_id, symbol = %symbol, "Starting backfill");

                let mut end_time = now_ms;
                let mut symbol_total: u64 = 0;

                loop {
                    match client
                        .get_history_candles_ohlc(&symbol, "1min", end_time, 200)
                        .await
                    {
                        Ok(candles) => {
                            if candles.is_empty() {
                                break;
                            }

                            let oldest_ts = candles[0].0;

                            // Insert 4 rows per candle: O/H/L/C at staggered timestamps
                            // This gives the OHLC nav computation proper spread within each bucket
                            let mut rows: Vec<(String, String, DateTime<Utc>)> = Vec::new();
                            for (ts, open, high, low, close) in &candles {
                                if *ts < start_ms {
                                    continue;
                                }
                                let base_secs = (*ts / 1000) as i64;
                                // Open at :00, High at :15, Low at :30, Close at :45
                                if let Some(dt) = Utc.timestamp_opt(base_secs, 0).single() {
                                    rows.push((symbol.clone(), open.clone(), dt));
                                }
                                if let Some(dt) = Utc.timestamp_opt(base_secs + 15, 0).single() {
                                    rows.push((symbol.clone(), high.clone(), dt));
                                }
                                if let Some(dt) = Utc.timestamp_opt(base_secs + 30, 0).single() {
                                    rows.push((symbol.clone(), low.clone(), dt));
                                }
                                if let Some(dt) = Utc.timestamp_opt(base_secs + 45, 0).single() {
                                    rows.push((symbol.clone(), close.clone(), dt));
                                }
                            }

                            // Also write proper klines
                            let mut kline_rows: Vec<(String, chrono::DateTime<chrono::Utc>, String, String, String, String)> = Vec::new();
                            for (ts, open, high, low, close) in &candles {
                                if *ts < start_ms {
                                    continue;
                                }
                                let base_secs = (*ts / 1000) as i64;
                                if let Some(dt) = Utc.timestamp_opt(base_secs, 0).single() {
                                    kline_rows.push((
                                        symbol.clone(),
                                        dt,
                                        open.clone(),
                                        high.clone(),
                                        low.clone(),
                                        close.clone(),
                                    ));
                                }
                            }

                            let candle_count = candles.iter().filter(|(ts, _, _, _, _)| *ts >= start_ms).count() as u64;

                            // Insert price rows (legacy 4-row-per-candle format)
                            match db::batch_insert_prices(&pool, &rows).await {
                                Ok(inserted) => {
                                    symbol_total += inserted;
                                }
                                Err(e) => {
                                    error!(symbol = %symbol, %e, "Failed to insert candles");
                                    break;
                                }
                            }

                            // Insert kline rows
                            if let Err(e) = db::batch_upsert_klines(&pool, &kline_rows).await {
                                error!(symbol = %symbol, %e, "Failed to insert klines");
                            }

                            if oldest_ts <= start_ms || candle_count == 0 {
                                break;
                            }

                            end_time = oldest_ts - 1;
                        }
                        Err(e) => {
                            warn!(symbol = %symbol, %e, "Failed to fetch candles, skipping remainder");
                            break;
                        }
                    }
                }

                inserted_counter.fetch_add(symbol_total, std::sync::atomic::Ordering::Relaxed);
                info!(
                    worker = worker_id,
                    symbol = %symbol,
                    candles = symbol_total,
                    "{symbol}: {symbol_total} candles inserted"
                );
            }
        });
    }

    while let Some(result) = handles.join_next().await {
        if let Err(e) = result {
            error!(%e, "Worker task panicked");
        }
    }

    let total = total_inserted.load(std::sync::atomic::Ordering::Relaxed);
    let elapsed = started.elapsed();

    info!(
        itps = n,
        symbols = symbols.len(),
        snapshots = snapshots_stored,
        candles = total,
        elapsed_secs = elapsed.as_secs(),
        "Backfill complete"
    );

    Ok(())
}
