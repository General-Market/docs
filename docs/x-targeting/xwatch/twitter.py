"""twitterapi.io advanced_search client + a lightweight cost ledger. Stdlib only.

One page per call is the whole cost story: advanced_search bills per tweet
returned (~$0.00015 each). A min_faves filter in the query keeps the result set
tiny, so a scan that finds nothing costs almost nothing.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from . import config

log = logging.getLogger("xwatch.twitter")

BASE = "https://api.twitterapi.io"
CREDITS_PER_TWEET_EST = 15        # matches twapi.py's per-tweet estimate
CREDITS_PER_USD = 100_000


def _get(path: str, params: dict, timeout: int = 30):
    url = BASE + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, headers={"X-API-Key": config.twitter_key()})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {"error": str(e)}
    except Exception as e:
        return 0, {"error": str(e)}


def _log_cost(label: str, count: int, status: int) -> None:
    row = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "label": label,
        "count": count,
        "status": status,
        "est_credits": count * CREDITS_PER_TWEET_EST,
        "est_usd": round(count * CREDITS_PER_TWEET_EST / CREDITS_PER_USD, 5),
        "estimated": True,
    }
    with config.LEDGER_FILE.open("a") as f:
        f.write(json.dumps(row) + "\n")


def _extract_tweets(body) -> list:
    if not isinstance(body, dict):
        return []
    data = body.get("data")
    if isinstance(data, dict) and isinstance(data.get("tweets"), list):
        return data["tweets"]
    if isinstance(data, list):
        return data
    if isinstance(body.get("tweets"), list):
        return body["tweets"]
    return []


def advanced_search(query: str, query_type: str = "Latest"):
    """Return (tweets, status). Single page — the cheapest path."""
    status, body = _get(
        "/twitter/tweet/advanced_search",
        {"query": query, "queryType": query_type},
    )
    tweets = _extract_tweets(body)
    _log_cost(f"advsearch:{query[:40]}", len(tweets), status)
    if status != 200 and not tweets:
        log.warning("advanced_search status=%s body=%s", status, str(body)[:200])
    return tweets, status


def today_spend_usd() -> float:
    if not config.LEDGER_FILE.exists():
        return 0.0
    today = datetime.now(timezone.utc).date().isoformat()
    total = 0.0
    for line in config.LEDGER_FILE.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            if (row.get("ts") or "").startswith(today):
                total += row.get("est_usd", 0.0)
        except Exception:
            continue
    return round(total, 5)


def calls_today() -> int:
    if not config.LEDGER_FILE.exists():
        return 0
    today = datetime.now(timezone.utc).date().isoformat()
    n = 0
    for line in config.LEDGER_FILE.read_text().splitlines():
        if line.strip().startswith("{") and f'"{today}' in line:
            n += 1
    return n
