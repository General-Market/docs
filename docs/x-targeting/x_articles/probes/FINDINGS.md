# X Article search probes — findings

**Date:** 2026-06-09. Window probed: `since:2026-05-10` (30 days). 19 metered calls, <= $0.89 total (shared balance with the running batch; probe-only cost lower). Raw pages in `probes/raw/`, one-line-per-probe ledger in `probes/log.md`.

**TL;DR.** `min_views:` and `filter:article(s)` do not exist — both degrade into keyword junk. The two real unlocks are (1) a **min_retweets ladder** and (2) the **Latest surface at a faves floor**, which returns an almost entirely different article set than Top (6/59 overlap). Together with the existing likes ladder they tripled distinct >=1M-view articles found (54 distinct). Hyperliquid has **zero** >=1M-view native articles in the last 30 days — proven four ways, ceiling 354k.

---

## 1. Verdict per hypothesis

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| H1 | `min_views:1000000` | **FAILED — treated as plain text** | Returned 19 tweets, 0 articles, max 5,283 views; results were tweets *talking about* view counts ("the tweet reached half a million views"). The whole query degraded — even `url:x.com/i/article` stopped binding. Control (`min_faves:2000`, same window) returned 17/20 articles, max 30.8M. |
| H2 | `filter:article` / `filter:articles` | **FAILED — ignored** | Both returned 20 tweets, 0 with an `article` object, junk view ranges (max 702k / 63k for a min_faves:2000 query that should max ~30M). `url:x.com/i/article` remains the only article selector. |
| H3 | `min_retweets` ladder | **WORKED — best generic operator** | `min_retweets:500` Top, 2 pages: 25 articles, **18 >=1M**, max 30.8M. `min_retweets:200`: 30 articles, 16 >=1M. Per-page 1M-yield (~9/page) beats the likes ladder control (`min_faves:2000`: 14 >=1M on page 1, decays on later pages — the Huawei failure shape). |
| H4 | `min_replies` ladder | **PARTIAL — works but weak** | `min_replies:200` Top, 2 pages: 36 articles but only 7 >=1M, max 2.68M. Replies select for controversy, not reach. Not worth dedicated rungs. |
| H5 | Niche keywords + best operator | **WORKED for AI and crypto; Hyperliquid empty** | AI + `min_faves:1000` **Latest**: 16 >=1M in 2 pages, max 6.3M. AI + `min_retweets:200` Top: 9 >=1M. Crypto + `min_retweets:100` Top: 3 >=1M, max 1.9M ("Why I Sold My ETH"). Crypto + `min_faves:300` Latest: 3 >=1M, incl. saylor "The Four Ideologies of Bitcoin" 1.56M. Hyperliquid: see section 4. |
| H6 | Top vs Latest divergence; `quoted_tweet_id:` | **WORKED — Latest is a second, near-disjoint surface** | Same query (`min_faves:1000 url:x.com/i/article`) on Top vs Latest: 25 vs 40 articles, **overlap only 6**. Top: 15 >=1M; Latest: 8 >=1M — different ones. `quoted_tweet_id:<id>` works exactly (20/20 returned tweets quote the target) but needs the article id first → amplification audits, not discovery. |

## 2. Unlocked query families, ranked by >=1M-view yield

| Rank | Family | Exact query | queryType | >=1M yield (2 pages) |
|---|---|---|---|---|
| 1 | RT ladder, platform | `min_retweets:500 url:x.com/i/article since:<D> -is:retweet` | Top | 18 |
| 2 | RT ladder, lower rung | `min_retweets:200 url:x.com/i/article since:<D> -is:retweet` | Top | 16 |
| 3 | AI niche, Latest faves | `(AI OR LLM OR agent OR GPT OR Claude OR Gemini OR "scaling law" OR semiconductor OR chip OR model) min_faves:1000 url:x.com/i/article since:<D> -is:retweet` | **Latest** | 16 (~7 truly AI; classifier filters bleed-through) |
| 4 | Faves floor, Top (existing family, control) | `url:x.com/i/article min_faves:1000 since:<D> -is:retweet` | Top | 15 |
| 5 | AI niche, RT | `(AI OR LLM OR ...) min_retweets:200 url:x.com/i/article since:<D> -is:retweet` | Top | 9 |
| 6 | Faves floor, **Latest** (new surface, 6/59 overlap with Top) | `url:x.com/i/article min_faves:1000 since:<D> -is:retweet` | Latest | 8 |
| 7 | Crypto niche, Latest faves | `(crypto OR bitcoin OR ethereum OR DeFi OR perp OR token OR stablecoin) min_faves:300 url:x.com/i/article since:<D> -is:retweet` | Latest | 3 |
| 8 | Crypto niche, RT | `(crypto OR bitcoin OR ...) min_retweets:100 url:x.com/i/article since:<D> -is:retweet` | Top | 3 |

Requirement met: >=2 distinct families each with >=3 articles >=1M; AI covered (families 3, 5), crypto covered (families 7, 8).

## 3. Top 15 articles >=1M views (54 distinct found across all probes)

