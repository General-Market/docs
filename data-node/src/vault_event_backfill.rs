//! One-shot backfill for `account_vault_positions`.
//!
//! Reads vault addresses from `fund-branding.json`, walks `eth_getLogs` from
//! `--from-block` to `--to-block` in chunks, and replays each Deposit /
//! Withdraw / Transfer through the same `apply_one_log` path the live
//! writer uses. Idempotent — the unique key on `(account, vault, block_number,
//! log_index)` makes this safe to re-run.
//!
//! Run on prod once after the migrations land:
//!   data-node backfill-vault-events --from-block <vault-deploy-block>

use ethers::prelude::*;
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{info, warn};

use crate::config::BackfillVaultEventsArgs;
use crate::vault_event_writer::{apply_one_log, VaultEventTopics};

const REORG_BUFFER: u64 = 2;

pub async fn run(
    args: BackfillVaultEventsArgs,
) -> Result<(), Box<dyn std::error::Error>> {
    init_logging(&args.log_level);

    let pool = match PgPool::connect(&args.database_url).await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("DB connect failed: {e}");
            std::process::exit(1);
        }
    };

    // Apply pending migrations so the table exists when the script is run
    // before the daemon has booted on a new schema.
    if let Err(e) = crate::db::run_migrations_with_seed(&pool, "data-node/migrations").await {
        warn!("migration check failed (continuing): {e}");
    }

    let vaults = match load_vault_addresses(&args.fund_branding_file) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Failed to load fund-branding: {e}");
            std::process::exit(1);
        }
    };
    if vaults.is_empty() {
        eprintln!("No vaults found in {}", args.fund_branding_file);
        std::process::exit(1);
    }

    let provider = match Provider::<Http>::try_from(args.rpc.as_str()) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            eprintln!("RPC URL invalid: {e}");
            std::process::exit(1);
        }
    };

    let latest = match provider.get_block_number().await {
        Ok(n) => n.as_u64(),
        Err(e) => {
            eprintln!("get_block_number failed: {e}");
            std::process::exit(1);
        }
    };
    let to_block = args.to_block.unwrap_or_else(|| latest.saturating_sub(REORG_BUFFER));
    let from_block = args.from_block.unwrap_or(0);

    info!(
        vaults = vaults.len(),
        from_block,
        to_block,
        chunk = args.chunk_size,
        "vault_event_backfill starting"
    );

    let topics = VaultEventTopics::new();
    let topic_filter = topics.as_filter();

    let mut cursor = from_block;
    let mut total_logs = 0u64;
    let mut total_inserted = 0u64;
    let mut last_progress = std::time::Instant::now();

    while cursor <= to_block {
        let chunk_end = std::cmp::min(cursor + args.chunk_size - 1, to_block);

        let filter = Filter::new()
            .address(vaults.clone())
            .topic0(topic_filter.clone())
            .from_block(cursor)
            .to_block(chunk_end);

        match provider.get_logs(&filter).await {
            Ok(mut logs) => {
                logs.sort_by_key(|l| {
                    (
                        l.block_number.map(|b| b.as_u64()).unwrap_or(0),
                        l.log_index.map(|i| i.as_u64()).unwrap_or(0),
                    )
                });

                for log in &logs {
                    total_logs += 1;
                    if let Err(e) = apply_one_log(&pool, &provider, log, &topics).await {
                        warn!(?e, "apply_one_log failed");
                    } else {
                        total_inserted += 1;
                    }
                }

                if last_progress.elapsed().as_secs() >= 5 {
                    info!(
                        cursor = chunk_end,
                        of = to_block,
                        seen = total_logs,
                        inserted = total_inserted,
                        pct = (chunk_end - from_block) as f64
                            * 100.0
                            / (to_block.saturating_sub(from_block).max(1)) as f64,
                        "backfill progress"
                    );
                    last_progress = std::time::Instant::now();
                }
            }
            Err(e) => {
                warn!(
                    cursor,
                    chunk_end,
                    %e,
                    "get_logs failed, halving chunk and retrying"
                );
                let half = (args.chunk_size / 2).max(1);
                if half == args.chunk_size {
                    eprintln!("get_logs failed at minimum chunk size, aborting");
                    std::process::exit(1);
                }
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                let smaller_end = std::cmp::min(cursor + half - 1, to_block);
                let filter2 = Filter::new()
                    .address(vaults.clone())
                    .topic0(topic_filter.clone())
                    .from_block(cursor)
                    .to_block(smaller_end);
                if let Ok(mut logs) = provider.get_logs(&filter2).await {
                    logs.sort_by_key(|l| {
                        (
                            l.block_number.map(|b| b.as_u64()).unwrap_or(0),
                            l.log_index.map(|i| i.as_u64()).unwrap_or(0),
                        )
                    });
                    for log in &logs {
                        total_logs += 1;
                        if apply_one_log(&pool, &provider, log, &topics).await.is_ok() {
                            total_inserted += 1;
                        }
                    }
                    cursor = smaller_end + 1;
                    continue;
                }
            }
        }

        cursor = chunk_end + 1;
    }

    info!(
        seen = total_logs,
        inserted = total_inserted,
        "vault_event_backfill complete"
    );

    // Seed the cursor so the live daemon starts from where backfill stopped.
    sqlx::query(
        "INSERT INTO chain_event_cursors (scope, chain, last_block, updated_at)
         VALUES ('vault-events', 'l3', $1, NOW())
         ON CONFLICT (scope, chain) DO UPDATE
            SET last_block = GREATEST(chain_event_cursors.last_block, EXCLUDED.last_block),
                updated_at = NOW()",
    )
    .bind(to_block as i64)
    .execute(&pool)
    .await
    ?;

    Ok(())
}

fn load_vault_addresses(path: &str) -> Result<Vec<Address>, String> {
    let json: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(path).map_err(|e| format!("read {path}: {e}"))?,
    )
    .map_err(|e| format!("parse {path}: {e}"))?;
    let funds = json["funds"].as_array().ok_or("funds[] missing")?;
    let mut out = Vec::with_capacity(funds.len());
    for f in funds {
        if let Some(s) = f.get("vault").and_then(|v| v.as_str()) {
            if let Ok(a) = s.parse::<Address>() {
                out.push(a);
            }
        }
    }
    Ok(out)
}

fn init_logging(level: &str) {
    use tracing_subscriber::EnvFilter;
    let filter = EnvFilter::try_new(level).unwrap_or_else(|_| EnvFilter::new("info"));
    let _ = tracing_subscriber::fmt().with_env_filter(filter).try_init();
}
