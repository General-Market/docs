# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public address profile page at `/profile/[address]` with Vision batch history (GitHub-style tick squares) and Index holdings tabs.

**Architecture:** Oracle persists per-player tick deltas (new table + INSERT), serves a new profile endpoint computing display-ready stats. Data-node proxies + caches it (same pattern as leaderboard). Frontend renders. Oracle and data-node have **separate Postgres databases** — data-node cannot query oracle tables directly.

**Tech Stack:** Rust/Axum/sqlx (oracle + data-node), Next.js 14 App Router, TanStack Query, recharts, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-14-profile-page-design.md`

**Established pattern to follow:** Data-node's `/vision/leaderboard` proxies oracle's `/vision/leaderboard` with 30s TTL cache (`LeaderboardCache`). Profile endpoint follows the same model.

---

## Chunk 1: Oracle — Table + INSERT + Endpoint

### Task 1: Create Tick Deltas Table

**Files:**
- Create: `oracle/migrations/006_create_player_tick_deltas.sql`

- [ ] **Step 1: Create migration**

```sql
-- oracle/migrations/006_create_player_tick_deltas.sql
CREATE TABLE IF NOT EXISTS vision_player_tick_deltas (
  batch_id         INTEGER NOT NULL,
  tick_id          INTEGER NOT NULL,
  player           TEXT NOT NULL,
  delta            TEXT NOT NULL,
  won              BOOLEAN NOT NULL,
  total_deposited  TEXT,
  resolved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, tick_id, player)
);
CREATE INDEX IF NOT EXISTS idx_vptd_player ON vision_player_tick_deltas(LOWER(player));
CREATE INDEX IF NOT EXISTS idx_vptd_player_batch ON vision_player_tick_deltas(LOWER(player), batch_id, tick_id DESC);

-- Also add functional index on vision_positions for profile queries
CREATE INDEX IF NOT EXISTS idx_vp_lower_player ON vision_positions(LOWER(player));
```

Notes:
- `total_deposited` snapshots the player's deposit at each tick. When `vision_positions` is DELETEd on withdrawal, this column preserves the deposit data for exited-batch ROI computation.
- `LOWER(player)` indexes because addresses are stored checksummed (`format!("{:?}", addr)`) but queries use lowercase.
- `idx_vp_lower_player` prevents full table scan on the active-positions query.

- [ ] **Step 2: Commit**

```bash
git add oracle/migrations/006_create_player_tick_deltas.sql
git commit -m "feat(oracle): add vision_player_tick_deltas table for profile page"
```

---

### Task 2: Persist Tick Deltas During Resolution

**Files:**
- Modify: `oracle/src/vision/engine.rs` (~line 657, `apply_balances` function)

- [ ] **Step 1: Add INSERT after balance application**

In `engine.rs`, find `apply_balances()`. After the call to `scheduler.apply_tick_balances_with_db()`, add:

```rust
// Persist per-player tick deltas for profile page (best-effort, never blocks resolution)
if let Some(pool) = db_pool {
    // Bulk-fetch total_deposited for all players in ONE query (not N+1)
    let player_strs: Vec<String> = player_balances.iter()
        .map(|pb| format!("{:?}", pb.player))
        .collect();
    let deposit_map: std::collections::HashMap<String, String> = sqlx::query_as::<_, (String, String)>(
        "SELECT player, total_deposited FROM vision_positions WHERE batch_id = $1 AND player = ANY($2)"
    )
    .bind(batch_id as i64)
    .bind(&player_strs)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .collect();

    // Bulk-INSERT all deltas (single multi-row INSERT, not N separate INSERTs)
    // For simplicity, use individual INSERTs with UPSERT — acceptable at <100 players per tick.
    // For 1000+ players, refactor to a single multi-row VALUES clause.
    for (pb, player_str) in player_balances.iter().zip(player_strs.iter()) {
        let deposited = deposit_map.get(player_str).map(|s| s.as_str());

        if let Err(e) = sqlx::query(
            "INSERT INTO vision_player_tick_deltas (batch_id, tick_id, player, delta, won, total_deposited, resolved_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (batch_id, tick_id, player) DO UPDATE
             SET delta = EXCLUDED.delta, won = EXCLUDED.won, total_deposited = EXCLUDED.total_deposited, resolved_at = NOW()"
        )
        .bind(batch_id as i64)
        .bind(tick_id as i64)
        .bind(player_str)
        .bind(pb.delta.to_string())
        .bind(pb.delta >= 0)     // >= 0: zero delta = break-even, not a loss
        .bind(deposited)
        .execute(pool)
        .await {
            tracing::warn!(batch_id, tick_id, player = %player_str, error = %e, "Failed to persist tick delta");
        }
    }
}
```

Notes:
- **Bulk-fetch** `total_deposited` in one `ANY($2)` query — not N+1.
- **`ON CONFLICT DO UPDATE`** — if oracle re-resolves a tick (retry with different prices), the corrected delta overwrites the stale one.
- **`won = pb.delta >= 0`** — zero delta is break-even (Flat/Cancelled outcomes), not a loss. Prevents inflated loss count.
- Uses `pb.delta` directly — already computed `i128` in the `PlayerBalance` struct.
- Logs failures but never blocks tick resolution.

- [ ] **Step 2: Build and verify**

```bash
cd oracle && cargo build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add oracle/src/vision/engine.rs
git commit -m "feat(oracle): persist per-player tick deltas after resolution"
```

---

### Task 3: Profile Endpoint on Oracle

**Files:**
- Modify: `oracle/src/vision/api.rs` (add handler + types + route)

- [ ] **Step 1: Add response types**

All values display-ready (dollars, percentages). Data-node and frontend do zero arithmetic.

```rust
#[derive(Debug, Serialize)]
pub struct PlayerProfileResponse {
    pub stats: ProfileStats,
    pub batches: Vec<ProfileBatch>,
    #[serde(rename = "pnlHistory")]
    pub pnl_history: Vec<PnlPoint>,
}

