//! SSE (Server-Sent Events) client for consuming chain events from data-node.
//!
//! Connects to `{data_node_url}/sse/chain-events?topics=...` and parses the
//! text/event-stream format into `ChainEvent` variants that feed into the AP's
//! existing event processing pipeline via an mpsc channel.

use std::time::Duration;

use common::traits::ChainEvent;
use ethers::types::U256;
use futures::StreamExt;
use reqwest::Client;
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
    client: Client,
}

impl SseChainEventClient {
    /// Create a new SSE client for chain events.
    ///
    /// # Arguments
    /// * `base_url` - data-node base URL (e.g., "http://localhost:8200")
    /// * `topics` - event types to subscribe to (e.g., ["order-submitted", "fill-confirmed"])
    pub fn new(base_url: String, topics: Vec<String>) -> Self {
        let client = Client::builder()
            .no_proxy() // SSE streams must not use system proxy
            .build()
            .expect("failed to build HTTP client for SSE");
        Self {
            base_url,
            topics,
            client,
        }
    }

    /// Build the SSE endpoint URL with topic filter.
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

    /// Connect to the SSE stream and forward parsed events to the sender.
    ///
    /// This method runs indefinitely, reconnecting with exponential backoff on
    /// disconnect. It should be spawned as a background task.
    pub async fn run(self, tx: mpsc::Sender<ChainEvent>) {
        let mut backoff = Duration::from_secs(1);
        let max_backoff = Duration::from_secs(60);

        loop {
            let url = self.sse_url();
            info!(url = %url, "Connecting to data-node SSE chain-events stream");

            match self.connect_and_consume(&url, &tx).await {
                Ok(()) => {
                    info!("SSE stream ended cleanly");
                    // Clean end, short backoff before reconnect
                    backoff = Duration::from_secs(1);
                }
                Err(e) => {
                    warn!(
                        error = %e,
                        backoff_secs = backoff.as_secs(),
                        "SSE connection failed, will reconnect"
                    );
                }
            }

            // Check if the sender is closed (AP shutting down)
            if tx.is_closed() {
                info!("SSE client stopping: event channel closed");
                break;
            }

            tokio::time::sleep(backoff).await;
            backoff = std::cmp::min(backoff * 2, max_backoff);
        }
    }

    /// Connect to the SSE endpoint and consume events until the stream ends or errors.
    async fn connect_and_consume(
        &self,
        url: &str,
        tx: &mpsc::Sender<ChainEvent>,
    ) -> Result<(), String> {
        let response = self
            .client
            .get(url)
            .header("Accept", "text/event-stream")
            .send()
            .await
            .map_err(|e| format!("SSE connect failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "SSE endpoint returned status {}",
                response.status()
            ));
        }

