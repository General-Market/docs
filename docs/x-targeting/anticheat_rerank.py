#!/usr/bin/env python3
"""Re-score anti-cheat-flags candidates from cached tweet data.

The standard audit.py is tuned to filter for market-makers, vol traders, and
HFT operators — wrong job for this list. The candidates here came from
advanced_search probes targeting practitioners who describe the gap between
backtest and live performance. They are exactly the audience for
generalmarket.io/anticheat-flags — but the MM-tuned niche regex and the
1k follower floor suppress most of them.

This script re-scores at zero API cost using cached tweets + profiles.

Score components:
  +5  tweet contains "backtest" or "walk-forward" or "out-of-sample" near
      "live"/"production"/"real money"/"failed"/"different"
  +3  tweet contains "overfit"
  +3  tweet contains "slippage" near "backtest" or "strategy" or "bot"
  +3  tweet contains "frontrun" or "front-run" or "sandwich" + "bot"
  +2  tweet contains "alpha decay" / "edge decay" / "strategy died"
  +2  tweet contains "paper trading" + "real money"
  +2  tweet contains generic algo/bot/quant vocab
  +1  per niche tweet (max 5)
  +log10(followers+1) bonus
  -10 KOL flag (polymarket/kalshi/meteora/jupiter affiliate)
  -5  active >30 days ago
  -5  posts/day > 30 (spam) or < 0.05 (dormant)

Usage:
  anticheat_rerank.py /tmp/anticheat_handles.txt
"""
from __future__ import annotations
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"


# Anti-cheat-narrative vocabulary (text patterns)
PATTERNS = {
    "backtest_vs_live": (
        re.compile(r"(?i)\b(backtest|walk[\s-]forward|out[\s-]of[\s-]sample|in[\s-]sample|forward\s*test)\b.{0,80}"
                   r"\b(live|production|real\s*money|failed|fail|different|stop\s*work|blew|died|disappear)", re.DOTALL),
        5,
    ),
    "backtest_live_reverse": (
        re.compile(r"(?i)\b(live|production|real\s*money)\b.{0,80}"
                   r"\b(backtest|walk[\s-]forward|out[\s-]of[\s-]sample)", re.DOTALL),
        5,
    ),
    "overfit": (re.compile(r"(?i)\boverfit", re.IGNORECASE), 3),
    "slippage_strategy": (
        re.compile(r"(?i)\bslippage\b.{0,60}\b(backtest|strategy|bot|fills?|edge)", re.DOTALL), 3,
    ),
    "fills_bad": (
        re.compile(r"(?i)\b(fills?|execution)\b.{0,40}\b(different|terrible|bad|worse|slipped)", re.DOTALL), 3,
    ),
    "frontrun_bot": (
        re.compile(r"(?i)\b(front[\s-]?run|sandwich|sniped)\b.{0,40}\b(bot|order|trade|strategy|swap)", re.DOTALL), 3,
    ),
    "mev_sandwich": (re.compile(r"(?i)\b(MEV|sandwich(ed)?|JIT)\b.{0,30}\b(bot|attack|loss)", re.DOTALL), 2),
    "alpha_decay": (
        re.compile(r"(?i)\b(alpha|edge)\s*(decay|decayed|died|disappear|gone)|\bstrateg(y|ies)\s*(died|stopped)\b"),
        2,
    ),
    "paper_real": (
        re.compile(r"(?i)\bpaper\s*trad(ing|er)\b.{0,80}\breal\s*money", re.DOTALL), 2,
    ),
    "algo_vocab": (
        re.compile(r"(?i)\b(algo|quant|systematic|trading\s*bot|trading\s*strategy|sharpe|drawdown|"
                   r"profit\s*factor|monte\s*carlo|kelly|win\s*rate|R\s*multiple)\b"),
        1,
    ),
}

# Bio bonus — having any of these in bio adds confidence
BIO_BONUS = re.compile(
    r"(?i)\b(quant|systematic|algo|algorithmic|trading\s*bot|trader|python|developer|"
    r"backtest|MM|market\s*maker|HFT|prop|hedge\s*fund|researcher|"
    r"options|futures|derivatives|trading\s*strateg|trading\s*system)\b"
)

# KOL hard penalty
KOL_PATTERNS = re.compile(
    r"(?i)\b(polymarket|kalshi|meteora|jupiter\s*perps|jup_?predict|"
    r"polymatches|zscdao|airdrop|whitelist|join\s*the\s*tg|copy[\s-]trade)\b"
)


def load_jsonl(p: Path) -> list[dict]:
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text().split("\n") if l.strip()]


def parse_date(s: str):
    try:
        return datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y")
    except Exception:
        try:
            return datetime.fromisoformat((s or "").replace("Z", "+00:00"))
        except Exception:
            return None


