| label | query | type | pages | n | n_articles | max_views | n_over_1M | note |
|---|---|---|---|---|---|---|---|---|
| h1-minviews | `min_views:1000000 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 1 | 19 | 0 | 0 | 0 |  |
| h1-control | `url:x.com/i/article since:2026-05-10 -is:retweet min_faves:2000` | Top | 1 | 20 | 17 | 30858127 | 14 |  |
| h2-filter-articles | `filter:articles since:2026-05-10 -is:retweet min_faves:2000` | Top | 1 | 20 | 0 | 0 | 0 |  |
| h2-filter-article | `filter:article since:2026-05-10 -is:retweet min_faves:2000` | Top | 1 | 20 | 0 | 0 | 0 |  |
| h3-rt500 | `min_retweets:500 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 2 | 40 | 25 | 30858135 | 18 |  |
| h3-rt200 | `min_retweets:200 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 2 | 33 | 30 | 30858135 | 16 |  |
| h4-rep200 | `min_replies:200 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 2 | 39 | 36 | 2680031 | 7 |  |
| h4-rep500 | `min_replies:500 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 1 | 19 | 5 | 2680031 | 4 |  |
| h5-ai-rt200 | `(AI OR LLM OR agent OR GPT OR Claude OR Gemini OR "scaling law" OR semiconductor OR chip OR model) min_retweets:200 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 2 | 33 | 33 | 6144760 | 9 |  |
| h5-crypto-rt100 | `(crypto OR bitcoin OR ethereum OR DeFi OR perp OR token OR stablecoin) min_retweets:100 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 2 | 36 | 34 | 1910963 | 3 |  |
| h5-hl-rt20 | `(Hyperliquid OR HyperEVM OR $HYPE OR HIP-3) min_retweets:20 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 2 | 40 | 5 | 49805 | 0 |  |
| h5-hl-deep-latest | `(Hyperliquid OR HyperEVM OR $HYPE OR HIP-3) url:x.com/i/article since:2026-05-10 -is:retweet` | Latest | 4 | 80 | 80 | 25277 | 0 |  |
| h5-hl-top-faves | `(Hyperliquid OR HyperEVM OR $HYPE OR HIP-3) min_faves:100 url:x.com/i/article since:2026-05-10 -is:retweet` | Top | 2 | 36 | 36 | 354614 | 0 |  |
| h5-hl-faves500 | `Hyperliquid url:x.com/i/article since:2026-05-10 -is:retweet min_faves:500` | Top | 1 | 20 | 0 | 0 | 0 |  |
| h6-faves1000-top | `url:x.com/i/article min_faves:1000 since:2026-05-10 -is:retweet` | Top | 2 | 40 | 25 | 8848320 | 15 |  |
| h6-faves1000-latest | `url:x.com/i/article min_faves:1000 since:2026-05-10 -is:retweet` | Latest | 2 | 40 | 40 | 5272665 | 8 |  |
| h6-quoted | `quoted_tweet_id:2061371523789951193` | Latest | 1 | 20 | 0 | 0 | 0 |  |
| h5-ai-faves1000-latest | `(AI OR LLM OR agent OR GPT OR Claude OR Gemini OR "scaling law" OR semiconductor OR chip OR model) min_faves:1000 url:x.com/i/article since:2026-05-10 -is:retweet` | Latest | 2 | 40 | 40 | 6319493 | 16 |  |
| h5-crypto-faves300-latest | `(crypto OR bitcoin OR ethereum OR DeFi OR perp OR token OR stablecoin) min_faves:300 url:x.com/i/article since:2026-05-10 -is:retweet` | Latest | 2 | 40 | 40 | 2827510 | 3 |  |
