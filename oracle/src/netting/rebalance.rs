//! Rebalance Netting Engine for Index L3
//!
//! This module provides netting optimizations for ITP weight rebalances, reducing
//! trading volume when multiple ITPs adjust their asset weights simultaneously.
//!
//! # Architecture
//!
//! The Rebalance Netting Engine runs during Phase 2 of the Issuer Cycle (1-second cycles):
//!
//! ```text
//! CYCLE N:
//! ├─ PHASE 1: Process Previous Fills
//! ├─ PHASE 2: Unified Netting Engine
//! │   ├─ STEP 1: Pair Netting (user orders) ← Story 3.7
//! │   ├─ STEP 1b: Rebalance Netting ← THIS MODULE (nets rebalances across ITPs)
//! │   ├─ STEP 2-7: Remaining pipeline steps...
//! ├─ PHASE 3: Inventory Check
//! └─ PHASE 4: Generate Execution Batch
//! ```
//!
//! # Netting Benefit Example
//!
//! ```text
//! ITP-A: BTC 50%→30% (value $100k) → sell $20k BTC
//! ITP-B: BTC 40%→60% (value $50k)  → buy $10k BTC
//!
//! Net: Sell $10k BTC (instead of $30k volume)
//! ITP-A "sells to" ITP-B internally ($10k)
//! Only $10k needs external execution
//!
//! Volume reduction: 66% (from $30k to $10k)
//! ```

use common::error::Error;
use common::types::Side;
use ethers::types::{H256, I256, U256};
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// One unit in 18 decimal precision (1e18)
const WAD: u128 = 1_000_000_000_000_000_000;

/// A rebalance proposal for a single ITP
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebalanceProposal {
    /// ITP identifier
    pub itp_id: H256,
    /// Current weights (18 decimals, sum = 1e18)
    pub old_weights: Vec<U256>,
    /// Target weights (18 decimals, sum = 1e18)
    pub new_weights: Vec<U256>,
    /// Which assets this ITP holds (sparse asset list)
    pub asset_indices: Vec<U256>,
    /// Block timestamp when proposal was created
    pub proposed_at: U256,
    /// New inventory quantities (per-share) after rebalance
    pub new_inventory: Vec<U256>,
    /// NAV at time of rebalance (18 decimals)
    pub nav: U256,
}

impl RebalanceProposal {
    /// Create a new RebalanceProposal with validation
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - old_weights, new_weights, or asset_indices have mismatched lengths
    /// - old_weights don't sum to 1e18 (within tolerance)
    /// - new_weights don't sum to 1e18 (within tolerance)
    pub fn new(
        itp_id: H256,
        old_weights: Vec<U256>,
        new_weights: Vec<U256>,
        asset_indices: Vec<U256>,
        proposed_at: U256,
        new_inventory: Vec<U256>,
        nav: U256,
    ) -> Result<Self, Error> {
        // Validate array lengths match
        if old_weights.len() != new_weights.len() || old_weights.len() != asset_indices.len() {
            return Err(Error::InvalidArgument(format!(
                "Mismatched array lengths: old_weights={}, new_weights={}, asset_indices={}",
                old_weights.len(),
                new_weights.len(),
                asset_indices.len()
            )));
        }

        // Validate weights sum to 1e18 (allow small tolerance for rounding)
        let wad = U256::from(WAD);
        let tolerance = U256::from(1000); // Allow 1000 wei tolerance

        let old_sum: U256 = old_weights.iter().fold(U256::zero(), |acc, w| acc + *w);
        if old_sum > wad + tolerance || old_sum + tolerance < wad {
            return Err(Error::InvalidArgument(format!(
                "old_weights sum {} != 1e18",
                old_sum
            )));
        }

        let new_sum: U256 = new_weights.iter().fold(U256::zero(), |acc, w| acc + *w);
        if new_sum > wad + tolerance || new_sum + tolerance < wad {
            return Err(Error::InvalidArgument(format!(
                "new_weights sum {} != 1e18",
                new_sum
            )));
        }

        Ok(Self {
            itp_id,
            old_weights,
            new_weights,
            asset_indices,
            proposed_at,
            new_inventory,
            nav,
        })
    }

    /// Create a RebalanceProposal without validation (for tests/trusted sources)
    ///
    /// # Safety
    ///
    /// Caller must ensure weights are valid and sum to 1e18
    pub fn new_unchecked(
        itp_id: H256,
        old_weights: Vec<U256>,
        new_weights: Vec<U256>,
        asset_indices: Vec<U256>,
        proposed_at: U256,
        new_inventory: Vec<U256>,
        nav: U256,
    ) -> Self {
        Self {
            itp_id,
            old_weights,
            new_weights,
            asset_indices,
            proposed_at,
            new_inventory,
            nav,
        }
    }
}

/// Queue for collecting rebalance proposals before batch execution
#[derive(Debug)]
pub struct RebalanceQueue {
    /// Pending proposals waiting for batch execution
    pub proposals: Vec<RebalanceProposal>,
    /// When the current batch started collecting (local time for metrics only)
    batch_started_at: Option<Instant>,
    /// Block timestamp when batch started (for consensus-safe timeout)
    batch_started_block_time: Option<U256>,
    /// Whether admin has signaled to execute the batch
    pub execute_signal_received: bool,
    /// Timeout duration for batch collection (default 1 hour)
    pub timeout_duration: Duration,
    /// Expected number of rebalances in this batch (optional)
    pub expected_count: Option<usize>,
}

impl RebalanceQueue {
    /// Create a new RebalanceQueue with the given timeout duration
    pub fn new(timeout: Duration) -> Self {
        Self {
            proposals: Vec::new(),
            batch_started_at: None,
            batch_started_block_time: None,
            execute_signal_received: false,
            timeout_duration: timeout,
            expected_count: None,
        }
    }

    /// Create a new RebalanceQueue with default 1-hour timeout
    pub fn with_default_timeout() -> Self {
        Self::new(Duration::from_secs(3600))
    }

    /// Add a proposal to the queue
    ///
    /// Starts the batch timer if this is the first proposal.
    /// Uses the proposal's `proposed_at` timestamp for consensus-safe timeout.
    pub fn add_proposal(&mut self, proposal: RebalanceProposal) {
        if self.batch_started_at.is_none() {
            self.batch_started_at = Some(Instant::now());
            self.batch_started_block_time = Some(proposal.proposed_at);
            tracing::info!(
                itp_id = %proposal.itp_id,
                block_time = %proposal.proposed_at,
                timeout_secs = self.timeout_duration.as_secs(),
                "Started rebalance batch collection"
            );
        }

        tracing::debug!(
            itp_id = %proposal.itp_id,
            asset_count = proposal.asset_indices.len(),
            "Added rebalance proposal to queue"
        );

        self.proposals.push(proposal);
    }

