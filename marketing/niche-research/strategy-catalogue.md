# Discovery Strategy Catalogue — what we have NOT yet run on twitterapi.io

## TL;DR

We have mined the niche from one direction only: **keyword search → harvest whole accounts**. That found the 227 repeatable desks in `outlier-pass-2.md`. It left three whole seams untouched.

| seam | what it finds | endpoint(s) unused | rough cost for a full pass |
|---|---|---|---:|
| **Engagement graph** | The accounts that reply to, quote, retweet, and challenge the desks we already found | `/tweet/replies`, `/tweet/quotes`, `/tweet/retweeters`, `/user/mentions` | ~$0.05–0.20 |
| **Curated lists** | Human-built rosters of perp/trenches desks — the niche pre-sorted by insiders | `/list/members`, `/list/tweets`, `/list/followers` | ~$0.02–0.10 |
| **Self-description** | Desks named by their own bio ("liquidation", "OI", "资金费率"), not by a viral tweet | `/user/search`, `/user/batch_info_by_ids` | ~$0.01–0.05 |
| **Live language signal** | What is trending in KR/JP/CN *right now* — fresh keywords to feed search | `/trends` | ~$0.001 |
| **Operators we never typed** | Tool-linkers, image risk-cards, thread skeletons, cadence proof | `advanced_search` (new operators) | ~$0.01–0.05 |

Therefore: the next pass is not more keyword search. It is turning the desks we already have into seeds for the graph, the list, and the bio.

**Total cost to run every strategy below once: ~$0.15–0.60.** Project spend to date is $1.45 of $15. Budget is not the constraint. Method is.

---

## What we have already run (the baseline)

So the gap is legible, here is the exhausted surface. Do not repeat it.

| strategy | endpoint | evidence |
|---|---|---|
| Keyword / phrase search | `/tweet/advanced_search` | 1,763 calls, 497 cached searches |
| Engagement-floor search (`min_faves:`) | `advanced_search` | 423 of 497 searches |
| Language-restricted search (`lang:ja/ko/zh`) | `advanced_search` | 393 of 497 searches |
| Date-windowed search (`since:`) | `advanced_search` | 466 of 497 searches |
| Whole-account harvest | `/user/last_tweets` | 620 calls |
| Activity probe (`from: since:`) | `advanced_search` | `cmd_probe` |
| Profile lookup | `/user/info` | 318 calls |
| Batch tweet fetch by ID | `/tweets` | 173 calls |
| Following graph | `/user/followings` | 38 calls |
| Follower graph | `/user/followers` | 10 calls |

Two facts fall out of this table. First, `min_faves:` and `lang:` are **not** new — do not propose them. Second, the follow graph is wired but barely fired (48 calls total) and was never pointed at the pass-2 outliers.

---

## Pricing model (for every cost figure below)

twitterapi.io bills credits; **100,000 credits = $1.00**. Roughly **15 credits ≈ $0.00015 per returned item** (one tweet, one user), confirmed against the ledger. A 20-item page costs ~$0.003. `user/info` is 18 credits ($0.00018). Follower/following/list/engagement endpoints bill per returned item like the follower endpoint.

All costs below are *order-of-magnitude*, not quotes. The minimum-per-request floor means tiny calls round up to ~$0.0003.

---

## Seam 1 — Engagement graph (strongest, entirely unused)

We already hold the winning posts: every `data_drop`, `numbered_list`, and `risk_card` example URL in `outlier-pass-2.md`. We never asked who engaged with them. The people arguing in the replies and adding charts in the quotes are the next layer of desks — and they are pre-filtered by having shown up under a proven post.

### 1a. Quote-tweeters of the winning data drops

- **Finds:** accounts that *add their own commentary* to a viral data drop — format-makers, not passive audience. The single best signal for "another desk like this one".
- **Method:** `GET /twitter/tweet/quotes?tweetId=<id>` for each example post in pass-2 (≈ 25 seed posts).
- **Expected signal:** 5–40 quoters per seed; the ones with their own `data_drop` history are new outliers.
- **Cost:** ~25 seeds × ~20 quoters × $0.00015 ≈ **$0.08**.

### 1b. Repliers under the winning posts (the reply-game cohort)

- **Finds:** smaller desks that post their *own* numbers in replies — exactly the "reply game → data article" loop the growth plan wants. Also sizes the engaged audience.
- **Method:** `GET /twitter/tweet/replies?tweetId=<id>`.
- **Expected signal:** noisier than quotes (more pure audience), but the repliers who themselves carry a numbered-rule cadence are gold. Filter by `statuses_count` band + bio.
- **Cost:** ~25 seeds × ~30 replies × $0.00015 ≈ **$0.11**.

### 1c. Retweeters — amplifier graph

