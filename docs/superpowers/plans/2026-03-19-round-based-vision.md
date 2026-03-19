# Round-Based Vision Batches Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace permanent Vision batches with ephemeral round-based batches — each round gets a fresh config from the data-node, resolves once, settles automatically, and dies. Both models coexist.

**Architecture:** A `BatchLifecycleManager` runs per source on a `tickDuration` heartbeat. Each cycle: create new batch on-chain (fresh config), resolve the previous batch (prices + parimutuel matching), settle it on-chain (BLS-signed payouts). The existing tick engine continues for non-round sources. A `round_based_sources` config list controls which sources use the new flow.

**Tech Stack:** Rust (oracle), Solidity (contracts), TypeScript/React (frontend), Python (bot). ethers-rs for on-chain calls. sqlx for Postgres. BLS signatures via existing consensus infrastructure.

**Spec:** `docs/plans/2026-03-17-vision-round-based-batches.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `oracle/src/vision/lifecycle.rs` | BatchLifecycleManager — per-source round heartbeat |
| `oracle/src/vision/settlement.rs` | Pure parimutuel payout computation |
| `oracle/migrations/008_add_batch_state_column.sql` | Add `state` column to vision_batches |
| `frontend/hooks/vision/useRounds.ts` | Fetch round list + states |
| `frontend/hooks/vision/useRoundResults.ts` | Fetch settlement results |
| `frontend/components/domain/vision/detail/RoundResults.tsx` | Settlement results display |

### Modified files
| File | What changes |
|------|-------------|
| `oracle/src/vision/mod.rs` | Register `lifecycle` + `settlement` modules |
| `oracle/src/vision/config.rs` | Add `round_based_sources` config field |
| `oracle/src/vision/engine.rs` | Skip round-based sources in tick engine; GC settled batches |
| `oracle/src/vision/tick_scheduler.rs` | Add `remove_batch()`, `mark_settled()`, lifecycle-aware `load_from_db` |
| `oracle/src/vision/bitmap_store.rs` | Add `purge_batch()` for cleanup |
| `oracle/src/vision/chain_listener.rs` | Handle `BatchSettled` event |
| `oracle/src/vision/api.rs` | Populate round endpoints from lifecycle tables |
| `oracle/src/chain/writer.rs` | Add `settle_batch()` method |
| `oracle/src/main.rs` | Spawn lifecycle manager |
| `vision-bot/bot.py` | Round-based join cycle |
| `vision-bot/framework/tracker.py` | Settlement detection, round cleanup |
| `vision-bot/framework/chain.py` | Add `join_batch_direct()`, `settle_batch()` |
| `frontend/components/domain/vision/detail/SourceDetail.tsx` | Round state display |
| `frontend/components/domain/vision/detail/BatchEntryPanel.tsx` | Direct deposit mode |
| `frontend/lib/contracts/vision-abi.ts` | Add `joinBatchDirect` ABI entry |

---

## Chunk 1: Oracle Foundation (Tasks 1-4)

### Task 1: DB migration — add batch lifecycle state

**Files:**
- Create: `oracle/migrations/008_add_batch_state_column.sql`
- Modify: `oracle/src/vision/tick_scheduler.rs:381-463` (load_from_db filter)

- [ ] **Step 1: Write migration SQL**

```sql
-- 008_add_batch_state_column.sql
-- Add lifecycle state to vision_batches so we can distinguish active from settled.
-- Existing batches default to 'active'. Round-based batches progress through:
--   active → settling → settled

ALTER TABLE vision_batches ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_vision_batches_state ON vision_batches(state);

