// Pure computation model for the chart-room mega-scene (frames 0-1704).
// Everything is derived from measured data in ../data/chartroom.ts.
// World convention: see lib/world.tsx (units = anchor screen px).

import * as THREE from "three";
import {
  A, B, C, BOARD_FALL, WALL_GROW,
  B_GREY_X1, B_GRID, B_TOP5,
  C_FIXED_LBL, C_BASE_LBL, C_GRID, C_TOPV, C_SPACING, C_JAGGED_TIP, C_RED_TIP,
  C_JAGGED_DENSE, C_RED_TOP, A_WALL_DRIFT,
  B_BASE_LABEL,
} from "../data/chartroom";
import {
  lerp1, lerpTrack, polyArc, monotonic, easeInOutCubic, easeOutPow, easeInPow,
  clamp01, pointAtArc,
} from "../lib/helpers";
import type { Pt, TrackRow } from "../lib/helpers";
import {
  DCAM, fitWall, unprojToWall, wallToWorld, unprojToFloor, project, solveCamXY,
} from "../lib/world";
import type { V3, WallFit } from "../lib/world";

// ═════════════ Chapter A ═════════════
export const fitA = fitWall(A.gridXs);

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
// Wall top/base are horizontal 3D lines: constant wall-space y, sampled
// at the center gridline (screen slope emerges from the wall recession).
export const yTopA = unprojToWall(fitA, A.gridXs[5], A.gridTopY)[1];
// floor height from the board far edge (f340 quad: (249,360)-(538,351))
export const yBaseA = avg([
  unprojToWall(fitA, 249, 360)[1],
  unprojToWall(fitA, 538, 351)[1],
]);
export const floorYA = yBaseA;

// Board spread rect (chapter A world, scale-1): from the f340 quad.
// s along the wall from the far-left corner; depth toward the camera.
const perpOf = (fit: { dirS: V3 }): V3 => [fit.dirS[2], 0, -fit.dirS[0]]; // far direction
const floorCoord = (fit: ReturnType<typeof fitWall>, u: number, v: number, yF: number, cam: V3 = [0, 0, DCAM], yaw = 0) => {
  const p = unprojToFloor(u, v, yF, cam, yaw);
  const rel: V3 = [p[0] - fit.origin[0], 0, p[2] - fit.origin[2]];
  const s = rel[0] * fit.dirS[0] + rel[2] * fit.dirS[2];
  const far = perpOf(fit);
  const t = rel[0] * far[0] + rel[2] * far[2]; // + = away from camera
  return { s, t };
};
export const boardA = (() => {
  const tl = floorCoord(fitA, 249, 360, floorYA);
  const tr = floorCoord(fitA, 538, 351, floorYA);
  const bl = floorCoord(fitA, 210, 462, floorYA);
  const br = floorCoord(fitA, 692, 416, floorYA);
  const s0 = (tl.s + bl.s) / 2;
  const s1 = (tr.s + br.s) / 2;
  const tFar = (tl.t + tr.t) / 2;
  const tNear = (bl.t + br.t) / 2;
  return { s0, s1, w: s1 - s0, depth: tFar - tNear, tFar, tNear };
})();

// Absolute-scale factor for the chapter-A room. The falling title page
// (absolute size known from f0) lands ON this floor and fades out while
// the board fades in — the scale places the floor at the depth where the
// landed page's far edge projects to the measured v≈356 with a plausible
// page width on screen. Chapter A room renders inside a group scaled by
// SCALE_A about the camera axis point.
export const SCALE_A = 2.26;
export const A_GROUP = {
  scale: SCALE_A,
  position: [0, 0, DCAM * (1 - SCALE_A)] as V3,
};
// A-wall ink drift (wall-object slide; years/legend do not move).
export const wallDriftA = (f: number) => lerp1(A_WALL_DRIFT, f);
// Board (floor spread) fade-in around the page landing.
export const boardInkA = (f: number) => clamp01((f - 105) / 35);

