# Data-Node Code Simplification Plan

**Goal:** Remove duplicated code patterns across the data-node codebase (~69k LOC).

---

## Overview of Duplication

| Area | Files Affected | Duplicated Lines (est.) |
|------|---------------|------------------------|
| Collector main loops | 8 collectors | ~200 |
| Backfill pagination + retry | 2 (itp, trade) | ~80 |
| Concurrent work queue | 3 (kline, cg, dl) | ~150 |
| Chain poller wrappers | 7 pollers | ~50 |
| Market source trait boilerplate | 80+ sources | ~4,000 |
| OAuth token caching | 5+ sources | ~300 |
| Manual rate limiting | 15+ sources | ~180 |
| Custom HTTP retry loops | 20+ sources | ~1,500 |
| Asset JSON loading | 50+ sources | ~500 |
| PriceUpdate construction | 80+ sources | ~400 |
| **Total estimated** | | **~7,400 lines** |

---

## Step 1: Generic Collector Loop

**Problem:** 8 collectors repeat the same `pub async fn run()` pattern: init client → backfill → loop { fetch → store → sleep }.

**Fix:** Extract a `run_collector_loop` helper function.

```rust
// src/collector_loop.rs
pub async fn run_collector_loop<F, Fut>(
    name: &str,
    interval: Duration,
    mut tick: F,
) where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<(), Box<dyn Error + Send + Sync>>>,
{
    loop {
        if let Err(e) = tick().await {
            warn!(%e, "{name} tick error");
        }
        tokio::time::sleep(interval).await;
    }
}
```

**Files changed:** `collector.rs`, `cg_collector.rs`, `dl_collector.rs`, `fng_collector.rs`, `itp_collector.rs`, `kline_collector.rs`, `liquidity_collector.rs`, `trade_collector.rs`

---

## Step 2: Backfill Paginator

**Problem:** `itp_collector.rs` and `trade_collector.rs` have near-identical backfill pagination with exponential retry (same `BACKFILL_BATCH_SIZE=10_000`, same `MAX_RETRIES=3`, same retry loop).

**Fix:** Extract a generic `backfill_paginated` function.

```rust
// src/backfill_util.rs
pub async fn backfill_paginated<F, Fut>(
    name: &str,
    from: u64,
    to: u64,
    batch_size: u64,
    max_retries: u32,
    mut process_batch: F,
) where
    F: FnMut(u64, u64) -> Fut,
    Fut: Future<Output = Result<usize>>,
{
    let mut cursor = from;
    while cursor < to {
        let batch_end = (cursor + batch_size).min(to);
        for attempt in 1..=max_retries {
            match process_batch(cursor, batch_end).await {
                Ok(_) => break,
                Err(e) if attempt < max_retries => {
                    warn!(%e, "{name} batch {cursor}..{batch_end} attempt {attempt} failed, retrying");
                    tokio::time::sleep(Duration::from_secs(2u64.pow(attempt))).await;
                }
                Err(e) => error!(%e, "{name} batch {cursor}..{batch_end} failed after {max_retries} attempts"),
            }
        }
        cursor = batch_end + 1;
    }
}
```

**Files changed:** `itp_collector.rs`, `trade_collector.rs`

---

## Step 3: Concurrent Work Queue

**Problem:** `kline_collector.rs`, `cg_collector.rs`, `dl_collector.rs` all implement the same `Arc<Mutex<Vec<T>>>` + `JoinSet` + `AtomicU64` progress counter pattern.

**Fix:** Extract a `run_work_queue` helper.

```rust
// src/work_queue.rs
pub async fn run_work_queue<T, F, Fut>(
    items: Vec<T>,
    concurrency: usize,
    worker: F,
) -> u64
where
    T: Send + 'static,
    F: Fn(T) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = u64> + Send,
{
    let queue = Arc::new(Mutex::new(items));
    let counter = Arc::new(AtomicU64::new(0));
    let mut handles = JoinSet::new();

    for _ in 0..concurrency {
        let q = Arc::clone(&queue);
        let c = Arc::clone(&counter);
        let w = worker.clone();
        handles.spawn(async move {
            loop {
                let item = q.lock().await.pop();
                match item {
                    Some(it) => { c.fetch_add(w(it).await, Ordering::Relaxed); }
                    None => break,
                }
            }
        });
    }

    while handles.join_next().await.is_some() {}
    counter.load(Ordering::Relaxed)
}
```

**Files changed:** `kline_collector.rs`, `cg_collector.rs`, `dl_collector.rs`

---

## Step 4: Chain Poller Wrappers

**Problem:** 7 pollers in `chain_pollers.rs` all have identical wrapper functions:
```rust
pub async fn poll_xxx(state: Arc<AppState>) {
    let interval = Duration::from_secs(N);
    loop {
        if let Err(e) = poll_xxx_once(&state).await { warn!(...); }
        tokio::time::sleep(interval).await;
    }
}
```

