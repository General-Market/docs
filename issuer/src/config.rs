//! Configuration management for the Issuer node.
//!
//! Supports configuration from multiple sources with priority:
//! CLI arguments > Environment variables > Config file > Defaults
//!
//! # Supported Config File Formats
//!
//! - **YAML** (`.yaml`, `.yml`) - Recommended for human-readable configs
//! - **TOML** (`.toml`) - Alternative format with similar structure
//!
//! # Environment Variables
//!
//! All configuration fields can be set via environment variables:
//! - `ISSUER_NODE_ID` - Node ID (1-20)
//! - `ISSUER_PORT` - P2P listen port
//! - `ISSUER_RPC_URL` - Chain RPC endpoint
//! - `ISSUER_BLS_KEY_PATH` - Path to BLS key file
//! - `ISSUER_PEERS` - Comma-separated list of peer addresses
//! - `ISSUER_LOG_LEVEL` - Log level (trace, debug, info, warn, error)
//! - `ISSUER_LOG_DIR` - Log output directory
//! - `ISSUER_JSON_LOGS` - Output logs as JSON (true/false)

use ethers::types::Address;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

/// Configuration errors that can occur during loading, parsing, or validation.
#[derive(Error, Debug)]
pub enum ConfigError {
    /// Failed to read the configuration file from disk.
    #[error("Failed to read config file: {0}")]
    FileRead(#[from] std::io::Error),

    /// Failed to parse YAML configuration.
    #[error("Failed to parse YAML config: {0}")]
    YamlParse(#[from] serde_yaml::Error),

    /// Failed to parse TOML configuration.
    #[error("Failed to parse TOML config: {0}")]
    TomlParse(#[from] toml::de::Error),

    /// The config file has an unsupported extension.
    #[error("Unsupported config file format: {0}. Supported: .yaml, .yml, .toml")]
    UnsupportedFormat(String),

    /// The node_id is outside the valid range (1-20).
    #[error("Invalid node_id: must be between 1 and 20, got {0}")]
    InvalidNodeId(u32),

    /// A required configuration field is missing.
    #[error("Missing required field: {0}")]
    MissingField(&'static str),

    /// An environment variable has an invalid value.
    #[error("Invalid environment variable '{name}': {reason}")]
    InvalidEnvVar { name: &'static str, reason: String },

    /// Failed to parse the deployment JSON file.
    #[error("Failed to parse deployment file: {0}")]
    DeploymentFileParse(String),

    /// A contract address is invalid (zero address in non-mock mode).
    #[error("Invalid contract address for '{name}': address is zero (configure via deployment file, env vars, or config)")]
    InvalidContractAddress { name: &'static str },

    /// Failed to parse an address string.
    #[error("Failed to parse address '{value}': {reason}")]
    InvalidAddress { value: String, reason: String },
}

/// Issuer node configuration.
///
/// All fields are optional to support layered configuration from multiple sources.
/// Use the `effective_*` methods to get values with defaults applied.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IssuerConfig {
    /// Issuer node ID (1-20). Required for operation.
    pub node_id: Option<u32>,

    /// P2P listen port. Defaults to 9000 + node_id if not set.
    pub port: Option<u16>,

    /// Chain RPC endpoint. Defaults to "http://localhost:8545".
    pub rpc_url: Option<String>,

    /// Path to BLS key file for signing.
    pub bls_key_path: Option<PathBuf>,

    /// List of peer addresses in "ip:port" format.
    #[serde(default)]
    pub peers: Vec<String>,

    /// Log level (trace, debug, info, warn, error). Defaults to "info".
    pub log_level: Option<String>,

    /// Log output directory. Defaults to "logs".
    pub log_dir: Option<PathBuf>,

    /// Output logs as JSON format. Defaults to false.
    pub json_logs: Option<bool>,

    // --- Contract address fields (Story 6.2) ---
    /// Index.sol contract address (proxy).
    pub index_address: Option<String>,

    /// Governance.sol contract address (proxy).
    pub governance_address: Option<String>,

    /// IssuerRegistry.sol contract address (proxy).
    pub issuer_registry_address: Option<String>,

    /// CollateralRegistry.sol contract address.
    pub collateral_registry_address: Option<String>,

    /// BLSCustody.sol contract address (proxy).
    pub bls_custody_address: Option<String>,

    /// L3BridgeCustody.sol contract address (proxy).
    pub l3_bridge_custody_address: Option<String>,

    /// Path to deployment JSON file (e.g., deployments/l3-testnet.json).
    /// When set, contract addresses are loaded from this file (lower priority than
    /// explicit address fields and env vars).
    pub deployment_file: Option<PathBuf>,

    /// Private key for signing transactions (hex string, with or without 0x prefix).
    /// Prefer using `ISSUER_PRIVATE_KEY` env var instead of storing in config file.
    #[serde(skip_serializing)]
    pub private_key: Option<String>,

    /// Path to file containing the private key.
    pub private_key_path: Option<PathBuf>,

    // --- 1inch integration fields (Story 6.7) ---
    /// 1inch API key for quote fetching.
    pub oneinch_api_key: Option<String>,

    /// Arbitrum RPC URL for BLSCustody execution.
    pub arbitrum_rpc_url: Option<String>,

    /// Arbitrum BLSCustody proxy address.
    pub arbitrum_custody_address: Option<String>,

    /// Arbitrum BridgeProxy contract address (Story 6.21).
    /// Used for cross-chain ITP creation via BLS consensus.
    pub bridge_proxy_address: Option<String>,

    /// Arbitrum chain ID (default: 42161 for Arbitrum One).
    /// For E2E testing with BridgeProxy on L3, set to 111222333.
    pub arbitrum_chain_id: Option<u64>,

    /// 1inch Fusion+ API key (may differ from quote key).
    pub oneinch_fusion_api_key: Option<String>,

    // --- MockBitgetVault fields (Story 6.17) ---
    /// MockBitgetVault contract address for on-chain fill verification (E2E testing).
    /// When set, issuers read fill data from MockBitgetVault.getFill() instead of
    /// polling in-memory MockBitget (FR13: no direct AP communication).
    pub bitget_vault: Option<String>,

    // --- IssuerCustody fields (Story 7.7) ---
    /// IssuerCustody contract address on L3 (holds L3Usdc after bridge from Arbitrum).
    /// Used by issuers to execute BLS-signed transfers for submitOrder flow.
    pub issuer_custody_l3: Option<String>,

    /// IssuerCustody contract address on Arbitrum (holds ArbUSDC after bridge from L3).
    /// Used by issuers to execute BLS-signed transfers for vault release flow.
    pub issuer_custody_arb: Option<String>,

    /// ArbBridgeCustody contract address (Story 7.8).
    /// Locks user's ArbUSDC when buying ITP from Arbitrum. Issuers observe
    /// CrossChainOrderCreated events from this contract for cross-chain buy flow.
    pub arb_custody: Option<String>,

    /// L3 USDC token contract address.
    pub l3_usdc: Option<String>,

    /// Arbitrum USDC token contract address.
    pub arb_usdc: Option<String>,

    /// NTP server address for time synchronization (default: pool.ntp.org).
    pub ntp_server: Option<String>,

    /// NTP tolerance in milliseconds (default: 200ms).
    pub ntp_tolerance_ms: Option<u64>,

    // --- Registry Sync fields (Story 8.4) ---
    /// Enable the registry sync endpoint (GET /api/registry-sync).
    /// When enabled, the issuer watches for RegistryStateChanged events from L3 IssuerRegistry
    /// and serves BLS-signed registry state proofs for MirrorIssuerRegistry sync on Arbitrum.
    /// Defaults to false.
    pub registry_sync_enabled: Option<bool>,

    /// Registry sync polling interval in milliseconds (default: 5000ms).
    /// Controls how often the handler polls for new RegistryStateChanged events.
    pub registry_sync_poll_interval_ms: Option<u64>,

    /// MockUSDT token contract address for USDT-pair fill verification (Story 7.18).
    /// When set, issuer fill verification accepts this address as a valid USDT token
    /// in sell/buy fields (not just MockUSDC).
    pub mock_usdt: Option<String>,

    /// Data-node backend URL for fetching asset prices.
    /// When set, the issuer uses BackendPriceFetcher instead of BitgetPriceFetcher.
    /// Can also be set via DATA_NODE_URL env var.
    pub data_node_url: Option<String>,

    /// TLS certificate path for P2P connections.
    /// Can also be set via ISSUER_TLS_CERT_PATH env var.
    pub tls_cert_path: Option<String>,

    /// TLS key path for P2P connections.
    /// Can also be set via ISSUER_TLS_KEY_PATH env var.
    pub tls_key_path: Option<String>,

    /// TLS CA cert path for P2P connections.
    /// Can also be set via ISSUER_TLS_CA_PATH env var.
    pub tls_ca_path: Option<String>,

    // --- Arbitration subsystem fields ---
    /// Enable arbitration subsystem (default: false)
    pub arbitration_enabled: Option<bool>,
    /// CollateralVault contract address for arbitration events
    pub arbitration_collateral_vault: Option<String>,
    /// ArbitrationSettlement contract address
    pub arbitration_settlement_contract: Option<String>,
    /// BLS signature threshold for arbitration (default: 2)
    pub arbitration_threshold: Option<usize>,
    /// Polling interval for arbitration events in seconds (default: 30)
    pub arbitration_poll_interval: Option<u64>,
    /// Data-node URL for price queries (default: http://localhost:8200)
    pub arbitration_data_node_url: Option<String>,

    /// Bearer token for authenticating data-node HTTP requests.
    /// Shared across Vision, Arbitration, and NAV subsystems.
    pub data_node_token: Option<String>,

    // --- Vision subsystem fields ---
    /// Vision prediction market configuration.
    /// When present and `enabled == true`, the Vision tick engine, scheduler, and API
    /// routes are initialized alongside the existing ITP consensus loop.
    pub vision: Option<crate::vision::config::VisionConfig>,

    /// Exchange mode: mock, testnet, or mainnet.
    /// Controls which Bitget client implementation is used for price fetching.
    /// Can also be set via EXCHANGE_MODE env var.
    pub exchange_mode: Option<String>,
}

impl IssuerConfig {
    /// Load configuration from a YAML or TOML file.
    ///
    /// The file format is detected from the extension:
    /// - `.yaml` or `.yml` → YAML parser
    /// - `.toml` → TOML parser
    ///
    /// # Errors
    ///
    /// Returns `ConfigError::UnsupportedFormat` if the extension is not recognized.
    /// Returns `ConfigError::FileRead` if the file cannot be read.
    /// Returns `ConfigError::YamlParse` or `ConfigError::TomlParse` on parse errors.
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self, ConfigError> {
        let path = path.as_ref();
        let contents = std::fs::read_to_string(path)?;

        // Detect format from extension
        let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");

        match extension.to_lowercase().as_str() {
            "yaml" | "yml" => {
                let config: IssuerConfig = serde_yaml::from_str(&contents)?;
                Ok(config)
            }
            "toml" => {
                let config: IssuerConfig = toml::from_str(&contents)?;
                Ok(config)
            }
            _ => Err(ConfigError::UnsupportedFormat(extension.to_string())),
        }
    }

    /// Load configuration from environment variables.
    ///
    /// Reads the following environment variables:
    /// - `ISSUER_NODE_ID` - parsed as u32
    /// - `ISSUER_PORT` - parsed as u16
    /// - `ISSUER_RPC_URL` - used as-is
    /// - `ISSUER_BLS_KEY_PATH` - converted to PathBuf
    /// - `ISSUER_PEERS` - comma-separated list
    /// - `ISSUER_LOG_LEVEL` - used as-is
    /// - `ISSUER_LOG_DIR` - converted to PathBuf
    /// - `ISSUER_JSON_LOGS` - parsed as bool
    ///
    /// # Warnings
    ///
    /// If an environment variable is set but cannot be parsed, a warning is logged
    /// via `eprintln!` and the value is ignored (treated as unset).
    pub fn from_env() -> Self {
        IssuerConfig {
            node_id: parse_env_var("ISSUER_NODE_ID"),
            port: parse_env_var("ISSUER_PORT"),
            rpc_url: std::env::var("ISSUER_RPC_URL").ok(),
            bls_key_path: std::env::var("ISSUER_BLS_KEY_PATH").ok().map(PathBuf::from),
            peers: std::env::var("ISSUER_PEERS")
                .ok()
                .map(|v| {
                    v.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_default(),
            log_level: std::env::var("ISSUER_LOG_LEVEL").ok(),
            log_dir: std::env::var("ISSUER_LOG_DIR").ok().map(PathBuf::from),
            json_logs: parse_env_var("ISSUER_JSON_LOGS"),
            index_address: std::env::var("ISSUER_INDEX_ADDRESS").ok(),
            governance_address: std::env::var("ISSUER_GOVERNANCE_ADDRESS").ok(),
            issuer_registry_address: std::env::var("ISSUER_ISSUER_REGISTRY_ADDRESS").ok(),
            collateral_registry_address: std::env::var("ISSUER_COLLATERAL_REGISTRY_ADDRESS").ok(),
            bls_custody_address: std::env::var("ISSUER_BLS_CUSTODY_ADDRESS").ok(),
            l3_bridge_custody_address: std::env::var("ISSUER_L3_BRIDGE_CUSTODY_ADDRESS").ok(),
            deployment_file: std::env::var("ISSUER_DEPLOYMENT_FILE")
                .ok()
                .map(PathBuf::from),
            private_key: std::env::var("ISSUER_PRIVATE_KEY").ok(),
            private_key_path: std::env::var("ISSUER_PRIVATE_KEY_PATH")
                .ok()
                .map(PathBuf::from),
            oneinch_api_key: std::env::var("ISSUER_ONEINCH_API_KEY").ok(),
            arbitrum_rpc_url: std::env::var("ISSUER_ARBITRUM_RPC_URL").ok(),
            arbitrum_custody_address: std::env::var("ISSUER_ARBITRUM_CUSTODY_ADDRESS").ok(),
            bridge_proxy_address: std::env::var("ISSUER_BRIDGE_PROXY_ADDRESS").ok(),
            arbitrum_chain_id: std::env::var("ISSUER_ARBITRUM_CHAIN_ID")
                .ok()
                .and_then(|s| s.parse().ok()),
            oneinch_fusion_api_key: std::env::var("ISSUER_ONEINCH_FUSION_API_KEY").ok(),
            bitget_vault: std::env::var("ISSUER_BITGET_VAULT").ok(),
            issuer_custody_l3: std::env::var("ISSUER_CUSTODY_L3").ok(),
            issuer_custody_arb: std::env::var("ISSUER_CUSTODY_ARB").ok(),
            arb_custody: std::env::var("ISSUER_ARB_CUSTODY").ok(),
            l3_usdc: std::env::var("ISSUER_L3_USDC").ok(),
            arb_usdc: std::env::var("ISSUER_ARB_USDC").ok(),
            ntp_server: std::env::var("ISSUER_NTP_SERVER").ok(),
            ntp_tolerance_ms: parse_env_var("ISSUER_NTP_TOLERANCE_MS"),
            registry_sync_enabled: parse_env_var("ISSUER_REGISTRY_SYNC"),
            registry_sync_poll_interval_ms: parse_env_var("ISSUER_REGISTRY_SYNC_POLL_INTERVAL_MS"),
            mock_usdt: std::env::var("ISSUER_MOCK_USDT").ok(),
            data_node_url: std::env::var("DATA_NODE_URL").ok(),
            tls_cert_path: std::env::var("ISSUER_TLS_CERT_PATH").ok(),
            tls_key_path: std::env::var("ISSUER_TLS_KEY_PATH").ok(),
            tls_ca_path: std::env::var("ISSUER_TLS_CA_PATH").ok(),
            arbitration_enabled: parse_env_var("ISSUER_ARBITRATION_ENABLED"),
            arbitration_collateral_vault: std::env::var("ISSUER_ARBITRATION_COLLATERAL_VAULT").ok(),
            arbitration_settlement_contract: std::env::var("ISSUER_ARBITRATION_SETTLEMENT_CONTRACT").ok(),
            arbitration_threshold: parse_env_var("ISSUER_ARBITRATION_THRESHOLD"),
            arbitration_poll_interval: parse_env_var("ISSUER_ARBITRATION_POLL_INTERVAL"),
            arbitration_data_node_url: std::env::var("ISSUER_ARBITRATION_DATA_NODE_URL").ok(),
            data_node_token: std::env::var("DATA_NODE_TOKEN").ok(),
            exchange_mode: std::env::var("EXCHANGE_MODE").ok(),
            vision: {
                let enabled: Option<bool> = parse_env_var("ISSUER_VISION_ENABLED");
                if enabled == Some(true) {
                    Some(crate::vision::config::VisionConfig {
                        enabled: true,
                        vision_address: std::env::var("ISSUER_VISION_ADDRESS").unwrap_or_default(),
                        data_node_url: std::env::var("ISSUER_VISION_DATA_NODE_URL")
                            .unwrap_or_else(|_| "http://localhost:8200".into()),
                        database_url: std::env::var("ISSUER_VISION_DATABASE_URL")
                            .unwrap_or_else(|_| "postgres://localhost:5432/vision".into()),
                        rpc_ws_url: std::env::var("ISSUER_VISION_RPC_WS_URL")
                            .unwrap_or_else(|_| "ws://localhost:8546".into()),
                        start_block: parse_env_var("ISSUER_VISION_START_BLOCK").unwrap_or(0),
                        reveal_window_secs: parse_env_var("ISSUER_VISION_REVEAL_WINDOW_SECS").unwrap_or(600),
                        commitment_offset: parse_env_var("ISSUER_VISION_COMMITMENT_OFFSET").unwrap_or(9),
                        staleness_threshold_secs: parse_env_var("ISSUER_VISION_STALENESS_THRESHOLD_SECS").unwrap_or(300),
                        tick_poll_interval_ms: parse_env_var("ISSUER_VISION_TICK_POLL_INTERVAL_MS").unwrap_or(1000),
                        data_node_token: std::env::var("DATA_NODE_TOKEN").ok(),
                    })
                } else {
                    None
                }
            },
        }
    }

    /// Merge another config into this one, where `other` takes precedence.
    ///
    /// For each field:
    /// - If `other` has `Some(value)`, use it
    /// - If `other` has `None`, keep the existing value
    /// - For `peers`, only override if `other.peers` is non-empty
    pub fn merge(&mut self, other: &IssuerConfig) {
        if other.node_id.is_some() {
            self.node_id = other.node_id;
        }
        if other.port.is_some() {
            self.port = other.port;
        }
        if other.rpc_url.is_some() {
            self.rpc_url = other.rpc_url.clone();
        }
        if other.bls_key_path.is_some() {
            self.bls_key_path = other.bls_key_path.clone();
        }
        if !other.peers.is_empty() {
            self.peers = other.peers.clone();
        }
        if other.log_level.is_some() {
            self.log_level = other.log_level.clone();
        }
        if other.log_dir.is_some() {
            self.log_dir = other.log_dir.clone();
        }
        if other.json_logs.is_some() {
            self.json_logs = other.json_logs;
        }
        if other.index_address.is_some() {
            self.index_address = other.index_address.clone();
        }
        if other.governance_address.is_some() {
            self.governance_address = other.governance_address.clone();
        }
        if other.issuer_registry_address.is_some() {
            self.issuer_registry_address = other.issuer_registry_address.clone();
        }
        if other.collateral_registry_address.is_some() {
            self.collateral_registry_address = other.collateral_registry_address.clone();
        }
        if other.bls_custody_address.is_some() {
            self.bls_custody_address = other.bls_custody_address.clone();
        }
        if other.l3_bridge_custody_address.is_some() {
            self.l3_bridge_custody_address = other.l3_bridge_custody_address.clone();
        }
        if other.deployment_file.is_some() {
            self.deployment_file = other.deployment_file.clone();
        }
        if other.private_key.is_some() {
            self.private_key = other.private_key.clone();
        }
        if other.private_key_path.is_some() {
            self.private_key_path = other.private_key_path.clone();
        }
        if other.oneinch_api_key.is_some() {
            self.oneinch_api_key = other.oneinch_api_key.clone();
        }
        if other.arbitrum_rpc_url.is_some() {
            self.arbitrum_rpc_url = other.arbitrum_rpc_url.clone();
        }
        if other.arbitrum_custody_address.is_some() {
            self.arbitrum_custody_address = other.arbitrum_custody_address.clone();
        }
        if other.bridge_proxy_address.is_some() {
            self.bridge_proxy_address = other.bridge_proxy_address.clone();
        }
        if other.arbitrum_chain_id.is_some() {
            self.arbitrum_chain_id = other.arbitrum_chain_id;
        }
        if other.oneinch_fusion_api_key.is_some() {
            self.oneinch_fusion_api_key = other.oneinch_fusion_api_key.clone();
        }
        if other.bitget_vault.is_some() {
            self.bitget_vault = other.bitget_vault.clone();
        }
        if other.issuer_custody_l3.is_some() {
            self.issuer_custody_l3 = other.issuer_custody_l3.clone();
        }
        if other.issuer_custody_arb.is_some() {
            self.issuer_custody_arb = other.issuer_custody_arb.clone();
        }
        if other.arb_custody.is_some() {
            self.arb_custody = other.arb_custody.clone();
        }
        if other.l3_usdc.is_some() {
            self.l3_usdc = other.l3_usdc.clone();
        }
        if other.arb_usdc.is_some() {
            self.arb_usdc = other.arb_usdc.clone();
        }
        if other.ntp_server.is_some() {
            self.ntp_server = other.ntp_server.clone();
        }
        if other.ntp_tolerance_ms.is_some() {
            self.ntp_tolerance_ms = other.ntp_tolerance_ms;
        }
        if other.registry_sync_enabled.is_some() {
            self.registry_sync_enabled = other.registry_sync_enabled;
        }
        if other.registry_sync_poll_interval_ms.is_some() {
            self.registry_sync_poll_interval_ms = other.registry_sync_poll_interval_ms;
        }
        if other.mock_usdt.is_some() {
            self.mock_usdt = other.mock_usdt.clone();
        }
        if other.data_node_url.is_some() {
            self.data_node_url = other.data_node_url.clone();
        }
        if other.tls_cert_path.is_some() {
            self.tls_cert_path = other.tls_cert_path.clone();
        }
        if other.tls_key_path.is_some() {
            self.tls_key_path = other.tls_key_path.clone();
        }
        if other.tls_ca_path.is_some() {
            self.tls_ca_path = other.tls_ca_path.clone();
        }
        if other.arbitration_enabled.is_some() {
            self.arbitration_enabled = other.arbitration_enabled;
        }
        if other.arbitration_collateral_vault.is_some() {
            self.arbitration_collateral_vault = other.arbitration_collateral_vault.clone();
        }
        if other.arbitration_settlement_contract.is_some() {
            self.arbitration_settlement_contract = other.arbitration_settlement_contract.clone();
        }
        if other.arbitration_threshold.is_some() {
            self.arbitration_threshold = other.arbitration_threshold;
        }
        if other.arbitration_poll_interval.is_some() {
            self.arbitration_poll_interval = other.arbitration_poll_interval;
        }
        if other.arbitration_data_node_url.is_some() {
            self.arbitration_data_node_url = other.arbitration_data_node_url.clone();
        }
        if other.data_node_token.is_some() {
            self.data_node_token = other.data_node_token.clone();
        }
        if other.vision.is_some() {
            self.vision = other.vision.clone();
        }
        if other.exchange_mode.is_some() {
            self.exchange_mode = other.exchange_mode.clone();
        }
    }

    /// Validate the configuration.
    ///
    /// # Errors
    ///
    /// - `ConfigError::InvalidNodeId` if node_id is set but outside 1-20 range
    pub fn validate(&self) -> Result<(), ConfigError> {
        if let Some(node_id) = self.node_id {
            if node_id == 0 || node_id > 20 {
                return Err(ConfigError::InvalidNodeId(node_id));
            }
        }
        Ok(())
    }

    /// Get the effective port (using default if not set).
    ///
    /// Default: 9000 + node_id (or 9001 if node_id is also unset)
    pub fn effective_port(&self) -> u16 {
        self.port
            .unwrap_or_else(|| 9000 + self.node_id.unwrap_or(1) as u16)
    }

    /// Get the effective RPC URL (using default if not set).
    ///
    /// Default: "http://localhost:8545"
    pub fn effective_rpc_url(&self) -> String {
        match &self.rpc_url {
            Some(url) => url.clone(),
            None => {
                tracing::warn!("ISSUER_RPC_URL not set — falling back to http://localhost:8545 (not suitable for production)");
                "http://localhost:8545".to_string()
            }
        }
    }

    /// Get the effective log level (using default if not set).
    ///
    /// Default: "info"
    pub fn effective_log_level(&self) -> String {
        self.log_level.clone().unwrap_or_else(|| "info".to_string())
    }

    /// Get the effective log directory (using default if not set).
    ///
    /// Default: "logs"
    pub fn effective_log_dir(&self) -> PathBuf {
        self.log_dir
            .clone()
            .unwrap_or_else(|| PathBuf::from("logs"))
    }

    /// Get the effective json_logs setting (using default if not set).
    ///
    /// Default: false
    pub fn effective_json_logs(&self) -> bool {
        self.json_logs.unwrap_or(false)
    }

    /// Get the effective MockBitgetVault address as bytes.
    ///
    /// Returns the parsed address if configured, or None if not set.
    /// The hex string should be 40 characters (20 bytes) with optional "0x" prefix.
    pub fn effective_bitget_vault(&self) -> Option<[u8; 20]> {
        self.bitget_vault.as_ref().and_then(|s| {
            let hex_str = s.strip_prefix("0x").unwrap_or(s);
            if hex_str.len() != 40 {
                return None;
            }
            let mut bytes = [0u8; 20];
            for (i, chunk) in hex_str.as_bytes().chunks(2).enumerate() {
                if let Ok(byte) =
                    u8::from_str_radix(std::str::from_utf8(chunk).unwrap_or("00"), 16)
                {
                    bytes[i] = byte;
                } else {
                    return None;
                }
            }
            Some(bytes)
        })
    }

    /// Get the effective IssuerCustody L3 address.
    ///
    /// Returns the parsed address if configured, or None if not set.
    pub fn effective_issuer_custody_l3(&self) -> Option<Address> {
        self.issuer_custody_l3
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok())
    }

    /// Get the effective IssuerCustody Arbitrum address.
    ///
    /// Returns the parsed address if configured, or None if not set.
    pub fn effective_issuer_custody_arb(&self) -> Option<Address> {
        self.issuer_custody_arb
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok())
    }

    /// Get the effective ArbBridgeCustody address (Story 7.8).
    ///
    /// Returns the parsed address if configured, or None if not set.
    pub fn effective_arb_custody(&self) -> Option<Address> {
        self.arb_custody
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok())
    }

    /// Get the effective L3 USDC token address.
    pub fn effective_l3_usdc(&self) -> Option<Address> {
        self.l3_usdc
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok())
    }

    /// Get the effective Arbitrum USDC token address.
    pub fn effective_arb_usdc(&self) -> Option<Address> {
        self.arb_usdc
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok())
    }

    /// Load contract addresses from a deployment JSON file.
    ///
    /// The deployment file format is:
    /// ```json
    /// {
    ///   "chainId": 111222333,
    ///   "contracts": {
    ///     "Index": "0x...",
    ///     "Governance": "0x...",
    ///     "IssuerRegistry": "0x...",
    ///     ...
    ///   }
    /// }
    /// ```
    ///
    /// Only loads addresses for fields that are currently `None` (does not override
    /// addresses already set via env vars or config file).
    pub fn load_deployment_file(&mut self, path: impl AsRef<Path>) -> Result<(), ConfigError> {
        let contents = std::fs::read_to_string(path.as_ref())?;
        let json: serde_json::Value = serde_json::from_str(&contents)
            .map_err(|e| ConfigError::DeploymentFileParse(format!("JSON parse error: {}", e)))?;

        let contracts = json.get("contracts").ok_or_else(|| {
            ConfigError::DeploymentFileParse("Missing 'contracts' field".to_string())
        })?;

        // Only set addresses that aren't already configured (lower priority than env/config)
        if self.index_address.is_none() {
            if let Some(addr) = contracts.get("Index").and_then(|v| v.as_str()) {
                self.index_address = Some(addr.to_string());
            }
        }
        if self.governance_address.is_none() {
            if let Some(addr) = contracts.get("Governance").and_then(|v| v.as_str()) {
                self.governance_address = Some(addr.to_string());
            }
        }
        if self.issuer_registry_address.is_none() {
            if let Some(addr) = contracts.get("IssuerRegistry").and_then(|v| v.as_str()) {
                self.issuer_registry_address = Some(addr.to_string());
            }
        }
        if self.collateral_registry_address.is_none() {
            if let Some(addr) = contracts.get("CollateralRegistry").and_then(|v| v.as_str()) {
                self.collateral_registry_address = Some(addr.to_string());
            }
        }
        if self.bls_custody_address.is_none() {
            if let Some(addr) = contracts.get("BLSCustody").and_then(|v| v.as_str()) {
                self.bls_custody_address = Some(addr.to_string());
            }
        }
        if self.l3_bridge_custody_address.is_none() {
            if let Some(addr) = contracts.get("L3BridgeCustody").and_then(|v| v.as_str()) {
                self.l3_bridge_custody_address = Some(addr.to_string());
            }
        }
        if self.bitget_vault.is_none() {
            if let Some(addr) = contracts.get("MockBitgetVault").and_then(|v| v.as_str()) {
                self.bitget_vault = Some(addr.to_string());
            }
        }
        if self.issuer_custody_l3.is_none() {
            if let Some(addr) = contracts.get("IssuerCustodyL3").and_then(|v| v.as_str()) {
                self.issuer_custody_l3 = Some(addr.to_string());
            }
        }
        if self.issuer_custody_arb.is_none() {
            if let Some(addr) = contracts.get("IssuerCustodyArb").and_then(|v| v.as_str()) {
                self.issuer_custody_arb = Some(addr.to_string());
            }
        }
        if self.arb_custody.is_none() {
            // Try both naming conventions
            if let Some(addr) = contracts.get("ArbBridgeCustody").and_then(|v| v.as_str()) {
                self.arb_custody = Some(addr.to_string());
            } else if let Some(addr) = contracts.get("ARB_CUSTODY").and_then(|v| v.as_str()) {
                self.arb_custody = Some(addr.to_string());
            }
        }
        if self.l3_usdc.is_none() {
            if let Some(addr) = contracts.get("L3_USDC").and_then(|v| v.as_str()) {
                self.l3_usdc = Some(addr.to_string());
            } else if let Some(addr) = contracts.get("L3_WUSDC").and_then(|v| v.as_str()) {
                self.l3_usdc = Some(addr.to_string());
            }
        }
        if self.arb_usdc.is_none() {
            if let Some(addr) = contracts.get("ARB_USDC").and_then(|v| v.as_str()) {
                self.arb_usdc = Some(addr.to_string());
            }
        }
        if self.mock_usdt.is_none() {
            if let Some(addr) = contracts.get("MOCK_USDT").and_then(|v| v.as_str()) {
                self.mock_usdt = Some(addr.to_string());
            } else if let Some(addr) = contracts.get("MockUSDT").and_then(|v| v.as_str()) {
                self.mock_usdt = Some(addr.to_string());
            }
        }

        Ok(())
    }

    /// Parse a hex address string into an ethers `Address`.
    fn parse_address(name: &'static str, value: &str) -> Result<Address, ConfigError> {
        value
            .parse::<Address>()
            .map_err(|e| ConfigError::InvalidAddress {
                value: value.to_string(),
                reason: format!("{} (field: {})", e, name),
            })
    }

    /// Get the effective contract addresses for the chain reader.
    ///
    /// Parses address strings into `ContractAddresses`. Returns an error if any
    /// configured address is invalid. Unconfigured addresses default to `Address::zero()`.
    pub fn effective_contract_addresses(&self) -> Result<crate::ContractAddresses, ConfigError> {
        let index = match &self.index_address {
            Some(addr) => Self::parse_address("index", addr)?,
            None => Address::zero(),
        };
        let governance = match &self.governance_address {
            Some(addr) => Self::parse_address("governance", addr)?,
            None => Address::zero(),
        };
        let issuer_registry = match &self.issuer_registry_address {
            Some(addr) => Self::parse_address("issuer_registry", addr)?,
            None => Address::zero(),
        };

        Ok(crate::ContractAddresses {
            index,
            governance,
            issuer_registry,
        })
    }

    /// Get the effective writer contract addresses.
    ///
    /// Parses address strings into `WriterContractAddresses`. Returns an error if any
    /// configured address is invalid. Unconfigured addresses default to `Address::zero()`.
    pub fn effective_writer_addresses(
        &self,
    ) -> Result<crate::WriterContractAddresses, ConfigError> {
        let index = match &self.index_address {
            Some(addr) => Self::parse_address("index", addr)?,
            None => Address::zero(),
        };
        let l3_bridge_custody = match &self.l3_bridge_custody_address {
            Some(addr) => Self::parse_address("l3_bridge_custody", addr)?,
            None => Address::zero(),
        };

        Ok(crate::WriterContractAddresses {
            index,
            l3_bridge_custody,
        })
    }

    /// Validate contract addresses for non-mock mode.
    ///
    /// In production mode (non-mock), critical contract addresses must not be zero.
    /// Returns an error listing the first zero address found.
    pub fn validate_contract_addresses(&self) -> Result<(), ConfigError> {
        let addrs = self.effective_contract_addresses()?;
        if addrs.index == Address::zero() {
            return Err(ConfigError::InvalidContractAddress { name: "index" });
        }
        if addrs.governance == Address::zero() {
            return Err(ConfigError::InvalidContractAddress { name: "governance" });
        }
        if addrs.issuer_registry == Address::zero() {
            return Err(ConfigError::InvalidContractAddress {
                name: "issuer_registry",
            });
        }

        let writer_addrs = self.effective_writer_addresses()?;
        if writer_addrs.l3_bridge_custody == Address::zero() {
            return Err(ConfigError::InvalidContractAddress {
                name: "l3_bridge_custody",
            });
        }
        Ok(())
    }

    /// Validate IssuerCustody addresses for bridge flow operations.
    ///
    /// Call this before processing bridge flows that require custody contracts.
    /// Returns an error if either custody address is not configured or invalid.
    ///
    /// # Errors
    ///
    /// - `ConfigError::MissingField` if `issuer_custody_l3` or `issuer_custody_arb` is not set
    /// - `ConfigError::InvalidAddress` if the address string cannot be parsed
    pub fn validate_custody_addresses(&self) -> Result<(), ConfigError> {
        // Validate IssuerCustody L3
        match &self.issuer_custody_l3 {
            None => {
                return Err(ConfigError::MissingField("issuer_custody_l3"));
            }
            Some(addr) => {
                if addr.parse::<Address>().is_err() {
                    return Err(ConfigError::InvalidAddress {
                        value: addr.clone(),
                        reason: "invalid IssuerCustody L3 address".to_string(),
                    });
                }
            }
        }

        // Validate IssuerCustody Arbitrum
        match &self.issuer_custody_arb {
            None => {
                return Err(ConfigError::MissingField("issuer_custody_arb"));
            }
            Some(addr) => {
                if addr.parse::<Address>().is_err() {
                    return Err(ConfigError::InvalidAddress {
                        value: addr.clone(),
                        reason: "invalid IssuerCustody Arbitrum address".to_string(),
                    });
                }
            }
        }

        Ok(())
    }

    /// Get the effective Arbitrum RPC URL.
    ///
    /// Returns an error if not configured (no silent fallback to mainnet).
    pub fn effective_arbitrum_rpc_url(&self) -> Result<String, String> {
        self.arbitrum_rpc_url
            .clone()
            .ok_or_else(|| "ISSUER_ARBITRUM_RPC_URL not configured".to_string())
    }

    /// Get the effective Arbitrum BLSCustody address.
    ///
    /// Returns None if not configured.
    pub fn effective_arbitrum_custody_address(&self) -> Option<Address> {
        self.arbitrum_custody_address
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok())
    }

    /// Get the effective BridgeProxy address on Arbitrum.
    ///
    /// Returns None if not configured.
    pub fn effective_bridge_proxy_address(&self) -> Option<Address> {
        self.bridge_proxy_address
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok())
    }

