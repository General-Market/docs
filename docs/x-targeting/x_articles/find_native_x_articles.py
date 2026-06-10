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
    "chatgpt",
    "openai",
    "anthropic",
    "gemini",
    "grok",
    "deepseek",
    "copilot",
    "autonomous",
    "machine learning",
    "deep learning",
    "neural",
    "transformer",
    "scaling law",
    "semiconductor",
    "半导体",
    "anduril",
    "codex",
    "mcp",
)

CRYPTO_TERMS = (
    "crypto",
    "defi",
    "onchain",
    "blockchain",
    "web3",
    "perp",
    "perps",
    "dex",
    "token",
    # The platform's densest high-view crypto class was absent from the list, so
    # Articles like Saylor's "Four Ideologies of Bitcoin" (1.5M views) were dropped.
    # "eth" is safe under the ASCII-boundary matcher (no match inside "method").
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "stablecoin",
    "satoshi",
    "solana",
    "孙宇晨",
)

PREDICTION_MARKET_TERMS = (
    "polymarket",
    "prediction",
    "prediction market",
    "kalshi",
    "forecast",
    "betting market",
    # The industry renamed itself: HIP-4-era coverage says "outcome markets",
    # CJK coverage says 预测市场/予測市場, and the new platforms (Vizo, XPredict,
    # Predictstreet) never say "prediction market" in a title. All audited
    # zero-junk. "bet"/"betting" rejected: admits stock-pick titles + spam.
    "outcome market",
    "hip-4",
    "event contract",
    "预测市场",
    "予測市場",
    "vizo",
    "xpredict",
    "predictstreet",
    # Recall-first expansion: the platform map + category vocabulary.
    "predict.fun",
    "limitless exchange",
    "myriad markets",
    "manifold markets",
    "metaculus",
    "azuro",
    "futarchy",
    "decision market",
    "decision markets",
    "information market",
    "information markets",
    "event market",
    "event markets",
    "sportsbook",
    "moneyline",
    "consequitur",
    "tiprun",
    "ヨソクヒロバ",
    "赛事预测",
)

POLYMARKET_TERMS = (
    "polymarket",
    "poly market",
    "prediction market",
    "prediction markets",
    "pm market",
    "ポリマーケット",
)

PUMPFUN_TERMS = (
    "pump.fun",
    "pumpfun",
    "pump fun",
    "memecoin",
    "memecoins",
    "meme coin",
    "meme coins",
    "launchpad",
    "bonding curve",
    "solana launch",
    "letsbonk",
    "bonkfun",
    # New launchpads + CJK memecoin slang from the dropped-corpus audit
    # (土狗 = CN "shitcoin", 狗狗币 = CN "dogecoin"). Bare "meme"/"launch"
    # rejected: re-admits ~80% of the adjacent junk.
    "alt.fun",
    "altdotfun",
    "bankr",
    "perpad",
    "dogecoin",
    "$doge",
    "狗狗币",
    "土狗",
    "fair launch",
    "meme season",
    # Recall-first expansion: the launchpad map + trench culture + CJK/KR slang.
    "moonshot",
    "four.meme",
    "daos.fun",
    "time.fun",
    "believe app",
    "clanker",
    "zora",
    "launchlab",
    "pumpswap",
    "$pump",
    "$bonk",
    "$wif",
    "$pepe",
    "fartcoin",
    "shitcoin",
    "shitcoins",
    "trenches",
    "the trenches",
    "rug pull",
    "rugpull",
    "rugged",
    "degen",
    "ape season",
    "梗币",
    "冲狗",
    "打狗",
    "金狗",
    "ミームコイン",
    "밈코인",
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
    # Audited against the dropped-article corpus (zero junk measured per term).
    # "ipo" alone recovered 3 viral SpaceX-S1 articles (11.8M views). CJK retail-
    # investing vocabulary: 米国株 = US stocks (JP), 株式 = equities (JP), 上場 =
    # go public (JP), 投资 = invest (CN). Bare 株 rejected (substring of 株式会社
    # in every JP corporate article); トレード rejected (JP baseball trades).
    "ipo",
    "ipos",
    "bitcoin",
    "ethereum",
    "nisa",
    "米国株",
    "美股",
    "株式市場",
    "株式投資",
    "上場",
    "投资",
)

