//! Generic concurrent work queue with progress counter.

use std::future::Future;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use tokio::sync::Mutex;
use tokio::task::JoinSet;
use tracing::error;

/// Process `items` with up to `concurrency` parallel workers.
///
/// Each worker pops items from a shared queue and calls `worker(item)`,
/// which returns a count that is accumulated. Returns the total count.
pub async fn run_work_queue<T, Fut>(
    items: Vec<T>,
    concurrency: usize,
    worker: impl Fn(T) -> Fut + Send + Sync + 'static,
) -> u64
where
    T: Send + 'static,
    Fut: Future<Output = u64> + Send,
{
    let queue = Arc::new(Mutex::new(items));
    let counter = Arc::new(AtomicU64::new(0));
    let worker = Arc::new(worker);
    let mut handles = JoinSet::new();

    for _ in 0..concurrency {
        let q = Arc::clone(&queue);
        let c = Arc::clone(&counter);
        let w = Arc::clone(&worker);
        handles.spawn(async move {
            loop {
                let item = q.lock().await.pop();
                match item {
                    Some(it) => {
                        c.fetch_add(w(it).await, Ordering::Relaxed);
                    }
                    None => break,
                }
            }
        });
    }

    while let Some(result) = handles.join_next().await {
        if let Err(e) = result {
            error!(%e, "Work queue: worker panicked");
        }
    }

    counter.load(Ordering::Relaxed)
}