export const wallA = {
  redPoly: A.redPoly.map((p) => unprojToWall(fitA, p[0], p[1])),
  redArc: null as unknown as { cum: number[]; total: number },
  markers: A.markers.map((m) => {
    const c = unprojToWall(fitA, m.c[0], m.c[1]);
    const tl = unprojToWall(fitA, m.c[0] - m.w / 2, m.c[1] - m.h / 2);
    const br = unprojToWall(fitA, m.c[0] + m.w / 2, m.c[1] + m.h / 2);
    return { c, w: br[0] - tl[0], h: tl[1] - br[1], n: m.n, pop: m.pop };
  }),
  legend: A.legend.map((r) => {
    const right = unprojToWall(fitA, A.legendTextRight, r.y);
    const swatch = unprojToWall(fitA, A.legendSwatchCx, r.y);
    return { text: r.text, right, swatch, pop: r.pop };
  }),
  legendSwatchW: unprojToWall(fitA, A.legendSwatchCx + A.legendSwatch.w / 2, 100)[0] -
    unprojToWall(fitA, A.legendSwatchCx - A.legendSwatch.w / 2, 100)[0],
  baseLabel: unprojToWall(fitA, A.baseRateLabel.bbox[0], A.baseRateLabel.bbox[1] + A.baseRateLabel.bbox[3]),
  baseLabelCap: unprojToWall(fitA, 427, A.baseRateLabel.bbox[1])[1] -
    unprojToWall(fitA, 427, A.baseRateLabel.bbox[1] + A.baseRateLabel.bbox[3])[1],
  baselineY: avg([unprojToWall(fitA, 250, A.dashedBaselineY)[1], unprojToWall(fitA, 700, A.dashedBaselineY)[1]]),
  baselineS: [unprojToWall(fitA, 200, A.dashedBaselineY)[0], unprojToWall(fitA, 800, A.dashedBaselineY)[0]] as Pt,
};
wallA.redArc = polyArc(wallA.redPoly);

// Year-glyph metrics on the floor (from the f340 "1990" quad):
// screen 59x15px ↔ floor units; drawn depth-stretched.
export const yearMetricsA = (() => {
  const l = floorCoord(fitA, 252, 365.5, floorYA);
  const r = floorCoord(fitA, 311, 362.4, floorYA);
  const b = floorCoord(fitA, 252, 377.2, floorYA);
  return { width: r.s - l.s, depth: Math.abs(l.t - b.t) }; // "1990" 4 glyphs
})();

// A camera: static until the pan; measured floor-point solve during pan.
const y2010WorldA = unprojToFloor(554, 352.5, floorYA);
const panSamples: [number, number][] = [
  [420, 552.2], [425, 551.3], [430, 522.5], [435, 463.5], [440, 391.3],
  [445, 329.5], [450, 314.8],
];
const panCx: [number, number][] = [[412, 0], ...panSamples.map(([f, u]): [number, number] => {
  const [cx] = solveCamXY(y2010WorldA, u, 352.5 + (u < 500 ? 25 : 5), DCAM); // v approx; x dominates
  return [f, cx];
})];
// extrapolate to 452 with the last slope
{
  const [f1, v1] = panCx[panCx.length - 2];
  const [f2, v2] = panCx[panCx.length - 1];
  panCx.push([452, v2 + ((v2 - v1) / (f2 - f1)) * 2]);
}
export const camA = (f: number): V3 => {
  if (f < 412) return [0, 0, DCAM];
  return [lerp1(panCx, f), 0, DCAM];
};

// Red line draw progress (linear along arc, f127→300).
export const redProgressA = (f: number) =>
  wallA.redArc.total * clamp01((f - A.drawStart) / (A.drawEnd - A.drawStart));

// ═════════════ Chapter B ═════════════
export const fitB = fitWall(B.gridXs);
export const yTopB = unprojToWall(fitB, B.gridXs[5], B.gridTopY)[1];
// floor from the board far edge at anchor f860: (266,436)-(692,470)
export const yBaseB = avg([
  unprojToWall(fitB, 266, 436)[1],
  unprojToWall(fitB, 692, 470)[1],
]);
export const floorYB = yBaseB;

// B camera: per-frame Gauss-Newton (cx, cz, yaw) from the 11 tracked
// gridlines, then cy from the top of gridline #5 (index 4).
//
// WHY YAW: the reference camera ORBITS the chapter-B wall. Its measured
// gridline spacing narrows to the RIGHT at f455-750 (left side close,
// e.g. f500: 40→24px) and to the LEFT by f870-900 — a flip in the
// recession direction. A translation-only camera cannot flip which end
// of a fixed wall is nearer, so the old 2-param solve compromised at
// ~11px RMS (wall, labels, curve and floor all landed visibly wrong,
// worst mid-chapter). With a yaw DOF the same tracked data fits at
// ~0.25px RMS; yaw runs -0.857rad @455 → 0 near the f860 anchor →
// +0.135 @900. Real camera motion, same rigid world.
const gridWorldB = Array.from({ length: 11 }, (_, i) =>
  wallToWorld(fitB, i * fitB.spacing, 0),
);

// u-projection of a vertical wall line (x, z) through a yawed camera.
const uPredYaw = (P: V3, cx: number, cz: number, g: number): number => {
  const px = P[0] - cx;
  const pz = P[2] - cz;
  const c = Math.cos(g);
  const s = Math.sin(g);
  return 427 + (DCAM * (c * px - s * pz)) / -(s * px + c * pz);
};

