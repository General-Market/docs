use std::sync::Arc;
use std::sync::atomic::Ordering;
use ethers::prelude::*;
use tracing::warn;
use common::types::{CrossChainOrder, CrossChainSellOrderEvent, ItpCreationRequest};
use crate::api::AppState;
use crate::chain_cache::{
    NavSnapshot, UserBalances, UserAllowances, UserOrder, MorphoPositionSnapshot,
    UserCostBasis, FillRecord, CachedLimitOrder, CachedIssuer,
};

// Reuse the IndexCollector abigen pattern from itp_collector.rs
abigen!(
    NavReader,
    r#"[
        function getItpCount() external view returns (uint256)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
        function getItpNameSymbol(bytes32 itpId) external view returns (string name, string symbol)
    ]"#
);

abigen!(
    OracleReader,
    r#"[
        function currentPrice() external view returns (uint256)
        function lastUpdated() external view returns (uint256)
        function lastCycleNumber() external view returns (uint256)
    ]"#
);

abigen!(
    BalanceReader,
    r#"[
        function balanceOf(address account) external view returns (uint256)
        function allowance(address owner, address spender) external view returns (uint256)
    ]"#
);

abigen!(
    UserSharesReader,
    r#"[
        function getUserShares(bytes32 itpId, address user) external view returns (uint256)
        function getOrder(uint256 orderId) external view returns ((uint256 id, address user, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline, bytes32 itpId, uint256 timestamp, uint8 status) order)
        function nextOrderId() external view returns (uint256)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
    ]"#
);

abigen!(
    BridgeProxyPoller,
    r#"[
        function getBridgedItp(bytes32 orbitItpId) external view returns (address)
    ]"#
);

abigen!(
    MorphoPoller,
    r#"[
        function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
    ]"#
);

abigen!(
    IrmReader,
    r#"[
        function rates(bytes32 marketId) external view returns (uint256)
    ]"#
);

abigen!(
    IssuerRegistryPoller,
    r#"[{"type":"function","name":"getActiveIssuerEndpoints","inputs":[],"outputs":[{"name":"","type":"tuple[]","components":[{"name":"addr","type":"address"},{"name":"endpoint","type":"string"},{"name":"blsPubkey","type":"bytes"}]}],"stateMutability":"view"},{"type":"function","name":"activeIssuerCount","inputs":[],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},{"type":"function","name":"registryNonce","inputs":[],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},{"type":"function","name":"aggregatedPubkey","inputs":[],"outputs":[{"name":"","type":"bytes"}],"stateMutability":"view"},{"type":"function","name":"consensusPaused","inputs":[],"outputs":[{"name":"","type":"bool"}],"stateMutability":"view"}]"#
);

abigen!(
    CycleReader,
    r#"[
        function lastProcessedCycleNumber() external view returns (uint256)
        function nextOrderId() external view returns (uint256)
    ]"#
);

abigen!(
    BridgeProxySettlementReader,
    r#"[
        function nextCreationNonce() external view returns (uint256)
        function isPending(uint256 nonce) external view returns (bool)
        function getPendingCreation(uint256 nonce) external view returns (address admin, string name, string symbol, uint256[] weights, address[] assets, uint256[] prices, uint64 createdAt, bool completed)
    ]"#
);

abigen!(
    SettlementCustodyReader,
    r#"[
        function getCrossChainOrder(uint256 orderId) external view returns (bytes32 itpId, address user, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline, uint256 createdAt)
        function getCrossChainSellOrder(uint256 orderId) external view returns (bytes32 itpId, address user, address bridgedItpAddress, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline, uint256 createdAt)
        event CrossChainOrderCreated(uint256 indexed orderId, bytes32 indexed itpId, address indexed user, uint256 amount)
        event CrossChainSellOrderCreated(uint256 indexed orderId, bytes32 indexed itpId, address indexed user, address bridgedItpAddress, uint256 amount, uint256 limitPrice)
    ]"#
);

abigen!(
    EventScanner,
    r#"[
        event OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
    ]"#
);

