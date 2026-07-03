# CRX-Anoma beat sync + prop parity

The music is `crx-assets/loosin-up.mp3` — 97.97 BPM. At 30fps one beat is
18.37 frames; an 8th is 9.19; a 16th is 4.59. The snare lands every two
beats: f19, 55, 92, 128, 166, 202, 239, 276, 313, 349, 387, 423, 460,
496, 533, 570, 607, 643, 680, 717, 754, 790, 827, 864, 901, 937.
Full grid: `audio-analysis/loosin-up.json` (produced by a numpy
spectral-flux detector; `scripts/analyze_music.py` is broken on this
machine — x86_64 samplerate wheel).

## Rules

- The first word of a line arrives on a beat or an 8th. A cascade walks
  the 16th grid. The last word of a line lands on a snare when one is
  near — the line *finishes* on the hit.
- A UI cause (click, lock, flood, landing quote) is the audible event:
  it sits on a beat or snare. Its effect follows 1–2 frames later.
- A chart finishes growing on a snare and then RESTS at least 6 frames
  before its scene exits. Growth running into the exit reads as a clip.
- Scene mount windows stay frozen (inherited from the measured Anoma
  reference). Only intra-scene timing moves.

## Word anchors (after)

became 19 · locks 221 · Corridor 277 · your 313 · notional 332 ·
paying 368 · infrastructure 423 · Onboard 465 · Access 570 ·
dealers 589 · confidence 662 · simple. 736 · Sandbox 772 ·
end mark 864 · wordmark reveal 901.

## UI anchors (after)

S3 bars 147→202 (rest to 203) · rate ticks 221, lock 240 ·
pair click 263, hover 272/281/290, select 295 · tenor 313/322 ·
typing 332, CTA arms 349, press 354 · onboarding faces
463/469/492/496/506/533, flood straddles 552, verified 555 ·
quotes land 584/589/593, best ring 607 · comply rows 666/675/684/694,
all-clear 699 · S12 card 769, bars 783→828 (rest to 845), pill 809,
positions 791/800.

## Prop parity (source: app.crxfx.com + landing-dev6, 2026-07-02 shots)

- Decimals: every $ value renders `.00` small and grey (app signature).
- Balance card: number first, "Total value" grey below; rows are
  Available / Margin Locked / Unrealized P&L (green); token rows
  (USDC, USDT) with icon + name + sub.
- Nav mark is FLAT teal #0fb6ab in app chrome; the gradient mark is
  reserved for the end lockup on black.
- Sandbox banner: mustard #b8860b with flask icon (S12).
- Health bars are green #0e7a4a with an end tick, label green; the
  Long chip is neutral (grey well, ink text).
- Running states carry a rotating arc spinner; done states the green
  check dot.
- Spot price value is ink-weighted; the grey belongs to the label.
