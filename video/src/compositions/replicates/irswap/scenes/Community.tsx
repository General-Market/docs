// Frames 4690-5290: the community map (S13-S14). Big blue house and red
// bank drop onto a floor map sheet, yellow rays fan to a community of
// small buildings, exchange arrows grow, a glass wireframe cube drops
// over the scene, the camera dives from overhead to eye level, the
// arrows split at their jagged seam, then the camera pulls back out.
//
// Construction mirrors the source: the room (floor sheet, pads, rays,
// dashboard papers) and the cube are real 3D under a pitched translation
// camera solved per frame from the tracked bank; the buildings are real
// extruded solids whose world anchors ride the measured icon tracks (the
// source itself is a 2.5D collage — icon parallax is not 3D-consistent,
// so floor-locked rigid placements cannot follow it).

import React, { useCallback } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { clamp01, easeOutPow, lerp1 } from "../lib/helpers";
import type { Pt } from "../lib/helpers";
import { CameraRig, CanvasPlane, Room, Vignette, DCAM } from "../lib/world";
import type { V3 } from "../lib/world";
import { MiniBuilding } from "./Buildings3D";
import type { MiniSpec } from "./Buildings3D";

const F0 = 4690;
const FLOOR_Y = -170;
const fade = (f: number, a: number, b: number) => clamp01((f - a) / Math.max(1, b - a));
const fadeOut = (f: number, a: number, b: number) => 1 - fade(f, a, b);

const C = {
  blue: "#4CB3CB",
  blueLight: "#8FD0E0",
  blueDark: "#2E7C90",
  red: "#E56575",
  redLight: "#F08B98",
  redDark: "#8E3644",
  ray: "#EEEDA6",
  sheet: "#ECECEC",
  chartRed: "#D98A95",
  teal: "#D0EBEE",
  door: "#CDEDF4",
  cube: "#BFBFBF",
} as const;

// ── camera (pitched translation, solved from the bank track) ─────
const PITCH: [number, number][] = [
  [4685, 34], [4700, 36], [4722, 38], [4885, 38], [4975, 10], [5210, 10], [5240, 22], [5271, 30],
];
const pitchAt = (f: number) => (lerp1(PITCH, f) * Math.PI) / 180;

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
const BU = T_B.map((r) => [r[0], r[1]] as [number, number]);
const BV = T_B.map((r) => [r[0], r[2]] as [number, number]);
const P_BANK: V3 = [192, 20, 0];
const BANK_WORLD_W = 102;

const rx = (a: number, p: V3): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
};