- **Finds:** who *spreads* the data cards. Two uses: audience sizing per cell, and adjacent desks who retweet rather than compete.
- **Method:** `GET /twitter/tweet/retweeters?tweetId=<id>`.
- **Expected signal:** lower per-account value than quotes; high value as an audience-overlap map (which desks share a retweeter base = which cells truly cluster).
- **Cost:** cap at 100 per seed → ~**$0.04** for a sampled pass.

### 1d. Mentions of the known desks — the challenger map

- **Finds:** who talks *at* `@capy_onchain`, `@Nishi8mAlert`, `@ilpyung98` — peers, challengers, and the accounts the desk itself replies to.
- **Method:** `GET /twitter/user/mentions?userName=<handle>`.
- **Expected signal:** surfaces the conversational neighbourhood a follow-graph misses (people interact without following).
- **Cost:** ~15 top desks × one page ≈ **$0.05**.

Therefore: one viral post is not one data point. It is a doorway into every account standing next to it.

---

## Seam 2 — Curated lists (the niche pre-sorted by insiders)

A Twitter List named "perp degens" or "合约大佬" is a roster a native curator already built by hand. We have never read one. This is the highest signal-per-credit route because the human filtering is free.

### 2a. List members

- **Finds:** a clean roster of desks in one call — no keyword guessing, no false-positive `손절` trap.
- **Method:** `GET /twitter/list/members?listId=<id>`. Seed list IDs by reading the Lists that known desks own or are on (visible on profile; or search "list" + niche).
- **Expected signal:** 20–200 members per list; the curated ones beat any keyword sweep for precision.
- **Cost:** ~$0.00015/member → a 200-member list ≈ **$0.03**.

### 2b. List timeline harvest

- **Finds:** a ready-made stream of niche-native posts to run the format scorer over — cheaper than harvesting each member's `last_tweets` separately.
- **Method:** `GET /twitter/list/tweets?listId=<id>`.
- **Expected signal:** feed straight into `format_miner.py` / `motif_repeatability.py`; one list ≈ one cell's worth of fresh format evidence.
- **Cost:** ~$0.003 per 20-tweet page → **$0.01–0.03** per list.

### 2c. List followers (audience proxy)

- **Finds:** people who subscribe to a curated desk roster = high-intent niche audience. Useful for sizing and for follower-overlap clustering.
- **Method:** `GET /twitter/list/followers?listId=<id>`.
- **Cost:** sample 200 ≈ **$0.03**.

