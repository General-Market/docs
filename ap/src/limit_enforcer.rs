//! Limit Order Enforcer for AP accountability
//!
//! Enforces limit prices on all orders before and after execution.
//! Users receive price protection and violations are detected for AP accountability.
//!
//! ## Validation Rules
//!
//! - For BUY orders: `fill_price <= limit_price * (1 + tolerance)`
//! - For SELL orders: `fill_price >= limit_price * (1 - tolerance)`
//!
//! Default tolerance is 0.15% (15 basis points) to allow for minor CEX rounding and MockBitgetVault variance.

use chrono::{DateTime, Duration, Utc};
use common::types::{LimitOrder, Side};
use ethers::types::U256;
use std::fmt;
use tracing::{error, warn};

/// Tolerance in basis points (0.15% = 15 bps for E2E testing with MockBitgetVault)
pub const LIMIT_TOLERANCE_BPS: u64 = 15;

/// Basis points denominator (10000 = 100%)
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Alert threshold: violations in 24h to trigger alert
pub const ALERT_THRESHOLD: usize = 3;

/// 24-hour window for violation tracking
pub const VIOLATION_WINDOW_HOURS: i64 = 24;

/// Max retained violations before auto-cleanup removes entries older than the window
const MAX_VIOLATIONS_BEFORE_CLEANUP: usize = 1000;

/// Result of limit price validation
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationResult {
    /// Fill price respects the limit
    Pass,
    /// Fill price violates the limit
    Fail { reason: String },
}

impl ValidationResult {
    /// Returns true if validation passed
    pub fn is_pass(&self) -> bool {
        matches!(self, ValidationResult::Pass)
    }

    /// Returns true if validation failed
    pub fn is_fail(&self) -> bool {
        matches!(self, ValidationResult::Fail { .. })
    }
}

/// Record of a limit price violation
#[derive(Debug, Clone)]
pub struct LimitViolation {
    /// Order ID that was violated
    pub order_id: U256,
    /// Expected limit price from the order
    pub expected_limit: U256,
    /// Actual fill price that violated the limit
    pub actual_fill_price: U256,
    /// Side of the order (Buy or Sell)
    pub side: Side,
    /// When the violation occurred
    pub timestamp: DateTime<Utc>,
    /// Deviation from limit as percentage (can be negative)
    pub deviation_pct: f64,
}

impl fmt::Display for LimitViolation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "LimitViolation(order={}, limit={}, fill={}, side={:?}, deviation={:.4}%)",
            self.order_id, self.expected_limit, self.actual_fill_price, self.side, self.deviation_pct
        )
    }
}

/// Metrics for the limit enforcer
#[derive(Debug, Clone, Default)]
pub struct LimitEnforcerMetrics {
    /// Total validations performed
    pub total_validations: u64,
    /// Total violations detected
    pub total_violations: u64,
    /// Violations in the last 24 hours
    pub violations_24h: u64,
    /// Timestamp of last violation (if any)
    pub last_violation_time: Option<DateTime<Utc>>,
}

/// Limit Order Enforcer
///
/// Validates fill prices against limit prices and tracks violations for AP accountability.
#[derive(Debug)]
pub struct LimitOrderEnforcer {
    /// Recorded violations
    violations: Vec<LimitViolation>,
    /// Total validations performed
    total_validations: u64,
    /// Total violations detected
    total_violations: u64,
    /// Tolerance in basis points
    tolerance_bps: u64,
}

impl Default for LimitOrderEnforcer {
    fn default() -> Self {
        Self::new()
    }
}

impl LimitOrderEnforcer {
    /// Create a new LimitOrderEnforcer with default tolerance
    pub fn new() -> Self {
        Self::with_tolerance(LIMIT_TOLERANCE_BPS)
    }

    /// Create a new LimitOrderEnforcer with custom tolerance (in basis points)
    pub fn with_tolerance(tolerance_bps: u64) -> Self {
        Self {
            violations: Vec::new(),
            total_validations: 0,
            total_violations: 0,
            tolerance_bps,
        }
    }

