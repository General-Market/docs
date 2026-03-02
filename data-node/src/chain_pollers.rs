use std::sync::Arc;
use ethers::prelude::*;
use tracing::warn;
use crate::api::AppState;
use crate::chain_cache::{NavSnapshot, UserBalances, UserAllowances, UserOrder, MorphoPositionSnapshot, UserCostBasis, FillRecord};

// Reuse the IndexCollector abigen pattern from itp_collector.rs
abigen!(
    NavReader,
    r#"[
        function getItpCount() external view returns (uint256)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
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
    EventScanner,
    r#"[
        event OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
        event FillConfirmed(uint256 indexed orderId, uint256 indexed cycleNumber, uint256 fillPrice, uint256 fillAmount)
    ]"#
);

pub async fn poll_nav_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let reader = NavReader::new(index_addr, Arc::clone(&state.l3_provider));

    // Resolve BridgeProxy once for arbAddress lookups
    let bridge_proxy_addr = crate::api::deployment_addr(&state.deployment, "BridgeProxy")?;
    let bridge_proxy = BridgeProxyPoller::new(bridge_proxy_addr, Arc::clone(&state.arb_provider));

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

                // Resolve bridged ERC20 address on Arbitrum
                let arb_address = match bridge_proxy.get_bridged_itp(id_bytes.into()).call().await {
                    Ok(addr) if addr != Address::zero() => Some(format!("{:?}", addr)),
                    _ => None,
                };

                snapshots.push(NavSnapshot {
                    itp_id: format!("0x{}", hex::encode(id_bytes)),
                    nav_per_share: nav_f64,
                    total_supply: total_supply.to_string(),
                    aum_usd: aum,
                    arb_address,
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
    let arb_usdc_addr = crate::api::deployment_addr(&state.deployment, "ARB_USDC")?;
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
        // ARB USDC balance
        let usdc = BalanceReader::new(arb_usdc_addr, Arc::clone(&state.arb_provider));
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
            usdc_arb: usdc_bal.to_string(),
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
    let arb_custody_addr = crate::api::deployment_addr(&state.deployment, "ArbBridgeCustody")?;
    let morpho_addr = crate::api::deployment_addr(&state.morpho_deployment, "MORPHO")?;

    // Vault ERC20 on L3 (Morpho collateral)
    let vault_addr = crate::api::deployment_addr(&state.deployment, "ITP_Vault").unwrap_or_default();
    let has_vault = vault_addr != Address::zero();

    for (user, user_cache) in &user_list {
        // L3_WUSDC allowance to Morpho (on L3)
        let l3_usdc = BalanceReader::new(l3_usdc_addr, Arc::clone(&state.l3_provider));
        let usdc_to_morpho = l3_usdc.allowance(*user, morpho_addr).call().await.unwrap_or_default();

        // ARB USDC allowance to ArbCustody (still on Arb)
        let arb_usdc_addr = crate::api::deployment_addr(&state.deployment, "ARB_USDC").unwrap_or_default();
        let arb_usdc = BalanceReader::new(arb_usdc_addr, Arc::clone(&state.arb_provider));
        let usdc_to_custody = arb_usdc.allowance(*user, arb_custody_addr).call().await.unwrap_or_default();

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
            usdc_arb_to_custody: usdc_to_custody.to_string(),
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