export const wallB = {
  solidPoly: B.solidPoly.map((p) => unprojToWall(fitB, p[0], p[1])),
  dashes: B.dashCentroids.map((p) => unprojToWall(fitB, p[0], p[1])),
  greyY: avg([unprojToWall(fitB, B.greyLine.x0, B.greyLine.y0)[1], unprojToWall(fitB, B.greyLine.x1, B.greyLine.y1)[1]]),
  baselineY: unprojToWall(fitB, 427, B.dashedBaselineY)[1],
  fixedLabel: {
    tl: unprojToWall(fitB, B.labels.fixed[0], B.labels.fixed[1]),
    cap: unprojToWall(fitB, 427, B.labels.fixed[1])[1] - unprojToWall(fitB, 427, B.labels.fixed[1] + B.labels.fixed[3])[1],
  },
  baseLabel: {
    tl: unprojToWall(fitB, B.labels.base[0], B.labels.base[1]),
    cap: unprojToWall(fitB, 427, B.labels.base[1])[1] - unprojToWall(fitB, 427, B.labels.base[1] + B.labels.base[3])[1],
  },
  baselineS: [
    unprojToWall(fitB, 150, B.dashedBaselineY)[0],
    unprojToWall(fitB, 725, B.dashedBaselineY)[0],
  ] as [number, number],
};
export const solidArcB = polyArc(wallB.solidPoly);

// dash count schedule
export const dashCountB = (f: number) =>
  f < B.firstDash ? 0 : Math.min(B.dashCentroids.length, 1 + Math.floor((f - B.firstDash) / 4.7));

// Per-frame Gauss-Newton (cx, cz, yaw) over tracked gridline xs. Shared by
// chapters B and C — identical math to the original B-only block, so the
// B tables are byte-identical.
const solveGridCam = (
  gridWorld: V3[],
  rows: readonly (readonly [number, number[]])[],
): { cx: [number, number][]; cz: [number, number][]; g: [number, number][] } => {
  const cxT: [number, number][] = [];
  const czT: [number, number][] = [];
  const gT: [number, number][] = [];
  for (const [f, xs] of rows) {
    // init from the old linear (cx, cz | g=0) solve
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < gridWorld.length; i++) {
      const u = xs[i] - 427;
      const rhs = DCAM * gridWorld[i][0] + u * gridWorld[i][2];
      a11 += DCAM * DCAM;
      a12 += DCAM * u;
      a22 += u * u;
      b1 += DCAM * rhs;
      b2 += u * rhs;
    }
    const det = a11 * a22 - a12 * a12;
    let cx = (b1 * a22 - b2 * a12) / det;
    let cz = (a11 * b2 - a12 * b1) / det;
    let g = 0;
    // Gauss-Newton over (cx, cz, g), numeric Jacobian
    for (let it = 0; it < 30; it++) {
      const A = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      const b = [0, 0, 0];
      for (let i = 0; i < gridWorld.length; i++) {
        const u0 = uPredYaw(gridWorld[i], cx, cz, g);
        const r = u0 - xs[i];
        const J = [
          (uPredYaw(gridWorld[i], cx + 1e-2, cz, g) - u0) / 1e-2,
          (uPredYaw(gridWorld[i], cx, cz + 1e-2, g) - u0) / 1e-2,
          (uPredYaw(gridWorld[i], cx, cz, g + 1e-4) - u0) / 1e-4,
        ];
        for (let a = 0; a < 3; a++) {
          b[a] -= J[a] * r;
          for (let c = 0; c < 3; c++) A[a][c] += J[a] * J[c];
        }
      }
      const det3 = (m: number[][]) =>
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
        m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
        m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      const D3 = det3(A);
      if (Math.abs(D3) < 1e-12) break;
      const col = (m: number[][], k: number, v: number[]) =>
        m.map((row, i) => row.map((x, j) => (j === k ? v[i] : x)));
      const dx = det3(col(A, 0, b)) / D3;
      const dz = det3(col(A, 1, b)) / D3;
      const dg = det3(col(A, 2, b)) / D3;
      cx += dx;
      cz += dz;
      g += dg;
      if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6 && Math.abs(dg) < 1e-9) break;
    }
    cxT.push([f, cx]);
    czT.push([f, cz]);
    gT.push([f, g]);
  }
  return { cx: cxT, cz: czT, g: gT };
};

