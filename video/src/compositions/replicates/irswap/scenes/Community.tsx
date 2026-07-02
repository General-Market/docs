// Frames 4690-5290: the community map (S13-S14). Big blue house and red
// bank drop onto a floor map sheet, yellow rays fan to a community of
// small buildings, exchange arrows grow, a glass wireframe cube drops
// over the scene, the camera dives from overhead to eye level, the
// arrows break at the zigzag seam, then the camera pulls back out.
// 3D: pitched translation camera solved per frame from the tracked bank
// (position + width→depth) under an authored pitch profile; icons are
// camera-facing billboards keyframed to their measured screen tracks;
// the sheet lives on the floor plane; the cube is real line geometry.

import React, { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { clamp01, easeOutPow, lerp1 } from "../lib/helpers";
import type { Pt } from "../lib/helpers";
import { CameraRig, CanvasPlane, Room, Vignette, DCAM } from "../lib/world";
import type { V3 } from "../lib/world";

const F0 = 4690;
const FLOOR_Y = -170;
const fade = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1, b - a));
const fadeOut = (f: number, a: number, b: number) => 1 - fade(f, a, b);

const C = {
  blue: "#4CB3CB",
  blueDark: "#2E7C90",
  red: "#E56575",
  redDark: "#8E3644",
  ray: "#FCFC99",
  sheet: "#ECECEC",
  chartRed: "#D98A95",
  teal: "#D0EBEE",
  door: "#DAF5F9",
  cube: "#CFCFCF",
} as const;

// ── camera ───────────────────────────────────────────────────────
// pitch profile (degrees, camera looks down by this much)
const PITCH: [number, number][] = [
  [4685, 20], [4700, 22], [4722, 26], [4885, 26], [4975, 8], [5210, 8], [5240, 18], [5271, 24],
];
const pitchAt = (f: number) => (lerp1(PITCH, f) * Math.PI) / 180;

// bank apex track [f,u,v] + width proxy [f,W]
const T_B: [number, number, number][] = [
  [4715, 604, 194], [4730, 602, 222], [4745, 608, 222], [4760, 613, 222], [4775, 619, 220],
  [4790, 625, 220], [4805, 631, 220], [4820, 638, 220], [4835, 645, 218], [4850, 652, 218],
  [4865, 660, 216], [4880, 665, 216], [4895, 677, 214], [4910, 683, 210], [4925, 679, 198],
  [4940, 660, 206], [4955, 633, 170], [4970, 609, 174], [4985, 608, 170], [5000, 609, 170],
  [5030, 612, 170], [5060, 613, 168], [5090, 615, 168], [5120, 618, 168], [5150, 620, 166],
  [5180, 623, 166], [5195, 624, 164], [5210, 623, 166], [5225, 588, 186], [5240, 569, 212],
  [5255, 549, 232], [5265, 534, 226],
];
const T_BW: [number, number][] = [
  [4715, 88], [4730, 92], [4745, 96], [4760, 98], [4775, 102], [4790, 102], [4805, 106],
  [4820, 108], [4835, 110], [4850, 112], [4865, 116], [4880, 114], [4895, 122], [4910, 130],
  [4925, 142], [4940, 156], [4955, 170], [4970, 182], [4985, 184], [5000, 186], [5030, 188],
  [5060, 190], [5090, 190], [5120, 192], [5150, 196], [5180, 198], [5195, 200], [5210, 194],
  [5225, 132], [5240, 86], [5255, 63], [5265, 55],
];
const BANK_WORLD_W = 102; // world units (width at d=DCAM)
const P_BANK: V3 = [192, 20, 0];

// rotate about x: Rx(a)·p
const rx = (a: number, p: V3): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
};

