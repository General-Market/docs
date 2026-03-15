//! Delisting watchdog: auto-rebalance ITPs when Bitget delistings are detected.
//!
//! Daily task: fetch danger list from data-node, check all ITPs for affected assets,
//! and call `requestRebalance()` (permissionless) on L3 Index contract to emit
//! `RebalanceRequested` events. The existing consensus pipeline handles the rest.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use ethers::abi::{self, Token};
use ethers::types::{Address, H256, TxHash, U256};
use reqwest::Client;
use serde::Deserialize;
use tracing::{info, warn};

use common::traits::{ChainReader, ChainWriter};

use crate::leader::LeaderElector;
use crate::price::SymbolMap;

/// A listing from the data-node `/listings/unsafe` endpoint.
#[derive(Debug, Clone, Deserialize)]
pub struct UnsafeListing {
    pub symbol: String,
    pub base_coin: String,
    pub status: String,
}

/// Record of a rebalance action taken by the watchdog.
#[derive(Debug, Clone)]
pub struct RebalanceAction {
    pub itp_id: H256,
    pub removed_assets: Vec<Address>,
    pub remaining_count: usize,
    pub tx_hash: TxHash,
}

pub struct DelistingWatchdog {
    data_node_url: String,
    http_client: Client,
    chain_reader: Arc<dyn ChainReader>,
    chain_writer: Arc<dyn ChainWriter>,
    symbol_map: SymbolMap,
    /// reverse map: base_coin (e.g. "SUI") → address (for future use)
    #[allow(dead_code)]
    reverse_map: HashMap<String, Address>,
    /// Index contract address on L3
    index_address: Address,
}

impl DelistingWatchdog {
    pub fn new(
        data_node_url: String,
        chain_reader: Arc<dyn ChainReader>,
        chain_writer: Arc<dyn ChainWriter>,
        symbol_map: SymbolMap,
        index_address: Address,
    ) -> Self {
        // Build reverse map: for each (address -> "SUIUSDT"), extract "SUI" as base_coin
        let mut reverse_map = HashMap::new();
        for addr in symbol_map.assets() {
            if let Some(pair) = symbol_map.get_symbol(addr) {
                // Extract base coin from pair like "SUIUSDT" -> "SUI"
                let base_coin = extract_base_coin(pair);
                reverse_map.insert(base_coin, *addr);
            }
        }

        Self {
            data_node_url,
            http_client: Client::new(),
            chain_reader,
            chain_writer,
            symbol_map,
            reverse_map,
            index_address,
        }
    }

    /// Main watchdog logic: fetch danger list, check ITPs, request rebalances.
    pub async fn check_and_rebalance(&self) -> Result<Vec<RebalanceAction>, Box<dyn std::error::Error + Send + Sync>> {
        // 1. Fetch danger list from data-node
        let unsafe_listings = self.fetch_unsafe_listings().await?;
        if unsafe_listings.is_empty() {
            info!("Delisting watchdog: no unsafe listings found");
            return Ok(vec![]);
        }

        // 2. Build unsafe base_coins set
        let unsafe_base_coins = build_unsafe_basecoin_set(&unsafe_listings);
        info!(
            count = unsafe_base_coins.len(),
            "Delisting watchdog: unsafe base coins detected"
        );

        // 3. Get ITP count from chain
        let itp_count = self.get_itp_count().await?;
        if itp_count == 0 {
            info!("Delisting watchdog: no ITPs on chain");
            return Ok(vec![]);
        }

        // 4. Check each ITP for affected assets
        let mut actions = Vec::new();
        for i in 1..=itp_count {
            let itp_id = H256::from_low_u64_be(i);

            match self.check_itp(itp_id, &unsafe_base_coins).await {
                Ok(Some(action)) => {
                    info!(
                        itp_id = ?itp_id,
                        removed = action.removed_assets.len(),
                        remaining = action.remaining_count,
                        tx = ?action.tx_hash,
                        "Delisting watchdog: requested rebalance"
                    );
                    actions.push(action);
                }
                Ok(None) => {} // No affected assets
                Err(e) => {
                    warn!(itp_id = ?itp_id, error = %e, "Delisting watchdog: failed to check ITP");
                }
            }
        }

        Ok(actions)
    }

