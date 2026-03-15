# Social Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Two-part system: (1) Python MCP server on VPS that detects anomalies and exposes investigation tools, (2) Local `/loop` on Mac that reviews anomalies, writes tweets to `scheduled.csv`, and a local poster script that reads the CSV and posts to X using local credentials.

**Architecture:**
- **VPS**: Python MCP server with direct PostgreSQL access. Anomaly detection every 2 min. Serves investigation tools (search, history, frequency, compare). NO Twitter credentials, NO posting.
- **Local Mac**: Claude Code `/loop` every 10 min calls MCP tools, writes approved tweets to `social-bot/scheduled.csv`. Each account has a `social-bot/directives/{account}.md` file defining its tone/rules. A separate local script `poster.py` watches `scheduled.csv` and posts via tweepy with local credentials in `social-bot/.twitter-creds.json`.

**Tech Stack:** Python 3.11+, `mcp` (Model Context Protocol SDK), `psycopg2` (PostgreSQL), `pyyaml` (VPS). `tweepy` (Twitter API v2) on Mac only for `poster.py`.

```
VPS (MCP server)                     Local Mac
┌────────────────────┐               ┌─────────────────────────────┐
│ PostgreSQL         │               │ Claude Code /loop 10min     │
│ ↕                  │  SSH stdio    │ ├─ calls MCP tools (VPS)    │
│ Anomaly detector   │◄────────────►│ ├─ reads directives/*.md    │
│ Investigation tools│               │ ├─ writes scheduled.csv     │
│ (no Twitter creds) │               │ └─ NO posting               │
└────────────────────┘               │                             │
                                     │ poster.py (background)      │
                                     │ ├─ watches scheduled.csv    │
                                     │ ├─ reads .twitter-creds.json│
                                     │ ├─ posts to X via tweepy    │
                                     │ └─ marks rows as posted     │
                                     └─────────────────────────────┘
```

**Design doc:** `docs/plans/2026-03-10-social-bot-design.md`

---

### Task 1: Project Scaffold

**Files:**
- Create: `social-bot/requirements.txt`
- Create: `social-bot/.env.example`
- Create: `social-bot/db.py`

**Step 1: Create requirements.txt**

```
mcp>=1.0.0
psycopg2-binary>=2.9.9
pyyaml>=6.0
python-dotenv>=1.0.0
```

Note: `tweepy` is only needed on the Mac for `poster.py`, not on the VPS. Install locally with `pip install tweepy`.

**Step 2: Create .env.example**

```
DATABASE_URL=postgres://max@localhost:5432/index_prices
```

Twitter credentials are stored locally in `social-bot/.twitter-creds.json` on the Mac (see Task 6). The VPS has NO Twitter credentials.

**Step 3: Create db.py — PostgreSQL connection**

```python
import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def query(sql, params=None):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()

def query_one(sql, params=None):
    rows = query(sql, params)
    return rows[0] if rows else None

def execute(sql, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
```

**Step 4: Test DB connection from VPS**

```bash
cd /home/max/social-bot
pip install -r requirements.txt
python -c "import db; print(db.query_one('SELECT COUNT(*) as c FROM market_prices_latest'))"
```
Expected: `{'c': <some number in the thousands>}`

**Step 5: Commit**

```bash
git add social-bot/
git commit -m "feat(social-bot): project scaffold with DB connection"
```

---

### Task 2: Local State Tables

**Files:**
- Create: `social-bot/migrate.py`

**Step 1: Create migrate.py — sets up social bot's own tables in the same PostgreSQL**

```python
import db

MIGRATIONS = [
    """
    CREATE TABLE IF NOT EXISTS social_anomalies (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        asset_id TEXT,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        raw_data JSONB NOT NULL,
        context JSONB DEFAULT '{}',
        suggested_account TEXT,
        suggested_headline TEXT,
        suggested_outcome TEXT,
        status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, skipped, posted
        final_tweet TEXT,
        outcome_tag TEXT,
        virality_score INT,
        skip_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS social_posted (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        account TEXT NOT NULL,
        tweet_text TEXT NOT NULL,
        tweet_id TEXT,
        outcome_tag TEXT,
        virality_score INT,
        dedup_key TEXT,
        posted_at TIMESTAMPTZ DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS social_event_log (
        id SERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        event_type TEXT NOT NULL,
        region TEXT,
        value DECIMAL(30,10),
        occurred_at TIMESTAMPTZ NOT NULL,
        asset_id TEXT,
        metadata JSONB DEFAULT '{}'
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_anomalies_status ON social_anomalies(status)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_posted_account ON social_posted(account, posted_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_posted_dedup ON social_posted(dedup_key)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_event_log_source ON social_event_log(source, occurred_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_social_event_log_type ON social_event_log(source, event_type, occurred_at DESC)
    """,
]

def migrate():
    for sql in MIGRATIONS:
        db.execute(sql)
    print(f"Ran {len(MIGRATIONS)} migrations")

if __name__ == "__main__":
    migrate()
```

**Step 2: Run migration**

```bash
python migrate.py
```
Expected: `Ran 7 migrations`

**Step 3: Commit**

```bash
git add social-bot/migrate.py
git commit -m "feat(social-bot): local state tables for anomalies, posted tweets, event log"
```

---

### Task 3: Threshold Config + Parser

**Files:**
- Create: `social-bot/thresholds.yaml`
- Create: `social-bot/engine/thresholds.py`

**Step 1: Create thresholds.yaml**

Start with 5 high-value sources (expand later). Copy the full threshold definitions from `docs/plans/2026-03-10-social-bot-design.md` section "thresholds.yaml Structure". Start with these sources:

- earthquake
- power_outages
- ioda
- spaceweather
- sec

Keep the exact YAML structure from the design doc. Other sources will be added incrementally.

**Step 2: Create engine/thresholds.py — rule parser**

```python
import yaml
from pathlib import Path

def load_thresholds():
    path = Path(__file__).parent.parent / "thresholds.yaml"
    with open(path) as f:
        return yaml.safe_load(f)

def evaluate_rules(source_config, data: dict) -> dict | None:
    """Evaluate threshold rules against data. Returns first matching rule or None."""
    for rule in source_config.get("rules", []):
        condition = rule["condition"]
        if _eval_condition(condition, data):
            return {
                "outcome": rule["outcome"],
                "context_priority": rule.get("context", []),
            }
    return None

def _eval_condition(condition: str, data: dict) -> bool:
    """Simple condition evaluator. Supports: >=, <=, >, <, ==, AND, OR.
    Variables are looked up in data dict."""
    # Handle AND/OR
    if " AND " in condition:
        parts = condition.split(" AND ")
        return all(_eval_condition(p.strip(), data) for p in parts)
    if " OR " in condition:
        parts = condition.split(" OR ")
        return any(_eval_condition(p.strip(), data) for p in parts)

    # Handle comparison operators
    for op in [">=", "<=", "!=", "==", ">", "<"]:
        if op in condition:
            left, right = condition.split(op, 1)
            left = left.strip()
            right = right.strip()
            left_val = data.get(left, left)
            try:
                left_val = float(left_val)
                right_val = float(right)
            except (ValueError, TypeError):
                right_val = right
                left_val = data.get(left, left)
            ops = {
                ">=": lambda a, b: a >= b,
                "<=": lambda a, b: a <= b,
                ">": lambda a, b: a > b,
                "<": lambda a, b: a < b,
                "==": lambda a, b: a == b,
                "!=": lambda a, b: a != b,
            }
            return ops[op](left_val, right_val)

    # Boolean field check
    return bool(data.get(condition, False))
```

