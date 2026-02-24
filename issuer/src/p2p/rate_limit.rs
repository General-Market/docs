use std::time::Instant;

/// Token bucket rate limiter for per-peer message rate control.
/// Each connection owns one RateBucket -- no Arc/Mutex needed.
pub struct RateBucket {
    tokens: f64,
    max_tokens: f64,
    refill_rate: f64, // tokens per second
    last_refill: Instant,
}

impl RateBucket {
    pub fn new(max_tokens: f64, refill_rate: f64) -> Self {
        Self {
            tokens: max_tokens,
            max_tokens,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    /// Try to consume one token. Returns false if rate limit exceeded.
    pub fn try_consume(&mut self) -> bool {
        self.refill();
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.max_tokens);
        self.last_refill = now;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_initial_burst() {
        let mut bucket = RateBucket::new(5.0, 10.0);
        // Should allow 5 tokens immediately (burst)
        for _ in 0..5 {
            assert!(bucket.try_consume());
        }
        // 6th should fail
        assert!(!bucket.try_consume());
    }

    #[test]
    fn test_refill() {
        let mut bucket = RateBucket::new(2.0, 100.0);
        // Drain all tokens
        assert!(bucket.try_consume());
        assert!(bucket.try_consume());
        assert!(!bucket.try_consume());

        // Wait for refill (100 tokens/sec = 1 token per 10ms)
        thread::sleep(Duration::from_millis(15));
        assert!(bucket.try_consume());
    }
}
