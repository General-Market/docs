# DA Proposition: Captain Workout-Inspired Shorts Factory

**Date:** 2026-02-11
**Style Reference:** [Captain Workout](https://captainworkout.com/) — "Bodybuilding Made Simple"
**Adapted for:** Remotion ChibiExplainer template (18 layers, 7 emotions)

---

## 1. Core Visual Identity

### Mood

**Authoritative but fun.** Dark, clean, geometric. Feels like a premium app UI, not a kids' cartoon. The humor comes from the character expressions and script, not from visual chaos. Every element has purpose.

### Design Principles

1. **Dark-first**: Black/near-black backgrounds, light elements pop
2. **Teal accent**: One dominant accent color, used sparingly for maximum impact
3. **Geometric precision**: Sharp corners, no rounded blobs, angular shapes
4. **Minimal clutter**: Empty space is a feature, not a bug
5. **ALL CAPS energy**: Aggressive typography that commands attention
6. **Cool-toned**: No warm oranges or yellows — teals, cyans, whites, cool purples

---

## 2. Color Palettes (7 Emotions)

All palettes share the same foundation:
- **Base black**: `#0A0A0F` (near-black with slight blue)
- **Base white**: `#E8ECF0` (cool white)
- **Mid gray**: `#2A2A35` (dark panels, cards)

### Per-Emotion Palettes

```
NEUTRAL
  gradient:  ["#0A0A0F", "#1A1A25", "#0F1A1F"]
  accent:    "#88A1A3"   (Captain Workout signature teal)
  highlight: "#FFFFFF"
  particles: "rgba(136,161,163,0.10)"

EXCITED
  gradient:  ["#0A0A0F", "#0F1F2A", "#0A2530"]
  accent:    "#00E5CC"   (electric teal)
  highlight: "#00FF99"
  particles: "rgba(0,229,204,0.15)"

CONFUSED
  gradient:  ["#0A0A0F", "#1A1025", "#25102A"]
  accent:    "#9B7AFF"   (cool purple)
  highlight: "#C4A8FF"
  particles: "rgba(155,122,255,0.12)"

PANICKING
  gradient:  ["#0A0A0F", "#200A0A", "#350A10"]
  accent:    "#FF3355"   (danger red — still cool-toned)
  highlight: "#FF6680"
  particles: "rgba(255,51,85,0.15)"

HAPPY
  gradient:  ["#0A0A0F", "#0A1520", "#0F2030"]
  accent:    "#4CEAFF"   (sky cyan)
  highlight: "#88F5FF"
  particles: "rgba(76,234,255,0.12)"

SAD
  gradient:  ["#0A0A0F", "#0A0A15", "#10101F"]
  accent:    "#5566AA"   (muted steel blue)
  highlight: "#8899CC"
  particles: "rgba(85,102,170,0.08)"

ANGRY
  gradient:  ["#0A0A0F", "#1A0A0A", "#250A0F"]
  accent:    "#FF2244"   (hot red)
  highlight: "#FF0033"
  particles: "rgba(255,34,68,0.18)"
```

### Cohesion Rules

- All gradients start from `#0A0A0F` (same base)
- Accents are always from the cool/neon family (no warm oranges, browns, or pastels)
- Particle opacity stays between 0.08 (sad/low energy) and 0.18 (angry/high energy)
- Caption highlight always lighter than accent (never darker)
- All palettes pass 4.5:1 contrast ratio against `#0A0A0F` background

---

## 3. Typography

### Font Stack

| Role | Font | Weight | Size | Style |
|------|------|--------|------|-------|
| **Primary Caption** | **Dela Gothic One** | Regular (it's already heavy) | 64-72px | ALL CAPS |
| **UI / Watermark** | **Open Sans** | Bold (700) | 22-26px | Title Case |

### Caption Style: "Captain" Preset

```json
{
  "fontFamily": "Dela Gothic One, sans-serif",
  "fontSize": 68,
  "fontWeight": 400,
  "color": "#FFFFFF",
  "strokeColor": "#000000",
  "strokeWidth": 4,
  "highlightColor": "#88A1A3",
  "currentWordColor": "#00E5CC",
  "letterSpacing": 2,
  "textTransform": "uppercase"
}
```

**Caption behavior:**
- 1-3 words at a time
- Active word: teal highlight (`#00E5CC`)
- Scale pop-in per word (spring, not linear)
- Black stroke (4px) for readability on dark gradient
- Positioned center-screen, slightly above midpoint (y: 800)

### Font Files to Bundle

```
public/shared/fonts/
  DelaGothicOne-Regular.woff2     (~30KB — single weight font)
  OpenSans-Bold.woff2             (~25KB)
```

---

## 4. Chibi Character Style Guide

### Style: "Dark Chibi"

Captain Workout uses simplified anatomical figures. For the chibi adaptation:

- **Proportions**: 1:1.2 head-to-body (slightly less super-deformed than classic chibi — more "young adult" than "baby")
- **Line art**: Clean, consistent 3px black outline on all elements
- **Shading**: Flat color fills with ONE shadow layer (cel-shaded, no gradients on characters)
- **Color palette**: Character colors pulled from the neutral theme — teal accents on clothing/accessories, skin tones are slightly desaturated
- **Eyes**: Large but angular (not round), with sharp pupil shapes
- **Expression exaggeration**: Strong but geometric — eyebrows are thick angular strokes, not thin curves
- **Background**: ALL characters on transparent PNG with NO glow/halo effects

### Character Color Rules

- **Skin**: Desaturated warm (`#D4B896` base, `#B8956A` shadow)
- **Hair**: Dark (`#1A1A25` or `#2A2530` — never bright colors)
- **Outfit**: Teal accent (`#88A1A3`) as primary clothing color, `#2A2A35` as secondary
- **Eyes**: White sclera, dark pupil with small teal sparkle
- **Outline**: `#0A0A0F` (matches background base)

### Expression Mapping

| Emotion | Eyebrow Shape | Eye Style | Mouth | Body Accent |
|---------|--------------|-----------|-------|-------------|
| neutral | Flat, slightly angled | Normal, steady | Small smirk | Arms relaxed |
| excited | Raised, thick angular | Wide, teal sparkle | Open grin | Fists up |
| confused | One up, one down | Spiral/dot pupils | Wavy line | Head tilt, "?" above |
| panicking | High, wavy | Shrunk pupils, wide open | Jagged open | Sweat drops, arms flail |
| happy | Soft raised | Closed arcs ^_^ | Wide smile | Slight lean |
| sad | Inner corners up | Half-closed, teardrop | Downturned | Shoulders dropped |
| angry | Deep V-shape | Small intense pupils | Teeth-bearing | Clenched fists, vein |

### File Specs

- Format: PNG-32, transparent background
- Resolution: 1000 x 1400px per emotion (2x display size)
- Compression: lossless (OptiPNG)
- Naming: `neutral.png`, `excited.png`, etc.
- Anchor: Center-of-mass at (500, 800) for all emotions

---

## 5. Background & Overlay System

### Animated Gradient

- **Style**: Slow-rotating radial gradient, noise-driven center drift
- **Speed**: 0.3deg/frame rotation (subtle, not disco)
- **Colors**: From emotion palette gradient array
- **Crossfade**: 12 frames between emotion changes

### Particle Field

- **Shape**: Small angular diamonds and dots (NOT circles — geometric)
- **Count**: 20 (sad) to 50 (angry/panicking)
- **Color**: From emotion `particles` value
- **Motion**: Slow upward drift with Perlin noise displacement
- **Energy modulation**: Particle opacity and speed scale with `energy_curve`

### Ambient Shimmer

- **Style**: Full-screen noise overlay, very subtle
- **Tint**: Teal-biased (`rgba(136,161,163,0.04)` base)
- **Opacity**: 0.03-0.08 range (barely visible, just adds texture)

### Vignette

- **Intensity**: 45% (stronger than default — emphasizes the dark aesthetic)
- **Spread**: 45%
- **Color**: Pure black (not tinted)

### Film Grain

- **Intensity**: 0.05 (subtle — just enough to feel cinematic, not VHS)
- **Animated**: Yes (per-frame noise)
- **Blend mode**: Overlay

### Color Grade (CSS)

Per-emotion overlay at very low opacity:
- neutral: `rgba(136,161,163,0.06)` (teal tint)
- excited: `rgba(0,229,204,0.08)`
- confused: `rgba(155,122,255,0.06)`
- panicking: `rgba(255,51,85,0.08)`
- happy: `rgba(76,234,255,0.06)`
- sad: `rgba(85,102,170,0.05)`
- angry: `rgba(255,34,68,0.08)`

---

## 6. SFX Palette (Branded Selection)

### Core "Captain" Sound Signature

The audio identity should feel **clean, techy, and punchy** — not cartoony. Think sci-fi UI sounds, digital impacts.

| SFX Type | Style | Variants | Used For |
|----------|-------|----------|----------|
| **Signature whoosh** | Digital swoosh, slightly metallic | 3 (light/med/heavy) | Every transition |
| **Impact** | Deep sub-bass hit + digital crunch | 3 | Punchlines, reveals |
| **Pop** | Clean digital pop, not cartoon bubble | 3 | Word pop-in, list items |
| **Sparkle** | High-freq digital shimmer | 2 | Keywords, highlights |
| **Riser** | Synthetic tension build | 2 (short/long) | Before reveals |
| **Error** | Low digital buzz | 2 | Wrong answer, fails |
| **Success** | Ascending digital chime | 2 | Correct answer, wins |
| **Notification** | Single clean bell/ping | 2 | CTA, alerts |

**Total branded SFX: ~22 core files** (keep it tight — consistency over variety)

### Audio Specs

- WAV, 48kHz, 16-bit, mono
- Normalized to -18 LUFS per file
- Peak: -3 dBFS
- Style: Clean digital/techy, NOT cartoon/organic

### Sonic Logo

- 2-second sequence: sub-bass thud → ascending teal-energy chime
- Plays at frame 0 of every Short
- Volume: 0.4 (present but not dominant)

---

## 7. Music Bed Strategy

### Mood Matrix (Captain Workout-Inspired)

The music should be **dark electronic, minimal beats, techy**. No acoustic guitar, no pop vocals.

| Energy | Style | Track Count |
|--------|-------|-------------|
| **High** | Dark trap, industrial bass | 4-5 |
| **Medium** | Lo-fi dark ambient, minimal techno | 4-5 |
| **Low** | Atmospheric pads, dark ambient | 3-4 |
| **Transitional** | Risers, tension builds | 2-3 |

**Total: ~15-17 tracks** (lean library — quality over quantity)

**Key genres:**
- Dark trap / phonk (high energy segments)
- Minimal dark techno (medium energy)
- Dark ambient / atmospheric (low energy, sad segments)
- Industrial / glitch (angry/panicking segments)

**Avoid**: Pop, acoustic, cheerful/bright, anything with lyrics

---

## 8. Emoji / Sticker Set

### Style: Geometric + Teal-Tinted

Since Captain Workout is geometric and minimal, the emoji set should match:

- **NO cute round emoji** — use angular/geometric shapes
- **Teal monochrome**: All stickers use the accent palette, not full-color
- **Minimal detail**: Icon-like, not illustration-like

### Proposed Set (20 base SVGs)

| Category | Emojis | Style |
|----------|--------|-------|
| **Energy** | Lightning bolt, flame, rocket, explosion | Angular, teal fill |
| **Reaction** | Check mark, X mark, question mark, exclamation | Geometric, bold stroke |
| **Emotion** | Star eyes, skull, sweat drop, heart | Simplified, angular |
| **Body** | Muscle arm, brain, target, crown | Clean line art, teal accent |
| **UI** | Arrow up, arrow down, plus, minus | Minimal, sharp |

**Format**: SVG with parameterized `fill` color (reads from theme accent)
**Size**: 120x120 viewBox, stroke-width 3

---

## 9. Motion Tokens

### "Captain" Motion Profile

The motion should feel **snappy and digital** — not bouncy or playful.

```json
{
  "easing": {
    "entrance": "cubic-bezier(0.0, 0.0, 0.2, 1)",
    "exit": "cubic-bezier(0.4, 0.0, 1, 1)",
    "standard": "cubic-bezier(0.4, 0.0, 0.2, 1)",
    "snappy": "cubic-bezier(0.2, 0.0, 0.0, 1)",
    "punch": "cubic-bezier(0.0, 0.8, 0.2, 1)"
  },
  "duration": {
    "instant": 4,
    "fast": 8,
    "normal": 14,
    "slow": 24,
    "dramatic": 40
  },
  "stagger": {
    "tight": 2,
    "normal": 4,
    "loose": 8
  }
}
```

**Key motion rules:**
- Entrances: **Slide up + fade** (not scale-in — too playful)
- Exits: **Fade out + slight slide down** (quick, 6 frames max)
- Beat pulse: **Scale 1.04** (subtle, not 1.15 — keep it controlled)
- Chibi idle: **Minimal breathing only** (no bounce, no sway — authoritative stance)
- Caption words: **Pop-in with "snappy" easing** (fast start, hard stop)
- Transitions: **Hard cuts preferred** over smooth crossfades (matches the sharp aesthetic)

---

## 10. Progress Bar & Watermark

### Progress Bar

- **Height**: 2px (thinner than default — elegant)
- **Color**: Theme accent color
- **Position**: Bottom of frame
- **Style**: Sharp edges (no rounded ends)

### Watermark

- **Font**: Open Sans Bold, 22px
- **Color**: `rgba(255,255,255,0.2)` (very subtle)
- **Position**: Bottom-right, 60px from edges
- **Text**: `@yourchannel`

---

## 11. LUT / Color Grading Direction

### Per-Mood LUT Approach

| Mood | Grade Direction |
|------|----------------|
| neutral | Slight teal push in shadows, desaturate midtones |
| excited | Boost teal/cyan highlights, slight contrast lift |
| confused | Push shadows toward purple, slight haze |
| panicking | Boost red shadows, crush blacks slightly, add contrast |
| happy | Boost cyan highlights, slightly brighter overall |
| sad | Desaturate globally, push blue in shadows, lower contrast |
| angry | Boost red midtones, high contrast, crush blacks |

### CSS Filter Approach (Alternative to .cube LUTs)

```css
/* neutral */  filter: brightness(1.02) contrast(1.05) saturate(0.9) hue-rotate(-5deg);
/* excited */  filter: brightness(1.05) contrast(1.08) saturate(1.1);
/* confused */ filter: brightness(0.98) contrast(1.02) saturate(0.85) hue-rotate(10deg);
/* panicking */ filter: brightness(1.02) contrast(1.15) saturate(1.2);
/* happy */    filter: brightness(1.08) contrast(1.05) saturate(1.0);
/* sad */      filter: brightness(0.92) contrast(0.95) saturate(0.7);
/* angry */    filter: brightness(1.0) contrast(1.2) saturate(1.3);
```

Start with CSS filters (simpler, no color space issues). Upgrade to .cube LUTs only if CSS doesn't provide enough control.

---

## 12. Summary: Complete DA Asset Inventory

| Category | Count | Style Keywords |
|----------|-------|---------------|
| **Theme JSONs** | 7 | Dark base, cool accent, geometric |
| **Fonts** | 2 files | Dela Gothic One (caps) + Open Sans (body) |
| **Chibi characters** | 7 emotions × N characters | Angular, flat-shaded, teal accents, dark outline |
| **SFX** | ~22 core files | Digital, clean, techy, NOT cartoon |
| **Music beds** | 15-17 tracks | Dark electronic, minimal, no vocals |
| **Custom emoji** | 20 SVGs | Geometric, teal monochrome, icon-like |
| **LUTs/Grades** | 7 | Cool-toned, high contrast, per-mood |
| **Brand audio** | 3 files | Sonic logo + 2 signature transitions |
| **Motion tokens** | 1 JSON | Snappy, digital, controlled (not bouncy) |

### Total File Count: ~85-100 files
### Estimated Size: ~100-200 MB
### Production Time: ~12-16 days (parallelized)
### Budget: ~$360-$500/year (recommended tier)

---

## Visual Reference Board

```
┌─────────────────────────────────────────────────────┐
│  ██████████████████  #0A0A0F (base)                 │
│  ████                #1A1A25 (gradient mid)         │
│  ████                #2A2A35 (panel/card)           │
│  ████                #88A1A3 (signature teal)       │
│  ████                #00E5CC (electric teal)        │
│  ████                #E8ECF0 (cool white)           │
│  ████                #FF3355 (danger red)           │
│  ████                #9B7AFF (cool purple)          │
│  ████                #4CEAFF (sky cyan)             │
│                                                     │
│  Aa  DELA GOTHIC ONE — ALL CAPS HEADERS             │
│  Aa  Open Sans Bold — body text and watermark       │
│                                                     │
│  ◆ ◇ ▸ ▹  Angular particles, not circles           │
│  ⚡ 💀 ✓ ✗  Geometric emoji, teal monochrome        │
│                                                     │
│  Motion: snappy, digital, no bounce                 │
│  Audio: dark electronic, techy SFX                  │
│  Grain: 5% subtle, Film noir vignette: 45%          │
└─────────────────────────────────────────────────────┘
```
