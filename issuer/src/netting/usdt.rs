//! USDT Netting with Depeg Circuit Breaker
//!
//! Nets USDC and USDT order flows to minimize stablecoin swaps.
//!
//! # Algorithm
//!
//! 1. Classify orders by quote currency (USDC vs USDT pairs)
//! 2. Calculate net USDC flow and net USDT flow
//! 3. Return only the net swap amount needed
//! 4. If USDC/USDT depegged (>0.5%), disable netting and alert
//!
//! # Depeg Circuit Breaker
//!
//! ```text
//! Monitor USDC/USDT rate (via 1inch quote)
//! If |1 - rate| > 0.5%:
//!   - DISABLE netting
//!   - Execute all USDT swaps at market rate
//!   - Alert: "DEPEG_DETECTED"
//! Resume when |1 - rate| < 0.3% for 1 hour
//! ```
//!
//! # Quote Token Classification
//!
//! Production uses AssetPairRegistry lookup:
//! - `is_usdt_pair(pair_id, registry)` calls registry.getPair(pair_id) and checks quoteToken
//!
//! Dev/Test fallback (no registry):
//! - First byte >= 0x80 → USDT pair (placeholder heuristic)

use common::types::{LimitOrder, Side};
use ethers::types::{Address, H256, I256, U256};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Well-known USDT addresses on various chains
pub mod usdt_addresses {
    use ethers::types::Address;
    use std::str::FromStr;

    /// USDT on Ethereum mainnet
    pub const ETHEREUM: &str = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    /// USDT on Settlement chain
    pub const SETTLEMENT: &str = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
    /// USDT on Base
    pub const BASE: &str = "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2";
    /// USDT on Optimism
    pub const OPTIMISM: &str = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58";

    /// Check if address is a known USDT address (case-insensitive)
    pub fn is_known_usdt(addr: &Address) -> bool {
        let addr_str = format!("{:?}", addr);
        addr_str.eq_ignore_ascii_case(ETHEREUM)
            || addr_str.eq_ignore_ascii_case(SETTLEMENT)
            || addr_str.eq_ignore_ascii_case(BASE)
            || addr_str.eq_ignore_ascii_case(OPTIMISM)
    }

    /// Parse a USDT address from string
    pub fn parse(chain: &str) -> Option<Address> {
        let addr_str = match chain.to_lowercase().as_str() {
            "ethereum" | "eth" => ETHEREUM,
            "settlement" => SETTLEMENT,
            "base" => BASE,
            "optimism" | "op" => OPTIMISM,
            _ => return None,
        };
        Address::from_str(addr_str.trim_start_matches("0x")).ok()
    }
}

/// Trait for looking up pair quote tokens from a registry
///
/// In production, this is implemented by a ChainReader that queries AssetPairRegistry.
/// For testing, use `MockPairRegistry` or pass `None` to fall back to heuristic.
pub trait PairQuoteLookup: Send + Sync {
    /// Get the quote token address for a pair ID
    ///
    /// Returns None if pair not found or registry unavailable.
    fn get_quote_token(&self, pair_id: H256) -> Option<Address>;
}

/// No-op implementation that always returns None (use heuristic fallback)
#[derive(Default, Clone)]
pub struct NoPairRegistry;

impl PairQuoteLookup for NoPairRegistry {
    fn get_quote_token(&self, _pair_id: H256) -> Option<Address> {
        None
    }
}

/// Threshold for detecting depeg (0.5% = 0.005)
const DEPEG_THRESHOLD: f64 = 0.005;

/// Threshold for resuming netting after depeg (0.3% = 0.003)
const RESUME_THRESHOLD: f64 = 0.003;

/// Duration below resume threshold required before resuming (1 hour)
const RESUME_DURATION: Duration = Duration::from_secs(3600);

