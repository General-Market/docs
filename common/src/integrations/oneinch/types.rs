//! Types for 1inch API requests and responses

use serde::{Deserialize, Serialize};

/// Supported chains for 1inch integration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SupportedChain {
    /// Ethereum Mainnet (Chain ID: 1)
    Ethereum,
    /// Arbitrum One (Chain ID: 42161)
    Arbitrum,
    /// Base (Chain ID: 8453)
    Base,
    /// Optimism (Chain ID: 10)
    Optimism,
}

impl SupportedChain {
    /// Returns the numeric chain ID
    pub fn chain_id(&self) -> u64 {
        match self {
            Self::Ethereum => 1,
            Self::Arbitrum => 42161,
            Self::Base => 8453,
            Self::Optimism => 10,
        }
    }

    /// Returns the 1inch API quote endpoint URL for this chain
    pub fn quote_url(&self) -> String {
        format!(
            "https://api.1inch.dev/swap/v6.0/{}/quote",
            self.chain_id()
        )
    }

    /// Try to create a SupportedChain from a chain ID
    pub fn from_chain_id(chain_id: u64) -> Option<Self> {
        match chain_id {
            1 => Some(Self::Ethereum),
            42161 => Some(Self::Arbitrum),
            8453 => Some(Self::Base),
            10 => Some(Self::Optimism),
            _ => None,
        }
    }
}

/// Request parameters for getting a quote from 1inch
#[derive(Debug, Clone)]
pub struct QuoteRequest {
    /// Source token address (checksummed)
    pub from_token: String,
    /// Destination token address (checksummed)
    pub to_token: String,
    /// Amount in smallest unit (wei)
    pub amount: String,
    /// Chain to execute on
    pub chain: SupportedChain,
}

/// Protocol routing information from 1inch
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Protocol {
    /// Protocol name (e.g., "UNISWAP_V3")
    pub name: String,
    /// Percentage of the trade routed through this protocol (0-100)
    pub part: u32,
    /// Source token address for this leg
    pub from_token_address: String,
    /// Destination token address for this leg
    pub to_token_address: String,
}

/// Response from 1inch quote API
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteResponse {
    /// Destination amount in smallest unit (wei)
    pub dst_amount: String,
    /// Estimated gas for the swap
    pub gas: u64,
    /// Routing protocols used (nested array structure)
    /// Structure: [[[Protocol]]] - routes -> steps -> parts
    #[serde(default)]
    pub protocols: Vec<Vec<Vec<Protocol>>>,
}

/// Simplified quote result returned to callers
#[derive(Debug, Clone)]
pub struct Quote {
    /// Amount to receive in smallest unit (wei)
    pub to_amount: String,
    /// Estimated gas for execution
    pub estimated_gas: u64,
    /// Protocols used for routing (flattened)
    pub protocols: Vec<Protocol>,
}

impl From<QuoteResponse> for Quote {
    fn from(response: QuoteResponse) -> Self {
        // Flatten the nested protocol structure
        let protocols: Vec<Protocol> = response
            .protocols
            .into_iter()
            .flatten()
            .flatten()
            .collect();

        Self {
            to_amount: response.dst_amount,
            estimated_gas: response.gas,
            protocols,
        }
    }
}

/// 1inch API error response format
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiErrorResponse {
    /// Error message
    pub error: String,
    /// HTTP status code
    pub status_code: u16,
    /// Detailed description
    #[serde(default)]
    pub description: Option<String>,
}

/// Parameters for building a swap transaction
#[derive(Debug, Clone)]
pub struct SwapParams {
    /// Source token address (checksummed)
    pub from_token: String,
    /// Destination token address (checksummed)
    pub to_token: String,
    /// Amount in smallest unit (wei)
    pub amount: String,
    /// Minimum return amount (slippage protection)
    pub min_return: String,
    /// Recipient address (custody address)
    pub recipient: String,
    /// Slippage tolerance in percentage (e.g., "1" for 1%)
    pub slippage: String,
    /// Allow partial fills for large orders
    pub allow_partial_fill: bool,
    /// Skip estimation to reduce latency
    pub disable_estimate: bool,
}

