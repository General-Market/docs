//! DataNodeSettlementReader — reads settlement chain state from data-node HTTP endpoints.
//!
//! Implements `SettlementReader` by calling data-node HTTP endpoints and
//! receiving events via SSE, instead of direct RPC to the settlement chain.
//! Deduplication state (seen_orders, retry_counts) is maintained locally
//! per-issuer instance.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use async_trait::async_trait;
use ethers::types::{Address, H256, U256};
use reqwest::Client;
use serde::Deserialize;
use tokio::sync::RwLock;
use tracing::{debug, warn};

use common::types::{
    CrossChainOrder, CrossChainOrderData, CrossChainOrderEvent, CrossChainSellOrderEvent,
    ItpCreatedEvent, ItpCreationRequest,
};

use super::settlement_reader::SettlementReaderError;
use super::settlement_trait::SettlementReader;

/// Settlement chain reader backed by data-node HTTP API.
///
/// Events are fetched via HTTP (not SSE) with block range queries.
/// Dedup state is local to this instance — each issuer maintains its own.
pub struct DataNodeSettlementReader {
    base_url: String,
    client: Client,
    chain_id: u64,
    /// Dedup: (chain_id, order_id) → processed
    seen_orders: RwLock<HashMap<(u64, String), bool>>,
    /// Retry counts: (chain_id, order_id) → count
    retry_counts: RwLock<HashMap<(u64, String), u8>>,
    /// Dedup for sell orders
    seen_sell_orders: RwLock<HashMap<(u64, String), bool>>,
    sell_retry_counts: RwLock<HashMap<(u64, String), u8>>,
}

// ── JSON response types ────────────────────────────────────────────

#[derive(Deserialize)]
struct ConfirmedBlockResp {
    block: u64,
}

#[derive(Deserialize)]
struct NonceResp {
    nonce: u64,
}

#[derive(Deserialize)]
struct PendingResp {
    pending: bool,
}

// ── Implementation ─────────────────────────────────────────────────

impl DataNodeSettlementReader {
    pub fn new(base_url: String, chain_id: u64) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("failed to build HTTP client");
        Self {
            base_url,
            client,
            chain_id,
            seen_orders: RwLock::new(HashMap::new()),
            retry_counts: RwLock::new(HashMap::new()),
            seen_sell_orders: RwLock::new(HashMap::new()),
            sell_retry_counts: RwLock::new(HashMap::new()),
        }
    }

    async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<T, SettlementReaderError> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.client.get(&url).send().await.map_err(|e| {
            SettlementReaderError::ProviderError(format!("data-node GET {} failed: {}", path, e))
        })?;

        if !resp.status().is_success() {
            return Err(SettlementReaderError::ProviderError(format!(
                "data-node GET {} returned {}",
                path,
                resp.status()
            )));
        }

        resp.json::<T>().await.map_err(|e| {
            SettlementReaderError::ProviderError(format!(
                "data-node GET {} parse failed: {}",
                path, e
            ))
        })
    }

    fn order_key(chain_id: u64, order_id: U256) -> (u64, String) {
        (chain_id, order_id.to_string())
    }
}

#[async_trait]
impl SettlementReader for DataNodeSettlementReader {
    fn chain_id(&self) -> u64 {
        self.chain_id
    }

    async fn get_confirmed_block(&self) -> Result<u64, SettlementReaderError> {
        let resp: ConfirmedBlockResp =
            self.get_json("/chain/settlement/confirmed-block").await?;
        Ok(resp.block)
    }

    // ── ITP Creation ────────────────────────────────────────────

    async fn get_create_itp_events(
        &self,
        _from_block: u64,
        _to_block: u64,
    ) -> Result<Vec<ItpCreationRequest>, SettlementReaderError> {
        // Events come via SSE; for block-range queries we'd need a dedicated endpoint.
        // For now return all pending creations (the issuer filters by block range).
        self.get_all_pending_requests().await
    }

    async fn get_itp_created_events(
        &self,
        _from_block: u64,
        _to_block: u64,
    ) -> Result<Vec<ItpCreatedEvent>, SettlementReaderError> {
        // ItpCreated events come via SSE; not yet exposed as HTTP endpoint.
        Ok(vec![])
    }

    async fn is_pending(&self, nonce: U256) -> Result<bool, SettlementReaderError> {
        let resp: PendingResp = self
            .get_json(&format!(
                "/chain/settlement/is-pending/{}",
                nonce.as_u64()
            ))
            .await?;
        Ok(resp.pending)
    }

    async fn get_next_nonce(&self) -> Result<U256, SettlementReaderError> {
        let resp: NonceResp = self.get_json("/chain/settlement/next-nonce").await?;
        Ok(U256::from(resp.nonce))
    }

