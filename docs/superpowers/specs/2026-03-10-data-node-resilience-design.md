# Data Node Resilience: Write Channel + Self-Healing Sources

**Date:** 2026-03-10
**Status:** Approved

## Problem

75+ market data sources share a 5-connection DB pool. Sources start simultaneously, have no circuit breaker, no backoff, and no panic recovery. When the DB pool exhausts or an API goes down, sources either hammer dead endpoints forever or die silently with no restart.

## Solution: Two Changes

### 1. Write Channel (mpsc batch writer)

All sync engines stop writing to DB directly. Instead they send `PriceUpdate` batches into a bounded `tokio::mpsc` channel. A dedicated writer task drains the channel, deduplicates by `(source, asset_id)`, and flushes batched INSERTs to the DB.

**Architecture:**

```
SyncEngine 1 ──┐
SyncEngine 2 ──┤
SyncEngine 3 ──┼──► mpsc channel (cap: 10_000) ──► BatchWriter task
   ...         │                                      │
SyncEngine N ──┘                                      ▼
                                              Batched INSERT (500 rows)
                                              + market_prices_latest UPSERT
                                              + WebSocket broadcast
```

**Components:**

- `WriteMsg`: enum carrying price batch + source metadata (or a flush command)
- `PriceWriteChannel`: wraps `mpsc::Sender<WriteMsg>`, cloned into each sync engine
- `BatchWriter`: single async task that:
  - Drains channel into a buffer
  - Every 2s or when buffer hits 500 rows, flushes
  - Deduplicates: last value per `(source, asset_id)` wins within batch window
  - Batched INSERT into `market_prices` (multi-row VALUES)
  - Batched UPSERT into `market_prices_latest`
  - Broadcasts to WebSocket hub
  - Owns 2 DB connections (1 for prices, 1 for latest cache)

**Changes to SyncEngine/ScheduledSyncEngine:**
- `sync_prices()` returns fetched prices but does NOT write to DB
- Instead, sends `WriteMsg::Prices { source, prices, prev_values }` into channel
- The `prev_values` lookup (LATERAL join) stays in sync engine (read-only, uses shared pool)
- Change detection (skip unchanged) stays in sync engine

### 2. Self-Healing Source Lifecycle

**a) Panic-catching spawn wrapper:**

```rust
async fn spawn_source(name: &str, fut: impl Future<Output = ()>) {
    loop {
        match tokio::spawn(fut).await {
            Ok(()) => break, // Normal exit (shouldn't happen)
            Err(e) => {
                error!("[{}] Source panicked: {}, restarting in 30s", name, e);
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        }
    }
}
```

Since sync engines take `&self` (not movable), the wrapper will be applied at the main.rs spawn site by wrapping the entire source init + run in a retry loop.

**b) Circuit breaker wired into sync loop:**

Before each `sync_prices()`, check the circuit breaker. On failure, record it. On success, reset. When open, skip the sync and wait for cooldown.

```
Closed ──(5 consecutive failures)──► Open (5 min cooldown)
  ▲                                    │
  └────── success ◄── HalfOpen ◄───────┘ (cooldown expired)
```

Auth failures: 1 hour cooldown (API key is wrong, no point retrying fast).

**c) Exponential backoff on sync loop:**

On consecutive failures, multiply wait time:
- Base: source's normal `sync_interval()`
- Multiplier: `min(2^consecutive_failures, 30)` capped so max wait = 30 * interval or 30 minutes, whichever is less
- On success: reset to normal interval

### 3. Supporting Changes

**a) DB pool size:** Increase from 5 to 20. The write channel reduces write pressure, but sync engines still do read queries (asset list, latest values). 20 handles that comfortably.

**b) Staggered startup:** Each source gets a random 0-30s delay before first sync. Prevents thundering herd on both APIs and DB.

## Files Changed

| File | Change |
|------|--------|
| `src/db.rs` | `max_connections(5)` → `max_connections(20)` |
| `src/market_data/mod.rs` | Add `pub mod write_channel;` |
| `src/market_data/write_channel.rs` | **NEW** — `WriteMsg`, `PriceWriteChannel`, `BatchWriter` |
| `src/market_data/sync_engine.rs` | Wire circuit breaker, backoff, stagger; send to channel instead of DB writes |
| `src/market_data/scheduled_sync_engine.rs` | Same changes as sync_engine |
| `src/market_data/sources/error.rs` | No changes (circuit breaker already correct) |
| `src/main.rs` | Panic-catching spawn wrapper; create channel + spawn BatchWriter; pass channel to engines |

## Non-Goals

- PgBouncer (unnecessary with write channel)
- Changing the HTTP client retry logic (already good)
- Refactoring individual source implementations
- Changing the health API (it reads from error_tracker which still works)
