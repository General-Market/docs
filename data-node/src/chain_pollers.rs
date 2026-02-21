use std::sync::Arc;
use std::time::Duration;
use ethers::prelude::*;
use tracing::warn;
use crate::api::AppState;
use crate::chain_cache::{NavSnapshot, UserBalances, UserAllowances, UserOrder};

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

/// Polls ITP NAV every 1s, updates chain_cache.nav
pub async fn poll_nav(state: Arc<AppState>) {
    let interval = Duration::from_secs(1);
    loop {
        if let Err(e) = poll_nav_once(&state).await {
            warn!(%e, "NAV poller error");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn poll_nav_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let reader = NavReader::new(index_addr, Arc::clone(&state.l3_provider));

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

                snapshots.push(NavSnapshot {
                    itp_id: format!("0x{}", hex::encode(id_bytes)),
                    nav_per_share: nav_f64,
                    total_supply: total_supply.to_string(),
                    aum_usd: aum,
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

/// Polls Morpho oracle every 2s
pub async fn poll_oracle(state: Arc<AppState>) {
    let interval = Duration::from_secs(2);
    loop {
        if let Err(e) = poll_oracle_once(&state).await {
            warn!(%e, "Oracle poller error");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn poll_oracle_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let oracle_addr = crate::api::deployment_addr(&state.morpho_deployment, "MOCK_ORACLE")?;
    let reader = OracleReader::new(oracle_addr, Arc::clone(&state.arb_provider));

    let price = reader.current_price().call().await?;
    let updated = reader.last_updated().call().await?;
    let cycle = reader.last_cycle_number().call().await?;

    let mut oracle = state.chain_cache.oracle.write().await;
    *oracle = crate::chain_cache::OracleSnapshot {
        price: price.to_string(),
        last_updated: updated.as_u64(),
        last_cycle: cycle.as_u64(),
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

/// Polls user balances every 1s: ARB USDC, L3 ITP shares, ARB BridgedITP
pub async fn poll_user_balances(state: Arc<AppState>) {
    let interval = Duration::from_secs(1);
    loop {
        if let Err(e) = poll_user_balances_once(&state).await {
            warn!(%e, "User balances poller error");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn poll_user_balances_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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
    let bridge_proxy_addr = crate::api::deployment_addr(&state.deployment, "BridgeProxy")?;

    let itp_id = itp_id_bytes(1);

    // Resolve bridged ITP address once (same for all users)
    let bridge_proxy = BridgeProxyPoller::new(bridge_proxy_addr, Arc::clone(&state.arb_provider));
    let bridged_itp_addr = bridge_proxy.get_bridged_itp(itp_id).call().await.unwrap_or_default();
    let has_bridged_itp = bridged_itp_addr != Address::zero();

    for (user, user_cache) in &user_list {
        // ARB USDC balance
        let usdc = BalanceReader::new(arb_usdc_addr, Arc::clone(&state.arb_provider));
        let usdc_bal = usdc.balance_of(*user).call().await.unwrap_or_default();

        // L3 ITP shares
        let shares_reader = UserSharesReader::new(index_addr, Arc::clone(&state.l3_provider));
        let itp_shares = shares_reader.get_user_shares(itp_id, *user).call().await.unwrap_or_default();

        // ARB BridgedITP balance
        let bridged_bal = if has_bridged_itp {
            let bitp = BalanceReader::new(bridged_itp_addr, Arc::clone(&state.arb_provider));
            bitp.balance_of(*user).call().await.unwrap_or_default()
        } else {
            U256::zero()
        };

        let mut uc = user_cache.write().await;
        uc.balances = UserBalances {
            usdc_l3: String::new(), // L3 USDC not polled here (no L3 USDC token deployed)
            usdc_arb: usdc_bal.to_string(),
            itp_shares: itp_shares.to_string(),
            bridged_itp: bridged_bal.to_string(),
            itp_nonce: 0, // TODO: add nonce reading if needed
        };
        uc.balances_gen.bump();
    }

    Ok(())
}

/// Polls user allowances every 3s: USDC→ArbCustody, USDC→Morpho, ITP→Morpho
pub async fn poll_user_allowances(state: Arc<AppState>) {
    let interval = Duration::from_secs(3);
    loop {
        if let Err(e) = poll_user_allowances_once(&state).await {
            warn!(%e, "User allowances poller error");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn poll_user_allowances_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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

    let arb_usdc_addr = crate::api::deployment_addr(&state.deployment, "ARB_USDC")?;
    let arb_custody_addr = crate::api::deployment_addr(&state.deployment, "ArbBridgeCustody")?;
    let bridge_proxy_addr = crate::api::deployment_addr(&state.deployment, "BridgeProxy")?;
    let morpho_addr = crate::api::deployment_addr(&state.morpho_deployment, "MORPHO")?;

    let itp_id = itp_id_bytes(1);

    // Resolve bridged ITP address once
    let bridge_proxy = BridgeProxyPoller::new(bridge_proxy_addr, Arc::clone(&state.arb_provider));
    let bridged_itp_addr = bridge_proxy.get_bridged_itp(itp_id).call().await.unwrap_or_default();
    let has_bridged_itp = bridged_itp_addr != Address::zero();

    for (user, user_cache) in &user_list {
        let usdc = BalanceReader::new(arb_usdc_addr, Arc::clone(&state.arb_provider));

        // USDC allowance to ArbCustody
        let usdc_to_custody = usdc.allowance(*user, arb_custody_addr).call().await.unwrap_or_default();

        // USDC allowance to Morpho
        let usdc_to_morpho = usdc.allowance(*user, morpho_addr).call().await.unwrap_or_default();

        // ITP allowance to Morpho (bridged ITP on ARB)
        let itp_to_morpho = if has_bridged_itp {
            let bitp = BalanceReader::new(bridged_itp_addr, Arc::clone(&state.arb_provider));
            bitp.allowance(*user, morpho_addr).call().await.unwrap_or_default()
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

/// Polls user orders every 1s: reads active orders from DB, fetches on-chain status + fills
pub async fn poll_user_orders(state: Arc<AppState>) {
    let interval = Duration::from_secs(1);
    loop {
        if let Err(e) = poll_user_orders_once(&state).await {
            warn!(%e, "User orders poller error");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn poll_user_orders_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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
        // Query DB for active orders for this user
        let rows = sqlx::query_as::<_, (i64,)>(
            "SELECT order_id FROM trades WHERE LOWER(user_address) = $1 AND status IN (0, 1)"
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
