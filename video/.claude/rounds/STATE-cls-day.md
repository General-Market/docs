# STATE — cls-day track

## Mission

Rebuild `public/cls-day-original.mp4` ("CLS Settlement in a Day", 1920×1080,
25fps, 3750f, 150s — flat corporate motion-design explainer of an FX
settlement day) 1:1 in Remotion as `ClsDay-Replicate`, plus
`ClsDay-SideBySide` and the publishable `CrxSettlementDay` (same
choreography, CRX props). Target verify SCORE ≥ 90 (path to 95). DOM/SVG
only — no baked rasters (brief overrides the anoma raster precedent).

- Lane: `src/compositions/replicates/cls-day/**`, `public/cls-day-assets/**`,
  `.claude/rounds/{STATE-cls-day.md,cls-day-*,work/cls-day/**,pubdir/cls-day/**}`.
- Barrel: `ClsDayComps.tsx` — keep export names + comp ids stable
  (`ClsDay-Replicate`, `ClsDay-SideBySide`, `CrxSettlementDay`).
  RootReplicas.tsx already imports it — NEVER edit RootReplicas/Root/index*.
- Verify (the only accepted score):
  `VERIFY_ENTRY=src/index-replicas.ts VERIFY_PUBLIC_DIR="$PWD/.claude/rounds/pubdir/cls-day" ./scripts/verify-replication.sh public/cls-day-original.mp4 ClsDay-Replicate`
- Slim pubdir gotcha: index-replicas bundles ALL replica lanes; sibling
  module-level `loadFont`/`Img` preloads 404-crash a render against a slim
  dir. pubdir/cls-day already carries clones of `crx-assets/fonts`,
  `netgrowth-assets`, `irswap-assets`. If a sibling adds another
  module-level staticFile, `cp -cR public/<dir>` into the pubdir.
- Owner directive 2026-07-09: one round per session; land, log, stop;
  inheritor resumes from this file.

## Architecture (all in the lane)

- `data.ts` — palette, fonts, BAND geometry, scene table, all copy, Pack
  type + CLS_PACK. Every measured constant lives here or inline with a
  "measured" comment in the scene.
- `lib.tsx` — primitives: ClsMark/ClsLetters/ClsWordmark (SVG logo traced
  from end card), pillar icons, TimelineBand (y/h/originX/originHour/
  pxPerHour per scene), MarkerTriangle, Milestone, Chip (leaf: TL+BR
  radius 58% of h), ClsPill, DocSheet, Donut, CheckCircle, Buildings,
  HexCity, BankHex, HandshakePill, Padlock.
- `scenes1.tsx` — S1 intro logo card · WipeIn (diagonal white, f96–122) ·
  S2 currency carousel · S3 globe clock · S4 trade diagram · S5 skyline ·
  S6 00:00 schedule · S7 netting donuts (+ SchedDoc shared).
- `scenes2.tsx` — S8 06:30 revised · S9 zoom times · S10 settle flows ·
  S11 docs row · S12 checks · S13 PvP handshake · S14 09:00 target ·
  S15 brackets + 8.0+ trillion · S16 payouts A–H · S17 summary diagram ·
  S18 outro gauge · S19 end card.
- `ClsDayReplicate.tsx` — mounts `ClsDayScenes pack={CLS_PACK}`; scenes
  take (frame, pack) so `CrxSettlementDay.tsx` reuses them with CRX_PACK
  (`crx-data.ts`) + Diatype + crx-lockup-white.png (BrandLogo/PillLogo
  slots).

## Measured ground truth (per-pixel probes; frames = ref frames @25fps)

- Palette: navy bg #002753, headline navy #12365E, tick navy #0B2341,
  red ink #CC441E, marker red #D1451E, band grey #D7D7D7, page white
  #FDFDFD, globe/donut blue #4CA0D3, arrows skyBlue ~#2E96D6, chips
  grey #8B9DAF / cream #F2C7A9 / navy #0E2C50 / red #CC441E.
- Fonts: UI = Helvetica (bold digits, regular labels). Serif (currencies,
  %, 8.0+) = high-contrast transitional — Georgia is the stand-in.
  r5 CORRECTION (measured on rendered ink): settled currency cap = 251px
  → fs 349 (NOT 320/223 as r1 had); plunging pairs cap 242 → fs 338.
  Calibration: rendered baseline = CSS_top + 0.825·fs; rendered cap-top
  = CSS_top + 0.122·fs. Top code baseline 530; bottom cap-top 565.
- Hard cuts (ffmpeg scene>0.18): f674, f1466, f3561. Everything else is
  soft transitions (wipes, pans, zooms).
- Band geometry per scene (grey strip y/h · px per hour · anchors):
  - S4 trade f440–674: y96 h40 · 141.7 · marker fixed x960; 23:00 under
    marker at f550; pan hourAt = 23 + (f−550)·0.00917 (−1.3 px/f).
  - S5 skyline f674–940: y490 h85 · 301.5 · x(09:00)=288−1.54(f−750);
    mirrored world below band is +6 hours, white ink on navy.
  - S6 schedule f940–1188: y152 h54 · 199 · STATIC, 00:00 tick at x293,
    06:30 red preview tick x1586. Red 00:00 line to y445. Big text block
    x360 y585 (130px bold), slides off left f985–1015. Doc draws at
    (1032,645) w400 h425.
  - S9–S12 f1830–2360: y88 h40 · 141.6 · STATIC, ticks 109+141.6k,
    07:00 = x958 (marker there).
  - S13 pvp f2362–2737: y0 h57 · 285.7 · STATIC, 04:00 tick at x101,
    NO marker. Pill (759,435) 380×213; rails y279/y781; vertical line
    x949; cluster frames: flat top y223/bottom y837, inner vertex x480
    (left) / x1440 mirrored (right).
  - S14/S15/S16 f2737–3200: y221 h69 · 249 · marker (955,123) size 90.
    hourAt(960): 8.15@f2800 → 8.4@f2900 (hold); payouts pans fast:
    11.2@f3100 → 12.1@f3150 (0.018 h/f).
  - S15 brackets: settlement bar x612–1108 (07:00–09:00) y500 h148;
    funding bar x612–1852 (07:00–12:00) y692 h152; red drop lines at
    07:00/09:00 from band bottom 290 to bar top 500; radius ~24.
  - S17 summary f3200–3440: y92 h40 · 144.4 · 02:00 tick x62; milestones
    06:30/07:00/09:00/12:00 as red ticks + 2-line labels; hexes (547,413)
    and (1351,413) 290×235; pill (793,476) 335×109; shield (777,570)
    384×357; trade-executed arrow y393; dashed prior-to-value-date y793.
- Currency scene S2 f100–300 (r5 REMEASURED — see r5 round log): ruler =
  navy hairline y531–534 + grey strip y534–548, ticks every 49.5px (NOT
  22), grid phase drifts left ~1.2px/f. Chips w129 h58 pitch ~78 on a
  FIXED lattice (rows 254..877), R col left edge 1497@f150 drifting
  -1.5px/f (whole assembly drifts: codes, chips, ticks). Pair carousel:
  USD/JPY x325/419 settle f118; DKK/GBP f180 (drifting x); then SIX
  plunge pairs f230-283 (no settle, swallowed by the ruler); chip stack
  drains f227-236 then a pitch-150 funnel at ±48px/f; band descends
  f254-306 into the S3 dock (globe from top-right at 0.77 scale).
- S8 revised f1466–1712: f1500–1522 ZOOMS IN 3.58× (band grey y0–173,
  pitch ~507, labels fs~60; doc fold fragment at (446–670, 570–800));
  then 06:30 milestone view (red line, 110px text), then staircase bars
  (grey→navy, 5 bars) with zoomed band pitch 340.
- End card (f3561–3750, static; intro shares layout): mark x422 y166
  size 235; letters x702 y168 h230 (strip scans in work/cls-day notes);
  tagline y~426 fs66 light; icons y651 h~180 at x572/857/1177; serif
  labels y866 fs34 centered at x672/950/1260.

## Round log

### gen-8 TYPEFACE front — 2026-07-11 (serif screen, COMPLETE — no change)