// camera position for frame f (closed form from the bank observation)
const camCommunity = (f: number): { cam: V3; pitch: number; d: number } => {
  const fc = Math.max(4715, Math.min(5265, f));
  const th = pitchAt(f);
  const u = lerp1(T_B.map((r) => [r[0], r[1]] as [number, number]), fc);
  const v = lerp1(T_B.map((r) => [r[0], r[2]] as [number, number]), fc);
  const W = lerp1(T_BW, fc);
  const d = (DCAM * BANK_WORLD_W) / W;
  const q: V3 = [(d * (u - 427)) / DCAM, (d * (240 - v)) / DCAM, -d];
  const off = rx(-th, q);
  return { cam: [P_BANK[0] - off[0], P_BANK[1] - off[1], P_BANK[2] - off[2]], pitch: th, d };
};

// world point projecting to screen (u,v) at the bank's axial depth
const atDepth = (u: number, v: number, f: number): V3 => {
  const { cam, pitch, d } = camCommunity(f);
  const q: V3 = [(d * (u - 427)) / DCAM, (d * (240 - v)) / DCAM, -d];
  const off = rx(-pitch, q);
  return [cam[0] + off[0], cam[1] + off[1], cam[2] + off[2]];
};

// unproject screen point onto the floor plane through the frame-f camera
const toFloor = (u: number, v: number, f: number): Pt => {
  const { cam, pitch } = camCommunity(f);
  const dir = rx(-pitch, [(u - 427) / DCAM, (240 - v) / DCAM, -1]);
  const t = (FLOOR_Y - cam[1]) / dir[1];
  return [cam[0] + dir[0] * t, cam[2] + dir[2] * t];
};

// world width per screen px at bank depth
const pxToWorld = (f: number) => camCommunity(f).d / DCAM;

