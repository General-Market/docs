#!/usr/bin/env python3
"""Aggregate authors from B2 advsearch raw files. Filter to 1k–200k follower band.
Score bio for indie-bot-dev signal vs KOL/affiliate noise."""
import json, os, re, sys
from collections import defaultdict

LABELS = [
    "b2_mybot_dialect",
    "b2_oss_frameworks",
    "b2_ai_trading",
    "b2_i_built_bot",
    "b2_chat_bot",
    "b2_py_frameworks",
    "b2_lang_tradingbot",
]

DIR = "cache/raw_searches/advsearch"

BOT_DEV_BIO_RX = re.compile(
    r"\b(bot|algo|quant|trader|trading|dev|developer|builder|engineer|python|rust|"
    r"hummingbot|freqtrade|ccxt|jesse|nautilus|backtrader|hyperliquid|polymarket|"
    r"perp|arb|scalp|snipe|maker|market.?mak|hft|systematic|automation|automated|"
    r"github|open.?source|opensource|llm|ai.?agent|claude|chatgpt|gpt|degen|defi|"
    r"solana|sol|memecoin|onchain|on.?chain|mev|searcher|prediction|backtest|"
    r"strategy|alpha|edge|pnl|sharpe|notebook|jupyter|tradingview|pinescript)\b",
    re.I,
)

KOL_REJECT_RX = re.compile(
    r"(\bsignals?\b|\bcalls?\b|\bgiveaway\b|\bgive away\b|whale.?watcher|"
    r"\bDM\b|\bcollab\b|invite code|join my (group|tg|telegram|discord)|"
    r"ambassador|@polymarket researcher|polymarket maxi|@zscdao member)",
    re.I,
)

# super-spammy KOL pattern: very short bios mentioning "trade smartly" or anitaoh8
SPAM_HANDLES_RX = re.compile(r"anitaoh8", re.I)


def load_authors():
    by_handle = defaultdict(lambda: {
        "name": "", "desc": "", "followers": 0, "following": 0,
        "verified": False, "blue": False, "labels": set(), "tweet_likes": 0,
        "tweet_text": "",
    })
    for label in LABELS:
        path = f"{DIR}/{label}.json"
        if not os.path.exists(path):
            continue
        d = json.load(open(path))
        tweets = d.get("tweets", []) if isinstance(d, dict) else []
        for t in tweets:
            a = t.get("author") or {}
            h = (a.get("userName") or "").strip()
            if not h:
                continue
            rec = by_handle[h]
            rec["name"] = a.get("name") or rec["name"]
            rec["desc"] = a.get("description") or rec["desc"]
            rec["followers"] = a.get("followers") or rec["followers"]
            rec["following"] = a.get("following") or rec["following"]
            rec["verified"] = rec["verified"] or bool(a.get("isVerified"))
            rec["blue"] = rec["blue"] or bool(a.get("isBlueVerified"))
            rec["labels"].add(label)
            likes = t.get("likeCount") or 0
            if likes > rec["tweet_likes"]:
                rec["tweet_likes"] = likes
                rec["tweet_text"] = (t.get("text") or "")[:200].replace("\n", " ")
    return by_handle


def score_bio(desc: str) -> tuple[int, list[str]]:
    if not desc:
        return 0, []
    if SPAM_HANDLES_RX.search(desc):
        return -10, ["spam_anitaoh8"]
    hits = []
    for m in BOT_DEV_BIO_RX.finditer(desc):
        hits.append(m.group(0).lower())
    return len(set(hits)), hits


def main():
    by_handle = load_authors()
    total = len(by_handle)
    print(f"# {total} unique authors across {len(LABELS)} B2 queries", file=sys.stderr)

    rows = []
    for h, r in by_handle.items():
        fol = r["followers"]
        if fol < 1000 or fol > 200_000:
            continue
        if SPAM_HANDLES_RX.search(r["desc"] or ""):
            continue
        if KOL_REJECT_RX.search(r["desc"] or ""):
            # but accept if it's "I built a polymarket arb bot" style — keep but down-rank
            pass
        score, hits = score_bio(r["desc"] or "")
        if score < 2:  # need at least 2 distinct bot/dev terms
            continue
        rows.append((score, h, fol, r))

    rows.sort(key=lambda x: (-x[0], -x[3]["tweet_likes"]))
    print(f"# {len(rows)} authors after 1k-200k filter + bio-score >= 2", file=sys.stderr)

    out = "handle\tfollowers\tscore\tname\tlabels\ttop_like\tdesc\ttweet\n"
    for score, h, fol, r in rows:
        out += "\t".join([
            h, str(fol), str(score), r["name"][:60],
            ",".join(sorted(r["labels"])),
            str(r["tweet_likes"]),
            (r["desc"] or "").replace("\t", " ").replace("\n", " ")[:200],
            r["tweet_text"][:200],
        ]) + "\n"
    open("b2_candidates.tsv", "w").write(out)
    print(f"# wrote b2_candidates.tsv with {len(rows)} rows", file=sys.stderr)

    # print top 20
    for score, h, fol, r in rows[:25]:
        print(f"@{h}\tf={fol}\ts={score}\t{r['name'][:40]}\t{(r['desc'] or '')[:120]}")


if __name__ == "__main__":
    main()
