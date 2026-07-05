// Frames 1705-3587: the buildings map — LENDER / COMPANY / BANK on a
// hand-drawn city plan, orbiting camera, rate arrows and ticking labels.
// 3D: true extruded buildings (Buildings3D) + floor in a ThreeCanvas.
// Camera path = offline-solved key table (data/buildings3d.ts): apex
// tracks + building-corner measurements, bundle-adjusted. The rate
// arrows/labels of phases A-C live on two world planes (~99 deg apart);
// the phase-D two-shot overlays and the panel stay screen-space.

import React, { useCallback } from "react";
import {
  AbsoluteFill,
} from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import * as THREE from "three";
import {
  P1, TICKS_A, TICKS_C, BCOLORS, ANCHOR_1900, ANCHOR_3300, ANCHOR_3450,
  D_FIX, D_ARR_FIX, E_FIX, ROAD_FIX, ROAD_SQZ,
} from "../data/buildings";
import type { TrackRow } from "../data/buildings";
import { B3D, CAM_KEYS_3D, PLQ_FIX, PLQ_D_FIX, PLQ_TILT_FIX } from "../data/buildings3d";
import { bldPitchAt, buildingsPose, T_BLD } from "../lib/camera";
import { ArrowPlanes, Building3D } from "./Buildings3D";
import type { ArrowAlphas } from "./Buildings3D";
import { clamp01, lerp1, lerpTrack } from "../lib/helpers";
import type { Pt } from "../lib/helpers";
import {
  CanvasPlane, DCAM, unprojToFloor,
} from "../lib/world";
import type { V3 } from "../lib/world";

const { fontFamily: FONT } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});


// ── world model ──────────────────────────────────────────────────
// Anchor frame 2500 = identity camera, yaw 0. Depths from floor contact.
const FLOOR_Y = -170;
// legacy anchor depths (still used by the plaque sprites)
const depthOf = (baseV: number) => {
  // ground contact v → floor depth
  const t = -FLOOR_Y / ((baseV - 240) / DCAM);
  return DCAM - t; // z
};
const zL = depthOf(428);
const zC = depthOf(368);
const zB = depthOf(396);
const unprojAtZ = (u: number, v: number, z: number): V3 => {
  const d = DCAM - z;
  return [((u - 427) * d) / DCAM, ((240 - v) * d) / DCAM, z];
};
const W2: V3 = unprojAtZ(212, 304, zL); // legacy lender anchor
const PIVOT: V3 = [W2[0], 0, W2[2]]; // orbit pivot near LENDER

// rotate a point about the vertical pivot axis by yaw g
const rotP = (p: V3, g: number): V3 => {
  const c = Math.cos(g);
  const s = Math.sin(g);
  const dx = p[0] - PIVOT[0];
  const dz = p[2] - PIVOT[2];
  return [PIVOT[0] + c * dx + s * dz, p[1], PIVOT[2] - s * dx + c * dz];
};

// Camera path: offline-solved key table (see data/buildings3d.ts).
const camCx: [number, number][] = CAM_KEYS_3D.map((k) => [k[0], k[1]]);
const camCy: [number, number][] = CAM_KEYS_3D.map((k) => [k[0], k[2]]);
const camCz: [number, number][] = CAM_KEYS_3D.map((k) => [k[0], k[3]]);
const camG: [number, number][] = CAM_KEYS_3D.map((k) => [k[0], k[4]]);
// r7 ride smoothing (owner: "sometimes the house moves, while only camera
// should move"). Linear key interpolation put a velocity STEP at every 15f
// key — mean 0.33 px/f, up to 2.3 px/f of instantaneous screen-velocity
// change on the building centers — which reads as the houses hitching once
// per 0.6 s while the reference camera glides. Catmull-Rom passes through
// every key EXACTLY (the module-scope datums camBld(2505)/camBld(3540) and
// both handoff clamps camBld(1705)/camBld(3580) are key/clamp evaluations,
// so T_BLD, T_C2, plaqueWorld and FLOORMAP are all bit-identical) and is
// C1 between keys: key-frame velocity steps drop to <=0.27 px/f. Measured
// path deviation stays under 1.5px except inside the entry swing and the
// f3112-3191 whip (<=4.2px there, where the camera moves 20-30 px/f).
// The exit whip f>=CR_END keeps the exact linear ride so the round-7
// transition rebuild (other lane) sees byte-identical frames.
const CR_END = 3510;
const cr1 = (tbl: [number, number][], f: number): number => {
  const n = tbl.length;
  if (f <= tbl[0][0]) return tbl[0][1];
  if (f >= tbl[n - 1][0]) return tbl[n - 1][1];
  let i = 0;
  while (tbl[i + 1][0] < f) i++;
  const [x0, y0] = tbl[i];
  const [x1, y1] = tbl[i + 1];
  const h = x1 - x0;
  const t = (f - x0) / h;
  const m0 = i > 0 ? (y1 - tbl[i - 1][1]) / (x1 - tbl[i - 1][0]) : (y1 - y0) / h;
  const m1 = i + 2 < n ? (tbl[i + 2][1] - y0) / (tbl[i + 2][0] - x0) : (y1 - y0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 +
    (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1
  );
};
export const camBld = (f: number): { cam: V3; g: number } =>
  f >= CR_END
    ? {
        cam: [lerp1(camCx, f), lerp1(camCy, f), lerp1(camCz, f)],
        g: lerp1(camG, f),
      }
    : {
        cam: [cr1(camCx, f), cr1(camCy, f), cr1(camCz, f)],
        g: cr1(camG, f),
      };

// ── r7 strike-3: the exit spin (f3551-3574) ──────────────────────
// The reference leaves the buildings scene by spinning the WHOLE scene
// group — three buildings + plaques + the floor beneath — one full turn
// about a VERTICAL axis through the cluster's own centroid while the ink
// fades out (measured, .claude/rounds/work/r7/spin/report.md +
// spin-measure.json: bank-centroid orbit anchors at f3551/3558.5/3563/
// 3566.7/3572.5; direction = clockwise seen from above, near facades
// sweep screen-left = turntable g DECREASING; peak 24 deg/f at
// f3563-3567, still ~15 deg/f at building extinction — the buildings
// never settle; the floor carries the settle and lands at exactly 360°
// (== identity) on the chart2 tablet pose at f3574).
const SPIN_TH: [number, number][] = [
  [3551, 0], [3554, 26], [3558, 62], [3560, 96], [3562, 136], [3563, 156],
  [3565, 205], [3567, 251], [3569, 282], [3571, 313], [3573, 343], [3574, 360],
];
// Monotone cubic (Fritsch–Carlson / PCHIP): C1 between the dense measured
// keys with NO overshoot — theta must stay monotone and hit 360 exactly
// at the 3574 closure (Catmull-Rom could overshoot past 360 mid-segment).
const pchip1 = (tbl: [number, number][], f: number): number => {
  const n = tbl.length;
  if (f <= tbl[0][0]) return tbl[0][1];
  if (f >= tbl[n - 1][0]) return tbl[n - 1][1];
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(tbl[i + 1][0] - tbl[i][0]);
    d.push((tbl[i + 1][1] - tbl[i][1]) / h[i]);
  }
  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m.push(0);
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m.push((w1 + w2) / (w1 / d[i - 1] + w2 / d[i]));
    }
  }
  m.push(d[n - 2]);
  let i = 0;
  while (tbl[i + 1][0] < f) i++;
  const t = (f - tbl[i][0]) / h[i];
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * tbl[i][1] + (t3 - 2 * t2 + t) * h[i] * m[i] +
    (-2 * t3 + 3 * t2) * tbl[i + 1][1] + (t3 - t2) * h[i] * m[i + 1]
  );
};
// cumulative spin, degrees: 0 at ≤3551, exactly 360 at ≥3574.
export const bldSpinThetaDeg = (f: number): number => pchip1(SPIN_TH, f);
// Spin axis: the TURNTABLED cluster centroid (mean of the B3D mids ridden
// through the same rotP(g) the buildings ride) — measured pivot_world
// (-7.3, -92.2) IS this centroid; g is frozen from the 3555 key so the
// axis is near-constant through the spin.
const BLD_MEAN: Pt = (() => {
  const ms = [B3D.lender.mid, B3D.bank.mid, B3D.company.mid];
  return [
    (ms[0][0] + ms[1][0] + ms[2][0]) / 3,
    (ms[0][1] + ms[1][1] + ms[2][1]) / 3,
  ];
})();
export const bldSpinAxisXZ = (f: number): [number, number] => {
  const p = rotP([BLD_MEAN[0], 0, BLD_MEAN[1]], camBld(f).g);
  return [p[0], p[2]];
};
// Lift: the building group detaches and rises ~50-80 SCREEN px across the
// spin (clear air gap under the buildings by f3563). At the frozen 3555
// camera the cluster depth is ~724 world units → px·(724/DCAM) ≈ px·1.10.
const SPIN_LIFT: [number, number][] = [
  [3551, 0], [3555, 7], [3559, 20], [3563, 38], [3567, 58], [3570, 70], [3574, 84],
];
export const bldSpinLift = (f: number): number => lerp1(SPIN_LIFT, f);
// Measured fade envelope (spin-measure.json fade_sat, smoothed per the
// report's prescription): recede eases the ink down from 3518, 0.55→0.41
// across the spin ramp 3551-3559, plateau ~0.36-0.38 through the fastest
// rotation, then extinction — the BLUES (lender+company) die at 3568, the
// BANK carries alone to 3573. Replaces the old static endFade 3548-3572.
const FADE_BLUE: [number, number][] = [
  [3517, 1], [3530, 0.92], [3540, 0.77], [3545, 0.68], [3551, 0.55],
  [3559, 0.41], [3561, 0.38], [3565, 0.36], [3566, 0.3], [3567, 0.16], [3568, 0],
];
const FADE_BANK: [number, number][] = [
  [3517, 1], [3530, 0.92], [3540, 0.77], [3545, 0.68], [3551, 0.55],
  [3559, 0.41], [3561, 0.38], [3566, 0.36], [3567, 0.33], [3570, 0.29],
  [3572, 0.25], [3573, 0.12], [3574, 0],
];
export const bldSpinAlpha = (
  name: "lender" | "company" | "bank",
  f: number,
): number => lerp1(name === "bank" ? FADE_BANK : FADE_BLUE, f);
// Rigid spin wrapper: yaw −θ about the vertical axis through (axis.x,
// axis.z), plus an optional lift along world y (buildings only — the
// floor stays planted). Identity frames (θ≤0 or θ≥360) return the bare
// children so every frame outside (3551, 3574) renders the EXACT
// pre-spin tree — byte-identity at both ends is structural, not
// numerical (rotation.y = −2π would leave sin(2π)≈2.4e-16 residue).
// Sign: −θ = turntable g decreasing = clockwise seen from above
// (near facades sweep screen-left) — A/B sign-checked at f3560 against
// the reference (COMPANY plaque mirrored, bank left-of-center showing
// its column-less back).
export const BldSpinGroup: React.FC<{
  frame: number;
  axis: [number, number];
  lift?: number;
  children: React.ReactNode;
}> = ({ frame, axis, lift = 0, children }) => {
  const deg = bldSpinThetaDeg(frame);
  if (deg <= 0 || deg >= 360) return <>{children}</>;
  return (
    <group position={[axis[0], lift, axis[1]]} rotation={[0, (-deg * Math.PI) / 180, 0]}>
      <group position={[-axis[0], 0, -axis[1]]}>{children}</group>
    </group>
  );
};

