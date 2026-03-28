# OF Visual Critics — From User Screenshots

Each item has a screenshot reference and exact description of what's wrong vs what the reference shows.

## S01 — Solve Problems (Image 4)
**Letters move on X OR Y only, never both simultaneously.**
Reference: "S" at top-left, "o v e" spread across middle, "r o e s" at right, "l p l" at bottom, "b" floating above, "m" below-right.
Each letter is at a UNIQUE (x,y) position — not aligned to any axis.
**Fix:** Per-letter positions need both X and Y offsets. No letter should share an X or Y coordinate with another.

## S01 — Brainstorm Ideas (Image 5)
**Words come from DEPTH — blurred copies at different Z-layers.**
Reference: "Brainstorm" top-left (large, purple, slightly blurred), "ideas" top-right (medium, faded), another "ideas" bottom-left (sharp, blue), another "Brainstorm" bottom-right (pink, large).
Multiple copies at varying sizes, colors, blur levels creating DEPTH.
Center has dark blur blob (convergence point).
**Fix:** 8-12 copies of "Brainstorm" and "ideas" at random positions, random sizes (30-70px), random colors (purple/blue/pink/faded), random blur (0-15px). They converge to center.

## S01→S02 — Transition through "O"
**Transition to "and now" goes through passing into the O of brainstorm.**
The camera zooms INTO the "O" of "Brainstorm" which becomes a portal to the next scene.
**Fix:** Scale up massively on the "O" letter, clip content to the O shape, reveal next scene inside.

## S02 — Particles (Image 6)
**Particles are an AVALANCHE — hundreds of motion-blurred bokeh spheres.**
Reference: MASSIVE particle field, blue/pink/white bokeh spheres with heavy motion blur, streaming from right to left. Dense like a snowstorm. Orange/warm glow in center.
Current: a few dozen discrete particles.
**Fix:** 200+ particles, each a blurred circle (8-30px), heavy directional motion blur, streaming trajectory. Use canvas or WebGL for this density.

## S03 — Hello Lisa Desktop (Image 7)
**First "Hello Lisa" screen comes in 3D from ~30° angle, zoomed in, dezooms smoothly.**
Reference: Browser window seen from upper-right angle (~30° rotateY, ~15° rotateX), zoomed to show only "Hello, Lisa." and bottom of a suggestion card. Gradient rainbow border visible on left edge.
**Fix:** Start at `perspective(800px) rotateY(-25deg) rotateX(10deg) scale(2.5)`, animate to `rotateY(0) rotateX(0) scale(1)` over 1.5s.

## S03 — It's Everything (Image 8)
**Text is ZOOMED — center word is huge, surrounding copies are cropped by viewport edges.**
Reference: "It's everything" center ~60px bold, surrounding copies at same size but EXTEND PAST the viewport edges. Some words partially visible (cropped). Gradient colors on some copies (purple, pink).
**Fix:** Scale up the grid so outer words overflow the viewport. Use `overflow: visible` on parent. Text size 50-60px. Some copies have gradient tint.

## S03 — You Know and Love (Image 9)
**Logos are ORBITING/ROTATING around the text in a circle.**
Reference: Drive (top-left), Sheets (top-center), Docs (top-right), YouTube (left), Maps (right), Gmail (bottom-right), Travel plane (bottom). Heart emoji between "and" and "love".
Icons are on a circular orbit, slowly rotating around the center text.
**Fix:** Place icons on a circle (radius ~180px). Animate the circle rotation slowly (full revolution over ~3s). Add heart ♥ between "and" and "love".

## S03 — Summarize Search Box (Image 10)
**Box starts from MIDDLE of screen and SLIDES as text is typed.**
Reference: Rounded search input box, starts centered, slides LEFT as "Summarize my recent|" is typed. Cursor visible.
**Fix:** The input container should translate leftward proportional to text length. Start centered, end left-aligned.

## S03 — Gemini Response (Image 11)
**Response screen is TILTED in 3D, we are ZOOMED in.**
Reference: Gemini interface at ~10° rotateY, showing "Gemini" header, "+" button, user message with avatar, "Google Workspace" chip, response text. Zoomed to ~1.5x showing only upper portion.
**Fix:** Add `perspective(800px) rotateY(-8deg) scale(1.4)` to the response container. Show "Drafts" button, speaker icon at top-right.

