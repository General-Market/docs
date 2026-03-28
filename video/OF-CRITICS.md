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

### 0:00-0:02
- [x] Frame 0 is BLANK — "You've" should be visible immediately. GSAP starts from opacity:0. Fix: set initial opacity to 1.
- [ ] "been" missing at 0.5s — Phase 2 starts too late (frame 15). Should start at frame 8.
- [ ] Timeline compressed: at 2.0s reference still shows "You've been experimenting with", ours is already at "Bard".
- [ ] Font size 44px → should be 50-52px.

### 0:02-0:04
- [ ] "experimenting" letter scatter pattern wrong — should be ascending diagonal (lower-left → upper-right), currently zigzag.
- [ ] Scatter duration 0.55s → should be 1.0-1.2s. Letters still displaced at 1.0s in reference.
- [ ] "with" appears 0.2s too early.
- [ ] Purple tint fades too quickly.
- [ ] Word spacing 10px → should be ~13px.

### 0:04-0:06
- [ ] "to Write" wrong — reference shows only "Write" at 4.0s. Remove "to" prefix.
- [ ] Letter scatter (P6) too aggressive — expo.out + 280-520px + scale-to-0.3 obliterates letters in 5-7 frames. Reference keeps them visible as a featured moment.
- [ ] "Solve problems" letters invisible — should be at unique sizes (36-96px), scattered legibly at full opacity.
- [ ] Gradient pill on "emails" rotates 90→220deg. Should stay horizontal.
- [ ] "Write" color navy (#1A1A2E) → should be closer to pure black.

### 0:06-0:08
- [ ] Brainstorm word cloud appears too late (P8_FROM=207 → should be ~196).
- [ ] Solve scatter converges too early (0.28s → should be 0.55s).
- [ ] Word cloud too small/sparse/shallow — needs 2x wider offsets, 4-6 more entries, 3-tier blur (sharp/medium/heavy).
- [ ] Scatter size variation flattened (38-55px → reference 30-80px).
- [ ] "Solve problems" settled text 44px → should be 50px.
- [ ] Brainstorm floater ghosts vanish too fast (0.85s → should be ~1.1s converge duration).
- [ ] P7→P8 dead zone — needs overlap, not gap.

## SCENE 2 (0:08-0:14) — Bard Dies, Gemini Born

- [ ] Page turn corner-peel: verify it matches bottom-right → top-left diagonal
- [ ] Bard disintegration: particles should break from letterforms, not scatter randomly
- [ ] Particle density at peak (frame 170) too low vs reference
- [ ] Timeline offset: check if 0.5s compression affects Scene 2 too

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
