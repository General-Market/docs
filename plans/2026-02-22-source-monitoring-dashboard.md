# Source Monitoring Dashboard & Historical Data Verification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a monitoring dashboard API + frontend panel to verify all 53 data sources work correctly, track historical data quality, failures, staleness, and data change frequency.

**Architecture:** New `/admin/sources` API endpoints on the data-node that query `market_prices` and `market_assets` tables for per-source health metrics. New frontend page `/sources` with a table of all sources showing live status, historical depth, failure rate, and data freshness. No new DB tables — everything derived from existing `market_prices`/`market_assets`.

**Tech Stack:** Rust (axum) backend endpoints, Next.js + React frontend, Tailwind CSS, existing DB schema.

---

## Task 1: Backend — Source Health API Endpoint

**Files:**
- Modify: `data-node/src/api.rs`

**What:** Add `GET /admin/sources/health` endpoint that returns per-source health metrics computed from DB.

**Response shape:**
```json
{
  "generated_at": "2026-02-22T16:00:00Z",
  "sources": [
    {
      "source_id": "crypto",
      "display_name": "CoinGecko Crypto",
      "sync_interval_secs": 60,
      "status": "healthy",
      "total_assets": 250,
      "active_assets": 248,
      "total_price_records": 145000,
      "oldest_record": "2026-02-20T10:00:00Z",
      "newest_record": "2026-02-22T15:59:30Z",
      "last_sync_age_secs": 30,
      "records_last_1h": 15000,
      "records_last_24h": 360000,
      "records_last_7d": 2520000,
      "zero_value_assets": 3,
      "stale_assets": 5,
      "avg_change_pct": 2.4,
      "assets_with_no_change_24h": 12,
      "sync_gap_max_secs": 180,
      "estimated_daily_records": 360000
    }
  ]
}
```

**SQL queries needed (all in one endpoint, batched):**

```sql
-- 1. Per-source asset counts
SELECT source, COUNT(*) as total, COUNT(*) FILTER (WHERE is_active) as active
FROM market_assets GROUP BY source;

-- 2. Per-source price record counts + oldest/newest
SELECT source,
  COUNT(*) as total_records,
  MIN(fetched_at) as oldest,
  MAX(fetched_at) as newest,
  COUNT(*) FILTER (WHERE fetched_at > NOW() - INTERVAL '1 hour') as last_1h,
  COUNT(*) FILTER (WHERE fetched_at > NOW() - INTERVAL '24 hours') as last_24h,
  COUNT(*) FILTER (WHERE fetched_at > NOW() - INTERVAL '7 days') as last_7d
FROM market_prices GROUP BY source;

-- 3. Per-source zero-value and stale asset counts
SELECT mp.source,
  COUNT(DISTINCT mp.asset_id) FILTER (WHERE mp.value = 0) as zero_value,
  COUNT(DISTINCT mp.asset_id) FILTER (
    WHERE mp.fetched_at < NOW() - INTERVAL '1 hour'
  ) as stale
FROM (
  SELECT DISTINCT ON (source, asset_id) source, asset_id, value, fetched_at
  FROM market_prices ORDER BY source, asset_id, fetched_at DESC
) mp
GROUP BY mp.source;

-- 4. Per-source avg absolute change_pct and no-change count
SELECT source,
  AVG(ABS(change_pct)) FILTER (WHERE change_pct IS NOT NULL) as avg_change,
  COUNT(DISTINCT asset_id) FILTER (
    WHERE change_pct IS NOT NULL AND ABS(change_pct) < 0.001
  ) as no_change_count
FROM (
  SELECT DISTINCT ON (source, asset_id) source, asset_id, change_pct
  FROM market_prices
  WHERE fetched_at > NOW() - INTERVAL '24 hours'
  ORDER BY source, asset_id, fetched_at DESC
) latest
GROUP BY source;

-- 5. Max sync gap per source (biggest gap between consecutive fetches)
-- This one is expensive, compute for last 6 hours only
SELECT source,
  MAX(gap_secs) as max_gap_secs
FROM (
  SELECT source, asset_id,
    EXTRACT(EPOCH FROM (fetched_at - LAG(fetched_at) OVER (
      PARTITION BY source, asset_id ORDER BY fetched_at
    ))) as gap_secs
  FROM market_prices
  WHERE fetched_at > NOW() - INTERVAL '6 hours'
) gaps
WHERE gap_secs IS NOT NULL
GROUP BY source;
```

