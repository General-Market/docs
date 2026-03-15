//! Netting Engine for Index L3
//!
//! This module provides various netting optimizations to reduce trading volume and costs:
//!
//! # Netting Types
//!
//! | # | Netting Type | What It Nets | Savings |
//! |---|--------------|--------------|---------|
//! | 1 | Pair Netting | Same-pair buys vs sells across ITPs | Fewer orders |
//! | 2 | Slippage Filter | Orders exceeding tier limits | Excluded orders retry next cycle |
//! | 3 | Bridge Netting | Opposite-direction bridges | 50-80% fewer bridges |
//! | 4 | USDT Netting | USDT buys vs USDT sells | 50%+ fewer stablecoin swaps |
//! | 5 | Fee Netting | Bridge fees shared across users | Fair distribution |
//!
//! # Architecture
//!
//! The Netting Engine runs during Phase 2 of the Oracle Cycle (1-second cycles):
//!
//! ```text
//! CYCLE N:
//! ├─ PHASE 1: Process Previous Fills
//! ├─ PHASE 2: Unified Netting Engine ← THIS MODULE
//! │   ├─ STEP 1: Pair Netting - merge same-pair orders
//! │   ├─ STEP 3: Slippage Filter - exclude orders above tier limit
//! │   ├─ STEP 5: Bridge Netting - net opposite-direction bridges
//! │   ├─ STEP 6: USDT Netting - net USDC↔USDT swaps
//! │   └─ STEP 7: Fee Allocation - distribute costs proportionally
//! ├─ PHASE 3: Inventory Check
//! └─ PHASE 4: Generate Execution Batch
//! ```
//!
//! # Slippage Tiers
//!
//! Orders are filtered by their slippage tier versus current market spread:
//! - Tier 0 (Strict): ≤0.3% - stablecoins, large caps
//! - Tier 1 (Normal): ≤1.0% - most assets
//! - Tier 2 (Relaxed): ≤3.0% - memecoins, low liquidity
//!
//! Orders exceeding their tier limit are excluded and queued for retry.

pub mod asset_decompose;
mod bridge;
mod fees;
mod pair;
pub mod rebalance;
mod types;
mod usdt;

pub use bridge::{bridge_netting, BridgeRequest, NettedBridgeTransfers};
pub use fees::{fee_allocation, FeeAllocation, FeeType};
pub use pair::pair_netting;
pub use rebalance::{
    allocate_rebalance_fills, calculate_net_deltas, compute_rebalance_progress,
    finalize_rebalance, generate_rebalance_trades, InternalTransfer, NetDeltaResult,
    PrioritySlots, RebalanceCompleteData, RebalanceFillAllocation, RebalanceProposal,
    RebalanceQueue, RebalanceTrade,
};
pub use asset_decompose::{decompose_and_net_orders, decompose_and_net_orders_checked, DecompositionResult, ItpDecompState, ZeroNavOrder};
pub use types::MergedOrder;
pub use usdt::{
    usdt_addresses, usdt_netting, usdt_netting_with_registry, ChainPairRegistry, DepegState,
    NoPairRegistry, PairQuoteLookup, UsdtNettingResult,
};

use crate::slippage::filter_merged_order;
use common::error::Error;
use common::types::LimitOrder;
use ethers::types::{H256, U256};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

/// Main Netting Engine that orchestrates all netting operations
pub struct NettingEngine {
    /// Current depeg state for USDT netting
    depeg_state: DepegState,
    /// Pair registry for USDT/USDC quote token lookup
    pair_registry: Arc<dyn PairQuoteLookup>,
}

impl Default for NettingEngine {
    fn default() -> Self {
        Self {
            depeg_state: DepegState::default(),
            pair_registry: Arc::new(NoPairRegistry),
        }
    }
}

impl std::fmt::Debug for NettingEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NettingEngine")
            .field("depeg_state", &self.depeg_state)
            .field("pair_registry", &"<dyn PairQuoteLookup>")
            .finish()
    }
}

