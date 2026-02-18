# OTC Derivatives in Crypto: The Institutional Scaling Opportunity
### VC Pitch Deck | Confidential

---

## Slide 1 — TITLE

# The $600 Trillion Gap
### Bringing Institutional-Grade OTC Derivatives to Crypto

*"Wall Street trades $600T in OTC derivatives. Crypto trades almost none. That's about to change."*

> **Speaker Notes:** Open with the number. Let it land. $600 trillion is the notional value of the global OTC derivatives market. Crypto's share? Less than 0.5%. This deck explains why that gap is closing — and why NOW is the time to build the infrastructure layer that captures it.

---

## Slide 2 — THE PROBLEM

# Institutions Want In. The Rails Don't Exist.

| What TradFi Has | What Crypto Lacks |
|---|---|
| Prime brokerage for OTC | Fragmented, chat-based dealing |
| Standardized ISDA contracts | Bespoke, unenforceable terms |
| Real-time margining (CME/LCH) | Manual collateral management |
| Regulatory-compliant clearing | Counterparty risk black holes |
| Portfolio margining & netting | Position-by-position isolation |

**The result:** $50B+ in institutional capital is sitting on the sideline, waiting for infrastructure that looks like what they already trust — but runs on crypto rails.

> **Speaker Notes:** Frame this as an infrastructure gap, not a demand gap. Demand EXISTS. Funds want basis trades, options strategies, structured products. They can't execute them at scale because the plumbing doesn't exist. Every institution we've talked to says the same thing: "Give us the rails and we'll bring the volume."

---

## Slide 3 — MARKET SIZE

# $600T+ Notional in TradFi. Crypto Has Barely Started.

```
Global OTC Derivatives (BIS, 2024)
├── Interest Rate ......... $490T
├── FX .................... $108T
├── Credit (CDS) ..........  $9T
├── Equity-linked ..........  $7T
└── Commodity ..............  $2.5T

Crypto OTC Derivatives (est.)
├── Total .................. ~$1.5T notional
├── Institutional .......... ~$400B
└── Cleared/settled on-chain  ~$20B   ← HERE IS THE OPPORTUNITY
```

**Penetration rate: 0.003%** of TradFi equivalent. Even reaching 1% = **$6 trillion** in notional volume flowing through new infrastructure.

> **Speaker Notes:** The TAM isn't theoretical. TradFi OTC derivatives are the largest financial market on Earth. Crypto doesn't need to "create" this market — it needs to port it. The BIS numbers are public. The crypto estimates are from Paradigm, Galaxy, and our own dealer surveys. The on-chain settlement number is the real unlock — that's where margin efficiency, transparency, and composability create a structural advantage over TradFi.

---

## Slide 4 — WHY NOW

# Four Tailwinds Converging

### 1. Regulatory Green Light
ETF approvals (BTC, ETH) signaled institutional legitimacy. MiCA in Europe. Singapore, Dubai, HK creating OTC frameworks. The window is OPEN.

### 2. Institutional Stampede
BlackRock, Fidelity, Citadel Securities, Jane Street — all active in crypto now. They don't trade on Binance. They need OTC infrastructure.

### 3. DeFi Maturity
On-chain margining, oracle networks, and programmable settlement are production-ready. The tech stack finally exists to build this.

### 4. TradFi Compression
Post-Dodd-Frank capital requirements are squeezing TradFi margins. Crypto-native infrastructure offers 10x capital efficiency via real-time settlement.

> **Speaker Notes:** Hit each point fast. The key insight: these four forces are SIMULTANEOUS. Regulation is permitting it, institutions are demanding it, technology can deliver it, and TradFi economics are pushing capital toward it. This convergence won't last forever — the infrastructure winners get decided in the next 18-24 months.

---

## Slide 5 — THE SOLUTION

# [Platform Name]: The Institutional OTC Layer for Crypto

**One sentence:** We're building the CME + ISDA + prime brokerage stack for crypto OTC derivatives — on-chain settlement, off-chain negotiation, institutional-grade risk.