    /// Get the effective Arbitrum chain ID.
    ///
    /// Returns an error if not configured (no silent fallback to 42161).
    /// Set ISSUER_ARBITRUM_CHAIN_ID explicitly.
    pub fn effective_arbitrum_chain_id(&self) -> Result<u64, String> {
        self.arbitrum_chain_id
            .ok_or_else(|| "ISSUER_ARBITRUM_CHAIN_ID not configured".to_string())
    }

    /// Get the effective private key (from env var, config field, or key file).
    ///
    /// Resolution order: private_key field > private_key_path file contents.
    /// The `ISSUER_PRIVATE_KEY` env var is already merged into `private_key` field.
    pub fn effective_private_key(&self) -> Result<Option<String>, ConfigError> {
        if let Some(ref key) = self.private_key {
            return Ok(Some(key.clone()));
        }
        if let Some(ref path) = self.private_key_path {
            let contents = std::fs::read_to_string(path).map_err(|e| ConfigError::FileRead(e))?;
            return Ok(Some(contents.trim().to_string()));
        }
        Ok(None)
    }

    /// Get whether registry sync is enabled.
    ///
    /// Default: false
    pub fn effective_registry_sync_enabled(&self) -> bool {
        self.registry_sync_enabled.unwrap_or(false)
    }

