// Frames 5276-5433: the credits card. Out of the whiteout, the fallen
// dashboard book lies open on the floor; its LEFT page flips up about the
// book fold — dashboard artwork face up while rising (5286-5301), the
// teal credits board revealed past the one-frame edge-on blade (5302) —
// and settles facing the camera at 5316, static to the end.
//
// r9 STRUCTURAL REBUILD (owner: "think structurally — it's a 3D scene,
// build the scene with the camera, don't chase pixels"). Everything below
// is solved per frame from corner/edge tracks of the reference
// (work/r9/tools/: flood-fill page trackers, teal card/outer-edge
// trackers, bounded bundle solves). What the measurements established:
//  1. THE LENS. The settle era (5302-5316) is a real 3D render at
//     f ~= 560 px (homography-implied focal, stable 545-575 across
//     frames) — NOT this world's DCAM 659.38 (vfov 40). Round 8 solved
//     poses at the wrong lens; fitting the card corners then forces a
//     contorted camera (camY -127, i.e. below the floor) and the board
//     BORDER distribution renders wrong even while the card hole fits —
//     the owner's "too frontal too early" read. The outro therefore runs
//     a designed lens move: D 659.377 -> 560 (smoothstep 5285-5296,
//     hidden in the whiteout), fov = 2*atan(240/D). The final hold is
//     IDENTICAL under the new lens: a frontal plane trades D against
//     camera distance exactly (cam z = D_END, cy = VBB-410).
//  2. THE RISE (5286-5301). The ref book lies with its fold yawed
//     psi ~= +40..+82 deg (NOT the old invented -93/-96 edge-on sliver);
//     the page rises FACE-ON from flat (phi 0 -> 68 by 5299, whip to ~86
//     at 5301). The rising page is drawn SMALLER than the credits board
//     (hand animation): page 578x360 world units vs board 594x799.
//     The rise-era implied focal drifts 272->516 (the ref's rise is a
//     hand warp no single lens fits) — we stay rigid at the designed
//     lens and accept the residual: rigid-fit corner rms ~4-20px on
//     fitted frames (reference-self-contradiction beyond that).
//  3. THE GRAMMAR SWAP (5301->5302). The ref's white page blade
//     (psi ~ +81) becomes a teal board blade (psi ~ -57) with a NEW
//     camera family in ONE edge-on frame — a hidden hand-animation cut
//     (the right page holds its pose through it; no rigid motion or
//     camera connects the two families). We render it the way the ref
//     hides it: TWO mounts. The art page (rise track) fades out
//     5300-5302 while the credits board (settle track) fades in
//     5301-5303; the shared camera cuts fast across 5301-5303 behind
//     the crossfade, and the right page A/B pair below covers the jump.
//  4. THE SETTLE (5302-5316). Solved at the measured lens: corner/edge
//     residuals 0.9-2.6px mean per frame with a smooth physical camera
//     (y 40 -> 374 -> 350, z 741 -> 560, pitch -10 -> 0, roll -30 -> 0)
//     and board phi 55 -> 90, psi -57 -> 0. Board v-extent solved:
//     v_top -38.9 (top edge just above frame at final — the old -30/510
//     texture was invented), hinge at v 760.
//  5. THE RIGHT PAGE is part of a rigid BOOK during the rise: it rides
//     the same fold yaw (psi_A) — the old code kept it frozen at the
//     final pose through the whole scene, which is a physically
//     impossible book and read wrong against the rising page. It holds
//     its pose while the board swings (matching the ref), then page B
//     (final pose) crossfades in under the settle camera.
import React from "react";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { clamp01, lerp1 } from "../lib/helpers";
import { CanvasPlane } from "../lib/world";
import type { V3 } from "../lib/world";

const { fontFamily: FONT } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});

const FLOOR_Y = -170;
const BOARD_CX = 2; // world x of the fold midpoint (screen 429 at the end)

// ── r9 solved geometry (work/r9/tools/solved_split.json) ──
// board: final pose spans screen x132-726; v-extent SOLVED, not assumed
const BW = 594;
const VTB = -38.93; // board top edge, final-pose screen v
const VBB = 760; // board hinge (fold), final-pose screen v
const BH_B = VBB - VTB; // 798.93
// the hand-drawn rising page is smaller than the board it becomes
const WPAGE = 289.02; // page half-width
const DPAGE = 360; // page depth (fold -> free edge)
// lens: the settle era measures f~560; the whole outro glides there
const D_END = 560;
const D0 = 659.377; // = DCAM (vfov 40)

