// Frames 4690-5290: the community map (S13-S14). Big blue house and red
// bank drop onto a floor map sheet, yellow rays fan to a community of
// small buildings, a glass wireframe cube drops over the scene, the
// camera dives from overhead to eye level, the exchange arrows split at
// their jagged seam, then the camera pulls back out.
//
// Rebuild notes (measured from the reference, fit-community round 3):
// - The camera is a smooth piecewise-hermite path (entry settle, one
//   long overhead glide, ONE dive swoop 4905-4980, a near-still eye
//   hold, a fast eased pull-back). Solved from the bank-apex track;
//   the old per-frame key tables (and their dive jitter) are gone.
// - The source is a 2.5D collage: its overhead and eye-level shots are
//   provably inconsistent with any single rigid world (~60-100 px splits
//   under honest pitch bounds). Every icon is therefore PLANTED rigid at
//   a measured floor pose PER PHASE (reprojection <= ~8 px at every held
//   frame) and relocates exactly once, inside the dive swoop, on a
//   smoothstep - no per-frame anchor wobble anywhere.
// - The painted floor (sheet, grid, dashboard ink, fallen papers, floor
//   extension) is STATIC in world space for the whole scene; it only
//   fades in place. White pads are thin slab objects that ride their
//   buildings; rays and exchange arrows are world objects too (the
//   arrows on a camera-facing plane spanning the house-bank gap).
// - The glass cube is one world object with three measured poses
//   (overhead fit at 4830, room pose fit from the eye-level wall lines +
//   the 4913 pane crossing, pull-back pose from the 5240 corners),
//   blended during the dive and the pull-back. The foreground pane sweep
//   stays a screen-space overlay on its measured tracks: the reference's
//   own glass is not world-consistent, and the tracks are already smooth.

import React, { useCallback } from "react";
import * as THREE from "three";
import { clamp01, easeOutPow, lerp1 } from "../lib/helpers";
import type { Pt } from "../lib/helpers";
import { CanvasPlane, DCAM } from "../lib/world";
import type { V3 } from "../lib/world";
import { MiniBuilding } from "./Buildings3D";
import type { MiniSpec } from "./Buildings3D";

const FLOOR_Y = -170;
const fade = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1, b - a));
const fadeOut = (f: number, a: number, b: number) => 1 - fade(f, a, b);

const C = {
  blue: "#6AB9CB",
  blueLight: "#91D1E1",
  blueDark: "#2E7C90",
  red: "#E56575",
  redLight: "#F08B98",
  redDark: "#8E3644",
  ray: "#EEEDA6",
  sheet: "#ECECEC",
  chartRed: "#D98A95",
  door: "#CDEDF4",
  cube: "#BFBFBF",
  // Round-6 negative A/B: bolding the pad edges to the measured ref
  // cores (162-167 grey) and riding the icon-fix track LOST at every
  // overhead/eye gate (−.004..−.014 at 4820-5150) — our pad GEOMETRY
  // (big diamond slab) mismatches the ref's thin per-phase pad shapes,
  // so bolder+moved edges doubled the loss. Misplaced bold ink loses to
  // faint ink, 5th confirmation. Pads keep the soft ink and stay
  // anchored; reshaping them per phase is the open item.
  pad: "#FBFBF9",
  padEdge: "#E0E0DC",
} as const;

// ── camera: smooth piecewise-hermite path ────────────────────────
// Bank-anchored parametrization (u,v = bank apex screen track, W = bank
// pixel width -> depth). Values on [4685,4715] and [5265,5290] are
// bit-identical to the previous solve (frozen first/last keys + the
// frozen pitch segments) - boundary continuity into Slot and Outro.
//
// r8 PULL-BACK CAMERA UNLOCK: REFUTED (measured, do not retry blind —
// tracks in .claude/rounds/work/r8/cam/). The r8 frame-diff finding
// (ref pull-back 1.5-2x faster over 5208-5217) is REAL but NOT a
// camera: five instruments, LK floor tracks 5197-5262 solved per-frame
// against an additive (du,dv,dW) correction on this parametrization:
//  1. ref floor recedes 1.3-2.5x faster (per-cell Farneback, flowdec).
//  2. icons vs floor split: the floor clamped to the icon-implied dW
//     explodes 4.6->35px rms (dW 3-5x apart) — no shared camera.
//  3. WITHIN the floor: card-block vs sheet-grid split from ~5214 (the
//     best floor camera helps right-zone grid 45-60% but HURTS the
//     card zone: 24.9->29.1 @5218, 31.3->44.8 @5220).
//  4. direction disagreement: measured card deficit is +33..+54px
//     RIGHTWARD by 5217-5220; any solved camera moves cards mostly
//     DOWN (dv-dominated). A 4th pitch param: no help, degenerate.
//  5. the one clean "collapse" (rms 55->3-4) was points ON the icons —
//     whose recede ICON_FIX already keys per-element.
// The ref recede is hand-animated PER ELEMENT in one rough direction;
// only per-element measured tracks can chase it. The camera stays
// frozen; the un-keyed masses (E1-E3 card block deficit 15-50px over
// 5212-5240) are the remaining per-element targets.
const herm = (
  f: number, f0: number, f1: number, v0: number, v1: number, m0: number, m1: number,
): number => {
  const T = f1 - f0;
  const t = clamp01((f - f0) / T);
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * v0 +
    (t3 - 2 * t2 + t) * T * m0 +
    (-2 * t3 + 3 * t2) * v1 +
    (t3 - t2) * T * m1
  );
};

// segments: [f0, f1, v0, v1, m0, m1] - entry settle, glide, dive swoop,
// eye hold (linear drift), pull-back (two eased legs to the frozen key)
type Seg = [number, number, number, number, number, number];
const SEG_U: Seg[] = [
  [4715, 4770, 604, 626.7, 0, 0.41], [4770, 4905, 626.7, 682, 0.41, 0.41],
  [4905, 4980, 682, 608, 0.41, 0.0745], [4980, 5208, 608, 625.0, 0.0745, 0.0745],
  [5208, 5222, 625.0, 597, 0.0745, -2.3], [5222, 5240, 597, 569, -2.3, -1.27],
  [5240, 5265, 569, 534, -1.27, -1.0],
];
const SEG_V: Seg[] = [
  [4715, 4770, 194, 220.4, 0, -0.077], [4770, 4905, 220.4, 210, -0.077, -0.077],
  [4905, 4980, 210, 171.7, -0.077, -0.0322], [4980, 5208, 171.7, 164.2, -0.0322, -0.0322],
  [5208, 5222, 164.2, 178, -0.0322, 2.2], [5222, 5240, 178, 212, 2.2, 1.6],
  [5240, 5265, 212, 226, 1.6, 0.15],
];
const SEG_W: Seg[] = [
  [4715, 4770, 88, 100.6, 0, 0.16], [4770, 4905, 100.6, 128, 0.16, 0.30],
  [4905, 4980, 128, 183.5, 0.30, 0.0614], [4980, 5208, 183.5, 197.5, 0.0614, 0.0614],
  [5208, 5222, 197.5, 148, 0.0614, -4.6], [5222, 5240, 148, 86, -4.6, -2.2],
  [5240, 5265, 86, 55, -2.2, -0.55],
];
const seg = (S: Seg[], f: number): number => {
  const fc = Math.max(4715, Math.min(5265, f));
  for (const [f0, f1, v0, v1, m0, m1] of S) {
    if (fc <= f1) return herm(fc, f0, f1, v0, v1, m0, m1);
  }
  return S[S.length - 1][3];
};

// pitch (deg): frozen entry ramp 34/36/38 (keys 4685/4700/4722), hold,
// one eased dive 38->10, hold, eased rise 10->22 slope-matched into the
// frozen 22->30 segment (keys 5240/5271).
const pitchDeg = (f: number): number => {
  if (f <= 4685) return 34;
  if (f <= 4700) {
    const t = (f - 4685) / 15;
    return 34 + 2 * t;
  }
  if (f <= 4722) {
    const t = (f - 4700) / 22;
    return 36 + 2 * t;
  }
  if (f <= 4895) return 38;
  if (f <= 4978) return herm(f, 4895, 4978, 38, 10, 0, 0);
  if (f <= 5208) return 10;
  if (f <= 5240) return herm(f, 5208, 5240, 10, 22, 0, 8 / 31);
  if (f <= 5271) {
    const t = (f - 5240) / 31;
    return 22 + 8 * t;
  }
  return 30;
};

const P_BANK: V3 = [192, 20, 0];
const BANK_WORLD_W = 102;

const rx = (a: number, p: V3): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
};

export const camCommunity = (f: number): { cam: V3; pitch: number } => {
  const th = (pitchDeg(f) * Math.PI) / 180;
  const u = seg(SEG_U, f);
  const v = seg(SEG_V, f);
  const W = seg(SEG_W, f);
  const d = (DCAM * BANK_WORLD_W) / W;
  const q: V3 = [(d * (u - 427)) / DCAM, (d * (240 - v)) / DCAM, -d];
  const off = rx(-th, q);
  return { cam: [P_BANK[0] - off[0], P_BANK[1] - off[1], P_BANK[2] - off[2]], pitch: th };
};

// unproject screen (u,v) at frame f onto the floor plane → world (x,z)
const toFloor = (u: number, v: number, f: number): Pt => {
  const { cam, pitch } = camCommunity(f);
  const dir = rx(-pitch, [(u - 427) / DCAM, (240 - v) / DCAM, -1]);
  const t = (FLOOR_Y - cam[1]) / dir[1];
  return [cam[0] + dir[0] * t, cam[2] + dir[2] * t];
};

// ── phase blend: everything relocates once, inside the dive ──────
const smooth01 = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const diveT = (f: number) => smooth01((f - 4914) / 68); // 4914-4982 (delayed: ref icons hold overhead pose longer mid-dive)
const mixN = (a: number, b: number, t: number) => a + (b - a) * t;

// ── planted buildings: rigid pose per phase (fit-community3) ─────
// spec = eye-phase dims; over pose renders through the [kx,ky] scale.
// Reprojection of every base/top anchor lands within ~8 px of the
// measured icon at every held frame of its own phase.
type CommB = {
  over: { x: number; z: number; kx: number; ky: number };
  eye: { x: number; z: number; k?: number };
  spec: MiniSpec;
  padW: number;
  lean?: number; // overhead base-pivot lean toward the camera (rad, ≤0)
};
// Round-4 pose refits (fitcomm.py): connected-component silhouettes scanned
// in ref at 4775/4820/4880 (overhead glide) and 5000/5100/5200 (eye hold),
// poses solved through the ported camera by Gauss-Newton.
//   house over joint fit rms 4.8px (old pose: base 63px low on screen)
//   bank  over joint fit rms 3.4px; eye (x,z,H) rms 2.2px (was 17px short)
//   cbs   over joint fit rms 6.0px; eye (x,z,k) exact at 5100
const WB: Record<string, CommB> = {
  house: {
    over: { x: 25.3, z: -143.14, kx: 0.505, ky: 0.508 },
    eye: { x: -119.5, z: -423.8 },
    spec: { kind: "house", W: 167.0, L: 130.5, H: 178.8, eaveFrac: 0.62, fill: C.blue, fillTop: C.blueLight, outline: C.blueDark, strokeW: 4, door: { u0: 0.37, u1: 0.63, top: 0.53, fill: C.door }, chimney: true },
    padW: 1.6,
    lean: -0.22,
  },
  bank: {
    over: { x: 228.93, z: -53.06, kx: 0.543, ky: 0.644 },
    eye: { x: 274.2, z: -320.7 },
    spec: { kind: "temple", W: 188.5, L: 32, H: 182.1, eaveFrac: 0.58, fill: C.red, outline: "#787E7C", strokeW: 4.5, cols: { n: 5, fill: "#FFFFFF" }, strip: true },
    padW: 1.6,
    lean: -0.45,
  },
  t1: {
    over: { x: -205.4, z: -207.8, kx: 0.442, ky: 0.442 },
    eye: { x: -695.8, z: -624.3 },
    spec: { kind: "temple", W: 130.0, L: 89.7, H: 154.2, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 4, fill: "#FFFFFF" }, strip: true },
    padW: 1.85,
    lean: -0.35,
  },
  cbs: {
    over: { x: -210.6, z: -49.6, kx: 0.30, ky: 0.631 },
    eye: { x: -746.7, z: -306.0 },
    spec: { kind: "box2", W: 144.3, L: 108.0, H: 170, eaveFrac: 0, fill: C.blue, outline: C.blueDark },
    padW: 1.85,
    lean: -0.2,
  },
  t2: {
    over: { x: -135.1, z: -263.9, kx: 0.442, ky: 0.585 },
    eye: { x: -555.0, z: -782.8, k: 0.92 },
    spec: { kind: "temple", W: 122.8, L: 95.7, H: 111.8, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 5, fill: "#FFFFFF" }, strip: true },
    padW: 1.85,
    lean: -0.35,
  },
  t3: {
    over: { x: -40.3, z: -288.0, kx: 0.478, ky: 0.645 },
    eye: { x: -559.3, z: -1290.6 },
    spec: { kind: "temple", W: 100.8, L: 82.9, H: 97.6, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 3, fill: "#FFFFFF" }, strip: true },
    padW: 1.85,
    lean: -0.35,
  },
};
// Per-building screen-tracked world slides through the overhead glide
// (round 4): the reference re-poses its icons along the glide faster than
// any constant world pose projects (bank cx drift −6→+7px 4775→4880) —
// residuals of the joint fits, converted to floor-plane world deltas at
// each key frame, interpolated, and released through the dive blend.
const OVSLIDE: Record<string, [number, number, number][]> = {
  // [f, dx, dz] world units (residuals of the lean-refit joint fits;
  // 4950 keys measured mid-dive against the ref components; the release
  // to zero lives IN the table — by 4990 the eye poses stand alone)
  bank: [[4715, -6.0, -9.1], [4775, -6.0, -9.1], [4820, -2.7, -0.2], [4880, 6.6, 6.0], [4905, 6.6, 6.0], [4950, 7.0, 11.0], [4990, 0, 0]],
  house: [[4715, -6.6, -7.3], [4775, -6.6, -7.3], [4820, 1.9, -0.6], [4880, 3.3, 6.3], [4905, 3.3, 6.3], [4950, 10.4, -8.8], [4990, 0, 0]],
};
const slideAt = (name: string, f: number): Pt => {
  const rows = OVSLIDE[name];
  if (!rows) return [0, 0];
  const dx = lerp1(rows.map((r) => [r[0], r[1]] as [number, number]), f);
  const dz = lerp1(rows.map((r) => [r[0], r[2]] as [number, number]), f);
  return [dx, dz];
};

