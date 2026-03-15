#!/usr/bin/env python3
"""
Backtest all ITP ideas from docs/itp-ideas.md against the data-node simulator.
Produces docs/itp-backtest-results.json with ETF-standard metrics for each ITP.

Usage:
    python3 scripts/backtest-all-itps.py [--data-node-url URL] [--concurrency N] [--dry-run]

Requires: pip install aiohttp
"""

import asyncio
import aiohttp
import json
import re
import sys
import os
import math
import argparse
from datetime import datetime, date
from pathlib import Path
from collections import defaultdict

# ── Config ──────────────────────────────────────────────────────────────────

DATA_NODE_URL = os.environ.get("DATA_NODE_URL", "http://localhost:8200")
ITP_IDEAS_PATH = Path(__file__).parent.parent / "docs" / "itp-ideas.md"
OUTPUT_PATH = Path(__file__).parent.parent / "docs" / "itp-backtest-results.json"
MAX_CONCURRENCY = 6  # parallel sim requests
REQUEST_TIMEOUT = 120  # seconds per sim run


# ── Parse ITP ideas from markdown ───────────────────────────────────────────

def parse_itp_ideas(md_path: str) -> list[dict]:
    """Parse docs/itp-ideas.md into structured ITP configs."""
    with open(md_path) as f:
        content = f.read()

    itps = []
    current_section = ""

    # Match section headers: ## N. The Archetype Name
    section_re = re.compile(r'^## \d+\.\s+(.+)$', re.MULTILINE)
    # Match ITP headers: ### N. Name (TICKER)
    itp_re = re.compile(r'^### (\d+)\.\s+(.+?)\s+\((\w+)\)\s*$', re.MULTILINE)
    # Match thesis line
    thesis_re = re.compile(r'^\*\*Thesis:\*\*\s+(.+)$', re.MULTILINE)
    # Match config line: **Config:** `category_id` | top `N` | `weighting` | rebalance `Nd`
    config_re = re.compile(
        r'^\*\*Config:\*\*\s+`([^`]+)`\s*\|\s*top\s+`(\d+)`\s*\|\s*`([^`]+)`\s*\|\s*rebalance\s+`(\d+)d`',
        re.MULTILINE
    )
    # Match overlay line
    overlay_re = re.compile(r'^\*\*Overlays?:\*\*\s+(.+)$', re.MULTILINE)

    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]

        # Section header
        sm = section_re.match(line)
        if sm:
            current_section = sm.group(1).strip()
            i += 1
            continue

        # ITP header
        im = itp_re.match(line)
        if im:
            itp_num = int(im.group(1))
            name = im.group(2).strip()
            ticker = im.group(3).strip()

            # Look ahead for thesis, config, overlays — stop at next ### or ## header
            thesis = ""
            config = None
            overlays = {}

            for j in range(i + 1, min(i + 8, len(lines))):
                tl = lines[j]

                # Stop if we hit the next ITP or section header
                if tl.startswith('### ') or tl.startswith('## '):
                    break

                tm = thesis_re.match(tl)
                if tm:
                    thesis = tm.group(1).strip()

                cm = config_re.match(tl)
                if cm:
                    config = {
                        "category_id": cm.group(1),
                        "top_n": int(cm.group(2)),
                        "weighting": cm.group(3),
                        "rebalance_days": int(cm.group(4)),
                    }

                om = overlay_re.match(tl)
                if om:
                    overlay_str = om.group(1).strip()
                    # Parse key=value pairs: fng_mode=cash, vc_mode=funding, etc.
                    for pair in re.findall(r'(\w+)=([^\s,]+)', overlay_str):
                        overlays[pair[0]] = pair[1]

            if config:
                itp = {
                    "id": itp_num,
                    "name": name,
                    "ticker": ticker,
                    "thesis": thesis,
                    "section": current_section,
                    "config": config,
                    "overlays": overlays,
                }
                itps.append(itp)

            i += 1
            continue

        i += 1

    return itps


# ── Build sim API query params from ITP config ─────────────────────────────

