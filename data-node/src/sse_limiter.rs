use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

pub struct SseLimiter {
    total: AtomicUsize,
    per_ip: Mutex<HashMap<IpAddr, usize>>,
    max_total: usize,
    max_per_ip: usize,
}

impl SseLimiter {
    pub fn new(max_total: usize, max_per_ip: usize) -> Self {
        Self {
            total: AtomicUsize::new(0),
            per_ip: Mutex::new(HashMap::new()),
            max_total,
            max_per_ip,
        }
    }

    /// Acquire a connection slot. `ip` is None when the client IP cannot be
    /// determined (no X-Real-IP / X-Forwarded-For) — only the global limit
    /// applies in that case, not the per-IP limit.
    pub fn try_acquire(self: &Arc<Self>, ip: Option<IpAddr>) -> Option<SseGuard> {
        if self.total.load(Ordering::Relaxed) >= self.max_total {
            return None;
        }
        if let Some(addr) = ip {
            let mut per_ip = self.per_ip.lock().unwrap();
            let count = per_ip.entry(addr).or_insert(0);
            if *count >= self.max_per_ip {
                return None;
            }
            *count += 1;
        }
        self.total.fetch_add(1, Ordering::Relaxed);
        Some(SseGuard {
            limiter: Arc::clone(self),
            ip,
        })
    }

    pub fn active_connections(&self) -> usize {
        self.total.load(Ordering::Relaxed)
    }
}

pub struct SseGuard {
    limiter: Arc<SseLimiter>,
    ip: Option<IpAddr>,
}

impl Drop for SseGuard {
    fn drop(&mut self) {
        self.limiter.total.fetch_sub(1, Ordering::Relaxed);
        if let Some(addr) = self.ip {
            let mut per_ip = self.limiter.per_ip.lock().unwrap();
            if let Some(count) = per_ip.get_mut(&addr) {
                *count -= 1;
                if *count == 0 {
                    per_ip.remove(&addr);
                }
            }
        }
    }
}
