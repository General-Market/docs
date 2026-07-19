# STATE — lseg (LSEG World-Check On Demand replicate)

Mission: 1:1 rebuild of `public/lseg-replicate/original.mp4` (1920x1080, 24fps,
1609f). Comp `Lseg-Replicate` + `Lseg-SideBySide` in
`src/compositions/replicates/lseg/`. Slim pubdir: `.claude/rounds/pubdir/lseg`
(needs crx-assets/fonts + netgrowth-assets/fonts clones for the entry's
module-scope font loads).

## Scene map (frames @24)
- S1 [0,103) blue plate #001BFD, serif lockup gradient-wash reveal, Shibuya wedge top-right
- S2 [103,166) handshake|verification split, "What if you could manage risk..." types
- S3a [166,220) eye macro + city chevron + "the moment it appears" + man-tablet
- S3b [220,478) phone-touch → developer pan (12.5s pose x455 → x830) → office →
  "now you can" band → earth rise + "LSEG World-Check On Demand"
- S4 [478,614) mosaic; center conveyor c: 21s:0 → 22s:-805 → 24s:-830; skyline stack top 1095
- S5 [614,780) checklist conveyor -190px/s, items pitch 232, right duotone photo crossfades
- S6 [780,889) handshake color-reveal + containers rail → payment triptych slide-in
- S7 [889,1275) increase accuracy / your customers / no more waiting|blind spots /
  dotted world map (data.ts MAP_GRID sampled from f050) / crowd wedge
- S8 [1275,1609] Dublin plate + wireframe cube (yaw .785+.003f, pitch -.42, size 272,
  center 958,505) + 4 captions → "Now" on #0C29FD → lockup

## Round 0 (2026-07-18) — first build
Probe SSIM (att vs ref same-frame): 60:.92 130:.60 200:.59 240:.65 300:.47(was .34)
460:.63 550:.55(was .45) 700:.72 800:.78 870:.51 920:.73 1000:.57 1100:.70
1230:.73(was .44) 1260:.85 1320:.38 1500:.99 1590:.98

Known ceilings: S8 Dublin is moving timelapse in the ref — static plate ceiling
measured 0.44 at f1320. S2/S5/S6 panels are video clips in the ref (people move);
stills cap those windows too.

## Open gaps (ranked)
1. Ref panels are video, ours stills — inherent unless sub-clips are re-scoped as photos.
2. S3 dev/office pan is 3-keyframe approximation; ref pans continuously (t12.5→t16.2).
3. S4 side-column stacks approximate (~40px errors); card/skyline gap tuned, sides not re-measured.
4. handshake-glass.png carries a faint baked "W" (no clean ref frame exists before text).
5. navy-skyline.png carries baked "LSEG World-Check" title; DOM text doubles over it.
6. S7 B1 conveyor drift is linear approx; ref panel schedule not binary-searched yet.
7. Cube pose fitted by eye at f055 only; per-caption pose keys not measured.
8. S1 wedge clip polygon eyeballed; internal seam line not drawn.
9. Earth is a still (mosaic-tile upscale); ref earth rotates.
10. Typeface: Avenir Next subs the LSEG brand sans; Georgia subs the logotype serif.

## Round 1 (2026-07-18) — isolation + measured motion. SCORE 80.4
(video SSIM .794 · keyframe .707 · color .932 · duration .999; artifacts
lseg-{verify,framessim,keyframes}-r1.*; attempt mp4 work/lseg/r1/attempt-r1.mp4;
all 1609 ref frames extracted at work/lseg/refall/)

### Asset isolation (33/33 swept; public/ is gitignored — assets NOT in git)
- Inpainted baked text: earth.png title, navy-skyline.png title (re-cropped
  f560 true-settle first), handshake-glass.png "Wha" (at x345-535 y585-655,
  not the x60-250 the round-0 log guessed). dublin re-cropped f1280→f1275
  (f1280 carried the baked cube wireframe). Zero assets now carry baked
  text/UI the comp draws as DOM.
