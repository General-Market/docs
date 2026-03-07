//! HTTP client for data-node chain read endpoints
//!
//! When configured, replaces direct RPC calls for L3 chain state that the
//! data-node already caches. Falls back to direct RPC when not configured.
//!
//! Supported endpoints:
//! - `GET /chain/l3/active-issuer-count` -> `{ "active_issuer_count": u64 }`
//! - `GET /chain/l3/aggregated-pubkey`   -> `{ "pubkey": "0x..." }`
//! - `GET /chain/l3/consensus-paused`    -> `{ "paused": bool }`
//! - `GET /chain/l3/last-cycle`          -> `{ "cycle": u64 }`

use serde::Deserialize;
use thiserror::Error;
use tracing::debug;

/// Errors from data-node HTTP calls
#[derive(Debug, Error)]
pub enum DataNodeError {
    #[error("HTTP request failed: {0}")]
    Http(String),

    #[error("Failed to parse response: {0}")]
    Parse(String),
}

/// Thin HTTP client for data-node chain read endpoints
#[derive(Clone)]
pub struct DataNodeClient {
    base_url: String,
    client: reqwest::Client,
}

#[derive(Deserialize)]
struct ActiveIssuerCountResponse {
    active_issuer_count: u64,
}

#[derive(Deserialize)]
struct AggregatedPubkeyResponse {
    pubkey: String,
}

#[derive(Deserialize)]
struct ConsensusPausedResponse {
    paused: bool,
}

#[derive(Deserialize)]
struct LastCycleResponse {
    cycle: u64,
}

impl DataNodeClient {
    /// Create a new DataNodeClient pointed at the given data-node base URL
    pub fn new(base_url: &str) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client,
        }
    }

    /// GET /chain/l3/active-issuer-count
    pub async fn get_active_issuer_count(&self) -> Result<u64, DataNodeError> {
        let url = format!("{}/chain/l3/active-issuer-count", self.base_url);
        debug!(url = %url, "Fetching active issuer count from data-node");

        let resp: ActiveIssuerCountResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DataNodeError::Http(format!("{}: {}", url, e)))?
            .json()
            .await
            .map_err(|e| DataNodeError::Parse(format!("{}: {}", url, e)))?;

        Ok(resp.active_issuer_count)
    }

    /// GET /chain/l3/aggregated-pubkey
    pub async fn get_aggregated_pubkey(&self) -> Result<Vec<u8>, DataNodeError> {
        let url = format!("{}/chain/l3/aggregated-pubkey", self.base_url);
        debug!(url = %url, "Fetching aggregated pubkey from data-node");

        let resp: AggregatedPubkeyResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DataNodeError::Http(format!("{}: {}", url, e)))?
            .json()
            .await
            .map_err(|e| DataNodeError::Parse(format!("{}: {}", url, e)))?;

        let hex_str = resp.pubkey.strip_prefix("0x").unwrap_or(&resp.pubkey);
        let bytes = hex::decode(hex_str)
            .map_err(|e| DataNodeError::Parse(format!("Invalid pubkey hex: {}", e)))?;

        Ok(bytes)
    }

    /// GET /chain/l3/consensus-paused
    pub async fn is_consensus_paused(&self) -> Result<bool, DataNodeError> {
        let url = format!("{}/chain/l3/consensus-paused", self.base_url);
        debug!(url = %url, "Fetching consensus paused from data-node");

        let resp: ConsensusPausedResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DataNodeError::Http(format!("{}: {}", url, e)))?
            .json()
            .await
            .map_err(|e| DataNodeError::Parse(format!("{}: {}", url, e)))?;

        Ok(resp.paused)
    }

    /// GET /chain/l3/last-cycle
    pub async fn get_last_cycle(&self) -> Result<u64, DataNodeError> {
        let url = format!("{}/chain/l3/last-cycle", self.base_url);
        debug!(url = %url, "Fetching last cycle from data-node");

        let resp: LastCycleResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DataNodeError::Http(format!("{}: {}", url, e)))?
            .json()
            .await
            .map_err(|e| DataNodeError::Parse(format!("{}: {}", url, e)))?;

        Ok(resp.cycle)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_active_issuer_count_response() {
        let json = r#"{"active_issuer_count": 3}"#;
        let resp: ActiveIssuerCountResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.active_issuer_count, 3);
    }

    #[test]
    fn test_parse_aggregated_pubkey_response() {
        let json = r#"{"pubkey": "0xabcdef"}"#;
        let resp: AggregatedPubkeyResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.pubkey, "0xabcdef");
    }

    #[test]
    fn test_parse_consensus_paused_response() {
        let json = r#"{"paused": false}"#;
        let resp: ConsensusPausedResponse = serde_json::from_str(json).unwrap();
        assert!(!resp.paused);
    }

    #[test]
    fn test_parse_last_cycle_response() {
        let json = r#"{"cycle": 42}"#;
        let resp: LastCycleResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.cycle, 42);
    }

    #[test]
    fn test_trailing_slash_stripped() {
        let client = DataNodeClient::new("http://localhost:8200/");
        assert_eq!(client.base_url, "http://localhost:8200");
    }
}
