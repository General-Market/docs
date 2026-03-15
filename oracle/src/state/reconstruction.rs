//! State reconstruction for Index L3 Oracle
//!
//! Implements stateless oracle node pattern (NFR19) by reconstructing all state
//! from on-chain data on startup.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use ethers::prelude::*;
use tracing::{debug, info, warn};

use common::error::Error;
use common::types::{LimitOrder, OrderStatus};

use super::types::{chains, Checkpoint, ITPState, OracleState};

/// Configuration for state reconstruction
#[derive(Debug, Clone)]
pub struct ReconstructorConfig {
    /// RPC endpoint URL
    pub rpc_url: String,
    /// Chain ID (111222333 for Index L3)
    pub chain_id: u64,
    /// Contract addresses
    pub index_contract: Address,
    pub collateral_registry: Option<Address>,
    /// Custody contract addresses per chain (chain_id => custody_address)
    pub custody_contracts: HashMap<u64, Address>,
    /// USDC token address (for querying custody balances)
    pub usdc_address: Option<Address>,
    /// Checkpoint interval (save every N blocks)
    pub checkpoint_interval: u64,
    /// Path for checkpoint file
    pub checkpoint_path: Option<String>,
    /// Starting block (if not using checkpoint)
    pub from_block: Option<u64>,
}

impl Default for ReconstructorConfig {
    fn default() -> Self {
        Self {
            rpc_url: "http://localhost:8545".to_string(),
            chain_id: chains::INDEX_L3 as u64,
            index_contract: Address::zero(),
            collateral_registry: None,
            custody_contracts: HashMap::new(),
            usdc_address: None,
            checkpoint_interval: 100,
            checkpoint_path: Some("./checkpoint.json".to_string()),
            from_block: None,
        }
    }
}

// Generate contract bindings for Investment.sol (state reconstruction)
abigen!(
    IndexReconstructContract,
    r#"[
        function lastProcessedCycleNumber() external view returns (uint256)
        function nextOrderId() external view returns (uint256)
        function getOrder(uint256 orderId) external view returns (uint256 id, address user, bytes32 pairId, uint8 side, uint256 amount, uint256 limitPrice, uint256 slippageTier, uint256 deadline, bytes32 itpId, uint256 timestamp, uint8 status)
        function getItpCount() external view returns (uint256)
        function getITPState(bytes32 itpId) external view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
    ]"#
);

// Generate contract bindings for CollateralRegistry.sol
abigen!(
    CollateralRegistryContract,
    r#"[
        function itpCollateralByChain(bytes32 itpId, uint256 chainId) external view returns (uint256)
    ]"#
);

// Generate contract bindings for ERC20 (USDC balance queries)
abigen!(
    Erc20Contract,
    r#"[
        function balanceOf(address account) external view returns (uint256)
    ]"#
);

/// Statistics from reconstruction process
#[derive(Debug, Clone, Default)]
pub struct ReconstructionStats {
    /// Total time taken
    pub duration_ms: u64,
    /// Number of orders read
    pub orders_read: u64,
    /// Number of pending orders
    pub pending_orders: u64,
    /// Number of batched orders (pending fills)
    pub batched_orders: u64,
    /// Number of ITPs loaded
    pub itps_loaded: u64,
    /// Current cycle number
    pub current_cycle: U256,
}

/// State reconstructor for oracle node
///
/// Reconstructs oracle state from on-chain data using contract reads.
/// Follows the algorithm in architecture Appendix D.
pub struct StateReconstructor<M: Middleware> {
    provider: Arc<M>,
    config: ReconstructorConfig,
}

impl StateReconstructor<Provider<Http>> {
    /// Create a new StateReconstructor with HTTP provider
    pub fn new(config: ReconstructorConfig) -> Result<Self, Error> {
        let provider = Provider::<Http>::try_from(&config.rpc_url)
            .map_err(|e| Error::ChainRead(format!("Failed to create provider: {}", e)))?;

        Ok(Self {
            provider: Arc::new(provider),
            config,
        })
    }
}

