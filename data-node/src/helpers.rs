use std::collections::HashSet;
use std::sync::OnceLock;

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

/// Sources that are allowed to spawn when `SF_MODE=1`. Everything else is
/// silently skipped (with a single info log per skipped source).
///
/// SF_MODE is how the sfdata-node binary signals that this process should
/// only run scrape-heavy adult-content sources; every other source stays
/// on the main data-node instance. See sf_main.rs and docker/sfdata-node/.
const SF_MODE_ALLOWED: &[&str] = &["tubes", "chaturbate"];

pub(crate) fn sf_mode() -> bool {
    matches!(std::env::var("SF_MODE").ok().as_deref(), Some("1"))
}

/// Comma-separated allowlist of `MarketDataSource::source_id()` strings.
/// When unset or empty, every source is allowed (legacy behaviour). When
/// non-empty, only sources whose name appears in the list are spawned.
/// Whitespace around entries is trimmed; empty entries are ignored.
fn source_allowlist() -> Option<&'static HashSet<String>> {
    static CACHE: OnceLock<Option<HashSet<String>>> = OnceLock::new();
    CACHE
        .get_or_init(|| {
            let raw = std::env::var("SOURCE_ALLOWLIST").ok()?;
            let set: HashSet<String> = raw
                .split(',')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .collect();
            if set.is_empty() {
                None
            } else {
                Some(set)
            }
        })
        .as_ref()
}

/// Spawn a source with panic recovery. If `SF_MODE=1` is set and the source
/// is not in `SF_MODE_ALLOWED`, the spawn is skipped entirely — no task is
/// created, no futures run, no restart loop spins. This is what isolates
/// the sfdata-node process to only its assigned sources.
pub(crate) fn spawn_resilient<F, Fut>(
    name: &'static str,
    write_channel: market_data::write_channel::PriceWriteChannel,
    make_fut: F,
)
where
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: std::future::Future<Output = ()> + Send + 'static,
{
    if sf_mode() && !SF_MODE_ALLOWED.contains(&name) {
        info!("[{}] skipped (SF_MODE: not in allow-list)", name);
        return;
    }
    if let Some(allow) = source_allowlist() {
        if !allow.contains(name) {
            info!("[{}] skipped (SOURCE_ALLOWLIST: not in allow-list)", name);
            return;
        }
    }
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
