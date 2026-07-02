// Frames 1705-3587: the buildings map — LENDER / COMPANY / BANK on a
// hand-drawn city plan, orbiting camera, rate arrows and ticking labels.
// 3D: building sprites + floor in a ThreeCanvas with a fitted
// translation+world-yaw camera solved from the measured apex tracks.
// Labels/arrows/panel are screen-space overlays anchored to the tracks.

import React, { useCallback, useEffect, useState } from "react";
import {
  AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame,
} from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import * as THREE from "three";
import {
  P1, P2, P3, TICKS_A, TICKS_C, BCOLORS,
  ANCHOR_1900, ANCHOR_2500, ANCHOR_2700, ANCHOR_3300, ANCHOR_3450,
} from "../data/buildings";
import type { TrackRow } from "../data/buildings";
import { clamp01, lerp1, lerpTrack } from "../lib/helpers";
import type { Pt } from "../lib/helpers";
import {
  CameraRig, CanvasPlane, Room, Vignette, DCAM, project, unprojToFloor,
} from "../lib/world";
import type { V3 } from "../lib/world";

const { fontFamily: FONT, waitUntilDone } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});

const F0 = 1705; // sequence offset: local frame = global - F0 handled by caller

// ── world model ──────────────────────────────────────────────────
// Anchor frame 2500 = identity camera, yaw 0. Depths from floor contact.
const FLOOR_Y = -170;
// apex world positions (unprojected at anchor onto per-building depth)
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
const W1: V3 = unprojAtZ(364, 284, zC); // P1@2505
const W2: V3 = unprojAtZ(212, 304, zL); // P2@2505
const W3: V3 = unprojAtZ(610, 294, zB); // P3@2505
const PIVOT: V3 = [W2[0], 0, W2[2]]; // orbit pivot near LENDER

// rotate a point about the vertical pivot axis by yaw g
const rotP = (p: V3, g: number): V3 => {
  const c = Math.cos(g);
  const s = Math.sin(g);
  const dx = p[0] - PIVOT[0];
  const dz = p[2] - PIVOT[2];
  return [PIVOT[0] + c * dx + s * dz, p[1], PIVOT[2] - s * dx + c * dz];
};
const projectWith = (p: V3, cam: V3, g: number): Pt => project(rotP(p, g), cam);