# Distinctive Hyperliquid vocabulary. Bare "hype" is excluded because it collides
# with the English word; the token is matched as the cashtag "$hype" instead
# (see term_in_text for the cashtag branch).
HYPERLIQUID_CORE_TERMS = (
    "hyperliquid",
    "hyperliquidx",
    "hyperevm",
    "hyper evm",
    "hypercore",
    "hyperunit",
    "hyperbft",
    "hip-1",
    "hip-2",
    "hip-3",
    "hip-4",
    "hip1",
    "hip2",
    "hip3",
    "hip4",
    "hlp",
    "purr",
    "$hype",
    "$purr",
)

# Apps and protocols building on Hyperliquid / HyperEVM.
HYPERLIQUID_ECO_TERMS = (
    "hyperbeat",
    "felix",
    "hypurrfi",
    "hypurr",
    "hyperlend",
    "kinetiq",
    "hyperdrive",
    "hyperswap",
    "hybra",
    "kittenswap",
    "hyperbloom",
    "hypernova",
    "nova markets",
    "liminal",
    "valantis",
    # HIP-3 builder-market protocols — covered repeatedly without the word
    # "Hyperliquid" in the title (pre-IPO perps wave).
    "ventuals",
    "trade.xyz",
    "tradexyz",
    "alt.fun",
    # Recall-first expansion (user call: junk is visible, misses are not).
    # Apps, infra, stables, staking, mobile clients of the HL ecosystem.
    "pvp.trade",
    "dexari",
    "lootbase",
    "drip.trade",
    "hypurrscan",
    "hypurr.fun",
    "hyperdash",
    "upshift",
    "thunderhead",
    "loopedhype",
    "looped hype",
    "hyperstable",
    "hyperpie",
    "gliquid",
    "prjx",
    "projectx",
    "usdh",
    "usdhl",
    "feusd",
    "whlp",
    "sthype",
    "khype",
    "lhype",
    "ubtc",
    "ueth",
    "builder code",
    "builder codes",
    "pre-ipo perp",
    "pre-ipo perps",
    "equity perps",
)
# 'sentiment' (a minor HyperEVM lending app) was dropped: the bare English word
# "market sentiment" appears in too many unrelated crypto articles to be a safe term.

# Token-context patterns: bare "HYPE" collides with the English word, so it only
# counts when it sits next to a token signal (HYPE ETF, HYPE tokenomics, …).
HYPERLIQUID_TOKEN_PATTERNS = (
    r"\bhype\s*(etf|token|tokenomics|ath|buyback|staking|airdrop|treasury|price)",
)

# A native Article from one of these handles is in-niche even when the title is
# language-ambiguous (e.g. @HyperEVM_CN posting "<Hypernova研报>").
HYPERLIQUID_AUTHOR_REGEX = (
    r"hyperliquid|hyperevm|hypurr|hyperbeat|hyperlend|kinetiq|hyperswap|hyperbloom"
    r"|ventuals|tradexyz|dexari|lootbase|hyperdash|hyperstable|loopedhype|hypurrfi|hyperunit"
)

HYPERLIQUID_TERMS = HYPERLIQUID_CORE_TERMS + HYPERLIQUID_ECO_TERMS

HIP3_TERMS = (
    "hip-3",
    "hip3",
    "hip-4",
    "hip4",
    "builder-deployed",
    "builder deployed",
    "builder code",
    "builder codes",
    "permissionless perp",
    "permissionless perps",
    "permissionless listing",
    "permissionless market",
    "deployer auction",
    # The HIP-3 wave is covered through its protocols and product category,
    # often without the HIP number itself.
    "ventuals",
    "trade.xyz",
    "tradexyz",
    "pre-ipo perp",
    "pre-ipo perps",
    "pre-ipo market",
    "equity perps",
    "stock perps",
    "builder market",
    "builder markets",
    "outcome market",
    "outcome markets",
)

HYPEREVM_TERMS = (
    "hyperevm",
    "hyper evm",
    "hypercore",
    "hyperliquid evm",
    "evmify",
    "precompile",
    "corewriter",
) + HYPERLIQUID_ECO_TERMS