const camCommunity = (f: number): { cam: V3; pitch: number } => {
  const fc = Math.max(4715, Math.min(5265, f));
  const th = pitchAt(f);
  const u = lerp1(BU, fc);
  const v = lerp1(BV, fc);
  const W = lerp1(T_BW, fc);
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

// ── floor: sheet, pads, rays, dashboard papers ───────────────────
const FLOOR_C: Pt = [0, -150];
const SheetFloor: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    if (f >= 5285) return; // page-flip handoff to the outro board
    const mx = (p: Pt) => w / 2 + (p[0] - FLOOR_C[0]);
    const my = (p: Pt) => h / 2 + (p[1] - FLOOR_C[1]);
    const m75 = (pts: Pt[]) => pts.map(([u, v]) => toFloor(u, v, 4775));
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
    // ── map sheet (anchor 4775)
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
    // dashboard artwork on the map (measured at f4810, world-locked;
    // hands over to the eye-level set during the dive)
    if (f < 4990) {
      const m10 = (pts: Pt[]) => pts.map(([u, v]) => toFloor(u, v, 4810));
      ctx.globalAlpha = 1 - fade(f, 4960, 4990);
      poly(m10([[330, 300], [398, 303], [396, 345], [328, 342]]), "#C9C9C9", null);
      poly(m10([[405, 302], [490, 306], [488, 350], [403, 346]]), "#CFEAF3", null);
      poly(m10([[150, 375], [260, 380], [256, 430], [146, 424]]), "#CBE9EF", null);
      // tick columns under the chart
      ctx.strokeStyle = "#DDDDDA";
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const a = toFloor(505 + i * 18, 340, 4810);
        const b = toFloor(500 + i * 18, 416, 4810);
        ctx.beginPath();
        ctx.moveTo(mx(a), my(a));
        ctx.lineTo(mx(b), my(b));
        ctx.stroke();
      }
      const sq = m10([[500, 345], [524, 372], [548, 360], [574, 396], [600, 382], [626, 412], [652, 400], [680, 418]]);
      path(sq, false);
      ctx.strokeStyle = C.chartRed;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      path(sq.map((p) => [p[0] + 6, p[1] + 14] as Pt), false);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // ── under-floor extension at eye level (the ref map surface reaches
    //    the bottom-right corner with faint lane lines; the sheet quad
    //    alone leaves blank white there)
    const extT = fade(f, 4960, 4990) * fadeOut(f, 5215, 5240);
    if (extT > 0) {
      const m40 = (pts: Pt[]) => pts.map(([u, v]) => toFloor(u, v, 5040));
      ctx.globalAlpha = extT;
      poly(m40([[260, 330], [880, 330], [880, 500], [200, 500]]), "#ECECEB", null);
      ctx.strokeStyle = "#DBDBD8";
      ctx.lineWidth = 1.2;
      for (const [a, b] of [
        [[430, 345], [330, 490]], [[560, 345], [520, 490]], [[690, 345], [710, 490]], [[810, 345], [880, 470]],
      ] as [Pt, Pt][]) {
        path(m40([a, b]), false);
        ctx.stroke();
      }
      // eye-level floor artwork (tiles + rate squiggle, measured f5040)
      poly(m40([[70, 365], [163, 368], [160, 414], [68, 410]]), "#D6DBD4", null);
      poly(m40([[155, 370], [248, 373], [246, 410], [153, 407]]), "#D8D8D6", null);
      poly(m40([[87, 415], [308, 420], [305, 455], [85, 450]]), "#CFEAF3", null);
      const sq40 = m40([[340, 410], [372, 440], [404, 425], [436, 458], [464, 445], [496, 478]]);
      path(sq40, false);
      ctx.strokeStyle = C.chartRed;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // ── white pads (fade in with each landing)
    const pad = (quadScr: Pt[], a: number) => {
      if (a <= 0) return;
      ctx.globalAlpha = a;
      poly(m75(quadScr), "#FBFBF9", "#E0E0DC", 1.2);
      ctx.globalAlpha = 1;
    };
    pad([[400, 262], [500, 268], [500, 290], [400, 284]], fade(f, 4700, 4712));
    pad([[556, 286], [668, 292], [668, 322], [556, 316]], fade(f, 4712, 4722));
    // ── yellow rays: soft washed wedges from the house's left wall out
    //    to the community pads (origin + tips re-anchored per phase: the
    //    source collage moves them between the overhead and eye level)
    const rayT = fade(f, 4700, 4708) * fadeOut(f, 5225, 5240);
    if (rayT > 0) {
      ctx.globalAlpha = rayT * 0.8;
      const eyeT = fade(f, 4960, 4990);
      const fromA = toFloor(392, 252, 4775);
      const fromB = toFloor(176, 315, 5040);
      const from: Pt = [
        fromA[0] + (fromB[0] - fromA[0]) * eyeT,
        fromA[1] + (fromB[1] - fromA[1]) * eyeT,
      ];
      const tipsA: [number, number, number][] = [
        [274, 322, 26], [280, 262, 22], [358, 230, 18], [315, 216, 18], [398, 212, 16], [300, 292, 22],
      ];
      const tipsB: [number, number, number][] = [
        [0, 270, 26], [0, 310, 24], [40, 352, 22], [80, 255, 20], [0, 232, 18], [30, 292, 22],
      ];
      const tips: [number, number, number][] = tipsA.map((t, i) => {
        const a = toFloor(t[0], t[1], 4775);
        const b = toFloor(tipsB[i][0], tipsB[i][1], 5040);
        return [
          a[0] + (b[0] - a[0]) * eyeT,
          a[1] + (b[1] - a[1]) * eyeT,
          t[2],
        ];
      });
      for (const [tx, tz, tipW] of tips) {
        const tip: Pt = [tx, tz];
        const dx = tip[0] - from[0];
        const dz = tip[1] - from[1];
        const L = Math.hypot(dx, dz) || 1;
        const px = -dz / L;
        const pz = dx / L;
        const wHalf = tipW / 2;
        poly(
          [
            [from[0] - px * 3, from[1] - pz * 3],
            [tip[0] - px * wHalf, tip[1] - pz * wHalf],
            [tip[0] + px * wHalf, tip[1] + pz * wHalf],
            [from[0] + px * 3, from[1] + pz * 3],
          ],
          C.ray, null,
        );
        // white paper/pad at tip
        ctx.fillStyle = "#FDFDFC";
        ctx.strokeStyle = "#E0E0DC";
        ctx.lineWidth = 1;
        const s = 15;
        ctx.fillRect(mx(tip) - s, my(tip) - s * 0.7, s * 2, s * 1.4);
        ctx.strokeRect(mx(tip) - s, my(tip) - s * 0.7, s * 2, s * 1.4);
      }
      ctx.globalAlpha = 1;
    }
    // ── the fallen dashboard papers: only revealed during the pull-back
    //    (drawn unconditionally they papered over the map squiggle and
    //    showed as a stray white sheet at 4700-5100 — not in the ref)
    if (f < 5130) return;
    ctx.globalAlpha = fade(f, 5130, 5160);
    poly(m5250([[140, 330], [660, 335], [655, 460], [138, 452]]), "#FCFCFB", "#DCDCD8", 1.4);
    poly(m5250([[315, 340], [372, 342], [370, 356], [313, 354]]), "#C4C4C4", null);
    poly(m5250([[378, 342], [460, 345], [458, 365], [376, 362]]), "#D8EEF5", null);
    poly(m5250([[195, 385], [250, 388], [248, 415], [193, 412]]), "#D0EBF0", null);
    {
      const sq2 = m5250([[470, 360], [500, 400], [524, 385], [556, 425], [582, 410], [608, 445], [620, 450]]);
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
    }
  }, []);
  return (
    <CanvasPlane frame={frame} width={1700} height={1500} res={0.9}
      position={[FLOOR_C[0], FLOOR_Y, FLOOR_C[1]]} rotation={[-Math.PI / 2, 0, 0]}
      draw={draw} renderOrder={0} />
  );
};

