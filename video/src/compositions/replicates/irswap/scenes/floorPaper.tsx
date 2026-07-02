// The fallen dashboard sheet on the floor after the chart2 fly-out
// (~4131): lands/settles by ~4148, then stays world-locked through
// advDis + slot (the reference camera breathes around it; the sheet
// never slides). World frame: slot anchor f4498 = identity camera.
// Geometry: the sheet is a rotated diamond, corners measured on the
// reference at f4268 and unprojected through PAPER_CAM (the slot camera
// at 4268 — the pose shared by both scenes). All artwork is unprojected
// through the same camera, so it foreshortens with the sheet.

import React, { useCallback } from "react";
import { clamp01, lerp1 } from "../lib/helpers";
import type { Pt } from "../lib/helpers";
import { CanvasPlane, DCAM, unprojToFloor } from "../lib/world";
import type { V3 } from "../lib/world";

export const FLOOR_Y = -170;

// ── slot camera (teal digit block track: u, v, width) ────────────
// Lives here (not in Slot.tsx) so the paper can ride its measured track
// through the same camera; Slot imports it back.
const T_U: [number, number][] = [
  [4268, 290], [4280, 284], [4295, 276], [4310, 266], [4325, 252], [4340, 239], [4355, 227],
  [4370, 218], [4385, 214], [4415, 206], [4430, 201], [4445, 197], [4460, 194], [4475, 191],
  [4490, 189], [4505, 189], [4520, 189], [4535, 191], [4550, 193], [4565, 196], [4580, 198],
  [4595, 200], [4610, 203], [4640, 209], [4655, 211], [4690, 216],
];
const T_V: [number, number][] = [
  [4268, 201], [4280, 203], [4295, 206], [4310, 213], [4325, 220], [4340, 227], [4355, 235],
  [4370, 239], [4385, 240], [4415, 239], [4430, 239], [4445, 239], [4460, 239], [4475, 239],
  [4490, 238], [4520, 238], [4550, 238], [4580, 239], [4610, 238], [4655, 238], [4690, 238],
];
const T_WD: [number, number][] = [
  [4268, 48], [4280, 50], [4310, 55], [4340, 62], [4370, 70], [4415, 75], [4460, 79],
  [4490, 81], [4520, 81], [4580, 79], [4640, 73], [4690, 69],
];
const W_TEAL: V3 = [-238.5, 1.5, 0];
export const camSlot = (f: number): V3 => {
  const wd = lerp1(T_WD, f);
  const cz = (DCAM * 81) / wd;
  const u = lerp1(T_U, f);
  const v = lerp1(T_V, f);
  return [
    W_TEAL[0] - ((u - 427) * cz) / DCAM,
    W_TEAL[1] - ((240 - v) * cz) / DCAM,
    cz,
  ];
};

// AdvDis camera = slot camera at f4268
const CZ0 = (DCAM * 81) / 48;
export const PAPER_CAM: V3 = [
  W_TEAL[0] - ((290 - 427) * CZ0) / DCAM,
  W_TEAL[1] - ((240 - 201) * CZ0) / DCAM,
  CZ0,
];

// screen (f4268 measurements) → world floor (x,z)
const S = (u: number, v: number): Pt => {
  const p = unprojToFloor(u, v, FLOOR_Y, PAPER_CAM);
  return [p[0], p[2]];
};

// sheet corners: far/top, right, near/bottom, left (measured diamond)
const SHEET: Pt[] = [S(320, 322), S(586, 338), S(606, 422), S(198, 398)];
const CEN: Pt = [
  (SHEET[0][0] + SHEET[1][0] + SHEET[2][0] + SHEET[3][0]) / 4,
  (SHEET[0][1] + SHEET[1][1] + SHEET[2][1] + SHEET[3][1]) / 4,
];
// red corner dots sit just outside the sheet corners
const DOTS: Pt[] = [S(306, 319), S(597, 332), S(644, 441), S(158, 405)];

