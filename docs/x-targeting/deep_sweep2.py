#!/usr/bin/env python3
"""
Deep sweep round 2 — direct twapi calls, new queries and profile fetches.
Runs until balance <= 50,000 credits.
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

def search(query: str, pages: int = 2, force: bool = False) -> str:
    """Run advsearch with pages, return stdout."""
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
        return json.loads(r.stdout)
    except Exception:
        return None

def can_spend() -> bool:
    bal = balance()
    print(f"  [BAL] {bal:,} credits (${bal/CREDITS_PER_USD:.3f})", file=sys.stderr)
    return bal > RESERVE

# New queries NOT in the 7-day cache
NEW_QUERIES = [
    # --- ENGLISH new niches ---
    ("Hyperliquid copy trade leaderboard performer", 2),
    ("Hyperliquid vault copy trading best results", 2),
    ("GMX copy trade GLP vault results", 2),
    ("Paradex vault copy trade performer", 2),
    ("dYdX copy trading leaderboard results", 2),
    ("OKX copy trade leaderboard top performer", 2),
    ("Bybit copy trade top performer leaderboard 2026", 2),
    ("myfxbook verified account copy trading website", 2),
    ("FXBlue copy trading verified results website", 2),
    ("eToro popular investor copy trading profile", 2),
    ("GMGN copy trade Solana wallet site", 2),
    ("Photon copy trade Solana memecoins", 2),
    ("Axiom copy trade Solana memecoins alpha", 2),
    ("BullX copy trade Solana memecoins results", 2),
    ("pump.fun copy wallet follow trade Solana", 2),
    ("FTMO funded trader results copy", 2),
    ("prop firm funded trader copy signals website", 2),
    ("options trader copy subscription website results", 2),
    ("swing trade alerts copy service verified", 2),
    ("tipster website verified betting record ROI", 2),
    ("sports betting tipster subscription service website", 2),
    ("copy trading SaaS platform social traders", 2),
    ("mirror trading crypto social platform website", 2),
    ("best crypto trader follow website copy", 2),
    ("perp trading leaderboard copy mirror", 2),
    ("follower copy trading verified P&L platform", 2),
    ("social trading platform copy crypto website", 2),
    ("copy trade leaderboard published P&L", 2),
    ("copy trading platform verified track record", 2),
    ("automated copy trading bot website results", 2),
    # --- Multi-lang new ---
    ("copy trading kripto sinyal Türkiye site", 2),
    ("copy trading عملات رقمية أرباح موقع", 2),
    ("copy trading crypto signaux résultats site", 2),
    ("копи трейдинг крипто результаты сайт", 2),
    ("copy trading Vietnam lợi nhuận website", 2),
    ("copy trading Indonesia profit website", 2),
    ("copy trading cripto Brasil site resultados", 2),
    ("sinais forex MT4 Brasil site resultados", 2),
    ("copy trade cripto Argentina resultados", 2),
    ("señales forex MT4 Mexico resultados", 2),
    ("copy trading criptomonedas Colombia Venezuela", 2),
    ("trading señales cripto Peru Chile resultados", 2),
    ("forex copy trade España resultados web", 2),
    ("Hyperliquid copy trade español web", 2),
    ("copy trading cripto France site", 2),
    ("kopieren handel krypto Ergebnisse Website", 2),
    ("copy trading criptovalute Italia", 2),
    ("copy trading Korea 카피트레이딩 사이트", 2),
    ("コピートレード 仮想通貨 サイト 日本語", 2),
    ("跟单交易 加密货币 平台 网站", 2),
    # --- Deeper EN specific ---
    ("Hyperliquid top trader copy site", 2),
    ("crypto signals website verified performance track", 2),
    ("solana wallet tracker copy trade", 2),
    ("on-chain wallet copy bot Solana", 2),
    ("DegenCopyBot copy trade solana", 2),
    ("copycat trade crypto", 2),
    ("live copy trading platform crypto social", 2),
    ("funded trader prop firm copy trade website", 2),
    ("automated trading signal website subscription", 2),
    ("DeFi copy trading vault onchain", 2),
]

# Handles to deep-qualify (userinfo fetch)
HANDLES_TO_QUALIFY = [
    # High-follower candidates from cache analysis
    "Starr_gael",         # 72k — funded trader FTMO/FundedNext
    "Thomas_james_1",     # 61k — momentum trader, founder @MMTG_x
    "profitfxsignal",     # 60k — Forex signals 15yr professional
    "MyForexFunds",       # 41k — prop firm 60k live traders
    "DBotWeb3",           # 40k — SOL & EVM copy trading bot
    "CD_XAUUSD",          # 31k — XAUUSD signal provider
    "joseftrades",        # 31k — NQ/ES futures, prop firm comparisons
    "HyperSignals_ai",    # 19k — follow smart money HyperSignals
    "B_trader__",         # 18k — EURUSD/USDJPY/XAUUSD signals
    "CryptoWolfPack",     # 15k — crypto signals since 2017
    "mytradesignals",     # 15k — stocks/crypto/commodities signals
    "Trade_Fluxx",        # 10k — crypto signals + news
    "King_of__Wolves",    # 6k — AisarLabs creator
    "HYPERDailyTK",       # 89k — Hyperliquid daily
    "us30tradinglab",     # 9k — US30 copy service
    "Leveragedgiant",     # 23k — GoatFunded partner
    "SureLeverage",       # 22k — prop firm, $1B+ funded
    "ForexTvOfficial",    # 26k — Forex TV, GoatFunded partner
    # More candidates to qualify
    "liquidtrading",      # TOP-1 from prior pass — confirm
    "ThinkingUSD",        # fullstack.trade CEO
    "MerlijnTrader",      # 430k
    "asklivermore",       # 130k
    "ExitLiqCapital",     # 35k
    "NukeCapital",        # 22k
    "ryohhno",            # legend.trade
    "abetrade",           # tradingriot.com
    "fiddybps1",          # paradex vault
    "otomate_trade",      # otomate.trade
    # New candidates from search
    "hyperliquid_top",
    "trader_joe_xl",
    "GoatFundedTrader",
    "MarcusTrading_",
    "WilliamSwingTrader",
    "CharlieSheen_FX",
    "ForexGuru_Official",
]

def main():
    print(f"\n=== Deep Sweep Round 2 ===", file=sys.stderr)
    print(f"Balance: {balance():,} credits", file=sys.stderr)

    results = []

    # Phase 1: Run new queries
    print(f"\n--- Phase 1: New search queries ({len(NEW_QUERIES)} queries) ---", file=sys.stderr)
    for i, (query, pages) in enumerate(NEW_QUERIES):
        if not can_spend():
            print(f"  [STOP] Reserve reached at query {i+1}", file=sys.stderr)
            break
        print(f"\n[{i+1}/{len(NEW_QUERIES)}] {query[:70]}", file=sys.stderr)
        out = search(query, pages=pages)
        print(f"  → {out[:80]}", file=sys.stderr)
        time.sleep(0.3)

    # Phase 2: Userinfo fetches for qualification
    print(f"\n--- Phase 2: Profile deep-qualify ({len(HANDLES_TO_QUALIFY)} handles) ---", file=sys.stderr)
    for i, handle in enumerate(HANDLES_TO_QUALIFY):
        if not can_spend():
            print(f"  [STOP] Reserve reached at handle {i+1}", file=sys.stderr)
            break
        print(f"\n[{i+1}/{len(HANDLES_TO_QUALIFY)}] @{handle}", file=sys.stderr)
        info = userinfo(handle)
        if info:
            results.append({
                "handle": info.get("handle") or handle,
                "followers": info.get("followers"),
                "bio": info.get("bio", "")[:120],
                "verified": info.get("verified_blue"),
            })
            print(f"  → {info.get('followers', '?'):,} followers | {info.get('bio','')[:60]}", file=sys.stderr)
        time.sleep(0.2)

    # Phase 3: Mine cache for new qualifying profiles
    print(f"\n--- Phase 3: Mining profile cache ---", file=sys.stderr)
    PROFILES = ROOT / "cache" / "profiles.jsonl"
    profiles = [json.loads(l) for l in PROFILES.read_text().split('\n') if l.strip()]

    # Extract all profiles relevant to copy trading
    copy_relevant = []
    KEYWORDS = [
        'copy trad', 'copy trade', 'signal', 'signals', 'mirror trad',
        'follow my trade', 'copy my trade', 'alerts', 'leaderboard',
        'funded', 'prop firm', 'fx copy', 'forex signal', 'forex copy',
        'myfxbook', 'fxblue', 'bybit copy', 'binance copy', 'copy wallet',
        'copy trading', 'trade like me', 'social trading', 'autocopy',
        'sinais', 'señales', 'signaux', 'сигналы', 'sinyal', 'إشارات',
        'copy follow', 'tipster', 'tipsters', 'sports tips', 'betting tips',
        'hyper signal', 'smart money follow', 'track record', 'verified pnl',
        'live pnl', 'daily pnl', 'performance', 'roi %', 'win rate',
    ]
    EXCLUDE = [
        'journalist', 'reporter', '@cnn', '@bbc', 'blockchain infra',
        'news outlet', 'data aggregator', 'exchange official',
    ]
    for p in profiles:
        fc = p.get('followers_count') or 0
        if fc < 3000:
            continue
        desc = (p.get('description') or '').lower()
        url_raw = (p.get('url') or '')

        if any(ex in desc for ex in EXCLUDE):
            continue
        if not any(k in desc for k in KEYWORDS):
            continue

        # Determine URL quality
        url_clean = url_raw
        if 't.co' in url_raw:
            url_clean = url_raw  # unexpanded

        not_real = any(x in url_raw.lower() for x in ['t.me', 'telegram', 'discord.gg'])
        has_real = any(x in url_raw.lower() for x in [
            '.trade', '.io', '.app', '.com', '.net', '.xyz', '.fi', 'whop.com', 'app.'
        ]) and not not_real and 't.co' not in url_raw

        copy_relevant.append({
            'handle': '@' + p.get('screen_name', ''),
            'followers': fc,
            'desc': (p.get('description') or '')[:150],
            'url': url_clean,
            'has_real_url': has_real,
            'not_real': not_real,
        })

    copy_relevant.sort(key=lambda r: (-int(r['has_real_url']), -r['followers']))

    print(f"\nFound {len(copy_relevant)} copy-trading relevant profiles (3k+ followers)", file=sys.stderr)
    print(json.dumps(copy_relevant, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
