# Format Engine Architecture: Short (9:16) → Long (16:9) Conversion

## Problem

Short-01 is built for 9:16 vertical (1080x1920). We need an engine that renders the **same content** (same shots, same audio, same duration) in 16:9 landscape (1920x1080) for YouTube — with everything that layout change implies.

## Core Constraint

**The shot definitions (`ShotDef[]`) do NOT change.** The engine adapts the visual layout, not the content. Same 32 shots, same 73.41 seconds, same voice/music/SFX.

---

## Architecture: Format Context + Layout Resolver

### 1. Format Provider (new)

```
src/engine/format/
├── FormatContext.tsx       # React context + provider
├── useLayout.ts           # Hook returning computed layout values
├── formats.ts             # Format definitions (SHORT_9x16, LONG_16x9)
└── index.ts
```

**`FormatContext.tsx`** — Wraps any composition and declares which format is active:

```tsx
type VideoFormat = "short-9x16" | "long-16x9";

interface FormatContextValue {
  format: VideoFormat;
  layout: LayoutConfig;
}

// Components call useLayout() to get position/sizing values
```

**`formats.ts`** — Two layout configs:

| Property | Short (9:16) | Long (16:9) |
|----------|-------------|-------------|
| WIDTH | 1080 | 1920 |
| HEIGHT | 1920 | 1080 |
| FPS | 30 | 30 |
| CHIBI_SIZE | 1600 | 900 |
| CHIBI_ANCHOR | center-bottom | right-bottom |
| CHIBI_X_OFFSET | 0 (centered) | 35% from right |
| CAPTION_POSITION | bottom 12% center | bottom 8% center |
| CAPTION_MAX_WIDTH | 920 | 1400 |
| CAPTION_FONT_SHOUT | 76 | 56 |
| CAPTION_FONT_QUIET | 46 | 36 |
| CALLOUT_TOP | 380 | 200 |
| CALLOUT_MAX_WIDTH | 900 | 1200 |
| TOP_SAFE | 288 | 60 |
| BOTTOM_SAFE | 672 | 120 |
| PROGRESS_BAR_HEIGHT | 3 | 3 |
| LETTERBOX_HEIGHT | 90 | 60 |

### 2. What Changes Per Component

#### A. VoiceSyncChibi — Character Repositioning

**Short (9:16):** Chibi is center-bottom, fills ~80% of width, dominates the frame.

**Long (16:9):** Chibi moves to the **right third**, smaller (~50% of height), anchored bottom-right. This frees the left 2/3 for content.

Changes:
- Position: `left: 50%` → `right: ${layout.chibiXOffset}%` or `left: ${layout.chibiXPx}px`
- Size: 1600px → ~900px (read from `layout.CHIBI_SIZE`)
- Entrance offsets: 400px (bottom) → ~250px, 600px (left/right) → ~400px
- Shadow: Scale proportionally
- All metrics remain proportional — just smaller canvas footprint

#### B. ShotCaptions — Wider, Lower

**Short:** 2-word phrases, 920px max width, bottom 12%, massive font (76/46px).

**Long:** Same 2-word phrases but wider max (1400px), bottom 8%, slightly smaller font (56/36px). Captions stay centered across full width — they're not tied to the chibi position.

Changes:
- `MAX_CAP_WIDTH`: 920 → from `layout.captionMaxWidth`
- Font sizes: from `layout.captionFontShout` / `layout.captionFontQuiet`
- Bottom position: `12%` → from `layout.captionBottom`
- Padding: `0 80px` → `0 120px` (more breathing room on wide screen)

#### C. DataCallout — Reposition for Wide Canvas

**Short:** Centered at `top: 380px`, max 900px.

**Long:** Centered at `top: 200px`, max 1200px — or shifted left to avoid chibi overlap. Use `layout.calloutTop` and `layout.calloutMaxWidth`.

Changes:
- `top: 380` → `top: ${layout.calloutTop}`
- `MAX_WIDTH: 900` → from `layout.calloutMaxWidth`
- Font sizes: proportionally adjusted

#### D. ShotBackground — Fill Strategy

**Short:** 1080x1920 images with `objectFit: "cover"`.

**Long:** Same images, still `objectFit: "cover"` — but the crop will be different (horizontal slice vs vertical slice). Most backgrounds (gradients, solid, videos) adapt automatically. Images may look different but still work.

Ken Burns zoom direction stays the same — just on a wider canvas.

`scrollDown` effect: Different travel distance since canvas is shorter (1080 vs 1920 tall).

Changes:
- Scroll speed calculations need `layout.HEIGHT`
- kenBurns: works as-is (percentage-based zoom)
- Split backgrounds: side-by-side still works, different proportions

#### E. AnimatedBg — Canvas Scaling

Particles, matrix, grid, waves, radial, trading, bokeh — these use the full canvas. Most are percentage-based or use `AbsoluteFill` and will scale automatically.

Changes:
- Any hardcoded pixel values → read from layout
- Particle counts may need adjustment (wider canvas = more particles for same density)

#### F. Data Visualizations (BarChart, Rankings, CompoundingList, QuestionStack)

These are positioned with hardcoded pixel values. In 16:9, they have more horizontal room.

**Strategy:** Each reads from layout for positioning. The visual style stays the same, just repositioned.

- `AnimatedBarChart`: Wider bars, positioned in left 2/3
- `AnimatedRankings`: More horizontal space, same vertical list
- `CompoundingList`: Same, repositioned
- `QuestionStack`: Same, repositioned