HL_DEFI_TERMS = (
    "hlp",
    "hlp vault",
    "liquidity provider vault",
    "vault",
    "lending",
    "looping",
    "sthype",
    "lst",
    "liquid staking",
) + HYPERLIQUID_ECO_TERMS

# Shared X-search recall query for the Hyperliquid ecosystem.
HYPERLIQUID_QUERY = (
    '(Hyperliquid OR HyperEVM OR HyperCore OR $HYPE OR HIP-3 OR HIP-4 OR HLP OR HyperUnit '
    'OR Hyperbeat OR Felix OR HypurrFi OR HyperLend OR Kinetiq OR HyperSwap OR Hypernova '
    'OR HyperBloom OR Ventuals OR trade.xyz OR alt.fun OR USDH OR Dexari OR pvp.trade '
    'OR stHYPE OR $PURR)'
)

NICHE_CONFIG = {
    "trading-ai": {
        "match_all": (AI_TERMS, MARKET_TERMS),
        "keyword_query": "(AI OR agent OR agents OR LLM) (trading OR trader OR quant OR market OR markets OR portfolio OR crypto OR DeFi OR perp OR prediction)",
    },
    "ai": {
        "match_any": AI_TERMS,
        "keyword_query": "(AI OR agent OR agents OR agentic OR LLM OR Claude OR GPT OR autonomous)",
    },
    "trading": {
        "match_any": MARKET_TERMS,
        "keyword_query": "(trading OR trader OR market OR markets OR portfolio OR quant OR stock OR stocks OR finance OR liquidity)",
    },
    "crypto": {
        "match_any": CRYPTO_TERMS,
        "keyword_query": "(crypto OR DeFi OR onchain OR blockchain OR Web3 OR perp OR perps OR DEX OR token)",
    },
    "prediction-markets": {
        "match_any": PREDICTION_MARKET_TERMS,
        "keyword_query": "(Polymarket OR Kalshi OR prediction OR forecast OR \"betting market\" OR \"outcome market\" OR \"outcome markets\" OR \"event contract\" OR Vizo OR XPredict OR predict.fun OR \"limitless exchange\" OR \"myriad markets\" OR metaculus OR futarchy OR 预测市场 OR 予測市場)",
    },
    "polymarket": {
        "match_any": POLYMARKET_TERMS,
        "keyword_query": "(Polymarket OR \"poly market\" OR \"prediction market\" OR \"prediction markets\" OR ポリマーケット)",
    },
    "pumpfun": {
        "match_any": PUMPFUN_TERMS,
        "keyword_query": "(pump.fun OR pumpfun OR \"pump fun\" OR memecoin OR memecoins OR \"meme coin\" OR launchpad OR \"bonding curve\" OR LetsBonk OR bonkfun OR alt.fun OR Bankr OR perpad OR dogecoin OR clanker OR four.meme OR daos.fun OR \"fair launch\" OR 土狗 OR 狗狗币 OR 梗币)",
    },
    "hyperliquid": {
        "match_any": HYPERLIQUID_TERMS,
        "keyword_query": HYPERLIQUID_QUERY,
        "likes_prefix": HYPERLIQUID_QUERY,
        "token_patterns": HYPERLIQUID_TOKEN_PATTERNS,
        "author_regex": HYPERLIQUID_AUTHOR_REGEX,
    },
    "hyperliquid-30d": {
        "match_any": HYPERLIQUID_TERMS,
        "keyword_query": HYPERLIQUID_QUERY,
        "likes_prefix": HYPERLIQUID_QUERY,
        "token_patterns": HYPERLIQUID_TOKEN_PATTERNS,
        "author_regex": HYPERLIQUID_AUTHOR_REGEX,
    },
    "hip3-30d": {
        "match_any": HIP3_TERMS,
        "keyword_query": "(HIP-3 OR HIP3 OR \"builder deployed\" OR \"builder-deployed\" OR \"permissionless perp\" OR \"deployer auction\") (Hyperliquid OR HyperCore OR perp OR perps OR market)",
        "likes_prefix": "(HIP-3 OR HIP3 OR \"builder deployed\" OR \"builder-deployed\" OR \"deployer auction\")",
    },
    "hyperevm-30d": {
        "match_any": HYPEREVM_TERMS,
        "keyword_query": "(HyperEVM OR \"Hyper EVM\" OR HyperCore OR CoreWriter OR precompile OR Hyperbeat OR HyperSwap OR HyperLend OR Felix OR HypurrFi OR Kinetiq OR Hypernova OR HyperBloom)",
        "likes_prefix": "(HyperEVM OR \"Hyper EVM\" OR HyperCore OR CoreWriter OR Hyperbeat OR HyperSwap OR HyperLend OR Felix OR HypurrFi OR Kinetiq OR Hypernova)",
        "author_regex": HYPERLIQUID_AUTHOR_REGEX,
    },
    "hl-defi-30d": {
        "match_any": HL_DEFI_TERMS,
        "keyword_query": "(HLP OR \"HLP vault\" OR Hyperliquid OR HyperEVM) (vault OR lending OR looping OR staking OR LST OR stHYPE OR Felix OR HypurrFi OR HyperLend OR Hyperbeat OR Kinetiq)",
        "likes_prefix": "(\"HLP vault\" OR stHYPE OR Felix OR HypurrFi OR HyperLend OR Hyperbeat OR Kinetiq OR Hyperdrive)",
        "author_regex": HYPERLIQUID_AUTHOR_REGEX,
    },
}