    /// Get the effective registry sync polling interval in milliseconds.
    ///
    /// Default: 5000ms (5 seconds)
    pub fn effective_registry_sync_poll_interval_ms(&self) -> u64 {
        self.registry_sync_poll_interval_ms.unwrap_or(5_000)
    }

    /// Get the effective MockUSDT address (Story 7.18).
    ///
    /// Returns the parsed address if configured, or None if not set.
    pub fn effective_mock_usdt(&self) -> Option<Address> {
        self.mock_usdt
            .as_ref()
            .and_then(|addr| addr.parse::<Address>().ok())
    }

    /// Get the effective exchange mode.
    ///
    /// Resolution: config field > EXCHANGE_MODE env var > auto-detect from credentials.
    /// If no Bitget credentials are present, defaults to Mock.
    /// If credentials are present, defaults to Testnet.
    pub fn effective_exchange_mode(&self) -> common::types::ExchangeMode {
        // 1. Config field (from file, env, or CLI merge)
        if let Some(ref mode_str) = self.exchange_mode {
            if let Ok(mode) = mode_str.parse() {
                return mode;
            }
        }

        // 2. EXCHANGE_MODE env var (fallback if not merged into config)
        if let Ok(mode_str) = std::env::var("EXCHANGE_MODE") {
            if let Ok(mode) = mode_str.parse() {
                return mode;
            }
        }

        // 3. Auto-detect: Mock if no Bitget credentials, Testnet if credentials present
        let has_bitget = std::env::var("BITGET_READONLY_API_KEY").is_ok()
            && std::env::var("BITGET_READONLY_API_SECRET").is_ok()
            && std::env::var("BITGET_READONLY_PASSPHRASE").is_ok();
        if has_bitget {
            common::types::ExchangeMode::Testnet
        } else {
            common::types::ExchangeMode::Mock
        }
    }
}

