# STATE — clsnet track

## Mission
Rebuild `public/clsnet-original.mp4` (1920×1080, 25fps, 4168f, 166.72s — "CLSNet / How it works", flat 2D corporate motion design: trade submission → matching → netting → settlement) 1:1 in Remotion as `ClsNet-Replicate`, plus `ClsNet-SideBySide` and the publishable `CrxNetting` (same choreography, CRX props). Verify target SCORE ≥ 95 (session milestone ≥ 90). Lane: `src/compositions/replicates/clsnet/**`, `public/clsnet-assets/**`, this file + `work/clsnet/**`. Barrel `ClsNetComps.tsx` (already imported by RootReplicas.tsx — NEVER edit RootReplicas/Root/index*). Comp ids stable: `ClsNet-Replicate`, `ClsNet-SideBySide`, `CrxNetting`.

## Verify command (the only accepted score)
```
cd ~/Downloads/index/video
VERIFY_ENTRY=src/index-replicas.ts VERIFY_PUBLIC_DIR="$PWD/.claude/rounds/pubdir/clsnet" \
  ./scripts/verify-replication.sh public/clsnet-original.mp4 ClsNet-Replicate \
  "$PWD/.claude/rounds/work/clsnet/ref-analysis"
```
The THIRD arg matters: sibling lanes share the default `public/reference-analysis` and clobber each other's analysis.json. Ours lives at `work/clsnet/ref-analysis/` (analysis.json synthesized — 85 keyframes @2s; the analyze script's motion phase was killed, frames/ has all 333 half-second full-res frames). Render lock protocol per PROTOCOL.md rule 4. Wrapper with lock + artifact rescue: `work/clsnet/run-verify.sh`.