pub async fn poll_nav_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let reader = NavReader::new(index_addr, Arc::clone(&state.l3_provider));

    // Resolve BridgeProxy once for settlement address lookups
    let bridge_proxy_addr = crate::api::deployment_addr(&state.deployment, "BridgeProxy")?;
    let bridge_proxy = BridgeProxyPoller::new(bridge_proxy_addr, Arc::clone(&state.settlement_provider));

    let count: U256 = reader.get_itp_count().call().await?;
    let mut snapshots = Vec::new();

    // ITP IDs are 1-based (same as itp_collector.rs): U256(i).to_big_endian()
    for i in 1..=count.as_u64() {
        let mut id_bytes = [0u8; 32];
        U256::from(i).to_big_endian(&mut id_bytes);

        match reader.get_itp_state(id_bytes.into()).call().await {
            Ok((_creator, total_supply, nav, _assets, _weights, _inventory)) => {
                let nav_f64 = nav.as_u128() as f64 / 1e18;
                let supply_f64 = total_supply.as_u128() as f64 / 1e18;
                let aum = nav_f64 * supply_f64;

                // Read name/symbol
                let (name, symbol) = match reader.get_itp_name_symbol(id_bytes.into()).call().await {
                    Ok((n, s)) => (n, s),
                    Err(_) => (String::new(), String::new()),
                };

                // Resolve bridged ERC20 address on Settlement chain
                let settlement_address = match bridge_proxy.get_bridged_itp(id_bytes.into()).call().await {
                    Ok(addr) if addr != Address::zero() => Some(format!("{:?}", addr)),
                    _ => None,
                };

                snapshots.push(NavSnapshot {
                    itp_id: format!("0x{}", hex::encode(id_bytes)),
                    name,
                    symbol,
                    nav_per_share: nav_f64,
                    total_supply: total_supply.to_string(),
                    aum_usd: aum,
                    settlement_address,
                });
            }
            Err(e) => {
                warn!(itp_index = i, %e, "Failed to read ITP state");
            }
        }
    }

    let mut nav = state.chain_cache.nav.write().await;
    *nav = snapshots;
    state.chain_cache.nav_gen.bump();
    Ok(())
}

pub async fn poll_oracle_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let oracle_addr = crate::api::deployment_addr(&state.morpho_deployment, "ITP_NAV_ORACLE")
        .or_else(|_| crate::api::deployment_addr(&state.morpho_deployment, "MOCK_ORACLE"))?;
    let reader = OracleReader::new(oracle_addr, Arc::clone(&state.l3_provider));

    let price = reader.current_price().call().await?;
    let updated = reader.last_updated().call().await?;
    let cycle = reader.last_cycle_number().call().await?;

    // Read borrow rate from CuratorRateIRM (falls back to "0" if not deployed)
    let irm_addr_str = state.morpho_deployment["contracts"].get("CURATOR_RATE_IRM")
        .or_else(|| state.morpho_deployment["contracts"].get("ADAPTIVE_IRM"))
        .and_then(|v| v.as_str())
        .unwrap_or("0x0000000000000000000000000000000000000000");
    let irm_addr: Address = irm_addr_str.parse().unwrap_or_default();

    let market_id_str = state.morpho_deployment["contracts"]["MARKET_ID"]
        .as_str()
        .unwrap_or("0x0000000000000000000000000000000000000000000000000000000000000000");
    let market_id_hex = market_id_str.strip_prefix("0x").unwrap_or(market_id_str);
    let market_id_bytes = hex::decode(market_id_hex).unwrap_or_else(|_| vec![0u8; 32]);
    let mut market_id_arr = [0u8; 32];
    let len = market_id_bytes.len().min(32);
    market_id_arr[..len].copy_from_slice(&market_id_bytes[..len]);

    let borrow_rate_ray = if irm_addr != Address::zero() {
        let irm = IrmReader::new(irm_addr, Arc::clone(&state.l3_provider));
        irm.rates(market_id_arr).call().await.unwrap_or_default().to_string()
    } else {
        "0".to_string()
    };

    let mut oracle = state.chain_cache.oracle.write().await;
    *oracle = crate::chain_cache::OracleSnapshot {
        price: price.to_string(),
        last_updated: updated.as_u64(),
        last_cycle: cycle.as_u64(),
        borrow_rate_ray,
    };
    state.chain_cache.oracle_gen.bump();
    Ok(())
}

// ── ITP ID helper (1-based, big-endian bytes32) ──

fn itp_id_bytes(n: u64) -> [u8; 32] {
    let mut id = [0u8; 32];
    U256::from(n).to_big_endian(&mut id);
    id
}

// ── Per-user pollers ──

