use std::collections::HashSet;

use tracing::info;

use crate::market_data;

pub(crate) fn load_tracked_symbols(assets_file: &str) -> Result<HashSet<String>, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(assets_file)?;
    let assets: Vec<serde_json::Value> = serde_json::from_str(&content)?;
    let symbols: HashSet<String> = assets
        .iter()
        .filter_map(|a| a.get("bitget").and_then(|v| v.as_str()).map(String::from))
        .collect();
    Ok(symbols)
}

/// Spawn a source with panic recovery.
pub(crate) fn spawn_resilient<F, Fut>(
    name: &'static str,
    write_channel: market_data::write_channel::PriceWriteChannel,
    make_fut: F,
)
where
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: std::future::Future<Output = ()> + Send + 'static,
{
    tokio::spawn(async move {
        let mut restart_count = 0u32;
        loop {
            if write_channel.is_closed() {
                tracing::error!("[{}] BatchWriter is dead (channel closed), stopping restart loop", name);
                return;
            }
            let start_time = tokio::time::Instant::now();
            let fut = make_fut();
            match tokio::spawn(fut).await {
                Ok(()) => {
                    tracing::warn!("[{}] Source exited normally, restarting", name);
                }
                Err(e) => {
                    tracing::error!("[{}] Source PANICKED (restart #{}): {}", name, restart_count + 1, e);
                }
            }
            let runtime = start_time.elapsed();
            if runtime > std::time::Duration::from_secs(300) {
                restart_count = restart_count.saturating_sub(1);
            } else {
                restart_count += 1;
            }
            let delay_secs = 30u64 * (restart_count.min(10) as u64);
            tracing::warn!("[{}] Restarting in {}s (restart #{})", name, delay_secs, restart_count);
            tokio::time::sleep(std::time::Duration::from_secs(delay_secs)).await;
        }
    });
}

pub(crate) async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C handler");
    info!("Shutdown signal received");
}
