# CRX-Anoma beat sync + momentum

The music of all three **CRX-Anoma** cuts is now `crx-assets/momentum-quake.mp3`
— *ES_Momentum I. Quake* by Dian Shuai. The track enters at **1:28** and the cut
gathers momentum: it accelerates into the mid-climax, then decelerates into the
brand reveal. This file is the doctrine — read it before touching any anchor.

## TL;DR

- **Tempo:** 163.99 BPM. Beat = **10.976f**. Strong 82 BPM backbeat/**snare = 21.95f**.
  8th = 5.49f, 16th = 2.74f. Grid phase **f7.24**.
- **Entry:** audio **88.000s** → composition frame 0. `audioStartFrom = 2640`
  (= 88·30). `beats_f = (beat_s − 88)·30`. All three cuts share this.
- **Read-hold:** `CRX_HOLD = 31` (DURATION 969 + 31 = **1000 frames**, 33.3s).
  `rf ≥ 353` plays at real = rf + 31.
- **Snapping is done in REAL time,** not rf. So every anchor lands on an audio
  beat on both sides of the freeze — no approximate-grid drift.
- **Momentum** rises from a calm entry (~0.38) to the **quake peak (0.95) at real
  f≈630**, then falls to ~0.04 by f900 as the lockup settles.
- Grid + energy: `audio-analysis/momentum-quake.json`.

## The grid

| role | frames | use |
|---|---|---|
| beat (164 BPM) | 10.976 | first word of a line; UI causes; card mounts |
| backbeat / snare (82 BPM) | 21.95 | scene cuts; line-enders; chart finishes — the strong hits |
| 8th | 5.49 | calm cascade step (momentum < 0.55) |
| 16th | 2.74 | busy cascade step (momentum ≥ 0.55) |

The beat grid is `f7.24 + k·10.976`. The snare grid is the odd-`k` coset,
`f18.22 + m·21.95`. Strong quarter-hits near the quake: f567, 589, 611, 633.

## Why snap in real time, not rf-space

The read-hold freezes `rf = 352` for 31 real frames, so an anchor at `rf ≥ 353`
is *heard* at `real = rf + 31`. 31f is 2.82 beats — **not** a whole pulse — so the
old "one continuous rf-grid" trick would leave post-hold anchors ~1.9f off the
audio. Therefore: each anchor is snapped in real-frame space and converted back
(`rf = realBeat − 31` past the hold). Every hit lands exactly on the audio grid,
freeze or no freeze. The pre- and post-hold rf-grids differ by ~1.9f; that is
invisible and never accumulates.

## Rules (unchanged doctrine, new grid)

- The first word of a line arrives on a **beat**. Interior words walk the 8th grid
  (calm) or 16th grid (busy). The last word **lands on a beat** — the line
  *finishes* on the hit. A sentence spanning two rows is ONE cascade.
- A UI cause (click, lock, quote-land, select) sits on a **beat**; its effect
  follows 1–2 frames later. Tightly-grouped micro-events (ticks, hover hops)
  cascade on the 8th/16th grid, first on a beat.
- A chart finishes on a **beat** and RESTS ≥ 6 frames before its scene exits.
  `BarChart` staggers each bar by `i·2`, so the growth array ends 8 frames before
  the hero bar's beat, and the LAST bar lands on the hit.
- **Scene cuts and mounts are now on the grid too** (previously frozen). Every hard
  cut is snapped to a snare (the strong sync); every card mounts on a beat. Read
  time is preserved — the grid is dense (0.37s beats), so each cut moved only a few
  frames; no line is clipped before it can be read.
- Continuous motion (spring settles, the spinner, the water loop) rides by onset
  and period, never frame-locked. Idle "breathing" pulses (Indicative/Quoting
  dots, skeletons) beat at one bar (~44f), not an arbitrary period.

## Word anchors (reference frames, before → after)

Each sentence is one cascade: first word on a beat, payoff word on a beat.

| sentence | first → | payoff → |
|---|---|---|
| Managing FX risk just **became** | Managing 6→7 | became 22→**29** |
| Introducing / **CRX** | Introducing 124→128 | CRX 128→**139** |
| Access rate **locks** | Access 218→216 | locks 226→**227** |
| In Any **Corridor** | In 265→260 | Corridor 273→**271** |
| At your preferred date and **notional** | At 315→315 | notional 335→**337** |
| Without paying the **middleman** | Without 363→360 | middleman 382→**382** |
| From legacy banks, to modern **infrastructure** | From 409→404 | infrastructure 429→**426** |
| Onboard in **days** | Onboard 469→470 | days 476→**481** |
| Access liquidity from multiple **dealers** | Access 571→569 | dealers 590→**591** |
| Compliance by **design** | Compliance 657→657 | design 665→**668** |
| Cross-border business risk, made **simple** | Cross-border 727→723 | simple 743→**745** |
| CRX Sandbox is **Live** | CRX 774→778 | Live 790→**799** |

Interior words (this cut): FX 13 · risk 18 · just 24 · rate 221 · Any 265 · your
320 · preferred 323 · date 328 · and 334 · paying 369 · the 374 · legacy 407 ·
banks 413 · to 418 · modern 421 · in 476 · liquidity 574 · from 580 · multiple
585 · by 662 · business 728 · risk 734 · made 739 · Sandbox 783 · is 794.

End lockup: **mark f865** (real 896) · **wordmark reveal f909** (real 940). The
mark rolls in on the snare where the water finishes fading to black, rests two
backbeats, then the wordmark slides out and settles on black to the end.

## UI anchors (reference frames)

- **S3 dash** — bars grow f150, hero FINISHES on f194 (rest to 210), pill f194;
  mount 128, blur-out 210→216 into the f216 snare cut.
- **S4 hedge** — rate ticks f227, LOCKS f238; corridor panel opens f260, hover
  hops 271/282/293, select f293; tenor swaps f315/320; typing f337; CTA arms f351
  (held by the freeze), press f356; card cuts on the f360 snare.
- **S8 onboarding** — sub-state faces 459/470/492/498/503/536; success dot pops
  f547, floods the card across f558, Verified resolves f558; card fades 574→580.
- **S9 dealers** — quotes roll in f580/585/591 ("dealers" lands with the third),
  best rate ringed f602; this scene rides the quake (peak momentum).
- **S10 compliance** — checks tick f668/673/679/690, All-clear f701 (holds ~11f);
  card fades 712→723.
- **S12 app** — bars grow f784, hero FINISHES on f821 (rest ~27f), pill f821;
  positions f799 (with "Live") and f810; card mounts on the f778 snare (the strong
  finale cut), fades 848→854.

## Scene cuts (before → after)

Cuts snapped to a backbeat/snare; mounts to a beat.

| cut | → | mount window (rf) |
|---|---|---|
| s3 Introducing/CRX | 209→**216** | dash 128–216 |
| s4 Access/locks | 258→**260** | hedge 205–360 |
| s4 Corridor | 308→**304** | |
| s5 notional | 358→**360** | |
| s6 middleman | 409→**404** | |
| s7 infrastructure | 461→**470** | |
| s8 days | 565→**558** | onboard 459–580 |
| s9 dealers | 650→**646** | dealers 569–668 |
| s10 comply fade | 716→**712** … 722→**723** | comply 646–723 |
| s11 simple | 764→**767** | |
| s12 fade | 848→**843** … 851 | app 778–854 |

Background fade-to-black starts on the **f854 beat**, completes on the **f865
snare** — the lockup lands on solid black.

## The momentum layer

Beyond sitting on beats, the cut ACCELERATES then DECELERATES. `momentum(rf)` is a
0..1 curve, 21 control points every 50 REAL frames, derived from the de-spiked
RMS-loudness *build* of the track over audio 88–121.3s (the frame-0 entry downbeat
is a one-shot accent, so the curve reads the sustained arrangement, not the
transient). Values (`momentum_ctrl_50f`):

```
f:   0    50   100  150  200  250  300  350  400  450  500
    0.38 0.47 0.52 0.51 0.58 0.75 0.84 0.81 0.76 0.71 0.67
f:  550  600  650  700  750  800  850  900  950 1000
    0.75 0.95 0.95 0.58 0.21 0.09 0.09 0.04 0.00 0.07
```

**The arc.** Frames 0→~600 accelerate: calm entry (0.38), a shoulder at f300, a
breath at f500, then the PEAK (0.95) at the **1:48 quake, real f≈630**. In
rf-space that peak is rf≈599 — so **Scene 9 (the RFQ, the whole dealer network
answering) rides the climax.** Frames ~600→1000 decelerate hard into the
breakdown: "CRX Sandbox is Live" and the end-lockup settle, the mark rolling in
and coming to rest on black as the track breathes out.

**What it drives** (the APPROACH, never whether an entrance lands on the beat):

- **Cascade step** — 8th grid (5.49f) when calm, 16th grid (2.74f) when
  `momentum ≥ 0.55`. Cascades tighten into the quake (Scenes 5/9), loosen at the
  calm ends (Scenes 1/11/12).
- **Settle rate** — `r = 0.80 − 0.18·momentum`. In `wordStyle`, `off = drop·r^dt`,
  so a *lower* r settles FASTER. Words snap crisply at the peak (r≈0.63), settle
  softly when calm (r≈0.79).
- **Drop accent** — `drop ×= 1 + 0.14·momentum`. Words fall from a little higher on
  the strong hits; the accent is small by design.

Entrances still LAND on the grid subdivisions; momentum changes only the speed and
spacing of the approach. Restraint is the rule — the owner has a particular eye,
and clean physics beats a busy one.

## Prop parity (source: app.crxfx.com + landing, 2026-07-02 shots)

- Decimals: every $ value renders `.00` small and grey (app signature).
- Balance card: number first, "Total value" grey below; rows Available / Margin
  Locked / Unrealized P&L (green); token rows (USDC, USDT) with icon + name + sub.
- Nav mark is FLAT teal #0fb6ab in app chrome; the gradient mark is reserved for
  the end lockup on black.
- Health bars are green #0e7a4a with an end tick; the Long chip is neutral.
- Running states carry a rotating arc spinner; done states the green check dot.
- Spot price value is ink-weighted; the grey belongs to the label.

## Glossary

- **rf (reference frame):** the authoring timeline. Real playback = rf, except
  during the read-hold where rf freezes at 352 for 31 real frames.
- **Backbeat / snare:** the 82 BPM half-tempo hit (21.95f) — the strongest,
  where scene cuts land.
- **Quake:** the track's loudest arrangement peak, audio 1:48 ≈ real f630, the
  momentum apex.
