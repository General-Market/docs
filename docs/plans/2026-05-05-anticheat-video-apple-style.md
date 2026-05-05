# AntiCheatFull — Apple launch-film polish pass

Six scenes. Same story. Cinematic language layered on top.

## Course corrections (logged before we start)

Two false starts:

1. **First draft applied apple.com homepage tokens** — pills, hairlines, 17px body. That is web UI furniture, not film.
2. **Second draft over-corrected** — collapsed scenes, deleted the panel split, fabricated a hero cube. The narrative is fine. We do not redraw the hook to make a point about Apple.

This is the third draft. **It changes nothing about what each scene shows.** It only changes how the frame is lit, paced, weighted, and graded. Polish, not rewrite.

## What we are doing

The current six scenes — Hook, Stat, Rigged, Solution, Reassure, EndCard — keep their compositions. The split panel stays. The numbers stay. The card grid stays. The terminal stays. The shield stays. The wordmark stays. We layer launch-film grammar on top: pure black with a four-step lift, letterbox 2.39:1, type at film weights (300–400, not 800), slow entrances, 12-frame dissolves between scenes, no vignettes, no shadows, no glows, color reserved as a knife. The hook still hooks. It just stops shouting.

## Reference materials

- Existing video: `video/src/compositions/anticheat/AntiCheatFull.tsx` and the six scene files alongside it.
- Cioran voice guide: `docs/writing-like-cioran.md` (applies to any copy edits, but no copy is changing in this pass).
- Apple launch films for color and motion reference: iPhone 17 reveal, M4 MacBook reveal, MacBook Neo intro (April 2026).
- Cinematic-tech-commercial breakdowns documenting Apple's five-light grammar (three rims first, key then fill).

## What "Apple launch film" means as a polish layer

Drawn from the films, applied to existing scenes without changing what they show.

1. **Letterbox 2.39:1** — black bars top and bottom, full-film overlay. The aspect ratio carries half the cinematic feeling on its own.
2. **Pure black stage with a 4/255 lift** — visible band at `#040608`, letterbox at pure `#000`. Avoids the muddy "amateur black."
3. **Type at film weights** — Light (300) and Regular (400). The current 700/800 reads as poster, not film.
4. **Tight tracking on display, generous on labels** — `-0.04em` on hero words, `+0.18em` on uppercase eyebrows.
5. **Slow entrances** — 36-frame ease-out (1.2s) for hero text, 24 frames for sub-text. The current 5–8 frame snaps read as web UI.
6. **Hold every hero word for ≥48 frames** before its exit begins. Apple sits on a word.
7. **12-frame dissolves between scenes**, not hard cuts. The current `<Series>` becomes `<TransitionSeries>` with `fade()`.
8. **No vignettes, no text-shadows, no box-shadows, no panel gradients, no glows.** Apple keeps the frame flat. Light comes from the light, not from CSS effects.
9. **Color reserved.** Red only for warning marks (the manipulation candle, the order-book spoof flash, a single red underline on the "70% on the table" stamp). Green only for "shielded." Otherwise everything is white-on-black at varying opacities.
10. **Subtle Rec. 709 grade** — a global filter overlay: `brightness(1.02) contrast(1.06) saturate(0.92)`, plus a 4% cool-blue screen-blend in the shadows. Almost invisible per-frame, unmistakable across the film.

## What carries from the homepage tokens

Three things only:

- Type family — Inter as the SF Pro stand-in, already in `video/src/common/fonts.ts`.
- Easings — `cubic-bezier(0.25, 0.1, 0.3, 1)` for entrances, `cubic-bezier(0.4, 0, 0.6, 1)` for everything else.
- The discipline of restraint.

Web UI furniture (pills, white panels, 12px card radius, 17px body, hairline-bordered everything) does not transfer. We are making a film.

## The phases

### Phase 0 — Tokens

**Owner file (edit):** `video/src/compositions/anticheat/theme.ts`.

Replace the contents:

```
bg          #040608   visible band — black with a tiny lift
stage       #000000   letterbox bars only
fg          #f5f5f7   primary text
dim         #86868b   secondary text
red         #ff453a   warning marks only
green       #30d158   "shielded" only
flash       #ffffff   introducing beat only
rule        rgba(245,245,247,0.10)   hairline at slightly higher opacity for visibility against #040608
```

Type ramp (px / weight / tracking):