impl NettingEngine {
    /// Create a new NettingEngine instance (uses NoPairRegistry heuristic fallback)
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a NettingEngine with an on-chain pair registry
    pub fn with_registry(pair_registry: Arc<dyn PairQuoteLookup>) -> Self {
        Self {
            depeg_state: DepegState::default(),
            pair_registry,
        }
    }

    /// Run the complete netting pipeline
    ///
    /// # Arguments
    ///
    /// * `orders` - Orders to net (from Order Batcher)
    /// * `bridges` - Bridge requests to net
    /// * `usdc_usdt_rate` - Current USDC/USDT exchange rate for depeg detection
    /// * `total_fee` - Total fee to allocate (bridge + gas)
    ///
    /// # Returns
    ///
    /// `NettingResult` containing all netting outputs including fee allocations
    ///
    /// # Note
    ///
    /// This is the legacy API without slippage filtering. For production use,
    /// prefer `run_netting_pipeline_with_slippage()` which includes slippage tier filtering.
    pub fn run_netting_pipeline(
        &mut self,
        orders: Vec<LimitOrder>,
        bridges: Vec<BridgeRequest>,
        usdc_usdt_rate: f64,
        total_fee: U256,
    ) -> NettingResult {
        // Use zero spread to include all orders (no slippage filtering)
        self.run_netting_pipeline_with_slippage(
            orders,
            bridges,
            usdc_usdt_rate,
            total_fee,
            Decimal::ZERO,
        )
    }

    /// Run the complete netting pipeline with slippage filtering
    ///
    /// # Arguments
    ///
    /// * `orders` - Orders to net (from Order Batcher)
    /// * `bridges` - Bridge requests to net
    /// * `usdc_usdt_rate` - Current USDC/USDT exchange rate for depeg detection
    /// * `total_fee` - Total fee to allocate (bridge + gas)
    /// * `current_spread` - Current market spread as decimal (e.g., 0.008 for 0.8%)
    ///
    /// # Returns
    ///
    /// `NettingResult` containing all netting outputs including fee allocations
    /// and excluded orders for retry
    ///
    /// # Pipeline Steps
    ///
    /// 1. USDT netting (depeg check)
    /// 2. Fee allocation (before consuming orders)
    /// 3. Pair netting (merge same-pair orders)
    /// 4. Slippage filtering (exclude orders above tier limit)
    /// 5. Bridge netting (net opposite-direction bridges)
    pub fn run_netting_pipeline_with_slippage(
        &mut self,
        orders: Vec<LimitOrder>,
        bridges: Vec<BridgeRequest>,
        usdc_usdt_rate: f64,
        total_fee: U256,
        current_spread: Decimal,
    ) -> NettingResult {
        // Step 1: USDT netting (net stablecoin swaps, respecting depeg)
        // Run first since it needs reference to orders
        let usdt_result = usdt_netting_with_registry(&orders, usdc_usdt_rate, &mut self.depeg_state, &*self.pair_registry);

        // Step 2: Fee allocation (before consuming orders)
        let fee_allocations = if !orders.is_empty() && !total_fee.is_zero() {
            fee_allocation(&orders, total_fee, FeeType::Combined).ok()
        } else {
            None
        };

        // Step 3: Pair netting (merge same-pair orders) - consumes orders
        let merged_orders = pair_netting(orders);

        // Step 4: Slippage filtering (exclude orders above tier limit)
        let (filtered_orders, excluded_orders) =
            filter_merged_orders_by_slippage(&merged_orders, current_spread);

        if !excluded_orders.is_empty() {
            tracing::info!(
                excluded_count = excluded_orders.len(),
                current_spread = %current_spread,
                "Orders excluded by slippage filter (queued for retry)"
            );
        }

        // Step 5: Bridge netting (net opposite-direction bridges)
        let bridge_result = bridge_netting(bridges);

        NettingResult {
            merged_orders: filtered_orders,
            bridge_result,
            usdt_result,
            fee_allocations,
            excluded_orders,
        }
    }