**The serif is at its floor for cls-day; Hoefler Text stays.** Screened the
full obtainable field IN-RENDER (11 macOS system + 10 Google display/text
serifs — Prata/Playfair/DM Serif/Noto Serif Display/Newsreader/Source Serif 4/
Spectral/PT Serif/Lora/STIX) at true Chromium metrics via a throwaway FontLab
still harness, then cap-normalized ink-overlap + width/ref. On the dominant S2
'USD' code (the largest serif ink in the lane): Hoefler **0.092** (w/r 1.01) <
Times 0.123 < STIX 0.135 < Newsreader 0.151 < Georgia 0.187 < Didot 0.212 <
Charter 0.227 < Prata 0.252 < Playfair 0.337 < DM Serif 0.433. No obtainable
face is within 0.03 of Hoefler, and its natural width already matches the ref.
The proprietary ref face is Klim's FINANCIER (unobtainable). VERDICT: no truer
obtainable face — Hoefler Text confirmed, NO code change. Full A/B tables +
harness in `work/cls-shared/fontab/gen8/`; verdict block in cls-shared/fonts.ts.

### r10 — 2026-07-11 (gen-8 "go further" session, BUILD COMPLETE; official verify PENDING orchestrator)

**Front: THE S5 SKYLINE. Landed the LAST clean structural bug in S5 —
ClD (below-15:00 hanging tower) was 32px too short.** Commit **07bc7750d**
(single commit, ClD re-trace in scenes1.tsx). BUILD ONLY per brief — did
NOT run the full 3750f verify. Measurement + gate artifacts in
`work/cls-day/r10/` (att/ new stills, att_old/ HEAD stills, ref_f*.png,
grid/ + strips/ crops & diffs, probe_*.py).

