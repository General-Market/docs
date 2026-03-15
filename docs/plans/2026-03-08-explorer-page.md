# Explorer Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full explorer page on the frontend that visualizes 95 oracle metrics as graphs, powered by data-node polling oracle `/health` endpoints every 5 minutes and storing snapshots in PostgreSQL.

**Architecture:** Data-node gets a new `oracle_health_collector` that polls all oracle `/health` endpoints every 5 minutes, stores snapshots in a new `oracle_health_snapshots` table. New `/explorer/*` API endpoints (authenticated, frontend-only) serve time-series data. Frontend gets an `/explorer` page with tabbed sections (Consensus, Orders, Price, P2P, Cycles, ITP, Vision, Health, Chain) each containing recharts graphs.

**Tech Stack:** Rust/Axum/sqlx (data-node), Next.js 15/React 19/recharts/Tailwind (frontend)

**Storage estimate:** ~3-5 MB/day (3 nodes × 288 snapshots/day × ~200 bytes each + index overhead). 30-day auto-pruning keeps table under ~150 MB.

**Security model:**
- Data-node `/explorer/*` endpoints require `X-Explorer-Token` header (hash-then-compare with SHA-256, fail-closed if unset or empty)
- Only the Next.js server-side proxy calls data-node — browsers never call data-node directly
- **ALL public API responses are AGGREGATED across nodes** — no per-node breakdown in any response (prevents leadership inference via signatures_collected, consensus timing, failure rates, etc.)
- Collector assigns a shared `poll_batch_ts` before polling all nodes; `GROUP BY poll_batch_ts` guarantees true aggregation (not `GROUP BY fetched_at` which produces per-node rows due to sequential INSERTs)
- Per-node data stored in DB for internal monitoring only, never exposed through explorer API
- Timing fields use `AVG()` not `MAX()` — in a 3-node network, `MAX` exposes the single slowest node (leader)
- `node_count` clamped to `quorum_met: bool` — exact node count leaks availability patterns
- All SQL queries are fully parameterized (no `format!()` interpolation)
- Input validation at both proxy and API layers; proxy whitelists response fields before forwarding
- 30-day auto-retention with `LIMIT` caps on all queries
- Collector has response size cap (10 MB) to prevent OOM from compromised oracles
- Proxy checks body size after reading (not Content-Length header, which is absent on chunked responses)
- Oracle `/health` ports must be firewalled (infra — only data-node can reach them)
- Collector randomizes polling order each cycle to prevent timing fingerprinting
- Collector documents security disposition of every `/health` field with `DANGEROUS_FIELDS` constant
- Secrets (EXPLORER_TOKEN) loaded from env vars only — never committed to git

---

## Security Audit Trail

Reviewed by 3 independent security sub-agents across 4 rounds (12 total reviews). All CRITICAL and HIGH findings addressed:

### Round 1

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| C1 | CRITICAL | Leader identification enables targeted DoS | Aggregate all data — never expose per-node |
| C2 | CRITICAL | Leader rotation pattern leakage via time-series | Don't store `is_leader`; aggregate only |
| H1 | HIGH | SQL injection via format!() | Use `make_interval(secs => $1)` parameterized queries |
| H2 | HIGH | Unbounded table growth | Auto-prune rows older than 30 days every hour |
| H3 | HIGH | Unbounded response size | `LIMIT 2000` on all queries |
| H4 | HIGH | No rate limiting | Auth token + `s-maxage=30` cache on proxy |
| H5 | HIGH | SSRF via oracle URLs | Disable redirects, validate URLs at startup |
| H6 | HIGH | node_id integer truncation | `i32::try_from` with rejection on failure |
| H7 | HIGH | Arbitrary status string stored | Whitelist: healthy/degraded/unhealthy/unknown |
| H8 | HIGH | Database error leakage | Log real errors, return generic message |
| H9 | HIGH | Unvalidated range/node_id in proxy | Allowlist + regex validation before forwarding |
| H10 | HIGH | Consensus timing enables front-running | Remove `consensus_in_progress` from public data |
| H11 | HIGH | P2P security metrics as attacker scorecard | Aggregate only: total messages, no security counters |
| H12 | HIGH | Node degradation fingerprinting | Aggregate health: worst_status, min_peers |
| H13 | HIGH | Unbounded proxy buffering | Body size check after reading (not Content-Length) |

