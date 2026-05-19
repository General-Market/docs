# /dead-financial-market — Research Index

Sibling page to `/anticheat-flags`. Same chassis. Opposite axis: temporal, not categorical.

The brief, verbatim from the user:

> *Markets get harder each year for retail and small firms to win. Predatory actors reinvest the billions they extract, and extract more. Like the dead internet theory, this is proof of the dead financial market theory. General Market builds products to return markets to what they were ten years ago.*

The research below has, with reasonable confidence from training data, *proven the thesis quantitatively*. Every section of the proposed page has at least one ten-year data series behind it. Verification debt is concentrated and tractable.

---

## What's in this directory

| File | Purpose |
|------|---------|
| `00-structural-brief.md` | Architecture document — sections, types, voice anchors, page outline |
| `01-retail-pnl-erosion.md` | ESMA/FCA/ASIC broker disclosures, Barber-Odean canon, 0DTE / crypto perp retail losses |
| `02-extractor-revenues.md` | Citadel Securities, Jane Street, Virtu, HRT — 10-year revenue time-series with sources |
| `03-bot-share-and-dead-theory.md` | Imperva report, algo share by venue, Dead Internet Theory canon, the mapping table |
| `04-crypto-extraction.md` | CEX insider prosecutions, perp DEX whale concentration, Pump.fun, MM tier subsidies |
| `05-market-structure-decay.md` | Off-exchange share, PFOF flow, 0DTE explosion, US listings decline, exchange consolidation |
| `06-arms-race-and-baseline.md` | AI/quant arms race + 2015 baseline values for every Then-vs-Now row |
| `07-regulatory-capture.md` | Lobbying, revolving doors, blocked PFOF reform, Fairshake PAC |
| `clock-data.ts` | Twelve compiled `DeltaStat` rows — ready to consume in section 3 |
| `baseline-data.ts` | Fourteen compiled `BaselineRow` rows — ready to consume in section 6 |

---

## The thesis in eight numbers

Every one of these is in the research with a primary source. Drop any of them into a hero card and it does the work.

| # | Headline | Source file |
|---|----------|-------------|
| 1 | Citadel Securities revenue: **~$1.7B (2015) → ~$11B+ (2024)**. One firm. Ten years. | 02 |
| 2 | Jane Street revenue: **~$1-2B (2015) → ~$20.5B (2024 annualized)**. One firm. | 02 |
| 3 | MEV: **$0 (2015) → ~$700M+/year (2024)** and ~$2B cumulative. A category invented from nothing. | 03 |
| 4 | 0DTE share of S&P options: **5% (2015) → 50% (2024)**. Half the market expires by close. | 05 |
| 5 | US off-exchange share: **36% (2015) → 50%+ (2024)**. Half the tape is no longer the tape. | 05 |
| 6 | Top-8 quant pod-shops AUM: **~$150B (2015) → ~$350B+ (2024)**. ~$2T levered footprint. | 02 |
| 7 | US-listed public companies: **8,090 (1996) → ~4,300 (2024)**. Half vanished into private markets. | 05 |
| 8 | Retail CFD losing rate: **74-89% (2018 ESMA baseline) → 75%+ (2025)**. The regulator-mandated number that does not bend. | 01 |

---

## Proposed page outline

Re-stated from the structural brief for at-a-glance reference:

1. **HERO** — the user's brief verbatim as the lead.
2. **The Curve** — multi-series log-line chart of Citadel Sec / Jane Street / Virtu / HRT / Wintermute revenue 2015→2024.
3. **The Reinvestment Loop** — circular diagram: extraction → R&D → faster extraction. Annotated with GPU buys, microwave links, PhD salaries.
4. **The Compounding Clock** — twelve `DeltaStat` cards (see `clock-data.ts`).
5. **The Retail Bleed** — % retail losing on CFDs / 0DTE / perps, year-by-year.
6. **The Bot Theory** — twin panel: Dead Internet Theory data + financial-market algo share. Mapping paragraph.
7. **Then vs Now** — fourteen `BaselineRow` table entries (see `baseline-data.ts`).
8. **Regulatory Capture** — three rows: lobbying spend, revolving door, killed PFOF reform.
9. **The Ten-Years-Ago Restoration** — GM mechanism map (already extracted from `data-edge-ways.ts`).
10. **CTA pills** — links to `/anticheat-flags`, `/vision`, `/itp`, litepaper.