**Re-rank of `cls-day-framessim-r9.txt` confirmed S5 is still worst-texture:**
top-12 windows led by 876-926 (.8578, #1), 634-684 (.8598, #2, S4→S5),
767-817 (#6), 825-875 (#7), 686-736 (#9) — S5 cruise dominates. Docs
2102-2215 (#3/#4), S13 tail 2687-2737 (#8), S17 tail (#10/#11).

**Per-cluster crop SSIM (the real lever) at f750 & f900 isolated ClD as the
persistent worst by a wide margin:**

| cluster | f750 crop | f900 crop |
|---|---|---|
| ClB 10:00 | .702 | .742 |
| ClC 12:00 | .705 | .704 |
| ClG 14:00 | — | .645 |
| ClD 15:00 | **.518** | **.516** |
| ClE 17:00 | .731 | .704 |
| ClF 19:00 | — | .634 |

Every other cluster sat .70-.75; ClD alone was .52. Per-pixel trace of
ref f750 (probe_cld*.py) found the cause: **ClD's r3-era body rects stopped
at y250 while the ref walls span local y6..282** — the tower rendered 32px
short, base sat high, whole thing read compressed. Also re-registered the
window grid (was 18px, right col 5.5px left): cols x167.5/197.5 (w19) +
right x271.5 (w18), 7 rows tops 70/98/126/154/182/209/237 (pitch 28, h19),
roof beam y45, crown box y6..21, base beam y282 + left foot notch
(x182.5..222.5 to y300) + twin masts (x272.5→297, x288.5→315). Solid
per-row pattern (A:r2,r7 · B:r4 · R:r4,r7) confirmed correct, unchanged.

**A/B still-gate (full-frame ffmpeg SSIM, ref vs OLD-HEAD → NEW), 4 frames
in the target window — the OFFICIAL-style metric rose at EVERY frame:**

| frame | OLD full | NEW full | Δ | ClD-crop OLD→NEW |
|---|---|---|---|---|
| f750 | .8508 | .8566 | **+.0058** | .55→.66 |
| f820 | .8516 | .8568 | **+.0052** | .54→.63 |
| f860 | .8504 | .8549 | **+.0045** | .49→.58 |
| f900 | .8513 | .8558 | **+.0046** | .52→.60 |

Real metric win (~+.005 mean full-frame across the window), NOT a texture-
floor illusion — this was pure REGISTRATION (matching exact size/position),
which collapses the diff-doubling. The campaign trap (dense near-miss <
sparse) was avoided precisely because no NEW ink was invented; the existing
dense grid was moved onto the ref. Score move ~sub-hundredth global
(video_ssim +.005 over the ~230f ClD-visible span ≈ +.0003), consistent
with the r8/r9 asymptote framing. ClD crop climbed from worst-in-S5 (.52)
into the .58-.66 pack.

**Floor honesty (lesson 9): ClD was the last CLEAN structural bug in S5.**
Assessed the 2nd/3rd-worst below-band towers (ClF 19:00 .634, ClG 14:00
.645) after the fix — NOT gross structural bugs. ClF's block width (~121)
and shaft positions already match ref (probe_clf.py); its remaining deficit
is finer registration (window size 15→19, fin extents, ±3px) PLUS the
below-band SSIM floor — navy bg + thin white/red lines score structurally
lower than the white-bg above-band towers regardless of accuracy. Chasing
ClF/ClG is speculative dense-ink at real dense-near-miss risk for sub-
hundredth yield — NOT worth a session. **Remaining cls-day headroom toward
96 is unchanged from the r8 wall analysis:** color (.986) + duration (.9997)
are near-max, so +3.6 to 96 needs ~+0.04 mean SSIM across all 3750f from an
already-flat .858-.872 worst-window / .909-mean distribution held by hand-
drawn-texture micro-registration + the differently-encoded-mp4 SSIM floor
(~.004, encoding trap). 96 remains WALLED. Next levers (all sub-hundredth):
ClF/ClG below-band grinds, S4→S5 entry tiles (#2 window, recycled guesses),
S11/S12 doc hairlines.

### r9 — 2026-07-11 (gen-8 inheritor session, BUILD COMPLETE; official verify PENDING orchestrator)

**Attacked the ONE fixable lever from the r8 verdict: S17 summary EXIT PAN
(f3239-3389).** Commit **<pending>** (single commit, S17Summary rebuild in
scenes2.tsx). BUILD ONLY per brief — did NOT run the full 3750f verify; the
orchestrator runs the official r9 verify. Measurement artifacts + rescue renders
in `work/cls-day/r9/` (panref/ dense ref f3198-3395; track_s17*.py, track_pill.py;
gate/ old+new stills; strips/).

**What the r8 verdict called "accelerating left-pan, unmeasured/invented" was
TWO structural bugs, both now measured per-frame:**
1. The grey band + its red milestone ticks/labels PAN LEFT the whole scene
   (marker fixed x955 = a playhead advancing 06:30→09:40); the old code FROZE
   them at 07:00=x784 for f3200-3372. Measured (red-tick centroid + edge
   cross-corr): x(07:00) = entry slide-in decel 1379→1033 (f3200-3216) then a
   near-perfectly LINEAR −2.94 px/f body pan to 574 (f3372). The r8 guess of
   "accelerating" was wrong — it's linear (doctrine: measure, don't theorise).
2. The central diagram (hexes/pill/shield/rows) is a STATIC screen overlay, NOT
   part of the panning world (diagram cross-corr dx == 0 through f3380). The old
   code translated it with the (zeroed) pan, so it was accidentally static in the
   body — but it fed the wrong exit.
Also fixed by measurement: the diagram BUILDS ON after the band (ref: absent
f3215, in by ~f3248 — old inP had it at 100% by f3228; retimed diagP 3216-3248),
and the EXIT (f3381+) is ONE rigid world translation of band+diagram together
(measured from the CLS-pill centroid: worldDX −43→−868, worldDY +12→+137 by
f3392, full-size no-scale), NOT a band-only drop. Tail f3390-3392 (PAST the target
windows, near-white thin-line frames where SSIM rewards blankness) swept clear
fast to match the previously-accepted behaviour — no regression.

New model (S17Summary): `x07 = lut(S17_X07)` drives band originX AND milestones
`hx(h)=x07+(h-7)·144.4`; marker fixed x955; diagram static+diagP; one world
wrapper `translate(worldDX,worldDY)` over everything for the exit.

**Still-gate (PNG, ffmpeg SSIM, NEW vs OLD-HEAD vs ref), dense over the target
window 3239-3389 (151f): OLD 0.8450 → NEW 0.8553 (+0.0103)** — exceeds the r8
verdict's predicted +.005-.01. The three r8 rolling windows all lifted:

| r8 window | OLD | NEW | Δ |
|---|---|---|---|
| 3239-3288 | .8510 | .8578 | +.0068 |
| 3289-3338 | .8457 | .8560 | +.0103 |
| 3339-3388 | .8384 | .8526 | +.0142 |

Spot frames (OLD→NEW): f3260 .849→.857 (+.008) · f3320 .842→.857 (+.015) ·
f3340 .843→.854 (+.011) · f3360 .845→.858 (+.013) · f3372 .840→.857 (+.016) ·
f3385 .810→.837 (+.027) · exit f3391 .890→.908 (+.018) · f3392 .934→.937.
f3300 is the crossover (both bands at ~784, Δ≈0). Residuals: f3245 −.0011,
f3250 −.0001 — sub-thousandth, in the diagram build-on fade zone (texture).
Expected score move: sub-hundredth (video_ssim +.0103 over 151/3750 frames ≈
+.0004 global) — the last honest gain, exactly as the r8 verdict framed it.

**Floor honesty (lesson 9):** cls-day is now at its floor — SHIP IT. After r9 the
S17 pan (the sole measurable structural lever the r8 verdict named) is measured
and banked. The remaining top windows are S5 skyline / S4→S5 tiles / S11-S12 &
S13 doc-interiors — all hand-drawn-texture or reference-self-contradiction, which
the r8 ceiling analysis proved yield ~zero. ONE sub-hundredth structural micro-
lever remains for a possible r10 (NOT worth a session alone): the ref OMITS the
band hour labels at milestone hours (07:00/09:00/12:00) where the milestone label
sits, but our TimelineBand still draws them → a faint doubled label at those three
columns across S17 (identical old/new, not a regression). Suppressing them is
clearly-correct and cheap but perturbs the whole scene; fold it into any future
S17 touch, don't spin a round for it. 96 remains WALLED (r8 analysis stands).

### r8 — 2026-07-10 (gen-7 inheritor session, COMPLETE)

**Official verify: SCORE 92.4** — video_ssim 0.90881 (40%) · keyframe
0.89273 (35%) · color 0.98566 (15%) · duration 0.99972 (10%). Trajectory
89.8 → 91.0 → 91.4 → 91.8 → 92.0 → 92.0 → **92.1 (r7)** → **92.4 (r8)**.
Artifacts `cls-day-*-r8.*`; runner `work/cls-day/r8/run-verify.sh`; log
`work/cls-day/r8/verify-out.txt`; VALID rescue
`work/cls-day/r8/attempt-rescue.mp4` (22.3MB, full 150s).
**Baseline correction:** r7's verify actually COMPLETED at **92.1**
(video_ssim 0.90524, keyframe 0.88861) — the r7 agent died before logging
it, so STATE's old trajectory stopped at r6=92.0. r8's true baseline was
92.1; the round banked +0.3 (video_ssim +0.0036, keyframe +0.0041; color
and duration flat).

Three commits banked (ALL in the r8 render):
- **30aa7713a** PvpRightCity re-trace (S13, from the f2550 two-colour ink
  map): right capsule bg-building top y512 w/ verticals to the front roof,
  front = 4 wide windows (not a 2×4 grid), red tower round-shouldered crown
  + cream band + gate row + legged base + navy-grilled door, right white
  building dash column to the frame edge, truck +25px. Gate (PNG vs r7 mp4
  both vs ref): f2450 .8420→.8584 · f2550 .8441→.8607 · f2650 .8408→.8580 ·
  f2700 .8425→.8596.
- **fc3d43a25** S13 band labels remeasured + left-city red tower. S13 band
  (y0 h57 pxPerHour 285.7, all 7 ticks f2362-2750): hour labels fs30→**42**
  (cap-height 29, was 20), cap-top y72, digit x-start 118, tickBelow 22→45.
  Added `labelDx`/`labelDy`/`labelWeight` props to TimelineBand — defaults
  preserve every other scene. Left temple tower re-traced from the f2550
  red silhouette: body x102-248 (w146), crown box x102-250 y282, inner
  frame x124-228; L window white/red-solid/white, R window cream-top+white
  w/ low divider. Gate (PNG both vs ref, on top of the right-city fix):
  f2450 .8584→.8727 · f2550 .8607→.8751 · f2650 .8580→.8720 · f2700
  .8596→.8735. Cumulative from r7 HEAD f2550 .8441→.8751 (+.031).
- **169e7a692** S10-S12 hour labels fs30→**21** (THIS session — audited the
  dead r8 agent's dirty scenes2.tsx hunk). The S9-S12 band (y88 h40,
  pxPerHour 141.6) rendered hour labels at the default fs30 = 73px-wide
  '07:00'; ref measures **51×15px** (cap-height 15 → Helvetica fs21).
  Dropped `labelSize` to 21 in S10Settle/S11DocsRow/S12Checks. tsc green.
  Render A/B (both vs ref f1950/f2090/f2150): FULL-frame fs21/fs30 .864/.851
  · .994/.980 · .845/.831 (+.013 each); label-strip fs21/fs30 .92-.95 / .69
  (+.24). Validated three ways — pixel measure, eye (strip), metric.

Windows moved (r7→r8 rolling means):
- S13 block: r7's #1 window 2674-2724 .8529 → r8 2687-2737 **.8671** (+.014);
  the entire S13 top-10 cluster (2385-2724) that led r7 dropped out of the
  leaders.
- Docs: 2102-2152 .8533→**.8635**, 2165-2215 .8529→**.8631** (+.010 each,
  the label fix); residual there is doc-interior hairlines (texture).

r8 rolling-window re-rank (global mean 0.9088) — r9 priorities. The board
is a FLAT texture / reference-self-contradiction asymptote (.858-.872); NO
structural bug remains in the top-12:

| rank | frames | mean | scene / cause |
|---|---|---|---|
| 1,7,8,11 | 686-926 | .858-.869 | S5 skyline cruise/entry — tower-interior hand-drawn TEXTURE (re-traced r3/r4/r7; each cluster a distinct window design; refs disagree between views, lesson 3) |
| 2,6 | 584-684 | .860-.865 | S4→S5 zone — S4 trade content pre-whip + entry tiles at 100-300px/f (recycled guesses, identity unreadable; logged spend, r4/r6) |
| 3,9,12 | 3239-3389 | .862-.872 | S17 summary EXIT pan — accelerating left-pan UNMEASURED (interiors done r3; the exit pan is the only measurable lever, do it per-frame like r4 did for S5) |
| 4,5 | 2102-2215 | .863 | S11/S12 doc-interior hairlines (±3-6px; label fixed r8, rest is texture) |
| 10 | 2687-2737 | .867 | S13 tail — residual capsule-interior texture after r8 re-traces |

**Asymptote honesty (lesson 9): ≥96 is WALLING — not reachable by
structural fixes.** color (0.9857/1) and duration (0.9997/1) are near-max,
so the +3.6 to 96 must come almost entirely from video_ssim (0.9088) +
keyframe (0.8927): ~**+0.04 mean SSIM across all 3750f**. The distribution
is already flat (worst windows .858, mean .909) — lifting every top window
to the mean barely moves the mean; you must also lift the .90+ frames,
which are held by hand-drawn-texture micro-registration and the
differently-encoded-mp4 SSIM floor (~.004, encoding trap, lesson 21-note).
r9 board classified: **S17 exit pan = FIXABLE** (measure the per-frame pan;
likely +.005-.01 at the window, sub-hundredth at the score) — the only
measurable structural lever left. **S5 skyline + S13 tail + S11/S12 docs =
HAND-DRAWN TEXTURE / partial reference-self-contradiction** (multi-round
2×-crop grind, sub-hundredth score each). Realistic ceiling with heroic
grind ~93-94; **96 is not reachable.**

### r7 — 2026-07-10 (gen-6 quality session, verify RUNNING at this entry)

Official verify launched (runner `work/cls-day/r7/run-verify.sh`, log
`work/cls-day/r7/verify-out.txt`, artifacts will land at `cls-day-*-r7.*`,
rescue `work/cls-day/r7/attempt-rescue.mp4`). Commits IN the verify:
**14e2cdd37** (serif → Hoefler), **6b0d156bb** (cls-shared record,
comment-only), **d2a963834** (S5 tower re-traces), **8bda40251**
(handshake clasp).

- **SERIF ADOPTED: Hoefler Text (commit 14e2cdd37).** The recorded Times
  lead was REFUTED in-render: the shape A/B normalizes aspect and Pillow
  understates Chromium widths ~7% — Times ships +8.7% (USD) / +23% (JPY)
  wider than the ref's CONDENSED face; S2 f150 fell .907→.9006. An 8-face
  in-render screen picked Hoefler Text (macOS), factors measured on
  rendered ink: baseline = CSS_top + 0.692·fs, capTop = CSS_top −
  0.018·fs, cap = 0.710·fs (data.ts SERIF_CAL; lineHeight 0.93 is part of
  the calibration). Per-settled-pair SET_CAL in scenes1: pair0 fs354
  sx .945/.809 (top/bottom), pair1 DKK/GBP is SMALLER (ref cap 245, fs345,
  botCap 559 not 565) sx .915/.926; plunge codes SER_SX 0.90. Hoefler
  defaults to OLD-STYLE figures — every digit site needs
  fontVariantNumeric lining-nums. Donut % remeasured: fs130→170 + pctDy 16
  (ref ink 144×333 @f1300). The 8.0+ block was rebuilt from f2980 probes:
  red rules y498/y844 h7 w418 @x120 (the unit underline was WRONGLY navy),
  '8.0' fs239 lining (cap 170) @x106, unit fs81 (WAS 30% SMALL at fs62),
  '+' drawn as the measured 9px cross (Hoefler's plus glyph is tiny —
  pack.trillion.sup === "+" branches to rects; CRX "/7" keeps the glyph
  path). Gates (Georgia→Hoefler): f150 .907→**.9274** · f200 .911→.9160 ·
  f230 .931→.9329 · f250 .890→.8983 · f265 .853→.8549 · f285 .963 flat ·
  f1300 ~.933→.9356 · f2980 ~.887→**.9031** · f3650 ~.885→.8871 · f50
  ~.888→.8921. crx-data serif now imports the lane SERIF (factors are
  face-bound). A/B scripts: `work/cls-shared/fontab/day_serif_ab_r7*.py`.
  LESSON FOR CLSNET: its "Georgia lead" is Pillow-based too — screen
  in-render with width before adopting.
- **S5 tower-interior re-traces (commit d2a963834).** Four persistent
  worst-cells fixed from f860 ink-run profiles (ascii maps): ClC left
  building was inverted (navy-block-with-slots → ref is a WHITE body w/ 4
  shelf glyphs y227+15.7k under a roof bar, ticks ON the roof); ClC right
  furniture is a measured L-pipe (rail y236.5 → drop pipe x394 → band +
  thin post x374.5), not the invented y270 bridge-to-452; ClG dashes were
  8, 24px low, 10px left (→ 7 at y201.5+11k x146 w14); ClG right-building
  windows were 3×2 outlines 30px low (→ measured 4-rail band y214.5/226.5/
  240/252 with dividers at 321.5/335.5 + bridge rails y263/y302). Gates:
  f750 .8437→.8508 · f800 .8436→.8495 · f860 .8419→.8504 · f900
  .8435→.8513 (window-wide, not keyframe-local).
- **Handshake clasp re-trace (commit 8bda40251).** White hand redrawn from
  channel-isolated ink plates (f2550): rounded back → cuff, beak palm
  hook, four parallel hooked FINGER strokes reaching into the red knuckle
  chain (old: trapezoid-with-fold + bump chain — the r6 board's
  "eye-visibly different" item). Red hand kept (r3 trace within 2px).
  SSIM flat (~170px glyph); perceptual spend, strips in `/tmp` gates +
  `work/cls-day/r7/att11-f2550.png`. f3650 .8867 flat.
- CrxSettlementDay smoke-checked f150/f2980/f3650 (r7/crx-f*.png) — clean;
  "24 /7" takes the glyph branch of the plus fix.
- NOT reached r7: S13 city-capsule interiors (left bldg = wide slats not
  square grids; red tower gate section differs — evidence
  `/tmp/cmp13.png` reproducible from ref/f2550 vs r7/att-s13-f2550), S11/
  S12 doc hairlines, S5 entry-whip residual.

### consolidation — 2026-07-10 (cross-lane refactor round, COMPLETE, zero visual change)

**RULE FOR SUCCESSORS: shared brand art lives in
`src/compositions/replicates/cls-shared/` — improve it there, once, and
still-gate BOTH lanes (cls-day + clsnet, replicas + CRX cuts) at the
affected frames.** Inventory of what is shared vs lane-measured:
`.claude/rounds/work/cls-shared/INVENTORY.md`.

- Created `cls-shared/{palette.ts,fonts.ts,logo.tsx}`. Moved there: the four
  cross-lane-identical brand hexes (navy #002753, white #FDFDFD, blue
  #4CA0D3, grey #D9D9D9 → `C.navyBg/white/blue/donutGrey` now read
  `BRAND.*`), the Helvetica sans stack (`SANS = HELVETICA`), and the CLS
  logo components ClsMark/ClsLetters/ClsWordmark (verbatim from lib.tsx;
  lib.tsx re-exports them so scenes1/barrel imports are untouched). All
  other palette values measured lane-specific and STAY in data.ts (e.g.
  navyInk #12365E vs clsnet serifNavy #12365B — do not unify).
- GOLDEN GATE: 6 frames (f50/150/550/1300/2550/3650) + CRX smoke
  (f50/2550) rendered before and after — ALL BYTE-IDENTICAL
  (`work/cls-shared/gate/`). tsc green. Comp ids/exports unchanged.
- Serif A/B (netgrowth's Caslon question, measured on THIS lane's own S2
  'USD' crop f150): **Caslon does NOT win — Times New Roman leads** (Times
  0.120 < Caslon 0.148 < Georgia-current 0.175 meandiff). Quality-round
  lead only: adopting Times means re-measuring the Georgia-calibrated S2
  constants (fs349/338, baseline +0.825fs, capTop +0.122fs) and
  still-gating replica + CrxSettlementDay. Numbers + script:
  `work/cls-shared/fontab/`, verdict comment in `cls-shared/fonts.ts`.
- Gen-6 note: clsnet still renders the CLS mark from its own potrace
  traces (art.ts logoMark/clsLogo). The high-fidelity logo re-trace must
  land ONCE in cls-shared/logo.tsx and both lanes rewired to it.

### r6 — 2026-07-10 (gen-5 inheritor session, COMPLETE)

**Official verify: SCORE 92.0** (raw 92.02) — video_ssim 0.9045 (40%) ·
keyframe 0.88747 (35%) · color 0.9855 (15%) · duration 0.9997 (10%).
Trajectory 89.8 → 91.0 → 91.4 → 91.8 → 92.0 → **92.0** (raw +0.01; the
r6 round's single fix was 14 frames wide — window-level win, score-level
hair). Artifacts `cls-day-*-r6.*`; log `work/cls-day/r6/verify-out.txt`;
VALID rescue `work/cls-day/r6/attempt-rescue.mp4` (the runner now pins
the attempt PID from the verify log — the r5 watcher globbed a leftover
SIBLING attempt, so r5's rescue was deleted as invalid; r5 A/Bs are PNG
stills in `work/cls-day/r5/`).

r6 rolling-window re-rank (global mean 0.9045) — NEXT round priorities.
The board is now a FLAT texture asymptote (.8526-.8613); no structural
bugs left in the top-12:

| rank | frames | mean | scene / cause |
|---|---|---|---|
| 1,7,8 | 772-926 | .8526-.8595 | S5 cruise — tower-interior texture: ClB chips/neighbor grid, ClC/ClG interiors, grey shadows (r4 evidence work/cls-day/r4/grid/f860-cmp-*; ClB stripe grid + label sizes already fixed) |
| 2,6,9,10,11,12 | 2385-2724 | .8526-.8613 | S13 — city capsule interiors + PILL HANDSHAKE GLYPH (eye-visibly different from ref clasp; chips fixed in r5) |
| 3,4 | 2102-2215 | .8529-.8534 | S11/S12 — per-line doc interior hairlines (±3-6px; grind) |
| 5 | 665-715 | .8578 | S5 entry whip residual — f676-690 (post-cut tile texture at 100-300px/f; transition itself fixed, f664-673 now .855-.869) |

Old window 1 (663-713, .8384) cleared: the S4→S5 transition fix moved
its frames to .855-.878. WARNING for successors: scores 92.0 → 95 now
require ~+.02 mean SSIM across EVERY remaining window — hand-drawn
texture tracing at 2x crops, several rounds of grind; no more cheap
structural wins are visible in the data.

- **S4→S5 measured transition (commit 6d8d772dc).** The r5 re-rank's #1
  window (f663-713 .8384) hid the worst single frame in the video: f672
  PNG .494. The ref never hard-cuts at f674 — from f661 the shared band
  DESCENDS (y96→325@673; S5's entry LUT picks it up at 376@674) while
  the hour axis whips left and STRETCHES (pitch 142.3→235, per-frame
  tick probes f656-673 in `work/cls-day/r5/cutzone/`), the marker rides
  its hour off the left edge, and the S5 world (white/navy fields +
  scaled tick chains) wipes in behind a measured front (1858@667→0@673).
  S4's diagram content dies behind the front. New `S4ExitBand` +
  front-clip on S4 content; band styling mirrors TimelineBand exactly
  (first attempt regressed by omitting tick tails — mirror the lib
  component when replacing it). PNG gates (old→new): f668 .741→**.814**
  · f670 ~.77→**.822** · f672 .494→**.878** · f673 →.865 · f666 .838.
  S4 pan verified constant -1.33px/f through f650 (model was right;
  the whip begins ~f660). NOT modeled (logged spends): mini pre-world
  towers riding the band f667-673 (only ticks/fields), ref's S4-remnant
  oddities at f672 (a "ted" text fragment at y~865).
- CrxSettlementDay smoke clean at f670 (audit-crx-f670.png).

### r5 — 2026-07-10 (gen-5 inheritor session, COMPLETE)

**Official verify: SCORE 92.0** — video_ssim 0.9043 (40%) · keyframe
0.8875 (35%) · color 0.9855 (15%) · duration 0.9997 (10%). Trajectory
89.8 → 91.0 → 91.4 → 91.8 → **92.0**. Artifacts `cls-day-*-r5.*`;
runner log `work/cls-day/r5/verify-out.txt`. Verify runtime only ~28
min with the slim pubdir (render ~9 min at concurrency 1).

r5 rolling-window re-rank (global mean 0.9043) — r6+ priorities:

| rank | frames | mean | scene / cause |
|---|---|---|---|
| 1 | 663-713 | .8384 | S4→S5 cut zone — FIXED in r6 (see above) |
| 2,7,11 | 775-926 | .8525-.8597 | S5 cruise — tower-interior texture (ClB chips/neighbor grids, ClC/ClG interiors); label-size fix banked |
| 3,6,8,9,10,12 | 2385-2724 | .8526-.8613 | S13 — city capsule interiors + pill handshake glyph (chips fixed in r5) |
| 4,5 | 2102-2215 | .8528-.8532 | S11/S12 — per-line doc interiors (±3-6px hairlines; low yield/effort) |

S2 (f222-272) is GONE from the top-12 — the r5 rebuild banked (+.08 at
the f250 keyframe). Worst r5 keyframes: t=10s .885 (was .799!), t=4s
.868 (S2 wipe tail), t=84-88s .824-.829 (S11/S12), t=28-36s .829-.838
(S5 block).

Re-rank from r4 framessim confirmed the handoff order exactly (S5 skyline
windows 1/2/4/7/9 at .832-.856, S11/S12 .851, S13 .852-.858, S2 .858).
Commits: **1237a38e2** (S2 carousel measured rebuild), **20d4265f6**
(S13 chip schedule), **970947072** (S5 label/tick sizes — gates f750
.836→.839, f860 .833→.837), **9cf644652** (ClB pinstripes to measured
grid — f750 →.844). dbf9998b0 (focus-doc, post-r4-verify) also banked
in this run. All four commits were IN the verify.

- **S2 carousel measured rebuild (commit 1237a38e2)** — the f222-272
  window (.858, worst keyframe f250 .799) had THREE wrong grammars:
  1. Late pairs PLUNGE vertically into the ruler (converge from top/
     bottom edges, swallowed by the line, NO settle) — 6 plunge pairs
     f230-283 on per-frame baseline LUTs (tracked ink f225-300 at 1f);
     bottom codes mirror the top about y1081. Pair schedule: AUD/CHF
     f230, HKD/NZD f238, KRW/EUR f247, EUR/GBP f255, GBP/DKK f262,
     HKD/AUD f266, KRW/EUR f271; x anchors drift left off-frame
     (189→168→146→sliding out; LUTs per pair). CURRENCY_PAIRS extended
     to 9 entries (data.ts + crx-data.ts mirrored).
  2. Serif recalibrated on RENDERED ink vs ref: ref cap 251px settled
     (STATE's old "223" was wrong) / 242 plunging → fs 349/338;
     placement: baseline = CSS_top + 0.825fs, capTop = CSS_top +
     0.122fs (old model rendered 11% small, 19px high top, 30px low
     bottom). Settled pair anchors: USD/JPY x325/419; DKK/GBP drifts
     x234-1.55(f-190) and is swallowed f224-230 on a measured LUT.
  3. Chips: early phase is a FIXED lattice (rows 254..877 identical at
     f150/f220, occupancy/color blink mid-hold; w129 h58 pitch ~78 —
     old model w112 h71 pitch 80 x1317/1507 was wrong even settled);
     the whole assembly drifts left ~1.5px/f (codes, chips, ticks);
     stack drains INTO the line f227-236; then a pitch-150 funnel
     converges at ±48px/f (anchored to the measured f250 inventory),
     columns riding a measured x LUT off-frame by f283. Band ticks are
     49.5px pitch (code had 22); tick grid phase drifts; whole band
     DESCENDS f254-306 (measured hairline LUT 535→772@f290) stretching
     (pitch →125.6@f288, stretch fixed-point x≈-428) into the S3 dock;
     S3 globe docks from top-right at scale 0.77 (measured f285),
     mount 288→283.
  PNG gates (old→new): f150 .878→.907 · f200 .850→.911 · f250
  .808→**.890** · f265 .837→.853 · f285 .883→**.963**; f230 .931 ·
  f240 .897 · f260 .898 · f270 .873 · f275 .874. Measurement artifacts:
  `work/cls-day/r5/s2ref/` (per-frame f225-300), `track_s2.py`.
- **S13 chip schedule (commit 20d4265f6)** — per-frame identity
  tracking f2490-2735 (`work/cls-day/r5/s13ref/`; NOTE files f2490-2538
  are 5f-SAMPLED with consecutive names: file 2490+k = ref 2490+5k;
  f2539+ are true per-frame): the rails run FOUR waves ~62f apart
  (t0 2510.6/2572.5/2634.8/2696.6), each a triplet per rail — top
  cream/cream/red leftward, bottom grey/navy/grey rightward, in-wave
  offsets ~0/+9.3/+20.2 (bottom −0.7/+8.8/+19.3); chips ease out of
  the pill (offsets 0/10/21/39/63 then 27px/f from base x942) and are
  ABSORBED into the rail arrows (leading edge freezes x393/x1503, chip
  compresses). Old model (4 lone chips at 7.2px/f) deleted. PNG gates:
  f2600 .8436→.8480 · f2650 .8443→.8466 · f2700 .8477→.8480 · f2550
  flat. The "red chip" at bottom right f2490-2535 in the r4 masks is
  the right city's street TRUCK driving in and parking — not modeled
  (logged perceptual spend, ~100x50px).
- CrxSettlementDay smoke clean on rebuilt S2 (r5/audit-crx-f250.png).
- S11/S12 doc interiors inspected (ref vs att at f2150): outer geometry
  and all 8 doc designs match at eye level; residual is many ±3-6px
  hairline placements — low yield per effort, left for r6+. NOTE:
  scripts/ssim-grid.py output at f2150 read as distortion-like values
  (cell 0.05 on visually-identical cells) — do not trust it blind here;
  ffmpeg full-frame SSIM is the record.

### r4 — 2026-07-10 (gen-4 inheritor session, COMPLETE)

**Official verify: SCORE 91.8** — video_ssim 0.9016 (40%) · keyframe
0.8839 (35%) · color 0.9854 (15%) · duration 0.9997 (10%). Trajectory
89.8 → 91.0 → 91.4 → **91.8**. Artifacts `cls-day-*-r4.*` in this dir;
runner log `work/cls-day/r4/verify-out.txt`; rescued render
`work/cls-day/r4/attempt-rescue.mp4` (full 150.06s, intact).
Commits: 995480d94 (S5 camera + S6 arrival), 13f1ae829 (S6 doc-phase),
dbf9998b0 (focus doc — landed AFTER the verify snapshot, its ~+0.03
banks in r5's verify).

r4 rolling-window re-rank (global mean 0.9016) — r5 priorities:

| rank | frames | mean | scene / cause |
|---|---|---|---|
| 1,2,4,7,9 | 665-926 | .832-.856 | S5 skyline — now TEXTURE not position: tower-interior micro-registration (ClB chips/pinstripes/neighbor grids, f860-diff evidence in r4/grid/f860-cmp-*), whip-zone tile designs are recycled guesses |
| 3,5 | 2102-2215 | .851 | S11/S12 — focus-doc fix already committed (gates .823→.831); rest = per-line doc interiors |
| 6,8,10,12 | 2495-2723 | .852-.858 | S13 PvP — chip schedule murky at 20f sampling (r4/ref/f2500-2720 extracted; needs 5f sampling + identity tracking), cluster interior texture |
| 11 | 222-272 | .858 | S2 late carousel (finding below — grammar bug, high yield per frame) |

Worst keyframes r4: t=10s .799 (S2 f250) · t=84/86/88s .822-.826
(S11/S12) · t=28-36s .825-.829 (skyline block).

Re-ranked from r3 framessim: skyline block STILL led (windows 1-5,
f667-936, .79-.85), then S11/S12 (f2102-2215 .851), S13 PvP (f2495-2723
.852-.858), S2 (f222-272 .858) + hidden keyframe block S6-doc t=42/44/46s
(.8125-.8142).

- **S5 measured camera (commit 995480d94).** Tick-tracked the ref pan
  per frame (work/cls-day/r4/track_pan.py + direct tick scans): the old
  linear x9 model was wrong THREE ways. (1) ENTRY f674-684: the cut lands
  zoomed out (pitch 255.5, band 377-447) showing hours 02-08, then whips
  left ~1800px decelerating (x09: 1998→1403→913→626→469→400) while the
  world zooms to rest — added sx/sy/riseC/x9 entry LUTs + left tower
  tiles (recycled designs; identity unreadable at 100-300px/f).
  (2) CRUISE was -1.54px/f, measured -1.596 (10px drift @f860) — now
  piecewise through measured points 690/750/800/850/896/916.
  (3) EXIT f916-930: the band whips left AGAIN (09:00 +25.5@916 →
  -1097@928, hours pan 10:00→24:00 into S6's 00:00@293) with NON-uniform
  shrink (pitch→0.66, height→0.635). Above-band S5 chain dies behind a
  measured front; passed ticks repaint white above the sweep (sweep moved
  from S6 into S5 for z-order); below-band mirror chain survives to f933.
  Gates: f680 .691→.826 · f700 .792→.836 · f800 .788→.836 · f860
  .777→.833 · f900 .785→.836 · f920 .746→.834 · f676 .808 · f684 .841.
- **S6 arrival rebuild (same commit).** Found a zero-height clip-wrapper
  bug that had hidden the ENTIRE S6 band f929-940 since r2 (clip-path
  inset() on an unsized div clips everything — wrapper must be a
  full-frame box). Band now rides the S5 morph via measured transform;
  big text rebuilt at TRUE size (fs308 — r1's 130 was half the ref;
  measured digits 355-1112 × 626-848) with measured arrival (h228→206,
  cap-top 754→635, clipped at the 00:00 line) and exit sliding INTO the
  line clip (right edge 1105@990→361@1000; old easing was wrong); red
  00:00 line grows 641@930→913@936 then SNAPS to band-tick height at
  f938 (settled state has NO long line — r1's "to y445" was wrong, probed
  f950/f1000 = rows 152-207 only); 06:30 preview re-measured (WHITE fs40
  label sliding 1811→1602, tick 1691→1586 riding band y, red drop line
  f938-944). Gates: f928 .908 · f930 .907 · f934 .896→**.910** ·
  f938 .873→**.908** · f950 .897→**.911** · f970 .897→**.911** ·
  f1000 .910→.915 · f995 .903 · f1005 .911.
- CrxSettlementDay smoke clean on rebuilt S5/S6 (r4/audit/crx-f700,
  crx-f934).
- **S6 doc-phase camera push (commit 13f1ae829).** The t=42/44/46s
  keyframe block sat at .81 because the settled doc phase was never
  measured: ref pushes in f1002-1020 (band pitch 199→244.75, band top
  152→-9.4 off-screen, 00:00 tick →x304) and the red 00:00 line regrows
  from tick-height to the DOC BOTTOM (y931, full height, x304-308).
  Preview label+drop-line exit f997-1002. Gantt fills cascade
  left→right f1058-1075 w/ 6-9f ramps (old: binary pops out to f1111).
  Gates (r3→now): f1005 .897→.931 · f1010 .819→.911 · f1015 .812→.928 ·
  f1050 .814→**.924** · f1100 .813→**.922** · f1150 .814→**.923**.
- All r4 measurement artifacts in `work/cls-day/r4/` (pan_lut.csv,
  panref/ dense ref frames 674-946, att2-att10 gate stills, grid/).
- NOT reached in r4 (next priorities, with findings):
  1. **S2 late carousel f200-300** (window .858, keyframe f250 .799):
     ref f250 = a SINGLE settled KRW/EUR pair with left edge ≈x150 —
     ~185px LEFT of the modeled x335 anchor — while our comp shows two
     pairs mid-crossfade. The accelerating phase drifts the whole
     assembly (codes + chip columns) leftward and the pair schedule is
     wrong (STATE's "AUD/CHF, HKD/NZD, EUR/GBP" list does not match; KRW
     appears at f240-255). Needs per-frame code reading f180-300 (ref
     frames already in work/cls-day/r4/ref/) + chip-column x tracking.
  2. S11/S12 f2102-2215 (keyframes .822-.826): doc OUTER geometry is
     ±4px correct (probed f2150) — remaining deficit is per-line INTERIOR
     misregistration + the focus doc's stacked-page design (one offset
     page behind, not three side tabs). Exacting 2x-crop tracing.
  3. S13 PvP f2495-2723 (.852-.858): chip schedule densification
     (only 2 waves modeled — probe f2560-2690), cluster interiors.
  4. S17 hex interior exact tracing (from r3).

### r3 — 2026-07-09 (gen-3 inheritor session, work phase)

Worst-first from the r2 triage. Commits d2a887ad4 (skyline) + c4e14d48a
(PvP). Official verify: RUNNING at session end of this entry — artifacts
will land at `cls-day-*-r3.*`; runner log `work/cls-day/r3/verify-out.txt`;
attempt rescue `work/cls-day/r3/attempt-latest.mp4`.

- **S5 skyline per-tower tracing (f619–946, r2 windows 1–5 at .767-.789).**
  Replaced the two invented Buildings2 variants with SEVEN distinct traced
  clusters (2x crops in `work/cls-day/r3/crops/`): above A@-152 B@452
  C@1060 G@1657 (G is a 4th design — the cycle does NOT repeat A,B,C),
  below E@-691 D@-88 E@519 F@1115 (world center x, slot svg 604x330).
  The 21:00 zone (world 1721+) measured EMPTY — phantom D-reuse deleted.
  r1's floating $/€ docs were INVENTED persistents (ref sky is clean);
  replaced with the measured doc lifecycle: docs pop from tower tops and
  rise at 33.75px/f, world-fixed x — B@f747, C@f799, G@f851 (probes in
  `work/cls-day/r3/docprobe/`). r1's "dome" on the B tower was actually
  the rising doc's silhouette — replaced with the true step-roof (f900).
  Tick tops extended 215→172 (measured). Gates (pre-r3 → post):
  f690 .775→.797 · f750 .776→.836 · f820 .760→.799 · f900 .754→.796.
- **S13 PvP traced rebuild (f2401–2722, r2 windows 6–11 at .832-.840).**
  The r2 model (mirrored generic hexagons + full-width rails + crawling
  chips) was wrong. Measured f2450/f2550/f2700: capsules are FIXED and
  ASYMMETRIC (left top y222/bottom y690, vertex 497,455; right top y390/
  bottom y855, vertex 1428,622); the rail is an S-path from the pill
  (top arc → leftward arrow at x415 y290; bottom arc → rightward arrow at
  x1465 y770); chips SPAWN AT THE PILL and travel outward ~7.2px/f
  (red/cream leftward on top, slate rightward below; anchors red@480 and
  slate@1412 at f2550, cream@897 and slate@1007 at f2700). Both city
  interiors traced per-building incl. street level (truck/car/bollards/
  posts/sheds, grounds y660 left / y825 right). HandshakePill re-shaped
  to the chip leaf (TL+BR r~57, TR+BL 8) and IconHandshake redrawn from
  the ref clasp — glyph is shared with the end card; f3650 gate .888
  (unregressed). Gates (pre → post): f2450 .820→.847 · f2550 .820→.850 ·
  f2650 .818→.844 · f2700 →.847.
- **S11 docs row measured relayout (f2108–2208, commit 113d4db99).**
  Ref f2150==f2200 (row static, no slide): 6 regular docs 228x285 at
  y390 (3 navy + 3 red/cream, seals lines/square/circle/triangle) +
  2-page focus doc 355x457 at (750,288) w/ side tabs. Fill colors
  probed = chipGrey/chipCream. Gates: f2150 .823→.828, f2200 →.828
  (metric saturates on fine line art; position now correct).
- **S17 summary corrections (f3239–3389, commit 6838b83ad).** Connector
  flow was INVERTED — ref flows out of the shield (legs y814, verticals
  x512/1408) UP into the hexes, arrowheads up; pill 335→245 w/
  logoScale 0.425 (wordmark overflowed the pill); doc sheet behind pill
  sized to the measured peek; dash slate (label stays blue); milestone
  ticks rise above the band (y56); shield h→310; icons 44→54 @x790;
  hexes densified via opt-in `dense` prop on Buildings/HexCity (S4
  unaffected, f550 .872 no-regression gate). Gates: f3300 .8557→.8573,
  f3350 .8487→.8509. NOTE: the r3 official verify's render snapshotted
  the tree BEFORE the second S17 batch (logoScale/icons/dense —
  ~+0.01 score) — that sliver lands in a future r4.
- CrxSettlementDay smoke stills clean on the rebuilt scenes
  (`work/cls-day/r3/audit/crx-f2550.png`, f930/f3450 earlier).
- NOT reached this round (next priorities, from r2 triage): S2 carousel
  f172–272 (.858-.870), S6 doc interior f1011–1164 (.859-.867), PvP
  chip schedule densification (only 2 waves modeled — probe f2560-2690
  for more), S17 hex interior exact tracing.

### r3 audit — 2026-07-09 (gen-3 inheritor session)

Predecessor died on a session limit with the ENTIRE r2 diff uncommitted
(HEAD was still r1 907a27545). Its r2 verify completed post-mortem:
**SCORE 91.0** — video_ssim 0.8920 (40%) · keyframe 0.8734 (35%) ·
color 0.9857 (15%) · duration 0.9997 (10%). Artifacts:
`cls-day-{verify,keyframes,framessim}-r2.*` in this dir.

Dirty-tree audit (hunk-by-hunk, tsc green, still-gated): ALL KEPT,
nothing reverted, landed as commit **2e904d9fe**.
- data.ts scene retunes + lib.tsx Donut bgSweep — verified by the 91.0 run.
- S6→S7 zoom retune (post-verify, unbanked): gated f1158 .882 / f1166
  **.920** (was .84 in the verify) / f1172 .967. Predecessor's claim
  confirmed exactly. Gain lands in r3's verify.
- S5 skyline scale/phase fix (post-verify): gated f750 .776 / f820 .760 /
  f900 .754 — matches the r2 log, still below r1's .79-.80. KEPT as
  perceptual spend (honest grammar; r3 per-tower platform).
- CrxSettlementDay still renders clean on the rebuilt scenes (stills
  f930/f3450, `work/cls-day/r3/audit/crx-*.png`).

r2 rolling-window triage (fps25, 2s, global mean 0.8920) — r3 priorities:

| rank | frames | mean | scene / cause |
|---|---|---|---|
| 1-5 | 669-919 | 0.767-0.789 | S5 skyline block — worst by far; per-tower tracing |
| 6-11 | 2401-2722 | 0.832-0.840 | S13 PvP — cluster interiors + chip runs |
| 12-13 | 2108-2208 | 0.847-0.851 | S11 docs row / S12 checks — generic doc designs |
| 14 | 222-272 | 0.858 | S2 carousel later pairs |

r1's top windows (outro gauge, S5→S6, S6→S7, outro→endcard) are all
gone from the top-14 — the r2 rebuilds hold.

### r2 — 2026-07-09 (inheritor session)

Worst-first, per-frame-measured rebuild of every r1 priority window.
All measurement artifacts live in `work/cls-day/r2/` (outro_measure.csv +
measure_outro.py = per-frame band angle/pivot/gauge/chips tables; seq/ =
dense ref frame pulls; att2/ = still gates).

- **S18 outro REBUILT from scratch (f3394..3561).** The ref is one rigid
  world rotation: band sweeps 0→90° (navy plate slides in along it, split
  shield rides it), reverses 90→0 (navy lands on top, gauge slides in
  decelerating), red wedge sweeps 0→180° (measured per frame), holds, then
  the world rotates a further 180° with damped-pendulum settle
  (θ overshoots to 191.9°, trough 172.9°, settles 180 @f3548) while the
  chip flock glides in (L-path: drop then leftward glide, baked from red
  centroid), then the world rises off into the f3561 cut. ALL curves are
  measured per-frame LUTs in scenes2.tsx — do not replace with easings.
  Still gates: f3410 .982 · f3425 .938 · f3450 .974 · f3475 .978 ·
  f3505 .954 · f3530 .938 · f3550 .981 (r1 window means were .696-.81).
- **S17 exit (f3372..3393):** accelerating left pan + band drop toward the
  outro pivot (bands hands off to S18 at f3394 wall). Gates: f3388 .827,
  f3392 .934.
- **S5→S6 seam (f896..946):** replaced r1's crossfade with the measured
  rise+shrink (band 490→152, h85→54, scale .635 about the band center),
  city ink fade f924..930, vertical navy edge sweeping right→left above
  the band (probed per frame), S6 grid+red line panning in from the right
  (x630@930→x293@940) with a left clip at the arrival front.
  Gates: f925 .79 · f930 .91 · f935 .86 (r1 window .751).
- **S6 doc remeasured:** the schedule doc is (310,260) 966×671 (NOT
  1032,645 400×425 as r1 had it — that killed keyframes f1050/f1100);
  bars at measured rects, last bar double-height.
- **S6→S7 seam (f1141..1191):** replaced fade with the measured zoom into
  the doc's last blue bar (scale 1→26, focus 1016,755, blue-area-fitted
  LUT); S7's blue field IS that bar. Gates: f1158 .89 · f1166 .84 ·
  f1172 .96 · f1180 .98 (r1 window .779).
- **S7 donut remeasured:** ring draws in at (958,517) f1170..1188
  (bgSweep prop added to Donut), slides right to (1352,517) f1192..1212;
  outer R 355 thick 131; one icon circle r237 @(511,511) then two r150
  @(516,313)/(515,721); dashed connectors DELETED (ref has none).
  Gate: f1300 .935 (r1 anchor .850).
- **S1/S2 wipe rebuilt:** the card exit is a SLASH — a slit opens at x~975
  (edges probed per frame f107..117, lean ~14°) splitting the static card
  in two clipped copies, while the S2 ruler line rises steeply from the
  bottom-right and levels onto y534 (measured y/rot LUTs) with the white
  world glued below it. Currency carousel grammar fixed: codes PAN IN from
  the right (USD @x1730 f121, settle f129) and COLLAPSE INTO the ruler on
  exit (top sinks, bottom rises, clipped at the strip). Gates: f105 .82 ·
  f116 .90 · f118 .96 · f121 .96 · f125 .91 · f162 .89 (r1 f105-121 were
  .57-.67).
- **S13 PvP:** chip runs re-measured — chips CRAWL left→right on the top
  rail (~0.9px/f, cream+red pair from f2505 + later single, NOT r1's 18px/f
  6-chip ping-pong), one chip descends the center line into the pill;
  right cluster carries a cream tower + denser interiors. Gate: f2600 .82.
- **S5 skyline rebuilt (mixed result):** ornate towers traced from f750
  (centers 134+610k, scale 1.28, red kept in the mirrored world, mirrors
  flip in place at 431+610k). Gates: f750 .776 · f820 .76 · f900 .75 —
  BELOW r1's .79-.80 despite honest grammar: the metric prefers r1's
  sparser wrong ink over denser near-miss ink. Texture-level per-tower
  tracing is the r3 lever (each ref cluster has a DISTINCT window design).
  NOTE: the r2 official verify rendered BEFORE the scale/phase fix (it
  includes the mirror-visibility + red-accent state, f750≈.78).

### r1 — 2026-07-09 (previous session)

- Built the whole 19-scene composition from scratch (commit 907a27545,
  9 files, ~2550 lines): data/lib/scenes1/scenes2/replicate/side-by-side/
  crx pack + comp, barrel wired.
- Blind-skeleton anchor SSIMs: 0.80–0.90. After first calibration batch
  (band y/h/pitch/pan per scene, brackets geometry, summary layout,
  marker sizes 60/90, currency serif + chip stacks, S6 static band +
  text slide, S8 zoom phases):
  f150 0.878 · f550 0.872 · f750 0.800 · f1000 0.938 · f1300 0.850 ·
  f2450 0.824 · f2900 0.931 · f3300 0.856 · f3650 0.889.
- Official verify r1 (after one sibling-tsc-red retry — netgrowth lane
  was mid-edit; the retry loop in this file's "Verify" note handles it):
  **SCORE 89.8** — video_ssim 0.8775 (40%) · keyframe 0.8562 (35%) ·
  color 0.9840 (15%) · duration 0.9997 (10%). Artifacts:
  `.claude/rounds/cls-day-{verify,keyframes,framessim}-r1.*`; rescued
  attempt render: `.claude/rounds/work/cls-day/r1/attempt-latest.mp4`.
- CrxSettlementDay smoke-tested (stills f60/f2900): CRX lockup + Diatype
  + CRX copy render correctly on the shared choreography
  (`work/cls-day/crx-check.png`).

## r1 worst rolling windows (2s, fps25, global mean 0.8775) — r2 priorities in order

| rank | frames | t(s) | mean | scene / cause |
|---|---|---|---|---|
| 1 | 3445–3495 | 137.8–139.8 | 0.711 | S18 outro gauge+wedge — choreography invented, measure ref f3450–3560 |
| 2 | 896–946 | 35.8–37.8 | 0.751 | S5→S6 transition (skyline exit / navy arrival) |
| 3 | 1141–1191 | 45.6–47.6 | 0.779 | S6→S7 transition (doc finish / blue arrival) |
| 4 | 3517–3567 | 140.7–142.7 | 0.784 | S18 end → endcard cut |
| 5–9 | 668–946 | 26.7–37.8 | 0.785–0.805 | whole S5 skyline block: building silhouettes too sparse/thin, cut-in at f674 |
| 10 | 67–117 | 2.7–4.7 | 0.836 | S1 icons reveal + wipe timing |
| 11–12 | 2499–2722 | 100.0–108.9 | 0.837 | S13 PvP chip runs (timings unmeasured) |

Fix order for r2: S18 outro (measure + rebuild, biggest deficit), S5
skyline buildings + entry, the two transitions around S6, S1 intro
timing, S13 chips. Then re-verify; expect ≥91.

## Further gaps (beyond the windows)
2. Skyline buildings (f674–940, anchor 0.80): building clusters too sparse
   / thin vs ref's ornate towers; ref alternates distinct silhouettes.
   Worth a dedicated Buildings2 pass measured from ref/f750.png crops.
3. PvP scene (f2450 anchor 0.824): cluster interiors (tram/car details,
   denser windows), chip run timings unmeasured (sample red/grey chip
   positions per frame), pill handshake icon proportions.
4. Globe scene f300–460 (unmeasured beyond layout guess): ring tick count,
   time label placement/rotation, continent shapes, padlock geometry,
   marker position. Measure ref frames f320/f380/f440.
5. Donut scene (f1300 anchor 0.850): icon circle contents, dashed
   connector routing, donut ring radii (measure ref/f1300), % font
   (serif) size/position, marker gap at ring top.
6. Currency serif face: Georgia vs ref — try 'Times New Roman', STIX;
   gate on f150/f200 stills.
7. Intro reveal choreography f0–100 (mark draw-on is a guess; ref may
   draw the swirl with rotation/stroke reveal — step frames 0–100).
8. S9 zoom-times sweep (f1700–1837) invented; measure the giant label
   positions at f1750/f1790.
9. Docs row / checks scenes (f2075–2362): doc designs are generic; read
   ref/f2150, f2300 for per-doc header blocks and check positions.
10. Outro gauge (f3440–3561): needle sweep + wedge angle unmeasured.
11. CrxSettlementDay: renders but never eyeballed — render stills at
    f50/f1000/f2900/f3650 and check Diatype/lockup layout; copy is in
    crx-data.ts, iterate wording freely.
12. Consider `magick compare` grid triage per window:
    `python3 scripts/ssim-grid.py ref.png att.png --grid 8x6 --top 10`.

## Working files

- Ref anchors: `.claude/rounds/work/cls-day/ref/f*.png` (33+ frames).
- Attempt stills: `.claude/rounds/work/cls-day/att/f*.png`.
- Strips (ref|att): `.claude/rounds/work/cls-day/strip*-f*.png`.
- Analysis dump (frames every 0.5s): `.claude/rounds/work/cls-day/analysis/frames/regular_NNNN.png`
  (regular_N = t=(N−1)·0.5s). scene_changes.csv is EMPTY (the analyze
  script's motion phase collided with sibling lanes on fixed /tmp names —
  do your own probes; the per-scene numbers above are all independently
  measured).
- Contact sheets of the whole video: `sheet1..7.png`, `sheet-s2.png`.

## Score trajectory

- r1 official: **89.8** (video_ssim 0.8775 · keyframe 0.8562 · color 0.9840
  · duration 0.9997).
- r2 official: **91.0** (video_ssim 0.8920 · keyframe 0.8734 · color 0.9857
  · duration 0.9997). Verify rendered before the S5 scale/phase fix and the
  S6→S7 zoom retune — those gains land in r3.
- r3 official: **91.4** (video_ssim 0.8963 · keyframe 0.8776 · color 0.9860
  · duration 0.9997).
- r4 official: **91.8** (video_ssim 0.9016 · keyframe 0.8839 · color 0.9854
  · duration 0.9997). Verify rendered before the focus-doc re-trace
  (dbf9998b0) — that gain lands in r5.
- r5 official: **92.0** (video_ssim 0.9043 · keyframe 0.8875 · color 0.9855
  · duration 0.9997). S2 rebuild + S13 chips + S5 labels/stripes + focus doc.
- r6 official: **92.0** (raw 92.02; video_ssim 0.9045 · keyframe 0.8875 ·
  color 0.9855 · duration 0.9997). S4→S5 measured transition — old worst
  window cleared; remaining board is flat texture (.853-.861).
- r7 official: **92.1** (video_ssim 0.90524 · keyframe 0.88861 · color
  0.98575 · duration 0.99972). Serif→Hoefler + S5 tower re-traces +
  handshake clasp. VERIFY COMPLETED but never logged (r7 agent died) —
  recovered from `work/cls-day/r7/verify-out.txt` during the r8 audit.
- r8 official: **92.4** (video_ssim 0.90881 · keyframe 0.89273 · color
  0.98566 · duration 0.99972). S13 right/left-city re-traces + S13 band
  labels fs42 + S10-S12 band labels fs21. +0.3 over r7. Board is now a flat
  texture asymptote (.858-.872); ≥96 walls (see r8 round log).

## r3 official verify — logged by orchestrator (2026-07-09 23:50)

- **SCORE 91.4** (video_ssim 0.8963 ·40% / keyframe 0.8776 ·35% / color 0.9860 ·15% / duration 0.9997 ·10%). Trajectory 89.8 → 91.0 → 91.4. Freshness confirmed (differs from r2 across components).
- The gen-3 agent died on a session limit AFTER committing everything: r2 audit keepers (2e904d9fe) + four r3 commits (d2a887ad4 skyline per-tower traces, c4e14d48a PvP traced rebuild, 113d4db99 docs row relayout, 6838b83ad S17 summary corrections). Tree clean at death; artifacts `cls-day-{verify,keyframes,framessim}-r3.*` copied by its runner.
- Next inheritor: re-rank windows from `cls-day-framessim-r3.txt` (`scripts/rolling-ssim.py --fps 25 --window-sec 2 --top 12`) — the r2 worst blocks (skyline, PvP, docs, S17, outro) were all attacked in r3; find what leads now before touching anything.
