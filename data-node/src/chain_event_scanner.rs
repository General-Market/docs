use ethers::prelude::*;
use ethers::core::utils::keccak256;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, info, warn};

/// Broadcast channel capacity for chain events.
pub const CHAIN_EVENT_CHANNEL_SIZE: usize = 1024;

/// Envelope for chain events broadcast to SSE consumers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainEventEnvelope {
    /// Event type identifier, e.g. "create-itp-requested", "order-submitted"
    pub event_type: String,
    /// Source chain: "l3" or "settlement"
    pub chain: String,
    /// Block number where the event was emitted
    pub block_number: u64,
    /// Raw event data as JSON (log topics + data hex-encoded)
    pub data: serde_json::Value,
}

/// Reorg-safety buffer: how many blocks behind `latest` to query up to.
const L3_REORG_BUFFER: u64 = 2;
const SETTLEMENT_REORG_BUFFER: u64 = 10;

/// Precomputed topic0 hashes for all scanned events.
struct EventSignatures {
    // L3 events (Index.sol)
    order_submitted: H256,
    fill_confirmed: H256,
    rebalance_requested: H256,
    asset_trade_request: H256,

    // Settlement events (BridgeProxy + SettlementBridgeCustody)
    create_itp_requested: H256,
    cross_chain_order_created: H256,
    cross_chain_sell_order_created: H256,
    itp_created: H256,
}

impl EventSignatures {
    fn new() -> Self {
        Self {
            order_submitted: H256::from(keccak256(
                "OrderSubmitted(uint256,address,bytes32,bytes32,uint8,uint256,uint256,uint256,uint256)",
            )),
            fill_confirmed: H256::from(keccak256(
                "FillConfirmed(uint256,uint256,uint256,uint256)",
            )),
            rebalance_requested: H256::from(keccak256(
                "RebalanceRequested(address,bytes32,uint256[],address[],uint256[],string)",
            )),
            asset_trade_request: H256::from(keccak256(
                "AssetTradeRequest(uint256,address,uint8,uint256,uint256,address)",
            )),
            create_itp_requested: H256::from(keccak256(
                "CreateItpRequested(address,uint256,string,string,uint256[],address[])",
            )),
            cross_chain_order_created: H256::from(keccak256(
                "CrossChainOrderCreated(uint256,bytes32,address,uint256)",
            )),
            cross_chain_sell_order_created: H256::from(keccak256(
                "CrossChainSellOrderCreated(uint256,bytes32,address,address,uint256,uint256)",
            )),
            itp_created: H256::from(keccak256(
                "ItpCreated(bytes32,address,uint256,address)",
            )),
        }
    }
}

/// Scans L3 and Settlement chains for contract events and broadcasts them
/// via a `tokio::broadcast` channel for downstream SSE consumers.
pub struct ChainEventScanner {
    l3_provider: Arc<Provider<Http>>,
    settlement_provider: Arc<Provider<Http>>,
    deployment: serde_json::Value,
    event_tx: broadcast::Sender<ChainEventEnvelope>,
    l3_block_cursor: u64,
    settlement_block_cursor: u64,
}

impl ChainEventScanner {
    /// Create a new scanner. Cursors are initialized to 0 and will be set to
    /// the current block height on the first tick of each scanning loop.
    pub fn new(
        l3_provider: Arc<Provider<Http>>,
        settlement_provider: Arc<Provider<Http>>,
        deployment: serde_json::Value,
        event_tx: broadcast::Sender<ChainEventEnvelope>,
    ) -> Self {
        Self {
            l3_provider,
            settlement_provider,
            deployment,
            event_tx,
            l3_block_cursor: 0,
            settlement_block_cursor: 0,
        }
    }