const bSolve = solveGridCam(gridWorldB, B_GRID);
const camBcx = bSolve.cx;
const camBcz = bSolve.cz;
const camBg = bSolve.g;
// Camera yaw (rotation.y) for chapter B; 0 outside the B window — the
// solve regime switches at 452/935 exactly where the chapter content
// crossfades, same masking as the existing position jumps there.
export const camBYaw = (f: number): number => lerp1(camBg, f);
const top5World = wallToWorld(fitB, 4 * fitB.spacing, 0); // z of line 5
const camBcy: [number, number][] = B_TOP5.map(([f, v]) => {
  const cz = lerp1(camBcz, f);
  const cx = lerp1(camBcx, f);
  const g = lerp1(camBg, f);
  // depth of the gridline-5 top through the yawed camera
  const dEff = -(Math.sin(g) * (top5World[0] - cx) + Math.cos(g) * (top5World[2] - cz));
  return [f, yTopB - ((240 - v) * dEff) / DCAM] as [number, number];
});
export const camB = (f: number): V3 => [
  lerp1(camBcx, f), lerp1(camBcy, f), lerp1(camBcz, f),
];

// Board spread rect chapter B (from f500 quad, camB(500) + its yaw)
export const boardB = (() => {
  const cam = camB(500);
  const g = camBYaw(500);
  const tl = floorCoord(fitB, 236, 391, floorYB, cam, g);
  const tr = floorCoord(fitB, 494, 358, floorYB, cam, g);
  const bl = floorCoord(fitB, 47, 571, floorYB, cam, g);
  const br = floorCoord(fitB, 697, 421, floorYB, cam, g);
  const s0 = (tl.s + bl.s) / 2;
  const s1 = (tr.s + br.s) / 2;
  const tFar = (tl.t + tr.t) / 2;
  const tNear = (bl.t + br.t) / 2;
  return { s0, s1, w: s1 - s0, depth: tFar - tNear, tFar, tNear };
})();
// f500 "2015" quad → glyph metrics on the B floor
export const yearMetricsB = (() => {
  const cam = camB(500);
  const g = camBYaw(500);
  const l = floorCoord(fitB, 405, 379.7, floorYB, cam, g);
  const r = floorCoord(fitB, 443, 374.9, floorYB, cam, g);
  const b = floorCoord(fitB, 405, 390.4, floorYB, cam, g);
  return { width: r.s - l.s, depth: Math.abs(l.t - b.t) }; // "2015" 4 glyphs
})();

// grey line extension in wall coords, from measured screen samples
const greyYat = (x: number) =>
  B.greyLine.y0 + ((B.greyLine.y1 - B.greyLine.y0) * (x - B.greyLine.x0)) / (B.greyLine.x1 - B.greyLine.x0);
const greyS1Table: [number, number][] = monotonic([
  [B.greyTiming.stubStart, unprojToWall(fitB, 251, greyYat(251), camB(B.greyTiming.stubStart), camBYaw(B.greyTiming.stubStart))[0]],
  ...B_GREY_X1.map(([f, x1]): [number, number] => [f, unprojToWall(fitB, x1, greyYat(x1), camB(f), camBYaw(f))[0]]),
]);
const greyS0Table: [number, number][] = [
  [B.greyTiming.stubStart, unprojToWall(fitB, 249, greyYat(249), camB(B.greyTiming.stubStart), camBYaw(B.greyTiming.stubStart))[0]],
  [705, unprojToWall(fitB, 230, greyYat(230), camB(705), camBYaw(705))[0]],
  [750, unprojToWall(fitB, 224.5, greyYat(224.5), camB(750), camBYaw(750))[0]],
  [800, unprojToWall(fitB, 227, greyYat(227), camB(800), camBYaw(800))[0]],
  [895, unprojToWall(fitB, 232, greyYat(232), camB(895), camBYaw(895))[0]],
];
export const greyExtentB = (f: number): [number, number] | null => {
  if (f < B.greyTiming.stubStart) return null;
  return [lerp1(greyS0Table, f), lerp1(greyS1Table, f)];
};

// wall fade for dashes/grey/red-stub (B→C transition)
export const wallInkFadeB = (f: number) => 1 - clamp01((f - B.fade[0]) / (B.fade[1] - B.fade[0]));

// projected B labels for the DOM glide (from f903)
export const fixedLabelWorldB: V3 = wallToWorld(
  fitB,
  wallB.fixedLabel.tl[0] + (unprojToWall(fitB, B.labels.fixed[0] + B.labels.fixed[2] / 2, 295)[0] - wallB.fixedLabel.tl[0]),
  (wallB.fixedLabel.tl[1] + unprojToWall(fitB, 427, B.labels.fixed[1] + B.labels.fixed[3])[1]) / 2,
);
export const baseLabelWorldB: V3 = wallToWorld(
  fitB,
  unprojToWall(fitB, B.labels.base[0] + B.labels.base[2] / 2, 361)[0],
  (wallB.baseLabel.tl[1] + unprojToWall(fitB, 427, B.labels.base[1] + B.labels.base[3])[1]) / 2,
);