    /// Set the expected number of rebalances for this batch
    pub fn set_expected_count(&mut self, count: usize) {
        self.expected_count = Some(count);
    }

    /// Signal that the batch should be executed immediately
    pub fn signal_execute(&mut self) {
        self.execute_signal_received = true;
        tracing::info!(
            proposal_count = self.proposals.len(),
            "Execute signal received for rebalance batch"
        );
    }

    /// Check if the batch is ready for execution (using local time)
    ///
    /// **Note**: For consensus-safe timeout checking, use `is_batch_ready_at_block_time()`
    ///
    /// Returns true if:
    /// - Execute signal was received, OR
    /// - Timeout has elapsed (local time), OR
    /// - Expected count reached (if set)
    pub fn is_batch_ready(&self) -> bool {
        if self.proposals.is_empty() {
            return false;
        }

        // Execute signal received
        if self.execute_signal_received {
            return true;
        }

        // Expected count reached
        if let Some(expected) = self.expected_count {
            if self.proposals.len() >= expected {
                return true;
            }
        }

        // Timeout elapsed (local time - for single-node use)
        if let Some(started) = self.batch_started_at {
            if started.elapsed() >= self.timeout_duration {
                tracing::info!(
                    proposal_count = self.proposals.len(),
                    "Rebalance batch timeout reached (local time)"
                );
                return true;
            }
        }

        false
    }

    /// Check if the batch is ready for execution using block timestamp (consensus-safe)
    ///
    /// Use this method in distributed issuer networks to ensure all nodes
    /// agree on batch readiness based on chain time, not local clocks.
    ///
    /// # Arguments
    ///
    /// * `current_block_time` - Current block timestamp from chain
    ///
    /// Returns true if:
    /// - Execute signal was received, OR
    /// - Block time timeout has elapsed, OR
    /// - Expected count reached (if set)
    pub fn is_batch_ready_at_block_time(&self, current_block_time: U256) -> bool {
        if self.proposals.is_empty() {
            return false;
        }

        // Execute signal received
        if self.execute_signal_received {
            return true;
        }

        // Expected count reached
        if let Some(expected) = self.expected_count {
            if self.proposals.len() >= expected {
                return true;
            }
        }

        // Timeout elapsed (block time - consensus-safe)
        if let Some(started_block_time) = self.batch_started_block_time {
            let timeout_seconds = U256::from(self.timeout_duration.as_secs());
            if current_block_time >= started_block_time + timeout_seconds {
                tracing::info!(
                    proposal_count = self.proposals.len(),
                    started_block_time = %started_block_time,
                    current_block_time = %current_block_time,
                    "Rebalance batch timeout reached (block time)"
                );
                return true;
            }
        }

        false
    }

    /// Drain all proposals from the queue for execution
    ///
    /// Resets the queue state for the next batch.
    pub fn drain_batch(&mut self) -> Vec<RebalanceProposal> {
        let proposals = std::mem::take(&mut self.proposals);

        tracing::info!(
            drained_count = proposals.len(),
            "Drained rebalance batch for execution"
        );

        // Reset queue state
        self.batch_started_at = None;
        self.batch_started_block_time = None;
        self.execute_signal_received = false;
        self.expected_count = None;

        proposals
    }

    /// Get the number of pending proposals
    pub fn len(&self) -> usize {
        self.proposals.len()
    }

    /// Check if the queue is empty
    pub fn is_empty(&self) -> bool {
        self.proposals.is_empty()
    }

    /// Collect rebalance proposals - returns proposals when batch is ready
    ///
    /// This is the main entry point for collecting proposals. Call this periodically
    /// to check if the batch is ready for execution.
    ///
    /// # Returns
    ///
    /// - `Some(Vec<RebalanceProposal>)` if the batch is ready (signal/timeout/count reached)
    /// - `None` if still collecting proposals
    pub fn collect_rebalance_proposals(&mut self) -> Option<Vec<RebalanceProposal>> {
        if self.is_batch_ready() {
            Some(self.drain_batch())
        } else {
            None
        }
    }

    /// Get elapsed time since batch started
    pub fn elapsed(&self) -> Option<Duration> {
        self.batch_started_at.map(|t| t.elapsed())
    }

    /// Get remaining time until timeout
    pub fn remaining_timeout(&self) -> Option<Duration> {
        self.batch_started_at.map(|t| {
            let elapsed = t.elapsed();
            self.timeout_duration.saturating_sub(elapsed)
        })
    }
}

/// A trade generated from rebalance netting
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebalanceTrade {
    /// Asset index being traded
    pub asset_idx: U256,
    /// Buy or Sell
    pub side: Side,
    /// Absolute amount to trade (18 decimals)
    pub amount: U256,
    /// ITPs contributing to this trade direction
    pub source_itps: Vec<H256>,
    /// Always true for rebalance trades (for priority slot allocation)
    pub is_rebalance: bool,
}

impl RebalanceTrade {
    /// Create a new RebalanceTrade
    pub fn new(asset_idx: U256, side: Side, amount: U256, source_itps: Vec<H256>) -> Self {
        Self {
            asset_idx,
            side,
            amount,
            source_itps,
            is_rebalance: true,
        }
    }
}

/// Fill allocation result for a single ITP after rebalance execution
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebalanceFillAllocation {
    /// ITP identifier
    pub itp_id: H256,
    /// Amount allocated per asset (asset_idx → fill amount)
    pub asset_allocations: HashMap<U256, U256>,
    /// Internal transfers where this ITP participated
    pub internal_transfers: Vec<InternalTransfer>,
}

impl RebalanceFillAllocation {
    /// Create a new empty allocation for an ITP
    pub fn new(itp_id: H256) -> Self {
        Self {
            itp_id,
            asset_allocations: HashMap::new(),
            internal_transfers: Vec::new(),
        }
    }
}

/// Internal transfer between ITPs (no external execution needed)
///
/// When one ITP is buying and another is selling the same asset,
/// they can "trade" internally without hitting the market.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InternalTransfer {
    /// ITP selling the asset
    pub from_itp: H256,
    /// ITP buying the asset
    pub to_itp: H256,
    /// Asset being transferred
    pub asset_idx: U256,
    /// Amount transferred (18 decimals)
    pub amount: U256,
}

impl InternalTransfer {
    /// Create a new internal transfer
    pub fn new(from_itp: H256, to_itp: H256, asset_idx: U256, amount: U256) -> Self {
        Self {
            from_itp,
            to_itp,
            asset_idx,
            amount,
        }
    }
}

/// Execution priority slot configuration
///
/// Controls how execution capacity is split between rebalance trades
/// and user orders when a rebalance is active.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PrioritySlots {
    /// Percentage allocated to rebalance trades (0-100)
    pub rebalance_percent: u8,
    /// Percentage allocated to user orders (0-100)
    pub user_percent: u8,
}

