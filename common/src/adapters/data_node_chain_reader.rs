//! DataNodeChainReader — reads L3 chain state from data-node HTTP endpoints.
//!
//! Implements the `ChainReader` trait by calling data-node HTTP endpoints
//! instead of making direct RPC calls to the L3 chain. This centralizes
//! all chain reads through data-node, reducing RPC load.

use std::time::Duration;

use async_trait::async_trait;
use ethers::types::{Address, Bytes, H256, U256};
use reqwest::Client;
use serde::Deserialize;

use crate::error::Error;
use crate::traits::{
    ChainReader, EventFilter, EventStream, ItpInventoryState, PendingRebalance,
};
use crate::types::{ITPCore, Issuer, LimitOrder, OrderStatus, Price, Side};

/// Chain reader that fetches L3 state from data-node HTTP API.
pub struct DataNodeChainReader {
    base_url: String,
    client: Client,
}

// ── JSON response types ────────────────────────────────────────────

#[derive(Deserialize)]
struct CachedOrder {
    order_id: u64,
    user: String,
    itp_id: String,
    side: u8,
    amount: String,
    limit_price: String,
    slippage_tier: u8,
    deadline: String,
    timestamp: u64,
    status: u8,
}

#[derive(Deserialize)]
struct CachedIssuer {
    address: String,
    endpoint: String,
    bls_pubkey: String,
}

#[derive(Deserialize)]
struct CycleResp {
    cycle: u64,
}

#[derive(Deserialize)]
struct NextOrderIdResp {
    next_order_id: u64,
}

#[derive(Deserialize)]
struct CountResp {
    count: u64,
}

#[derive(Deserialize)]
struct PubkeyResp {
    pubkey: String,
}

#[derive(Deserialize)]
struct PausedResp {
    paused: bool,
}

// ── Helpers ────────────────────────────────────────────────────────

impl DataNodeChainReader {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("failed to build HTTP client");
        Self { base_url, client }
    }

    async fn get_json<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, Error> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| Error::ChainRead(format!("data-node GET {} failed: {}", path, e)))?;

        if !resp.status().is_success() {
            return Err(Error::ChainRead(format!(
                "data-node GET {} returned {}",
                path,
                resp.status()
            )));
        }

        resp.json::<T>()
            .await
            .map_err(|e| Error::ChainRead(format!("data-node GET {} parse failed: {}", path, e)))
    }

    fn parse_h256(hex_str: &str) -> H256 {
        let hex = hex_str.strip_prefix("0x").unwrap_or(hex_str);
        let bytes = hex::decode(hex).unwrap_or_else(|_| vec![0u8; 32]);
        let mut arr = [0u8; 32];
        let len = bytes.len().min(32);
        arr[..len].copy_from_slice(&bytes[..len]);
        H256::from(arr)
    }

    fn convert_order(o: CachedOrder) -> LimitOrder {
        let itp_id = Self::parse_h256(&o.itp_id);
        let user: Address = o.user.parse().unwrap_or_default();

        LimitOrder {
            id: U256::from(o.order_id),
            user,
            pair_id: itp_id, // pair_id = itp_id for ITP orders
            side: if o.side == 0 { Side::Buy } else { Side::Sell },
            amount: U256::from_dec_str(&o.amount).unwrap_or_default(),
            limit_price: U256::from_dec_str(&o.limit_price).unwrap_or_default(),
            slippage_tier: U256::from(o.slippage_tier),
            deadline: U256::from_dec_str(&o.deadline).unwrap_or_default(),
            itp_id,
            timestamp: U256::from(o.timestamp),
            status: match o.status {
                0 => OrderStatus::Pending,
                1 => OrderStatus::Batched,
                2 => OrderStatus::Filled,
                3 => OrderStatus::Cancelled,
                _ => OrderStatus::Pending,
            },
        }
    }
}

