# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public address profile page at `/profile/[address]` with Vision batch history (GitHub-style tick squares) and Index holdings tabs.

**Architecture:** Oracle adds one INSERT to persist per-player tick deltas into a new `vision_player_tick_deltas` table (shared Postgres). Data-node queries this table, computes all stats/aggregations, returns display-ready values. Frontend is a thin render layer.

**Tech Stack:** Rust/Axum/sqlx (oracle — 1 migration + 1 INSERT), Rust/Axum/sqlx (data-node — endpoint), Next.js 14 (frontend)

**Spec:** `docs/superpowers/specs/2026-03-14-profile-page-design.md`

---

## Chunk 1: Oracle — One Migration + One INSERT

### Task 1: Create Table + Persist Tick Deltas

**Files:**
- Create: `oracle/migrations/004_create_player_tick_deltas.sql`
- Modify: `oracle/src/vision/tick_scheduler.rs` (add INSERT after balance application)

- [ ] **Step 1: Create migration**

```sql
-- oracle/migrations/004_create_player_tick_deltas.sql
CREATE TABLE IF NOT EXISTS vision_player_tick_deltas (
  batch_id         INTEGER NOT NULL,
  tick_id          INTEGER NOT NULL,
  player           TEXT NOT NULL,
  delta            TEXT NOT NULL,
  won              BOOLEAN NOT NULL,
  total_deposited  TEXT,              -- snapshot of vision_positions.total_deposited at this tick (for ROI after exit)
  resolved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, tick_id, player)
);
CREATE INDEX IF NOT EXISTS idx_vptd_player ON vision_player_tick_deltas(LOWER(player));
CREATE INDEX IF NOT EXISTS idx_vptd_player_resolved ON vision_player_tick_deltas(LOWER(player), resolved_at DESC);
CREATE INDEX IF NOT EXISTS idx_vptd_player_batch ON vision_player_tick_deltas(LOWER(player), batch_id, tick_id DESC);

-- Also add functional index on vision_positions for profile queries
CREATE INDEX IF NOT EXISTS idx_vp_lower_player ON vision_positions(LOWER(player));
```

Notes:
- Indexes use `LOWER(player)` because addresses are stored checksummed via `format!("{:?}", player)` but queries use lowercase.
- `total_deposited` column snapshots the player's deposit at each tick. When `vision_positions` is DELETEd on withdrawal, the deposit data survives here. The data-node reads `MAX(total_deposited)` per batch to compute exited-batch ROI.
- The `idx_vp_lower_player` index on `vision_positions` prevents full table scans on the active-positions query.

- [ ] **Step 2: Add INSERT after balance application**

In `tick_scheduler.rs`, find `apply_tick_balances_with_db`. Add the INSERT **inside the existing transaction** (if one exists from continuous betting), or wrap balance UPDATEs + delta INSERTs in `pool.begin()`/`tx.commit()`:

```rust
// Inside the transaction, after balance UPDATEs:
for pb in balances {
    let player_str = format!("{:?}", pb.player);
    // Read total_deposited from vision_positions (still exists at this point)
    let deposited: Option<String> = sqlx::query_scalar(
        "SELECT total_deposited FROM vision_positions WHERE batch_id = $1 AND player = $2"
    )
    .bind(batch_id as i64)
    .bind(&player_str)
    .fetch_optional(&mut *tx)
    .await
    .ok()
    .flatten();

    if let Err(e) = sqlx::query(
        "INSERT INTO vision_player_tick_deltas (batch_id, tick_id, player, delta, won, total_deposited, resolved_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (batch_id, tick_id, player) DO NOTHING"
    )
    .bind(batch_id as i64)
    .bind(tick_id as i64)
    .bind(&player_str)
    .bind(pb.delta.to_string())     // use pb.delta directly — already computed, already correct
    .bind(pb.delta > 0)
    .bind(deposited.as_deref())
    .execute(&mut *tx)
    .await {
        tracing::warn!(batch_id, tick_id, player = %player_str, error = %e, "Failed to persist tick delta");
    }
}
```

