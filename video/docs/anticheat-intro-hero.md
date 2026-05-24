# AntiCheatEdit — the intro hero beat

One breath in the talk, at **10.0–15.6s** of `final.mp4`, carries two figures the
viewer should *see*, not just hear:

> "…I've been trading **one billion of volume** on **perps, option, prediction
> markets, and meme coins**…"

The number stands behind the speaker. The four products orbit around him. Nothing
is re-recorded; the picture is built onto words that are already spoken.

## Word anchors (final.mp4 seconds, 30 fps)

Measured with parakeet word-level timestamps on `final.mp4` directly.

| word            | start | frame |
|-----------------|------:|------:|
| one             | 10.80 | 324   |
| **billion**     | 11.04 | 331   |
| volume (end)    | 11.92 | 358   |
| **perps**       | 12.16 | 365   |
| **option(s)**   | 12.72 | 382   |
| **prediction(s)**| 13.20| 396   |
| markets         | 13.60 | 408   |
| **meme** coins  | 14.08 | 422   |
| coins (end)     | 14.72 | 442   |
| "and I built"   | 15.04 | 451   |

The window 10.0–15.6s is clear of both panels (opener ends 6.5s, first title at
27.5s) and captions (first caption 23.2s). The head is centered/full-frame with
the idle-breath transform.

## How "behind / around" is built

The behind-subject sandwich, gated to this window only — the same method that
produced `cutout-test.mov` + `light_shafts.mp4`, used here for the first time in
the edit. Layer order inside one `IntroHero` overlay mounted ABOVE `AntiCheatLayout`:

1. **Back layer** — the `$1B` glyph + the carousel's far-side cards.
2. **Person cutout** — a transparent **PNG sequence** (`cutout-frames/f_%04d.png`,
   `human_seg` matte, final 10–17s) rendered via `<Img>`, full-frame,
   `objectFit:cover`, carrying the *identical* idle-breath transform as the base
   head (else it ghosts). Re-reveals the speaker in front of layer 1. (Not the
   ProRes `.mov` — Chrome can't decode ProRes, so Studio preview throws; this
   ffmpeg can't encode alpha WebM either. `birefnet` hangs on MPS — use `human_seg`.)
3. **Front layer** — the carousel's near-side cards.

The number is a colossal, translucent Base-blue **`$1B`** (~1300px) that bleeds
off the frame — the room reads through the letters and the speaker stands small
in front, the "1" behind his head. Reference: a giant frosted title; on this
cream wall a see-through blue tint carries it where frosted white would vanish.
No thumb, no sub-text — clean. The wide orbit (`radius 560`, `ringZ 0`) is what
makes cards visibly clip behind his silhouette as they rotate to the back; the
named card faces the camera dead-centre on its word.

A clean silhouette is what lets a number stand behind a person.

### Carousel split

The ring is lifted from `anticheat/AntiCheatStat.tsx` (`CategoryCarousel`) into
`overlays/IntroCarousel.tsx`, beat-lock stripped, rotation driven off the four word
times so a card faces front on each product word. Cells are split by the sign of
`cos(cellRotateY + ringRotY)`: `>0` → near side (front layer), `<=0` → far side
(back layer). A cell crosses the boundary edge-on (≈invisible), so the handoff is
seamless. For a true orbit the settled ring center sits near the person's depth
plane (not the source's Z≈−600, which reads as "behind"), so near cards swell
toward camera and far cards recede behind the head.

The 4th source card `launchpads` is relabeled **meme coins** (the spoken word). The
"% extracted by unfair trading" caption is dropped — it belonged to the other film;
here the card is just the product name under an eyebrow.

## Sound

Local `public/sfx` is the Epidemic-sourced library; exact matches already on disk.
Scoped inside `IntroHero` as `<Audio>` one-shots (not the unmounted global
`StingerTrack`, to avoid double-play):

- **riser** into the number — `riser-cinematic-build.mp3` (~10.3s)
- **billion slam** — `drop-sub-impact.mp3` + `hit-deep-sub.mp3` + `money-jackpot.mp3` (11.0s)
- **carousel spiral** — `whoosh-spin-fast.mp3` (~11.7s)
- **per-card snap** — `text-snap-in.mp3` on perps / options / predictions / meme coins
- **explode** — `transition-swoosh.mp3` (~14.6s)

(`pop-number-reveal.mp3` in the library is a 0-byte stub — avoid it.)

A live Epidemic API pull is available on request — it needs a partner-API client
(the only fetch script here is Freesound), and the library already covers the beat.

## Files

- `public/anticheat-edit/cutout-intro.mov` — new asset (matte render)
- `overlays/IntroCarousel.tsx` — new (lifted + adapted ring)
- `overlays/IntroHero.tsx` — new (the sandwich orchestrator)
- `AntiCheatEditComposition.tsx` — mount `IntroHero` above the layout
- `AntiCheatLayout.tsx` — export `idleCamera` so the cutout matches the breath

## Open / tunable

- `$1B` glyph size / translucency (`fontSize 1300`, `rgba(0,82,255,0.5)`) in `BillionPlate`.
- Ring `radius` / `ringZ` / `scale` / `tiltX` in `INTRO_CAROUSEL_DEFAULT`, and
  `RING_CX/RING_CY` in `IntroHero` — the orbit's reach and where it sits on him.
- Per-card font sizing in `CardSurface` (long words like "predictions" auto-shrink).
