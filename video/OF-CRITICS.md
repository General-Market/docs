# OF Video — Critics Backlog

All issues found by investigation agents. Organized by scene + timestamp.
Structural issues (affect multiple scenes) at the top.

## STRUCTURAL — Affects Entire Video

- [x] **Timeline offset ~0.5s too fast everywhere.** FIXED in S01 — all phases shifted ~15 frames later. S03, S05 still need audit.
- [x] **Font size consistently 6-8px too small.** FIXED in S01 — all text now 50px. S03, S05 still need audit.
- [ ] **Background saturation 2-3x too high.** Three ghost blobs on #edeef6, our version announces itself instead of breathing. Cut saturation in half, enlarge ellipses, halve drift speed.
- [ ] **CSS phones everywhere — need Phone3D.** Phone3D.tsx is built but not integrated. All scenes with phones need to import it.
- [ ] **No SFX.** Original audio added as single track. Separate SFX layer not yet extracted.

## SCENE 1 (0:00-0:08) — Kinetic Text Intro [ALL FIXED 2026-03-28]

**File:** `video/src/compositions/replicate-ordinaryfolk/Scene01.tsx`

Final timing (at 30fps):
```
Phase   Frame    Time     Status
P1      0        0.0s     FIXED — "You've" visible at opacity 1 from frame 0
P2      8        0.27s    FIXED — "been" fades in, ascending diagonal scatter
P3      72       2.4s     "Bard" gradient
P4      110      3.67s    FIXED — "Write" only (no "to" prefix)
P5      150      5.0s     FIXED — gradient pill stays horizontal
P6      185      6.17s    FIXED — gentle scatter, 1.2s duration
P7      210      7.0s     FIXED — wide scatter 36-96px, convergence at 0.55s
P8      240      8.0s     FIXED — 16 floaters, 3-tier blur, 1.1s converge
```

All S01 items resolved:
- [x] Frame 0 visible (opacity 1, no entrance animation)
- [x] "been" at 0.27s (P2_FROM=8)
- [x] Font size 50px everywhere
- [x] Ascending diagonal scatter pattern
- [x] Scatter duration 1.0s
- [x] "with" delayed to 0.72s
- [x] Word spacing gap: 13px
- [x] "to" removed from typewriter
- [x] Gentle letter scatter (power2.out, 120-200px, no scale-down)
- [x] "Solve problems" sizes 36-96px scattered, 50px settled
- [x] Gradient pill horizontal (~90deg)
- [x] "Write" color #111111
- [x] Brainstorm: 16 floaters, 2x wider, 3-tier blur
- [x] Convergence delayed to 0.55s in P7
- [x] Floater remnants linger (1.1s converge)

## SCENE 2 (0:08-0:14) — Bard Dies, Gemini Born

**File:** `video/src/compositions/replicate-ordinaryfolk/Scene02.tsx`

### Light phase (frames 0-100)
- [x] Mixed font weights 300/400 → should be uniform 400. FIXED — all fontWeight: 400.
- [x] Text vertical position 50% → should be ~45%. FIXED — all text containers top: "45%".

### Page turn (frames 100-122) — P0 CRITICAL
- [x] **Dark bg color** `#1A1A2E` (navy) → `#0D0D10` (near-black). FIXED.
- [ ] **Fold geometry overshoots** — dark leaks on both sides of top edge. Should be clean top-right triangle sweep only. Fix the clip-path polygon calculation.
- [x] **White page color** — pure white `#FFFFFF` → off-white `#F5F5F8`. FIXED.
- [x] **Fold shadow opacity** — current is half what it should be. FIXED — doubled (0.18→0.36, 0.1→0.2).
- [x] **Perspective origin** — bottom-left vs reference left-center. FIXED — transformOrigin: "left center".

### "Today" gradient (frames 121-137)
- [x] **Text too small** — 46px → 58px. FIXED.
- [x] **Glow halo too tight/dim** — FIXED — blur 14→28px (2x spread), opacity 0.5→0.75 (1.5x).
- [x] **Remove center blob** — FIXED — bg-glow element and its GSAP animation deleted.