def build_sim_params(itp: dict) -> dict:
    """Convert ITP config + overlays into /sim/run query params."""
    c = itp["config"]
    params = {
        "category_id": c["category_id"],
        "top_n": c["top_n"],
        "weighting": c["weighting"],
        "rebalance_days": c["rebalance_days"],
        "base_fee_pct": 0.001,       # 0.1% base fee (realistic Bitget)
        "spread_multiplier": 1.0,
    }

    ov = itp.get("overlays", {})
    if "fng_mode" in ov:
        params["fng_mode"] = ov["fng_mode"]
    if "fng_fear_threshold" in ov:
        params["fng_fear_threshold"] = int(ov["fng_fear_threshold"])
    if "fng_greed_threshold" in ov:
        params["fng_greed_threshold"] = int(ov["fng_greed_threshold"])
    if "fng_cash_pct" in ov:
        params["fng_cash_pct"] = float(ov["fng_cash_pct"])
    if "vc_mode" in ov:
        params["vc_mode"] = ov["vc_mode"]
    if "dom_mode" in ov:
        params["dom_mode"] = ov["dom_mode"]
    if "dom_lookback" in ov:
        params["dom_lookback"] = int(ov["dom_lookback"])

    return params


# ── Compute ETF-standard metrics from NAV series ───────────────────────────

