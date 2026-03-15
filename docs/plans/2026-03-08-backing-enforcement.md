# ITP Backing Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent minting ITP shares beyond what the AP actually holds, with always-on cache and graceful sell-only recovery.

**Architecture:** Mock AP exposes HMAC-signed token holdings via SSE → Data-node relays via SSE → Oracle `backing/` module maintains an always-warm cache. Both leader and followers check `can_sign_fill()` (O(1) cache lookup) before signing `confirmFills` (NOT `confirmBatch`). Per-token deficit cap of $10 USD. Fail-closed on SSE disconnect (except sells). Fixed-point U256 arithmetic throughout — no f64 for financial amounts.

**Tech Stack:** Rust, Axum SSE (server), reqwest (SSE client), tokio, ethers, U256 fixed-point, rust_decimal, HMAC-SHA256

**Design doc:** `docs/plans/2026-03-08-backing-enforcement-design.md`

**Security review:** 3 independent cynical security researchers, 6 rounds (10C+9H → 3C+6H → 2C+7H → 3C+4H → 3C+10H → 0C+0H). All CRITICAL and HIGH findings addressed. Round 6: CLEAN PASS (3/3 agents).

**Round 1 fixes (10C, 9H):**
- Moved backing check from `confirmBatch` → `confirmFills` phase (C1)
- Fail-closed on all lookup failures (C2)
- Implemented `simulate_fill` with cumulative batch accounting (C3)
- U256 fixed-point arithmetic, no f64 for financial amounts (C4, C8)
- Per-fill validation with sells always passing (C5, H5)
- Optimistic cache update after fill signing to close TOCTOU gap (C6)
- HMAC-signed SSE snapshots with monotonic sequence numbers (C7, H3)
- Added `totalSupply` to `ItpInventoryState` for atomic reads (C9)
- Side determined from BridgeOrchestrator in-memory cache, NOT Fill struct (C10, R3-H5, R4-H4)
- Missing price = fail-closed (H1, H7)
- Event-driven + poll hybrid for on-chain state (H2)
- Rebalance timeout of 5 minutes (H4)
- Allow negative balances in tracker (H6)
- First-fill simulation accounts for zero totalSupply (H8)

**Round 2 fixes (3C, 6H):**
- R2-C1: AP HoldingsTracker uses `rust_decimal::Decimal` for arithmetic, NOT f64. No precision loss at source.
- R2-C2: Follower validates leader's entire fill set via `simulate_fill`, signs or refuses whole set. No per-fill hash manipulation. Leader filters; follower verifies leader's decision. Side determined from in-memory order tracking (BridgeOrchestrator), not P2P message or on-chain struct.
- R2-C3: Optimistic deltas tracked in separate `pending_optimistic: HashMap<[u8;32], HashMap<String, U256>>`, added on top during `recompute_aggregated()`. Cleared when on-chain totalSupply confirms the mint. Never modifies `aggregated_required` directly.
- R2-H1: Rebalance timeout transitions to `RebalanceStale` (still blocks buys) + alerts, NOT back to `Backed`.
- R2-H2: AP includes `session_id` (random UUID per AP startup). Relay resets `last_seq` when session_id changes.
- R2-H3: `parse_decimal_to_u256` returns `Result<(bool, U256), ParseError>`. Malformed input = fail-closed (treat as missing holdings, block buys).
- R2-H4: Staleness check uses `Instant::now()` (monotonic clock) for duration-since-last-received, not wall clock comparison.
- R2-H5: All U256 multiplications use `checked_mul` / `checked_div`. Overflow returns error, blocks ITP.
- R2-H6: Symbol mapping auto-derived from on-chain ERC-20 `symbol()` call, cached + refreshed on new ITP creation events.

**Round 3 fixes (2C, 7H):**
- R3-C1: `session_id` now included in HMAC payload (`session_id|seq|ts|sorted(...)`). Added to relay `ApHoldingsSnapshot` struct. Relay tracks `last_session_id`, resets `last_seq` on session change.
- R3-C2: `BackingCache::new()` fixed — initializes `last_snapshot_received: Arc::new(RwLock::new(None))` and `pending_optimistic: Arc::new(RwLock::new(HashMap::new()))`. Removed stale `last_snapshot_ts`.
- R3-H1: Added explicit `return BackingStatus::RebalancePending;` after rebalance timeout error log. Uses `Instant` for rebalance timing (consistent with R2-H4).
- R3-H2: `simulate_fill` and `compute_deficit_status` use `checked_mul`/`checked_add`/`checked_div`. Overflow → `BackingStatus::DeficitExceeded`.
- R3-H3: Optimistic deltas have TTL (5 min). Stale entries auto-evicted with alert. Per-ITP cap of 50 pending entries → fail-closed if exceeded.
- R3-H4: `update_holdings` explicitly drops write lock via `drop(actual)` before calling `recompute_blocked()`. No deadlock.
- R3-H5: Removed `side` from Fill struct. Side MUST come from BridgeOrchestrator in-memory order cache. Plan text updated to be unambiguous.
- R3-H6: Leader separates buys and sells into separate batch proposals. Sell batches never gated by backing — always proposed. Buy batches filtered by backing. Followers validate buy batches independently; sell batches always signed.
- R3-H7: Documented that U256 18-decimal representation truncates beyond 18 fractional digits (intentional — matches EVM precision). rust_decimal is used for AP arithmetic only; SSE strings are truncated to 18 digits at the AP before transmission.

**Round 4 fixes (3C, 4H):**
- R4-C1: `build_snapshot()` now sets `session_id: self.session_id.clone()` in returned struct. `HoldingsTracker::new()` generates UUID.
- R4-C2: `ApHoldingsRelay::new()` initializes `last_session_id: Arc::new(RwLock::new(String::new()))`.
- R4-C3: Test `make_signed_snapshot` uses 4-field HMAC format (`session_id|seq|ts|holdings`) and includes `session_id` in struct.
- R4-H1: Oracle `ApHoldingsSnapshot` struct now includes `session_id: String` for defense-in-depth HMAC.
- R4-H2: `simulate_fill` negative-holdings deficit uses `checked_add` (matching `compute_deficit_status` and `recompute_blocked`).
- R4-H3: HMAC verification uses `mac.verify_slice()` (constant-time) instead of hex string `!=` comparison.
- R4-H4: `side` field removed from Fill struct (was contradicted by R3-H5). Leader determines side from `BridgeOrchestrator::get_order_limit_price()`. L3-native orders must call `set_order_limit_price` before fills.

**Round 5 fixes (3C, 10H):**
- R5-C1: Relay adds timestamp freshness check (>60s → reject) before session handling, preventing cross-session replay with captured old HMAC-valid snapshots.
- R5-H1: Optimistic delta TTL changed from 60s to 300s (5 min) to prevent double-mint window before on-chain confirmation.
- R5-H2: Leader `cumulative_pending` uses checked arithmetic via new `cache.compute_fill_deltas()` accessor.
- R5-H3: Leader loop no longer references undefined `order`/`backing` variables. New `BackingCache::compute_fill_deltas(itp_id, shares)` public method returns per-symbol deltas.
- R5-H4: `recompute_aggregated` uses `checked_add` — overflow → `U256::MAX` (fail-closed).
- R5-H5: `simulate_fill` now checks SSE connected + staleness at the top (matching `can_sign_fill`).
- R5-H6: SSE buffer capped at 1MB — exceeding disconnects and reconnects (OOM protection).
- R5-H7: Symbol names validated for HMAC delimiter characters (`|`, `=`, `,`) — reject → `UnmappedAsset`.
- R5-H8: L3-native order registration explicitly calls `set_order_limit_price` — without it, all L3-native fills (buys AND sells) are excluded.
- R5-H9: Optimistic delta cap counts fills (separate `pending_fill_count` counter), not symbols. Old cap broke for ITPs with >50 assets.
- R5-C2: `clear_optimistic` now conditional on `total_supply > last_known_total_supply`. Old code wiped deltas on every 5s poll even when confirmFills tx was still pending, enabling repeated $10-cap minting per poll cycle.
- R5-C3: `optimistic_fill_update` now calls `recompute_aggregated()` before `recompute_blocked()`. Without this, pending deltas were invisible to `simulate_fill` until the next `update_itp_required` call — allowing double-commitment between batches.
- R5-H10: Cross-chain sell orders also need `set_order_limit_price(sell_order_id, limit_price, 1)` at registration. Without it, follower backing check can't determine side → sells fail-closed.

