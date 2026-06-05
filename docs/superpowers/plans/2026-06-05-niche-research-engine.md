# Multi-Language Niche Research Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map every sub-niche in the memecoin-trenches scene (pumpfun + launchpads + terminals like Axiom) in EN/CN and the perps-DEX scene in EN/CN/JP/KR, then produce (a) a niche map per cell and (b) a replicable content-format playbook — using twitterapi.io, never fetching the same post twice, within a $15 budget.

**Architecture:** Search-first sweep (advanced_search harvests what already wins, per native-language query banks) → author deep-pull (`last_tweets` on top accounts, cache-filtered) → one cheap graph pass (followings of the 3 best accounts per cell) → local format mining (zero API cost) → agent synthesis into `marketing/niche-research/`. All API access goes through the existing `twapi.py` metered wrapper, upgraded with file locking, a project-level budget, and query-level dedup.

**Tech Stack:** Python 3 stdlib only (no pip installs), twitterapi.io REST, JSONL caches in `docs/x-targeting/cache/`, git push via `git push mono main`.

---

## Context the executor must absorb first (~10 min)

You are NOT the agent who designed this. Read these files before Task 1:

| File | Why | Time |
|---|---|---|
| `docs/x-targeting/twapi.py` | The wrapper you will modify. Every API call goes through it. | ~5 min |
| `docs/x-targeting/cache.py` | Cache-freshness filter (`needs`, `fresh`, `have`). You will call it, not modify it. | ~3 min |
| `docs/x-targeting/SUBAGENT_RULES.md` | Cache-first discipline. Binding. | ~2 min |

**Hard facts:**

- **API key** lives at `/tmp/.twapi_key` (plain text, gitignored, may have been wiped by a reboot — if missing, STOP and ask Max to re-create it: `echo 'KEY' > /tmp/.twapi_key`).
- **Pricing:** 100,000 credits = $1.00. `advanced_search` ≈ 15 credits/tweet (~300 c = $0.003 per 20-tweet page). `last_tweets` ≈ 15–20 credits/tweet. `followings` ≈ tiered, ~3,000 c per 200-account page. `user/info` ≈ 18 c.
- **Balance at plan time:** $4.15. Max will top up to **$15–20 total**. Run `python3 twapi.py balance` first; if < $10, ask Max to top up before Phase B.
- **Known ledger gotcha:** `/oapi/my/info` lags — per-call `delta_credits` often reads 0. Only absolute balance differences are truth. The budget code in Task 3 is built on this.
- **Known concurrency gotcha:** `profiles.jsonl` / `tweets.jsonl` are rewritten whole-file on every upsert. Two concurrent writers lose data. Task 2 fixes this with `flock`. Until Task 2 is committed, run NOTHING in parallel.
- **Git:** every completed task commits, then `git push mono main`. Never add `Co-Authored-By`. Marketing deliverables go in `/marketing/`, code and data stay in `docs/x-targeting/`.
- **Working directory for all commands:** `/Users/maxguillabert/Downloads/index/docs/x-targeting` unless stated otherwise.

## The six cells

| Cell | Vertical | Language | Scope |
|---|---|---|---|
| `trenches-en` | pumpfun + launchpads + terminals | English | pumpfun, letsbonk, believe, bags, moonshot, boop; terminals: Axiom, gmgn, BullX, Photon, Trojan |
| `trenches-cn` | same | Chinese | same platforms + CN-native idiom (打狗 / 土狗 / 金狗 / 内盘) |
| `perps-en` | perps DEXes | English | Hyperliquid, Lighter, Aster, edgeX, Paradex, GMX, dYdX, Drift, Extended, Avantis, Ostium |
| `perps-cn` | perps DEXes | Chinese | same + 合约/带单/爆仓 culture |
| `perps-jp` | perps DEXes | Japanese | same + JP retail leverage culture |
| `perps-kr` | perps DEXes | Korean | same + KR futures culture (김프, 선물) |

## Budget allocation ($15 cap, hard-stop enforced in code)

| Phase | What | Est. cost |
|---|---|---|
| B1 query validation probes | 1 page per non-EN query (~120 queries) | ~$0.40 |
| B2 sweep (6 cells) | ~35 queries × 2 queryTypes × ≤3 pages/cell | ~$4.50 |
| B3 author deep-pull | ~15 accounts × 3 pages × 6 cells, cache-filtered | ~$1.00 |
| B4 graph pass | 3 accounts × 1 followings page × 6 cells | ~$0.60 |
| Headroom / re-runs / gap-filling | | ~$8.50 |

The code-level cap (Task 3) refuses any call that would push project spend past `cap_usd` in `niches/budget.json`.

## Anti-double-fetch design (read this twice)

Four independent layers. All four must survive your implementation:

1. **Query-level:** every `advsearch` is logged to `cache/searches.jsonl` keyed by `sha256(query + queryType)[:16]`. Same query+type within 7 days → refused (CACHE HIT, zero cost) unless `--force`.
2. **Tweet-level:** `upsert_tweets` already dedups by `tweet_id` on write. Re-fetched tweets never duplicate rows; the `n_new` counter tells you how much of a page was waste.
3. **Page-level (diminishing returns):** during pagination, if a page is < 20 % new tweet IDs, stop paginating that query. Implemented in Task 4.
4. **Handle-level:** before ANY `lasttweets`/`userinfo`, filter the handle list through `python3 cache.py needs --tweets H1 H2 …`. Only fetch handles it prints. `lasttweets` additionally has its own 7-day cache guard built in.
5. **Time-window:** sweep queries get an explicit `since:` window appended by `sweep.py` (last 30 days for Top, last 7 for Latest). The window is part of the query string, therefore part of the dedup hash. A future re-sweep MUST set `--since` to the previous run's until-date (read it from `cache/searches.jsonl`), never overlapping.

---

# Phase A — Infrastructure (code, ~zero API cost)

### Task 1: Project scaffolding + budget file

**Files:**
- Create: `docs/x-targeting/niches/README.md`
- Create: `docs/x-targeting/niches/budget.json`

- [ ] **Step 1: Create the directory tree**

```bash
cd /Users/maxguillabert/Downloads/index/docs/x-targeting
mkdir -p niches/trenches-en niches/trenches-cn niches/perps-en niches/perps-cn niches/perps-jp niches/perps-kr
```

- [ ] **Step 2: Write `niches/README.md`**

```markdown
# Niche research — memecoin trenches (EN/CN) + perps DEX (EN/CN/JP/KR)

Six cells, one directory each. Per cell:

- `queries.tsv`   — query bank (query, queryType, note). Input to sweep.py.
- `validation.md` — probe results for non-EN terms (which queries returned 0).
- `authors.tsv`   — ranked authors harvested from the sweep.
- `formats.json`  — machine output of format_miner.py.
- `formats.md`    — human-readable format ranking with exemplars.

Cross-cell deliverables live in `/marketing/niche-research/`:
- `<cell>.md`            — niche map per cell
- `format-playbook.md`   — replicable content-format bank

Budget: `budget.json` here is the single source of truth, enforced by twapi.py.
Plan: `docs/superpowers/plans/2026-06-05-niche-research-engine.md`.
```

- [ ] **Step 3: Initialize the budget file**

Run `python3 twapi.py balance` and put the CURRENT total credits into `baseline_credits` below (do not copy 414882 blindly — balance moves):

```json
{
  "cap_usd": 15.0,
  "baseline_credits": REPLACE_WITH_CURRENT_TOTAL,
  "spent_locked_credits": 0,
  "started": "2026-06-05T00:00:00Z",
  "note": "Project budget for niche-research. twapi.py enforces. After a top-up run: python3 twapi.py rebase"
}
```

- [ ] **Step 4: Commit**

```bash
git add niches/README.md niches/budget.json
git commit -m "feat(x-targeting): scaffold niche-research project + budget file"
git push mono main
```

---

### Task 2: twapi.py — file locking on all cache writes

Concurrent subagents corrupt the whole-file-rewrite JSONL caches. Fix with one `flock`-guarded critical section around every read-modify-write.

**Files:**
- Modify: `docs/x-targeting/twapi.py`
- Test: `docs/x-targeting/tests/test_twapi.py` (new)

- [ ] **Step 1: Write the failing test**

Create `docs/x-targeting/tests/test_twapi.py`:

