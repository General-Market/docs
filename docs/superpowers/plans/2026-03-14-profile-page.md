# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public address profile page at `/profile/[address]` with Vision batch history (GitHub-style tick squares) and Index holdings tabs.

**Architecture:** Two new Postgres tables, tick result persistence in the existing resolution transaction, one new API endpoint with dedicated read pool, one Next.js proxy route, ~10 new React components.

**Tech Stack:** Rust/Axum/sqlx (issuer), Next.js 14 App Router, TanStack Query, recharts, Tailwind CSS, next-intl

**Spec:** `docs/superpowers/specs/2026-03-14-profile-page-design.md`

**Dependency:** This plan targets the **post-continuous-betting codebase**. The continuous betting plan (`docs/superpowers/plans/2026-03-14-vision-continuous-betting.md`) MUST be deployed first. It handles: two-slot bitmap model, multiplier removal, dynamic sources from data-node, reveal endpoint (single-tick bitmaps).

**NOT covered by continuous betting (this plan must handle):**
- Transaction refactor in `apply_tick_balances_with_db` — continuous betting's `persist_flip_and_mark_resolved` is a *separate* transaction for bitmap flip. The balance write path still has no transaction.
- `DepositRow.total_deposited: Option<i64>` truncation — continuous betting fixes the write path only, not the read path.
- `format!()` SQL in leaderboard — not addressed by continuous betting.
- Rate limiting on profile endpoint — new requirement.

---

## What This Plan Adds

1. `vision_player_tick_results` table — per-player per-tick outcomes
2. `vision_player_batch_summary` table — preserves deposit data when players exit
3. Transaction refactor for `apply_tick_balances_with_db` (launch gate)
4. `DepositRow` i64 fix + `format!()` SQL fix (launch gates)
5. Rate limiting via `tower-governor`
3. Tick result persistence inside the existing atomic resolution transaction
4. Deposit preservation in withdrawal handler
5. `/vision/player/:address/profile` API endpoint with dedicated read pool + caching
6. Next.js API proxy route
7. Frontend profile page with Vision tab (P&L chart + tick squares) and Index tab (holdings)

---

## Chunk 1: Backend — New Tables + Persistence

### Task 1: Database Migrations

**Files:**
- Create: `issuer/migrations/006_create_player_tick_results.sql`
- Create: `issuer/migrations/007_create_player_batch_summary.sql`

Note: migration numbers follow after continuous betting migrations (004 = bitmap table, 005 = batch state). Adjust numbers based on what continuous betting actually uses.

- [ ] **Step 1: Create tick results migration**

```sql
-- issuer/migrations/006_create_player_tick_results.sql
CREATE TABLE IF NOT EXISTS vision_player_tick_results (
  batch_id    INTEGER NOT NULL,
  tick_id     INTEGER NOT NULL,
  player      TEXT NOT NULL,
  delta       TEXT NOT NULL,
  won         BOOLEAN NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, tick_id, player)
);
CREATE INDEX IF NOT EXISTS idx_vptr_player ON vision_player_tick_results(player);
CREATE INDEX IF NOT EXISTS idx_vptr_player_resolved ON vision_player_tick_results(player, resolved_at);
CREATE INDEX IF NOT EXISTS idx_vptr_player_batch_tick ON vision_player_tick_results(player, batch_id, tick_id DESC);
```

- [ ] **Step 2: Create batch summary migration**

```sql
-- issuer/migrations/007_create_player_batch_summary.sql
CREATE TABLE IF NOT EXISTS vision_player_batch_summary (
  batch_id        INTEGER NOT NULL,
  player          TEXT NOT NULL,
  total_deposited TEXT NOT NULL,
  final_balance   TEXT NOT NULL,
  total_ticks     INTEGER NOT NULL,
  exited_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, player)
);
CREATE INDEX IF NOT EXISTS idx_vpbs_player ON vision_player_batch_summary(player);
```

- [ ] **Step 3: Verify migrations run on restart**

```bash
ssh index-maker/prod/be "cd /home/max/index && docker compose -f docker/testnet/issuer/docker-compose.yml restart issuer-1"
ssh index-maker/prod/be "docker logs issuer-1 --tail 20 2>&1 | grep -i migrat"
```

