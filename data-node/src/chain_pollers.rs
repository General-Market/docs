use std::sync::Arc;
use std::sync::atomic::Ordering;
use ethers::prelude::*;
use tracing::warn;
use common::types::{CrossChainOrder, CrossChainSellOrderEvent, ItpCreationRequest};
use crate::api::AppState;
use crate::chain_cache::{
    NavSnapshot, UserBalances, UserAllowances, UserOrder, MorphoPositionSnapshot,
    UserCostBasis, FillRecord, CachedLimitOrder, CachedOracle, CachedMorphoMarket,
    MorphoVaultState,
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
        function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)
        function idToMarketParams(bytes32 id) external view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)
    ]"#
);

abigen!(
    IrmReader,
    r#"[
        function rates(bytes32 marketId) external view returns (uint256)
        function lastRateUpdate(bytes32 marketId) external view returns (uint256)
    ]"#
);

/// CuratorRateIRM punitive rate: 100% APR ~ 31_709_791_983 WAD per-second.
/// Applied when rate is 0 (never set) or stale (>48h since last update).
const PUNITIVE_RATE: u128 = 31_709_791_983;
const MAX_RATE_STALENESS: u64 = 48 * 3600; // 48 hours

abigen!(
    BridgedItpReader,
    r#"[
        function itpId() external view returns (bytes32)
    ]"#
);

abigen!(
    OracleRegistryPoller,
    r#"[
        function getActiveOracleEndpoints() external view returns (uint256[] ids, bytes32[] ips, bytes[] pubkeys)
        function activeOracleCount() external view returns (uint256)
        function registryNonce() external view returns (uint256)
        function aggregatedPubkey() external view returns (bytes)
        function consensusPaused() external view returns (bool)
    ]"#
);

// Separate abigen with JSON ABI for struct-returning function (Solidity-style
// flat returns break ABI decoding when the contract returns a struct).
abigen!(
    OracleRegistryBulk,
    r#"[{"type":"function","name":"getOracles","inputs":[],"outputs":[{"name":"","type":"tuple[]","components":[{"name":"addr","type":"address"},{"name":"ip","type":"bytes32"},{"name":"blsPubkey","type":"bytes"},{"name":"status","type":"uint8"},{"name":"registeredAt","type":"uint256"}]}],"stateMutability":"view"}]"#
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

abigen!(
    RebalanceScanner,
    r#"[
        event RebalanceRequested(address indexed requester, bytes32 indexed itpId, uint256[] removeIndices, address[] addAssets, uint256[] newWeights, string note)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
    ]"#
);

abigen!(
    MetaMorphoVaultReader,
    r#"[
        function totalAssets() external view returns (uint256)
        function totalSupply() external view returns (uint256)
        function name() external view returns (string)
        function symbol() external view returns (string)
        function decimals() external view returns (uint8)
    ]"#
);

pub async fn poll_morpho_vault_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let vault_addr = match crate::api::deployment_addr(&state.morpho_deployment, "METAMORPHO_VAULT") {
        Ok(a) => a,
        Err(_) => return Ok(()), // vault not deployed, skip silently
    };
    if vault_addr == Address::zero() { return Ok(()); }

    let vault = MetaMorphoVaultReader::new(vault_addr, Arc::clone(&state.l3_provider));

    let total_assets = vault.total_assets().call().await.unwrap_or_default();
    let total_supply = vault.total_supply().call().await.unwrap_or_default();
    let name = vault.name().call().await.unwrap_or_default();
    let symbol = vault.symbol().call().await.unwrap_or_default();
    let decimals = vault.decimals().call().await.unwrap_or_default();

    let mut cache = state.chain_cache.morpho_vault.write().await;
    *cache = MorphoVaultState {
        total_assets: total_assets.to_string(),
        total_supply: total_supply.to_string(),
        name,
        symbol,
        decimals,
    };
    state.chain_cache.morpho_vault_gen.bump();
    Ok(())
}

