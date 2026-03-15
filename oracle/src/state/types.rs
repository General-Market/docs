//! State types for Index L3 Issuer
//!
//! Defines IssuerState, ITPState, and Checkpoint types per architecture Appendix D.
//! These types represent the reconstructed state of the issuer node.

use std::collections::HashMap;

use ethers::types::{H256, U256};
use serde::{Deserialize, Serialize};

use common::types::LimitOrder;

/// Issuer state reconstructed from chain data
///
/// Per architecture Appendix D, this represents the complete state
/// an issuer node needs to operate after restart.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IssuerState {
    /// Pending orders awaiting processing
    pub pending_orders: Vec<LimitOrder>,

    /// ITP states indexed by ITP ID
    pub itps: HashMap<H256, ITPState>,

    /// Current cycle number from Index.sol
    pub current_cycle: U256,

    /// Asset prices indexed by asset index
    /// asset_index => price (18 decimals)
    pub prices: HashMap<U256, U256>,

    /// Chain inventories (USDC balance per chain)
    /// chain_id => USDC amount (18 decimals)
    pub chain_inventories: HashMap<U256, U256>,

    /// Collateral per ITP per chain
    /// (itp_id, chain_id) => collateral amount (18 decimals)
    pub collateral_by_chain: HashMap<(H256, U256), U256>,

    /// Orders with status BATCHED awaiting fill confirmation
    pub pending_fills: Vec<LimitOrder>,

    /// Next order ID from Index.sol
    pub next_order_id: U256,

    /// Last processed order ID from Index.sol
    pub last_processed_order_id: U256,

    /// Block number at which state was reconstructed
    pub reconstructed_at_block: u64,

    /// Number of cycles to observe before participating (per architecture)
    /// Set to 1 after state reconstruction; decremented each cycle until 0
    pub observation_cycles_remaining: u64,
}

impl IssuerState {
    /// Create a new empty IssuerState
    pub fn new() -> Self {
        Self::default()
    }

    /// Get the number of pending orders
    pub fn pending_order_count(&self) -> usize {
        self.pending_orders.len()
    }

    /// Get the number of ITPs
    pub fn itp_count(&self) -> usize {
        self.itps.len()
    }

    /// Check if there are any pending fills
    pub fn has_pending_fills(&self) -> bool {
        !self.pending_fills.is_empty()
    }

    /// Get ITP state by ID
    pub fn get_itp(&self, itp_id: &H256) -> Option<&ITPState> {
        self.itps.get(itp_id)
    }

    /// Get price for an asset index
    pub fn get_price(&self, asset_idx: &U256) -> Option<&U256> {
        self.prices.get(asset_idx)
    }

    /// Get collateral for an ITP on a specific chain
    pub fn get_collateral(&self, itp_id: &H256, chain_id: &U256) -> Option<&U256> {
        self.collateral_by_chain.get(&(*itp_id, *chain_id))
    }

    /// Check if observation period is complete (ready to participate)
    pub fn can_participate(&self) -> bool {
        self.observation_cycles_remaining == 0
    }

    /// Decrement observation cycles remaining (call once per cycle)
    pub fn observe_cycle(&mut self) {
        if self.observation_cycles_remaining > 0 {
            self.observation_cycles_remaining -= 1;
        }
    }

    /// Set observation cycles remaining (typically 1 after reconstruction)
    pub fn set_observation_period(&mut self, cycles: u64) {
        self.observation_cycles_remaining = cycles;
    }
}

/// State of a single ITP (Index Token Product)
///
/// Per architecture Appendix D, tracks portfolio composition and rebalance progress.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ITPState {
    /// Current asset weights (18 decimals, sum = 1e18)
    pub current_weights: Vec<U256>,

    /// Current inventory per asset (18 decimals)
    pub current_inventory: Vec<U256>,

    /// Asset indices in this ITP
    pub asset_indices: Vec<U256>,

    /// Target weights if rebalance is active (18 decimals, sum = 1e18)
    pub target_weights: Option<Vec<U256>>,

    /// Rebalance progress (0.0 = not started, 1.0 = complete)
    /// Computed from current vs target allocations per architecture algorithm
    pub rebalance_progress: f64,

    /// Collateral held per chain for this ITP
    /// chain_id => amount (18 decimals)
    pub collateral_by_chain: HashMap<U256, U256>,

    /// Timestamp when rebalance was initiated (if active)
    pub rebalance_started_at: Option<U256>,

    /// Total value in USDC (18 decimals)
    pub total_value: U256,
}

impl ITPState {
    /// Create a new empty ITPState
    pub fn new() -> Self {
        Self {
            rebalance_progress: 1.0, // Default to complete (no active rebalance)
            ..Default::default()
        }
    }

    /// Check if a rebalance is currently active
    pub fn has_active_rebalance(&self) -> bool {
        self.target_weights.is_some()
    }

    /// Get the number of assets in this ITP
    pub fn asset_count(&self) -> usize {
        self.asset_indices.len()
    }

    /// Calculate total value from inventory and prices
    pub fn calculate_total_value(&self, prices: &HashMap<U256, U256>) -> U256 {
        let mut total = U256::zero();
        for (i, &asset_idx) in self.asset_indices.iter().enumerate() {
            if let Some(&price) = prices.get(&asset_idx) {
                if let Some(&amount) = self.current_inventory.get(i) {
                    // value = amount * price / 1e18
                    let value = amount.saturating_mul(price) / U256::exp10(18);
                    total = total.saturating_add(value);
                }
            }
        }
        total
    }
}