- New crops: office-pan (1131x1080, f428), developer-pan (1451x1080, f300),
  phone-touch-full (1920x1080, f224), earth-full (f450, title inpainted),
  solar-panels (478x260, f486), archer-tall (1082x434, f960),
  shibuya-wedge (686x796, f83). Per-asset source-frame ledger in the r1
  asset-agent report; 5 original files re-cropped, backups work/lseg/iso/.

### Structural re-measurements (the big finds — ref ≠ round-0 scene model)
- S2 [126,166): the "static split" starts SCROLLING left at f126 and
  accelerates to -287px/f — one continuous conveyor through S3a to the cut
  at f220 (S2_SCROLL, S3A_* tables). Typed line is x349/cap-top y534/em~84
  and RIDES the scroll. Panels that stream through mid-conveyor (afro woman,
  woman-at-wall, glass silhouette, train-platform) are NOT built — round-2
  asset work. CEILING on windows 126-176 until then.
- S3a: panels never settle; eye+chevron overshoot and keep exiting left
  (-426px by f216) while man-tablet trails ~350px behind (parallax);
  caption rides the tablet layer behind a screen-fixed clip at x1001.
- S3b: dev panel PUSHES IN from the LEFT (not right) behind a widening
  royal gap (DEV_EDGE/PHONE_EDGE bar-tracked); phone-touch slides off
  right; then ONE pan group [office|dev] drifts +276px to the crossfade
  (S3B_GROUP_DX, template-tracked, never settles). "now you can" band:
  x643 y476 633x108, grows f377-393, text #051EEE ~92px at x676.
- Earth enters by 6-frame CROSSFADE [428,433] (not a rise), title riding in;
  measured title: centered, cap 506-573, em~96 (round-0 had 76 and a
  translateY rise — fiction).
- S4 completely re-choreographed from tracks: earth tile shrinks f477-505
  (EARTH_TILE rect table) then rides the center column up and out (~f516);
  center column runs c=+1583→0 decelerating f494-546 (S4_C); side columns
  slide down ~500px and NEVER stop drifting (+96px by f612, S4_S); settled
  layout re-derived from f560 edge scans (S4_LEFT/RIGHT/CENTER) — the royal
  tile round-0 put under the skyline does not exist in the ref (white);
  skyline tile carries the "LSEG World-Check" title (DOM now, 80px cap-top
  506, fades in [537,545]) and EXPANDS about (961.5,539) f590-613 into a
  hard cut to the S5 royal plate at f614 (SKY_EXPAND).
- S7 B1 is not a drifting layout: converging REVEAL strips — archer bottom
  edge grows 56→462 (B1_ARCHER_H), confetti top settles at 943 then recedes
  to 1080 (B1_CONFETTI_TOP), caption rides down-right to (515,565)
  (B1_TEXT_X/Y). The round-0 [30,-40] drift and the r1 template track that
  said "+520 slide-up" were both false (early matches hit the triptych).
- S1 wedge: true diagonal apex (1234,312), top corner (1284,0), exit
  (1920,790), plus a measured 6px white seam on the lower edge only.
  NEGATIVE A/B (in-code note): mounting the old 680x760 crop stretched to
  686x796 lost -0.073 at f60 — re-crop, never stretch (law 4/19). Proper
  crop: f60 .922→.936.
- Panel internal motion: all 30 panels measured (panel-motion.json);
  stills now driven via PANEL_MOTION + panelMotion() anchored at each
  asset's source frame. Real movers: phone-touch dx+291, train-woman zoom
  1.145, dublin zoom-OUT 0.886, earth dx-31, paris push 1.04. archer/
  confetti PANEL_MOTION entries are NOT used (suspected edge-motion
  artifacts — B1 uses reveal-edge tables instead; do not re-wire without
  re-measuring inside the strip only).

### A/B ledger (whole-frame still SSIM vs ref, old→new)
f130 .599→.661 · f150 .416→.526 · f200 .586→.896 · f230 .764→.882 ·
f245 .590→.795 · f258 .521→.769 · f290 .403→.781 · f310 .415→.802 ·
f400 .349→.957 · f430 .320→.800 · f460 .643→.702 · f490 .453→.489 ·
f510 .311→.458 · f530 .487→.700 · f560 .586→.735 · f600 .559→.701 ·
f612 .528→.688 · f870 .514→.521 · f930 .679→.692 · f950 .649→.665 ·
f1100 .698→.786 · f1140 .651→.706 · f1290 .429→.462 · f1380 .405→.434 ·
f1460 .400→.433 · f60 .922→.936. Flat/negligible: f108, f700, f930-off.