**Step 3: Test threshold parser**

```bash
python -c "
from engine.thresholds import load_thresholds, evaluate_rules
t = load_thresholds()
result = evaluate_rules(t['earthquake'], {'magnitude': 6.2, 'population_nearby': 1000000})
print(result)
"
```
Expected: `{'outcome': 'WATCH', 'context_priority': ['frequency', 'comparison']}`

**Step 4: Commit**

```bash
git add social-bot/thresholds.yaml social-bot/engine/
git commit -m "feat(social-bot): threshold YAML config + rule parser"
```

---

### Task 4: Context Computation Engine

**Files:**
- Create: `social-bot/engine/__init__.py`
- Create: `social-bot/engine/context.py`

**Step 1: Create engine/context.py**

```python
import db
from datetime import datetime, timedelta

def compute_context(source: str, asset_id: str, current_value: float, context_priority: list[str]) -> dict:
    """Compute context fields based on priority list from threshold rules."""
    context = {}
    for field in context_priority:
        if field == "frequency":
            context["frequency"] = _compute_frequency(source, asset_id)
        elif field == "comparison":
            context["comparison"] = _compute_comparison(source, asset_id, current_value)
        elif field == "trend":
            context["trend"] = _compute_trend(source, asset_id)
        elif field == "delta":
            context["delta"] = _compute_delta(source, asset_id, current_value)
        elif field == "human_scale":
            context["human_scale"] = None  # Populated from raw_data metadata
    return {k: v for k, v in context.items() if v is not None}

def _compute_frequency(source: str, asset_id: str) -> str | None:
    """How many similar events in the last 7 days."""
    row = db.query_one("""
        SELECT COUNT(*) as cnt FROM social_event_log
        WHERE source = %s AND event_type = %s
        AND occurred_at > NOW() - INTERVAL '7 days'
    """, (source, asset_id))
    if row and row["cnt"] > 1:
        n = row["cnt"]
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n if n < 4 else 0, "th")
        return f"{n}{suffix} this week"
    return None

def _compute_comparison(source: str, asset_id: str, current_value: float) -> str | None:
    """When was the last time the value was this high/low."""
    row = db.query_one("""
        SELECT MAX(fetched_at) as last_time FROM market_prices
        WHERE source = %s AND asset_id = %s AND value >= %s
        AND fetched_at < NOW() - INTERVAL '30 days'
    """, (source, asset_id, current_value))
    if row and row["last_time"]:
        return f"highest since {row['last_time'].strftime('%B %Y')}"
    # Check if it's an all-time high in our data
    row2 = db.query_one("""
        SELECT MAX(value) as max_val FROM market_prices
        WHERE source = %s AND asset_id = %s
    """, (source, asset_id))
    if row2 and row2["max_val"] and current_value > float(row2["max_val"]):
        return "all-time high in our records"
    return None

def _compute_trend(source: str, asset_id: str) -> str | None:
    """Consecutive days of increase/decrease."""
    rows = db.query("""
        SELECT DATE(fetched_at) as day, AVG(value) as avg_val
        FROM market_prices
        WHERE source = %s AND asset_id = %s
        AND fetched_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(fetched_at)
        ORDER BY day DESC
        LIMIT 30
    """, (source, asset_id))
    if len(rows) < 2:
        return None
    direction = "rising" if rows[0]["avg_val"] > rows[1]["avg_val"] else "falling"
    streak = 1
    for i in range(1, len(rows) - 1):
        if direction == "rising" and rows[i]["avg_val"] > rows[i+1]["avg_val"]:
            streak += 1
        elif direction == "falling" and rows[i]["avg_val"] < rows[i+1]["avg_val"]:
            streak += 1
        else:
            break
    if streak >= 3:
        return f"{direction} for {streak} consecutive days"
    return None

def _compute_delta(source: str, asset_id: str, current_value: float) -> str | None:
    """Percentage change vs 30-day average."""
    row = db.query_one("""
        SELECT AVG(value) as avg_30d FROM market_prices
        WHERE source = %s AND asset_id = %s
        AND fetched_at > NOW() - INTERVAL '30 days'
    """, (source, asset_id))
    if row and row["avg_30d"] and float(row["avg_30d"]) > 0:
        pct = ((current_value - float(row["avg_30d"])) / float(row["avg_30d"])) * 100
        if abs(pct) >= 50:
            direction = "above" if pct > 0 else "below"
            return f"{abs(pct):.0f}% {direction} 30-day average"
    return None
```

**Step 2: Create engine/__init__.py (empty)**

```bash
touch social-bot/engine/__init__.py
```

**Step 3: Test context computation**

```bash
python -c "
from engine.context import compute_context
# Pick a real source/asset from the DB
import db
row = db.query_one('SELECT source, asset_id, value FROM market_prices_latest LIMIT 1')
print(f'Testing with: {row}')
ctx = compute_context(row['source'], row['asset_id'], float(row['value']), ['comparison', 'delta', 'trend'])
print(f'Context: {ctx}')
"
```

**Step 4: Commit**

```bash
git add social-bot/engine/
git commit -m "feat(social-bot): context computation engine (frequency, comparison, trend, delta)"
```

---

### Task 5: Anomaly Detector

**Files:**
- Create: `social-bot/engine/detector.py`
- Create: `social-bot/engine/dedup.py`

**Step 1: Create engine/dedup.py**

```python
import db

def is_duplicate(dedup_key: str) -> bool:
    """Check if we already posted a tweet with this dedup key."""
    row = db.query_one(
        "SELECT 1 FROM social_posted WHERE dedup_key = %s", (dedup_key,)
    )
    return row is not None

def is_pending(dedup_key: str) -> bool:
    """Check if there's already a pending anomaly with this dedup key."""
    row = db.query_one(
        "SELECT 1 FROM social_anomalies WHERE id LIKE %s AND status = 'pending'",
        (f"%{dedup_key}%",)
    )
    return row is not None
```

**Step 2: Create engine/detector.py**