**Round 6: CLEAN PASS** — 3/3 agents independently verified zero CRITICAL and zero HIGH findings remaining.

---

### Task 1: Mock AP — Holdings Tracker + HMAC-Signed SSE Endpoint

**Files:**
- Create: `ap/src/holdings.rs`
- Modify: `ap/src/lib.rs` (add `pub mod holdings;`)
- Modify: `ap/src/main.rs` (wire SSE endpoint + holdings tracker)
- Test: `ap/src/holdings.rs` (inline `#[cfg(test)]`)

The AP needs to track what tokens it holds and broadcast HMAC-signed changes via SSE.

**Step 1: Write holdings tracker with tests**

Create `ap/src/holdings.rs`:

```rust
//! AP token holdings tracker with HMAC-signed SSE broadcast.
//!
//! Tracks spot balances per token symbol as string quantities (no f64).
//! Updates on trade execution. Broadcasts HMAC-signed snapshot via SSE.
//! Allows negative balances (short positions or over-sells are real state).

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::{broadcast, RwLock};
use serde::{Deserialize, Serialize};
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// A snapshot of all AP token holdings, HMAC-signed for integrity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoldingsSnapshot {
    /// Token symbol → quantity held (as decimal string for full precision)
    pub holdings: HashMap<String, String>,
    /// Random UUID generated on AP startup — relay resets seq tracking on change (R2-H2)
    pub session_id: String,
    /// Monotonically increasing sequence number within session (replay protection)
    pub seq: u64,
    /// Unix timestamp ms when snapshot was taken
    pub timestamp_ms: u64,
    /// HMAC-SHA256 of `session_id|seq|timestamp_ms|sorted(symbol=qty,...)` using shared secret
    pub hmac: String,
}

/// Tracks AP spot balances and broadcasts HMAC-signed changes via SSE.
pub struct HoldingsTracker {
    /// Token symbol → quantity as string (decimal, full precision)
    holdings: Arc<RwLock<HashMap<String, String>>>,
    tx: broadcast::Sender<HoldingsSnapshot>,
    session_id: String,
    seq: AtomicU64,
    hmac_key: Vec<u8>,
}

impl HoldingsTracker {
    pub fn new(buffer_size: usize, hmac_key: Vec<u8>) -> Self {
        let (tx, _) = broadcast::channel(buffer_size);
        Self {
            holdings: Arc::new(RwLock::new(HashMap::new())),
            tx,
            session_id: uuid::Uuid::new_v4().to_string(), // R4-C1: unique per AP startup
            seq: AtomicU64::new(0),
            hmac_key,
        }
    }

    /// Subscribe to holdings updates (for SSE consumers).
    pub fn subscribe(&self) -> broadcast::Receiver<HoldingsSnapshot> {
        self.tx.subscribe()
    }

    /// Record a trade: bought `buy_qty` of `buy_symbol`, sold `sell_qty` of `sell_symbol`.
    /// Quantities are decimal strings for precision (e.g., "0.5", "100.123456789").
    /// Negative balances are allowed (they represent real state the backing system needs to see).
    pub async fn record_trade(
        &self,
        buy_symbol: &str,
        buy_qty: &str,
        sell_symbol: &str,
        sell_qty: &str,
    ) {
        let mut h = self.holdings.write().await;
        // Parse, add/subtract, store back as string
        let buy_bal = parse_decimal(&h.get(buy_symbol).cloned().unwrap_or("0".into()));
        let sell_bal = parse_decimal(&h.get(sell_symbol).cloned().unwrap_or("0".into()));
        let buy_delta = parse_decimal(buy_qty);
        let sell_delta = parse_decimal(sell_qty);

        h.insert(buy_symbol.to_string(), format_decimal(buy_bal + buy_delta));
        // Allow negative — do NOT clamp to zero (H6: real deficit must be visible)
        h.insert(sell_symbol.to_string(), format_decimal(sell_bal - sell_delta));

        let snapshot = self.build_snapshot(&h);
        drop(h);
        let _ = self.tx.send(snapshot);
    }

    /// Set absolute balance for a token (for initialization).
    pub async fn set_balance(&self, symbol: &str, qty: &str) {
        let mut h = self.holdings.write().await;
        h.insert(symbol.to_string(), qty.to_string());
        let snapshot = self.build_snapshot(&h);
        drop(h);
        let _ = self.tx.send(snapshot);
    }

    /// Get current holdings snapshot.
    pub async fn snapshot(&self) -> HoldingsSnapshot {
        let h = self.holdings.read().await;
        self.build_snapshot(&h)
    }

    fn build_snapshot(&self, holdings: &HashMap<String, String>) -> HoldingsSnapshot {
        let seq = self.seq.fetch_add(1, Ordering::SeqCst);
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        // Build deterministic payload for HMAC: session_id|seq|ts|sorted(sym=qty,...)
        // R3-C1: session_id MUST be in HMAC to prevent cross-session replay
        let mut pairs: Vec<_> = holdings.iter().collect();
        pairs.sort_by_key(|(k, _)| k.clone());
        let payload = format!(
            "{}|{}|{}|{}",
            self.session_id,
            seq,
            ts,
            pairs.iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join(",")
        );

        let mut mac = HmacSha256::new_from_slice(&self.hmac_key)
            .expect("HMAC key length is valid");
        mac.update(payload.as_bytes());
        let hmac_hex = hex::encode(mac.finalize().into_bytes());

        HoldingsSnapshot {
            holdings: holdings.clone(),
            session_id: self.session_id.clone(), // R4-C1: must match HMAC payload
            seq,
            timestamp_ms: ts,
            hmac: hmac_hex,
        }
    }
}

/// Parse and format using rust_decimal for lossless arithmetic (R2-C1: no f64).
use rust_decimal::Decimal;
use std::str::FromStr;

fn parse_decimal(s: &str) -> Decimal {
    Decimal::from_str(s).unwrap_or(Decimal::ZERO)
}

fn format_decimal(v: Decimal) -> String {
    // Normalize to 18 decimal places for consistency
    format!("{}", v.round_dp(18))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_record_trade_updates_balances() {
        let tracker = HoldingsTracker::new(16, b"test-key".to_vec());
        tracker.set_balance("USDC", "1000.0").await;
        tracker.record_trade("BTC", "0.5", "USDC", "500.0").await;

        let snap = tracker.snapshot().await;
        let btc: f64 = snap.holdings["BTC"].parse().unwrap();
        let usdc: f64 = snap.holdings["USDC"].parse().unwrap();
        assert!((btc - 0.5).abs() < 1e-10);
        assert!((usdc - 500.0).abs() < 1e-10);
    }

    #[tokio::test]
    async fn test_subscribe_receives_signed_updates() {
        let tracker = HoldingsTracker::new(16, b"test-key".to_vec());
        let mut rx = tracker.subscribe();
        tracker.set_balance("ETH", "10.0").await;

        let snap = rx.recv().await.unwrap();
        assert!(!snap.hmac.is_empty());
        assert_eq!(snap.seq, 0);
    }

    #[tokio::test]
    async fn test_monotonic_sequence() {
        let tracker = HoldingsTracker::new(16, b"test-key".to_vec());
        let mut rx = tracker.subscribe();
        tracker.set_balance("A", "1.0").await;
        tracker.set_balance("B", "2.0").await;

        let s1 = rx.recv().await.unwrap();
        let s2 = rx.recv().await.unwrap();
        assert!(s2.seq > s1.seq);
    }

    #[tokio::test]
    async fn test_negative_balance_allowed() {
        let tracker = HoldingsTracker::new(16, b"test-key".to_vec());
        tracker.set_balance("USDC", "100.0").await;
        tracker.record_trade("BTC", "1.0", "USDC", "200.0").await;

        let snap = tracker.snapshot().await;
        let usdc: f64 = snap.holdings["USDC"].parse().unwrap();
        assert!(usdc < 0.0); // -100, NOT clamped to 0
    }
}
```

**Step 2: Run tests**

Run: `cd /Users/maxguillabert/Downloads/index && cargo test -p ap holdings`
Expected: 4 tests PASS

**Step 3: Add SSE endpoint to AP**

In `ap/src/main.rs`, add an Axum SSE route `/sse/ap-holdings` that:
1. Calls `tracker.subscribe()` to get a broadcast receiver
2. Sends initial snapshot immediately (HMAC-signed)
3. Streams subsequent snapshots as SSE `data:` events
4. Sends keepalive `:ping` every 15s

