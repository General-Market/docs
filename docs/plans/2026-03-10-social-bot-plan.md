# Social Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Python MCP server on VPS that detects anomalies from 98 data sources and exposes tools for Claude Code to investigate, write headlines, and post to 5 branded X/Twitter accounts.

**Architecture:** Python service on VPS 1 with direct PostgreSQL access (via tunnel to VPS 2). Runs anomaly detection every 2 min, serves MCP tools over stdio (invoked via SSH from local Mac). Claude Code `/loop` calls MCP tools every 10 min to review, investigate, and approve tweets.

**Tech Stack:** Python 3.11+, `mcp` (Model Context Protocol SDK), `psycopg2` (PostgreSQL), `tweepy` (Twitter API v2), `pyyaml`, no web framework needed.

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
tweepy>=4.14.0
pyyaml>=6.0
python-dotenv>=1.0.0
```

**Step 2: Create .env.example**

```
DATABASE_URL=postgres://max@localhost:5432/index_prices

# Twitter API keys (6 accounts)
TW_INSIDERS_API_KEY=
TW_INSIDERS_API_SECRET=
TW_INSIDERS_ACCESS_TOKEN=
TW_INSIDERS_ACCESS_SECRET=

TW_GRIDDOWN_API_KEY=
TW_GRIDDOWN_API_SECRET=
TW_GRIDDOWN_ACCESS_TOKEN=
TW_GRIDDOWN_ACCESS_SECRET=

TW_SKYWATCH_API_KEY=
TW_SKYWATCH_API_SECRET=
TW_SKYWATCH_ACCESS_TOKEN=
TW_SKYWATCH_ACCESS_SECRET=

TW_TAXRECEIPT_API_KEY=
TW_TAXRECEIPT_API_SECRET=
TW_TAXRECEIPT_ACCESS_TOKEN=
TW_TAXRECEIPT_ACCESS_SECRET=

TW_GLITCH_API_KEY=
TW_GLITCH_API_SECRET=
TW_GLITCH_ACCESS_TOKEN=
TW_GLITCH_ACCESS_SECRET=

TW_MAIN_API_KEY=
TW_MAIN_API_SECRET=
TW_MAIN_ACCESS_TOKEN=
TW_MAIN_ACCESS_SECRET=
```

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
Expected: `Ran 8 migrations`

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

### Task 6: Twitter Posting Client

**Files:**
- Create: `social-bot/posting/__init__.py`
- Create: `social-bot/posting/twitter.py`
- Create: `social-bot/posting/accounts.py`

**Step 1: Create posting/accounts.py**

```python
import os

ACCOUNTS = {
    "GeneralInsiders": {
        "api_key": os.getenv("TW_INSIDERS_API_KEY"),
        "api_secret": os.getenv("TW_INSIDERS_API_SECRET"),
        "access_token": os.getenv("TW_INSIDERS_ACCESS_TOKEN"),
        "access_secret": os.getenv("TW_INSIDERS_ACCESS_SECRET"),
    },
    "GeneralGridDown": {
        "api_key": os.getenv("TW_GRIDDOWN_API_KEY"),
        "api_secret": os.getenv("TW_GRIDDOWN_API_SECRET"),
        "access_token": os.getenv("TW_GRIDDOWN_ACCESS_TOKEN"),
        "access_secret": os.getenv("TW_GRIDDOWN_ACCESS_SECRET"),
    },
    "GeneralSkyWatch": {
        "api_key": os.getenv("TW_SKYWATCH_API_KEY"),
        "api_secret": os.getenv("TW_SKYWATCH_API_SECRET"),
        "access_token": os.getenv("TW_SKYWATCH_ACCESS_TOKEN"),
        "access_secret": os.getenv("TW_SKYWATCH_ACCESS_SECRET"),
    },
    "GeneralTaxReceipt": {
        "api_key": os.getenv("TW_TAXRECEIPT_API_KEY"),
        "api_secret": os.getenv("TW_TAXRECEIPT_API_SECRET"),
        "access_token": os.getenv("TW_TAXRECEIPT_ACCESS_TOKEN"),
        "access_secret": os.getenv("TW_TAXRECEIPT_ACCESS_SECRET"),
    },
    "GeneralGlitch": {
        "api_key": os.getenv("TW_GLITCH_API_KEY"),
        "api_secret": os.getenv("TW_GLITCH_API_SECRET"),
        "access_token": os.getenv("TW_GLITCH_ACCESS_TOKEN"),
        "access_secret": os.getenv("TW_GLITCH_ACCESS_SECRET"),
    },
    "GeneralMarket": {
        "api_key": os.getenv("TW_MAIN_API_KEY"),
        "api_secret": os.getenv("TW_MAIN_API_SECRET"),
        "access_token": os.getenv("TW_MAIN_ACCESS_TOKEN"),
        "access_secret": os.getenv("TW_MAIN_ACCESS_SECRET"),
    },
}

