# Ordinary Folk / Bard Promo — First 8 Seconds Motion Analysis

## The Concept

This is a **typewriter-as-thought** animation. The screen represents a mind thinking out loud. Words appear, reconsider, rearrange. It's not text on a screen — it's cognition visualized.

Every transition answers: "What does it look like when an AI thinks?"

---

## Animation 1: "You've" (f0–f8)

**What it is:** A single word materializes. Not typed — it's already there, like a thought that was always forming.

**Motion:** "You've" is visible from frame 0. Between f1–f6, it drifts leftward by about 30px (from ~53% to ~50% horizontal). This is NOT a slide-in. It's a settling — like a word that arrived slightly to the right of where it belongs, and gravity pulls it to center.

**Easing:** Very gentle deceleration. power1.out or similar. Almost imperceptible.

**Position:** Vertically at exactly ~49.3% (slightly above true center). This offset is CONSISTENT across all phases — the text baseline lives at 49.3%, not 50%.

---

## Animation 2: "You've been experimenting with" (f8–f65)

**What it is:** A sentence assembles itself. But "experimenting" doesn't arrive as a word — it arrives as INDIVIDUAL LETTERS flying in from scattered positions along an ascending diagonal.

**The letter scatter mechanic:**
- Letters start LARGE (~64px) and scattered along a bottom-left → top-right diagonal
- First letters (e,x,p) are lower-left, last letters (i,n,g) are upper-right
- They're PURPLE-BLUE tinted while scattered (#6B5FD8 ish)
- As they settle into the word, they SHRINK to 50px, move to inline positions, and turn DARK
- The settle takes ~1.0 second (30 frames) — it's deliberately slow, like watching iron filings align to a magnet

**Sequence:**
- f8: "been" fades in (fast, 0.2s)
- f12-f15: "experimenting" letters begin appearing (staggered, 0.025s between each)
- f15-f45: Letters settling — this is the LONG part. The animation lingers here.
- f22-f25: "with" fades in
- f45-f65: Fully settled, static dark text

**Critical detail:** The WHOLE PHRASE shifts left as it grows. "You've" starts centered, but as "been experimenting with" assembles, the center of mass shifts, and the entire line translates left to re-center the full phrase. This is ~60px of horizontal shift over 1.2s.

**What my code gets wrong:** The timing and positions are approximately right but I need to verify the GSAP proxy is producing the exact easing curves. The settle animation should feel MAGNETIC — fast initial pull, then slow final alignment.

---

## Animation 3: "Bard" (f65–f84)

**What it is:** The brand name replaces the sentence. It's a REVEAL, not a transition — the sentence vanishes, and the name occupies the same space but at 2x the scale.

**Motion:**
- Previous text vanishes (instant, no fade — just gone between f65-f68)
- "Bard" pops in with a subtle scale bounce: starts at ~94% scale, expands to 100% over ~8 frames
- Very slight x-drift (6px → 0)

**Colors — THE KEY DETAIL:**
- f70: B=#C05080 (PINK), a=#9060B0 (PURPLE), r=#7070C0 (BLUE-PURPLE), d=#5080D8 (BLUE)
- f75: The gradient has ROTATED — B is now more purple, d is still blue
- f80: B=blue-purple, a=purple, r=purple, d=dark-purple. The whole gradient shifted.
- This is a CONTINUOUS COLOR ROTATION, not just a static gradient. Each letter's hue rotates ~60° over the 0.5s display time.

**Size:** ~105px at 1280x720 canvas. The font weight appears to be the same 400.

**What my code gets wrong:** The initial color palette is now correct (pink→blue), but the rotation speed and amplitude might not match. Need to verify.

---

## Animation 4: "to" typewriter + delete (f84–f105)

**What it is:** The AI starts typing a thought ("to Write emails") but RECONSIDERS. It types "to", pauses, then backspaces. This is the most narratively important moment — the machine showing uncertainty.

**Exact frame-by-frame:**
- f83-f84: "Bard" has faded out. Brief empty screen.
- f85: "to" appears COMPLETE (not typed character by character). It materializes.
- f86-f89: "to" holds. No cursor yet.
- f90: Cursor "|" appears next to "to". Now it reads "to|"
- f91-f94: "to|" holds. The cursor blinks.
- f95: "o" deleted → "t|"
- f96-f99: holds "t|"
- f100: "t" deleted → "|" alone
- f101-f104: Cursor blinks alone
- f105: "W" appears in purple → new phase begins

**What this means for code:** "to" is NOT a typewriter animation. It's a FLASH — the word appears instantly. Then the cursor appears. Then backspace happens. The delete IS step-by-step (one char per ~5 frames).

---

## Animation 5: Typewriter "Write" (f105–f130)

**What it is:** NOW it's a real typewriter. Each letter appears one at a time with a cursor.

