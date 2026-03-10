//! NAV signature collector, BLS aggregation, and oracle pusher
//!
//! Implements the off-chain oracle collector pipeline:
//! 1. Request NAV signatures from issuer nodes via HTTP
//! 2. Validate consensus (price/cycleNumber agreement)
//! 3. Aggregate BLS signatures
//! 4. Push aggregated result to ITPNAVOracle contract

use crate::data_node_client::DataNodeClient;
use common::bls::Bn254BLSSigner;
use common::traits::BLSSigner;
use common::types::BLSSignature;
use ethers::prelude::*;
use ethers::types::{Address, TransactionRequest, U256};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tracing::{debug, warn};

/// Maximum HTTP response size (1 MB) to prevent OOM from malicious issuers
const MAX_RESPONSE_SIZE: u64 = 1_048_576;

/// Errors from the collector pipeline
#[derive(Debug, Error)]
pub enum CollectorError {
    #[error("HTTP request failed: {0}")]
    HttpError(String),

    #[error("JSON parse error: {0}")]
    JsonParseError(String),

    #[error("Threshold not met: received {received} of {required} required")]
    ThresholdNotMet { received: usize, required: usize },

    #[error("Price disagreement among issuers")]
    PriceDisagreement,

    #[error("Cycle number disagreement among issuers")]
    CycleNumberDisagreement,

    #[error("Signature aggregation failed: {0}")]
    SignatureAggregationFailed(String),

    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    #[error("Request timed out")]
    Timeout,
}

/// Errors from the oracle pusher
#[derive(Debug, Error)]
pub enum PushError {
    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Transaction failed: {0}")]
    Transaction(String),

    #[error("ABI encoding error: {0}")]
    AbiEncoding(String),
}

/// Response from an issuer's NAV sign endpoint
#[derive(Debug, Clone, Deserialize)]
pub struct NavSignResponse {
    #[serde(rename = "itpAddress")]
    pub itp_address: String,

    pub price: String,

    pub timestamp: u64,

    #[serde(rename = "cycleNumber")]
    pub cycle_number: u64,

    #[serde(rename = "blsSignature")]
    pub bls_signature: String,

    #[serde(rename = "issuerId")]
    pub issuer_id: u8,

    pub pubkey: String,
}

/// Result of collecting from all issuers
#[derive(Debug)]
pub struct CollectionResult {
    pub responses: Vec<NavSignResponse>,
    pub errors: Vec<(String, CollectorError)>,
}

/// Validated consensus data
#[derive(Debug, Clone)]
pub struct ConsensusResult {
    pub price: U256,
    pub timestamp: u64,
    pub cycle_number: u64,
    pub signer_ids: Vec<u8>,
}

/// Collects NAV signatures from issuer nodes
pub struct NavCollector {
    pub issuer_urls: Vec<String>,
    pub http_timeout: Duration,
}

impl NavCollector {
    pub fn new(issuer_urls: Vec<String>) -> Self {
        Self {
            issuer_urls,
            http_timeout: Duration::from_secs(10),
        }
    }

