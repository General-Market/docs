//! Configuration management for the AP (Authorized Participant) service.
//!
//! Supports configuration from multiple sources with priority:
//! CLI arguments > Environment variables > Config file > Defaults

use serde::{Deserialize, Serialize};
use std::fmt;
use std::path::PathBuf;
use thiserror::Error;
use tracing::warn;

/// Configuration errors
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Failed to read config file: {0}")]
    FileRead(#[from] std::io::Error),

    #[error("Failed to parse YAML config: {0}")]
    YamlParse(#[from] serde_yaml::Error),

    #[error("Invalid port: port 0 is reserved, got {0}")]
    InvalidPort(u16),

    #[error("Invalid environment variable '{name}': {reason}")]
    InvalidEnvVar { name: &'static str, reason: String },
}

/// AP service configuration
///
/// All fields are optional to support the layered configuration pattern.
/// Use `effective_*` methods to get the final value with defaults applied.
///
/// Note: Debug is manually implemented to redact sensitive fields (API keys/secrets).
#[derive(Clone, Serialize, Deserialize, Default)]
pub struct APConfig {
    /// API listen port (default: 9100)
    pub port: Option<u16>,

    /// Chain RPC endpoint (default: http://localhost:8545)
    pub rpc_url: Option<String>,

    /// Index.sol contract address (hex string, e.g., "0x1234...")
    /// Required for event monitoring to filter events from the correct contract.
    pub index_contract: Option<String>,

    /// Use mock Bitget client (for local development)
    pub mock_bitget: Option<bool>,

    /// Bitget API key (for live trading)
    #[serde(default)]
    pub bitget_api_key: Option<String>,

    /// Bitget API secret (for live trading)
    #[serde(default)]
    pub bitget_api_secret: Option<String>,

    /// Bitget API passphrase (for live trading - required by Bitget API)
    #[serde(default)]
    pub bitget_api_passphrase: Option<String>,

    /// Log level (trace, debug, info, warn, error)
    pub log_level: Option<String>,

    /// Log output directory
    pub log_dir: Option<PathBuf>,

    /// Output logs as JSON
    pub json_logs: Option<bool>,

    /// Use Bitget testnet (default: true for safety)
    #[serde(default)]
    pub bitget_testnet: Option<bool>,

    /// Path to deployment JSON file (e.g., deployments/l3-testnet.json)
    /// When set, the AP uses real chain adapters (RpcChainReader/Writer)
    pub deployment_file: Option<PathBuf>,

    /// Force mock chain even when deployment_file is set
    /// Default: true if no deployment_file, false if deployment_file provided
    pub mock_chain: Option<bool>,

    /// Private key for transaction signing (hex, loaded from env only)
    #[serde(default, skip_serializing)]
    pub private_key: Option<String>,

    /// MockBitgetVault contract address for on-chain trade settlement (E2E testing)
    /// When set with --mock-bitget, AP also calls MockBitgetVault.executeTrade() on-chain
    pub bitget_vault: Option<String>,

    /// Override chain ID (default: 111222333 for Index L3)
    /// Use for local testing with custom Anvil chain IDs
    pub chain_id: Option<u64>,

    /// MockUSDT token contract address for USDT-pair settlement (Story 7.18)
    /// When set, AP uses this address for trades with USDT-denominated symbols (e.g., BTCUSDT)
    pub mock_usdt: Option<String>,

    /// Data-node backend URL (e.g., http://localhost:8200)
    /// When set, /nav fetches NAV from data-node instead of computing locally
    pub data_node_url: Option<String>,

    /// Arbitrum RPC endpoint for on-chain settlement (default: http://localhost:8546)
    /// Used by BitgetVaultClient when MockBitgetVault is on Arbitrum chain
    pub arb_rpc_url: Option<String>,

    /// Arbitrum chain ID (default: 42161)
    pub arb_chain_id: Option<u64>,

    /// Exchange mode: mock, testnet, or mainnet. Supersedes mock_bitget and bitget_testnet flags.
    pub exchange_mode: Option<String>,
}

/// Custom Debug implementation that redacts sensitive fields
impl fmt::Debug for APConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("APConfig")
            .field("port", &self.port)
            .field("rpc_url", &self.rpc_url)
            .field("index_contract", &self.index_contract)
            .field("mock_bitget", &self.mock_bitget)
            .field(
                "bitget_api_key",
                &self.bitget_api_key.as_ref().map(|_| "[REDACTED]"),
            )
            .field(
                "bitget_api_secret",
                &self.bitget_api_secret.as_ref().map(|_| "[REDACTED]"),
            )
            .field(
                "bitget_api_passphrase",
                &self.bitget_api_passphrase.as_ref().map(|_| "[REDACTED]"),
            )
            .field("log_level", &self.log_level)
            .field("log_dir", &self.log_dir)
            .field("json_logs", &self.json_logs)
            .field("bitget_testnet", &self.bitget_testnet)
            .field("deployment_file", &self.deployment_file)
            .field("mock_chain", &self.mock_chain)
            .field(
                "private_key",
                &self.private_key.as_ref().map(|_| "[REDACTED]"),
            )
            .field("bitget_vault", &self.bitget_vault)
            .field("chain_id", &self.chain_id)
            .field("mock_usdt", &self.mock_usdt)
            .field("data_node_url", &self.data_node_url)
            .field("arb_rpc_url", &self.arb_rpc_url)
            .field("arb_chain_id", &self.arb_chain_id)
            .field("exchange_mode", &self.exchange_mode)
            .finish()
    }
}