Wire `HoldingsTracker` as shared state. HMAC key loaded from env `AP_HOLDINGS_HMAC_KEY`.

After each `vault_client.execute_trade()` call, call `tracker.record_trade(buy_symbol, buy_qty, sell_symbol, sell_qty)`.

**Step 4: Add module declaration**

In `ap/src/lib.rs`, add: `pub mod holdings;`

**Step 5: Compile + commit**

```bash
cargo build -p ap
git add ap/src/holdings.rs ap/src/lib.rs ap/src/main.rs
git commit -m "feat(ap): add HMAC-signed holdings tracker with SSE broadcast"
```

---

### Task 2: Data-Node — AP Holdings Relay

**Files:**
- Create: `data-node/src/ap_holdings.rs`
- Modify: `data-node/src/main.rs` (spawn SSE client, register route)
- Modify: `data-node/src/api.rs` (add `/sse/ap-holdings` relay + REST debug endpoint)
- Test: `data-node/src/ap_holdings.rs` (inline `#[cfg(test)]`)

Data-node subscribes to AP's SSE holdings stream, validates HMAC, caches latest snapshot, re-broadcasts to oracles.

**Step 1: Write AP holdings relay with HMAC validation and tests**

Create `data-node/src/ap_holdings.rs`:

```rust
//! Relays AP token holdings from AP → data-node → oracles.
//!
//! Validates HMAC on each snapshot, enforces monotonic sequence numbers,
//! and rejects stale data. Re-broadcasts to oracle subscribers.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering};
use std::time::Duration;
use tokio::sync::{broadcast, RwLock};
use serde::{Deserialize, Serialize};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use tracing::{info, warn};

type HmacSha256 = Hmac<Sha256>;

/// Mirror of AP's HoldingsSnapshot (R3-C1: includes session_id).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApHoldingsSnapshot {
    pub holdings: HashMap<String, String>,
    pub session_id: String,
    pub seq: u64,
    pub timestamp_ms: u64,
    pub hmac: String,
}

/// Caches the latest AP holdings and re-broadcasts to subscribers.
pub struct ApHoldingsRelay {
    latest: Arc<RwLock<Option<ApHoldingsSnapshot>>>,
    tx: broadcast::Sender<ApHoldingsSnapshot>,
    connected: Arc<AtomicBool>,
    last_seq: Arc<AtomicU64>,
    last_session_id: Arc<RwLock<String>>,
    hmac_key: Vec<u8>,
}

impl ApHoldingsRelay {
    pub fn new(buffer_size: usize, hmac_key: Vec<u8>) -> Self {
        let (tx, _) = broadcast::channel(buffer_size);
        Self {
            latest: Arc::new(RwLock::new(None)),
            tx,
            connected: Arc::new(AtomicBool::new(false)),
            last_seq: Arc::new(AtomicU64::new(0)),
            last_session_id: Arc::new(RwLock::new(String::new())), // R4-C2: empty → first snapshot triggers session-change path
            hmac_key,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ApHoldingsSnapshot> {
        self.tx.subscribe()
    }

    pub async fn latest(&self) -> Option<ApHoldingsSnapshot> {
        self.latest.read().await.clone()
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }

    /// Validate HMAC, handle session changes, enforce monotonic sequence, then update cache.
    pub async fn validate_and_update(&self, snapshot: ApHoldingsSnapshot) -> bool {
        // 1. Verify HMAC — session_id is part of signed payload (R3-C1)
        let mut pairs: Vec<_> = snapshot.holdings.iter().collect();
        pairs.sort_by_key(|(k, _)| k.clone());
        let payload = format!(
            "{}|{}|{}|{}",
            snapshot.session_id,
            snapshot.seq,
            snapshot.timestamp_ms,
            pairs.iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join(",")
        );
        let mut mac = HmacSha256::new_from_slice(&self.hmac_key)
            .expect("HMAC key length is valid");
        mac.update(payload.as_bytes());

        // R4-H3: Constant-time HMAC verification — prevents timing oracle attacks.
        // Decode the received HMAC from hex, then use the hmac crate's verify_slice
        // which internally uses constant-time comparison.
        let received_bytes = match hex::decode(&snapshot.hmac) {
            Ok(b) => b,
            Err(_) => {
                warn!(seq = snapshot.seq, "REJECTING snapshot: malformed HMAC hex");
                return false;
            }
        };
        if mac.verify_slice(&received_bytes).is_err() {
            warn!(seq = snapshot.seq, "REJECTING snapshot: HMAC verification failed");
            return false;
        }

        // R5-C1: Reject snapshots with stale timestamps to prevent cross-session replay.
        // An attacker with a captured old snapshot could force a session change and inject
        // stale holdings. Freshness check closes this: reject if timestamp > 60s old.
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        if now_ms > snapshot.timestamp_ms && (now_ms - snapshot.timestamp_ms) > 60_000 {
            warn!(
                seq = snapshot.seq,
                snapshot_ts = snapshot.timestamp_ms,
                now_ms,
                "REJECTING: snapshot timestamp too old (>60s), possible replay"
            );
            return false;
        }

        // 2. Handle session changes — AP restart resets seq (R3-C1, R2-H2)
        {
            let mut last_session = self.last_session_id.write().await;
            if *last_session != snapshot.session_id {
                info!(
                    old_session = %*last_session,
                    new_session = %snapshot.session_id,
                    "AP session changed (restart detected), resetting sequence tracking"
                );
                self.last_seq.store(0, Ordering::SeqCst);
                *last_session = snapshot.session_id.clone();
            }
        }

        // 3. Enforce monotonic sequence within session (H3)
        let last = self.last_seq.load(Ordering::SeqCst);
        if snapshot.seq <= last && last > 0 {
            warn!(seq = snapshot.seq, last_seq = last, "REJECTING: seq not increasing");
            return false;
        }
        self.last_seq.store(snapshot.seq, Ordering::SeqCst);

        // 4. Update cache and broadcast
        *self.latest.write().await = Some(snapshot.clone());
        let _ = self.tx.send(snapshot);
        true
    }

    pub fn set_connected(&self, connected: bool) {
        self.connected.store(connected, Ordering::Relaxed);
    }

    /// Spawn background task connecting to AP SSE with reconnect.
    pub fn spawn_consumer(
        self: &Arc<Self>,
        ap_url: String,
    ) -> tokio::task::JoinHandle<()> {
        let relay = Arc::clone(self);
        tokio::spawn(async move {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(0))
                .build()
                .expect("failed to build SSE client");

            let mut backoff = Duration::from_secs(1);
            let max_backoff = Duration::from_secs(30);

            loop {
                let url = format!("{}/sse/ap-holdings", ap_url);
                info!(url = %url, "Connecting to AP holdings SSE");

                match connect_ap_sse(&client, &url, &relay).await {
                    Ok(()) => {
                        backoff = Duration::from_secs(1);
                    }
                    Err(e) => {
                        warn!(error = %e, "AP SSE connection failed");
                    }
                }

                relay.set_connected(false);
                tokio::time::sleep(backoff).await;
                backoff = std::cmp::min(backoff * 2, max_backoff);
            }
        })
    }
}

async fn connect_ap_sse(
    client: &reqwest::Client,
    url: &str,
    relay: &ApHoldingsRelay,
) -> Result<(), String> {
    use futures::StreamExt;

    let response = client
        .get(url)
        .header("Accept", "text/event-stream")
        .send()
        .await
        .map_err(|e| format!("AP SSE connect failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("AP SSE returned status {}", response.status()));
    }

    relay.set_connected(true);
    info!("Connected to AP holdings SSE");

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut current_data = String::new();
    const MAX_BUFFER_SIZE: usize = 1_048_576; // R5-H6: 1MB cap prevents OOM from malicious AP

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("SSE stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // R5-H6: Disconnect if buffer or data exceeds size limit (OOM protection)
        if buffer.len() > MAX_BUFFER_SIZE || current_data.len() > MAX_BUFFER_SIZE {
            return Err("SSE buffer overflow — disconnecting (possible attack)".into());
        }

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim_end_matches('\r').to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                if !current_data.is_empty() {
                    if let Ok(snapshot) = serde_json::from_str::<ApHoldingsSnapshot>(&current_data) {
                        relay.validate_and_update(snapshot).await;
                    }
                }
                current_data.clear();
            } else if let Some(data_content) = line.strip_prefix("data:") {
                current_data.push_str(data_content.trim());
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SESSION_ID: &str = "test-session-001";

    fn make_signed_snapshot(key: &[u8], holdings: HashMap<String, String>, seq: u64) -> ApHoldingsSnapshot {
        let ts = 1234567890u64;
        let mut pairs: Vec<_> = holdings.iter().collect();
        pairs.sort_by_key(|(k, _)| k.clone());
        // R4-C3: HMAC payload MUST include session_id (4 fields, matching production format)
        let payload = format!(
            "{}|{}|{}|{}",
            TEST_SESSION_ID, seq, ts,
            pairs.iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join(",")
        );
        let mut mac = HmacSha256::new_from_slice(key).unwrap();
        mac.update(payload.as_bytes());
        ApHoldingsSnapshot {
            holdings,
            session_id: TEST_SESSION_ID.to_string(), // R4-C3: must be present
            seq,
            timestamp_ms: ts,
            hmac: hex::encode(mac.finalize().into_bytes()),
        }
    }

    #[tokio::test]
    async fn test_valid_hmac_accepted() {
        let key = b"secret-key";
        let relay = ApHoldingsRelay::new(16, key.to_vec());
        let snap = make_signed_snapshot(key, HashMap::from([("BTC".into(), "1.5".into())]), 1);
        assert!(relay.validate_and_update(snap).await);
    }

    #[tokio::test]
    async fn test_invalid_hmac_rejected() {
        let relay = ApHoldingsRelay::new(16, b"secret-key".to_vec());
        let snap = ApHoldingsSnapshot {
            holdings: HashMap::from([("BTC".into(), "1.5".into())]),
            session_id: TEST_SESSION_ID.to_string(),
            seq: 1,
            timestamp_ms: 0,
            hmac: "deadbeef".to_string(),
        };
        assert!(!relay.validate_and_update(snap).await);
    }

    #[tokio::test]
    async fn test_replay_rejected() {
        let key = b"secret-key";
        let relay = ApHoldingsRelay::new(16, key.to_vec());
        let snap1 = make_signed_snapshot(key, HashMap::from([("BTC".into(), "1.0".into())]), 5);
        let snap2 = make_signed_snapshot(key, HashMap::from([("BTC".into(), "0.5".into())]), 3);
        assert!(relay.validate_and_update(snap1).await);
        assert!(!relay.validate_and_update(snap2).await); // seq 3 < 5, rejected
    }
}
```

