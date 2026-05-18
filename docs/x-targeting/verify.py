#!/usr/bin/env python3
"""Verify Inner+Middle candidates against x-targeting-criteria.md.

What's verifiable from api-ninja run data (no extra fetch):
  - Hard filter: niche-aligned (bio inspection — done by scoring already)
  - Hard filter: real identity / substantive anon (verified flag, url, location)
  - Size band assignment (followers)
  - Bio quality
  - Account age / aged signal
  - F/F ratio (peer vs influencer)
  - Profile completeness (avatar, banner, url, verified)

What's NOT verifiable from api-ninja runs (needs a timeline fetch):
  - Active in last 14 days (we only have tweets that matched our queries)
  - Engagement-to-follower ratio on MEDIAN post
  - Predictable cadence (posts/day)
  - Reply-tab substance
  - Pinned post content

The `statuses_count` field is stripped by api-ninja, so posts/day cannot
be computed even though the rest of the profile is dense.
"""
import json
import sys
import glob
from datetime import datetime, timezone
from collections import defaultdict
from statistics import median


TARGETS_INNER = [
    "Bluedeerc", "spxudi", "fabiocatalao_", "Han_Akamatsu",
    "options_insight", "Autonomous_Chad", "TokensWolf",
    "FvckYourHedge", "burningpremium",
]
TARGETS_MIDDLE = [
    "D2_Finance", "cedeflow", "ExitLiqCapital", "blackjack_god",
    "derivativemonky", "LilQwantXBT", "sz8ng", "Gravity5ucks",
    "bas3dp0tat6", "kshitizkapoor_", "Andre_Dragosch",
    "kingfisher_btc", "Outcomexyz", "bored2boar", "EricCLFung",
    "DextersSolab", "PredictParity", "traidingfloor", "LorisTools",
    "arcxtrade", "options_matrix", "FundingRatesGuy",
    "mahera777", "adiix_official", "gaah_im", "jeg6322",
]


def parse_x_date(s: str) -> datetime:
    return datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y")


def verdict(ui, captured_n, latest_age, age_days, ff_ratio, followers):
    flags = []
    # Size band
    if followers >= 100000:
        flags.append("REACH")
    elif followers >= 10000:
        flags.append("CORE")
    elif followers >= 1000:
        flags.append("peer")
    else:
        flags.append("micro")

    # Profile completeness
    completeness_points = 0
    if ui.get("url"):
        completeness_points += 1
    if ui.get("location"):
        completeness_points += 1
    if ui.get("verified") or ui.get("verified_type"):
        completeness_points += 1
    if ui.get("cover_image"):
        completeness_points += 1
    flags.append(f"prof:{completeness_points}/4")

    # F/F ratio interpretation
    if ff_ratio == -1:
        flags.append("ff:?")
    elif ff_ratio < 0.05:
        flags.append("ff:influencer")
    elif ff_ratio < 0.3:
        flags.append("ff:authority")
    elif ff_ratio < 0.8:
        flags.append("ff:peer")
    else:
        flags.append("ff:reciprocal")

    # Account age
    if age_days > 1825:  # 5y
        flags.append("aged:5y+")
    elif age_days > 730:
        flags.append("aged:2y+")
    elif age_days > 365:
        flags.append("aged:1y+")
    elif age_days > 90:
        flags.append("new:3m+")
    else:
        flags.append("fresh<3m")

    # Tweet capture as sanity (did they post anything we saw — proxy for they exist)
    flags.append(f"caps:{captured_n}")

    return ",".join(flags)


def main():
    samples = defaultdict(list)
    for path in glob.glob("/Users/maxguillabert/Downloads/index/docs/x-targeting/runs/*.json"):
        try:
            data = json.load(open(path))
        except Exception:
            continue
        if not isinstance(data, list):
            continue
        for item in data:
            ui = item.get("user_info") if isinstance(item, dict) else None
            if not ui or not isinstance(ui, dict):
                continue
            samples[ui.get("screen_name", "")].append({
                "ui": ui,
                "tweet_favorites": item.get("favorites", 0) or 0,
                "tweet_replies": item.get("replies", 0) or 0,
                "tweet_retweets": item.get("retweets", 0) or 0,
                "tweet_quotes": item.get("quotes", 0) or 0,
                "tweet_created": item.get("created_at"),
                "tweet_type": item.get("type"),
            })

    now = datetime.now(timezone.utc)

    def emit(tier, handles):
        print(f"\n=== {tier} ===")
        print("handle\tfollowers\tff\tage\tverified\turl\tlocation\tcaptured\tlatest_capture\tverdict\tneeds_check")
        for h in handles:
            s = samples.get(h, [])
            if not s:
                print(f"@{h}\tNO DATA — not in runs")
                continue
            ui = s[0]["ui"]
            followers = ui.get("followers_count", 0) or 0
            friends = ui.get("friends_count", 0) or 0
            ff_ratio = round(friends / followers, 3) if followers else -1
            try:
                created_dt = parse_x_date(ui.get("created_at", ""))
                age_days = max(1, (now - created_dt).days)
            except Exception:
                age_days = -1
            latest_age = -1
            for t in s:
                try:
                    t_dt = parse_x_date(t["tweet_created"])
                    age = (now - t_dt).days
                    if latest_age == -1 or age < latest_age:
                        latest_age = age
                except Exception:
                    continue
            v = verdict(ui, len(s), latest_age, age_days, ff_ratio, followers)
            verified = "✓" if ui.get("verified") else "—"
            url = "✓" if ui.get("url") else "—"
            loc = ui.get("location") or "—"
            needs = []
            if latest_age == -1 or latest_age > 30:
                needs.append("activity")
            needs.append("engagement-rate")
            needs.append("cadence")
            print(f"@{h}\t{followers}\t{ff_ratio}\t{age_days}d\t{verified}\t{url}\t{loc[:15]}\t{len(s)}\t{latest_age}d\t{v}\t{','.join(needs)}")

    emit("INNER (9)", TARGETS_INNER)
    emit("MIDDLE (top 26)", TARGETS_MIDDLE)


if __name__ == "__main__":
    main()