```
hero          180 / 400 / -0.045em
display       132 / 400 / -0.04em
sub-display    96 / 400 / -0.03em
caption        72 / 300 / -0.025em
body           56 / 400 / -0.022em
label          28 / 500 / +0.18em uppercase
mono-meta      24 / 500 / +0.08em
```

Easings:

```
ease     = Easing.bezier(0.4, 0, 0.6, 1)
easeOut  = Easing.bezier(0.25, 0.1, 0.3, 1)
```

Cinematic constants:

```
LETTERBOX_PX = 130
GRADE_FILTER = "brightness(1.02) contrast(1.06) saturate(0.92)"
GRADE_TINT   = "rgba(20, 30, 60, 0.04)"  // mix-blend-mode: screen
```

Existing constants (`FPS`, `W`, `H`, `toFrames`) stay.

**Verification:** the six scene files still compile against the new theme. Their colors are wrong everywhere — Phase 1 fixes them.

### Phase 1 — Strip the noise

Mechanical pass across all six scene files. No structural change.

- Delete every `radial-gradient(... rgba(0,0,0,0.55) ...)` vignette overlay (six of them).
- Delete every `textShadow` declaration.
- Delete every `boxShadow` on cards and panels.
- Replace every red-tinted background fill (`rgba(255,59,59,0.04)` etc.) with `transparent` or flat `colors.bg`.
- Recolor every red-colored headline to `colors.fg`. Red survives only on:
  - The manipulation candle in the hook's chart.
  - The order-book spoof flash in the hook.
  - A single 1px red rule underlining the "70% on the table" stamp in `AntiCheatRigged`.
- Replace every panel `linear-gradient(180deg, #0d0d10 0%, #050507 100%)` with flat `colors.bg`.
- Reduce every display headline `font-weight: 800` to **400**. Reduce every "punch" weight (the single biggest words) to **400** as well. There are no 700s or 800s anywhere in the film. Light and Regular only.

**Verification:** the video looks empty and underdesigned. That is correct. Phase 2 puts the rhythm back. The composition itself does not change.

### Phase 2 — Motion

All six scene files.

- Replace every `spring()` with `interpolate(frame, [start, start+36], [0, 1], { easing: easeOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })` for entrances. **36 frames = 1.2s.** For exits, **24 frames** with `ease`.
- Replace every `translateY(... 14 → 0 ...)` and `translateY(... 22 → 0 ...)` with `translateY(... 32 → 0 ...)`. Apple drops are taller and slower.
- Increase every staggered sibling delay to **0.15–0.20s** between elements. The current 0.18s in `AntiCheatStat`'s chips panel is fine; the 0.05s offsets elsewhere are too quick.
- Hold every hero word for at least **48 frames (1.6s)** before its exit begins. Audit each scene against this — most already hold, a few cut early.
- In `AntiCheatFull.tsx`, replace `<Series>` with `<TransitionSeries>` from `@remotion/transitions`. Insert `<TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />` between every consecutive scene. **One exception:** between `AntiCheatRigged` and `AntiCheatSolution`, use a **white flash** transition (3-frame fade up to `#ffffff`, hold 6 frames, 9-frame fade out to the black of Solution). This is the one introducing beat in the film.
- Total runtime grows by `5 × 12 + 18 = 78` frames → from 1230 to **1308**. Update `TOTAL_FRAMES` accordingly.

### Phase 3 — Per-scene visual polish

**No scene loses anything.** No scene gains anything. Each scene's composition stays as it is. We only adjust visuals to land the film register.

#### 3a — Hook (10s)

Keep the split. Keep both panel labels (`When you play` / `When you trade`). Keep the slot numbers. Keep the pair list. Keep the trading screen with its chart, order book, and ticker. Keep the reveal lines.

Adjustments:
- Both panel labels' headline weight: 800 → 400. Slot numbers stay at 500.
- The "When you trade" headline color: red → fg. The slot number color stays dim.
- Remove the strip-darken vignettes (top + bottom black gradients on each panel) — let the broll breathe.
- The reveal lines: both lines fg, weight 400. The second line ("are trading against you") drops the red color but earns its weight from a 1px hairline drawing under it over 14 frames after it lands.
- The center 1px border between panels stays at `colors.rule`.
- The order-book spoof flash still flashes red. The manipulation candle still drops red. These are warning marks — they stay.