**Step 2: Run tests, wire into main + API, compile, commit**

Same wiring as before — data-node relays to oracles via `/sse/ap-holdings`.

```bash
cargo test -p data-node ap_holdings
cargo build -p data-node
git add data-node/src/ap_holdings.rs data-node/src/main.rs data-node/src/api.rs
git commit -m "feat(data-node): relay HMAC-validated AP holdings via SSE"
```

---

### Task 3: Oracle — Backing Cache Module (U256 Fixed-Point)

**Files:**
- Create: `oracle/src/backing/mod.rs`
- Create: `oracle/src/backing/cache.rs`
- Create: `oracle/src/backing/sse_client.rs`
- Create: `oracle/src/backing/types.rs`
- Modify: `oracle/src/lib.rs` (add `pub mod backing;`)
- Test: `oracle/src/backing/cache.rs` (inline `#[cfg(test)]`)

**CRITICAL FIX (C4, C8): All financial amounts use U256 18-decimal fixed-point, not f64.**

**Step 1: Write types**

Create `oracle/src/backing/types.rs`:

```rust
//! Types for the backing enforcement system.
//! All financial amounts use U256 (18 decimals) — NO f64 for money.

use std::collections::HashMap;
use ethers::types::U256;
use serde::{Deserialize, Serialize};

/// Deficit cap: $10 in 18-decimal fixed-point.
pub const DEFICIT_CAP_USD_18DEC: U256 = U256([10_000_000_000_000_000_000u64, 0, 0, 0]); // 10e18

/// Maximum staleness for SSE snapshots (30 seconds in ms).
pub const MAX_STALENESS_MS: u64 = 30_000;

/// Maximum rebalance pending duration (5 minutes in ms).
pub const REBALANCE_TIMEOUT_MS: u64 = 300_000;

/// A snapshot of AP token holdings from data-node SSE.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApHoldingsSnapshot {
    pub holdings: HashMap<String, String>,
    pub session_id: String, // R4-H1: needed for defense-in-depth HMAC re-verification at oracle
    pub seq: u64,
    pub timestamp_ms: u64,
    pub hmac: String,
}

/// Per-ITP required backing.
#[derive(Debug, Clone)]
pub struct ItpBacking {
    pub itp_id: [u8; 32],
    /// Token symbol → total required quantity (inventory_qty × totalSupply), 18 decimals
    pub required: HashMap<String, U256>,
    /// Per-share inventory: symbol → qty_per_share (18 decimals)
    pub inventory_per_share: HashMap<String, U256>,
    /// Whether a rebalance is pending
    pub rebalance_pending: bool,
    /// When rebalance was marked pending (monotonic Instant — R3-H1)
    pub rebalance_pending_since: Option<std::time::Instant>,
    /// R5-C2: Last confirmed totalSupply — only clear optimistic when supply increases
    pub last_known_total_supply: U256,
}

/// Result of a backing check.
#[derive(Debug, Clone, PartialEq)]
pub enum BackingStatus {
    /// Fully backed, can sign fills
    Backed,
    /// Deficit exceeds cap for these tokens
    DeficitExceeded { tokens: Vec<String> },
    /// Rebalance in progress, all buys blocked
    RebalancePending,
    /// SSE disconnected or stale, fail-closed
    Disconnected,
    /// ITP not tracked (unknown itp_id)
    Unknown,
    /// Required token has no price — fail-closed
    MissingPrice { tokens: Vec<String> },
    /// Asset address not mapped to symbol — fail-closed
    UnmappedAsset,
}
```

**Step 2: Write cache with U256 arithmetic and simulate_fill**

Create `oracle/src/backing/cache.rs`:

Key changes from v1:
- **All amounts are U256 (18 decimals)** — no f64 for holdings, required, prices, deficit
- **`simulate_fill(itp_id, shares_to_mint)`** implemented — checks if minting N shares would push any token over $10 cap, accumulates across fills in a batch
- **Missing price = fail-closed** — if any required token has `price == 0`, the ITP is blocked
- **Staleness check** — if `now - last_snapshot_timestamp > MAX_STALENESS_MS`, treat as disconnected
- **Rebalance timeout** — if `rebalance_pending_since + REBALANCE_TIMEOUT_MS < now`, auto-clear and log alert
- **`can_sign_fill(itp_id, side)` accepts side** — SELL always returns `Backed`

