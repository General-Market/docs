//! Configuration for the Curator service
//!
//! Supports three operational modes:
//! - Oracle Collector Mode (default): Collects BLS NAV signatures from issuers
//! - Allocation Bot Mode (--allocation-mode): Rebalances vault supply across markets
//! - Health Monitor Mode (--health-monitor-mode): Monitors protocol health

use crate::health_monitor::AlertConfig;
use crate::tier_config::{load_tier_config_from_file, RiskTierConfig};
use clap::Parser;
use ethers::types::Address;
use std::collections::HashMap;
use std::time::Duration;

/// CLI arguments for the Curator service
#[derive(Parser, Clone)]
#[command(name = "curator")]
#[command(author = "Index Team")]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(about = "Index Curator — Oracle BLS Collector (L3), Allocation Bot (Arb) & Health Monitor (dual-chain)")]
pub struct CuratorArgs {
    // ========================================================================
    // Mode Selection
    // ========================================================================
    /// Run in allocation bot mode instead of oracle collector mode
    #[arg(long, default_value = "false")]
    pub allocation_mode: bool,

    /// Run in health monitor mode instead of oracle collector mode
    #[arg(long, default_value = "false")]
    pub health_monitor_mode: bool,

    /// Run in unified mode — all tasks run concurrently (collector, allocator, health monitor, quote API, liquidation scanner)
    #[arg(long, default_value = "false")]
    pub unified_mode: bool,

    // ========================================================================
    // Common Args
    // ========================================================================
    /// Chain RPC endpoint (L3 for oracle-collector mode, Arbitrum for allocation/health-monitor modes)
    #[arg(long, default_value = "http://localhost:8545")]
    pub rpc_url: String,

    /// Arbitrum RPC endpoint (alias for --rpc-url in allocation/health-monitor modes)
    /// When set, overrides --rpc-url for allocation-mode and health-monitor-mode
    #[arg(long)]
    pub arb_rpc_url: Option<String>,

    /// Curator wallet private key (hex, without 0x prefix)
    #[arg(long)]
    pub private_key: String,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, default_value = "info")]
    pub log_level: String,

    // ========================================================================
    // Oracle Collector Mode Args
    // ========================================================================
    /// Comma-separated list of issuer HTTP endpoints
    /// e.g., http://localhost:9001,http://localhost:9002,http://localhost:9003
    #[arg(long, default_value = "")]
    pub issuer_urls: String,

    /// ITPNAVOracle contract address (hex)
    #[arg(long, default_value = "")]
    pub oracle_address: String,

    /// ITP token address to collect NAV for (hex)
    #[arg(long, default_value = "")]
    pub itp_address: String,

    /// Oracle update interval in seconds (default: 14400 = 4 hours)
    #[arg(long, default_value = "14400")]
    pub update_interval_secs: u64,

    // ========================================================================
    // Allocation Bot Mode Args
    // ========================================================================
    /// Morpho Blue contract address (hex) — required for allocation mode
    #[arg(long, default_value = "")]
    pub morpho_address: String,

    /// MetaMorpho vault address (hex) — required for allocation mode
    #[arg(long, default_value = "")]
    pub vault_address: String,

    /// Comma-separated list of market IDs (hex, with or without 0x prefix)
    /// e.g., 0xabc...123,0xdef...456
    #[arg(long, default_value = "")]
    pub market_ids: String,

    /// Allocation interval in seconds (default: 3600 = 1 hour)
    #[arg(long, default_value = "3600")]
    pub allocation_interval_secs: u64,

    /// Path to tier configuration JSON file (optional)
    #[arg(long)]
    pub tier_config_file: Option<String>,

    // ========================================================================
    // Health Monitor Mode Args
    // ========================================================================
    /// L3 RPC endpoint (port 8545 in dual-chain setup, for IssuerRegistry reads) — required for health monitor mode
    #[arg(long, default_value = "")]
    pub l3_rpc_url: String,

    /// Mirror registry address on Arbitrum — required for health monitor mode
    #[arg(long, default_value = "")]
    pub mirror_registry_address: String,

    /// L3 IssuerRegistry address — required for health monitor mode
    #[arg(long, default_value = "")]
    pub l3_registry_address: String,

    /// Comma-separated list of oracle addresses to monitor
    #[arg(long, default_value = "")]
    pub oracle_addresses: String,

    /// Comma-separated list of ITP addresses corresponding to oracles
    #[arg(long, default_value = "")]
    pub itp_addresses: String,

    /// Health monitor scan interval in seconds (default: 300 = 5 minutes)
    #[arg(long, default_value = "300")]
    pub health_scan_interval_secs: u64,

    /// Path to write health reports (optional, defaults to stdout)
    #[arg(long)]
    pub health_report_path: Option<String>,

    /// Data node service URL for asset stress computation (e.g., "http://localhost:8200")
    #[arg(long, default_value = "")]
    pub data_node_url: String,

    // ========================================================================
    // Alerting Args (Unified Mode)
    // ========================================================================
    /// Telegram bot token for crisis alerts (empty = log-based alerting)
    #[arg(long, default_value = "")]
    pub telegram_bot_token: String,

    /// Telegram chat ID for crisis alerts
    #[arg(long, default_value = "")]
    pub telegram_chat_id: String,

    // ========================================================================
    // Quote API Args (Unified Mode)
    // ========================================================================
    /// Quote API listen address (e.g., "0.0.0.0:8080")
    #[arg(long, default_value = "0.0.0.0:8080")]
    pub quote_api_listen: String,

    /// Comma-separated API keys for quote API authentication (empty = no auth)
    #[arg(long, default_value = "")]
    pub quote_api_keys: String,

    /// Path to market configs JSON for quote API
    #[arg(long)]
    pub market_configs_path: Option<String>,

    /// Morpho Bundler contract address
    #[arg(long, default_value = "")]
    pub bundler_address: String,

    /// CuratorRateIRM contract address (enables SERM rate pushing from quote API)
    #[arg(long, default_value = "")]
    pub curator_irm_address: String,
}