Exception: lists require a `listId`. Getting the first IDs is manual (open a known desk's profile → Lists tab) or via a `list:` search operator (Seam 5). Budget ~10 min of manual seeding before the calls.

---

## Seam 3 — Self-description search (a different population)

Tweet-search finds accounts by what they *said once*. User-search finds them by what they *say they are*. The two populations barely overlap — a desk whose bio reads "BTC liquidation alerts" may never have used your keyword in a harvested window.

### 3a. Bio keyword search

- **Finds:** desks by self-label: `liquidation`, `OI`, `funding`, `清算`, `资金费率`, `청산`, `清算マップ`. Avoids the `손절`-means-breakup false positive because a bio is a declared identity, not incidental text.
- **Method:** `GET /twitter/user/search?query=<bio-term>` (searches user profiles, not tweets).
- **Expected signal:** a roster of monitor/alert/desk accounts the tweet sweep structurally cannot reach.
- **Cost:** ~$0.00015/user → 20 terms × ~30 hits ≈ **$0.09** for a full multilingual pass; one term ≈ **$0.005**.

### 3b. Batch enrichment of the new handles

- **Finds:** nothing new on its own — it *qualifies* the flood of handles that Seams 1–3 produce, cheaply, before you spend on `last_tweets`.
- **Method:** `GET /twitter/user/batch_info_by_ids` (bulk profile in one call) → filter by follower band + `statuses_count` + bio, *then* harvest only survivors.
- **Expected signal:** cuts wasted `last_tweets` spend by ~70% on graph-expanded candidate sets.
- **Cost:** ~$0.00018/user, batched → **$0.02** per 100 candidates. This is a cost *reducer*.

---

## Seam 4 — Live language signal (fixes the stale CN/JP problem)

Pass-2 flagged `perps-cn` as under-sampled and JP as narrow. Both used keywords *we* guessed. We never asked the platform what those languages are actually saying today.

### 4. Localized trends → keyword seeds

- **Finds:** the terms trending *now* in KR/JP/CN crypto conversation — fresh fuel for `advanced_search`, language-correct by construction.
- **Method:** `GET /twitter/trends?woeid=<region>` (e.g. Japan, South Korea), then feed any crypto/perp term back into the existing search pipeline.
- **Expected signal:** breaks the stale-keyword ceiling that 408'd the CN pass; surfaces event-driven desks (liquidation cascades, listing pumps) the static keyword list misses.
- **Cost:** trends call is near-flat, **< $0.002**. The follow-on searches cost as normal.

Therefore: when a cell goes stale, the fault is usually the keyword, not the niche. Ask the platform what the word is.

---

## Seam 5 — Operators we never typed (cheap, advsearch already wired)

The `advanced_search` endpoint is fully built and metered. These operators need zero new code — just new query strings. `min_faves:` and `lang:` are *excluded* here (already run).

| operator | finds | example query | expected signal | cost |
|---|---|---|---|---:|
| `url:` | Everyone linking a tool/dashboard — exact, no keyword noise | `url:coinglass.com min_faves:30 lang:ja` | Tool-anchored risk desks (Coinglass / Hyperdash / GMGN users) | ~$0.005/run |
| `min_replies:` | Posts that *drive conversation* — the numbered-rule format that gets argued with | `min_replies:20 청산 lang:ko` | Surfaces `numbered_list` rule desks that `min_faves` alone misses | ~$0.005/run |
| `min_retweets:` | Share-worthy cards (people forward data, they like jokes) | `min_retweets:25 liquidation lang:en` | Cleaner `data_drop` signal than likes | ~$0.005/run |
| `filter:images` + `min_faves:` | The literal risk-card / liquidation-map format (JP/CN) | `filter:images 清算マップ min_faves:20` | Direct hit on the `risk_card` skeleton; barely used (1 prior search) | ~$0.005/run |
| `conversation_id:` | A whole winning thread in one call | `conversation_id:<id>` | Mines the exact numbered skeleton + the best repliers together | ~$0.003/run |
| `list:` | Search *inside* a curated list | `list:<id> min_faves:10` | Bridges Seam 2 and Seam 5 — find list IDs, then score them | ~$0.005/run |
| `until:` (paired with `since:`) | Cadence proof — is the desk's drop daily or one-off? | `from:capy_onchain since:.. until:..` | Confirms repeatability without a full `last_tweets` harvest | ~$0.003/run |

---

## Run order (cheapest-to-richest, no spend yet)

| # | strategy | seam | effort | cost | why this order |
|---:|---|---|---|---:|---|
| 1 | Quote-tweeters of pass-2 examples | 1a | ~15 min | ~$0.08 | Highest precision; seeds already in hand |
| 2 | `filter:images` risk-card sweep (JP/CN) | 5 | ~10 min | ~$0.02 | Fixes the weakest cells, zero new code |
| 3 | Bio user-search, multilingual | 3a | ~15 min | ~$0.09 | New population, dodges false positives |
| 4 | List members + timeline | 2a/2b | ~20 min (incl. manual seed) | ~$0.05 | Insider-curated, needs list IDs first |
| 5 | Repliers + mentions challenger map | 1b/1d | ~15 min | ~$0.16 | Noisier; run after the clean seams |
| 6 | Trends → fresh CN/JP keywords | 4 | ~10 min | ~$0.01 | Unblocks the stale cells for a future sweep |
| 7 | Batch-enrich all candidates, then harvest survivors | 3b | ~10 min | ~$0.02 | Run last; qualifies everything above |

Total: **~$0.43**, ~95 minutes of agent time. Well inside the $13.55 remaining.

---

## What stays excluded (and why)

| tempting route | why skip |
|---|---|
| More `min_faves:` / `lang:` keyword sweeps | Already 423 / 393 searches deep. Diminishing returns confirmed in pass-2. |
| Giveaway / wallet-drop accounts | Pass-2 false-positive: farms replies, proves no Vision demand. |
| Raw `손절` search | Korean for both stop-loss *and* social cut-off. Use bio-search (3a) instead. |
| Two-post 100%-repeat rows | Leads, not proof. Confirm cadence with `until:`/`since:` (Seam 5) before trusting. |

---

## Glossary

- **Engagement graph:** the set of accounts that replied to, quoted, or retweeted a given post — discovery by interaction rather than by keyword.
- **Seed post:** a known high-engagement tweet (here, the example URLs in `outlier-pass-2.md`) used as the starting point for graph expansion.
- **`data_drop` / `numbered_list` / `risk_card`:** the repeatable post formats scored in pass-2 — lead with a number, a numbered rule list, or a trigger-level card.
- **WOEID:** "Where On Earth ID" — the region code twitterapi.io's `/trends` endpoint takes.
- **Credit:** twitterapi.io billing unit; 100,000 credits = $1.00; ~15 credits per returned item.

## Source files

| file | what it gives |
|---|---|
| `marketing/niche-research/outlier-pass-2.md` | The 227 desks and their example post URLs (seeds for Seam 1) |
| `docs/x-targeting/twapi.py` | The wired client — extend with the unused endpoints above |
| `docs/x-targeting/cache/searches.jsonl` | Proof of which operators are already exhausted |
| `docs/x-targeting/format_miner.py`, `motif_repeatability.py` | Scorers to point at list/graph harvests |