    /// Spawn background scanning tasks. Returns JoinHandles for each chain scanner.
    ///
    /// On start, cursors are set to the current block (no history replay).
    pub async fn start(mut self) -> (tokio::task::JoinHandle<()>, tokio::task::JoinHandle<()>) {
        let sigs = EventSignatures::new();

        // Resolve contract addresses up front
        let index_addr = match crate::api::deployment_addr(&self.deployment, "Index") {
            Ok(a) => a,
            Err(e) => {
                warn!("chain_event_scanner: cannot resolve Index address: {e}");
                Address::zero()
            }
        };
        let bridge_proxy_addr = match crate::api::deployment_addr(&self.deployment, "BridgeProxy") {
            Ok(a) => a,
            Err(e) => {
                warn!("chain_event_scanner: cannot resolve BridgeProxy address: {e}");
                Address::zero()
            }
        };
        let custody_addr = match crate::api::deployment_addr(&self.deployment, "SettlementBridgeCustody") {
            Ok(a) => a,
            Err(e) => {
                warn!("chain_event_scanner: cannot resolve SettlementBridgeCustody address: {e}");
                Address::zero()
            }
        };

        // Initialize L3 cursor to current block
        match self.l3_provider.get_block_number().await {
            Ok(bn) => {
                self.l3_block_cursor = bn.as_u64();
                info!(block = self.l3_block_cursor, "L3 event scanner starting");
            }
            Err(e) => warn!("Failed to get L3 block number at startup: {e}"),
        }

        // Initialize settlement cursor to current block
        match self.settlement_provider.get_block_number().await {
            Ok(bn) => {
                self.settlement_block_cursor = bn.as_u64();
                info!(block = self.settlement_block_cursor, "Settlement event scanner starting");
            }
            Err(e) => warn!("Failed to get settlement block number at startup: {e}"),
        }

        // Clone what each task needs
        let l3_provider = Arc::clone(&self.l3_provider);
        let l3_tx = self.event_tx.clone();
        let l3_cursor = self.l3_block_cursor;

        let settlement_provider = Arc::clone(&self.settlement_provider);
        let settlement_tx = self.event_tx.clone();
        let settlement_cursor = self.settlement_block_cursor;

        // L3 topic0 hashes
        let l3_topics = vec![
            sigs.order_submitted,
            sigs.fill_confirmed,
            sigs.rebalance_requested,
            sigs.asset_trade_request,
        ];

        // Settlement topic0 hashes
        let settlement_topics = vec![
            sigs.create_itp_requested,
            sigs.cross_chain_order_created,
            sigs.cross_chain_sell_order_created,
            sigs.itp_created,
        ];

        // Spawn L3 scanner (polls every 1s)
        let l3_handle = tokio::spawn(scan_loop(
            l3_provider,
            l3_tx,
            l3_cursor,
            index_addr,
            Vec::new(), // single contract address
            l3_topics,
            "l3".to_string(),
            L3_REORG_BUFFER,
            std::time::Duration::from_secs(1),
            sigs.order_submitted,
            sigs.fill_confirmed,
            sigs.rebalance_requested,
            sigs.asset_trade_request,
        ));

        // Spawn Settlement scanner (polls every 1s — Sonic has instant finality)
        let settlement_handle = tokio::spawn(scan_settlement_loop(
            settlement_provider,
            settlement_tx,
            settlement_cursor,
            bridge_proxy_addr,
            custody_addr,
            settlement_topics,
            SETTLEMENT_REORG_BUFFER,
            std::time::Duration::from_secs(1),
            sigs.create_itp_requested,
            sigs.cross_chain_order_created,
            sigs.cross_chain_sell_order_created,
            sigs.itp_created,
        ));

        (l3_handle, settlement_handle)
    }
}

/// Build a JSON representation of a raw log for the envelope.
fn log_to_json(log: &Log) -> serde_json::Value {
    serde_json::json!({
        "address": format!("{:?}", log.address),
        "topics": log.topics.iter().map(|t| format!("{:?}", t)).collect::<Vec<_>>(),
        "data": format!("0x{}", hex::encode(&log.data)),
        "blockNumber": log.block_number.map(|b| b.as_u64()),
        "transactionHash": log.transaction_hash.map(|h| format!("{:?}", h)),
        "logIndex": log.log_index.map(|i| i.as_u64()),
    })
}

/// Map a topic0 hash to its event_type string for L3 events.
fn l3_event_type(
    topic0: H256,
    order_submitted: H256,
    fill_confirmed: H256,
    rebalance_requested: H256,
    asset_trade_request: H256,
) -> Option<&'static str> {
    if topic0 == order_submitted {
        Some("order-submitted")
    } else if topic0 == fill_confirmed {
        Some("fill-confirmed")
    } else if topic0 == rebalance_requested {
        Some("rebalance-requested")
    } else if topic0 == asset_trade_request {
        Some("asset-trade-request")
    } else {
        None
    }
}

/// Map a topic0 hash to its event_type string for Settlement events.
fn settlement_event_type(
    topic0: H256,
    create_itp_requested: H256,
    cross_chain_order_created: H256,
    cross_chain_sell_order_created: H256,
    itp_created: H256,
) -> Option<&'static str> {
    if topic0 == create_itp_requested {
        Some("create-itp-requested")
    } else if topic0 == cross_chain_order_created {
        Some("cross-chain-order")
    } else if topic0 == cross_chain_sell_order_created {
        Some("cross-chain-sell-order")
    } else if topic0 == itp_created {
        Some("itp-created")
    } else {
        None
    }
}

