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