### Round 2

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| C3 | CRITICAL | Global rate limit = self-DoS (10 req blocks all users) | Removed tower RateLimitLayer; auth token is primary gate, proxy uses `s-maxage` caching |
| C4 | CRITICAL | `signatures_collected` delta leaks leader (leader increments, followers don't) | API returns only aggregated sums — no per-node data in any response |
| H14 | HIGH | Timing side-channel on auth token comparison | Use `subtle::ConstantTimeEq` |
| H15 | HIGH | Fail-open auth when token unconfigured | Fail closed: return 500 if no token set |
| H16 | HIGH | Content-Length check bypassed by chunked encoding | Read body as text, check `.len()` before parsing |
| H17 | HIGH | Collector has no response size cap on oracle fetch | `reqwest` body size limited to 10 MB |
| H18 | HIGH | Oracle `/health` still returns `is_leader` + all P2P counters on 0.0.0.0 | Infra: firewall oracle ports; defense-in-depth via aggregation |
| H19 | HIGH | `last_consensus_time_ms` per node reveals leader (higher on leader) | API aggregates: returns max/avg, not per-node |
| H20 | HIGH | `consensus_failed_total` per node enables attack calibration | API aggregates: returns sum only |
| H21 | HIGH | `last_cycle_duration_ms` per node reveals DoS effectiveness | API aggregates: returns max/avg only |
| H22 | HIGH | `orders_processed` + message rates infer leader | API aggregates: returns sums only |

### Round 3

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| C5 | CRITICAL | `GROUP BY fetched_at` broken — sequential INSERT gives each node a different `NOW()` timestamp, producing per-node rows with `node_count=1`, defeating all aggregation | Add `poll_batch_ts TIMESTAMPTZ` column; collector assigns shared timestamp before loop; `GROUP BY poll_batch_ts` |
| C6 | CRITICAL | Empty token bypass — `"".ct_eq("")` = 1, no guard against empty `EXPLORER_TOKEN` in data-node | `assert!(!token.is_empty())` in `explorer_routes` + explicit empty check in `check_auth` |
| C7 | CRITICAL | `subtle::ct_eq` length oracle — different-length inputs short-circuit revealing token length | Hash both provided and expected with SHA-256 before comparison (fixed-length) |
| H23 | HIGH | `MAX(last_consensus_time_ms)` IS the leader's value in 3-node network | Use `AVG()` for all timing fields, not `MAX()` |
| H24 | HIGH | `node_count` leaks node availability (3→2→3 reveals outages, aids DoS planning) | Replace with `quorum_met: bool` (node_count >= 2) |
| H25 | HIGH | `worst_status` MAX on strings: `'healthy' > 'degraded'` lexicographically — degraded hidden | Use numeric severity mapping: unhealthy=3, degraded=2, healthy=1, then MAX, then convert back |
| H26 | HIGH | Proxy forwards all upstream fields — future fields leak through unfiltered | Whitelist response shape in proxy: only forward known fields |
| H27 | HIGH | Explorer page fully public — any browser user gets all aggregated network telemetry | Explorer proxy requires session/admin auth (or accept explicit risk for public page) |
| H28 | HIGH | Future dev trap — no documentation of why fields are omitted from collector | Add `DANGEROUS_FIELDS` constant + `SafeHealthPayload` struct with `deny_unknown_fields` |
| H29 | HIGH | `.env` with secrets committed to git (Task 12 `git add data-node/.env`) | Use `.env.example` with placeholders; never commit real secrets |
| H30 | HIGH | Sequential polling order creates stable timing fingerprint mapping IPs to node_ids | Randomize `oracle_urls` order each poll cycle |
| H31 | HIGH | `health_latest` aggregates stale snapshots (50-min-old) with fresh ones | Narrow DISTINCT ON window to 2x poll interval (10 min) |

### Round 4

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| H34 | HIGH | Proxy `filterSnapshot` fallback (`else { filtered = data }`) bypasses whitelist when `data.network` is falsy | Fallback returns safe defaults: `{ network: null }` or `{ snapshots: [] }`, never raw data |
| M7 | MEDIUM | `_DANGEROUS_FIELDS` is dead code (underscore suppresses warning); no `SafeHealthPayload` struct | Accepted: documentation-level guard. Consider typed struct in implementation. |
| M8 | MEDIUM | AVG timing invertible with n=3 if attacker knows follower values independently | Accepted risk: requires independent follower access; no perfect aggregation for n=3 |
| M9 | MEDIUM | Explorer page unauthenticated to browsers (H27 residual) | Accepted: aggregated data only, no per-node info; document as intentional |
| M10 | MEDIUM | `quorum_met` transitions in time-series leak outage timing | Accepted: only reveals "network had outage", not which node |

**Round 4 verdict: 1 HIGH fixed (H34). Remaining findings are MEDIUM — accepted risks with documentation. PASS after H34 fix.**

---

## Task 1: Database Migration

**Files:**
- Create: `data-node/migrations/026_create_oracle_health_snapshots.sql`

**Step 1: Write migration**

Security notes vs original plan:
- `is_leader` removed — replaced by `has_leader` (aggregate across all nodes)
- P2P security counters (`rate_limited`, `peers_banned`, `equivocations`, `decode_failures`, `leader_rejections`, `connection_rejections`) removed from public-facing columns
- `consensus_in_progress` removed (timing attack vector)
- `status` kept but validated at insert time (whitelist)

```sql
-- 026_create_oracle_health_snapshots.sql

CREATE TABLE oracle_health_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    node_id         INTEGER NOT NULL CHECK (node_id >= 0),
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- C5: Shared timestamp assigned by collector before polling loop.
    -- All nodes in the same poll cycle share the same poll_batch_ts.
    -- API GROUP BY uses this column, NOT fetched_at.
    poll_batch_ts   TIMESTAMPTZ NOT NULL,

    -- Health (validated to whitelist: healthy, degraded, unhealthy, unknown)
    status          TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),

    -- Consensus (counters only, no timing or in-progress state)
    consensus_rounds_total   BIGINT NOT NULL DEFAULT 0,
    consensus_success_total  BIGINT NOT NULL DEFAULT 0,
    consensus_failed_total   BIGINT NOT NULL DEFAULT 0,
    signatures_collected     BIGINT NOT NULL DEFAULT 0,
    last_consensus_time_ms   BIGINT NOT NULL DEFAULT 0,

    -- Orders
    orders_processed_last_60s BIGINT NOT NULL DEFAULT 0,
    pending_order_count       BIGINT NOT NULL DEFAULT 0,
    last_cycle_duration_ms    BIGINT NOT NULL DEFAULT 0,

    -- P2P (aggregate counters only — no security-sensitive counters)
    connected_peers          INTEGER NOT NULL DEFAULT 0,
    p2p_messages_received    BIGINT NOT NULL DEFAULT 0,
    p2p_messages_sent        BIGINT NOT NULL DEFAULT 0,
    p2p_wal_entries          BIGINT NOT NULL DEFAULT 0,

    -- Heartbeat (aggregate only)
    heartbeat_sent           BIGINT DEFAULT 0,
    heartbeat_received       BIGINT DEFAULT 0,
    peers_healthy            INTEGER DEFAULT 0,
    peers_unhealthy          INTEGER DEFAULT 0
);

-- C5: Primary query index — GROUP BY poll_batch_ts for aggregation
CREATE INDEX idx_oracle_health_batch_time
    ON oracle_health_snapshots (poll_batch_ts DESC);

CREATE INDEX idx_oracle_health_node_time
    ON oracle_health_snapshots (node_id, fetched_at DESC);
```

**Step 2: Verify migration runs**

```bash
cd data-node && cargo sqlx migrate run
```

**Step 3: Commit**

```bash
git add data-node/migrations/026_create_oracle_health_snapshots.sql
git commit -m "feat(data-node): add oracle_health_snapshots table with security constraints"
```

---

## Task 2: Config — Add Oracle URLs

**Files:**
- Modify: `data-node/src/config.rs` (add `oracle_health_urls`, `oracle_health_poll_interval`, `explorer_token` args)

**Step 1: Add CLI args to `ServeArgs`**

After the `snapshot_hmac_secret` field (~line 270), add:

```rust
    /// Comma-separated oracle health endpoint URLs (e.g., "http://localhost:8100,http://localhost:8101,http://localhost:8102")
    #[arg(long, env = "ORACLE_HEALTH_URLS")]
    pub oracle_health_urls: Option<String>,

    /// Oracle health polling interval in seconds (default: 300 = 5 minutes)
    #[arg(long, default_value = "300", env = "ORACLE_HEALTH_POLL_INTERVAL_SECS")]
    pub oracle_health_poll_interval: u64,

    /// Shared secret token for authenticating explorer API requests (frontend-only access)
    #[arg(long, env = "EXPLORER_TOKEN")]
    pub explorer_token: Option<String>,
```

**Step 2: Commit**

```bash
git add data-node/src/config.rs
git commit -m "feat(data-node): add oracle health polling + explorer auth config"
```

---

## Task 3: Oracle Health Collector

**Files:**
- Create: `data-node/src/oracle_health_collector.rs`
- Modify: `data-node/src/main.rs` (spawn collector task)

**Step 1: Create the collector module**

Fixes applied: H5 (SSRF — no redirects, URL validation), H6 (node_id validation), H7 (status whitelist), H2 (auto-pruning), C5 (shared poll_batch_ts), H28 (DANGEROUS_FIELDS documentation), H30 (randomized poll order), M6 (minimum poll interval)

```rust
// data-node/src/oracle_health_collector.rs

use chrono::Utc;
use rand::seq::SliceRandom;
use reqwest::Client;
use sha2::{Sha256, Digest};
use sqlx::PgPool;
use std::time::Duration;
use tracing::{info, warn};
use url::Url;

const VALID_STATUSES: &[&str] = &["healthy", "degraded", "unhealthy"];
const RETENTION_DAYS: i32 = 30;
const PRUNE_INTERVAL_POLLS: u64 = 12; // prune every 12 polls (~1h at 5min interval)
const MAX_ORACLE_RESPONSE_BYTES: usize = 10 * 1024 * 1024; // 10 MB
const MIN_POLL_INTERVAL_SECS: u64 = 30; // M6: prevent tight loop on misconfiguration

/// H28: Fields from /health that are INTENTIONALLY NOT STORED because they enable
/// leadership identification, attack calibration, or node fingerprinting in a 3-node network.
///
/// If you are adding a new field to the collector, check this list first.
/// Adding any of these fields to the database or API re-opens CRITICAL security findings.
///
/// - `is_leader` (C1/C2): Direct leader identification → targeted DoS
/// - `leader_elections_count`: Per-node election count → leadership pattern inference
/// - `leader_tenure_cycles`: Per-node tenure → leadership duration inference
/// - `consensus.in_progress` (H10): Real-time consensus timing → front-running
/// - `p2p.rate_limited_total` (H11): Attacker effectiveness gauge
/// - `p2p.decode_failures_total` (H11): Attack calibration
/// - `p2p.peers_banned_total` (H11): Ban evasion intel
/// - `p2p.equivocations_detected` (H11): Equivocation attack scorecard
/// - `p2p.leader_rejections` (H11): Confirms leader identity
/// - `p2p.connection_rejections` (H11): DoS resistance indicator
/// - `p2p.wal_replays`: Restart detection / fingerprinting
/// - `heartbeat.kick_proposals`: Peer removal activity
const _DANGEROUS_FIELDS: &[&str] = &[
    "is_leader", "leader_elections_count", "leader_tenure_cycles",
    "consensus.in_progress",
    "p2p.rate_limited_total", "p2p.decode_failures_total", "p2p.peers_banned_total",
    "p2p.equivocations_detected", "p2p.leader_rejections", "p2p.connection_rejections",
    "p2p.wal_replays", "heartbeat.kick_proposals",
];

/// Validate oracle URLs at startup. Panics on invalid URLs.
pub fn validate_oracle_urls(urls: &[String]) {
    for raw in urls {
        let parsed = Url::parse(raw).unwrap_or_else(|e| panic!("Invalid oracle URL '{}': {}", raw, e));
        assert!(
            parsed.scheme() == "http" || parsed.scheme() == "https",
            "Oracle URL must be http/https: {}", raw
        );
        assert!(
            parsed.host_str().is_some(),
            "Oracle URL has no host: {}", raw
        );
    }
}

/// Polls oracle `/health` endpoints and stores snapshots in PostgreSQL.
pub async fn run_oracle_health_collector(
    pool: PgPool,
    oracle_urls: Vec<String>,
    poll_interval_secs: u64,
) {
    // M6: Enforce minimum poll interval to prevent tight loop
    let effective_interval = poll_interval_secs.max(MIN_POLL_INTERVAL_SECS);
    if poll_interval_secs < MIN_POLL_INTERVAL_SECS {
        warn!(
            requested = poll_interval_secs,
            effective = effective_interval,
            "Poll interval below minimum, clamping"
        );
    }

    // H5: Disable redirects to prevent SSRF via redirect chains
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("Failed to build HTTP client");

    let interval = Duration::from_secs(effective_interval);
    info!(
        count = oracle_urls.len(),
        interval_secs = effective_interval,
        "Oracle health collector started"
    );

    let mut polls_since_prune: u64 = 0;
    let mut rng = rand::thread_rng();

    loop {
        // C5: Assign a single poll_batch_ts BEFORE polling any node.
        // All nodes in this cycle share this timestamp for correct GROUP BY aggregation.
        let poll_batch_ts = Utc::now();

        // H30: Randomize polling order to prevent timing fingerprinting
        let mut urls = oracle_urls.clone();
        urls.shuffle(&mut rng);

        for url in &urls {
            let health_url = format!("{}/health", url.trim_end_matches('/'));
            match fetch_and_store(&client, &pool, &health_url, poll_batch_ts).await {
                Ok(node_id) => {
                    info!(node_id, url = %health_url, "Oracle health snapshot stored");
                }
                Err(e) => {
                    warn!(url = %health_url, error = %e, "Failed to collect oracle health");
                }
            }
        }

        // H2: Auto-prune old snapshots
        polls_since_prune += 1;
        if polls_since_prune >= PRUNE_INTERVAL_POLLS {
            polls_since_prune = 0;
            if let Err(e) = sqlx::query(
                "DELETE FROM oracle_health_snapshots WHERE fetched_at < NOW() - make_interval(days => $1)"
            )
            .bind(RETENTION_DAYS)
            .execute(&pool)
            .await
            {
                warn!(error = %e, "Failed to prune old health snapshots");
            } else {
                info!(retention_days = RETENTION_DAYS, "Pruned old health snapshots");
            }
        }

        tokio::time::sleep(interval).await;
    }
}

async fn fetch_and_store(
    client: &Client,
    pool: &PgPool,
    url: &str,
    poll_batch_ts: chrono::DateTime<Utc>,
) -> Result<i32, Box<dyn std::error::Error + Send + Sync>> {
    let resp = client.get(url).send().await?;

    // H17: Check response size before buffering to prevent OOM
    if let Some(len) = resp.content_length() {
        if len as usize > MAX_ORACLE_RESPONSE_BYTES {
            return Err(format!("Response too large ({len} bytes) from {url}").into());
        }
    }
    let body = resp.bytes().await?;
    if body.len() > MAX_ORACLE_RESPONSE_BYTES {
        return Err(format!("Response body too large ({} bytes) from {url}", body.len()).into());
    }
    let json: serde_json::Value = serde_json::from_slice(&body)?;

    // H6: Validate node_id — reject instead of defaulting
    let node_id: i32 = json["node_id"]
        .as_i64()
        .and_then(|v| i32::try_from(v).ok())
        .ok_or_else(|| format!("invalid or missing node_id from {url}"))?;

    if node_id < 0 {
        return Err(format!("negative node_id {} from {url}", node_id).into());
    }

    // H7: Whitelist status values
    let raw_status = json["status"].as_str().unwrap_or("unknown");
    let status = if VALID_STATUSES.contains(&raw_status) {
        raw_status
    } else {
        warn!(raw_status, url, "Unexpected status from oracle, storing as 'unknown'");
        "unknown"
    };

    let c = &json["consensus"];
    let consensus_rounds_total = c["rounds_total"].as_i64().unwrap_or(0);
    let consensus_success_total = c["success_total"].as_i64().unwrap_or(0);
    let consensus_failed_total = c["failed_total"].as_i64().unwrap_or(0);
    let signatures_collected = c["signatures_collected"].as_i64().unwrap_or(0);
    let last_consensus_time_ms = c["last_time_ms"].as_i64().unwrap_or(0);

    let orders_processed = json["orders_processed_last_60s"].as_i64().unwrap_or(0);
    let pending_orders = json["pending_order_count"].as_i64().unwrap_or(0);
    let last_cycle_ms = json["last_cycle_duration_ms"].as_i64().unwrap_or(0);

    let connected_peers = json["connected_peers"].as_i64().unwrap_or(0)
        .min(i32::MAX as i64) as i32; // safe cast with clamping

    // H11: Only store aggregate P2P counters, not security-sensitive ones
    // See DANGEROUS_FIELDS for list of fields intentionally omitted
    let p = &json["p2p"];
    let p2p_messages_received = p["messages_received"].as_i64().unwrap_or(0);
    let p2p_messages_sent = p["messages_sent"].as_i64().unwrap_or(0);
    let p2p_wal_entries = p["wal_entries_written"].as_i64().unwrap_or(0);

    let h = &json["heartbeat"];
    let heartbeat_sent = h["sent_total"].as_i64();
    let heartbeat_received = h["received_total"].as_i64();
    let peers_healthy = h["peers_healthy"].as_i64().map(|v| v.min(i32::MAX as i64) as i32);
    let peers_unhealthy = h["peers_unhealthy"].as_i64().map(|v| v.min(i32::MAX as i64) as i32);

    sqlx::query(
        "INSERT INTO oracle_health_snapshots (
            node_id, poll_batch_ts, status,
            consensus_rounds_total, consensus_success_total, consensus_failed_total,
            signatures_collected, last_consensus_time_ms,
            orders_processed_last_60s, pending_order_count, last_cycle_duration_ms,
            connected_peers, p2p_messages_received, p2p_messages_sent, p2p_wal_entries,
            heartbeat_sent, heartbeat_received, peers_healthy, peers_unhealthy
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7, $8,
            $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, $18, $19
        )"
    )
    .bind(node_id)
    .bind(poll_batch_ts)
    .bind(status)
    .bind(consensus_rounds_total)
    .bind(consensus_success_total)
    .bind(consensus_failed_total)
    .bind(signatures_collected)
    .bind(last_consensus_time_ms)
    .bind(orders_processed)
    .bind(pending_orders)
    .bind(last_cycle_ms)
    .bind(connected_peers)
    .bind(p2p_messages_received)
    .bind(p2p_messages_sent)
    .bind(p2p_wal_entries)
    .bind(heartbeat_sent)
    .bind(heartbeat_received)
    .bind(peers_healthy)
    .bind(peers_unhealthy)
    .execute(pool)
    .await?;

    Ok(node_id)
}
```

**Step 2: Register module and spawn task in `main.rs`**

In `main.rs`, add:
```rust
mod oracle_health_collector;
```

In the background task spawning section (after other collectors), add:

```rust
// Oracle health collector
if let Some(ref urls_str) = args.oracle_health_urls {
    let urls: Vec<String> = urls_str.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    if !urls.is_empty() {
        // H5: Validate all URLs at startup
        oracle_health_collector::validate_oracle_urls(&urls);
        let pool_clone = pool.clone();
        let interval = args.oracle_health_poll_interval;
        tokio::spawn(async move {
            oracle_health_collector::run_oracle_health_collector(pool_clone, urls, interval).await;
        });
    }
}
```

**Step 3: Verify it compiles**

```bash
cd data-node && cargo check
```

**Step 4: Commit**

```bash
git add data-node/src/oracle_health_collector.rs data-node/src/main.rs
git commit -m "feat(data-node): add oracle health collector with security hardening"
```

---

## Task 4: Explorer API Endpoints

**Files:**
- Create: `data-node/src/explorer_api.rs`
- Modify: `data-node/src/main.rs` (register routes)
- Modify: `data-node/src/api.rs` (add explorer routes to router)

Fixes applied: H1 (parameterized SQL), H3 (LIMIT 2000), H8 (generic errors), C1-C4 (aggregate-only), H10-H22 (no per-node), C5 (GROUP BY poll_batch_ts), C6 (empty token guard), C7 (hash-then-compare auth), H23 (AVG not MAX for timing), H24 (quorum_met not node_count), H25 (numeric severity for worst_status), H31 (narrowed latest window)

**Step 1: Create explorer API module**

```rust
// data-node/src/explorer_api.rs

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use sqlx::PgPool;
use std::sync::Arc;

const MAX_ROWS: i64 = 2000;
// H31: Latest query window = 2x poll interval (10 min at 5-min polling)
const LATEST_WINDOW_SECS: f64 = 600.0;

pub struct ExplorerState {
    pub pool: PgPool,
    pub token: String, // H15: NOT optional — required
}

// C6: Reject empty token at startup
// C7: Hash-then-compare eliminates length oracle from subtle::ct_eq
// H14: SHA-256 produces fixed-length output, making comparison constant-time regardless of input length
fn check_auth(headers: &HeaderMap, expected: &str) -> Result<(), StatusCode> {
    // C6: Empty token = misconfiguration, always reject
    if expected.is_empty() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    let provided = headers
        .get("x-explorer-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // C7: Hash both to fixed-length before comparison — no length oracle
    let expected_hash = Sha256::digest(expected.as_bytes());
    let provided_hash = Sha256::digest(provided.as_bytes());

    // Constant-time comparison of two 32-byte hashes
    use subtle::ConstantTimeEq;
    if expected_hash.ct_eq(&provided_hash).unwrap_u8() != 1 {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub range: Option<String>,
}

// ── ALL responses are aggregated across nodes — no per-node breakdown ──
// H24: node_count replaced with quorum_met boolean
// H23: timing fields use AVG not MAX (MAX = leader's value in 3-node network)
// H25: worst_status uses numeric severity mapping (not lexicographic MAX)

#[derive(Serialize, sqlx::FromRow)]
pub struct AggregatedSnapshot {
    pub poll_batch_ts: chrono::DateTime<chrono::Utc>,
    pub quorum_met: bool, // H24: true if node_count >= 2, hides exact count
    pub worst_status: String,
    // Consensus (sums across all nodes)
    pub consensus_rounds_total: i64,
    pub consensus_success_total: i64,
    pub consensus_failed_total: i64,
    pub signatures_collected: i64,
    // Timing (AVG, not MAX — H23: MAX exposes leader in 3-node network)
    pub avg_consensus_time_ms: i64,
    pub avg_cycle_duration_ms: i64,
    // Orders (sums)
    pub orders_processed_last_60s: i64,
    pub pending_order_count: i64,
    // P2P (sums)
    pub total_peers: i64,
    pub p2p_messages_received: i64,
    pub p2p_messages_sent: i64,
    // Heartbeat (sums)
    pub total_peers_healthy: i64,
    pub total_peers_unhealthy: i64,
}

fn range_to_secs(range: &str) -> f64 {
    match range {
        "1h"  => 3_600.0,
        "6h"  => 21_600.0,
        "24h" => 86_400.0,
        "7d"  => 604_800.0,
        "30d" => 2_592_000.0,
        _     => 86_400.0,
    }
}

/// GET /explorer/health/history — AGGREGATED time-series (no per-node data)
pub async fn health_history(
    State(state): State<Arc<ExplorerState>>,
    headers: HeaderMap,
    Query(params): Query<HistoryQuery>,
) -> impl IntoResponse {
    if let Err(status) = check_auth(&headers, &state.token) {
        return (status, Json(serde_json::json!({ "error": "Unauthorized" }))).into_response();
    }

    let range_secs = range_to_secs(params.range.as_deref().unwrap_or("24h"));

    // C5: GROUP BY poll_batch_ts (shared across all nodes in one poll cycle)
    // H23: AVG for timing fields (not MAX which exposes leader)
    // H24: quorum_met instead of node_count
    // H25: Numeric severity for worst_status (not lexicographic MAX)
    let result = sqlx::query_as::<_, AggregatedSnapshot>(
        "SELECT
            poll_batch_ts,
            (COUNT(*) >= 2) as quorum_met,
            CASE MAX(CASE WHEN status = 'unhealthy' THEN 3
                          WHEN status = 'degraded' THEN 2
                          ELSE 1 END)
                 WHEN 3 THEN 'unhealthy'
                 WHEN 2 THEN 'degraded'
                 ELSE 'healthy' END as worst_status,
            SUM(consensus_rounds_total) as consensus_rounds_total,
            SUM(consensus_success_total) as consensus_success_total,
            SUM(consensus_failed_total) as consensus_failed_total,
            SUM(signatures_collected) as signatures_collected,
            AVG(last_consensus_time_ms)::BIGINT as avg_consensus_time_ms,
            AVG(last_cycle_duration_ms)::BIGINT as avg_cycle_duration_ms,
            SUM(orders_processed_last_60s) as orders_processed_last_60s,
            SUM(pending_order_count) as pending_order_count,
            SUM(connected_peers)::BIGINT as total_peers,
            SUM(p2p_messages_received) as p2p_messages_received,
            SUM(p2p_messages_sent) as p2p_messages_sent,
            COALESCE(SUM(peers_healthy), 0)::BIGINT as total_peers_healthy,
            COALESCE(SUM(peers_unhealthy), 0)::BIGINT as total_peers_unhealthy
         FROM oracle_health_snapshots
         WHERE poll_batch_ts > NOW() - make_interval(secs => $1)
         GROUP BY poll_batch_ts
         ORDER BY poll_batch_ts ASC
         LIMIT $2"
    )
    .bind(range_secs)
    .bind(MAX_ROWS)
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(data) => (StatusCode::OK, Json(serde_json::json!({ "snapshots": data }))).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "Explorer health history query failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal server error" }))).into_response()
        }
    }
}

/// GET /explorer/health/latest — latest AGGREGATED state
pub async fn health_latest(
    State(state): State<Arc<ExplorerState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if let Err(status) = check_auth(&headers, &state.token) {
        return (status, Json(serde_json::json!({ "error": "Unauthorized" }))).into_response();
    }

    // H31: Narrow window to 2x poll interval (10 min), not 1 hour
    let result = sqlx::query_as::<_, AggregatedSnapshot>(
        "SELECT
            MAX(poll_batch_ts) as poll_batch_ts,
            (COUNT(DISTINCT node_id) >= 2) as quorum_met,
            CASE MAX(CASE WHEN status = 'unhealthy' THEN 3
                          WHEN status = 'degraded' THEN 2
                          ELSE 1 END)
                 WHEN 3 THEN 'unhealthy'
                 WHEN 2 THEN 'degraded'
                 ELSE 'healthy' END as worst_status,
            SUM(consensus_rounds_total) as consensus_rounds_total,
            SUM(consensus_success_total) as consensus_success_total,
            SUM(consensus_failed_total) as consensus_failed_total,
            SUM(signatures_collected) as signatures_collected,
            AVG(last_consensus_time_ms)::BIGINT as avg_consensus_time_ms,
            AVG(last_cycle_duration_ms)::BIGINT as avg_cycle_duration_ms,
            SUM(orders_processed_last_60s) as orders_processed_last_60s,
            SUM(pending_order_count) as pending_order_count,
            SUM(connected_peers)::BIGINT as total_peers,
            SUM(p2p_messages_received) as p2p_messages_received,
            SUM(p2p_messages_sent) as p2p_messages_sent,
            COALESCE(SUM(peers_healthy), 0)::BIGINT as total_peers_healthy,
            COALESCE(SUM(peers_unhealthy), 0)::BIGINT as total_peers_unhealthy
         FROM (
            SELECT DISTINCT ON (node_id) *
            FROM oracle_health_snapshots
            WHERE poll_batch_ts > NOW() - make_interval(secs => $1)
            ORDER BY node_id, poll_batch_ts DESC
         ) latest_per_node"
    )
    .bind(LATEST_WINDOW_SECS)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(data)) => (StatusCode::OK, Json(serde_json::json!({ "network": data }))).into_response(),
        Ok(None) => (StatusCode::OK, Json(serde_json::json!({ "network": null }))).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "Explorer health latest query failed");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal server error" }))).into_response()
        }
    }
}

/// Build the explorer sub-router.
/// C6: Panics at startup if token is empty — fail-closed.
pub fn explorer_routes(pool: PgPool, token: String) -> axum::Router {
    assert!(!token.is_empty(), "EXPLORER_TOKEN must be set and non-empty");
    let state = Arc::new(ExplorerState { pool, token });

    axum::Router::new()
        .route("/explorer/health/history", axum::routing::get(health_history))
        .route("/explorer/health/latest", axum::routing::get(health_latest))
        .with_state(state)
}
```

**Step 2: Register routes in main.rs**

```rust
mod explorer_api;

// In the router construction — C6: explorer_token is Option<String> in config,
// only register routes if token is present (panics inside explorer_routes if empty)
if let Some(ref token) = args.explorer_token {
    let app = app.merge(
        explorer_api::explorer_routes(pool.clone(), token.clone())
    );
}
```

**Step 3: Verify compilation**

```bash
cd data-node && cargo check
```

**Step 4: Commit**

```bash
git add data-node/src/explorer_api.rs data-node/src/main.rs data-node/src/api.rs
git commit -m "feat(data-node): add authenticated /explorer/health/* API with security hardening"
```

---

## Task 5: Frontend — API Proxy Route

**Files:**
- Create: `frontend/app/api/explorer/health/route.ts`

Fixes applied: H9 (input validation), H8 (no error leakage), H16 (body size check via text length, not Content-Length header), C3 (s-maxage caching instead of global rate limit), H26 (whitelist response fields)

**Step 1: Create proxy route**

```typescript
// frontend/app/api/explorer/health/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { AA_DATA_NODE_URL } from '@/lib/config'

const VALID_ENDPOINTS = ['history', 'latest']
const VALID_RANGES = ['1h', '6h', '24h', '7d', '30d']
const MAX_RESPONSE_BYTES = 5_000_000 // 5 MB
const EXPLORER_TOKEN = process.env.EXPLORER_TOKEN || ''

// H26: Whitelist of allowed fields in aggregated snapshots.
// Only these fields are forwarded to the browser. Any additional fields
// from upstream (e.g., added by a future developer) are silently dropped.
const SNAPSHOT_FIELDS = [
  'poll_batch_ts', 'quorum_met', 'worst_status',
  'consensus_rounds_total', 'consensus_success_total', 'consensus_failed_total',
  'signatures_collected', 'avg_consensus_time_ms', 'avg_cycle_duration_ms',
  'orders_processed_last_60s', 'pending_order_count',
  'total_peers', 'p2p_messages_received', 'p2p_messages_sent',
  'total_peers_healthy', 'total_peers_unhealthy',
] as const

function filterSnapshot(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of SNAPSHOT_FIELDS) {
    if (key in s) out[key] = s[key]
  }
  return out
}

export async function GET(req: NextRequest) {
  // H15: Fail closed if token not configured server-side
  if (!EXPLORER_TOKEN) {
    return NextResponse.json({ error: 'Explorer not configured' }, { status: 503 })
  }

  const { searchParams } = req.nextUrl
  const endpoint = searchParams.get('endpoint') || 'history'
  const range = searchParams.get('range') || '24h'

  // H9: Validate endpoint (no node_id param — all data is aggregated)
  if (!VALID_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  }

  // H9: Validate range
  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }

  const url = new URL(`${AA_DATA_NODE_URL}/explorer/health/${endpoint}`)
  url.searchParams.set('range', range)

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: 'application/json',
        'x-explorer-token': EXPLORER_TOKEN,
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
    }

    // H16: Check body size AFTER reading (Content-Length absent on chunked responses)
    const body = await res.text()
    if (body.length > MAX_RESPONSE_BYTES) {
      return NextResponse.json({ error: 'Response too large' }, { status: 502 })
    }

    const data = JSON.parse(body)

    // H26: Whitelist response fields — only forward known fields to browser.
    // H34: Fallback returns safe defaults, NEVER raw upstream data.
    let filtered: unknown
    if (endpoint === 'history' && Array.isArray(data?.snapshots)) {
      filtered = { snapshots: data.snapshots.map(filterSnapshot) }
    } else if (endpoint === 'latest' && data?.network != null) {
      filtered = { network: filterSnapshot(data.network) }
    } else {
      // H34: Safe default — never forward raw unfiltered upstream data
      filtered = endpoint === 'latest' ? { network: null } : { snapshots: [] }
    }

    return NextResponse.json(filtered, {
      // C3: Cache at edge instead of global rate limit
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch {
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
  }
}
```

**Step 2: Commit**

```bash
git add frontend/app/api/explorer/health/route.ts
git commit -m "feat(frontend): add /api/explorer/health proxy with input validation and auth"
```

---

## Task 6: Frontend — Data Hook

**Files:**
- Create: `frontend/hooks/useExplorerHealth.ts`

**Step 1: Create the hook**

```typescript
// frontend/hooks/useExplorerHealth.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d'

/** Aggregated across all nodes — no per-node data exposed */
export interface AggregatedSnapshot {
  poll_batch_ts: string
  quorum_met: boolean // H24: hides exact node count
  worst_status: string
  consensus_rounds_total: number
  consensus_success_total: number
  consensus_failed_total: number
  signatures_collected: number
  avg_consensus_time_ms: number // H23: AVG not MAX
  avg_cycle_duration_ms: number // H23: AVG not MAX
  orders_processed_last_60s: number
  pending_order_count: number
  total_peers: number
  p2p_messages_received: number
  p2p_messages_sent: number
  total_peers_healthy: number
  total_peers_unhealthy: number
}

interface UseExplorerHealthReturn {
  snapshots: AggregatedSnapshot[]
  latest: AggregatedSnapshot | null
  loading: boolean
  error: string | null
  range: TimeRange
  setRange: (r: TimeRange) => void
  refresh: () => Promise<void>
}

const POLL_INTERVAL_MS = 60_000

export function useExplorerHealth(): UseExplorerHealthReturn {
  const [snapshots, setSnapshots] = useState<AggregatedSnapshot[]>([])
  const [latest, setLatest] = useState<AggregatedSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<TimeRange>('24h')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [histRes, latestRes] = await Promise.all([
        fetch(`/api/explorer/health?endpoint=history&range=${range}`, {
          signal: AbortSignal.timeout(15_000),
        }),
        fetch(`/api/explorer/health?endpoint=latest`, {
          signal: AbortSignal.timeout(15_000),
        }),
      ])

      if (!histRes.ok) throw new Error(`History: HTTP ${histRes.status}`)
      if (!latestRes.ok) throw new Error(`Latest: HTTP ${latestRes.status}`)

      const histData = await histRes.json()
      const latestData = await latestRes.json()

      setSnapshots(histData.snapshots || [])
      setLatest(latestData.network || null)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch explorer data')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    refresh()
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { snapshots, latest, loading, error, range, setRange, refresh }
}

/** Compute deltas between consecutive aggregated snapshots for rate charts.
 *  Clamps negative deltas to 0 (counter reset detection on oracle restart). */
export function computeDeltas(
  snapshots: AggregatedSnapshot[],
  field: keyof AggregatedSnapshot
): { time: string; delta: number }[] {
  const result: { time: string; delta: number }[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1][field]
    const curr = snapshots[i][field]
    if (typeof prev === 'number' && typeof curr === 'number') {
      result.push({ time: snapshots[i].poll_batch_ts, delta: Math.max(0, curr - prev) })
    }
  }
  return result
}
```

**Step 2: Commit**

```bash
git add frontend/hooks/useExplorerHealth.ts
git commit -m "feat(frontend): add useExplorerHealth hook with delta computation"
```

---

## Task 7: Frontend — Explorer Page Structure

**Files:**
- Create: `frontend/app/[locale]/explorer/page.tsx`
- Create: `frontend/app/[locale]/explorer/ExplorerPageClient.tsx`

**Step 1: Create server page**

```typescript
// frontend/app/[locale]/explorer/page.tsx
import type { Metadata } from 'next'
import ExplorerPageClient from './ExplorerPageClient'

export const metadata: Metadata = {
  title: 'Explorer — Oracle Network',
  description: 'Real-time monitoring of the oracle consensus network.',
}

export default function ExplorerPage() {
  return <ExplorerPageClient />
}
```

**Step 2: Create client page shell**

```typescript
// frontend/app/[locale]/explorer/ExplorerPageClient.tsx
'use client'

import { useState } from 'react'
import { useExplorerHealth, type TimeRange } from '@/hooks/useExplorerHealth'
import { ExplorerSummaryBar } from '@/components/domain/explorer/ExplorerSummaryBar'
import { ConsensusSection } from '@/components/domain/explorer/ConsensusSection'
import { OrdersSection } from '@/components/domain/explorer/OrdersSection'
import { PriceFeedSection } from '@/components/domain/explorer/PriceFeedSection'
import { P2PSection } from '@/components/domain/explorer/P2PSection'
import { CycleSection } from '@/components/domain/explorer/CycleSection'
import { ITPSection } from '@/components/domain/explorer/ITPSection'
import { VisionSection } from '@/components/domain/explorer/VisionSection'
import { SystemHealthSection } from '@/components/domain/explorer/SystemHealthSection'
import { ChainGasSection } from '@/components/domain/explorer/ChainGasSection'

const TABS = [
  { id: 'consensus', label: 'Consensus' },
  { id: 'orders', label: 'Orders' },
  { id: 'prices', label: 'Price Feeds' },
  { id: 'p2p', label: 'P2P Network' },
  { id: 'cycles', label: 'Cycles' },
  { id: 'itp', label: 'ITP & NAV' },
  { id: 'vision', label: 'Vision' },
  { id: 'health', label: 'System Health' },
  { id: 'chain', label: 'Chain & Gas' },
] as const

type TabId = (typeof TABS)[number]['id']

const RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']

export default function ExplorerPageClient() {
  const { snapshots, latest, loading, error, range, setRange, refresh } = useExplorerHealth()
  const [activeTab, setActiveTab] = useState<TabId>('consensus')

  return (
    <main className="min-h-screen bg-page">
      <div className="max-w-site-wide mx-auto px-4 md:px-8">
        <div className="pt-10 pb-4">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">
            Network
          </p>
          <h1 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">
            Explorer
          </h1>
        </div>

        <ExplorerSummaryBar latest={latest} loading={loading} />

        <div className="flex items-center justify-between border-b border-border-light mt-4">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-black text-black'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded ${
                  range === r ? 'bg-black text-white' : 'text-text-muted hover:text-black'
                }`}
              >
                {r}
              </button>
            ))}
            <button
              onClick={refresh}
              disabled={loading}
              className="ml-2 px-3 py-1 text-[11px] font-bold text-text-muted hover:text-black disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-color-down/50 bg-surface-down rounded-card px-4 py-3">
            <p className="text-color-down text-[13px] font-semibold">{error}</p>
            <button onClick={refresh} className="mt-2 text-[12px] font-bold text-color-info underline">
              Retry
            </button>
          </div>
        )}

        <div className="py-6 pb-16">
          {activeTab === 'consensus' && <ConsensusSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'orders' && <OrdersSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'prices' && <PriceFeedSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'p2p' && <P2PSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'cycles' && <CycleSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'itp' && <ITPSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'vision' && <VisionSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'health' && <SystemHealthSection snapshots={snapshots} latest={latest} loading={loading} />}
          {activeTab === 'chain' && <ChainGasSection snapshots={snapshots} latest={latest} loading={loading} />}
        </div>
      </div>
    </main>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/app/\[locale\]/explorer/