impl std::fmt::Debug for CuratorArgs {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CuratorArgs")
            .field("allocation_mode", &self.allocation_mode)
            .field("health_monitor_mode", &self.health_monitor_mode)
            .field("unified_mode", &self.unified_mode)
            .field("rpc_url", &self.rpc_url)
            .field("arb_rpc_url", &self.arb_rpc_url)
            .field("private_key", &"[REDACTED]")
            .field("log_level", &self.log_level)
            .field("issuer_urls", &self.issuer_urls)
            .field("oracle_address", &self.oracle_address)
            .field("itp_address", &self.itp_address)
            .field("update_interval_secs", &self.update_interval_secs)
            .field("morpho_address", &self.morpho_address)
            .field("vault_address", &self.vault_address)
            .field("market_ids", &self.market_ids)
            .field("allocation_interval_secs", &self.allocation_interval_secs)
            .field("tier_config_file", &self.tier_config_file)
            .field("l3_rpc_url", &self.l3_rpc_url)
            .field("mirror_registry_address", &self.mirror_registry_address)
            .field("l3_registry_address", &self.l3_registry_address)
            .field("oracle_addresses", &self.oracle_addresses)
            .field("itp_addresses", &self.itp_addresses)
            .field("health_scan_interval_secs", &self.health_scan_interval_secs)
            .field("health_report_path", &self.health_report_path)
            .field("data_node_url", &self.data_node_url)
            .field("telegram_bot_token", &if self.telegram_bot_token.is_empty() { "(none)" } else { "(set)" })
            .field("telegram_chat_id", &if self.telegram_chat_id.is_empty() { "(none)" } else { "(set)" })
            .field("quote_api_listen", &self.quote_api_listen)
            .field("market_configs_path", &self.market_configs_path)
            .field("bundler_address", &self.bundler_address)
            .field("curator_irm_address", &self.curator_irm_address)
            .finish()
    }
}

