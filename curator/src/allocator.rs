//! Allocation bot for MetaMorpho vault rebalancing
//!
//! Monitors vault utilization across ITP markets and rebalances USDC
//! distribution to optimize yield while respecting risk tier concentration limits.
//!
//! Key features:
//! - Query market utilization rates from Morpho Blue
//! - Identify markets above/below target utilization (70-85%)
//! - Compute reallocation decisions respecting tier caps
//! - Execute vault.reallocate() transactions

use crate::data_node_client::{DataNodeClient, MorphoMarketData};
use crate::quote::CrisisLevel;
use crate::tier_config::{RiskTier, RiskTierConfig};
use chrono::{DateTime, Utc};
use ethers::prelude::*;
use ethers::types::{Address, TransactionRequest, H256, U256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, info, warn};

// ============================================================================
// Constants
// ============================================================================

/// Minimum target utilization percentage
pub const TARGET_UTILIZATION_MIN: u8 = 70;

/// Maximum target utilization percentage
pub const TARGET_UTILIZATION_MAX: u8 = 85;

/// Critical high utilization — prioritize supply
pub const UTILIZATION_CRITICAL_HIGH: u8 = 90;

/// Critical low utilization — strong withdrawal candidate
pub const UTILIZATION_CRITICAL_LOW: u8 = 50;

/// Warning threshold for approaching tier cap (80% of cap)
pub const CAP_WARNING_THRESHOLD_PCT: u8 = 80;

/// Minimum allocation amount for retry (1 USDC = 1e6, avoid dust)
pub const MIN_ALLOCATION_AMOUNT: u64 = 1_000_000;

// ============================================================================
// Helpers
// ============================================================================

