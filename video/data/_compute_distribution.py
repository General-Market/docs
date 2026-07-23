#!/usr/bin/env python3
"""Compute PnL distribution percentiles from Hyperliquid leaderboard snapshot."""
import json
import math
from datetime import datetime, timezone
from pathlib import Path

DATA = Path("/Users/maxguillabert/Downloads/index/video/data")
SRC = DATA / "hyperliquid-leaderboard-snapshot.json"
DST = DATA / "hyperliquid-distribution.json"

WINDOWS = ["allTime", "month", "week", "day"]
PCTS = [1, 5, 10, 25, 50, 75, 90, 95, 99, 99.9, 99.99]


def percentile(sorted_vals, p):
    """Linear-interpolation percentile (numpy-style, no numpy)."""
    if not sorted_vals:
        return None
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def label(p):
    if p == int(p):
        return f"p{int(p)}"
    # 99.9 -> p99_9, 99.99 -> p99_99
    return "p" + str(p).replace(".", "_")


def main():
    with SRC.open() as f:
        raw = json.load(f)

    rows = raw["leaderboardRows"]
    n = len(rows)

    # bucket pnl by window
    by_window = {w: [] for w in WINDOWS}
    for row in rows:
        for window_name, perf in row["windowPerformances"]:
            if window_name in by_window:
                try:
                    by_window[window_name].append(float(perf["pnl"]))
                except (TypeError, ValueError):
                    pass

    out = {
        "snapshot_taken_at": datetime.now(timezone.utc).isoformat(),
        "source_url": "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard",
        "n_wallets": n,
        "windows": {},
    }

    for w in WINDOWS:
        vals = sorted(by_window[w])
        if not vals:
            continue
        pct_map = {label(p): round(percentile(vals, p), 2) for p in PCTS}
        total_profit = sum(v for v in vals if v > 0)
        p99_cut = percentile(vals, 99)
        profit_above_p99 = sum(v for v in vals if v > p99_cut and v > 0)
        share = (profit_above_p99 / total_profit) if total_profit > 0 else None
        n_profitable = sum(1 for v in vals if v > 0)
        out["windows"][w] = {
            "n": len(vals),
            "percentiles": pct_map,
            "share_of_total_profit_above_p99": round(share, 4) if share is not None else None,
            "pct_profitable": round(n_profitable / len(vals), 4),
            "total_profit_usd": round(total_profit, 2),
            "total_loss_usd": round(sum(v for v in vals if v < 0), 2),
            "mean_pnl_usd": round(sum(vals) / len(vals), 2),
            "max_pnl_usd": round(vals[-1], 2),
            "min_pnl_usd": round(vals[0], 2),
        }

    with DST.open("w") as f:
        json.dump(out, f, indent=2)

    print(f"wrote {DST}")
    print(f"n_wallets: {n}")
    for w in WINDOWS:
        d = out["windows"].get(w, {})
        print(
            f"  {w:8s}  pct_profitable={d.get('pct_profitable')}  "
            f"p99={d['percentiles'].get('p99')}  "
            f"max={d.get('max_pnl_usd')}  "
            f"share>p99={d.get('share_of_total_profit_above_p99')}"
        )


if __name__ == "__main__":
    main()
