#!/usr/bin/env python3
"""Compute lifetime PnL percentile distribution for GMX V2 traders.

Source: GMX synthetics squid (period_eq:"total" => account lifetime aggregates
since GMX V2 deploy: Arbitrum Aug 2023, Avalanche Jul 2023).
PnL/Volume are stored as BigInt with 30 decimals (USD * 1e30).
"""
import json
import math
from datetime import datetime, timezone
from pathlib import Path

DATA = Path("/Users/maxguillabert/Downloads/index/video/data")
SCALE = 10 ** 30  # GMX V2 stores USD with 30 decimals

PCTS = [0.01, 0.1, 1, 5, 10, 25, 50, 75, 90, 95, 99, 99.9, 99.99]


def percentile(sorted_vals, p):
    if not sorted_vals:
        return None
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def label(p):
    if p == int(p):
        return f"p{int(p)}"
    return "p" + str(p).replace(".", "_")


def process(name, src_path):
    rows = []
    with open(src_path) as f:
        for line in f:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    pnls, vols = [], []
    n_zero_volume = 0
    for r in rows:
        try:
            v = int(r["volume"]) / SCALE
            p = int(r["realizedPnl"]) / SCALE
        except (KeyError, ValueError, TypeError):
            continue
        # Drop wallets that never traded (volume==0). They distort the median.
        if v <= 0:
            n_zero_volume += 1
            continue
        pnls.append(p)
        vols.append(v)

    pnls_sorted = sorted(pnls)

    pct_map = {label(p): round(percentile(pnls_sorted, p), 2) for p in PCTS}
    total_profit = sum(v for v in pnls if v > 0)
    total_loss = sum(v for v in pnls if v < 0)
    n_profitable = sum(1 for v in pnls if v > 0)

    p99 = percentile(pnls_sorted, 99)
    p99_9 = percentile(pnls_sorted, 99.9)
    profit_above_p99 = sum(v for v in pnls if v > p99 and v > 0)
    profit_above_p99_9 = sum(v for v in pnls if v > p99_9 and v > 0)

    return {
        "n_total_accounts": len(rows),
        "n_with_volume": len(pnls),
        "n_zero_volume_dropped": n_zero_volume,
        "percentiles_usd": pct_map,
        "pct_profitable": round(n_profitable / len(pnls), 4) if pnls else None,
        "total_profit_usd": round(total_profit, 2),
        "total_loss_usd": round(total_loss, 2),
        "net_pnl_usd": round(total_profit + total_loss, 2),
        "share_of_total_profit_above_p99": round(profit_above_p99 / total_profit, 4) if total_profit else None,
        "share_of_total_profit_above_p99_9": round(profit_above_p99_9 / total_profit, 4) if total_profit else None,
        "max_pnl_usd": round(max(pnls), 2) if pnls else None,
        "min_pnl_usd": round(min(pnls), 2) if pnls else None,
        "mean_pnl_usd": round(sum(pnls) / len(pnls), 2) if pnls else None,
        "median_pnl_usd": round(percentile(pnls_sorted, 50), 2) if pnls else None,
        "total_volume_usd": round(sum(vols), 2),
    }


def main():
    out = {
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "source": "GMX V2 synthetics squid (gmx.squids.live)",
        "endpoint_template": "https://gmx.squids.live/gmx-synthetics-{chain}:prod/api/graphql",
        "query": 'accountStats(where:{period_eq:"total"})',
        "period": "lifetime since GMX V2 deploy (Arbitrum: Aug 2023, Avalanche: Jul 2023)",
        "chains": {},
    }
    for chain in ("arbitrum", "avalanche"):
        src = DATA / f"gmx_v2_{chain}-account-totals.jsonl"
        out["chains"][chain] = process(chain, src)
        s = out["chains"][chain]
        print(f"\n=== GMX V2 {chain} ===")
        print(f"  accounts: {s['n_total_accounts']} (with volume: {s['n_with_volume']})")
        print(f"  pct_profitable: {s['pct_profitable']*100:.2f}%")
        print(f"  median PnL:   ${s['median_pnl_usd']:>15,.2f}")
        print(f"  mean PnL:     ${s['mean_pnl_usd']:>15,.2f}")
        print(f"  net trader PnL (proxy for GLP profit, sign-flipped): ${-s['net_pnl_usd']:>15,.2f}")
        print(f"  share of total profit above p99:   {s['share_of_total_profit_above_p99']*100:.2f}%")
        print(f"  share of total profit above p99.9: {s['share_of_total_profit_above_p99_9']*100:.2f}%")
        print("  percentiles (USD):")
        for k, v in s["percentiles_usd"].items():
            print(f"    {k:8s}  ${v:>15,.2f}")

    out_path = DATA / "gmx-v2-distribution.json"
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