/// Resolved configuration for Oracle Collector mode
#[derive(Clone)]
pub struct CuratorConfig {
    pub issuer_urls: Vec<String>,
    pub oracle_address: Address,
    pub itp_address: Address,
    pub rpc_url: String,
    pub private_key: String,
    pub update_interval: Duration,
    pub log_level: String,
}

impl std::fmt::Debug for CuratorConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CuratorConfig")
            .field("issuer_urls", &self.issuer_urls)
            .field("oracle_address", &self.oracle_address)
            .field("itp_address", &self.itp_address)
            .field("rpc_url", &self.rpc_url)
            .field("private_key", &"[REDACTED]")
            .field("update_interval", &self.update_interval)
            .field("log_level", &self.log_level)
            .finish()
    }
}

impl CuratorConfig {
    /// Build config from parsed CLI args
    pub fn from_args(args: CuratorArgs) -> Result<Self, String> {
        let issuer_urls: Vec<String> = args
            .issuer_urls
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        if issuer_urls.is_empty() {
            return Err("At least one issuer URL is required".to_string());
        }

        let oracle_address: Address = args
            .oracle_address
            .parse()
            .map_err(|e| format!("Invalid oracle address: {}", e))?;

        let itp_address: Address = args
            .itp_address
            .parse()
            .map_err(|e| format!("Invalid ITP address: {}", e))?;

        Ok(Self {
            issuer_urls,
            oracle_address,
            itp_address,
            rpc_url: args.rpc_url,
            private_key: args.private_key,
            update_interval: Duration::from_secs(args.update_interval_secs),
            log_level: args.log_level,
        })
    }
}

/// Resolved configuration for Allocation Bot mode
#[derive(Clone)]
pub struct AllocationConfig {
    pub morpho_address: Address,
    pub vault_address: Address,
    pub market_ids: Vec<[u8; 32]>,
    pub tier_configs: HashMap<[u8; 32], RiskTierConfig>,
    pub rpc_url: String,
    pub private_key: String,
    pub allocation_interval: Duration,
    pub log_level: String,
}

impl std::fmt::Debug for AllocationConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AllocationConfig")
            .field("morpho_address", &self.morpho_address)
            .field("vault_address", &self.vault_address)
            .field("market_ids_count", &self.market_ids.len())
            .field("tier_configs_count", &self.tier_configs.len())
            .field("rpc_url", &self.rpc_url)
            .field("private_key", &"[REDACTED]")
            .field("allocation_interval", &self.allocation_interval)
            .field("log_level", &self.log_level)
            .finish()
    }
}

impl AllocationConfig {
    /// Build allocation config from parsed CLI args
    pub fn from_args(args: CuratorArgs) -> Result<Self, String> {
        if args.morpho_address.is_empty() {
            return Err("--morpho-address is required for allocation mode".to_string());
        }
        if args.vault_address.is_empty() {
            return Err("--vault-address is required for allocation mode".to_string());
        }

        let morpho_address: Address = args
            .morpho_address
            .parse()
            .map_err(|e| format!("Invalid Morpho address: {}", e))?;

        let vault_address: Address = args
            .vault_address
            .parse()
            .map_err(|e| format!("Invalid vault address: {}", e))?;

        let market_ids = parse_market_ids(&args.market_ids)?;

        // Load tier configs from file if provided
        let tier_configs = if let Some(path) = &args.tier_config_file {
            load_tier_config_from_file(path).map_err(|e| format!("Failed to load tier config: {}", e))?
        } else {
            HashMap::new()
        };

        // Prefer --arb-rpc-url for allocation mode (Morpho is on Arbitrum)
        let rpc_url = args.arb_rpc_url.unwrap_or(args.rpc_url);

        Ok(Self {
            morpho_address,
            vault_address,
            market_ids,
            tier_configs,
            rpc_url,
            private_key: args.private_key,
            allocation_interval: Duration::from_secs(args.allocation_interval_secs),
            log_level: args.log_level,
        })
    }
}

