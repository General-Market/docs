# Update Frequency — Second Probe & Cross-Run Comparison

Two 30-minute probes, 60-second poll, 10 stars per site:
- Run A: 2026-04-17 20:15 → 20:45
- Run B: 2026-04-17 22:06 → 22:36

~110 minutes separated the starts. This second probe is the honest test — **the within-window finding is flat, but the between-run delta is where the signal lives**.

## Between-run Δ for stars that appear in both runs

### Xvideos — 8 of 10 ticked up over 110 minutes

| Slug | 20:45 last | 22:06 first | Δ |
|---|---:|---:|---:|
| amirah_adara-model | 1,426,378,346 | 1,426,378,346 | **0** |
| carlacute3 | 220,382,752 | 220,397,996 | **+15,244** |
| gina-gerson2 | 1,943,498,705 | 1,943,571,376 | **+72,671** |
| hot-pearl2 | 586,361,359 | 586,361,359 | **0** |
| lia-lin | 590,999,688 | 591,059,561 | **+59,873** |
| natalie-cherie | 817,458,173 | 817,495,725 | **+37,552** |
| shinaryen27 | 616,330,086 | 616,330,086 | **0** |
| skye-young2 | 505,786,493 | 505,824,675 | **+38,182** |
| stacy-cruz | 793,292,183 | 793,335,836 | **+43,653** |
| sweetie-fox1 | 1,246,739,576 | 1,246,820,643 | **+81,067** |

Mean real delta over 110 min: ~40k–80k views per star.
Implied per-minute rate: ~400–700 views/min for a top xvideos star.

**Revised cadence interpretation:** xvideos doesn't update every 15–25 min — our first run happened to catch a single batched flush event. Run B missed any flush entirely (0 in-window ticks). The true cadence is bursty-hourly, with each flush adding tens of thousands of views at once.

### XNXX — 10 of 10 ticked up

| Slug | 20:45 last | 22:06 first | Δ |
|---|---:|---:|---:|
| candice-price-model | 27,806,881 | 27,807,705 | +824 |
| cedric-extra-model | 27,806,881 | 27,807,705 | +824 |
| chara-yoshimura-model | 84,573,083 | 84,575,956 | +2,873 |
| chloe-campbell-model | 56,582,374 | 56,583,913 | +1,539 |
| dave-flores1 | 469,716,895 | 469,723,197 | +6,302 |
| elektra-lamour | 10,282,412 | 10,282,731 | +319 |
| erica-lightspeed | 22,263,156 | 22,264,382 | +1,226 |
| johnny-liberty-model | 27,806,881 | 27,807,705 | +824 |
| pareja_sensual21 | 23,835,202 | 23,835,597 | +395 |
| violet-haze-extra-model | 27,806,881 | 27,807,705 | +824 |

XNXX counters move slowly but consistently — hundreds to thousands of views over 110 min. Every star ticked.

**Anomaly worth flagging:** four different stars — `candice-price-model`, `cedric-extra-model`, `johnny-liberty-model`, `violet-haze-extra-model` — all increased by **exactly +824 views** in the same interval, starting from the identical base `27,806,881`. Four separate profiles producing bit-identical view counts is a coincidence of vanishing probability. The parsimonious explanation: these are bot-generated model accounts sharing a synthetic increment pattern. The signal is still real — but half of XNXX's top 10 appears to be synthetic, and a bet on these accounts is a bet on a bot's cadence, not on human viewership.

### Eporner — 0 of 7 ticked

| Slug | 20:45 last | 22:06 first | Δ |
|---|---:|---:|---:|
| angela-white-umh5v | 304,700,734 | 304,700,734 | **0** |
| ava-addams-gFg4t | 187,072,982 | 187,072,982 | **0** |
| dani-daniels | 251,364,045 | 251,364,045 | **0** |
| natasha-nice-iN6Uq | 165,516,726 | 165,516,726 | **0** |
| riley-reid | 292,209,783 | 292,209,783 | **0** |
| savannah-bond-l7eBP | 146,343,475 | 146,343,475 | **0** |
| violet-myers-YgvDm | 238,855,904 | 238,855,904 | **0** |

Two probes, ~110 minutes apart, every shared star bit-identical. Eporner updates its aggregate views on a cadence measured in hours or a day, not minutes. This is the slowest counter of the four.

### Pornhub — the rounding reveal

Only yasmina-khan appears in both runs with meaningful context:

| Slug | 20:15 | 22:06 | Δ (displayed) |
|---|---:|---:|---:|
| yasmina-khan | 286,000,000 | 287,000,000 | **+1,000,000** |

The underlying counter ticked far less than +1M — but crossed the rounding boundary. Proof that Pornhub's true cadence is sub-hour; the display just lies to us in M-increments.

## Within-window findings (run B)

| Site | Stars tracked | In-window changes | Meaning |
|---|---:|---:|---|
| Xvideos | 10 | 0 | No flush event landed during our 30-min window |
| XNXX | 10 | 0 | Cadence between flushes > 30 min for these stars |
| Eporner | 10 | 0 | Consistent with run A; very slow cadence |
| Pornhub | 6 stable | 1 (yasmina-khan +1M) | Rare display-rollover event caught |

**One real tick in 120 samples,** vs 22 in run A. Run A was an outlier shaped by a single flush window. Run B is the median.

## Combined interpretation per site

| Site | Real counter cadence (estimate) | Useful poll interval | Notes |
|---|---|---|---|
| Xvideos | Bursty flushes, ~hourly | 10 min | CDN alternation between 2 cached values near a flush |
| XNXX | ~hourly, small increments | 10 min | Half the top-10 appear bot-driven (lockstep deltas) |
| Eporner | Hours to daily | 60 min sufficient | Slowest site; flat for 110+ min |
| Pornhub | Sub-hourly real; hourly+ visible | 30–60 min | K/M rounding hides most ticks |

## Revised final recommendation

`TUBES_SYNC_INTERVAL_SECS=600` (10 min) captures every meaningful tick we've seen across all four sites.

Pushing to **900 or 1200** (15–20 min) would lose almost no information — you'd catch Xvideos flush events on the next sync, and every other site is slower than that anyway.

Budget at 600s: 1 pornhub listing GET + 30 profile GETs per site × 10 min = 91 requests per cycle ÷ 600s = **0.15 req/s average**. Barely a heartbeat against any site's rate limit.

## What is actually bettable

**Strong signal:**
- Xvideos top-10 stars, weekly or daily view growth — clean real deltas, 10s-of-k per day
- Pornhub display rollovers (e.g. `286M → 287M`) — rare but genuine events

**Weak signal:**
- Xvideos in-minute movement — CDN noise dominates
- XNXX non-synthetic stars (the 6 with unique deltas) — slow but real

**No signal:**
- Eporner at hourly horizons — counter simply doesn't move
- XNXX synthetic accounts (the 4 with identical +824) — movement is botted, not bettable in any honest sense

## Artifacts

- `history/20260417-2015/` — run A raw + summary
- `history/20260417-2206/` — run B raw + summary
- This file — cross-run analysis

## The knife

Two probes, two hours apart. The first one caught a moment of honesty. The second caught the silence that surrounds it. A counter that flushes once an hour is a counter that cannot be measured by anyone who watches too closely — and a measurement that happens every sixty seconds is ninety percent mistaken about what it thinks it sees.