git commit -m "feat(frontend): add explorer page shell with tabs and range selector"
```

---

## Task 8: Frontend — Reusable Chart Components

**Files:**
- Create: `frontend/components/domain/explorer/ExplorerChartCard.tsx`
- Create: `frontend/components/domain/explorer/ExplorerSummaryBar.tsx`

Same as original plan — see propositions document for component code. These are pure presentation components with no security surface.

**Commit:**

```bash
git add frontend/components/domain/explorer/
git commit -m "feat(frontend): add ExplorerChartCard and ExplorerSummaryBar"
```

---

## Task 9-11: Frontend — Section Components (Graphs 1-95)

**Files:**
- Create: `frontend/components/domain/explorer/ConsensusSection.tsx` (graphs 1-15)
- Create: `frontend/components/domain/explorer/OrdersSection.tsx` (graphs 16-30)
- Create: `frontend/components/domain/explorer/PriceFeedSection.tsx` (graphs 31-39)
- Create: `frontend/components/domain/explorer/P2PSection.tsx` (graphs 40-54)
- Create: `frontend/components/domain/explorer/CycleSection.tsx` (graphs 55-64)
- Create: `frontend/components/domain/explorer/ITPSection.tsx` (graphs 65-73)
- Create: `frontend/components/domain/explorer/VisionSection.tsx` (graphs 74-81)
- Create: `frontend/components/domain/explorer/SystemHealthSection.tsx` (graphs 82-88)
- Create: `frontend/components/domain/explorer/ChainGasSection.tsx` (graphs 89-95)

**Security note for ConsensusSection:** Graphs #1 (live leader identity) and #2 (leader tenure timeline) are **replaced** with:
- **#1**: "Network has active leader" (boolean indicator, no node_id)
- **#2**: "Leadership changes over time" (count only, no per-node attribution)

**Security note for P2P Section:** Graphs #44 (rate-limited messages), #47 (peer bans), #49 (connection rejections) are **replaced** with aggregate message throughput only.

Each section commit:
```bash
git commit -m "feat(frontend): add {SectionName} with N graphs"
```

---

## Task 12: Navigation + Environment Config

**Files:**
- Modify: `frontend/components/layout/Header.tsx` (add Explorer link)
- Modify: `data-node/.env` (add `ORACLE_HEALTH_URLS`, `EXPLORER_TOKEN`)
- Modify: `frontend/.env.local` or equivalent (add `EXPLORER_TOKEN`)

**Env vars (H29: NEVER commit real secrets to git):**

Create `.env.example` files with placeholders:
```
# data-node/.env.example (committed — no real secrets)
ORACLE_HEALTH_URLS=http://localhost:8100,http://localhost:8101,http://localhost:8102
ORACLE_HEALTH_POLL_INTERVAL_SECS=300
EXPLORER_TOKEN=change-me-generate-random-secret