```rust
//! Always-on backing cache with U256 fixed-point arithmetic.
//!
//! Consensus hot path: can_sign_fill(itp_id, side) → O(1) for sells, O(n_assets) for buys.
//! simulate_fill(itp_id, shares) → checks if minting would breach $10 deficit cap.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tokio::sync::RwLock;
use ethers::types::U256;
use tracing::{info, warn, error};

use super::types::*;

/// Parse decimal string to U256 (18 decimals). Returns Err on malformed input (R2-H3: fail-closed).
/// "1.5" → Ok((false, 1_500_000_000_000_000_000))
/// "-0.5" → Ok((true, 500_000_000_000_000_000))
/// "abc" → Err("invalid decimal")
pub fn parse_decimal_to_u256(s: &str) -> Result<(bool, U256), String> {
    let s = s.trim();
    if s.is_empty() {
        return Err("empty string".into());
    }
    let (negative, s) = if s.starts_with('-') {
        (true, &s[1..])
    } else {
        (false, s)
    };

    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() > 2 {
        return Err(format!("multiple decimal points in '{}'", s));
    }

    let whole: U256 = parts[0]
        .parse()
        .map_err(|_| format!("invalid integer part: '{}'", parts[0]))?;
    let frac = if parts.len() > 1 && !parts[1].is_empty() {
        let frac_str = parts[1];
        // Validate all chars are digits
        if !frac_str.chars().all(|c| c.is_ascii_digit()) {
            return Err(format!("invalid fractional part: '{}'", frac_str));
        }
        let digits = frac_str.len().min(18);
        let padded = format!("{:0<18}", &frac_str[..digits]);
        padded.parse::<U256>()
            .map_err(|_| format!("fractional overflow: '{}'", padded))?
    } else {
        U256::zero()
    };

    let e18 = U256::from(10u64).pow(U256::from(18));
    Ok((negative, whole.checked_mul(e18)
        .ok_or("whole part overflow")?
        .checked_add(frac)
        .ok_or("addition overflow")?))
}

pub struct BackingCache {
    /// AP actual holdings: symbol → quantity (18 dec U256). Negative stored as (is_negative, abs_value).
    actual_holdings: Arc<RwLock<HashMap<String, (bool, U256)>>>,
    /// Required backing per ITP (from on-chain state)
    itp_backings: Arc<RwLock<HashMap<[u8; 32], ItpBacking>>>,
    /// Aggregated required per token (sum across all ITPs), 18 dec
    aggregated_required: Arc<RwLock<HashMap<String, U256>>>,
    /// Pending optimistic deltas: itp_id → (symbol → additional_required) (R2-C3)
    /// Tracked separately, added on top during recompute. Cleared when on-chain totalSupply confirms.
    pending_optimistic: Arc<RwLock<HashMap<[u8; 32], HashMap<String, (U256, std::time::Instant)>>>>, // R3-H3: (amount, inserted_at)
    /// R5-H9: Per-ITP fill counter for pending_optimistic cap (counts fills, not symbols)
    pending_fill_count: Arc<RwLock<HashMap<[u8; 32], u32>>>,
    /// Blocked ITP set
    blocked_itps: Arc<RwLock<HashSet<[u8; 32]>>>,
    /// Prices: symbol → USD price (18 dec U256)
    prices: Arc<RwLock<HashMap<String, U256>>>,
    /// SSE connected flag
    sse_connected: Arc<AtomicBool>,
    /// Last snapshot received (monotonic Instant, not wall clock — R2-H4)
    last_snapshot_received: Arc<RwLock<Option<std::time::Instant>>>,
}

impl BackingCache {
    pub fn new() -> Self {
        Self {
            actual_holdings: Arc::new(RwLock::new(HashMap::new())),
            itp_backings: Arc::new(RwLock::new(HashMap::new())),
            aggregated_required: Arc::new(RwLock::new(HashMap::new())),
            pending_optimistic: Arc::new(RwLock::new(HashMap::new())), // R3-C2
            pending_fill_count: Arc::new(RwLock::new(HashMap::new())), // R5-H9
            blocked_itps: Arc::new(RwLock::new(HashSet::new())),
            prices: Arc::new(RwLock::new(HashMap::new())),
            sse_connected: Arc::new(AtomicBool::new(false)),
            last_snapshot_received: Arc::new(RwLock::new(None)), // R3-C2: Instant, not AtomicU64
        }
    }

    // ---- Consensus path ----

    /// Check if fills can be signed. SELL always returns Backed (C5, H5).
    /// For BUY, checks blocked_itps set.
    pub async fn can_sign_fill(&self, itp_id: &[u8; 32], is_sell: bool) -> BackingStatus {
        // Sells ALWAYS allowed — even during disconnect or rebalance (C5, H5)
        if is_sell {
            return BackingStatus::Backed;
        }

        // Check SSE connected + staleness using monotonic clock (R2-H4)
        if !self.sse_connected.load(Ordering::Relaxed) {
            return BackingStatus::Disconnected;
        }
        {
            let last_received = self.last_snapshot_received.read().await;
            if let Some(instant) = *last_received {
                if instant.elapsed() > std::time::Duration::from_millis(MAX_STALENESS_MS) {
                    return BackingStatus::Disconnected;
                }
            } else {
                // Never received a snapshot yet — fail-closed
                return BackingStatus::Disconnected;
            }
        }

        // Check rebalance with timeout (H4, R3-H1: explicit return, Instant-based timing)
        {
            let backings = self.itp_backings.read().await;
            if let Some(backing) = backings.get(itp_id) {
                if backing.rebalance_pending {
                    if let Some(ref since) = backing.rebalance_pending_since {
                        if since.elapsed() > std::time::Duration::from_millis(REBALANCE_TIMEOUT_MS) {
                            // R2-H1: Transition to RebalanceStale — still blocks, but alerts
                            error!(
                                itp_id = hex::encode(itp_id),
                                "ALERT: Rebalance pending timed out after 5min — ITP still blocked"
                            );
                        }
                    }
                    // R3-H1: Always return RebalancePending when flag is set — never fall through
                    return BackingStatus::RebalancePending;
                }
            } else {
                return BackingStatus::Unknown;
            }
        }

        // Check blocked set
        if self.blocked_itps.read().await.contains(itp_id) {
            // Return detailed status
            self.compute_deficit_status(itp_id).await
        } else {
            BackingStatus::Backed
        }
    }

    /// Simulate minting `shares_to_mint` for `itp_id`. Returns Backed if the
    /// new required backing stays within $10 deficit cap for all tokens. (C3)
    /// `cumulative_pending`: additional required from fills already approved in this batch.
    pub async fn simulate_fill(
        &self,
        itp_id: &[u8; 32],
        shares_to_mint: U256,
        cumulative_pending: &HashMap<String, U256>,
    ) -> BackingStatus {
        // R5-H5: Same staleness/disconnect checks as can_sign_fill — prevent signing on stale data
        if !self.sse_connected.load(Ordering::Relaxed) {
            return BackingStatus::Disconnected;
        }
        if let Some(last_received) = *self.last_snapshot_received.read().await {
            if last_received.elapsed().as_millis() as u64 > MAX_STALENESS_MS {
                return BackingStatus::Disconnected; // Treat stale as disconnected
            }
        } else {
            return BackingStatus::Disconnected; // Never received a snapshot
        }

        let backings = self.itp_backings.read().await;
        let backing = match backings.get(itp_id) {
            Some(b) => b,
            None => return BackingStatus::Unknown,
        };

        let actual = self.actual_holdings.read().await;
        let agg = self.aggregated_required.read().await;
        let prices = self.prices.read().await;
        let e18 = U256::from(10u64).pow(U256::from(18));

        let mut missing_price_tokens = Vec::new();
        let mut deficit_tokens = Vec::new();

        for (symbol, qty_per_share) in &backing.inventory_per_share {
            let price = match prices.get(symbol) {
                Some(p) if !p.is_zero() => *p,
                _ => {
                    // H1, H7: Missing/zero price = fail-closed
                    missing_price_tokens.push(symbol.clone());
                    continue;
                }
            };

            // R3-H2: All arithmetic checked — overflow → DeficitExceeded (fail-closed)
            // New required for this fill: qty_per_share * shares_to_mint / 1e18
            let additional_required = match qty_per_share
                .checked_mul(shares_to_mint)
                .and_then(|v| v.checked_div(e18))
            {
                Some(v) => v,
                None => {
                    deficit_tokens.push(symbol.clone());
                    continue;
                }
            };

            // Total required = current aggregated + additional + cumulative from this batch
            let current_required = agg.get(symbol).copied().unwrap_or(U256::zero());
            let pending = cumulative_pending.get(symbol).copied().unwrap_or(U256::zero());
            let total_required = match current_required
                .checked_add(additional_required)
                .and_then(|v| v.checked_add(pending))
            {
                Some(v) => v,
                None => {
                    deficit_tokens.push(symbol.clone());
                    continue;
                }
            };

            // Actual holdings
            let (is_negative, abs_actual) = actual
                .get(symbol)
                .cloned()
                .unwrap_or((false, U256::zero()));

            // Deficit = total_required - actual (if actual is negative, deficit = required + abs_actual)
            // R4-H2: checked_add for negative holdings — overflow → DeficitExceeded (matches compute_deficit_status)
            let deficit = if is_negative {
                total_required.checked_add(abs_actual).unwrap_or(U256::MAX)
            } else if total_required > abs_actual {
                total_required - abs_actual
            } else {
                U256::zero()
            };

            // R3-H2: Deficit USD checked arithmetic — overflow → DeficitExceeded
            let deficit_usd = match deficit.checked_mul(price).and_then(|v| v.checked_div(e18)) {
                Some(v) => v,
                None => {
                    deficit_tokens.push(symbol.clone());
                    continue;
                }
            };

            if deficit_usd > DEFICIT_CAP_USD_18DEC {
                deficit_tokens.push(symbol.clone());
            }
        }

        if !missing_price_tokens.is_empty() {
            return BackingStatus::MissingPrice {
                tokens: missing_price_tokens,
            };
        }
        if !deficit_tokens.is_empty() {
            return BackingStatus::DeficitExceeded {
                tokens: deficit_tokens,
            };
        }
        BackingStatus::Backed
    }

    /// R5-H3: Public accessor for leader's cumulative_pending accumulation.
    /// Returns the per-symbol delta that minting `shares` of `itp_id` would add to required.
    /// Uses checked arithmetic (R5-H2). Returns None if ITP unknown.
    pub async fn compute_fill_deltas(
        &self,
        itp_id: &[u8; 32],
        shares: U256,
    ) -> Option<Vec<(String, U256)>> {
        let e18 = U256::from(10u64).pow(U256::from(18));
        let backings = self.itp_backings.read().await;
        let backing = backings.get(itp_id)?;
        let mut deltas = Vec::new();
        for (symbol, qty_per_share) in &backing.inventory_per_share {
            let additional = qty_per_share
                .checked_mul(shares)
                .and_then(|v| v.checked_div(e18))?;
            deltas.push((symbol.clone(), additional));
        }
        Some(deltas)
    }

    // ---- Background task writers ----

    /// Update actual holdings from SSE snapshot (already HMAC-validated by data-node).
    /// Malformed entries are treated as missing (fail-closed per R2-H3).
    pub async fn update_holdings(&self, snapshot: ApHoldingsSnapshot) {
        let mut actual = self.actual_holdings.write().await;
        actual.clear();
        for (symbol, qty_str) in &snapshot.holdings {
            match parse_decimal_to_u256(qty_str) {
                Ok((neg, val)) => {
                    actual.insert(symbol.clone(), (neg, val));
                }
                Err(e) => {
                    warn!(symbol = %symbol, value = %qty_str, error = %e,
                        "FAIL-CLOSED: malformed AP holding, treating as zero");
                    // Intentionally NOT inserted — treated as missing (deficit will be computed)
                }
            }
        }
        *self.last_snapshot_received.write().await = Some(std::time::Instant::now());
        drop(actual);
        self.recompute_blocked().await;
    }

    /// Update required backing for an ITP. Uses checked U256 throughout (C4, C9, R2-H5).
    /// `inventory`: [(symbol, qty_per_share as U256 18dec)]
    /// `total_supply`: U256 18dec
    pub async fn update_itp_required(
        &self,
        itp_id: [u8; 32],
        inventory: Vec<(String, U256)>,
        total_supply: U256,
    ) {
        let e18 = U256::from(10u64).pow(U256::from(18));
        let required: HashMap<String, U256> = inventory
            .iter()
            .filter_map(|(symbol, qty_per_share)| {
                // R2-H5: checked_mul to prevent overflow
                let req = qty_per_share.checked_mul(total_supply)
                    .and_then(|v| v.checked_div(e18))
                    .unwrap_or_else(|| {
                        error!(symbol = %symbol, "U256 overflow in required backing calculation");
                        U256::MAX // Fail-closed: overflow = infinite requirement = blocked
                    });
                Some((symbol.clone(), req))
            })
            .collect();

        let inventory_per_share: HashMap<String, U256> = inventory
            .into_iter()
            .collect();

        let mut backings = self.itp_backings.write().await;
        let entry = backings.entry(itp_id).or_insert_with(|| ItpBacking {
            itp_id,
            required: HashMap::new(),
            inventory_per_share: HashMap::new(),
            rebalance_pending: false,
            rebalance_pending_since: None,
            last_known_total_supply: U256::zero(), // R5-C2
        });
        entry.required = required;
        entry.inventory_per_share = inventory_per_share;

        // R5-C2: Only clear optimistic deltas when totalSupply actually increased.
        // If poll reads old totalSupply (confirmFills tx still pending), we MUST NOT
        // wipe pending deltas — they're the only thing preventing double-commitment.
        let supply_increased = total_supply > entry.last_known_total_supply;
        entry.last_known_total_supply = total_supply;
        drop(backings);

        if supply_increased {
            // On-chain confirmed the mint(s) — optimistic deltas are now baked in
            self.clear_optimistic(itp_id).await;
        }

        self.recompute_aggregated().await;
        self.recompute_blocked().await;
    }

    /// Optimistic update after signing fills (C6). Stored SEPARATELY from aggregated_required (R2-C3).
    /// Added on top during recompute. Cleared when on-chain totalSupply confirms the mint.
    /// R3-H3: Entries have TTL (60s) and per-ITP cap (50 pending fills) to prevent unbounded growth.
    pub async fn optimistic_fill_update(
        &self,
        itp_id: [u8; 32],
        additional_shares: U256,
    ) {
        let e18 = U256::from(10u64).pow(U256::from(18));
        let backings = self.itp_backings.read().await;
        if let Some(backing) = backings.get(&itp_id) {
            let mut pending = self.pending_optimistic.write().await;

            // R3-H3, R5-H1: Evict stale entries (TTL = 300s / 5 min).
            // Must be >= worst-case on-chain confirmation time to prevent double-mint window.
            // On-chain confirm normally clears via `clear_optimistic`; TTL is fail-closed safety net.
            // If TTL expires before confirm, the reservation is released — but recompute_blocked
            // will re-evaluate using actual on-chain state, so this is safe.
            let now = std::time::Instant::now();
            pending.retain(|_, entries| {
                entries.retain(|_, (_, inserted_at)| now.duration_since(*inserted_at).as_secs() < 300);
                !entries.is_empty()
            });

            // R3-H3 + R5-H9: Per-ITP cap counts FILLS, not symbols.
            // Old cap counted symbols — broke for ITPs with >50 assets (one fill = 100 entries).
            // Now tracks actual fill count separately.
            let mut fill_counts = self.pending_fill_count.write().await;
            let fill_count = fill_counts.entry(itp_id).or_insert(0);
            if *fill_count >= 50 {
                warn!(itp_id = ?hex::encode(itp_id), fill_count = *fill_count,
                    "FAIL-CLOSED: pending_optimistic fill cap reached (50), refusing new fill");
                drop(fill_counts);
                drop(pending);
                drop(backings);
                return;
            }
            *fill_count += 1;
            drop(fill_counts);

            let itp_pending = pending.entry(itp_id).or_insert_with(HashMap::new);
            for (symbol, qty_per_share) in &backing.inventory_per_share {
                // R2-H5: checked_mul
                if let Some(additional) = qty_per_share.checked_mul(additional_shares)
                    .and_then(|v| v.checked_div(e18))
                {
                    let entry = itp_pending.entry(symbol.clone()).or_insert((U256::zero(), now));
                    entry.0 += additional;
                    entry.1 = now; // refresh timestamp on update
                }
            }
            drop(pending);
            drop(backings);
            // R5-C3: MUST call recompute_aggregated BEFORE recompute_blocked.
            // Without this, pending_optimistic deltas are invisible to aggregated_required,
            // and simulate_fill/recompute_blocked read stale values — allowing double-commitment.
            self.recompute_aggregated().await;
            self.recompute_blocked().await;
        }
    }

    /// Clear optimistic deltas for an ITP when on-chain totalSupply confirms the mint (R2-C3).
    pub async fn clear_optimistic(&self, itp_id: [u8; 32]) {
        self.pending_optimistic.write().await.remove(&itp_id);
        self.pending_fill_count.write().await.remove(&itp_id); // R5-H9
    }

    pub async fn update_prices(&self, new_prices: HashMap<String, U256>) {
        let mut prices = self.prices.write().await;
        for (symbol, price) in new_prices {
            prices.insert(symbol, price);
        }
        drop(prices);
        self.recompute_blocked().await;
    }

    pub async fn set_rebalance_pending(&self, itp_id: [u8; 32], pending: bool) {
        let mut backings = self.itp_backings.write().await;
        if let Some(backing) = backings.get_mut(&itp_id) {
            backing.rebalance_pending = pending;
            backing.rebalance_pending_since = if pending {
                Some(std::time::Instant::now())
            } else {
                None
            };
        }
        drop(backings);

        if pending {
            self.blocked_itps.write().await.insert(itp_id);
        } else {
            self.recompute_blocked().await;
        }
    }

    pub fn set_sse_connected(&self, connected: bool) {
        self.sse_connected.store(connected, Ordering::Relaxed);
        if !connected {
            warn!("AP SSE disconnected — buy minting blocked (sells still allowed)");
        }
    }

    pub fn is_sse_connected(&self) -> bool {
        self.sse_connected.load(Ordering::Relaxed)
    }

    // ---- Internal ----

    async fn compute_deficit_status(&self, itp_id: &[u8; 32]) -> BackingStatus {
        let backings = self.itp_backings.read().await;
        let actual = self.actual_holdings.read().await;
        let agg = self.aggregated_required.read().await;
        let prices = self.prices.read().await;
        let e18 = U256::from(10u64).pow(U256::from(18));

        if let Some(backing) = backings.get(itp_id) {
            let mut deficit_tokens = Vec::new();
            let mut missing_tokens = Vec::new();

            for symbol in backing.required.keys() {
                let price = match prices.get(symbol) {
                    Some(p) if !p.is_zero() => *p,
                    _ => {
                        missing_tokens.push(symbol.clone());
                        continue;
                    }
                };

                let required = agg.get(symbol).copied().unwrap_or(U256::zero());
                let (is_neg, abs_actual) = actual.get(symbol).cloned().unwrap_or((false, U256::zero()));

                let deficit = if is_neg {
                    // R3-H2: checked_add for negative holdings
                    required.checked_add(abs_actual).unwrap_or(U256::MAX)
                } else if required > abs_actual {
                    required - abs_actual
                } else {
                    U256::zero()
                };

                // R3-H2: checked arithmetic — overflow → blocked
                let deficit_usd = deficit
                    .checked_mul(price)
                    .and_then(|v| v.checked_div(e18))
                    .unwrap_or(U256::MAX);
                if deficit_usd > DEFICIT_CAP_USD_18DEC {
                    deficit_tokens.push(symbol.clone());
                }
            }

            if !missing_tokens.is_empty() {
                BackingStatus::MissingPrice { tokens: missing_tokens }
            } else if deficit_tokens.is_empty() {
                BackingStatus::Backed
            } else {
                BackingStatus::DeficitExceeded { tokens: deficit_tokens }
            }
        } else {
            BackingStatus::Unknown
        }
    }

    async fn recompute_aggregated(&self) {
        let backings = self.itp_backings.read().await;
        let pending = self.pending_optimistic.read().await;
        let mut agg: HashMap<String, U256> = HashMap::new();

        // R5-H4: Sum from on-chain confirmed state — checked_add, overflow → U256::MAX (fail-closed)
        for backing in backings.values() {
            for (symbol, qty) in &backing.required {
                let entry = agg.entry(symbol.clone()).or_insert(U256::zero());
                *entry = entry.checked_add(*qty).unwrap_or(U256::MAX);
            }
        }

        // R5-H4: Add pending optimistic deltas on top (R2-C3, R3-H3: tuple.0 is amount)
        for itp_pending in pending.values() {
            for (symbol, (delta, _inserted_at)) in itp_pending {
                let entry = agg.entry(symbol.clone()).or_insert(U256::zero());
                *entry = entry.checked_add(*delta).unwrap_or(U256::MAX);
            }
        }

        *self.aggregated_required.write().await = agg;
    }

    async fn recompute_blocked(&self) {
        let actual = self.actual_holdings.read().await;
        let agg = self.aggregated_required.read().await;
        let prices = self.prices.read().await;
        let backings = self.itp_backings.read().await;
        let e18 = U256::from(10u64).pow(U256::from(18));

        // Find tokens with deficit > $10 or missing price
        let mut bad_tokens: HashSet<String> = HashSet::new();
        for (symbol, required) in agg.iter() {
            let price = prices.get(symbol).copied().unwrap_or(U256::zero());

            // H1: missing price on required token = blocked
            if price.is_zero() && !required.is_zero() {
                bad_tokens.insert(symbol.clone());
                continue;
            }

            let (is_neg, abs_actual) = actual.get(symbol).cloned().unwrap_or((false, U256::zero()));
            let deficit = if is_neg {
                // R3-H2: checked_add — overflow → U256::MAX → blocked
                required.checked_add(abs_actual).unwrap_or(U256::MAX)
            } else if *required > abs_actual {
                *required - abs_actual
            } else {
                U256::zero()
            };

            // R3-H2: checked arithmetic
            let deficit_usd = deficit
                .checked_mul(price)
                .and_then(|v| v.checked_div(e18))
                .unwrap_or(U256::MAX);
            if deficit_usd > DEFICIT_CAP_USD_18DEC {
                bad_tokens.insert(symbol.clone());
            }
        }

        let mut blocked = HashSet::new();
        for (itp_id, backing) in backings.iter() {
            if backing.rebalance_pending {
                blocked.insert(*itp_id);
                continue;
            }
            for symbol in backing.required.keys() {
                if bad_tokens.contains(symbol) {
                    blocked.insert(*itp_id);
                    break;
                }
            }
        }

        *self.blocked_itps.write().await = blocked;
    }
}
```

