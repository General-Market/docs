# Apple-Style Frontend — Sourced Reference Table

Every value below is pulled from a primary source: Apple's own production CSS on apple.com, Apple's Human Interface Guidelines, or a public mirror of Apple's system color values. Citations at the bottom. No invented numbers.

Use as a paste-block at the top of any frontend prompt where Apple-grade output is required.

---

## 1. Font Stack

Pulled verbatim from `apple.com/v/home/a/styles/main.built.css`:

```css
/* Display sizes (≥ 20px) */
font-family: "SF Pro Display", "SF Pro Icons", "Helvetica Neue",
             Helvetica, Arial, sans-serif;

/* Text sizes (< 20px) */
font-family: "SF Pro Text", "SF Pro Icons", "Helvetica Neue",
             Helvetica, Arial, sans-serif;
```

Apple ships regional variants in the same stack: `SF Pro AR`, `SF Pro HK`, `SF Pro JP`, `SF Pro TC`, `SF Pro Gulf`, plus `PingFang HK`, `Hiragino Kaku Gothic Pro`, `Meiryo`. For Western languages, the two stacks above are the production values.

[Source: apple.com main.built.css]

## 2. Font Sizes — Confirmed in Use on apple.com

Distinct `font-size` values found in apple.com's marketing CSS:

| Size | Used as |
|---|---|
| 12px | Captions, legal |
| 14px | Small UI |
| **17px** | Body |
| 19px | Larger body / lede |
| 21px | Sub-heads |
| 24px | Section labels |
| 28px | H3 |
| 32px | H2 (small) |
| 40px | H2 (large) |
| 48px | H1 (small) |
| 56px | Hero (small) |

Larger hero sizes use `clamp()` and em-based scaling. The 17px body is non-negotiable on Apple's marketing site.

[Source: apple.com main.built.css]

## 3. Letter-Spacing — Confirmed Values

Distinct `letter-spacing` values in apple.com production CSS:

| Value | Used on |
|---|---|
| -0.022em | Body / common text |
| -0.016em | Small headings |
| -0.01em | Sub-heads |
| -0.005em | Mid sizes |
| -0.002em | Near-baseline |
| 0em | Captions |
| +0.007em | Small text |
| +0.009em | Smaller text |
| +0.011em | Smaller still |
| +0.012em | Smallest |

The pattern: negative tracking shrinks as size shrinks; below body, tracking goes positive. This is the SF optical-tracking principle made literal.

[Source: apple.com main.built.css]

## 4. Line-Heights — Confirmed Values

Distinct `line-height` values found:

| Value | Use |
|---|---|
| 1 | Single-line UI |
| 1.0714 | Hero (≈ 60/56) |
| 1.1 | Display |
| 1.125 | Display |
| 1.1428 | Title |
| 1.1666 | Title |
| 1.1904 | Sub-title |
| 1.2105 | Section |
| 1.25 | Body-display crossover |
| 1.2631 | Mid |
| 1.2857 | Mid |

Apple does not use round numbers. Line-heights are derived from the (line-box / font-size) ratio of the original Sketch/Figma spec, and shipped as floats.

[Source: apple.com main.built.css]

## 5. iOS Text Style Table (HIG)

Apple's published Dynamic Type table, in points (pt) at the default Large content-size category. Tracking values are expressed in 1/1000 em (Apple's published unit) — divide by 1000 to get CSS `em`.

| Style | Weight | Size | Leading | Tracking |
|---|---|---|---|---|
| Title 1 | Light | 28pt | 34pt | +13 |
| Title 2 | Regular | 22pt | 28pt | +16 |
| Title 3 | Regular | 20pt | 24pt | +19 |
| Headline | Semibold | 17pt | 22pt | −24 |
| Body | Regular | 17pt | 22pt | −24 |
| Callout | Regular | 16pt | 21pt | −20 |
| Subhead | Regular | 15pt | 20pt | −16 |
| Footnote | Regular | 13pt | 18pt | −6 |
| Caption 1 | Regular | 12pt | 16pt | 0 |
| Caption 2 | Regular | 11pt | 13pt | +6 |

Modern HIG also defines **Large Title** at 34pt. Caption 2 has a built-in 11pt minimum so it stays legible at small Dynamic Type preferences.

CSS conversion: `letter-spacing: -0.024em` for Body/Headline, `-0.020em` for Callout, etc.

[Source: Apple HIG — iOS Typography (codershigh archive)]

## 6. Colors — Apple.com Marketing Site

Most-used colors in apple.com production CSS, ordered by frequency:

| Hex | rgb | Use |
|---|---|---|
| `#FFFFFF` | 255,255,255 | Background |
| `#1D1D1F` | 29,29,31 | Primary text (NOT pure black) |
| `#F5F5F7` | 245,245,247 | Light surface / secondary background |
| `#86868B` | 134,134,139 | Tertiary text |
| `#000000` | 0,0,0 | Hero / dark surfaces |
| `#6E6E73` | 110,110,115 | Secondary text |
| `#0071E3` | 0,113,227 | Apple Blue (CTA / link) |
| `#0066CC` | 0,102,204 | Apple Blue alt (hover/visited) |
| `#0076DF` | 0,118,223 | Blue variant |
| `#006EDB` | 0,110,219 | Blue variant |
| `#2997FF` | 41,151,255 | Blue on dark backgrounds |
| `#272729` | — | Dark surface |
| `#18181A` | — | Darker surface |
| `#424245` | 66,66,69 | Dark border / divider |
| `#333336` | 51,51,54 | Dark surface 2 |
| `#E8E8ED` | 232,232,237 | Light divider |
| `#D2D2D7` | 210,210,215 | Light border |

Translucent overlays in use: `rgba(0,0,0,.88)`, `rgba(0,0,0,.64)`, `rgba(0,0,0,.56)`, `rgba(0,0,0,.48)`, `rgba(0,0,0,.08)`, `rgba(255,255,255,.8)`.

[Source: apple.com main.built.css]

## 7. Colors — iOS System (HIG)

Apple's published systemColor values, light and dark mode. These are the iOS UIKit values — distinct from apple.com marketing colors above.

| Token | Light | Dark |
|---|---|---|
| systemRed | rgb(255,59,48) | rgb(255,69,58) |
| systemOrange | rgb(255,149,0) | rgb(255,159,10) |
| systemYellow | rgb(255,204,0) | rgb(255,214,10) |
| systemGreen | rgb(52,199,89) | rgb(48,209,88) |
| systemMint | rgb(0,199,190) | rgb(102,212,207) |
| systemTeal | rgb(48,176,199) | rgb(64,200,224) |
| systemCyan | rgb(50,173,230) | rgb(100,210,255) |
| **systemBlue** | rgb(0,122,255) | rgb(10,132,255) |
| systemIndigo | rgb(88,86,214) | rgb(94,92,230) |
| systemPurple | rgb(175,82,222) | rgb(191,90,242) |
| systemPink | rgb(255,45,85) | rgb(255,55,95) |
| systemBrown | rgb(162,132,94) | rgb(172,142,104) |

Gray scale (iOS):

| Token | Light | Dark |
|---|---|---|
| systemGray | rgb(142,142,147) | rgb(142,142,147) |
| systemGray2 | rgb(174,174,178) | rgb(99,99,102) |
| systemGray3 | rgb(199,199,204) | rgb(72,72,74) |
| systemGray4 | rgb(209,209,214) | rgb(58,58,60) |
| systemGray5 | rgb(229,229,234) | rgb(44,44,46) |
| systemGray6 | rgb(242,242,247) | rgb(28,28,30) |

Note the divergence: **iOS systemBlue (`#007AFF`) is not the same as apple.com marketing blue (`#0071E3`).** Use the iOS value inside an iOS-style app, the marketing value for an Apple-marketing-style page.

[Source: KunalTanwar11/apple-colors mirror of HIG values]

## 8. Layout — apple.com Content Widths

Distinct `max-width` values found in production CSS:

| Width | Use |
|---|---|
| 420px | Narrow text columns / blockquotes |
| 734px | Standard content width |
| 1068px | Wide marketing content |
| 1069px | Same — float-rounding artifact |
| 1680px | Full-bleed hero ceiling |

Apple's marketing pages center on **1068px**, not 1200px and not 980px. The 734px column is what body copy lives in.

[Source: apple.com main.built.css]

## 9. Border-Radius — Confirmed Values

Distinct values found:

| Value | Use |
|---|---|
| 5px | Tight elements |
| 8px | Default chips |
| 10px | Cards (legacy) |
| 12px | Cards / inputs |
| **980px** | Pill / fully-rounded button |

Apple uses 980px (not 9999px) as the pill radius across marketing assets.

[Source: apple.com main.built.css]

## 10. Easing & Motion — apple.com Globalheader

Confirmed from apple.com's globalheader CSS, which drives nav animation:

| Curve | Used | Use |
|---|---|---|
| `cubic-bezier(0.4, 0, 0.6, 1)` | 78× | Default ease-in-out |
| `cubic-bezier(0.25, 0.1, 0.3, 1)` | 13× | Ease-out |
| `cubic-bezier(1, 0.1, 0, 0.3)` | 1× | Specialty (reverse) |