// ═════════════ Chapter C ═════════════
export const fitC = fitWall(C.gridXs);
// measured gridline tops at f1615: (280,163) (533,145) (736,134)
export const yTopC = avg([
  unprojToWall(fitC, 280, 163)[1],
  unprojToWall(fitC, 533, 145)[1],
  unprojToWall(fitC, 736, 134)[1],
]);
const gapAnchorC = lerp1(C_SPACING, C.anchorFrame);

// C camera: the same per-frame Gauss-Newton as chapter B, over the 11
// scanned gridline xs (C_GRID). The reference orbits chapter C too — the
// gridline recession flips from left-near (f950) to right-near (f1400):
// yaw runs +0.12 @950 → -0.61 @1400 → +0.17 @1655 at 0.14-0.28px RMS
// (the old translation-only single-line model compromised at 10-15px).
const gridWorldC = Array.from({ length: 11 }, (_, i) =>
  wallToWorld(fitC, i * fitC.spacing, 0),
);
const cSolve = solveGridCam(gridWorldC, C_GRID);
// Frozen exit pose == the pre-refit camC(1650) clamp at full precision.
// The solved orbit tapers into it across 1655→1690 (inside the gridline
// topple), so camChartRoom(1705) — and therefore T_BLD and every
// downstream handoff — stays byte-identical, and yaw is 0 from 1690.
const C_EXIT_POSE: V3 = [
  -3.4758713858605894, 0.89834503324520654, 674.55307677644521,
];
const camCcx: [number, number][] = [...cSolve.cx, [1690, C_EXIT_POSE[0]]];
const camCcz: [number, number][] = [...cSolve.cz, [1690, C_EXIT_POSE[2]]];
const camCg: [number, number][] = [...cSolve.g, [1690, 0]];
export const camCYaw = (f: number): number =>
  f < 935 || f >= 1690 ? 0 : lerp1(camCg, f);
// cy from the tracked top of gridline #5 through the yawed camera,
// exactly as chapter B derives cy from B_TOP5.
const top5WorldC = wallToWorld(fitC, 5 * fitC.spacing, 0);
const camCcy: [number, number][] = [
  ...C_TOPV.map(([f, v]): [number, number] => {
    const cx = lerp1(camCcx, f);
    const cz = lerp1(camCcz, f);
    const g = lerp1(camCg, f);
    const dEff = -(Math.sin(g) * (top5WorldC[0] - cx) + Math.cos(g) * (top5WorldC[2] - cz));
    return [f, yTopC - ((240 - v) * dEff) / DCAM];
  }),
  [1690, C_EXIT_POSE[1]],
];
export const camC = (f: number): V3 => [
  lerp1(camCcx, f), lerp1(camCcy, f), lerp1(camCcz, f),
];

// floor + board chapter C (from f1100 far edge/quad with camC(1100))
export const yBaseC = avg([
  unprojToWall(fitC, 322, 365, camC(1100), camCYaw(1100))[1],
  unprojToWall(fitC, 644, 392, camC(1100), camCYaw(1100))[1],
]);
export const floorYC = yBaseC;
export const boardC = (() => {
  const cam = camC(1100);
  const g = camCYaw(1100);
  const tl = floorCoord(fitC, 322, 365, floorYC, cam, g);
  const tr = floorCoord(fitC, 644, 392, floorYC, cam, g);
  const bl = floorCoord(fitC, 129, 447, floorYC, cam, g);
  const br = floorCoord(fitC, 662, 520, floorYC, cam, g);
  const s0 = (tl.s + bl.s) / 2;
  const s1 = (tr.s + br.s) / 2;
  const tFar = (tl.t + tr.t) / 2;
  const tNear = (bl.t + br.t) / 2;
  return { s0, s1, w: s1 - s0, depth: tFar - tNear, tFar, tNear };
})();

// Floor plane placement helper: center + orientation for a spread rect.
export const floorPlacement = (
  fit: WallFit,
  board: { s0: number; s1: number; tFar: number; tNear: number },
  yF: number,
) => {
  const far: V3 = perpOf(fit);
  const sC = (board.s0 + board.s1) / 2;
  const tC = (board.tFar + board.tNear) / 2;
  const center: V3 = [
    fit.origin[0] + fit.dirS[0] * sC + far[0] * tC,
    yF,
    fit.origin[2] + fit.dirS[2] * sC + far[2] * tC,
  ];
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(fit.dirS[0], 0, fit.dirS[2]),
    new THREE.Vector3(far[0], 0, far[2]),
    new THREE.Vector3(0, 1, 0),
  );
  const quat = new THREE.Quaternion().setFromRotationMatrix(m);
  return { center, quat };
};