# 30-day deep variants of every daily niche: same filter and queries, a separate
# slug so the monthly page lives next to the daily one in the UI. Run these with
# --lookback-hours 720. (The Hyperliquid -30d niches above are bespoke and skipped.)
for _base in ("trading-ai", "ai", "trading", "crypto", "prediction-markets", "polymarket", "pumpfun"):
    NICHE_CONFIG[f"{_base}-30d"] = dict(NICHE_CONFIG[_base])


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
    config = NICHE_CONFIG.get(niche)
    if not config:
        raise ValueError(f"Unsupported niche: {niche}. Available: {', '.join(sorted(NICHE_CONFIG))}")
    text = f"{article.title} {article.preview_text}".lower()
    if "match_all" in config:
        if all(any(term_in_text(term, text) for term in terms) for terms in config["match_all"]):
            return True
    elif any(term_in_text(term, text) for term in config["match_any"]):
        return True
    # Token-context patterns catch ambiguous tokens (bare HYPE) only beside a signal.
    for pattern in config.get("token_patterns", ()):
        if re.search(pattern, text, re.I):
            return True
    # A native Article from a clearly in-niche handle counts even when the title is
    # language-ambiguous (a Chinese research-report title under @HyperEVM_CN).
    author_regex = config.get("author_regex")
    if author_regex and re.search(author_regex, article.author or "", re.I):
        return True
    return False


def term_in_text(term: str, text: str) -> bool:
    term = term.lower()
    if term.startswith("$") or " " in term or "-" in term or "." in term:
        # Cashtags ($hype) and multi-token / punctuated terms (hip-3, pump.fun) lose
        # their boundary under \b, so fall back to substring matching.
        return term in text
    # ASCII boundaries instead of \b: \b fails when a latin term is flanked by CJK
    # characters (both sides are \w, so no boundary), which silently drops Chinese
    # and Japanese articles that embed a word like "Hyperliquid". This still blocks
    # mid-word English matches ("ai" in "air") because the flanks are ASCII letters.
    return re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text) is not None


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
    config = NICHE_CONFIG.get(niche)
    if not config:
        raise ValueError(f"Unsupported niche: {niche}. Available: {', '.join(sorted(NICHE_CONFIG))}")
    keyword_query = config["keyword_query"]
    return [
        (
            "broad-native-top",
            f"{keyword_query} url:x.com/i/article since:{since_date} -is:retweet",
            "Top",
        ),
        (
            "keyword-native-top",
            f"{keyword_query} url:x.com/i/article since:{since_date} -is:retweet min_faves:5",
            "Top",
        ),
        (
            "keyword-native-latest",
            f"{keyword_query} url:x.com/i/article since:{since_date} -is:retweet",
            "Latest",
        ),
    ]