// ── round-6 per-frame icon registration (scanicons.py, ref vs the r5
// render at every 10f) ─────────────────────────────────────────────
// [f, dx, dy, kx, ky]: world x-slide, world y-sink (better conditioned
// than a depth slide for vertical screen registration under the low eye
// pitch), and direct width/height scale ratios about the base center.
// Measured: the ref redraws the bank continuously — its height runs
// 7-13% over ours through every phase (red-mask extents, arrows
// excluded), and through the pull-back the ref bank shrinks and drops
// FASTER than the rigid world projects (rh→0.72, base +36px by 5245).
// A depth-slide decomposition of the same screen residuals needed
// dz≈+160/k≈0.62 rows by 5245 (ill-conditioned); the y-sink form stays
// local. First row identity — frames ≤4726 render the exact r5 tree.
// Rows refined CLOSED-LOOP (scanv2.py): first-pass rows rendered as a
// 4690-5290 segment, residuals re-measured ref-vs-render with identical
// masks/windows both sides (the open-loop pass had mask-topology bias:
// ref's roof+body connect into one red CC, ours split — it read the size
// gap as a 20px shift). Loop findings: the ref bank is ~20% WIDER at
// overhead (the pediment sprawl), ~6-8% wider + ~2% taller through the
// eye hold than the first-pass rows produced, and the eye-hold dx had
// overshot ~7px.
// Zone adjudication by still gates (the scans and the metric disagreed
// at the icon level — the gates decide):
//   overhead (≤4905): ZEROED. Both the first-pass rows and the full
//     closed-loop rows (ref bank ~20% wider / ~13% taller there) LOST
//     −.002..−.007 at 4820/4880 — a bigger icon carries more
//     misregistered edge length under ±3-5px scan noise; the metric is
//     the finer instrument. (Negative A/B, kin of misplaced-bold-ink.)
//   dive (4910-4950): full closed-loop rows — won +.003 at 4935.
//   eye hold (4970-5195): HALF the closed-loop delta — the full rows
//     lost −.005..−.015 at 5000/5100 (same edge-noise mechanism).
//   pull-back (5205-5245): full rows — the big win (+.013/+.017 at
//     5215/5240; the ref bank shrinks and drops faster than the rigid
//     world projects, rh→0.72, base +36px by 5245).
const ICON_FIX: Record<string, [number, number, number, number, number][]> = {
  // Width scale (kx) is CLAMPED to ~1 through dive+eye: every kx>1.05
  // variant lost its gates (the widened columns/edges carry more
  // misregistered length than the width deficit costs). The dive-exit /
  // eye-entry zone 4960-5050 rejects EVERY bank correction tried (full,
  // half, kx-clamped: −.005..−.010 at the 5000 gate) — identity plateau.
  // 5100 keeps the one row the gates repeatedly preferred over the
  // scan-derived value (SSIM's optimum sits ~8px right of the scanned
  // icon alignment — the bare-sheet background biases it; revisit after
  // the ink layer lands).
  bank: [
    [4900, 0, 0, 1, 1],
    [4910, 5.8, 7.7, 1.0, 1.164],
    [4930, 4.9, 7.7, 1.0, 1.122],
    [4950, 1.0, 0.0, 1.0, 1.09],
    [4965, 0, 0, 1, 1],
    [5050, 0, 0, 1, 1],
    [5100, 8.4, -10.9, 1.015, 1.082],
    [5150, 5.0, -7.0, 1.03, 1.07],
    [5205, 3.7, -10.7, 1.088, 1.114],
    [5220, 2.7, -21.8, 0.938, 0.941],
    [5230, -6.8, -45.8, 0.799, 0.868],
    [5240, -10.9, -60.4, 0.708, 0.786],
    // r7: rows extended 5245-5260 — the ref bank keeps sinking after the
    // r6 rows end (its base HOLDS at screen y≈288 on the sheet edge while
    // the rigid projection keeps rising: residual dv +8→+26 px measured
    // ref-vs-render at 5f steps; red-mask bbox bottom-centers, converted
    // through the camera Jacobian on top of the 5240 row).
    [5245, 0.0, -77.0, 0.727, 0.742],
    [5250, 0.0, -92.1, 0.708, 0.738],
    [5255, -6.8, -109.2, 0.708, 0.734],
    [5260, -5.2, -128.0, 0.708, 0.73],
    // r8 close-out: fresh rows 5264-5278 (the a3ca1ccaa unblock). The ref
    // bank does NOT die in place — it rises with the bridge camera and
    // slides LEFT fast through its kill (pose-mask bc 531->404 screen over
    // 5270-5277, w 50->28) while our clamped 5260 row sat pinned at 539.
    // Same-mask ref-vs-render bbox deltas via the bridge-aware Jacobian
    // (campb.py) where both masks live (5262-5275), ref-chained beyond;
    // median-3; keys every ~3f (work/r8/cam/t2fit.py, t2pose.json).
    [5264, -13.1, -110.5, 0.708, 0.702],
    [5267, -21.1, -86.6, 0.637, 0.674],
    [5270, -31.7, -51.2, 0.61, 0.642],
    [5273, -119.8, -16.4, 0.607, 0.584],
    [5276, -291.4, 9.8, 0.354, 0.509],
    [5278, -394.1, 33.1, 0.392, 0.39],
  ],
  // house: dx/dy only (the eye-phase blue-mask width is side-face
  // confounded, so scale stays 1; left-edge + base tracked instead).
  // Kept zone: the ref house LEADS our diveT relocation left by ~10px
  // around 4910-4935 and overshoots right by 4950-4980 — rows ride the
  // dive window only; the eye-hold rows lost at gates and are zeroed.
  house: [
    [4900, 0, 0, 1, 1],
    [4905, -2.3, -1.3, 1, 1],
    [4920, -3.7, -1.3, 1, 1],
    [4935, -3.7, -1.2, 1, 1],
    [4950, 5.5, -1.2, 1, 1],
    [4965, 9.5, -1.2, 1, 1],
    [4980, 5.2, -0.6, 1, 1],
    [4995, 0, 0, 1, 1],
    // r7 pull-back rows (the STEP-0 map's #1 mass, worst diff cells 45-47
    // at 5230): through the pull-back the ref house shrinks and drops far
    // faster than the rigid world projects — by 5240 the ref draws it 70px
    // wide where ours renders 108 (ratio 0.65) and 34px lower. Same
    // grammar as the r6 bank rows. Measured every 5f (blue-mask bboxes
    // ref-vs-render, bottom-center matched, world deltas via the camera
    // Jacobian at the eye base; dx/kx median-3 against scan noise).
    // Identity held through the eye hold (eye rows lost their gates in
    // r6); the ramp starts only at 5205 as the pull-back begins.
    [5205, 0, 0, 1, 1],
    [5215, 25.9, -7.8, 0.869, 0.963],
    [5220, 59.6, -13.9, 0.869, 0.868],
    [5225, 62.2, -27.4, 0.862, 0.789],
    [5230, 78.7, -43.5, 0.862, 0.712],
    [5235, 94.3, -59.1, 0.831, 0.656],
    [5240, 123.7, -68.9, 0.648, 0.625],
    [5245, 131.6, -83.9, 0.633, 0.585],
    [5250, 140.3, -95.6, 0.593, 0.54],
    [5255, 140.3, -117.8, 0.585, 0.521],
    [5260, 136.3, -114.1, 0.585, 0.533],
    // r8 close-out fresh rows (see the bank block note): the ref house
    // keeps RISING through the bridge to its kill (pose-mask bc y
    // 260->218 over 5264-5273) where the stale 5260 clamp barely moved.
    [5264, 133.6, -102.1, 0.665, 0.511],
    [5267, 133.4, -71.6, 0.612, 0.521],
    [5270, 128.0, -41.3, 0.557, 0.509],
    [5273, 122.3, 1.0, 0.643, 0.533],
    [5274, 122.3, 1.0, 0.658, 0.527],
  ],
  // r7 pull-back cluster re-assembly (STEP-0 discovery, unnamed by any
  // prior round): as the camera pulls out the ref RE-GATHERS the whole
  // community — a compact group (box + temples) enters from frame-left
  // 5216-5230, slides right onto the sheet, shrinks, and fades away
  // 5240-5256, while our render kept two stragglers (t2/t3) floating
  // high-left until the 5262 fade. Ref component tracks measured at 5f
  // steps (blue-mask CCs, identities from the 5220-5240 crops: entering
  // pair = cbs box + t1 temple; the temple sliding right through the
  // group = t2; t3 tucks in beside the house and hides behind it by
  // ~5237). t2 rows scan-vs-scan; t3/cbs/t1 rows vs the analytic raw
  // projection (they are invisible in the baseline render), k eased ~7%
  // for the outline-mask bias.
  t2: [
    // r7 overhead height: ours renders 20-27% taller than the ref temple
    // through the whole glide (closed-loop CC scan: rh 0.73-0.82 steady,
    // bottoms and widths matching within a few px) — pure ky about the
    // base, released into the dive.
    [4715, 0, 0, 1, 0.76],
    [4900, 0, 0, 1, 0.8],
    [4914, 0, 0, 1, 1],
    [5212, 0, 0, 1, 1],
    [5220, 101.8, -57.2, 0.9, 0.966],
    [5225, 166.7, -89.0, 0.75, 0.793],
    [5230, 220.2, -129.6, 0.649, 0.741],
    [5235, 259.1, -171.5, 0.636, 0.783],
    [5240, 278.2, -189.0, 0.5, 0.45],
  ],
  t3: [
    // r7 overhead height (same instrument: rh 0.64-0.77 steady)
    [4715, 0, 0, 1, 0.68],
    [4820, 0, 0, 1, 0.68],
    [4900, 0, 0, 1, 0.77],
    [4914, 0, 0, 1, 1],
    [5214, 0, 0, 1, 1],
    [5222, 266.4, -192.8, 1.0, 0.95],
    [5225, 260.3, -231.7, 1.0, 0.92],
    [5230, 286.2, -294.2, 0.94, 0.86],
    [5235, 324.2, -345.2, 0.82, 0.73],
  ],
  cbs: [
    [5225, 288.2, -69.9, 0.5, 0.7],
    [5230, 332.3, -64.5, 0.58, 0.55],
    [5235, 374.4, -67.6, 0.48, 0.54],
    [5240, 405.0, -66.8, 0.49, 0.56],
    [5245, 436.0, -71.9, 0.46, 0.43],
    [5250, 444.2, -104.6, 0.45, 0.4],
  ],
  t1: [
    [5220, 130.0, -62.6, 0.91, 0.67],
    [5225, 191.3, -107.3, 0.75, 0.63],
    [5230, 251.1, -142.0, 0.79, 0.73],
    [5235, 291.3, -174.1, 0.69, 0.7],
    [5240, 322.8, -191.5, 0.65, 0.63],
  ],
};
type IconFix = { dx: number; dy: number; kx: number; ky: number };
const iconFixAt = (name: string, f: number): IconFix => {
  const rows = ICON_FIX[name];
  if (!rows) return { dx: 0, dy: 0, kx: 1, ky: 1 };
  const at = (i: 1 | 2 | 3 | 4) => lerp1(rows.map((r) => [r[0], r[i]] as [number, number]), f);
  return { dx: at(1), dy: at(2), kx: at(3), ky: at(4) };
};
const wbAt = (b: CommB, f: number, name?: string) => {
  const t = diveT(f);
  const ke = b.eye.k ?? 1;
  const [sx, sz] = name ? slideAt(name, f) : [0, 0];
  return {
    x: mixN(b.over.x, b.eye.x, t) + sx,
    z: mixN(b.over.z, b.eye.z, t) + sz,
    kx: mixN(b.over.kx, ke, t),
    ky: mixN(b.over.ky, ke, t),
  };
};

// two vacant community pads (rays end on empty lots in the source);
// they ride the cluster's relocation like their neighbours
// eye poses extrapolated by the cluster's measured relocation (scale 2.26
// about t2) — both project off frame-left at eye level, as in the source
const VACANT = [
  { over: { x: -179.5, z: -269.2 }, eye: { x: -637.3, z: -763.1 } },
  { over: { x: -176.5, z: -100.4 }, eye: { x: -630.6, z: -381.6 } },
];
const VAC_W = 176; // eye-phase pad width (scales by kCluster at overhead)
const K_CLUSTER = 0.442;

// PER-ELEMENT relocation for the floor DASHBOARD ink (round 4). The
// reference's 2.5D collage moves each dashboard element with the
// buildings between shots, but NOT under one shared similarity — round
// 2's single-similarity A/B lost to the static plant (.7329 vs .7352 at
// f5100). Round 4 measured each element's own eye-phase quad off the
// f5100 reference (bandL/bandR crops) and fits one world similarity PER
// ELEMENT: overhead screen corners (@4810, the original measurement
// frame) → eye screen corners (@5100), both unprojected to the floor.
// Every element rides its own transform, blended with the same diveT as
// the buildings.
const simWorld = (over: Pt[], eye: Pt[]): ((p: Pt) => Pt) => {
  const P = over.map(([u, v]) => toFloor(u, v, 4810));
  const Q = eye.map(([u, v]) => toFloor(u, v, 5100));
  let cpx = 0, cpz = 0, cqx = 0, cqz = 0;
  for (let i = 0; i < P.length; i++) {
    cpx += P[i][0]; cpz += P[i][1]; cqx += Q[i][0]; cqz += Q[i][1];
  }
  cpx /= P.length; cpz /= P.length; cqx /= Q.length; cqz /= Q.length;
  let sxx = 0, sxy = 0, spp = 0;
  for (let i = 0; i < P.length; i++) {
    const px = P[i][0] - cpx, pz = P[i][1] - cpz;
    const qx = Q[i][0] - cqx, qz = Q[i][1] - cqz;
    sxx += px * qx + pz * qz;
    sxy += px * qz - pz * qx;
    spp += px * px + pz * pz;
  }
  const sc = Math.hypot(sxx, sxy) / spp;
  const th = Math.atan2(sxy, sxx);
  const c = sc * Math.cos(th), sn = sc * Math.sin(th);
  return (pp: Pt): Pt => [
    cqx + c * (pp[0] - cpx) - sn * (pp[1] - cpz),
    cqz + sn * (pp[0] - cpx) + c * (pp[1] - cpz),
  ];
};
// measured eye quads (screen @5100): two grey cards read as one union
// mass for E1; the wide pale-teal strip is E3; the wave squiggle maps by
// its two endpoints.
const SIM_E1 = simWorld(
  [[330, 300], [398, 303], [396, 345], [328, 342]],
  [[50, 370], [205, 372], [210, 438], [55, 436]],
);
const SIM_E2 = simWorld(
  [[405, 302], [490, 306], [488, 350], [403, 346]],
  [[215, 377], [317, 378], [322, 422], [220, 421]],
);
const SIM_E3 = simWorld(
  [[150, 375], [260, 380], [256, 430], [146, 424]],
  [[82, 422], [280, 424], [285, 460], [87, 458]],
);
const SIM_WAVE = simWorld(
  [[500, 345], [680, 418]],
  [[347, 417], [495, 480]],
);

// hex color lerp for the eye-phase pale ink
const mixc = (a: string, b: string, t: number): string => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
};

// ── floor: static painted map (never moves; fades in place only) ─
const FLOOR_C: Pt = [0, -150];
// Round-5 measured street track (the bottom band's bold dashed rule).
// A single world-locked track fit f5100 (+.0013) but LOST every other
// gate (−.002 each): the camera drifts ~2 px across the eye hold while
// the ref street drops ~0.09 px/f — the hand-drawn ref REDRAWS the
// street every shot, and again through the pull-back. Therefore the
// track is KEYFRAMED: line cores scanned per frame (scanstreets2.py,
// ink[150,205) neutral), unprojected to the floor at that frame, dash
// phase fitted mod 44.5 against the mid anchor (capture .93-.99 across
// the hold). Between keys the world line lerps; before 4950 and after
// 5230 it clamps. Measured bows were ≤4.5 wu (~2 px) — dropped, the
// per-key line is straight.
type StKey = { f: number; mid: Pt; u: Pt; off: number };
const ST_KEYS: StKey[] = [
  { f: 4950, mid: [159.9, -17.8], u: [0.9764, 0.216], off: 33.5 },
  { f: 5000, mid: [31.2, -59.1], u: [0.9891, 0.1471], off: 30.5 },
  { f: 5100, mid: [73.1, -39.7], u: [0.9906, 0.137], off: 36.0 },
  { f: 5150, mid: [35.0, -39.1], u: [0.9915, 0.1305], off: 32.5 },
  { f: 5200, mid: [-53.8, -43.5], u: [0.993, 0.1181], off: 35.0 },
  { f: 5220, mid: [217.6, -61.2], u: [0.9814, 0.192], off: 10.0 },
  { f: 5230, mid: [219.3, -70.8], u: [0.9685, 0.2491], off: 10.0 },
];
const stTrack = (f: number): StKey => {
  const K = ST_KEYS;
  if (f <= K[0].f) return K[0];
  if (f >= K[K.length - 1].f) return K[K.length - 1];
  let i = 0;
  while (K[i + 1].f < f) i++;
  const a = K[i];
  const b = K[i + 1];
  const t = (f - a.f) / (b.f - a.f);
  const ux = mixN(a.u[0], b.u[0], t);
  const uz = mixN(a.u[1], b.u[1], t);
  const n = Math.hypot(ux, uz);
  return {
    f,
    mid: [mixN(a.mid[0], b.mid[0], t), mixN(a.mid[1], b.mid[1], t)],
    u: [ux / n, uz / n],
    off: mixN(a.off, b.off, t),
  };
};
// param (rel. mid) where the track crosses the sheet's right edge s2→s3
const stExit = (k: StKey, s2: Pt, s3: Pt): number => {
  const ex = s3[0] - s2[0];
  const ez = s3[1] - s2[1];
  const den = k.u[0] * ez - k.u[1] * ex;
  if (Math.abs(den) < 1e-9) return Infinity;
  return ((s2[0] - k.mid[0]) * ez - (s2[1] - k.mid[1]) * ex) / den;
};
const ST_DASH: [number, number] = [26.7, 17.8]; // fitted dash/gap (wu), period 44.5
const ST_PERIOD = ST_DASH[0] + ST_DASH[1];
const ST_P0 = 380; // draw start param before mid (covers the frame at every key)
const ST_W = 2.0; // measured stroke (~2-3 px screen at the band)
const ST_INK = "#BDBDBD"; // measured dash cores 185-193