impl SwapParams {
    /// Create new swap params with sensible defaults
    pub fn new(
        from_token: String,
        to_token: String,
        amount: String,
        min_return: String,
        recipient: String,
    ) -> Self {
        Self {
            from_token,
            to_token,
            amount,
            min_return,
            recipient,
            slippage: "1".to_string(), // 1% default
            allow_partial_fill: true,
            disable_estimate: true,
        }
    }

    /// Set custom slippage tolerance
    pub fn with_slippage(mut self, slippage: impl Into<String>) -> Self {
        self.slippage = slippage.into();
        self
    }

    /// Set allow partial fill flag
    pub fn with_partial_fill(mut self, allow: bool) -> Self {
        self.allow_partial_fill = allow;
        self
    }

    /// Set disable estimate flag
    pub fn with_disable_estimate(mut self, disable: bool) -> Self {
        self.disable_estimate = disable;
        self
    }
}

/// Transaction data from 1inch swap API response
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapTxData {
    /// Sender address
    pub from: String,
    /// Router address (target)
    pub to: String,
    /// Encoded swap calldata
    pub data: String,
    /// ETH value to send (usually "0" for token swaps)
    pub value: String,
    /// Estimated gas limit
    #[serde(default)]
    pub gas: Option<u64>,
}

/// Response from 1inch swap API
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapResponse {
    /// Amount to receive in smallest unit (wei)
    pub to_amount: String,
    /// Transaction data for execution
    pub tx: SwapTxData,
}

/// Parameters for BLSCustody.execute() call
#[derive(Debug, Clone)]
pub struct CustodyExecuteParams {
    /// Target contract address (1inch Router)
    pub target: ethers::types::Address,
    /// Encoded calldata for the target
    pub data: Vec<u8>,
    /// Unique nonce for replay protection (bitmap pattern)
    pub nonce: ethers::types::U256,
    /// Message hash to be BLS-signed (32 bytes)
    pub message_to_sign: [u8; 32],
}

/// Configuration for 1inch swap builder
#[derive(Clone)]
pub struct OneInchConfig {
    /// API key for 1inch API (required for production)
    pub api_key: String,
    /// Target chain ID
    pub chain_id: u64,
    /// BLSCustody contract address on this chain
    pub custody_address: ethers::types::Address,
    /// HTTP request timeout
    pub timeout: std::time::Duration,
    /// Base URL for 1inch API (configurable for testing)
    pub base_url: String,
}

// Custom Debug that redacts API key
impl std::fmt::Debug for OneInchConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OneInchConfig")
            .field("api_key", &"[REDACTED]")
            .field("chain_id", &self.chain_id)
            .field("custody_address", &self.custody_address)
            .field("timeout", &self.timeout)
            .field("base_url", &self.base_url)
            .finish()
    }
}

/// Default 1inch API base URL
pub const ONEINCH_API_BASE_URL: &str = "https://api.1inch.dev";

impl OneInchConfig {
    /// Create new config with defaults
    pub fn new(
        api_key: String,
        chain_id: u64,
        custody_address: ethers::types::Address,
    ) -> Self {
        Self {
            api_key,
            chain_id,
            custody_address,
            timeout: std::time::Duration::from_secs(10),
            base_url: ONEINCH_API_BASE_URL.to_string(),
        }
    }

    /// Set custom timeout
    pub fn with_timeout(mut self, timeout: std::time::Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Set custom base URL (useful for testing with mock servers)
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }
}

// =============================================================================
// Fusion+ Types for Cross-Chain Swaps
// =============================================================================

/// Special chain identifier for Solana (non-EVM)
pub const SOLANA_CHAIN_ID: u64 = 1399811149; // 'SOL\x00' as u64

/// Configuration for Fusion+ client
#[derive(Clone)]
pub struct FusionPlusConfig {
    /// API key for 1inch Fusion+ API
    pub api_key: String,
    /// Base URL for Fusion+ API
    pub base_url: String,
    /// HTTP request timeout
    pub timeout: std::time::Duration,
    /// Backoff delays in milliseconds for rate-limit retries (default: [1000, 2000, 4000, 8000, 16000])
    pub backoff_ms: Vec<u64>,
}

