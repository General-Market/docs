use std::sync::Arc;
use std::time::Duration;
use ethers::prelude::*;
use tracing::warn;
use crate::api::AppState;
use crate::chain_cache::NavSnapshot;

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