// dense measured polylines (extrema-preserving) at the f1615 anchor
const redPolyDenseScreen: Pt[] = [
  ...C.redPoly.filter((p) => p[0] < 538),
  ...C_RED_TOP.map((p) => p as Pt),
];
export const wallC = {
  jaggedPoly: C_JAGGED_DENSE.map((p) => unprojToWall(fitC, p[0], p[1])),
  redPoly: redPolyDenseScreen.map((p) => unprojToWall(fitC, p[0], p[1])),
  baselineY: unprojToWall(fitC, 427, C.dashedBaselineY)[1],
};
export const jaggedArcC = polyArc(wallC.jaggedPoly);
export const redArcC = polyArc(wallC.redPoly);

// Draw-progress solvers: map measured screen tips → arc position, using
// the frame's camera. Precomputed tables.
const solveTipArc = (
  fit: WallFit,
  polyW: Pt[],
  arc: { cum: number[] },
  cam: V3,
  yaw: number,
  target: Pt,
  xOnly: boolean,
): number => {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < polyW.length; i++) {
    const p = project(wallToWorld(fit, polyW[i][0], polyW[i][1]), cam, yaw);
    const d = xOnly ? Math.abs(p[0] - target[0]) : Math.hypot(p[0] - target[0], p[1] - target[1]);
    if (d < bestD) {
      bestD = d;
      best = arc.cum[i];
    }
  }
  return best;
};
const jaggedProgTable: [number, number][] = monotonic(
  C_JAGGED_TIP.map(([f, x]): [number, number] => [
    f, solveTipArc(fitC, wallC.jaggedPoly, jaggedArcC, camC(f), camCYaw(f), [x, 0], true),
  ]),
);
const redProgTable: [number, number][] = monotonic(
  C_RED_TIP.map(([f, x, y]): [number, number] => [
    f, solveTipArc(fitC, wallC.redPoly, redArcC, camC(f), camCYaw(f), [x, y], false),
  ]),
);
export const jaggedProgressC = (f: number) =>
  f < C.jaggedStart ? 0 : lerp1(jaggedProgTable, f);
export const redProgressC = (f: number) => lerp1(redProgTable, f);

// ═════════ Chapter C exit (measured erase + topple, no whiteout) ═════════
// Reference: traces retract left→right ~1642-1672 (jagged left half gone
// by 1660, red keeps only its upper arc); the 11 wall gridlines topple
// right→left 1662-1684, each pivoting at its base and falling toward
// screen-right; the dashed skirting fades under the topple; the floor
// sheet persists and fades 1712-1740 while the next scene's floor inks in.
export const C_EXIT = {
  redErase: [1642, 1671] as const, // ease-in: front at x≈487 by 1660
  jaggedErase: [1644, 1668] as const, // linear: front at x≈380 by 1660
  labelFade: [1644, 1662] as const, // DOM labels nearly gone by 1660
  baselineFade: [1662, 1682] as const,
  toppleStart: 1662,
  toppleStagger: 1.4, // per gridline, rightmost first
  toppleDur: 8, // leftmost: starts 1676, done 1684
  floorFade: [1712, 1740] as const,
} as const;

// Erase fronts: arc position measured from the polyline start (screen-
// left), so the traces retract left→right while the tip stays put.
export const redEraseC = (f: number) =>
  redArcC.total *
  easeInPow((f - C_EXIT.redErase[0]) / (C_EXIT.redErase[1] - C_EXIT.redErase[0]), 1.6);
export const jaggedEraseC = (f: number) =>
  jaggedArcC.total *
  clamp01((f - C_EXIT.jaggedErase[0]) / (C_EXIT.jaggedErase[1] - C_EXIT.jaggedErase[0]));

// Sub-polyline between arc positions s0..s1 (both ends interpolated).
export const polySliceArc = (
  poly: readonly Pt[],
  cum: number[],
  s0: number,
  s1: number,
): Pt[] => {
  const total = cum[cum.length - 1];
  const a = Math.min(Math.max(s0, 0), total);
  const b = Math.min(Math.max(s1, 0), total);
  if (b - a < 1e-9) return [];
  const out: Pt[] = [pointAtArc(poly, cum, a)];
  for (let i = 0; i < poly.length; i++) {
    if (cum[i] > a && cum[i] < b) out.push([poly[i][0], poly[i][1]]);
  }
  out.push(pointAtArc(poly, cum, b));
  return out;
};

