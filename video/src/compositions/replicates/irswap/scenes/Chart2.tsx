// Frames 3572-4138: the settlement chart room (S10). One wall chart —
// fixed-rate line vs base-rate curve, hatched debit/credit regions,
// numbered badges, screen-anchored legend — plus the persistent floor.
// 3D: wall plane fitted from the 11 measured gridline xs at anchor f3700
// (identity camera); per-frame translation camera solved from the three
// measured tracks (label-left, curve tip, green-dash x).

import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { clamp01, easeInOutCubic, easeInPow, easeOutPow, lerp1, polyArc, polyUpToArc } from "../lib/helpers";
import type { Pt } from "../lib/helpers";
import {
  CanvasPlane, DCAM, fitWall, unprojToWall, unprojToFloor, wallToWorld,
} from "../lib/world";
import type { V3 } from "../lib/world";

const { fontFamily: FONT } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});

const FLOOR_Y = -170;

// ── wall fit (anchor f3700, identity camera) ─────────────────────
const GRID_X = [342, 366, 390, 415, 440, 467, 495, 523, 553, 583, 616];
const WALL = fitWall(GRID_X);
const w2 = (u: number, v: number): Pt => unprojToWall(WALL, u, v);

// chart geometry in wall space (s, y) — measured at f3700
const CURVE_SCR: Pt[] = [
  [290, 307], [302, 300], [314, 288], [326, 275], [338, 268], [350, 268], [362, 276], [374, 279],
  [386, 277], [398, 269], [410, 254], [422, 232], [434, 219], [446, 214], [458, 211], [470, 210],
  [482, 209], [494, 208], [506, 206], [518, 199], [530, 187], [542, 183], [554, 180], [566, 174],
  [578, 166], [590, 149], [596, 136],
];
const CURVE = CURVE_SCR.map(([u, v]) => w2(u, v));
const FIX_A = w2(292, 229);
const FIX_B = w2(592, 240);
const yLine = (s: number) =>
  FIX_A[1] + ((s - FIX_A[0]) * (FIX_B[1] - FIX_A[1])) / (FIX_B[0] - FIX_A[0]);
