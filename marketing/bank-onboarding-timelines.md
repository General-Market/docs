# How long a bank takes to onboard a trading counterparty

> **TL;DR** — A fresh institutional counterparty takes a bank **8–14+ weeks** end to end, often quoted as a **100-day** cycle. Contract negotiation alone eats **40–50%** of that time; KYC/AML eats another ~18%. The two true bottlenecks are the **ISDA/CSA legal redline** (4–12 weeks, up to 6 months) and the **committee/KYC review queues** (single review up to 60 days). CRX deletes both by being pre-funded and single-counterparty. All figures below are sourced.

---

## The headline numbers

| Metric | Figure | Source |
|---|---|---|
| Full institutional onboarding cycle | **Up to 100 days** (~8–14+ weeks), varies by product + geography | EY institutional onboarding survey |
| Share of time spent on **contract negotiation** | **40–50%** of the whole cycle | EY |
| Share on operational set-up | ~20% | EY |
| Share on AML/KYC + investment guidelines | ~18% | EY |
| Teams involved | **≥ 10 teams** for more than half of banks | EY |
| Single KYC/client review | **Up to 60 days** for 40% of banks | EY |
| KYC onboarding (corporate) | **90–120 days**, ~51 hours of manual labour | Fenergo / Encompass |
| FIs spending 61–150 days on a KYC review | **Over half** of institutions | Fenergo |

---

## Time per gate

Each gate below is one stage a bank clears before a counterparty can trade. The "slowest step" is the part that actually sets the calendar — usually a third party or a committee, not the paperwork.

| # | Gate | Typical time | Slowest step | Source |
|---|------|--------------|--------------|--------|
| 1 | **KYC / KYB** (identity, beneficial owners, source of funds) | **1–4 weeks**, up to 60–120 days for complex/high-risk | Untangling layered beneficial-ownership charts; Enhanced Due Diligence on source of wealth | EY, Fenergo |
| 2 | **AML / sanctions screening** | Days–2 weeks | Manually dispositioning sanctions/PEP **false positives** | Fenergo |
| 3 | **Regulatory classification + LEI** | 1–2 weeks | Client counter-signs MiFID/EMIR/Dodd-Frank status via their own legal | EY |
| 3a | — LEI issuance itself | **5 min – 24h**; 24–48h for private registries (BVI/Cayman); renewals/transfers up to **7 days** | Private/closed company registries; Level-2 parent data | LEI Worldwide, LEI Register |
| 4 | **Tax** (W-8/W-9, FATCA, CRS) | Days–1 week | W-8BEN-E filled wrong, bounces back 2–3 times | (industry standard) |
| 5 | **Credit assessment + limit** | **2–6 weeks** | Waiting for the **credit committee** slot; large limits escalate a tier | EY |
| 6 | **Legal docs — ISDA + CSA** | **4–12 weeks**; **71%** done within 6 months | Bilateral lawyer redline of Schedule + CSA; termination events + credit provisions delay **>60%** | ISDA 2024 Document Negotiation Survey |
| 6a | — UMR margin segregation (ACA + tri-party custody) | Adds weeks–months; full UMR prep **9–12 months** | A **third** party's lawyers (the custodian) join the redline; ACAs take longer than expected | Hedge Legal, OSTTRA |
| 7 | **Operational set-up** (SSIs, connectivity, test trade) | 1–2 weeks | Hand-confirmed settlement instructions + end-to-end penny test | EY |
| 8 | **Final approval** | Days–2 weeks | Waiting for the next **new-business committee** meeting | EY |

---

## Where the time actually goes

Strip the table down and almost all the calendar lives in **two places**:

1. **The ISDA / CSA / ACA legal redline (Gate 6).** This is the single biggest sink — 40–50% of the whole cycle. It is slow because it is **bilateral and bespoke**: every clause is negotiated for the specific pair, and under UMR a third party (the margin custodian) joins the table. Typical 4–12 weeks; 29% of cases run past 6 months.

2. **Committee and review queues (Gates 5 and 8).** The analysis is fast; the **approval** waits for a scheduled meeting. A single KYC review alone reaches 60 days at 40% of banks.

Everything else — tax forms, LEI, sanctions screening, SSIs — is measured in **days** and runs in parallel.

**And it runs both ways.** The client performs reverse due diligence on the bank (Wolfsberg AML questionnaire, ratings, financials), so the slow legal gate is really a **three-cornered, bidirectional negotiation**. That is why the ISDA alone usually sets the 6–12 week number.