// ── billboard helper ─────────────────────────────────────────────
const Billboard: React.FC<{
  frame: number;
  cx: number; // screen x of art center
  topY: number; // screen y of art top
  wPx: number; // screen width
  aspect: number; // h/w
  opacity: number;
  draw: (ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => void;
  res?: number;
  order?: number;
}> = ({ frame, cx, topY, wPx, aspect, opacity, draw, res = 2, order = 2 }) => {
  if (opacity <= 0) return null;
  const s = pxToWorld(frame);
  const w = wPx * s;
  const h = w * aspect;
  const pos = atDepth(cx, topY + (wPx * aspect) / 2, frame);
  const { pitch } = camCommunity(frame);
  const wrapped = (ctx: CanvasRenderingContext2D, f: number, cw: number, ch: number) => {
    ctx.globalAlpha = opacity;
    draw(ctx, f, cw, ch);
    ctx.globalAlpha = 1;
  };
  return (
    <group position={pos} rotation={[-pitch, 0, 0]}>
      <CanvasPlane frame={frame} width={w} height={h} res={res / s}
        position={[0, 0, 0]} draw={wrapped} renderOrder={order} />
    </group>
  );
};

// ── icon artwork (unit canvas, w×h passed in world units) ────────
const drawHouse = (annexAlpha: number) =>
  (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
    // full art 171x168: annex 66 wide left, main house 105 right
    const sx = w / 171;
    const sy = h / 168;
    ctx.lineWidth = 2.4 * sx;
    ctx.lineJoin = "round";
    // main house (right)
    ctx.fillStyle = C.blue;
    ctx.strokeStyle = C.blueDark;
    ctx.beginPath();
    ctx.moveTo(66 * sx, 62 * sy);
    ctx.lineTo(118 * sx, 0 * sy + 2);
    ctx.lineTo(171 * sx - 2, 62 * sy);
    ctx.lineTo(164 * sx, 62 * sy);
    ctx.lineTo(164 * sx, 168 * sy - 2);
    ctx.lineTo(73 * sx, 168 * sy - 2);
    ctx.lineTo(73 * sx, 62 * sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // door
    ctx.fillStyle = C.door;
    ctx.fillRect(104 * sx, 122 * sy, 28 * sx, 46 * sy);
    ctx.strokeRect(104 * sx, 122 * sy, 28 * sx, 46 * sy);
    if (annexAlpha > 0) {
      ctx.globalAlpha *= annexAlpha;
      // annex/garage (left, flat roof)
      ctx.fillStyle = C.blue;
      ctx.beginPath();
      ctx.moveTo(2, 46 * sy);
      ctx.lineTo(73 * sx, 40 * sy);
      ctx.lineTo(73 * sx, 168 * sy - 2);
      ctx.lineTo(2, 168 * sy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.door;
      ctx.fillRect(18 * sx, 96 * sy, 34 * sx, 72 * sy);
      ctx.strokeRect(18 * sx, 96 * sy, 34 * sx, 72 * sy);
    }
  };

const drawBank = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  // art 200x176: pediment, 5 columns, base band
  const sx = w / 200;
  const sy = h / 176;
  ctx.lineWidth = 2.4 * sx;
  ctx.lineJoin = "round";
  ctx.fillStyle = C.red;
  ctx.strokeStyle = C.redDark;
  // pediment
  ctx.beginPath();
  ctx.moveTo(4 * sx, 58 * sy);
  ctx.lineTo(100 * sx, 2);
  ctx.lineTo(196 * sx, 58 * sy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // body
  ctx.fillRect(14 * sx, 58 * sy, 172 * sx, 84 * sy);
  ctx.strokeRect(14 * sx, 58 * sy, 172 * sx, 84 * sy);
  // columns
  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < 5; i++) {
    const x = (30 + i * 31) * sx;
    ctx.fillRect(x, 64 * sy, 14 * sx, 68 * sy);
  }
  // base band
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(10 * sx, 142 * sy, 180 * sx, 24 * sy);
  ctx.strokeRect(10 * sx, 142 * sy, 180 * sx, 24 * sy);
};

const drawCubes = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  const sx = w / 52;
  const sy = h / 80;
  ctx.lineWidth = 2 * sx;
  ctx.fillStyle = C.blue;
  ctx.strokeStyle = C.blueDark;
  ctx.fillRect(4 * sx, 42 * sy, 44 * sx, 36 * sy);
  ctx.strokeRect(4 * sx, 42 * sy, 44 * sx, 36 * sy);
  ctx.fillRect(9 * sx, 4 * sy, 34 * sx, 36 * sy);
  ctx.strokeRect(9 * sx, 4 * sy, 34 * sx, 36 * sy);
};

const drawGabled = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  const sx = w / 60;
  const sy = h / 60;
  ctx.lineWidth = 2 * sx;
  ctx.fillStyle = C.blue;
  ctx.strokeStyle = C.blueDark;
  ctx.beginPath();
  ctx.moveTo(2, 26 * sy);
  ctx.lineTo(30 * sx, 2);
  ctx.lineTo(58 * sx, 26 * sy);
  ctx.lineTo(52 * sx, 26 * sy);
  ctx.lineTo(52 * sx, 58 * sy);
  ctx.lineTo(8 * sx, 58 * sy);
  ctx.lineTo(8 * sx, 26 * sy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.door;
  ctx.fillRect(24 * sx, 40 * sy, 12 * sx, 18 * sy);
};

const drawColumned = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  const sx = w / 41;
  const sy = h / 37;
  ctx.lineWidth = 1.8 * sx;
  ctx.fillStyle = C.blue;
  ctx.strokeStyle = C.blueDark;
  ctx.beginPath();
  ctx.moveTo(2, 12 * sy);
  ctx.lineTo(20.5 * sx, 2);
  ctx.lineTo(39 * sx, 12 * sy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(4 * sx, 12 * sy, 33 * sx, 20 * sy);
  ctx.strokeRect(4 * sx, 12 * sy, 33 * sx, 20 * sy);
  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < 3; i++) ctx.fillRect((8 + i * 10) * sx, 15 * sy, 5 * sx, 14 * sy);
  ctx.fillRect(2, 32 * sy, 37 * sx, 4 * sy);
};

