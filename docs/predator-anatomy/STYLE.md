# Apple Style — Applied to SVG Diagrams

Distilled from `docs/apple-style-table.md` and applied to the constraints of an SVG diagram. Every value here has a source. Nothing invented.

---

## The non-negotiables

| Rule | Why |
|---|---|
| Body text is **17px**, not 16px | apple.com production CSS |
| Primary text is **#1D1D1F**, not `#000` | apple.com production CSS — black is for hero surfaces only |
| Letter-spacing on body is **-0.022em** | apple.com — negative tracking on display sizes is the SF optical principle |
| Letter-spacing on small caps / mono labels is **+0.011em** to **+0.18em** | the inversion at the bottom of the type stack |
| Marketing blue is **#0071E3** | NOT `#007AFF` (that's iOS systemBlue) — apple.com production |
| Pill radius is **980px**, not `9999px` | apple.com production CSS |
| Easing default: **`cubic-bezier(0.4, 0, 0.6, 1)`** | apple.com globalheader — the `(0.22, 1, 0.36, 1)` you see online is Material |

---

## Colors — for these diagrams

```css
/* surfaces */
--paper:   #FFFFFF;   /* SVG canvas / frame border background */
--paper-2: #F5F5F7;   /* alt surface */
--paper-3: #FBFBFD;   /* step-frame inner background */

/* text */
--ink:   #1D1D1F;     /* primary */
--ink-2: #424245;     /* secondary */
--ink-3: #6E6E73;     /* tertiary (tagline, labels) */
--ink-4: #86868B;     /* quaternary (caption, footnote) */

/* lines */
--rule:    #D2D2D7;   /* divider */
--rule-2:  #E8E8ED;   /* subtle divider, frame borders */

/* accents — use sparingly */
--blue:    #0071E3;   /* Apple marketing blue */
--blue-2:  #2997FF;   /* blue on dark backgrounds */
--blue-tint: #E8F2FE; /* derived: 8% blue on white */

/* iOS semantic — use only when meaning red or green is critical */
--red:     #FF3B30;   /* iOS systemRed light */
--green:   #34C759;   /* iOS systemGreen light */
```

The blue is decoration, not load-bearing. If you find yourself reaching for it more than once per frame, you're decorating, not designing.

The red/green should appear at most twice per diagram: once for "this is the predator's profit," once for "this is the retail loss." Anywhere else, fall back to ink-3.

---

## Fonts

```css
/* ≥ 20px */
font-family: "SF Pro Display", "SF Pro Icons",
             "Helvetica Neue", Helvetica, Arial, sans-serif;

/* < 20px */
font-family: "SF Pro Text", "SF Pro Icons",
             "Helvetica Neue", Helvetica, Arial, sans-serif;

/* monospace (numbers, eyebrows, code) */
font-family: "SF Mono", ui-monospace, "JetBrains Mono",
             Menlo, monospace;
```

Miro renderers don't have SF Pro. Fallback to Helvetica Neue is expected. The diagrams should still feel correct because **the spacing and color choices carry more weight than the typeface itself**.

---

## Type scale — for these diagrams

| Element | Size | Family | Weight | Tracking | Color |
|---|---|---|---|---|---|
| Eyebrow tag (`EXTRACTION 01 · THE WIDEN`) | 13px | mono | 700 | +0.18em | `--ink-3` |
| Mechanism title (`Toxic-flow market making`) | 36px | display | 700 | -0.022em | `--ink` |
| Tagline (`Quote tight. Dump on uninformed counterparty.`) | 17px | text | 500 | -0.012em | `--ink-3` |
| Step number badge digit | 13px | mono | 700 | 0em | `--blue` |
| Step title (`The setup`) | 14px | text | 700 | -0.005em | `--ink` |
| Step caption | 13px | text | 400 | -0.005em | `--ink-2` |
| In-illustration label | 11px | mono | 600 | +0.04em | `--ink-3` |
| Economics figure (`$710K / yr`) | 22px | display | 800 | -0.022em | `--ink` |
| Economics label (`OPERATOR SPEND`) | 11px | mono | 700 | +0.18em | `--ink-3` |

Line-height (where multi-line):
- title: 1.0714
- tagline: 1.4
- caption: 1.45 — apple.com body line-height is 1.4706

---

## Geometry