// ── round-6 red squiggle: measured per-frame world track (scansq.py) ──
// The old 8-vertex hard zigzag (m10 + SIM_WAVE) is retired: the ref draws
// a SOFT continuous wiggle (rounded bumps) with a red DASHED companion
// offset below-left, and REDRAWS it per shot — the world track slides
// across the sheet through the glide (start z +35→−38 over 4720-4900),
// holds near-static through the eye phase (±3 wu after temporal median),
// then jumps right and washes out through the pull-back. Scanned with a
// dusty-red mask chained per column, unprojected through toFloor at each
// key frame; 32 equal-arc world points per key, pointwise-lerped between
// keys (20f glide / 10f dive / 30f eye hold / 10f pull-back; the partial
// washed pull-back detections were extended with the registered 5210
// shape). Stroke cores + widths sampled strict-mask per phase.
type SqKey = { f: number; doff: Pt; pts: number[] };
const sqInterp = (K: SqKey[], f: number): { pts: Pt[]; doff: Pt } => {
  const mk = (k: SqKey): { pts: Pt[]; doff: Pt } => ({
    pts: Array.from({ length: k.pts.length / 2 }, (_, i) => [k.pts[2 * i], k.pts[2 * i + 1]] as Pt),
    doff: k.doff,
  });
  if (f <= K[0].f) return mk(K[0]);
  if (f >= K[K.length - 1].f) return mk(K[K.length - 1]);
  let i = 0;
  while (K[i + 1].f < f) i++;
  const a = K[i];
  const b = K[i + 1];
  const t = (f - a.f) / (b.f - a.f);
  return {
    pts: Array.from({ length: a.pts.length / 2 }, (_, j) => [
      mixN(a.pts[2 * j], b.pts[2 * j], t),
      mixN(a.pts[2 * j + 1], b.pts[2 * j + 1], t),
    ] as Pt),
    doff: [mixN(a.doff[0], b.doff[0], t), mixN(a.doff[1], b.doff[1], t)],
  };
};
// width (wu) and stroke core by phase: overhead ~2px dusty, eye bolder
// ~3.6px screen and more saturated, pull-back washes toward the sheet
// widths bumped +0.4-0.5 closed-loop (round 6): with the scan-measured
// widths the CanvasPlane pipeline (res 0.9 + texture filtering) rendered
// only ~99 strict-red pixels at 4850 vs the ref's 350 (cores matched
// within 2-4 levels; the footprint was thin, not light)
const SQ_W: [number, number][] = [
  [4710, 2.6], [4900, 2.7], [4940, 2.9], [4980, 3.15], [5210, 3.15],
  [5225, 2.8], [5240, 2.4],
];
const SQ_INK: [number, number, number, number][] = [
  [4750, 224, 196, 200], [4810, 219, 189, 192], [4880, 219, 188, 192],
  [4930, 215, 182, 185], [4975, 217, 176, 181], [5200, 221, 175, 177],
  [5220, 222, 180, 181], [5230, 226, 203, 203], [5240, 239, 218, 222],
];
const sqInkAt = (f: number): string => {
  const ch = (i: 1 | 2 | 3) => Math.round(lerp1(SQ_INK.map((r) => [r[0], r[i]] as [number, number]), f));
  return `rgb(${ch(1)},${ch(2)},${ch(3)})`;
};
const SQ_DASH: [number, number] = [5.2, 4.4]; // companion dash/gap (wu)
const SQ_KEYS: SqKey[] = [
  { f: 4710, doff: [-1.8, 7.7], pts: [62.2, 79.6, 68.5, 78.0, 74.0, 80.6, 78.8, 83.8, 84.3, 87.1, 90.2, 90.5, 96.2, 93.8, 102.2, 97.1, 107.5, 101.3, 112.3, 104.8, 117.5, 109.3, 122.7, 113.8, 127.8, 118.3, 133.0, 122.7, 138.8, 125.1, 142.6, 129.3, 144.9, 134.6, 149.1, 139.0, 155.8, 140.2, 162.6, 141.6, 168.1, 144.3, 171.8, 148.5, 175.5, 152.8, 179.6, 156.4, 184.1, 159.2, 189.8, 162.0, 195.8, 163.4, 202.6, 163.4, 208.7, 164.8, 215.4, 165.6, 221.8, 167.9, 228.1, 169.0] },
  { f: 4720, doff: [-1.8, 7.7], pts: [85.4, 40.8, 92.2, 41.7, 98.9, 42.4, 104.0, 47.3, 109.0, 52.2, 114.1, 57.1, 119.2, 62.0, 124.5, 65.4, 126.1, 71.2, 127.3, 77.4, 128.9, 83.3, 130.9, 88.8, 132.2, 94.9, 137.0, 97.6, 142.7, 95.3, 149.1, 96.5, 154.2, 99.2, 156.7, 104.5, 159.8, 109.3, 165.2, 112.7, 171.5, 115.9, 177.7, 117.7, 180.0, 123.3, 183.1, 128.0, 187.2, 132.2, 192.3, 136.6, 197.2, 141.6, 204.3, 141.6, 211.0, 142.2, 217.4, 143.3, 222.5, 147.3, 228.9, 148.7] },
  { f: 4740, doff: [-1.8, 7.7], pts: [85.5, 19.2, 92.6, 20.9, 99.3, 21.5, 100.4, 28.8, 105.8, 36.1, 112.9, 38.5, 119.5, 41.3, 124.5, 44.1, 127.6, 47.5, 128.2, 54.4, 129.9, 60.5, 131.6, 66.7, 133.1, 72.9, 138.1, 77.5, 144.5, 76.0, 150.7, 74.4, 155.3, 78.0, 157.6, 84.0, 160.8, 88.8, 167.1, 92.1, 173.7, 95.6, 178.7, 99.9, 183.3, 103.7, 186.6, 108.6, 190.8, 112.9, 195.9, 117.4, 201.3, 121.4, 207.9, 122.8, 215.3, 122.8, 221.4, 125.7, 227.8, 128.3, 234.8, 126.9] },
  { f: 4760, doff: [-1.8, 7.7], pts: [84.3, -9.3, 90.8, -7.6, 97.4, -5.9, 99.9, 0.6, 101.8, 7.2, 107.2, 10.4, 114.0, 13.2, 121.5, 15.2, 126.6, 19.1, 130.2, 24.3, 131.3, 32.1, 132.2, 39.9, 134.3, 46.5, 141.4, 47.4, 149.3, 47.4, 154.6, 50.2, 157.8, 55.5, 161.0, 60.8, 165.1, 66.1, 171.6, 67.8, 178.3, 67.8, 182.0, 73.5, 185.2, 78.9, 188.9, 84.2, 194.2, 87.4, 199.0, 91.5, 206.1, 92.8, 213.1, 94.2, 220.2, 95.5, 225.2, 99.2, 232.0, 100.9, 239.6, 99.5] },
  { f: 4780, doff: [-1.8, 7.7], pts: [80.7, -16.9, 86.8, -13.9, 92.5, -11.7, 97.8, -5.2, 99.9, 0.4, 105.7, 3.8, 113.3, 5.4, 121.2, 6.9, 124.5, 13.1, 128.0, 17.7, 129.6, 25.6, 130.1, 33.1, 131.6, 40.1, 138.5, 42.0, 146.7, 40.6, 153.2, 43.0, 156.4, 48.8, 158.3, 55.4, 163.5, 59.3, 168.6, 61.5, 175.9, 61.5, 181.3, 65.4, 183.2, 71.9, 186.6, 77.3, 191.2, 82.0, 197.4, 85.1, 203.7, 88.1, 210.9, 88.0, 218.1, 89.3, 224.9, 92.7, 231.3, 94.5, 239.3, 94.5] },
  { f: 4800, doff: [-1.7, 7.4], pts: [76.8, -19.8, 83.4, -16.9, 89.0, -13.6, 94.0, -8.0, 97.4, -2.3, 100.8, 3.5, 108.9, 3.5, 116.2, 5.0, 121.3, 9.8, 125.4, 15.3, 126.6, 22.3, 128.1, 30.3, 130.2, 36.4, 135.1, 40.5, 143.3, 39.9, 150.6, 40.6, 154.2, 46.4, 155.2, 53.4, 159.8, 57.2, 165.4, 60.6, 173.6, 61.5, 179.1, 64.4, 182.0, 70.3, 184.4, 76.3, 189.0, 81.4, 195.6, 84.3, 201.8, 87.8, 210.0, 87.8, 217.4, 89.0, 223.6, 92.7, 230.9, 94.3, 238.8, 94.0] },
  { f: 4820, doff: [-1.6, 7.1], pts: [74.3, -21.3, 81.6, -19.7, 87.7, -16.6, 91.5, -10.4, 94.2, -4.3, 99.3, -0.1, 107.5, 2.5, 114.9, 2.9, 120.3, 8.4, 124.2, 14.6, 125.4, 22.1, 126.6, 30.3, 129.4, 36.4, 134.1, 38.3, 142.5, 38.3, 150.3, 38.3, 152.4, 44.2, 155.2, 50.4, 158.2, 56.8, 164.5, 59.6, 172.9, 59.6, 178.5, 64.1, 180.2, 70.4, 184.8, 75.4, 189.9, 80.1, 195.3, 84.2, 201.1, 86.3, 209.5, 87.3, 217.1, 87.3, 223.4, 90.4, 230.0, 92.1, 238.7, 92.1] },
  { f: 4840, doff: [-1.7, 6.6], pts: [72.9, -26.0, 79.3, -21.5, 86.9, -19.7, 90.5, -13.5, 92.5, -6.1, 98.1, -2.3, 106.6, -2.3, 113.5, 1.5, 120.1, 6.2, 122.3, 13.2, 124.2, 20.2, 125.8, 27.1, 127.6, 34.6, 135.1, 36.5, 143.1, 35.0, 149.4, 37.9, 152.0, 44.4, 154.9, 50.8, 160.3, 55.1, 167.2, 57.0, 175.8, 57.0, 178.5, 63.3, 180.0, 70.7, 186.1, 74.8, 191.2, 79.2, 197.1, 82.7, 203.5, 83.9, 211.4, 85.1, 217.1, 86.2, 223.4, 88.9, 230.6, 90.7, 238.9, 89.8] },
  { f: 4860, doff: [-1.7, 5.7], pts: [71.8, -28.1, 79.1, -25.7, 86.1, -21.8, 89.2, -15.8, 91.2, -8.3, 95.7, -5.1, 104.3, -3.7, 112.1, -0.9, 118.7, 4.1, 121.8, 10.3, 123.0, 17.9, 124.5, 25.8, 127.0, 32.0, 133.0, 33.8, 141.0, 32.5, 147.6, 32.5, 150.7, 39.1, 153.3, 45.6, 158.1, 50.2, 164.1, 53.9, 172.8, 53.9, 177.2, 58.7, 179.3, 65.9, 184.1, 70.6, 189.2, 75.3, 195.0, 77.6, 202.1, 79.9, 210.1, 82.2, 216.8, 80.8, 222.5, 84.5, 230.6, 86.7, 238.2, 86.7] },
  { f: 4880, doff: [-1.6, 6.3], pts: [77.4, -27.3, 84.0, -25.7, 87.3, -20.8, 89.9, -13.5, 93.5, -10.5, 100.5, -8.4, 108.6, -4.8, 116.1, -0.9, 120.2, 4.7, 121.8, 11.6, 124.2, 18.5, 126.3, 25.8, 129.4, 28.8, 136.1, 30.6, 143.4, 29.4, 149.2, 31.2, 150.8, 38.6, 153.8, 43.4, 159.4, 46.6, 165.7, 50.0, 173.7, 49.3, 177.7, 55.4, 179.8, 61.5, 184.4, 66.0, 189.3, 70.8, 195.0, 74.1, 202.1, 76.3, 210.6, 75.2, 218.3, 77.0, 223.3, 80.7, 230.6, 81.8, 238.4, 81.8] },
  { f: 4900, doff: [-1.7, 6.3], pts: [79.3, -32.6, 84.6, -27.9, 89.3, -22.9, 93.0, -17.1, 97.9, -13.1, 105.5, -12.3, 112.3, -9.5, 117.4, -5.3, 120.8, 0.6, 123.2, 7.5, 124.5, 15.0, 127.7, 21.0, 132.6, 25.1, 139.2, 23.9, 145.6, 24.0, 149.4, 27.3, 152.0, 33.7, 155.9, 38.9, 160.2, 43.6, 168.1, 44.5, 175.5, 45.8, 179.2, 51.2, 181.6, 57.6, 186.4, 62.3, 191.7, 66.5, 197.6, 70.0, 204.9, 71.4, 213.4, 71.4, 220.6, 73.0, 226.1, 77.0, 233.7, 76.7, 238.6, 79.3] },
  { f: 4910, doff: [-1.9, 6.9], pts: [69.1, -47.6, 74.9, -42.3, 79.8, -35.6, 85.6, -30.8, 88.4, -24.4, 95.7, -25.4, 103.7, -24.9, 110.7, -22.7, 114.6, -17.3, 117.4, -11.4, 120.0, -5.3, 120.9, 2.0, 123.3, 8.3, 124.7, 15.5, 132.8, 15.7, 140.0, 13.3, 146.2, 14.5, 148.9, 20.7, 151.3, 27.0, 154.1, 33.2, 161.5, 34.7, 169.7, 34.7, 174.7, 38.4, 178.1, 43.8, 180.8, 50.1, 185.4, 55.0, 190.7, 58.3, 196.7, 61.5, 204.3, 62.5, 212.2, 61.5, 218.5, 64.2, 224.1, 67.8] },
  { f: 4920, doff: [-1.9, 7.6], pts: [81.5, -40.9, 86.5, -39.2, 91.3, -36.7, 98.2, -36.7, 104.3, -35.4, 109.0, -32.6, 113.4, -28.7, 116.7, -23.9, 119.0, -18.8, 120.2, -12.8, 121.0, -6.8, 122.1, -0.8, 124.4, 4.3, 129.9, 6.1, 135.4, 3.7, 141.8, 2.5, 146.1, 5.2, 148.2, 10.3, 150.6, 15.5, 151.2, 21.5, 155.6, 25.2, 162.6, 25.2, 169.5, 25.2, 174.3, 27.3, 177.2, 32.0, 178.8, 37.5, 182.3, 41.7, 186.0, 45.4, 190.2, 48.7, 194.6, 51.9, 200.9, 52.9, 207.6, 51.9] },
  { f: 4930, doff: [-1.7, 6.9], pts: [63.9, -76.5, 65.0, -69.4, 71.9, -66.3, 78.8, -63.3, 82.5, -58.3, 85.6, -52.8, 91.1, -49.9, 97.9, -51.3, 103.7, -48.5, 109.9, -46.5, 113.1, -41.0, 116.7, -36.0, 118.2, -29.8, 119.2, -23.1, 120.3, -16.5, 122.3, -10.7, 125.7, -6.1, 133.1, -6.2, 138.6, -9.8, 144.8, -9.8, 146.6, -4.0, 149.0, 1.7, 150.9, 7.6, 153.5, 13.2, 160.2, 14.3, 167.0, 15.5, 173.8, 16.6, 176.8, 21.7, 178.8, 27.6, 182.5, 32.4, 187.1, 36.5, 192.1, 39.9] },
  { f: 4940, doff: [-1.6, 9.3], pts: [71.2, -73.4, 73.5, -79.6, 76.2, -75.0, 77.9, -69.0, 80.7, -63.9, 85.1, -59.9, 90.8, -61.7, 96.0, -61.4, 102.1, -59.9, 107.5, -58.0, 110.1, -52.8, 112.9, -47.7, 115.5, -42.6, 116.1, -35.6, 117.2, -29.5, 118.4, -23.4, 119.8, -17.7, 123.8, -13.9, 129.2, -16.4, 135.1, -18.6, 141.3, -20.2, 143.9, -15.5, 146.0, -10.1, 148.2, -4.8, 151.5, -0.2, 155.1, 4.2, 161.3, 5.4, 168.2, 5.4, 172.3, 9.0, 175.0, 13.5, 177.5, 18.3, 180.3, 21.3] },
  { f: 4950, doff: [-1.6, 10.3], pts: [57.2, -91.8, 64.1, -91.1, 68.4, -86.9, 70.3, -81.1, 72.8, -75.7, 74.7, -69.5, 79.8, -66.6, 85.8, -68.6, 92.1, -69.3, 97.5, -66.6, 102.7, -63.6, 104.9, -57.7, 107.4, -52.1, 109.6, -46.6, 110.7, -40.3, 112.8, -34.7, 113.9, -28.3, 115.0, -22.0, 119.6, -18.4, 124.6, -15.9, 127.7, -21.3, 133.3, -23.5, 138.6, -25.6, 139.4, -19.2, 141.7, -13.7, 144.3, -8.6, 147.8, -3.8, 151.8, 0.1, 158.4, 0.9, 164.1, -1.4, 169.0, 0.9, 171.2, 6.6] },
  { f: 4960, doff: [-0.7, 8.6], pts: [40.3, -101.2, 44.2, -96.1, 49.2, -92.7, 55.1, -94.4, 59.6, -90.8, 61.5, -84.7, 63.3, -78.5, 65.9, -73.1, 69.3, -68.0, 75.3, -67.8, 80.8, -70.2, 87.4, -69.5, 92.0, -66.4, 95.9, -62.5, 99.2, -57.3, 102.4, -52.3, 104.1, -46.5, 105.4, -40.2, 106.5, -33.9, 107.9, -27.8, 110.0, -22.1, 113.6, -17.6, 119.4, -19.8, 124.1, -23.9, 129.7, -26.5, 133.7, -22.6, 136.3, -17.6, 137.8, -11.5, 140.4, -6.3, 143.7, -1.6, 148.3, 1.4, 154.9, 0.2] },
  { f: 4970, doff: [-0.2, 10.4], pts: [34.9, -86.1, 37.1, -90.5, 41.2, -92.2, 47.2, -91.1, 52.7, -92.8, 55.8, -87.7, 57.5, -81.7, 59.6, -76.0, 61.7, -70.1, 65.2, -65.5, 71.8, -65.5, 77.5, -67.0, 83.2, -68.5, 87.9, -65.4, 92.3, -62.0, 95.4, -57.0, 98.0, -51.9, 99.4, -46.0, 101.5, -40.7, 102.9, -34.8, 104.0, -28.8, 105.3, -22.8, 107.5, -17.6, 112.5, -15.2, 117.1, -18.9, 121.6, -22.6, 126.1, -26.4, 129.8, -23.0, 132.0, -17.7, 133.8, -12.3, 135.9, -7.0, 140.2, -3.4] },
  { f: 4980, doff: [0.0, 8.4], pts: [35.9, -90.1, 39.0, -94.0, 44.7, -95.1, 50.0, -94.3, 54.6, -92.5, 57.4, -87.2, 59.5, -81.5, 61.5, -75.5, 64.1, -69.9, 68.3, -66.3, 73.0, -69.0, 79.7, -69.3, 86.2, -68.8, 90.9, -65.5, 95.1, -61.8, 97.9, -56.6, 99.9, -50.9, 101.4, -44.8, 103.3, -39.3, 103.3, -32.5, 103.3, -25.6, 103.3, -18.8, 105.3, -13.8, 108.3, -17.4, 114.1, -17.6, 118.7, -21.1, 123.4, -24.6, 127.3, -28.7, 130.9, -24.9, 132.9, -19.4, 134.8, -13.9, 138.4, -9.1] },
  { f: 5010, doff: [-0.2, 9.4], pts: [34.4, -91.0, 38.2, -94.3, 42.5, -96.1, 46.4, -93.9, 52.1, -95.3, 55.4, -90.6, 57.8, -85.0, 59.4, -78.7, 61.7, -73.4, 64.7, -68.5, 70.6, -67.9, 75.1, -70.3, 81.6, -70.9, 87.0, -68.7, 91.4, -65.3, 95.4, -61.3, 98.2, -56.4, 99.9, -50.2, 102.0, -44.6, 103.0, -37.7, 103.0, -30.6, 103.0, -23.5, 103.0, -16.4, 107.5, -17.6, 112.3, -18.8, 117.6, -21.2, 121.5, -25.9, 126.2, -29.8, 129.9, -26.6, 131.9, -21.1, 134.3, -15.6, 138.0, -10.9] },
  { f: 5040, doff: [-0.0, 9.8], pts: [32.9, -93.5, 36.7, -96.3, 40.1, -96.8, 45.6, -95.2, 51.0, -96.8, 54.6, -92.5, 56.5, -87.0, 58.3, -81.2, 60.6, -75.7, 63.3, -70.8, 68.5, -69.0, 73.9, -70.5, 79.3, -72.0, 84.8, -69.8, 89.0, -66.8, 93.6, -63.9, 95.6, -58.3, 98.2, -53.4, 100.5, -48.3, 101.8, -42.5, 103.0, -36.6, 104.3, -30.8, 106.2, -25.6, 108.2, -20.2, 114.0, -19.5, 117.7, -22.8, 121.7, -26.9, 125.4, -30.7, 129.5, -28.2, 131.4, -23.0, 133.2, -17.8, 136.4, -13.1] },
  { f: 5070, doff: [0.1, 9.5], pts: [32.9, -95.3, 36.9, -95.3, 41.7, -97.0, 48.0, -97.0, 53.0, -95.3, 54.9, -90.0, 56.7, -84.6, 58.6, -79.2, 61.3, -74.5, 63.6, -69.2, 69.1, -69.4, 73.7, -71.7, 79.9, -71.7, 86.2, -71.7, 89.6, -68.1, 93.5, -64.3, 95.4, -58.9, 97.7, -54.1, 99.2, -48.6, 101.3, -43.8, 102.4, -38.2, 103.6, -32.6, 105.0, -27.1, 106.9, -22.1, 111.7, -20.3, 116.1, -23.6, 120.0, -27.4, 123.6, -31.3, 128.8, -29.4, 130.8, -24.1, 132.9, -19.1, 136.0, -15.2] },
  { f: 5100, doff: [0.2, 9.7], pts: [31.6, -94.8, 35.4, -95.7, 37.7, -99.3, 42.5, -96.0, 47.3, -98.7, 52.6, -96.9, 53.8, -90.6, 55.6, -84.9, 57.7, -79.6, 60.2, -74.5, 63.8, -70.6, 70.3, -71.2, 75.5, -72.7, 81.2, -73.5, 85.4, -70.6, 90.0, -67.7, 93.2, -63.3, 95.4, -58.2, 98.1, -53.0, 99.7, -47.5, 101.1, -42.0, 102.2, -36.1, 103.5, -30.2, 105.7, -25.0, 109.2, -21.2, 114.5, -23.6, 118.5, -27.3, 123.2, -29.9, 127.1, -31.5, 129.4, -27.0, 131.4, -21.9, 134.4, -17.2] },
  { f: 5130, doff: [0.3, 10.2], pts: [32.5, -102.1, 36.9, -99.7, 41.9, -97.3, 45.7, -100.1, 50.1, -98.8, 52.2, -93.4, 54.5, -88.1, 56.6, -82.8, 58.7, -77.4, 61.5, -72.7, 65.9, -71.8, 71.9, -72.5, 76.4, -74.8, 82.2, -73.0, 86.5, -70.7, 90.5, -67.4, 93.5, -62.7, 96.0, -57.7, 98.4, -52.7, 99.7, -46.9, 101.0, -41.1, 102.2, -35.4, 104.2, -30.2, 105.6, -24.4, 110.2, -22.2, 115.3, -24.5, 119.0, -27.9, 122.3, -26.0, 125.9, -31.7, 128.6, -28.6, 130.1, -23.2, 134.1, -19.2] },
  { f: 5160, doff: [0.2, 9.6], pts: [34.1, -101.5, 38.6, -98.8, 44.8, -98.8, 49.6, -99.0, 51.9, -94.4, 53.8, -89.1, 55.5, -83.8, 57.5, -78.5, 60.3, -73.9, 64.4, -71.3, 68.7, -73.5, 74.3, -74.2, 80.4, -74.2, 85.1, -71.9, 89.3, -69.2, 92.0, -64.6, 94.7, -60.0, 96.8, -55.3, 98.3, -49.8, 99.4, -44.4, 100.6, -38.9, 102.2, -33.6, 104.0, -28.7, 106.2, -24.1, 111.0, -22.8, 114.8, -26.4, 118.0, -30.5, 121.9, -33.8, 126.5, -34.6, 127.9, -29.3, 129.6, -24.3, 133.7, -21.2] },
  { f: 5190, doff: [0.3, 9.8], pts: [31.1, -95.7, 33.0, -99.2, 37.4, -99.9, 42.8, -99.5, 48.2, -100.3, 50.6, -95.2, 52.5, -90.0, 54.2, -84.7, 56.1, -79.4, 59.0, -75.0, 63.9, -73.1, 69.0, -74.5, 74.2, -76.0, 80.2, -76.0, 84.5, -73.1, 88.7, -69.9, 91.5, -65.4, 94.2, -60.9, 96.4, -56.2, 97.7, -50.8, 99.0, -45.4, 100.1, -40.0, 101.4, -34.6, 103.4, -29.8, 105.8, -25.1, 111.4, -24.9, 115.5, -28.4, 118.7, -32.4, 122.6, -35.4, 126.7, -33.5, 127.9, -28.5, 131.1, -23.8] },
  { f: 5210, doff: [0.2, 9.7], pts: [31.2, -95.9, 32.5, -101.7, 36.0, -100.9, 41.2, -99.1, 46.7, -100.3, 50.3, -99.1, 52.5, -93.6, 54.3, -87.9, 56.5, -82.6, 58.9, -77.4, 62.3, -73.1, 67.2, -73.0, 72.1, -75.4, 77.3, -76.8, 82.2, -74.7, 86.7, -72.0, 90.5, -68.4, 93.5, -63.6, 95.8, -58.6, 97.4, -53.0, 99.0, -47.4, 100.3, -41.8, 101.7, -36.2, 103.6, -30.7, 106.0, -25.7, 111.6, -24.5, 115.6, -28.5, 119.2, -32.9, 123.8, -36.0, 127.4, -32.7, 129.0, -27.2, 132.4, -22.7] },
  { f: 5220, doff: [0.2, 9.7], pts: [37.4, -56.2, 38.7, -62.0, 42.2, -61.2, 47.4, -59.4, 52.9, -60.6, 56.6, -59.4, 58.7, -53.9, 60.5, -48.2, 62.7, -42.9, 65.2, -37.7, 68.5, -33.3, 73.4, -33.3, 78.3, -35.7, 83.5, -37.1, 88.4, -35.0, 92.9, -32.3, 96.7, -28.7, 99.7, -23.9, 102.1, -18.9, 103.7, -13.3, 105.2, -7.7, 106.5, -2.1, 107.9, 3.5, 109.8, 9.0, 112.2, 14.0, 117.8, 15.2, 121.8, 11.2, 125.4, 6.8, 130.0, 3.7, 133.7, 7.1, 135.2, 12.6, 138.7, 17.0] },
  { f: 5230, doff: [0.2, 9.7], pts: [43.4, -3.4, 44.8, -9.2, 48.3, -8.4, 53.4, -6.5, 58.9, -7.8, 62.6, -6.6, 64.8, -1.0, 66.6, 4.6, 68.8, 9.9, 71.2, 15.1, 74.6, 19.5, 79.5, 19.6, 84.3, 17.2, 89.6, 15.7, 94.5, 17.8, 98.9, 20.5, 102.7, 24.1, 105.7, 28.9, 108.1, 33.9, 109.7, 39.6, 111.3, 45.1, 112.6, 50.8, 114.0, 56.4, 115.8, 61.8, 118.3, 66.8, 123.9, 68.1, 127.8, 64.1, 131.5, 59.7, 136.1, 56.5, 139.7, 59.9, 141.3, 65.4, 144.7, 69.8] },
  { f: 5240, doff: [0.2, 9.7], pts: [52.6, 31.0, 54.0, 25.2, 57.5, 26.0, 62.6, 27.9, 68.1, 26.6, 71.8, 27.8, 73.9, 33.4, 75.8, 39.0, 78.0, 44.3, 80.4, 49.5, 83.8, 53.9, 88.7, 54.0, 93.5, 51.5, 98.8, 50.1, 103.7, 52.2, 108.1, 54.9, 111.9, 58.5, 114.9, 63.3, 117.3, 68.3, 118.9, 73.9, 120.5, 79.5, 121.8, 85.1, 123.2, 90.8, 125.0, 96.2, 127.5, 101.2, 133.1, 102.5, 137.0, 98.5, 140.7, 94.1, 145.3, 90.9, 148.9, 94.3, 150.5, 99.8, 153.9, 104.2] },
];
// ── r8 eye-phase pad PLATES (grid triage finding) ────────────────
// ssim-grid over 5199/5205/5214 + 5100/5150: the worst persistent cells
// of the eye hold and the 5199-5214 valley (r4c2 −0.02, r4c4 0.12,
// r3/r4 c5, r3c2) share one mass — the ref sets each hero icon on a
// BRIGHT WHITE PLATE (core 253 vs sheet 236, ~250×55 px each) while our
// render leaves grey floor there. The r7 pad-EDGE strokes ride measured
// tracks over that grey, so they read as detached cast shadows — a dark
// rim on grey is a shadow; on white it is a pad. The r6/r7 pad
// negatives were about bolding OUR diamond-slab geometry; these are the
// REF's plate polygons, column-profiled at 5100/5205 (front edges from
// grey-profiles; the flood-extreme corners had the bank BL 17px high
// and the house right side 25px long), carried to the other keys by the
// clean L/TL corner tracks + measured width scale, unprojected at the
// current frame. Past f5211 they freeze in WORLD space (unproject at
// 5211): floor stickers riding the pull-back, gone by ~5217 (bank) /
// ~5222 (house, white-mask decay).
// PLACEMENT NEGATIVE (r8, measured): drawing plates+strokes on their
// own transparent floor CanvasPlane above the rays lost −.003..−.005 at
// every eye gate BEFORE any ink difference — at pitch 10° the GL
// texture filtering bleeds transparent texels into strokes on a
// transparent plane (T1/T2 isolation, work/r8/comm/). Strokes only
// survive on an OPAQUE underlay → everything stays in this canvas; the
// rays are occluded by erasing the plate polygon in RaysPlane instead.
type PlateKey = [number, number[]];
const trkPts = (keys: PlateKey[], fc: number): Pt[] => {
  let i = 0;
  const f = Math.max(keys[0][0], Math.min(keys[keys.length - 1][0], fc));
  while (i < keys.length - 2 && keys[i + 1][0] < f) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const t = clamp01((f - a[0]) / (b[0] - a[0]));
  return Array.from({ length: a[1].length / 2 }, (_, j) =>
    [mixN(a[1][2 * j], b[1][2 * j], t), mixN(a[1][2 * j + 1], b[1][2 * j + 1], t)] as Pt);
};
// HOUSE: BL, TL, TR, R, BR (the right side bows: TR→R→BR)
const HOUSE_PLATE: PlateKey[] = [
  [5000, [132, 318, 158, 269, 368, 278, 372, 285, 325, 329]],
  [5100, [119, 322, 146, 271, 365, 280, 369, 288, 320, 333]],
  [5150, [113, 325, 140, 273, 363, 282, 367, 290, 317, 336]],
  [5205, [106, 328, 134, 275, 361, 284, 365, 293, 314, 339]],
  [5211, [125, 322, 152, 272, 368, 280, 372, 288, 324, 333]],
];
// BANK: BL, TL, TR, R (the front edge BL→R is straight in the ref)
const BANK_PLATE: PlateKey[] = [
  [5000, [484, 338, 500, 282, 720, 294, 724, 344]],
  [5100, [486, 342, 503, 284, 732, 296, 736, 349]],
  [5150, [486, 343, 503, 284, 736, 296, 740, 350]],
  [5205, [485, 345, 503, 284, 743, 297, 747, 352]],
  [5211, [489, 342, 506, 284, 735, 296, 739, 349]],
];
const plateAlpha = (f: number): number =>
  fade(f, 4985, 4998) * fadeOut(f, 5213, 5221);