// ── floor sheet (anchored at f4775 camera) ───────────────────────
const FLOOR_C: Pt = [40, -650];
const SheetFloor: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    if (f >= 5285) return; // page-flip handoff to the outro board
    const mx = (p: Pt) => w / 2 + (p[0] - FLOOR_C[0]);
    const my = (p: Pt) => h / 2 + (p[1] - FLOOR_C[1]);
    const m = (pts: Pt[]) => pts.map(([u, v]) => toFloor(u, v, 4775));
    const path = (pts: Pt[], close: boolean) => {
      ctx.beginPath();
      ctx.moveTo(mx(pts[0]), my(pts[0]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(mx(pts[i]), my(pts[i]));
      if (close) ctx.closePath();
    };
    // sheet parallelogram
    const sheet = m([[88, 306], [362, 212], [717, 243], [455, 468]]);
    path(sheet, true);
    ctx.fillStyle = C.sheet;
    ctx.fill();
    ctx.strokeStyle = "#D8D8D4";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // rule lines + dashed streets on the sheet
    ctx.save();
    path(sheet, true);
    ctx.clip();
    ctx.strokeStyle = "#DBDBD8";
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 5; i++) {
      const t = i / 6;
      const a: Pt = [
        sheet[0][0] + (sheet[1][0] - sheet[0][0]) * t,
        sheet[0][1] + (sheet[1][1] - sheet[0][1]) * t,
      ];
      const b: Pt = [
        sheet[3][0] + (sheet[2][0] - sheet[3][0]) * t,
        sheet[3][1] + (sheet[2][1] - sheet[3][1]) * t,
      ];
      ctx.beginPath();
      ctx.moveTo(mx(a), my(a));
      ctx.lineTo(mx(b), my(b));
      ctx.stroke();
    }
    ctx.setLineDash([6, 6]);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const a: Pt = [
        sheet[0][0] + (sheet[3][0] - sheet[0][0]) * t,
        sheet[0][1] + (sheet[3][1] - sheet[0][1]) * t,
      ];
      const b: Pt = [
        sheet[1][0] + (sheet[2][0] - sheet[1][0]) * t,
        sheet[1][1] + (sheet[2][1] - sheet[1][1]) * t,
      ];
      ctx.beginPath();
      ctx.moveTo(mx(a), my(a));
      ctx.lineTo(mx(b), my(b));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // chart squiggle bottom-right of sheet (solid + dashed twin)
    const sq = m([[500, 350], [522, 372], [545, 360], [570, 396], [598, 380], [622, 412], [648, 402], [660, 424]]);
    path(sq, false);
    ctx.strokeStyle = C.chartRed;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    path(sq.map((p) => [p[0] + 6, p[1] + 14] as Pt), false);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // small paper bottom-left with teal blob
    const paper = m([[140, 380], [260, 380], [260, 445], [140, 445]]);
    path(paper, true);
    ctx.fillStyle = "#FCFCFB";
    ctx.fill();
    ctx.strokeStyle = "#D8D8D4";
    ctx.stroke();
    const blob = m([[165, 398], [235, 398], [235, 428], [165, 428]]);
    path(blob, true);
    ctx.fillStyle = C.teal;
    ctx.fill();
    // yellow rays + white pads/papers (drawn 4700-4708)
    const rayT = fade(f, 4700, 4708);
    if (rayT > 0) {
      ctx.globalAlpha = rayT;
      const from = toFloor(452, 292, 4775);
      const tips: Pt[] = [[287, 300], [300, 268], [318, 245], [345, 228], [378, 218], [412, 208]]
        .map(([u, v]) => toFloor(u, v, 4775));
      for (const tip of tips) {
        ctx.strokeStyle = C.ray;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(mx(from), my(from));
        ctx.lineTo(mx(tip), my(tip));
        ctx.stroke();
        // white paper at tip
        ctx.fillStyle = "#FDFDFC";
        ctx.strokeStyle = "#D8D8D4";
        ctx.lineWidth = 1;
        const s = 16;
        ctx.fillRect(mx(tip) - s, my(tip) - s * 0.7, s * 2, s * 1.4);
        ctx.strokeRect(mx(tip) - s, my(tip) - s * 0.7, s * 2, s * 1.4);
      }
      ctx.globalAlpha = 1;
    }
  }, []);
  return (
    <CanvasPlane frame={frame} width={1600} height={1300} res={0.9}
      position={[FLOOR_C[0], FLOOR_Y, FLOOR_C[1]]} rotation={[-Math.PI / 2, 0, 0]}
      draw={draw} renderOrder={0} />
  );
};

