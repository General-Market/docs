# AntiCheatFull Miro Style — Hard Spec

Every SVG on the Miro board (`uXjVOkYo-do=`) must read like a still frame from `video/src/compositions/anticheat/AntiCheatFull.tsx`. This document defines exactly how. Copy snippets verbatim. Do not invent variants.

The visual language is not Apple's quiet keynote. It is the *theatrical* keynote: sparse, centered, one idea per frame, Base-blue accent, a dot-grid backdrop that runs under everything, and a radial halo that breathes behind the headline. The frame is a stage. Everything else is silence.

---

## 1. Palette — exact hex

```
bg            #F0F2F4   cool-gray page background
fg            #0A0A0A   primary text — near-black, never #000
fgSoft        #1F1F24   body / caption text
dim           #6E727A   eyebrow, tertiary
accent        #0052FF   Base blue — load-bearing
accentSoft    #5B79FF   accent on dark / secondary glow
accentTint    rgba(0, 82, 255, 0.10)   tinted surfaces
rule          rgba(10, 10, 12, 0.10)   dividers
ruleStrong    rgba(10, 10, 12, 0.22)   emphatic dividers
surface       #FFFFFF   card surfaces
darkPanel     linear gradient #0d0d10 → #050507   terminal panels
```

Apple blue `#0071E3` is **forbidden**. iOS systemBlue `#007AFF` is forbidden. Base blue `#0052FF` is the only marketing blue.

Signal accents (use only when meaning is the point):
- `#34C759` — confirmation / green PnL
- `#FF453A` — loss / refusal
- Traffic-light dots in macOS chrome: `#FF5F57`, `#FEBC2E`, `#28C840` (only inside a terminal/window mock)

---

## 2. Frame — every SVG starts here

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H"
     font-family="-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif">
  <defs>
    <!-- dot-grid pattern (Section 3) -->
    <!-- vignette + halo gradients (Section 4) -->
  </defs>

  <!-- background -->
  <rect x="0" y="0" width="W" height="H" fill="#F0F2F4"/>

  <!-- dot grid: fills entire canvas -->
  <rect x="0" y="0" width="W" height="H" fill="url(#dotgrid)"/>

  <!-- vignette: softens edges -->
  <rect x="0" y="0" width="W" height="H" fill="url(#vignette)"/>

  <!-- content -->
</svg>
```

No outer stroke. No rounded corner on the outer rect — Miro crops to bounds. No drop shadows. No gradients except the ones defined here.

---

## 3. Dot grid — copy verbatim

```xml
<pattern id="dotgrid" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
  <circle cx="7" cy="7" r="1.6" fill="#0052FF" opacity="0.22"/>
</pattern>
```

Lattice: 14 × 14 px. Dot radius 1.6 px. Color `#0052FF`. Opacity 0.22. This is the AntiCheat signature — the room behind everything. It is **not optional**.

---

## 4. Vignette and halo — copy verbatim

```xml
<!-- vignette: pulls the eye to centre -->
<radialGradient id="vignette" cx="50%" cy="50%" r="70%">
  <stop offset="40%" stop-color="#F0F2F4" stop-opacity="0"/>
  <stop offset="100%" stop-color="#F0F2F4" stop-opacity="0.55"/>
</radialGradient>

<!-- halo: radial Base-blue glow behind the hero headline -->
<radialGradient id="halo" cx="50%" cy="50%" r="50%">
  <stop offset="0%"  stop-color="#0052FF" stop-opacity="0.45"/>
  <stop offset="40%" stop-color="#0052FF" stop-opacity="0.14"/>
  <stop offset="100%" stop-color="#0052FF" stop-opacity="0"/>
</radialGradient>

<!-- halo placement: a wide blurred ellipse behind the wordmark -->
<filter id="haloBlur" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur stdDeviation="48"/>
</filter>
```

Halo usage:
```xml
<ellipse cx="CX" cy="CY" rx="600" ry="220" fill="url(#halo)" filter="url(#haloBlur)"/>
```

Apple-keynote bloom on the headline (Base-blue drop, white inner glow):
```xml
<style>
  .bloom {
    filter:
      drop-shadow(0 0 6px rgba(255,255,255,0.95))
      drop-shadow(0 0 24px rgba(255,255,255,0.55))
      drop-shadow(0 8px 36px rgba(0, 82, 255, 0.32));
  }
</style>
```

Use bloom on display text ≥80px. Do not use it on eyebrows or captions.

---

## 5. Type scale — fixed values

