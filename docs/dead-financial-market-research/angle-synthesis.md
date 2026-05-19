# Angle Synthesis — Which Frame Wins

Four angles researched. Each has a headline stat. Picking the right frame is the most important decision before code starts.

---

## The four candidates, side by side

### A · Account Half-Life

**Sharpest stat**: On Hyperliquid, **40.6% of analysed wallets went silent within 30 days**. 66.4% of quitters underwater. Median retail perp account dies in under a month. (ENVY Protocol, 10,000-wallet on-chain study, Nov 2024.) Reinforced by Brazil (97% lose past 300d), Taiwan (~2-year half-life, 15% reach Y3), Pump.fun (>60% lose, <3% earn >$1K), prop firms (86%+ fail first evaluation).

**Voice**: tragic, intimate. About a person.

**The page that follows from it**: *the receipt of human attrition*. Survival curves overlaid across continents. The "your account dies in X months" frame.

**Risk**: borders on tabloid if not anchored tightly to the structural cause. Could read as a self-help warning ("don't day trade!") rather than an indictment of the market.

---

### B · Compute / Labor Asymmetry

**Sharpest stat**: Jane Street pays each new-grad PhD roughly **$1.2M Y1**. There are ~10,000 retail accounts per HFT employee. Every retail account exists, on net, to fund ~$100/year toward the PhD trading against it. The retail trader uses a laptop and Reddit. The firm extracting from them uses ~1 H100 GPU per employee, $50M+/yr in data feeds, $1M+/yr microwave links.

**Voice**: indignant, mathematical. About a ratio.

**The page**: a story of *industrial asymmetry*. The factory vs the laptop.

**Risk**: feels like a class-war angle, which the GM brand may or may not want. The numbers are unimpeachable; the framing has political resonance.

---

### C · Mathematical Inevitability

**Sharpest stat / line**: *Glosten-Milgrom 1985 — a forty-year-old theorem proves uninformed traders must lose in expectation by the amount that compensates the dealer for adverse selection.* Budish-Cramton-Shim (2015 QJE) prove the latency arms race extracts socially-wasteful rent and propose **batch auctions** as the cure. Aquilina-Budish-O'Neill (2022) measure the rent at ~$5B/year globally. Schwarz et al. (2025 JF) measure retail's effective spread at 7-46 bps round-trip.

**Voice**: austere, intellectual. About a proof.

**The page**: *the math of the bleed.* Each section becomes the empirical surface of a citable theorem. The closer is GM-as-implementation-of-Budish-Cramton-Shim.

**Risk**: might feel academic. The visceral retail reader could glaze over. But the credentialed audience (institutional, policy, journalist) eats this up. Also: the closer writes itself — *"We didn't invent this. Budish, Cramton, and Shim proposed it in 2015. We engineered it."*

---

### D · The Exclusion

**Sharpest stat**: **86% of US households are legally barred from buying into private rounds**. Combined private valuation of the top ~20 US unicorns (SpaceX, OpenAI, Stripe, Anthropic, ByteDance...) exceeds **$1 trillion** — retail cannot directly buy any of it. Median IPO age went from ~7 years (1990s) to ~12+ years (2020s). Private-market AUM grew from ~$4.5T (2015) to ~$15T+ (2024).

**Voice**: structural, observational. About a wall.

**The page**: *the locked-out market.* The reader is not extracted from; the reader is shut out. The growth happened in rooms retail isn't allowed to enter.

**Risk**: less *visceral* than the other three. Doesn't make retail bleed; makes retail feel locked out, which is a different (perhaps milder) emotion. But it's the most defensible angle politically — no "we are bleeding" rhetoric, just "look at the gate."

---

## The decision matrix

| Angle | Visceral | Defensible | Credentialed-respect | Naturally bridges to GM | Risk |
|-------|----------|------------|----------------------|--------------------------|------|
| A — Half-Life | ★★★★★ | ★★★★ | ★★★ | ★★ | self-help vibe |
| B — Asymmetry | ★★★★ | ★★★★★ | ★★★ | ★★ | class-war vibe |
| C — Math | ★★ | ★★★★★ | ★★★★★ | ★★★★★ | academic vibe |
| D — Exclusion | ★★★ | ★★★★★ | ★★★★ | ★★★ | mild emotional pull |