pub async fn poll_morpho_markets_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let batch_markets = state.batch_markets.read().await;
    if batch_markets.is_empty() { return Ok(()); }

    let morpho_addr = crate::api::deployment_addr(&state.morpho_deployment, "MORPHO")?;
    let morpho = MorphoPoller::new(morpho_addr, Arc::clone(&state.l3_provider));

    let provider = Arc::clone(&state.l3_provider);

    // Parallel: fetch all markets concurrently, per-market IRM
    let futs: Vec<_> = batch_markets.iter().map(|bm| {
        let morpho = morpho.clone();
        let provider = Arc::clone(&provider);
        let bm = bm.clone();
        async move {
            let mut market_id_bytes = [0u8; 32];
            if let Ok(bytes) = hex::decode(bm.market_id.strip_prefix("0x").unwrap_or(&bm.market_id)) {
                let len = bytes.len().min(32);
                market_id_bytes[..len].copy_from_slice(&bytes[..len]);
            }
            let (tsa, tss, tba, tbs, lu, _fee) = morpho.market(market_id_bytes).call().await.unwrap_or_default();
            // Per-market IRM: read stored rate + staleness, apply punitive fallback
            let irm_addr: Address = bm.irm.parse().unwrap_or_default();
            let irm = IrmReader::new(irm_addr, provider);
            let raw_rate = irm.rates(market_id_bytes).call().await.unwrap_or_default();
            let last_update_ts = irm.last_rate_update(market_id_bytes).call().await.unwrap_or_default();
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let effective_rate = if raw_rate.is_zero()
                || now.saturating_sub(last_update_ts.as_u64()) > MAX_RATE_STALENESS
            {
                ethers::types::U256::from(PUNITIVE_RATE)
            } else {
                raw_rate
            };
            CachedMorphoMarket {
                market_id: bm.market_id,
                collateral_token: bm.collateral_token,
                loan_token: bm.loan_token,
                irm: bm.irm,
                total_supply_assets: tsa.to_string(),
                total_supply_shares: tss.to_string(),
                total_borrow_assets: tba.to_string(),
                total_borrow_shares: tbs.to_string(),
                borrow_rate_per_second: effective_rate.to_string(),
                lltv: bm.lltv,
                oracle: bm.oracle,
                last_update: lu as u64,
            }
        }
    }).collect();

    let results = futures::future::join_all(futs).await;

    let mut cache = state.chain_cache.morpho_markets.write().await;
    *cache = results;
    state.chain_cache.morpho_markets_gen.bump();

    // Resolve settlement_address for ITPs via BridgedITP.itpId() on L3.
    // Each collateral token is a BridgedITP on L3 with an itpId() getter.
    // We call itpId() to get the ITP ID, then set settlement_address = collateral_token
    // on the matching ITP state so the frontend can cross-reference Morpho markets with NAV.
    let provider = Arc::clone(&state.l3_provider);
    let itp_cache = state.chain_cache.itp_states.read().await;
    let needs_resolution: bool = itp_cache.states.values().any(|s| s.settlement_address.is_none());
    drop(itp_cache);

    if needs_resolution {
        let futs: Vec<_> = batch_markets.iter().map(|bm| {
            let provider = Arc::clone(&provider);
            let ct = bm.collateral_token.clone();
            async move {
                let addr: Address = ct.parse().ok()?;
                let reader = BridgedItpReader::new(addr, provider);
                match reader.itp_id().call().await {
                    Ok(id_bytes) => {
                        let hex_id = format!("0x{}", hex::encode(id_bytes));
                        Some((hex_id, ct))
                    }
                    Err(_) => None
                }
            }
        }).collect();
        let resolved: Vec<Option<(String, String)>> = futures::future::join_all(futs).await;
        let mut itp_cache = state.chain_cache.itp_states.write().await;
        for item in resolved.into_iter().flatten() {
            let (itp_id_hex, collateral_token) = item;
            if let Some(entry) = itp_cache.states.get_mut(&itp_id_hex) {
                if entry.settlement_address.is_none() {
                    entry.settlement_address = Some(collateral_token);
                }
            }
        }
    }

    Ok(())
}

/// Hot-reload batch-markets.json if it has changed (new markets deployed).
/// Discover Morpho markets from the MetaMorpho vault's on-chain supply queue.
/// Falls back to batch-markets.json if vault address is unavailable.
/// This means new markets deployed by the curator service appear automatically
/// within 60 seconds — no manual file update needed.
pub async fn poll_batch_markets_reload(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Try on-chain discovery first
    let vault_addr = crate::api::deployment_addr(&state.morpho_deployment, "METAMORPHO_VAULT");
    let morpho_addr = crate::api::deployment_addr(&state.morpho_deployment, "MORPHO");

    if let (Ok(vault), Ok(morpho)) = (vault_addr, morpho_addr) {
        match discover_markets_from_vault(state, vault, morpho).await {
            Ok(markets) if !markets.is_empty() => {
                let current = state.batch_markets.read().await;
                if markets.len() != current.len() {
                    drop(current);
                    let count = markets.len();
                    let mut w = state.batch_markets.write().await;
                    *w = markets;
                    tracing::info!(count, "Discovered batch markets from vault supply queue");
                }
                return Ok(());
            }
            Err(e) => {
                tracing::warn!(%e, "On-chain market discovery failed, falling back to file");
            }
            _ => {}
        }
    }

    // Fallback: reload from batch-markets.json
    let fresh = crate::api::load_batch_markets(&state.batch_markets_path);
    let current = state.batch_markets.read().await;
    if fresh.len() != current.len() {
        drop(current);
        let count = fresh.len();
        let mut w = state.batch_markets.write().await;
        *w = fresh;
        tracing::info!(count, "Hot-reloaded batch markets from file");
    }
    Ok(())
}