// Gridline topple: i = 0 (leftmost) .. 10 (rightmost). Rightmost tips
// first; each rotates about its base to +90° toward screen-right with an
// ease-in fall (a card tipping over), fading out as it goes.
export const toppleC = (f: number, i: number): { angle: number; alpha: number } => {
  const t = clamp01(
    (f - (C_EXIT.toppleStart + (10 - i) * C_EXIT.toppleStagger)) / C_EXIT.toppleDur,
  );
  return { angle: easeInPow(t, 2.2) * (Math.PI / 2), alpha: 1 - easeInPow(t, 1.8) };
};

export const baselineFadeC = (f: number) =>
  1 - clamp01((f - C_EXIT.baselineFade[0]) / (C_EXIT.baselineFade[1] - C_EXIT.baselineFade[0]));
export const labelFadeC = (f: number) =>
  1 - clamp01((f - C_EXIT.labelFade[0]) / (C_EXIT.labelFade[1] - C_EXIT.labelFade[0]));
export const floorFadeC = (f: number) =>
  1 - clamp01((f - C_EXIT.floorFade[0]) / (C_EXIT.floorFade[1] - C_EXIT.floorFade[0]));

// Label sizing: screen cap height scales with the zoom table.
export const labelCapC = (f: number) => 17 * (lerp1(C_SPACING, Math.min(Math.max(f, 940), 1650)) / gapAnchorC);

// DOM label positions across the B→C glide and chapter C.
export const fixedLabelPos = (f: number): Pt => {
  if (f < 935) {
    const p = project(fixedLabelWorldB, camB(f), camBYaw(f));
    if (f < 903) return p;
    const c: Pt = [C_FIXED_LBL[0][1], C_FIXED_LBL[0][2]];
    const t = easeInOutCubic(clamp01((f - 903) / 37));
    return [p[0] + (c[0] - p[0]) * t, p[1] + (c[1] - p[1]) * t];
  }
  return lerpTrack(C_FIXED_LBL, f);
};
export const baseLabelPos = (f: number): Pt => {
  if (f <= 935) return lerpTrack(B_BASE_LABEL, f);
  const rows: TrackRow[] = [[935, 225.0, 349.0], ...C_BASE_LBL];
  return lerpTrack(rows, f);
};

// ═════════════ Title page (S01 + fall) ═════════════
// Pose origin = the INNER photo card center (that is what solvePnP solved).
// Page top edge sits 268 units above it in page-local coords.
export const PAGE_W = 610;
export const PAGE_H = 800;
export const INNER_TO_TOP = 268;

type PoseKey = { f: number; pos: V3; quat: THREE.Quaternion };
const q = (x: number, y: number, z: number, w: number) => new THREE.Quaternion(x, y, z, w);
// f0/f25 forced frontal (measured quads are axis-aligned rects there);
// f38-f70 from solvePnP on the inner-card quads (≤1.7px reprojection).
export const titleKeys: PoseKey[] = [
  { f: 0, pos: [-0.6, 1.5, 0], quat: q(0, 0, 0, 1) },
  { f: 25, pos: [-5.2, 6.5, -13.9], quat: q(0, 0, 0, 1) },
  { f: 38, pos: [-33.0, 41.6, -98.5], quat: q(-0.0215, -0.0079, 0.0002, 0.9997) },
  { f: 50, pos: [-88.9, 94.1, -255.5], quat: q(-0.0203, -0.031, 0.0014, 0.9993) },
  { f: 62, pos: [-120.9, 119.1, -336.2], quat: q(-0.0044, -0.0576, -0.0001, 0.9983) },
  { f: 66, pos: [-113.6, 136.2, -390.5], quat: q(-0.0399, -0.1104, 0.0026, 0.9931) },
  { f: 70, pos: [-80.4, 153.7, -443.7], quat: q(-0.1081, -0.2466, 0.0162, 0.9629) },
];

// Flat (landed) pose: board on the A floor; far edge projects to y≈342.
// The page lands flat on the (scaled) A floor, offset slightly right of
// the board, then FADES OUT f108-138 while the board fades in beneath.
export const PAGE_H_ABS = 810; // page depth (teal reaches frame bottom at f62)
const MESH_DX = 9.4;
const MESH_DY = -(PAGE_H_ABS / 2 - INNER_TO_TOP);
export const meshOffset: V3 = [MESH_DX, MESH_DY, 0];