#### 3b — Stat (7.5s)

Keep the eyebrow, the two big numbers, the arrow flow, the sub-line, the chips panel, the closing pull-quote.

Adjustments:
- Drop the candle-silhouette + grid backdrop. Pure `colors.bg`.
- Both big numbers: weight 800 → 400. Right number color: red → fg. The right number is no longer red. Apple does not need red to show that something is bad; the meaning is in the words.
- Arrow flow: drop the dim → red gradient. Make it a single 2px white line drawing across with a chevron snap at the end. White, not red.
- Sub-line: weight stays at 500 (it is already light). No textShadow.
- Add a 1px hairline rule across the canvas at 70% height, drawing from center outward over 12 frames as the sub-line lands.
- Chips panel: keep the four chips (Perps · Options · Predictions · Launchpads). Drop the red border, the red shadow, the red-tinted background. Each chip becomes flat: 1px hairline border at `colors.rule`, transparent background, fg text. Weight stays at 500.
- Closing pull-quote: `Leaving you with nearly none.` — `nearly none` color changes from red to fg, weight 400, with a 1px white underline drawing as it lands.

#### 3c — Rigged (6s)

Keep the eyebrow + headline. Keep the three image+caption cards in their side-by-side layout. Keep the final stamp.

Adjustments:
- Headline weight 800 → 400.
- Each card: drop the red border, drop the red-tinted background, drop the boxShadow. Replace with a 1px hairline border at `colors.rule` and `colors.bg` background. The image stays full-bleed inside its frame. The bottom border on the image stays as a hairline.
- Card label weight 700 → 400. Sub-label stays as mono dim.
- Final stamp: drop the red color on the text. Center text becomes fg, weight 400, 132px (down from 124/800). A 1px **red** rule (`colors.red`) draws under the text from center outward over 14 frames. The red survives — but as a single mark, not as paint.
- The stamp's scrim: keep `rgba(10,10,10,0.78)` and `backdropFilter: 'blur(2px)'`. The blur reads as cinematic, not as web glass.

#### 3d — Solution (6.5s)

Keep the headline `General changes this.` Keep the terminal panel and its three lines. Keep the cursor blink. Keep the macOS chrome dots.

Adjustments:
- Headline weight 800 → 400. The word `changes` color stays green. The trailing period stays dim.
- The sub-label `Securing your profits from unfair actors` stays as is (it is already mono dim, +0.18em).
- Terminal panel: drop the gradient body. Flat `colors.bg`. 1px hairline border at `colors.rule`. Drop the boxShadow.
- Terminal-text font size 50px stays. The `✓ shielded` line keeps green at weight 500 (down from 700).
- The Phase 2 white-flash transition lands between Rigged and this scene — that is the introducing beat of the film. The headline arrives on the other side of the white.

#### 3e — Reassure (6s)

Keep both lines. Keep the lift on the first line. Keep the shield glyph. Keep the closing tagline.

Adjustments:
- First line weight 800 → 400.
- Second line weight 700 → 400. The word `shielded` keeps green.
- Drop the textShadow on both lines.
- The shield glyph stays — but tone it down further. Current opacity caps at 0.06. Drop to 0.04. The shield is a faint backlight, not a logo.
- A 1px hairline rule draws from center outward beneath the second line over 14 frames as the tagline appears. The tagline stays mono dim, +0.18em, no other change.
- Drop the radial-gradient vignette.

#### 3f — End card (5s)

Keep the eyebrow, wordmark, underline rule, subline, tertiary. Keep the three-beat reveal cadence.

Adjustments:
- Wordmark weight 800 → 400. Size 220 → 180. Tracking -0.05em → -0.045em. Drop the textShadow. **Drop the punch-scale animation** — Apple wordmarks arrive still. The wordmark fades up in place at the same time as the eyebrow.
- Subline weight 600 → 400. Letter-spacing stays.
- Tertiary stays mono dim. Add a second tertiary line below: `general.market/anti-cheat` — fg, mono-meta, 32px, no underline, fades up last.
- Hold the final composition for **120 frames (4s)** before the natural cut. Currently it holds for ~60 frames after all reveals are done; extend to 120. Apple end-cards sit. The grid backdrop (already faint) keeps its quiet pulse — that is the only motion in the held frame.
- Drop the radial-gradient vignette.

### Phase 4 — Letterbox and grade (final pass)

