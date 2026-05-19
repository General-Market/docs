#!/usr/bin/env python3
"""Run the full 5-phase audit on a handle. Use the local cache; fall through to TwAPI only when needed.

Phase 1 is discovery and lives outside this script (it's about *which seeds you query*, not audit).
Phases 2–5 run here.

Usage:
  audit.py HANDLE              audit one
  audit.py --list FILE         audit each handle in FILE (one per line)
  audit.py --inner             audit the 9 Inner candidates from final-50.tsv
"""
from __future__ import annotations
import json
import re
import sys
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
CACHE = ROOT / "cache"
PROFILES = CACHE / "profiles.jsonl"
TWEETS = CACHE / "tweets.jsonl"


# ---- Phase 2: bio score (from score.py, lifted) ----------------------------

KEEP = [
    (r"\bquant(s|itative)?\b", 3),
    (r"\b(market\s*making|market\s*maker|MM\s*bot|MM\s*firm)\b", 4),
    (r"\b(HFT|high[- ]frequency)\b", 4),
    (r"\b(vol(atility)?\s*(surface|trader|st|trading)|delta\s*hedge|gamma\s*(exposure|positioning)|dealer\s*positioning|theta|vanna|charm)\b", 3),
    (r"\b(derivs?|derivatives?)\b", 2),
    (r"\b(options?\s+(trader|trading|analyst|surface|flow|veteran))\b", 3),
    (r"\b(MEV|searcher|arb(itrage)?\s*bot|funding\s*arb|perp\s*basis|latency\s*arb|JIT\s*liquidity)\b", 3),
    (r"\b(bot\s*dev|algo\s*(trader|trading|dev)|trading\s*bots?|build.{0,15}bots?|build.{0,15}trading)\b", 3),
    (r"\b(data\s*analyst|physicist|risk\s*analyst|illiquid\s*strateg|risk\s*calc)\b", 2),
    (r"\b(paradex|thalex|deribit|laevitas|flowdesk|hyperliquid|GSR|wintermute|jane\s*street|jump|cumberland)\b", 2),
    (r"\b(prediction\s*market(s)?\s*(quant|trader|analyst|researcher))\b", 3),
    (r"\b(institutional[- ]grade|research|analyst)\b", 1),
    (r"\b(hedge\s*fund)\b", 2),
]

DROP = [
    (r"\b(KOL|kol)\b", -4),
    (r"\bDM\s*(for|me|open|always)\s*(promo|marketing|inquir|business|collab|prom)", -4),
    (r"\b(growth\s*(strateg|manager|expert)|marketing\s*(strateg|manager))\b", -3),
    (r"\b(content\s*(creator|writer|manager))\b", -3),
    (r"\b(community\s*manager|brand\s*ambassador)\b", -3),
    (r"\b(creator\s*campaigns?|affiliate\s*program)\b", -3),
    (r"\b(memecoin|memes?\s*lover|$SOL\s*HOLDER|$XRP)\b", -3),
    (r"\b(daily\s*alpha|alpha\s*(hunter|caller)|narrative)\b", -3),
    (r"\b(faith\s*&\s*finance|believer)\b", -3),
    (r"\b(sponsored|commissioned|paid\s*promotion)\b", -3),
    (r"\b(maxi|polymarket\s*maxi)\b", -3),
]


