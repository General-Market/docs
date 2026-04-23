# Round 1 Consensus Log — Adversarial Audit of THE_70_PERCENT_STUDY.md

Three independent adversarial agents (A, B, C) audited the original 2,678-line draft. Each received distinct scope, identical six-test protocol (T1 Fabrication · T2 Math · T3 Attribution · T4 Chain · T5 Consistency · T6 Honesty). Agents did not see each other's findings during Round 1.

## Agent scopes

- **Agent A** — §0 arithmetic primer through §8 (Foundational Theory, Empirical Evidence, Adverse Selection, Regulation, M&A, Networks, Corporate Governance, Market Efficiency). 89 entries audited.
- **Agent B** — §9 through §16 + PM+ block (Options, Exec Comp, Fraud, Political, Short Selling, International, HFT/MEV, Prediction Markets, Polymarket-specific measurements). 57 entries audited.
- **Agent C** — §17 through §25 + Synthesis + Corpus Honesty + meta-audit. 55 entries + meta. Owned the compounding-model and e=10%-semantics meta-critiques.

## Critical issues (consensus, ≥2 agents or uncontested)

| # | Issue | Agent(s) | Resolution in revision |
|---|---|---|---|
| C1 | §0 arithmetic wrong at N=26 (fair 1,071% → 1,091.8%), N=52 (fair 11,640% → 14,104%; actual 175% → 180%; kept 2.3% → 1.97%; extracted 97.7% → 98.03%), N=100 (kept 0.04% → 0.053%; extracted 99.96% → 99.95%) | A | Table recomputed at full precision; §0.3 |
| C2 | §0 conservative threshold "~50 trades" at d=4% is wrong (correct ~33); aggressive "5 trades" at d=13% is wrong (correct ~10) | A | §0.3 restated |
| C3 | `e=10%` used inconsistently as both retail skill and insider edge. Load-bearing semantic flaw | B, C | §0.5 labels `e` explicitly as "gross edge available in market," not retail skill; retail skill ceiling separately cited at 1–3% |
| C4 | "Retail baseline ~16%" vs 69.9% flagged wallet win rate in Columbia-Haifa entry is a category error (16% is trader-level profitability from Sergeenkov, not a trade-level win rate) | B | Replaced with 50% coin-flip baseline per Columbia-Haifa's own framing |
| C5 | Compounding model assumes 100% capital per trade, iid, full reinvestment — not how retail actually trades. 77.9% at N=20 is a model artifact | C | §0.4 labels model explicitly as illustration; per-notional frame in §0.2 made primary |
| C6 | Synthesis claim "70% floor / 95% realistic / 99%+ ceiling" presented as literature finding — it is model output | C | Synthesis rewritten; "what the papers establish" separated from "what our model produces" |
| C7 | Kyle 1989 directionality reversed — study claimed "more insiders = more drag," paper shows aggregate rent falls to zero as n → ∞ | A | #11 rewritten |
| C8 | Cziraki-Gider "~$100B cumulative / ~$2.8B/year" not in the paper; fabricated aggregate | C | #176 rewritten; figures removed |
| C9 | ~20 entries carry fabricated specific percentages not in any source file: #20, #23, #26, #27, #29, #33, #49, #56, #72, #90, #93, #94, #95, #97, #98, #99, #100, #102, #104, #116, #117, #127, #137, #142, #145, #166, #168, and others | A, B, C | Each entry either softened to qualitative, removed, or explicitly labeled "author inference / removed per audit" |
| C10 | Huang-Stoll 1997 misattributed the "30–60% of spread" figure that belongs to Madhavan 2000 | A | #15 reattributed |
| C11 | #100 Wang et al. attribution wrong — actual paper is Knewtson-Nofsinger 2014 | B | Attribution corrected |
| C12 | #24 Jeng-Metrick-Zeckhauser journal misidentified (Review of Economic Studies vs correct Review of Economics and Statistics) | A | Corrected |
| C13 | #161 Barber-Odean 2000 numbers flipped (6.5% vs 17.9% reversed; correct framing is active quintile 11.4% vs market 17.9%) | C | #161 rewritten |
| C14 | #110 Ziobrowski 12% Senator alpha is contested by Eggers-Hainmueller 2013 (drops to ~2% with corrected benchmarks); study presented as settled | C | Contestation note added |
| C15 | 19 "Various" entries in §17–§25 with placeholder fields, uncertain authors, unverified venues. Not load-bearing | C | Disclaimer added at head of §17 |
| C16 | Kyle 1985 `√(σ²ᵥ/(σ²ᵥ+σ²ᵤ))` formula not in the paper | A | Removed from #2 |
| C17 | Carlton-Fischel 1983 "0.1–0.5% of market cap" figure not in the paper (it is a legal-economics essay, not an empirical paper) | A | #56 rewritten |
| C18 | Bhattacharya-Daouk 2002 "5% reduction" ambiguous between relative % and absolute pp | A | #49 disambiguated |

## Unresolved — deferred, not Round 2

- **PIN premium robustness** (Easley-Hvidkjaer-O'Hara 2002) — Duarte-Young 2009 critique; kept with caveat.
- **BIS 2022 MEV range** ($500M–$1B+) — Flashbots data gives $675M; flagged in entry #153.
- **Citations.md top-20 missing from papers.md** (Bagehot 1971, Amihud-Mendelson 1986, Admati-Pfleiderer 1988) — selection bias acknowledged in Corpus Honesty.

## Meta-audit conclusions (Agent C, adopted)

1. **Reframe around per-notional drag, not compounded 70% headline.** Done in §0.2.
2. **Drop the e=10% retail-skill claim.** Done in §0.5.
3. **Acknowledge counter-evidence papers.** Added to Synthesis §2 (Cowgill-Zitzewitz, Collin-Dufresne-Fos, Andersen-Bondarenko).
4. **Honest claim:** 8¢ per dollar, 4–40% annual account drag, observed Polymarket data (84% / 668 wallets / 71%), compounding as our model. This is the new headline.

## Selection test (Agent C)

Breakdown of 19 "Various" entries in §17–§25:
- 3 schema placeholders (#178, #180, #187)
- ~7 likely filler
- ~6 real-but-lazy

Cutting all 19 would not change the 8¢ conclusion. They are decorative, not load-bearing. The revised Corpus Honesty section admits this.

---

*Agent IDs (for continuation, if needed):*
- Agent A: `a969231b7d69c8d59`
- Agent B: `a12e6de05fc4e9e5c`
- Agent C: `ab6853e22e177e11c`