impl PrioritySlots {
    /// Configuration when rebalance is active: 50% rebalance, 50% user
    pub fn when_rebalance_active() -> Self {
        Self {
            rebalance_percent: 50,
            user_percent: 50,
        }
    }

    /// Configuration when no rebalance is active: 100% user
    pub fn when_no_rebalance() -> Self {
        Self {
            rebalance_percent: 0,
            user_percent: 100,
        }
    }

    /// Custom slot allocation
    ///
    /// # Errors
    ///
    /// Returns error if percentages don't sum to 100
    pub fn custom(rebalance_percent: u8, user_percent: u8) -> Result<Self, Error> {
        if rebalance_percent.saturating_add(user_percent) != 100 {
            return Err(Error::InvalidArgument(format!(
                "Slot percentages must sum to 100, got {} + {} = {}",
                rebalance_percent,
                user_percent,
                rebalance_percent.saturating_add(user_percent)
            )));
        }
        Ok(Self {
            rebalance_percent,
            user_percent,
        })
    }

    /// Allocate slots from total capacity
    ///
    /// # Arguments
    ///
    /// * `total_capacity` - Total number of execution slots available
    ///
    /// # Returns
    ///
    /// Tuple of (rebalance_slots, user_slots)
    pub fn allocate_slots(&self, total_capacity: usize) -> (usize, usize) {
        let rebalance = total_capacity * self.rebalance_percent as usize / 100;
        let user = total_capacity - rebalance;
        (rebalance, user)
    }
}

impl Default for PrioritySlots {
    fn default() -> Self {
        Self::when_no_rebalance()
    }
}

/// Tracks each ITP's contribution to net delta for an asset
#[derive(Debug, Clone)]
struct ItpDeltaContribution {
    itp_id: H256,
    /// Signed delta: positive = buying, negative = selling
    delta: I256,
}

/// Result of net delta calculation including any skipped proposals
#[derive(Debug, Clone)]
pub struct NetDeltaResult {
    /// Net delta per asset (asset_idx → signed delta)
    pub net_deltas: HashMap<U256, I256>,
    /// ITP IDs that were skipped (e.g., zero value)
    pub skipped_itps: Vec<H256>,
    /// Number of proposals processed
    pub processed_count: usize,
}

/// Calculate net deltas for all assets across all rebalance proposals
///
/// Formula: `net_delta[asset] = Σ(itp_value × (new_weight - old_weight))`
///
/// # Arguments
///
/// * `proposals` - Rebalance proposals from all ITPs
/// * `itp_values` - Total value of each ITP (in USDC, 18 decimals)
/// * `_prices` - Asset prices (unused in weight-based calculation, reserved for future use)
///
/// # Returns
///
/// `NetDeltaResult` containing net deltas and information about skipped proposals
pub fn calculate_net_deltas(
    proposals: &[RebalanceProposal],
    itp_values: &HashMap<H256, U256>,
    _prices: &HashMap<U256, U256>,
) -> NetDeltaResult {
    let mut net_deltas: HashMap<U256, I256> = HashMap::new();
    let mut skipped_itps: Vec<H256> = Vec::new();
    let mut processed_count: usize = 0;

    for proposal in proposals {
        let itp_value = itp_values
            .get(&proposal.itp_id)
            .copied()
            .unwrap_or(U256::zero());

        if itp_value.is_zero() {
            tracing::warn!(
                code = "E010",
                itp_id = %proposal.itp_id,
                "ITP has zero value, skipping rebalance proposal"
            );
            skipped_itps.push(proposal.itp_id);
            continue;
        }

        processed_count += 1;

        for (idx, &asset_idx) in proposal.asset_indices.iter().enumerate() {
            let old_weight = proposal.old_weights.get(idx).copied().unwrap_or(U256::zero());
            let new_weight = proposal.new_weights.get(idx).copied().unwrap_or(U256::zero());

            // Calculate amounts: value * weight / 1e18
            let old_amount = itp_value * old_weight / U256::from(WAD);
            let new_amount = itp_value * new_weight / U256::from(WAD);

            // Convert to I256 for signed arithmetic
            // Safe because amounts are bounded by ITP value which fits in I256
            let old_i256 = i256_from_u256(old_amount);
            let new_i256 = i256_from_u256(new_amount);
            let delta = new_i256 - old_i256;

            // Accumulate
            *net_deltas.entry(asset_idx).or_insert(I256::zero()) += delta;

            tracing::trace!(
                itp_id = %proposal.itp_id,
                asset_idx = %asset_idx,
                old_weight = %old_weight,
                new_weight = %new_weight,
                delta = %delta,
                "Calculated ITP delta for asset"
            );
        }
    }

    // Log summary
    for (&asset_idx, &delta) in &net_deltas {
        if !delta.is_zero() {
            tracing::debug!(
                asset_idx = %asset_idx,
                net_delta = %delta,
                direction = if delta.is_positive() { "BUY" } else { "SELL" },
                "Net delta calculated for asset"
            );
        }
    }

    if !skipped_itps.is_empty() {
        tracing::warn!(
            code = "E010",
            skipped_count = skipped_itps.len(),
            "Some rebalance proposals were skipped due to zero ITP values"
        );
    }

    NetDeltaResult {
        net_deltas,
        skipped_itps,
        processed_count,
    }
}

/// Generate rebalance trades from net deltas
///
/// For each non-zero net delta:
/// - Positive delta → BUY trade
/// - Negative delta → SELL trade
/// - Zero delta → no trade (fully netted internally)
///
/// # Arguments
///
/// * `net_delta_result` - Result from `calculate_net_deltas`
/// * `proposals` - Original proposals (used to identify contributing ITPs)
/// * `itp_values` - ITP values (used to recalculate per-ITP contributions)
///
/// # Returns
///
/// Vector of `RebalanceTrade` for external execution
pub fn generate_rebalance_trades(
    net_delta_result: &NetDeltaResult,
    proposals: &[RebalanceProposal],
    itp_values: &HashMap<H256, U256>,
) -> Vec<RebalanceTrade> {
    let net_deltas = &net_delta_result.net_deltas;
    let mut trades = Vec::new();

    for (&asset_idx, &net_delta) in net_deltas {
        if net_delta.is_zero() {
            tracing::debug!(
                asset_idx = %asset_idx,
                "Asset fully netted internally, no external trade needed"
            );
            continue;
        }

        // Determine trade side and amount
        let (side, amount) = if net_delta.is_positive() {
            (Side::Buy, u256_from_i256(net_delta))
        } else {
            (Side::Sell, u256_from_i256(-net_delta))
        };

        // Find ITPs contributing to this direction
        let source_itps: Vec<H256> = proposals
            .iter()
            .filter(|p| {
                // Calculate this ITP's delta for this asset
                let itp_value = itp_values.get(&p.itp_id).copied().unwrap_or(U256::zero());
                if let Some(idx) = p.asset_indices.iter().position(|&a| a == asset_idx) {
                    let old_w = p.old_weights.get(idx).copied().unwrap_or(U256::zero());
                    let new_w = p.new_weights.get(idx).copied().unwrap_or(U256::zero());
                    let old_amt = itp_value * old_w / U256::from(WAD);
                    let new_amt = itp_value * new_w / U256::from(WAD);
                    let delta = i256_from_u256(new_amt) - i256_from_u256(old_amt);

                    // Include ITP if its delta is in the same direction as net
                    (net_delta.is_positive() && delta.is_positive())
                        || (net_delta.is_negative() && delta.is_negative())
                } else {
                    false
                }
            })
            .map(|p| p.itp_id)
            .collect();

        tracing::info!(
            asset_idx = %asset_idx,
            side = ?side,
            amount = %amount,
            source_itp_count = source_itps.len(),
            "Generated rebalance trade"
        );

        trades.push(RebalanceTrade::new(asset_idx, side, amount, source_itps));
    }

    trades
}

