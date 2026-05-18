//! The scheduler — one async loop, three queries per wake, crank everything
//! actionable, sleep, repeat.
//!
//! Stateless by construction. Every decision comes from chain reads; the
//! process holds nothing between ticks except its keypair and the RPC
//! connection.

use anyhow::Result;
use futures::stream::{FuturesUnordered, StreamExt};
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::Semaphore;
use tracing::{error, info, warn};

use crate::feed::Feed;
use crate::identity::Identity;
use crate::indexer::IndexerClient;
use crate::metrics::Metrics;
use crate::scanner::{MarketRecord, PositionRecord, Scanner};
use crate::submitter;

/// Max in-flight transactions per wake. Solana RPC nodes rate-limit; a
/// handful of concurrent submissions is the sweet spot.
const CONCURRENCY: usize = 8;

pub struct SchedulerState {
    pub rpc: Arc<RpcClient>,
    pub feed: Feed,
    pub identity: Arc<Identity>,
    pub program_id: Pubkey,
    pub metrics: Metrics,
    pub stake_mint: Pubkey,
    pub poll_interval: Duration,
    /// Indexer Postgres client, when configured. The scanner uses it to
    /// avoid getProgramAccounts on free-tier RPCs.
    pub indexer: Option<Arc<IndexerClient>>,
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub async fn run(state: Arc<SchedulerState>, mut shutdown: tokio::sync::watch::Receiver<bool>) -> Result<()> {
    info!(
        poll_secs = state.poll_interval.as_secs(),
        indexer = state.indexer.is_some(),
        "scheduler started"
    );
    let scanner = match state.indexer.clone() {
        Some(idx) => Scanner::with_indexer(state.rpc.clone(), state.program_id, idx),
        None => Scanner::new(state.rpc.clone(), state.program_id),
    };

    loop {
        if *shutdown.borrow() {
            info!("scheduler received shutdown; exiting");
            return Ok(());
        }

        let tick_started = std::time::Instant::now();
        if let Err(e) = tick(&state, &scanner).await {
            error!(error = %e, "scheduler tick failed");
        }
        let elapsed = tick_started.elapsed();
        let sleep_for = state.poll_interval.saturating_sub(elapsed);

        tokio::select! {
            _ = tokio::time::sleep(sleep_for) => {}
            _ = shutdown.changed() => {
                info!("scheduler shutdown signal while sleeping");
                return Ok(());
            }
        }
    }
}

async fn tick(state: &Arc<SchedulerState>, scanner: &Scanner) -> Result<()> {
    let now = now_unix();

    let closes = scanner.markets_needing_close(now).await.unwrap_or_else(|e| {
        error!(error = %e, "markets_needing_close query failed");
        Vec::new()
    });
    let resolves = scanner.markets_needing_resolve(now).await.unwrap_or_else(|e| {
        error!(error = %e, "markets_needing_resolve query failed");
        Vec::new()
    });
    let claims = scanner.positions_needing_claim().await.unwrap_or_else(|e| {
        error!(error = %e, "positions_needing_claim query failed");
        Vec::new()
    });

    state
        .metrics
        .markets_awaiting_close
        .set(closes.len() as f64);
    state
        .metrics
        .markets_awaiting_resolve
        .set(resolves.len() as f64);
    state
        .metrics
        .markets_awaiting_claim
        .set(claims.len() as f64);

    if !closes.is_empty() {
        info!(count = closes.len(), "markets needing close");
    }
    if !resolves.is_empty() {
        info!(count = resolves.len(), "markets needing resolve");
    }
    if !claims.is_empty() {
        info!(count = claims.len(), "positions needing claim");
    }

    // Refresh the SOL balance gauge each tick so operators can see drain.
    if let Ok(lamports) = state.rpc.get_balance(&state.identity.pubkey).await {
        state
            .metrics
            .keypair_sol_balance
            .set(lamports as f64 / 1_000_000_000.0);
    }

    // Resolves first, then claims, then closes. Resolves are the
    // pipeline's terminal state — each one unblocks user money. A
    // close merely shifts work into the resolve queue. With FIFO
    // ordering and a Semaphore cap of CONCURRENCY, the queue starves
    // whichever phase comes after closes until every close drains.
    // For a 1.6k-deep close queue, that meant hours of user-visible
    // "settling" while resolves never landed.
    //
    // Phase 4a: each "job" submits a small batch of items in one tx
    // instead of one tx per item. The legacy 1232-byte wire limit
    // accommodates 4 close/resolve pairs (precompile + program ix) or
    // 3 claim ixs comfortably; tighter packing needs LUTs (Phase 4b).
    let sem = Arc::new(Semaphore::new(CONCURRENCY));
    let mut jobs = FuturesUnordered::new();

    for chunk in chunks_of(resolves, RESOLVE_BATCH) {
        let sem = sem.clone();
        let state = state.clone();
        jobs.push(tokio::spawn(async move {
            let _permit = sem.acquire_owned().await.unwrap();
            run_resolve_batch(state, chunk).await
        }));
    }
    for chunk in chunks_of(claims, CLAIM_BATCH) {
        let sem = sem.clone();
        let state = state.clone();
        jobs.push(tokio::spawn(async move {
            let _permit = sem.acquire_owned().await.unwrap();
            run_claim_batch(state, chunk).await
        }));
    }
    for chunk in chunks_of(closes, CLOSE_BATCH) {
        let sem = sem.clone();
        let state = state.clone();
        jobs.push(tokio::spawn(async move {
            let _permit = sem.acquire_owned().await.unwrap();
            run_close_batch(state, chunk).await
        }));
    }

    while let Some(res) = jobs.next().await {
        match res {
            Ok(Ok(())) => {}
            Ok(Err(e)) => warn!(error = %e, "job failed"),
            Err(e) => warn!(error = %e, "job panicked"),
        }
    }

    Ok(())
}

// Phase 4a batch sizes. Picked conservatively against the legacy 1232-byte
// tx wire limit. Closes/resolves bundle (precompile + program-ix) per item
// at ~250 B; claims are smaller but their account list is fatter, so the
// safe count is lower. If a batch ever overflows, send_legacy_tx surfaces
// the error and the next scan will retry the survivors at smaller chunks
// (next tick reads fresh).
// Close/resolve are stuck at one per tx until Phase 4b. The program's
// `verify_multisig` reads `load_instruction_at_checked(i, ix_sysvar)`
// for i in 0..sigs.len() — it hardcodes "the precompile lives at ix
// index 0". A second (close, precompile) pair in the same tx fails
// with BadSignature because both close ixs look at ix 0. The fix lives
// in the program: accept a `precompile_index_offset` arg and read
// `load_instruction_at_checked(offset + i, ...)`. That's Phase 4b.
//
// Claims have no precompile dependency, so they batch cleanly. ~280 B
// per claim ix → three fits in the 1232 B legacy wire limit with margin.
const CLOSE_BATCH: usize = 1;
const RESOLVE_BATCH: usize = 1;
const CLAIM_BATCH: usize = 3;

fn chunks_of<T>(items: Vec<T>, size: usize) -> Vec<Vec<T>> {
    if size <= 1 {
        return items.into_iter().map(|x| vec![x]).collect();
    }
    let mut out: Vec<Vec<T>> = Vec::with_capacity(items.len().div_ceil(size));
    let mut cur: Vec<T> = Vec::with_capacity(size);
    for it in items {
        cur.push(it);
        if cur.len() == size {
            out.push(std::mem::take(&mut cur));
            cur.reserve(size);
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

async fn run_close_batch(state: Arc<SchedulerState>, recs: Vec<MarketRecord>) -> Result<()> {
    if recs.is_empty() { return Ok(()); }
    let mut items: Vec<submitter::CloseItem> = Vec::with_capacity(recs.len());
    for rec in &recs {
        let price = match state.feed.price(rec.market.source_id).await {
            Ok(p) => p,
            Err(e) => {
                warn!(source = rec.market.source_id, error = %e, "feed price fetch failed (close)");
                continue;
            }
        };
        items.push(submitter::CloseItem {
            market: rec.address,
            source_id: rec.market.source_id,
            close_time: rec.market.close_time,
            baseline_price: price.price,
        });
    }
    if items.is_empty() { return Ok(()); }
    let cranker_kp = clone_keypair(&state.identity.keypair);
    match submitter::submit_close_batch(
        &state.rpc,
        &cranker_kp,
        &state.identity.signing_key,
        &state.program_id,
        &items,
    ).await {
        Ok(sig) => {
            info!(count = items.len(), tx = %sig, "close_market batch submitted");
            state.metrics.last_tx_success_ts.set(now_unix() as f64);
        }
        Err(e) => {
            warn!(count = items.len(), error = %e, "close_market batch failed");
            state.metrics.tx_failures_total.inc();
        }
    }
    Ok(())
}

async fn run_resolve_batch(state: Arc<SchedulerState>, recs: Vec<MarketRecord>) -> Result<()> {
    if recs.is_empty() { return Ok(()); }
    let mut items: Vec<submitter::ResolveItem> = Vec::with_capacity(recs.len());
    for rec in &recs {
        let price = match state.feed.price(rec.market.source_id).await {
            Ok(p) => p,
            Err(e) => {
                warn!(source = rec.market.source_id, error = %e, "feed price fetch failed (resolve)");
                continue;
            }
        };
        items.push(submitter::ResolveItem {
            market: rec.address,
            source_id: rec.market.source_id,
            settlement_time: rec.market.settlement_time,
            final_price: price.price,
        });
    }
    if items.is_empty() { return Ok(()); }
    let cranker_kp = clone_keypair(&state.identity.keypair);
    match submitter::submit_resolve_batch(
        &state.rpc,
        &cranker_kp,
        &state.identity.signing_key,
        &state.program_id,
        &items,
    ).await {
        Ok(sig) => {
            info!(count = items.len(), tx = %sig, "resolve_market batch submitted");
            state.metrics.last_tx_success_ts.set(now_unix() as f64);
        }
        Err(e) => {
            warn!(count = items.len(), error = %e, "resolve_market batch failed");
            state.metrics.tx_failures_total.inc();
        }
    }
    Ok(())
}

async fn run_claim_batch(state: Arc<SchedulerState>, recs: Vec<PositionRecord>) -> Result<()> {
    if recs.is_empty() { return Ok(()); }
    let items: Vec<submitter::ClaimItem> = recs.iter().map(|rec| submitter::ClaimItem {
        market: rec.market_address,
        position: rec.address,
        owner: rec.position.owner,
        stake_mint: state.stake_mint,
    }).collect();
    let cranker_kp = clone_keypair(&state.identity.keypair);
    match submitter::submit_claim_batch(
        &state.rpc,
        &cranker_kp,
        &state.program_id,
        &items,
    ).await {
        Ok(sig) => {
            info!(count = items.len(), tx = %sig, "claim batch submitted");
            state.metrics.last_tx_success_ts.set(now_unix() as f64);
        }
        Err(e) => {
            warn!(count = items.len(), error = %e, "claim batch failed");
            state.metrics.tx_failures_total.inc();
        }
    }
    Ok(())
}

#[allow(dead_code)]
async fn run_close(state: Arc<SchedulerState>, rec: MarketRecord) -> Result<()> {
    let price = match state.feed.price(rec.market.source_id).await {
        Ok(p) => p,
        Err(e) => {
            warn!(source = rec.market.source_id, error = %e, "feed price fetch failed (close)");
            return Ok(());
        }
    };
    let cranker_kp = clone_keypair(&state.identity.keypair);
    match submitter::submit_close(
        &state.rpc,
        &cranker_kp,
        &state.identity.signing_key,
        &state.program_id,
        &rec.address,
        rec.market.source_id,
        rec.market.close_time,
        price.price,
    )
    .await
    {
        Ok(sig) => {
            info!(market = %rec.address, tx = %sig, "close_market submitted");
            state.metrics.last_tx_success_ts.set(now_unix() as f64);
        }
        Err(e) => {
            warn!(market = %rec.address, error = %e, "close_market failed");
            state.metrics.tx_failures_total.inc();
        }
    }
    Ok(())
}

#[allow(dead_code)]
async fn run_resolve(state: Arc<SchedulerState>, rec: MarketRecord) -> Result<()> {
    let price = match state.feed.price(rec.market.source_id).await {
        Ok(p) => p,
        Err(e) => {
            warn!(source = rec.market.source_id, error = %e, "feed price fetch failed (resolve)");
            return Ok(());
        }
    };
    let cranker_kp = clone_keypair(&state.identity.keypair);
    match submitter::submit_resolve(
        &state.rpc,
        &cranker_kp,
        &state.identity.signing_key,
        &state.program_id,
        &rec.address,
        rec.market.source_id,
        rec.market.settlement_time,
        price.price,
    )
    .await
    {
        Ok(sig) => {
            info!(market = %rec.address, tx = %sig, "resolve_market submitted");
            state.metrics.last_tx_success_ts.set(now_unix() as f64);
        }
        Err(e) => {
            warn!(market = %rec.address, error = %e, "resolve_market failed");
            state.metrics.tx_failures_total.inc();
        }
    }
    Ok(())
}

#[allow(dead_code)]
async fn run_claim(state: Arc<SchedulerState>, rec: PositionRecord) -> Result<()> {
    let cranker_kp = clone_keypair(&state.identity.keypair);
    match submitter::submit_claim(
        &state.rpc,
        &cranker_kp,
        &state.program_id,
        &rec.market_address,
        &rec.address,
        &rec.position.owner,
        &state.stake_mint,
    )
    .await
    {
        Ok(sig) => {
            info!(
                market = %rec.market_address,
                position = %rec.address,
                owner = %rec.position.owner,
                tx = %sig,
                "claim submitted"
            );
            state.metrics.last_tx_success_ts.set(now_unix() as f64);
        }
        Err(e) => {
            warn!(position = %rec.address, error = %e, "claim failed");
            state.metrics.tx_failures_total.inc();
        }
    }
    Ok(())
}

fn clone_keypair(kp: &Keypair) -> Keypair {
    // `Keypair` is not `Clone`. The SDK exposes `insecure_clone` — the name
    // is melodrama; it just copies the 64 bytes.
    kp.insecure_clone()
}

/// Fetch the stake mint from `GlobalConfig` once at boot. Needed for `claim`
/// transactions — the program passes `stake_mint` as an account.
pub async fn fetch_stake_mint(rpc: &RpcClient, program_id: &Pubkey) -> Result<Pubkey> {
    use anchor_lang::AccountDeserialize;
    use prediction_market::state::GlobalConfig;
    let (config_pda, _) = Pubkey::find_program_address(&[b"config"], program_id);
    let acct = rpc.get_account(&config_pda).await?;
    let cfg = GlobalConfig::try_deserialize(&mut acct.data.as_slice())?;
    Ok(cfg.stake_mint)
}
