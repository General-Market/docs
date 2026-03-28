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