    /// Request NAV signature from a single issuer
    pub async fn request_nav_from_issuer(
        &self,
        url: &str,
        itp_address: Address,
    ) -> Result<NavSignResponse, CollectorError> {
        // Parse URL to extract host and port
        let url_trimmed = url
            .strip_prefix("http://")
            .unwrap_or(url);
        let (host, port) = if url_trimmed.starts_with('[') {
            // IPv6: [::1]:9001
            let bracket_end = url_trimmed
                .find(']')
                .ok_or_else(|| {
                    CollectorError::HttpError(
                        "Invalid IPv6 address: missing closing bracket".to_string(),
                    )
                })?;
            let host = &url_trimmed[..bracket_end + 1];
            let rest = &url_trimmed[bracket_end + 1..];
            let port = if let Some(port_str) = rest.strip_prefix(':') {
                port_str
                    .parse::<u16>()
                    .map_err(|e| CollectorError::HttpError(format!("Invalid port: {}", e)))?
            } else {
                80
            };
            (host.to_string(), port)
        } else if let Some(colon_pos) = url_trimmed.rfind(':') {
            let host = &url_trimmed[..colon_pos];
            let port: u16 = url_trimmed[colon_pos + 1..]
                .parse()
                .map_err(|e| CollectorError::HttpError(format!("Invalid port: {}", e)))?;
            (host.to_string(), port)
        } else {
            (url_trimmed.to_string(), 80)
        };

        let itp_hex = format!("{:?}", itp_address);

        let connect_result = tokio::time::timeout(
            self.http_timeout,
            TcpStream::connect(format!("{}:{}", host, port)),
        )
        .await
        .map_err(|_| CollectorError::Timeout)?
        .map_err(|e| CollectorError::HttpError(format!("TCP connect failed: {}", e)))?;

        let mut stream = connect_result;

        let request = format!(
            "GET /api/nav-sign?itp={} HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\n\r\n",
            itp_hex, host, port
        );

        tokio::time::timeout(self.http_timeout, stream.write_all(request.as_bytes()))
            .await
            .map_err(|_| CollectorError::Timeout)?
            .map_err(|e| CollectorError::HttpError(format!("Write failed: {}", e)))?;

        let mut buf = Vec::new();
        let mut limited = stream.take(MAX_RESPONSE_SIZE);
        tokio::time::timeout(self.http_timeout, limited.read_to_end(&mut buf))
            .await
            .map_err(|_| CollectorError::Timeout)?
            .map_err(|e| CollectorError::HttpError(format!("Read failed: {}", e)))?;

        let response_str = String::from_utf8_lossy(&buf);

        // Check HTTP status first, before attempting to parse body
        if let Some(status_line) = response_str.lines().next() {
            if !status_line.contains("200") {
                return Err(CollectorError::HttpError(format!(
                    "HTTP error: {}",
                    status_line
                )));
            }
        }

        // Reject unsupported chunked transfer encoding
        let headers_section = response_str.split("\r\n\r\n").next().unwrap_or("");
        if headers_section
            .to_lowercase()
            .contains("transfer-encoding: chunked")
        {
            return Err(CollectorError::InvalidResponse(
                "Chunked transfer encoding not supported".to_string(),
            ));
        }

        // Parse HTTP response: skip headers (find \r\n\r\n), extract JSON body
        let body = response_str
            .split("\r\n\r\n")
            .nth(1)
            .ok_or_else(|| CollectorError::InvalidResponse("No HTTP body found".to_string()))?;

        let nav_response: NavSignResponse = serde_json::from_str(body).map_err(|e| {
            CollectorError::JsonParseError(format!("Failed to parse response: {} body: {}", e, body))
        })?;

        Ok(nav_response)
    }

    /// Collect NAV signatures from all issuers concurrently
    pub async fn collect_all(
        &self,
        itp_address: Address,
    ) -> Result<CollectionResult, CollectorError> {
        let mut handles = Vec::new();

        for url in &self.issuer_urls {
            let url = url.clone();
            let itp = itp_address;
            let timeout = self.http_timeout;

            handles.push(tokio::spawn(async move {
                let tmp = NavCollector {
                    issuer_urls: vec![],
                    http_timeout: timeout,
                };
                let result = tmp.request_nav_from_issuer(&url, itp).await;
                (url, result)
            }));
        }

        let mut responses = Vec::new();
        let mut errors = Vec::new();

        for handle in handles {
            match handle.await {
                Ok((url, Ok(response))) => {
                    debug!(
                        issuer_id = response.issuer_id,
                        url = %url,
                        "Received NAV signature"
                    );
                    responses.push(response);
                }
                Ok((url, Err(e))) => {
                    warn!(url = %url, error = %e, "Failed to collect from issuer");
                    errors.push((url, e));
                }
                Err(e) => {
                    warn!(error = %e, "Task join error");
                    errors.push(("unknown".to_string(), CollectorError::HttpError(e.to_string())));
                }
            }
        }

        Ok(CollectionResult { responses, errors })
    }

