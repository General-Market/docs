//! Shared paginated backfill with exponential retry.

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use tracing::{debug, error, warn};

const DEFAULT_BATCH_SIZE: u64 = 10_000;
const DEFAULT_MAX_RETRIES: u32 = 3;

/// Walk a block range in batches, retrying each batch on failure.
///
/// `process_batch(from, to)` should process blocks `[from, to]` and return
/// an arbitrary result on success. Errors are retried with exponential backoff.
///
/// Returns the number of successfully processed batches.
pub async fn backfill_paginated<'a, T>(
    name: &str,
    from: u64,
    to: u64,
    mut process_batch: impl FnMut(u64, u64) -> Pin<Box<dyn Future<Output = Result<T, Box<dyn std::error::Error + Send + Sync>>> + Send + 'a>>,
) -> u64 {
    let mut cursor = from;
    let mut success_count = 0u64;

    while cursor < to {
        let batch_end = (cursor + DEFAULT_BATCH_SIZE).min(to);
        let mut success = false;

        for attempt in 1..=DEFAULT_MAX_RETRIES {
            match process_batch(cursor, batch_end).await {
                Ok(_) => {
                    debug!(from = cursor, to = batch_end, "{name} backfill batch OK");
                    success = true;
                    break;
                }
                Err(e) if attempt < DEFAULT_MAX_RETRIES => {
                    warn!(from = cursor, to = batch_end, attempt, %e,
                        "{name} backfill batch failed, retrying");
                    tokio::time::sleep(Duration::from_secs(2u64.pow(attempt))).await;
                }
                Err(e) => {
                    error!(from = cursor, to = batch_end, %e,
                        "{name} backfill batch failed after {DEFAULT_MAX_RETRIES} attempts, skipping");
                }
            }
        }

        if success {
            success_count += 1;
        }

        cursor = batch_end + 1;
    }

    success_count
}