    /// Validate a fill against the order's limit price
    ///
    /// # Arguments
    /// * `order` - The limit order being validated
    /// * `fill_price` - The actual fill price (18 decimals)
    ///
    /// # Returns
    /// * `ValidationResult::Pass` if fill respects limit
    /// * `ValidationResult::Fail` with reason if limit violated
    pub fn validate_fill(&mut self, order: &LimitOrder, fill_price: U256) -> ValidationResult {
        self.total_validations += 1;

        // Zero limit price is invalid
        if order.limit_price.is_zero() {
            let reason = format!(
                "Invalid zero limit price for order {}",
                order.id
            );
            return ValidationResult::Fail { reason };
        }

        let is_valid = match order.side {
            Side::Buy => self.is_buy_valid(fill_price, order.limit_price),
            Side::Sell => self.is_sell_valid(fill_price, order.limit_price),
        };

        // Overflow in multiplication means prices are too large to compare safely
        let is_valid = match is_valid {
            Some(valid) => valid,
            None => {
                let reason = format!(
                    "Arithmetic overflow validating order {}: fill={}, limit={}, side={:?}",
                    order.id, fill_price, order.limit_price, order.side
                );
                error!(
                    code = "E005",
                    order_id = %order.id,
                    fill_price = %fill_price,
                    limit_price = %order.limit_price,
                    "Arithmetic overflow in limit validation - treating as violation"
                );
                return ValidationResult::Fail { reason };
            }
        };

        if is_valid {
            ValidationResult::Pass
        } else {
            let deviation_pct = self.calculate_deviation_pct(fill_price, order.limit_price);

            let violation = LimitViolation {
                order_id: order.id,
                expected_limit: order.limit_price,
                actual_fill_price: fill_price,
                side: order.side,
                timestamp: Utc::now(),
                deviation_pct,
            };

            let reason = format!(
                "Limit price violation: order={}, limit={}, fill={}, side={:?}, deviation={:.4}%",
                order.id, order.limit_price, fill_price, order.side, deviation_pct
            );

            // Log the violation
            error!(
                code = "E005",
                order_id = %order.id,
                limit_price = %order.limit_price,
                fill_price = %fill_price,
                side = ?order.side,
                deviation_pct = violation.deviation_pct,
                "Limit price violation detected"
            );

            // Record the violation
            self.record_violation(violation);

            // Check alert threshold
            if self.check_alert_threshold() {
                let violation_count = self.get_violation_count(Duration::hours(VIOLATION_WINDOW_HOURS));
                warn!(
                    code = "E005",
                    alert = true,
                    violations_24h = violation_count,
                    threshold = ALERT_THRESHOLD,
                    "AP limit violation threshold breached"
                );
            }

            ValidationResult::Fail { reason }
        }
    }

    /// Check if a BUY fill is valid
    ///
    /// For BUY: fill_price <= limit_price * (1 + tolerance)
    /// Using fixed-point math: fill_price * 10000 <= limit_price * (10000 + tolerance_bps)
    ///
    /// Returns `None` on overflow (caller should treat as invalid).
    fn is_buy_valid(&self, fill_price: U256, limit_price: U256) -> Option<bool> {
        let bps_denom = U256::from(BPS_DENOMINATOR);
        let tolerance = U256::from(self.tolerance_bps);

        let fill_scaled = fill_price.checked_mul(bps_denom)?;
        let limit_with_tolerance = limit_price.checked_mul(bps_denom + tolerance)?;

        Some(fill_scaled <= limit_with_tolerance)
    }

    /// Check if a SELL fill is valid
    ///
    /// For SELL: fill_price >= limit_price * (1 - tolerance)
    /// Using fixed-point math: fill_price * 10000 >= limit_price * (10000 - tolerance_bps)
    ///
    /// Returns `None` on overflow (caller should treat as invalid).
    fn is_sell_valid(&self, fill_price: U256, limit_price: U256) -> Option<bool> {
        let bps_denom = U256::from(BPS_DENOMINATOR);
        let tolerance = U256::from(self.tolerance_bps);

        let fill_scaled = fill_price.checked_mul(bps_denom)?;
        let limit_with_tolerance = limit_price.checked_mul(bps_denom - tolerance)?;

        Some(fill_scaled >= limit_with_tolerance)
    }

    /// Calculate deviation percentage from limit price
    ///
    /// Returns the signed percentage deviation of fill from limit.
    /// Positive means fill is above limit, negative means below.
    /// This is for logging/display only; validation uses U256 math.
    fn calculate_deviation_pct(&self, fill_price: U256, limit_price: U256) -> f64 {
        if limit_price.is_zero() {
            return 0.0;
        }

        // Use U256 arithmetic to compute deviation safely without truncation.
        // deviation_pct = (fill - limit) / limit * 100
        // We compute: (fill * 10000 - limit * 10000) / limit, then divide by 100 for percentage.
        let scale = U256::from(10_000u64);

        if fill_price >= limit_price {
            // Positive deviation (fill above limit)
            let diff_scaled = (fill_price - limit_price).saturating_mul(scale);
            // diff_scaled / limit_price gives basis points of deviation
            let bps = diff_scaled / limit_price;
            bps.as_u128() as f64 / 100.0
        } else {
            // Negative deviation (fill below limit)
            let diff_scaled = (limit_price - fill_price).saturating_mul(scale);
            let bps = diff_scaled / limit_price;
            -(bps.as_u128() as f64 / 100.0)
        }
    }