pub async fn poll_user_balances_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let users = state.chain_cache.users.read().await;
    if users.is_empty() {
        return Ok(());
    }
    // Snapshot user addresses + cache refs
    let user_list: Vec<(Address, Arc<tokio::sync::RwLock<crate::chain_cache::UserCache>>)> = users
        .iter()
        .filter_map(|(addr_str, cache)| {
            addr_str.parse::<Address>().ok().map(|a| (a, Arc::clone(cache)))
        })
        .collect();
    drop(users);

    // Resolve contract addresses
    let settlement_usdc_addr = crate::api::deployment_addr(&state.deployment, "SETTLEMENT_USDC")?;
    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let l3_usdc_addr = crate::api::deployment_addr(&state.deployment, "L3_WUSDC")?;

    // Read all ITP IDs from the nav cache (already iterated during poll_nav_once)
    let nav_snapshots = state.chain_cache.nav.read().await;
    let itp_ids: Vec<[u8; 32]> = nav_snapshots.iter().filter_map(|snap| {
        let hex = snap.itp_id.strip_prefix("0x").unwrap_or(&snap.itp_id);
        hex::decode(hex).ok().and_then(|bytes| {
            if bytes.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                Some(arr)
            } else {
                None
            }
        })
    }).collect();
    // Also collect itp_id hex strings for the map keys
    let itp_id_hexes: Vec<String> = nav_snapshots.iter().map(|s| s.itp_id.clone()).collect();
    drop(nav_snapshots);

    // Fallback: if no nav snapshots yet, poll at least ITP #1
    let itp_ids = if itp_ids.is_empty() {
        vec![itp_id_bytes(1)]
    } else {
        itp_ids
    };
    let itp_id_hexes = if itp_id_hexes.is_empty() {
        vec![format!("0x{}", hex::encode(itp_id_bytes(1)))]
    } else {
        itp_id_hexes
    };

    // Resolve vault ERC20 address from deployment (L3 vault token)
    let vault_addr = crate::api::deployment_addr(&state.deployment, "ITP_Vault").unwrap_or_default();
    let has_vault = vault_addr != Address::zero();

    for (user, user_cache) in &user_list {
        // Settlement USDC balance
        let usdc = BalanceReader::new(settlement_usdc_addr, Arc::clone(&state.settlement_provider));
        let usdc_bal = usdc.balance_of(*user).call().await.unwrap_or_default();

        // L3 USDC (WUSDC) balance
        let l3_usdc = BalanceReader::new(l3_usdc_addr, Arc::clone(&state.l3_provider));
        let l3_usdc_bal = l3_usdc.balance_of(*user).call().await.unwrap_or_default();

        // L3 ITP shares — read for ALL ITPs
        let shares_reader = UserSharesReader::new(index_addr, Arc::clone(&state.l3_provider));
        let mut shares_map = std::collections::HashMap::new();
        for (idx, itp_id) in itp_ids.iter().enumerate() {
            let shares = shares_reader.get_user_shares(*itp_id, *user).call().await.unwrap_or_default();
            if !shares.is_zero() {
                if let Some(hex_key) = itp_id_hexes.get(idx) {
                    shares_map.insert(hex_key.clone(), shares.to_string());
                }
            }
        }

        // L3 vault ERC20 balance (used as Morpho collateral)
        let bridged_bal = if has_vault {
            let vault = BalanceReader::new(vault_addr, Arc::clone(&state.l3_provider));
            vault.balance_of(*user).call().await.unwrap_or_default()
        } else {
            U256::zero()
        };

        let mut uc = user_cache.write().await;
        uc.balances = UserBalances {
            usdc_l3: l3_usdc_bal.to_string(),
            usdc_settlement: usdc_bal.to_string(),
            itp_shares: shares_map,
            bridged_itp: bridged_bal.to_string(),
            itp_nonce: 0,
        };
        uc.balances_gen.bump();
    }

    Ok(())
}