// ── plaque signboards ────────────────────────────────────────────
// Drawn procedurally (the old sprite crops baked in neighboring pixels —
// building bases, roads — which read as floating skirts at other poses).
// World size fitted so the board projects at its f2505 source bbox.
const plaqueWorld = (
  bbox: [number, number, number, number],
  z: number,
): { w: number; h: number; center: V3 } => {
  const { cam, g } = camBld(2505);
  const [x0, y0, x1, y1] = bbox;
  const d = cam[2] - rotP([0, 0, z], g)[2];
  const w = ((x1 - x0) * d) / DCAM;
  const h = ((y1 - y0) * d) / DCAM;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const pC: V3 = [
    cam[0] + (((cx - 427) * d) / DCAM),
    cam[1] + (((240 - cy) * d) / DCAM),
    cam[2] - d,
  ];
  return { w, h, center: rotP(pC, -g) };
};

type PlaqueDef = {
  key: string;
  text: string;
  def: { w: number; h: number; center: V3 };
  appear: [number, number];
  drop: number;
  tilt: number; // in-plane board rotation (rad, canvas frame)
  fix: V3; // measured world-center correction (data/buildings3d PLQ_FIX)
};
// the plaques drop in WITH their buildings (ref f1706-1760 / f2274+)
const PLAQUES: PlaqueDef[] = [
  { key: "plq-lender", text: "LENDER", def: plaqueWorld([258, 385, 360, 435], zL), appear: [1733, 1755], drop: 24, tilt: -0.16, fix: PLQ_FIX.lender },
  { key: "plq-company", text: "COMPANY", def: plaqueWorld([356, 358, 464, 390], zC), appear: [1706, 1730], drop: 26, tilt: -0.07, fix: PLQ_FIX.company },
  // bank board is tall — its top edge overlaps the building base (ref)
  { key: "plq-bank", text: "BANK", def: plaqueWorld([525, 380, 663, 424], zB), appear: [2274, 2312], drop: 18, tilt: -0.05, fix: PLQ_FIX.bank },
];

const drawPlaque = (text: string, tilt: number) => (
  ctx: CanvasRenderingContext2D, _f: number, w: number, h: number,
) => {
  const bw = Math.hypot(w, h * 0.3) * 0.97;
  const bh = h * 0.52;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(tilt);
  const r = 3;
  ctx.beginPath();
  ctx.moveTo(-bw / 2 + r, -bh / 2);
  ctx.arcTo(bw / 2, -bh / 2, bw / 2, bh / 2, r);
  ctx.arcTo(bw / 2, bh / 2, -bw / 2, bh / 2, r);
  ctx.arcTo(-bw / 2, bh / 2, -bw / 2, -bh / 2, r);
  ctx.arcTo(-bw / 2, -bh / 2, bw / 2, -bh / 2, r);
  ctx.closePath();
  ctx.fillStyle = "#F3F6F6";
  ctx.fill();
  ctx.strokeStyle = "#54585A";
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#54585A";
  const size = bh * 0.58;
  ctx.font = `700 ${size}px "${FONT}"`;
  type Ctx2 = CanvasRenderingContext2D & { letterSpacing?: string };
  (ctx as Ctx2).letterSpacing = `${size * 0.08}px`;
  ctx.fillText(text, 0, 1);
  (ctx as Ctx2).letterSpacing = "0px";
  ctx.restore();
};

// true-3D building fade/drop windows (same as the old sprite envelopes)
const BLD_APPEAR = {
  company: { appear: [1706, 1730] as const, drop: 26 },
  lender: { appear: [1733, 1755] as const, drop: 24 },
  bank: { appear: [2274, 2312] as const, drop: 18 },
};


