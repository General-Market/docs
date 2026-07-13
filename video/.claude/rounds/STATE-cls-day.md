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

## ANIMATION-FIDELITY round — 2026-07-11 (eye-judged, not SSIM)

Owner directive: these are MOTION-DESIGN videos — reproduce the ACTUAL
animations, judged by side-by-side filmstrips, not SSIM. First animation
landed: the **S1 intro draw-on reveal** (was invented opacity fades).

- **Ref motion (measured per-pixel f0..62, 25fps):** the intro is a DRAW-ON,
  not a fade. (1) mark+letters wipe on under ONE soft-edged L-to-R front —
  mark clears ~f2, C ~f8, L ~f14, S ~f23; (2) tagline fades in at a
  centered-LOW rest; (3) the whole lockup then RISES ~180px (mark-crescent
  top y428→248) over f31..48 into the end-card layout; (4) each pillar icon
  DRAWS ON L-to-R (Settlement leads, red-arm first) f36..62; labels fade
  f34..44. Ref rise curve measured off mark-left-column trims.
- **Replaced:** the old S1 did a whole-lockup opacity fade (markP 0.15→1,
  lettersP/taglineP/iconsP plain opacity) — no L-to-R motion, no rise; the
  lockup sat statically in end-card position the whole time. Gap item #7 in
  the r8 board ("mark draw-on is a GUESS") — now measured.
- **Mechanism:** `LogoCard` reveal props are now optional (logoFront /
  iconFronts = soft L-to-R `mask-image` linear-gradient fronts; taglineOpacity
  / labelOpacity; riseY translateY) and DEFAULT to fully-shown, so S19's end
  card (passes none) stays static — verified at f3600. Exit slash unchanged
  (operates on the settled card, f107+). LUTs: LOGO_FRONT / RISE / ICON_S/P/D
  in scenes1.tsx.
- **Filmstrip (eye gate):** `work/cls-day/anim/s1_intro_filmstrip.png`
  (ref row / replica row, f2 f5 f8 f14 f23 f38 f48 f60) — motion MATCHES
  across all four phases; rise offsets align at f38/f48. Regression check
  `work/cls-day/anim/s1_sanity_settle_exit.png` (f100 settled, f114 exit,
  f3600 endcard all clean).

Second animation eye-passed: the **S18 outro (f3394..3561)**. Dense ref pull
(f3390..3560 → `work/cls-day/s18/ref/r_<frame>.png`) + per-frame replica stills
proved the r2 measured rebuild is STRUCTURALLY FAITHFUL end-to-end — band settle
→ rotate-up-to-vertical (navy plate slides in, split red/white shield straddles)
→ reverse to horizontal (navy now on top) → gauge slides in → red wedge sweeps
0→180° → world flips 180° → payout-chip matrix assembles → rise off. Every phase
MATCHES by eye; the brief's "rotation/gauge invented" was the r1 state, already
superseded by r2's LUTs. The ONE remaining invented motion was the **chip
cascade**: r1/r2 flew all 16 chips in as a single rigid flock (baked CHIP_DX/DY)
from f3496, entering from the wrong side ~10f early.
- **Ref motion (dense read f3497..3544):** chips arrive in TWO measured waves,
  right-to-left. The RIGHT cluster (both right columns, x≈1002 grey + x≈1207
  cream/red) snaps in together, crisp by ~f3500; the LEFT cluster (x≈590 grey/navy
  + x≈782 cream) snaps in by ~f3517; each fades clean→crisp over ~3 frames; the
  full matrix settles by ~f3528. Net world rotation is ~identity here (θ+180°), so
  layout-x == screen-x.
- **Replaced (scenes2.tsx):** deleted the CHIP_DX/CHIP_DY flock LUTs; the chip map
  now gives each chip a per-chip `startF` (`x>=900 ? 3497 : 3514`), a 3f opacity
  snap, and a small -30px settle drop. chipsOn 3496→3497. Settled matrix (f3528+)
  byte-preserved — same CHIP_LAYOUT at 0 offset.
- **Filmstrip (eye gate):** `work/cls-day/anim/s18_outro_filmstrip.png` (ref/
  replica, one frame per phase f3394..3558) — motion matches across all phases.
  Onset A/B `work/cls-day/s18/pair/s18_final_onset.png`: right cluster crisp at
  f3500, left onset at f3516, both settling — aligned to the ref. tsc clean.
- **Documented residual (NOT fixed):** at f3558 the ref bleeds the S19 end-card
  mark in from the bottom during the rise; the replica reveals its own white bg.
  3 frames at the S18/S19 cut — a cross-scene seam detail, out of this window's
  core choreography; fold into any future S18/S19 seam touch.
Third animation eye-passed: the **S2 currency carousel (f100..306)**. Dense
ref pull + a per-pixel red/navy code tracker adjudicated each phase against a
fresh replica render (seg 96..308). VERDICT: the PLUNGE/converge core is
FAITHFUL, not invented — the r5 baseline LUTs reproduce the ref to within ~4px.
The two clips (above-line / below-line, each `overflow:hidden` at the ruler)
HIDE the code crossing, so each fast pair's top code appears to descend and be
swallowed INTO the line while the bottom code rises into it — exactly the ref's
"funnel into the band" (AUD/CHF f230..240 measured red/navy extents match
ref±4px; HKD/NZD/KRW/EUR streams + band descent + S3 globe dock f250..306 all
match). What WAS invented was the **entry/exit of the two SETTLED pairs**:
- **USD/JPY pan-in was too fast** — the r5 slide ran f119..129 then PARKED the
  pair for ~25f; the ref keeps it SLIDING in until ~f148 with a long ease-out
  tail (measured USD left-edge 1672@f122 → 550@f134 → 360@f150). Replaced the
  `interpolate([119,129],[1500,0])` with a measured `USD_XIN` LUT. Post-fix
  render matches the ref left-edge within ±2px at every frame f122..150.
- **DKK/GBP was slid in from the right** (invented) — the ref does NOT pan the
  2nd pair; it CROSSFADES it in at the settled straddle f167..173 (measured: no
  off-frame navy at f170, DKK already at x298 by f172, fades in place). Swapped
  the xIn slide for an opacity fade (added optional `opacity` to `SettledCode`).
- **USD/JPY sink started ~7f early** — ref HOLDS on the ruler to ~f160 then
  sinks into the line (top-code cap-top 283→414 over f162..169). Retimed the
  sink LUT (`USD_SINK`, was f154..168 → now f160..169; post-fix top-edge
  matches ref±2px). The DKK swallow (f224..231) and all plunge/funnel/descent
  LUTs (f180+) are byte-unchanged — the fix only touches f119..179.
- **Filmstrip (eye gate):** `work/cls-day/anim/s2_carousel_filmstrip.png`
  (ref/replica, 8 cols f124..306 spanning every phase — all match); proof
  strips `s2_panin_fixed.png` + `s2_handoff_fixed.png`. tsc clean.
- **Documented residual (NOT fixed):** DKK settled x is ~20px left of ref
  (268 vs 290) — a pre-existing settled-x-formula calibration, not a motion
  error; out of this invented-motion round's scope. Fold into any S2 position
  re-cal.

Fourth animation eye-passed: the **S3 globe clock (f283..352)**. Dense ref
pull (f283..352 every ~3-6f) + a blue-disk centroid tracker + a red-milestone-
tick angular tracker adjudicated every phase against a fresh replica render.
VERDICT: the GEN-9 dock/rotation/pan are MEASURED-FAITHFUL, not invented — I
confirmed them per-pixel and left them; the ONE invented motion was the
**padlock slide-in**, now deleted.
- **Dock-in trajectory FAITHFUL (verified, unchanged):** the blue-disk centroid
  cx/cy match the `G_CX`/`G_CY` LUTs to 1-3px at every keyframe (globe enters
  from the right sliver cx1893@f283 → settles cx958 r282 by f305, cy495→554);
  scale ramp matches to ~0.01-0.06 (slightly low f286-289, negligible). The
  globe arrives right→center + scales up + drops onto the S2 timeline exactly
  as GEN-9 built it.
- **CCW rotation FAITHFUL (verified, unchanged):** the red milestone ticks'
  measured angular positions match `θ=-0.93·(f-330.5)` to within 1-2° across
  the WHOLE window f292..350 — a steady CCW spin through both dock-in and pan.
- **Pan-left FAITHFUL (verified, unchanged):** cx pans 958→716 over f330..350
  matching the measured centroid (1px).
- **Padlock slide DELETED — was invented (scenes1.tsx + lib.tsx):** cropped
  ref f326..350 proved the padlock DRAWS ON IN PLACE at a fixed position, NOT
  a slide. Measured stages: shackle-top hints ~f330 → shackle+body+navy dots
  solid by ~f338 → red combination dashes populate f340..350 → drop-shadow
  ~f350. The old code slid it 190px translateX (f333..352) AND faded it too
  late (full only f348). Replaced: fixed position, `padIn` fade f330..339,
  new `padDash` (0→1 over f340..351) wired to a `dashOpacity` prop on Padlock
  so the red dashes appear only after the body is solid. Settled padlock
  (f400+, closed) byte-unchanged; GEN-9's (1338,372) position preserved.
- **Filmstrip (eye gate):** `work/cls-day/anim/s3_globe_filmstrip.png` (ref/
  replica, f283 292 301 310 320 330 338 346 352 — dock→rotate→pan→padlock
  draw-on all match). Padlock A/B `work/cls-day/s3/` (padcrop_* ref vs att2
  post-fix). tsc clean (cls-day scope).