/// Checkpoint for faster restart
///
/// Saves state at a specific block so reconstruction can resume from here
/// instead of block 0.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    /// The reconstructed state
    pub state: IssuerState,

    /// Block number where this checkpoint was taken
    pub block_number: u64,

    /// Block hash for validation
    pub block_hash: [u8; 32],

    /// Unix timestamp when checkpoint was created
    pub timestamp: u64,

    /// Version of checkpoint format (for future compatibility)
    pub version: u32,
}

impl Checkpoint {
    /// Current checkpoint format version
    pub const CURRENT_VERSION: u32 = 1;

    /// Create a new checkpoint
    pub fn new(state: IssuerState, block_number: u64, block_hash: [u8; 32]) -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            state,
            block_number,
            block_hash,
            timestamp,
            version: Self::CURRENT_VERSION,
        }
    }

    /// Check if checkpoint is compatible with current version
    pub fn is_compatible(&self) -> bool {
        self.version == Self::CURRENT_VERSION
    }
}

/// Supported chain IDs for collateral tracking
pub mod chains {
    /// Index L3 Orbit chain ID
    pub const INDEX_L3: u64 = 111222333;
    /// Settlement chain ID (Arbitrum One)
    pub const SETTLEMENT: u64 = 42161;
    /// Ethereum Mainnet chain ID
    pub const ETHEREUM: u64 = 1;
    /// Base chain ID
    pub const BASE: u64 = 8453;
    /// Optimism chain ID
    pub const OPTIMISM: u64 = 10;

    /// All supported chain IDs
    pub const ALL_CHAINS: &[u64] = &[INDEX_L3, SETTLEMENT, ETHEREUM, BASE, OPTIMISM];
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_issuer_state_default() {
        let state = IssuerState::default();
        assert!(state.pending_orders.is_empty());
        assert!(state.itps.is_empty());
        assert_eq!(state.current_cycle, U256::zero());
        assert_eq!(state.pending_order_count(), 0);
        assert_eq!(state.itp_count(), 0);
        assert!(!state.has_pending_fills());
    }

    #[test]
    fn test_itp_state_default() {
        let state = ITPState::new();
        assert!(!state.has_active_rebalance());
        assert_eq!(state.rebalance_progress, 1.0);
        assert_eq!(state.asset_count(), 0);
    }

    #[test]
    fn test_itp_state_with_rebalance() {
        let mut state = ITPState::new();
        // Using 18 decimals: 0.5e18 = 50% weight
        let half_e18 = U256::exp10(18) / 2;
        state.target_weights = Some(vec![half_e18, half_e18]);
        state.rebalance_progress = 0.5;

        assert!(state.has_active_rebalance());
        assert_eq!(state.rebalance_progress, 0.5);
    }

    #[test]
    fn test_checkpoint_creation() {
        let state = IssuerState::default();
        let checkpoint = Checkpoint::new(state, 100, [0u8; 32]);

        assert_eq!(checkpoint.block_number, 100);
        assert!(checkpoint.is_compatible());
        assert_eq!(checkpoint.version, Checkpoint::CURRENT_VERSION);
    }

    #[test]
    fn test_chain_constants() {
        assert_eq!(chains::INDEX_L3, 111222333);
        assert_eq!(chains::SETTLEMENT, 42161);
        assert_eq!(chains::ALL_CHAINS.len(), 5);
    }

    #[test]
    fn test_itp_calculate_total_value() {
        let mut state = ITPState::new();
        state.asset_indices = vec![U256::from(0), U256::from(1)];
        state.current_inventory = vec![
            U256::from(1000) * U256::exp10(18), // 1000 units of asset 0
            U256::from(500) * U256::exp10(18),  // 500 units of asset 1
        ];

        let mut prices = HashMap::new();
        prices.insert(U256::from(0), U256::from(100) * U256::exp10(18)); // $100 per unit
        prices.insert(U256::from(1), U256::from(50) * U256::exp10(18));  // $50 per unit

        let total = state.calculate_total_value(&prices);
        // Expected: 1000 * 100 + 500 * 50 = 125000
        assert_eq!(total, U256::from(125000) * U256::exp10(18));
    }

    #[test]
    fn test_issuer_state_get_collateral() {
        let mut state = IssuerState::default();
        let itp_id = H256::random();
        let chain_id = U256::from(chains::SETTLEMENT);
        let amount = U256::from(1000) * U256::exp10(18);

        state.collateral_by_chain.insert((itp_id, chain_id), amount);

        assert_eq!(state.get_collateral(&itp_id, &chain_id), Some(&amount));
        assert_eq!(
            state.get_collateral(&H256::random(), &chain_id),
            None
        );
    }

    #[test]
    fn test_observation_period() {
        let mut state = IssuerState::default();

        // Initially can participate (0 observation cycles)
        assert!(state.can_participate());
        assert_eq!(state.observation_cycles_remaining, 0);

        // Set observation period
        state.set_observation_period(2);
        assert!(!state.can_participate());
        assert_eq!(state.observation_cycles_remaining, 2);

        // Observe first cycle
        state.observe_cycle();
        assert!(!state.can_participate());
        assert_eq!(state.observation_cycles_remaining, 1);

        // Observe second cycle
        state.observe_cycle();
        assert!(state.can_participate());
        assert_eq!(state.observation_cycles_remaining, 0);

        // Additional observe_cycle calls should not go negative
        state.observe_cycle();
        assert!(state.can_participate());
        assert_eq!(state.observation_cycles_remaining, 0);
    }
}