### Documented ceilings
- S2/S3a conveyor mid-stream panels absent (windows 126-176): needs ~5 new
  panel crops + per-panel parallax; blurred source frames only.
- S4 entry f478-506: sides are a DIFFERENT sub-column collage (solar tile
  built; skyscraper-closeup/dark/face sub-tiles not); S4_S pre-506 is an
  extrapolation.
- Non-rigid interiors (crowd, confetti, waterfall, shibuya crowd, glass
  reflections in handshake-glass, dev-screen typing): camera move only.
- S8 dublin is moving timelapse; static plate + measured zoom-out ceiling
  ~0.44-0.58 in the worst windows.
- Typeface subs (Avenir Next / Georgia) unchanged.

### Cube (S8) — instrument failure, logged
Chamfer fit (fwd-only) collapsed to size≈1 (metric rewards absence);
symmetric chamfer diverged (cost 50-113px) — the night-scene white clutter
(lit windows, reflections) swamps the 2.6px wireframe. Eye-gated overlay
fix only: size 272→215, center (963,508); gains small (+.03 at f1290..1460
mostly from dublin re-crop+zoom). Round-2: hue/saturation-gated line mask +
per-caption pose keys, then interpolate.

### Round-2 priorities (worst 2s rolling windows after r1)
1. 961-1057 (.55/.60) — S7 B2 "your customers" + B2→B3: layout never
   re-measured; entrance schedules approximate.
2. 1394-1442 / 1299-1347 (.58) — S8: cube pose keys + caption geometry
   (dublin ceiling caps this; measure the honest floor).
3. 478-526 (.65) — S4 entry sub-columns (assets exist only partially).
4. 824-872 (.65) — S6 handshake exit→triptych entrance (agent flagged
   handshake slides out from ~f806 — not modeled).
5. 872-920 (.73) — S6→B1 handoff (B1 rails during entrance are static).
6. 126-174 (.76) — S2 conveyor panels (asset work).
Also: office/dev pre-f280 reveal is extrapolated (dx table starts at
measured f280); verify-replication tsc gate dies on the untracked sibling
yc-pitch file — r1 verify ran with it temporarily moved aside (restored).

## Round 2 (2026-07-18) — fiction hunt on the round-2 queue. SCORE 85.4 (+5.0)
(video SSIM .8397 · keyframe .7749 · color .9807 · duration .9992)

### Queue results (window means, mp4 composite r1 -> r2)
1. S7 B2/B3 961-1057:  .574 -> .724 (+.150)
2. S8 1394-1442:       .577 -> .662 (+.086) · 1299-1347: .579 -> .681 (+.102)
3. S4 entry 478-526:   .651 -> .691 (+.040)
4. S6 exit 824-872:    .651 -> .889 (+.238)
5. S6->B1 872-920:     .726 -> .861 (+.135)
6. S2 belt 126-174:    .763 -> .834 (+.070)
x. office/dev 220-280: .835 -> .848 (+.012)
   B1 889-961:         .737 -> .794 (+.057) · whole: .794 -> .840

### Round-3 priorities (worst 2s rolling windows after r2)
1. 1303-1447 (.66-.68, three contiguous windows) — S8 dublin: sits near the
   measured timelapse floor; remaining fixable ink = cube yaw refinement
   (landmark fitters collapse; needs a better instrument), water/lights are
   ceiling. Demand a classified per-keyframe verdict before spending here.
2. 470-518 (.687) — S4 entry: earth-tile interior (ref earth ROTATES —
   ceiling), center-column cyan band timing, side-column residuals.
3. 942-990 (.711) — S7 belt exit: dot-halftone live-pattern ceiling zone +
   B1 strip content during the fast push (cover-scale approximation).
4. 1017-1065 (.727) — B2->B3 wipe: photo push-out parallax approximate
   (PT table 3 keys), B3 text metrics during wipe.