export const outroD = (frame: number): number => {
  if (frame <= 5285) return D0;
  if (frame >= 5296) return D_END;
  const t = (frame - 5285) / 11;
  const s = t * t * (3 - 2 * t);
  return D0 + (D_END - D0) * s;
};

// ── r9 camera track: [f, x, y, z, pitchDeg, rollDeg] ──
// 5283 = the legacy bridge key (T_OUTRO/D_OUTRO plumbing depends on it);
// 5284-5285 ease-in blend; 5286-5301 rise solve; 5302-5315 settle solve;
// 5316 = exact final pose under the new lens.
const CAM_R9: [number, number, number, number, number, number][] = [
  [5283, 220, 620, 1050, 30, 0],
  [5284, 205.09, 622.22, 1072.22, 28.91, 0.72],
  [5285, 160.38, 628.89, 1138.89, 25.64, 2.87],
  [5286, 85.85, 640, 1250, 20.2, 6.46],
  [5287, 50.08, 640, 1250, 19.22, 5.13],
  [5288, 25.16, 633.61, 1231.24, 18.93, 2.98],
  [5289, 26.74, 610.39, 1165.73, 19.41, 2.84],
  [5290, 22.15, 574.03, 1063.96, 20.63, 4.42],
  [5291, 14.58, 542.72, 942.1, 22.74, 7.56],
  [5292, 6.94, 524.11, 828.16, 27.56, 11.66],
  [5293, 30.21, 531.94, 764.81, 29.25, 8.93],
  [5294, 69.36, 538.34, 718.12, 29.83, 3.65],
  [5295, 107.68, 530.01, 662.63, 32, -3.08],
  [5296, 143.89, 490.98, 618.67, 32, -8.2],
  [5297, 146.41, 476.34, 658.35, 32, -11.29],
  [5298, 147.83, 473.16, 677.6, 32, -10.68],
  [5299, 139.04, 445.61, 675.65, 31.58, -9.05],
  [5300, 148.64, 380.38, 608.96, 32, -6.63],
  [5301, 148.38, 342.35, 550, 32, -5.11],
  [5302, 382.6, 40, 741.22, -10.19, -30],
  [5303, 320.48, 105.69, 692.95, -9.81, -23.9],
  [5304, 258.88, 180.72, 658.36, -7.88, -18.07],
  [5305, 204.11, 242.7, 634.44, -5.63, -13.73],
  [5306, 157.24, 289.38, 613.3, -3.6, -10.29],
  [5307, 118.11, 322.71, 594.94, -1.92, -7.62],
  [5308, 86.22, 346.22, 580.11, -0.55, -5.5],
  [5309, 61.16, 361.55, 568.64, 0.47, -3.81],
  [5310, 41.94, 370.34, 560.36, 1.15, -2.53],
  [5311, 27.56, 374.05, 554.99, 1.52, -1.54],
  [5312, 17.5, 373.93, 552.36, 1.61, -0.88],
  [5313, 10.45, 370.7, 551.87, 1.46, -0.4],
  [5314, 6.26, 365.97, 554.14, 1.17, -0.16],
  [5315, 3.72, 357.38, 555.96, 0.56, -0.03],
  [5316, 0, 350, 560, 0, 0],
];

// ── art page track (the rise): [f, phi, psiA] ──
const ART_R9: [number, number, number][] = [
  [5286, 0, 40],
  [5287, 0, 40],
  [5288, 0, 41.76],
  [5289, 1.84, 51.55],
  [5290, 4.83, 59.37],
  [5291, 9.29, 68.33],
  [5292, 15.59, 77.5],
  [5293, 24.1, 80.48],
  [5294, 40.8, 82.09],
  [5295, 54.29, 80.77],
  [5296, 65.7, 77.02],
  [5297, 67.27, 76.2],
  [5298, 67.92, 75.86],
  [5299, 68.53, 77.64],
  // authored whip: the ref page snaps PAST vertical 5300-5302 and falls
  // toward the camera — under the 32-deg-pitch camera, edge-on reads at
  // phi ~ 122 (90 + pitch), so the blade needs phi ~100 -> ~120 here
  // (eye-tuned against ref f5300-5302; the flood tracker has no
  // left-page obs on the whip; phi 82/96 still rendered a wide-open face)
  [5300, 114, 78.5],
  [5301, 126, 80],
  [5302, 134, 81.36],
];