def get_client_config(account_name: str) -> dict | None:
    return ACCOUNTS.get(account_name)
```

**Step 2: Create posting/twitter.py**

```python
import tweepy
from datetime import datetime
import db
from posting.accounts import get_client_config

# Cache tweepy clients
_clients: dict[str, tweepy.Client] = {}

def get_twitter_client(account: str) -> tweepy.Client:
    if account in _clients:
        return _clients[account]
    config = get_client_config(account)
    if not config or not config["api_key"]:
        raise ValueError(f"No Twitter credentials for {account}")
    client = tweepy.Client(
        consumer_key=config["api_key"],
        consumer_secret=config["api_secret"],
        access_token=config["access_token"],
        access_token_secret=config["access_secret"],
    )
    _clients[account] = client
    return client

def post_tweet(account: str, text: str, anomaly_id: str, dedup_key: str,
               outcome_tag: str = None, virality_score: int = None) -> dict:
    """Post a tweet and record it in social_posted."""
    # Check 30-min spacing
    last = db.query_one("""
        SELECT posted_at FROM social_posted
        WHERE account = %s ORDER BY posted_at DESC LIMIT 1
    """, (account,))
    if last and last["posted_at"]:
        elapsed = (datetime.utcnow() - last["posted_at"].replace(tzinfo=None)).total_seconds()
        if elapsed < 1800 and outcome_tag != "FEAR":  # FEAR bypasses spacing
            return {"error": f"Too soon — {int(1800 - elapsed)}s until next post for {account}"}

    # Check daily limit
    today_count = db.query_one("""
        SELECT COUNT(*) as cnt FROM social_posted
        WHERE account = %s AND posted_at > CURRENT_DATE
    """, (account,))
    if today_count and today_count["cnt"] >= 15:
        return {"error": f"Daily limit reached for {account} (15/day)"}

    # Post
    client = get_twitter_client(account)
    response = client.create_tweet(text=text)
    tweet_id = str(response.data["id"])

    # Record
    db.execute("""
        INSERT INTO social_posted (id, source, account, tweet_text, tweet_id,
            outcome_tag, virality_score, dedup_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (anomaly_id, "social-bot", account, text, tweet_id,
          outcome_tag, virality_score, dedup_key))

    # Update anomaly status
    db.execute("""
        UPDATE social_anomalies SET status = 'posted', final_tweet = %s,
            outcome_tag = %s, virality_score = %s
        WHERE id = %s
    """, (text, outcome_tag, virality_score, anomaly_id))

    return {"tweet_id": tweet_id, "account": account, "text": text}

def post_tweet_dry_run(account: str, text: str) -> dict:
    """Dry run — don't actually post, just validate."""
    if len(text) > 280:
        return {"error": f"Tweet too long: {len(text)} chars (max 280)"}
    config = get_client_config(account)
    if not config or not config["api_key"]:
        return {"error": f"No credentials for {account}"}
    return {"dry_run": True, "account": account, "text": text, "chars": len(text)}
```

**Step 3: Create posting/__init__.py (empty)**

```bash
touch social-bot/posting/__init__.py
```

**Step 4: Commit**

```bash
git add social-bot/posting/
git commit -m "feat(social-bot): Twitter posting client with spacing + daily limits"
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
from posting.twitter import post_tweet

def approve_and_post(anomaly_id: str, final_tweet: str, account: str,
                     outcome_tag: str, virality_score: int) -> dict:
    """Approve an anomaly and post it to X."""
    # Get anomaly data for dedup key
    anomaly = db.query_one("SELECT * FROM social_anomalies WHERE id = %s", (anomaly_id,))
    if not anomaly:
        return {"error": f"Anomaly {anomaly_id} not found"}
    if anomaly["status"] == "posted":
        return {"error": f"Already posted"}

    # Update anomaly
    db.execute("""
        UPDATE social_anomalies SET status = 'approved', final_tweet = %s,
            outcome_tag = %s, virality_score = %s
        WHERE id = %s
    """, (final_tweet, outcome_tag, virality_score, anomaly_id))

    # Post to Twitter
    dedup_key = f"{anomaly['source']}:{anomaly.get('asset_id', '')}:{anomaly_id[:10]}"
    result = post_tweet(account, final_tweet, anomaly_id, dedup_key, outcome_tag, virality_score)
    return result

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
from tools.publish import approve_and_post, get_last_posted, get_posted
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
    Tool(name="approve_tweet", description="Approve an anomaly and post it to X/Twitter. Enforces 30-min spacing per account and 15/day limit. FEAR tweets bypass spacing.", inputSchema={
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
        "approve_tweet": lambda: approve_and_post(arguments["id"], arguments["final_tweet"], arguments["account"], arguments["outcome_tag"], arguments["virality_score"]),
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
git commit -m "feat(social-bot): MCP server with 12 tools + background anomaly detection"
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

ACCOUNTS:
- @GeneralInsiders — SEC insider trades, short interest, congress trades
- @GeneralGridDown — Power outages, internet shutdowns, flight chaos, transit
- @GeneralSkyWatch — Earthquakes, volcanoes, solar storms, wildfires, air quality
- @GeneralTaxReceipt — Government spending, court rulings, housing costs
- @GeneralGlitch — Ice cream machines, theme parks, gaming, Reddit, weird data
- @GeneralMarket — Retweet the best ones

WORKFLOW:
1. Call get_anomalies() to see pending candidates
2. For each candidate, investigate:
   - get_frequency() — is this actually unusual or routine?
   - get_compare() — how does it compare to historical averages?
   - search() — any related past events?
   - get_last_posted() — what did this account post recently? Avoid repetition.
3. For each candidate, decide:
   - NOT newsworthy → skip_tweet(id, reason)
   - Newsworthy → write a headline and approve_tweet()

HEADLINE RULES:
- Max 280 chars. No emoji. No hashtags.
- The reader MUST know WHY they should care.
- Include context: "Nth this week", "worst since", "X% above average"
- Match the outcome tag:
  FEAR  → tell them what to DO (stay inside, check position, prepare)
  LOOK  → tell them where to LOOK (go outside, look north)
  MONEY → how their WALLET is affected
  RAGE  → the UNFAIRNESS or HYPOCRISY
  WTF   → the ABSURDITY
  WATCH → this is DEVELOPING, not over
  RECORD → anchor to HISTORY (first since, never before)
- Rate virality 1-10. Only approve if >= 7.
- 0 tweets is better than 1 bad tweet.

SPACING:
- Don't post 3 tweets from the same account in a row without checking others
- When events cascade (wildfire → power outage), post from each relevant account

4. End with get_stats() to log summary.
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

| Task | What | Depends on |
|------|------|-----------|
| 1 | Project scaffold + DB connection | — |
| 2 | State tables (anomalies, posted, event_log) | 1 |
| 3 | Threshold YAML + parser (5 sources) | 1 |
| 4 | Context computation engine | 2 |
| 5 | Anomaly detector | 2, 3, 4 |
| 6 | Twitter posting client | 2 |
| 7 | MCP server (12 tools) | 5, 6 |
| 8 | MCP config on local Mac | 7 |
| 9 | Deploy to VPS | 7 |
| 10 | Expand thresholds to all sources | 9 |
| 11 | /loop prompt setup | 9 |

**Parallelizable:** Tasks 3+4 can run in parallel. Tasks 8+9 can run in parallel after 7.