Common online lore says Apple uses `cubic-bezier(0.22, 1, 0.36, 1)`. **They do not.** That's a Material-adjacent curve. The two values above are what apple.com actually ships.

[Source: apple.com globalheader.css]

## 11. Glass / Backdrop Filter — Apple Globalheader

Verbatim from apple.com nav CSS:

```css
backdrop-filter: saturate(180%) blur(20px);
background: rgba(250, 250, 252, 0.8);   /* light scrim */
background: rgba(22, 22, 23, 0.8);      /* dark scrim */
```

Three components, all required: 180% saturation (kills washed-out blur), 20px blur, ~80% scrim background. The saturation step is what makes Apple glass look like Apple glass.

[Source: apple.com globalheader.css]

## 12. Quick CSS — Sourced Variables Block

```css
:root {
  /* fonts (apple.com) */
  --font-display: "SF Pro Display", "SF Pro Icons", "Helvetica Neue",
                  Helvetica, Arial, sans-serif;
  --font-text: "SF Pro Text", "SF Pro Icons", "Helvetica Neue",
               Helvetica, Arial, sans-serif;

  /* type scale (apple.com) */
  --fs-12: 12px; --fs-14: 14px; --fs-17: 17px; --fs-19: 19px;
  --fs-21: 21px; --fs-24: 24px; --fs-28: 28px; --fs-32: 32px;
  --fs-40: 40px; --fs-48: 48px; --fs-56: 56px;

  /* tracking (apple.com) */
  --track-tight: -0.022em;
  --track-tighter: -0.016em;
  --track-loose: 0.011em;

  /* colors (apple.com marketing) */
  --bg: #ffffff;
  --surface: #f5f5f7;
  --text: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-tertiary: #86868b;
  --accent: #0071e3;
  --accent-hover: #0066cc;
  --accent-on-dark: #2997ff;
  --border: rgba(0, 0, 0, 0.08);

  /* easing (apple.com globalheader) */
  --ease-default: cubic-bezier(0.4, 0, 0.6, 1);
  --ease-out: cubic-bezier(0.25, 0.1, 0.3, 1);

  /* radii (apple.com) */
  --r-sm: 8px;
  --r-md: 12px;
  --r-pill: 980px;

  /* layout (apple.com) */
  --content-narrow: 420px;
  --content: 734px;
  --content-wide: 1068px;
  --content-max: 1680px;

  /* glass (apple.com globalheader) */
  --glass-bg-light: rgba(250, 250, 252, 0.8);
  --glass-bg-dark: rgba(22, 22, 23, 0.8);
  --glass-filter: saturate(180%) blur(20px);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000;
    --surface: #1d1d1f;
    --text: #f5f5f7;
    --text-secondary: #a1a1a6;
    --accent: #2997ff;
    --border: rgba(255, 255, 255, 0.08);
  }
}

body {
  font-family: var(--font-text);
  font-size: var(--fs-17);
  line-height: 1.4706;       /* apple.com body */
  letter-spacing: var(--track-tight);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-display);
  letter-spacing: var(--track-tighter);
  line-height: 1.0714;
  font-weight: 600;
}
```

---

## Sources

- [Apple Human Interface Guidelines — Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple Human Interface Guidelines — Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple Developer — Fonts (SF Pro download)](https://developer.apple.com/fonts/)
- [iOS HIG Typography table — codershigh archive](https://codershigh.github.io/guidelines/ios/human-interface-guidelines/visual-design/typography/index.html)
- [San Francisco typeface — Wikipedia](https://en.wikipedia.org/wiki/San_Francisco_(sans-serif_typeface))
- [KunalTanwar11/apple-colors — system color CSS variables](https://github.com/KunalTanwar11/apple-colors)
- apple.com production CSS (fetched 2026-05): `main.built.css`, `home.built.css`, `globalheader.css`
- [iOS font size guidelines — learnui.design](https://www.learnui.design/blog/ios-font-size-guidelines.html)

## What Changed From Internet-Lore Versions

| Common myth | Actual sourced value |
|---|---|
| Apple uses `cubic-bezier(0.22, 1, 0.36, 1)` | apple.com uses `cubic-bezier(0.4, 0, 0.6, 1)` and `cubic-bezier(0.25, 0.1, 0.3, 1)` |
| Apple max-width 980px | apple.com uses 734px / 1068px / 1680px |
| Apple Blue is `#0066CC` | Marketing site primary is `#0071E3`; iOS systemBlue is `#007AFF` (different) |
| Section padding "120px" | Not declared as a literal anywhere; derived from per-component spacing |
| "16px body" | apple.com body is 17px |

If a value isn't in this doc, it isn't sourced. Don't ship it as Apple-style.