- [ ] **Step 4: Commit**

```bash
git add issuer/migrations/006_create_player_tick_results.sql issuer/migrations/007_create_player_batch_summary.sql
git commit -m "feat(issuer): add player tick results and batch summary tables"
```

---

### Task 2: Transaction Refactor + Persist Tick Results

**Files:**
- Modify: `issuer/src/vision/tick_scheduler.rs`

**Context:** `apply_tick_balances_with_db` currently runs in-memory update BEFORE DB writes, with no transaction wrapper. This is a launch gate — the profile page cannot ship without this fix. We refactor to use `pool.begin()`/`tx.commit()`, defer in-memory update until after commit, and add tick result INSERTs in the same transaction.

Note: continuous betting's `persist_flip_and_mark_resolved` is a *separate* transaction for bitmap flip — it does NOT cover balance writes. This task wraps the balance write path.

- [ ] **Step 1: Refactor apply_tick_balances_with_db with transaction + tick results**

Replace the entire function. The new signature takes `tick_id`:

```rust
// Persist per-player tick results for profile page
for pb in player_balances {
    let effective_delta = pb.new_balance.as_u128() as i128 - pb.old_balance.as_u128() as i128;
    sqlx::query(
        "INSERT INTO vision_player_tick_results (batch_id, tick_id, player, delta, won, resolved_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (batch_id, tick_id, player) DO NOTHING"
    )
    .bind(batch_id as i64)
    .bind(tick_id as i64)
    .bind(format!("{:?}", pb.player))
    .bind(effective_delta.to_string())
    .bind(effective_delta > 0)
    .execute(&mut *tx)
    .await?;
}
```

**Do NOT use `pb.delta`** — that is the raw pre-clamping value. Compute `effective_delta = new_balance - old_balance` explicitly.

- [ ] **Step 3: Build and verify**

```bash
cd issuer && cargo build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add issuer/src/vision/tick_scheduler.rs
git commit -m "feat(issuer): persist per-player tick results in resolution transaction"
```

---

### Task 3: Preserve Deposit Data on Withdrawal

**Files:**
- Modify: `issuer/src/vision/chain_listener.rs` (`handle_player_withdrawn` AND `handle_force_withdrawn`)

**Context:** When a player withdraws (or is force-withdrawn), `vision_positions` row is DELETED. We INSERT a summary row first to preserve `total_deposited` and `final_balance`. Both handlers must be updated — not just `handle_player_withdrawn`.

The SELECT + INSERT + DELETE must be wrapped in a single Postgres transaction to prevent double-counting if the INSERT succeeds but DELETE fails.

- [ ] **Step 1: Create a shared helper function**

Add a reusable function in `chain_listener.rs`:

```rust
async fn preserve_and_delete_position(pool: &PgPool, batch_id: u64, player: Address) -> Result<(), sqlx::Error> {
    let player_str = format!("{:?}", player);
    let mut tx = pool.begin().await?;

    // Read position data before deletion
    if let Some((deposited, balance)) = sqlx::query_as::<_, (String, String)>(
        "SELECT total_deposited, balance FROM vision_positions WHERE batch_id = $1 AND player = $2"
    )
    .bind(batch_id as i64)
    .bind(&player_str)
    .fetch_optional(&mut *tx)
    .await?
    {
        let tick_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM vision_player_tick_results WHERE batch_id = $1 AND player = $2"
        )
        .bind(batch_id as i64)
        .bind(&player_str)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0);

        // Preserve summary
        sqlx::query(
            "INSERT INTO vision_player_batch_summary (batch_id, player, total_deposited, final_balance, total_ticks, exited_at)
             VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (batch_id, player) DO NOTHING"
        )
        .bind(batch_id as i64)
        .bind(&player_str)
        .bind(&deposited)
        .bind(&balance)
        .bind(tick_count as i32)
        .execute(&mut *tx)
        .await?;
    }

    // Delete position
    sqlx::query("DELETE FROM vision_positions WHERE batch_id = $1 AND player = $2")
        .bind(batch_id as i64)
        .bind(&player_str)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}
```

- [ ] **Step 2: Use helper in both `handle_player_withdrawn` and `handle_force_withdrawn`**

