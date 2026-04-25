# PvP markets — named pairs, two boards

> **Launch catalog. Active.**
> Lives in `nsgame/lib/markets/pairs.ts` as code. Decision to freeze at 25 and ship documented in `nsgame/docs/twenty-five-forever.md`.

A name is a category. Every market is one name against another. No name appears twice on the board.

| Board | Window | Markets | Formats | Names used |
|---|---|---:|---|---:|
| **Stars** | 4 h | 15 | gain race | 30 (each once) |
| **Cams** | 2 min | 10 | gain race + viewer total | 20 (each once) |

Total: 25 live markets. 50 names. No duplicates.

---

## Two metrics, three formats

| Metric | Stars | Cams |
|---|---|---|
| **Total** | lifetime views (raw int from profile) | current `num_users` per room |
| **Δ over window** | views(T+window) − views(T) | viewers(T+window) − viewers(T) |

| Code | Format | Question | Resolves on |
|---|---|---|---|
| **F1** | Gain race | Who gains more during the window? | sign of `ΔA − ΔB` |
| **F2** | Viewer total | Who has more viewers at the closing instant? | sign of `viewers_A(T+w) − viewers_B(T+w)` |

F1 is the bet on who is moving fastest. F2 is the bet on who is bigger at the end. They are not the same — a smaller room can win F1 and lose F2 in the same window.

Stars use F1 only. Cams use both.

---

## Board 1 — Stars (4-hour gain race, 15 named pairs)

> 30 stars. 15 fights. Each star fights once.

### Selection method

1. Universe = 30 hand-curated Xvideos pornstars with `tubes_xv_star_*` profile assets and lifetime views ≥ 200M (audience floor).
2. Sort the universe by lifetime views ascending.
3. Pair adjacent ranks: (1,2), (3,4), … (29,30). Tightest baselines = tightest 4-hour races.
4. Apply hard gate `min/max ≥ 0.40` per pair — every pair below clears it.
5. Each star appears in exactly one pair.

### The 15 markets

| # | A | B | Audience A | Audience B | Tightness | Window | Format |
|---:|---|---|---:|---:|---:|---|---|
| 1 | carlacute3 | siri-dahl | 221M | 360M | 0.61 | 4 h | F1 gain race |
| 2 | cleagaultier-official1 | kendra-lust | 425M | 510M | 0.83 | 4 h | F1 gain race |
| 3 | skye-young2 | liza-del-sierra | 511M | 544M | 0.94 | 4 h | F1 gain race |
| 4 | hot-pearl2 | lia-lin | 593M | 594M | **1.00** | 4 h | F1 gain race |
| 5 | nicole-aniston | shinaryen27 | 600M | 618M | 0.97 | 4 h | F1 gain race |
| 6 | lexi-luna | dani-daniels | 690M | 710M | 0.97 | 4 h | F1 gain race |
| 7 | angela-white | stacy-cruz | 720M | 794M | 0.91 | 4 h | F1 gain race |
| 8 | natalie-cherie | adriana-chechik | 819M | 880M | 0.93 | 4 h | F1 gain race |
| 9 | luna-rival1 | brandi-love | 943M | 950M | **0.99** | 4 h | F1 gain race |
| 10 | alexis-texas | mia-malkova | 980M | 1.10B | 0.89 | 4 h | F1 gain race |
| 11 | eva-elfie | sharon-lee | 1.10B | 1.16B | 0.95 | 4 h | F1 gain race |
| 12 | abella-danger | sweetie-fox1 | 1.20B | 1.25B | 0.96 | 4 h | F1 gain race |
| 13 | lana-rhoades | katty-west | 1.45B | 1.53B | 0.95 | 4 h | F1 gain race |
| 14 | riley-reid | anissa-kate1 | 1.70B | 1.83B | 0.93 | 4 h | F1 gain race |
| 15 | gina-gerson2 | vale_nappi3 | 1.95B | 3.04B | 0.64 | 4 h | F1 gain race |

**Resolution.** Oracle reads each profile's lifetime views at T and at T+4h. Higher Δ wins. Tie within 100 views → null/refund. Profile 404 → null/refund. Both flat → null/refund.

**Market ID:** `tubes_xv_pvp_f1_{slugA}__vs__{slugB}_4h_{epoch_start}`

**Cadence.** Pairs are static; window resolves every 4 hours; new instance fires immediately. 6 cohorts/day × 15 markets = 90 settlements/day on this board.

---

## Board 2 — Cams (2-minute window, 10 named pairs, two formats)

> 20 cam usernames. 10 fights. Each name fights once. Half the matches resolve on viewer gain, half on viewer total at T+2min.