Notes:
- Uses `pb.delta` directly — the struct already has the computed `i128` delta, no need to recompute from `as_u128()`.
- Runs inside the same transaction as balance updates — if balances commit, deltas commit. No inconsistency.
- Failed INSERTs are logged (not silently swallowed) but don't abort the transaction — only the individual INSERT is skipped.
- `total_deposited` is read from `vision_positions` while the row still exists. This snapshot survives the position DELETE on withdrawal.
- `tick_id` must be in scope — pass from call site in `engine.rs`.

- [ ] **Step 3: Build and verify**

```bash
cd oracle && cargo build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add oracle/migrations/004_create_player_tick_deltas.sql oracle/src/vision/tick_scheduler.rs
git commit -m "feat(oracle): persist per-player tick deltas for profile page"
```

---

## Chunk 2: Data-Node — Profile Endpoint

### Task 2: Add Profile Endpoint

**Files:**
- Modify: `data-node/src/vision_api.rs` (handler + types)
- Modify: `data-node/src/api.rs` (register route)

- [ ] **Step 1: Add response types**

All values display-ready — dollars, percentages, pre-sorted. Frontend does zero arithmetic.

```rust
#[derive(Debug, Serialize)]
struct PlayerProfileResponse {
    stats: ProfileStats,
    batches: Vec<ProfileBatch>,
    #[serde(rename = "pnlHistory")]
    pnl_history: Vec<PnlPoint>,
}

#[derive(Debug, Serialize)]
struct ProfileStats {
    pnl: f64,
    #[serde(rename = "totalDeposited")]
    total_deposited: f64,
    roi: f64,
    #[serde(rename = "winRate")]
    win_rate: f64,
    #[serde(rename = "totalBatches")]
    total_batches: u64,
    #[serde(rename = "lastActiveAt")]
    last_active_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct ProfileBatch {
    #[serde(rename = "batchId")]
    batch_id: i64,
    #[serde(rename = "sourceId")]
    source_id: String,
    status: String,
    deposited: f64,
    balance: f64,
    #[serde(rename = "tickCount")]
    tick_count: i64,
    roi: f64,
    ticks: Vec<ProfileTick>,
}

#[derive(Debug, Serialize, Clone)]
struct ProfileTick {
    #[serde(rename = "tickId")]
    tick_id: i64,
    pnl: f64,
    won: bool,
}

#[derive(Debug, Serialize)]
struct PnlPoint {
    timestamp: String,
    pnl: f64,
}
```

- [ ] **Step 2: Implement handler**

Queries the new denormalized table — simple indexed scans, no JSONB expansion.