**Step 1:** Add the handler function `admin_sources_health` to api.rs with all 5 queries.

**Step 2:** Register route: `.route("/admin/sources/health", get(admin_sources_health))`

**Step 3:** Test with `curl http://localhost:8200/admin/sources/health | python3 -m json.tool`

---

## Task 2: Backend — Per-Source Asset Detail Endpoint

**Files:**
- Modify: `data-node/src/api.rs`

**What:** Add `GET /admin/sources/:source_id/assets` — returns per-asset health for a specific source.

**Response shape:**
```json
{
  "source_id": "volcano",
  "assets": [
    {
      "asset_id": "volcano_kilauea_alert",
      "symbol": "VOLC/KILAUEA_ALERT",
      "name": "Kilauea Alert Level",
      "is_active": true,
      "latest_value": 2.0,
      "latest_fetched_at": "2026-02-22T15:50:00Z",
      "age_secs": 600,
      "total_records": 1440,
      "oldest_record": "2026-02-20T10:00:00Z",
      "value_changed_in_24h": true,
      "change_pct": 0.0,
      "is_zero": false,
      "is_stale": false
    }
  ]
}
```

**SQL:**
```sql
SELECT
  ma.asset_id, ma.symbol, ma.name, ma.is_active,
  latest.value, latest.fetched_at, latest.change_pct,
  counts.total_records, counts.oldest_record,
  prev.value as prev_value
FROM market_assets ma
LEFT JOIN LATERAL (
  SELECT value, fetched_at, change_pct
  FROM market_prices mp
  WHERE mp.source = ma.source AND mp.asset_id = ma.asset_id
  ORDER BY fetched_at DESC LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
  SELECT value
  FROM market_prices mp
  WHERE mp.source = ma.source AND mp.asset_id = ma.asset_id
    AND mp.fetched_at < NOW() - INTERVAL '24 hours'
  ORDER BY fetched_at DESC LIMIT 1
) prev ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) as total_records, MIN(fetched_at) as oldest_record
  FROM market_prices mp
  WHERE mp.source = ma.source AND mp.asset_id = ma.asset_id
) counts ON true
WHERE ma.source = $1
ORDER BY ma.symbol;
```

---

## Task 3: Backend — Source History Endpoint (Time Series)

**Files:**
- Modify: `data-node/src/api.rs`

**What:** Add `GET /admin/sources/:source_id/history?hours=24` — returns hourly record counts and avg values for the source over time. Used for the "data regularity" chart.

**Response shape:**
```json
{
  "source_id": "earthquake",
  "hours": 24,
  "buckets": [
    {
      "hour": "2026-02-22T15:00:00Z",
      "record_count": 120,
      "unique_assets": 20,
      "avg_value": 4.2,
      "zero_count": 0
    }
  ]
}
```

**SQL:**
```sql
SELECT
  date_trunc('hour', fetched_at) as hour,
  COUNT(*) as record_count,
  COUNT(DISTINCT asset_id) as unique_assets,
  AVG(value) as avg_value,
  COUNT(*) FILTER (WHERE value = 0) as zero_count
FROM market_prices
WHERE source = $1
  AND fetched_at > NOW() - ($2 || ' hours')::INTERVAL
GROUP BY date_trunc('hour', fetched_at)
ORDER BY hour;
```

---

## Task 4: Frontend — Source Monitoring Page

**Files:**
- Create: `frontend/app/sources/page.tsx`
- Create: `frontend/components/domain/SourceHealthTable.tsx`
- Create: `frontend/components/domain/SourceDetailModal.tsx`
- Create: `frontend/hooks/useSourceHealth.ts`

**What:** A `/sources` page with a table showing all sources, color-coded by health.