export const SheetFloor: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    if (f >= 5285) return; // page-flip handoff to the outro board
    // the map dissolves ahead of the page-flip: all the sheet's ink fades
    // uniformly, reaching 0 at 5285 (multiplied into every alpha below)
    const dissolve = 1 - clamp01((f - 5262) / 23);
    // Per-element relocation rides the dive (round 4): each dashboard
    // element follows its own measured over→eye similarity (SIM_E1..E3,
    // SIM_WAVE above). Round 2's single shared similarity lost its A/B;
    // the per-element quads measured at f5100 win it (see round log).
    const dv = diveT(f);
    // street morph completes at 4948 — the ref street rule is already
    // fully bold at f4950 (measured), well before the dive blend ends.
    // Through the pull-back the ref WASHES the street out (dash pixels
    // above threshold: 438 @5220 → 42 @5230 → 0 @5240), so the stroke
    // morphs back to the plain grid rule across 5222-5240 — at 5240 the
    // render is exactly the pre-street baseline again.
    const sv = smooth01((f - 4914) / 34) * (1 - clamp01((f - 5222) / 18));
    ctx.globalAlpha = dissolve;
    // crossfade in from the slot-scene floor paper (full by 4708)
    ctx.globalAlpha *= clamp01((f - 4690) / 18);
    const mx = (p: Pt) => w / 2 + (p[0] - FLOOR_C[0]);
    const my = (p: Pt) => h / 2 + (p[1] - FLOOR_C[1]);
    const m75 = (pts: Pt[]) => pts.map(([u, v]) => toFloor(u, v, 4775));
    const m10 = (pts: Pt[]) => pts.map(([u, v]) => toFloor(u, v, 4810));
    const m40 = (pts: Pt[]) => pts.map(([u, v]) => toFloor(u, v, 5040));
    const m5250 = (pts: Pt[]) => pts.map(([u, v]) => toFloor(u, v, 5250));
    const path = (pts: Pt[], close: boolean) => {
      ctx.beginPath();
      ctx.moveTo(mx(pts[0]), my(pts[0]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(mx(pts[i]), my(pts[i]));
      if (close) ctx.closePath();
    };
    const poly = (pts: Pt[], fill: string | null, stroke: string | null, lw = 1.4) => {
      path(pts, true);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    };
    // ── floor extension beyond the sheet's front-right edge (static;
    //    the sheet is painted after it and wins where they overlap)
    poly(m40([[260, 330], [880, 330], [880, 500], [200, 500]]), "#ECECEB", null);
    ctx.strokeStyle = "#DBDBD8";
    ctx.lineWidth = 1.2;
    for (const [a, b] of [
      [[430, 345], [330, 490]], [[560, 345], [520, 490]], [[690, 345], [710, 490]], [[810, 345], [880, 470]],
    ] as [Pt, Pt][]) {
      path(m40([a, b]), false);
      ctx.stroke();
    }
    // ── the fallen dashboard papers in front of the sheet (static).
    // Round-6 negative A/B (kept out): replacing this set with the
    // measured 4810 paper quads + a white under-band LOST −.003..−.005 at
    // 4750/4820/4880 twice — the ref REDRAWS the papers per shot (the
    // paper-L edge slope at 4750 disagrees with any world-locked 4810
    // quad), the ref's frame corners are grey void ~218 (white fills
    // there lose), and even the mis-placed teal sub-card is photo-
    // metrically lucky against the void. The old set therefore stays
    // exactly as it was; the measured overlay below adds only elements
    // the ref actually has where we had nothing (bubble, red pieces,
    // ruled hairlines). Measured-paper-quad replacement needs per-shot
    // edge tracks — r7 item.
    {
      poly(m5250([[140, 330], [660, 335], [655, 460], [138, 452]]), "#FCFCFB", "#DCDCD8", 1.4);
      poly(m5250([[315, 340], [372, 342], [370, 356], [313, 354]]), "#C4C4C4", null);
      poly(m5250([[378, 342], [460, 345], [458, 365], [376, 362]]), "#D8EEF5", null);
      poly(m5250([[195, 385], [250, 388], [248, 415], [193, 412]]), "#D0EBF0", null);
      const sq2 = m5250([[470, 360], [500, 400], [524, 385], [556, 425], [582, 410], [608, 445], [620, 450]]);
      const gA = ctx.globalAlpha;
      ctx.globalAlpha = gA * (0.25 + 0.75 * diveT(f));
      path(sq2, false);
      ctx.strokeStyle = C.chartRed;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "#DDDDDA";
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const a = toFloor(475 + i * 16, 365, 5250);
        const b = toFloor(470 + i * 16, 448, 5250);
        ctx.beginPath();
        ctx.moveTo(mx(a), my(a));
        ctx.lineTo(mx(b), my(b));
        ctx.stroke();
      }
      const rl = m5250([[650, 340], [652, 455]]);
      path(rl, false);
      ctx.strokeStyle = "#D4A6A8";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = gA;
    }
    // ── round-6 overhead speech bubble (owner-named jar: "the teal
    // speech-bubble with outline + tail — ours is a pale blob at the
    // wrong spot"). The wrong pale blob (E3's overhead pass) is gone
    // (dv-gated above); this is the MEASURED bubble: quad scanned at
    // 4810 (PCA corners of the teal cc), fill core (208,235,238)
    // constant across the glide, world-locked within ±5px 4750-4900
    // plus a small keyed residual slide (bubble bbox scanned every 30f).
    // DELIBERATE PERCEPTUAL SPEND: ships at −.0008 avg on the overhead
    // gates (4750 .8244→.8236, 4820 .7488→.7479, 4880 .7221→.7215) —
    // per-cell MAD improves hugely (−2.4 @4750, −8.0 @4880 in its cell);
    // SSIM's structure term punishes any crisp edge against the ref's
    // soft render. The crisp outline variant lost double (−.0017 avg);
    // it ships fill-only.
    //
    // Round-6 negative A/Bs (kept OUT, measured tracks preserved):
    // - fallen-paper quads + white under-band (scanfrag.py @4810): the
    //   ref redraws the papers per shot and its frame corners are grey
    //   void ~218 — every variant lost −.003..−.005 at 4750-4880.
    // - ruled hairline block (anchor rule (-19,84.5)->(-139,265), pitch
    //   11 wu along (0.934,0.358), 11 lines): −.001..−.002 per gate.
    // - red pieces bottom-left (bold dash (-365.4,102.8)->(-354,108.7)
    //   w3.2 rgb(185,155,160); faint hair (-343.6,112.2)->(-258.5,152.3);
    //   diag (-311.1,41.2)->(-294.1,50.7); ref drops them by 4880).
    // - red vertical rule off the sheet's right edge, per-frame track
    //   [f,x0,z0,x1,z1]: [4720,314.7,83.9,263.2,245.6],
    //   [4750,319.2,50.0,270.7,196.0], [4780,324.4,21.4,273.2,168.2],
    //   [4810,326.1,12.8,273.4,157.5], [4840,331.5,-13.3,271.3,146.7],
    //   [4880,323.2,0.4,271.7,130.4] — a ~7px pale wash band (core
    //   211/197/198); crisp and soft variants both lost.
    // All four are real ref ink; each needs either per-shot redraw keys
    // or a soft-edge painter before the metric will accept it — r7.
    const ovA = fadeOut(f, 4914, 4960);
    if (ovA > 0) {
      const gA0 = ctx.globalAlpha;
      ctx.globalAlpha = gA0 * ovA;
      // residual slide (bubble-anchored; world units)
      const GD: [number, number, number][] = [
        [4720, 0.6, 42.1], [4750, 2.4, 4.5], [4780, 1.7, -4.8],
        [4810, 0, 0], [4840, 0.1, 6.8], [4880, 4.3, 13.4], [4905, 4.3, 13.4],
      ];
      const gdx = lerp1(GD.map((r) => [r[0], r[1]] as [number, number]), f);
      const gdz = lerp1(GD.map((r) => [r[0], r[2]] as [number, number]), f);
      const g = (p: Pt): Pt => [p[0] + gdx, p[1] + gdz];
      poly(([[-296.0, 54.8], [-207.0, 62.7], [-197.9, 118.0], [-281.2, 111.1]] as Pt[]).map(g),
        "rgb(208,235,238)", null);
      poly(([[-255.3, 111.1], [-230.7, 113.4], [-244.1, 129.4]] as Pt[]).map(g),
        "rgb(208,235,238)", null);
      ctx.globalAlpha = gA0;
    }
    // ── map sheet (anchor 4775) painted over extension + papers
    const sheet = m75([[88, 306], [362, 212], [717, 243], [455, 468]]);
    poly(sheet, C.sheet, "#DEDEDA", 1.6);
    ctx.save();
    path(sheet, true);
    ctx.clip();
    ctx.strokeStyle = "#DBDBD8";
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 5; i++) {
      const t = i / 6;
      const a: Pt = [sheet[0][0] + (sheet[1][0] - sheet[0][0]) * t, sheet[0][1] + (sheet[1][1] - sheet[0][1]) * t];
      const b: Pt = [sheet[3][0] + (sheet[2][0] - sheet[3][0]) * t, sheet[3][1] + (sheet[2][1] - sheet[3][1]) * t];
      ctx.beginPath();
      ctx.moveTo(mx(a), my(a));
      ctx.lineTo(mx(b), my(b));
      ctx.stroke();
    }
    // Round 5 (Task A): r4's A/B proved bolding the dashed rules IN PLACE
    // loses (−.006 at 5100/5150) — they sat at sheet-grid positions, not
    // the ref's street positions. The MIDDLE rule morphs onto the
    // KEYFRAMED measured street track (ST_KEYS above) by sv — identity
    // at sv=0; the outer two rules stay untouched.
    ctx.setLineDash([6, 6]);
    for (const i of [1, 3]) {
      const t = i / 4;
      const a: Pt = [sheet[0][0] + (sheet[3][0] - sheet[0][0]) * t, sheet[0][1] + (sheet[3][1] - sheet[0][1]) * t];
      const b: Pt = [sheet[1][0] + (sheet[2][0] - sheet[1][0]) * t, sheet[1][1] + (sheet[2][1] - sheet[1][1]) * t];
      ctx.beginPath();
      ctx.moveTo(mx(a), my(a));
      ctx.lineTo(mx(b), my(b));
      ctx.stroke();
    }
    {
      const t = 2 / 4;
      const a0: Pt = [sheet[0][0] + (sheet[3][0] - sheet[0][0]) * t, sheet[0][1] + (sheet[3][1] - sheet[0][1]) * t];
      const b0: Pt = [sheet[1][0] + (sheet[2][0] - sheet[1][0]) * t, sheet[1][1] + (sheet[2][1] - sheet[1][1]) * t];
      const tk = stTrack(f);
      const p0: Pt = [tk.mid[0] - tk.u[0] * ST_P0, tk.mid[1] - tk.u[1] * ST_P0];
      const p1: Pt = [tk.mid[0] + tk.u[0] * 300, tk.mid[1] + tk.u[1] * 300];
      const a: Pt = [mixN(a0[0], p0[0], sv), mixN(a0[1], p0[1], sv)];
      const b: Pt = [mixN(b0[0], p1[0], sv), mixN(b0[1], p1[1], sv)];
      ctx.setLineDash([mixN(6, ST_DASH[0], sv), mixN(6, ST_DASH[1], sv)]);
      // dash starts at track param tk.off + k·period; path starts at −ST_P0
      ctx.lineDashOffset = -(((tk.off + ST_P0) % ST_PERIOD) * sv);
      ctx.strokeStyle = mixc("#DBDBD8", ST_INK, sv);
      ctx.lineWidth = mixN(1.2, ST_W, sv);
      ctx.beginPath();
      ctx.moveTo(mx(a), my(a));
      if (sv > 0) {
        // keep the mid vertex (the morph pivots about the track anchor)
        const m0: Pt = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2];
        const m: Pt = [mixN(m0[0], tk.mid[0], sv), mixN(m0[1], tk.mid[1], sv)];
        ctx.lineTo(mx(m), my(m));
      }
      ctx.lineTo(mx(b), my(b));
      ctx.stroke();
      ctx.lineDashOffset = 0;
      ctx.strokeStyle = "#DBDBD8";
      ctx.lineWidth = 1.2;
    }
    ctx.setLineDash([]);
    // dashboard artwork on the map (overhead corners measured at f4810;
    // each element rides its OWN measured over→eye similarity)
    const blendSim = (sim: (p: Pt) => Pt) => (p: Pt): Pt => {
      const q = sim(p);
      return [mixN(p[0], q[0], dv), mixN(p[1], q[1], dv)];
    };
    const mE1 = (pts: Pt[]) => m10(pts).map(blendSim(SIM_E1));
    const mE2 = (pts: Pt[]) => m10(pts).map(blendSim(SIM_E2));
    const mE3 = (pts: Pt[]) => m10(pts).map(blendSim(SIM_E3));
    const wv = blendSim(SIM_WAVE);
    // Card inks re-sampled per phase (round 6, dashboard-zone histograms):
    // the ref's overhead grey is LIGHTER than the old #C9C9C9 (201) — grey
    // median 214 @4750-4810 washing to 222 by 4880 (the ref repaints the
    // cards paler through the glide); the old teal #CFEAF3 was too blue
    // (b 243 vs ref 224). Keyed tables land exactly on the r4-measured eye
    // values by 4990, so the eye hold renders byte-identical.
    const kInk = (rt: [number, number][], gt: [number, number][], bt: [number, number][]) =>
      `rgb(${Math.round(lerp1(rt, f))},${Math.round(lerp1(gt, f))},${Math.round(lerp1(bt, f))})`;
    poly(mE1([[330, 300], [398, 303], [396, 345], [328, 342]]),
      kInk([[4750, 214], [4880, 222], [4990, 223]], [[4750, 214], [4880, 222], [4990, 223]],
        [[4750, 214], [4880, 222], [4990, 223]]), null);
    poly(mE2([[405, 302], [490, 306], [488, 350], [403, 346]]),
      kInk([[4750, 202], [4880, 225], [4990, 223]], [[4750, 221], [4880, 236], [4990, 235]],
        [[4750, 224], [4880, 237], [4990, 238]]), null);
    // E3's "overhead" quad was actually the ref's speech bubble (round-6
    // finding): the wide teal strip exists only in the eye band, so it
    // fades in with the dive; the bubble is drawn as its own fragment.
    {
      const gA = ctx.globalAlpha;
      ctx.globalAlpha = gA * dv;
      poly(mE3([[150, 375], [260, 380], [256, 430], [146, 424]]), mixc("#CBE9EF", "#E2E9EB", dv), null);
      ctx.globalAlpha = gA;
    }
    // Round-6 negative A/B (kept out; measured data in
    // work/r6/ink/leaders.json): the ref's real ink here is a family of
    // ~22-33 leader hairlines with darker dot terminals running the
    // sheet's short axis (scanned pale-core sets at 4810 and 4880, plus
    // the 5 solid rules measured BOLDER in ref: bodies 2-4px, rendered
    // cores 185-215 vs ours 213-230). Replacing these ticks with the two
    // measured leader sets crossfaded mid-glide + upgrading the rules to
    // 1.9px #D2D2CF LOST at every gate (4750 −.0065, 4820 −.0040, 4935
    // −.0062, and −.006 at 5000/5100 where this tick residue + the thin
    // rules were quietly correct). The ref REDRAWS the leader set per
    // shot (nearest-neighbour world distance ~27wu between 4810/4880) —
    // like the street and the squiggle, only per-frame keyed tracks can
    // carry this ink, and that needs a per-line correspondence
    // instrument across the redraw scatter. r7 item.
    // tick columns under the chart — the reference's eye view drops them
    // (streets replace the ruled block), so they fade through the dive
    {
      const gA = ctx.globalAlpha;
      ctx.globalAlpha = gA * (1 - 0.85 * dv);
      ctx.strokeStyle = "#DDDDDA";
      ctx.lineWidth = mixN(1, 0.6, dv);
      for (let i = 0; i < 10; i++) {
        const a = wv(toFloor(505 + i * 18, 340, 4810));
        const b = wv(toFloor(500 + i * 18, 416, 4810));
        ctx.beginPath();
        ctx.moveTo(mx(a), my(a));
        ctx.lineTo(mx(b), my(b));
        ctx.stroke();
      }
      ctx.globalAlpha = gA;
    }
    // red squiggle: measured per-frame world track (SQ_KEYS above), drawn
    // as a smooth midpoint-quadratic curve; ref washes it out ~5242-5252
    {
      const sqk = sqInterp(SQ_KEYS, f);
      const sqa = fadeOut(f, 5242, 5252);
      if (sqa > 0) {
        const gA = ctx.globalAlpha;
        ctx.globalAlpha = gA * sqa;
        const curve = (pts: Pt[]) => {
          ctx.beginPath();
          ctx.moveTo(mx(pts[0]), my(pts[0]));
          for (let i = 1; i < pts.length - 1; i++) {
            const mid: Pt = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
            ctx.quadraticCurveTo(mx(pts[i]), my(pts[i]), mx(mid), my(mid));
          }
          ctx.lineTo(mx(pts[pts.length - 1]), my(pts[pts.length - 1]));
        };
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.strokeStyle = sqInkAt(f);
        const sw = lerp1(SQ_W, f);
        ctx.lineWidth = sw;
        curve(sqk.pts);
        ctx.stroke();
        // dashed companion at the measured world offset (below-left)
        ctx.setLineDash(SQ_DASH);
        ctx.lineWidth = sw * 0.62;
        curve(sqk.pts.map((p) => [p[0] + sqk.doff[0], p[1] + sqk.doff[1]] as Pt));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = gA;
      }
    }
    ctx.restore();
    // ── r7 eye-band measured ink set (the STEP-0 map's #3 mass: ref
    // plank-zone ink 54% <215 vs our 0.4-1.3%). Discrete trackable
    // elements scanned at 5000/5100/(5150)/5210 — all near-static through
    // the eye hold (zone stats constant), keyed screen endpoints lerped
    // then unprojected at the CURRENT frame (exact where measured):
    //   - bank pad outline: front-top edge core 129 w~3, second stroke
    //     ~12px below core ~150-160, right edge (the r6 negative was
    //     about bolding OUR pad geometry — this draws the REF's measured
    //     edges instead);
    //   - house pad bottom edge + right corner (core 165-167);
    //   - twin fanning rules right of the cards (cores 184-211);
    //   - the fallen-paper corner curve (measured @5100, static);
    //   - red dot (665,378) + pale red diagonal (677,398)->(713,458).
    // Faded in as the eye settles (4985-4998), released as the pull-back
    // re-pose begins (5212-5224, where the tracks end).
    {
      const eyeA = fade(f, 4985, 4998) * fadeOut(f, 5212, 5224);
      const plateA = plateAlpha(f);
      if (eyeA > 0 || plateA > 0) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // r8: past the last measured key the plates + their edge ink
        // freeze in WORLD space (unproject at 5211) — floor stickers
        // riding the pull-back flow, not screen-pinned through the fade
        const fw = Math.min(f, 5211);
        type K3 = [number, number[]]; // [f, flat point list u0,v0,u1,v1,...]
        const trkS = (keys: K3[]): Pt[] => trkPts(keys, fw);
        // r8: the white plates under the icons (the grid's biggest
        // persistent mass) — painted before the edge ink below
        if (plateA > 0) {
          ctx.globalAlpha = dissolve * clamp01((f - 4690) / 18) * plateA;
          ctx.fillStyle = "rgb(253,253,253)"; // sampled plate core
          for (const keys of [HOUSE_PLATE, BANK_PLATE]) {
            const sp = trkPts(keys, fw);
            const pts = sp.map(([u, v]) => toFloor(u, v, fw));
            ctx.beginPath();
            ctx.moveTo(mx(pts[0]), my(pts[0]));
            for (let i = 1; i < pts.length; i++) ctx.lineTo(mx(pts[i]), my(pts[i]));
            ctx.closePath();
            ctx.fill();
            // No drawn rim: the 253-on-236 tonal step is the ref's own
            // back-edge grammar; the dark FRONT edges are the measured
            // strokes below. A uniform 1.6px rim rendered 6x fat on the
            // steep sides (orientation trap, next comment) and lost
            // −.003..−.008 at every gate.
          }
        }
        if (eyeA > 0) {
        ctx.globalAlpha = dissolve * clamp01((f - 4690) / 18) * eyeA;
        // Stroke widths are SCREEN px; the floor is foreshortened ~6x
        // vertically at pitch 10° (r6 squiggle-width lesson). r8 FIX: a
        // stroke's thickness extends PERPENDICULAR to it in screen
        // space — r7 converted every width by the VERTICAL rate, right
        // for horizontal runs, ~6x fat for steep ones (the bank right
        // edge / house corner kink / red diagonal smears = the r7
        // strips' "cast shadows toward bottom-right"). Convert per
        // SEGMENT along its own screen perpendicular.
        const stroke = (sp: Pt[], ink: string, wpx: number) => {
          ctx.strokeStyle = ink;
          for (let i = 0; i < sp.length - 1; i++) {
            const a = sp[i];
            const b = sp[i + 1];
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            const q0 = toFloor(m[0], m[1], fw);
            const q1 = toFloor(m[0] - (b[1] - a[1]) / L, m[1] + (b[0] - a[0]) / L, fw);
            ctx.lineWidth = wpx * Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
            const wa = toFloor(a[0], a[1], fw);
            const wb = toFloor(b[0], b[1], fw);
            ctx.beginPath();
            ctx.moveTo(mx(wa), my(wa));
            ctx.lineTo(mx(wb), my(wb));
            ctx.stroke();
          }
        };
        const trk = trkS;
        stroke(trk([
          [5000, [482, 328, 734, 332]], [5100, [482, 330, 734, 328]], [5210, [488, 329, 740, 327]],
        ]), "rgb(138,138,138)", 3.0);
        stroke(trk([
          [5000, [512, 341, 722, 351]], [5100, [518, 344, 728, 354]], [5210, [524, 345, 734, 354]],
        ]), "rgb(168,168,168)", 1.8);
        stroke(trk([
          [5000, [703, 305, 728, 352]], [5100, [705, 298, 733, 354]], [5210, [699, 298, 742, 354]],
        ]), "rgb(150,150,150)", 2.4);
        stroke(trk([
          [5000, [180, 312, 335, 332, 350, 310]], [5100, [170, 316, 335, 334, 350, 309]],
          [5210, [170, 316, 335, 333, 350, 312]],
        ]), "rgb(172,172,172)", 3.0);
        stroke(trk([
          [5000, [420, 365, 640, 385]], [5100, [420, 364, 640, 384]], [5210, [420, 370, 640, 374]],
        ]), "rgb(200,200,200)", 2.2);
        stroke(trk([
          [5000, [420, 376, 655, 388]], [5100, [420, 377, 655, 388]], [5210, [420, 376, 655, 389]],
        ]), "rgb(205,205,205)", 2.0);
        // fallen-paper corner curve — r8 re-measured (grey-mask trace at
        // 5100/5205, static): runs (672,384)→(712,447), 2-3px
        stroke(trk([
          [5000, [672, 384, 684, 401, 694, 417, 704, 433, 712, 447]],
          [5210, [672, 384, 684, 401, 694, 417, 704, 433, 712, 447]],
        ]), "rgb(196,196,196)", 2.4);
        // red paper-edge band — r8 re-measured (dusty-red mask at
        // 5100/5205, static): a WIDE pale band (676,396)→(724,477)
        // reaching the frame bottom, ~4.7px perpendicular, core
        // (193,178,181). r7 drew it 3px-vertical-converted (~18px fat,
        // one of the "cast shadows") and stopped at y453.
        stroke(trk([
          [5000, [676, 396, 700, 436, 724, 477]],
          [5210, [676, 396, 700, 436, 724, 477]],
        ]), "rgb(193,178,181)", 4.7);
        // red dot terminal (drawn as a floor ellipse so it reads as a
        // round screen dot under the foreshortening)
        {
          const s = trk([[5000, [665.5, 380.5]], [5100, [664.5, 378.5]], [5210, [664.5, 376.5]]])[0];
          const c = toFloor(s[0], s[1], fw);
          const qh = toFloor(s[0] + 1, s[1], fw);
          const qv = toFloor(s[0], s[1] + 1, fw);
          ctx.fillStyle = "rgb(205,178,182)";
          ctx.beginPath();
          ctx.ellipse(mx(c), my(c), 3.4 * Math.hypot(qh[0] - c[0], qh[1] - c[1]),
            3.4 * Math.hypot(qv[0] - c[0], qv[1] - c[1]), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        }
      }
    }
    // the street rule runs past the sheet's right edge onto the floor
    // extension (ref dashes reach x≈719 at f5100; the sheet clip cuts the
    // in-sheet stroke). Drawn unclipped from the per-frame sheet-exit
    // param (runtime intersection — it swings 158→385 across the keys),
    // alpha-gated by sv — invisible (identity) at sv=0. Dash phase is
    // continued from the in-sheet stroke.
    if (sv > 0) {
      const tk = stTrack(f);
      const q0p = stExit(tk, sheet[2], sheet[3]);
      if (q0p < 290) {
        ctx.globalAlpha = dissolve * clamp01((f - 4690) / 18) * sv;
        ctx.strokeStyle = ST_INK;
        ctx.lineWidth = ST_W;
        ctx.setLineDash(ST_DASH);
        ctx.lineDashOffset = -((((tk.off - q0p) % ST_PERIOD) + ST_PERIOD) % ST_PERIOD);
        const q0: Pt = [tk.mid[0] + tk.u[0] * q0p, tk.mid[1] + tk.u[1] * q0p];
        const q1: Pt = [tk.mid[0] + tk.u[0] * (q0p + 140), tk.mid[1] + tk.u[1] * (q0p + 140)];
        ctx.beginPath();
        ctx.moveTo(mx(q0), my(q0));
        ctx.lineTo(mx(q1), my(q1));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
    }
  }, []);
  return (
    <CanvasPlane frame={frame} width={1700} height={1500} res={0.9}
      position={[FLOOR_C[0], FLOOR_Y, FLOOR_C[1]]} rotation={[-Math.PI / 2, 0, 0]}
      draw={draw} renderOrder={0} />
  );
};