/// Read all markets from the MetaMorpho vault's supply queue via on-chain calls.
async fn discover_markets_from_vault(
    state: &crate::api::AppState,
    vault: Address,
    morpho: Address,
) -> Result<Vec<crate::api::BatchMarketEntry>, Box<dyn std::error::Error + Send + Sync>> {
    let provider = Arc::clone(&state.l3_provider);

    // Read supplyQueueLength
    abigen!(VaultQueueReader, r#"[
        function supplyQueueLength() external view returns (uint256)
        function supplyQueue(uint256) external view returns (bytes32)
    ]"#);
    abigen!(MorphoParamsReader, r#"[
        function idToMarketParams(bytes32 id) external view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)
    ]"#);

    let vault_reader = VaultQueueReader::new(vault, Arc::clone(&provider));
    let morpho_reader = MorphoParamsReader::new(morpho, Arc::clone(&provider));

    let queue_len: u64 = vault_reader.supply_queue_length().call().await?.as_u64();
    if queue_len == 0 {
        return Ok(Vec::new());
    }

    let mut markets = Vec::with_capacity(queue_len as usize);
    for i in 0..queue_len {
        let market_id_bytes = vault_reader.supply_queue(U256::from(i)).call().await?;
        let (loan_token, collateral_token, oracle, irm, lltv) =
            morpho_reader.id_to_market_params(market_id_bytes).call().await?;

        if collateral_token.is_zero() {
            continue;
        }

        markets.push(crate::api::BatchMarketEntry {
            market_id: format!("0x{}", hex::encode(market_id_bytes)),
            collateral_token: format!("{:?}", collateral_token),
            loan_token: format!("{:?}", loan_token),
            oracle: format!("{:?}", oracle),
            irm: format!("{:?}", irm),
            lltv: lltv.to_string(),
        });
    }

    Ok(markets)
}