#[derive(Debug, Serialize)]
pub struct ProfileStats {
    pub pnl: f64,
    #[serde(rename = "totalDeposited")]
    pub total_deposited: f64,
    pub roi: f64,
    #[serde(rename = "winRate")]
    pub win_rate: f64,
    #[serde(rename = "totalBatches")]
    pub total_batches: u64,
    #[serde(rename = "lastActiveAt")]
    pub last_active_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProfileBatch {
    #[serde(rename = "batchId")]
    pub batch_id: i64,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    pub status: String,
    pub deposited: f64,
    pub balance: f64,
    #[serde(rename = "tickCount")]
    pub tick_count: i64,
    pub roi: f64,
    pub ticks: Vec<ProfileTick>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProfileTick {
    #[serde(rename = "tickId")]
    pub tick_id: i64,
    pub pnl: f64,
    pub won: bool,
}

#[derive(Debug, Serialize)]
pub struct PnlPoint {
    pub timestamp: String,
    pub pnl: f64,
}
```

- [ ] **Step 2: Implement handler**

```rust
fn wei_to_dollars(wei: i128) -> f64 {
    wei as f64 / 1e18
}

async fn player_profile(
    State(state): State<Arc<VisionState>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    // Validate address
    if address.len() != 42 || !address.starts_with("0x")
        || !address[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return (StatusCode::BAD_REQUEST, "Invalid address").into_response();
    }
    let addr = address.to_lowercase();

    // Q0: Aggregate stats per batch (accurate totals, no LIMIT)
    #[derive(sqlx::FromRow)]
    struct BatchAgg {
        batch_id: i64,
        total_delta: Option<String>,
        last_deposited: Option<String>,
        tick_count: i64,
    }
    let batch_aggs: Vec<BatchAgg> = sqlx::query_as(
        "SELECT batch_id,
                SUM(delta::numeric)::text as total_delta,
                MAX(total_deposited) as last_deposited,
                COUNT(*) as tick_count
         FROM vision_player_tick_deltas
         WHERE LOWER(player) = $1
         GROUP BY batch_id"
    )
    .bind(&addr)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Q1: Most recent 60 ticks per batch (for tick squares display)
    #[derive(sqlx::FromRow)]
    struct TickRow { batch_id: i64, tick_id: i64, delta: String, won: bool, rn: i64 }
    let tick_rows: Vec<TickRow> = sqlx::query_as(
        "WITH ranked AS (
           SELECT batch_id, tick_id, delta, won,
                  ROW_NUMBER() OVER (PARTITION BY batch_id ORDER BY tick_id DESC) as rn
           FROM vision_player_tick_deltas WHERE LOWER(player) = $1
         )
         SELECT batch_id, tick_id, delta, won, rn FROM ranked WHERE rn <= 60"
    )
    .bind(&addr)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Q2: Active positions (balance, deposited)
    #[derive(sqlx::FromRow)]
    struct PosRow { batch_id: i64, balance: String, total_deposited: String }
    let positions: Vec<PosRow> = sqlx::query_as(
        "SELECT batch_id, balance, total_deposited FROM vision_positions WHERE LOWER(player) = $1"
    )
    .bind(&addr)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Q3: P&L history for chart (most recent 5000 deltas)
    #[derive(sqlx::FromRow)]
    struct PnlRow { delta: String, resolved_at: chrono::DateTime<chrono::Utc> }
    let pnl_rows: Vec<PnlRow> = sqlx::query_as(
        "SELECT delta, resolved_at FROM vision_player_tick_deltas
         WHERE LOWER(player) = $1 ORDER BY resolved_at DESC LIMIT 5000"
    )
    .bind(&addr)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Q4: Batch metadata (source_id)
    let batch_ids: Vec<i64> = batch_aggs.iter().map(|b| b.batch_id)
        .chain(positions.iter().map(|p| p.batch_id))
        .collect::<std::collections::HashSet<_>>().into_iter().collect();
    let batch_source: std::collections::HashMap<i64, String> = if !batch_ids.is_empty() {
        sqlx::query_as::<_, (i64, String)>(
            "SELECT id, COALESCE(source_id, '') FROM vision_batches WHERE id = ANY($1)"
        )
        .bind(&batch_ids)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .collect()
    } else { std::collections::HashMap::new() };

    // -- Compute everything in i128, convert to f64 at the end --
    let active_set: std::collections::HashSet<i64> = positions.iter().map(|p| p.batch_id).collect();

    // Group ticks by batch
    let mut batch_ticks: std::collections::HashMap<i64, Vec<ProfileTick>> = std::collections::HashMap::new();
    for tr in &tick_rows {
        let delta_wei: i128 = tr.delta.parse().unwrap_or(0);
        batch_ticks.entry(tr.batch_id).or_default().push(ProfileTick {
            tick_id: tr.tick_id, pnl: wei_to_dollars(delta_wei), won: tr.won,
        });
    }
    for ticks in batch_ticks.values_mut() { ticks.reverse(); } // oldest-first

    // Build batch list + aggregate stats
    let mut total_deposited_wei: i128 = 0;
    let mut total_pnl_wei: i128 = 0;
    let mut total_batches: u64 = 0;
    let mut winning_batches: u64 = 0;
    let mut batches: Vec<ProfileBatch> = Vec::new();

    // Active batches (from vision_positions)
    for pos in &positions {
        let dep: i128 = pos.total_deposited.parse().unwrap_or(0);
        let bal: i128 = pos.balance.parse().unwrap_or(0);
        total_deposited_wei += dep;
        total_pnl_wei += bal - dep;
        total_batches += 1;
        if bal > dep { winning_batches += 1; }

        let agg = batch_aggs.iter().find(|a| a.batch_id == pos.batch_id);
        let tc = agg.map(|a| a.tick_count).unwrap_or(0);
        let roi = if dep > 0 { (bal - dep) as f64 / dep as f64 * 100.0 } else { 0.0 };

        batches.push(ProfileBatch {
            batch_id: pos.batch_id,
            source_id: batch_source.get(&pos.batch_id).cloned().unwrap_or_default(),
            status: "active".to_string(),
            deposited: wei_to_dollars(dep),
            balance: wei_to_dollars(bal),
            tick_count: tc,
            roi: (roi * 10.0).round() / 10.0,
            ticks: batch_ticks.remove(&pos.batch_id).unwrap_or_default(),
        });
    }

    // Exited batches (have deltas but no active position)
    for agg in &batch_aggs {
        if active_set.contains(&agg.batch_id) { continue; }
        let pnl: i128 = agg.total_delta.as_deref().and_then(|s| s.parse().ok()).unwrap_or(0);
        let dep: i128 = agg.last_deposited.as_deref().and_then(|s| s.parse().ok()).unwrap_or(0);
        total_deposited_wei += dep;
        total_pnl_wei += pnl;
        total_batches += 1;
        if pnl > 0 { winning_batches += 1; }

        let roi = if dep > 0 { pnl as f64 / dep as f64 * 100.0 } else { 0.0 };

        batches.push(ProfileBatch {
            batch_id: agg.batch_id,
            source_id: batch_source.get(&agg.batch_id).cloned().unwrap_or_default(),
            status: "exited".to_string(),
            deposited: wei_to_dollars(dep),
            balance: wei_to_dollars(dep + pnl),
            tick_count: agg.tick_count,
            roi: (roi * 10.0).round() / 10.0,
            ticks: batch_ticks.remove(&agg.batch_id).unwrap_or_default(),
        });
    }

    batches.sort_by(|a, b| {
        let sa = if a.status == "active" { 0 } else { 1 };
        let sb = if b.status == "active" { 0 } else { 1 };
        sa.cmp(&sb).then(b.tick_count.cmp(&a.tick_count))
    });

    // Stats
    let roi = if total_deposited_wei > 0 { total_pnl_wei as f64 / total_deposited_wei as f64 * 100.0 } else { 0.0 };
    let win_rate = if total_batches > 0 { winning_batches as f64 / total_batches as f64 * 100.0 } else { 0.0 };

    // P&L history (hourly buckets, i128 running sum → f64 at output)
    let mut pnl_history: Vec<PnlPoint> = Vec::new();
    if !pnl_rows.is_empty() {
        let mut cumulative: i128 = 0;
        let mut current_hour: Option<i64> = None;
        let mut hour_delta: i128 = 0;
        for row in pnl_rows.iter().rev() {
            let hour = row.resolved_at.timestamp() / 3600;
            let d: i128 = row.delta.parse().unwrap_or(0);
            if current_hour != Some(hour) {
                if let Some(h) = current_hour {
                    cumulative += hour_delta;
                    if let Some(dt) = chrono::DateTime::from_timestamp(h * 3600, 0) {
                        pnl_history.push(PnlPoint { timestamp: dt.to_rfc3339(), pnl: wei_to_dollars(cumulative) });
                    }
                }
                current_hour = Some(hour);
                hour_delta = d;
            } else { hour_delta += d; }
        }
        if let Some(h) = current_hour {
            cumulative += hour_delta;
            if let Some(dt) = chrono::DateTime::from_timestamp(h * 3600, 0) {
                pnl_history.push(PnlPoint { timestamp: dt.to_rfc3339(), pnl: wei_to_dollars(cumulative) });
            }
        }
        if pnl_history.len() > 200 {
            let step = pnl_history.len() / 200;
            pnl_history = pnl_history.into_iter().step_by(step).collect();
        }
    }

    let last_active = pnl_rows.first().map(|r| r.resolved_at.to_rfc3339());

    Json(PlayerProfileResponse {
        stats: ProfileStats {
            pnl: wei_to_dollars(total_pnl_wei),
            total_deposited: wei_to_dollars(total_deposited_wei),
            roi: (roi * 10.0).round() / 10.0,
            win_rate: (win_rate * 10.0).round() / 10.0,
            total_batches,
            last_active_at: last_active,
        },
        batches,
        pnl_history,
    }).into_response()
}
```

- [ ] **Step 3: Register route**

In the routes function, add:
```rust
.route("/vision/player/:address/profile", get(player_profile))
```

- [ ] **Step 4: Build, test, commit**

```bash
cd oracle && cargo build 2>&1 | tail -20
```

Test on VPS after deploy:
```bash
curl -s "http://localhost:10001/vision/player/0x<known>/profile" | jq .
```

```bash
git add oracle/src/vision/api.rs
git commit -m "feat(oracle): player profile endpoint — stats, batches, P&L history"
```

---

## Chunk 2: Data-Node — Proxy + Cache

### Task 4: Proxy Profile Endpoint with Cache

**Files:**
- Modify: `data-node/src/vision_api.rs` (add proxy handler)
- Modify: `data-node/src/api.rs` (register route + add cache to AppState)

Follow the exact pattern of the existing leaderboard proxy (`LeaderboardCache`). The oracle URL is sourced from the `ORACLE_URL` env var, same as `LeaderboardCache.oracle_url`.

- [ ] **Step 1: Add ProfileCache to AppState**

Use `mini_moka` (already in the ecosystem) or a simple bounded HashMap. The cache must:
- **Hard cap** at 5K entries (prevent unbounded growth from address enumeration)
- **Serve stale data** on oracle failure (graceful degradation)
- **Coalesce concurrent requests** for the same address (prevent stampede)

```rust
pub struct ProfileCache {
    oracle_url: String,
    entries: tokio::sync::RwLock<std::collections::HashMap<String, (String, std::time::Instant)>>,
    in_flight: tokio::sync::RwLock<std::collections::HashMap<String, Arc<tokio::sync::Notify>>>,
    ttl: std::time::Duration,
}

impl ProfileCache {
    pub fn new(oracle_url: String, ttl_secs: u64) -> Self {
        Self {
            oracle_url,
            entries: tokio::sync::RwLock::new(std::collections::HashMap::new()),
            in_flight: tokio::sync::RwLock::new(std::collections::HashMap::new()),
            ttl: std::time::Duration::from_secs(ttl_secs),
        }
    }