impl APConfig {
    /// Load configuration from a YAML file
    pub fn from_file(path: &PathBuf) -> Result<Self, ConfigError> {
        let contents = std::fs::read_to_string(path)?;
        let config: APConfig = serde_yaml::from_str(&contents)?;
        Ok(config)
    }

    /// Load configuration from environment variables
    ///
    /// Logs warnings for invalid environment variable values to help debug misconfiguration.
    pub fn from_env() -> Self {
        APConfig {
            port: std::env::var("AP_PORT").ok().and_then(|v| {
                v.parse().ok().or_else(|| {
                    warn!(value = %v, "Invalid AP_PORT value, expected integer");
                    None
                })
            }),
            rpc_url: std::env::var("AP_RPC_URL").ok(),
            index_contract: std::env::var("AP_INDEX_CONTRACT").ok(),
            mock_bitget: std::env::var("AP_MOCK_BITGET").ok().and_then(|v| {
                v.parse().ok().or_else(|| {
                    warn!(value = %v, "Invalid AP_MOCK_BITGET value, expected true/false");
                    None
                })
            }),
            bitget_api_key: std::env::var("BITGET_API_KEY").ok(),
            bitget_api_secret: std::env::var("BITGET_API_SECRET").ok(),
            bitget_api_passphrase: std::env::var("BITGET_API_PASSPHRASE").ok(),
            log_level: std::env::var("AP_LOG_LEVEL").ok(),
            log_dir: std::env::var("AP_LOG_DIR").ok().map(PathBuf::from),
            json_logs: std::env::var("AP_JSON_LOGS").ok().and_then(|v| {
                v.parse().ok().or_else(|| {
                    warn!(value = %v, "Invalid AP_JSON_LOGS value, expected true/false");
                    None
                })
            }),
            bitget_testnet: {
                // BITGET_TESTNET=true means testnet, BITGET_MAINNET=true means mainnet (testnet=false)
                let testnet = std::env::var("BITGET_TESTNET").ok().and_then(|v| v.parse::<bool>().ok());
                let mainnet = std::env::var("BITGET_MAINNET").ok().and_then(|v| v.parse::<bool>().ok());
                match (testnet, mainnet) {
                    (Some(t), _) => Some(t),
                    (None, Some(m)) => Some(!m), // mainnet=true means testnet=false
                    (None, None) => None,
                }
            },
            deployment_file: std::env::var("AP_DEPLOYMENT_FILE").ok().map(PathBuf::from),
            mock_chain: std::env::var("AP_MOCK_CHAIN").ok().and_then(|v| {
                v.parse().ok().or_else(|| {
                    warn!(value = %v, "Invalid AP_MOCK_CHAIN value, expected true/false");
                    None
                })
            }),
            private_key: std::env::var("AP_PRIVATE_KEY").ok(),
            bitget_vault: std::env::var("AP_BITGET_VAULT").ok(),
            chain_id: std::env::var("AP_CHAIN_ID").ok().and_then(|v| {
                v.parse().ok().or_else(|| {
                    warn!(value = %v, "Invalid AP_CHAIN_ID value, expected integer");
                    None
                })
            }),
            mock_usdt: std::env::var("AP_MOCK_USDT").ok(),
            data_node_url: std::env::var("AP_DATA_NODE_URL").ok(),
            arb_rpc_url: std::env::var("AP_ARBITRUM_RPC_URL").ok(),
            arb_chain_id: std::env::var("AP_ARBITRUM_CHAIN_ID").ok().and_then(|v| {
                v.parse().ok().or_else(|| {
                    warn!(value = %v, "Invalid AP_ARBITRUM_CHAIN_ID value, expected integer");
                    None
                })
            }),
            exchange_mode: std::env::var("EXCHANGE_MODE").ok(),
        }
    }

