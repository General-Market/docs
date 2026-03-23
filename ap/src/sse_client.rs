//! SSE (Server-Sent Events) client for consuming chain events from data-node.
//!
//! Connects to `{data_node_url}/sse/chain-events?topics=...` and parses the
//! text/event-stream format into `ChainEvent` variants that feed into the AP's
//! existing event processing pipeline via an mpsc channel.

use std::time::Duration;

use common::traits::ChainEvent;
use ethers::types::U256;
use futures::StreamExt;
use reqwest_eventsource::{Event as SseEvent, EventSource};
use serde::Deserialize;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// SSE event envelope matching data-node's `ChainEventEnvelope` format.
#[derive(Debug, Deserialize)]
struct ChainEventEnvelope {
    event_type: String,
    chain: String,
    #[allow(dead_code)]
    block_number: u64,
    data: serde_json::Value,
}

/// SSE client that connects to data-node's chain-events endpoint and converts
/// events into `ChainEvent` variants sent through an mpsc channel.
pub struct SseChainEventClient {
    base_url: String,
    topics: Vec<String>,
    /// Optional auth token — sent as X-AP-Auth header (validated by nginx)
    auth_token: Option<String>,
}

impl SseChainEventClient {
    pub fn new(base_url: String, topics: Vec<String>) -> Self {
        let auth_token = std::env::var("AP_SSE_AUTH_TOKEN").ok();
        Self { base_url, topics, auth_token }
    }

    fn sse_url(&self) -> String {
        if self.topics.is_empty() {
            format!("{}/sse/chain-events", self.base_url)
        } else {
            format!(
                "{}/sse/chain-events?topics={}",
                self.base_url,
                self.topics.join(",")
            )
        }
    }

    pub async fn run(self, tx: mpsc::Sender<ChainEvent>) {
        let mut backoff = Duration::from_secs(1);
        let max_backoff = Duration::from_secs(60);

        loop {
            let url = self.sse_url();
            info!(url = %url, "Connecting to data-node SSE chain-events stream");

            match self.connect_and_consume(&url, &tx).await {
                Ok(()) => {
                    info!("SSE stream ended cleanly");
                    backoff = Duration::from_secs(1);
                }
                Err(e) => {
                    warn!(error = %e, backoff_secs = backoff.as_secs(),
                        "SSE connection failed, will reconnect");
                }
            }

            if tx.is_closed() {
                info!("SSE client stopping: event channel closed");
                break;
            }

            tokio::time::sleep(backoff).await;
            backoff = std::cmp::min(backoff * 2, max_backoff);
        }
    }

    async fn connect_and_consume(
        &self,
        url: &str,
        tx: &mpsc::Sender<ChainEvent>,
    ) -> Result<(), String> {
        // Build SSE request with auth header if configured (C1 fix)
        let mut builder = reqwest::Client::new().get(url);
        if let Some(ref token) = self.auth_token {
            builder = builder.header("X-AP-Auth", token);
            debug!("SSE request includes X-AP-Auth header");
        }
        let mut es = EventSource::new(builder).map_err(|e| format!("SSE build error: {}", e))?;

        info!("SSE stream connected to data-node");

        while let Some(event) = es.next().await {
            match event {
                Ok(SseEvent::Open) => {
                    debug!("SSE connection opened");
                }
                Ok(SseEvent::Message(msg)) => {
                    // msg.event = event type, msg.data = JSON payload
                    if let Some(chain_event) = self.parse_sse_event(&msg.event, &msg.data) {
                        if tx.send(chain_event).await.is_err() {
                            return Ok(()); // Channel closed
                        }
                    }
                }
                Err(reqwest_eventsource::Error::StreamEnded) => {
                    return Ok(());
                }
                Err(e) => {
                    es.close();
                    return Err(format!("SSE error: {}", e));
                }
            }
        }

        Ok(())
    }

    fn parse_sse_event(&self, event_type: &str, data: &str) -> Option<ChainEvent> {
        let envelope: ChainEventEnvelope = match serde_json::from_str(data) {
            Ok(e) => e,
            Err(e) => {
                warn!(event_type, error = %e,
                    data_preview = &data[..data.len().min(200)],
                    "Failed to parse SSE event envelope");
                return None;
            }
        };

        if envelope.chain != "l3" {
            debug!(chain = %envelope.chain, event_type = %envelope.event_type,
                "Ignoring non-L3 chain event");
            return None;
        }

        match envelope.event_type.as_str() {
            "order-submitted" => self.parse_order_submitted(&envelope),
            "fill-confirmed" => self.parse_fill_confirmed(&envelope),
            "asset-trade-request" => self.parse_asset_trade_request(&envelope),
            "rebalance-requested" => {
                debug!("Received rebalance-requested event (not yet mapped to ChainEvent)");
                None
            }
            other => {
                debug!(event_type = other, "Unhandled SSE event type");
                None
            }
        }
    }