// ── floor map ────────────────────────────────────────────────────
// Measured city-plan features. Three source poses:
//  A) f2505 (identity cam, g≈0) — direct unprojection.
//  B) f3540 (solved cam+g)      — unproject, un-yaw, + anchor correction.
//  C) f3700 (chart2 anchor)     — unproject in chart2 world, then map into
//     this world with a 2D similarity fitted on the dark-plot quad corners
//     measured at both identity anchors (f2505 here, f3700 in chart2).
const flB = (u: number, v: number): Pt => {
  const p = unprojToFloor(u, v, FLOOR_Y);
  return [p[0], p[2]];
};
const FLOORMAP = (() => {
  // B) 3540 unprojection (un-yawed + corrected)
  const { cam: cam3540, g: g3540 } = camBld(3540);
  const fl3540raw = (u: number, v: number): Pt => {
    const p = unprojToFloor(u, v, FLOOR_Y, cam3540);
    const q = rotP(p, -g3540);
    return [q[0], q[2]];
  };
  // anchor: dark plot TL seen at f2505 (340,439) and f3540 (280,390)
  const aI = flB(340, 439);
  const a35 = fl3540raw(280, 390);
  const d35: Pt = [aI[0] - a35[0], aI[1] - a35[1]];
  const fl3540 = (u: number, v: number): Pt => {
    const p = fl3540raw(u, v);
    return [p[0] + d35[0], p[1] + d35[1]];
  };
  // C) similarity chart2-world → buildings-world from dark plot quad
  const Q3700: Pt[] = [[339, 321], [368, 325], [343, 338], [312, 334]];
  const Q2505: Pt[] = [[340, 439], [381, 448], [329, 478], [288, 469]];
  const P = Q3700.map(([u, v]) => flB(u, v)); // chart2 world (same unproj math)
  const Q = Q2505.map(([u, v]) => flB(u, v));
  const cen = (pts: Pt[]): Pt => [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
  const cp = cen(P);
  const cq = cen(Q);
  let sxx = 0, sxy = 0, spp = 0;
  for (let i = 0; i < P.length; i++) {
    const px = P[i][0] - cp[0], py = P[i][1] - cp[1];
    const qx = Q[i][0] - cq[0], qy = Q[i][1] - cq[1];
    sxx += px * qx + py * qy;
    sxy += px * qy - py * qx;
    spp += px * px + py * py;
  }
  const sc = Math.hypot(sxx, sxy) / spp;
  const th = Math.atan2(sxy, sxx);
  const fl3700 = (u: number, v: number): Pt => {
    const p = flB(u, v);
    const px = p[0] - cp[0], py = p[1] - cp[1];
    return [
      cq[0] + sc * (Math.cos(th) * px - Math.sin(th) * py),
      cq[1] + sc * (Math.sin(th) * px + Math.cos(th) * py),
    ];
  };
  return { fl3540, fl3700 };
})();

const FLOOR_CB: Pt = [0, -250];
const FLOOR_WB = 1700;
const FLOOR_HB = 1500;

// ── r8: the yellow-road spin survivor ────────────────────────────
// The r7 negative (FloorMap comment below) proved the ref's yellow road
// outlives the map→paper crossfade and orbits with the spin, but a
// survivor riding the SPUN WORLD POSE lands under the cluster, off the
// ref's sheet spot. The prescription was a per-frame MEASURED track for
// the road alone — this is it. ROAD_TRACK rows are fitted per ref frame
// (work/r8/road/fitroad.py: saturated-yellow mask → connected components
// in the floor band y≥285 → PCA ribbon): [f, x0,y0, x1,y1, x2,y2, width,
// r,g,b] — a 3-point skeleton polyline + stroke width in REF SCREEN
// coords plus the sampled core color (the ink washes toward the paper as
// it dies; the wash lives in the color keys, #FBFB98 → #E1EDCC). Two
// patches orbit mirror-image to the bank — the right ribbon sweeps
// screen-left 3548→3560, the left blob sweeps right along the sheet
// bottom 3554→3566 — and building occlusion is baked in (only visible
// ink was measured). Extinct at 3568 (ref yellow count: 380 at 3567 → 7
// at 3568), so the ≥3568 unmount matches the ref's own sharp death.
const ROAD_TRACK: number[][] = [
  [3541, 470.9, 307.3, 444.6, 306.2, 418.3, 305.3, 7.5, 251, 251, 152],
  [3541, 283.8, 318.8, 270.0, 325.3, 255.2, 328.8, 10.5, 226, 231, 176],
  [3542, 289.1, 317.5, 272.4, 321.1, 255.5, 323.8, 11.5, 236, 239, 173],
  [3542, 472.0, 305.1, 445.1, 303.8, 418.3, 302.5, 7.2, 250, 250, 153],
  [3543, 289.3, 314.2, 272.9, 317.7, 256.4, 320.4, 13.1, 234, 236, 158],
  [3543, 473.2, 303.1, 447.1, 301.6, 421.0, 300.6, 6.9, 248, 250, 154],
  [3544, 294.6, 311.5, 275.9, 314.3, 257.1, 317.2, 14.2, 233, 236, 155],
  [3544, 472.6, 300.1, 445.9, 299.3, 419.3, 298.5, 6.8, 248, 250, 154],
  [3545, 295.4, 308.9, 278.5, 311.8, 261.5, 314.8, 12.8, 238, 242, 150],
  [3545, 472.8, 298.2, 446.3, 296.9, 419.7, 296.1, 6.9, 245, 247, 154],
  [3546, 298.8, 306.3, 282.9, 309.9, 266.9, 312.3, 12.8, 242, 247, 149],
  [3546, 472.6, 296.1, 446.3, 294.9, 420.1, 294.1, 6.5, 244, 247, 152],
  [3547, 299.9, 305.2, 284.9, 306.7, 270.2, 310.2, 14.3, 249, 251, 153],
  [3547, 472.8, 294.9, 441.3, 294.2, 409.7, 292.9, 6.8, 246, 248, 159],
  [3548, 303.7, 304.9, 288.3, 307.9, 272.8, 310.1, 12.6, 249, 251, 152],
  [3548, 469.1, 293.9, 434.5, 293.3, 399.9, 291.0, 7.1, 245, 250, 154],
  [3549, 464.9, 294.5, 430.4, 292.9, 395.9, 289.4, 7.5, 246, 249, 157],
  [3549, 305.7, 304.4, 291.0, 307.7, 276.1, 309.8, 12.5, 250, 252, 153],
  [3550, 466.9, 295.3, 431.8, 293.6, 396.9, 290.7, 6.8, 247, 250, 158],
  [3550, 307.5, 304.9, 293.4, 308.2, 279.0, 310.3, 12.7, 250, 251, 153],
  [3551, 308.6, 306.5, 294.0, 309.7, 279.3, 312.0, 13.1, 250, 252, 155],
  [3551, 469.2, 296.8, 433.0, 294.6, 396.7, 292.0, 6.4, 248, 250, 162],
  [3552, 463.2, 296.8, 423.7, 295.4, 384.4, 292.2, 6.9, 247, 250, 166],
  [3552, 307.0, 310.4, 292.9, 311.5, 279.0, 314.6, 13.2, 250, 252, 152],
  [3553, 303.3, 315.7, 290.4, 316.3, 278.1, 319.9, 15.1, 250, 253, 153],
  [3553, 450.4, 296.8, 410.7, 296.5, 371.0, 293.8, 6.2, 248, 250, 171],
  [3554, 299.3, 323.0, 287.8, 322.4, 276.8, 325.8, 17.2, 249, 253, 165],
  [3554, 437.5, 298.4, 397.9, 298.5, 358.4, 298.6, 5.9, 246, 251, 177],
  [3555, 300.7, 332.9, 289.7, 332.5, 278.7, 331.5, 17.8, 248, 250, 175],
  [3555, 431.3, 298.5, 387.4, 301.1, 343.4, 302.5, 6.0, 247, 251, 177],
  [3556, 316.6, 343.3, 299.0, 342.6, 281.8, 338.9, 15.8, 250, 252, 176],
  [3556, 395.3, 302.4, 359.3, 305.8, 323.2, 308.1, 6.7, 246, 251, 177],
  [3557, 340.2, 355.0, 317.4, 353.4, 295.0, 348.9, 14.3, 249, 246, 172],
  [3557, 375.0, 305.3, 336.7, 312.6, 298.0, 316.5, 7.3, 246, 250, 178],
  [3558, 378.5, 364.6, 347.6, 362.1, 316.8, 360.2, 14.2, 251, 250, 182],
  [3558, 346.8, 312.6, 322.3, 320.7, 297.0, 326.0, 9.3, 247, 251, 176],
  [3559, 416.7, 369.7, 385.8, 368.7, 355.0, 370.5, 14.2, 252, 251, 185],
  [3559, 324.6, 324.8, 307.9, 331.6, 291.4, 338.9, 13.9, 250, 251, 190],
  [3560, 457.1, 370.8, 430.3, 372.3, 403.7, 376.1, 14.0, 250, 251, 187],
  [3560, 309.1, 337.8, 302.6, 342.8, 297.5, 349.3, 20.2, 248, 249, 183],
  [3561, 323.3, 365.4, 312.8, 358.6, 301.9, 352.4, 20.7, 248, 246, 190],
  [3561, 491.8, 368.9, 469.8, 371.2, 448.2, 376.3, 14.9, 245, 248, 188],
  [3562, 357.6, 379.1, 331.4, 370.7, 304.9, 363.2, 14.8, 251, 252, 200],
  [3562, 510.0, 364.5, 498.4, 367.1, 486.6, 368.8, 16.6, 249, 252, 195],
  [3563, 408.7, 388.2, 369.5, 382.3, 330.0, 378.5, 12.3, 247, 251, 201],
  [3563, 519.3, 360.9, 513.3, 360.8, 507.3, 360.1, 17.2, 248, 251, 202],
  [3564, 451.2, 390.2, 403.7, 390.5, 356.3, 390.6, 9.3, 249, 251, 210],
  [3564, 519.3, 354.3, 511.9, 352.2, 504.2, 351.5, 12.2, 233, 241, 201],
  [3565, 480.3, 387.0, 443.2, 392.1, 405.9, 396.9, 8.7, 248, 250, 208],
  [3565, 504.2, 348.3, 495.2, 346.0, 486.2, 343.9, 8.2, 245, 248, 215],
  [3566, 490.1, 384.7, 473.3, 392.1, 455.5, 396.9, 9.1, 225, 237, 204],
  [3567, 469.5, 341.4, 455.0, 339.7, 440.4, 339.1, 5.3, 250, 253, 221],
  [3567, 504.1, 386.9, 501.2, 386.6, 498.2, 386.2, 5.9, 217, 232, 204],
  [3567, 485.3, 397.2, 484.5, 397.2, 483.8, 397.0, 9.2, 240, 234, 212],
];
// Screen(u,v) → floor-canvas coords at frame f, inverting the FULL chain
// the plane renders through: the pitched buildings camera (buildingsPose
// — a flat unprojToFloor misses by bldPitchAt(f), nonzero and VARYING
// 0.06→0.002 rad across this window), then the BldSpinGroup turntable
// (−θ about the cluster axis; pre-image = +θ), then the FloorMap group
// yaw (+g; pre-image = rotP(·,−g)). At θ=0, pitch=0 this reduces exactly
// to the fl3540raw recipe, so the 3544 seam is the map's own road math.
const roadScr2Floor = (f: number) => {
  const pose = buildingsPose(f);
  const cx0 = pose.pos[0] - T_BLD[0];
  const cy0 = pose.pos[1] - T_BLD[1];
  const cz0 = pose.pos[2] - T_BLD[2];
  const ca = Math.cos(pose.rotX);
  const sa = Math.sin(pose.rotX);
  const th = (bldSpinThetaDeg(f) * Math.PI) / 180;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const ax = bldSpinAxisXZ(f);
  const { g } = camBld(f);
  return (u: number, v: number): Pt => {
    const rx = (u - 427) / DCAM;
    const ry = (240 - v) / DCAM;
    const dy = ca * ry + sa; // R_x(rotX)·(rx,ry,−1), rotX = −pitch
    const dz = sa * ry - ca;
    const t = (FLOOR_Y - cy0) / dy;
    const px = cx0 + rx * t;
    const pz = cz0 + dz * t;
    const dxa = px - ax[0];
    const dza = pz - ax[1];
    const q = rotP(
      [ax[0] + cs * dxa + sn * dza, FLOOR_Y, ax[1] - sn * dxa + cs * dza],
      -g,
    );
    return [q[0], q[2]];
  };
};
const drawRoadSurvivor = (
  ctx: CanvasRenderingContext2D, f: number, w: number, h: number,
) => {
  const m = roadScr2Floor(f);
  const mx = (p: Pt) => w / 2 + (p[0] - FLOOR_CB[0]);
  const my = (p: Pt) => h / 2 + (p[1] - FLOOR_CB[1]);
  // The ribbon outline is built in REF SCREEN space and every outline
  // vertex is unprojected to the floor canvas — a canvas stroke with
  // lineWidth would balloon: the floor is anisotropic (a near-vertical
  // screen width unprojects to a large depth extent) and circular caps/
  // joins bleed that magnitude into screen-x (first attempt measured
  // 3x-wide bboxes at 3554/3560). Polygon-in-screen-space projects back
  // to the measured ribbon by construction.
  const norm = (x: number, y: number): Pt => {
    const L = Math.hypot(x, y);
    return L > 1e-3 ? [x / L, y / L] : [1, 0];
  };
  for (const r of ROAD_TRACK) {
    if (r[0] !== f) continue;
    const hw = r[7] / 2;
    const d01 = norm(r[3] - r[1], r[4] - r[2]);
    const d12 = norm(r[5] - r[3], r[6] - r[4]);
    const n01: Pt = [-d01[1], d01[0]];
    const n12: Pt = [-d12[1], d12[0]];
    const n1 = norm(n01[0] + n12[0], n01[1] + n12[1]);
    const outline: Pt[] = [
      [r[1] - d01[0] * hw, r[2] - d01[1] * hw], // start apex
      [r[1] + n01[0] * hw, r[2] + n01[1] * hw],
      [r[3] + n1[0] * hw, r[4] + n1[1] * hw],
      [r[5] + n12[0] * hw, r[6] + n12[1] * hw],
      [r[5] + d12[0] * hw, r[6] + d12[1] * hw], // end apex
      [r[5] - n12[0] * hw, r[6] - n12[1] * hw],
      [r[3] - n1[0] * hw, r[4] - n1[1] * hw],
      [r[1] - n01[0] * hw, r[2] - n01[1] * hw],
    ];
    ctx.fillStyle = `rgb(${r[8]},${r[9]},${r[10]})`;
    ctx.beginPath();
    outline.forEach(([u, v], i) => {
      const q = m(u, v);
      if (i === 0) ctx.moveTo(mx(q), my(q));
      else ctx.lineTo(mx(q), my(q));
    });
    ctx.closePath();
    ctx.fill();
  }
};

export const FloorMap: React.FC<{ frame: number; g?: number }> = ({ frame, g = camBld(frame).g }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    // ground layer mounts for all frames; past the hand-off the sheet is
    // gone (opacity 0 by 3581) — stay blank as a belt-and-braces guard
    if (f > 3600) return;
    // ref: the map sheet inks in over ~1695-1725 (scene starts at 1705)
    const a = clamp01((f - 1705) / 22);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const { fl3540, fl3700 } = FLOORMAP;
    const mx = (p: Pt) => w / 2 + (p[0] - FLOOR_CB[0]);
    const my = (p: Pt) => h / 2 + (p[1] - FLOOR_CB[1]);
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
    const line = (pts: Pt[], stroke: string, lw: number) => {
      path(pts, false);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    const m2505 = (pts: Pt[]) => pts.map(([u, v]) => flB(u, v));
    const m3540 = (pts: Pt[]) => pts.map(([u, v]) => fl3540(u, v));
    const m3700 = (pts: Pt[]) => pts.map(([u, v]) => fl3700(u, v));
    // sheet outline (f3540): left corner, NW edge, occluded back, right
    // edge, rounded near corner, bowed front edge
    const sheet = m3540([
      [7, 373], [53, 359], [120, 344], [150, 335], [634, 309], [684, 453], [676, 447],
      [670, 453], [590, 443], [510, 434], [430, 424], [300, 409], [230, 405],
    ]);
    poly(sheet, "#F2F2F0", "#DEDEDA", 1.6);
    // streets clipped to sheet
    ctx.save();
    path(sheet, true);
    ctx.clip();
    // main street double line (3540)
    line(m3540([[320, 383], [450, 394], [560, 406], [620, 412]]), BCOLORS.mapInk, 1.6);
    line(m3540([[450, 400], [560, 411], [620, 417]]), BCOLORS.mapInk, 1.4);
    // near-side street line + receding street (2505, exact)
    line(m2505([[132, 456], [558, 431]]), BCOLORS.mapInk, 1.5);
    line(m2505([[500, 419], [652, 480]]), BCOLORS.mapInk, 1.5);
    // receding street family (3540 pairs y360→y410; two occluded extended)
    const fam: [Pt, Pt][] = [
      [[443, 360], [431, 410]], [[487, 360], [456, 410]], [[533, 360], [515, 410]],
      [[579, 360], [575, 410]], [[624, 360], [633, 410]],
    ];
    for (const [t, b] of fam) {
      const wt = fl3540(t[0], t[1]);
      const wb = fl3540(b[0], b[1]);
      // extend across the sheet
      const dx = wb[0] - wt[0], dz = wb[1] - wt[1];
      line([[wt[0] - dx * 1.6, wt[1] - dz * 1.6], [wb[0] + dx * 1.2, wb[1] + dz * 1.2]], BCOLORS.mapInk, 1.4);
    }
    // two occluded members left of the family (same direction as first)
    for (const tx of [350, 397]) {
      const wt = fl3540(tx, 360);
      const ref0 = fl3540(443, 360);
      const ref1 = fl3540(431, 410);
      const dx = ref1[0] - ref0[0], dz = ref1[1] - ref0[1];
      line([[wt[0] - dx * 1.6, wt[1] - dz * 1.6], [wt[0] + dx * 2.2, wt[1] + dz * 2.2]], BCOLORS.mapInk, 1.4);
    }
    ctx.restore();
    // white pads (under the buildings)
    poly(m3540([[195, 329], [295, 339], [224, 374], [124, 364]]), "#FBFBF9", "#E0E0DC");
    poly(m3540([[480, 318], [583, 322], [583, 339], [481, 332]]), "#FBFBF9", "#E0E0DC");
    // plot cluster (3540)
    poly(m3540([[280, 390], [323, 394], [299, 409], [259, 404]]), "#C2C2C4", null);
    poly(m3540([[328, 393], [369, 397], [356, 416], [308, 410]]), "#C4C4C4", null);
    poly(m3540([[370, 399], [417, 403], [400, 422], [357, 415]]), "#C6DBDD", null);
    poly(m3540([[310, 412], [401, 424], [399, 433], [296, 421]]), "#DDF0F2", null);
    // plots D/E slivers (2505, near-frame-bottom pieces)
    poly(m2505([[434, 461], [483, 470], [477, 481], [428, 481]]), "#C6DBDD", null);
    poly(m2505([[348, 475], [383, 479], [381, 492], [346, 488]]), "#DDF0F2", null);
    // saturated teal quad (from f3700 via similarity)
    poly(m3700([[240, 369], [273, 374], [263, 384], [218, 378]]), "#BFE0E4", null);
    // ruled diagonals parcel (f3700 via similarity)
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const top: Pt = [418 + (557 - 418) * t, 376 + (393 - 376) * t];
      const bot: Pt = [385 + (544 - 385) * t, 405 + (427 - 405) * t];
      line(m3700([top, bot]), "#DDDDDD", 1.1);
    }
    // red squiggle (3540)
    line(
      m3540([[442, 417], [466, 432], [492, 442], [501, 450], [508, 450], [516, 447],
        [538, 457], [546, 457], [554, 462], [572, 470], [579, 473], [587, 471], [595, 473], [618, 472]]),
      "#DC9DA0", 1.6,
    );
    // yellow road (2505, exact): one polygon through the visible segments.
    // r6: the ref redraws it thinner (0.55 cross-width) and slides it
    // deeper through the right swing — blend to ROAD_SQZ and ride the
    // measured ROAD_FIX world track (identity <=3300, seam-exact: the
    // base points stay runtime-unprojected).
    const roadBase = m2505([[306, 368], [321, 366], [430, 354], [464, 358], [543, 369],
      [526, 375], [464, 367], [333, 378], [307, 389]]);
    const rs = clamp01((f - 3300) / 30);
    const rSlide = lerpTrack(ROAD_FIX, f);
    const road = rs <= 0 ? roadBase : roadBase.map((p, i): Pt => [
      p[0] + (ROAD_SQZ[i][0] - p[0]) * rs + rSlide[0],
      p[1] + (ROAD_SQZ[i][1] - p[1]) * rs + rSlide[1],
    ]);
    poly(road, BCOLORS.road, "#DDDCB0", 1);
    // red dashed V-road (2505): short dashes along the two branches
    const dashes = (pts: Pt[]) => {
      const wpts = m2505(pts);
      ctx.strokeStyle = "#D4A6A8";
      ctx.lineWidth = 2.4;
      for (let i = 0; i < wpts.length; i++) {
        const nb = wpts[Math.min(i + 1, wpts.length - 1)];
        const pv = wpts[Math.max(i - 1, 0)];
        let dx = nb[0] - pv[0], dz = nb[1] - pv[1];
        const L = Math.hypot(dx, dz) || 1;
        dx /= L; dz /= L;
        const p = wpts[i];
        ctx.beginPath();
        ctx.moveTo(mx([p[0] - dx * 5, p[1] - dz * 5]), my([p[0] - dx * 5, p[1] - dz * 5]));
        ctx.lineTo(mx([p[0] + dx * 5, p[1] + dz * 5]), my([p[0] + dx * 5, p[1] + dz * 5]));
        ctx.stroke();
      }
    };
    dashes([[317, 433], [312, 435], [300, 440], [293, 445], [279, 450], [268, 455], [261, 460], [256, 465]]);
    dashes([[354, 429], [365, 430], [375, 435], [410, 440], [438, 445], [453, 450], [480, 455], [516, 460], [524, 465]]);
    // dusty-red inner border + dots (3540)
    line(m3540([[657, 430], [667, 450], [672, 465], [670, 480]]), "#C09090", 2);
    const dt = fl3540(654, 416);
    ctx.beginPath();
    ctx.arc(mx(dt), my(dt), 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#B98A8C";
    ctx.fill();
    ctx.globalAlpha = 1;
  }, []);
  const quat = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), g)
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
  const c = rotP([FLOOR_CB[0], FLOOR_Y, FLOOR_CB[1]], g);
  return (
    <group position={c} quaternion={quat}>
      {/* r7 strike-3: dissolves over 3518-3544 while chart2's FloorSet
          (the chart paper) fades in underneath — the ref crossfades
          city-map -> chart paper through the pre-spin recede, so the
          paper, not the map, rides the exit spin (old window: 3572-3581).
          NEGATIVE A/B (do not retry blind): the ref's yellow road
          visibly SURVIVES the crossfade and orbits with the spin
          (f3550-3563) — both a whole-map low tail (0.24 to 3556) and a
          yellow-road-only survivor (0.55->0.5->0 by 3566, per-element
          alpha) LOST at every gate (3530 -.0020/-.0009, 3545 -.0022/
          -.0010, 3556 -.0013/-.0003, 3563 -.0005/-.0014): under the spun
          pose our road track lands beneath the cluster, not on the ref's
          sheet spot — misplaced ink loses to absent ink, again. A
          survivor needs its own measured track first.
          r8: RESOLVED by exactly that — the ROAD_TRACK survivor plane
          below draws the road on its per-frame measured screen track
          (fitted from the ref frames, work/r8/road/), inverse-mapped
          through pitch, spin and yaw so the ink lands on the ref's
          sheet spot at every frame. */}
      <CanvasPlane frame={frame} width={FLOOR_WB} height={FLOOR_HB} res={1}
        position={[0, 0, 0]} rotation={[0, 0, 0]} draw={draw} renderOrder={0}
        opacity={fadeOut(frame, 3518, 3544)} />
      {/* r8 road survivor: mounted only inside (3540, 3568) so every
          frame outside is the exact pre-change tree (byte-identity is
          structural). Ramp-in 3541-3544 hands over from the dying map
          road (map opacity 0.115→0.038 there); from 3544 the survivor
          owns the road. renderOrder 1: over the chart paper (the ref
          road orbits ON the paper, FloorSet renders at 0), under the
          lifted buildings (2) and plaques (5). */}
      {frame >= 3541 && frame <= 3567 && (
        <CanvasPlane frame={frame} width={FLOOR_WB} height={FLOOR_HB} res={1}
          position={[0, 0, 0]} rotation={[0, 0, 0]} draw={drawRoadSurvivor}
          renderOrder={1} opacity={clamp01((frame - 3540) / 4)} />
      )}
    </group>
  );
};