---

## What it costs (not just time)

| Metric | Figure | Source |
|---|---|---|
| Cost of a single KYC review | **$1,501–$3,500** (two-thirds of respondents) | Corporate Compliance Insights / Fenergo |
| Large FI annual KYC spend (new clients) | **Up to $30M/year** | Fenergo |
| Average annual KYC + AML spend per FI | **$64.42M/year** | Fenergo |
| Cost for a bank onboarding 10,000 clients/year | **Up to $35M** | Fenergo |
| Staff on KYC tasks | 1,000–2,500 employees at >80% of firms | Fenergo |

---

## The CRX contrast

| Bank | CRX |
|---|---|
| ISDA/CSA redline, 4–12 weeks, bilateral | Standard on-chain **Terms** object, EIP-712 signature — no per-pair redline |
| Credit committee sets a credit line, 2–6 weeks | **Pre-funded collateral** — no credit extended, no committee |
| UMR margin to a tri-party custodian, +months | Margin custodian **is the chain** — no ACA |
| Bidirectional: client onboards the bank too | **Single counterparty** — you face CRX, CRX faces everyone. No mirror to negotiate. |
| 100 days, ≥10 teams | Deposit, sign Terms, submit RFQ |

**The bank studies you for a quarter so it can price the risk of trusting you. CRX takes the deposit so it doesn't have to.** The two slowest gates — the legal redline and the credit committee — are exactly the two CRX has no counterpart for.

---

## Glossary

- **ISDA Master Agreement** — the standard contract governing over-the-counter derivatives between two parties.
- **CSA (Credit Support Annex)** — the part of the ISDA that sets collateral terms (what counts, thresholds, calls).
- **ACA (Account Control Agreement)** — three-way agreement letting a custodian hold segregated initial margin under UMR.
- **UMR (Uncleared Margin Rules)** — post-2008 rules forcing initial margin to be posted to a segregated third-party custodian for uncleared derivatives.
- **KYC / KYB** — Know Your Customer / Business: verifying identity and ownership.
- **LEI (Legal Entity Identifier)** — a global 20-character code identifying a legal entity in financial transactions.
- **PEP** — Politically Exposed Person; triggers enhanced screening.
- **ECP** — Eligible Contract Participant; the institutional-only classification CRX assumes.
- **SSI (Standing Settlement Instructions)** — where and how a counterparty's payments settle.
- **Wolfsberg questionnaire** — the standard AML due-diligence questionnaire banks exchange.

---

## Sources

- [EY — Asset management institutional client onboarding survey](https://www.ey.com/content/dam/ey-unified-site/ey-com/en-us/insights/financial-services/documents/ey-asset-management-institutional-client-onboarding-survey-industry-trends-and-point-of-view.pdf)
- [McKinsey — Winning corporate clients with great onboarding](https://www.mckinsey.com/industries/financial-services/our-insights/winning-corporate-clients-with-great-onboarding)
- [ISDA — 2024 Document Negotiation Survey](https://www.isda.org/a/Ps8gE/ISDA-Document-Negotiation-Survey.pdf)
- [DRS — ISDA negotiations: causes of delay](https://drs-als.com/isda-negotiations-the-causes-of-delay-how-you-compare-and-what-you-can-do-about-it/)
- [Fenergo — Cost of KYC compliance / onboarding costing banks millions](https://resources.fenergo.com/newsroom/arduous-client-onboarding-and-kyc-costing-banks-millions)
- [Corporate Compliance Insights — KYC reviews cost $2,500+ per commercial client](https://www.corporatecomplianceinsights.com/kyc-review-cost-survey-2023/)
- [Encompass — Reduce end-to-end onboarding processing times](https://www.encompasscorporation.com/blog/reduce-end-to-end-onboarding-processing-times-by-32/)
- [Hedge Legal — Clearing up the Uncleared Margin Rules (UMR)](https://hedgelegal.com/uncleared-margin-rules-umr-a-comprehensive-guide-for-hedge-fund-and-asset-managers/)
- [OSTTRA — Initial Margin Preparation Guide](https://osttra.com/initial-margin-preparation-guide/)
- [LEI Worldwide — How long to get an LEI code](https://www.lei-worldwide.com/how-long-get-lei-code.html)
- [LEI Register — How long does it take to get an LEI](https://www.lei-identifier.com/how-long-does-it-take-to-get-an-lei/)