pub async fn poll_user_allowances_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let users = state.chain_cache.users.read().await;
    if users.is_empty() {
        return Ok(());
    }
    let user_list: Vec<(Address, Arc<tokio::sync::RwLock<crate::chain_cache::UserCache>>)> = users
        .iter()
        .filter_map(|(addr_str, cache)| {
            addr_str.parse::<Address>().ok().map(|a| (a, Arc::clone(cache)))
        })
        .collect();
    drop(users);

    let l3_usdc_addr = crate::api::deployment_addr(&state.deployment, "L3_WUSDC")?;
    let settlement_custody_addr = crate::api::deployment_addr(&state.deployment, "SettlementBridgeCustody")?;
    let morpho_addr = crate::api::deployment_addr(&state.morpho_deployment, "MORPHO")?;

    // Vault ERC20 on L3 (Morpho collateral)
    let vault_addr = crate::api::deployment_addr(&state.deployment, "ITP_Vault").unwrap_or_default();
    let has_vault = vault_addr != Address::zero();

    for (user, user_cache) in &user_list {
        // L3_WUSDC allowance to Morpho (on L3)
        let l3_usdc = BalanceReader::new(l3_usdc_addr, Arc::clone(&state.l3_provider));
        let usdc_to_morpho = l3_usdc.allowance(*user, morpho_addr).call().await.unwrap_or_default();

        // Settlement USDC allowance to custody (on Settlement chain)
        let settlement_usdc_addr = crate::api::deployment_addr(&state.deployment, "SETTLEMENT_USDC").unwrap_or_default();
        let settlement_usdc = BalanceReader::new(settlement_usdc_addr, Arc::clone(&state.settlement_provider));
        let usdc_to_custody = settlement_usdc.allowance(*user, settlement_custody_addr).call().await.unwrap_or_default();

        // Vault token allowance to Morpho (on L3)
        let itp_to_morpho = if has_vault {
            let vault = BalanceReader::new(vault_addr, Arc::clone(&state.l3_provider));
            vault.allowance(*user, morpho_addr).call().await.unwrap_or_default()
        } else {
            U256::zero()
        };

        let mut uc = user_cache.write().await;
        uc.allowances = UserAllowances {
            usdc_l3_to_index: usdc_to_morpho.to_string(),
            usdc_settlement_to_custody: usdc_to_custody.to_string(),
            itp_to_morpho: itp_to_morpho.to_string(),
        };
        uc.allowances_gen.bump();
    }

    Ok(())
}

pub async fn poll_user_orders_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let users = state.chain_cache.users.read().await;
    if users.is_empty() {
        return Ok(());
    }
    let user_list: Vec<(String, Arc<tokio::sync::RwLock<crate::chain_cache::UserCache>>)> = users
        .iter()
        .map(|(addr_str, cache)| (addr_str.clone(), Arc::clone(cache)))
        .collect();
    drop(users);

    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let reader = UserSharesReader::new(index_addr, Arc::clone(&state.l3_provider));

    for (user_addr, user_cache) in &user_list {
        // Query DB for active + recently filled orders for this user.
        // Include filled/cancelled (status 2,3) from last 5 min so frontend
        // can see the fill transition and display them in portfolio.
        let rows = sqlx::query_as::<_, (i64,)>(
            "SELECT order_id FROM trades WHERE LOWER(user_address) = $1 \
             AND (status IN (0, 1) OR (status IN (2, 3) AND fill_timestamp > NOW() - INTERVAL '5 minutes') \
             OR order_timestamp > NOW() - INTERVAL '5 minutes') \
             ORDER BY order_id DESC LIMIT 50"
        )
        .bind(user_addr)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        let mut orders = Vec::new();

        for (order_id,) in &rows {
            let oid = U256::from(*order_id as u64);

            // Read on-chain order state
            let order_data = match reader.get_order(oid).call().await {
                Ok(d) => d,
                Err(e) => {
                    warn!(order_id = *order_id, %e, "Failed to read order on-chain");
                    continue;
                }
            };

            // Check for FillConfirmed events
            let fill_filter = reader.fill_confirmed_filter()
                .topic1(oid)
                .from_block(0u64);

            let (fill_price, fill_amount, fill_cycle) = match fill_filter.query().await {
                Ok(logs) => {
                    if let Some(last) = logs.last() {
                        (
                            Some(last.fill_price.to_string()),
                            Some(last.fill_amount.to_string()),
                            Some(last.cycle_number.as_u64()),
                        )
                    } else {
                        (None, None, None)
                    }
                }
                Err(_) => (None, None, None),
            };

            // order_data tuple: (id, user, pairId, side, amount, limitPrice, slippageTier, deadline, itpId, timestamp, status)
            orders.push(UserOrder {
                order_id: order_data.0.as_u64(),
                user: format!("{:?}", order_data.1),
                side: order_data.3,
                amount: order_data.4.to_string(),
                limit_price: order_data.5.to_string(),
                itp_id: format!("0x{}", hex::encode(order_data.8)),
                timestamp: order_data.9.as_u64(),
                status: order_data.10,
                fill_price,
                fill_amount,
                fill_cycle,
            });
        }

        let mut uc = user_cache.write().await;
        uc.orders = orders;
        uc.orders_gen.bump();
    }

    Ok(())
}