const landedPose: PoseKey = (() => {
  const yAbs = SCALE_A * floorYA; // floor height in absolute coords
  // far edge center lands at screen ≈(528, 356)
  const farEdge = unprojToFloor(528, 356, yAbs);
  const yawFlat = (-6 * Math.PI) / 180;
  const quat = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawFlat)
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
  // group origin (inner-card center) sits INNER_TO_TOP nearer than far edge
  const pos: V3 = [farEdge[0], yAbs, farEdge[2] + INNER_TO_TOP];
  return { f: 100, pos, quat };
})();
export const pageFade = (f: number) => 1 - clamp01((f - 108) / 30);

const posePair = (a: PoseKey, b: PoseKey, t: number): { pos: V3; quat: THREE.Quaternion } => {
  const pos: V3 = [
    a.pos[0] + (b.pos[0] - a.pos[0]) * t,
    a.pos[1] + (b.pos[1] - a.pos[1]) * t,
    a.pos[2] + (b.pos[2] - a.pos[2]) * t,
  ];
  const quat = a.quat.clone().slerp(b.quat, t);
  return { pos, quat };
};

// Fall progress τ solved per BOARD_FALL sample (projected far-edge y).
const topEdgeY = (tau: number): number => {
  const { pos, quat } = posePair(titleKeys[titleKeys.length - 1], landedPose, tau);
  const local = new THREE.Vector3(0, INNER_TO_TOP, 0).applyQuaternion(quat);
  const world: V3 = [pos[0] + local.x, pos[1] + local.y, pos[2] + local.z];
  return project(world, [0, 0, DCAM])[1];
};
const solveTau = (targetY: number): number => {
  let lo = 0, hi = 1.4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (topEdgeY(mid) < targetY) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
const tauTable: [number, number][] = [
  [70, 0],
  [77, solveTau(40)], // eased lead-in between key70 and first sample
  ...BOARD_FALL.filter(([f]) => f <= 100).map(([f, y]): [number, number] => [f, solveTau(y)]),
  [104, 1],
];

const titlePoseRaw = (f: number): { pos: V3; quat: THREE.Quaternion } => {
  if (f <= 0) return { pos: titleKeys[0].pos, quat: titleKeys[0].quat };
  if (f < 70) {
    let i = 0;
    while (i < titleKeys.length - 2 && titleKeys[i + 1].f < f) i++;
    const a = titleKeys[i];
    const b = titleKeys[i + 1];
    const t = clamp01((f - a.f) / (b.f - a.f));
    return posePair(a, b, t);
  }
  const tau = lerp1(tauTable, f);
  return posePair(titleKeys[titleKeys.length - 1], landedPose, tau);
};

// Measured fall correction: at f34-40 the board renders ~6% small and
// up-left (card center (403,208) vs ref (415,223), width ratio 0.94 —
// constant across the window). Applied as a depth pull-in (screen scale
// ×1.065 about the principal point) plus the residual screen shift,
// feathered in after the frontal title (≤26) and out before the landing
// keys re-pin the pose.
const FALL_FIX = { k: 1.065, du: 13.6, dv: 17.1 };
const fallFixT = (f: number): number => {
  if (f <= 26 || f >= 60) return 0;
  if (f < 32) return (f - 26) / 6;
  if (f <= 44) return 1;
  return 1 - (f - 44) / 16;
};
export const titlePose = (f: number): { pos: V3; quat: THREE.Quaternion } => {
  const raw = titlePoseRaw(f);
  const t = fallFixT(f);
  if (t <= 0) return raw;
  const k = 1 + (FALL_FIX.k - 1) * t;
  const d2 = (DCAM - raw.pos[2]) / k;
  return {
    pos: [
      raw.pos[0] + (t * FALL_FIX.du * d2) / DCAM,
      raw.pos[1] - (t * FALL_FIX.dv * d2) / DCAM,
      DCAM - d2,
    ],
    quat: raw.quat,
  };
};

export const tealFade = (f: number) => 1 - clamp01((f - 71) / 7);
// Board right-extension reveal (screen 600→724 ≈ world +133): fraction 0→1.
export const boardExtend = (f: number) => clamp01((f - 103) / 21);
export const BOARD_EXT = 140;

// Wall grow (A): gridline top edge rises f116-126, ink fades in 116-148.
export const wallGrowTopY = (f: number) => {
  const t = easeOutPow(clamp01((f - WALL_GROW.start) / (WALL_GROW.end - WALL_GROW.start)), 2);
  const yFrom = unprojToWall(fitA, 427, WALL_GROW.topFrom)[1];
  return yFrom + (yTopA - yFrom) * t;
};
export const wallInkA = (f: number) => clamp01((f - WALL_GROW.start) / (148 - WALL_GROW.start));
