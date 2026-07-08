# CRX-Anoma beat sync + momentum

The music of all three **CRX-Anoma** cuts is `crx-assets/momentum-quake-soft.mp3`
— *ES_Momentum I. Quake* by Dian Shuai, softened (low-end EQ'd out, −7 dB) so it
reads calm, not epic. The track enters at **1:28**; the cut is scored to its **82
BPM half-time backbeat** — the slow pulse — so the whole piece feels unhurried.
This file is the doctrine — read it before touching any anchor.

## 2026-07-07 — the slow-pulse re-pace (current state)

The owner watched the first fast cut and asked, in two passes, for the same thing:
slow it, make it breathe, ride the tones not the fast beat, drop the epic drive.
This section is the current build. Everything below it that predates today is kept
only as the grid reference and prop record; the OLD anchor numbers are superseded.

**Owner feedback (verbatim → applied):**

- **Pace — "too fast, past reading speed."** The cascades stepped the 8th/16th
  (5–11 words/sec). Now every word cascade walks the **quarter-beat (10.976f,
  ~2.7 words/sec)**; nothing is tighter than a quarter.
- **Overlaps — "text runs under the card."** Scene 7's centered "infrastructure"
  used to linger under scene 8's mounting card. Fixed: every centered headline
  (S6, S7, S11) now plays over EMPTY ground, and each outgoing headline fully
  clears before the next card mounts or the next headline appears. The one
  card→card crossfade (RFQ→compliance) cuts the S9 headline at f1204 so it never
  coexists with the S10 headline.
- **Sound — "decrease it earlier."** The volume held full until the last 45f.
  Now it RECEDES from f1467 (the finale run-in), down to a low bed by the f1643
  mark-in, out by the end — the track breathes out under the settling wordmark.
  Also swapped to the softened master.
- **Cursor — "sync to the music."** Every hedge-scene cursor CLICK now lands on a
  snare (open 435, select 457, tenor 501/523, notional-focus 545, press 589),
  with a quarter-beat dwell before each.
- **Size — "the card popped ~4.5% on entry."** Scene 4's mount scale is now a
  subtle 1.5% that resolves to the canonical box within ~8 frames.

**Structure — ride the slow pulse.** The read-hold is GONE; reference frame ==
real playback frame, 1:1. Every STRUCTURAL moment — card mount, scene cut,
line-ender (payoff word) and the momentum crest — lands on the **snare grid
(21.953f)**; word cascades within a line walk the **quarter-beat (10.976f)**
between them. Structure on the half-tempo, reading on the quarter: that is what
makes it slow.

**Length.** `CRX_DURATION = 1760` frames (**58.67s** at 30fps), up from 1000. The
owner authorized the extra length ("fine if longer"). The audio has ~78s of
runway from 1:28, so it simply plays more of the track.

### Slow-pulse anchor table (the structure)

| moment | frame | snare | note |
|---|---|---|---|
| S3 dash mount | 216 | ✓ | Introducing |
| S3 cut | 326 | ✓ | into the hedge gap |
| S4/S5 hedge mount | 348 | ✓ | |
| rate LOCKS | 391 | ✓ | "locks" lands |
| corridor SELECT | 457 | ✓ | "Corridor" lands |
| typing completes | 567 | ✓ | "notional" lands |
| CTA press | 589 | ✓ | |
| hedge cut | 611 | ✓ | |
| S8 onboard mount | 896 | ✓ | "Onboard" |
| success flood | 1050 | ✓ | Verified resolves |
| S8 fade-end | 1094 | ✓ | |
| S9 RFQ mount | 1116 | ✓ | |
| **crest — 3rd quote** | **1160** | ✓ | "dealers" lands (66%) |
| best rate ringed | 1182 | ✓ | |
| S9 headline cut / S10 crossfade | 1204 | ✓ | RFQ card holds to 1226 |
| S10 checks tick | 1226 · 1248 · 1270 · 1291 | ✓ | one per slow pulse |
| All clear | 1313 | ✓ | holds ~22f |
| S10 fade-end | 1357 | ✓ | |
| S12 app mount | 1489 | ✓ | finale |
| positions / "Live" | 1533 | ✓ | |
| hero bar finishes | 1577 | ✓ | rests before fade |
| black fade | 1599 → 1643 | ✓ | lockup lands on black |
| mark rolls in | 1643 | ✓ | |
| wordmark reveals | 1687 | ✓ | settles ~1707 |
| last frame | 1760 | | holds on black |

### Word payoffs (line-enders on the snare)

Each sentence is one cascade — interior words on the quarter, the payoff on a
snare: **became** 62 · **Easy** (bloom) 128 · **Introducing** 216 / **CRX** 238 ·
**locks** 391 · **Corridor** 457 · **notional** 567 · **middleman** 677 ·
**infrastructure** 809 · **days** 918 · **dealers** 1160 (crest) · **design**
1226 · **simple** 1423 · **Sandbox** 1511 / **Live** 1533.

### Volume envelope

`interpolate(f, [0, 12, 1467, 1643, 1710, 1756], [0, 1, 1, 0.4, 0.12, 0])` — in
over the open, full through the story, a gentle taper from the finale run-in down
to a low bed by the mark-in, out by the end.

## The grid

| role | frames | use |
|---|---|---|
| beat (164 BPM) | 10.976 | interior words of a cascade; value rolls |
| **backbeat / snare (82 BPM)** | **21.953** | **the slow pulse — every mount, cut, line-ender, UI cause, crest** |
| 8th | 5.488 | reserved; unused in the slow-pulse cut |
| 16th | 2.744 | reserved; unused in the slow-pulse cut |

The beat grid is `f7.24 + k·10.976`. The snare grid is the odd-`k` coset,
`f18.22 + m·21.953`. Composition frame 0 = audio 88.000s (`audioStartFrom =
2640`); `beats_f = (beat_s − 88)·30`. All three cuts share this. Grid + energy:
`audio-analysis/momentum-quake.json`.

## Rules (slow-pulse doctrine)

- The first word AND the payoff word of a sentence land on a **snare**. Interior
  words walk the **quarter-beat** between them. A sentence spanning two rows is
  ONE cascade. Nothing is ever tighter than a quarter.
- A UI cause (click, lock, quote-land, select) sits on a **snare**; its effect
  follows 1–2 frames later. The cursor dwells a quarter-beat before each click.
- A chart finishes on a **snare** and RESTS before its scene exits. `BarChart`
  staggers each bar by `i·2`, so the growth array ends 8 frames before the hero
  bar's snare, and the LAST bar lands on the hit.
- Scene cuts and card mounts are on the snare grid. At EVERY boundary the
  outgoing headline fully clears (opacity 0 / cut complete) before the next card
  mounts or the next headline appears. Centered headlines (S6, S7, S11) never
  coexist with the card box (x 504–1214, y 122–598).
- Continuous motion (spring settles, the spinner, the water loop) rides by onset
  and period, never frame-locked. Idle "breathing" pulses beat at one bar.

## The momentum layer (gentle)

`momentum(rf)` is a 0..1 curve — a **slow breath, not a build-drop**. It rises
calmly from ~0.30, crests softly at **0.70 on the f1160 snare** (the RFQ, "the
whole dealer network answers", ~66% through), then eases down as the finale
settles. 37 control points, one every 50 frames over 0..1760.

It drives only the APPROACH of each word — a slightly snappier settle
(`r = 0.80 − 0.14·momentum`) and a faint drop accent (`×= 1 + 0.10·momentum`)
near the crest, softer at the calm ends. The gains are deliberately small. It
never decides whether an entrance lands on the grid, and it never tightens the
cascade below the quarter-beat.

## Prop parity (source: app.crxfx.com + landing, 2026-07-02 shots)

- Decimals: every $ value renders `.00` small and grey (app signature).
- Balance card: number first, "Total value" grey below; rows Available / Margin
  Locked / Unrealized P&L (green); token rows (USDC, USDT) with icon + name + sub.
- Nav mark is FLAT teal #0fb6ab in app chrome; the gradient mark is reserved for
  the end lockup on black.
- Health bars are green #0e7a4a with an end tick; the Long chip is neutral.
- Running states carry a rotating arc spinner; done states the green check dot.
- Spot price value is ink-weighted; the grey belongs to the label.

## Uniform popup frame (owner: "all windows should be exact same size")

- Every floating app-card popup — portfolio (S3), hedge (S4), onboarding stepper
  (S8), RFQ (S9), compliance checklist (S10) — renders in ONE canonical frame:
  `CARD = { left: 504, top: 122, w: 710, h: 476 }` in `CrxAppCards.tsx`. Same
  width, same height, same on-stage anchor, scene to scene. The window never
  resizes or jumps on a cut.
- No card is content-sized: every `Card` takes an explicit `w`/`h`, so rows
  fade/tick in WITHIN the fixed frame — it does not grow.
- EXCEPTION: scene 12 ("CRX Sandbox is Live") is the finale full-app reveal, not
  a popup — it keeps its own full-width `S12` frame (left 83, top 321, w 1114).
- Scene 4's mount `scale` is a subtle 1.5% settle off the f348 snare that
  resolves to the exact canonical size within ~8 frames (was a 4.5% pop; owner
  flagged the size-variance).

## Glossary

- **rf (reference frame):** the authoring timeline. With the read-hold removed it
  is now identical to real playback frame, 1:1.
- **Backbeat / snare / slow pulse:** the 82 BPM half-tempo hit (21.953f) — the
  structural grid where mounts, cuts, line-enders, UI causes and the crest land.
- **Crest:** the gentle momentum apex, f1160 (the RFQ), ~66% through.