```python
import json
import uuid
from datetime import datetime
import db
from engine.thresholds import load_thresholds, evaluate_rules
from engine.context import compute_context
from engine.dedup import is_duplicate, is_pending

def run_detection():
    """Main detection loop. Scans market_prices_latest against thresholds."""
    thresholds = load_thresholds()
    candidates = []

    for source_name, source_config in thresholds.items():
        source_candidates = _detect_source(source_name, source_config)
        candidates.extend(source_candidates)

    return candidates

def _detect_source(source_name: str, config: dict) -> list[dict]:
    """Detect anomalies for a single source."""
    # Map source_name to actual DB source IDs
    # Some thresholds cover multiple DB sources (e.g., transit covers mta_subway, tfl_tube, etc.)
    db_sources = config.get("sources", [source_name])
    candidates = []

    for db_source in db_sources:
        rows = db.query("""
            SELECT asset_id, symbol, name, value, change_pct, volume_24h,
                   market_cap, category, fetched_at
            FROM market_prices_latest
            WHERE source = %s
        """, (db_source,))

        for row in rows:
            data = _row_to_eval_data(row, db_source, config)
            match = evaluate_rules(config, data)
            if match is None:
                continue

            # Build dedup key
            dedup_template = config.get("dedup", "source+asset+day")
            dedup_key = _build_dedup_key(dedup_template, db_source, row)

            if is_duplicate(dedup_key) or is_pending(dedup_key):
                continue

            # Compute context
            context = compute_context(
                db_source, row["asset_id"], float(row["value"]),
                match.get("context_priority", [])
            )

            # Log event
            db.execute("""
                INSERT INTO social_event_log (source, event_type, region, value, occurred_at, asset_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (db_source, row["asset_id"], row.get("category"), row["value"], datetime.utcnow(), row["asset_id"]))

            candidate_id = f"{db_source}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:4]}"
            account = config.get("account", "GeneralMarket")

            candidate = {
                "id": candidate_id,
                "source": db_source,
                "asset_id": row["asset_id"],
                "raw_data": {
                    "symbol": row["symbol"],
                    "name": row["name"],
                    "value": str(row["value"]),
                    "change_pct": str(row["change_pct"]) if row["change_pct"] else None,
                    "volume_24h": str(row["volume_24h"]) if row["volume_24h"] else None,
                    "market_cap": str(row["market_cap"]) if row["market_cap"] else None,
                    "category": row["category"],
                },
                "context": context,
                "suggested_account": account,
                "suggested_headline": _generate_suggestion(db_source, row, context, match["outcome"]),
                "suggested_outcome": match["outcome"],
            }

            # Store in DB
            db.execute("""
                INSERT INTO social_anomalies (id, source, asset_id, raw_data, context,
                    suggested_account, suggested_headline, suggested_outcome)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                candidate_id, db_source, row["asset_id"],
                json.dumps(candidate["raw_data"]), json.dumps(context),
                account, candidate["suggested_headline"], match["outcome"]
            ))

            candidates.append(candidate)

    return candidates

def _row_to_eval_data(row: dict, source: str, config: dict) -> dict:
    """Convert a DB row + source metadata into a flat dict for rule evaluation."""
    data = {
        "value": float(row["value"]),
        "change_pct": float(row["change_pct"]) if row["change_pct"] else 0,
        "volume_24h": float(row["volume_24h"]) if row["volume_24h"] else 0,
        "market_cap": float(row["market_cap"]) if row["market_cap"] else 0,
    }
    # Source-specific field mapping
    # These map source-specific semantics to threshold condition fields
    # e.g., earthquake stores magnitude in "value", power_outages stores customer count in "value"
    field_map = {
        "earthquake": {"magnitude": "value"},
        "power_outages": {"customers": "value"},
        "ioda": {"connectivity": "value"},
        "spaceweather": {"kp": "value"},
        "wildfire": {"hotspots_6h": "value"},
        "sec": {"trade_value": "value"},
        "finra": {"short_volume_pct": "value"},
        "mcbroken": {"city_pct": "value"},
    }
    if source in field_map:
        for alias, field in field_map[source].items():
            data[alias] = data.get(field, data.get("value", 0))
    return data

def _build_dedup_key(template: str, source: str, row: dict) -> str:
    """Build dedup key from template like 'region+day' or 'source+asset+day'."""
    parts = template.split("+")
    key_parts = []
    for part in parts:
        if part == "source":
            key_parts.append(source)
        elif part == "day":
            key_parts.append(datetime.utcnow().strftime("%Y-%m-%d"))
        elif part == "week":
            key_parts.append(datetime.utcnow().strftime("%Y-W%W"))
        elif part == "month":
            key_parts.append(datetime.utcnow().strftime("%Y-%m"))
        elif part == "asset":
            key_parts.append(row.get("asset_id", ""))
        elif part == "region":
            key_parts.append(row.get("category", ""))
        else:
            key_parts.append(row.get(part, part))
    return ":".join(key_parts)

def _generate_suggestion(source: str, row: dict, context: dict, outcome: str) -> str:
    """Generate a basic headline suggestion. Claude will rewrite this."""
    name = row.get("name") or row.get("symbol") or row.get("asset_id")
    value = row["value"]
    ctx_parts = [v for v in context.values() if v]
    ctx_str = " — ".join(ctx_parts) if ctx_parts else ""
    return f"[{outcome}] {source}: {name} at {value}. {ctx_str}".strip()
```

**Step 3: Test detector with real data**

```bash
python -c "
from engine.detector import run_detection
candidates = run_detection()
print(f'Found {len(candidates)} anomalies')
for c in candidates[:3]:
    print(f'  [{c[\"suggested_outcome\"]}] {c[\"source\"]}: {c[\"suggested_headline\"][:80]}')
"
```

**Step 4: Commit**

```bash
git add social-bot/engine/
git commit -m "feat(social-bot): anomaly detector with threshold evaluation + dedup"
```

---

### Task 6: Local Poster + Directives + Credentials (runs on Mac, NOT VPS)

**Files:**
- Create: `social-bot/poster.py`
- Create: `social-bot/.twitter-creds.example.json`
- Create: `social-bot/scheduled.csv` (empty with header)
- Create: `social-bot/directives/GeneralInsiders.md`
- Create: `social-bot/directives/GeneralGridDown.md`
- Create: `social-bot/directives/GeneralSkyWatch.md`
- Create: `social-bot/directives/GeneralTaxReceipt.md`
- Create: `social-bot/directives/GeneralGlitch.md`

**Step 1: Create .twitter-creds.example.json**

```json
{
  "GeneralInsiders": {
    "api_key": "...",
    "api_secret": "...",
    "access_token": "...",
    "access_secret": "..."
  },
  "GeneralGridDown": {
    "api_key": "...",
    "api_secret": "...",
    "access_token": "...",
    "access_secret": "..."
  },
  "GeneralSkyWatch": {
    "api_key": "...",
    "api_secret": "...",
    "access_token": "...",
    "access_secret": "..."
  },
  "GeneralTaxReceipt": {
    "api_key": "...",
    "api_secret": "...",
    "access_token": "...",
    "access_secret": "..."
  },
  "GeneralGlitch": {
    "api_key": "...",
    "api_secret": "...",
    "access_token": "...",
    "access_secret": "..."
  },
  "GeneralMarket": {
    "api_key": "...",
    "api_secret": "...",
    "access_token": "...",
    "access_secret": "..."
  }
}
```

Add `.twitter-creds.json` to `.gitignore`.

**Step 2: Create scheduled.csv with header**

```csv
id,account,tweet_text,outcome_tag,virality_score,scheduled_at,status
```

Format:
- `id`: anomaly ID from VPS DB
- `account`: GeneralInsiders, GeneralGridDown, etc.
- `tweet_text`: final tweet text (max 280 chars, CSV-escaped)
- `outcome_tag`: FEAR/LOOK/MONEY/RAGE/WTF/WATCH/RECORD
- `virality_score`: 1-10
- `scheduled_at`: ISO timestamp when Claude Code wrote it
- `status`: `pending` (written by /loop), `posted` (marked by poster.py), `failed` (posting error)

**Step 3: Create poster.py — local background script**

