"""twitterapi.io client + a lightweight cost ledger. Stdlib only, no fork.

Modeled on docs/x-targeting/xwatch/twitter.py — single-page calls, urllib, per-call cost
estimate written to a JSONL ledger. Deliberately does NOT use twapi.py's HTTP layer, which
forks a process per call (multiprocessing + fcntl) and is unsafe inside an async loop.
Blocking calls are meant to be run via asyncio.to_thread.

advanced_search bills per tweet returned (~15 credits ≈ $0.00015 each), so a scan that finds
nothing costs almost nothing. user_last_tweets / user_followings page at 20 / 200 per call.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("hyperfeed.twitter")

BASE = "https://api.twitterapi.io"
CREDITS_PER_TWEET_EST = 15        # matches twapi.py's per-tweet estimate
CREDITS_PER_USD = 100_000


def _coerce_int(v) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


class Twitter:
    def __init__(self, key: str, ledger_file: Path):
        self._key = key
        self._ledger = ledger_file

    def has_key(self) -> bool:
        return bool(self._key)

    # -- HTTP ----------------------------------------------------------------
    def _get(self, path: str, params: dict, timeout: int = 30):
        if not self._key:
            return 0, {"error": "no twitterapi.io key"}
        url = BASE + path + ("?" + urllib.parse.urlencode(params) if params else "")
        req = urllib.request.Request(url, headers={"X-API-Key": self._key})
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

    def _log_cost(self, label: str, count: int, status: int) -> None:
        row = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "label": label,
            "count": count,
            "status": status,
            "est_credits": count * CREDITS_PER_TWEET_EST,
            "est_usd": round(count * CREDITS_PER_TWEET_EST / CREDITS_PER_USD, 5),
            "estimated": True,
        }
        try:
            with self._ledger.open("a") as f:
                f.write(json.dumps(row) + "\n")
        except Exception as e:
            log.warning("ledger write failed: %s", e)

    # -- response shape helpers ---------------------------------------------
    @staticmethod
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

    @staticmethod
    def _cursor(body) -> tuple[str, bool]:
        if not isinstance(body, dict):
            return "", False
        data = body.get("data") if isinstance(body.get("data"), dict) else {}
        cursor = body.get("next_cursor") or data.get("next_cursor") or ""
        has_next = bool(body.get("has_next_page", data.get("has_next_page", False)))
        return cursor, has_next

    # -- endpoints -----------------------------------------------------------
    def advanced_search(self, query: str, query_type: str = "Latest") -> tuple[list, int]:
        """Single page — the cheapest path. Returns (tweets, http_status)."""
        status, body = self._get(
            "/twitter/tweet/advanced_search",
            {"query": query, "queryType": query_type},
        )
        tweets = self._extract_tweets(body)
        self._log_cost(f"advsearch:{query[:48]}", len(tweets), status)
        if status not in (200, 0) and not tweets:
            log.warning("advanced_search status=%s body=%s", status, str(body)[:200])
        return tweets, status

    def user_last_tweets(self, handle: str, pages: int = 1) -> tuple[list, int]:
        """Recent tweets for one account, paginated. Returns (tweets, last_status)."""
        handle = handle.lstrip("@")
        out: list = []
        cursor = ""
        status = 0
        for p in range(max(1, pages)):
            params = {"userName": handle}
            if cursor:
                params["cursor"] = cursor
            status, body = self._get("/twitter/user/last_tweets", params)
            batch = self._extract_tweets(body)
            self._log_cost(f"lasttweets:{handle}:p{p}", len(batch), status)
            if not batch:
                break
            out.extend(batch)
            cursor, has_next = self._cursor(body)
            if not has_next or not cursor:
                break
        return out, status

    def user_followings(self, handle: str, max_results: int = 200) -> tuple[list, int]:
        """Accounts that `handle` follows, paginated. Returns (users, last_status)."""
        handle = handle.lstrip("@")
        out: list = []
        cursor = ""
        status = 0
        page = 0
        while len(out) < max_results:
            params = {"userName": handle, "pageSize": "200"}
            if cursor:
                params["cursor"] = cursor
            status, body = self._get("/twitter/user/followings", params)
            data = body.get("data") if isinstance(body.get("data"), dict) else {}
            batch = body.get("followings") or (data.get("followings", []) if data else [])
            self._log_cost(f"followings:{handle}:p{page}", len(batch), status)
            page += 1
            if not batch:
                break
            out.extend(batch)
            cursor, has_next = self._cursor(body)
            if not has_next or not cursor:
                break
        return out[:max_results], status

    # -- cost reporting ------------------------------------------------------
    def today_spend_usd(self) -> float:
        if not self._ledger.exists():
            return 0.0
        today = datetime.now(timezone.utc).date().isoformat()
        total = 0.0
        for line in self._ledger.read_text().splitlines():
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

    def calls_today(self) -> int:
        if not self._ledger.exists():
            return 0
        today = datetime.now(timezone.utc).date().isoformat()
        return sum(
            1 for line in self._ledger.read_text().splitlines()
            if line.strip().startswith("{") and f'"{today}' in line
        )
