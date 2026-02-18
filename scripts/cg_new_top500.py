#!/usr/bin/env python3
"""
Fetch current top 500 coins from CoinGecko Pro API, backfill historical
monthly market caps into PostgreSQL, then find coins that are completely
new in the top 500 in February 2026 (never in top 500 before).

Strategy:
  1. Fetch current top 500 via /coins/markets (2 calls)
  2. Backfill: for each coin, fetch /coins/{id}/market_chart?days=max&interval=monthly
  3. Store all data in coingecko_market_caps table
  4. Query DB: coins in Feb 2026 top 500 with no data before Feb 2026
  5. Output CSV

Uses CoinGecko Pro API (~7 req/s).
"""

import json
import time
import csv
import sys
import os
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.error import HTTPError

BASE = "https://pro-api.coingecko.com/api/v3"
API_KEY = os.environ.get("CG_API_KEY", "CG-bRYVgxBJ29Vthwj4sZbWMJY6")
RATE_LIMIT_DELAY = 0.15  # Pro: 500 req/min ≈ 8.3/s, stay at ~7/s


def fetch_json(url, retries=5):
    for attempt in range(retries):
        time.sleep(RATE_LIMIT_DELAY)
        try:
            req = Request(
                url,
                headers={
                    "Accept": "application/json",
                    "x-cg-pro-api-key": API_KEY,
                },
            )
            with urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except HTTPError as e:
            if e.code == 429:
                wait = 30 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...", file=sys.stderr)
                time.sleep(wait)
            else:
                body = ""
                try:
                    body = e.read().decode()[:200]
                except:
                    pass
                print(
                    f"  HTTP {e.code} on attempt {attempt+1}: {body}",
                    file=sys.stderr,
                )
                if attempt == retries - 1:
                    raise
        except Exception as e:
            print(f"  Error: {e}, attempt {attempt+1}/{retries}", file=sys.stderr)
            if attempt == retries - 1:
                raise
            time.sleep(5)


def fetch_top_n(n=500):
    """Fetch top N coins by market cap."""
    all_coins = []
    per_page = 250
    pages = (n + per_page - 1) // per_page

    for page in range(1, pages + 1):
        print(f"Fetching markets page {page}/{pages}...", file=sys.stderr)
        url = (
            f"{BASE}/coins/markets?vs_currency=usd"
            f"&order=market_cap_desc&per_page={per_page}&page={page}&sparkline=false"
        )
        coins = fetch_json(url)
        all_coins.extend(coins)
        print(f"  Got {len(coins)} (total: {len(all_coins)})", file=sys.stderr)

    return all_coins[:n]


