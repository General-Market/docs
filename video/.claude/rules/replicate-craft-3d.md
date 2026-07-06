# Replica craft — 3D pose, camera, and ink (field instruments)

Distilled from the IRSwap/Realist campaigns (2026-07-01..05). Read with `replicate-method.md` (the loop + lessons); this file is the instrument bench for 3D/pose/ink work. Worked instruments live in `.claude/rounds/work/` (fitcomm.py generic GN pose fitter, plqedge.py, campb.py, rectify.py); reference implementation: `src/compositions/replicates/irswap/lib/camera.ts` (one world, one continuous camera; handoffs inside frozen-frozen clamp windows so pose AND velocity are continuous).

## Lens & pose

- **Lens first, then poses.** Homography-implied focal from a tracked planar quad. Wrong-focal solves "fit" corners at 1–3px while forcing contorted poses (camera below the floor) and wrong border geometry. Move focal changes inside a whiteout/occlusion — the ref hides its cuts there too.
- **4 corners determine a plane's whole projection** — and always "fit" under enough DOF. Gate on border/extent geometry and lens, never on corner residual alone.
- **Bound LM solves to the physical camera family.** Unbounded 7-DOF Levenberg-Marquardt lands in mirror basins; a second scene element disambiguates (a floor page seen from below would be backface).
- **One-way ICP against a longer curve degenerates** into a slide with fake-low RMS — always evaluate the reverse term.

## Camera paths & seams

- **Per-frame Gauss-Newton grid solve** (cx,cz,yaw) on tracked gridlines: 11px → 0.25px RMS. Extract as a reusable solver (solveGridCam) and re-run per chapter; taper yaw to exactly 0 at region handoffs so downstream frames stay byte-identical.
- **C1 continuity or "the house moves".** Lerped camera keys give C0 paths whose projected-velocity steps (0.3 px/f is visible) read as *object* motion. Catmull-Rom passes through keys so datum evals stay bit-identical. Negative: Savitzky-Golay key smoothing = systematic bias.
- **PCHIP for closing rotations** — a 0→360° spin must not overshoot closure mid-segment (Catmull-Rom can cross 360).
- **Structural identity at seams.** Place the object at its FINAL pose and rotate by θ; remove the transform wrapper outside the window (rotation.y=−2π leaves 2.4e-16 float residue). Prove every seam with md5/byte-identical stills at the walls.
- **When no rigid camera exists** (hand-animated per-element recede), prove it before spending rounds: per-cell flow, LK solve WITH visual audit of surviving tracks (they once sat on the icons — the "camera" was the icons), element-vs-floor split solves, direction check. Then freeze the camera and key the elements.
- **Ref camera cuts hidden behind an edge-on frame:** render it the same way — two mounts crossfading behind the blade, paired element A/B swap.

## Screen ↔ world instruments

- **Camera-Jacobian delta conversion.** Measured ref-vs-render screen deltas → world offsets through the Jacobian at the element's depth (bridge-aware where the camera has drift terms); release corrections from zero at window edges.
- **Screen-track pinning.** Scan a stable feature centroid per frame in ref space; pin the object via a per-frame world slide through the camera; freeze the delta past the handoff so crossfades see content on both sides.
- **Compound transforms invert exactly** (pitched camera + turntable pre-image + group yaw) — build the inverse so it reduces to the plain recipe at identity; the seam becomes structural.
- **Placement constants via esbuild**, not pixels: `esbuild --bundle` the TS module to cjs, evaluate under node. Scanning rendered stills for constants wasted rounds twice.

## Masks & scanners

- **Hue-window masks.** Plain b−r masks count neighboring same-hue ink and poison fits at fade frames; darker-than-median line masks survive luma humps. The eye adjudicates orientation — a scanner once read +47° rotation on a render.
- **Median-3 scan keys inside stable phases** — ±6-unit endpoint flutter lerps into visible 0.4s wobble; extend washed/partial ends from the last registered shape.
- **Fit by rendered-still SSIM grid search** when masks miss content the ref redraws — constrained to keep ink visibly on-frame: the unconstrained optimum evicts ink, because the metric rewards absence.
- **Edge-pair pose fit for boards/plaques** — angle-swept projection histogram finds the two long border edges → tilt+center+extent; self-validating (reproduces its own render's tilts); beat NCC tracking and text centroids.
- **Semi-billboard lean.** Hand-drawn icons under a steep overhead camera read "fallen over" as true-upright 3D; give each a measured base-pivot lean toward camera, blending upright as the camera dives. A sign flip once RAISED SSIM — the eye caught it.

## Ink & texture on surfaces

- **Stroke width is screen-space perpendicular.** Convert widths to surface units per segment orientation (a floor at pitch 10° foreshortens ~6×; vertical-converted widths render 6× fat on steep strokes). Matching cores with 3.5× fewer ink pixels = too thin, not too light.
- **Ribbons, not canvas strokes**, on anisotropic surfaces: build stroke outlines in screen space and unproject vertex by vertex — lineWidth caps bleed depth-sized width into screen-x (3× bbox balloons).
- **Ink demands an opaque underlay.** GL texture filtering bleeds transparent texels into strokes at grazing angles; ink on its own transparent plane loses before any ink difference exists.
- **Texture-canvas sliver.** Drawing logical w into a `round(w*res)` canvas leaves an edge sliver that mipmaps drag inward and alphaTest discards (white sparkle inside faces). Map the transform exactly; the honest fix family is alphaTest 0 + premultiplied alpha.
- **Single-sided planes cull past edge-on**, and "edge-on" under a pitched camera is 90°+pitch, not 90°. A rising page needs its white back plane; text canvases need pre-mirrored twin planes to read from behind.
- **Rectify-then-measure.** Unproject ref frames into flat surface space through the solved camera before measuring texture parameters (a hatch duty cycle read inverted from screen space).
- **Unwarp-to-artspec.** ECC-registered median unwarp of ref frames → trace elements in flat texture space (artspec.json) → de-wash every sampled fill by the composition's own grade overlay, or colors double-wash.

## Fades, grain, dissolves

- **Element-correspondence dissolve tables.** For multi-element dissolves, table per-element mask masses every ~4f (ref vs render): fade start / gone / ours / verdict — retime each element separately.
- **Fade probes.** Binary/3f-step opacity probes against ref frames retime ghosting fast (ours once ghosted 6–9f early).
- **Grain-freeze.** Find the ref's freeze frame by consecutive-frame mean|diff| collapse (1.4 → codec floor); clamp the grain clock there so the hold renders byte-identical.
- **SSIM is near-blind on bright washes** (luminance term ≈0.995 for a 24-level offset on near-white). Bright-region fixes ship on eye evidence; edge-feather caps can hide misplaced ink for rounds.

The metric finds the region; the instrument finds the cause; the eye signs the fix.