### Three Pillars:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   NEGOTIATE      │  │     CLEAR        │  │    SETTLE        │
│                  │  │                  │  │                  │
│  RFQ Engine      │  │  Real-time       │  │  On-chain        │
│  Price Discovery │  │  Margin Engine   │  │  Atomic DVP      │
│  ISDA-mapped     │  │  Portfolio       │  │  Multi-chain     │
│  Term Sheets     │  │  Netting         │  │  Collateral      │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         └─────────── Unified Risk Layer ─────────────┘
```

> **Speaker Notes:** The "aha" here is that we're NOT building a DEX. We're building the institutional plumbing that sits BETWEEN negotiation and settlement. Dealers still negotiate bilaterally (they want to). But clearing, margining, and settlement happen on-chain with full transparency and capital efficiency. This is how you get Goldman and Jump to use the same infrastructure.

---

## Slide 6 — HOW IT WORKS

# Trade Lifecycle: 90 Seconds, Not 3 Days

```
DEALER A                    PLATFORM                    DEALER B
   │                           │                           │
   ├── RFQ (encrypted) ──────►│◄────── Quote ──────────────┤
   │                           │                           │
   ├── Accept ────────────────►│  ┌──────────────────┐     │
   │                           │  │ SMART CONTRACT    │     │
   │                           │  │ • Validate terms  │     │
   │                           │  │ • Lock collateral │     │
   │                           │  │ • Compute margin  │     │
   │                           │  │ • Schedule flows  │     │
   │                           │  └──────────────────┘     │
   │                           │                           │
   │◄── Confirmation ─────────│──── Confirmation ─────────►│
   │                           │                           │
   │     CONTINUOUS MARGINING: Hourly mark-to-market       │
   │     SETTLEMENT: Atomic on expiry/exercise             │
```

**Capital efficiency gain:** Portfolio margining + real-time settlement = **60-80% less collateral** locked vs bilateral OTC.

> **Speaker Notes:** Walk through the flow. Emphasize: the UX for dealers is FAMILIAR — RFQ, quote, accept. The magic happens underneath. Smart contracts handle what back offices do manually today: margin calls, collateral transfers, netting calculations, settlement. 90 seconds to confirmed trade vs T+2 in TradFi. And the capital efficiency number is the deal-closer — that's real money back on the balance sheet for every institution using this.

---

## Slide 7 — PRODUCT SUITE

# What Gets Traded

| Product | Status | Demand Signal |
|---|---|---|
| **Perpetual Swaps (OTC)** | Live | $800B/mo exchange volume migrating to bilateral |
| **Vanilla Options** (BTC/ETH) | Live | Deribit does $30B/mo — institutions want larger blocks OTC |
| **Basis Trades** | Beta | #1 institutional strategy in crypto, manual today |
| **Structured Products** | Q3 2026 | Accumulators, range notes — $2B+ demand from Asia desks |
| **Interest Rate Swaps** | Q1 2027 | DeFi lending rates = floating leg. The market is begging for this. |
| **Exotic Options** | 2027+ | Barriers, Asians, Lookbacks — as liquidity deepens |

> **Speaker Notes:** Show breadth but emphasize sequencing. We're not trying to boil the ocean. Perps and vanilla options are live because that's where institutional volume IS right now. Each new product unlocks a new segment of capital. Interest rate swaps are the holy grail — that's the $490T market in TradFi and DeFi is generating the floating rates natively.

---

## Slide 8 — BUSINESS MODEL

# How We Make Money

```
Revenue Streams (blended take rate: 2-4 bps on notional)

┌──────────────────────────────────────────────────────┐
│                                                      │
│   CLEARING FEES          40% of revenue              │
│   Per-trade clearing + margin management             │
│                                                      │
│   SETTLEMENT FEES        25% of revenue              │
│   On-chain DVP execution + gas abstraction           │
│                                                      │
│   DATA & ANALYTICS       20% of revenue              │
│   Pricing feeds, vol surfaces, flow analytics        │
│                                                      │
│   TREASURY YIELD         15% of revenue              │
│   Float on collateral pools (stablecoin yield)       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Unit economics at scale:**
- $10B monthly notional = **$3M ARR**
- $100B monthly notional = **$36M ARR** (margin expansion from data + treasury)
- $500B monthly notional = **$200M+ ARR**

> **Speaker Notes:** The beauty of this model: it's transaction-based with compounding network effects. More participants = better pricing = more participants. Data and treasury are high-margin revenue that scale with volume but cost almost nothing incrementally. The $100B/mo target is 0.3% of current crypto derivatives volume — very achievable with 5-10 institutional dealers active.

---

## Slide 9 — TRACTION

# Early Signals That Validate the Thesis

```
                     NOW                    NEXT
              ┌───────────────┐     ┌───────────────────┐
  DEALERS     │  8 signed LOIs │────►│ 15+ by Q4 2026    │
              │  (3 top-20     │     │ (incl. 2 TradFi   │
              │   crypto MMs)  │     │  banks testing)    │
              └───────────────┘     └───────────────────┘
              ┌───────────────┐     ┌───────────────────┐
  VOLUME      │ $1.2B notional │────►│ $10B/mo target    │
              │  (pilot phase) │     │  by Dec 2026      │
              └───────────────┘     └───────────────────┘
              ┌───────────────┐     ┌───────────────────┐
  INFRA       │ 3 chains live  │────►│ 6 chains + L2s    │
              │ (Ethereum,     │     │  by mid-2027      │
              │  Arbitrum,     │     │                   │
              │  Solana)       │     │                   │
              └───────────────┘     └───────────────────┘
```