Replace the bare DELETE in both handlers with:
```rust
if let Err(e) = preserve_and_delete_position(&self.pool, batch_id, player).await {
    warn!(batch_id, player = %player, error = %e, "Failed to preserve+delete position");
}
```

- [ ] **Step 2: Build and verify**

```bash
cd issuer && cargo build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add issuer/src/vision/chain_listener.rs
git commit -m "feat(issuer): preserve deposit data in batch summary on withdrawal"
```

---

### Task 3b: Fix DepositRow i64 Truncation + format!() SQL

**Files:**
- Modify: `issuer/src/vision/api.rs` (~line 970-985, 1054-1058)

- [ ] **Step 1: Fix DepositRow**

Change `Option<i64>` to `Option<String>` and update SQL to cast `::text`:

```rust
#[derive(Debug, sqlx::FromRow)]
struct DepositRow {
    player: String,
    total_deposited: Option<String>,
}
```

Update all `d.total_deposited.unwrap_or(0)` usages to parse from string:
```rust
let deposited: f64 = d.total_deposited.as_deref().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
```

Update SQL: `SUM(vp.total_deposited::numeric)::text as total_deposited`

- [ ] **Step 2: Fix format!() SQL**

Replace the `format!()` block at ~line 970-985 with parameterized queries using `.bind(bid as i64)`.

- [ ] **Step 3: Build and verify**

```bash
cd issuer && cargo build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add issuer/src/vision/api.rs
git commit -m "fix(issuer): DepositRow i64 truncation + parameterized SQL in leaderboard"
```

---

## Chunk 2: Backend — Profile API Endpoint

### Task 4: Dedicated Read Pool + Rate Limiting + Async Cache

**Files:**
- Modify: `issuer/Cargo.toml` (add `moka`)
- Modify: `issuer/src/main.rs` (pool creation)
- Modify: `issuer/src/vision/api.rs` (VisionState struct)

- [ ] **Step 1: Add `moka` to Cargo.toml**

```toml
moka = { version = "0.12", features = ["future"] }
```

- [ ] **Step 2: Update VisionState with profile_pool + cache**

```rust
pub struct VisionState {
    pub pool: sqlx::PgPool,
    pub profile_pool: sqlx::PgPool,  // dedicated read pool, NOT Option — fail startup if unavailable
    pub scheduler: Arc<TickScheduler>,
    pub bitmap_store: Arc<BitmapStore>,
    pub config: VisionConfig,
    pub profile_cache: moka::future::Cache<String, String>,  // address → JSON, 60s TTL, max 10K entries
}
```

- [ ] **Step 3: Create second pool + cache in main.rs**

```rust
let profile_pool = sqlx::postgres::PgPoolOptions::new()
    .max_connections(2)
    .idle_timeout(std::time::Duration::from_secs(300))
    .connect(&vision_cfg.database_url)
    .await?;

let profile_cache = moka::future::Cache::builder()
    .time_to_live(std::time::Duration::from_secs(60))
    .max_capacity(10_000)
    .build();
```

Never fall back to the main pool — if profile_pool is down, return 503 instead of stealing tick resolution connections.

- [ ] **Step 4: Build and verify**

```bash
cd issuer && cargo build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add issuer/src/main.rs issuer/src/vision/api.rs
git commit -m "feat(issuer): add dedicated 2-connection read pool for profile queries"
```

---

### Task 5: Profile Endpoint Implementation

**Files:**
- Modify: `issuer/src/vision/api.rs` (add route + handler + types + cache)

- [ ] **Step 1: Add response types**

Add at bottom of `api.rs`:

```rust
#[derive(Debug, Serialize)]
struct PlayerProfileResponse {
    stats: PlayerProfileStats,
    batches: Vec<PlayerBatchInfo>,
    #[serde(rename = "pnlHistory")]
    pnl_history: Vec<PnlPoint>,
}

#[derive(Debug, Serialize)]
struct PlayerProfileStats {
    #[serde(rename = "totalPnl")]
    total_pnl: String,
    #[serde(rename = "totalDeposited")]
    total_deposited: String,
    roi: f64,
    #[serde(rename = "winRate")]
    win_rate: f64,
    #[serde(rename = "totalBatches")]
    total_batches: u64,
    #[serde(rename = "lastActiveAt")]
    last_active_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct PlayerBatchInfo {
    #[serde(rename = "batchId")]
    batch_id: i64,
    #[serde(rename = "sourceName")]
    source_name: String,
    status: String,       // "active" or "exited"
    deposited: String,    // only for exited batches
    balance: String,      // only for exited batches
    #[serde(rename = "tickCount")]
    tick_count: i64,
    roi: f64,
    ticks: Vec<ProfileTickResult>,
}

#[derive(Debug, Serialize)]
struct ProfileTickResult {
    #[serde(rename = "tickId")]
    tick_id: i64,
    delta: String,
    won: bool,
}

#[derive(Debug, Serialize)]
struct PnlPoint {
    timestamp: String,
    #[serde(rename = "cumulativePnl")]
    cumulative_pnl: String,
}

#[derive(Debug, sqlx::FromRow)]
struct TickRow {
    batch_id: i64,
    tick_id: i64,
    delta: String,
    won: bool,
    rn: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct PnlRow {
    resolved_at: chrono::DateTime<chrono::Utc>,
    delta: String,
}
```

- [ ] **Step 2: Add address validation helper**

```rust
fn is_valid_eth_address(addr: &str) -> bool {
    addr.len() == 42 && addr.starts_with("0x") && addr[2..].chars().all(|c| c.is_ascii_hexdigit())
}

fn parse_wei(s: &str) -> i128 {
    s.parse::<i128>().unwrap_or(0)
}
```

- [ ] **Step 3: Implement the handler (3 queries, i128 arithmetic, moka cache)**

**CRITICAL: All wei arithmetic uses `i128`. Never route wei values through `f64`.** The only f64 conversion is for ROI/win_rate percentages, computed from i128 values at the end.

**3 queries only:**
- Q1: Active positions + exited summaries (UNION ALL)
- Q2: Ticks CTE with tick count (window function folds count into CTE)
- Q3: P&L history