/// Parse an environment variable with warning on failure.
///
/// Returns `None` if the variable is not set or cannot be parsed.
/// Prints a warning to stderr if the variable is set but parsing fails.
fn parse_env_var<T: std::str::FromStr>(name: &str) -> Option<T> {
    match std::env::var(name) {
        Ok(value) => match value.parse() {
            Ok(parsed) => Some(parsed),
            Err(_) => {
                eprintln!(
                    "Warning: Environment variable {} has invalid value '{}', ignoring",
                    name, value
                );
                None
            }
        },
        Err(_) => None,
    }
}

/// Configuration builder that handles the resolution chain:
/// CLI > ENV > Config file > Defaults
///
/// # Example
///
/// ```ignore
/// let config = ConfigBuilder::new()
///     .with_config_file(Some(PathBuf::from("config.yaml")))
///     .with_cli_args(Some(1), None, None, None, None, None, None, vec![])
///     .build()?;
/// ```
#[derive(Debug, Default)]
pub struct ConfigBuilder {
    config_file_path: Option<PathBuf>,
    deployment_file_path: Option<PathBuf>,
    cli_config: IssuerConfig,
}

impl ConfigBuilder {
    /// Create a new configuration builder.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the path to the configuration file.
    ///
    /// Supports YAML (`.yaml`, `.yml`) and TOML (`.toml`) formats.
    pub fn with_config_file(mut self, path: Option<PathBuf>) -> Self {
        self.config_file_path = path;
        self
    }

