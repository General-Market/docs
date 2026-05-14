# The Predator Anatomy — Visual Brief

A multi-step walkthrough of the seven extractions that pollute spot, perp, and options venues. Built to live on a Miro board so the team can read each mechanism frame by frame, then on the marketing site as a sibling to `/case-studies/anticheat/`.

The HTML case study (one-frame mechanism diagrams, complete) already ships at:
- `frontend/public/case-studies/predator-anatomy/index.html`
- Live at `https://generalmarket.io/case-studies/predator-anatomy/`

This directory is the **next iteration** — multi-frame, deeper, Apple-grade.

---

## Status

| Layer | State | Note |
|---|---|---|
| HTML case study (single-frame) | ✅ Shipped | 1,141 lines, 7 inline SVGs, deployed |
| Single-frame SVGs (extracted) | ✅ In `diagrams/` | The HTML versions, standalone files |
| **Multi-step SVGs (6 frames each)** | 🟡 **TODO — see § Spec** | Next agent's job |
| Miro upload scripts | ✅ In `scripts/` | Working against board `uXjVOkYo-do=` |
| Miro board state | 🔵 Empty (wiped 2026-05-14) | Ready for the multi-frame upload |

---

## Goal

A retail trader looking at the Miro board should be able to:

1. Scan the title bar and know which weapon they're about to read about.
2. Walk left-to-right through six frames and **see the trade unfold in slow motion** — like a comic strip.
3. End the row knowing exactly who paid whom, how, and why.
4. See the economics: what the predator spent to run the trade, what they earned, what it costs on General (zero).

No Miro-native props (text items, shapes). Everything baked into the SVG so it's exportable, vector-sharp, and self-contained.

---

## The Seven Mechanisms — Six-Step Breakdowns

### 01 — Toxic-flow market making (THE WIDEN)

> Quote tight to attract retail. Read direction at fill. Widen the spread. Pocket the round-trip.

1. **Setup.** MM posts tight quote — $99.95 bid / $100.05 offer. Spread $0.10.
2. **Retail arrives.** Market buy order incoming. Spread looks attractive.
3. **Fill.** Retail buys at $100.05. The MM now knows the direction.
4. **Cancel.** Within 50ms, MM cancels the bid at $99.95 and the original offer.
5. **Requote.** New quote: $99.85 bid / $100.10 offer. Bid down, offer up.
6. **Exit.** Retail tries to close, sells into the new bid at $99.85. MM captured $0.20 per share with zero inventory risk.

**Operator spend:** ~$710K/yr (quant + inventory models + EMS + surveillance)
**Annual take:** $2–5M
**On General:** $0 — no MM, no quote, no widen.

---

### 02 — Stop & liquidation hunting (THE WICK)

> Push the price below the obvious support. Harvest the forced unwinds.

1. **The cluster.** 14,000 retail stop-losses pile up at $99.50, the "obvious support."
2. **The MM's view.** Level 3 market data shows the wall to anyone who pays. Retail does not pay.
3. **The push.** MM sells $5M into a thin book. Price drops toward $99.50.
4. **The wick.** Price touches $99.45 — every stop in the cluster triggers as a market sell.
5. **The cascade.** $20M of forced selling adds pressure. Price collapses to $98.20 in seconds.
6. **The recovery.** MM covers the short at $98.50, then sells back into the recovery at $101.

**Operator spend:** ~$350K/yr (Level 3 feeds + analytics)
**Annual take:** $1–4M (10–25 cascades/yr at $50K–500K each)
**On General:** $0 — no order book to read, no stops to hunt.

---

### 03 — Cross-venue arbitrage (THE LAG)

> Same asset. Two venues. 80 milliseconds of light.

1. **Equilibrium.** Binance and Coinbase both quote ETH at $4,000.
2. **Whale buys.** A large market buy hits Binance. Price jumps to $4,005.
3. **Light-speed lag.** Coinbase still shows $4,000. The new price has not crossed the network yet — 80ms.
4. **The MM acts.** Co-located + microwave-connected: buy $200K ETH on Coinbase at $4,000.
5. **The hedge.** Simultaneously sell $200K on Binance at $4,005. Net: long 0, short 0, $5/unit captured.
6. **Coinbase catches up.** At t+80ms Coinbase quote refreshes to $4,005. Too late to fix the arb. Cycle repeats hundreds of times/day.

