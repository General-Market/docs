# Inverse-Cramer for Vibe shorting — feasibility + candidate accounts

> **Vibe** = "PumpFun of perps" (@vibe_trading, 9.5k followers) — a permissionless perps DEX where any token lists with 20x leverage and you can go short. The marketing wedge: find X accounts whose **calls reliably go south**, then say *"short their call on Vibe — and look, it works."* This is the Inverse-Cramer ETF (SJIM) bet, ported to a perps venue.

## TL;DR — verdict: **PARTIAL feasible**

- **Retrieval of an account's historical calls: YES.** twitterapi.io pulls a full timeline cheaply and reliably. Proven — we already pulled **10,065 tweets** from @vibe_trading (759 originals + 9,306 replies) for ~$7.
- **Scoring whether a call "went south": NO from twitterapi.io alone.** There is no price, PnL, or outcome data in the API. You must add a second stage.
- **The naive shortcut — keyword-mining self-reported losses — does not work.** Tested on the 18,226-tweet cache: the loss vocabulary is swamped by false positives (liquidation-*heatmap* content, market commentary, and Korean `손절` which doubles as slang for *cutting off a friend*). Evidence below.
- **The working method is a two-stage pipeline:** twitterapi.io for retrieval (cheap, done), then a grading layer (LLM call-classifier + external price-grader) for outcomes.
- **Spend this task: $0.** The shared project budget is already $98 against a $15 cap, so `twapi.py` hard-blocks every metered call. All findings come from the existing cache. "Tiny spend" honored as zero spend.

## What twitterapi.io can and cannot do

| Need | Endpoint | Feasible | Cost (proven) |
|---|---|---|---|
| An account's full post history (the "calls") | `user/last_tweets` (paginated) | Yes | ~150 credits ($0.0015) per 20-tweet page |
| Targeted search for call-shaped posts | `tweet/advanced_search` `from:HANDLE $BTC long` | Yes | ~300 credits ($0.003) per page |
| Account size / audience filter | `user/info` | Yes | 18 credits ($0.0002) |
| Who an account replies to (reaction graph) | `inReplyToUserName` field, free in any tweet | Yes | $0 (byproduct) |
| **Did the call win or lose?** | — | **No** | external |
| **Entry / stop / target price the call named** | text only — must be parsed | Partial | LLM |

The retrieval half is solved and cheap. The outcome half lives outside the API. That gap is the whole story.

## The method — two stages

**Stage 1 — retrieve (twitterapi.io, ~$0.02 per account).**

```bash
cd docs/x-targeting
# 1. size gate — skip anyone too small to matter
python3 twapi.py userinfo HANDLE              # ~$0.0002
# 2. pull the call history (10 pages ≈ 200 tweets ≈ 3 months for an active caller)
python3 twapi.py lasttweets HANDLE --pages 10 # ~$0.015
# 3. OR target only call-shaped posts, cheaper for high-volume accounts
python3 twapi.py advsearch 'from:HANDLE ($BTC OR $ETH) (long OR short OR entry OR target)' --pages 3
```

**Stage 2 — grade (NOT twitterapi.io).** For each retrieved post, two sub-steps:

1. **Classify + parse** with an LLM: is this a directional *call*? Extract `{asset, direction, entry?, stop?, target?, horizon?, confidence-language}`. Discard market commentary, retweets, threads-about-mindset.
2. **Resolve the outcome** by one of:
   - **(a) Price-grader (gold standard).** Pull OHLC for the named asset from a market-data source (Binance/Coingecko klines) and score: did price hit target before stop within the horizon? Yields a true **hit-rate**. Cost: free API, ~1 day of glue code per asset class.
   - **(b) Self-report harvest (cheap, weak).** Search the same account's *later* posts for an admitted outcome on the same ticker. twitterapi.io carries these — but see the failure below.

**The inverse-Cramer target is the account that maximizes:** high call *volume* × low *hit-rate* × loud *confidence language* × real *audience*. A quiet honest loser is worthless; a loud confident one who is consistently wrong is the asset.

## Why the cheap shortcut fails — evidence

We ran the self-report keyword harvest over the full 18,226-tweet cache. It is too noisy to trust:

