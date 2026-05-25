# RetailPnLShort — cue sheet

Track: `public/music/rainbows-pitch.mp3` — 144 BPM, steady 4/4. One bar = 1.667s = **50 frames @ 30fps**.

The reel carries no voice-over. Music is the whole floor — so it sits up front
(~0.92), not ducked. The edit is built on the track's own beat grid: every scene
cut is a detected downbeat, and the first reveal lands on the drop.

## The shape of the track

- `0–13.6s` — atmospheric intro, no beat grid
- `13.6–40s` — melodic build
- `40–53s` — breakdown / dip (energy falls to ~0.17)
- **`53.8s` — the drop** (energy jumps to 0.35, held 0.30–0.39 through ~90s)
- `92s+` — second breakdown, final section, clean tail at 114s

## The slice we ride

Music starts at **50.29s** (`MUSIC_OFFSET_FRAMES = 1509`). The hook plays over the
breakdown tail — tension, a riser into the fall. Beat 1 lands on the drop. The four
reveals ride the sustained high-energy section. The outro eases out at 87s, before
the next breakdown.

| scene | video frame | music time | beat |
|---|---|---|---|
| hook (tension) | 0 | 50.29s | breakdown tail |
| **beat 1 — Prediction markets** | **105** | **53.80s** | **the drop** |
| beat 2 — Memecoins | 310 | 60.64s | peak ~64s |
| beat 3 — Index funds | 509 | 67.25s | |
| beat 4 — Crypto perps | 708 | 73.89s | |
| outro — "Same game. Better odds." | 906 | 80.50s | |
| end | 1105 | 87.13s | |

Total: **1105 frames / 36.8s**.

Each comparison beat is 4 bars (≈200f). Within it the bars do the work: bar 0 the
cut + name punch, bars 1–3 the curve moving left and the top-1% number counting
down, bar 3 the "down from" landing, bar 4 a held rest before the next downbeat.

## Mixing law

- Music: `0.92`, a fast 8-frame fade-in, a 44-frame fade-out over the outro tail.
- Stingers: a light whoosh (`sfx/mg-whoosh-light.mp3`, ~0.28) leading each cut; a
  sub-impact (`sfx/drop-sub-impact.mp3`, ~0.42) on the drop only. Brief, sub-weighted,
  never on top of the music's own transients.

A good score is felt and never noticed. Here the cut *is* the beat.
