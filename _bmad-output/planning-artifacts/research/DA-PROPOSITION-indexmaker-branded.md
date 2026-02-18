# DA Proposition: IndexMaker-Branded Shorts Factory

**Date:** 2026-02-11
**Style Reference:** [IndexMaker Frontend](https://github.com/IndexMaker/indexmaker_frontend) — fintech dashboard UI
**Adapted for:** Remotion ChibiExplainer template (18 layers, 7 emotions)

---

## 1. Core Visual Identity

### Mood

**Professional fintech meets engaging education.** Dark, clean, data-forward. The IndexMaker frontend is a flat, minimal dashboard — the Shorts take that same DNA and dial up just enough personality through chibi expressions and script. The brand stays coherent: someone watching a Short and then visiting the app should feel the same visual language.

### Design Principles

1. **Dark-first fintech**: `#15181a` base — same dark mode as the app
2. **Brand blue anchor**: `#2470ff` is the singular accent — used for highlights, CTAs, energy
3. **Flat and clean**: No glass morphism, no neumorphism — flat fills with subtle borders, matching the shadcn/ui aesthetic
4. **Data-inspired**: Numbers, charts, grids as visual motifs where relevant
5. **Plex precision**: IBM Plex Sans across everything — technical credibility
6. **Restrained motion**: No bounce, no overshoot — spring-based but controlled, like the frontend's animation profile

### Brand DNA Transfer (Frontend → Shorts)

| Frontend Element | Shorts Equivalent |
|-----------------|-------------------|
| Dark mode (`#15181a`) | Base background gradient |
| Card surface (`#202426`) | Panel/overlay surfaces |
| Brand blue buttons (`#2470ff`) | Caption highlight, keyword accent, progress bar |
| Wallet gradient (green→cyan→blue→purple) | Special effect gradient (reveals, intros) |
| IBM Plex Sans body text | Caption font |
| FK Grotesk Neue display | Title cards, hook text |
| Lucide icons (line style) | Custom emoji/sticker set |
| `shadow-sm` / `border-accent` | Subtle chibi shadow, overlay borders |
| Green-500 / Red-500 semantics | Positive/negative visual cues in content |

---

## 2. Color Palettes (7 Emotions)

All palettes share the IndexMaker dark mode foundation:
- **Base dark**: `#15181a` (app `--background`)
- **Surface**: `#202426` (app `--foreground` in dark mode)
- **Border subtle**: `rgba(175,175,175,0.10)` (app `--accent` dark mode)
- **Text primary**: `#FFFFFF` (app `--primary` dark mode)
- **Text secondary**: `rgba(255,255,255,0.80)` (app `--secondary` dark mode)
- **Text muted**: `rgba(255,255,255,0.50)` (app `--muted` dark mode)

### Per-Emotion Palettes

```
NEUTRAL
  gradient:  ["#15181a", "#1a1e22", "#15181a"]
  accent:    "#2470ff"   (brand blue — the default)
  highlight: "#FFFFFF"
  particles: "rgba(36,112,255,0.08)"
  surface:   "#202426"

EXCITED
  gradient:  ["#15181a", "#151e2a", "#0f1f30"]
  accent:    "#3EDCEB"   (from wallet gradient — cyan)
  highlight: "#88F5FF"
  particles: "rgba(62,220,235,0.12)"
  surface:   "#1a2530"

CONFUSED
  gradient:  ["#15181a", "#1a1525", "#201028"]
  accent:    "#5533FF"   (from wallet gradient — purple end)
  highlight: "#8866FF"
  particles: "rgba(85,51,255,0.10)"
  surface:   "#201a2a"

PANICKING
  gradient:  ["#15181a", "#1f1518", "#28101a"]
  accent:    "#ef4444"   (app red-500 — sell/error semantic)
  highlight: "#FF6680"
  particles: "rgba(239,68,68,0.14)"
  surface:   "#251a1e"

HAPPY
  gradient:  ["#15181a", "#152218", "#102a18"]
  accent:    "#A5FECA"   (from wallet gradient — green start)
  highlight: "#C8FFE0"
  particles: "rgba(165,254,202,0.10)"
  surface:   "#1a2520"

SAD
  gradient:  ["#15181a", "#15161e", "#131420"]
  accent:    "#5566AA"   (muted steel blue — desaturated brand)
  highlight: "#8899CC"
  particles: "rgba(85,102,170,0.06)"
  surface:   "#1a1c22"

ANGRY
  gradient:  ["#15181a", "#1f1215", "#2a0f12"]
  accent:    "#FF2244"   (high-intensity red)
  highlight: "#FF4466"
  particles: "rgba(255,34,68,0.16)"
  surface:   "#251518"
```

### Cohesion Rules

- All gradients start and end with `#15181a` (app dark mode base)
- `NEUTRAL` always uses `#2470ff` — it IS the brand
- `EXCITED` and `HAPPY` pull from the wallet gradient (`#A5FECA → #3EDCEB → #2594FF → #53F`)
- `PANICKING`/`ANGRY` use the app's semantic red-500 (`#ef4444`) and escalations
- `CONFUSED` uses the wallet gradient purple end (`#53F` family)
- `SAD` is a desaturated version of brand blue
- Particle opacity: 0.06 (sad) → 0.16 (angry), tracking energy level
- All accent colors pass 4.5:1 contrast ratio against `#15181a`

---

## 3. Typography

### Font Stack

| Role | Font | Weight | Size | Style |
|------|------|--------|------|-------|
| **Primary Caption** | **IBM Plex Sans** | Bold (700) | 60-68px | Sentence case |
| **Hook / Title Card** | **FK Grotesk Neue Trial** | Bold | 72-80px | ALL CAPS |
| **Data Display** | **Geist Mono** | Medium (500) | 48-56px | For numbers, stats, prices |
| **Watermark** | **IBM Plex Sans** | Medium (500) | 20px | Title Case |

### Caption Style: "IndexMaker" Preset

```json
{
  "fontFamily": "IBM Plex Sans, sans-serif",
  "fontSize": 64,
  "fontWeight": 700,
  "color": "#FFFFFF",
  "strokeColor": "#000000",
  "strokeWidth": 3,
  "highlightColor": "#2470ff",
  "currentWordColor": "#3EDCEB",
  "letterSpacing": 0.5,
  "textTransform": "none"
}
```

**Caption behavior:**
- 2-4 words at a time (Plex is more compact than display fonts — can fit more)
- Active word: brand blue highlight (`#2470ff`) with slight scale (1.05x)
- Prior words: white at 80% opacity (matches app `--secondary`)
- Stroke: 3px black for readability on gradient
- Positioned center-screen at y: 820 (slightly above midpoint)
- Line height: 1.3 (IBM Plex needs breathing room)

### Hook Text (First 1-2 seconds)

- Font: FK Grotesk Neue Trial Bold, ALL CAPS
- Size: 76px
- Color: `#FFFFFF`
- Entrance: Slide up + fade (matching the app's `framer-motion` splash pattern: `opacity: 0, y: 20` → `opacity: 1, y: 0`)
- Optional: key stat displayed in Geist Mono (e.g., "+340%") in brand blue

### Font Files to Bundle

```
public/shared/fonts/
  IBMPlexSans-Bold.woff2          (~35KB)
  IBMPlexSans-Medium.woff2        (~35KB)
  IBMPlexSans-Regular.woff2       (~35KB)
  FKGroteskNeueTrial-Bold.woff2   (~30KB — convert from OTF)
  GeistMono-Medium.woff2          (~25KB)
```

---

## 4. Chibi Character Style Guide

### Style: "Fintech Chibi"

The IndexMaker frontend is clean, flat, and professional. The chibi characters bridge "fun" and "credible" — they explain complex crypto/index concepts without undermining trust.

### Design Rules

- **Proportions**: 1:1.3 head-to-body (slightly more adult than classic chibi — fintech, not kindergarten)
- **Line art**: Clean 2.5px outline, `#15181a` (app dark bg color)
- **Shading**: Flat color fills, single shadow layer, NO gradients on characters
- **Color palette**: Neutral grays with brand blue accents on clothing/accessories
- **Eyes**: Medium-large, rounded but not overly cute — professional yet expressive
- **Expression style**: Clear and readable, moderate exaggeration (less anime, more infographic mascot)
- **Background**: ALL transparent PNG, NO glow/halo/shadow baked in

### Character Color Rules

- **Skin**: Neutral warm (`#D4B896` base, `#B8956A` shadow) — same as previous DA
- **Hair**: Dark neutral (`#202426` — matches app surface color)
- **Outfit primary**: Brand blue (`#2470ff`) — shirt, hoodie, or vest
- **Outfit secondary**: App surface gray (`#303436` — matches app `--ring` dark)
- **Eyes**: White sclera, dark pupil, tiny brand blue reflection
- **Outline**: `#15181a` (app background)
- **Accessories**: Optional glasses, headphones, laptop — fintech vibe

### Expression Mapping

| Emotion | Eyebrow Shape | Eye Style | Mouth | Body Accent |
|---------|--------------|-----------|-------|-------------|
| neutral | Relaxed, level | Normal, steady | Small confident smile | Arms at sides or crossed |
| excited | Raised | Wide, brand-blue sparkle | Open grin | Pointing up, energy gesture |
| confused | One up, one down | Spiral/? pupils | Wavy line | Head tilt, "?" above |
| panicking | High, tense | Wide, shrunk pupils | Jagged open | Hands on head, sweat drops |
| happy | Soft raised | Closed arcs ^_^ | Wide smile | Thumbs up, slight lean |
| sad | Inner corners drooped | Half-closed, dull | Downturned | Shoulders dropped, hunched |
| angry | Deep V-shape | Intense, small pupils | Teeth clenched | Fists clenched, vein |

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
- **Speed**: 0.2deg/frame (very slow — fintech dignity, not rave)
- **Colors**: From emotion palette gradient array
- **Crossfade**: 15 frames between emotion changes (slightly longer = smoother)

### Particle Field

- **Shape**: Small circles and dots (clean, minimal — matching Lucide icon line weight aesthetic)
- **Count**: 15 (sad/low) to 35 (excited/high) — less dense than Captain Workout proposition
- **Color**: From emotion `particles` value
- **Motion**: Slow upward drift with Perlin noise, very gentle
- **Energy modulation**: Opacity and count scale with `energy_curve`

### Ambient Shimmer

- **Style**: Full-screen noise overlay, extremely subtle
- **Tint**: Brand blue-biased (`rgba(36,112,255,0.02)`)
- **Opacity**: 0.02-0.05 (barely perceptible — just adds life)

### Vignette

- **Intensity**: 35% (lighter than Captain Workout — fintech is more open/readable)
- **Spread**: 50%
- **Color**: Pure black

### Film Grain

- **Intensity**: 0.03 (very subtle — just enough texture to avoid sterile digital feel)
- **Animated**: Yes (per-frame noise)
- **Blend mode**: Overlay

### Color Grade

Per-emotion overlay at minimal opacity:
- neutral: `rgba(36,112,255,0.04)` (brand blue tint)
- excited: `rgba(62,220,235,0.06)` (cyan tint)
- confused: `rgba(85,51,255,0.05)` (purple tint)
- panicking: `rgba(239,68,68,0.06)` (red tint)
- happy: `rgba(165,254,202,0.04)` (green tint)
- sad: `rgba(85,102,170,0.03)` (steel blue tint)
- angry: `rgba(255,34,68,0.06)` (red tint)

---

## 6. SFX Palette

### Sound Signature: "Clean Fintech"

The audio identity matches the UI: **clean, precise, digital** — think notification sounds from a premium trading app, not sci-fi or cartoon.

| SFX Type | Style | Variants | Used For |
|----------|-------|----------|----------|
| **Whoosh** | Clean air swoosh, light digital tail | 3 (soft/med/hard) | Transitions |
| **Impact** | Tight sub-bass thud + digital click | 3 (light/med/heavy) | Punchlines, reveals |
| **Pop** | Crisp UI click/pop, like button press | 3 | Word pop-in, list items |
| **Sparkle** | High-freq shimmer, like notification chime | 2 | Keywords, highlights |
| **Riser** | Clean synthetic build, ascending pitch | 2 (short/long) | Before reveals |
| **Notification** | Single bell/ping, like app notification | 2 (soft/prominent) | CTA, alerts |
| **Success** | Ascending 3-note digital chime | 2 | Correct, gains, green |
| **Error** | Low digital thud/buzz | 2 | Wrong, losses, red |
| **Data** | Quick digital scan/ticker sound | 2 | Numbers appearing, stats |

**Total: ~24 core files**

### Audio Specs

- WAV, 48kHz, 16-bit, mono
- Normalized to -18 LUFS per file
- Peak: -3 dBFS
- Style: Clean, precise, UI-like — NOT cartoon or sci-fi

### Sonic Logo

- 2-second sequence: soft sub pulse → ascending 3-note chime in brand blue tonality (bright, clear, confident)
- Plays at frame 0 of every Short
- Volume: 0.35

---

## 7. Music Bed Strategy

### Mood Matrix

The music matches IndexMaker's professional tone but keeps YouTube engagement. **Electronic, clean, modern** — not dark/aggressive like Captain Workout.

| Energy | Style | Track Count |
|--------|-------|-------------|
| **High** | Future bass, clean trap, upbeat electronic | 4-5 |
| **Medium** | Lo-fi electronic, chillstep, minimal beats | 4-5 |
| **Low** | Ambient electronic pads, soft synths | 3-4 |
| **Transitional** | Risers, filter sweeps, tension builds | 2-3 |

**Total: ~15-17 tracks**

**Key genres:**
- Future bass / clean electronic (high energy — excited, happy)
- Lo-fi beats / chillhop (medium energy — neutral)
- Ambient electronic / atmospheric (low energy — sad)
- Tense electronic / glitch-light (panicking, angry — but NOT aggressive)

**Avoid**: Heavy metal, acoustic guitar, pop vocals, dark trap/phonk, anything overly aggressive

**Vibe reference**: Think "Stripe/Linear promo video music" — modern, clean, slightly energetic electronic that says "we're building the future"

---

## 8. Emoji / Sticker Set

### Style: Lucide-Inspired Line Icons

The IndexMaker frontend uses Lucide React — clean line icons with consistent 2px stroke. The sticker set follows the same visual language.

- **Stroke style**: 2px consistent stroke, rounded caps and joins (matching Lucide)
- **Color**: Single-color, using accent from current emotion palette
- **Fill**: None (outline only) — or subtle fill at 10% opacity

### Proposed Set (20 SVGs)

| Category | Icons | Reference |
|----------|-------|-----------|
| **Finance** | Chart up ↗, chart down ↘, dollar sign, wallet | App's trading context |
| **Energy** | Lightning, flame, rocket, sparkles | Lucide: `Zap`, `Flame`, `Rocket`, `Sparkles` |
| **Reaction** | Check circle, X circle, question, alert triangle | Lucide: `CheckCircle2`, `XCircle`, `HelpCircle`, `AlertTriangle` |
| **Emotion** | Heart, star, skull, trophy | Simplified line art |
| **Data** | Target, trending up, bar chart, brain | Lucide: `Target`, `TrendingUp`, `BarChart3` |

**Format**: SVG, parameterized `stroke` color (reads from theme accent)
**ViewBox**: 120x120, stroke-width 2.5
**Style**: Match Lucide icon proportions and optical balance

---

## 9. Motion Tokens

### "IndexMaker" Motion Profile

Matching the frontend: spring-based, controlled, no overshoot. The frontend uses `stiffness: 120, damping: 20` for framer-motion and `tension: 140, friction: 18` for react-spring.

```json
{
  "spring": {
    "entrance": { "stiffness": 120, "damping": 20 },
    "caption": { "stiffness": 200, "damping": 25 },
    "pulse": { "stiffness": 300, "damping": 15 },
    "settle": { "stiffness": 80, "damping": 22 }
  },
  "easing": {
    "entrance": "cubic-bezier(0.0, 0.0, 0.2, 1)",
    "exit": "cubic-bezier(0.4, 0.0, 1, 1)",
    "standard": "cubic-bezier(0.4, 0.0, 0.2, 1)"
  },
  "duration": {
    "instant": 4,
    "fast": 8,
    "normal": 16,
    "slow": 28,
    "dramatic": 45
  },
  "stagger": {
    "tight": 2,
    "normal": 4,
    "loose": 8
  }
}
```

**Key motion rules:**
- Entrances: **Slide up + fade** (`y: 20` → `y: 0`, matching app splash screen pattern)
- Exits: **Fade out** (quick, 6-8 frames)
- Beat pulse: **Scale 1.03** (very subtle — fintech restraint)
- Chibi idle: **Gentle breathing + micro-sway** (alive but calm)
- Caption words: **Spring pop with `stiffness: 200, damping: 25`** (snappy but no overshoot)
- Transitions: **Mix of cross-fades and clean slides** (not hard cuts — too aggressive for brand)
- Stagger: 2-frame stagger between elements (matching app's `i * 0.15` but converted to frame timing)

---

## 10. Progress Bar & Watermark

### Progress Bar

- **Height**: 3px (matching current template default)
- **Color**: Brand blue `#2470ff`
- **Position**: Bottom of frame
- **Style**: Sharp left edge, rounded right edge (`border-radius: 0 2px 2px 0`) — subtle polish
- **Background**: `rgba(255,255,255,0.05)` track visible

### Watermark

- **Font**: IBM Plex Sans Medium, 20px
- **Color**: `rgba(255,255,255,0.15)` (very subtle — fintech elegant)
- **Position**: Bottom-right, 50px from edges
- **Text**: `@indexmaker`

---

## 11. LUT / Color Grading Direction

### Per-Mood Grading

| Mood | Direction | CSS Filter Equivalent |
|------|-----------|----------------------|
| neutral | Slight blue push in shadows, clean midtones | `brightness(1.02) contrast(1.04) saturate(0.95)` |
| excited | Boost cyan highlights, slight warmth | `brightness(1.05) contrast(1.06) saturate(1.05)` |
| confused | Push shadows toward purple, slight desaturate | `brightness(0.98) contrast(1.02) saturate(0.85) hue-rotate(8deg)` |
| panicking | Red shadows, boost contrast | `brightness(1.0) contrast(1.12) saturate(1.15)` |
| happy | Green-tinted highlights, bright | `brightness(1.08) contrast(1.04) saturate(1.0)` |
| sad | Desaturate, push blue, lower contrast | `brightness(0.93) contrast(0.96) saturate(0.72)` |
| angry | Red midtones, high contrast, crush blacks | `brightness(0.98) contrast(1.18) saturate(1.25)` |

Start with CSS filters. Upgrade to `.cube` LUTs only if CSS filters can't handle the precision needed.

---

## 12. Special: Wallet Gradient Effect

The wallet identity gradient (`#A5FECA → #3EDCEB → #2594FF → #53F`) is a signature IndexMaker visual element. Use it sparingly as a "premium" effect:

- **Intro sequence**: Gradient sweep across screen as the Short opens (1-2 seconds)
- **Reveal moments**: Gradient text fill on key stats/numbers
- **Chibi entrance**: Subtle gradient glow behind chibi on first appearance
- **Outro**: Gradient fills the progress bar in the final 2 seconds

Implementation: CSS `linear-gradient(135deg, #A5FECA, #3EDCEB, #2594FF, #53F)` — matches the `br` (bottom-right) direction from the app.

---

## 13. Summary: Complete DA Asset Inventory

| Category | Count | Style Keywords |
|----------|-------|---------------|
| **Theme JSONs** | 7 | `#15181a` base, `#2470ff` accent, flat fintech |
| **Fonts** | 5 files | IBM Plex Sans (body) + FK Grotesk Neue (display) + Geist Mono (data) |
| **Chibi characters** | 7 emotions × N characters | Clean flat, brand blue accents, professional-cute |
| **SFX** | ~24 core files | Clean, precise, UI notification-like |
| **Music beds** | 15-17 tracks | Future bass, lo-fi electronic, ambient synths |
| **Custom stickers** | 20 SVGs | Lucide-inspired line icons, 2.5px stroke |
| **LUTs/Grades** | 7 | Per-mood, subtle, brand-coherent |
| **Brand audio** | 3 files | Sonic logo + 2 signature transitions |
| **Motion tokens** | 1 JSON | Spring-based, restrained, no overshoot |

### Total File Count: ~85-100 files
### Estimated Size: ~100-200 MB
### Production Time: ~12-16 days (parallelized)

---

## Visual Reference Board

```
┌─────────────────────────────────────────────────────┐
│  ██████████████████  #15181a (app dark bg)           │
│  ████                #202426 (app surface)           │
│  ████                #303436 (app ring/panel)        │
│  ████                #2470ff (BRAND BLUE)            │
│  ████                #3EDCEB (wallet cyan)           │
│  ████                #A5FECA (wallet green)          │
│  ████                #53F    (wallet purple)         │
│  ████                #FFFFFF (primary text)          │
│  ████                #ef4444 (sell/error red)        │
│  ████                #22c55e (buy/success green)     │
│                                                      │
│  Aa  FK Grotesk Neue Bold — HOOK TITLES              │
│  Aa  IBM Plex Sans Bold — caption body text          │
│  01  Geist Mono Medium — numbers and stats           │
│                                                      │
│  ○ ◦ · ·  Soft circular particles (not angular)      │
│  ↗ ⚡ ✓ △  Lucide-style line stickers                │
│                                                      │
│  ╔═══════════════════════╗                           │
│  ║ Wallet Gradient Sweep ║                           │
│  ║ #A5FECA → #3EDCEB →  ║                           │
│  ║ #2594FF → #53F        ║                           │
│  ╚═══════════════════════╝                           │
│                                                      │
│  Motion: spring 120/20, no bounce, slide-up + fade   │
│  Audio: clean electronic, UI-like SFX                │
│  Grain: 3% subtle, Vignette: 35% (open, readable)   │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░  Progress: #2470ff 3px        │
└─────────────────────────────────────────────────────┘
```

---

## Comparison: Captain Workout DA vs IndexMaker DA

| Element | Captain Workout | IndexMaker |
|---------|----------------|------------|
| Base dark | `#0A0A0F` (pure black) | `#15181a` (warm dark gray) |
| Accent | `#88A1A3` teal | `#2470ff` brand blue |
| Typography | Dela Gothic One ALL CAPS | IBM Plex Sans sentence case |
| Vibe | Aggressive, dark, gym | Professional, clean, fintech |
| Particles | Angular diamonds | Soft circles |
| Motion | Snappy, hard stops | Spring-based, controlled ease |
| SFX | Sci-fi/techy | Clean UI notifications |
| Music | Dark trap, phonk | Future bass, lo-fi electronic |
| Emoji | Geometric teal monochrome | Lucide-style line strokes |
| Vignette | 45% (dramatic) | 35% (open) |
| Grain | 5% (cinematic) | 3% (minimal) |
| Special element | — | Wallet gradient sweeps |