### Bard disintegration (frames 148-174) — P0 CRITICAL
- [x] **Particle direction wrong** — FIXED — cone [PI*0.6, PI*0.9] (upward-left).
- [x] **Color palette wrong** — FIXED — blue-purple palette ["#6366f1","#7c3aed","#8b5cf6","#a78bfa","#c084fc"].
- [x] **Particles 2-3x too large** — FIXED — size * 0.4 (60% reduction).
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

## 3D MOVEMENTS — Master Audit (affects S03, S04, S05)

The reference video has 17 distinct 3D elements. Each needs:
- Correct rotation axis (X, Y, Z) and angle range
- Correct perspective depth (600-1200px)
- Visible edge geometry when rotated past 45°
- `transformStyle: preserve-3d` on parent
- `backfaceVisibility: hidden` where cards flip

### S03 3D elements:
| Timestamp | Element | Reference 3D | Our current state | Fix |
|-----------|---------|-------------|-------------------|-----|
| 0:14 | Gemini particles | 3D swirl convergence | Flat 2D scatter | Need spiral path with Z-depth |
| 0:18 | Desktop browser | Tilted 5-8° rotateX | Has perspective but angle may be wrong | Verify rotateX angle |
| 0:35-0:38 | Phone mockups x3 | Each tilted differently, staggered depths | CSS perspective only | **Use Phone3D component** |
| 0:38 | Camera viewfinder phone | ~10° Y-tilt | Simple CSS div | **Use Phone3D component** |

### S04 3D elements:
| Timestamp | Element | Reference 3D | Our current state | Fix |
|-----------|---------|-------------|-------------------|-----|
| 0:39 | Phone entrance | Arc from below-right, -18° Y-tilt | Has GSAP arc + tilt | Verify angle matches |
| 0:45 | Phone exit | -50° edge-on Y rotation | Has dramatic exit | Verify edge visibility |
| 0:50 | Desktop Gemini | Zoomed corner, slight 3D tilt | Has browser frame | Verify perspective depth |

### S05 3D elements — MOST BROKEN:
| Timestamp | Element | Reference 3D | Our current state | Fix |
|-----------|---------|-------------|-------------------|-----|
| 0:50 | Gemini dropdown | Desktop with gradient border, 3D tilt | Has zoom but may lack tilt | Add rotateX(3°) rotateY(-2°) |
| 0:53 | Suggestion cards | Each card has slight tilt | Flat cards | Add per-card `perspective(600px) rotateX(2°)` |
| 0:57 | Code card | **Rotates 360° on own Y-axis** | Has rotation but may be whole scene | Verify card rotates INDEPENDENTLY |
| 1:00 | Multiple cards | **Each card rotates on OWN axis** (tropic) | Added in last pass | Verify front/back faces, edge geometry |
| 1:04 | Text arc | **Elliptical arc in 3D space** | Wrong — we do scattered implosion | **REWRITE: text on bezier ribbon with perspective** |
| 1:07 | Orbital ring | **Words on 3D ring with rotateX tilt** | Added `rotateY(angle) translateZ(220px)` | Verify foreshortening correct |
| 1:09 | Ultra orb | **3D sphere appearance** | Flat dark orb | Add radial gradient + inner glow for depth |
| 1:11 | Device duo | **Phone + laptop in 3D space** | Broken | **REWRITE with Phone3D + laptop model** |
| 1:13 | G logo | **Depth/luminosity** | Flat segmented SVG | Need continuous rainbow gradient G |

**Phone3D component** at `video/src/lib/Phone3D.tsx` is built and ready. Scenes S03 and S04 need to import it to replace CSS phone divs.

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

## SCENE 3 — Critics Update (from investigation)

**File:** `video/src/compositions/replicate-ordinaryfolk/Scene03.tsx`