- **51 accounts** matched ≥3 "loss" keywords (`liquidated`, `stopped out`, `청산`, `清算`, …). Inspection shows most are **false positives**:
  - @nishi8malert, @cachetrading, @bitcoinsensus, @kingfisher_btc — every match is a **liquidation-heatmap analytics post**, not a personal loss. The word "liquidation" is their *product*, not their *wound*.
  - The Korean `손절` ("cut losses") is also everyday slang for **cutting off a friend**. @m00chi_ya, @giyommigirl, @leebori1011, @hanrorock, @mool_kkachi all matched on *relationship* posts with zero trading content.
- Tightening to **first-person** admission (`I got stopped out`, `溶かした`, `損切りした`) drops the population to **19 accounts** and surfaces a few genuine ones — but honest self-narration is the wrong signal for inverse-Cramer.

The lesson is plain. A word is not an outcome. You cannot read a trader's loss off a single tweet's vocabulary; you read it off the *price* the call named, or off a *classifier* that understands the sentence. Keyword scoring conflates the chart with the wound.

## Candidate accounts — what the cache yields (honestly)

**Caveat first.** This cache was mined for *perps-funding-arb* and *trenches* niches, not for retail TA callers. So the population is wrong: the heaviest "call-shaped" posters are **protocol accounts** (@lighter_xyz, @aevoxyz, @aster_dex, @pendle_fi), not gradeable individual callers. To find real inverse-Cramer targets you must run the targeted sweep below — that is the missing spend.

**Genuine first-person loss-admitters already in the cache** (useful as method-validation seeds, not yet graded for *call* accuracy):

| Handle | Followers | What they admit | Note |
|---|---:|---|---|
| @Gar_Fitz1 | 763 | "got stopped out of $HUMN… $MSFT… total account value $2,279" | clean English, with tickers — too small |
| @kiseki_okoru | 10,618 | "損切りした… 毎日地獄の追証" (margin-call hell) | confident entries → repeated losses, JP |
| @mad_dogdebt | 14,478 | "5억이 2억 된 사연… 손절하고 레버리지 들어갔다가" | debt-and-leverage loss narrator, KO |
| @WhitePeach | 17,820 | "거하게 물려있는 상태… 손절 고민" (deep underwater) | active leveraged caller, KO |
| @admi_alts | 46,148 | repeated late-entry/stop-out confessions | largest clean self-reporter, KO |

None is a finished target. They prove the *signal exists*; they are not yet scored for call hit-rate.

**To find the real targets — run this sweep (the missing ~$0.50 spend):**

```bash
# confident directional callers, English crypto, last 2 weeks, by language cell
python3 twapi.py advsearch '($BTC OR $ETH OR $SOL) (long OR "going long" OR "send it" OR "easy 2x" OR "100x") min_faves:50' --type Latest --pages 3 --cell inverse-en
python3 twapi.py advsearch '("this is the bottom" OR "buy the dip" OR "bottom is in") ($BTC OR $ETH) min_faves:100' --pages 3 --cell inverse-bottom
# then, per surfaced handle: lasttweets --pages 10, parse calls, price-grade
```

Rank the harvest by `calls × (1 − hit-rate) × followers`. The top of that list is the marketing proof set.

## Next step

1. **Rebase the budget** (`python3 twapi.py rebase` after a top-up) — the current $98/$15 state blocks all spend. (~1 min, owner action)
2. **Run the targeted sweep** above against a fresh credit balance (~$0.50, ~10 min).
3. **Build the price-grader** — Binance klines + the call parser — to convert harvested calls into hit-rates (~1 day).
4. Pick the 5 loudest, wrongest, most-followed. That is the Vibe "short their call" launch set.

The retrieval is solved. The grader is the build. Until it exists, you have suspects, not proof.

## Glossary

- **Inverse-Cramer** — the SJIM ETF strategy: take the *opposite* side of a pundit whose public calls reliably lose. Here, short the token a confident caller pumps.
- **Call** — a public, directional, gradeable statement: "long $BTC, target X, stop Y." Not commentary, not a heatmap, not a vibe.
- **Hit-rate** — fraction of an account's calls that reached target before stop within the stated horizon. The grade.
- **Self-report harvest** — mining an account's later posts for an admitted outcome. Cheap, noisy, rejected as a primary signal.
- **Price-grader** — external OHLC lookup that scores a call against what actually happened. The reliable outcome source.
- **`twapi.py`** — the repo's metered twitterapi.io wrapper (`docs/x-targeting/twapi.py`); every call is balance-accounted and budget-capped.
