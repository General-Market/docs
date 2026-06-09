#!/usr/bin/env python3
"""Build a daily manual reply queue for X algo training.

The queue targets people currently engaging around a seed account's recent posts.
It does not post or like anything; it only produces 15 reply targets.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import twapi  # noqa: E402

OUT_ROOT = Path(__file__).resolve().parent

NICHE_TERMS = (
    "100x",
    "gem",
    "gems",
    "alpha",
    "memecoin",
    "memecoins",
    "meme coin",
    "pump.fun",
    "pumpfun",
    "solana",
    "sol",
    "degen",
    "launch",
    "launchpad",
    "bonding curve",
    "low cap",
    "moonshot",
    "x100",
)

BOT_TERMS = (
    "airdrop",
    "giveaway",
    "claim now",
    "private tg",
    "tg members",
    "telegram",
    "join telegram",
    "signal group",
    "signals",
    "dm for promo",
    "paid promo",
    "collab manager",
    "ambassador",
)

ENGLISH_SIGNAL_TERMS = (
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "what",
    "which",
    "when",
    "where",
    "how",
    "filter",
    "filters",
    "holder",
    "growth",
    "liquidity",
    "volume",
    "market",
    "money",
    "entry",
    "risk",
    "daily",
    "buying",
)

ADJACENT_QUERIES = (
    '(100x OR x100 OR gem OR gems) (pumpfun OR "pump.fun" OR memecoin OR memecoins OR solana)',
    '("low cap" OR moonshot OR degen) (launch OR launchpad OR "bonding curve" OR pumpfun)',
    '("holder growth" OR liquidity OR volume) (memecoin OR solana OR pumpfun OR gem)',
)


def install_key_from_secret() -> None:
    key_secret = Path(os.environ.get("TWITTERAPI_KEY_FILE", "/root/.secrets/twitterapi_io_key"))
    if key_secret.exists() and not twapi.KEY_FILE.exists():
        shutil.copyfile(key_secret, twapi.KEY_FILE)
        twapi.KEY_FILE.chmod(0o600)


@dataclass
class Candidate:
    handle: str
    name: str
    followers: int
    following: int
    verified: bool
    source_tweet_id: str
    source_tweet_url: str
    target_tweet_id: str
    target_tweet_url: str
    text: str
    created_at: str
    likes: int
    replies: int
    retweets: int
    quotes: int
    views: int
    source: str
    bio: str = ""

    @property
    def engagement(self) -> int:
        return self.likes + self.replies + self.retweets + self.quotes

    @property
    def engagement_rate(self) -> float:
        if self.views <= 0:
            return 0.0
        return round(self.engagement * 100 / self.views, 3)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_x_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%a %b %d %H:%M:%S %z %Y")
    except ValueError:
        return None


def safe_int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return cleaned[:80] or "run"


def parse_tweets(body: dict) -> list[dict]:
    data = body.get("data") or {}
    return body.get("tweets") or (data.get("tweets", []) if isinstance(data, dict) else []) or []


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def fetch_last_tweets(handle: str, raw_dir: Path, reuse_raw: bool) -> list[dict]:
    path = raw_dir / f"target-{slug(handle)}.json"
    if reuse_raw and path.exists():
        return parse_tweets(json.loads(path.read_text()))
    body = twapi.metered_call(
        f"engage:target:last_tweets:{handle}",
        "/twitter/user/last_tweets",
        {"userName": handle.lstrip("@")},
        estimate=15 * 20,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(body, ensure_ascii=False, indent=2))
    return parse_tweets(body)


def metered_search(label: str, query: str, query_type: str, pages: int, raw_dir: Path, reuse_raw: bool) -> list[dict]:
    tweets: list[dict] = []
    cursor = ""
    for page in range(pages):
        path = raw_dir / f"{slug(label)}-p{page}.json"
        if reuse_raw and path.exists():
            body = json.loads(path.read_text())
        else:
            params = {"query": query, "queryType": query_type}
            if cursor:
                params["cursor"] = cursor
            body = twapi.metered_call(
                f"engage:{label}:p{page}",
                "/twitter/tweet/advanced_search",
                params,
                estimate=15 * 20,
            )
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(body, ensure_ascii=False, indent=2))
        batch = parse_tweets(body)
        if not batch:
            break
        tweets.extend(batch)
        data = body.get("data") or {}
        cursor = body.get("next_cursor") or (data.get("next_cursor") if isinstance(data, dict) else "") or ""
        has_next = body.get("has_next_page", data.get("has_next_page", bool(cursor)) if isinstance(data, dict) else bool(cursor))
        if not cursor or not has_next:
            break
    return tweets


def tweet_url(tweet: dict) -> str:
    return tweet.get("url") or tweet.get("twitterUrl") or ""


def author_handle(tweet: dict) -> str:
    author = tweet.get("author") or {}
    return author.get("userName") or tweet.get("authorName") or ""


def to_candidate(tweet: dict, target_tweet: dict, source: str) -> Candidate | None:
    handle = author_handle(tweet)
    if not handle:
        return None
    author = tweet.get("author") or {}
    return Candidate(
        handle=handle,
        name=author.get("name") or "",
        followers=safe_int(author.get("followers")),
        following=safe_int(author.get("following")),
        verified=bool(author.get("isBlueVerified") or author.get("isVerified")),
        source_tweet_id=str(tweet.get("id") or ""),
        source_tweet_url=tweet_url(tweet),
        target_tweet_id=str(target_tweet.get("id") or ""),
        target_tweet_url=tweet_url(target_tweet),
        text=tweet.get("text") or "",
        created_at=tweet.get("createdAt") or "",
        likes=safe_int(tweet.get("likeCount")),
        replies=safe_int(tweet.get("replyCount")),
        retweets=safe_int(tweet.get("retweetCount")),
        quotes=safe_int(tweet.get("quoteCount")),
        views=safe_int(tweet.get("viewCount")),
        source=source,
        bio=author.get("description") or "",
    )


def term_hits(text: str, terms: tuple[str, ...]) -> int:
    text_l = text.lower()
    hits = 0
    for term in terms:
        term_l = term.lower()
        if " " in term_l or "." in term_l:
            hits += int(term_l in text_l)
        else:
            hits += int(re.search(rf"\b{re.escape(term_l)}\b", text_l) is not None)
    return hits


def bot_risk(c: Candidate) -> tuple[int, list[str]]:
    text = f"{c.text} {c.bio}".lower()
    reasons: list[str] = []
    risk = 0
    if c.followers < 25:
        risk += 2
        reasons.append("tiny account")
    if c.followers and c.following / max(c.followers, 1) > 8:
        risk += 2
        reasons.append("following/follower ratio high")
    if len(re.findall(r"#|\$", c.text)) >= 8:
        risk += 2
        reasons.append("tag/cashtag flood")
    if len(re.findall(r"https?://|t\.co/", c.text)) >= 2:
        risk += 1
        reasons.append("link flood")
    if re.search(r"[a-zA-Z]{3,}\d{5,}|[a-zA-Z0-9_]{18,}", c.handle):
        risk += 1
        reasons.append("random-looking handle")
    bot_hits = term_hits(text, BOT_TERMS)
    if bot_hits:
        risk += bot_hits * 2
        reasons.append("promo/bot wording")
    if c.views <= 10 and c.engagement == 0:
        risk += 1
        reasons.append("no visible traction")
    return risk, reasons


def english_enough(text: str) -> bool:
    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    if not words:
        return False
    hits = sum(1 for word in words if word in ENGLISH_SIGNAL_TERMS)
    ascii_letters = sum(1 for char in text if char.isascii() and char.isalpha())
    letters = sum(1 for char in text if char.isalpha())
    ascii_ratio = ascii_letters / max(letters, 1)
    return hits >= 2 and ascii_ratio >= 0.88


def score_candidate(c: Candidate) -> tuple[float, list[str]]:
    risk, risk_reasons = bot_risk(c)
    text = f"{c.text} {c.bio}"
    niche_hits = term_hits(text, NICHE_TERMS)
    score = 0.0
    score += min(c.followers, 50_000) / 1000
    score += min(c.engagement, 50) * 2
    score += min(c.engagement_rate, 15) * 4
    score += niche_hits * 15
    score += 10 if c.verified else 0
    if c.source == "reply":
        score += 200
    elif c.source == "mention":
        score += 150
    score -= risk * 25
    reasons = []
    if niche_hits:
        reasons.append(f"{niche_hits} niche terms")
    if c.engagement_rate:
        reasons.append(f"{c.engagement_rate}% eng rate")
    if c.source == "reply":
        reasons.append("replied to target")
    elif c.source == "mention":
        reasons.append("mentioned target")
    elif c.source == "adjacent":
        reasons.append("adjacent 100x niche")
    if c.verified:
        reasons.append("verified")
    reasons.extend([f"risk: {r}" for r in risk_reasons])
    return round(score, 3), reasons


def reply_angle(c: Candidate) -> str:
    text = c.text.lower()
    if "gem" in text or "100x" in text or "moon" in text:
        return "filter before calling something a gem"
    if "pump" in text or "memecoin" in text or "launch" in text:
        return "launch quality vs short-lived pump"
    if "entry" in text or "chart" in text or "target" in text:
        return "invalidation level, not just upside target"
    if "wallet" in text or "smart money" in text:
        return "wallet behavior before entry"
    return "token selection, risk, or timing"


def data_hook(c: Candidate) -> str:
    if c.views > 0 and c.engagement > 0:
        return f"{c.engagement_rate}% engagement on {c.views} views"
    if c.followers > 0:
        return f"{c.followers} followers, already active around the seed account"
    return "fresh reply around the seed account"


def reply_draft(c: Candidate) -> str:
    text = c.text.lower()
    if "gem" in text or "100x" in text or "moon" in text:
        return "I usually separate gems by holder growth, liquidity depth, and how clean the first pullback is. What filter makes you pass even when the upside looks obvious?"
    if "pump" in text or "memecoin" in text or "launch" in text:
        return "For new launches I care more about holder velocity vs volume than the first candle. Which datapoint tells you it is not just a fast pump?"
    if "entry" in text or "chart" in text or "target" in text:
        return "The setup only matters if invalidation is clear. What level or onchain signal would prove this trade wrong for you?"
    if "wallet" in text or "smart money" in text:
        return "Wallet flow is useful, but I weight repeat buyers higher than one big entry. Which wallet behavior do you trust most before entering?"
    return "I would turn this into a filter: liquidity, holder growth, volume quality, then invalidation. Which one do you weight most before taking a position?"


def main() -> None:
    install_key_from_secret()

    parser = argparse.ArgumentParser()
    parser.add_argument("--target", default="100xgemfinder")
    parser.add_argument("--date", default=utc_now().strftime("%Y-%m-%d"))
    parser.add_argument("--lookback-hours", type=int, default=24)
    parser.add_argument("--lookback-days", type=int, default=None, help=argparse.SUPPRESS)
    parser.add_argument("--target-posts", type=int, default=8)
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--max-queue", type=int, default=15)
    parser.add_argument("--max-bot-risk", type=int, default=2)
    parser.add_argument("--budget-usd", type=float, default=10.0)
    parser.add_argument("--reuse-raw", action="store_true")
    args = parser.parse_args()
    if args.lookback_days is not None:
        args.lookback_hours = args.lookback_days * 24

    started_at = utc_now()
    cutoff = started_at - timedelta(hours=args.lookback_hours)
    since_date = cutoff.strftime("%Y-%m-%d")
    out_dir = OUT_ROOT / args.date / args.target.lstrip("@").lower()
    raw_dir = out_dir / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)

    balance_before = twapi.total_credits()
    budget_path = out_dir / "budget.active.json"
    budget_path.write_text(json.dumps({
        "cap_usd": args.budget_usd,
        "baseline_credits": balance_before,
        "spent_locked_credits": 0,
    }, indent=2))
    twapi.BUDGET_FILE = budget_path

    target_handle = args.target.lstrip("@")
    target_tweets = []
    for tweet in fetch_last_tweets(target_handle, raw_dir, args.reuse_raw):
        created = parse_x_date(tweet.get("createdAt") or "")
        if not created or created < cutoff:
            continue
        if author_handle(tweet).lower() != target_handle.lower():
            continue
        target_tweets.append(tweet)
        if len(target_tweets) >= args.target_posts:
            break

    by_handle: dict[str, Candidate] = {}
    seen_tweets: set[str] = set()
    for target_tweet in target_tweets:
        tid = str(target_tweet.get("id") or "")
        if not tid:
            continue
        queries = [
            ("reply", f"conversation_id:{tid} -from:{target_handle} -is:retweet"),
            ("mention", f"to:{target_handle} since:{since_date} -is:retweet"),
        ]
        for source, query in queries:
            for tweet in metered_search(f"{source}-{tid}", query, "Latest", args.pages, raw_dir, args.reuse_raw):
                tweet_id = str(tweet.get("id") or "")
                if not tweet_id or tweet_id in seen_tweets:
                    continue
                seen_tweets.add(tweet_id)
                created = parse_x_date(tweet.get("createdAt") or "")
                if not created or created < cutoff:
                    continue
                candidate = to_candidate(tweet, target_tweet, source)
                if not candidate:
                    continue
                if candidate.handle.lower() == target_handle.lower():
                    continue
                risk, _ = bot_risk(candidate)
                if risk > args.max_bot_risk:
                    continue
                score, reasons = score_candidate(candidate)
                if score <= 0:
                    continue
                existing = by_handle.get(candidate.handle.lower())
                if not existing:
                    by_handle[candidate.handle.lower()] = candidate
                    continue
                existing_score, _ = score_candidate(existing)
                if score > existing_score:
                    by_handle[candidate.handle.lower()] = candidate

    context_tweet = target_tweets[0] if target_tweets else {}
    if len(by_handle) < args.max_queue:
        for idx, base_query in enumerate(ADJACENT_QUERIES):
            query = f"{base_query} since:{since_date} -is:retweet"
            for tweet in metered_search(f"adjacent-{idx}", query, "Latest", args.pages, raw_dir, args.reuse_raw):
                tweet_id = str(tweet.get("id") or "")
                if not tweet_id or tweet_id in seen_tweets:
                    continue
                seen_tweets.add(tweet_id)
                if not english_enough(tweet.get("text") or ""):
                    continue
                created = parse_x_date(tweet.get("createdAt") or "")
                if not created or created < cutoff:
                    continue
                candidate = to_candidate(tweet, context_tweet, "adjacent")
                if not candidate:
                    continue
                if candidate.handle.lower() == target_handle.lower():
                    continue
                risk, _ = bot_risk(candidate)
                if risk > args.max_bot_risk:
                    continue
                score, _ = score_candidate(candidate)
                if score <= 0:
                    continue
                existing = by_handle.get(candidate.handle.lower())
                if not existing:
                    by_handle[candidate.handle.lower()] = candidate
                    continue
                existing_score, _ = score_candidate(existing)
                if score > existing_score:
                    by_handle[candidate.handle.lower()] = candidate
            if len(by_handle) >= args.max_queue:
                break

    rows = []
    for candidate in by_handle.values():
        score, reasons = score_candidate(candidate)
        risk, risk_reasons = bot_risk(candidate)
        rows.append({
            "rank_score": score,
            "handle": candidate.handle,
            "name": candidate.name,
            "followers": candidate.followers,
            "following": candidate.following,
            "verified": candidate.verified,
            "source": candidate.source,
            "tweet_url": candidate.source_tweet_url,
            "target_tweet_url": candidate.target_tweet_url,
            "text": candidate.text,
            "created_at": candidate.created_at,
            "lookback_hours": args.lookback_hours,
            "cutoff_utc": cutoff.isoformat(),
            "algo_goal": f"shift account graph toward @{target_handle}",
            "likes": candidate.likes,
            "replies": candidate.replies,
            "retweets": candidate.retweets,
            "quotes": candidate.quotes,
            "views": candidate.views,
            "engagement": candidate.engagement,
            "engagement_rate": candidate.engagement_rate,
            "bot_risk": risk,
            "bot_risk_reasons": risk_reasons,
            "reasons": reasons,
            "reply_angle": reply_angle(candidate),
            "data_hook": data_hook(candidate),
            "reply_draft": reply_draft(candidate),
        })
    rows.sort(key=lambda row: (row["rank_score"], row["engagement_rate"], row["followers"]), reverse=True)
    rows = rows[: args.max_queue]

    write_jsonl(out_dir / "queue.jsonl", rows)
    write_jsonl(out_dir / f"queue-{started_at.strftime('%Y%m%dT%H%M%SZ')}.jsonl", rows)
    (out_dir / "strategy.md").write_text(strategy_md(target_handle, args.max_queue, args.lookback_hours))

    balance_after = twapi.total_credits()
    print(json.dumps({
        "date": args.date,
        "target": target_handle,
        "lookback_hours": args.lookback_hours,
        "cutoff_utc": cutoff.isoformat(),
        "target_posts": len(target_tweets),
        "candidates": len(by_handle),
        "queue": len(rows),
        "out_dir": str(out_dir),
        "top": rows[0] if rows else None,
        "credits_spent": max(0, balance_before - balance_after),
    }, ensure_ascii=False, indent=2))


def strategy_md(target: str, max_queue: int, lookback_hours: int) -> str:
    return f"""# Engagement Queue Strategy - @{target}

## Daily Rule

- Do {max_queue} manual replies per day.
- Only use tweets from the last {lookback_hours} hours.
- Reply to people who already replied to, quoted, or mentioned @{target}'s current posts.
- If direct volume is too low, fill the queue with fresh adjacent 100x/gem/pumpfun conversations.
- Prefer accounts with niche language, visible traction, and low bot risk.
- Do not automate posting. Use the queue as a human checklist.

## Reply Shape

- Data point first, then one clear question.
- No pitch.
- No generic praise.
- Use the other person's wording.
- Ask about filter, timing, risk, entry, invalidation, holder growth, liquidity, or wallet behavior.

## Algo Goal

Therefore: the account repeatedly appears in fresh @{target} conversations around low-cap gems, memecoins, Pump.fun, Solana launches, and 100x-style discovery without looking like spam.
"""


if __name__ == "__main__":
    main()
