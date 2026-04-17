# Tube Trending — Rank Cadence Probe

Question: Do the top-10 positions on tube trending lists churn fast enough to support minute-scale prediction markets?

Answer: **No.** Over a 15-minute window, neither xvideos nor xnxx changed a single position in their top 10. The list is bit-identical at minute 0 and minute 14 on both sites.

## Method

- 15 cycles × 1-minute interval = 15-minute window
- Xvideos `/best/last-24`, top 10 + K/M view counts per slot
- Xnxx `/best/last-year`, top 10 slugs
- Global (confirmed earlier: same list across desktop / mobile / bare-UA curl — no personalization)

## Results

| Site | Cycles | Position changes (sum) | New entries | Exits |
|---|---:|---:|---:|---:|
| Xvideos top-10 | 15 | **0** | 0 | 0 |
| Xnxx top-10 | 15 | **0** | 0 | 0 |

Sum of position changes is computed across all 14 consecutive transitions. Zero means every consecutive pair of snapshots was position-wise identical.

Xvideos did register 6 "view-count string changes" — all of them CDN cache alternation:

```
oucpibt4275:  712.6k → 712.4k → 712.6k → 712.4k → 712.6k ...
oualoud0c45:  2.1M → 2M → 2.1M ...
```

Two cached values alternating as different CDN edges answer our requests. Not upstream movement.

## Implication for markets

**Minute-scale trending markets are not viable.** Markets like:
- "Will video X be #1 in 5 minutes" — resolution will almost always be "yes, unchanged"
- "Top-10 churn count in 10 min" — will be 0 every time
- "Which top-5 holds #1 longest today" — no information gained within minutes

**Daily trending markets remain viable.** The top 10 *does* churn over 24+ hour windows (we can see videos entering and leaving `/best/last-24` over days). Examples:
- "Which of today's top-5 will be #1 tomorrow at 00:00 UTC"
- "A video not currently in top-50 will enter top-10 within 48h"
- "Video X will remain in top-10 for 7 consecutive days"

These resolve on timescales where the underlying list actually moves.

## What this means for fast markets

The tube trending list is the wrong data source for minute markets. The real fast-market candidates in the adult-content space are:

1. **Live cam viewer counts** — Chaturbate (already in data-node) ticks per model every ~60s, viewer counts genuinely move. Stripchat / BongaCams / LiveJasmin same pattern.
2. **Live cam online status** — binary flips in real time (model goes live, goes offline)
3. **Aggregate "models online" per cam site** — a live integer that changes as rooms open and close

The cam market is the honest fast market. Tubes are static over minutes by design — their ranking algorithm operates on hours-to-days aggregates.

## Artifacts

- `trending-cadence/cadence_v2.jsonl` — 15 timestamped snapshots of top-10 per site
- `trending-cadence/cadence.jsonl` — earlier broken run (xvideos slug parser was off), superseded

## The knife

A leaderboard that never changes is a leaderboard. A leaderboard that changes every minute is a lottery. We asked for the first and were given something older and more stable than we expected — the top of the pile does not move when you watch it.
