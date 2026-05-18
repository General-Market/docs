# Finance Charts Reel — Chart Specs

Twelve charts. Trading-research aesthetic. Black canvas, white ink, narrow color palettes. Each chart sits in its own ~5 second Sequence inside `FinanceChartsReel.tsx` at 1920×1080, 30fps.

## Global tokens

```ts
BG = "#000000"
INK = "#E6E6E6"
INK_DIM = "#A0A0A0"
INK_FAINT = "#5E5E5E"
GRID = "#1A1A1A"
GRID_FAINT = "#0E0E0E"
ACCENT_BLUE = "#5B9BD5"   // soft cool
ACCENT_RED = "#D85050"    // soft warm
SF_DISPLAY = '"SF Pro Display", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
SF_TEXT    = '"SF Pro Text", Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'
```

Title: ~22-28px, weight 600, centered. Subtitle: ~13-15px, weight 400, dim gray, directly below title. Axis labels: 11-13px. Tick labels: 10-12px. Numbers right-aligned. Y-axis label rotated -90°.

Charts breathe — generous padding (top 80–110px, left 80px for y-axis, right 100–180px for colorbar, bottom 80px for x-axis).

## Color ramps

```
DIVERGING_BLUE_RED = [
  "#D85050",  // -40% (deep red)
  "#E08070",
  "#EEB0A0",
  "#F4D8CE",
  "#F5F5F5",  //  0%  (white pivot)
  "#D0E1F0",
  "#9CC1DD",
  "#6BA0CC",
  "#3F7FBB"   // +20% (deep blue)
]

SEQUENTIAL_RED = [  // pale → deep
  "#FFE5DC", "#FBC9B9", "#F5A98F", "#EC8265", "#DD5641", "#C42E25", "#9B1717"
]
```

## Animation pattern

Each chart fades in (frame 0–15), holds (15–135), fades out (135–150). Inside, data elements animate progressively — points draw on, bars rise, lines extend left-to-right — over the first ~60 frames. After that, hold static so the eye reads it.

Use `interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp" })` for the data reveal. Use `spring()` for impactful elements.

---

## Chart 01 — BTCUSD 7-day ATM IV vs Forward RV (scatter + regression)

**Title:** `BTCUSD 7-day ATM IV vs Forward RV`
**Subtitle:** `Daily 8:00 UTC samples | 2024-10-08 to 2026-04-29`

- X-axis: `7-day ATM implied volatility`, ticks `30% 40% 50% 60% 70% 80% 90%`
- Y-axis: `Forward 7-day realized volatility`, ticks `20% 30% 40% 50% 60% 70% 80% 90%`
- ~570 scatter points, sized ~5px, with stroke 0.5px and slight alpha (0.85)
- Color encodes `iv - forward_rv`: where IV > RV → blue; where IV < RV → red/orange. Bulk of points fall in lower-right wedge (oversold IV) → blue dominant.
- Dashed diagonal y=x line, white, 1.2px, dashed pattern `[6, 6]`
- Top-right colorbar legend titled `IV − forward RV`, with stops at +20%, 0%, -20%, -40%
- Synthetic data: log-normal noise around y = 0.85x + 5%, with IV in [25%, 80%], RV in [20%, 90%]. Cluster density highest at IV 35–55%.

## Chart 02 — MTM PnL Heatmap (Weekday × Hour)

**Title:** `MTM PnL by Weekday and UTC Hour`
**Subtitle:** `Source: Thalex | 02 Mar 2026 - 07 May 2026`

- 6 rows (Mon, Tue, Wed, Thu, Fri, Sat). 24 columns (hours 0–23).
- Cells are square-ish rectangles with 2px gap, stroke `rgba(255,255,255,0.04)`.
- Diverging blue/red color from DIVERGING_BLUE_RED. Most cells pale near zero.
- Mon row: only cols 13–23 colored (the rest are background black, representing missing data).
- Right colorbar titled `MTM PnL`, ticks `-1,000  -500  0  +500`.
- Synthetic data: each cell ∈ [-1000, +500], with noise + a small bias toward positive on overnight hours (0–6) and negative around hour 8–12.

## Chart 03 — BTC Short Weekly Straddle (Step PnL + bar overlay)

**Title:** `BTC Short Weekly Straddle | 16h - 13h on Weekdays | $80k Notional Size`
**Subtitle:** `Source: Thalex | 19 Mar 2025 - 08 May 2026`

- Y-axis: `PnL`, range -5,000 to 30,000, ticks every 5,000
- X-axis: continuous date — labels `April`, `July`, `October`, `2026`, `April`
- Single blue step-line (square/lock corners, not smoothed) climbing from 0 to ~28,500.
- Vertical bars beneath the line, mostly small/pale, two or three deep red bars between October–January marking large losses (-1,500 to -3,000).
- Title centered, subtitle below
- Synthetic data: ~365 daily points, cumulative PnL drift positive with 3 sharp drawdowns then recovery.

## Chart 04 — BTC Hourly Realized Volatility (Day × Hour heatmap)