```python
#!/usr/bin/env python3
"""
Local poster script. Watches scheduled.csv and posts pending tweets to X.
Runs on Mac only. Reads credentials from .twitter-creds.json.
"""

import csv
import json
import time
import sys
from datetime import datetime, timedelta
from pathlib import Path

import tweepy

SCRIPT_DIR = Path(__file__).parent
CREDS_FILE = SCRIPT_DIR / ".twitter-creds.json"
CSV_FILE = SCRIPT_DIR / "scheduled.csv"
MIN_SPACING_SECS = 1800  # 30 min between posts per account
MAX_DAILY = 15

# Track last post time per account
_last_posted: dict[str, datetime] = {}
_daily_counts: dict[str, int] = {}
_daily_reset: str = ""


def load_creds() -> dict:
    with open(CREDS_FILE) as f:
        return json.load(f)


def get_client(account: str, creds: dict) -> tweepy.Client:
    c = creds[account]
    return tweepy.Client(
        consumer_key=c["api_key"],
        consumer_secret=c["api_secret"],
        access_token=c["access_token"],
        access_token_secret=c["access_secret"],
    )


def can_post(account: str, outcome_tag: str) -> tuple[bool, str]:
    global _daily_counts, _daily_reset

    # Reset daily counts at midnight
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if today != _daily_reset:
        _daily_counts = {}
        _daily_reset = today

    # Daily limit
    if _daily_counts.get(account, 0) >= MAX_DAILY:
        return False, f"Daily limit ({MAX_DAILY}) reached for {account}"

    # Spacing (FEAR bypasses)
    if outcome_tag != "FEAR" and account in _last_posted:
        elapsed = (datetime.utcnow() - _last_posted[account]).total_seconds()
        if elapsed < MIN_SPACING_SECS:
            wait = int(MIN_SPACING_SECS - elapsed)
            return False, f"Too soon for {account}, wait {wait}s"

    return True, ""


def read_csv() -> list[dict]:
    if not CSV_FILE.exists():
        return []
    with open(CSV_FILE, newline="") as f:
        return list(csv.DictReader(f))


def write_csv(rows: list[dict]):
    if not rows:
        return
    fieldnames = ["id", "account", "tweet_text", "outcome_tag", "virality_score", "scheduled_at", "status"]
    with open(CSV_FILE, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def run_once(creds: dict):
    rows = read_csv()
    if not rows:
        return

    changed = False
    for row in rows:
        if row.get("status") != "pending":
            continue

        account = row["account"]
        outcome_tag = row.get("outcome_tag", "")
        tweet_text = row["tweet_text"]

        ok, reason = can_post(account, outcome_tag)
        if not ok:
            print(f"[skip] {reason}")
            continue

        try:
            client = get_client(account, creds)
            response = client.create_tweet(text=tweet_text)
            tweet_id = response.data["id"]
            row["status"] = "posted"
            _last_posted[account] = datetime.utcnow()
            _daily_counts[account] = _daily_counts.get(account, 0) + 1
            print(f"[posted] @{account}: {tweet_text[:60]}... (id: {tweet_id})")
            changed = True
        except Exception as e:
            row["status"] = "failed"
            print(f"[error] @{account}: {e}")
            changed = True

    if changed:
        write_csv(rows)


def main():
    if not CREDS_FILE.exists():
        print(f"Missing {CREDS_FILE} — copy from .twitter-creds.example.json and fill in keys")
        sys.exit(1)

    creds = load_creds()
    print(f"[poster] Watching {CSV_FILE} (polling every 30s)")
    print(f"[poster] Loaded credentials for: {', '.join(creds.keys())}")

    while True:
        try:
            run_once(creds)
        except Exception as e:
            print(f"[poster] Error: {e}")
        time.sleep(30)


if __name__ == "__main__":
    main()
```

**Step 4: Create directives for each account**

Create `social-bot/directives/GeneralInsiders.md`:

```markdown
# @GeneralInsiders — Insider Trading & Short Interest

## Sources
- sec (insider trades, 13F filings)
- finra (short interest, dark pool volume)
- congress (congressional trades, STOCK Act disclosures)

## Tone
Cold, factual, slightly menacing. You're the person who noticed what insiders are doing before anyone else. Think: forensic accountant who tweets.

## Rules
- ALWAYS name the insider (CEO, CFO, director — never generic "insider")
- ALWAYS include dollar amount and % of holdings
- Cluster detection is your superpower: "3 directors sold in 2 weeks" > "1 director sold"
- Congress trades: name the member, the committee they sit on, and the irony if applicable
- Short interest: only post if short volume is extreme (>50% of float) or changed dramatically
- NEVER give financial advice. State facts. Let people draw conclusions.
- Preferred outcomes: MONEY, WATCH, WTF

## Examples
- "Pfizer CEO sold $5.6M in stock — 3rd C-suite sale this month. Combined: $18M out the door."
- "Sen. Tuberville bought $250K in defense stocks. He sits on Armed Services Committee. 4th defense buy this quarter."
- "AMC short interest hit 38% of float — highest since the Jan 2021 squeeze. 12% jump in one week."
```

Create `social-bot/directives/GeneralGridDown.md`:

```markdown
# @GeneralGridDown — Infrastructure Failures

## Sources
- power_outages (US utility outages)
- ioda (internet connectivity, country-level shutdowns)
- faa_delays (flight delays, ground stops)
- transit group (mta_subway, tfl_tube, sbb, sncf, db_train)
- cbp_border (border wait times)
- nrc_nuclear (nuclear plant events)

## Tone
Urgent but measured. You're the infrastructure watchdog. When systems fail, you're the first to connect the dots. Think: emergency dispatcher who's also a data analyst.

## Rules
- ALWAYS include number of people affected (customers, passengers, travelers)
- Power: state + utility name + customer count. Cluster grid failures ("3rd state this week")
- Internet: country name + connectivity % drop. Autocracies shutting down = RAGE, infrastructure failure = WATCH
- Flights: airport code + delay count + cascade potential ("DFW ground stop, 400+ flights, ripple expected")
- Transit: system name + line + delay magnitude vs normal
- FEAR tweets for active infrastructure emergencies (power out in extreme heat/cold)
- Preferred outcomes: FEAR, WATCH, RECORD

## Examples
- "200K Texans without power in 108°F heat — same grid they 'fixed' after 2021. 4th major failure this year."
- "Internet connectivity in Pakistan dropped 62% in the last hour. No official statement. 3rd shutdown in 6 weeks."
- "Every NYC subway line is delayed right now. All 26. Last time this happened: February 2024."
```

Create `social-bot/directives/GeneralSkyWatch.md`:

```markdown
# @GeneralSkyWatch — Natural Events & Space Weather

## Sources
- earthquake (USGS global seismic data)
- volcano (Smithsonian GVP eruption data)
- spaceweather (solar flares, geomagnetic storms, Kp index)
- wildfire (NASA FIRMS hotspots)
- airnow (US air quality index)
- weather_alerts (NWS severe weather)
- epidemic (WHO disease outbreak news)

## Tone
Awe-struck data nerd. You love the scale of nature and space. Dramatic but grounded in numbers. Think: Neil deGrasse Tyson meets a seismologist.

## Rules
- Earthquakes: magnitude + location + depth + population within 100km. Frequency context is king ("3rd M5+ in Turkey this week")
- Solar: Kp index + aurora visibility latitude + what it means for GPS/radio ("visible as far south as New York")
- Wildfire: hotspot count + growth rate ("doubled in 6 hours") + air quality cascade
- AQI: city + AQI value + category + how it compares to normal. "Unhealthy" is baseline, only post "Very Unhealthy" or worse unless unusual
- Volcanoes: eruption VEI + ash plume height + flight impact
- LOOK outcome for aurora/visual events, FEAR for earthquakes near population
- Preferred outcomes: LOOK, FEAR, RECORD, WATCH

## Examples
- "Kp 8 geomagnetic storm in progress. Aurora visible as far south as 40°N tonight. Strongest storm since May 2024. Go outside and look north."
- "3rd M5+ earthquake in Turkey this week. The Anatolian fault hasn't been this active since 2019. Our data shows a clear acceleration."
- "Air quality in Sacramento hit 287 (Very Unhealthy) — wildfire smoke from the Dixie complex. 400% above 30-day average. Stay inside."
```

Create `social-bot/directives/GeneralTaxReceipt.md`:

```markdown
# @GeneralTaxReceipt — Government & Economy

## Sources
- usa_spending (federal contract awards, grant spending)
- courtlistener (federal court rulings)
- zillow (housing market, rent indices)
- fred_treasury (treasury yields, economic indicators)
- congress (legislative activity — shared with Insiders for trade angle)

## Tone
Dry, sardonic, taxpayer-advocate. You find the absurd in government spending and the unjust in court rulings. Think: auditor with a Twitter account.

## Rules
- Spending: contractor name + amount + what for. Highlight waste, repeats, no-bid contracts
- Courts: ruling summary + judge + impact scope. Focus on precedent-setting or broadly impactful
- Housing: city/metro + price/rent change + vs income. Human scale ("average nurse can't afford average apartment")
- Treasury: yield level + inversion status + what it signals historically
- RAGE for waste/hypocrisy, MONEY for things that affect everyone's wallet
- Preferred outcomes: RAGE, MONEY, RECORD

## Examples
- "$47M federal contract to a company with 3 employees. For 'consulting services.' This is your money."
- "Average rent in Austin just passed $2,100/month — up 34% in 2 years. Average local salary: $52K. Do the math."
- "2Y/10Y yield curve has been inverted for 14 months straight. Last time it lasted this long: 1980."
```

Create `social-bot/directives/GeneralGlitch.md`:

```markdown
# @GeneralGlitch — The Weird Data

## Sources
- mcbroken (McDonald's ice cream machine status)
- queue_times (theme park wait times)
- steam (Steam player counts, game launches)
- twitch (viewer counts, category trends)
- reddit (subreddit activity spikes)
- hackernews (trending stories, score anomalies)
- github_npm_pypi (package download spikes, trending repos)
- shelter (animal shelter intake/adoption rates)
- sports (odds movements, upset predictions)

## Tone
Amused, curious, slightly chaotic. You find the signal in noise that nobody was looking for. Think: the person who notices that every time a certain game crashes, McDonald's ice cream machines go down too.

## Rules
- McBroken: city-level breakdown %. Only post if a city is >40% broken or national average spikes
- Theme parks: only extreme waits (>120 min) or unusual patterns (park nearly empty on a Saturday)
- Steam/Twitch: massive spikes or crashes in player/viewer count. New game launches with record numbers
- Reddit: subreddit activity spikes >300% above average (something is happening)
- HN: stories hitting unusually high scores. Tech drama signals.
- GitHub/npm: package download explosions (supply chain attack? viral project?)
- WTF for absurdist data, LOOK for "you need to see this", RECORD for historic gaming/internet moments
- Preferred outcomes: WTF, LOOK, RECORD

## Examples
- "92% of McDonald's ice cream machines in Philadelphia are broken right now. National average is 11%. Philly, what happened?"
- "The #1 story on Hacker News has 4,200 points. Average #1 gets ~800. Something big is happening in tech."
- "Animal shelter intake in Houston spiked 340% this week. 30-day average is 45/day, yesterday was 198. Check on Houston."
```

**Step 5: Commit**

```bash
git add social-bot/poster.py social-bot/.twitter-creds.example.json social-bot/scheduled.csv social-bot/directives/
echo ".twitter-creds.json" >> social-bot/.gitignore
git add social-bot/.gitignore
git commit -m "feat(social-bot): local poster + directives + scheduled.csv + credential template"
```

---

### Task 7: MCP Server

**Files:**
- Create: `social-bot/server.py`
- Create: `social-bot/tools/__init__.py`
- Create: `social-bot/tools/anomalies.py`
- Create: `social-bot/tools/investigate.py`
- Create: `social-bot/tools/publish.py`
- Create: `social-bot/tools/stats.py`

**Step 1: Create tools/anomalies.py**

```python
import json
import db
from engine.detector import run_detection

def get_anomalies(source: str = None, limit: int = 20) -> list[dict]:
    """Get pending anomaly candidates."""
    if source:
        rows = db.query("""
            SELECT id, source, asset_id, raw_data, context, suggested_account,
                   suggested_headline, suggested_outcome, created_at
            FROM social_anomalies WHERE status = 'pending' AND source = %s
            ORDER BY created_at DESC LIMIT %s
        """, (source, limit))
    else:
        rows = db.query("""
            SELECT id, source, asset_id, raw_data, context, suggested_account,
                   suggested_headline, suggested_outcome, created_at
            FROM social_anomalies WHERE status = 'pending'
            ORDER BY created_at DESC LIMIT %s
        """, (limit,))
    # Parse JSONB fields
    for row in rows:
        row["raw_data"] = row["raw_data"] if isinstance(row["raw_data"], dict) else json.loads(row["raw_data"])
        row["context"] = row["context"] if isinstance(row["context"], dict) else json.loads(row["context"])
        row["created_at"] = str(row["created_at"])
    return rows

def skip_anomaly(anomaly_id: str, reason: str) -> dict:
    """Mark an anomaly as skipped."""
    db.execute("""
        UPDATE social_anomalies SET status = 'skipped', skip_reason = %s WHERE id = %s
    """, (reason, anomaly_id))
    return {"skipped": anomaly_id, "reason": reason}
```

**Step 2: Create tools/investigate.py**