// ── glass wireframe cube ─────────────────────────────────────────
const CUBE = (() => {
  // fit the top face: unproject measured f4835 corners onto y=yTop,
  // choosing yTop that makes the quad most rectangular.
  const corners: Pt[] = [[42, 103], [365, 64], [596, 72], [435, 139]];
  const { cam, pitch } = camCommunity(4835);
  const quadAt = (yTop: number): Pt[] =>
    corners.map(([u, v]) => {
      const dir = rx(-pitch, [(u - 427) / DCAM, (240 - v) / DCAM, -1]);
      const t = (yTop - cam[1]) / dir[1];
      return [cam[0] + dir[0] * t, cam[2] + dir[2] * t];
    });
  let best = { y: 60, score: Infinity, quad: quadAt(60) };
  for (let y = -60; y <= 220; y += 4) {
    const q = quadAt(y);
    if (q.some((p) => !isFinite(p[0]) || Math.abs(p[0]) > 5000)) continue;
    const L = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const s01 = L(q[0], q[1]);
    const s12 = L(q[1], q[2]);
    const s23 = L(q[2], q[3]);
    const s30 = L(q[3], q[0]);
    const score = Math.abs(s01 - s23) + Math.abs(s12 - s30) +
      Math.abs(L(q[0], q[2]) - L(q[1], q[3]));
    if (score < best.score) best = { y, score, quad: q };
  }
  return { yTop: best.y, quad: best.quad };
})();

const CubeLines: React.FC<{ opacity: number; drop: number }> = ({ opacity, drop }) => {
  if (opacity <= 0) return null;
  const { yTop, quad } = CUBE;
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
  return (
    <group position={[0, drop, 0]}>
      <lineSegments geometry={geo} renderOrder={3}>
        <lineBasicMaterial color={C.cube} transparent opacity={opacity * 0.85} />
      </lineSegments>
      <lineSegments geometry={geo} position={[0, -6, 0]} scale={[0.985, 1, 0.985]} renderOrder={3}>
        <lineBasicMaterial color={C.cube} transparent opacity={opacity * 0.6} />
      </lineSegments>
    </group>
  );
};

// ── arrows (screen-space, anchored to the two hero billboards) ───
// One horizontal block arrow from x0→x1 at row y; head at `headEnd`
// ("left"|"right"); optionally clipped to [clipA, clipB] and shifted —
// this implements both the grow-on and the split-and-retract phases.
const BlockArrow: React.FC<{
  x0: number; x1: number; y: number; th: number; color: string; outline: string;
  headEnd: "left" | "right"; opacity: number; clip?: [number, number]; shift?: number;
  zigX?: number;
}> = ({ x0, x1, y, th, color, outline, headEnd, opacity, clip, shift = 0, zigX }) => {
  if (opacity <= 0 || x1 - x0 < 6) return null;
  const head = Math.min(20, (x1 - x0) * 0.3);
  const t = th / 2;
  const pts: Pt[] = [];
  if (headEnd === "left") {
    pts.push([x0, y]);
    pts.push([x0 + head, y - th * 0.95]);
    pts.push([x0 + head, y - t]);
    pts.push([x1, y - t]);
    pts.push([x1, y + t]);
    pts.push([x0 + head, y + t]);
    pts.push([x0 + head, y + th * 0.95]);
  } else {
    pts.push([x1, y]);
    pts.push([x1 - head, y - th * 0.95]);
    pts.push([x1 - head, y - t]);
    pts.push([x0, y - t]);
    pts.push([x0, y + t]);
    pts.push([x1 - head, y + t]);
    pts.push([x1 - head, y + th * 0.95]);
  }
  void zigX;
  const id = `arr-${Math.round(x0)}-${Math.round(y)}-${headEnd}-${Math.round(clip?.[0] ?? 0)}`;
  return (
    <svg width={854} height={480} style={{ position: "absolute", inset: 0, opacity }}>
      {clip && (
        <defs>
          <clipPath id={id}>
            <rect x={clip[0]} y={y - th} width={Math.max(0, clip[1] - clip[0])} height={th * 2} />
          </clipPath>
        </defs>
      )}
      <g clipPath={clip ? `url(#${id})` : undefined} transform={`translate(${shift},0)`}>
        <polygon
          points={pts.map((p) => `${p[0]},${p[1]}`).join(" ")}
          fill={color}
          stroke={outline}
          strokeWidth={1.6}
        />
      </g>
    </svg>
  );
};