```python
import json
import multiprocessing as mp
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import twapi


def _worker(i, cache_dir):
    # Redirect cache into tmp dir
    twapi.PROFILES = Path(cache_dir) / "profiles.jsonl"
    twapi.TWEETS = Path(cache_dir) / "tweets.jsonl"
    twapi.LOCK_FILE = Path(cache_dir) / ".cache.lock"
    twapi.upsert_profile({"userName": f"user{i}", "id": str(i), "followers": i})


def test_concurrent_upserts_lose_nothing(tmp_path):
    procs = [mp.Process(target=_worker, args=(i, str(tmp_path))) for i in range(20)]
    [p.start() for p in procs]
    [p.join() for p in procs]
    rows = [json.loads(l) for l in (tmp_path / "profiles.jsonl").read_text().splitlines() if l.strip()]
    names = {r["screen_name"] for r in rows}
    assert names == {f"user{i}" for i in range(20)}, f"lost writes: {sorted(names)}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/maxguillabert/Downloads/index/docs/x-targeting
python3 -m pytest tests/test_twapi.py -v
```

Expected: FAIL — either `AttributeError: module 'twapi' has no attribute 'LOCK_FILE'` or a lost-writes assertion (the race is real but probabilistic; the missing `LOCK_FILE` makes the failure deterministic).

- [ ] **Step 3: Implement locking in twapi.py**

Add after the constants block (after `CREDITS_PER_USD = 100_000`):

```python
import fcntl
from contextlib import contextmanager

LOCK_FILE = CACHE / ".cache.lock"


@contextmanager
def cache_lock():
    """Exclusive lock for any read-modify-write on the shared JSONL caches.
    Whole-file rewrites without this lose rows under concurrent subagents."""
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOCK_FILE.open("w") as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)
```

Then wrap the three mutators. `upsert_profile`: rename the existing function body to `_upsert_profile_unlocked(twapi_user, followed_by)` and define:

```python
def upsert_profile(twapi_user: dict, followed_by: str | None = None) -> None:
    with cache_lock():
        _upsert_profile_unlocked(twapi_user, followed_by)
```

Same pattern for `upsert_tweets` → `_upsert_tweets_unlocked` (returns `n_new`, the wrapper returns it through), and `append_ledger`:

```python
def upsert_tweets(tweets: list[dict], source: str = "twapi", cell: str | None = None) -> int:
    with cache_lock():
        return _upsert_tweets_unlocked(tweets, source, cell)


def append_ledger(row: dict) -> None:
    with cache_lock():
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        with LEDGER.open("a") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
```

IMPORTANT: `_upsert_tweets_unlocked` must call `_upsert_profile_unlocked` (not the locked wrapper) for attached authors — `flock` on the same handle is re-entrant per process here because we reopen the lock file, which would deadlock-free but double-acquire; keep it simple and call the unlocked inner. While there, add the `cell` parameter: inside `_upsert_tweets_unlocked`, add `"cell": cell,` to the `row` dict (after `"source_run": source,`).

- [ ] **Step 4: Run test to verify it passes**

```bash
python3 -m pytest tests/test_twapi.py -v
```

Expected: PASS.

- [ ] **Step 5: Smoke-test nothing broke (zero-cost — cache hit)**

```bash
python3 twapi.py spent | head -5
```

Expected: prints totals without traceback.

- [ ] **Step 6: Commit**

```bash
git add twapi.py tests/test_twapi.py
git commit -m "feat(x-targeting): flock cache writes + cell tag on tweets — parallel-safe subagents"
git push mono main
```

---

### Task 3: twapi.py — project-level budget (replaces $1 session cap)

Budget = absolute balance delta against a recorded baseline (ledger deltas lie). Survives multiple sessions and multiple subagents because the baseline lives in `niches/budget.json`, not in a per-session tmp file.

**Files:**
- Modify: `docs/x-targeting/twapi.py`
- Test: `docs/x-targeting/tests/test_twapi.py`

- [ ] **Step 1: Write the failing test** (append to `tests/test_twapi.py`)

```python
def test_project_budget_math(tmp_path, monkeypatch):
    budget = tmp_path / "budget.json"
    budget.write_text(json.dumps({
        "cap_usd": 15.0, "baseline_credits": 1_000_000, "spent_locked_credits": 100_000,
    }))
    monkeypatch.setattr(twapi, "BUDGET_FILE", budget)
    monkeypatch.setattr(twapi, "balance", lambda: (700_000, 0))
    # spent = locked 100k + (baseline 1,000k - current 700k) = 400k credits = $4
    assert twapi.project_spent_credits() == 400_000
    # cap 15 USD = 1.5M credits; 400k spent + 1.2M estimate would breach
    try:
        twapi.check_budget(1_200_000)
        assert False, "should have exited"
    except SystemExit as e:
        assert e.code == 2
    # small estimate passes
    twapi.check_budget(10_000)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python3 -m pytest tests/test_twapi.py::test_project_budget_math -v
```

Expected: FAIL — `AttributeError: ... 'BUDGET_FILE'`.

- [ ] **Step 3: Implement in twapi.py**

Add constant near the top (after `LEDGER = ...`):

```python
BUDGET_FILE = ROOT / "niches" / "budget.json"
```

Replace the bodies of `session_spent_credits` / `check_budget` with project-aware versions (keep the old session fallback for when no budget.json exists):

```python
def project_spent_credits() -> int:
    """Project spend = spent_locked + (baseline - current balance).
    Ledger deltas are unreliable (balance endpoint lags); absolute delta is truth."""
    b = json.loads(BUDGET_FILE.read_text())
    r, bo = balance()
    return b.get("spent_locked_credits", 0) + max(0, b["baseline_credits"] - (r + bo))


def check_budget(estimate_credits: int = 0) -> None:
    if BUDGET_FILE.exists():
        b = json.loads(BUDGET_FILE.read_text())
        cap_credits = int(b["cap_usd"] * CREDITS_PER_USD)
        spent = project_spent_credits()
        if spent + estimate_credits > cap_credits:
            print(f"BUDGET BREACH: project spent={spent}c (${spent/CREDITS_PER_USD:.2f}), "
                  f"would-add={estimate_credits}c, cap=${b['cap_usd']}", file=sys.stderr)
            sys.exit(2)
        return
    # Fallback: legacy per-session cap
    spent = session_spent_credits()
    cap_credits = int(HARD_CAP_USD * CREDITS_PER_USD)
    if spent + estimate_credits > cap_credits:
        print(f"BUDGET BREACH: spent={spent}, would-add={estimate_credits}, cap={cap_credits} (${HARD_CAP_USD})",
              file=sys.stderr)
        sys.exit(2)


def cmd_rebase():
    """After a credit top-up: fold spend-so-far into spent_locked, reset baseline to current."""
    b = json.loads(BUDGET_FILE.read_text())
    r, bo = balance()
    current = r + bo
    b["spent_locked_credits"] = b.get("spent_locked_credits", 0) + max(0, b["baseline_credits"] - current)
    b["baseline_credits"] = current
    BUDGET_FILE.write_text(json.dumps(b, indent=2))
    print(json.dumps({"rebased": True, **b}, indent=2))
```

Wire `rebase` into `main()`:

```python
    elif cmd == "rebase":
        cmd_rebase()
```

And extend `cmd_balance()` to print project numbers when `BUDGET_FILE.exists()`:

```python
    if BUDGET_FILE.exists():
        spent_p = project_spent_credits()
        cap = json.loads(BUDGET_FILE.read_text())["cap_usd"]
        out["project_spent_usd"] = round(spent_p / CREDITS_PER_USD, 4)
        out["project_cap_usd"] = cap
```

(Refactor `cmd_balance` to build a dict `out` then `print(json.dumps(out, indent=2))`.)

- [ ] **Step 4: Run all tests**

```bash
python3 -m pytest tests/test_twapi.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Live check (1 free API call — /oapi/my/info costs 0)**

```bash
python3 twapi.py balance
```

Expected: JSON now includes `project_spent_usd` and `project_cap_usd: 15.0`.

- [ ] **Step 6: Commit**

```bash
git add twapi.py tests/test_twapi.py
git commit -m "feat(x-targeting): project-level budget cap via niches/budget.json + rebase for top-ups"
git push mono main
```

---

### Task 4: twapi.py — advsearch dedup, pagination, cell tagging

**Files:**
- Modify: `docs/x-targeting/twapi.py`
- Test: `docs/x-targeting/tests/test_twapi.py`

- [ ] **Step 1: Write the failing test** (append)

```python
def test_query_hash_canonicalizes_whitespace():
    a = twapi.query_hash("pumpfun  lang:zh   min_faves:50", "Top")
    b = twapi.query_hash("pumpfun lang:zh min_faves:50", "Top")
    c = twapi.query_hash("pumpfun lang:zh min_faves:50", "Latest")
    assert a == b
    assert a != c


