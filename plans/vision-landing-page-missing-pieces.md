# Vision Landing Page — Structural Decisions (20% Conversion Target)

Every decision below is backed by conversion data. No opinions — just what works.

---

## 1. HERO (2 seconds to hook)

**Decision: Product-embedded hero with stat headline**

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ● LIVE · 1,047 markets · 12,384 predictions today      │
│                                                          │
│  [Headline: one stat, 7th-grade reading level]           │
│  [Subheadline: one sentence of context]                  │
│                                                          │
│  [ Primary CTA ]        [ Browse Markets ]               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │                                                  │    │
│  │   EMBEDDED PRODUCT PREVIEW                       │    │
│  │   (live market grid, 2×3 tiles, real data,       │    │
│  │    trader counts visible, updating live)          │    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Why:** Top-performing crypto pages (Uniswap, Jupiter) embed the product in the hero. The product IS the pitch. Visitors who see real data in the hero scroll less and convert more.

**Headline options (all 7th-grade, all stat-first):**
- "1,000 markets. 19 traders each."
- "19 traders per market. Polymarket averages 1,200."
- "Predict volcanoes, 4chan, ISS altitude. 19 people per market."

**Live counter in eyebrow:** Markets live · Predictions today · Last payout X sec ago. Proves the platform is real before they read a word.

---

## 2. PAGE FLOW (4 sections, not 10)

```
SECTION    JOB                         TIME TO READ
──────────────────────────────────────────────────────
1. Hero     Hook + product preview       5 sec
            CTA #1 (for ready visitors)
2. Proof    1-2 compressed arguments     10 sec
            CTA #2 (for convinced)
3. Demo     Interactive market grid      30-120 sec
            (browse, filter, click)
            CTA #3 (inside the demo)
4. Close    Endowed progress CTA         3 sec
            + risk reversal pills
```

**Total scroll:** Under 3 viewport heights on desktop. Under 5 on mobile.

**What we cut:**
- ~~How It Works section~~ → 1 line under the demo: "Pick markets. Predict up/down (sealed). Winners split the pot."
- ~~6-month timeline section~~ → 2 sentences in proof: "After 6 months on Polymarket: 58 bets, edge gone. On Vision: 31,000 bets, still compounding."
- ~~Social proof section~~ → Live counter in hero eyebrow + activity feed inside demo
- ~~Built for Bots section~~ → Code snippet inside demo, or in docs link
- ~~Strategy privacy section~~ → 1 sentence: "Bets are sealed (hashed). Nobody copies."
- ~~Before/after sections~~ → Compressed to 1 card in proof section

**Principle:** Every section that doesn't directly lead to the CTA is a section that bleeds conversion.

---

## 3. TARGET AUDIENCE

**Decision: Product-first, audience-agnostic**

Not AI-first. Not human-first. Product-first.

The interactive market grid works for everyone:
- AI builder sees trader counts (19, 4, 7) and thinks "my bot would crush here"
- Manual trader sees market names (4chan, anime, ISS) and thinks "I know this stuff"
- Curious browser sees live data updating and thinks "this is real"

The product demo does the audience segmentation automatically. No need for split paths or persona cards.

**Bot-specific content:** A "For Developers" link in the nav → docs page with SDK, API, code examples. Not on the landing page. The landing page converts everyone; the docs page converts developers.

---

## 4. HOW IT WORKS

**Decision: 1 line, not a section**

```
Pick markets → Predict up/down (sealed) → Winners split the pot · 0.3% on profit only
```

Appears as a caption under the interactive demo, not as its own section. Technical users figure it out by browsing the grid. Non-technical users need 1 sentence, not 3 boxes.

**Why not 3 steps:** Pages with fewer elements convert 2x better. A 3-step explainer that takes 10 seconds to read loses visitors who could spend those 10 seconds browsing real markets.

---

## 5. CTA STRATEGY

**Decision: 3 placements, 1 action, progressive commitment**

| Placement | CTA | Who clicks it |
|-----------|-----|---------------|
| Hero (section 1) | "Start Trading" + "Browse Markets" | Ready visitors + curious browsers |
| After proof (section 2) | "Start Trading" | Convinced by the stats |
| Inside demo / bottom (section 3-4) | "Connect & Trade" + pills | After browsing the grid |