/// Parse a hex-encoded market ID string (e.g. "0xabcd...") into a [u8; 32].
/// Returns None if the hex is invalid or not exactly 32 bytes.
fn parse_market_id_hex(hex_str: &str) -> Option<[u8; 32]> {
    let hex = hex_str.strip_prefix("0x").unwrap_or(hex_str);
    let bytes = hex::decode(hex).ok()?;
    if bytes.len() != 32 {
        return None;
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Some(out)
}

// ============================================================================
// Function Selectors (precomputed keccak256 for efficiency)
// ============================================================================

/// Selector for morpho.market(bytes32) - keccak256("market(bytes32)")[:4]
const SELECTOR_MARKET: [u8; 4] = [0x5c, 0x60, 0xe3, 0x9a];

/// Selector for morpho.position(bytes32,address) - keccak256("position(bytes32,address)")[:4]
const SELECTOR_POSITION: [u8; 4] = [0x93, 0xc5, 0x20, 0x62];

/// Selector for morpho.idToMarketParams(bytes32) - keccak256("idToMarketParams(bytes32)")[:4]
const SELECTOR_ID_TO_MARKET_PARAMS: [u8; 4] = [0x2c, 0x3c, 0x91, 0x57];

/// Selector for vault.totalAssets() - keccak256("totalAssets()")[:4]
const SELECTOR_TOTAL_ASSETS: [u8; 4] = [0x01, 0xe1, 0xd1, 0x14];

/// Selector for vault.supplyQueueLength() - keccak256("supplyQueueLength()")[:4]
const SELECTOR_SUPPLY_QUEUE_LENGTH: [u8; 4] = [0xa1, 0x7b, 0x31, 0x30];

/// Selector for vault.supplyQueue(uint256) - keccak256("supplyQueue(uint256)")[:4]
const SELECTOR_SUPPLY_QUEUE: [u8; 4] = [0xf7, 0xd1, 0x85, 0x21];

/// Selector for vault.reallocate(MarketAllocation[])
/// keccak256("reallocate((address,address,address,address,uint256,uint256)[])")[:4]
const SELECTOR_REALLOCATE: [u8; 4] = [0xf6, 0x89, 0xc7, 0x4f];

// ============================================================================
// Types
// ============================================================================

/// MarketParams structure matching Solidity
#[derive(Debug, Clone)]
pub struct MarketParamsData {
    pub loan_token: Address,
    pub collateral_token: Address,
    pub oracle: Address,
    pub irm: Address,
    pub lltv: U256,
}

/// Metrics for a single market
#[derive(Debug, Clone)]
pub struct MarketMetrics {
    /// Market identifier (keccak256 of MarketParams)
    pub market_id: [u8; 32],
    /// Total supply assets in the market
    pub total_supply: U256,
    /// Total borrow assets in the market
    pub total_borrow: U256,
    /// Total supply shares in the market
    pub total_supply_shares: U256,
    /// Utilization percentage (0-100)
    pub utilization_pct: u8,
    /// Vault's current supply in this market (in assets)
    pub vault_supply: U256,
    /// Market parameters
    pub market_params: MarketParamsData,
}

impl MarketMetrics {
    /// Check if market is above target utilization
    pub fn is_high_utilization(&self) -> bool {
        self.utilization_pct > TARGET_UTILIZATION_MAX
    }

    /// Check if market is below target utilization
    pub fn is_low_utilization(&self) -> bool {
        self.utilization_pct < TARGET_UTILIZATION_MIN
    }

    /// Check if market is at critical high utilization
    pub fn is_critical_high(&self) -> bool {
        self.utilization_pct >= UTILIZATION_CRITICAL_HIGH
    }

    /// Check if market is at critical low utilization
    pub fn is_critical_low(&self) -> bool {
        self.utilization_pct <= UTILIZATION_CRITICAL_LOW
    }

    /// Check if market is within target range
    pub fn is_in_target_range(&self) -> bool {
        self.utilization_pct >= TARGET_UTILIZATION_MIN
            && self.utilization_pct <= TARGET_UTILIZATION_MAX
    }
}

/// Action to take for a market
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AllocationAction {
    /// Supply more assets to this market
    Supply,
    /// Withdraw assets from this market
    Withdraw,
    /// No action needed
    NoChange,
}

/// Decision for a single market
#[derive(Debug, Clone)]
pub struct AllocationDecision {
    /// Market identifier
    pub market_id: [u8; 32],
    /// Action to take
    pub action: AllocationAction,
    /// Amount to supply/withdraw (in assets)
    pub amount: U256,
    /// Reason for the decision
    pub reason: String,
    /// Priority (higher = more urgent)
    pub priority: u8,
}

/// MarketAllocation for reallocate() call
#[derive(Debug, Clone)]
pub struct MarketAllocation {
    pub market_params: MarketParamsData,
    pub assets: U256,
}

/// Report from an allocation cycle
#[derive(Debug, Clone)]
pub struct AllocationReport {
    /// When this cycle ran
    pub cycle_time: DateTime<Utc>,
    /// Number of markets analyzed
    pub markets_analyzed: usize,
    /// Decisions made
    pub decisions: Vec<AllocationDecision>,
    /// Transaction hash if reallocation was executed
    pub tx_hash: Option<H256>,
    /// Whether the cycle succeeded
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
}

// ============================================================================
// Errors
// ============================================================================

/// Errors from the allocation bot
#[derive(Debug, Error)]
pub enum AllocatorError {
    #[error("Failed to read market data: {0}")]
    ReadError(String),

    #[error("Transaction failed: {0}")]
    TransactionFailed(String),

    #[error("Insufficient liquidity to withdraw {requested} from market (available: {available})")]
    InsufficientLiquidity { requested: U256, available: U256 },

    #[error("Cap exceeded for market: {0}")]
    CapExceeded(String),

    #[error("Invalid market: {0}")]
    InvalidMarket(String),

    #[error("Operation timed out: {0}")]
    Timeout(String),

    #[error("Provider error: {0}")]
    Provider(String),

    #[error("ABI encoding error: {0}")]
    AbiEncoding(String),
}

// ============================================================================
// AllocationBot
// ============================================================================

/// Allocation bot for MetaMorpho vault rebalancing
pub struct AllocationBot {
    /// Ethereum provider
    provider: Arc<Provider<Http>>,
    /// Wallet for signing transactions
    wallet: LocalWallet,
    /// Morpho Blue contract address
    morpho_address: Address,
    /// MetaMorpho vault address
    vault_address: Address,
    /// Market IDs to monitor
    market_ids: Vec<[u8; 32]>,
    /// Risk tier configurations per market
    risk_tier_configs: HashMap<[u8; 32], RiskTierConfig>,
    /// Cached market params (market_id -> params)
    market_params_cache: HashMap<[u8; 32], MarketParamsData>,
    /// HTTP timeout for RPC calls
    rpc_timeout: Duration,
    /// Optional data-node client for reading market state via HTTP instead of RPC
    data_node_client: Option<DataNodeClient>,
}

impl AllocationBot {
    /// Create a new allocation bot
    pub fn new(
        rpc_url: &str,
        private_key: &str,
        morpho_address: Address,
        vault_address: Address,
        market_ids: Vec<[u8; 32]>,
        risk_tier_configs: HashMap<[u8; 32], RiskTierConfig>,
    ) -> Result<Self, AllocatorError> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| AllocatorError::Provider(format!("Failed to create provider: {}", e)))?;

        let wallet: LocalWallet = private_key
            .parse()
            .map_err(|e| AllocatorError::Provider(format!("Failed to parse private key: {}", e)))?;

        Ok(Self {
            provider: Arc::new(provider),
            wallet,
            morpho_address,
            vault_address,
            market_ids,
            risk_tier_configs,
            market_params_cache: HashMap::new(),
            rpc_timeout: Duration::from_secs(30),
            data_node_client: None,
        })
    }

    /// Set data-node client for proxying market reads through the data-node HTTP API
    pub fn set_data_node_client(&mut self, client: DataNodeClient) {
        self.data_node_client = Some(client);
    }

    /// Add a new market to monitor
    pub fn add_market(&mut self, market_id: [u8; 32], tier_config: Option<RiskTierConfig>) {
        if !self.market_ids.contains(&market_id) {
            self.market_ids.push(market_id);
        }
        if let Some(config) = tier_config {
            self.risk_tier_configs.insert(market_id, config);
        }
    }

    /// Get tier config for a market (defaults to Tier D if not configured)
    pub fn get_tier_config(&self, market_id: &[u8; 32]) -> RiskTierConfig {
        self.risk_tier_configs
            .get(market_id)
            .cloned()
            .unwrap_or_else(|| RiskTierConfig::new(RiskTier::D))
    }

    /// Clear the market params cache to force re-fetch from chain
    /// Call this when market params may have changed on-chain
    pub fn clear_market_params_cache(&mut self) {
        self.market_params_cache.clear();
        debug!("Cleared market params cache");
    }

    /// Clear cache entry for a specific market
    pub fn invalidate_market_params(&mut self, market_id: &[u8; 32]) {
        self.market_params_cache.remove(market_id);
        debug!(market_id = %hex::encode(market_id), "Invalidated market params cache entry");
    }

    // ========================================================================
    // Market Metrics Reading (Task 2)
    // ========================================================================

    /// Read market state from Morpho Blue
    pub async fn read_market_metrics(
        &mut self,
        market_id: [u8; 32],
    ) -> Result<MarketMetrics, AllocatorError> {
        let mut calldata = SELECTOR_MARKET.to_vec();
        calldata.extend_from_slice(&market_id);

        let tx = TransactionRequest::new()
            .to(self.morpho_address)
            .data(calldata);

        let result = tokio::time::timeout(self.rpc_timeout, self.provider.call(&tx.into(), None))
            .await
            .map_err(|_| AllocatorError::Timeout("market() call".to_string()))?
            .map_err(|e| AllocatorError::ReadError(format!("market() call failed: {}", e)))?;

        if result.len() < 192 {
            return Err(AllocatorError::ReadError(format!(
                "Invalid market data length: {} (expected 192)",
                result.len()
            )));
        }

        // Decode: totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee
        // Each is uint128, but ABI encodes as uint256 (32 bytes each)
        let total_supply = U256::from_big_endian(&result[0..32]);
        let total_supply_shares = U256::from_big_endian(&result[32..64]);
        let total_borrow = U256::from_big_endian(&result[64..96]);
        // totalBorrowShares, lastUpdate, fee not needed for utilization

        // Compute utilization: borrow * 100 / supply
        let utilization_pct = if total_supply.is_zero() {
            0u8
        } else {
            let util = total_borrow
                .checked_mul(U256::from(100))
                .unwrap_or(U256::MAX)
                .checked_div(total_supply)
                .unwrap_or(U256::zero());
            util.as_u64().min(100) as u8
        };

        // Get vault's supply in this market, passing already-fetched market data to avoid double RPC
        let vault_supply = self
            .read_vault_supply_in_market_with_totals(market_id, total_supply, total_supply_shares)
            .await?;

        // Get or fetch market params
        let market_params = self.get_market_params(market_id).await?;

        Ok(MarketMetrics {
            market_id,
            total_supply,
            total_borrow,
            total_supply_shares,
            utilization_pct,
            vault_supply,
            market_params,
        })
    }

    /// Read vault's position (supply) in a specific market using pre-fetched totals
    /// This avoids a redundant RPC call when market data is already available
    async fn read_vault_supply_in_market_with_totals(
        &self,
        market_id: [u8; 32],
        total_supply_assets: U256,
        total_supply_shares: U256,
    ) -> Result<U256, AllocatorError> {
        let mut calldata = SELECTOR_POSITION.to_vec();
        calldata.extend_from_slice(&market_id);
        // Pad address to 32 bytes
        calldata.extend_from_slice(&[0u8; 12]);
        calldata.extend_from_slice(self.vault_address.as_bytes());

        let tx = TransactionRequest::new()
            .to(self.morpho_address)
            .data(calldata);

        let result = tokio::time::timeout(self.rpc_timeout, self.provider.call(&tx.into(), None))
            .await
            .map_err(|_| AllocatorError::Timeout("position() call".to_string()))?
            .map_err(|e| AllocatorError::ReadError(format!("position() call failed: {}", e)))?;

        if result.len() < 96 {
            return Err(AllocatorError::ReadError(format!(
                "Invalid position data length: {}",
                result.len()
            )));
        }

        // Position returns: supplyShares (uint256), borrowShares (uint128), collateral (uint128)
        let supply_shares = U256::from_big_endian(&result[0..32]);

        if total_supply_shares.is_zero() {
            return Ok(U256::zero());
        }

        // assets = shares * totalSupplyAssets / totalSupplyShares
        let assets = supply_shares
            .checked_mul(total_supply_assets)
            .unwrap_or(U256::zero())
            .checked_div(total_supply_shares)
            .unwrap_or(U256::zero());

        Ok(assets)
    }

    /// Read vault's position (supply) in a specific market (standalone, fetches market data)
    /// Use read_vault_supply_in_market_with_totals when market data is already available
    pub async fn read_vault_supply_in_market(
        &self,
        market_id: [u8; 32],
    ) -> Result<U256, AllocatorError> {
        // Need to fetch market data for share->asset conversion
        let mut calldata = SELECTOR_MARKET.to_vec();
        calldata.extend_from_slice(&market_id);

        let market_tx = TransactionRequest::new()
            .to(self.morpho_address)
            .data(calldata);

        let market_result = tokio::time::timeout(
            self.rpc_timeout,
            self.provider.call(&market_tx.into(), None),
        )
        .await
        .map_err(|_| AllocatorError::Timeout("market() call".to_string()))?
        .map_err(|e| AllocatorError::ReadError(format!("market() call failed: {}", e)))?;

        if market_result.len() < 64 {
            return Ok(U256::zero());
        }

        let total_supply_assets = U256::from_big_endian(&market_result[0..32]);
        let total_supply_shares = U256::from_big_endian(&market_result[32..64]);

        // Now get position using the fetched totals
        let mut pos_calldata = SELECTOR_POSITION.to_vec();
        pos_calldata.extend_from_slice(&market_id);
        pos_calldata.extend_from_slice(&[0u8; 12]);
        pos_calldata.extend_from_slice(self.vault_address.as_bytes());

        let pos_tx = TransactionRequest::new()
            .to(self.morpho_address)
            .data(pos_calldata);

        let result = tokio::time::timeout(self.rpc_timeout, self.provider.call(&pos_tx.into(), None))
            .await
            .map_err(|_| AllocatorError::Timeout("position() call".to_string()))?
            .map_err(|e| AllocatorError::ReadError(format!("position() call failed: {}", e)))?;

        if result.len() < 96 {
            return Err(AllocatorError::ReadError(format!(
                "Invalid position data length: {}",
                result.len()
            )));
        }

        let supply_shares = U256::from_big_endian(&result[0..32]);

        if total_supply_shares.is_zero() {
            return Ok(U256::zero());
        }

        let assets = supply_shares
            .checked_mul(total_supply_assets)
            .unwrap_or(U256::zero())
            .checked_div(total_supply_shares)
            .unwrap_or(U256::zero());

        Ok(assets)
    }

    /// Read all market metrics — tries data-node first, falls back to per-market RPC
    pub async fn read_all_market_metrics(&mut self) -> Result<Vec<MarketMetrics>, AllocatorError> {
        // Try data-node first when configured
        if self.data_node_client.is_some() {
            match self.read_all_market_metrics_from_data_node().await {
                Ok(metrics) if !metrics.is_empty() => {
                    debug!(count = metrics.len(), "Market metrics via data-node");
                    return Ok(metrics);
                }
                Ok(_) => {
                    warn!("Data-node returned empty market list, falling back to RPC");
                }
                Err(e) => {
                    warn!(error = %e, "Data-node market read failed, falling back to RPC");
                }
            }
        }

        self.read_all_market_metrics_via_rpc().await
    }

    /// Read all market metrics via direct RPC (fallback path)
    async fn read_all_market_metrics_via_rpc(&mut self) -> Result<Vec<MarketMetrics>, AllocatorError> {
        let mut metrics = Vec::new();
        // Clone market_ids to avoid borrowing self while iterating
        // (read_market_metrics takes &mut self for cache updates)
        let market_ids: Vec<_> = self.market_ids.iter().copied().collect();

        for market_id in market_ids {
            match self.read_market_metrics(market_id).await {
                Ok(m) => {
                    debug!(
                        market_id = %hex::encode(market_id),
                        utilization = m.utilization_pct,
                        vault_supply = %m.vault_supply,
                        "Read market metrics"
                    );
                    metrics.push(m);
                }
                Err(e) => {
                    warn!(
                        market_id = %hex::encode(market_id),
                        error = %e,
                        "Failed to read market metrics, skipping"
                    );
                    // Skip failed markets gracefully
                }
            }
        }

        Ok(metrics)
    }

    /// Read market metrics from data-node, with RPC for vault position and market params
    async fn read_all_market_metrics_from_data_node(
        &mut self,
    ) -> Result<Vec<MarketMetrics>, AllocatorError> {
        let dn = self.data_node_client.as_ref().unwrap();
        let all_markets = dn
            .get_all_markets()
            .await
            .map_err(|e| AllocatorError::ReadError(format!("data-node get_all_markets: {}", e)))?;

        // Index data-node markets by their ID bytes for lookup
        let dn_by_id: HashMap<[u8; 32], &MorphoMarketData> = all_markets
            .iter()
            .filter_map(|m| {
                parse_market_id_hex(&m.market_id).map(|id| (id, m))
            })
            .collect();

        let market_ids: Vec<_> = self.market_ids.iter().copied().collect();
        let mut metrics = Vec::new();

        for market_id in market_ids {
            let dn_market = match dn_by_id.get(&market_id) {
                Some(m) => *m,
                None => {
                    // Market not in data-node response — fall back to RPC for this one
                    match self.read_market_metrics(market_id).await {
                        Ok(m) => {
                            metrics.push(m);
                            continue;
                        }
                        Err(e) => {
                            warn!(
                                market_id = %hex::encode(market_id),
                                error = %e,
                                "Market not in data-node and RPC fallback failed, skipping"
                            );
                            continue;
                        }
                    }
                }
            };

            // Parse supply/borrow from data-node strings
            let total_supply = U256::from_dec_str(&dn_market.total_supply_assets)
                .unwrap_or(U256::zero());
            let total_supply_shares = U256::from_dec_str(&dn_market.total_supply_shares)
                .unwrap_or(U256::zero());
            let total_borrow = U256::from_dec_str(&dn_market.total_borrow_assets)
                .unwrap_or(U256::zero());

            let utilization_pct = if total_supply.is_zero() {
                0u8
            } else {
                let util = total_borrow
                    .checked_mul(U256::from(100))
                    .unwrap_or(U256::MAX)
                    .checked_div(total_supply)
                    .unwrap_or(U256::zero());
                util.as_u64().min(100) as u8
            };

            // Vault position still requires RPC (data-node doesn't track per-vault positions)
            let vault_supply = self
                .read_vault_supply_in_market_with_totals(market_id, total_supply, total_supply_shares)
                .await
                .unwrap_or(U256::zero());

            // Market params: cache or RPC
            let market_params = match self.get_market_params(market_id).await {
                Ok(p) => p,
                Err(e) => {
                    warn!(
                        market_id = %hex::encode(market_id),
                        error = %e,
                        "Failed to get market params, skipping"
                    );
                    continue;
                }
            };

            debug!(
                market_id = %hex::encode(market_id),
                utilization = utilization_pct,
                vault_supply = %vault_supply,
                "Read market metrics (data-node + RPC position)"
            );

            metrics.push(MarketMetrics {
                market_id,
                total_supply,
                total_borrow,
                total_supply_shares,
                utilization_pct,
                vault_supply,
                market_params,
            });
        }

        Ok(metrics)
    }

    /// Read total assets in the vault (ERC4626 totalAssets())
    pub async fn read_vault_total_assets(&self) -> Result<U256, AllocatorError> {
        let tx = TransactionRequest::new()
            .to(self.vault_address)
            .data(SELECTOR_TOTAL_ASSETS.to_vec());

        let result = tokio::time::timeout(self.rpc_timeout, self.provider.call(&tx.into(), None))
            .await
            .map_err(|_| AllocatorError::Timeout("totalAssets() call".to_string()))?
            .map_err(|e| AllocatorError::ReadError(format!("totalAssets() call failed: {}", e)))?;

        if result.len() < 32 {
            return Err(AllocatorError::ReadError(
                "Invalid totalAssets response".to_string(),
            ));
        }

        Ok(U256::from_big_endian(&result[0..32]))
    }

    /// Get market params from cache or fetch from chain
    async fn get_market_params(
        &mut self,
        market_id: [u8; 32],
    ) -> Result<MarketParamsData, AllocatorError> {
        if let Some(params) = self.market_params_cache.get(&market_id) {
            return Ok(params.clone());
        }

        let mut calldata = SELECTOR_ID_TO_MARKET_PARAMS.to_vec();
        calldata.extend_from_slice(&market_id);

        let tx = TransactionRequest::new()
            .to(self.morpho_address)
            .data(calldata);

        let result = tokio::time::timeout(self.rpc_timeout, self.provider.call(&tx.into(), None))
            .await
            .map_err(|_| AllocatorError::Timeout("idToMarketParams() call".to_string()))?
            .map_err(|e| {
                AllocatorError::ReadError(format!("idToMarketParams() call failed: {}", e))
            })?;

        if result.len() < 160 {
            return Err(AllocatorError::ReadError(format!(
                "Invalid idToMarketParams data length: {}",
                result.len()
            )));
        }

        // Decode: loanToken, collateralToken, oracle, irm, lltv (all padded to 32 bytes)
        let loan_token = Address::from_slice(&result[12..32]);
        let collateral_token = Address::from_slice(&result[44..64]);
        let oracle = Address::from_slice(&result[76..96]);
        let irm = Address::from_slice(&result[108..128]);
        let lltv = U256::from_big_endian(&result[128..160]);

        let params = MarketParamsData {
            loan_token,
            collateral_token,
            oracle,
            irm,
            lltv,
        };

        self.market_params_cache.insert(market_id, params.clone());
        Ok(params)
    }

    // ========================================================================
    // Allocation Decision Engine (Task 3)
    // ========================================================================

    /// Compute allocation decisions for all markets
    pub fn compute_allocation_decisions(
        metrics: &[MarketMetrics],
        vault_total: U256,
        tier_configs: &HashMap<[u8; 32], RiskTierConfig>,
    ) -> Vec<AllocationDecision> {
        let mut decisions = Vec::new();

        for m in metrics {
            let tier_config = tier_configs
                .get(&m.market_id)
                .cloned()
                .unwrap_or_else(|| RiskTierConfig::new(RiskTier::D));

            // Check tier cap violation
            let max_allowed = vault_total
                .checked_mul(U256::from(tier_config.max_concentration_pct))
                .unwrap_or(U256::MAX)
                .checked_div(U256::from(100))
                .unwrap_or(U256::zero());

            let warning_threshold = max_allowed
                .checked_mul(U256::from(CAP_WARNING_THRESHOLD_PCT))
                .unwrap_or(U256::MAX)
                .checked_div(U256::from(100))
                .unwrap_or(U256::zero());

            // Log warning if approaching cap
            if m.vault_supply > warning_threshold && m.vault_supply <= max_allowed {
                warn!(
                    market_id = %hex::encode(m.market_id),
                    vault_supply = %m.vault_supply,
                    warning_threshold = %warning_threshold,
                    max_allowed = %max_allowed,
                    "Market approaching tier cap"
                );
            }

            let decision = if m.is_critical_high() {
                // Critical high utilization: prioritize supply
                let headroom = max_allowed.saturating_sub(m.vault_supply);
                if headroom > U256::zero() {
                    AllocationDecision {
                        market_id: m.market_id,
                        action: AllocationAction::Supply,
                        amount: headroom, // Will be adjusted based on available liquidity
                        reason: format!(
                            "Critical high utilization ({}%), supply up to tier cap",
                            m.utilization_pct
                        ),
                        priority: 100, // Highest priority
                    }
                } else {
                    AllocationDecision {
                        market_id: m.market_id,
                        action: AllocationAction::NoChange,
                        amount: U256::zero(),
                        reason: format!(
                            "Critical high utilization ({}%) but at tier cap",
                            m.utilization_pct
                        ),
                        priority: 0,
                    }
                }
            } else if m.is_high_utilization() {
                // High utilization: consider supply
                let headroom = max_allowed.saturating_sub(m.vault_supply);
                if headroom > U256::zero() {
                    AllocationDecision {
                        market_id: m.market_id,
                        action: AllocationAction::Supply,
                        amount: headroom,
                        reason: format!(
                            "High utilization ({}%), supply up to tier cap",
                            m.utilization_pct
                        ),
                        priority: 80,
                    }
                } else {
                    AllocationDecision {
                        market_id: m.market_id,
                        action: AllocationAction::NoChange,
                        amount: U256::zero(),
                        reason: format!(
                            "High utilization ({}%) but at tier cap",
                            m.utilization_pct
                        ),
                        priority: 0,
                    }
                }
            } else if m.is_critical_low() {
                // Critical low utilization: strong withdrawal candidate
                AllocationDecision {
                    market_id: m.market_id,
                    action: AllocationAction::Withdraw,
                    amount: m.vault_supply, // Withdraw all
                    reason: format!(
                        "Critical low utilization ({}%), withdraw excess",
                        m.utilization_pct
                    ),
                    priority: 50,
                }
            } else if m.is_low_utilization() {
                // Low utilization: consider withdrawal if there's a better destination
                AllocationDecision {
                    market_id: m.market_id,
                    action: AllocationAction::Withdraw,
                    amount: m.vault_supply.checked_div(U256::from(2)).unwrap_or(U256::zero()), // Partial withdrawal
                    reason: format!(
                        "Low utilization ({}%), consider reallocation",
                        m.utilization_pct
                    ),
                    priority: 30,
                }
            } else {
                // Within target range
                AllocationDecision {
                    market_id: m.market_id,
                    action: AllocationAction::NoChange,
                    amount: U256::zero(),
                    reason: format!(
                        "Utilization ({}%) within target range ({}%-{}%)",
                        m.utilization_pct, TARGET_UTILIZATION_MIN, TARGET_UTILIZATION_MAX
                    ),
                    priority: 0,
                }
            };

            decisions.push(decision);
        }

        // Sort by priority (highest first)
        decisions.sort_by(|a, b| b.priority.cmp(&a.priority));

        decisions
    }

    // ========================================================================
    // Crisis-Aware Allocation (Phase 5B)
    // ========================================================================

    /// Compute crisis-aware allocation decisions
    ///
    /// Instead of pure utilization targets, uses crisis level to determine
    /// target supply per market:
    /// - Normal: borrowed * 1.25 (25% headroom)
    /// - Elevated/Stress/Emergency: borrowed * 1.25 * 1.5 (87.5% headroom)
    ///
    /// When vault can't cover all targets, prioritizes by crisis severity.
    pub fn compute_crisis_aware_decisions(
        metrics: &[MarketMetrics],
        vault_total: U256,
        tier_configs: &HashMap<[u8; 32], RiskTierConfig>,
        crisis_levels: &HashMap<String, CrisisLevel>,
    ) -> Vec<AllocationDecision> {
        let mut decisions = Vec::new();
        let min_liquidity_floor = U256::from(1_000u64) * U256::exp10(6); // 1000 USDC

        for m in metrics {
            let tier_config = tier_configs
                .get(&m.market_id)
                .cloned()
                .unwrap_or_else(|| RiskTierConfig::new(RiskTier::D));

            let market_hex = format!("0x{}", hex::encode(m.market_id));
            let crisis = crisis_levels
                .get(&market_hex)
                .copied()
                .unwrap_or(CrisisLevel::Normal);

            // Compute max allowed by tier cap
            let max_allowed = vault_total
                .checked_mul(U256::from(tier_config.max_concentration_pct))
                .unwrap_or(U256::MAX)
                .checked_div(U256::from(100))
                .unwrap_or(U256::zero());

            // Base target: borrowed * 1.25 (25% headroom), minimum floor
            let base_target = std::cmp::max(
                m.total_borrow
                    .checked_mul(U256::from(125))
                    .unwrap_or(U256::MAX)
                    .checked_div(U256::from(100))
                    .unwrap_or(U256::zero()),
                min_liquidity_floor,
            );

            // Crisis multiplier: 1.5x for elevated+
            let target = match crisis {
                CrisisLevel::Normal => base_target,
                _ => base_target
                    .checked_mul(U256::from(150))
                    .unwrap_or(U256::MAX)
                    .checked_div(U256::from(100))
                    .unwrap_or(base_target),
            };

            // Cap at tier maximum
            let target = std::cmp::min(target, max_allowed);

            // Priority based on crisis level
            let crisis_priority: u8 = match crisis {
                CrisisLevel::Emergency => 100,
                CrisisLevel::Stress => 80,
                CrisisLevel::Elevated => 60,
                CrisisLevel::Normal => 40,
            };

            let decision = if m.vault_supply < target {
                let supply_needed = target.saturating_sub(m.vault_supply);
                AllocationDecision {
                    market_id: m.market_id,
                    action: AllocationAction::Supply,
                    amount: supply_needed,
                    reason: format!(
                        "Crisis-aware: {:?} level, supply {:.0} to reach target",
                        crisis, supply_needed
                    ),
                    priority: crisis_priority,
                }
            } else if m.vault_supply > target
                && crisis == CrisisLevel::Normal
                && m.is_low_utilization()
            {
                // Only withdraw excess from Normal markets with low utilization
                let excess = m.vault_supply.saturating_sub(target);
                AllocationDecision {
                    market_id: m.market_id,
                    action: AllocationAction::Withdraw,
                    amount: excess,
                    reason: format!(
                        "Crisis-aware: Normal level, low util ({}%), withdraw excess",
                        m.utilization_pct
                    ),
                    priority: 20,
                }
            } else {
                AllocationDecision {
                    market_id: m.market_id,
                    action: AllocationAction::NoChange,
                    amount: U256::zero(),
                    reason: format!(
                        "Crisis-aware: {:?} level, supply adequate",
                        crisis
                    ),
                    priority: 0,
                }
            };

            decisions.push(decision);
        }

        // Sort by priority (highest first) — Emergency markets get supply first
        decisions.sort_by(|a, b| b.priority.cmp(&a.priority));

        decisions
    }

    // ========================================================================
    // Vault Reallocation Executor (Task 4)
    // ========================================================================

    /// Build reallocation calldata for vault.reallocate()
    pub fn build_reallocation_calldata(
        &self,
        decisions: &[AllocationDecision],
        metrics: &[MarketMetrics],
    ) -> Result<Vec<MarketAllocation>, AllocatorError> {
        let mut allocations = Vec::new();

        // Find metrics by market_id
        let metrics_map: HashMap<[u8; 32], &MarketMetrics> =
            metrics.iter().map(|m| (m.market_id, m)).collect();

        // First: withdrawals (assets = 0 to withdraw all, or specific amount)
        for decision in decisions.iter().filter(|d| d.action == AllocationAction::Withdraw) {
            if let Some(m) = metrics_map.get(&decision.market_id) {
                allocations.push(MarketAllocation {
                    market_params: m.market_params.clone(),
                    assets: U256::zero(), // Withdraw all from this market
                });
            }
        }

        // Then: supplies (use type(uint256).max for last to supply all remaining)
        let supply_decisions: Vec<_> = decisions
            .iter()
            .filter(|d| d.action == AllocationAction::Supply)
            .collect();

        for (i, decision) in supply_decisions.iter().enumerate() {
            if let Some(m) = metrics_map.get(&decision.market_id) {
                let assets = if i == supply_decisions.len() - 1 {
                    U256::MAX // Supply all remaining to last market
                } else {
                    decision.amount
                };

                allocations.push(MarketAllocation {
                    market_params: m.market_params.clone(),
                    assets,
                });
            }
        }

        Ok(allocations)
    }

    /// Execute vault.reallocate() transaction
    pub async fn execute_reallocate(
        &self,
        allocations: Vec<MarketAllocation>,
    ) -> Result<H256, AllocatorError> {
        if allocations.is_empty() {
            return Err(AllocatorError::InvalidMarket(
                "No allocations to execute".to_string(),
            ));
        }

        // ABI encode the allocations array
        let encoded = self.encode_allocations(&allocations)?;

        let mut calldata = SELECTOR_REALLOCATE.to_vec();
        calldata.extend_from_slice(&encoded);

        let chain_id = self
            .provider
            .get_chainid()
            .await
            .map_err(|e| AllocatorError::Provider(format!("Failed to get chain ID: {}", e)))?;

        let wallet = self.wallet.clone().with_chain_id(chain_id.as_u64());
        let client = SignerMiddleware::new(self.provider.clone(), wallet);

        let tx = TransactionRequest::new()
            .to(self.vault_address)
            .data(calldata);

        let pending_tx = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| AllocatorError::TransactionFailed(format!("Failed to send: {}", e)))?;

        let tx_hash = pending_tx.tx_hash();

        // Wait for receipt
        let receipt = tokio::time::timeout(Duration::from_secs(60), pending_tx)
            .await
            .map_err(|_| AllocatorError::Timeout("Transaction confirmation".to_string()))?
            .map_err(|e| AllocatorError::TransactionFailed(format!("Failed to confirm: {}", e)))?;

        match receipt {
            Some(r) if r.status == Some(1.into()) => {
                info!(tx_hash = ?tx_hash, "Reallocation executed successfully");
                Ok(tx_hash)
            }
            Some(_) => Err(AllocatorError::TransactionFailed(format!(
                "Transaction reverted: {}",
                tx_hash
            ))),
            None => Err(AllocatorError::TransactionFailed(format!(
                "No receipt for tx: {}",
                tx_hash
            ))),
        }
    }

    /// ABI encode MarketAllocation[] for reallocate()
    fn encode_allocations(&self, allocations: &[MarketAllocation]) -> Result<Vec<u8>, AllocatorError> {
        // Dynamic array encoding:
        // - offset to array data (32 bytes)
        // - array length (32 bytes)
        // - each element encoded

        let mut tokens = Vec::new();

        for alloc in allocations {
            // Each MarketAllocation is a tuple of (MarketParams, uint256)
            // MarketParams is a tuple of (address, address, address, address, uint256)
            let market_params_tuple = ethers::abi::Token::Tuple(vec![
                ethers::abi::Token::Address(alloc.market_params.loan_token),
                ethers::abi::Token::Address(alloc.market_params.collateral_token),
                ethers::abi::Token::Address(alloc.market_params.oracle),
                ethers::abi::Token::Address(alloc.market_params.irm),
                ethers::abi::Token::Uint(alloc.market_params.lltv),
            ]);

            let allocation_tuple = ethers::abi::Token::Tuple(vec![
                market_params_tuple,
                ethers::abi::Token::Uint(alloc.assets),
            ]);

            tokens.push(allocation_tuple);
        }

        let encoded = ethers::abi::encode(&[ethers::abi::Token::Array(tokens)]);
        Ok(encoded)
    }

    /// Execute reallocation with retry on failure
    /// Reduces amounts by 50% on first failure, but only if amounts remain above MIN_ALLOCATION_AMOUNT
    pub async fn execute_reallocate_with_retry(
        &self,
        mut allocations: Vec<MarketAllocation>,
    ) -> Result<H256, AllocatorError> {
        match self.execute_reallocate(allocations.clone()).await {
            Ok(hash) => Ok(hash),
            Err(e) => {
                // Check if any allocation has enough room to reduce
                let can_reduce = allocations.iter().any(|a| {
                    a.assets != U256::MAX
                        && a.assets > U256::from(MIN_ALLOCATION_AMOUNT * 2)
                });

                if !can_reduce {
                    warn!(
                        error = %e,
                        "Reallocation failed and amounts too small to reduce, not retrying"
                    );
                    return Err(e);
                }

                warn!(error = %e, "Reallocation failed, retrying with 50% reduced amounts");

                // Reduce amounts by 50%, but keep minimum threshold
                for alloc in &mut allocations {
                    if alloc.assets != U256::MAX {
                        let reduced = alloc.assets.checked_div(U256::from(2)).unwrap_or(U256::zero());
                        // Only reduce if result is above minimum
                        if reduced >= U256::from(MIN_ALLOCATION_AMOUNT) {
                            alloc.assets = reduced;
                        }
                    }
                }

                self.execute_reallocate(allocations).await
            }
        }
    }

    // ========================================================================
    // Main Allocation Loop (Task 5)
    // ========================================================================

    /// Run a single allocation cycle
    pub async fn run_allocation_cycle(&mut self) -> Result<AllocationReport, AllocatorError> {
        let cycle_time = Utc::now();

        // Read all market metrics
        let metrics = self.read_all_market_metrics().await?;
        let markets_analyzed = metrics.len();

        if metrics.is_empty() {
            return Ok(AllocationReport {
                cycle_time,
                markets_analyzed: 0,
                decisions: vec![],
                tx_hash: None,
                success: true,
                error: Some("No markets to analyze".to_string()),
            });
        }

        // Read vault total assets
        let vault_total = self.read_vault_total_assets().await?;

        info!(
            vault_total = %vault_total,
            markets = markets_analyzed,
            "Starting allocation cycle"
        );

        // Compute decisions
        let decisions =
            Self::compute_allocation_decisions(&metrics, vault_total, &self.risk_tier_configs);

        // Log all decisions (including NoChange for auditability)
        for d in &decisions {
            if d.action != AllocationAction::NoChange {
                info!(
                    market_id = %hex::encode(d.market_id),
                    action = ?d.action,
                    amount = %d.amount,
                    reason = %d.reason,
                    "Allocation decision"
                );
            } else {
                debug!(
                    market_id = %hex::encode(d.market_id),
                    reason = %d.reason,
                    "Market in target range, no action needed"
                );
            }
        }

        // Filter actionable decisions
        let actionable: Vec<_> = decisions
            .iter()
            .filter(|d| d.action != AllocationAction::NoChange && d.amount > U256::zero())
            .cloned()
            .collect();

        if actionable.is_empty() {
            return Ok(AllocationReport {
                cycle_time,
                markets_analyzed,
                decisions,
                tx_hash: None,
                success: true,
                error: None,
            });
        }

        // Build and execute reallocation
        let allocations = self.build_reallocation_calldata(&actionable, &metrics)?;

        match self.execute_reallocate_with_retry(allocations).await {
            Ok(tx_hash) => Ok(AllocationReport {
                cycle_time,
                markets_analyzed,
                decisions,
                tx_hash: Some(tx_hash),
                success: true,
                error: None,
            }),
            Err(e) => Ok(AllocationReport {
                cycle_time,
                markets_analyzed,
                decisions,
                tx_hash: None,
                success: false,
                error: Some(e.to_string()),
            }),
        }
    }

    /// Run an eth_call with up to 3 attempts, with exponential backoff.
    /// RPC proxies occasionally return empty bytes mid-reconnect — retrying
    /// papers over that without hiding genuine failures.
    async fn call_with_retry(
        &self,
        tx: &TransactionRequest,
        label: &str,
    ) -> Result<Bytes, AllocatorError> {
        let typed: ethers::types::transaction::eip2718::TypedTransaction = tx.clone().into();
        let mut last_err: Option<AllocatorError> = None;

        for attempt in 0u32..3 {
            if attempt > 0 {
                let delay_ms = 500u64 * (1u64 << (attempt - 1));
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }

            let outcome =
                tokio::time::timeout(self.rpc_timeout, self.provider.call(&typed, None)).await;

            match outcome {
                Err(_) => {
                    last_err = Some(AllocatorError::Timeout(format!("{} call", label)));
                }
                Ok(Err(e)) => {
                    last_err = Some(AllocatorError::ReadError(format!(
                        "{} call failed: {}",
                        label, e
                    )));
                }
                Ok(Ok(bytes)) if bytes.is_empty() => {
                    // Empty bytes = proxy flake or address with no code.
                    // Worth one retry — if it's truly codeless, we'll loop
                    // to exhaustion and surface the distinction to the caller.
                    last_err = Some(AllocatorError::ReadError(format!(
                        "{}: empty response (rpc flake or no code at address)",
                        label
                    )));
                }
                Ok(Ok(bytes)) if bytes.len() < 32 => {
                    // Truncated is different from empty — don't retry, it's malformed.
                    return Err(AllocatorError::ReadError(format!(
                        "{}: truncated response ({} bytes, expected >= 32)",
                        label,
                        bytes.len()
                    )));
                }
                Ok(Ok(bytes)) => return Ok(bytes),
            }
        }

        Err(last_err.unwrap_or_else(|| {
            AllocatorError::ReadError(format!("{}: unknown failure after retries", label))
        }))
    }

    /// Detect new markets by reading vault.supplyQueueLength()
    pub async fn detect_new_markets(&mut self) -> Result<usize, AllocatorError> {
        let tx = TransactionRequest::new()
            .to(self.vault_address)
            .data(SELECTOR_SUPPLY_QUEUE_LENGTH.to_vec());

        let result = self.call_with_retry(&tx, "supplyQueueLength()").await?;

        let length = U256::from_big_endian(&result[0..32]).as_usize();

        // Read each market ID from supply queue
        let mut new_count = 0;
        for i in 0..length {
            let encoded_index = ethers::abi::encode(&[ethers::abi::Token::Uint(U256::from(i))]);

            let mut calldata = SELECTOR_SUPPLY_QUEUE.to_vec();
            calldata.extend_from_slice(&encoded_index);

            let sq_tx = TransactionRequest::new()
                .to(self.vault_address)
                .data(calldata);

            let sq_result = self.call_with_retry(&sq_tx, "supplyQueue(uint256)").await?;

            let mut market_id = [0u8; 32];
            market_id.copy_from_slice(&sq_result[0..32]);

            if !self.market_ids.contains(&market_id) {
                info!(
                    market_id = %hex::encode(market_id),
                    "Detected new market in supply queue"
                );
                self.add_market(market_id, None);
                new_count += 1;
            }
        }

        Ok(new_count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_market_metrics(
        id: u8,
        total_supply: u64,
        total_borrow: u64,
        vault_supply: u64,
    ) -> MarketMetrics {
        let mut market_id = [0u8; 32];
        market_id[0] = id;

        let ts = U256::from(total_supply);
        let tb = U256::from(total_borrow);

        let utilization_pct = if total_supply == 0 {
            0
        } else {
            ((total_borrow as u128 * 100) / total_supply as u128) as u8
        };

        MarketMetrics {
            market_id,
            total_supply: ts,
            total_borrow: tb,
            total_supply_shares: ts,
            utilization_pct,
            vault_supply: U256::from(vault_supply),
            market_params: MarketParamsData {
                loan_token: Address::zero(),
                collateral_token: Address::zero(),
                oracle: Address::zero(),
                irm: Address::zero(),
                lltv: U256::zero(),
            },
        }
    }

    #[test]
    fn test_compute_utilization() {
        // supply=1000, borrow=800 → utilization=80%
        let m = make_market_metrics(1, 1000, 800, 100);
        assert_eq!(m.utilization_pct, 80);
        assert!(m.is_in_target_range());
    }

    #[test]
    fn test_identify_high_utilization_market() {
        // 90% utilization should be flagged for supply
        let m = make_market_metrics(1, 1000, 900, 100);
        assert_eq!(m.utilization_pct, 90);
        assert!(m.is_high_utilization());
        assert!(m.is_critical_high());
    }

    #[test]
    fn test_identify_low_utilization_market() {
        // 50% utilization should be flagged for withdrawal
        let m = make_market_metrics(1, 1000, 500, 100);
        assert_eq!(m.utilization_pct, 50);
        assert!(m.is_low_utilization());
        assert!(m.is_critical_low());
    }

    #[test]
    fn test_respect_tier_cap_tier_a() {
        // TierA market capped at 30% of vault total
        let metrics = vec![make_market_metrics(1, 1000, 900, 250)];
        let vault_total = U256::from(1000);

        let mut tier_configs = HashMap::new();
        tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::A));

        let decisions =
            AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

        assert_eq!(decisions.len(), 1);
        assert_eq!(decisions[0].action, AllocationAction::Supply);
        // Max allowed = 30% of 1000 = 300, current = 250, headroom = 50
        assert_eq!(decisions[0].amount, U256::from(50));
    }

    #[test]
    fn test_respect_tier_cap_tier_d() {
        // TierD market capped at 5% of vault total
        let metrics = vec![make_market_metrics(1, 1000, 900, 40)];
        let vault_total = U256::from(1000);

        let mut tier_configs = HashMap::new();
        tier_configs.insert(metrics[0].market_id, RiskTierConfig::new(RiskTier::D));

        let decisions =
            AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

        assert_eq!(decisions.len(), 1);
        assert_eq!(decisions[0].action, AllocationAction::Supply);
        // Max allowed = 5% of 1000 = 50, current = 40, headroom = 10
        assert_eq!(decisions[0].amount, U256::from(10));
    }

    #[test]
    fn test_prioritize_critical_high_utilization() {
        // 95% utilization market should be prioritized over 86% market
        let metrics = vec![
            make_market_metrics(1, 1000, 860, 100), // 86%
            make_market_metrics(2, 1000, 950, 100), // 95%
        ];
        let vault_total = U256::from(10000);
        let tier_configs = HashMap::new();

        let decisions =
            AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

        assert_eq!(decisions.len(), 2);
        // 95% market should be first (higher priority)
        assert_eq!(decisions[0].market_id[0], 2);
        assert_eq!(decisions[0].priority, 100);
        assert_eq!(decisions[1].market_id[0], 1);
        assert_eq!(decisions[1].priority, 80);
    }

    #[test]
    fn test_no_action_within_target_range() {
        // 75% utilization market should get NoChange
        let metrics = vec![make_market_metrics(1, 1000, 750, 100)];
        let vault_total = U256::from(1000);
        let tier_configs = HashMap::new();

        let decisions =
            AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

        assert_eq!(decisions.len(), 1);
        assert_eq!(decisions[0].action, AllocationAction::NoChange);
        assert_eq!(decisions[0].amount, U256::zero());
    }

    #[test]
    fn test_market_metrics_is_in_target_range() {
        let m_low = make_market_metrics(1, 1000, 690, 100); // 69%
        let m_min = make_market_metrics(2, 1000, 700, 100); // 70%
        let m_mid = make_market_metrics(3, 1000, 770, 100); // 77%
        let m_max = make_market_metrics(4, 1000, 850, 100); // 85%
        let m_high = make_market_metrics(5, 1000, 860, 100); // 86%

        assert!(!m_low.is_in_target_range());
        assert!(m_min.is_in_target_range());
        assert!(m_mid.is_in_target_range());
        assert!(m_max.is_in_target_range());
        assert!(!m_high.is_in_target_range());
    }

    #[test]
    fn test_zero_supply_utilization() {
        let m = make_market_metrics(1, 0, 0, 0);
        assert_eq!(m.utilization_pct, 0);
    }

    #[test]
    fn test_default_tier_is_d() {
        let metrics = vec![make_market_metrics(1, 1000, 900, 100)];
        let vault_total = U256::from(10000);
        let tier_configs = HashMap::new(); // Empty = default to Tier D

        let decisions =
            AllocationBot::compute_allocation_decisions(&metrics, vault_total, &tier_configs);

        // Tier D cap is 5% of 10000 = 500, current = 100, headroom = 400
        assert_eq!(decisions[0].action, AllocationAction::Supply);
        assert_eq!(decisions[0].amount, U256::from(400));
    }
}
