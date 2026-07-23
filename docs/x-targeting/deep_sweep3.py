#!/usr/bin/env python3
"""
Deep sweep round 3 — high-yield specific queries + followings expansion.
Focus on queries that actually return results and profile fetches.
"""
from __future__ import annotations
import json, subprocess, sys, time, re
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
RESERVE = 50_000
CREDITS_PER_USD = 100_000

def balance() -> int:
    r = subprocess.run(["python3", str(ROOT / "twapi.py"), "balance"],
                       capture_output=True, text=True, timeout=30)
    d = json.loads(r.stdout)
    return d.get("total", 0)

def search(query: str, pages: int = 3, force: bool = False) -> str:
    args = ["python3", str(ROOT / "twapi.py"), "advsearch", query,
            "--pages", str(pages)]
    if force:
        args.append("--force")
    r = subprocess.run(args, capture_output=True, text=True,
                       cwd=str(ROOT), timeout=180)
    return r.stdout.strip()

def userinfo(handle: str) -> dict | None:
    r = subprocess.run(["python3", str(ROOT / "twapi.py"), "userinfo", handle.lstrip("@")],
                       capture_output=True, text=True, cwd=str(ROOT), timeout=60)
    try:
        d = json.loads(r.stdout)
        if isinstance(d, dict) and 'handle' in d:
            return d
    except Exception:
        pass
    return None

def followings(handle: str, max_n: int = 100) -> str:
    r = subprocess.run(["python3", str(ROOT / "twapi.py"), "followings", handle.lstrip("@"),
                        "--max", str(max_n)],
                       capture_output=True, text=True, cwd=str(ROOT), timeout=120)
    return r.stdout.strip()

def can_spend() -> bool:
    bal = balance()
    print(f"  [BAL] {bal:,} credits (${bal/CREDITS_PER_USD:.3f})", file=sys.stderr)
    return bal > RESERVE

# High-yield Twitter search operator queries (these actually return results)
# Using Twitter advanced search operators for better results
HIGH_YIELD_QUERIES = [
    # -- Proven copy-trading terms with operators --
    ('"copy trading" "website" crypto -is:retweet min_faves:20', 3),
    ('"copy trade" "platform" crypto -is:retweet min_faves:20', 3),
    ('"follow my trades" crypto -is:retweet min_faves:30', 3),
    ('"copy my trades" "platform" -is:retweet min_faves:20', 3),
    ('"mirror trading" crypto "site" -is:retweet min_faves:10', 3),
    ('"social trading" crypto platform launch -is:retweet min_faves:30', 3),
    ('"copy trading" OR "copy trade" Hyperliquid -is:retweet min_faves:15', 3),
    ('"Hyperliquid" "copy" "leaderboard" -is:retweet min_faves:10', 3),
    ('"copy trade" bybit leaderboard results -is:retweet min_faves:10', 3),
    ('"copy trade" OKX results verified -is:retweet min_faves:10', 3),
    ('"myfxbook" "copy" trading verified -is:retweet min_faves:5', 3),
    ('"prop firm" funded trader results -is:retweet min_faves:50', 3),
    ('"FTMO" funded "copy" -is:retweet min_faves:20', 3),
    ('"copy signals" forex -is:retweet min_faves:20', 3),
    ('"forex signals" website verified -is:retweet min_faves:20', 3),
    ('"gold signals" XAUUSD copy -is:retweet min_faves:15', 3),
    ('"GMGN" "copy" wallet solana -is:retweet min_faves:10', 3),
    ('"pump.fun" "copy" wallet trade -is:retweet min_faves:10', 3),
    ('"eToro" "popular investor" copy -is:retweet min_faves:10', 3),
    ('"options" "copy" alerts service -is:retweet min_faves:20', 3),
    ('"betting tips" website record -is:retweet min_faves:20', 3),
    ('"tipster" verified ROI record -is:retweet min_faves:20', 3),
    ('"sports betting" "ROI" verified -is:retweet min_faves:30', 3),
    # Multi-lang with operators
    ('"copy trading" OR "señales" cripto -is:retweet lang:es min_faves:10', 3),
    ('"copy trading" OR "sinais" forex -is:retweet lang:pt min_faves:10', 3),
    ('"copy" "trading" "kripto" -is:retweet lang:tr min_faves:10', 3),
    ('"copy trading" OR "signaux" crypto -is:retweet lang:fr min_faves:10', 3),
    ('"copy trading" Indonesia profit -is:retweet lang:in min_faves:5', 3),
    # From specific platforms
    ('from:HyperSignals_ai -is:retweet', 2),
    ('from:Thomas_james_1 -is:retweet', 2),
    ('from:Starr_gael -is:retweet', 2),
    ('from:profitfxsignal -is:retweet', 2),
    ('from:joseftrades -is:retweet', 2),
    ('from:CD_XAUUSD -is:retweet', 2),
    ('from:liquidtrading -is:retweet', 2),
    ('from:ThinkingUSD -is:retweet', 2),
    ('from:MerlijnTrader -is:retweet', 2),
    ('from:ExitLiqCapital -is:retweet', 2),
    ('from:abetrade -is:retweet', 2),
    ('from:fiddybps1 -is:retweet', 2),
    # Engagement-heavy copy-trading tweets
    ('"my copy trading" results -is:retweet min_faves:100', 3),
    ('"copy trading profits" -is:retweet min_faves:50', 3),
    ('"copy trade profits" -is:retweet min_faves:50', 3),
    ('"I copy trade" -is:retweet min_faves:50', 3),
    ('"my copiers" earned -is:retweet min_faves:30', 3),
    ('"copy trading" "join" platform crypto -is:retweet min_faves:30', 3),
    ('"follow me" trading platform copy auto -is:retweet min_faves:30', 3),
    # Specific platforms mentioned in tweets
    ('"legend.trade" copy -is:retweet min_faves:5', 3),
    ('"liquid.trade" -is:retweet min_faves:5', 3),
    ('"fullstack.trade" -is:retweet min_faves:5', 3),
    ('"otomate.trade" -is:retweet min_faves:5', 3),
    ('"axonx.xyz" -is:retweet', 3),
    ('"vooi.io" copy -is:retweet min_faves:5', 3),
    ('"cypher.trade" copy -is:retweet min_faves:5', 3),
    ('"copy trading" "track record" verified -is:retweet min_faves:20', 3),
    ('"copy trading" "win rate" -is:retweet min_faves:30', 3),
    # ES/PT specific high-yield
    ('copy trade Hyperliquid lang:es -is:retweet min_faves:5', 3),
    ('señales forex verificadas lang:es -is:retweet min_faves:5', 3),
    ('sinais trading resultados lang:pt -is:retweet min_faves:5', 3),
    ('copy trade cripto Brasil lang:pt -is:retweet min_faves:5', 3),
    # Stock/options specific
    ('"swing alerts" OR "stock alerts" copy subscription -is:retweet min_faves:20', 3),
    ('"options alerts" copy service -is:retweet min_faves:20', 3),
    ('"stock picks" subscription verified performance -is:retweet min_faves:20', 3),
]