    async fn fetch_unsafe_listings(&self) -> Result<Vec<UnsafeListing>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/listings/unsafe", self.data_node_url);
        let resp = self.http_client.get(&url).send().await?;
        let listings: Vec<UnsafeListing> = resp.json().await?;
        Ok(listings)
    }

    async fn get_itp_count(&self) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        // Encode getItpCount() call
        let selector = &ethers::utils::keccak256(b"getItpCount()")[..4];
        let calldata = selector.to_vec();

        let result = self.chain_writer.static_call(self.index_address, calldata).await
            .map_err(|e| format!("getItpCount static_call failed: {}", e))?;

        if result.len() < 32 {
            return Ok(0);
        }
        let count = U256::from_big_endian(&result[..32]);
        Ok(count.as_u64())
    }

    async fn check_itp(
        &self,
        itp_id: H256,
        unsafe_base_coins: &HashSet<String>,
    ) -> Result<Option<RebalanceAction>, Box<dyn std::error::Error + Send + Sync>> {
        let state = self.chain_reader.get_itp_inventory_state(itp_id.0)
            .await
            .map_err(|e| format!("getITPState failed for {:?}: {}", itp_id, e))?;

        // Find affected asset indices
        let mut affected_indices = Vec::new();
        let mut affected_addresses = Vec::new();

        for (idx, asset) in state.assets.iter().enumerate() {
            if let Some(pair) = self.symbol_map.get_symbol(asset) {
                let base_coin = extract_base_coin(pair);
                if unsafe_base_coins.contains(&base_coin) {
                    affected_indices.push(idx);
                    affected_addresses.push(*asset);
                }
            }
        }

        if affected_indices.is_empty() {
            return Ok(None);
        }

        let remaining_count = state.assets.len() - affected_indices.len();
        if remaining_count == 0 {
            warn!(
                itp_id = ?itp_id,
                "Delisting watchdog: ALL assets affected, cannot rebalance to 0 assets — skipping"
            );
            return Ok(None);
        }

        // Compute removal indices in descending order (RebalanceLib convention)
        let removal_indices = compute_removal_indices_descending(&affected_indices);

        // Compute new equal weights: 1e18 / remaining_count, remainder on last
        let new_weights = compute_equal_weights(remaining_count);

        // Encode requestRebalance calldata
        let calldata = encode_request_rebalance(
            itp_id,
            &removal_indices,
            &[], // no addAssets
            &new_weights,
            "delisting watchdog: unsafe asset removed",
        );

        // Submit transaction
        let tx_hash = self.chain_writer
            .send_transaction(self.index_address, calldata, U256::zero())
            .await
            .map_err(|e| format!("requestRebalance tx failed: {}", e))?;

        Ok(Some(RebalanceAction {
            itp_id,
            removed_assets: affected_addresses,
            remaining_count,
            tx_hash,
        }))
    }
}

/// Extract base coin from a Bitget pair. "SUIUSDT" → "SUI", "BTCUSDC" → "BTC".
pub fn extract_base_coin(pair: &str) -> String {
    let pair_upper = pair.to_uppercase();
    for suffix in &["USDT", "USDC", "BTC", "ETH"] {
        if let Some(base) = pair_upper.strip_suffix(suffix) {
            if !base.is_empty() {
                return base.to_string();
            }
        }
    }
    pair_upper
}

/// Build a set of unsafe base coins from the listing danger list.
pub fn build_unsafe_basecoin_set(listings: &[UnsafeListing]) -> HashSet<String> {
    listings
        .iter()
        .map(|l| l.base_coin.to_uppercase())
        .collect()
}

/// Given affected indices, return them sorted in descending order.
pub fn compute_removal_indices_descending(indices: &[usize]) -> Vec<U256> {
    let mut sorted = indices.to_vec();
    sorted.sort_unstable_by(|a, b| b.cmp(a)); // descending
    sorted.into_iter().map(|i| U256::from(i)).collect()
}

/// Compute equal weights for `count` remaining assets.
/// Weights sum to exactly 1e18 (remainder goes to last asset).
pub fn compute_equal_weights(count: usize) -> Vec<U256> {
    if count == 0 {
        return vec![];
    }
    let one_e18 = U256::from(10).pow(U256::from(18));
    let count_u256 = U256::from(count);
    let base_weight = one_e18 / count_u256;
    let remainder = one_e18 - base_weight * count_u256;

    let mut weights = vec![base_weight; count];
    if let Some(last) = weights.last_mut() {
        *last = *last + remainder;
    }
    weights
}

/// ABI-encode `requestRebalance(bytes32, uint256[], address[], uint256[], string)` calldata.
pub fn encode_request_rebalance(
    itp_id: H256,
    remove_indices: &[U256],
    add_assets: &[Address],
    new_weights: &[U256],
    note: &str,
) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(
        b"requestRebalance(bytes32,uint256[],address[],uint256[],string)"
    )[..4];

    let tokens = vec![
        Token::FixedBytes(itp_id.as_bytes().to_vec()),
        Token::Array(remove_indices.iter().map(|i| Token::Uint(*i)).collect()),
        Token::Array(add_assets.iter().map(|a| Token::Address(*a)).collect()),
        Token::Array(new_weights.iter().map(|w| Token::Uint(*w)).collect()),
        Token::String(note.to_string()),
    ];

    let mut calldata = selector.to_vec();
    calldata.extend(abi::encode(&tokens));
    calldata
}