// ── the scene ────────────────────────────────────────────────────
export const Community: React.FC = () => {
  const local = useCurrentFrame();
  const frame = local + F0;
  const { cam, pitch } = camCommunity(frame);

  const iconFade = fadeOut(frame, 5262, 5271);

  // hero house: screen keyframes (full art center-x, top-y, width)
  const HX: [number, number][] = [[4775, 423], [4925, 400], [4955, 286], [4985, 253], [5030, 249], [5205, 215], [5225, 346], [5240, 416], [5255, 438], [5270, 435]];
  const HY: [number, number][] = [[4775, 186], [4925, 176], [4955, 156], [4985, 152], [5030, 150], [5205, 162], [5225, 180], [5240, 210], [5255, 232], [5270, 196]];
  const HW: [number, number][] = [[4775, 146], [4925, 150], [4985, 168], [5030, 171], [5205, 176], [5225, 140], [5240, 100], [5255, 70], [5270, 50]];
  const hx = lerp1(HX, frame);
  const hyT = lerp1(HY, frame);
  const hw = lerp1(HW, frame);
  const houseDrop = (1 - easeOutPow(fade(frame, 4698, 4712), 2)) * 40;
  const houseOp = fade(frame, 4698, 4710) * iconFade;
  const annexA = fade(frame, 4900, 4960);

  // bank billboard rides its own solved track exactly
  const fb = Math.max(4715, Math.min(5265, frame));
  const bu = lerp1(T_B.map((r) => [r[0], r[1]] as [number, number]), fb);
  const bv = lerp1(T_B.map((r) => [r[0], r[2]] as [number, number]), fb);
  const bw = lerp1(T_BW, fb);
  const bankDrop = (1 - easeOutPow(fade(frame, 4712, 4722), 2)) * 36;
  const bankOp = fade(frame, 4712, 4720) * iconFade;
  const bankAspect = 176 / 200;
  const bankW = bw * (200 / 102); // track W measures body width 102→art 200

  // community cluster pops
  const clusterOp = iconFade * (frame < 4975 ? 1 : fadeOut(frame, 4975, 4995));
  const pop = (a: number, b: number) => {
    const t = fade(frame, a, b);
    return t <= 0 ? 0 : t >= 1 ? 1 : 1.12 * easeOutPow(t, 2) - 0.12 * t * t;
  };

  // arrows: endpoints anchored to hero edges
  const houseRight = hx + hw / 2;
  const bankLeft = bu - bankW / 2;
  const gap = bankLeft - houseRight;
  const rowY = (hyT + hw * (168 / 171) * 0.45 + bv + bw * bankAspect * 0.45) / 2;
  const redY = rowY - 12 * (gap / 180 + 0.55);
  const blueY = rowY + 12 * (gap / 180 + 0.55);
  const redGrow = fade(frame, 4725, 4745);
  const blueGrow = fade(frame, 4720, 4745);
  const arrLen = gap * 0.66;
  const seam = 0.55; // split fraction (measured seam x≈400-415 of 336-481)
  const retract = easeOutPow(fade(frame, 5075, 5084), 1.5);
  const arrowOp = iconFade * fadeOut(frame, 5083, 5088);
  const thPx = Math.max(8, gap * 0.115);

  const redX0 = houseRight + 4; // head end (left)
  const redX1 = redX0 + arrLen; // tail at bank side
  const redSeam = redX0 + arrLen * seam;
  const blueX0 = houseRight + 6; // tail at house side
  const blueX1 = blueX0 + arrLen; // head end (right)
  const blueSeam = blueX0 + arrLen * seam;
  const shiftL = -retract * (arrLen * seam + 14);
  const shiftR = retract * (gap - arrLen * seam + 14);

  const cubeOp = fade(frame, 4798, 4820) * fadeOut(frame, 5280, 5287);
  const cubeDrop = (1 - easeOutPow(fade(frame, 4798, 4821), 2)) * 90;

  return (
    <AbsoluteFill>
      <Vignette />
      <Room>
        <CameraRig position={cam} rotX={-pitch} />
        <SheetFloor frame={frame} />
        {/* community cluster billboards */}
        <Billboard frame={frame} cx={274} topY={240} wPx={52} aspect={80 / 52}
          opacity={clusterOp * pop(4746, 4756)} draw={drawCubes} />
        <Billboard frame={frame} cx={280} topY={200} wPx={60} aspect={1}
          opacity={clusterOp * pop(4750, 4760)} draw={drawGabled} />
        <Billboard frame={frame} cx={358} topY={192} wPx={41} aspect={37 / 41}
          opacity={clusterOp * pop(4752, 4762)} draw={drawColumned} />
        <Billboard frame={frame} cx={315} topY={172} wPx={38} aspect={37 / 41}
          opacity={clusterOp * pop(4758, 4768)} draw={drawColumned} />
        <Billboard frame={frame} cx={398} topY={166} wPx={40} aspect={37 / 41}
          opacity={clusterOp * pop(4833, 4845)} draw={drawColumned} />
        {/* hero house + bank */}
        <Billboard frame={frame} cx={hx} topY={hyT - houseDrop} wPx={hw} aspect={168 / 171}
          opacity={houseOp} draw={drawHouse(annexA)} order={4} />
        <Billboard frame={frame} cx={bu} topY={bv - bankDrop} wPx={bankW} aspect={bankAspect}
          opacity={bankOp} draw={drawBank} order={4} />
        <CubeLines opacity={cubeOp} drop={cubeDrop} />
      </Room>
      {/* arrows overlay: red grows from the bank side, blue from the
          house side; at 5075-5084 each splits at the seam and the halves
          retract into the facing walls */}
      {retract <= 0 ? (
        <>
          <BlockArrow x0={redX0} x1={redX1} y={redY} th={thPx} color={C.red}
            outline={C.redDark} headEnd="left" opacity={arrowOp * (redGrow > 0 ? 1 : 0)}
            clip={[redX1 - arrLen * redGrow, redX1]} />
          <BlockArrow x0={blueX0} x1={blueX1} y={blueY} th={thPx} color={C.blue}
            outline={C.blueDark} headEnd="right" opacity={arrowOp * (blueGrow > 0 ? 1 : 0)}
            clip={[blueX0, blueX0 + arrLen * blueGrow]} />
        </>
      ) : (
        <>
          <BlockArrow x0={redX0} x1={redX1} y={redY} th={thPx} color={C.red}
            outline={C.redDark} headEnd="left" opacity={arrowOp}
            clip={[redX0 - 40, redSeam]} shift={shiftL} />
          <BlockArrow x0={redX0} x1={redX1} y={redY} th={thPx} color={C.red}
            outline={C.redDark} headEnd="left" opacity={arrowOp}
            clip={[redSeam, redX1 + 40]} shift={shiftR} />
          <BlockArrow x0={blueX0} x1={blueX1} y={blueY} th={thPx} color={C.blue}
            outline={C.blueDark} headEnd="right" opacity={arrowOp}
            clip={[blueX0 - 40, blueSeam]} shift={shiftL} />
          <BlockArrow x0={blueX0} x1={blueX1} y={blueY} th={thPx} color={C.blue}
            outline={C.blueDark} headEnd="right" opacity={arrowOp}
            clip={[blueSeam, blueX1 + 40]} shift={shiftR} />
        </>
      )}
    </AbsoluteFill>
  );
};
