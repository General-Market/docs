#!/usr/bin/env python3
"""
Mass profile qualification — fetch userinfo for the top candidates
discovered in cache + from searches, focusing on URL expansion.
"""
from __future__ import annotations
import json, subprocess, sys, time
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
RESERVE = 50_000
CREDITS_PER_USD = 100_000

def balance() -> int:
    r = subprocess.run(["python3", str(ROOT / "twapi.py"), "balance"],
                       capture_output=True, text=True, timeout=30)
    d = json.loads(r.stdout)
    return d.get("total", 0)

def userinfo(handle: str) -> dict | None:
    r = subprocess.run(["python3", str(ROOT / "twapi.py"), "userinfo", handle.lstrip("@")],
                       capture_output=True, text=True, cwd=str(ROOT), timeout=60)
    try:
        d = json.loads(r.stdout)
        if isinstance(d, dict):
            return d
    except Exception:
        pass
    return None

# Priority handles — mix of already known + candidates from tweet search
HANDLES = [
    # Already-known strong candidates — confirm and expand URLs
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
    "heoilikj",
    "us30tradinglab",
    "HYPERDailyTK",
    "vainxyz",
    "betr",
    "NoLimitGains",
    "cryptorover",
    "DaCryptoLady_",
    "pump_okLaly",
    "Crypto_Pranjal",
    # From cache analysis — qualified
    "HyperSignals_ai",
    "Thomas_james_1",
    "Starr_gael",
    "profitfxsignal",
    "MyForexFunds",
    "joseftrades",
    "CD_XAUUSD",
    "B_trader__",
    "CryptoWolfPack",
    "mytradesignals",
    "Trade_Fluxx",
    "SureLeverage",
    "ForexTvOfficial",
    "Leveragedgiant",
    "DBotWeb3",
    "King_of__Wolves",
    # New discovered handles from twitter searches
    "frank_liquid",       # founder of liquid.trade
    "GoatFunded",
    "AtlasFunded",
    "TrueForexFunds",
    "SurgeTrader",
    "FundedNext",
    "E8Markets",
    "TopstepTrader",
    "Topstep",
    "BlueSky_Funded",
    "PropFirmMatch",
    "ftmo_official",
    "FTMOtrader",
    "FundedTraderPro",
    "TheFundedTrader",
    # Signal providers
    "KingLeaderFX",
    "FXMasterGuru",
    "EasyPipsFX",
    "GoldSignalsVIP",
    "ProfessionalFX",
    "CryptoSignalsVIP",
    "WhaleCryptoAlerts",
    # Hyperliquid / perp specific
    "HLVaults",
    "HypeVault",
    "hyperliquid_bull",
    "HL_trader",
    "GigaVault",
    # Social trading platforms
    "legend_trade",
    "legenddotrade",
    "LiquidSocial",
    "TradeRiot",
    "tradingriot",
    "FullstackTrade",
    "CorvusTrade",
    "SocialTrading_io",
    "CopyTradingPro",
    "eToro",
    "ZuluTrade",
    "Darwinex",
    "naga_group",
    "NAGA_Official",
    "PrimeXBT",
    "Bitget_Official",
    # Sports betting verified
    "OddsJam",
    "Sportradar",
    "SharpsideApp",
    "GambetDC",
    "Props_Live",
    "PropsApp",
    "UnderdogFantasy",
    # New ES/PT accounts
    "CriptoSeñales",
    "CriptoCopiaTrading",
    "ForexBrasil",
    "TradingBrasil",
    "TraderBrasil",
    "CriptoTreinamento",
    "SignalsCripto",
    # Specific handles from tweets found in search
    "HYPERDailyTK",
    "HyperAlerts",
    "hlperps",
    "perp_leaderboard",
    "CopyOnChain",
    "CopyTradeSol",
    "WalletTracker_",
    "OnChainCopy",
    "SmartMoneyFollow",
    "DeriBullish",
    "PerpTracker",
]


def main():
    print(f"Starting qualification. Balance: {balance():,}", file=sys.stderr)
    results = []

    for i, handle in enumerate(HANDLES):
        bal = balance()
        if bal <= RESERVE:
            print(f"  [STOP] Reserve reached at {i+1}/{len(HANDLES)}", file=sys.stderr)
            break
        if i % 10 == 0:
            print(f"  [BAL] {bal:,} credits", file=sys.stderr)

        print(f"[{i+1}/{len(HANDLES)}] @{handle}", file=sys.stderr)
        info = userinfo(handle)
        if info and isinstance(info, dict):
            followers = info.get("followers") or 0
            bio = info.get("bio") or ""
            if followers and followers > 0:
                results.append({
                    "handle": info.get("handle") or handle,
                    "followers": followers,
                    "bio": bio[:120],
                    "verified": info.get("verified_blue"),
                    "statuses": info.get("statuses"),
                })
                print(f"  → {followers:,} followers | {bio[:60]}", file=sys.stderr)
            else:
                print(f"  → not found or 0 followers", file=sys.stderr)
        else:
            print(f"  → no data", file=sys.stderr)
        time.sleep(0.15)

    bal_end = balance()
    print(f"\nDone. Balance: {bal_end:,} credits", file=sys.stderr)
    print(f"Got {len(results)} profiles", file=sys.stderr)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
