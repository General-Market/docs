use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};
use super::config::{SharedConfig, RuntimeConfig};

pub struct DeploymentWatcher {
    config: SharedConfig,
    deployment_path: PathBuf,
    nonce_poll_interval: Duration,
    flush_callback: Option<Arc<dyn Fn(u64, u64) + Send + Sync>>,
    reload_callback: Option<Arc<dyn Fn(&RuntimeConfig, &RuntimeConfig) + Send + Sync>>,
    cancel_token: CancellationToken,
}

impl DeploymentWatcher {
    pub fn new(config: SharedConfig, deployment_path: PathBuf) -> Self {
        Self {
            config,
            deployment_path,
            nonce_poll_interval: Duration::from_secs(60),
            flush_callback: None,
            reload_callback: None,
            cancel_token: CancellationToken::new(),
        }
    }

    pub fn with_nonce_poll_interval(mut self, interval: Duration) -> Self {
        self.nonce_poll_interval = interval;
        self
    }

    pub fn with_cancel_token(mut self, token: CancellationToken) -> Self {
        self.cancel_token = token;
        self
    }

    /// Called when deployment nonce changes (full flush needed)
    pub fn on_nonce_change(mut self, f: impl Fn(u64, u64) + Send + Sync + 'static) -> Self {
        self.flush_callback = Some(Arc::new(f));
        self
    }

    /// Called on any config reload (soft or hard)
    pub fn on_reload(mut self, f: impl Fn(&RuntimeConfig, &RuntimeConfig) + Send + Sync + 'static) -> Self {
        self.reload_callback = Some(Arc::new(f));
        self
    }

    pub fn spawn(self) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            self.run().await;
        })
    }

    async fn run(self) {
        let (tx, mut rx) = mpsc::channel::<()>(1);

        // File watcher (debounced)
        // IMPORTANT: Capture the tokio runtime Handle BEFORE spawning the std::thread,
        // because Handle::current() panics if called outside a tokio runtime.
        let tx_file = tx.clone();
        let watch_path = self.deployment_path.clone();
        let cancel = self.cancel_token.clone();
        std::thread::spawn(move || {
            let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
                if let Ok(event) = res {
                    if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                        // Use try_send to avoid blocking the file watcher callback thread.
                        // If the channel is full, a reload is already pending -- safe to drop.
                        let _ = tx_file.try_send(());
                    }
                }
            }).expect("Failed to create file watcher");

            if let Some(parent) = watch_path.parent() {
                if let Err(e) = watcher.watch(parent, RecursiveMode::NonRecursive) {
                    warn!("File watcher failed to start: {e}. Falling back to poll-only.");
                }
            }
            // Keep watcher alive until cancellation
            loop {
                if cancel.is_cancelled() {
                    break;
                }
                std::thread::park_timeout(Duration::from_secs(1));
            }
        });

        // Nonce poll timer
        let tx_nonce = tx.clone();
        let poll_interval = self.nonce_poll_interval;
        let cancel_poll = self.cancel_token.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(poll_interval);
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        let _ = tx_nonce.send(()).await;
                    }
                    _ = cancel_poll.cancelled() => break,
                }
            }
        });

        // Debounce: wait 2s after last event before reloading
        let mut debounce_deadline: Option<tokio::time::Instant> = None;

        loop {
            tokio::select! {
                Some(()) = rx.recv() => {
                    debounce_deadline = Some(tokio::time::Instant::now() + Duration::from_secs(2));
                }
                _ = async {
                    if let Some(deadline) = debounce_deadline {
                        tokio::time::sleep_until(deadline).await;
                    } else {
                        std::future::pending::<()>().await;
                    }
                } => {
                    debounce_deadline = None;
                    self.do_reload().await;
                }
                _ = self.cancel_token.cancelled() => {
                    info!("DeploymentWatcher shutting down");
                    break;
                }
            }
        }
    }

    async fn do_reload(&self) {
        let old_config = self.config.load();
        match old_config.reload().await {
            Ok((new_config, nonce_changed)) => {
                let diffs = old_config.diff(&new_config);
                if diffs.is_empty() {
                    return; // No changes
                }

                info!("Config reloaded: {}", diffs.join(", "));

                if nonce_changed {
                    let old_nonce = old_config.deployment_nonce;
                    let new_nonce = new_config.deployment_nonce;
                    info!("Deployment nonce changed: {old_nonce} -> {new_nonce}. Triggering full flush.");
                    if let Some(ref cb) = self.flush_callback {
                        cb(old_nonce, new_nonce);
                    }
                }

                // Atomic swap
                self.config.store(Arc::new(new_config.clone()));

                if let Some(ref cb) = self.reload_callback {
                    cb(&old_config, &new_config);
                }
            }
            Err(e) => {
                warn!("Config reload failed (keeping old config): {e}");
            }
        }
    }
}