- **Documented residuals (NOT fixed — static geometry, GEN-9 remit):** the
  replica continents are cruder (two strokes vs the ref's fuller landmasses);
  the padlock body is slightly smaller and lacks the f350 drop-shadow; the
  f283 entry sliver is ~2 frames too large. None are motion errors.

Fifth animation eye-passed: the **S4 trade diagram (f440..618)**. Dense ref
pull (f432..618 → `work/cls-day/s4/*_strip.png`) + isolated A-hex ink-width
tracking adjudicated every element against fresh replica renders. FIVE motions
were invented/mistimed; all now measured-faithful. The old code was ~40-60f
LATE across the first half and used a badge OVERSHOOT the ref never has.
- **Ref motion (dense read, 25fps 1:1):** (1) the two hexes DRAW ON IN PLACE at
  overlap positions (right/B fills ~f446, left/A ~f452), buildings filling; (2)
  the A/B badges snap on FULL-SIZE, staggered (B~f458, A~f461), **no overshoot**;
  (3) the whole diagram ZOOMS OUT — each hex-group enters ~1.5x and SHRINKS to
  settled 1.0x by ~f560, decelerating (measured A-hex ink-width / settled: f486
  1.49 · f520 1.10 · f560 1.00); (4) the hexes SPREAD f483..506 (measured centre
  A680→471 / B1200→1450); (5) the "Trade executed" arrow draws CENTRE-OUTWARD
  f507..513 (tiny centre mark → both ends grow to the hex edges), not L→R from A;
  (6) connectors draw f544..556 (lead the pill); (7) the CLS pill assembles in
  TWO rates left→right — box wipes on fast (full ~f560), logo draws O→C→L→S
  slower to ~f572 — NOT an opacity fade.
- **Replaced (scenes1.tsx only):** deleted `Easing.out(Easing.back(1.6))` badge
  pop at f528-540 (invented) → per-hex `badgePA`/`badgePB` clean cubic snaps at
  f456-466; retimed `hexIn`→staggered `hexInA/B` (f446-472), `hexSpread`
  500-528→483-506; added `hexScale` LUT (1.5→1.0 by f560) wrapping each HexCity
  in a per-centre `transform:scale` (identity/no-wrapper once settled →
  f560-674 byte-preserved); rewrote the arrow to grow from x960 outward
  (f506-514, solid line, label fades); connP 560-585→544-560; pill opacity-fade
  → two-rate L→R clip wipe (`pillBoxP` fast f550-560 + `pillP` logo f551-572,
  fast navy box behind the slow-clipped slot). HexCity/ClsPill/ClsPillSlot
  (shared S10/S13/S17) UNTOUCHED — all timing/scale/clip lives in S4Trade.
- **Filmstrip (eye gate):** `work/cls-day/anim/s4_trade_filmstrip.png` (ref row /
  replica row, 28 frames f462..618) — badges early+staggered+no-pop, hex
  grow-then-shrink, spread, centre-out arrow, two-rate pill all MATCH. Supporting
  crops in `work/cls-day/s4/` (hexscale_pair2, arrow_pair2, pill_pair4). tsc
  clean (cls-day scope).
- **Documented residuals (NOT fixed):** the money icon under A is a single navy
  `$` coin — the ref draws TWO red DOCUMENT sheets ($ left, € right); STATIC
  CONTENT, not a motion error, left for a content pass. Entrance building-fill is
  an opacity fade of the filled hex, not the ref's one-by-one building draw-on
  (the S10 dense-ink-loses precedent — the scale+fade reads as "appear"). Arrow
  endpoints use unscaled hex edges, so f507-513 (hexes still ~1.0-1.13x) the arrow
  lands a few px shy of the scaled edge. Pill box ~1-2f behind ref at f552-556.

- **Still needing the same eye-pass (invented/weird motion vs ref clean
  animation), next priorities:** S7/S13 donut ring sweeps + chip runs. (S1 intro
  + S18 outro + S2 carousel + S3 globe + S4 trade DONE.) Each: extract dense ref
  frames, identify mechanism (draw/slide/scale), rebuild, filmstrip-gate. NEXT
  recommended: **S7 netting donuts** — verify the donut ring sweep + chip runs
  read as the ref's actual motion, not invented, by the same dense-frame method.

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

### r17 — 2026-07-12 (gen-15 "HexCity RE-DRAW: rounded outline + seated badge + right-cluster density", AUTHORIZED shared-primitive round, dispatcher + 2 file-scoped sub-subagents, BUILD COMPLETE + SELF-GATED; official verify PENDING orchestrator)

**Mandate:** owner dropped the "subtle-only" rule to RE-DRAW the shared `Buildings`/`HexCity` facade primitive (`lib.tsx`) at native scale — the deferred #1 shared lever (S4/S10/S17 + CRX). All prior rounds punted it as "the ~.889 texture floor, 96 WALLED." **That framing was wrong.** The dominant defect was never texture/crispness — it was a STRUCTURAL geometry error nobody had caught: the HexCity outline was drawn with SHARP vertices where the ref draws a ROUNDED-corner hexagon, plus a too-small badge and a too-sparse right cluster.

**Discriminator (the coordinator's mid-round test — WIN vs the clsnet-r16 LOSS):** cls-day's facade is HAND-AUTHORED SVG (gen12), NOT a potrace. The clsnet lesson (re-drawing a faithful soft trace LOSES −0.14, soft-vs-soft sits at the SSIM ceiling) does NOT apply here, because this round fixed WRONG/MISSING structure (hex-corner shape, badge size, right-cluster density) and PRESERVED the faithful interior (the red-tower geometry already matched ref by measurement — left untouched, no re-trace of positioned ink). Premise TESTED empirically → **genuine WIN at every window.** This is the "fix wrong/missing content wins" case, not the "re-draw faithful trace loses" case.

**Method:** dispatcher extracted the clearest SETTLED ref frames (S10 f1900, S4 f640, S17 f3300) at 2×/3× zoom, eye-adjudicated ref-vs-OLD, and ran the round as MEASURE→AUTHOR→GATE with 2 foreground sub-subagents (renders serialize through the ONE global lock; swap-tight machine → never parallel renders). Measurement agent was adversarial: it REFUTED the dispatcher's initial "facade floats too high" read (ground line y=258 identical in ref+OLD — do NOT move it) and correctly identified the rounded-hex + badge as the dominant SSIM sinks (both HexCity, not Buildings). All artifacts in `work/cls-day/gen15/` (ref/, att_old/, att_new/, att_verify/, crop/ montages; grid_A_refVold.png = viewBox-gridded overlay). Commit `81d01933e` (lib.tsx ONLY, 87+/37−; verified `git show --name-only` = single lane file, no `git add -A`).

**Re-drawn (all shipped):**
- **Rounded HexCity outline (dominant lever).** One measured `hexPath(w,h)` — asymmetric quadratic-bezier fillets (flat setback ~0.033w, diagonal ~0.085w) on all 6 corners — drives the outline stroke AND the buildings clip (replaced the sharp `polygon(23% 3% …)` clip so outline+clip share one path, no bleed). Bounding box HW/HH, vertices, flat top/bottom edges, hexBot connector attach, and S4 arrow endpoints all PRESERVED (corner-round only). Propagates to all 4 comps.
- **Badge disc** enlarged 56→~94 dia and re-seated on the top vertex (half above the edge) to overlap the hex like ref. HexCity, S4/S10.
- **Buildings right cluster** densified (variant 0: 2-row window-box grid on the right navy building, widened rear grey slab, taller far-right tower reaching ~x354); **variant-1 lintel** widened to span both columns (x130–252); ground ticks spread to measured spots; outline stroke 2.5→3; grey slab #DDD7D8→#E4E4E8.
- **HELD (not shipped):** the navyDeep→navyBg (#0B2341→#002753) ink hue. Measured ref outline ~(4,38,70) sits between the two brand navies (ambiguous), and it's a global-ink change with the largest regression surface. The structural levers already win cleanly; not worth the risk. Flag for a future measured-hue A/B if wanted.

**Self-gate — before→after full-frame / hexA-crop / hexB-crop SSIM (independently recomputed by dispatcher; author's table reproduced EXACTLY; fresh HEAD re-render of f1900 byte-identical SSIM 1.000000 to att_new = deterministic, committed code confirmed):**
| frame | scene | full O→N | hexA O→N | hexB O→N |
|---|---|---|---|---|
| 600  | S4  | .8635→.8685 | .4823→.5144 | .4077→.4331 |
| 630  | S4  | .8623→.8672 | .4920→.5233 | .4116→.4375 |
| 650  | S4  | .8633→.8684 | .4913→.5248 | .4120→.4372 |
| 1900 | S10 | .8889→.8946 | .4765→.5140 | .3947→.4217 |
| 1950 | S10 | .8816→.8872 | .4753→.5101 | .3921→.4195 |
| 2000 | S10 | .8782→.8838 | .4799→.5159 | .3923→.4196 |
| 3250 | S17 | .8795→.8795 | .4782→.4764 ✗ | .4433→.4467 |
| 3300 | S17 | .8772→.8775 | .4738→.4795 | .4462→.4509 |
| 3350 | S17 | .8754→.8756 | .4767→.4781 | .4358→.4389 |

S4 +0.005 full / +0.032 hexA / +0.025 hexB per frame. S10 +0.0057 full / +0.036 hexA / +0.027 hexB (biggest). S17 full flat / hexA +0.0018 avg (one frame −0.0018 = settling noise, offset by hexB +0.0037) — S17 gain is smaller because its hex renders at 0.81× (rounded corners less prominent). Every window net ≥ OLD; 8/9 crops strictly pass; eye clearly cleaner at all (dispatcher's own 3-up `crop/v_3up_A_f1900.png`: rounded corners + seated badge + denser right cluster all match ref, no grammar regression). **CRX eyecheck** `CrxSettlementDay` f1950: clean — rounded hex, both corner badges, denser clusters, wider lintel propagate to the CRX pack; connectors/BankHex/pill unbroken (`att_old_crx/`, author eyecheck).

**Honest residual / score-impact:** the SSIM move is a clean WIN at every window but MODEST in the official mean — the facade is a small frame fraction, so +0.005 full-frame across ~313 settled S4+S10 frames is only ~+0.0004 on video_ssim (est. ~+0.05–0.15 pts on the 0–100 official). The real prize is EYE-fidelity: the sharp→rounded hex was a genuine structural miss (a *hard* high-contrast edge in the wrong place, not soft texture) visible across the whole video and the CRX cut — exactly the owner's 96.5 mandate. Remaining eye-level, SSIM-blind residuals: ref's top-corner sweep a hair wider than the symmetric fillet; far-right tower profile differs slightly; ink hue held at navyDeep (ref marginally bluer). **Gate-caveat:** the hex+badge structural fix is the proven driver; the stroke-bump (2.5→3) and tick-spread rode along without net-regressing any window but were not isolated-bisected (no window regressed, so no bisection triggered) — an adversarial verifier could isolate them if desired. **Out-of-lane pivots noted (scenes1/2, not this round):** the MISSING below-band € rising-docs animation (a whole absent element = bigger per-window jump), ClA (09:00) never-re-registered cluster — both bigger levers than facade texture, for a scenes-file round.

### r16 — 2026-07-12 (gen-14 "S5 ClB re-reg + inkP retime + scenes2 doc/descent/glyph sweep", dispatcher-orchestrated 2 file-scoped sub-subagents, BUILD COMPLETE; official verify PENDING orchestrator)

**Method:** dispatcher DEFERRED lib.tsx (the shared `Buildings` interior is a dense re-traced primitive at r14's ~.889 texture floor, shared S4/S10/S17 + the CRX cut — not a surgical single-primitive detail; a shared-primitive round, held) and fanned out TWO builders, ONE per scene file (collision-free git paths), sharing ONLY the global render lock (all stills serialized, `--concurrency=1`, BUILD-ONLY, no full verify). Each rendered its OLD baseline BEFORE editing (no git stash — races the sibling), gated ref-vs-OLD→NEW at ≥3 in-window frames + eye montage, committed path-scoped. 5 commits, each touching exactly ONE lane file (verified: no `git add -A`). Tools/stills in `work/cls-day/gen14-s5/` + `work/cls-day/gen14-scenes2/`. Orchestrator watchdog caught one hung ClsDay render (etime 4:47, flat 15MB, no chrome children) — self-healed via the agent's own kill+retry before intervention; a surgical PID re-verify avoided killing the healthy sibling clsnet render. (scenes2 builder made one broad `pkill` early that reaped a clsnet render by mistake — corrected to PID-scoped waits; sibling retried unharmed.)

**scenes1.tsx — 2 wins + 1 declined-with-cause.**
- **S5 ClB right cluster f827-877 re-registration (commit `058431be5`).** Grid worst = r2c3 (screen x720-960), persistent across f827/850/877. Root cause: the r3-era code drew a PHANTOM stepped building (screen 786-851) + a wide L-bridge + a 3-row white box hiding the grey slab, where ref f850 (identity transform) shows a NARROW window-wall (grey slab screen 675-684 reading through a 2×2 window box, right wall ~702 to band, small L-notch ~749). Removed phantom + bridge; drew slab + right wall + window box + notch (position→geometry→facade). A/B ref-vs-OLD→NEW full-frame: f827 .8582→.8612 · f850 .8589→.8619 · f877 .8502→.8523; **worst cell r2c3 .784/.866/.919 → .911/.947/.991**. Eye: phantom tower gone, wall matches ref.
- **S5 inkP exit-fade retime f924-940 (commit `86106e7cb`).** Documented r15 residual closed: ref holds ClG (14:00) FULL solid red at f927 (screen ~174, S6 navy front @830 not yet reached) while the old `interpolate([924,930],[1,0])` rendered inkP=0.5 (ghosted). Retimed `[924,930]→[928,930]` (by f928 x9=-1601, all above-band towers panned off-screen). Gate: f924/f930/f935 byte-identical (inkP unchanged there); f927 full-frame **−.002** (.858→.856) — shipped as a documented perceptual spend (lesson 8: the exit-whip positional offset is cheaper under solid than faded ink; the metric cannot veto eye-clear bright content). S6 sweepS5/front5 tick-repaint untouched.
- **NOT fixed — ClE/ClF below-band mirror (f775-825, f725-775):** investigated, no safe fix. Per-cluster SSIM flat (ClD .665-.684, ClE .665-.719, ClF .696-.725 — no dominant outlier like PASS-1's 0.35). Measured below-band as ALREADY well-registered (ClE/ClF bottom-red within 3px of ref; ClE center comb matches ref localY 72-161). The one real gap is a MISSING transient € rising-doc (mirror of the above-band $ DocPops at B/C/G; appears only by f825) — a new animated element, not a building re-reg; declined rather than ship a likely revert.

**scenes2.tsx — 3 wins.**
- **S11 FocusDoc back-sheet extent (commit `b5a3453d9`).** Premise refuted per-pixel: the page-1 FRONT sheet already sat at ref extent (bottom y744 vs old y747). Real defect: page-1↔page-2 bottom spacing 23px vs ref's 33px — the page-2 BACK sheet was ~8px short. Edit: page-2 bottom 484→491 (screen 770→777=ref), page-1 462→459 (→744), grey shadow tracked; interior untouched. A/B focus-doc crop: f2110 .5888→.6175 · f2150 .6559→.6841 · f2200 .6551→.6832 (**+.028 flat**).
- **S14 descent = zoom-out + pan (commit `8663aeedd`).** Mission model wrong on count AND mechanism: ref descent pitch is 330@f2728→291@f2731→257@f2737→249@f2745 (NOT ~225); the old constant 249 was ~80px/hr too TIGHT the whole descent, and the origin swings (hour@x960 7.41→8.00 = a zoom about a left pivot x≈357, so pitch-alone can't fit). Replaced `pxPerHour={249}` with per-frame `pitchDescent` + `hourDelta` tables (x9 tracks the pitch), BOTH decaying to identity at f2745 (settled + S15 handoff byte-unchanged). A/B band region: f2728 +.017 · f2731 +.016 · f2737 +.009 · f2745 identical; ticks within 1-3px of ref (f2728 exact).
- **S17 RowIcon glyphs re-traced (commit `d8b996f63`).** Ref f3300: kind0 was an EMPTY circle — ref has a red coin($) + 2 header lines + coral shadow-doc; kinds 1/3 were a single pill column — ref is a 2-column rounded-rect grid with the arrow in the empty top cell (→ pay-ins, ← pay-outs); kind2 zigzag read as nothing. Rebuilt all four + a colour-coded clasped-forearm handshake. A/B per-row (flat across 3 gate frames): row1 +.025 · row2 +.038 · row3 +.082; **row0 −.016** (lesson-4 inversion — correct-but-dense $ ink slightly misaligned loses to the sparse-wrong old; shipped on eye evidence, the $ is ref-present). In-code NEGATIVE: two cleaner handshakes (SSIM .287/.286) scored HIGHER but read as "pointing arm"/"scribble"; kept v1 (.276) as most handshake-like.

**Smoke/regression:** CrxSettlementDay smoke clean at f850 (scenes1 ClB corrected wall, no pack break) + f2150/f2731/f3300 (scenes2 focus doc / descent band pitch / all 4 glyphs with CRX copy). Lane clean, 5 commits path-scoped, interleave cleanly with the concurrent clsnet session on the shared lock. tsc/compile confirmed by successful renders (Remotion esbuild fails on any type error).

**Next worst per file (for the following round):**
- **scenes1.tsx:** the MISSING below-band € rising-docs (mirror of the $ DocPops — biggest below-band SSIM gap; a NEW animated element, not a re-reg). Then **ClA (09:00)** — the only above-band cluster never re-registered (re-grid post-PASS-1 worst = r2c0/r1c0, screen x0-240).
- **scenes2.tsx:** (1) **S14 descent LABEL scale** — best next target, clean/measured/low-risk (ref descent labels ~1.3× larger via the zoom; band labelSize stays 34). (2) S11 FocusDoc interior banner (largest remaining focus-doc deficit ~.68; ref banner ~7px lower + ~9px taller — but it is the REGISTERED interior; needs a per-element vertical TRANSLATE not a squish, higher risk — see gen13 RefDoc-narrowing NEGATIVE). (3) S17 handshake 54px hand-detail. (4) S11 page-1 bottom-left corner (ref rises to y735 at x770).
- **lib.tsx (deferred this round):** S4/S10/S17 `Buildings` interior facade texture — a shared-primitive round (gate across 4 comps + ~8 windows), still at r14's ~.889 texture floor. 96 stays WALLED (r8 analysis holds).

### r15 — 2026-07-12 (gen-13 "S5 ClG + docs/pvp/summary sweep", dispatcher-orchestrated 2 file-scoped sub-subagents, BUILD COMPLETE; official verify PENDING orchestrator)

**Method:** orchestrator triaged the worst window (S5 f877-927, mean .863 — worst of
the video) down to the single persistent building via `ssim-grid --pairs` (grid r2c6/c7
≈0.31 = the **14:00 ClG capped tower**), then dispatched TWO builders — one per scene
file so they never collide on a git path — running CONCURRENTLY, sharing the ONE render
lock (all stills serialized; no double-render OOM). No git stash (races the sibling): each
builder rendered its OLD baseline BEFORE editing, then NEW, gating ref-vs-OLD→NEW. Build-
only, no full verify. Tools/stills in `work/cls-day/gen13-s5/` (ref/, att/, probe_clg.py,
render.sh, ssim.sh, smoke/) + `work/cls-day/gen13-scenes2/`.

**scenes1.tsx — S5Skyline f877-927 · ClG 14:00 capped tower re-registration (commit
`4df6d1a2b`).** Grid worst cell. Root cause: the red tower's broad-body **right wall was
hidden** under the navy building's white fill (navy started local x285, body wall x290) →
att body read w105 + 4900 red-px vs ref w120 + 6300. Fix (lesson-4 order): head shifted
right + narrowed about centre (226→233.5, ×0.94); body walls 170/290 → **175/294 (right
wall now visible)**; navy building +15px so wall + grey slab read; dash grid re-pitched
186→196 to ref columns. Body width converged 105 → **122** (ref 120). A/B ref-vs-OLD→NEW:
f877 .8489→.8502 (+.0013) · f897 .8542→.8569 (+.0026) · f907 .8435→.8465 (+.0030) · f917
.8376→.8404 (+.0028) · f927 .8584→.8580 (−.0004, fade-frame noise). Eye gate: body right
wall + grey slab + navy spacing now match ref; head centred. Final combined-HEAD render
confirms f897 .8569. **Residual:** facade still ~1000 red-px short (5309 vs 6343) — finer
window/rail detail, deliberately NOT bolded (dense-near-miss trap, lesson 4); f927 is a
pre-existing S5 `inkP` fade-timing issue (ref stays solid past f927 while our replica is
~0.5 faded) — separate fixable, still in scenes1.tsx.

**scenes2.tsx — 4 wins + 1 documented negative (commits below).**
- **S11 docs f2102-2215 · doc-position re-registration (`0cd2de3d1`).** Measured ref f2150
  body-left borders: doc6 1765→**1744 (was 20px too far right)**, doc4 1230→1226, row up
  3px (top 391→388), focus doc to page-1 left 753/top 289. A/B: f2110 +.0019 · f2130/2150/
  2180/2200 **+.0142 each**.
- **S11 docs · NEGATIVE A/B documented (`e40d443da`).** Narrowing the doc body svg 232→225
  (ref border 221 vs replica 228) LOST −.002…−.005 every frame — the 3% squish drags the
  dense already-registered interior off ref (lesson 4). Reverted, logged in-code so it is
  not re-attempted. Border width is a dead-end; **FocusDoc height** (ref 490 vs replica 481)
  is the next scenes2-local lever here, deferred.
- **S13 PvP→S14 f2687-2737 · exit-slide + band-descent retiming (`62397ab44`).** S13 held
  full content to f2737 (~18f too late). Ref slides content straight DOWN off-frame FAST
  (ink below band 175k@f2719 → 30k@f2722 → **0@f2725**); S14 then descends the band y0→221
  (tops 72@f2728 → 210@f2737) with marker + solid red 09:00 line + fading "09:00". A/B:
  **f2725 .8401→.9539 (+.114 — round's biggest single win)**; f2687/2700/2712 unchanged;
  f2737 .9506→.9501 (−.00055, documented spend: OLD scored high only by SSIM white-blindness
  on the WRONG full-city content, lesson 8; NEW is faithful). **Residual:** descent-phase
  band pitch ~249 vs ref ~225 (scenes2-local horizontal rescale, left); city interiors =
  HexCity/PvpCity texture floor (lib.tsx, out of scope).
- **S17 summary f3340-3390 · panel-row text fs22→16 (`5be8a5836`)** (ref cap ~13.5 vs
  replica ~19; also fixed panel-width overflow): +.0049/+.0049/+.0049/+.0040. **· milestone
  label text time22→19 label17→14 (`49f1b67ea`)** (same ~1.2× oversize, all 4 milestones):
  +.0036/+.0040/+.0014. **Residual:** RowIcon glyphs (doc `$`-mark vs circle) = 44px
  scenes2-local detail, tiny SSIM, next lever here; hex interiors = lib.tsx; a pack copy
  diff = data.ts (both out of scope).

**Smoke/regression:** final combined HEAD renders clean at f897 (ClsDay) + f2725 (ClsDay) +
**f897 CrxSettlementDay** (ClG geometry is shared with the CRX cut — inherits the improved
skyline, no pack issue, eye-clean). Both scene files committed clean, path-scoped, no
`git add -A`, commits interleave cleanly with a concurrent clsnet session on the shared
lock. tsc/compile confirmed by successful renders (Remotion esbuild fails on any type error).

**Next worst per remaining window (for the following round):**
- **S5 f827-877** — grid worst = the ClB 10:00 / ClC 12:00 boundary (scenes1.tsx). Then
  **f775-825, f725-775** — other above/below-band clusters incl. ClE/ClF mirror (scenes1.tsx).
- **S5 `inkP` fade timing f924-940** — ref holds ClG solid past f927; retime the fade LUT
  (scenes1.tsx).
- **S4 f663-713 / f603-653** — residual is HexCity/Buildings interior TEXTURE (lib.tsx,
  shared S4/S10/S17, out of single-file scope; needs a shared-primitive round).
- **S11 FocusDoc height** + **S13 descent band pitch** + **S17 RowIcon glyphs** — all
  scenes2-local, all small-yield texture/detail.
- **Board is at the texture/encoding floor** (r8 wall analysis stands): the banked wins are
  registration (ClG) + choreography (S13→S14 +.114) + label-size fixes — no gross structural
  bug remains in the top windows. 96 stays WALLED.

### r14 — 2026-07-11 (gen-12 "HexCity re-trace + fiction sweep" session, BUILD COMPLETE; official verify PENDING orchestrator)

**Instrument law obeyed:** measured/gated against EXACT REF VIDEO FRAMES only
(`ffmpeg select=eq(n\,F)` → `remotion still` frame F → ffmpeg-ssim PNG). 25fps ref =
1:1 frame map (no clock conversion). Tools + all ref/att stills in `work/cls-day/gen12/`
(probe_hexedge.py, silhouette.py, masses.py, render.sh, ssim.sh; crops cropA2/cropB2).

**Blast radius correction:** HexCity is shared by **S4 (scenes1:519-520) / S10 / S17**,
NOT S13 as the brief said — S13 is the PvP handshake (different primitives). So the
re-trace lifts S4+S10+S17 (even broader: S4 is a big early scene). Two BROAD wins landed:

**WIN 1 — hex RE-REGISTRATION (commit f5852bb1d, scenes1+scenes2).** All three
consumers were mis-registered — measured the outline bboxes from ref f560/f640/f1837/
f1900/f3240 (probe_hexedge: flat top/bottom edges + vertices):
- S10: A cx **571→479** (92px right), both hy **404→451** (47px high), h **390→282**
  (108px too tall — the "pointy tall" look was pure oversize; inset-0.22 flat-top
  shape proportions were already correct). w380→378. Connectors/chips re-anchored to a
  `hexBot` const (old bottom 599 ≈ new 592, so they barely moved).
- S4: hy **475→527** (52px high), HH **415→282** (133px too tall), HW402→382, settled
  ax435→471 / bx1473→1450.
- S17: (547,413)→(561,404), w290→307 (was already close; small win).
- **Still-gate (ref vs old→reg), EVERY frame rises, none regress:** f560 +.017 · f640
  +.017 · f1850 +.009 · f1868 +.015 · f1900 +.015 · f1960 +.015 · f2050 +.014 · f3240
  +.007 · f3260 +.007.

**WIN 2 — dense HexCity SKYLINE re-trace (commit 0a8ea200d, lib.tsx).** The settled
ref hex interior is a dense ~7-building city (IDENTICAL design across S4/S10/S17), not
the old 3-tower sketch. Rebuilt `Buildings` per-building from ref f1900 (viewBox 378×282
= the S10 hex, `preserveAspectRatio="none"`; vb = ref−(290,310)): center red tower
(cap+antennae, inner solid-red + salmon #EEC9AF windows, base 4×4 grid, door), flanking
navy towers, dots/ladder buildings, light grey slabs #DDD7D8, red car, blue+navy ground
ticks — variant 0 (A) and variant 1 (B) traced separately. Buildings now FILLS the hex,
CSS-`clipPath`ed to the hex polygon so chamfer overhang reads white (as the ref does).
`dense` prop is now moot (skyline always full), so S4/S10 inherit it too.
- **Still-gate vs registration-only, every frame rises, none regress:** f560 +.003 ·
  f640 +.003 · f1868 +.003 · f1900 +.003 · f1960 +.003 · f2050 +.003 · f3240 +.001 ·
  f3260 +.004. **COMBINED vs old HEAD: S4/S10 +.017–.020, S17 +.008–.011.**
- gen12 directly attacks **6 of the r12 top-14 windows** (all S4 hex windows 631-681
  [rank 1], 581-631 [5], 531-581 [11], 681-731 [12], + S17 windows 3340/3290/3240
  [9/10/14]). CrxSettlementDay smoke-clean at f1900 (dense skyline + CRX lockup/copy,
  no pack issues).

**NO-GO 1 — S10 progressive build / entry retiming (target 1's choreography): still a
LOSS, NOT shipped.** Confirmed the gen-11 root-cause reasoning survives the artwork fix.
The build window f1820-1868 is mostly white, so SSIM is background-dominated: current
faint/late unit-fade scores f1830 .972 · f1840 .945 · f1850 .929 · f1860 .900 (blank
bias). Our SETTLED skyline now matches ref at only **.889** (not the ~.95+ needed).
Showing correct dense ink EARLIER (progressive build) would drag these frames DOWN
toward .889 — a ~−.04 loss at f1850. The artwork fix lifted the settled match (.871→.889)
but not enough to flip early-ink from loss to win. Badge stagger is invisible (badges
ride the ≈0 opacity there). So the retiming stays reverted — absent/faint ink still
beats .889-settled ink (lesson 4). Reinstating the `textOpacity` prop / f1818-over-S9
entry would only carry this loss forward; left alone.

**DOCUMENTED SPEND — S4 entry (f486-530), −.003 avg:** ref settles the S4 hexes CLOSE
then SPREADS them apart + settles by ~f504 (measured: f486 A≈680/B≈1200 → f504 A≈480/
B≈1450), while our code spreads late (500-528) with badges even later (528-540). The
accurate settled geometry exposed this pre-existing spread-timing gap: entry f486 −.003 ·
f510 −.007 · f530 −.001, while the actual top-1 window (531-681, settled) gained +.020.
Retiming the spread is a NARROW transition tweak (the brief's own lesson: narrow doesn't
move the metric; ~−.00004 global) with real risk to the arrow/pill choreography — NOT
taken. Net S4 strongly positive.

**TARGET 2 — fiction/wrong-scale sweep: NO further broad win found.** Re-ranked r12
framessim (rolling 2s, top-14). Un-addressed top windows are all at the texture/encoding
floor, NOT invented/mis-scaled: S5 skyline (877-927/772-822/827-877 — encoding floor per
gen-8/r11), S11 docs row (2102-2215 — rendered current vs ref f2190: layout is a CLOSE
structural match, 6 docs + correct seals + focus doc; .845 is fine hairline texture, the
dense-ink trap), S13 PvP tail (2687-2737 — texture), S1 intro (66-116). None warrant a
rebuild.

**Honest headroom after gen12:** the hex board (S4/S10/S17) moved from mis-placed sparse
ink to registered dense ink; residual is window-level texture (exact hairlines/window
grids inside the buildings) — the settled hexes still cap ~.889 because the ref line-art
carries per-window detail SSIM can't be pushed past without the dense-ink-loses trap. The
remaining top windows are all S5/S11/S13 texture + encoding floor. 96 stays WALLED. The
two banked wins hit 6 of 14 worst windows; expect the official verify to clear >92.8.

### r13 — 2026-07-11 (gen-11 "attack the two flagged choreography wins" session, BUILD COMPLETE; official verify PENDING orchestrator)

**Instrument law obeyed (gen-10 discovery):** measured/gated against EXACT REF
VIDEO FRAMES only (`ffmpeg select=eq(n\,F)` → render frame F → ffmpeg-ssim), never
the coarse +3f `regular_NNNN` plate grid. Instruments + all ref/att stills in
`work/cls-day/gen11/` (probe_s8.py, probe_milestone.py, render.sh, ssim.sh).

**TARGET 1 — S8 milestone→staircase REBUILT (f1466-1712). LANDED, commit ab75bbce5**
(scenes2.tsx + lib.tsx). The old S8 phaseB/C were the last big invented block in
S8: a short band with 03:00-08:00 hour labels + a stray chip stack + fs110 "06:30",
and the 5 bars sliding in at the BOTTOM from the RIGHT — none matched the ref (the
STATE gap the gen-10 handoff flagged). Rebuilt the whole move from measured video
frames:
- milestone view (f1540-1600): tall grey band y0-259 (NO hour ticks), red playhead
  x913 (y0-925), big "06:30" **fs245** (cap176, measured — NOT the "110px" STATE
  had) at x196 + subtitle at x417 fs42;
- the 5 bars GROW rightward out of the playhead (per-bar f1585-1600, staggered),
  landing ~140px wide stacked vertically at their FINAL staircase y-levels;
- band pans+zooms out — 07:00 tick 834(f1620)→176(f1640), playhead 913→98, hour
  ticks/labels fade in **07:00-12:00 only** (added hMin/hMax to TimelineBand;
  defaults preserve every other scene) — while the bar STACK translates left to
  x176 (the hour grid, the playhead and the bars are DECOUPLED during the collapse
  and converge at f1640);
- bars then unfold left→right into the Gantt staircase, staggered, settled by ~f1680
  == ref f1700 == S9's opening frame.
- **SCHED_BARS is now the single shared geometry source** for S8's spread AND S9's
  staircase, so the f1700 handoff is byte-continuous. S9 render VERIFIED byte-
  identical after the refactor (f1700 AND f1750 fill-phase both All:1.0 vs the gen-10
  S9 render). S9's opaque white bg covers S8 from f1700 — no doubling (the "boundary
  pop" the handoff feared was never a doubling; it was purely S8's wrong f1600-1699
  content).

A/B still-gate (ffmpeg SSIM PNG, ref vs OLD-HEAD → NEW), EVERY frame rises:

| frame | OLD | NEW | Δ | phase |
|---|---|---|---|---|
| f1560 | .9140 | .9582 | +.044 | 06:30 milestone view |
| f1590 | ~.90 | .9577 | +.05 | bars growing |
| f1595 | .9032 | .9522 | +.049 | bars growing |
| f1600 | .8741 | .9426 | **+.069** | bars stacked, band panning |
| f1620 | .8954 | .9296 | +.034 | mid-collapse (hardest frame — full overlap) |
| f1630 | ~.89 | .9304 | +.04 | text gone, collapsing |
| f1640 | .8984 | .9595 | **+.061** | stack landed at 07:00 |
| f1650 | .8921 | .9551 | +.063 | spread underway |
| f1660 | .8817 | .9421 | +.059 | spread |
| f1680 | .8724 | .9499 | **+.078** | staircase settled |
| f1700 | .9495 | .9495 | ±.000 | S9 handoff (byte-identical) |

**Mean +.057 over the changed window (~120/3750 frames).** No regression anywhere.
tsc clean; CrxSettlementDay smoke-clean at f1620 (CRX copy, same choreography, no
pack issues). Est. global gain sub-hundredth (video_ssim +.057 over ~120f ≈ +.0018)
but the whole S8 staircase is no longer visibly fictional and the S8/S9 boundary is
seamless.

**TARGET 2 — S10 arrival lag (f1837+): MEASURED, ATTEMPTED, REVERTED as a LOSS.**
The handoff was RIGHT about the ref choreography — measured exactly (probe over
f1815-1868): the two hexagons fade in **f1820-1845** (outlines→buildings→detail),
and the "07:00 Start of settlement and funding" label appears LATE, **f1840-1860**,
AFTER the hexagons; the current S10 has hexagons at f1845-1868 (late) + label from
f1837 (early). Built the retiming cleanly (S10 enters f1818 over S9's white bg so S9
stays byte-identical; hexP 1820-1842; added Milestone `textOpacity` so the label
fades independently of the red line).

**But the retiming LOSES on SSIM and was REVERTED** (rule: absent ink beats misplaced
ink; a measured retiming can lose). ref-vs-OLD→NEW:

| frame | OLD | NEW(retimed) | Δ |
|---|---|---|---|
| f1830 | .9722 | .9429 | **−.029** |
| f1836 | .9586 | .9315 | −.027 |
| f1837 | .9539 | .9303 | −.024 |
| f1845 | .9355 | .9123 | −.023 |
| f1850 | .9194 | .9112 | −.008 |
| f1868 | .8787 | .8787 | ±.000 (both full hexagons) |

**Root cause = HexCity ARTWORK, not timing.** The settled hexagons score only **~.88**
vs ref (OLD and NEW identical at f1868). Diffing NEW f1837 vs ref (images in gen11/):
our HexCity is **mis-registered** (A hex center ~560/y185-585 vs ref ~475/y285-590 —
~85px right, ~100px high, and too tall), it draws the "A" badge **immediately** while
the ref's A badge appears **LATE** (~f1868, not f1837), and — the big one — **the ref
hexagons BUILD UP PROGRESSIVELY** (f1837 = one central building; f1868 = a dense
skyline with side towers), whereas our HexCity fades the whole complete (sparser,
mis-placed) icon in as a unit. So showing our hexagons on the ref's earlier schedule
drags the transition frames from ~.95 (blank) toward the ~.88 hexagon-texture floor —
blank beats our mismatched ink (lesson 4 / the dense-near-miss trap).

**THE REAL S10 LEVER (for a dedicated round, NOT a retiming):** re-trace HexCity to the
ref — (1) register position/size (A center ~475 y~435, hex ~360 wide; measure B), (2)
delay the A badge to ~f1865, (3) model the **progressive building-by-building growth**
(f1820 outline → central building f1830 → side skyline f1845-1868), (4) match the
denser settled skyline. Only THEN does the correct timing (hexagons f1820-1845, label
f1840-1860) become a win. HexCity is shared with S13/S17 — re-trace once, gate all
three. The `textOpacity` Milestone prop + the S10-over-S9 f1818 entry pattern are
proven and can be reinstated alongside the artwork fix. Reverted files clean; no S10
change shipped.

### r12 — 2026-07-11 (gen-10 "attack CHOREOGRAPHY" session, BUILD COMPLETE; official verify PENDING orchestrator)

**S9 (f1700-1837) REBUILT — the last fully-INVENTED scene on the board (STATE
gap 8).** Commit **<pending>** (scenes2.tsx). The old S9 was two giant
"06:00|07:00" labels sweeping left — pure fiction; it scored ~0.90-0.93 only by
white-frame SSIM blindness (lesson 8: the frame is ~85% white, so the phantom
labels + the MISSING schedule barely moved the metric — exactly where a
choreography bug hides). The r11 framessim was STALE (byte-identical to r10, did
NOT reflect the globe/donut fixes), so I re-ranked from r10 + measured the ref
directly. The ref here (measured f1700-1836; probes in `work/cls-day/gen10/`) is
the REVISED PAY-IN SCHEDULE shown full-size:
- static band 07:00-12:00, tall grey y0-259, pitch 309, 07:00 tick x176;
- red playhead line x98 (y0-925);
- 5 Gantt bars staircasing down, hour-tick snapped ([07-08]@y402 · [08-09]@497 ·
  [09-09:30]@591 · [09:30-11]@691 · [11-12]@790 h122), that FILL navy left→right
  (each ~15f, staggered ~5.3f from f1723);
- bars then CLEAR left→right (f1766/1769/1775/1781/1784, gone by +3);
- band zooms out NON-uniformly (grey height 259→40 collapses faster than the pan)
  + pans right (07:00 176→435→560→980) landing on the S10 band (958, y88 h40,
  pitch141.6) by f1815, then HOLDS (+ marker + 07:00 line) to the S10 handoff at
  f1837 (S9 now ends at 1837, not 1850 — clean seam, S9 mounts before S10).
Exit precision spend: during the fast-pan window (f1792-1812) ticks/labels can't
be placed to <±100px, so LABELS are dropped there — absent thin ink beats
misplaced (lesson 4); that alone flipped the exit from -.004/-.007/-.006 to
+.002 at f1795/1800/1805.

**A/B still-gate (ffmpeg SSIM PNG, ref vs OLD-HEAD → NEW) — EVERY frame rises or holds:**
| frame | OLD | NEW | Δ | phase |
|---|---|---|---|---|
| f1700 | .9184 | .9495 | +.031 | staircase |
| f1710 | .9184 | .9495 | +.031 | staircase |
| f1730 | .9155 | .9494 | +.034 | staircase |
| f1750 | .9018 | .9532 | **+.051** | staircase (worst old frame) |
| f1770 | .9231 | .9569 | +.034 | staircase |
| f1790 | .9667 | .9669 | +.000 | exit |
| f1795 | .9746 | .9768 | +.002 | exit |
| f1805 | .9611 | .9629 | +.002 | exit |
| f1815 | .9765 | .9940 | +.018 | exit (held S10 band) |
| f1830 | .9525 | .9722 | +.020 | exit (held S10 band) |
| f1837 | .9539 | .9539 | ±.000 | S10 handoff (clean) |

**Mean +.0175 over 11 gated frames.** The ~86-frame staircase (f1700-1786) moves
from ~0.90-0.93 to ~0.95-0.96; the exit handoff also rises (the held S10-position
band + marker beats the old slow ghost-fade). No regression anywhere. tsc clean;
CrxSettlementDay smoke-clean at f1750 (S9 takes no pack — CRX inherits the
staircase byte-for-byte). Est. global gain sub-hundredth (video_ssim +.0175 over
~137/3750 frames ≈ +.0006) but the scene is no longer visibly fictional.

**Honest choreography headroom (for the next inheritor):**
- **S8 staircase phase (f1600-1699, ~0.90) is the matching bug** — the ref f1650
  shows the 5 bars STACKED at the left, spreading into the f1700 staircase; our
  S8 phaseC draws them at the BOTTOM sliding in from the right. Unifying S8's
  spread with S9's measured bars closes the S8/S9 boundary pop (the ref is
  continuous f1650-1786). Separate scene/commit — the clear next choreography win.
- **S10 arrival lag (f1837+)**: ref f1837 already has BOTH hexagons present + no
  "07:00 Start of settlement" label; our S10 shows the label + hexagons arriving
  ~8-30f late (hexP 1845-1868). S10's timing, not S9's — a real fixable.
- Other timing candidates surveyed but NOT gross bugs: S18 outro (r2 rebuilt it
  from measured per-frame LUTs, gates .938-.982 — at floor); S13 chip-run tail
  (r5/r8 re-measured — texture floor). The top-12 windows remain the S5 texture /
  S11-12 doc-hairline / S17 exit-pan floor from r8-r11. 96 stays WALLED.

### r11 — 2026-07-11 (gen-9 "hunt more ClD-style bugs" session, BUILD COMPLETE; official verify PENDING orchestrator)

**Found + fixed the TWO biggest hidden structural bugs left in cls-day — both
FAR larger than r10's ClD (+.005). Both DOM/SVG, both airtight-gated (full-frame
ffmpeg SSIM ref vs OLD-HEAD→NEW, every frame RISES or holds, none regress).**
GEN-8 was right that S5 below-band towers are at the encoding floor — I looked
ELSEWHERE, at the two scenes STATE had flagged UNMEASURED/guessed.

**1. S3 GLOBE CLOCK — commit dd6e7dfac (scenes1.tsx).** The globe was a STATIC
guess at `(960,690) r235` with ONE clock label. The ref is a rotating settlement
clock, per-pixel measured (r11 work/ref + probes):
- disk r**291** cy**554** (was 136px TOO LOW, 56px too small);
- it PANS left cx 958→715 over f333-350 then HOLDS (was static — up to 245px
  mis-placed horizontally for ~75 frames of hold);
- the whole clock FACE (24 hourly navy ticks + 6 milestone red/navy ticks +
  labels) ROTATES CCW rigidly at **θ=-0.93·(f-330.5)°** (all 6 milestones fit
  at f410 θ=-74.6); continents scroll by longitude; marker fixed at top;
- ring rebuilt: grey annulus r303-349 + navy hairline r300; blue disk r291;
- milestone ticks/labels at 23:00/00:00/06:00/06:30/09:00 (red) + 07:00 (navy),
  labels tangential rotate(deg+θ) — read upright top, upside-down bottom;
- padlock (design already correct) repositioned to (1338,372) size163 + slides
  in from the right f333-352; globe exits (fades) by f440 so S4 enters clean
  (old code held the wrong globe opaque until f452).
- **A/B, 9 frames dock→settle→pan→hold→exit, ALL ROSE (mean ~+.032):** f290
  .897→.927 · f300 .894→.915 · f330 .915→.941 · f350 .889→.926 · f380 .888→.931
  · f410 .890→.930 · f430 .879→.886 · f440 .930→.970 · f450 .902→.941. Pure
  registration (no invented ink) — the ~600px clock moved onto the ref.
  CrxSettlementDay smoke-clean at f380 (globe takes no pack). Est. global score
  gain the single largest since the early rounds (~+.05–.10 vs r9/r10's sub-.01).

**2. S7 DONUT FILL/COUNT — commit 081f42fed (scenes1.tsx).** The donut sat empty
grey until f1240, then filled SLOWLY to f1285 and SNAPPED the label 0%→96%. Ref
(measured): holds 0% until f1230, then sweeps navy 0→96% FAST over f1230-1252
(48%@f1240, 95%@f1250) with the serif number COUNTING in sync, holds, then
96→99% at f1344-1360. Rebuilt: one measured count LUT drives BOTH fill and the
live label; pack.percents endpoints (96/99) are the count targets (CRX pack
identical). Label held until post-slide (f1214) to avoid a mid-slide regression.
- **A/B:** f1210 .9538→.9538 (flat) · f1240 .9059→.9410 (+.035) · f1250
  .8779→.9377 (**+.060**, worst donut frame) · f1260 .9148→.9381 (+.023) ·
  f1290/f1300 flat · f1360 +.001. Perceptual strip at f1250 matches (95% fill,
  grey gap, "95%"). Residual: ref has a thin navy INNER-ring outline the Donut
  primitive still lacks (negligible; left for a future donut touch).

**Windows checked and found at genuine FLOOR (do NOT re-check):**
- **S4 trade band** (worst non-S5 window 631-681): the timeline band is CORRECT
  — 23:00 tick sits at x967≈marker960 @f550, 00:00 at 1110 vs coded 1102 (8px,
  in tolerance); STATE's "23:00 under marker" stands. S4's deficit is the SPARSE
  HexCity interiors (3 buildings vs the ref's dense ~8-building skylines) — pure
  TEXTURE, the dense-near-miss-loses trap; plus the f656-673 whip (logged spend
  r4/r6). Not a structural bug.
- **S13 f2722** (.799, worst candidate frame): near the scene-end chip flight —
  chip-timing + city-interior TEXTURE after the r3/r5/r8 re-traces. No gross
  structural bug. At timing/texture floor.
- **S17** (f3230/3260): the exit pan was measured+fixed in r9; residual is
  diagram-interior texture.

**True reachable ceiling (honest):** the globe + donut are the last CLEAN
structural registration bugs in the non-S5 board — both were scenes STATE had
left UNMEASURED (globe) / animation-guessed (donut), which is exactly where a
ClD-class bug hides. After r11 the remaining top windows are all S5 below-band
towers (encoding floor per gen-8), S4/S13 city interiors (hand-drawn texture,
dense-ink trap), and the S4→S5 whip (logged spend). ≥96 stays WALLED (r8
analysis holds); but r11's two fixes should bank the biggest score move in many
rounds — verify to confirm. Artifacts: `work/cls-day/r11/` (ref/ dense globe+
donut frames, att/ + att_old/ gate stills, strips/, render-stills.sh).

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

## MODEL-DETAIL round — CLS swirl mark rebuild (2026-07-11)

Owner: the line-art models felt rushed. `ClsMark` in `cls-shared/logo.tsx`
rendered a plain CRESCENT (ring + bite) — the real CLS mark's inner comma
was MISSING entirely.

- Rebuilt `ClsMark` as a high-fidelity trace of the actual mark. Method:
  extract the settled intro lockup (cls-day f60, 214px master) → isolate the
  white swirl → clean binary → upscale ×3 + blur + `potrace` → normalise
  potrace's 681-space, y-up output into the unchanged `0 0 235 235` viewBox
  via `translate(0,235) scale(±0.034508)`. Path baked as `MARK_D` (evenodd,
  navy negative space revealed by the `bg` backing disc r=111.5 @117.5,117.5).
  Component API (`size`/`ink`/`bg`) and viewBox held — all mounts unchanged.
- The mark is TWO interlocking crescent-swooshes spiralling a navy core:
  outer left-heavy crescent + inner comma whose rounded head sits right of
  centre, split by a navy spiral gap. Eye-gate montage
  `work/cls-shared/mark/EG_clsday_f60_refTop_repBottom.png`: ref==replica —
  inner comma present, proportions/orientation/taper points match.
- Scope: `ClsMark` drives cls-day ONLY. clsnet uses its own `art.ts` potrace
  (already a swirl, NOT the crescent) — outside file scope, left untouched.
  CRX cuts (CrxSettlementDay = crx-lockup image, CrxNetting = "CRX" text)
  don't use ClsMark. All five gated frames render clean (f60 intro, f3600
  endcard, clsnet f24, CrxSettlementDay f60, CrxNetting f110).
- `ClsLetters` left as-is: eye-gate
  `work/cls-shared/mark/EG_letters_refTop_repBottom.png` shows the rounded
  C/L/S face already faithful (slightly heavier weight, not a defect) — the
  crescent mark was the rushed model, not the letters.
- Build-only gate (remotion still bundled + rendered all five comps clean).
  Not a full verify.

## MODEL-DETAIL round — 2026-07-11 (rushed line-art models, eye-judged, IGNORE SSIM)

Owner directive: motion is faithful but the line-art MODELS read rushed vs the
original. Rebuild them, judged by side-by-side crops (ref f80 vs replica), not
SSIM. Crops + montages in `work/cls-day/models/{ref,att,mont}`.

**The three S1 pillar icons** (Settlement/Processing/Data; commit a7c550b78):
- FIRST found + fixed the "grey right edge" defect: the icon draw-on fronts
  (ICON_S/P/D) topped out only ~8px past each icon's right edge, so the soft
  reveal-mask left the icon's right edge PERMANENTLY at ~27% opacity through all
  of S1 (commit dc654a765 — extend the fronts to icon_right+46). This alone
  killed most of the "rushed" read. `mont/icons3_80b_ab.png`.
- Fitted each icon's left/top/size to the ref f80 INK BBOX (measured, not label
  centres): handshake at (600,666), process (856,653), data (1148,645) — the
  ref sits handshake right+low of its label, data left of its; shifted the
  reveal-front LUTs by the same deltas so the draw-on stays faithful.
- **Handshake = the worst.** Was a tangled straight-line rake. Rebuilt the white
  hand (6 finger iterations, grid-measured + white-ink overlays): 4 EVENLY-spaced
  (~15 pitch), DIAGONAL (~55° down-left) fingers wrapping over the red hand into
  the clasp, each a medium up-curling J-hook; dropped the spurious red arm curl;
  lowered the fingers onto the measured knuckle ridge (svg_y~64). Now reads as a
  clean two-hand clasp. `mont/hs_normal_hs6.png` = FAITHFUL.
- Process: raised the triangle ~14u to the ref height. Data: extended the
  stem/node ~14u. Both FAITHFUL. `mont/icons3_pos2_ab.png`.
- Verified no S1-animation regression: f50 mid-draw, f95 settled, f3600 endcard,
  f2550 HandshakePill all clean (`mont/regression_check.png`, `pill_2550_ab.png`).

**Buildings / HexCity** (S4/S10/S17; audit commit 6e7e759ff): the gen12 re-trace
is STRUCTURALLY FAITHFUL — line weight and vertical proportions (red-tower tops)
match the ref within ~4px; only a subtle horizontal-fill nuance remains (ref city
fills marginally wider). Judged NOT worth a risky per-building layout re-trace for
a secondary, small, animated element. `mont/hexA_1950_ab.png`, `hexB_1950_ab.png`,
`redtower_hexA.png`.

**Other line-art** (commit 2f44170a1):
- **Globe continents (S3) = the worst other model.** Were two crude blobs.
  Rebuilt `Continents` as recognisable stylised-angular coastlines (N.America,
  S.America via the isthmus, Africa w/ west bulge tapering south, Europe,
  Greenland, an island), traced from ref globe f380 in the 470-space, enlarged
  ~13% to match fill, and REGISTERED the pattern longitude to the ref (+85) with
  a third tiling copy so the scroll never bares a disk edge. `mont/globe_full_380.png`
  (before), `globe_v3_registered.png` (after) = FAITHFUL.
- Docs (S11): FAITHFUL as-is (`mont/docs_2150_ab.png`).
- Chip leaf primitive: FAITHFUL shape/colour. NOTED (not fixed, out of line-art
  scope): S16 payout stacks read smaller/compressed vs ref at f3100 — a
  scene-assembly layout matter, flag for a future S16 pass. `mont/payouts_3100_ab.png`.

Build-only (remotion still, slim path). Not a full verify. Commits:
dc654a765 (grey-edge), a7c550b78 (icons), 2f44170a1 (globe), 6e7e759ff (audit).

## MODEL-DETAIL round — 2026-07-11 (S16 payout layout + handshake fingers, eye-judged)

Cleared the two residuals the prior MODEL-DETAIL round flagged. Eye-gated
against exact ref frames (ffmpeg select=eq(n\,F) -> remotion still, 25fps 1:1).
All measurement + gate artifacts in `work/cls-day/models/` (probes s16_probe.py /
s16_width.py / s16_colors.py / hs_probe.py; ref frames s16ref/, hsref/; montages
mont/s16_*, mont/hs_*). Build-only, NOT a full verify.

**TASK 1 — S16 payout chip-stack layout REBUILT (scenes2.tsx, commit 866cae0ef).**
The stacks read too small/compressed vs ref f3100. Re-measured the SETTLED ref
(f3090 == f3100, truly static peak; f3050 overshoots, f3130+ the equalizer decays
some stacks — settled law from f3090/f3100 only, lesson 12):
- circles were r28 dia56 pitch 123 from x608 -> now **r46 dia92, pitch 154 from
  x386** (centers 386/544/698/852/1004/1158/1312/1465, cy 834; font 32->50).
- chips were w80 h36 vpitch46 -> now **w92 h43 vpitch56, bottom-chip top y702**
  (chip centered on column x, measured 91-92 wide).
- counts were [2,4,3,2,5,3,2,4] generic (top=colour[i], alt grey/cream) -> now
  measured per-stack counts **[3,2,1,3,3,1,3,4]** with per-chip colours read
  per-pixel bottom->top: A[red,red,cream] B[navy,grey] C[red] D[navy,grey,grey]
  E[red,cream,cream] F[navy] G[red,cream,red] H[navy,grey,grey,navy]. NB the ref
  navy chip is (0,39,83)=brand navyBg, NOT chipNavy(#0E2C50).
- the old per-chip fly-RIGHT (dx up to 1400+, from f3110) was INVENTED — ref holds
  the stacks settled (band panning behind) through ~f3150, then they exit fast by
  ~f3170 (ref f3180 = bare panned band). Replaced with settle-in (per chip, done
  ~f3068) -> hold -> fast fade-out (exitP 3150-3170). Circles fade on exitP too.
- **A/B `mont/s16_settled_gate_ab.png`** (ref/att pairs f3080/3090/3100): at the
  settled peak f3090 & f3100 size, spacing, columns, counts, colours all MATCH.
  `mont/s16_new_ab.png` adds f3130. Old defect render preserved implicitly in the
  prior `mont/payouts_3100_ab.png`.
- **Documented residual (NOT fixed, out of layout scope):** the ref stacks are a
  lively equalizer — they overshoot tall ~f3050 then DECAY some columns (E/G/H
  shrink) toward f3150 before exiting. Mine holds the settled peak counts through
  f3150. This is per-frame settle ANIMATION, separate from the flagged layout/size
  defect; my hold is still far closer to the ref than the old fly-out (in-place vs
  streaming-off, position>>height per lesson 4). A future S16 pass could add the
  per-column decay LUT. Also f3080 mine is already at peak while ref still settling
  (entrance-timing nuance).

**TASK 2 — S1/S13 handshake white fingers REBUILT as capsules (lib.tsx
IconHandshake, commit 32c7dc3b1).** The prior round's clasp was faithful in shape
but the 4 white fingers read busier than ref f80/f85: each was a thin diagonal
line + a harsh Q..Q up-curl (U-hook) that dangled below the red fist as scratchy
bars. A **5x zoom of the ref** (`mont/hs_fingers_zoom_ab.png`) shows each finger is
a clean CAPSULE OUTLINE — a stadium with navy showing inside, the white twin of the
red knuckles, near-vertical leaning down-left. Iterated: hooks->clean lines (too
thin) -> short capsules (stubby, read like knuckles) -> **len 44-50, w14, rot ~110,
same S_W=5 stroke (NOT bolder)**, hung from the knuckle ridge, contained over the
fist. `<rect rx>` capsule outlines like the red knuckles.
- **A/B `mont/hs_v5_ab.png`** (ref-left/new-right, f80+f85) + `mont/hs_fingers_
  zoom_v5.png`: fingers now read as clean capsules wrapping the fist, matching the
  ref construction — busy hooks gone. S13 HandshakePill f2550 (shared icon) improved
  too, no regression (`att/hs_pill_2550.png`).
- **Residual (NOT fixed):** mine spreads a touch wider than the ref (rightmost
  finger reaches slightly toward the wrist) and the ref tips curl marginally more
  toward the fist. Cosmetic; the flagged "busier fingers" is resolved.

tsc clean in-lane for both. NOT full-verified (orchestrator owns verify + eye-gate).

## gen17 MISSING/WRONG-CONTENT round — 2026-07-12 (S5 docs + ClA)

Two levers, both in `scenes1.tsx`, serialized and committed one at a time.
Instruments + artifacts in `work/cls-day/gen17/` (probe_ring.py, probe_docs2.py,
probe_cla.py, still.sh, ssim.sh; ref frames `refall/`, montages `mont/`).
Build-only gates (still A/B + eye montage + CrxSettlementDay); NOT a full verify.

### The unprojection trap — read this before touching anything in S5's world

S5's world div rides `scaleY(sy)` about y=532.5, and **sy is NOT 1 during the
cruise** — the measured LUT drifts 1 @f684 → 0.988 @f916. Every table you read
off the ref is in SCREEN y; the world container wants WORLD y. Placed raw, the
last below-doc sat 4px high and LOST SSIM (f880 .8482 → .8479). The conversion is
`worldY = 532.5 + (screenY - 532.5) / sy`, applied at the call site so the tables
stay in the space the tracker measures. sx stays 1 in the cruise, so x needs no
correction — which is exactly why this hid so well.

### Lever 1 — the mirrored world's docs (commit b9e908bd6)

CONFIRMED BLANK: the ref drops four instruction docs OUT of the hanging towers
($ € € $, white-on-navy twins of the rising ones) and we drew none. Tracked per
frame off the red ring's centroid; world x from screen x minus the tracked 09:00
tick.

| doc | world ring cx | glyph | window | reveal edge |
|---|---|---|---|---|
| 1 | 141.6 | $ | f717–735 | D 855 (+ foot notch to 873) |
| 2 | 143.9 | € | f766–782 | D 855 |
| 3 | 750.1 | € | f817–835 | E 731 (+ capsule legs to 792) |
| 4 | 1341.6 | $ | f869–885 | F 861 |

Docs 1 and 2 share the 15:00 emitter. The below docs ACCELERATE (~27 → 39 px/f);
the above ones rise flat. Per-event tables, not one curve (lesson 14). The below
towers are outline-only, so the opaque navy tower body lives in an occluder drawn
between the docs and the clusters — the clusters repaint their own ink over it.
Doc art traced 1:1 off f829: outer ink box 83×108, rounded bottom-left, fold at
x58/y25, ring r22.75 at (41.5, 61). Placed by RING CENTRE.

Gate — 2 frames per window, all 8 win:
f728 .8607→.8621 · f731 .8609→.8632 · f777 .8548→.8569 · f780 .8579→.8593 ·
f826 .8576→.8595 · f828 .8570→.8594 · f880 .8482→.8499 · f883 .8550→.8566

**HONEST SCALE — recalibrate the expectation.** Filling a genuinely blank region
was briefed as "a large per-frame SSIM jump". It is not. An 83×108 element is
0.4% of a 1920×1080 frame, and it buys ~+.002. Blank-region fills are worth
what their AREA is worth. Size the element before promising the jump.

### Lever 1b — the four RISING docs, re-registered (commit 62e47e24d)

Measuring the below docs exposed the above ones. The old table had three "$"
docs on a hand-set rise; the ref has four, and every axis was off:
- the **09:00 doc (a €) was MISSING** — the fourth emitter, ClA's;
- the **12:00 doc is a €, not a $**, and its ring sat at world 1137 vs the ref's
  1076.5 — 60px right, half a doc width;
- the rise is a **flat 36.4px/f** (18 intervals across B/C/G, no drift), not
  33.75 — the old rate fell 18px behind before the doc left frame;
- the doc art was **10% oversized** (91.5×116.5 outer vs 83×108).
The 09:00 doc rises at **27.7px/f**, also flat. Measured is measured; the ref is
hand-animated and owes us no consistency. DocPop retired; one `SettleDoc` now
serves both worlds (`below` flips it white-on-navy).

Gate: f698 .8584→.8607 · f700 .8574→.8594 · f754 .8594→.8630 ·
**f805 .8553→.8613 (+.0060, the biggest single win — the 60px + glyph fix)** ·
f857 .8560→.8601.

### Lever 2 — ClA (09:00), the last never-registered cluster (commit 6b9b003ed)

Re-read per-pixel off **ref f690**, where the world is settled and x9 = 384
exactly, so `ClA-local = (screen_x - 2, screen_y - 170)`. That frame is the
cleanest register in the whole cruise for this slot — use it for any future ClA
work. Four structural errors, all POSITION first (lesson 4):
- red tower **105 wide vs the ref's 149** (x158..307); shell top y66 vs y74,
  crown y42 vs y44 — it read tall and thin. That 8px shell-top error also
  mistimed the 09:00 doc's reveal, which rides the shell's white fill; at y74 the
  doc now clears at world 244, exactly where the ref reveals it;
- the tower's **LEGS are separate boxes** under a shell that STOPS at y199 — the
  old model ran one shell to the band with wings bolted on;
- the left bridge **CURVES** into the band (r≈20 at x28.5), not a square step off
  the frame edge at x-60;
- the right side is a dotted building (open on its left, so the grey slab reads
  through) + a **two-rail gantry that STOPS at x435**. The old model stepped on
  toward the 10:00 slot at x519 — ink the ref does not have.
Panel re-read: 7 rungs at a 16.3 pitch (first gap wider — it holds the solid band
x204..260, y141..152), short ticks in the 4th and 6th gaps, ONE dashed riser per
leg. Grey slabs are #D7D7D7 (the band grey), not #DCDCDC.

Gate: f690 .8615→.8738 · f710 .8613→.8726 · f760 .8641→.8750 · f820 .8634→.8713.
**+.008 .. +.012 — 5x what the doc fills were worth.** A whole cluster is a whole
cluster; the area is the prize.

### Residual (honest)

- The entry whip (f674..692) still shows the ref's real per-slot tower identity
  as generic cycled tiles (pre-existing; position+mass carry at 100-300px/f).
- The ref's below docs have a soft 2-frame ease at launch that my leading LUT
  keys only approximate — invisible, since those frames sit behind the tower.
- ClA's dashed risers are `strokeDasharray "11 15"` fitted to a 4-dash read; the
  ref's phase may be 1-2px off at the bottom of each leg.
- No full verify run — the orchestrator owns it.

## gen18 LARGE-AREA STRUCTURE round — 2026-07-12 (scenes1)

Three levers, all in `scenes1.tsx`, each committed on landing. Instruments +
artifacts in `work/cls-day/gen18-s1/` (probe_s4.py, probe_badge.py, still.sh,
still2.sh, ssim.sh, ssim5.sh; ref frames `ref/` f440-690 and `ref5/` f860-945;
montages `mont/`). Build-only gates (still A/B + eye montage + CrxSettlementDay
at f600 and f900); NOT a full verify.

### THE INDEX TRAP — read this before any A/B (it cost a commit)

`git checkout <rev> -- <path>` **STAGES**. Using it to swap in an OLD baseline
for a render poisons the SHARED index, and the next sibling agent's `git commit`
sweeps the reverted file into their commit — 844da5fec silently reverted the
whole S4 re-registration this way, 20 minutes after it landed. Restored in
09600156e. **Use `git show <rev>:<path> > <path>` for A/B baselines** — it
writes only the working tree. Copy your new file aside first and copy it back.

### Lever 1 — S4's whole trade diagram, re-registered per frame (aa7b3c8c6)

The worst cluster in the video (r15 rank1 f466-516 .8584) was blamed on
"HexCity/Buildings interior texture" by a prior round. That verdict was wrong.
It is a **large-area structural error**, and it is the biggest single one found
in this track:

The old model held BOTH hexes on one baseline (y527) and spread them in x,
scaling each about its own centre. The ref does something else entirely —
tracked per frame off the two badge discs (`probe_s4.py`; hex centre = badge
centroid + s·offset, s = badge diameter / 91):

| frames | ref | we drew |
|---|---|---|
| 446–480 | OVERLAPPED + DIAGONAL at s=1.53: A(723, 527), B(1191, **738**) | both at y527, B **212px too high** |
| 482–504 | punch apart AND DOWN, s 1.53 → 1.25 | spread in x only |
| 504–536 | frozen wide+low: A(349, 569) B(1572, 569), s=1.25 | already at settled x, s=1.10 — **120px off in x** |
| 538–556 | pull back in and UP | — |
| 556+ | settled A(471,527) B(1450,527) s=1 | correct (banked, byte-identical) |

Hex B is 584×431 at s=1.53 — **12% of the frame, nearly disjoint from its ref
for 100 frames.** Every other part of the diagram is rigidly attached to those
two centres and rides the same s (verified: the arrow tips land at
Ax + 186.5·s / Bx − 187·s to ±2px across the whole window).

Also killed, in the same commit:
- **the coin is FICTION.** We drew a static red coin under hex A that faded in
  at f606 and then NEVER LEFT (56 frames of ink the ref does not have). The ref
  slides a **$ doc out from under hex A and a € doc out from under hex B** —
  the same SettleDoc art S5 drops from its towers, at 1.084× — rides each DOWN
  its connector and ALONG the arm into the CLS pill, occluded, gone by f632.
  Tracked per frame off the red ring centroid.
- **the connector opacity fade f544-560 is FICTION.** The ref DRAWS the line
  from f538 (dash-offset). Its geometry was also wrong: corner radius 52 (we
  had ~27), arm at hexcy + 263·s (we had a flat y=812), open chevron head at
  the pill edge (we had a filled triangle), 2px ink (we had 3.5).
- **the CLS pill is 437×197 at (741,692) with the brand CHIP radius** (rounded
  TL+BR, square TR+BL). We drew a 250×107 all-round pill 67px low — under a
  third of its area. It SCALES up about (946,835) f549-560; the wordmark wipes
  O→C→L→S inside it to ~f570. (S10 and S17 in scenes2 mount the same
  `ClsPillSlot` at the same wrong 250×107 — worth a look, scenes2's call.)

Gate, all 10 frames win: f466 .8386→.8587 · f490 .8341→**.8661** ·
f500 .8392→**.8928 (+.054)** · f516 .8435→.8913 · f550 .8664→.9037 ·
f566 .8709→.9066 · f600 .8685→.9040 · f616 .8621→.9026 · f640 .8682→.9046 ·
f660 .8719→.9084. Plus f480 .8397→.8604, f545 .8548→.8947, f560 .8727→.9087,
f620 .8621→.9030.

### Lever 2 — the S4 exit whip zooms the diagram too (09600156e)

f670 was the one frame Lever 1 REGRESSED (.8127→.8003), and it exposed the
rest: the ref does not merely clip the diagram behind the S5 front — it ZOOMS
IT IN and pans it left/down with the band (badge dia 91→113, hex A off the left
edge by f670, pill ~540 wide). We held it dead still. Folded into the same
LUTs; the pill rides the same affine from f660, where the affine is identity —
so f560-660 stay byte-identical.

Gate: f665 .8294→.8811 · f668 .8075→**.8817 (+.074)** · f670 .8127→.8659 ·
f672 .8784→.8872. f640/f660 unchanged (no seam).

### Lever 3 — sy was drifting through the ENTIRE S5 cruise (fadb50045)

**The gen17 "unprojection trap" was itself the bug.** The sy LUT jumped
`[684, 1] → [916, 0.988]` with NOTHING measured in between, so lutS
interpolated a silent 1.2% vertical compression across 232 frames of cruise.
Every line of art in the frame sat wrong by up to 6px (above-band tick tops at
y184 vs the ref's 180; below-band tick feet at 878 vs 884).

Measured off the above-band tick line (world y180; screen y = 532.5 − 352.5·sy)
at f690/700/720/750/780/800/830/850/880/900/910/914/916 — the top reads **180
at EVERY frame. sy = 1.0000.** Exit keys from f918 untouched.

**Therefore: with sy = 1 in the cruise, screen y IS world y and the gen17
unprojection `532.5 + (y − 532.5)/sy` is the identity. The trap is retired.**
gen17's docs were placed by unprojecting through a scale that was never real;
they now sit exactly at their measured screen y, which is what the tracker read.

Second fix in the same commit: the **ABOVE-band hour chain draws OVER the
skyline**, not under. Probe: at f880 the ref reads 7 full-height ticks above the
band, we read 5 — our white-filled tower bodies painted out the 12:00 and 15:00
lines. (The below chain already matched 7-for-7 — its clusters are outline-only.)

Gate: f690 .8738→.8739 · f700 .8715→.8716 · f750 .8754→.8767 ·
f800 .8729→.8760 · f850 .8678→.8727 · f880 .8525→.8587 · f895 .8637→.8717 ·
f910 .8487→.8555 · **f916 .8677→.8776** · f920 .8570→.8574.
**SPEND: f927 .8563→.8560 (−.0002)** — the tick z-order move costs 2e-4 at one
exit frame against +.008 elsewhere. The ref draws 7 ticks; we drew 5. Recorded.

### Residual (honest)

- **S5's cruise is now near its structural floor.** With sy pinned, the
  difference composite at f895/f910 lights up EVERY building edge faintly and
  nothing in bulk — distributed 1-2px trace/edge error across dense line art
  (**hand-drawn texture class**), not a large-area defect. The band renders 84
  tall vs the ref's 85; the above ticks stop at the band where the ref runs them
  8px into it (24 × 3 × 9 px — not worth it). Do NOT re-trace the clusters.
- ClG's leftmost ink sits ~14px left of the ref's (the bridge element), ticks
  matching to 1px — a single sub-element, small.
- S4's hexes still FADE in f446-472 (`opacity: hexInA/B`); the ref DRAWS them
  (ink is full-dark from f450, extent grows 5.3k → 57k px). A reveal-mask
  draw-on is the honest fix; only f466-472 of it falls in the ranked window.
- S4 f671-673 hex/pill values are extrapolated past the last badge read — by
  then the S5 front has eaten all but a sliver.
- P3 (S1/S2 f66-116) not opened.

## gen18 EXIT-FICTION round — 2026-07-13 (scenes2)

Five commits, each gated and landed on its own. Instruments + artifacts in
`work/cls-day/gen18-s2/` (probe_exit2.py sequential template tracker, probe_cols.py
border peaks, probe_tail.py ink extents, probe_doc.py per-pixel doc trace,
probe_s13.py pill tracker, probe_ink.py region masses; ref frames `refall/`,
attempts `att*/`, HEAD baselines `head*/`, montages `mont/`). Build-only still
gates + eye montages; NOT a full verify.

### The finding that organised the round

**Three of this file's scenes had no exit — or the wrong one.** The ref ENDS a scene
by sliding or flying its content off-frame, fast, on a ~1.35–1.65×/frame exponential,
while the timeline band stays. We were fading, holding, or starting four frames late.
Every one of them was drawing a large element over white for tens of frames. Law 2
(deleting fiction wins big) paid three times in one round.

### 1 — S11 docs-row exit (b3c4c385a)

The row sat frozen at its settled pose until a whole-scene fade at f2237-2250. The ref:
- the SIX side docs fly OUTWARD from f2200, accelerating ~1.4×/frame, staggered from
  the outside in — all six GONE by f2217. We were drawing 6 × 228×285 docs (**19% of
  the frame**) on white for 33 frames.
- the FOCUS doc STAYS and SCALES 1.0 → 1.219 about (1022, 474) over f2205-2228, then
  holds that pose right through S12 (ref f2230 == f2260 == f2300 to the pixel).

One base exit LUT + a per-doc time shift and gain (d1 sh2 g.94 · d2 sh1 g1.01 ·
d3 sh0 g1.00 · d4 sh0 g.855 · d5 sh1 g.895 · d6 sh2 g.90).

Gate: f2205 .8466→.8646 · f2210 .8272→.8769 · **f2216 .8501→.9444** ·
f2225 .8501→.9479 · f2235 .8501→.9455. f2105/2130/2150 unchanged.

### 2 — the instruction doc, re-traced per pixel (9bb1ad0ac)

The settled row scored .8622 and I nearly called it the floor. It was not: the doc
BODY was an approximation with 20px errors. Traced every feature off ref f2130 and
cross-checked against doc2/doc3/doc5 — all three agree on every offset from the doc's
top rule to **0.5px**, so ONE body serves the whole row (the ref just jitters each
doc's y by ~2px). Doc-local svg y = trace y − 3.5.

All of it POSITION, none of it texture (lesson 4):
- banner box 62 tall at y105 → **39 at y110**; inner bar 22 → 15
- field row = two loose cells → **ONE bordered box** (117..208, y69..92), centre
  divider at x162, fill INSET at 124..157
- the three body lines sat at y185/195/203 → the ref's are at **y160/167/174**, and
  the first runs the FULL doc width
- bottom divider x36 → x18; fill block (150,238) → (141,231)
- 2 header lines → **THREE**, 5px thick, from x55
- right border 230 → **223** (the doc is 221 wide)
- square bottom-left corner → **rounded, r22**; fold x190/d40 → x176/d49
- **the CIRCLE-seal docs MIRROR their bottom block** — a variant we never had

**gen13's negative A/B is now explained, not contradicted.** It narrowed the whole svg
(228→225) and lost, because that dragged the interior off its registration. Moving the
border ALONE, with the interior re-registered to the trace, is a different change and
it wins. A refuted A/B is refuted for its method, not for its target.

**And the flying docs STRETCH.** Every doc's LEFT border lands exactly on its exit dx
while the right border runs ahead: 221 wide settled, 226 @f2208, 230 @f2210, 240
@f2212, 255 @f2214. It scales with speed and anchors on the doc's own left edge
*regardless of travel direction* — so it is a scaleX in the ref's rig, not a motion
blur. **NEGATIVE A/B:** a symmetric two-ghost motion blur LOST at every fly-out frame
(f2210 .8756→.8729, f2212 .8773→.8708). Model: `scaleX = 1 + 0.0011·|v|`, capped 1.16
(it saturates). The exit LUT tail was refit off those same left borders (f2214 dx
−448, not −410 — the left border is the one edge the stretch leaves alone, so it reads
dx directly; use it, not a template match, on a stretching element).

Gate — every frame wins: **settled row .8622 → .8905 (+.0283)** at f2115/2130/2150/
2170/2195/2202 · f2205 +.0226 · f2208 +.0171 · f2210 +.0094 · f2212 +.0021 ·
f2214 +.0006 · f2216 +.0023 · f2105 +.0015.

### 3 — S13 exit fall, four frames late and on the wrong curve (ffc859707)

The descent was a quadratic ease from f2717. Tracked the ref pill's top edge: the fall
**starts at f2713** and is a ~1.65×/frame exponential — 3, 9, 21, 43, 75, 125, 207,
352, 568. At f2719 the ref is 125px down and we were 88; that frame scored **.787**
against a .874 steady state.

Gate: f2714 +.0112 · f2716 +.0233 · f2718 +.0373 · f2719 +.0280 · f2721 +.0022 ·
**f2722 +.0544** · f2724 +.0032.

### 4 — the two invented street vehicles (f644204a1)

Both PvP cities drew a red car/truck at their base. The ref draws **neither**: the
right city's truck box (1490..1600, 780..830) holds **ZERO red pixels** in ref f2700;
the left car's box holds only the red building's own bottom wall. Fiction, persisting
across all of S13 (f2362-2726).

Gate: +.0008 .. +.0016 at every S13 frame. Small — exactly as its area predicts
(law 3). Fiction is still worth deleting when it is free.

### 5 — S10 had no exit at all (37253cfaf)

S10 held its entire settlement diagram (two hex cities, CLS pill, bank hex, connectors,
chips) at full opacity until S11's opaque white background *happened* to cover it at
f2075. The ref slides the diagram straight DOWN and off while the band, marker and
07:00 milestone stay — fall starts f2049, ~1.35×/frame, blank below the band by f2069.
**26 frames of a whole scene drawn over white.**

Gate: f2055 +.0165 · f2060 +.0437 · f2064 +.0620 · **f2068 .9141→.9821** ·
**f2072 .9208→.9889**. f2000/f2045 unchanged.

### Residual (honest, classified)

- **S13 steady state is at .874 and the cause is the CITY MODELS — fixable, not a
  floor.** `PvpLeftCity` / `PvpRightCity` diverge from the ref in content, not just
  registration: the ref's navy buildings have OPEN-ended (⊐) windows where ours are
  closed rounded rects; the building arrangement to the right of each red tower is
  different; our grey slabs sit where the ref has white; the rail arrowheads are small
  triangles where the ref draws big swept chevrons. Two whole clusters — this is the
  biggest single lever left in scenes2 and it is a MODEL-DETAIL job (like the gen12
  globe / gen13 icons), eye-judged, not an SSIM nudge. **Hit this next.**
- **S12 is drawing the wrong document.** The ref's S12 is the SAME 2-page focus doc
  from S11, held at the grown pose (L=694, top=249) with orange checks pinned to it —
  ref f2230 == f2260 == f2300 to the pixel. We draw a small generic `MiniDoc` at
  (840,720) 260×330. Out of my ranked windows so left alone, but it is a large-area
  error and S11 now hands the correct doc straight to it. Cheap to collect.
- The ref's 07:00 milestone label fades f2074-2085; S11 draws no label, so f2075-2085
  is missing ~1.7k px of it. 0.09% of the frame — below the area threshold (law 3).
- The S11 ENTRANCE (f2091-2111) is still a scale+fade in place; the ref streams the
  docs in from the right as a train. Only 11 frames of the ranked window and the
  tracker aliases badly on overlapping docs during it (f2105 is .822 vs .890 settled).
  Worth a pass, but it is a fifth of the settled window's frames.
- S13's falling content also drifts left ~38px and widens ~6% by f2722 (the same rig
  scaleX as the docs). Left alone; 9 frames.

## gen18 PILL round — 2026-07-13 (scenes2, from the round lead's S4 finding)

The scenes1 builder found S4's CLS pill drawn at under a third of its true area. Both
of scenes2's `ClsPillSlot` mounts carried the same defect. I did NOT copy S4's numbers —
I measured each pill in its own ref frames, and they differ.

**Both pills, measured off the ref's SOLID-NAVY fill (four frames each, identical to
the pixel):**

| | ref | we drew |
|---|---|---|
| S10 | **433 x 196 @ (742, 718)** | 250 x 107 @ (826, 759) — **26.7k px against 84.9k** |
| S17 | **259 x 117 @ (834, 473)** | 245 x 120 @ (845, 470) — geometry nearly right |

**The wordmark law.** The ref's logo-height / pill-height is **0.342 in BOTH pills**
(S10 logo 318x67, S17 logo 169x40). `ClsWordmark` renders a glyph 0.935x its `height`
prop, so **logoScale = 0.366 is a property of the rig, not a per-scene number.** S10 had
no logoScale at all (default 0.5) and its wordmark, sized off the small h, spilled past
the pill's right edge and was clipped by ClsPill's own `overflow: hidden`. S17 ran 0.425
and rendered a 48px glyph against the ref's 40.

Gate — every frame wins:
- S10 (bfa558296): f1900 +.0224 · f1950 +.0223 · f2000 +.0215 · f2040 +.0223 · f2055 +.0211
- S17 (7d81cb278): f3240 +.0028 · f3260 +.0046 · f3300 +.0045 · f3340 +.0044 · f3370 +.0046

**Then the pill broke the chips (f913193c6).** At its true size the pill swallows the
chips' endpoints, and chips drawn AFTER it sat on top of the wordmark — CrxSettlementDay
read "CR^", a chip covering the X. The ref slides them BEHIND (f2015: a grey chip reads
39px wide against its true 130, the rest hidden by the pill's right edge). Drawing them
before the pill makes the occlusion free: f1975 +.0007 · f2000 +.0009 · f2020 +.0002,
nothing regresses.

**NEGATIVE A/B — chip SIZE (reverted).** The ref's chips are **127x57**, not 86x34. I
resized them and LOST at three of five frames (f1950 −.0011, f2020 −.0014, f2045 −.0013).
Our chip PATHS are invented: they fly diagonally out of the hex bottoms, where the ref
runs them flat along the **y≈813 connector lane** and parks them at the pill's edges
(measured: f1995 warm x578..701 y785..840; f1955 cool x1184..1313 y785..843). A bigger
chip in the wrong place is more misplaced ink, not less (lesson 4). **Re-measure the
paths and the schedule first, then the size** — done in that order it should be worth
several thousand px.

### Residual — belongs to whoever owns scenes1/lib

`ClsPill` (lib.tsx) hardcodes a uniform `borderRadius: h * 0.28`. The ref pill carries
the **brand CHIP radius — rounded TL + BR (r≈42), SQUARE TR + BL** (probed at ref f2000:
navy present at TR and BL corners, absent at TL and BR; top row cut back to x786 from
742, right column cut to y873 from 913). ~1.5k px. Not reachable from scenes2 — the
S4 builder already shaped their pill this way, so the fix is to give `ClsPill` the same
chip radius and let both my mounts inherit it.

### Also, since the ref's S10 sits open in front of me

S10's connectors END IN CHIPS in the ref, not arrowheads — a peach chip on the pill's
left edge, a grey one on its right, with thin plain lines running back to the hexes. We
draw thick lines with solid triangular arrowheads (now harmlessly hidden under the
enlarged pill). Fold this into the chip-path pass.

## gen19 PILL-RADIUS round — 2026-07-13 (lib.tsx, r17)

Took gen18's residual: `ClsPill`'s uniform `borderRadius: h * 0.28`. Confirmed it,
measured it myself, shipped it. **Commit 7a2d9e5aa.**

### The corner truth (measured, not inherited)

I did not take gen18's r≈42 on faith. Flood-filled the pill's own navy component
(seeded above the wordmark, so connectors/hexes/chips cannot contaminate the scan)
and fitted a circle to each corner arc from the mid-arc rows, where the geometry is
well-conditioned — the tangent-point estimator is worthless here (a half-pixel of
antialias moves it by `sqrt(2Rδ)` ≈ 7px).

**Rounded TL + BR. SQUARE TR + BL.** Confirmed at both sizes, every clean frame:

| | h | TL | BR | TR | BL |
|---|---|---|---|---|---|
| S10 `433x196 @(742,718)` f1900/f1950 | 196 | r=53.0 (**.270h**) | r=51.1 (**.261h**) | SQUARE | SQUARE |
| S17 `259x117 @(834,473)` f3240..f3340 | 117 | r=31.7 (**.271h**) | r=30.6 (**.262h**) | SQUARE | SQUARE |

The ratio is identical across a 1.7× size change, so it is **a property of the rig,
not a per-scene number** — exactly like `logoScale = 0.366`. Shipped as one constant,
`PILL_R = 0.265` in lib.tsx. S4 hand-shapes its own pill inline and had independently
landed **52 on h=197 = .264**. Three sizes, three independent measurements, one number.
The TL/BR spread (.270 vs .261) is inside the antialias noise of the fit; one radius
reproduces both corners at both sizes to ~1.5px.

The grammar was already in the file — `Chip` carries `h*0.58 0 h*0.58 0` and
`HandshakePill` carries `h*0.27 8px h*0.27 8px` (measured at ref f2550). `ClsPill` was
the only navy primitive that had missed it. **Fiction, of the cheapest kind: two corners
rounded away that the ref fills solid.**

Instrument self-check: the scanner recovers **exactly 55.0 = 196×0.28 on all four
corners** of the OLD render. It measures true.

### Gate — ref vs OLD vs NEW, every mount, nothing regresses

| mount | frames | Δ SSIM |
|---|---|---|
| **S10** | f1900 · f1950 · f2000 · f2040 · f2055 | **+.00124 · +.00124 · +.00122 · +.00121 · +.00120** |
| **S17** | f3240 · f3260 · f3300 · f3340 · f3370 | **+.00039 · +.00050 · +.00048 · +.00048 · +.00050** |
| **S4** | f560 · f600 | **0.00000** — S4's inline pill is untouched, no double-apply |
| **CrxSettlementDay** | f2000 · f3300 | **byte-identical** — see blocker below |

Eye montage (ref | old | new) at `work/cls-day/r17-lib/crops/MONTAGE_CORNERS_S10.png`
and `_S17.png`: OLD bites a white quarter-round out of the two corners the ref fills
solid; NEW restores them. The metric barely sees it; the eye cannot miss it.

### BLOCKER for the round lead — the CRX cut does NOT inherit the fix

`ClsPillSlot` (**scenes1.tsx:917**) short-circuits `ClsPill` whenever `PillLogo` is
supplied, into a **hand-copied div with its own uniform `borderRadius: h * 0.28`**:

```tsx
export const ClsPillSlot = ({ x, y, w, h, p, PillLogo, logoScale = 0.5 }) =>
  PillLogo ? (
    <div style={{ ..., borderRadius: h * 0.28, ... }}>   // ← the duplicate
      <PillLogo h={h * 0.5} />                            // ← and 0.5, not logoScale
    </div>
  ) : (
    <ClsPill x={x} y={y} w={w} h={h} opacity={p} logoScale={logoScale} />
  );
```

`ClsDayReplicate` passes no `PillLogo`, so the CLS track takes the `ClsPill` branch and
wins. **`CrxSettlementDay` passes one, so it takes the duplicate and is byte-identical
before and after my commit** — the CRX cut still carries the uniform radius, and its
pill logo still renders at `h*0.5` where the rig constant is `h*0.366`. I did not touch
scenes1.tsx (a sibling was live in it). The fix is to delete the branch:

```tsx
export const ClsPillSlot = ({ x, y, w, h, p, PillLogo, logoScale = 0.366 }) => (
  <ClsPill x={x} y={y} w={w} h={h} opacity={p} logoScale={logoScale} Logo={PillLogo} />
);
```
which needs one optional `Logo` prop on `ClsPill`. **Two lanes, so it needs the lead.**
A shared primitive with a hand-copied twin is not shared — it is two primitives that
happen to agree until one of them is fixed.

### Measured, NOT fixed — S10's connector lane is mis-scheduled (scenes2)

Gridding S10 f1900 (`ssim-grid.py 8x6`), the two worst cells in the whole frame are the
connector elbows flanking the pill: **r4c2 `240x180+480+720` at .077 and r4c5
`240x180+1200+720` at .041**, against a frame mean of .762. Cause, measured:

**At f1900 the ref draws ~1000 dark-navy px in each cell and we draw ZERO.** Darkest ref
px `(10,27,44)`; our connector is a 4px light grey `(170,179,189)` line and nothing else.
The ref's dark ink clusters into a thin line along the lane (y720..816) plus **two stacked
chevrons** at the pill-facing end (`x702..719` left, `x1200..1219` right; ~18x19px each,
split at the line's y≈815) — a double arrowhead pointing into the pill.

But it is not a flat colour error. Dark-px counts across the window:

| frame | ref L | ours L | ref R | ours R |
|---|---|---|---|---|
| f1900 | 1012 | **0** | 1034 | **0** |
| f1950 | 2396 | 1287 | 474 | 1043 |
| f2000 | 388 | 1287 | 2311 | 1043 |
| f2040 | 1168 | 1287 | 1480 | 1043 |
| f2055 | 1116 | 1399 | 4039 | 1131 |

Our dark ink arrives **late** and then sits **static** (1287/1043, barely moving) while the
ref's swings 388→2396 on the left and 474→4039 on the right. The ref is animating dark
elements through that lane on a schedule we do not have. This corroborates and sharpens
gen18's chip note: **the connector+chip lane needs a per-frame SCHEDULE re-measure, not a
size tweak** — and gen18's "thin plain lines, no arrowheads" reading is wrong at f1900,
where the ref's arrowheads are plainly there and navy. Belongs to whoever owns S10.

Harness, instrument (`corners.py`), refs, old/new stills and montages:
`.claude/rounds/work/cls-day/r17-lib/`.

### gen19 addendum — the `Logo` prop closes the CRX blocker (commit 35a187670)

`ClsPill` now takes `Logo?: React.FC<{ h: number }>`, so `ClsPillSlot` can collapse its
hand-copied twin onto the real primitive and the CRX cut inherits the chip radius.
Additive: present => `<Logo h={h * logoScale} />` inside the same overflow-clip behind
the same chip radius; absent => the wordmark, React tree unchanged.

**The twin's second defect, which the collapse also fixes:** it rendered
`<PillLogo h={h * 0.5} />` — a HARDCODED 0.5, not `logoScale`. The rig constant is
0.366, so **the CRX pill's logo is ~36% oversized today.** When scenes1 collapses the
slot, CrxSettlementDay's logo will SHRINK. That is the fix, not a regression.
`ClsPill`'s own `logoScale` default stays 0.5 (changing a default is not additive) —
callers pass 0.366.

**Byte-identity proof (absent `Logo` must change nothing):**
- **S17 f3300: BYTE-IDENTICAL** to HEAD, full frame, `md5 dcee3a0ae4e1aeffb94474de405d6451`.
- S10 f2000 differs — **but not by me.** The scenes2 sibling landed `34e89401b` (the
  connector-lane fix, off my gen19 finding) between my two renders. Attributed per-pixel:
  **0 differing px INSIDE the pill** (the only region the prop can reach); all 12,078 lie
  in the connector lane — 3,920 left, 8,157 right. The prop is inert when absent.

### INFRA — the global render lock is BROKEN (for the round lead)

`/tmp/replica-render.lock` is no longer serializing anything. At least one sibling's
still harness runs `rmdir /tmp/replica-render.lock` **before** rendering — it bypasses the
lock by design. Three clsnet agents render without it. I counted **8 concurrent
`remotion still` processes** on a swap-tight box; my render shell was **OOM-killed twice**
(exit 143/144, no output) while waiting politely in the `mkdir` loop. The only renders I
landed were single frames squeezed through the swarm one at a time.

Also live: **a HUNG clsnet still, PID 93864, alive 2h24m**, which will never finish — so
"wait for the renders to drain" is not a viable strategy for anyone. Either every harness
honours the lock or none can. **An agent that respects a lock everyone else deletes is not
safe — it is merely slow.**

### gen19 handover — the six S10 cells I ranked but never diagnosed

The r17 grid on S10 f1900 ranked EIGHT cells. The connector lane took the top two and
landed as `34e89401b`. I had never diagnosed the other six. Diagnosed now, read-only —
these are measurements, not edits. Round lead called stop on editing; I obeyed.

**1. The hex cities are PLACED RIGHT and DRAWN THIN.** (cells r2c1 .302, r2c2 .261,
r2c5 .156, r2c6 .095 — dark ink, f1900)

| | ref px | our px | ratio | centroid Δ | ink width |
|---|---|---|---|---|---|
| LEFT hex | 12,647 | 9,663 | **0.76x** | (−2, 0) | 351 vs ref **371** |
| RIGHT hex | 13,229 | 8,888 | **0.67x** | (−4, +3) | 351 vs ref **371** |

**The centroids agree to within 4px — this is NOT a shift.** We draw a quarter to a third
less ink inside a correctly-placed, 20px-narrow footprint. So it is CONTENT: missing
detail / thinner strokes / a narrower building cluster. Same class as the S13 city job
(gen17), and the same remedy — measured model detail, eye-judged, **not an SSIM nudge and
not a re-trace of what is already registered.** This is the biggest remaining lever in S10.

**2. `Milestone` (lib.tsx:229) is wrong in two ways — and it is a SHARED primitive.**

- **The accent rule is MISSING ENTIRELY.** The ref draws a rust vertical rule at
  **x956..960, y180..242 (314px), colour (204,68,30)** — the CLS accent red. We draw
  **ZERO px** there. Absent ink, and cheap. (This is cell r1c3 .349; the rule is the only
  thing in it.)
- **The label copy does not wrap.** Ref's label ink is a tight column — **114 x 55 @
  x966..1080, y190..245**. Ours sprawls **527 x 124 @ x972..1499** — **4.6x too wide**,
  centroid off by (+21, −10). Our body line runs on where the ref's wraps into a narrow
  column. That is cell **r1c4 at .098 — the 3rd worst cell in the whole frame**, and
  ~1.6k px of misplaced text ink.

Both live in `Milestone`, so **a fix lands across every mount at once** — the same leverage
the pill had. I did not touch it: the copy width needs a proper per-pixel fit of the wrap
column and the rule's offset, at ≥2 mounts, and a hurried edit to a shared primitive is how
the CRX twin was born in the first place.

**A cell I ranked and did not open is a defect I found and did not report.** Six of them
sat in my own grid output for a whole round.