    /// Set the path to the deployment JSON file.
    ///
    /// Contract addresses from the deployment file have lowest priority
    /// (only used if not set via config file, env vars, or CLI).
    pub fn with_deployment_file(mut self, path: Option<PathBuf>) -> Self {
        self.deployment_file_path = path;
        self
    }

    /// Set CLI argument overrides.
    ///
    /// These take highest priority in the resolution chain.
    ///
    /// # Arguments
    ///
    /// * `node_id` - Issuer node ID (1-20)
    /// * `port` - P2P listen port
    /// * `rpc` - Chain RPC endpoint URL
    /// * `bls_key_path` - Path to BLS key file
    /// * `log_level` - Log level string
    /// * `log_dir` - Log output directory
    /// * `json_logs` - Whether to output JSON logs
    /// * `peers` - List of peer addresses
    pub fn with_cli_args(
        mut self,
        node_id: Option<u32>,
        port: Option<u16>,
        rpc: Option<String>,
        bls_key_path: Option<PathBuf>,
        log_level: Option<String>,
        log_dir: Option<PathBuf>,
        json_logs: Option<bool>,
        peers: Vec<String>,
    ) -> Self {
        self.cli_config = IssuerConfig {
            node_id,
            port,
            rpc_url: rpc,
            bls_key_path,
            peers,
            log_level,
            log_dir,
            json_logs,
            ..Default::default()
        };
        self
    }

    /// Set the MockBitgetVault address CLI override.
    ///
    /// When set, issuers read fill data from MockBitgetVault.getFill()
    /// instead of polling in-memory MockBitget (FR13: no direct AP communication).
    pub fn with_bitget_vault(mut self, address: Option<String>) -> Self {
        self.cli_config.bitget_vault = address;
        self
    }

    /// Set the IssuerCustody L3 address CLI override (Story 7.7).
    ///
    /// IssuerCustody L3 holds L3Usdc after bridge from Arbitrum.
    /// Used for BLS-signed transfers to Index contract in submitOrder flow.
    pub fn with_issuer_custody_l3(mut self, address: Option<String>) -> Self {
        self.cli_config.issuer_custody_l3 = address;
        self
    }

    /// Set the IssuerCustody Arbitrum address CLI override (Story 7.7).
    ///
    /// IssuerCustody Arb holds ArbUSDC after bridge from L3.
    /// Used for BLS-signed transfers to MockBitgetVault in vault release flow.
    pub fn with_issuer_custody_arb(mut self, address: Option<String>) -> Self {
        self.cli_config.issuer_custody_arb = address;
        self
    }

    /// Set the ArbBridgeCustody address CLI override (Story 7.8).
    ///
    /// ArbBridgeCustody locks user's ArbUSDC when buying ITP from Arbitrum.
    /// Issuers observe CrossChainOrderCreated events for cross-chain buy flow.
    pub fn with_arb_custody(mut self, address: Option<String>) -> Self {
        self.cli_config.arb_custody = address;
        self
    }

    /// Set the MockUSDT address CLI override (Story 7.18).
    ///
    /// When set, issuer fill verification accepts this address as a valid USDT token.
    pub fn with_mock_usdt(mut self, address: Option<String>) -> Self {
        self.cli_config.mock_usdt = address;
        self
    }

    /// Enable the registry sync endpoint (Story 8.4, Task 7.1).
    ///
    /// When enabled, the issuer watches for RegistryStateChanged events from L3 IssuerRegistry
    /// and serves BLS-signed registry state proofs via GET /api/registry-sync endpoint.
    pub fn with_registry_sync(mut self, enabled: bool) -> Self {
        if enabled {
            self.cli_config.registry_sync_enabled = Some(true);
        }
        self
    }

    /// Set arbitration subsystem CLI overrides.
    ///
    /// Configures the arbitration subsystem for resolving bilateral bet disputes
    /// via BLS consensus among issuers.
    pub fn with_arbitration(
        mut self,
        enabled: Option<bool>,
        vault: Option<String>,
        settlement: Option<String>,
        threshold: Option<usize>,
        data_node_url: Option<String>,
    ) -> Self {
        if enabled.is_some() {
            self.cli_config.arbitration_enabled = enabled;
        }
        if let Some(ref v) = vault {
            self.cli_config.arbitration_collateral_vault = Some(v.clone());
        }
        if let Some(ref v) = settlement {
            self.cli_config.arbitration_settlement_contract = Some(v.clone());
        }
        if threshold.is_some() {
            self.cli_config.arbitration_threshold = threshold;
        }
        if let Some(ref v) = data_node_url {
            self.cli_config.arbitration_data_node_url = Some(v.clone());
        }
        self
    }

    /// Set Vision subsystem configuration from CLI args.
    ///
    /// When `enabled` is `Some(true)`, the Vision tick engine, scheduler, bitmap store,
    /// resolver, and API routes will be initialized alongside the existing ITP loop.
    pub fn with_vision(mut self, config: Option<crate::vision::config::VisionConfig>) -> Self {
        if let Some(cfg) = config {
            self.cli_config.vision = Some(cfg);
        }
        self
    }

    /// Set the bearer token for data-node HTTP requests.
    ///
    /// Shared across Vision, Arbitration, and NAV subsystems.
    pub fn with_data_node_token(mut self, token: Option<String>) -> Self {
        if token.is_some() {
            self.cli_config.data_node_token = token;
        }
        self
    }

