//! Live VisionVault share-event ledger.
//!
//! Watches every registered VisionVault for `DepositClaimed`, `WithdrawClaimed`
//! and ERC-20 `Transfer` logs, and writes one row per event to
//! `account_vault_positions`. Each row carries the running `shares_after`,
//! `cost_basis_after` and `realized_pnl_after` for that (account, vault),
//! so the precompute writer downstream needs nothing but this table and
//! `vault_snapshots` to materialize the per-account PnL curve.
//!
//! Idempotent: the unique key `(account, vault, block_number, log_index)`
//! makes replays safe. Cursors are stored in `chain_event_cursors`.

use ethers::prelude::*;
use ethers::core::utils::keccak256;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, info, warn};

use crate::api::AppState;

pub(crate) struct VaultEventTopics {
    pub deposit_claimed: H256,
    pub withdraw_claimed: H256,
    pub transfer: H256,
}

impl VaultEventTopics {
    pub fn new() -> Self {
        Self {
            deposit_claimed: H256::from(keccak256("DepositClaimed(address,uint256,uint256)")),
            withdraw_claimed: H256::from(keccak256("WithdrawClaimed(address,uint256,uint256)")),
            transfer: H256::from(keccak256("Transfer(address,address,uint256)")),
        }
    }

    pub fn as_filter(&self) -> Vec<H256> {
        vec![self.deposit_claimed, self.withdraw_claimed, self.transfer]
    }
}

pub(crate) async fn apply_one_log(
    pool: &PgPool,
    provider: &Provider<Http>,
    log: &Log,
    topics: &VaultEventTopics,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    apply_log_inner(pool, provider, log, topics).await
}

/// Max blocks per `eth_getLogs` call. L3 RPC accepts wide ranges;
/// keeping this finite avoids a single bad block range stalling the writer.
const MAX_BLOCK_RANGE: u64 = 5_000;
/// Reorg buffer — the L3 sequencer is single-writer but we still leave a
/// margin so we never write a row from a block that disappears.
const REORG_BUFFER: u64 = 2;
/// On a fresh install (cursor row absent) we begin from `latest - INITIAL_LOOKBACK`
/// rather than 0. Backfill is the right tool for ancient history.
const INITIAL_LOOKBACK: u64 = 5_000;

#[repr(i16)]
enum EventKind {
    DepositClaimed = 0,
    WithdrawClaimed = 1,
    TransferIn = 2,
    TransferOut = 3,
}

/// Spawn the writer. Returns a JoinHandle the caller can ignore — the loop
/// runs until the process exits or the vault registry is empty.
pub fn spawn(state: Arc<AppState>) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move { run(state).await })
}