/// State tracking for USDT depeg detection
///
/// This state is designed to persist across multiple issuer cycles.
/// The depeg resume logic requires rate stability for 1 hour, which
/// spans many cycles. The NettingEngine maintains this state between
/// calls to `run_netting_pipeline()`.
///
/// # Note
/// Uses `std::time::Instant` which does not survive process restarts.
/// For production, consider persisting depeg state to disk or using
/// block timestamps for time tracking.
#[derive(Debug, Clone)]
pub struct DepegState {
    /// Whether netting is currently disabled due to depeg
    pub is_depegged: bool,
    /// When the depeg was first detected
    pub depegged_since: Option<Instant>,
    /// When rate went below resume threshold
    pub stable_since: Option<Instant>,
    /// Last observed USDC/USDT rate
    pub last_rate: f64,
}

impl Default for DepegState {
    fn default() -> Self {
        Self {
            is_depegged: false,
            depegged_since: None,
            stable_since: None,
            last_rate: 1.0,
        }
    }
}

impl DepegState {
    /// Check if the current rate indicates a depeg condition
    ///
    /// Returns true if |1 - rate| > 0.5%
    pub fn check_depeg(rate: f64) -> bool {
        (1.0 - rate).abs() > DEPEG_THRESHOLD
    }

    /// Check if netting should resume based on rate stability
    ///
    /// Returns true if |1 - rate| < 0.3% for at least 1 hour
    pub fn should_resume_netting(&self, rate: f64) -> bool {
        if !self.is_depegged {
            return false; // Already not depegged
        }

        // Rate must be below resume threshold
        if (1.0 - rate).abs() >= RESUME_THRESHOLD {
            return false;
        }

        // Must have been stable for the required duration
        match self.stable_since {
            Some(since) => since.elapsed() >= RESUME_DURATION,
            None => false,
        }
    }

    /// Update state based on current rate
    ///
    /// Returns true if a DEPEG_DETECTED alert should be emitted
    pub fn update(&mut self, rate: f64) -> bool {
        self.last_rate = rate;
        let now = Instant::now();
        let mut emit_alert = false;

        if Self::check_depeg(rate) {
            // Rate is depegged
            if !self.is_depegged {
                // Transition to depegged state
                self.is_depegged = true;
                self.depegged_since = Some(now);
                self.stable_since = None;
                emit_alert = true;

                tracing::warn!(
                    code = "E010",
                    rate = rate,
                    deviation = format!("{:.2}%", (1.0 - rate).abs() * 100.0),
                    "DEPEG_DETECTED: USDT netting disabled"
                );
            }
            // Reset stable timer since we're depegged
            self.stable_since = None;
        } else if self.is_depegged {
            // Rate is below depeg threshold but we're in depegged state
            let below_resume = (1.0 - rate).abs() < RESUME_THRESHOLD;

            if below_resume {
                // Track when rate went below resume threshold
                if self.stable_since.is_none() {
                    self.stable_since = Some(now);
                }

                // Check if we can resume
                if self.should_resume_netting(rate) {
                    self.is_depegged = false;
                    self.depegged_since = None;
                    self.stable_since = None;

                    tracing::info!(
                        rate = rate,
                        "DEPEG_RECOVERED: USDT netting resumed"
                    );
                }
            } else {
                // Between thresholds - reset stable timer
                self.stable_since = None;
            }
        }

        emit_alert
    }
}

/// Result of USDT netting
#[derive(Debug, Clone)]
pub struct UsdtNettingResult {
    /// Net USDC amount (positive = need more USDC, negative = excess USDC)
    pub net_usdc_flow: I256,
    /// Net USDT amount (positive = need more USDT, negative = excess USDT)
    pub net_usdt_flow: I256,
    /// Whether netting is disabled due to depeg
    pub netting_disabled: bool,
    /// If depeg, all swaps should execute at market rate
    pub swaps_at_market_rate: Vec<StablecoinSwap>,
}

/// A stablecoin swap that bypasses netting (due to depeg)
#[derive(Debug, Clone)]
pub struct StablecoinSwap {
    /// Order ID this swap is for
    pub order_id: U256,
    /// Amount to swap
    pub amount: U256,
    /// From USDC to USDT (true) or USDT to USDC (false)
    pub usdc_to_usdt: bool,
}

