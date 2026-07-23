# Variant A1e — Reverse Triangulation (Audience Overlap)

## Method recap
For each PASS account, pulled one page (200 most-recent) of followers. Built
frequency map: handle → set of PASS accounts that have them as a follower. The
expectation: handles following ≥3 PASS accounts are self-selected into the niche
in a way that forward-mining (whom operators follow) cannot find.

## Frequency distribution (sample depth: 200 followers per PASS, 7 PASS = 1,400 raw)
- Unique candidates: **1,372**
- ≥3 PASS overlap: **2** (both tiny: 0–57 followers — out of band)
- =2 PASS overlap: **24**
- =1 PASS overlap: **1,346**

## After band (1k–200k) + bio-keyword filter + exclusions (PASS/Tier2/audited)
- ≥2 PASS in band: **3** — but all weak bios (Web3 recruiter, prediction-market poet)
- ≥1 PASS in band with niche-positive bio score: **17** candidates

## Audited 8 (cache hits where possible)
| Handle | Verdict | Why |
|---|---|---|
| @abhayait | **PASS** | HyprEarn execution layer, all hard gates, 5/10 niche, identity-verified |
| @MatiasScalbi | FAIL | bio_not_kol fail (sells trading bots) |
| @robotevm | FAIL | cadence (0.34 posts/day), niche_recent<3 |
| @liabilitree | FAIL | inactive, no engagement |
| @Griffith100x | FAIL | age<1y, perps content creator |
| @DarkLord_gr | FAIL | "Lost it all to a hack, rebuilding publicly" — audience-building voice |
| @HyperOddX | FAIL | product shill (VOLX on Hyperliquid) |
| @SageWhale | FAIL | 55 posts/day — spam cadence |

## NEW vs A1-forward intersection (110 known handles)
**All 17 A1e candidates are NEW. Zero overlap with A1's ≥3 set.**

The two methods surface disjoint populations.

## Reflection: did A1e find a distinct distribution?
Yes — distinct, but lower-quality. A1-forward found the operators that operators
read: OrthogonalAlpha (15y HFT PM), Lebron (ex-Citadel), choffstein (Newfound CIO),
hftgod (ex-Cambridge quant). A1e found the people who *follow* operators: a long
tail of Hyperliquid ecosystem accounts, junior quants posting daily perp content,
and retail traders graduating into the discipline. The sample depth — 200 most-recent
followers per PASS — biases hard toward recent-follow noise. Wintermute interns and
Jane Street quants don't follow ThalexGlobal in the last 200 days; they followed two
years ago and have moved on.

## One survivor
**@abhayait** — execution-layer engineer (HyprEarn), YC-adjacent voice, niche bio,
healthy engagement. Promote to TIER 2 BIO-MATCH pending qualitative review.

## What the method actually tells us
The forward-mining and reverse-mining cohorts barely intersect. That's a feature,
not a failure. Forward-mining captures **respect**; reverse-mining captures **aspiration**.
The first list is who you'd hire. The second is who's reading the first list.
Both are useful for different campaigns — but for an operator-quality target audience,
forward-mining is decisively better.

## Spend
- Variant-attributable: ~$0.17 (7 follower pulls + 8 audits = mostly cache hits)
- Total session at end: $0.32 (prior baseline was $0.15)