// ── Morpho position poller ──

pub async fn poll_user_positions_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let users = state.chain_cache.users.read().await;
    if users.is_empty() {
        return Ok(());
    }
    let user_list: Vec<(Address, Arc<tokio::sync::RwLock<crate::chain_cache::UserCache>>)> = users
        .iter()
        .filter_map(|(addr_str, cache)| {
            addr_str.parse::<Address>().ok().map(|a| (a, Arc::clone(cache)))
        })
        .collect();
    drop(users);

    let morpho_addr = crate::api::deployment_addr(&state.morpho_deployment, "MORPHO")?;

    let market_id_str = state.morpho_deployment["contracts"]["MARKET_ID"]
        .as_str()
        .ok_or("Missing MARKET_ID in morpho deployment")?;
    let market_id_bytes: [u8; 32] = {
        let hex_str = market_id_str.strip_prefix("0x").unwrap_or(market_id_str);
        let bytes = hex::decode(hex_str).map_err(|e| format!("Invalid market_id: {}", e))?;
        let mut arr = [0u8; 32];
        let len = bytes.len().min(32);
        arr[..len].copy_from_slice(&bytes[..len]);
        arr
    };

    let morpho = MorphoPoller::new(morpho_addr, Arc::clone(&state.l3_provider));

    for (user, user_cache) in &user_list {
        let (supply_shares, borrow_shares, collateral) = morpho
            .position(market_id_bytes, *user)
            .call()
            .await
            .unwrap_or_default();

        let mut uc = user_cache.write().await;
        uc.positions = MorphoPositionSnapshot {
            supply_shares: supply_shares.to_string(),
            borrow_shares: U256::from(borrow_shares).to_string(),
            collateral: U256::from(collateral).to_string(),
        };
        uc.positions_gen.bump();
    }

    Ok(())
}

// ── Cost basis poller ──

pub async fn poll_user_cost_basis_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let users = state.chain_cache.users.read().await;
    if users.is_empty() {
        return Ok(());
    }
    let user_list: Vec<(Address, String, Arc<tokio::sync::RwLock<crate::chain_cache::UserCache>>)> = users
        .iter()
        .filter_map(|(addr_str, cache)| {
            addr_str.parse::<Address>().ok().map(|a| (a, addr_str.clone(), Arc::clone(cache)))
        })
        .collect();
    drop(users);

    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let scanner = EventScanner::new(index_addr, Arc::clone(&state.l3_provider));

    // Get latest block for upper bound
    let latest_block = state.l3_provider.get_block_number().await?.as_u64();

    for (user, _user_addr_str, user_cache) in &user_list {
        // Read last scanned block for this user
        let from_block = {
            let uc = user_cache.read().await;
            if uc.last_scanned_block == 0 { 0 } else { uc.last_scanned_block + 1 }
        };

        if from_block > latest_block {
            continue; // already up to date
        }

        // Query OrderSubmitted events filtered by user (topic2 = indexed user)
        let order_events = scanner
            .order_submitted_filter()
            .topic2(*user)
            .from_block(from_block)
            .to_block(latest_block)
            .query()
            .await
            .unwrap_or_default();

        // Collect order IDs and their sides + limit prices from the events
        let mut order_sides: std::collections::HashMap<u64, (u8, U256)> = std::collections::HashMap::new();
        for ev in &order_events {
            order_sides.insert(ev.order_id.as_u64(), (ev.side, ev.limit_price));
        }

        // Query FillConfirmed events for each order
        let mut new_fills: Vec<FillRecord> = Vec::new();

        for (order_id, (side, limit_price)) in &order_sides {
            let oid = U256::from(*order_id);
            let fill_events = scanner
                .fill_confirmed_filter()
                .topic1(oid)
                .from_block(from_block)
                .to_block(latest_block)
                .query()
                .await
                .unwrap_or_default();

            for fill in &fill_events {
                new_fills.push(FillRecord {
                    order_id: *order_id,
                    side: *side,
                    fill_price: fill.fill_price.to_string(),
                    fill_amount: fill.fill_amount.to_string(),
                    limit_price: limit_price.to_string(),
                });
            }
        }

        // Also scan fills for orders that were submitted BEFORE from_block but filled in this range.
        // We already have those fills from the existing cost_basis.fills in the cache.
        // Merge new fills with existing fills.
        let mut uc = user_cache.write().await;
        let mut all_fills = uc.cost_basis.fills.clone();
        all_fills.extend(new_fills);

        // Compute VWAP cost basis from all fills
        let mut total_cost = U256::zero();
        let mut total_shares_bought = U256::zero();
        let mut total_sell_proceeds = U256::zero();
        let mut total_shares_sold = U256::zero();
        let e18 = U256::from_dec_str("1000000000000000000").unwrap();

        for fill in &all_fills {
            let fill_amount = U256::from_dec_str(&fill.fill_amount).unwrap_or_default();
            let fill_price = U256::from_dec_str(&fill.fill_price).unwrap_or_default();

            if fill.side == 0 {
                // BUY: totalCost += fillAmount, totalSharesBought += fillAmount * 1e18 / fillPrice
                total_cost += fill_amount;
                if fill_price > U256::zero() {
                    total_shares_bought += fill_amount * e18 / fill_price;
                }
            } else {
                // SELL: totalSharesSold += fillAmount, totalSellProceeds += fillAmount * fillPrice / 1e18
                total_shares_sold += fill_amount;
                total_sell_proceeds += fill_amount * fill_price / e18;
            }
        }

        let avg_cost_per_share = if total_shares_bought > U256::zero() {
            total_cost * e18 / total_shares_bought
        } else {
            U256::zero()
        };

        let realized_pnl = if total_shares_sold > U256::zero() {
            let cost_of_sold = avg_cost_per_share * total_shares_sold / e18;
            if total_sell_proceeds >= cost_of_sold {
                total_sell_proceeds - cost_of_sold
            } else {
                // Negative PnL — store as 0 since U256 can't be negative
                // In practice the frontend shows "0" for loss (or we prefix with sign info)
                U256::zero()
            }
        } else {
            U256::zero()
        };

        uc.cost_basis = UserCostBasis {
            total_cost: total_cost.to_string(),
            total_shares_bought: total_shares_bought.to_string(),
            avg_cost_per_share: avg_cost_per_share.to_string(),
            total_sell_proceeds: total_sell_proceeds.to_string(),
            total_shares_sold: total_shares_sold.to_string(),
            realized_pnl: realized_pnl.to_string(),
            fills: all_fills,
        };
        uc.cost_basis_gen.bump();
        uc.last_scanned_block = latest_block;
    }

    Ok(())
}

