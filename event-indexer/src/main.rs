//! Entrypoint. Load config, bootstrap the schema, start the subscriber,
//! fan parsed events into the writer. Nothing more — the process is a
//! conduit, not a decision-maker.

use anyhow::Result;
use tracing::info;
use tracing_subscriber::{fmt, EnvFilter};

mod config;
mod db;
mod parser;
mod subscriber;
mod writer;

use config::Config;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();

    let cfg = Config::from_env()?;
    info!(
        rpc_ws = %cfg.rpc_ws_url,
        program = %cfg.program_id,
        schema = %cfg.postgres_schema,
        "starting prediction-market indexer",
    );

    let pool = db::build_pool(&cfg.postgres_url).await?;
    db::ensure_schema(&pool, &cfg.postgres_schema).await?;

    // Bounded channel — backpressure on the websocket side if Postgres
    // falls behind. A minute of events at typical load fits comfortably.
    let (tx, rx) = tokio::sync::mpsc::channel::<subscriber::RawLog>(1024);

    let subscriber_handle = tokio::spawn(subscriber::run(cfg.clone(), tx));
    let writer_handle = tokio::spawn(writer::run(cfg.clone(), pool, rx));

    // The first task to return decides the exit code. Both are designed
    // to loop forever; any return is a fatal error we want to surface.
    tokio::select! {
        r = subscriber_handle => {
            r??;
            anyhow::bail!("subscriber exited unexpectedly");
        }
        r = writer_handle => {
            r??;
            anyhow::bail!("writer exited unexpectedly");
        }
        _ = tokio::signal::ctrl_c() => {
            info!("shutdown signal received");
            Ok(())
        }
    }
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,prediction_market_indexer=debug"));
    fmt().with_env_filter(filter).with_target(false).init();
}