// ── glass wireframe cube (fit from measured f5240 ref corners:
// bottom L(77,292) F(331,317) R(527,288); tops at v=96/133/132) ──────
const CUBE = (() => {
  // bottom corners on the floor (left, front, right), back by parallelogram
  const bl = toFloor(77, 292, 5240);
  const bf = toFloor(388, 316, 5240);
  const br = toFloor(527, 288, 5240);
  const bb: Pt = [bl[0] + br[0] - bf[0], bl[1] + br[1] - bf[1]];
  // top y from the projected top corners (same x,z as bottoms)
  const { cam, pitch } = camCommunity(5240);
  const ySolve = (p: Pt, v: number): number => {
    // v = 240 - DCAM*qy/(-qz) with q = Rx(pitch)(P - C)
    const dz = p[1] - cam[2];
    // qy = c*dy - s*dz ; qz = s*dy + c*dz  (rotating by +pitch)
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    const k = (240 - v) / DCAM; // qy = k * (-qz)
    // c*dy - s*dz = -k*(s*dy + c*dz)  →  dy(c + k*s) = s*dz - k*c*dz
    const dy = ((s - k * c) * dz) / (c + k * s);
    return cam[1] + dy;
  };
  const yTop = (ySolve(bl, 96) + ySolve(br, 132)) / 2;
  return { quad: [bl, bb, br, bf] as Pt[], yTop };
})();

// The reference glass is near-tintless: presence is carried by the drawn
// edges, a faint sheen wash under the ceiling corners, and the arrows'
// zigzag seam at the face. Faces are real glass (physical material,
// transmissive) so the dive-through reads as passing a pane. Each pane is
// built from its exact corner vertices (the quad is a parallelogram, not
// a rectangle — a plane+quaternion fit sheared the top face into a
// phantom pyramid).
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

const CubeGlass: React.FC<{ opacity: number; drop: number }> = ({ opacity, drop }) => {
  const { yTop, quad } = CUBE;
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
    // (uv v=0 at the strip bottom, v=1 at the top)
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
  }, [quad, yTop]);
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