#[async_trait]
impl ChainReader for DataNodeChainReader {
    async fn get_pending_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        let orders: Vec<CachedOrder> = self.get_json("/chain/l3/pending-orders").await?;
        Ok(orders
            .into_iter()
            .filter(|o| !o.amount.is_empty() && o.amount != "0")
            .map(Self::convert_order)
            .collect())
    }

    async fn get_itp(&self, itp_id: [u8; 32]) -> Result<ITPCore, Error> {
        // ITP data is served through existing NAV endpoint — fall back to error
        // since we don't have a per-ITP HTTP endpoint yet
        Err(Error::NotFound(format!(
            "get_itp not yet available via data-node (itp_id=0x{})",
            hex::encode(itp_id)
        )))
    }

    async fn get_prices(&self) -> Result<Vec<Price>, Error> {
        // Prices are available through the existing /prices endpoint
        // but in a different format. For now, return empty.
        Ok(vec![])
    }

    async fn get_issuer_registry(&self) -> Result<Vec<Issuer>, Error> {
        let issuers: Vec<CachedIssuer> = self.get_json("/chain/l3/issuer-registry").await?;
        Ok(issuers
            .into_iter()
            .enumerate()
            .map(|(i, c)| {
                let addr: Address = c.address.parse().unwrap_or_default();
                let pubkey_hex = c.bls_pubkey.strip_prefix("0x").unwrap_or(&c.bls_pubkey);
                let pubkey_bytes = hex::decode(pubkey_hex).unwrap_or_default();
                // Pack endpoint string into H256 (IP bytes32 field)
                let mut ip_bytes = [0u8; 32];
                let ep_bytes = c.endpoint.as_bytes();
                let len = ep_bytes.len().min(32);
                ip_bytes[..len].copy_from_slice(&ep_bytes[..len]);
                Issuer {
                    id: (i + 1) as u64,
                    addr,
                    ip: H256::from(ip_bytes),
                    bls_pubkey: Bytes::from(pubkey_bytes),
                    status: U256::from(1), // active
                    registered_at: U256::zero(),
                }
            })
            .collect())
    }

    async fn subscribe_events(&self, _filter: EventFilter) -> Result<EventStream, Error> {
        // SSE-based event subscription will be handled separately
        // by the DataNodeSettlementReader and direct SSE consumers
        Err(Error::ChainRead(
            "subscribe_events: use SSE /sse/chain-events instead".to_string(),
        ))
    }

    async fn get_last_processed_cycle(&self) -> Result<u64, Error> {
        let resp: CycleResp = self.get_json("/chain/l3/last-cycle").await?;
        Ok(resp.cycle)
    }

    async fn get_pending_rebalances(&self) -> Result<Vec<PendingRebalance>, Error> {
        // The cached format is simplified — for full PendingRebalance we'd need
        // the inventory data. Return empty for now.
        Ok(vec![])
    }

    async fn get_next_order_id(&self) -> Result<u64, Error> {
        let resp: NextOrderIdResp = self.get_json("/chain/l3/next-order-id").await?;
        Ok(resp.next_order_id)
    }

    async fn get_batched_orders(&self) -> Result<Vec<LimitOrder>, Error> {
        let orders: Vec<CachedOrder> = self.get_json("/chain/l3/batched-orders").await?;
        Ok(orders.into_iter().map(Self::convert_order).collect())
    }

    async fn get_itp_inventory_state(&self, itp_id: [u8; 32]) -> Result<ItpInventoryState, Error> {
        let itp_hex = format!("0x{}", hex::encode(itp_id));
        let resp: serde_json::Value = self
            .get_json(&format!("/chain/l3/itp-state?itp_id={}", itp_hex))
            .await?;

        let assets: Vec<Address> = resp["assets"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str()?.parse().ok())
            .collect();

        let quantities: Vec<U256> = resp["quantities"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| U256::from_dec_str(v.as_str()?).ok())
            .collect();

        let nav = resp["nav"]
            .as_str()
            .and_then(|s| U256::from_dec_str(s).ok())
            .unwrap_or_default();

        Ok(ItpInventoryState {
            assets,
            quantities,
            nav,
        })
    }

    async fn get_active_issuer_count(&self) -> Result<u64, Error> {
        let resp: CountResp = self.get_json("/chain/l3/active-issuer-count").await?;
        Ok(resp.count)
    }

    async fn get_registry_nonce(&self) -> Result<u64, Error> {
        #[derive(Deserialize)]
        struct NonceResp {
            nonce: u64,
        }
        let resp: NonceResp = self.get_json("/chain/l3/registry-nonce").await?;
        Ok(resp.nonce)
    }

    async fn get_aggregated_pubkey(&self) -> Result<Vec<u8>, Error> {
        let resp: PubkeyResp = self.get_json("/chain/l3/aggregated-pubkey").await?;
        let hex_str = resp.pubkey.strip_prefix("0x").unwrap_or(&resp.pubkey);
        hex::decode(hex_str)
            .map_err(|e| Error::ChainRead(format!("invalid aggregated pubkey hex: {}", e)))
    }

    async fn is_consensus_paused(&self) -> Result<bool, Error> {
        let resp: PausedResp = self.get_json("/chain/l3/consensus-paused").await?;
        Ok(resp.paused)
    }
}