```python
import db

def search_assets(query: str, source: str = None, days: int = 90) -> list[dict]:
    """Search all market_assets by name/symbol, including archived ones."""
    if source:
        rows = db.query("""
            SELECT a.source, a.asset_id, a.symbol, a.name, a.category, a.is_active,
                   l.value as last_value, l.fetched_at as last_updated
            FROM market_assets a
            LEFT JOIN market_prices_latest l ON a.source = l.source AND a.asset_id = l.asset_id
            WHERE a.source = %s AND (a.name ILIKE %s OR a.symbol ILIKE %s OR a.asset_id ILIKE %s)
            ORDER BY l.fetched_at DESC NULLS LAST
            LIMIT 50
        """, (source, f"%{query}%", f"%{query}%", f"%{query}%"))
    else:
        rows = db.query("""
            SELECT a.source, a.asset_id, a.symbol, a.name, a.category, a.is_active,
                   l.value as last_value, l.fetched_at as last_updated
            FROM market_assets a
            LEFT JOIN market_prices_latest l ON a.source = l.source AND a.asset_id = l.asset_id
            WHERE a.name ILIKE %s OR a.symbol ILIKE %s OR a.asset_id ILIKE %s
            ORDER BY l.fetched_at DESC NULLS LAST
            LIMIT 50
        """, (f"%{query}%", f"%{query}%", f"%{query}%"))
    for row in rows:
        row["last_value"] = str(row["last_value"]) if row["last_value"] else None
        row["last_updated"] = str(row["last_updated"]) if row["last_updated"] else None
    return rows

def get_history(source: str, asset_id: str, days: int = 30) -> list[dict]:
    """Full price history for any asset (including archived)."""
    rows = db.query("""
        SELECT value, change_pct, volume_24h, fetched_at
        FROM market_prices
        WHERE source = %s AND asset_id = %s
        AND fetched_at > NOW() - INTERVAL '%s days'
        ORDER BY fetched_at DESC
        LIMIT 5000
    """, (source, asset_id, days))
    return [{"value": str(r["value"]), "change_pct": str(r["change_pct"]),
             "fetched_at": str(r["fetched_at"])} for r in rows]

def get_frequency(source: str, event_type: str, region: str = None, days: int = 7) -> dict:
    """Count events of a type in a time window."""
    if region:
        row = db.query_one("""
            SELECT COUNT(*) as count FROM social_event_log
            WHERE source = %s AND event_type ILIKE %s AND region ILIKE %s
            AND occurred_at > NOW() - INTERVAL '%s days'
        """, (source, f"%{event_type}%", f"%{region}%", days))
    else:
        row = db.query_one("""
            SELECT COUNT(*) as count FROM social_event_log
            WHERE source = %s AND event_type ILIKE %s
            AND occurred_at > NOW() - INTERVAL '%s days'
        """, (source, f"%{event_type}%", days))
    count = row["count"] if row else 0

    # Historical average for comparison
    avg_row = db.query_one("""
        SELECT COUNT(*) as total FROM social_event_log
        WHERE source = %s AND event_type ILIKE %s
        AND occurred_at > NOW() - INTERVAL '90 days'
    """, (source, f"%{event_type}%"))
    total_90d = avg_row["total"] if avg_row else 0
    avg_per_period = (total_90d / 90) * days if total_90d else 0

    return {
        "count": count,
        "period_days": days,
        "avg_per_period": round(avg_per_period, 1),
        "is_unusual": count > avg_per_period * 2 if avg_per_period > 0 else count > 0,
    }

def get_compare(source: str, asset_id: str) -> dict:
    """Current value vs rolling statistics."""
    current = db.query_one("""
        SELECT value FROM market_prices_latest
        WHERE source = %s AND asset_id = %s
    """, (source, asset_id))
    if not current:
        return {"error": "Asset not found in latest prices"}

    stats = db.query_one("""
        SELECT
            AVG(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '7 days') as avg_7d,
            AVG(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '30 days') as avg_30d,
            AVG(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '90 days') as avg_90d,
            AVG(value) as avg_1y,
            MIN(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '30 days') as min_30d,
            MAX(value) FILTER (WHERE fetched_at > NOW() - INTERVAL '30 days') as max_30d,
            MIN(value) as min_1y,
            MAX(value) as max_1y
        FROM market_prices
        WHERE source = %s AND asset_id = %s
    """, (source, asset_id))

    last_this_high = db.query_one("""
        SELECT MAX(fetched_at) as last_time FROM market_prices
        WHERE source = %s AND asset_id = %s AND value >= %s
        AND fetched_at < NOW() - INTERVAL '7 days'
    """, (source, asset_id, current["value"]))

    result = {"current": str(current["value"])}
    if stats:
        for key in ["avg_7d", "avg_30d", "avg_90d", "avg_1y", "min_30d", "max_30d", "min_1y", "max_1y"]:
            result[key] = str(stats[key]) if stats[key] else None
    result["last_time_this_high"] = str(last_this_high["last_time"]) if last_this_high and last_this_high["last_time"] else None
    return result

def list_assets(source: str, from_date: str = None, to_date: str = None, active_only: bool = True) -> list[dict]:
    """List assets that existed in a time range."""
    if from_date and to_date:
        rows = db.query("""
            SELECT DISTINCT ON (a.source, a.asset_id) a.source, a.asset_id, a.symbol, a.name, a.category, a.is_active
            FROM market_assets a
            JOIN market_prices p ON a.source = p.source AND a.asset_id = p.asset_id
            WHERE a.source = %s AND p.fetched_at BETWEEN %s AND %s
            ORDER BY a.source, a.asset_id
            LIMIT 500
        """, (source, from_date, to_date))
    elif active_only:
        rows = db.query("""
            SELECT source, asset_id, symbol, name, category, is_active
            FROM market_assets WHERE source = %s AND is_active = TRUE
            ORDER BY symbol LIMIT 500
        """, (source,))
    else:
        rows = db.query("""
            SELECT source, asset_id, symbol, name, category, is_active
            FROM market_assets WHERE source = %s
            ORDER BY symbol LIMIT 500
        """, (source,))
    return rows
```

**Step 3: Create tools/publish.py**

```python
import db

def approve_anomaly(anomaly_id: str, final_tweet: str, account: str,
                    outcome_tag: str, virality_score: int) -> dict:
    """Mark an anomaly as approved in the DB. Does NOT post — the local
    /loop writes to scheduled.csv, and poster.py does the actual posting."""
    anomaly = db.query_one("SELECT * FROM social_anomalies WHERE id = %s", (anomaly_id,))
    if not anomaly:
        return {"error": f"Anomaly {anomaly_id} not found"}
    if anomaly["status"] in ("posted", "approved"):
        return {"error": f"Already {anomaly['status']}"}

    db.execute("""
        UPDATE social_anomalies SET status = 'approved', final_tweet = %s,
            outcome_tag = %s, virality_score = %s
        WHERE id = %s
    """, (final_tweet, outcome_tag, virality_score, anomaly_id))

    return {"approved": anomaly_id, "account": account, "tweet": final_tweet}

def get_last_posted(account: str = None, limit: int = 10) -> list[dict]:
    """Recent tweets per account."""
    if account:
        rows = db.query("""
            SELECT id, account, tweet_text, outcome_tag, virality_score, posted_at
            FROM social_posted WHERE account = %s
            ORDER BY posted_at DESC LIMIT %s
        """, (account, limit))
    else:
        rows = db.query("""
            SELECT id, account, tweet_text, outcome_tag, virality_score, posted_at
            FROM social_posted ORDER BY posted_at DESC LIMIT %s
        """, (limit,))
    for row in rows:
        row["posted_at"] = str(row["posted_at"])
    return rows

def get_posted(days: int = 1) -> list[dict]:
    """All tweets posted in N days."""
    rows = db.query("""
        SELECT id, account, tweet_text, tweet_id, outcome_tag, virality_score, posted_at
        FROM social_posted WHERE posted_at > NOW() - INTERVAL '%s days'
        ORDER BY posted_at DESC
    """, (days,))
    for row in rows:
        row["posted_at"] = str(row["posted_at"])
    return rows
```

**Step 4: Create tools/stats.py**

```python
import db

def get_stats() -> dict:
    """Dashboard stats."""
    pending = db.query_one("SELECT COUNT(*) as c FROM social_anomalies WHERE status = 'pending'")
    posted_today = db.query("""
        SELECT account, COUNT(*) as c FROM social_posted
        WHERE posted_at > CURRENT_DATE GROUP BY account
    """)
    skipped_today = db.query_one("""
        SELECT COUNT(*) as c FROM social_anomalies
        WHERE status = 'skipped' AND created_at > CURRENT_DATE
    """)
    total_posted = db.query_one("SELECT COUNT(*) as c FROM social_posted")

    return {
        "pending_anomalies": pending["c"] if pending else 0,
        "posted_today": {row["account"]: row["c"] for row in posted_today} if posted_today else {},
        "skipped_today": skipped_today["c"] if skipped_today else 0,
        "total_posted_all_time": total_posted["c"] if total_posted else 0,
    }
```

**Step 5: Create tools/__init__.py (empty)**

```bash
touch social-bot/tools/__init__.py
```

**Step 6: Create server.py — MCP server entry point**