**Step 3: Write SSE client** — same as before but also verifies HMAC + seq locally as defense-in-depth.

**Step 4: Write mod.rs**

```rust
pub mod cache;
pub mod sse_client;
pub mod types;

pub use cache::BackingCache;
pub use types::{ApHoldingsSnapshot, BackingStatus};
```

**Step 5: Tests, compile, commit**

```bash
cargo test -p oracle backing
cargo build -p oracle
git add oracle/src/backing/
git commit -m "feat(oracle): backing cache with U256 fixed-point and simulate_fill"
```

---

### Task 4: Fix ItpInventoryState to Include totalSupply (C9)

**Files:**
- Modify: `common/src/traits/chain_reader.rs` (add `total_supply: U256` to `ItpInventoryState`)
- Modify: `oracle/src/chain/reader.rs` (stop discarding `_total_supply`)

**Step 1: Add totalSupply to ItpInventoryState**

The existing code at `reader.rs:806` does:
```rust
let (_creator, _total_supply, nav, assets, _weights, inventory) = ...
```

Change to:
```rust
let (_creator, total_supply, nav, assets, _weights, inventory) = ...
```

And add `total_supply` to the returned struct.

**Step 2: Compile + commit**

```bash
cargo build -p oracle
git commit -m "fix: include totalSupply in ItpInventoryState (was discarded)"
```