// ── Global L3 backend state pollers ──

/// Poll pending orders (status == 0) from the Index contract.
/// Scans the last 100 order IDs for pending status.
pub async fn poll_pending_orders_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let reader = UserSharesReader::new(index_addr, Arc::clone(&state.l3_provider));

    let next_id = reader.next_order_id().call().await?.as_u64();
    let start = next_id.saturating_sub(100);

    let mut pending = Vec::new();
    for oid in start..next_id {
        let order = match reader.get_order(U256::from(oid)).call().await {
            Ok(o) => o,
            Err(_) => continue,
        };
        // status field is index 10; status 0 = pending
        if order.10 == 0 {
            pending.push(CachedLimitOrder {
                order_id: order.0.as_u64(),
                user: format!("{:?}", order.1),
                itp_id: format!("0x{}", hex::encode(order.8)),
                side: order.3,
                amount: order.4.to_string(),
                limit_price: order.5.to_string(),
                slippage_tier: order.6.as_u64() as u8,
                deadline: order.7.to_string(),
                timestamp: order.9.as_u64(),
                status: order.10,
            });
        }
    }

    let mut cache = state.chain_cache.pending_orders.write().await;
    *cache = pending;
    state.chain_cache.pending_orders_gen.bump();
    Ok(())
}

/// Poll batched orders (status == 1) from the Index contract.
/// Scans the last 100 order IDs for batched status.
pub async fn poll_batched_orders_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let reader = UserSharesReader::new(index_addr, Arc::clone(&state.l3_provider));

    let next_id = reader.next_order_id().call().await?.as_u64();
    let start = next_id.saturating_sub(100);

    let mut batched = Vec::new();
    for oid in start..next_id {
        let order = match reader.get_order(U256::from(oid)).call().await {
            Ok(o) => o,
            Err(_) => continue,
        };
        // status 1 = batched
        if order.10 == 1 {
            batched.push(CachedLimitOrder {
                order_id: order.0.as_u64(),
                user: format!("{:?}", order.1),
                itp_id: format!("0x{}", hex::encode(order.8)),
                side: order.3,
                amount: order.4.to_string(),
                limit_price: order.5.to_string(),
                slippage_tier: order.6.as_u64() as u8,
                deadline: order.7.to_string(),
                timestamp: order.9.as_u64(),
                status: order.10,
            });
        }
    }

    let mut cache = state.chain_cache.batched_orders.write().await;
    *cache = batched;
    state.chain_cache.batched_orders_gen.bump();
    Ok(())
}

