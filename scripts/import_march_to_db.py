#!/usr/bin/env python3
"""
Generate SQL to insert March Bitget daily closes into coingecko_market_caps.

Maps Bitget pair → base coin → CoinGecko coin_id using coingecko-ids.json.
Outputs SQL to stdout. Pipe to VPS via:

    python3 scripts/import_march_to_db.py | ssh index-maker/prod/postgres \
        'psql -U max index_prices'

Or save and scp:
    python3 scripts/import_march_to_db.py > /tmp/march_import.sql
    scp -P 3189 /tmp/march_import.sql max@<vps2>:/tmp/
    ssh index-maker/prod/postgres 'psql -U max index_prices < /tmp/march_import.sql'
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
BITGET_DATA = ROOT / "scripts" / "bitget_daily_march.json"
CG_IDS = ROOT / "frontend" / "lib" / "coingecko-ids.json"

QUOTE_SUFFIXES = ["USDT", "USDC", "BTC", "ETH"]


def extract_base(pair: str):
    """Extract base coin from a Bitget pair like BTCUSDT → BTC."""
    for suffix in QUOTE_SUFFIXES:
        if pair.endswith(suffix) and len(pair) > len(suffix):
            return pair[: -len(suffix)]
    return None


def escape_sql(s: str) -> str:
    return s.replace("'", "''")


def main():
    with open(BITGET_DATA) as f:
        bitget = json.load(f)

    with open(CG_IDS) as f:
        cg_ids = json.load(f)  # { "BTC": "bitcoin", "ETH": "ethereum", ... }

    # Build reverse: uppercase symbol → cg_coin_id
    sym_to_cg = {k.upper(): v for k, v in cg_ids.items()}

    mapped = 0
    unmapped = []
    # Deduplicate: (coin_id, date) → (symbol, price, pair)
    # Prefer USDT pairs over USDC (more liquid, tighter spreads)
    seen = {}

    for pair, candles in bitget.items():
        base = extract_base(pair)
        if not base:
            unmapped.append(pair)
            continue

        cg_id = sym_to_cg.get(base.upper())
        if not cg_id:
            unmapped.append(f"{pair} (base={base})")
            continue

        mapped += 1
        is_usdt = pair.endswith("USDT")
        for c in candles:
            key = (cg_id, c["date"])
            # Keep USDT over non-USDT; first seen otherwise
            if key not in seen or (is_usdt and not seen[key][3]):
                seen[key] = (cg_id, base.lower(), c["date"], is_usdt, c["close"])

    rows = [(cg_id, sym, date, price) for (cg_id, sym, date, _, price) in seen.values()]
    rows.sort(key=lambda r: (r[0], r[2]))

    # Emit SQL
    print("-- March 2026 Bitget daily closes → coingecko_market_caps")
    print(f"-- {mapped} pairs mapped, {len(unmapped)} unmapped, {len(rows)} rows")
    print("BEGIN;")
    print()

    # Batch insert with ON CONFLICT upsert (update price if row exists)
    BATCH = 500
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        print(
            "INSERT INTO coingecko_market_caps (coin_id, symbol, snapshot_date, price_usd, fetched_at)"
        )
        print("VALUES")
        vals = []
        for coin_id, symbol, date, price in batch:
            vals.append(
                f"  ('{escape_sql(coin_id)}', '{escape_sql(symbol)}', '{date}', {price}, NOW())"
            )
        print(",\n".join(vals))
        print("ON CONFLICT (coin_id, snapshot_date) DO UPDATE SET price_usd = EXCLUDED.price_usd, fetched_at = NOW();")
        print()

    print("COMMIT;")

    # Report unmapped to stderr
    if unmapped:
        print(f"\n-- Unmapped pairs ({len(unmapped)}):", file=sys.stderr)
        for u in sorted(unmapped)[:30]:
            print(f"--   {u}", file=sys.stderr)
        if len(unmapped) > 30:
            print(f"--   ... and {len(unmapped) - 30} more", file=sys.stderr)


if __name__ == "__main__":
    main()
