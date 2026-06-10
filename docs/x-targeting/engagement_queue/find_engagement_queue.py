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
DRAFT_SCHEMA_VERSION = 7

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
    "claim",
    "private tg",
    "tg members",
    "telegram",
    "join telegram",
    "signal group",
    "signals",
    "promote",
    "promoted",
    "promotion",
    "boost",
    "let's collab",
    "lets collab",
    "collab",
    "let's chat",
    "lets chat",
    "dm",
    "dm for promo",
    "paid promo",
    "collab manager",
    "ambassador",
    "influencer",
    "business",
    "invester",
    "cashback",
    "rewards",
    "available now",
    "app store",
    "google play",
    "winners",
    "invite-only",
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

AROUND_QUERY_TERMS = (
    "100x OR x100 OR gem OR gems OR alpha OR pumpfun OR pump.fun OR memecoin OR memecoins "
    "OR solana OR crypto OR degen OR liquidity OR holder OR wallet OR entry OR chart"
)

# Chinese-language degen vocabulary. 土狗 = shitcoin/memecoin, 金狗 = a winning one (gem),
# 百倍/千倍 = 100x/1000x, 梭哈 = all-in, 埋伏 = early entry, 内盘 = pump.fun bonding curve,
# 龙头 = lead coin, 聪明钱 = smart money, 狙击 = snipe, 拉盘/砸盘 = pump/dump, 抄底 = buy the dip.
NICHE_TERMS_ZH = (
    "土狗", "金狗", "百倍", "千倍", "梭哈", "埋伏", "内盘", "龙头",
    "抄底", "山寨", "聪明钱", "狙击", "拉盘", "砸盘", "链上", "暴涨",
    "貔貅", "冲", "meme",
)

# Chinese spam markers — folded into BOT_TERMS-style risk via term_hits.
BOT_TERMS_ZH = (
    "空投", "进群", "电报", "私信", "推广", "抽奖", "领取", "福利", "撸毛",
)

AROUND_QUERY_TERMS_ZH = (
    "土狗 OR 金狗 OR 百倍 OR 千倍 OR 梭哈 OR 埋伏 OR 内盘 OR 龙头 OR 聪明钱 OR 狙击 OR "
    "抄底 OR 链上 OR meme OR memecoin OR pumpfun OR solana"
)

ADJACENT_QUERIES_ZH = (
    "(土狗 OR 金狗 OR 百倍 OR 千倍) (meme OR memecoin OR pumpfun OR solana OR 内盘)",
    "(梭哈 OR 埋伏 OR 抄底 OR 狙击) (土狗 OR meme OR 链上)",
    "(聪明钱 OR 链上 OR 龙头) (memecoin OR solana OR pumpfun OR 土狗)",
)

LANG_PROFILES = {
    "en": dict(niche=NICHE_TERMS, around=AROUND_QUERY_TERMS, adjacent=ADJACENT_QUERIES, bot_extra=()),
    "zh": dict(niche=NICHE_TERMS_ZH + NICHE_TERMS, around=AROUND_QUERY_TERMS_ZH, adjacent=ADJACENT_QUERIES_ZH, bot_extra=BOT_TERMS_ZH),
}

# Known target accounts → primary language. Unknown targets default to "en" (override with --lang).
TARGET_LANG = {
    "chinadegen": "zh",
    "100xgemfinder": "en",
}


def resolve_lang(target: str, override: str | None) -> str:
    if override:
        return override
    return TARGET_LANG.get(target.lstrip("@").lower(), "en")


# Active language profile — main() rebinds these once the target is known.
ACTIVE_LANG = "en"
ACTIVE_NICHE_TERMS = NICHE_TERMS
ACTIVE_AROUND_QUERY = AROUND_QUERY_TERMS
ACTIVE_ADJACENT = ADJACENT_QUERIES
ACTIVE_BOT_EXTRA = ()


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
    seed_handle: str = ""
    seed_tweet_url: str = ""
    around_reply_to: str = ""

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