// ── community buildings: extruded solids on the collage's tracks ─
// The source is a 2.5D collage (icon parallax is not 3D-consistent, and
// floor-locked rigid fits miss by 25-65px), so each mesh is real
// extruded geometry whose world anchor rides the measured icon track,
// unprojected at the building's fitted height (fit-community.mjs).
// f, worldX, worldZ, optional worldY (per-frame depth/size correction —
// the source collage rescales icons shot-to-shot, so the anchor must ride
// in all three axes; y falls back to yBase when absent)
type WTrackRow = [number, number, number] | [number, number, number, number];
type CommB = { yBase: number; track: WTrackRow[]; spec: MiniSpec };
// Cluster = 2-tier box + three temples (measured; the reference has no
// separate small gabled house — that silhouette is t3 seen end-on).
// Tracks re-solved from measured icon bottom-centers (fit-community2.mjs):
// box/t1 exit frame-left before eye level, t2/t3 hold through 5205.
const WB: Record<string, CommB> = {
  house: {
    yBase: -67.5,
    // dive+hold rows re-solved from per-frame ref/cur blob measurements
    // (fit-dive-tracks.mjs): the ref collage slides the icons shot-to-shot,
    // worst mid-dive (dv +26 @4939) and ~(+19,-11)px through the hold.
    track: [
      [4775, 26.1, -5.3], [4880, 11.8, -12.7, -67.5],
      [4915, 30, -39.4, -67.5], [4924, 28, -41.7, -67.5], [4933, 22.6, -58.8, -67.5],
      [4939, 17.8, -70.2, -67.5], [4945, 14.5, -60.8, -67.5], [4951, 7.3, -41.7, -67.5],
      [4953, 9.3, -38.3, -68.8], [4963, -2.9, -27.2, -65.3], [4972, -3.9, -25.6, -62.1],
      [4981, -8.3, -24.7, -61.8], [4995, 1, -20.1, -61.9],
      [5030, -26.5, -44.1, -67.5], [5060, -26.1, -43.5, -68.9], [5100, -29.7, -44.5, -68.9],
      [5150, -25.4, -33.5, -66.1], [5205, -26.4, -23.6, -64.8],
    ],
    spec: { kind: "house", W: 74.2, L: 58, H: 89, eaveFrac: 0.62, fill: C.blue, fillTop: C.blueLight, outline: C.blueDark, door: { u0: 0.37, u1: 0.63, top: 0.53, fill: C.door }, chimney: true },
  },
  bank: {
    yBase: -62,
    // dive+hold rows re-solved from measurements (bank ran ~-28..-39px du)
    track: [
      [4880, 196, 37.1, -62],
      // 4915-4933 stay on the old path: the ref draws a smaller, left-
      // leaning bank on a pad at the overhead pose — a different icon
      // shape; base-matching it painted more wrong pixels, not fewer
      [4915, 192.3, 28.7, -62], [4924, 191.3, 26.6, -62], [4933, 190.3, 24.5, -62],
      [4942, 236, -31.5, -81.2], [4953, 225.9, -25, -84.4], [4963, 219.6, -9.3, -74.2],
      [4972, 212.3, -11.2, -69.6], [4981, 210.1, -5.1, -68.7], [4990, 208.5, -4.6, -68.7],
      [4995, 208.7, -4.9, -68.7], [5030, 183.3, 14.7, -62], [5060, 183.3, 14.7, -62],
      [5100, 183.3, 14.7, -62], [5150, 183.3, 14.7, -62], [5205, 183.3, 14.7, -62],
    ],
    spec: { kind: "temple", W: 88, L: 48, H: 88, eaveFrac: 0.655, fill: C.red, fillTop: C.redLight, outline: C.redDark, cols: { n: 5, fill: "#FFFFFF" }, strip: true },
  },
  t1: {
    yBase: -10.9,
    track: [[4775, -124.6, 6.2], [4880, -163.9, 1.3], [4955, -123.7, 92.1], [5010, -127.9, 120.5]],
    spec: { kind: "temple", W: 46.4, L: 32, H: 36.4, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 4, fill: "#FFFFFF" }, strip: true },
  },
  cbs: {
    yBase: -165.2,
    track: [[4750, -200.1, -69.9], [4775, -201.7, -73.5], [4880, -234.3, -27.1], [4955, -364, -119.8]],
    spec: { kind: "box2", W: 56.1, L: 42, H: 97, eaveFrac: 0, fill: C.blue, outline: C.blueDark },
  },
  t2: {
    yBase: -5.5,
    track: [[4775, -70.9, -15.4], [4880, -108, -32], [4955, -75.7, 88.4], [5000, -63.4, 97.4], [5060, -57.8, 104.5], [5140, -57.2, 102.5], [5205, -57.4, 104.6]],
    spec: { kind: "temple", W: 38.5, L: 30, H: 36.6, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 5, fill: "#FFFFFF" }, strip: true },
  },
  t3: {
    yBase: -12,
    track: [[4775, -4.3, -38.2], [4880, -39.1, -69.9], [4955, -42, -4], [5000, -31.4, 27.7], [5060, -38.6, 7.3], [5140, -44.7, -3.5], [5205, -39.3, 13]],
    spec: { kind: "temple", W: 36.5, L: 30, H: 33.5, eaveFrac: 0.66, fill: C.blue, outline: C.blueDark, cols: { n: 3, fill: "#FFFFFF" }, strip: true },
  },
};
const wbPos = (b: CommB, f: number, lift = 0): V3 => {
  const y4 = b.track.filter((r) => r.length === 4) as [number, number, number, number][];
  return [
    lerp1(b.track.map((r) => [r[0], r[1]] as [number, number]), f),
    (y4.length ? lerp1(y4.map((r) => [r[0], r[3]] as [number, number]), f) : b.yBase) + lift,
    lerp1(b.track.map((r) => [r[0], r[2]] as [number, number]), f),
  ];
};