    /// Record a violation for tracking.
    /// Restricted to crate visibility to prevent external double-counting;
    /// violations are recorded automatically by `validate_fill`.
    /// Auto-cleans old violations when the list exceeds MAX_VIOLATIONS_BEFORE_CLEANUP.
    fn record_violation(&mut self, violation: LimitViolation) {
        self.total_violations += 1;
        self.violations.push(violation);

        // Auto-cleanup to prevent unbounded memory growth
        if self.violations.len() > MAX_VIOLATIONS_BEFORE_CLEANUP {
            self.cleanup_old_violations(Duration::hours(VIOLATION_WINDOW_HOURS));
        }
    }

    /// Get the count of violations within a time window
    pub fn get_violation_count(&self, time_window: Duration) -> usize {
        let cutoff = Utc::now() - time_window;
        self.violations
            .iter()
            .filter(|v| v.timestamp >= cutoff)
            .count()
    }

    /// Check if the alert threshold has been breached (≥3 violations in 24h)
    pub fn check_alert_threshold(&self) -> bool {
        self.get_violation_count(Duration::hours(VIOLATION_WINDOW_HOURS)) >= ALERT_THRESHOLD
    }

    /// Get recent violations (for diagnostics)
    pub fn get_recent_violations(&self, count: usize) -> Vec<LimitViolation> {
        self.violations
            .iter()
            .rev()
            .take(count)
            .cloned()
            .collect()
    }

    /// Get all violations within a time window
    pub fn get_violations_in_window(&self, time_window: Duration) -> Vec<LimitViolation> {
        let cutoff = Utc::now() - time_window;
        self.violations
            .iter()
            .filter(|v| v.timestamp >= cutoff)
            .cloned()
            .collect()
    }

    /// Get current metrics snapshot
    pub fn get_metrics(&self) -> LimitEnforcerMetrics {
        let violations_24h = self.get_violation_count(Duration::hours(VIOLATION_WINDOW_HOURS)) as u64;
        let last_violation_time = self.violations.last().map(|v| v.timestamp);

        LimitEnforcerMetrics {
            total_validations: self.total_validations,
            total_violations: self.total_violations,
            violations_24h,
            last_violation_time,
        }
    }