    /// Validate that a quorum of responses agree on price and cycleNumber.
    ///
    /// Groups responses by (cycleNumber, price), picks the largest group that
    /// meets the BFT threshold, and returns consensus from that group.
    pub fn validate_consensus(
        responses: &[NavSignResponse],
        total_issuer_count: usize,
    ) -> Result<ConsensusResult, CollectorError> {
        let threshold = compute_threshold(total_issuer_count);

        if responses.len() < threshold {
            return Err(CollectorError::ThresholdNotMet {
                received: responses.len(),
                required: threshold,
            });
        }

        if responses.is_empty() {
            return Err(CollectorError::ThresholdNotMet {
                received: 0,
                required: 2,
            });
        }

        // Group by (cycle_number, price) and find the largest group
        let mut groups: std::collections::HashMap<(u64, &str), Vec<&NavSignResponse>> =
            std::collections::HashMap::new();
        for r in responses {
            groups
                .entry((r.cycle_number, r.price.as_str()))
                .or_default()
                .push(r);
        }

        // Pick the largest group that meets threshold
        let best_group = groups
            .into_values()
            .filter(|g| g.len() >= threshold)
            .max_by_key(|g| g.len());

        let group = best_group.ok_or_else(|| {
            // No group meets threshold — report most useful error
            let cycle_counts: std::collections::HashMap<u64, usize> =
                responses.iter().fold(std::collections::HashMap::new(), |mut m, r| {
                    *m.entry(r.cycle_number).or_default() += 1;
                    m
                });
            if cycle_counts.len() > 1 {
                CollectorError::CycleNumberDisagreement
            } else {
                CollectorError::PriceDisagreement
            }
        })?;

        let first = group[0];
        let price = U256::from_dec_str(&first.price)
            .map_err(|e| CollectorError::InvalidResponse(format!("Invalid price: {}", e)))?;

        let signer_ids: Vec<u8> = group.iter().map(|r| r.issuer_id).collect();

        Ok(ConsensusResult {
            price,
            timestamp: first.timestamp,
            cycle_number: first.cycle_number,
            signer_ids,
        })
    }

    /// Aggregate BLS signatures from responses
    pub fn aggregate_nav_signatures(
        responses: &[NavSignResponse],
    ) -> Result<(Vec<u8>, U256), CollectorError> {
        let signer = Bn254BLSSigner::new();

        let mut signatures = Vec::new();
        let mut signer_ids = Vec::new();

        for r in responses {
            let sig_bytes = parse_bls_signature(&r.bls_signature)?;
            signatures.push(BLSSignature(sig_bytes));
            signer_ids.push(r.issuer_id);
        }

        let aggregated = signer
            .aggregate_signatures(signatures)
            .map_err(|e| CollectorError::SignatureAggregationFailed(e.to_string()))?;

        let bitmask = compute_signers_bitmask(&signer_ids);

        Ok((aggregated.0, bitmask))
    }
}

/// Parse a hex-encoded BLS signature (with optional 0x prefix)
fn parse_bls_signature(hex_str: &str) -> Result<Vec<u8>, CollectorError> {
    let hex = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    let bytes = ethers::utils::hex::decode(hex)
        .map_err(|e| CollectorError::InvalidResponse(format!("Invalid signature hex: {}", e)))?;
    if bytes.len() != 64 {
        return Err(CollectorError::InvalidResponse(format!(
            "Signature must be 64 bytes, got {}",
            bytes.len()
        )));
    }
    Ok(bytes)
}

/// Compute signers bitmask from signer IDs
pub fn compute_signers_bitmask(signer_ids: &[u8]) -> U256 {
    let mut bitmask = U256::zero();
    for &id in signer_ids {
        bitmask = bitmask | (U256::one() << id);
    }
    bitmask
}