# Handles to get followings of (to discover who top traders follow)
FOLLOWINGS_TARGETS = [
    "liquidtrading",     # liquid.trade — our TOP-1
    "ThinkingUSD",       # fullstack.trade CEO
    "ExitLiqCapital",    # derivatives trader
    "abetrade",          # tradingriot.com
    "fiddybps1",         # paradex vault
]

# Additional profiles to deep-qualify
DEEP_QUALIFY = [
    "HyperSignals_ai",
    "Thomas_james_1",
    "Starr_gael",
    "profitfxsignal",
    "MyForexFunds",
    "joseftrades",
    "CD_XAUUSD",
    "B_trader__",
    "CryptoWolfPack",
    "Trade_Fluxx",
    "HYPERDailyTK",
    "SureLeverage",
    "ForexTvOfficial",
    "Leveragedgiant",
    "King_of__Wolves",
    "DBotWeb3",
    "liquidtrading",
    "ThinkingUSD",
    "MerlijnTrader",
    "asklivermore",
    "ExitLiqCapital",
    "NukeCapital",
    "ryohhno",
    "abetrade",
    "fiddybps1",
    "otomate_trade",
    "betr",
    "LoyalTipsters02",
    "us30tradinglab",
]


def main():
    print(f"\n=== Deep Sweep Round 3 ===", file=sys.stderr)
    bal_start = balance()
    print(f"Starting balance: {bal_start:,} credits (${bal_start/CREDITS_PER_USD:.3f})", file=sys.stderr)

    # Phase 1: High-yield queries
    print(f"\n--- Phase 1: {len(HIGH_YIELD_QUERIES)} high-yield queries ---", file=sys.stderr)
    for i, (query, pages) in enumerate(HIGH_YIELD_QUERIES):
        if not can_spend():
            print(f"  [STOP] Reserve reached", file=sys.stderr)
            break
        print(f"[{i+1}/{len(HIGH_YIELD_QUERIES)}] {query[:80]}", file=sys.stderr)
        out = search(query, pages=pages)
        print(f"  → {out[:80]}", file=sys.stderr)
        time.sleep(0.3)

    # Phase 2: Profile qualification
    print(f"\n--- Phase 2: Profile deep-qualify ---", file=sys.stderr)
    qual_results = []
    for i, handle in enumerate(DEEP_QUALIFY):
        if not can_spend():
            print(f"  [STOP] Reserve reached", file=sys.stderr)
            break
        print(f"[{i+1}/{len(DEEP_QUALIFY)}] @{handle}", file=sys.stderr)
        info = userinfo(handle)
        if info:
            qual_results.append(info)
            print(f"  → {(info.get('followers') or 0):,} followers | {info.get('bio','')[:70]}", file=sys.stderr)
        time.sleep(0.2)

    # Phase 3: Followings expansion
    print(f"\n--- Phase 3: Followings expansion ---", file=sys.stderr)
    for handle in FOLLOWINGS_TARGETS:
        if not can_spend():
            print(f"  [STOP] Reserve reached", file=sys.stderr)
            break
        print(f"[followings] @{handle}", file=sys.stderr)
        out = followings(handle, max_n=200)
        print(f"  → {out[:80]}", file=sys.stderr)
        time.sleep(0.5)

    bal_end = balance()
    spent = bal_start - bal_end
    print(f"\n=== DONE ===", file=sys.stderr)
    print(f"Balance: {bal_end:,} credits (${bal_end/CREDITS_PER_USD:.3f})", file=sys.stderr)
    print(f"Spent this run: {spent:,} credits (${spent/CREDITS_PER_USD:.3f})", file=sys.stderr)

    # Mine full profiles cache
    PROFILES = ROOT / "cache" / "profiles.jsonl"
    profiles = [json.loads(l) for l in PROFILES.read_text().split('\n') if l.strip()]
    print(f"\nTotal profiles in cache: {len(profiles)}", file=sys.stderr)

    KEYWORDS = [
        'copy trad', 'copy trade', 'signal', 'signals', 'mirror trad',
        'follow my trade', 'copy my trade', 'alert', 'leaderboard',
        'funded', 'prop firm', 'forex', 'fx copy', 'myfxbook',
        'fxblue', 'bybit copy', 'binance copy', 'copy wallet',
        'social trading', 'autocopy', 'sinais', 'señales', 'signaux',
        'сигналы', 'sinyal', 'tipster', 'sports tips', 'betting',
        'track record', 'verified pnl', 'win rate', 'roi',
        'trades automatically', 'copy follow',
    ]

    relevant = []
    seen_handles = set()
    for p in profiles:
        fc = p.get('followers_count') or 0
        if fc < 2000:
            continue
        handle = (p.get('screen_name') or '').lower()
        if handle in seen_handles:
            continue
        seen_handles.add(handle)

        desc = (p.get('description') or '').lower()
        url = (p.get('url') or '')

        # Skip pure media/exchanges/protocols
        skip_handles = {'binance', 'coinbase', 'kraken', 'okx', 'bybit_official',
                        'cointelegraph', 'coindesk', 'coingecko', 'coinmarketcap',
                        'elonmusk', 'mrbeast', 'wsj', 'vitalikbuterin'}
        if handle in skip_handles:
            continue

        if not any(k in desc for k in KEYWORDS):
            continue

        # Classify URL
        url_type = "none"
        if url:
            ul = url.lower()
            if any(x in ul for x in ['t.me', 'telegram']):
                url_type = "telegram"
            elif 'discord.gg' in ul or 'discord.com/invite' in ul:
                url_type = "discord"
            elif 'linktr.ee' in ul:
                url_type = "linktree"
            elif 't.co' in ul:
                url_type = "tco_unexpanded"
            elif any(x in ul for x in ['whop.com', 'whop.io']):
                url_type = "whop"
            elif url.startswith('http'):
                url_type = "real"

        relevant.append({
            'handle': '@' + p.get('screen_name', ''),
            'followers': fc,
            'lang': p.get('lang', ''),
            'desc': (p.get('description') or '')[:150],
            'url': url,
            'url_type': url_type,
            'verified': p.get('verified'),
        })

    relevant.sort(key=lambda r: (
        0 if r['url_type'] == 'real' else
        1 if r['url_type'] == 'whop' else
        2 if r['url_type'] == 'tco_unexpanded' else 3,
        -r['followers']
    ))

    print(f"Relevant copy-trading profiles: {len(relevant)}", file=sys.stderr)
    print(json.dumps(relevant, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
