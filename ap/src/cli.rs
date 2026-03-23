//! CLI argument parsing for the AP service.

use clap::Parser;
use ethers::prelude::*;
use std::path::PathBuf;
use std::sync::Arc;

use crate::external::bitget_vault::BitgetVaultClient;

/// On-chain trade settlement configuration for E2E testing (Story 6.17)
///
/// When both --mock-bitget and --bitget-vault are set, the AP executes trades
/// on-chain via MockBitgetVault. Asset info comes from oracle-emitted
/// AssetTradeRequest events — AP reads NO on-chain state for trade decisions.
#[derive(Clone)]
pub(crate) struct OnChainSettlement {
    /// MockBitgetVault client for executing trades
    pub(crate) vault_client: Arc<BitgetVaultClient>,
    /// Quote token address (e.g., USDC) - the default quote token (USDC)
    pub(crate) quote_token: Address,
    /// MockUSDT token address (Story 7.18) - for USDT-denominated pair settlement
    #[allow(dead_code)]
    pub(crate) mock_usdt: Option<Address>,
    /// Data-node backend URL for fetching prices
    pub(crate) data_node_url: Option<String>,
    /// Token address to Bitget symbol mapping - loaded from data/symbol-map.json
    pub(crate) symbol_map: Option<Arc<std::collections::HashMap<String, String>>>,
}

/// Index L3 AP (Authorized Participant) / Keeper Service
///
/// Monitors chain events, manages order queues, and executes trades.
#[derive(Parser, Debug)]
#[command(name = "ap")]
#[command(author = "Index Team")]
#[command(version = env!("CARGO_PKG_VERSION"))]
#[command(about = "Index L3 AP/Keeper - monitors events and executes trades")]
#[command(long_about = None)]
pub(crate) struct Args {
    /// API listen port
    #[arg(long, default_value = "9100")]
    pub(crate) port: u16,

    /// Chain RPC endpoint
    #[arg(long, default_value = "http://localhost:8545")]
    pub(crate) rpc: String,

    /// Use mock Bitget client (for local development)
    #[arg(long)]
    pub(crate) mock_bitget: bool,

    /// Path to configuration file
    #[arg(long)]
    pub(crate) config: Option<PathBuf>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, default_value = "info")]
    pub(crate) log_level: String,

    /// Log output directory
    #[arg(long, default_value = "logs")]
    pub(crate) log_dir: PathBuf,

    /// Output logs as JSON
    #[arg(long)]
    pub(crate) json_logs: bool,

    /// Index.sol contract address (hex, e.g., 0x1234...abcd)
    #[arg(long)]
    pub(crate) index_contract: Option<String>,

    /// Exchange mode: mock, testnet, mainnet
    #[arg(long, value_parser = ["mock", "testnet", "mainnet"])]
    pub(crate) exchange_mode: Option<String>,

    /// Use Bitget testnet (safety default, overrides --bitget-mainnet)
    #[arg(long)]
    pub(crate) bitget_testnet: bool,

    /// Use Bitget mainnet (requires explicit opt-in)
    #[arg(long)]
    pub(crate) bitget_mainnet: bool,

    /// Path to deployment JSON file (enables real chain mode)
    #[arg(long)]
    pub(crate) deployment_file: Option<PathBuf>,

    /// Force mock chain even with deployment file
    #[arg(long)]
    pub(crate) mock_chain: bool,

    /// MockBitgetVault contract address for on-chain trade settlement (E2E testing)
    /// When set with --mock-bitget, AP also calls MockBitgetVault.executeTrade() on-chain
    #[arg(long)]
    pub(crate) bitget_vault: Option<String>,

    /// Override expected chain ID (default: 111222333 for Index L3).
    /// Use for local testing with custom Anvil chain IDs.
    #[arg(long)]
    pub(crate) chain_id: Option<u64>,

    /// MockUSDT token contract address for USDT-pair settlement (Story 7.18)
    /// When set, AP uses this address for trades with USDT-denominated symbols
    #[arg(long)]
    pub(crate) mock_usdt: Option<String>,

    /// Data-node backend URL (e.g., http://localhost:8200).
    /// When set, /nav endpoint fetches NAV from data-node instead of computing locally.
    #[arg(long)]
    pub(crate) data_node_url: Option<String>,

    /// Settlement chain RPC endpoint for on-chain settlement (MockBitgetVault on settlement chain)
    #[arg(long)]
    pub(crate) settlement_rpc: Option<String>,

    /// Settlement chain ID (default: 42161)
    #[arg(long)]
    pub(crate) settlement_chain_id: Option<u64>,
}