/// Compute BFT threshold: max(2, ceil(n * 2 / 3))
pub fn compute_threshold(issuer_count: usize) -> usize {
    std::cmp::max(2, (issuer_count * 2 + 2) / 3)
}

/// BLS-signed price data ready for on-chain submission
#[derive(Debug, Clone)]
pub struct BlsData {
    /// NAV price (Morpho-scaled, 36 decimals)
    pub price: U256,
    /// Issuer timestamp
    pub timestamp: u64,
    /// Cycle number
    pub cycle_number: u64,
    /// Aggregated BLS signature bytes
    pub signature: Vec<u8>,
    /// Signers bitmask
    pub bitmask: U256,
}

/// Cached BLS data with fetch timestamp
#[derive(Debug, Clone)]
pub struct CachedBlsData {
    pub data: BlsData,
    pub fetched_at: std::time::Instant,
}

impl CachedBlsData {
    /// Check if cached data is still fresh (< max_age)
    pub fn is_fresh(&self, max_age: Duration) -> bool {
        self.fetched_at.elapsed() < max_age
    }
}

/// On-demand BLS data provider with caching
pub struct OnDemandCollector {
    collector: NavCollector,
    cache: std::collections::HashMap<Address, CachedBlsData>,
    /// Maximum age before data is considered stale (default 2 min)
    pub cache_max_age: Duration,
    /// Minimum interval between on-demand fetches per ITP (rate limit, default 30s)
    pub fetch_cooldown: Duration,
    /// Last fetch time per ITP (for rate limiting)
    last_fetch: std::collections::HashMap<Address, std::time::Instant>,
}

impl OnDemandCollector {
    pub fn new(issuer_urls: Vec<String>) -> Self {
        Self {
            collector: NavCollector::new(issuer_urls),
            cache: std::collections::HashMap::new(),
            cache_max_age: Duration::from_secs(120), // 2 min
            fetch_cooldown: Duration::from_secs(30),  // 30s per ITP
            last_fetch: std::collections::HashMap::new(),
        }
    }

    /// Get BLS data, returning from cache if fresh, otherwise fetching on-demand
    pub async fn get_bls_data(
        &mut self,
        itp_address: Address,
    ) -> Result<BlsData, CollectorError> {
        // Check cache first
        if let Some(cached) = self.cache.get(&itp_address) {
            if cached.is_fresh(self.cache_max_age) {
                debug!(itp = ?itp_address, "Returning cached BLS data");
                return Ok(cached.data.clone());
            }
        }

        // Rate limit check
        if let Some(last) = self.last_fetch.get(&itp_address) {
            if last.elapsed() < self.fetch_cooldown {
                // Return stale cache if available, otherwise error
                if let Some(cached) = self.cache.get(&itp_address) {
                    warn!(itp = ?itp_address, "Rate limited, returning stale cached data");
                    return Ok(cached.data.clone());
                }
                return Err(CollectorError::HttpError(
                    "On-demand fetch rate limited and no cached data available".to_string(),
                ));
            }
        }

        // Fetch on-demand
        self.last_fetch.insert(itp_address, std::time::Instant::now());
        self.fetch_on_demand(itp_address).await
    }

    /// Immediate fetch from issuers (bypasses cache but respects rate limit)
    pub async fn fetch_on_demand(
        &mut self,
        itp_address: Address,
    ) -> Result<BlsData, CollectorError> {
        let total_issuers = self.collector.issuer_urls.len();
        let collection = self.collector.collect_all(itp_address).await?;
        let consensus = NavCollector::validate_consensus(&collection.responses, total_issuers)?;
        let (signature, bitmask) = NavCollector::aggregate_nav_signatures(&collection.responses)?;

        let data = BlsData {
            price: consensus.price,
            timestamp: consensus.timestamp,
            cycle_number: consensus.cycle_number,
            signature,
            bitmask,
        };

        // Update cache
        self.cache.insert(itp_address, CachedBlsData {
            data: data.clone(),
            fetched_at: std::time::Instant::now(),
        });

        Ok(data)
    }

