# Music sync method — placing motion on the melody (Remotion)

Battle-tested on **CRX-Anoma** (2026-07-12). Read this BEFORE syncing any Remotion
composition to a music track. Companion to `remotion.md` (§Motion & scene grammar)
and the CRX-Anoma-specific worked example `docs/crx-anoma-beat-sync.md`. That doc is
the example; THIS is the reusable method. Tool: `scripts/melody-onsets.py`.

## The core lesson

**The beat grid is not the melody.** A word placed on the snare/BPM grid — technically
"on beat" — can still land in a dead spot the ear rejects. Sync to the ACTUAL AUDIBLE
HITS, the notes you tap to, not to a derived BPM lattice. The owner's ear out-ranks the
grid every time. On CRX-Anoma the whole cut was "on grid" and still felt off; every fix
was moving a word from a grid frame onto a real onset.

## Step 1 — Measure the real audio, not the grid

`python3 scripts/melody-onsets.py TRACK.mp3 --offset <audioStartFrom/fps> --fps <fps> --frames <past-your-end>`
(librosa's loader crashes on this Mac — the tool decodes with ffmpeg + numpy STFT.) It
returns, in COMPOSITION frames: **melodic onsets** (200–4000 Hz spectral-flux peaks = note
attacks, ranked 0..1 — your anchors), **drops/lulls** (RMS surges and quiet breakdowns),
the **pitch contour** (bright vs dark; the melody lives in the bright windows), and an
optional **grid check** (is your BPM grid even on the hits?). Always set `--frames` PAST
your cut end — the music usually keeps going, and the outro matters (Step 4).

## Step 2 — Place words on the hits

- The **first word and the PAYOFF word** of every sentence land on a real onset; interior
  words fall between (they don't need a hit).
- **Find the biggest hits and make sure a payoff lands on each.** Never let the loudest
  note in the track fall in a gap between scenes. (CRX-Anoma's single biggest hit, f633,
  sat wasted in a scene gap until "Without" was moved onto it — the flagship fix.)
- The **payoff before a breakdown lands on the LAST strong hit** before the music thins,
  so the line resolves as the music does.

## Step 3 — Match the section's energy

- **Breakdowns are sparse.** Land the few words there on the few notes that exist, and let
  them BREATHE (wider cascades). Busy animation over a lull reads as "meh" — the busyness
  fights the music.
- **Bright/high-pitch windows carry the melody** — put the emotional payoffs there.

## Step 4 — Let the finale ride the outro

- The music usually resolves AFTER a tight cut ends. Analyze past your end frame; if there
  is an outro, EXTEND the composition so the finale/lockup rides it instead of being
  chopped. Land the brand/logo entrance on the biggest post-swell onset.
- **Don't duck the music early** in the finale if the goal is to "play with the music" —
  hold it full through the outro, then fade.

## Step 5 — Verify cheap, then in the bytes, then by ear

- Overlay/text stills first: a flat-background comp mounting just the content layer (no
  heavy video bg) renders in seconds and confirms text/layout/frame placement.
- Before deploy, prove the new timing is in the FINAL ENCODED bytes (extract frames from
  the rendered mp4). A DURATION change from an extend is itself a deploy-proof.
- **The ear is the final judge.** Measurement PLACES the words; the owner watching CONFIRMS
  the sit. Once the onset map exists, each further fix is a one-line frame change — iterate
  spot by spot.

## Anti-patterns (each cost a round on CRX-Anoma)

- Trusting a BPM/snare grid as "synced" without checking it against the real onsets.
- Placing a payoff on a grid frame with no audible note under it.
- Leaving the loudest hit in the track unused in a scene gap.
- Animating busily through a breakdown lull.
- Trimming the cut before the music resolves — chopping the finale's breath.
