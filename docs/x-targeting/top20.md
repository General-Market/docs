# X-Targeting — Top 20 Findings

Session total: ~$1.51 spend across Apify + TwitterAPI.io. Cache: 2,223 profiles, 3,500+ tweets, ~270 unique handles audited.

## Verdict legend

- **PASS** — cleared all strict gates (hard pass + soft ≥ 4)
- **CONDITIONAL** — clears all hard gates, soft ≥ 3
- **BIO-MATCH** — bio + intersection signal verifies operator status; strict audit either failed on a soft edge or stalled (API endpoint issue)

## Table

| # | Handle | Verdict | Followers | Discovery | One-line bio |
|---|---|---|---|---|---|
| 1 | **@ThalexGlobal** | PASS | 3,001 | original seed | Institutional crypto-options exchange |
| 2 | **@chameleon_jeff** | PASS | 126,030 | Armv7lFx follows | Hyperliquid CEO Jeff Yan — "building a pretty good house for all finance" |
| 3 | **@NeutraFinance** | PASS | 17,131 | reply harvest | Onchain vault / structured products niche brand |
| 4 | **@RoboNetHQ** | PASS | 6,330 | jargon search | "world's first prompt to quant execution engine" |
| 5 | **@quantymacro** | PASS | 35,740 | Armv7lFx follows | "self taught hedge fund quantitative macro tradooor" |
| 6 | **@rf_extended** | PASS | 5,009 | Armv7lFx regex-miss | Founder @extendedapp, formerly @Revolut |
| 7 | **@0xLoris** | PASS | 14,051 | Armv7lFx follows | "Founder @ Crypto HFT MM // Founder @LorisTools" |
| 8 | **@cardosofede** | CONDITIONAL | 3,352 | reply harvest | CTO @Hummingbot — open-source MM framework |
| 9 | **@DrJStrategy** | CONDITIONAL | 98,744 | institutional probe | Chief Market Strategist Wellington Altus, PhD Econ |
| 10 | **@extendedapp** | CONDITIONAL | 29,048 | Armv7lFx follows | "Perp Dex built by ex-@Revolut team" |
| 11 | @DrDavidSimic | BIO-MATCH | 1,630 | A1 intersection (3 seeds) | Crypto MM & quant research, ex-Citadel, building @botfedai |
| 12 | @bookdepth | BIO-MATCH | 10,200 | A1 intersection (2 seeds) | "adversely selected against in the marketplace of ideas" |
| 13 | @annanay | BIO-MATCH | 8,549 | Armv7lFx follows | Founder/CEO @QFEX (HFT firm) — fails cadence (0.37/day) |
| 14 | @ArturSepp | BIO-MATCH | 50k+ | A1 intersection | Risk Magazine Quant of the Year, vol veteran |
| 15 | @Quantaraum | BIO-MATCH | 7,357 | A1 intersection | "Making Markets @cyclosresearch" |
| 16 | @galois_capital | BIO-MATCH | — | A1 intersection | Kevin Zhou's crypto quant fund |
| 17 | @gametheorizing | BIO-MATCH | — | A1 intersection | Founder @SeliniCapital (real MM firm) |
| 18 | @anthdm | BIO-MATCH | 27,982 | Protocol A original | Former exchange engineer & MM, now CEO @MMT_Official_ |
| 19 | @GrantStenger | BIO-MATCH | — | A1 intersection | Kinetic CEO, ex-Jane Street |
| 20 | @mikevanrossum | BIO-MATCH | 7,594 | A1 intersection | HFT @folkvangtrading |

## Honorable mentions (#21-30)

- @KrisAbdelmessih (vol veteran), @littleVolSwan (gamma seller), @finn_hulse (vol idiom), @0xSnarks (Onyx founder), @variational_lvs/@mr_plumpkin (Variational founders), @TheSpeculator0 (options veteran), @Alice_comfy (Shinoji Research), @G3ni3sWish (HFT MM), @0xLightcycle (crypto quant), @hftgod (ex-Cambridge HFT)

## Key takeaways

- **Best discovery primitive**: intersection of multi-seed follow lists. Variant A1 surfaced 30+ real operators via cross-validation. The signal of "followed by 3+ operators we trust" beat every other angle.
- **Worst discovery primitive**: X communities (BTC-maxi heavy) and pinned-tweet mentions (product launches, not peer salutes).
- **The audit rubric is now the bottleneck**, not discovery. Real operators (Hummingbot CTO, ex-Citadel devs, Wintermute leadership, Selini Capital founder) keep surfacing and failing on `engage_consistent` (audience too quiet for view tier) or `niche_recent` (sparse posting).
- **The forbidden affiliations** (Polymarket, Kalshi, Meteora, Jupiter) reliably gated out KOLs. Zero false negatives reported.
