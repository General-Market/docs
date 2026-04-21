//! Websocket subscriber. Populated in chunk 2.

use anyhow::Result;
use tokio::sync::mpsc::Sender;

use crate::config::Config;

/// Placeholder carrier until chunk 2 wires the real schema.
#[derive(Debug, Clone)]
pub struct RawLog {
    pub signature: String,
    pub slot: u64,
    pub logs: Vec<String>,
}

pub async fn run(_cfg: Config, _tx: Sender<RawLog>) -> Result<()> {
    // Chunk 2 replaces this with a real logsSubscribe loop.
    futures_util::future::pending::<()>().await;
    Ok(())
}