### Universe — persistent roster (illustrative seed)

The data-node maintains a **persistent top-100 Chaturbate roster**: usernames online ≥ 5 hours/day across the last 14 days with ≥ 300 average viewers. The 20 names below are illustrative placeholders — production swaps each one for a real persistent username at deploy time.

| # | Username (illustrative) | Avg viewers (tier) |
|---:|---|---:|
| 1 | aria_blue | 4200 |
| 2 | sasha_riot | 3800 |
| 3 | amelia_couple | 3100 |
| 4 | jade_xo | 2700 |
| 5 | ruby_couple | 2400 |
| 6 | carmen_latina | 2200 |
| 7 | yui_asian | 1900 |
| 8 | zara_tease | 1700 |
| 9 | diva_milf | 1600 |
| 10 | lola_petite | 1400 |
| 11 | mona_ebony | 1200 |
| 12 | viv_french | 950 |
| 13 | rhea_german | 820 |
| 14 | elena_es | 740 |
| 15 | nova_german | 700 |
| 16 | nadia_trans | 600 |
| 17 | kai_solo_male | 510 |
| 18 | domme_velvet | 410 |
| 19 | mei_solo | 380 |
| 20 | foot_mistress | 320 |

### Selection method

1. Sort the live persistent roster by current viewer count.
2. Pair adjacent ranks. Tightest viewer counts = tightest 2-min races.
3. Each username appears in exactly one pair.
4. Format split: 5 gain race + 5 viewer total. Alternate by row to spread formats across tiers.
5. If any selected name goes offline before market creation, swap with the next eligible roster name and re-pair.

### The 10 markets

| # | A | B | Tier A | Tier B | Tightness | Window | Format |
|---:|---|---|---:|---:|---:|---|---|
| 1 | aria_blue | sasha_riot | 4200 | 3800 | 0.90 | 2 m | F1 gain race |
| 2 | amelia_couple | jade_xo | 3100 | 2700 | 0.87 | 2 m | F2 viewer total |
| 3 | ruby_couple | carmen_latina | 2400 | 2200 | 0.92 | 2 m | F1 gain race |
| 4 | yui_asian | zara_tease | 1900 | 1700 | 0.89 | 2 m | F2 viewer total |
| 5 | diva_milf | lola_petite | 1600 | 1400 | 0.88 | 2 m | F1 gain race |
| 6 | mona_ebony | viv_french | 1200 | 950 | 0.79 | 2 m | F2 viewer total |
| 7 | rhea_german | elena_es | 820 | 740 | 0.90 | 2 m | F1 gain race |
| 8 | nova_german | nadia_trans | 700 | 600 | 0.86 | 2 m | F2 viewer total |
| 9 | kai_solo_male | domme_velvet | 510 | 410 | 0.80 | 2 m | F1 gain race |
| 10 | mei_solo | foot_mistress | 380 | 320 | 0.84 | 2 m | F2 viewer total |

**Resolution at T+2min.**

| Format | Win condition |
|---|---|
| F1 gain race | larger Δ (`viewers_T+2min − viewers_T`) wins; ties → null |
| F2 viewer total | larger `viewers_T+2min` wins; ties → null |

In both formats: one side offline at T+2min → online side wins. Both offline → null/refund.

**Market ID:** `tubes_cb_pvp_{f1|f2}_{userA}__vs__{userB}_2m_{epoch_start}`

**Cadence.** New cohort every 2 minutes. 30 cohorts/hour × 10 markets = 300 settlements/hour on this board. Names persist across cohorts unless they drop from the roster (dropping → swap on next cycle).

---

## Standing rotation

Both boards run continuously:

```
on cohort_close(board):
    re-snapshot the universe
    re-rank, re-pair adjacent
    re-instantiate all N markets at T0 = now
    publish onchain
```

If a star or cam disappears between cohorts (404, offline > 1 cycle), the next cohort drops them and pairs the remaining roster cleanly. The board never doubles up; the board never drops below its target count unless the universe itself shrinks.

---

## Why this shape

- **One pair per name** — no fan watches their favourite lose three times in a row on three different markets. One fight per cohort.
- **Tightest baselines** — adjacent-rank pairing gives a 0.85+ tightness on most matches; the worst is 0.61 (carla vs siri) which is still bettable.
- **Two clocks** — 4h for stars matches the slow accretion of profile views. 2m for cams matches the speed of a streaming room.
- **Two formats on cams** — gain race rewards motion, viewer total rewards size at the closing bell. Same fight, different question.

15 + 10 = 25. Twenty-five live markets, fifty names, no repeats. Anything more would be vanity.