// ── yellow rays: floor-plane wedges from the house to the pads ───
// They connect icon-layer objects, so they ride the same single
// relocation as the buildings; within every held phase they are static.
// eye origin re-measured round 4: the ref fan converges UNDER the house
// (occluded by the house body/pad; no wedge ink right of the pad) — the
// old (420,330) origin leaked yellow streaks to the house door
// over origin re-fit empirically (round 4 finisher): ref wedge center-lines
// at f4880 (scan lines x=300/340/380/400) converge at screen (455,273.5) →
// world (19.2,-140.2), stable ±4px across 4775-4880; the old (-60,-183.2)
// projected 65px left of the ref convergence and compressed the fan
const RAY_O = { over: [19.2, -140.2] as Pt, eye: toFloor(255, 325, 5100) };
// tips: cbs, t1, t2, vac1, t3, vac2 with over-phase wedge widths (twE =
// explicit eye-phase width for tips that end near the camera)
const RAY_TIPS: { b?: string; v?: number; tw: number; twE?: number }[] = [
  { b: "cbs", tw: 30 }, { b: "t1", tw: 26 }, { b: "t2", tw: 21 },
  { v: 0, tw: 21 }, { b: "t3", tw: 19 }, { v: 1, tw: 26, twE: 16 },
];
// the two vacant-lot wedges get their own eye tips (measured at f5100:
// one to the left edge, one to the bottom-left frame corner); the pads
// keep the extrapolated off-frame poses
const RAY_VAC_EYE: Pt[] = [toFloor(-10, 302, 5100), toFloor(-40, 430, 5100)];
// over-phase wedge tips for the vacant lots (round 4 finisher): the ref's
// horizontal wedge (y≈273.5 constant across x=300-410 at f4880) points at
// the vacant lot behind cbs, not at vac2's pad center — retarget the wedge
// tip only, the pad itself stays put; vac1 keeps its pad tip
const RAY_VAC_OVER: Pt[] = [[-179.5, -269.2], [-236.0, -140.2]];
// r7 pull-back fan override: the ref's fan follows the RE-GATHERED
// cluster through the pull-back (yellow-mask scan: fan tight around the
// group, x158-323 y258-303 at 5230, dead by ~5243 — our old fade window
// 5225-5240 already matches the timing; only the GEOMETRY was stale).
// Tips ride the same measured screen tracks as the re-posed icons
// (base bottom-centers), unprojected to the floor per frame; the origin
// follows the corrected house base (converge point at 5230 measured
// (350,287) = house bc + (-14,+1), offset carried along the house
// track). The two vacant-lot wedges die early — the ref fan has no
// far-left wedges from 5225 on (yellow x-min 80@5225, 158@5230).
const RAY_PB_TIP: Record<string, [number, number, number][]> = {
  t2: [[5220, 142, 254], [5225, 198, 254], [5230, 246, 256], [5235, 285, 260], [5240, 309, 258]],
  t3: [[5222, 295, 248], [5230, 322, 252], [5235, 347, 252]],
  cbs: [[5225, 30, 338], [5230, 108, 315], [5235, 176, 302], [5240, 225, 292]],
  t1: [[5220, 39, 278], [5225, 110, 285], [5230, 175, 285], [5235, 224, 285], [5240, 261, 282]],
};
const RAY_PB_O: [number, number, number][] = [
  [5215, 249, 314], [5220, 286, 302], [5225, 320, 294], [5230, 349, 288],
  [5235, 374, 284], [5240, 400, 282],
];
const RAYS_C: Pt = [-400, -800];
const RaysPlane: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    const a = fade(f, 4700, 4708) * fadeOut(f, 5225, 5240) * fadeOut(f, 5262, 5271);
    if (a <= 0) return;
    const t = diveT(f);
    // wedge ink sampled off the ref cores: overhead f4880 (253,251,163),
    // eye f5100 (253,253,195) — brighter than the old C.ray@0.8; mid-dive
    // the ref fan sweeps low-right ahead of our tip blend, so the ink dips
    // while the geometry is least trustworthy (held phases keep full ink)
    const baseA = a * (0.9 - 0.28 * Math.sin(Math.PI * t));
    ctx.globalAlpha = baseA;
    ctx.fillStyle = mixc("#FCFB9D", "#FDFDC3", t);
    const mx = (p: Pt) => w / 2 + (p[0] - RAYS_C[0]);
    const my = (p: Pt) => h / 2 + (p[1] - RAYS_C[1]);
    const pb = fade(f, 5212, 5222);
    let from: Pt = [mixN(RAY_O.over[0], RAY_O.eye[0], t), mixN(RAY_O.over[1], RAY_O.eye[1], t)];
    if (pb > 0) {
      const o2 = toFloor(
        lerp1(RAY_PB_O.map((r) => [r[0], r[1]] as [number, number]), f),
        lerp1(RAY_PB_O.map((r) => [r[0], r[2]] as [number, number]), f), f);
      from = [mixN(from[0], o2[0], pb), mixN(from[1], o2[1], pb)];
    }
    for (const tip of RAY_TIPS) {
      let tx: number;
      let tz: number;
      if (tip.b) {
        const p = wbAt(WB[tip.b], f, tip.b);
        tx = p.x;
        tz = p.z;
        const track = RAY_PB_TIP[tip.b];
        if (pb > 0 && track) {
          const t2f = toFloor(
            lerp1(track.map((r) => [r[0], r[1]] as [number, number]), f),
            lerp1(track.map((r) => [r[0], r[2]] as [number, number]), f), f);
          tx = mixN(tx, t2f[0], pb);
          tz = mixN(tz, t2f[1], pb);
        }
        ctx.globalAlpha = baseA;
      } else {
        const ot = RAY_VAC_OVER[tip.v ?? 0];
        const et = RAY_VAC_EYE[tip.v ?? 0];
        tx = mixN(ot[0], et[0], t);
        tz = mixN(ot[1], et[1], t);
        // vacant wedges die early in the pull-back (no ref counterpart)
        ctx.globalAlpha = baseA * fadeOut(f, 5218, 5230);
      }
      const dx = tx - from[0];
      const dz = tz - from[1];
      const L = Math.hypot(dx, dz) || 1;
      const px = -dz / L;
      const pz = dx / L;
      const wHalf = mixN(tip.tw, tip.twE ?? tip.tw / K_CLUSTER, t) / 2;
      ctx.beginPath();
      ctx.moveTo(mx([from[0] - px * 3, from[1] - pz * 3]), my([from[0] - px * 3, from[1] - pz * 3]));
      ctx.lineTo(mx([tx - px * wHalf, tz - pz * wHalf]), my([tx - px * wHalf, tz - pz * wHalf]));
      ctx.lineTo(mx([tx + px * wHalf, tz + pz * wHalf]), my([tx + px * wHalf, tz + pz * wHalf]));
      ctx.lineTo(mx([from[0] + px * 3, from[1] + pz * 3]), my([from[0] + px * 3, from[1] + pz * 3]));
      ctx.closePath();
      ctx.fill();
    }
    // r8: the ref fan dies at the house plate's edge — the plate
    // occludes the wedges' convergence zone (ours leaked yellow across
    // the pad, the 5205 grid's r4c2 cell). The white plate itself lives
    // in SheetFloor (strokes need an opaque underlay — see the plate
    // placement negative there); here the wedges are ERASED under the
    // plate polygon. Bank plate needs no erase: no wedges reach it.
    {
      const pa = plateAlpha(f);
      if (pa > 0) {
        const fw = Math.min(f, 5211);
        const pts = trkPts(HOUSE_PLATE, fw).map(([u, v]) => toFloor(u, v, fw));
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = pa;
        ctx.beginPath();
        ctx.moveTo(mx(pts[0]), my(pts[0]));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(mx(pts[i]), my(pts[i]));
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }, []);
  return (
    <CanvasPlane frame={frame} width={1200} height={1800} res={0.35}
      position={[RAYS_C[0], FLOOR_Y + 0.8, RAYS_C[1]]} rotation={[-Math.PI / 2, 0, 0]}
      draw={draw} renderOrder={1} />
  );
};