// ── overlay helpers ──────────────────────────────────────────────
// screen anchor: element position rides P1/P3 (or P1/P2) tracks.
const riding = (
  f: number,
  anchorFrame: number,
  base: readonly [number, number],
  ref: TrackRow[],
): Pt => {
  const a = lerpTrack(ref, anchorFrame);
  const n = lerpTrack(ref, f);
  return [base[0] + (n[0] - a[0]), base[1] + (n[1] - a[1])];
};

const fade = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1, b - a));
const fadeOut = (f: number, a: number, b: number) => 1 - fade(f, a, b);
const mixPt = (a: Pt, b: Pt, t: number): Pt => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

const Arrow: React.FC<{
  tail: Pt; tip: Pt; color: string; thickness: number;
  headLen: number; headH: number; opacity: number; progress?: number;
}> = ({ tail, tip, color, thickness, headLen, headH, opacity, progress = 1 }) => {
  if (opacity <= 0 || progress <= 0) return null;
  const dx = tip[0] - tail[0];
  const dy = tip[1] - tail[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const curLen = len * progress;
  const cx = tail[0] + ux * curLen;
  const cy = tail[1] + uy * curLen;
  const shaftLen = Math.max(0, curLen - headLen);
  const sx = tail[0] + ux * shaftLen;
  const sy = tail[1] + uy * shaftLen;
  const px = -uy;
  const py = ux;
  const pts = [
    `${tail[0] + px * thickness / 2},${tail[1] + py * thickness / 2}`,
    `${sx + px * thickness / 2},${sy + py * thickness / 2}`,
    `${sx + px * headH / 2},${sy + py * headH / 2}`,
    `${cx},${cy}`,
    `${sx - px * headH / 2},${sy - py * headH / 2}`,
    `${sx - px * thickness / 2},${sy - py * thickness / 2}`,
    `${tail[0] - px * thickness / 2},${tail[1] - py * thickness / 2}`,
  ].join(" ");
  return (
    <svg style={{ position: "absolute", inset: 0, opacity }} width={854} height={480}>
      <polygon points={pts} fill={color} stroke="#74717466" strokeWidth={1.4} />
    </svg>
  );
};

const Txt: React.FC<{
  p: Pt; size: number; color?: string; weight?: number; opacity: number;
  children: React.ReactNode; rotate?: number; scale?: number;
}> = ({ p, size, color = BCOLORS.title, weight = 400, opacity, children, rotate = 0, scale = 1 }) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute", left: p[0], top: p[1],
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
        fontFamily: FONT, fontWeight: weight, fontSize: size, color,
        whiteSpace: "nowrap", opacity, lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
};