Always SF Pro Display ≥20px, SF Pro Text <20px, SF Mono for mono. Letter-spacing in absolute px (compute = size × tracking-em).

| Use | Size | Family | Weight | Tracking | Color |
|---|---:|---|---:|---:|---|
| Hero wordmark | 140 | SF Pro Display | 800 | -7px (-0.05em) | `#0A0A0A` |
| Display headline | 96 | SF Pro Display | 800 | -4.8px (-0.05em) | `#0A0A0A` |
| Scene title | 72 | SF Pro Display | 800 | -2.4px (-0.034em) | `#0A0A0A` |
| Card title | 48 | SF Pro Display | 700 | -1.06px (-0.022em) | `#0A0A0A` |
| Eyebrow | 14 | SF Mono | 700 | +2.5px (+0.18em) | `#6E727A` ALL CAPS |
| Tagline | 22 | SF Pro Text | 500 | -0.48px (-0.022em) | `#6E727A` |
| Body | 18 | SF Pro Text | 500 | -0.4px (-0.022em) | `#1F1F24` |
| Caption | 16 | SF Pro Text | 400 | -0.35px (-0.022em) | `#1F1F24` |
| Mono label | 14 | SF Mono | 600 | +0.6px (+0.04em) | `#6E727A` ALL CAPS |
| Big stat | 120 | SF Pro Display | 800 | -6px (-0.05em) | `#0A0A0A` or `#0052FF` |

One title weight, one body weight, one mono weight. Never bold-within-bold.

---

## 6. Composition — the only rule

**One declarative idea per card.** Eyebrow tells you the section. Title tells you the thesis. One central visual — terminal, stat, diagram, quote, icon — carries the weight. Caption (optional) is the knife at the bottom.

```
┌───────────────────────────────────┐
│                                   │
│   STEP 01 · THE REPO              │  ← eyebrow, 14px mono caps, dim
│                                   │
│   Clone the bot.                  │  ← title, 96px display, bloom
│                                   │
│       ┌─────────────────┐         │
│       │                 │         │
│       │   ONE VISUAL    │         │  ← centered, sparse, key element
│       │                 │         │
│       └─────────────────┘         │
│                                   │
│   The plumbing is solved.         │  ← caption, 22px tagline
│                                   │
└───────────────────────────────────┘
```

- Centered horizontally. Title block 40% down from top.
- Visual element occupies the middle third — give it air, never crowd the edges.
- ≥120px padding from the outer frame on all sides.
- No multi-column layouts. No grid of small cards inside a card. No bullets longer than 4.
- If you can't compress the idea to one frame, the idea is two frames.

---

## 7. Templates — copy these structures

### 7a. Tutorial step (eyebrow → title → terminal → caption)

The terminal is the AntiCheat signature visual. Use it for any "run this command" frame.

```xml
<!-- terminal panel -->
<defs>
  <linearGradient id="termBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#0d0d10"/>
    <stop offset="100%" stop-color="#050507"/>
  </linearGradient>
</defs>
<g transform="translate(CX, CY)">
  <rect x="-540" y="-160" width="1080" height="320" rx="10" fill="url(#termBg)"
        stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <!-- chrome -->
  <circle cx="-510" cy="-130" r="7" fill="#FF5F57"/>
  <circle cx="-488" cy="-130" r="7" fill="#FEBC2E"/>
  <circle cx="-466" cy="-130" r="7" fill="#28C840"/>
  <text x="-430" y="-125" font="500 18px 'SF Mono', monospace"
        fill="#9aa0a6" letter-spacing="1.4px">~/bot — claude</text>
  <line x1="-540" y1="-100" x2="540" y2="-100" stroke="rgba(255,255,255,0.08)"/>
  <!-- prompt + command -->
  <text x="-500" y="-40" font="500 28px 'SF Mono', monospace" fill="#9aa0a6">$</text>
  <text x="-470" y="-40" font="500 28px 'SF Mono', monospace" fill="#f1f3f5">git clone https://github.com/General-Market/vision-bot-examples</text>
  <text x="-500" y="20"  font="500 28px 'SF Mono', monospace" fill="#9aa0a6">$</text>
  <text x="-470" y="20"  font="500 28px 'SF Mono', monospace" fill="#f1f3f5">./setup.sh --auto-fund</text>
  <text x="-500" y="80"  font="500 28px 'SF Mono', monospace" fill="#5B79FF">✓ wallet funded</text>
</g>
```