| Views | Likes | Author | Title | Niche guess | Found by |
|---|---|---|---|---|---|
| 30,858,135 | 66,431 | b_kansou | 嵐『P・A・R・A・D・O・X』… | JP music/culture | rt500, rt200, faves2000 |
| 21,667,090 | 25,243 | natsui_tanoshi | 田舎の葬式に出たら… | JP essay | rt200, faves2000 |
| 20,518,389 | 32,386 | sunset_hk1 | 横浜線の駅名全部本気でバカにするわ | JP humor | rt500 only |
| 13,478,392 | 12,975 | jun_online_ | 涼森れむが語る… | JP adult | rt500, faves2000 |
| 8,848,320 | 7,615 | shimodamisaki | 「夫婦だから一緒にやる」… | JP lifestyle | rt200, faves1000-top |
| 8,771,163 | 16,423 | idx2718 | 超ドパガキが好きな音楽紹介 | JP music | rt500, faves2000 |
| 8,689,509 | 13,055 | MAMAAAAU | ハイスペ専業主婦ですが… | JP fiction | rt200/500, faves1000-top |
| 8,257,066 | 21,738 | fuku_tokumei | 蓮見、やめてくれ。 | JP culture | rt200/500, faves2000 |
| 7,874,393 | 38,137 | 99JKBADjOv14711 | 付き合ってはいけない300B | JP dating | rt500 only |
| 6,319,493 | 2,400 | ozaken_AI | 母が亡くなって、今思うこと | JP essay (keyword bleed) | ai-faves1000-latest only |
| 6,144,777 | 1,538 | DamiDefi | SpaceX IPOs in 7 days. I Fed the S1 Doc Into Claude... | **AI/finance** | ai-faves1000-latest, ai-rt200 |
| 5,349,725 | 6,236 | akshay_pachaar | Hermes Agent Masterclass | **AI** | faves1000-top only |
| 4,812,861 | 7,819 | farstep_ | テーブルに状態を持たせてはいけない | dev/engineering | rt500, faves1000-top |
| 2,896,454 | 10,021 | trq212 | A harness for every task: dynamic workflows in Claude Code | **AI** | faves2000, ai-faves1000-latest |
| 2,838,959 | 2,103 | zooko | The Orchard Counterfeiting Vulnerability — and next steps | **crypto** | ai-faves1000-latest |

Niche highlights below the top 15: mvanhorn "WTF Is a Loop? Peter Steinberger vs. Boris Cherny" 2.83M (AI), TrustlessState "Why I Sold My ETH" 1.91M (crypto), saylor "The Four Ideologies of Bitcoin" 1.56M (crypto), wallstreetbets "Why $PENGU is the Next $DOGE" 1.25M (crypto), DataRepublican "ORG CHART EXPOSED..." 1.26M (politics/data). Note the view-rich/like-poor pattern the likes ladder buries: DamiDefi 6.1M views on 1,538 likes — surfaced by **Latest + min_faves:1000** and **min_retweets:200**, exactly the operators the pipeline lacks.

## 4. Hyperliquid: zero >=1M-view articles in 30 days — proven

Four independent pulls, all `(Hyperliquid OR HyperEVM OR $HYPE OR HIP-3)` scoped unless noted:

- Latest, 4 pages, no engagement floor: **80 article tweets, max 25,277 views**.
- Top + `min_faves:100`, 2 pages: 36 articles, **max 354,614** (nativemarkets, "A new era for Hyperliquid stablecoins" — USDH).
- Top + `min_retweets:20`, 2 pages: 5 articles, max 49,805.
- `Hyperliquid min_faves:500`: zero matching articles (query degraded to junk — the no-match signature).

The niche ceiling is ~354k views. Therefore: for Hyperliquid, drop the bar to ~100k or rank by relative outlier score instead.

## 5. Integration advice for find_native_x_articles.py

1. **Add a min_retweets rung set** (~10 min). In `likes_ladder_queries`, emit a parallel rung list `min_retweets:{500,200,100}` (niche-scoped via the same `likes_prefix`). It out-yields the likes ladder per page at the top end and catches RT-heavy/like-poor giants. Keep `-is:retweet` — it does not conflict.
2. **Run every rung on BOTH queryTypes** (~5 min). Duplicate each `(label, query, "Top")` tuple with `"Latest"`. Measured overlap at the same floor is 6/59 — Latest is effectively a second index, and it surfaced the 6.1M-view DamiDefi article that Top buried. This is the single highest-yield change.
3. **Do not add `min_views:` or `filter:article(s)`** — both are unsupported and poison the whole query into keyword junk (0 articles returned). Guard against ever emitting them.
4. **Add a junk-page detector** (~10 min). When a query has no real matches, the API returns ~20 unrelated tweets with 0 `article` objects instead of an empty page (seen on `Hyperliquid min_faves:500`). Treat `n_articles == 0 && n > 0` as "no matches", not coverage — stop the rung.
5. **min_replies: skip.** 7 >=1M in 2 pages vs 16-18 for retweets; selects controversy, not reach.
6. **Hyperliquid threshold** (~2 min). Niche ceiling is 354k views/30d. Set a per-niche `min_views_qualify` (HL ~50-100k) or rank by `views_vs_author_avg` instead of an absolute floor.
7. **`quoted_tweet_id:<id>`** works exactly — optional enrichment to measure amplification of an already-found article; useless for discovery.

## Glossary

- **Native X Article** — tweet whose payload carries a non-null `article` object; only findable via `url:x.com/i/article`.
- **Top / Latest** — twitterapi.io advanced_search ranking surfaces; relevance-ranked vs reverse-chronological. Near-disjoint result sets at the same floor.
- **Rung / ladder** — one threshold step in a descending engagement-floor query sequence.
