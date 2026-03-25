use ethers::types::U256;
use std::sync::atomic::{AtomicU64, Ordering};

/// Circuit breaker for AP trade execution safety limits.
/// Auto-resets after HALT_TIMEOUT_SECS to prevent permanent latch.
pub struct CircuitBreaker {
    /// Maximum single trade amount in USDC (18 decimals)
    pub max_single_trade: U256,
    /// Maximum cumulative USDC per cycle
    pub max_per_cycle: U256,
    /// Rolling cycle accumulator
    cycle_total: std::sync::Mutex<(u64, U256)>, // (cycle_number, accumulated)
    /// Consecutive failure counter
    consecutive_failures: AtomicU64,
    /// Max consecutive failures before halt
    pub max_consecutive_failures: u64,
    /// Timestamp (epoch secs) when the breaker last halted
    halted_at: AtomicU64,
}

/// Seconds before a halted breaker auto-resets and retries
const HALT_TIMEOUT_SECS: u64 = 60;

impl CircuitBreaker {
    pub fn new(max_single: U256, max_cycle: U256, max_failures: u64) -> Self {
        Self {
            max_single_trade: max_single,
            max_per_cycle: max_cycle,
            cycle_total: std::sync::Mutex::new((0, U256::zero())),
            consecutive_failures: AtomicU64::new(0),
            max_consecutive_failures: max_failures,
            halted_at: AtomicU64::new(0),
        }
    }

    fn now_secs() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    /// Check if a trade is allowed. Returns Err with reason if blocked.
    pub fn check_trade(&self, usdc_amount: U256, cycle: u64) -> Result<(), String> {
        // Check halt condition with timeout decay
        let failures = self.consecutive_failures.load(Ordering::SeqCst);
        if failures >= self.max_consecutive_failures {
            let halted = self.halted_at.load(Ordering::SeqCst);
            let elapsed = Self::now_secs().saturating_sub(halted);
            if elapsed >= HALT_TIMEOUT_SECS {
                // Auto-reset: enough time has passed, allow one retry
                self.consecutive_failures.store(0, Ordering::SeqCst);
                self.halted_at.store(0, Ordering::SeqCst);
                tracing::info!(elapsed_secs = elapsed, "Circuit breaker auto-reset after timeout");
            } else {
                return Err(format!(
                    "Circuit breaker HALTED: {} consecutive failures (resets in {}s)",
                    failures, HALT_TIMEOUT_SECS - elapsed
                ));
            }
        }

        // Check single trade limit
        if usdc_amount > self.max_single_trade {
            return Err(format!(
                "Trade {} exceeds max single trade {}",
                usdc_amount, self.max_single_trade
            ));
        }

        // Check per-cycle limit
        let mut guard = self.cycle_total.lock().unwrap();
        if guard.0 != cycle {
            // New cycle, reset
            *guard = (cycle, U256::zero());
        }
        let new_total = guard.1.checked_add(usdc_amount).unwrap_or(U256::MAX);
        if new_total > self.max_per_cycle {
            return Err(format!(
                "Cycle {} total {} would exceed max {}",
                cycle, new_total, self.max_per_cycle
            ));
        }
        guard.1 = new_total;
        Ok(())
    }

    pub fn record_success(&self) {
        self.consecutive_failures.store(0, Ordering::SeqCst);
    }

    pub fn record_failure(&self) {
        let prev = self.consecutive_failures.fetch_add(1, Ordering::SeqCst);
        if prev + 1 >= self.max_consecutive_failures {
            self.halted_at.store(Self::now_secs(), Ordering::SeqCst);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_trade_limit() {
        let cb = CircuitBreaker::new(
            U256::from(1000),
            U256::from(10000),
            3,
        );
        assert!(cb.check_trade(U256::from(500), 1).is_ok());
        assert!(cb.check_trade(U256::from(1001), 1).is_err());
    }

    #[test]
    fn test_cycle_limit() {
        let cb = CircuitBreaker::new(
            U256::from(1000),
            U256::from(2000),
            3,
        );
        assert!(cb.check_trade(U256::from(800), 1).is_ok());
        assert!(cb.check_trade(U256::from(800), 1).is_ok());
        // Third trade would push total to 2400 > 2000
        assert!(cb.check_trade(U256::from(800), 1).is_err());
    }

    #[test]
    fn test_cycle_reset() {
        let cb = CircuitBreaker::new(
            U256::from(1000),
            U256::from(1500),
            3,
        );
        assert!(cb.check_trade(U256::from(1000), 1).is_ok());
        // New cycle resets accumulator
        assert!(cb.check_trade(U256::from(1000), 2).is_ok());
    }

    #[test]
    fn test_consecutive_failures_halt() {
        let cb = CircuitBreaker::new(
            U256::from(1000),
            U256::from(10000),
            3,
        );
        cb.record_failure();
        cb.record_failure();
        cb.record_failure();
        assert!(cb.check_trade(U256::from(100), 1).is_err());
    }

    #[test]
    fn test_success_resets_failures() {
        let cb = CircuitBreaker::new(
            U256::from(1000),
            U256::from(10000),
            3,
        );
        cb.record_failure();
        cb.record_failure();
        cb.record_success();
        assert!(cb.check_trade(U256::from(100), 1).is_ok());
    }
}