    /// Build the final configuration.
    ///
    /// Resolution order: CLI > ENV > Config file > Deployment file > Defaults
    ///
    /// # Errors
    ///
    /// - `ConfigError::FileRead` if the config file cannot be read
    /// - `ConfigError::YamlParse` or `ConfigError::TomlParse` on parse errors
    /// - `ConfigError::InvalidNodeId` if node_id is outside valid range
    /// - `ConfigError::DeploymentFileParse` if the deployment file is invalid
    pub fn build(self) -> Result<IssuerConfig, ConfigError> {
        // Start with defaults
        let mut config = IssuerConfig::default();

        // Layer 1: Load from config file if provided
        if let Some(path) = &self.config_file_path {
            let file_config = IssuerConfig::from_file(path)?;
            config.merge(&file_config);
        }

        // Layer 2: Override with environment variables
        let env_config = IssuerConfig::from_env();
        config.merge(&env_config);

        // Layer 3: Override with CLI arguments (highest priority)
        config.merge(&self.cli_config);

        // Layer 0 (lowest): Load deployment file for any still-unset addresses
        // Deployment file path can come from: CLI flag, env var, or config file
        let deployment_path = self
            .deployment_file_path
            .or_else(|| config.deployment_file.clone());
        if let Some(path) = deployment_path {
            config.load_deployment_file(&path)?;
        }

        // Validate the final configuration
        config.validate()?;

        Ok(config)
    }
}

