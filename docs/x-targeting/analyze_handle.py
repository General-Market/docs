#!/usr/bin/env python3
"""Engagement analyzer for a single X handle.

Pulls every post + reply via twitterapi.io advanced_search (paginated),
fetches the parent tweet for each reply so reply context is preserved,
caches everything to docs/x-targeting/cache/tweets.jsonl, and writes a
markdown report ranking what works.

Designed to be cheap on re-runs: a sidecar file (cache/<handle>-last-fetch.json)
records the most recent fetch timestamp. If the cache is fresher than
--max-age-hours (default 24), the analysis runs against the cache only —
zero API spend.

Usage:
  ./analyze_handle.py max_otc                          # default: 24h cache, 30d lookback
  ./analyze_handle.py max_otc --force                  # skip cache, refetch
  ./analyze_handle.py max_otc --days 90                # widen lookback
  ./analyze_handle.py max_otc --max-pages 20           # cap pagination
"""
from __future__ import annotations
import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"
LEDGER = CACHE / "twapi-ledger.jsonl"
KEY_FILE = Path("/tmp/.twapi_key")
BASE = "https://api.twitterapi.io"
CREDITS_PER_USD = 100_000


# ── lightweight HTTP + ledger ────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _key() -> str:
    return KEY_FILE.read_text().strip()


def _get(path: str, params: dict | None = None, timeout: int = 30) -> tuple[int, dict]:
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"X-API-Key": _key()})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {"error": e.reason}
    except (TimeoutError, OSError) as e:
        return 408, {"error": str(e)}


def _balance() -> int:
    _, body = _get("/oapi/my/info")
    return body.get("recharge_credits", 0) + body.get("total_bonus_credits", 0)


def _ledger(row: dict) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _metered(label: str, path: str, params: dict) -> dict:
    before = _balance()
    status, body = _get(path, params)
    after = _balance()
    delta = before - after
    print(f"  ↳ {label}  bal={after}  Δ={delta}c", file=sys.stderr)
    _ledger({
        "ts": _now_iso(), "label": label, "path": path, "params": params,
        "status": status, "credits_before": before, "credits_after": after,
        "delta_credits": delta, "delta_usd": round(delta / CREDITS_PER_USD, 5),
    })
    return body


# ── jsonl helpers ───────────────────────────────────────────────────────
# tweets.jsonl is large and not strictly newline-delimited because some
# legacy writers serialized multi-line text without escaping. Read defensively.

def _load_jsonl(p: Path) -> list[dict]:
    if not p.exists():
        return []
    rows: list[dict] = []
    bad = 0
    for line in p.read_text(errors="replace").splitlines():
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            bad += 1
    if bad:
        print(f"  (skipped {bad} malformed line(s) in {p.name})", file=sys.stderr)
    return rows


def _write_jsonl(p: Path, rows: list[dict]) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w") as f:
        for r in rows:
            # ensure_ascii=False is fine; the file is jsonl per row so newlines in
            # text must be json-escaped. json.dumps handles that automatically.
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _tweet_row(t: dict, source: str) -> dict:
    """Normalize a twitterapi.io tweet object into our cache shape."""
    author = (t.get("author") or {}).get("userName") or t.get("authorName")
    return {
        "tweet_id": str(t.get("id")),
        "screen_name": author,
        "type": "tweet",
        "text": t.get("text"),
        "created_at": t.get("createdAt"),
        "favorites": t.get("likeCount", 0),
        "retweets": t.get("retweetCount", 0),
        "replies": t.get("replyCount", 0),
        "quotes": t.get("quoteCount", 0),
        "views": t.get("viewCount"),
        "bookmarks": t.get("bookmarkCount", 0),
        "lang": t.get("lang"),
        "url": t.get("url"),
        "in_reply_to_screen_name": t.get("inReplyToUsername") or t.get("inReplyToUserName"),
        "in_reply_to_status_id_str": t.get("inReplyToId"),
        "conversation_id": t.get("conversationId"),
        "is_reply": t.get("isReply"),
        "is_quote": t.get("isQuoteTweet"),
        "source_run": source,
        "cached_at": _now_iso(),
    }