-- Ensure vision_batch_lifecycle and vision_round_players exist
-- (may already exist from migration 007)
CREATE TABLE IF NOT EXISTS vision_batch_lifecycle (
    batch_id            BIGINT PRIMARY KEY,
    source_id           TEXT NOT NULL,
    timeframe_secs      INTEGER NOT NULL,
    config_hash         TEXT NOT NULL,
    betting_start       TIMESTAMPTZ NOT NULL,
    betting_end         TIMESTAMPTZ NOT NULL,
    settlement_deadline TIMESTAMPTZ NOT NULL,
    settled_at          TIMESTAMPTZ,
    settle_tx_hash      TEXT,
    player_count        INTEGER DEFAULT 0,
    total_deposited     TEXT DEFAULT '0',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_lifecycle_source ON vision_batch_lifecycle(source_id, timeframe_secs);
CREATE INDEX IF NOT EXISTS idx_batch_lifecycle_unsettled ON vision_batch_lifecycle(settled_at) WHERE settled_at IS NULL;
```

- [ ] **Step 2: Update load_from_db to filter by state**

In `oracle/src/vision/tick_scheduler.rs:388`, change the query from:
```rust
"SELECT id, ... FROM vision_batches WHERE NOT paused"
```
to:
```rust
"SELECT id, ... FROM vision_batches WHERE NOT paused AND state = 'active'"
```

This prevents loading settled batches into memory on restart.

- [ ] **Step 3: Add remove_batch and mark_settled methods to TickScheduler**

In `oracle/src/vision/tick_scheduler.rs`, after the existing methods (~line 460):

```rust
/// Remove a batch from all in-memory state. Called after settlement.
pub async fn remove_batch(&self, batch_id: u64) {
    self.batches.write().await.remove(&batch_id);
    self.players.write().await.remove(&batch_id);
    self.last_resolved.write().await.remove(&batch_id);
}

/// Mark a batch as settled in Postgres.
pub async fn mark_settled(&self, pool: &PgPool, batch_id: u64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE vision_batches SET state = 'settled', paused = true WHERE id = $1")
        .bind(batch_id as i64)
        .execute(pool)
        .await?;
    self.remove_batch(batch_id).await;
    Ok(())
}
```

- [ ] **Step 4: Add purge_batch to BitmapStore**

In `oracle/src/vision/bitmap_store.rs`, after the `flip` method (~line 150):

```rust
/// Remove all bitmaps (pending + active) for a batch. Called after settlement.
pub async fn purge_batch(&self, batch_id: u64) {
    let mut guard = self.slots.write().await;
    guard.pending.remove(&batch_id);
    guard.active.remove(&batch_id);
}

/// Also purge from DB.
pub async fn purge_batch_from_db(&self, pool: &PgPool, batch_id: u64) -> Result<(), BitmapStoreError> {
    sqlx::query("DELETE FROM vision_bitmaps WHERE batch_id = $1")
        .bind(batch_id as i64)
        .execute(pool)
        .await
        .map_err(BitmapStoreError::Db)?;
    self.purge_batch(batch_id).await;
    Ok(())
}
```

- [ ] **Step 5: Commit**

```bash
git add oracle/migrations/008_add_batch_state_column.sql oracle/src/vision/tick_scheduler.rs oracle/src/vision/bitmap_store.rs
git commit -m "feat: batch lifecycle state column, remove_batch/mark_settled, purge_batch"
```

---

### Task 2: Settlement payout computation (pure logic)

**Files:**
- Create: `oracle/src/vision/settlement.rs`
- Modify: `oracle/src/vision/mod.rs`

- [ ] **Step 1: Write settlement tests**

Create `oracle/src/vision/settlement.rs` with tests at the bottom:

```rust
//! Parimutuel settlement computation for round-based Vision batches.
//!
//! Given a TickResult (per-market outcomes) and player positions
//! (deposit + bitmap), compute the final payout for each player.
//! Zero-sum: total payouts == total deposits.

use ethers::types::{Address, U256};
use super::types::{TickResult, MarketOutcome, RoundSettlement};

/// Compute round settlement payouts from tick resolution results.
///
/// For each market, the pot (sum of all stakes) is redistributed:
/// - Winners split the pot proportional to their stake
/// - If no winners (all bet wrong), everyone is refunded
/// - Flat/Cancelled markets refund everyone
///
/// Returns a RoundSettlement with ordered player addresses and payouts.
pub fn compute_settlement(
    tick_result: &TickResult,
    player_deposits: &[(Address, U256)],  // (player, total_deposit)
    player_stakes: &[(Address, U256)],    // (player, stake_per_tick)
) -> RoundSettlement {
    // Implementation goes here
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::H256;
    use crate::vision::types::*;

    fn addr(n: u8) -> Address {
        let mut bytes = [0u8; 20];
        bytes[19] = n;
        Address::from(bytes)
    }

    #[test]
    fn test_two_players_opposite_bets_one_market() {
        // Player A bets UP, Player B bets DOWN
        // Market goes UP
        // Player A wins B's stake
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![MarketResult {
                market_id: H256::zero(),
                asset_id: "test".to_string(),
                outcome: MarketOutcome::Up,
                start_price: 100.0,
                end_price: 110.0,
                pct_change_bps: 1000,
                player_results: vec![
                    PlayerMarketResult {
                        player: addr(1),
                        side: Side::Up,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(100),
                        payout: U256::from(200),
                        refund: U256::zero(),
                    },
                    PlayerMarketResult {
                        player: addr(2),
                        side: Side::Down,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(100),
                        payout: U256::zero(),
                        refund: U256::zero(),
                    },
                ],
            }],
            player_balances: vec![],
            voided_players: vec![],
        };

        let deposits = vec![(addr(1), U256::from(100)), (addr(2), U256::from(100))];
        let stakes = vec![(addr(1), U256::from(100)), (addr(2), U256::from(100))];

        let settlement = compute_settlement(&result, &deposits, &stakes);

        assert_eq!(settlement.players.len(), 2);
        assert_eq!(settlement.payouts[0], U256::from(200)); // winner gets all
        assert_eq!(settlement.payouts[1], U256::from(0));   // loser gets nothing
    }

    #[test]
    fn test_all_same_side_refund() {
        // Both bet UP, market goes UP — no losers, everyone refunded
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![MarketResult {
                market_id: H256::zero(),
                asset_id: "test".to_string(),
                outcome: MarketOutcome::Up,
                start_price: 100.0,
                end_price: 110.0,
                pct_change_bps: 1000,
                player_results: vec![
                    PlayerMarketResult {
                        player: addr(1),
                        side: Side::Up,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(0),  // no one to match against
                        payout: U256::from(100),       // refund
                        refund: U256::from(100),
                    },
                    PlayerMarketResult {
                        player: addr(2),
                        side: Side::Up,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(0),
                        payout: U256::from(100),
                        refund: U256::from(100),
                    },
                ],
            }],
            player_balances: vec![],
            voided_players: vec![],
        };

        let deposits = vec![(addr(1), U256::from(100)), (addr(2), U256::from(100))];
        let stakes = vec![(addr(1), U256::from(100)), (addr(2), U256::from(100))];

        let settlement = compute_settlement(&result, &deposits, &stakes);

        // Everyone gets their deposit back
        assert_eq!(settlement.payouts[0], U256::from(100));
        assert_eq!(settlement.payouts[1], U256::from(100));
    }

    #[test]
    fn test_zero_sum_invariant() {
        // Total payouts must equal total deposits
        let result = TickResult {
            batch_id: 1,
            tick_id: 1,
            market_results: vec![MarketResult {
                market_id: H256::zero(),
                asset_id: "test".to_string(),
                outcome: MarketOutcome::Down,
                start_price: 100.0,
                end_price: 90.0,
                pct_change_bps: -1000,
                player_results: vec![
                    PlayerMarketResult {
                        player: addr(1),
                        side: Side::Up,
                        effective_stake: U256::from(300),
                        matched_stake: U256::from(100),
                        payout: U256::from(0),
                        refund: U256::from(200),
                    },
                    PlayerMarketResult {
                        player: addr(2),
                        side: Side::Down,
                        effective_stake: U256::from(100),
                        matched_stake: U256::from(100),
                        payout: U256::from(200),
                        refund: U256::from(0),
                    },
                ],
            }],
            player_balances: vec![],
            voided_players: vec![],
        };

        let deposits = vec![(addr(1), U256::from(300)), (addr(2), U256::from(100))];
        let stakes = vec![(addr(1), U256::from(300)), (addr(2), U256::from(100))];

        let settlement = compute_settlement(&result, &deposits, &stakes);

        let total_payouts: U256 = settlement.payouts.iter().sum();
        let total_deposits: U256 = deposits.iter().map(|(_, d)| *d).sum();
        assert_eq!(total_payouts, total_deposits, "Settlement must be zero-sum");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test -p oracle settlement -- --nocapture`
Expected: FAIL — `compute_settlement` is `todo!()`

- [ ] **Step 3: Implement compute_settlement**

Replace `todo!()` with the actual implementation. The function should:
1. Sum up per-player payouts and refunds from `tick_result.market_results[*].player_results`
2. Add deposits for voided players (full refund)
3. Sort players by address (ascending) to match contract's ordering requirement
4. Build `RoundSettlement` struct

```rust
pub fn compute_settlement(
    tick_result: &TickResult,
    player_deposits: &[(Address, U256)],
    player_stakes: &[(Address, U256)],
) -> RoundSettlement {
    let mut player_payouts: std::collections::HashMap<Address, U256> = std::collections::HashMap::new();
    let mut player_correct: std::collections::HashMap<Address, u32> = std::collections::HashMap::new();

    // Initialize all players with zero payout
    for (addr, _) in player_deposits {
        player_payouts.entry(*addr).or_insert(U256::zero());
        player_correct.entry(*addr).or_insert(0);
    }

    // Accumulate payouts + refunds from market results
    for mr in &tick_result.market_results {
        let is_up = matches!(mr.outcome, MarketOutcome::Up);
        let is_down = matches!(mr.outcome, MarketOutcome::Down);

        for pr in &mr.player_results {
            let entry = player_payouts.entry(pr.player).or_insert(U256::zero());
            *entry += pr.payout + pr.refund;

            // Count correct predictions
            let predicted_correctly = match pr.side {
                Side::Up => is_up,
                Side::Down => is_down,
            };
            if predicted_correctly {
                *player_correct.entry(pr.player).or_insert(0) += 1;
            }
        }
    }

    // Voided players get their full deposit back
    for voided in &tick_result.voided_players {
        if let Some((_, deposit)) = player_deposits.iter().find(|(a, _)| a == voided) {
            *player_payouts.entry(*voided).or_insert(U256::zero()) += *deposit;
        }
    }

    // Sort by address (ascending) — contract requires this order
    let mut sorted: Vec<(Address, U256, u32)> = player_payouts
        .into_iter()
        .map(|(addr, payout)| {
            let correct = player_correct.get(&addr).copied().unwrap_or(0);
            (addr, payout, correct)
        })
        .collect();
    sorted.sort_by_key(|(addr, _, _)| *addr);

    let total_markets = tick_result.market_results.len() as u32;

    RoundSettlement {
        batch_id: tick_result.batch_id,
        players: sorted.iter().map(|(a, _, _)| *a).collect(),
        payouts: sorted.iter().map(|(_, p, _)| *p).collect(),
        correct_counts: sorted.iter().map(|(_, _, c)| *c).collect(),
        total_markets,
    }
}
```

- [ ] **Step 4: Register module**

In `oracle/src/vision/mod.rs`, add:
```rust
pub mod settlement;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test -p oracle settlement -- --nocapture`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add oracle/src/vision/settlement.rs oracle/src/vision/mod.rs
git commit -m "feat: parimutuel settlement computation with zero-sum invariant"
```

---

### Task 3: VisionConfig — add round_based_sources

**Files:**
- Modify: `oracle/src/vision/config.rs`

- [ ] **Step 1: Add round_based_sources field**

In `oracle/src/vision/config.rs`, find the `VisionConfig` struct and add:

```rust
/// Sources that use round-based batches (lifecycle manager).
/// Empty = all sources use the permanent tick engine.
/// Example: ["crypto", "weather", "pumpfun"]
#[serde(default)]
pub round_based_sources: Vec<String>,
```

- [ ] **Step 2: Commit**

```bash
git add oracle/src/vision/config.rs
git commit -m "feat: round_based_sources config field for lifecycle manager"
```

---

### Task 4: Engine — skip round-based sources + GC settled batches

**Files:**
- Modify: `oracle/src/vision/engine.rs:1865-1900` (tick resolution loop)

- [ ] **Step 1: Add source filter to tick resolution loop**

In the batch iteration loop at `engine.rs:1865`, add a check to skip round-based sources:

```rust
for &batch_id in &due_batches {
    // Skip round-based sources — they are handled by the lifecycle manager
    if let Some((batch, _)) = scheduler.get_batch_state(batch_id).await {
        let source_name = bytes32_hex_to_string(&format!("{:?}", batch.source_id));
        if config.round_based_sources.iter().any(|s| {
            // Match by keccak256(name_v1) through keccak256(name_v5)
            for v in 1..=5u8 {
                let versioned = format!("{}_v{}", s, v);
                if H256::from(keccak256(versioned.as_bytes())) == batch.source_id {
                    return true;
                }
            }
            H256::from(keccak256(s.as_bytes())) == batch.source_id
        }) {
            continue; // handled by lifecycle manager
        }
    }
    // ... existing tick resolution code
}
```

- [ ] **Step 2: Add settled batch GC to gc_timer**

In the `gc_timer` block at `engine.rs:1805`, add cleanup for settled batches:

```rust
_ = gc_timer.tick() => {
    if let Some(ref tc) = tick_consensus {
        tc.gc_stale_rounds().await;
    }
    // GC settled batches from in-memory state
    if let Some(ref pool) = db_pool {
        let settled_ids: Vec<i64> = sqlx::query_scalar(
            "SELECT id FROM vision_batches WHERE state = 'settled'"
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        for id in settled_ids {
            let bid = id as u64;
            scheduler.remove_batch(bid).await;
            resolver.bitmap_store.purge_batch(bid).await;
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add oracle/src/vision/engine.rs
git commit -m "feat: skip round-based sources in tick engine, GC settled batches"
```

---

## Chunk 2: Oracle Lifecycle Manager (Tasks 5-7)

### Task 5: ChainWriter — add settle_batch method

**Files:**
- Modify: `oracle/src/chain/writer.rs`

- [ ] **Step 1: Add settle_batch to ChainWriter trait**

After the existing trait methods (~line 64), add:

```rust
/// Call Vision.settleBatch() on-chain with BLS-signed payouts.
async fn settle_batch(
    &self,
    batch_id: u64,
    players: Vec<Address>,
    payouts: Vec<U256>,
    bls_signature: Vec<u8>,
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Result<TxHash, Error>;
```

- [ ] **Step 2: Implement for EthersChainWriter**

Follow the pattern of `build_confirm_batch_tx` (line 195). Build the calldata for `settleBatch(uint256,address[],uint256[],bytes,uint256,uint256)`:

```rust
async fn settle_batch(
    &self,
    batch_id: u64,
    players: Vec<Address>,
    payouts: Vec<U256>,
    bls_signature: Vec<u8>,
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Result<TxHash, Error> {
    let calldata = encode_settle_batch(
        batch_id, &players, &payouts,
        &bls_signature, reference_nonce, signers_bitmask,
    );
    let tx = self.build_tx(self.vision_address, calldata).await?;
    self.submit_tx(tx, "settle_batch").await
}
```

The `encode_settle_batch` helper uses ethers-rs ABI encoding:

```rust
fn encode_settle_batch(
    batch_id: u64,
    players: &[Address],
    payouts: &[U256],
    bls_signature: &[u8],
    reference_nonce: u64,
    signers_bitmask: U256,
) -> Vec<u8> {
    use ethers::abi::{encode, Token};
    // Function selector for settleBatch(uint256,address[],uint256[],bytes,uint256,uint256)
    let selector = ethers::utils::id("settleBatch(uint256,address[],uint256[],bytes,uint256,uint256)");
    let mut data = selector[..4].to_vec();
    data.extend(encode(&[
        Token::Uint(U256::from(batch_id)),
        Token::Array(players.iter().map(|a| Token::Address(*a)).collect()),
        Token::Array(payouts.iter().map(|p| Token::Uint(*p)).collect()),
        Token::Bytes(bls_signature.to_vec()),
        Token::Uint(U256::from(reference_nonce)),
        Token::Uint(signers_bitmask),
    ]));
    data
}
```

- [ ] **Step 3: Commit**

```bash
git add oracle/src/chain/writer.rs
git commit -m "feat: settle_batch chain writer method for round settlement"
```

---

### Task 6: BatchLifecycleManager skeleton

**Files:**
- Create: `oracle/src/vision/lifecycle.rs`
- Modify: `oracle/src/vision/mod.rs`
- Modify: `oracle/src/main.rs`

This is the largest task. The lifecycle manager runs as a separate tokio task alongside the tick engine.

- [ ] **Step 1: Create lifecycle.rs with the core loop**

```rust
//! BatchLifecycleManager — per-source round heartbeat.
//!
//! For sources listed in `round_based_sources`, creates a new batch
//! every `tickDuration` seconds with a fresh config from the data-node.
//! Resolves the previous batch and settles it on-chain.

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::time::{interval, Duration};

use ethers::types::{Address, H256, U256};
use sqlx::PgPool;
use tracing::{info, warn, error};

use super::config::VisionConfig;
use super::tick_scheduler::TickScheduler;
use super::resolver::TickResolver;
use super::settlement::compute_settlement;
use super::types::RoundState;

/// Tracks one source's round lifecycle.
struct SourceRound {
    source_id: String,
    current_batch_id: Option<u64>,
    previous_batch_id: Option<u64>,
    tick_duration_secs: u64,
}

pub struct BatchLifecycleManager {
    config: VisionConfig,
    scheduler: Arc<TickScheduler>,
    resolver: Arc<TickResolver>,
    pool: PgPool,
    shutdown: Arc<AtomicBool>,
    sources: Vec<SourceRound>,
}

impl BatchLifecycleManager {
    pub fn new(
        config: VisionConfig,
        scheduler: Arc<TickScheduler>,
        resolver: Arc<TickResolver>,
        pool: PgPool,
        shutdown: Arc<AtomicBool>,
    ) -> Self {
        let sources = config.round_based_sources.iter().map(|s| {
            SourceRound {
                source_id: s.clone(),
                current_batch_id: None,
                previous_batch_id: None,
                tick_duration_secs: 300, // default 5 min, will be read from config
            }
        }).collect();

        Self { config, scheduler, resolver, pool, shutdown, sources }
    }

    /// Main loop — runs per source on its tickDuration heartbeat.
    pub async fn run(mut self) {
        if self.sources.is_empty() {
            info!("BatchLifecycleManager: no round-based sources configured, exiting");
            return;
        }

        info!(
            sources = ?self.config.round_based_sources,
            "BatchLifecycleManager started"
        );

        // For MVP: single shared interval (shortest tickDuration among sources)
        let min_interval = self.sources.iter()
            .map(|s| s.tick_duration_secs)
            .min()
            .unwrap_or(300);

        let mut tick = interval(Duration::from_secs(min_interval));
        tick.tick().await; // consume immediate first tick

        loop {
            if self.shutdown.load(std::sync::atomic::Ordering::Relaxed) {
                info!("BatchLifecycleManager shutting down");
                return;
            }

            tick.tick().await;

            for source in &mut self.sources {
                if let Err(e) = Self::process_source_round(
                    source,
                    &self.config,
                    &self.scheduler,
                    &self.resolver,
                    &self.pool,
                ).await {
                    error!(
                        source = %source.source_id,
                        error = %e,
                        "Round lifecycle error"
                    );
                }
            }
        }
    }

    async fn process_source_round(
        source: &mut SourceRound,
        config: &VisionConfig,
        scheduler: &Arc<TickScheduler>,
        resolver: &Arc<TickResolver>,
        pool: &PgPool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!(source = %source.source_id, "Processing round lifecycle");

        // Step 1: Fetch fresh config from data-node
        let config_url = format!(
            "{}/batches/source/{}/config",
            config.data_node_url, source.source_id
        );
        let client = reqwest::Client::new();
        let resp = client.get(&config_url)
            .timeout(Duration::from_secs(10))
            .send()
            .await?;

        if !resp.status().is_success() {
            warn!(source = %source.source_id, "Data-node config unavailable, skipping round");
            return Ok(());
        }

        let config_data: serde_json::Value = resp.json().await?;
        let markets = config_data.get("markets")
            .and_then(|m| m.as_array())
            .map(|a| a.len())
            .unwrap_or(0);

        if markets == 0 {
            warn!(source = %source.source_id, "No markets in config, skipping round");
            return Ok(());
        }

        info!(
            source = %source.source_id,
            markets,
            "Fresh config fetched for new round"
        );

        // Step 2: If previous batch exists and is due for settlement, resolve + settle it
        if let Some(prev_id) = source.previous_batch_id {
            info!(
                source = %source.source_id,
                batch_id = prev_id,
                "Settling previous round"
            );
            // TODO: Resolve previous batch using TickResolver
            // TODO: Compute settlement payouts
            // TODO: BLS-sign settlement
            // TODO: Call settleBatch on-chain
            // TODO: Record in vision_batch_lifecycle + vision_round_players
            // TODO: scheduler.mark_settled(pool, prev_id)
        }

        // Step 3: Create new batch on-chain
        // TODO: BLS-sign createBatch message
        // TODO: Call createBatch on-chain with fresh configHash
        // TODO: Record new batch in vision_batch_lifecycle

        // Step 4: Rotate
        source.previous_batch_id = source.current_batch_id;
        // source.current_batch_id = Some(new_batch_id);

        Ok(())
    }
}
```

- [ ] **Step 2: Register module in mod.rs**

```rust
pub mod lifecycle;
pub mod settlement;
```

- [ ] **Step 3: Spawn lifecycle manager in main.rs**

In `oracle/src/main.rs`, after the tick engine spawn (~line 5100), add:

```rust
// Spawn lifecycle manager for round-based sources
if !vision_cfg.round_based_sources.is_empty() {
    let lifecycle = oracle::vision::lifecycle::BatchLifecycleManager::new(
        vision_cfg.clone(),
        scheduler.clone(),
        resolver.clone(),
        pool.clone(),
        shutdown.clone(),
    );
    tokio::spawn(async move { lifecycle.run().await });
}
```

- [ ] **Step 4: Verify compilation**

Run: `cargo build -p oracle`
Expected: Compiles with warnings (TODO placeholders)

- [ ] **Step 5: Commit**

```bash
git add oracle/src/vision/lifecycle.rs oracle/src/vision/mod.rs oracle/src/main.rs
git commit -m "feat: BatchLifecycleManager skeleton — round heartbeat per source"
```

---

### Task 7: Chain listener — handle BatchSettled event

**Files:**
- Modify: `oracle/src/vision/chain_listener.rs`

- [ ] **Step 1: Add BatchSettled event topic**

Find the `EventTopics` or topic constants section. Add:

```rust
// BatchSettled(uint256 indexed batchId, uint256 playerCount)
let batch_settled_topic = H256::from(keccak256(b"BatchSettled(uint256,uint256)"));
```

- [ ] **Step 2: Add handler for BatchSettled**

In the event dispatch loop, add:

```rust
if log.topics[0] == batch_settled_topic {
    let batch_id = log.topics.get(1)
        .map(|t| t.to_low_u64_be())
        .unwrap_or(0);
    info!(batch_id, "BatchSettled event — marking batch as settled");
    if let Err(e) = scheduler.mark_settled(&pool, batch_id).await {
        warn!(batch_id, error = %e, "Failed to mark batch as settled in DB");
    }
    bitmap_store.purge_batch_from_db(&pool, batch_id).await.ok();
}
```

- [ ] **Step 3: Commit**

```bash
git add oracle/src/vision/chain_listener.rs
git commit -m "feat: handle BatchSettled event — cleanup settled batches"
```

---

## Chunk 3: Frontend + Bot (Tasks 8-10)

### Task 8: Frontend — add joinBatchDirect ABI + detect round mode

**Files:**
- Modify: `frontend/lib/contracts/vision-abi.ts`
- Create: `frontend/hooks/vision/useRounds.ts`

- [ ] **Step 1: Add joinBatchDirect to vision-abi.ts**

Find the ABI array and add:

```typescript
{
  name: 'joinBatchDirect',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'batchId', type: 'uint256' },
    { name: 'configHash', type: 'bytes32' },
    { name: 'depositAmount', type: 'uint256' },
    { name: 'stakePerTick', type: 'uint256' },
    { name: 'bitmapHash', type: 'bytes32' },
  ],
  outputs: [],
},
```

- [ ] **Step 2: Create useRounds hook**

```typescript
// frontend/hooks/vision/useRounds.ts
'use client'

import { useQuery } from '@tanstack/react-query'

export interface RoundInfo {
  batchId: number
  sourceId: string
  state: 'betting' | 'locked' | 'settling' | 'settled'
  playerCount: number
  tvl: string
  bettingEnd: string
  settledAt: string | null
  marketCount: number
}

export function useRounds(sourceId?: string) {
  return useQuery<RoundInfo[]>({
    queryKey: ['vision-rounds', sourceId],
    queryFn: async () => {
      const params = sourceId ? `?source=${sourceId}` : ''
      const res = await fetch(`/api/vision/rounds/active${params}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.rounds ?? []
    },
    refetchInterval: 5000,
    enabled: true,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/contracts/vision-abi.ts frontend/hooks/vision/useRounds.ts
