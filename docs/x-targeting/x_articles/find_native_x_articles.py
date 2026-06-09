#!/usr/bin/env python3
"""Find top native X Articles by niche and date.

Native X Articles are tweets where twitterapi.io returns a non-null `article`
object, usually from an `x.com/i/article/...` URL.

Run:
  python3 docs/x-targeting/x_articles/find_native_x_articles.py --niche trading-ai --lookback-hours 24
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import twapi  # noqa: E402

OUT_ROOT = Path(__file__).resolve().parent

AI_TERMS = (
    "ai",
    "agent",
    "agents",
    "agentic",
    "llm",
    "claude",
    "gpt",
    "autonomous",
    "machine learning",
)

MARKET_TERMS = (
    "trading",
    "trade",
    "trader",
    "market",
    "markets",
    "crypto",
    "defi",
    "perp",
    "perps",
    "polymarket",
    "prediction",
    "portfolio",
    "quant",
    "stock",
    "stocks",
    "finance",
    "financial",
    "banking",
    "liquidity",
)


@dataclass
class NativeArticle:
    tweet_id: str
    tweet_url: str
    article_url: str
    title: str
    preview_text: str
    cover_media_img_url: str
    author: str
    author_name: str
    author_followers: int
    created_at: str
    likes: int
    retweets: int
    replies: int
    quotes: int
    bookmarks: int
    views: int
    query_label: str

    @property
    def engagement(self) -> int:
        return self.likes + self.retweets + self.replies + self.quotes + self.bookmarks

    @property
    def weighted_engagement(self) -> int:
        return self.likes + (2 * self.retweets) + self.replies + (2 * self.quotes) + self.bookmarks

    @property
    def engagement_per_1k_views(self) -> float:
        if self.views <= 0:
            return 0.0
        return round(self.engagement * 1000 / self.views, 3)

    @property
    def score(self) -> float:
        return self.weighted_engagement + min(self.views / 3000, 100)


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


def article_url(tweet: dict) -> str:
    entities = tweet.get("entities") or {}
    for item in entities.get("urls") or []:
        expanded = item.get("expanded_url") or ""
        display = item.get("display_url") or ""
        if "x.com/i/article/" in expanded or "x.com/i/article/" in display:
            return expanded.replace("http://", "https://")
    return tweet.get("url") or tweet.get("twitterUrl") or ""


def to_article(tweet: dict, query_label: str) -> NativeArticle | None:
    article = tweet.get("article")
    if not article:
        return None
    author = tweet.get("author") or {}
    return NativeArticle(
        tweet_id=str(tweet.get("id") or ""),
        tweet_url=tweet.get("url") or tweet.get("twitterUrl") or "",
        article_url=article_url(tweet),
        title=article.get("title") or "",
        preview_text=article.get("preview_text") or "",
        cover_media_img_url=article.get("cover_media_img_url") or "",
        author=author.get("userName") or "?",
        author_name=author.get("name") or "",
        author_followers=safe_int(author.get("followers")),
        created_at=tweet.get("createdAt") or "",
        likes=safe_int(tweet.get("likeCount")),
        retweets=safe_int(tweet.get("retweetCount")),
        replies=safe_int(tweet.get("replyCount")),
        quotes=safe_int(tweet.get("quoteCount")),
        bookmarks=safe_int(tweet.get("bookmarkCount")),
        views=safe_int(tweet.get("viewCount")),
        query_label=query_label,
    )


def matches_niche(article: NativeArticle, niche: str) -> bool:
    if niche != "trading-ai":
        return True
    text = f"{article.title} {article.preview_text}".lower()
    has_ai = any(term in text for term in AI_TERMS)
    has_market = any(term in text for term in MARKET_TERMS)
    return has_ai and has_market


def title_key(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip().lower())


def parse_thresholds(value: str) -> list[int]:
    out: list[int] = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        out.append(int(part))
    return sorted(set(out), reverse=True)


def keyword_queries(niche: str, since_date: str) -> list[tuple[str, str, str]]:
    if niche != "trading-ai":
        raise ValueError(f"Unsupported niche: {niche}")
    return [
        (
            "broad-native-top",
            f"(AI OR agent OR agents OR LLM OR trading OR trader OR quant OR crypto OR DeFi OR perp OR market OR markets OR prediction) url:x.com/i/article since:{since_date} -is:retweet",
            "Top",
        ),
        (
            "ai-trading-native-top",
            f"(AI OR agent OR agents OR LLM) (trading OR trader OR quant OR market OR markets OR portfolio) url:x.com/i/article since:{since_date} -is:retweet",
            "Top",
        ),
        (
            "crypto-agent-native-top",
            f"(crypto OR DeFi OR onchain OR perp OR prediction) (AI OR agent OR agents OR LLM) url:x.com/i/article since:{since_date} -is:retweet",
            "Top",
        ),
        (
            "market-native-top",
            f"(market OR markets OR trading OR trader OR portfolio OR quant) (AI OR agent OR agents OR LLM) url:x.com/i/article since:{since_date} -is:retweet min_faves:5",
            "Top",
        ),
        (
            "native-latest",
            f"(AI OR agent OR agents OR LLM OR trading OR trader OR quant OR crypto OR DeFi OR perp OR market OR markets OR prediction) url:x.com/i/article since:{since_date} -is:retweet",
            "Latest",
        ),
    ]


def likes_ladder_queries(niche: str, since_date: str, thresholds: list[int]) -> list[tuple[str, str, str]]:
    if niche != "trading-ai":
        raise ValueError(f"Unsupported niche: {niche}")
    return [
        (
            f"likes-gte-{threshold}",
            f"min_faves:{threshold} url:x.com/i/article since:{since_date} -is:retweet",
            "Top",
        )
        for threshold in thresholds
    ]


def build_queries(niche: str, since_date: str, search_mode: str, thresholds: list[int]) -> list[tuple[str, str, str]]:
    if search_mode == "keyword":
        return keyword_queries(niche, since_date)
    if search_mode == "regressive-likes":
        return likes_ladder_queries(niche, since_date, thresholds)
    if search_mode == "both":
        return likes_ladder_queries(niche, since_date, thresholds) + keyword_queries(niche, since_date)
    raise ValueError(f"Unsupported search mode: {search_mode}")


def metered_search(query: str, query_type: str, pages: int, label: str, raw_dir: Path) -> list[dict]:
    tweets: list[dict] = []
    cursor = ""
    for page in range(pages):
        params = {"query": query, "queryType": query_type}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(
            f"xarticles:{label}:p{page}",
            "/twitter/tweet/advanced_search",
            params,
            estimate=15 * 20,
        )
        raw_dir.mkdir(parents=True, exist_ok=True)
        (raw_dir / f"{slug(label)}-p{page}.json").write_text(json.dumps(body, ensure_ascii=False, indent=2))
        data = body.get("data") or {}
        batch = body.get("tweets") or (data.get("tweets", []) if isinstance(data, dict) else [])
        if not batch:
            break
        tweets.extend(batch)
        cursor = body.get("next_cursor") or (data.get("next_cursor") if isinstance(data, dict) else "") or ""
        has_next = body.get("has_next_page", data.get("has_next_page", bool(cursor)) if isinstance(data, dict) else bool(cursor))
        if not cursor or not has_next:
            break
    return tweets


def raw_search(label: str, pages: int, raw_dir: Path) -> list[dict]:
    tweets: list[dict] = []
    for page in range(pages):
        path = raw_dir / f"{slug(label)}-p{page}.json"
        if not path.exists():
            continue
        body = json.loads(path.read_text())
        data = body.get("data") or {}
        tweets.extend(body.get("tweets") or (data.get("tweets", []) if isinstance(data, dict) else []) or [])
    return tweets


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def report_md(
    articles: list[NativeArticle],
    all_tweets: int,
    started_at: datetime,
    cutoff: datetime,
    niche: str,
    balance_before: int,
    balance_after: int,
    queries: list[tuple[str, str, str]],
    search_mode: str,
) -> str:
    spend = max(0, balance_before - balance_after)
    domains = Counter(a.author for a in articles)
    clusters: dict[str, list[NativeArticle]] = {}
    for article in articles:
        clusters.setdefault(title_key(article.title), []).append(article)
    repeated = sorted(
        [items for items in clusters.values() if len(items) > 1],
        key=lambda items: (sum(a.engagement for a in items), len(items)),
        reverse=True,
    )
    lines = [
        f"# Native X Articles — {niche} — {started_at.strftime('%Y-%m-%d')}",
        "",
        "## TL;DR",
        "",
        f"Stored **{len(articles)} native X Articles** from **{all_tweets} searched tweets** since `{cutoff.isoformat()}`.",
        f"Search mode: **{search_mode}**.",
        "",
        "| rank | X Article | author | X signal | score | next action |",
        "|---:|---|---|---:|---:|---|",
    ]
    for idx, a in enumerate(articles[:25], 1):
        title = a.title.replace("|", "\\|") or a.article_url
        lines.append(
            f"| {idx} | [{title}]({a.article_url or a.tweet_url}) | [@{a.author}](https://x.com/{a.author}) | {a.engagement} eng / {a.views} views / {a.engagement_per_1k_views} eng per 1k views | {a.score:.1f} | Read and extract pattern (~5 min) |"
        )

    lines.extend([
        "",
        "## Ranking Rule",
        "",
        "- Native X Article = tweet payload has non-null `article` metadata.",
        "- Regressive likes mode searches broad native X Articles from high `min_faves` thresholds downward, then applies niche classification locally.",
        "- Distinct Article = normalized title; if several URLs share the same title, the highest-scoring copy is kept.",
        "- Engagement = likes + retweets + replies + quotes + bookmarks.",
        "- Score = weighted engagement + capped views bonus.",
        "- Weighted engagement gives retweets and quotes 2x weight because they distribute the article.",
        "",
        "Therefore: this report ranks native X Articles inside the searched niche surface, not external links.",
        "",
        "## Repeated Title Clusters",
        "",
        "These are likely coordinated reposts or duplicate-native Articles. Treat the cluster as one campaign, then inspect each Article ID separately.",
        "",
        "| cluster | copies | total engagement | best author | next action |",
        "|---|---:|---:|---|---|",
    ])
    if repeated:
        for items in repeated[:10]:
            best = max(items, key=lambda a: a.score)
            total_eng = sum(a.engagement for a in items)
            title = best.title.replace("|", "\\|")
            lines.append(
                f"| [{title}]({best.article_url or best.tweet_url}) | {len(items)} | {total_eng} | [@{best.author}](https://x.com/{best.author}) | Audit duplicate accounts (~5 min) |"
            )
    else:
        lines.append("| None | 0 | 0 | - | No duplicate-title campaign found |")

    lines.extend([
        "",
        "## Query Families",
        "",
        "| label | type | query |",
        "|---|---|---|",
    ])
    for label, query, qtype in queries:
        lines.append(f"| `{label}` | `{qtype}` | `{query}` |")

    lines.extend([
        "",
        "## Author Map",
        "",
        "| author | native Articles found |",
        "|---|---:|",
    ])
    for author, count in domains.most_common(20):
        lines.append(f"| [@{author}](https://x.com/{author}) | {count} |")

    lines.extend([
        "",
        "## Spend",
        "",
        f"- Balance before: `{balance_before}` credits.",
        f"- Balance after: `{balance_after}` credits.",
        f"- Apparent spend: `{spend}` credits = `${spend / twapi.CREDITS_PER_USD:.4f}`.",
        "",
        "Exception: twitterapi.io balance can lag per call; use the global ledger for settled accounting.",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--niche", default="trading-ai")
    parser.add_argument("--date", default=utc_now().strftime("%Y-%m-%d"))
    parser.add_argument("--lookback-hours", type=int, default=24)
    parser.add_argument("--pages", type=int, default=4)
    parser.add_argument("--budget-usd", type=float, default=25.0)
    parser.add_argument("--search-mode", choices=("regressive-likes", "keyword", "both"), default="both")
    parser.add_argument("--like-thresholds", default="5000,2000,1000,500,250,100,50,20,10")
    parser.add_argument("--max-articles", type=int, default=20)
    parser.add_argument("--reuse-raw", action="store_true")
    args = parser.parse_args()

    started_at = utc_now()
    cutoff = started_at - timedelta(hours=args.lookback_hours)
    since_date = cutoff.strftime("%Y-%m-%d")
    out_dir = OUT_ROOT / args.date / args.niche
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

    thresholds = parse_thresholds(args.like_thresholds)
    queries = build_queries(args.niche, since_date, args.search_mode, thresholds)
    seen_tweets: set[str] = set()
    by_article_url: dict[str, NativeArticle] = {}
    by_title: dict[str, NativeArticle] = {}
    all_tweets = 0

    for label, query, qtype in queries:
        print(f"\n### {label} [{qtype}] {query}", file=sys.stderr)
        source = raw_search(label, args.pages, raw_dir) if args.reuse_raw else metered_search(query, qtype, args.pages, label, raw_dir)
        if args.reuse_raw:
            print(f"  ↳ RAW REUSE {label}: {len(source)} tweets", file=sys.stderr)
        all_tweets += len(source)
        for tweet in source:
            tweet_id = str(tweet.get("id") or "")
            if not tweet_id or tweet_id in seen_tweets:
                continue
            seen_tweets.add(tweet_id)
            created = parse_x_date(tweet.get("createdAt") or "")
            if not created or created < cutoff:
                continue
            article = to_article(tweet, label)
            if not article:
                continue
            if not matches_niche(article, args.niche):
                continue
            url_key = article.article_url or article.tweet_url
            title_dedupe_key = title_key(article.title) or url_key
            existing_url = by_article_url.get(url_key)
            if not existing_url or article.score > existing_url.score:
                by_article_url[url_key] = article
            existing_title = by_title.get(title_dedupe_key)
            if not existing_title or article.score > existing_title.score:
                by_title[title_dedupe_key] = article
        if len(by_title) >= args.max_articles:
            print(f"  ↳ STOP ladder: {len(by_title)} distinct qualified articles >= max {args.max_articles}", file=sys.stderr)
            break

    articles = sorted(by_title.values(), key=lambda a: (a.score, a.engagement, a.views), reverse=True)[: args.max_articles]
    rows = []
    for article in articles:
        row = asdict(article)
        row["engagement"] = article.engagement
        row["weighted_engagement"] = article.weighted_engagement
        row["engagement_per_1k_views"] = article.engagement_per_1k_views
        row["score"] = article.score
        rows.append(row)

    write_jsonl(out_dir / "articles.jsonl", rows)
    write_jsonl(out_dir / f"articles-{started_at.strftime('%Y%m%dT%H%M%SZ')}.jsonl", rows)

    balance_after = twapi.total_credits()
    report = report_md(articles, all_tweets, started_at, cutoff, args.niche, balance_before, balance_after, queries, args.search_mode)
    (out_dir / "report.md").write_text(report)

    print(json.dumps({
        "date": args.date,
        "niche": args.niche,
        "out_dir": str(out_dir),
        "tweets": all_tweets,
        "native_x_articles": len(articles),
        "top": asdict(articles[0]) if articles else None,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