Other key-visual options for tutorial frames:
- **Big stat tile**: one number (120px, Base blue), label below (14px mono caps)
- **Inline icon row**: 3-4 vector glyphs (no clip-art) with mono labels
- **Diff block**: dark panel showing one before / one after line

### 7b. Hero / wordmark frame

Display headline + radial halo behind it.

```xml
<ellipse cx="W/2" cy="H/2" rx="700" ry="220" fill="url(#halo)" filter="url(#haloBlur)"/>
<text x="W/2" y="H/2" text-anchor="middle" font="800 140px 'SF Pro Display', sans-serif"
      letter-spacing="-7" fill="#0A0A0A" class="bloom">General</text>
<text x="W/2" y="H/2+90" text-anchor="middle" font="500 26px 'SF Pro Text', sans-serif"
      letter-spacing="-0.6" fill="#6E727A">is the safe table.</text>
```

### 7c. Divider strip (full-width section header)

```xml
<text x="W/2" y="H/2 - 22" text-anchor="middle"
      font="700 14px 'SF Mono', monospace" letter-spacing="2.5" fill="#6E727A">
  SECTION 02
</text>
<text x="W/2" y="H/2 + 38" text-anchor="middle"
      font="800 96px 'SF Pro Display', sans-serif" letter-spacing="-4.8"
      fill="#0A0A0A" class="bloom">The seven mechanisms.</text>
```

### 7d. Mechanism flow (multi-step)

For diagrams like `01-toxic-flow`. Keep the existing step content, restyle the chrome:
- Background = bg + dot grid + vignette
- Step number = mono badge `01` in Base blue, 28px circle outline (no fill)
- Step title = 28px display, `#0A0A0A`
- Step caption = 16px text, `#1F1F24`
- Connector = 1.5px line, `rgba(10,10,12,0.22)` with arrowhead `#0052FF`
- No card-within-card. Steps live on the dot-grid stage directly.

### 7e. Voice quote (narrow card)

```xml
<text x="60" y="80" font="700 14px 'SF Mono', monospace" letter-spacing="2.5"
      fill="#6E727A">VOICE · 01</text>
<text x="60" y="180" font="500 32px 'SF Pro Display', sans-serif" letter-spacing="-0.7"
      fill="#0A0A0A">"The market makers always know."</text>
<text x="60" y="H-60" font="500 16px 'SF Pro Text', sans-serif" letter-spacing="-0.35"
      fill="#6E727A">— retail trader, Reddit r/options, 2024</text>
```

### 7f. Refusal card (problem → fix)

```
┌─────────────────────────┐
│  REFUSAL · C1           │  ← eyebrow
│                         │
│  Insider trading        │  ← problem (red)
│  ↓                      │
│  Sealed bitmap commits  │  ← fix (Base blue)
│                         │
│  Nobody sees the bet    │  ← caption
│  until the round closes.│
└─────────────────────────┘
```

The arrow is 1.5px Base blue with a small arrowhead. The two phrases are 36px display. The caption is 16px text.

---

## 8. Forbidden — these break the language

- **GitHub UI mocks**, browser chrome, file trees with emoji folders. The bot tutorial used these — they go.
- **Multiple nested cards** (rect inside rect inside rect).
- **Drop shadows** on any element. (Bloom on display text is `drop-shadow` but that's a filter, not a decoration.)
- **Bright color fills** outside the palette. No purple, orange, yellow except where Section 1 lists them.
- **Decorative gradients.** The only gradients allowed are: vignette, halo, terminal panel.
- **Multiple accent colors per frame.** One blue. One red OR one green. Never both unless the comparison IS the frame.
- **Tiny text** (<14px). Body floor is 16px. Mono floor is 14px.
- **Center-and-left mixed.** If the title is centered, everything is centered.
- **Lucid/Mermaid/Bloomberg/Tableau** aesthetics. If it could appear on a B-school slide, redesign.

---

## 9. Preserve

- **Existing viewBox dimensions.** Don't change canvas sizes — Miro positions assume them.
- **Existing semantic content.** Whatever the old SVG was *saying*, the new SVG says the same thing better. The title, the data, the message — all preserved. The chrome is what changes.
- **File names.** Same filenames, same paths. The upload scripts depend on them.

---

## 10. The knife test

Read your finished SVG aloud:
1. The eyebrow tells me what section I'm in.
2. The title is one declarative sentence.
3. The visual proves the title.
4. The caption ends with a word that makes me pause.

If any of those four can be cut and the frame still reads — cut it.