/// Validate that data-node URLs use HTTPS in production mode.
/// Plain HTTP is only allowed when --mock is set.
pub fn validate_data_node_url(url: &str, is_mock: bool) -> Result<(), String> {
    if !is_mock && url.starts_with("http://") {
        // Allow localhost HTTP for local dev (no --mock needed)
        let is_localhost = url.starts_with("http://localhost") || url.starts_with("http://127.0.0.1");
        if !is_localhost {
            return Err(format!(
                "Data-node URL '{}' uses plain HTTP. Use HTTPS in production, or pass --mock for development.",
                url
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    /// Helper to safely run tests with environment variables.
    /// Ensures cleanup even if the test panics.
    struct EnvGuard {
        vars: Vec<&'static str>,
    }

    impl EnvGuard {
        fn new(vars: &[(&'static str, &str)]) -> Self {
            for (name, value) in vars {
                std::env::set_var(name, value);
            }
            Self {
                vars: vars.iter().map(|(name, _)| *name).collect(),
            }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            for name in &self.vars {
                std::env::remove_var(name);
            }
        }
    }

    #[test]
    fn test_config_from_yaml() {
        let yaml_content = r#"
node_id: 5
port: 9005
rpc_url: "http://example.com:8545"
bls_key_path: "./keys/bls.key"
peers:
  - "issuer2.local:9002"
  - "issuer3.local:9003"
log_level: "debug"
log_dir: "./custom-logs"
json_logs: true
"#;

        let mut file = NamedTempFile::with_suffix(".yaml").unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = IssuerConfig::from_file(file.path()).unwrap();

        assert_eq!(config.node_id, Some(5));
        assert_eq!(config.port, Some(9005));
        assert_eq!(config.rpc_url, Some("http://example.com:8545".to_string()));
        assert_eq!(config.bls_key_path, Some(PathBuf::from("./keys/bls.key")));
        assert_eq!(
            config.peers,
            vec!["issuer2.local:9002", "issuer3.local:9003"]
        );
        assert_eq!(config.log_level, Some("debug".to_string()));
        assert_eq!(config.log_dir, Some(PathBuf::from("./custom-logs")));
        assert_eq!(config.json_logs, Some(true));
    }

    #[test]
    fn test_config_from_toml() {
        let toml_content = r#"
node_id = 7
port = 9007
rpc_url = "http://toml-example.com:8545"
bls_key_path = "./keys/toml.key"
peers = ["peer1.local:9001", "peer2.local:9002"]
log_level = "warn"
log_dir = "./toml-logs"
json_logs = false
"#;

        let mut file = NamedTempFile::with_suffix(".toml").unwrap();
        file.write_all(toml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = IssuerConfig::from_file(file.path()).unwrap();

        assert_eq!(config.node_id, Some(7));
        assert_eq!(config.port, Some(9007));
        assert_eq!(
            config.rpc_url,
            Some("http://toml-example.com:8545".to_string())
        );
        assert_eq!(config.bls_key_path, Some(PathBuf::from("./keys/toml.key")));
        assert_eq!(config.peers, vec!["peer1.local:9001", "peer2.local:9002"]);
        assert_eq!(config.log_level, Some("warn".to_string()));
        assert_eq!(config.log_dir, Some(PathBuf::from("./toml-logs")));
        assert_eq!(config.json_logs, Some(false));
    }

    #[test]
    fn test_config_unsupported_format() {
        let mut file = NamedTempFile::with_suffix(".json").unwrap();
        file.write_all(b"{}").unwrap();
        file.flush().unwrap();

        let result = IssuerConfig::from_file(file.path());
        assert!(matches!(result, Err(ConfigError::UnsupportedFormat(_))));
    }

    #[test]
    fn test_config_merge() {
        let mut base = IssuerConfig {
            node_id: Some(1),
            port: Some(9001),
            rpc_url: Some("http://base.com".to_string()),
            bls_key_path: None,
            peers: vec!["peer1.local".to_string()],
            log_level: Some("info".to_string()),
            log_dir: None,
            json_logs: None,
            ..Default::default()
        };

        let override_config = IssuerConfig {
            node_id: Some(2),
            port: None, // Should not override
            rpc_url: Some("http://override.com".to_string()),
            bls_key_path: Some(PathBuf::from("./keys/new.key")),
            peers: Vec::new(), // Empty, should not override
            log_level: None,   // Should not override
            log_dir: Some(PathBuf::from("./new-logs")),
            json_logs: Some(true),
            ..Default::default()
        };

        base.merge(&override_config);

        assert_eq!(base.node_id, Some(2)); // Overridden
        assert_eq!(base.port, Some(9001)); // Not overridden
        assert_eq!(base.rpc_url, Some("http://override.com".to_string())); // Overridden
        assert_eq!(base.bls_key_path, Some(PathBuf::from("./keys/new.key"))); // Overridden
        assert_eq!(base.peers, vec!["peer1.local".to_string()]); // Not overridden (empty)
        assert_eq!(base.log_level, Some("info".to_string())); // Not overridden
        assert_eq!(base.log_dir, Some(PathBuf::from("./new-logs"))); // Overridden
        assert_eq!(base.json_logs, Some(true)); // Overridden
    }

    #[test]
    fn test_config_validation_valid() {
        let config = IssuerConfig {
            node_id: Some(10),
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_config_validation_invalid_node_id_zero() {
        let config = IssuerConfig {
            node_id: Some(0),
            ..Default::default()
        };
        assert!(matches!(
            config.validate(),
            Err(ConfigError::InvalidNodeId(0))
        ));
    }

    #[test]
    fn test_config_validation_invalid_node_id_too_high() {
        let config = IssuerConfig {
            node_id: Some(21),
            ..Default::default()
        };
        assert!(matches!(
            config.validate(),
            Err(ConfigError::InvalidNodeId(21))
        ));
    }

    #[test]
    fn test_effective_defaults() {
        let config = IssuerConfig {
            node_id: Some(3),
            ..Default::default()
        };

        assert_eq!(config.effective_port(), 9003);
        assert_eq!(config.effective_rpc_url(), "http://localhost:8545");
        assert_eq!(config.effective_log_level(), "info");
        assert_eq!(config.effective_log_dir(), PathBuf::from("logs"));
        assert!(!config.effective_json_logs());
    }

    #[test]
    fn test_config_builder_cli_override() {
        let yaml_content = r#"
node_id: 1
port: 9001
rpc_url: "http://file.com:8545"
"#;

        let mut file = NamedTempFile::with_suffix(".yaml").unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = ConfigBuilder::new()
            .with_config_file(Some(file.path().to_path_buf()))
            .with_cli_args(
                Some(5),                                 // Override node_id
                None,                                    // Don't override port
                Some("http://cli.com:8545".to_string()), // Override rpc
                None,                                    // bls_key_path
                None,                                    // log_level
                None,                                    // log_dir
                None,                                    // json_logs
                vec![],                                  // peers
            )
            .build()
            .unwrap();

        assert_eq!(config.node_id, Some(5)); // CLI override
        assert_eq!(config.port, Some(9001)); // From file
        assert_eq!(config.rpc_url, Some("http://cli.com:8545".to_string())); // CLI override
    }

    #[test]
    fn test_config_builder_priority_order() {
        // This test verifies: CLI > ENV > Config file
        let yaml_content = r#"
node_id: 1
port: 9001
log_level: "trace"
"#;

        let mut file = NamedTempFile::with_suffix(".yaml").unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        // Use EnvGuard for safe cleanup even on panic
        let _guard = EnvGuard::new(&[("ISSUER_NODE_ID", "10"), ("ISSUER_LOG_LEVEL", "debug")]);

        let config = ConfigBuilder::new()
            .with_config_file(Some(file.path().to_path_buf()))
            .with_cli_args(
                Some(15), // CLI has highest priority
                None,
                None,
                None,
                None, // log_level not set in CLI, so ENV should win
                None,
                None,
                vec![],
            )
            .build()
            .unwrap();

        assert_eq!(config.node_id, Some(15)); // CLI wins
        assert_eq!(config.port, Some(9001)); // From file (no CLI or ENV override)
        assert_eq!(config.log_level, Some("debug".to_string())); // ENV wins over file
    }

    #[test]
    fn test_config_builder_with_peers() {
        let config = ConfigBuilder::new()
            .with_cli_args(
                Some(1),
                None,
                None,
                None,
                None,
                None,
                None,
                vec!["peer1:9001".to_string(), "peer2:9002".to_string()],
            )
            .build()
            .unwrap();

        assert_eq!(config.peers, vec!["peer1:9001", "peer2:9002"]);
    }

    #[test]
    fn test_config_builder_with_bls_key_path() {
        let config = ConfigBuilder::new()
            .with_cli_args(
                Some(1),
                None,
                None,
                Some(PathBuf::from("./keys/test.key")),
                None,
                None,
                None,
                vec![],
            )
            .build()
            .unwrap();

        assert_eq!(config.bls_key_path, Some(PathBuf::from("./keys/test.key")));
    }

    #[test]
    fn test_load_deployment_file_l3_testnet_format() {
        let json_content = r#"{
            "chainId": 111222333,
            "contracts": {
                "Governance": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                "IssuerRegistry": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
                "Index": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
                "BLSCustody": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
                "L3BridgeCustody": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
                "CollateralRegistry": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
            }
        }"#;

        let mut file = NamedTempFile::with_suffix(".json").unwrap();
        file.write_all(json_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let mut config = IssuerConfig::default();
        config.load_deployment_file(file.path()).unwrap();

        assert_eq!(
            config.index_address,
            Some("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512".to_string())
        );
        assert_eq!(
            config.governance_address,
            Some("0x5FbDB2315678afecb367f032d93F642f64180aa3".to_string())
        );
        assert_eq!(
            config.issuer_registry_address,
            Some("0x5FC8d32690cc91D4c39d9d3abcBD16989F875707".to_string())
        );
        assert_eq!(
            config.collateral_registry_address,
            Some("0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9".to_string())
        );
        assert_eq!(
            config.bls_custody_address,
            Some("0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9".to_string())
        );
        assert_eq!(
            config.l3_bridge_custody_address,
            Some("0x0165878A594ca255338adfa4d48449f69242Eb8F".to_string())
        );
    }

    #[test]
    fn test_load_deployment_file_does_not_override_existing() {
        let json_content = r#"{
            "chainId": 111222333,
            "contracts": {
                "Index": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
                "Governance": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
            }
        }"#;

        let mut file = NamedTempFile::with_suffix(".json").unwrap();
        file.write_all(json_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let mut config = IssuerConfig {
            index_address: Some("0x1111111111111111111111111111111111111111".to_string()),
            ..Default::default()
        };
        config.load_deployment_file(file.path()).unwrap();

        // Index should NOT be overridden (already set)
        assert_eq!(
            config.index_address,
            Some("0x1111111111111111111111111111111111111111".to_string())
        );
        // Governance should be loaded (was not set)
        assert_eq!(
            config.governance_address,
            Some("0x5FbDB2315678afecb367f032d93F642f64180aa3".to_string())
        );
    }

    #[test]
    fn test_load_deployment_file_missing_contracts_field() {
        let json_content = r#"{ "chainId": 111222333 }"#;

        let mut file = NamedTempFile::with_suffix(".json").unwrap();
        file.write_all(json_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let mut config = IssuerConfig::default();
        let result = config.load_deployment_file(file.path());
        assert!(matches!(result, Err(ConfigError::DeploymentFileParse(_))));
    }

    #[test]
    fn test_effective_contract_addresses() {
        let config = IssuerConfig {
            index_address: Some("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512".to_string()),
            governance_address: Some("0x5FbDB2315678afecb367f032d93F642f64180aa3".to_string()),
            issuer_registry_address: Some("0x5FC8d32690cc91D4c39d9d3abcBD16989F875707".to_string()),
            ..Default::default()
        };

        let addrs = config.effective_contract_addresses().unwrap();
        assert_ne!(addrs.index, Address::zero());
        assert_ne!(addrs.governance, Address::zero());
        assert_ne!(addrs.issuer_registry, Address::zero());
    }

    #[test]
    fn test_effective_contract_addresses_defaults_to_zero() {
        let config = IssuerConfig::default();
        let addrs = config.effective_contract_addresses().unwrap();
        assert_eq!(addrs.index, Address::zero());
    }

    #[test]
    fn test_effective_contract_addresses_invalid_address() {
        let config = IssuerConfig {
            index_address: Some("not-an-address".to_string()),
            ..Default::default()
        };
        let result = config.effective_contract_addresses();
        assert!(result.is_err());
    }

    #[test]
    fn test_effective_writer_addresses() {
        let config = IssuerConfig {
            index_address: Some("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512".to_string()),
            l3_bridge_custody_address: Some(
                "0x0165878A594ca255338adfa4d48449f69242Eb8F".to_string(),
            ),
            ..Default::default()
        };

        let addrs = config.effective_writer_addresses().unwrap();
        assert_ne!(addrs.index, Address::zero());
        assert_ne!(addrs.l3_bridge_custody, Address::zero());
    }

    #[test]
    fn test_validate_contract_addresses_all_zero_fails() {
        let config = IssuerConfig::default();
        let result = config.validate_contract_addresses();
        assert!(matches!(
            result,
            Err(ConfigError::InvalidContractAddress { .. })
        ));
    }

    #[test]
    fn test_validate_contract_addresses_all_set_passes() {
        let config = IssuerConfig {
            index_address: Some("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512".to_string()),
            governance_address: Some("0x5FbDB2315678afecb367f032d93F642f64180aa3".to_string()),
            issuer_registry_address: Some("0x5FC8d32690cc91D4c39d9d3abcBD16989F875707".to_string()),
            l3_bridge_custody_address: Some(
                "0x0165878A594ca255338adfa4d48449f69242Eb8F".to_string(),
            ),
            ..Default::default()
        };
        assert!(config.validate_contract_addresses().is_ok());
    }

    #[test]
    fn test_env_var_contract_addresses() {
        let _guard = EnvGuard::new(&[
            (
                "ISSUER_INDEX_ADDRESS",
                "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
            ),
            (
                "ISSUER_GOVERNANCE_ADDRESS",
                "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            ),
        ]);

        let config = IssuerConfig::from_env();
        assert_eq!(
            config.index_address,
            Some("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512".to_string())
        );
        assert_eq!(
            config.governance_address,
            Some("0x5FbDB2315678afecb367f032d93F642f64180aa3".to_string())
        );
    }

    #[test]
    fn test_config_yaml_with_contract_addresses() {
        let yaml_content = r#"
node_id: 1
index_address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
governance_address: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
issuer_registry_address: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"
l3_bridge_custody_address: "0x0165878A594ca255338adfa4d48449f69242Eb8F"
"#;

        let mut file = NamedTempFile::with_suffix(".yaml").unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = IssuerConfig::from_file(file.path()).unwrap();
        assert_eq!(
            config.index_address,
            Some("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512".to_string())
        );
        assert!(config.effective_contract_addresses().is_ok());
    }

    #[test]
    fn test_config_builder_with_deployment_file() {
        let json_content = r#"{
            "chainId": 111222333,
            "contracts": {
                "Index": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
                "Governance": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                "IssuerRegistry": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
                "CollateralRegistry": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
                "BLSCustody": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
                "L3BridgeCustody": "0x0165878A594ca255338adfa4d48449f69242Eb8F"
            }
        }"#;

        let mut file = NamedTempFile::with_suffix(".json").unwrap();
        file.write_all(json_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = ConfigBuilder::new()
            .with_deployment_file(Some(file.path().to_path_buf()))
            .with_cli_args(Some(1), None, None, None, None, None, None, vec![])
            .build()
            .unwrap();

        assert_eq!(
            config.index_address,
            Some("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512".to_string())
        );
        assert!(config.validate_contract_addresses().is_ok());
    }

    #[test]
    fn test_merge_preserves_new_fields() {
        let mut base = IssuerConfig {
            index_address: Some("0x1111111111111111111111111111111111111111".to_string()),
            ..Default::default()
        };

        let other = IssuerConfig {
            governance_address: Some("0x2222222222222222222222222222222222222222".to_string()),
            ..Default::default()
        };

        base.merge(&other);
        assert_eq!(
            base.index_address,
            Some("0x1111111111111111111111111111111111111111".to_string())
        );
        assert_eq!(
            base.governance_address,
            Some("0x2222222222222222222222222222222222222222".to_string())
        );
    }

    #[test]
    fn test_effective_private_key_from_field() {
        let config = IssuerConfig {
            private_key: Some(
                "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80".to_string(),
            ),
            ..Default::default()
        };
        let key = config.effective_private_key().unwrap();
        assert!(key.is_some());
        assert!(key.unwrap().starts_with("0x"));
    }

    #[test]
    fn test_effective_private_key_from_file() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(b"ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\n")
            .unwrap();
        file.flush().unwrap();

        let config = IssuerConfig {
            private_key_path: Some(file.path().to_path_buf()),
            ..Default::default()
        };
        let key = config.effective_private_key().unwrap();
        assert!(key.is_some());
        assert_eq!(
            key.unwrap(),
            "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        );
    }

    #[test]
    fn test_effective_private_key_none() {
        let config = IssuerConfig::default();
        let key = config.effective_private_key().unwrap();
        assert!(key.is_none());
    }

    // ============ ISSUER CUSTODY TESTS (Story 7.7) ============

    #[test]
    fn test_effective_issuer_custody_l3_valid() {
        let config = IssuerConfig {
            issuer_custody_l3: Some("0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1".to_string()),
            ..Default::default()
        };
        let addr = config.effective_issuer_custody_l3();
        assert!(addr.is_some());
        assert_ne!(addr.unwrap(), Address::zero());
    }

    #[test]
    fn test_effective_issuer_custody_l3_none() {
        let config = IssuerConfig::default();
        assert!(config.effective_issuer_custody_l3().is_none());
    }

    #[test]
    fn test_effective_issuer_custody_l3_invalid() {
        let config = IssuerConfig {
            issuer_custody_l3: Some("not-an-address".to_string()),
            ..Default::default()
        };
        // Invalid address returns None (parse fails silently)
        assert!(config.effective_issuer_custody_l3().is_none());
    }

    #[test]
    fn test_effective_issuer_custody_arb_valid() {
        let config = IssuerConfig {
            issuer_custody_arb: Some("0x0E801D84Fa97b50751Dbf25036d067dCf18858bF".to_string()),
            ..Default::default()
        };
        let addr = config.effective_issuer_custody_arb();
        assert!(addr.is_some());
        assert_ne!(addr.unwrap(), Address::zero());
    }

    #[test]
    fn test_effective_issuer_custody_arb_none() {
        let config = IssuerConfig::default();
        assert!(config.effective_issuer_custody_arb().is_none());
    }

    #[test]
    fn test_validate_custody_addresses_both_set() {
        let config = IssuerConfig {
            issuer_custody_l3: Some("0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1".to_string()),
            issuer_custody_arb: Some("0x0E801D84Fa97b50751Dbf25036d067dCf18858bF".to_string()),
            ..Default::default()
        };
        assert!(config.validate_custody_addresses().is_ok());
    }

    #[test]
    fn test_validate_custody_addresses_l3_missing() {
        let config = IssuerConfig {
            issuer_custody_arb: Some("0x0E801D84Fa97b50751Dbf25036d067dCf18858bF".to_string()),
            ..Default::default()
        };
        let result = config.validate_custody_addresses();
        assert!(matches!(result, Err(ConfigError::MissingField("issuer_custody_l3"))));
    }

    #[test]
    fn test_validate_custody_addresses_arb_missing() {
        let config = IssuerConfig {
            issuer_custody_l3: Some("0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1".to_string()),
            ..Default::default()
        };
        let result = config.validate_custody_addresses();
        assert!(matches!(result, Err(ConfigError::MissingField("issuer_custody_arb"))));
    }

    #[test]
    fn test_validate_custody_addresses_l3_invalid() {
        let config = IssuerConfig {
            issuer_custody_l3: Some("not-an-address".to_string()),
            issuer_custody_arb: Some("0x0E801D84Fa97b50751Dbf25036d067dCf18858bF".to_string()),
            ..Default::default()
        };
        let result = config.validate_custody_addresses();
        assert!(matches!(result, Err(ConfigError::InvalidAddress { .. })));
    }

    #[test]
    fn test_config_merge_custody_addresses() {
        let mut base = IssuerConfig {
            issuer_custody_l3: Some("0x1111111111111111111111111111111111111111".to_string()),
            ..Default::default()
        };

        let other = IssuerConfig {
            issuer_custody_l3: Some("0x2222222222222222222222222222222222222222".to_string()),
            issuer_custody_arb: Some("0x3333333333333333333333333333333333333333".to_string()),
            ..Default::default()
        };

        base.merge(&other);

        // issuer_custody_l3 should be overridden
        assert_eq!(
            base.issuer_custody_l3,
            Some("0x2222222222222222222222222222222222222222".to_string())
        );
        // issuer_custody_arb should be set
        assert_eq!(
            base.issuer_custody_arb,
            Some("0x3333333333333333333333333333333333333333".to_string())
        );
    }

    #[test]
    fn test_config_builder_with_custody_addresses() {
        let config = ConfigBuilder::new()
            .with_cli_args(Some(1), None, None, None, None, None, None, vec![])
            .with_issuer_custody_l3(Some("0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1".to_string()))
            .with_issuer_custody_arb(Some("0x0E801D84Fa97b50751Dbf25036d067dCf18858bF".to_string()))
            .build()
            .unwrap();

        assert_eq!(
            config.issuer_custody_l3,
            Some("0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1".to_string())
        );
        assert_eq!(
            config.issuer_custody_arb,
            Some("0x0E801D84Fa97b50751Dbf25036d067dCf18858bF".to_string())
        );
        assert!(config.validate_custody_addresses().is_ok());
    }

    #[test]
    fn test_load_deployment_file_with_custody_addresses() {
        let json_content = r#"{
            "chainId": 111222333,
            "contracts": {
                "Index": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
                "IssuerCustodyL3": "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1",
                "IssuerCustodyArb": "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF"
            }
        }"#;

        let mut file = NamedTempFile::with_suffix(".json").unwrap();
        file.write_all(json_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let mut config = IssuerConfig::default();
        config.load_deployment_file(file.path()).unwrap();

        assert_eq!(
            config.issuer_custody_l3,
            Some("0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1".to_string())
        );
        assert_eq!(
            config.issuer_custody_arb,
            Some("0x0E801D84Fa97b50751Dbf25036d067dCf18858bF".to_string())
        );
    }

    #[test]
    fn test_env_var_custody_addresses() {
        let _guard = EnvGuard::new(&[
            ("ISSUER_CUSTODY_L3", "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1"),
            ("ISSUER_CUSTODY_ARB", "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF"),
        ]);

        let config = IssuerConfig::from_env();
        assert_eq!(
            config.issuer_custody_l3,
            Some("0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1".to_string())
        );
        assert_eq!(
            config.issuer_custody_arb,
            Some("0x0E801D84Fa97b50751Dbf25036d067dCf18858bF".to_string())
        );
    }

    // ============ ARB_CUSTODY TESTS (Story 7.8) ============

    #[test]
    fn test_effective_arb_custody_valid() {
        let config = IssuerConfig {
            arb_custody: Some("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0".to_string()),
            ..Default::default()
        };
        let addr = config.effective_arb_custody();
        assert!(addr.is_some());
        assert_ne!(addr.unwrap(), Address::zero());
    }

    #[test]
    fn test_effective_arb_custody_none() {
        let config = IssuerConfig::default();
        assert!(config.effective_arb_custody().is_none());
    }

    #[test]
    fn test_effective_arb_custody_invalid() {
        let config = IssuerConfig {
            arb_custody: Some("not-an-address".to_string()),
            ..Default::default()
        };
        // Invalid address returns None (parse fails silently)
        assert!(config.effective_arb_custody().is_none());
    }

    #[test]
    fn test_env_var_arb_custody() {
        let _guard = EnvGuard::new(&[
            ("ISSUER_ARB_CUSTODY", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"),
        ]);

        let config = IssuerConfig::from_env();
        assert_eq!(
            config.arb_custody,
            Some("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0".to_string())
        );
    }

    #[test]
    fn test_load_deployment_file_with_arb_custody() {
        let json_content = r#"{
            "chainId": 111222333,
            "contracts": {
                "Index": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
                "ArbBridgeCustody": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
            }
        }"#;

        let mut file = NamedTempFile::with_suffix(".json").unwrap();
        file.write_all(json_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let mut config = IssuerConfig::default();
        config.load_deployment_file(file.path()).unwrap();

        assert_eq!(
            config.arb_custody,
            Some("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0".to_string())
        );
    }

    #[test]
    fn test_load_deployment_file_with_arb_custody_alt_key() {
        // Test the alternative key name "ARB_CUSTODY"
        let json_content = r#"{
            "chainId": 111222333,
            "contracts": {
                "Index": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
                "ARB_CUSTODY": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
            }
        }"#;

        let mut file = NamedTempFile::with_suffix(".json").unwrap();
        file.write_all(json_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let mut config = IssuerConfig::default();
        config.load_deployment_file(file.path()).unwrap();

        assert_eq!(
            config.arb_custody,
            Some("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0".to_string())
        );
    }

    #[test]
    fn test_config_builder_with_arb_custody() {
        let config = ConfigBuilder::new()
            .with_cli_args(Some(1), None, None, None, None, None, None, vec![])
            .with_arb_custody(Some("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0".to_string()))
            .build()
            .unwrap();

        assert_eq!(
            config.arb_custody,
            Some("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0".to_string())
        );
        assert!(config.effective_arb_custody().is_some());
    }

    #[test]
    fn test_config_merge_arb_custody() {
        let mut base = IssuerConfig {
            arb_custody: Some("0x1111111111111111111111111111111111111111".to_string()),
            ..Default::default()
        };

        let other = IssuerConfig {
            arb_custody: Some("0x2222222222222222222222222222222222222222".to_string()),
            ..Default::default()
        };

        base.merge(&other);

        // arb_custody should be overridden
        assert_eq!(
            base.arb_custody,
            Some("0x2222222222222222222222222222222222222222".to_string())
        );
    }

    #[test]
    fn test_validate_data_node_url_rejects_http_remote_in_production() {
        let result = validate_data_node_url("http://data-node.example.com", false);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("plain HTTP"));
    }

    #[test]
    fn test_validate_data_node_url_allows_http_localhost() {
        // Localhost HTTP is always allowed (local dev without --mock)
        let result = validate_data_node_url("http://localhost:8200", false);
        assert!(result.is_ok());
        let result = validate_data_node_url("http://127.0.0.1:8200", false);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_data_node_url_allows_http_in_mock() {
        let result = validate_data_node_url("http://localhost:8200", true);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_data_node_url_allows_https_in_production() {
        let result = validate_data_node_url("https://data-node.example.com", false);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_data_node_url_allows_https_in_mock() {
        let result = validate_data_node_url("https://data-node.example.com", true);
        assert!(result.is_ok());
    }
}