def reply_target(tweet: dict, fallback: dict) -> dict:
    reply_to_id = str(tweet.get("inReplyToId") or "")
    reply_to_user = tweet.get("inReplyToUsername") or ""
    if reply_to_id and reply_to_user:
        return {
            "id": reply_to_id,
            "url": f"https://x.com/{reply_to_user}/status/{reply_to_id}",
        }
    return fallback


def to_candidate(
    tweet: dict,
    target_tweet: dict,
    source: str,
    seed_handle: str = "",
    seed_tweet_url: str = "",
) -> Candidate | None:
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
        seed_handle=seed_handle,
        seed_tweet_url=seed_tweet_url,
        around_reply_to=tweet.get("inReplyToUsername") or "",
    )


def term_hits(text: str, terms: tuple[str, ...]) -> int:
    text_l = text.lower()
    hits = 0
    for term in terms:
        term_l = term.lower()
        # CJK terms have no ASCII word boundaries; \b never matches glued runs, so use substring.
        if " " in term_l or "." in term_l or any("一" <= ch <= "鿿" for ch in term_l):
            hits += int(term_l in text_l)
        else:
            hits += int(re.search(rf"\b{re.escape(term_l)}\b", text_l) is not None)
    return hits


def bot_risk(c: Candidate) -> tuple[int, list[str]]:
    text = f"{c.text} {c.bio}".lower()
    reasons: list[str] = []
    risk = 0
    words = re.findall(r"[a-zA-Z0-9]{2,}", c.text)
    if len(words) < 3:
        risk += 2
        reasons.append("low-context text")
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
    if len(re.findall(r"@", c.text)) >= 3:
        risk += 1
        reasons.append("mention flood")
    if re.search(r"[a-zA-Z]{3,}\d{5,}|[a-zA-Z0-9_]{18,}", c.handle):
        risk += 1
        reasons.append("random-looking handle")
    bot_hits = term_hits(text, BOT_TERMS + ACTIVE_BOT_EXTRA)
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


def chinese_enough(text: str) -> bool:
    cjk = sum(1 for ch in text if "一" <= ch <= "鿿" or "㐀" <= ch <= "䶿")
    letters = sum(1 for ch in text if ch.isalpha())
    if not letters:
        return False
    return cjk >= 4 and cjk / letters >= 0.25


def lang_enough(text: str, lang: str = "") -> bool:
    if (lang or ACTIVE_LANG) == "zh":
        return chinese_enough(text)
    return english_enough(text)


def niche_enough(text: str) -> bool:
    return term_hits(text, ACTIVE_NICHE_TERMS) > 0


def score_candidate(c: Candidate) -> tuple[float, list[str]]:
    risk, risk_reasons = bot_risk(c)
    text = f"{c.text} {c.bio}"
    niche_hits = term_hits(text, ACTIVE_NICHE_TERMS)
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
    elif c.source == "around":
        score += 120
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
    elif c.source == "around":
        reasons.append(f"around @{c.seed_handle}" if c.seed_handle else "around seed engager")
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


def data_hook(c: Candidate, target_handle: str) -> str:
    graph = graph_phrase(c, target_handle)
    if c.views > 0 and c.engagement > 0:
        label = "action" if c.engagement == 1 else "actions"
        return f"{graph}. Context: {c.engagement} {label} on {fmt_num(c.views)} views"
    if c.followers > 0:
        return f"{graph}. Context: {fmt_num(c.followers)} followers"
    return graph


def fmt_num(value: int) -> str:
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{value / 1_000:.1f}k"
    return str(value)


def draft_variant(c: Candidate) -> int:
    raw = c.source_tweet_id or c.handle
    return sum(ord(char) for char in raw) % 10


def metric_phrase(c: Candidate) -> str:
    if c.views > 0 and c.engagement > 0:
        return f"{c.engagement_rate}% ER on {fmt_num(c.views)} views"
    if c.likes or c.replies:
        return f"{c.likes} likes and {c.replies} replies"
    if c.followers:
        return f"{fmt_num(c.followers)} followers"
    return "a fresh reply in this pocket"