// Solve camera (cx,cy,cz) + world yaw g per keyframe from tracked pts.
type CamKey = { f: number; cam: V3; g: number };
const solveKeys = (): CamKey[] => {
  const frames = P1.map((r) => r[0]);
  const keys: CamKey[] = [];
  let prev: { cam: V3; g: number } = { cam: [0, 0, DCAM], g: 0 };
  for (const f of frames) {
    const obs: { w: V3; s: Pt }[] = [{ w: W1, s: lerpTrack(P1, f) }];
    if (f >= 1755 && f <= 3135) obs.push({ w: W2, s: lerpTrack(P2, f) });
    if (f >= 2295) obs.push({ w: W3, s: lerpTrack(P3, f) });
    // yaw is solvable from ≥2 points; a soft prior toward the previous key
    // keeps the under-constrained stretches (2-point phases) from blowing up.
    const freeYaw = obs.length >= 2;
    const PRIOR = 0.08;
    // Gauss-Newton, 8 iterations
    let cam: V3 = [...prev.cam] as V3;
    let g = prev.g;
    for (let it = 0; it < 8; it++) {
      // residuals + numeric jacobian
      const nP = freeYaw ? 4 : 3;
      const J: number[][] = [];
      const r: number[] = [];
      const eps = [0.5, 0.5, 0.5, 0.002];
      for (const o of obs) {
        const p0 = projectWith(o.w, cam, g);
        r.push(o.s[0] - p0[0], o.s[1] - p0[1]);
        const rows: number[][] = [[], []];
        for (let k = 0; k < nP; k++) {
          const c2: V3 = [...cam] as V3;
          let g2 = g;
          if (k < 3) c2[k] += eps[k];
          else g2 += eps[3];
          const p1 = projectWith(o.w, c2, g2);
          rows[0].push((p1[0] - p0[0]) / eps[k]);
          rows[1].push((p1[1] - p0[1]) / eps[k]);
        }
        J.push(rows[0], rows[1]);
      }
      // prior residuals toward previous key
      {
        const pv = [prev.cam[0], prev.cam[1], prev.cam[2], prev.g];
        const cur = [cam[0], cam[1], cam[2], g];
        const scale = [PRIOR, PRIOR, PRIOR, PRIOR * 250];
        for (let k = 0; k < nP; k++) {
          const row = new Array(nP).fill(0);
          row[k] = scale[k];
          J.push(row);
          r.push(scale[k] * (pv[k] - cur[k]));
        }
      }
      // normal equations (nP x nP)
      const A: number[][] = Array.from({ length: nP }, () => new Array(nP).fill(0));
      const b: number[] = new Array(nP).fill(0);
      for (let i = 0; i < J.length; i++) {
        for (let a = 0; a < nP; a++) {
          b[a] += J[i][a] * r[i];
          for (let c = 0; c < nP; c++) A[a][c] += J[i][a] * J[i][c];
        }
      }
      for (let a = 0; a < nP; a++) A[a][a] += 1e-6;
      // gaussian elimination
      for (let col = 0; col < nP; col++) {
        let piv = col;
        for (let rr = col + 1; rr < nP; rr++) if (Math.abs(A[rr][col]) > Math.abs(A[piv][col])) piv = rr;
        [A[col], A[piv]] = [A[piv], A[col]];
        [b[col], b[piv]] = [b[piv], b[col]];
        for (let rr = col + 1; rr < nP; rr++) {
          const fmul = A[rr][col] / A[col][col];
          for (let cc = col; cc < nP; cc++) A[rr][cc] -= fmul * A[col][cc];
          b[rr] -= fmul * b[col];
        }
      }
      const dx = new Array(nP).fill(0);
      for (let rr = nP - 1; rr >= 0; rr--) {
        let s = b[rr];
        for (let cc = rr + 1; cc < nP; cc++) s -= A[rr][cc] * dx[cc];
        dx[rr] = s / A[rr][rr];
      }
      cam = [cam[0] + dx[0], cam[1] + dx[1], cam[2] + dx[2]];
      if (freeYaw) g += dx[3];
    }
    keys.push({ f, cam, g });
    prev = { cam, g };
  }
  return keys;
};
const CAM_KEYS = solveKeys();
const camCx: [number, number][] = CAM_KEYS.map((k) => [k.f, k.cam[0]]);
const camCy: [number, number][] = CAM_KEYS.map((k) => [k.f, k.cam[1]]);
const camCz: [number, number][] = CAM_KEYS.map((k) => [k.f, k.cam[2]]);
const camG: [number, number][] = CAM_KEYS.map((k) => [k.f, k.g]);
export const camBld = (f: number): { cam: V3; g: number } => ({
  cam: [lerp1(camCx, f), lerp1(camCy, f), lerp1(camCz, f)],
  g: lerp1(camG, f),
});