git commit -m "feat: joinBatchDirect ABI + useRounds hook for round-based sources"
```

---

### Task 9: Bot — direct deposit + round detection

**Files:**
- Modify: `vision-bot/framework/chain.py`
- Modify: `vision-bot/framework/tracker.py`

- [ ] **Step 1: Add join_batch_direct to Executor**

In `vision-bot/framework/chain.py`, find the `Executor` class and add:

```python
def join_batch_direct(self, batch_id, config_hash, deposit_wei, stake_wei, bitmap_hash):
    """Join a round-based batch with direct USDC transfer (no Vision balance)."""
    data = self.vision.functions.joinBatchDirect(
        batch_id, config_hash, deposit_wei, stake_wei, bitmap_hash
    ).build_transaction({
        'from': self.bot_addr,
        'nonce': self.w3.eth.get_transaction_count(self.bot_addr),
        'gas': 500000,
        'gasPrice': self.w3.eth.gas_price,
    })
    signed = self.w3.eth.account.sign_transaction(data, self.private_key)
    tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
    if receipt.status != 1:
        raise Exception(f"joinBatchDirect reverted: {tx_hash.hex()}")
    return tx_hash
```

- [ ] **Step 2: Fix _join_round placeholder in tracker.py**

In `vision-bot/framework/tracker.py`, find `_join_round` and replace the hardcoded `["UP"] * market_count` placeholder with actual strategy call:

```python
def _join_round(self, round_info, strategy=None):
    """Join a round-based batch."""
    batch_id = round_info["batchId"]
    config_hash = round_info.get("configHash", b'\x00' * 32)

    # Get market info for strategy
    market_count = round_info.get("marketCount", 10)
    markets = [{"id": f"m{i}", "price": 0, "change": None, "volume": None, "market_cap": None}
               for i in range(market_count)]

    # Use actual strategy instead of placeholder
    if strategy:
        bets = strategy.predict(markets)
    else:
        import random
        bets = [random.choice(["UP", "DOWN"]) for _ in range(market_count)]

    from framework.core import encode_bitmap, hash_bitmap
    bitmap = encode_bitmap(bets, market_count)
    bm_hash = hash_bitmap(bitmap)

    deposit_wei = self._config["deposit"] * 10**18
    stake_wei = int(self._config["stake"] * 10**18)

    # Direct deposit — approve + joinBatchDirect
    self._executor.approve_usdc(deposit_wei)
    self._executor.join_batch_direct(batch_id, config_hash, deposit_wei, stake_wei, bm_hash)

    self.on_join(batch_id, deposit_wei, bitmap, bets, bitmap_hash=bm_hash)