```rust
#[derive(Debug, sqlx::FromRow)]
struct BatchPositionRow {
    batch_id: i64,
    balance: String,
    total_deposited: String,
    status: String,        // 'active' or 'exited'
    total_ticks: i64,
}

async fn player_profile(
    State(state): State<Arc<VisionState>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    if !is_valid_eth_address(&address) {
        return (StatusCode::BAD_REQUEST, "Invalid address").into_response();
    }
    let addr = address.to_lowercase();

    // Check moka cache (60s TTL handled by moka)
    if let Some(cached) = state.profile_cache.get(&addr).await {
        return (StatusCode::OK, [(axum::http::header::CONTENT_TYPE, "application/json")], cached).into_response();
    }

    let pool = &state.profile_pool;

    // Q1: All batches (active + exited) in one query
    let positions = sqlx::query_as::<_, BatchPositionRow>(
        "SELECT batch_id, balance, total_deposited, 'active' as status,
                COALESCE((SELECT COUNT(*) FROM vision_player_tick_results r WHERE r.batch_id = vp.batch_id AND r.player = $1), 0) as total_ticks
         FROM vision_positions vp WHERE player = $1
         UNION ALL
         SELECT batch_id, final_balance as balance, total_deposited, 'exited' as status, total_ticks::bigint
         FROM vision_player_batch_summary WHERE player = $1"
    )
    .bind(&addr)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Q2: Ticks CTE (most recent 60 per batch, SQL-level cap)
    let tick_rows = sqlx::query_as::<_, TickRow>(
        "WITH ranked AS (
           SELECT batch_id, tick_id, delta, won,
                  ROW_NUMBER() OVER (PARTITION BY batch_id ORDER BY tick_id DESC) as rn
           FROM vision_player_tick_results WHERE player = $1
         )
         SELECT batch_id, tick_id, delta, won, rn FROM ranked WHERE rn <= 60"
    )
    .bind(&addr)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Q3: P&L history
    let pnl_rows = sqlx::query_as::<_, PnlRow>(
        "SELECT resolved_at, delta FROM vision_player_tick_results
         WHERE player = $1 ORDER BY resolved_at LIMIT 5000"
    )
    .bind(&addr)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // -- Stats (i128 arithmetic, never f64 for wei) --
    let mut total_deposited: i128 = 0;
    let mut total_balance: i128 = 0;
    let mut total_batches: u64 = 0;
    let mut winning_batches: u64 = 0;

    for pos in &positions {
        let dep = parse_wei(&pos.total_deposited);
        let bal = parse_wei(&pos.balance);
        total_deposited += dep;
        total_balance += bal;
        total_batches += 1;
        if bal > dep { winning_batches += 1; }
    }

    let total_pnl = total_balance - total_deposited;
    let roi = if total_deposited > 0 { (total_pnl as f64) / (total_deposited as f64) * 100.0 } else { 0.0 };
    let win_rate = if total_batches > 0 { winning_batches as f64 / total_batches as f64 * 100.0 } else { 0.0 };

    // -- Group ticks by batch --
    let mut batch_ticks: std::collections::HashMap<i64, Vec<ProfileTickResult>> = std::collections::HashMap::new();
    for tr in &tick_rows {
        batch_ticks.entry(tr.batch_id).or_default().push(ProfileTickResult {
            tick_id: tr.tick_id, delta: tr.delta.clone(), won: tr.won,
        });
    }

    // -- Build batch infos --
    // source_id comes from scheduler's batch map. Return source_id string — frontend resolves to display name.
    let mut batches: Vec<PlayerBatchInfo> = Vec::new();
    for pos in &positions {
        let dep = parse_wei(&pos.total_deposited);
        let bal = parse_wei(&pos.balance);
        let batch_roi = if dep > 0 { (bal - dep) as f64 / dep as f64 * 100.0 } else { 0.0 };
        // Get source_id from scheduler batch state
        let source_id = state.scheduler.get_source_id(pos.batch_id as u64).await
            .map(|id| format!("{:?}", id))
            .unwrap_or_else(|| format!("batch-{}", pos.batch_id));
        batches.push(PlayerBatchInfo {
            batch_id: pos.batch_id,
            source_name: source_id,  // frontend maps source_id → display name from data-node registry
            status: pos.status.clone(),
            deposited: pos.total_deposited.clone(),
            balance: pos.balance.clone(),
            tick_count: pos.total_ticks,
            roi: (batch_roi * 10.0).round() / 10.0,
            ticks: batch_ticks.remove(&pos.batch_id).unwrap_or_default(),
        });
    }

    // -- P&L history (hourly buckets, i128 running sum) --
    let mut pnl_history: Vec<PnlPoint> = Vec::new();
    if !pnl_rows.is_empty() {
        let mut cumulative: i128 = 0;
        let mut current_hour: Option<i64> = None;
        let mut hour_delta: i128 = 0;

        for row in &pnl_rows {
            let hour = row.resolved_at.timestamp() / 3600;
            let delta = parse_wei(&row.delta);
            if current_hour != Some(hour) {
                if let Some(h) = current_hour {
                    cumulative += hour_delta;
                    if let Some(dt) = chrono::DateTime::from_timestamp(h * 3600, 0) {
                        pnl_history.push(PnlPoint { timestamp: dt.to_rfc3339(), cumulative_pnl: cumulative.to_string() });
                    }
                }
                current_hour = Some(hour);
                hour_delta = delta;
            } else {
                hour_delta += delta;
            }
        }
        if let Some(h) = current_hour {
            cumulative += hour_delta;
            if let Some(dt) = chrono::DateTime::from_timestamp(h * 3600, 0) {
                pnl_history.push(PnlPoint { timestamp: dt.to_rfc3339(), cumulative_pnl: cumulative.to_string() });
            }
        }
        // Downsample to ~200 points
        if pnl_history.len() > 200 {
            let step = pnl_history.len() / 200;
            pnl_history = pnl_history.into_iter().step_by(step).collect();
        }
    }

    let last_active = pnl_rows.last().map(|r| r.resolved_at.to_rfc3339());

    let response = PlayerProfileResponse {
        stats: PlayerProfileStats {
            total_pnl: total_pnl.to_string(),
            total_deposited: total_deposited.to_string(),
            roi: (roi * 10.0).round() / 10.0,
            win_rate: (win_rate * 10.0).round() / 10.0,
            total_batches,
            last_active_at: last_active,
        },
        batches,
        pnl_history,
    };

    // Cache via moka (async, no Mutex, no poisoning risk)
    if let Ok(json) = serde_json::to_string(&response) {
        state.profile_cache.insert(addr, json.clone()).await;
        return (StatusCode::OK, [(axum::http::header::CONTENT_TYPE, "application/json")], json).into_response();
    }

    Json(response).into_response()
}
```