// Custom Debug that redacts API key (H1 fix)
impl std::fmt::Debug for FusionPlusConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FusionPlusConfig")
            .field("api_key", &"[REDACTED]")
            .field("base_url", &self.base_url)
            .field("timeout", &self.timeout)
            .field("backoff_ms", &self.backoff_ms)
            .finish()
    }
}

/// Default backoff sequence: 1s, 2s, 4s, 8s, 16s
pub const DEFAULT_BACKOFF_MS: [u64; 5] = [1000, 2000, 4000, 8000, 16000];

impl Default for FusionPlusConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: "https://api.1inch.dev/fusion-plus/v1.0".to_string(),
            timeout: std::time::Duration::from_secs(30),
            backoff_ms: DEFAULT_BACKOFF_MS.to_vec(),
        }
    }
}

impl FusionPlusConfig {
    /// Create a new config with the given API key
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            ..Default::default()
        }
    }

    /// Set custom base URL (useful for testing)
    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into();
        self
    }

    /// Set custom timeout
    pub fn with_timeout(mut self, timeout: std::time::Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Set custom backoff delays (useful for testing with short delays)
    pub fn with_backoff_ms(mut self, backoff_ms: Vec<u64>) -> Self {
        self.backoff_ms = backoff_ms;
        self
    }
}

/// Cross-chain swap intent for Fusion+
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusionIntent {
    /// Unique order hash identifier
    pub order_hash: String,
    /// Source chain ID
    pub src_chain_id: u64,
    /// Destination chain ID
    pub dst_chain_id: u64,
    /// Source token address
    pub src_token: String,
    /// Destination token address
    pub dst_token: String,
    /// Amount to swap (in smallest units)
    pub amount: String,
    /// Minimum amount to receive (slippage protection)
    pub min_return: String,
    /// Deadline as Unix timestamp
    pub deadline: u64,
    /// Receiver address on destination chain
    pub receiver: String,
}

/// Intent status for tracking cross-chain swaps
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IntentStatus {
    /// Intent created, awaiting resolver match
    Pending,
    /// Resolver has matched the intent
    Matched {
        /// Resolver address that matched
        resolver: String,
    },
    /// Execution in progress on destination chain
    Settling {
        /// Resolver address executing
        resolver: String,
    },
    /// Successfully completed
    Completed {
        /// Transaction hash on destination chain
        dst_tx_hash: String,
        /// Actual amount received
        dst_amount: String,
        /// Resolver that filled the order
        resolver: String,
        /// Settlement timestamp (Unix)
        settled_at: u64,
    },
    /// Settlement failed
    Failed {
        /// Reason for failure
        reason: String,
    },
    /// Intent expired without being filled
    Expired,
}

impl IntentStatus {
    /// Check if this is a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            IntentStatus::Completed { .. } | IntentStatus::Failed { .. } | IntentStatus::Expired
        )
    }

    /// Check if this is a success state
    pub fn is_success(&self) -> bool {
        matches!(self, IntentStatus::Completed { .. })
    }

    /// Get human-readable status string
    pub fn as_str(&self) -> &'static str {
        match self {
            IntentStatus::Pending => "PENDING",
            IntentStatus::Matched { .. } => "MATCHED",
            IntentStatus::Settling { .. } => "SETTLING",
            IntentStatus::Completed { .. } => "COMPLETED",
            IntentStatus::Failed { .. } => "FAILED",
            IntentStatus::Expired => "EXPIRED",
        }
    }
}

/// Quote response from Fusion+ before creating intent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusionQuote {
    /// Estimated output amount
    pub dst_amount: String,
    /// Estimated fees
    pub estimated_fee: String,
    /// Estimated execution time in seconds
    pub estimated_time: u64,
    /// Quote expiry timestamp
    pub quote_expiry: u64,
}

