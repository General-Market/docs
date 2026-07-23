#!/usr/bin/env python3
"""
Deep copy-trading sweep — round 2.
Targets: ES, PT (Brazil), TR, AR, FR, RU, VI, ID languages
Niches: crypto perps (Hyperliquid/GMX), Solana memecoins (GMGN/Photon/Axiom/BullX),
        FX/MT4-MT5 (myfxbook/FXBlue), stocks/options (eToro), sports betting,
        prop-firm "funded" sellers
Spends balance down to ~50,000 credit reserve.
"""
from __future__ import annotations
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
PROFILES_FILE = CACHE / "profiles.jsonl"
BUDGET_FILE = ROOT / "niches" / "budget.json"
CREDITS_PER_USD = 100_000
RESERVE_CREDITS = 50_000  # hard stop

# All results land here
results: list[dict] = []


def get_balance() -> int:
    """Get current credit balance via twapi.py."""
    r = subprocess.run(
        ["python3", str(ROOT / "twapi.py"), "balance"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    try:
        d = json.loads(r.stdout)
        return d.get("total", d.get("recharge_credits", 0))
    except Exception:
        return 0


def search(query: str, max_results: int = 20) -> list[dict]:
    """Run advsearch, return list of tweet dicts."""
    r = subprocess.run(
        ["python3", str(ROOT / "twapi.py"), "advsearch", query, "--max", str(max_results)],
        capture_output=True, text=True, cwd=str(ROOT), timeout=120
    )
    try:
        d = json.loads(r.stdout)
        if isinstance(d, list):
            return d
        if isinstance(d, dict):
            return d.get("tweets", d.get("data", []))
    except Exception:
        pass
    return []


def userinfo(handle: str) -> dict | None:
    """Fetch profile info for a handle."""
    r = subprocess.run(
        ["python3", str(ROOT / "twapi.py"), "userinfo", handle.lstrip("@")],
        capture_output=True, text=True, cwd=str(ROOT), timeout=60
    )
    try:
        d = json.loads(r.stdout)
        if isinstance(d, dict) and d.get("screen_name"):
            return d
    except Exception:
        pass
    return None


def extract_url(profile: dict) -> str:
    """Try to extract a real URL from profile bio/url."""
    url = profile.get("url", "") or ""
    desc = profile.get("description", "") or ""
    # look for t.co expansions or direct URLs
    import re
    patterns = re.findall(r'https?://[^\s\'"<>]+', desc + " " + url)
    for p in patterns:
        p = p.rstrip(".,;)")
        if any(x in p for x in ["t.co", "twitter.com", "x.com"]):
            continue
        if any(x in p for x in ["t.me", "telegram", "discord", "linktr.ee", "linktree"]):
            return f"⚠️ {p}"
        return p
    return ""


def process_tweets(tweets: list[dict], niche: str, lang: str) -> list[dict]:
    """Extract unique author data from tweet list."""
    seen = set()
    found = []
    for tw in tweets:
        author = tw.get("author") or {}
        handle = author.get("userName") or author.get("screen_name") or ""
        if not handle or handle.lower() in seen:
            continue
        seen.add(handle.lower())
        followers = author.get("followers") or author.get("followers_count") or 0
        if followers < 500:
            continue
        desc = author.get("description") or ""
        url = extract_url(author)
        found.append({
            "handle": f"@{handle}",
            "followers": followers,
            "lang": lang,
            "niche": niche,
            "desc": desc[:150],
            "url": url,
            "verified": author.get("isBlueVerified") or author.get("verified") or False,
        })
    return found


def check_reserve() -> bool:
    """Return True if we should stop (below reserve)."""
    bal = get_balance()
    print(f"  [balance check] {bal:,} credits (${bal/CREDITS_PER_USD:.2f})", file=sys.stderr)
    return bal <= RESERVE_CREDITS


# ── Query batches ───────────────────────────────────────────────────────────

QUERIES = [
    # ── SPANISH / LATIN AMERICA ──────────────────────────────────────────────
    ("copy trading señales crypto", "ES", "crypto_perps"),
    ("copiar traders cripto ganancias", "ES", "crypto_perps"),
    ("copy trade Hyperliquid español", "ES", "crypto_perps"),
    ("seguir traders cripto señales verificadas", "ES", "crypto_perps"),
    ("trading señales forex MT4 MT5 español", "ES", "fx_mt4"),
    ("señales forex myfxbook rendimiento", "ES", "fx_mt4"),
    ("copy trading Bybit rendimiento ganancias mes", "ES", "crypto_perps"),
    ("scalping señales cripto telegram español", "ES", "crypto_perps"),
    ("inversión cripto bot automatizado copy", "ES", "crypto_perps"),
    ("memecoins solana copy señales español", "ES", "solana_meme"),
    ("prop firm funded trader español resultados", "ES", "prop_firm"),
    ("tips apuestas deportivas telegram español", "ES", "sports_betting"),

    # ── PORTUGUESE / BRAZIL ──────────────────────────────────────────────────
    ("copy trading cripto resultados Brasil", "PT", "crypto_perps"),
    ("sinais forex MT4 resultados comprovados", "PT", "fx_mt4"),
    ("seguir trader Bybit Binance resultados", "PT", "crypto_perps"),
    ("copy trade Hyperliquid português", "PT", "crypto_perps"),
    ("sinais cripto telegram Brasil lucro", "PT", "crypto_perps"),
    ("day trade futures crypto resultado mensal", "PT", "crypto_perps"),
    ("memecoins solana sinais Brasil", "PT", "solana_meme"),
    ("GMGN Photon copy trade Brasil", "PT", "solana_meme"),
    ("prop firm funded trader Brasil aprovado", "PT", "prop_firm"),
    ("dicas apostas esportivas tipster Brasil", "PT", "sports_betting"),
    ("trader profissional forex sinais comprovados", "PT", "fx_mt4"),

    # ── TURKISH ──────────────────────────────────────────────────────────────
    ("copy trading kripto sinyal Türkiye", "TR", "crypto_perps"),
    ("takip et trader kripto kazanç", "TR", "crypto_perps"),
    ("forex sinyal MT4 Türkiye", "TR", "fx_mt4"),
    ("Hyperliquid copy trade Türkçe", "TR", "crypto_perps"),
    ("kripto spot futures sinyal kanal", "TR", "crypto_perps"),
    ("funded trader prop firm Türkiye", "TR", "prop_firm"),

    # ── ARABIC ───────────────────────────────────────────────────────────────
    ("copy trading عملات رقمية أرباح", "AR", "crypto_perps"),
    ("إشارات فوركس MT4 MT5 عربي", "AR", "fx_mt4"),
    ("متابعة المتداولين كريبتو أرباح", "AR", "crypto_perps"),
    ("Hyperliquid copy trade عربي", "AR", "crypto_perps"),
    ("تداول عملات رقمية إشارات موثوقة", "AR", "crypto_perps"),
    ("رهانات رياضية نصائح عربي", "AR", "sports_betting"),

    # ── FRENCH ───────────────────────────────────────────────────────────────
    ("copy trading crypto signaux résultats", "FR", "crypto_perps"),
    ("signaux forex MT4 MT5 français", "FR", "fx_mt4"),
    ("trader suivre signaux crypto gagnant", "FR", "crypto_perps"),
    ("Hyperliquid copy trade français", "FR", "crypto_perps"),
    ("prop firm funded trader France", "FR", "prop_firm"),
    ("pronostics sportifs tipster France résultats", "FR", "sports_betting"),
    ("memecoins solana signaux France", "FR", "solana_meme"),

    # ── RUSSIAN ──────────────────────────────────────────────────────────────
    ("копи трейдинг крипто результаты", "RU", "crypto_perps"),
    ("сигналы форекс MT4 результаты", "RU", "fx_mt4"),
    ("Hyperliquid copy trade русский", "RU", "crypto_perps"),
    ("следовать трейдеру Bybit прибыль", "RU", "crypto_perps"),
    ("мемкоины solana сигналы", "RU", "solana_meme"),
    ("prop firm funded трейдер", "RU", "prop_firm"),

    # ── VIETNAMESE ───────────────────────────────────────────────────────────
    ("copy trading crypto Việt Nam lợi nhuận", "VI", "crypto_perps"),
    ("tín hiệu giao dịch forex MT4 Việt", "VI", "fx_mt4"),
    ("copy trade Hyperliquid tiếng Việt", "VI", "crypto_perps"),

    # ── INDONESIAN ───────────────────────────────────────────────────────────
    ("copy trading crypto Indonesia profit", "ID", "crypto_perps"),
    ("sinyal forex MT4 Indonesia profit", "ID", "fx_mt4"),
    ("copy trade Hyperliquid Bahasa", "ID", "crypto_perps"),
    ("memecoins solana sinyal Indonesia", "ID", "solana_meme"),

    # ── ENGLISH — NEW NICHES NOT IN PRIOR PASS ───────────────────────────────
    # Hyperliquid / GMX perps
    ("Hyperliquid copy trade leaderboard performer", "EN", "crypto_perps"),
    ("Hyperliquid vault copy trading best", "EN", "crypto_perps"),
    ("GMX copy trade GLP vault results", "EN", "crypto_perps"),
    ("Paradex vault copy trade performer", "EN", "crypto_perps"),
    ("dYdX copy trading leaderboard results", "EN", "crypto_perps"),
    ("Bybit copy trade top performer leaderboard 2025", "EN", "crypto_perps"),
    ("OKX copy trade leaderboard top performer", "EN", "crypto_perps"),
    ("Gate.io copy trade leader verified P&L", "EN", "crypto_perps"),

    # Solana memecoins
    ("GMGN copy trade Solana wallet", "EN", "solana_meme"),
    ("Photon copy trade Solana memecoins", "EN", "solana_meme"),
    ("Axiom trade Solana memecoins alpha", "EN", "solana_meme"),
    ("BullX copy trade Solana memecoins results", "EN", "solana_meme"),
    ("pump.fun copy wallet follow trade Solana", "EN", "solana_meme"),
    ("Solana memecoin trading website copy wallet", "EN", "solana_meme"),
    ("on-chain copy trade Solana alpha wallet", "EN", "solana_meme"),

    # FX / MT4-MT5 / myfxbook
    ("myfxbook verified account copy trading", "EN", "fx_mt4"),
    ("FXBlue copy trading verified results", "EN", "fx_mt4"),
    ("FTMO funded trader results copy", "EN", "prop_firm"),
    ("prop firm funded account copy trading", "EN", "prop_firm"),
    ("MyForexFunds funded trader copy signals", "EN", "prop_firm"),
    ("forex copy trading 70% monthly ROI verified", "EN", "fx_mt4"),
    ("MetaTrader 4 copy trade signal provider", "EN", "fx_mt4"),
    ("forex signal provider website verified performance", "EN", "fx_mt4"),
    ("XAUUSD gold copy trade signals results", "EN", "fx_mt4"),
    ("funded trader challenge passed results", "EN", "prop_firm"),

    # Stocks / options / eToro
    ("eToro popular investor copy trading profile", "EN", "stocks_options"),
    ("options flow copy trading website", "EN", "stocks_options"),
    ("stock alerts copy service website results", "EN", "stocks_options"),
    ("options trader copy subscription website", "EN", "stocks_options"),
    ("swing trade alerts copy service verified", "EN", "stocks_options"),
    ("day trader copy alerts website P&L", "EN", "stocks_options"),

    # Sports betting
    ("tipster website verified betting record ROI", "EN", "sports_betting"),
    ("sports betting tipster P&L record website", "EN", "sports_betting"),
    ("betting tips verified ROI track record", "EN", "sports_betting"),
    ("sports tipster subscription service website", "EN", "sports_betting"),

    # ── ENGLISH — MORE ON EXISTING NICHES ───────────────────────────────────
    ("copy trading SaaS platform traders social", "EN", "crypto_perps"),
    ("mirror trading crypto social platform", "EN", "crypto_perps"),
    ("crypto copy trading app website launch", "EN", "crypto_perps"),
    ("best crypto trader copy follow website", "EN", "crypto_perps"),
    ("perp trading leaderboard copy", "EN", "crypto_perps"),
]


def main():
    print(f"Starting deep sweep. Balance: {get_balance():,} credits", file=sys.stderr)

    all_candidates: list[dict] = []
    seen_handles: set[str] = set()
    query_count = 0

    for query, lang, niche in QUERIES:
        # Check reserve before each query
        bal = get_balance()
        if bal <= RESERVE_CREDITS:
            print(f"  [STOP] Reserve reached: {bal:,} credits", file=sys.stderr)
            break

        print(f"\n[{query_count+1}/{len(QUERIES)}] {lang}/{niche}: {query[:60]}", file=sys.stderr)

        try:
            tweets = search(query, max_results=30)
            candidates = process_tweets(tweets, niche, lang)
            for c in candidates:
                h = c["handle"].lower()
                if h not in seen_handles:
                    seen_handles.add(h)
                    all_candidates.append(c)
            print(f"  → {len(tweets)} tweets, {len(candidates)} new candidates (total: {len(all_candidates)})", file=sys.stderr)
            query_count += 1
        except Exception as e:
            print(f"  [ERROR] {e}", file=sys.stderr)

        time.sleep(0.5)  # brief pause between calls

    print(f"\n[DONE] {query_count} queries, {len(all_candidates)} candidates", file=sys.stderr)
    print(f"Final balance: {get_balance():,} credits", file=sys.stderr)

    # Output as JSON
    print(json.dumps(all_candidates, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