```python
import json
import threading
import time
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from tools.anomalies import get_anomalies, skip_anomaly
from tools.investigate import search_assets, get_history, get_frequency, get_compare, list_assets
from tools.publish import approve_anomaly, get_last_posted, get_posted
from tools.stats import get_stats
from engine.detector import run_detection
from migrate import migrate

app = Server("social-bot")

# -- Tool definitions --

TOOLS = [
    Tool(name="get_anomalies", description="Get pending anomaly candidates. Returns newsworthy events detected from 98 data sources.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string", "description": "Filter by source (e.g., 'earthquake', 'sec')"},
            "limit": {"type": "integer", "description": "Max candidates to return (default 20)"},
        },
    }),
    Tool(name="skip_tweet", description="Skip/reject an anomaly candidate.", inputSchema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "Anomaly ID"},
            "reason": {"type": "string", "description": "Why it's not newsworthy"},
        },
        "required": ["id", "reason"],
    }),
    Tool(name="search", description="Search all historical market assets by name/symbol. Includes archived assets no longer being synced (old HN articles, finished games, expired markets).", inputSchema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search term"},
            "source": {"type": "string", "description": "Filter by source"},
            "days": {"type": "integer", "description": "Limit to assets active in last N days"},
        },
        "required": ["query"],
    }),
    Tool(name="get_history", description="Full price/value time series for any asset. Works for live and archived assets.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "asset_id": {"type": "string"},
            "days": {"type": "integer", "description": "How many days of history (default 30)"},
        },
        "required": ["source", "asset_id"],
    }),
    Tool(name="get_frequency", description="Count how many times an event type occurred in a time window. E.g., 'how many M5+ earthquakes in Turkey this week?'", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "event_type": {"type": "string", "description": "Event type to search for (partial match)"},
            "region": {"type": "string", "description": "Optional region filter"},
            "days": {"type": "integer", "description": "Time window in days (default 7)"},
        },
        "required": ["source", "event_type"],
    }),
    Tool(name="get_compare", description="Compare current value to rolling averages (7d/30d/90d/1y), min/max, and find when it was last this high/low.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "asset_id": {"type": "string"},
        },
        "required": ["source", "asset_id"],
    }),
    Tool(name="list_assets", description="List all assets for a source, optionally filtered by date range. Includes dead/archived assets with active_only=false.", inputSchema={
        "type": "object",
        "properties": {
            "source": {"type": "string"},
            "from_date": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
            "to_date": {"type": "string", "description": "End date (YYYY-MM-DD)"},
            "active_only": {"type": "boolean", "description": "Only active assets (default true)"},
        },
        "required": ["source"],
    }),
    Tool(name="approve_tweet", description="Mark an anomaly as approved in the DB. Does NOT post — the /loop writes to scheduled.csv locally, and poster.py posts from the Mac.", inputSchema={
        "type": "object",
        "properties": {
            "id": {"type": "string", "description": "Anomaly ID"},
            "final_tweet": {"type": "string", "description": "The tweet text (max 280 chars)"},
            "account": {"type": "string", "description": "Account to post from: GeneralInsiders, GeneralGridDown, GeneralSkyWatch, GeneralTaxReceipt, GeneralGlitch, GeneralMarket"},
            "outcome_tag": {"type": "string", "description": "FEAR, LOOK, MONEY, RAGE, WTF, WATCH, or RECORD"},
            "virality_score": {"type": "integer", "description": "1-10 virality rating"},
        },
        "required": ["id", "final_tweet", "account", "outcome_tag", "virality_score"],
    }),
    Tool(name="get_last_posted", description="Recent tweets per account. Use to check spacing and avoid repetition.", inputSchema={
        "type": "object",
        "properties": {
            "account": {"type": "string", "description": "Filter by account name"},
            "limit": {"type": "integer"},
        },
    }),
    Tool(name="get_posted", description="All tweets posted in the last N days.", inputSchema={
        "type": "object",
        "properties": {"days": {"type": "integer", "description": "Lookback days (default 1)"}},
    }),
    Tool(name="get_stats", description="Dashboard: pending count, posted today per account, skip rate.", inputSchema={
        "type": "object", "properties": {},
    }),
]

@app.list_tools()
async def list_tools():
    return TOOLS

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    handlers = {
        "get_anomalies": lambda: get_anomalies(arguments.get("source"), arguments.get("limit", 20)),
        "skip_tweet": lambda: skip_anomaly(arguments["id"], arguments["reason"]),
        "search": lambda: search_assets(arguments["query"], arguments.get("source"), arguments.get("days", 90)),
        "get_history": lambda: get_history(arguments["source"], arguments["asset_id"], arguments.get("days", 30)),
        "get_frequency": lambda: get_frequency(arguments["source"], arguments["event_type"], arguments.get("region"), arguments.get("days", 7)),
        "get_compare": lambda: get_compare(arguments["source"], arguments["asset_id"]),
        "list_assets": lambda: list_assets(arguments["source"], arguments.get("from_date"), arguments.get("to_date"), arguments.get("active_only", True)),
        "approve_tweet": lambda: approve_anomaly(arguments["id"], arguments["final_tweet"], arguments["account"], arguments["outcome_tag"], arguments["virality_score"]),
        "get_last_posted": lambda: get_last_posted(arguments.get("account"), arguments.get("limit", 10)),
        "get_posted": lambda: get_posted(arguments.get("days", 1)),
        "get_stats": lambda: get_stats(),
    }
    result = handlers[name]()
    return [TextContent(type="text", text=json.dumps(result, default=str, indent=2))]

# -- Background anomaly detection --

def detection_loop():
    """Runs anomaly detection every 2 minutes in background."""
    while True:
        try:
            candidates = run_detection()
            if candidates:
                print(f"[detector] Found {len(candidates)} new anomalies", flush=True)
        except Exception as e:
            print(f"[detector] Error: {e}", flush=True)
        time.sleep(120)

async def main():
    migrate()
    # Start background detector
    t = threading.Thread(target=detection_loop, daemon=True)
    t.start()
    # Run MCP server
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

**Step 7: Commit**

```bash
git add social-bot/tools/ social-bot/server.py
git commit -m "feat(social-bot): MCP server with 11 tools + background anomaly detection"
```

---

### Task 8: MCP Config on Local Mac

**Files:**
- Modify: `~/.claude/mcp.json` (or project `.mcp.json`)

**Step 1: Add MCP server config**

Add to `.mcp.json` in the project root (or `~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "socialbot": {
      "type": "stdio",
      "command": "ssh",
      "args": [
        "index-maker/prod/be",
        "cd /home/max/social-bot && python server.py"
      ]
    }
  }
}
```

**Step 2: Test MCP connection**

Restart Claude Code. The MCP tools should appear. Test:
- Call `get_stats` tool — should return `{"pending_anomalies": 0, ...}`
- Call `search` with `{"query": "bitcoin"}` — should return assets

**Step 3: Commit**

```bash
git add .mcp.json
git commit -m "feat(social-bot): MCP config for SSH-tunneled social bot"
```

---

### Task 9: Deploy to VPS

**Files:**
- Create: `social-bot/deploy.sh`

**Step 1: Create deploy.sh**

```bash
#!/bin/bash
set -e

VPS="index-maker/prod/be"
REMOTE_DIR="/home/max/social-bot"

echo "Syncing social-bot to VPS..."
rsync -avz --exclude='.env' --exclude='__pycache__' --exclude='*.pyc' \
    social-bot/ "$VPS:$REMOTE_DIR/"

echo "Installing dependencies..."
ssh "$VPS" "cd $REMOTE_DIR && pip install -r requirements.txt"

echo "Running migrations..."
ssh "$VPS" "cd $REMOTE_DIR && python migrate.py"