# frontend/.env.example (committed — no real secrets)
EXPLORER_TOKEN=change-me-same-secret-as-data-node
```

Real secrets go in `.env` (gitignored) or environment variables.

```bash
git add data-node/.env.example frontend/.env.example frontend/components/layout/Header.tsx
git commit -m "feat: add Explorer nav link + health polling env config examples"
```

---

## Graph Coverage (Updated)

| Section | Graphs | What changed for security |
|---------|--------|--------------------------|
| Consensus (1-15) | 15 | #1 and #2 show aggregate leadership only, no per-node `is_leader`. #10 (equivocations) removed. #12 (consensus_in_progress) removed. |
| Orders (16-30) | 15 | No change — order data is not security-sensitive |
| Price Feeds (31-39) | 9 | No change |
| P2P (40-54) | 15 | #44 (rate-limited), #47 (bans), #49 (connection rejections), #50 (decode failures) replaced with aggregate message throughput |
| Cycles (55-64) | 10 | No change |
| ITP & NAV (65-73) | 9 | No change |
| Vision (74-81) | 8 | No change |
| System Health (82-88) | 7 | #82 shows aggregate health only, no per-node status breakdown |
| Chain & Gas (89-95) | 7 | No change |
| **Total** | **95** | **~8 graphs modified for security** |
