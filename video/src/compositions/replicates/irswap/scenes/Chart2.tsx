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
export const camChart2 = camFixed;

// ── whip motion blur (180° shutter over the corrected camera path) ──
export const whipSigma = (f: number): [number, number] => {
  if (f < 3884 || f > 3932) return [0, 0];
  const a = projT(WC3, camFixed(f - 1));
  const b = projT(WC3, camFixed(f + 1));
  const dx = (b[0] - a[0]) / 2;
  const dy = (b[1] - a[1]) / 2;
  const L = Math.hypot(dx, dy);
  if (L < 5) return [0, 0];
  const sig = (0.5 * L) / 3.46; // box streak L/2 → equivalent gaussian σ
  return [(sig * Math.abs(dx)) / L, (sig * Math.abs(dy)) / L];
};

// ── badges (unprojected at their pop frames with the solved camera) ──
const badgeWall = (
  frame: number,
  bbox: [number, number, number, number],
): { s: number; y: number; w: number; h: number } => {
  const cam = camFixed(frame);
  const a = unprojToWall(WALL, bbox[0], bbox[1], cam);
  const b = unprojToWall(WALL, bbox[2], bbox[3], cam);
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

const C = {
  gridA: "#EDEDED",
  gridB: "#F6F6F6",
  fixed: "#6B6B6D",
  curve: "#C62E2F",
  dash: "#76D1BE",
  guide: "#E0E0E0",
  hatchFill: "#D7E6E6",
  hatchLine: "#ADBCBC",
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
  // in over 3572-3584 (buildings' FloorMap fades out), out over 4133-4155
  // (the next scene's FloorPaper inks in).
  return (
    <CanvasPlane
      frame={0}
      width={FLOOR_WD}
      height={FLOOR_HT}
      res={1}
      position={[FLOOR_C[0], FLOOR_Y, FLOOR_C[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      draw={draw}
      renderOrder={0}
      opacity={fade(frame, 3572, 3584) * (1 - fade(frame, 4133, 4155))}
    />
  );
};

// ── the wall chart canvas ────────────────────────────────────────
const WallChart: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    const mS = (s: number) => s - S0;
    const mY = (y: number) => Y_TOP - y;
    const poly = (pts: Pt[]) => {
      ctx.beginPath();
      ctx.moveTo(mS(pts[0][0]), mY(pts[0][1]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(mS(pts[i][0]), mY(pts[i][1]));
    };
    // gridlines (draw-on 3572-3584, top→bottom wipe)
    const gT = fade(f, 3572, 3584);
    if (gT > 0) {
      for (let i = 0; i < GRID_S.length; i++) {
        ctx.strokeStyle = i % 2 === 0 ? C.gridA : C.gridB;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(mS(GRID_S[i]), mY(GRID_TOP_Y));
        ctx.lineTo(mS(GRID_S[i]), mY(GRID_TOP_Y - (GRID_TOP_Y - GRID_BOT_Y) * gT));
        ctx.stroke();
      }
      // skirting: wall/floor junction line at the grid base
      if (gT >= 1) {
        ctx.strokeStyle = "#E0E0DF";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(mS(GRID_S[0]) - 30, mY(GRID_BOT_Y));
        ctx.lineTo(mS(GRID_S[GRID_S.length - 1]) + 40, mY(GRID_BOT_Y));
        ctx.stroke();
      }
    }
    // hatched regions (region1 sweep 3806-3820; region2 3994-4006)
    const sweep = (polyPts: Pt[], sA: number, sB: number, t: number) => {
      if (t <= 0) return;
      ctx.save();
      const sEnd = sA + (sB - sA) * t;
      ctx.beginPath();
      ctx.rect(mS(sA) - 2, 0, mS(sEnd) - mS(sA) + 2, h);
      ctx.clip();
      poly(polyPts);
      ctx.closePath();
      ctx.fillStyle = C.hatchFill;
      ctx.fill();
      // diagonal hatch
      ctx.save();
      poly(polyPts);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = C.hatchLine;
      ctx.lineWidth = 1.1;
      for (let x = -h; x < w + h; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + h, 0);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    };
    sweep(REGION1, CURVE[0][0], S_CROSS, easeInOutCubic(fade(f, 3806, 3820)));
    sweep(REGION2, S_CROSS, CURVE[CURVE.length - 1][0], easeInOutCubic(fade(f, 3994, 4006)));
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
    typeIn("Fixed rate", [LBL_FIX[0] + 5, LBL_FIX[1] + 2], C.lblFix, 14, 3584, 3592);
    typeIn("Base rate", [LBL_BASE[0] + 5, LBL_BASE[1] + 2], C.lblBase, 14, 3584, 3590, 700);
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
            <WallChart frame={frame} />
          </group>
        </group>
      )}
    </>
  );
};

export const Chart2Overlay: React.FC<{ frame: number }> = ({ frame }) => <Legend frame={frame} />;