// ── white slab pads: thin raised mats riding their buildings ─────
// Measured flat-with-soft-outline in the reference; built as slab quads
// 2 units above the painted floor so the map itself never moves.
const SHEET_A: Pt = [0.85, -0.527]; // sheet grain (long side)
const SHEET_B: Pt = [0.989, 0.147]; // sheet grain (short side)
const padGeos = (() => {
  const cache = new Map<string, { fill: THREE.BufferGeometry; edge: THREE.BufferGeometry }>();
  return (padW: number): { fill: THREE.BufferGeometry; edge: THREE.BufferGeometry } => {
    const key = padW.toFixed(1);
    const got = cache.get(key);
    if (got) return got;
    const hw = padW / 2;
    const hd = (padW * 0.8) / 2;
    const cs: V3[] = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]).map(([sa, sb]) => [
      sa * SHEET_A[0] * hw + sb * SHEET_B[0] * hd,
      0,
      sa * SHEET_A[1] * hw + sb * SHEET_B[1] * hd,
    ]);
    const fill = new THREE.BufferGeometry();
    fill.setAttribute("position", new THREE.Float32BufferAttribute(
      [...cs[0], ...cs[1], ...cs[2], ...cs[0], ...cs[2], ...cs[3]], 3));
    fill.computeVertexNormals();
    const edge = new THREE.BufferGeometry();
    edge.setAttribute("position", new THREE.Float32BufferAttribute(
      [...cs[0], ...cs[1], ...cs[1], ...cs[2], ...cs[2], ...cs[3], ...cs[3], ...cs[0]], 3));
    const out = { fill, edge };
    cache.set(key, out);
    return out;
  };
})();

const Pad: React.FC<{ x: number; z: number; k: number; padW: number; opacity: number; dy?: number }> = ({
  x, z, k, padW, opacity, dy = 0,
}) => {
  const geos = padGeos(padW);
  if (opacity <= 0.005) return null;
  return (
    <group position={[x, FLOOR_Y + 2 + dy, z]} scale={[k, 1, k]}>
      <mesh geometry={geos.fill} renderOrder={1}>
        <meshBasicMaterial color={C.pad} transparent opacity={0.92 * opacity}
          depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <lineSegments geometry={geos.edge} renderOrder={1}>
        <lineBasicMaterial color={C.padEdge} transparent opacity={opacity} />
      </lineSegments>
    </group>
  );
};

// ── exchange arrows: world plane spanning the house-bank gap ─────
// Planted per phase like the buildings (the collage moves the gap), on a
// camera-facing plane. Screen-space endpoints measured at 4775 (overhead)
// and 5040 (eye level), converted to world at the gap's depth.
const ARR = {
  over: { z: -75.3, red: [67.5, 165.8] as Pt, redY: -73.0, blue: [80.4, 141.2] as Pt, blueY: -85.1, th: 11.7 },
  eye: { z: -314.6, red: [-1.3, 119.9] as Pt, redY: -74.9, blue: [22.6, 146.9] as Pt, blueY: -97.9, th: 13.5 },
} as const;
const ARROW_CANVAS_W = 480;
const ARROW_CANVAS_H = 130;

