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

## Round 3 (2026-07-19) — queue + fiction sweep. SCORE 87.5 (+2.1)
(video SSIM .8633 · keyframe .8045 · color .9866 · duration .9992; artifacts
lseg-{framessim,keyframes,verify}-r3.*; attempt work/lseg/r3/attempt-r3.mp4;
measurement scratch work/lseg/r3/; commits 1e855f7ca..49552bd0b + this)

### S8 CLASSIFIED VERDICT (law 9; per-keyframe grids at 13 frames f1303-1447)
Every keyframe's worst cells were r2c3/r3c3/r3c4 (center = caption+cube).
Classification of the r2 residual, adjudicated by instrument:
- FIXABLE, FIXED: cube pose — the ref cube TUMBLES (yaw LINEAR 0.0153
  rad/f; the fit predicts both face-on frames 1351/1455), pitch ~0.49,
  roll ~-0.02, center (960,505) and size ~230 SCREEN-FIXED. r2's
  plate-riding corner pose was 30-40deg wrong. Instruments: DT fitters
  collapse on night clutter (3 failures documented); what worked =
  hand-read silhouette hulls -> Hungarian-assignment vertex fit ->
  DT local polish, eye-gated. CUBE_POSE table, 6 anchors.
- FIXABLE, FIXED: captions 7-11% oversized and low (ref cap-height 66.5
  -> font 93 + per-caption tracking, left-aligned at ref ink-left,
  cap-top 500.5); plate 0.5-1.0% small (NCC boost ramp); r2's outer ring
  leaked a royal border EVERY frame (scale clamped >=1).
- FLOOR (reference-self-contradiction / video texture): timelapse life —
  static-patch NCC at BEST registration decays .978->.947 across the
  scene (lights flicker, water shimmers, boats move). Dominates the
  remaining residual (~55-60%). Plus Avenir-vs-brand glyph shapes (~2%
  area) and minor inpaint scars under the ring.
- STILL FIXABLE (r4): per-frame plate registration (my ramp is 2-key),
  cube anchor densification/polish (5-20px residuals at anchors).
Gates: f1290 .650->.688, f1387 .571->.720, f1455 .565->.733 (crop gates
+.05-.09); S8 windows .66-.68 -> .74-.80. Honest S8 floor est ~.80-.85.

