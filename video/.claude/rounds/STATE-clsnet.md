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

## r5 official verify — logged by orchestrator (2026-07-10 01:22)

- **SCORE 92.7** (video_ssim 0.9131 ·40% / keyframe 0.8964 ·35% / color 0.9896 ·15% / duration 0.9997 ·10%). Trajectory 87.7 → 90.7 → 91.1 → 91.6 → **92.7**. Freshness confirmed vs r4.
- The gen-4 agent died on a session limit (reset 5am Toronto) AFTER committing four r5/r6 passes: b1240dfc6 (cities measured pass — intro hold to f1062, moving badges, native-scale re-traces, five-pair carousel), 22e2fbca7 (payment pass), 3f148ae4e (flows page-flip rebuild — two static CC-scanned pill fields, not continuous growth), 23b0ec462 (detail card opens 2188–2202 + all-teal map badges).
- **DIRTY FILE AT DEATH:** `scenesB.tsx`, 46 lines (+26/−20), uncommitted. The agent's last words: "Flat scores — verifying the bands actually render." It was mid-investigation of whether some band change actually renders. Inheritor: audit this hunk hunk-by-hunk per doctrine (tsc → A/B stills vs HEAD in the affected windows → keep/finish/revert). Do not assume the worry was confirmed — the official r5 verify is healthy and moved on every component.
- Verify artifacts: `clsnet-{verify,keyframes,framessim}-r5.*`; render + logs at `work/clsnet/r5/` (attempt renders + `mb/` bench dir).
- Next: re-rank from `clsnet-framessim-r5.txt`; r4's list was rows-build f250–300, mosaic f3540–3590, cities-entry (attacked in r5 — likely moved), flows (attacked), payment (attacked). Expect a new leaderboard.