// jagged mating edge, traversed top→bottom (both halves share it exactly)
const jagPath = (
  ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number,
  xc: number, y: number, t: number,
) => {
  const pts: Pt[] = [
    [xc + 2, y + t], [xc - 4, y + t * 0.35], [xc + 5, y + t * 0.05],
    [xc - 3, y - t * 0.45], [xc + 2, y - t],
  ];
  for (const p of pts) ctx.lineTo(X(p[0]), Y(p[1]));
};

const ArrowsPlane: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  const t = diveT(f);
  const red: Pt = [mixN(ARR.over.red[0], ARR.eye.red[0], t), mixN(ARR.over.red[1], ARR.eye.red[1], t)];
  const blue: Pt = [mixN(ARR.over.blue[0], ARR.eye.blue[0], t), mixN(ARR.over.blue[1], ARR.eye.blue[1], t)];
  const redY = mixN(ARR.over.redY, ARR.eye.redY, t);
  const blueY = mixN(ARR.over.blueY, ARR.eye.blueY, t);
  const zA = mixN(ARR.over.z, ARR.eye.z, t);
  const th = mixN(ARR.over.th, ARR.eye.th, t);
  const cx = (red[0] + blue[1]) / 2;
  const cy = (redY + blueY) / 2;
  const { pitch } = camCommunity(f);

  const iconFade = fadeOut(f, 5262, 5271);
  const arrowOp = iconFade * fadeOut(f, 5083, 5088);
  const growR = fade(f, 4725, 4745);
  const growB = fade(f, 4720, 4745);
  // small tear opens as the camera settles at eye level, the halves
  // fully retract at 5075-5084 (as in the reference)
  const tear = easeOutPow(fade(f, 4988, 4998), 2) * 4;
  const retract = easeOutPow(fade(f, 5075, 5084), 1.5);
  const shiftL = -(tear + retract * 124);
  const shiftR = tear + retract * 124;
  const seamX = red[0] + (red[1] - red[0]) * 0.49;

  const draw = useCallback((ctx: CanvasRenderingContext2D, _fr: number, w: number, h: number) => {
    if (arrowOp <= 0) return;
    // canvas coords: world offsets from (cx, cy)
    const X = (wx: number) => w / 2 + (wx - cx);
    const Y = (wy: number) => h / 2 - (wy - cy);
    const split = shiftL !== 0 || shiftR !== 0;
    const drawArrow = (
      x0: number, x1: number, y: number, headEnd: "left" | "right",
      color: string, light: string, outline: string, grow: number, growFrom: "left" | "right",
    ) => {
      if (grow <= 0) return;
      const tHalf = th / 2;
      const head = Math.min(24, (x1 - x0) * 0.28);
      const g = ctx.createLinearGradient(0, Y(y + th), 0, Y(y - th));
      g.addColorStop(0, light);
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      // grow clip
      ctx.save();
      const visW = (x1 - x0 + 48) * grow;
      const clipX0 = growFrom === "right" ? x1 + 24 - visW : x0 - 24;
      ctx.beginPath();
      ctx.rect(X(clipX0), Y(y + th * 1.3), visW, th * 2.6);
      ctx.clip();
      const piece = (build: () => void, dx: number, dy: number) => {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.beginPath();
        build();
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };
      if (!split) {
        piece(() => {
          if (headEnd === "left") {
            ctx.moveTo(X(x0), Y(y));
            ctx.lineTo(X(x0 + head), Y(y + th * 0.95));
            ctx.lineTo(X(x0 + head), Y(y + tHalf));
            ctx.lineTo(X(x1), Y(y + tHalf));
            ctx.lineTo(X(x1), Y(y - tHalf));
            ctx.lineTo(X(x0 + head), Y(y - tHalf));
            ctx.lineTo(X(x0 + head), Y(y - th * 0.95));
          } else {
            ctx.moveTo(X(x0), Y(y + tHalf));
            ctx.lineTo(X(x1 - head), Y(y + tHalf));
            ctx.lineTo(X(x1 - head), Y(y + th * 0.95));
            ctx.lineTo(X(x1), Y(y));
            ctx.lineTo(X(x1 - head), Y(y - th * 0.95));
            ctx.lineTo(X(x1 - head), Y(y - tHalf));
            ctx.lineTo(X(x0), Y(y - tHalf));
          }
        }, 0, 0);
        ctx.restore();
        return;
      }
      const dyL = Math.min(2.5, Math.abs(shiftL) * 0.6);
      const dyR = Math.min(2.5, Math.abs(shiftR) * 0.6);
      // left piece (rises slightly as it tears free, like the source)
      piece(() => {
        if (headEnd === "left") {
          ctx.moveTo(X(x0), Y(y));
          ctx.lineTo(X(x0 + head), Y(y + th * 0.95));
          ctx.lineTo(X(x0 + head), Y(y + tHalf));
          jagPath(ctx, X, Y, seamX, y, tHalf);
          ctx.lineTo(X(x0 + head), Y(y - tHalf));
          ctx.lineTo(X(x0 + head), Y(y - th * 0.95));
        } else {
          ctx.moveTo(X(x0), Y(y + tHalf));
          jagPath(ctx, X, Y, seamX, y, tHalf);
          ctx.lineTo(X(x0), Y(y - tHalf));
        }
      }, shiftL, -dyL);
      // right piece (dips slightly)
      piece(() => {
        if (headEnd === "right") {
          jagPath(ctx, X, Y, seamX, y, tHalf);
          ctx.lineTo(X(x1 - head), Y(y - tHalf));
          ctx.lineTo(X(x1 - head), Y(y - th * 0.95));
          ctx.lineTo(X(x1), Y(y));
          ctx.lineTo(X(x1 - head), Y(y + th * 0.95));
          ctx.lineTo(X(x1 - head), Y(y + tHalf));
        } else {
          jagPath(ctx, X, Y, seamX, y, tHalf);
          ctx.lineTo(X(x1), Y(y - tHalf));
          ctx.lineTo(X(x1), Y(y + tHalf));
        }
      }, shiftR, dyR);
      ctx.restore();
    };
    drawArrow(red[0], red[1], redY, "left", C.red, "#FF9DAC", "#8F565E", growR, "right");
    drawArrow(blue[0], blue[1], blueY, "right", C.blue, "#7FCBDD", "#4E7580", growB, "left");
  }, [arrowOp, cx, cy, th, red[0], red[1], blue[0], blue[1], redY, blueY, seamX, shiftL, shiftR, growR, growB]);

  if (arrowOp <= 0 || (growR <= 0 && growB <= 0)) return null;
  return (
    <group position={[cx, cy, zA]} rotation={[-pitch, 0, 0]}>
      <CanvasPlane frame={frame} width={ARROW_CANVAS_W} height={ARROW_CANVAS_H} res={1.5}
        position={[0, 0, 0]} draw={draw} renderOrder={2} opacity={arrowOp} />
    </group>
  );
};

// ── glass wireframe cube: one object, three measured poses ───────
// Pull-back pose fit from the f5240 corners (bottom L(77,292) F(388,316)
// R(527,288); tops v=96/132). Overhead pose = affine of it fit to the
// f4830 wireframe (TL/TF/TR + left edge, rms ~10 px). Eye "room" pose
// fit from the eye-level wall verticals (x≈443/437 right, ≈8 left), the
// ceiling line (v≈90) and the pane crossing the camera at f≈4913.
const CUBE = (() => {
  // pull-back pose (exact 5240 corner fit; runs camCommunity at import)
  const bl = toFloor(77, 292, 5240);
  const bf = toFloor(388, 316, 5240);
  const br = toFloor(527, 288, 5240);
  const bb: Pt = [bl[0] + br[0] - bf[0], bl[1] + br[1] - bf[1]];
  const { cam, pitch } = camCommunity(5240);
  const ySolve = (p: Pt, v: number): number => {
    // v = 240 - DCAM*qy/(-qz) with q = Rx(pitch)(P - C)
    const dz = p[1] - cam[2];
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    const k = (240 - v) / DCAM;
    const dy = ((s - k * c) * dz) / (c + k * s);
    return cam[1] + dy;
  };
  const yTopP = (ySolve(bl, 96) + ySolve(br, 132)) / 2;
  const quadP: Pt[] = [bl, bb, br, bf];
  // overhead pose: affine of the pull-back quad (s=0.77, +50,+92)
  const cen: Pt = [
    (bl[0] + bb[0] + br[0] + bf[0]) / 4,
    (bl[1] + bb[1] + br[1] + bf[1]) / 4,
  ];
  const quadO: Pt[] = quadP.map((p) => [
    cen[0] + (p[0] - cen[0]) * 0.77 + 50,
    cen[1] + (p[1] - cen[1]) * 0.77 + 92,
  ]);
  // eye room pose (rect cx=-241.6 cz=-116.9 hx=348.8 hz=550 yaw≈0)
  const quadE: Pt[] = [
    [-593.7, 430.9], [-586.9, -669.0], [110.6, -664.7], [103.7, 435.3],
  ];
  return { quadO, quadE, quadP, yTopO: yTopP, yTopE: 90.3, yTopP };
})();

// ── r8 close-out (Task 3): cube-fade drift 5268-5288 ─────────────
// Routed from the outro audit (work/r8/outro/cubefade.png): our cube
// rode ~60-170px LEFT (left edge 169 vs ref 230-340) and ~80-120px LOW
// of the ref's through the fade, and missed the ref's rise. Measured
// ref-vs-render line-mask centroid/corner/left-edge tracks 5266-5288
// (work/r8/cam/t3*.json; the washing wireframe wobbles the x-instrument
// ±40px — the y signal is solid and monotone). Smoothed screen deltas
// baked to world offsets through the bridge-aware Jacobian at the
// cube's front corner (campb.py); zero at ≤5266 (release), fade
// schedule untouched (timing was already correct, gone by 5288).
const CUBE_DRIFT: [number, number, number][] = [
  [5266, 0, 0],
  [5268, 16.8, 57.9],
  [5270, 41.8, 126.9],
  [5273, 72.4, 195.1],
  [5276, 92.0, 216.5],
  [5280, 110.6, 224.9],
  [5284, 98.7, 247.6],
  [5288, 86.8, 260.6],
];
const cubeDriftAt = (f: number): [number, number] => {
  if (f <= CUBE_DRIFT[0][0]) return [0, 0];
  return [
    lerp1(CUBE_DRIFT.map((r) => [r[0], r[1]] as [number, number]), f),
    lerp1(CUBE_DRIFT.map((r) => [r[0], r[2]] as [number, number]), f),
  ];
};

const cubeAt = (f: number): { quad: Pt[]; yTop: number } => {
  const mixQ = (a: Pt[], b: Pt[], t: number): Pt[] =>
    a.map((p, i) => [mixN(p[0], b[i][0], t), mixN(p[1], b[i][1], t)] as Pt);
  // The overhead quad is a FIXED world box; as the camera dives it projects
  // naturally from a compact box (top face visible) into a room — exactly the
  // reference. Hold it through the whole dive, then a short corrective blend at
  // eye level resizes it to the measured room pose (the earlier switch at 4885
  // jumped to the huge room while still overhead → off-frame broken diagonals).
  if (f <= 4965) return { quad: CUBE.quadO, yTop: CUBE.yTopO };
  if (f < 4988) {
    const t = smooth01((f - 4965) / 23);
    return { quad: mixQ(CUBE.quadO, CUBE.quadE, t), yTop: mixN(CUBE.yTopO, CUBE.yTopE, t) };
  }
  if (f <= 5208) return { quad: CUBE.quadE, yTop: CUBE.yTopE };
  if (f < 5240) {
    const t = smooth01((f - 5208) / 32);
    return { quad: mixQ(CUBE.quadE, CUBE.quadP, t), yTop: mixN(CUBE.yTopE, CUBE.yTopP, t) };
  }
  return { quad: CUBE.quadP, yTop: CUBE.yTopP };
};

// The reference glass is near-tintless: presence is carried by the drawn
// edges, a faint sheen wash under the ceiling corners, and the foreground
// pane sweep. Faces are real glass (physical material, transmissive) so
// the dive-through reads as passing a pane. Each pane is built from its
// exact corner vertices (the quad is a parallelogram, not a rectangle).
const quadGeo = (a: V3, b: V3, c: V3, d: V3): THREE.BufferGeometry => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3),
  );
  geo.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2),
  );
  geo.computeVertexNormals();
  return geo;
};