/// Perform USDT netting on orders
///
/// Classifies orders by their stablecoin quote currency and calculates
/// net flows. If depegged, returns all swaps without netting.
///
/// # Arguments
///
/// * `orders` - Orders to analyze for USDT/USDC flows
/// * `usdc_usdt_rate` - Current USDC/USDT exchange rate
/// * `depeg_state` - Mutable depeg state to update
///
/// # Returns
///
/// `UsdtNettingResult` with net flows or market-rate swaps if depegged
///
/// # Note
///
/// This implementation uses a simplified classification where pair_id
/// could encode the quote currency. In production, this would need
/// a pair registry lookup.
pub fn usdt_netting(
    orders: &[LimitOrder],
    usdc_usdt_rate: f64,
    depeg_state: &mut DepegState,
) -> UsdtNettingResult {
    // Update depeg state
    let alert_emitted = depeg_state.update(usdc_usdt_rate);
    if alert_emitted {
        // Alert already logged in update()
    }

    if depeg_state.is_depegged {
        // Netting disabled - return all swaps at market rate
        let swaps = extract_stablecoin_swaps(orders);

        tracing::info!(
            swap_count = swaps.len(),
            rate = usdc_usdt_rate,
            "USDT netting disabled due to depeg - executing at market rate"
        );

        return UsdtNettingResult {
            net_usdc_flow: I256::zero(),
            net_usdt_flow: I256::zero(),
            netting_disabled: true,
            swaps_at_market_rate: swaps,
        };
    }

    // Normal operation - calculate net flows
    let (net_usdc_flow, net_usdt_flow) = calculate_net_flows(orders);

    tracing::debug!(
        net_usdc = %net_usdc_flow,
        net_usdt = %net_usdt_flow,
        rate = usdc_usdt_rate,
        "USDT netting calculated"
    );

    UsdtNettingResult {
        net_usdc_flow,
        net_usdt_flow,
        netting_disabled: false,
        swaps_at_market_rate: vec![],
    }
}

/// Perform USDT netting with production pair registry lookup
///
/// This is the production version that uses AssetPairRegistry to determine
/// whether a pair's quote token is USDT. Falls back to heuristic if registry
/// lookup fails.
///
/// # Arguments
///
/// * `orders` - Orders to analyze for USDT/USDC flows
/// * `usdc_usdt_rate` - Current USDC/USDT exchange rate
/// * `depeg_state` - Mutable depeg state to update
/// * `registry` - Pair registry for quote token lookup
///
/// # Returns
///
/// `UsdtNettingResult` with net flows or market-rate swaps if depegged
pub fn usdt_netting_with_registry<R: PairQuoteLookup + ?Sized>(
    orders: &[LimitOrder],
    usdc_usdt_rate: f64,
    depeg_state: &mut DepegState,
    registry: &R,
) -> UsdtNettingResult {
    // Update depeg state
    let alert_emitted = depeg_state.update(usdc_usdt_rate);
    if alert_emitted {
        // Alert already logged in update()
    }

    if depeg_state.is_depegged {
        // Netting disabled - return all swaps at market rate
        let swaps = extract_stablecoin_swaps_with_registry(orders, Some(registry));

        tracing::info!(
            swap_count = swaps.len(),
            rate = usdc_usdt_rate,
            "USDT netting disabled due to depeg - executing at market rate"
        );

        return UsdtNettingResult {
            net_usdc_flow: I256::zero(),
            net_usdt_flow: I256::zero(),
            netting_disabled: true,
            swaps_at_market_rate: swaps,
        };
    }

    // Normal operation - calculate net flows using registry
    let (net_usdc_flow, net_usdt_flow) =
        calculate_net_flows_with_registry(orders, Some(registry));

    tracing::debug!(
        net_usdc = %net_usdc_flow,
        net_usdt = %net_usdt_flow,
        rate = usdc_usdt_rate,
        "USDT netting calculated (with registry)"
    );

    UsdtNettingResult {
        net_usdc_flow,
        net_usdt_flow,
        netting_disabled: false,
        swaps_at_market_rate: vec![],
    }
}