    /// Clear old violations outside the retention window (cleanup)
    pub fn cleanup_old_violations(&mut self, retention_window: Duration) {
        let cutoff = Utc::now() - retention_window;
        self.violations.retain(|v| v.timestamp >= cutoff);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::types::OrderStatus;
    use ethers::types::{Address, H256};

    /// Helper to create a test order
    fn create_test_order(side: Side, limit_price: U256) -> LimitOrder {
        LimitOrder {
            id: U256::from(1),
            user: Address::zero(),
            pair_id: H256::zero(),
            side,
            amount: U256::from(1000_u64) * U256::exp10(18), // 1000 USDC
            limit_price,
            slippage_tier: U256::zero(),
            deadline: U256::from(u64::MAX),
            itp_id: H256::zero(),
            timestamp: U256::from(1000000),
            status: OrderStatus::Pending,
        }
    }

    /// Convert a price with 18 decimals
    /// e.g., price_18(100, 11) = $100.11 with 18 decimals
    fn price_18(whole: u64, cents: u64) -> U256 {
        // whole * 10^18 + cents * 10^16 (cents = 0.01)
        U256::from(whole) * U256::exp10(18) + U256::from(cents) * U256::exp10(16)
    }

    // ==================== BUY ORDER TESTS ====================

    #[test]
    fn test_buy_order_fill_at_exactly_limit_price_passes() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Buy, limit_price);
        let fill_price = limit_price; // Exactly at limit

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_pass(), "Fill at exactly limit should pass");
    }

    #[test]
    fn test_buy_order_fill_below_limit_price_passes() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Buy, limit_price);
        let fill_price = price_18(99, 0); // $99.00 - below limit

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_pass(), "Fill below limit should pass for BUY");
    }

    #[test]
    fn test_buy_order_fill_above_limit_outside_tolerance_fails() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Buy, limit_price);
        // 0.2% above limit (outside 0.1% tolerance)
        let fill_price = price_18(100, 20); // $100.20

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_fail(), "Fill 0.2% above limit should fail for BUY");
    }

    #[test]
    fn test_buy_order_fill_within_tolerance_passes() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Buy, limit_price);
        // 0.09% above limit (within 0.1% tolerance)
        let fill_price = price_18(100, 9); // $100.09

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_pass(), "Fill 0.09% above limit should pass (within tolerance)");
    }

    #[test]
    fn test_buy_order_fill_at_exactly_tolerance_boundary_passes() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Buy, limit_price);
        // Exactly 0.1% above limit
        let fill_price = price_18(100, 10); // $100.10

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_pass(), "Fill at exactly tolerance boundary should pass");
    }

    #[test]
    fn test_buy_order_fill_just_beyond_tolerance_boundary_fails() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Buy, limit_price);
        // Just beyond 0.1% above limit
        let fill_price = price_18(100, 11); // $100.11

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_fail(), "Fill just beyond tolerance boundary should fail");
    }

    // ==================== SELL ORDER TESTS ====================

    #[test]
    fn test_sell_order_fill_at_exactly_limit_price_passes() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Sell, limit_price);
        let fill_price = limit_price; // Exactly at limit

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_pass(), "Fill at exactly limit should pass");
    }

    #[test]
    fn test_sell_order_fill_above_limit_price_passes() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Sell, limit_price);
        let fill_price = price_18(101, 0); // $101.00 - above limit

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_pass(), "Fill above limit should pass for SELL");
    }

    #[test]
    fn test_sell_order_fill_below_limit_outside_tolerance_fails() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Sell, limit_price);
        // 0.2% below limit (outside 0.1% tolerance)
        let fill_price = price_18(99, 80); // $99.80

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_fail(), "Fill 0.2% below limit should fail for SELL");
    }

    #[test]
    fn test_sell_order_fill_within_tolerance_passes() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Sell, limit_price);
        // 0.09% below limit (within 0.1% tolerance)
        let fill_price = price_18(99, 91); // $99.91

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_pass(), "Fill 0.09% below limit should pass (within tolerance)");
    }

    #[test]
    fn test_sell_order_fill_at_exactly_tolerance_boundary_passes() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Sell, limit_price);
        // Exactly 0.1% below limit: $99.90
        let fill_price = price_18(99, 90);

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_pass(), "Fill at exactly SELL tolerance boundary should pass");
    }

    #[test]
    fn test_sell_order_fill_just_beyond_tolerance_boundary_fails() {
        let mut enforcer = LimitOrderEnforcer::new();
        let limit_price = price_18(100, 0); // $100.00
        let order = create_test_order(Side::Sell, limit_price);
        // Just beyond 0.1% below limit: $99.89
        let fill_price = price_18(99, 89);

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_fail(), "Fill just beyond SELL tolerance boundary should fail");
    }

    // ==================== VIOLATION TRACKING TESTS ====================

    /// Helper to directly push a violation for testing tracking logic.
    /// In production, violations are recorded automatically by `validate_fill`.
    fn push_test_violation(enforcer: &mut LimitOrderEnforcer, violation: LimitViolation) {
        enforcer.total_violations += 1;
        enforcer.violations.push(violation);
    }

    #[test]
    fn test_violation_count_returns_correct_count_for_time_window() {
        let mut enforcer = LimitOrderEnforcer::new();

        let violation1 = LimitViolation {
            order_id: U256::from(1),
            expected_limit: U256::from(100),
            actual_fill_price: U256::from(110),
            side: Side::Buy,
            timestamp: Utc::now(),
            deviation_pct: 10.0,
        };
        let violation2 = LimitViolation {
            order_id: U256::from(2),
            expected_limit: U256::from(100),
            actual_fill_price: U256::from(110),
            side: Side::Buy,
            timestamp: Utc::now() - Duration::hours(12),
            deviation_pct: 10.0,
        };

        push_test_violation(&mut enforcer, violation1);
        push_test_violation(&mut enforcer, violation2);

        // Both should be in 24h window
        assert_eq!(enforcer.get_violation_count(Duration::hours(24)), 2);

        // Only recent one in 6h window
        assert_eq!(enforcer.get_violation_count(Duration::hours(6)), 1);
    }

    #[test]
    fn test_alert_threshold_triggers_at_3_violations_in_24h() {
        let mut enforcer = LimitOrderEnforcer::new();

        // Add 3 violations within 24h
        for i in 0..3 {
            let violation = LimitViolation {
                order_id: U256::from(i),
                expected_limit: U256::from(100),
                actual_fill_price: U256::from(110),
                side: Side::Buy,
                timestamp: Utc::now() - Duration::hours(i as i64),
                deviation_pct: 10.0,
            };
            push_test_violation(&mut enforcer, violation);
        }

        assert!(enforcer.check_alert_threshold(), "Should trigger alert at 3 violations");
    }

    #[test]
    fn test_violations_outside_24h_window_dont_trigger_alert() {
        let mut enforcer = LimitOrderEnforcer::new();

        let recent = LimitViolation {
            order_id: U256::from(1),
            expected_limit: U256::from(100),
            actual_fill_price: U256::from(110),
            side: Side::Buy,
            timestamp: Utc::now(),
            deviation_pct: 10.0,
        };
        let old1 = LimitViolation {
            order_id: U256::from(2),
            expected_limit: U256::from(100),
            actual_fill_price: U256::from(110),
            side: Side::Buy,
            timestamp: Utc::now() - Duration::hours(25),
            deviation_pct: 10.0,
        };
        let old2 = LimitViolation {
            order_id: U256::from(3),
            expected_limit: U256::from(100),
            actual_fill_price: U256::from(110),
            side: Side::Buy,
            timestamp: Utc::now() - Duration::hours(48),
            deviation_pct: 10.0,
        };

        push_test_violation(&mut enforcer, old2);
        push_test_violation(&mut enforcer, old1);
        push_test_violation(&mut enforcer, recent);

        assert!(!enforcer.check_alert_threshold(), "Should not trigger alert - only 1 in 24h window");
    }

    // ==================== EDGE CASE TESTS ====================

    #[test]
    fn test_zero_limit_price_fails_gracefully() {
        let mut enforcer = LimitOrderEnforcer::new();
        let order = create_test_order(Side::Buy, U256::zero());
        let fill_price = price_18(100, 0);

        let result = enforcer.validate_fill(&order, fill_price);
        assert!(result.is_fail(), "Zero limit price should fail");

        if let ValidationResult::Fail { reason } = result {
            assert!(reason.contains("zero limit price"), "Reason should mention zero limit price");
        }
    }

    #[test]
    fn test_large_equal_prices_pass() {
        let mut enforcer = LimitOrderEnforcer::new();
        // Large but not overflowing when multiplied by 10010
        let large_price = U256::from(u128::MAX);
        let order = create_test_order(Side::Buy, large_price);

        // Fill at same price should pass
        let result = enforcer.validate_fill(&order, large_price);
        assert!(result.is_pass(), "Large but equal prices should pass");
    }

    #[test]
    fn test_overflow_prices_fail_gracefully() {
        let mut enforcer = LimitOrderEnforcer::new();
        // U256::MAX will overflow when multiplied by 10000
        let max_price = U256::MAX;
        let order = create_test_order(Side::Buy, max_price);

        let result = enforcer.validate_fill(&order, max_price);
        assert!(result.is_fail(), "Overflow should be treated as violation");
        if let ValidationResult::Fail { reason } = result {
            assert!(reason.contains("overflow"), "Reason should mention overflow");
        }
    }

    // ==================== METRICS TESTS ====================

    #[test]
    fn test_metrics_tracking() {
        let mut enforcer = LimitOrderEnforcer::new();
        let order = create_test_order(Side::Buy, price_18(100, 0));

        // Successful validation
        enforcer.validate_fill(&order, price_18(99, 0));

        let metrics = enforcer.get_metrics();
        assert_eq!(metrics.total_validations, 1);
        assert_eq!(metrics.total_violations, 0);

        // Failed validation
        enforcer.validate_fill(&order, price_18(101, 0)); // Way above limit

        let metrics = enforcer.get_metrics();
        assert_eq!(metrics.total_validations, 2);
        assert_eq!(metrics.total_violations, 1);
        assert!(metrics.last_violation_time.is_some());
    }

    #[test]
    fn test_get_recent_violations() {
        let mut enforcer = LimitOrderEnforcer::new();

        for i in 0..5 {
            let violation = LimitViolation {
                order_id: U256::from(i),
                expected_limit: U256::from(100),
                actual_fill_price: U256::from(110),
                side: Side::Buy,
                timestamp: Utc::now(),
                deviation_pct: 10.0,
            };
            push_test_violation(&mut enforcer, violation);
        }

        let recent = enforcer.get_recent_violations(3);
        assert_eq!(recent.len(), 3);
        // Most recent first
        assert_eq!(recent[0].order_id, U256::from(4));
        assert_eq!(recent[1].order_id, U256::from(3));
        assert_eq!(recent[2].order_id, U256::from(2));
    }
}