impl<M: Middleware> StateReconstructor<M>
where
    M: 'static,
{
    /// Create a new StateReconstructor with custom provider
    pub fn with_provider(provider: Arc<M>, config: ReconstructorConfig) -> Self {
        Self { provider, config }
    }

    /// Get the Index contract instance
    fn index_contract(&self) -> IndexReconstructContract<M> {
        IndexReconstructContract::new(self.config.index_contract, self.provider.clone())
    }

    /// Get the CollateralRegistry contract instance (if configured)
    fn collateral_registry(&self) -> Option<CollateralRegistryContract<M>> {
        self.config
            .collateral_registry
            .map(|addr| CollateralRegistryContract::new(addr, self.provider.clone()))
    }

    /// Reconstruct state from chain data
    ///
    /// This is the main entry point for state reconstruction.
    /// Returns the reconstructed OracleState and statistics.
    pub async fn reconstruct_state(&self) -> Result<(OracleState, ReconstructionStats), Error> {
        let start = Instant::now();
        let mut stats = ReconstructionStats::default();

        info!(
            contract = ?self.config.index_contract,
            "Starting state reconstruction from Index contract"
        );

        let mut state = OracleState::new();
        let contract = self.index_contract();

        // Step 1: Read cycle and order metadata
        info!("Step 1: Reading cycle and order metadata...");
        let current_cycle = contract
            .last_processed_cycle_number()
            .call()
            .await
            .map_err(|e| Error::ChainRead(format!("Failed to read lastProcessedCycleNumber: {}", e)))?;

        let next_order_id = contract
            .next_order_id()
            .call()
            .await
            .map_err(|e| Error::ChainRead(format!("Failed to read nextOrderId: {}", e)))?;

        state.current_cycle = current_cycle;
        state.next_order_id = next_order_id;
        state.last_processed_order_id = U256::zero();
        stats.current_cycle = current_cycle;

        debug!(
            current_cycle = %current_cycle,
            next_order_id = %next_order_id,
            "Cycle metadata loaded"
        );

        // Step 2: Prices — on-chain assetPrices mapping is unused; prices come from
        // the data-node / Bitget feed at runtime. Nothing to load here.
        debug!("Step 2: Skipping on-chain prices (sourced from data-node)");

        // Step 3: Read all orders (IDs start at 1)
        info!("Step 3: Reading orders...");
        for i in 1..next_order_id.as_u64() {
            stats.orders_read += 1;

            match contract.get_order(U256::from(i)).call().await {
                Ok((
                    id,
                    user,
                    pair_id,
                    side,
                    amount,
                    limit_price,
                    slippage_tier,
                    deadline,
                    itp_id,
                    timestamp,
                    status,
                )) => {
                    let order_status = match status {
                        0 => OrderStatus::Pending,
                        1 => OrderStatus::Batched,
                        2 => OrderStatus::Filled,
                        3 => OrderStatus::Cancelled,
                        4 => OrderStatus::Expired,
                        _ => OrderStatus::Pending,
                    };

                    let order = LimitOrder {
                        id,
                        user,
                        pair_id: pair_id.into(),
                        side: side.into(),
                        amount,
                        limit_price,
                        slippage_tier,
                        deadline,
                        itp_id: itp_id.into(),
                        timestamp,
                        status: order_status,
                    };

                    match order_status {
                        OrderStatus::Pending => {
                            state.pending_orders.push(order);
                            stats.pending_orders += 1;
                        }
                        OrderStatus::Batched => {
                            state.pending_fills.push(order);
                            stats.batched_orders += 1;
                        }
                        _ => {
                            // Skip filled/cancelled/expired orders
                        }
                    }

                    if stats.orders_read % 1000 == 0 {
                        debug!(orders_read = stats.orders_read, "Reading orders progress...");
                    }
                }
                Err(e) => {
                    warn!(code = "INFRA-001", order_id = i, error = %e, "Failed to read order, skipping");
                }
            }
        }

        debug!(
            pending = stats.pending_orders,
            batched = stats.batched_orders,
            "Orders loaded"
        );

        // Step 4: Read all ITPs (IDs start at 1)
        info!("Step 4: Reading ITP states...");
        let itp_count = contract
            .get_itp_count()
            .call()
            .await
            .map_err(|e| Error::ChainRead(format!("Failed to read getItpCount: {}", e)))?;

        for i in 1..=itp_count.as_u64() {
            // Convert index to bytes32 ITP ID
            let mut itp_id_bytes = [0u8; 32];
            itp_id_bytes[24..32].copy_from_slice(&i.to_be_bytes());
            let itp_id = H256::from(itp_id_bytes);

            match self.reconstruct_itp(&contract, itp_id).await {
                Ok(itp_state) => {
                    state.itps.insert(itp_id, itp_state);
                    stats.itps_loaded += 1;
                }
                Err(e) => {
                    warn!(code = "INFRA-001", itp_id = ?itp_id, error = %e, "Failed to read ITP, skipping");
                }
            }
        }

        debug!(itps_loaded = stats.itps_loaded, "ITPs loaded");

        // Step 5: Read collateral (if registry is configured)
        if let Some(registry) = self.collateral_registry() {
            info!("Step 5: Reading collateral positions...");
            for (&itp_id, itp_state) in &mut state.itps {
                for &chain_id in chains::ALL_CHAINS {
                    match registry
                        .itp_collateral_by_chain(itp_id.into(), U256::from(chain_id))
                        .call()
                        .await
                    {
                        Ok(amount) => {
                            if !amount.is_zero() {
                                let chain_u256 = U256::from(chain_id);
                                itp_state.collateral_by_chain.insert(chain_u256, amount);
                                state
                                    .collateral_by_chain
                                    .insert((itp_id, chain_u256), amount);
                            }
                        }
                        Err(e) => {
                            debug!(
                                itp_id = ?itp_id,
                                chain_id,
                                error = %e,
                                "Failed to read collateral, skipping"
                            );
                        }
                    }
                }
            }
        }

        // Step 6: Read chain inventories (USDC balances on custody contracts)
        if let Some(usdc_addr) = self.config.usdc_address {
            if !self.config.custody_contracts.is_empty() {
                info!("Step 6: Reading chain inventories...");
                let usdc = Erc20Contract::new(usdc_addr, self.provider.clone());

                for (&chain_id, &custody_addr) in &self.config.custody_contracts {
                    match usdc.balance_of(custody_addr).call().await {
                        Ok(balance) => {
                            if !balance.is_zero() {
                                state.chain_inventories.insert(U256::from(chain_id), balance);
                                debug!(
                                    chain_id,
                                    custody = ?custody_addr,
                                    balance = %balance,
                                    "Custody USDC balance loaded"
                                );
                            }
                        }
                        Err(e) => {
                            debug!(
                                chain_id,
                                custody = ?custody_addr,
                                error = %e,
                                "Failed to read custody balance, skipping"
                            );
                        }
                    }
                }
            }
        }

        // Get current block number for tracking
        let block_number = self
            .provider
            .get_block_number()
            .await
            .map_err(|e| Error::ChainRead(format!("Failed to get block number: {}", e)))?;
        state.reconstructed_at_block = block_number.as_u64();

        stats.duration_ms = start.elapsed().as_millis() as u64;

        info!(
            duration_ms = stats.duration_ms,
            orders_read = stats.orders_read,
            pending_orders = stats.pending_orders,
            batched_orders = stats.batched_orders,
            itps_loaded = stats.itps_loaded,
            current_cycle = %stats.current_cycle,
            block = state.reconstructed_at_block,
            "State reconstruction complete"
        );

        Ok((state, stats))
    }

    /// Reconstruct a single ITP's state
    async fn reconstruct_itp(
        &self,
        contract: &IndexReconstructContract<M>,
        itp_id: H256,
    ) -> Result<ITPState, Error> {
        // getITPState returns (creator, totalSupply, nav, assets, weights, inventory)
        let (_creator, total_supply, nav, _assets, weights, inventory) = contract
            .get_itp_state(itp_id.into())
            .call()
            .await
            .map_err(|e| Error::ChainRead(format!("Failed to read ITP state: {}", e)))?;

        // total_value = nav * totalSupply / 1e18
        let total_value = if !total_supply.is_zero() && !nav.is_zero() {
            nav.saturating_mul(total_supply) / U256::exp10(18)
        } else {
            U256::zero()
        };

        let itp_state = ITPState {
            asset_indices: vec![], // No longer tracked by index; assets are addresses
            current_weights: weights,
            current_inventory: inventory,
            target_weights: None, // getPendingRebalance removed; rebalance tracked via events
            rebalance_progress: 1.0,
            collateral_by_chain: HashMap::new(),
            rebalance_started_at: None,
            total_value,
        };

        Ok(itp_state)
    }

    /// Compute rebalance progress per architecture algorithm
    ///
    /// Progress is calculated as weighted average of individual asset progress,
    /// where weight is proportional to the magnitude of change.
    /// Weights use 18 decimals (1e18 = 100%) per architecture spec.
    fn compute_rebalance_progress(
        &self,
        inventory: &[U256],
        current_weights: &[U256],
        target_weights: &[U256],
        total_value: U256,
    ) -> f64 {
        if total_value.is_zero() || current_weights.is_empty() {
            return 1.0;
        }

        // Weight divisor: 1e18 (18 decimals, per architecture spec)
        const WEIGHT_PRECISION: f64 = 1e18;

        let mut total_progress = 0.0;
        let mut total_change = 0.0;

        for i in 0..current_weights.len().min(target_weights.len()) {
            let current_w = current_weights[i].as_u128() as f64 / WEIGHT_PRECISION;
            let target_w = target_weights[i].as_u128() as f64 / WEIGHT_PRECISION;

            // Calculate actual allocation from inventory
            let actual_alloc = if let Some(&inv) = inventory.get(i) {
                if total_value.is_zero() {
                    0.0
                } else {
                    // actual_alloc = inventory[i] / total_value
                    let inv_f = inv.as_u128() as f64;
                    let total_f = total_value.as_u128() as f64;
                    inv_f / total_f
                }
            } else {
                0.0
            };

            let change_magnitude = (target_w - current_w).abs();
            if change_magnitude < 0.0001 {
                continue; // No significant change for this asset
            }

            // Calculate progress for this asset
            let progress = if target_w > current_w {
                // Increasing allocation
                ((actual_alloc - current_w) / (target_w - current_w)).clamp(0.0, 1.0)
            } else {
                // Decreasing allocation
                ((current_w - actual_alloc) / (current_w - target_w)).clamp(0.0, 1.0)
            };

            total_progress += progress * change_magnitude;
            total_change += change_magnitude;
        }

        if total_change < 0.0001 {
            1.0 // No changes needed, fully complete
        } else {
            (total_progress / total_change).clamp(0.0, 1.0)
        }
    }
}

