# Daily Winners Reel — automated pipeline

**Date:** 2026-05-27
**Goal:** Each day, regenerate the DeFi "WinnersReel" data from live DefiLlama numbers,
pick the category with the biggest 7-day mover, render that one reel to an mp4, find the
most-engaged tweet about the winning protocol in the last hour, and drop a ready-to-post
bundle into a folder. The human drops the mp4 onto Twitter as a quote-tweet of that tweet.

## Decisions (locked with the user)

- **Daily output:** *biggest mover that day*. Rank all categories by their top winner's
  7-day % growth; render only that category's `CrtBarReel`.
- **Metric:** *7-day TVL change*, for every category. Volume was the first choice for the
  trading venues, but DefiLlama's volume dashboards (`/overview/derivatives`,
  `/summary/derivatives/*`) now return **HTTP 402 — paid Pro tier only**, and the
  data-node's `perp_24h_` series is empty. The free `/protocols` endpoint gives `tvl` +
  `change_7d` for every protocol — the same metric the shipped reels already use.
  DEX volume *is* free (`/overview/dexs`) but DEX is not one of the five categories.
- **Tweet pick:** *strictly the last 60 minutes*, ranked by likes + replies + retweets
  (view counts are unreliable under ~2h). If the winner has nothing fresh, the bundle says
  so plainly and ships a fallback caption — tweet availability never overrides the data pick.
- **Trigger:** daily macOS `launchd` job → mp4 + `post.txt` into a dated folder + notification.

## Categories & framing

Roster source: `data-node/src/config/dl-curated.json` — the curated ~10-slug lists (real
protocols, not raw top-N, so the reel never crowns dust). Five categories:

| Category | curated key | dataset id | display `mode` |
|----------|-------------|------------|----------------|
| Perps | `defillama-derivatives` | `PerpsFlowReel` | `pct` |
| Prediction markets | `defillama-prediction-market` | `PredictionMarketsFlowReel` | `usd` |
| Privacy | `defillama-privacy` | `PrivacyFlowReel` | `pct` |
| RWA | `defillama-rwa` | `RwaFlowReel` | `usd` |
| Lending | `defillama-lending` | `LendingProtocolsFlowReel` | `usd` |

`mode` matches the README's drama guidance: `pct` for small-mover categories, `usd` for the
giant-scale ones. The existing curators reel (`LendingWinnersReel`) is a different data
source and stays untouched, out of the rotation.

## Data flow

```
fetch-flows.mjs  ──►  live-data.generated.ts   (rows + asof per category)
                 ──►  selection.json            (winning category + #1 winner)
                 ──►  fetches missing logos to public/defi-flows/logos/<slug>.jpg
        │
pick_tweet.py    ──►  tweet.json   (top last-hour tweet about the winner, or empty)
        │
build-bundle.mjs ──►  remotion render <Winner>WinnersReel ──► <out>/<cat>-YYYY-MM-DD.mp4
                 ──►  <out>/post.txt   (headline, winner+number, quote URL, caption)
                 ──►  macOS notification
        │
run.sh           orchestrates 1→2→3, logs to a file
com.generalmarket.winners-daily.plist   schedules run.sh once daily
```

Output folder: `~/Downloads/winners-daily/YYYY-MM-DD/`.

## One source of truth (datasets.ts refactor)

`datasets.ts` today mixes static prose (title, subtitle, source line, mode) with the numbers.
The pipeline must never clobber the prose. Split it:

- `datasets.ts` keeps the five `FlowDataset` objects with their **prose and mode**, but reads
  `rows` and `asof` from a generated module.
- `live-data.generated.ts` (machine-written) exports `LIVE: Record<datasetId, { asof, rows }>`.
- The pipeline writes **only** `live-data.generated.ts`. Art is untouchable; numbers are fresh.

`rows` derive from `/protocols`: `now = tvl`, `prior = tvl / (1 + change_7d/100)`.

## Selection rule

- For each category, keep rows with positive 7-day growth and `now ≥ MIN_LEVEL` ($2M floor,
  so a $200k protocol spiking 50% can't become the headline).
- A category with zero qualifying winners is skipped (privacy was all-negative on 2026-05-27 —
  a winners-only reel there would be empty).
- Winning category = the one whose top qualifying winner has the highest **% growth**
  (% is the only unit comparable across protocol sizes). `selection.json` records it.

## Twitter

Reuses `docs/x-targeting/twapi.py` (`cmd_advsearch`, key at `/tmp/.twapi_key`). One
`advanced_search` for the winner's name with `since:<today>`, filter client-side to the last
60 min, rank by `likeCount + replyCount + retweetCount`. Output the top tweet's url/text/
author/metrics, or empty. ~1 call/run ≈ $0.006.

## CrtBarReel

No component change needed: with TVL as the metric, the auto-subtitle
("Biggest TVL growth" / "Biggest net inflow") is already correct.

## Cost

- DefiLlama `/protocols`: free.
- Rendering: local CPU, free.
- twitterapi.io: ~$0.006/run (measured at test time via balance before/after).
- DefiLlama Pro (only if volume is ever wanted): ~$300/mo — not purchased.

## Files

```
video/src/compositions/defi-flows/live-data.generated.ts   (new, machine-written)
video/src/compositions/defi-flows/datasets.ts              (refactor: import LIVE, add lending)
video/scripts/winners-daily/fetch-flows.mjs                (new)
video/scripts/winners-daily/pick_tweet.py                  (new)
video/scripts/winners-daily/build-bundle.mjs               (new)
video/scripts/winners-daily/run.sh                         (new)
video/scripts/winners-daily/com.generalmarket.winners-daily.plist  (new)
video/scripts/winners-daily/README.md                      (new)
```

## Test plan

Run `run.sh` once end-to-end. Verify: live-data.generated.ts has fresh numbers, selection
picks the real biggest mover, an mp4 renders to the dated folder, post.txt is coherent, the
twitterapi cost is read and reported. Report which category won and the measured cost.