```rust
fn is_valid_eth_address(addr: &str) -> bool {
    addr.len() == 42 && addr.starts_with("0x") && addr[2..].chars().all(|c| c.is_ascii_hexdigit())
}

fn wei_to_dollars(wei: i128) -> f64 {
    wei as f64 / 1e18
}

#[derive(sqlx::FromRow)]
struct DeltaRow {
    batch_id: i64,
    tick_id: i64,
    delta: String,
    won: bool,
    total_deposited: Option<String>,  // snapshot from vision_positions at tick time
    resolved_at: chrono::DateTime<chrono::Utc>,
}

#[derive(sqlx::FromRow)]
struct PositionRow {
    batch_id: i64,
    balance: String,
    total_deposited: String,
}

async fn player_profile(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> impl IntoResponse {
    if !is_valid_eth_address(&address) {
        return (StatusCode::BAD_REQUEST, "Invalid address").into_response();
    }
    let addr = address.to_lowercase();

    // Q0: Total P&L across ALL ticks + per-batch deposit snapshots (no LIMIT — aggregate only)
    // This ensures stats are accurate even when Q1 is truncated to 5000
    let total_stats: Vec<(i64, String, Option<String>)> = sqlx::query_as(
        "SELECT batch_id, SUM(delta::numeric)::text as total_delta,
                MAX(total_deposited) as last_deposited
         FROM vision_player_tick_deltas
         WHERE LOWER(player) = $1
         GROUP BY batch_id"
    )
    .bind(&addr)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let batch_total_pnl: std::collections::HashMap<i64, i128> = total_stats.iter()
        .map(|(bid, delta, _)| (*bid, delta.parse::<i128>().unwrap_or(0)))
        .collect();
    let batch_deposited_snapshot: std::collections::HashMap<i64, i128> = total_stats.iter()
        .filter_map(|(bid, _, dep)| dep.as_ref().map(|d| (*bid, d.parse::<i128>().unwrap_or(0))))
        .collect();
    let batch_tick_count_total: std::collections::HashMap<i64, i64> = {
        let rows: Vec<(i64, i64)> = sqlx::query_as(
            "SELECT batch_id, COUNT(*) FROM vision_player_tick_deltas WHERE LOWER(player) = $1 GROUP BY batch_id"
        )
        .bind(&addr)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();
        rows.into_iter().collect()
    };

    // Q1: Tick deltas for chart + tick squares (most recent 5000)
    let deltas: Vec<DeltaRow> = sqlx::query_as(
        "SELECT batch_id, tick_id, delta, won, total_deposited, resolved_at
         FROM vision_player_tick_deltas
         WHERE LOWER(player) = $1
         ORDER BY resolved_at DESC
         LIMIT 5000"
    )
    .bind(&addr)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Q2: Active positions
    let positions: Vec<PositionRow> = sqlx::query_as(
        "SELECT batch_id, balance, total_deposited
         FROM vision_positions
         WHERE LOWER(player) = $1"
    )
    .bind(&addr)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    // Q3: Batch metadata (source_id)
    let batch_ids: Vec<i64> = {
        let mut ids: std::collections::HashSet<i64> = std::collections::HashSet::new();
        for d in &deltas { ids.insert(d.batch_id); }
        for p in &positions { ids.insert(p.batch_id); }
        ids.into_iter().collect()
    };
    let batch_meta: std::collections::HashMap<i64, String> = if !batch_ids.is_empty() {
        sqlx::query_as::<_, (i64, String)>(
            "SELECT id, COALESCE(source_id, '') FROM vision_batches WHERE id = ANY($1)"
        )
        .bind(&batch_ids)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .collect()
    } else {
        std::collections::HashMap::new()
    };

    let active_set: std::collections::HashSet<i64> = positions.iter().map(|p| p.batch_id).collect();

    // -- Group deltas by batch (i128 arithmetic) --
    let mut batch_ticks: std::collections::HashMap<i64, Vec<ProfileTick>> = std::collections::HashMap::new();
    let mut batch_tick_counts: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
    let mut batch_pnl_wei: std::collections::HashMap<i64, i128> = std::collections::HashMap::new();

    for d in &deltas {
        let delta_wei: i128 = d.delta.parse().unwrap_or(0);
        *batch_tick_counts.entry(d.batch_id).or_insert(0) += 1;
        *batch_pnl_wei.entry(d.batch_id).or_insert(0) += delta_wei;

        let ticks = batch_ticks.entry(d.batch_id).or_default();
        if ticks.len() < 60 {
            ticks.push(ProfileTick {
                tick_id: d.tick_id,
                pnl: wei_to_dollars(delta_wei),
                won: d.won,
            });
        }
    }
    for ticks in batch_ticks.values_mut() { ticks.reverse(); }

    // -- Build batches + stats --
    let mut total_deposited_wei: i128 = 0;
    let mut total_balance_wei: i128 = 0;
    let mut total_batches: u64 = 0;
    let mut winning_batches: u64 = 0;
    let mut batches: Vec<ProfileBatch> = Vec::new();

    // Active
    for pos in &positions {
        let dep: i128 = pos.total_deposited.parse().unwrap_or(0);
        let bal: i128 = pos.balance.parse().unwrap_or(0);
        total_deposited_wei += dep;
        total_balance_wei += bal;
        total_batches += 1;
        if bal > dep { winning_batches += 1; }

        let tc = batch_tick_counts.get(&pos.batch_id).copied().unwrap_or(0);
        let batch_roi = if dep > 0 { (bal - dep) as f64 / dep as f64 * 100.0 } else { 0.0 };

        batches.push(ProfileBatch {
            batch_id: pos.batch_id,
            source_id: batch_meta.get(&pos.batch_id).cloned().unwrap_or_default(),
            status: "active".to_string(),
            deposited: wei_to_dollars(dep),
            balance: wei_to_dollars(bal),
            tick_count: tc,
            roi: (batch_roi * 10.0).round() / 10.0,
            ticks: batch_ticks.remove(&pos.batch_id).unwrap_or_default(),
        });
    }

    // Exited (have deltas but no active position)
    // Use total P&L from Q0 (accurate, not truncated) and deposit snapshot for ROI
    for (bid, ticks) in batch_ticks {
        if active_set.contains(&bid) { continue; }
        let pnl_wei = batch_total_pnl.get(&bid).copied().unwrap_or(0);
        let dep_wei = batch_deposited_snapshot.get(&bid).copied().unwrap_or(0);
        let tc = batch_tick_count_total.get(&bid).copied().unwrap_or(0);
        total_batches += 1;
        total_deposited_wei += dep_wei;  // include exited deposits in global total
        if pnl_wei > 0 { winning_batches += 1; }

        let batch_roi = if dep_wei > 0 { pnl_wei as f64 / dep_wei as f64 * 100.0 } else { 0.0 };

        batches.push(ProfileBatch {
            batch_id: bid,
            source_id: batch_meta.get(&bid).cloned().unwrap_or_default(),
            status: "exited".to_string(),
            deposited: wei_to_dollars(dep_wei),
            balance: wei_to_dollars(dep_wei + pnl_wei),  // final = deposited + P&L
            tick_count: tc,
            roi: (batch_roi * 10.0).round() / 10.0,
            ticks,
        });
    }

    batches.sort_by(|a, b| {
        let sa = if a.status == "active" { 0 } else { 1 };
        let sb = if b.status == "active" { 0 } else { 1 };
        sa.cmp(&sb).then(b.tick_count.cmp(&a.tick_count))
    });

    // Stats — use Q0 totals (accurate across ALL ticks, not just the 5000 window)
    let total_pnl_wei: i128 = batch_total_pnl.values().sum();
    let roi = if total_deposited_wei > 0 { total_pnl_wei as f64 / total_deposited_wei as f64 * 100.0 } else { 0.0 };
    let win_rate = if total_batches > 0 { winning_batches as f64 / total_batches as f64 * 100.0 } else { 0.0 };

    // -- P&L history (hourly buckets, i128 running sum) --
    let mut pnl_history: Vec<PnlPoint> = Vec::new();
    if !deltas.is_empty() {
        let mut cumulative_wei: i128 = 0;
        let mut current_hour: Option<i64> = None;
        let mut hour_delta_wei: i128 = 0;

        for d in deltas.iter().rev() {
            let hour = d.resolved_at.timestamp() / 3600;
            let delta_wei: i128 = d.delta.parse().unwrap_or(0);

            if current_hour != Some(hour) {
                if let Some(h) = current_hour {
                    cumulative_wei += hour_delta_wei;
                    if let Some(dt) = chrono::DateTime::from_timestamp(h * 3600, 0) {
                        pnl_history.push(PnlPoint { timestamp: dt.to_rfc3339(), pnl: wei_to_dollars(cumulative_wei) });
                    }
                }
                current_hour = Some(hour);
                hour_delta_wei = delta_wei;
            } else {
                hour_delta_wei += delta_wei;
            }
        }
        if let Some(h) = current_hour {
            cumulative_wei += hour_delta_wei;
            if let Some(dt) = chrono::DateTime::from_timestamp(h * 3600, 0) {
                pnl_history.push(PnlPoint { timestamp: dt.to_rfc3339(), pnl: wei_to_dollars(cumulative_wei) });
            }
        }
        if pnl_history.len() > 200 {
            let step = pnl_history.len() / 200;
            pnl_history = pnl_history.into_iter().step_by(step).collect();
        }
    }

    let last_active = deltas.first().map(|d| d.resolved_at.to_rfc3339());

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

In `data-node/src/api.rs`, add:
```rust
.route("/vision/player/:address/profile", get(vision_api::player_profile))
```

- [ ] **Step 4: Build, test, commit**

```bash
cd data-node && cargo build 2>&1 | tail -20
curl -s "http://localhost:8200/vision/player/0x<known>/profile" | jq .
git add data-node/src/vision_api.rs data-node/src/api.rs
git commit -m "feat(data-node): player profile endpoint — stats, batches, P&L history"
```

---

## Chunk 3: Frontend — Profile Page

### Task 3: Proxy + Hook + Page Shell

**Files:**
- Create: `frontend/app/api/vision/player/[address]/profile/route.ts`
- Create: `frontend/hooks/usePlayerProfile.ts`
- Create: `frontend/components/domain/profile/ProfileHeader.tsx`
- Create: `frontend/components/domain/profile/ProfileTabs.tsx`
- Create: `frontend/app/[locale]/profile/[address]/page.tsx`

- [ ] **Step 1: Proxy route** — `AA_DATA_NODE_URL + /vision/player/${addr}/profile`, timeout 15s. Use `cache: 'no-store'` (no Next.js fetch cache — avoids unbounded memory from per-address cache entries). Set `Cache-Control: s-maxage=60, stale-while-revalidate=120` on the response instead, letting Vercel's CDN handle caching per URL.

- [ ] **Step 2: Hook** — `usePlayerProfile(address)`, TanStack Query, `staleTime: 60_000`, NO `refetchInterval` (profile data is historical, not live-polling).

- [ ] **Step 3: ProfileHeader** — avatar (initial from address), truncated address, last active, stats row. Values are pre-computed numbers — just format: `$${stats.pnl.toFixed(2)}`, `${stats.roi}%`.

- [ ] **Step 4: ProfileTabs** — Vision | Index, query param `?tab=`.

- [ ] **Step 5: Page route** — `Suspense` boundary, stats switch by tab.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/api/vision/player/ frontend/hooks/usePlayerProfile.ts frontend/components/domain/profile/ frontend/app/\[locale\]/profile/
git commit -m "feat(frontend): profile page shell — proxy, hook, header, tabs"
```

