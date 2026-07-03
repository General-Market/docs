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
} from "../data/buildings";
import type { TrackRow } from "../data/buildings";
import { CAM_KEYS_3D } from "../data/buildings3d";
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
export const camBld = (f: number): { cam: V3; g: number } => ({
  cam: [lerp1(camCx, f), lerp1(camCy, f), lerp1(camCz, f)],
  g: lerp1(camG, f),
});

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
};
// the plaques drop in WITH their buildings (ref f1706-1760 / f2274+)
const PLAQUES: PlaqueDef[] = [
  { key: "plq-lender", text: "LENDER", def: plaqueWorld([258, 385, 360, 435], zL), appear: [1733, 1755], drop: 24, tilt: -0.16 },
  { key: "plq-company", text: "COMPANY", def: plaqueWorld([356, 358, 464, 390], zC), appear: [1706, 1730], drop: 26, tilt: -0.07 },
  // bank board is tall — its top edge overlaps the building base (ref)
  { key: "plq-bank", text: "BANK", def: plaqueWorld([525, 380, 663, 424], zB), appear: [2274, 2312], drop: 18, tilt: -0.05 },
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
      {/* fades out over 3572-3581 while chart2's FloorSet fades in underneath
          (ref dissolves fast — ending later leaves a ghost sliver crossing
          the successor floor through ~3586) */}
      <CanvasPlane frame={frame} width={FLOOR_WB} height={FLOOR_HB} res={1}
        position={[0, 0, 0]} rotation={[0, 0, 0]} draw={draw} renderOrder={0}
        opacity={fadeOut(frame, 3572, 3581)} />
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
      {(Object.keys(BLD_APPEAR) as (keyof typeof BLD_APPEAR)[]).map((name) => {
        const b = BLD_APPEAR[name];
        const t = fade(frame, b.appear[0], b.appear[1]);
        return (
          <Building3D key={name} name={name} g={g}
            opacity={t * (1 - endFade)} drop={b.drop * (1 - t)} renderOrder={2} />
        );
      })}
      {PLAQUES.map((s) => {
          const op = fade(frame, s.appear[0], s.appear[1]) * (1 - endFade);
          if (op <= 0) return null;
          const dropT = 1 - fade(frame, s.appear[0], s.appear[1]);
          const c = rotP(s.def.center, g);
          const board = drawPlaque(s.text, s.tilt);
          return (
            <CanvasPlane key={s.key} frame={frame}
              width={s.def.w} height={s.def.h} res={3}
              position={[c[0], c[1] + s.drop * dropT, c[2]]}
              draw={(ctx, f, w, h) => {
                ctx.globalAlpha = op;
                board(ctx, f, w, h);
              }}
              renderOrder={5} depthTest={false} />
          );
        })}
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
  const fixOp = fade(frame, 2345, 2355) * ghost(frame) * fadeOut(frame, 3421, 3427);
  const fixArrowOp = fade(frame, 2361, 2363) * ghost(frame) * fadeOut(frame, 3427, 3438);

  // red arrow: tip-first wipe 2490-2525 with an alpha ramp (ref head is
  // ~20% alpha mid-wipe), world-static after
  const redOp = fade(frame, 2495, 2512) *
    (frame < 3086 ? 1 : frame < 3195 ? Math.max(0.3, fadeOut(frame, 3095, 3115)) : Math.min(1, 0.3 + fade(frame, 3195, 3240) * 0.7));
  const dVbrOp = fade(frame, 3195, 3240) * fadeOut(frame, 3421, 3427);
  const ncOp = fade(frame, 3443, 3450) * fadeOut(frame, 3520, 3540);
  const ncArrowOp = frame >= 2495 ? Math.max(redOp * fadeOut(frame, 3421, 3427), fade(frame, 3427, 3438) * fadeOut(frame, 3520, 3545)) : 0;

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

  // red arrow blend 3427-3438 phase-D pose → net-cash pose
  const redSlide = fade(frame, 3427, 3438);

  return (
    <AbsoluteFill style={{ opacity: 1 - endFade }}>
      <Panel frame={frame} />
      {/* Phase D tight two-shot; red arrow slides down 3427-3438 into the
          net-cash pose measured at 3450 */}
      <Arrow
        tail={mixPt(rDA(ANCHOR_3300.redArrow.tail), rE(ANCHOR_3450.redArrow.tail), redSlide)}
        tip={mixPt(rDA(ANCHOR_3300.redArrow.tip), rE(ANCHOR_3450.redArrow.tip), redSlide)}
        color={BCOLORS.red} thickness={18} headLen={25} headH={32}
        opacity={frame >= 3195 ? ncArrowOp : 0} />
      <Arrow tail={rDA(ANCHOR_3300.tealArrow.tail)} tip={rDA(ANCHOR_3300.tealArrow.tip)}
        color={BCOLORS.teal} thickness={18} headLen={26} headH={33}
        opacity={frame >= 3180 ? fixArrowOp : 0} />
      <Txt p={rDA(ANCHOR_3300.vbrTitle)} size={27} opacity={dVbrOp}>Variable Base Rate</Txt>
      <RateValue p={rDA(ANCHOR_3300.vbrValue)} size={37} opacity={dVbrOp} value="5.0" />
      <Txt p={rDA(ANCHOR_3300.fixedTitle)} size={25} opacity={frame >= 3180 ? fixOp : 0}>Fixed Rate</Txt>
      <RateValue p={rDA(ANCHOR_3300.fixedValue)} size={32} opacity={frame >= 3180 ? fixOp : 0} value="3.0" />
      {/* Net Cash Settlement */}
      <Txt p={rE(ANCHOR_3450.l1)} size={24} opacity={ncOp}>Net Cash</Txt>
      <Txt p={rE(ANCHOR_3450.l2)} size={24} opacity={ncOp}>Settlement</Txt>
      <RateValue p={rE(ANCHOR_3450.l3)} size={30} opacity={ncOp} value="2.0" />
    </AbsoluteFill>
  );
};