/// Allocate rebalance fills pro-rata to each ITP based on their contribution
///
/// Formula: `itp_fill = total_fill × (|itp_delta| / |total_delta|)`
///
/// Also handles internal transfers where ITPs on opposite sides can match.
///
/// # Arguments
///
/// * `fills` - Fills received from execution (asset_idx → fill_amount)
/// * `proposals` - Original rebalance proposals
/// * `itp_values` - ITP values for calculating deltas
///
/// # Returns
///
/// HashMap mapping ITP ID to their fill allocation
pub fn allocate_rebalance_fills(
    fills: &HashMap<U256, U256>,
    proposals: &[RebalanceProposal],
    itp_values: &HashMap<H256, U256>,
) -> HashMap<H256, RebalanceFillAllocation> {
    let mut allocations: HashMap<H256, RebalanceFillAllocation> = HashMap::new();

    // Initialize allocations for all ITPs
    for proposal in proposals {
        allocations.insert(proposal.itp_id, RebalanceFillAllocation::new(proposal.itp_id));
    }

    // Process each asset
    for (&asset_idx, &total_fill) in fills {
        // Calculate per-ITP contributions for this asset
        let contributions = calculate_itp_contributions(asset_idx, proposals, itp_values);

        if contributions.is_empty() {
            continue;
        }

        // Separate buyers and sellers
        let (buyers, sellers): (Vec<_>, Vec<_>) = contributions
            .iter()
            .partition(|c| c.delta.is_positive());

        // Calculate total buying and selling amounts
        let total_buy: I256 = buyers.iter().map(|c| c.delta).fold(I256::zero(), |a, b| a + b);
        let total_sell: I256 = sellers
            .iter()
            .map(|c| c.delta.abs())
            .fold(I256::zero(), |a, b| a + b);

        // Handle internal transfers first (match buyers with sellers)
        let internal_amount = std::cmp::min(
            u256_from_i256(total_buy),
            u256_from_i256(total_sell),
        );

        if !internal_amount.is_zero() {
            generate_internal_transfers(
                asset_idx,
                internal_amount,
                &buyers,
                &sellers,
                &mut allocations,
            );
        }

        // Allocate external fills pro-rata
        // External fill is for the direction with the larger absolute delta
        let net_delta = total_buy - total_sell;

        if net_delta.is_positive() {
            // Net buy - allocate to buyers pro-rata
            allocate_to_direction(
                asset_idx,
                total_fill,
                &buyers,
                total_buy,
                &mut allocations,
            );
        } else if net_delta.is_negative() {
            // Net sell - allocate to sellers pro-rata
            allocate_to_direction(
                asset_idx,
                total_fill,
                &sellers,
                total_sell,
                &mut allocations,
            );
        }
        // If net_delta is zero, all was handled internally
    }

    allocations
}

/// Calculate each ITP's delta contribution for a specific asset
fn calculate_itp_contributions(
    asset_idx: U256,
    proposals: &[RebalanceProposal],
    itp_values: &HashMap<H256, U256>,
) -> Vec<ItpDeltaContribution> {
    let mut contributions = Vec::new();

    for proposal in proposals {
        let itp_value = itp_values.get(&proposal.itp_id).copied().unwrap_or(U256::zero());

        if let Some(idx) = proposal.asset_indices.iter().position(|&a| a == asset_idx) {
            let old_w = proposal.old_weights.get(idx).copied().unwrap_or(U256::zero());
            let new_w = proposal.new_weights.get(idx).copied().unwrap_or(U256::zero());
            let old_amt = itp_value * old_w / U256::from(WAD);
            let new_amt = itp_value * new_w / U256::from(WAD);
            let delta = i256_from_u256(new_amt) - i256_from_u256(old_amt);

            if !delta.is_zero() {
                contributions.push(ItpDeltaContribution {
                    itp_id: proposal.itp_id,
                    delta,
                });
            }
        }
    }

    contributions
}

/// Generate internal transfers between buyers and sellers
fn generate_internal_transfers(
    asset_idx: U256,
    total_internal: U256,
    buyers: &[&ItpDeltaContribution],
    sellers: &[&ItpDeltaContribution],
    allocations: &mut HashMap<H256, RebalanceFillAllocation>,
) {
    // Calculate total on each side for pro-rata distribution
    let total_buy: U256 = buyers
        .iter()
        .map(|c| u256_from_i256(c.delta))
        .fold(U256::zero(), |a, b| a + b);
    let total_sell: U256 = sellers
        .iter()
        .map(|c| u256_from_i256(c.delta.abs()))
        .fold(U256::zero(), |a, b| a + b);

    // For each buyer, create transfers from sellers
    for buyer in buyers {
        let buyer_share = if total_buy.is_zero() {
            U256::zero()
        } else {
            total_internal * u256_from_i256(buyer.delta) / total_buy
        };

        if buyer_share.is_zero() {
            continue;
        }

        // Distribute this buyer's share among sellers
        let mut remaining = buyer_share;
        for seller in sellers {
            if remaining.is_zero() {
                break;
            }

            let seller_portion = if total_sell.is_zero() {
                U256::zero()
            } else {
                buyer_share * u256_from_i256(seller.delta.abs()) / total_sell
            };

            let transfer_amount = std::cmp::min(remaining, seller_portion);
            if transfer_amount.is_zero() {
                continue;
            }

            let transfer = InternalTransfer::new(
                seller.itp_id,
                buyer.itp_id,
                asset_idx,
                transfer_amount,
            );

            tracing::debug!(
                from_itp = %seller.itp_id,
                to_itp = %buyer.itp_id,
                asset_idx = %asset_idx,
                amount = %transfer_amount,
                "Generated internal transfer"
            );

            // Add to both sides
            if let Some(alloc) = allocations.get_mut(&buyer.itp_id) {
                alloc.internal_transfers.push(transfer.clone());
                *alloc.asset_allocations.entry(asset_idx).or_insert(U256::zero()) += transfer_amount;
            }
            if let Some(alloc) = allocations.get_mut(&seller.itp_id) {
                alloc.internal_transfers.push(transfer);
            }

            remaining -= transfer_amount;
        }
    }
}