# ---------------------------------------------------------------------------
# NICHE KEYWORDS — broad-spectrum operator/builder vocabulary.
# Each group is a named bucket of multi-word phrases (single words only when unambiguous).
# Run `python3 audit.py --keywords` to print the full list.
# ---------------------------------------------------------------------------
NICHE_GROUPS: dict[str, list[str]] = {
    "MM operator language": [
        r"market[\s-]?mak(ing|er)", r"MM[\s-](bot|firm|trader|desk|operator|game)",
        r"\bmake\s*market(s)?\b", r"\bprovide\s*liquidity\b",
        r"\binventory\s*risk\b", r"\badverse\s*selection\b", r"\btoxic\s*flow\b",
        r"\binternaliz(e|ation)\b",  # "internalize flow"
        r"\bquot(e|ing)\s*(engine|spread|surface)\b",
        r"\btwo[\s-]sided\s*(quote|market)\b",
    ],
    "HFT / latency": [
        r"\bHFT\b", r"\bhigh[\s-]frequency\b", r"\blow[\s-]latency\b",
        r"\bco[\s-]location|colo\b", r"\btick[\s-]to[\s-]trade\b",
        r"\bnanosecond|microsecond\b",
    ],
    "Quant / research": [
        r"\bquant(s|itative)?\b", r"\bquant\s*(research|trader|dev|firm|fund|desk)\b",
        r"\bsystematic\s*(trading|strategy)\b", r"\bsignal\s*generation\b",
        r"\balpha\s*(signal|decay|capture|factor|model|gen(eration)?)\b",
        r"\bfactor\s*model\b", r"\bSharpe(\s*ratio)?\b", r"\bmax\s*drawdown\b",
        r"\bKelly\s*criterion\b", r"\binformation\s*ratio\b", r"\bSortino\b",
        r"\bmean\s*reversion\b", r"\bmomentum\s*(strategy|signal)\b",
        r"\bcointegrat(ion|ed)\b", r"\bregime\s*(switching|change)\b",
    ],
    "Bot dev / engineering": [
        r"\b(trading|MM|arb|execution|sniper|grid|DCA|sandwich|MEV|liquidation)\s*bot\b",
        r"\bbot\s*(dev(eloper)?|builder|operator|maker)\b",
        r"\balgo[\s-](trader|trading|dev|bot|engine|stack|book)\b",
        r"\bexecution\s*(algo|engine|venue|trader|model)\b",
        r"\bsmart\s*order\s*router|SOR\b", r"\bOMS\b|\border\s*management\b",
        r"\bFIX\s*(engine|protocol|connectivity)\b",
        r"\b(REST|WebSocket|gRPC)\s*(API|feed|stream)\b",
        r"\bexchange\s*(API|connectivity|adapter)\b",
        r"\b(TWAP|VWAP|POV|Iceberg|peg)\s*(execution|algo|order|strategy)\b",
        r"\bbacktest(ing|er|s)?\b", r"\bwalk[\s-]forward\s*(test|optim)\b",
        r"\b(tick|level\s*[12]|L[12]|orderbook|trade\s*tape)\s*(data|feed)\b",
        # Frameworks/libs/platforms
        r"\bccxt\b", r"\bhummingbot\b", r"\bfreqtrade\b", r"\bjesse\s*trade\b",
        r"\bnautilus[\s-]?trader\b", r"\bbacktrader\b", r"\bzipline\b", r"\bvectorbt\b",
        r"\bquant(connect|opian|lib|lopian)\b", r"\blean\s*engine\b",
        r"\bMetaTrader|MT[45]\b", r"\bNinjaTrader\b", r"\bSierraChart\b", r"\bBookmap\b",
        r"\bamibroker\b", r"\bTradingView\s*(strategy|script|pine)\b",
        r"\b(Rust|Python|Go|C\+\+|Cython|Julia)\s*(trading|MM|HFT|algo|quant)\b",
        # Crypto-specific bot devs
        r"\b(solana|EVM|Ethereum|Aptos|Sui)\s*(bot|trader|dev|searcher)\b",
        r"\b(jito|flashbots|MEV-share|propeller|merkle\.io|builder0x69)\b",
    ],
    "Quant statistics / models": [
        r"\b(Bayesian|frequentist|MLE|MAP)\s*(estimat|inference|model)\b",
        r"\bMonte\s*Carlo\b", r"\bMarkov\s*(chain|model)\b", r"\bKalman\s*filter\b",
        r"\bBlack[\s-]Scholes\b", r"\bMerton\s*model\b", r"\bHeston\s*model\b",
        r"\bSABR\s*model\b", r"\bjump[\s-]diffusion\b",
        r"\b(GARCH|EGARCH|ARIMA|HMM|GBM|SDE|PDE)\b",
        r"\bstochastic\s*(vol|process|diff)\b", r"\bBrownian\s*motion\b",
        r"\b(cointegrat|Granger)\b", r"\b(ARMA|VAR|GMM)\s*model\b",
        r"\b(pairs|stat)\s*arb\b", r"\bmarket\s*neutral\b", r"\bcarry\s*trade\b",
    ],
    "Trading desk language": [
        r"\b(prop|proprietary)\s*(trader|trading|desk|shop|firm)\b",
        r"\bbuy[\s-]side|sell[\s-]side\b",
        r"\bRFQ\s*(desk|flow|trading)?\b", r"\bOTC\s*(desk|trader|trading|flow)\b",
        r"\bblock\s*(trade|trader|trading|liquidity)\b",
        r"\bdelta[\s-]one\s*(desk|trader|trading)\b",
        r"\b(equity|options|futures|FX|rates|credit|commodities)\s*(trader|desk|MM)\b",
        r"\b(principal|agency)\s*(trader|trading)\b",
        r"\binternaliz(e|ation)\s*(order|flow)?\b", r"\bPFOF\b",
    ],
    "Risk / position management": [
        r"\bposition\s*(sizing|management|limit)\b",
        r"\bleverage\b", r"\bde[\s-]?leverag(e|ing)\b",
        r"\btail\s*(risk|hedge|exposure)\b",
        r"\bcrash\s*hedg(e|ing)\b",
        r"\bstress\s*test(ing)?\b", r"\bscenario\s*analysis\b",
        r"\b(EaR|VaR|CVaR|expected\s*shortfall|ETL)\b",
        r"\bcorrelation\s*(matrix|breakdown|regime)\b",
    ],
    "Options trading": [
        r"\boptions?\s+(trading|trader|vol|flow|surface|veteran|premium|seller|buyer|expir(y|ation)|chain|writer|maker)\b",
        r"\bcall\s*(spread|option|side|wing)\b", r"\bput\s*(spread|option|side|wing)\b",
        r"\bcovered\s*call|cash[\s-]secured\s*put|wheel\s*strategy\b",
        r"\b(straddle|strangle|butterfly|iron\s*condor|calendar\s*spread|ratio\s*spread|risk\s*reversal)\b",
        r"\b0DTE\b", r"\bweeklies\b",
    ],
    "Volatility": [
        r"\b(implied|realized|forward|short[\s-]dated|long[\s-]dated)\s*vol(atility)?\b",
        r"\bvol\s*(arb|crush|surface|trader|st|seller|selling|buying|buyer|targeting|cone|smile|premium)\b",
        r"\b(sell|sold|selling|buy|bought|buying|trade|trading|hedge|hedging|short|shorting|long)\s+vol\b",  # verb-vol order
        r"\bvariance\s*swap\b", r"\bVIX\s*(term|curve|future|level)\b",
        r"\bbasis\s*trade|cash[\s-]and[\s-]carry\b",
    ],
    "Greeks / hedging": [
        r"\bdelta\s*(hedg|neutral|one|exposure)\b",
        r"\bgamma\s*(exposure|positioning|scalping|squeeze|flip|hedge)\b",
        r"\b(short|long)\s*(gamma|vega|theta|delta)\b",
        r"\bdealer\s*positioning\b", r"\bGEX\b", r"\bcharm\s*flow\b",
        r"\bvanna(\s|$)\b", r"\bskew\s*(term|surface|smile|curve)\b",
        r"\bpin\s*risk\b", r"\bcrowded\s*greek\b",
    ],
    "MEV / arb / DEX mechanics": [
        r"\bMEV\b", r"\b(MEV\s*)?searcher\b",
        r"\b(arb|arbitrage)\s*(bot|opportunit|edge)\b",
        r"\b(funding|cross[\s-]exchange|basis|stat|triangular|atomic|latency|swap|cyclic)\s*arb\b",
        r"\bperp\s*(basis|funding|spread)\b",
        r"\bJIT\s*liquidity\b", r"\bsandwich\s*(attack|bot)\b",
        r"\bdex[\s-]cex\s*arb\b", r"\bback[\s-]running\b",
        r"\bflash\s*loan\b", r"\bbundle\s*(submit|building)\b",
        r"\b(jito|jitoSOL|flashbots|bloXroute|propeller\s*heads|merkle\.io|relay)\b",
    ],
    "Order book / microstructure": [
        r"\border\s*book\s*(depth|imbalance|reconstruction)\b",
        r"\bbid[\s-]ask\s*spread\b", r"\bmaker\s*rebate\b", r"\btaker\s*fee\b",
        r"\bLOB\b", r"\blimit\s*order\s*book\b",
        r"\bmarket\s*microstructure\b", r"\border\s*flow\b",
        r"\bsweep[\s-]to[\s-]fill\b", r"\biceberg\s*order\b", r"\bhidden\s*liquidity\b",
        r"\b(tight|wide)\s*spreads?\b", r"\bfill\s*(rate|quality)\b",
        r"\bsmart\s*order\s*routing\b", r"\bdark\s*pool\b",
    ],
    "Perp / futures mechanics": [
        r"\bperp(etual)?\s*(DEX|swap|future|funding|basis)\b",
        r"\bopen\s*interest|\bOI\s*(spike|change|build)\b",
        r"\bmark\s*price|index\s*price\b",
        r"\bfunding\s*(rate|payment|skew)\b",
        r"\bauto[\s-]deleverag(ing|e)|ADL\b",
        r"\binsurance\s*fund\b",
    ],
    "Liquidation analytics": [
        r"\bliquidation\s*(map|level|cascade|heatmap|cluster)\b",
        r"\bauction\s*(price|engine)\b",
    ],
    "DeFi MM specifics": [
        r"\b(Uniswap\s*V[23]|concentrated\s*liquidity|CLMM|CFMM)\b",
        r"\bLP\s*(position|range|fee|reward)\b", r"\bliquidity\s*provider\b",
        r"\bAMM|constant\s*product\b", r"\bDEX\s*aggregator\b",
        r"\brebalanc(e|ing)\b", r"\bjust[\s-]in[\s-]time\s*liquidity\b",
        r"\bimpermanent\s*loss|IL\s*hedge\b",
    ],
    "Trading venues (institutional)": [
        r"\b(paradex|thalex|deribit|laevitas|flowdesk|hyperliquid)\b",
        r"\b(dydx|drift\.trade|lighter\.xyz|aevo|gmx|aster|jupiter\s*perps)\b",
        r"\b(paradigm|wintermute|GSR|jane\s*street|cumberland|jump\s*trading|optiver|akuna|tower\s*research)\b",
        r"\b(coincall|deribit|bit\.com|ledgerx)\b",
    ],
    "Prediction markets (multi-word, not bare 'polymarket')": [
        r"\bprediction\s*market\s*(maker|making|MM|quant|trader|liquidity)\b",
        r"\bsealed\s*bet\b", r"\bparimutuel\s*pool\b", r"\bvision\s*batch\b",
    ],
    "Risk / PnL": [
        r"\bPn?L\b", r"\bP&L\b", r"\brisk[\s-](adjusted|parity|reward)\b",
        r"\b(VaR|value[\s-]at[\s-]risk|CVaR|expected\s*shortfall)\b",
        r"\bportfolio\s*(rebalanc|optim|construct|alloc)\b",
        r"\bdrawdown\b", r"\bedge\s*(decay|capture)\b",
    ],
    "TA charting (require pairing)": [
        r"\b(HMA|EMA|SMA|VWAP|RSI|MACD|Bollinger|ATR|ADX)\s*(ribbon|cross|chart|signal|envelope|band|crossover|divergence)\b",
        r"\bR\s*/\s*R\b", r"\brisk[\s-]reward\b",
        r"\btrade\s*(setup|entry|exit|plan)\b",
        r"\bswing\s*(long|short|trade|entry|setup)\b",
        r"\bbreakout\s*(level|trade|setup)\b",
    ],
    "Execution language": [
        r"\bstop[\s-]loss\b", r"\btake[\s-]profit\b",
        r"\bscalp(ing|er)?\b", r"\bsniper?(ing)?\s*bot\b",
        r"\b(GTC|IOC|FOK|post[\s-]only)\b",
    ],
}

