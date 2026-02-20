//! Sliding window rate limiter
//!
//! Supports multiple rate windows (e.g., 60/min + 600/10min).
//! The sync engine calls `wait_for_permit()` before each API request.

use std::collections::VecDeque;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tracing::debug;

/// Configuration for rate limiting
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub windows: Vec<RateWindow>,
}

/// A single rate window
#[derive(Debug, Clone)]
pub struct RateWindow {
    pub max_requests: u32,
    pub duration: Duration,
}

/// Sliding window rate limiter that enforces multiple concurrent windows.
pub struct SlidingWindowRateLimiter {
    windows: Vec<RateWindow>,
    timestamps: Mutex<VecDeque<Instant>>,
}

impl SlidingWindowRateLimiter {
    /// Create a new rate limiter from config
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            windows: config.windows,
            timestamps: Mutex::new(VecDeque::new()),
        }
    }

    /// Wait until a request is permitted, then record it.
    /// Blocks if any rate window is at capacity.
    pub async fn wait_for_permit(&self) {
        loop {
            let wait = {
                let mut ts = self.timestamps.lock().await;
                let now = Instant::now();

                // Prune timestamps older than the longest window
                let max_window = self
                    .windows
                    .iter()
                    .map(|w| w.duration)
                    .max()
                    .unwrap_or(Duration::from_secs(60));

                while ts
                    .front()
                    .map_or(false, |t| now.duration_since(*t) > max_window)
                {
                    ts.pop_front();
                }

                // Check each window
                let mut longest_wait = Duration::ZERO;
                for window in &self.windows {
                    let count_in_window = ts
                        .iter()
                        .filter(|t| now.duration_since(**t) <= window.duration)
                        .count() as u32;

                    if count_in_window >= window.max_requests {
                        // Calculate how long to wait: until the oldest request in this
                        // window expires
                        let oldest_in_window = ts
                            .iter()
                            .filter(|t| now.duration_since(**t) <= window.duration)
                            .next();

                        if let Some(oldest) = oldest_in_window {
                            let elapsed = now.duration_since(*oldest);
                            let wait_needed =
                                window.duration.saturating_sub(elapsed) + Duration::from_millis(50); // small buffer
                            if wait_needed > longest_wait {
                                longest_wait = wait_needed;
                            }
                        }
                    }
                }

                longest_wait
            };

            if wait.is_zero() {
                // Permit granted — record timestamp
                let mut ts = self.timestamps.lock().await;
                ts.push_back(Instant::now());
                return;
            }

            debug!("Rate limiter: waiting {:?}", wait);
            tokio::time::sleep(wait).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_permits_within_limit() {
        let limiter = SlidingWindowRateLimiter::new(RateLimitConfig {
            windows: vec![RateWindow {
                max_requests: 5,
                duration: Duration::from_secs(1),
            }],
        });

        // Should permit 5 requests immediately
        for _ in 0..5 {
            limiter.wait_for_permit().await;
        }
    }

    #[tokio::test]
    async fn test_rate_limiter_multi_window() {
        let limiter = SlidingWindowRateLimiter::new(RateLimitConfig {
            windows: vec![
                RateWindow {
                    max_requests: 3,
                    duration: Duration::from_millis(100),
                },
                RateWindow {
                    max_requests: 10,
                    duration: Duration::from_secs(1),
                },
            ],
        });

        // Should permit 3 requests immediately (limited by first window)
        for _ in 0..3 {
            limiter.wait_for_permit().await;
        }
    }
}