    async fn get_pending_creation(
        &self,
        nonce: U256,
    ) -> Result<Option<ItpCreationRequest>, SettlementReaderError> {
        // Check all pending creations and find the one with matching nonce
        let all = self.get_all_pending_requests().await?;
        Ok(all.into_iter().find(|r| r.nonce == nonce))
    }

    async fn get_all_pending_requests(
        &self,
    ) -> Result<Vec<ItpCreationRequest>, SettlementReaderError> {
        let creations: Vec<serde_json::Value> = self
            .get_json("/chain/settlement/pending-creations")
            .await?;
        // Parse JSON values into ItpCreationRequest
        let mut requests = Vec::new();
        for val in creations {
            match serde_json::from_value::<ItpCreationRequest>(val) {
                Ok(r) => requests.push(r),
                Err(e) => warn!("Failed to parse pending creation: {}", e),
            }
        }
        Ok(requests)
    }

    // ── Cross-Chain Buy Orders ──────────────────────────────────

    async fn get_cross_chain_order_events(
        &self,
        _from_block: u64,
        _to_block: u64,
    ) -> Result<Vec<CrossChainOrderEvent>, SettlementReaderError> {
        // Events come via SSE; no block-range HTTP endpoint yet
        Ok(vec![])
    }

    async fn get_cross_chain_order(
        &self,
        order_id: U256,
    ) -> Result<Option<CrossChainOrderData>, SettlementReaderError> {
        let path = format!("/chain/settlement/cross-chain-order/{}", order_id);
        match self.get_json::<CrossChainOrderData>(&path).await {
            Ok(data) => {
                if data.user == Address::zero() {
                    Ok(None)
                } else {
                    Ok(Some(data))
                }
            }
            Err(SettlementReaderError::ProviderError(msg)) if msg.contains("404") => Ok(None),
            Err(e) => Err(e),
        }
    }

    async fn get_confirmed_cross_chain_orders(
        &self,
        _from_block: u64,
        _to_block: u64,
    ) -> Result<Vec<CrossChainOrder>, SettlementReaderError> {
        // Cross-chain orders come via SSE events; the issuer's main loop
        // will receive them through the event stream and process individually.
        Ok(vec![])
    }

    async fn mark_order_processed(&self, chain_id: u64, order_id: U256) {
        let key = Self::order_key(chain_id, order_id);
        self.seen_orders.write().await.insert(key, true);
    }

    async fn increment_retry_count(&self, chain_id: u64, order_id: U256) -> u8 {
        let key = Self::order_key(chain_id, order_id);
        let mut counts = self.retry_counts.write().await;
        let count = counts.entry(key).or_insert(0);
        *count += 1;
        *count
    }

    async fn remove_seen_order(&self, chain_id: u64, order_id: U256) {
        let key = Self::order_key(chain_id, order_id);
        self.seen_orders.write().await.remove(&key);
        self.retry_counts.write().await.remove(&key);
    }

    async fn clear_old_seen_orders(&self, max_size: usize) {
        let mut orders = self.seen_orders.write().await;
        if orders.len() > max_size {
            let to_remove = orders.len() - max_size;
            let keys: Vec<_> = orders.keys().take(to_remove).cloned().collect();
            for k in keys {
                orders.remove(&k);
            }
        }
    }

    // ── Cross-Chain Sell Orders ─────────────────────────────────

    async fn get_confirmed_cross_chain_sell_orders(
        &self,
        _from_block: u64,
        _to_block: u64,
    ) -> Result<Vec<CrossChainSellOrderEvent>, SettlementReaderError> {
        // Sell orders come via SSE events
        Ok(vec![])
    }

    async fn mark_sell_order_processed(&self, chain_id: u64, order_id: U256) {
        let key = Self::order_key(chain_id, order_id);
        self.seen_sell_orders.write().await.insert(key, true);
    }

    async fn increment_sell_retry_count(&self, chain_id: u64, order_id: U256) -> u8 {
        let key = Self::order_key(chain_id, order_id);
        let mut counts = self.sell_retry_counts.write().await;
        let count = counts.entry(key).or_insert(0);
        *count += 1;
        *count
    }

    async fn remove_seen_sell_order(&self, chain_id: u64, order_id: U256) {
        let key = Self::order_key(chain_id, order_id);
        self.seen_sell_orders.write().await.remove(&key);
        self.sell_retry_counts.write().await.remove(&key);
    }

    async fn clear_old_seen_sell_orders(&self, max_size: usize) {
        let mut orders = self.seen_sell_orders.write().await;
        if orders.len() > max_size {
            let to_remove = orders.len() - max_size;
            let keys: Vec<_> = orders.keys().take(to_remove).cloned().collect();
            for k in keys {
                orders.remove(&k);
            }
        }
    }
}