**CTA text: "Start Trading"** — not "Enter Vision" (too vague), not "Deploy Your AI" (too niche), not "Connect Wallet" (too technical). "Start Trading" is the action they want to take.

**Secondary: "Browse Markets"** — scrolls to demo grid. Zero commitment. For the 80% who aren't ready to trade yet.

**Endowed progress at bottom:**
```
You browsed 12 markets. You're 1 click from your first trade.
[ Connect & Trade ]
```

---

## 6. RISK REVERSAL

**Decision: Pills under every CTA, not a section**

```
[ Start Trading ]

0.1 USDC min · No KYC · 5-min resolution · No leverage · No liquidation · On-chain
```

Same 6 pills. Always directly under the CTA button. Never as a standalone section. These are anxiety reducers, not arguments.

---

## 7. SOCIAL PROOF

**Decision: Embedded in product, not standalone**

No social proof section. Instead:

**In hero eyebrow:** "● LIVE · 1,047 markets · 12,384 predictions today"
**In market grid tiles:** Each tile shows trader count (19, 4, 7) — this IS social proof
**In grid footer:** Scrolling activity feed: "🤖 predicted UP on /biz/ · 3s ago"

Social proof works at decision points. The market grid IS the decision point.

---

## 8. THE DEMO

**Decision: Interactive market grid, ungated, IS the landing page**

This is the single highest-leverage element.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│ [All] [Crypto] [Tech] [4chan] [Weather] [Space] [Anime] [Macro]  │
│                                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │🌋Kilauea │ │📡 /biz/  │ │🛰 ISS    │ │📦 npm    │ │🎮 CS2   ││
│ │alert: 2  │ │+12%/hr   │ │412.3 km  │ │react +3% │ │847k CCU ││
│ │▁▂▃▂▃▄▅▃ │ │▅▆▇█▇▆▅▄ │ │▃▂▁▂▃▂▁▂ │ │▁▂▃▄▅▆▇█ │ │▆▇█▇▆▅▄ ││
│ │7 traders │ │23 traders│ │4 traders │ │11 traders│ │31 traders││
│ │  [UP]    │ │  [UP]    │ │  [UP]    │ │  [UP]    │ │  [UP]   ││
│ │  [DOWN]  │ │  [DOWN]  │ │  [DOWN]  │ │  [DOWN]  │ │  [DOWN] ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│                                                                  │
│ Pick markets → Predict up/down (sealed) → Win the pot            │
│                                                                  │
│ 🤖 predicted UP on "/biz/" · 3s ago                              │
│ 🤖 claimed $42 from "Tokyo weather" · 11s ago                    │
│ 👤 predicted DOWN on "ISS altitude" · 18s ago                    │
│                                                                  │
│        [ Connect & Trade ]   0.1 USDC min · No KYC               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key design choices:**
- UP/DOWN buttons visible on each tile but greyed until wallet connected
- Clicking UP/DOWN triggers wallet connect flow (endowed progress: they already chose)
- Trader counts visible on every tile (the argument makes itself)
- Activity feed at bottom of grid (urgency)
- Category tabs (breadth visible instantly)
- Real data updating live (credibility)
- No gate: browse everything without connecting

**Sandbox mode:** If user clicks UP/DOWN without wallet:
```
"You predicted UP on Kilauea alert level.
Connect a wallet to make it real. 0.1 USDC minimum."
[ Connect Wallet ]   [ Keep Browsing ]
```
This is the endowed progress pattern. They already made a choice. Now they just need to confirm it.

---

## 9. VISUAL DESIGN SYSTEM

**Decision: Clean dark with data density (Bloomberg lite)**