// ── sprites ──────────────────────────────────────────────────────
// world size fitted so the crop projects at its source-frame bbox.
type SpriteDef = {
  src: string;
  srcFrame: number;
  bbox: [number, number, number, number]; // x0,y0,x1,y1 in source frame
  baseW: V3; // world anchor (bottom-center) — from apex world + offsets
  z: number;
  appear: [number, number]; // fade in range
  drop?: number; // px drop during fade
};
const spriteWorld = (
  def: Omit<SpriteDef, "baseW">,
): { w: number; h: number; center: V3 } => {
  const { cam, g } = camBld(def.srcFrame);
  // invert: find world plane at depth z (after yaw) — approximate by
  // unprojecting bbox corners onto the un-yawed depth plane then un-rotating.
  const [x0, y0, x1, y1] = def.bbox;
  const d = cam[2] - rotP([0, 0, def.z], g)[2]; // approx depth at that frame
  const w = ((x1 - x0) * d) / DCAM;
  const h = ((y1 - y0) * d) / DCAM;
  // world center: unproject bbox center at that depth with that camera, un-yaw
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const pC: V3 = [
    cam[0] + (((cx - 427) * d) / DCAM),
    cam[1] + (((240 - cy) * d) / DCAM),
    cam[2] - d,
  ];
  const un = rotP(pC, -g);
  return { w, h, center: un };
};

const SPRITES: { key: string; src: string; def: ReturnType<typeof spriteWorld>; appear: [number, number]; drop: number; order: number }[] = (() => {
  const mk = (
    key: string, src: string, srcFrame: number,
    bbox: [number, number, number, number], z: number,
    appear: [number, number], drop = 0, order = 2,
  ) => ({ key, src, def: spriteWorld({ src, srcFrame, bbox, z, appear }), appear, drop, order });
  // all bboxes measured at ref frame 2505 (identity camera, yaw≈0) — the
  // only pose where worldization is exact.
  return [
    mk("company", "irswap-assets/company-house.png", 2505, [334, 282, 415, 390], zC, [1706, 1730], 26, 3),
    mk("lender", "irswap-assets/lender-building.png", 2505, [160, 295, 305, 425], zL, [1733, 1755], 24, 4),
    mk("bank", "irswap-assets/bank-building.png", 2505, [545, 290, 670, 390], zB, [2274, 2312], 18, 3),
    mk("plq-lender", "irswap-assets/plaque-lender.png", 2505, [258, 385, 360, 435], zL, [1753, 1790], 0, 5),
    mk("plq-company", "irswap-assets/plaque-company.png", 2505, [356, 358, 464, 390], zC, [1753, 1790], 0, 5),
    mk("plq-bank", "irswap-assets/plaque-bank.png", 2505, [525, 390, 663, 420], zB, [2288, 2305], 0, 5),
  ];
})();

const useTextures = (paths: string[]) => {
  const [tex, setTex] = useState<Record<string, THREE.Texture> | null>(null);
  const [handle] = useState(() => delayRender("bld-tex"));
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    Promise.all(
      paths.map(
        (p) =>
          new Promise<[string, THREE.Texture]>((res) => {
            loader.load(
              staticFile(p),
              (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                res([p, t]);
              },
              undefined,
              () => res([p, new THREE.Texture()]),
            );
          }),
      ),
    ).then((entries) => {
      Promise.resolve(waitUntilDone()).then(() => {
        setTex(Object.fromEntries(entries));
        continueRender(handle);
      });
    });
  }, [handle]);
  return tex;
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