def test_search_dedup_blocks_within_ttl(tmp_path, monkeypatch):
    searches = tmp_path / "searches.jsonl"
    monkeypatch.setattr(twapi, "SEARCHES", searches)
    from datetime import datetime, timezone
    twapi.log_search("foo lang:ja", "Top", cell="perps-jp", n_tweets=20, n_new=20)
    assert twapi.search_done_recently("foo  lang:ja", "Top", ttl_days=7) is True
    assert twapi.search_done_recently("foo lang:ja", "Latest", ttl_days=7) is False
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_twapi.py -v -k "query_hash or dedup"
```

Expected: FAIL — `query_hash` not defined.

- [ ] **Step 3: Implement**

Add after `BUDGET_FILE`:

```python
SEARCHES = CACHE / "searches.jsonl"
SEARCH_TTL_DAYS = 7


def query_hash(query: str, query_type: str) -> str:
    import hashlib
    canon = " ".join(query.split()) + "|" + query_type
    return hashlib.sha256(canon.encode()).hexdigest()[:16]


def log_search(query: str, query_type: str, cell: str | None,
               n_tweets: int, n_new: int, pages: int = 1) -> None:
    with cache_lock():
        SEARCHES.parent.mkdir(parents=True, exist_ok=True)
        with SEARCHES.open("a") as f:
            f.write(json.dumps({
                "qhash": query_hash(query, query_type),
                "query": " ".join(query.split()),
                "query_type": query_type,
                "cell": cell,
                "pages": pages,
                "n_tweets": n_tweets,
                "n_new": n_new,
                "fetched_at": now_iso(),
            }, ensure_ascii=False) + "\n")


def search_done_recently(query: str, query_type: str, ttl_days: int = SEARCH_TTL_DAYS) -> bool:
    h = query_hash(query, query_type)
    for row in _load_jsonl(SEARCHES):
        if row.get("qhash") != h:
            continue
        try:
            t = datetime.fromisoformat(row["fetched_at"])
            if (datetime.now(timezone.utc) - t).days < ttl_days:
                return True
        except Exception:
            continue
    return False
```

Replace `cmd_advsearch` entirely:

```python
def cmd_advsearch(query: str, query_type: str = "Latest", cell: str | None = None,
                  pages: int = 1, force: bool = False, min_new_ratio: float = 0.2):
    """Paginated advanced search with query-level dedup and a diminishing-returns guard.

    Dedup layers:
      1. same (query, queryType) ran < SEARCH_TTL_DAYS ago -> refuse (0 cost)
      2. tweet_id dedup on cache write (upsert_tweets)
      3. stop paginating when a page is < min_new_ratio new tweets
    """
    if not force and search_done_recently(query, query_type):
        print(f"  ↳ SEARCH CACHE HIT [{query_type}] {query!r} — ran <{SEARCH_TTL_DAYS}d ago, skipping (use --force)",
              file=sys.stderr)
        print("cache-hit 0 new")
        return
    total, total_new, cursor = 0, 0, ""
    known_ids = {r.get("tweet_id") for r in _load_jsonl(TWEETS)}
    for page in range(pages):
        params = {"query": query, "queryType": query_type}
        if cursor:
            params["cursor"] = cursor
        body = metered_call(
            f"advsearch[{cell or '-'}]:{query[:40]}:p{page}", "/twitter/tweet/advanced_search",
            params, estimate=15 * 20,
        )
        if body.get("status") != "success":
            print(json.dumps(body, indent=2))
            break
        data = body.get("data") or {}
        tweets = data.get("tweets", []) if isinstance(data, dict) else (body.get("tweets") or [])
        if not tweets:
            break
        page_new = sum(1 for t in tweets if str(t.get("id")) not in known_ids)
        for t in tweets:
            known_ids.add(str(t.get("id")))
        n_new = upsert_tweets(tweets, source=f"sweep-{cell}" if cell else "twapi-advsearch", cell=cell)
        total += len(tweets)
        total_new += n_new
        cursor = body.get("next_cursor") or data.get("next_cursor") or ""
        has_next = body.get("has_next_page", data.get("has_next_page", bool(cursor)))
        if not cursor or not has_next:
            break
        if page_new / max(1, len(tweets)) < min_new_ratio:
            print(f"  ↳ diminishing returns ({page_new}/{len(tweets)} new) — stop paginating", file=sys.stderr)
            break
    log_search(query, query_type, cell, total, total_new, pages)
    print(f"got {total} tweets, {total_new} new [{query_type}] {query!r}")
```

Update the `advsearch` branch of `main()`:

```python
    elif cmd == "advsearch":
        def _flag(name, default=None, cast=str):
            if name in sys.argv:
                return cast(sys.argv[sys.argv.index(name) + 1])
            return default
        cmd_advsearch(
            sys.argv[2],
            query_type=_flag("--type", "Latest"),
            cell=_flag("--cell"),
            pages=_flag("--pages", 1, int),
            force="--force" in sys.argv,
        )
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_twapi.py -v
```

Expected: all PASS.

- [ ] **Step 5: Live smoke test — one cheap real search (~$0.006, counts against budget)**

```bash
python3 twapi.py advsearch 'hyperliquid min_faves:200 lang:en' --type Top --cell smoke-test
python3 twapi.py advsearch 'hyperliquid min_faves:200 lang:en' --type Top --cell smoke-test
```

Expected: first run `got 20 tweets, N new`; second run `SEARCH CACHE HIT … skipping`. Verify the cell tag landed:

```bash
grep -c '"cell": "smoke-test"' cache/tweets.jsonl
```

Expected: ≥ 1.

- [ ] **Step 6: Commit**

```bash
git add twapi.py tests/test_twapi.py
git commit -m "feat(x-targeting): advsearch pagination + query-dedup (searches.jsonl) + diminishing-returns guard"
git push mono main
```

---

### Task 5: twapi.py — lasttweets pagination

Format mining needs ~60 tweets per top author; one page gives ~20.

**Files:**
- Modify: `docs/x-targeting/twapi.py`

- [ ] **Step 1: Implement `--pages` on `cmd_lasttweets`**

Replace the signature and the fetch part of `cmd_lasttweets`:

```python
def cmd_lasttweets(handle: str, count: int = 10, force: bool = False, pages: int = 1,
                   cell: str | None = None):
    if not force:
        cached = _cached_tweets_fresh(handle, min_count=5)
        if cached is not None:
            # (existing cache-hit block unchanged)
            ...
            return
    all_tweets, cursor = [], ""
    for page in range(pages):
        params = {"userName": handle.lstrip("@")}
        if cursor:
            params["cursor"] = cursor
        body = metered_call(
            f"lasttweets:{handle}:p{page}", "/twitter/user/last_tweets",
            params, estimate=15 * 20,
        )
        if body.get("status") != "success":
            print(json.dumps(body, indent=2))
            break
        data = body.get("data", {})
        tweets = data.get("tweets") if isinstance(data, dict) else (data or [])
        if not isinstance(tweets, list) or not tweets:
            break
        all_tweets.extend(tweets)
        cursor = body.get("next_cursor") or (data.get("next_cursor") if isinstance(data, dict) else "") or ""
        has_next = body.get("has_next_page", bool(cursor))
        if not cursor or not has_next:
            break
    if all_tweets:
        n_new = upsert_tweets(all_tweets, source=f"twapi-lasttweets-{handle}", cell=cell)
        print(f"got {len(all_tweets)} tweets, {n_new} new to cache")
        for t in all_tweets[:10]:
            print(f"  {t.get('createdAt', '?')[:10]}  ♥{t.get('likeCount',0)} ↻{t.get('retweetCount',0)}  {(t.get('text') or '')[:100]}")