def likes_ladder_queries(niche: str, since_date: str, thresholds: list[int]) -> list[tuple[str, str, str]]:
    config = NICHE_CONFIG.get(niche)
    if not config:
        raise ValueError(f"Unsupported niche: {niche}. Available: {', '.join(sorted(NICHE_CONFIG))}")
    # A narrow niche scopes the likes ladder to its own keywords so the high-faves
    # pull is spent inside the niche instead of across the whole platform. Broad
    # niches keep the platform-wide ladder and rely on the local classifier.
    prefix = config.get("likes_prefix")
    scope = f"{prefix} " if prefix else ""
    out: list[tuple[str, str, str]] = []
    for threshold in thresholds:
        query = f"{scope}min_faves:{threshold} url:x.com/i/article since:{since_date} -is:retweet"
        out.append((f"likes-gte-{threshold}", query, "Top"))
        # Top and Latest are near-disjoint result surfaces at the same floor
        # (6/59 overlap measured) — each yields different view giants. Duplicate
        # the giant-bearing rungs; sub-100 rungs only pad thin niches.
        if threshold >= 100:
            out.append((f"likes-gte-{threshold}-latest", query, "Latest"))
    return out


RT_THRESHOLDS = (500, 200, 100)


def retweet_ladder_queries(niche: str, since_date: str, thresholds: list[int]) -> list[tuple[str, str, str]]:
    # The single best generic operator for view giants (measured): min_retweets:500
    # surfaced 18 Articles over 1M views in 2 pages, max 30.8M. Retweets track reach
    # for announcement-style Articles whose like counts stay modest.
    config = NICHE_CONFIG.get(niche)
    if not config:
        raise ValueError(f"Unsupported niche: {niche}. Available: {', '.join(sorted(NICHE_CONFIG))}")
    prefix = config.get("likes_prefix")
    scope = f"{prefix} " if prefix else ""
    out: list[tuple[str, str, str]] = []
    for threshold in thresholds:
        query = f"{scope}min_retweets:{threshold} url:x.com/i/article since:{since_date} -is:retweet"
        out.append((f"rt-gte-{threshold}", query, "Top"))
        out.append((f"rt-gte-{threshold}-latest", query, "Latest"))
    return out


def replies_ladder_queries(niche: str, since_date: str, thresholds: list[int]) -> list[tuple[str, str, str]]:
    # Views and likes diverge: a 1.9M-view Article can carry 2k likes but 600 replies.
    # A min_faves ladder never fetches those view giants; a min_replies ladder does.
    # Replies are the engagement axis least correlated with likes (measured).
    config = NICHE_CONFIG.get(niche)
    if not config:
        raise ValueError(f"Unsupported niche: {niche}. Available: {', '.join(sorted(NICHE_CONFIG))}")
    prefix = config.get("likes_prefix")
    scope = f"{prefix} " if prefix else ""
    return [
        (
            f"replies-gte-{threshold}",
            f"{scope}min_replies:{threshold} url:x.com/i/article since:{since_date} -is:retweet",
            "Top",
        )
        for threshold in thresholds
    ]


def parse_tweets(body: dict) -> list[dict]:
    data = body.get("data") or {}
    return body.get("tweets") or (data.get("tweets", []) if isinstance(data, dict) else []) or []


def author_recent_tweets(handle: str, raw_dir: Path, reuse_raw: bool) -> list[dict]:
    label = slug(handle)
    path = raw_dir / "authors" / f"{label}.json"
    if reuse_raw and path.exists():
        return parse_tweets(json.loads(path.read_text()))
    if reuse_raw:
        return []
    body = twapi.metered_call(
        f"xarticles:author-baseline:{handle}",
        "/twitter/user/last_tweets",
        {"userName": handle.lstrip("@")},
        estimate=15 * 20,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(body, ensure_ascii=False, indent=2))
    return parse_tweets(body)


def average_last_views(tweets: list[dict], article_tweet_id: str, min_age_hours: int, now: datetime) -> float:
    views: list[int] = []
    for tweet in tweets:
        tweet_id = str(tweet.get("id") or "")
        if tweet_id == article_tweet_id:
            continue
        created = parse_x_date(tweet.get("createdAt") or "")
        if created and created > now - timedelta(hours=min_age_hours):
            continue
        value = safe_int(tweet.get("viewCount"))
        if value <= 0:
            continue
        views.append(value)
        if len(views) >= 10:
            break
    if not views:
        return 0.0
    return round(sum(views) / len(views), 3)