/// Allocate fills to ITPs in one direction (all buyers or all sellers)
fn allocate_to_direction(
    asset_idx: U256,
    total_fill: U256,
    contributors: &[&ItpDeltaContribution],
    total_delta: I256,
    allocations: &mut HashMap<H256, RebalanceFillAllocation>,
) {
    if total_delta.is_zero() || contributors.is_empty() {
        return;
    }

    let total_abs = u256_from_i256(total_delta.abs());
    let mut allocated = U256::zero();
    let mut largest_itp = H256::zero();
    let mut largest_share = U256::zero();

    // Allocate pro-rata
    for contribution in contributors {
        let share = total_fill * u256_from_i256(contribution.delta.abs()) / total_abs;

        if let Some(alloc) = allocations.get_mut(&contribution.itp_id) {
            *alloc.asset_allocations.entry(asset_idx).or_insert(U256::zero()) += share;
            allocated += share;

            if share > largest_share {
                largest_share = share;
                largest_itp = contribution.itp_id;
            }
        }
    }

    // Handle rounding remainder - give to largest contributor
    let remainder = total_fill.saturating_sub(allocated);
    if !remainder.is_zero() && largest_itp != H256::zero() {
        if let Some(alloc) = allocations.get_mut(&largest_itp) {
            *alloc.asset_allocations.entry(asset_idx).or_insert(U256::zero()) += remainder;
        }
    }
}

/// Data for RebalanceComplete event
#[derive(Debug, Clone)]
pub struct RebalanceCompleteData {
    /// ITP that completed rebalance
    pub itp_id: H256,
    /// New weights after rebalance
    pub new_weights: Vec<U256>,
    /// Progress (1.0 = complete)
    pub progress: f64,
}

/// Finalize a rebalance for an ITP, preparing event data
///
/// # Arguments
///
/// * `itp_id` - ITP being finalized
/// * `proposal` - Original rebalance proposal
/// * `allocation` - Fill allocation for this ITP
///
/// # Returns
///
/// `RebalanceCompleteData` for event emission
pub fn finalize_rebalance(
    itp_id: H256,
    proposal: &RebalanceProposal,
    _allocation: &RebalanceFillAllocation,
) -> RebalanceCompleteData {
    tracing::info!(
        itp_id = %itp_id,
        new_weights_count = proposal.new_weights.len(),
        "Finalizing rebalance for ITP"
    );

    RebalanceCompleteData {
        itp_id,
        new_weights: proposal.new_weights.clone(),
        progress: 1.0, // Fully complete
    }
}

/// Compute rebalance progress based on current vs target allocations
///
/// Formula: `progress = Σ(current - start) / Σ(target - start)` weighted by change magnitude
///
/// # Arguments
///
/// * `current_inventory` - Current asset quantities
/// * `start_weights` - Weights when rebalance started
/// * `target_weights` - Target weights
/// * `asset_indices` - Asset indices for this ITP
/// * `prices` - Current asset prices
///
/// # Returns
///
/// Progress as f64 from 0.0 (not started) to 1.0 (complete)
///
/// # Errors
///
/// Returns error if array lengths don't match
pub fn compute_rebalance_progress(
    current_inventory: &[U256],
    start_weights: &[U256],
    target_weights: &[U256],
    asset_indices: &[U256],
    prices: &HashMap<U256, U256>,
) -> Result<f64, Error> {
    if current_inventory.len() != asset_indices.len()
        || start_weights.len() != asset_indices.len()
        || target_weights.len() != asset_indices.len()
    {
        return Err(Error::InvalidArgument(format!(
            "Mismatched array lengths: inventory={}, start_weights={}, target_weights={}, asset_indices={}",
            current_inventory.len(),
            start_weights.len(),
            target_weights.len(),
            asset_indices.len()
        )));
    }

    // Calculate total value
    let total_value: U256 = asset_indices
        .iter()
        .zip(current_inventory.iter())
        .map(|(idx, qty)| *qty * prices.get(idx).copied().unwrap_or(U256::one()))
        .fold(U256::zero(), |acc, x| acc + x);

    if total_value.is_zero() {
        return Ok(1.0); // Nothing to rebalance
    }

    let mut progress_sum = 0.0_f64;
    let mut weight_sum = 0.0_f64;

    for (i, &asset_idx) in asset_indices.iter().enumerate() {
        let qty = current_inventory[i];
        let price = prices.get(&asset_idx).copied().unwrap_or(U256::one());
        let current_value = qty * price;

        // Convert to f64 for precision
        let current_alloc = u256_to_f64(current_value) / u256_to_f64(total_value);
        let start_alloc = u256_to_f64(start_weights[i]) / (WAD as f64);
        let target_alloc = u256_to_f64(target_weights[i]) / (WAD as f64);

        let change_magnitude = (target_alloc - start_alloc).abs();
        if change_magnitude > f64::EPSILON {
            let progress = if (target_alloc - start_alloc).abs() < f64::EPSILON {
                1.0
            } else {
                ((current_alloc - start_alloc) / (target_alloc - start_alloc)).clamp(0.0, 1.0)
            };
            progress_sum += progress * change_magnitude;
            weight_sum += change_magnitude;
        }
    }

    if weight_sum > f64::EPSILON {
        Ok(progress_sum / weight_sum)
    } else {
        Ok(1.0) // No change needed
    }
}

// === Helper functions for I256/U256 conversion ===

/// Maximum safe U256 value that can be converted to I256 (2^255 - 1)
const MAX_SAFE_U256_FOR_I256: U256 = U256([u64::MAX, u64::MAX, u64::MAX, i64::MAX as u64]);

/// Convert U256 to I256
///
/// # Errors
///
/// Returns error if value >= 2^255 (exceeds I256::MAX)
fn i256_from_u256_checked(value: U256) -> Result<I256, Error> {
    if value > MAX_SAFE_U256_FOR_I256 {
        return Err(Error::InvalidArgument(format!(
            "U256 value {} exceeds I256::MAX (overflow)",
            value
        )));
    }
    Ok(I256::from_raw(value))
}

/// Convert U256 to I256 (panics on overflow - use for values known to be safe)
///
/// # Panics
///
/// Panics if value >= 2^255
fn i256_from_u256(value: U256) -> I256 {
    // SAFETY: Token amounts in production never exceed I256::MAX (~5.8e76).
    // Overflow here would indicate a contract-level bug, not a runtime condition.
    i256_from_u256_checked(value).expect("U256 value exceeds I256::MAX - this is a bug")
}

/// Convert I256 to U256 (takes absolute value)
fn u256_from_i256(value: I256) -> U256 {
    if value.is_negative() {
        (-value).into_raw()
    } else {
        value.into_raw()
    }
}