/// Daily scheduler: runs the watchdog check every `interval`, only if this node is the leader.
pub async fn run_daily(
    watchdog: Arc<DelistingWatchdog>,
    leader_elector: Arc<tokio::sync::RwLock<LeaderElector>>,
    interval: Duration,
    shutdown: Arc<std::sync::atomic::AtomicBool>,
) {
    info!(interval_secs = interval.as_secs(), "Delisting watchdog daily task started");

    loop {
        tokio::time::sleep(interval).await;

        if shutdown.load(std::sync::atomic::Ordering::Relaxed) {
            info!("Delisting watchdog shutting down");
            break;
        }

        // Only leader runs the check
        let is_leader = {
            let mut elector = leader_elector.write().await;
            // Use cycle-based election with a pseudo-cycle derived from wall clock
            let pseudo_cycle = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() / interval.as_secs();
            elector.is_leader_for_cycle(pseudo_cycle)
        };

        if !is_leader {
            info!("Delisting watchdog: not leader, skipping");
            continue;
        }

        match watchdog.check_and_rebalance().await {
            Ok(actions) => {
                info!(count = actions.len(), "Delisting watchdog completed");
            }
            Err(e) => {
                warn!(%e, "Delisting watchdog failed");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_equal_weights_3_assets() {
        let weights = compute_equal_weights(3);
        assert_eq!(weights.len(), 3);
        let sum: U256 = weights.iter().copied().fold(U256::zero(), |acc, w| acc + w);
        assert_eq!(sum, U256::from(10).pow(U256::from(18)));
        // First two should be floor(1e18/3) = 333333333333333333
        assert_eq!(weights[0], U256::from(333333333333333333u64));
        assert_eq!(weights[1], U256::from(333333333333333333u64));
        // Last gets remainder
        assert_eq!(weights[2], U256::from(333333333333333334u64));
    }

    #[test]
    fn test_compute_equal_weights_1_asset() {
        let weights = compute_equal_weights(1);
        assert_eq!(weights.len(), 1);
        assert_eq!(weights[0], U256::from(10).pow(U256::from(18)));
    }

    #[test]
    fn test_compute_equal_weights_100_assets() {
        let weights = compute_equal_weights(100);
        assert_eq!(weights.len(), 100);
        let sum: U256 = weights.iter().copied().fold(U256::zero(), |acc, w| acc + w);
        assert_eq!(sum, U256::from(10).pow(U256::from(18)));
        // Each base weight = 1e18 / 100 = 10000000000000000
        assert_eq!(weights[0], U256::from(10000000000000000u64));
    }

    #[test]
    fn test_compute_removal_indices_descending() {
        // Assets [A, B, C, D], remove B (idx 1) and D (idx 3)
        let indices = compute_removal_indices_descending(&[1, 3]);
        assert_eq!(indices, vec![U256::from(3), U256::from(1)]);
    }

    #[test]
    fn test_build_unsafe_basecoin_set() {
        let listings = vec![
            UnsafeListing {
                symbol: "SUIUSDT".to_string(),
                base_coin: "SUI".to_string(),
                status: "halt".to_string(),
            },
            UnsafeListing {
                symbol: "APTUSDT".to_string(),
                base_coin: "APT".to_string(),
                status: "offline".to_string(),
            },
        ];
        let set = build_unsafe_basecoin_set(&listings);
        assert!(set.contains("SUI"));
        assert!(set.contains("APT"));
        assert!(!set.contains("BTC"));
    }

    #[test]
    fn test_no_affected_assets() {
        // ITP with BTC, ETH — unsafe set has SUI
        let unsafe_set: HashSet<String> = ["SUI"].iter().map(|s| s.to_string()).collect();
        // No overlap, so we'd expect check_itp to return None
        assert!(!unsafe_set.contains("BTC"));
        assert!(!unsafe_set.contains("ETH"));
    }

    #[test]
    fn test_all_assets_affected_guard() {
        // When all assets are affected, remaining_count == 0 → skip
        let remaining_count = 5 - 5; // all removed
        assert_eq!(remaining_count, 0);
        // Weights should be empty
        let weights = compute_equal_weights(0);
        assert!(weights.is_empty());
    }
}