### Queue results (rolling-window means r2 -> r3)
1. S8 1303-1447 (.66-.68) -> .739/.782/.799 (+.06-.12)
2. S4 entry 470-518 (.687) -> .687 net-flat: center column fixed (+75px
   error, NCC .94-1.00 track; f510 .478->.550, f514 .569->.678 mp4) but
   the window is dominated by MEASURED CEILINGS: earth tile rotates, dot
   tile is a morphing halftone (16.5px FFT at entry, 12.9-15.5 by f506 —
   dense lattice match LOST, negative A/B in-code; bg now flat #0129F2)
3. belt exit 942-990 (.711) -> ~.73-.79: motion-gated dots (flat wins
   +.12-.15 while belt moves — law 4 extended: absent beats misplaced
   even vs sparse), texture window tightened [976,1008] by NCC
4. wipe 1017-1065 (.727) -> .803 (+.076): trailing panel dotless
   (+.11-.20 sim), S7_D verified EXACT vs per-2f edge scan (r2 stands)
5. B3 zoom 1099-1147 (.759) -> .788 (+.029): zoom center refit c=995
   from navy edge pairs (r2's 1100 caught the cover), train window
   widens with z (div was frozen at 460 while content zoomed)

### Fiction sweep finds (two questions per scene; contact sheets)
- S5 IS A SETTLE-AND-CLOSE, not an endless conveyor: belt decelerates
  into a HOLD at f722 (rows frozen 299/525/758 through 746), frame lines
  at y200/873 from ~674 (content clipped to the band), then the lines
  CLOSE 746-774 wiping items, royal blank, cut ramps 780-781. r0's
  -190px/s forever + crossfading 3 photos was double fiction: ref has
  FIVE right-photo phases (two clips extracted fresh: s5-clip2 f650,
  s5-clip4 f698). Gates: f650 .766->.953, f700 .722->.938, f690 +.21.
- S5->S6 cut is 781 not 783 (f781 .517->.768).
- B4 map was 25f LATE: ref text pops (no fade) at f1150. B3 caption must
  die under the expanding cover 1144-1146 (z-order moved; it overstayed
  to 1201 in r2).
- B5 crowd wedge: bg is NAVY not royalTile; the wedge is an ERODING CLIP
  over FIXED content (apex 345@1230 -> 554@1260 -> 702@1271): translating
  the photo lost -0.37, freezing lost -.07-.14; clip + late-frame second
  asset (crossfade 1245-1249) wins: f1210 .53->.74, f1230 .79->.96,
  f1260 .89->.98, f1271 .81->.89.
- Lockup ink-metered: ref caps ~20% taller than Georgia's at matched
  width (scaleY 1.2 both blocks, RISK closer+higher); the END lockup's
  RISK block is genuinely 0.59x (ink 258w vs S1 436w).
- S3a caption: font 75 (was 58) on its OWN measured track — r1's
  tablet-rider + x1001 clip was cutting live text from f185.
- f340 right-edge royal band suspicion: refuted (pan offset ~35px only).

### Instrument findings
- imread(path, IMREAD_GRAYSCALE) DISAGREES with cvtColor(BGR2GRAY) and
  the disagreement is FILE-DEPENDENT (ffmpeg-written vs remotion-written
  PNGs carry different gamma chunks): whole-frame gates biased ~-0.08
  against remotion stills. The crowd "regression" was gate artifact.
  Standing rule: decode color, cvtColor, always.
- The mp4-proxy gate needs same-GOP-phase caution: fresh segment
  encodes read ~-0.01 vs mid-GOP attempt frames on texture (S4 early).
- Wedge apex color-threshold scans drift with exposure (the late apex
  "motion" was real here, but the same scan earlier produced a false
  translate — the clip-vs-translate distinction only fell to A/B).

### Round-4 queue (worst windows after r3, with honest estimates)
1. 478-526 (.687) — S4 entry: mostly measured ceiling now (rotating
   earth interior + morphing halftone). Fixable slice: per-frame column
   regfit residuals, boardroom content scale. est +.005-.01 composite.
2. 960-1008 (.725) — B2 entrance: B2_TXT re-verify during shrink,
   woman-photo entry track (B2_PL is 3-key), dots-belt edge. est +.01.
3. 1294-1438 (.74-.80) — S8: per-frame plate registration + cube anchor
   densification (12 anchors), caption glyph floor. est +.003-.005.
4. 912-960 (.796) — B1 exit: archer/confetti reveal geometry during the
   fast push. est +.005.
5. 526-574 / 430-478 (.82) — S4 settle + earth full-bleed: earth
   rotates (ceiling); skyline title metrics measurable. est +.005.
6. 260-308 (.833) — dev/office blur zone: documented negative A/B
   (r2), likely floor.
PLATEAU ASSESSMENT: not yet. r4 can honestly buy +1.0-1.5 (mostly items
1-4 + residual sweep). Beyond r4 the measured ceilings dominate: live
halftones (3 windows), S8 timelapse (144f), rotating earth (~90f),
video-clip panel interiors (S2/S3/S5/S6 people move). Asymptote with
current assets ~= 89-90. A round 5+ grinds <0.5.
(r4 verdict: the +1.0-1.5 was optimistic — S8/S4 shares were ceiling
double-counted; actual r4 buy +0.4. See CLOSING below.)

## Round 4 (2026-07-19) — CLOSING ROUND. SCORE 87.9 (+0.4). CAMPAIGN PLATEAU.
(video SSIM .8680 · keyframe .8110 · color .9874 · duration .9992;
artifacts lseg-{framessim,keyframes,verify}-r4.*; attempt
work/lseg/r4/attempt-r4-rescue.mp4; scratch work/lseg/r4/;
commits 999db200e..this)

### Campaign trajectory
r1 80.4 -> r2 85.4 -> r3 87.5 -> r4 87.9. Global framessim .794 -> .868.

### Queue results (what each item actually bought)
1. S8 plate registration: CEILING CONFIRMED — per-frame NCC regfit at 17
   frames shows r3's 2-key boost ramp already at the floor (<=0.2% scale,
   <=2px offset residual everywhere). No change shipped.
   Cube densification: SHIPPED (8->19 anchors, DT polish on ref-temporal
   clutter masks — r3's att-based masks unusable now HEAD's cube sits ON
   the ref lines; fit beat the seed at all 17 anchors, eye-gated at 6) —
   but composite S8 windows FLAT (.739/.781/.798): the 2.6px wireframe is
   invisible to SSIM under timelapse texture (law 8 — geometry+eye
   adjudicated the keep). S8 residual is now ~all timelapse floor.
2. B2 entrance 964-1012: .725 -> .750 (+.025). The buy was structural:
   B1 ARCHER CONTENT WAS COVER-SCALED FICTION — ref pins the photo at
   native scale (asset-NCC .99+ f912-980, entering 1.19->1.0 by f948),
   translates it with the belt and only CLIPS it; the old stripW mount
   rescaled continuously and left a white band from f966 (whole 445x178
   thumbnail by f984). B1_ARCH track. Gates +.07-.10 across f918-972.
   B2_TXT/B2_PL re-verified registered (no ranked cells). f996-1008
   left-band cells adjudicated: live halftone (same density, other phase).
3. S4 entry 477-525: .687 -> .692. Cell-by-cell adjudication:
   - FIXED: S4 CENTER IS TWO TRACKS — [credit-card+skyline] group rides
     S4_CC ~7.5% ahead of boardroom's S4_C (card NCC .998+ f518-550;
     skyline slot colors constant in group coords), and the card tile
     shows 198px of EXTRA photo above its settled crop during entry
     (cc-tall.png from f526). f520 +.092, f526 +.052, f534 crop +.106.
     Pre-518 stays on S4_C (0.925-ratio extrapolation lost at f514).
   - CEILING: gherkin registered (NCC d=7px — the apparent 100px offset
     was blur illusion); dot tile brightness already matched (p99 193 vs
     204), density = morphing halftone; NEGATIVE A/B in-code: synthetic
     vertical Gaussian smear on the dropping columns loses 5/6 gates
     (isotropic-per-axis blur is not directional exposure smear).