/// Resolver information when intent is matched
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolverInfo {
    /// Resolver address
    pub address: String,
    /// Resolver reputation score (0-100)
    pub reputation: u32,
    /// Number of successful fills
    pub fills_count: u64,
}

/// Settlement event from destination chain
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementEvent {
    /// Transaction hash on destination chain
    pub tx_hash: String,
    /// Block number
    pub block_number: u64,
    /// Amount actually received
    pub amount_received: String,
    /// Gas used for settlement
    pub gas_used: u64,
    /// Timestamp
    pub timestamp: u64,
}

/// Request to create a new Fusion+ intent
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIntentRequest {
    /// Source chain ID
    pub src_chain_id: u64,
    /// Destination chain ID
    pub dst_chain_id: u64,
    /// Source token address
    pub src_token_address: String,
    /// Destination token address
    pub dst_token_address: String,
    /// Amount to swap
    pub amount: String,
    /// Minimum return amount
    pub min_return: String,
    /// Deadline timestamp
    pub deadline: u64,
    /// Receiver address
    pub receiver: String,
    /// Optional permit data for gasless approval
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permit: Option<String>,
    /// Nonce for replay protection
    pub nonce: u64,
}

/// Response when creating an intent
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIntentResponse {
    /// Order hash (intent ID)
    pub order_hash: String,
    /// Initial status
    pub status: String,
}

/// Response when querying intent status
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntentStatusResponse {
    /// Order hash
    pub order_hash: String,
    /// Current status string
    pub status: String,
    /// Source chain ID
    pub src_chain_id: u64,
    /// Destination chain ID
    pub dst_chain_id: u64,
    /// Fill information (if settled)
    #[serde(default)]
    pub fills: Vec<FillInfo>,
    /// Resolver info (if matched)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolver: Option<String>,
    /// Error message (if failed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Fill information from status response
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillInfo {
    /// Destination chain transaction hash
    pub dst_tx_hash: String,
    /// Amount received
    pub dst_amount: String,
    /// Resolver address
    pub resolver: String,
    /// Settlement timestamp
    pub settled_at: u64,
}

/// Supported Fusion+ routes (from Arbitrum as hub)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FusionRoute {
    /// Source chain ID
    pub src_chain_id: u64,
    /// Destination chain ID
    pub dst_chain_id: u64,
}

impl FusionRoute {
    /// Arbitrum to Ethereum
    pub const ARB_TO_ETH: Self = Self {
        src_chain_id: 42161,
        dst_chain_id: 1,
    };

    /// Arbitrum to Base
    pub const ARB_TO_BASE: Self = Self {
        src_chain_id: 42161,
        dst_chain_id: 8453,
    };

    /// Arbitrum to Optimism
    pub const ARB_TO_OP: Self = Self {
        src_chain_id: 42161,
        dst_chain_id: 10,
    };

    /// Arbitrum to Solana
    pub const ARB_TO_SOL: Self = Self {
        src_chain_id: 42161,
        dst_chain_id: SOLANA_CHAIN_ID,
    };

    /// Check if a route is supported
    pub fn is_supported(src: u64, dst: u64) -> bool {
        // Arbitrum must be the source (hub chain)
        if src != 42161 {
            return false;
        }

        // Supported destinations
        matches!(dst, 1 | 8453 | 10) || dst == SOLANA_CHAIN_ID
    }

