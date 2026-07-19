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