def score_handle(handle: str, profiles: list[dict], tweets: list[dict]) -> dict:
    h = handle.lower().lstrip("@")
    profile = None
    for p in profiles:
        if (p.get("screen_name") or "").lower() == h:
            profile = p
    handle_tweets = [t for t in tweets if (t.get("screen_name") or "").lower() == h]

    if not profile:
        return {"handle": handle, "verdict": "NO_DATA", "score": 0, "reason": "no profile"}

    bio = (profile.get("description") or "").strip()
    followers = profile.get("followers_count") or 0
    statuses = profile.get("statuses_count") or 0
    created = parse_date(profile.get("created_at") or "")
    age_days = (datetime.now(timezone.utc) - created).days if created else -1
    ppd = (statuses / age_days) if age_days > 0 else 0

    newest_tweet = None
    for t in handle_tweets:
        d = parse_date(t.get("created_at") or "")
        if d and (newest_tweet is None or d > newest_tweet):
            newest_tweet = d
    last_age = (datetime.now(timezone.utc) - newest_tweet).days if newest_tweet else 999

    # Vocabulary scoring on cached tweets
    breakdown = {}
    score = 0.0
    matches_per_tweet = 0
    sample_quotes = []
    for t in handle_tweets:
        txt = t.get("text") or ""
        hit_any = False
        for label, (pat, weight) in PATTERNS.items():
            m = pat.search(txt)
            if m:
                breakdown[label] = breakdown.get(label, 0) + 1
                score += weight
                hit_any = True
                if len(sample_quotes) < 3 and label in ("backtest_vs_live", "backtest_live_reverse",
                                                         "overfit", "alpha_decay",
                                                         "slippage_strategy", "paper_real",
                                                         "frontrun_bot"):
                    sample_quotes.append((label, txt.strip().replace("\n", " ")[:200]))
        if hit_any:
            matches_per_tweet += 1
    # Cap per-tweet bonus
    score += min(matches_per_tweet, 5)
    breakdown["tweets_with_signal"] = matches_per_tweet

    # Bio bonus
    bio_match = BIO_BONUS.search(bio) if bio else None
    if bio_match:
        score += 2
        breakdown["bio_relevant"] = bio_match.group(0)

    # Follower bonus (log scale, capped)
    if followers > 0:
        score += min(math.log10(followers + 1), 5)

    # KOL penalty
    kol_hits = 0
    for t in handle_tweets:
        if KOL_PATTERNS.search(t.get("text") or ""):
            kol_hits += 1
    if KOL_PATTERNS.search(bio):
        score -= 10
        breakdown["bio_kol"] = True
    if kol_hits >= 3:
        score -= 5
        breakdown["kol_tweets"] = kol_hits

    # Activity penalty
    if last_age > 30:
        score -= 5
        breakdown["dormant_days"] = last_age
    if ppd > 30:
        score -= 5
        breakdown["spam_volume"] = round(ppd, 1)
    if 0 < ppd < 0.05:
        score -= 3
        breakdown["dormant_cadence"] = round(ppd, 3)

    # Verdict tiers
    if score >= 12:
        verdict = "PRIME"
    elif score >= 7:
        verdict = "STRONG"
    elif score >= 4:
        verdict = "MAYBE"
    else:
        verdict = "WEAK"

    return {
        "handle": handle,
        "verdict": verdict,
        "score": round(score, 2),
        "followers": followers,
        "posts_per_day": round(ppd, 2),
        "last_tweet_age_days": last_age,
        "tweets_cached": len(handle_tweets),
        "bio": bio[:120],
        "breakdown": breakdown,
        "sample_quotes": sample_quotes,
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    handles_file = sys.argv[1]
    handles = []
    for line in open(handles_file):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        handles.append(line.lstrip("@"))

    profiles = load_jsonl(PROFILES)
    tweets = load_jsonl(TWEETS)
    print(f"# Loaded {len(profiles)} profiles, {len(tweets)} tweets", file=sys.stderr)

    results = [score_handle(h, profiles, tweets) for h in handles]
    results.sort(key=lambda r: r.get("score", 0), reverse=True)

    # JSON lines for downstream use
    for r in results:
        print(json.dumps(r, ensure_ascii=False))

    # Human table on stderr
    print("\nverdict  score  fol   ppd   age  hits  handle", file=sys.stderr)
    for r in results:
        print(f"{r['verdict']:<8} {r['score']:<6} {r['followers']:<5} "
              f"{r['posts_per_day']:<5} {r['last_tweet_age_days']:<4} "
              f"{r['breakdown'].get('tweets_with_signal', 0):<5} "
              f"@{r['handle']}", file=sys.stderr)


if __name__ == "__main__":
    main()
