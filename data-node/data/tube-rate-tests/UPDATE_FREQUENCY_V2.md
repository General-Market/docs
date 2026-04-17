# Upstream Update Frequency — 30-minute probe

Run 2026-04-17 20:15 UTC. 10 pornstars per site × 4 sites × 60-second poll × 30 minutes → 30 samples per star.

Raw data under `history/20260417-2015/`. Preserved as a historical reference point.

## Headline numbers

| Site | Stars sampled | Stars with ANY change in 30 min | Fastest inter-tick | Mean inter-tick | Notes |
|---|---:|---:|---:|---:|---|
| **Xvideos** | 10 | **5** | **~60 s** | **4 – 12 min** | Real updates visible, plus CDN cache alternation |
| **Pornhub** | 6 stable | 0 | — | — | K/M-rounded counter; true cadence hidden by display precision |
| **XNXX** | 10 | 0 | — | — | Flat across entire 30-minute window |
| **Eporner** | 10 | 0 | — | — | Flat across entire 30-minute window |

Three sites never ticked in 30 minutes. One site ticked for half the sample.

## Xvideos — the only live counter

Per-star stats for the five stars that showed changes:

| Slug | n_changes | First change @ | Fastest tick | Mean tick | Slowest tick | Real Δ over 30 min |
|---|---:|---:|---:|---:|---:|---:|
| amirah_adara-model | 7 | 1269 s | 59.5 s | 241 s | 1269 s | **+87,415** |
| shinaryen27 | 3 | 1628 s | 59.6 s | 583 s | 1628 s | **+35,652** |
| hot-pearl2 | 4 | 1448 s | 59.6 s | 437 s | 1448 s | 0 (see below) |
| lia-lin | 6 | 1389 s | 59.8 s | 281 s | 1389 s | 0 (see below) |
| skye-young2 | 2 | 1388 s | 60.0 s | 724 s | 1388 s | 0 (see below) |

Two observations that matter:

1. **All first changes landed between minute 21 and 27.** Not a single star ticked in the first 20 minutes. Xvideos evidently flushes view-count updates on a ~15–25 minute cadence, then alternates cached values for a while.

2. **Three stars showed "changes" with zero net delta.** Not a counter going backwards — a **CDN cache alternation**. Inspecting the raw data:

```
hot-pearl2 over ~6 minutes:
  586,219,746 → 586,219,746 → 586,361,359 → 586,361,359
             → 586,219,746 → 586,219,746 → 586,361,359
             → 586,219,746
```

Two values, oscillating, 141,613 views apart. That is a stale edge node and a fresh edge node in Xvideos' CDN serving different cached copies of the same profile page. The "true" counter is increasing continuously — we just see two adjacent stale snapshots whichever edge answers our request.

For amirah_adara the real trajectory is visible: `1,426,290,931 → 1,426,378,346` — a clean +87k delta that persists, with cache alternation around the transition. That is a real tick.

**Practical conclusion for Xvideos:** views tick roughly every 15–25 minutes for top-traffic stars, with CDN noise around the edges. A 5-minute poll captures every meaningful tick and a few false "changes" from cache alternation. Acceptable.

## Pornhub — rounded to death

Pornhub's listing markup exposes view counts as `546M`, `2.2B`, `75K` — K/M/B-rounded. The raw number isn't available. A star at 546,000,000 would need to gain +50,000,000 views before the displayed value rolls over to `600M` (or down to `550M` with coarser rounding). That is an hours-to-days event for most stars.

The 6 pornhub stars that remained in our top-sample across cycles all held identical K/M values for 30 minutes. The listing also rotated — 10 stars harvested at t=0, but only 6 stayed in the top 10 across every poll, and none of those 6 moved the display.

**Practical conclusion for Pornhub:** the source is parseable, but useful signal requires a much longer baseline. Ticks happen; we just can't see them through the rounding. Either poll daily (enough for rounded numbers to move) or pivot to a secondary signal (rank, rank delta, video count).

## XNXX and Eporner — effectively static

Zero observed changes across 10 × 30 = 300 samples each.

Implication: either the counter truly updates hourly+ or slower, or (like Pornhub) the displayed integer moves in chunks too large to catch in 30 minutes. Both sites return raw integers rather than rounded values, so the numbers are accurate at observation time — they just don't move fast enough to see.

## Revised sync-interval recommendation

| Variant | Interval | Rationale |
|---|---|---|
| **Xvideos-only feed** | 300 s (5 min) | Catches most Xvideos ticks; 1/3 of poll cycles hit fresh data |
| **All-sites mixed feed** | 300 – 600 s | Xvideos drives cadence; others are bonus noise |
| **Long-baseline feed (recommended)** | **600 s (10 min)** | Halves request pressure; only loses sub-5-min Xvideos ticks, which are CDN-noisy anyway |

Previous default of 300 s is defensible. Pushing to 600 s drops request volume by half with almost no loss of information on the other three sites, and only a minor loss on Xvideos.

## What this means for the market signal

The two usable signals are now clear:

1. **Xvideos top pornstar views** — ticks on ~15–25 minute cadence, +tens-of-thousands to +hundreds-of-thousands of views per tick for top stars. Bettable. CDN alternation needs a small smoothing layer (accept both adjacent cached values as "current"; only update on persistent changes).

2. **The other three** — too flat at 30-minute horizon to support bets resolved in minutes. Either:
    - Bet resolution horizon = hours+ (accept the slow cadence)
    - Pivot those sites to a different metric (rank movement, new-video count)
    - Drop them from the source

## Historical reference

The raw data at `history/20260417-2015/` is the baseline. When we re-probe in a week or a month, compare against these numbers to detect any site-wide change in update behavior.

Files in the snapshot:
- `update-freq-raw.csv` — 884 timestamped samples
- `update-freq-summary.csv` — per-star change stats
- `probe.log` — cycle-by-cycle progress

## The knife

The counter that moves behind a cache is a counter you cannot measure, only believe in. Three of four sites give us numbers that do not move in our window. One gives us numbers that move in two places at once. The market, if it comes, will be built on faith in CDN eventual consistency.