# Build the master pattern: flatten all groups, alternate with |
_ALL_NICHE_PATTERNS = [p for patterns in NICHE_GROUPS.values() for p in patterns]
NICHE_PATTERN = "(?i)" + "|".join(f"(?:{p})" for p in _ALL_NICHE_PATTERNS)


# HARD REJECT — only the three platforms whose KOL ecosystems are off-target.
# Affiliates / promo codes / clickbait on OTHER platforms are fine.
BIO_HARD_REJECT = re.compile(
    r"\b("
    r"polymarket"
    r"|kalshi"
    r"|meteora"
    r"|jupiterexchange|jupiter\s*perps|jupiter\s*predict|jup\.ag"
    r"|jup_?predict|jupredict|poly_?matches|polymatches"   # Polymarket/Jupiter-adjacent affiliate platforms
    r"|zscdao|zcdao"         # Polymarket/Kalshi KOL community
    r")\b",
    re.IGNORECASE,
)


# TWEET-LEVEL KOL signal — count occurrences in last 10 tweets.
# Focus narrowly on Polymarket / Kalshi / Meteora affiliate behavior. >=3 hits = KOL.
TWEET_KOL_PATTERNS = re.compile(
    r"("
    # @-mentions of disqualifying platforms
    r"@polymarket\b|@kalshi\b|@meteora\b|@jupiterexchange\b"
    r"|@jup_?predict|@poly_?matches"
    # Bare platform names — if recurring in last 10 = KOL audience
    r"|\b(polymarket|kalshi|meteora)\b"
    r"|\b(jupiterexchange|jupiter\s*perps|jupiter\s*predict)\b"
    r"|\b(jup_?predict|poly_?matches|polymatches)\b"
    # Direct affiliate signals tied to these platforms
    r"|add\s+his\s+wallet\s*[:\[].*?(polymarket|kalshi|jupiter|meteora)"
    r"|track/copy.*?(polymarket|kalshi|jupiter|meteora)"
    r"|auto[\s-]mirror.*?(polymarket|kalshi|jupiter|meteora)"
    r")",
    re.IGNORECASE,
)