---

### Task 4: Vision Tab Components

**Files:**
- Create: `frontend/components/domain/profile/TickSquares.tsx`
- Create: `frontend/components/domain/profile/BatchTickRow.tsx`
- Create: `frontend/components/domain/profile/BatchTickHistory.tsx`
- Create: `frontend/components/domain/profile/PnlChart.tsx`
- Create: `frontend/components/domain/profile/VisionTab.tsx`

All values from API are already in dollars. Components just render.

- [ ] **Step 1: TickSquares** — 11x11px, 2px gap/radius. Quartile intensity from `tick.pnl` abs values. Green=won, red=lost. Tooltip: `Tick {id}: +$X.XX`.

- [ ] **Step 2: BatchTickRow** — sourceId + status badge (140px) | TickSquares (flex) | ROI (72px mono bold colored).

- [ ] **Step 3: BatchTickHistory** — headers + rows (pre-sorted by data-node) + legend.

- [ ] **Step 4: PnlChart** — recharts AreaChart. Time range filter (1D/1W/1M/ALL) filters `pnlHistory` by timestamp. Current value top-right.

- [ ] **Step 5: VisionTab** — PnlChart + BatchTickHistory. Empty: "No Vision history yet."

- [ ] **Step 6: Wire into page**, verify, commit.

```bash
git add frontend/components/domain/profile/
git commit -m "feat(frontend): Vision tab — P&L chart + tick squares"
```

---

### Task 5: Index Tab + Leaderboard Links

- [ ] **Step 1: IndexTab** — on-chain multicall for ITP balances. Holdings table. Empty state.

- [ ] **Step 2: Leaderboard links** — wrap addresses in `<Link href={'/profile/${addr}'}>` in VisionLeaderboard + TopPlayers.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/domain/profile/IndexTab.tsx frontend/components/domain/vision/
git commit -m "feat(frontend): Index tab + profile links from leaderboard"
```

---

### Task 6: Push

- [ ] **Step 1: Verify** — both tabs, chart, squares, mobile, tab switching.
- [ ] **Step 2: Push** — `git push mono main`
