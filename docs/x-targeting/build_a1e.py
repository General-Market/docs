#!/usr/bin/env python3
"""Build the A1e reverse-triangulation frequency map.

For each PASS account, load its cached _followers.json. Build map of
handle -> set of PASS accounts that have them as a follower. Sort by
frequency. Filter by follower-band + niche bio keywords.
"""
import json
import os
import sys
from pathlib import Path
from collections import defaultdict

PASS = ["ThalexGlobal", "RoboNetHQ", "NeutraFinance", "quantymacro",
        "0xLoris", "chameleon_jeff", "rf_extended"]

TIER2_BIO = {"DrDavidSimic", "bookdepth", "annanay", "ArturSepp", "Quantaraum",
             "gametheorizing", "anthdm", "GrantStenger", "mikevanrossum",
             "cardosofede", "DrJStrategy", "extendedapp"}

PASS_LOWER = {h.lower() for h in PASS}
TIER2_LOWER = {h.lower() for h in TIER2_BIO}

# Niche keywords (positive)
NICHE_KW = [
    "options", "vol ", "volatility", "iv ", "gamma", "vega", "theta",
    "market mak", "mm ", "hft", "high-frequen", "high frequen",
    "perp", "perpetual", "futures", "derivative", "deribit", "thalex",
    "quant", "algo", "systematic", "trading bot", "execution",
    "liquidity prov", "lp ", "amm", "order book", "orderbook",
    "arbitrage", "stat arb", "basis", "funding", "spreads",
    "delta-neutral", "delta neutral", "rfq", "skew", "smile",
]
# Exclude these as KOL/grifter/spam
EXCLUDE_KW = [
    "kol", "shitcoin", "100x", "1000x", "moonshot", "telegram channel",
    "free signals", "vip group", "alpha group", "presale", "p2e ",
    "memecoin caller", "calls daily", "signal channel", "trade with me",
    "join my", "dm for", "course ", "academy", "mentorship",
    "nft artist", "music", "model ", "onlyfans", "playboi", "rapper",
]


def load_followers(handle: str):
    p = Path(f"cache/raw_searches/followers/{handle}_followers.json")
    if not p.exists():
        return []
    return json.loads(p.read_text())


def get_audited_handles():
    """All handles that have a lasttweets cache entry — i.e. were audited."""
    audited = set()
    ledger = Path("cache/twapi-ledger.jsonl")
    if not ledger.exists():
        return audited
    for line in ledger.read_text().splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except Exception:
            continue
        label = row.get("label", "")
        if label.startswith("lasttweets:"):
            h = label.split(":", 1)[1].split(":")[0]
            audited.add(h.lower())
    return audited


def bio_score(bio: str) -> tuple[int, list]:
    b = (bio or "").lower()
    hits = [kw.strip() for kw in NICHE_KW if kw in b]
    excludes = [kw.strip() for kw in EXCLUDE_KW if kw in b]
    return len(hits) - 3 * len(excludes), hits


def main():
    # Aggregate: handle -> { "user": userdict, "sets": set(pass_handles) }
    agg = {}
    for pa in PASS:
        users = load_followers(pa)
        print(f"  {pa}: {len(users)} followers", file=sys.stderr)
        for u in users:
            uname = (u.get("userName") or u.get("screen_name") or "").strip()
            if not uname:
                continue
            key = uname.lower()
            if key not in agg:
                agg[key] = {"user": u, "pass_followers": set()}
            agg[key]["pass_followers"].add(pa)
            # Keep the longest description we see
            cur_desc = (agg[key]["user"].get("description") or "")
            new_desc = (u.get("description") or "")
            if len(new_desc) > len(cur_desc):
                agg[key]["user"] = u

    print(f"  total unique candidates: {len(agg)}", file=sys.stderr)

    # Frequency tally
    by_count = defaultdict(int)
    for v in agg.values():
        by_count[len(v["pass_followers"])] += 1
    for n in sorted(by_count.keys(), reverse=True):
        print(f"  follows {n} PASS: {by_count[n]} accounts", file=sys.stderr)

    # Filter to >=2 (with only 200/page sampling, >=3 is rare — lower threshold)
    strong = [(k, v) for k, v in agg.items() if len(v["pass_followers"]) >= 2]
    print(f"  >=2 PASS overlap: {len(strong)}", file=sys.stderr)
    threes = [(k, v) for k, v in agg.items() if len(v["pass_followers"]) >= 3]
    print(f"  >=3 PASS overlap (rare, surface as-is): {len(threes)}", file=sys.stderr)
    for k, v in threes:
        u = v["user"]
        print(f"    @{u.get('userName')} ({u.get('followers_count')} fol) — {','.join(sorted(v['pass_followers']))} — {(u.get('description') or '')[:120]}", file=sys.stderr)

    audited = get_audited_handles()
    print(f"  previously audited: {len(audited)} handles", file=sys.stderr)

    # Tier filter
    rows = []
    for k, v in strong:
        if k in PASS_LOWER or k in TIER2_LOWER:
            continue
        if k in audited:
            continue
        u = v["user"]
        n_fol = u.get("followers_count") or 0
        n_following = u.get("following_count") or u.get("friends_count") or 0
        if n_fol < 1000 or n_fol > 200000:
            continue
        bio = u.get("description") or ""
        score, hits = bio_score(bio)
        rows.append({
            "userName": u.get("userName") or u.get("screen_name"),
            "name": u.get("name"),
            "followers": n_fol,
            "following": n_following,
            "tweets": u.get("statuses_count"),
            "pass_count": len(v["pass_followers"]),
            "pass_set": sorted(v["pass_followers"]),
            "bio": bio,
            "loc": u.get("location"),
            "url": u.get("url"),
            "score": score,
            "hits": hits,
        })

    # Sort: pass_count desc, then bio_score desc
    rows.sort(key=lambda r: (-r["pass_count"], -r["score"], -r["followers"]))

    print(f"\n=== >=2 PASS, band+bio filter: {len(rows)} ===")
    for r in rows[:60]:
        ps = ",".join(r["pass_set"])
        print(f"  P{r['pass_count']}/B{r['score']}/{r['followers']:>6}fol  @{r['userName']:<22} [{ps}] {r['bio'][:90]}")

    # Save full sorted list
    with open("a1e_candidates.tsv", "w") as f:
        f.write("pass_count\tpass_set\tscore\thits\tuserName\tname\tfollowers\tfollowing\ttweets\tbio\tloc\turl\n")
        for r in rows:
            f.write(f"{r['pass_count']}\t{','.join(r['pass_set'])}\t{r['score']}\t{','.join(r['hits'])}\t@{r['userName']}\t{r['name']}\t{r['followers']}\t{r['following']}\t{r['tweets']}\t{r['bio'][:200].replace(chr(10),' ').replace(chr(9),' ')}\t{r['loc']}\t{r['url']}\n")
    print(f"\nwrote a1e_candidates.tsv ({len(rows)} rows)")

    # Top picks for audit: positive bio score AND not-excluded
    top = [r for r in rows if r["score"] >= 1][:12]
    with open("a1e_to_audit.txt", "w") as f:
        for r in top:
            f.write(f"{r['userName']}\n")
    print(f"\nwrote a1e_to_audit.txt — {len(top)} candidates:")
    for r in top:
        print(f"  P{r['pass_count']}/B{r['score']}  @{r['userName']:<22} {r['bio'][:100]}")


if __name__ == "__main__":
    main()