/// Resolved configuration for Health Monitor mode
#[derive(Clone)]
pub struct HealthMonitorConfig {
    pub rpc_url: String,
    pub l3_rpc_url: String,
    pub morpho_address: Address,
    pub vault_address: Address,
    pub mirror_registry_address: Address,
    pub l3_registry_address: Address,
    pub oracle_addresses: Vec<Address>,
    pub itp_addresses: Vec<Address>,
    pub market_ids: Vec<[u8; 32]>,
    pub alert_config: AlertConfig,
    pub scan_interval: Duration,
    pub report_path: Option<String>,
    pub log_level: String,
    pub data_node_url: Option<String>,
}

impl std::fmt::Debug for HealthMonitorConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HealthMonitorConfig")
            .field("rpc_url", &self.rpc_url)
            .field("l3_rpc_url", &self.l3_rpc_url)
            .field("morpho_address", &self.morpho_address)
            .field("vault_address", &self.vault_address)
            .field("mirror_registry_address", &self.mirror_registry_address)
            .field("l3_registry_address", &self.l3_registry_address)
            .field("oracle_addresses_count", &self.oracle_addresses.len())
            .field("itp_addresses_count", &self.itp_addresses.len())
            .field("market_ids_count", &self.market_ids.len())
            .field("scan_interval", &self.scan_interval)
            .field("report_path", &self.report_path)
            .field("log_level", &self.log_level)
            .field("data_node_url", &self.data_node_url)
            .finish()
    }
}

impl HealthMonitorConfig {
    /// Build health monitor config from parsed CLI args
    pub fn from_args(args: CuratorArgs) -> Result<Self, String> {
        if args.morpho_address.is_empty() {
            return Err("--morpho-address is required for health monitor mode".to_string());
        }
        if args.vault_address.is_empty() {
            return Err("--vault-address is required for health monitor mode".to_string());
        }
        if args.l3_rpc_url.is_empty() {
            return Err("--l3-rpc-url is required for health monitor mode".to_string());
        }
        if args.mirror_registry_address.is_empty() {
            return Err("--mirror-registry-address is required for health monitor mode".to_string());
        }
        if args.l3_registry_address.is_empty() {
            return Err("--l3-registry-address is required for health monitor mode".to_string());
        }

        let morpho_address: Address = args
            .morpho_address
            .parse()
            .map_err(|e| format!("Invalid Morpho address: {}", e))?;

        let vault_address: Address = args
            .vault_address
            .parse()
            .map_err(|e| format!("Invalid vault address: {}", e))?;

        let mirror_registry_address: Address = args
            .mirror_registry_address
            .parse()
            .map_err(|e| format!("Invalid mirror registry address: {}", e))?;

        let l3_registry_address: Address = args
            .l3_registry_address
            .parse()
            .map_err(|e| format!("Invalid L3 registry address: {}", e))?;

        let oracle_addresses = parse_addresses(&args.oracle_addresses)?;
        let itp_addresses = parse_addresses(&args.itp_addresses)?;
        let market_ids = parse_market_ids(&args.market_ids)?;

        // Prefer --arb-rpc-url for health monitor mode (Morpho/vault on Arbitrum)
        let rpc_url = args.arb_rpc_url.unwrap_or(args.rpc_url);

        Ok(Self {
            rpc_url,
            l3_rpc_url: args.l3_rpc_url,
            morpho_address,
            vault_address,
            mirror_registry_address,
            l3_registry_address,
            oracle_addresses,
            itp_addresses,
            market_ids,
            alert_config: AlertConfig::default(),
            scan_interval: Duration::from_secs(args.health_scan_interval_secs),
            report_path: args.health_report_path,
            log_level: args.log_level,
            data_node_url: if args.data_node_url.is_empty() {
                None
            } else {
                Some(args.data_node_url)
            },
        })
    }
}

/// Parse comma-separated market IDs (hex strings) into [u8; 32] arrays
fn parse_market_ids(input: &str) -> Result<Vec<[u8; 32]>, String> {
    if input.is_empty() {
        return Ok(vec![]);
    }

    let mut ids = Vec::new();

    for hex_str in input.split(',') {
        let hex = hex_str.trim().strip_prefix("0x").unwrap_or(hex_str.trim());

        if hex.is_empty() {
            continue;
        }

        let bytes = ethers::utils::hex::decode(hex)
            .map_err(|e| format!("Invalid market ID hex '{}': {}", hex_str, e))?;

        if bytes.len() != 32 {
            return Err(format!(
                "Market ID must be 32 bytes, got {} for '{}'",
                bytes.len(),
                hex_str
            ));
        }

        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        ids.push(arr);
    }

    Ok(ids)
}