const RateValue: React.FC<{
  p: Pt; size: number; opacity: number; value: string; scale?: number;
}> = ({ p, size, opacity, value, scale = 1 }) => (
  <Txt p={p} size={size} color={BCOLORS.value} weight={600} opacity={opacity} scale={scale}>
    {value}
    <span style={{ fontSize: size * 0.88, fontWeight: 400 }}>{" "}%</span>
  </Txt>
);

const tickValue = (f: number, table: readonly (readonly [number, string, ...string[]])[], initial: string, col = 1): string => {
  let v = initial;
  for (const row of table) {
    if (f >= row[0]) v = row[col] as string;
  }
  return v;
};

// ── panel ────────────────────────────────────────────────────────
const Panel: React.FC<{ frame: number }> = ({ frame }) => {
  const op = fade(frame, 1809, 1817) * fadeOut(frame, 2178, 2192);
  if (op <= 0) return null;
  const [x, y, w] = ANCHOR_1900.panel;
  const val = tickValue(frame, TICKS_A, "2.5", 2);
  const glare = frame >= 1957 && frame <= 1977 ? Math.sin(((frame - 1957) / 20) * Math.PI) * 0.55 : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, opacity: op, fontFamily: FONT }}>
      <div style={{ background: "linear-gradient(#DDDDDD,#C8C8C8)", color: "#787878", fontSize: 12, fontWeight: 600, textAlign: "center", padding: "3px 0" }}>
        Total Borrowing
      </div>
      <div style={{ background: BCOLORS.panelBody, display: "flex", justifyContent: "center", padding: "6px 0" }}>
        <div style={{ width: 55, height: 51, background: BCOLORS.panelIcon, borderRadius: 8, border: "1.5px solid #9FB4B6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={34} height={32} viewBox="0 0 34 32">
            <path d="M17 2 L32 14 L28 14 L28 30 L6 30 L6 14 L2 14 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={2.4} strokeLinejoin="round" />
            <rect x={14} y={21} width={6} height={9} fill={BCOLORS.panelIcon} stroke="#FFFFFF" strokeWidth={1.4} />
          </svg>
        </div>
      </div>
      <div style={{ background: BCOLORS.panelStrip, textAlign: "center", padding: "4px 0", fontSize: 22, fontWeight: 600, color: "#6B6B6B" }}>
        {val}
        <span style={{ fontSize: 16, fontWeight: 400 }}> %</span>
      </div>
      {glare > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,${glare}) 50%, transparent 70%)` }} />
      )}
    </div>
  );
};

// ── main scene ───────────────────────────────────────────────────
// World half: everything that lives inside <Room> except the CameraRig,
// so the one-world composition can mount it under its own rig.
export const BuildingsWorld: React.FC<{ frame: number }> = ({ frame }) => {
  const { g } = camBld(frame);

  // r7 strike-3: the old static endFade (3548-3572, whole scene at once)
  // is replaced by the measured per-building spin envelope (bldSpinAlpha)
  // — the buildings fade WHILE spinning, blues out at 3568, bank at 3573.
  const spinDeg = bldSpinThetaDeg(frame);
  const spinAxis = bldSpinAxisXZ(frame);

  // arrows/labels — phase driven
  const arrA = fade(frame, 1826, 1828) * fadeOut(frame, 2170, 2190);
  const progA = frame < 1826 ? 0 : Math.min(1, lerp1([[1826, 0.28], [1830, 0.6], [1834, 0.9], [1837, 1]], frame));
  const lblA = fade(frame, 1844, 1852) * fadeOut(frame, 2164, 2178);
  // lending-margin group dims to ~0.65 when the VBR ticking starts (ref
  // YMIN curve: dark→step at ~1942-1960→hold→out 2160-2190)
  const lmA =
    fade(frame, 1873, 1882) *
    (1 - 0.35 * fade(frame, 1942, 1960)) *
    fadeOut(frame, 2160, 2190);

  // solid → ghost at 0.30 over 2575-2600 (measured), back up 3085-3120
  const ghost = (f: number) =>
    f < 2575 ? 1 : f < 3085 ? Math.max(0.3, fadeOut(f, 2575, 2600)) : Math.min(1, 0.3 + fade(f, 3085, 3120) * 0.7);
  const fixOp = fade(frame, 2345, 2355) * ghost(frame) * fadeOut(frame, 3421, 3427);
  const fixArrowOp = fade(frame, 2361, 2363) * ghost(frame) * fadeOut(frame, 3427, 3438);
  const fixProg = frame < 2361 ? 0 : Math.min(1, lerp1([[2361, 0.5], [2365, 0.75], [2369, 0.97], [2370, 1]], frame));

  // red arrow: tip-first wipe 2490-2525 with an alpha ramp (ref head is
  // ~20% alpha mid-wipe), world-static after
  const redOp = fade(frame, 2495, 2512) *
    (frame < 3086 ? 1 : frame < 3195 ? Math.max(0.3, fadeOut(frame, 3095, 3115)) : Math.min(1, 0.3 + fade(frame, 3195, 3240) * 0.7));
  const redProg = frame < 2489 ? 0 : Math.min(1, lerp1([[2489, 0.05], [2500, 0.12], [2505, 0.2], [2512, 0.55], [2525, 1]], frame));
  // ref keeps the right VBR label alive at ~0.32 through the camera swing
  const rightLblOp = fade(frame, 2500, 2515) *
    (frame < 3086 ? 1 : frame < 3195 ? Math.max(0.32, fadeOut(frame, 3086, 3106)) : 0);
  const slideT = fade(frame, 2585, 2660);
  // left column pops fully formed between 2612 and 2625 (measured)
  const leftArrOp = fade(frame, 2613, 2625) * fadeOut(frame, 3096, 3110);
  const leftLblOp = fade(frame, 2615, 2628) * (frame < 3086 ? 1 : fadeOut(frame, 3086, 3100));

  const vbrVal = tickValue(frame, TICKS_A, "0.5");
  const cVal = tickValue(frame, TICKS_C, "0.5");

  const al: ArrowAlphas = {
    arrA, progA, lblA, lmA, vbrVal,
    fixArrow: frame < 3180 ? fixArrowOp : 0,
    fixProg,
    fix: frame < 3180 ? fixOp : 0,
    red: frame < 3195 ? redOp : 0,
    redProg,
    rightLbl: rightLblOp,
    slideT,
    leftArr: leftArrOp,
    leftLbl: leftLblOp,
    cVal,
  };

  return (
    <>
      {/* FloorMap now lives on the persistent ground layer (orchestrator) */}
      <BldSpinGroup frame={frame} axis={spinAxis} lift={bldSpinLift(frame)}>
      {(Object.keys(BLD_APPEAR) as (keyof typeof BLD_APPEAR)[]).map((name) => {
        const b = BLD_APPEAR[name];
        const t = fade(frame, b.appear[0], b.appear[1]);
        return (
          <Building3D key={name} name={name} g={g}
            opacity={t * bldSpinAlpha(name, frame)} drop={b.drop * (1 - t)} renderOrder={2} />
        );
      })}
      {PLAQUES.map((s) => {
          const plqName = s.key.slice(4) as "lender" | "company" | "bank";
          const op = fade(frame, s.appear[0], s.appear[1]) * bldSpinAlpha(plqName, frame);
          if (op <= 0) return null;
          const dropT = 1 - fade(frame, s.appear[0], s.appear[1]);
          const c = rotP([
            s.def.center[0] + s.fix[0],
            s.def.center[1] + s.fix[1],
            s.def.center[2] + s.fix[2],
          ], g);
          const board = drawPlaque(s.text, s.tilt);
          // r6: measured per-frame board registration (PLQ_D_FIX screen
          // deltas + PLQ_TILT_FIX roll, plqedge.py edge-pair fit). The
          // screen delta converts to a world offset at the board's depth
          // through the pitched camera; the tilt delta rolls the PLANE
          // about its normal (rz = -canvasTilt: canvas y is down, world
          // y is up) so the art never clips its canvas.
          const name = s.key.slice(4) as "lender" | "company" | "bank";
          let pos: V3 = [c[0], c[1] + s.drop * dropT, c[2]];
          let rz = 0;
          const dRows = PLQ_D_FIX[name];
          if (dRows && frame > 3300) {
            const [du, dv] = lerpTrack(dRows, frame);
            const e = bldPitchAt(frame);
            const cp = buildingsPose(frame).pos;
            const ce = Math.cos(e);
            const se = Math.sin(e);
            const dy = pos[1] - (cp[1] - T_BLD[1]);
            const dz = pos[2] - (cp[2] - T_BLD[2]);
            const dist = -(se * dy + ce * dz);
            const sc = dist / DCAM;
            pos = [pos[0] + du * sc, pos[1] - dv * sc * ce, pos[2] + dv * sc * se];
            const tRows = PLQ_TILT_FIX[name];
            if (tRows) rz = (-lerp1(tRows, frame) * Math.PI) / 180;
          }
          const drawBoard = (ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
            ctx.globalAlpha = op;
            board(ctx, f, w, h);
          };
          // the twin is a FRONT-facing plane standing in for the original
          // seen from BEHIND — a real back view mirrors, so its canvas is
          // pre-mirrored (the ref plaque reads "YNAPMOC" mid-turn)
          const drawBoardBack = (ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            ctx.globalAlpha = op;
            board(ctx, f, w, h);
          };
          return (
            <React.Fragment key={s.key}>
              <CanvasPlane frame={frame}
                width={s.def.w} height={s.def.h} res={3}
                position={pos} rotation={[0, 0, rz]}
                draw={drawBoard}
                renderOrder={5} depthTest={false} />
              {/* r7 spin: the plaque plane is FrontSide-culled, but the
                  reference SHOWS the boards from behind mid-turn (the
                  COMPANY plaque reads mirrored, f3560-3563) — a flipped
                  twin covers the far half of the rotation. Mounted only
                  while θ∈(0,360), so all other frames keep the exact
                  single-plane tree. */}
              {spinDeg > 0 && spinDeg < 360 && (
                <group position={pos} rotation={[0, 0, rz]}>
                  <CanvasPlane frame={frame}
                    width={s.def.w} height={s.def.h} res={3}
                    position={[0, 0, 0]} rotation={[0, Math.PI, 0]}
                    draw={drawBoardBack}
                    renderOrder={5} depthTest={false} />
                </group>
              )}
            </React.Fragment>
          );
        })}
      </BldSpinGroup>
      <ArrowPlanes frame={frame} g={g} font={FONT} al={al} />
    </>
  );
};

// Overlay half: the screen-space DOM block (panel + phase-D two-shot).
export const BuildingsOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  // overall scene fade at the end (ref: colors still full at 3550,
  // fully white by ~3572)
  const endFade = fade(frame, 3548, 3572);

  // solid → ghost at 0.30 over 2575-2600 (measured), back up 3085-3120
  const ghost = (f: number) =>
    f < 2575 ? 1 : f < 3085 ? Math.max(0.3, fadeOut(f, 2575, 2600)) : Math.min(1, 0.3 + fade(f, 3085, 3120) * 0.7);
  const fixOp = fade(frame, 2345, 2355) * ghost(frame) * fadeOut(frame, 3420, 3430);
  const fixArrowOp = fade(frame, 2361, 2363) * ghost(frame) * fadeOut(frame, 3426, 3434);

  // red arrow: tip-first wipe 2490-2525 with an alpha ramp (ref head is
  // ~20% alpha mid-wipe), world-static after
  // ghost floor + ramp-back re-measured round 1 (core-pixel alpha trace):
  // floor ≈0.45 (not 0.3), full again by 3210 — ref: 3190:0.52 3200:0.78
  // 3210:1.0 (old 3195-3240 window held it ghosted ~20 frames too long)
  const redOp = fade(frame, 2495, 2512) *
    (frame < 3086 ? 1 : frame < 3185 ? Math.max(0.45, fadeOut(frame, 3095, 3115)) : Math.min(1, 0.45 + fade(frame, 3185, 3210) * 0.55));
  // re-measured round 1: ref title inks in 3175-3215 (darkest-glyph
  // trace), ~25 frames earlier than the old 3195-3240 window
  // D->E transition re-measured round 6 (probe_fade.py, 3f steps): ref
  // text holds FULL through 3420, ~50% at 3425, gone by 3430; teal arrow
  // a beat later (full 3425, 55% 3430, gone 3435); the red arrow stays
  // SOLID through 3430 and re-poses 3430-3440 (the old 3421/3427 windows
  // ran 6-9 frames early and read as a premature ghost at 3425).
  const dVbrOp = fade(frame, 3175, 3215) * fadeOut(frame, 3420, 3430);
  const ncOp = fade(frame, 3440, 3452) * fadeOut(frame, 3520, 3540);
  const ncArrowOp = frame >= 2495 ? Math.max(redOp * fadeOut(frame, 3430, 3437), fade(frame, 3433, 3440) * fadeOut(frame, 3520, 3545)) : 0;

  // track-riding anchor helpers (phase D screen overlays only)
  // rDA carries the measured phase-D correction (ref arrows sit ~14px
  // left / 10px lower; labels ~10px left / 11px lower than the first fit)
  // Phase-D two-shot overlays are painted in near-static SCREEN space in the
  // reference during the hold: measured red-arrow center holds at
  // (393→403, 175) across 3200-3420 — a tiny rightward drift only, NOT the
  // strong P1-apex motion the old track-riding applied (it swept the held
  // arrows ~25px and sank them ~10px, and the old −14/+10 "correction"
  // pushed them further off the measured anchor). ANCHOR_3300 IS the
  // measured hold pose, so place elements there directly with only the
  // measured ~+0.045px/frame drift. (During 3080-3180 the reference arrow
  // still swings with the camera orbit out to x≈534; no screen-space model
  // captures that world-space swing, and the hold gain dwarfs it.)
  const rDA = (base: readonly [number, number]): Pt => [
    base[0] + 0.045 * (frame - 3300),
    base[1],
  ];
  const rE = (base: readonly [number, number]): Pt => riding(frame, 3450, base, P1);
  // r6: measured per-frame registration deltas layered on the base
  // models (D_FIX/D_ARR_FIX/E_FIX rows in data/buildings.ts — ref minus
  // attempt scan every 10f; the hand redraw drifts continuously, so the
  // correction is a dense keyed track, not a single-frame anchor).
  const fx = (base: Pt, rows: TrackRow[]): Pt => {
    const d = lerpTrack(rows, frame);
    return [base[0] + d[0], base[1] + d[1]];
  };

  // red arrow blend 3430-3440 phase-D pose → net-cash pose (measured:
  // solid D pose through 3430, E pose established by 3440)
  const redSlide = fade(frame, 3430, 3440);

  return (
    <AbsoluteFill style={{ opacity: 1 - endFade }}>
      <Panel frame={frame} />
      {/* Phase D tight two-shot; red arrow slides down 3427-3438 into the
          net-cash pose measured at 3450 */}
      <Arrow
        tail={mixPt(fx(rDA(ANCHOR_3300.redArrow.tail), D_ARR_FIX.redTail), fx(rE(ANCHOR_3450.redArrow.tail), E_FIX.redTail), redSlide)}
        tip={mixPt(fx(rDA(ANCHOR_3300.redArrow.tip), D_ARR_FIX.redTip), fx(rE(ANCHOR_3450.redArrow.tip), E_FIX.redTip), redSlide)}
        color={BCOLORS.red} thickness={18} headLen={25} headH={32}
        opacity={frame >= 3195 ? ncArrowOp : 0} />
      <Arrow tail={fx(rDA(ANCHOR_3300.tealArrow.tail), D_ARR_FIX.tealTail)} tip={fx(rDA(ANCHOR_3300.tealArrow.tip), D_ARR_FIX.tealTip)}
        color={BCOLORS.teal} thickness={18} headLen={26} headH={33}
        opacity={frame >= 3180 ? fixArrowOp : 0} />
      <Txt p={fx(rDA(ANCHOR_3300.vbrTitle), D_FIX.vbrT)} size={27} opacity={dVbrOp}>Variable Base Rate</Txt>
      <RateValue p={fx(rDA(ANCHOR_3300.vbrValue), D_FIX.vbrV)} size={37} opacity={dVbrOp} value="5.0" />
      <Txt p={fx(rDA(ANCHOR_3300.fixedTitle), D_FIX.fixT)} size={25} opacity={frame >= 3180 ? fixOp : 0}>Fixed Rate</Txt>
      <RateValue p={fx(rDA(ANCHOR_3300.fixedValue), D_FIX.fixV)} size={32} opacity={frame >= 3180 ? fixOp : 0} value="3.0" />
      {/* Net Cash Settlement */}
      <Txt p={fx(rE(ANCHOR_3450.l1), E_FIX.l1)} size={24} opacity={ncOp}>Net Cash</Txt>
      <Txt p={fx(rE(ANCHOR_3450.l2), E_FIX.l2)} size={24} opacity={ncOp}>Settlement</Txt>
      <RateValue p={fx(rE(ANCHOR_3450.l3), E_FIX.l3)} size={30} opacity={ncOp} value="2.0" />
    </AbsoluteFill>
  );
};


