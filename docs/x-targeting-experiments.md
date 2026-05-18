# X Targeting — Experiment Log

Companion to `x-targeting-criteria.md`. Records what we tried, what it cost, what came back, what it taught us. Goal: a vetted list of ~50 MM devs, quants, and bot devs for advertising on X.

Seed account: [@ThalexGlobal](https://x.com/ThalexGlobal) — institutional crypto options exchange. Audience is exactly the cohort.

---

## Tooling — May 2026

| Tool | Auth | Cost | Notes |
|---|---|---|---|
| Apify `api-ninja/x-twitter-advanced-search` | Token | $0.015 / result FREE, $0.00035 paid; $0.01 start | 50+ filters. Works on FREE tier. Delivers real data. |
| Apify `apidojo/twitter-user-scraper` | Token | $0.0004/result + event fees (no tier surcharge) | **Soft-blocks FREE tier with `{"demo": true}` payload.** Author paywall. Skip on free plan. |
| Apify `apidojo/tweet-scraper` | Token | $0.04 FREE, $0.0004 paid (100× tier penalty) | Skip on free tier. |
| TwitterAPI.io | API key | $0.15/1k tweets, $0.18/1k profiles, $0.01/1k followers tiered | Cheaper per-unit at scale. No FREE-tier penalty. Not used yet — Apify free credit first. |

**Free plan budget**: $5 / month. As of run start: $1.83 consumed (5 runs across Q0 calibration + Q1–Q4).

---

## Strategy A — Tweet content search (api-ninja, surgical jargon)

**Hypothesis**: Tweets containing operator-specific phrases will surface real practitioners.

**Queries** (`search_type: Top`, `engagementMinLikes: 3–5`, `numberOfTweets: 25`, `contentLanguage: en`):

| ID | Query (collapsed) | Cost | Tweets | Real practitioners |
|---|---|---|---|---|
| Q0 calibration | `"market maker" OR "market making" crypto OR perps min_faves:20` | $0.325 | 25 | ~2 / 25 — `min_faves` ignored when in query string |
| Q1 | `"our market making" OR "our MM bot" OR "we market make" OR "running an MM" OR "my MM bot" OR "our quoter"` | $0.355 | 23 | ~3 / 19 unique (`@flowdesk_co`, `@ArdorBG`, `@strikeperps`) |
| Q2 | `"vol surface" OR "delta hedge" OR "gamma exposure" OR "short gamma" OR "options flow" OR "variance swap"` + crypto/BTC/ETH/perps | $0.385 | 25 | ~3 / 16 (`@Han_Akamatsu`, `@laevitas1`, `@fiddybps1`/Paradex) |
| Q3 | `"my arb bot" OR "funding arb" OR "perp basis" OR "latency arb" OR "JIT liquidity" OR "my searcher"` | $0.385 | 25 | ~2 / 20 (`@vooi_io`, `@Autonomous_Chad`) |
| Q4 | `"market making on" OR "providing liquidity" OR "maker rebate"` + Polymarket/Kalshi/Deribit/Hyperliquid | $0.385 | 25 | ~2 / 20 (`@PolymarketDevs`, `@Outcomexyz`) |

**Cost**: $1.84 total. **Yield**: ~10 real practitioners out of ~80 unique authors. **SNR ≈ 12%.**

**Conclusion — REJECTED as primary strategy.**

Operator vocabulary attracts the wrong crowd:
- Project marketing accounts using the terms in pitch copy
- KOLs and content explainers
- Generic crypto traders who name-drop jargon

Real quants and MM devs:
- Post infrequently
- Use shorthand, not the full phrase ("vol" not "vol surface", "gamma" without "exposure")
- Have low engagement on their technical tweets (no `min_faves` filter helps)
- Often tweet in threads or replies, not as standalone discoveries

Tweet-content keyword search produces 10–15% SNR. Not viable for a 50-account list at the budget available.

### Salvaged candidates (Strategy A)

Pre-triage — needs the 5-minute audit before promotion to Inner/Middle:

| Handle | Followers | Bio fragment | Why kept |
|---|---|---|---|
| `@flowdesk_co` | 10,026 | Full-service digital asset trading and tech firm | Real MM firm |
| `@Han_Akamatsu` | 61,353 | Independent Technical Market Analyst, gamma exposure, dealer positioning | Real quant content |
| `@laevitas1` | 25,002 | Crypto options analytics | Adjacent, high quality |
| `@fiddybps1` | 27,371 | Paradex / Paradigm founder | Adjacent operator |
| `@ArdorBG` | 194 | Provides a market making system | Too small but on-niche |
| `@Autonomous_Chad` | 8,235 | Quant @ ZEITFinance, prediction markets | Real quant |
| `@vooi_io` | 183,004 | Funding arb perp aggregator | Product, not person |
| `@PolymarketDevs` | 22,163 | Polymarket dev team | Org account |
| `@strikeperps` | 10,897 | Onchain perps | Project |
| `@sz8ng` | 1,850 | Programming magic money @strikeperps | Real dev |

---

## Strategy B — Reply harvesting from seed accounts

**Hypothesis**: Repliers to high-signal accounts are operators, not promoters.

**Method**: `api-ninja/x-twitter-advanced-search` with `usersToUsers: [seed]`. Authors of replies = candidates.

### Seed quality varies wildly — the headline finding

| Seed | Follower count | SNR | Notes |
|---|---|---|---|
| `@DeribitOfficial` | mega (~500k) | ~5% | Reply-bot magnet. Repliers are spam/KOL noise. **Skip mega accounts.** |
| `@flowdesk_co` | ~10k | ~15% | Brand account — replies are marketing-adjacent. |
| `@laevitas1` | ~25k | ~15% | Niche but low engagement → small reply pool. |
| `@fiddybps1` | ~27k | ~15% | Paradex founder, attracts general crypto crowd. |
| `@paradex` | ~45k | ~30% | Has a real quant community (Live Quant Workshop = 51 replies). Mid-tier brand best. |
| `@ThalexGlobal` | ~50k | ~50% | Institutional MM bent. Repliers include real options/HFT operators. |
| **`@minus1_12`** | ~1.7k | **~70%** | **Thalex founder personal account.** Highest SNR seed. Repliers are dealer-positioning, vol, illiquid-strategies analysts. |

**Rule**: Personal accounts of insiders > mid-size brands > mega brands. The smaller the seed, the higher the practitioner concentration.

### Results

| Run | Seed (`usersToUsers`) | Cost | Tweets | Unique repliers | Real practitioners |
|---|---|---|---|---|---|
| B1 | `ThalexGlobal` | $0.385 | 25 | 16 | ~8 |
| B2 | `DeribitOfficial` | $0.385 | 25 | 15 | ~1 |
| B3 | `flowdesk_co` | $0.385 | 25 | 12 | ~2 |
| B4 | `laevitas1` | $0.385 | 25 | 14 | ~2 |
| B5 | `from: 5 seeds + min_replies: 3` | $0.385 | 25 | seed posts only | (used to discover @paradex as a quality seed) |
| B6 | `paradex` | $0.385 | 25 | 17 | ~5 |
| B7 | `minus1_12` | $0.385 | 25 | 15 | ~10 |
| B8 | `fiddybps1` | $0.385 | 25 | 14 | ~2 |

**Cost**: $3.08 total. **Yield**: ~30 real practitioners on top of Strategy A.

---

## Strategy C — Following-list expansion (DEFERRED)

Apify budget exhausted ($4.98 / $5). `apidojo/twitter-user-scraper` returns demo data on FREE — would need:
- TwitterAPI.io: ~$0.18 for Thalex's full Following list. Best option.
- New Apify cycle next month with `automation-lab/twitter-scraper`.
- Manual scroll of `@ThalexGlobal/following` — free, ~20 min.

Recommended follow-up: TwitterAPI.io with `Get User Followings` on `[ThalexGlobal, minus1_12, paradex, flowdesk_co, laevitas1]`. Dedupe across all 5 — accounts followed by 3+ seeds are near-guaranteed real practitioners.

---

## Master takeaways

1. **Tweet-keyword search ≠ user discovery.** Operator vocabulary attracts marketers using the same terms in pitch copy. SNR ~12%. Use only for last-mile sweep.
2. **Reply harvesting from personal accounts works.** Best SNR ~70% (Thalex founder). Mega brand accounts (Deribit) are reply-spam landfills.
3. **The smaller the seed, the cleaner the signal.** Inverse correlation with follower count for SNR.
4. **`api-ninja/x-twitter-advanced-search` works on FREE Apify tier; `apidojo/*` actors don't.** Author paywall.
5. **`min_faves` operator must be in the structured `engagementMinLikes` field, not the query string.**
6. **$5 of Apify FREE credit gets you ~13 queries of 25 tweets each.** Enough to discover ~50 candidates from a niche.

---

## Running ledger

| Date | Strategy | Cost | Yield | Notes |
|---|---|---|---|---|
| 2026-05-18 | A — keyword search ×5 (calibration + Q1-Q4) | $1.84 | ~10 practitioners / 80 authors (12% SNR) | Wrong angle |
| 2026-05-18 | B — reply harvest ×8 seeds | $3.08 | ~30 additional practitioners / 90 authors (33% SNR) | Right angle |
| **Total** | — | **$4.98 / $5.00** | **~40 strong candidates, 140 raw, list to 50** | Budget consumed |

Final scored list: [`x-targeting/final-50.tsv`](x-targeting/final-50.tsv).
Raw candidates: [`x-targeting/candidates.tsv`](x-targeting/candidates.tsv).
Scoring script: [`x-targeting/score.py`](x-targeting/score.py).
Raw runs (JSON): [`x-targeting/runs/`](x-targeting/runs/).

---

## Local cache — `x-targeting/cache/`

Every fetch must go through `cache.py` so we never re-pay for the same query.

| File | Contents | Key |
|---|---|---|
| `cache/profiles.jsonl` | One row per handle | `screen_name` (last-write-wins) |
| `cache/tweets.jsonl` | One row per tweet | `tweet_id` (dedup) |
| `cache/queries.jsonl` | Append-only log of every API call | `params_hash` (SHA-256 of actor + sorted params) |

Backfilled from existing 14 runs: **218 profiles, 323 tweets**.

### Commands

```bash
# Check if we already have a handle (no API spend)
python3 cache.py have Bluedeerc

# Run an Apify actor with cache-aware fetch (skip if same params fetched <14d ago)
APIFY_TOKEN=$(cat /tmp/.apify_token) python3 cache.py fetch \
  api-ninja/x-twitter-advanced-search /tmp/query.json

# Rebuild cache from runs/ (idempotent)
python3 cache.py backfill

# Status
python3 cache.py status
```

### TTL policy

Default 14 days. Profile data ages slowly (followers change weekly at most for accounts >1k), tweet data is immutable once captured. Re-fetch the same query only when the question is genuinely "what's *new* in this niche."

### What this prevents

- Paying twice for `replies to @ThalexGlobal` if I forget I already ran it.
- Manually grepping 14 JSONs to find one handle.
- Re-deriving the candidate list from scratch every session.