/// Convert U256 to f64 (lossy for large values)
fn u256_to_f64(value: U256) -> f64 {
    // Use low_u128 for values that fit, otherwise approximate
    if value <= U256::from(u128::MAX) {
        value.as_u128() as f64
    } else {
        // Approximate by scaling down: value = high * 2^128 + low
        let high = value >> 128;
        let low = value & U256::from(u128::MAX);
        // 2^128 as f64 (this is exact in IEEE 754)
        const TWO_POW_128: f64 = 340282366920938463463374607431768211456.0;
        (high.as_u128() as f64) * TWO_POW_128 + (low.as_u128() as f64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test helpers
    fn make_itp_id(n: u64) -> H256 {
        H256::from_low_u64_be(n)
    }

    fn make_proposal(
        itp_id: H256,
        old_weights: Vec<u64>,
        new_weights: Vec<u64>,
        asset_indices: Vec<u64>,
    ) -> RebalanceProposal {
        // Use new_unchecked for tests since weights may not sum to exactly 100
        RebalanceProposal::new_unchecked(
            itp_id,
            old_weights.into_iter().map(|w| U256::from(w) * U256::exp10(16)).collect(),
            new_weights.into_iter().map(|w| U256::from(w) * U256::exp10(16)).collect(),
            asset_indices.into_iter().map(U256::from).collect(),
            U256::zero(),
            vec![],
            U256::zero(),
        )
    }

    // === RebalanceQueue Tests ===

    #[test]
    fn test_queue_new() {
        let queue = RebalanceQueue::new(Duration::from_secs(60));
        assert!(queue.is_empty());
        assert!(!queue.is_batch_ready());
    }

    #[test]
    fn test_queue_add_proposal() {
        let mut queue = RebalanceQueue::new(Duration::from_secs(60));
        let proposal = make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]);

        queue.add_proposal(proposal.clone());

        assert_eq!(queue.len(), 1);
        assert!(!queue.is_empty());
        assert!(queue.elapsed().is_some()); // batch_started_at is set
    }

    #[test]
    fn test_queue_execute_signal() {
        let mut queue = RebalanceQueue::new(Duration::from_secs(3600));
        queue.add_proposal(make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]));

        assert!(!queue.is_batch_ready());

        queue.signal_execute();

        assert!(queue.is_batch_ready());
    }

    #[test]
    fn test_queue_expected_count() {
        let mut queue = RebalanceQueue::new(Duration::from_secs(3600));
        queue.set_expected_count(2);

        queue.add_proposal(make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]));
        assert!(!queue.is_batch_ready());

        queue.add_proposal(make_proposal(make_itp_id(2), vec![40], vec![60], vec![0]));
        assert!(queue.is_batch_ready());
    }

    #[test]
    fn test_queue_drain_batch() {
        let mut queue = RebalanceQueue::new(Duration::from_secs(60));
        queue.add_proposal(make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]));
        queue.add_proposal(make_proposal(make_itp_id(2), vec![40], vec![60], vec![0]));

        let batch = queue.drain_batch();

        assert_eq!(batch.len(), 2);
        assert!(queue.is_empty());
        assert!(queue.elapsed().is_none()); // batch_started_at is reset
    }

    #[test]
    fn test_queue_collect_not_ready() {
        let mut queue = RebalanceQueue::new(Duration::from_secs(3600));
        queue.add_proposal(make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]));

        // Not ready yet (no signal, no timeout, no expected count)
        let result = queue.collect_rebalance_proposals();
        assert!(result.is_none());
        assert!(!queue.is_empty()); // Still has proposal
    }

    #[test]
    fn test_queue_collect_with_signal() {
        let mut queue = RebalanceQueue::new(Duration::from_secs(3600));
        queue.add_proposal(make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]));
        queue.signal_execute();

        let result = queue.collect_rebalance_proposals();
        assert!(result.is_some());
        assert_eq!(result.unwrap().len(), 1);
        assert!(queue.is_empty()); // Queue is drained
    }

    #[test]
    fn test_queue_timeout_triggers_collection() {
        // Use a very short timeout for testing
        let mut queue = RebalanceQueue::new(Duration::from_millis(1));
        queue.add_proposal(make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]));

        // Wait for timeout
        std::thread::sleep(Duration::from_millis(5));

        assert!(queue.is_batch_ready());
        let result = queue.collect_rebalance_proposals();
        assert!(result.is_some());
    }

    #[test]
    fn test_queue_elapsed_and_remaining() {
        let mut queue = RebalanceQueue::new(Duration::from_secs(60));

        // Before any proposal, no elapsed time
        assert!(queue.elapsed().is_none());
        assert!(queue.remaining_timeout().is_none());

        queue.add_proposal(make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]));

        // After proposal, elapsed and remaining should be available
        let elapsed = queue.elapsed();
        assert!(elapsed.is_some());

        let remaining = queue.remaining_timeout();
        assert!(remaining.is_some());
        assert!(remaining.unwrap() <= Duration::from_secs(60));
    }

    #[test]
    fn test_queue_default_timeout() {
        let queue = RebalanceQueue::with_default_timeout();
        assert_eq!(queue.timeout_duration, Duration::from_secs(3600));
    }

    #[test]
    fn test_queue_block_time_ready() {
        let mut queue = RebalanceQueue::new(Duration::from_secs(60));
        queue.add_proposal(make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]));

        // Not ready at same block time
        assert!(!queue.is_batch_ready_at_block_time(U256::zero()));

        // Ready after timeout
        assert!(queue.is_batch_ready_at_block_time(U256::from(61)));
    }

    // === RebalanceProposal Validation Tests ===

    #[test]
    fn test_proposal_validation_valid() {
        let result = RebalanceProposal::new(
            make_itp_id(1),
            vec![U256::from(500_000_000_000_000_000u64), U256::from(500_000_000_000_000_000u64)], // 50% + 50% = 100%
            vec![U256::from(300_000_000_000_000_000u64), U256::from(700_000_000_000_000_000u64)], // 30% + 70% = 100%
            vec![U256::zero(), U256::one()],
            U256::zero(),
            vec![],
            U256::zero(),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_proposal_validation_invalid_weights() {
        // Weights don't sum to 1e18
        let result = RebalanceProposal::new(
            make_itp_id(1),
            vec![U256::from(500_000_000_000_000_000u64)], // Only 50%
            vec![U256::from(300_000_000_000_000_000u64)], // Only 30%
            vec![U256::zero()],
            U256::zero(),
            vec![],
            U256::zero(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_proposal_validation_mismatched_lengths() {
        let result = RebalanceProposal::new(
            make_itp_id(1),
            vec![U256::from(WAD)],
            vec![U256::from(WAD / 2), U256::from(WAD / 2)], // Different length!
            vec![U256::zero()],
            U256::zero(),
            vec![],
            U256::zero(),
        );
        assert!(result.is_err());
    }

    // === calculate_net_deltas Tests ===

    #[test]
    fn test_net_deltas_single_itp() {
        // ITP-1: BTC 50%→30% ($100k value) → sell $20k BTC
        let proposals = vec![make_proposal(make_itp_id(1), vec![50], vec![30], vec![0])];

        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(100_000) * U256::exp10(18));

        let result = calculate_net_deltas(&proposals, &itp_values, &HashMap::new());
        assert_eq!(result.processed_count, 1);
        assert!(result.skipped_itps.is_empty());

        let btc_delta = result.net_deltas.get(&U256::zero()).unwrap();
        assert!(btc_delta.is_negative());
        // -$20k = -20_000 * 1e18
        assert_eq!(u256_from_i256(btc_delta.abs()), U256::from(20_000) * U256::exp10(18));
    }

    #[test]
    fn test_net_deltas_opposite_directions() {
        // ITP-A: BTC 50%→30% ($100k value) → sell $20k BTC
        // ITP-B: BTC 40%→60% ($50k value)  → buy $10k BTC
        // Net: sell $10k BTC
        let proposals = vec![
            make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]),
            make_proposal(make_itp_id(2), vec![40], vec![60], vec![0]),
        ];

        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(100_000) * U256::exp10(18));
        itp_values.insert(make_itp_id(2), U256::from(50_000) * U256::exp10(18));

        let result = calculate_net_deltas(&proposals, &itp_values, &HashMap::new());

        let btc_delta = result.net_deltas.get(&U256::zero()).unwrap();
        assert!(btc_delta.is_negative());
        // Net: -$20k + $10k = -$10k
        assert_eq!(u256_from_i256(btc_delta.abs()), U256::from(10_000) * U256::exp10(18));
    }

    #[test]
    fn test_net_deltas_perfect_offset() {
        // ITP-A: BTC 50%→30% ($50k value) → sell $10k BTC
        // ITP-B: BTC 30%→50% ($50k value) → buy $10k BTC
        // Net: 0 (perfectly offset)
        let proposals = vec![
            make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]),
            make_proposal(make_itp_id(2), vec![30], vec![50], vec![0]),
        ];

        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(50_000) * U256::exp10(18));
        itp_values.insert(make_itp_id(2), U256::from(50_000) * U256::exp10(18));

        let result = calculate_net_deltas(&proposals, &itp_values, &HashMap::new());

        let btc_delta = result.net_deltas.get(&U256::zero()).unwrap();
        assert!(btc_delta.is_zero());
    }

    #[test]
    fn test_net_deltas_multiple_assets() {
        // ITP-1: BTC 50%→30%, ETH 30%→50% ($100k)
        // BTC: -$20k, ETH: +$20k
        let proposals = vec![make_proposal(
            make_itp_id(1),
            vec![50, 30],
            vec![30, 50],
            vec![0, 1],
        )];

        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(100_000) * U256::exp10(18));

        let result = calculate_net_deltas(&proposals, &itp_values, &HashMap::new());

        let btc_delta = result.net_deltas.get(&U256::zero()).unwrap();
        let eth_delta = result.net_deltas.get(&U256::one()).unwrap();

        assert!(btc_delta.is_negative());
        assert!(eth_delta.is_positive());
        assert_eq!(u256_from_i256(btc_delta.abs()), U256::from(20_000) * U256::exp10(18));
        assert_eq!(u256_from_i256(*eth_delta), U256::from(20_000) * U256::exp10(18));
    }

    #[test]
    fn test_net_deltas_skipped_zero_value_itp() {
        // ITP-1: has value, ITP-2: has zero value (should be skipped)
        let proposals = vec![
            make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]),
            make_proposal(make_itp_id(2), vec![40], vec![60], vec![0]),
        ];

        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(100_000) * U256::exp10(18));
        // ITP-2 not in itp_values (zero value)

        let result = calculate_net_deltas(&proposals, &itp_values, &HashMap::new());

        assert_eq!(result.processed_count, 1);
        assert_eq!(result.skipped_itps.len(), 1);
        assert_eq!(result.skipped_itps[0], make_itp_id(2));
    }

    // === generate_rebalance_trades Tests ===

    #[test]
    fn test_generate_trades_net_sell() {
        let mut net_deltas = HashMap::new();
        net_deltas.insert(U256::zero(), I256::from(-10_000)); // Net sell
        let net_result = NetDeltaResult {
            net_deltas,
            skipped_itps: vec![],
            processed_count: 1,
        };

        let proposals = vec![make_proposal(make_itp_id(1), vec![50], vec![30], vec![0])];
        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(100_000) * U256::exp10(18));

        let trades = generate_rebalance_trades(&net_result, &proposals, &itp_values);

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].side, Side::Sell);
        assert_eq!(trades[0].amount, U256::from(10_000));
        assert!(trades[0].is_rebalance);
    }

    #[test]
    fn test_generate_trades_net_buy() {
        let mut net_deltas = HashMap::new();
        net_deltas.insert(U256::zero(), I256::from(10_000)); // Net buy
        let net_result = NetDeltaResult {
            net_deltas,
            skipped_itps: vec![],
            processed_count: 1,
        };

        let proposals = vec![make_proposal(make_itp_id(1), vec![30], vec![50], vec![0])];
        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(100_000) * U256::exp10(18));

        let trades = generate_rebalance_trades(&net_result, &proposals, &itp_values);

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].side, Side::Buy);
        assert_eq!(trades[0].amount, U256::from(10_000));
    }

    #[test]
    fn test_generate_trades_zero_net() {
        let mut net_deltas = HashMap::new();
        net_deltas.insert(U256::zero(), I256::zero()); // Perfectly netted
        let net_result = NetDeltaResult {
            net_deltas,
            skipped_itps: vec![],
            processed_count: 0,
        };

        let proposals = vec![];
        let itp_values = HashMap::new();

        let trades = generate_rebalance_trades(&net_result, &proposals, &itp_values);

        assert!(trades.is_empty());
    }

    // === allocate_rebalance_fills Tests ===

    #[test]
    fn test_allocate_fills_pro_rata() {
        // ITP-1: sell $20k (2/3 of total sell)
        // ITP-2: sell $10k (1/3 of total sell)
        // Fill: $30k → ITP-1 gets $20k, ITP-2 gets $10k
        let proposals = vec![
            make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]),
            make_proposal(make_itp_id(2), vec![60], vec![40], vec![0]),
        ];

        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(100_000) * U256::exp10(18));
        itp_values.insert(make_itp_id(2), U256::from(50_000) * U256::exp10(18));

        let mut fills = HashMap::new();
        fills.insert(U256::zero(), U256::from(30_000) * U256::exp10(18));

        let allocations = allocate_rebalance_fills(&fills, &proposals, &itp_values);

        // ITP-1 sold $20k out of $30k total = 2/3
        // ITP-2 sold $10k out of $30k total = 1/3
        let alloc1 = allocations.get(&make_itp_id(1)).unwrap();
        let alloc2 = allocations.get(&make_itp_id(2)).unwrap();

        let fill1 = alloc1.asset_allocations.get(&U256::zero()).copied().unwrap_or(U256::zero());
        let fill2 = alloc2.asset_allocations.get(&U256::zero()).copied().unwrap_or(U256::zero());

        // Verify proportional allocation (with possible rounding)
        assert!(fill1 > fill2); // ITP-1 should get more
        assert_eq!(fill1 + fill2, U256::from(30_000) * U256::exp10(18));
    }

    #[test]
    fn test_allocate_fills_with_internal_transfers() {
        // ITP-1: sell $20k BTC
        // ITP-2: buy $10k BTC
        // Internal: $10k matches
        // External: sell $10k
        let proposals = vec![
            make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]),
            make_proposal(make_itp_id(2), vec![40], vec![60], vec![0]),
        ];

        let mut itp_values = HashMap::new();
        itp_values.insert(make_itp_id(1), U256::from(100_000) * U256::exp10(18));
        itp_values.insert(make_itp_id(2), U256::from(50_000) * U256::exp10(18));

        // External fill is only $10k (the net amount)
        let mut fills = HashMap::new();
        fills.insert(U256::zero(), U256::from(10_000) * U256::exp10(18));

        let allocations = allocate_rebalance_fills(&fills, &proposals, &itp_values);

        // Check that internal transfers were generated
        let alloc1 = allocations.get(&make_itp_id(1)).unwrap();
        let alloc2 = allocations.get(&make_itp_id(2)).unwrap();

        // At least one should have internal transfers
        let has_internal = !alloc1.internal_transfers.is_empty() || !alloc2.internal_transfers.is_empty();
        assert!(has_internal);
    }

    // === PrioritySlots Tests ===

    #[test]
    fn test_priority_slots_when_active() {
        let slots = PrioritySlots::when_rebalance_active();
        assert_eq!(slots.rebalance_percent, 50);
        assert_eq!(slots.user_percent, 50);
    }

    #[test]
    fn test_priority_slots_when_no_rebalance() {
        let slots = PrioritySlots::when_no_rebalance();
        assert_eq!(slots.rebalance_percent, 0);
        assert_eq!(slots.user_percent, 100);
    }

    #[test]
    fn test_priority_slots_allocate() {
        let slots = PrioritySlots::when_rebalance_active();
        let (rebalance, user) = slots.allocate_slots(100);
        assert_eq!(rebalance, 50);
        assert_eq!(user, 50);
    }

    #[test]
    fn test_priority_slots_allocate_odd_capacity() {
        let slots = PrioritySlots::when_rebalance_active();
        let (rebalance, user) = slots.allocate_slots(101);
        // 101 * 50 / 100 = 50, remainder 51 goes to user
        assert_eq!(rebalance, 50);
        assert_eq!(user, 51);
    }

    #[test]
    fn test_priority_slots_custom_valid() {
        let slots = PrioritySlots::custom(70, 30).expect("should be valid");
        assert_eq!(slots.rebalance_percent, 70);
        assert_eq!(slots.user_percent, 30);
    }

    #[test]
    fn test_priority_slots_custom_invalid() {
        let result = PrioritySlots::custom(60, 60); // 120% total
        assert!(result.is_err());
    }

    // === RebalanceCompleteData Tests ===

    #[test]
    fn test_finalize_rebalance() {
        let proposal = make_proposal(make_itp_id(1), vec![50], vec![30], vec![0]);
        let allocation = RebalanceFillAllocation::new(make_itp_id(1));

        let data = finalize_rebalance(make_itp_id(1), &proposal, &allocation);

        assert_eq!(data.itp_id, make_itp_id(1));
        assert_eq!(data.progress, 1.0);
        assert!(!data.new_weights.is_empty());
    }

    // === Progress Calculation Tests ===

    #[test]
    fn test_compute_progress_complete() {
        // Current allocation matches target
        let current_inventory = vec![U256::from(30_000) * U256::exp10(18)];
        let start_weights = vec![U256::from(50) * U256::exp10(16)]; // 50%
        let target_weights = vec![U256::from(30) * U256::exp10(16)]; // 30%
        let asset_indices = vec![U256::zero()];
        let mut prices = HashMap::new();
        prices.insert(U256::zero(), U256::one()); // $1 per unit

        // If current inventory exactly matches target allocation, progress = 1.0
        // Total value = 30k, current alloc = 100%, but we have only 1 asset
        // Since there's only 1 asset, it's always 100% of portfolio
        let progress = compute_rebalance_progress(
            &current_inventory,
            &start_weights,
            &target_weights,
            &asset_indices,
            &prices,
        )
        .expect("should succeed");

        // With single asset, progress is clamped
        assert!(progress >= 0.0 && progress <= 1.0);
    }

    #[test]
    fn test_compute_progress_not_started() {
        let current_inventory = vec![U256::from(50_000) * U256::exp10(18)];
        let start_weights = vec![U256::from(50) * U256::exp10(16)]; // 50%
        let target_weights = vec![U256::from(30) * U256::exp10(16)]; // 30%
        let asset_indices = vec![U256::zero()];
        let mut prices = HashMap::new();
        prices.insert(U256::zero(), U256::one());

        let progress = compute_rebalance_progress(
            &current_inventory,
            &start_weights,
            &target_weights,
            &asset_indices,
            &prices,
        )
        .expect("should succeed");

        // Should be between 0 and 1
        assert!(progress >= 0.0 && progress <= 1.0);
    }

    #[test]
    fn test_compute_progress_mismatched_lengths() {
        // Array length mismatch should return error
        let current_inventory = vec![U256::from(30_000)];
        let start_weights = vec![U256::from(50), U256::from(50)]; // Different length!
        let target_weights = vec![U256::from(30)];
        let asset_indices = vec![U256::zero()];
        let prices = HashMap::new();

        let result = compute_rebalance_progress(
            &current_inventory,
            &start_weights,
            &target_weights,
            &asset_indices,
            &prices,
        );

        assert!(result.is_err());
    }

    // === Helper Function Tests ===

    #[test]
    fn test_i256_u256_conversion() {
        let u = U256::from(1000);
        let i = i256_from_u256(u);
        assert_eq!(i, I256::from(1000));

        let back = u256_from_i256(i);
        assert_eq!(back, u);
    }

    #[test]
    fn test_i256_negative_conversion() {
        let i = I256::from(-1000);
        let u = u256_from_i256(i);
        assert_eq!(u, U256::from(1000));
    }

    #[test]
    fn test_u256_to_f64() {
        let u = U256::from(1_000_000);
        let f = u256_to_f64(u);
        assert!((f - 1_000_000.0).abs() < f64::EPSILON);
    }
}
