# IRSwap track state

## Mission
IRSwap-Replicate (full R3F/3D rebuild of the hand-drawn IR-swap explainer, 5433f @ 25fps, 854×480) must score ≥ 95 on `./scripts/verify-replication.sh public/irswap-original.mp4 IRSwap-Replicate`. Prior whole-video SSIM ≈ 0.87 (commit fe8aa1931 era). Owner wants the metric closed keyframe by keyframe. Standing owner rule: real 3D over metric — do NOT flatten the 3D to game SSIM.

## Known structure
One continuous camera world (lib/camera.ts), regions: chartRoom [0,1745), buildings [1705,3588), chart2 [3572,4160), advDis [4131,4263), slot [4263,4690), community [4690,5290), outro [5276,5433]. Ground layer always mounted. Overlays 2D on top. Grain + edge feather post.

## Method
1. Sample-frame sweep FIRST (ffmpeg SSIM, see PROTOCOL.md §7); build per-timestamp table; identify worst windows.
2. Fix worst windows in priority order — measure the reference frame, don't guess.
3. Re-sweep; when sampled mean supports ≥ 0.95, run full verify (WITH render lock).

## OWNER FEEDBACK (2026-07-04 evening) — PRIORITY
Max: the LAST SCENE WITH MANY HOUSES (community region f4690–5290) "looks the worst — need a big focus on that." This is both the metric's worst valley (f4812–5228, 7 of the 12 worst rolling windows) AND the owner's perceptual worst. Give it the deepest treatment: per-element measured rebuild of the house cluster (each house's position/scale/ink per frame), the dive, the rays, the eye-phase collage. Sub-subagent teams explicitly authorized by owner.

## OWNER FEEDBACK (2026-07-04, mid-round-3) — PRIORITY
Max, watching the replica: "there is still transition in IRS about ground level, while the whole video is kinda 1 scene." The reference reads as ONE continuous scene — the ground must never visibly hand off. Suspects in IRSwapComposition.tsx: the BG Vignette crossfades (BG table at 1705/3572/4131/4690, BG_FADE 15), FloorMap→FloorSet fade 3572–3588, FloorSet→FloorPaper fade 4133–4155, SheetFloor dissolve 5262–5285, and any floor-piece fade-in schedules. Audit EACH boundary side-by-side against the reference (pull ref frames ±20f around each; does the ref actually fade the ground there, or does the artwork persist/scroll continuously?). Kill or rebuild any ground-level fade the reference does not have. The bar is perceptual: a viewer must not sense a scene change.

## OWNER FEEDBACK (2026-07-05 ~12:00) — THREE TARGETED STRIKES
1. **3:16–3:30 (f4900–5250, community eye-hold/dissolve): "get a much better score there."** Still the worst valley after r5/r6 ink work. Dedicated deep pass.
2. **1:41 (~f2525, buildings scene): "sometimes the house moves, while only camera should move."** The per-frame camera deltas + per-building world corrections (r2 joint refit, r4/r6 registration) likely animate world poses — visible as houses drifting. HARD RULE: building world transforms must be TIME-CONSTANT within the scene (piecewise-constant at worst, changes only during whip/occlusion moments); ALL apparent motion comes from the camera. Refit under that constraint. ALSO: "make the model of all 3D houses better" — improve the three house models themselves (lender/company/bank): geometry, roof/wall/column detail, outline ink treatment, to read like the reference's drawn buildings.
3. **2:22 (~f3550, buildings→chart2 transition): the reference exits by the HOUSE SCENE SPINNING FAST ON ITSELF while disappearing.** Ours doesn't. Measure the ref frames f3520–3590 (rotation direction, angular velocity curve, scale/fade envelope) and rebuild the transition as that fast self-rotation. Handoff into chart2 must stay clean.

## Round log

### Round 1 (2026-07-04, builder) — RECONSTRUCTED after scratchpad wipe; original sweep table lost, summary preserved
**Sweep** (109 samples every 2s, ffmpeg SSIM): overall mean **0.8282 → 0.8322** after fixes. Per region (pre-fix): chartRoom 0.8521, buildings 0.8084, chart2 0.8013, advDis 0.9202, slot 0.9085, community **0.7557** (worst), outro 0.9160.

**Root cause found — chartRoom chapter B**: the reference camera ORBITS its wall. Measured gridline spacing narrows RIGHT at f455-750 (left near) and narrows LEFT by f860 — a recession flip a translation-only camera cannot produce. Old 2-param (cx,cz) solve: ~11px RMS. New per-frame Gauss-Newton (cx,cz,yaw) over the same B_GRID tracks: **~0.25px RMS** (yaw −0.857rad@455 → 0 @f860 anchor → +0.135@900). Yaw plumbed as optional rotY through WorldPose/CameraRig; 0 outside [452,935) → T_BLD and all handoffs byte-identical. Also fixed B_GREY_X1 tracker dropout (grey line actually extends ~2px/frame f720-810, no 100-frame hold).
Chapter-B SSIM deltas: f500 .847→**.910**, f550 .838→.900, f600 .831→.890, f650 .829→.884, f700 .826→.882, f750 .822→.873, f800 .835→.876, f900 .842→.884 (window mean +0.048). Boundaries 450/950 unchanged.

**Buildings measured ink fixes** (subagent adversarial diff): arrow fills were ~48 levels too light (ref bodies SOLID red 244,95,110 / teal 76,179,203, light only in trailing 20% — old stops had measured the tail); title/value ink #757777→#5B5B5B, #666B6B→#5E6363 (ref cores 87-95); dVbr title inks 3175-3215 not 3195-3240; red-arrow ghost floor 0.45 (not 0.3), full by 3210.

**Commits**: d05fbbd49 (chapter-B yaw + grey line), c7a87a9a3 (buildings ink/timing).

**Weakest remaining (round 2 priorities, all measured in round 1)**:
1. **buildings camera drift off the f2500 anchor** (34% of video at ~0.78-0.81) — CAM_KEYS_3D rows 1850-2150 (camZ ~25% far: buildings 25% short, ground contact 40px high at f1900) and 2850-3450 (differential: LENDER 30px low, COMPANY 10px high at 2950 → yaw/height refit needed, NOT uniform offset). Floor-map ink rides the same drift (yellow road crop SSIM 0.33, streets 0.43).
2. **community 0.7557** — untouched, deepest holes f4850-5000 (~0.68-0.73).
3. **chart2 f3750-4100** (0.70-0.79) — untouched.
4. **chartRoom chapter C recession** f1400-1650 (0.78-0.83): same yaw disease as B (f1400 ref spacing narrows right 41→35, replica widens 34→48; f1100 matches). Need per-frame gridline tracks (C_GRID_X is a single line) — scan ref frames 950-1650/25f with a grey-only pixel scanner, then reuse the B Gauss-Newton. Yaw MUST be 0 by ≤1690 to protect T_BLD.
5. **chapter-B labels non-rigid** (labels crop 0.70 at f750): ref keeps "Fixed rate"/"Base rate" screen-large while wall-locked replica shrinks them (ref x119-203 vs att x54-126 at f750). B_BASE_LABEL screen track EXISTS (460-685, gap 685-865 needs fill); fixed-rate needs measuring. Move both to the DOM overlay for all of chapter B (wall draw currently owns them until f903, ChartRoom.tsx ChapterBWall).
6. advDis/slot/outro ~0.91-0.92 — leave for last.

**Verify NOT run** (sampled mean 0.8322 < 0.93 gate). Verify-script keyframe bug found in round 1 is FIXED in commit a2e9aa7de (ffmpeg SSIM).

### Round 2 — IN PROGRESS (resumed after session-limit interruption ~02:45→12:00)
(appended by agents)

**Round 2 complete (builder, ~12:00-16:30 EDT).** Sampled mean (37-frame thinned global sweep, every 150f, table: irswap-sweep-r2.txt): **0.8293 → 0.8382** (r1 column re-based on the same 37 frames incl. r1's chapter-B fixes). Verify NOT run (< 0.93 gate).

**1. Chapter-C camera orbit solve** (commit a3260f6bd). The C gridline recession FLIPS (left-near f950 → right-near f1400) — same orbit disease as B. Scanned all 11 gridlines every 25f (950-1655; grey-only column scanner, frame-edge feather clusters at x≈22/830 rejected) into C_GRID + C_TOPV (top of line #5, walk-up scanner). Extracted the B Gauss-Newton as solveGridCam (byte-identical for B) and solved (cx,cz,yaw) at 0.14-0.28px RMS; cy from C_TOPV through the yawed camera. Yaw +0.12 → −0.61 @1400 → +0.17 @1655, tapering into the frozen pre-refit exit pose (full-precision C_EXIT_POSE) by 1690 — camChartRoom(1705), T_BLD, all downstream handoffs byte-identical (sweep frames 0-900 and 3600-4650 match r1 to 6 decimals). Window: f1050 .878→.927, f1200 .872→.906, f1350 .852→.880, f1500 .790→.841, f1650 .792→.859.

**2. Buildings joint refit** (commit 39d0cc986). KEY FINDING: r1's "camZ 25% too far / contact 40px high" was a scanner artifact (connected-component picker grabbed the lender GABLE fragment — the facade is mostly white columns). Real drift ≈ 10px... EXCEPT the hand-drawn ref is NOT rigidly multi-view consistent: at the right swing (3150-3450) LENDER sits ~95px off while COMPANY/BANK agree — camera-only fits trade one building against the others. Joint alternating solve (58 sample frames 1760-3450, silhouette scanner with vmax<300 arrow rejection + nearest-predicted assignment, bias-corrected targets): per-building world refits (lender 10u nearer +2.6%, company 18u deeper −4.8%, bank 3u deeper +2.3% — anchor-invariant depth/scale trades) + smoothed per-frame camera deltas on CAM_KEYS_3D rows 1755-3525 (peak dcz −90 @2150-2210; dcx +109/dg −0.32 through the swing). Keys ≤1740, ≥3540, and the 2490/2505 anchor rows byte-identical. Window: f1950 .808→.816, f2100 .806→.818, f2700 .795→.808, f2850 .779→.796, f3000 .774→.788.

**3. Community measured fixes** (commit a14e93568; diagnosis by subagent → community-diag-r2.md). House over.ky 0.746→0.55 + H→178.8 (apex was 33-40px high all overhead; now ±2px), thick measured outline; diveT delayed 4902/80→4914/68 (icons ran 15-40px ahead mid-dive); temple/bank rebuilt — rect walls + wide overhanging pediment + architrave + charcoal 4.5 outline + flat red fill (bank crop @5100 .570→.605); rays refit (measured fan apex, per-tip eye widths, wider canvas); cbs +33u right; house fill #6AB9CB (rendered core within 8 levels of ref). Window: f4700 .894→.900, f4750 .814→.824, f4800 .767→.777, f4850 .726→.732, f4925 .664→.685. Eye hold ~flat (5100 .738→.735): the collage's eye-phase dashboard/cluster layout resists similarity-based relocation — **A/B measured: misplaced ink loses to absent ink** (static .7352 vs relocated .7329 @5100), so the inkRelocate/fitSim machinery ships OFF with the A/B documented in-code.

**Round-3 priorities (measured):**
1. **chart2 camera orbit f3600-4160** (0.70-0.77, untouched, ~550f): CONFIRMED this round — ref gridline gaps flip recession (f3800: 46.5→71.5 rising rightward; f4000: 59→54 falling). Same recipe as B/C: grey-only column scan every 25f (band y20-190, above the fixed-rate line; reject edge clusters x≈48/810; the teal dashed line and hatching fail the grey mask), solveGridCam, byte-identical H.B/H.C handoffs. Expect +0.03-0.06.
2. **community eye-hold 4980-5208** (0.735): needs true per-element correspondences for the dashboard ink (single similarity provably insufficient — wave and cards demand different transforms), cluster icon poses/design (crop 0.51), ray shapes at eye, wall/cube brightness.
3. **buildings residuals** (0.79-0.82): floor-map ink detail (r1 crops: yellow road 0.33, streets 0.43), label/arrow anchors under the corrected camera, the under-sampled 2160-2295 swing.
4. **chapter-B labels → DOM overlay** (labels crop 0.70 @750; B_BASE_LABEL track exists 460-685, gap 685-865 needs measuring; fixed-rate track unmeasured).
5. advDis/slot/outro 0.90-0.92 — last.

Working tooling preserved in .claude/rounds/work/: fitbld.py (silhouette scanner + projection port of camera.ts), fitjoint.py (joint solve), applyjoint.py (key patcher), scanc.py (gridline scanner), solvec.py (C solve). Machine note: keep the remotion bundle (`npx remotion bundle` → build/, ~5.5G — DELETE after use, disk runs ~95%) and render stills against it (18s vs 50s each).

### Round 3 (2026-07-04, builder killed by session limit mid-round; ROUND 3b builder inherited, audited, committed, finished)

**1. Chart2 camera orbit refit f3600-4160** (inherited uncommitted, audited, committed 712a20e5c). The reference orbits the chart2 wall like B/C (gridline-gap recession flips; fixed-line screen slope changes sign). Per-frame (cx,cy,cz,yaw) table C2R at 0.3-6px RMS (old translation fit: 5-35px), plus a bar-layer refit — no constant depth K fits the hand-drawn 2.5D bar field, so K(f) + lateral slide Ls(f) (C2BAR), zero-seam at the f3700 anchor preserved. Blend weights 0 at both mount edges: f3600 0.882065, f3450 0.794297, f4200 0.915751 all byte-identical to r2 (6 decimals). Window deltas: f3750 .773→**.813**, f4050 .701→**.735**, f3900 .707→.687 (see whip note). Predecessor tooling preserved: work/scanc2.py, solvec2*.py, c2*.json.

**2. Chapter-B labels → DOM overlay** (inherited uncommitted, audited, committed ccc192adf). Full-chapter B_BASE_LABEL re-scan (old 460-530 rows were polluted by the curve stub; 690-860 gap measured), new B_FIXED_LABEL track, measured cap heights (B_CAP_*) blended into the C sizing across the 903-940 glide. LabelsOverlay owns both labels from f455; the wall no longer draws them. f500 .914, f600 .890→.897, f750 .873→.881, f900 .884→.885; f450 byte-identical.

**3. Whip motion blur RETIRED** (7b16dfafe). Measured ref frames 3885-3925 every 3-6f: ALL SHARP — the hand-drawn reference has no motion blur through the whip. The 180°-shutter gaussian was theory; under the orbit camera its deltas exploded into a 2s full-frame smear. SSIM at f3900 reads LOWER sharp (.654 vs .687 blurred) because the blur was hiding misplaced floor/curve ink — kept sharp anyway (the smear is a visible defect the ref doesn't have). The real f3900-3950 defect is the FloorSet placement under the orbit camera (floor-layer K/Ls-style refit = round-4 item).

**4. OWNER FEEDBACK — ground-level transitions (top priority). Root cause found and fixed at the two real offenders.**
Audited every boundary ±20f against the reference (36 ref frames + 20 replica stills, work/r3/gnd/). THE reference's ground grammar: ONE sheet-spread collage persists visibly at the frame bottom from ~1660 to the END of the video; new scene grounds (buildings map, community sheet) are laid FARTHER while the old spread stays in the near foreground; only ACTORS fade. The replica instead crossfaded five separate ground artworks, and at two places the ground went EMPTY:
- **THE visible offender: slot region 4350-4690** (~350f, 14 s). The world-locked FloorPaper sheet sank below frame by f4500 (camSlot is anchored to the reel's teal digit block; the hand-drawn ref floor is NOT rigidly consistent with the reel), so the whole slot scene floated in white void, then an entire new ground faded in at 4690-4708 = the scene cut Max sensed. FIX (6210e4b10): scanned the teal plot-band centroid every 30f (tight color mask; screen-quasi-static u 355-371, v 424-457) and pinned the sheet to the track via a per-frame world slide through camSlot (rendered anchor within 2px of scan at 4500/4650). Also killed the invented land/settle scale at 4133-4155 (ref sheet never scales). f4200 byte-identical 0.915751; slide zero until 4330; frozen delta after 4690 so the community crossfade sees ground on both sides. Sweep cost: 4350 .912→.904, 4500 .903→.890, 4650 .909→.894 — foreshortening shape mismatch (the ref bottom band is drawn FLATTER than a rigid floor plane can project); accepted per the owner's perceptual bar.
- **Second offender: chartroom→buildings 1660-1805** (c601fc19d). Ref keeps the chapter-C floor sheets prominent through the topple + map ink-in + early buildings era (1670-1745, sliding out by ~1805); the replica spread sat below frame from 1660 and floorFadeC killed it 1712-1740 → map faded in over a void. FIX: CFloor rides a calibrated world offset A_BRIDGE=[27.6,39.2,-224.5] (solved analytically: floorPlacement basis + drawSpread page fractions, Gauss-Newton on three measured f1720 band features, ~15px RMS — same flat-band non-rigidity), blended 1655-1675, alive to 1810, floorFade→[1770,1805]. f1500/1650 byte-identical; f1800 +0.001; f1690/1720/1740 ≈ −0.008 each (full-ink band vs the ref's washed band).
- Boundaries B (3572, FloorMap↔FloorSet) and C (4133-4155) audited: artwork pairs measured off the same ref spread and well aligned on screen — crossfades read continuous; left alone (C's settle removed, above). E (5262-5292) is masked by the reference's own luma hump; both sides keep art; left alone.
- Solve methodology note: the first A-bridge attempt pinned SCANNED blob centroids that were actually the plane's far EDGE — 2 wasted bundles. The analytic solve (module eval via esbuild → floorPlacement numbers → feature world coords from drawSpread fractions) converged immediately. evalA tooling pattern: esbuild --bundle the TS module to cjs and node it (scratchpad/evalA.ts).

**Sampled re-sweep + official verify: appended below when the run completes.**
**FIRST OFFICIAL VERIFY (r3): SCORE 90.6** (irswap-verify-r3.json / irswap-keyframes-r3.txt; no analysis.json existed → basic mode = keyframes every 2s, 106 scored — treat as the canonical irswap keyframe grid). Components: video_ssim 0.8882 (w40→35.5), keyframe_ssim 0.8610 (w35→30.1), color 0.9945 (14.9), duration 0.9998 (10.0). Verify log: work/r3/verify-r3.log; the verify render snapshot survives at work/r3/attempt-r3.mp4 (both ground fixes visible in motion).

**Calibration sweep-vs-official**: official 2s keyframes ≈ the PNG sweep within ~0.005 on static frames (f4050: .733 vs .735; f3850: .708 vs .711) — the sweep is a faithful proxy; mp4 encoding costs ~nothing.

**Re-sweep (same 37 frames, irswap-sweep-r3.txt): mean 0.838234 → 0.838238** (flat by design: chart2 +.040/+.033 and labels +.007×3 offset by the deliberate perceptual spends: f3900 −.053 blur removal, slot −.008/−.013/−.015 ground slide). Deltas: 600 +.0073, 750 +.0072, 900 +.0011, 1800 +.0010, 3750 +.0399, 3900 −.0530, 4050 +.0332, 4350 −.0084, 4500 −.0133, 4650 −.0149; the other 27 frames byte-identical to r2 (6 decimals).

**Commits (r3)**: 712a20e5c chart2 orbit, ccc192adf chapter-B labels→DOM, 7b16dfafe whip blur retired, 6210e4b10 slot floor screen-track slide + settle removal, c601fc19d chartroom spread bridge through buildings entry.

**Asymptote read (for the ≥95 target)**: color+duration are maxed (24.9/25). 95 needs BOTH SSIM components ≈0.95; they sit at 0.888/0.861. The measured obstacles are non-rigid hand-drawn inconsistencies (buildings multi-view trades, flat-redrawn floor bands, eye-phase collage relocation) that a single rigid 3D world cannot satisfy simultaneously — and the owner's standing rule is real 3D over metric. Realistic ceiling with continued per-window refits (community 4850-5150 at 0.68-0.74 is the biggest remaining pool, then chart2 floor placement 3850-3950, buildings back half 0.78-0.80): video ≈0.90-0.91, keyframe ≈0.89-0.90 → SCORE ≈ 92-93. 95 looks structurally unreachable without per-window ink relocation that r2's A/B already showed can lose; treat 92-93 as the honest architecture ceiling unless the owner re-weighs the metric.

**Round-4 priorities (measured)**:
1. Community 4850-5150 (official .68-.74, ~300f): dive/eye phases — needs true per-element correspondences (r2 finding stands).
2. Chart2 floor placement under the orbit camera 3750-4100 (f3900 .654): FloorSet needs a K/Ls-style per-frame refit like the bar layer; the whip window is now sharp so every misplaced-ink pixel counts.
3. Buildings back half 2650-3450 (.78-.80): floor-map ink (yellow road crop .33, streets .43), label anchors, 2160-2295 swing.
4. Slot bottom-band shape: the slide pins position within 2px but the ref band is drawn flatter — a small tilt/scale DOF on FloorPaper could recover the −.01 spent.
5. D-boundary double-cluster during 4692-4712 (FloorPaper + SheetFloor m5250 copies both visible ~20f): align SheetFloor's fallen-papers quads to the frozen slide pose.

## Round 4 — chart2 FloorSet placement (sub-builder, commit 0432103ab)

Chart2.tsx FloorSet now rides a keyframed correction C2FLR (slide dx,dz +
in-plane scale s about the card-cluster anchor; identity renders the exact
original tree). Fit method matters: the scanc2floor centroid unprojection
fit LOSES SSIM (teal mask ignores the heavy grey cards, whose layout the
ref redraws) — final values came from a rendered-still SSIM grid search
(work/r4/c2flr/search.py, floor-band crop objective), constrained to keep
the cluster visibly on-frame (SSIM's unconstrained optimum evicts the ink
under the wall hatch — banned by the ground rule).

- Track: identity→3720, (80,40,1)@3735, (160,80,1)@3750, (160,90,1)@3810,
  (190,100,1.15)@3850-3885, (44,267,1.3)@3900, (-58,45,1)@3915, identity
  from 3930 (hold 2/exit measured best unchanged → 4050+fade byte-identical).
- A/B stills (same-pipeline baselines): 3735 .8226→.8285, 3790 .7871→.7927,
  3850 .7107→.7153, 3900 .6545→.6560, 4050 unchanged .7346.
- f4039-4089 valley is NOT the floor: diffgrid on f4050 pins the loss on
  wall-layer hatch misregistration (region-2 fill hatch phase/orientation,
  ~30-34 meanabsdiff cells) + slight global wall offset (doubled curve /
  Fixed-rate line / labels). Same signature at 3850. Next-round candidate:
  wall-chart hatch + registration, not FloorSet.

## Round 4 — community finisher v2 (rays + strips)
- Commit ee4629ba3 "community ray fan refit to the measured ref convergence".
- Rays: over origin (-60,-183.2)→(19.2,-140.2) = measured ref convergence (wedge center-lines at f4880 meet at screen (455,273.5), stable 4775-4880); vac2 wedge over-tip retargeted to (-236,-140.2) (ref's horizontal wedge); ink #FCFB9D→#FDFDC3 lerp @0.9 (sampled ref cores), mid-dive alpha dip 0.9−0.28·sin(πt).
- Gates (baseline→attempt): f4820 .746805→.746980, f4880 .716693→.720348, f4950 .684510→.685233, f5100 .738232→.738780. Run-structure at 4880 now 3 runs @x=300 / 4 @x=380 matching ref (was 0 and 1).
- Strips at .claude/rounds/work/r4/strips/strip{4850,4950,5100,5200}.png (ref top / ours bottom).
- DROPPED (deadline): task 3 street dashes — MEASURED, ready to apply: dash [6,6]→[16.2,8.7] world units, width 1.2→2.9, ink #DBDBD8→#BDBDBD, blend with dv (identity at dv=0); pre-change stills .claude/rounds/work/r4/fin2/pre{4750,5150}.png, f5150 pre=.737469. Task 4 D-boundary untouched.
- Next priorities (from strips): bottom-band ink density at 5000-5220 (pale cards/squiggle/streets vs bold ref), mid-dive icon scale ~4950 (ours smaller than ref), ref bank rocking ~5200 missing.

### Round 4 (2026-07-04 evening, builder + 3 sub-builders; session-limit cut mid-round, resumed) — community deep treatment (owner-mandated), chart2 floor slide, honest judge

**Method change (coordinator):** priorities ranked by worst rolling 2s per-frame-SSIM window (`scripts/rolling-ssim.py`, r3 series at irswap-framessim-r3.txt). r3's 12 worst: f4812-5228 is ONE contiguous community valley (7 of 12 windows), then chart2 3863-3913/3813-3863/4039-4089, buildings 3383-3433 rank 11. Owner mid-round: community ("last scene with many houses") is also the PERCEPTUAL worst — deepest treatment mandated.

**Judge fix changes the baseline (aa7864d6e/0e14e9810, -nostdin):** r3's official keyframe component 0.8610 was inflated — ~21 of 109 keyframe slots at t>=86s silently re-scored frame 0 (mean ~0.88) instead of their true valley frames (~0.79). Rescoring the SAME r3 render on the fixed grid: keyframe 0.8397 → **honest r3 SCORE = 89.8** (not 90.6). All r4 deltas below are against the honest number (irswap-keyframes-r3-honest.txt).

**1. Chart2 floor-set per-frame slide (sub-builder, commit 0432103ab).** C2FLR keyframed (dx,dz,s) correction, identity ≤3720 and from 3930 (hold-2/exit measured best unchanged; 4050 byte-identical). Fit by rendered-still SSIM grid search — the scan-centroid unprojection fit LOST SSIM (mask ignored the grey cards the ref redraws); the unconstrained SSIM optimum evicts ink under the wall hatch, banned by the ground rule ("the metric rewards absence; the eye demands presence"). Stills: 3735 .8226→.8285, 3790 .7871→.7927, 3850 .7107→.7153, 3900 .6545→.6560. FINDING: the 4039-4089 valley (and much of 3813-3913) is NOT the floor — diffgrid pins region-2 hatch fill phase/orientation misregistration + a small global wall offset (doubled curve/fixed line/labels). Round-5 item.

**2. Community pose refits + per-element dashboard relocation (commit b40b74969).** Toolkit: exact Python port of camCommunity (work/commcam.py, verified to 1e-2 px against SEG tables) + connected-component silhouette scanner + generic Gauss-Newton pose fitter (work/fitcomm.py); ref scanned at 4775/4820/4880/4950/5000/5100/5200.
- bank eye pose (x,z,H)=(274.2,-320.7,182.1) rms 2.2px — was 17px short, 15px low (the bank was the WORST diff cell in every eye-hold frame). Bank W→188.5 after render-check.
- house over pose was 63px low at the base (its blue mass buried the pad zone); joint 3-frame fit rms 4.8px. cbs rebuilt (below). t2 eye fit exact; t3 slid +30 world x. cbs eye refit REVERTED after render-check — the ref's left eye-temple is our t2, cbs is gone by 4970 (fades) — mis-targeted fit caught and rolled back.
- glide slides: the ref re-poses icons along the 4770-4905 glide faster than ANY constant pose (bank cx residual −6→+7px across 4775→4880); per-building screen-tracked world slides (OVSLIDE), released through the dive blend. This is the slot-fix recipe applied to icons.
- dashboard ink: r2's single-similarity A/B loss DIAGNOSED — the collage moves each element under its OWN transform. Per-element world similarities (SIM_E1 grey cards, SIM_E2 teal card, SIM_E3 wide strip, SIM_WAVE squiggle+ticks), overhead corners @4810 → measured eye quads @5100 (band crops), blended by diveT; eye inks paled to sampled values ((223,223,223) grey, (223,235,238) teal); tick columns fade (ref's eye view drops them). The eye band is no longer empty.
- bank temple columns re-measured (f5100: five 10px runs on a 185px body, pitch .15w symmetric; overhead f4880 pitch .145w): cw .055w outlined, hanging 0.04-0.65Hw; strip at 0.81Hw. box2 icon rebuilt: two offset outlined cubes (the ref icon), not one mid-seam tower. Cluster pads widened to measured 1.85x.

**3. Community icon lean grammar (commit 11ef1bc68) — the perceptual keystone.** The ref draws community icons SEMI-BILLBOARDED: near-upright facades under the 38° overhead camera. A true-3D upright building foreshortens hard there and reads "fallen over" — the visible core of the owner's complaint. Each icon now carries a measured base-pivot lean toward the camera (house −0.22, bank −0.45, temples −0.35, cbs −0.2 rad) — still a real 3D object under true perspective (the owner's real-3D rule holds), blended out through the dive to upright at eye level. All over-poses re-solved with lean in the projection model (bank rms 3.7px, house 4.8px, cbs 2.1px). First lean attempt had the SIGN flipped (bank on its back, SSIM up +0.002!) — caught by eyeball, not by the metric: SSIM approved a building lying on its back. The perceptual bar and the metric disagree at the icon level; trust the eye.
- Community stills vs r3: 4880 .7106→.7167, 4950 .6770→.6845, 5000 .7242→.7420, 5050 .7282→.7375, 5100 .7338→.7382, 5220 .7118→.7240; 4775 −.003 (spent: constant-pose trade, slides recover most; residual accepted against the window-wide gain).

**4. Community finisher (sub-builder v2; v1 died at session cut): rays fan empirical refit + perceptual strips (+streets/D-boundary if time).** — see its commits/report below.
- Rays fan refit (finisher sub-builder, commit ee4629ba3): ref fan convergence measured empirically at screen (455,273.5) @4880 → world (19.2,−140.2), stable 4775-4880; old origin projected 65px left and collapsed the fan (0 wedge runs at x=300 vs ref's 3). vac2 wedge retargeted; ink brightened to sampled ref cores (#FCFB9D→#FDFDC3, alpha .9, mid-dive dip 0.9−0.28·sin(πt)). Gates: 4820 .7468→.7470, 4880 .7167→.7203, 4950 .6845→.6852, 5100 .7382→.7388.
- Mid-dive slide keys (builder, commit e47d8dd65): dive blend ran ~10px off the measured 4950 components (bank/house du +10.4); slide release moved INTO the OVSLIDE tables (zero by 4990). 4950 .6852→.6876.
- NEGATIVE A/B (kept out): bolding the sheet's dashed rules toward the ref's measured street marks (16.2/8.7, w2.9, #BDBDBD) lost −.006 at 5100/5150 — our rules sit at sheet-grid positions, not the ref's street positions. Round 5: MOVE the lines onto measured tracks, then bold. (Same lesson a third time: misplaced ink loses to absent/pale ink.)
- Perceptual strips DELIVERED (owner's judgment surface): work/r4/strips/strip{4850,4950,5100,5200}.png (ref top / ours bottom, ±8f). Notes: 4850 cluster reads slightly large/low-left, cube wireframe fainter than ref, overhead squiggle thin; 4950 bottom third emptier than ref's dense map ink; 5100 buildings sit right, bottom band still paler than ref; 5200 ref's bank visibly ROCKS through the pull-back — ours stands rigid (missing motion beat, round-5 item). Measured but unresolved: cube wireframe ink (ref edges ~150 grey vs ours 191).

**5. Ceiling stress test (10 worst honest-grid keyframes, difference composites at current state):**
| kf | r3→now | remaining loss decomposition |
|---|---|---|
| f4950 .677→.685 | (a) dive-path icon residuals ~10px, rays; (b) collage redraws icons mid-dive inconsistently with any smooth blend |
| f3850 .706→.715 | (a) bar-layer K/Ls + wall registration ~+.02; (b) floor sheet features demand different transforms (squiggle vs cards) |
| f5050 .728→.737 | (a) bank icon yaw/asymmetry, cube-edge wash, streets ~+.015; (b) hand-drawn icon asymmetry |
| f4850 .730→.732 | (a) denser glide slides, rays; (b) collage re-pose |
| f4050 .732→.735 | (a) wall hatch phase/orientation refit ~+.02-.03; (b) hatch hand-irregularity |
| f5150 .736→.737 | as f5050 |
| f2950 .782 | (a) label/floor-ink/arrow registration (bank itself only 5-6px off; the loss is element-level, NOT common-mode camera) ~+.02-.03 |
| f3350 .783 | (a) label plates + overlay text anchors ~8-15px, floor ink ~+.02; (b) icon multi-view trades |
| f3050 .786 | as f2950 |
| f3450 .789 | as f3350 |
Sum of plausible (a) gains ≈ +0.7 pts on the honest scale (video +0.15-0.25, keyframe +0.2-0.3, windows spread). (b) reference self-contradiction (multi-view icon/floor redraws, collage relocation, hand asymmetry) holds most of the remaining gap; (c) stroke wobble/grain phase is small but floors both SSIM components ≈0.92-0.93 ceiling per window. **Honest-grid asymptote ≈ 91-92. The 95 target remains structurally unreachable under the one-rigid-3D-world + real-3D rule; r3's "92-93" read was computed against the inflated judge.**

**Round-5 priorities (rolling windows, measured):**
1. Chart2 wall registration + region-2 hatch phase/orientation (3813-3913, 4039-4089) — diffgrid signature in hand, ~+.02-.03/frame.
2. Buildings element-level registration 2600-3500 (labels/plates, overlay text anchors ANCHOR_3300/3450 tables, floor ink; bank pose is already within 6px): windows 3383-3433 and the .78-.80 back half.
3. Community dive-window slides (4905-4980) + bank eye yaw/cube-edge wash (5012-5228 residuals).
4. Slot bottom-band tilt DOF (r3 item, still open).
5. Re-run rolling-ssim on r4 series; re-rank.

**OFFICIAL VERIFY (r4): SCORE 89.9** (irswap-verify-r4.json / irswap-keyframes-r4.txt / irswap-framessim-r4.txt; verify log work/r4/verify-r4.log; the attempt mp4 was reaped by the verify's own cleanup before the copy — re-render if r5 needs frames, or use the framessim series). Components: video_ssim 0.8887 (r3 0.8882), keyframe 0.8409 (honest r3 0.8397; the INFLATED r3 number was 0.8610), color 0.9947, duration 0.9998. **Honest delta r3→r4: 89.8 → 89.9.** The metric moved +0.1; the perceptual moved far more (strips) — the community valley improved on every window while remaining the top block.

**Rolling 2s windows, r3 → r4** (global mean 0.8879 → 0.8887):
| window (t) | r3 | r4 |
|---|---|---|
| 4908-4958 (196s, dive) | .7744 | .7812 |
| 3863-3913 (155s, whip) | .7797 | .7816 |
| 3813-3863 (153s) | .7974 | .8017 |
| 4039-4089 (162s) | .8070 | .8074 |
| 5176-5226 (207s, pull-back) | .8090 | .8110 |
| 4858-4908 (195s, glide-end) | .8014 | .8120 |
| 5126-5176 (205s) | .8167 | .8186 |
| 4958-5008 (199s, eye entry) | .8070 | .8200 |
| 5033-5083 (202s) | .8126 | .8206 |
| 3383-3433 (135s, buildings) | .8226 | .8228 |
| 4808-4858 (193s) | .8229 | .8243 |
| 3488-3538 (140s) NEW | — | .8341 |
(5062-5112 left the top-12.)

**Commits (r4):** 0432103ab chart2 floor slide (sub), b40b74969 community pose refits + per-element ink relocation, 11ef1bc68 icon semi-billboard lean grammar, ee4629ba3 rays fan refit (sub), e47d8dd65 mid-dive slide keys.

**Working tooling (work/):** commcam.py (exact camCommunity port), fitcomm.py (component scanner + generic GN pose fitter — reusable for ANY region), scancomm.py, scanc2floor.py, diffgrid.py (per-cell loss localizer), r4/c2flr/search.py (rendered-still SSIM grid search). Honest r3 keyframe rescore: irswap-keyframes-r3-honest.txt.


### Round 5 (2026-07-04 evening → 07-05 ~04:30, builder + 6 sub-workers across 3 session cuts) — chart2 wall redraw, owner triple, plaques, slot flatten

**OFFICIAL VERIFY (r5): SCORE 90.0** (r4 89.9, honest r3 89.8). Components: video_ssim 0.8901 (r4 0.8887), keyframe 0.8431 (r4 0.8409), color 0.9951, duration 0.9998. Artifacts: irswap-{verify,keyframes,framessim}-r5.*; verify log work/r5/verify-r5.log; attempt render RESCUED this time → work/r5/attempt-r5.mp4 (scaled copy, 854×480 — use for r6 window triage without re-rendering).

**Landings (9 commits, every one A/B still-gated against work/r5/baseline-ssim.txt):**
1. **64e98a841 slot band flatten.** Ref redraws the fallen sheet FLATTER through the slot dolly than the rigid f4268 artwork projects (r3's slide fixed position only). In-plane depth scale FLAT_SZ=0.38 about the pinned teal-band anchor, ramped with the slide weight; fit by rendered-still SSIM grid search 4350-4700 (sx=1.0 won everywhere — apparent width gap was scanner-mask noise). Official kf: 174s +.0015, 180s +.0040, 186s +.0037.
2. **5510af098 chart2 hatch lattices** (sub-worker, inherited from dirty tree after cut). Measured by RECTIFYING ref frames into wall space through the solved camera (work/r5/c2/rectify.py): ref hatch = dark bands + narrow light stripes (duty ~1/3) — old generator had the duty cycle INVERTED, one global 45°/5px lattice vs the ref's per-region lattices (r1 46.1°/4.06, r2 50.2°/4.535, region-fixed phases).
3. **023dcf413 community street rule → measured per-frame track + bold** (sub-worker ×2). r4 lesson closed: the ref REDRAWS the street rule through the pull-back — per-frame keyed world track, dash 26.7/17.8 wu w2.0 #BDBDBD, beyond-sheet extension, dv-blended (≤4914 byte-identical). Official kf: 204s +.0021, 206s +.0026, 208s +.0026.
4. **49a0558ba buildings plaque world-centers PLQ_FIX** (sub-worker ×2). GN fit to measured board centers (trusted rows lender 2505 (−2,−16) / 2950 (+4,−21)), cross-val 3-7px. Negative A/B in-code: D-phase board slides toward text-measured positions LOST at all three gates. Official kf: 118s +.0016, 136s +.0012; 128-134s −.002-.004 (company D-pose ref self-contradiction) → net ~flat.
5. **183ce05d2 chart2 C2WREG wall redraw similarity** (+ a063cae06 cleanup). ICP fits of ref curve/line/dash ink in wall space: the ref redraws the whole wall diagram per hold. Adjudicated per era: hold-1 rows (3750-3850) → IDENTITY (fitted k≈1.07-1.10 regressed 3850 .7405→.7191 — ICP traded curve shape error into scale); whip/hold-2/pull-back rows kept (halving whip k lost −.0045 at 3900); badges EXEMPTED from the transform (riding it lost at 3850 and 3900 alike). Official kf: 154s +.0252, 158s +.0099, 160s +.0275, 162s +.0501, 164s +.0060.
6. **ec12a89f7 cube glass wash.** Pane opacity 0.32→0.12 (ref interior near-white). Negative A/B: bolding the four vertical edges to measured decisive strokes (#969696, ref cores 131-145) LOST at every gate — our cube pose ~10px off; **misplaced bold ink loses to faint ink, 4th confirmation.**
7. **62c1ad57e bank rock beat (owner-flagged).** Measured apex-vs-base lean (dense 3f sampling, work/r5/comm/rockscan2.py): two damped swings −8.5° @5218 / 0 @5230 / −7.9° @5236, settled 5245. Real 3D base-pivot Z rotation, keyed at 0.5× amplitude (full amp lost −.005 @5220 — our bank's static pose pays double under rotation; 0.5× costs −.0018, beat clearly reads in motion). Direction verified BY EYE (apex screen-left, matches ref); a scanner artifact read +47° on our render — the eye adjudicates orientation, again.

**Session-cut archaeology:** three workers died at session limits mid-round (chart2 registration, community finisher, buildings ×2). All in-flight work recovered from the dirty tree, audited A/B vs pre-round baselines, split from a mid-air `--amend` collision with the live realist track (a realist commit landed between commit and amend; repaired by soft-reset + path-scoped re-commits → 02ff0d304 + a063cae06). LESSON: never `git commit --amend` in a shared live tree — commit forward.

**Verify infrastructure fights (r6 must know):** verify attempt 1 died at f126 — a concurrent CRX-Anoma 4K render (other session, ignores the replica lock, full 4.2G public copy) OOM-killed the browser and dragged disk 19→4.9Gi. Attempt 2 died at the verify script's OWN whole-repo tsc gate on the realist track's in-flight type errors. Fix that worked: detached tsc-polling retry loop (work/r5/verifyloop.sh) that fires the locked verify inside a green window; mp4-rescue watcher copies /tmp/replicate-attempt-* before the script's cleanup trap reaps it.

**Rolling 2s windows, r4 → r5** (global mean 0.8887 → 0.8901):
| window | r4 | r5 |
|---|---|---|
| 3863-3913 whip | .7816 | .7804 (flat) |
| 4908-4958 dive | .7812 | .7805 (flat) |
| 3813-3863 | .8017 | .8007 (flat) |
| 4039-4089 | .8074 | **.8260 (+.019, left top-10)** |
| 5176-5226 pull-back | .8110 | .8102 |
| 4858-4908 | .8120 | .8116 |
| 4958-5008 | .8200 | .8188 |
| 5126-5176 | .8186 | .8189 |
| 5033-5083 | .8206 | .8202 |
| 3383-3433 | .8228 | .8238 |
| 4808-4858 | .8243 | .8240 |
| 3488-3538 | .8341 | .8345 |

**THE r5 STRUCTURAL FINDING (why +0.7 pool yielded +0.1):** still-gate wins anchored at measured frames DO NOT extend across their windows. 3850 gained +.025 as a keyframe while its window stayed flat: the hatch phase/wall pose were measured at 3850 and the ref's hand redraw drifts continuously off-anchor. Same at the whip (C2WREG repaired exactly what the darker hatch cost → net zero). Only chart2 hold-2 (4039-4089), where C2WREG rows were fitted per-frame across the whole era, produced a real window jump (+.019). Therefore: gains only generalize when the correction is MEASURED PER-FRAME ACROSS THE WINDOW (the B/C camera-solve recipe), not anchored at one frame.

**Perceptual strips (work/r5/strips/, ref top / ours bottom, honest verdict):** street rule present on measured track ✓; bank rock present at 5220, same CCW direction as ref ✓; cube interior no longer grey-washed ✓; community icon registration no longer the leading jar ✓. REMAINING JARS: (1) bottom-band + mid-floor INK DENSITY — the ref's sheet is inked (map grid, plank lines, dashed rules, bold soft-wiggle red squiggle); ours reads washed across every strip; the street rule alone doesn't close it. (2) Our red squiggle is a hard zigzag vs the ref's soft wiggle, pale at eye phase. (3) Icon white pads fainter than ref through the dive.

**Round-6 priorities (measured, ranked by window & the r5 finding):**
1. Community floor/band ink DENSITY as a per-frame-measured layer (4808-5227, 7 of top-10 windows AND the owner's eye): trace the ref's sheet ink set (grid/planks/rules/squiggle) at 8-10 frames across the valley, rebuild the SheetFloor ink to the measured set, per-frame tracks where it drifts. Move first, then bold — now with density.
2. Chart2 hold-1 + whip: extend the hatch phase + wall pose measurement PER-FRAME across 3806-3913 (the 4039-4089 recipe; scan every ~10f, not one anchor).
3. Dive window 4908-4958 (.7805): densify OVSLIDE + rays through the dive with per-frame scans.
4. Buildings 3383-3433/3488-3538: label plates and floor ink under the same per-frame rule.

**Asymptote verdict (updated):** r4's "+0.7 measured pool → 91-92" assumed still gains generalize; r5 measured that they do NOT (three flat windows despite +.02-.05 keyframe wins). Per-frame-densified refits can still buy ~+0.5-1.0 total (video→~0.895-0.90, keyframe→~0.85-0.86) → **honest asymptote ≈ 90.5-91**, diminishing hard past 90.5. The 95 target stays structurally unreachable under one-rigid-3D-world + the owner's real-3D rule; the remaining gap is the reference contradicting itself frame to frame, which only per-frame ink relocation could chase — and the metric punishes that whenever placement is imperfect.

## Round 6 — buildings era f3333-3538 (sub-builder, 3 commits)

**Lane:** Buildings.tsx / Buildings3D.tsx / data/buildings.ts / data/buildings3d.ts. Targets: rolling windows 3383-3433 (.8238), 3488-3538 (.8345), 3333-3383 (.8362), 3433-3483 (.8393). Method per the r6 law: every correction is a dense per-frame measured track (keys <=10-20f), no single-frame anchors. Camera and building poses untouched; CAM_KEYS_3D byte-identical.

**Triage (diffgrid, 6 frames):** loss cells = (1,5) bottom-left floor/plaque band worst everywhere (45-64 meanabsdiff), (5,4) bank region 49-57 at 3395-3470, (3,1)/(3,3) overlay text 28-34. f3530+ adds whole-scene common-mode (exit camera — off-limits).

**1. 0458711a3 — D/E overlay onto measured per-frame tracks + fade retimes.** scantxt.py measured every 10f, ref AND attempt (delta = ref−att needs no calibration). Findings: D text sinks ~6px (ours held y const), the "3.0" value sits 5→9px HIGH in ref, both D arrows contract ~4-8px at the ends, the E net-cash block is ~screen-static (the P1 ride was the WRONG model during the hold — 29px error by 3525). Fade probe (3f steps): ref red arrow SOLID through 3430, re-posed 3430-3440 — ours ghosted it at 3421-3427, 6-9f early; text out 3420-3430, teal 3426-3434, net-cash in 3440-3452. Gates: 3425 +.0140, 3515 +.0125, 3395 +.0098.

**2. road commit — yellow road measured track + squeeze.** Ref redraws the road as a thin ribbon sliding deeper (ref ink n~1900 vs ours ~4100, centroid (+16,+21) off by 3425; color identical — pure shape+position). ROAD_FIX = per-frame floor-plane world deltas; ROAD_SQZ = 0.55 cross-width squeeze blended 3300-3330; base polygon stays runtime-unprojected (seam-exact). Gates +.0011..+.0019 everywhere.

**3. plaque commit — company/bank boards onto per-frame tracks. r5's plaque negative REFUTED by a better instrument.** plqedge.py: angle-swept projection histogram finds the two long border edges → tilt+center+extent, SELF-VALIDATING (att tilts reproduce the drawn tilts exactly: lender −9°, company −4°, bank −3°). Ref redraws company/bank boards 6-10° steeper, centers swinging (0,−13)@3305 → (0,+8..+13) mid-era → (+21,−15) in the whip. PLQ_D_FIX screen deltas → world offsets at board depth through buildingsPose; PLQ_TILT_FIX rolls the plane about its normal (no canvas clipping). Registration after: company f3395 c(307.3,401.3) t−13.0 vs ref (305.7,401.2) t−13.0. Gates: 3350 +.0102, 3425 +.0084, 3515 +.0086. LENDER EXCLUDED — board frame-clipped + building-base ink merge; edge fit jumps (−5→−26° across 40f); no measurement-grade track (in-code note; do not invent one). NOTE: my earlier "LENDER 30px off" triage eyeball was a misread — measured lender delta ≈ (+6,−1)@3425.

**15f sweep, whole era (r5 attempt mp4 → final PNG stills; mp4 encoding costs ~.004, PNG-PNG gate deltas quoted above are exact):** 3335 .786→.805, 3350 .781→.799, 3365 .774→.791, 3380 .771→.791, 3395 .770→.793, 3410 .764→.791, 3425 .764→.791, 3440 .793→.806, 3455 .789→.803, 3470 .786→.806, 3485 .796→.819, 3500 .789→.818, 3515 .772→.798, 3530 .766→.775, 3545 .814→.819. Window means (raw): 3333-3383 .778→.798, 3383-3433 .766→.792, 3433-3483 .790→.805, 3488-3538 .776→.797. Every frame positive.

**Seams:** stills 3300 and 3600 byte-identical across all three commits. tsc green each time.

**Left on the table (measured, unfixed):** (a) lender plaque (above); (b) street family fans 0-20px right of ours growing left→right at 3425+ (scanline dips y420/y455) — a spacing/projection error a slide can't fix, per-line tracks would be next; (c) f3515-3545 whole-scene common-mode offset = exit-whip camera (off-limits this round); (d) 3383-3433 residual is now mostly building-body outline doubling ~5-10px (the known multi-view trade) + lender board.

**Tooling added (work/r6/bld/):** scantxt.py (text/arrow block scanner), probe_fade.py (opacity probes), plqedge.py (board edge-pair pose fit — the instrument that beat r5's text-center method), plqncc.py (NCC tracker, too weak — kept as negative record), roadscan.py, plqscan.py (projection port + seeds).

## Round 6 — chart2 whip approach + whip (sub-builder, lane: Chart2.tsx; commits f600fff40, a12155af5, a4c128162)

**Target windows: 3861-3911 (.7804) and 3811-3861 (.8007). Triage (23 ref/att pairs at 5f + diffgrids at 6 frames): the loss carriers were (1) the two wall LABELS — ref keeps them near wall-locked in position (bbox-left s≈−135.5 const across the whole era) but shrinks them in wall units (56→47) while ours rendered 15-40% oversized (and rode the whip k on top); (2) wall-diagram registration through hold-1 (identity rows left the doubled curve/line/hatch the r4 diffgrids saw); (3) the whip-era hatch, double-scaled ~10% by the r5 identity-divide base. NOT carriers as feared: the bar layer inside the windows (overlay showed the applied C2BAR path basically right at 3886 — the free image-registration fits false-optimum there and Ls-aliases at 3919-3925, validated against our own render before trusting: recovers applied K/Ls exactly at 3868/3901), and the floor pose (see negative below).**

1. **f600fff40 — measured label tracks** (scanlbl.py, per-frame ref bboxes ≤10f 3750-3901, calibrated with the same scanner on our base3850 still; labels leave the C2WREG transform inside (3735,3920)). Gates: 3790 .7927→.8018, 3820 .6984→.7076, 3835 .7084→.7180, 3850 .7405→.7503, 3868 .6865→.7084, 3885 .6916→.7162, 3905 .6564→.6596.
2. **a12155af5 — hold-1 no-theta C2WREG rows + era-split hatch base.** KEY REVERSAL of the r5 verdict, two causes separated: labels off the transform (above) AND theta was curve-shape leakage — the theta rows still lost 3835/3850, the NO-THETA refits of the same frames win huge. Combined gates vs post-label state: 3790 .8018→.8249, 3820 .7076→.7515, 3835 .7180→.7504, 3850 .7503→.7470 (the one residual, −.003 vs +.076 net), 3868 .7084→.7177, 3885 .7162→.7276, 3905 .6596→.6619. Hatch base is now three-phase (dynamic divide ≤3856 → theta-art-pose divide 3863-3912 → r5 identity base ≥3919) so hold-2 + the protected 4039-4089 window + the 4050 seam stay byte-identical (verified, plus 3700).
3. **a4c128162 — floor NEGATIVE documented in-code.** Per-frame all-ink ICP floor fits (floorfit.py, rms 15-26 floor units) lost at all 5 gates (3826 −.002, 3850 −.001, 3871 −.002, 3886 −.002, 3905 −.007). Fifth confirmation: mask-fit optima lose to still-searched rows. Red-only fit for the bottom-right squiggle diverged (mask catches the wall curve) — squiggle bolding blocked on a proper scanner.

**Net still-gate table (baseline → shipped): 3790 .7927→.8249, 3820 .6984→.7515, 3835 .7084→.7504, 3850 .7405→.7470, 3868 .6865→.7177, 3885 .6916→.7276, 3905 .6564→.6619, 3922 .8001→.8017 (attempt-frame proxy), 3950 byte-identical, 3700/4050 byte-identical.** All corrections are per-frame measured at ≤10f across the windows per the r5 law.

**r7 leads (measured, chart2):** (a) bars 3915-3930 really are off (ref spacing wider; K≈1.45-1.49 by eye-checked overlay) but Ls-aliased fits + protected-zone adjacency made it a no-go this round — needs an assignment-based scan, outside the r6 windows anyway; (b) floor cards read flat/pale vs ref at every hold-1 frame and the red map squiggle is pale + untracked — needs a dedicated scanner before bolding; (c) residual top-right curve-tip shape error (cell (7,1) ~28) is model-vs-hand shape, likely ceiling. Tooling in work/r6/c2/: scanlbl.py, fitbars.py (solveKeys port + validated ink objective), floorfit.py, plus the r5 fitwall/proj copies.

## Round 6 — community ink layer (sub-builder, lane Community.tsx; commits e11a1e1a1, 134014bc1, 66f7e57c0, 35a69d693, 7e5816884)

**Mission:** bottom-band + mid-floor ink density + the owner-named squiggle jar. Baselines rendered FRESH at HEAD (post 737f01034+953b2a768) — the 04:00 r6/base stills were stale and unused for A/B.

**1. e11a1e1a1 — RED SQUIGGLE rebuilt on a measured per-frame world track (the big win).** The 8-vertex hard zigzag (m10+SIM_WAVE) retired. Scanner (work/r6/ink/scansq.py): dusty-red mask (loosened in-band — the brief's strict mask truncated the washed overhead/pull-back ends), per-column runs chained by continuity, solid/dash separated per column, unprojected via commcam at each key. 30 keys × 32 equal-arc world points, 4710-5240 (20f glide / 10f dive / 30f eye / 10f pull-back), temporal median-3 inside the stable phases (±6wu endpoint scan flutter would lerp into 0.4s wobble), washed pull-back partials extended by the registered 5210 shape. Drawn as midpoint-quadratic smooth curve; dashed companion at the measured world offset per key (≈(−1.7,+6.3)wu overhead → (+0.2,+9.8) eye); phase-keyed cores+widths (overhead ~2px dusty (219,189,192), eye ~3.6px (218,176,180), pull-back wash → alpha 0 by 5252). MEASURED FINDING: the ref slides the squiggle across the sheet through the glide (start z +35→−38 over 4720-4900), holds ±3wu through the eye phase, jumps right at 5220 — per-frame keys were mandatory, confirming the r6 law again.
Gates (fresh-HEAD baseline → after): 4750 .8235→.8242, 4820 .7465→.7480, 4880 .7199→.7212, 4935 .6859→.6905, 4950 .6926→.6978, 5000 .7426→.7451, 5100 .7453→.7481, 5150 .7530→.7559, 5190 .7306→.7339, 5215 .7281→.7286. Every gate positive; dive strongest (+.005).

**2. 134014bc1 — dashboard card inks keyed to sampled fills.** Ref overhead grey is LIGHTER than our #C9C9C9 (201): 214 @4750-4810 washing to 222 by 4880 (the brief's "ref darker" expectation reversed by measurement); teal de-blued (b 243→224 early). Tables land exactly on the r4 eye values by 4990 — 5000/5100 byte-identical. E3's "overhead strip" was actually the ref's SPEECH BUBBLE (r4 mis-measured it) — E3 now fades in with the dive. Gates: 4750 +.0002, 4820 +.0008, 4880 +.0010.

**3. 66f7e57c0 — the speech bubble, shipped as a DOCUMENTED PERCEPTUAL SPEND (owner-named jar).** Measured quad (PCA of the teal cc @4810), fill (208,235,238) constant across the glide, world-locked within ±5px 4750-4900 + keyed residual slide (bbox scanned every 30f). Ships fill-only at −.0008 avg on the overhead gates (4750 .8244→.8236, 4820 .7488→.7479, 4880 .7221→.7215) while its own band cells improve hugely (MAD −2.4 @4750, −8.0 @4880): SSIM's structure term punishes ANY crisp edge against the ref's soft render; the outlined variant lost double. Precedent: the r5 bank-rock spend.

**4. NEGATIVE A/Bs (all measured, all documented in-code, tracks preserved):**
- Fallen-paper quads + white under-band (scanfrag.py @4810; papers-only, +full-width band, and surgical variants): −.003..−.005 at 4750/4820/4880 ×3 attempts. Root causes measured: the ref REDRAWS the papers per shot (paper-L edge slope at 4750 ≠ any world-locked 4810 quad); the ref's frame corners are grey void ~218 where any white fill loses; the old mis-placed m5250 teal sub-card is photometrically lucky against that void. Old set restored byte-exact.
- Ruled hairline block, bottom-left red pieces (dash/hair/diag; ref drops them by 4880), right-edge red vertical rule (~7px pale wash, OWN per-frame track measured 4720-4900 — world-locked it sat 55px off at 4750): each individually SSIM-negative in crisp and softened forms; tracks preserved in the bubble-block comment.
- Leader hairlines + rule bolding (the core of the "washed grid" jar): the ref's real mid-sheet ink is ~22-33 short-axis leader hairlines with darker dot terminals + 5 solid rules drawn 2-4px/cores 185-215 (ours 1.2px/213-230). Two measured sets (4810/4880, work/r6/ink/leaders.json) crossfaded mid-glide + 1.9px #D2D2CF rules LOST every gate incl. the eye band (4750 −.0065, 4820 −.0040, 4935 −.0062, 5000 −.0059, 5100 −.0065 — the old tick residue and thin rules were quietly correct at eye). The set is redrawn per shot (nearest-neighbour world distance ~27wu 4810↔4880). CONFIRMED LAW, now 7+ instances: only per-frame keyed measured tracks carry hand-redrawn ink; set-anchored or bolder-in-place ink loses.

**Net vs fresh-HEAD baseline (final state):** 4750 +.0001, 4820 +.0014, 4880 +.0016, 4935 +.0046, 4950 +.0051, 5000 +.0025, 5100 +.0028, 5150 +.0029, 5190 +.0033, 5215 +.0006. Seams: 4700 changed only by the squiggle inside the 4690-4708 crossfade (SSIM +.0007; 4690 sheet-alpha 0); dissolve ≥5285/outro untouched; camCommunity/SEG/ICON_FIX/OVSLIDE/WB/bankRock untouched.

**Tooling (work/r6/ink/):** scansq.py (squiggle tracker: predicted-band column scan + chaining), gentable.py (smoothing/extension/thinning → TS), sqsurvey.py, scanplank.py (leader scanner), scanrules.py (per-column shallow families), scanfrag.py (bubble/red/ruled/paper measurer), overlaysq.py, apply_leaders.py + leaders.json (ready if r7 builds per-line correspondence), rendertry.sh/mkstrips.sh.

**r7 leads (measured, community ink):** (a) the leader-hairline family and rule bolding need a per-line correspondence instrument across redraw scatter before any of that measured ink can ship; (b) paper-quad redraw keys (edge tracks per shot); (c) the two outer dashed rules — one measured dashed GRID-direction rule exists above the squiggle (dash trains ~8-12px screen) — untouched this round after the r4 negative; (d) bank pad geometry still occludes the squiggle band at 4880 (the big white diamond, known open item).
**5. 7e5816884 — squiggle width closed-loop.** With scan-measured widths the CanvasPlane pipeline (res 0.9 + texture filtering) rendered only ~99 strict-red px at 4850 vs the ref's 350 while the CORES matched within 2-4 levels — the stroke was thin, not light. Widths +0.4-0.5wu; metric-neutral (±.00005 at 4820/4880/4950/5100/5150); footprint now matches the measured density.

**OFFICIAL VERIFY (r6): SCORE 90.2** (r5 90.0). Components: video_ssim 0.8919 (r5 0.8901), keyframe 0.8449 (r5 0.8431), color 0.9951, duration 0.9998. The r6 builder was cut before archiving; the r7 builder recovered the artifacts from public/reference-analysis (timestamps 06:50-06:59, after the last irswap commit 7e5816884 06:36 — the verify scored irswap-HEAD) → irswap-{verify,keyframes,framessim}-r6.*; attempt render rescued at work/r6/attempt-r6.mp4 (854×480). Rolling 2s windows (r6): 4909-4959 .7884, 3863-3913 .8015, 4859-4909 .8137, 5170-5220 .8186, 4959-5009 .8204, 5009-5059 .8249, 4809-4859 .8256, 4047-4097 .8260, 3813-3863 .8316, 5059-5109 .8317, 5120-5170 .8336, 3384-3434 .8378. The community valley (f4809-5220) holds 7 of the top 11.

**Strips verdict (work/r6/strips/, ref top / ours bottom, honest):** the SQUIGGLE JAR IS CLOSED — at 4950 and 5100 ours is a soft continuous wiggle with a clean dashed companion on the ref's own track, position and character matching (was a hard pale zigzag). The bubble sits at its measured spot with its tail. Cards read at sampled tone. STILL washed vs ref at overhead (4750/4850): the ref's leader-hairline+dot texture across the mid-sheet is the remaining ink mass, measured twice and refused twice by the metric in set-anchored form — the honest next move is a per-line correspondence instrument, not bolder ink.

## Round 7 — buildings strike 2 (sub-builder)

**Owner (verbatim, ~1:41/f2525):** "sometimes the house moves, while only camera should move" + "make the model of all 3D houses better." Lane: Buildings3D.tsx / Buildings.tsx / data/buildings3d.ts / data/buildings.ts (buildings.ts untouched). Commits: bd814cb78 (ride), ca0683949 (ink), fb768a262 (roof edge), 406ba2966 (chimney).

**PART A diagnosis (what was moving).** Building WORLD transforms audited time-CONSTANT (B3D mids/theta constant; drop only inside appear windows; PLQ_D_FIX zero <=3300) — the motion was all in the RIDE:
1. **Velocity steps at every 15f camera key.** lerp1 on CAM_KEYS_3D = C0 path: projected building-center velocity stepped at every key — mean 0.32 px/f, max 2.32 (f3180; f1755 2.06, f2295 1.0-class during holds). A hitch every 0.6s reads as "the house moved," most visible in slow holds.
2. **Key f2295 was a solve-outlier bounce.** Tracked (motion.py mask-centroid tracker, ours AND ref, segs 2260-2339/2400-2599): our company v ran 326.4->322.1->324.5 and lender 356.6->352.2->354.1 over 2286-2310 (4.3px up-and-back) where the REF glides monotone (325.3 company / 350.4 lender mid-window). Row [2295, -30.652, 4.446, 745.944, -0.1965] vs neighbors = -7.4u camY dip.
3. NOT the disease: frame-to-frame centroid jitter (ours was already SMOOTHER than the ref's hand-redrawn ink: lender acc rms 0.20 vs ref 0.41 @2400-2599); sub-pixel hold meander (±0.6px/50f, invisible; SG key-smoothing REJECTED — SG(5/7/9,2) saturated a 2px displacement clamp across whole curved runs = systematic bias not noise removal, and ADDED reversals at 3390-3495).

**PART A fix (bd814cb78).** (a) camBld interpolation lerp1 -> C1 Catmull-Rom (cr1 in Buildings.tsx) for f<3510; CR passes through keys EXACTLY so every datum eval (camBld 2505/3540, T_BLD@1705, T_C2@3580) is bit-identical and NOTHING in the world was refit; f>=3510 keeps linear so the exit-whip lane sees byte-identical frames (3550/3600 md5-equal pre/post Part A). (b) f2295 replaced by the 2280/2310 midpoint (in-code comment documents the tracked bounce; NOTE the old row is quoted in that comment — offline scrapers must strip comments before regexing rows, motion.py does now).
**Motion before/after (honest numbers):** model keystep mean 0.323 -> 0.039 px/f, max 2.317 -> 0.268; anchor displacement 2505/2950/3300 = 0.00/0.05/0.00 px; dense path deviation <=1.5px everywhere except entry swing + f3112-3191 whip (<=4.2px where the camera moves 20-30 px/f). Rendered tracks: f2295 bounce GONE (company v 328.5->324.6 monotone, matches ref shape); bank max acc 1.23->1.15 @2400-2599, 1.55->0.80 @2850-2949; key-locked accel excess (bank 0.47@keys vs 0.33 mid) flattened (0.35/0.31). Spot windows 1850-1949 (healthy before, healthy after) and 2850-2949 verified. SSIM spend: -.0002..-.0005 at 2302/2450/2525/2600; 3000 byte-identical (key frame) — authorized by the rigid-world rule.

**PART B (models).** Instrument-first: bank column GEOMETRY measured CORRECT (white runs 9-11px vs ref 11px, same vertical extent) — the visual gap was INK and rendering artifacts, not shape:
1. **ca0683949 ink weights (measured f2505):** side walls render near edge-on and their 2.5u stroke minified to zero (ref bank left silhouette = 7px dark band core 140,115,118; ours had NO dark pixel on that row) -> SIDE_W 4.0; column outlines washed to pure fill (ref gap cores 120-160, ours 224 red) -> COL_W 2.2; ground-contact pale (169 vs ref 116) -> BASE_W 3.6 base lines (door span excluded). PERCEPTUAL SPEND, strips carry it: 2450 -.0007, 2525 -.0007, 2600 -.0012, 3000 -.0010.
2. **fb768a262 roof-edge closure (metric-positive +.0001..+.0003):** far slope was FrontSide-culled at the pitch grazing angle -> white flicker over the ridge; now DoubleSide while opacity>0.995 (fade ramps + f3550 endFade keep the old path). Slopes crossed RIDGE_OV 1.2u (abutting AA seam). Fascia ink planes at ovF/ovB draw the ref's thicker roofline (see-under-the-overhang wedge). ROOT CAUSE of the residual "white dots INSIDE faces": useStaticTex drew logical w into a round(w*res) canvas — sub-pixel transparent edge sliver, dragged inward by mipmaps, discarded by alphaTest; transform now maps exactly. NEGATIVE in-code: raising pentagon eave-tops by roof.lift (wrong wedge, 2450 -.0005).
3. **406ba2966 chimney:** ref = stout outlined box in the right slope (~10u wide, ~10u above roof); ours was an 8.5x18u stick behind the gable. w10/top89/dFr4/bottom60 + 3.2 stroke. Reads as the ref icon at f1900/f2525.

**Part B net gates (ref-SSIM, post-A -> final):** 2450 .83971->.83890, 2525 .81622->.81551, 2600 .82478->.82462, 3000 .79188->.79058. **f3550 explicitly gated** (any visible model change must show there): ref .82546->.82379, HEAD-vs-final .9913; **f3600 byte-identical** (md5). Strip verdict (work/r7/strips/strike2-{2450,2525,2600}.png, ref top/ours bottom, -8/0/+8): the buildings now read as the ref's inked drawings — outlined columns, closed dark silhouette, solid ridge, thick roofline, drawn base, stout chimney; residual sparkle 1-3 isolated px/frame (was a dash trail). Remaining known deltas are the multi-view registration trades (buildings sit a few px low-right at some poses) and floor-map ink paleness (other lanes).

**Tooling (work/r7/bld/):** motion.py (per-frame mask-centroid tracker + camera-model port, comment-stripping parser), jitter.py (vel/acc + key-locking report), drift.py, kinks.py (model keystep audit), smoothproto.py (CR/PCHIP/SG prototypes + displacement clamps — the SG negative lives here), mkstrip.sh. Segments: seg{1850,2260,2400,2850}-{before,head,after,ref}.mp4.

**r8 leads (measured, this lane):** (a) one stubborn white pixel family survives near the lender gable diagonal (single px, view-dependent, e.g. (251,337)@2525 — inside the left-slope quad per projection; not fascia, not canvas mapping, not depth nudge; suspect planeGeometry triangle-edge AA vs alphaTest — a real fix probably needs alphaTest 0 + premultiplied alpha or polygonOffset); (b) bank pose at 2505 sits ~5px low-left of ref (multi-view trade — only a piecewise-constant world refit at an occlusion could close it); (c) plaque boards brighter than ref boards at some poses (unmeasured).

## Round 7 — community strike 1 (sub-builder)

**Lane** Community.tsx only. Owner: 3:16-3:30 (f4900-5250) "get a much better score there." Four commits, every one A/B still-gated (fresh HEAD baselines in work/r7/comm/base/); camCommunity untouched.

**STEP 0 — correspondence map** (work/r7/comm/corrmap.md; ref/att every 10f 4810-5260, diffgrid at 6 frames, component tracks r7scan.py/json, signed tone fields). Top masses, in order: (1) HOUSE through the pull-back — ref shrinks/drops it far faster than the rigid world (scale 0.55-0.77, d +40..+67px; worst cells 45-47 MAD @5230); (2) cluster through the pull-back — THE UNNAMED FIND: the ref RE-GATHERS the whole community as the camera pulls out (cbs box + t1 temple re-enter from frame-left 5216-5230, t2 slides right through the group, t3 tucks beside the house; the whole cluster fades 5240-5256) while ours kept two stragglers floating high-left to 5262; (3) eye-band ink set 4980-5240 (ref plank zone 54% ink <215 vs our 0.4-1.3% — decomposes into pad outlines / twin rules / paper corner / red dot+diagonal, all near-static through the hold); (4) our own top-band darkening (−10..−23 vs ref, static); (5) overhead leaders (r6 leftover, untouched); (7) overhead t2/t3 20-35% too tall. Two eyeball reads REFUTED by measurement: the eye cards and the mid-floor tone are fine (≤4 levels) — the "washed floor" was localized to (3)+(4).

**STEP 1 — camera audit verdict: NEGATIVE, recorded honestly.** Component deltas (house/cbs/t2/t3/bank every 10f, ref−att): glide and eye-hold common-mode <4px with per-element scatter in DIFFERENT directions (house +2..+3 / t2 −14..−25 / bank −15..−21 at glide) — no coherent camera drift anywhere in 4810-5260. The pull-back divergence is HUGE but per-element: bank/cube/spread are already per-frame-fitted through THIS camera; a camera fix would break those three and force a violent reverse-dolly 5250→5262 to honor the hard zero-at-5262 boundary (measured: the ref camera stays far out through 5265 — the gap does not close by itself). The r4 bank-anchored hermite solve stands; corrections stay per-element.

**Commits + gate tables (RGB still SSIM ref-vs-render, before→after):**
1. **c0987287c house+bank pull-back rows.** ICON_FIX house rows every 5f 5205-5260 (blue-mask bboxes, bottom-center matched, world deltas via the camera Jacobian, dx/kx median-3); bank rows extended 5245-5260 (ref bank base HOLDS y≈288 while the rigid projection rises). Gates: 5215 .7286→.7308, 5230 .7677→.7765, 5245 .8212→.8287, 5255 .8475→.8567, 5270 .9046→.9064.
2. **2fc506050 pull-back community re-assembly.** t2/t3/cbs/t1 ICON_FIX rows at 5f keys (t3/cbs/t1 vs the analytic raw projection — they are invisible in the baseline; k eased 7% for outline-mask bias); opacity retimes (cbs/t1 re-entry 5216/5222, cluster out 5232-5256); t2/t3 pads released 5212-5224 (pads don't ride ICON_FIX — absent beats misplaced); ray-fan origin+tips ride the same measured screen tracks unprojected per frame; vacant wedges die 5218-5230 (the ref fan has no far-left wedges from 5225; ray FADE timing was already right — ref dead ~5243, ours 5240). Gates on top of #1: 5215 .7308→.7348, 5220 (base .7403)→.7518, 5230 .7765→.7850, 5240 (base .8022)→.8146, 5245 .8287→.8323, 5255 .8567→.8620. NOTE: t2's 5215 scan row DROPPED (occlusion junk — ref t2 loses half its CC pixels 5210→5215 behind the entering t1). Motion segment 5195-5265 (work/r7/comm/seg-pb.mp4) eyeballed: smooth gather, no popping, all icons upright.
3. **ac33f4172 eye-band ink + tone-field closure.** (a) Measured ink set keyed 5000/5100/(5150)/5210, unprojected per frame: bank pad front-top edge (core 129) + second stroke + right edge, house pad bottom edge + corner (165-167), twin fanning rules, paper corner curve, red dot (665,378) + pale red diagonal. STROKE-WIDTH LESSON GENERALIZED: widths are screen-px converted to floor units at the track midpoint — the floor foreshortens ~6x at pitch 10°, the first render's "3px" lines were sub-pixel (the r6 squiggle-width law); footprint now 15.8% vs ref 17.6%, metric-neutral (−.001) vs the invisible variant, shipped for the eye. (b) The signed bg tone field is STATIC through the whole eye hold; three gradient lobes close it (closed-loop calibrated at 5100, 2 iterations). Gates vs baseline: 4930 .6869→.7033, 4950 .6989→.7091, 5000 .7450→.7488, 5100 .7481→.7555, 5150 .7559→.7610, 5180 .7362→.7444; on top of #2: 5215 flat, 5230 .7850→.7981, 5245 .8323→.8389.
   **OUT-OF-LANE FINDING (r8 item, documented in-code):** lib/post.tsx EdgeFeather is darken-toward-220 with w≈.97 at the frame edge — it CAPS the outer ~40px at ~221 while the ref community ceiling reads 243.5 (the feather was calibrated at f600/1200/2500/4400, never on this scene). The residual −15..−20 top fringe is unfixable from Community.tsx; re-profiling the feather per-region is the cheapest remaining tone win (touches lib/post.tsx — all scenes must re-gate).
4. **1255f2b0c overhead temple heights.** Closed-loop CC scan across the whole glide: t2/t3 render 20-35% taller than ref (rh steady, bottoms+widths matching) → ky about the base, released by 4914. Gates: 4820 .7479→.7489, 4840 .7395→.7417, 4860 .7305→.7301 (−.0003 accepted vs two wins), 4930 byte-identical. NEGATIVE: the softened 0.85 variant lost at BOTH 4820 and 4860 — the full measured value wins.

**Boundary checks:** f4700 untouched (all corrections gate ≥4715/4915; camera untouched so A_TILT/T_COMM/T_OUTRO/F-bridge exact by construction); f5270 gated +.002 (house rows clamp through the icon fade — desirable).

**Strips (work/r7/strips/strike1-{4950,5100,5200}.png, ref top / ours bottom, post-change).** Honest verdict: 5200 close (pad line, squiggle, rock beat all present; bottom-band cards/grid still softer than ref); 5100 interior tone now matches, pad edges present, remaining jar = the ref's bolder icon outlines (MiniBuilding = Buildings3D lane, active other session) + the leaders; 4950 dive still the weakest — the dive-phase floor is bare (the eye ink starts 4985; the ref's planks/leaders live through the dive too) and pads faint.

**Honest window expectation (r6 → post-r7, from gate deltas; official verify pending at round end):** 4909-4959 .7884→~.795-.800 (the tone band carries the dive), 4859-4909 .8137→~flat, 5170-5220 .8186→~.825-.827, 4959-5009 .8204→~.824-.826, 5009-5059 .8249→~.830, 4809-4859 .8256→~.827, 5059-5109 .8317→~.838, 5120-5170 .8336→~.838; the untracked 5220-5270 stretch gains the most (5230 +.030, 5245 +.018, 5255 +.015 vs baseline).

**r8 leads (measured, ranked):** (1) EdgeFeather re-profile for the community (out-of-lane, est +.005-.01 across ~300f); (2) dive-phase floor ink 4909-4985 — extend the eye-band elements backward on dive tracks + the leader per-line instrument (r6 leftover, still the biggest single mass); (3) glide tone row-1 band (−12 at 4820-4860, shape differs from the eye lobe — suspect: CubeGlass sheen strips paint rgba(222) over a ~243 bg, darkening exactly where the ref is bright); (4) cube overhead per-frame corner track + edge ink (the r5 negative was bolding at the WRONG pose); (5) dive/pull-back pad presence on measured quads. Tooling: work/r7/comm/{r7scan.py,pbfit.py,genrows.py,corrmap.md}, gate stills base/a1-a4, seg-pb.mp4.

## Round 7 — coordinator inline: EdgeFeather lift NEGATIVE (commit 24aed795e, doc-only)
Strike-1's out-of-lane lead measured and adjudicated. Ref community eye-hold f4920-5240 (ramps 4912-4945 / 5228-5242) drops the LEFT-side edge wash: TL corner 243-244 uncapped vs our capped 220 (att−ref −23), BL −12..−20, top-left band −14; TR pinned at 219.4 void throughout; right side matches ±3. Zone-masked weight lift (0.65 TL / 0.55 BL) fixed all band means to ±3 levels and LOST at all three gates: 4950 .7091→.7051, 5100 .7555→.7538, 5200 .7403→.7388. Root cause: SSIM's luminance term at high luma ≈0.995 for a 24-level offset — the metric never priced the wash — while lifting the cap exposes our corner content's structure against the ref's flat paper. The feather has been hiding misplaced ink. Reverted; negative documented in post.tsx. Retry only after community corner content matches structurally. Measurement + stills: work/r7/feather/.

## Round 7 — spin transition strike 3 (sub-builder)

**Owner (verbatim, 2:22/~f3550):** "the reference exits by the HOUSE SCENE SPINNING FAST ON ITSELF while disappearing." Ours faded a frozen cluster. Rebuilt as a real 3D rigid world-yaw per the r7 measurement (work/r7/spin/report.md + spin-measure.json). Lane: Buildings.tsx / Buildings3D.tsx / Chart2.tsx / IRSwapComposition.tsx. Commits: 7abb1193b (spin+fade+lift), f7e530e4f (floor ride + crossfade retime), 3208196b1 (wall-grid fan entry).

**What was built.**
1. **The spin (7abb1193b).** One rigid yaw of buildings+plaques about the vertical axis through the TURNTABLED cluster centroid (mean of B3D mids ridden through rotP(g); g frozen from the 3555 key). Theta keys (deg): 3551:0, 3554:26, 3558:62, 3560:96, 3562:136, 3563:156, 3565:205, 3567:251, 3569:282, 3571:313, 3573:343, **3574:360 exactly**; PCHIP monotone interpolation (no overshoot past closure — Catmull-Rom could cross 360 mid-segment). Wrapper applies rotation.y=−θ and is STRUCTURALLY REMOVED at θ≤0/θ≥360 (rotation.y=−2π leaves sin(2π)≈2.4e−16 residue; removal makes byte-identity structural). Lift keys 0→84u over 3551-3574 (≈50-80 screen px at cluster depth 724, DCAM 659.38; air gap by 3563). Fade: static endFade(3548-3572) replaced by measured envelope — recede from 3518 (1.0→0.68@3545), 0.55→0.41 across 3551-3559, plateau ~0.36-0.38 at peak speed, BLUES extinct 3568, BANK 3573 (FADE_BLUE/FADE_BANK tables from fade_sat). Plaques follow their building's envelope and get flipped TWIN planes with PRE-MIRRORED canvases while θ∈(0,360) — CanvasPlane is FrontSide-culled, and a twin drawn unmirrored shows readable text (first render bug, caught at the sign check); the ref reads "YNAPMOC"/"KNAB" mid-turn.
2. **The floor (f7e530e4f).** Ref crossfades city-map→chart-paper f3518-3544 (faint 3518, clear 3528, dominant 3544), then the PAPER rides the spin and lands on the chart2 tablet pose at 3574. FloorSet stays at its final pose and turns by the same θ about the same axis re-expressed in T_C2 (exact-360 closure = identity at both ends). Retimes: FloorSet in 3572-3584→3518-3544 (kills the 3578-3581 cards pop), FloorMap out 3572-3581→3518-3544, BuildingSlabs with it. FloorMap+slabs also sit inside the spin wrapper (they're gone before it engages).
3. **The wall (3208196b1).** Ref gridlines enter f3570-3577 sequentially left→right, each rising TILTED and rotating about its OWN FOOT on the floor junction, settled by 3580 (fresh contrast-stretched crops att/refgrid-strip.png). Chart2 mount 3572→3570; per-line staggered arrival (0.75f pitch, 1.5f fade), foot-pivot lean 25°·(1−u)² hard-zeroed at 3580; skirting 3574-3578; ≥3580 draws the exact old wipe-end rasterization.

**Sign check (measurement flagged the direction as inferred): CONFIRMED, no flip.** One A/B still at f3560 vs ref: bank sweeps screen-LEFT as the near side showing its column-less back; COMPANY/BANK plaques read mirrored. g-DECREASING (clockwise from above) is correct.

**Gate table (ref-SSIM, baseline = HEAD stills pre-change, work/r7/spin/base/):**
| f | baseline | final | Δ | note |
|---|---|---|---|---|
| 3530 | .7749 | .7823 | +.0073 | paper crossfading in (ref has it) |
| 3545 | .8174 | .8188 | +.0014 | recede fade + paper |
| 3556 | .8518 | .8544 | +.0026 | spin ramp |
| 3563 | .8535 | .8763 | +.0228 | floor turning under lifted cluster |
| 3572 | .9149 | .9039 | −.0111 | SPEND: ref-present spinning bank + entering grid vs baseline's already-extinct scene — absent-beats-misplaced; owner ordered the spin |
| 3578 | .8867 | .8715 | −.0152 | SPEND: full entering grid vs old half-wipe; ink the baseline didn't have, the ref has |
| 3584 | .8738 | .8738 | byte-identical | |

**Byte-identity proofs (md5, final HEAD):** f3500, f3510, f3584, f3595, f3600, f3700 all IDENTICAL to pre-change baseline (att/final-identity.txt). Floor identity from 3574 and wall identity from 3580 are structural (wrappers/branches removed, not zeroed).

**Negative A/Bs (all measured, documented in-code — do not retry blind):**
- Map survivor riding the spin: whole-map low tail (−.0020/−.0022/−.0013/−.0005 at 3530/3545/3556/3563) AND yellow-road-only survivor (−.0009/−.0010/−.0003/−.0014) both lost — the ref's yellow patches DO orbit f3550-3563, but our road track lands under the cluster at the spun pose; a survivor needs its own measured track (Buildings.tsx FloorMap comment).
- Wall-entry rigid rotations: cluster-axis yaw .8728/.8751/.8679 and wall-center-axis yaw .8760/.8766/.8686 (3572/3575/3578) — a vertical-axis yaw under a level camera can NEVER tilt world-vertical lines (geometry, verified by render); rigid wall-normal roll .8763/.8805/.8679 — tilts the floor junction the ref keeps planted. The brief's two vertical-axis candidates were both gated and both refuted; per-line foot-pivot is the measured grammar (Chart2.tsx GridWall comment).

**Blur check at peak (flagged item):** ref crops at 3563-3566 (peak 24°/f) are soft hand-drawn ink, NO directional smear — stayed sharp (r3 precedent holds).

**Filmstrip verdict (seg-spin-after.mp4 f3510-3600; strips/strike3-seq.png at 3540/3547/3554/3561/3568/3575/3582/3589, ref top/ours bottom): the scene now visibly SPINS FAST ON ITSELF while disappearing** — front crossing with bank-occludes-lender ~3557, mirrored boards on the far side 3560-3565, blues die mid-spin, bank carries alone to 3573 with its facade returning, the paper turns beneath and lands exactly, the wall fan rides the tail. Nothing pops.

**Honest residuals / r8 leads:** (a) our cluster projects ~110px left of the ref's spin pivot (screen 282 vs 395) through the exit window — the KNOWN exit-whip common-mode camera offset (r6: off-limits), and our orbit radius (~200u from the rigid B3D layout) exceeds the ref's ~125px — both are camera/world registration, not spin grammar; closing them means an exit-whip camera refit (out of this lane's scope, camera untouched per brief). (b) The ref's late-arriving gridlines lean steeper (~30-40°) than our uniform PHI0=25° — per-line measured lean keys would close it. (c) The orbiting yellow-road survivor (negative above) — needs a measured track. (d) 3572-3578 spends could partially recover if (a) ever closes.