    /// Run the complete netting pipeline with rebalance support
    ///
    /// This method integrates rebalance trades into the pipeline with priority slot allocation.
    /// When rebalance trades are present, execution capacity is split 50/50 between
    /// rebalance and user orders.
    ///
    /// # Arguments
    ///
    /// * `orders` - User orders to net (from Order Batcher)
    /// * `rebalance_trades` - Rebalance trades from `generate_rebalance_trades`
    /// * `bridges` - Bridge requests to net
    /// * `usdc_usdt_rate` - Current USDC/USDT exchange rate for depeg detection
    /// * `total_fee` - Total fee to allocate (bridge + gas)
    /// * `total_capacity` - Total execution slot capacity
    ///
    /// # Returns
    ///
    /// `NettingResultWithRebalance` containing all netting outputs including slot allocations
    ///
    /// # Note
    ///
    /// This is the legacy API without slippage filtering. For production use,
    /// prefer `run_netting_pipeline_with_rebalance_and_slippage()` which includes slippage tier filtering.
    pub fn run_netting_pipeline_with_rebalance(
        &mut self,
        orders: Vec<LimitOrder>,
        rebalance_trades: Vec<RebalanceTrade>,
        bridges: Vec<BridgeRequest>,
        usdc_usdt_rate: f64,
        total_fee: U256,
        total_capacity: usize,
    ) -> NettingResultWithRebalance {
        // Use zero spread to include all orders (no slippage filtering)
        self.run_netting_pipeline_with_rebalance_and_slippage(
            orders,
            rebalance_trades,
            bridges,
            usdc_usdt_rate,
            total_fee,
            total_capacity,
            Decimal::ZERO,
        )
    }

    /// Run the complete netting pipeline with rebalance support and slippage filtering
    ///
    /// This method integrates rebalance trades into the pipeline with priority slot allocation
    /// and slippage tier filtering.
    ///
    /// # Arguments
    ///
    /// * `orders` - User orders to net (from Order Batcher)
    /// * `rebalance_trades` - Rebalance trades from `generate_rebalance_trades`
    /// * `bridges` - Bridge requests to net
    /// * `usdc_usdt_rate` - Current USDC/USDT exchange rate for depeg detection
    /// * `total_fee` - Total fee to allocate (bridge + gas)
    /// * `total_capacity` - Total execution slot capacity
    /// * `current_spread` - Current market spread as decimal (e.g., 0.008 for 0.8%)
    ///
    /// # Returns
    ///
    /// `NettingResultWithRebalance` containing all netting outputs including slot allocations
    /// and excluded orders for retry
    pub fn run_netting_pipeline_with_rebalance_and_slippage(
        &mut self,
        orders: Vec<LimitOrder>,
        rebalance_trades: Vec<RebalanceTrade>,
        bridges: Vec<BridgeRequest>,
        usdc_usdt_rate: f64,
        total_fee: U256,
        total_capacity: usize,
        current_spread: Decimal,
    ) -> NettingResultWithRebalance {
        // Determine priority slots based on whether rebalance is active
        let priority_slots = if !rebalance_trades.is_empty() {
            PrioritySlots::when_rebalance_active()
        } else {
            PrioritySlots::when_no_rebalance()
        };

        let (rebalance_slots, user_slots) = priority_slots.allocate_slots(total_capacity);

        tracing::info!(
            rebalance_trade_count = rebalance_trades.len(),
            user_order_count = orders.len(),
            rebalance_slots,
            user_slots,
            "Running netting pipeline with rebalance"
        );

        // Step 1: USDT netting (net stablecoin swaps, respecting depeg)
        let usdt_result = usdt_netting_with_registry(&orders, usdc_usdt_rate, &mut self.depeg_state, &*self.pair_registry);

        // Step 2: Fee allocation (before consuming orders)
        let fee_allocations = if !orders.is_empty() && !total_fee.is_zero() {
            fee_allocation(&orders, total_fee, FeeType::Combined).ok()
        } else {
            None
        };

        // Step 3: Pair netting (merge same-pair orders) - consumes orders
        let merged_orders = pair_netting(orders);

        // Step 4: Slippage filtering (exclude orders above tier limit)
        let (filtered_orders, excluded_orders) =
            filter_merged_orders_by_slippage(&merged_orders, current_spread);

        if !excluded_orders.is_empty() {
            tracing::info!(
                excluded_count = excluded_orders.len(),
                current_spread = %current_spread,
                "Orders excluded by slippage filter (queued for retry)"
            );
        }

        // Step 5: Bridge netting (net opposite-direction bridges)
        let bridge_result = bridge_netting(bridges);

        // Limit rebalance trades to allocated slots
        let limited_rebalance_trades: Vec<RebalanceTrade> = rebalance_trades
            .into_iter()
            .take(rebalance_slots)
            .collect();

        // Note: User order limiting would be applied at execution time based on user_slots
        // The merged_orders are already optimized, capacity limits apply downstream

        NettingResultWithRebalance {
            merged_orders: filtered_orders,
            rebalance_trades: limited_rebalance_trades,
            bridge_result,
            usdt_result,
            fee_allocations,
            priority_slots,
            rebalance_slots,
            user_slots,
            excluded_orders,
        }
    }