/// Parse comma-separated addresses into Vec<Address>
fn parse_addresses(input: &str) -> Result<Vec<Address>, String> {
    if input.is_empty() {
        return Ok(vec![]);
    }

    let mut addresses = Vec::new();

    for addr_str in input.split(',') {
        let addr_str = addr_str.trim();
        if addr_str.is_empty() {
            continue;
        }

        let addr: Address = addr_str
            .parse()
            .map_err(|e| format!("Invalid address '{}': {}", addr_str, e))?;
        addresses.push(addr);
    }

    Ok(addresses)
}

/// Configuration for the liquidation bot
#[derive(Debug, Clone)]
pub struct LiquidatorConfig {
    /// Liquidation reserve wallet address (holds USDC for liquidations)
    pub reserve_wallet: Address,
    /// Maximum concurrent liquidation slots
    pub max_concurrent: usize,
    /// Index.sol contract address (for sell orders)
    pub index_address: Address,
}

impl Default for LiquidatorConfig {
    fn default() -> Self {
        Self {
            reserve_wallet: Address::zero(),
            max_concurrent: 5,
            index_address: Address::zero(),
        }
    }
}

/// Configuration for the Quote API
#[derive(Debug, Clone)]
pub struct QuoteApiConfig {
    /// HTTP listen address (e.g., "0.0.0.0:8080")
    pub listen_address: String,
    /// API keys for authentication
    pub api_keys: Vec<String>,
    /// Path to market configs JSON
    pub market_configs_path: Option<String>,
}

impl Default for QuoteApiConfig {
    fn default() -> Self {
        Self {
            listen_address: "0.0.0.0:8080".to_string(),
            api_keys: vec![],
            market_configs_path: None,
        }
    }
}

/// Configuration for the SERM rate engine
#[derive(Debug, Clone)]
pub struct SermConfig {
    /// CuratorRateIRM contract address
    pub curator_irm_address: Address,
    /// Threshold in basis points for rate push (only push if changed by this much)
    pub rate_push_threshold_bps: u64,
}

impl Default for SermConfig {
    fn default() -> Self {
        Self {
            curator_irm_address: Address::zero(),
            rate_push_threshold_bps: 100, // 1% threshold
        }
    }
}

/// Configuration for the alerting system
#[derive(Debug, Clone)]
pub struct AlertingConfig {
    /// Telegram bot token (empty = use LogAlerter)
    pub telegram_bot_token: String,
    /// Telegram chat ID
    pub telegram_chat_id: String,
}

impl Default for AlertingConfig {
    fn default() -> Self {
        Self {
            telegram_bot_token: String::new(),
            telegram_chat_id: String::new(),
        }
    }
}

impl AlertingConfig {
    /// Whether Telegram is configured
    pub fn has_telegram(&self) -> bool {
        !self.telegram_bot_token.is_empty() && !self.telegram_chat_id.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_market_ids_empty() {
        let result = parse_market_ids("").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_market_ids_single() {
        let hex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let result = parse_market_ids(hex).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0][0], 0x12);
    }

    #[test]
    fn test_parse_market_ids_with_prefix() {
        let hex = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let result = parse_market_ids(hex).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0][0], 0x12);
    }

    #[test]
    fn test_parse_market_ids_multiple() {
        let hex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef,abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678ab";
        let result = parse_market_ids(hex).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0][0], 0x12);
        assert_eq!(result[1][0], 0xab);
    }

    #[test]
    fn test_parse_market_ids_invalid_length() {
        let result = parse_market_ids("1234");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_market_ids_invalid_hex() {
        let result = parse_market_ids("xyz");
        assert!(result.is_err());
    }
}