// ── the sheet rides its measured screen track through the slot dolly ─
// (the reference's slot camera and its paper are collage-inconsistent:
// a world-locked sheet exits the frustum by 4350; the ref keeps its far
// edge at the frame bottom the whole ride). Far-corner screen tracks:
const FL_TRK: [number, number, number][] = [
  [4268, 320, 322], [4350, 250, 393], [4400, 230, 412], [4498, 214, 430],
  [4600, 220, 422], [4680, 232, 410],
];
const FR_TRK: [number, number, number][] = [
  [4268, 586, 338], [4350, 594, 390], [4400, 600, 406], [4498, 604, 418],
  [4600, 602, 412], [4680, 598, 406],
];
const A0 = S(320, 322);
const A1 = S(586, 338);
// similarity (rotate+scale+translate) mapping A0A1 → the frame's corners
const sheetXform = (f: number): ((p: Pt) => Pt) => {
  if (f <= 4268) return (p) => p;
  const cam = camSlot(f);
  const un = (u: number, v: number): Pt => {
    const q = unprojToFloor(u, v, FLOOR_Y, cam);
    return [q[0], q[2]];
  };
  const b0 = un(
    lerp1(FL_TRK.map((r) => [r[0], r[1]] as [number, number]), f),
    lerp1(FL_TRK.map((r) => [r[0], r[2]] as [number, number]), f),
  );
  const b1 = un(
    lerp1(FR_TRK.map((r) => [r[0], r[1]] as [number, number]), f),
    lerp1(FR_TRK.map((r) => [r[0], r[2]] as [number, number]), f),
  );
  const va: Pt = [A1[0] - A0[0], A1[1] - A0[1]];
  const vb: Pt = [b1[0] - b0[0], b1[1] - b0[1]];
  const sc = Math.hypot(vb[0], vb[1]) / Math.hypot(va[0], va[1]);
  const th = Math.atan2(vb[1], vb[0]) - Math.atan2(va[1], va[0]);
  const c = Math.cos(th) * sc;
  const s = Math.sin(th) * sc;
  return (p: Pt): Pt => {
    const dx = p[0] - A0[0];
    const dy = p[1] - A0[1];
    return [b0[0] + c * dx - s * dy, b0[1] + s * dx + c * dy];
  };
};

// canvas extent covering the sheet across the whole ride
const PAPER_C: Pt = [-11, 480];
const PAPER_W = 1000;
const PAPER_H = 1000;

export const FloorPaper: React.FC<{ frame: number }> = ({ frame }) => {
  const draw = useCallback((ctx: CanvasRenderingContext2D, f: number, w: number, h: number) => {
    if (f < 4133) return;
    // settle: the sheet lands slightly small and expands flat by ~4148
    const t = clamp01((f - 4136) / 12);
    const e = 1 - Math.pow(1 - t, 2.2);
    const s = 0.62 + 0.38 * e;
    ctx.globalAlpha = clamp01((f - 4133) / 22);
    const T = sheetXform(f);
    const mx = (p: Pt) => {
      const q = T([CEN[0] + (p[0] - CEN[0]) * s, CEN[1] + (p[1] - CEN[1]) * s]);
      return w / 2 + (q[0] - PAPER_C[0]);
    };
    const my = (p: Pt) => {
      const q = T([CEN[0] + (p[0] - CEN[0]) * s, CEN[1] + (p[1] - CEN[1]) * s]);
      return h / 2 + (q[1] - PAPER_C[1]);
    };
    const M = (u: number, v: number): Pt => S(u, v);
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
    // red corner dots (outside the sheet)
    for (const d of DOTS) {
      ctx.beginPath();
      ctx.arc(mx(d), my(d), 2.8, 0, Math.PI * 2);
      ctx.fillStyle = "#C9A0A3";
      ctx.fill();
    }
    // the sheet
    ctx.lineJoin = "round";
    poly(SHEET, "#FCFCFB", "#D8D8D4", 2);
    // clip everything on the spread to the spread
    ctx.save();
    path(SHEET, true);
    ctx.clip();
    // fold gutter
    path([M(432, 332), M(384, 409)], false);
    ctx.strokeStyle = "#D6D6D3";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // plot-cluster rects (left page)
    const rect = (x0: number, y0: number, x1: number, y1: number, fill: string) => {
      poly([M(x0, y0), M(x1, y0), M(x1, y1), M(x0, y1)], fill, null);
    };
    rect(318, 325, 345, 350, "#C9C9C9");
    rect(348, 328, 376, 350, "#D0D0D0");
    rect(350, 336, 430, 344, "#CFEAF3");
    rect(352, 347, 428, 355, "#D8EEF5");
    rect(205, 370, 270, 400, "#CBE9EF");
    // teal dog-eared sticky (bottom-left page, measured f4268)
    poly([M(216, 380), M(286, 382), M(282, 398), M(220, 396)], "#BFE0E4", null);
    poly([M(282, 398), M(286, 390), M(274, 392)], "#A9CDD2", null);
    // faint vertical gridlines under the chart (right page)
    ctx.strokeStyle = "#E3E3E0";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const x = 445 + i * 11.5;
      path([M(x, 336), M(x + 6, 400)], false);
      ctx.stroke();
    }
    // descending red line chart: measured endpoints L(449,340) R(576,360),
    // wiggle shape carried over with damped amplitude
    const chart: Pt[] = [
      [450, 352], [468, 372], [486, 362], [504, 392], [522, 380], [540, 408],
      [556, 398], [570, 424], [580, 440],
    ].map(([x, y]) => M(449 + (x - 450) * 0.977, 340 + (y - 352) * 0.5));
    path(chart, false);
    ctx.strokeStyle = "#E0A9AE";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // dashed companion hugging the solid line from below
    ctx.setLineDash([4, 4]);
    path(chart.map((p) => [p[0] + 3, p[1] + 8] as Pt), false);
    ctx.stroke();
    // red dashed margin along the sheet's right side
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#DBA4A8";
    ctx.lineWidth = 1.6;
    path([M(592, 344), M(604, 410)], false);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.globalAlpha = 1;
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
