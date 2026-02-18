//! Liquidation bot — async state machine for self-funding liquidation
//!
//! The curator bot uses a USDC reserve to:
//! 1. Push oracle price + push rate
//! 2. Call morpho.liquidate() — repay debt, seize ITP collateral
//! 3. Sell seized ITP on Index.sol (submitOrder SELL)
//! 4. Wait for fill → recover USDC → loop if position still underwater
//!
//! Up to 5 concurrent liquidation slots, USDC budget partitioned per slot.

use ethers::prelude::*;
use ethers::types::{Address, H256, U256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use thiserror::Error;
use tracing::info;

/// Errors from the liquidation bot
#[derive(Debug, Error)]
pub enum LiquidatorError {
    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Transaction failed: {0}")]
    Transaction(String),

    #[error("No free liquidation slots")]
    NoFreeSlots,

    #[error("Insufficient reserve: need {need}, have {have}")]
    InsufficientReserve { need: U256, have: U256 },

    #[error("Unprofitable liquidation: cost {cost}, recovery {recovery}")]
    Unprofitable { cost: U256, recovery: U256 },
}

/// State of a single liquidation slot
#[derive(Debug, Clone, PartialEq)]
pub enum LiquidationState {
    /// Ready for new liquidation
    Ready,
    /// Morpho.liquidate() called, ITP seized, now need to sell
    PendingSell {
        seized_itp: U256,
        order_id: Option<U256>,
    },
    /// Sell order submitted on Index.sol, waiting for fill
    WaitingFill {
        order_id: U256,
        submitted_at: Instant,
        deadline: Instant,
        retry_count: u8,
    },
    /// USDC recovered from sell
    Recovered {
        recovered_usdc: U256,
    },
    /// Failed — requires manual intervention
    Failed {
        reason: String,
    },
}

/// A single liquidation slot tracking one borrower
#[derive(Debug, Clone)]
pub struct LiquidationSlot {
    pub state: LiquidationState,
    /// Borrower being liquidated
    pub borrower: Address,
    /// Morpho market ID
    pub market_id: [u8; 32],
    /// USDC budget for this slot
    pub usdc_budget: U256,
    /// Total ITP seized in this liquidation
    pub seized_itp: U256,
    /// Iteration count (for retry cascade)
    pub iteration: u8,
    /// Total USDC spent on repayments
    pub total_repaid: U256,
    /// Total USDC recovered from sells
    pub total_recovered: U256,
}

impl LiquidationSlot {
    pub fn new(borrower: Address, market_id: [u8; 32], budget: U256) -> Self {
        Self {
            state: LiquidationState::Ready,
            borrower,
            market_id,
            usdc_budget: budget,
            seized_itp: U256::zero(),
            iteration: 0,
            total_repaid: U256::zero(),
            total_recovered: U256::zero(),
        }
    }

    /// Check if this liquidation is profitable so far
    pub fn is_profitable(&self) -> bool {
        self.total_recovered > self.total_repaid
    }

    /// Net profit (or loss)
    pub fn net_pnl(&self) -> (bool, U256) {
        if self.total_recovered >= self.total_repaid {
            (true, self.total_recovered - self.total_repaid)
        } else {
            (false, self.total_repaid - self.total_recovered)
        }
    }
}

/// Configuration for the liquidation manager
#[derive(Debug, Clone)]
pub struct LiquidatorConfig {
    /// Maximum concurrent liquidation slots
    pub max_concurrent: usize,
    /// Index.sol contract address (for sell orders)
    pub index_address: Address,
    /// Morpho Blue address
    pub morpho_address: Address,
    /// Default sell limit price as fraction of NAV (e.g., 0.97 = 3% below NAV)
    pub sell_limit_fraction_bps: u64,
    /// Sell order deadline in seconds
    pub sell_deadline_secs: u64,
    /// Maximum retry count for sell orders
    pub max_sell_retries: u8,
    /// Slippage tolerance in bps for profitability check
    pub slippage_tolerance_bps: u64,
}

impl Default for LiquidatorConfig {
    fn default() -> Self {
        Self {
            max_concurrent: 5,
            index_address: Address::zero(),
            morpho_address: Address::zero(),
            sell_limit_fraction_bps: 9700, // 97% of NAV (3% below)
            sell_deadline_secs: 600,        // 10 minutes
            max_sell_retries: 3,
            slippage_tolerance_bps: 300,    // 3%
        }
    }
}

/// Per-market hourly volume tracking for cascading liquidation protection
#[derive(Debug, Clone)]
pub struct MarketVolumeTracker {
    /// Market total collateral (refreshed periodically)
    pub total_collateral: U256,
    /// Volume liquidated in the current hour window
    pub volume_this_hour: U256,
    /// Hour window start timestamp
    pub window_start: Instant,
}

impl MarketVolumeTracker {
    pub fn new(total_collateral: U256) -> Self {
        Self {
            total_collateral,
            volume_this_hour: U256::zero(),
            window_start: Instant::now(),
        }
    }

    /// Max liquidation volume per hour: 20% of market's total collateral
    pub fn max_hourly_volume(&self) -> U256 {
        self.total_collateral * U256::from(20u64) / U256::from(100u64)
    }

    /// Check if additional liquidation volume is allowed
    pub fn can_liquidate(&self, amount: U256) -> bool {
        // Reset window if hour elapsed
        if self.window_start.elapsed() > Duration::from_secs(3600) {
            return amount <= self.max_hourly_volume();
        }
        self.volume_this_hour + amount <= self.max_hourly_volume()
    }

    /// Record liquidation volume (call after successful liquidation)
    pub fn record_volume(&mut self, amount: U256) {
        // Reset window if hour elapsed
        if self.window_start.elapsed() > Duration::from_secs(3600) {
            self.volume_this_hour = U256::zero();
            self.window_start = Instant::now();
        }
        self.volume_this_hour = self.volume_this_hour + amount;
    }
}

/// Manages parallel liquidation slots
pub struct LiquidationManager {
    config: LiquidatorConfig,
    /// Active liquidation slots
    slots: Vec<Option<LiquidationSlot>>,
    /// Total USDC reserve available
    reserve_balance: U256,
    /// Per-market hourly volume tracking (market_id → tracker)
    volume_trackers: HashMap<[u8; 32], MarketVolumeTracker>,
}

impl LiquidationManager {
    pub fn new(config: LiquidatorConfig, initial_reserve: U256) -> Self {
        let max = config.max_concurrent;
        Self {
            config,
            slots: vec![None; max],
            reserve_balance: initial_reserve,
            volume_trackers: HashMap::new(),
        }
    }

    /// Set total collateral for a market (call periodically from health monitor data)
    pub fn set_market_collateral(&mut self, market_id: [u8; 32], total_collateral: U256) {
        self.volume_trackers
            .entry(market_id)
            .and_modify(|t| t.total_collateral = total_collateral)
            .or_insert_with(|| MarketVolumeTracker::new(total_collateral));
    }

    /// Check if liquidation volume is allowed for a market
    pub fn can_liquidate_volume(&self, market_id: &[u8; 32], amount: U256) -> bool {
        match self.volume_trackers.get(market_id) {
            Some(tracker) => tracker.can_liquidate(amount),
            None => true, // No tracker = no cap (market not yet registered)
        }
    }

    /// Record liquidation volume for a market
    pub fn record_liquidation_volume(&mut self, market_id: [u8; 32], amount: U256) {
        if let Some(tracker) = self.volume_trackers.get_mut(&market_id) {
            tracker.record_volume(amount);
        }
    }

    /// Get the budget per slot (reserve / max_concurrent)
    pub fn budget_per_slot(&self) -> U256 {
        if self.config.max_concurrent == 0 {
            return U256::zero();
        }
        self.reserve_balance / U256::from(self.config.max_concurrent)
    }

    /// Find a free slot index
    pub fn find_free_slot(&self) -> Option<usize> {
        self.slots.iter().position(|s| s.is_none())
    }

    /// Count active (non-None) slots
    pub fn active_count(&self) -> usize {
        self.slots.iter().filter(|s| s.is_some()).count()
    }

    /// Assign a new liquidation to a free slot
    pub fn assign_slot(
        &mut self,
        borrower: Address,
        market_id: [u8; 32],
    ) -> Result<usize, LiquidatorError> {
        let slot_idx = self.find_free_slot().ok_or(LiquidatorError::NoFreeSlots)?;
        let budget = self.budget_per_slot();

        if budget.is_zero() {
            return Err(LiquidatorError::InsufficientReserve {
                need: U256::from(1u64),
                have: self.reserve_balance,
            });
        }

        self.slots[slot_idx] = Some(LiquidationSlot::new(borrower, market_id, budget));

        info!(
            slot = slot_idx,
            borrower = ?borrower,
            budget = %budget,
            "Assigned liquidation slot"
        );

        Ok(slot_idx)
    }

    /// Release a slot and return recovered USDC to reserve
    pub fn release_slot(&mut self, slot_idx: usize) {
        if let Some(slot) = self.slots[slot_idx].take() {
            // Return recovered USDC to reserve
            self.reserve_balance = self.reserve_balance + slot.total_recovered;
            let (profitable, pnl) = slot.net_pnl();
            info!(
                slot = slot_idx,
                borrower = ?slot.borrower,
                repaid = %slot.total_repaid,
                recovered = %slot.total_recovered,
                profitable = profitable,
                pnl = %pnl,
                "Released liquidation slot"
            );
        }
    }

    /// Get mutable reference to a slot
    pub fn get_slot_mut(&mut self, idx: usize) -> Option<&mut LiquidationSlot> {
        self.slots[idx].as_mut()
    }

    /// Get reference to a slot
    pub fn get_slot(&self, idx: usize) -> Option<&LiquidationSlot> {
        self.slots[idx].as_ref()
    }

    /// Check if estimated recovery is profitable after slippage
    pub fn is_profitable_liquidation(
        seized_value: U256,
        cost: U256,
        slippage_bps: u64,
    ) -> bool {
        if cost.is_zero() {
            return true;
        }
        // estimated_recovery = seized_value * (10000 - slippage_bps) / 10000
        let recovery = seized_value * U256::from(10000u64 - slippage_bps) / U256::from(10000u64);
        recovery > cost
    }

    /// Scan positions and identify liquidatable ones (HF < 1.0)
    /// Returns: vec of (borrower, market_id, debt_amount, collateral_value)
    pub fn filter_liquidatable(
        positions: &[(Address, [u8; 32], U256, U256, U256)], // (borrower, market_id, debt, collateral_value, health_factor_wad)
    ) -> Vec<(Address, [u8; 32])> {
        let wad = U256::from(1_000_000_000_000_000_000u64);
        positions
            .iter()
            .filter(|(_, _, _, _, hf)| *hf < wad) // HF < 1.0
            .map(|(borrower, market_id, _, _, _)| (*borrower, *market_id))
            .collect()
    }

    /// Get reference to reserve balance
    pub fn reserve_balance(&self) -> U256 {
        self.reserve_balance
    }
}

/// On-chain liquidation executor — sends transactions to Morpho and Index.sol
///
/// Pattern follows OraclePusher.push_price() and AllocationBot.execute_reallocate().
pub struct LiquidationExecutor {
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,
    morpho_address: Address,
    index_address: Address,
}

impl LiquidationExecutor {
    pub fn new(
        rpc_url: &str,
        private_key: &str,
        morpho_address: Address,
        index_address: Address,
    ) -> Result<Self, LiquidatorError> {
        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| LiquidatorError::Provider(format!("Failed to create provider: {}", e)))?;

        let wallet: LocalWallet = private_key
            .parse()
            .map_err(|e| LiquidatorError::Provider(format!("Failed to parse private key: {}", e)))?;

        Ok(Self {
            provider: Arc::new(provider),
            wallet,
            morpho_address,
            index_address,
        })
    }

    /// Call morpho.liquidate(MarketParams, borrower, seizedAssets, shares, data)
    /// Returns tx hash on success.
    pub async fn liquidate(
        &self,
        market_params: MarketParamsEncoded,
        borrower: Address,
        seized_assets: U256,
        repaid_shares: U256,
    ) -> Result<H256, LiquidatorError> {
        // morpho.liquidate((address,address,address,address,uint256),address,uint256,uint256,bytes)
        let selector = &ethers::utils::keccak256(
            b"liquidate((address,address,address,address,uint256),address,uint256,uint256,bytes)",
        )[..4];

        let market_params_token = ethers::abi::Token::Tuple(vec![
            ethers::abi::Token::Address(market_params.loan_token),
            ethers::abi::Token::Address(market_params.collateral_token),
            ethers::abi::Token::Address(market_params.oracle),
            ethers::abi::Token::Address(market_params.irm),
            ethers::abi::Token::Uint(market_params.lltv),
        ]);

        let encoded = ethers::abi::encode(&[
            market_params_token,
            ethers::abi::Token::Address(borrower),
            ethers::abi::Token::Uint(seized_assets),
            ethers::abi::Token::Uint(repaid_shares),
            ethers::abi::Token::Bytes(vec![]),
        ]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded);

        self.send_tx(self.morpho_address, calldata).await
    }

    /// Call Index.submitOrder(itpId, side=SELL, amount, limitPrice, slippage, deadline)
    pub async fn submit_sell_order(
        &self,
        itp_id: [u8; 32],
        amount: U256,
        limit_price_bps: u64,
        slippage_tier: u64,
        deadline: U256,
    ) -> Result<H256, LiquidatorError> {
        // submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)
        let selector = &ethers::utils::keccak256(
            b"submitOrder(bytes32,uint8,uint256,uint256,uint256,uint256)",
        )[..4];

        let encoded = ethers::abi::encode(&[
            ethers::abi::Token::FixedBytes(itp_id.to_vec()),
            ethers::abi::Token::Uint(U256::from(1u64)), // Side.SELL = 1
            ethers::abi::Token::Uint(amount),
            ethers::abi::Token::Uint(U256::from(limit_price_bps)),
            ethers::abi::Token::Uint(U256::from(slippage_tier)),
            ethers::abi::Token::Uint(deadline),
        ]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded);

        self.send_tx(self.index_address, calldata).await
    }

    /// Call Index.refundExpiredOrder(itpId, orderId)
    pub async fn refund_expired_order(
        &self,
        itp_id: [u8; 32],
        order_id: U256,
    ) -> Result<H256, LiquidatorError> {
        let selector =
            &ethers::utils::keccak256(b"refundExpiredOrder(bytes32,uint256)")[..4];

        let encoded = ethers::abi::encode(&[
            ethers::abi::Token::FixedBytes(itp_id.to_vec()),
            ethers::abi::Token::Uint(order_id),
        ]);

        let mut calldata = selector.to_vec();
        calldata.extend_from_slice(&encoded);

        self.send_tx(self.index_address, calldata).await
    }

    /// Internal: send a transaction
    async fn send_tx(&self, to: Address, calldata: Vec<u8>) -> Result<H256, LiquidatorError> {
        let chain_id = self
            .provider
            .get_chainid()
            .await
            .map_err(|e| LiquidatorError::Provider(format!("Failed to get chain ID: {}", e)))?;

        let wallet = self.wallet.clone().with_chain_id(chain_id.as_u64());
        let client = SignerMiddleware::new(self.provider.clone(), wallet);

        let tx = ethers::types::TransactionRequest::new()
            .to(to)
            .data(calldata);

        let pending_tx = client
            .send_transaction(tx, None)
            .await
            .map_err(|e| LiquidatorError::Transaction(format!("Failed to send: {}", e)))?;

        let tx_hash = pending_tx.tx_hash();

        let receipt = tokio::time::timeout(Duration::from_secs(120), pending_tx)
            .await
            .map_err(|_| LiquidatorError::Transaction("Transaction timeout (120s)".to_string()))?
            .map_err(|e| LiquidatorError::Transaction(format!("Receipt error: {}", e)))?;

        match receipt {
            Some(r) if r.status == Some(1.into()) => Ok(tx_hash),
            Some(_) => Err(LiquidatorError::Transaction(format!(
                "Transaction reverted: tx={}",
                tx_hash
            ))),
            None => Err(LiquidatorError::Transaction(format!(
                "No receipt for tx={}",
                tx_hash
            ))),
        }
    }
}

