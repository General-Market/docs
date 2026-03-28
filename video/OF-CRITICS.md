# OF Video — Critics Backlog

All issues found by investigation agents. Organized by scene + timestamp.
Structural issues (affect multiple scenes) at the top.

## STRUCTURAL — Affects Entire Video

- [ ] **Timeline offset ~0.5s too fast everywhere.** Phase transitions happen 0.3-0.5s earlier than reference. Needs a global timing audit — every phase start/end should be shifted later by ~15 frames.
- [ ] **Font size consistently 6-8px too small.** Body text is 44px, should be 50-52px. Affects S01, S03, S05.
- [ ] **Background saturation 2-3x too high.** Three ghost blobs on #edeef6, our version announces itself instead of breathing. Cut saturation in half, enlarge ellipses, halve drift speed.
- [ ] **CSS phones everywhere — need Phone3D.** Phone3D.tsx is built but not integrated. All scenes with phones need to import it.
- [ ] **No SFX.** Original audio added as single track. Separate SFX layer not yet extracted.

## SCENE 1 (0:00-0:08) — Kinetic Text Intro

**File:** `video/src/compositions/replicate-ordinaryfolk/Scene01.tsx`
**Phase constants:** Lines 1110-1117

Current timing vs correct timing (at 30fps):
```
Phase   Current          Reference         Fix
P1      0 (0.0s)         0 (0.0s)          OK
P2      14 (0.47s)       8 (0.27s)         Line 1111: P2_FROM = 8
P3      72 (2.4s)        90 (3.0s)         Line 1112: P3_FROM = 90
P4      103 (3.43s)      120 (4.0s)        Line 1113: P4_FROM = 120
P5      133 (4.43s)      147 (4.9s)        Line 1114: P5_FROM = 147
P6      160 (5.33s)      175 (5.83s)       Line 1115: P6_FROM = 175
P7      172 (5.73s)      195 (6.5s)        Line 1116: P7_FROM = 195
P8      207 (6.9s)       215 (7.17s)       Line 1117: P8_FROM = 215
```

### 0:00-0:02 (P1-P2)
- [x] **Line 126:** `opacity: 1` from frame 0. FIXED by current agent.
- [ ] **Line 1111:** `P2_FROM = 14` → change to `P2_FROM = 8`. "been" must appear at 0.27s.
- [ ] **Line ~181:** `been: { opacity: 0 }` — GSAP from-state. The tween to opacity:1 must complete by frame 15 (0.5s). Currently completes at frame 19.
- [ ] **Line ~140, 273, 316, 477:** `fontSize: 50` — FIXED. Verify all instances are 50 not 44.

### 0:02-0:04 (P2-P3)
- [x] **Lines 163-166:** `EXP_SCATTER_Y` and `EXP_SCATTER_X` — ascending diagonal pattern. FIXED by current agent.
- [ ] **Line ~221:** Scatter duration `1.0` — FIXED from 0.7. But reference shows 1.2s. Change `duration: 1.0` to `duration: 1.2`.
- [ ] **Line 1112:** `P3_FROM = 72` → `P3_FROM = 90`. "Bard" appears at 3.0s not 2.4s.
- [ ] **Line ~239:** "with" tween delay — add 0.15s delay: `}, "+=0.15"`.
- [ ] Purple tint: find `color` tween on experimenting letters, extend duration from 0.4s to 0.8s.
- [ ] Word spacing: find `gap` or `marginRight` in P2 container. Change from 10 to 13.

### 0:04-0:06 (P4-P6)
- [ ] **Line ~405:** `TYPE_PHASES` array — remove `"to"` entry. Should type `"Write"` only, not `"to Write"`.
- [ ] **P6 scatter (line ~185-230):** `x: EXP_SCATTER_X[i] * 2.5` — change multiplier from 2.5 to 1.5. Reduce `y` distances by 40%. Change `scale` tween end from `0.3` to `0.7`. Change `duration` from current to `2.0`. This makes scatter SLOWER and LESS destructive.
- [ ] **P7 "Solve problems" (line ~somewhere after P7_FROM):** Each letter needs explicit fontSize in the scattered state: S=96px, o=48px, l=36px, v=60px, e=44px, p=72px, r=40px, o=52px, b=80px, l=36px, e=44px, m=56px, s=64px. Currently uniform.
- [ ] Gradient pill rotation: find `rotate` or `angle` tween on the pill element. Set to static `90` (horizontal). Remove any rotation animation.
- [ ] "Write" color: find `color: "#1A1A2E"` → change to `color: "#111111"`.

