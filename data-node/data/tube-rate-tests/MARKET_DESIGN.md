# Tube Markets — Design Plan

Consolidates everything we've measured: signals, cadences, rate limits, market tiers, graph update rhythm. Rate target is 80 % of empirically observed ceilings; graph target is "as frequent as we can without hitting a ban, independent of how often upstream actually ticks".

## 1. Inventory of signals

From empirical verification:

| Source | Endpoint | Parsed cleanly? | Primary metric | Secondary |
|---|---|---|---|---|
| **Xvideos** stars | per-profile | ✅ raw int | `total_views` | — |
| **Xvideos** trending | `/best/last-24` | ✅ slug + K/M views + rank | `rank` | `views_raw` (K/M) |
| **Xnxx** stars | per-profile | ✅ raw int | `total_views` | — |
| **Xnxx** trending | `/best/last-year` | ✅ slug + rank | `rank` | — |
| **Eporner** stars | per-profile | ⚠ age-gated | `total_views` | — |
| **Pornhub** stars | `/pornstars?o=t` | ❌ SPA now | — | — |
| **Pornhub** trending | `/video?o=tr` | ❌ SPA now | — | — |
| Chaturbate live cams | official affiliate API | ✅ (existing source) | `viewer_count` | `model_online` |

Eporner requires a headless browser or age cookie to bypass the gate; Pornhub requires a headless browser to execute the client-side render. Both out of scope for the current pure-HTTP collector.

## 2. Empirical update cadences

From the 48 h run (plus earlier probes). "Cadence" = median time between real counter transitions, with CDN cache alternation filtered by double-sampling:

| Signal | Real cadence | Notes |
|---|---|---|
| Xvideos star views (top-ranked stars) | **~70 min** | Three ticks in 3.5 h on 5 of 10 stars |
| Xvideos star views (lower-traffic stars) | **~210 min** | One tick in 3.5 h on the other 5 |
| Xnxx star views (non-bot accounts) | **~3 h+** | One tick in 3.5 h |
| Xnxx star views (bot cluster) | **~70–200 min**, deterministic | Four accounts lockstep |
| Xvideos trending top-10 ranks | **static at < 24 h horizon** | No reorders in 3.5 h |
| Xvideos trending top-10 view counts | **~70–210 min**, K/M display-rounded | Most ticks masked by rounding |
| Xnxx trending top-10 ranks | **static at < 24 h horizon** | No reorders in 3.5 h |
| Chaturbate per-model viewers | **seconds** | Affiliate API near-real-time |

## 3. Rate-limit budget at 80 %

From the earlier rate-limit ramp (residential IP, single-origin):

| Site | Observed safe rps | 80 % target | Requests / hour at 80 % |
|---|---:|---:|---:|
| Xvideos | 5.0 | **4.0 rps** | 14 400 |
| Xnxx | 5.0 | **4.0 rps** | 14 400 |
| Redtube | 5.0 | 4.0 rps | 14 400 |
| Youporn | 5.0 | 4.0 rps | 14 400 |
| Xhamster | 5.0 | 4.0 rps | 14 400 |
| Eporner | 3.0 | 2.4 rps | 8 640 |
| Pornhub | 2.0 | 1.6 rps | 5 760 |

Datacenter IPs (VPS 1) will have tighter ceilings — halve these estimates on VPS for safety.

## 4. Fetch plan at 80 % — graph-refresh oriented

**Target: refresh each tracked asset's graph every 30 seconds** (that's ~120 ticks/hour × 80 % for all stars combined).

Math for 20 stars per site × 2 sites (xvideos, xnxx):

| Component | Requests per fetch | Fetches per hour @ 30 s cycle | Per-site req/hour |
|---|---:|---:|---:|
| XV stars (20 profiles) | 20 | 120 | **2 400** / 14 400 budget (17 %) |
| XV trending (1 listing) | 1 | 120 | 120 / 14 400 (1 %) |
| XN stars (20 profiles) | 20 | 120 | 2 400 / 14 400 (17 %) |
| XN trending (1 listing) | 1 | 120 | 120 / 14 400 (1 %) |

