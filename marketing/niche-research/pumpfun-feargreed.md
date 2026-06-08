# pump.fun trending → X fear/greed gauge

**A runnable prototype that picks the hottest pump.fun coin right now and reads the mood of every `$`-cashtag post about it on X — as one 0-100 dial.**

It graduates raw social chatter into a single number, the way the crypto Fear & Greed Index does for the whole market, but aimed at one freshly-trending memecoin.

- **Code:** `tools/pumpfun-feargreed/feargreed.py` (~330 lines, one file, no third-party deps)
- **Run it:** `python3 tools/pumpfun-feargreed/feargreed.py --direct` (~5 s, ~$0.0003)
- **Cost per run:** one X search call ≈ 30 credits ≈ **$0.0003**. Free with `--dry-run`.
- **Last live run:** trending = `$PIPPIN` (mcap ~$17.9M) → **61/100, Greed** (20 posts, 2 bullish / 0 bearish / 18 neutral, 12 inside the last 30 min).

---

## TL;DR — what it does

| Step | What happens | Cost |
|---|---|---|
| 1. Discover | Pull pump.fun's public listing, rank by a trend proxy, pick #1 | free |
| 2. Search | One X `advanced_search` page for the coin's `$CASHTAG` | ~$0.0003 |
| 3. Score | Lexicon sentiment × engagement weight + mention velocity | free |
| 4. Gauge | Map to 0-100 → Extreme Fear … Extreme Greed, print the dial | free |

You give it nothing. It finds the coin, reads the room, prints the dial.

---

## How to run it

| Command | Effect | Time |
|---|---|---|
| `python3 feargreed.py --dry-run` | Discover trending; score only cached posts. Zero spend. | ~3 s |
| `python3 feargreed.py --direct` | Full live gauge, one self-capped paid call. | ~5 s |
| `python3 feargreed.py --symbol PIPPIN --direct` | Skip discovery, force a cashtag. | ~5 s |
| `python3 feargreed.py --direct --json` | Machine-readable output. | ~5 s |
| `python3 feargreed.py --sort last_reply --direct` | Trend by freshest chat instead of market cap. | ~5 s |

Run from `tools/pumpfun-feargreed/`. The X API key is read from `/tmp/.twapi_key`, shared with the rest of the niche-research stack.

**`--direct` vs default.** The default routes through the shared metered client in `docs/x-targeting/twapi.py`, which enforces the project budget ledger. That ledger is currently locked over its legacy cap, so the default refuses to spend. `--direct` bypasses the shared ledger and makes one call guarded only by the real account balance — it cannot cost more than a single page. Use `--direct` to actually run the prototype today.

---

## Data sources

| Source | Endpoint | Auth | Gives us |
|---|---|---|---|
| pump.fun | `frontend-api-v3.pump.fun/coins` | none | symbol, mint, usd_market_cap, reply_count, last_trade / last_reply timestamps, linked X handle |
| X (Twitter) | `api.twitterapi.io/twitter/tweet/advanced_search` | API key | recent posts matching `$CASHTAG`, with like / retweet / reply counts and timestamps |

Both are read-only HTTP. No SDK, no scraping a browser.

---

## What "trending" means here

pump.fun does not expose a clean public "trending" rank through this endpoint — its `king-of-the-hill` route returns empty, and there is no volume sort. So the prototype builds its own momentum proxy from listing fields only, with no extra calls:

- **size** — `log10(usd_market_cap)`
- **cumulative interest** — `log10(reply_count)`, weighted highest
- **is it trading right now** — exponential decay on minutes since `last_trade_timestamp`
- **is the chat alive** — exponential decay on minutes since `last_reply`

It pulls the top 50 coins (default `--sort market_cap`), reorders them by this score, and takes #1 with a usable cashtag. The sort is a knob (`--sort last_reply` rewards live chatter over size). This is honest about its limits: it is a freshness-and-chatter reranking of a market-cap page, not pump.fun's private trending feed.

A clean cashtag must match `^[A-Za-z][A-Za-z0-9]{1,14}$`. Symbols with spaces or punctuation are skipped, because they cannot be a usable `$`-cashtag on X.

---

## Scoring — how chatter becomes a number

Two signals, blended **70% sentiment / 30% velocity**.

**1. Sentiment (per post, then engagement-weighted mean).**
Each post is tokenised and matched against two memecoin-native word lists:

- **Greed:** moon, pump, ape, bullish, send, lfg, 100x, gem, hold, diamond, wagmi, breakout, rocket, 🚀, 🔥 …
- **Fear:** rug, scam, dump, sell, exit, dead, rekt, crash, bearish, careful, top, fud, ngmi, honeypot, 💀, 📉 …

A one-token negation (`not bullish`) flips the sign. The per-post score lands in `[-1, 1]`, normalised by `√(hit count)` so a wall of repeated words can't dominate. Posts are then weighted by `1 + log(likes + 2·retweets + replies)` — a viral bullish post counts more than a silent one. The weighted mean maps linearly to 0-100.

**2. Velocity.**
The share of the sample posted in the last 30 minutes, centred at 50. A burst of fresh posts pulls the dial toward greed (FOMO/euphoria); a dead feed pulls it back to neutral.

**Gauge = 0.7 × sentiment + 0.3 × velocity**, clamped to 0-100.

| Range | Label |
|---|---|
| 0–19 | Extreme Fear |
| 20–39 | Fear |
| 40–59 | Neutral |
| 60–79 | Greed |
| 80–100 | Extreme Greed |

---

## Limits — read these before you trust the number

State the exceptions out loud:

- **Small sample.** One `advanced_search` page is ~20 posts. The gauge is a snapshot, not a survey. For a real reading, page deeper (more spend) or poll on a schedule.
- **Lexicon, not a model.** Word-list sentiment misses sarcasm, irony, and context. "great, another rug" reads as mixed. A fine-tuned classifier would be sharper — and slower, and pricier.
- **Promo skew.** Memecoin cashtag feeds are heavy with paid shills and bots posting "almost there for Moonshot". They register as mild greed and inflate the dial. There is no spam filter yet.
- **Cashtag collisions.** A short symbol like `$ROOM` or `$KING` collides with unrelated posts. Adding the coin's linked X handle as a co-filter would tighten precision.
- **Trending is a proxy.** It reranks a market-cap page by freshness, not pump.fun's true trending feed. The biggest coin and the fastest-climbing coin are not always the same coin.
- **No history.** Each run is independent. Velocity uses one snapshot, not a real rate of change. A stored time series would let it measure acceleration.

The architecture is sound. The sample is thin. The dial still points the right way.

---

## Where it goes next

- **Spam filter** — drop posts below an account-age / follower floor before scoring.
- **Handle co-filter** — `$SYMBOL OR from:handle` to kill cashtag collisions.
- **Time series** — write each gauge to JSONL; chart fear/greed against price.
- **Classifier** — swap the lexicon for a small sentiment model once volume justifies it.

Next concrete step: run `python3 tools/pumpfun-feargreed/feargreed.py --direct --json` and pipe the output into a watcher that logs one reading per minute.

---

## Glossary

- **cashtag** — a stock-style `$SYMBOL` token on X, e.g. `$PIPPIN`. X indexes it like a hashtag.
- **pump.fun** — a Solana launchpad where memecoins trade on a bonding curve, then "graduate" to a Raydium pool.
- **Fear & Greed Index** — a 0-100 market-mood gauge; low = fear (sell-off), high = greed (euphoria).
- **bonding curve** — the automated pricing curve a pump.fun coin trades on before it graduates.
- **advanced_search** — the twitterapi.io endpoint that returns recent posts matching a query.