def graph_phrase(c: Candidate, target_handle: str) -> str:
    target = target_handle.lstrip("@")
    if c.source == "around" and c.seed_handle and c.around_reply_to:
        return f"graph path: @{c.seed_handle} engaged 100x, then @{c.handle} replied to @{c.around_reply_to}"
    if c.source == "around" and c.seed_handle:
        return f"graph path: @{c.seed_handle} engaged 100x, then @{c.handle} kept replying in-niche"
    if c.source == "reply":
        return f"graph path: @{c.handle} directly replied under @{target}"
    if c.source == "mention":
        return f"graph path: @{c.handle} directly mentioned @{target}"
    return f"graph path: @{c.handle} is in the adjacent 100x niche"


def source_phrase(c: Candidate, target_handle: str) -> str:
    target = target_handle.lstrip("@")
    if c.source == "around" and c.seed_handle:
        return f"I found this through @{c.seed_handle}'s recent replies"
    if c.source == "reply":
        return f"You already showed up under @{target}"
    if c.source == "mention":
        return f"You already mentioned @{target}"
    return "This is in the same 100x discovery pocket"


def reply_draft(c: Candidate) -> str:
    text = c.text.lower()
    metric = metric_phrase(c)
    variant = draft_variant(c)
    if "gem" in text or "100x" in text or "moon" in text:
        templates = [
            f"@{c.handle} not judging this by views; the useful signal is that this sits in the same discovery lane. What is your first filter before calling it a gem?",
            f"@{c.handle} this is the right 100x pocket, but the filter still matters. Do you trust holder growth or liquidity depth first?",
            f"@{c.handle} {metric} is just context here. What data makes you trust a gem before it is obvious?",
        ]
        return templates[variant % len(templates)]
    if "pump" in text or "memecoin" in text or "launch" in text:
        templates = [
            f"@{c.handle} this is the right launch-discovery pocket. For launches, do you check holder velocity or repeat wallets first?",
            f"@{c.handle} this is exactly the kind of conversation I want more of in the feed. What separates a real launch from a fast pump for you?",
            f"@{c.handle} {metric} is secondary; I would want sell pressure vs new holders next. What datapoint would make you skip it?",
        ]
        return templates[variant % len(templates)]
    if "entry" in text or "chart" in text or "target" in text:
        templates = [
            f"@{c.handle} good account-graph match; now the trade still needs invalidation. What level proves the setup wrong for you?",
            f"@{c.handle} I would pair the entry with a hard invalidation signal. Is yours price structure, liquidity loss, or wallet exits?",
            f"@{c.handle} {metric} is not the edge; the exit rule is. What would make you cut it fast?",
        ]
        return templates[variant % len(templates)]
    if "wallet" in text or "smart money" in text:
        templates = [
            f"@{c.handle} for this niche I weight repeat buyers higher than one big wallet print. Which wallet behavior do you trust before entering?",
            f"@{c.handle} smart money only helps if it repeats. Do you care more about fresh wallets, size, or follow-on buys?",
            f"@{c.handle} {metric} is only context; wallet quality matters more than wallet size. What pattern makes it actionable?",
        ]
        return templates[variant % len(templates)]
    templates = [
        f"@{c.handle} I would turn this into a filter: liquidity, holder growth, volume quality, then invalidation. Which one matters most here?",
        f"@{c.handle} the point is the account neighborhood, not big numbers. What data would make you move from watchlist to entry?",
        f"@{c.handle} {metric} is just context. Do you judge this setup by wallet flow, liquidity, or how clean the pullback is?",
        f"@{c.handle} if you had to reduce this to one measurable edge, would it be volume quality, holder growth, or liquidity staying put?",
    ]
    return templates[variant % len(templates)]