```
Frame border-radius:   14px  (Apple "card" radius)
Pill radius:           980px (Apple marketing pill)
Step number badge:     28px circle
Border weight:         1px
Stroke (price lines):  1.5px-2px depending on emphasis
```

Don't use shadows. Apple's marketing site rarely uses shadows on cards; it uses 1px borders + subtle background contrast.

---

## Composition rules

1. **Eight-pixel grid.** All margins, gaps, paddings are multiples of 4 (8, 12, 16, 20, 24, 28, 30, 32, …). It is not because 8 is magic. It is because consistency reads as care.
2. **Centered hierarchy.** Title centered. Steps left-aligned within their frame. Economics row centered. Don't mix center and left arbitrarily inside one column.
3. **Whitespace is the asset.** Frame padding is 28px. Gap between frames is 30px. Title block has 60px of breathing room below it before the grid starts. Anything tighter feels like Bloomberg.
4. **One accent per frame.** Each step frame has at most one blue or red element. The frames are quiet; the differences read.
5. **No icons unless typographic.** Apple uses real graphics or pure typography. Avoid Font Awesome / Lucide / Heroicons for diagrammatic content — they cheapen the page. Build the diagram from rects, lines, and labels.

---

## What "Apple-grade" actually means here

A retail trader who has never seen a Bloomberg terminal should be able to look at one of these mechanisms and understand the trade. Apple-grade is not about the polish of the chrome. It is about **the cost of an attention unit being zero** — the visual hierarchy carries the reader to the conclusion before they've finished reading the captions.

If your viewer has to track which step is which, the layout has failed.

If they have to squint at a small font, the type scale has failed.

If they're decoding what blue means versus red versus grey, you've used color as a load-bearing wall when it should have been a hint.

The diagrams should read the way an Apple Keynote feels in the first three slides: a sequence of obvious facts that, by the end, add up to a thesis you didn't have when you sat down.

---

## Quick-start CSS for inline SVG `<style>`

Copy this verbatim into the `<style>` block of any SVG diagram:

```svg
<style>
  .eyebrow { font: 700 13px "SF Mono", ui-monospace, Menlo, monospace; fill: #6E6E73; letter-spacing: 2.34px; text-transform: uppercase; }
  .title   { font: 700 36px "SF Pro Display", "Helvetica Neue", sans-serif; fill: #1D1D1F; letter-spacing: -0.792px; }
  .tagline { font: 500 17px "SF Pro Text", "Helvetica Neue", sans-serif; fill: #6E6E73; letter-spacing: -0.204px; }
  .step-n  { font: 700 13px "SF Mono", ui-monospace, Menlo, monospace; fill: #0071E3; }
  .step-h  { font: 700 14px "SF Pro Text", "Helvetica Neue", sans-serif; fill: #1D1D1F; letter-spacing: -0.07px; }
  .step-c  { font: 400 13px "SF Pro Text", "Helvetica Neue", sans-serif; fill: #424245; letter-spacing: -0.065px; }
  .ill-lbl { font: 600 11px "SF Mono", ui-monospace, Menlo, monospace; fill: #6E6E73; letter-spacing: 0.44px; }
  .eco-l   { font: 700 11px "SF Mono", ui-monospace, Menlo, monospace; fill: #6E6E73; letter-spacing: 1.98px; text-transform: uppercase; }
  .eco-f   { font: 800 22px "SF Pro Display", "Helvetica Neue", sans-serif; fill: #1D1D1F; letter-spacing: -0.484px; }
  .frame   { fill: #FBFBFD; stroke: #E8E8ED; stroke-width: 1; rx: 14; }
  .badge   { fill: #FFFFFF; stroke: #0071E3; stroke-width: 1.5; }
  .accent  { fill: #0071E3; }
</style>
```

Letter-spacing in SVG uses absolute units, not em. The values above are precomputed: 36px × -0.022 = -0.792px, etc. If you change the font size, recompute.

---

## What the diagrams must NOT look like

- Mermaid output
- Lucid Chart defaults
- Bloomberg terminal screens
- Tableau dashboards
- Anything with a drop shadow
- Anything with a gradient that isn't subtle (5%–10% delta only)
- Anything with more than one font weight per category (one heading weight, one body weight, one mono weight — that's it)

If the diagram looks like it could appear on a B-school slide, redesign it.
