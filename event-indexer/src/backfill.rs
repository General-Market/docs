//! RPC backfill. Closes the gap that `logsSubscribe` leaves whenever the
//! websocket disconnects or the process restarts.
//!
//! The shape:
//!   1. Read the persisted cursor — the newest signature we've durably written.
//!   2. Walk `getSignaturesForAddress(program_id, { before, until: cursor })`
//!      in pages of 1000, stopping when we hit the cursor or the cap.
//!   3. Reverse the collected list (RPC returns newest-first; we want
//!      oldest-first so the cursor advances monotonically) and feed each
//!      signature into the same writer channel the subscriber uses.
//!
//! On a fresh install (cursor absent), we do NOT replay the program's
//! entire history — we persist the current chain tip as the cursor and
//! let the live subscriber take it from there. Anything else would
//! guarantee a runaway backfill every time a new deployment starts.
//!
//! Pagination cap: 10_000 transactions. A ceiling, not a target. If the
//! indexer is ever so far behind that this bound matters, operator
//! attention is required — logging the truncation surfaces the condition.

use anyhow::{Context, Result};
use deadpool_postgres::Pool;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_client::rpc_client::GetConfirmedSignaturesForAddress2Config;
use solana_rpc_client_api::config::RpcTransactionConfig;
use solana_sdk::signature::Signature;
use solana_transaction_status_client_types::{
    EncodedTransactionWithStatusMeta, UiTransactionEncoding,
};
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::mpsc::Sender;
use tracing::{debug, info, warn};

use crate::config::Config;
use crate::db;
use crate::subscriber::RawLog;

/// Ceiling on backfilled transactions per run. Fresh installs ignore it —
/// they short-circuit to "record the tip and move on." Existing installs
/// that have somehow fallen more than this far behind get truncated and
/// warned; the next reconnect will keep working the gap down.
pub const MAX_BACKFILL_TXS: usize = 10_000;

/// Upper bound on one `getSignaturesForAddress` page. The RPC caps it at
/// 1000; requesting more is silently clamped.
const PAGE_LIMIT: usize = 1000;

/// Run one backfill pass. Called at startup and before every reconnect.
/// Returns when the gap is closed, the cap is hit, or the RPC refuses —
/// never retries on its own; the outer reconnect loop owns retry cadence.
pub async fn reconcile(
    cfg: &Config,
    pool: &Pool,
    rpc: &Arc<RpcClient>,
    tx: &Sender<RawLog>,
) -> Result<()> {
    let cursor = db::load_cursor(pool, &cfg.postgres_schema)
        .await
        .context("load_cursor failed")?;

    let until = match cursor.as_ref() {
        Some((sig, slot)) => {
            info!(cursor_sig = %sig, cursor_slot = slot, "backfill starting from cursor");
            Some(Signature::from_str(sig).context("cursor signature not parseable")?)
        }
        None => {
            // Fresh install. Record the tip and return; replaying all
            // historical transactions is not what the operator wants
            // when they first boot.
            return initialize_cursor(cfg, pool, rpc).await;
        }
    };

    let signatures = collect_signatures(rpc, &cfg.program_id, until).await?;
    if signatures.is_empty() {
        debug!("backfill found no missed signatures");
        return Ok(());
    }

    info!(count = signatures.len(), "backfilling missed transactions");
    for sig_str in signatures {
        match fetch_and_forward(rpc, &sig_str, tx).await {
            Ok(()) => {}
            Err(e) => {
                // Keep going — a single malformed tx is not worth aborting
                // the whole pass. The next reconcile will try again.
                warn!(signature = %sig_str, error = %e, "backfill fetch/forward failed");
            }
        }
    }

    Ok(())
}