def main() -> None:
    install_key_from_secret()

    parser = argparse.ArgumentParser()
    parser.add_argument("--target", default="100xgemfinder")
    parser.add_argument("--lang", default="", help="en|zh; blank auto-resolves from the target")
    parser.add_argument("--date", default=utc_now().strftime("%Y-%m-%d"))
    parser.add_argument("--lookback-hours", type=int, default=24)
    parser.add_argument("--lookback-days", type=int, default=None, help=argparse.SUPPRESS)
    parser.add_argument("--target-posts", type=int, default=8)
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--around-handles", type=int, default=10)
    parser.add_argument("--around-pages", type=int, default=1)
    parser.add_argument("--allow-adjacent-fallback", action="store_true")
    parser.add_argument("--max-queue", type=int, default=15)
    parser.add_argument("--max-bot-risk", type=int, default=2)
    parser.add_argument("--budget-usd", type=float, default=10.0)
    parser.add_argument("--reuse-raw", action="store_true")
    args = parser.parse_args()
    if args.lookback_days is not None:
        args.lookback_hours = args.lookback_days * 24

    global ACTIVE_LANG, ACTIVE_NICHE_TERMS, ACTIVE_AROUND_QUERY, ACTIVE_ADJACENT, ACTIVE_BOT_EXTRA
    ACTIVE_LANG = resolve_lang(args.target, args.lang)
    profile = LANG_PROFILES.get(ACTIVE_LANG, LANG_PROFILES["en"])
    ACTIVE_NICHE_TERMS = profile["niche"]
    ACTIVE_AROUND_QUERY = profile["around"]
    ACTIVE_ADJACENT = profile["adjacent"]
    ACTIVE_BOT_EXTRA = profile["bot_extra"]
    print(f"[lang] target={args.target} lang={ACTIVE_LANG}")

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
    seed_candidates = sorted(
        [c for c in by_handle.values() if c.source in {"reply", "mention"}],
        key=lambda c: score_candidate(c)[0],
        reverse=True,
    )[: args.around_handles]

    if len(by_handle) < args.max_queue:
        for seed in seed_candidates:
            query = f"from:{seed.handle} ({ACTIVE_AROUND_QUERY}) since:{since_date} filter:replies -is:retweet"
            for tweet in metered_search(
                f"around-{seed.handle}",
                query,
                "Latest",
                args.around_pages,
                raw_dir,
                args.reuse_raw,
            ):
                tweet_id = str(tweet.get("id") or "")
                if not tweet_id or tweet_id in seen_tweets:
                    continue
                seen_tweets.add(tweet_id)
                text = tweet.get("text") or ""
                if target_handle.lower() in text.lower():
                    continue
                if not lang_enough(text):
                    continue
                if not niche_enough(text):
                    continue
                created = parse_x_date(tweet.get("createdAt") or "")
                if not created or created < cutoff:
                    continue
                candidate = to_candidate(
                    tweet,
                    reply_target(tweet, context_tweet),
                    "around",
                    seed_handle=seed.handle,
                    seed_tweet_url=seed.source_tweet_url,
                )
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
                handle_key = candidate.handle.lower()
                existing = by_handle.get(handle_key)
                if not existing:
                    by_handle[handle_key] = candidate
                    continue
                existing_score, _ = score_candidate(existing)
                if score > existing_score:
                    by_handle[handle_key] = candidate
            if len(by_handle) >= args.max_queue:
                break

    if args.allow_adjacent_fallback and len(by_handle) < args.max_queue:
        for idx, base_query in enumerate(ACTIVE_ADJACENT):
            query = f"{base_query} since:{since_date} -is:retweet"
            for tweet in metered_search(f"adjacent-{idx}", query, "Latest", args.pages, raw_dir, args.reuse_raw):
                tweet_id = str(tweet.get("id") or "")
                if not tweet_id or tweet_id in seen_tweets:
                    continue
                seen_tweets.add(tweet_id)
                if not lang_enough(tweet.get("text") or ""):
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
            "source_strategy": "second_degree" if candidate.source == "around" else candidate.source,
            "seed_handle": candidate.seed_handle,
            "seed_tweet_url": candidate.seed_tweet_url,
            "around_reply_to": candidate.around_reply_to,
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
            "data_hook": data_hook(candidate, target_handle),
            "reply_draft": reply_draft(candidate),
            "lang": ACTIVE_LANG,
            "draft_schema_version": DRAFT_SCHEMA_VERSION,
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
        "around_handles": len(seed_candidates),
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
- If direct volume is too low, inspect where those engagers are replying now and enter those conversations.
- Around-search is also niche-gated so random social replies do not enter the queue.
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