def compute_etf_metrics(nav_series: list[dict]) -> dict:
    """
    From daily NAV series, compute standard ETF metrics:
    - Monthly returns
    - Quarterly returns
    - Yearly returns
    - Rolling 30/90/365d returns
    - Sortino ratio
    - Calmar ratio
    - Win rate (% of positive months)
    - Best/worst month
    - Best/worst quarter
    - Longest drawdown duration
    - Time underwater
    - Volatility (annualized)
    - Downside deviation
    - Skewness / kurtosis of returns
    """
    if not nav_series or len(nav_series) < 2:
        return {}

    # Parse dates and build time series
    points = []
    for p in nav_series:
        d = p.get("nav_date") or p.get("date")
        if isinstance(d, str):
            d = datetime.strptime(d, "%Y-%m-%d").date()
        points.append({"date": d, "nav": p["nav"], "drawdown_pct": p.get("drawdown_pct", 0)})

    points.sort(key=lambda x: x["date"])

    # ── Daily returns ──
    daily_returns = []
    for i in range(1, len(points)):
        prev_nav = points[i - 1]["nav"]
        if prev_nav > 0:
            daily_returns.append(points[i]["nav"] / prev_nav - 1)

    # ── Monthly returns ──
    monthly_navs = {}  # (year, month) -> last NAV in that month
    for p in points:
        key = (p["date"].year, p["date"].month)
        monthly_navs[key] = p["nav"]

    sorted_months = sorted(monthly_navs.keys())
    monthly_returns = {}
    for i in range(1, len(sorted_months)):
        prev = monthly_navs[sorted_months[i - 1]]
        curr = monthly_navs[sorted_months[i]]
        ym = sorted_months[i]
        if prev > 0:
            monthly_returns[f"{ym[0]}-{ym[1]:02d}"] = round((curr / prev - 1) * 100, 2)

    # ── Quarterly returns ──
    quarterly_navs = {}  # (year, quarter) -> last NAV
    for p in points:
        q = (p["date"].month - 1) // 3 + 1
        key = (p["date"].year, q)
        quarterly_navs[key] = p["nav"]

    sorted_quarters = sorted(quarterly_navs.keys())
    quarterly_returns = {}
    for i in range(1, len(sorted_quarters)):
        prev = quarterly_navs[sorted_quarters[i - 1]]
        curr = quarterly_navs[sorted_quarters[i]]
        yq = sorted_quarters[i]
        if prev > 0:
            quarterly_returns[f"{yq[0]}-Q{yq[1]}"] = round((curr / prev - 1) * 100, 2)

    # ── Yearly returns ──
    yearly_navs = {}
    for p in points:
        yearly_navs[p["date"].year] = p["nav"]

    sorted_years = sorted(yearly_navs.keys())
    yearly_returns = {}
    for i in range(1, len(sorted_years)):
        prev = yearly_navs[sorted_years[i - 1]]
        curr = yearly_navs[sorted_years[i]]
        if prev > 0:
            yearly_returns[str(sorted_years[i])] = round((curr / prev - 1) * 100, 2)

    # ── Rolling returns (latest) ──
    rolling = {}
    if len(points) > 30:
        rolling["30d"] = round((points[-1]["nav"] / points[-31]["nav"] - 1) * 100, 2)
    if len(points) > 90:
        rolling["90d"] = round((points[-1]["nav"] / points[-91]["nav"] - 1) * 100, 2)
    if len(points) > 180:
        rolling["180d"] = round((points[-1]["nav"] / points[-181]["nav"] - 1) * 100, 2)
    if len(points) > 365:
        rolling["365d"] = round((points[-1]["nav"] / points[-366]["nav"] - 1) * 100, 2)

    # Year-to-date
    jan1 = date(points[-1]["date"].year, 1, 1)
    ytd_nav = next((p["nav"] for p in points if p["date"] >= jan1), None)
    if ytd_nav and ytd_nav > 0:
        rolling["ytd"] = round((points[-1]["nav"] / ytd_nav - 1) * 100, 2)

    # Since inception
    rolling["inception"] = round((points[-1]["nav"] / points[0]["nav"] - 1) * 100, 2)

    # ── Volatility metrics ──
    if daily_returns:
        mean_daily = sum(daily_returns) / len(daily_returns)
        variance = sum((r - mean_daily) ** 2 for r in daily_returns) / len(daily_returns)
        std_daily = math.sqrt(variance)
        annualized_vol = std_daily * math.sqrt(365) * 100

        # Downside deviation (only negative returns)
        neg_returns = [r for r in daily_returns if r < 0]
        if neg_returns:
            downside_var = sum(r ** 2 for r in neg_returns) / len(daily_returns)
            downside_dev = math.sqrt(downside_var) * math.sqrt(365)
        else:
            downside_dev = 0

        # Sortino ratio (risk-free = 0)
        n_days = (points[-1]["date"] - points[0]["date"]).days
        if n_days > 0 and downside_dev > 0:
            ann_return = (points[-1]["nav"] / points[0]["nav"]) ** (365 / n_days) - 1
            sortino = ann_return / downside_dev
        else:
            sortino = 0

        # Skewness & kurtosis
        if std_daily > 0 and len(daily_returns) > 2:
            n = len(daily_returns)
            skewness = (n / ((n - 1) * (n - 2))) * sum(((r - mean_daily) / std_daily) ** 3 for r in daily_returns)
            if n > 3:
                kurtosis = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * \
                           sum(((r - mean_daily) / std_daily) ** 4 for r in daily_returns) - \
                           (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
            else:
                kurtosis = 0
        else:
            skewness = 0
            kurtosis = 0
    else:
        annualized_vol = 0
        sortino = 0
        skewness = 0
        kurtosis = 0

    # ── Drawdown analysis ──
    max_dd = min(p["drawdown_pct"] for p in points) if points else 0

    # Calmar ratio
    n_days = (points[-1]["date"] - points[0]["date"]).days if len(points) > 1 else 0
    if n_days > 0 and max_dd < 0:
        ann_return = (points[-1]["nav"] / points[0]["nav"]) ** (365 / n_days) - 1
        calmar = ann_return / abs(max_dd / 100)
    else:
        calmar = 0

    # Longest drawdown duration (consecutive days below previous peak)
    dd_durations = []
    current_dd_start = None
    for p in points:
        if p["drawdown_pct"] < -0.1:  # in drawdown
            if current_dd_start is None:
                current_dd_start = p["date"]
        else:
            if current_dd_start is not None:
                dd_durations.append((p["date"] - current_dd_start).days)
                current_dd_start = None
    if current_dd_start is not None:
        dd_durations.append((points[-1]["date"] - current_dd_start).days)

    longest_dd_days = max(dd_durations) if dd_durations else 0

    # Time underwater (% of days in drawdown)
    dd_days = sum(1 for p in points if p["drawdown_pct"] < -0.1)
    pct_underwater = round(dd_days / len(points) * 100, 1) if points else 0

    # ── Monthly win/loss stats ──
    monthly_vals = list(monthly_returns.values())
    positive_months = sum(1 for r in monthly_vals if r > 0)
    win_rate = round(positive_months / len(monthly_vals) * 100, 1) if monthly_vals else 0
    best_month = max(monthly_vals) if monthly_vals else 0
    worst_month = min(monthly_vals) if monthly_vals else 0
    avg_month = round(sum(monthly_vals) / len(monthly_vals), 2) if monthly_vals else 0

    # Best/worst quarter
    quarterly_vals = list(quarterly_returns.values())
    best_quarter = max(quarterly_vals) if quarterly_vals else 0
    worst_quarter = min(quarterly_vals) if quarterly_vals else 0

    return {
        "monthly_returns": monthly_returns,
        "quarterly_returns": quarterly_returns,
        "yearly_returns": yearly_returns,
        "rolling_returns": rolling,
        "volatility_annualized_pct": round(annualized_vol, 2),
        "sortino_ratio": round(sortino, 3),
        "calmar_ratio": round(calmar, 3),
        "skewness": round(skewness, 3),
        "excess_kurtosis": round(kurtosis, 3),
        "win_rate_monthly_pct": win_rate,
        "best_month_pct": best_month,
        "worst_month_pct": worst_month,
        "avg_month_pct": avg_month,
        "best_quarter_pct": best_quarter,
        "worst_quarter_pct": worst_quarter,
        "longest_drawdown_days": longest_dd_days,
        "pct_time_underwater": pct_underwater,
        "total_days": len(points),
        "start_date": str(points[0]["date"]),
        "end_date": str(points[-1]["date"]),
    }


# ── Fetch sim run + holdings ────────────────────────────────────────────────

async def run_single_backtest(
    session: aiohttp.ClientSession,
    itp: dict,
    semaphore: asyncio.Semaphore,
    base_url: str,
) -> dict:
    """Run one backtest and fetch holdings. Returns enriched ITP dict."""
    async with semaphore:
        params = build_sim_params(itp)
        itp_id = itp["id"]
        ticker = itp["ticker"]

        try:
            # 1. Run simulation
            async with session.get(
                f"{base_url}/sim/run",
                params=params,
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    print(f"  [{itp_id:3d}] {ticker}: FAILED (HTTP {resp.status}): {error_text[:100]}")
                    return {**itp, "error": f"HTTP {resp.status}: {error_text[:200]}"}

                data = await resp.json()

            run_id = data.get("run_id")
            stats = data.get("stats", {})
            nav_series = data.get("nav_series", [])

            # 2. Compute extended ETF metrics from NAV series
            etf_metrics = compute_etf_metrics(nav_series)

            # 3. Fetch current holdings (latest rebalance)
            holdings = []
            if run_id:
                try:
                    async with session.get(
                        f"{base_url}/sim/holdings",
                        params={"run_id": run_id},
                        timeout=aiohttp.ClientTimeout(total=30),
                    ) as hresp:
                        if hresp.status == 200:
                            hdata = await hresp.json()
                            holdings = hdata.get("holdings", [])
                except Exception:
                    pass

            # 4. Build result
            result = {
                **itp,
                "run_id": run_id,
                "stats": {
                    "total_return_pct": round(stats.get("total_return_pct", 0), 2),
                    "annualized_return_pct": round(stats.get("annualized_return", 0) * 100, 2)
                        if stats.get("annualized_return", 0) < 10 else round(stats.get("annualized_return", 0), 2),
                    "max_drawdown_pct": round(stats.get("max_drawdown_pct", 0), 2),
                    "sharpe_ratio": round(stats.get("sharpe_ratio", 0), 3),
                    "total_fees_pct": round(stats.get("total_fees_pct", 0), 2),
                    "total_trades": stats.get("total_trades", 0),
                    "total_rebalances": stats.get("total_rebalances", 0),
                    "total_delistings": stats.get("total_delistings", 0),
                    "start_date": stats.get("start_date"),
                    "end_date": stats.get("end_date"),
                },
                "etf_metrics": etf_metrics,
                "current_holdings": [
                    {
                        "symbol": h.get("symbol", ""),
                        "weight_pct": round(h.get("weight", 0) * 100, 2),
                        "price_usd": round(h.get("price_usd", 0), 4),
                    }
                    for h in holdings
                ],
                "nav_series_sample": [
                    {"date": p.get("nav_date", p.get("date")), "nav": round(p["nav"], 4)}
                    for p in nav_series[::max(1, len(nav_series) // 52)]  # ~weekly samples
                ] if nav_series else [],
            }

            sharpe = stats.get("sharpe_ratio", 0)
            total_ret = stats.get("total_return_pct", 0)
            print(f"  [{itp_id:3d}] {ticker}: Sharpe={sharpe:.3f}, Return={total_ret:.1f}%, "
                  f"MaxDD={stats.get('max_drawdown_pct', 0):.1f}%, "
                  f"Holdings={len(holdings)}")

            return result

        except asyncio.TimeoutError:
            print(f"  [{itp_id:3d}] {ticker}: TIMEOUT after {REQUEST_TIMEOUT}s")
            return {**itp, "error": "timeout"}
        except Exception as e:
            print(f"  [{itp_id:3d}] {ticker}: ERROR: {e}")
            return {**itp, "error": str(e)}


# ── Main ────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Backtest all ITP ideas")
    parser.add_argument("--data-node-url", default=DATA_NODE_URL, help="Data node base URL")
    parser.add_argument("--concurrency", type=int, default=MAX_CONCURRENCY, help="Max parallel requests")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, don't run backtests")
    parser.add_argument("--limit", type=int, default=0, help="Only backtest first N ITPs")
    args = parser.parse_args()

    # 1. Parse ITPs
    print(f"Parsing ITP ideas from {ITP_IDEAS_PATH}...")
    itps = parse_itp_ideas(str(ITP_IDEAS_PATH))
    print(f"Found {len(itps)} ITP configurations")

    if args.limit > 0:
        itps = itps[:args.limit]
        print(f"Limited to first {args.limit} ITPs")

    if args.dry_run:
        print("\n── Dry run: parsed configs ──")
        for itp in itps[:10]:
            print(f"  [{itp['id']:3d}] {itp['ticker']}: {itp['config']} overlays={itp['overlays']}")
        print(f"  ... and {len(itps) - 10} more")

        # Validate categories exist
        categories_used = set(itp["config"]["category_id"] for itp in itps)
        weightings_used = set(itp["config"]["weighting"] for itp in itps)
        print(f"\nUnique categories: {len(categories_used)}")
        for c in sorted(categories_used):
            print(f"  {c}")
        print(f"\nUnique weightings: {len(weightings_used)}")
        for w in sorted(weightings_used):
            print(f"  {w}")
        return

    # 2. Check data node is reachable
    print(f"\nChecking data node at {args.data_node_url}...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{args.data_node_url}/sim/categories",
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    print(f"ERROR: Data node returned HTTP {resp.status}")
                    sys.exit(1)
                cat_data = await resp.json()
                num_cats = len(cat_data.get("categories", []))
                print(f"Data node OK — {num_cats} categories available")
    except Exception as e:
        print(f"ERROR: Cannot reach data node: {e}")
        sys.exit(1)

    # 3. Run all backtests
    print(f"\nRunning {len(itps)} backtests (concurrency={args.concurrency})...\n")
    semaphore = asyncio.Semaphore(args.concurrency)

    async with aiohttp.ClientSession() as session:
        tasks = [
            run_single_backtest(session, itp, semaphore, args.data_node_url)
            for itp in itps
        ]
        results = await asyncio.gather(*tasks)

    # 4. Separate successes and failures
    successes = [r for r in results if "error" not in r]
    failures = [r for r in results if "error" in r]

    print(f"\n{'='*60}")
    print(f"Results: {len(successes)} succeeded, {len(failures)} failed")

    if failures:
        print(f"\nFailed ITPs:")
        for f in failures:
            print(f"  [{f['id']:3d}] {f['ticker']}: {f.get('error', 'unknown')[:80]}")

    # 5. Sort by Sharpe ratio (best first)
    successes.sort(key=lambda x: x.get("stats", {}).get("sharpe_ratio", 0), reverse=True)

    # 6. Summary table (top 20)
    print(f"\n{'='*60}")
    print(f"Top 20 by Sharpe Ratio:")
    print(f"{'#':>4} {'Ticker':<10} {'Sharpe':>8} {'Return%':>10} {'MaxDD%':>8} {'Vol%':>8} {'Win%':>6} {'Section'}")
    print("-" * 80)
    for i, r in enumerate(successes[:20], 1):
        s = r.get("stats", {})
        m = r.get("etf_metrics", {})
        print(f"{i:4d} {r['ticker']:<10} {s.get('sharpe_ratio', 0):8.3f} "
              f"{s.get('total_return_pct', 0):10.1f} {s.get('max_drawdown_pct', 0):8.1f} "
              f"{m.get('volatility_annualized_pct', 0):8.1f} {m.get('win_rate_monthly_pct', 0):5.1f}  "
              f"{r.get('section', '')[:20]}")

    # 7. Write JSON
    output = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "data_node_url": args.data_node_url,
        "total_itps": len(itps),
        "successful": len(successes),
        "failed": len(failures),
        "itps": successes,
        "failed_itps": [{"id": f["id"], "ticker": f["ticker"], "error": f.get("error")} for f in failures],
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nResults written to {OUTPUT_PATH}")
    print(f"File size: {OUTPUT_PATH.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    asyncio.run(main())