// ── arrows: jagged-seam block arrows ─────────────────────────────
const JagArrow: React.FC<{
  x0: number; x1: number; y: number; th: number; headEnd: "left" | "right";
  color: string; light: string; outline: string; opacity: number;
  seamX: number; shiftL: number; shiftR: number; grow: number; growFrom: "left" | "right";
}> = ({ x0, x1, y, th, headEnd, color, light, outline, opacity, seamX, shiftL, shiftR, grow, growFrom }) => {
  if (opacity <= 0 || grow <= 0) return null;
  const t = th / 2;
  const head = Math.min(22, (x1 - x0) * 0.28);
  const split = shiftL !== 0 || shiftR !== 0;
  const jag = (xc: number, dir: 1 | -1): string => {
    // jagged mating edge (lightning): from top to bottom
    return [
      `${xc + 2 * dir},${y - t}`,
      `${xc - 4 * dir},${y - t * 0.35}`,
      `${xc + 5 * dir},${y - t * 0.05}`,
      `${xc - 3 * dir},${y + t * 0.45}`,
      `${xc + 2 * dir},${y + t}`,
    ].join(" ");
  };
  // before the split the arrow is one clean block — the zigzag seam only
  // exists once the halves pull apart (ref shows no seam at rest)
  const wholePoly =
    headEnd === "left"
      ? `${x0},${y} ${x0 + head},${y - th * 0.95} ${x0 + head},${y - t} ${x1},${y - t} ${x1},${y + t} ${x0 + head},${y + t} ${x0 + head},${y + th * 0.95}`
      : `${x0},${y - t} ${x1 - head},${y - t} ${x1 - head},${y - th * 0.95} ${x1},${y} ${x1 - head},${y + th * 0.95} ${x1 - head},${y + t} ${x0},${y + t}`;
  // left piece + right piece polygons
  const leftPoly =
    headEnd === "left"
      ? `${x0},${y} ${x0 + head},${y - th * 0.95} ${x0 + head},${y - t} ${jag(seamX, 1)} ${x0 + head},${y + t} ${x0 + head},${y + th * 0.95}`
      : `${x0},${y - t} ${jag(seamX, 1)} ${x0},${y + t}`;
  const rightPoly =
    headEnd === "right"
      ? `${jag(seamX, 1)} ${x1 - head},${y + t} ${x1 - head},${y + th * 0.95} ${x1},${y} ${x1 - head},${y - th * 0.95} ${x1 - head},${y - t}`
      : `${jag(seamX, 1)} ${x1},${y + t} ${x1},${y - t}`;
  // grow clip
  const visW = (x1 - x0 + 44) * grow;
  const clipX = growFrom === "right" ? x1 + 22 - visW : x0 - 22;
  const gid = `jag-${Math.round(y)}-${headEnd}`;
  return (
    <svg width={854} height={480} style={{ position: "absolute", inset: 0, opacity }}>
      <defs>
        <linearGradient id={`${gid}-g`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={light} />
        </linearGradient>
        <clipPath id={gid}>
          <rect x={clipX} y={y - th * 1.2} width={visW} height={th * 2.4} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${gid})`}>
        {split ? (
          <>
            {/* the ref tear offsets the halves vertically as well */}
            <g transform={`translate(${shiftL},${-Math.min(4, Math.abs(shiftL) * 0.6)})`}>
              <polygon points={leftPoly} fill={`url(#${gid}-g)`} stroke={outline} strokeWidth={2.2} />
            </g>
            <g transform={`translate(${shiftR},${Math.min(4, Math.abs(shiftR) * 0.6)})`}>
              <polygon points={rightPoly} fill={`url(#${gid}-g)`} stroke={outline} strokeWidth={2.2} />
            </g>
          </>
        ) : (
          <polygon points={wholePoly} fill={`url(#${gid}-g)`} stroke={outline} strokeWidth={2.2} />
        )}
      </g>
    </svg>
  );
};