/// Background loop that scans L3 for events from the Index contract.
#[allow(clippy::too_many_arguments)]
async fn scan_loop(
    provider: Arc<Provider<Http>>,
    event_tx: broadcast::Sender<ChainEventEnvelope>,
    mut cursor: u64,
    index_addr: Address,
    _extra_addrs: Vec<Address>,
    topic0_filter: Vec<H256>,
    chain: String,
    reorg_buffer: u64,
    poll_interval: std::time::Duration,
    order_submitted: H256,
    fill_confirmed: H256,
    rebalance_requested: H256,
    asset_trade_request: H256,
) {
    if index_addr == Address::zero() {
        warn!("L3 event scanner disabled: no Index contract address");
        return;
    }

    loop {
        tokio::time::sleep(poll_interval).await;

        let latest = match provider.get_block_number().await {
            Ok(bn) => bn.as_u64(),
            Err(e) => {
                warn!("L3 get_block_number failed: {e}");
                continue;
            }
        };

        // Apply reorg buffer — don't scan blocks that might be reorged
        let safe_head = latest.saturating_sub(reorg_buffer);
        if safe_head <= cursor {
            continue; // no new finalized blocks
        }

        let from_block = cursor + 1;
        let to_block = safe_head;

        let filter = Filter::new()
            .address(index_addr)
            .topic0(topic0_filter.clone())
            .from_block(from_block)
            .to_block(to_block);

        match provider.get_logs(&filter).await {
            Ok(logs) => {
                if !logs.is_empty() {
                    debug!(
                        chain = %chain,
                        count = logs.len(),
                        from = from_block,
                        to = to_block,
                        "Scanned L3 events"
                    );
                }

                for log in &logs {
                    if log.topics.is_empty() {
                        continue;
                    }
                    let topic0 = log.topics[0];
                    if let Some(event_type) = l3_event_type(
                        topic0,
                        order_submitted,
                        fill_confirmed,
                        rebalance_requested,
                        asset_trade_request,
                    ) {
                        let envelope = ChainEventEnvelope {
                            event_type: event_type.to_string(),
                            chain: chain.clone(),
                            block_number: log.block_number.map(|b| b.as_u64()).unwrap_or(0),
                            data: log_to_json(log),
                        };

                        // broadcast::send returns Err only if there are no receivers,
                        // which is fine — just means nobody is listening yet.
                        let _ = event_tx.send(envelope);
                    }
                }

                cursor = to_block;
            }
            Err(e) => {
                warn!(
                    chain = %chain,
                    from = from_block,
                    to = to_block,
                    %e,
                    "get_logs failed for L3, will retry next tick"
                );
                // Don't advance cursor — retry same range next tick
            }
        }
    }
}

/// Background loop that scans Settlement chain for events from BridgeProxy
/// and SettlementBridgeCustody contracts.
#[allow(clippy::too_many_arguments)]
async fn scan_settlement_loop(
    provider: Arc<Provider<Http>>,
    event_tx: broadcast::Sender<ChainEventEnvelope>,
    mut cursor: u64,
    bridge_proxy_addr: Address,
    custody_addr: Address,
    topic0_filter: Vec<H256>,
    reorg_buffer: u64,
    poll_interval: std::time::Duration,
    create_itp_requested: H256,
    cross_chain_order_created: H256,
    cross_chain_sell_order_created: H256,
    itp_created: H256,
) {
    let has_bridge = bridge_proxy_addr != Address::zero();
    let has_custody = custody_addr != Address::zero();

    if !has_bridge && !has_custody {
        warn!("Settlement event scanner disabled: no contract addresses");
        return;
    }

    // Build the list of contract addresses to watch
    let mut watch_addrs: Vec<Address> = Vec::new();
    if has_bridge {
        watch_addrs.push(bridge_proxy_addr);
    }
    if has_custody {
        watch_addrs.push(custody_addr);
    }

    loop {
        tokio::time::sleep(poll_interval).await;

        let latest = match provider.get_block_number().await {
            Ok(bn) => bn.as_u64(),
            Err(e) => {
                warn!("Settlement get_block_number failed: {e}");
                continue;
            }
        };

        let safe_head = latest.saturating_sub(reorg_buffer);
        if safe_head <= cursor {
            continue;
        }

        let from_block = cursor + 1;
        let to_block = safe_head;

        // ethers Filter::address accepts a ValueOrArray, so we pass all
        // watched addresses in one filter call.
        let filter = Filter::new()
            .address(watch_addrs.clone())
            .topic0(topic0_filter.clone())
            .from_block(from_block)
            .to_block(to_block);

        match provider.get_logs(&filter).await {
            Ok(logs) => {
                if !logs.is_empty() {
                    debug!(
                        count = logs.len(),
                        from = from_block,
                        to = to_block,
                        "Scanned settlement events"
                    );
                }

                for log in &logs {
                    if log.topics.is_empty() {
                        continue;
                    }
                    let topic0 = log.topics[0];
                    if let Some(event_type) = settlement_event_type(
                        topic0,
                        create_itp_requested,
                        cross_chain_order_created,
                        cross_chain_sell_order_created,
                        itp_created,
                    ) {
                        let envelope = ChainEventEnvelope {
                            event_type: event_type.to_string(),
                            chain: "settlement".to_string(),
                            block_number: log.block_number.map(|b| b.as_u64()).unwrap_or(0),
                            data: log_to_json(log),
                        };
                        let _ = event_tx.send(envelope);
                    }
                }

                cursor = to_block;
            }
            Err(e) => {
                warn!(
                    from = from_block,
                    to = to_block,
                    %e,
                    "get_logs failed for settlement, will retry next tick"
                );
            }
        }
    }
}
