#!/usr/bin/env python3
"""
Copy-trading creator sweep — Phase 1: candidate discovery.
Searches across EN/ZH/KR/JA and multiple asset classes.
Deduplicates authors. Tracks budget against niches/budget.json.
"""
from __future__ import annotations
import json
import subprocess
import sys
import os
from pathlib import Path
from collections import defaultdict

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
BUDGET_FILE = ROOT / "niches" / "budget.json"
RESULTS_FILE = CACHE / "copy_trading_candidates.jsonl"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"
CREDITS_PER_USD = 100_000
STOP_AT_USD = 3.40  # leave ~$0.50 reserve
BALANCE_AT_START = 395240  # set after rebase


def current_balance():
    """Read live balance from API."""
    result = subprocess.run(
        ["python3", str(ROOT / "twapi.py"), "balance"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    try:
        data = json.loads(result.stdout)
        return data.get("total", 0)
    except Exception:
        return 0


def spent_usd():
    cur = current_balance()
    spent_c = max(0, BALANCE_AT_START - cur)
    return spent_c / CREDITS_PER_USD


def check_stop():
    s = spent_usd()
    if s >= STOP_AT_USD:
        print(f"STOP: spent ${s:.4f} >= ${STOP_AT_USD} limit", file=sys.stderr)
        return True
    print(f"  [budget] spent ${s:.4f} / ${STOP_AT_USD} limit ({current_balance()} credits left)", file=sys.stderr)
    return False


def run_advsearch(query: str, query_type: str = "Top", pages: int = 1, cell: str = "copy_trading"):
    """Run advanced search via twapi.py subprocess. Returns stdout."""
    args = [
        "python3", str(ROOT / "twapi.py"), "advsearch", query,
        "--type", query_type,
        "--cell", cell,
        "--pages", str(pages),
    ]
    result = subprocess.run(args, capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode not in (0, None):
        print(f"  search error: {result.stderr[-300:]}", file=sys.stderr)
    else:
        print(result.stderr[-600:], file=sys.stderr)
    return result.stdout.strip()


def run_userinfo(handle: str):
    args = ["python3", str(ROOT / "twapi.py"), "userinfo", handle]
    result = subprocess.run(args, capture_output=True, text=True, cwd=str(ROOT))
    print(result.stderr[-400:], file=sys.stderr)
    try:
        return json.loads(result.stdout)
    except Exception:
        return {}


def load_jsonl(p: Path) -> list[dict]:
    if not p.exists():
        return []
    rows = []
    for line in p.read_text().split("\n"):
        line = line.strip()
        if line:
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows


def extract_authors_from_tweets(cell: str = "copy_trading") -> dict[str, dict]:
    """Pull all authors from cached tweets with cell=copy_trading."""
    tweets = load_jsonl(TWEETS)
    profiles = {p["screen_name"].lower(): p for p in load_jsonl(PROFILES) if p.get("screen_name")}
    authors: dict[str, dict] = {}
    for t in tweets:
        if t.get("cell") != cell and cell not in (t.get("source_run") or ""):
            continue
        sn = t.get("screen_name")
        if not sn:
            continue
        snl = sn.lower()
        if snl not in authors:
            prof = profiles.get(snl, {})
            authors[snl] = {
                "screen_name": sn,
                "followers": prof.get("followers_count"),
                "bio": prof.get("description", ""),
                "url": prof.get("url", ""),
                "tweet_count": 0,
                "total_likes": 0,
                "total_rts": 0,
                "sample_texts": [],
            }
        authors[snl]["tweet_count"] += 1
        authors[snl]["total_likes"] = authors[snl].get("total_likes", 0) + (t.get("favorites") or 0)
        authors[snl]["total_rts"] = authors[snl].get("total_rts", 0) + (t.get("retweets") or 0)
        if len(authors[snl]["sample_texts"]) < 3:
            txt = (t.get("text") or "")[:120]
            if txt:
                authors[snl]["sample_texts"].append(txt)
    return authors


QUERIES = [
    # --- English crypto perps ---
    ("copy my trades hyperliquid", "Top", 2, "en-perps"),
    ("copytrading hyperliquid signals", "Top", 2, "en-perps"),
    ("hyperliquid leaderboard copy trade", "Top", 1, "en-perps"),
    ("perp trading signals crypto -scam -free min_faves:50", "Top", 2, "en-perps"),
    ("\"copy my trades\" crypto", "Top", 2, "en-crypto"),
    ("copy trading signals crypto", "Top", 2, "en-crypto"),

    # --- English memecoins ---
    ("GMGN copy trade memecoin", "Top", 1, "en-meme"),
    ("pump.fun copy trading", "Top", 1, "en-meme"),
    ("memecoin signals copy trade", "Top", 2, "en-meme"),
    ("solana copy trading bot signals", "Top", 2, "en-meme"),

    # --- English FX / stocks ---
    ("forex copy trading signals", "Top", 2, "en-fx"),
    ("FX signals copy trade", "Top", 1, "en-fx"),
    ("stock market signals copy trade", "Top", 1, "en-stocks"),

    # --- English sports betting tipsters ---
    ("sports betting tips copy min_faves:30", "Top", 1, "en-betting"),
    ("tipster picks follow win", "Top", 1, "en-betting"),

    # --- Chinese (ZH) ---
    ("带单 跟单 合约 -骗子", "Top", 2, "zh-perps"),
    ("跟单老师 带单 利润", "Top", 2, "zh-perps"),
    ("带单员 实盘 跟单", "Top", 2, "zh-perps"),
    ("meme 带单 跟单 sol", "Top", 1, "zh-meme"),

    # --- Korean (KR) ---
    ("카피트레이딩 암호화폐 수익", "Top", 2, "kr-perps"),
    ("리딩방 선물 수익인증", "Top", 2, "kr-perps"),
    ("카피 트레이딩 비트코인", "Top", 1, "kr-crypto"),

    # --- Japanese (JA) ---
    ("コピートレード 実績 仮想通貨", "Top", 2, "ja-perps"),
    ("コピートレード 利益 先物", "Top", 1, "ja-perps"),
    ("トレードコピー FX 実績", "Top", 1, "ja-fx"),

    # --- Extra EN sweeps ---
    ("\"copy trading\" site results signals", "Top", 2, "en-saas"),
    ("trading signals subscription monthly", "Top", 1, "en-saas"),
    ("\"follow my trades\" crypto platform", "Top", 1, "en-platform"),
]


def main():
    print("=== Copy-trading sweep START ===", file=sys.stderr)
    print(f"  Balance at script start: {current_balance()} credits", file=sys.stderr)

    for query, qtype, pages, cell in QUERIES:
        if check_stop():
            break
        print(f"\n--- SEARCH [{cell}] {query!r} pages={pages} ---", file=sys.stderr)
        out = run_advsearch(query, qtype, pages, cell)
        print(f"  result: {out}", file=sys.stderr)

    print("\n=== Sweep complete. Extracting author candidates... ===", file=sys.stderr)
    authors = extract_authors_from_tweets("copy_trading")
    # Also sweep all cells we used
    for cell_tag in ["en-perps", "en-crypto", "en-meme", "en-fx", "en-stocks", "en-betting",
                     "zh-perps", "zh-meme", "kr-perps", "kr-crypto", "ja-perps", "ja-fx",
                     "en-saas", "en-platform"]:
        more = extract_authors_from_tweets(cell_tag)
        for k, v in more.items():
            if k not in authors:
                authors[k] = v
            else:
                authors[k]["tweet_count"] += v.get("tweet_count", 0)
                authors[k]["total_likes"] = authors[k].get("total_likes", 0) + v.get("total_likes", 0)

    print(f"\nTotal distinct authors found: {len(authors)}", file=sys.stderr)

    # Sort by followers desc (with fallback to 0)
    sorted_authors = sorted(authors.values(), key=lambda a: (a.get("followers") or 0), reverse=True)

    # Save candidates
    RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with RESULTS_FILE.open("w") as f:
        for a in sorted_authors:
            f.write(json.dumps(a, ensure_ascii=False) + "\n")

    print(f"\nTop-40 authors by followers:")
    for a in sorted_authors[:40]:
        print(f"  {a.get('followers') or '?':>8} followers  @{a['screen_name']:30s}  {(a.get('bio') or '')[:70]}")

    print(f"\nFinal balance: {current_balance()} credits")
    print(f"Spent: ${spent_usd():.4f}")


if __name__ == "__main__":
    main()