        info!("SSE stream connected to data-node");

        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        let mut current_event_type = String::new();
        let mut current_data = String::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("SSE stream error: {}", e))?;
            let text = String::from_utf8_lossy(&chunk);
            buffer.push_str(&text);

            // Process complete lines from the buffer
            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim_end_matches('\r').to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() {
                    // Empty line = end of event, dispatch if we have data
                    if !current_data.is_empty() {
                        if let Some(chain_event) =
                            self.parse_sse_event(&current_event_type, &current_data)
                        {
                            if tx.send(chain_event).await.is_err() {
                                return Ok(()); // Channel closed
                            }
                        }
                    }
                    current_event_type.clear();
                    current_data.clear();
                } else if let Some(event_name) = line.strip_prefix("event:") {
                    current_event_type = event_name.trim().to_string();
                } else if let Some(data_content) = line.strip_prefix("data:") {
                    if !current_data.is_empty() {
                        current_data.push('\n');
                    }
                    current_data.push_str(data_content.trim());
                } else if line.starts_with(':') {
                    // SSE comment (e.g., ":ping"), ignore
                    debug!(comment = %line, "SSE keepalive/comment");
                }
            }
        }

        Ok(())
    }

    /// Parse an SSE event into a `ChainEvent`.
    ///
    /// The `event_type` comes from the SSE `event:` field (e.g., "order-submitted").
    /// The `data` is the JSON-serialized `ChainEventEnvelope`.
    fn parse_sse_event(&self, event_type: &str, data: &str) -> Option<ChainEvent> {
        let envelope: ChainEventEnvelope = match serde_json::from_str(data) {
            Ok(e) => e,
            Err(e) => {
                warn!(
                    event_type,
                    error = %e,
                    data_preview = &data[..data.len().min(200)],
                    "Failed to parse SSE event envelope"
                );
                return None;
            }
        };

        // Only process L3 chain events
        if envelope.chain != "l3" {
            debug!(
                chain = %envelope.chain,
                event_type = %envelope.event_type,
                "Ignoring non-L3 chain event"
            );
            return None;
        }

        match envelope.event_type.as_str() {
            "order-submitted" => self.parse_order_submitted(&envelope),
            "fill-confirmed" => self.parse_fill_confirmed(&envelope),
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

    /// Parse an "order-submitted" event from the log data.
    ///
    /// Event: OrderSubmitted(uint256 indexed orderId, address indexed user, bytes32 indexed itpId,
    ///         bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline)
    ///
    /// 3 indexed fields → topics[1..3], 6 non-indexed fields → 192 bytes data.
    fn parse_order_submitted(&self, envelope: &ChainEventEnvelope) -> Option<ChainEvent> {
        let log_data = &envelope.data;

        let topics = log_data.get("topics")?.as_array()?;
        if topics.len() < 4 {
            warn!("order-submitted: expected >= 4 topics, got {}", topics.len());
            return None;
        }

        // topic[1] = orderId (indexed)
        let order_id = parse_topic_u64(topics.get(1)?)?;
        // topic[2] = user (indexed, address in 32-byte topic)
        let user = parse_topic_address(topics.get(2)?)?;
        // topic[3] = itpId (indexed, bytes32)
        let itp_topic = topics.get(3)?.as_str()?;
        let itp_hex = itp_topic.strip_prefix("0x").unwrap_or(itp_topic);
        let itp_bytes = hex::decode(itp_hex).ok()?;
        let mut itp_id = [0u8; 32];
        if itp_bytes.len() >= 32 {
            itp_id.copy_from_slice(&itp_bytes[..32]);
        }

        // data: pairId(32) + side(32) + amount(32) + limitPrice(32) + slippageTier(32) + deadline(32) = 192 bytes
        let data_hex = log_data.get("data")?.as_str()?;
        let data_bytes = hex::decode(data_hex.strip_prefix("0x").unwrap_or(data_hex)).ok()?;
        if data_bytes.len() < 192 {
            warn!(
                "order-submitted: data too short ({}), expected >= 192",
                data_bytes.len()
            );
            return None;
        }

        Some(ChainEvent::OrderSubmitted {
            order_id,
            user,
            itp_id,
        })
    }

    /// Parse a "fill-confirmed" event from the log data.
    ///
    /// Event: FillConfirmed(uint256 indexed orderId, uint256 fillPrice, uint256 fillAmount, uint256 cycleNumber)
    fn parse_fill_confirmed(&self, envelope: &ChainEventEnvelope) -> Option<ChainEvent> {
        let log_data = &envelope.data;

        let topics = log_data.get("topics")?.as_array()?;
        if topics.len() < 2 {
            warn!(
                "fill-confirmed: expected >= 2 topics, got {}",
                topics.len()
            );
            return None;
        }

        // topic[1] = orderId (indexed)
        let order_id = parse_topic_u64(topics.get(1)?)?;

        // data: fillPrice(32) + fillAmount(32) + cycleNumber(32)
        let data_hex = log_data.get("data")?.as_str()?;
        let data_bytes = hex::decode(data_hex.strip_prefix("0x").unwrap_or(data_hex)).ok()?;
        if data_bytes.len() < 64 {
            warn!(
                "fill-confirmed: data too short ({}), expected >= 64",
                data_bytes.len()
            );
            return None;
        }

        let fill_price = U256::from_big_endian(&data_bytes[0..32]);
        let fill_amount = U256::from_big_endian(&data_bytes[32..64]);

        Some(ChainEvent::FillConfirmed {
            order_id,
            fill_price,
            fill_amount,
        })
    }
}

// ---- Parsing helpers ----

/// Parse a hex topic string (e.g., "0x000...0042") into a u64.
fn parse_topic_u64(topic: &serde_json::Value) -> Option<u64> {
    let s = topic.as_str()?;
    let hex_str = s.strip_prefix("0x").unwrap_or(s);
    u64::from_str_radix(hex_str, 16).ok()
}

/// Parse a hex topic string into a 20-byte address (last 20 bytes of 32-byte topic).
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

/// Parse a hex string into a 32-byte array.
#[allow(dead_code)]
fn parse_hex_bytes32(s: &str) -> [u8; 32] {
    let hex_str = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(hex_str).unwrap_or_else(|_| vec![0u8; 32]);
    let mut result = [0u8; 32];
    let len = bytes.len().min(32);
    result[32 - len..].copy_from_slice(&bytes[..len]);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_topic_u64() {
        let val = serde_json::json!(
            "0x000000000000000000000000000000000000000000000000000000000000002a"
        );
        assert_eq!(parse_topic_u64(&val), Some(42));
    }

    #[test]
    fn test_parse_topic_address() {
        let val = serde_json::json!(
            "0x000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
        );
        let addr = parse_topic_address(&val).unwrap();
        assert_eq!(&addr[..4], &[0xde, 0xad, 0xbe, 0xef]);
    }

    #[test]
    fn test_sse_url_no_topics() {
        let client = SseChainEventClient::new("http://localhost:8200".into(), vec![]);
        assert_eq!(client.sse_url(), "http://localhost:8200/sse/chain-events");
    }

    #[test]
    fn test_sse_url_with_topics() {
        let client = SseChainEventClient::new(
            "http://localhost:8200".into(),
            vec![
                "order-submitted".into(),
                "fill-confirmed".into(),
            ],
        );
        assert_eq!(
            client.sse_url(),
            "http://localhost:8200/sse/chain-events?topics=order-submitted,fill-confirmed"
        );
    }

    #[test]
    fn test_parse_fill_confirmed() {
        let client = SseChainEventClient::new("http://test".into(), vec![]);

        // Construct a fill-confirmed envelope
        let mut fill_price_bytes = [0u8; 32];
        U256::from(1_000_000_000_000_000_000u64).to_big_endian(&mut fill_price_bytes);
        let mut fill_amount_bytes = [0u8; 32];
        U256::from(500u64).to_big_endian(&mut fill_amount_bytes);

        let mut data = Vec::new();
        data.extend_from_slice(&fill_price_bytes);
        data.extend_from_slice(&fill_amount_bytes);

        let envelope = ChainEventEnvelope {
            event_type: "fill-confirmed".into(),
            chain: "l3".into(),
            block_number: 100,
            data: serde_json::json!({
                "topics": [
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                    "0x0000000000000000000000000000000000000000000000000000000000000005"
                ],
                "data": format!("0x{}", hex::encode(&data)),
                "blockNumber": 100,
                "transactionHash": "0x0000000000000000000000000000000000000000000000000000000000000001",
                "logIndex": 0
            }),
        };

        let result = client.parse_fill_confirmed(&envelope);
        assert!(result.is_some());

        if let Some(ChainEvent::FillConfirmed {
            order_id,
            fill_price,
            fill_amount,
        }) = result
        {
            assert_eq!(order_id, 5);
            assert_eq!(fill_price, U256::from(1_000_000_000_000_000_000u64));
            assert_eq!(fill_amount, U256::from(500u64));
        } else {
            panic!("Expected FillConfirmed");
        }
    }
}