---

## My recommendation

**Use C as the spine. Lace in A, B, D as the empirical sections.**

The page becomes:

- **H1**: a Cioran sentence that names the theorem.
- **Lead**: the brief the user wrote. Verbatim. The Cioran register.
- **Section 1 — The Theorem**: Glosten-Milgrom, in a 90-word explainer. One pull quote. Maybe an equation as ornament. *"Uninformed traders must lose. The market structure requires it. The argument is from 1985."*
- **Section 2 — The Compounding** (uses A's data): the survival curves. Hyperliquid 40.6% in 30 days. Brazil 97% past 300d. Pump.fun >60%. The half-life is shrinking.
- **Section 3 — The Curve** (uses original research file 02): Citadel Sec / Jane Street / Virtu revenue. The same five firms compound the rent the theorem requires.
- **Section 4 — The Industry** (uses B's data): one H100 per employee. $1.2M new-grad. The factory.
- **Section 5 — The Wall** (uses D's data): IPO drought, accredited-only, $1T+ in unicorns retail cannot buy. The exclusion.
- **Section 6 — Then vs Now** (already compiled in `baseline-data.ts`): fourteen rows. The decade-long shape.
- **Section 7 — Regulatory Capture**: brief. Why the curve doesn't bend.
- **Section 8 — The Restoration**: GM as Budish-Cramton-Shim implementation. *"We did not invent this. They proposed it in 2015. We engineered it."*

This frame is durable. It does not require the reader to feel sorry for anyone. It is not a complaint. It is an audit of a known-broken structure.

---

## Alternative — if visceral wins

If the user wants the page to *hit*, swap to **A as spine, C as the explainer in section 2.**

- **H1**: *On Hyperliquid, four in ten accounts are silent within a month.*
- **Lead**: the survival curves first. The bleed first.
- Then bring in C ("And the math says this must happen. Here is the theorem from 1985.")
- The rest of the structure stands.

This is the more *journalistic* page. Less reverent, more pointed. Also more shareable on social — "40% in 30 days" is a screenshot-grade stat.

---

## Both are right

The two best framings are:
- **C-spine** = the durable, institutional-respect, theory-backed page. Better for partnerships, fundraising decks, regulator conversations. Cioran's intellectual register.
- **A-spine** = the visceral, journalistic, sharable page. Better for top-of-funnel, social, partner-mentions. Cioran's tender-rage register.

Both can use B and D as embedded sections. Both close on the GM restoration.

The user picks the spine. The structure is otherwise identical.

---

## What I am not recommending

- A page that tries to be all four spines at once. The frame must be singular. The supporting angles can carry sections; only one carries the H1.
- A page that uses **Industrialization** as the H1 (the phrase I proposed earlier). "Industrialized losing" is a good *section sub-head*. It is not big enough to carry the page — too compressed, too rhetorical.
- A page that opens with the Dead Internet Theory analogy. That works as a section pivot (it's already mapped in research file 03) but is not load-bearing enough to be the spine.

---

## Verification debt across the four angles

Highest priority (`[VERIFY]` before publish):

1. ENVY Protocol Hyperliquid 40.6% stat — confirm the snapshot methodology and the source link still resolves.
2. Jane Street GPU fleet size — currently "thousands to tens of thousands." Pull the latest Bloomberg / The Information figure.
3. Jane Street new-grad Y1 comp — pull canonical 2024 WSJ figure.
4. Budish-Cramton-Shim QJE URL — make sure it resolves.
5. Aquilina-Budish-O'Neill QJE URL — already in `data-edge-ways.ts`, confirm.
6. Schwarz et al. 2025 J Finance — pull either the journal URL or SSRN.
7. McKinsey Global Private Markets Review 2024 — pull latest AUM number.
8. GAO accredited-investor count — pull canonical citation.

When the rate limit resets, hand these to a focused agent to chase down one by one. Sixty minutes of cleanup.

---

End of file.