// ── credits board track (the settle): [f, phi, psiB] ──
const BOARD_R9: [number, number, number][] = [
  [5301, 49.73, -61.31],
  [5302, 54.84, -57.34],
  [5303, 59.96, -53.36],
  [5304, 64.94, -49.04],
  [5305, 68.98, -43.9],
  [5306, 72.26, -38.5],
  [5307, 74.9, -32.88],
  [5308, 77.17, -27.45],
  [5309, 79.18, -22.26],
  [5310, 81.02, -17.52],
  [5311, 82.75, -13.21],
  [5312, 84.43, -9.53],
  [5313, 86.04, -6.35],
  [5314, 87.58, -3.97],
  [5315, 88.69, -2.06],
  [5316, 90, 0],
];

export const SETTLE_F = 5316;
const col = (tab: number[][], f: number, c: number): number =>
  lerp1(tab.map((k) => [k[0], k[c]] as [number, number]), f);

export const camOutro = (frame: number): { pos: V3; pitch: number; roll: number } => {
  const fc = Math.min(frame, SETTLE_F);
  return {
    pos: [col(CAM_R9, fc, 1), col(CAM_R9, fc, 2), col(CAM_R9, fc, 3)],
    pitch: (col(CAM_R9, fc, 4) * Math.PI) / 180,
    roll: (col(CAM_R9, fc, 5) * Math.PI) / 180,
  };
};