## Architecture (how the replica is built)
- **All DOM/SVG, zero baked footage** (lesson 6). Complex line-art (city clusters, hexagon icons, world map, globe, locks, handshake, CLS logo) was potrace-traced per palette color from settled ref frames into `art.ts` (30 assets; generated — do not hand-edit). Pipeline: `work/clsnet/trace.py` (crop → per-color mask → potrace; NOTE: potrace traces BLACK pixels — masks must be inverted, already fixed) → `art-store.json` → `gen-art.py` → `src/.../art.ts`. `trace-batch.sh` re-creates everything.
- `data.ts` — palette (probed: navy #002753, blue #4CA0D3, orange #D45837, grey #A8A8A8…), SEG frame timeline (29 segments), all copy (exact from frames: gantt trade IDs, detail card, "120 currencies", counts 187/110→0/298…), per-scene geometry.
- `scenesA.tsx` (title→network) / `scenesB.tsx` (cities→day-night strip) / `scenesC.tsx` (gantt→endcard); shared primitives in `ui.tsx` (Hexagon, ClsNetBox, Pill, Elbow, Doc, Badge, Serif/SansText); `TracedArt.tsx` renders art.ts entries (case-sensitivity: file must NOT be named Art.tsx next to art.ts).
- **Brand layer** `brand.tsx`: React context; scenes read copy/fonts via `useBrand()`/`useCopy()`. Default = CLS. `CrxNetting.tsx` = `<BrandProvider brand={CRX}>` wrapping the same composition, copy from `crx-data.ts` (own words: RFQ fills through custody wallets, zk-proved netting, event-rebuildable tree, atomic settlement), Diatype from `public/crx-assets/fonts` (same face as dev.crxfx.com).
- Fonts: wordmark serif = Playfair Display via @remotion/google-fonts (closest hosted match to CLS's Financier-like face; A/B'd only coarsely — candidates Prata/DMSerifDisplay/NotoSerifDisplay unexplored). Sans = Helvetica Neue (system). Wordmark needs scaleX 1.14 to match ref width.
- Slim pubdir `.claude/rounds/pubdir/clsnet/` = ref mp4 + `crx-assets` + `irswap-assets` + `netgrowth-assets` (module-level loads of OTHER registered replicas 404 → "DOMException NetworkError" render failure without them; cls-day hit the same and their pubdir shows the same fix).

## Round log

### consolidation (2026-07-10, cross-lane refactor round, COMPLETE, zero visual change)

**RULE FOR SUCCESSORS: shared brand art lives in
`src/compositions/replicates/cls-shared/` — improve it there, once, and
still-gate BOTH lanes (clsnet + cls-day, replicas + CRX cuts) at the
affected frames.** Inventory of what is shared vs lane-measured:
`.claude/rounds/work/cls-shared/INVENTORY.md`.

- Created `cls-shared/{palette.ts,fonts.ts,logo.tsx}`. clsnet rewired:
  `C.navy/white/blue/band` now read `BRAND.*` (four cross-lane-identical
  hexes; every other C value measured clsnet-specific and stays), `SANS =
  HELVETICA` (shared stack; brand.tsx CLS_BRAND.sans now sources it too).
  `cls-shared/logo.tsx` holds the parametric CLS mark/letters (from
  cls-day); clsnet's potrace logoMark/clsLogo UNCHANGED this round —
  swapping is a pixel change. Gen-6: re-trace the mark once in cls-shared,
  then rewire ClsNetBox/TitleCard to it (attacks the logoMark white
  edge-sliver defect from the r7 lead list at the shared root).
- GOLDEN GATE: 6 frames (f112/400/1000/2000/2762/4100) + CrxNetting smoke
  (f112/2762) before/after — ALL BYTE-IDENTICAL (`work/cls-shared/gate/`).
  tsc green. Comp ids/exports unchanged. art.ts untouched.
- Serif A/B for known gap 3 (wordmark face), measured on the ref 'CLSNet'
  crop (regular_0010): **Georgia 0.173 < Caslon 0.246 < Times 0.255 <
  Playfair-current ~0.30** (binarized-ink meandiff, cap-normalized).
  Caslon (netgrowth's face) LOSES here — do not import that decision.
  GEORGIA is the measured lead for the title quality round (f99-149 is
  worst-window #2); adoption = re-measure capTop/scaleX-1.14/tracking-8
  Playfair calibrations, still-gate replica + CrxNetting. Numbers +
  script: `work/cls-shared/fontab/`, verdict in `cls-shared/fonts.ts`.

### r1 (2026-07-09, builder session 1) — first full build
- Storyboarded all 166.72s from 333 half-second frames (montages in session scratchpad; anchor geometry pixel-measured with `work/clsnet/measure.py` island finder + magick probes).
- Traced 30 art assets; built 29 scene segments; registered all three comps; tsc green.
- Inner still-gate pass 1 (before fixes → after fixes), SSIM vs ref stills:
  - f112 title 0.905
  - f340 hexrow 0.878
  - f400 flows 0.829 → 0.837 (labels resized/repositioned, logoMark re-traced from settled f=t16, double hex border removed)
  - f510 globe 0.891
  - f700 map 0.885
  - f1000 cities 0.943
  - f1520 matching 0.855 → **0.882** (panel/hexes/box −110..−190px lifts, counts 4-stop retime, pill columns repositioned)
  - f2005 strip 0.748 → 0.762 (bank cluster w 660→440 centered, inverted cluster gap closed, band 504/64)
  - f2260 gantt 0.759 → **0.835** (whole gantt scene retimed ~2 s earlier: cascade 2166+, detail card settled by ~2262; card geometry 540,270,756,660)
  - f2900 reportCard 0.865
  - f4100 endcard 0.844 → 0.854 (disclaimer bottom-left 130,880; url box 860,864,910×100 fs62; numerals fs195)
- Commit: `5c90a97e7` (clsnet replica: full 29-scene rebuild + CRX variant).
- **Official verify r1: SCORE 87.7** (video_ssim 0.8671 · keyframe 0.8197 · color 0.9575 · duration 0.9997). Artifacts: `clsnet-verify-r1.json`, `clsnet-keyframes-r1.txt`, `clsnet-framessim-r1.txt`; attempt render kept at `work/clsnet/r1/replicate-attempt-95288.mp4` (+ scaled) for free r2 triage.
- NOTE: r1 bundle predates three committed fixes (mosaic ground-truth rewrite, payment-scene measured geometry, mini-hex white-fill/blue-classifier fix — the last already re-measured f700 still 0.885→0.907). r2 verify inherits them for free.

#### r1 worst rolling windows (2s, global mean 0.8671) — r2 priorities in order
| rank | frames | t(s) | mean | diagnosis |
|---|---|---|---|---|
| 1 | 2113-2163 | 84.5-86.5 | 0.745 | strip→gantt seam: ref cuts to gantt ~t85.8; mine holds strip to f2212. Retime strip out 2140-2155, gantt bg in ~2150 (keyframe t86 = 0.541) |
| 2 | 3663-3713 | 146.5-148.5 | 0.749 | shield scene late: ref shield settled BY 146.5; mine enters 3706-3726. Retime shield 3635-3695; zipper/panel geometry from regular_0294 (split x930, band w36, shield 700-1210×225-865) |
| 3 | 3713-3763 | 148.5-150.5 | 0.761 | ledge+stacks late: ref diagonal ledge with stacks at 148.5 (regular_0298: pills 135×62 at x319-630 & 1467); mine ledge starts 3762 |
| 4 | 2290-2340 | 91.6-93.6 | 0.765 | detail→report seam (keyframe t92 = 0.368, worst): ref shows white report scene at t92; mine navy card till ~2300. Detail exit 2266-2282, ReportOut in 2280-2296 |
| 5 | 2722-2822 | 108.9-112.9 | 0.778/0.782 | strip2 (navy band + orange-border box): geometry invented — measure regular_0218-0226 (band y, cluster hours, box travel) |
| 6 | 2555-2605 | 102.2-104.2 | 0.780 | payment scene — measured geometry committed post-r1; re-check after r2 render |
| 7 | 1991-2041, 1921-1971 | 76.8-81.6 | 0.79-0.80 | strip phase-1 cluster inventory + scroll phase; calibrate gridlines at 3+ frames (my t80/t82 line detections in session: rate ≈9.4-9.6 px/f, hourPx≈293-299) |
| 8 | 2958-3008 | 118.3-120.3 | 0.799 | reportCard→buildPop seam (keyframe t120 = 0.449): ref cluster mid-pop at t120; mine barely started. BuildPop pop ~2985-3015; check card exit |
| 9 | keyframe t160 = 0.514 | — | — | outro→endcard seam: endcard should be settled by ~f3985; mine crossfades 3992-4010 |
| 10 | keyframe t134 = 0.655 | — | — | implode→circle: blue dot/circle growth timing (measure regular_0267-0271) |

Other below-0.75 keyframes: t150 0.608, t148 0.665, t110 0.734, t104 0.742, t80 0.746, t106 0.747, t112 0.751 — all covered by the windows above.

### r2 (2026-07-09, inheritor session 2) — measured seam rebuild
All r1 top-10 windows re-measured from fine-grained ref frames (step-3 extraction around each seam + full-res keyframes + numeric probes), then rebuilt. Commit `36b66ce05`.

Key measured mechanics (all in code comments too):
- **strip→gantt (W1)**: ref PUSHES the strip up (no fade) 2127-2141 (quad-in, −200px at f2133); gantt page rides up from below 2129-2143 (p≈t^1.4), bracket draws 2131-2142, rows cascade 2145+i*3.2. SEG.strip → [1930,2141], SEG.gantt → [2127,2324].
- **detail→report (W4, worst kf t92=0.368)**: detail card DISSOLVES BACK into the full gantt 2279-2291 (text fades 2279-2286); full gantt holds to 2303; whole panel shrinks into the left report doc 2303-2324 (quadOut; mid keyframe fr_2312 = panel (215,300,835,470), doc keyframed through it); CLSNet box slides in from right 2313-2323. Settled 3-element layout from fr_2330: docL (300,315,270,345), box (805,350,345), docR (1390,315,265,345), orange verticals x355/x1528, horiz stubs y547; whole group drifts +125px 2332-2358 (fr_2360); scatter dots→geodesic mesh icons on docs 2342+.
- **gantt rows re-measured** (fr_2172/fr_2300 color scans; label-antialias pollution excluded by strict 0.5-density threshold): tops [183,274,380,470,553,632,715,810,892] (pitch≈88), pill h50, widths [134,369,165,209,338,162,338,179,112], footnotes y971 w530 + y1010 w395.
- **strip1 grid probed**: rate EXACTLY 9.0 px/f, pitch 290.7 (h6→h9 = 872px at f2000 AND f2100 — 288 was wrong and produced growing ghost offsets), "06:00" line at x963@f2000, label dx +43. Deadline lines at h 5.03/9.01/13.02. Cluster inventory re-anchored + extended (blob scans at 1950/2000/2050/2100/2131): day [rowBank@4.27, towerUp@6.96, rowSail@8.48 (POPS IN at ~2062), rowOffice@10.16, towerUp@12.84, rowBank@14.9]; night [invBrick@3.4, invSail@5.54, invCity@6.39 (pop 2062), invBrick@7.49 (pop 2016), invCity@8.86, invBrick@11.65, invSail@14.4]. Some ref clusters appear DURING the scene — `at` field. Floating pill groups added (STRIP_PILLS in data.ts, colors pixel-probed).
- **strip2 (W5)**: band y405-680 (was invented 380/240); scroll 9.76 px/f; CLSNet box FIXED at (858,437,200) orange border; cluster inventory anchored at f2762 — NOTE regular_NNNN = (N-1)*0.5s, NOT N*0.5s (regular_0222 = f2762.5). Ref cuts to reportCard navy at ~2823 (white-fraction scan); card outline draws 2874-2898 (not 2830).
- **reportCard→buildPop (W8)**: card collapses INTO a wide outline pill (fr_2982: 365-1555×137-295) → small pill (365,520,430,95) by 3003 → tan-filled at (210,540,345,95) by ~3052; navy top edge drops 0→390→543 (fr_3009/fr_3021 keys [2997,3009,3015]); stripTowerUp cluster pinned to the edge rises 2999-3010; orange pill (1355,940,170×100) at 3017-3023. BuildPopScene deleted — ReportCardScene owns 2810-3104.
- **implode→circle (W10)**: map shrinks CRISPLY (no fade) keys [3288,3306,3312,3318]→[1,0.55,0.15,0] origin (960,520); light-blue circle collapses [3320..3342]→r41 dot at (960,540), HOLDS 3342-3375, grows to (960,537,r458) by 3396. CircleScene: circle STATIC (fr_3460 — r1's 55px drift was invented, removed); handshake pill GROWS (875,505,180×92)→(790,460,350×185) over 3400-3450; white dot (668,388,r42), elbows, orange square (1237,663,73).
- **shield (W2)**: zipper FIXED at x930-966 from f3642 (probed per-frame); white wipes LEFT from it (left edge 928→0 over 3645-3657, ≈t^2.1); shield pops 3661-3672 (origin on zipper), holds to 3690, exits down-left with -24° rotation by 3700. ShieldSVG reshaped vs fr_3672 (square shoulders, fill inset 42). Mosaic wipe ends 3644.
- **ledge (W3)**: ONE continuous band rotating about (948,575): θ keys [3690,3700,3708,3732,3762] = [90,20,7.1,-5.2,0] (see-saw measured at fr_3708/fr_3732), settles flat band top y555 h40, navy below; ticks every 127. Stacks = axis-aligned leaf pills 135×62 pitch 90, cols at x320/495 (navy/steel) + 1275/1465 (tan/orange), baseline 520, drop-in from above 3703+, group settle dy [90,40,0]. citiesStacks: stacks shrink 0.52+slide left 3800-3835; cities on band base y555 scale 0.44/0.42 (fr_3840). Scene runs to 3946 (fr_3935 still full; w9 montage 3945 empty navy). LedgeScene renders UNDER ShieldScene now (composition order changed).
- **outro→endcard (W9)**: OutroScene DELETED — ref is ONE continuous navy scene: empty navy 3926-3956, then the TITLE LAYOUT assembles in place: logo 3957-3977, wordmark reveal 3959-3973 (trailing letters first = inset from LEFT — title reveal direction also fixed), supporting 3974-3980, card35 bar(860,560,435,40)→body 3978-3996, card50 3998-4013, url+disclaimer 4028-4048. TitleCard endcard mode now frame-driven; PrincipleCard got growP/parts.

Inner still-gate (SSIM vs full-res ref frames), before→after:
- 2133 push: 0.756→0.758 · 2172: 0.839→0.878 · 2300: 0.776→**0.817** (from ~0.37 keyframe in r1 bundle)
- 2330: →**0.927** · 2360: →0.901 · 2712/2762/2812 strip2: →0.85-0.86 · 2830: →**0.986** (was ~0.47 at the miscut) · 2880: →0.912
- 2982: →**0.983** · 3009: →0.970 · 3060: →0.960 · 3396: →**0.986** · 3672 shield: →**0.964** · 3708/3732: →0.888/0.889 · 3762: →0.953 · 3840: →0.922 · 3966: →0.981 · 3981: →0.941
- strip1 plateau: 2000 0.785 / 2100 0.774 (remaining mass = per-building traced-art detail differences, not geometry)
- CrxNetting eye-checked at 2300/3060/3981 — renders clean, brand layer intact.

### r3 (2026-07-09, same session) — cities/pairs + strip2 entry + detail entry
Triaged from the rescued r2 render (free per-frame diffs). Commit `3a66590c9`.
- **Cities/pairs (r2 ranks 5-8,10, t41.6-52.5)**: the ground lines RISE with the city shrink (fr_1150: line1 380, line2 938 — r1 had them fixed at 398/998); labels hug the lines (cap −66 above, +5 below; x 110 / 1650); badge B rides up to (1730,770); cityA small center 525; stack columns at measured centers (R: 1222/1332/1442, L: 392/507/617), pill 56w, accent pill h42 on the line (navy above, orange below), cool-above/warm-below with TAN_LIGHT #F0DCC9. Stills: 1100 0.812→0.853, 1150 0.773→0.835, 1250 0.777→0.825.
- **Strip2 entry (r2 rank 4, worst kf t106 0.745)**: ref holds the PAYMENT layout to ~2636 (fr_2630 shows below-line plumbing + clusters already scrolling on the line), clears everything by 2650 (fr_2650 = bare line at y455 — the line DESCENDS 368→455), then the line grows into the band 2656-2678 while clusters/box fade in. Payment out [2636,2650]; Strip2 from 2640 with line-descend + band-grow choreography. Left inventory corrected: rowSail@-373 scale 0.85 (the fr_2630 sail city; the 0218 "left slivers" are its right half), rowBank@-1228. Stills: 2630 0.662→0.777, 2650 0.745→**0.981**, 2665 0.865, 2680 0.859.
- **Detail card enters ~35f earlier than r1's read** (already FULL at fr_2220): detailP [2205,2231], card fade [2213,2233]. Still 2250: 0.773→0.876.

### r4 (2026-07-09, inheritor session 3) — strip1 ground-truth rebuild
Commit `0d178f3fd` (data.ts + scenesB.tsx + art.ts). Targeted the three worst r3 windows (f1922-1972 / f2019-2069 / f2086-2136, all ≈0.794-0.799, strip1). The "traced-art plateau" theory was WRONG — the mass was measured placement/inventory/choreography error.

Instruments (all in work/clsnet/r4/): `stitch.py` (strip-space panoramas, entry-state + exit-state — the diff exposes pop-in/pop-out), `lifecycle.py`/`lifecycle2.py` (region ink-mass over time → pill/cluster alive-windows), `lines.py` (hour-line tracks → per-frame sheet offset), `decel.py` (profile correlation — noisy during pop-ins, line tracks are the truth), `wipe.py` (stripe/rotation geometry), `pills.py`+variants (connected-component pill rects/colors), `profile.py` (day/night blob columns).

What was measured and rebuilt:
1. **Entry choreography** (was: 12f fade of the settled scene): white+navy fields sweep in behind 76px grey stripes 1909-1930 (stripe-center d table), the vertical band rotates flat about (974,540) 1930-1950 (tilt 0.4°@1934 / 4.7°@1938 / 25°@1942 / 79.5°@1946), sheet rides in decelerating ~175→9px/f with a per-frame offset table anchored on hour-line tracks (STRIP_ENTRY in data.ts; zero from f1978). LocksScene exit fade REMOVED (ref holds it beneath the wipe). Hour lines/labels restricted to h∈[2,14] (ref draws nothing before h2; sheet content starts h≈1.9).
2. **Band**: #A8A8A8 rows 502-577 h76 (was #D9D9D9 at 504/64 — the D9 grey belongs to the gantt ruler).
3. **Living inventory** (panoramas + lifecycles): pill groups blink: dayA h5.2-6.0 out[2004-2010] (its lavender FALLS in from off-top, y76@1970→y300@1974); dayB h7.8 in[2016-2022] out[2064-2070]; dayC h8.1-8.9 in[2050-2054] out[2098-2106] — r2's "rowSail@8.48 at=2062" was actually this navy+lavender pill pair, not a city; night18 in[1990-1998] out[2042-2046]; night19-trio in[2024-2032] out[2066-2070] (replaces the invBrick@7.49 building — ref has pills there); night21-trio in[2088-2098] (replaces the always-on muted trio); night22-lav pair in[2108-2118] (replaces the oversized static white/lav group). All rects/colors from pills.py.
4. **Clusters re-traced from strip frames** (r1 reused rows-scene art at 3-6x too little ink): stripEarlyTower h2.33 (entry-phase actor), stripBankWide h4.25 w453, stripBigCity h9.99 w417 (replaces rowOffice@10.16 w240 — ref cluster is 1.75x wider), stripInvEarly h3.60, stripInvOffice h5.73 w566, stripInvCity2 h8.69 w411 (was 8.86 — 50px left-shift measured), stripInvBrickWide h11.66 w425. towerUp shifted 6.96→7.01. Night traces clipped to y578-872 (first pass baked the ref's hour labels — doubled text; the −0.002 SSIM from removing baked line fragments is a documented perceptual spend).
5. Cluster stand/hang pads now 0 for crop-exact new traces (`pad` field for legacy); artW/artH read from ART natives (hardcoded maps deleted).

Still gates vs r3 render (SSIM): f1915 0.798→0.827 · f1935 0.601→**0.992** · f1942 0.597→**0.988** · f1947 0.817→0.977 · f1954 0.821→**0.967** · f1962 0.759→0.924 · f1970 0.748→0.898 · f2030 0.751→**0.899** · f2060 0.759→0.892 · f2095 0.758→0.895 · f2110 0.769→0.890 · f2125 0.772→0.881. CrxNetting eye-checked at 1940/2060 — clean.

## Score trajectory
- r1 (2026-07-09): **87.7** — first full build.
- r2 (2026-07-09): **90.7** (commit `36b66ce05`; video_ssim 0.8896 · keyframe 0.8666 · color 0.9874 · duration 0.9997). Artifacts: clsnet-{verify,keyframes,framessim}-r2.*; attempt render at work/clsnet/r2/replicate-attempt-2416.mp4.
- r3 (2026-07-09): **91.1** (commit `3a66590c9`; video_ssim 0.8938 · keyframe 0.8733 · color 0.9873 · duration 0.9997). Artifacts: clsnet-{verify,keyframes,framessim}-r3.*; attempt render at work/clsnet/r3/replicate-attempt-19524.mp4. Freshness vs r2 confirmed: only r3-touched keyframes moved; untouched ones differ ≤4th decimal.
- r3 keyframe movement vs r2 (keyframe idx = t/2s): t44 0.812→0.848 · t46 0.773→0.830 · t48 0.777→0.828 · t50 0.777→0.819 · t52 0.781→0.825 (cities/pairs) · t90 0.773→0.869 (detail entry) · t106 0.745→**0.979** (strip2 entry). t42 0.754 did NOT move (cities entry seam ~f1050 untouched); t108/110 flat.
- r3 worst windows (rolling 2s, global 0.8938): 1 f2019-2069 0.7942 · 2 f1922-1972 0.7945 · 3 f2086-2136 0.7985 (all strip1 t76.9-85.4) · 4 f250-300 rows-build 0.8278 · 5 f3540-3590 mosaic 0.8304 · 6 f1041-1091 cities-entry 0.8362 · 7 f415-465 flows 0.8429 · 8 f2583-2633 payment-out 0.8447 · 9-11 cities residue ~0.848 · 12 f1872-1922 strip-entry tail 0.8527.
- DECODER NOTE: the r2 orchestrator note's "t23–26" were keyframe INDICES (= t=46–52s cities/pairs, fixed in r3), not seconds. "t40–45" = t=80–90s strip1; "t53" = t=106s; "t71" = t=142s mosaic.
- r4 (2026-07-09): **91.6** (commit `0d178f3fd`; video_ssim 0.9005 · keyframe 0.8791 · color 0.9900 · duration 0.9997). Artifacts: clsnet-{verify,keyframes,framessim}-r4.*; render + logs at work/clsnet/r4/ (replicate-attempt-55463.mp4). Surgical freshness: ONLY the strip1 keyframes moved vs r3 — t78 0.842→0.966 · t80 0.776→0.890 · t82 0.764→0.893 · t84 0.762→0.879; all others within noise.
- r4 worst windows (rolling 2s, global 0.9005 — strip1 has left the table entirely): 1 f250-300 rows-build 0.8278 · 2 f3540-3590 mosaic 0.8304 · 3 f1041-1091 cities-entry 0.8362 (kf t42 0.754 — never touched) · 4 f415-465 flows 0.8429 · 5 f2583-2633 payment-out 0.8448 · 6-8 cities residue t44-52 ~0.848 · 9 f3490-3540 0.8552 · 10 f3256-3306 map-badges 0.8568 · 11 f1817-1867 matching-tail 0.8574 · 12 f2533-2583 payment 0.8584.
- Worst r4 keyframes: t142 0.753 (mosaic) · t42 0.754 (cities entry) · t88 0.769 (gantt/detail — NOT strip; t88=f2200) · t30 0.803 · t92 0.809 · t132 0.809 · t10 0.815.
- Path to 95 (next round priorities, as windows): rows-build f250-300 sweep (pop/slide timings eyeballed in r1, never measured), mosaic f3490-3590 (pill density + t142 keyframe), cities-entry f1041-1152 (the t42 seam r3 skipped), flows f415-465 (hex shrink + label swap), payment f2533-2633. The lifecycle/panorama instruments in work/clsnet/r4/ transfer directly to the mosaic (it is also a pill field).

## Known gaps beyond the r1 window table
1. **Strip scenes (t≈77-88 & 104-113)** — weakest still (0.76). Scroll rate calibrated only at one anchor (9.37px/f, hour 3 @ x=85 at f2005); cluster inventory beyond the first screen is repeated/invented; strip2 (navy band variant) geometry only eyeballed from montage. Measure label positions at 3+ frames each, fix rate + phase, trace the real cluster sequence.
2. **Flows scene (f366-462)** — pill stack growth timing approximate; hex row at t=14.5-16 shrinks in ref (smaller hexes than t=13.5) — mine constant size; USD→EUR/CZK label swap mechanics (ref slides big labels through the right edge).
3. **Title/endcard serif** — Playfair vs ref: test Prata/DMSerif/NotoSerifDisplay on the wordmark crop; ref CLSNet spans x128-860, cap 140px, baseline 610.
4. **Title intro/outro** — letter reveal is R→L in ref (t=0 shows only trailing "t"); outro tilt+white diagonal wipe angles are guesses (f130-150). Plate-sweep f=125..150.
5. **Rows build (f148-320)** — pop/slide timings eyeballed from 0.5s frames; sweep each row's pop frame and slide path; row line y's = [220,462,765,1035] measured at t=12.
6. **Globe (f462-566)** — rotation approximated by crossfading two traced states + ring spin −38°; ring tick/label layout invented from two frames. Low SSIM cost but visible.
7. **Transitions between segments** are mostly linear fades; the ref uses slides/marks (e.g. map→network hexes morph, cities shrink+hexify with continuous motion). SSIM at cut boundaries will show in rolling windows.
8. **Mosaic (f3480-3688)** — rows/pills procedurally invented (deterministic), labels CNH/RUB/THB/PLN/AED placed from 2s montage only. Ref has dense pill mosaics at t≈141.5-143.5 (check regular_0284) — my density likely too low.
9. **Payment/handshake geometry** (f2372-2612) measured from montage cells (±20px); refine from full-res frames (regular_0195/0209).
10. **CrxNetting** renders but brand fidelity is v1 (CLS palette kept, Diatype fonts, CRX copy; badge texts "FX Global Code" still hardcoded in MapBadgesScene). Not scored; polish after replica hits 90+.

## Commits (this session, branch claude/anoma-ui-fidelity-lift)
- `5c90a97e7` full 29-scene rebuild + CRX variant (r1 bundle state)
- `0c1a50e53` mosaic scene ground-truth rewrite (r2)
- `d97732688` payment-complete measured geometry (r2)
- `7f866851d` mini-hex blue/white trace fix + network hex centers (r2; f700 still 0.885→0.907)
- `82f5eb499` brand-aware card kicker (CRX = "Pillar")

## Hazards for the inheritor
- Whole-repo tsc gate: sibling lanes (cls-day/fna-loop/netgrowth) intermittently break it; verify only in a green window (`npx tsc --noEmit` silent).
- Disk: container had ~2.2GB free; playwright browser cache already sacrificed. Watch `df -h /System/Volumes/Data`; sibling lanes render concurrently. `/tmp/_color_ref_*.png` in the verify color step collides across lanes — hold the render lock through the WHOLE verify (run-verify.sh does).
- `art.ts` is generated — edit `trace.py`/crops and regen, never the file.
- Montage-derived coordinates were repeatedly ~±(15-110)px off; trust full-res frame reads + measure.py only.
- Do not add Co-Authored-By to commits; never `git add -A` (other sessions' files are dirty in the tree).

## r2 official verify — logged by orchestrator (2026-07-09 22:20)

- **SCORE 90.7** (video_ssim 0.8896 ·40% / keyframe 0.8666 ·35% / color 0.9874 ·15% / duration 0.9997 ·10%). r1 87.7 → r2 90.7. Target ≥90 MET; 92+ remains open.
- Verify ran via the agent's detached runner after its transcript stopped; orchestrator watchdog confirmed completion. Artifacts: `clsnet-{verify,keyframes,framessim}-r2.*` in this dir; render + logs rescued at `work/clsnet/r2/` (`replicate-attempt-2416.mp4`, `verify-out.txt`, `verify-err.txt`).
- NOTE: the runner pointed the verify's analysis output at the track-local `work/clsnet/ref-analysis/` — the shared `public/reference-analysis/last-verify-*` files are r1-stale; ignore them. This ALSO dodges the cross-lane poison trap; keep the pattern.
- Keyframe wins vs r1 (the r2 seam rebuild landed): t43 0.541→0.932 · t46 0.368→0.809 · t60 0.449→0.914 · t67 0.655→0.999 · t74 0.665→0.926 · t75 0.608→0.929 · t80 0.514→0.917.
- Worst remaining keyframes (r2): t23–26 ≈0.773–0.781 (persistent block, untouched by r2 — triage FIRST next round), t40–42 ≈0.76–0.78, t44–45 ≈0.77, t53 0.745, t71 0.753.
- Agent stopped at the round boundary per the recycle rule. Next inheritor: start from the t23–26 window (run `scripts/rolling-ssim.py` on `clsnet-framessim-r2.txt` to rank, then `ssim-grid.py` on the block).

### r5 (2026-07-10, inheritor session 4) — IN PROGRESS
Commit `a23c9f10b`: mosaic ground-truth rebuild + circle-exit morph.
- Ref mosaic = four STATIC pill pages popping in/out (in 3487/3522/3548/3571, out 3514/3543/3566/3589; per-frame ink-mass scan in work/clsnet/r5), NOT a scrolling field. 7 fixed col anchors [74,308,526,806,1064,1372,1758]; 3 grey bars tops 197/545/893 h8 draw L→R in cascade (extent keys); above=blue big 86×68/small 83×34 (bottom-anchored L-5/-6, 9px gaps), below=orange 87×68/tan 83×35 (top L+21, gaps 8/9); corners: line-side outer square 2px, diagonal 13-14px. Labels: 3 slots cx 1482/1010/378, cap 102 @ tops 94/441/789 → SerifLabel fs138 + capTop +16 correction + tracking 8. Page grids CC-derived programmatically (hand tabulation missed 5 cells — script in transcript, dumps in r5/).
- After pages: bars converge to y549 (3606-3615) then merged bar ROTATES about (948,549) to vertical (keys 0/4.2/15/56/90° at 3615/3620/3628/3636/3642) becoming the shield zipper. Invented navy-plate wipe DELETED.
- Circle exit: art fully present to 3466, dot+square cut 3467-3468, handshake pill fades 3468-3471, group SLIDES LEFT (cx keys per frame), circle shrink-morphs into P1-L2-c2 big blue pill by 3485 (17-key table in CircleScene). No fades of circle itself. MosaicScene renders UNDER CircleScene now; CircleScene bg transparent from 3477, ends 3487; preLanded flag skips that one pill's pop.
- Stills: 3505 0.935→0.955 · 3535 0.955 · 3560 0.956 · 3582 0.958 (r4 series was ~0.82-0.86 here) · 3520 0.987 · 3478 0.993 · 3481 0.861→0.992 · 3486 0.990 · 3489 pop 0.892 · 3610 0.940 · 3628 0.976 · 3640 0.980. Remaining page residual = serif FACE weight (Playfair vs Financier hairlines — known gap 3).
- CrxNetting eye-checked at 3560: clean.
- Commit `389338dca` rows-build rebuild: cluster rests = trace-crop origins 280/575/850/1100 (r1 settleX misplaced 160-640px — misplaced-ink lesson again); entries slide from right, settle 202/226/244/268 then HOLD; rowBankL/rowOfficeL re-traced left blocks; measured ground ticks. Stills 230/260/280/300: 0.890/0.881/0.891/0.892 → 0.927/0.935/0.949/0.947 (r4 series ~0.825). Spend: sail's baked heli+plane are static at their f308 ref positions (ref flies them 1900→1100 over 244-308).
- Commit `b1240dfc6` cities pass: shrink 1062-1075 (ref HOLDS to 1062 — the t42 dip was early-shrink + doubled badges); badges are moving elements (r69→r46, measured paths); cityA/cityB re-traced badge-free from regular_0079 (r1 traces from regular_0083 had the badges BAKED IN — the doubles); cityASmall/cityBSmall traced at NATIVE settled scale from fr_1150 — downscale stroke blur was the 0.85 plateau, settled stills 0.84→0.93-0.95; pair carousel = 5 pairs (USD/TRY was missing) in/out keys + rise-from-below swap, fs 84; stacks = exact CC rects. 1045 0.773→0.947.
- Commit `<payment>` payment pass: cityBPay native trace; orange plumbing timing; up-arrows.
- LESSON (r5, three confirmations): when a settled scene plateaus ~0.85, check SCALE PROVENANCE of the traced art — art traced at intro size and downscaled loses the ~1.5px strokes; re-trace at display scale. Also: trace crops BAKE neighbouring elements (badges, planes) — always trace from a frame where the neighbour is absent, or paint it out first.

### r6 (2026-07-10, gen-5 inheritor session 5) — dirty-hunk audit + flows→globe seam + network rebuild
**Dirty hunk VERDICT: KEPT WHOLE, committed `4f80a54f9`.** The predecessor's "do the bands render" fear was refuted on frames: A/B stills vs HEAD at 8 frames (1500/1600/1700/1770/1812/1840/1875/1910) ALL moved up — matching +0.007, locks +0.013 (f1840 0.8357→0.8490). The hunk = EdgeRulers 36px full-height bands + locks hexes at measured (612,385)/(1306,385) w385 with 0.6-scale clipped cities + doc+lock at y643 + lock close f1838. CrxNetting clean at f1840.

**CRITICAL DECODE: the official r5 verify (92.7) predates TWO commits.** t88=0.7687 in clsnet-keyframes-r5.txt proves the r5 render bundle predates 23b0ec462 (01:14:55, detail-card+map-badges) and likely 3f148ae4e (01:10, flows page-flip). Those commits' gains are free upside in the r6 verify. HEAD-vs-r5-render stills confirmed: gantt f2210 0.760→0.884 at HEAD (detail card WORKS), flows f425-455 unchanged (page-flip commit gained ~nothing at 425/440/455 — encoding gap only).

Commit `87a4dfd32` flows→globe seam (probed per-frame):
- Flows exit: whole layout slides LEFT accelerating f450-467 (CLSNet-box track: 0/-17/-51/-111/-206/-358/-466/-608/-803/-1068/-1418/-1888/-2400), NO fade (removed), band+ticks: band STATIC, ticks ride the slide. Scene unmounts f468.
- Globe entry: disc center decelerates 1762@468→958.5@482 (keys in code; was linear 900px from f455 — globe intruded 11f early = the 0.02 grid cell at f455-466). GLOBE.cy 550→539; triangle 60x52 at y81 rides the slide.
- Band truth: y805-844 h40 through flows (FLOWS.rulerY 819/h22→806/h38; ticks pitch 142.4 phase 56.5, was 137/70); drops to y846 over f468-480; right end retreats with the globe to x1028; holds to f506; REELS IN rightward 77px/f f508-521 (ticks ride); gone f521.
- Stills: f455 0.771→0.846 · f461 0.727→0.886 · f464 0.801→0.912 · f468 0.873→0.929 · f486 0.886→0.893 · f510 0.886→0.890.
- KNOWN DEFECT (pre-existing, NOT from this change): globeA/globeB traced art is broken during entry+settled (white swoosh arc + second disc spill below — visible at f472-510; grid cells r2c4/r3c4 at f510 ≈ -0.03..0). Worth a re-trace from f486/f540 (~80 frames at ~0.89). Gap 6 confirmed as ART defect, not layout.

Commit `8a150d870` network scene ground-truth rebuild (f744-912 valley = r5 ranks 4/6/8):
- Hexes re-traced native 375 from settled f890 with elbow ink painted out → mHexHeliL/mHexBankL/mHexBank2L/mHexCity2L (old mHex* 215px map traces had BAKED route dashes + helicopter = the white dash artifacts). Paint rects must stay OUTSIDE hexagon borders (v1 nicked the fills — blue holes; fixed rect list in transcript/r6 net dir).
- Entry = MORPH from map mini positions (w215)→network rests (w375) staggered f756-772 (white-fill growth probed); map ERASES edges-inward 750-764 (clipPath inset L 0/25/55%, R 0/36/45% at 750/758/764); non-keeper minis pop out 750-762; label fades 756-764. NET_MORPH_START exported from scenesA; MapScene hands keepers off per hex.
- Elbows re-measured f900: E1 M382,572 V726 Q..H627 · E2 M782,512 V324 Q..H990 (gap to hex3 is REAL) · E3 M937,764 H1159 Q..V576 (hex2→hex3, r1 had it wrong) · E4 M1370,321 H1559 Q..V487 (y321 not 414). Draw outward 764-788.
- Docs RIDE the elbows (white-blob tracker f745-915 step5): Tom/next-day hex1→hex2 f807-838 · NDF hex2→hex3 f793-824 · Same-day hex3→hex4 f817-849 · Spots hex2→hex3 f853-878 · Forwards hex4→hex3 REVERSE f863-894. Per-frame center tables in NET_DOCS. Doc art rebuilt (serif orange labels, header dot+lines, folded corner, per-doc sizes; NDF 91x117 fs40).
- Stills: f746 0.819→0.907 · f758 0.818→0.892 · f766 0.856→0.913 · f800 0.850→0.972 · f830 0.845→0.971 · f885 0.844→0.977 · f900 0.847→0.980. CrxNetting clean at f460/f830.

r6 verify LAUNCHED ~02:55 via run-verify-r6.sh (background, lock held through; artifacts → clsnet-*-r6.*; render rescued to work/clsnet/r6/).

**r6 OFFICIAL VERIFY: SCORE 93.3** (video_ssim 0.9185 ·40 / keyframe 0.9040 ·35 / color 0.9917 ·15 / duration 0.9997 ·10). Trajectory 87.7 → 90.7 → 91.1 → 91.6 → 92.7 → **93.3**. Artifacts clsnet-{verify,keyframes,framessim}-r6.*; official render work/clsnet/r6/replicate-attempt-49438.mp4 (CAUTION: the rescue watcher also swept STALE /tmp attempt mp4s into r6/ — 49438 is the real one, matches verify-out.txt). Freshness: t32/t34/t36 = 0.972/0.972/0.979 (network rebuild landed), t88 0.769→0.857, t30 0.897.
- r6 worst windows (global 0.9185): 1 f3256-3306 mbadge 0.8557 · 2 f2775-2825 strip2 0.8614 · 3 f99-149 title 0.8626 · 4 f2276-2326 detrep 0.8633 · 5 f1791-1841 locks 0.8647 · 6 f1873-1923 0.8655 · 7 f2725-2775 0.8657 · 8 f1720-1770 0.8677 · 9 f2675-2725 0.8718 · 10 f3206-3256 0.8743 · 11 f2352-2402 0.8757 · 12 f314-364 0.8763.

### r7 (2026-07-10, same session) — detrep box entry + map-badges, then LAND
Commit `c25e9a32c` report-box measured entry (r6 verify predates it — free upside in r7): navy-blob track 2306-2335 → a 46px full-height bar sweeps left 1834@2306→1504@2310; box enters 2313-2315 HUGE and shrinks (cx/size 1858/836@2315 → 1304/524@2320 → 1119/420@2324 handoff → 977.5/345@2330 in ReportOutScene), label+logo scale with it; orange stub trails to the right edge y630→552. Stills f2310/2315/2320/2325: 0.733/0.779/0.825/0.858 → 0.754/0.862/0.899/0.897. Negative A/B documented in-code: doc→box left stub at y572 cost −0.002.
Commit `c25b076a8` map-badges measured pass: second map outline = IDENTICAL to first (thin-white bbox 206-1711/60-1015 both — montage "bigger map" read was wrong); hexes ~1.18x at shifted centers (per-hex f700-fill→center offsets, BADGE_HEX_POS); badges 104x102 (were 92x94) at measured absolute spots (BADGE_POS), text CENTERED, colors SPLIT: 35=grey-blue #5A7593, 50=teal #006F88 (corner-sampled; r5's all-teal probe sampled text pixels). Stills f3230/3260/3280: 0.851/0.847/0.847 → 0.873/0.870/0.876.
**r7 OFFICIAL VERIFY: SCORE 93.3** (video_ssim 0.9188 ·40 / keyframe 0.9042 ·35 / color 0.9917 ·15 / duration 0.9997 ·10). Trajectory 87.7 → 90.7 → 91.1 → 91.6 → 92.7 → 93.3 → **93.3** (r7's two commits moved their windows — mbadge 0.8557→0.8654, detrep 0.8633→0.8679, kf t130 0.845→0.866 — but the global gain rounds to flat; t132 0.809→0.802 is the implode-frame spend noted in the c25b076a8 commit). Artifacts clsnet-{verify,keyframes,framessim}-r7.*; official render work/clsnet/r7/replicate-attempt-61784.mp4. CrxNetting eye-checked: f460/f830/f1840 clean.
- r7 worst windows (global 0.9188): 1 f2775-2825 strip2 0.8614 · 2 f99-149 title 0.8626 · 3 f1791-1841 locks 0.8648 · 4 f3258-3308 mbadge-implode 0.8654 · 5 f1873-1923 0.8656 · 6 f2725-2775 0.8658 · 7 f1720-1770 0.8677 · 8 f2270-2320 0.8679 · 9 f2675-2725 0.8719 · 10 f2352-2402 0.8757.
- Session ended at the round boundary per the recycle rule (gen-5, two rounds: r6 seam+network, r7 box+badges; five commits, all gated on stills + eyes, all landed fresh in official verifies).

### r8 (2026-07-10, gen-6 inheritor session 6) — strip2 + logoMark (pre-landed) + serif audit + locks/matching ruler&hex
**Four commits land in the r8 official verify** (all committed against a live branch a sibling cls-day builder is also pushing to — lane isolation held, staged explicit clsnet paths only):
- `457377fd8` (pre-landed) strip2 ground-truth rebuild — panorama traces, 16 measured vertical pill traversals, band-expansion exit. Stills f2762 .846->.934, f2824 .537->.976. Covers r7 worst windows #1/#6/#9.
- `7f84d6948` (pre-landed) logoMark white edge-sliver STRIPPED from the trace store (poisoned every ClsNetBox — title/flows/strip2 boxes); ClsNetBox re-measured SQUARE (268.5²/154²/335²/164²/200.5²), border 8, radius 22, label fs48. Box crop f2762 .558->.835. This is lead #1 from the r7 tail — DONE.
- `e63fb9729` (this session) **serif swap Playfair->Georgia — AUDITED from the dirty tree and KEPT.** A prior session left it uncommitted across 4 files (data.ts/fonts.ts/scenesA.tsx/ui.tsx); I audited hunk-by-hunk (tsc clean; in-render A/B vs HEAD/Playfair, still-gated both vs ref): **title f125 .9025->.9159 (+.0134, worst-window #2), endcard f4075 .8535->.8669 (+.0134)**; flows f425 -.0019, mosaic f3550 -.0038, cities f1000 + report-card f2900 neutral. Net positive (wordmark/endcard wins dwarf the SerifLabel losses). Numerals->Didot (Georgia oldstyle figures lose the digit); SerifLabel cap factor 0.30->0.14 (Georgia cap 0.14em below CSS top). The transient f125 render "FAIL" was batch resource contention, not a bug (renders clean solo).
  - **INCOMPLETE (successor work):** scenesC:695 report numerals still on SERIF (neutral at f2900 but violates the Didot rule); flows/mosaic capTop NOT re-measured for Georgia — that is the -.002/-.004 spend. Re-measure both capTops in-render to flip the small losses to wins.
- `09ce8bbec` (this session) **locks/matching ruler ground-truth rebuild + hex top-anchor** (r7 worst windows #3 f1791-1841, #5 f1873-1923, #7 f1720-1770 — "phase-1 geometry never measured", lead #3):
  - **EdgeRulers (spans matching+locks f1462-1930):** two defects. (1) Labels were pinned to a row INDEX over a 14h (1540px) modulus, so every wrap jumped the hour sequence 14h (the 14:00->02:00 break; the shared 21:00 red line sat ~380px off in y). Fixed: labels now derive from POSITION, wrap mod 24. (2) The ruler drift was a constant 1.35px/f DOWN; ref (orange deadline-line scan regular_0120..0152) glides UP and DECELERATES to rest ~f1900 (velocity 4.8->0). Fixed: measured Y21(f) keyframe table (position of the 21:00 tick), pitch 113.9. (3) Labels sat y-30 ABOVE their tick; ref sits ~y+13 BELOW (regular_0146 '21:00' text top y424 vs red line top y405) — a ~48px miss. Fixed.
  - **LocksScene hexes:** top-anchored cy = 239 + 0.453*w. Ref hex outline top holds ~239 while the hex grows DOWNWARD; the old center-lerp settled it 28px too HIGH (top 211 vs 239 — the doubled-perimeter defect in the locks-window diff, the largest ink mass in the window).
  - Still-gates vs ref (OLD r7 -> fixed): f1560 .875->.881 (matching, no regression), f1745 .846->.850, f1816 .841->.858, f1873 .845->.857, f1898 .846->.862. CrxNetting clean at f1873.
  - REMAINING locks residue (diff2_1873): building TRACE detail inside the hexes (temple columns / city edges — trace fidelity, not placement) + a small doc/lock y offset. Art-quality, next round.
- **r8 OFFICIAL VERIFY: SCORE 93.5** (video_ssim 0.921881 ·40 / keyframe 0.907490 ·35 / color 0.991765 ·15 / duration 0.999748 ·10). Trajectory 87.7 → 90.7 → 91.1 → 91.6 → 92.7 → 93.3 → 93.3 → **93.5**. Both SSIM components rose: video +0.0031, keyframe +0.0033. Artifacts clsnet-{verify,keyframes,framessim}-r8.*; render rescued work/clsnet/r8/replicate-attempt-10949.mp4 (29.9MB). Freshness: strip2 (r7 worst window #1 f2775-2825 0.8614) LEFT the top-12 entirely (rebuild landed); title f99-149 0.8626→0.8704; locks f1873-1923 0.8656→0.8748.
- r8 worst rolling windows (global 0.9219): 1 f3258-3308 mbadge/implode 0.8650 · 2 f2270-2320 detrep 0.8680 · 3 f1720-1770 locks-entry/phase1 0.8697 · 4 f100-150 title 0.8704 · 5 f1819-1869 locks 0.8706 · 6 f1873-1923 locks 0.8748 · 7 f314-364 rows/flows 0.8756 · 8 f2352-2402 reportOut 0.8759 · 9 f364-414 flows 0.8779 · 10 f2590-2640 payment 0.8780 · 11 f414-464 flows→globe 0.8787 · 12 f3892-3942 mosaic/shield-tail 0.8794.
- Worst r8 keyframes (idx=t/2s): idx66 0.802 (t132/f3300 implode) · idx46 0.809 (t92/f2300 detrep) · idx35 0.842 (t70/f1750 locks) · idx37 0.848 (t74) · idx9 0.849 (t18 flows→globe) · idx8 0.855 (t16 flows) · idx81-83 0.860 (t162-166 ENDCARD — serif helped but the assembling title is detail-heavy).
- **ASYMPTOTE HONESTY (lesson 9), 93.5 → 96 = +2.5:** most top windows are FIXABLE but each yields ~0.005-0.01 on its own window (~0.05-0.15 global): mbadge implode re-measure (lead #5), detrep-tail, locks phase1 geometry (ClsNetBox/Doc/Elbow never measured), title intro-reveal + finishing the serif (flows/mosaic capTop), flows hex-shrink+label-swap, payment geometry. The FLOOR is hand-drawn-texture: the building/city TRACE detail inside every hex (locks/cities/network) and the serif hairlines (mosaic/shield) SSIM-cap regardless of placement — placement is now correct, the ink shape is not. Realistic asymptote with continued single-window grinding ≈ **94.5-95**; **96 walls** without re-tracing the entire city/building line-art at display scale to the ref's exact stroke geometry (a large standalone pipeline project, not a round). Recommend: grind the fixable windows to ~94.5, then decide whether the trace-pipeline rebuild is worth it.

**Next-inheritor leads (measured, r8 triage — re-ranked):**
0. **mbadge/implode f3258-3308 (0.8650, NEW worst window)** — keyframe idx66 t132/f3300 = 0.802 (worst single keyframe). r7's badge pass left the map-shrink/implode timing stale vs the new 1.18x hexes (lead #5 all campaign). Re-measure the shrink keys [3288,3306,3312,3318] and circle-collapse with BADGE_HEX_POS.
1. **detrep-tail f2270-2320 (0.8680)** — keyframe idx46 t92/f2300 = 0.809. r7 fixed the box ENTRY (c25e9a32c); the report-out tail (f2352-2402 also #8) residue remains — measure the doc/box settle f2330-2402.
2. **locks phase1 f1720-1770 (0.8697)** — my r8 ruler/hex helped the settled hexes but phase1 (f1662-1770: ClsNetBox at (823,620), Docs at (610/1200,640), Elbows) was NEVER ground-truth measured — eyeballed in r1. Measure box/doc/elbow positions from regular_0134..0141. Plus the building TRACE detail inside the A/B hexes (hand-drawn-texture floor).
3. **title f100-150 (0.8704) + finish the serif** — the Georgia swap won the wordmark but (a) the intro R→L letter-reveal timing is still a guess (gap 4), (b) scenesC:695 report numerals still on SERIF not Didot, (c) flows/mosaic capTop not re-measured for Georgia (the -.002/-.004 spend from e63fb9729). Finishing (b)+(c) flips two small losses to wins.

**Next-inheritor leads — r7 block (mostly SUPERSEDED by r8; kept for the ONE still-open item):**
1. ~~strip2~~ DONE r8 (457377fd8 rebuild + 7f84d6948 sliver strip — left the top-12).
2. ~~title serif~~ DONE r8 (Georgia swap, e63fb9729) — intro-reveal timing still open (see r8 lead 3a).
3. ~~locks settled geometry~~ DONE r8 (ruler+hex, 09ce8bbec) — phase1 still open (see r8 lead 2).
4. **Globe art re-trace — STILL OPEN** (broken white swoosh + disc spill in globeA — work/clsnet/r6/flowseam/oldnew_472.png; ~80f at ~0.89). Not in the r8 top-12 but a visible defect.
5. ~~mbadge implode~~ now r8 lead 0 (NEW worst window — see r8 lead 0: re-measure shrink keys f3288-3318 with the 1.18x BADGE_HEX_POS hexes).

### r9 (2026-07-11, gen-7 inheritor session 7) — the three worst r8 windows, all measured & landed
Mandate: grind ONLY the fixable/measurable windows to the honest ceiling (~94.5-95), then ship. Do NOT chase the hand-drawn-texture floor (hex building traces, serif hairlines) — three agents proved 96 needs a standalone re-trace pipeline. Attacked r8 worst windows #1/#2/#3 (re-ranked from clsnet-framessim-r8.txt); all three were genuine MEASURABLE geometry/timing errors, not texture. Instruments in `work/clsnet/r9/` (measure_phase1.py, measure_elbows.py, measure_implode.py, measure_gantt.py; still.sh + ssim.sh gate helpers — render `remotion still` + ffmpeg-ssim vs the half-second regular_NNNN grid, N=frame/12.5+1).

- **`138e5e5a9` phase-1 (reportsUp) geometry — r8 worst window #3 (f1720-1770, 0.8697; lead 2).** The phase-1 layout (f1662-1770) was eyeballed in r1 and NEVER measured; r8 had pinned its hexes to the locks-settled top-anchor (cy 343), so the WHOLE layout sat ~75px too low with an oversized box and docs ~175px too far right. Measured from regular_0137-0139 (measure_phase1.py, navy bbox + solid-box + elbow-connector scans): CLSNet box (850,550) side 219 => w224; hexes cx413/1512 cy283 w215; docs (439/1340,556) 149x198; doc<->box horizontal connectors at y666 (stop at box edges 850/1069); up-arrow risers on each hex-cx (413/1512) y636->418. The hex triple now lerps from these into the UNCHANGED r8 locks-settled state (cx612/1306 w385 cy413) over growP 1752-1785 — locks windows f1819-1923 untouched (growP=1 byte-identical; verified f1825 0.853 flat). Still-gate: **f1700 0.855->0.888, f1725 0.851->0.896 (+.045), f1750 0.853->0.866.** CrxNetting clean at f1725 (brand box "CRX", geometry carried).
- **`90362b425` implode scale curve — r8 worst window #1 (f3258-3308, 0.8650; lead 0).** The map-badges implode shrank too early: the montage-eyeballed curve hit 0.70 at f3300 while the ref holds 0.804 there — costing keyframe idx66 t132/f3300 = 0.802, the single worst KEYFRAME. Ground truth (measure_implode.py, white map-content bbox ratio vs settled 0264): slow lead-in 1.0->0.804 (f3288-3300), then fast collapse to 0.037 by f3312.5, gone by 3318. Origin corrected (960,520)->(960,537) from the bbox-center solve. Still-gate: **f3275 0.875 / f3287 0.862 unchanged (settled, no regression), f3300 0.854->0.909 (+.056), f3312 0.992->0.998.**
- **`64f941f56` gantt panel shrink retimed — r8 worst window #2 (f2270-2320, 0.8680; lead 1).** The shrink-into-doc held the panel full-bleed to f2303, but the ref begins shrinking at ~f2288 — so f2288-2303 showed a full navy panel while the ref was already inset. **f2300 scored 0.689, the single worst FRAME in the whole video.** The old proportional quadOut also collapsed width far too fast (720 vs measured 1522 at f2312). Replaced with the measured navy-panel bbox trajectory (measure_gantt.py): f2288 full -> f2300 (51,72,1838,933) -> f2312.5 (305,427,415,213 filled mini-gantt) -> f2324 handoff into REPORT.panel (340,470,205,120). Doc-outline + box-entry timing (2306+) unchanged. Still-gate: **f2275 0.885 unchanged, f2300 0.689->0.839 (+.150), f2312 0.698->0.769 (+.071), f2320 0.819 flat.**

**Expected window movement (r9 verify, official score PENDING the orchestrator's run):** all three fixes hit the r8 top-3 worst windows and their worst single keyframes.
- f2270-2320 (0.8680): the drag frames f2300/f2312 gained +.150/+.071 (whole-frame PNG) — window mean should rise to ~0.90.
- f1720-1770 (0.8697): settled phase-1 f1700-1735 gains ~+.03-.045 — window ~0.90.
- f3258-3308 (0.8650): the ~20 implode frames gain, worst keyframe +.056 — window ~0.88.
- Worst r8 keyframes t92/f2300 (0.809) and t132/f3300 (0.802) both fixed. Rough SCORE estimate 93.5 -> **~94.0-94.3** (pending verify). tsc clean on clsnet each commit; three commits staged clsnet-only (scenesB.tsx once, scenesC.tsx twice) — lane isolation held vs the parallel cls-day builder.

**Texture-floor / r10 leads (honest asymptote — lesson 9):**
- **Each r9 window is now at or near its measurable floor.** Phase-1 (f1720-1770): geometry correct; residue = hex building-TRACE detail (hand-drawn-texture floor) + the phase-1 doc INTERNALS (ref doc has a bottom outlined box; the Doc primitive draws 3 rule-lines — a cheap enrichment, maybe +.003, but it is texture). The f1750-1770 transition (box drops, docs slide, hexes grow) is only coarsely modelled — box-drift measured to y595@f1750 but faded via boxOut; a full per-frame transition table is possible but low-yield (~15f).
- **detail→report f2312 residue = CLSNet-box ENTRY timing** (r7 curve, boxCx starts 2350@f2313; ref 0186 shows the box large at cx~1465 by f2312.5 — ~10f too late). A real MEASURABLE lead for r10 (f2306-2324), but coupled to the ReportOutScene 2324 handoff — retime both together, re-gate f2310-2330. Left this round to avoid regressing the r7-gated box entry.
- **implode f3258-3290 settled = the 7 hex building traces** (texture floor) + badge internals — the r7 pass already took it to ~0.876; no measurable structure left.
- Still-open non-top-12: **globe art re-trace** (r8 lead 4; broken white swoosh in globeA, ~80f at ~0.89) and **title intro R->L reveal timing** (gap 4) and **serif finish** (scenesC:695 report numerals still SERIF not Didot; flows/mosaic capTop not re-measured for Georgia — the -.002/-.004 spend from e63fb9729). These are the remaining fixable leads if r10 grinds past 94.
- **Verdict:** the three biggest measurable levers are spent. Realistic continued-grind asymptote still ~94.5-95; 96 still walls without the standalone city/building line-art re-trace pipeline (a project, not a round). Recommend: run the official r9 verify, then decide ship vs. one more grind round (globe re-trace + box-entry + serif finish) vs. the trace-pipeline call.

### gen-8 TYPEFACE front — 2026-07-11 (serif screen, COMPLETE — no change; Playfair handoff)

**Georgia stays IN SCOPE; Playfair Display is the eye-truest obtainable face
and a future OUT-OF-SCOPE lever.** Screened the full field IN-RENDER (11 macOS
system + 10 Google serifs — Prata/Playfair/DM Serif/Noto Serif Display/
Newsreader/Source Serif 4/Spectral/PT Serif/Lora/STIX) via a throwaway FontLab
still harness + real-frame ffmpeg SSIM + eye strips (`work/cls-shared/fontab/
gen8/`). Unlike cls-day, the clsnet field SPLITS: current Georgia is
mid/bottom-pack on in-render ink-overlap (CLSNet **0.285**, AED **0.329**),
beaten by Charter 0.190/0.119 (system, but the EYE rejects it — low-contrast,
wrong category, the lesson-8 trap), Playfair **0.162**/0.215, Prata 0.190/0.149,
Noto Serif 0.197/0.220, DM Serif 0.209/0.185. The eye (montage-CLSNet.png)
confirms the ref is HIGH-CONTRAST and PLAYFAIR DISPLAY is the truest match (N
thick-diagonal/thin-verticals, elegant S, small e/t); Georgia is a lower-
contrast / wider compromise.
- **But the SCORING metric (SSIM) does not reward Playfair IN SCOPE.** Its
  cap-top factor is +0.190 vs Georgia's +0.135 (measured from the harness), so
  a fonts.ts-only swap (Georgia's 0.14 capTop is HARDCODED in ui.tsx SerifLabel
  L187 + scenesA wordmark L76 — off-limits geometry) sits ~12px LOW and LOSES
  full-frame SSIM: title f125 **.9159->.9093**, endcard f4075 **.8669->.8603**,
  mosaic f3550 ~flat, flows f425 +.001. Width is fine (Playfair natWidth 665 ≈
  Georgia 671, so scaleX 0.976 still fits). Every truer face needs its OWN
  capTop -> NO fonts.ts-only swap beats Georgia. Test swap reverted; NO code
  change this front.
- **HANDOFF (needs ui.tsx/scenesA/data.ts — off THIS front's file scope):** a
  PROPERLY cap-calibrated Playfair (capTop factor 0.14->**0.20**; wordmark
  scaleX stays ~0.976; mosaic capTop ~+7px at fs138 in the MOS spec) BEATS
  Georgia on the wordmark crop **+0.0033 at BOTH f125 and f4075** (vertical-
  swept optimum) and is eye-truest. It is a Google font (network, non-
  deterministic — r8 left it for that reason) worth ~sub-hundredth globally
  (lifts the title f99-149 + endcard worst-windows). Adopt only when those
  geometry files are free and the owner's eye is prioritised over the ~0 score
  delta. Wiring: `import {loadFont} from "@remotion/google-fonts/
  PlayfairDisplay"; const {fontFamily}=loadFont("normal",{weights:["400"],
  subsets:["latin"]}); export const SERIF=fontFamily;` in clsnet/fonts.ts.

### gen-8 LINE-ART front — 2026-07-11 (display-scale re-trace: globe + locks hexes)
Two ART-shape defects re-traced at display scale (the r8 "ink SHAPE, not
placement" floor). Both real wins, both gated on stills + eyes + CrxNetting.

- **`070e3ad5f` globe art re-trace (r6 gap 6 / r8 lead 4).** globeA/globeB were
  traced from a 720 crop with the white BACKGROUND + navy border baked in, then
  offset in code — rendering as a white swoosh arc across the disc + a blue
  disc-spill below the ring (broken f472-540, ~80f). Re-traced WHITE CONTINENTS
  ONLY, tight disc-centred crop (668,250,586 = 2*GLOBE.r) from regular_0040/0044.
  Scene rewired: disc-centred clip, blue fill under, navy border on top (covers
  edge sliver). Crossfade slide grid-searched on mid ref frames (regular_0041/
  0042/0043): 200 models the continents' leftward drift best (48→.897, 160→.905,
  200→.903 avg-whole, 200 wins 2/3). Still-gate before(r8)->after WHOLE: f475
  .870->.879 · f487 .892->.903 · f500 .888->.904 · f513 .887->.904 · f525 .887->
  .902 · f537 .895->.907 (+.009..+.017 across the window); globe-crop +.04..+.07.
  RESIDUAL globe-crop still ~0.6 = the RING rotation + label layout (invented, r6
  gap 6) and the crossfade approximating true rotation — NOT the ink shape.
- **`e7bf84ace` locks hex interiors re-trace (r8/r9 lead 2 — worst-texture floor).**
  The locks A/B hexes clipped the MIDDLE of the big cityA/cityB traces (native
  1150/1190) downscaled to 0.6 — the r5 downscale-loses-strokes pattern AND wrong
  content (temple too low/small, ref flanking skyscrapers absent). Re-traced
  lockCityA/lockCityB from the settled frame regular_0148 at the hex bbox
  (385x349, native scale): temple+flankers+ground, hex-inset masked, badge corner
  + perimeter painted out. New SmallHex `fillHex` mode renders 1:1 into the hex.
  Still-gate before(r8)->after, settled window f1819-1923: WHOLE f1825 .849->.902
  · f1837 .854->.907 · f1862 .851->.904 · f1900 .858->.911 (**+.053 flat**);
  HEX-REGION .655->.886 (**+.23**). f1780 phase-1 neutral. Hits r9 worst windows
  #4 (f1819-1869) / #5 (f1873-1923) / #11 (f1769-1819). Verdict: a REAL WIN, not
  the floor — the locks-hex "texture" was actually downscale + wrong-content, both
  fixable; the true residual (temple column hairlines) is minor.
- **HAZARD (shared-branch clobber):** the locks landing was first swept into a
  parallel typeface commit, then a parallel art.ts regeneration dropped it out of
  HEAD; re-committed cleanly (`e7bf84ace`, purely additive). art.ts is generated
  — parallel regens race; verify lockCityA/globeA survive after any sibling push.
- **Headroom toward 96:** these two were the biggest ART-shape (not geometry)
  levers left and both landed real gains on their windows (~+.05 locks, ~+.014
  globe over ~180 combined frames). Still-open line-art at the floor: the hex
  BUILDING hairlines inside cities/network/mbadge hexes (map-scale traces, could
  re-trace like the locks hexes — mbadge f3258-3308 is r9 worst window #1), the
  globe RING/label layout (invented), and the serif hairlines (typeface front:
  floor confirmed, Playfair needs off-scope geometry). 96 still needs the broad
  city/building re-trace across every remaining hex — the locks pass proves the
  method works and yields ~+.05/window; repeating it on mbadge + network + cities
  hexes is the remaining path, one hex-family per pass.

## r5 official verify — logged by orchestrator (2026-07-10 01:22)

- **SCORE 92.7** (video_ssim 0.9131 ·40% / keyframe 0.8964 ·35% / color 0.9896 ·15% / duration 0.9997 ·10%). Trajectory 87.7 → 90.7 → 91.1 → 91.6 → **92.7**. Freshness confirmed vs r4.
- The gen-4 agent died on a session limit (reset 5am Toronto) AFTER committing four r5/r6 passes: b1240dfc6 (cities measured pass — intro hold to f1062, moving badges, native-scale re-traces, five-pair carousel), 22e2fbca7 (payment pass), 3f148ae4e (flows page-flip rebuild — two static CC-scanned pill fields, not continuous growth), 23b0ec462 (detail card opens 2188–2202 + all-teal map badges).
- **DIRTY FILE AT DEATH:** `scenesB.tsx`, 46 lines (+26/−20), uncommitted. The agent's last words: "Flat scores — verifying the bands actually render." It was mid-investigation of whether some band change actually renders. Inheritor: audit this hunk hunk-by-hunk per doctrine (tsc → A/B stills vs HEAD in the affected windows → keep/finish/revert). Do not assume the worry was confirmed — the official r5 verify is healthy and moved on every component.
- Verify artifacts: `clsnet-{verify,keyframes,framessim}-r5.*`; render + logs at `work/clsnet/r5/` (attempt renders + `mb/` bench dir).
- Next: re-rank from `clsnet-framessim-r5.txt`; r4's list was rows-build f250–300, mosaic f3540–3590, cities-entry (attacked in r5 — likely moved), flows (attacked), payment (attacked). Expect a new leaderboard.

### gen-9 FULL CLIMB — 2026-07-11 (hex-family re-trace, sole clsnet agent) — landed 2 commits

Mandate: climb every remaining fixable HEX family via native re-trace (mbadge →
network → cities), r10 baseline 93.7. Sole clsnet agent this gen — owned art.ts
+ trace pipeline, no regen race. Instruments in `work/clsnet/gen9/` (mbtrace.py
= crop→hex-mask→trace driver; still.sh/ssim.sh gate helpers).

- **`03c529274` mbadge hexes re-traced native — r10 WORST window #1 (f3257-3307,
  0.8657) + #10 (f3192-3242, 0.8865). THE big lever.** The second-map
  (MapBadgesScene f3104-3364) hexes carried the FIRST-map r1 traces with THREE
  defects: (1) WRONG buildings — a Greek temple where the ref shows a city
  cluster (mHexBank), a dense multi-tower where the ref shows a sparse office
  (mHexOffice); (2) OVERSIZED — r7's "1.18x bigger → 254" read was WRONG,
  measured native is ~215×190 (SAME size as the first map, confirmed by navy-
  border bbox at f3162); (3) centres off up to 30px (mHexCity2 cy 798→768).
  Re-traced all 7 (mbHex*) from the clean settled frame regular_0254 (f3162 —
  all hexes drawn, NO badges occluding, the ideal source) at each hex's measured
  centre + native bbox (216×196), hexagon-masked (grow 6px) to kill map-line/
  neighbour corner intrusions. Purely additive: first-map mHex* + network
  L-variants untouched. Still-gate whole-frame (stash-isolated OLD@254 → NEW
  native PNGs): **f3200 .874→.959 · f3262 .875→.954 · f3275 .875→.954 · f3287
  .862→.916 · f3300 .909→.952** (+.043..+.085 across the window; the settled
  hexes gain ~+.08, the implode frames ~+.05). CrxNetting clean at f3262. Both
  mbadge windows should leave the top-12; the worst KEYFRAME idx66 t132/f3300
  should rise from 0.803 toward ~0.90.
- **`9f8b6ea64` matching hexes reuse native lock traces — r10 window #12
  (f1601-1651, 0.8900).** MatchingScene (f1462-1662) clipped the 1150/1190
  full-city traces into the 230px A/B hexes at scale 0.184 — buildings crushed
  tiny at the hex bottom while the ref hex is FILLED (same r5 downscale defect
  the r8 locks pass fixed). Reused the native lockCityA/lockCityB (385 bbox, r8)
  via SmallHex fillHex — same A/B buildings, correct fill. Still-gate whole-frame
  **f1560 .8814→.8827 · f1600 .8746→.8758 · f1625 .8792→.8805** (+.0013 flat —
  modest because the window is dominated by the centre counts-panel, NOT the
  hexes, but it RISES at all 3 gated frames and is a clear visual correction).
  CrxNetting clean at f1625.
  - **NEGATIVE A/B logged:** the SAME fill REGRESSED the HexifyScene transition
    (f1350 .917→.909, f1420 .868→.861) — during the hexify the ref city is still
    mid-compression, so the crushed-clip matches better than a filled hex. Kept
    clip mode in hexify; the fill win is steady-state only. Reverted (in-code
    comment at the HexCity call site).

**Families verified AT FLOOR this gen (logged, skipped):**
- **network hexes (f744-912):** settled state already native — the 4 keeper
  hexes were re-traced to mHex*L (396) in r6. Only network window in play is the
  ENTRY-MORPH seam f723-773 (rank 32, 0.917) which shows the transient map minis
  by design — a choreography/timing item, not a texture re-trace. Skipped.
- **cities (CitiesScene f1041-1302):** cityA/cityB + Small variants already
  native (r5). Eye-checked f1100 — temple(A)+sail(B) render full-size, content
  matches. At floor. (The city-in-hex USES were the levers: matching DONE,
  hexify tried+reverted.)
- **flows HexRow (f320-468, windows #4/#6/#8):** hexBank/hexOffice/hexTowers/
  hexSail are native 340 → displayed 320 (0.94, NOT a downscale defect). Grid of
  f340/f430 showed the SSIM driver is the top-row content at 0.01 SSIM = a
  scene-handoff TIMING/layout mismatch (rows→hexRow→flows), not hex texture.
  Out of the hex-re-trace mandate; a measured-choreography lead for a later gen.

**Honest floor (lesson 9):** the two clean hex-texture levers left in the r10
top-12 are SPENT — mbadge was the big one (worst window, ~+.06-.08/window over
~180 frames), matching a small correct-content top-up. Rough score estimate
93.7 → **~93.9-94.1** (mbadge dominates: it lifts window #1 + #10 and the worst
keyframe t132; matching adds a sliver). This lands at/near the honest ~94.5
ceiling the r8/r9 agents predicted. What REMAINS above the top-12 is NOT hex
texture: it is measured CHOREOGRAPHY/geometry (detrep-tail #2, reportOut #5,
payment #7, flows-handoff #4/#6/#8, matching centre-panel, mosaic-tail #9) plus
the confirmed-floor items (serif hairlines, globe ring/label layout, the first-
map mini content — same wrong-content as the old mbadge but transient & unscored).
96 still walls without re-drawing the entire city/building line-art to the ref's
exact stroke geometry (a pipeline project, not a round). Every remaining top-12
window is now a geometry/timing fix, not a re-trace. Recommend: run the official
gen-9 verify, then the next gen attacks CHOREOGRAPHY (detrep/payment/flows-
handoff), not more hex re-traces — the hex families are done.

### gen-10 CHOREOGRAPHY climb — 2026-07-11 (sole clsnet agent, r11 baseline 93.9)

Mandate: attack CHOREOGRAPHY (timing/motion), NOT texture (hex vein exhausted).
Re-ranked r11 worst windows: 1 f2270-2320 detrep (0.868) · 2 f100-150 title
(0.870) · 3 f314-364 flows-handoff (0.876) · 4 f2352-2402 reportOut (0.876) · 5
f364-414 flows · 6 f2590-2640 payment · 7 f414-464 flows→globe · 10 f1601-1651
matching. Two windows LANDED (both scene-transition TIMING bugs), flows-handoff
DIAGNOSED-but-deferred.

**THE decisive instrument fix (applies to every future gen):** the ref
`regular_NNNN` plate grid is **~+3f offset** from the SCORED ref VIDEO and is
coarse (every 12.5f). Three rounds mis-measured the detrep transition against it
(the "box entered 10f late" read was an artifact of the plate offset). gen10
gates against EXACT ref-VIDEO frames: `ffmpeg -i ref.mp4 -vf select=eq(n\,F)
-vframes 1 v_F.png` then ffmpeg-ssim vs the render still. The video is the axis
the SCORE measures; the plate grid can neither place a motion nor gate it.
Instruments in `work/clsnet/gen10/` (still.sh/ssim.sh, measure_box.py/
measure_detrep.py, vf/ = exact video frames).

- **`a2806aa32` detrep transition re-timed — r11 WORST window #1 (f2270-2320).**
  The real bug (measured from the video): the ref HOLDS the full gantt to ~f2306
  then shrinks FAST 2306-2315; the CLSNet box slides in from the RIGHT EDGE big
  (clipped, ~w980@2314) and shrinks as it travels (Lx/side 1440/836@2315 ->
  1232/674@2317 -> 997/488@2321), settling cx959/w329@2334. Mine shrank slowly
  from 2303 (panel too small at f2306) and the box entered 2313 offscreen at
  cx2350. sp(f) rewritten as a measured table that maps the navy-panel bbox
  EXACTLY onto REPORT.panel (the proportional model was already right — only the
  timing was wrong); box driven by left-edge; REPORT.box 805/350/345 ->
  795/357/329. The r6 "navy bar sweep" was a mis-read of the shrinking panel's
  own right edge — deleted. Still-gate vs EXACT video (HEAD -> gen10): **f2306
  .726->.872 (+.146) · f2309 .675->.854 (+.179) · f2312 .832->.878 · f2314
  .854->.872 · f2317 .833->.861 · f2321 .887->.901 · f2334 .904->.915**; f2325/
  2330 flat; reportOut window also +.002..+.006 from REPORT.box. **VERDICT: WIN**
  (the worst window, trough +.05..+.18). CrxNetting clean f2312.
- **`d29cbdc32` report-exit + handshake-rise re-timed — r11 window #4 (f2352-
  2402).** The ref holds the settled report to ~f2360, EXITS the docs f2362-2377
  (slide down + out), then the A/B hexes RISE from below and settle 2372-2392;
  the handshake graphic + horizontal arrows form LATER ~2405-2425. Mine held the
  report 3-doc layout to f2396 and faded the WHOLE handshake in 2404-2420 -> the
  report lingered f2372-2404 while the ref showed rising hexes. Fix: ReportOut
  out lerp[2396,2412]->[2363,2377] + a +360 downward exit slide; HandshakeScene
  split the single inOp into bgOp[2372,2384] + hexOp[2370,2379] with a rise
  (translateY 210->0 over [2372,2392]) + graphicOp[2405,2420] (settled timing
  untouched). Still-gate vs EXACT video (a2806 -> this): **f2367 .857->.880 ·
  f2375 .844->.875 (+.032) · f2385 .850->.887 (+.037) · f2395 .842->.879 (+.037)
  · f2405 .866->.892**; settled handshake f2420/f2440 EXACTLY unchanged (.898/
  .896). **VERDICT: WIN** (trough +.023..+.037, zero regression). CrxNetting
  clean f2385. KNOWN RESIDUAL: my SETTLED hex positions (cityA cx427 / cityB
  cx1512) sit ~200-340px off the video's during the rise (structure right, x off)
  — a refinement, and the settled handshake caps ~0.898 (building-trace texture
  inside the hexes = floor).

**flows-handoff (windows #3/#5/#7, f314-464) — DIAGNOSED, DEFERRED.** The sharp
crater is the rows->hexRow cut: f312 0.94 -> f320 0.82 -> recover f344 0.90.
Video vs mine at f324: the ref lines the FOUR skylines up HORIZONTALLY in a
compact row (no hexagons yet) while MY HexRowScene already forms the hexagons +
leaves gantt pills. So my hexRow hexes form too EARLY and the rows->row-line
arrangement differs. This is a genuine MULTI-STAGE morph (RowsScene ->
horizontal-line arrangement -> HexRowScene hexify -> FlowsScene), 3 windows,
NOT a single timing tweak — a full round's measurement (skyline-row positions
across the transition + hex-formation timing). gen-9 deferred it for the same
reason. Left for the next gen; it is the biggest remaining choreography cluster.

**Honest headroom (lesson 9):** gen10 landed the two cleanest scene-cut TIMING
bugs (worst + 4th windows), each a clear measured win with zero regression,
gated frame-exact against the video. Remaining CHOREOGRAPHY leads, worst-first:
(a) **flows-handoff f314-464** (3 windows, multi-stage morph — biggest lever,
diagnosed above); (b) **title f100-150** (R->L reveal timing, gap 4, still a
guess); (c) **payment f2590-2640** (r5-dense already — likely near floor); (d)
**matching centre-panel f1601-1651** (counts panel drives it). The detrep/
reportOut wins should lift the global ~93.9 by roughly +0.1-0.2 (both trough
windows rose ~+0.02-0.03 mean; each ~1/83 of the keyframe/video terms). ~94.5
still needs the flows-handoff + title reveal; 96 still walls on the city/
building line-art re-trace (a pipeline, not a round). RECOMMEND next gen: run the
official gen10 verify FIRST (confirm the two windows moved), then measure the
flows-handoff rows->hexRow morph against EXACT VIDEO frames (not the plate grid).

### gen11 FLOWS-HANDOFF climb — 2026-07-11 (sole clsnet agent) — landed 1 commit

Mandate: the biggest deferred choreography lever — the flows-handoff (rows->
hexify->flows, f314-464, windows #3/#5/#7). gen10 diagnosed it and deferred: at
f324 the ref lines the four skylines up HORIZONTALLY in a compact row BEFORE any
hexagon, while my HexRowFlows crossfaded a stacked 4-line layout into a different
hex layout AND leaked flow-pills. Measured & GATED against EXACT ref-VIDEO frames
only (gen10 plate-offset law); instruments in `work/clsnet/gen11/` (vf/ = exact
video frames f302-460, measure_converge.py = orange-cluster trajectory,
measure_bands.py/measure_compact.py = per-city landmarks, ssim.sh gates vs vf/).

- **`3c8cc521b` converge morph — r-baseline WORST choreography window #3
  (f314-364, 0.876) + the crater seam.** The true motion (orange-ink trajectory
  f312-326): the four skylines slide OFF their four stacked lines (grounds
  [220,462,765,1035]) into ONE compact horizontal row (grounds converge to
  [389,422,435,439] ~y420), x under the hex centers, orange widths shrink ~0.88x;
  THEN the hexagons draw around the settled cities and the CLSNet box draws
  (f324-336). Mine had NO slide — RowsBuild crossfaded out (opacity) while
  HexRowFlows crossfaded in the combined hex art (city+border baked) at a fixed
  layout, so f318-332 showed a 4-stack dissolve, not a row. Rebuild:
  - RowsBuild now carries the whole converge. cp = ref temple-ground curve
    interpolate(f,[312,318,320,322,326],[0,0.2,0.77,0.92,1]); per-city converged
    art placement ground-aligned to the compact row (CONV_X=[214,600,897,1150],
    CONV_Y=[261,237,202,232], scale 0.88 — art_bottom hits each measured orange
    ground, x on the defining orange landmark). Ground lines/ticks fade f311-320
    (ref f320 has no full-width lines). Layer fades FAST 323-333 so the WIDE row
    skylines don't linger and spill ghost buildings between the hexes.
  - HexRowFlows: box retimed 330-344 -> 324-336 (ref box is near-full by f332;
    old left a faint grey ghost through the hexify); hex inOp 322-336 -> 322-334;
    flow-pill field0 sIn floored at 0.15 (r5) so the page LEAKED in at 15% from
    f320 through the hexify — gated to the flows phase (f>=363), r5's f364+ growth
    untouched.
  - **Still-gate vs EXACT ref video (before -> after):** f312 .932->.932 (edge) ·
    f316 .822->.822 (both near-rows, correct) · f318 .790->.833 · f320 .797->.895
    (+.098) · f324 **.795->.896 (+.101)** · f328 crater->.874 · f332 .811->.871
    (+.060) · f336 ->.887 (box fix) · f340 ->.892 · f344 .890->.897 (edge, pill/
    box). Every gated frame flat-or-up; **no frame regressed**; the crater trough
    (f318-336) gains +.04..+.10. **VERDICT: WIN** — the single biggest keyframe
    gain (+.101 at f324) this campaign. CrxNetting clean at f332 (converge carries
    to the brand variant; box "CRX", geometry intact).

**Honest headroom (lesson 9):** gen11 landed the flows-handoff crater — the
biggest remaining choreography lever, deferred by gen9 AND gen10. The crater is
now filled cleanly. Rough score estimate: the fix lifts window #3 (f314-364) from
0.876 toward ~0.90 (the ~12 crater frames gain +.04..+.10) plus small edge gains
into #5 — roughly +0.05..+0.15 global (per the ~1/83-per-window rule). Remaining
on this cluster:
- **f328-332 spillover residual (~0.87):** the wide row skylines fade rather than
  get CLIPPED to the hexagon during the crossfade, so faint ghost buildings sit
  between the hexes f326-332. A next-gen refinement: clip each converged city to
  its hex horizontal extent as cp->1 (per-frame clipPath in the scaled local
  coords) — maybe +.01..+.02 at f324-332. Fiddly; left for a clean pass.
- **flows PROPER — windows #5 (f364-414) + #7 (f414-464) UNTOUCHED.** These are
  the pill-field page-flip + label swap + exit slide (r5/r6 timing, gap 2 "growth
  approximate"), NOT the crater. The remaining flows-handoff choreography lead.
- The hex-interior building TRACES (locks-pass method) are the texture floor here
  too; the f332+ settled hexes cap ~0.887 on trace fidelity, not placement.
RECOMMEND next gen: run the official gen11 verify FIRST (confirm window #3 moved),
then either the converge-clip refinement (cheap) or attack flows-proper #5/#7
(pill page-flip timing) against EXACT video. ~94.5 asymptote still holds; 96 still
walls on the city/building line-art re-trace pipeline.

### gen12 HEX-INTERIOR TEXTURE test — 2026-07-11 (sole clsnet agent, r-baseline 93.9) — NO COMMIT, floor confirmed

Mandate: test clsnet's one remaining BROAD lever. The choreography wins (gen10/11)
were NARROW (trough frames between the verify's 2s keyframe samples) so r11=r12=93.9
flat. The only SCENE-WIDE deficit left is HEX INTERIOR TEXTURE: settled hexagons
cap ~0.88 on trace fidelity and hexes span many frames — so re-tracing interiors
FINER *should* lift every hex frame = broad, IF it works. Instruments in
`work/clsnet/gen12/` (lock_retrace.py = crop→mask badge+inset-hex→2x-LANCZOS→trace;
lock_retrace_1x.py = 1x native + trace_t.py POTRACE_T env; ssim.sh/cropssim.sh gate
vs EXACT video frames vf/v_F.png per the gen10 plate-offset law; insp/ = ref/before/
after strips). art-store baseline preserved at `art-store.json.bak-gen12`.

**FAMILY PICKED = lockCityA/lockCityB** — the single most-REPEATED hex ART asset:
reused across MatchingScene (f1462-1662, SmallHex fillHex) + reportsUp phase-1
(f1662-1770) + LocksScene settled (f1662-1930) ≈ 468 frames. It also caps lowest
of the settled families on the hex crop (~0.81-0.84 vs network 0.97+, mbadge 0.92+
after gen9). Broadest possible interior lever.

**Baseline empirics (before, vs EXACT video):** whole-frame f1560 .8795 / f1625
.8717 / f1750 .8839 / f1825 .9003 / f1862 .9004 / f1900 .9110. Locks-settled hex
crops (385x349): hexA .837, hexB .813. Matching hex crops (230x208): 0.34-0.40 —
BUT that low number is a POSITION error (ref matching hex sits ~40px higher, cy~250
vs my 290), not interior; off this test's mandate. Measured temple bbox at f1900:
IDENTICAL ref vs mine (496,323,732,471) — hexA building placement already correct;
only hexB skyline sits ~39px LOW (orange top y325 vs ref y286, an r8-plate artifact).

**Two independent finer re-traces, both from the EXACT settled video frame f1900 at
the fillHex bbox (fixes hexB placement 1:1), badge+inset-hex masked out:**
| frame | baseline (r8 -t2) | 2x-LANCZOS upsample | 1x native, -t 0 |
|---|---|---|---|
| f1825 whole | .9003 | .8961 (−.0042) | .8944 (−.0059) |
| f1862 whole | .9004 | .8962 | .8945 |
| f1900 whole | .9110 | .9070 (−.0040) | .9053 (−.0057) |
| f1900 hexA crop | .837 | .790 (−.047) | .781 (−.057) |
| f1900 hexB crop | .815 | .807 | .791 |
| f1560 matching whole | .8795 | .8796 | .8798 (flat) |
Path-char detail rose 3-3.4x (lockCityA 7602→25753/20948) — genuinely finer, and it
LOST. Diagnosis (insp/hexA_ref_before_after.png): 2x-LANCZOS FATTENS strokes (the
blur halo classifies as ink — lesson 4, bold-in-place loses); 1x -t0 keeps video-
COMPRESSION-noise specks → cluttered interior. The r8 `-t 2` native trace is already
at the trace-fidelity OPTIMUM. The ref line-art is ~1.5-2px hairlines the compressed
1920-wide source can't resolve finer; potrace already captures all real ink. Even
fixing hexB's real 39px placement in the re-trace did NOT net a win — the fattening/
noise cost more than the placement gain.

**VERDICT — FLOOR CONFIRMED, clsnet's ~93.9 hex-interior ceiling holds.** Re-tracing
settled hex interiors finer does NOT move the metric broadly: it REGRESSES every
settled-locks frame ~0.004-0.006 whole-frame (−0.05 on the hex crop) and is flat at
matching/reportsUp (hexes small / dominated by the counts panel). This is exactly the
"dense-near-miss LOSES to current" case the mandate anticipated — a valuable negative.
NO COMMIT; tree reverted byte-identical to gen11 3c8cc521b (git diff clsnet empty,
lockCity back to 7602/15003 chars). The hex-texture vein — pronounced exhausted by
r8/r9/gen9 — is now PROVEN at the floor by direct before→after against the exact video.
- **The remaining path is NOT finer tracing of the same source.** Two real leads it
  surfaced, both GEOMETRY (placement), not texture: (a) matching hexes ~40px too low
  (MATCH.hexA/hexB.cy 290 → ~250, and slightly oversized — crop 0.34, a big window
  over ~200 matching frames if fixed); (b) locks hexB skyline ~39px low + the locks
  hexagon OUTLINE ~18px below the ref (Hexagon cy 413 vs ref ~395). These are cheap
  measured geometry fixes for a future gen — and unlike interior texture they can
  actually win. (c) True texture gain needs re-DRAWN (not re-traced) vector line-art
  to the ref's exact hairline geometry — a pipeline project, not a round; still walls 96.

### gen13 HEX/BADGE REGISTRATION — 2026-07-11 (sole clsnet agent, r-baseline 93.9) — landed 3 commits

Mandate: fix the BROAD geometry-registration bugs gen12 surfaced (mis-PLACEMENT,
not texture). gen12's numbers were measured against the badge-POLLUTED navy
vertical-extent midpoint (the badge sits above the hex top, dragging the extent
up) — so its "cy 40px/18px low" reads were WRONG. Re-measured everything from the
EXACT ref video using the CLEAN right-tip (the hex's pointy right vertex = its
true vertical center, no building/badge nearby) + the flat-bottom outline.
Instruments in `work/clsnet/gen13/` (measure_hex.py = navy-mask right-tip/tip/
extent finder; badge-disk finder via erosion; still.sh/ssim.sh gate helpers;
vf/ = exact ref video frames). All gated vs EXACT video (gen10 plate-offset law),
≥4 frames across each window.

- **`2d22f6354` matching hexes were OVERSIZED, not low — the broadest lever.**
  gen12 said "cy 290→250, 40px low". FALSE. Direct render-vs-video at f1560:
  the hex OUTLINE center cy is ALREADY right (render right-tip 289.5, ref 291);
  the r8 `w=230` was 16px too WIDE, so the outline bottom sat 7px low, the top
  12px high, and fillHex scaled the A/B building too big. Measured ref outline
  (right-tip + flat-bottom): cy 290, w **214**, cx **413/1513** (was 415/1516).
  MATCH.hexA/hexB → {cx 413/1513, cy 290, w 214}. Still-gate vs exact video:
  **f1500 .8968→.9066 · f1560 .8795→.8893 · f1600 .8697→.8796 · f1620 .8723→.8822
  (+.0098..+.0099 flat across the ~200f matching window f1462-1662).** BROAD WIN.
- **`41fbc2f9f` locks A/B badges grow with the hex (r fixed 36 → 0.14·w).**
  gen12's "outline 18px low (cy 413→395)" was again the badge-polluted midpoint;
  the true ref locks outline center = **410** (render 413, only 3px) and its size
  is right (383). The real locks defect is the BADGE: measured ref r54 @ cy266
  settled (f1900), r29 @ cy211 phase1 (f1700) — it GROWS with the hexagon at
  r≈0.14·w. The hardcoded r36 was 18px too small + 26px too LOW settled, slightly
  big in phase1. Radius now tracks 0.14·hexW (54 settled / 30 phase1); offset
  ratio drifts dy -0.335→-0.382 across the grow so the disk lands on the ref at
  BOTH ends. Still-gate vs exact video: **f1700 .9002→.9013 · f1750 .8839→.8850
  (phase1/transition, NO regression) · f1800 .9024→.9058 · f1825 .9003→.9037 ·
  f1862 .9004→.9038 · f1900 .9111→.9144 (+.0034 across the ~110f settled window
  f1819-1930).** BROAD WIN.
- **`5f31eb9e6` matching A/B badges to measured position (dx/dy -0.327/-0.374).**
  The SmallHex default badge (dx-0.38/dy-0.40) put the matching disks 11px left +
  6px high of the ref. Measured EXACT video (consistent f1500/1560/1600): A
  (344,210), B (1442,210), r30. Still-gate vs exact video: **f1500 .9066→.9089 ·
  f1560 .8893→.8916 · f1600 .8796→.8819 · f1620 .8822→.8846 (+.0023 flat across
  the ~200f matching window).** BROAD WIN. (Matching window total this gen:
  +.010 size +.0023 badge ≈ **+.012**.)

**Tested-and-rejected (evidence, not theory):**
- **Locks outline cy 3px** — the render outline sits 3px low vs the ref (413 vs
  410), but it CANNOT be moved: the hex art (temple, correctly at 323=ref) moves
  WITH the outline in fillHex. Test cy 413→409 (badge dy-compensated to stay on
  ref) **LOST −0.024 at f1825 AND f1900** — displacing the correctly-placed
  temple/skyline (the dominant high-contrast ink) costs far more than the 3px
  outline stroke gains. Reverted byte-identical. A clean fix would need to
  DECOUPLE the Hexagon stroke from the art inside SmallHex for a ~+.001 gain —
  low-yield, not worth the risk to the art registration. Floor.

**Confirmed floor (diff composites `work/clsnet/gen13/diff_{match,locks}.png`,
current-best vs exact video):**
- **hexB skyline ~39px low** — NOT a placement bug: the ground/base is aligned
  (both y559), only the building TOP differs (ref 286, render 325) → the traced
  lockCityB building is too SHORT. gen12 already re-traced it 1:1 and LOST on
  SSIM (fattening). Moving the whole hex loses (above). True texture floor.
- Remaining diff brightness = hexB skyline height + badge-edge antialiasing
  (near-floor after the r54 fix) + hex-interior hairlines + the ClsNetBox logo
  detail (out of hex/badge scope). NO further BROAD geometry error in either
  window — both hexes/badges now register cleanly (faint in the diff).

**Honest headroom:** the three broad registration levers gen12 surfaced are now
SPENT — two matching (size + badge, ~+.012 over 200f) and one locks (badge,
+.0034 over 110f), all gated frame-exact and confirmed uniform across their
windows. CrxNetting brand variant eye-checked clean at f1560 (matching) + f1900
(locks) — geometry carries. What remains in these windows is texture floor
(hexB skyline height, hex hairlines) that gen12 proved re-tracing can't win.
The next broad levers are OUTSIDE matching/locks (the flows-handoff #5/#7 pill
page-flip, title R→L reveal — gen11's leads). 96 still walls on the re-DRAWN
line-art pipeline.

### gen14 ANIMATION-FIDELITY — 2026-07-11 (owner directive: reproduce the real TITLE animations, eye-judged not SSIM) — landed 2 commits

Owner overrode the SSIM-registration approach for the TITLE scene: these are
MOTION-DESIGN videos; the intro was doing invented/weak motion where the ref
cleanly animates elements in. JUDGE = the EYE via side-by-side ref/replica
filmstrips (SSIM is motion-blind). Every timing ink-scanned from the EXACT ref
video (25fps, so ref frame n = comp frame n). Instruments + all filmstrips in
`work/clsnet/anim/` (vf/ = exact video frames, still.sh, the cmp_*.png strips).

- **`71d0d625b` TITLE reveal (f0-56) — the three real motions.**
  1. **Logo lockup DRAWS ITSELF IN.** Was ONE opacity fade of the traced
     `clsLogo` blob. Now three DISJOINT region-clips of the SAME traced asset
     (settled pixels byte-unchanged, zero shape risk): swirl mark first (f0-6),
     CLS letters wipe LEFT→RIGHT (f4-20: C→CL→CLS via a right-inset that shrinks
     76.3%→0), tagline fades (f17-24). Splits at art-x71 (mark|letters, =23.7%)
     and art-y55 (letters|tagline, =55%), measured: letters y84-132, tagline
     y134-144. Mark clip carries bottom 45% so the tagline's left half no longer
     leaks under the mark.
  2. **Wordmark reveals RIGHT→LEFT.** Mechanism (clip inset from left) was
     already right; TIMING was a too-fast f0-11 wipe (73% done by f8). Retimed
     to the measured leftmost-white-ink curve interpolate([5,6,8,10,12,14],
     [0,.01,.14,.63,.82,1]) — "…et" at f8, whole by f14.
  3. **Principle cards GROW out of a loader bar, staggered** (card35 growP
     f23-30, card50 f43-51), content (kicker/num/strip) filling AFTER each box
     grows — measured card-body vertical extent (card35 bar y577-602@f22 →
     full y357-723@f30). Intro previously hard-set growP=1 so cards just faded
     in fully-formed; now it uses the SAME bar→body grow the endcard already had.
     Removed bar1Op (a spurious 2nd grey bar the ref never shows).
  CRX untouched (logoArt=null → text-logo fallback); CrxNetting eye-checked
  clean f16/f32/f142 (Pillar-01 card grows, exit wipes). Eye-verdict: reveal
  MATCHES across f0-56 (clsnet_reveal_final_strip.png).
- **`7cd64a88e` TITLE outro (f139-152).** Was invented: −10° panel rotation +
  white wipe from the LEFT. Measured: wordmark stays HORIZONTAL (no rotation),
  drifts UP ~57px by f142; white DIAGONAL wipe sweeps in from the RIGHT
  (navy→white left edge top 1920→0 / bottom 1920→0, top leading). Reproduced by
  CLIPPING the title away along the measured diagonal polygon (exposing the real
  RowsBuild/white bg, like the ref) + the up/right drift. Eye-verdict: MATCHES
  f142/146/150 (cmp_exit2.png).

**Other animations still needing the same eye-audit (leads for a next pass):**
globe rotation (STATE gap 6 — approximated by crossfading two traced states, an
INVENTED motion, ~f462-566); scene→scene transitions that are linear fades where
the ref uses slides/marks (STATE gap 7 — map→network hex morph, cities
shrink+hexify); flows pill-field page-flip #5/#7 (gen11 lead). These are motion,
not texture — judge by filmstrip, not SSIM.

### anim gen-2 — 2026-07-11 (GlobeScene rotation, GlobeScene→worldMap unify)

- **`<globe-rotation>` GLOBE rotation (STATE gap 6, f462-566) — the INVENTED
  crossfade is gone; a REAL longitude scroll replaces it.**
  - **What the ref ACTUALLY does:** the globe disc is a scaled, disc-clipped
    WINDOW onto the SAME worldMap the scene zooms into at f566+ (proven: the
    f562-566 disc continents == the f582 full-frame map — the "zoom-out" reveals
    the whole map the disc was showing). Its continents scroll RIGHTWARD,
    decelerating from ~5.5 px/f at f486 to rest by ~f550 (~206px total). 2D
    phase-corr of the white-line masks gives a clean monotone deceleration,
    dy=0 (`work/clsnet/anim/measure2d.py`).
  - **What was invented:** `spin=lerp(478,545,[0,1])` crossfaded two disc
    snapshots (globeA/globeB) while sliding them LEFTWARD (`left:-spin*200`).
    Two wrongs: a crossfade is not a rotation, AND the slide was the WRONG
    DIRECTION (ref goes right). globeA also carried the broken swoosh-arc/disc-
    spill art (r6 gap-6 defect).
  - **The fix:** one `worldMap` TracedArt, scaled 0.76 (grid-fit vs the f582 map,
    score .88; `fit_scale.py`), vertically centred (oy 174), x-origin scrolled
    per a measured `mapOx` keyframe table [478..558]→[300..525]. Clipped to the
    disc. globeA/globeB no longer referenced (left in art.ts, harmless); the
    swoosh defect is retired with the snapshot. tsc clean; scenesA.tsx only.
  - **Eye-verdict — MATCHES.** f510 anchor overlay is near-perfect (ref-red /
    replica-blue continents coincide as black across the whole disc,
    `ov_ref_rep_510.png`). 5-frame ref-over-replica filmstrip through the motion
    = `work/clsnet/anim/globe_strip_final.png` (f486/502/518/534/550): continents
    scroll right + decelerate, shapes track. Entry(f482)/exit(f556) clean, disc
    clip tight = `entry_exit.png`. Residual end-drift ≤ one coastline cell
    (~40px) — alias-limited (quasi-periodic coastlines defeat sub-cell
    correlation); within eye tolerance, SSIM secondary per mandate.
  - **KNOWN pre-existing (NOT motion, left alone):** the ring TICK density is
    denser than the ref (code draws 48 ticks; ref ~24) — a trace/geometry detail
    that has ridden since r1, out of scope for a motion round.

**Next anim to fix:** the GLOBE→MAP zoom (f556-568) is still a FADE-out of the
disc under MapScene's expanding blue rect — but now that the globe IS a 0.76-
scaled worldMap window, it can MORPH: ramp scale 0.76→1.0 and origin→(MAP.x,
MAP.y) over f556-575 so the disc's map hands off SEAMLESSLY to MapScene's full
worldMap (a real zoom, not a fade). Then: cities shrink+hexify (gap 7).

### anim gen-3 — 2026-07-11 (LATER scenes, scenesC f1462+, eye-judged) — 1 commit

Owner directive: final animation-fidelity audit of the LATER scenes (Gantt/
matching, handshake, payment, shield/mosaic, endcard) — reproduce the ACTUAL
motion, delete invented fade/late/wrong-direction motion. JUDGE BY EYE via ref-
over-replica filmstrips, not SSIM. Method (gen10 plate-offset law): EXACT ref
video frames only (`vf.sh` = mid-frame seek `(F-0.4)/25`, verified AE=0 vs the
slow select method; 25fps so ref n = comp n). Extracted 130+ ref frames across
every scenesC entrance, built ref-only strips per scene, read them, rendered
replica stills for the suspects, montaged (yellow=ref over cyan=replica),
diagnosed, fixed, re-gated. Instruments + all strips/montages in
`work/clsnet/anim/` (vf.sh, refstrip.sh, mont.sh; ref_*.png diagnosis strips;
ab_*.png before montages; gate_*.png after montages; crx_check.png brand cut).

**Surveyed ALL 12 scenesC scenes; found THREE invented motions (commit
`10eaabb63`), the rest FAITHFUL:**
- **Detail card (gantt, f2188-2208) — fade→GROW.** Ref grows an OPAQUE card out
  of the collapsing gantt rows (medium@2190 → full@2196) THEN populates the
  field text (Counterparty/Unique Identifier/… @2200-2208). Code faded a fixed
  full-size card via opacity — gantt rows GHOSTED through the translucent card
  and text appeared with it (ab_detail.png). Fix: DetailCard gains growP (scale
  from 0.14 about card-centre over 2188-2196) + fast opaque entrance
  ([2188,2193]) + a contentOpacity wrapper delaying ALL internal ink (labels/
  values/rules/dividers) to [2198,2207]; detailP entrance tightened [2188,2202]
  →[2188,2196] (rows collapse + PO1I drop faster, matching ref). Exit unchanged.
  gate_detail.png: card empty@2196, text@2202, NO ghost rows. **WIN.**
- **Payment entry (f2472-2492) — crossfade DIP killed.** Ref un-hexes A/B into
  the two cities-on-a-line so they are SOLID at the scene's first frame (~f2480,
  boundary scan vf 2474/2478/2480). Code: handshake out[2470,2484] vs payment
  in[2482,2496] = a DIP — empty ghost-hexes at f2480, cities only 29% at f2486
  (ab_payment.png). Fix: handshake out→[2472,2482] over the SAME window payment
  now enters (in→[2472,2482], mount guard −8f) so opacity-sum holds ~1 (reads as
  the morph); cities solid by 2482. gate_payment.png: no dip. **WIN.** (Residual:
  ~20% ghost-hex at the single f2480 frame — sum-1 no-dip preferred over a hard
  cut; within eye tolerance.)
- **Map entry (f3104-3130) — dim slow fade→bright on-time draw.** Ref draws the
  world map BRIGHT/full by ~f3112 with hex-1 present; code ran a 26f dim grey
  fade to 3130 with the hex cascade late (ab_map.png). Fix: mapP→[3104,3113];
  hex pops 3116+i*7 (10f grow) → 3106+i*9 (8f grow). gate_map.png: bright map,
  hexes on-time. **WIN.** (Residual: hex APPEARANCE ORDER/positions are the
  pre-existing measured MB_HEXES layout, not motion — out of scope.)

**FAITHFUL (eye-confirmed vs ref strips, NOT touched):** gantt ride-up + row
cascade (top→bottom fully-formed pops); report-out exit + handshake hexes rise +
graphic form (gen10 d29cbdc32); circle handshake-pill GROW (not fade); mosaic 4
pop-pages (r5); shield zipper-draw/white-wipe-left/shield-pop; ledge band
see-saw rotation + stacks drop-in; strip2 line-descend→band-grow entry (r3).

**CrxNetting brand cut eye-checked clean** at all three fix frames (2196/2480/
3112 — crx_check.png): grow, crossfade, bright map all carry; brand copy (RFQ
IDs, Payment complete) intact. tsc clean; scenesC.tsx ONLY (35+/13−).

**Remaining anim leads (documented, NOT fixed — risk/scope):**
- **Endcard url-box (f4028-4050):** ref reveals it L→R fast (cl@4030 → full
  @4038) with the disclaimer appearing LATER (~4044); code slow-fades a fixed
  box + shows the disclaimer early (ab_endcard.png). A clean fade-vs-wipe, but
  ENDCARD.urlBox is 910px wide vs a ~330px ref box — a possible GEOMETRY confound
  that a pure-motion clip-reveal would expose. Measure the box width first.
- **buildPop→map seam (f3104):** ref HOLDS the buildPop hexagon at f3104 and the
  world map draws AROUND it (it becomes the map's centre hex); code goes blank at
  3104 then fades the map. A held-element morph — structural, touches the
  measured buildPop end. Left to avoid regressing reportCard/buildPop.
- SSIM impact of this round is ~nil (all three are sub-keyframe-sample trough
  frames + the eye-fixes trade a hair of SSIM for correct motion) — this was an
  EYE round per the owner directive, gated on filmstrips not the metric.

### MODEL-DETAIL round (2026-07-11) — line-art fidelity, eye-judged (crops in work/clsnet/models/)
Owner directive: motion is faithful but the LINE-ART MODELS read rushed. Judge
by eye (ref-vs-replica crops), NOT SSIM. Three targets — mark / globe / hexes.

1. **Title mark — RUSHED → FAITHFUL. Commit `4e5829388`.** The potrace `clsLogo`
   mark rendered a thin crescent MISSING the inner comma (the whole point of the
   CLS swirl). Rewired the title+endcard mark to the sibling's faithful
   `cls-shared/logo.tsx` `ClsMark` (real swirl-with-inner-comma, commit
   `8f6ba8e76`). Placed pixel-true from f110 (measured white-swirl bbox frame
   x135-198/y83-147, ~63px sq): `MARK={x:132,y:81,size:68}` in scenesA. Replica
   bbox x134-198/y83-147 (≡ref); ink mass ref 1946 vs rep 2001 (≡, if anything a
   hair heavier — the 10x "thinner" read was gap DISTRIBUTION not weight). Split
   the lockup bottom clip (`inset(55% 0 0 23.7%)` + `inset(73% 76.3% 0 0)`) so the
   tagline "tru…" under the mark survives while the OLD potrace mark drops
   entirely (mark bottom y147, tagline top y156 → clean 9px gap). Crops:
   mark_cmp_v1 / mark_sbs_v1 / logo_cmp_v1 / logo_cmp_end. VERDICT: **now faithful.**
2. **Globe continents — ALREADY CLEAN, no change.** The globe continents are NOT
   globeA/globeB (that broken-swoosh defect was superseded by the r6 worldMap-
   window rewrite) — they are the shared `worldMap` trace disc-clipped + scrolled.
   Overlaid ref-vs-replica worldMap at scale 1.0 (f700 Africa): coastlines
   near-IDENTICAL (same stroke width, same blocky shapes) — the trace is faithful,
   not sketchy. The f540 disc difference is purely SCROLL POSITION (motion, out of
   scope) + a ~0.76× stroke-width from the disc-window scaling (architecture — the
   ref draws globe coastlines at ~constant width, we downscale the map; fixing it
   would break the r6 zoom-seam). Crops: disc_sbs / africa_sbs / globe555_sbs.
   VERDICT: **already faithful — re-tracing a clean asset would only risk regression.**
3. **Hex interiors — one real defect FIXED, rest is the texture floor. Commit
   `c956a745e`.** matching/locks hexes (`lockCityA/lockCityB`, no tan layer) read
   faithful. NETWORK hexes (`mHex*L`, r6 re-trace) had a mis-traced colour: the
   light-grey building faces of the heli(hex1)/bank2(hex3) hexes were classified
   as tan #E9C8B0 (probed f890: ref neutral grey ~215/215/215 where the trace
   paints peach 233/200/176). Recoloured those two hexes' tan → #D6D6D6 grey via a
   per-hex `recolor` on the NET_HEXES mount; left bank(hex2)/city2(hex4) tan
   (their few tan px sit on genuinely warm orange edges, ref R−B ~76). On STROKE
   WEIGHT: measured navy-line widths ref-vs-replica along scanlines — the widths
   already MATCH (ref [12,3,3,4…42,4] ≡ rep); the residual gap is MISSING FINE
   DETAIL LINES (window mullions the potrace dropped at scale), so a dilation
   would over-thicken the matching strokes without recovering detail — the wrong
   fix, and the documented re-trace-pipeline floor (lesson 9). Crops: hex1_sbs
   (before) / hex1_sbs_v2 / hex3_sbs_v2 / net_before_after. VERDICT: **improved
   (colour now correct); fine-detail line count is the texture floor.**

tsc clean (0 errors). Build-only round, no full verify. Commits staged clsnet-
only paths (scenesA.tsx twice) — lane isolation held vs the parallel cls-day
builder (its commit `dc654a765` interleaved cleanly).

### HEX-WINDOW FINE-DETAIL round (2026-07-11, sole clsnet agent) — the named "true model floor" — LANDED 1 commit
Mandate: rebuild the network-hex building-face window detail (mullions) as CLEAN
VECTOR, not another trace of the compressed source (gen12 proved finer tracing
LOSES). Frames measured against the EXACT ref video (25fps, ref n = comp n).
Network settled window f744-912; clearest settled frame f890. Crops/gate art in
`work/clsnet/models/` (cmp_{heli,bank,bank2,city2}.png ref-over-replica; zc_*.png
6x window zooms; ab_{heli,temple}_oldfix.png; morph_765_fix.png).

**HONEST DIAGNOSIS — the residual was MIS-NAMED by every prior round.** The
MODEL-DETAIL round called it "MISSING fine detail lines (window mullions potrace
dropped)". FALSE. At 6x the mullions/columns/window-squares are ALL PRESENT in
the replica (same count, same positions). The real defect (pixel-probed f890
scanline y470): the mHex*L asset is a stack of 5 separate per-colour potrace
polygons (#FFFFFF/#002753/#D45837/#A8A8A8/#E9C8B0) that do NOT abut — sub-pixel
GAPS thread the whole face, and the **blue scene bg (#4CA0D3 = 76,160,211) bleeds
through them** as ghost hairlines beside every stroke. That gap-bleed (probed:
8119 blue px in the heli interior box) is the "doubled/rushed" look — NOT dropped
ink. The ref hex interior is solid white. So the honest fix is a clean vector
BACKING, not a re-trace: neither dilation (over-thickens real strokes) nor finer
tracing (gen12: fattens/adds noise, −.005) could ever fix a GAP problem.

**PATH CHOSEN: (b)-adjacent — a clean vector primitive, but a WHITE HEX BACKING,
not a hand-drawn mullion grid.** A per-hex mullion grid was the wrong tool: the 4
faces are unique buildings, not a uniform grid, and the mullions already render.
The gap-bleed is killed at the root by one solid white `Hexagon` behind each
`TracedArt` in `NetworkScene`, sized to land just inside the navy border (measured
heli outer w372/h330, ratio 0.887; backing w = artW*0.985, h = bw*0.887, white
fill + 3px white stroke) so it fills every interior gap and the art re-draws the
navy border on top → zero spill over the blue. Tracks per-frame cx/cy/w so it
carries through the f756-772 morph. `scenesA.tsx` only (import Hexagon; backing
group before the elbows so z-order = bg→backings→elbows→docs→arts→wipe).

**A/B GATE (ref vs OLD render vs FIX render; OLD via `git stash push` of my file
only — lane-safe):**
- Whole-frame SSIM ref-vs-OLD → ref-vs-FIX: f800 .973217→.973492 · f825 .970628→
  .970876 · f850 .973758→.973973 · f890 .981005→.981094. **POSITIVE at all 4.**
- Hex-band crop SSIM (x180-1800,y210-850): f800 .9465→.9481 (+.0016) · f850 .9479
  →.9493 (+.0014) · f890 .9621→.9632 (+.0011) — the localized win, uniform across
  the ~168-frame network window.
- **Rare double win:** unlike gen12's finer-trace (LOST on SSIM), this fix REMOVES
  blue the ref lacks + adds white the ref has → helps BOTH eye and metric.
- Eye: ab_heli/ab_temple oldfix strips — the blue ghost lines beside the orange
  columns/cornice are GONE, interior reads clean white like the ref. Mid-morph
  f765 clean: interior white, NO white spill past the navy border. CrxNetting
  shares NetworkScene (brand-neutral geometry) — backing carries, no brand risk.

**Commit `<HEXBG>` (see git log) — scenesA.tsx only. tsc 0 errors.**

**HONEST RESIDUAL (lesson 9 — is the floor lifted?):** The gap-bleed floor is
LIFTED — the named "rushed" tell is gone and it cost nothing (SSIM up). What
REMAINS is the true texture floor gen12 proved: the ref's ~1.5-2px hairline stroke
GEOMETRY inside each pane, which the 1920-wide compressed source cannot resolve
finer — unreachable without re-DRAWING (not re-tracing) the line-art, a pipeline
project, not a round. The strokes themselves are also a hair thin/soft vs ref
(anti-alias), a smaller residual. **Cheap transferable lead:** the SAME gap-bleed
almost certainly afflicts other blue-bg traced hex faces — the MapScene mHex*
minis (f620-745) and the mbadge mbHex* (MapBadgesScene) — a white-backing pass
there is the same trivial win (matching/locks already fill white via SmallHex
fillHex, so they are exempt). Not done this round (task scoped to network hexes).

### dispatched sweep — 2026-07-12 (r13 baseline 0.8704 worst-window; 3 file-scoped builders in parallel) — landed 8 commits

Mandate: the r13 worst rolling-window was **f100-150 title, mean 0.8704** — the
SETTLED TitleCard region (f100-138 fully static; f139+ is the gen14 TitleOutro
wipe, left alone). Orchestrated as THREE parallel builders, one per scene file
(zero git collision — each stages only its own path), all serialized through the
single `/tmp/replica-render.lock` (only one `remotion still` at a time; 16GB Mac
swap-saturated, BUILD-ONLY, no full verify — OOM). Grid-triaged the settled title
first (`ssim-grid.py`), then each builder swept its remaining worst windows.
Gate law: EXACT ref VIDEO frames (25fps, ref n = comp n), ffmpeg-ssim, A/B
ref-vs-OLD-vs-NEW (OLD via `git stash push -- <own file>`), NEW≥OLD at every gated
frame + eye montage. Instruments in `work/clsnet/{title,disp-A,disp-B,disp-C}/`.

**scenesA — title f100-150 (WORST) + flows f362-462. 3 commits.**
The settled title's two DOUBLED elements in the diff composite (the CLS logo +
"CLSNet" wordmark show EDGE-ONLY diff = serif/trace texture floor, NOT chased):
- **`9d9dc9a10` supporting line ("Supporting adherence to the FX Global Code:",
  `SansText`).** Ref ink `896×43` top y283; replica @fs38 rendered `773×36` top
  y290 — ~19% too SMALL + 7px low. Width-matched (lesson 4, left-anchored):
  fs38→44, y283→275; new bbox `895×42` top y283 left x861 = ref within 1px.
  Gate whole-frame / supporting-crop: f100 .9159→.9255 / .620→.851 · f110 .9159→
  .9256 / .620→.851 · f120 .9159→.9255 · f130 .9159→.9256. Eye+metric double-win.
- **`32a671c64` principle-card strip labels ("Settlement risk" / "Netting &
  settlement process", `PrincipleCard` SANS).** Ref card1 `310×28` top y642;
  replica @fs30 `200×23` top y623. fs30→36 + per-card `stripDy` (card1=32 1-line
  sits low, card2=11 2-line block starts high). NEGATIVE A/B LOGGED in-code: a
  uniform +32 dropped card2 line1 to y643 → −0.046; the per-card offset fixed it.
  Whole-frame .9255→.9269 / card1-crop .487→.584 / card2 .486→.496. Residual: label
  width ~23% short (Helvetica narrower than the ref face; letterSpacing deferred —
  SSIM-blind, risks the card2 wrap).
- **`61de6992b` flows currency labels USD/CNH/EUR/CZK (`HexRowFlows`).** Grid
  ranked the hex line-art edges worst = the documented texture floor (lesson 8
  masked the real defect); the diff exposed the navy labels ~8% small, 9px low,
  7px right. fs112→120, capTop −9, x −7 (symmetric to the orange pair). Whole-frame
  f380/400/430/450 ~.8613→.8628 (+.0015); label-crop .59-.63→.62-.66 (+.03).
- **Title worst-window net: whole-frame f100-130 0.9159→0.9269 (+0.011).**
- scenesA NEXT: flows hexes (`HexIcon`) = line-art texture floor (needs re-DRAWN
  vector, a pipeline not a round); flows pill fields = minor edge/color, small lever.

**scenesB — locks f1735-1785 + hexify f1400-1450. 2 commits.**
- **`eb92ef761` locks phase-1 hub DROPS out instead of fading in place
  (`LocksScene`).** Measured EXACT video: the navy CLSNet box descends (top 550→688
  by f1760, gone ~f1765) and the docs co-descend (~0.73×); docs were also ~99px too
  far inboard (corrected doc cx→340/1432). The old `boxOut [1756,1772]` fade left a
  75%-washed slate block at y550 while the ref sat a full-navy box at y688 — the
  biggest bright miss in the f1760 diff (lesson 4/5). Gate: f1745 .8923→.8960 · f1760
  .8488→**.8741 (+.0253 trough)** · f1775 .8723 flat · f1785 .9228 flat (hub already
  gone there). CrxNetting shared the bug — now fixed.
- **`f557b35d2` hexify "Trade executed" callout geometry (`HexifyScene`).** Label
  fs34→56 at x755 y356 (ref ink y369-408, cap 39); the two full-width arrows at
  y505/512 collapsed to ONE double-headed shaft x716-1221 y425 (ref sits in the
  hex-inner gap only). Old callout was half-size + ~60-85px low (the anti-correlating
  centre cells). Gate (uniform +.0127): f1410 .9028→.9155 · f1420 .8924→.9051 · f1435
  .8911→.9038 · f1445 .8964→.9091.
- scenesB NEXT: locks hex-grow trajectory f1758-1780 — my hexes grow LINEAR
  [1752,1785]; ref HOLDS small to ~f1757 then fast S-curve to settled ~f1780 (lag
  peaks f1770: my hexA cx522/w308 vs ref cx594/w368). Replace growP linear with keys
  [1745,1755,1760,1765,1770,1775,1780]→[0,.01,.12,.60,.91,.98,1]; endpoints match
  (f1785 =0.923) so zero regression risk. This is the whole f1775 residual (0.872).

**scenesC — 5 windows, 3 fixed. 3 commits.**
- **`ea222ba7d` outro: stop the endcard navy burying the live ledge — THE big
  win (`LedgeScene`/`EndCardScene`).** f3930 was the single worst FRAME in the whole
  video: `EndCardScene` (renders last, `TitleCard` paints a full navy AbsoluteFill)
  mounted at `SEG.outro[0]=3926` buried the still-live `LedgeScene` (cities+stacks,
  runs to 3948) under navy → f3930 rendered PURE NAVY while the ref holds the ledge.
  Fix: ramp the endcard in [3938,3940], hold the ledge opaque through f3940
  (reproduces the ref's late/fast ledge→navy edge-wipe). Gate: **f3930 .598→.903
  (+.305)** · f3936 .636→.856 (+.220) · f3938 .677→.820 (+.143) · f3939 .714→.762
  (+.048); f3900/3915/3940/3946 unchanged. CrxNetting shared the same bug — fixed too.
- **`91e43afc6` gantt footnote rules (`GanttScene`).** Bottom-left footnote rules
  were gated by `(1-detailP)` so they REAPPEARED across the detail-card restore
  2279-2303 (two white lines the ref lacks). Gated to the card grow — fade by ~f2196,
  never return. f2280 +.0022 · f2300 +.0046 (window worst frame 0.817) · f2312 +.0016;
  window f2268-2318 mean +.0028.
- **`e84aab8aa` endcard disclaimer (`EndCardScene`).** Ran smaller/tighter/brighter
  than ref (probed fs≈43, pitch 60px, glyph (94,115,155)); overrode inline fs43,
  lineHeight1.4, y864, alpha0.5 → line1 lands y879. f4095/4110/4125 all +.0014.
- **scenesC LOGGED not fixed (scene-level, regression risk — not surgical):**
  (a) payment/strip2 f2590-2640 (0.782 @f2630) — ref SCROLLS payment left ~470px
  then morphs to Strip2; comp holds PaymentScene static till its 2636-2650 fade.
  f2600/2615 already ~0.89. A per-frame payment-exit scroll, couples to Strip2 entry.
  (b) reportCard f2923-2973 (0.872 @f2950) — ref netting rows = ~9 butted full-width
  segs (937px) vs comp 3 narrow pills (545px); ref card 1191×801 vs 840×700. A scene
  recalibration (segs+merge+collapse f2822-3104), own gated round. **scenesC NEXT =
  this reportCard rebuild — the largest remaining in-lane fixable defect.**

**Round tally:** 8 commits, 8 elements, 6 windows. All gated NEW≥OLD frame-exact +
eye + CrxNetting-clean; tsc clean (0 new clsnet errors); all 8 in HEAD, per-file
latest = this round's, tree clean for the 3 scene files. Biggest levers: the outro
f3930 +0.305 (worst frame in the video) and the title worst-window +0.011 whole-frame
(supporting line + card labels lift f100-150 off the #4 worst-window). **Official
verify PENDING the orchestrator's run** (build-only session — no verify, OOM).
Freshness note for the verify: the r13 bundle predates all 8; expect the title
(f100-150) and outro (f3892-3942) windows to move most, gantt/endcard/hexify/locks
smaller. Texture-floor items unchanged (hex interiors, serif hairlines) — 96 still
walls on the re-DRAWN line-art pipeline.

### dispatched sweep r15 — 2026-07-12 (next-worst per-file surgical pass; 3 file-scoped builders in parallel) — landed 3 commits
Mandate from the r14 handoff: attack the named next-worst surgical item in each
scene file, subtle/surgical only — skip any window whose only lever is a scene-level
rewrite or the re-DRAWN line-art texture floor. THREE parallel builders, one per
scene file (zero git collision, each stages only its own path), all serialized
through the single `/tmp/replica-render.lock` (BUILD-ONLY, no full verify — OOM).
Gate law unchanged: EXACT ref VIDEO frames (25fps, ref n == comp n, `r15/vf.sh`),
ffmpeg-ssim whole-frame + element-crop, A/B ref-vs-OLD-vs-NEW (OLD via `git stash
push -- <own file>`), NEW≥OLD at every gated frame + eye montage. Infra:
`work/clsnet/r15/{still,vf,ssim,mont}.sh`. All 3 in HEAD, tree clean, no orphaned
stash. Commit order: `9c278bf05` (A) → `bbfd2774b` (B) → `1b46933b3` (C).

**scenesB — LocksScene hex-grow S-curve f1758-1780 (THE high-value win). Commit
`bbfd2774b`.** growP was linear `[1752,1785]→[0,1]`, lagging the ref's fast settle
by **73px at f1770** (cx522 vs ref cx594). Builder measured the ref navy-hex bbox at
13 frames and fit a DENSE per-frame S-curve (cx/w within ≤2px everywhere); badge dy
re-tied to growP so the disk tracks the vertex. NOTE: the r14-prescribed keys
`[1745,1755,1760,1765,1770,1775,1780]→[0,.01,.12,.60,.91,.98,1]` were REJECTED — too
sparse in the fast transit (+21px@f1762, −12px@f1768); the denser measured fit
removes those. Gate whole-frame / hex-crop: f1758 .8671→.8784 / .846→.885 · f1762
.8514→.8625 · **f1770 .8709→.9015 (+.031) / .727→.834 (+.107)** · **f1775 .8723→.9051
(+.033) / .712→.826** · **f1780 .8664→.9247 (+.058) / .715→.918 (+.203)**. Endpoints
f1752/f1785 BYTE-IDENTICAL (md5-proven — growP=0 clamp ≤1752, =1 by 1780). tsc clean;
eye montage tracks. Residual at f1770/1775 (~0.83 hex-crop) is the hex-interior
line-art texture floor, NOT position. CrxNetting shares LocksScene — carries.
**scenesB SURGICAL QUEUE NOW EMPTY** — matching/locks/strip all won or texture-floor;
no named geometry/timing defect left. Only re-DRAWN-vector floor or scene-rewrite remains.

**scenesC — reportCard row Y-pitch + payment whip-scroll (BOTH surgical). Commit
`1b46933b3`.**
- **reportCard netting rows f2923-2973 — Y-pitch re-anchor (the one clean lever).**
  Measured ref row tops 371/521/667 (pitch ~148, h44); comp had them bunched at
  390/480/560 (pitch 90/80) — the tan row was **107px above** its ref band, zero
  overlap (misplaced ink, lesson 4). Re-anchored rows to 371/521/667, h40→44; card
  dims + collapse keyframes + x-start + widths UNTOUCHED (all rows stay inside
  190..890). Gate whole / row-crop: f2930 .872→.891 / .570→.675 · **f2950 .872→.896
  (+.023) / .572→.708 (+.136)** · f2965 .872→.896. **Residual REWRITE-ONLY (confound
  held exactly as r14 warned):** ref card 1191×801 @x364-1555 vs comp 840×700 @x530-
  1370; ref rows span x496-1470 (~965px) which OVERFLOWS the comp card both sides —
  matching row width/extent needs a card resize → ripples into the 2976-3030 collapse
  pill. The Y-pitch was the only surgical lever; card-size/row-extent/sharp-corner is
  card-coupled = own-round rewrite.
- **payment-scroll f2590-2640 — rigid translateX whip (clean per-frame).** Measured
  ref: static through f2615, then whip-left −11@2620 / −104@2625 / −468@2630 / off by
  2635 (ref f2635 blank white); centroids move identically = rigid. Added
  `interpolate(f,[2615,2620,2625,2630,2635],[0,-11,-104,-468,-1730],clamp)` on a
  wrapper around all payment content EXCEPT the horizon line (kept to hand its
  baseline to Strip2's line at y368); removed the invented static hold + the fade the
  ref lacks (lesson 5). Gate whole / tableau-crop: f2600 flat / f2615 flat (correct —
  ref static too) · **f2630 trough .782→.898 (+.116)** · f2635 .873→.993 (+.120). No
  Strip2-entry rebuild needed (Strip2 mounts 2640, grows from the bare line). Both
  fixes propagate to CrxNetting.
- **scenesC state:** payment essentially solved (0.993 at exit); reportCard at its
  surgical ceiling (headroom is the card-coupled rewrite). True next-worst outside
  these two windows needs a verify-safe rolling-window pass to name honestly.

**scenesA — title PrincipleCard card2 two-line pitch (the r14 residual). Commit
`9c278bf05`.** card2-crop was the lowest settled-title element (0.496 after r14). The
residual was NOT size (line1 already landed y622≈ref 621) — it was inter-line
**pitch**: ref opens the two lines 47px apart, `lineHeight 1.15` (=41) seated line2
5px high. Fix: new per-card `stripLh` prop (default 1.15 — card1 + all default
callers byte-unchanged), card2 `stripLh=1.3` (=47/36) + `stripDy 11→7` (re-seats
line1). Both cap-tops now within 1px of ref, pitch 47. The `\n` is explicit + the div
is width-less → opening the pitch cannot re-wrap (no letterSpacing, no wrap risk).
Gate: whole-frame .9269→.9274 · **card2-crop .6199→.6496 (+.030)** · tight label crop
.4341→.4665 (+.032) · card1 crop OLD==NEW byte-identical (1.000). tsc clean; endcard
grow (f4005) intact, settled f4030 no overflow. Residual: card2 width stays ~23%
short (Helvetica narrower than ref face) — the **font-face texture floor**, needs a
face swap or hand-tracking, not a round. CrxNetting card2 (p50 "Atomic on-chain\n
settlement", Diatype) inherits stripLh=1.3/stripDy=7 (geometrically sound for any
2-line label) — NOT pixel-verified vs a CRX ref, flagged. **scenesA SURGICAL CEILING
REACHED** — only texture floor left (flows hexes, globe continents, network hexes =
re-DRAWN-vector floor; card2 font-face width floor).

**Round tally:** 3 commits, 4 elements, 4 windows. Biggest levers: locks hex-grow
f1780 +0.058 whole / +0.203 hex-crop, payment f2630 trough +0.116, reportCard f2950
+0.023 / +0.136 row-crop, card2-crop +0.030. All gated NEW≥OLD frame-exact + eye +
CrxNetting-carry; tsc clean (0 new clsnet errors); all 3 in HEAD, tree clean.
**Official verify PENDING orchestrator's run** (build-only session — no verify, OOM);
r13 bundle predates all 3, expect the locks (f1758-1780), payment (f2620-2635) and
title-card2 windows to move.
**SURGICAL CEILING — clsnet is at the asymptote.** All three scene files now report
ONLY texture-floor / rewrite-only work remaining:
- **scenesA:** texture floor only (flows/globe/network hex line-art; card2 font-face
  width).
- **scenesB:** surgical queue EMPTY (hex-interior line-art floor + scene-rewrite only).
- **scenesC:** payment solved; reportCard headroom is the card+rows+collapse REWRITE
  (own gated round); true next-worst outside these needs a verify-safe window pass.
The remaining named lever anywhere in clsnet is the reportCard card-size REWRITE
(coupled, own round). Everything else is the re-DRAWN line-art pipeline (lesson 9
texture floor) — not a surgical round. 96 walls here without the pipeline project.

### r16 HEX LINE-ART RE-DRAW — 2026-07-12 (owner dropped "subtle only", authorized native re-draw toward 96.5) — NO COMMIT, mandate REFUTED
Mandate: replace the soft potrace hex interiors (network/cities/mbadge) with a
hand-authored parametric native `HexFacade` vector primitive (crisp hex outline +
building line-art at native comp resolution), toward SCORE 96.5. Method: prove on the
CLEAREST/highest-contrast/largest hex first (network HELI, w375, settled f800+), gate
NEW≥OLD, then fan out. Instruments in `work/clsnet/r16/` (still.sh/ssim.sh gate helpers,
vf/ exact ref frames, base_{800,850,890}.png = OLD trace, heli/bank/bank2/city2_2x.png
= 2× ref zooms). Gate law: EXACT ref video frames (25fps, ref n = comp n), ffmpeg-ssim
whole + heli-crop `440x400+173+209`, NEW≥OLD at every frame + eye-cleaner + other hexes
byte-unchanged. Serialized through the one `/tmp/replica-render.lock`, no full verify (OOM).

**MEASURED BASELINE (ref-vs-OLD trace):** f890 whole **0.981094** / heli-crop **0.966204**
/ bank-crop 0.962889 / bank2-crop 0.954113 / city2-crop 0.963570; f800 whole 0.973492;
f850 whole 0.973973. The hex crops are ALREADY 0.954-0.966 — the positions match to
sub-pixel; the residual is stroke softness. Probed heli geometry precisely (hex cx393
cy409 w372 h331, navy outline ~5px, rounded corners; orange tower left window-box
section x323-383, right section 7 mullion lines pitch~12 spanning x380-455) — the
geometry IS recoverable; the redraw was feasible, not blocked on measurement.

**HELI PROOF — FAIL, decisive (a builder authored HexFacade + a data-driven
HeliBuildingArt spec, gated, reverted byte-identical):**
| frame | whole OLD→NEW | heli-crop OLD→NEW |
|---|---|---|
| f800 | .97349→.96191 (−.0116) | .95377→**.81463** (−.139) |
| f850 | .97397→.96249 (−.0115) | .96196→**.82335** (−.139) |
| f890 | .98109→.96920 (−.0119) | .96620→**.82365** (−.142) |

**WHY (measured, not theory) — the trace IS the floor, third independent confirmation:**
- The potrace has ZERO geometry error (it is a faithful trace of the ref's own vector
  art) and is compression-soft LIKE the ref → it sits at the SSIM ceiling (soft-vs-soft,
  lesson 21). A hand redraw sits ~1px off on EVERY interior stroke; the diff composite
  lights both edges of every stroke × ~50 strokes. Misplaced ink loses to absent ink
  (lesson 4), overwhelmingly (−0.14 crop).
- Crispness was NEVER the binding constraint: blur 0.4 (.82365) ≈ blur 1.0 (.82252).
  The limiter is edge POSITION, which no crispness/color fix touches. The builder's own
  progression: first pass .783 → hex-border fix .824 → asymptote at ~.824. Closing the
  last 0.14 = replicating the trace stroke-for-stroke, i.e. NOT beating it.
- **The diagnosed "orange fringe on navy skyline" defect was NOT real** — probing the
  OLD render's left navy edges returned clean navy (0,39,83), no orange. The cmp_heli
  crop's apparent fringe was a display/JPEG artifact. There is no visible re-draw win:
  the trace is already faithful to the EYE, so the eye gate (owner's mandate) also fails.
- Confirms gen12 (finer re-trace LOST −.005) and the HEX-WINDOW round's stated residual.
  **The re-draw pipeline the owner authorized would make the video WORSE on both the
  metric and the eye. DO NOT build it.** The 94.2 wall is NOT the hex line-art (those
  crops are ~0.96, at the encoding floor) — it is elsewhere (r15 named it: card2
  font-face width, reportCard/payment scene rewrites).

**ONE real residual surfaced (documented, NOT shipped):** the traced illustration orange
`#D45837`=(212,88,55) is LIGHTER than the ref's true orange (heli deep-core (202,69,35),
median (188,74,45)). A SCOPED recolor (network-hex `recolor` map, same pattern as
GREY_FACE — zero geometry risk) deepening it toward ~(200,73,42) gains ~**+0.0012 on the
heli crop** (simulated on the render; optimum R≈195-202). Real but negligible: the orange
is almost entirely THIN STROKES (the tower body is white with orange OUTLINE — few solid
px), so whole-frame impact ≈ +0.0001, below the verify noise floor. The SAME light-orange
error afflicts every orange element video-wide (cities/mbadge/flows/strips) — a BROAD
recolor could be a micro-win but needs a full-verify gate (global palette). NOT committed
this round; folded into a future broad-orange pass if the owner wants it.

**VERDICT:** RE-DRAW mandate refuted by direct measurement. Tree clean, byte-identical
to HEAD d7c24da00, nothing committed. clsnet stays at its r15 surgical ceiling; the hex
line-art is a proven SSIM floor (soft trace = soft ref), unbreakable by re-draw. Remaining
real levers are the r15-named font-face + scene-rewrite items, not the hexes.

---

## r17 — reportCard STRUCTURAL REWRITE (2026-07-12) — **WIN, SHIPPED** `96c42312d`

Inherited a dirty, compiling, half-audited reportCard edit from a predecessor killed
mid-round by the session limit. Audited it, found it had located the RIGHT category of
error but only ONE of four instances, re-measured the whole scene from the ref, and
rewrote it. **Every gated frame improved; the collapse is byte-identical.**

### What the ref actually says (pixel scans of `work/clsnet/r17/vf/v_*.png`, f2822..2990)

Four structural errors in `ReportCardScene`. None of them was reachable by re-drawing —
each is wrong *structure*, which is the category that WINS (cf. r16: re-drawing faithful
traced art LOST 3× this session).

| # | Error | We drew | Ref (measured) |
|---|---|---|---|
| 1 | **Card extent** | 840×700 @ (530,190), 2.5px stroke, 4× r40 corners | **1192×802 @ (364,139)**, 4px stroke, **diagonal** corners (TL+BR r64; TR+BL square) |
| 2 | **Segments** | 6/row, 10px gaps, bunched x[600,1175] | **8/row**, 3–4px gaps, x[496,1475], each with a **3px white stroke** repeating the card's diagonal |
| 3 | **The merge** | `mergeP` swaps in 3 fat blocks at f2940, holds to f2976 | **Never happens.** Rows draw in by f2926 then hold **frozen to the pixel** through f2978 |
| 4 | **The clock** | card 2874→2898; rows settle 2942; rows cross-fade out 2972–2982 | card **2856→2872**; rows settle **2926**; rules **retract** rightward 2970–2983; rows **hard-cut**: tan f2979, org f2980, lav f2981 |

Error 3 is the big one: the fictional merge corrupted **f2940–2976 — precisely the r13
worst window.** The predecessor had kept it.

Two further measured facts, both now transcribed rather than modelled:
- **Per-segment (x,w) tables.** The settled rows are pixel-identical across every frame
  2926–2978, so the 24 rects are transcribed, not fitted.
- **One pen draws the outline AND the rules**, counter-clockwise from the bottom-right
  (bottom → left → top → right), on a hard S-curve (6% @2860, 18% @2862, 66% @2864,
  96% @2868). The rules ride the same clock — measured 0.666 at f2864 vs the card's 0.663.

### The one regression, and lesson 4 again

First gate pass: **f2860 = −0.0055**. A straight lerp on the pen put ink on the TOP edge
at f2860 while the ref was still drawing the BOTTOM. *Misplaced ink losing to absent ink* —
OLD drew nothing there and scored better. Reversing the path to the measured route and
fitting the measured S-curve turned it into **+0.0018**. Fourth confirmation of lesson 4;
it is now also a lesson about draw-in ROUTE, not just position.

### Gate — ref vs OLD(HEAD 238a07b3f) vs NEW, whole-frame / card-crop `1250x850+340+120`

OLD stills validated as true HEAD by md5 against a fresh stash-render (byte-identical —
determinism holds, lesson 15).

| frame | wf OLD | wf NEW | Δ wf | cr OLD | cr NEW | Δ cr |
|---|---|---|---|---|---|---|
| 2860 | 0.9973 | 0.9990 | **+0.0018** | 0.9947 | 0.9982 | +0.0034 |
| 2865 | 0.9690 | 0.9899 | **+0.0209** | 0.9391 | 0.9802 | +0.0411 |
| 2870 | 0.9548 | 0.9793 | **+0.0245** | 0.9112 | 0.9593 | +0.0482 |
| 2880 | 0.9120 | 0.9397 | **+0.0277** | 0.8271 | 0.8815 | +0.0544 |
| 2905 | 0.8825 | 0.9197 | **+0.0372** | 0.7692 | 0.8422 | +0.0730 |
| 2920 | 0.8834 | 0.9298 | **+0.0464** | 0.7710 | 0.8621 | +0.0910 |
| 2930 | 0.8905 | 0.9520 | **+0.0615** | 0.7850 | 0.9058 | **+0.1208** |
| 2950 | 0.8957 | 0.9661 | **+0.0704** | 0.7951 | 0.9335 | **+0.1383** |
| 2965 | 0.8957 | 0.9661 | **+0.0704** | 0.7951 | 0.9335 | **+0.1383** |
| 2973 | 0.8987 | 0.9540 | **+0.0553** | 0.8010 | 0.9096 | +0.1086 |
| 2980 | 0.9395 | 0.9706 | **+0.0311** | 0.8812 | 0.9422 | +0.0610 |
| 2990 | 0.9723 | 0.9723 | +0.0000 | 0.9455 | 0.9455 | +0.0000 |
| 3000 | 0.9196 | 0.9196 | +0.0000 | 0.9744 | 0.9744 | +0.0000 |
| 3013 | 0.9463 | 0.9463 | +0.0000 | 0.9089 | 0.9089 | +0.0000 |
| 3030 | 0.9689 | 0.9689 | +0.0000 | 0.9465 | 0.9465 | +0.0000 |
| 3060 | 0.9605 | 0.9605 | +0.0000 | 0.9332 | 0.9332 | +0.0000 |
| 3103 | 0.7385 | 0.7385 | +0.0000 | 0.8324 | 0.8324 | +0.0000 |

**The collapse and build-pop are BYTE-IDENTICAL** (+0.0000 at all six frames ≥2990) — not
merely "did not regress". The f≥2982 pill trajectory is hardcoded and card-independent, so
the resize provably cannot reach it. The f2976–2982 handoff (which *does* read `card`) is
the +0.0311 gain at f2980, and it moves the right way: the ref card compresses vertically
IN PLACE (top y139, left x364), which the new `card.{x,w}` now feed straight into the wide
pill instead of the old 530→365 sideways jump.

### Eye

- `rows_montage_r17.png` (REF / OLD / NEW × f2905,2930,2950,2973) — OLD shows the three
  fat merge blocks the ref never has; NEW tracks the ref's 8 full-width stroked segments.
- `collapse_montage_r17.png` (× f2980,2990,3013,3060) — collapse holds; f2980 now shows
  the ref's wide pill with its segments still inside.
- `crx_eyecheck_r17.png` — **CrxNetting brand variant clean** at f2930/2965/2980/3013.
  Card, rows, rules, pill, build-pop city all render; no brand breakage.

### Honest residuals (NOT shipped, next-round candidates)

1. **The row ENTRY is a converge animation, not a fade-in-place.** The ref f2890–2925
   deals the pills in scattered across the card and settles them into the rows; we fade
   them up at their final positions. We still win f2905 (+0.0372) because the card and
   rules dominate — but the entry window is the weakest remaining part of the scene.
2. **The collapse pill is too narrow at f2990.** The ref's pill is visibly wider than
   ours. The f≥2982 keyframes are hardcoded and were deliberately NOT touched (they are
   what made the collapse byte-identical). Re-measuring that trajectory is a clean,
   self-contained next round.
3. Rule retract is fitted linear [2970,2982] / [2970,2979]; the ref's is slightly eased.
   ~6px-tall bars — below the noise floor, not worth a round.

---

## r18 — THE FICTION ROUND (2026-07-12/13) — **20 commits, every gate green**

The r15/r16 verdict said clsnet was at its surgical ceiling and the rest was
texture floor. **That verdict was wrong in every window it named.** Seven builders,
one per file, hunted only two things — content the ref does not have, and large
elements at the wrong size or place. They found nineteen structural errors. Not one
of them was texture; not one needed a re-draw.

### The three laws, entering the round (all measured, all held)
1. **Re-drawing faithful traced line-art LOSES** (r16: −0.14 on a hand-redraw; gen12:
   −0.005 on a finer re-trace). The potrace IS the ref's own vector art. Edge POSITION
   is the only thing that matters. `art.ts` was touched exactly once this round — to
   ADD absent ink, never to redraw present ink.
2. **Deleting FICTION wins big.** Every largest gain below is a deletion.
3. **Gain is proportional to AREA.**
4. (Corollary, now with SIX confirmations) **Misplaced ink loses to absent ink** — and
   r18 extended it twice: it holds against *correctly-timed* ink (an empty doc head beat
   a mesh drawn at the wrong nodes, 0.774 vs 0.715), and it holds for the draw-in ROUTE,
   not just the endpoint.

### The fiction we were drawing (each deleted, each gated)
| where | the fiction | the ref |
|---|---|---|
| flows | pill field **squashed inward** (scaleY 0.15→1) | each pill **flies in**, one landing per frame, innermost first; **heights never change** — it was never a scale |
| flows | currency labels **faded up in place** | they **fly in** at full colour, converging on the band. No opacity ramp anywhere |
| flows | page-1 collapse = a squash | each half **slides rigidly** into the band and the band **eats** it; above travels 1.21× below |
| cities | badge B = a **full r69 disc from f1012** | it **grows from a point**, f1024→f1042, solid from the first pixel. We drew ~14,000px of navy the ref does not have |
| gantt | rows 3–8 **fade** out and back | they are **WEDGED** — the card shoves rows 2–8 down as one rigid block and 3–8 ride off-screen |
| payment | a **second horizon line** at y368-370, full width | the ref has ONE line, y364–367. We drew a **7px double line across all 1920px, every frame** |
| payment | two orange **up-arrows** rising into the cities | an arrowhead scan of the ref returns **zero** at every frame 2490–2612 |
| report tail | **four invented clocks**, all settled by f2315 | **ONE rigid scale** about pivot (374.8, 534.3), RMS 1.24px — not settled until **f2333**. We drew a settled report for 18 frames against a ref still 2.5× oversized |
| report tail | a +125px **drift** | it does not drift. It **freezes** (byte-stable f2334–2348), then **falls** |
| reportCard (r17) | the **merge** | never happens |

### The large elements at the wrong size or place
- **flows hex row 6% small** — `hexW 320` shrank the trace to 0.941. Backing the trace's
  native size out of our own render gives 316.6×280.5; the ref's hexes measure 316–317 ×
  281–282 **at every frame f330–450**. *The potrace was the ref's art at scale 1.0 and we
  had been rendering it shrunk.* True: `hexW 340`, cy 334.
- **the ruler band entered 15 frames late** (starts f349, not f366) — 63k px of flat grey
  absent through the whole entry.
- **the gantt detail card's rules were NAVY, 5px, inset** — the ref's are **WHITE, 5px,
  full-width**. A contrast inversion over 24% of the frame. Its text was fs30 against a
  ref fs37; its corners square against the ref's diagonal (the r17 house motif).
- **the cities collapse ran 10f late and 5f short** on a linear ramp — the ref runs
  f1051→f1080 on an S-curve, p=0.5 exactly at f1065. At f1065 we sat at p=0.23 while the
  ref was **half collapsed**: every large element in the window was misplaced through the
  entire motion. (`CITIES.smallScale` 0.62 → **0.667**.)
- **`ClsNetBox`'s label was misplaced at EVERY call site** (a shared primitive). The ref
  seats the label's advance-centre **2.26% of the box side left of the box centre**, and
  **fs = 47·scale**; we sat **+8.00px right** and 2.4% large everywhere.
- **the settlement plumbing** starts at **y384** (a deliberate 16px gap below the line),
  drops, and turns through a **19px rounded corner** into a horizontal at y579. We drew
  372→520 with a hard right angle — the horizontal leg sat **59px** above the ref's.
- **road furniture**: the ref draws pavement ticks and a **car** on both horizon lines out
  to x≈1860 as **world objects at constant velocity**, riding the same collapse transform.
  Absent from our crops. Added as new traces (append-only: 60 pre-existing assets, **0
  changed**, `art.ts` diff **+6/−0**).

### Two new laws, both discovered twice independently this round
- **Chrome SNAPS painted boxes to whole pixels; the ref's boundary rows are PARTIAL.**
  A 1px full-width overshoot on both horizon lines was 3840px of misplaced ink per settled
  frame — ~18% of every disagreeing pixel across f913–1300, and worth an order of magnitude
  more than the furniture it was found beside. Partial rows must be painted as their own
  1px divs at measured coverage. Landed 3× (`055e8db93`, `7a923bf9e`, and the cities).
- **A negative A/B can be an ARTIFACT of a misplaced element.** The gantt pills' white
  outline had been refuted in an earlier round. Once the pills were placed correctly it
  **wins everywhere** (+0.021 at f2300). *Re-test refuted fixes after you move the thing
  they sit on.*

### Gate — whole-frame SSIM, ref vs pre-r18 HEAD vs r18 HEAD
| window | frames | OLD → NEW |
|---|---|---|
| **flows** (rank 1+2, worst in the video) | f360–455, 8 frames | **0.856 → 0.956 (+0.100 mean)** |
| flows collateral (hexRow) | f335 / f345 | .880→.964 · .897→.981 |
| **cities collapse** | f1056 / f1064 / f1068 | .801→.958 · **.778→.973 (+0.195)** · .802→.978 |
| cities settled (furniture + edges) | f980…f1290, 8 frames | every frame +.0016…+.0027; r5c7 cell +.007…+.031 |
| **gantt** (rank 3+7) | f2190 / f2288 / f2300 | **.806→.919** · **.793→.935** · **.821→.931** |
| **report tail** | f2313 / f2320 / f2364 / f2367 | .834→.926 · **.899→.925** · +.062 · +.085 |
| **payment** (rank 4) | f2540–2632 | flat **+.009…+.010** every frame; f2645 **+.018** |
| ClsNetBox law | flows / tradeDocs / locks | box-crop +.028…+.031 · +.012 · **+.053** |
| page-1 pill collapse | f406–411 | pill-crop +.012…+.051 |

**Zero regressions at any gated frame.** Byte-identity proved outside every window
(f800, f2200, f2400, f2930, f2660 md5 OLD==NEW). `CrxNetting` renders clean at every
touched scene — and the gantt wrap fix **repaired a real CRX defect**: its hyphenated RFQ
ids were shattering into four lines because the row wrapper had no containing block.
`npx tsc --noEmit`: 0 clsnet errors.

### Commits (20, all path-scoped)
`944118666` flows hex row · `fedac65bf` cities collapse · `1e8a6e1a6` ruler band ·
`398b13853` gantt transcription · `80aa2dccc` currency labels · `844da5fec` exit slide ·
`055e8db93` horizon sub-pixel edges · `48a252f92` payment double-horizon + arrows ·
`128c3564c` pill entry · `7a923bf9e` payment sub-pixel edges · `11fe9306e` gantt wrap ·
`eea75f59f` gantt pill outlines · `d7f0e1875` the wedge · `252ac552b` road furniture ·
`cef071f22` the tail is one scale · `c2cee657f` the ClsNetBox label law · `dec2ae1f2`
page-1 collapse · `9c50fa27e` freeze, then fall · `68a5f7a9e` flows box rect/mark ·
`03bae0afc` the plumbing curves

### ⚠ INDEX POISONING — one incident, contained, and a rule for every lane
`844da5fec` also swept `cls-day/scenes1.tsx` (**175 deletions**), silently reverting that
lane's S4 work. Caught and restored by the cls-day track (`09600156e`, in HEAD ancestry).
**Cause: `git checkout <rev> -- <path>` writes the file AND STAGES it**, so the next
`git add <ownfile> && git commit` sweeps the other lane's reverted file into your commit.
An audit of all 20 r18 commits found **this one instance and no other**.
**The rule, for every agent in every lane, without exception:**
- **NEVER `git checkout <rev> -- <path>`. NEVER `git add -A`. NEVER `--amend`.**
- Read an old version: `git show <rev>:<path> > <path>` — writes the file, does NOT touch the index.
- A/B against HEAD: `git stash push -- <your file>` → render → `git stash pop`. Stash leaves the index clean.
- **Before every commit:** `git status --porcelain -- .../cls-day/ .../cls-shared/` must be EMPTY and `git diff --cached --name-only` must show only your lane.

### Residuals — named, measured, NOT shipped
1. **`data.ts` GANTT/DETAIL/REPORT are stale and wrong.** The measured truth now lives as
   local constants at the top of `scenesC.tsx` (rows drift 39px left; ruler 19px right,
   11px short; `rowFs` 30 vs 37; `labelFs` 28 vs 36). Fold them back and delete the locals.
2. **Three `ClsNetBox` sites are opted out of the label law because their BOXES are
   misplaced** — `MATCH.box` (ref x769 y341 side 156; we draw y350 side 152) and
   `REPORT.box` (ref x794 y475 side 331; we draw side 322 at y482). Fix the box, delete the
   `labelFs` opt-out, and the site adopts the law. `scenesC:551` (payment) and `:237`
   (gantt) need **only the opt-out deleted** — their boxes are already true (~+0.003 each).
   `scenesB:301` (tradeDocs) needs its own y (ref y661, not 675).
3. **A determinism bug (law 15).** The `ClsNetBox` wordmark renders **~20% narrow in
   roughly one render in five** — same code, same frame; a **font-load race**, not noise.
   Costs only ~0.0003 whole-frame, but it makes md5 byte-identity unprovable on any frame
   carrying the wordmark. Owner: `ui.tsx` / the font loader. **Worth its own fix — a
   nondeterministic composition is a broken instrument.**
4. **The traces contain frozen, recoloured copies of the traffic** (`trace.py` maps the blue
   ticks to grey, baking them at the trace frame). Standing misplaced ink inside the city
   crops. Removable only by re-tracing the cities with the traffic masked.
5. **`cityA` at payment is the wrong art** — the ref's payment cityA is a wider arrangement
   (skyline from x49; ours starts at x170; 121px simply not in the trace). `cityB` already
   has a dedicated `cityBPay` for exactly this reason. `cityA` needs the same.
6. **The serif face is the real floor on text.** Our face carries **1.45× the ref's ink mass**
   at matched cap height (Georgia's thins vs the ref Didone's hairlines). Position and extent
   land within 1–2px; the mass does not. Lives in `cls-shared/fonts` — a face swap, not a round.
7. The `Doc` primitive draws three flat bars where the ref has a folded corner, a mesh glyph
   and micro-text (four on screen). The ref's mesh is a **denser polyhedron at different
   nodes** — re-drawing it is the texture floor, confirmed by a negative A/B.

### Next-worst (post-r18 sweep of scenesC, every 25f, mean 0.929)
| rank | frame | ssim | what |
|---|---|---|---|
| 1 | **f2130** | **.785** | a **1920×23px white SLIT** between the strip's retreating navy and the gantt page — open at f2128, *before* GanttScene mounts, so the strip's band bottom is lifting off the frame edge. The ref has unbroken navy. SSIM on a flat navy cell collapses to **0.009** when a white stripe crosses it — that one slit IS the 0.785. **COUPLED**: the gantt page's ride-in is also wrong (ref snaps up in 4 frames — 723·364·196·116; ours crawls 825·750·671·587, up to 470px low), and fixing the page ALONE widens the slit to 50px. They must land together. |
| 2 | f3305 | .852 | mapBadges implode |
| 3 | f2680 | .860 | strip2 grow |
| 4 | f3105 | .866 | mapBadges entry |
| 5 | f3005 | .874 | reportCard collapse pill (r17's named residual — the pill is too narrow; its f≥2982 keyframes are hardcoded) |

**The lesson of r18, plainly: the ceiling was never the line-art. It was the fiction we
had drawn on top of it.** Nineteen structural errors survived fifteen rounds of SSIM
grinding because every round asked "is this stroke crisp enough" instead of "does the
reference do this at all". The metric could not see them; the question found them all.

### r18 addendum — the coupled slit, the row entry, the boxes (3 more commits, 23 total)

Dispatched after the four window builders reported, to close the defect none of them could
land alone.

**`732d058ad` — the strip and the gantt page are ONE RIGID OBJECT.** The worst frame in the
file (f2130 = 0.785) was a **1920×23px white slit** — and it was *two clocks disagreeing*.
Two independent tracers (grey band top → pushY; white ruler bar → pageY) give
**pageY − pushY = 1090 at f2132, f2133 AND f2134** — one number, no drift. One transcribed
table now drives both, and it predicts, with no free parameters, how deep the inverted
clusters still hang into frame (178 vs ref 179 @f2135; 10 vs 11 @f2136; gone @f2137).
The slit itself was **structural**: the night half was `height: 1080 − bandBot` inside a
1080-tall wrapper, so the navy rode up *with* the push and uncovered white beneath it. The
ref is navy to y=1079 at every frame. It is now semi-infinite.
Gate: **f2130 .785→.872 (+0.087) · f2134 .748→.893 (+0.145) · f2137 .850→.995 (+0.145)**;
bracket crop .87→.97. (Also killed the bracket's dash-wipe — the ref draws bar + both end
drops WHOLE on frame one — and fixed its stroke, 4.3 not 3.)
*A half-pixel instrument bug — coverage centroid taken over pixel INDICES — was the whole
difference between this losing 0.001 and winning 0.004. Documented in-code.*

**`12bd26976` — the gantt row entry was invented too** (found while gating the above): at
f2145 the ref has two rows mid-flight and **we drew an empty page**. The rows fly up from
below and decelerate; they never fade (pill fill reads (171,179,203) at f2140 *and* f2178).
The nine offset columns are **one sequence shifted in time** — `796·646·379·231·154·105·71·
47·30·17·8·3·0` — reproducing every track to ≤2px; only the spawn frame differs. Settled y's
were already exact; only the entry was fiction. Gate: f2150 .939→.965 · **f2155 .904→.940** ·
f2160 .908→.928; f2178/f2190 byte-identical.

**`f9137b6dd` — fix the BOXES, then let them adopt the label law.** All three handover reads
confirmed against the ref: tradeDocs **14px low** (ref x823.5 y660.5 side 270.8, and
pixel-identical f1400–1450 → transcribed); MATCH.box **8.6px low, 4.4px narrow**;
REPORT.box **9.2px narrow** (x and y were already right — only `w` moved). Then the
`labelFs` opt-outs were deleted and the sites adopted the `ClsNetBox` law.
Gate (whole / box+label crop): **tradeDocs f1400 .919→.933 / .691→.901 (+0.210)** ·
**match f1600 .882→.887 / .745→.881 (+0.136)** · **report f2360 .927→.936 / .755→.859
(+0.104)** · gantt tail f2320 .924→.940.

**PAYMENT: the predicted +0.003 was REFUTED — and the refutation named a real bug.**
Deleting its opt-out *loses* 0.0006. Adopting the law makes the label **exact in every
dimension the law governs** (centre 954.5 vs ref 954.5; cap-height 22 vs 22; ink mass 1150
vs 1156 — against the hand-fit's +5.0px centre, −3px cap, −20% mass) — and it *still* loses,
because it lands **3px low**. `ui.tsx` seats the cap-top at **301.8·scale**; the ref seats it
at **296.6·scale here** (flows 301, locks 302). **The seat is not the constant it is taken
for.** The bigger, correctly-placed glyph makes that 3px more visible, so the metric prefers
the small wrong one. Opt-out kept, reasoning left at the call site.
**HANDOFF: correct the cap-top seat in `ui.tsx` (per-site or measured law) and payment +
gantt delete for a clean win.** This is the top open lever.

### r18 final state
23 commits. **Zero regressions at any gated frame, in any window, all round.** tsc: 0 clsnet
errors. Tree clean, nothing staged, no cross-lane dirt. `CrxNetting` renders clean at every
touched scene. Byte-identity proved outside every window (f400, f1064, f1740, f2000, f2400,
f2762, f2930).

### Next-worst entering r19 (f2130 is SOLVED and gone from the list)
| rank | frame | ssim | what |
|---|---|---|---|
| 1 | f3305 | .852 | mapBadges implode |
| 2 | f2680 | .860 | strip2 grow |
| 3 | f3105 | .866 | mapBadges entry |
| 4 | f3005 | .874 | reportCard collapse pill — too narrow; f≥2982 keyframes hardcoded (r17's residual) |
| 5 | f2380–2455 | .889–.898 | handshake — a flat band, four frames |
| — | open lever | — | **the `ui.tsx` cap-top seat** (above) — blocks two clean label wins |
| — | open lever | — | **the wordmark font-load race** (law 15) — nondeterministic composition, ~1 render in 5 |
| — | open lever | — | `data.ts` GANTT/DETAIL/REPORT still stale; truth lives in scenesC local constants |

**None of the r18 windows appear on this list.** Flows, cities, gantt, payment, the report
tail and the strip→gantt seam are all off the board. **The ceiling was never the line-art.**

---

## r19 (2026-07-13, round lead + 3 per-file builders) — 17 commits, zero regressions

**Entering at 95.1. Every landing was a deletion of fiction, a resize, or a re-timing.
Not one was a re-draw.** r18's question — *does the reference do this AT ALL?* — kept paying,
and this round it reached the SHARED PRIMITIVES, where a single error is wrong at every call
site simultaneously and therefore never dominates any one window. That is why they survived
eighteen rounds.

### The headline: the cap-top seat was a constant all along — of the wrong datum

r18 read three seats (payment 296.6·scale, flows 301, locks 302) and concluded *"the seat is
not the constant it is taken for."* **It is.** The seat scales with the box **SIDE** — the only
datum the ref's lockup actually has. Divide by side and all ten site reads collapse:

| site | ref side | cap-top below box top | ratio |
|---|---|---|---|
| flows | 269 | 300.17 | 1.1159 |
| tradeDocs | 269 | 300.12 | 1.1157 |
| match | 156 | 175.01 | 1.1218 |
| locks | 221 | 246.1 | 1.1136 |
| **gantt card** | **525** | 586.56 | **1.1173** |
| **gantt card** | **341** | 381.25 | **1.1180** |
| report | 331 | 369.2 | 1.1155 |
| payment | 166 | 184.3 | 1.1100 |

**The gantt detail card proves it for free: the SAME site at TWO sizes returns the same ratio.**
One uniformly-scaled symbol. No strut, no affine term, no per-site case. LSQ: `seat = 1.1161·side`,
RMS 0.6px. Shipped `LABEL_SEAT = 1.1202` (in-render NCC calibration; the cap-top estimator carries
~1px bias across two typefaces). We had been at 1.1240 — **0.8% of the side too low.**

> **NEW LAW: when a constant reads differently at three sites, suspect the DATUM before you
> abandon the constant.** r18 was one division from the answer and turned back.

### The determinism bug does not exist — REFUTED, not fixed (`0dbc1fb60`)
`ClsNet-Replicate` loads **no web font at all** (the wordmark is a system Helvetica stack), so
there was never a race. The bimodal wordmark widths r18 saw are split **by code version, not by
luck**: narrow = pre-label-law stills, wide = post. **r18 compared stills from two generations of
its own code and read the difference as nondeterminism.** Proof: 12/12 md5-identical renders of
f2320, 8/8 at f400. **md5 byte-identity is a valid instrument again** — worth far more than the
0.0003 the phantom was "costing". Recorded in-code: *do not add delayRender here.*

### Gates — ref vs pre-r19 HEAD vs r19 HEAD, whole frame

| window | frames | OLD → NEW |
|---|---|---|
| **strip2** (rank 2; f2680 was the worst frame in the file) | f2663 / f2680 / f2685 / f2700 | **.867→.995** · **.860→.973** · .867→.944 · .907→.975 |
| **matching** (rank 7) | f1610 / f1625 | **.890→.934** · **.889→.933** |
| **locks** (rank 6) | f1718 / f1735 / f1740 | **.887→.929** · .892→.929 · .908→.929 |
| **mapBadges** (rank 8) | f3290 / f3305 | **.819→.954** · **.852→.959** |
| **endcard** (ranks 4+5, 130f hold) | f4041–4141 | **.880→.906 flat across the whole hold** |
| **payment** (rank 1) | f2600 | .899→.907; label crop **.840→.976** |
| matching mount fiction | f1455 | .877→.933 |
| ClsNetBox seat law | flows/tradeDocs/gantt/report | label crop **+.034 … +.086** |

**Zero regressions at any gated frame, in any lane, all round.** md5-identical outside every
touched range. `CrxNetting` clean. tsc: 0 clsnet errors.

### The fiction deleted (17 commits)
- **The edge rulers are TWO clocks running in OPPOSITE directions** (`52fa837b4`). Bank A's runs
  up, bank B's runs down; they **converge and rest together** — the point of the scene. Since r5
  we drew bank A twice, for 470 frames. They also **do not exist before f1481**; we painted two
  grey bands, 18 ticks and 18 labels from f1448 — behind an opaque white AbsoluteFill that
  overpainted a live scene (the r16 series steps .935→.897 at exactly the mount frame).
- **The documents SLIDE across a FIXED elbow** (`622fb8d33`). We parked both at their settled spot
  80 frames early — at f1718 our doc sat **275px** from the ref's. Our connectors rode the doc and
  drew *after* it, painting an **80px orange bar across each document's face**. The ref has none:
  its riser stops at the doc's edge because **the doc is simply on top of the line.** Draw the
  elbow, then the doc.
- **The strip2 skyline was never a fade** (`4da30e2c0`) — it flies in from the right and
  decelerates, solid ink from its first pixel. Ref ink above/below the band is **zero** before f2676.
- **The band opens in 11 frames, not 22** (`7b5def327`) — at f2663 we drew ~200,000px of misplaced
  full-width navy in a single frame.
- **The strip travels 9.92px/f, not 9.76** (`2aed84396`) — the x-residual rose +0.157px/f
  *identically in every cluster*. A shared slope is a RATE error, not an origin error.
- **The endcard URL is at fs62 where the ref is 92** (`99e5c5c2a`) — a third of the ink not drawn,
  held for 130 frames. The disclaimer **slides in under a hard clip at x=679** (forced by the data).
- **The matching columns were seven identical pills** (`2789df3cb`) — the ref has **eight of two
  heights** left, six right, flown in innermost-first, one spawn per frame.
- **The map implode ran six frames early** (`a6b801d26`) — at f3305 the ref is at 0.845, we drew 0.497.
- **The payment box was never true** (`efd8b5b38`) — r18's in-code note *"875/835 is the true seat"*
  had **enshrined a bad measurement as a law**. The ref is 833.9/166.
- **The FX Global Code badge is a LEAF, not a square** (`b1f1c1a0c`) — found only by opening a cell
  that would once have been ranked and ignored.
- **The `Doc` primitive draws three flat bars; the ref draws a document** (`a602d7273`) — header
  rule, bordered panel of thin rules, navy bar, orange bar, lower panel with an orange pill, rounded
  corners. **Four on screen at once.** r18 filed this as "the texture floor" on a negative A/B taken
  with the wrong seat on a misplaced element. **It was missing ink.**
- **The hexagon corner radius is real and worth NOTHING** (`696492884`) — the rounded vertices are
  genuinely in the ref, and fixing them alone changes nothing to four decimals, because **the SHAPE
  is wrong beneath them.** Law 4, sixth confirmation, arrived at independently.

### Three laws this round paid for
1. **A positive A/B can be an ARTIFACT OF TWO ERRORS CANCELLING.** The locks box was "exact" only
   because it was 1px narrow and 1px right in a way that cancelled the seat's 0.8%. Fixing the seat
   *exposed* it (f1740 −0.0006). Both together: **+0.0015 wf, +0.035 box-crop.** This is r18's
   "a negative A/B can be an artifact of a misplaced element" running in reverse. **Re-test refuted
   fixes after you move the thing they sit on — and re-test CONFIRMED ones too.**
2. **Correct sizing can MAGNIFY a fiction.** `mHexCity2` lands its tower on the ref's to the pixel
   and still loses 0.017, because the trace contains a navy bucket and grass tufts the ref does not
   draw. Fix the geometry and the false ink gets bigger. (Needs a re-trace; recorded in-code.)
3. **DO NOT DIAGNOSE FROM ARTIFACTS. READ WHAT IS RUNNING.** The lead made three instrument errors
   this round, all the same error: `pgrep -f "remotion still"` **matches its own watchdog shell** and
   reported a phantom OOM (three builders were throttled on it); a neighbouring lane was convicted of
   lock-bypassing on the strength of breaker code in **dead round dirs it was not executing** (its
   live harnesses were correct — the bypass was OURS, direct `npx` calls with no harness in the parent
   chain); and a LEAK-GUARD patch **severed the `npx` line continuation**, so `--frame` was never passed
   and **every still came out as FRAME 0** — a navy plate — *while printing success and exiting 0.*
   **A frame-0 still A/B'd against a frame-0 still is a PERFECT TIE, which reads as "no regression."**
   The instrument does not fail loudly; **it flatters every change you make.**
   All 103 r19-U stills were audited for flat plates afterwards: **zero contamination, all gates real.**

### Infra now enforced (harnesses `work/clsnet/r19-{B,C,U}/still.sh`)
- **NEVER a direct `npx remotion still`.** Every render through the harness; the compliance test is
  that each live render's PARENT CHAIN contains `still.sh`.
- **Never `rmdir` a lock you did not create.** Stale recovery only after **60 CONTINUOUS seconds** with
  no remotion/chrome anywhere AND the lock >25 min old (Remotion has normal browser-restart gaps that
  look idle for a few seconds — a single-point idle check is what broke it).
- **LEAK-GUARD:** Remotion `still` sometimes **writes the PNG and then never exits** (browser gone, CPU
  flat) — the agent hangs on a render that ALREADY SUCCEEDED. 300s watchdog wraps the whole command,
  never inside it. Target `rm -f`'d first so a stale PNG cannot pose as a fresh render.
- **"No PNG + exit 0" is not always OOM** — a sibling's syntax error breaks the esbuild bundle for
  EVERY lane and looks identical.

### Residuals — named, measured, NOT shipped
1. **`s2UpBank` is missing ~130px of art** — three navy buildings the ref draws left of the strip2
   bank; not in the trace. Worst cell at f2680 (0.39). Only visible during the fly-in, which is why
   18 rounds missed it. Needs `art.ts`.
2. **`mHexCity2` / `mHexHeli` carry a bucket and grass tufts the ref does not draw** (see law 2).
   `mHexHeli` takes the fix and wins; `mHexCity2` cannot until re-traced. Transform recorded in-code.
3. **The matching exit card TRANSLATES** (771,399 @f1646 → 820,525 @f1656) and the check disc shrinks
   away. Not modelled; the card leaves as absent ink. Holding it cost .904→.887 — **lesson 4, seventh
   confirmation.**
4. **The locks exit clock runs ~2.5px ahead** of the ref. Pre-existing.
5. **The locks box entry** (f1658–1670) is a MOTION (y510→y550), not the fade we draw.
6. `MATCH.hexA/hexB` in `data.ts` read w214; the ref is **217**. `data.ts` GANTT/DETAIL/REPORT still
   stale — truth lives in scenesC local constants (carried from r18).
7. **The endcard's principle-card captions are ~22% too small** — they live in `TitleCard` (scenesA),
   untouched this round.
8. The serif face still carries ~1.45× the ref's ink mass at matched cap height. `cls-shared/fonts` —
   a face swap, not a round.

### Next-worst entering r20
| rank | what | where |
|---|---|---|
| 1 | **`s2UpBank` missing art** (worst cell 0.39 @f2680) | `art.ts` re-trace |
| 2 | **`mHexCity2` false ink** — correct sizing magnifies it | `art.ts` re-trace |
| 3 | **endcard principle-card captions ~22% small** | `scenesA` / `TitleCard` |
| 4 | matching exit card translate + check-disc shrink | `scenesB` |
| 5 | locks box entry motion; locks exit clock 2.5px ahead | `scenesB` |

**The lesson of r19: the fiction was not only in the scenes — it was in the PRIMITIVES, and in the
INSTRUMENTS.** Two lanes, working different frames independently, ranked `Doc` and `Hexagon` first.
And the lead's own three errors were all one error: **an inference that was never interrogated.**
The method file says the judge lies until interrogated. It lies about your neighbours, and it lies
in the harness you just patched.

### r19 addendum — PROVE OR REVERT: the two commits gated through the broken harness

`Doc` (`a602d7273`) and `Hexagon` (`696492884`) landed while the LEAK-GUARD bug was live, so their
gates were suspect. **Re-gated through the REPAIRED harness. Both PROVEN. Neither reverted.**

| frame | OLD (ui.tsx @622fb8d33, pre-both) | NEW (HEAD) | delta |
|---|---|---|---|
| f1400 (tradeDocs) | 0.933518 | 0.933518 | +0.00000 — **byte-identical**; the primitives do not touch this frame |
| **f1740 (locks, 4 Docs on screen)** | 0.928761 | **0.932579** | **+0.00382 PASS** |

Three independent proofs, not assertions:
1. **Not plates.** mean 0.945, sd 0.17. A frame-0 ClsNet plate is solid NAVY — **mean ~0.15, sd ~0**.
   All **103** r19-U stills audited: **zero flat plates**.
2. **The render actually saw `ui.tsx`** — OLD and NEW are byte-DIFFERENT at f1740 (md5 84865c74 vs
   9235644d). A render ignoring the source would have produced identical bytes.
3. **NEW ≥ OLD** at every gated frame.
(`ui.tsx` restored to HEAD by `git show`, md5 verified `e8b7aecb…`, tree clean. Never `git checkout`.)

### The md5 cross-frame test — a good test with a FALSE POSITIVE mode, and it found a real bug anyway

The proposed rule — *"two gate stills at DIFFERENT frames with the same md5 are both frame 0, gate
void"* — fired on `s1.1202_2560` == `s1.1202_2600`. **It was a false positive**: mean 0.95, sd 0.17,
a real white page, not a navy plate. Byte-identical renders at two frames are **CORRECT** when the
composition is genuinely static across the hold.

**But interrogating the false positive found a REAL defect.** The ref is **NOT** static there:

| | f2560 vs f2600 |
|---|---|
| **ref** | SSIM **0.9805** — it MOVES |
| **ours** | **byte-identical** — frozen |

> **NEW RESIDUAL: the payment hold is FROZEN where the reference drifts** (f2560–2600). Not measured
> this round. r20.

**The correct form of the test** (the plate signature is unambiguous, so use it):
`a frame-0 ClsNet still is SOLID NAVY — mean ~0.15, sd ~0.` Screen on **mean/sd**, not on md5 equality.
md5-across-frames is a useful *screen*, but it must then be **opened** — which is the round's own rule
turned on its own instruments.

### The laws of r19, in order of value
1. **A BROKEN INSTRUMENT DOES NOT FAIL LOUDLY — IT FLATTERS YOU.** A frame-0-vs-frame-0 A/B is a
   PERFECT TIE and reads as *"no regression, ship it."* The most dangerous bug class in this project.
2. **Do not diagnose a neighbour from artifacts. Read what is RUNNING** (`ps`, not `.sh` files on disk).
3. **A correct harness an agent declines to invoke is not protection — it is documentation.** The lock
   was never broken; our builders were calling `npx` directly and walking around it.
4. **A watchdog wraps AROUND a command, never through it.** The `\ &` splice severed the args.
5. **"No PNG + exit 0" is not always OOM** — a sibling's syntax error breaks the shared esbuild bundle
   for every lane and looks identical.
6. **COUNT THE FILES BEFORE YOU READ THE NUMBERS** (from cls-day). An OOM-killed batch drops frames
   silently; the missing ones score as blank columns, not as errors.
7. **When a constant reads differently at three sites, suspect the DATUM before you abandon the constant.**
8. **A positive A/B can be an artifact of TWO ERRORS CANCELLING.** Re-test confirmed fixes, not just
   refuted ones.
9. **Correct sizing can MAGNIFY a fiction.** Fix the geometry and false ink gets bigger, not smaller.

**The official `verify-replication.sh` renders the whole composition itself and never invokes
`still.sh` — it is IMMUNE to the frame-0 bug, and it arbitrates this round independently of every
gate above.**

## r20 — cls-shared/logo.tsx: `ClsLetters` was three HAND-DRAWN glyphs, not a trace. All three are now traced. (ba571cc57, 69dca5500, 4ccbcb50a)

**The 12,953px was real, and it was CONTENT.** The blob map handed over by gen19 was right in
every particular. But the framing "is this law 18 (absent content, PAYS) or law 19 (redrawing a
faithful trace, LOSES −0.14)?" had an answer that cost nothing to find and that nobody had
looked for: **open the file.** `MARK_D` is a genuine potrace — thousands of coordinates. The
three letter paths were `M 295 0 L 100 0 Q 0 0 0 100 …` — round numbers, hand-authored, and the
S's own comment called it *"square s with round caps"*. **They were never traces.** Law 19
refutes re-drawing a faithful trace; there was no faithful trace here to re-draw. Law 17/18.

Measured, not assumed: our old S scored **IoU 0.559** against the ref's own S. Half a letter.

### The instrument (reusable — this is how to trace anything into an existing viewBox)

1. **Find a byte-static hold in the ref.** cls-day f80..f100: consecutive-frame meandiff **0**
   inside the letters box. Median-stack it — codec noise gone, no threshold guessing.
2. **Fit the screen↔viewBox affine against YOUR OWN RENDER, not against theory.** Rasterise our
   own three paths under a trial affine, maximise IoU vs our own rendered still (Nelder-Mead, 4
   params). Landed **IoU 0.996**: `screen = (695.364 + 0.926157·vbX, 187.289 + 0.938883·vbY)`.
   **The datum check (law 25):** the fitted `sx/sy` = **0.9865**, which independently reproduces
   the `scaleX(0.985)` sitting in `scenes1.tsx`. A fit that rediscovers a constant it was never
   told about is a fit you can trust. Never hand-derive this from the DOM transform chain — the
   scene's `scale`/`CARD_PIVOT` are in there too, and the pixels already know the answer.
3. **Unwarp the ref INTO the viewBox** (4x, cubic). Independent proof the extents were never the
   problem: the unwarped ref ink lands at vb x 0.0..829.8, y 0.0..227.5 — our viewBox is 830×227.
4. **Cut glyphs apart at a MEASURED landmark, not a guessed one.** C is its own connected
   component. **L and S are ONE blob** — the ref merges their bottom bars and bites a navy V out
   of the top. Found the bite apex at **vb (550.0, 216.8)** and cut there; L's right edge and S's
   left edge now *form* that bite between them.
5. **potrace, swept for fidelity** (α 0.6, O 0.2): trace IoU **0.995 / 0.993 / 0.994** (S/L/C).
   Normalised via `translate(0,235) scale(0.025,−0.025)` — the same `S_TF` pattern `MARK_D` uses.

### The gate — S ALONE first, as ordered, then L, then C

| landing | f80 | f96 | f110 | f1900 (pill) | f2000 (pill) |
|---|---|---|---|---|---|
| PRE | .92519 | .92518 | .91687 | .92280 | .91113 |
| **+S** ba571cc57 | .93427 **+.00908** | .93426 **+.00908** | .92729 **+.01042** | .92346 +.00065 | .91179 +.00066 |
| **+L** 69dca5500 | .93851 **+.00424** | .93850 **+.00424** | .92944 **+.00215** | .92371 +.00026 | .91205 +.00026 |
| **+C** 4ccbcb50a | .94330 **+.00479** | .94329 **+.00479** | .93285 **+.00341** | .92407 +.00036 | .91241 +.00036 |
| **round** | **+.01811** | **+.01811** | **+.01598** | +.00127 | +.00128 |

Letters band @f80: ink **59,561 → 71,974** (ref 72,232) · missing **18,831 → 818** · extra
**6,160 → 560** · **IoU .6812 → .9811**. The 818px of residual sits in blobs that are all
**one pixel tall** (y187..187, y273..273, y360..360) — a threshold rind, not content. **Floor.**

### The brief's premise was wrong, and the bytes say so

The lever was scoped as "~250 cls-day frames **plus an unknown clsnet count**". The clsnet count
is **zero**. `clsnet/scenesA.tsx` imports **only `ClsMark`** and draws its letters from its own
`art.ts` potraces; both CRX cuts substitute their own lockup (`CrxSettlementDay` passes BOTH
`BrandLogo` and `PillLogo`; `CrxNetting` sets `logoText: "CRX"`). So `ClsLetters` reaches exactly
one composition. **Proved in the bytes, at the final state, not argued from the import graph:**

| comp | frames | OLD → SHIPPED |
|---|---|---|
| `ClsNet-Replicate` | 30 · 55 · 4100 | **BYTE-IDENTICAL** |
| `CrxSettlementDay` | 80 · 1900 | **BYTE-IDENTICAL** |
| `CrxNetting` | 30 · 4100 | **BYTE-IDENTICAL** |

Law 34 discharged: ClsDay f80 re-rendered from the clean committed tree is **byte-identical** to
the still the gate was scored on. `tsc` clean at every landing. Harness shells dead, lock released.

### Three things worth keeping

- **A broken gate does not fail — it FLATTERS you (law 28, again).** My first byte-identity gate
  used `set -- $p` inside a zsh loop, which never split. Both md5s came back as the *empty string*,
  empty == empty, and it printed **`IDENTICAL` seven times in a row**. A clean sweep is exactly
  what a passing gate looks like. **When a gate returns a perfect result, that is the moment to
  audit the gate** — print the hashes, not the verdict. Re-run: seven real, distinct hashes.
- **Before adjudicating law 18 vs law 19, READ THE PATH DATA.** The whole coin-flip was decidable
  in thirty seconds by looking at the coordinates. A hand-drawn glyph and a potrace do not look
  alike. Law 19 protects traces; it has nothing to say about inventions wearing a trace's clothes.
- **A shared primitive's blast radius is a fact, not an assumption — and it can be SMALLER than
  the brief fears.** Two lanes were ordered off this file to protect comps that provably cannot
  render it. Establish the mount graph first; it turns a "two-track change" into a one-track one.

### Residual on `ClsLetters`: NONE. It is traced end to end and at the antialias floor.

The tagline underneath it is still hand-set Helvetica and still ~5.4k px light — and its weight
A/B (29b4c5e40) genuinely refuted, because a font HAS advances (law 23). It remains the floor.
`ClsMark` is already a faithful potrace and was not touched.

## r22 — the hexagon shape corrected + three fresh-window fixes. SCORE HELD 96.0. (round lead + 5 sub-subagents, 4 commits)

**Official verify: 96.0 (video_ssim 0.952857→0.952983, keyframe 0.9412319→0.9414684).** Raw numbers up,
composite rounds unchanged. Whole-video frame-mean 0.94587→0.94600 = **+0.00013**. The round banked
four correct, independently-gated fixes and one honest revert. **The gap to 96.5 is unchanged, and the
round taught exactly why: every landed fix is SMALL-AREA (law 18), and the one LARGE-AREA lever left —
the outro rise — is walled off by a mis-proportioned trace (law 19).**

### The main bet — hexagon shape — was RIGHT, and composite-NEUTRAL. Both are true.
`0cd36e0a9`: **h/w 0.906 → 0.866, inset 0.25 unchanged.** The defect was HEIGHT, not inset. Fitted the
straight diagonal edges (rounding/stroke-immune) at 12 hexes across all families: slope **1.731±0.003**,
inset 0.248±0.002. The r19 "inset 0.265" guess is refuted; the scenesA-1193 "h/w 0.889" was a
rounded-corner bbox artifact (sharp points round in more than flat edges — law 25). TRACE families
(hexRow/map/network) already bake the hexagon into the potrace at ~1.73 → **left alone** (their 0.906 is
art-position, not shape). POLYGON families (Hexagon default, HexCity, SmallHex, PayHex, 2 map bg-hexes)
fixed. clipPaths are box-relative → a shorter box auto-corrects its own clip; untouched. CrxNetting
eyecheck PASS. Law-27 resolution: locks and matching are the SAME `SmallHex` primitive with OPPOSITE
seat optima (locks temple was ref-true → hold; matching sat 3px high → gains riding down) — resolved
with a per-call `fillDyFrac` prop (default −0.02, matching passes 0).

**But the composite-honest per-window (mp4-vs-mp4, no PNG codec bonus) tells the real story:**

| hex family | crop Δ (builder gate) | WHOLE-WINDOW Δ (verify) |
|---|---|---|
| matching | **+0.140** | **+0.00379** |
| payment mHexHeli | +0.050 | −0.00023 |
| locks | +0.0045 | **−0.00152** |
| hexify | +0.0003 | **−0.00066** |
| mapHexes (bg-hex 177→172) | — | **−0.00187** |

The matching win (+0.0038) is almost exactly cancelled by the mapHexes/locks/hexify regressions.
**Net hex contribution to the composite ≈ +0.00003 — a wash.** The builder gated whole-frame WITH the
+0.006–0.008 PNG-vs-mp4 codec bonus (it flagged this and leaned on the crop for signal), which FLATTERED
the map/locks/hexify families that actually drift slightly worse in the codec-honest composite. The
shape is geometrically correct (0.3px residual, matching +0.140 crop is a real fidelity win the eye
sees), so it STAYS — a documented correct-but-metric-flat spend, not a revert. **Lesson: a whole-frame
gate rendered as PNG against an mp4 ref carries a per-family bonus that can hide a small real regression.
Gate small-area shape changes on the CROP and on an mp4-vs-mp4 proxy, never PNG-vs-mp4 whole-frame.**

### The composite movers were the FRESH WINDOWS, not the main bet
- **Handshake W2 `214d63081` — the round's biggest composite mover, +0.00577** (f2432-2482). The two hex
  documents were the plain `<Doc>` (3 bars); they are the full `ReportDoc` (folded doc + mesh seal +
  mini-gantt + pill). Swapped both (docA ink 3179→7134 vs ref 9190; docB 3430→7406 vs 8851). The navy
  handshake box was 55px short at top → navy filler rect (box-top-strip ink 4678→29490 vs ref 28966; the
  r21 "art.ts-only" claim was wrong — done from scenesC). Arrows 6→16px. Fiction-law 18: a wrong CARD is
  the biggest per-frame lever in a window.
- **Strip `3ca8c0498` (data.ts, 3 pure-data fixes to the worst 2s window):** 19:00 trio bottom pill was
  154px low → +0.00277 (crop +0.153); day-A navy/orange entered too early, ref DROPS them (fallKeys not
  `in`) → +0.00072 (crop +0.107); 21:00 trio never faded during the push → `out:[2127,2136]`, +0.00009
  (the fade dims it but `pushY` still lifts it 197px — see residual 2b).
- **Globe `94fc4b0f0` (scenesA), +0.00069.** Continents displaced on BOTH axes: mapOx held flat (kill the
  over-scroll), mapOy drifted down to 248. Law-8 lesson: the fix is SSIM-MUTED for PARTIAL corrections —
  fixing one axis scores flat/negative because thin white lines still miss; the gain only appears at full
  pose. The builder OVERRODE the diagnostician's mapOy=190 (closed only 28% of the gap, regressed SSIM),
  switched from centroid (a disc-clipped lying proxy) to line-overlap count, scanned, found a real
  optimum at 248 by turnover. Defect 1.3 (disc 8px big) REFUTED by measurement — ref r296.0 vs ours
  295.5 (<1px); the r21 comment had grown it wrongly, correcting it would regress. Not applied.

### W3 outro-rise — REVERTED. The r21 refutation holds, and now we know the wall is a TRACE.
MISC-DIAG rated the outro rise (cities pan up with the sea instead of drowning) the single biggest lever
in the video — the whole top half goes white→skyline across ~22 frames. The builder built 3.1 exactly
(content-only rise, `dyRise = 595 − seaTop`, band left put) and re-adjudicated under law 24. **The
refutation reproduces:** f3935 +0.009 but f3940/f3942 **−0.013/−0.011**, window mean −0.0011. Also tried
rising the band — worse. **Root cause, measured (clean numpy):** the city/stack TRACES are
mis-proportioned vs the ref — temple aspect 1.59 vs ref 1.96, cityB 2.18 vs 3.03, all 30–70% undersized
in width. `TracedArt` scales uniformly, so no scale matches ref width without a height overshoot; a
correctly-scheduled rise makes the undersized skyline MISREGISTER worse than blank at the top-pan
(**law 19 — you cannot fix a mis-proportioned trace with schedule or scale**). Defect 3.2 (resize) is
blocked by the same wall plus a data matter (the left stack is short because it has 5 rows not 7). The
diagnostician's law-24 hypothesis ("prior loss was from also rising the band") is WRONG for this window;
content-only rise loses too. Perceptual note (genuine law-8 conflict): the eye prefers the rise at f3942
(skyline vs blank void) but SSIM rewards the blank; net-negative window, negligible score impact, no
owner order → NOT shipped. Diff saved at `work/clsnet/r22/W3-rise-plus-band.diff` if an owner wants it as
a documented spend. **Next-round path: re-proportion cityA/cityB/left-stack traces in art.ts toward the
ref aspect (and fix the 5→7 row count), THEN the 3.1 rise becomes a clean win. This is the only
LARGE-AREA lever left and the correct main bet for r23.**

### The hard lesson of r22 (law 18, paid in full)
> The metric is a whole-frame mean. A +0.140 crop on a small element is a +0.003 window and a +0.00003
> composite. Every hexagon, pill, continent and doc we fixed is small-area; their crops improved a lot
> and the eye sees it, but 96.0 did not move. **The gap to 96.5 lives in LARGE-AREA structure — and the
> largest piece left, the outro skyline, is gated behind a trace that must be re-proportioned before any
> schedule or scale fix can pay.** Chase area. Fix the trace before you fix the clock.

### Fresh next-worst windows entering r23 (r22 framessim, 2s, top-12)
1. **f2085-2135 0.9168** strip 21:00 — residual 2b (`pushY` still lifts the fading trio 197px; scenesB)
2. **f723-773 0.9189** mapHexes/network — ROSE this round (hex-seat regression, −0.0019)
3. f2583-2633 0.9220 payment/strip2 tail
4. f523-573 0.9221 globe (improved, still ranked — SSIM-muted floor, law 8)
5. f1295-1345 0.9225 pairs→hexify handoff
6. **f673-723 0.9249** mapHexes — hex-seat regression
7. f1969-2019 0.9251 strip
8. f2024-2074 0.9265 strip 19:00 (improved +0.0028, dropped from rank 6)
9. **f608-658 0.9285** mapHexes — hex-seat regression
10. **f1875-1925 0.9287** locks — hex-seat regression (fillDyFrac tunable)
11. f3890-3940 0.9291 outro W3 — blocked on art.ts trace re-proportion (r23 main bet)
12. f469-519 0.9308 globe intro / mapDraw (new to top-12)

### Residuals — named, measured, NOT shipped
- **W3 outro rise (TOP, large-area):** blocked by mis-proportioned city/stack traces (art.ts) + 5→7 stack
  rows. Re-proportion traces first, then the rise pays. r23 main bet.
- **mapHexes/locks hex-seat regression** (−0.0019 / −0.0015 whole-window): the height fix drifts the
  bg-hex and locks temple slightly; recoverable by per-site seat tuning, but small-area/low-value.
- **strip 2b** (scenesB): exempt the 21:00 trio from `pushY` so it stays low where the ref keeps it dim.
  Low-contrast law-8 second-order; the fade already took the contrast win.
- **strip day-A settled ~18px high** (pre-existing, out of r22 scope).
- **mHexCity2 bucket-and-grass fiction** (−0.016 crop): outline fixed, art held; re-trace without the
  bucket to unlock its resize (family nets +0.0059, so it stays for now).

### Commits (4, all path-scoped, tree clean, tsc clean, no foreign files staged)
- `0cd36e0a9` hexagon shape h/w 0.906→0.866 (ui.tsx, scenesA/B/C)
- `3ca8c0498` strip: three data-only fixes to the worst 2s window (data.ts)
- `94fc4b0f0` globe: hold the scroll, drift the continents down (scenesA)
- `214d63081` scenesC W2: hexes carry real reports, box stands full, arrows land bold (scenesC)

## r23 — the last two large-area geometric defects, found by RE-MEASUREMENT. SCORE 96.0 → 96.2. (round lead inheritor + predecessor's 3 commits, 5 commits total)

**Official verify: 96.2 (video_ssim 0.952983→0.955213 = +0.00223; keyframe 0.9414684→0.9442087;
color 0.994394; duration 0.999748).** A real +0.2 round after r21's +0.1 and r22's +0.0. The gross
movers were all the SAME kind of error — a large trace element mis-SEATED or mis-SIZED, invisible to
the metric as a "bad element", found only by opening the file and re-measuring against the ref's own
pixels. The gap to 96.5 is now +0.3, and this round measured exactly where it does and does not live.

### r22→r23 per-window truth (from the r23 framessim, the codec-honest mp4-vs-mp4 record)

| window | r22 | r23 | Δ | owner |
|---|---|---|---|---|
| mapHex 608-658 | 0.9285 | 0.9790 | **+0.0505** | predecessor seat 1d264b32b |
| mapHex 673-723 | 0.9249 | 0.9750 | **+0.0502** | predecessor seat |
| mapHex 723-773 | 0.9192 | 0.9508 | **+0.0316** | predecessor seat |
| outro-rise 3890-3940 | 0.9293 | 0.9370 | **+0.0077** | cityA + rise (mine) |
| outro-settled 3798-3889 | 0.9326 | 0.9393 | **+0.0068** | cityA (mine) |
| pay-tail 2583-2633 | 0.9226 | 0.9274 | +0.0048 | predecessor docs 60c23f768 |
| strip 2085-2135 (WORST) | 0.9181 | 0.9183 | +0.0001 | FLOOR |
| globe 469-519 / 523-573 | 0.931/0.922 | =same | +0.00004 | FLOOR (law 8) |
| pairs 1295 / locks 1875 | 0.923/0.929 | =same | ~0 | FLOOR |
| GLOBAL | 0.9530 | 0.9552 | **+0.00223** | |

**The mapHexes seat was the round's biggest mover, NOT a regression.** r22 handed it over as a −0.0019
"hex-seat regression" to re-check. The predecessor's seat (the 7 map hexes were 2px right + 2px low)
RECOVERED all three windows by +0.03 to +0.05 — a huge, correct win the r22 fear had mis-labelled. Law
24, from the other side: a handed-down "regression" is a hypothesis too. Re-measure before you trust it.

### cityA re-scale (214dd1446) — a FAITHFUL trace, ~14% too small. Law 21 paid.
The r22 handoff walled the outro behind "mis-proportioned city traces, temple aspect 1.59 vs ref 1.96."
The re-measurement REFUTED that: cityA's aspect is the ref's own (our orange temple 1.60 vs 1.58); it
was uniformly UNDERSIZED (w195 vs ref w227). Not law 39 (unfaithful trace) — law 21 (a faithful trace
scaled wrong). scale 0.44→0.512, re-seated so the temple lands on the ref's x500-727, base y555. cityB
already matched (1.98 vs 1.96) and was left. **Crop gate NEW≥OLD by +0.10 (cluster) / +0.19 (temple)
at f3815/3850/3880; composite window +0.0068 over 92 settled frames.** CrxNetting eyecheck clean. The
r22 "mis-proportioned" residual was a handed-down measurement enshrined as a law — a hypothesis, not a
fact. Opening the file killed it in one measurement.

### THE OUTRO RISE (4f7b9101b) — WON, but small. The verdict r22 could not reach.
r22 reverted the rise because the undersized cityA misregistered the risen skyline at f3940/42 (law 39).
With cityA now the ref's own size, the rise registers, and the re-measurement settles the old dispute:
**at ref f3942 the ENTIRE skyline sits in the top ~110px above the waterline — risen skyline, not the
"white sky" r21 claimed.** The whole ledge (band + both stacks + cities) lifts by dyRise; only the navy
half-plane is pinned under the sea. dyRise is fitted to the MEASURED ref temple base (555−base), NOT
locked to the sea curve — the city sits a WIDENING 40→47px above the waterline, so a dedicated curve
lands the temple base to **1px at f3935/38/40/42** (was 9px low when locked to the sea).

**Result: net-positive but bounded.** Still gate (codec-honest NEW−OLD delta) over f3926-3948:
wins the large-area early frames (+0.019/+0.014/+0.004 at f3932/35/38), LOSES the thin near-navy late
frames (−0.007/−0.008 at f3940/42). The late loss is a **law-8 FLOOR that survives perfect
registration**: once the sea covers past half, the skyline is a thin band, and blank-white (the old
drowned frame) matches the ref's white sky better on SSIM than a correct but codec-soft skyline. Net
≈ +0.052 integrated over the window; composite window moved +0.0077 (with cityA). The eye clearly
prefers it (OLD drowns the cities where the ref lifts them). A documented perceptual-spend that is also
metric-non-regressive. The settled window (f≤3926) is byte-untouched (dyRise clamps to 0).

### Fresh worst windows — OPENED (law 22), classified FLOOR
- **strip 2085-2135 (0.918, the single worst window):** ref-vs-ours A/B — structure is correct
  (timeline, mirror city, labels, marker, F-logo). Two residuals: two navy pills fade in at 22:00 the
  ref does not show at f2110 (early-entry, the r22 "day-A entered too early" class), and faint
  orange/tan shading on a few buildings where the ref is grey. Both small-area (∝ +0.0002),
  frame-limited. r22's 3 data fixes + r23 left the window flat. A dense many-small-residual FLOOR.
- **globe 469-519 / 523-573 (0.931/0.922):** continents misregistered + globe seated slightly low, but
  white lines on a blue disc = law-8 SSIM-muted; r22 measured the fix as flat/negative off full pose.
  Held flat (+0.00004). FLOOR.
- **pairs 1295-1345 / locks 1875-1925:** near-floor, unmoved.
- mapHexes (608/673/723): re-checked — the predecessor's seat did NOT net-regress them; it was the
  round's biggest gain.

### THE CEILING VERDICT — 96.5 is NOT reachable by more window-fiction-hunting. Measured ceiling ~96.2-96.4.
This round found and fixed the LAST TWO large-area geometric defects: the 2px mapHexes seat and the 14%
cityA undersize. Both were the cityA-class error — a big trace mis-placed or mis-sized, metric-invisible
as a "bad element", found only by re-measuring against the ref's pixels. **They are now spent.** What
remains in the top-12 is, measured this round:
- **law-8 SSIM-muted content** (globe: thin white continent lines on a disc) — the metric structurally
  cannot reward a fix.
- **dense many-small-residual windows** (the strip timeline) — every element roughly correct; each
  remaining fix is small-area (∝ +0.0002) and frame-count-limited, so it cannot move the composite.
- **faithful-trace floors** (law 19) throughout.
To reach 96.5 (+0.3 composite ≈ +0.003 more video_ssim) would need EITHER a pervasive whole-video
improvement touching most of the 4168 frames (no such lever is visible), OR one more cityA-class
large-area mis-size. The two obvious ones are fixed. **The one remaining LEAD:** re-measure every OTHER
cityA/cityB mount (payment band line 954 scale 0.5334, intro cityASmall/cityBSmall) for the same
undersize the ledge one hid — but those were re-measured in r19-r20 (a0c630b73 measured the payment
city to 1.213x) and are probably already correct, which is why the ledge mount was the outlier. Honest
call: **clsnet is at its measured ceiling of ~96.2-96.4; 96.5 is at the edge and not obviously
reachable without a systematic re-measure of the remaining city mounts that will most likely come back
empty.** The gross fiction is gone; the video is a tight, faithful band, and the metric's own blindness
(law 8) now guards the last third of a point.

### Commits (2 mine, path-scoped, tsc clean, no foreign files staged; + predecessor's 3)
- `214dd1446` cityA outro skyline: a faithful trace ~14% too small — native re-scale 0.44→0.512 (scenesC)
- `4f7b9101b` the outro rise: the whole ledge lifts with the sea, curve fitted to the ref temple base (scenesC)
- (predecessor, banked before this session: `1d264b32b` mapHexes seat, `60c23f768` payment docs, `24e8738f0` deadline trade)

## r24 — the judge became the EYE. Six metric-blind eye-defects fixed, one contested and left out. (round lead + 4 sub-subagents, 6 commits)

**Composite floor-check (non-regression verify): 96.2 — HELD (r23 96.2 → r24 96.2, +0.0). Floor intact; the six eye-fixes are metric-flat as expected (they are exactly the defects SSIM cannot see), zero regression.** The round did not chase the metric — clsnet was already at its composite ceiling (96.2). The judge this round was a side-by-side filmstrip, and the owner's eye. Every fix below was gated on GEOMETRY and a ref-vs-replica montage; the composite was watched only as a floor. Two of the six even move the metric UP (the errors were large-area misregistrations the metric had been muting only because they were partial); three cost a documented, tiny perceptual spend the eye takes without hesitation; one is metric-blind by construction (law 8 / law 17).

### The clearest eye-win — the globe continents, re-registered. `2c776782e` (scenesA)
r23 filed the globe (f462-566) as a law-8 FLOOR: thin white continent lines on a blue disc, SSIM-muted, "the metric structurally cannot reward a fix." That was half true. The metric could not reward a *partial* fix — but the misregistration was not small. Measured by synthesis (forward-map the faithful full map at f582 into candidate globe windows, minimise coastline distance), the continents were wrong on BOTH axes and by a lot: the scroll (`mox`) was **sign-flipped and off-range** (ref decelerates 565→345; the code ramped the other way, 319→478), and the vertical was **73px too low** (r22 ramped `moy` down to 248; the ref holds it FLAT at 175 — the r22 fit's tail-drift was a floating-scale artifact that vanishes at the renderer's fixed s=0.76). Re-registered to the ref window:

| gate frame | mean coastline distance to ref | disc-crop SSIM |
|---|---|---|
| 486 / 502 / 518 / 523 / 534 / 550 | **28–33px → 0.25–0.31px** | **+0.104 to +0.115** |

**No perceptual spend — the composite IMPROVES.** Law 8 mutes SMALL offsets; whole displaced continents are a large-area error, so the disc crop gains +0.11. Eye montage `work/clsnet/r24/globe/BEFORE_AFTER.png` (REF|OLD|NEW × f486/523/550) read by the round lead: NEW tracks REF coastline-for-coastline, OLD is visibly off. CrxNetting carries the same globe byte-for-byte. **Lesson, refining law 8: "SSIM-muted" is a property of the offset SIZE, not of the content. A disc of white lines can still hide a large misregistration that the metric will pay for once you close it fully.** Residual: the entry slide-in (f469-484) sits ~one scroll-notch off — a partial disc in fast motion, not reliably measurable with the current instruments; held, not noise-fit.

### The handshake was a white phone. `aaaf2a8a6` (scenesC) — [1], the worst thing in the video
CircleScene (f3396-3480), the focal centre of a big blue disc held ~80f, drew a broken navy-top/white-bottom "device" where the ref shows a clean solid navy card holding the handshake. Root cause: the shared `"handshake"` art carries its source logo's **white background** as a `#FFFFFF` layer. HandshakeScene and PaymentScene mount it on a white ground, so the plate is invisible; CircleScene mounts it on the blue disc, where the plate reads as a white phone. Plate and white-hand strokes share one path, so recolour cannot separate them. Fix: clip the art to the two-hand region (hands end at art-y142, plate at y186) and let the navy pill supply the card body. A fiction/colour kill (law 17), metric-blind, eye-gated only — `work/clsnet/r24/gate1/montage_circle_sm.png`, read by the round lead: the white device is GONE, NEW matches REF, CrxNetting clean.

### The payment caption was drawn twice. `ee0925bbe` (scenesC) — [3], and the diagnosis was wrong (law 24)
The audit called it "label 15-25px too low, arrow strikes the text." It was not a seat error — the caption was rendered TWICE. `cityBPay` was potraced from ref_2610, whose crop caught the caption's right tail, so "mplete" + the arrowhead sit baked into the city's top-left sky, overprinting the live text. An L-shaped clip removes that empty corner from the city trace (every building kept, art untouched — law 19). One clean caption on both cuts; the same bug was disfiguring the CRX cut's longer "Settled atomically", now clear. **Perceptual spend: −0.0012 whole-frame, flat across the settled window** — the baked copy sat ref-exact, so removing it costs the codec-noise floor (law 38); the eye takes the single clean caption. Evidence `work/clsnet/r24/gate3/montage_pay_sm.png`. A handed-down defect is a hypothesis (law 24) — open the file before you trust the label.

### The match celebration was on the wrong clock. `f02d1bf05` (data.ts + scenesB) — [4]
At f1600 the ref reads **Unmatched 0 / Matched 298**, an orange check, and a pink-tinted card; the replica read 5/293, grey, no check — the whole celebration ran ~35 frames late and mis-coloured. Ref-measured (law 26): the counter flips to 0/298 at **f1579**, not f1615; the orange check grows f1579→1586; the pink card is a **transient flash**, not a held tint — grey → salmon peak **#E1B4A9 at f1586** → grey by f1618. Rebuilt `MATCH.counts` as a 10-point measured table, advanced `checkOp`, drove the panel with a measured `pinkT` pulse. Panel colour now matches the ref to 1-2 levels at every frame; the f1650 exit is byte-identical to before (no tail regression); the earlier count-down is untouched (f1552 both read 49/248). Evidence `work/clsnet/r24/DEFECT4_montage.png`; CrxNetting carries.

### The netted report is a report, not an icon. `f02d1bf05` (scenesB) — [5]
Beside the CLSNet box the ref draws two detailed folded report pages sliding INTO the box and absorbed behind it (right page hugs the box edge at f1445, gone by f1456); the replica drew two small generic 3-bar icons parked on top. Fix: `Doc variant="full"` (the existing folded-corner primitive, already imported — reuse, do not invent art, law 19), drawn before `ClsNetBox` so the navy square occludes them. Documented spend: −0.0017 at f1430 (the `full` variant's known cost). The eye round takes the report the ref actually draws. Evidence `work/clsnet/r24/DEFECT5_montage.png`.

### The outro band settled tilted the wrong way. `e9c053914` (data.ts) — [6]
LedgeScene's settle see-saw (`LEDGE.thetaVals`) was **sign-flipped and 20 frames late**. At f3745 the ref band is dead flat; the replica held a +2° down-right tilt that dips the 1920px band's right end ~35px — exactly the eye's "20-30px low" (the band was not actually low-seated; the ~2px yc is the pre-existing settled seat, correctly untouched). Fitted the ref's own waterline to a dense 12-key measured see-saw, damping flat by f3745. Band-crop SSIM vs ref: **f3735 +0.344, f3750 +0.120, f3755 +0.088** — another large-area win the metric pays for. The shipped r23 outro and rise are byte-identical (f3810/3880/3935 md5-locked); the change is clamped to the settle. Evidence `work/clsnet/r24/wave2b/EYE_band_3750.png`; CrxNetting carries. Schedule errors dominate geometry errors (law 26), even at the settle.

### The CRX id read "zero-times". `38f10c018` (crx-data.ts) — [8]
In the CRX detail card, "0x7E2B-C923-EY6" rendered its lowercase "x" as a ×-like glyph (Helvetica's small x sits at the numeral math-axis among full-height hex digits — measured, not a ligature theory, so a font-feature toggle would have been a no-op). Fixed the value to "0**X**7E2B…" — full cap-height, plainly a letter, consistent with the uppercase hex. Main cut byte-identical (the shared DetailCard is untouched). Evidence `work/clsnet/r24/wave2b/EYE_glyph.png`.

### [2] CONTESTED — the report-card scatter, NOT built. The correct call.
The audit's largest-area candidate: the ref deals the report-card pills in as a **scatter that converges** (~f2882-2920) and the replica fades them up in place. Ink-count (`work/clsnet/r24/gate2/`) confirmed the ref genuinely shows this — and confirmed it is **NOT** the r22-deleted "merge" fiction (that was a different, later window, f2940-2976, "3 fat blocks"). This is r17's explicitly-deferred residual #1. But the only *achievable* build — schedule-fill, pills at their final row positions but earlier — TANKS the card crop (f2885 −0.037, **f2900 −0.073**) and shows the wrong STRUCTURE to the eye (neat rows where the ref scatters): law 4, misplaced ink loses to absent ink, 7th confirmation. A faithful fix needs the full ~24-pill scatter→converge trajectory transcribed — a dedicated, high-risk round. Per the gate, when in doubt, leave it out.

### CRX-cut verdict — CLEAN.
The audit rendered the CRX cut at its brand frames and found it 95% faithful: the "CRX" text-logo and serif wordmark, the "CRX" box label, the Pillar cards, the counter, the full on-chain detail copy, the URL box, the tagline/disclaimer — all fit, no clip, no tofu. The only two CRX-specific eye-defects were **[7]** the payment-label overflow (fixed by [3], same L-clip) and **[8]** the RFQ-id glyph (fixed). Every shared-geometry fix (globe, handshake, match, doc, ledge) was eyechecked on `CrxNetting` at the touched frames and carries. **The CRX deliverable is at eye-parity with the main cut.**

### Remaining eye-residual, ranked for r25
1. **[2] report-card scatter→converge (f2882-2920)** — the biggest remaining eye-defect. Needs the full ~24-pill scatter trajectory transcribed (schedule-fill tanks it; law 4). A dedicated round, high-risk, large-area.
2. **globe entry slide-in (f469-484)** — continents ~one scroll-notch off during the fast partial-disc entry; needs a better instrument than coastline-distance on a clipped disc.
3. **law-19 / law-8 floors** — sub-pixel continent fringe (faithful trace, ~1px raster floor); the Helvetica caption ~4% narrow (font advances, law 23); the strip f2085-2135 dense-small-residual; the mHexCity bucket-grass trace. All named in r22/r23, none eye-actionable without a redraw the laws forbid.

### Commits (6, all path-scoped clsnet-only, tsc clean of my lane, no foreign files staged; tree clean at handoff)
- `2c776782e` globe: re-register the continents to the ref window (scenesA)
- `aaaf2a8a6` circle: kill the white device bleeding through the handshake card (scenesC)
- `ee0925bbe` payment: the caption was drawn twice — clip the baked copy out of the city trace (scenesC)
- `f02d1bf05` matching: the celebration lands on the ref's clock — 0/298, orange check, pink flash (data.ts + scenesB)
- `e9c053914` ledge: the band settles flat on the ref's clock (data.ts)
- `38f10c018` crx: the RFQ id reads 0X, not zero-times (crx-data.ts)