5. 1099-1147 (.759) — B3 zoom phase: dot region live-pattern ceiling,
   train content zoom (panel-motion anchor vs measured pane edge).

(commits b20bb40a1 → this round; artifacts lseg-*-r2.*; attempt mp4
work/lseg/r2/attempt-r2.mp4; measurement scratch work/lseg/r2/)

### The big structural finds (fiction laws paid the round)
- S7 IS ONE CONVEYOR. B1's rails never hold still: left cyan column widens
  108→475 (S7_CR), the cyan/royal boundary rises 1080→266 (S7_CYB), the dot
  rail slides 1810→1443 then accelerates off with the whole belt (S7_DL);
  B2 rides 750px behind the rail (card = DL+750); B3 arrives as a dot rail
  (B3_R) then a shared vertical WIPE (S7_D: navy+train drop from y0 while
  B2's card/text/photo push out the bottom). After settle the B3 layout
  zooms about x=1100 (B3_Z, fitted center — recovered independently from
  both navy edges, law 37) and the navy expands left-then-right (f1144-52)
  into the full-frame plate B4's map fades onto. r1's slide-in/slide-over
  B2/B3 model was wholesale fiction.
- CAPTIONS ENTER OVERSIZED AND SHRINK. B1 "increase accuracy" scales
  1.76x→1x while drifting (B1_TXT [l,t,w] per-frame track), then rides the
  belt out; B2 "your customers" enters at ~114px and lands at ~80px
  (B2_TXT). r1's static captions were fictions of stillness. B2 text
  calibrated to ±4px against ref ink bboxes.
- S6 REMEASURED END TO END: handshake pops FULL-BLEED at the f783 cut
  (sequence re-cut 780→783), the [gap|containers] assembly slides in from
  the right, everything drifts right +9/f, then the photo exits right on a
  clean NCC content-dx track (S6_DX, score 1.000, scale 1.00 — no zoom).
  The triptych enters from the LEFT decelerating (S6_RL) — r1 slid it in
  from the right (direction fiction); its panels were re-cropped from the
  settled f870 plate (street 559w / phone-term 797w / royal 61w / sky 503w;
  f870 still now scores .999).
- S8: THE CUBE LIVES IN PLATE SPACE. Its sky apex is constant at plate
  (988,84) across the scene — the cube rides the dublin zoom-out with only
  a slow yaw drift (CUBE_YAW 0.67→0.83, front edge vertical at f1414);
  r1's screen-fixed rotating cube (yaw+0.003/f) was fiction. Size 215→257
  (plate), pitch -0.55, center (985,554). Chamfer/LSQ fitters still
  collapse on the night clutter (size slams the lower bound; landmark LSQ
  RMS 61px) — final pose is landmark+overlay-gated, not fitter-trusted.
- S8 CAPTIONS: swap INSTANTLY (white-mask counts jump in <=2f), windows
  [1281,1334)/[1334,1368)/[1368,1408)/[1408,1463), all gone at 1463 —
  r1's faded schedule was up to 30f late on swap 3/4. Font ~104 (was 76),
  centered x~970, cap-top 495.
- S8 BORDER FICTION: scaling the f1275 plate below 1.0 exposed a royal
  ring the ref never shows. Outer ring now filled by an f1437 plate with
  cube+caption cv2-inpainted (dublin-outer.png) — its scars stay hidden
  under the interior plate. Plus a real bug: the dublin PANEL_MOTION
  s-column is already relative to the f1275 asset; anchor-normalizing at
  1275 clamped to the first row (0.9625) and inflated the plate 4%.
- S4 ENTRY: the sides run on SEPARATE offset tracks (S4_SL/S4_SR, ~50px
  apart mid-drop); r1's single extrapolated track was ~250px wrong at f490
  (-755 actual vs -480). The stacks extend below screen: gherkin is 772
  tall (full-height re-crop from f498 + measured 1.13→0.95 internal zoom
  S4_GZ), then lightBlue cyan2 at 1608 and solar at 2031 (r1's solar at
  y1180 was displaced fiction); right column: dot tile is 937 tall (not
  500) with cyan2 below at 1917; a cyan band rides above the earth tile.
- S4 SETTLED TILES: gherkin/credit-card/container crops carried the WRONG
  content (gherkin cells NEGATIVE ssim) — re-cropped from the settled f560
  plate (gherkin2/credit-card2/container2). f560 .717→.823 (png).
- S2 mid-conveyor panels extracted and mounted at belt coords:
  afro-polka@1936 (f150), woman-wall@2765 (f158), teal-glass@3620 (f163),
  train-platform@4485 (f165). f158 .648→.860. The "missing left panel" at
  f138 is the video-clip ceiling (same clip, people moved), not an asset.
- Office/dev pan measured f274-280 by NCC (score 1.0; r1's +40/f
  extrapolation was 2.6x too slow there).

### Instrument findings
- THE DOT PANEL IS A LIVE HALFTONE. Pitch is 15-19px varying across the
  panel (r0's drawn 22px lattice anticorrelates: grid cells 0.04-0.27);
  but NCC of ANY crop decays to ~0.13 within +-40f — the pattern
  re-renders continuously. Documented ceiling: texture (dots-belt.png,
  f990) used only in its valid window f963-1008 with a measured parallax
  vs the rail (DOT_PARA — the pattern slides faster than the belt);
  sparse lattice elsewhere (misplaced dense ink loses to absent, law 4).
  f990 .707→.935.
- mp4-vs-mp4 codec bonus is HUGE on blurred/photographic windows (up to
  +0.15 at f270, +0.08-0.13 in S4 entry, ~+0.10 in S8): r1's framessim
  numbers are NOT comparable to png-still gates there. All r2 A/Bs were
  re-based same-pipeline (r1 attempt frame extracted to png) before any
  keep/revert call.
- NEGATIVE A/B (in data.ts): pushing the measured office/dev NCC trend
  into the unmeasurable blur zone f262-272 LOST (-0.09 at f270) — r1's
  shallower line wins there; kink kept deliberately.

### A/B ledger (png-still vs ref, same-pipeline r1→r2)
f784-800: .834→.990 (f800) · f815 .708→.868 · f820 .709→.855 ·
f826 .658→.744 · f846 .568→.751 · f870 .669→.999 · f884 .664→.692 ·
f906 .757→.822 · f930 .733 (wash) · f960 .667→.712 · f975 .449→.689 ·
f990 .574→.935 · f1005-1035 ~.54→.68-.73 · f1044 .614→.728 ·
f1056 .709→.731 · f1070 .786→.772* · f1100 .819→.745* · f1150 .718→.771
(*png basis; same-pipeline r1-png at 1414 was .479 vs r2 .570)
S8: f1290 .603→.651 · f1320 .573→.584 · f1350 .587→.594 · f1414 .578→.570*
· f1455 .581→.572* (r1-png .479 at 1414 — mp4 numbers inflated)
S4: f482 .569→.614 · f490 .511→.562 · f498 .497→.640 · f506 .483→.524 ·
f514 .516→.583 · f560 .717→.823 (r1-png bases)
S2: f138 .717→.767 · f146 .681→.804 · f150 .812→.855 · f154 .751→.895 ·
f158 .648→.860 · f163 .558→.679

### Ceilings measured this round
- Dot halftone: live pattern, ~0.13 NCC outside +-40f of any crop.
- Dublin: with true zoom + full-bleed ring the bg floor sits ~.57-.65
  (was claimed .44-.58): remaining residual is timelapse life (lights,
  water), the rotating earth (S4), and panel-clip interiors.
- S2 f126-150 left panels: same video clip evolving (silhouette at f138
  is the handshake-glass clip later in time) — content ceiling.

### New assets (public/ gitignored; cloned into pubdir/lseg)
handshake-full(f784) containers-wide(f788) street-blur2/phone-terminal2/
sky2(f870) woman-phone-wide(f1014) dots-belt(f990) dots-s4(f484, unused —
lattice won) gherkin2(f520) gherkin-full(f498) credit-card2(f560)
container2(f560) dublin-outer(f1437, inpainted) afro-polka(f150)
woman-wall(f158) teal-glass(f163) train-platform(f165)