    /// Get the current depeg state
    pub fn depeg_state(&self) -> &DepegState {
        &self.depeg_state
    }

    /// Run the netting pipeline with invariant checks and per-step timing (Wave 4).
    ///
    /// Returns `Err` if any step fails or the post-pipeline invariant is violated.
    /// Invariant: sum(filtered_orders) + sum(excluded_orders) == sum(input_merged_orders)
    pub fn run_netting_pipeline_checked(
        &mut self,
        orders: Vec<LimitOrder>,
        bridges: Vec<BridgeRequest>,
        usdc_usdt_rate: f64,
        total_fee: U256,
        current_spread: Decimal,
    ) -> Result<(NettingResult, NettingPipelineMetrics), Error> {
        let mut metrics = NettingPipelineMetrics::default();
        let input_order_count = orders.len();

        // Step 1: USDT netting
        let t = Instant::now();
        let usdt_result = usdt_netting_with_registry(&orders, usdc_usdt_rate, &mut self.depeg_state, &*self.pair_registry);
        metrics.usdt_netting_ms = t.elapsed().as_millis() as u64;

        // Step 2: Fee allocation
        let t = Instant::now();
        let fee_allocations = if !orders.is_empty() && !total_fee.is_zero() {
            fee_allocation(&orders, total_fee, FeeType::Combined).ok()
        } else {
            None
        };
        metrics.fee_allocation_ms = t.elapsed().as_millis() as u64;

        // Step 3: Pair netting
        let t = Instant::now();
        let merged_orders = pair_netting(orders);
        metrics.pair_netting_ms = t.elapsed().as_millis() as u64;

        // Count total source orders after merge (for invariant check)
        let merged_source_count: usize = merged_orders.values()
            .map(|m| m.source_orders.len())
            .sum();

        // Step 4: Slippage filtering
        let t = Instant::now();
        let (filtered_orders, excluded_orders) =
            filter_merged_orders_by_slippage(&merged_orders, current_spread);
        metrics.slippage_filter_ms = t.elapsed().as_millis() as u64;

        // Invariant: filtered + excluded == merged input
        let filtered_count: usize = filtered_orders.values()
            .map(|m| m.source_orders.len())
            .sum();
        let total_after = filtered_count + excluded_orders.len();
        if total_after != merged_source_count {
            return Err(Error::Netting(format!(
                "Pipeline invariant violated: filtered({}) + excluded({}) = {} != merged_input({})",
                filtered_count, excluded_orders.len(), total_after, merged_source_count
            )));
        }

        if !excluded_orders.is_empty() {
            tracing::info!(
                excluded_count = excluded_orders.len(),
                current_spread = %current_spread,
                "Orders excluded by slippage filter (queued for retry)"
            );
        }

        // Step 5: Bridge netting
        let t = Instant::now();
        let bridge_result = bridge_netting(bridges);
        metrics.bridge_netting_ms = t.elapsed().as_millis() as u64;

        metrics.input_order_count = input_order_count;
        metrics.output_order_count = filtered_count;
        metrics.excluded_order_count = excluded_orders.len();

        Ok((
            NettingResult {
                merged_orders: filtered_orders,
                bridge_result,
                usdt_result,
                fee_allocations,
                excluded_orders,
            },
            metrics,
        ))
    }
}

