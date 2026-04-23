# Tube Markets — Canonical Ship List

Eight market types, 10–20 concrete instances each. Every market below is backed by a measured signal (baseline values pulled from the 48h collector's latest cycle) and has a deterministic resolution path.

**Cadence assumptions empirically verified:**
- Xvideos stars: tick every 70–210 min; 24h Δ is typically +100k to +2M views
- Xvideos video pages: 1–2 ticks per hour, +5k–20k views per tick, **0 % CDN flips** (cleanest numeric signal in the dataset)
- Pornhub star listing: rank movement visible daily; K/M/B display rounds
- `/best/last-24` rollover: ~14:08 UTC (single confirmed datapoint; L2 will confirm schedule)
- Chaturbate: real-time per model, seconds-resolution

**Baseline data source:** `data-node/data/tube-rate-tests/collect-48h/run-20260421-2333/events.jsonl`

**Bots excluded from every Xnxx-touching market:** `candice-price-model`, `cedric-extra-model`, `johnny-liberty-model`, `violet-haze-extra-model`.

---

## Type A — "Star X gains ≥ N views in next 24h" (Xvideos)

**Structure:** binary threshold. Buy "Yes" if you think the star's lifetime views will go up by at least N over the next 24h. Resolution timestamp = creation + 24h.

**Threshold rule of thumb:** set N ≈ (recent 24h Δ) × 0.9 so the market is roughly 50/50.

| # | Market ID | Star | Baseline views | Threshold N | Question |
|---|---|---|---:|---:|---|
| A1 | `tubes_xv_star_skye-young2_24h_gte300k` | skye-young2 | 511,657,503 | +300,000 | Skye Young gains ≥ 300k views in 24h |
| A2 | `tubes_xv_star_lia-lin_24h_gte250k` | lia-lin | 594,040,270 | +250,000 | Lia Lin gains ≥ 250k in 24h |
| A3 | `tubes_xv_star_hot-pearl2_24h_gte400k` | hot-pearl2 | 592,671,875 | +400,000 | Hot Pearl gains ≥ 400k in 24h |
| A4 | `tubes_xv_star_sweetie-fox1_24h_gte350k` | sweetie-fox1 | 1,250,529,712 | +350,000 | Sweetie Fox gains ≥ 350k in 24h |
| A5 | `tubes_xv_star_shinaryen27_24h_gte200k` | shinaryen27 | 617,720,880 | +200,000 | Shinaryen gains ≥ 200k in 24h |
| A6 | `tubes_xv_star_stacy-cruz_24h_gte250k` | stacy-cruz | 794,237,341 | +250,000 | Stacy Cruz gains ≥ 250k in 24h |
| A7 | `tubes_xv_star_gina-gerson2_24h_gte300k` | gina-gerson2 | 1,947,930,694 | +300,000 | Gina Gerson gains ≥ 300k in 24h |
| A8 | `tubes_xv_star_natalie-cherie_24h_gte180k` | natalie-cherie | 819,429,178 | +180,000 | Natalie Cherie gains ≥ 180k in 24h |
| A9 | `tubes_xv_star_vale_nappi3_24h_gte1M` | vale_nappi3 | 3,036,108,816 | +1,000,000 | Valentina Nappi's xv profile gains ≥ 1M in 24h |
| A10 | `tubes_xv_star_carlacute3_24h_gte120k` | carlacute3 | 221,082,505 | +120,000 | Carla Cute gains ≥ 120k in 24h |
| A11 | `tubes_xv_star_anissa-kate1_24h_gte500k` | anissa-kate1 | ~1,831,200,000 | +500,000 | Anissa Kate gains ≥ 500k in 24h |
| A12 | `tubes_xv_star_katty-west_24h_gte800k` | katty-west | ~1,525,700,000 | +800,000 | Katty West gains ≥ 800k in 24h |
| A13 | `tubes_xv_star_luna-rival1_24h_gte250k` | luna-rival1 | ~942,500,000 | +250,000 | Luna Rival gains ≥ 250k in 24h |
| A14 | `tubes_xv_star_sharon-lee_24h_gte200k` | sharon-lee | ~1,156,100,000 | +200,000 | Sharon Lee gains ≥ 200k in 24h |
| A15 | `tubes_xv_star_cleagaultier_24h_gte200k` | cleagaultier-official1 | ~425,020,000 | +200,000 | Cléa Gaultier gains ≥ 200k in 24h |
| A16 | `tubes_xv_star_liza-del-sierra_24h_gte100k` | liza-del-sierra | ~544,400,000 | +100,000 | Liza del Sierra gains ≥ 100k in 24h |

**Resolution:** oracle reads star's `total_views` raw int at T and at T+24h. Binary outcome = (views_T+24h − views_T) ≥ N.

---

## Type B — "Star A vs Star B: who gains more views in 24h" (H2H Xvideos)

**Structure:** binary H2H. Pure relative speed. No threshold tuning — whoever gains more wins. Curated by closest-ranked / rival-niche pairs.

| # | Market ID | Pair | Baseline views | Question |
|---|---|---|---|---|
| B1 | `tubes_xv_h2h_sweetiefox_vs_kattywest` | sweetie-fox1 vs katty-west | 1.25B vs 1.52B | Who gains more views in 24h |
| B2 | `tubes_xv_h2h_anissakate_vs_valenappi3` | anissa-kate1 vs vale_nappi3 | 1.83B vs 3.04B | — |
| B3 | `tubes_xv_h2h_skyeyoung_vs_liza` | skye-young2 vs liza-del-sierra | 511M vs 544M | — |
| B4 | `tubes_xv_h2h_lialin_vs_hotpearl` | lia-lin vs hot-pearl2 | 594M vs 593M | Tightest pair in the dataset |
| B5 | `tubes_xv_h2h_natalie_vs_stacycruz` | natalie-cherie vs stacy-cruz | 819M vs 794M | — |
| B6 | `tubes_xv_h2h_ginaygerson_vs_anissa` | gina-gerson2 vs anissa-kate1 | 1.95B vs 1.83B | — |
| B7 | `tubes_xv_h2h_lunarival_vs_sharonlee` | luna-rival1 vs sharon-lee | 943M vs 1.16B | — |
| B8 | `tubes_xv_h2h_carla_vs_cleagaultier` | carlacute3 vs cleagaultier-official1 | 221M vs 425M | — |
| B9 | `tubes_xv_h2h_shinaryen_vs_skyeyoung` | shinaryen27 vs skye-young2 | 618M vs 511M | — |
| B10 | `tubes_xv_h2h_lialin_vs_shinaryen` | lia-lin vs shinaryen27 | 594M vs 618M | — |
| B11 | `tubes_xv_h2h_kattywest_vs_anissa` | katty-west vs anissa-kate1 | 1.52B vs 1.83B | — |
| B12 | `tubes_xv_h2h_hotpearl_vs_stacycruz` | hot-pearl2 vs stacy-cruz | 593M vs 794M | — |
| B13 | `tubes_xv_h2h_natalie_vs_shinaryen` | natalie-cherie vs shinaryen27 | 819M vs 618M | — |
| B14 | `tubes_xv_h2h_sweetiefox_vs_valenappi` | sweetie-fox1 vs vale_nappi3 | 1.25B vs 3.04B | — |
| B15 | `tubes_xv_h2h_sharonlee_vs_lunarival` | sharon-lee vs luna-rival1 | 1.16B vs 943M | — |

**Resolution:** oracle reads both stars' total_views at T and T+24h. argmax(Δ_A, Δ_B). Tie resolves to market convention (house / refund).

---

## Type C — "Pornhub rank: will star X move up or down in 24h"

**Structure:** binary. Rank_T+24h compared to Rank_T. "Up" = lower rank number (closer to #1). Suitable for PH because its ranking is published as an integer on the listing page.

| # | Market ID | Star | Baseline rank | Question |
|---|---|---|---:|---|
| C1 | `tubes_ph_rank_cory-chase_dir` | Cory Chase | 17 | Will Cory Chase's PH rank improve in 24h |
| C2 | `tubes_ph_rank_sisi-rose_dir` | Sisi Rose | 21 | — |
| C3 | `tubes_ph_rank_valentina-nappi_dir` | Valentina Nappi | 30 | — |
| C4 | `tubes_ph_rank_alyx-star_dir` | Alyx Star | 60 | — |
| C5 | `tubes_ph_rank_kira-noir_dir` | Kira Noir | 101 | — |
| C6 | `tubes_ph_rank_kendra-sunderland_dir` | Kendra Sunderland | 137 | — |
| C7 | `tubes_ph_rank_top10_shuffle` | top-10 cohort | — | ≥1 of today's top-10 drops out of top-10 in 24h |
| C8 | `tubes_ph_rank_new_entrant_top10` | universe | — | A star outside today's top-20 enters top-10 in 24h |
| C9 | `tubes_ph_rank_number1_holds` | current #1 | — | Current #1 is still #1 in 24h |
| C10 | `tubes_ph_rank_biggest_climber_top50` | top-50 | — | Multi-outcome: pick which of today's top-50 rises the most |

**Resolution:** oracle fetches `https://www.pornhub.com/pornstars?o=t` at T and T+24h, parses ranks from `class="rankNumber"`, compares.

---

## Type D — "Will current xvideos #1 survive until next rollover (~14:08 UTC)"

**Structure:** binary. Opens as soon as a rollover happens and current #1 is established. Closes at next expected rollover time. Based on 48h data: #1 almost always holds through the window — markets should price accordingly.

| # | Market ID | Current #1 | Window | Question |
|---|---|---|---|---|
| D1 | `tubes_xv_rollover_survival_2026-04-22` | today's #1 | 23 h until rollover | Will #1 slug at 14:08 UTC tomorrow equal current #1 |
| D2 | `tubes_xv_rank1_in_4h` | today's #1 | +4 h | Will current #1 still be #1 in 4h |
| D3 | `tubes_xv_rank1_in_8h` | today's #1 | +8 h | — |
| D4 | `tubes_xv_rank1_in_12h` | today's #1 | +12 h | — |
| D5 | `tubes_xv_rollover_top3_intact` | today's top-3 | until rollover | Will today's top-3 survive (any-stay-top-3) |
| D6 | `tubes_xv_rollover_top10_full_sweep` | today's top-10 | until rollover | Will 0/10 carry over (from data: almost certainly yes) |
| D7 | `tubes_xn_rank1_in_12h` | xnxx today's #1 | +12 h | Xnxx-equivalent |
| D8 | `tubes_xv_rollover_before_1400utc` | — | next 26 h | Will rollover happen before 14:00 UTC |
| D9 | `tubes_xv_rollover_before_1430utc` | — | next 26 h | — |
| D10 | `tubes_xv_rollover_before_1500utc` | — | next 26 h | — |
| D11 | `tubes_xv_rank2_becomes_rank1` | today's #2 | until rollover | Will today's #2 become tomorrow's #1 |

**Resolution:** oracle fetches `/best/last-24` at close time, reads the rank-1 slug. D5/D6 compute set overlap; D8–D10 compare actual rollover timestamp to threshold.

---

## Type E — "Video X view count at next rollover: range"

**Structure:** range bet on the raw integer view count at rollover time. Split into buckets (A–B / B–C / C–D / D+). The video page exposes a clean raw int with zero CDN alternation — most bulletproof numeric signal.

Targeted at the current top-15 on `/best/last-24` at market creation.

| # | Market ID | Video | Baseline views | Buckets (views at next rollover) |
|---|---|---|---:|---|
| E1 | `tubes_xv_vid_oulhtif7da0_eod_range` | oulhtif7da0 ("hard and deep blonde beauty") | 8.9M | <9.3M / 9.3–9.7M / 9.7–10.2M / >10.2M |
| E2 | `tubes_xv_vid_oudltli3a63_eod_range` | oudltli3a63 ("my former math teacher ai") | 2.0M | <2.05M / 2.05–2.15M / 2.15–2.3M / >2.3M |
| E3 | `tubes_xv_vid_ouchcbu9990_eod_range` | ouchcbu9990 ("19 very hot women") | 1.4M | <1.45M / 1.45–1.55M / 1.55–1.65M / >1.65M |
| E4 | `tubes_xv_vid_ouaeakf2e1f_eod_range` | ouaeakf2e1f ("don't cum in me please") | 4.8M | <4.85M / 4.85–4.95M / 4.95–5.05M / >5.05M |
| E5 | `tubes_xv_vid_oudutpoc919_eod_range` | oudutpoc919 ("busty stepmom") | 6.1M | <6.15M / 6.15–6.25M / 6.25–6.35M / >6.35M |
| E6 | `tubes_xv_vid_oucopuh9f0a_eod_range` | oucopuh9f0a ("big-booty mango's") | 3.9M | <3.95M / 3.95–4.05M / 4.05–4.15M / >4.15M |
| E7 | `tubes_xv_vid_ouaphlk5164_eod_range` | ouaphlk5164 ("tiny asian gf") | 392.8k | <400k / 400–410k / 410–425k / >425k |
| E8 | `tubes_xv_vid_oudieve1b45_eod_range` | oudieve1b45 ("this happened when sharing") | 3.6M | — |
| E9 | `tubes_xv_vid_ouchtid9430_eod_range` | ouchtid9430 ("1 min quickie") | 3.0M | — |
| E10 | `tubes_xv_vid_ouvehaab59b_eod_range` | ouvehaab59b ("stepfamily anal fuck fest") | 3.1M | — |
| E11 | `tubes_xv_vid_oubdvfh843c_eod_range` | oubdvfh843c ("the stepmother fucks") | 1.6M | — |
| E12 | `tubes_xv_vid_ouvbdbpcef6_eod_range` | ouvbdbpcef6 ("she doesn't have money") | 7.0M | — |
| E13 | `tubes_xv_vid_ouemkuk526f_eod_range` | ouemkuk526f ("wow i love getting gapped") | 1.7M | — |
| E14 | `tubes_xv_vid_oulvcde0192_eod_range` | oulvcde0192 ("i caught my step daughter") | 3.2M | — |
| E15 | `tubes_xv_vid_oudvdlff794_eod_range` | oudvdlff794 ("hot threesome") | 272.7k | — |

**Resolution:** oracle fetches video page at rollover time (~14:08 UTC), parses `<strong>N,NNN,NNN</strong>` raw int, awards the winning bucket.

---

## Type F — "Will cam model X still be online in 10 min" (Chaturbate)

**Structure:** binary. Resolves at T + 10 min. Markets created dynamically from the Chaturbate top-online list each cycle.

| # | Market ID | Subject | Resolution |
|---|---|---|---|
| F1–F20 | `tubes_cb_online_{username}_10min` | Top 20 currently-online cam models by viewer count | Oracle reads online-rooms list at T+10min; binary yes/no on presence |

Concrete examples (universe rotates — names are illustrative):

| # | Market ID | Sample model | Baseline viewers | Question |
|---|---|---|---:|---|
| F1 | `tubes_cb_online_{top1_username}_10min` | top-1 model | (varies) | Still online in 10 min |
| F2 | `tubes_cb_online_{top2_username}_10min` | top-2 | — | — |
| F3 | `tubes_cb_online_{top3_username}_10min` | top-3 | — | — |
| F4–F20 | same pattern | top-4 through top-20 | — | — |

**Resolution:** oracle calls Chaturbate affiliate API (already wired into data-node) at T+10min, checks if model's username is in online rooms with viewers ≥ 1.

---

## Type G — "Top cam model's viewer count: over/under N at T+5min" (Chaturbate)

**Structure:** over/under on an integer viewer count, 5-minute resolution.

| # | Market ID | Subject | Threshold pattern |
|---|---|---|---|
| G1 | `tubes_cb_viewers_top1_ou3000_5min` | current #1 online model | Over/under 3000 viewers in 5 min |
| G2 | `tubes_cb_viewers_top1_ou5000_5min` | current #1 | Over/under 5000 |
| G3 | `tubes_cb_viewers_top1_ou8000_5min` | current #1 | Over/under 8000 |
| G4 | `tubes_cb_viewers_top1_ou10000_5min` | current #1 | Over/under 10,000 |
| G5 | `tubes_cb_viewers_top3_combined_ou10000` | sum of top-3 | Combined over/under 10,000 |
| G6 | `tubes_cb_viewers_top5_combined_ou15000` | sum of top-5 | Combined over/under 15,000 |
| G7 | `tubes_cb_viewers_top10_combined_ou25000` | sum of top-10 | Combined over/under 25,000 |
| G8 | `tubes_cb_models_online_count_ou150` | count of rooms with >50 viewers | Over/under 150 rooms |
| G9 | `tubes_cb_models_online_count_ou200` | same | Over/under 200 |
| G10 | `tubes_cb_models_online_count_ou300` | same | Over/under 300 |
| G11 | `tubes_cb_top_model_up_or_down_5min` | current #1 | Viewer count up vs down from T |
| G12 | `tubes_cb_top1_vs_top2_gap_ou500` | top-1 minus top-2 | Gap over/under 500 viewers |
| G13 | `tubes_cb_new_entrant_top10` | universe | A model not in current top-10 enters top-10 in 5 min |
| G14 | `tubes_cb_top1_holds_5min` | current #1 | #1 model is still #1 in 5 min |
| G15 | `tubes_cb_total_tokens_ou_proxy` | — | Combined "users" field as rough activity proxy |

**Resolution:** Chaturbate affiliate API → `num_users` field per room → sum / compare.

---

## Type H — "Video X gains ≥ N views in next 2 hours" (Xvideos top historic)

**Structure:** binary threshold on 2-hour view delta. Targets the videos with the most sustained traffic — all-time top from `/best` (returns top-15 historic with their current lifetime views).

Thresholds tuned to S1 observations: 1–2 ticks per hour × 5k–20k views per tick → expect 10k–40k per 2h for moderate-traffic videos, more for heavy-traffic ones.

| # | Market ID | Video | Baseline views | Threshold N | Question |
|---|---|---|---:|---:|---|
| H1 | `tubes_xv_vid_oulhtif7da0_2h_gte60k` | oulhtif7da0 | 8.9M | +60,000 | Views up ≥ 60k in 2h |
| H2 | `tubes_xv_vid_ouvbdbpcef6_2h_gte50k` | ouvbdbpcef6 | 7.0M | +50,000 | — |
| H3 | `tubes_xv_vid_oudutpoc919_2h_gte45k` | oudutpoc919 | 6.1M | +45,000 | — |
| H4 | `tubes_xv_vid_ouaeakf2e1f_2h_gte35k` | ouaeakf2e1f | 4.8M | +35,000 | — |
| H5 | `tubes_xv_vid_oucopuh9f0a_2h_gte30k` | oucopuh9f0a | 3.9M | +30,000 | — |
| H6 | `tubes_xv_vid_oudieve1b45_2h_gte27k` | oudieve1b45 | 3.6M | +27,000 | — |
| H7 | `tubes_xv_vid_oulvcde0192_2h_gte24k` | oulvcde0192 | 3.2M | +24,000 | — |
| H8 | `tubes_xv_vid_ouvehaab59b_2h_gte24k` | ouvehaab59b | 3.1M | +24,000 | — |
| H9 | `tubes_xv_vid_ouchtid9430_2h_gte22k` | ouchtid9430 | 3.0M | +22,000 | — |
| H10 | `tubes_xv_vid_oudltli3a63_2h_gte15k` | oudltli3a63 | 2.0M | +15,000 | — |
| H11 | `tubes_xv_vid_ouemkuk526f_2h_gte12k` | ouemkuk526f | 1.7M | +12,000 | — |
| H12 | `tubes_xv_vid_oubdvfh843c_2h_gte12k` | oubdvfh843c | 1.6M | +12,000 | — |
| H13 | `tubes_xv_vid_ouchcbu9990_2h_gte10k` | ouchcbu9990 | 1.4M | +10,000 | — |
| H14 | `tubes_xv_vid_ouaphlk5164_2h_gte5k` | ouaphlk5164 | 392.8k | +5,000 | — |
| H15 | `tubes_xv_vid_oudvdlff794_2h_gte3k` | oudvdlff794 | 272.7k | +3,000 | — |

**Resolution:** oracle fetches each video's page at T and T+2h, parses `<strong>RAW_INT</strong>` view count, Δ ≥ threshold = Yes.

---

## Shared infrastructure

### Oracle data-read endpoints

| Source | URL | Field | Cadence |
|---|---|---|---|
| Xvideos star | `https://www.xvideos.com/pornstars/{slug}` | `<span class="mobile-hide">RAW_INT</span>` preceding `video views` | Poll 5 min |
| Xvideos video | `https://www.xvideos.com/video.{vid}/{slug_tail}` | `<strong>RAW_INT</strong>` | Poll 2 min (highest cleanliness) |
| Xvideos trending | `https://www.xvideos.com/best/last-24` | ordered list of video cards | Poll 5 min |
| Xnxx star | `https://www.xnxx.com/pornstar/{slug}` | `class="views">... RAW_INT video views` | Poll 5 min |
| Pornhub stars | `https://www.pornhub.com/pornstars?o=t` | rank + `viewsCount performerCount` K/M/B | Poll 5 min |
| Chaturbate | Affiliate API `/api/public/affiliates/onlinerooms/` | `num_users` per room | Every sync |

### Double-sampling protocol

For star and listing signals (5% CDN flip rate), poll twice 10 seconds apart per cycle. At resolution time, if A ≠ B, use majority across last 3 polls. For video-page signals (0% flip rate), single poll is sufficient.

### Resolution timestamp conventions

| Market horizon | Convention |
|---|---|
| 5 min, 10 min | Snap to next 5-min boundary |
| 2 h, 4 h, 8 h, 12 h | Snap to next hour boundary |
| 24 h | 00:00 UTC boundary OR matched to creation time + 24h |
| Until rollover | Detect first composition change in `/best/last-24`, within a 2h window around 14:08 UTC |

### Creation cadence

- **Type A, B, C** (24h markets) — create at 00:00 UTC daily, one per star / pair / target
- **Type D** (rollover) — create at rollover +1h, once per day
- **Type E** (video range) — create at rollover +1h on the top-15 trending
- **Type F, G** (cams) — rolling, continuously created/retired as models enter/leave top-N
- **Type H** (2h video) — create every 2h, rolling, on the top-15 all-time video list

### Asset IDs in data-node

All new asset types follow the `tubes_*` prefix that already exists:

```
tubes_xv_star_{slug}              — existing
tubes_xn_star_{slug}              — existing
tubes_ph_star_{slug}              — needs re-enabling (SSR back)
tubes_ep_star_{slug}              — needs re-enabling (SSR back)
tubes_xv_trend_rank{N}            — new: emits current rank-N slug
tubes_xv_video_views_{vid}        — new: emits per-video raw int
tubes_cb_model_{username}         — existing in chaturbate source
```

---

## Ship order

1. **F / G** (cam markets) — no new data-node work, Chaturbate source exists
2. **H** (2h video view threshold) — smallest data-node addition, validates bulletproof per-video signal
3. **E** (rollover range) — same data as H, different horizon
4. **A / B** (star 24h threshold / H2H) — uses existing star profile data
5. **C** (PH rank) — needs PH re-enablement in the Rust source (already in Python collector)
6. **D** (rollover survival) — needs rollover-detection trigger

That's 100+ concrete markets from 8 types, all measurable, all deterministic. Enough to fill a board for weeks.