**Title:** `BTC Hourly Realized Volatility — Average by Day and Hour`
**Subtitle:** `Source: Thalex, 2025-03-14 — 2026-05-04`

- 7 rows (Mon–Sun). 24 cols (0–23). No gaps, cells touch.
- SEQUENTIAL_RED color ramp. Map values 15%–70%.
- Hot pockets at hours 13–16 across weekdays. Sat/Sun overall paler.
- Right colorbar titled `Avg Realized Vol (ann.)`, ticks `20% 40% 60%`.
- Synthetic data: base 25% + diurnal sinusoid + weekly modulation. Add small random noise.

## Chart 05 — BTC Realized Vol Cone

**Title:** `BTC realized vol cone (Hodges-Tompkins corrected)`
**Subtitle:** `Source: Thalex · 12 May 2024 – 15 May 2026`

- Y-axis: `Annualized volatility`, 20%–110%, ticks every 10%
- X-axis: `Days to expiry`, logarithmic feel — labels `7d 14d 21d 42d 133d 224d`
- Five nested filled bands, from outer to inner: `min - max` (dark crimson), `10th - 90th` (mid red), `25th - 75th` (orange-red), `median` (pale peach), with the bands narrowing as days-to-expiry increases (the "cone").
- Two overlay lines: `current IV` dashed white-cream, `current RV` solid blue (lighter cool blue, ~#7090C8).
- Top-right legend: dots for each band + the IV/RV lines.
- Synthetic data: band edges as `f(days) = a * days^-0.3 + b`, so the cone narrows from left to right.

## Chart 06 — BTC-29MAY26 Straddle (Index price scatter colored by IV)

**Title:** `BTC-29MAY26-STRADDLE`
**Subtitle:** `27 Mar 26 08:00 - 05 May 26 15:00`

- Y-axis: `Index Price (Close)`, $64,000 – $82,000, ticks every 2,000
- X-axis: `Date (UTC)`, ticks `Mar 29  Apr 05  Apr 12  Apr 19  Apr 26  May 03`
- ~800 dots, size ~5–6px, slight alpha 0.85, color encoded by implied volatility from 35.8% (blue) to 49.4% (red), through white at midpoint.
- Top-right colorbar titled `Implied volatility`, blue → red ramp, with labels `35.8%` (left) and `49.4%` (right).
- Synthetic price: starts ~66,000 (red, high IV), trending to ~81,000 (blue, low IV) — IV inversely correlates with price drift; add noise. Connect-the-dot style — adjacent points close in time near each other.

## Chart 07 — BTCUSD multi-panel (Price + VCR Bars + Weekday heatmap)

**Title:** `BTCUSD` (only above top panel)
**Subtitle:** `7 May 2024 – 30 Apr 2026`

Three stacked panels.

**Panel A (top, ~35% height):** Step line price chart, white line, range 60k–125k. X-axis labels: `July October 2025 April July October 2026 April`. No fill.

**Panel B (middle, ~40% height):** Title `Max VCR Ratio (7d)`. Red bars from 0%–80% (left y-axis labeled `Max VCR`). Overlay white step-line for `7d Rolling RV` on right y-axis (range 20%–120%). Bars are dense, daily. Color of bars varies with magnitude (paler when small).

**Panel C (bottom, ~25% height):** Title `VCR (7d) by Weekday`. 7-row heatmap (Mon–Sun) × ~100 cols. SEQUENTIAL_RED. Tight cells, no gaps.

## Chart 08 — Monte Carlo Option Pricing (fan + histogram + stats)

Top bar (HUD-style): `BTCUSD 70,736 | 26 Mar 26, 04:56:33 UTC` left-aligned, then a row of pill-buttons: `Buy | 1 | Call | 24 Apr 26 | 75,000`, then numeric columns labeled `IV / MARK / Δ / Γ / Θ / ν` with values `47.58% / +2,172 / +0.33 / +0.0000 / -64.38 / +75.25`. A second muted row below showing totals.

Subline: `○ μ 76.00%  σ 44.00%  η 5,000  T+30D`, with `PRICE | PNL | PROB` tabs on the right.

**Left stats panel:** small inset box, list:
```
AVG PNL    +$1,720
MEDIAN PNL -$2,172
BREAK-EVEN $77,203
MAX LOSS   -$2,172
MAX PAYOFF +$47,166
```

**Main viz:** A horizontal "fan" of simulated price paths from left (single point) sweeping right, color-encoded by P&L — red (loss) bottom, blue (gain) top, soft cream center. Use ~150–300 thin alpha lines to create the fan effect.

**Right histogram:** Vertical bars showing terminal price distribution, with the same y-axis scale (60k–120k). Bell-curve-ish skewed toward 80k. Bars colored by P&L.

Y-axis labels `66k 75k 85k 120k` and `60000, 80000, 100000` on histogram.

## Chart 09 — Vega curves for combo (long/short strikes)

(No explicit title — just legend top-right.)

- X-axis: `BTC Price`, range 30,000–120,000, ticks every 10,000
- Y-axis: `vega`, range -100 to 100, ticks every 50
- Three curve families:
  - White (Combo) — bold ~2px, centered, peaks ~+60 around 70k then dips to ~-50 around 80k (s-shaped)
  - Blue (`Buy 1 BTC-24APR26-72000-C`) — semi-transparent, peaks positive around 72k
  - Red (`Sell 1 BTC-24APR26-80000-C`) — semi-transparent, peaks negative around 80k
- For each color, draw ~12 thin variations at decreasing alpha, simulating different time-decay/IV snapshots that all converge near expiry.
- Legend top-right: title `Series`, three rows with color dot + label.

## Chart 10 — Per-Instrument PnL (triple panel diverging bars)

**Title:** `Per-Instrument PnL: Straddle vs Hedge vs Total`
**Subtitle:** `Source: Thalex | 07 Mar 2025 – 20 Mar 2026`

- Three columns side-by-side: `Straddle PnL` (left), `Hedge PnL` (mid), `Total PnL` (right)
- Y-axis: instrument tickers `BTC-DDMMM YY-PRICE-S` rotated horizontally on left only, ~55 rows
- X-axis: PnL, ticks -16,000 to +16,000 every 4,000 (each panel independent)
- Horizontal bars diverging from x=0 center. Color: red for negative, blue for positive, intensity by magnitude.
- Top row has largest red bar in Straddle, balanced by large blue in Hedge.
- Synthetic data: 55 instruments, sorted by Straddle PnL descending. Hedge inversely correlated. Total = sum.

## Chart 11 — BTC Index Price + Basis Carry (split panel)

(Two panels side-by-side, no overarching title.)

**Left panel:** `BTC Index Price` title, subtitle `08 Mar 26 19:00 - 21 Mar 26 06:00`. Top-right colorbar legend titled `Annualized basis (future)` from `−0.95%` (blue) to `+3.11%` (red).
- Y-axis: $66,000–$76,000
- X-axis: `Tue 10  Thu 12  Sat 14  Mon 16  Wed 18  Fri 20`
- ~600 connected dots in a meandering path. Most are grey-dim; recent ones (rightmost ~50) are colored by basis from blue → red.
- Two highlighted larger dots near the rightmost end: a white one (start) connected by a thin dashed line to a red one (end), labeled `2.7 days`.

**Right panel:** `Relative carry BTC-03APR26-PERPETUAL` title, subtitle `18 Mar 26 14:00 - 21 Mar 26 06:00 (2.7 days)`, `Avg funding: +8.89% | basis cost: −13.30%`. Legend: white = `Funding cost`, blue = `Basis cost`.
- Y-axis: `Cumulative ($)`, -60 to +40, ticks every 20
- Two cumulative step-lines from $0: white climbing to ~+40, blue declining to ~-60.

## Chart 12 — 1W Straddle Sold Each Friday (cumulative + bars)

**Title:** `1W Straddle Sold Each Friday 8AM UTC`
**Subtitle:** `Source: Thalex | 07 Mar 2025 - 13 Mar 2026`

- Y-axis: `PnL`, range -20,000 to +60,000, ticks every 10,000
- X-axis: `expiry`, tickers like `14MAR25 21MAR25 28MAR25 ...` rotated 90°, ~50 entries
- Two layers:
  - Cumulative step-line (white, 1.5px), climbs from 0 to ~+50,000 with one massive dip to ~+25,000 near `06FEB26`
  - Per-expiry bars colored by `short_pnl` value: deep red for big loss, blue for gain, white near zero
  - Right colorbar legend titled `short_pnl`, range `-15,000` to `+5,000`
- Synthetic data: 50 weekly straddle PnLs, mostly small positive (selling vol earns premium), with 3 large red losses (vol explosions) including the dramatic one at `06FEB26`.

---

## Sequencing order in reel

1. Chart 01 (scatter regression) — 150 frames
2. Chart 02 (PnL heatmap) — 150
3. Chart 03 (cumulative step) — 150
4. Chart 04 (vol heatmap) — 150
5. Chart 05 (vol cone) — 150
6. Chart 06 (price scatter by IV) — 150
7. Chart 07 (multi-panel) — 180 (denser)
8. Chart 08 (Monte Carlo) — 180
9. Chart 09 (vega curves) — 150
10. Chart 10 (per-instrument bars) — 180
11. Chart 11 (split panel basis) — 150
12. Chart 12 (Friday straddles) — 150

Total ~1,860 frames @ 30fps = 62 seconds. Add 30 frames intro fade + 30 frames outro = 1,920 frames.

## File layout

```
video/src/compositions/finance-charts/
├── CHART_SPECS.md           (this file)
├── FinanceChartsReel.tsx    (master)
├── tokens.ts                (shared style tokens, ramps, helpers)
├── primitives.tsx           (Axes, ChartFrame, Tick, ColorBar, Legend)
└── charts/
    ├── Chart01_IVvsRV.tsx
    ├── Chart02_PnLHeatmap.tsx
    ├── ...
    └── Chart12_FridayStraddles.tsx
```

Each chart component exports a `<ChartN />` taking no props (uses `useCurrentFrame` for its own animation, scoped via Sequence).