## S03 — Response Text (Image 12)
**All text on page appears from LEFT TO RIGHT reveal.**
Reference: Full response text with paragraphs about Harper Elementary School newsletter, Crazy Hat Day, Fall Festival, after-school program, book fair. Second email about parent volunteers.
Text appears with a left-to-right wipe reveal (not fade-in, not type).
**Fix:** Use `clip-path: inset(0 ${100-progress}% 0 0)` to reveal text from left to right.

## S03 — Starting With (Image 13)
**"Starting with the new Gemini app" — text is TURNING/ROTATING with light rays.**
Reference: Words at different angles — "Starting" rotated ~-5°, "with" at ~+8°, "the" flat, "new" rotated ~-10° with red/pink tint, "Gemini" at ~+3°, "app" flat.
Each word has slight rotation. Some have colored tint. Light ray streaks visible.
**Fix:** Per-word rotation values. Add 2-3 semi-transparent streak lines behind text.

## S03 — Phone Bottom Zoom (Image 14)
**Camera zooms into BOTTOM of phone showing home screen with app icons.**
Reference: Zoomed into bottom portion of phone showing: Phone, Messages, Gemini sparkle, Camera icons in dock. Google search bar below. Moon wallpaper visible above.
**Fix:** Build phone home screen with dock icons (Phone, Messages, Gemini, Camera), Google search bar, wallpaper background.

## S03 — Phone Slide Up (Image 15)
**Phone slides UP to show "Hi I'm Gemini" screen.**
Reference: Phone slides upward, screen now shows "Hi I'm Gemini, an experimental AI assistant on your phone." with "Gemini" in gradient color.
**Fix:** Vertical slide transition from home screen to Gemini intro screen.

## S03 — Phone 180° Flip (Image 16)
**Phone does a 180° Y-axis rotation onto ANOTHER screen content.**
Reference: Phone seen at extreme angle (~70° rotateY), showing the Gemini intro text wrapping around the 3D phone shape.
**Fix:** `rotateY(180deg)` animation with `backfaceVisibility: hidden` showing different content on back.

## S03 — Phone Tilted 25° (Image 17)
**Phone is tilted ~25° toward viewer to reveal title above it.**
Reference: Phone tilted with "Designed to supercharge your ideas" text visible above. Phone shows Gemini intro text.
**Fix:** `rotateX(-25deg)` on the phone to tilt it toward the viewer. Title text positioned above.

## S03 — Supercharge Effect (Image 18)
**"supercharge" word has RAPID COLOR CYCLING like electricity.**
Reference: "supercharge" in the middle of the sentence has a gradient that cycles rapidly through purple/pink/blue — like electrical energy flowing through the letters.
**Fix:** Animated gradient on "supercharge" with fast cycling: `backgroundPosition` shifts rapidly (every 2-3 frames).

## S03 — Phone Slide In 3D (Image 19, 0:37)
**Screen slides in still TILTED in 3D, always moving with 3D tilt.**
Reference: Phone showing "Good morning" screen, tilted ~15° rotateY, slight rotateX. Suggestion cards visible (YouTube video about grape juice, walking from Times Square). Chats section below.
The phone floats in 3D space, always slightly tilted, drifting with subtle motion.
**Fix:** Use Phone3D component with continuous slight tilt animation (noise-driven Y and X rotation oscillation).

## S04 — White to Dark Transition (Image 20, 0:51)
**Transition uses a DYNAMIC FLOATING DEEP ZOOM.**
Not a simple crossfade. The white scene zooms in rapidly while the dark scene emerges from the center/depth.
**Fix:** White scene scales up to 3x while fading. Dark scene starts at 0.5x scale, grows to 1x. Creates a "diving into the screen" effect.

## S05 — Gemini Advanced Title (Images 21-22)
**"Gemini Advanced" starts as a TITLE SCREEN (zoomed in, angled) then slides to normal view.**
Reference Image 21: "Gemini Advanced" in large gradient text, seen from extreme angle with rainbow gradient border glowing.
Reference Image 22: Normal desktop view with "Hello, Lisa.", suggestion cards, dark theme.
**Fix:** Start at `scale(2.5) rotateY(-20deg)`, showing only the title. Animate to `scale(1) rotateY(0)` revealing the full interface.

