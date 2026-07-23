# Native X Articles — polymarket — 2026-06-10

## TL;DR

Stored **0 native X Articles** from **0 searched tweets** since `2026-06-09T10:50:59.959837+00:00`.
Search mode: **both**.
Freshness rule: Article and author baseline posts must be at least **4 hours old**.

| rank | X Article | author | X signal | score | views/followers | vs author avg | next action |
|---:|---|---|---:|---:|---:|---:|---|

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
| `rt-gte-500` | `Top` | `min_retweets:500 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `rt-gte-500-latest` | `Latest` | `min_retweets:500 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `rt-gte-200` | `Top` | `min_retweets:200 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `rt-gte-200-latest` | `Latest` | `min_retweets:200 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `rt-gte-100` | `Top` | `min_retweets:100 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `rt-gte-100-latest` | `Latest` | `min_retweets:100 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-5000` | `Top` | `min_faves:5000 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-5000-latest` | `Latest` | `min_faves:5000 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-2000` | `Top` | `min_faves:2000 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-2000-latest` | `Latest` | `min_faves:2000 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-1000` | `Top` | `min_faves:1000 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-1000-latest` | `Latest` | `min_faves:1000 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-500` | `Top` | `min_faves:500 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-500-latest` | `Latest` | `min_faves:500 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-250` | `Top` | `min_faves:250 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-250-latest` | `Latest` | `min_faves:250 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-100` | `Top` | `min_faves:100 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-100-latest` | `Latest` | `min_faves:100 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-50` | `Top` | `min_faves:50 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-20` | `Top` | `min_faves:20 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `likes-gte-10` | `Top` | `min_faves:10 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `replies-gte-2000` | `Top` | `min_replies:2000 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `replies-gte-500` | `Top` | `min_replies:500 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `replies-gte-100` | `Top` | `min_replies:100 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `replies-gte-25` | `Top` | `min_replies:25 url:x.com/i/article since:2026-06-09 -is:retweet` |
| `x-pm-bot` | `Top` | `(Polymarket) (bot OR bots OR agent OR automated OR strategy OR quant OR copy OR formula OR 跟单 OR 数学) url:x.com/i/article since:2026-06-09 -is:retweet` |
| `x-pm-bot-latest` | `Latest` | `(Polymarket) (bot OR bots OR agent OR automated OR strategy OR quant OR copy OR formula OR 跟单 OR 数学) url:x.com/i/article since:2026-06-09 -is:retweet` |
| `x-pm-copy` | `Top` | `("polymarket bot" OR "polymarket strategy" OR "polymarket copy" OR "polymarket trader" OR "polymarket whale") url:x.com/i/article since:2026-06-09 -is:retweet` |
| `x-pm-copy-latest` | `Latest` | `("polymarket bot" OR "polymarket strategy" OR "polymarket copy" OR "polymarket trader" OR "polymarket whale") url:x.com/i/article since:2026-06-09 -is:retweet` |
| `broad-native-top` | `Top` | `(Polymarket OR "poly market" OR "prediction market" OR "prediction markets" OR ポリマーケット) url:x.com/i/article since:2026-06-09 -is:retweet` |
| `keyword-native-top` | `Top` | `(Polymarket OR "poly market" OR "prediction market" OR "prediction markets" OR ポリマーケット) url:x.com/i/article since:2026-06-09 -is:retweet min_faves:5` |
| `keyword-native-latest` | `Latest` | `(Polymarket OR "poly market" OR "prediction market" OR "prediction markets" OR ポリマーケット) url:x.com/i/article since:2026-06-09 -is:retweet` |

## Author Map

| author | native Articles found |
|---|---:|

## Spend

- Balance before: `8246169` credits.
- Balance after: `8246169` credits.
- Apparent spend: `0` credits = `$0.0000`.

Exception: twitterapi.io balance can lag per call; use the global ledger for settled accounting.