/// Per-step timing metrics for the netting pipeline (Wave 4)
#[derive(Debug, Default)]
pub struct NettingPipelineMetrics {
    pub usdt_netting_ms: u64,
    pub fee_allocation_ms: u64,
    pub pair_netting_ms: u64,
    pub slippage_filter_ms: u64,
    pub bridge_netting_ms: u64,
    pub input_order_count: usize,
    pub output_order_count: usize,
    pub excluded_order_count: usize,
}

/// Result of the complete netting pipeline
#[derive(Debug)]
pub struct NettingResult {
    /// Merged orders by pair_id after pair netting and slippage filtering
    pub merged_orders: HashMap<H256, MergedOrder>,
    /// Bridge transfers after bridge netting
    pub bridge_result: NettedBridgeTransfers,
    /// USDT netting result
    pub usdt_result: UsdtNettingResult,
    /// Fee allocations per order (None if no orders or zero fee)
    pub fee_allocations: Option<Vec<FeeAllocation>>,
    /// Orders excluded by slippage filter (queued for retry in next cycle)
    pub excluded_orders: Vec<LimitOrder>,
}

/// Apply slippage filtering to merged orders
///
/// Takes merged orders from pair netting and filters each by slippage tier.
/// Returns the filtered merged orders and all excluded source orders for retry.
fn filter_merged_orders_by_slippage(
    merged_orders: &HashMap<H256, MergedOrder>,
    current_spread: Decimal,
) -> (HashMap<H256, MergedOrder>, Vec<LimitOrder>) {
    let mut filtered_orders = HashMap::new();
    let mut all_excluded = Vec::new();

    for (pair_id, merged) in merged_orders {
        // Filter this merged order by slippage
        let filtered = filter_merged_order(*pair_id, merged.source_orders.clone(), current_spread);

        // Collect excluded orders for retry
        all_excluded.extend(filtered.excluded_orders);

        // Only include in result if there are remaining orders after filtering
        if !filtered.included_orders.is_empty() {
            // Calculate weights from the included orders
            let total_slippage_weight = filtered
                .included_orders
                .iter()
                .map(|o| o.amount * o.slippage_tier)
                .fold(U256::zero(), |a, b| a + b);
            let total_amount = filtered
                .included_orders
                .iter()
                .map(|o| o.amount)
                .fold(U256::zero(), |a, b| a + b);

            // Recalculate the merged order with only included orders
            let recalculated = MergedOrder {
                pair_id: *pair_id,
                side: merged.side,
                net_amount: filtered.net_amount,
                source_orders: filtered.included_orders,
                total_slippage_weight,
                total_amount,
            };
            filtered_orders.insert(*pair_id, recalculated);
        } else {
            tracing::debug!(
                pair_id = %pair_id,
                "All orders excluded by slippage filter for this pair"
            );
        }
    }

    (filtered_orders, all_excluded)
}

/// Result of the netting pipeline with rebalance support
#[derive(Debug)]
pub struct NettingResultWithRebalance {
    /// Merged user orders by pair_id after pair netting and slippage filtering
    pub merged_orders: HashMap<H256, MergedOrder>,
    /// Rebalance trades limited to allocated slots
    pub rebalance_trades: Vec<RebalanceTrade>,
    /// Bridge transfers after bridge netting
    pub bridge_result: NettedBridgeTransfers,
    /// USDT netting result
    pub usdt_result: UsdtNettingResult,
    /// Fee allocations per order (None if no orders or zero fee)
    pub fee_allocations: Option<Vec<FeeAllocation>>,
    /// Priority slot configuration used
    pub priority_slots: PrioritySlots,
    /// Number of slots allocated to rebalance trades
    pub rebalance_slots: usize,
    /// Number of slots allocated to user orders
    pub user_slots: usize,
    /// Orders excluded by slippage filter (queued for retry in next cycle)
    pub excluded_orders: Vec<LimitOrder>,
}

#[cfg(test)]
mod tests;