## S05 — Final Device Duo (Image 23)
**Both devices at 45° OPPOSITE angles toward the viewer.**
Reference: Phone (left, showing "Good morning" screen) tilted ~30° rotateY toward viewer. Desktop/laptop (right, showing "Gemini Advanced" dark interface) tilted ~-30° rotateY toward viewer. "Experience Gemini" and "gemini.google.com" above. Both devices have proper 3D depth.
**Fix:** Phone at `rotateY(30deg)`, laptop at `rotateY(-30deg)`. Both with `perspective(800px)`. Add "gemini.google.com" subtitle below "Experience Gemini".

## S05 — Device Duo Acceleration (Images 24-25, 1:10)
**Devices accelerate/slide to the LEFT before final position.**
The phone and desktop don't just appear — they slide in from right, accelerating to the left, then settle into their 45° opposite positions. The motion has momentum.
**Fix:** Entrance animation: both devices start off-screen right, slide LEFT with `ease_out_expo`, overshoot slightly, settle.

## S05 — Google G Logo Finale (Image 26, 1:11)
**G logo is a PROJECTED COLORED LIGHT with particles.**
Reference: The G is NOT a flat SVG. It's a luminous light source — rainbow colored (red→yellow→green→blue around the G shape), PROJECTING colored light onto the dark background. Green/warm light radiates outward from the G. Tiny particles/dust float in the light beam. The background has a warm-green light wash emanating from the G.
**Fix:** 
1. G itself: radial glow behind it, rainbow gradient that ROTATES
2. Light projection: large radial gradient (300px+) in warm green/gold behind the G
3. Particles: 30+ tiny dots (1-3px) floating slowly in the upper area
4. Background wash: warm golden-green tint radiating from G position
5. The G should feel like a lamp projecting light in a dark room

## S03 — "And moooooore" Needs MORE O's
**Current: 18 max balls. Reference shows 30+ o's stretching across the full width.**
The "And m" stays left, "re" stays right, and between them should be a LONG chain of o's (colored circles/letters) that fills the entire horizontal span. The chain should undulate like a sine wave. Each o has a Gemini brand color.
**Fix:** Increase MAX_BALLS from 18 to 35-40. The chain should extend edge-to-edge, some o's going off-screen. Add sine wave vertical displacement. CameraMotionBlur on the stretch phase.

## STRUCTURAL — Apply 3D stack to ALL screens

Every phone and desktop/laptop mockup in the entire video should use:
1. **Phone3D.tsx** (`video/src/lib/Phone3D.tsx`) — Three.js ExtrudeGeometry phone with metallic frame, glass front, ContactShadows
2. **tilt3d.ts** (`video/src/lib/tilt3d.ts`) — `useFloat3D()` for continuous organic 3D drift (sine + noise)
3. **Presets:** `TILT_PRESETS.phoneFloat` for phones, `TILT_PRESETS.desktopTilt` for browsers/laptops

Scenes that need this applied:
- S03: SegPhoneMockup, SegPhoneGoodMorning, SegDesktopUI
- S04: Phone chat entrance/exit, Gemini desktop browser
- S05: All interface views, device duo finale

No screen should be a flat CSS div with `perspective()` anymore. All should use either Phone3D (for phones) or tilt3d presets (for browser/desktop views).

## LATEST USER FEEDBACK (priority)

### Phone model at 0:35 (Image 28) — CRITICAL
- Phone has visible side artifacts — NOT proper 3D. It shows something weird on the edges.
- Phone back face has WRONG/REVERSED text — backfaceVisibility not working correctly.
- Phone is NOT FLOATING — should drift continuously with tilt3d `phoneFloat` preset.
- The reference phone at 0:35 is a REAL 3D phone with metallic frame, proper depth, smooth tilt.
- **Must use Phone3D.tsx component** — no more CSS phone divs.

### ALL phones and screens need:
- 3D tilts WITH zoom (scale 1.2-1.5x on important moments)
- X and Y continuous floating motion (use `tilt3d.ts TILT_PRESETS.phoneFloat`)
- ALWAYS floating — never static/flat
- Current implementation is not enough floating

### Big zoom at 0:47 FREEZES
- The zoom transition at 0:47 freezes and we don't see the tilted next screen at full size.
- Should be a SMOOTH continuous zoom that reveals the dark mode screen already tilted.