def fetch_pinned_tweet(handle: str, pinned_id: str) -> dict | None:
    """Fetch a single tweet by ID via twapi. Cheap (~15 credits)."""
    import subprocess
    import urllib.request
    token = open("/tmp/.twapi_key").read().strip()
    url = f"https://api.twitterapi.io/twitter/tweets?tweet_ids={pinned_id}"
    req = urllib.request.Request(url, headers={"X-API-Key": token})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = json.load(r)
    except Exception:
        return None
    tweets = body.get("tweets", [])
    return tweets[0] if tweets else None


def pinned_is_kol(handle: str, pinned_ids: list) -> tuple[bool, str]:
    """Check if pinned tweet shows KOL/affiliate pattern. Returns (is_kol, reason)."""
    if not pinned_ids:
        return False, "no-pinned"
    pinned = fetch_pinned_tweet(handle, pinned_ids[0])
    if not pinned:
        return False, "fetch-failed"
    text = pinned.get("text") or ""
    if TWEET_KOL_PATTERNS.search(text):
        m = TWEET_KOL_PATTERNS.search(text)
        return True, f"pinned-kol: '{m.group(0)[:40]}'"
    return False, "ok"


def score_bio(bio: str) -> tuple[int, list[str]]:
    if not bio:
        return -10, []
    s = 0
    hits = []
    for pat, w in KEEP + DROP:
        if re.search(pat, bio, re.IGNORECASE):
            s += w
            hits.append(pat[:25])
    return s, hits