echo "Done. Start with: ssh $VPS 'cd $REMOTE_DIR && python server.py'"
```

**Step 2: Make executable and deploy**

```bash
chmod +x social-bot/deploy.sh
./social-bot/deploy.sh
```

**Step 3: Test server starts on VPS**

```bash
ssh index-maker/prod/be "cd /home/max/social-bot && timeout 5 python -c 'from migrate import migrate; migrate(); print(\"OK\")'"
```

**Step 4: Commit**

```bash
git add social-bot/deploy.sh
git commit -m "feat(social-bot): VPS deploy script"
```

---

### Task 10: Expand Thresholds

**Files:**
- Modify: `social-bot/thresholds.yaml`

**Step 1: Add all remaining source thresholds**

Copy the full threshold definitions for all ~30 active sources from `docs/plans/2026-03-10-social-bot-design.md`. Task 3 only had 5 sources. Now add:

- wildfire, volcano, airnow, weather_alerts, epidemic (→ SkyWatch)
- faa_delays, transit group, cbp_border, nrc_nuclear (→ GridDown)
- finra, congress (→ Insiders / TaxReceipt)
- usa_spending, courtlistener, zillow, fred_treasury (→ TaxReceipt)
- mcbroken, queue_times, steam, twitch, reddit, hackernews, github_npm_pypi, shelter, sports (→ Glitch)

**Step 2: Update engine/detector.py field mappings**

Add source-specific field mappings in `_row_to_eval_data()` for each new source. The mapping translates the generic `value` field to the semantic field name used in threshold conditions (e.g., `value` → `aqi` for airnow, `value` → `wait_min` for queue_times).

**Step 3: Test with expanded thresholds**

```bash
ssh index-maker/prod/be "cd /home/max/social-bot && python -c '
from engine.detector import run_detection
c = run_detection()
print(f\"{len(c)} anomalies found\")
for x in c[:5]: print(f\"  [{x[\"suggested_outcome\"]}] {x[\"source\"]}: {x[\"suggested_headline\"][:60]}\")
'"
```

**Step 4: Commit**

```bash
git add social-bot/thresholds.yaml social-bot/engine/detector.py
git commit -m "feat(social-bot): expand thresholds to all 30+ active sources"
```

---

### Task 11: /loop Prompt Setup

**Files:**
- Create: `social-bot/loop-prompt.md`

**Step 1: Create the /loop prompt file**

This file is the prompt that gets passed to `/loop`. Save it so you can iterate on it.

```markdown
You are the editorial brain for GeneralMarket's 5 Twitter accounts.

PHILOSOPHY (Ryan Petersen principle):
"Nobody cares about your startup. They care about things happening in THEIR world.
They only care about you to the extent that you are relevant to what matters to them."

You are NOT promoting GeneralMarket. You are the person who EXPLAINS what's happening
in the world using data nobody else has. Your unique edge: you see 98 real-time data
feeds simultaneously. You can connect a wildfire to power outages to air quality. You
can say "3rd this week" because you have the history. You can say "worst since 2019"
because you queried 90 days of data. THAT is why people follow you — not because of
generalmarket.io, but because you tell them things they can't find anywhere else.

Never mention GeneralMarket in tweets. Never link. Never self-promote.
Be the person people quote-tweet saying "how do they always know this stuff?"
The brand grows because the content is indispensable, not because you asked.

ACCOUNTS:
- @GeneralInsiders — SEC insider trades, short interest, congress trades
- @GeneralGridDown — Power outages, internet shutdowns, flight chaos, transit
- @GeneralSkyWatch — Earthquakes, volcanoes, solar storms, wildfires, air quality
- @GeneralTaxReceipt — Government spending, court rulings, housing costs
- @GeneralGlitch — Ice cream machines, theme parks, gaming, Reddit, weird data
- @GeneralMarket — Retweet the best ones

WORKFLOW:
1. Read the directives for each account in `social-bot/directives/*.md` — these define tone, sources, and rules per account
2. Call get_anomalies() to see pending candidates
3. For each candidate, DIG DEEPER before deciding:
   - get_frequency() — is this actually unusual or routine?
   - get_compare() — how does it compare to historical averages?
   - search() — any related events across OTHER sources? (cross-source insight is your superpower)
   - get_history() — what's the full trend? Is this accelerating?
   - get_last_posted() — what did this account post recently? Avoid repetition.
4. Ask yourself: "What unique insight can I provide that CNN/Reuters/random Twitter accounts can't?"
   - If the answer is "nothing, they'd say the same thing" → skip_tweet(id, reason)
   - If you can add context from our data that nobody else has → THAT is the tweet
5. For newsworthy candidates:
   a. Call approve_tweet() to mark the anomaly as approved in the VPS DB
   b. Append a row to `social-bot/scheduled.csv` with: id, account, tweet_text, outcome_tag, virality_score, scheduled_at (ISO), status=pending
   c. The local poster.py will pick it up and post it to X

THE TWEET IS THE CONTEXT, NOT THE EVENT:
- BAD: "M5.2 earthquake in Turkey" (anyone can say this)
- GOOD: "3rd M5+ in Turkey this week — our data shows the fault hasn't been this active in 6 years"
- BAD: "Power outage in Texas" (local news already said this)
- GOOD: "200K Texans without power in 108°F — same grid they said they fixed. 4th failure this year."

The EVENT is the hook. The CONTEXT from our data is why people follow us.

HEADLINE RULES:
- Max 280 chars. No emoji. No hashtags. No links. Never mention GeneralMarket.
- The reader MUST know WHY they should care.
- ALWAYS include data context: "Nth this week", "worst since", "X% above average"
- Match the outcome tag:
  FEAR  → tell them what to DO (stay inside, check position, prepare)
  LOOK  → tell them where to LOOK (go outside, look north)
  MONEY → how their WALLET is affected
  RAGE  → the UNFAIRNESS or HYPOCRISY
  WTF   → the ABSURDITY
  WATCH → this is DEVELOPING, not over
  RECORD → anchor to HISTORY (first since, never before)
- Rate virality 1-10. Only approve if >= 7.
- 0 tweets is better than 1 mediocre tweet. Be ruthless.

SPACING:
- Don't post 3 tweets from the same account in a row without checking others
- When events cascade (wildfire → power outage → air quality), post from EACH relevant
  account — that cross-source connection is exactly our edge

6. End with get_stats() to log summary.
```

**Step 2: Test the loop manually**

Before setting up `/loop`, run the workflow manually in Claude Code:
1. Use the `socialbot` MCP tools
2. Call `get_anomalies()`
3. Investigate a few candidates
4. Approve or skip them
5. Verify it works end-to-end

**Step 3: Set up /loop**

```
/loop 10m Review anomalies and post newsworthy ones to GeneralMarket Twitter accounts. Follow the workflow in social-bot/loop-prompt.md
```

**Step 4: Commit**

```bash
git add social-bot/loop-prompt.md
git commit -m "feat(social-bot): /loop editorial prompt for Claude Code"
```

---

## Summary

| Task | What | Where | Depends on |
|------|------|-------|-----------|
| 1 | Project scaffold + DB connection | VPS | — |
| 2 | State tables (anomalies, posted, event_log) | VPS | 1 |
| 3 | Threshold YAML + parser (5 sources) | VPS | 1 |
| 4 | Context computation engine | VPS | 2 |
| 5 | Anomaly detector | VPS | 2, 3, 4 |
| 6 | Local poster + directives + credentials | Mac | — |
| 7 | MCP server (tools, NO posting) | VPS | 5 |
| 8 | MCP config on local Mac | Mac | 7 |
| 9 | Deploy to VPS | VPS | 7 |
| 10 | Expand thresholds to all sources | VPS | 9 |
| 11 | /loop prompt setup | Mac | 6, 9 |

**Parallelizable:** Tasks 3+4 can run in parallel. Task 6 (local) can run in parallel with Tasks 1-5 (VPS). Tasks 8+9 can run in parallel after 7.