**Operator spend:** ~$400K/yr (co-lo at 3 venues + microwave + direct API)
**Annual take:** $500K–2M
**On General:** $0 — one venue, one clearing price.

---

### 04 — Latency arbitrage (THE TIME BAR)

> Co-locate. Beat the orderbook to the print.

1. **t = 0.** ES futures move on a macro headline. New print: ES up 0.3%.
2. **Stale SPY.** SPY is mathematically correlated — its quote should follow. For 50–500 microseconds, it doesn't.
3. **The FPGA fires.** A field-programmable gate array converts the ES print into a SPY market order in 810 nanoseconds.
4. **The slow MM gets picked off.** Their stale SPY offer at the old price is taken before they can pull it.
5. **SPY catches up.** At t+500μs, SPY market data updates. Slow MM repositions. Too late on this print.
6. **The accumulator.** Per-trade profit is $0.01–0.05. Volume is millions of trades. $5B/yr globally (Aquilina, Budish, O'Neill — QJE 2022).

**Operator spend:** ~$650K/yr (FPGA + co-lo + 1 kernel-bypass engineer)
**Annual take:** $300K–1.5M
**On General:** $0 — sealed batch. Inside a batch, time does not exist.

---

### 05 — Information edge (THE CALENDAR)

> Read the receipts before the company does.

1. **January.** Credit-card panel (YipitData) shows Tesla service-center revenue up 22% YoY. Hedge-fund analyst notes the divergence.
2. **February.** Satellite imagery (RS Metrics) confirms Shanghai factory parking lot 18% fuller than Q4. Capacity utilization rising.
3. **March.** GLG call with an ex-Tesla supply-chain VP confirms tooling capacity for the higher cadence.
4. **Late March.** Fund opens a position — long Tesla calls, ahead of consensus.
5. **April, earnings day.** Tesla prints a beat. Stock jumps 8%.
6. **April, 4:01pm.** Retail reads the headline. The fund has already exited at the open.

**Operator spend:** ~$714K/yr (Bloomberg + alt data + expert networks + analyst)
**Annual take:** $500K–2M
**On General:** $0 — resolution against an oracle. No informed counterparty exists.

---

### 06 — Spoofing & layering (THE WALL THAT WASN'T)

> Build a wall. Cancel it. Walk the price.

1. **Setup.** MM secretly wants to sell at the highest price they can get. Order book is thin.
2. **The wall.** MM posts a $5M bid at $99 — visible to everyone.
3. **The signal.** Retail charts now show "strong support at $99." Algos pick it up. The thesis spreads.
4. **The fill.** Retail buys at $99.05 expecting the wall to hold.
5. **The cancel.** The instant retail's order fills against the MM's separate offer, the $5M wall vanishes. Total lifespan: 47ms.
6. **The drop.** With the wall gone there is no real support. Price drops to $98.85. MM kept $0.25 per share. Sarao did this for $40M from a London bedroom.

**Operator spend:** ~$0 marginal (reuses the latency stack). **Real cost: legal exposure.** JPMorgan paid $920M in 2020 for doing it for eight years.
**Annual take:** $200K–2M (where practiced)
**On General:** $0 — no order book, no wall to fake.

---

### 07 — Payment for order flow (THE CASH ROUTE)

> Pay the broker. Pocket the spread.

1. **Click.** Retail user opens Robinhood, clicks Buy 100 AAPL.
2. **Reroute.** Robinhood does not send the order to NYSE. It routes it to Citadel Securities, a wholesaler.
3. **Cash.** Citadel pays Robinhood approximately $1.30 in cash for the order — payment for order flow.
4. **The fill.** Citadel fills retail at NBBO midpoint, then hands back $0.20 as "price improvement" so the print legally beats public quotes.
5. **The hedge.** Citadel takes the offsetting position on a real venue (NYSE/ARCA) at the NBBO bid.
6. **The receipt.** Citadel kept $3.50 of spread. Robinhood kept $1.10. Retail got $0.20 of "improvement" off a benchmark Citadel chose. Citadel paid $943M for nine months of this in 2024.

**Operator spend:** $943M in 9mo (Citadel Securities outlay to brokers)
**Annual take:** $3–5B (Citadel Securities equities + options market making — tier requires wholesaler status)
**On General:** $0 — parimutuel pool. No wholesaler. There is no "other side" — there is the pool.

---

## SVG Layout Spec — Per Mechanism

One self-contained SVG per mechanism. Width 1500, height 1100. Vector. No external dependencies.

### Structural blocks

```
┌────────────────────────────────────────────────────────────────────┐
│  EXTRACTION 0X · THE [FRAME NAME]                       (eyebrow)  │
│  [Mechanism title — 36pt SF Pro Display, -0.022em]                 │
│  [Tagline — 17pt SF Pro Text, #6E6E73]                             │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │  ① Setup │  │  ② Arrive│  │  ③ Fill  │                          │
│  │  [diag]  │  │  [diag]  │  │  [diag]  │                          │
│  │  caption │  │  caption │  │  caption │                          │
│  └──────────┘  └──────────┘  └──────────┘                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │  ④ Cancel│  │  ⑤ Widen │  │  ⑥ Exit  │                          │
│  │  [diag]  │  │  [diag]  │  │  [diag]  │                          │
│  │  caption │  │  caption │  │  caption │                          │
│  └──────────┘  └──────────┘  └──────────┘                          │
├────────────────────────────────────────────────────────────────────┤
│  OPERATOR SPEND       │   ANNUAL TAKE       │   ON GENERAL          │
│  ~$710K / yr          │   $2–5M / yr        │   $0                  │
└────────────────────────────────────────────────────────────────────┘
```

### Frame dimensions

- Total SVG: **1500 × 1100**
- Header: 1500 × 180
- Grid: 3 columns × 2 rows of step frames, each **460 × 360** with 30px gap
- Footer (economics row): 1500 × 120, 3 cells

### Apple style values (from `docs/apple-style-table.md`)

```
COLORS
  ink            #1D1D1F  — primary text, never #000
  ink-2          #424245  — secondary
  ink-3          #6E6E73  — tertiary
  ink-4          #86868B  — caption
  paper          #FFFFFF  — background
  paper-2        #F5F5F7  — secondary surface (frame background)
  paper-3        #FBFBFD  — tertiary surface
  rule           #D2D2D7  — divider
  divider-light  #E8E8ED  — subtle divider
  blue           #0071E3  — Apple marketing blue (accent)
  red            #FF3B30  — iOS systemRed (use sparingly)
  green          #34C759  — iOS systemGreen (use sparingly)

FONTS
  display  "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif
           — for ≥20px text
  text     "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif
           — for <20px text

TYPE
  Title:       36pt SF Pro Display, weight 700, letter-spacing -0.022em
  Tagline:     17pt SF Pro Text, weight 500, letter-spacing -0.012em, color #6E6E73
  Eyebrow:     13pt "SF Mono" / monospace, weight 700, letter-spacing 0.18em, uppercase, color #6E6E73
  Step title:  14pt SF Pro Text, weight 700, letter-spacing -0.005em
  Step number: 13pt monospace, weight 700, in a 28px circle, blue #0071E3 on white
  Caption:     13pt SF Pro Text, weight 400, letter-spacing -0.005em, color #424245, line-height 1.45
  Economics figure: 22pt SF Pro Display, weight 800, letter-spacing -0.022em
  Economics label:  11pt monospace, weight 700, letter-spacing 0.18em, uppercase

LAYOUT
  Border radius (frames):     14px
  Border (frames):            1px solid #E8E8ED
  Background (frame inner):   #FBFBFD
  Padding inside frame:       28px
  Gap between frames:         30px

  Economics row backgrounds:
    Spend cell:    #FBFBFD with #E8E8ED border
    Take cell:     #FBFBFD with #E8E8ED border
    General cell:  Apple blue tint background — derive from #0071E3 at 8% opacity (=#E8F2FE)
```

### Illustration constraints (inside each step frame)

Each illustration occupies the middle ~280×200px of its 460×360 frame. Approaches:

- **Order-book frames** (toxic flow, spoofing): tiny depth-of-book table with bid/offer bars
- **Price-line frames** (stop hunting): mini chart with annotated wick
- **Two-track timeline** (cross-venue): two parallel horizontal price tracks with a lag highlight
- **Time-bar comparison** (latency): horizontal stacked bars at log scale
- **Calendar timeline** (information edge): 5-month timeline with two lanes (fund vs retail)
- **Money-flow diagram** (PFOF): boxes + directional arrows with cash amounts

Each diagram should be reducible: a viewer at 30% zoom should still parse which step they're looking at from shape alone.

---

## Build Approach for the Next Agent

You have two reasonable options:

### Option A — Python generator script

Write `scripts/generate_diagrams.py` that:
1. Loads a per-mechanism data file (or hardcoded dict matching this spec).
2. Emits one SVG per mechanism with the layout above.
3. Provides helper functions: `frame()`, `step_badge()`, `price_line()`, `orderbook_row()`, `money_arrow()`, `economics_cell()`.

Pros: consistent style across all 7, easy to iterate on a single helper to change every diagram.
Cons: programmatic SVGs look less hand-crafted unless you're careful.

### Option B — Hand-craft each SVG

Write each SVG by hand in `diagrams/<NN>-<name>.svg`, referencing the same CSS variables block at the top.

Pros: best visual quality, more freedom per mechanism.
Cons: harder to keep the typography rigorously consistent.

**Recommendation:** Option A for the chrome (header, frames, economics row, step badges, captions), Option B for the per-step illustrations inside each frame. Generator emits the skeleton, illustrations are dropped in as inline groups.

---

## Miro Upload — How

The board is already named and ready:

- **Board:** `uXjVOkYo-do=` ("General")
- **URL:** https://miro.com/app/board/uXjVOkYo-do=
- **State:** empty as of 2026-05-14 (wiped before this handoff)

Upload script lives at `scripts/upload_to_miro.py`. After generating the 7 multi-frame SVGs, point this script at them with the new layout coords. Suggested vertical layout on the Miro board:

```
y = -3000  ┃  [ HERO SVG: title page if you want a separate one ]
y = -1500  ┃  [ 01 toxic-flow.svg ]      (1500 wide × 1100 tall)
y = 0      ┃  [ 02 stop-hunting.svg ]
y = +1500  ┃  [ 03 cross-venue.svg ]
y = +3000  ┃  [ 04 latency.svg ]
y = +4500  ┃  [ 05 information.svg ]
y = +6000  ┃  [ 06 spoofing.svg ]
y = +7500  ┃  [ 07 pfof.svg ]
```

Each SVG already contains its own title and economics row, so no Miro-native text or shape props are required. One image upload per mechanism, period.

Credentials in `.env`:
```
MIRO_ACCESS_TOKEN=...    # required
```

Upload command (after rebuild):
```bash
export $(grep -E "^MIRO_" .env | xargs) && python3 docs/predator-anatomy/scripts/upload_to_miro.py
```

---

## Source material

Reference these when iterating:

- **`docs/apple-style-table.md`** — the source-of-truth Apple style spec (every value cited from apple.com production CSS or HIG)
- **`frontend/public/case-studies/anticheat/index.html`** — companion case study with the established Apple chrome
- **`frontend/public/case-studies/predator-anatomy/index.html`** — the shipped single-frame version of these diagrams (1,141 lines, working CSS)
- **`diagrams/*.svg`** — the seven single-frame SVGs extracted from the shipped HTML, suitable for reference only

---

## What disappears once this is done

When the multi-step SVGs ship and land on Miro and (eventually) the HTML case study, the seven mechanisms become readable in under five minutes by a non-trader. That is the measure. If a designer outside finance can't follow it, ship it again.

The point is not to explain trading. The point is to explain extraction — the part everyone trading also doesn't fully understand.