#### G. ArchitectureDiagram — More Horizontal Space

Architecture diagrams benefit from 16:9 — nodes can spread wider. The `topPad` and `nodeScale` in the shot definition already parameterize layout.

Changes:
- Default `topPad`: 300 → ~150 (shorter canvas)
- Nodes spread wider naturally with more X space

#### H. 3D Scenes (TradingFloor, MoneyExplosion, CrowdVisualization)

Three.js scenes automatically adapt to container aspect ratio IF they use the Remotion `<ThreeCanvas>` which reads width/height from composition config. Camera FOV may need adjustment for wider views.

Changes:
- Camera aspect ratio: automatic from composition dimensions
- Scene composition: may want wider camera spread
- Could be left as-is initially — 3D scenes fill their container

#### I. CinematicLetterbox

**Short:** 90px bars on a 1920px-tall frame (4.7% coverage).

**Long:** ~60px bars on a 1080px-tall frame (5.5% coverage — proportional).

Changes: Read bar height from `layout.letterboxHeight`.

#### J. Global Overlays (Vignette, FilmGrain, ProgressBar)

All use `AbsoluteFill` or percentage-based sizing → **work as-is**. No changes needed.

### 3. Composition Registration

New composition in `Root.tsx`:

```tsx
import { short01Meta } from "./shorts/short-01/Short01Composition";

// Existing
<Composition {...short01Meta} />

// New: Long format version
<Composition
  id="Short01-Long"
  component={Short01LongComposition}   // wraps Short01 with FormatProvider
  durationInFrames={short01Meta.durationInFrames}
  fps={30}
  width={1920}
  height={1080}
/>
```

`Short01LongComposition` is just `Short01Composition` wrapped in `<FormatProvider format="long-16x9">`.

### 4. Implementation Approach

The engine should be **format-agnostic** — not hardcoded to short-01. Any short that uses the standard component library can render in either format by wrapping with `FormatProvider`.

**Phase 1 — Foundation:**
1. Create `FormatContext` + `useLayout()` hook + format definitions
2. Refactor `LAYOUT` constants in `types.ts` to be defaults that `useLayout()` overrides
3. Create `Short01LongComposition` wrapper

**Phase 2 — Core Components (must-change):**
4. `VoiceSyncChibi` → read position/size from `useLayout()`
5. `ShotCaptions` → read max-width, font size, position from `useLayout()`
6. `DataCallout` → read position/max-width from `useLayout()`
7. `ShotBackground` → use `layout.HEIGHT` for scroll calculations
8. `ShotRenderer` → camera drift/vertical drift pixel values from layout

**Phase 3 — Visual Components:**
9. Data viz components → repositioning
10. 3D scenes → verify they adapt (may need camera FOV tweaks)
11. Animated backgrounds → verify particle density

**Phase 4 — Polish:**
12. Tune chibi size/position for visual balance
13. Tune caption readability at smaller font
14. Verify all 32 shots render correctly in 16:9
15. Adjust any background images that crop poorly in landscape

### 5. Key Design Decisions

1. **No shot definition changes** — The engine is a rendering layer, not a content layer. Shots stay identical.

2. **Chibi goes right, content goes left** — Standard YouTube talking-head layout. The wide canvas means we can show more content alongside the character instead of layering everything.

3. **Captions stay centered at bottom** — YouTube viewers expect subtitles at bottom-center. Don't move them to the side.

4. **Same audio, no re-timing** — Voice, music, SFX, silence windows are frame-locked and format-independent. Zero audio changes.

5. **Progressive enhancement** — Components that don't read from `useLayout()` still work (they'll use their hardcoded values). We can migrate components incrementally without breaking the existing 9:16 format.

6. **Reusable for any short** — The engine isn't short-01-specific. Short-02, short-03, etc. can all use `<FormatProvider format="long-16x9">` to get landscape versions.

### 6. File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/engine/format/` (new) | Create | FormatContext, useLayout, format definitions |
| `Short01Composition.tsx` | Minor edit | Extract inner content so LongComposition can wrap it |
| `Short01LongComposition.tsx` (new) | Create | Thin wrapper with FormatProvider |
| `VoiceSyncChibi.tsx` | Edit | Read position/size from useLayout() |
| `ShotCaptions.tsx` | Edit | Read layout values from useLayout() |
| `DataCallout.tsx` | Edit | Read layout values from useLayout() |
| `ShotRenderer.tsx` | Edit | Camera drift values from layout |
| `ShotBackground.tsx` | Edit | Scroll calculations use layout height |
| `Root.tsx` | Edit | Register new Long composition |
| `types.ts` | Minor | LAYOUT becomes default, not sole source |

### 7. Visual Layout Reference

**Short (9:16) — Current:**
```
┌──────────┐
│ BG FULL  │
│          │
│ CALLOUT  │
│ (center) │
│          │
│  CHIBI   │
│  (big,   │
│  center) │
│          │
│ CAPTIONS │
│ (bottom) │
└──────────┘
  1080x1920
```

**Long (16:9) — Target:**
```
┌──────────────────────────────────────┐
│  BG FULL WIDTH                        │
│                                        │
│   CALLOUT / DATA VIZ      CHIBI      │
│   (left-center)          (right,     │
│                          smaller)     │
│                                        │
│          CAPTIONS (bottom center)      │
└──────────────────────────────────────┘
                1920x1080
```