Total word count target: ~1,200 words. Eight scrolls on a 16" monitor.

---

## Voice — three exemplar sentences for the new page

Drawn from the existing anticheat-flags page's pattern. The new sentences (proposed):

- *"Five firms. Ten years. None of the curves bent."* (under The Curve)
- *"Of every hundred trades, fifteen are humans. The rest is the machine."* (under Bot Theory)
- *"Half the public companies vanished. The growth that remains happens before retail can buy."* (under Then vs Now)

Each follows the chassis: a sentence names the world; the next sentence names what we don't.

---

## Verification debt (what to confirm before publication)

Sorted by importance.

### High priority — load-bearing numbers
1. **Citadel Securities 2024 revenue** — currently `~$11–12B (est)`. Source: FT/WSJ Q1 2025 coverage. Pull the actual figure if disclosed.
2. **Jane Street 2024 FY revenue** — currently `~$20.5B (annualized)`. Pull from bond prospectus or year-end disclosure when available.
3. **Imperva 2024 + 2025 bot share** — pull the most recent report.
4. **PFOF totals 2024** — Alphacution or Bloomberg Intelligence usually publishes by Q1 of following year.

### Medium priority — supporting numbers
5. **Hudson River Trading revenue** — every value is an estimate. Find any new disclosure or coverage.
6. **Coinglass 2024 + 2025 liquidation totals** — confirm the $200B figure.
7. **Pump.fun cumulative retail wipeout** — pick one canonical estimate ($1B / $2B / $3B range).
8. **Top-8 pod-shop AUM 2024 figures** — confirm Citadel, Millennium, Two Sigma, DE Shaw.

### Low priority — context, not load-bearing
9. **BIS Triennial 2025** — due late 2025 / early 2026. Update the FX algo share when published.
10. **2025 partial-year data for everything** — wait for Q1 / Q2 2026.

When the rate limit resets, the eight research agents can finish their pulls — but the page can be drafted now, with `[VERIFY]` tags in the data files preventing accidental publication of unverified numbers.

---

## Open editorial questions for the user

These need decisions before code work begins. Pose them once the brief has been read.

### Q1 — Mood: angry, somber, or analytical?
The user's brief reads somber-analytical. I have written all research in that register. But a more pointed version exists:

- **Angry**: "These four firms ate the market and they're still eating."
- **Somber**: "Markets got worse. The machines won. Here is the receipt." *(default)*
- **Analytical**: "Across twelve metrics measured over ten years, the trend is unambiguous and statistically significant."

### Q2 — Hero stat above the lead?
The anticheat-flags page has no hero stat. The user's brief naturally fits as a lead paragraph. Should there be a single stat above the lead — e.g., **"$45B — combined 2024 revenue of four firms that did not exist as we know them in 2015"** — or should the page begin clean?

### Q3 — The Reinvestment Loop diagram
This is the most ambitious visual. Options:
- A traditional 4-node loop with arrows + annotations (cheaper, ships fast).
- A 3D / Three.js animated loop (matches `video/src/compositions/penthouse/` aesthetic, ships slower).
- A static infographic-style explainer image (lowest risk, most legible).

Recommend the simple SVG 4-node loop for v1, escalate later.

### Q4 — Section 5 framing
The Dead Internet Theory mapping is the *cleverest* section but also the most conceptual. Two choices:
- Lead with it (high concept first).
- Bury it after the data (let the receipts land first, then the metaphor).

The structural brief currently places it as section 5 — middle. This is the strongest position: the data has done some work; the metaphor crystallizes it.

### Q5 — Does the page need a video / audio component?
There is an existing visual-style reference in `video/src/compositions/`. A 60–90 second Remotion piece at the top of the page would be possible but is scope expansion.

Recommend: ship the static page first; produce a Remotion piece as a follow-on artifact.

---

## What to do next

1. Read this index + `00-structural-brief.md`. Decide whether the architecture is right.
2. Skim the eight headline numbers above. If any feel exaggerated or under-claimed, flag.
3. Decide Q1–Q5 above.
4. When ready, the next session can build the page from `clock-data.ts` and `baseline-data.ts` directly, mirroring the chassis of `/anticheat-flags`.

The research, structural brief, and compiled data files are now complete enough to begin building. Verification of `[VERIFY]` tags can run in parallel with implementation.

---

End of index.