/// Classify whether a pair uses USDT as quote token
///
/// # Arguments
///
/// * `pair_id` - The pair identifier
/// * `registry` - Optional pair registry for production lookup
///
/// # Classification Logic
///
/// 1. If registry provided: lookup pair and check if quoteToken is USDT
/// 2. Fallback (dev/test): first byte >= 0x80 means USDT (placeholder heuristic)
fn is_usdt_pair<R: PairQuoteLookup + ?Sized>(pair_id: H256, registry: Option<&R>) -> bool {
    // Try registry lookup first
    if let Some(reg) = registry {
        if let Some(quote_token) = reg.get_quote_token(pair_id) {
            let is_usdt = usdt_addresses::is_known_usdt(&quote_token);
            tracing::trace!(
                pair_id = %pair_id,
                quote_token = ?quote_token,
                is_usdt,
                "Pair classification from registry"
            );
            return is_usdt;
        }
    }

    // Fallback: placeholder heuristic for dev/test mode
    // First byte >= 0x80 indicates USDT pair (convention for testing)
    let is_usdt = pair_id.as_bytes()[0] >= 0x80;
    if registry.is_some() {
        tracing::warn!(
            code = "E010",
            pair_id = %pair_id,
            "Pair not found in registry, using heuristic fallback"
        );
    }
    is_usdt
}

/// Calculate net USDC and USDT flows from orders
///
/// Returns (net_usdc, net_usdt) where positive means need more, negative means excess
fn calculate_net_flows(orders: &[LimitOrder]) -> (I256, I256) {
    calculate_net_flows_with_registry::<NoPairRegistry>(orders, None)
}

/// Calculate net USDC and USDT flows from orders with optional registry lookup
///
/// Returns (net_usdc, net_usdt) where positive means need more, negative means excess
///
/// # Arguments
///
/// * `orders` - Orders to analyze
/// * `registry` - Optional pair registry for production lookup
fn calculate_net_flows_with_registry<R: PairQuoteLookup + ?Sized>(
    orders: &[LimitOrder],
    registry: Option<&R>,
) -> (I256, I256) {
    let mut usdc_flow = I256::zero();
    let mut usdt_flow = I256::zero();

    for order in orders {
        let is_usdt = is_usdt_pair(order.pair_id, registry);

        // Panic if amount exceeds I256::MAX -- this would flip buy/sell direction
        let i256_amount = I256::try_from(order.amount).unwrap_or_else(|_| {
            panic!(
                "Order amount {} exceeds I256::MAX -- cannot net safely",
                order.amount
            )
        });
        let signed_amount = match order.side {
            Side::Buy => i256_amount,   // Buying = need quote currency
            Side::Sell => -i256_amount, // Selling = excess quote currency
        };

        if is_usdt {
            usdt_flow += signed_amount;
        } else {
            usdc_flow += signed_amount;
        }
    }

    (usdc_flow, usdt_flow)
}

/// Extract stablecoin swaps from orders (for depeg bypass)
fn extract_stablecoin_swaps(orders: &[LimitOrder]) -> Vec<StablecoinSwap> {
    extract_stablecoin_swaps_with_registry::<NoPairRegistry>(orders, None)
}

/// Extract stablecoin swaps from orders with optional registry lookup
fn extract_stablecoin_swaps_with_registry<R: PairQuoteLookup + ?Sized>(
    orders: &[LimitOrder],
    registry: Option<&R>,
) -> Vec<StablecoinSwap> {
    orders
        .iter()
        .filter_map(|order| {
            // Only extract orders that would require stablecoin conversion
            if is_usdt_pair(order.pair_id, registry) {
                Some(StablecoinSwap {
                    order_id: order.id,
                    amount: order.amount,
                    usdc_to_usdt: order.side == Side::Buy, // Buying needs USDT
                })
            } else {
                None
            }
        })
        .collect()
}

// ============ ChainPairRegistry ============

/// On-chain pair registry reader that caches pair→quoteToken mappings.
///
/// Reads from AssetPairRegistry contract (`getActivePairs()` + `getPair(pairId)`).
/// Cache is populated via `refresh()` at startup and periodically.
/// Implements `PairQuoteLookup` for synchronous cache reads.
pub struct ChainPairRegistry {
    /// pairId → quoteToken address
    cache: Arc<RwLock<HashMap<H256, Address>>>,
    /// RPC provider
    provider: Arc<ethers::providers::Provider<ethers::providers::Http>>,
    /// AssetPairRegistry contract address
    registry_address: Address,
}