/// Encoded Morpho market params for ABI encoding
#[derive(Debug, Clone)]
pub struct MarketParamsEncoded {
    pub loan_token: Address,
    pub collateral_token: Address,
    pub oracle: Address,
    pub irm: Address,
    pub lltv: U256,
}

impl LiquidationManager {
    /// Get sell parameters for retry cascade
    pub fn sell_params_for_retry(retry_count: u8) -> (u64, u64) {
        match retry_count {
            0 => (9700, 1), // 97% limit, Tier 1 slippage (1%)
            1 => (9500, 2), // 95% limit, Tier 2 slippage (3%)
            _ => (9300, 2), // 93% limit, Tier 2 slippage (3%)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn addr(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    fn market_id(n: u8) -> [u8; 32] {
        let mut id = [0u8; 32];
        id[0] = n;
        id
    }

    #[test]
    fn test_budget_per_slot() {
        let config = LiquidatorConfig {
            max_concurrent: 5,
            ..Default::default()
        };
        let manager = LiquidationManager::new(config, U256::from(50_000u64));
        assert_eq!(manager.budget_per_slot(), U256::from(10_000u64));
    }

    #[test]
    fn test_assign_and_release_slot() {
        let config = LiquidatorConfig {
            max_concurrent: 2,
            ..Default::default()
        };
        let mut manager = LiquidationManager::new(config, U256::from(20_000u64));

        // Assign first slot
        let idx = manager.assign_slot(addr(1), market_id(1)).unwrap();
        assert_eq!(idx, 0);
        assert_eq!(manager.active_count(), 1);

        // Assign second slot
        let idx2 = manager.assign_slot(addr(2), market_id(2)).unwrap();
        assert_eq!(idx2, 1);
        assert_eq!(manager.active_count(), 2);

        // Third should fail (no free slots)
        assert!(manager.assign_slot(addr(3), market_id(3)).is_err());

        // Release first slot
        manager.release_slot(0);
        assert_eq!(manager.active_count(), 1);

        // Now can assign again
        let idx3 = manager.assign_slot(addr(3), market_id(3)).unwrap();
        assert_eq!(idx3, 0);
    }

    #[test]
    fn test_is_profitable_liquidation() {
        // Seized 10,741 USDC worth, cost 10,000 USDC, 1% slippage
        let seized = U256::from(10_741u64);
        let cost = U256::from(10_000u64);
        assert!(LiquidationManager::is_profitable_liquidation(seized, cost, 100));

        // Same but with 10% slippage — not profitable
        assert!(!LiquidationManager::is_profitable_liquidation(seized, cost, 1000));
    }

    #[test]
    fn test_is_profitable_zero_cost() {
        assert!(LiquidationManager::is_profitable_liquidation(
            U256::from(1000u64),
            U256::zero(),
            100
        ));
    }

    #[test]
    fn test_filter_liquidatable() {
        let wad = U256::from(1_000_000_000_000_000_000u64);
        let positions = vec![
            (addr(1), market_id(1), U256::from(100u64), U256::from(200u64), wad * 2), // HF = 2.0 — healthy
            (addr(2), market_id(1), U256::from(100u64), U256::from(90u64), wad * 90 / 100), // HF = 0.9 — liquidatable
            (addr(3), market_id(2), U256::from(100u64), U256::from(100u64), wad), // HF = 1.0 — borderline, not liquidatable
            (addr(4), market_id(2), U256::from(100u64), U256::from(50u64), wad / 2), // HF = 0.5 — liquidatable
        ];

        let liquidatable = LiquidationManager::filter_liquidatable(&positions);
        assert_eq!(liquidatable.len(), 2);
        assert_eq!(liquidatable[0].0, addr(2));
        assert_eq!(liquidatable[1].0, addr(4));
    }

    #[test]
    fn test_sell_params_retry_cascade() {
        let (limit, tier) = LiquidationManager::sell_params_for_retry(0);
        assert_eq!(limit, 9700); // 97%
        assert_eq!(tier, 1);

        let (limit, tier) = LiquidationManager::sell_params_for_retry(1);
        assert_eq!(limit, 9500); // 95%
        assert_eq!(tier, 2);

        let (limit, tier) = LiquidationManager::sell_params_for_retry(2);
        assert_eq!(limit, 9300); // 93%
        assert_eq!(tier, 2);
    }

    #[test]
    fn test_slot_pnl_tracking() {
        let mut slot = LiquidationSlot::new(addr(1), market_id(1), U256::from(10_000u64));
        slot.total_repaid = U256::from(10_000u64);
        slot.total_recovered = U256::from(10_634u64);

        assert!(slot.is_profitable());
        let (profitable, pnl) = slot.net_pnl();
        assert!(profitable);
        assert_eq!(pnl, U256::from(634u64));
    }

    #[test]
    fn test_slot_pnl_loss() {
        let mut slot = LiquidationSlot::new(addr(1), market_id(1), U256::from(10_000u64));
        slot.total_repaid = U256::from(10_000u64);
        slot.total_recovered = U256::from(9_500u64);

        assert!(!slot.is_profitable());
        let (profitable, pnl) = slot.net_pnl();
        assert!(!profitable);
        assert_eq!(pnl, U256::from(500u64));
    }

    #[test]
    fn test_volume_cap_allows_within_limit() {
        let tracker = MarketVolumeTracker::new(U256::from(100_000u64));
        // 20% of 100k = 20k max
        assert!(tracker.can_liquidate(U256::from(20_000u64)));
        assert!(!tracker.can_liquidate(U256::from(20_001u64)));
    }

    #[test]
    fn test_volume_cap_tracks_cumulative() {
        let mut tracker = MarketVolumeTracker::new(U256::from(100_000u64));
        tracker.record_volume(U256::from(15_000u64));
        assert!(tracker.can_liquidate(U256::from(5_000u64))); // 15k + 5k = 20k
        assert!(!tracker.can_liquidate(U256::from(5_001u64))); // 15k + 5001 > 20k
    }

    #[test]
    fn test_volume_cap_manager_integration() {
        let config = LiquidatorConfig {
            max_concurrent: 5,
            ..Default::default()
        };
        let mut manager = LiquidationManager::new(config, U256::from(50_000u64));
        let mid = market_id(1);

        manager.set_market_collateral(mid, U256::from(100_000u64));
        assert!(manager.can_liquidate_volume(&mid, U256::from(20_000u64)));
        manager.record_liquidation_volume(mid, U256::from(20_000u64));
        assert!(!manager.can_liquidate_volume(&mid, U256::from(1u64)));
    }

    #[test]
    fn test_reserve_returns_on_release() {
        let config = LiquidatorConfig {
            max_concurrent: 5,
            ..Default::default()
        };
        let mut manager = LiquidationManager::new(config, U256::from(50_000u64));

        let idx = manager.assign_slot(addr(1), market_id(1)).unwrap();

        // Simulate recovery
        if let Some(slot) = manager.get_slot_mut(idx) {
            slot.total_repaid = U256::from(10_000u64);
            slot.total_recovered = U256::from(10_634u64);
        }

        let initial_reserve = manager.reserve_balance;
        manager.release_slot(idx);

        // Reserve should increase by recovered amount
        assert_eq!(
            manager.reserve_balance,
            initial_reserve + U256::from(10_634u64)
        );
    }
}
