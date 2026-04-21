//! Postgres writer. Populated in chunk 2.

use anyhow::Result;
use deadpool_postgres::Pool;
use tokio::sync::mpsc::Receiver;

use crate::config::Config;
use crate::subscriber::RawLog;

pub async fn run(_cfg: Config, _pool: Pool, mut rx: Receiver<RawLog>) -> Result<()> {
    // Chunk 2 replaces this with the real parse-and-insert loop.
    while let Some(_log) = rx.recv().await {
        // drain
    }
    Ok(())
}