/// Record the current chain tip as the cursor without processing any
/// transactions. Protects against the "fresh install replays all history"
/// trap on first boot.
async fn initialize_cursor(cfg: &Config, pool: &Pool, rpc: &Arc<RpcClient>) -> Result<()> {
    let cfg_req = GetConfirmedSignaturesForAddress2Config {
        before: None,
        until: None,
        limit: Some(1),
        commitment: Some(rpc.commitment()),
    };
    let page = rpc
        .get_signatures_for_address_with_config(&cfg.program_id, cfg_req)
        .await
        .context("getSignaturesForAddress(tip) failed")?;
    let Some(tip) = page.into_iter().next() else {
        info!("fresh install: program has no signatures yet; cursor not initialized");
        return Ok(());
    };
    db::save_cursor(pool, &cfg.postgres_schema, &tip.signature, tip.slot)
        .await
        .context("save_cursor failed on initialize")?;
    info!(tip = %tip.signature, slot = tip.slot, "fresh install: cursor anchored at tip");
    Ok(())
}

/// Walk `getSignaturesForAddress` pages newest-first until we hit the
/// cursor, the cap, or an empty page. Returns signatures in the order
/// they'll be replayed — oldest-first.
async fn collect_signatures(
    rpc: &Arc<RpcClient>,
    program: &solana_pubkey::Pubkey,
    until: Option<Signature>,
) -> Result<Vec<String>> {
    let mut collected: Vec<String> = Vec::new();
    let mut before: Option<Signature> = None;

    loop {
        let cfg_req = GetConfirmedSignaturesForAddress2Config {
            before,
            until,
            limit: Some(PAGE_LIMIT),
            commitment: Some(rpc.commitment()),
        };
        let page = rpc
            .get_signatures_for_address_with_config(program, cfg_req)
            .await
            .context("getSignaturesForAddress failed")?;

        if page.is_empty() {
            break;
        }

        // `before` for the next page is the oldest signature on this one.
        // Save the cursor before we consume `page`.
        let next_before = Signature::from_str(&page[page.len() - 1].signature)
            .context("page tail signature not parseable")?;

        for entry in page {
            // Skip failed transactions — they committed nothing worth
            // indexing. The subscriber writer applies the same rule.
            if entry.err.is_some() {
                continue;
            }
            collected.push(entry.signature);
            if collected.len() >= MAX_BACKFILL_TXS {
                warn!(
                    cap = MAX_BACKFILL_TXS,
                    "backfill hit safety cap; older transactions will be caught on the next reconnect",
                );
                // Reverse before returning so the caller sees oldest-first.
                collected.reverse();
                return Ok(collected);
            }
        }

        before = Some(next_before);
    }

    // Page order: newest-first. Reverse so successive writes move the
    // cursor monotonically forward.
    collected.reverse();
    Ok(collected)
}

/// Pull the full transaction by signature and push its logs into the
/// writer's channel. The writer is agnostic to source — a backfilled
/// RawLog is indistinguishable from a live-subscribed one, which is the
/// whole point.
async fn fetch_and_forward(
    rpc: &Arc<RpcClient>,
    signature_str: &str,
    tx: &Sender<RawLog>,
) -> Result<()> {
    let signature = Signature::from_str(signature_str)
        .context("signature parse failed")?;
    let cfg = RpcTransactionConfig {
        encoding: Some(UiTransactionEncoding::Json),
        commitment: Some(rpc.commitment()),
        // v0 transactions are table-routed; without this the RPC rejects
        // them. `0` is the current max supported version.
        max_supported_transaction_version: Some(0),
    };
    let enc = rpc
        .get_transaction_with_config(&signature, cfg)
        .await
        .context("getTransaction failed")?;

    let slot = enc.slot;
    let logs = extract_logs(&enc.transaction);
    let err = match &enc.transaction.meta {
        Some(m) => m.err.as_ref().map(|e| format!("{e:?}")),
        None => None,
    };

    let raw = RawLog {
        signature: signature_str.to_string(),
        slot,
        logs,
        err,
    };
    if tx.send(raw).await.is_err() {
        anyhow::bail!("writer channel closed during backfill");
    }
    Ok(())
}

/// Pull the log lines out of a meta block, handling the `OptionSerializer`
/// wrapper without leaking its type through the module boundary.
fn extract_logs(tx: &EncodedTransactionWithStatusMeta) -> Vec<String> {
    let Some(meta) = &tx.meta else {
        return Vec::new();
    };
    Option::from(meta.log_messages.clone()).unwrap_or_default()
}