ethers::contract::abigen!(
    AssetPairRegistryReader,
    r#"[
        function getActivePairs() external view returns (bytes32[] memory)
        function getPair(bytes32 pairId) external view returns (address asset, bytes32 source, address quoteToken, uint256 chainId, uint8 status, uint256 proposedAt, uint256 activatedAt)
    ]"#
);

impl ChainPairRegistry {
    pub fn new(
        provider: Arc<ethers::providers::Provider<ethers::providers::Http>>,
        registry_address: Address,
    ) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            provider,
            registry_address,
        }
    }

    /// Refresh cache by reading all active pairs from on-chain registry.
    /// Returns the number of pairs loaded.
    pub async fn refresh(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let contract = AssetPairRegistryReader::new(
            self.registry_address,
            self.provider.clone(),
        );

        let active_pair_ids = contract.get_active_pairs().call().await?;
        let mut new_cache = HashMap::with_capacity(active_pair_ids.len());

        for pair_id in &active_pair_ids {
            match contract.get_pair(*pair_id).call().await {
                Ok((_asset, _source, quote_token, _chain_id, _status, _proposed_at, _activated_at)) => {
                    // Store as H256 key
                    let key = H256::from(pair_id.clone());
                    new_cache.insert(key, quote_token);
                }
                Err(e) => {
                    tracing::warn!(
                        pair_id = ?pair_id,
                        error = %e,
                        "Failed to fetch pair info, skipping"
                    );
                }
            }
        }

        let count = new_cache.len();
        let mut cache = self.cache.write().await;
        *cache = new_cache;

        tracing::info!(
            pair_count = count,
            registry = ?self.registry_address,
            "ChainPairRegistry refreshed"
        );

        Ok(count)
    }

    /// Get the inner cache arc for spawning periodic refresh tasks.
    pub fn cache_arc(&self) -> Arc<RwLock<HashMap<H256, Address>>> {
        self.cache.clone()
    }
}