/// Poll the IssuerRegistry for active issuer endpoints + BLS pubkeys.
pub async fn poll_issuer_registry_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let registry_addr = crate::api::deployment_addr(&state.deployment, "IssuerRegistry")?;
    let registry = IssuerRegistryPoller::new(registry_addr, Arc::clone(&state.l3_provider));

    // Returns Vec<(Address, String, Bytes)> — (addr, endpoint, blsPubkey)
    let issuers = registry.get_active_issuer_endpoints().call().await?;

    let cached: Vec<CachedIssuer> = issuers
        .into_iter()
        .map(|(addr, endpoint, bls_pubkey)| CachedIssuer {
            address: format!("{:?}", addr),
            endpoint,
            bls_pubkey: format!("0x{}", hex::encode(&bls_pubkey)),
        })
        .collect();

    let mut cache = state.chain_cache.issuer_registry.write().await;
    *cache = cached;
    state.chain_cache.issuer_registry_gen.bump();
    Ok(())
}

/// Poll cycle metadata: lastProcessedCycleNumber and nextOrderId from Index.
pub async fn poll_cycle_metadata_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let reader = CycleReader::new(index_addr, Arc::clone(&state.l3_provider));

    // Bind call builders to let-variables to extend their lifetimes
    let c_last_cycle = reader.last_processed_cycle_number();
    let c_next_order = reader.next_order_id();
    let (last_cycle, next_order_id) = tokio::join!(
        c_last_cycle.call(),
        c_next_order.call()
    );

    if let Ok(c) = last_cycle {
        state.chain_cache.last_cycle.store(c.as_u64(), Ordering::Relaxed);
    }
    if let Ok(n) = next_order_id {
        state.chain_cache.next_order_id.store(n.as_u64(), Ordering::Relaxed);
    }

    Ok(())
}

/// Poll IssuerRegistry metadata: activeIssuerCount, aggregatedPubkey, consensusPaused.
pub async fn poll_registry_metadata_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let registry_addr = crate::api::deployment_addr(&state.deployment, "IssuerRegistry")?;
    let registry = IssuerRegistryPoller::new(registry_addr, Arc::clone(&state.l3_provider));

    // Bind call builders to let-variables to extend their lifetimes
    let c_active = registry.active_issuer_count();
    let c_pubkey = registry.aggregated_pubkey();
    let c_paused = registry.consensus_paused();
    let (active_count, agg_pubkey, paused) = tokio::join!(
        c_active.call(),
        c_pubkey.call(),
        c_paused.call()
    );

    if let Ok(count) = active_count {
        state.chain_cache.active_issuer_count.store(count.as_u64(), Ordering::Relaxed);
    }
    if let Ok(pk) = agg_pubkey {
        let mut cache = state.chain_cache.aggregated_pubkey.write().await;
        *cache = pk.to_vec();
        state.chain_cache.aggregated_pubkey_gen.bump();
    }
    if let Ok(p) = paused {
        state.chain_cache.consensus_paused.store(p, Ordering::Relaxed);
    }

    Ok(())
}