---

### Task 5: On-Chain State Listener (Event-Driven + Poll Hybrid, H2)

**Files:**
- Create: `oracle/src/backing/on_chain.rs`
- Create: `oracle/src/backing/chain_adapter.rs`
- Modify: `oracle/src/backing/mod.rs`

**Key fix (H2):** Use event-driven updates for `confirmFills` (subscribe to data-node SSE `fill-confirmed` events) AND a 5-second poll as fallback. When a `fill-confirmed` event arrives, immediately re-read the ITP state and update the cache.

**Key fix (H7):** If an asset address can't be mapped to a symbol, the ITP is blocked (`BackingStatus::UnmappedAsset`).

**Key fix (R5-H7):** Symbol names from ERC-20 `symbol()` MUST be validated before use in HMAC payloads. Reject symbols containing `|`, `=`, or `,` (HMAC delimiter characters) to prevent canonicalization collisions. A malicious token with `symbol()` returning `"BTC=999999,ETH"` could create HMAC payload ambiguity. Validation: `if symbol.contains('|') || symbol.contains('=') || symbol.contains(',') { → UnmappedAsset }`.

The `ChainReaderAdapter` reads `getITPState` atomically (inventory + totalSupply in one call, fixing C9) and does the multiplication in U256 space before any conversion.

```bash
cargo test -p oracle backing
git commit -m "feat(oracle): event-driven on-chain listener with symbol mapping fail-closed"
```

---