    /// Merge another config into this one, where `other` takes precedence
    pub fn merge(&mut self, other: &APConfig) {
        if other.port.is_some() {
            self.port = other.port;
        }
        if other.rpc_url.is_some() {
            self.rpc_url = other.rpc_url.clone();
        }
        if other.index_contract.is_some() {
            self.index_contract = other.index_contract.clone();
        }
        if other.mock_bitget.is_some() {
            self.mock_bitget = other.mock_bitget;
        }
        if other.bitget_api_key.is_some() {
            self.bitget_api_key = other.bitget_api_key.clone();
        }
        if other.bitget_api_secret.is_some() {
            self.bitget_api_secret = other.bitget_api_secret.clone();
        }
        if other.bitget_api_passphrase.is_some() {
            self.bitget_api_passphrase = other.bitget_api_passphrase.clone();
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
        if other.bitget_testnet.is_some() {
            self.bitget_testnet = other.bitget_testnet;
        }
        if other.deployment_file.is_some() {
            self.deployment_file = other.deployment_file.clone();
        }
        if other.mock_chain.is_some() {
            self.mock_chain = other.mock_chain;
        }
        if other.private_key.is_some() {
            self.private_key = other.private_key.clone();
        }
        if other.bitget_vault.is_some() {
            self.bitget_vault = other.bitget_vault.clone();
        }
        if other.chain_id.is_some() {
            self.chain_id = other.chain_id;
        }
        if other.mock_usdt.is_some() {
            self.mock_usdt = other.mock_usdt.clone();
        }
        if other.data_node_url.is_some() {
            self.data_node_url = other.data_node_url.clone();
        }
        if other.arb_rpc_url.is_some() {
            self.arb_rpc_url = other.arb_rpc_url.clone();
        }
        if other.arb_chain_id.is_some() {
            self.arb_chain_id = other.arb_chain_id;
        }
        if other.exchange_mode.is_some() {
            self.exchange_mode = other.exchange_mode.clone();
        }
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<(), ConfigError> {
        if let Some(port) = self.port {
            if port == 0 {
                return Err(ConfigError::InvalidPort(port));
            }
        }
        Ok(())
    }

    /// Get the effective port (using default if not set)
    pub fn effective_port(&self) -> u16 {
        self.port.unwrap_or(9100)
    }

    /// Get the effective RPC URL (using default if not set)
    pub fn effective_rpc_url(&self) -> String {
        self.rpc_url
            .clone()
            .unwrap_or_else(|| "http://localhost:8545".to_string())
    }

    /// Get the effective mock_bitget setting (using default if not set)
    pub fn effective_mock_bitget(&self) -> bool {
        self.mock_bitget.unwrap_or(false)
    }

    /// Get the effective log level (using default if not set)
    pub fn effective_log_level(&self) -> String {
        self.log_level.clone().unwrap_or_else(|| "info".to_string())
    }

    /// Get the effective log directory (using default if not set)
    pub fn effective_log_dir(&self) -> PathBuf {
        self.log_dir
            .clone()
            .unwrap_or_else(|| PathBuf::from("logs"))
    }

    /// Get the effective json_logs setting (using default if not set)
    pub fn effective_json_logs(&self) -> bool {
        self.json_logs.unwrap_or(false)
    }

    /// Get the effective Index.sol contract address as bytes
    ///
    /// Returns the parsed address if configured, or zeros if not set.
    /// The hex string should be 40 characters (20 bytes) with optional "0x" prefix.
    pub fn effective_index_contract(&self) -> [u8; 20] {
        self.index_contract
            .as_ref()
            .and_then(|s| {
                let hex_str = s.strip_prefix("0x").unwrap_or(s);
                if hex_str.len() != 40 {
                    warn!(address = %s, "Invalid index_contract address length, expected 40 hex chars");
                    return None;
                }
                let mut bytes = [0u8; 20];
                for (i, chunk) in hex_str.as_bytes().chunks(2).enumerate() {
                    if let Ok(byte) = u8::from_str_radix(
                        std::str::from_utf8(chunk).unwrap_or("00"),
                        16,
                    ) {
                        bytes[i] = byte;
                    } else {
                        warn!(address = %s, "Invalid hex character in index_contract");
                        return None;
                    }
                }
                Some(bytes)
            })
            .unwrap_or([0u8; 20])
    }

    /// Get the effective bitget_testnet setting (default: true for safety)
    pub fn effective_bitget_testnet(&self) -> bool {
        self.bitget_testnet.unwrap_or(true)
    }

    /// Get the effective deployment file path
    pub fn effective_deployment_file(&self) -> Option<PathBuf> {
        self.deployment_file.clone()
    }

    /// Get the effective mock_chain setting
    /// Default: true if no deployment_file, false if deployment_file is set
    pub fn effective_mock_chain(&self) -> bool {
        self.mock_chain
            .unwrap_or_else(|| self.deployment_file.is_none())
    }

    /// Get the effective MockBitgetVault address as bytes
    ///
    /// Returns the parsed address if configured, or None if not set.
    /// The hex string should be 40 characters (20 bytes) with optional "0x" prefix.
    pub fn effective_bitget_vault(&self) -> Option<[u8; 20]> {
        self.bitget_vault.as_ref().and_then(|s| {
            let hex_str = s.strip_prefix("0x").unwrap_or(s);
            if hex_str.len() != 40 {
                warn!(address = %s, "Invalid bitget_vault address length, expected 40 hex chars");
                return None;
            }
            let mut bytes = [0u8; 20];
            for (i, chunk) in hex_str.as_bytes().chunks(2).enumerate() {
                if let Ok(byte) =
                    u8::from_str_radix(std::str::from_utf8(chunk).unwrap_or("00"), 16)
                {
                    bytes[i] = byte;
                } else {
                    warn!(address = %s, "Invalid hex character in bitget_vault");
                    return None;
                }
            }
            Some(bytes)
        })
    }

    /// Get the effective chain ID (default: 111222333 for Index L3)
    pub fn effective_chain_id(&self) -> u64 {
        self.chain_id.unwrap_or(111222333)
    }

    /// Get the effective MockUSDT address as bytes (Story 7.18)
    ///
    /// Returns the parsed address if configured, or None if not set.
    pub fn effective_mock_usdt(&self) -> Option<[u8; 20]> {
        self.mock_usdt.as_ref().and_then(|s| {
            let hex_str = s.strip_prefix("0x").unwrap_or(s);
            if hex_str.len() != 40 {
                warn!(address = %s, "Invalid mock_usdt address length, expected 40 hex chars");
                return None;
            }
            let mut bytes = [0u8; 20];
            for (i, chunk) in hex_str.as_bytes().chunks(2).enumerate() {
                if let Ok(byte) =
                    u8::from_str_radix(std::str::from_utf8(chunk).unwrap_or("00"), 16)
                {
                    bytes[i] = byte;
                } else {
                    warn!(address = %s, "Invalid hex character in mock_usdt");
                    return None;
                }
            }
            Some(bytes)
        })
    }

    /// Get the effective Arbitrum RPC URL.
    ///
    /// Returns an error if not configured (no silent fallback to L3 RPC).
    pub fn effective_arb_rpc_url(&self) -> Result<String, String> {
        self.arb_rpc_url
            .clone()
            .ok_or_else(|| "AP_ARB_RPC_URL not configured".to_string())
    }

    /// Get the effective Arbitrum chain ID.
    ///
    /// Returns an error if not configured (no silent fallback to L3 chain ID).
    pub fn effective_arb_chain_id(&self) -> Result<u64, String> {
        self.arb_chain_id
            .ok_or_else(|| "AP_ARB_CHAIN_ID not configured".to_string())
    }

    /// Resolve the effective ExchangeMode using legacy flag compat.
    pub fn effective_exchange_mode(&self) -> common::types::ExchangeMode {
        if let Some(ref mode_str) = self.exchange_mode {
            if let Ok(mode) = mode_str.parse() {
                return mode;
            }
        }
        common::types::resolve_exchange_mode(
            None,
            self.effective_mock_bitget(),
            self.bitget_testnet,
            false, // bitget_mainnet - no legacy flag for this
            self.has_bitget_credentials(),
        )
    }

    /// Check if Bitget credentials are configured (non-empty key, secret, and passphrase)
    pub fn has_bitget_credentials(&self) -> bool {
        self.bitget_api_key.as_ref().is_some_and(|s| !s.is_empty())
            && self
                .bitget_api_secret
                .as_ref()
                .is_some_and(|s| !s.is_empty())
            && self
                .bitget_api_passphrase
                .as_ref()
                .is_some_and(|s| !s.is_empty())
    }
}

/// Configuration builder that handles the resolution chain:
/// CLI > ENV > Config file > Defaults
#[derive(Debug, Default)]
pub struct ConfigBuilder {
    config_file_path: Option<PathBuf>,
    cli_config: APConfig,
}

impl ConfigBuilder {
    /// Create a new configuration builder
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the path to the configuration file
    pub fn with_config_file(mut self, path: Option<PathBuf>) -> Self {
        self.config_file_path = path;
        self
    }

    /// Set CLI overrides
    pub fn with_cli_args(
        mut self,
        port: Option<u16>,
        rpc: Option<String>,
        mock_bitget: Option<bool>,
        log_level: Option<String>,
        log_dir: Option<PathBuf>,
        json_logs: Option<bool>,
        index_contract: Option<String>,
        bitget_testnet: Option<bool>,
    ) -> Self {
        self.cli_config = APConfig {
            port,
            rpc_url: rpc,
            index_contract,
            mock_bitget,
            bitget_api_key: None,        // Never set via CLI for security
            bitget_api_secret: None,     // Never set via CLI for security
            bitget_api_passphrase: None, // Never set via CLI for security
            log_level,
            log_dir,
            json_logs,
            bitget_testnet,
            deployment_file: None,
            mock_chain: None,
            private_key: None,           // Never set via CLI for security
            bitget_vault: None,          // Set via with_bitget_vault
            chain_id: None,              // Set via with_chain_id
            mock_usdt: None,             // Set via with_mock_usdt
            data_node_url: None,     // Set via with_data_node_url
            arb_rpc_url: None,
            arb_chain_id: None,
            exchange_mode: None,     // Set via with_exchange_mode
        };
        self
    }

    /// Set deployment file CLI override
    pub fn with_deployment_file(mut self, path: Option<PathBuf>) -> Self {
        self.cli_config.deployment_file = path;
        self
    }

    /// Set mock_chain CLI override
    pub fn with_mock_chain(mut self, mock_chain: Option<bool>) -> Self {
        self.cli_config.mock_chain = mock_chain;
        self
    }

    /// Set bitget_vault CLI override
    pub fn with_bitget_vault(mut self, bitget_vault: Option<String>) -> Self {
        self.cli_config.bitget_vault = bitget_vault;
        self
    }

    /// Set chain_id CLI override
    pub fn with_chain_id(mut self, chain_id: Option<u64>) -> Self {
        self.cli_config.chain_id = chain_id;
        self
    }

    /// Set mock_usdt CLI override (Story 7.18)
    pub fn with_mock_usdt(mut self, mock_usdt: Option<String>) -> Self {
        self.cli_config.mock_usdt = mock_usdt;
        self
    }

    /// Set data_node_url CLI override
    pub fn with_data_node_url(mut self, url: Option<String>) -> Self {
        self.cli_config.data_node_url = url;
        self
    }

    /// Set arb_rpc_url CLI override
    pub fn with_arb_rpc_url(mut self, url: Option<String>) -> Self {
        self.cli_config.arb_rpc_url = url;
        self
    }

    /// Set arb_chain_id CLI override
    pub fn with_arb_chain_id(mut self, chain_id: Option<u64>) -> Self {
        self.cli_config.arb_chain_id = chain_id;
        self
    }

    /// Set exchange_mode CLI override
    pub fn with_exchange_mode(mut self, mode: Option<String>) -> Self {
        self.cli_config.exchange_mode = mode;
        self
    }

    /// Build the final configuration
    ///
    /// Resolution order: CLI > ENV > Config file > Defaults
    pub fn build(self) -> Result<APConfig, ConfigError> {
        // Start with defaults
        let mut config = APConfig::default();

        // Layer 1: Load from config file if provided
        if let Some(path) = &self.config_file_path {
            let file_config = APConfig::from_file(path)?;
            config.merge(&file_config);
        }

        // Layer 2: Override with environment variables
        let env_config = APConfig::from_env();
        config.merge(&env_config);

        // Layer 3: Override with CLI arguments (highest priority)
        config.merge(&self.cli_config);

        // Validate the final configuration
        config.validate()?;

        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::sync::Mutex;
    use tempfile::NamedTempFile;

    // Shared lock for tests that modify environment variables
    // This prevents parallel test pollution
    static ENV_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn test_config_from_yaml() {
        let yaml_content = r#"
port: 9200
rpc_url: "http://example.com:8545"
mock_bitget: true
bitget_api_key: "test-key"
bitget_api_secret: "test-secret"
bitget_api_passphrase: "test-passphrase"
log_level: "debug"
log_dir: "./custom-logs"
json_logs: true
"#;

        let mut file = NamedTempFile::new().unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = APConfig::from_file(&file.path().to_path_buf()).unwrap();

        assert_eq!(config.port, Some(9200));
        assert_eq!(config.rpc_url, Some("http://example.com:8545".to_string()));
        assert_eq!(config.mock_bitget, Some(true));
        assert_eq!(config.bitget_api_key, Some("test-key".to_string()));
        assert_eq!(config.bitget_api_secret, Some("test-secret".to_string()));
        assert_eq!(
            config.bitget_api_passphrase,
            Some("test-passphrase".to_string())
        );
        assert_eq!(config.log_level, Some("debug".to_string()));
        assert_eq!(config.log_dir, Some(PathBuf::from("./custom-logs")));
        assert_eq!(config.json_logs, Some(true));
    }

    #[test]
    fn test_config_merge() {
        let mut base = APConfig {
            port: Some(9100),
            rpc_url: Some("http://base.com".to_string()),
            index_contract: None,
            mock_bitget: Some(false),
            bitget_api_key: Some("base-key".to_string()),
            bitget_api_secret: None,
            bitget_api_passphrase: Some("base-passphrase".to_string()),
            log_level: Some("info".to_string()),
            log_dir: None,
            json_logs: None,
            ..Default::default()
        };

        let override_config = APConfig {
            port: Some(9200),
            rpc_url: None, // Should not override
            index_contract: None,
            mock_bitget: Some(true),
            bitget_api_key: None, // Should not override
            bitget_api_secret: Some("override-secret".to_string()),
            bitget_api_passphrase: None, // Should not override
            log_level: None,             // Should not override
            log_dir: Some(PathBuf::from("./new-logs")),
            json_logs: Some(true),
            ..Default::default()
        };

        base.merge(&override_config);

        assert_eq!(base.port, Some(9200)); // Overridden
        assert_eq!(base.rpc_url, Some("http://base.com".to_string())); // Not overridden
        assert_eq!(base.mock_bitget, Some(true)); // Overridden
        assert_eq!(base.bitget_api_key, Some("base-key".to_string())); // Not overridden
        assert_eq!(base.bitget_api_secret, Some("override-secret".to_string())); // Overridden
        assert_eq!(
            base.bitget_api_passphrase,
            Some("base-passphrase".to_string())
        ); // Not overridden
        assert_eq!(base.log_level, Some("info".to_string())); // Not overridden
        assert_eq!(base.log_dir, Some(PathBuf::from("./new-logs"))); // Overridden
        assert_eq!(base.json_logs, Some(true)); // Overridden
    }

    #[test]
    fn test_config_validation_valid() {
        let config = APConfig {
            port: Some(9100),
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_config_validation_invalid_port_zero() {
        let config = APConfig {
            port: Some(0),
            ..Default::default()
        };
        assert!(matches!(
            config.validate(),
            Err(ConfigError::InvalidPort(0))
        ));
    }

    #[test]
    fn test_effective_defaults() {
        let config = APConfig::default();

        assert_eq!(config.effective_port(), 9100);
        assert_eq!(config.effective_rpc_url(), "http://localhost:8545");
        assert!(!config.effective_mock_bitget());
        assert_eq!(config.effective_log_level(), "info");
        assert_eq!(config.effective_log_dir(), PathBuf::from("logs"));
        assert!(!config.effective_json_logs());
    }

    #[test]
    fn test_config_builder_cli_override() {
        let yaml_content = r#"
port: 9100
rpc_url: "http://file.com:8545"
mock_bitget: false
"#;

        let mut file = NamedTempFile::new().unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = ConfigBuilder::new()
            .with_config_file(Some(file.path().to_path_buf()))
            .with_cli_args(
                Some(9200), // Override port
                None,       // Don't override rpc
                Some(true), // Override mock_bitget
                None,
                None,
                None,
                None,       // index_contract
                None,       // bitget_testnet
            )
            .build()
            .unwrap();

        assert_eq!(config.port, Some(9200)); // CLI override
        assert_eq!(config.rpc_url, Some("http://file.com:8545".to_string())); // From file
        assert_eq!(config.mock_bitget, Some(true)); // CLI override
    }

    #[test]
    fn test_config_builder_priority_order() {
        // This test verifies: CLI > Config file
        // Use shared mutex since build() reads ENV vars
        let _lock = ENV_TEST_LOCK.lock().unwrap();

        // Clear env vars that could interfere
        std::env::remove_var("AP_PORT");
        std::env::remove_var("AP_LOG_LEVEL");

        let yaml_content = r#"
port: 9100
log_level: "trace"
"#;

        let mut file = NamedTempFile::new().unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        // Test 1: CLI overrides file
        let config = ConfigBuilder::new()
            .with_config_file(Some(file.path().to_path_buf()))
            .with_cli_args(
                Some(9300),                    // CLI port overrides file's 9100
                None,
                None,
                Some("warn".to_string()),      // CLI log_level overrides file's "trace"
                None,
                None,
                None,                          // index_contract
                None,                          // bitget_testnet
            )
            .build()
            .unwrap();

        assert_eq!(config.port, Some(9300)); // CLI wins over file
        assert_eq!(config.log_level, Some("warn".to_string())); // CLI wins over file

        // Test 2: File wins when CLI not set
        let config2 = ConfigBuilder::new()
            .with_config_file(Some(file.path().to_path_buf()))
            .with_cli_args(
                None, // No CLI port
                None,
                None,
                None, // No CLI log_level
                None,
                None,
                None, // index_contract
                None, // bitget_testnet
            )
            .build()
            .unwrap();

        assert_eq!(config2.port, Some(9100)); // File value
        assert_eq!(config2.log_level, Some("trace".to_string())); // File value
    }

    #[test]
    fn test_config_env_priority() {
        // Test ENV > file priority in isolation
        // Use shared mutex to prevent parallel test pollution
        let _lock = ENV_TEST_LOCK.lock().unwrap();

        struct EnvGuard;
        impl Drop for EnvGuard {
            fn drop(&mut self) {
                std::env::remove_var("AP_PORT");
                std::env::remove_var("AP_LOG_LEVEL");
            }
        }
        let _env_guard = EnvGuard;

        let yaml_content = r#"
port: 9100
log_level: "trace"
"#;

        let mut file = NamedTempFile::new().unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        // Set ENV vars
        std::env::set_var("AP_PORT", "9200");
        std::env::set_var("AP_LOG_LEVEL", "debug");

        let config = ConfigBuilder::new()
            .with_config_file(Some(file.path().to_path_buf()))
            .with_cli_args(None, None, None, None, None, None, None, None)
            .build()
            .unwrap();

        assert_eq!(config.port, Some(9200)); // ENV wins over file
        assert_eq!(config.log_level, Some("debug".to_string())); // ENV wins over file
    }

    #[test]
    fn test_has_bitget_credentials() {
        // No credentials
        let config_no_creds = APConfig::default();
        assert!(!config_no_creds.has_bitget_credentials());

        // Only key
        let config_key_only = APConfig {
            bitget_api_key: Some("key".to_string()),
            ..Default::default()
        };
        assert!(!config_key_only.has_bitget_credentials());

        // Key and secret but no passphrase
        let config_no_passphrase = APConfig {
            bitget_api_key: Some("key".to_string()),
            bitget_api_secret: Some("secret".to_string()),
            ..Default::default()
        };
        assert!(!config_no_passphrase.has_bitget_credentials());

        // All three credentials present
        let config_full = APConfig {
            bitget_api_key: Some("key".to_string()),
            bitget_api_secret: Some("secret".to_string()),
            bitget_api_passphrase: Some("passphrase".to_string()),
            ..Default::default()
        };
        assert!(config_full.has_bitget_credentials());

        // Empty strings should be treated as missing
        let config_empty_key = APConfig {
            bitget_api_key: Some("".to_string()),
            bitget_api_secret: Some("secret".to_string()),
            bitget_api_passphrase: Some("passphrase".to_string()),
            ..Default::default()
        };
        assert!(!config_empty_key.has_bitget_credentials());

        let config_empty_secret = APConfig {
            bitget_api_key: Some("key".to_string()),
            bitget_api_secret: Some("".to_string()),
            bitget_api_passphrase: Some("passphrase".to_string()),
            ..Default::default()
        };
        assert!(!config_empty_secret.has_bitget_credentials());

        let config_empty_passphrase = APConfig {
            bitget_api_key: Some("key".to_string()),
            bitget_api_secret: Some("secret".to_string()),
            bitget_api_passphrase: Some("".to_string()),
            ..Default::default()
        };
        assert!(!config_empty_passphrase.has_bitget_credentials());
    }

    #[test]
    fn test_env_var_parsing() {
        // Use shared mutex to prevent parallel test pollution
        let _lock = ENV_TEST_LOCK.lock().unwrap();

        // Use a guard pattern to ensure cleanup even on panic
        struct EnvGuard;
        impl Drop for EnvGuard {
            fn drop(&mut self) {
                std::env::remove_var("AP_PORT");
                std::env::remove_var("AP_RPC_URL");
                std::env::remove_var("AP_MOCK_BITGET");
                std::env::remove_var("BITGET_API_KEY");
                std::env::remove_var("BITGET_API_SECRET");
                std::env::remove_var("BITGET_API_PASSPHRASE");
                std::env::remove_var("AP_LOG_LEVEL");
                std::env::remove_var("AP_LOG_DIR");
                std::env::remove_var("AP_JSON_LOGS");
            }
        }
        let _guard = EnvGuard;

        std::env::set_var("AP_PORT", "9500");
        std::env::set_var("AP_RPC_URL", "http://env.com:8545");
        std::env::set_var("AP_MOCK_BITGET", "true");
        std::env::set_var("BITGET_API_KEY", "env-key");
        std::env::set_var("BITGET_API_SECRET", "env-secret");
        std::env::set_var("BITGET_API_PASSPHRASE", "env-passphrase");
        std::env::set_var("AP_LOG_LEVEL", "warn");
        std::env::set_var("AP_LOG_DIR", "/var/log/ap");
        std::env::set_var("AP_JSON_LOGS", "true");

        let config = APConfig::from_env();

        assert_eq!(config.port, Some(9500));
        assert_eq!(config.rpc_url, Some("http://env.com:8545".to_string()));
        assert_eq!(config.mock_bitget, Some(true));
        assert_eq!(config.bitget_api_key, Some("env-key".to_string()));
        assert_eq!(config.bitget_api_secret, Some("env-secret".to_string()));
        assert_eq!(
            config.bitget_api_passphrase,
            Some("env-passphrase".to_string())
        );
        assert_eq!(config.log_level, Some("warn".to_string()));
        assert_eq!(config.log_dir, Some(PathBuf::from("/var/log/ap")));
        assert_eq!(config.json_logs, Some(true));
    }

    #[test]
    fn test_missing_optional_fields_use_defaults() {
        // Use shared mutex to serialize env var access across parallel tests
        let _lock = ENV_TEST_LOCK.lock().unwrap();

        // Clear any env vars that might be set by parallel tests
        struct EnvGuard;
        impl Drop for EnvGuard {
            fn drop(&mut self) {
                std::env::remove_var("AP_PORT");
                std::env::remove_var("AP_RPC_URL");
                std::env::remove_var("AP_MOCK_BITGET");
                std::env::remove_var("BITGET_API_KEY");
                std::env::remove_var("BITGET_API_SECRET");
                std::env::remove_var("BITGET_API_PASSPHRASE");
                std::env::remove_var("AP_LOG_LEVEL");
                std::env::remove_var("AP_LOG_DIR");
                std::env::remove_var("AP_JSON_LOGS");
            }
        }
        let _guard = EnvGuard;
        // Clear before test starts (in case another test left them)
        std::env::remove_var("AP_PORT");
        std::env::remove_var("AP_RPC_URL");
        std::env::remove_var("AP_MOCK_BITGET");
        std::env::remove_var("BITGET_API_KEY");
        std::env::remove_var("BITGET_API_SECRET");
        std::env::remove_var("BITGET_API_PASSPHRASE");
        std::env::remove_var("AP_LOG_LEVEL");
        std::env::remove_var("AP_LOG_DIR");
        std::env::remove_var("AP_JSON_LOGS");

        // Empty config file
        let yaml_content = r#"
# Minimal config with no fields set
"#;

        let mut file = NamedTempFile::new().unwrap();
        file.write_all(yaml_content.as_bytes()).unwrap();
        file.flush().unwrap();

        let config = ConfigBuilder::new()
            .with_config_file(Some(file.path().to_path_buf()))
            .build()
            .unwrap();

        // All should use defaults via effective_* methods
        assert_eq!(config.effective_port(), 9100);
        assert_eq!(config.effective_rpc_url(), "http://localhost:8545");
        assert!(!config.effective_mock_bitget());
        assert_eq!(config.effective_log_level(), "info");
        assert_eq!(config.effective_log_dir(), PathBuf::from("logs"));
        assert!(!config.effective_json_logs());
    }

    #[test]
    fn test_effective_bitget_testnet_defaults_true() {
        // Safety default: when not set, should default to testnet
        let config = APConfig::default();
        assert!(config.effective_bitget_testnet());
    }

    #[test]
    fn test_effective_bitget_testnet_explicit_false() {
        let config = APConfig {
            bitget_testnet: Some(false),
            ..Default::default()
        };
        assert!(!config.effective_bitget_testnet());
    }

    #[test]
    fn test_effective_bitget_testnet_explicit_true() {
        let config = APConfig {
            bitget_testnet: Some(true),
            ..Default::default()
        };
        assert!(config.effective_bitget_testnet());
    }

    #[test]
    fn test_bitget_testnet_env_vars() {
        let _lock = ENV_TEST_LOCK.lock().unwrap();

        struct EnvGuard;
        impl Drop for EnvGuard {
            fn drop(&mut self) {
                std::env::remove_var("BITGET_TESTNET");
                std::env::remove_var("BITGET_MAINNET");
            }
        }
        let _guard = EnvGuard;

        // BITGET_TESTNET=true should set testnet
        std::env::set_var("BITGET_TESTNET", "true");
        std::env::remove_var("BITGET_MAINNET");
        let config = APConfig::from_env();
        assert_eq!(config.bitget_testnet, Some(true));

        // BITGET_TESTNET=false should set testnet=false
        std::env::set_var("BITGET_TESTNET", "false");
        let config = APConfig::from_env();
        assert_eq!(config.bitget_testnet, Some(false));

        // BITGET_MAINNET=true should set testnet=false
        std::env::remove_var("BITGET_TESTNET");
        std::env::set_var("BITGET_MAINNET", "true");
        let config = APConfig::from_env();
        assert_eq!(config.bitget_testnet, Some(false));

        // BITGET_TESTNET takes precedence over BITGET_MAINNET
        std::env::set_var("BITGET_TESTNET", "true");
        std::env::set_var("BITGET_MAINNET", "true");
        let config = APConfig::from_env();
        assert_eq!(config.bitget_testnet, Some(true));
    }

    #[test]
    fn test_bitget_testnet_merge() {
        let mut base = APConfig {
            bitget_testnet: None,
            ..Default::default()
        };
        let override_config = APConfig {
            bitget_testnet: Some(false),
            ..Default::default()
        };
        base.merge(&override_config);
        assert_eq!(base.bitget_testnet, Some(false));

        // Merge should not override with None
        let noop = APConfig::default();
        base.merge(&noop);
        assert_eq!(base.bitget_testnet, Some(false));
    }

    #[test]
    fn test_bitget_testnet_cli_flag() {
        let _lock = ENV_TEST_LOCK.lock().unwrap();

        struct EnvGuard;
        impl Drop for EnvGuard {
            fn drop(&mut self) {
                std::env::remove_var("BITGET_TESTNET");
                std::env::remove_var("BITGET_MAINNET");
            }
        }
        let _guard = EnvGuard;
        std::env::remove_var("BITGET_TESTNET");
        std::env::remove_var("BITGET_MAINNET");

        // CLI flag sets bitget_testnet
        let config = ConfigBuilder::new()
            .with_cli_args(None, None, None, None, None, None, None, Some(true))
            .build()
            .unwrap();
        assert_eq!(config.bitget_testnet, Some(true));

        // CLI mainnet flag (false) overrides env testnet
        std::env::set_var("BITGET_TESTNET", "true");
        let config = ConfigBuilder::new()
            .with_cli_args(None, None, None, None, None, None, None, Some(false))
            .build()
            .unwrap();
        assert_eq!(config.bitget_testnet, Some(false));
    }

    #[test]
    fn test_live_mode_requires_credentials() {
        // When mock_bitget is false and no credentials, has_bitget_credentials returns false
        let config = APConfig {
            mock_bitget: Some(false),
            ..Default::default()
        };
        assert!(!config.effective_mock_bitget());
        assert!(!config.has_bitget_credentials());
    }

    #[test]
    fn test_debug_redacts_sensitive_fields() {
        // Verify that Debug output does NOT expose API keys/secrets in plain text
        let config = APConfig {
            port: Some(9100),
            rpc_url: Some("http://test.com".to_string()),
            index_contract: None,
            mock_bitget: Some(false),
            bitget_api_key: Some("super-secret-api-key".to_string()),
            bitget_api_secret: Some("super-secret-api-secret".to_string()),
            bitget_api_passphrase: Some("super-secret-passphrase".to_string()),
            log_level: Some("info".to_string()),
            log_dir: Some(PathBuf::from("./logs")),
            json_logs: Some(false),
            ..Default::default()
        };

        let debug_output = format!("{:?}", config);

        // Verify secrets are NOT in the debug output
        assert!(
            !debug_output.contains("super-secret-api-key"),
            "API key should be redacted in Debug output"
        );
        assert!(
            !debug_output.contains("super-secret-api-secret"),
            "API secret should be redacted in Debug output"
        );
        assert!(
            !debug_output.contains("super-secret-passphrase"),
            "API passphrase should be redacted in Debug output"
        );

        // Verify [REDACTED] markers are present
        assert!(
            debug_output.contains("[REDACTED]"),
            "Debug output should show [REDACTED] for sensitive fields"
        );

        // Verify non-sensitive fields are still visible
        assert!(
            debug_output.contains("9100"),
            "Port should be visible in Debug output"
        );
        assert!(
            debug_output.contains("http://test.com"),
            "RPC URL should be visible in Debug output"
        );
    }

    #[test]
    fn test_effective_bitget_vault() {
        // No bitget vault set
        let config = APConfig::default();
        assert!(config.effective_bitget_vault().is_none());

        // Valid bitget vault address with 0x prefix
        let config = APConfig {
            bitget_vault: Some("0x1234567890123456789012345678901234567890".to_string()),
            ..Default::default()
        };
        let addr = config.effective_bitget_vault();
        assert!(addr.is_some());
        let bytes = addr.unwrap();
        assert_eq!(bytes[0], 0x12);
        assert_eq!(bytes[19], 0x90);

        // Valid bitget vault address without 0x prefix
        let config = APConfig {
            bitget_vault: Some("1234567890123456789012345678901234567890".to_string()),
            ..Default::default()
        };
        let addr = config.effective_bitget_vault();
        assert!(addr.is_some());

        // Invalid address length
        let config = APConfig {
            bitget_vault: Some("0x1234".to_string()),
            ..Default::default()
        };
        assert!(config.effective_bitget_vault().is_none());
    }

    #[test]
    fn test_bitget_vault_merge() {
        let mut base = APConfig::default();
        let override_config = APConfig {
            bitget_vault: Some("0x1234567890123456789012345678901234567890".to_string()),
            ..Default::default()
        };
        base.merge(&override_config);
        assert_eq!(
            base.bitget_vault,
            Some("0x1234567890123456789012345678901234567890".to_string())
        );
    }
}