impl PairQuoteLookup for ChainPairRegistry {
    fn get_quote_token(&self, pair_id: H256) -> Option<Address> {
        // Synchronous read via try_read — non-blocking
        match self.cache.try_read() {
            Ok(cache) => cache.get(&pair_id).copied(),
            Err(_) => {
                // Cache is being refreshed, return None to trigger heuristic fallback
                tracing::debug!(pair_id = ?pair_id, "ChainPairRegistry cache locked during refresh");
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::OrderStatus;
    use ethers::types::{Address, H256};

    fn create_order_with_pair(id: u64, pair_id: H256, side: Side, amount: u64) -> LimitOrder {
        LimitOrder {
            id: U256::from(id),
            user: Address::zero(),
            pair_id,
            side,
            amount: U256::from(amount),
            limit_price: U256::from(1000_u64) * U256::exp10(18),
            slippage_tier: U256::from(1),
            deadline: U256::from(u64::MAX),
            itp_id: H256::zero(),
            timestamp: U256::from(0),
            status: OrderStatus::Pending,
        }
    }

    /// Create a USDC pair ID (first byte < 0x80)
    fn usdc_pair() -> H256 {
        let mut bytes = [0u8; 32];
        bytes[0] = 0x10; // USDC indicator
        H256::from(bytes)
    }

    /// Create a USDT pair ID (first byte >= 0x80)
    fn usdt_pair() -> H256 {
        let mut bytes = [0u8; 32];
        bytes[0] = 0x80; // USDT indicator
        H256::from(bytes)
    }

    #[test]
    fn test_depeg_detection() {
        // Normal rate
        assert!(!DepegState::check_depeg(1.0));
        assert!(!DepegState::check_depeg(0.996)); // 0.4% off
        assert!(!DepegState::check_depeg(1.004)); // 0.4% off

        // Depegged (> 0.5%)
        assert!(DepegState::check_depeg(0.994)); // 0.6% off
        assert!(DepegState::check_depeg(1.006)); // 0.6% off
        assert!(DepegState::check_depeg(0.95));  // 5% off
    }

    #[test]
    fn test_depeg_state_transition() {
        let mut state = DepegState::default();
        assert!(!state.is_depegged);

        // Depeg detected
        let alert = state.update(0.99); // 1% depeg
        assert!(alert);
        assert!(state.is_depegged);
        assert!(state.depegged_since.is_some());

        // Still depegged - no new alert
        let alert = state.update(0.985);
        assert!(!alert);
        assert!(state.is_depegged);

        // Rate recovers but below resume threshold needs time
        state.update(0.998); // 0.2% - below 0.3% resume threshold
        assert!(state.is_depegged); // Still depegged (needs 1 hour)
        assert!(state.stable_since.is_some());
    }

    #[test]
    fn test_usdt_netting_normal_operation() {
        let mut depeg_state = DepegState::default();

        // Mix of USDC and USDT pairs
        let orders = vec![
            create_order_with_pair(1, usdc_pair(), Side::Buy, 10000),  // Need 10k USDC
            create_order_with_pair(2, usdc_pair(), Side::Sell, 3000),  // Excess 3k USDC
            create_order_with_pair(3, usdt_pair(), Side::Buy, 5000),   // Need 5k USDT
            create_order_with_pair(4, usdt_pair(), Side::Sell, 8000),  // Excess 8k USDT
        ];

        let result = usdt_netting(&orders, 1.0, &mut depeg_state);

        assert!(!result.netting_disabled);
        assert!(result.swaps_at_market_rate.is_empty());
        // Net USDC: 10k - 3k = 7k needed
        assert_eq!(result.net_usdc_flow, I256::from(7000));
        // Net USDT: 5k - 8k = -3k (excess)
        assert_eq!(result.net_usdt_flow, I256::from(-3000));
    }

    #[test]
    fn test_usdt_netting_depeg_disables() {
        let mut depeg_state = DepegState::default();

        let orders = vec![
            create_order_with_pair(1, usdt_pair(), Side::Buy, 5000),
            create_order_with_pair(2, usdt_pair(), Side::Sell, 3000),
        ];

        // Trigger depeg
        let result = usdt_netting(&orders, 0.99, &mut depeg_state);

        assert!(result.netting_disabled);
        assert!(depeg_state.is_depegged);
        // USDT orders should be returned as market swaps
        assert_eq!(result.swaps_at_market_rate.len(), 2);
    }

    #[test]
    fn test_usdt_netting_empty_orders() {
        let mut depeg_state = DepegState::default();
        let orders: Vec<LimitOrder> = vec![];

        let result = usdt_netting(&orders, 1.0, &mut depeg_state);

        assert!(!result.netting_disabled);
        assert_eq!(result.net_usdc_flow, I256::zero());
        assert_eq!(result.net_usdt_flow, I256::zero());
    }

    #[test]
    fn test_usdt_netting_only_usdc_pairs() {
        let mut depeg_state = DepegState::default();

        let orders = vec![
            create_order_with_pair(1, usdc_pair(), Side::Buy, 10000),
            create_order_with_pair(2, usdc_pair(), Side::Sell, 3000),
        ];

        let result = usdt_netting(&orders, 1.0, &mut depeg_state);

        assert_eq!(result.net_usdc_flow, I256::from(7000));
        assert_eq!(result.net_usdt_flow, I256::zero());
    }

    #[test]
    fn test_stablecoin_swap_extraction() {
        let orders = vec![
            create_order_with_pair(1, usdc_pair(), Side::Buy, 10000),  // Not USDT
            create_order_with_pair(2, usdt_pair(), Side::Buy, 5000),   // USDT buy
            create_order_with_pair(3, usdt_pair(), Side::Sell, 3000),  // USDT sell
        ];

        let swaps = extract_stablecoin_swaps(&orders);

        assert_eq!(swaps.len(), 2); // Only USDT orders
        assert!(swaps[0].usdc_to_usdt); // Buy needs USDC→USDT
        assert!(!swaps[1].usdc_to_usdt); // Sell needs USDT→USDC
    }

    #[test]
    fn test_resume_threshold() {
        let mut state = DepegState::default();

        // Trigger depeg
        state.update(0.99);
        assert!(state.is_depegged);

        // Rate recovers to between thresholds (0.3% < x < 0.5%)
        state.update(0.996); // 0.4% - above resume threshold
        assert!(state.stable_since.is_none()); // Timer not started

        // Rate recovers below resume threshold
        state.update(0.998); // 0.2% - below 0.3% resume threshold
        assert!(state.stable_since.is_some()); // Timer started
        assert!(state.is_depegged); // But still depegged (needs 1 hour)
    }

    // =============================================================================
    // Registry-based USDT Classification Tests (AC: 5)
    // =============================================================================

    /// Mock registry that returns specific quote tokens
    struct MockPairRegistry {
        usdt_pairs: std::collections::HashSet<H256>,
    }

    impl MockPairRegistry {
        fn new() -> Self {
            Self {
                usdt_pairs: std::collections::HashSet::new(),
            }
        }

        fn add_usdt_pair(&mut self, pair_id: H256) {
            self.usdt_pairs.insert(pair_id);
        }
    }

    impl PairQuoteLookup for MockPairRegistry {
        fn get_quote_token(&self, pair_id: H256) -> Option<Address> {
            if self.usdt_pairs.contains(&pair_id) {
                // Return Settlement USDT address
                Some(
                    std::str::FromStr::from_str("Fd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9")
                        .unwrap(),
                )
            } else {
                // Return USDC (not USDT)
                Some(
                    std::str::FromStr::from_str("af88d065e77c8cC2239327C5EDb3A432268e5831")
                        .unwrap(),
                )
            }
        }
    }

    #[test]
    fn test_usdt_addresses_known() {
        use std::str::FromStr;

        let settlement_usdt = Address::from_str("Fd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9").unwrap();
        assert!(usdt_addresses::is_known_usdt(&settlement_usdt));

        let usdc = Address::from_str("af88d065e77c8cC2239327C5EDb3A432268e5831").unwrap();
        assert!(!usdt_addresses::is_known_usdt(&usdc));
    }

    #[test]
    fn test_is_usdt_pair_with_registry() {
        let mut registry = MockPairRegistry::new();
        let pair_usdt = H256::random();
        let pair_usdc = H256::random();

        registry.add_usdt_pair(pair_usdt);

        // With registry, classification comes from registry lookup
        assert!(is_usdt_pair(pair_usdt, Some(&registry)));
        assert!(!is_usdt_pair(pair_usdc, Some(&registry)));
    }

    #[test]
    fn test_is_usdt_pair_fallback_heuristic() {
        // Without registry, uses first-byte heuristic
        assert!(is_usdt_pair::<NoPairRegistry>(usdt_pair(), None));
        assert!(!is_usdt_pair::<NoPairRegistry>(usdc_pair(), None));
    }

    #[test]
    fn test_usdt_netting_with_registry() {
        let mut registry = MockPairRegistry::new();
        let pair_1 = H256::random();
        let pair_2 = H256::random();

        // Mark pair_1 as USDT
        registry.add_usdt_pair(pair_1);

        let mut depeg_state = DepegState::default();

        // Note: pairs don't need to start with 0x80 - registry determines
        let orders = vec![
            create_order_with_pair(1, pair_1, Side::Buy, 5000),  // USDT (via registry)
            create_order_with_pair(2, pair_2, Side::Sell, 3000), // USDC (via registry)
        ];

        let result = usdt_netting_with_registry(&orders, 1.0, &mut depeg_state, &registry);

        // USDT flow: +5000 (buy)
        // USDC flow: -3000 (sell)
        assert_eq!(result.net_usdt_flow, I256::from(5000));
        assert_eq!(result.net_usdc_flow, I256::from(-3000));
    }

    #[test]
    fn test_no_pair_registry_uses_fallback() {
        // NoPairRegistry always returns None, triggering heuristic fallback
        let no_registry = NoPairRegistry;
        assert!(no_registry.get_quote_token(H256::random()).is_none());
    }
}