### Particles (0:14-0:17)
- [ ] Particle explosion too long (+1.17s). Compress by ~35 frames.
- [ ] Lacks coherent arc trajectory — reference shows sweeping comet-like curve, ours is random scatter.

### Desktop UI (0:18-0:20) — CRITICAL
- [ ] **Camera sweep DRAMATICALLY wrong.** Reference: 4-5x zoom pullout from browser corner. Ours: scale 1.12→1.0 (barely visible). Need scale 4.0→1.0 with perspective tilt.
- [ ] Sparkle position: above "m"/"i", not above "G"/"e".

### "It's everything" (0:20)
- [ ] Column spacing 350px → should be 200-220px. Grid too sparse.

### "you know and love" (0:22)
- [ ] Icon distribution clusters in upper-left. Should be FULL CIRCULAR ORBIT around text.
- [ ] Missing heart glyph between "and" and "love".

### "And moooore" (0:30)
- [ ] Uses colored BALLS replacing letters. Reference keeps TYPOGRAPHIC "o" letterforms tinted with continuous Gemini gradient. Wrong approach.

### Phones (0:35-0:38)
- [ ] All phones lack 3D perspective tilt on exit. Use Phone3D component.
- [ ] "Good morning" phone sits flat → should be tilted.
- [ ] Camera viewfinder uses CSS cartoon bear → needs real photo (structural ceiling).
- [ ] Avatar is gradient blob → should be photograph.

### Timing
- [ ] Not uniform offset. Particle explosion +1.17s too long. Gemini response -0.5-0.9s too short. Compounds to +1.5-2.0s late by Scene 03 end.

## SCENE 1 — Additional Findings (2-4s investigation)

- [ ] **"to" was CORRECT.** We WRONGLY removed it. Restore "to" to typewriter. Reference: "to" typed first in dark → "Write" in gradient → "to" fades. Line ~402 TYPE_PHASES needs "to" back.
- [ ] **Bard persists 0.5s too long.** P3 should end at frame ~85 (2.83s), not 102 (3.4s). Line 1112: P3_FROM=90 but P3 duration should be ~20 frames not 31.
- [ ] **Bard fade-in too slow.** 0.35s → should be 0.08-0.12s. Find Bard opacity tween duration.
- [ ] **"experimenting" should be LARGER** than surrounding words. ~45-50px while "You've/been/with" are ~30px. Currently all 50px uniform.

## SCENE 5 — Critics Update (0:50-1:04 investigation)

**File:** `video/src/compositions/replicate-ordinaryfolk/Scene05.tsx`

### Gemini dropdown (0:50-0:52)
- [ ] **Zoom too small.** Current scale ~1.6 → should start at ~2.8 (only top-left quadrant visible). The reveal IS the drama.
- [ ] Gradient border opacity 40% → should be 70-80%.

### "Hello, Lisa." (0:52)
- [ ] Gradient direction wrong: 135° diagonal with blue → should be 90° horizontal (violet to pink, NO blue).
- [ ] Position dead center → should be left-of-center.

### Gemini sparkle (0:53)
- [ ] **35px icon → should be FULL-FRAME 4-point star outline with colored strokes.** Massive size difference.

### "for reasoning" (0:55)
- [ ] Should whisper in lavender, not shout in gradient. Reduce color intensity.

### "coding" (0:57) — CRITICAL
- [ ] **Missing brackets and monospace font.** Should read `{ coding }` in a terminal/code aesthetic. The braces ARE the point.
- [ ] Monospace font needed (Source Code Pro, JetBrains Mono, or similar).

### Card rotation (0:57-1:04) — CRITICAL CORRECTION
- [ ] **Cards do NOT do 360° spins.** They ROCK gently through 30-40° arc. Change all `rotateY` ranges from `[0, 360]` to `[-20, 20]` or `[-15, 25]`.
- [ ] The motion is slow and dignified, not carnival.
- [ ] Each card turns slightly on its own axis during a cinematic pan.