/// Checkpoint persistence functions
impl<M: Middleware> StateReconstructor<M>
where
    M: 'static,
{
    /// Save a checkpoint to disk
    pub fn save_checkpoint(path: &str, checkpoint: &Checkpoint) -> Result<(), Error> {
        let json = serde_json::to_string_pretty(checkpoint)
            .map_err(|e| Error::Serialization(format!("Failed to serialize checkpoint: {}", e)))?;

        // Write atomically (write to temp, then rename)
        let temp_path = format!("{}.tmp", path);
        std::fs::write(&temp_path, &json).map_err(|e| {
            Error::Serialization(format!("Failed to write checkpoint temp file: {}", e))
        })?;

        std::fs::rename(&temp_path, path).map_err(|e| {
            Error::Serialization(format!("Failed to rename checkpoint file: {}", e))
        })?;

        debug!(path, block = checkpoint.block_number, "Checkpoint saved");
        Ok(())
    }

    /// Load a checkpoint from disk
    pub fn load_checkpoint(path: &str) -> Result<Option<Checkpoint>, Error> {
        if !Path::new(path).exists() {
            return Ok(None);
        }

        let json = std::fs::read_to_string(path)
            .map_err(|e| Error::Serialization(format!("Failed to read checkpoint file: {}", e)))?;

        let checkpoint: Checkpoint = serde_json::from_str(&json)
            .map_err(|e| Error::Serialization(format!("Failed to deserialize checkpoint: {}", e)))?;

        if !checkpoint.is_compatible() {
            warn!(
                code = "INFRA-001",
                version = checkpoint.version,
                expected = Checkpoint::CURRENT_VERSION,
                "Checkpoint version mismatch, ignoring"
            );
            return Ok(None);
        }

        debug!(
            path,
            block = checkpoint.block_number,
            "Checkpoint loaded"
        );
        Ok(Some(checkpoint))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reconstructor_config_default() {
        let config = ReconstructorConfig::default();
        assert_eq!(config.chain_id, chains::INDEX_L3 as u64);
        assert_eq!(config.checkpoint_interval, 100);
        assert!(config.checkpoint_path.is_some());
    }

    #[test]
    fn test_rebalance_progress_no_change() {
        let config = ReconstructorConfig::default();
        let provider = Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap());
        let reconstructor = StateReconstructor::with_provider(provider, config);

        // Same weights = 100% progress
        // Using 18 decimals: 0.5e18 = 50%, sum = 1e18
        let e18 = U256::exp10(18);
        let half_e18 = e18 / 2; // 0.5e18 = 50%
        let inventory = vec![half_e18, half_e18]; // 50/50 inventory
        let current = vec![half_e18, half_e18]; // Started at 50/50
        let target = vec![half_e18, half_e18]; // Target 50/50 (no change)
        let total = e18; // Total value = 1e18

        let progress = reconstructor.compute_rebalance_progress(&inventory, &current, &target, total);
        assert!((progress - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_rebalance_progress_halfway() {
        let config = ReconstructorConfig::default();
        let provider = Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap());
        let reconstructor = StateReconstructor::with_provider(provider, config);

        // Moving from 50/50 to 70/30, currently at 60/40 = 50% progress
        // Using 18 decimals: weights are fractions of 1e18
        let e18 = U256::exp10(18);
        let w50 = e18 / 2; // 0.5e18 = 50%
        let w70 = e18 * 7 / 10; // 0.7e18 = 70%
        let w30 = e18 * 3 / 10; // 0.3e18 = 30%

        // Inventory: 60/40 split with total value of 1e18
        let inv60 = e18 * 6 / 10; // 0.6e18 (60% of total)
        let inv40 = e18 * 4 / 10; // 0.4e18 (40% of total)

        let inventory = vec![inv60, inv40]; // 60/40 actual allocation
        let current = vec![w50, w50]; // Started at 50/50 weights
        let target = vec![w70, w30]; // Target 70/30 weights
        let total = e18; // Total value = 1e18

        let progress = reconstructor.compute_rebalance_progress(&inventory, &current, &target, total);
        // Should be approximately 0.5 (50% progress)
        assert!(progress > 0.4 && progress < 0.6, "Expected ~0.5, got {}", progress);
    }

    #[test]
    fn test_checkpoint_save_load_roundtrip() {
        let state = OracleState::default();
        let checkpoint = Checkpoint::new(state, 100, [1u8; 32]);

        let temp_dir = std::env::temp_dir();
        let path = temp_dir.join("test_checkpoint.json");
        let path_str = path.to_string_lossy().to_string();

        // Save
        StateReconstructor::<Provider<Http>>::save_checkpoint(&path_str, &checkpoint).unwrap();

        // Load
        let loaded = StateReconstructor::<Provider<Http>>::load_checkpoint(&path_str)
            .unwrap()
            .unwrap();

        assert_eq!(loaded.block_number, 100);
        assert_eq!(loaded.block_hash, [1u8; 32]);
        assert!(loaded.is_compatible());

        // Cleanup
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn test_reconstruction_stats_default() {
        let stats = ReconstructionStats::default();
        assert_eq!(stats.duration_ms, 0);
        assert_eq!(stats.orders_read, 0);
        assert_eq!(stats.itps_loaded, 0);
    }

    #[test]
    fn test_rebalance_progress_complete() {
        let config = ReconstructorConfig::default();
        let provider = Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap());
        let reconstructor = StateReconstructor::with_provider(provider, config);

        let e18 = U256::exp10(18);
        let w70 = e18 * 7 / 10; // 70%
        let w30 = e18 * 3 / 10; // 30%

        // Inventory matches target weights exactly
        let inventory = vec![w70, w30];
        let current = vec![e18 / 2, e18 / 2]; // Started 50/50
        let target = vec![w70, w30]; // Target 70/30
        let total = e18;

        let progress = reconstructor.compute_rebalance_progress(&inventory, &current, &target, total);
        // Should be approximately 1.0 (complete)
        assert!(progress > 0.95, "Expected ~1.0, got {}", progress);
    }

    #[test]
    fn test_rebalance_progress_not_started() {
        let config = ReconstructorConfig::default();
        let provider = Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap());
        let reconstructor = StateReconstructor::with_provider(provider, config);

        let e18 = U256::exp10(18);
        let w50 = e18 / 2; // 50%
        let w70 = e18 * 7 / 10; // 70%
        let w30 = e18 * 3 / 10; // 30%

        // Inventory still matches starting weights
        let inventory = vec![w50, w50]; // Still at 50/50
        let current = vec![w50, w50]; // Started 50/50
        let target = vec![w70, w30]; // Target 70/30
        let total = e18;

        let progress = reconstructor.compute_rebalance_progress(&inventory, &current, &target, total);
        // Should be approximately 0.0 (not started)
        assert!(progress < 0.05, "Expected ~0.0, got {}", progress);
    }

    #[test]
    fn test_rebalance_progress_empty_weights() {
        let config = ReconstructorConfig::default();
        let provider = Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap());
        let reconstructor = StateReconstructor::with_provider(provider, config);

        // Empty weights should return 1.0 (complete)
        let progress = reconstructor.compute_rebalance_progress(&[], &[], &[], U256::from(1000));
        assert!((progress - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_rebalance_progress_zero_total() {
        let config = ReconstructorConfig::default();
        let provider = Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap());
        let reconstructor = StateReconstructor::with_provider(provider, config);

        let e18 = U256::exp10(18);

        // Zero total value should return 1.0 (complete)
        let inventory = vec![e18 / 2, e18 / 2];
        let current = vec![e18 / 2, e18 / 2];
        let target = vec![e18 * 7 / 10, e18 * 3 / 10];

        let progress = reconstructor.compute_rebalance_progress(&inventory, &current, &target, U256::zero());
        assert!((progress - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_config_with_usdc_address() {
        let mut config = ReconstructorConfig::default();
        config.usdc_address = Some(Address::random());
        config.custody_contracts.insert(chains::SETTLEMENT, Address::random());
        config.custody_contracts.insert(chains::INDEX_L3, Address::random());

        assert!(config.usdc_address.is_some());
        assert_eq!(config.custody_contracts.len(), 2);
    }
}
