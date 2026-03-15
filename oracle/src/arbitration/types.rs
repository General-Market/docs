//! Arbitration domain types
//!
//! Adapted from AA keeper's types.rs and bilateral_resolution.rs.
//! Uses Index error conventions (thiserror) instead of anyhow.

use ethers::types::{Address, H256, U256};
use serde::{Deserialize, Serialize};

/// Arbitration configuration
#[derive(Debug, Clone)]
pub struct ArbitrationConfig {
    /// CollateralVault contract address
    pub collateral_vault: Address,
    /// ArbitrationSettlement contract address
    pub settlement_contract: Address,
    /// BLS signature threshold (default: 2)
    pub signature_threshold: usize,
    /// Polling interval for arbitration events (seconds)
    pub poll_interval_secs: u64,
    /// Total consensus timeout (ms) across all phases
    pub consensus_timeout_ms: u64,
    /// Data-node base URL for price queries
    pub data_node_url: String,
    /// Optional bearer token for authenticating data-node HTTP requests
    pub data_node_token: Option<String>,
    /// Price tolerance in basis points (e.g. 50 = 0.5%)
    pub price_tolerance_bps: u32,
    /// Chain ID where ArbitrationSettlement is deployed (queried from provider at startup)
    pub chain_id: u64,
}

impl Default for ArbitrationConfig {
    fn default() -> Self {
        Self {
            collateral_vault: Address::zero(),
            settlement_contract: Address::zero(),
            signature_threshold: 2,
            poll_interval_secs: 30,
            consensus_timeout_ms: 1100,
            data_node_url: "http://localhost:8200".to_string(),
            data_node_token: None,
            price_tolerance_bps: 50,
            chain_id: 0,
        }
    }
}

impl ArbitrationConfig {
    /// Build ArbitrationConfig from OracleConfig fields.
    /// Returns None if arbitration is not enabled.
    pub fn from_oracle_config(config: &crate::config::OracleConfig) -> Option<Self> {
        if !config.arbitration_enabled.unwrap_or(false) {
            return None;
        }
        let vault = config.arbitration_collateral_vault.as_ref()?
            .parse().ok()?;
        let settlement = config.arbitration_settlement_contract.as_ref()?
            .parse().ok()?;
        Some(Self {
            collateral_vault: vault,
            settlement_contract: settlement,
            signature_threshold: config.arbitration_threshold.unwrap_or(2),
            poll_interval_secs: config.arbitration_poll_interval.unwrap_or(30),
            data_node_url: config.arbitration_data_node_url.clone()
                .unwrap_or_else(|| "http://localhost:8200".to_string()),
            data_node_token: config.data_node_token.clone(),
            ..Default::default()
        })
    }
}

/// An arbitration request from CollateralVault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrationRequest {
    pub bet_id: U256,
    pub trades_root: H256,
    pub creator: Address,
    pub filler: Address,
    pub creator_amount: U256,
    pub filler_amount: U256,
    pub deadline: U256,
}

/// Exit price for a single trade (integer cents for determinism)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArbitrationTradePrice {
    pub trade_index: u32,
    pub symbol: String,
    pub exit_price_cents: i64,
}

/// Result of arbitration consensus
#[derive(Debug, Clone)]
pub struct ArbitrationResult {
    pub bet_id: U256,
    pub creator_wins: bool,
    pub aggregated_signature: Vec<u8>,
    pub signer_bitmap: U256,
    pub signer_count: usize,
    pub reference_nonce: u64,
}

/// Phase of the 4-phase arbitration consensus
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArbitrationPhase {
    Idle,
    PriceProposal,
    PriceVote,
    ResolutionSign,
    Complete,
    Failed,
}