# ---- cache helpers ---------------------------------------------------------

def load_jsonl(p):
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text().split("\n") if l.strip()]


def latest_profile(handle):
    found = None
    h = handle.lower()
    for r in load_jsonl(PROFILES):
        if (r.get("screen_name") or "").lower() == h:
            found = r
    return found


def cached_tweets(handle):
    h = handle.lower()
    return [t for t in load_jsonl(TWEETS) if (t.get("screen_name") or "").lower() == h]


def parse_date(s):
    try:
        return datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y")
    except Exception:
        pass
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


# ---- ensure cache populated via twapi -------------------------------------

PROFILE_TTL_DAYS = 14
TWEET_TTL_DAYS = 7  # activity check needs fresher data than profile data


def _profile_age_days(handle: str) -> int | None:
    p = latest_profile(handle)
    if not p:
        return None
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(p["last_seen"])).days
    except Exception:
        return None


def _latest_tweet_age_days(handle: str) -> int | None:
    """Days since the most recent CACHED tweet we have for this handle, by created_at."""
    ts = cached_tweets(handle)
    newest = None
    for t in ts:
        d = parse_date(t.get("created_at") or "")
        if d and (newest is None or d > newest):
            newest = d
    if newest is None:
        return None
    return (datetime.now(timezone.utc) - newest).days


def ensure_data(handle):
    """Fetch profile + tweets via twapi ONLY if cache is stale or missing.

    Profile freshness: profile data older than PROFILE_TTL_DAYS triggers re-fetch.
    Tweet freshness: latest cached tweet older than TWEET_TTL_DAYS triggers re-fetch,
    because the audit's 14d activity check is meaningless if our cached "last tweet"
    is itself older than 14d. We need ground truth that's <7d old.
    """
    p = latest_profile(handle)
    p_age = _profile_age_days(handle)
    if (p is None) or (p.get("statuses_count") in (None, 0)) or (p_age is not None and p_age > PROFILE_TTL_DAYS):
        subprocess.run(["python3", str(ROOT / "twapi.py"), "userinfo", handle],
                       check=False, capture_output=True)
    t = cached_tweets(handle)
    has_twapi = any(x.get("source_run", "").startswith("twapi-lasttweets") for x in t)
    t_age = _latest_tweet_age_days(handle)
    # Need fetch if: no twapi-sourced tweets, OR < 5 tweets, OR latest tweet older than TTL
    stale = (t_age is None) or (t_age > TWEET_TTL_DAYS)
    if (not has_twapi) or (len([x for x in t if x.get("source_run", "").startswith("twapi-lasttweets")]) < 5) or stale:
        subprocess.run(["python3", str(ROOT / "twapi.py"), "lasttweets", handle, "--count", "10"],
                       check=False, capture_output=True)