// r8: the lockup is drawn to MEASURED ref f5380 geometry (static credits
// hold = 143 frames). Bands (screen y at final pose): "Tutorial created
// by" 81-98 x337-486 core 178; logo bbox x367-452 y142-228 core
// (27,155,189); solid teal wordmark cap 249-276 x319-503 core
// (31,154,185); VISUAL FINANCE 277-290 right edge 502 core 185; contacts
// mid-y 346/369/392.5 widths 195/163/136 core 178. (r9 changed only the
// texture mapping constants VTB/BH_B — same final screen coordinates.)
const drawCard = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  // board texture in final-pose screen coordinates: (132,VTB)-(726,VBB)
  const sx = w / BW;
  const sy = h / BH_B;
  const X = (u: number) => (u - 132) * sx;
  const Y = (v: number) => (v - VTB) * sy;
  // teal board (measured vertical gradient), rounded corners like the ref
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#199ABD");
  grad.addColorStop(1, "#2185A4");
  const rr = Math.min(w, h) * 0.02;
  ctx.beginPath();
  ctx.moveTo(rr, 0);
  ctx.arcTo(w, 0, w, h, rr);
  ctx.arcTo(w, h, 0, h, rr);
  ctx.arcTo(0, h, 0, 0, rr);
  ctx.arcTo(0, 0, w, 0, rr);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  // white inner card (170,54)-(684,428)
  ctx.fillStyle = "#FDFDFD";
  ctx.strokeStyle = "#C9CFCF";
  ctx.lineWidth = 1.4;
  ctx.fillRect(X(170), Y(54), (684 - 170) * sx, (428 - 54) * sy);
  ctx.strokeRect(X(170), Y(54), (684 - 170) * sx, (428 - 54) * sy);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  type Ctx2 = CanvasRenderingContext2D & { letterSpacing?: string };
  const c2 = ctx as Ctx2;
  // "Tutorial created by" — light gray, measured cap band 81-95
  ctx.fillStyle = "#B6B6B6";
  ctx.font = `600 ${18 * sx}px ${FONT}`;
  c2.letterSpacing = "0.6px";
  ctx.fillText("Tutorial created by", X(411.5), Y(89.5));
  c2.letterSpacing = "0px";
  // logo: teal leaf pinwheel, measured petal tips off the f5380 crop
  const leaf = (
    bx: number, by: number, tx: number, ty: number, wd: number, bow = 0,
  ) => {
    const dx = tx - bx;
    const dy = ty - by;
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    const p = (t: number, s: number) => [
      bx + dx * t + nx * s, by + dy * t + ny * s,
    ];
    const [a1x, a1y] = p(0.25, wd + bow);
    const [a2x, a2y] = p(0.8, (wd + bow) * 0.9);
    const [b2x, b2y] = p(0.8, -(wd - bow) * 0.9);
    const [b1x, b1y] = p(0.25, -(wd - bow));
    ctx.beginPath();
    ctx.moveTo(X(bx), Y(by));
    ctx.bezierCurveTo(X(a1x), Y(a1y), X(a2x), Y(a2y), X(tx), Y(ty));
    ctx.bezierCurveTo(X(b2x), Y(b2y), X(b1x), Y(b1y), X(bx), Y(by));
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = "#1B9BBD";
  leaf(404, 183, 373, 142, 11, 2.5); // top leaf
  leaf(401, 185, 375, 227, 10, -2.5); // lower-left leaf
  leaf(412, 187, 452, 201, 8, 1.5); // right leaf
  leaf(416, 174, 431, 156, 6.5, 0); // upper-right petal
  // grey cone at the junction
  ctx.fillStyle = "#B3B6B5";
  ctx.beginPath();
  ctx.moveTo(X(407), Y(187));
  ctx.quadraticCurveTo(X(409), Y(174), X(418), Y(169));
  ctx.lineTo(X(427), Y(178));
  ctx.quadraticCurveTo(X(415), Y(181), X(407), Y(187));
  ctx.closePath();
  ctx.fill();
  // "Xpono" — SOLID teal, wide round letterforms
  ctx.fillStyle = "#1B9BBD";
  ctx.font = `700 ${40 * sx}px ${FONT}`;
  c2.letterSpacing = "5px";
  ctx.save();
  ctx.translate(X(414), Y(262.5));
  ctx.scale(1.45, 1);
  ctx.fillText("Xpono", 0, 0);
  ctx.restore();
  // "VISUAL FINANCE" — gray caps, right edge aligned with the wordmark
  ctx.fillStyle = "#A5A5A5";
  ctx.font = `400 ${13 * sx}px ${FONT}`;
  c2.letterSpacing = "3px";
  ctx.textAlign = "right";
  ctx.fillText("VISUAL FINANCE", X(506), Y(283.5));
  ctx.textAlign = "center";
  c2.letterSpacing = "0.8px";
  // contact lines — measured mids 346/369/392.5, widths 195/163/136
  ctx.fillStyle = "#B0B0B0";
  ctx.font = `400 ${19 * sx}px ${FONT}`;
  ctx.fillText("email:  info@xpono.com", X(413), Y(346));
  ctx.fillText("tel:  02079935112", X(413), Y(369));
  ctx.fillText("www.xpono.com", X(413), Y(392.5));
  c2.letterSpacing = "0px";
};