    /// Get all supported routes
    pub fn all_routes() -> Vec<Self> {
        vec![
            Self::ARB_TO_ETH,
            Self::ARB_TO_BASE,
            Self::ARB_TO_OP,
            Self::ARB_TO_SOL,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_supported_chain_ids() {
        assert_eq!(SupportedChain::Ethereum.chain_id(), 1);
        assert_eq!(SupportedChain::Arbitrum.chain_id(), 42161);
        assert_eq!(SupportedChain::Base.chain_id(), 8453);
        assert_eq!(SupportedChain::Optimism.chain_id(), 10);
    }

    #[test]
    fn test_supported_chain_quote_urls() {
        assert_eq!(
            SupportedChain::Ethereum.quote_url(),
            "https://api.1inch.dev/swap/v6.0/1/quote"
        );
        assert_eq!(
            SupportedChain::Arbitrum.quote_url(),
            "https://api.1inch.dev/swap/v6.0/42161/quote"
        );
        assert_eq!(
            SupportedChain::Base.quote_url(),
            "https://api.1inch.dev/swap/v6.0/8453/quote"
        );
        assert_eq!(
            SupportedChain::Optimism.quote_url(),
            "https://api.1inch.dev/swap/v6.0/10/quote"
        );
    }

    #[test]
    fn test_supported_chain_from_chain_id() {
        assert_eq!(
            SupportedChain::from_chain_id(1),
            Some(SupportedChain::Ethereum)
        );
        assert_eq!(
            SupportedChain::from_chain_id(42161),
            Some(SupportedChain::Arbitrum)
        );
        assert_eq!(
            SupportedChain::from_chain_id(8453),
            Some(SupportedChain::Base)
        );
        assert_eq!(
            SupportedChain::from_chain_id(10),
            Some(SupportedChain::Optimism)
        );
        assert_eq!(SupportedChain::from_chain_id(999), None);
    }

    #[test]
    fn test_quote_response_deserialization() {
        let json = r#"{
            "dstAmount": "999500000000000000",
            "gas": 150000,
            "protocols": [[
                [{"name": "UNISWAP_V3", "part": 100, "fromTokenAddress": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "toTokenAddress": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"}]
            ]]
        }"#;

        let response: QuoteResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.dst_amount, "999500000000000000");
        assert_eq!(response.gas, 150000);
        assert_eq!(response.protocols.len(), 1);
        assert_eq!(response.protocols[0].len(), 1);
        assert_eq!(response.protocols[0][0].len(), 1);
        assert_eq!(response.protocols[0][0][0].name, "UNISWAP_V3");
    }

    #[test]
    fn test_quote_from_response() {
        let response = QuoteResponse {
            dst_amount: "1000000000000000000".to_string(),
            gas: 200000,
            protocols: vec![vec![vec![
                Protocol {
                    name: "UNISWAP_V3".to_string(),
                    part: 60,
                    from_token_address: "0xabc".to_string(),
                    to_token_address: "0xdef".to_string(),
                },
                Protocol {
                    name: "SUSHISWAP".to_string(),
                    part: 40,
                    from_token_address: "0xabc".to_string(),
                    to_token_address: "0xdef".to_string(),
                },
            ]]],
        };

        let quote = Quote::from(response);
        assert_eq!(quote.to_amount, "1000000000000000000");
        assert_eq!(quote.estimated_gas, 200000);
        assert_eq!(quote.protocols.len(), 2);
    }

    // Fusion+ type tests

    #[test]
    fn test_fusion_plus_config_default() {
        let config = FusionPlusConfig::default();
        assert_eq!(config.base_url, "https://api.1inch.dev/fusion-plus/v1.0");
        assert_eq!(config.timeout, std::time::Duration::from_secs(30));
        assert!(config.api_key.is_empty());
        assert_eq!(config.backoff_ms, vec![1000, 2000, 4000, 8000, 16000]);
    }

    #[test]
    fn test_fusion_plus_config_builder() {
        let config = FusionPlusConfig::new("test-api-key")
            .with_base_url("http://localhost:8080")
            .with_timeout(std::time::Duration::from_secs(60))
            .with_backoff_ms(vec![100, 200]);

        assert_eq!(config.api_key, "test-api-key");
        assert_eq!(config.base_url, "http://localhost:8080");
        assert_eq!(config.timeout, std::time::Duration::from_secs(60));
        assert_eq!(config.backoff_ms, vec![100, 200]);
    }

    #[test]
    fn test_fusion_plus_config_debug_redacts_api_key() {
        let config = FusionPlusConfig::new("super-secret-key");
        let debug_str = format!("{:?}", config);
        assert!(!debug_str.contains("super-secret-key"));
        assert!(debug_str.contains("[REDACTED]"));
    }

    #[test]
    fn test_intent_status_is_terminal() {
        assert!(!IntentStatus::Pending.is_terminal());
        assert!(!IntentStatus::Matched {
            resolver: "0x".to_string()
        }
        .is_terminal());
        assert!(!IntentStatus::Settling {
            resolver: "0x".to_string()
        }
        .is_terminal());
        assert!(IntentStatus::Completed {
            dst_tx_hash: "0x".to_string(),
            dst_amount: "100".to_string(),
            resolver: "0x".to_string(),
            settled_at: 123,
        }
        .is_terminal());
        assert!(IntentStatus::Failed {
            reason: "err".to_string()
        }
        .is_terminal());
        assert!(IntentStatus::Expired.is_terminal());
    }

    #[test]
    fn test_intent_status_is_success() {
        assert!(!IntentStatus::Pending.is_success());
        assert!(IntentStatus::Completed {
            dst_tx_hash: "0x".to_string(),
            dst_amount: "100".to_string(),
            resolver: "0x".to_string(),
            settled_at: 123,
        }
        .is_success());
        assert!(!IntentStatus::Failed {
            reason: "err".to_string()
        }
        .is_success());
    }

    #[test]
    fn test_fusion_route_supported() {
        // Arbitrum as source - all should work
        assert!(FusionRoute::is_supported(42161, 1)); // ARB -> ETH
        assert!(FusionRoute::is_supported(42161, 8453)); // ARB -> Base
        assert!(FusionRoute::is_supported(42161, 10)); // ARB -> OP
        assert!(FusionRoute::is_supported(42161, SOLANA_CHAIN_ID)); // ARB -> SOL

        // Non-Arbitrum source - should fail
        assert!(!FusionRoute::is_supported(1, 42161)); // ETH -> ARB (not supported)
        assert!(!FusionRoute::is_supported(1, 10)); // ETH -> OP (not from hub)

        // Unsupported destination
        assert!(!FusionRoute::is_supported(42161, 999));
    }

    #[test]
    fn test_fusion_route_all_routes() {
        let routes = FusionRoute::all_routes();
        assert_eq!(routes.len(), 4);
        assert!(routes.contains(&FusionRoute::ARB_TO_ETH));
        assert!(routes.contains(&FusionRoute::ARB_TO_BASE));
        assert!(routes.contains(&FusionRoute::ARB_TO_OP));
        assert!(routes.contains(&FusionRoute::ARB_TO_SOL));
    }

    #[test]
    fn test_create_intent_request_serialization() {
        let request = CreateIntentRequest {
            src_chain_id: 42161,
            dst_chain_id: 1,
            src_token_address: "0xusdc".to_string(),
            dst_token_address: "0xusdt".to_string(),
            amount: "1000000000".to_string(),
            min_return: "990000000".to_string(),
            deadline: 1706540400,
            receiver: "0xreceiver".to_string(),
            permit: None,
            nonce: 12345,
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"srcChainId\":42161"));
        assert!(json.contains("\"dstChainId\":1"));
        assert!(json.contains("\"amount\":\"1000000000\""));
        // permit should be skipped when None
        assert!(!json.contains("permit"));
    }

    #[test]
    fn test_intent_status_response_deserialization() {
        let json = r#"{
            "orderHash": "0xabc123",
            "status": "COMPLETED",
            "srcChainId": 42161,
            "dstChainId": 1,
            "fills": [{
                "dstTxHash": "0xtx123",
                "dstAmount": "995000000",
                "resolver": "0xresolver",
                "settledAt": 1706540350
            }]
        }"#;

        let response: IntentStatusResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.order_hash, "0xabc123");
        assert_eq!(response.status, "COMPLETED");
        assert_eq!(response.src_chain_id, 42161);
        assert_eq!(response.dst_chain_id, 1);
        assert_eq!(response.fills.len(), 1);
        assert_eq!(response.fills[0].dst_tx_hash, "0xtx123");
        assert_eq!(response.fills[0].dst_amount, "995000000");
    }
}
