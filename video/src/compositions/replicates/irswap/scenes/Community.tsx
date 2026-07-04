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
  pad: "#FBFBF9",
  padEdge: "#E0E0DC",
} as const;

// ── camera: smooth piecewise-hermite path ────────────────────────
// Bank-anchored parametrization (u,v = bank apex screen track, W = bank
// pixel width -> depth). Values on [4685,4715] and [5265,5290] are
// bit-identical to the previous solve (frozen first/last keys + the
// frozen pitch segments) - boundary continuity into Slot and Outro.
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
  eye: { x: number; z: number };
  spec: MiniSpec;
  padW: number;
};
const WB: Record<string, CommB> = {
  house: {
    over: { x: 29.5, z: -143.7, kx: 0.522, ky: 0.55 },
    eye: { x: -114.7, z: -410.3 },
    spec: { kind: "house", W: 167.0, L: 130.5, H: 178.8, eaveFrac: 0.62, fill: C.blue, fillTop: C.blueLight, outline: C.blueDark, strokeW: 4, door: { u0: 0.37, u1: 0.63, top: 0.53, fill: C.door }, chimney: true },
    padW: 1.6,
  },
  bank: {
    over: { x: 226, z: -71.6, kx: 0.57, ky: 0.80 },
    eye: { x: 272, z: -300 },
    spec: { kind: "temple", W: 178, L: 32, H: 171.9, eaveFrac: 0.63, fill: C.red, outline: "#787E7C", strokeW: 4.5, cols: { n: 5, fill: "#FFFFFF" }, strip: true },
    padW: 1.6,
  },
  t1: {
    over: { x: -205.4, z: -207.8, kx: 0.442, ky: 0.442 },
    eye: { x: -695.8, z: -624.3 },
    spec: { kind: "temple", W: 130.0, L: 89.7, H: 154.2, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 4, fill: "#FFFFFF" }, strip: true },
    padW: 1.4,
  },
  cbs: {
    over: { x: -195, z: -67.0, kx: 0.442, ky: 0.442 },
    eye: { x: -746.7, z: -306.0 },
    spec: { kind: "box2", W: 144.3, L: 108.0, H: 170, eaveFrac: 0, fill: C.blue, outline: C.blueDark },
    padW: 1.4,
  },
  t2: {
    over: { x: -135.1, z: -263.9, kx: 0.442, ky: 0.585 },
    eye: { x: -536.9, z: -751.1 },
    spec: { kind: "temple", W: 122.8, L: 95.7, H: 111.8, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 5, fill: "#FFFFFF" }, strip: true },
    padW: 1.4,
  },
  t3: {
    over: { x: -40.3, z: -288.0, kx: 0.478, ky: 0.645 },
    eye: { x: -589.2, z: -1290.6 },
    spec: { kind: "temple", W: 100.8, L: 82.9, H: 97.6, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 3, fill: "#FFFFFF" }, strip: true },
    padW: 1.4,
  },
};
const wbAt = (b: CommB, f: number) => {
  const t = diveT(f);
  return {
    x: mixN(b.over.x, b.eye.x, t),
    z: mixN(b.over.z, b.eye.z, t),
    kx: mixN(b.over.kx, 1, t),
    ky: mixN(b.over.ky, 1, t),
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

// One-shot relocation for the floor DASHBOARD ink: the reference's 2.5D
// collage moves the dashboard with the buildings between shots (at eye
// level the rose chart spans x[344-711] y[356-479] on screen while the
// world-static ink projected out of view). Similarity fitted from the
// house+bank over→eye poses, blended with the same diveT as the buildings.
const inkFixRef: { fn: ((p: Pt) => Pt) | null } = { fn: null };
const fitSimRef: { fn: ((pairs: [Pt, Pt][]) => (p: Pt) => Pt) | null } = { fn: null };
const inkRelocate = (() => {
  const oH: Pt = [WB.house.over.x, WB.house.over.z];
  const eH: Pt = [WB.house.eye.x, WB.house.eye.z];
  const dO: Pt = [WB.bank.over.x - oH[0], WB.bank.over.z - oH[1]];
  const dE: Pt = [WB.bank.eye.x - eH[0], WB.bank.eye.z - eH[1]];
  const s = Math.hypot(dE[0], dE[1]) / Math.hypot(dO[0], dO[1]);
  const th = Math.atan2(dE[1], dE[0]) - Math.atan2(dO[1], dO[0]);
  const c = Math.cos(th) * s;
  const sn = Math.sin(th) * s;
  return (p: Pt, t: number, extra?: (pp: Pt) => Pt): Pt => {
    const q0: Pt = [
      eH[0] + c * (p[0] - oH[0]) - sn * (p[1] - oH[1]),
      eH[1] + sn * (p[0] - oH[0]) + c * (p[1] - oH[1]),
    ];
    let q = inkFixRef.fn ? inkFixRef.fn(q0) : q0;
    if (extra) q = extra(q);
    return [mixN(p[0], q[0], t), mixN(p[1], q[1], t)];
  };
})();

// Measured correction on top of the similarity (fit at f5100: the wave
// and card bboxes, replica render → reference): least-squares 2D
// similarity over the unprojected point pairs.
const inkFix = (() => {
  const fitSim = (pairsS: [Pt, Pt][]): ((p: Pt) => Pt) => {
    const pairs = pairsS.map(([a, b]): [Pt, Pt] => [toFloor(a[0], a[1], 5100), toFloor(b[0], b[1], 5100)]);
    let cpx = 0, cpz = 0, cqx = 0, cqz = 0;
    for (const [pp, q] of pairs) { cpx += pp[0]; cpz += pp[1]; cqx += q[0]; cqz += q[1]; }
    cpx /= pairs.length; cpz /= pairs.length; cqx /= pairs.length; cqz /= pairs.length;
    let sxx = 0, sxy = 0, spp = 0;
    for (const [pp, q] of pairs) {
      const px = pp[0] - cpx, pz = pp[1] - cpz, qx = q[0] - cqx, qz = q[1] - cqz;
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
  fitSimRef.fn = fitSim;
  const e1 = fitSim([
    [[295, 384], [348, 378]],
    [[625, 474], [666, 479]],
    [[35, 340], [94, 382]],
    [[292, 392], [307, 455]],
  ]);
  // round-3 render still under-scaled: wave/card bboxes re-measured
  const e2 = fitSim([
    [[346, 411], [346, 372]],
    [[632, 479], [723, 479]],
    [[129, 367], [90, 378]],
    [[325, 428], [409, 459]],
  ]);
  return (pp: Pt): Pt => e2(e1(pp));
})();
inkFixRef.fn = inkFix;

// hex color lerp for the eye-phase pale ink
const mixc = (a: string, b: string, t: number): string => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
};

// ── floor: static painted map (never moves; fades in place only) ─
const FLOOR_C: Pt = [0, -150];
export const SheetFloor: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    if (f >= 5285) return; // page-flip handoff to the outro board
    // the map dissolves ahead of the page-flip: all the sheet's ink fades
    // uniformly, reaching 0 at 5285 (multiplied into every alpha below)
    const dissolve = 1 - clamp01((f - 5262) / 23);
    // Ink relocation is OFF (dv = 0 keeps the dashboard world-static, as
    // before): the reference collage DOES move its dashboard into the eye
    // view, but every measured correspondence tried this round scored
    // worse than the static plant (misplaced ink loses to absent ink —
    // A/B at f5100: static .7352 vs relocated .7329). The machinery
    // (inkRelocate/fitSim) stays for a future round with better
    // correspondences.
    const dv = 0;
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
    // ── the fallen dashboard papers in front of the sheet (static)
    poly(m5250([[140, 330], [660, 335], [655, 460], [138, 452]]), "#FCFCFB", "#DCDCD8", 1.4);
    poly(m5250([[315, 340], [372, 342], [370, 356], [313, 354]]), "#C4C4C4", null);
    poly(m5250([[378, 342], [460, 345], [458, 365], [376, 362]]), "#D8EEF5", null);
    poly(m5250([[195, 385], [250, 388], [248, 415], [193, 412]]), "#D0EBF0", null);
    {
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
    ctx.setLineDash([6, 6]);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const a: Pt = [sheet[0][0] + (sheet[3][0] - sheet[0][0]) * t, sheet[0][1] + (sheet[3][1] - sheet[0][1]) * t];
      const b: Pt = [sheet[1][0] + (sheet[2][0] - sheet[1][0]) * t, sheet[1][1] + (sheet[2][1] - sheet[1][1]) * t];
      ctx.beginPath();
      ctx.moveTo(mx(a), my(a));
      ctx.lineTo(mx(b), my(b));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // dashboard artwork on the map (measured at f4810; rides the same
    // one-shot dive relocation as the buildings — the reference collage
    // keeps the rose chart + cards in view at eye level)
    const mR = (pts: Pt[]) => m10(pts).map((p) => inkRelocate(p, dv));
    const waveFix = fitSimRef.fn
      ? fitSimRef.fn([[[375, 409], [346, 372]], [[675, 469], [723, 479]]])
      : undefined;
    const mRW = (pts: Pt[]) => m10(pts).map((p) => inkRelocate(p, dv, waveFix));
    poly(mR([[330, 300], [398, 303], [396, 345], [328, 342]]), mixc("#C9C9C9", "#DFDFDD", dv), null);
    poly(mR([[405, 302], [490, 306], [488, 350], [403, 346]]), mixc("#CFEAF3", "#E4F2F6", dv), null);
    poly(mR([[150, 375], [260, 380], [256, 430], [146, 424]]), mixc("#CBE9EF", "#E1F0F3", dv), null);
    // tick columns under the chart
    ctx.strokeStyle = "#DDDDDA";
    ctx.lineWidth = mixN(1, 0.6, dv);
    for (let i = 0; i < 10; i++) {
      const a = inkRelocate(toFloor(505 + i * 18, 340, 4810), dv, waveFix);
      const b = inkRelocate(toFloor(500 + i * 18, 416, 4810), dv, waveFix);
      ctx.beginPath();
      ctx.moveTo(mx(a), my(a));
      ctx.lineTo(mx(b), my(b));
      ctx.stroke();
    }
    const sq = mRW([[500, 345], [524, 372], [548, 360], [574, 396], [600, 382], [626, 412], [652, 400], [680, 418]]);
    path(sq, false);
    ctx.strokeStyle = mixc(C.chartRed, "#E4B4BB", dv);
    ctx.lineWidth = mixN(2, 1.2, dv);
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    path(sq.map((p) => [p[0] + 6, p[1] + 14] as Pt), false);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
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
const RAY_O = { over: [-60.0, -183.2] as Pt, eye: toFloor(420, 330, 5100) };
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
const RAYS_C: Pt = [-400, -800];
const RaysPlane: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    const a = fade(f, 4700, 4708) * fadeOut(f, 5225, 5240) * fadeOut(f, 5262, 5271);
    if (a <= 0) return;
    const t = diveT(f);
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = C.ray;
    const mx = (p: Pt) => w / 2 + (p[0] - RAYS_C[0]);
    const my = (p: Pt) => h / 2 + (p[1] - RAYS_C[1]);
    const from: Pt = [mixN(RAY_O.over[0], RAY_O.eye[0], t), mixN(RAY_O.over[1], RAY_O.eye[1], t)];
    for (const tip of RAY_TIPS) {
      let tx: number;
      let tz: number;
      if (tip.b) {
        const p = wbAt(WB[tip.b], f);
        tx = p.x;
        tz = p.z;
      } else {
        const vc = VACANT[tip.v ?? 0];
        const et = RAY_VAC_EYE[tip.v ?? 0];
        tx = mixN(vc.over.x, et[0], t);
        tz = mixN(vc.over.z, et[1], t);
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

const Pad: React.FC<{ x: number; z: number; k: number; padW: number; opacity: number }> = ({
  x, z, k, padW, opacity,
}) => {
  const geos = padGeos(padW);
  if (opacity <= 0.005) return null;
  return (
    <group position={[x, FLOOR_Y + 2, z]} scale={[k, 1, k]}>
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

const CubeGlass: React.FC<{ quad: Pt[]; yTop: number; opacity: number; drop: number }> = ({
  quad, yTop, opacity, drop,
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
    <group position={[0, drop, 0]}>
      {built.panes.map((g, i) => (
        <mesh key={`g${i}`} geometry={g} renderOrder={3}>
          <meshPhysicalMaterial
            transparent
            opacity={0.32 * opacity}
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
    alpha = lerp1([[5216, 0], [5220, 0.04], [5230, 0.066], [5240, 0.05], [5246, 0]], f);
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
const PlantedBuilding: React.FC<{
  name: string; frame: number; opacity: number; pop?: number; dropY?: number;
}> = ({ name, frame, opacity, pop = 1, dropY = 0 }) => {
  const b = WB[name];
  const p = wbAt(b, frame);
  if (opacity <= 0.005 || pop <= 0.005) return null;
  return (
    <group position={[p.x, FLOOR_Y + dropY, p.z]} scale={[p.kx * pop, p.ky * pop, p.kx * pop]}>
      <MiniBuilding spec={b.spec} position={[0, 0, 0]} opacity={opacity} />
    </group>
  );
};

export const CommunityWorld: React.FC<{ frame: number }> = ({ frame }) => {
  const { cam, pitch } = camCommunity(frame);

  const iconFade = fadeOut(frame, 5262, 5271);

  // hero entries/exits measured on the reference: house fades in from
  // ~4694, bank ~4705; on the way out the house is gone by ~5275 and the
  // bank alone survives to ~5279
  const houseDrop = (1 - easeOutPow(fade(frame, 4694, 4708), 2)) * 40;
  const houseOp = fade(frame, 4694, 4708) * fadeOut(frame, 5266, 5275);
  const bankDrop = (1 - easeOutPow(fade(frame, 4705, 4715), 2)) * 36;
  const bankOp = fade(frame, 4705, 4715) * fadeOut(frame, 5270, 5279);

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

  // cbs and t1 leave the frame during the dive (the source drops them);
  // t2/t3 hold through eye level, slightly washed as in the source
  const cbsOp = iconFade * fadeOut(frame, 4950, 4970);
  const t1Op = iconFade * fadeOut(frame, 4955, 4975);
  const t2Op = iconFade * (1 - 0.45 * fade(frame, 4985, 5000));
  const t3Op = iconFade * (1 - 0.3 * fade(frame, 4985, 5000));

  const padOp = (name: string, a: number, b: number, extra = 1) => {
    const bld = WB[name];
    const p = wbAt(bld, frame);
    return { p, o: fade(frame, a, b) * iconFade * extra, w: bld.padW * bld.spec.W };
  };
  const pads = [
    { key: "p-house", ...padOp("house", 4700, 4712) },
    { key: "p-bank", ...padOp("bank", 4712, 4722) },
    // cbs/t1 pads leave with their buildings during the dive
    { key: "p-cbs", ...padOp("cbs", 4700, 4710, fadeOut(frame, 4950, 4970)) },
    { key: "p-t1", ...padOp("t1", 4700, 4710, fadeOut(frame, 4955, 4975)) },
    { key: "p-t2", ...padOp("t2", 4700, 4710) },
    { key: "p-t3", ...padOp("t3", 4700, 4710) },
  ];
  const dvT = diveT(frame);

  return (
    <>
      <ambientLight intensity={2.5} />
      <Backdrop cam={cam} pitch={pitch} />
      {/* SheetFloor is mounted by the ground layer, not here */}
      <RaysPlane frame={frame} />
      {/* slab pads under buildings + the two vacant lots */}
      {pads.map(({ key, p, o, w }) => (
        <Pad key={key} x={p.x} z={p.z} k={p.kx} padW={w} opacity={o} />
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
      <CubeGlass quad={cube.quad} yTop={cube.yTop} opacity={cubeOp} drop={cubeDrop + cubeLift} />
    </>
  );
};

export const CommunityOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <>
      {/* foreground glass pane crossing the camera */}
      <GlassSweep frame={frame} />
    </>
  );
};