// front of the flipping page = the dashboard's LEFT page. r9: redrawn to
// the MEASURED layout (work/r9/artspec.json — pages unwarped through the
// solved poses at f5293-5297, ECC-registered median, elements traced).
// Texture convention == artspec: x 0..578 = local -wP..+wP, y 0 = FREE
// edge, y 360 = fold. Colors sampled from the raw anchor unwarp.
const drawPageArt = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  const sx = w / 578;
  const sy = h / 360;
  const P = (pts: [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * sx, pts[0][1] * sy);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x * sx, y * sy);
    ctx.closePath();
  };
  ctx.fillStyle = "#FDFDFD";
  ctx.fillRect(0, 0, w, h);
  // (no ruled lines: the ref's rising face is clean white — the 'rules'
  // in early reads were the right page's hatch)
  // hand-drawn page outline (soft wash strokes; the drawn page is WIDER
  // than the model rect — edges at px -52/+600 clip off-canvas, as in ref)
  const border = (
    p0: [number, number], p1: [number, number], t: number, col: string,
  ) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = t * 0.5 * sy;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(p0[0] * sx, p0[1] * sy);
    ctx.lineTo(p1[0] * sx, p1[1] * sy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  // NOTE all fills below are DE-WASHED: the artspec sampled the f5295
  // anchor which carries the boundary-F luma hump (~0.145 toward white);
  // the composition applies its own HUMP overlay, so drawing the washed
  // values would double-wash. true = (measured - 253*h)/(1-h).
  border([-30, -0.7], [619, -10.3], 31.4, "rgb(211,211,211)");
  border([90, 343.6], [579, 345.9], 38.2, "rgb(190,189,190)");
  border([-39.9, 10], [-45.9, 319], 23.5, "rgb(196,207,209)");
  border([601.9, 10], [611.9, 319], 48.1, "rgb(227,227,227)");
  // the two grey plot panels (uniform ink in the ref; measured quads)
  ctx.fillStyle = "rgb(202,202,202)";
  P([[400, 24], [600, 20], [571, 127], [379, 126]]);
  ctx.fill();
  P([[457, 133], [569, 133], [534, 253], [436, 234]]);
  ctx.fill();
  // tall blue strip (single — the 'two strips' read was ghosting)
  ctx.fillStyle = "rgb(210,234,242)";
  P([[375, 142], [416, 139], [387, 311], [348, 324]]);
  ctx.fill();
  // blue rect under panel B
  ctx.fillStyle = "rgb(211,234,240)";
  P([[431, 245], [520, 241], [513, 324], [418, 324]]);
  ctx.fill();
  // teal sticky with the notched left edge (straddles the model page edge)
  ctx.fillStyle = "rgb(200,232,235)";
  ctx.strokeStyle = "rgb(190,216,220)";
  ctx.lineWidth = 1.6;
  P([[-28, 27], [-35, 41], [-37, 138], [-19, 138], [-19, 130], [23, 135],
     [33, 127], [43, 35], [25, 26]]);
  ctx.fill();
  ctx.stroke();
};

// the RIGHT page: r9 redrawn to artspec — hand-drawn red squiggle leaning
// from the fold toward the free edge, pale dashed companion to its left,
// crosshatch block at the fold corner, soft borders. Texture: y0 = FOLD.
const SQUIGGLE: [number, number][] = [
  [438.1, 22], [430, 36], [434.8, 51], [408.9, 66], [402.5, 81],
  [407.6, 95], [405.8, 110], [391.6, 125], [356.3, 140], [345.8, 154],
  [359.7, 169], [351.6, 184], [331.1, 199], [328.8, 213], [337.1, 228],
  [316.3, 243], [306.8, 258], [302.5, 272], [307.3, 287], [312.4, 302],
  [308.8, 317], [316.5, 332],
];
const drawRightPage = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  const sx = w / 578;
  const sy = h / 360;
  ctx.fillStyle = "#FDFDFD";
  ctx.fillRect(0, 0, w, h);
  // crosshatch block at the fold corner (the ref's 'grid' — estimated
  // angles/spacing, artspec hatch_region)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(150 * sx, 0);
  ctx.lineTo(150 * sx, 190 * sy);
  ctx.lineTo(115 * sx, 230 * sy);
  ctx.lineTo(0, 230 * sy);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = "rgba(90,90,90,0.13)";
  ctx.lineWidth = 1;
  for (const ang of [2.9, 38.1]) {
    const a = (ang * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    for (let k = -12; k < 24; k++) {
      const ox = -dy * k * 24 * sy;
      const oy = dx * k * 24 * sy;
      ctx.beginPath();
      ctx.moveTo(ox - dx * 600, oy - dy * 600);
      ctx.lineTo(ox + dx * 600, oy + dy * 600);
      ctx.stroke();
    }
  }
  ctx.restore();
  // soft borders (pale washes — the measured thicknesses are blur widths;
  // draw at ~1/3 with low alpha so they read like the ref's soft edges)
  const border = (
    p0: [number, number], p1: [number, number], t: number, col: string,
  ) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = t * 0.35 * sy;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(p0[0] * sx, p0[1] * sy);
    ctx.lineTo(p1[0] * sx, p1[1] * sy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  border([40, -14], [549, -7], 31.2, "rgb(186,185,186)"); // fold spine (mostly off-canvas)
  border([554.9, -5], [560.6, 359], 42.1, "rgb(219,219,220)");
  border([170, 369.9], [539, 372.3], 36.1, "rgb(220,220,220)");
  // the squiggle: soft halo under the 4px core. Core measured UNWASHED
  // off ref f5305 (p10 of the pink mask): rgb(230,173,174) — the r8-era
  // #D98A95 oversaturated, the washed artspec sample was too pale.
  for (const [lw, col] of [[9, "rgba(240,212,213,0.55)"], [4, "rgb(230,173,174)"]] as
       [number, string][]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * Math.min(sx, sy);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(SQUIGGLE[0][0] * sx, SQUIGGLE[0][1] * sy);
    for (let i = 1; i < SQUIGGLE.length - 1; i++) {
      const xc = ((SQUIGGLE[i][0] + SQUIGGLE[i + 1][0]) / 2) * sx;
      const yc = ((SQUIGGLE[i][1] + SQUIGGLE[i + 1][1]) / 2) * sy;
      ctx.quadraticCurveTo(SQUIGGLE[i][0] * sx, SQUIGGLE[i][1] * sy, xc, yc);
    }
    ctx.stroke();
  }
  // dashed companion: parallel, offset -14.3px toward -x, dash ~9/gap ~21
  ctx.strokeStyle = "rgb(239,214,217)";
  ctx.lineWidth = 2.6 * Math.min(sx, sy);
  ctx.setLineDash([9 * sy, 21.5 * sy]);
  ctx.beginPath();
  ctx.moveTo((SQUIGGLE[0][0] - 14.3) * sx, SQUIGGLE[0][1] * sy);
  for (let i = 1; i < SQUIGGLE.length - 1; i++) {
    const xc = ((SQUIGGLE[i][0] + SQUIGGLE[i + 1][0]) / 2 - 14.3) * sx;
    const yc = ((SQUIGGLE[i][1] + SQUIGGLE[i + 1][1]) / 2) * sy;
    ctx.quadraticCurveTo((SQUIGGLE[i][0] - 14.3) * sx, SQUIGGLE[i][1] * sy, xc, yc);
  }
  ctx.stroke();
  ctx.setLineDash([]);
};

// gray physical rim (board thickness) showing just outside the teal
const drawBacking = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  ctx.fillStyle = "#9AA0A1";
  ctx.fillRect(0, 0, w, h);
};