**Key design decisions:**
- `i128` for all wei arithmetic — no f64 precision loss on 18-decimal values
- `f64` used ONLY for ROI/win_rate percentages (computed from i128, safe for ratios)
- `UNION ALL` merges active + exited positions in one query — no double-scan
- `source_name` field returns `source_id` string — frontend resolves to display name via data-node source registry (post-continuous-betting, sources are dynamic)
- `moka` cache — async-safe, TTL-managed, bounded at 10K entries, no Mutex poisoning risk
- `get_source_id(batch_id)` — check scheduler's batch map. If method doesn't exist, add it (simple HashMap lookup).

- [ ] **Step 4: Register the route**

In `routes()`, add:

```rust
.route("/vision/player/:address/profile", get(player_profile))
```

- [ ] **Step 5: Build and verify**

```bash
cd issuer && cargo build 2>&1 | tail -20
```

- [ ] **Step 6: Test endpoint**

```bash
curl -s "http://142.132.164.24/vision/player/0x<known-player>/profile" | jq .
```

- [ ] **Step 7: Commit**

```bash
git add issuer/src/vision/api.rs
git commit -m "feat(issuer): player profile endpoint with dedicated pool and 60s cache"
```

---

### Task 6: Next.js API Proxy

**Files:**
- Create: `frontend/app/api/vision/player/[address]/profile/route.ts`

- [ ] **Step 1: Create the proxy**

```typescript
import { NextResponse } from 'next/server'
import { ISSUER_VISION_URL } from '@/lib/config'

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
      `${ISSUER_VISION_URL}/vision/player/${address.toLowerCase()}/profile`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch profile' }, { status: res.status })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'Profile unavailable' }, { status: 502 })
  }
}
```

Check `frontend/lib/config.ts` for the correct variable name (may be `VISION_API_URL`).

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/vision/player/\[address\]/profile/route.ts
git commit -m "feat(frontend): API proxy for player profile endpoint"
```

---

## Chunk 3: Frontend — Profile Page

### Task 7: Page Shell + Header + Tabs + Hook

**Files:**
- Create: `frontend/hooks/usePlayerProfile.ts`
- Create: `frontend/components/domain/profile/ProfileHeader.tsx`
- Create: `frontend/components/domain/profile/ProfileTabs.tsx`
- Create: `frontend/app/[locale]/profile/[address]/page.tsx`

- [ ] **Step 1: Create usePlayerProfile hook**

```typescript
// frontend/hooks/usePlayerProfile.ts
'use client'
import { useQuery } from '@tanstack/react-query'

export interface TickResult { tickId: number; delta: string; won: boolean }
export interface PlayerBatchInfo {
  batchId: number; sourceName: string; status: 'active' | 'exited'
  deposited: string; balance: string; tickCount: number; roi: number
  ticks: TickResult[]
}
export interface PnlPoint { timestamp: string; cumulativePnl: string }
export interface PlayerProfileStats {
  totalPnl: string; totalDeposited: string; roi: number; winRate: number
  totalBatches: number; lastActiveAt: string | null
}
export interface PlayerProfile {
  stats: PlayerProfileStats; batches: PlayerBatchInfo[]; pnlHistory: PnlPoint[]
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
    refetchInterval: 60_000,
  })
  return { profile: data ?? null, isLoading, isError, error: error as Error | null }
}
```

- [ ] **Step 2: Create ProfileHeader**

```typescript
// frontend/components/domain/profile/ProfileHeader.tsx
'use client'
import { truncateAddress } from '@/lib/utils/address'
import { formatRelativeTime } from '@/lib/utils/time'

interface Stat { label: string; value: string; color?: string }
interface Props { address: string; lastActiveAt?: string; stats: Stat[] }