**Fix:** Reuse `run_collector_loop` from Step 1 (it's the same pattern). Replace all 7 wrappers with inline calls at the spawn site in `main.rs`:

```rust
// In main.rs, replace:
//   tokio::spawn(chain_pollers::poll_nav(state.clone()));
// With:
tokio::spawn(run_collector_loop("nav", Duration::from_secs(1), {
    let s = state.clone();
    move || { let s = s.clone(); async move { chain_pollers::poll_nav_once(&s).await } }
}));
```

Then delete the 7 `pub async fn poll_xxx()` wrappers from `chain_pollers.rs`, keep only the `_once` functions.

**Files changed:** `chain_pollers.rs`, `main.rs`

---

## Step 5: Bitget Client Init Helper

**Problem:** `collector.rs`, `kline_collector.rs`, `liquidity_collector.rs` repeat identical 15-line `BitgetReadOnlyConfig::from_env()` + `BitgetReadOnlyClientImpl::new()` with identical error handling.

**Fix:** Extract a `create_bitget_client()` helper.

```rust
fn create_bitget_client(caller: &str) -> Option<BitgetReadOnlyClientImpl> {
    let config = BitgetReadOnlyConfig::from_env().map_err(|e| {
        error!(?e, "{caller}: failed to load Bitget config");
    }).ok()?;
    BitgetReadOnlyClientImpl::new(config).map_err(|e| {
        error!(?e, "{caller}: failed to create Bitget client");
    }).ok()
}
```

**Files changed:** `collector.rs`, `kline_collector.rs`, `liquidity_collector.rs`

---

## Step 6: EVM Provider Init Helper

**Problem:** `itp_collector.rs` and `trade_collector.rs` duplicate provider creation + address parsing.

**Fix:** Extract into a shared helper.

```rust
fn create_evm_contract<T: From<(Address, Arc<Provider<Http>>)>>(
    rpc_url: &str,
    address: &str,
    caller: &str,
) -> Option<(T, Arc<Provider<Http>>)> { ... }
```

**Files changed:** `itp_collector.rs`, `trade_collector.rs`

---

## Step 7: Prune Counter

**Problem:** `collector.rs` and `liquidity_collector.rs` duplicate the same 7-line prune counter pattern.

**Fix:** Inline into the collector loop as a periodic callback, or extract a tiny `PruneTimer` struct.

```rust
struct PruneTimer { counter: u32, every: u32 }
impl PruneTimer {
    fn tick(&mut self) -> bool { self.counter += 1; if self.counter >= self.every { self.counter = 0; true } else { false } }
}
```

**Files changed:** `collector.rs`, `liquidity_collector.rs`

---

## Step 8: Market Source OAuth Helper

**Problem:** Reddit, Twitch, and 3+ other sources have line-for-line identical `CachedToken` struct, `get_token()` method (~60 lines each), and `rate_limit()` method (~12 lines each).

**Fix:** Extract an `OAuthClient` into `market_data/sources/oauth.rs`:

```rust
pub struct OAuthClient {
    http: reqwest::Client,
    token_url: String,
    client_id: String,
    client_secret: String,
    cached: Mutex<Option<CachedToken>>,
    last_request: Mutex<Instant>,
    min_delay: Duration,
}

impl OAuthClient {
    pub async fn get_token(&self) -> Result<String> { ... }
    pub async fn rate_limit(&self) { ... }
    pub async fn authed_get<T: DeserializeOwned>(&self, url: &str) -> Result<T> { ... }
}
```

**Files changed:** `reddit/client.rs`, `twitch/client.rs`, and any other OAuth sources

---

## Step 9: Market Source `from_env()` Macro

**Problem:** 80+ sources repeat identical `from_env()` constructors — read env vars, build reqwest client, return Self.

**Fix:** For sources already using `SourceHttpClient` (earthquake, anilist, etc.), the init is already short. For sources with custom HTTP clients, standardize on `SourceHttpClient`. For the ~40 sources that don't need auth:

```rust
// Already using SourceHttpClient — no change needed, these are clean.
// For the 15+ sources still using raw reqwest::Client, migrate to SourceHttpClient.
```

No macro needed — just migrate remaining raw-reqwest sources to use the existing `SourceHttpClient`.

**Files changed:** ~15 sources still using raw reqwest

---

## Step 10: Deduplicate Custom Retry Loops

**Problem:** ~20 sources implement their own 75-line retry loop with 429 handling, exponential backoff, and auth refresh — even though `SourceHttpClient` already provides this.

**Fix:** Migrate these sources to use `SourceHttpClient::get_json()` which already handles retries, rate limiting, and error logging. Delete the custom retry logic.

**Files changed:** `reddit/client.rs`, `twitch/client.rs`, + ~18 other sources with custom retry

---

## Execution Order

| Step | Effort | Impact (lines saved) | Dependencies |
|------|--------|---------------------|-------------|
| 1. Collector loop | Small | ~50 | None |
| 4. Chain poller wrappers | Small | ~50 | Step 1 |
| 5. Bitget client init | Small | ~30 | None |
| 6. EVM provider init | Small | ~20 | None |
| 7. Prune counter | Tiny | ~15 | None |
| 2. Backfill paginator | Small | ~80 | None |
| 3. Work queue | Medium | ~150 | None |
| 8. OAuth helper | Medium | ~300 | None |
| 9. Migrate to SourceHttpClient | Medium | ~500 | None |
| 10. Remove custom retry loops | Large | ~1,500 | Step 9 |

Steps 1-7 are independent and can run in parallel. Steps 8-10 are independent of 1-7 but 10 depends on 9.

---

## What NOT to Touch

- **`api.rs`** (6,581 LOC) — endpoints have similar patterns but each does different work; abstraction would hurt readability
- **`db.rs`** (2,525 LOC) — SQL queries are different per table; no real duplication
- **`simulation.rs`** (2,768 LOC) — domain-specific logic, not duplicated
- **Individual source `fetch_prices()` logic** — each source's data transformation is genuinely unique
- **`batch_engine.rs`** — no duplication