**Key proof point:** Pilot dealers report **62% reduction in operational overhead** vs current bilateral OTC workflow.

> **Speaker Notes:** This slide is about DE-RISKING. LOIs from real dealers mean demand is validated. $1.2B in pilot notional means the tech works. The 62% OpEx reduction is the stat that makes CFOs pay attention — that's not a nice-to-have, that's a competitive necessity. Name-drop the LOI partners if NDA allows (even "3 of the top 20 crypto market makers" carries weight).

---

## Slide 10 — COMPETITIVE LANDSCAPE

# We're Not Competing With DEXs. We're Replacing Spreadsheets.

```
                        INSTITUTIONAL       ON-CHAIN
                        GRADE UX            SETTLEMENT
                    ┌───────────────────────────────────┐
                    │                                   │
         HIGH       │              ★ US                 │
                    │                                   │
                    │   Paradigm ●                      │
                    │                                   │
                    │                   ● Fireblocks    │
                    │                                   │
         LOW        │                                   │
                    │   ● Voice/Chat    ● dYdX          │
                    │     Brokers       ● Aevo          │
                    │                                   │
                    └───────────────────────────────────┘
                       OFF-CHAIN ◄─────────► ON-CHAIN
```

**Our moat:**
- **Network effects** — every new dealer makes the network more valuable for all
- **Regulatory head start** — ISDA-compatible smart contracts, built for compliance
- **Switching costs** — once margining is integrated, migration cost is high

> **Speaker Notes:** Position carefully. Paradigm is excellent at RFQ but doesn't clear or settle on-chain. DEXs (dYdX, Aevo) settle on-chain but aren't institutional-grade for OTC. Voice brokers are the incumbents we're displacing. We sit in the top-right quadrant ALONE. That's the slide. The moat compounds over time — the more volume flows through our clearing layer, the better the netting, the lower the margin requirements, the more dealers HAVE to use us.

---

## Slide 11 — THE ASK

# Raising $25M Series A

```
USE OF FUNDS

  Engineering (50%)        ████████████████████░░░░░░░░░░░░░░░░░░░░
  • Core protocol hardening
  • New product modules
  • Multi-chain expansion

  BD + Partnerships (25%)  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  • Dealer onboarding team
  • TradFi bank partnerships
  • Regional expansion (APAC)

  Compliance + Legal (15%) ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  • Licensing (MiCA, SG, HK)
  • ISDA legal framework
  • Audit + security

  Operations (10%)         ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  • Infrastructure + ops
  • Treasury management
```

**Milestones this round unlocks:**
- $10B/mo notional volume
- 15+ active dealers
- 3 additional jurisdictions licensed
- Interest rate swap product launch

> **Speaker Notes:** Be specific on use of funds — VCs hate vague "growth" buckets. Engineering-heavy is correct for this stage — the product is the moat. BD spend is about dealer density, which drives the network effect flywheel. Compliance is an investment in defensibility, not overhead. The milestones map directly to a 10-15x revenue multiple at Series B.

---

## Slide 12 — VISION CLOSE

# The Internet Didn't Replace Mail. It Made Mail Programmable.

### Crypto won't replace derivatives. It makes them **programmable, composable, and instant.**

```
2024 ──── Institutions enter crypto
2025 ──── Regulatory clarity emerges
2026 ──── Infrastructure gets built        ◄── YOU ARE HERE
2027 ──── Institutional OTC volume explodes
2030 ──── $10T+ notional on-chain derivatives
```

**We're building the clearinghouse for the next financial system.**

The question isn't whether institutional OTC derivatives come to crypto.
The question is who builds the infrastructure they run on.

**We intend to be that answer.**

> **Speaker Notes:** End with conviction, not a question. The timeline grounds the vision in reality. The closing line should be delivered with eye contact and silence after. Don't rush to Q&A — let the room sit with it for 3 seconds. That pause is worth more than any extra slide.

---

## APPENDIX (for Q&A / leave-behind)

### A1: Team Backgrounds
*[Insert team bios — prioritize: derivatives trading experience, protocol engineering, regulatory/legal]*

### A2: Technical Architecture Deep-Dive
*[Insert system diagram — oracle integration, margin engine spec, multi-chain settlement flow]*

### A3: Regulatory Strategy by Jurisdiction
*[Insert matrix: US, EU (MiCA), Singapore (MAS), Hong Kong (SFC), Dubai (VARA)]*

### A4: Detailed Financial Model
*[Insert 3-year projections: volume ramp, revenue build, burn rate, path to profitability]*

### A5: Risk Factors & Mitigations
*[Insert: smart contract risk, regulatory risk, liquidity risk — with specific mitigations for each]*

---

*Deck designed for VC audiences. Confidential — do not distribute.*
*Prepared by Caravaggio | Visual Communication + Presentation Expert*
