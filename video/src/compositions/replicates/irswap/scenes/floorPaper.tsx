// The fallen chart dashboard: a paper sheet that tumbles onto the floor
// after the chart2 fly-out (~4131), settles by 4240, and stays through the
// advDis + slot scenes. World frame: slot anchor f4498 = identity camera.
// The advDis camera (= slot camera at 4268) is exported for reuse.

import React, { useCallback } from "react";
import { clamp01 } from "../lib/helpers";
import type { Pt } from "../lib/helpers";
import { CanvasPlane, DCAM, unprojToFloor } from "../lib/world";
import type { V3 } from "../lib/world";

export const FLOOR_Y = -170;

// slot camera at f4268 (teal block at (290,201), width scale 48/81)
const W_TEAL: V3 = [-238.5, 1.5, 0];
const CZ0 = (DCAM * 81) / 48;
export const PAPER_CAM: V3 = [
  W_TEAL[0] - ((290 - 427) * CZ0) / DCAM,
  W_TEAL[1] - ((240 - 201) * CZ0) / DCAM,
  CZ0,
];

// measured colored-core screen quads (through PAPER_CAM)
const coreQuad = (x0: number, y0: number, x1: number, y1: number): Pt[] =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([u, v]) => {
    const p = unprojToFloor(u, v, FLOOR_Y, PAPER_CAM);
    return [p[0], p[2]] as Pt;
  });
const QUAD_A = coreQuad(279, 332, 510, 403); // f4140
const QUAD_B = coreQuad(155, 330, 640, 448); // f4240 (settled)

// simplified chart artwork in unit space (u,v ∈ [0,1])
const ART_CURVE: Pt[] = [
  [290, 307], [302, 300], [314, 288], [326, 275], [338, 268], [350, 268], [362, 276], [374, 279],
  [386, 277], [398, 269], [410, 254], [422, 232], [434, 219], [446, 214], [458, 211], [470, 210],
  [482, 209], [494, 208], [506, 206], [518, 199], [530, 187], [542, 183], [554, 180], [566, 174],
  [578, 166], [590, 149], [596, 136],
].map(([x, y]) => [(x - 290) / 306, (y - 136) / 171] as Pt);

const PAPER_C: Pt = [0, -150];
const PAPER_W = 1300;
const PAPER_H = 900;

export const FloorPaper: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    if (f < 4133) return;
    const t = clamp01((f - 4140) / 100);
    const e = 1 - Math.pow(1 - t, 2.2);
    const q: Pt[] = QUAD_A.map((a, i) => [
      a[0] + (QUAD_B[i][0] - a[0]) * e,
      a[1] + (QUAD_B[i][1] - a[1]) * e,
    ]);
    const mx = (p: Pt) => w / 2 + (p[0] - PAPER_C[0]);
    const my = (p: Pt) => h / 2 + (p[1] - PAPER_C[1]);
    // bilinear map unit → interpolated core quad
    const bl = (u: number, v: number): Pt => {
      const top: Pt = [q[0][0] + (q[1][0] - q[0][0]) * u, q[0][1] + (q[1][1] - q[0][1]) * u];
      const bot: Pt = [q[3][0] + (q[2][0] - q[3][0]) * u, q[3][1] + (q[2][1] - q[3][1]) * u];
      return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v];
    };
    const path = (pts: Pt[], close: boolean) => {
      ctx.beginPath();
      ctx.moveTo(mx(pts[0]), my(pts[0]));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(mx(pts[i]), my(pts[i]));
      if (close) ctx.closePath();
    };
    // sheet (6% margin around the core)
    const m = 0.09;
    const sheet = [bl(-m, -m * 2), bl(1 + m, -m * 2), bl(1 + m, 1 + m), bl(-m, 1 + m)];
    path(sheet, true);
    ctx.fillStyle = "#FCFCFB";
    ctx.fill();
    ctx.strokeStyle = "#D8D8D4";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // hatch region (left of crossing, under the fixed line) — pale teal wash
    const wash = [bl(0.0, 0.55), bl(0.44, 0.55), bl(0.44, 1), bl(0.0, 1)];
    path(wash, true);
    ctx.fillStyle = "#D7E6E6";
    ctx.fill();
    // fixed line
    path([bl(0.0, 0.55), bl(1, 0.6)], false);
    ctx.strokeStyle = "#6B6B6D";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // green dash
    ctx.setLineDash([3, 5]);
    path([bl(0.43, 0.1), bl(0.43, 0.95)], false);
    ctx.strokeStyle = "#76D1BE";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.setLineDash([]);
    // red curve
    path(ART_CURVE.map(([u, v]) => bl(u, v)), false);
    ctx.strokeStyle = "#C62E2F";
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }, []);
  return (
    <CanvasPlane
      frame={frame}
      width={PAPER_W}
      height={PAPER_H}
      res={1}
      position={[PAPER_C[0], FLOOR_Y, PAPER_C[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      draw={draw}
      renderOrder={0}
    />
  );
};