# ---- the audit ------------------------------------------------------------

def audit(handle: str) -> dict:
    handle = handle.lstrip("@")
    ensure_data(handle)
    p = latest_profile(handle)
    if not p:
        return {"handle": handle, "verdict": "FAIL", "reason": "no profile data"}

    bio = p.get("description") or ""
    bio_score, bio_hits = score_bio(bio)
    bio_hard_reject = bool(BIO_HARD_REJECT.search(bio))
    followers = p.get("followers_count") or 0
    friends = p.get("friends_count") or 0
    statuses = p.get("statuses_count") or 0
    ff = (friends / followers) if followers else -1
    created = parse_date(p.get("created_at") or "")
    age_days = ((datetime.now(timezone.utc) - created).days if created else -1)
    posts_per_day = (statuses / age_days) if age_days > 0 else -1
    verified = bool(p.get("verified")) or bool(p.get("verified_type"))
    has_url = bool(p.get("url"))
    has_loc = bool(p.get("location"))

    # Pull most recent tweets we have
    ts = sorted(cached_tweets(handle),
                key=lambda r: parse_date(r.get("created_at") or "") or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True)
    recent = ts[:10]
    latest_age = -1
    if recent:
        dt = parse_date(recent[0].get("created_at") or "")
        if dt:
            latest_age = (datetime.now(timezone.utc) - dt).days
    engagements = [int(t.get("favorites", 0) or 0) + int(t.get("retweets", 0) or 0)
                   + int(t.get("quotes", 0) or 0) for t in recent]
    engagements.sort()
    median_engage = engagements[len(engagements)//2] if engagements else 0
    has_reply_behavior = any((t.get("in_reply_to_screen_name") or t.get("type") == "reply") for t in recent)

    # View-based metrics — only valid for tweets >2h old (younger ones still accumulating)
    # Treat None/0 views as missing (don't include in median)
    views_list = [int(t.get("views") or 0) for t in recent if t.get("views")]
    views_list.sort()
    median_views = views_list[len(views_list)//2] if views_list else 0
    # Per-tweet engagement-rate = engage/views — measures content quality regardless of reach
    rates = []
    vf_ratios = []
    deep_shares = []  # active interaction (reply+RT+quote) share of total engagement
    for t in recent:
        v = int(t.get("views") or 0)
        if v <= 0:
            continue
        favs = int(t.get("favorites", 0) or 0)
        rts = int(t.get("retweets", 0) or 0)
        qts = int(t.get("quotes", 0) or 0)
        reps = int(t.get("replies", 0) or 0)
        e = favs + rts + qts + reps
        rates.append(e / v)
        if followers > 0:
            vf_ratios.append(v / followers)
        if e > 0:
            deep_shares.append((rts + qts + reps) / e)
    rates.sort(); vf_ratios.sort(); deep_shares.sort()
    median_engage_rate = rates[len(rates)//2] if rates else 0
    median_vf_ratio = vf_ratios[len(vf_ratios)//2] if vf_ratios else 0
    median_deep_share = deep_shares[len(deep_shares)//2] if deep_shares else 0
    # Outlier-resistant stats — drop top 2 (reply farm / viral) + bottom 1 from the engage list,
    # average the rest. This kills single-tweet inflation.
    if len(rates) >= 5:
        trimmed_engage_rate = sum(rates[1:-2]) / len(rates[1:-2])
    else:
        trimmed_engage_rate = median_engage_rate
    # Fraction of tweets above flat 2.5% (for diagnostic only)
    frac_above_25 = (sum(1 for r in rates if r >= 0.025) / len(rates)) if rates else 0

    # VIEW-SCALED engagement: a tweet at 3k views gets a higher bar than one at 1M views.
    # Engagement rate falls naturally with reach — algorithmic distribution to non-engaged users.
    # Each tweet is graded against the bar for its own view tier.
    def required_rate(views: int) -> float:
        if views < 1000:    return 0.025   # <1k views: 2.5%
        if views < 5000:    return 0.020   # 1k-5k:    2.0%
        if views < 20000:   return 0.012   # 5k-20k:   1.2%
        if views < 100000:  return 0.007   # 20k-100k: 0.7%
        if views < 500000:  return 0.004   # 100k-500k: 0.4%
        return 0.002                        # 500k+:    0.2%
    per_tweet_pass = []
    for t in recent:
        v = int(t.get("views") or 0)
        if v <= 0:
            continue
        e = int(t.get("favorites", 0) or 0) + int(t.get("retweets", 0) or 0) \
            + int(t.get("quotes", 0) or 0) + int(t.get("replies", 0) or 0)
        per_tweet_pass.append(1 if (e / v) >= required_rate(v) else 0)
    frac_tier_pass = (sum(per_tweet_pass) / len(per_tweet_pass)) if per_tweet_pass else 0

    # Niche regex — structured keyword groups. Multi-word jargon required for ambiguous terms.
    # Each group below is documented and grep-able. Print with `python3 audit.py --keywords`.
    niche_re = re.compile(NICHE_PATTERN)
    spam_re = re.compile(r"\b(DM\s*for|promo|kol|airdrop|giveaway|whitelist|join\s*the\s*tg|telegram\s*group|"
                          r"buy\s*\$\w+|pumping|moonshot)\b", re.IGNORECASE)
    niche_hits = sum(1 for t in recent if niche_re.search(t.get("text") or ""))
    spam_hits = sum(1 for t in recent if spam_re.search(t.get("text") or ""))
    # Tweet-level KOL/affiliate detection (counts tweets with KOL pattern in last 10)
    kol_tweet_hits = sum(1 for t in recent if TWEET_KOL_PATTERNS.search(t.get("text") or ""))

    # Niche engagement quality: do their NICHE tweets get any engagement?
    # Off-niche viral tweets shouldn't carry an account that doesn't post about our space.
    niche_engagements = [
        int(t.get("favorites", 0) or 0) + int(t.get("retweets", 0) or 0)
        + int(t.get("replies", 0) or 0) + int(t.get("quotes", 0) or 0)
        for t in recent if niche_re.search(t.get("text") or "")
    ]
    niche_engagement_sum = sum(niche_engagements)

    # Pinned-tweet check — KOLs pin their best paid-promo tweet
    pinned_ids = p.get("pinned_tweet_ids") or []
    pinned_kol, pinned_reason = pinned_is_kol(handle, pinned_ids)

    # Gates
    hard = []
    # HARD REJECT on bio: polymarket / zscdao / alpha caller / jup_predict — KOL ecosystem markers
    hard.append(("bio_not_kol",     not bio_hard_reject))
    # HARD REJECT on pinned tweet (affiliate / copy-trading / clickbait)
    hard.append(("pinned_not_kol",  not pinned_kol))
    # HARD REJECT on tweets: too many KOL/affiliate patterns in last 10 = paid promoter
    hard.append(("tweets_not_kol",  kol_tweet_hits <= 2))
    # bio_signal: passes if bio matches niche OR cross-source confirmed OR strong recent content
    # (institutional brands often have minimal bios — content carries the signal)
    hard.append(("bio_signal",      bio_score >= 1 or len(p.get("sources", [])) >= 2 or niche_hits >= 5))
    hard.append(("follower_band",   1000 <= followers <= 200_000))
    hard.append(("age>=1y",         age_days >= 365))
    hard.append(("active<=14d",     0 <= latest_age <= 14))
    hard.append(("cadence_0.5_30",  0.5 <= posts_per_day <= 30))
    hard.append(("no_spam_flood",   spam_hits <= 2))
    # Engagement consistency — at least 40% of tweets must clear the bar for their own view tier.
    # This is outlier-resistant AND view-scaled (a tweet at 3k views vs 1M views = different bars).
    hard.append(("engage_consistent", frac_tier_pass >= 0.4))
    # Niche fit on RECENT content (bio alone doesn't carry; account must
    # currently be posting about our space, not baguettes in Paris)
    hard.append(("niche_recent>=3", niche_hits >= 3))

    soft = []
    soft.append(("verified_or_identity",  verified or (has_url and has_loc)))
    soft.append(("reply_behavior",        has_reply_behavior))
    soft.append(("v/f>=0.3",              median_vf_ratio >= 0.3))
    soft.append(("deep_engage>=30%",      median_deep_share >= 0.3))
    soft.append(("niche_engage>0",        niche_engagement_sum > 0))
    soft.append(("active_followers",      followers >= 1000))

    hard_pass = all(v for _, v in hard)
    soft_pass_count = sum(1 for _, v in soft if v)

    # With 8 hard + 6 soft gates: hard must all pass, soft >= 4 of 6 for PASS
    if hard_pass and soft_pass_count >= 4:
        verdict = "PASS"
    elif hard_pass and soft_pass_count >= 3:
        verdict = "CONDITIONAL"
    else:
        verdict = "FAIL"

    return {
        "handle": handle,
        "verdict": verdict,
        "bio_score": bio_score,
        "followers": followers,
        "friends": friends,
        "ff_ratio": round(ff, 3) if ff >= 0 else None,
        "age_days": age_days,
        "statuses": statuses,
        "posts_per_day": round(posts_per_day, 2) if posts_per_day >= 0 else None,
        "verified": verified,
        "has_url": has_url,
        "has_loc": has_loc,
        "latest_tweet_age_days": latest_age,
        "median_engage_last10": median_engage,
        "median_views_last10": median_views,
        "median_vf_ratio": round(median_vf_ratio, 3),
        "median_engage_rate_pct": round(median_engage_rate * 100, 3),
        "trimmed_engage_rate_pct": round(trimmed_engage_rate * 100, 3),
        "frac_above_2.5_pct": round(frac_above_25 * 100, 1),
        "frac_tier_pass_pct": round(frac_tier_pass * 100, 1),
        "median_deep_share_pct": round(median_deep_share * 100, 1),
        "niche_hits_last10": niche_hits,
        "niche_engagement_sum": niche_engagement_sum,
        "spam_hits_last10": spam_hits,
        "kol_tweet_hits_last10": kol_tweet_hits,
        "pinned_kol": pinned_kol,
        "pinned_reason": pinned_reason,
        "reply_behavior": has_reply_behavior,
        "hard_gates": {k: v for k, v in hard},
        "soft_gates": {k: v for k, v in soft},
        "soft_pass_count": soft_pass_count,
        "reasons_failed": [k for k, v in hard if not v] + (
            [] if soft_pass_count >= 3 else [f"only {soft_pass_count}/4 soft"]
        ),
    }


def cmd_keywords():
    """Print all niche keywords grouped by category."""
    total = 0
    for group, patterns in NICHE_GROUPS.items():
        print(f"\n### {group} ({len(patterns)} patterns) ###")
        for p in patterns:
            print(f"  {p}")
            total += 1
    print(f"\n--- Total: {total} patterns across {len(NICHE_GROUPS)} groups ---")
    print("\nBio HARD-REJECT terms (automatic FAIL):")
    for line in BIO_HARD_REJECT.pattern.split("|"):
        print(f"  {line.strip()}")


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    if sys.argv[1] == "--keywords":
        cmd_keywords(); return
    if sys.argv[1] == "--list":
        handles = [l.strip().lstrip("@") for l in open(sys.argv[2]) if l.strip() and not l.startswith("#")]
    elif sys.argv[1] == "--inner":
        handles = ["Bluedeerc", "spxudi", "fabiocatalao_", "Han_Akamatsu",
                   "options_insight", "Autonomous_Chad", "TokensWolf",
                   "FvckYourHedge", "burningpremium"]
    else:
        handles = [sys.argv[1].lstrip("@")]
    results = [audit(h) for h in handles]
    for r in results:
        print(json.dumps(r, ensure_ascii=False))
    # Summary table
    print("\nhandle\tverdict\tfollowers\tff\tposts/d\tlatest\tniche/10\tmed_views\tV/F\tengage%\tsoft/6\tfailed",
          file=sys.stderr)
    for r in results:
        print(f"@{r['handle']}\t{r['verdict']}\t{r.get('followers')}\t{r.get('ff_ratio')}\t"
              f"{r.get('posts_per_day')}\t{r.get('latest_tweet_age_days')}d\t"
              f"{r.get('niche_hits_last10')}/10\t{r.get('median_views_last10')}\t"
              f"{r.get('median_vf_ratio')}\t{r.get('median_engage_rate_pct')}\t"
              f"{r.get('soft_pass_count')}/6\t"
              f"{','.join(r.get('reasons_failed', []))}", file=sys.stderr)


if __name__ == "__main__":
    main()
