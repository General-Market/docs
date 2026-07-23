# General Market — Remotion Style & Motion Set

Sibling to `apple-style-table.md` (statics) and `video/.claude/rules/remotion.md` (grammar). Governs how a frame moves and feels. Every value sourced from our shipped comps in `video/src/`. Paste at the top of any Remotion prompt.

**Feel:** one idea per slide, *shown*. Elements morph, don't cut. Nothing flashes or shears. Camera deliberate, never nervous. Right = `RetailPnLMarketsReelShort` (the spine), `BatchFlowReel`, the `article-2/*` walls, the flow-vis card. Wrong = `AntiCheatFull` (too loud).

**The three AI-slop tells — all banned (see §4, §1, §11):** (1) a generic colored/black rounded-square logo in the corner; (2) every element fading up from below; (3) a giant hero over a tiny caption (blown size delta).

## The reference model — `RetailPnLMarketsReelShort`
The flagship shape; everything below serves it. A vertical loop (**1080×1920 @60**, ~20s) locked to a **144-BPM bar grid** — beat 25f · bar 100f · **screen = 3 bars = 300f**, four screens. One **constant hero** (a light floating chart panel) holds while the **field flips** between screens: light `#F0F2F4` with *horizontal* dot-bands ↔ electric `#2D5BFF` with *vertical* ones. Screens hand off on the **pixel dissolve** (`PixelCurtain`, 60px cells, sweep in up-left → peel down-right). Motion is **data morphing** — the curve lifts and "moves left", captions spring in on the downbeat with a tiny beat-pulse — never a fade. It **opens already moving**: music on the drop, the ground carries a `lead`, the loop wrap is peeled at the head. The back screens **burn the curve red** (`#EE2B2B` + shaded wedge) for the turn.

## 1. Fonts — `common/fonts.ts`
`import { font, monoFont }` — never hand-roll a stack.
- `font` = **Bricolage Grotesque** (sans), weights 400/500/600/700/800
- `monoFont` = **Commit Mono** (numbers, detail, captions), weights 400/500/700

Both self-hosted in `public/fonts/*.woff2`, loaded via `@remotion/fonts` (neither is in the installed `@remotion/google-fonts`). The premium-grotesque + financial-mono aura — Coinbase Sans / Söhne feeling — with no competitor's typeface. Bricolage carries an optical-size axis; we use its weight cuts (the Display/Text optical split is a future refinement).

| element | px | weight | tracking | family |
|---|---|---|---|---|
| label | 31 | 700 | −0.016em | sans |
| hero value | 38 | 800 | −0.02em | sans · tabular |
| sub-label | 20 | 500 | +0.01em | mono |
| payoff caption | 18 | 500 | +0.01em | mono · italic |

- `tabular-nums` on every counting number.
- **Type-scale delta ≤ 2.5×** (largest ÷ smallest on one slide). Card = 38/18 ≈ 2.1× ✓. ✗ an 80px hero title over a 20px label/caption = 4× — the slop look. If the hero is big, the label and caption rise to meet it; a slide is a *range* of sizes, never a cliff.