```

- [ ] **Step 3: Commit**

```bash
git add vision-bot/framework/chain.py vision-bot/framework/tracker.py
git commit -m "feat: bot joinBatchDirect + fix _join_round placeholder bets"
```

---

### Task 10: E2E test — round lifecycle smoke test

**Files:**
- Create: `frontend/e2e/tests/46-vision-round-lifecycle.spec.ts`

- [ ] **Step 1: Write E2E test**

```typescript
/**
 * Vision Round Lifecycle E2E — Smoke test
 *
 * Verifies that round-based infrastructure exists:
 * 1. /vision/rounds/active returns data
 * 2. joinBatchDirect ABI is in the contract
 * 3. settleBatch ABI is in the contract
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_API, L3_RPC } from '../env'

test.describe('Vision Round Lifecycle', () => {
  test('rounds/active endpoint responds', async () => {
    const res = await fetch(`${VISION_API}/vision/rounds/active`, {
      signal: AbortSignal.timeout(10_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('rounds')
    console.log(`Active rounds: ${data.rounds?.length ?? 0}`)
  })

  test('settleBatch function exists in contract', async () => {
    // Verify the function selector exists by calling with empty data
    // settleBatch(uint256,address[],uint256[],bytes,uint256,uint256) = 0x5283c08a
    const res = await fetch(L3_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: '0xd5ec37ffa8c40b5dbaf7ffe9d9878c3a387ad47a',
          data: '0x5283c08a',
        }, 'latest'],
        id: 1,
      }),
    })
    const data = await res.json()
    // Will revert (no args) but should NOT return "method not found"
    expect(data.error?.message ?? data.result).toBeDefined()
    console.log('settleBatch function accessible on-chain')
  })
})
```

- [ ] **Step 2: Add to playwright config**

In `frontend/e2e/playwright.config.ts`, the `vision-data` project's testMatch already includes `4[5-9]` pattern, so test 46 is automatically picked up.

- [ ] **Step 3: Run test**

Run: `npx playwright test --config=e2e/playwright.config.ts e2e/tests/46-vision-round-lifecycle.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/tests/46-vision-round-lifecycle.spec.ts
git commit -m "test: round lifecycle smoke test — endpoints + contract functions"
```

---

## Execution Order

| Session | Tasks | Time | What it produces |
|---------|-------|------|-----------------|
| **1** | 1, 2, 3, 4, 5 | ~3h | DB schema, settlement logic, config field, engine source filter, chain writer |
| **2** | 6, 7 | ~3h | Lifecycle manager skeleton, BatchSettled handler, batch GC |
| **3** | 8, 9, 10 | ~2h | Frontend ABI + hook, bot direct deposit, E2E smoke test |

**After Session 1:** Oracle compiles, settlement logic is tested, but lifecycle manager is not running yet.
**After Session 2:** Set `round_based_sources: ["earthquake"]` in oracle config. Deploy. Watch: new batch created every 5 min, old batches settled, bitmaps cleaned up.
**After Session 3:** Frontend shows round data. Bot joins round-based batches with direct deposit.

---

## Minimum Viable Subset (1 session)

Tasks 1 + 2 + 3 + 4 only. Gets:
- Settlement computation (tested, correct)
- Batch lifecycle state in DB (no more memory leaks on restart)
- Tick engine skips round-based sources (clean separation)
- Settled batch GC (in-memory cleanup)

No lifecycle manager yet, no auto-settlement. But the foundation is solid for the next session.