- Background: #0a0a0a
- Text: white (#ffffff) for headings, #a0a0a0 for body
- Accent: #00e676 (green) for positive / CTA / trader counts
- Secondary accent: #42a5f5 (blue) for data values
- Heading font: Inter (clean, readable, fast load)
- Data font: JetBrains Mono (market tiles, trader counts, prices)
- Card bg: #141414 with 1px #222 border
- Market tiles: dense but clean. Sparklines in #00e676/30% opacity
- CTA button: solid #00e676, black text, rounded 8px
- Glassmorphism: nav bar only (subtle blur, no overuse)

**Loading speed:** Under 2 seconds. Each extra second costs 7% conversion. No heavy animations. No video autoplay. Market data loads async — grid skeleton appears instantly.

---

## 10. MOBILE EXPERIENCE

**Decision: The grid IS the mobile page**

```
MOBILE FLOW:
┌─────────────────────────┐
│ ● LIVE · 1,047 markets  │ ← eyebrow
│                          │
│ 19 traders per market.   │ ← headline
│ Polymarket: 1,200.       │
│                          │
│ [ Start Trading ]        │ ← CTA #1
│ [ Browse Markets ↓ ]     │
└─────────────────────────┘
         ↓ scroll
┌─────────────────────────┐
│ [Crypto][4chan][Space]... │ ← tabs (horizontal scroll)
│                          │
│ ┌──────────┐┌──────────┐│
│ │🌋Kilauea ││📡 /biz/  ││
│ │alert: 2  ││+12%/hr   ││
│ │▁▂▃▂▃▄▅  ││▅▆▇█▇▆▅  ││
│ │7 traders ││23 traders││
│ └──────────┘└──────────┘│
│ ┌──────────┐┌──────────┐│
│ │🛰 ISS    ││📦 npm    ││
│ │412.3 km  ││react +3% ││
│ │▃▂▁▂▃▂▁  ││▁▂▃▄▅▆▇  ││
│ │4 traders ││11 traders││
│ └──────────┘└──────────┘│
│                          │
└─────────────────────────┘
         ↓ scroll (optional)
┌─────────────────────────┐
│ Compressed proof card    │ ← 1 argument if they scroll
└─────────────────────────┘

┌─────────────────────────┐
│ [ Connect & Trade ]      │ ← sticky bottom bar
│ 0.1 USDC · No KYC       │    ALWAYS visible
└─────────────────────────┘
```

**Mobile cuts:**
- No before/after sections (grid tells the story)
- No timeline (too long for mobile)
- No code examples (link to docs instead)
- No leaderboard (embedded as tooltip in grid)

**88% of interactive demo sessions are desktop** (Navattic). Desktop gets the full experience. Mobile gets hero + grid + sticky CTA. The grid on mobile is 2 columns, horizontally scrollable tabs.

---

## 11. ONBOARDING FRICTION REDUCTION

**Decision: Wallet connect + email fallback**

```
[ Connect Wallet ]  or  [ Sign in with email ]
```

**Embedded wallet option:** Use Privy or Dynamic for email/Google/Apple sign-in that creates an embedded wallet automatically. User never sees seed phrases. Feels like web2 signup.

Impact: +20-60% onboarding conversion (Alchemy, Dynamic.xyz, Privy data).

**Onboarding flow after connect:**
```
Step 1: Connect wallet (or email) ← you are here
Step 2: Fund with USDC (0.1 min)
Step 3: Pick UP or DOWN on any market
```

Show "Step 2 of 3" to create endowed progress. They already started — now they finish.

**Gasless first trade:** If possible, sponsor the first trade's gas. Eliminates "I need ETH" as a blocker.

---

## 12. CONVERSION TRACKING (what to measure)

| Metric | 5% Baseline | 20% Target | How to Improve |
|--------|-------------|------------|----------------|
| Hero CTA click | ~8% | 25% | Better headline, embedded product |
| Grid browse rate | ~15% | 60% | Ungated, real data, category tabs |
| Grid → wallet connect | ~10% | 35% | Endowed progress (UP/DOWN → connect) |
| Wallet → first trade | ~50% | 80% | Reduce steps, gasless first trade |
| **End-to-end: visitor → first trade** | **~5%** | **~20%** | **All of the above** |

The math: 60% browse the grid × 35% connect wallet × 80% make first trade = 16.8%. Add hero CTA clicks (25% × 80% complete) = 20% gets within reach.