### Cards at 0:56 — almost there
- Cards look good but need to be more PREMIUM. Add:
  - Subtle inner shadow
  - Slightly glossy surface (background gradient)
  - Thinner, more refined border
  - Very subtle glow on hover/active card

### First 8 seconds — still needs much more work
- User says "some are better but we need to go much further"
- Recheck ALL items from previous critics
- The timing shifts and scatter fixes need more refinement

## LATEST CORRECTIONS

### Device duo angle is REVERSED
Phone and laptop backs face EACH OTHER (backs together, screens face outward toward viewer).
- Phone: `rotateY(-30deg)` (screen faces LEFT toward viewer)
- Laptop: `rotateY(30deg)` (screen faces RIGHT toward viewer)
- Their BACKS are in the center, SCREENS face outward
- Transition: devices slide in SMOOTHLY from right to left, not instant appear

### Phone case — get a REAL 3D model from internet
Don't use ExtrudeGeometry. Download a proper iPhone GLTF/GLB model:
- Search for free iPhone 15 Pro GLTF model
- Download to video/public/models/
- Load with useGLTF from @react-three/drei
- This will look 10x better than generated geometry

### Gemini Advanced title zoom — needs MORE zoom on TITLE
The initial zoom at the start of S05 should be:
- MUCH more zoomed (scale 3.5-4.0, not 2.5)
- Centered on the "Gemini Advanced" TEXT specifically (not the whole interface)
- The title should dominate the frame — we should barely see anything else
- Then pull back slowly to reveal the full interface

## LATEST S01 CORRECTIONS (priority)

### 0:07 — Brainstorm "asteroid field" depth approach
We are MOVING TOWARD "Brainstorm ideas" which is in the Z-axis BEHIND other floating text copies.
Like flying through an asteroid field of words — blurred text flies PAST the camera, "Brainstorm ideas" gets closer and sharper. The camera is ADVANCING through depth, not converging text to center.
**Fix:** Instead of text converging, implement a Z-axis camera fly-through. Text at various Z-depths, camera moves forward (scale increases on everything). Near words blur and fly past edges, far words get sharper as we approach.

### 0:06 — Solve letters ASYNC snake movement
Each letter has its OWN independent animation: swoosh on X → pause → swoosh on Y → pause → swoosh on X.
Like a snake game — each letter moves in SEGMENTS (horizontal then vertical, never diagonal).
Letters move at DIFFERENT TIMES (async/staggered), not all at once.
**Fix:** Per-letter timeline: frame N move X 100px (0.2s), pause 0.1s, move Y -80px (0.2s), pause 0.1s, move X -50px (0.15s). Each letter starts 3-5 frames after the previous. Movement is AXIS-LOCKED (X or Y only per segment, alternating).

### 0:04 — Write/emails typewriter BROKEN
The typewriter deletes a word that was written, showing a "bad version" being corrected. This is WRONG.
Reference: types "to" (dark) → types "Write" (gradient) → "to" fades out. Clean progression, no deletion.
**Fix:** Check TYPE_PHASES — ensure no backspace/deletion step. Text only ADDS characters, never removes.

### 0:01 — "experimenting" letter wave MUCH STRONGER
The wave tracking on each letter of "experimenting" must be much more dramatic.
Letters should have LARGE displacement (30-50px Y offset in a sine wave pattern).
The wave should be VISIBLE and dramatic, not subtle.
**Fix:** Increase scatter Y amplitudes from current values to 30-50px. The wave pattern should be obvious — like text on a roller coaster track.

### 0:24 — Gemini response interface MORE tilted + top-left + float
The interface at 0:24 (Gemini response with "Summarize my recent emails") should be:
- MUCH more horizontally tilted (rotateY -15 to -20deg, not just -8deg)
- Camera positioned at TOP-LEFT corner (not centered)
- ALWAYS floating with continuous wave animation (use tilt3d phoneFloat or desktopTilt preset)
- Never static during the sequence — constant gentle 3D drift
**Fix:** Increase rotateY to -18deg. Add translateX(-15%) translateY(-10%) to shift view to top-left. Wrap in useFloat3D with desktopTilt preset for continuous wave motion throughout.