**Table columns:**
| Source | Status | Assets | Records | Oldest | Freshness | Zeros | Stale | Avg Change | Max Gap |
|--------|--------|--------|---------|--------|-----------|-------|-------|------------|---------|

**Color coding:**
- Green: healthy (last sync < 3x interval)
- Yellow: stale (last sync > 3x interval but < 10x)
- Red: dead (last sync > 10x interval or 0 records)
- Blue: zero values > 20% of assets

**Sorting:** Click column headers to sort. Default sort: status (red first, then yellow, then green).

**Click row:** Opens modal with per-asset detail table + hourly record count chart.

**Auto-refresh:** Poll `/admin/sources/health` every 30 seconds.

---

## Task 5: Frontend — Source Detail Modal with Charts

**Files:**
- Modify: `frontend/components/domain/SourceDetailModal.tsx`
- Create: `frontend/components/domain/SourceHistoryChart.tsx`

**What:** When clicking a source row, show:
1. **Asset table** — all assets for that source with value, age, change status
2. **Regularity chart** — bar chart of hourly record counts (last 24h)
3. **Failure indicators** — assets with zero values highlighted red, stale assets highlighted yellow

Use simple HTML/CSS bar chart (no chart library needed — just div bars with Tailwind height percentages).

---

## Task 6: Historical Data Verification Script

**Files:**
- Create: `scripts/verify-sources.sh`

**What:** A bash script that hits the health endpoint and prints a formatted report. Can be run manually or in CI.

```bash
#!/bin/bash
# Verify all data sources are healthy
DATA_NODE=${DATA_NODE_URL:-http://localhost:8200}

echo "=== Source Health Report ==="
echo ""

curl -sf "$DATA_NODE/admin/sources/health" | python3 -c "
import json, sys
data = json.load(sys.stdin)
sources = data['sources']

# Sort: red first, yellow, green
def sort_key(s):
    if s['status'] == 'dead': return 0
    if s['status'] == 'stale': return 1
    return 2

sources.sort(key=sort_key)

RED = '\033[91m'
YELLOW = '\033[93m'
GREEN = '\033[92m'
RESET = '\033[0m'
BOLD = '\033[1m'

print(f'{BOLD}{\"Source\":<25} {\"Status\":<10} {\"Assets\":<8} {\"Records\":<10} {\"Fresh\":<8} {\"Zeros\":<6} {\"MaxGap\":<8} {\"AvgChg%\":<8}{RESET}')
print('-' * 90)

for s in sources:
    color = GREEN if s['status'] == 'healthy' else (YELLOW if s['status'] == 'stale' else RED)
    print(f'{color}{s[\"source_id\"]:<25} {s[\"status\"]:<10} {s[\"active_assets\"]:<8} {s[\"total_price_records\"]:<10} {s[\"last_sync_age_secs\"]:<8} {s[\"zero_value_assets\"]:<6} {s[\"sync_gap_max_secs\"]:<8} {s.get(\"avg_change_pct\", 0):<8.2f}{RESET}')

dead = [s for s in sources if s['status'] == 'dead']
stale = [s for s in sources if s['status'] == 'stale']
healthy = [s for s in sources if s['status'] == 'healthy']

print()
print(f'Total: {len(sources)} sources | {GREEN}Healthy: {len(healthy)}{RESET} | {YELLOW}Stale: {len(stale)}{RESET} | {RED}Dead: {len(dead)}{RESET}')
"
```

---

## Execution Strategy

**3 parallel agents (max per CLAUDE.md):**

| Agent | Tasks | Description |
|-------|-------|-------------|
| **A** | Tasks 1-3 | Backend: 3 new API endpoints in api.rs |
| **B** | Task 4 | Frontend: source monitoring page + table + hook |
| **C** | Tasks 5-6 | Frontend: detail modal + chart + verification script |

Agent B depends on Agent A's response shape (but can scaffold with mock data).
Agent C depends on Agent B's modal component (but can work on chart + script independently).

**Sequence:** Launch A+B in parallel. When A completes, launch C. Final step: integration test.