    /// Update cache from a regular cadence collection (called by the existing collector loop)
    pub fn update_cache(&mut self, itp_address: Address, data: BlsData) {
        self.cache.insert(itp_address, CachedBlsData {
            data,
            fetched_at: std::time::Instant::now(),
        });
    }
}

/// Pushes prices to the ITPNAVOracle contract
pub struct OraclePusher {
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,
    oracle_address: Address,
    /// Optional data-node client for reading last cycle via HTTP instead of RPC
    data_node_client: Option<DataNodeClient>,
}

impl OraclePusher {
    pub fn new(
        rpc_url: &str,
        private_key: &str,
        oracle_address: Address,
    ) -> Result<Self, PushError> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| PushError::Provider(format!("Failed to create provider: {}", e)))?;

        let wallet: LocalWallet = private_key
            .parse()
            .map_err(|e| PushError::Provider(format!("Failed to parse private key: {}", e)))?;

        Ok(Self {
            provider: Arc::new(provider),
            wallet,
            oracle_address,
            data_node_client: None,
        })
    }

    /// Set data-node client for proxying L3 reads through the data-node HTTP API
    pub fn set_data_node_client(&mut self, client: DataNodeClient) {
        self.data_node_client = Some(client);
    }

    /// Read the lastCycleNumber — uses data-node if configured, otherwise direct RPC
    pub async fn read_last_cycle_number(&self) -> Result<u64, PushError> {
        // Try data-node first when configured
        if let Some(ref dn) = self.data_node_client {
            match dn.get_last_cycle().await {
                Ok(cycle) => {
                    debug!(cycle, "Last cycle via data-node");
                    return Ok(cycle);
                }
                Err(e) => {
                    warn!(error = %e, "Data-node last-cycle failed, falling back to RPC");
                }
            }
        }

        self.rpc_read_last_cycle_number().await
    }

    /// Read lastCycleNumber via direct RPC (fallback)
    async fn rpc_read_last_cycle_number(&self) -> Result<u64, PushError> {
        // Function selector for lastCycleNumber(): keccak256("lastCycleNumber()")[:4]
        let selector = &ethers::utils::keccak256(b"lastCycleNumber()")[..4];

        let tx = TransactionRequest::new()
            .to(self.oracle_address)
            .data(selector.to_vec());

        let result = self
            .provider
            .call(&tx.into(), None)
            .await
            .map_err(|e| PushError::Provider(format!("eth_call failed: {}", e)))?;

        if result.len() < 32 {
            return Ok(0);
        }

        let value = U256::from_big_endian(&result);
        Ok(value.as_u64())
    }

    /// Push a verified price to the oracle contract
    pub async fn push_price(
        &self,
        price: U256,
        timestamp: U256,
        cycle_number: U256,
        bls_signature: Vec<u8>,
        signers_bitmask: U256,
    ) -> Result<H256, PushError> {
        // Function selector for updatePrice(uint256,uint256,uint256,bytes,uint256)
        let selector =
            &ethers::utils::keccak256(b"updatePrice(uint256,uint256,uint256,bytes,uint256)")[..4];

        // ABI encode the parameters
        let encoded_params = ethers::abi::encode(&[
            ethers::abi::Token::Uint(price),
            ethers::abi::Token::Uint(timestamp),
            ethers::abi::Token::Uint(cycle_number),
            ethers::abi::Token::Bytes(bls_signature),
            ethers::abi::Token::Uint(signers_bitmask),
        ]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded_params);

        let chain_id = self
            .provider
            .get_chainid()
            .await
            .map_err(|e| PushError::Provider(format!("Failed to get chain ID: {}", e)))?;

        let wallet = self.wallet.clone().with_chain_id(chain_id.as_u64());

        let client = SignerMiddleware::new(self.provider.clone(), wallet);

        let tx = TransactionRequest::new()
            .to(self.oracle_address)
            .data(calldata);

        let pending_tx = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| PushError::Transaction(format!("Failed to send transaction: {}", e)))?;

        let tx_hash = pending_tx.tx_hash();

        // Wait for receipt with timeout
        let receipt = tokio::time::timeout(
            Duration::from_secs(60),
            pending_tx,
        )
        .await
        .map_err(|_| PushError::Transaction("Transaction receipt timeout (60s)".to_string()))?
        .map_err(|e| PushError::Transaction(format!("Failed to get receipt: {}", e)))?;

        match receipt {
            Some(receipt) => {
                if receipt.status == Some(1.into()) {
                    Ok(tx_hash)
                } else {
                    Err(PushError::Transaction(format!(
                        "Transaction reverted: tx={}",
                        tx_hash
                    )))
                }
            }
            None => Err(PushError::Transaction(format!(
                "No receipt for tx={}",
                tx_hash
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_consensus_all_agree() {
        let responses = vec![
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"ab".repeat(64),
                issuer_id: 0,
                pubkey: "0x".to_string() + &"cd".repeat(128),
            },
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"ef".repeat(64),
                issuer_id: 1,
                pubkey: "0x".to_string() + &"01".repeat(128),
            },
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"23".repeat(64),
                issuer_id: 2,
                pubkey: "0x".to_string() + &"45".repeat(128),
            },
        ];

        let result = NavCollector::validate_consensus(&responses, 3).unwrap();
        assert_eq!(result.price, U256::from_dec_str("1000000000000000000000000000000000000").unwrap());
        assert_eq!(result.cycle_number, 42);
        assert_eq!(result.signer_ids, vec![0, 1, 2]);
    }

    #[test]
    fn test_validate_consensus_price_disagreement() {
        let responses = vec![
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"ab".repeat(64),
                issuer_id: 0,
                pubkey: "0x".to_string() + &"cd".repeat(128),
            },
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "2000000000000000000000000000000000000".to_string(), // Different!
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"ef".repeat(64),
                issuer_id: 1,
                pubkey: "0x".to_string() + &"01".repeat(128),
            },
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"23".repeat(64),
                issuer_id: 2,
                pubkey: "0x".to_string() + &"45".repeat(128),
            },
        ];

        let result = NavCollector::validate_consensus(&responses, 3);
        assert!(matches!(result, Err(CollectorError::PriceDisagreement)));
    }

    #[test]
    fn test_validate_consensus_cycle_disagreement() {
        let responses = vec![
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"ab".repeat(64),
                issuer_id: 0,
                pubkey: "0x".to_string() + &"cd".repeat(128),
            },
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 43, // Different!
                bls_signature: "0x".to_string() + &"ef".repeat(64),
                issuer_id: 1,
                pubkey: "0x".to_string() + &"01".repeat(128),
            },
        ];

        let result = NavCollector::validate_consensus(&responses, 3);
        assert!(matches!(result, Err(CollectorError::CycleNumberDisagreement)));
    }

    #[test]
    fn test_threshold_not_met() {
        let responses = vec![
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"ab".repeat(64),
                issuer_id: 0,
                pubkey: "0x".to_string() + &"cd".repeat(128),
            },
        ];

        let result = NavCollector::validate_consensus(&responses, 3);
        assert!(matches!(result, Err(CollectorError::ThresholdNotMet { .. })));
    }

    #[test]
    fn test_threshold_met_with_2_of_3() {
        let responses = vec![
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"ab".repeat(64),
                issuer_id: 0,
                pubkey: "0x".to_string() + &"cd".repeat(128),
            },
            NavSignResponse {
                itp_address: "0x1234567890123456789012345678901234567890".to_string(),
                price: "1000000000000000000000000000000000000".to_string(),
                timestamp: 1706886400,
                cycle_number: 42,
                bls_signature: "0x".to_string() + &"ef".repeat(64),
                issuer_id: 1,
                pubkey: "0x".to_string() + &"01".repeat(128),
            },
        ];

        let result = NavCollector::validate_consensus(&responses, 3);
        assert!(result.is_ok());
    }

    #[test]
    fn test_compute_signers_bitmask() {
        assert_eq!(compute_signers_bitmask(&[0, 1, 2]), U256::from(0x07));
        assert_eq!(compute_signers_bitmask(&[0, 2]), U256::from(0x05));
        assert_eq!(compute_signers_bitmask(&[1]), U256::from(0x02));
    }

    #[test]
    fn test_compute_threshold() {
        assert_eq!(compute_threshold(3), 2); // 3 issuers → 2 needed
        assert_eq!(compute_threshold(5), 4); // 5 issuers → 4 needed
        assert_eq!(compute_threshold(10), 7); // 10 issuers → 7 needed
        assert_eq!(compute_threshold(1), 2); // min 2
        assert_eq!(compute_threshold(2), 2); // 2 issuers → 2 needed
    }

    #[test]
    fn test_aggregate_signatures_with_real_bls() {
        use common::bls::{aggregate_pubkeys, BLSKeyPair, Bn254BLSSigner};

        let kp1 = BLSKeyPair::from_seed(&[1u8; 32]).unwrap();
        let kp2 = BLSKeyPair::from_seed(&[2u8; 32]).unwrap();
        let kp3 = BLSKeyPair::from_seed(&[3u8; 32]).unwrap();

        let signer = Bn254BLSSigner::new();

        // Compute message hash (same as issuer does)
        let itp_address: Address = "0x1234567890123456789012345678901234567890"
            .parse()
            .unwrap();
        let price = U256::exp10(36);
        let timestamp = 1706886400u64;
        let cycle_number = 42u64;

        let message_hash =
            issuer::api::build_nav_message_hash(itp_address, price, timestamp, cycle_number);

        // Sign with each key
        let sig1 = signer.sign_message_hash(&kp1, &message_hash).unwrap();
        let sig2 = signer.sign_message_hash(&kp2, &message_hash).unwrap();
        let sig3 = signer.sign_message_hash(&kp3, &message_hash).unwrap();

        // Build NavSignResponse structs
        let responses = vec![
            NavSignResponse {
                itp_address: format!("{:?}", itp_address),
                price: price.to_string(),
                timestamp,
                cycle_number,
                bls_signature: format!("0x{}", ethers::utils::hex::encode(&sig1.0)),
                issuer_id: 0,
                pubkey: format!("0x{}", ethers::utils::hex::encode(&kp1.public_key().0)),
            },
            NavSignResponse {
                itp_address: format!("{:?}", itp_address),
                price: price.to_string(),
                timestamp,
                cycle_number,
                bls_signature: format!("0x{}", ethers::utils::hex::encode(&sig2.0)),
                issuer_id: 1,
                pubkey: format!("0x{}", ethers::utils::hex::encode(&kp2.public_key().0)),
            },
            NavSignResponse {
                itp_address: format!("{:?}", itp_address),
                price: price.to_string(),
                timestamp,
                cycle_number,
                bls_signature: format!("0x{}", ethers::utils::hex::encode(&sig3.0)),
                issuer_id: 2,
                pubkey: format!("0x{}", ethers::utils::hex::encode(&kp3.public_key().0)),
            },
        ];

        // Aggregate
        let (agg_sig_bytes, bitmask) = NavCollector::aggregate_nav_signatures(&responses).unwrap();
        assert_eq!(agg_sig_bytes.len(), 64);
        assert_eq!(bitmask, U256::from(0x07)); // bits 0,1,2

        // Verify aggregated signature against aggregated pubkey
        let agg_pk =
            aggregate_pubkeys(&[kp1.public_key(), kp2.public_key(), kp3.public_key()]).unwrap();

        let agg_sig = BLSSignature(agg_sig_bytes);
        let valid = signer
            .verify_message_hash(&agg_pk, &message_hash, &agg_sig)
            .unwrap();
        assert!(valid, "Aggregated signature should verify");
    }
}
