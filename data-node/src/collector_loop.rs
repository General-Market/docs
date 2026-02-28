//! Shared helpers for collector loops and periodic maintenance.

use std::error::Error;
use std::future::Future;
use std::time::Duration;

use tracing::warn;

/// Run an infinite poll loop: call `tick` then sleep for `interval`.
/// Errors from `tick` are logged as warnings and do not break the loop.
pub async fn run_collector_loop<F, Fut>(name: &'static str, interval: Duration, mut tick: F)
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<(), Box<dyn Error + Send + Sync>>>,
{
    loop {
        if let Err(e) = tick().await {
            warn!(%e, "{name} tick error");
        }
        tokio::time::sleep(interval).await;
    }
}

/// Counts ticks and fires periodically (e.g. for retention pruning).
pub struct PruneTimer {
    counter: u64,
    every: u64,
}

impl PruneTimer {
    /// Create a timer that fires once per `prune_secs` given a `poll_secs` tick rate.
    pub fn new(poll_secs: u64, prune_secs: u64) -> Self {
        Self {
            counter: 0,
            every: prune_secs / poll_secs.max(1),
        }
    }

    /// Call once per tick. Returns `true` when it's time to prune.
    pub fn tick(&mut self) -> bool {
        self.counter += 1;
        if self.counter >= self.every {
            self.counter = 0;
            true
        } else {
            false
        }
    }
}