async fn run(state: Arc<AppState>) {
    let vaults: Vec<Address> = state
        .vision_vaults_info
        .iter()
        .map(|v| v.address)
        .collect();

    if vaults.is_empty() {
        warn!("vault_event_writer: no vaults registered, exiting");
        return;
    }

    let topics = VaultEventTopics::new();
    let topic_filter = topics.as_filter();

    let provider = Arc::clone(&state.l3_provider);
    let pool = state.pool.clone();

    let mut cursor = match load_cursor(&pool).await {
        Some(c) => c,
        None => match provider.get_block_number().await {
            Ok(bn) => bn.as_u64().saturating_sub(INITIAL_LOOKBACK),
            Err(e) => {
                warn!("vault_event_writer: cannot read latest block: {e}");
                return;
            }
        },
    };

    info!(
        vaults = vaults.len(),
        starting_block = cursor,
        "vault_event_writer running"
    );

    let mut ticks_since_log: u64 = 0;
    let poll = Duration::from_secs(2);

    loop {
        tokio::time::sleep(poll).await;

        let latest = match provider.get_block_number().await {
            Ok(bn) => bn.as_u64(),
            Err(e) => {
                warn!("vault_event_writer: get_block_number failed: {e}");
                continue;
            }
        };

        let safe_head = latest.saturating_sub(REORG_BUFFER);
        if safe_head <= cursor {
            ticks_since_log += 1;
            if ticks_since_log >= 60 {
                debug!(cursor, latest, "vault_event_writer alive — no new blocks");
                ticks_since_log = 0;
            }
            continue;
        }

        let from = cursor + 1;
        let to = std::cmp::min(safe_head, cursor + MAX_BLOCK_RANGE);

        let filter = Filter::new()
            .address(vaults.clone())
            .topic0(topic_filter.clone())
            .from_block(from)
            .to_block(to);

        match provider.get_logs(&filter).await {
            Ok(mut logs) => {
                logs.sort_by_key(|l| {
                    (
                        l.block_number.map(|b| b.as_u64()).unwrap_or(0),
                        l.log_index.map(|i| i.as_u64()).unwrap_or(0),
                    )
                });

                let mut written = 0usize;
                for log in &logs {
                    if log.topics.is_empty() {
                        continue;
                    }
                    let topic0 = log.topics[0];
                    let kind = if topic0 == topics.deposit_claimed {
                        Some(EventKind::DepositClaimed)
                    } else if topic0 == topics.withdraw_claimed {
                        Some(EventKind::WithdrawClaimed)
                    } else if topic0 == topics.transfer {
                        Some(EventKind::TransferOut)
                    } else {
                        None
                    };
                    if kind.is_none() {
                        continue;
                    }

                    if let Err(e) = apply_log_inner(&pool, &provider, log, &topics).await {
                        // One bad log shouldn't poison the whole batch — log,
                        // skip, keep going. The cursor advances anyway because
                        // the unique key would catch a duplicate replay.
                        warn!(?e, ?topic0, "vault_event_writer: apply_log failed");
                    } else {
                        written += 1;
                    }
                }

                if written > 0 {
                    info!(
                        from,
                        to,
                        events = logs.len(),
                        rows = written,
                        "vault_event_writer batch"
                    );
                }

                if let Err(e) = save_cursor(&pool, to as i64).await {
                    warn!(?e, to, "vault_event_writer: cursor save failed");
                }
                cursor = to;
                ticks_since_log = 0;
            }
            Err(e) => {
                warn!(from, to, %e, "vault_event_writer: get_logs failed, retrying");
            }
        }
    }
}

async fn load_cursor(pool: &PgPool) -> Option<u64> {
    sqlx::query_scalar::<_, i64>(
        "SELECT last_block FROM chain_event_cursors WHERE scope = $1 AND chain = $2",
    )
    .bind("vault-events")
    .bind("l3")
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|b| b as u64)
}

async fn save_cursor(pool: &PgPool, block: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO chain_event_cursors (scope, chain, last_block, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (scope, chain) DO UPDATE
            SET last_block = EXCLUDED.last_block, updated_at = NOW()",
    )
    .bind("vault-events")
    .bind("l3")
    .bind(block)
    .execute(pool)
    .await
    .map(|_| ())
}

async fn apply_log_inner(
    pool: &PgPool,
    provider: &Provider<Http>,
    log: &Log,
    topics: &VaultEventTopics,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let topic0 = log.topics[0];
    let block_number = log.block_number.ok_or("log missing block_number")?.as_u64();
    let log_index = log.log_index.ok_or("log missing log_index")?.as_u64();
    let tx_hash = log.transaction_hash.unwrap_or_default();
    let vault = log.address;

    let block_time = block_timestamp(provider, block_number).await?;

    if topic0 == topics.deposit_claimed {
        let receiver = topic_addr(log, 1)?;
        let (assets, shares) = decode_two_uint256(&log.data)?;
        upsert_position(
            pool,
            receiver,
            vault,
            block_number,
            block_time,
            log_index,
            shares,
            ethers::types::I256::zero(),  // realized delta = 0
            assets,                         // cost basis delta = +assets
            EventKind::DepositClaimed,
            tx_hash,
        )
        .await?;
    } else if topic0 == topics.withdraw_claimed {
        let receiver = topic_addr(log, 1)?;
        let (assets, shares) = decode_two_uint256(&log.data)?;
        burn_position(pool, receiver, vault, block_number, block_time, log_index, shares, assets, tx_hash).await?;
    } else if topic0 == topics.transfer {
        let from = topic_addr(log, 1)?;
        let to = topic_addr(log, 2)?;
        let amount = decode_one_uint256(&log.data)?;

        // Mints (from=0) and burns (to=0) come paired with the Deposit/Withdraw
        // events above. Acting on either side here would double-count.
        if from == Address::zero() || to == Address::zero() {
            return Ok(());
        }

        transfer_position(pool, from, to, vault, block_number, block_time, log_index, amount, tx_hash)
            .await?;
    }

    Ok(())
}

