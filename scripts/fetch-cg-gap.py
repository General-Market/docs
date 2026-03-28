#!/usr/bin/env python3
"""
Fetch CoinGecko daily market data for a date range and save as CSV.
Uses /coins/{id}/market_chart/range per coin with rate limiting.

Usage:
    python3 scripts/fetch-cg-gap.py --since 2026-03-01 --top-n 1500

Output: scripts/cg-gap-data.csv (ready for COPY INTO postgres)
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

CG_BASE = "https://api.coingecko.com/api/v3"
RATE_LIMIT_SECS = 3.0  # Demo key: ~20 req/min
OUTPUT_FILE = Path(__file__).parent / "cg-gap-data.csv"
PROGRESS_FILE = Path(__file__).parent / "cg-gap-progress.json"

def get_api_key():
    key = os.environ.get("COINGECKO_API_KEY", "")
    if not key:
        # Try reading from data-node .env
        env_path = Path(__file__).parent.parent / "data-node" / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("COINGECKO_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not key:
        # Try envs/testnet/.env
        env_path = Path(__file__).parent.parent / "envs" / "testnet" / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("COINGECKO_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    return key

def cg_get(url, params=None, api_key=""):
    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{qs}"
    req = Request(url)
    req.add_header("User-Agent", "IndexDataNode/1.0")
    if api_key:
        req.add_header("x-cg-demo-key", api_key)

    for attempt in range(6):
        try:
            with urlopen(req, timeout=60) as resp:
                return json.loads(resp.read())
        except HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", "60"))
                print(f"  Rate limited, waiting {wait}s (attempt {attempt+1}/6)")
                time.sleep(wait)
                continue
            raise
    raise RuntimeError("Rate limited too many times")

def fetch_all_markets(api_key, limit=0):
    """Fetch coins with market cap (paginated). Stops early if limit reached."""
    all_coins = []
    page = 1
    while True:
        print(f"  Fetching markets page {page}...")
        data = cg_get(f"{CG_BASE}/coins/markets", {
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": "250",
            "page": str(page),
            "sparkline": "false",
        }, api_key)
        time.sleep(RATE_LIMIT_SECS)

        if not data:
            break
        all_coins.extend(data)
        if len(data) < 250:
            break
        # Stop early if we have enough for top_n
        if limit > 0 and len(all_coins) >= limit:
            print(f"  Got {len(all_coins)} coins, enough for top {limit}")
            break
        page += 1
        if page > 100:
            break
    return all_coins

def fetch_range(coin_id, from_date, to_date, api_key):
    """Fetch daily market chart for a date range."""
    from_ts = int(datetime.combine(from_date, datetime.min.time()).replace(tzinfo=timezone.utc).timestamp())
    to_ts = int(datetime.combine(to_date, datetime.max.time().replace(microsecond=0)).replace(tzinfo=timezone.utc).timestamp())

    data = cg_get(f"{CG_BASE}/coins/{coin_id}/market_chart/range", {
        "vs_currency": "usd",
        "from": str(from_ts),
        "to": str(to_ts),
    }, api_key)

    prices = data.get("prices", [])
    mcaps = data.get("market_caps", [])
    volumes = data.get("total_volumes", [])

    n = min(len(prices), len(mcaps), len(volumes))
    by_date = {}
    for i in range(n):
        ts_ms = int(mcaps[i][0])
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        date_str = dt.strftime("%Y-%m-%d")
        by_date[date_str] = {
            "price": prices[i][1],
            "mcap": mcaps[i][1],
            "volume": volumes[i][1],
        }
    return by_date

def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"done": []}

def save_progress(progress):
    PROGRESS_FILE.write_text(json.dumps(progress))

def main():
    parser = argparse.ArgumentParser(description="Fetch CoinGecko gap data")
    parser.add_argument("--since", required=True, help="Start date YYYY-MM-DD")
    parser.add_argument("--until", default=None, help="End date YYYY-MM-DD (default: today)")
    parser.add_argument("--top-n", type=int, default=0, help="Only top N coins by mcap (0=all)")
    parser.add_argument("--ids-file", default=None, help="JSON file with list of CoinGecko IDs to fetch (skips markets fetch)")
    parser.add_argument("--resume", action="store_true", help="Resume from progress file")
    args = parser.parse_args()

    from_date = datetime.strptime(args.since, "%Y-%m-%d").date()
    to_date = datetime.strptime(args.until, "%Y-%m-%d").date() if args.until else datetime.now(timezone.utc).date()

    api_key = get_api_key()
    if not api_key:
        print("ERROR: No COINGECKO_API_KEY found in env or .env files")
        sys.exit(1)
    print(f"API key: {api_key[:8]}...")

    # Step 1: Get coin list
    if args.ids_file:
        # Targeted mode: fetch specific CoinGecko IDs (no markets fetch needed)
        print(f"\n=== Step 1: Loading coin IDs from {args.ids_file} ===")
        with open(args.ids_file) as f:
            cg_ids = json.load(f)
        coins = [{"id": cid, "symbol": "", "name": "", "market_cap": None, "current_price": None, "total_volume": None, "market_cap_rank": None} for cid in cg_ids]
        print(f"  {len(coins)} coins from IDs file")
    else:
        print(f"\n=== Step 1: Fetching coin list ===")
        all_coins = fetch_all_markets(api_key, limit=args.top_n)
        # Deduplicate
        seen = set()
        coins = []
        for c in all_coins:
            cid = c.get("id", "")
            if cid and cid not in seen and (c.get("market_cap") or 0) > 0:
                seen.add(cid)
                coins.append(c)

        if args.top_n > 0:
            coins = coins[:args.top_n]

    print(f"  {len(coins)} coins to process")

    # Step 2: Store today's snapshot from markets data
    print(f"\n=== Step 2: Writing today's snapshot + fetching range {from_date} → {to_date} ===")

    progress = load_progress() if args.resume else {"done": []}
    done_set = set(progress["done"])

    # Open CSV in append mode if resuming
    mode = "a" if args.resume and OUTPUT_FILE.exists() else "w"
    with open(OUTPUT_FILE, mode, newline="") as f:
        writer = csv.writer(f)
        if mode == "w":
            writer.writerow(["coin_id", "symbol", "name", "snapshot_date", "price_usd", "market_cap_usd", "total_volume_usd", "market_cap_rank"])

        # Write today's data from the markets response (skip for --ids-file mode)
        if not args.ids_file:
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            for c in coins:
                writer.writerow([
                    c["id"],
                    c.get("symbol", ""),
                    c.get("name", ""),
                    today_str,
                    c.get("current_price"),
                    c.get("market_cap"),
                    c.get("total_volume"),
                    c.get("market_cap_rank"),
                ])

        # Step 3: Fetch range data per coin
        total = len(coins)
        skipped = 0
        failed = 0
        t0 = time.time()

        for i, c in enumerate(coins):
            cid = c["id"]
            if cid in done_set:
                skipped += 1
                continue

            try:
                daily = fetch_range(cid, from_date, to_date, api_key)
                for date_str, vals in sorted(daily.items()):
                    writer.writerow([
                        cid,
                        c.get("symbol", ""),
                        c.get("name", ""),
                        date_str,
                        vals["price"],
                        vals["mcap"],
                        vals["volume"],
                        None,  # no rank in historical
                    ])

                done_set.add(cid)
                progress["done"].append(cid)

                elapsed = time.time() - t0
                rate = (i + 1 - skipped) / max(elapsed, 1)
                remaining = (total - i - 1) / max(rate, 0.01)
                days = len(daily)

                if (i + 1) % 50 == 0 or i + 1 == total:
                    print(f"  [{i+1}/{total}] {cid} — {days} days — ETA {remaining:.0f}s ({rate:.1f} coins/s)")
                else:
                    print(f"  [{i+1}/{total}] {cid} — {days} days")

                # Save progress every 50 coins
                if (i + 1) % 50 == 0:
                    save_progress(progress)
                    f.flush()

            except Exception as e:
                failed += 1
                print(f"  [{i+1}/{total}] {cid} — FAILED: {e}")

            time.sleep(RATE_LIMIT_SECS)

    save_progress(progress)

    elapsed = time.time() - t0
    print(f"\n=== Done ===")
    print(f"  Coins: {total} ({skipped} skipped, {failed} failed)")
    print(f"  Time: {elapsed:.0f}s")
    print(f"  Output: {OUTPUT_FILE}")
    print(f"  Size: {OUTPUT_FILE.stat().st_size / 1024 / 1024:.1f} MB")
    print(f"\nNext steps:")
    print(f"  1. scp {OUTPUT_FILE} index-maker/prod/be:/tmp/cg-gap-data.csv")
    print(f"  2. SSH to VPS and run the import SQL")

if __name__ == "__main__":
    main()