export function ProfileHeader({ address, lastActiveAt, stats }: Props) {
  return (
    <div className="px-6 lg:px-12 border-b border-border-light">
      <div className="max-w-site mx-auto py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neutral-900 to-neutral-500 flex items-center justify-center text-white font-black text-lg shrink-0">
            {address.slice(2, 3).toUpperCase()}
          </div>
          <div>
            <div className="text-xl font-black tracking-[-0.02em]">{truncateAddress(address)}</div>
            {lastActiveAt && <div className="text-[11px] text-text-muted">Last active {formatRelativeTime(lastActiveAt)}</div>}
          </div>
        </div>
        <div className="flex gap-8">
          {stats.map(s => (
            <div key={s.label}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">{s.label}</div>
              <div className={`text-[16px] font-bold font-mono tabular-nums ${s.color || 'text-black'}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create ProfileTabs**

```typescript
// frontend/components/domain/profile/ProfileTabs.tsx
'use client'
interface Props { activeTab: 'vision' | 'index'; onTabChange: (t: 'vision' | 'index') => void }

export function ProfileTabs({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex border-b border-border-light px-6 lg:px-12">
      <div className="max-w-site mx-auto flex w-full">
        {(['vision', 'index'] as const).map(tab => (
          <button key={tab} onClick={() => onTabChange(tab)}
            className={`px-6 py-3 text-[13px] font-semibold border-b-[3px] transition-all capitalize ${
              activeTab === tab ? 'text-black border-black' : 'text-text-secondary border-transparent hover:text-black'
            }`}>{tab}</button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create page route**

```typescript
// frontend/app/[locale]/profile/[address]/page.tsx
'use client'
import { use, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProfileHeader } from '@/components/domain/profile/ProfileHeader'
import { ProfileTabs } from '@/components/domain/profile/ProfileTabs'
import { usePlayerProfile } from '@/hooks/usePlayerProfile'

function ProfileContent({ address }: { address: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tab = (searchParams.get('tab') === 'index' ? 'index' : 'vision') as 'vision' | 'index'
  const { profile, isLoading } = usePlayerProfile(address)

  const handleTab = (t: 'vision' | 'index') => {
    const p = new URLSearchParams(searchParams.toString()); p.set('tab', t)
    router.replace(`${pathname}?${p.toString()}`)
  }

  const pnl = profile ? parseFloat(profile.stats.totalPnl) / 1e18 : 0
  const pnlColor = pnl >= 0 ? 'text-color-up' : 'text-color-down'

  const visionStats = [
    { label: 'P&L', value: profile ? `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}` : '—', color: profile ? pnlColor : undefined },
    { label: 'ROI', value: profile ? `${profile.stats.roi >= 0 ? '+' : ''}${profile.stats.roi}%` : '—', color: profile ? pnlColor : undefined },
    { label: 'Win Rate', value: profile ? `${profile.stats.winRate}%` : '—' },
    { label: 'Volume', value: profile ? `$${(parseFloat(profile.stats.totalDeposited) / 1e18).toFixed(0)}` : '—' },
    { label: 'Batches', value: profile ? `${profile.stats.totalBatches}` : '—' },
  ]
  const indexStats = [
    { label: 'Portfolio Value', value: '—' },
    { label: 'Holdings', value: '—' },
  ]

  return (
    <>
      <ProfileHeader address={address} lastActiveAt={profile?.stats.lastActiveAt || undefined} stats={tab === 'vision' ? visionStats : indexStats} />
      <ProfileTabs activeTab={tab} onTabChange={handleTab} />
      <div className="px-6 lg:px-12">
        <div className="max-w-site mx-auto py-6">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-text-muted animate-pulse">Loading...</div>
          ) : tab === 'vision' ? (
            <div className="text-sm text-text-muted">Vision tab — next task</div>
          ) : (
            <div className="text-sm text-text-muted">Index tab — next task</div>
          )}
        </div>
      </div>
    </>
  )
}

export default function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params)
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <Header />
      <Suspense fallback={<div className="py-12 text-center text-sm text-text-muted animate-pulse">Loading profile...</div>}>
        <ProfileContent address={address} />
      </Suspense>
      <div className="flex-1" />
      <Footer />
    </main>
  )
}
```

- [ ] **Step 5: Verify page renders**

```bash
cd frontend && npm run dev
# Navigate to http://localhost:3000/profile/0x0000000000000000000000000000000000000001
```

- [ ] **Step 6: Commit**

```bash
git add frontend/hooks/usePlayerProfile.ts frontend/components/domain/profile/ frontend/app/\[locale\]/profile/
git commit -m "feat(frontend): profile page shell with header, tabs, and data hook"
```

---

### Task 8: Vision Tab — TickSquares + BatchTickHistory + PnlChart

**Files:**
- Create: `frontend/components/domain/profile/TickSquares.tsx`
- Create: `frontend/components/domain/profile/BatchTickRow.tsx`
- Create: `frontend/components/domain/profile/BatchTickHistory.tsx`
- Create: `frontend/components/domain/profile/PnlChart.tsx`
- Create: `frontend/components/domain/profile/VisionTab.tsx`
- Modify: `frontend/app/[locale]/profile/[address]/page.tsx`

- [ ] **Step 1: Create TickSquares**

GitHub-style 11x11px squares. Intensity from quartiles of the player's delta distribution. See `frontend/components/domain/profile/TickSquares.tsx` in the original plan — code is unchanged.

- [ ] **Step 2: Create BatchTickRow**

Single row: batch info (140px) + tick squares (flex) + ROI (72px). See original plan Task 14.

- [ ] **Step 3: Create BatchTickHistory**

Column headers + sorted rows (active first) + legend. See original plan Task 14.

- [ ] **Step 4: Create PnlChart**

Recharts `AreaChart` with time range toggles (1D/1W/1M/ALL). See original plan Task 15.

- [ ] **Step 5: Create VisionTab**

```typescript
// frontend/components/domain/profile/VisionTab.tsx
'use client'
import { PnlChart } from './PnlChart'
import { BatchTickHistory } from './BatchTickHistory'
import type { PlayerProfile } from '@/hooks/usePlayerProfile'

export function VisionTab({ profile }: { profile: PlayerProfile }) {
  if (profile.batches.length === 0) {
    return <div className="py-12 text-center text-sm text-text-muted">This address has no Vision history yet.</div>
  }
  return (
    <div>
      <PnlChart history={profile.pnlHistory} />
      <BatchTickHistory batches={profile.batches} />
    </div>
  )
}
```

- [ ] **Step 6: Wire into page**

Replace Vision placeholder in `ProfileContent` with:
```typescript
import { VisionTab } from '@/components/domain/profile/VisionTab'
// ...
tab === 'vision' && profile ? <VisionTab profile={profile} /> : ...
```

- [ ] **Step 7: Verify**

Navigate to a profile page. Check: chart renders, tick squares show, ROI values display.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/domain/profile/
git commit -m "feat(frontend): Vision tab with P&L chart, batch tick squares, and ROI"
```

---

### Task 9: Index Tab + Leaderboard Links

**Files:**
- Create: `frontend/components/domain/profile/IndexTab.tsx`
- Modify: `frontend/components/domain/vision/VisionLeaderboard.tsx`
- Modify: `frontend/components/domain/vision/detail/TopPlayers.tsx`
- Modify: `frontend/app/[locale]/profile/[address]/page.tsx`

- [ ] **Step 1: Create IndexTab**

Reads ITP balances for an arbitrary address via on-chain multicall. The exact implementation depends on how `Index.sol` exposes per-ITP balances — check the contract ABI and existing `useUserItpShares` patterns. Show holdings table with ITP name, shares, NAV, value, % portfolio.

Empty state: "This address has no ITP holdings."

- [ ] **Step 2: Wire into page**

Replace Index placeholder with `<IndexTab address={address} />`.

- [ ] **Step 3: Link profiles from leaderboard**

In `VisionLeaderboard.tsx` and `TopPlayers.tsx`, wrap player addresses in `<Link href={'/profile/${address}'}>{truncated}</Link>`.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/domain/profile/IndexTab.tsx frontend/components/domain/vision/VisionLeaderboard.tsx frontend/components/domain/vision/detail/TopPlayers.tsx frontend/app/\[locale\]/profile/
git commit -m "feat(frontend): Index tab with holdings + link profiles from leaderboard"
```

---

### Task 10: Push

- [ ] **Step 1: Final verification**

Navigate to `/profile/<known-address>`. Verify both tabs, chart, tick squares, ROI, tab switching, mobile layout.

- [ ] **Step 2: Push**

```bash
git push mono main
```
