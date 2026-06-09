#!/usr/bin/env python3
"""Find best-performing trading/AI articles on X in a recent time window.

Uses twitterapi.io through ../twapi.py for metered calls and ledger accounting.
Run:
  python3 docs/x-targeting/articles_24h/find_trading_ai_articles.py --lookback-hours 24 --pages 3
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import twapi  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent
RAW_DIR = OUT_DIR / "raw"
RUNS_DIR = OUT_DIR / "runs"

X_DOMAINS = {
    "x.com",
    "twitter.com",
    "t.co",
    "pic.twitter.com",
    "mobile.twitter.com",
}

NON_ARTICLE_DOMAINS = {
    "discord.gg",
    "discord.com",
    "telegram.me",
    "t.me",
    "linktr.ee",
    "github.com",
    "docs.google.com",
    "forms.gle",
    "calendar.google.com",
    "youtube.com",
    "youtu.be",
    "luma.com",
    "polymarket.com",
    "kalshi.com",
    "dexscreener.com",
    "pump.fun",
    "weex.com",
    "phemex.com",
}

ARTICLE_DOMAINS = {
    "substack.com",
    "medium.com",
    "mirror.xyz",
    "paragraph.xyz",
    "coindesk.com",
    "cointelegraph.com",
    "decrypt.co",
    "theblock.co",
    "blockworks.co",
    "dlnews.com",
    "panewslab.com",
    "beincrypto.com",
    "bitcoinmagazine.com",
    "arxiv.org",
    "papers.ssrn.com",
    "a16zcrypto.com",
    "research.binance.com",
    "blog.bitget.com",
    "blog.bybit.com",
    "blog.kraken.com",
    "insights.glassnode.com",
    "research.kaiko.com",
    "financemagnates.com",
    "fxnewsgroup.com",
    "blockchainreporter.net",
    "memeburn.com",
    "crowdfundinsider.com",
    "businessinsider.com",
    "markets.businessinsider.com",
    "thedefiant.io",
    "thearmchairtrader.com",
    "talkmarkets.com",
    "finance.yahoo.com",
    "indianexpress.com",
    "revolter.se",
    "theglobeandmail.com",
    "kpmg.com",
}

ARTICLE_PATH_HINTS = (
    "/blog/",
    "/blogs/",
    "/news/",
    "/article/",
    "/articles/",
    "/research/",
    "/insights/",
    "/p/",
    "/post/",
    "/posts/",
    "/reports/",
    "/report/",
    "/read/",
    "/academy/",
)

ARTICLE_TEXT_HINTS = (
    "article",
    "essay",
    "deep dive",
    "report",
    "research",
    "analysis",
    "writeup",
    "read:",
    "new post",
    "blog",
    "paper",
)

TOPIC_HINTS = (
    "ai",
    "agent",
    "agents",
    "trading",
    "trade",
    "trader",
    "quant",
    "market",
    "crypto",
    "defi",
    "perp",
    "prediction",
    "portfolio",
    "backtest",
    "alpha",
    "llm",
)

PRODUCT_TEXT_HINTS = (
    "sign up",
    "login",
    "presale",
    "waitlist",
    "faucet",
    "dashboard",
    "terminal",
    "trading signals",
    "trading assistant",
    "copy trading",
    "event",
    "happy hour",
    "bootcamp",
    "domain for sale",
    "web3 stack",
    "trade now",
    "built for",
    "official",
    "subscribe",
)

PRODUCT_SUBDOMAINS = (
    "app.",
    "api.",
    "arena.",
    "faucet.",
    "testnet.",
    "node.",
)


@dataclass
class TweetHit:
    tweet_id: str
    url: str
    twitter_url: str
    author: str
    author_followers: int
    created_at: str
    text: str
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
        return self.likes + (2 * self.retweets) + (2 * self.quotes) + self.replies + self.bookmarks


@dataclass
class ArticleCandidate:
    canonical_url: str
    final_url: str
    domain: str
    title: str = ""
    description: str = ""
    article_score: int = 0
    is_article_like: bool = False
    reasons: list[str] = field(default_factory=list)
    tweets: list[TweetHit] = field(default_factory=list)
    quote_tweets: list[TweetHit] = field(default_factory=list)
    reply_tweets: list[TweetHit] = field(default_factory=list)

    @property
    def total_engagement(self) -> int:
        return sum(t.engagement for t in self.tweets)

    @property
    def total_weighted_engagement(self) -> int:
        return sum(t.weighted_engagement for t in self.tweets)

    @property
    def total_views(self) -> int:
        return sum(t.views for t in self.tweets)

    @property
    def best_tweet(self) -> TweetHit | None:
        return max(self.tweets, key=lambda t: (t.weighted_engagement, t.views), default=None)

    @property
    def graph_engagement(self) -> int:
        return sum(t.engagement for t in self.quote_tweets + self.reply_tweets)

    @property
    def rank_score(self) -> float:
        best = self.best_tweet.weighted_engagement if self.best_tweet else 0
        views = min(self.total_views / 5000, 80)
        graph = min(self.graph_engagement, 200)
        return best + (0.55 * self.total_weighted_engagement) + views + (0.35 * graph) + (20 * max(0, self.article_score))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_twitter_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%a %b %d %H:%M:%S %z %Y")
    except ValueError:
        pass
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def safe_int(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def slug(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return cleaned[:80] or hashlib.sha256(value.encode()).hexdigest()[:12]


def domain_of(url: str) -> str:
    host = urllib.parse.urlparse(url).hostname or ""
    host = host.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def normalize_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    scheme = parsed.scheme or "https"
    host = (parsed.hostname or parsed.netloc).lower()
    if host.startswith("www."):
        host = host[4:]
    port = parsed.port
    if port and not ((scheme == "https" and port == 443) or (scheme == "http" and port == 80)):
        host = f"{host}:{port}"
    query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=False)
    blocked_prefixes = ("utm_",)
    blocked_keys = {
        "ref",
        "ref_src",
        "s",
        "source",
        "fbclid",
        "gclid",
        "igshid",
        "mc_cid",
        "mc_eid",
    }
    kept = [
        (k, v)
        for k, v in query
        if k not in blocked_keys and not any(k.startswith(prefix) for prefix in blocked_prefixes)
    ]
    path = parsed.path.rstrip("/") or "/"
    return urllib.parse.urlunparse((scheme, host, path, "", urllib.parse.urlencode(kept), ""))


def extract_urls(tweet: dict) -> list[str]:
    urls = []
    entities = tweet.get("entities") or {}
    for item in entities.get("urls") or []:
        expanded = item.get("expanded_url") or item.get("url")
        if expanded:
            urls.append(expanded)
    card = tweet.get("card") or {}
    for value in card.values() if isinstance(card, dict) else []:
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            urls.append(value)
    return list(dict.fromkeys(urls))


def tweet_hit(tweet: dict, linked_url: str, query_label: str) -> TweetHit:
    author = tweet.get("author") or {}
    return TweetHit(
        tweet_id=str(tweet.get("id") or ""),
        url=linked_url,
        twitter_url=tweet.get("url") or tweet.get("twitterUrl") or "",
        author=author.get("userName") or tweet.get("authorName") or "?",
        author_followers=safe_int(author.get("followers")),
        created_at=tweet.get("createdAt") or "",
        text=tweet.get("text") or "",
        likes=safe_int(tweet.get("likeCount")),
        retweets=safe_int(tweet.get("retweetCount")),
        replies=safe_int(tweet.get("replyCount")),
        quotes=safe_int(tweet.get("quoteCount")),
        bookmarks=safe_int(tweet.get("bookmarkCount")),
        views=safe_int(tweet.get("viewCount")),
        query_label=query_label,
    )


def fetch_title(url: str, timeout: int = 8) -> tuple[str, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 article-research-bot/1.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
            final_url = response.geturl()
            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type and "application/xhtml" not in content_type:
                return final_url, "", ""
            raw = response.read(512_000)
    except (urllib.error.URLError, TimeoutError, socket.timeout, ssl.SSLError, ValueError):
        return url, "", ""
    text = raw.decode("utf-8", errors="ignore")
    title = ""
    desc = ""
    og = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', text, re.I)
    if og:
        title = html.unescape(og.group(1)).strip()
    if not title:
        mt = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
        if mt:
            title = html.unescape(re.sub(r"\s+", " ", mt.group(1))).strip()
    md = re.search(r'<meta[^>]+(?:name|property)=["\'](?:description|og:description)["\'][^>]+content=["\']([^"\']+)["\']', text, re.I)
    if md:
        desc = html.unescape(md.group(1)).strip()
    return final_url, title[:220], desc[:360]


def score_article_like(candidate: ArticleCandidate) -> None:
    score = 0
    reasons = []
    domain = candidate.domain
    path = urllib.parse.urlparse(candidate.final_url or candidate.canonical_url).path.lower()
    title_text = f"{candidate.title} {candidate.description}".lower()
    tweet_text = " ".join(t.text for t in candidate.tweets[:5]).lower()
    all_text = f"{title_text} {tweet_text} {candidate.final_url}".lower()

    if domain in NON_ARTICLE_DOMAINS or any(domain.endswith("." + d) for d in NON_ARTICLE_DOMAINS):
        score -= 4
        reasons.append("non-article-domain")
    if domain.startswith(PRODUCT_SUBDOMAINS):
        score -= 2
        reasons.append("product-subdomain")
    if domain in ARTICLE_DOMAINS or any(domain.endswith("." + d) for d in ARTICLE_DOMAINS):
        score += 3
        reasons.append("known-article-domain")
    if any(hint in path for hint in ARTICLE_PATH_HINTS):
        score += 2
        reasons.append("article-path")
    if any(hint in all_text for hint in ARTICLE_TEXT_HINTS):
        score += 2
        reasons.append("article-language")
    topic_hits = sum(1 for hint in TOPIC_HINTS if re.search(rf"\b{re.escape(hint)}\b", all_text))
    if topic_hits >= 3:
        score += 2
        reasons.append("trading-ai-topic")
    elif topic_hits >= 2:
        score += 1
        reasons.append("partial-topic")
    if re.search(r"/(app|login|signup|waitlist|airdrop|dashboard|presale|faucet|event)(/|$)", path):
        score -= 3
        reasons.append("product-path")
    if any(hint in all_text for hint in PRODUCT_TEXT_HINTS):
        score -= 2
        reasons.append("product-language")
    if not candidate.title and not candidate.description:
        score -= 1
        reasons.append("metadata-missing")

    candidate.article_score = score
    candidate.reasons = reasons
    article_evidence = any(r in reasons for r in ("known-article-domain", "article-path"))
    topic_evidence = any(r in reasons for r in ("trading-ai-topic", "partial-topic"))
    disqualifier = any(r in reasons for r in ("non-article-domain", "product-path", "product-subdomain"))
    candidate.is_article_like = score >= 3 and article_evidence and topic_evidence and not disqualifier


def metered_search(query: str, query_type: str, pages: int, label: str) -> list[dict]:
    tweets: list[dict] = []
    cursor = ""
    for page in range(pages):
        params = {"query": query, "queryType": query_type}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(
            f"articles24h:{label}:p{page}",
            "/twitter/tweet/advanced_search",
            params,
            estimate=15 * 20,
        )
        raw_path = RAW_DIR / f"{slug(label)}-p{page}.json"
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(json.dumps(body, ensure_ascii=False, indent=2))
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


def raw_search(label: str, pages: int) -> list[dict]:
    tweets: list[dict] = []
    for page in range(pages):
        raw_path = RAW_DIR / f"{slug(label)}-p{page}.json"
        if not raw_path.exists():
            continue
        body = json.loads(raw_path.read_text())
        data = body.get("data") or {}
        batch = body.get("tweets") or (data.get("tweets", []) if isinstance(data, dict) else [])
        tweets.extend(batch or [])
    return tweets


def fetch_engagement_graph(seed: TweetHit, kind: str, max_pages: int = 1) -> list[TweetHit]:
    if kind == "quotes":
        path = "/twitter/tweet/quotes"
    elif kind == "replies":
        path = "/twitter/tweet/replies"
    else:
        raise ValueError(kind)

    hits: list[TweetHit] = []
    cursor = ""
    for page in range(max_pages):
        params = {"tweetId": seed.tweet_id}
        if cursor:
            params["cursor"] = cursor
        body = twapi.metered_call(
            f"articles24h:{kind}:{seed.tweet_id}:p{page}",
            path,
            params,
            estimate=15 * 20,
        )
        raw_path = RAW_DIR / f"{kind}-{seed.tweet_id}-p{page}.json"
        raw_path.write_text(json.dumps(body, ensure_ascii=False, indent=2))
        data = body.get("data") or {}
        tweets = body.get("tweets") or body.get(kind) or (data.get("tweets", []) if isinstance(data, dict) else [])
        for tweet in tweets or []:
            hits.append(tweet_hit(tweet, seed.url, f"{kind}:{seed.tweet_id}"))
        cursor = body.get("next_cursor") or (data.get("next_cursor") if isinstance(data, dict) else "") or ""
        has_next = body.get("has_next_page", data.get("has_next_page", bool(cursor)) if isinstance(data, dict) else bool(cursor))
        if not cursor or not has_next:
            break
    return hits


def build_queries(since_date: str) -> list[tuple[str, str, str]]:
    base_suffix = f'filter:links since:{since_date} -is:retweet'
    return [
        ("core-ai-trading-top", f'("AI trading" OR "trading AI" OR "AI trader" OR "AI traders") {base_suffix} min_faves:10', "Top"),
        ("core-ai-trading-latest", f'("AI trading" OR "trading AI" OR "AI trader" OR "AI traders") {base_suffix}', "Latest"),
        ("agent-trading-top", f'("AI agent" OR "AI agents" OR agentic OR autonomous) (trading OR trader OR portfolio OR markets) {base_suffix} min_faves:10', "Top"),
        ("llm-quant-top", f'("LLM trading" OR "AI quant" OR "ML trading" OR "machine learning trading") {base_suffix}', "Top"),
        ("crypto-ai-trading-top", f'(crypto OR DeFi OR onchain OR perp OR prediction) ("AI trading" OR "AI agents" OR "AI trader") {base_suffix}', "Top"),
        ("research-report-top", f'(AI OR agents OR LLM) (trading OR markets OR quant) (article OR report OR research OR "deep dive" OR essay OR analysis) {base_suffix}', "Top"),
        ("substack-top", f'(AI OR agents OR LLM) (trading OR markets OR quant OR crypto) url:substack.com since:{since_date} -is:retweet', "Top"),
        ("medium-mirror-top", f'(AI OR agents OR LLM) (trading OR markets OR quant OR crypto) (url:medium.com OR url:mirror.xyz OR url:paragraph.xyz) since:{since_date} -is:retweet', "Top"),
        ("media-ai-trading-top", f'("AI trading" OR "AI agents trading" OR "AI trader") (url:coindesk.com OR url:cointelegraph.com OR url:decrypt.co OR url:blockworks.co OR url:theblock.co) since:{since_date} -is:retweet', "Top"),
        ("paper-top", f'(AI OR LLM OR agent) (trading OR market OR markets OR portfolio) (url:arxiv.org OR url:ssrn.com) since:{since_date} -is:retweet', "Top"),
        ("backtest-top", f'("AI strategy" OR "AI trading bot" OR "trading agent") (backtest OR paper OR article OR report) {base_suffix}', "Top"),
        ("prediction-market-ai-top", f'("prediction market" OR Polymarket OR Kalshi) (AI OR agent OR agents OR LLM) {base_suffix}', "Top"),
    ]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def markdown_report(candidates: list[ArticleCandidate], started_at: datetime, lookback_hours: int, queries: list[tuple[str, str, str]], balance_before: int, balance_after: int) -> str:
    article_like = [c for c in candidates if c.is_article_like]
    leads = [c for c in candidates if not c.is_article_like]
    spend = max(0, balance_before - balance_after)
    lines = [
        "# Trading/AI Articles — X 24h Research System",
        "",
        "## TL;DR",
        "",
        f"Found **{len(article_like)} article-like links** and **{len(leads)} adjacent link leads** from X posts in the last **{lookback_hours} hours**.",
        "",
        "| rank | article | X signal | score | why it passed | next action |",
        "|---:|---|---:|---:|---|---|",
    ]
    for idx, c in enumerate(article_like[:15], 1):
        best = c.best_tweet
        title = c.title or c.canonical_url
        x_signal = f"{c.total_engagement} eng / {c.total_views} views"
        link = f"[{title}]({c.final_url or c.canonical_url})"
        tweet = f"[tweet]({best.twitter_url})" if best and best.twitter_url else "tweet"
        lines.append(
            f"| {idx} | {link} | {x_signal}; best {tweet} | {c.rank_score:.1f} | {', '.join(c.reasons[:3])} | Read and mine the hook (~5 min) |"
        )
    if not article_like:
        lines.append("| - | No article-like links survived the classifier | - | - | - | Re-run with lower thresholds (~3 min) |")

    lines.extend([
        "",
        "## System",
        "",
        "| step | what it does | effort | output |",
        "|---:|---|---:|---|",
        f"| 1 | Search URL-bearing trading/AI queries in `Top` and `Latest`, then locally enforce the {lookback_hours}h cutoff | ~3 min | raw tweet pages |",
        "| 2 | Extract expanded URLs, remove X/Twitter/media-only URLs, normalize tracking params | ~1 min | canonical article URLs |",
        "| 3 | Resolve page metadata and classify article-like links by domain, path, title, and tweet language | ~2 min | ranked candidates |",
        "| 4 | Optional: fetch quotes/replies for the strongest linked tweets to capture second-order spread | ~3 min | graph signal |",
        "| 5 | Write JSONL + Markdown report for reuse | ~1 min | files below |",
        "",
        "Therefore: use this as a daily article radar, not as a one-off scrape.",
        "",
        "## Best Adjacent Leads",
        "",
        "These performed well but look more like product pages, apps, docs, or landing pages than articles.",
        "",
        "| rank | link | X signal | classifier reason | next action |",
        "|---:|---|---:|---|---|",
    ])
    for idx, c in enumerate(leads[:10], 1):
        title = c.title or c.canonical_url
        lines.append(
            f"| {idx} | [{title}]({c.final_url or c.canonical_url}) | {c.total_engagement} eng / {c.total_views} views | {', '.join(c.reasons[:4])} | Inspect only if product-angle research matters (~3 min) |"
        )

    lines.extend([
        "",
        "## Query Families",
        "",
        "| label | query type | query |",
        "|---|---|---|",
    ])
    for label, query, qtype in queries:
        lines.append(f"| `{label}` | `{qtype}` | `{query}` |")

    domains = Counter(c.domain for c in candidates)
    lines.extend([
        "",
        "## Domain Map",
        "",
        "| domain | links found |",
        "|---|---:|",
    ])
    for domain, count in domains.most_common(20):
        lines.append(f"| `{domain}` | {count} |")

    lines.extend([
        "",
        "## Run Files",
        "",
        "| file | what it contains | effort |",
        "|---|---|---:|",
        "| `docs/x-targeting/articles_24h/runs/latest_articles.jsonl` | ranked article candidates | ~1 min |",
        "| `docs/x-targeting/articles_24h/runs/latest_tweets.jsonl` | normalized source tweets | ~1 min |",
        "| `docs/x-targeting/articles_24h/raw/` | raw twitterapi.io responses | ~2 min |",
        "",
        "## Spend",
        "",
        f"- Started: `{started_at.isoformat()}`.",
        f"- Balance before: `{balance_before}` credits.",
        f"- Balance after: `{balance_after}` credits.",
        f"- Apparent spend: `{spend}` credits = `${spend / twapi.CREDITS_PER_USD:.4f}`.",
        "",
        "Exception: twitterapi.io balance updates can lag per call, so the ledger is the accounting source after settlement.",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lookback-hours", type=int, default=24)
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--graph-seeds", type=int, default=0)
    parser.add_argument("--graph-pages", type=int, default=1)
    parser.add_argument("--budget-usd", type=float, default=25.0)
    parser.add_argument("--reuse-raw", action="store_true")
    args = parser.parse_args()

    started_at = utc_now()
    cutoff = started_at - timedelta(hours=args.lookback_hours)
    since_date = cutoff.strftime("%Y-%m-%d")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    balance_before = twapi.total_credits()
    budget = {
        "cap_usd": args.budget_usd,
        "baseline_credits": balance_before,
        "spent_locked_credits": 0,
    }
    budget_path = RUNS_DIR / "budget.active.json"
    budget_path.write_text(json.dumps(budget, indent=2))
    twapi.BUDGET_FILE = budget_path

    queries = build_queries(since_date)
    seen_tweet_ids: set[str] = set()
    hits: list[TweetHit] = []

    for label, query, qtype in queries:
        print(f"\n### {label} [{qtype}] {query}", file=sys.stderr)
        source_tweets = raw_search(label, args.pages) if args.reuse_raw else metered_search(query, qtype, args.pages, label)
        if args.reuse_raw:
            print(f"  ↳ RAW REUSE {label}: {len(source_tweets)} tweets", file=sys.stderr)
        for tweet in source_tweets:
            tweet_id = str(tweet.get("id") or "")
            if not tweet_id or tweet_id in seen_tweet_ids:
                continue
            seen_tweet_ids.add(tweet_id)
            created = parse_twitter_date(tweet.get("createdAt") or "")
            if not created or created < cutoff:
                continue
            for url in extract_urls(tweet):
                domain = domain_of(url)
                if domain in X_DOMAINS or any(domain.endswith("." + d) for d in X_DOMAINS):
                    continue
                hits.append(tweet_hit(tweet, url, label))

    by_url: dict[str, ArticleCandidate] = {}
    for hit in hits:
        canonical = normalize_url(hit.url)
        if canonical not in by_url:
            by_url[canonical] = ArticleCandidate(
                canonical_url=canonical,
                final_url=canonical,
                domain=domain_of(canonical),
            )
        by_url[canonical].tweets.append(hit)

    print(f"\n### Resolving metadata for {len(by_url)} links", file=sys.stderr)
    for idx, candidate in enumerate(by_url.values(), 1):
        final_url, title, desc = fetch_title(candidate.canonical_url)
        candidate.final_url = normalize_url(final_url)
        candidate.domain = domain_of(candidate.final_url)
        candidate.title = title
        candidate.description = desc
        score_article_like(candidate)
        print(f"  {idx:03d}/{len(by_url)} score={candidate.article_score:>2} {candidate.domain} {candidate.title[:80]}", file=sys.stderr)
        time.sleep(0.08)

    ranked = sorted(by_url.values(), key=lambda c: c.rank_score, reverse=True)
    graph_targets = [c for c in ranked if c.best_tweet and c.best_tweet.tweet_id][: args.graph_seeds]
    print(f"\n### Graph expansion for {len(graph_targets)} seed tweets", file=sys.stderr)
    for candidate in graph_targets:
        seed = candidate.best_tweet
        if not seed:
            continue
        candidate.quote_tweets = fetch_engagement_graph(seed, "quotes", args.graph_pages)
        candidate.reply_tweets = fetch_engagement_graph(seed, "replies", args.graph_pages)
        score_article_like(candidate)
        time.sleep(0.1)

    ranked = sorted(by_url.values(), key=lambda c: c.rank_score, reverse=True)
    article_rows = []
    for c in ranked:
        row = asdict(c)
        row["total_engagement"] = c.total_engagement
        row["total_weighted_engagement"] = c.total_weighted_engagement
        row["total_views"] = c.total_views
        row["graph_engagement"] = c.graph_engagement
        row["rank_score"] = c.rank_score
        article_rows.append(row)

    write_jsonl(RUNS_DIR / "latest_articles.jsonl", article_rows)
    write_jsonl(RUNS_DIR / f"articles-{started_at.strftime('%Y%m%dT%H%M%SZ')}.jsonl", article_rows)
    write_jsonl(RUNS_DIR / "latest_tweets.jsonl", [asdict(h) for h in hits])

    balance_after = twapi.total_credits()
    report = markdown_report(ranked, started_at, args.lookback_hours, queries, balance_before, balance_after)
    (OUT_DIR / "latest-report.md").write_text(report)

    marketing_report = Path("/Users/maxguillabert/Downloads/index/marketing/niche-research/trading-ai-articles-24h.md")
    marketing_report.write_text(report)

    print("\n### DONE", file=sys.stderr)
    print(json.dumps({
        "links": len(ranked),
        "article_like": sum(1 for c in ranked if c.is_article_like),
        "tweets": len(hits),
        "balance_before": balance_before,
        "balance_after": balance_after,
        "report": str(marketing_report),
    }, indent=2))


if __name__ == "__main__":
    main()