### 0:06-0:08 (P7-P8)
- [ ] **Line 1117:** `P8_FROM = 207` → `P8_FROM = 196`. Start Brainstorm 11 frames earlier.
- [ ] **P7 convergence:** Find the tween where scatter positions converge to center. Change `duration` from `0.28 * fps` to `0.55 * fps` (16.5 frames). Letters should take twice as long to settle.
- [ ] **P8 word cloud:** Find the floater array. Add 4-6 more entries with positions at the EDGES of viewport (some off-screen). Double all `x` and `y` offset values. Add `filter: blur()` in 3 tiers: 2 words at 2px, 3 words at 6px, 3 words at 12px.
- [ ] **P7 letter sizes:** Scattered state should range 30-80px. Find `fontSize` in the scatter state object and set per-letter values.
- [ ] **P7 settled text:** `fontSize: 44` → `fontSize: 50`.
- [ ] **P8 converge duration:** Find `duration` on the floater convergence tween. Change from `0.85` to `1.1`.
- [ ] **P7/P8 overlap:** Change P7 `durationInFrames` to extend 10 frames past P8_FROM. Both render simultaneously for 10 frames with P7 fading out.

## SCENE 2 (0:08-0:14) — Bard Dies, Gemini Born

**File:** `video/src/compositions/replicate-ordinaryfolk/Scene02.tsx`

### Light phase (frames 0-100)
- [ ] Mixed font weights 300/400 → should be uniform 400. Find all `fontWeight: 300` and change to 400.
- [ ] Text vertical position 50% → should be ~45%. Find `top: "50%"` or `cy` and shift up.

### Page turn (frames 100-122) — P0 CRITICAL
- [ ] **Dark bg color** `#1A1A2E` (navy) → `#0D0D10` (near-black). Find the dark background div color.
- [ ] **Fold geometry overshoots** — dark leaks on both sides of top edge. Should be clean top-right triangle sweep only. Fix the clip-path polygon calculation.
- [ ] **White page color** — pure white `#FFFFFF` → off-white `#F5F5F8`. Find the page surface background.
- [ ] **Fold shadow opacity** — current is half what it should be. Double the shadow opacity value.
- [ ] **Perspective origin** — bottom-left vs reference left-center. Find `transformOrigin` and change to `"left center"`.

### "Today" gradient (frames 121-137)
- [ ] **Text too small** — 46px → 56-58px. Find `fontSize` for "Today" text.
- [ ] **Glow halo too tight/dim** — increase spread radius 2x, increase opacity 1.5x.
- [ ] **Remove center blob** — there's a luminous center glow element that doesn't exist in reference. Delete it.

### Bard disintegration (frames 148-174) — P0 CRITICAL
- [ ] **Particle direction wrong** — scatter omnidirectional → should stream UPWARD-LEFT in a tight cone (~30° arc). Change random angle range from `[0, 2*PI]` to `[PI*0.6, PI*0.9]` (upper-left quadrant).
- [ ] **Color palette wrong** — predominantly hot pink → should be 60% blue-purple. Shift particle color distribution: `["#6366f1", "#7c3aed", "#8b5cf6", "#a78bfa", "#c084fc", "#d946ef"]` (purple-heavy, not pink-heavy).
- [ ] **Particles 2-3x too large** — reduce particle size by 60%. Change `size` values from current to `current * 0.4`.
- [ ] **Structural ceiling:** No per-element directional motion blur possible in CSS. Would need canvas/WebGL for the streaked particles visible in reference frame_012.

## SCENE 3 (0:14-0:39) — Gemini Product Showcase