```

(The `...` above means: keep the existing cache-hit print block exactly as it is today — lines printing `CACHE HIT lasttweets…`. Do not paraphrase it away.)

Update `main()` branch:

```python
    elif cmd == "lasttweets":
        n = int(sys.argv[sys.argv.index("--count") + 1]) if "--count" in sys.argv else 10
        p = int(sys.argv[sys.argv.index("--pages") + 1]) if "--pages" in sys.argv else 1
        c = sys.argv[sys.argv.index("--cell") + 1] if "--cell" in sys.argv else None
        cmd_lasttweets(sys.argv[2], n, force="--force" in sys.argv, pages=p, cell=c)
```

- [ ] **Step 2: Live test on a handle already cached (free — cache hit)**

```bash
python3 twapi.py lasttweets max_otc
```

Expected: `CACHE HIT` (it was fetched in May; if stale, this costs ~$0.003 — acceptable).

- [ ] **Step 3: Commit**

```bash
git add twapi.py
git commit -m "feat(x-targeting): lasttweets cursor pagination + cell tag"
git push mono main
```

---

### Task 6: format_miner.py — structural format classifier (zero API cost)

**Files:**
- Create: `docs/x-targeting/format_miner.py`
- Test: `docs/x-targeting/tests/test_format_miner.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_format_miner.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from format_miner import classify


def test_numbered_list():
    t = "Top gems today:\n1. $WIF\n2. $POPCAT\n3. $MOODENG\n4. $PNUT"
    assert "numbered_list" in classify(t)


def test_token_call_with_ca():
    t = "new runner $GOAT\nCA: CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump"
    tags = classify(t)
    assert "token_call" in tags


def test_pnl_flex():
    assert "pnl_flex" in classify("turned $200 into $14,500 on this play. +7150% pnl")


def test_cn_daily_recap():
    assert "daily_recap" in classify("今日金狗复盘：\n1. $A 涨了30倍\n2. $B 内盘冲出")


def test_meme_short():
    assert "meme_short" in classify("ngmi if you fade the trenches")


def test_data_drop():
    t = "Hyperliquid 24h: $4.2B volume, OI $1.8B, funding 0.0021%"
    assert "data_drop" in classify(t)
```

- [ ] **Step 2: Run to verify failure**

```bash
python3 -m pytest tests/test_format_miner.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'format_miner'`.

- [ ] **Step 3: Write `format_miner.py`**

```python
#!/usr/bin/env python3
"""Mine replicable content formats from cached tweets. Zero API cost.

Classifies each cached tweet into structural format signatures, then ranks
formats by median engagement within a cell. Output: which FORMS win, with
exemplars — the raw material of the format playbook.

Usage:
  format_miner.py CELL              # e.g. trenches-cn — writes niches/CELL/formats.{json,md}
  format_miner.py CELL --min-n 3    # min tweets per format to qualify (default 5)
"""
from __future__ import annotations
import json
import re
import statistics
import sys
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
TWEETS = ROOT / "cache" / "tweets.jsonl"
PROFILES = ROOT / "cache" / "profiles.jsonl"

# Order matters only for readability; a tweet can carry several tags.
SIGNATURES: list[tuple[str, callable]] = []


def sig(name):
    def reg(fn):
        SIGNATURES.append((name, fn))
        return fn
    return reg


NUM_ITEM = re.compile(r"(?m)^\s*(?:\d{1,2}\s*[\.\)、/]|[1-9]️?⃣|[①-⑩])")
TICKER = re.compile(r"\$[A-Za-z][A-Za-z0-9]{1,9}\b")
SOL_CA = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")
PCT_OR_X = re.compile(r"(?:[+\-]?\d[\d,]*(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?x\b|\d+\s*倍)")
MONEY = re.compile(r"[$￥¥₩][\d,]+|\d[\d,]*\s*(?:USD|U\b|만원|円|刀)")
RECAP_WORD = re.compile(r"(?i)(today|daily|recap|wrap|复盘|今日|今天|本日|今日の|まとめ|오늘|데일리|정리)")
DATA_WORD = re.compile(r"(?i)(volume|tvl|funding|open interest|\bOI\b|liquidat|交易量|资金费|持仓|爆仓|出来高|資金調達率|清算|거래량|펀딩|청산)")
TUTORIAL = re.compile(r"(?i)(how to|guide|step[- ]by|tutorial|教程|教学|方法|攻略|やり方|手順|초보|방법|가이드)")
THREAD = re.compile(r"(?:🧵|👇|a thread|繼續|スレッド|쓰레드|스레드)\s*$|(?i)\bthread\b")
QUESTION = re.compile(r"[?？]\s*$")
PNL_WORD = re.compile(r"(?i)(pnl|profit|gain|bag|赚|盈利|益|利確|손익|수익)")


@sig("numbered_list")
def _numbered(t):
    return len(NUM_ITEM.findall(t)) >= 3


@sig("token_call")
def _call(t):
    return bool(TICKER.search(t)) and (bool(SOL_CA.search(t)) or "CA" in t.upper())


@sig("pnl_flex")
def _pnl(t):
    return bool(PCT_OR_X.search(t)) and (bool(MONEY.search(t)) or bool(PNL_WORD.search(t)))


@sig("daily_recap")
def _recap(t):
    return bool(RECAP_WORD.search(t)) and (len(NUM_ITEM.findall(t)) >= 2 or len(TICKER.findall(t)) >= 2)


@sig("data_drop")
def _data(t):
    return bool(DATA_WORD.search(t)) and len(re.findall(r"\d", t)) >= 6


@sig("tutorial")
def _tut(t):
    return bool(TUTORIAL.search(t))


@sig("thread_hook")
def _thread(t):
    return bool(THREAD.search(t))


@sig("question_bait")
def _q(t):
    return bool(QUESTION.search(t)) and len(t) < 160


@sig("meme_short")
def _meme(t):
    return len(t) < 120 and "http" not in t and not TICKER.search(t) and not NUM_ITEM.search(t)


def classify(text: str) -> list[str]:
    text = text or ""
    return [name for name, fn in SIGNATURES if fn(text)] or ["other"]