**Letter timing (from reference):**
- f105: "W" — purple (#6B5BD8)
- f110: "Wr" — r is more magenta (#9050C0)
- f114: "Wri" — i is magenta (#A848A0)
- f117: "Writ" — t is coral-magenta (#C04482)
- f120: "Write" — e is coral (#D04068)

**The gradient is per-character.** Each new letter is further along a purple→coral spectrum. This creates a VISUAL ACCELERATION — the word gets warmer as it types.

**Cursor:** Solid during typing (not blinking). After "Write" is complete, the cursor holds briefly (~8 frames), then fades.

---

## Animation 6: "Write emails" pill (f130–f160)

**What it is:** The action verb gets a direct object. "Write" turns dark, and "emails" arrives inside a gradient pill/rectangle.

**Motion:**
- f130-f132: "Write" (which was gradient) turns DARK (#111). This is a color swap, not a fade.
- f133-f135: "emails" pill bounces in from the right. It starts offset (+30px x, +8px y), scaled to 82%, and springs to final position. back.out(1.7) easing — the overshoot bounce.
- f135-f145: Pill holds. The gradient is LEFT-TO-RIGHT: magenta → purple → blue (#D04878 → #A858B8 → #6878E0). White text inside. Corner radius ~4px. Nearly rectangular.
- f148-f155: Pill fades out, dark text "emails" fades in at the same position. Cross-dissolve.
- f155-f165: "Write emails" both in dark text. Static.

---

## Animation 7: Letter scatter → "Solve problems" (f160–f195)

**What it is:** TWO animations composed. First, "Write emails" disassembles. Then "Solve problems" assembles from scattered positions at DIFFERENT SIZES.

**Part A — "Write emails" scatter (f160–f172):**
- Letters drift apart from their word positions to scattered positions
- "W" drifts upper-left, gets a BLUE TINT and grows slightly larger
- "t" drops down
- "s" drifts far right, gets PINK TINT
- Other letters drift with small offsets
- Duration: ~0.4s (12 frames)
- Letters FADE OUT as they scatter (opacity goes to 0 over last 5 frames)

**Part B — "Solve problems" assemble (f172–f195):**
- Letters appear ALREADY SCATTERED at different sizes across a ~600px × 300px field
- "S" is LARGE (80px+), left-center, with BLUE-PURPLE TINT
- "b" floats ABOVE the main line (y ~200px when canvas center is 360px)
- "p" and "l" sit BELOW the main line
- Letters are at varying sizes from 30px to 86px — this creates DEPTH
- Over ~0.8s, all letters converge to a single centered baseline at uniform 50px
- The convergence uses power2.out or similar — fast at first, then settling
- Color tints fade to dark as letters settle
- By f195 it reads "Solve problems" in clean centered dark text

**This is the most technically complex animation.** Two particle systems overlapping — one dispersing, one converging.

---

## Animation 8: "Brainstorm ideas" word cloud (f195–f240)

**What it is:** A THOUGHT CLOUD — the mind exploring multiple directions simultaneously before focusing. Many copies of "Brainstorm" and "ideas" at various sizes, blurs, colors, and positions.

**The cloud composition (from f210 reference):**
- The cloud is ENORMOUS — extends well beyond the 1280×720 viewport
- "Brainstorm" crops off the left edge (bottom-left, very large, ~70px+, bold)
- "ideas" crops off the bottom-right (large, red/coral)
- Multiple mid-field copies: blue, purple, pink/coral variations
- Deep background copies are heavily blurred (12-18px blur radius)
- Foreground copies are sharp or lightly blurred (1-4px)
- Total: ~12-15 word instances

**Motion:**
- f195-f200: Cloud bursts into existence (fast fade-in, 0.1-0.15s per word, staggered)
- f200-f225: All words drift INWARD toward center. This is NOT just translation — the far copies move faster (parallax effect). The convergence has no overshoot.
- f210-f230: Clean centered "Brainstorm ideas" fades up through the dissolving cloud
- f230-f240: Last cloud remnants vanish, clean text remains

**Colors in the cloud:**
- Blues: #5F6BDA, #5F7FDA — cool, recessive
- Purples: #7B5BD0, #8B6BD8, #6B5FD8 — mid-tone
- Pinks/corals: #C04878, #C04868, #A050A0 — warm, advancing
- The color mix creates a TEMPERATURE GRADIENT — cool at edges, warm at center

---

## Global Rules

1. **Baseline position:** ALL text sits at ~49.3% vertical (slightly above true center). Never at 50%.
2. **Font:** Google Sans, weight 400, size 50px (except "Bard" at 105px and scattered letters at varying sizes)
3. **Background:** Nearly white with soft lavender-blue wash (center-left) and warm pink wash (top-right). Drifts with Perlin noise at very low frequency.
4. **Transition style:** No crossfades between phases. Each phase ENDS with text vanishing (usually instant), next phase STARTS with new text appearing. The emptiness between is the breath.
5. **No motion blur:** Everything is crisp. The motion itself is slow enough that blur would be wrong.
6. **Letter spacing:** -0.2px to -0.3px throughout. Tight but not cramped.