- [ ] "It's everything" grid (0:06 in scene = 0:20 absolute): poorly placed, needs to fill viewport
- [ ] "you know and love" at 0:22: verify icons match (Docs, Maps, Gmail, Drive, YouTube, Travel)
- [ ] Cartoon dog vs real photo (0:38): structural ceiling
- [ ] Phone bezel too thick
- [ ] Segment timing needs 30-70 frame shift (already adjusted in last pass)
- [ ] "It's everything" grid should be 5x3 not 9x5

## SCENE 4 (0:39-0:50) — Phone Chat + Introducing

- [x] 0:38-0:40 ghost phone transition — FIXED (hard cut, no crossfade)
- [x] 0:49-0:51 Introducing → Gemini transition — FIXED (5-frame overlap)
- [x] Dog photo snap transition — FIXED (hard cut)
- [x] Gemini desktop dropdown — FIXED (browser frame + sparkle icons)
- [ ] Phone 3D perspective: CSS perspective not enough → use Phone3D component
- [ ] "Introducing" text: verified as 56px grey (was 96px rainbow, fixed)
- [ ] Dark ending delay: frame 326→336 (fixed)

## SCENE 5 (0:50-1:14) — Dark Mode Gemini Showcase

### 0:50-0:55
- [ ] Gemini dropdown: verify zoom + gradient border match reference
- [ ] "Hello, Lisa." dark mode: gradient coloring accuracy

### 0:55-1:00
- [ ] "for reasoning" / "coding" kinetic text: timing and size
- [ ] "coding" 3D code card: should rotate on its OWN Y-axis (tropic flip)
- [ ] "and more" glow: verify intensity

### 1:00-1:04
- [ ] 3D cards rotate ON THEMSELVES — each card spins around own center axis, not whole scene rotating
- [ ] Gemini interface behind cards at 25-35% opacity with 3D tilt
- [ ] Card front/back faces with backfaceVisibility: hidden

### 1:04-1:08
- [ ] **CRITICAL: Timing drift 2-3 seconds late.** Segments K (cards pan) and L ("With access to") both too long. K needs 50→35 frames, L needs 40→25 frames. Pushes everything downstream.
- [ ] **CRITICAL: 3D arc text sweep DOES NOT EXIST.** Reference shows "With access to" on an elliptical arc in 3D, color-graded blue-to-pink. Our version does scattered implosion. Completely different effect.
- [ ] Cards paper-thin at 90° rotation — no edge geometry. Need side/top/bottom edge divs.
- [ ] Desktop interface is flat div — reference shows 3D monitor/laptop shape with chrome.
- [ ] **No convergence singularity.** Reference collapses everything to bright white point with volumetric purple/blue halo at 1:10. Ours just overlays bg color.

### 1:08-1:11
- [ ] **CRITICAL: "Ultra 1.0" too small** — 54px vs reference ~80px. Should dominate the orb interior.
- [ ] Orb over-decorated — specular highlights, inner purple, multiple gradients. Reference orb is nearly flat dark. Elegance through absence.
- [ ] Device duo at 1:11: phone + laptop side by side (broken). Gap too wide. Needs centering.

### 1:11-1:14
- [ ] **CRITICAL: Google G is the wrong kind.** Reference uses continuous rainbow gradient flowing around the letter. Ours uses segmented flat-color SVG (favicon). Reference G looks luminous.
- [ ] "Experience Gemini" too small (36px → ~46px) and too high (8% from top → ~35%).
- [ ] G logo fades too early — disappears at frame 694 but reference holds through 73s.
- [ ] Morph glow is monochrome purple — should be multicolor (Google brand warm/cool wash).
- [ ] **CRITICAL: Spiral is wrong.** Reference = text on a sweeping bezier ribbon. Ours = scattered chars on separate motionPaths. Fundamentally different.
- [ ] No background noise particles during G reveal.

## COMPLETED (for reference)

- [x] OF S01 SSIM: 0.983
- [x] OF S02 SSIM: 0.967 + GSAP rewrite
- [x] OF S03 SSIM: 0.928
- [x] OF S04 SSIM: 0.912
- [x] OF S05 SSIM: 0.909
- [x] Audio added (of-audio.wav)
- [x] Phone3D.tsx built
- [x] TransitionSeries → manual Sequences with S03/S04 hard cut
- [x] Scene interpretation complete (5 scenes)
