//! WebSocket subscriber. `logsSubscribe` on the program ID streams
//! every tx that mentions the program. Logs plus signature and slot are
//! pushed to the writer channel.
//!
//! Reconnect policy: exponential backoff, unbounded retries. Packet
//! loss during a reconnect window is a tolerable lossy edge — the
//! re-subscription restarts near-realtime. A proper backfill path is
//! out of scope here; if strict historical completeness is required
//! later, a periodic `getSignaturesForAddress` sweep can reconcile gaps.

use anyhow::{Context, Result};
use backoff::{backoff::Backoff, ExponentialBackoffBuilder};
use futures_util::StreamExt;
use solana_client::nonblocking::pubsub_client::PubsubClient;
use solana_client::rpc_config::{RpcTransactionLogsConfig, RpcTransactionLogsFilter};
use solana_commitment_config::CommitmentConfig;
use std::time::Duration;
use tokio::sync::mpsc::Sender;
use tracing::{error, info, warn};

use crate::config::Config;

/// One transaction worth of logs, paired with the metadata we'll need
/// when writing rows.
#[derive(Debug, Clone)]
pub struct RawLog {
    pub signature: String,
    pub slot: u64,
    pub logs: Vec<String>,
    pub err: Option<String>,
}

pub async fn run(cfg: Config, tx: Sender<RawLog>) -> Result<()> {
    let mut backoff = ExponentialBackoffBuilder::new()
        .with_initial_interval(Duration::from_secs(1))
        .with_max_interval(Duration::from_secs(30))
        .with_max_elapsed_time(None) // retry forever
        .build();

    loop {
        match subscribe_once(&cfg, &tx).await {
            Ok(()) => {
                // Subscription ended gracefully — rare, but retry anyway.
                warn!("logsSubscribe stream ended; reconnecting");
            }
            Err(e) => {
                error!(error = %e, "logsSubscribe failed; reconnecting");
            }
        }

        let wait = backoff.next_backoff().unwrap_or(Duration::from_secs(30));
        tokio::time::sleep(wait).await;
    }
}

async fn subscribe_once(cfg: &Config, tx: &Sender<RawLog>) -> Result<()> {
    info!(url = %cfg.rpc_ws_url, "opening pubsub connection");
    let client = PubsubClient::new(&cfg.rpc_ws_url)
        .await
        .context("PubsubClient::new failed")?;

    let filter = RpcTransactionLogsFilter::Mentions(vec![cfg.program_id.to_string()]);
    let config = RpcTransactionLogsConfig {
        commitment: Some(CommitmentConfig::confirmed()),
    };

    let (mut stream, unsub) = client.logs_subscribe(filter, config)
        .await
        .context("logs_subscribe failed")?;
    info!("logs subscription active");

    while let Some(msg) = stream.next().await {
        let slot = msg.context.slot;
        let value = msg.value;
        let raw = RawLog {
            signature: value.signature,
            slot,
            logs: value.logs,
            err: value.err.map(|e| format!("{e:?}")),
        };
        if tx.send(raw).await.is_err() {
            warn!("writer channel closed; unsubscribing");
            break;
        }
    }

    // Best-effort cleanup. `unsub` moves the unsubscribe closure; if the
    // stream already ended it's a no-op.
    unsub().await;
    Ok(())
}