**Total at 30 s cycle: 42 req × 120 = 5 040 req/hour across both sites.** Each site sees ~2 520 req/hour = 0.7 rps avg — 17 % of its 4 rps ceiling. Plenty of headroom; 20 s cycle or faster is also safe.

**Chosen cadence: 30 s cycle, double-sampled 5 s apart.** Within 80 % of budget on every individual site, leaves room for retries and discovery refresh.

**Rationale for graph updating faster than data moves:** most ticks we register will just confirm the last known value. That's fine — the graph still breathes, the UI shows a live pulse, and when the real tick comes it shows up within 30 s. Empty graphs are worse than redundant graphs.

## 5. Market tiers by resolution horizon

Horizon must match the fastest cadence at which the resolution signal can honestly move. Betting on a 5-minute market resolved by a counter that updates every 70 min is noise.

### Tier A — Real-time (seconds to 5 min) — CAMS ONLY

| Market | Resolution | Universe | Data |
|---|---|---|---|
| "Will model X have ≥N viewers in 5 min" | 5 min snapshot | Top 100 models | Chaturbate (existing) |
| "Will model X still be online in 10 min" | 10 min snapshot | Online models | Chaturbate |
| "Top model's viewer count up or down at the next tick (60 s)" | 60 s | Highest-viewers model | Chaturbate |
| "Aggregate models online, next 5 min: over/under M" | 5 min | Site-wide | Chaturbate, Stripchat (TBD) |

Tubes do not qualify for this tier. Anything Tier A must come from cam data.

### Tier B — Short (1 – 4 hours) — XVIDEOS STARS

| Market | Resolution | Universe | Why this horizon |
|---|---|---|---|
| "Star X gains ≥N views in next 2 h" | 2 h | Top-20 xvideos stars | Captures ~1 real tick per star |
| "Who gains more views in next 2 h: Star A vs Star B?" (H2H) | 2 h | Curated pairs | Pure relative speed |
| "Will katty-west's rank improve at the next listing refresh?" | 1 – 4 h | Top-10 xvideos stars | Rank updates are bursty |

These are **viable only with Xvideos**. Xnxx star ticks are too small (deltas in the hundreds) to give a clean resolve, and half the top accounts are bots.

### Tier C — Daily (24 h) — TRENDING

| Market | Resolution | Universe | Why this horizon |
|---|---|---|---|
| "Who is #1 on xvideos /best/last-24 tomorrow 00:00 UTC" | 24 h, multi-outcome | Today's top 5 | Rolling-24 list reshuffles over days |
| "Will current #1 on xnxx /best/last-year still be #1 in 24 h" | 24 h binary | 1 asset | King-stays-king |
| "Top-10 churn count: how many new entries in 24 h" | 24 h numeric | xvideos top-10 | Static at hours, moves at days |
| "New entrant from outside top-50 will reach top-10 in 48 h" | 48 h binary | Everyone | Viral speculation |

### Tier D — Weekly (7 d) — VIEW GROWTH

| Market | Resolution | Universe |
|---|---|---|
| "Star X total views ≥ threshold by end of week" | 7 d binary | Top-20 xvideos stars |
| "Star X gains more views this week than last week" | 7 d binary | Top-20 |
| "Head-to-head view growth over the week" | 7 d binary | Curated pairs |
| "Biggest rank climber in xvideos top-50 over the week" | 7 d multi-outcome | Top-50 |

### Tier E — Rare events

| Market | Resolution | Notes |
|---|---|---|
| "Any star crosses 1 B views in the next 7 d" | 7 d binary | Low-rate, sparks interest |
| "Xvideos #1 gets dethroned in 48 h" | 48 h binary | #1 positions are sticky |
| "A listing page reshuffles by more than 3 positions in 24 h" | 24 h | Algorithm-change detector |

## 6. Graph update strategy

Graph = sparkline on each market card. Refresh cadence of the graph ≠ real cadence of the data.

Proposed refresh schedule:

| Graph type | Refresh | Data cadence | Behaviour |
|---|---|---|---|
| Tier A (cam) | 10 s | seconds | Live pulse |
| Tier B (xv star views) | 30 s | 70–210 min | Mostly flat line with rare steps |
| Tier C (trending rank) | 60 s | ≥ 24 h | Shows a staircase across days |
| Tier D (weekly growth) | 5 min | 70–210 min | Cumulative line |

The 30 s cycle proposed in §4 feeds all of these except Tier A. Every graph has the fresh value within one cycle; Tier A needs the cam source's native stream.

## 7. Database and write pipeline

All observations go to `market_prices` via the existing data-node write channel. Double-sampled cycles write **both** A and B as separate rows with a `sample` label; downstream analytics (graph renderer, tick detector) treats A=B as one real data point and A≠B as a flagged CDN-noise entry.

Storage at 30 s cycle × 42 assets × 2 samples = 5 760 rows/hour = 138 k rows/day. Postgres handles this trivially. Retention default 30 days → 4 M rows per source — small.

## 8. Oracle resolution

For each market tier:

- **Tier A**: oracle reads the cam source's latest value at resolve time. Chaturbate already supported.
- **Tier B, D**: oracle reads `market_prices` for the asset at the resolve timestamp, compares against the market's start timestamp. Threshold markets compare to a stored baseline.
- **Tier C**: oracle re-fetches the canonical listing URL at the resolve timestamp, parses top-N, determines the winning slug / rank. Must be deterministic — the listing is global (confirmed across UAs) so any oracle fetching at the same instant gets the same answer.
- **Tier E**: same mechanism as C.

## 9. Known caveats

- **CDN alternation**: ~3 % of observations return a stale cached value. Resolution must use majority vote across multiple consecutive polls or reject single-sample outliers. Double-sampling built into the collector supports this directly.
- **Bot accounts on Xnxx**: four top-10 accounts (`candice-price-model`, `cedric-extra-model`, `johnny-liberty-model`, `violet-haze-extra-model`) produce synthetic lockstep deltas. Exclude from any honest market. Flag in `sources-display.json` metadata if we ship xnxx markets.
- **Pornhub and Eporner unavailable** via HTTP scraping. Headless-browser route possible but out of scope for the initial data-node source.
- **VPS vs residential IP**: ceiling roughly 2× tighter from a datacenter IP. When porting the collector to VPS 1, halve the 80 % budget to 40 % of residential numbers and re-verify.
- **Laptop run fragility**: the current 48 h collector runs on a laptop. Canonical baseline dataset should migrate to VPS 1 before final calibration of thresholds per market.

## 10. Shipping order (proposed)

1. **Migrate collector to VPS 1** (one-time, cheap). Same script, same logs, survives indefinitely.
2. **Ship Tier B xvideos markets** once we have 48 h of VPS-origin data to set threshold Ns at ~50 / 50 per star.
3. **Ship Tier C daily trending markets** in parallel. No data dependency — just need oracle resolution logic.
4. **Ship Tier D weekly head-to-head**s a week after Tier B, using the first week of collected data as baseline.
5. **Tier A cams (Stripchat, BongaCams additions)** independently — no dependency on the tube pipeline at all.
6. **Tier E rare-event markets** last. They need long baseline data to price correctly.

## 11. What NOT to ship

- Tier A markets on tubes. The data does not move at seconds; any market offering this will be cosmetic theatre.
- Xnxx head-to-head markets involving the four bot accounts. Flag and exclude in the source config.
- Pornhub-based markets until we have a headless-browser path to their listings. Every URL we checked returns a 54 KB SPA shell with no content.
- Eporner markets until the age-gate bypass is handled.

## 12. The knife

We asked for per-minute markets and the data said per-hour. We asked for per-hour markets and the data said per-day for most of what it shows. The only honest sub-hour signal in the adult-content universe lives on cam sites, not on tubes. Tubes give us slow, beautiful, weekly-horizon markets with very large numbers — which is a different and perhaps more interesting product than the fast-market theatre we were chasing. A bet resolved in a week teaches patience. A bet resolved in five seconds teaches nothing.
