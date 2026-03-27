#!/usr/bin/env python3
"""
Fetch daily OHLC candles from Bitget for all pairs in symbol-map.json.
Covers March 1–25, 2026. Outputs JSON keyed by pair symbol.

Usage:
    python3 scripts/fetch_march_daily.py

Output:
    scripts/bitget_daily_march.json
"""

import json
import time
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

SYMBOL_MAP = Path(__file__).parent.parent / "frontend" / "data" / "symbol-map.json"
OUTPUT = Path(__file__).parent / "bitget_daily_march.json"

# March 1 00:00 UTC → March 26 00:00 UTC (captures all of March 25)
START_MS = int(datetime(2026, 3, 1, tzinfo=timezone.utc).timestamp() * 1000)
END_MS = int(datetime(2026, 3, 26, tzinfo=timezone.utc).timestamp() * 1000)

BITGET_URL = "https://api.bitget.com/api/v2/spot/market/history-candles"
RATE_LIMIT_DELAY = 0.12  # ~8 req/sec, well under public rate limit


def fetch_daily_candles(symbol: str) -> list[dict]:
    """Fetch daily candles for one symbol. Returns list of {ts, open, high, low, close, volume}."""
    params = f"symbol={symbol}&granularity=1day&endTime={END_MS}&limit=200"
    url = f"{BITGET_URL}?{params}"

    req = Request(url, headers={"User-Agent": "index-backfill/1.0"})

    try:
        with urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
    except (HTTPError, URLError, TimeoutError) as e:
        print(f"  FAIL {symbol}: {e}", file=sys.stderr)
        return []

    if body.get("code") != "00000":
        msg = body.get("msg", "unknown")
        print(f"  FAIL {symbol}: API error {msg}", file=sys.stderr)
        return []

    rows = body.get("data", [])
    candles = []
    for row in rows:
        if len(row) < 6:
            continue
        ts = int(row[0])
        # Filter to March only
        if ts < START_MS or ts >= END_MS:
            continue
        candles.append({
            "ts": ts,
            "date": datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d"),
            "open": row[1],
            "high": row[2],
            "low": row[3],
            "close": row[4],
            "volume": row[5],
        })

    candles.sort(key=lambda c: c["ts"])
    return candles


def main():
    # Load unique pairs from symbol-map.json
    with open(SYMBOL_MAP) as f:
        raw = json.load(f)
    pairs = sorted(set(v["pair"] for v in raw.values()))
    print(f"Fetching daily candles for {len(pairs)} Bitget pairs, March 2026...")

    results = {}
    fetched = 0
    empty = 0
    failed = 0

    for i, pair in enumerate(pairs):
        candles = fetch_daily_candles(pair)
        if candles:
            results[pair] = candles
            fetched += 1
        else:
            empty += 1

        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(pairs)} done ({fetched} with data, {empty} empty)")

        time.sleep(RATE_LIMIT_DELAY)

    # Write output
    with open(OUTPUT, "w") as f:
        json.dump(results, f, indent=1)

    total_candles = sum(len(v) for v in results.values())
    print(f"\nDone. {fetched} pairs with data, {empty} empty/failed.")
    print(f"Total candles: {total_candles}")
    print(f"Output: {OUTPUT}")


if __name__ == "__main__":
    main()