def _upsert(by_id: dict[str, dict], tweets: list[dict], source: str) -> int:
    n_new = 0
    for t in tweets:
        tid = str(t.get("id") or "")
        if not tid:
            continue
        row = _tweet_row(t, source)
        if tid not in by_id:
            n_new += 1
        # Always update — engagement numbers drift, parent rows can land richer.
        by_id[tid] = row
    return n_new


# ── fetch pipeline ──────────────────────────────────────────────────────

def fetch_handle(handle: str, days: int, max_pages: int) -> tuple[int, int]:
    """Paginate advanced_search for the handle's posts + replies, then fetch
    the parent of every reply. Returns (own_new, parents_new)."""
    handle = handle.lstrip("@")
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    # Twitter's search index excludes replies by default; `include:replies`
    # forces them back in. Some indexers also need `filter:replies` to get the
    # union with originals — we run both queries and dedup on tweet_id.
    # `from:USER` already includes replies on twitterapi.io; adding
    # `include:replies` makes the response empty. The provider returns tweets
    # at the top level (not nested under `data`) and ranks by recency.
    own_tweets: list[dict] = []
    seen_ids: set[str] = set()
    cursor = ""
    page = 0
    query = f"from:{handle} since:{since}"
    while page < max_pages:
        params = {"query": query, "queryType": "Latest"}
        if cursor:
            params["cursor"] = cursor
        body = _metered(f"advsearch:{handle}:p{page}", "/twitter/tweet/advanced_search", params)
        batch = body.get("tweets") or []
        if not isinstance(batch, list):
            batch = []
        added = 0
        for t in batch:
            tid = str(t.get("id") or "")
            if tid and tid not in seen_ids:
                own_tweets.append(t)
                seen_ids.add(tid)
                added += 1
        cursor = body.get("next_cursor") or ""
        has_next = bool(body.get("has_next_page")) and bool(cursor)
        print(f"  page {page}: +{added} (cum {len(own_tweets)})  cursor={'yes' if cursor else 'no'}",
              file=sys.stderr)
        page += 1
        if not has_next or added == 0:
            break

    # Persist
    by_id = {r["tweet_id"]: r for r in _load_jsonl(TWEETS) if r.get("tweet_id")}
    own_new = _upsert(by_id, own_tweets, source=f"analyze:{handle}")

    # Collect parents we need
    needed_parents = {
        str(t.get("inReplyToId"))
        for t in own_tweets
        if t.get("inReplyToId") and str(t.get("inReplyToId")) not in by_id
    }
    parents_new = 0
    if needed_parents:
        ids = list(needed_parents)
        # /twitter/tweets accepts comma-separated tweet_ids; conservative batch 50.
        batch_size = 50
        for i in range(0, len(ids), batch_size):
            chunk = ids[i : i + batch_size]
            body = _metered(
                f"parents:{handle}:b{i // batch_size}",
                "/twitter/tweets",
                {"tweet_ids": ",".join(chunk)},
            )
            ts = body.get("tweets", []) if isinstance(body, dict) else []
            parents_new += _upsert(by_id, ts, source=f"analyze-parent:{handle}")

    _write_jsonl(TWEETS, list(by_id.values()))
    return own_new, parents_new


# ── analysis ────────────────────────────────────────────────────────────

def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    for fmt in ("%a %b %d %H:%M:%S %z %Y",):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _int(v) -> int:
    try:
        return int(v or 0)
    except Exception:
        return 0


def _engagement(t: dict) -> int:
    """Weighted: likes 1, RT 3, reply 2, quote 4, bookmark 2.
    Quote and bookmark cost more attention than a like, so they're worth more."""
    return _int(t.get("favorites")) + 3 * _int(t.get("retweets")) + 2 * _int(t.get("replies")) \
        + 4 * _int(t.get("quotes")) + 2 * _int(t.get("bookmarks"))