export const OutroWorld: React.FC<{ frame: number }> = ({ frame }) => {
  const settled = frame >= SETTLE_F;
  // art page pose (rise track)
  const phiA = col(ART_R9, Math.min(frame, 5302), 1);
  const psiA = (col(ART_R9, Math.min(frame, 5302), 2) * Math.PI) / 180;
  const rxA = ((phiA - 90) * Math.PI) / 180;
  // the book's fold yaw for the right page: rides the rise, holds through
  // the board swing (the ref's right page keeps its diagonal), page B
  // takes over at the final grammar
  const psiRA = (col(ART_R9, Math.min(frame, 5301), 2) * Math.PI) / 180;
  // board pose (settle track)
  const fB = Math.min(Math.max(frame, 5301), SETTLE_F);
  const phiB = col(BOARD_R9, fB, 1);
  const psiB = (col(BOARD_R9, fB, 2) * Math.PI) / 180;
  const rxB = ((phiB - 90) * Math.PI) / 180;

  // ── measured opacity choreography ──
  // the ref keeps the book whited-out until ~5286-5288 (r8 measured pale-
  // cyan art mass: ref 0 @5276, 182 @5281, 367 @5285, 1516 @5288)
  const artIn = clamp01((frame - 5284) / 5);
  const artOut = 1 - clamp01((frame - 5300) / 2); // face passes edge-on by 5302
  const rpAIn = clamp01((frame - 5284) / 6);
  const rpAOut = 1 - clamp01((frame - 5301) / 3); // A dies behind the blade swap
  const rpB = clamp01((frame - 5303) / 3); // B (final grammar) fades in pale
  const boardIn = clamp01((frame - 5300.5) / 2); // ref teal appears 5301-5303, solid by 5302.5

  return (
    <>
      {/* right page A: rigid-book grammar — rides the fold yaw while the
          page rises, holds while the board swings (like the ref's) */}
      {rpAIn > 0 && rpAOut > 0 && (
        <group position={[BOARD_CX, FLOOR_Y, 0]} rotation={[0, psiRA, 0]}>
          <CanvasPlane frame={0} width={2 * WPAGE} height={DPAGE} res={1.5}
            position={[0, 0, DPAGE / 2]} rotation={[-Math.PI / 2, 0, 0]}
            draw={drawRightPage} renderOrder={0}
            opacity={rpAIn * rpAOut} />
        </group>
      )}
      {/* right page B: the final grammar (fold frontal), crossfaded in
          under the settle camera while A dies — together they hide the
          ref's own hand-animation cut behind the blade */}
      {rpB > 0 && (
        <CanvasPlane frame={0} width={2 * WPAGE} height={DPAGE} res={1.5}
          position={[BOARD_CX, FLOOR_Y, DPAGE / 2]} rotation={[-Math.PI / 2, 0, 0]}
          draw={drawRightPage} renderOrder={0}
          opacity={rpB} />
      )}
      {/* settled page slivers left/right of the board (final camera:
          y = VBB-410, z = D_END) */}
      {settled && (
        <>
          <mesh position={[299 + 4.5, VBB - 410, -4]}>
            <planeGeometry args={[9, BH_B]} />
            <meshBasicMaterial color="#8F9495" />
          </mesh>
          <mesh position={[-427 + 128, VBB - 410, -4]}>
            <planeGeometry args={[7, BH_B]} />
            <meshBasicMaterial color="#FDFDFD" />
          </mesh>
        </>
      )}
      {/* THE ART PAGE (rise mount): hinged at the fold, face-on rise.
          A plain white BACK plane rides with it: past edge-on (the whip,
          phi > ~122 under the 32-deg camera) the ref shows the page's
          pale back as a thin blade — a single-sided art plane would cull
          to nothing there. */}
      {artIn > 0 && artOut > 0 && (
        <group position={[BOARD_CX, FLOOR_Y, 0]} rotation={[0, psiA, 0]}>
          <group rotation={[rxA, 0, 0]}>
            <CanvasPlane frame={0} width={2 * WPAGE} height={DPAGE} res={1.5}
              position={[0, DPAGE / 2, 0.1]}
              draw={drawPageArt}
              renderOrder={3} opacity={artIn * artOut} />
            <CanvasPlane frame={0} width={2 * WPAGE} height={DPAGE} res={0.5}
              position={[0, DPAGE / 2, -0.15]} rotation={[0, Math.PI, 0]}
              draw={(ctx, _f, w, h) => {
                ctx.fillStyle = "#F4F4F1";
                ctx.fillRect(0, 0, w, h);
              }}
              renderOrder={3} opacity={artIn * artOut} />
          </group>
        </group>
      )}
      {/* THE CREDITS BOARD (settle mount): the teal blade of 5302 swinging
          frontal on the solved track */}
      {boardIn > 0 && (
        <group position={[BOARD_CX, FLOOR_Y, 0]} rotation={[0, psiB, 0]}>
          <group rotation={[rxB, 0, 0]}>
            <CanvasPlane frame={0} width={BW + 7} height={BH_B + 7} res={0.5}
              position={[0, BH_B / 2, -0.4]} draw={drawBacking} renderOrder={1}
              opacity={boardIn} />
            <CanvasPlane frame={0} width={BW} height={BH_B} res={1.4}
              position={[0, BH_B / 2, 0.3]} draw={drawCard} renderOrder={2}
              opacity={boardIn} />
          </group>
        </group>
      )}
    </>
  );
};

export const OutroOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  // dissolving remnant of the community glass cube (ref f5276-5289)
  const cubeGhost = 1 - clamp01((frame - 5278) / 11);
  if (cubeGhost <= 0) return null;
  return (
    <svg width={854} height={480}
      style={{ position: "absolute", inset: 0, opacity: cubeGhost * 0.45 }}>
      <g stroke="#C4C4C4" strokeWidth={1.6} fill="none">
        <polyline points="238,128 402,138 578,120" />
        <line x1={238} y1={128} x2={244} y2={-10} />
        <line x1={402} y1={138} x2={408} y2={0} />
        <line x1={578} y1={120} x2={582} y2={-10} />
      </g>
    </svg>
  );
};
