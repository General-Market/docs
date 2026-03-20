//! HTTP client for data-node chain read endpoints
//!
//! When configured, replaces direct RPC calls for L3 chain state that the
//! data-node already caches. Falls back to direct RPC when not configured.
//!
//! Supported endpoints:
//! - `GET /chain/l3/active-oracle-count` -> `{ "active_oracle_count": u64 }`
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
struct ActiveOracleCountResponse {
    active_oracle_count: u64,
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

#[derive(Deserialize, Clone)]
pub struct MorphoMarketData {
    pub market_id: String,
    pub collateral_token: String,
    pub total_supply_assets: String,
    pub total_supply_shares: String,
    pub total_borrow_assets: String,
    pub total_borrow_shares: String,
    pub borrow_rate_per_second: String,
    pub lltv: String,
    pub oracle: String,
    pub last_update: u64,
}

#[derive(Deserialize)]
struct MorphoMarketsResponse {
    markets: Vec<MorphoMarketData>,
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

    /// GET /chain/l3/active-oracle-count
    pub async fn get_active_oracle_count(&self) -> Result<u64, DataNodeError> {
        let url = format!("{}/chain/l3/active-oracle-count", self.base_url);
        debug!(url = %url, "Fetching active oracle count from data-node");

        let resp: ActiveOracleCountResponse = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DataNodeError::Http(format!("{}: {}", url, e)))?
            .json()
            .await
            .map_err(|e| DataNodeError::Parse(format!("{}: {}", url, e)))?;

        Ok(resp.active_oracle_count)
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

    /// GET /morpho-markets
    pub async fn get_all_markets(&self) -> Result<Vec<MorphoMarketData>, DataNodeError> {
        let url = format!("{}/morpho-markets", self.base_url);
        debug!(url = %url, "Fetching Morpho markets from data-node");
        let resp: MorphoMarketsResponse = self.client.get(&url).send().await
            .map_err(|e| DataNodeError::Http(format!("{}: {}", url, e)))?
            .json().await
            .map_err(|e| DataNodeError::Parse(format!("{}: {}", url, e)))?;
        Ok(resp.markets)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_active_oracle_count_response() {
        let json = r#"{"active_oracle_count": 3}"#;
        let resp: ActiveOracleCountResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.active_oracle_count, 3);
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
    fn test_parse_morpho_markets_response() {
        let json = r#"{
            "markets": [{
                "market_id": "0xabc",
                "collateral_token": "0xdef",
                "total_supply_assets": "1000000",
                "total_supply_shares": "1000000",
                "total_borrow_assets": "500000",
                "total_borrow_shares": "500000",
                "borrow_rate_per_second": "158548960",
                "lltv": "860000000000000000",
                "oracle": "0x123",
                "last_update": 1711000000
            }]
        }"#;
        let resp: MorphoMarketsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.markets.len(), 1);
        assert_eq!(resp.markets[0].market_id, "0xabc");
        assert_eq!(resp.markets[0].last_update, 1711000000);
    }

    #[test]
    fn test_trailing_slash_stripped() {
        let client = DataNodeClient::new("http://localhost:8200/");
        assert_eq!(client.base_url, "http://localhost:8200");
    }
}