def _length_bucket(n: int) -> str:
    if n < 40: return "tiny <40"
    if n < 100: return "short 40-99"
    if n < 200: return "medium 100-199"
    if n < 280: return "long 200-279"
    return "thread-bait 280+"


def _engagement_rate(t: dict) -> float | None:
    """Likes per 1k views — only meaningful when views > ~50."""
    v = _int(t.get("views"))
    if v < 50:
        return None
    return _int(t.get("favorites")) * 1000.0 / v


def analyze(handle: str, out_path: Path) -> None:
    handle_l = handle.lstrip("@").lower()
    all_rows = _load_jsonl(TWEETS)
    by_id = {r.get("tweet_id"): r for r in all_rows if r.get("tweet_id")}
    own = [r for r in all_rows if (r.get("screen_name") or "").lower() == handle_l]

    if not own:
        out_path.write_text(f"# @{handle}\n\nNo tweets cached. Run with --force.\n")
        return

    # Split posts vs replies. Replies whose target user equals the handle itself
    # are still replies — they're self-threads, which behave like longer posts.
    posts = [t for t in own if not t.get("in_reply_to_status_id_str")]
    replies = [t for t in own if t.get("in_reply_to_status_id_str")]

    def _top(rows: list[dict], k: int, key=_engagement) -> list[dict]:
        return sorted(rows, key=key, reverse=True)[:k]

    def _stat(rows: list[dict], key=_engagement) -> dict:
        if not rows:
            return {"n": 0, "median": 0, "max": 0, "mean": 0}
        vals = sorted(key(t) for t in rows)
        n = len(vals)
        return {
            "n": n,
            "median": vals[n // 2],
            "max": vals[-1],
            "mean": round(sum(vals) / n, 1),
        }

    overall_post = _stat(posts)
    overall_reply = _stat(replies)

    # Hour-of-day pivot on engagement (UTC).
    hour_bucket: dict[int, list[int]] = defaultdict(list)
    for t in own:
        d = _parse_date(t.get("created_at"))
        if not d:
            continue
        hour_bucket[d.astimezone(timezone.utc).hour].append(_engagement(t))
    hour_stats = sorted(hour_bucket.items())

    # Length bucket pivot.
    length_bucket: dict[str, list[int]] = defaultdict(list)
    for t in own:
        text = t.get("text") or ""
        length_bucket[_length_bucket(len(text))].append(_engagement(t))
    length_order = ["tiny <40", "short 40-99", "medium 100-199", "long 200-279", "thread-bait 280+"]

    # Reply-context analysis: which target authors yield highest engagement?
    by_target_author = defaultdict(list)
    for r in replies:
        parent_id = r.get("in_reply_to_status_id_str")
        parent = by_id.get(parent_id)
        if parent:
            target = (parent.get("screen_name") or "").lower()
        else:
            target = (r.get("in_reply_to_screen_name") or "").lower()
        if target:
            by_target_author[target].append(_engagement(r))
    target_rank = sorted(
        ((u, sum(v), len(v), max(v), round(sum(v) / len(v), 1)) for u, v in by_target_author.items()),
        key=lambda x: -x[1],
    )[:20]

    # Word-level signal: which words appear disproportionately in the top
    # quartile of engagement vs the bottom? Crude but reveals voice patterns.
    def _tokens(text: str) -> list[str]:
        text = re.sub(r"https?://\S+", " ", text.lower())
        text = re.sub(r"@\w+", " ", text)
        text = re.sub(r"#\w+", " ", text)
        return [w for w in re.findall(r"[a-z][a-z']{2,}", text)
                if w not in STOPWORDS and len(w) >= 3]

    STOPWORDS = set("""a an and are as at be but by can could did do does for from
        had has have he her him his how i if in is it its just like me my no not of
        on or our out so some that the their them then there they this to too us
        was we were what when where which who why will with would you your yours
        am about all any been being get got had has have its more most much only
        own same than too very don wasn""".split())

    eng_sorted = sorted(own, key=_engagement)
    if len(eng_sorted) >= 8:
        q = len(eng_sorted) // 4
        bottom = eng_sorted[:q]
        top = eng_sorted[-q:]
        top_words = Counter(w for t in top for w in _tokens(t.get("text") or ""))
        bot_words = Counter(w for t in bottom for w in _tokens(t.get("text") or ""))
        # Lift = relative frequency in top vs bottom; require min count in top.
        lift = []
        for w, c in top_words.items():
            if c < 2: continue
            base = bot_words.get(w, 0)
            ratio = (c + 1) / (base + 1)
            lift.append((w, c, base, round(ratio, 2)))
        lift.sort(key=lambda x: (-x[3], -x[1]))
        top_lift = lift[:20]
    else:
        top_lift = []

    # ── render report ────────────────────────────────────────────────────
    def _fmt(t: dict) -> str:
        link = t.get("url") or ""
        text = (t.get("text") or "").replace("\n", " ").strip()
        eng = _engagement(t)
        v = _int(t.get("views"))
        rate = _engagement_rate(t)
        rate_s = f" · {rate:.1f}♥/1k" if rate is not None else ""
        return (
            f"- **{eng}eng** "
            f"(♥{_int(t.get('favorites'))} ↻{_int(t.get('retweets'))} "
            f"💬{_int(t.get('replies'))} ❝{_int(t.get('quotes'))} "
            f"🔖{_int(t.get('bookmarks'))} 👀{v}{rate_s}) "
            f"{(t.get('created_at') or '')[:16]} — {text[:240]}{'…' if len(text) > 240 else ''}"
            + (f" [{link}]({link})" if link else "")
        )

    def _fmt_reply_with_parent(r: dict) -> str:
        parent = by_id.get(r.get("in_reply_to_status_id_str") or "")
        head = _fmt(r)
        if parent:
            ptext = (parent.get("text") or "").replace("\n", " ").strip()
            pauthor = parent.get("screen_name") or r.get("in_reply_to_screen_name") or "?"
            head += (
                f"\n  - ↳ replying to **@{pauthor}** "
                f"(♥{_int(parent.get('favorites'))} ↻{_int(parent.get('retweets'))}): "
                f"{ptext[:200]}{'…' if len(ptext) > 200 else ''}"
            )
        else:
            pauthor = r.get("in_reply_to_screen_name") or "?"
            head += f"\n  - ↳ replying to **@{pauthor}** (parent not in cache)"
        return head

    lines = []
    P = lines.append
    P(f"# @{handle} — engagement analysis")
    P("")
    P(f"_generated {_now_iso()[:19]}Z from {len(own)} cached tweets ({len(posts)} posts, {len(replies)} replies)_")
    P("")
    P(f"Engagement score = likes + 3·RTs + 2·replies + 4·quotes + 2·bookmarks. "
      f"♥/1k = like-rate per thousand views, only shown when views ≥ 50.")
    P("")

    P("## Volume + averages")
    P("")
    P("| bucket | n | median eng | mean eng | max eng |")
    P("|---|---|---|---|---|")
    P(f"| posts | {overall_post['n']} | {overall_post['median']} | {overall_post['mean']} | {overall_post['max']} |")
    P(f"| replies | {overall_reply['n']} | {overall_reply['median']} | {overall_reply['mean']} | {overall_reply['max']} |")
    P("")

    P("## Top 15 posts")
    P("")
    for t in _top(posts, 15):
        P(_fmt(t))
    P("")

    P("## Top 15 replies (with parent for context)")
    P("")
    for r in _top(replies, 15):
        P(_fmt_reply_with_parent(r))
    P("")

    P("## Bottom 10 posts — what fell flat")
    P("")
    for t in sorted(posts, key=_engagement)[:10]:
        P(_fmt(t))
    P("")

    if target_rank:
        P("## Best reply targets (by total engagement of your replies to them)")
        P("")
        P("| target | total eng | replies | max | mean |")
        P("|---|---|---|---|---|")
        for u, total, n, mx, mean in target_rank:
            P(f"| @{u} | {total} | {n} | {mx} | {mean} |")
        P("")

    P("## Engagement by hour of day (UTC)")
    P("")
    P("| hour | n | median eng | max eng |")
    P("|---|---|---|---|")
    for h, vals in hour_stats:
        vs = sorted(vals)
        med = vs[len(vs) // 2]
        P(f"| {h:02d}:00 | {len(vs)} | {med} | {max(vs)} |")
    P("")

    P("## Engagement by tweet length")
    P("")
    P("| length | n | median eng | max eng |")
    P("|---|---|---|---|")
    for b in length_order:
        vs = sorted(length_bucket.get(b, []))
        if not vs:
            continue
        med = vs[len(vs) // 2]
        P(f"| {b} | {len(vs)} | {med} | {max(vs)} |")
    P("")

    if top_lift:
        P("## Words overrepresented in your top quartile vs bottom quartile")
        P("")
        P("| word | top count | bottom count | lift |")
        P("|---|---|---|---|")
        for w, c, base, ratio in top_lift:
            P(f"| {w} | {c} | {base} | {ratio}× |")
        P("")

    # Pattern observations — opinionated, not exhaustive.
    obs = []
    if overall_reply["mean"] > overall_post["mean"] > 0:
        obs.append("Replies outperform original posts on average — your voice lands better when it has a counterparty.")
    if overall_post["mean"] >= overall_reply["mean"] > 0:
        obs.append("Original posts outperform replies on average — the energy is in standalone statements, not threads.")
    if hour_stats:
        best_h = max(hour_stats, key=lambda kv: (sum(kv[1]) / len(kv[1])) if kv[1] else 0)
        obs.append(f"Highest mean engagement hour (UTC): {best_h[0]:02d}:00.")
    if length_bucket:
        non_empty = [(b, length_bucket[b]) for b in length_order if length_bucket.get(b)]
        if non_empty:
            best_len = max(non_empty, key=lambda kv: sum(kv[1]) / len(kv[1]))
            obs.append(f"Length sweet spot by mean engagement: **{best_len[0]}**.")
    if obs:
        P("## Patterns")
        P("")
        for o in obs:
            P(f"- {o}")
        P("")

    out_path.write_text("\n".join(lines))


# ── orchestrator ────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("handle")
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--max-pages", type=int, default=20)
    ap.add_argument("--max-age-hours", type=int, default=24,
                    help="skip API if cache fetched within this window")
    ap.add_argument("--force", action="store_true", help="ignore cache freshness")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    handle = args.handle.lstrip("@")
    out_path = args.out or (ROOT / f"{handle}-analysis.md")
    sidecar = CACHE / f"{handle}-last-fetch.json"

    fresh = False
    if sidecar.exists() and not args.force:
        try:
            meta = json.loads(sidecar.read_text())
            last = datetime.fromisoformat(meta["ts"])
            age_h = (datetime.now(timezone.utc) - last).total_seconds() / 3600
            if age_h <= args.max_age_hours:
                fresh = True
                print(f"  ↳ cache fresh ({age_h:.1f}h ≤ {args.max_age_hours}h), skipping fetch",
                      file=sys.stderr)
        except Exception:
            pass

    if not fresh:
        print(f"  ↳ fetching @{handle} (days={args.days}, max-pages={args.max_pages})",
              file=sys.stderr)
        own_new, parents_new = fetch_handle(handle, args.days, args.max_pages)
        print(f"  ↳ +{own_new} own tweets, +{parents_new} parents", file=sys.stderr)
        sidecar.parent.mkdir(parents=True, exist_ok=True)
        sidecar.write_text(json.dumps({
            "ts": _now_iso(),
            "handle": handle,
            "days": args.days,
            "max_pages": args.max_pages,
            "own_new": own_new,
            "parents_new": parents_new,
        }, indent=2))

    analyze(handle, out_path)
    print(f"  ↳ wrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