pub async fn poll_nav_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if !state.chain_cache.hydration_complete.load(std::sync::atomic::Ordering::Acquire) {
        return Ok(());
    }
    let itp_cache = state.chain_cache.itp_states.read().await;
    if itp_cache.states.is_empty() { return Ok(()); }

    let live_prices: std::collections::HashMap<String, f64> = {
        let ticker_map = state.live_cache.tickers.read().await;
        ticker_map.iter().filter_map(|(pair, t)| {
            t.last_price.parse::<f64>().ok().map(|p| (pair.clone(), p))
        }).collect()
    };

    let mut snapshots = Vec::new();
    for (itp_id, itp) in &itp_cache.states {
        let nav_f64 = if !itp.assets.is_empty() && itp.assets.len() == itp.inventory.len() {
            let mut sum = 0.0_f64;
            let mut resolved = 0;
            for (addr, qty) in itp.assets.iter().zip(itp.inventory.iter()) {
                let addr_hex = format!("{:?}", addr).to_lowercase();
                if let Some(pair) = state.symbol_map.get(&addr_hex) {
                    if let Some(&price_usd) = live_prices.get(pair) {
                        sum += qty.as_u128() as f64 * price_usd / 1e18;
                        resolved += 1;
                    }
                }
            }
            if resolved == itp.assets.len() { sum }
            else if resolved > 0 { sum } // partial NAV — better than zero
            else { 0.0 }
        } else { 0.0 };

        let supply_f64 = itp.total_supply.as_u128() as f64 / 1e18;
        snapshots.push(NavSnapshot {
            itp_id: itp_id.clone(),
            name: itp.name.clone(),
            symbol: itp.symbol.clone(),
            nav_per_share: nav_f64,
            total_supply: itp.total_supply.to_string(),
            aum_usd: nav_f64 * supply_f64,
            settlement_address: itp.settlement_address.clone(),
        });
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
        let raw_rate = irm.rates(market_id_arr).call().await.unwrap_or_default();
        let last_upd = irm.last_rate_update(market_id_arr).call().await.unwrap_or_default();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        if raw_rate.is_zero() || now.saturating_sub(last_upd.as_u64()) > MAX_RATE_STALENESS {
            PUNITIVE_RATE.to_string()
        } else {
            raw_rate.to_string()
        }
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

    // Resolve contract addresses — only USDC balances (ITP shares maintained by events)
    let settlement_usdc_addr = crate::api::deployment_addr(&state.deployment, "SETTLEMENT_USDC")?;
    let l3_usdc_addr = crate::api::deployment_addr(&state.deployment, "L3_WUSDC")?;

    // Resolve vault ERC20 address from deployment (L3 vault token)
    let vault_addr = crate::api::deployment_addr(&state.deployment, "ITP_Vault").unwrap_or_default();
    let has_vault = vault_addr != Address::zero();

    // Vision contract on L3
    let vision_addr = crate::api::deployment_addr(&state.deployment, "Vision").unwrap_or_default();
    let has_vision = vision_addr != Address::zero();

    // MetaMorpho vault on L3 (from morpho-deployment.json)
    let metamorpho_vault_addr = crate::api::deployment_addr(&state.morpho_deployment, "METAMORPHO_VAULT").unwrap_or_default();
    let has_metamorpho = metamorpho_vault_addr != Address::zero();

    for (user, user_cache) in &user_list {
        // Settlement USDC balance
        let usdc = BalanceReader::new(settlement_usdc_addr, Arc::clone(&state.settlement_provider));
        let usdc_bal = usdc.balance_of(*user).call().await.unwrap_or_default();

        // L3 USDC (WUSDC) balance
        let l3_usdc = BalanceReader::new(l3_usdc_addr, Arc::clone(&state.l3_provider));
        let l3_usdc_bal = l3_usdc.balance_of(*user).call().await.unwrap_or_default();

        // L3 vault ERC20 balance (used as Morpho collateral)
        let bridged_bal = if has_vault {
            let vault = BalanceReader::new(vault_addr, Arc::clone(&state.l3_provider));
            vault.balance_of(*user).call().await.unwrap_or_default()
        } else {
            U256::zero()
        };

        // Vision token balance on L3
        let vision_bal = if has_vision {
            let vision = BalanceReader::new(vision_addr, Arc::clone(&state.l3_provider));
            vision.balance_of(*user).call().await.unwrap_or_default()
        } else {
            U256::zero()
        };

        // Native gas balance on L3
        let native_bal = state.l3_provider.get_balance(*user, None).await.unwrap_or_default();

        // MetaMorpho vault shares on L3
        let vault_shares = if has_metamorpho {
            let mm = BalanceReader::new(metamorpho_vault_addr, Arc::clone(&state.l3_provider));
            mm.balance_of(*user).call().await.unwrap_or_default()
        } else {
            U256::zero()
        };

        // Poll ITP shares directly from Index contract (getUserShares).
        // This bypasses the fragile collateral_token → settlement_address lookup
        // which fails when settlement_address hasn't been resolved yet.
        let mut itp_shares = std::collections::HashMap::new();
        let index_addr = crate::api::deployment_addr(&state.deployment, "Index").unwrap_or_default();
        if !index_addr.is_zero() {
            let index = UserSharesReader::new(index_addr, Arc::clone(&state.l3_provider));
            let itp_cache = state.chain_cache.itp_states.read().await;
            let itp_ids: Vec<String> = itp_cache.states.keys().cloned().collect();
            drop(itp_cache);

            let share_futs: Vec<_> = itp_ids.iter().map(|itp_id_hex| {
                let index = index.clone();
                let itp_id_hex = itp_id_hex.clone();
                let user_addr = *user;
                async move {
                    let hex_str = itp_id_hex.strip_prefix("0x").unwrap_or(&itp_id_hex);
                    let bytes = match hex::decode(hex_str) {
                        Ok(b) => b,
                        Err(_) => return None,
                    };
                    let mut arr = [0u8; 32];
                    let len = bytes.len().min(32);
                    arr[..len].copy_from_slice(&bytes[..len]);
                    let shares = index.get_user_shares(arr, user_addr).call().await.unwrap_or_default();
                    if shares.is_zero() { return None; }
                    Some((itp_id_hex, shares.to_string()))
                }
            }).collect();
            let share_results = futures::future::join_all(share_futs).await;
            for item in share_results.into_iter().flatten() {
                let (itp_id, bal) = item;
                itp_shares.insert(itp_id, bal);
            }
        }

        let mut uc = user_cache.write().await;
        uc.balances = UserBalances {
            usdc_l3: l3_usdc_bal.to_string(),
            usdc_settlement: usdc_bal.to_string(),
            itp_shares,
            bridged_itp: bridged_bal.to_string(),
            itp_nonce: 0,
            vision_balance: vision_bal.to_string(),
            native_gas_balance: native_bal.to_string(),
            vault_shares: vault_shares.to_string(),
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

    // MetaMorpho vault address (for USDC → vault deposit approval)
    let metamorpho_vault_addr = crate::api::deployment_addr(&state.morpho_deployment, "METAMORPHO_VAULT").unwrap_or_default();
    let has_metamorpho = metamorpho_vault_addr != Address::zero();

    // Vision contract address (for USDC → Vision deposit approval)
    let vision_addr = crate::api::deployment_addr(&state.deployment, "Vision").unwrap_or_default();
    let has_vision = vision_addr != Address::zero();

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

        // L3 USDC allowance to MetaMorpho vault (for vault deposits)
        let usdc_to_vault = if has_metamorpho {
            let l3_usdc_v = BalanceReader::new(l3_usdc_addr, Arc::clone(&state.l3_provider));
            l3_usdc_v.allowance(*user, metamorpho_vault_addr).call().await.unwrap_or_default()
        } else {
            U256::zero()
        };

        // L3 USDC allowance to Vision (for Vision deposits)
        let usdc_to_vision = if has_vision {
            let l3_usdc_vis = BalanceReader::new(l3_usdc_addr, Arc::clone(&state.l3_provider));
            l3_usdc_vis.allowance(*user, vision_addr).call().await.unwrap_or_default()
        } else {
            U256::zero()
        };

        let mut uc = user_cache.write().await;
        uc.allowances = UserAllowances {
            usdc_l3_to_index: usdc_to_morpho.to_string(),
            usdc_settlement_to_custody: usdc_to_custody.to_string(),
            itp_to_morpho: itp_to_morpho.to_string(),
            usdc_l3_to_vault: usdc_to_vault.to_string(),
            usdc_l3_to_vision: usdc_to_vision.to_string(),
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

    for (user_addr, user_cache) in &user_list {
        // DB-only: read active + recently filled orders for this user.
        let rows = sqlx::query_as::<_, (i64, String, String, i16, String, String, i16, Option<String>, Option<String>, i64)>(
            "SELECT order_id, user_address, itp_id, side, amount, limit_price, \
                    status, fill_price, fill_amount, \
                    EXTRACT(EPOCH FROM order_timestamp)::bigint \
             FROM trades WHERE LOWER(user_address) = $1 \
             AND (status IN (0, 1) OR order_timestamp > NOW() - INTERVAL '5 minutes') \
             ORDER BY order_id DESC LIMIT 50"
        )
        .bind(user_addr)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        let orders: Vec<UserOrder> = rows.into_iter().map(|r| {
            UserOrder {
                order_id: r.0 as u64,
                user: r.1,
                itp_id: r.2,
                side: r.3 as u8,
                amount: r.4,
                limit_price: r.5,
                status: r.6 as u8,
                fill_price: r.7,
                fill_amount: r.8,
                fill_cycle: None,
                timestamp: r.9 as u64,
            }
        }).collect();

        let mut uc = user_cache.write().await;
        uc.orders = orders;
        uc.orders_gen.bump();
    }

    Ok(())
}

// ── Morpho position poller ──

pub async fn poll_user_positions_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let batch_markets = state.batch_markets.read().await;
    if batch_markets.is_empty() {
        tracing::debug!("positions poller: no batch_markets loaded, skipping");
        return Ok(());
    }

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
    let morpho = MorphoPoller::new(morpho_addr, Arc::clone(&state.l3_provider));

    // Pre-parse all market IDs once
    let market_ids: Vec<(String, [u8; 32])> = batch_markets.iter().filter_map(|bm| {
        let hex_str = bm.market_id.strip_prefix("0x").unwrap_or(&bm.market_id);
        let bytes = hex::decode(hex_str).ok()?;
        let mut arr = [0u8; 32];
        let len = bytes.len().min(32);
        arr[..len].copy_from_slice(&bytes[..len]);
        Some((bm.market_id.clone(), arr))
    }).collect();

    // Build all (user × market) futures and run them in parallel
    let futs: Vec<_> = user_list.iter().flat_map(|(user_addr, _cache)| {
        let morpho = morpho.clone();
        let user = *user_addr;
        market_ids.iter().map(move |(market_id_str, market_id_bytes)| {
            let morpho = morpho.clone();
            let market_id_str = market_id_str.clone();
            let market_id_bytes = *market_id_bytes;
            async move {
                let (supply_shares, borrow_shares, collateral) = morpho
                    .position(market_id_bytes, user)
                    .call()
                    .await
                    .unwrap_or_default();
                (user, market_id_str, supply_shares, borrow_shares, collateral)
            }
        }).collect::<Vec<_>>()
    }).collect();

    let results = futures::future::join_all(futs).await;

    // Group results by user address — only keep non-zero positions
    let mut by_user: std::collections::HashMap<Address, std::collections::HashMap<String, MorphoPositionSnapshot>> =
        std::collections::HashMap::new();
    for (user, market_id_str, supply_shares, borrow_shares, collateral) in results {
        let collateral_u256 = U256::from(collateral);
        let borrow_u256 = U256::from(borrow_shares);
        if collateral_u256 > U256::zero() || borrow_u256 > U256::zero() {
            by_user.entry(user).or_default().insert(market_id_str, MorphoPositionSnapshot {
                supply_shares: supply_shares.to_string(),
                borrow_shares: borrow_u256.to_string(),
                collateral: collateral_u256.to_string(),
            });
        }
    }

    // Write back to each user's cache
    for (user_addr, user_cache) in &user_list {
        let positions = by_user.remove(user_addr).unwrap_or_default();
        let mut uc = user_cache.write().await;
        uc.positions = positions;
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

/// Poll pending orders (status == 0) from the trades table.
/// Also reconciles stale pending orders: if an order has been pending > 60s,
/// check on-chain status via L3 RPC and update the DB if it's no longer pending.
pub async fn poll_pending_orders_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Reconcile stale pending orders every ~30 polls (30s at 1s interval).
    // Uses a static counter to avoid running on every poll cycle.
    {
        static RECONCILE_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let tick = RECONCILE_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        if tick % 30 == 0 {
            let stale_rows = sqlx::query_as::<_, (i64,)>(
                "SELECT order_id FROM trades WHERE status = 0 \
                 AND order_timestamp < NOW() - INTERVAL '60 seconds' \
                 ORDER BY order_id DESC LIMIT 5"
            )
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default();

            if !stale_rows.is_empty() {
                let index_addr: ethers::types::Address = state.deployment["contracts"]["Index"]
                    .as_str()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or_default();
                for (order_id,) in &stale_rows {
                    let calldata = format!("0x8f216830{:064x}", order_id);
                    let tx = ethers::types::transaction::eip2718::TypedTransaction::Legacy(
                        ethers::types::TransactionRequest::new()
                            .to(index_addr)
                            .data(ethers::types::Bytes::from(hex::decode(&calldata[2..]).unwrap_or_default()))
                    );
                    if let Ok(result) = state.l3_provider.call(&tx, None).await {
                        let hex_str = hex::encode(&result);
                        if hex_str.len() >= 64 {
                            let status_hex = &hex_str[hex_str.len() - 2..];
                            let on_chain_status = u8::from_str_radix(status_hex, 16).unwrap_or(0);
                            if on_chain_status > 0 {
                                sqlx::query("UPDATE trades SET status = $1 WHERE order_id = $2")
                                    .bind(on_chain_status as i16)
                                    .bind(*order_id)
                                    .execute(&state.pool)
                                    .await
                                    .ok();
                                tracing::info!(order_id, on_chain_status, "Reconciled stale pending order");
                            }
                        }
                    }
                }
            }
        }
    }

    let rows = sqlx::query_as::<_, (i64, String, String, i16, String, String, i16, i64)>(
        "SELECT order_id, user_address, itp_id, side, amount, limit_price, \
                status, EXTRACT(EPOCH FROM order_timestamp)::bigint \
         FROM trades WHERE status = 0 \
         ORDER BY order_id DESC LIMIT 100"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let pending: Vec<CachedLimitOrder> = rows.into_iter().map(|r| {
        CachedLimitOrder {
            order_id: r.0 as u64,
            user: r.1,
            itp_id: r.2,
            side: r.3 as u8,
            amount: r.4,
            limit_price: r.5,
            slippage_tier: 0,
            deadline: "0".to_string(),
            timestamp: r.7 as u64,
            status: r.6 as u8,
        }
    }).collect();

    let mut cache = state.chain_cache.pending_orders.write().await;
    *cache = pending;
    state.chain_cache.pending_orders_gen.bump();
    Ok(())
}

/// Poll batched orders (status == 1) from the trades table.
pub async fn poll_batched_orders_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let rows = sqlx::query_as::<_, (i64, String, String, i16, String, String, i16, i64)>(
        "SELECT order_id, user_address, itp_id, side, amount, limit_price, \
                status, EXTRACT(EPOCH FROM order_timestamp)::bigint \
         FROM trades WHERE status = 1 \
         ORDER BY order_id DESC LIMIT 100"
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let batched: Vec<CachedLimitOrder> = rows.into_iter().map(|r| {
        CachedLimitOrder {
            order_id: r.0 as u64,
            user: r.1,
            itp_id: r.2,
            side: r.3 as u8,
            amount: r.4,
            limit_price: r.5,
            slippage_tier: 0,
            deadline: "0".to_string(),
            timestamp: r.7 as u64,
            status: r.6 as u8,
        }
    }).collect();

    let mut cache = state.chain_cache.batched_orders.write().await;
    *cache = batched;
    state.chain_cache.batched_orders_gen.bump();
    Ok(())
}

/// Poll the OracleRegistry for active oracle endpoints + BLS pubkeys.
/// Uses getOracles() (JSON ABI with proper tuple return) to fetch all oracle
/// data in a single RPC call, avoiding the ABI decode bug that caused
/// getOracle() to return zero addresses.
pub async fn poll_oracle_registry_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let registry_addr = crate::api::deployment_addr(&state.deployment, "OracleRegistry")?;
    let bulk = OracleRegistryBulk::new(registry_addr, Arc::clone(&state.l3_provider));

    let all_oracles = bulk.get_oracles().call().await?;

    // Tuple fields: (addr: H160, ip: [u8;32], blsPubkey: Bytes, status: u8, registeredAt: U256)
    let cached: Vec<CachedOracle> = all_oracles
        .into_iter()
        .filter(|o| o.0 != Address::zero() && o.3 == 1)
        .map(|o| {
            let ip_bytes: &[u8] = o.1.as_ref();
            let ip_str = String::from_utf8_lossy(
                &ip_bytes[..ip_bytes.iter().position(|&b| b == 0).unwrap_or(ip_bytes.len())]
            ).to_string();
            CachedOracle {
                address: format!("{:?}", o.0),
                endpoint: ip_str,
                bls_pubkey: format!("0x{}", hex::encode(&o.2)),
            }
        })
        .collect();

    let mut cache = state.chain_cache.oracle_registry.write().await;
    *cache = cached;
    state.chain_cache.oracle_registry_gen.bump();
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

/// Poll OracleRegistry metadata: activeOracleCount, aggregatedPubkey, consensusPaused.
pub async fn poll_registry_metadata_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let registry_addr = crate::api::deployment_addr(&state.deployment, "OracleRegistry")?;
    let registry = OracleRegistryPoller::new(registry_addr, Arc::clone(&state.l3_provider));

    // Bind call builders to let-variables to extend their lifetimes
    let c_active = registry.active_oracle_count();
    let c_pubkey = registry.aggregated_pubkey();
    let c_paused = registry.consensus_paused();
    let (active_count, agg_pubkey, paused) = tokio::join!(
        c_active.call(),
        c_pubkey.call(),
        c_paused.call()
    );

    if let Ok(count) = active_count {
        state.chain_cache.active_oracle_count.store(count.as_u64(), Ordering::Relaxed);
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
    // to prevent race: oracle reads confirmed_block then queries events — if we store
    // confirmed_block first, the oracle may see the new block height but get stale event data.
    let latest_block = state.settlement_provider.get_block_number().await?.as_u64();
    let confirmed = latest_block.saturating_sub(10);

    // Read BridgeProxy on settlement chain (non-fatal: contracts may not be deployed yet)
    match crate::api::deployment_addr(&state.deployment, "SettlementBridgeProxy") {
        Ok(bridge_addr) => {
            let bridge = BridgeProxySettlementReader::new(bridge_addr, Arc::clone(&state.settlement_provider));
            match bridge.next_creation_nonce().call().await {
                Ok(nonce_raw) => {
                    let next_nonce = nonce_raw.as_u64();
                    state.chain_cache.settlement_next_nonce.store(next_nonce, Ordering::Relaxed);

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
                                    block_number: 0,
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

                    // ── Build itp_id → requester map from completed bridge creations ──
                    // For each completed nonce, get admin from Settlement + itp_id from L3.
                    // Uses raw calldata for _bridgeNonceToItpId because leading-underscore
                    // Solidity names are not reliably handled by ethers abigen.
                    if let Ok(index_addr) = crate::api::deployment_addr(&state.deployment, "Index") {
                        // selector = keccak256("_bridgeNonceToItpId(uint256)")[..4]
                        let selector = &ethers::utils::keccak256(b"_bridgeNonceToItpId(uint256)")[..4];
                        let mut requesters: std::collections::HashMap<String, String> = std::collections::HashMap::new();

                        for nonce in 0..next_nonce {
                            match bridge.get_pending_creation(U256::from(nonce)).call().await {
                                Ok((admin, _name, _symbol, _weights, _assets, _prices, _created_at, completed)) => {
                                    if !completed || admin.is_zero() {
                                        continue;
                                    }
                                    // Completed: look up which itp_id was created for this nonce
                                    let mut calldata = selector.to_vec();
                                    let mut nonce_bytes = [0u8; 32];
                                    U256::from(nonce).to_big_endian(&mut nonce_bytes);
                                    calldata.extend_from_slice(&nonce_bytes);
                                    let call_tx = ethers::types::transaction::eip2718::TypedTransaction::Legacy(
                                        ethers::types::TransactionRequest::new()
                                            .to(index_addr)
                                            .data(calldata),
                                    );
                                    match state.l3_provider.call(&call_tx, None).await {
                                        Ok(result) if result.len() >= 32 => {
                                            let itp_id_bytes: [u8; 32] = result[..32].try_into().unwrap_or([0u8; 32]);
                                            if itp_id_bytes != [0u8; 32] {
                                                let itp_id_hex = format!("0x{}", hex::encode(itp_id_bytes));
                                                let admin_hex = format!("{:?}", admin).to_lowercase();
                                                requesters.insert(itp_id_hex, admin_hex);
                                            }
                                        }
                                        Ok(_) => {
                                            // nonce completed but itp_id not yet written (race) — skip
                                        }
                                        Err(e) => {
                                            warn!(nonce, %e, "Failed to read _bridgeNonceToItpId");
                                        }
                                    }
                                }
                                Err(e) => {
                                    warn!(nonce, %e, "Failed to read completed creation for requester map");
                                }
                            }
                        }

                        let mut req_cache = state.chain_cache.itp_requesters.write().await;
                        *req_cache = requesters;
                    }
                }
                Err(e) => {
                    warn!(%e, "BridgeProxy.nextCreationNonce() failed (contract may not be deployed)");
                }
            }
        }
        Err(e) => {
            warn!(%e, "BridgeProxy address not found in deployment");
        }
    }

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
    // This guarantees that when an oracle reads confirmed_block=N, all events
    // up to block N are already in the cache.
    state.chain_cache.settlement_confirmed_block.store(confirmed, Ordering::Relaxed);

    Ok(())
}

/// Poll L3 Index for RebalanceRequested events and populate pending_rebalances cache.
/// Scans the last 10,000 blocks for events, then checks if the rebalance was already
/// executed (weights match target) and filters those out.
pub async fn poll_pending_rebalances_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use crate::chain_cache::CachedPendingRebalance;

    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let scanner = RebalanceScanner::new(index_addr, Arc::clone(&state.l3_provider));

    let latest_block = state.l3_provider.get_block_number().await?.as_u64();
    let from_block = latest_block.saturating_sub(10_000);

    let events = scanner
        .rebalance_requested_filter()
        .from_block(from_block)
        .to_block(latest_block)
        .query_with_meta()
        .await
        .unwrap_or_default();

    // Keep latest event per ITP (dedup by itp_id, keep highest block)
    let mut latest_per_itp: std::collections::HashMap<[u8; 32], (rebalance_scanner::RebalanceRequestedFilter, LogMeta)> =
        std::collections::HashMap::new();
    for (event, meta) in events {
        let itp_id: [u8; 32] = event.itp_id.into();
        let block = meta.block_number.as_u64();
        let replace = match latest_per_itp.get(&itp_id) {
            Some((_, existing_meta)) => block > existing_meta.block_number.as_u64(),
            None => true,
        };
        if replace {
            latest_per_itp.insert(itp_id, (event, meta));
        }
    }

    let mut pending = Vec::new();

    for (itp_id, (event, meta)) in &latest_per_itp {
        // Check if rebalance was already executed (current weights == target weights)
        let current_assets = match scanner.get_itp_state(*itp_id).call().await {
            Ok((_creator, _total_supply, _nav, assets, current_weights, _inventory)) => {
                if current_weights == event.new_weights
                    && event.remove_indices.is_empty()
                    && event.add_assets.is_empty()
                {
                    continue; // Already executed
                }
                assets
            }
            Err(e) => {
                warn!(itp_id = %format!("0x{}", hex::encode(itp_id)), %e, "Failed to get ITP state for rebalance check");
                // Include it anyway — better to have a stale entry than miss a pending one
                vec![]
            }
        };

        pending.push(CachedPendingRebalance {
            itp_id: format!("0x{}", hex::encode(itp_id)),
            requester: format!("{:?}", event.requester),
            remove_indices: event.remove_indices.iter().map(|i| i.to_string()).collect(),
            add_assets: event.add_assets.iter().map(|a| format!("{:?}", a)).collect(),
            new_weights: event.new_weights.iter().map(|w| w.to_string()).collect(),
            note: event.note.clone(),
            block_number: meta.block_number.as_u64(),
            current_assets: current_assets.iter().map(|a| format!("{:?}", a)).collect(),
        });
    }

    let mut cache = state.chain_cache.pending_rebalances.write().await;
    *cache = pending;
    state.chain_cache.pending_rebalances_gen.bump();
    Ok(())
}

/// Build the system snapshot in the background and cache it as pre-serialized JSON.
/// Uses a timeout to prevent hanging the poller loop if RPC calls stall.
pub async fn poll_system_snapshot_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        crate::api::build_system_snapshot_json(state),
    ).await;

    match result {
        Ok(json) => {
            let mut cache = state.chain_cache.system_snapshot_json.write().await;
            *cache = json;
            state.chain_cache.system_snapshot_gen.bump();
        }
        Err(_) => {
            warn!("system_snapshot: timed out after 120s, skipping this tick");
        }
    }
    Ok(())
}

/// Precompute AUM ranking every 10s from cache.
pub async fn poll_aum_ranking_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let json = crate::api::compute_aum_ranking_json(state).await;
    let mut cache = state.chain_cache.aum_ranking_json.write().await;
    *cache = json;
    state.chain_cache.aum_ranking_gen.bump();
    Ok(())
}

/// Evict user caches inactive for more than 30 minutes.
pub async fn poll_user_cache_eviction_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    state.chain_cache.evict_stale_users(std::time::Duration::from_secs(1800)).await;
    Ok(())
}