async fn block_timestamp(
    provider: &Provider<Http>,
    block_number: u64,
) -> Result<chrono::DateTime<chrono::Utc>, Box<dyn std::error::Error + Send + Sync>> {
    let block = provider
        .get_block(block_number)
        .await?
        .ok_or("block not found")?;
    let secs = block.timestamp.as_u64() as i64;
    Ok(chrono::DateTime::<chrono::Utc>::from_timestamp(secs, 0).unwrap_or_default())
}

fn topic_addr(log: &Log, idx: usize) -> Result<Address, Box<dyn std::error::Error + Send + Sync>> {
    let topic = log.topics.get(idx).ok_or("missing topic")?;
    Ok(Address::from(*topic))
}

fn decode_two_uint256(data: &Bytes) -> Result<(U256, U256), Box<dyn std::error::Error + Send + Sync>> {
    if data.len() < 64 {
        return Err("log data shorter than two uint256".into());
    }
    let a = U256::from_big_endian(&data[..32]);
    let b = U256::from_big_endian(&data[32..64]);
    Ok((a, b))
}

fn decode_one_uint256(data: &Bytes) -> Result<U256, Box<dyn std::error::Error + Send + Sync>> {
    if data.len() < 32 {
        return Err("log data shorter than one uint256".into());
    }
    Ok(U256::from_big_endian(&data[..32]))
}

/// Read the most recent (account, vault) row to seed running totals.
async fn read_running_totals(
    pool: &PgPool,
    account: Address,
    vault: Address,
) -> Result<(U256, U256, U256), Box<dyn std::error::Error + Send + Sync>> {
    let row: Option<(String, String, String)> = sqlx::query_as(
        "SELECT shares_after::text, cost_basis_after::text, realized_pnl_after::text
         FROM account_vault_positions
         WHERE account = $1 AND vault_address = $2
         ORDER BY block_number DESC, log_index DESC
         LIMIT 1",
    )
    .bind(account.as_bytes())
    .bind(vault.as_bytes())
    .fetch_optional(pool)
    .await?;

    Ok(match row {
        Some((s, c, r)) => (
            U256::from_dec_str(&s).unwrap_or_default(),
            U256::from_dec_str(&c).unwrap_or_default(),
            U256::from_dec_str(&r).unwrap_or_default(),
        ),
        None => (U256::zero(), U256::zero(), U256::zero()),
    })
}

