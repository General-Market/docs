#!/usr/bin/env python3
"""Consolidate follow lists from 3 seeds, dedupe, filter to 1k-200k follower band,
keyword-score bios, output a ranked candidate list."""
import json
import os
import re
import sys
from collections import defaultdict

SEEDS = ["quantymacro", "0xLoris", "chameleon_jeff"]
EXISTING_PASS = {
    "thalexglobal", "robonethq", "neutrafinance", "quantymacro",
    "0xloris", "chameleon_jeff", "rf_extended",
}

# Existing dropped-from-scoring categories — ignore these.
DROP_KEYWORDS = [
    r"\bpolymarket\b", r"\bkalshi\b", r"\bmeteora\b", r"\bjupiter\b",
    r"\bjup_xyz\b", r"\bmeme\b", r"\bnft\b",
]

# Niche-positive keyword regexes (synthesizing from audit.py NICHE_GROUPS + new bets).
NICHE_RE = re.compile(
    r"\b(market[\s-]?mak(ing|er)|MM[\s-](bot|firm|trader|desk|operator|game)"
    r"|provide\s*liquidity|inventory\s*risk|adverse\s*selection|toxic\s*flow|internaliz(e|ation)"
    r"|quot(e|ing)\s*(engine|spread|surface)|two[\s-]sided\s*(quote|market)"
    r"|HFT|high[\s-]frequency|low[\s-]latency|colo|tick[\s-]to[\s-]trade|nanosecond|microsecond"
    r"|sub[\s-]micro|FPGA|performance\s*engineer"
    r"|quant(s|itative)?|quant\s*(research|trader|dev|firm|fund|desk)"
    r"|systematic\s*(trading|strategy)|signal\s*generation|alpha\s*(signal|decay|capture|factor|model|gen)"
    r"|factor\s*model|Sharpe|max\s*drawdown|Kelly\s*criterion|information\s*ratio|Sortino"
    r"|mean\s*reversion|momentum\s*signal|cointegrat|regime\s*(switching|change)"
    r"|(trading|MM|arb|execution|sniper|grid|DCA|sandwich|MEV|liquidation)\s*bot"
    r"|bot\s*(dev|builder|operator|maker)|algo[\s-](trader|trading|dev|bot|engine|stack|book)"
    r"|execution\s*(algo|engine|venue|trader|model)|smart\s*order\s*router|SOR"
    r"|OMS|order\s*management|FIX\s*(engine|protocol|connectivity)"
    r"|exchange\s*(API|connectivity|adapter)|(TWAP|VWAP|POV|Iceberg)\s*(execution|algo|order|strategy)"
    r"|backtest|walk[\s-]forward|orderbook|trade\s*tape|ccxt|hummingbot|freqtrade|nautilus|backtrader"
    r"|vectorbt|quant(connect|opian|lib|lopian)"
    r"|option(s)?\s*(trader|desk|market|book|flow|MM|maker|seller|writer|trading)|vol\s*(trader|surface|smile|skew|book)"
    r"|implied\s*vol|realized\s*vol|gamma|vega|theta|delta|skew|term\s*structure"
    r"|options\s*MM|opyn|deribit|paradigm|GVOL|aevo|lyra|dopex"
    r"|perp(etual)?\s*(trader|MM|desk|book|funding)|funding\s*(rate|arb)|basis\s*(trade|arb)"
    r"|cash[\s-]and[\s-]carry|delta[\s-]neutral|funding\s*farming"
    r"|MEV|searcher|bundler|sandwich|JIT|jit\s*liquidity|cex[\s-]dex\s*arb|cefi[\s-]defi\s*arb"
    r"|liquid[\s-]staking|liquidity\s*provider|LP[\s-](manager|strategy|tool)|concentrated\s*liquidity"
    r"|orderbook\s*DEX|hybrid\s*DEX|RFQ|request\s*for\s*quote|on[\s-]chain\s*OB"
    r"|cefi|tradfi\s*to\s*crypto|bps|spread|book\s*depth|microstructure|orderflow"
    r"|prop\s*(shop|trader|trading|desk)|proprietary\s*trading"
    r"|founder|cofounder|engineer|cto|head\s*of\s*(trading|engineering|research))",
    re.IGNORECASE,
)

# Hard-bad regex: KOL-ish, shill-ish, or off-niche
BAD_RE = re.compile(
    r"\b(NFT|memecoin|airdrop\s*hunter|alpha\s*caller|signals?\s*group|copy[\s-]?trad|"
    r"financial\s*advisor|crypto\s*coach|moonshot|gem\s*hunter|community\s*manager|"
    r"AMA|content\s*creator|onlyfans|adult|nude|porn|trader\s*girl|elon|"
    r"trump|saylor|MMA|nba|nfl|f1)\b",
    re.IGNORECASE,
)


def load_seed(handle: str):
    path = f"cache/raw_searches/followers/{handle}_following.json"
    with open(path) as f:
        return json.load(f)


def main():
    seed_sets = {}
    all_users = {}
    for s in SEEDS:
        users = load_seed(s)
        seed_sets[s] = {u.get("userName", "").lower() for u in users if u.get("userName")}
        for u in users:
            un = (u.get("userName") or "").lower()
            if not un:
                continue
            if un not in all_users:
                all_users[un] = u
            # Track which seeds follow this user
            all_users[un].setdefault("_seeds", set()).add(s)
    print(f"# Seeds: {[(s, len(v)) for s,v in seed_sets.items()]}", file=sys.stderr)
    print(f"# Unique users across all follow lists: {len(all_users)}", file=sys.stderr)

    # Filter to 1k-200k band, skip existing PASS, dedupe seeds themselves
    band = []
    for un, u in all_users.items():
        if un in EXISTING_PASS:
            continue
        if un in {s.lower() for s in SEEDS}:
            continue
        followers = u.get("followers_count") or u.get("followers") or 0
        if not (1000 <= followers <= 200000):
            continue
        bio = (u.get("description") or "").lower()
        # Skip obvious bad bios
        if BAD_RE.search(bio):
            continue
        # Skip if bio has any of the dropped names
        if any(re.search(p, bio) for p in DROP_KEYWORDS):
            continue
        # Score by niche keyword hits
        hits = NICHE_RE.findall(bio)
        if not hits:
            continue
        u["_score"] = len(hits)
        u["_bio_lc"] = bio
        band.append((un, u))

    band.sort(key=lambda kv: (-(kv[1].get("_score") or 0), -(kv[1].get("followers") or 0)))
    print(f"# After band+bio filter: {len(band)} candidates", file=sys.stderr)

    # Write tsv for review
    with open("protocol_a_candidates.tsv", "w") as f:
        f.write("score\tfollowers\thandle\tseeds\tname\tbio\n")
        for un, u in band:
            seeds_str = ",".join(sorted(u.get("_seeds", [])))
            f.write(f"{u.get('_score')}\t{u.get('followers_count')}\t{un}\t{seeds_str}\t{(u.get('name') or '')[:40]}\t{(u.get('description') or '')[:200].replace(chr(9), ' ').replace(chr(10), ' ')}\n")
    print(f"# Wrote protocol_a_candidates.tsv with {len(band)} rows", file=sys.stderr)
    # Print top 30
    for un, u in band[:30]:
        seeds_str = ",".join(sorted(u.get("_seeds", [])))
        print(f"  score={u['_score']} fol={u.get('followers_count')} @{un}\t[{seeds_str}]\t{(u.get('description') or '')[:120]}")

if __name__ == "__main__":
    main()