def enrich_outlier_metrics(article: NativeArticle, raw_dir: Path, reuse_raw: bool, min_age_hours: int, now: datetime) -> dict:
    avg_views = average_last_views(author_recent_tweets(article.author, raw_dir, reuse_raw), article.tweet_id, min_age_hours, now)
    views_per_1k_followers = 0.0
    if article.author_followers > 0:
        views_per_1k_followers = round(article.views * 1000 / article.author_followers, 3)
    views_vs_author_avg = 0.0
    if avg_views > 0:
        views_vs_author_avg = round(article.views / avg_views, 3)
    outlier_score = round((views_vs_author_avg * 100) + views_per_1k_followers + article.engagement_per_1k_views, 3)
    return {
        "author_avg_views_last10": avg_views,
        "author_avg_views_min_age_hours": min_age_hours,
        "views_per_1k_followers": views_per_1k_followers,
        "views_vs_author_avg": views_vs_author_avg,
        "outlier_score": outlier_score,
    }


REPLY_THRESHOLDS = (2000, 500, 100, 25)


def build_queries(niche: str, since_date: str, search_mode: str, thresholds: list[int]) -> list[tuple[str, str, str]]:
    if search_mode == "keyword":
        return keyword_queries(niche, since_date)
    if search_mode == "regressive-likes":
        return likes_ladder_queries(niche, since_date, thresholds)
    if search_mode == "both":
        # Retweet ladder first: it is the densest source of view giants, and the
        # ladder stops early once max_articles is reached — giants must be fetched
        # before that gate can close.
        return (
            retweet_ladder_queries(niche, since_date, list(RT_THRESHOLDS))
            + likes_ladder_queries(niche, since_date, thresholds)
            + replies_ladder_queries(niche, since_date, list(REPLY_THRESHOLDS))
            + keyword_queries(niche, since_date)
        )
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
        batch = parse_tweets(body)
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
        tweets.extend(parse_tweets(body))
    return tweets


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def report_md(
    articles: list[dict],
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
    domains = Counter(a.get("author") for a in articles)
    clusters: dict[str, list[dict]] = {}
    for article in articles:
        clusters.setdefault(title_key(article.get("title") or ""), []).append(article)
    repeated = sorted(
        [items for items in clusters.values() if len(items) > 1],
        key=lambda items: (sum(safe_int(a.get("engagement")) for a in items), len(items)),
        reverse=True,
    )
    lines = [
        f"# Native X Articles — {niche} — {started_at.strftime('%Y-%m-%d')}",
        "",
        "## TL;DR",
        "",
        f"Stored **{len(articles)} native X Articles** from **{all_tweets} searched tweets** since `{cutoff.isoformat()}`.",
        f"Search mode: **{search_mode}**.",
        "Freshness rule: Article and author baseline posts must be at least **4 hours old**.",
        "",
        "| rank | X Article | author | X signal | score | views/followers | vs author avg | next action |",
        "|---:|---|---|---:|---:|---:|---:|---|",
    ]
    for idx, a in enumerate(articles[:25], 1):
        title = (a.get("title") or a.get("article_url") or "").replace("|", "\\|")
        lines.append(
            f"| {idx} | [{title}]({a.get('article_url') or a.get('tweet_url')}) | [@{a.get('author')}](https://x.com/{a.get('author')}) | {safe_int(a.get('engagement'))} eng / {safe_int(a.get('views'))} views / {a.get('engagement_per_1k_views', 0)} eng per 1k views | {float(a.get('score') or 0):.1f} | {a.get('views_per_1k_followers', 0)} per 1k | {a.get('views_vs_author_avg', 0)}x | Read and extract pattern (~5 min) |"
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
        "- Views/followers = Article views per 1,000 creator followers.",
        "- Vs author avg = Article views divided by the creator's average views over their previous 10 mature posts.",
        "- Final rows are sorted by author-average lift, then follower-normalized reach, then raw score.",
        "- Mature post = at least 4 hours old, so brand-new posts do not drag down the creator average.",
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
            best = max(items, key=lambda a: float(a.get("score") or 0))
            total_eng = sum(safe_int(a.get("engagement")) for a in items)
            title = (best.get("title") or "").replace("|", "\\|")
            lines.append(
                f"| [{title}]({best.get('article_url') or best.get('tweet_url')}) | {len(items)} | {total_eng} | [@{best.get('author')}](https://x.com/{best.get('author')}) | Audit duplicate accounts (~5 min) |"
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
        if not author:
            continue
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
    # >1M-view Articles are spread across the full search depth, not front-loaded.
    # Latest is the better net (it surfaced the 47M-view max on page 6). Paginate it
    # far deeper than the Top/ladder families, which thin out fast.
    parser.add_argument("--latest-pages", type=int, default=12)
    parser.add_argument("--budget-usd", type=float, default=25.0)
    parser.add_argument("--search-mode", choices=("regressive-likes", "keyword", "both"), default="both")
    parser.add_argument("--like-thresholds", default="5000,2000,1000,500,250,100,50,20,10")
    parser.add_argument("--max-articles", type=int, default=20)
    parser.add_argument("--min-article-age-hours", type=int, default=4)
    parser.add_argument("--author-min-age-hours", type=int, default=4)
    parser.add_argument("--reuse-raw", action="store_true")
    args = parser.parse_args()

    started_at = utc_now()
    cutoff = started_at - timedelta(hours=args.lookback_hours)
    mature_article_cutoff = started_at - timedelta(hours=args.min_article_age_hours)
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
        pages = args.latest_pages if qtype == "Latest" else args.pages
        print(f"\n### {label} [{qtype}] x{pages}p {query}", file=sys.stderr)
        source = raw_search(label, pages, raw_dir) if args.reuse_raw else metered_search(query, qtype, pages, label, raw_dir)
        if args.reuse_raw:
            print(f"  ↳ RAW REUSE {label}: {len(source)} tweets", file=sys.stderr)
        all_tweets += len(source)
        for tweet in source:
            tweet_id = str(tweet.get("id") or "")
            if not tweet_id or tweet_id in seen_tweets:
                continue
            seen_tweets.add(tweet_id)
            created = parse_x_date(tweet.get("createdAt") or "")
            if not created or created < cutoff or created > mature_article_cutoff:
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

    # Final cut: top by like-weighted score, UNIONED with the top by raw views.
    # Views and likes diverge hard on announcement-style Articles (29M views can
    # carry 3k likes); a score-only cut silently drops the view giants.
    by_score = sorted(by_title.values(), key=lambda a: (a.score, a.engagement, a.views), reverse=True)
    by_views = sorted(by_title.values(), key=lambda a: (a.views, a.score), reverse=True)
    view_slots = max(1, args.max_articles // 5)
    chosen: dict[str, NativeArticle] = {}
    for a in by_views[:view_slots]:
        chosen[a.tweet_id] = a
    for a in by_score:
        if len(chosen) >= args.max_articles:
            break
        chosen.setdefault(a.tweet_id, a)
    articles = sorted(chosen.values(), key=lambda a: (a.score, a.engagement, a.views), reverse=True)
    rows = []
    for article in articles:
        row = asdict(article)
        row["engagement"] = article.engagement
        row["weighted_engagement"] = article.weighted_engagement
        row["engagement_per_1k_views"] = article.engagement_per_1k_views
        row["score"] = article.score
        row.update(enrich_outlier_metrics(article, raw_dir, args.reuse_raw, args.author_min_age_hours, started_at))
        rows.append(row)
    rows.sort(
        key=lambda row: (
            float(row.get("views_vs_author_avg") or 0),
            float(row.get("views_per_1k_followers") or 0),
            float(row.get("score") or 0),
        ),
        reverse=True,
    )

    write_jsonl(out_dir / "articles.jsonl", rows)
    write_jsonl(out_dir / f"articles-{started_at.strftime('%Y%m%dT%H%M%SZ')}.jsonl", rows)

    balance_after = twapi.total_credits()
    report = report_md(rows, all_tweets, started_at, cutoff, args.niche, balance_before, balance_after, queries, args.search_mode)
    (out_dir / "report.md").write_text(report)

    print(json.dumps({
        "date": args.date,
        "niche": args.niche,
        "out_dir": str(out_dir),
        "tweets": all_tweets,
        "native_x_articles": len(articles),
        "top": rows[0] if rows else None,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