#[allow(clippy::too_many_arguments)]
async fn upsert_position(
    pool: &PgPool,
    account: Address,
    vault: Address,
    block_number: u64,
    block_time: chrono::DateTime<chrono::Utc>,
    log_index: u64,
    shares_delta: U256,
    realized_delta: ethers::types::I256,
    cost_basis_delta: U256,
    kind: EventKind,
    tx_hash: H256,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (prev_shares, prev_cost, prev_realized) = read_running_totals(pool, account, vault).await?;
    let new_shares = prev_shares.saturating_add(shares_delta);
    let new_cost = prev_cost.saturating_add(cost_basis_delta);
    let new_realized = if realized_delta.is_negative() {
        prev_realized.saturating_sub(realized_delta.unsigned_abs())
    } else {
        prev_realized.saturating_add(realized_delta.unsigned_abs())
    };
    insert_row(
        pool,
        account,
        vault,
        block_number,
        block_time,
        log_index,
        new_shares,
        new_cost,
        new_realized,
        kind,
        tx_hash,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn burn_position(
    pool: &PgPool,
    account: Address,
    vault: Address,
    block_number: u64,
    block_time: chrono::DateTime<chrono::Utc>,
    log_index: u64,
    shares_burned: U256,
    assets_received: U256,
    tx_hash: H256,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (prev_shares, prev_cost, prev_realized) = read_running_totals(pool, account, vault).await?;
    if prev_shares.is_zero() {
        // Burn without a prior balance — degenerate (replay onto fresh DB).
        // Insert a zero-balance row so the chain of events stays intact.
        insert_row(
            pool,
            account,
            vault,
            block_number,
            block_time,
            log_index,
            U256::zero(),
            U256::zero(),
            prev_realized.saturating_add(assets_received),
            EventKind::WithdrawClaimed,
            tx_hash,
        )
        .await?;
        return Ok(());
    }
    let prorata_cost = prev_cost
        .saturating_mul(shares_burned)
        .checked_div(prev_shares)
        .unwrap_or(U256::zero());
    let new_shares = prev_shares.saturating_sub(shares_burned);
    let new_cost = prev_cost.saturating_sub(prorata_cost);

    // realized_delta = assets_received - prorata_cost. Negative is a loss.
    let new_realized = if assets_received >= prorata_cost {
        prev_realized.saturating_add(assets_received - prorata_cost)
    } else {
        prev_realized.saturating_sub(prorata_cost - assets_received)
    };

    insert_row(
        pool,
        account,
        vault,
        block_number,
        block_time,
        log_index,
        new_shares,
        new_cost,
        new_realized,
        EventKind::WithdrawClaimed,
        tx_hash,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn transfer_position(
    pool: &PgPool,
    from: Address,
    to: Address,
    vault: Address,
    block_number: u64,
    block_time: chrono::DateTime<chrono::Utc>,
    log_index: u64,
    shares: U256,
    tx_hash: H256,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (from_shares, from_cost, from_realized) = read_running_totals(pool, from, vault).await?;
    if from_shares.is_zero() {
        // Sender had no prior balance — log and skip (most likely a replay
        // ordering bug; the unique constraint will save us).
        warn!(?from, ?vault, "transfer with zero sender balance, skipping");
        return Ok(());
    }
    let carried_cost = from_cost
        .saturating_mul(shares)
        .checked_div(from_shares)
        .unwrap_or(U256::zero());

    insert_row(
        pool,
        from,
        vault,
        block_number,
        block_time,
        log_index,
        from_shares.saturating_sub(shares),
        from_cost.saturating_sub(carried_cost),
        from_realized,
        EventKind::TransferOut,
        tx_hash,
    )
    .await?;

    let (to_shares, to_cost, to_realized) = read_running_totals(pool, to, vault).await?;
    insert_row(
        pool,
        to,
        vault,
        block_number,
        block_time,
        log_index,
        to_shares.saturating_add(shares),
        to_cost.saturating_add(carried_cost),
        to_realized,
        EventKind::TransferIn,
        tx_hash,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn insert_row(
    pool: &PgPool,
    account: Address,
    vault: Address,
    block_number: u64,
    block_time: chrono::DateTime<chrono::Utc>,
    log_index: u64,
    shares_after: U256,
    cost_basis_after: U256,
    realized_after: U256,
    kind: EventKind,
    tx_hash: H256,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let kind_i: i16 = kind as i16;
    sqlx::query(
        "INSERT INTO account_vault_positions
            (account, vault_address, block_number, block_time, log_index,
             shares_after, cost_basis_after, realized_pnl_after, event_kind, tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6::text::numeric, $7::text::numeric, $8::text::numeric, $9, $10)
         ON CONFLICT (account, vault_address, block_number, log_index) DO NOTHING",
    )
    .bind(account.as_bytes())
    .bind(vault.as_bytes())
    .bind(block_number as i64)
    .bind(block_time)
    .bind(log_index as i32)
    .bind(shares_after.to_string())
    .bind(cost_basis_after.to_string())
    .bind(realized_after.to_string())
    .bind(kind_i)
    .bind(tx_hash.as_bytes())
    .execute(pool)
    .await?;
    Ok(())
}