**Owner file (edit):** `video/src/compositions/anticheat/AntiCheatFull.tsx`.

Wrap the existing `<TransitionSeries>` in two new top-level overlays:

1. **Grade overlay.** A single `<AbsoluteFill>` at the top of the tree, applying CSS `filter: brightness(1.02) contrast(1.06) saturate(0.92)` and a child `<AbsoluteFill>` with `mixBlendMode: 'screen'` and `background: rgba(20, 30, 60, 0.04)`. This is the cool-shadow lift. Subtle.
2. **Letterbox overlay.** Two `<AbsoluteFill>` divs, one anchored top, one bottom, height `LETTERBOX_PX` each, background `#000`. Sit above everything else including the grade. The visible band is `1920 × 820`.

The letterbox is part of the frame for the entire film, not per-scene.

### Phase 5 — Voiceover and music slots

**Out of scope for implementation in this pass.** Slot specification only, so the next plan can fill them.

Voiceover register: soft, slow, declarative. One speaker. Reference tone: any of John Ternus, Tor Myhren, or a Cioran-flavored female read.

- **Hook (10s):** *(silence — let the broll and reveal lines speak)*
- **Stat (7.5s):** "Zero point zero one percent of traders. Seventy percent of the profits."
- **Rigged (6s):** "If you don't have a tip from a politician, a hundred million in latency, and a private feed of every order — you are not in the same game."
- **Solution (6.5s):** *(silence under the white flash — VO returns at the terminal)* "General changes this."
- **Reassure (6s):** "Same markets. Same speed. Cheaters removed."
- **End card (5s):** "Anti-Cheat trading. From General. General dot market slash anti-cheat."

Music: a single track that builds from low pad through the stat, releases at the white flash, sustains a pad through the end card, decays to silence in the final hold. Sourced via `scripts/fetch_sfx.py` (Freesound) or `scripts/generate_music.py` (AI generation). Cuts land on the music's downbeats — but with only 12-frame dissolves between scenes there is nothing sharp to cut to; the music carries through the dissolves rather than punctuating them.

A separate plan implements voiceover and music after Phases 0–4 land visually.

### Phase 6 — Verification

After Phase 4 lands, the main session does:

1. `cd video && npx remotion preview --port 3333` — open `http://localhost:3333/AntiCheatFull` and play through. The film should feel slow. If anything still snaps, find the spring you missed.
2. Render single still PNGs at the midpoint of each scene: `npx remotion still src/index.ts AntiCheatFull out/scene-N.png --frame=<F>`. View at 100% on a 1920×1080 reference. Letter spacing and grade should hold up at full resolution.
3. Side by side with the homepage at `http://localhost:3000` — type family and easings match. Surface treatments differ deliberately (the homepage is web UI, the video is cinema).
4. Final render only after explicit sign-off: `npx remotion render src/index.ts AntiCheatFull out/anti-cheat-launch.mp4`.

## Voice — non-negotiable

No copy changes in this pass. The existing on-screen text already passes the Cioran test. If a string is edited during the polish, it follows `~/.claude/CLAUDE.md` voice rules.

## Verification gates per phase

Each phase, before declaring done:
- `cd video && npx tsc --noEmit` — zero errors.
- The Remotion preview at `http://localhost:3333/AntiCheatFull` renders without console errors.
- Commit on `main` with a descriptive message, then `git push mono main`.

## Out of scope for this pass

- Voiceover recording and music sourcing (Phase 5 above is a slot specification only).
- Changing what any scene shows. The compositions stay. The hook still splits. The stat still tickers up. The rigged still cards out. The solution still types in the terminal. The reassure still has the shield. The end card still wordmarks.
- A vertical 9:16 cut for shorts. The 16:9 ships first; the vertical adapts after.
- Any 3D scene work. We do not invent a hero object. The film already has its hero — it's the story.
- Real SF Pro Display licensing. Inter remains the substitute.

## Blockers

None known.

## Open questions for the user before we start

1. The white-flash transition between Rigged and Solution — accept it as the one cinematic spike in the film, or keep that boundary as a 12-frame fade like the others?
2. Letterbox 2.39:1 throughout — accept, or scope it to specific scenes (e.g. only the hook cold open)?
3. Final render at 1920×1080 with letterbox baked in (the visible band is 1920×820), or render at native 1920×820 and ship without bars for platforms that letterbox automatically?