### Task 6: Consensus Integration — Gate `confirmFills`, Not `confirmBatch` (C1)

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`
- Modify: `oracle/src/main.rs` (wire BackingCache + R5-H8: L3-native order side registration)

**R5-H8: Order side registration for ALL order types.** The backing check determines side from
`BridgeOrchestrator::get_order_limit_price(order_id)`. This MUST be called for every order type:

1. **Cross-chain buys** — already set at line 1674: `set_order_limit_price(order_id, limit_price, 0)`
2. **Cross-chain sells** — MUST ADD: `set_order_limit_price(sell_order_id, limit_price, 1)` at sell order registration
3. **L3-native orders** — MUST ADD in `run_l3_native_order_processing` (main.rs):
```rust
// After line 3016: orch.set_order_status(order.id, SubmittedOnL3).await;
// ADD: Register side so backing check can determine buy vs sell
orch.set_order_limit_price(order.id, order.limit_price, order.side as u8).await;
```
Without this for ANY order type, `get_order_limit_price` returns None → fail-closed excludes
the fill (buys AND sells), contradicting the invariant that sells always pass.

**CRITICAL FIXES:**

**C1: Move check to `confirmFills` phase.** The backing check gates `handle_confirm_fills_proposal` (follower) and `run_fills_confirm_as_leader` (leader), NOT `handle_batch_proposal_as_follower`. At `confirmBatch` time, the AP hasn't received USDC yet and can't have bought tokens.

**C2: Fail-closed on lookup failure.** If `get_order()` fails, EXCLUDE the fill:
```rust
Err(e) => {
    warn!(order_id, error = %e, "FAIL-CLOSED: excluding fill — order lookup failed");
    continue; // Skip this fill, do NOT include it
}
```

**C3: Cumulative simulate_fill.** Leader accumulates pending required across fills:
```rust
let mut cumulative_pending: HashMap<String, U256> = HashMap::new();
for fill in &fills {
    // R4-H4: Side from BridgeOrchestrator, not Fill struct (R3-H5)
    let is_buy = match orchestrator.read().await.get_order_limit_price(fill.order_id) {
        Some((_, side)) => side == 0, // 0 = BUY
        None => {
            warn!(order_id = %fill.order_id, "FAIL-CLOSED: no side info, excluding fill");
            continue;
        }
    };
    if is_buy {
        // R5-H3: Get itp_id from orchestrator (not undefined `order` variable)
        let itp_id = match orchestrator.read().await.get_order_itp_id(fill.order_id).await {
            Some(id) => id,
            None => {
                warn!(order_id = %fill.order_id, "FAIL-CLOSED: no itp_id, excluding fill");
                continue;
            }
        };
        let shares = compute_shares(fill.fill_amount, fill.fill_price);
        match cache.simulate_fill(&itp_id, shares, &cumulative_pending).await {
            BackingStatus::Backed => {
                // R5-H2 + R5-H3: Update cumulative_pending with checked arithmetic.
                // Get deltas from cache (which owns inventory_per_share).
                if let Some(deltas) = cache.compute_fill_deltas(&itp_id, shares).await {
                    for (symbol, additional) in deltas {
                        // R5-H2: checked_add for cumulative_pending accumulation
                        let entry = cumulative_pending.entry(symbol).or_insert(U256::zero());
                        *entry = entry.checked_add(additional).unwrap_or(U256::MAX);
                    }
                    allowed_fills.push(fill);
                } else {
                    warn!(order_id = %fill.order_id, "FAIL-CLOSED: cannot compute fill deltas");
                }
            }
            status => {
                warn!("Leader: excluding fill — {:?}", status);
            }
        }
    } else {
        allowed_fills.push(fill); // Sells always allowed
    }
}
```

**C5 + R2-C2: Leader filters, follower verifies leader's decision.** The leader filters fills (removing unbacked buys). The follower independently runs `simulate_fill` on the leader's proposed fill set (using cumulative accounting). If ALL fills pass the follower's check → sign. If ANY buy fill fails → refuse to sign the whole batch. This is correct because the leader already filtered — if the follower disagrees, it means cache state diverged, and refusing is the safe choice. The follower determines `side` from its own in-memory order tracking (`BridgeOrchestrator` order cache), NOT from the Fill struct or P2P message. No `side` field needed in Fill struct or on-chain.

**C6: Optimistic update after signing.** After the batch is signed:
```rust
cache.optimistic_fill_update(itp_id, shares_minted).await;
```

**C10 (SUPERSEDED by R3-H5): Do NOT add `side` to Fill struct.** Side is determined from
`BridgeOrchestrator::get_order_limit_price(order_id)` which returns `Option<(U256, u8)>` where
`u8` is the side (0=BUY, 1=SELL). Fill struct stays unchanged:
```rust
pub struct Fill {
    pub order_id: U256,
    pub fill_price: U256,
    pub fill_amount: U256,
    // NO side field — side from BridgeOrchestrator in-memory cache (R3-H5, R4-H4)
}
```
For L3-native orders: `run_l3_native_order_processing` must call
`orch.set_order_limit_price(order.id, order.limit_price, order.side as u8)` before
`run_fills_confirm_phase` so the backing check can determine side.

```bash
cargo build -p oracle
git commit -m "feat(oracle): gate confirmFills with backing check, simulate_fill, fail-closed"
```

---

### Task 7: Integration Test

**Files:**
- Create: `oracle/tests/backing_integration.rs`

Tests:
1. Fully backed → fills signed
2. Deficit > $10 → buys refused, sells pass
3. SSE disconnect → buys blocked, sells still pass
4. Stale snapshot → treated as disconnected
5. Rebalance pending → buys blocked, auto-clears after 5min timeout
6. Missing price → fail-closed (MissingPrice status)
7. Negative AP balance → deficit correctly increased
8. simulate_fill with cumulative batch → blocks when batch total exceeds cap
9. Optimistic update → second batch sees updated required
10. Invalid HMAC → snapshot rejected

```bash
cargo test -p oracle backing_integration
git commit -m "test(oracle): comprehensive backing enforcement integration tests"
```

---

### Task 8: Config + Documentation

- Add `ORACLE_BACKING_HMAC_KEY` and `AP_HOLDINGS_HMAC_KEY` env vars
- Add `ORACLE_BACKING_DATA_NODE_URL` config field
- Update CLAUDE.md with backing enforcement invariants

```bash
git commit -m "docs: document backing enforcement system and config"
```

---

## Security Fixes Summary

### Round 1 (10 CRITICAL, 9 HIGH)

| Finding | Fix | Task |
|---------|-----|------|
| C1: Wrong consensus phase | Gate `confirmFills`, not `confirmBatch` | 6 |
| C2: Leader fail-open | Fail-closed: exclude fill on lookup failure | 6 |
| C3: No simulate_fill | Cumulative simulate_fill across batch | 3, 6 |
| C4: f64 precision | U256 18-decimal fixed-point throughout | 3 |
| C5: Whole-batch rejection | Leader filters, follower verifies leader's set | 6 |
| C6: TOCTOU stale totalSupply | Optimistic cache update (separate tracking) | 3, 6 |
| C7: Unauthenticated SSE | HMAC-SHA256 signed snapshots | 1, 2 |
| C8: u256_to_f64 truncation | No f64 conversion — U256 throughout | 3 |
| C9: totalSupply discarded | Add to ItpInventoryState, atomic read | 4 |
| C10: Fill lacks side | Side from in-memory order cache, not Fill struct | 6 |
| H1: Missing price = 0.0 | Missing price = fail-closed (blocked) | 3 |
| H2: 5s poll staleness | Event-driven + poll hybrid, optimistic update | 5, 6 |
| H3: No replay protection | Monotonic sequence numbers + HMAC + session_id | 1, 2 |
| H4: No rebalance timeout | 5-minute timeout → RebalanceStale (still blocked) | 3 |
| H5: SSE disconnect blocks sells | `can_sign_fill(itp_id, is_sell)` — sells always Backed | 3 |
| H6: Clamp-to-zero | Allow negative balances | 1 |
| H7: Unmapped symbol | Unmapped asset = fail-closed | 5 |
| H8: Zero totalSupply free pass | simulate_fill handles first mint | 3, 6 |
| H9: Single point of trust | Defense-in-depth: HMAC + per-oracle validation | 1, 2, 3 |

### Round 2 (3 CRITICAL, 6 HIGH)

| Finding | Fix | Task |
|---------|-----|------|
| R2-C1: AP uses f64 | `rust_decimal::Decimal` for AP arithmetic, no f64 | 1 |
| R2-C2: Per-fill validation broken | Leader filters, follower validates full set. Side from in-memory cache. | 6 |
| R2-C3: Optimistic overwrites aggregated | Separate `pending_optimistic` map, added during recompute, cleared on on-chain confirm | 3 |
| R2-H1: Rebalance timeout resumes buys | Timeout → `RebalanceStale` (still blocked) + operator alert | 3 |
| R2-H2: AP restart resets seq | `session_id` per AP startup, relay resets seq on new session | 1, 2 |
| R2-H3: Malformed input = zero | `parse_decimal_to_u256` returns `Result`, fail-closed on error | 3 |
| R2-H4: Wall clock staleness | `Instant::now()` monotonic clock for duration-since-received | 3 |
| R2-H5: Unchecked U256 mul | `checked_mul`/`checked_div` throughout, overflow = blocked | 3 |
| R2-H6: Symbol mapping undefined | Auto-derived from on-chain ERC-20 `symbol()`, cached | 5 |