// curve/line crossing (wall s)
const S_CROSS = (() => {
  for (let i = 0; i < CURVE.length - 1; i++) {
    const a = CURVE[i];
    const b = CURVE[i + 1];
    const da = a[1] - yLine(a[0]);
    const db = b[1] - yLine(b[0]);
    if (da <= 0 && db > 0) {
      const t = da / (da - db);
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return (CURVE[0][0] + CURVE[CURVE.length - 1][0]) / 2;
})();
const DASH_T = w2(420.5, 152);
const DASH_B = w2(420.5, 319);
const GUIDE_A = w2(430, 290);
const GUIDE_B = w2(660, 290);
const GRID_TOP_Y = w2(480, 115)[1];
const GRID_BOT_Y = w2(480, 345)[1];
const LBL_FIX = w2(239, 226.5); // left-center of "Fixed rate"
const LBL_BASE = w2(242, 302); // left-center of "Base rate"
const GRID_S = GRID_X.map((x) => w2(x, 240)[0]);

// wall canvas bounds (wall space)
const S0 = w2(220, 240)[0];
const S1 = w2(700, 240)[0];
const Y_TOP = GRID_TOP_Y + 30;
const Y_BOT = GRID_BOT_Y - 20;
const WALL_W = S1 - S0;
const WALL_H = Y_TOP - Y_BOT;

// ── camera solve (translation-only) ──────────────────────────────
// world observation points
const W1: V3 = wallToWorld(WALL, ...w2(240, 225));
const W2P: V3 = wallToWorld(WALL, ...w2(596, 138));
const W3: V3 = wallToWorld(WALL, ...w2(420.5, 235));
const W4: V3 = wallToWorld(WALL, S_CROSS, yLine(S_CROSS)); // curve×line crossing

type Row3 = [number, number, number];
const T_P1: Row3[] = [
  [3600, 224, 228], [3615, 227, 228], [3630, 229, 227], [3645, 231, 224], [3660, 234, 227],
  [3675, 236, 224], [3690, 238, 224], [3705, 240, 225], [3720, 238, 222], [3735, 216, 205],
  [3750, 172, 177], [3765, 160, 169], [3780, 157, 167], [3795, 154, 166], [3810, 151, 164],
  [3825, 148, 162], [3840, 145, 160], [3855, 141, 157], [3870, 137, 155], [3885, 134, 153],
  // dense whip tracking 3888-3912 (re-measured; anchored to the 3900 row)
  [3888, 133, 152], [3891, 132, 152], [3894, 118, 157], [3897, 88, 169],
  [3900, 41, 185], [3903, -21, 206], [3906, -97, 232], [3909, -170, 262],
  [3912, -276, 296], [4080, 11, 305], [4095, 78, 259], [4110, 206, 239],
];
const T_CROSS: Row3[] = [
  [3735, 483, 222], [3750, 592, 200], [3765, 623, 197], [3780, 628, 193], [3795, 632, 191],
  [3810, 643, 193], [3825, 646, 188], [3840, 657, 190], [3855, 665, 188], [3870, 670, 182],
  [3885, 678, 180],
  [3888, 684, 184], [3891, 685, 184], [3894, 667, 189], [3897, 635, 199],
  [3900, 591, 214], [3903, 538, 233], [3906, 483, 255], [3909, 425, 280],
  [3912, 367, 306], [3915, 304, 328], [3925, 174, 393],
];
const T_P2: Row3[] = [
  [3645, 604, 137], [3660, 602, 137], [3675, 599, 139], [3690, 597, 140], [3705, 596, 139],
  [3720, 615, 132], [3735, 773, 70], [3915, 745, 81], [3930, 618, 141], [3945, 620, 140],
  [3960, 621, 140], [3975, 623, 138], [3990, 624, 138], [4005, 625, 138], [4020, 627, 136],
  [4035, 627, 136], [4050, 628, 135], [4065, 638, 127], [4080, 649, 116], [4095, 641, 114],
  [4110, 627, 116],
];
const T_P3X: [number, number][] = [
  [3600, 420], [3615, 420], [3630, 420], [3645, 420], [3660, 420], [3675, 420], [3690, 420],
  [3705, 420], [3720, 421], [3735, 481.6], [3750, 589.9], [3765, 616.1], [3780, 622.2],
  [3795, 628.6], [3810, 635.4], [3825, 642.4], [3840, 649.3], [3855, 656.8], [3870, 664.6],
  [3885, 672.4],
  [3888, 674.6], [3891, 674.6], [3894, 659.1], [3897, 628.1],
  [3900, 586.1], [3903, 536.1], [3906, 480.1], [3909, 421.1], [3912, 361.1],
  [3915, 304.1], [3925, 173.7],
  [3930, 164], [3945, 164], [3960, 160], [3975, 156], [3990, 152], [4005, 152], [4020, 148],
  [4035, 148], [4050, 148], [4065, 200], [4080, 288], [4095, 350], [4110, 420],
];
const projT = (p: V3, cam: V3): Pt => {
  const d = cam[2] - p[2];
  return [427 + (DCAM * (p[0] - cam[0])) / d, 240 - (DCAM * (p[1] - cam[1])) / d];
};
const solveKeys = (): { f: number; cam: V3 }[] => {
  const frames: number[] = [];
  for (let f = 3600; f <= 4110; f += 15) frames.push(f);
  frames.push(3925);
  // dense whip keys (the 15-frame grid lagged the fast 3888-3912 move)
  for (let f = 3888; f <= 3912; f += 3) if (!frames.includes(f)) frames.push(f);
  frames.sort((a, b) => a - b);
  const find = (rows: Row3[], f: number): Pt | null => {
    const r = rows.find((x) => x[0] === f);
    return r ? [r[1], r[2]] : null;
  };
  const keys: { f: number; cam: V3 }[] = [];
  let prev: V3 = [0, 0, DCAM];
  for (const f of frames) {
    type Obs = { w: V3; s: Pt; xOnly?: boolean };
    const obs: Obs[] = [];
    const o1 = find(T_P1, f);
    if (o1) obs.push({ w: W1, s: o1 });
    const o2 = find(T_P2, f);
    if (o2) obs.push({ w: W2P, s: o2 });
    const o4 = find(T_CROSS, f);
    if (o4) obs.push({ w: W4, s: o4 });
    const o3 = T_P3X.find((x) => x[0] === f);
    if (o3) obs.push({ w: W3, s: [o3[1], 0], xOnly: true });
    let cam: V3 = [...prev] as V3;
    const PRIOR = 0.1;
    for (let it = 0; it < 8; it++) {
      const J: number[][] = [];
      const r: number[] = [];
      const eps = 0.5;
      for (const o of obs) {
        const p0 = projT(o.w, cam);
        const rows: number[][] = [[], []];
        for (let k = 0; k < 3; k++) {
          const c2: V3 = [...cam] as V3;
          c2[k] += eps;
          const p1 = projT(o.w, c2);
          rows[0].push((p1[0] - p0[0]) / eps);
          rows[1].push((p1[1] - p0[1]) / eps);
        }
        r.push(o.s[0] - p0[0]);
        J.push(rows[0]);
        if (!o.xOnly) {
          r.push(o.s[1] - p0[1]);
          J.push(rows[1]);
        }
      }
      for (let k = 0; k < 3; k++) {
        const row = [0, 0, 0];
        row[k] = PRIOR;
        J.push(row);
        r.push(PRIOR * (prev[k] - cam[k]));
      }
      const A: number[][] = Array.from({ length: 3 }, () => [0, 0, 0]);
      const b = [0, 0, 0];
      for (let i = 0; i < J.length; i++) {
        for (let a = 0; a < 3; a++) {
          b[a] += J[i][a] * r[i];
          for (let c = 0; c < 3; c++) A[a][c] += J[i][a] * J[i][c];
        }
      }
      for (let a = 0; a < 3; a++) A[a][a] += 1e-6;
      // 3x3 gaussian elimination
      for (let col = 0; col < 3; col++) {
        let piv = col;
        for (let rr = col + 1; rr < 3; rr++) if (Math.abs(A[rr][col]) > Math.abs(A[piv][col])) piv = rr;
        [A[col], A[piv]] = [A[piv], A[col]];
        [b[col], b[piv]] = [b[piv], b[col]];
        for (let rr = col + 1; rr < 3; rr++) {
          const fm = A[rr][col] / A[col][col];
          for (let cc = col; cc < 3; cc++) A[rr][cc] -= fm * A[col][cc];
          b[rr] -= fm * b[col];
        }
      }
      const dx = [0, 0, 0];
      for (let rr = 2; rr >= 0; rr--) {
        let s = b[rr];
        for (let cc = rr + 1; cc < 3; cc++) s -= A[rr][cc] * dx[cc];
        dx[rr] = s / A[rr][rr];
      }
      cam = [cam[0] + dx[0], cam[1] + dx[1], cam[2] + dx[2]];
    }
    keys.push({ f, cam });
    prev = cam;
  }
  return keys;
};
const KEYS = solveKeys();
const kx: [number, number][] = KEYS.map((k) => [k.f, k.cam[0]]);
const ky: [number, number][] = KEYS.map((k) => [k.f, k.cam[1]]);
const kz: [number, number][] = KEYS.map((k) => [k.f, k.cam[2]]);
const camAt = (f: number): V3 => [lerp1(kx, f), lerp1(ky, f), lerp1(kz, f)];

// ── measured camera retarget (post-pan hold + whip) ──────────────
// Similarity registration of our render onto the reference (masked
// patch-flow NCC): ref ≈ s·(cur − center) + center + t. The solved path
// pushed IN during the whip where the reference pulls BACK (s=0.709 at
// 3909), and the whole post-pan hold sat ~2.2% large and ~6px left.
// Applied as a depth retarget about the wall-center depth.
const CAM_FIX: [number, number, number, number][] = [
  // [f, s, tx, ty]
  [3740, 1, 0, 0], [3760, 0.978, 6, -1], [3885, 0.979, 5.8, 0.6],
  [3891, 0.972, 4.6, -2.7], [3894, 0.966, 5.8, -0.4], [3897, 0.96, 9.2, -0.5],
  [3900, 0.909, 15.9, -1.7], [3903, 0.814, 20.6, 0.5], [3906, 0.742, 11.8, 2],
  [3909, 0.709, -2.4, 3.7], [3912, 0.725, -27.8, 11.3], [3915, 0.975, 11, -5],
  [3918, 1, 3, -3], [3922, 1, 0, 0],
  // late-pan de-shear: the solved base camera grows too oblique as it pans
  // right (the horizontal fixed-rate line droops down-right while the ref
  // holds it near-flat). A depth pull-back about the wall center flattens
  // the perspective. Held flat 4090→4131 so the frozen handoff pose keeps
  // zero velocity (T_SLOT recomputes; Slot screen output is T_SLOT-invariant).
  [3970, 1, 0, 0], [4010, 0.95, 0, 0], [4050, 0.86, 0, 0],
  [4090, 0.83, 0, 0], [4110, 0.83, 0, 0], [4131, 0.83, 0, 0],
];
const WC3: V3 = wallToWorld(WALL, (S0 + S1) / 2, (Y_TOP + Y_BOT) / 2);
const fixRow = (i: 1 | 2 | 3) => CAM_FIX.map((r) => [r[0], r[i]] as [number, number]);
const FIX_S = fixRow(1);
const FIX_TX = fixRow(2);
const FIX_TY = fixRow(3);
const camFixed = (f: number): V3 => {
  const cam = camAt(f);
  const s = lerp1(FIX_S, f);
  const tx = lerp1(FIX_TX, f);
  const ty = lerp1(FIX_TY, f);
  if (Math.abs(s - 1) < 1e-4 && Math.abs(tx) < 1e-3 && Math.abs(ty) < 1e-3) return cam;
  const d2 = (cam[2] - WC3[2]) / s;
  return [cam[0] - (tx * d2) / DCAM, cam[1] + (ty * d2) / DCAM, WC3[2] + d2];
};

// ── round-3 orbit refit ──────────────────────────────────────────
// The reference ORBITS this wall too. Proof is in the scans: the
// gridline-gap recession FLIPS (f3800: 46.5→63 rising rightward;
// f4000: 62→52 falling), and the fixed-rate line's screen slope flips
// sign (+0.038 at the f3700 anchor → −0.035 in the second hold) — a
// fixed vanishing point (translation-only camera) can do neither.
// Solved per-frame (cx, cy, cz, yaw) from the measured tracks + a
// grey-masked gridline column scan + fixed-line RANSAC + red-curve
// samples (tooling: .claude/rounds/work/scanc2.py, solvec2*.py).
// The old translation solve misfit the same observations at 5-35px
// RMS through 3750-4110; this fits at 0.3-6px.
const C2R: [number, number, number, number, number][] = [
  // [f, cx, cy, cz, yaw]
  [3600, -4.267, 4.156, 604.769, -0.00719],
  [3615, -2.773, 3.669, 612.424, -0.0045],
  [3630, -2.14, 2.919, 619.534, -0.00361],
  [3645, -1.621, 2.341, 630.253, -0.00343],
  [3660, -2.528, 1.849, 638.42, -0.00413],
  [3675, -1.487, 1.262, 647.551, -0.00316],
  [3690, 8.788, 1.046, 651.275, 0.0118],
  [3705, 13.261, 0.632, 647.381, 0.01859],
  [3720, 13.05, 0.274, 601.136, 0.02777],
  [3735, -41.03, -5.728, 434.969, 0.00798],
  [3750, -137.768, -12.705, 284.947, -0.16599],
  [3765, -164.669, -14.869, 254.252, -0.24001],
  [3780, -174.702, -15.562, 247.5, -0.26873],
  [3795, -178.157, -15.923, 240.28, -0.28151],
  [3810, -184.779, -16.352, 233.034, -0.30194],
  [3825, -188.878, -16.819, 226.076, -0.31785],
  [3840, -192.489, -16.768, 219.303, -0.32975],
  [3855, -200.541, -17.411, 211.556, -0.35593],
  [3870, -215.143, -18.039, 201.835, -0.40755],
  [3885, -214.665, -18.363, 193.954, -0.41094],
  [3888, -223.055, -18.049, 188.399, -0.4382],
  [3891, -228.189, -17.896, 185.136, -0.45714],
  [3894, -228.987, -15.922, 186.817, -0.47719],
  [3897, -224.794, -11.398, 191.662, -0.49914],
  [3900, -216.852, -4.796, 197.605, -0.52736],
  [3903, -206.06, 3.773, 204.706, -0.56004],
  [3906, -192.872, 13.913, 211.667, -0.5943],
  [3909, -179.865, 25.279, 224.09, -0.6228],
  [3912, -160.09, 36.538, 227.87, -0.6484],
  [3915, -113.399, 33.092, 164.104, -0.71076],
  [3925, -93.995, 52.255, 172.041, -0.79337],
  [3930, -101.342, 53.383, 171.737, -0.83929],
  [3945, -101.253, 53.649, 174.411, -0.83016],
  [3960, -98.382, 53.885, 174.575, -0.82361],
  [3975, -95.836, 53.717, 171.751, -0.82459],
  [3990, -94.521, 53.846, 170.547, -0.82633],
  [4005, -95.384, 53.585, 169.074, -0.83197],
  [4020, -92.841, 53.28, 163.461, -0.84082],
  [4035, -94.233, 53.151, 161.022, -0.8499],
  [4050, -94.681, 53.214, 161.723, -0.84869],
  [4065, -36.202, 53.808, 247.082, -0.45],
  [4080, 27.906, 37.877, 348.545, -0.08],
  [4095, 21.267, 26.893, 400.745, -0.05],
  [4110, 26.415, 11.571, 515.673, 0.04843],
];
// Blend 0 at both mount edges so camChart2(3580) (→ T_C2) and the
// frozen exit pose camChart2(≥4128) (→ T_SLOT, advDis entry at 4131)
// stay byte-identical to the pre-refit build.
const C2W: [number, number][] = [[3600, 0], [3630, 1], [4110, 1], [4128, 0]];
const c2Row = (i: 1 | 2 | 3 | 4) => C2R.map((r) => [r[0], r[i]] as [number, number]);
const R_CX = c2Row(1);
const R_CY = c2Row(2);
const R_CZ = c2Row(3);
const R_G = c2Row(4);
export const camChart2Yaw = (f: number): number => {
  if (f <= 3600 || f >= 4128) return 0;
  return lerp1(R_G, f) * lerp1(C2W, f);
};
const camRefit = (f: number): V3 => {
  if (f <= 3600 || f >= 4128) return camFixed(f);
  const w = lerp1(C2W, f);
  const base = camFixed(f);
  if (w <= 0) return base;
  const r: V3 = [lerp1(R_CX, f), lerp1(R_CY, f), lerp1(R_CZ, f)];
  if (w >= 1) return r;
  return [
    base[0] + (r[0] - base[0]) * w,
    base[1] + (r[1] - base[1]) * w,
    base[2] + (r[2] - base[2]) * w,
  ];
};
export const camChart2 = camRefit;

// ── wall-layer registration refit (round 5) ──────────────────────
// The r4 diffgrids pinned a residual "doubled ink" misregistration on
// the wall layer (doubled curve / fixed line / labels) across
// 3750-4110, worst through the whip. ICP similarity fits of the ref's
// red-curve + grey-line + green-dash pixels against the model geometry
// in WALL space (through the exact C2R camera; work/r5/c2/fitwall.py,
// overlay-verified at 3850/3900/3919/4050/4075) show the ref REDRAWS
// the whole wall diagram per hold — the same hand-drawn 2.5D as the
// bar layer (C2BAR) and the floor (C2FLR): ~7-13% larger with a ~-1°
// roll through hold 1, ~15% larger through the whip, snapping ~4%
// smaller for hold 2 (roll drifting to -2° by 4050), and a third pose
// for the pull-back that converges near identity by 4100. Correction:
// per-frame in-plane similarity about the curve×line crossing,
//   T(p) = A + k·R(θ)·(p−A) + (ds, dy)      (wall units, y up),
// applied to the WallChart canvas. First row = identity, so every
// frame ≤3735 (incl. the f3700 anchor zero-seam and the 3572-3588
// crossfade) renders the exact original tree; the last row holds
// through the 4112-4131 fly-out.
const C2WREG: [number, number, number, number, number][] = [
  // [f, k, theta, ds, dy] — trimmed-robust fit, rms 0.5-2.4 wall units
  [3735, 1, 0, 0, 0],
  // hold-1 rows: r5 A/B'd these to identity — the fitted k≈1.07-1.10
  // regressed the 3850 gate .7405->.7191. Round 6 found TWO reasons and
  // fixed both: (1) the labels rode the transform, and the ref does NOT
  // scale its labels with the diagram redraw — they now live on their
  // own measured track (LT_FIX/LT_BASE, outside the transform); (2) the
  // fitted −0.02 rad roll was curve-shape leakage, not art pose — the
  // theta rows still lost at 3835/3850 (.7180→.7086, .7503→.7363) while
  // the NO-THETA refits of the same frames win big (3790 .8018→.8249,
  // 3820 .7076→.7515, 3835 .7180→.7504; 3850 .7503→.7470 is the one
  // residual, paid against +.076 net). Rows below are the no-theta fits
  // on a ≤10f grid (work/r6/c2 fitwall runs, rms 1.4-2.2 wall units).
  // The whip rows from 3863 keep their r5 theta fits — A/B'd better
  // there (the whip redraw really does roll).
  [3750, 1.0493, 0, 0.96, -0.03],
  [3765, 1.0778, 0, 0.26, -0.4],
  [3780, 1.0852, 0, 0.21, -0.51],
  [3800, 1.1024, 0, 0.62, -0.41],
  [3806, 1.1047, 0, 0.43, -0.45],
  [3816, 1.1003, 0, 0.08, -0.52],
  [3826, 1.1022, 0, -0.89, -0.56],
  [3836, 1.1103, 0, 0.07, -0.24],
  [3846, 1.1173, 0, 0.02, -0.12],
  [3856, 1.1198, 0, -0.67, -0.21],
  [3861, 1.1274, 0, -0.83, -0.17],
  [3863, 1.1236, -0.02078, 0.06, -0.97],
  [3875, 1.132, -0.01721, -0.35, -0.87],
  [3885, 1.1283, -0.02352, 0.04, -1.25],
  [3888, 1.1464, -0.02475, 0.04, -0.27],
  [3891, 1.1433, -0.02438, -1.41, -0.36],
  [3894, 1.1509, -0.01783, -1.02, 0.34],
  [3897, 1.1519, -0.00798, -1.05, 1.06],
  [3900, 1.1515, 0.00009, -0.55, 1.65],
  [3903, 1.1425, 0.01242, -0.68, 1.9],
  [3906, 1.1382, 0.01544, -0.24, 2.0],
  [3909, 1.1543, 0.02146, -0.49, 1.86],
  [3912, 1.1851, 0.02127, -0.32, 2.08],
  [3915, 0.9783, 0.01325, 0.8, -2.14],
  [3919, 0.9423, 0.01114, -4.57, -3.22],
  [3925, 0.9379, 0.00123, -0.07, 0.87],
  [3930, 0.9876, -0.00823, 1.07, 0.52],
  [3950, 0.9902, -0.00992, -0.42, 0.19],
  [3975, 0.971, -0.01256, 0.36, 0.82],
  [4000, 0.9818, -0.02025, -0.07, 1.08],
  [4025, 0.9597, -0.02891, 0.39, 2.0],
  [4050, 0.9633, -0.03453, -1.02, 1.98],
  [4065, 0.9779, 0.02121, 2.73, -1.02],
  [4075, 1.0527, 0.03553, 0.37, -7.02],
  [4089, 1.0443, 0.02623, -0.59, -2.5],
  [4100, 1.0154, 0.0141, -1.23, 0.7],
];
const wregRow = (i: 1 | 2 | 3 | 4) => C2WREG.map((r) => [r[0], r[i]] as [number, number]);
const WREG_K = wregRow(1);
const WREG_TH = wregRow(2);
const WREG_DS = wregRow(3);
const WREG_DY = wregRow(4);
type Wreg = { k: number; th: number; ds: number; dy: number };
const wregAt = (f: number): Wreg => ({
  k: lerp1(WREG_K, f),
  th: lerp1(WREG_TH, f),
  ds: lerp1(WREG_DS, f),
  dy: lerp1(WREG_DY, f),
});
// (a wall-space inverse restatement for the badge bboxes was A/B'd and
// LOST — the badges now draw outside the transform at their measured
// positions; see badgeWall and the draw's save/restore.)
// canvas-space form (canvas x = s − S0, y = Y_TOP − y_wall, y DOWN):
// G(c) = AC + (ds, −dy) + k·Rc(−θ)·(c − AC)
const WREG_ACX = S_CROSS - S0;
const WREG_ACY = Y_TOP - yLine(S_CROSS);

// ── measured label tracks (round 6) ──────────────────────────────
// The r6 diffgrids pinned a leading loss through 3811-3911 on the two
// wall labels: the ref redraws "Fixed rate"/"Base rate" nearly
// wall-locked in POSITION (bbox-left s ≈ −135.5 constant across the
// whole approach + whip) while their SIZE shrinks in wall units
// (56→47/52→44) — the hand keeps the text closer to screen-constant as
// the camera closes in. Our wall-locked 14px text (and the C2WREG k it
// rode through the whip) rendered 15-40% oversized and ~3-4 wall units
// off through the era (work/r6/c2/scanlbl.py: per-frame ref bboxes at
// ≤10f spacing, ours calibrated with the same scanner on the rendered
// base3850 still). Labels therefore leave the C2WREG transform inside
// (3735, 3920) and follow the measured track; outside that window the
// original in-transform typeIn runs, byte-identical. The 3735 row IS
// our identity pose (transform is identity there), so the switch is
// seamless; 3919 holds the 3901 row — the label is off-frame through
// the whip tail (ref scans clip at the frame edge from 3906).
const LT_FIX: [number, number, number, number][] = [
  // [f, bbox-left s, bbox-center y, wall width] (ref-measured)
  [3735, -131.366, 17.854, 57.588],
  [3750, -137.478, 17.723, 56.251],
  [3760, -137.713, 17.583, 55.475],
  [3770, -135.986, 15.919, 52.963],
  [3780, -136.083, 15.517, 52.268],
  [3790, -135.64, 15.049, 51.795],
  [3800, -135.451, 15.04, 51.759],
  [3811, -135.408, 14.921, 51.071],
  [3821, -134.931, 14.603, 50.555],
  [3831, -134.929, 14.504, 50.11],
  [3841, -135.689, 14.724, 50.145],
  [3851, -135.878, 14.228, 49.889],
  [3861, -135.548, 13.867, 48.873],
  [3871, -135.592, 13.491, 48.237],
  [3881, -135.293, 13.33, 47.736],
  [3891, -135.962, 13.097, 45.909],
  [3896, -135.612, 13.186, 46.438],
  [3901, -135.506, 12.751, 47.224],
  [3919, -135.506, 12.751, 47.224],
];
const LT_BASE: [number, number, number, number][] = [
  [3735, -126.795, -69.858, 55.264],
  [3750, -129.204, -68.882, 52.147],
  [3760, -129.017, -69.288, 51.721],
  [3770, -127.264, -68.405, 49.459],
  [3780, -127.582, -68.385, 48.883],
  [3790, -127.307, -68.079, 48.489],
  [3800, -126.787, -68.276, 48.029],
  [3811, -126.958, -67.745, 47.938],
  [3821, -126.172, -67.987, 47.018],
  [3831, -126.339, -67.586, 46.655],
  [3841, -126.794, -67.102, 46.76],
  [3851, -127.209, -66.956, 46.619],
  [3861, -127.165, -66.909, 45.758],
  [3871, -127.074, -66.801, 44.857],
  [3881, -126.94, -66.341, 44.846],
  [3886, -126.699, -65.932, 44.152],
  // (3891 scan merged with the curve — dropped; 3886→3896 interp)
  [3896, -126.297, -65.851, 43.141],
  [3901, -126.257, -67.629, 44.589],
  [3919, -126.257, -67.629, 44.589],
];
const ltRow = (T: [number, number, number, number][], i: 1 | 2 | 3) =>
  T.map((r) => [r[0], r[i]] as [number, number]);
const LTF_S = ltRow(LT_FIX, 1);
const LTF_Y = ltRow(LT_FIX, 2);
const LTF_W = ltRow(LT_FIX, 3);
const LTB_S = ltRow(LT_BASE, 1);
const LTB_Y = ltRow(LT_BASE, 2);
const LTB_W = ltRow(LT_BASE, 3);
// our identity label widths (wall units) + bbox-left-center → draw-anchor
// bearing (both measured on the base3850 still with the same scanner)
const LBL_W0_FIX = 57.588;
const LBL_W0_BASE = 55.264;
const LBL_D_FIX: Pt = [0.651, 0.139];
const LBL_D_BASE: Pt = [0.949, 0.162];
const lblTrackOn = (f: number) => f > 3735 && f < 3920;

// ── background-bar depth parallax ─────────────────────────────────
// The 11 gridlines/bars sit on a plane BEHIND the diagram. We take the
// fitted wall and push a copy of it back — uniformly scaled about the
// anchor camera pose (f3700) by BAR_K. Scaling about the camera leaves
// the anchor-frame projection pixel-identical to the front plane (zero
// seam at f3700), while every other camera pose sees the bars at BAR_K×
// depth, so they parallax at ~1/BAR_K of the diagram's screen motion.
// BAR_K = 3.41 lands the measured back-vs-front shift at ~0.27 at f3720
// (bold-black diagnostic render + OpenCV column detection).
const F_ANCHOR = 3700;
const ANCHOR_CAM: V3 = camFixed(F_ANCHOR);
// (the original constant BAR_K = 3.41 lives on as the first C2BAR rows)

// ── bar-layer refit (round 3) ────────────────────────────────────
// The reference's bar field is NOT rigidly attached to a single back
// plane: no constant depth K fits the scans (rms ≥ 80px across the
// window at any K given the orbit camera). Hand-drawn 2.5D — the bar
// layer pans/zooms with its own logic. So the layer gets a per-frame
// depth scale K(f) about the anchor camera (preserving the zero-seam
// at f3700 by construction) plus a lateral slide Ls(f) along the wall
// (wall-space units), both fitted to the scanned gridline columns at
// 0.5-5px RMS. K=3.41/Ls=0 up to f3720 keeps entry byte-identical;
// near the anchor pose K is visually inert, so the 3720→3750 ramp is
// masked by the pan.
const C2BAR: [number, number, number][] = [
  // [f, K, Ls]
  [3600, 3.41, 0],
  [3720, 3.41, 0],
  [3750, 1.3179, 16.89],
  [3765, 1.3497, 29.08],
  [3780, 1.3477, 32.32],
  [3795, 1.3492, 34.13],
  [3810, 1.3349, 33.63],
  [3825, 1.2683, 23.53],
  [3840, 1.2664, 23.49],
  [3855, 1.2573, 23.38],
  [3885, 1.2447, 24.92],
  [3930, 1.3621, 51.8],
  [3945, 1.3573, 51.59],
  [3960, 1.3594, 53.77],
  [3975, 1.3927, 63.78],
  [3990, 1.3989, 68.44],
  [4005, 1.3989, 71.89],
  [4020, 1.4112, 78.92],
  [4035, 1.4097, 82.75],
  [4050, 1.4076, 84.72],
  [4065, 1.4097, 26.53],
  [4080, 1.1556, -22.67],
  [4095, 1.3849, -2.32],
  [4110, 1.0698, -19.65],
];
const BAR_KT: [number, number][] = C2BAR.map((r) => [r[0], r[1]]);
const BAR_LT: [number, number][] = C2BAR.map((r) => [r[0], r[2]]);

// ── whip motion blur: RETIRED (round 3) ─────────────────────────
// Measured: reference frames 3885/3891/3897/3900/3903/3909/3915/3925
// are all SHARP — the hand-drawn reference has no motion blur through
// the whip. The 180°-shutter gaussian was theory; under the orbit-refit
// camera its per-frame deltas exploded and it cost −0.02 SSIM at f3900.
export const whipSigma = (_f: number): [number, number] => [0, 0];

// ── badges (unprojected at their pop frames with the solved camera) ──
const badgeWall = (
  frame: number,
  bbox: [number, number, number, number],
): { s: number; y: number; w: number; h: number } => {
  const cam = camRefit(frame);
  const yaw = camChart2Yaw(frame);
  const a = unprojToWall(WALL, bbox[0], bbox[1], cam, yaw);
  const b = unprojToWall(WALL, bbox[2], bbox[3], cam, yaw);
  // A/B (round 5): restating the badge bbox through wregInv(g(frame))
  // mis-sits BADGE1 during hold-1 (visible from its 3814 pop, where the
  // wall transform is identity) — the measured-position base wins at the
  // long static hold; the whip frames it costs are fast motion.
  return { s: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
};
const BADGE1 = badgeWall(3900, [412, 352, 462, 407]); // tail up
const BADGE2 = badgeWall(4020, [454, 176, 503, 226]); // tail down

// hatch polygons (wall space)
const CURVE_ARC = polyArc(CURVE);
const sampleLine = (s: number): Pt => [s, yLine(s)];
const regionPoly = (sA: number, sB: number): Pt[] => {
  const top: Pt[] = [];
  for (const p of CURVE) if (p[0] >= sA && p[0] <= sB) top.push(p);
  // interpolated ends on the curve
  const curveYat = (s: number): number => {
    for (let i = 0; i < CURVE.length - 1; i++) {
      const a = CURVE[i];
      const b = CURVE[i + 1];
      if (s >= a[0] && s <= b[0]) {
        const t = (s - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return CURVE[CURVE.length - 1][1];
  };
  const poly: Pt[] = [[sA, curveYat(sA)], ...top, [sB, curveYat(sB)], sampleLine(sB), sampleLine(sA)];
  return poly;
};
const REGION1 = regionPoly(CURVE[0][0], S_CROSS);
const REGION2 = regionPoly(S_CROSS, CURVE[CURVE.length - 1][0]);

// hatch lattices (round-5 measured, canvas coords: x = s − S0, y = Y_TOP − y).
// deg = stripe NORMAL angle from +x toward +y(down); stripes rise to the
// right at (deg − 90°) ≈ 40-44° screen-ish. pitch in wall units. ref/off:
// a light-stripe center passes `off` units along the normal from `ref`
// (the rectified measurement patch centroid — region-fixed).
// The rectified measurements were taken at f3850 (region 1) / f4050
// (region 2) and therefore CARRY the ref's redraw pose at those frames.
// hatchBase divides that pose out (canvas-space inverse of C2WREG), so
// the drawn lattice + the forward transform reproduces the measurement
// exactly at its frame and tracks the redraw everywhere else (verified:
// the ref's lattice angle follows the fitted art roll −0.020→0.000 rad
// between 3850 and 3900, and its pitch scales toward k).
type Hatch = { deg: number; pitch: number; ref: Pt; off: number; lw: number };
const hatchBaseG = (m: Hatch, g: Wreg): Hatch => {
  const a = (m.deg * Math.PI) / 180;
  const q: Pt = [m.ref[0] + m.off * Math.cos(a), m.ref[1] + m.off * Math.sin(a)];
  const c = Math.cos(g.th);
  const sn = Math.sin(g.th);
  const vx = q[0] - WREG_ACX - g.ds;
  const vy = q[1] - WREG_ACY + g.dy;
  return {
    deg: m.deg + (g.th * 180) / Math.PI,
    pitch: m.pitch / g.k,
    ref: [WREG_ACX + (c * vx - sn * vy) / g.k, WREG_ACY + (sn * vx + c * vy) / g.k],
    off: 0,
    lw: m.lw / g.k,
  };
};
const hatchBase = (m: Hatch & { f: number }): Hatch => hatchBaseG(m, wregAt(m.f));
const HATCH1_M: Hatch = { deg: 46.1, pitch: 4.06, ref: [161.054, 172.714], off: -1.262, lw: 1.35 };
// Round 6: the region-1 lattice base is era-dependent, because the
// measurement (rectified at f3850) carries the ref's redraw pose there
// and the APPLIED rows differ per era from the true art pose:
// - hold-1 (≤3856): rows are the no-theta fits (below), so dividing the
//   applied 3850 pose out (dynamic hatchBase) reproduces the
//   measurement at 3850 and drifts only with the slow hold redraw.
// - whip (3863-3912): rows ARE the r5 theta fits, so the base must
//   divide the theta ART pose at 3850 (k1.1022, th−0.02022) — under the
//   r5 identity-divide the whip hatch was double-scaled ~10% (the
//   measurement already carried the 3850 pose and the whip k scaled it
//   again); gates 3868 .7084→.7177, 3885 .7162→.7276 from this alone,
//   and the roll-less divide lost .013 of it back.
// - hold-2 (≥3919): the r5-committed identity-divide base, so every
//   frame ≥3919 — the protected 4039-4089 window and the 4050 seam —
//   stays byte-identical.
// Bases blend across 3856-3863 and the whip tail 3912-3919.
const HATCH1_H1 = hatchBase({ ...HATCH1_M, f: 3850 });
const HATCH1_W = hatchBaseG(HATCH1_M, { k: 1.1022, th: -0.02022, ds: -0.63, dy: -1.27 });
const HATCH1_B = hatchBaseG(HATCH1_M, { k: 1, th: 0, ds: 0, dy: 0 });
const hatchLerp = (a: Hatch, b: Hatch, t: number): Hatch => ({
  deg: a.deg + (b.deg - a.deg) * t,
  pitch: a.pitch + (b.pitch - a.pitch) * t,
  ref: [a.ref[0] + (b.ref[0] - a.ref[0]) * t, a.ref[1] + (b.ref[1] - a.ref[1]) * t],
  off: 0,
  lw: a.lw + (b.lw - a.lw) * t,
});
const hatch1At = (f: number): Hatch => {
  if (f <= 3856) return HATCH1_H1;
  if (f < 3863) return hatchLerp(HATCH1_H1, HATCH1_W, (f - 3856) / 7);
  if (f <= 3912) return HATCH1_W;
  if (f < 3919) return hatchLerp(HATCH1_W, HATCH1_B, (f - 3912) / 7);
  return HATCH1_B;
};
const HATCH2 = hatchBase({ deg: 50.2, pitch: 4.535, ref: [378.555, 126.157], off: -0.986, lw: 1.5, f: 4050 });

const C = {
  gridA: "#EDEDED",
  gridB: "#F6F6F6",
  fixed: "#6B6B6D",
  curve: "#C62E2F",
  dash: "#76D1BE",
  guide: "#E0E0E0",
  // hatch inks re-measured round 5 (rectified ref cores, f4050/f3850):
  // the ref draws WIDE dark bands with NARROW light stripes — the old
  // light-fill + thin dark line had the duty cycle inverted.
  hatchBand: "#AEBEBE", // dark band (fill)
  hatchLight: "#CCDCDC", // light stripe
  badge: "#48B0C9",
  badgeBorder: "#3C7A8E",
  lblFix: "#777777",
  lblBase: "#B23331",
  legendTxt: "#9B9B9B",
  legendBadge: "#58ADC2",
} as const;

const fade = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1, b - a));
const pop = (f: number, a: number, b: number) => {
  const t = fade(f, a, b);
  if (t <= 0) return 0;
  const over = 1.18;
  if (t < 0.7) return over * easeOutPow(t / 0.7, 2);
  return over - (over - 1) * ((t - 0.7) / 0.3);
};


// ── floor set dressing (static; all quads measured at f3700 identity) ──
const flr = (u: number, v: number): Pt => {
  const p = unprojToFloor(u, v, FLOOR_Y);
  return [p[0], p[2]]; // world x, z
};
const FLOOR_C: Pt = [0, -350];
const FLOOR_WD = 1400;
const FLOOR_HT = 1200;

// ── floor-set placement refit (round 4) ──────────────────────────
// The reference redraws its floor NON-rigidly between camera holds — the
// same hand-drawn 2.5D as the wall bars (C2BAR). Through hold 1
// (3750-3885) its card cluster sits ~150px right / ~20px lower than our
// static floor projects (scanc2floor.py centroid scan, r4/c2f), and the
// centroid-only unprojection fit LOSES SSIM (the teal mask ignores the
// heavy grey cards, whose internal layout the ref redraws) — so the final
// values are a rendered-still SSIM grid search per anchor frame (search.py,
// floor-band crop objective, full-frame gated), constrained to keep the
// cluster visibly under the chart: SSIM's unconstrained optimum slides the
// ink off-frame, which the ground rule forbids. Hold 2 (3930→end) measured
// best at identity, so the correction retires at 3930 — everything from
// there through the 4133-4155 fade-out is byte-identical to the pre-refit
// build (freeze rule trivially satisfied). Identity rows return the EXACT
// original JSX tree, so f<=3720 and the 3572-3588 crossfade are also
// byte-identical. The whip rows (3900/3915) re-fit per-frame; lerp1
// interpolates between holds.
const C2FLR: [number, number, number, number][] = [
  // [f, dx, dz, s]
  [3720, 0, 0, 1],
  [3735, 80, 40, 1],
  [3750, 160, 80, 1],
  [3810, 160, 90, 1],
  [3850, 190, 100, 1.15],
  [3885, 190, 100, 1.15],
  [3900, 44, 267, 1.3],
  [3915, -58, 45, 1],
  [3930, 0, 0, 1],
];
// r6 NEGATIVE A/B: replacing the 3811-3901 block with per-frame all-ink
// trimmed-ICP floor fits (work/r6/c2/floorfit.py, red+teal+grey classes,
// rms 15-26 floor units) LOST at every gate — 3826 .7296→.7275, 3850
// .7470→.7458, 3871 .7169→.7146, 3886 .7247→.7230, 3905 .6619→.6550.
// Fifth confirmation: mask-fit optima lose to the r4 rendered-still SSIM
// search that produced the rows above (the ref redraws the cards'
// internal layout, so any floor similarity leaves 20+ units of residual
// and the ICP spends it on the wrong elements). A red-ink-only fit for
// the bottom-right map squiggle diverged outright (the mask catches the
// wall curve and the ±90-unit prefilter can't hold it) — the squiggle
// needs its own scanner before its bolding can ship (ref draws it as a
// dark double stroke; ours is pale #DC9DA0 — presence noted, position
// track missing).
const FLR_DX: [number, number][] = C2FLR.map((r) => [r[0], r[1]]);
const FLR_DZ: [number, number][] = C2FLR.map((r) => [r[0], r[2]]);
const FLR_S: [number, number][] = C2FLR.map((r) => [r[0], r[3]]);
const FLR_ANCHOR: Pt = flr(390, 334); // teal card-cluster center (identity pose)

export const FloorSet: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
    const mx = (p: Pt) => w / 2 + (p[0] - FLOOR_C[0]);
    const my = (p: Pt) => h / 2 + (p[1] - FLOOR_C[1]);
    const path = (scr: Pt[], close: boolean) => {
      const pts = scr.map(([u, v]) => flr(u, v));
      ctx.beginPath();
      ctx.moveTo(mx(pts[0]), my(pts[0]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(mx(pts[i]), my(pts[i]));
      if (close) ctx.closePath();
    };
    const quad = (scr: Pt[], fill: string | null, stroke: string | null, lw = 1.4) => {
      path(scr, true);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };
    const line = (scr: Pt[], stroke: string, lw: number) => {
      path(scr, false);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    // sheets
    quad([[337, 317], [454, 328], [353, 406], [195, 381]], "#FCFCFB", "#CFCFCC");
    quad([[454, 328], [589, 342], [555, 438], [353, 406]], "#FCFCFB", "#CFCFCC");
    // rect cluster on left sheet
    quad([[339, 321], [368, 325], [343, 338], [312, 334]], "#D1D1D1", null);
    quad([[377, 324], [407, 328], [393, 336], [363, 332]], "#D8D8D8", null);
    quad([[404, 328], [437, 330], [431, 337], [398, 336]], "#CCE4EC", null);
    quad([[355, 334], [423, 341], [420, 347], [352, 340]], "#D8EAEE", null);
    quad([[240, 369], [273, 374], [263, 384], [218, 378]], "#BFE0E4", null);
    // red squiggle (right sheet)
    line(
      [[456, 340.5], [464, 342.5], [480, 346], [491, 354], [501, 353.5], [512, 359],
       [522, 360], [533, 364], [543, 365.5], [565, 367]],
      "#DC9DA0", 1.8,
    );
    // 13 ruled diagonals fanning across the right sheet
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const top: Pt = [418 + (557 - 418) * t, 376 + (393 - 376) * t];
      const bot: Pt = [385 + (544 - 385) * t, 405 + (427 - 405) * t];
      line([top, bot], "#DDDDDD", 1.1);
    }
    // dusty-red map borders + dots
    line([[607, 341], [585, 443]], "#C09090", 2);
    line([[205, 393], [581, 459]], "#D4B4B6", 2);
    line([[320, 318], [177, 377]], "#D7C4C6", 2);
    const dot = (u: number, v: number, r: number, fill: string) => {
      const p = flr(u, v);
      ctx.beginPath();
      ctx.arc(mx(p), my(p), r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    dot(578, 456, 3.5, "#B98A8C");
    dot(328, 313, 3, "#C9A9AB");
    line([[177, 387], [339, 399]], "#D6D6D3", 1.6);
  }, []);
  // texture stays static (frame={0}); only the material opacity animates —
  // in over 3518-3544 (r7 strike-3: the ref crossfades the buildings map
  // to THIS chart paper through the pre-spin recede — faint 3518, clear
  // 3528, dominant 3544 — then the paper rides the exit spin about the
  // cluster axis and lands here, its own pose, at the exact-360 closure
  // f3574; the old 3572-3584 fade-in was the "cards pop from nothing"
  // defect), out over 4133-4155 (the next scene's FloorPaper inks in).
  const plane = (
    <CanvasPlane
      frame={0}
      width={FLOOR_WD}
      height={FLOOR_HT}
      res={1}
      position={[FLOOR_C[0], FLOOR_Y, FLOOR_C[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      draw={draw}
      renderOrder={0}
      opacity={fade(frame, 3518, 3544) * (1 - fade(frame, 4133, 4155))}
    />
  );
  // placement refit: floor point Q → A + s·(Q−A) + (dx,dz) on the plane
  // (y untouched). Identity returns the exact original tree.
  const dx = lerp1(FLR_DX, frame);
  const dz = lerp1(FLR_DZ, frame);
  const s = lerp1(FLR_S, frame);
  if (dx === 0 && dz === 0 && s === 1) return plane;
  return (
    <group position={[FLR_ANCHOR[0] + dx, 0, FLR_ANCHOR[1] + dz]} scale={[s, 1, s]}>
      <group position={[-FLR_ANCHOR[0], 0, -FLR_ANCHOR[1]]}>{plane}</group>
    </group>
  );
};

// ── the wall chart canvas ────────────────────────────────────────
const WallChart: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    const mS = (s: number) => s - S0;
    const mY = (y: number) => Y_TOP - y;
    // wall-layer registration (C2WREG): in-plane similarity about the
    // crossing, canvas form (y down ⇒ rotate −θ, translate (ds, −dy)).
    // Identity rows skip the ops entirely — exact original rasterization.
    // The badges are drawn AFTER the matching restore — they were each
    // measured at their own frame and win at their measured positions
    // under every pose (A/B: riding the transform lost at 3850 hold-1
    // and at the 3900 whip alike).
    ctx.save();
    const g = wregAt(f);
    if (g.k !== 1 || g.th !== 0 || g.ds !== 0 || g.dy !== 0) {
      ctx.translate(WREG_ACX + g.ds, WREG_ACY - g.dy);
      ctx.rotate(-g.th);
      ctx.scale(g.k, g.k);
      ctx.translate(-WREG_ACX, -WREG_ACY);
    }
    const poly = (pts: Pt[]) => {
      ctx.beginPath();
      ctx.moveTo(mS(pts[0][0]), mY(pts[0][1]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(mS(pts[i][0]), mY(pts[i][1]));
    };
    // gridlines/bars now live on the back parallax plane (GridWall) —
    // pushed behind the diagram so they register at f3700 and lag under
    // the camera move at depth ratio ~0.27.
    // hatched regions (region1 sweep 3806-3820; region2 3994-4006).
    // Round-5 refit: the lattice was measured per region by rectifying the
    // reference frames into wall-canvas space through the exact solved
    // camera (work/r5/c2/rectify.py). The ref hatch is dark bands with
    // narrow light stripes (light duty ~1/3) — NOT thin dark lines on a
    // light fill — and each region carries its own angle/pitch/phase
    // (the hand-drawn ref redraws the two regions independently). Phase
    // is anchored to a region-fixed canvas point (the measured patch
    // centroid): a light-stripe center passes `off` canvas units along
    // the normal from `ref`.
    const sweep = (
      polyPts: Pt[], sA: number, sB: number, t: number,
      hs: { deg: number; pitch: number; ref: Pt; off: number; lw: number },
    ) => {
      if (t <= 0) return;
      ctx.save();
      const sEnd = sA + (sB - sA) * t;
      ctx.beginPath();
      ctx.rect(mS(sA) - 2, 0, mS(sEnd) - mS(sA) + 2, h);
      ctx.clip();
      poly(polyPts);
      ctx.closePath();
      ctx.fillStyle = C.hatchBand;
      ctx.fill();
      // light stripes over the dark band fill
      ctx.save();
      poly(polyPts);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = C.hatchLight;
      ctx.lineWidth = hs.lw;
      const a = (hs.deg * Math.PI) / 180;
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      const qRef = hs.ref[0] * nx + hs.ref[1] * ny + hs.off;
      for (let k = -220; k <= 220; k++) {
        const q = qRef + k * hs.pitch;
        ctx.beginPath();
        ctx.moveTo(nx * q + ny * 700, ny * q - nx * 700);
        ctx.lineTo(nx * q - ny * 700, ny * q + nx * 700);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    };
    sweep(REGION1, CURVE[0][0], S_CROSS, easeInOutCubic(fade(f, 3806, 3820)), hatch1At(f));
    sweep(REGION2, S_CROSS, CURVE[CURVE.length - 1][0], easeInOutCubic(fade(f, 3994, 4006)), HATCH2);
    // faint horizontal dashed guide
    if (f >= 3610) {
      ctx.strokeStyle = C.guide;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(mS(GUIDE_A[0]), mY(GUIDE_A[1]));
      ctx.lineTo(mS(GUIDE_B[0]), mY(GUIDE_B[1]));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // fixed-rate line (draw 3584-3608 L→R)
    const fT = easeOutPow(fade(f, 3584, 3608), 1.6);
    if (fT > 0) {
      ctx.strokeStyle = C.fixed;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(mS(FIX_A[0]), mY(FIX_A[1]));
      const e: Pt = [FIX_A[0] + (FIX_B[0] - FIX_A[0]) * fT, FIX_A[1] + (FIX_B[1] - FIX_A[1]) * fT];
      ctx.lineTo(mS(e[0]), mY(e[1]));
      ctx.stroke();
    }
    // green dashed vertical (draw 3586-3610 top→bottom)
    // ref pattern: dash longer than gap, thin stroke
    const dT = fade(f, 3586, 3610);
    if (dT > 0) {
      ctx.strokeStyle = C.dash;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([5.2, 3.2]);
      ctx.beginPath();
      ctx.moveTo(mS(DASH_T[0]), mY(DASH_T[1]));
      const yEnd = DASH_T[1] + (DASH_B[1] - DASH_T[1]) * dT;
      ctx.lineTo(mS(DASH_B[0]), mY(yEnd));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // base-rate curve (draw 3599-3639 ease-out along arc) — smoothed
    // through midpoints (the raw polyline kinked at every sample)
    const cT = easeOutPow(fade(f, 3599, 3639), 1.8);
    if (cT > 0) {
      const pts = polyUpToArc(CURVE, CURVE_ARC.cum, CURVE_ARC.total * cT);
      if (pts.length >= 2) {
        ctx.strokeStyle = C.curve;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(mS(pts[0][0]), mY(pts[0][1]));
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (mS(pts[i][0]) + mS(pts[i + 1][0])) / 2;
          const yc = (mY(pts[i][1]) + mY(pts[i + 1][1])) / 2;
          ctx.quadraticCurveTo(mS(pts[i][0]), mY(pts[i][1]), xc, yc);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(mS(last[0]), mY(last[1]));
        ctx.stroke();
      }
    }
    // labels (type-in via clip)
    const typeIn = (
      text: string, at: Pt, color: string, size: number, a: number, b: number, weight = 600,
    ) => {
      const t = fade(f, a, b);
      if (t <= 0) return;
      ctx.save();
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.textBaseline = "middle";
      const full = ctx.measureText(text).width;
      ctx.beginPath();
      ctx.rect(mS(at[0]) - 2, mY(at[1]) - size, full * t + 4, size * 2);
      ctx.clip();
      ctx.save();
      ctx.translate(mS(at[0]), mY(at[1]));
      ctx.rotate((3 * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();
      ctx.restore();
    };
    // labels: measured per-frame track owns them inside (3735, 3920) —
    // drawn after the restore, outside the C2WREG scale (round 6).
    if (!lblTrackOn(f)) {
      typeIn("Fixed rate", [LBL_FIX[0] + 5, LBL_FIX[1] + 2], C.lblFix, 14, 3584, 3592);
      typeIn("Base rate", [LBL_BASE[0] + 5, LBL_BASE[1] + 2], C.lblBase, 14, 3584, 3590, 700);
    }
    // badges on the chart (pop with overshoot)
    const badge = (
      bd: { s: number; y: number; w: number; h: number },
      label: string,
      tailUp: boolean,
      sc: number,
    ) => {
      if (sc <= 0) return;
      ctx.save();
      ctx.translate(mS(bd.s), mY(bd.y));
      ctx.scale(sc, sc);
      const bw = bd.w;
      const bh = bd.h * 0.82;
      const r = bw * 0.18;
      ctx.fillStyle = C.badge;
      ctx.strokeStyle = C.badgeBorder;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-bw / 2 + r, -bh / 2);
      ctx.arcTo(bw / 2, -bh / 2, bw / 2, bh / 2, r);
      ctx.arcTo(bw / 2, bh / 2, -bw / 2, bh / 2, r);
      ctx.arcTo(-bw / 2, bh / 2, -bw / 2, -bh / 2, r);
      ctx.arcTo(-bw / 2, -bh / 2, bw / 2, -bh / 2, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // tail
      ctx.beginPath();
      if (tailUp) {
        ctx.moveTo(-bw * 0.18, -bh / 2);
        ctx.lineTo(bw * 0.06, -bh / 2 - bd.h * 0.18);
        ctx.lineTo(bw * 0.3, -bh / 2);
      } else {
        ctx.moveTo(-bw * 0.18, bh / 2);
        ctx.lineTo(bw * 0.06, bh / 2 + bd.h * 0.18);
        ctx.lineTo(bw * 0.3, bh / 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 ${bh * 0.72}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, bh * 0.04);
      ctx.restore();
    };
    ctx.restore(); // end C2WREG — badges draw at measured positions
    // tracked labels (round 6): ref-measured pose + size, no k-scale
    if (lblTrackOn(f)) {
      const trkLbl = (
        text: string, S: [number, number][], Y: [number, number][],
        W: [number, number][], w0: number, d: Pt, color: string, weight: number,
      ) => {
        const sc = lerp1(W, f) / w0;
        const ax = lerp1(S, f) - d[0] * sc;
        const ay = lerp1(Y, f) - d[1] * sc;
        ctx.save();
        ctx.font = `${weight} ${14 * sc}px ${FONT}`;
        ctx.fillStyle = color;
        ctx.textBaseline = "middle";
        ctx.translate(mS(ax), mY(ay));
        ctx.rotate((3 * Math.PI) / 180);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      };
      trkLbl("Fixed rate", LTF_S, LTF_Y, LTF_W, LBL_W0_FIX, LBL_D_FIX, C.lblFix, 600);
      trkLbl("Base rate", LTB_S, LTB_Y, LTB_W, LBL_W0_BASE, LBL_D_BASE, C.lblBase, 700);
    }
    badge(BADGE1, "1", true, pop(f, 3814, 3824));
    badge(BADGE2, "2", false, pop(f, 3994, 4004));
  }, []);
  return (
    <CanvasPlane
      frame={frame}
      width={WALL_W}
      height={WALL_H}
      res={3}
      position={wallToWorld(WALL, (S0 + S1) / 2, (Y_TOP + Y_BOT) / 2)}
      rotation={[0, WALL.yawRad, 0]}
      draw={draw}
      renderOrder={2}
    />
  );
};

// ── background bars (back parallax plane) ────────────────────────
// The 11 gridlines + skirting, drawn in the SAME wall-canvas space as the
// front wall but carried on a plane pushed back by BAR_K about the anchor
// camera. Identical drawing code → identical texel content; the group
// scale is a pure scale-about-camera, so at f3700 this projects pixel-for-
// pixel onto where the front wall drew the bars, then lags on the pan.
const GridWall: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, _w: number, _h: number) => {
    const mS = (s: number) => s - S0;
    const mY = (y: number) => Y_TOP - y;
    // r7 strike-3: the ref's gridlines enter f3570-3577 SEQUENTIALLY,
    // left to right, each line rising TILTED (~10-15° early, steeper for
    // late arrivals; contrast-stretched crops in work/r7/spin/att/
    // refgrid-strip.png) and rotating about its OWN FOOT on the floor
    // junction until vertical — the spin's tail carried onto the wall.
    // Everything settles by 3580; from there this branch draws the exact
    // settled grid the old code drew at wipe-end, so >=3584 (and the
    // whole hold) is byte-identical. NEGATIVE A/Bs (measured, in
    // IRSwapComposition history — do not retry): (1) vertical-axis yaw
    // wrappers (cluster axis / wall-center axis) can NEVER tilt the
    // lines — a level camera keeps world-vertical lines screen-vertical,
    // the grid only slid sideways (.8728-.8766 at 3572-3578 gates);
    // (2) a rigid ROLL about the wall's normal through the base center
    // tilts the floor junction with the lines — the ref keeps every foot
    // planted. Per-line foot-pivot rotation is the measured grammar.
    if (f >= 3580) {
      // settled grid (identical rasterization to the old wipe's end)
      for (let i = 0; i < GRID_S.length; i++) {
        ctx.strokeStyle = i % 2 === 0 ? C.gridA : C.gridB;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(mS(GRID_S[i]), mY(GRID_TOP_Y));
        ctx.lineTo(mS(GRID_S[i]), mY(GRID_BOT_Y));
        ctx.stroke();
      }
      ctx.strokeStyle = "#E0E0DF";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(mS(GRID_S[0]) - 30, mY(GRID_BOT_Y));
      ctx.lineTo(mS(GRID_S[GRID_S.length - 1]) + 40, mY(GRID_BOT_Y));
      ctx.stroke();
      return;
    }
    if (f < 3570) return;
    const H = GRID_TOP_Y - GRID_BOT_Y;
    const PHI0 = (25 * Math.PI) / 180; // arrival lean (rad), tops screen-left
    for (let i = 0; i < GRID_S.length; i++) {
      const a0 = 3570 + i * 0.75; // staggered arrival, left to right
      const al = fade(f, a0, a0 + 1.5);
      if (al <= 0) continue;
      const settleEnd = Math.min(a0 + 6, 3580);
      const u = clamp01((f - a0) / (settleEnd - a0));
      const phi = PHI0 * (1 - u) * (1 - u);
      ctx.globalAlpha = al;
      ctx.strokeStyle = i % 2 === 0 ? C.gridA : C.gridB;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(mS(GRID_S[i]), mY(GRID_BOT_Y));
      ctx.lineTo(mS(GRID_S[i] - H * Math.sin(phi)), mY(GRID_BOT_Y + H * Math.cos(phi)));
      ctx.stroke();
    }
    // skirting rises with the later lines (ref junction reads ~3574+)
    const aS = fade(f, 3574, 3578);
    if (aS > 0) {
      ctx.globalAlpha = aS;
      ctx.strokeStyle = "#E0E0DF";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(mS(GRID_S[0]) - 30, mY(GRID_BOT_Y));
      ctx.lineTo(mS(GRID_S[GRID_S.length - 1]) + 40, mY(GRID_BOT_Y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, []);
  // back plane center = anchor-camera + K(f)·(wallCenter − anchor-camera);
  // expressed as the front wall's local offset inside a scale-about-camera
  // group. Round 3: K animates (C2BAR) and the layer slides Ls(f) along the
  // wall — see the bar-layer refit note above. K=3.41/Ls=0 through f3720
  // reproduces the original mount exactly (adding dirS·0 is exact in IEEE).
  const K = lerp1(BAR_KT, frame);
  const Ls = lerp1(BAR_LT, frame);
  const local: V3 = [
    WC3[0] + WALL.dirS[0] * Ls - ANCHOR_CAM[0],
    WC3[1] - ANCHOR_CAM[1],
    WC3[2] + WALL.dirS[2] * Ls - ANCHOR_CAM[2],
  ];
  return (
    <group position={ANCHOR_CAM} scale={[K, K, K]}>
      <CanvasPlane
        frame={frame}
        width={WALL_W}
        height={WALL_H}
        res={3}
        position={local}
        rotation={[0, WALL.yawRad, 0]}
        draw={draw}
        renderOrder={1}
      />
    </group>
  );
};

// ── screen-anchored legend ───────────────────────────────────────
const LegendBadge: React.FC<{ x: number; y: number; scale: number; label: string }> = ({
  x, y, scale, label,
}) => {
  if (scale <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${scale})` }}>
      <div
        style={{
          width: 34, height: 31, background: C.legendBadge, borderRadius: 6,
          border: `1.5px solid ${C.badgeBorder}`, display: "flex", alignItems: "center",
          justifyContent: "center", color: "#fff", fontFamily: FONT, fontWeight: 600, fontSize: 21,
          position: "relative",
        }}
      >
        {label}
        <div
          style={{
            position: "absolute", left: -9, top: 11, width: 0, height: 0,
            borderTop: "5px solid transparent", borderBottom: "5px solid transparent",
            borderRight: `9px solid ${C.legendBadge}`,
          }}
        />
      </div>
    </div>
  );
};

const Legend: React.FC<{ frame: number }> = ({ frame }) => {
  const s1 = pop(frame, 3814, 3824);
  const s2 = pop(frame, 3994, 4004);
  const out = 1 - fade(frame, 4112, 4126);
  if (out <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {s1 > 0 && (
        <div
          style={{
            position: "absolute", left: 622, top: 64, width: 90, textAlign: "right",
            fontFamily: FONT, fontSize: 14, color: C.legendTxt, fontWeight: 600,
            transform: `scale(${Math.min(1, s1)})`,
          }}
        >
          Bank Debit
        </div>
      )}
      <LegendBadge x={745} y={73} scale={s1} label="1" />
      {s2 > 0 && (
        <div
          style={{
            position: "absolute", left: 608, top: 99, width: 100, textAlign: "right",
            fontFamily: FONT, fontSize: 14, color: C.legendTxt, fontWeight: 600,
            transform: `scale(${Math.min(1, s2)})`,
          }}
        >
          Bank Credit
        </div>
      )}
      <LegendBadge x={745} y={111} scale={s2} label="2" />
    </AbsoluteFill>
  );
};

// ── scene ────────────────────────────────────────────────────────
// World = everything inside <Room> except the camera; Overlay = the
// screen-anchored DOM legend. Chart2 wires them together unchanged.
export const Chart2World: React.FC<{ frame: number }> = ({ frame }) => {

  // fly-out 4112-4131: wall assembly shrinks + flies up-right, slight roll
  const flyT = easeInPow(fade(frame, 4112, 4131), 1.6);
  const wallCenter = WC3;
  const flyScale = Math.max(0.02, 1 - 0.98 * flyT);

  return (
    <>
      {/* FloorSet now lives on the persistent ground layer (orchestrator) */}
      {flyT < 1 && (
        <group
          position={[wallCenter[0] + 430 * flyT, wallCenter[1] + 310 * flyT, wallCenter[2]]}
          rotation={[0, 0, -0.35 * flyT]}
          scale={[flyScale, flyScale, flyScale]}
        >
          <group position={[-wallCenter[0], -wallCenter[1], -wallCenter[2]]}>
            <GridWall frame={frame} />
            <WallChart frame={frame} />
          </group>
        </group>
      )}
    </>
  );
};

export const Chart2Overlay: React.FC<{ frame: number }> = ({ frame }) => <Legend frame={frame} />;


