# Native X Articles — hip3-30d — 2026-06-10

## TL;DR

Stored **9 native X Articles** from **700 searched tweets** since `2026-05-11T02:26:20.017239+00:00`.
Search mode: **both**.
Freshness rule: Article and author baseline posts must be at least **4 hours old**.

| rank | X Article | author | X signal | score | views/followers | vs author avg | next action |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | [Markets.xyz: Hyperliquid at your fingertips ](https://x.com/i/article/2058142575555416064) | [@PDmytriiev](https://x.com/PDmytriiev) | 108 eng / 11282 views / 9.573 eng per 1k views | 127.8 | 11126.233 per 1k | 9.683x | Read and extract pattern (~5 min) |
| 2 | [Hyperliquid Through a TradFi Lens: Weekend Markets, Builder Codes, and Transparent Rules](https://x.com/i/article/2057781060952363008) | [@HyperliquidR](https://x.com/HyperliquidR) | 270 eng / 42011 views / 6.427 eng per 1k views | 333.0 | 12065.192 per 1k | 1.991x | Read and extract pattern (~5 min) |
| 3 | [Trading on Autopilot: Virtuals Agents, Hyperliquid Perps, and HIP-3 Markets](https://x.com/i/article/2064002005404934144) | [@virtuals_io](https://x.com/virtuals_io) | 338 eng / 17956 views / 18.824 eng per 1k views | 378.0 | 62.166 per 1k | 1.006x | Read and extract pattern (~5 min) |
| 4 | [HIP-3: Tesla, oro y el S&P 500 on-chain](https://x.com/i/article/2053423770539294722) | [@Hyperliquid_ES](https://x.com/Hyperliquid_ES) | 45 eng / 2241 views / 20.08 eng per 1k views | 55.7 | 1957.205 per 1k | 0.921x | Read and extract pattern (~5 min) |
| 5 | [Hyperliquid Defies Market Downturn as SpaceX, Anthropic, OpenAI IPOs Loom](https://x.com/i/article/2056431943068024832) | [@MyriadMarkets](https://x.com/MyriadMarkets) | 40 eng / 2626 views / 15.232 eng per 1k views | 50.9 | 30.289 per 1k | 0.77x | Read and extract pattern (~5 min) |
| 6 | [SEDA - Hyperliquid's Hidden Infrastructure Layer](https://x.com/i/article/2058560220746399744) | [@ZanaVentures](https://x.com/ZanaVentures) | 98 eng / 5002 views / 19.592 eng per 1k views | 117.7 | 1773.13 per 1k | 0.313x | Read and extract pattern (~5 min) |
| 7 | [The Drivers Behind Hyperliquid’s Next Phase: HYPE ETFs, HIP-4 Outcome Markets, Priority Fees, and it](https://x.com/i/article/2057565419712679936) | [@FalconXGlobal](https://x.com/FalconXGlobal) | 21 eng / 1083 views / 19.391 eng per 1k views | 25.4 | 78.15 per 1k | 0.207x | Read and extract pattern (~5 min) |
| 8 | [New Category Of Onchain Markets](https://x.com/i/article/1929879329636270080) | [@gizmolab_](https://x.com/gizmolab_) | 6 eng / 187 views / 32.086 eng per 1k views | 7.1 | 147.593 per 1k | 0.066x | Read and extract pattern (~5 min) |
| 9 | [Why I Bought $PUMP](https://x.com/i/article/2063679804969570304) | [@munji33](https://x.com/munji33) | 28 eng / 3513 views / 7.97 eng per 1k views | 31.2 | 2253.368 per 1k | 0.008x | Read and extract pattern (~5 min) |

## Ranking Rule

- Native X Article = tweet payload has non-null `article` metadata.
- Regressive likes mode searches broad native X Articles from high `min_faves` thresholds downward, then applies niche classification locally.
- Distinct Article = normalized title; if several URLs share the same title, the highest-scoring copy is kept.
- Engagement = likes + retweets + replies + quotes + bookmarks.
- Score = weighted engagement + capped views bonus.
- Views/followers = Article views per 1,000 creator followers.
- Vs author avg = Article views divided by the creator's average views over their previous 10 mature posts.
- Final rows are sorted by author-average lift, then follower-normalized reach, then raw score.
- Mature post = at least 4 hours old, so brand-new posts do not drag down the creator average.
- Weighted engagement gives retweets and quotes 2x weight because they distribute the article.

Therefore: this report ranks native X Articles inside the searched niche surface, not external links.

## Repeated Title Clusters

These are likely coordinated reposts or duplicate-native Articles. Treat the cluster as one campaign, then inspect each Article ID separately.

| cluster | copies | total engagement | best author | next action |
|---|---:|---:|---|---|
| None | 0 | 0 | - | No duplicate-title campaign found |

## Query Families

| label | type | query |
|---|---|---|
| `rt-gte-500` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_retweets:500 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `rt-gte-500-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_retweets:500 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `rt-gte-200` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_retweets:200 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `rt-gte-200-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_retweets:200 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `rt-gte-100` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_retweets:100 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `rt-gte-100-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_retweets:100 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-5000` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:5000 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-5000-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:5000 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-2000` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:2000 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-2000-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:2000 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-1000` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:1000 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-1000-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:1000 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-500` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:500 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-500-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:500 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-250` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:250 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-250-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:250 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-100` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:100 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-100-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:100 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-50` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:50 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-25` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:25 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-10` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:10 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-5` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:5 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-2` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:2 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `likes-gte-1` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_faves:1 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `replies-gte-2000` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_replies:2000 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `replies-gte-500` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_replies:500 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `replies-gte-100` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_replies:100 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `replies-gte-25` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "deployer auction") min_replies:25 url:x.com/i/article since:2026-05-11 -is:retweet` |
| `broad-native-top` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "permissionless perp" OR "deployer auction") (Hyperliquid OR HyperCore OR perp OR perps OR market) url:x.com/i/article since:2026-05-11 -is:retweet` |
| `keyword-native-top` | `Top` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "permissionless perp" OR "deployer auction") (Hyperliquid OR HyperCore OR perp OR perps OR market) url:x.com/i/article since:2026-05-11 -is:retweet min_faves:5` |
| `keyword-native-latest` | `Latest` | `(HIP-3 OR HIP3 OR "builder deployed" OR "builder-deployed" OR "permissionless perp" OR "deployer auction") (Hyperliquid OR HyperCore OR perp OR perps OR market) url:x.com/i/article since:2026-05-11 -is:retweet` |

## Author Map

| author | native Articles found |
|---|---:|
| [@PDmytriiev](https://x.com/PDmytriiev) | 1 |
| [@HyperliquidR](https://x.com/HyperliquidR) | 1 |
| [@virtuals_io](https://x.com/virtuals_io) | 1 |
| [@Hyperliquid_ES](https://x.com/Hyperliquid_ES) | 1 |
| [@MyriadMarkets](https://x.com/MyriadMarkets) | 1 |
| [@ZanaVentures](https://x.com/ZanaVentures) | 1 |
| [@FalconXGlobal](https://x.com/FalconXGlobal) | 1 |
| [@gizmolab_](https://x.com/gizmolab_) | 1 |
| [@munji33](https://x.com/munji33) | 1 |

## Spend

- Balance before: `9084714` credits.
- Balance after: `9084714` credits.
- Apparent spend: `0` credits = `$0.0000`.

Exception: twitterapi.io balance can lag per call; use the global ledger for settled accounting.
