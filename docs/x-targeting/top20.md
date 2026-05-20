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

## DeFi data cohort (TVL / 24h vol shillers — niche check relaxed by request)

These accounts shill DefiLlama-style data — TVL, yields, funding, stablecoins, on-chain metrics. Discovery: tweet mentions of "defillama" + @defillama / @0xngmi official followings. The strict quant-niche regex was relaxed for this cohort; engagement and activity gates still apply. Verdict label `DATA`.

| # | Handle | Verdict | Followers | Discovery | One-line bio |
|---|---|---|---|---|---|
| 21 | **@DeFi_Dad** | DATA | 179,745 | defillama follow | DeFi super-user, educator, angel — daily DeFi feed, biggest reach |
| 22 | **@phtevenstrong** | DATA | 118,154 | defillama follow | "Calculator Guy" Founder DeFi Dojo — daily yield/TVL commentary |
| 23 | **@LefterisJP** | DATA | 72,508 | defillama follow | Founder @rotki portfolio tracker — daily DeFi posting |
| 24 | **@Vu_Benson** | DATA | 21,835 | defillama follow | CEO @AleaResearch — institutional crypto research for decision-makers |
| 25 | **@zerototom** | DATA | 17,500 | defillama follow | Builds perprates — Hyperliquid funding-rate aggregator |
| 26 | **@notnotstorm** | DATA | 16,267 | defillama follow | data @paradigm — V/F 2.47, 5,733 niche-engagement sum |
| 27 | **@eking0x** | DATA | 4,463 | defillama mention ×3 + follow | EIC @DLNews (DefiLlama News) — orbit weight 10 |

## Honorable mentions (#28-37)

- @KrisAbdelmessih (vol veteran), @littleVolSwan (gamma seller), @finn_hulse (vol idiom), @0xSnarks (Onyx founder), @variational_lvs/@mr_plumpkin (Variational founders), @TheSpeculator0 (options veteran), @Alice_comfy (Shinoji Research), @G3ni3sWish (HFT MM), @0xLightcycle (crypto quant), @hftgod (ex-Cambridge HFT)

## Key takeaways

- **Best discovery primitive**: intersection of multi-seed follow lists. Variant A1 surfaced 30+ real operators via cross-validation. The signal of "followed by 3+ operators we trust" beat every other angle.
- **Worst discovery primitive**: X communities (BTC-maxi heavy) and pinned-tweet mentions (product launches, not peer salutes).
- **The audit rubric is now the bottleneck**, not discovery. Real operators (Hummingbot CTO, ex-Citadel devs, Wintermute leadership, Selini Capital founder) keep surfacing and failing on `engage_consistent` (audience too quiet for view tier) or `niche_recent` (sparse posting).
- **The forbidden affiliations** (Polymarket, Kalshi, Meteora, Jupiter) reliably gated out KOLs. Zero false negatives reported.
- **The defillama cohort needs its own rubric**. The quant-niche regex catches market-maker jargon, not DeFi-data jargon (TVL, yields, stablecoins, oracle, bridge). For data-shillers, follow-graph proximity to @defillama / @0xngmi is the strongest signal — every viable candidate in this cohort was in their following list.