def load_jsonl(p: Path) -> list[dict]:
    if not p.exists():
        return []
    out = []
    for line in p.read_text().split("\n"):
        if not line.strip():
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def engagement(t: dict) -> int:
    return (t.get("favorites") or 0) + 3 * (t.get("retweets") or 0) \
        + 2 * (t.get("replies") or 0) + 4 * (t.get("quotes") or 0)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    cell = sys.argv[1]
    min_n = int(sys.argv[sys.argv.index("--min-n") + 1]) if "--min-n" in sys.argv else 5
    followers = {(p.get("screen_name") or "").lower(): p.get("followers_count") or 0
                 for p in load_jsonl(PROFILES)}
    rows = [t for t in load_jsonl(TWEETS) if t.get("cell") == cell]
    if not rows:
        print(f"no tweets tagged cell={cell} — run the sweep first", file=sys.stderr)
        sys.exit(1)
    buckets: dict[str, list[dict]] = {}
    for t in rows:
        for tag in classify(t.get("text") or ""):
            buckets.setdefault(tag, []).append(t)
    report = []
    for tag, ts in buckets.items():
        if len(ts) < min_n:
            continue
        engs = sorted((engagement(t) for t in ts), reverse=True)
        exemplars = sorted(ts, key=engagement, reverse=True)[:3]
        report.append({
            "format": tag,
            "n": len(ts),
            "median_eng": statistics.median(engs),
            "p90_eng": engs[max(0, len(engs) // 10 - 1)] if len(engs) >= 10 else engs[0],
            "exemplars": [{
                "url": e.get("url"),
                "author": e.get("screen_name"),
                "author_followers": followers.get((e.get("screen_name") or "").lower(), 0),
                "eng": engagement(e),
                "views": e.get("views"),
                "text": (e.get("text") or "")[:280],
            } for e in exemplars],
        })
    report.sort(key=lambda r: r["median_eng"], reverse=True)
    outdir = ROOT / "niches" / cell
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "formats.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    lines = [f"# {cell} — format ranking ({len(rows)} tweets mined)", ""]
    lines.append("| format | n | median eng | p90 eng | top exemplar |")
    lines.append("|---|---|---|---|---|")
    for r in report:
        ex = r["exemplars"][0]
        lines.append(f"| {r['format']} | {r['n']} | {r['median_eng']} | {r['p90_eng']} | "
                     f"[@{ex['author']}]({ex['url']}) ({ex['eng']} eng) |")
    lines.append("")
    for r in report:
        lines.append(f"## {r['format']} (n={r['n']}, median {r['median_eng']})")
        for ex in r["exemplars"]:
            lines.append(f"- **{ex['eng']} eng** @{ex['author']} ({ex['author_followers']} fo) — "
                         f"{(ex['text'] or '').splitlines()[0][:120]} — {ex['url']}")
        lines.append("")
    (outdir / "formats.md").write_text("\n".join(lines))
    print(f"wrote {outdir}/formats.json + formats.md  ({len(report)} formats qualified)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests**

```bash
python3 -m pytest tests/test_format_miner.py -v
```

Expected: all 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add format_miner.py tests/test_format_miner.py
git commit -m "feat(x-targeting): format_miner — structural format classifier + per-cell ranking"
git push mono main
```

---

### Task 7: sweep.py — query-bank runner (windows, validation, budget-aware)

**Files:**
- Create: `docs/x-targeting/sweep.py`

- [ ] **Step 1: Write `sweep.py`**

```python
#!/usr/bin/env python3
"""Run a cell's query bank through twapi advsearch with explicit time windows.

Usage:
  sweep.py CELL --validate     # 1 Latest page per query, report 0-result queries (cheap)
  sweep.py CELL                # full sweep: Top (30d window, 3 pages) + Latest (7d, 1 page)
  sweep.py CELL --since YYYY-MM-DD   # override window start (for future re-sweeps:
                                     # set to the previous run's date — never overlap)

Reads  niches/CELL/queries.tsv   (columns: query \t types \t note ; types = Top|Latest|Both)
Skips  any (query, type) already in cache/searches.jsonl < 7d old (twapi dedup).
"""
from __future__ import annotations
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import twapi

ROOT = Path(__file__).resolve().parent


def load_bank(cell: str) -> list[tuple[str, str, str]]:
    path = ROOT / "niches" / cell / "queries.tsv"
    rows = []
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        q = parts[0].strip()
        types = (parts[1].strip() if len(parts) > 1 else "Both") or "Both"
        note = parts[2].strip() if len(parts) > 2 else ""
        rows.append((q, types, note))
    return rows


def main():
    cell = sys.argv[1]
    validate = "--validate" in sys.argv
    since_override = None
    if "--since" in sys.argv:
        since_override = sys.argv[sys.argv.index("--since") + 1]
    today = datetime.now(timezone.utc)
    since_top = since_override or (today - timedelta(days=30)).strftime("%Y-%m-%d")
    since_latest = since_override or (today - timedelta(days=7)).strftime("%Y-%m-%d")
    bank = load_bank(cell)
    print(f"[{cell}] {len(bank)} queries, validate={validate}", file=sys.stderr)
    for i, (q, types, note) in enumerate(bank):
        if validate:
            twapi.cmd_advsearch(f"{q} since:{since_latest}", "Latest", cell=f"{cell}", pages=1)
            continue
        if types in ("Top", "Both"):
            twapi.cmd_advsearch(f"{q} since:{since_top}", "Top", cell=cell, pages=3)
        if types in ("Latest", "Both"):
            twapi.cmd_advsearch(f"{q} since:{since_latest}", "Latest", cell=cell, pages=1)
        if i % 5 == 4:
            spent = twapi.project_spent_credits()
            print(f"  [budget] project spent ${spent/100000:.2f}", file=sys.stderr)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify it loads (no API call)**

```bash
python3 -c "import sweep; print('ok')"
```

Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add sweep.py
git commit -m "feat(x-targeting): sweep.py query-bank runner with explicit time windows"
git push mono main
```

---

### Task 8: rank_authors.py — harvest-to-shortlist (zero API cost)

**Files:**
- Create: `docs/x-targeting/rank_authors.py`

- [ ] **Step 1: Write `rank_authors.py`**

```python
#!/usr/bin/env python3
"""Rank authors harvested in a cell's sweep. Zero API cost.

Score = total engagement of their harvested tweets x sqrt(distinct queries they
appeared in). Multi-query presence beats one viral fluke. Excludes mega
accounts (>500k followers — platform officials, not replicable creators) and
accounts with <2 harvested tweets.

Usage: rank_authors.py CELL [--top 20]   -> writes niches/CELL/authors.tsv
"""
from __future__ import annotations
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TWEETS = ROOT / "cache" / "tweets.jsonl"
PROFILES = ROOT / "cache" / "profiles.jsonl"
SEARCHES = ROOT / "cache" / "searches.jsonl"


def load_jsonl(p):
    out = []
    if not p.exists():
        return out
    for line in p.read_text().split("\n"):
        if line.strip():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def main():
    cell = sys.argv[1]
    top_n = int(sys.argv[sys.argv.index("--top") + 1]) if "--top" in sys.argv else 20
    followers = {(p.get("screen_name") or "").lower(): p.get("followers_count") or 0
                 for p in load_jsonl(PROFILES)}
    eng = defaultdict(int)
    n_tweets = defaultdict(int)
    for t in load_jsonl(TWEETS):
        if t.get("cell") != cell:
            continue
        a = (t.get("screen_name") or "").lower()
        if not a:
            continue
        eng[a] += (t.get("favorites") or 0) + 3 * (t.get("retweets") or 0) \
            + 2 * (t.get("replies") or 0) + 4 * (t.get("quotes") or 0)
        n_tweets[a] += 1
    scored = []
    for a, e in eng.items():
        if n_tweets[a] < 2:
            continue
        fo = followers.get(a, 0)
        if fo > 500_000:
            continue
        scored.append((e * math.sqrt(n_tweets[a]), a, e, n_tweets[a], fo))
    scored.sort(reverse=True)
    out = ROOT / "niches" / cell / "authors.tsv"
    lines = ["# score\thandle\ttotal_eng\tn_tweets\tfollowers"]
    for s, a, e, n, fo in scored[:top_n]:
        lines.append(f"{s:.0f}\t@{a}\t{e}\t{n}\t{fo}")
    out.write_text("\n".join(lines) + "\n")
    print(f"wrote {out} ({min(top_n, len(scored))} authors)")
    for line in lines[1:11]:
        print("  " + line)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify it loads**

```bash
python3 -c "import rank_authors; print('ok')"
```

- [ ] **Step 3: Commit**

```bash
git add rank_authors.py
git commit -m "feat(x-targeting): rank_authors — engagement x presence shortlist per cell"
git push mono main
```

---

# Phase B — Query banks + validation (small API cost)

### Task 9: Write the six query banks

**Files:**
- Create: `docs/x-targeting/niches/<cell>/queries.tsv` × 6

Format: `query<TAB>types<TAB>note`. `types` ∈ Top|Latest|Both. Tab-separated, `#` comments allowed. **Copy these verbatim**, then validate in Task 10 (non-EN terms especially — drop what returns zero, note replacements in `validation.md`).

`min_faves` thresholds are deliberately lower for JP/KR (smaller scenes).

- [ ] **Step 1: `niches/trenches-en/queries.tsv`**

```
# memecoin trenches EN — platforms, culture, formats
(pumpfun OR "pump fun") min_faves:200 lang:en	Both	platform core
pumpfun filter:links min_faves:100 lang:en	Top	what links win
trenches solana min_faves:100 lang:en	Both	culture core
trenching min_faves:50 lang:en	Latest	verb form
"bonded" pumpfun min_faves:50 lang:en	Top	bonding-curve event
axiom trade min_faves:50 lang:en	Both	terminal: Axiom
@AxiomExchange min_faves:50	Top	Axiom mentions
gmgn min_faves:50 lang:en	Both	terminal: gmgn
bullx min_faves:50 lang:en	Top	terminal: BullX
photon sol min_faves:50 lang:en	Top	terminal: Photon
letsbonk min_faves:50 lang:en	Both	launchpad: bonk
believe app launch min_faves:50 lang:en	Top	launchpad: believe
"internet capital markets" min_faves:50 lang:en	Top	ICM narrative
bags fm min_faves:30 lang:en	Top	launchpad: bags
moonshot listing min_faves:50 lang:en	Top	launchpad: moonshot
memecoin gem min_faves:100 lang:en	Both	gem-caller niche
"100x" solana min_faves:100 lang:en	Top	gem-caller hyperbole
"next runner" sol min_faves:30 lang:en	Latest	caller idiom
sniping pumpfun min_faves:30 lang:en	Top	sniper niche
bundle check min_faves:30 lang:en	Top	bundler-detection niche
"dev sold" min_faves:50 lang:en	Top	rug culture
"top holders" sol min_faves:30 lang:en	Top	holder-analysis niche
smart money wallet sol min_faves:50 lang:en	Top	wallet-tracking niche
copytrading sol min_faves:30 lang:en	Top	copytrade niche
pnl pumpfun min_faves:50 lang:en	Top	pnl-flex format
"turned $" into sol min_faves:100 lang:en	Top	pnl story format
memecoin daily recap min_faves:20 lang:en	Top	recap format probe
"top 10" memecoin min_faves:50 lang:en	Top	listicle format probe
trench bot telegram min_faves:30 lang:en	Top	TG bot niche
solana volume bot min_faves:20 lang:en	Latest	greyzone tooling niche
```

- [ ] **Step 2: `niches/trenches-cn/queries.tsv`**

```
# memecoin trenches CN — 打狗 culture. lang:zh covers zh-cn+zh-tw on X search.
打狗 min_faves:50 lang:zh	Both	trench-trading core verb
土狗 sol min_faves:50 lang:zh	Both	shitcoin
金狗 min_faves:50 lang:zh	Both	golden dog = gem
(pumpfun OR pump) 内盘 min_faves:30 lang:zh	Both	bonding curve phase
外盘 sol min_faves:20 lang:zh	Top	post-migration phase
冲狗 min_faves:30 lang:zh	Both	ape-into-dogs
聪明钱 链上 min_faves:30 lang:zh	Top	smart money tracking
老鼠仓 min_faves:30 lang:zh	Top	insider bags
貔貅盘 min_faves:20 lang:zh	Top	honeypot warnings
梭哈 sol min_faves:30 lang:zh	Top	all-in culture
狙击 pump min_faves:20 lang:zh	Top	sniping
捆绑 检测 min_faves:10 lang:zh	Latest	bundle detection
gmgn min_faves:30 lang:zh	Both	gmgn is CN-dominant terminal
axiom min_faves:20 lang:zh	Top	Axiom CN reach
钱包 跟单 min_faves:30 lang:zh	Top	wallet copytrade
链上 复盘 min_faves:30 lang:zh	Top	on-chain recap format
今日 金狗 min_faves:20 lang:zh	Top	daily-gem recap format
百倍 币 min_faves:30 lang:zh	Top	100x idiom
归零 min_faves:50 lang:zh	Top	rug/zero culture
撤池子 min_faves:10 lang:zh	Latest	LP pull = rug
夹子 sol min_faves:20 lang:zh	Top	MEV sandwich bots
日内 sol 交易 min_faves:20 lang:zh	Top	intraday culture
教程 打狗 min_faves:10 lang:zh	Top	tutorial format
新币 推荐 min_faves:20 lang:zh	Latest	call format
合约地址 min_faves:30 lang:zh	Top	CA-drop format
```

- [ ] **Step 3: `niches/perps-en/queries.tsv`**

```
# perps DEX EN
hyperliquid min_faves:300 lang:en	Both	dominant venue
"perp dex" min_faves:100 lang:en	Both	category term
$HYPE min_faves:200 lang:en	Top	HL token tribe
HLP vault min_faves:30 lang:en	Top	HL vault niche
builder codes hyperliquid min_faves:20 lang:en	Top	HL ecosystem dev niche
lighter xyz min_faves:50 lang:en	Both	venue: Lighter
aster dex min_faves:50 lang:en	Both	venue: Aster
edgex min_faves:30 lang:en	Top	venue: edgeX
paradex min_faves:30 lang:en	Top	venue: Paradex
ostium min_faves:30 lang:en	Top	venue: Ostium (RWA perps)
avantis min_faves:30 lang:en	Top	venue: Avantis
extended perp min_faves:20 lang:en	Top	venue: Extended
drift protocol min_faves:30 lang:en	Top	venue: Drift (sol)
gmx min_faves:50 lang:en	Top	venue: GMX
dydx min_faves:50 lang:en	Top	venue: dYdX
funding rate arbitrage min_faves:50 lang:en	Top	funding-arb niche
"funding rates" crypto min_faves:50 lang:en	Top	data-drop format
liquidation map min_faves:50 lang:en	Top	liq-analysis format
"got liquidated" min_faves:100 lang:en	Top	loss-porn format
leverage trading crypto min_faves:100 lang:en	Top	general culture
perps points farming min_faves:30 lang:en	Both	airdrop-farming niche
"open interest" crypto min_faves:50 lang:en	Top	OI data format
copy trading perps min_faves:30 lang:en	Top	copytrade niche
paper trading crypto min_faves:30 lang:en	Top	beginner niche
prop firm crypto min_faves:30 lang:en	Top	funded-trader niche
trading journal crypto min_faves:30 lang:en	Top	journal/improvement niche
"daily pnl" trading min_faves:50 lang:en	Top	pnl-recap format
hyperliquid whale min_faves:100 lang:en	Top	whale-watch format (HL is transparent)
top traders hyperliquid min_faves:30 lang:en	Top	leaderboard format
```

- [ ] **Step 4: `niches/perps-cn/queries.tsv`**

```
# perps DEX CN — 合约 culture
永续合约 min_faves:50 lang:zh	Both	perps core term
hyperliquid min_faves:50 lang:zh	Both	HL in CN
合约 爆仓 min_faves:50 lang:zh	Both	liquidation culture
资金费率 min_faves:30 lang:zh	Top	funding-rate data niche
开单 min_faves:30 lang:zh	Latest	position-opening idiom
多单 OR 空单 min_faves:30 lang:zh	Top	long/short calls
带单 min_faves:50 lang:zh	Both	copy-trading-leader niche (huge in CN)
合约 杠杆 min_faves:30 lang:zh	Top	leverage culture
止盈 止损 min_faves:30 lang:zh	Top	TP/SL education niche
仓位管理 min_faves:30 lang:zh	Top	risk-management niche
合约 教学 min_faves:20 lang:zh	Top	tutorial format
山寨 合约 min_faves:20 lang:zh	Top	altcoin perps
链上 合约 dex min_faves:20 lang:zh	Top	on-chain perps category
大户 持仓 min_faves:30 lang:zh	Top	whale-position format
爆仓 数据 min_faves:20 lang:zh	Top	liq-data format
抄底 min_faves:50 lang:zh	Top	bottom-fishing culture
插针 min_faves:30 lang:zh	Top	wick-hunt culture
合约 复盘 min_faves:20 lang:zh	Top	trade-recap format
实盘 min_faves:30 lang:zh	Top	live-account flex format
翻倍 合约 min_faves:20 lang:zh	Top	2x flex
```

- [ ] **Step 5: `niches/perps-jp/queries.tsv`**

```
# perps DEX JP — note JP CT smaller; min_faves lower. lang:ja.
ハイパーリキッド min_faves:20 lang:ja	Both	HL katakana
hyperliquid min_faves:30 lang:ja	Both	HL romaji in JP posts
パープ DEX min_faves:10 lang:ja	Latest	category katakana
無期限 先物 min_faves:10 lang:ja	Top	perpetual futures formal
資金調達率 min_faves:10 lang:ja	Top	funding rate
清算 ロング min_faves:10 lang:ja	Top	liquidation
レバレッジ 仮想通貨 min_faves:20 lang:ja	Top	leverage crypto
ロング ショート 仮想通貨 min_faves:20 lang:ja	Top	long/short
爆損 min_faves:30 lang:ja	Top	big-loss culture (loss-porn)
爆益 min_faves:30 lang:ja	Both	big-win culture
養分 トレード min_faves:10 lang:ja	Top	exit-liquidity self-deprecation
追証 min_faves:20 lang:ja	Top	margin call (CEX term, culture carryover)
仮想通貨 トレード 手法 min_faves:20 lang:ja	Top	method/tutorial format
ビットコイン 先物 min_faves:20 lang:ja	Top	BTC futures general
デイトレ 仮想通貨 min_faves:20 lang:ja	Top	day-trading niche
損切り min_faves:30 lang:ja	Top	stop-loss discipline content
ポジション 公開 min_faves:10 lang:ja	Top	position-reveal format
トレード 記録 min_faves:10 lang:ja	Top	trade-journal format
億り人 min_faves:30 lang:ja	Top	"100M-yen person" aspiration culture
GMX OR dydx min_faves:10 lang:ja	Top	other venues in JP
```

- [ ] **Step 6: `niches/perps-kr/queries.tsv`**

```
# perps DEX KR — lang:ko. KR futures culture is CEX-heavy; DEX is the frontier.
하이퍼리퀴드 min_faves:20 lang:ko	Both	HL hangul
hyperliquid min_faves:30 lang:ko	Both	HL romaji in KR posts
무기한 선물 min_faves:10 lang:ko	Top	perpetual futures
선물 청산 min_faves:20 lang:ko	Top	liquidation
펀딩비 min_faves:10 lang:ko	Top	funding fee
레버리지 코인 min_faves:20 lang:ko	Top	leverage
롱 숏 min_faves:30 lang:ko	Both	long/short
코인 선물 min_faves:30 lang:ko	Both	coin futures general
김프 min_faves:30 lang:ko	Top	kimchi premium niche
잡코인 min_faves:30 lang:ko	Top	altcoin culture
코인 매매법 min_faves:20 lang:ko	Top	trading-method tutorial
차트 분석 코인 min_faves:30 lang:ko	Top	chart-analysis niche
수익 인증 코인 min_faves:30 lang:ko	Top	profit-verification format (KR-specific)
손절 min_faves:30 lang:ko	Top	stop-loss culture
물타기 min_faves:20 lang:ko	Top	averaging-down culture
코인 단타 min_faves:30 lang:ko	Top	scalping niche
고래 지갑 min_faves:10 lang:ko	Top	whale-wallet format
온체인 분석 min_faves:10 lang:ko	Top	on-chain analysis niche
디파이 선물 min_faves:10 lang:ko	Latest	DeFi futures category
바이낸스 선물 min_faves:30 lang:ko	Top	CEX futures (audience overlap)
```

- [ ] **Step 7: Commit**

```bash
git add niches/*/queries.tsv
git commit -m "feat(x-targeting): query banks for 6 niche-research cells (EN/CN/JP/KR)"
git push mono main
```

---

### Task 10: Validate non-EN query banks (~$0.40)

Native-idiom queries drafted by a non-native speaker WILL contain duds. One cheap Latest page each tells you which.

- [ ] **Step 1: Check budget, then validate the 4 non-EN cells**

```bash
python3 twapi.py balance   # confirm project_spent < $1 so far
python3 sweep.py trenches-cn --validate
python3 sweep.py perps-cn --validate
python3 sweep.py perps-jp --validate
python3 sweep.py perps-kr --validate
```

- [ ] **Step 2: Find the zero-result queries**

```bash
python3 - <<'EOF'
import json
from pathlib import Path
for row in [json.loads(l) for l in Path("cache/searches.jsonl").read_text().splitlines() if l.strip()]:
    if row.get("n_tweets", 0) == 0:
        print(f"{row['cell']}\t{row['query']}")
EOF
```

- [ ] **Step 3: Repair the banks**

For each zero-result query: lower `min_faves` by half, OR swap the term for a synonym you find in the tweets that DID come back (read `cache/tweets.jsonl` for the same cell — the harvest itself teaches you the live idiom). Record every change in `niches/<cell>/validation.md` as a table: `dropped term | replacement | why`. Queries whose text changed get a new dedup hash, so re-running `--validate` only re-fetches the edited ones.

- [ ] **Step 4: Commit**

```bash
git add niches/*/queries.tsv niches/*/validation.md cache/searches.jsonl
git commit -m "fix(x-targeting): validate + repair non-EN query banks against live results"
git push mono main
```

---

# Phase C — Sweep + deep-pull (the bulk of spend, ~$6)

**Concurrency rule:** after Task 2's locking, you may run at most **3 cells in parallel** (subagents). Each subagent prompt MUST include the SUBAGENT_RULES.md contract and the cell name. Sequential is also fine and easier to debug. Do NOT exceed 3 — twitterapi.io rate-limits aggressively and retries burn money.

### Task 11: Full sweep, all six cells

- [ ] **Step 1: Confirm top-up landed**

```bash
python3 twapi.py balance
```

If total < $10: STOP. Ask Max to top up, then run `python3 twapi.py rebase` (folds spend so far, resets baseline) before continuing.

- [ ] **Step 2: Run the sweeps (sequential shown; subagent-parallel allowed ≤ 3)**

```bash
python3 sweep.py trenches-en
python3 sweep.py trenches-cn
python3 sweep.py perps-en
python3 sweep.py perps-cn
python3 sweep.py perps-jp
python3 sweep.py perps-kr
```

Each prints per-query results and a budget line every 5 queries. If any cell errors mid-run, just re-run it — the searches.jsonl dedup makes re-runs resume-safe (completed queries are skipped at zero cost). **This is the no-double-fetch property working for you; do not use `--force`.**

- [ ] **Step 3: Sanity-check the harvest**

```bash
python3 - <<'EOF'
import json
from collections import Counter
from pathlib import Path
c = Counter()
for l in Path("cache/tweets.jsonl").read_text().split("\n"):
    if l.strip():
        try: c[json.loads(l).get("cell") or "-"] += 1
        except Exception: pass
print(c.most_common(10))
EOF
```

Expected: each of the 6 cells has ≥ 400 tweets. A cell under 200 means its bank is too narrow — add 5–10 queries learned from the harvest idiom and re-sweep that cell (new queries = new hashes = only the new ones fetch).

- [ ] **Step 4: Commit the data**

```bash
git add cache/tweets.jsonl cache/profiles.jsonl cache/searches.jsonl cache/twapi-ledger.jsonl
git commit -m "data(x-targeting): 6-cell niche sweep harvest"
git push mono main
```

### Task 12: Author shortlists + deep-pull

- [ ] **Step 1: Rank authors per cell (free)**

```bash
for c in trenches-en trenches-cn perps-en perps-cn perps-jp perps-kr; do
  python3 rank_authors.py $c --top 20
done
```

- [ ] **Step 2: Cache-filter then deep-pull top 15 per cell**

For EACH cell (example shows trenches-en — repeat for all six):

```bash
HANDLES=$(awk -F'\t' 'NR>1 {print $2}' niches/trenches-en/authors.tsv | head -15 | tr -d '@')
python3 cache.py needs --tweets $HANDLES > /tmp/need_trenches-en.txt
cat /tmp/need_trenches-en.txt   # see what actually needs fetching
for h in $(awk '{print $1}' /tmp/need_trenches-en.txt); do
  python3 twapi.py lasttweets "$h" --pages 3 --cell trenches-en
done
```

**The `cache.py needs` filter is mandatory** — cross-cell overlap is real (the same Hyperliquid KOL ranks in perps-en and perps-cn; the second cell must not pay again). The `--cell` tag on an already-pulled author is set on whichever cell pulled first; rank_authors already counted them via sweep tweets, so nothing is lost.

- [ ] **Step 3: Budget check + commit**

```bash
python3 twapi.py balance
git add cache/ niches/*/authors.tsv
git commit -m "data(x-targeting): author shortlists + deep-pull tweets, 6 cells"
git push mono main
```

### Task 13: Graph pass — followings of the top 3 per cell (~$0.60)

Catches niche leaders who don't surface in keyword search (the quiet kings the best accounts follow).

- [ ] **Step 1: For each cell, 1 followings page for its top 3 authors**

```bash
for c in trenches-en trenches-cn perps-en perps-cn perps-jp perps-kr; do
  for h in $(awk -F'\t' 'NR>1 {print $2}' niches/$c/authors.tsv | head -3 | tr -d '@'); do
    python3 twapi.py followings "$h" --max 200
  done
done
```

NOTE: `followings` has no dedup guard. Before running, grep the ledger so you never pay twice:

```bash
grep -o '"label": "followings:[^"]*"' cache/twapi-ledger.jsonl | sort -u
```

Skip any handle already listed there.

- [ ] **Step 2: Mine the followings for missed niche accounts (free)**

The followings landed in `profiles.jsonl` with `followed_by` edges. Find accounts followed by ≥ 2 of a cell's top authors with niche-relevant bios:

```bash
python3 - <<'EOF'
import json
from pathlib import Path
rows = [json.loads(l) for l in Path("cache/profiles.jsonl").read_text().split("\n") if l.strip()]
for r in rows:
    fb = r.get("followed_by", [])
    if len(fb) >= 2 and 1000 < (r.get("followers_count") or 0) < 500000:
        print(f"{len(fb)}x\t@{r['screen_name']}\t{(r.get('description') or '')[:90]}")
EOF
```

Eyeball the output; append genuinely-missed accounts (clear niche fit, active) to the relevant `authors.tsv` with score `0` and note `graph-pass`. If a missed account looks format-rich, deep-pull it through the same `cache.py needs` → `lasttweets --pages 3 --cell <cell>` flow (≤ 3 extra accounts per cell — this is gap-filling, not a second sweep).

- [ ] **Step 3: Commit**

```bash
git add cache/ niches/*/authors.tsv
git commit -m "data(x-targeting): graph pass — followings of top-3 per cell + missed-account gap fill"
git push mono main
```

---

# Phase D — Mining + synthesis (zero API cost)

### Task 14: Run the format miner on all cells

- [ ] **Step 1: Mine**

```bash
for c in trenches-en trenches-cn perps-en perps-cn perps-jp perps-kr; do
  python3 format_miner.py $c
done
```

Expected: each writes `niches/<cell>/formats.{json,md}` with ≥ 5 qualified formats. If a cell yields < 3 formats, its harvest is thin — go back to Task 11 Step 3's repair loop for that cell.

- [ ] **Step 2: Commit**

```bash
git add niches/*/formats.json niches/*/formats.md
git commit -m "data(x-targeting): format mining, 6 cells"
git push mono main
```

### Task 15: Niche maps — one per cell

Agent synthesis. Dispatch one subagent per cell (parallel fine — read-only on cache). Each writes `marketing/niche-research/<cell>.md`.

- [ ] **Step 1: Subagent prompt template (fill `<CELL>`, dispatch × 6)**

```
Read these files (all under /Users/maxguillabert/Downloads/index/docs/x-targeting/):
- niches/<CELL>/authors.tsv, niches/<CELL>/formats.md, niches/<CELL>/formats.json
- cache/tweets.jsonl — ONLY rows where "cell" == "<CELL>" (use grep/jq, the file is large)

Write /Users/maxguillabert/Downloads/index/marketing/niche-research/<CELL>.md with EXACTLY this structure:

# <CELL> — niche map
## TL;DR (5 bullets max: biggest niche, best underserved niche, dominant format, dominant villain, one-line opportunity)
## Sub-niches
For each sub-niche you can distinguish in the data (aim 5–10): name, one-line description,
3–8 representative accounts (handle, followers, what they post), audience size signal
(eng levels), and the niche's recurring VILLAIN (who/what the audience blames: snipers,
bundlers, CEXes, insiders, MMs, "the casino", etc).
## Audience psychology (max-marketing frame)
- Awareness level of the median audience member (unaware/problem/solution/product/most)
- Market sophistication stage (1-5) with evidence tweets
- Top 5 pains in the audience's own words — QUOTE actual harvested tweets, with URLs
- Status games: what gets flexed, what gets mocked
## Language + idiom notes
Words a content account MUST use correctly (with gloss), words that mark an outsider.
## What's missing (the gap a new account could fill)

Rules: every claim cites at least one harvested tweet URL. No invented examples —
if the data doesn't show it, write "not observed in harvest". Front-load conclusions.
Tables for any ≥3-row comparison. Do NOT call any API — this is synthesis only.
Return DONE + a 5-line summary when the file is written.
```

- [ ] **Step 2: Review each map** — spot-check 3 cited tweet URLs per file against `cache/tweets.jsonl` (the URL and text must exist there; subagent hallucination is the failure mode this catches).

- [ ] **Step 3: Commit**

```bash
git add ../../marketing/niche-research/
git commit -m "research: niche maps for 6 cells (trenches EN/CN, perps EN/CN/JP/KR)"
git push mono main
```

### Task 16: Format playbook — the replicable-content bank

The deliverable Max actually posts from. One file, cross-cell.

- [ ] **Step 1: Write `marketing/niche-research/format-playbook.md`**

Synthesize from the six `formats.md` + the six niche maps. Structure (mandatory):

```markdown
# Replicable format playbook — trenches + perps, 4 languages

## TL;DR
(Table: format | best cell(s) | median eng in harvest | effort/post | data source needed)

## Formats, ranked
For EACH format that qualified in ≥1 cell (expect 8–14):

### <format name> (e.g. "Daily top-10 runners recap")
- **Evidence:** median/p90 engagement per cell where it qualified; 2–3 exemplar links from formats.json
- **Template:** the literal post skeleton, copy-ready, with {placeholders}
  (write it in EVERY language where the format qualified — EN + 中文 + 日本語 + 한국어 as applicable,
  using idiom from the niche maps, not machine-translated EN)
- **Data source:** exactly where the numbers come from (DEX Screener API, gmgn,
  Hyperliquid public API /info endpoint, coinglass, birdeye…) + effort estimate per post
- **Cadence:** how often the exemplar accounts post it
- **Why it compounds:** what makes followers return (daily habit, utility, drama…)

## Anti-patterns observed
Formats that LOOK replicable but underperform in the harvest (with evidence).

## Glossary
Every non-EN term used above, one-line gloss each.
```

The exemplar of the genre — the @100xgemfinder daily top-10 — belongs in here IF the harvest confirms the pattern; pull its actual engagement numbers from the harvest rather than assuming.

- [ ] **Step 2: Commit + push**

```bash
git add ../../marketing/niche-research/format-playbook.md
git commit -m "research: replicable format playbook across 6 cells"
git push mono main
```

### Task 17: Close-out

- [ ] **Step 1: Final accounting**

```bash
python3 twapi.py balance
python3 twapi.py spent | head -30
```

Append a `## Cost` section to `niches/README.md`: total project spend, spend by phase (group ledger labels: `advsearch[…]` = sweep, `lasttweets:` = deep-pull, `followings:` = graph).

- [ ] **Step 2: Update the backlog**

Append to `/Users/maxguillabert/Downloads/index/backlog.md` (follow the existing format in that file): one entry naming non-obvious decisions made during execution (query terms that died, cells that needed repair, formats that surprised).

- [ ] **Step 3: Final commit**

```bash
git add niches/README.md ../../backlog.md
git commit -m "chore(x-targeting): niche-research close-out — cost accounting + backlog notes"
git push mono main
```

- [ ] **Step 4: Report to Max** — TL;DR: total cost, 6 niche-map links, playbook link, the 3 strongest account opportunities the data suggests (cell × niche × format), and what you did NOT cover (state exceptions out loud).

---

## Failure modes & what to do

| Symptom | Cause | Fix |
|---|---|---|
| `BUDGET BREACH` exit 2 | cap reached | Stop. Report spend to Max; he tops up → `twapi.py rebase` → resume |
| advsearch 402/credits error | balance empty mid-run | Same as above |
| advsearch returns 0 for a CN/JP/KR query that should hit | term is dead idiom or wrong segmentation | Use the repair loop (Task 10 Step 3) — find live idiom in the harvest itself |
| Many `delta_credits: 0` ledger rows | balance endpoint lag | Expected. Trust `project_spent_usd` from `twapi.py balance`, never per-call deltas |
| Two subagents, lost cache rows | running pre-Task-2 code | Task 2 ships first. Re-run the affected fetches — dedup keeps cost near zero |
| Re-run sweeps fetch everything again | someone used `--force` | Never `--force` in bulk runs |
| `lasttweets` returns few tweets for an active account | account is reply-heavy (last_tweets includes replies) | Fine — replies reveal formats too; the miner classifies them the same |
| Rate-limit 429s | > 3 concurrent cells | Drop to sequential |

## Self-review notes (planner)

- Spec coverage: 6 cells ✓, no-double-fetch (5 layers, Tasks 2/4/12 + protocol) ✓, budget ($15 enforced in code, rebase for top-ups) ✓, niche map ✓ (Task 15), format playbook ✓ (Task 16), native-language posting needs (idiom notes + per-language templates) ✓, launchpads incl. Axiom ✓ (trenches banks), graph pass ✓ (Task 13).
- Type consistency: `upsert_tweets(tweets, source, cell)` defined Task 2, used Tasks 4/5 ✓; `project_spent_credits` defined Task 3, used Task 7 ✓; `cell` field written Task 2, read by miner/ranker Tasks 6/8 ✓.
- Known approximation: twitterapi.io pagination field names (`next_cursor`/`has_next_page` placement) vary by endpoint; Tasks 4/5 read both top-level and `data`-nested defensively. If both miss, print the raw body once and adapt — do not loop blind.