const CubeGlass: React.FC<{
  quad: Pt[]; yTop: number; opacity: number; drop: number; shift?: [number, number];
}> = ({
  quad, yTop, opacity, drop, shift = [0, 0],
}) => {
  const geoKey = `${quad.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(";")};${yTop.toFixed(1)}`;
  const built = React.useMemo(() => {
    const pts: number[] = [];
    const push = (a: V3, b: V3) => pts.push(...a, ...b);
    const top: V3[] = quad.map((p) => [p[0], yTop, p[1]] as V3);
    const bot: V3[] = quad.map((p) => [p[0], FLOOR_Y, p[1]] as V3);
    for (let i = 0; i < 4; i++) {
      push(top[i], top[(i + 1) % 4]);
      push(bot[i], bot[(i + 1) % 4]);
      push(top[i], bot[i]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    // panes from exact corners: 4 sides + top
    const panes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      panes.push(quadGeo(bot[i], bot[(i + 1) % 4], top[(i + 1) % 4], top[i]));
    }
    panes.push(quadGeo(top[0], top[1], top[2], top[3]));
    // sheen strips just under the ceiling, hugging each side pane
    const sheens: THREE.BufferGeometry[] = [];
    const SH = 56;
    for (let i = 0; i < 4; i++) {
      const a = quad[i];
      const b = quad[(i + 1) % 4];
      sheens.push(quadGeo(
        [a[0], yTop - 3 - SH, a[1]],
        [b[0], yTop - 3 - SH, b[1]],
        [b[0], yTop - 3, b[1]],
        [a[0], yTop - 3, a[1]],
      ));
    }
    // alpha wash: opaque-ish at the top edge, transparent at the bottom
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, "rgba(222,222,222,0.55)");
      g.addColorStop(1, "rgba(222,222,222,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, 64);
    }
    const sheenTex = new THREE.CanvasTexture(c);
    sheenTex.colorSpace = THREE.SRGBColorSpace;
    return { geo, panes, sheens, sheenTex };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey]);
  if (opacity <= 0) return null;
  return (
    <group position={[shift[0], drop + shift[1], 0]}>
      {built.panes.map((g, i) => (
        <mesh key={`g${i}`} geometry={g} renderOrder={3}>
          <meshPhysicalMaterial
            transparent
            opacity={0.12 * opacity}
            transmission={0.85}
            roughness={0.07}
            metalness={0}
            ior={1.35}
            thickness={1}
            color="#FFFFFF"
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
      {built.sheens.map((g, i) => (
        <mesh key={`s${i}`} geometry={g} renderOrder={4}>
          <meshBasicMaterial
            map={built.sheenTex}
            transparent
            opacity={opacity}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
      <lineSegments geometry={built.geo} renderOrder={5}>
        <lineBasicMaterial color={C.cube} transparent opacity={opacity * 0.85} />
      </lineSegments>
      <lineSegments geometry={built.geo} position={[0, -5, 0]} scale={[0.99, 1, 0.99]} renderOrder={5}>
        <lineBasicMaterial color={C.cube} transparent opacity={opacity * 0.55} />
      </lineSegments>
    </group>
  );
};

// A near-white gradient backdrop riding the camera, inside the WebGL
// scene: the transmissive panes sample the framebuffer — against an
// empty (transparent) background they read as smoked grey slabs. This
// gives them the paper room's light to transmit.
const Backdrop: React.FC<{ cam: V3; pitch: number }> = ({ cam, pitch }) => {
  const tex = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 288;
    const ctx = c.getContext("2d");
    if (ctx) {
      // near-flat: the multiplicative EdgeFeather carries the ref's edge
      // darkening (the old #EBEBEA rolloff double-counted it)
      const g = ctx.createRadialGradient(256, 184, 40, 256, 184, 380);
      g.addColorStop(0, "#FDFDFD");
      g.addColorStop(0.6, "#FDFDFD");
      g.addColorStop(0.82, "#FAFAF9");
      g.addColorStop(1, "#F7F7F6");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 288);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const D = 6000;
  const dir = rx(-pitch, [0, 0, -1]);
  const pos: V3 = [cam[0] + dir[0] * D, cam[1] + dir[1] * D, cam[2] + dir[2] * D];
  const h = 2 * D * Math.tan((20 * Math.PI) / 180) * 1.25;
  const w = (h * 854) / 480;
  return (
    <mesh position={pos} rotation={[-pitch, 0, 0]} renderOrder={-1}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};

// ── foreground glass-pane sweep (screen-space, kept deliberately) ─
// The cube's front face passes the camera during the dive: a full-height
// neutral-grey band (interior ~22 levels under the bg, two faint edge
// lines) sweeps leftward 4915-4975, parks at the left edge and fades by
// ~5085; during the pull-back (5216-5240) the face re-enters left→right
// and hands over to the drawn cube edges. The reference's own glass is
// not world-consistent between shots, and these measured tracks are
// already smooth — so this one element stays a DOM overlay.
const PANE_TOP: [number, number, number][] = [
  // [f, xL, xR] at y≈52
  [4915, 456, 462], [4921, 445, 452], [4924, 438, 445], [4930, 407, 417],
  [4936, 368, 380], [4942, 316, 333], [4948, 253, 275], [4954, 179, 207],
  [4960, 94, 131], [4966, 18, 52], [4970, -2, 14], [4974, -34, -16],
  [5075, -34, -16],
];
const PANE_BOT: [number, number, number][] = [
  // [f, xL, xR] at y≈432
  [4915, 456, 462], [4921, 443, 449], [4927, 424, 431], [4933, 396, 406],
  [4939, 362, 373], [4945, 315, 331], [4951, 257, 278], [4957, 188, 215],
  [4963, 112, 146], [4969, 50, 87], [4975, 17, 56], [4985, 12, 51],
  [4995, 8, 47], [5010, 2, 33], [5030, 0, 27], [5050, 0, 20], [5075, 0, 15],
];
// pull-back re-entry (measured 5220/5230/5240; ~+12px/f decelerating)
const PANE_BACK: [number, number, number][] = [
  [5216, 149, 167], [5220, 197, 215], [5230, 324, 332], [5240, 386, 389],
];
const paneQuad = (rows: { top: [number, number]; bot: [number, number] }) => {
  // extend the measured bands (y52 / y432) to the full frame height
  const ext = (a: number, b: number, y: number) => a + ((b - a) * (y - 52)) / 380;
  return {
    tl: [ext(rows.top[0], rows.bot[0], 0), 0] as Pt,
    tr: [ext(rows.top[1], rows.bot[1], 0), 0] as Pt,
    br: [ext(rows.top[1], rows.bot[1], 480), 480] as Pt,
    bl: [ext(rows.top[0], rows.bot[0], 480), 480] as Pt,
  };
};
const GlassSweep: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  let quad: ReturnType<typeof paneQuad> | null = null;
  let alpha = 0;
  let topRamp = 1;
  let edges = false;
  if (f >= 4915 && f <= 5088) {
    const at = (rows: [number, number, number][], idx: 1 | 2) =>
      lerp1(rows.map((r) => [r[0], r[idx]] as [number, number]), f);
    quad = paneQuad({
      top: [at(PANE_TOP, 1), at(PANE_TOP, 2)],
      bot: [at(PANE_BOT, 1), at(PANE_BOT, 2)],
    });
    // interior deficit: ~22 levels on ~243 bg through the sweep, easing to
    // ~10 as the camera settles, ~4 through the hold, gone by 5085
    alpha = lerp1([[4915, 0.09], [4960, 0.09], [4972, 0.05], [4995, 0.035], [5010, 0.017], [5070, 0.015], [5085, 0]], f);
    topRamp = fade(f, 4919, 4926); // top of the pane eases in
    edges = f <= 4970;
  } else if (f >= 5216 && f <= 5246) {
    const xL = lerp1(PANE_BACK.map((r) => [r[0], r[1]] as [number, number]), f);
    const xR = lerp1(PANE_BACK.map((r) => [r[0], r[2]] as [number, number]), f);
    quad = paneQuad({ top: [xL, xR], bot: [xL, xR] });
    alpha = lerp1([[5216, 0], [5220, 0.04], [5230, 0.0015], [5240, 0.05], [5246, 0]], f);
  }
  if (!quad || alpha <= 0) return null;
  const pts = `${quad.tl[0]},0 ${quad.tr[0]},0 ${quad.br[0]},480 ${quad.bl[0]},480`;
  return (
    <svg width={854} height={480} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="pane-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A3A3A" stopOpacity={alpha * topRamp} />
          <stop offset="35%" stopColor="#3A3A3A" stopOpacity={alpha} />
          <stop offset="100%" stopColor="#3A3A3A" stopOpacity={alpha} />
        </linearGradient>
      </defs>
      <polygon points={pts} fill="url(#pane-g)" />
      {edges && (
        <>
          <line x1={quad.tl[0]} y1={0} x2={quad.bl[0]} y2={480}
            stroke="#3A3A3A" strokeOpacity={0.05 * topRamp} strokeWidth={2.4} />
          <line x1={quad.tr[0]} y1={0} x2={quad.br[0]} y2={480}
            stroke="#3A3A3A" strokeOpacity={0.04 * topRamp} strokeWidth={2.2} />
        </>
      )}
    </svg>
  );
};

// ── the scene ────────────────────────────────────────────────────
// Overhead-phase lean: the reference draws its icons semi-billboarded —
// near-upright facades under the 38-degree overhead camera (a true-3D
// upright building foreshortens hard and reads "fallen over", which is
// exactly what the replica did). Each icon tips toward the camera about
// its base line — a real 3D pose, blended out through the dive as the
// camera drops to eye level where upright is correct.
// Bank rock beat (round 5, owner-flagged): through the pull-back the ref
// bank visibly ROCKS about its base — measured apex-vs-base lean minus
// the +2.5deg perspective baseline (rockscan2.py, dense 3f sampling):
// two damped swings, −8.5deg deep at 5218, back through 0 at 5230,
// second dip −7.9deg at 5236, settled by 5245. Applied as a real 3D
// rotation about the base pivot (positive Z = apex screen-left,
// verified on the rendered still).
const BANK_ROCK: [number, number][] = [
  [5212, 0], [5215, 0.0280], [5218, 0.0740], [5221, 0.0645], [5224, 0.0635],
  [5227, 0.0430], [5230, 0.0015], [5233, 0.0430], [5236, 0.0690], [5239, 0],
  [5242, 0], [5245, 0.0070], [5248, 0],
];
const bankRock = (f: number): number =>
  f <= 5212 || f >= 5248 ? 0 : lerp1(BANK_ROCK, f);
const PlantedBuilding: React.FC<{
  name: string; frame: number; opacity: number; pop?: number; dropY?: number;
}> = ({ name, frame, opacity, pop = 1, dropY = 0 }) => {
  const b = WB[name];
  const p = wbAt(b, frame, name);
  const fx = iconFixAt(name, frame);
  const lean = (b.lean ?? 0) * (1 - diveT(frame));
  // eye-phase face-the-camera yaw (round 6): the ref draws the eye-level
  // house FLAT — front face only, no side wall. Our fixed-yaw box shows a
  // ~40px side face at the eye bearing (0.263 rad, stable 5000-5200), which
  // read as the house being ~35% too wide. Still a real 3D pose — the
  // house turns to face the camera through the dive, like the lean.
  // Round-6 negative A/B: yawing the eye-phase house to face the camera
  // (0.263 rad, hiding the ~40px side face the ref never draws) lost
  // −.001/−.002 at 5000/5100 both with and without a front-face slide
  // compensation — the roof silhouette distortion outweighs the hidden
  // side wall. The flat-icon read stays an open perceptual item; the
  // metric prefers the upright box.
  if (opacity <= 0.005 || pop <= 0.005) return null;
  return (
    <group position={[p.x + fx.dx, FLOOR_Y + dropY + fx.dy, p.z]}
      rotation={[lean, 0, name === "bank" ? bankRock(frame) : 0]}
      scale={[p.kx * pop * fx.kx, p.ky * pop * fx.ky, p.kx * pop * fx.kx]}>
      <MiniBuilding spec={b.spec} position={[0, 0, 0]} opacity={opacity} />
    </group>
  );
};

export const CommunityWorld: React.FC<{ frame: number }> = ({ frame }) => {
  const { cam, pitch } = camCommunity(frame);

  const iconFade = fadeOut(frame, 5262, 5271);

  // hero entries/exits measured on the reference: house fades in from
  // ~4694, bank ~4705.
  // r8 close-out HERO-KILL RETIME (unblocks the a3ca1ccaa negative): the
  // ref holds both heroes' INK MASS near-full through ~5272-5273 (they
  // WASH pale from ~5266 but keep their mass: hue-window pose mask n
  // ~1450-1560 house / ~1700-1760 bank at 5270-5272), then kills them
  // fast — house gone by ~5275-5276, bank decays 5273-5278, gone 5279
  // (work/r8/cam/t2meas.py). The prior retime lost only because the
  // 5260-clamped rows left the held heroes STALE-POSED; the fresh
  // 5264-5278 ICON_FIX rows above carry the measured rise/left-slide
  // through the kill, so the measured windows now hold their gates.
  const houseDrop = (1 - easeOutPow(fade(frame, 4694, 4708), 2)) * 40;
  const houseOp = fade(frame, 4694, 4708) * fadeOut(frame, 5272, 5276);
  const bankDrop = (1 - easeOutPow(fade(frame, 4705, 4715), 2)) * 36;
  const bankOp = fade(frame, 4705, 4715) * fadeOut(frame, 5272, 5278);

  const pop = (a: number, b: number) => {
    const t = fade(frame, a, b);
    return t <= 0 ? 0 : Math.min(1, 1.1 * easeOutPow(t, 2));
  };

  // rigid drop (measured: airborne ~4800, landed ~4812, no bounce), then
  // lifts off during the pull-back before the whiteout
  const cubeOp = fade(frame, 4798, 4806) * fadeOut(frame, 5280, 5287);
  const cubeDrop = (1 - easeOutPow(fade(frame, 4798, 4815), 1.8)) * 150;
  const cubeLift = easeOutPow(fade(frame, 5240, 5271), 1.5) * 110;
  const cube = cubeAt(frame);

  // cbs and t1 leave the frame during the dive (the source drops them) —
  // and RE-ENTER during the pull-back as the camera re-reveals the
  // community (r7 measured: the box+temple pair walks in from frame-left
  // 5216-5230 and the whole cluster fades away 5240-5256; by 5258 the
  // ref keeps only house and bank). t2/t3 hold through eye level,
  // slightly washed as in the source, then fade on the measured schedule
  // (ref t2 last clear at 5240, gone by 5245; t3 hides behind the house
  // by ~5237) instead of surviving to the 5262 icon fade.
  const cbsOp = iconFade * Math.max(
    fadeOut(frame, 4950, 4970), fade(frame, 5222, 5230) * fadeOut(frame, 5246, 5256));
  const t1Op = iconFade * Math.max(
    fadeOut(frame, 4955, 4975), fade(frame, 5216, 5224) * fadeOut(frame, 5242, 5252));
  const t2Op = iconFade * (1 - 0.45 * fade(frame, 4985, 5000)) * fadeOut(frame, 5240, 5250);
  const t3Op = iconFade * (1 - 0.3 * fade(frame, 4985, 5000)) * fadeOut(frame, 5232, 5242);

  // pads do NOT ride ICON_FIX: the fix compensates OUR icon rendering vs
  // the ref's icon redraw; the ref's pads stay put on the sheet (A/B: a
  // riding bank pad became the worst diff cell at 5000)
  const padOp = (name: string, a: number, b: number, extra = 1) => {
    const bld = WB[name];
    const p = wbAt(bld, frame, name);
    return { p, dy: 0, o: fade(frame, a, b) * iconFade * extra, w: bld.padW * bld.spec.W };
  };
  const pads = [
    { key: "p-house", ...padOp("house", 4700, 4712) },
    { key: "p-bank", ...padOp("bank", 4712, 4722) },
    // cbs/t1 pads leave with their buildings during the dive (and stay
    // out at the pull-back re-entry: pads do not ride ICON_FIX, so a
    // returned pad would sit at the stale raw pose — absent beats
    // misplaced). t2/t3 pads fade as the re-pose begins for the same
    // reason: their buildings slide onto the ref track, the raw-pose
    // white slabs must not stay behind.
    { key: "p-cbs", ...padOp("cbs", 4700, 4710, fadeOut(frame, 4950, 4970)) },
    { key: "p-t1", ...padOp("t1", 4700, 4710, fadeOut(frame, 4955, 4975)) },
    { key: "p-t2", ...padOp("t2", 4700, 4710, fadeOut(frame, 5212, 5224)) },
    { key: "p-t3", ...padOp("t3", 4700, 4710, fadeOut(frame, 5212, 5224)) },
  ];
  const dvT = diveT(frame);

  return (
    <>
      <ambientLight intensity={2.5} />
      <Backdrop cam={cam} pitch={pitch} />
      {/* SheetFloor is mounted by the ground layer, not here */}
      <RaysPlane frame={frame} />
      {/* slab pads under buildings + the two vacant lots */}
      {pads.map(({ key, p, dy, o, w }) => (
        <Pad key={key} x={p.x} z={p.z} k={p.kx} padW={w} opacity={o} dy={dy} />
      ))}
      {VACANT.map((vc, i) => (
        <Pad key={`p-vac${i}`} x={mixN(vc.over.x, vc.eye.x, dvT)} z={mixN(vc.over.z, vc.eye.z, dvT)}
          k={mixN(K_CLUSTER, 1, dvT)} padW={VAC_W} opacity={fade(frame, 4700, 4710) * iconFade} />
      ))}
      {/* community cluster: rigid planted solids, one relocation in the dive */}
      <PlantedBuilding name="cbs" frame={frame} opacity={cbsOp} pop={pop(4744, 4756)} />
      <PlantedBuilding name="t1" frame={frame} opacity={t1Op} pop={pop(4750, 4762)} />
      <PlantedBuilding name="t2" frame={frame} opacity={t2Op} pop={pop(4754, 4766)} />
      <PlantedBuilding name="t3" frame={frame} opacity={t3Op} pop={pop(4766, 4778)} />
      {/* hero house + bank */}
      <PlantedBuilding name="house" frame={frame} opacity={houseOp} dropY={houseDrop} />
      <PlantedBuilding name="bank" frame={frame} opacity={bankOp} dropY={bankDrop} />
      {/* exchange arrows: world plane in the house-bank gap */}
      <ArrowsPlane frame={frame} />
      <CubeGlass quad={cube.quad} yTop={cube.yTop} opacity={cubeOp} drop={cubeDrop + cubeLift}
        shift={cubeDriftAt(frame)} />
    </>
  );
};

// ── r7 measured tone-field closure (screen-space) ────────────────
// The signed background field (att−ref cell means, bg-only mask) is
// STATIC across the whole eye hold (identical numbers at 5000/5100/5180/
// 5210): our top band renders 10-23 levels DARK (worst −23 at the
// top-left corner where the ref ceiling is a blank bright 243 — our
// cube sheen/pane wash + edge feather pile up there), the bottom-left
// corner −8..−12 dark, and the bottom-right corner +10..+14 BRIGHT
// (the ref's soft hatch wash, cores ~200, fuses at 480p into a corner
// gradient our render lacks). Three measured gradient lobes close the
// field; the top band also holds through the dive and pull-back
// (−11..−22 at 4930/5230) so it gates wider than the corner pair.
// Alphas calibrated closed-loop against the rendered still at 5100.
const ToneField: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  const gTop = fade(f, 4915, 4935) * fadeOut(f, 5238, 5256);
  const gCorners = fade(f, 4960, 4980) * fadeOut(f, 5208, 5224);
  if (gTop <= 0 && gCorners <= 0) return null;
  return (
    <svg width={854} height={480} style={{ position: "absolute", inset: 0 }}>
      <defs>
        {/* NOTE (measured, r7): the shared EdgeFeather (lib/post.tsx,
            out-of-lane) is a darken-toward-220 layer ABOVE this overlay
            with w≈0.97 at the frame edge — it CAPS the outer ~40px at
            ~221 no matter what is painted below (max out at w=.97 is
            221.05), while the ref's community ceiling reads 243.5. The
            feather was calibrated at f600/1200/2500/4400 and never at
            the community eye hold. This overlay therefore recovers only
            the interior band (y≳40, x≳40) where the feather weight
            decays; the outer fringe stays −15..−20 dark — an out-of-lane
            item for the round log. Alphas below are closed-loop values
            (rendered still at 5100 re-measured against the ref field). */}
        <radialGradient id="tf-top">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.72} />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.52} />
          <stop offset="82%" stopColor="#FFFFFF" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="tf-r1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.3} />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="tf-lm">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.28} />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity={0.12} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="tf-bl">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.7} />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="tf-br">
          <stop offset="0%" stopColor="#4A4A4A" stopOpacity={0.28} />
          <stop offset="65%" stopColor="#4A4A4A" stopOpacity={0.13} />
          <stop offset="100%" stopColor="#4A4A4A" stopOpacity={0} />
        </radialGradient>
      </defs>
      {gTop > 0 && (
        <>
          <ellipse cx={120} cy={30} rx={800} ry={250} fill="url(#tf-top)" opacity={gTop} />
          <ellipse cx={690} cy={115} rx={280} ry={78} fill="url(#tf-r1)" opacity={gTop} />
          <ellipse cx={-20} cy={225} rx={140} ry={125} fill="url(#tf-lm)" opacity={gTop} />
        </>
      )}
      {gCorners > 0 && (
        <>
          <ellipse cx={-10} cy={488} rx={265} ry={125} fill="url(#tf-bl)" opacity={gCorners} />
          <ellipse cx={870} cy={495} rx={310} ry={160} fill="url(#tf-br)" opacity={gCorners} />
        </>
      )}
    </svg>
  );
};

export const CommunityOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <>
      {/* measured tone-field closure under the pane sweep */}
      <ToneField frame={frame} />
      {/* foreground glass pane crossing the camera */}
      <GlassSweep frame={frame} />
    </>
  );
};