    pub async fn get_or_fetch(&self, addr: &str) -> Result<String, StatusCode> {
        // 1. Check fresh cache
        {
            let entries = self.entries.read().await;
            if let Some((json, ts)) = entries.get(addr) {
                if ts.elapsed() < self.ttl {
                    return Ok(json.clone());
                }
            }
        }

        // 2. Coalesce concurrent requests for same address
        {
            let in_flight = self.in_flight.read().await;
            if let Some(notify) = in_flight.get(addr) {
                let n = notify.clone();
                drop(in_flight);
                n.notified().await;
                // Another request completed — check cache again
                let entries = self.entries.read().await;
                if let Some((json, _)) = entries.get(addr) {
                    return Ok(json.clone());
                }
            }
        }

        // 3. Mark this address as in-flight
        let notify = Arc::new(tokio::sync::Notify::new());
        {
            let mut in_flight = self.in_flight.write().await;
            in_flight.insert(addr.to_string(), notify.clone());
        }

        // 4. Fetch from oracle
        let url = format!("{}/vision/player/{}/profile", self.oracle_url, addr);
        let result = reqwest::Client::new()
            .get(&url)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await;

        // 5. Clean up in-flight, notify waiters
        {
            let mut in_flight = self.in_flight.write().await;
            in_flight.remove(addr);
        }
        notify.notify_waiters();

        match result {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = resp.text().await {
                    let mut entries = self.entries.write().await;
                    entries.insert(addr.to_string(), (body.clone(), std::time::Instant::now()));
                    // Hard cap: evict oldest when > 5K entries
                    if entries.len() > 5_000 {
                        let oldest = entries.iter()
                            .min_by_key(|(_, (_, ts))| *ts)
                            .map(|(k, _)| k.clone());
                        if let Some(k) = oldest { entries.remove(&k); }
                    }
                    return Ok(body);
                }
                Err(StatusCode::BAD_GATEWAY)
            }
            _ => {
                // Oracle down — serve stale cache if available
                let entries = self.entries.read().await;
                if let Some((json, _)) = entries.get(addr) {
                    return Ok(json.clone()); // stale but better than 502
                }
                Err(StatusCode::BAD_GATEWAY)
            }
        }
    }
}
```

Add `pub profile_cache: Arc<ProfileCache>` to `AppState`. Initialize with oracle URL from `ORACLE_URL` env var and 30s TTL.

- [ ] **Step 2: Add proxy handler in vision_api.rs**

```rust
pub async fn player_profile_proxy(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    if address.len() != 42 || !address.starts_with("0x")
        || !address[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return (StatusCode::BAD_REQUEST, "Invalid address").into_response();
    }
    let addr = address.to_lowercase();

    match state.profile_cache.get_or_fetch(&addr).await {
        Ok(json) => (StatusCode::OK, [(axum::http::header::CONTENT_TYPE, "application/json")], json).into_response(),
        Err(status) => (status, "Profile unavailable").into_response(),
    }
}
```

- [ ] **Step 3: Register route**

```rust
.route("/vision/player/:address/profile", get(vision_api::player_profile_proxy))
```

- [ ] **Step 4: Build, test, commit**

```bash
cd data-node && cargo build 2>&1 | tail -20
git add data-node/src/vision_api.rs data-node/src/api.rs
git commit -m "feat(data-node): proxy + cache oracle profile endpoint (30s TTL)"
```

---

## Chunk 3: Frontend — Profile Page

### Task 5: Proxy + Hook

**Files:**
- Create: `frontend/app/api/vision/player/[address]/profile/route.ts`
- Create: `frontend/hooks/usePlayerProfile.ts`

- [ ] **Step 1: Create Next.js proxy route**

Proxy to data-node (not oracle directly). Use `cache: 'no-store'` + `Cache-Control` header to avoid unbounded Next.js fetch cache entries.

```typescript
// frontend/app/api/vision/player/[address]/profile/route.ts
import { NextResponse } from 'next/server'
import { AA_DATA_NODE_URL } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }
  try {
    const res = await fetch(
      `${AA_DATA_NODE_URL}/vision/player/${address.toLowerCase()}/profile`,
      { cache: 'no-store', signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return NextResponse.json({ error: 'Profile unavailable' }, { status: res.status })
    const data = await res.json()
    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    return response
  } catch {
    return NextResponse.json({ error: 'Profile unavailable' }, { status: 502 })
  }
}
```

- [ ] **Step 2: Create hook**

```typescript
// frontend/hooks/usePlayerProfile.ts
'use client'
import { useQuery } from '@tanstack/react-query'

export interface ProfileTick { tickId: number; pnl: number; won: boolean }
export interface ProfileBatch {
  batchId: number; sourceId: string; status: 'active' | 'exited'
  deposited: number; balance: number; tickCount: number; roi: number
  ticks: ProfileTick[]
}
export interface PnlPoint { timestamp: string; pnl: number }
export interface ProfileStats {
  pnl: number; totalDeposited: number; roi: number; winRate: number
  totalBatches: number; lastActiveAt: string | null
}
export interface PlayerProfile {
  stats: ProfileStats; batches: ProfileBatch[]; pnlHistory: PnlPoint[]
}

async function fetchProfile(address: string): Promise<PlayerProfile> {
  const res = await fetch(`/api/vision/player/${address.toLowerCase()}/profile`)
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`)
  return res.json()
}

export function usePlayerProfile(address: string) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['player-profile', address.toLowerCase()],
    queryFn: () => fetchProfile(address),
    enabled: /^0x[0-9a-fA-F]{40}$/.test(address),
    staleTime: 60_000,
    refetchInterval: 60_000,  // keep profile fresh for long sessions (ticks resolve every few minutes)
  })
  return { profile: data ?? null, isLoading, isError, error: error as Error | null }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/vision/player/ frontend/hooks/usePlayerProfile.ts
git commit -m "feat(frontend): player profile proxy + hook"
```

---

### Task 6: Page Shell + Header + Tabs

**Files:**
- Create: `frontend/components/domain/profile/ProfileHeader.tsx`
- Create: `frontend/components/domain/profile/ProfileTabs.tsx`
- Create: `frontend/app/[locale]/profile/[address]/page.tsx`

- [ ] **Step 1: ProfileHeader** — avatar (initial from address), truncated address, last active, stats row. All values pre-computed by oracle — just format `$${stats.pnl.toFixed(2)}`.

- [ ] **Step 2: ProfileTabs** — Vision | Index buttons, `?tab=` query param.

- [ ] **Step 3: Page route** — `Suspense` wrapping `ProfileContent` (which calls `useSearchParams`). Stats switch by active tab.

- [ ] **Step 4: Verify, commit**

```bash
git add frontend/components/domain/profile/ frontend/app/\[locale\]/profile/
git commit -m "feat(frontend): profile page shell — header, tabs, stats"
```

---

### Task 7: Vision Tab — Chart + Tick Squares

**Files:**
- Create: `frontend/components/domain/profile/TickSquares.tsx`
- Create: `frontend/components/domain/profile/BatchTickRow.tsx`
- Create: `frontend/components/domain/profile/BatchTickHistory.tsx`
- Create: `frontend/components/domain/profile/PnlChart.tsx`
- Create: `frontend/components/domain/profile/VisionTab.tsx`

All values from API are already dollars/percentages. Components just render.

- [ ] **Step 1: TickSquares** — 11x11px, 2px gap/radius. Quartile intensity from `tick.pnl` abs values. Green=won, red=lost.

- [ ] **Step 2: BatchTickRow** — sourceId + badge (140px) | TickSquares (flex, `overflow-x-auto` for mobile) | ROI (72px).

- [ ] **Step 3: BatchTickHistory** — column headers + sorted rows (pre-sorted by oracle) + legend.

- [ ] **Step 4: PnlChart** — recharts AreaChart. Time range filter (1D/1W/1M/ALL) filters `pnlHistory` by timestamp client-side. Green/red fill.

- [ ] **Step 5: VisionTab** — PnlChart + BatchTickHistory. Empty: "No Vision history yet."

- [ ] **Step 6: Wire into page, verify, commit**

```bash
git add frontend/components/domain/profile/
git commit -m "feat(frontend): Vision tab — P&L chart + batch tick squares"
```

---

### Task 8: Index Tab + Leaderboard Links

**Files:**
- Create: `frontend/components/domain/profile/IndexTab.tsx`
- Modify: `frontend/components/domain/vision/VisionLeaderboard.tsx`

- [ ] **Step 1: IndexTab** — for arbitrary address ITP balances, create a new hook `useAddressItpShares(address: string)` that:
  1. Calls `getItpCount()` on Index.sol to get total ITPs
  2. Uses `useReadContracts` (wagmi multicall) to batch-call `getUserShares(itpId, address)` for each ITP ID
  3. Filters to non-zero balances
  This is O(N) RPC calls batched into one multicall. At 96 ITPs this is one multicall. At 621+ ITPs, may need chunking (200 per multicall). Do NOT use `useAccount()` — the address comes from the URL param.
  Show holdings table (ITP name, shares, value). Empty state: "No ITP holdings."

- [ ] **Step 2: Leaderboard links** — wrap player addresses in `<Link href={'/profile/${addr}'}>{truncated}</Link>`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/domain/profile/IndexTab.tsx frontend/components/domain/vision/
git commit -m "feat(frontend): Index tab + profile links from leaderboard"
```

---

### Task 9: Deploy + Push

- [ ] **Step 1: Deploy oracle** — `ssh index-maker/prod/be`, pull, rebuild, restart oracles
- [ ] **Step 2: Deploy data-node** — same VPS, rebuild, restart
- [ ] **Step 3: Verify endpoint** — `curl -s "https://data-node-url/vision/player/0x.../profile" | jq .`
- [ ] **Step 4: Push frontend** — `git push mono main`
- [ ] **Step 5: Deploy frontend** — `cd frontend && vercel --prod`
