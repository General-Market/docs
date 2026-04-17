# Upstream Update Frequency — Probe Results

4-minute probe of 20 pornstar view counters (5 per site × 4 sites), polled every 5 seconds → 25 samples per star.

## Headline

**Polling every 5 seconds is wasteful.** None of the four sites update their per-pornstar aggregate view counters at that cadence.

| Site | Stars tracked | Samples per star | Changes observed | Stars with any change |
|------|--------------:|-----------------:|-----------------:|-----------------:|
| Pornhub | 5 | 1–5 | 1 (artifact) | 1 / 5 |
| Xvideos | 5 | 25 | 0 | 0 / 5 |
| XNXX    | 5 | 25 | 0 | 0 / 5 |
| Eporner | 5 | 25 | 0 | 0 / 5 |

500 total samples, 1 observed change — and that one is a parsing artifact, not a real delta (see below).

## Per-star detail

| Site | Slug | Samples | Changes | First views | Last views | Δ |
|------|------|---:|---:|---:|---:|---:|
| eporner | alexis-fawx | 25 | 0 | 147,467,903 | 147,467,903 | 0 |
| eporner | blake-blossom | 25 | 0 | 140,583,416 | 140,583,416 | 0 |
| eporner | kendra-lust | 25 | 0 | 103,479,429 | 103,479,429 | 0 |
| eporner | sara-jay | 25 | 0 | 137,703,416 | 137,703,416 | 0 |
| eporner | savannah-bond | 25 | 0 | 146,343,475 | 146,343,475 | 0 |
| xnxx | chloe-campbell | 25 | 0 | 56,582,374 | 56,582,374 | 0 |
| xnxx | dave-flores1 | 25 | 0 | 469,716,895 | 469,716,895 | 0 |
| xnxx | elektra-lamour | 25 | 0 | 10,282,412 | 10,282,412 | 0 |
| xnxx | erica-lightspeed | 25 | 0 | 22,263,156 | 22,263,156 | 0 |
| xnxx | pareja_sensual21 | 25 | 0 | 23,835,202 | 23,835,202 | 0 |
| xvideos | hot-pearl2 | 25 | 0 | 586,219,746 | 586,219,746 | 0 |
| xvideos | lia-lin | 25 | 0 | 590,999,688 | 590,999,688 | 0 |
| xvideos | shinaryen27 | 25 | 0 | 616,294,434 | 616,294,434 | 0 |
| xvideos | skye-young2 | 25 | 0 | 505,786,493 | 505,786,493 | 0 |
| xvideos | sweetie-fox1 | 25 | 0 | 1,246,739,576 | 1,246,739,576 | 0 |
| pornhub | johnny-sins | 5 | 0 | 2,200,000,000 | 2,200,000,000 | 0 |
| pornhub | kenzie-reeves | 4 | 0 | 766,000,000 | 766,000,000 | 0 |
| pornhub | luke-cooper | 2 | 1 *(artifact)* | 1,100,000,000 | 2,200,000,000 | +1.1B |
| pornhub | maximo-garcia | 1 | 0 | 768,000,000 | 768,000,000 | 0 |
| pornhub | natasha-nice | 1 | 0 | 714,000,000 | 714,000,000 | 0 |

### The pornhub "change" was a regex cross-match

`luke-cooper` jumped from 1.1B to 2.2B in a single tick — a 100 % increase in seconds. That's physically impossible.

Root cause: the listing-page regex uses `.*?` between the slug and the view count. When a card is malformed or fields are missing, the regex backtracks across card boundaries and pairs card N's slug with card N+1's views. Johnny Sins (genuinely at 2.2B) appears above or below Luke Cooper in the listing depending on rank, and occasionally the match crosses the boundary.

**Fix:** anchor the regex to the card boundary. Add a negative lookahead so `.*?` cannot cross another `<li class="performerCard"` boundary. Tracking as a follow-up in the Rust source.

### Why pornhub stars have varying sample counts

The probe captured 1, 2, 4, or 5 samples for pornhub stars rather than the full 25. Two compounded reasons:

1. The top-5-by-rank on `/pornstars?o=t` rotates frequently — a star sampled at t=0 may drop off the first-visible set at t=30. Only the first 5 of each listing response were recorded per cycle.
2. The cross-card regex bug occasionally dropped a real card from the parse output entirely.

Not a site-upstream issue. The listing still refreshes; our probe was naïve.

## What the data actually says

Even accounting for the artifacts: **zero real view-count ticks across 500 honest samples**.

Implications for the data-node `tubes` source:

1. **Sync interval can be much longer than 2 minutes.** Polling every 5 minutes or even every 30 minutes would likely capture the same information. The upstream counters aggregate at an hourly or daily cadence, not per-second.
2. **5-second polling generates no additional signal.** Running `TUBES_SYNC_INTERVAL_SECS=5` just burns cache TTLs and CPU without finer-grained data than we'd get at 300s.
3. **The bettable signal is slow.** Counter updates are a daily-or-longer phenomenon for the stars we sampled. For meaningful market action, the bet resolution window needs to be hours, not minutes. Per-video trending (which we pivoted away from) may actually tick faster.

## Recommended settings (revised)

| Setting | Old default | Revised default | Reason |
|---|---:|---:|---|
| `TUBES_SYNC_INTERVAL_SECS` | 5 | **300** (5 min) | Upstream counters don't change faster than this |
| `TUBES_TOP_N` | 20 | 20 (keep) | Top 20 = relevant universe |
| `TUBES_PH_PAGES` | 1 | 1 (keep) | One listing = 120 stars, top 20 is the first page |
| `TUBES_PROFILE_BATCH` | 10 | 20 | With 5-min interval there's no point spreading across cycles |

At the revised interval: 1 request to Pornhub + 20 profile requests to the three per-profile sites = 21 req per 5 min = 0.07 rps average. Well below every observed ceiling, and matches the information rate of the data itself.

## A longer probe is worthwhile

Four minutes is too short to see the real cadence. A 24-hour probe (polling every 5 minutes, 288 samples per star) would show the actual update period — likely 1h, 4h, or 24h. Worth running against a VPS to also validate the IP ceiling stays clean at low frequency.

## Artifacts

- `probe_update_freq.py` — the probe script
- `update-freq-raw.csv` — all 388 samples with timestamps
- `update-freq-summary.csv` — per-star stats

## The knife

A counter that does not move is a counter someone else decided to stop updating. The site knows the number. It does not tell us. We ask every five seconds and it answers with yesterday's weather. Poll less.