## 2. Color
**Blues:** brand/marketing `#0071E3` (azure, calm — site, canvas). Electric accent `#2D5BFF` "GM Electric" (data cards, bars, hero numbers — same voltage as Coinbase's blue, indigo-leaning to bridge azure ↔ violet). Both ours. **`#0052FF` is Coinbase's — banned** except where it literally represents Coinbase (e.g. `logos.ts` venue rows).

Pastel canvas world — `batch-flow/theme.ts`:

| token | hex |
|---|---|
| text | #1D1D1F |
| dim / faint | #5A5B6A / #8A8B9C |
| blue / on-dark | #0071E3 / #2997ff |
| violet / pink | #6E5BFF / #FF7AC6 |
| up / down | #1FB877 / #F2566B |
| glass / border | rgba(255,255,255,.62) / .72 |

`PILL_GRADIENT = linear-gradient(95deg,#0071E3,#5E78FF,#9E7BFF)`
NEON-12: `#0071E3 #1FB877 #E8A13A #7B5CFF #17B0A6 #FF7A59 #9AB02A #FF6FB5 #22B36B #2BA6F0 #5566E0 #F0556A`

Base data-card world — `anticheat/theme.ts`: `bg #F0F2F4 · fg #0A0A0A · fgSoft #1F1F24 · dim #6E727A · surface #FFF · rule rgba(10,10,12,.10) · accent #2D5BFF`.
Accent = `#2D5BFF` (GM Electric), migrated off Coinbase's `#0052FF` across 24 comps. `#0052FF` now remains *only* where it represents Coinbase (`overlays/logos.ts`, `vision/vc2`, `vision/vc3`).

**Field flip — the reel device (`RetailPnLMarketsReelShort`).** Screens alternate two full-frame grounds: light `#F0F2F4` (text `#0A0A0A`, dim `#6E727A`) and electric `#2D5BFF` (text `#FFFFFF`, dim `rgba(255,255,255,.72)`). `#EE2B2B` is the "burn" red for the turn. Same hero, opposite field — the flip *is* the identity.

## 3. Background — dot grid (`DotGrid.tsx`)
Paper, not decoration. 14px lattice · dot r 1.6 · base alpha 0.22 · fill = accent. Two layers: static fine grid + drifting saturated bands (speed contrast reads as motion).
Calm tuning: `<DotGrid intensity={0.7} speed={0.9}/>` + `<DotGridVignette intensity={0.24}/>`.
`VerticalDotGrid` / `tone="white"` for dark/falling scenes. Flat-fill ground OK in the glass world.

**Reel ground — `RetailPnLReelShortBg`.** The same field as a fast steady drift: 18px grid breathing under the wave field + bright dot-bands streaking. `direction` flips with the field (horizontal on white, vertical on blue), `tone` flips the dot colour, `lead` head-starts the clock so it's already moving at frame 0. `speed ≈ 2.8`.

## 4. Slide layout
- One primary line, centered; detail directly beneath. No copy in corners.
- **One idea per slide** — second sentence = second slide.
- **Never a lone number or title.** Every slide carries an illustration/element (bar, chart, diagram, logo row, packet). One idea ≠ one element. The number captions the picture.
- **Corner mark = `components/BrandMark.tsx` only** (`surface="dark|light"`), quiet, one corner. ✗ Never a generic colored/black rounded-square glyph — that placeholder square is the #1 slop tell.

Panel (native 1180×1004, aspect 1.174 — beside a 1/3 webcam): `PAD_X 72 · PAD_TOP 72 · PAD_BOTTOM 60 · LABEL_W 360 · VALUE_W 210 · bar H 30 (r=H/3) · rows flex:1`. Pastel world: `WINDOW_SCALE 0.92`.

## 5. The chart — calm-card recipe (`LogoBarChart.tsx`, the 3:35 chart)
*This is the canonical chart.* Ranked data → logo-labelled rows, two-tone bars, one payoff line.
1. ground = bg + DotGrid + vignette
2. rows `flex:1`: logo+name (LABEL_W) | two-tone bar (flex) | value (VALUE_W, right)
3. bar: faded fill `opacity .3` = full edge, solid `opacity 1` = gated; dashed zero-line
4. reveal: rows grow on house spring, staggered
5. one italic mono payoff beneath the baseline
6. camera locked — no breathing

**Floating-panel chart (reads on any field) — `RetailPnLPairChart`.** A light panel (`#FFFFFF→#F4F6F9`, radius 44, soft drop-shadow) so it sits on white *or* electric-blue ground. The point *animates*: a **ghost** curve (where you were, `#AEB3BB`) stays while the live curve **lifts** toward the dashed "perfectly fair" diagonal via `progress` (`EASE.out`, ~2 bars) — motion is the data moving, not a fade. Glow stroke (w15 @ .4, blur 9) under a solid (w8) + node dots; highlight screens shade the wedge `rgba(238,43,43,.18)`; venue logos in white rounded tiles beneath.

## 6. House spring (`LogoBarChart` + `BatchFlowReel`)
`spring({ fps, frame, config:{ mass:0.6, damping:16, stiffness:120 }, durationInFrames:26 })` — the one settle for arrivals. New configs are deliberate exceptions.

## 7. Easing (`common/easing.ts` — canonical; the reel imports this)
| name | bezier | use |
|---|---|---|
| out | (0.16,1,0.3,1) | reveals, cards in, the curve lift |
| in | (0.7,0,0.84,0) | exits |
| inOut | (0.87,0,0.13,1) | main moves, close |
| smooth | (0.4,0,0.2,1) | general |
| overshoot | (0.34,1.56,0.64,1) | a deliberate bounce-past |
| snap | (0.075,0.82,0.165,1) | quick settle |

Also: `elastic`, `dramatic` (use sparingly). `cam (0.5,0,0.2,1)` for the continuous-canvas pan lives in `batch-flow/theme.ts`. Never `(0.22,1,0.36,1)` (Material lore).

## 8. Camera — no breathing
No idle sin pulse — `breath={0}`. Life comes from content + dot-grid, not a scaling frame. Two moves only:
1. **locked** (default)
2. **one directed travel** — canvas glide, or a single climax push (`1.0→1.06`).

No nervous drift. If it moves, it moves toward something.

## 9. Open in action
Start mid-action. Frame 0 is already composed and already moving — no blank hold, **no special frame-0 setup**. The opener (camera glide / first reveal) is simply already running at frame 0. Enter a scene that's gliding, never a still that then starts.
Exemplar (`RetailPnLMarketsReelShort`): music opens on the drop (≈53.8s in), the ground gets a `lead` head-start, the loop wrap is peeled at the head — frame 0 is already in motion.

## 10. Continuous canvas — morph, don't cut (`batch-flow/theme.ts`)
One board = 3×3 full-frame cells (`BOARD_W/H = 3·W / 3·H`); camera snakes cell→cell at `scale:1` (cam easing). `OPEN 1.9s` fly-in from whole board · `TRANSITION 1.3s` glides · `CLOSE 1.7s` pull-back + `1.6s` hold (pull-back proves one surface).
Elements **morph** into the next (card→packet→pool→lines→payout) — data constant, representation transforms. Cross-fading two things reads as two things. Narrative cuts = parentheses; resume where paused.

## 11. Reveals — never fade-up-from-below
**The cardinal slop sin: a whole slide fading in + sliding up from below. Banned.** A reveal is *specific to the thing*. Pick from the `article-2/*` vocabulary:
- **Wipe-on** — `scaleX(0→1)`, origin `left center`, ~14f, `EASE.out`. Highlights, bars, rules (`ArticlePage.tsx`).
- **Spring-grow from baseline** — bars scale up on the house spring, staggered `reveal*n − i` (`ThreeWallsPrimitives.tsx` `BarTail`).
- **Decelerating stagger** — each item dwells `×0.93` of the last; the list accelerates in (`WhyLiquidityIsHard.tsx`).
- **Counter that swells** — number tweens *and* its size scales with `log10(value)`; a billion reads huge (`MarketUniverseScale.tsx`).
- **Focus-pull** — `blur 26px→0` as it sharpens, no opacity fade (`MarketCostScale.tsx`).
- **Char stagger** for headlines — `RevealChars` (`vibe.tsx`): stagger 1.6f · dur 12f · y 14 · blur 6 · scale 0.94→1 · quart-out.
- Calm-card rows — `local = frame − 8 − i*2.5`, grow on house spring.

If you must lift, lift *one* element with Y momentum — never the whole set on one shared fade. **Reusable primitives:** `article-2/ThreeWallsPrimitives.tsx` (`FlowStream`, `BarTail`, `GridWall`, `ShatterBurst`, `VenueCard`) + `ThreeWallsTrack.tsx` (`TrackBoard`, `ci()` clamp-interpolate, `camAt()` camera). Import the verb; don't reinvent it.

**Captions (karaoke) — the standard, `CaptionLayer.tsx` (the 3:48 caption).** Lower-third (`bottom 140`), word-by-word, each word popping on the frame it's spoken (synced to audio). Base words heavy white (900, ~98px, −0.02em) with a dark edge + soft bloom so they read on any background; **one keyword per clause in electric blue**, with an underline that sweeps in (`scaleX`, left origin). Per-word spring `{damping:16, mass:0.6, stiffness:170}`, 14f: scale 0.7→1, rise 16→0. Block fades 5f in / 12f out; lead 0.12s, tail 1.15s. Never drawn over a panel. Use our sans + electric `#2D5BFF` (drop the legacy Coinbase-brightened `#2E7BFF`).

## 12. Transitions
Ban `fade` / cross-dissolve. Prefer, in order: **morph** (no transition) > **pixelate** (`HexPixelate`, cell coarse↔fine) > **snapZoomSoft** (`transitions.tsx`: fg 1.0→1.14→0.9, blur 4px, 5vw, no flash/veil).
Caps (exceeding = stress): `zoom ≤1.14 · blur ≤4px · flash 0 · slide ≤5vw · veil/leak 0`.
Off-limits: `snapZoomIntense` (1.42 / 11px / flash 0.18 / 12vw shear), `snapZoomOut` veil, beat-locked flashing.

**Reveal context by camera, not by fade:** pull back tight cell → whole grid (`TechnicalOverload.tsx`, `MarketCostScale.tsx`), glide between landmarks (`camAt()`), or shatter a wall with physics (`ShatterBurst`, gravity 820). Flow is moving dots on a dashed line (`FlowStream`), never a static arrow.

## 13. Pacing (`remotion.md`)
~2.5–3 words/sec + ~0.4s settle. One idea/slide. Data beats hold 4–7s. Leave rests.
**Reels lock to the bar grid, not the kick.** Tie screen changes + caption moves to bars (e.g. 144 BPM @60: beat 25f · bar 100f · screen = 3 bars = 300f ≈ 5s). Structure on the bar = calm and inevitable; flashing on every kick = `AntiCheatFull` stress. Same grid, opposite result.

## 14. The dial we reject — `AntiCheatFull`
Negative reference. Stressful: cuts every ~0.87s · 42% zoom jump · 11px blur · 0.18 flash · 12vw shear · 15+ elements moving. Well-built, top of the dial. We work in the bottom third.

## 15. Paste-block
```ts
import { Easing } from "remotion";
// Fonts: import { font, monoFont } from "common/fonts"
//   font = Bricolage Grotesque, monoFont = Commit Mono (self-hosted, public/fonts)

export const BRAND_BLUE  = "#0071E3"; // azure — site, canvas (Apple marketing blue)
export const GM_ELECTRIC = "#2D5BFF"; // electric accent — data cards, bars, hero numbers
// #0052FF is Coinbase's — banned except where it represents Coinbase (logos.ts).

export const PASTEL = { text:"#1D1D1F", dim:"#5A5B6A", faint:"#8A8B9C",
  blue:"#0071E3", onDark:"#2997ff", violet:"#6E5BFF", pink:"#FF7AC6",
  up:"#1FB877", down:"#F2566B",
  glass:"rgba(255,255,255,.62)", glassBorder:"rgba(255,255,255,.72)" };
export const PILL_GRADIENT = "linear-gradient(95deg,#0071E3,#5E78FF,#9E7BFF)";
export const BASE = { bg:"#F0F2F4", fg:"#0A0A0A", fgSoft:"#1F1F24",
  dim:"#6E727A", surface:"#FFFFFF", rule:"rgba(10,10,12,.10)",
  accent:"#2D5BFF" /* GM Electric (was Coinbase #0052FF) */ };

// Reel spine — RetailPnLMarketsReelShort
export const FIELD = { white:"#F0F2F4", electric:"#2D5BFF", burn:"#EE2B2B" }; // field-flip
export const REEL  = { w:1080, h:1920, fps:60, bpm:144, beat:25, bar:100, screen:300 };

export const EASE = { out:Easing.bezier(0.16,1,0.3,1), in:Easing.bezier(0.7,0,0.84,0),
  inOut:Easing.bezier(0.87,0,0.13,1), smooth:Easing.bezier(0.4,0,0.2,1),
  cam:Easing.bezier(0.5,0,0.2,1) };
export const HOUSE_SPRING = { config:{ mass:0.6, damping:16, stiffness:120 }, durationInFrames:26 };
export const REVEAL = { stagger:1.6, duration:12, y:14, blur:6, scale:0.94 };
export const ROW_STAGGER = { headDelay:8, step:2.5 };
export const GRID = { intensity:0.7, speed:0.9, vignette:0.24, spacingPx:14, dotRadius:1.6, baseAlpha:0.22 };
export const LAYOUT = { padX:72, padTop:72, padBottom:60, labelW:360, valueW:210, barH:30, windowScale:0.92 };
export const PACING = { wordsPerSec:[2.5,3], settleSec:0.4, beatHoldSec:[4,7] };

// RULES
// 1 No fade. morph > pixelate > snapZoomSoft. Never snapZoomIntense.
// 2 Camera locked or ONE directed move. No breathing (breath=0).
// 3 Start in action — frame 0 already composed + moving, no special setup.
// 4 One idea per slide, centered. Quiet corner BrandMark.
// 5 Never a lone number/title — always an illustration/element.
// 6 Stagger reveals; never wholesale-fade.
// 7 Type-scale delta ≤2.5×. No tiny font beside a giant hero.
// 8 tabular-nums on counting numbers.
// 9 Caps: zoom ≤1.14, blur ≤4px, slide ≤5vw, no flash/veil/leak.
// 10 NO fade-up-from-below. Reveal = wipe / spring-grow / decel-stagger /
//    counter-swell / focus-pull / camera. Import verbs from article-2.
// 11 Corner = BrandMark only. Never a generic colored rounded-square (slop).
// 12 Reels: constant hero + field-flip (white↔electric) + pixel-dissolve seams,
//    locked to the bar grid. Open already moving (music on drop + bg lead).
```

## Sources (`video/src/`)
**reel spine `compositions/retail-pnl/RetailPnLMarketsReelShort.tsx` (+ `RetailPnLReelShortBg`, `RetailPnLPairChart`)** · fonts `common/fonts.ts` · easing `common/easing.ts` · Base+grid `compositions/anticheat/theme.ts`, `anticheat/DotGrid.tsx` · pastel+camera `compositions/batch-flow/theme.ts` · calm card `compositions/anticheat-edit/overlays/LogoBarChart.tsx` · reveals `anticheat/vibe.tsx` · captions `anticheat-edit/CaptionLayer.tsx` · **motion vocabulary `compositions/article-2/*` (`ThreeWallsPrimitives`, `ThreeWallsTrack`, `WhyLiquidityIsHard`, `MarketUniverseScale`, `MarketCostScale`)** · transitions `anticheat/transitions.tsx`, `effects/HexPixelate.tsx` · brand mark `components/BrandMark.tsx` · grammar `video/.claude/rules/remotion.md` · negative ref `anticheat/AntiCheatFull.tsx` · statics `docs/apple-style-table.md`