def main():
    print("=" * 60, file=sys.stderr)
    print("CoinGecko Pro: Find NEW top-500 entrants in Feb 2026", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # Step 1: Fetch current top 500
    print("\n[Step 1] Fetching current top 500...", file=sys.stderr)
    top500 = fetch_top_n(500)
    print(f"  Fetched {len(top500)} coins", file=sys.stderr)

    # Build lookup
    current = {}
    for c in top500:
        current[c["id"]] = {
            "id": c["id"],
            "symbol": (c.get("symbol") or "").upper(),
            "name": c.get("name", ""),
            "rank": c.get("market_cap_rank"),
            "market_cap": c.get("market_cap"),
            "price": c.get("current_price"),
            "volume_24h": c.get("total_volume"),
            "fully_diluted_valuation": c.get("fully_diluted_valuation"),
            "ath": c.get("ath"),
            "ath_date": (c.get("ath_date") or "")[:10],
            "atl_date": (c.get("atl_date") or "")[:10],
            "price_change_24h_pct": c.get("price_change_percentage_24h"),
        }

    # Step 2: For each coin, fetch historical monthly market caps
    print(
        f"\n[Step 2] Fetching historical data for {len(current)} coins...",
        file=sys.stderr,
    )
    est_secs = len(current) * 0.15
    print(f"  Est. time: ~{est_secs/60:.1f} min (Pro API)", file=sys.stderr)

    feb_2026_ts = datetime(2026, 2, 1, tzinfo=timezone.utc).timestamp() * 1000
    jan_2026_ts = datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp() * 1000

    new_entrants = []
    errors = []
    total = len(current)

    for i, (coin_id, info) in enumerate(current.items()):
        pct = (i / total) * 100
        rank = info["rank"]

        if (i + 1) % 50 == 0 or i == 0:
            elapsed = time.time() - start if "start" in dir() else 0
            print(
                f"\n  Progress: {i+1}/{total} ({pct:.0f}%)",
                file=sys.stderr,
            )

        if i == 0:
            start = time.time()

        try:
            url = (
                f"{BASE}/coins/{coin_id}/market_chart"
                f"?vs_currency=usd&days=max&interval=monthly"
            )
            data = fetch_json(url)
        except Exception as e:
            print(f"  ERROR {coin_id}: {e}", file=sys.stderr)
            errors.append(coin_id)
            continue

        mcaps = data.get("market_caps", [])
        prices = data.get("prices", [])

        # Check for data before February 2026
        pre_feb = [pt for pt in mcaps if pt[0] < feb_2026_ts and pt[1] and pt[1] > 0]
        pre_jan = [pt for pt in mcaps if pt[0] < jan_2026_ts and pt[1] and pt[1] > 0]

        if len(pre_feb) == 0:
            # Completely new — no market cap data before Feb 2026
            valid = [pt for pt in mcaps if pt[1] and pt[1] > 0]
            earliest = None
            if valid:
                earliest = datetime.fromtimestamp(
                    min(pt[0] for pt in valid) / 1000
                ).strftime("%Y-%m-%d")

            info["earliest_data"] = earliest
            info["months_history"] = len(valid)
            info["new_category"] = "brand_new_feb2026"
            new_entrants.append(info)
            print(
                f"  ** NEW ** #{rank} {info['symbol']} ({coin_id}) — first data: {earliest}",
                file=sys.stderr,
            )

        elif len(pre_jan) == 0:
            # Very recent — first appeared Jan 2026
            valid = [pt for pt in mcaps if pt[1] and pt[1] > 0]
            earliest = datetime.fromtimestamp(
                min(pt[0] for pt in valid) / 1000
            ).strftime("%Y-%m-%d")

            info["earliest_data"] = earliest
            info["months_history"] = len(valid)
            info["new_category"] = "new_jan2026"
            new_entrants.append(info)
            print(
                f"  ** NEW (Jan) ** #{rank} {info['symbol']} ({coin_id}) — first data: {earliest}",
                file=sys.stderr,
            )

    elapsed = time.time() - start
    print(f"\n  Done in {elapsed:.0f}s", file=sys.stderr)

    # Summary
    print(f"\n{'=' * 60}", file=sys.stderr)
    brand_new = [e for e in new_entrants if e["new_category"] == "brand_new_feb2026"]
    jan_new = [e for e in new_entrants if e["new_category"] == "new_jan2026"]
    print(
        f"RESULTS: {len(new_entrants)} new entrants found in current top 500",
        file=sys.stderr,
    )
    print(
        f"  Brand new (no data before Feb 2026): {len(brand_new)}", file=sys.stderr
    )
    print(
        f"  Very recent (first appeared Jan 2026): {len(jan_new)}", file=sys.stderr
    )
    if errors:
        print(f"  Errors (skipped): {len(errors)} — {errors}", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)

    # Write CSV
    new_entrants.sort(key=lambda x: x["rank"] or 9999)

    writer = csv.DictWriter(
        sys.stdout,
        fieldnames=[
            "rank",
            "symbol",
            "name",
            "id",
            "new_category",
            "price",
            "market_cap",
            "fully_diluted_valuation",
            "volume_24h",
            "earliest_data",
            "months_history",
            "ath",
            "ath_date",
            "price_change_24h_pct",
        ],
    )
    writer.writeheader()
    for entry in new_entrants:
        writer.writerow({k: entry.get(k, "") for k in writer.fieldnames})

    print(f"\nCSV written to stdout ({len(new_entrants)} rows)", file=sys.stderr)


if __name__ == "__main__":
    main()