const FloorMap: React.FC<{ frame: number; g: number }> = ({ frame, g }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    const a = clamp01((f - 1707) / 50);
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
    // yellow road (2505, exact): one polygon through the visible segments
    poly(
      m2505([[306, 368], [321, 366], [430, 354], [464, 358], [543, 369],
        [526, 375], [464, 367], [333, 378], [307, 389]]),
      BCOLORS.road, "#DDDCB0", 1,
    );
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
      <CanvasPlane frame={frame} width={FLOOR_WB} height={FLOOR_HB} res={1}
        position={[0, 0, 0]} rotation={[0, 0, 0]} draw={draw} renderOrder={0} />
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

// Phase B→C right label + red arrow: measured screen keyframes (ref 2500,
// 2700, 3000); after 3000 the element rides the BANK apex track delta.
const C_RX: [number, number][] = [[2509, 534], [2585, 534], [2660, 483], [2700, 487], [3000, 518]];
const C_RTY: [number, number][] = [[2509, 188], [2585, 188], [2660, 139], [2700, 139], [3000, 138]];
const C_ATAILX: [number, number][] = [[2660, 536], [2700, 544], [3000, 583]];
const C_ATIPX: [number, number][] = [[2660, 436], [2700, 433], [3000, 457]];
const C_AY: [number, number][] = [[2660, 206], [2700, 207], [3000, 215]];
const p3Delta = (f: number): Pt => {
  if (f <= 3000) return [0, 0];
  const a = lerpTrack(P3, 3000);
  const b = lerpTrack(P3, f);
  return [b[0] - a[0], b[1] - a[1]];
};

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
    <span style={{ fontSize: size * 0.78, fontWeight: 400 }}>{" "}%</span>
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
      <div style={{ background: "linear-gradient(#DDDDDD,#C8C8C8)", color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "center", padding: "3px 0" }}>
        Total Borrowing
      </div>
      <div style={{ background: BCOLORS.panelBody, display: "flex", justifyContent: "center", padding: "11px 0" }}>
        <div style={{ width: 55, height: 51, background: "#FFFFFF", borderRadius: 8, border: "1.5px solid #9FB4B6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={34} height={32} viewBox="0 0 34 32">
            <path d="M17 2 L32 14 L28 14 L28 30 L6 30 L6 14 L2 14 Z" fill="none" stroke={BCOLORS.panelIcon} strokeWidth={2.4} strokeLinejoin="round" />
            <rect x={14} y={21} width={6} height={9} fill="none" stroke={BCOLORS.panelIcon} strokeWidth={2} />
          </svg>
        </div>
      </div>
      <div style={{ background: BCOLORS.panelStrip, textAlign: "center", padding: "4px 0", fontSize: 19, fontWeight: 600, color: "#6B6B6B" }}>
        {val}
        <span style={{ fontSize: 13, fontWeight: 400 }}> %</span>
      </div>
      {glare > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,${glare}) 50%, transparent 70%)` }} />
      )}
    </div>
  );
};

// ── main scene ───────────────────────────────────────────────────
export const Buildings: React.FC = () => {
  const local = useCurrentFrame();
  const frame = local + F0;
  const tex = useTextures(SPRITES.map((s) => s.src));
  const { cam, g } = camBld(frame);

  // overall scene fade at the end (ref: colors still full at 3550,
  // fully white by ~3572)
  const endFade = fade(frame, 3548, 3572);

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

  const fixOp = fade(frame, 2345, 2355) *
    (frame < 2585 ? 1 : frame < 3085 ? Math.max(0.25, fadeOut(frame, 2585, 2615)) : Math.min(1, 0.25 + fade(frame, 3085, 3120) * 0.75)) *
    fadeOut(frame, 3421, 3427);
  const fixArrowOp = fade(frame, 2361, 2363) *
    (frame < 2585 ? 1 : frame < 3085 ? Math.max(0.25, fadeOut(frame, 2585, 2615)) : Math.min(1, 0.25 + fade(frame, 3085, 3120) * 0.75)) *
    fadeOut(frame, 3427, 3438);
  const fixProg = frame < 2361 ? 0 : Math.min(1, lerp1([[2361, 0.5], [2365, 0.75], [2369, 0.97], [2370, 1]], frame));

  const redOp = fade(frame, 2496, 2512) *
    (frame < 3086 ? 1 : frame < 3195 ? Math.max(0.3, fadeOut(frame, 3095, 3115)) : Math.min(1, 0.3 + fade(frame, 3195, 3240) * 0.7));
  const redProg = frame < 2513 ? 0.12 : Math.min(1, lerp1([[2513, 0.28], [2517, 0.62], [2521, 0.86], [2524, 1]], frame));
  const rightLblOp = fade(frame, 2509, 2518) * fadeOut(frame, 3086, 3100);
  const leftArrOp = fade(frame, 2622, 2632) * fadeOut(frame, 3096, 3110);
  const leftLblOp = fade(frame, 2627, 2640) * (frame < 3086 ? 1 : fadeOut(frame, 3086, 3100));
  const dVbrOp = fade(frame, 3195, 3240) * fadeOut(frame, 3421, 3427);
  const ncOp = fade(frame, 3443, 3450) * fadeOut(frame, 3520, 3540);
  const ncArrowOp = fade(frame, 2496, 2512) === 1 ? Math.max(redOp * fadeOut(frame, 3421, 3427), fade(frame, 3427, 3438) * fadeOut(frame, 3520, 3545)) : 0;

  const vbrVal = tickValue(frame, TICKS_A, "0.5");
  const cVal = tickValue(frame, TICKS_C, "0.5");

  // track-riding anchor helpers
  const rA = (base: readonly [number, number]): Pt => riding(frame, 1900, base, P1);
  const rB = (base: readonly [number, number]): Pt => riding(frame, 2500, base, P1);
  const rC = (base: readonly [number, number]): Pt => riding(frame, 2700, base, P1);
  const rD = (base: readonly [number, number]): Pt => riding(frame, 3300, base, P1);
  const rE = (base: readonly [number, number]): Pt => riding(frame, 3450, base, P1);

  // red arrow blend 3427-3438 phase-D pose → net-cash pose
  const redSlide = fade(frame, 3427, 3438);

  return (
    <AbsoluteFill>
      <Vignette soft />
      <Room>
        <CameraRig position={cam} />
        <FloorMap frame={frame} g={g} />
        {tex &&
          SPRITES.map((s) => {
            const op = fade(frame, s.appear[0], s.appear[1]) * (1 - endFade);
            if (op <= 0) return null;
            const dropT = 1 - fade(frame, s.appear[0], s.appear[1]);
            const c = rotP(s.def.center, g);
            const t = tex[s.src];
            return (
              <group key={s.key} position={[c[0], c[1] + s.drop * dropT, c[2]]} renderOrder={s.order}>
                <mesh renderOrder={s.order}>
                  <planeGeometry args={[s.def.w, s.def.h]} />
                  <meshBasicMaterial map={t} transparent opacity={op} depthWrite={false} toneMapped={false} />
                </mesh>
              </group>
            );
          })}
      </Room>
      {/* overlays */}
      <AbsoluteFill style={{ opacity: 1 - endFade }}>
        {/* Phase A */}
        <Arrow tail={rA(ANCHOR_1900.arrowA.tail)} tip={rA(ANCHOR_1900.arrowA.tip)}
          color={BCOLORS.teal} thickness={14} headLen={20} headH={27}
          opacity={arrA} progress={progA} />
        <Txt p={rA(ANCHOR_1900.vbrTitle)} size={24} opacity={lblA}>Variable Base Rate</Txt>
        <RateValue p={rA(ANCHOR_1900.vbrValue)} size={30} opacity={lblA} value={vbrVal} />
        <Txt p={rA(ANCHOR_1900.lmTitle)} size={21} opacity={lmA}>Lending margin</Txt>
        <RateValue p={rA(ANCHOR_1900.lmValue)} size={27} opacity={lmA} value="2.0" />
        <Panel frame={frame} />
        {/* Phase B */}
        <Arrow tail={rB(ANCHOR_2500.fixedArrow.tail)} tip={rB(ANCHOR_2500.fixedArrow.tip)}
          color={BCOLORS.teal} thickness={13} headLen={20} headH={26}
          opacity={frame < 3080 ? fixArrowOp : 0} progress={fixProg} />
        <Txt p={rB(ANCHOR_2500.fixedTitle)} size={22} opacity={frame < 3080 ? fixOp : 0}>Fixed Rate</Txt>
        <RateValue p={rB(ANCHOR_2500.fixedValue)} size={26} opacity={frame < 3080 ? fixOp : 0} value="3.0" />
        <Arrow tail={rB(ANCHOR_2500.redArrow.tail)} tip={rB(ANCHOR_2500.redArrow.tip)}
          color={BCOLORS.red} thickness={14} headLen={16} headH={24}
          opacity={frame < 2660 ? redOp : 0} progress={redProg} />
        {(() => {
          const d = p3Delta(frame);
          const x = lerp1(C_RX, frame) + d[0];
          const yT = lerp1(C_RTY, frame) + d[1];
          return (
            <>
              <Txt p={[x, yT]} size={20} opacity={rightLblOp}>Variable Base Rate</Txt>
              <RateValue p={[x, yT + 31]} size={24} opacity={rightLblOp} value={cVal} />
            </>
          );
        })()}
        {/* Phase C */}
        <Arrow tail={rC(ANCHOR_2700.leftArrow.tail)} tip={rC(ANCHOR_2700.leftArrow.tip)}
          color={BCOLORS.teal} thickness={14} headLen={16} headH={28}
          opacity={leftArrOp} />
        <Arrow
          tail={[lerp1(C_ATAILX, frame) + p3Delta(frame)[0], lerp1(C_AY, frame) + p3Delta(frame)[1]]}
          tip={[lerp1(C_ATIPX, frame) + p3Delta(frame)[0], lerp1(C_AY, frame) + p3Delta(frame)[1]]}
          color={BCOLORS.red} thickness={14} headLen={16} headH={24}
          opacity={frame >= 2660 && frame < 3195 ? redOp : 0} />
        <Txt p={ANCHOR_2700.leftTitle as unknown as Pt} size={15} opacity={leftLblOp} rotate={-10}>Variable Base Rate</Txt>
        <RateValue p={ANCHOR_2700.leftValue as unknown as Pt} size={20} opacity={leftLblOp} value={cVal} />
        {/* Phase D tight two-shot; red arrow slides down 3427-3438 into the
            net-cash pose measured at 3450 */}
        <Arrow
          tail={mixPt(rD(ANCHOR_3300.redArrow.tail), rE(ANCHOR_3450.redArrow.tail), redSlide)}
          tip={mixPt(rD(ANCHOR_3300.redArrow.tip), rE(ANCHOR_3450.redArrow.tip), redSlide)}
          color={BCOLORS.red} thickness={18} headLen={25} headH={32}
          opacity={frame >= 3195 ? ncArrowOp : 0} />
        <Arrow tail={rD(ANCHOR_3300.tealArrow.tail)} tip={rD(ANCHOR_3300.tealArrow.tip)}
          color={BCOLORS.teal} thickness={18} headLen={26} headH={33}
          opacity={frame >= 3080 ? fixArrowOp : 0} />
        <Txt p={rD(ANCHOR_3300.vbrTitle)} size={27} opacity={dVbrOp}>Variable Base Rate</Txt>
        <RateValue p={rD(ANCHOR_3300.vbrValue)} size={34} opacity={dVbrOp} value="5.0" />
        <Txt p={rD(ANCHOR_3300.fixedTitle)} size={25} opacity={frame >= 3080 ? fixOp : 0}>Fixed Rate</Txt>
        <RateValue p={rD(ANCHOR_3300.fixedValue)} size={30} opacity={frame >= 3080 ? fixOp : 0} value="3.0" />
        {/* Net Cash Settlement */}
        <Txt p={rE(ANCHOR_3450.l1)} size={24} opacity={ncOp}>Net Cash</Txt>
        <Txt p={rE(ANCHOR_3450.l2)} size={24} opacity={ncOp}>Settlement</Txt>
        <RateValue p={rE(ANCHOR_3450.l3)} size={30} opacity={ncOp} value="2.0" />
      </AbsoluteFill>
      {/* floor persists into the chart2 room — only sprites/overlays fade */}
    </AbsoluteFill>
  );
};