4. B1/S4 slices: absorbed by items 2-3 (B1 exit window 912-960 left the
   bottom-14 list entirely; 526-574 likewise).
5. Sweep finds (all shipped, gated):
   - Train pane f1092+: panelMotion s-column IS the layout zoom — the
     460*z width already applies it; stacking both pushed content +50-60px
     right (suitcase off-pane). Piecewise at the f1091 anchor (identity
     both sides). f1104 +.016, f1130 +.019, f1080 held.
   - B4 map title ink-metered: font 66->80, lineHeight 1.375, top 421.5
     (ref cap bands y448-505/558-615). f1160/f1180 +.005.
   - B3 caption GHOST-FADES over the cover+young map (band p99
     201@1144 -> floor@1152), not instant death. f1146-f1152 +.004-.005.
   - S4 skyline title sat 21px LOW and 9% narrow: top 485, ls 4.7.
     Crop gates f560 .750->.836, f576 .692->.771, f600 .664->.748.
6. Fiction pass (two questions, all scenes):
   - S5 ITEMS FADE IN (~12f, measured starts 618/638/654/678/702); ours
     popped. clip2 cut is 640 not 641 (f640 .781->.940!). f644/f660 +.01.
   - S2 TYPING IS AN S-CURVE ending ~f125; the linear ramp ran 270-320px
     of ink short mid-line. New render ink-registers +-22px. PERCEPTUAL
     SPEND (recorded): crop -.011/-.013 at f118/f122 — the metric prefers
     our own well-matched pane photo over Avenir-glyph text; schedule is
     measured truth (law 26).
   - LAW-24 REVERSAL: r3's "end RISK block 0.59x" was a MID-FADE
     threshold artifact. Settled ref ink x961-1403 (442w ~= S1's 436).
     Override dropped; f1590 crop .774->.790.
   - Vindicated by measurement: B1_ARCHER_H edge table (ref white-row at
     f900 = 124 ~= table 130 — the contact-sheet "defect" was a misread);
     f190/f250/f850 thumbnails anomalies refuted (wholes .87/.87/.80).

### Keyframe-target verdicts (r3 -> r4)
kf10 t=20s .611 -> .611 CEILING (rotating earth tile + morphing halftone +
  directional smear dominate the frame; every ranked cell adjudicated)
kf27 t=54s .663 -> .663 CEILING (S8 timelapse life; cube geometry-exact)
kf3  t=6s  .676 -> .677 CEILING (S2 video-clip panel interiors evolve)
kf28 t=56s .677 -> .679 CEILING (S8 timelapse)
kf11 t=22s .680 -> .714 FIXED (+.034, S4 two-track center + cc-tall)
Bonus: kf20 t=40s .700 -> .809 (+.109, archer mount); kf12 t=24s +.007.

### MEASURED-CEILING LEDGER (what NEW ASSETS could still buy)
1. S8 dublin timelapse (f1275-1474, worst windows .74-.80): a MOVING
   plate (video clip of the actual timelapse, or per-10f plate series)
   buys the .978->.947 NCC decay back — est +0.5-0.8 composite. The cube
   and captions are now at their floor.
2. Live halftones (3 zones: S4 dot tile, S7 belt+wipe, B3 rail;
   windows 964-1068 residuals): only a FRAME-SYNCED dot texture series
   (re-crop per 4-8f from the ref) beats flat/lattice — est +0.3-0.5.
3. Rotating earth (f428-516): an earth VIDEO clip or ~10-frame tile
   series — est +0.2-0.3 (kf9 .711 and half of kf10's residual).
4. Video-clip panel interiors (S2 belt f126-174, S3 blur zone 260-308,
   S5 right photos, S6 people): per-phase re-crops every ~8f —
   est +0.3-0.5 spread thin over ~150f.
5. Real LSEG brand fonts (sans + flared serif): the Avenir/Georgia glyph
   gap costs ~1-2% on every text frame and is the recorded S2-typing
   spend — est +0.2-0.4.
Sum if ALL new-asset lanes were bought: ~89.5-90.5 — matches the r3
asymptote estimate, but every remaining point now requires new assets,
none is reachable by measurement/schedule work on the current ones.

### PLATEAU DECLARATION
Campaign PLATEAU at 87.9. Score < 88.5, but a round 5 on current assets
has NO identified fixable area: every bottom-window grid cell is now
either fixed, negative-A/B'd in-code, or instrument-classified as
texture/timelapse/glyph ceiling. r3's "asymptote 89-90 with current
assets" was optimistic by ~1.5 — the S8/S4 estimates double-counted
residual that the instruments now attribute to the plates themselves.
Reopen ONLY with new assets (ledger above), highest-value first: moving
dublin plate, frame-synced halftone series, earth clip, brand fonts.