// ── foreground glass-pane sweep ──────────────────────────────────
// The cube's LEFT face passes the camera during the dive: a full-height
// neutral-grey band (interior ~22 levels under the bg, two faint edge
// lines) sweeps leftward 4915-4975, parks at the left edge and fades by
// ~5085; during the pull-back (5218-5240) the face re-enters left→right
// and hands over to the drawn cube edges. All xs measured per frame on
// the reference (top band y≈52, bottom band y≈432).
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

// arrow geometry keyframes (endpoints in screen px)
const RED_K: [number, number, number, number][] = [
  // [f, x0(head), x1(tail), cy]
  [4775, 497, 580, 252], [4880, 500, 585, 252], [4925, 480, 560, 240],
  [4940, 447, 505, 240], [4985, 338, 462, 240], [5030, 338, 462, 240], [5205, 335, 460, 240],
];
const BLUE_K: [number, number, number, number][] = [
  [4775, 508, 585, 268], [4880, 512, 590, 268], [4925, 495, 578, 262],
  [4940, 495, 550, 265], [4985, 365, 487, 266], [5030, 365, 487, 266], [5205, 360, 490, 266],
];

// ── the scene ────────────────────────────────────────────────────
export const Community: React.FC = () => {
  const local = useCurrentFrame();
  const frame = local + F0;
  const { cam, pitch } = camCommunity(frame);

  const iconFade = fadeOut(frame, 5262, 5271);
  // wash fitted to the ref mean-luminance ramp (227→242 over 5205-5271;
  // first pass overshot by ~8 levels at 5240)
  const washOp = lerp1([[5205, 0], [5225, 0.22], [5240, 0.38], [5271, 0.62]], frame);

  const houseDrop = (1 - easeOutPow(fade(frame, 4698, 4712), 2)) * 40;
  const houseOp = fade(frame, 4698, 4710) * iconFade;
  const bankDrop = (1 - easeOutPow(fade(frame, 4712, 4722), 2)) * 36;
  const bankOp = fade(frame, 4712, 4720) * iconFade;

  const pop = (a: number, b: number) => {
    const t = fade(frame, a, b);
    return t <= 0 ? 0 : Math.min(1, 1.1 * easeOutPow(t, 2));
  };

  const redK = {
    x0: lerp1(RED_K.map((k) => [k[0], k[1]] as [number, number]), frame),
    x1: lerp1(RED_K.map((k) => [k[0], k[2]] as [number, number]), frame),
    y: lerp1(RED_K.map((k) => [k[0], k[3]] as [number, number]), frame),
  };
  const blueK = {
    x0: lerp1(BLUE_K.map((k) => [k[0], k[1]] as [number, number]), frame),
    x1: lerp1(BLUE_K.map((k) => [k[0], k[2]] as [number, number]), frame),
    y: lerp1(BLUE_K.map((k) => [k[0], k[3]] as [number, number]), frame),
  };
  const closeT = fade(frame, 4925, 4985);
  // measured shaft: ~11px at 4925 → ~15px at 5000 (was 16→24: too chunky)
  const thArrow = 11 + 4 * closeT;
  // small tear opens as the camera settles at eye level (~4990), the
  // halves fully retract at 5075
  const tear = easeOutPow(fade(frame, 4988, 4998), 2) * 4;
  const retract = easeOutPow(fade(frame, 5075, 5084), 1.5);
  const arrowOp = iconFade * fadeOut(frame, 5083, 5088);
  const shiftL = -(tear + retract * 120);
  const shiftR = tear + retract * 120;

  // rigid drop (measured: airborne ~4800, landed ~4812, no bounce), then
  // lifts off during the pull-back before the whiteout
  const cubeOp = fade(frame, 4798, 4806) * fadeOut(frame, 5280, 5287);
  const cubeDrop = (1 - easeOutPow(fade(frame, 4798, 4815), 1.8)) * 150;
  const cubeLift = easeOutPow(fade(frame, 5240, 5271), 1.5) * 110;

  return (
    <AbsoluteFill>
      <Vignette />
      <Room>
        <CameraRig position={cam} rotX={-pitch} />
        <ambientLight intensity={2.5} />
        <Backdrop cam={cam} pitch={pitch} />
        <SheetFloor frame={frame} />
        {/* community cluster: real extruded solids on the collage tracks
            (box + t1 leave the frame during the dive — the ref drops them;
            t2 holds at the left edge, half-faded, through the eye level) */}
        <MiniBuilding spec={WB.cbs.spec} position={wbPos(WB.cbs, frame)}
          opacity={iconFade * fadeOut(frame, 4990, 5005)} scale={pop(4744, 4756)} />
        <MiniBuilding spec={WB.t1.spec} position={wbPos(WB.t1, frame)}
          opacity={iconFade * fadeOut(frame, 5000, 5015)} scale={pop(4750, 4762)} />
        <MiniBuilding spec={WB.t2.spec} position={wbPos(WB.t2, frame)}
          opacity={iconFade * (1 - 0.45 * fade(frame, 4985, 5000))} scale={pop(4754, 4766)} />
        <MiniBuilding spec={WB.t3.spec} position={wbPos(WB.t3, frame)}
          opacity={iconFade * (1 - 0.3 * fade(frame, 4985, 5000))} scale={pop(4766, 4778)} />
        {/* hero house + bank */}
        <MiniBuilding spec={WB.house.spec} position={wbPos(WB.house, frame, houseDrop)} opacity={houseOp} />
        <MiniBuilding spec={WB.bank.spec} position={wbPos(WB.bank, frame, bankDrop)} opacity={bankOp} />
        <CubeGlass opacity={cubeOp} drop={cubeDrop + cubeLift} />
      </Room>
      {/* exchange arrows */}
      <JagArrow x0={redK.x0} x1={redK.x1} y={redK.y} th={thArrow} headEnd="left"
        color={C.red} light="#FF9DAC" outline="#8F565E" opacity={arrowOp}
        seamX={redK.x0 + (redK.x1 - redK.x0) * 0.5} shiftL={shiftL} shiftR={shiftR}
        grow={fade(frame, 4725, 4745)} growFrom="right" />
      <JagArrow x0={blueK.x0} x1={blueK.x1} y={blueK.y} th={thArrow} headEnd="right"
        color={C.blue} light="#7FCBDD" outline="#4E7580" opacity={arrowOp}
        seamX={blueK.x0 + (blueK.x1 - blueK.x0) * 0.35} shiftL={shiftL} shiftR={shiftR}
        grow={fade(frame, 4720, 4745)} growFrom="left" />
      {/* foreground glass pane crossing the camera */}
      <GlassSweep frame={frame} />
      {/* pull-back wash */}
      {washOp > 0 && <AbsoluteFill style={{ background: "#FBFBFA", opacity: washOp }} />}
    </AbsoluteFill>
  );
};