/// Poll settlement chain state: confirmed block, next creation nonce, and pending creations.
pub async fn poll_settlement_state_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Get confirmed block (latest - 10 for finality buffer).
    // IMPORTANT: confirmed_block is stored AFTER event caches are populated (end of function)
    // to prevent race: issuer reads confirmed_block then queries events — if we store
    // confirmed_block first, the issuer may see the new block height but get stale event data.
    let latest_block = state.settlement_provider.get_block_number().await?.as_u64();
    let confirmed = latest_block.saturating_sub(10);

    // Read BridgeProxy on settlement chain
    let bridge_addr = crate::api::deployment_addr(&state.deployment, "BridgeProxy")?;
    let bridge = BridgeProxySettlementReader::new(bridge_addr, Arc::clone(&state.settlement_provider));

    let next_nonce = bridge.next_creation_nonce().call().await?.as_u64();
    state.chain_cache.settlement_next_nonce.store(next_nonce, Ordering::Relaxed);

    // Scan all nonces for pending creations
    let mut pending = Vec::new();
    for nonce in 0..next_nonce {
        let is_pending = match bridge.is_pending(U256::from(nonce)).call().await {
            Ok(p) => p,
            Err(_) => continue,
        };
        if !is_pending {
            continue;
        }
        match bridge.get_pending_creation(U256::from(nonce)).call().await {
            Ok((admin, name, symbol, weights, assets, prices, _created_at, completed)) => {
                if completed || admin.is_zero() {
                    continue;
                }
                let req = ItpCreationRequest {
                    admin,
                    nonce: U256::from(nonce),
                    name,
                    symbol,
                    weights,
                    assets,
                    prices,
                    block_number: 0, // Not available from view call
                    tx_hash: H256::zero(),
                };
                match serde_json::to_value(&req) {
                    Ok(val) => pending.push(val),
                    Err(e) => warn!(nonce, %e, "Failed to serialize pending creation"),
                }
            }
            Err(e) => {
                warn!(nonce, %e, "Failed to read pending creation");
            }
        }
    }

    let mut cache = state.chain_cache.pending_creations.write().await;
    *cache = pending;
    state.chain_cache.pending_creations_gen.bump();

    // ── Cross-chain order event scanning ─────────────────────────────
    let custody_addr = crate::api::deployment_addr(&state.deployment, "SettlementBridgeCustody")
        .unwrap_or_default();
    if !custody_addr.is_zero() && confirmed > 0 {
        let custody = SettlementCustodyReader::new(custody_addr, Arc::clone(&state.settlement_provider));
        let from_block = confirmed.saturating_sub(10000);

        // Scan CrossChainOrderCreated events
        let buy_filter = custody.cross_chain_order_created_filter()
            .from_block(from_block)
            .to_block(confirmed);
        let buy_events = buy_filter.query_with_meta().await.unwrap_or_default();

        let chain_id = state.settlement_provider.get_chainid().await.unwrap_or_default().as_u64();
        let mut buy_orders = Vec::new();
        for (event, meta) in &buy_events {
            // Enrich with full order data via view call
            match custody.get_cross_chain_order(event.order_id).call().await {
                Ok((itp_id, user, amount, limit_price, slippage_tier, deadline, created_at)) => {
                    if user.is_zero() {
                        continue;
                    }
                    let order = CrossChainOrder {
                        order_id: event.order_id,
                        itp_id: H256::from(itp_id),
                        user,
                        amount,
                        limit_price,
                        slippage_tier: slippage_tier.as_u64() as u8,
                        deadline,
                        created_at,
                        chain_id,
                        block_number: meta.block_number.as_u64(),
                        tx_hash: meta.transaction_hash,
                    };
                    if let Ok(val) = serde_json::to_value(&order) {
                        buy_orders.push(val);
                    }
                }
                Err(e) => {
                    warn!(order_id = %event.order_id, %e, "Failed to read cross-chain order");
                }
            }
        }

        let mut buy_cache = state.chain_cache.cross_chain_buy_orders.write().await;
        *buy_cache = buy_orders;
        state.chain_cache.cross_chain_buy_orders_gen.bump();

        // Scan CrossChainSellOrderCreated events
        let sell_filter = custody.cross_chain_sell_order_created_filter()
            .from_block(from_block)
            .to_block(confirmed);
        let sell_events = sell_filter.query_with_meta().await.unwrap_or_default();

        let mut sell_orders = Vec::new();
        for (event, meta) in &sell_events {
            let sell_event = CrossChainSellOrderEvent {
                order_id: event.order_id,
                itp_id: H256::from(event.itp_id),
                user: event.user,
                bridged_itp_address: event.bridged_itp_address,
                amount: event.amount,
                limit_price: event.limit_price,
                block_number: meta.block_number.as_u64(),
                tx_hash: meta.transaction_hash,
            };
            if let Ok(val) = serde_json::to_value(&sell_event) {
                sell_orders.push(val);
            }
        }

        let mut sell_cache = state.chain_cache.cross_chain_sell_orders.write().await;
        *sell_cache = sell_orders;
        state.chain_cache.cross_chain_sell_orders_gen.bump();
    }

    // Store confirmed_block LAST — after all event caches are populated.
    // This guarantees that when an issuer reads confirmed_block=N, all events
    // up to block N are already in the cache.
    state.chain_cache.settlement_confirmed_block.store(confirmed, Ordering::Relaxed);

    Ok(())
}