    fn parse_order_submitted(&self, envelope: &ChainEventEnvelope) -> Option<ChainEvent> {
        let log_data = &envelope.data;
        let topics = log_data.get("topics")?.as_array()?;
        if topics.len() < 4 {
            warn!("order-submitted: expected >= 4 topics, got {}", topics.len());
            return None;
        }

        let order_id = parse_topic_u64(topics.get(1)?)?;
        let user = parse_topic_address(topics.get(2)?)?;
        let itp_topic = topics.get(3)?.as_str()?;
        let itp_hex = itp_topic.strip_prefix("0x").unwrap_or(itp_topic);
        let itp_bytes = hex::decode(itp_hex).ok()?;
        let mut itp_id = [0u8; 32];
        if itp_bytes.len() >= 32 {
            itp_id.copy_from_slice(&itp_bytes[..32]);
        }

        let data_hex = log_data.get("data")?.as_str()?;
        let data_bytes = hex::decode(data_hex.strip_prefix("0x").unwrap_or(data_hex)).ok()?;
        if data_bytes.len() < 192 {
            warn!("order-submitted: data too short ({}), expected >= 192", data_bytes.len());
            return None;
        }

        info!(order_id, "SSE: received order-submitted event");

        Some(ChainEvent::OrderSubmitted {
            order_id,
            user,
            itp_id,
        })
    }

    fn parse_fill_confirmed(&self, envelope: &ChainEventEnvelope) -> Option<ChainEvent> {
        let log_data = &envelope.data;
        let topics = log_data.get("topics")?.as_array()?;
        if topics.len() < 2 {
            warn!("fill-confirmed: expected >= 2 topics, got {}", topics.len());
            return None;
        }

        let order_id = parse_topic_u64(topics.get(1)?)?;

        let data_hex = log_data.get("data")?.as_str()?;
        let data_bytes = hex::decode(data_hex.strip_prefix("0x").unwrap_or(data_hex)).ok()?;
        if data_bytes.len() < 64 {
            warn!("fill-confirmed: data too short ({}), expected >= 64", data_bytes.len());
            return None;
        }

        let fill_price = U256::from_big_endian(&data_bytes[0..32]);
        let fill_amount = U256::from_big_endian(&data_bytes[32..64]);

        info!(order_id, "SSE: received fill-confirmed event");

        Some(ChainEvent::FillConfirmed {
            order_id,
            fill_price,
            fill_amount,
        })
    }

    /// Parse an "asset-trade-request" event.
    ///
    /// Event: AssetTradeRequest(uint256 indexed cycleNumber, address indexed asset,
    ///         uint8 side, uint256 usdcAmount, uint256 price, address quoteToken)
    ///
    /// 2 indexed → topics[1..2], 4 non-indexed → 128 bytes data.
    fn parse_asset_trade_request(&self, envelope: &ChainEventEnvelope) -> Option<ChainEvent> {
        let log_data = &envelope.data;
        let topics = log_data.get("topics")?.as_array()?;
        if topics.len() < 3 {
            warn!("asset-trade-request: expected >= 3 topics, got {}", topics.len());
            return None;
        }

        let cycle_number = parse_topic_u64(topics.get(1)?)?;
        let asset = parse_topic_address(topics.get(2)?)?;

        let data_hex = log_data.get("data")?.as_str()?;
        let data_bytes = hex::decode(data_hex.strip_prefix("0x").unwrap_or(data_hex)).ok()?;
        if data_bytes.len() < 128 {
            warn!("asset-trade-request: data too short ({}), expected >= 128", data_bytes.len());
            return None;
        }

        let side = data_bytes[31]; // uint8 side (padded to 32 bytes, value in last byte)
        let usdc_amount = U256::from_big_endian(&data_bytes[32..64]);
        let price = U256::from_big_endian(&data_bytes[64..96]);
        let mut quote_token = [0u8; 20];
        quote_token.copy_from_slice(&data_bytes[108..128]); // address is last 20 of 32 bytes

        let block_number = envelope.block_number;
        let tx_hash_str = log_data.get("transactionHash").and_then(|v| v.as_str()).unwrap_or("0x0");
        let tx_hash_bytes = hex::decode(tx_hash_str.strip_prefix("0x").unwrap_or(tx_hash_str)).unwrap_or_default();
        let mut tx_hash = [0u8; 32];
        if tx_hash_bytes.len() >= 32 { tx_hash.copy_from_slice(&tx_hash_bytes[..32]); }
        let log_index = log_data.get("logIndex").and_then(|v| v.as_u64()).unwrap_or(0);

        info!(cycle_number, side, "SSE: received asset-trade-request event");

        Some(ChainEvent::AssetTradeRequest {
            cycle_number,
            asset,
            side,
            usdc_amount,
            price,
            quote_token,
            block_number,
            tx_hash,
            log_index,
        })
    }
}

fn parse_topic_u64(topic: &serde_json::Value) -> Option<u64> {
    let s = topic.as_str()?;
    let hex_str = s.strip_prefix("0x").unwrap_or(s);
    u64::from_str_radix(hex_str, 16).ok()
}

fn parse_topic_address(topic: &serde_json::Value) -> Option<[u8; 20]> {
    let s = topic.as_str()?;
    let hex_str = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(hex_str).ok()?;
    if bytes.len() < 20 {
        return None;
    }
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&bytes[bytes.len() - 20..]);
    Some(addr)
}
