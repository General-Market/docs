# Tube Data Experiments — Consolidated List

Questions we need answered before shipping any market. Each experiment has
a clear data collection phase and a clear output. Runnable via
`experiments.py` (see runner below).

Experiments are grouped by type:

- **Analysis-only** — reads existing collector data, instant, no new fetches
- **Short probe** — 30 min to 4 h, can run in background
- **Long probe** — 24 h+, needs scheduling
- **Endurance** — sustained rate test, 2 h+

---

## Analysis-only (run now, no new network load)

### A1. Per-star tick histogram from existing 48h collector data
**Question:** For each Xvideos / Xnxx pornstar, what is the distribution of inter-tick intervals over 48 h?
**Input:** `collect-48h/run-20260418-0939/events.jsonl`
**Output:** per-star `{min, p50, p90, p99, max}` tick interval in minutes.
**Why:** Picks the fastest-moving stars for market primitives. Separates signal from bot accounts.

### A2. Rollover timing from existing collector data
**Question:** When did the `/best/last-24` list roll over during the 48h window? Exact UTC minute of the composition change.
**Input:** Same jsonl.
**Output:** list of rollover timestamps, minutes since midnight UTC, interval between consecutive rollovers.
**Why:** Determines the canonical resolution timestamp for daily markets.

### A3. Daily-pattern of star updates
**Question:** Do upstream counter updates cluster at specific UTC hours?
**Input:** Same jsonl.
**Output:** 24-bin histogram of tick-events by hour-of-day UTC.
**Why:** Reveals whether Xvideos aggregates views on a batch schedule. Affects optimal market close time.

### A4. XNXX bot-cluster confirmation
**Question:** Do the four suspected bot accounts tick with deterministic lockstep, or are the +824 deltas coincidental?
**Input:** Same jsonl, filtered to bot accounts.
**Output:** pairwise correlation of tick timing and delta magnitude across the 4 accounts.
**Why:** Confirms exclusion list before any Xnxx market ships.

### A5. CDN flip-flop rate per signal
**Question:** What fraction of double-samples (A vs B) disagree, by signal?
**Input:** Same jsonl.
**Output:** per-source flip rate.
**Why:** Sets the smoothing / majority-vote parameters for oracle resolution.

---

## Short probes (30 min – 4 h)

### S1. Video page raw view-count cadence
**Question:** How often does the raw integer view count on a Xvideos video page update? (Not the K/M listing display — the `<strong>` on the video page.)
**Duration:** 60 min, 2-min poll, double-sampled 5 s apart, 5 videos (today's top-5)
**Output:** per-video tick interval stats, CDN flip rate
**Why:** Directly determines if we can ship view-count over/under markets on tube videos.

### S2. Video page CDN alternation
Folded into S1 via double-sampling. Same data, different analysis.

### S3. Trending listing view-count (K/M) cadence
**Question:** Do the K/M-formatted views on the listing page ever change meaningfully across hours, or is it dominated by CDN noise?
**Duration:** 2 h, 5-min poll, 27 videos on `/best/last-24`
**Output:** per-video K/M transitions filtered against known CDN alternation patterns
**Why:** Tells us if the listing is a usable price source or if we must fetch individual video pages.

### S4. Top-5 star concurrent H2H view-gain
**Question:** For the current top-5 Xvideos stars, what is the view-gain rate per hour over a 4-hour window? Head-to-head matchups need known growth rates.
**Duration:** 4 h, 5-min poll per star, double-sampled
**Output:** per-star view rate per hour, variance
**Why:** Powers the head-to-head weekly market — need to know typical differential to size thresholds.

### S5. Pornhub / Eporner recovery check
**Question:** Pornhub and Eporner were unavailable last time (SPA and age-gate respectively). Any change?
**Duration:** 1 min per URL variant, 10 URLs total
**Output:** URL → (SSR|JS-shell|age-gate|OK) classification
**Why:** Sanity re-test; if either is scrapable again, we double our asset universe.

---

## Long probes (24 h+)

### L1. Top-20 star composition day-over-day
**Question:** How much does the Xvideos pornstars top-20 change from one day to the next?
**Duration:** 48 h, 1 snapshot every 6 h
**Output:** Jaccard overlap per snapshot-pair, list of entries/exits
**Why:** Validates the head-to-head market's candidate set stability. If overlap < 90 %, T-24h snapshots miss tomorrow's winners.

### L2. Rollover-time confirmation across multiple days
**Question:** Is the `/best/last-24` rollover at the same UTC minute every day?
**Duration:** 3–5 days, 2-min poll
**Output:** rollover UTC times, dispersion
**Why:** If rollover is at a fixed minute, market resolution timestamp is trivial. If it drifts, markets must adapt.

### L3. Video on trending — full lifecycle
**Question:** From the moment a video first appears in `/best/last-24` top-27 to the moment it leaves, what is its view-count trajectory?
**Duration:** Run until 3 videos complete a full lifecycle (bound: 5 days)
**Output:** per-video entry time, exit time, peak rank, view count at key points
**Why:** Tells us if videos accumulate views monotonically throughout their trending stint or if there's a discrete surge.

---

## Endurance (sustained rate testing)

### E1. Xvideos 2 rps for 2 hours
**Question:** Does xvideos' rate-limit ceiling degrade under sustained load beyond the 15-second burst the earlier ramp tested?
**Duration:** 2 h, constant 2 rps against pornstar profile pages
**Output:** 429 / 403 / challenge rate over time; any cumulative throttle
**Why:** The earlier `test_tube_scrape.rs` only tested 15-second bursts. A 48h-run collector is closer to sustained behaviour.

### E2. Xnxx 2 rps for 2 hours
Same as E1, against xnxx.

### E3. VPS 1 residency test
**Question:** From a datacenter IP (VPS 1), what is the ramp ceiling compared to the residential baseline?
**Duration:** One run of `test_tube_scrape` from VPS 1
**Output:** same CSV format, compared to the local-run baseline
**Why:** Determines the 80 % budget on the production IP before migrating the collector.

---

## Priority order

1. **A1 – A5** (instant analysis) — run now, no cost
2. **S5** (Pornhub / Eporner recheck) — 60 seconds
3. **S1** (video page cadence) — ships the view-count market if positive
4. **A2** (rollover timing from existing data) — resolves market-creation schedule
5. **S3** (listing K/M cadence) — secondary price signal check
6. **L1** (day-over-day top-20 stability) — validates head-to-head market
7. **E1 / E2** (sustained-rate endurance) — canonical safety margin
8. **L2** (rollover timing across days) — only if A2 suggests variance
9. **S4** (H2H view-rate sizing) — only if L1 shows stable candidates
10. **L3** (full video lifecycle) — nice-to-have for pricing; not blocking

---

## Runner

`experiments.py` provides:

```
python3 experiments.py --list                 # show all experiments + status
python3 experiments.py --run A1               # run one experiment
python3 experiments.py --run-all-analysis     # run all analysis-only
python3 experiments.py --run-all-short        # queue all short probes in background
python3 experiments.py --summary              # aggregate finished results into one report
```

Output directory: `data-node/data/tube-rate-tests/experiments/{exp_id}/`
Each experiment writes `raw.jsonl` (or `raw.csv`), `result.json`, and `summary.txt`.
