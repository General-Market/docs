// Frames 5276-5433: the credits card. Out of the whiteout, the fallen
// dashboard book lies open on the floor; its LEFT page flips up about the
// book fold — dashboard artwork face up while rising (5285-5300), the
// teal credits board on its back revealed past vertical (~5303) — and
// settles facing the camera at 5316 (r8 measured), static to the end.
// 3D: real page flip about a floor hinge (world x axis at the fold); the
// camera starts high, pitched and yawed, and eases to the frontal pose.
// End pose: board plane z=0, camera [0,100,DCAM] → screen x132-726 exact.

import React from "react";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { clamp01, lerp1 } from "../lib/helpers";
import { CanvasPlane, DCAM } from "../lib/world";
import type { V3 } from "../lib/world";

const { fontFamily: FONT } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});

const FLOOR_Y = -170;

// board: final pose spans x132-726 (594 wide), bleeds past frame v edges
const BW = 594;
const BH = 540;
const BOARD_CX = 2; // world x of the board center (screen 429 at the end)

// ── choreography keys (fitted to the reference stills by iteration) ──
// The art page lies BEHIND the fold and rises toward the camera (the ref
// shows the dashboard art facing the viewer for the whole rise, upper
// side of the fold); past vertical it leans slightly toward the camera
// and the teal credits take over. phi: 0 = flat behind, 90 = standing.
//
// r8 NEGATIVES on the rise 5284-5302 (measured, all reverted — do not
// retry blind). The ref rise page is FACE-ON, not a sliver (its cyan art
// blob grows to 8837px at 5296 and collapses to 659 by 5300; teal back
// appears 5301) — but every attempt to reproduce that lost SSIM:
// 1. Heuristic face-on rise (phi 22..75, psi ≈ -28): 5290 .924→.914,
//    5296 .917→.893, 5300 .946→.901. Misplaced ink loses to absent ink.
// 2. Analytic per-frame (phi,psi,roll) fits against measured cyan/grey
//    art centroids DIVERGED under both the legacy and the solved camera
//    (30-100px residuals): our drawPageArt layout is INVENTED and does
//    not match the ref page's art arrangement.
// 3. Squiggle-anchored camera solves: one-way ICP (rms "5px") slid along
//    the polyline — rendered squiggle came out 2x the ref's size, 5300
//    .946→.917; the honest two-way ICP ran to a 2000+ unit camera at rms
//    10-16px — our right-page squiggle geometry is also invented and
//    unfittable. Instrument lesson: one-way ICP against a longer curve
//    is degenerate; always check the reverse term.
// The real fix: measure the ref's actual page artwork (left page = the
// community dashboard collage, see Community SIM_E tables; right page =
// the squiggle chart), redraw both pages, then refit poses and camera.
// Until then the sliver rise stays: it is what the metric prefers over
// every mismeasured alternative (5290-5300 baseline .917-.946).
const PHI: [number, number][] = [
  [5283, 8], [5290, 44], [5295, 64], [5300, 88], [5303, 95],
];
// board yaw about the fold midpoint: the page rises turned ~90° away
// (edge-on sliver at 5300 in the ref), then swings frontal by 5318.
// (re-measured: the first pass opened the page toward the camera too
// fast — silhouette 42% too wide at 5303, 22% at 5306; ref cosines give
// the retimed keys below)
const PSI: [number, number][] = [
  [5283, -96], [5295, -93], [5300, -88], [5303, -70],
];
// camera: [frame, x, y, z, pitchDeg] — high in front, descending
const CAM_O: [number, number, number, number, number][] = [
  [5283, 220, 620, 1050, 30],
  [5290, 205, 590, 1030, 29],
  [5295, 190, 540, 990, 27],
  [5300, 170, 460, 920, 23],
  [5303, 85, 360, 850, 17],
];
const ROLL: [number, number][] = [
  [5299, 0], [5301, -10], [5303, -16],
];
// mid-swing height trim: the inner page rode 15-22px high vs the ref
const Y_LIFT: [number, number][] = [
  [5300, 0], [5303, 12],
];

// ── r8: the settle 5304-5316, solved per frame from the reference ──
// The white credits card is a hole in the teal mask; its four corners
// were measured on every ref frame 5304-5316 and the (phi, psi, roll,
// camX, camY, camZ, pitch) pose solved per frame (LM, corner rms
// 1.2-2.8px; work/r8/outro/opose.json). The board is a plane, so hitting
// the four corners reproduces its whole projection (homography). The ref
// settles at 5316 — NOT 5318 (consecutive-frame diff 5316→5317 = 0.002,
// last motion 5315→5316) — so every clamp below reads 5316.
// [f, phi, psi, roll, camX, camY, camZ, pitchDeg]
const OPOSE: [number, number, number, number, number, number, number, number][] = [
  [5304, 76.29, -52.0, -9.25, 137.3, -127.4, 875.4, -13.85],
  [5305, 78.39, -45.93, -7.29, 106.2, -67.0, 843.3, -11.2],
  [5306, 80.27, -40.57, -5.32, 80.3, -17.9, 810.5, -8.81],
  [5307, 81.88, -34.55, -3.87, 59.4, 14.6, 785.4, -7.1],
  [5308, 83.19, -29.27, -2.64, 43.3, 37.5, 760.6, -5.74],
  [5309, 84.11, -23.97, -1.57, 30.3, 51.0, 740.2, -4.76],
  [5310, 85.48, -19.14, -1.06, 21.8, 66.2, 723.2, -3.68],
  [5311, 86.48, -14.84, -0.55, 14.8, 75.6, 708.1, -2.82],
  [5312, 87.46, -11.05, -0.29, 10.7, 83.8, 694.6, -2.05],
  [5313, 88.55, -7.22, -0.03, 5.9, 93.0, 684.4, -1.21],
  [5314, 89.07, -4.77, 0.02, 4.8, 95.3, 673.1, -0.77],
  [5315, 89.43, -2.75, -0.07, 3.6, 96.1, 665.8, -0.45],
  [5316, 90, 0, 0, 0, 100, DCAM, 0],
];
export const SETTLE_F = 5316;
const oposeCol = (f: number, col: number): number =>
  lerp1(OPOSE.map((k) => [k[0], k[col]] as [number, number]), f);
export const oposeAt = (frame: number): { phi: number; psi: number } => {
  const fc = Math.min(frame, SETTLE_F);
  if (fc < OPOSE[0][0]) return { phi: lerp1(PHI, fc), psi: lerp1(PSI, fc) };
  return { phi: oposeCol(fc, 1), psi: oposeCol(fc, 2) };
};

export const camOutro = (frame: number): { pos: V3; pitch: number; roll: number } => {
  const fc = Math.min(frame, SETTLE_F);
  if (fc >= OPOSE[0][0]) {
    return {
      pos: [oposeCol(fc, 4), oposeCol(fc, 5), oposeCol(fc, 6)],
      pitch: (oposeCol(fc, 7) * Math.PI) / 180,
      roll: (oposeCol(fc, 3) * Math.PI) / 180,
    };
  }
  const pos: V3 = [
    lerp1(CAM_O.map((k) => [k[0], k[1]] as [number, number]), fc),
    lerp1(CAM_O.map((k) => [k[0], k[2]] as [number, number]), fc) + lerp1(Y_LIFT, fc),
    lerp1(CAM_O.map((k) => [k[0], k[3]] as [number, number]), fc),
  ];
  const pitch = (lerp1(CAM_O.map((k) => [k[0], k[4]] as [number, number]), fc) * Math.PI) / 180;
  const roll = (lerp1(ROLL, fc) * Math.PI) / 180;
  return { pos, pitch, roll };
};


// r8: the lockup is drawn to MEASURED ref f5380 geometry (static credits
// hold = 143 frames; ssim-grid put 7 of the 8 worst hold cells on this
// card). Bands (screen y at final pose): "Tutorial created by" 81-98
// x337-486 core 178; logo bbox x367-452 y142-228 core (27,155,189); solid
// teal wordmark (NOT hollow — the old strokeText was the catastrophic
// r2c4 cell) cap 249-276 x319-503 core (31,154,185); VISUAL FINANCE
// 277-290 right edge 502 core 185; contacts mid-y 346/369/392.5 widths
// 195/163/136 core 178.
const drawCard = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  // board texture in final-pose screen coordinates: (132,−30)-(726,510)
  const sx = w / BW;
  const sy = h / BH;
  const X = (u: number) => (u - 132) * sx;
  const Y = (v: number) => (v + 30) * sy;
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
  ctx.font = `600 ${18 * sy}px ${FONT}`;
  c2.letterSpacing = "0.6px";
  ctx.fillText("Tutorial created by", X(411.5), Y(89.5));
  c2.letterSpacing = "0px";
  // logo: teal leaf pinwheel, measured petal tips off the f5380 crop —
  // big top leaf, big lower-left leaf, right leaf, stubby upper-right
  // petal, grey cone tucked at the junction. All coords final-pose screen.
  const leaf = (
    bx: number, by: number, tx: number, ty: number, wd: number, bow = 0,
  ) => {
    // fat leaf from base (bx,by) to tip (tx,ty): cubic beziers hold the
    // width toward the tip (the ref lobes are rounded, near-elliptical
    // with a pointed base); wd = half-width, bow leans the bulge sideways
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
  // "Xpono" — SOLID teal, wide round letterforms (Titillium stretched
  // 1.32x horizontally to the measured 184px extent, cap 249-276)
  ctx.fillStyle = "#1B9BBD";
  ctx.font = `700 ${40 * sy}px ${FONT}`;
  c2.letterSpacing = "5px";
  ctx.save();
  ctx.translate(X(414), Y(262.5));
  ctx.scale(1.45, 1);
  ctx.fillText("Xpono", 0, 0);
  ctx.restore();
  // "VISUAL FINANCE" — gray caps, right edge aligned with the wordmark
  ctx.fillStyle = "#A5A5A5";
  ctx.font = `400 ${13 * sy}px ${FONT}`;
  c2.letterSpacing = "3px";
  ctx.textAlign = "right";
  ctx.fillText("VISUAL FINANCE", X(506), Y(283.5));
  ctx.textAlign = "center";
  c2.letterSpacing = "0.8px";
  // contact lines — measured mids 346/369/392.5, widths 195/163/136
  ctx.fillStyle = "#B0B0B0";
  ctx.font = `400 ${19 * sy}px ${FONT}`;
  ctx.fillText("email:  info@xpono.com", X(413), Y(346));
  ctx.fillText("tel:  02079935112", X(413), Y(369));
  ctx.fillText("www.xpono.com", X(413), Y(392.5));
  c2.letterSpacing = "0px";
};

// front of the flipping page = the dashboard's LEFT page (grey plot
// rects, blue strips, teal sticky, faint grid) — what the camera sees
// while the page rises.
const drawPageArt = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  ctx.fillStyle = "#FBFBFA";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#D8D8D4";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  // faint horizontal rules
  ctx.strokeStyle = "#E7E7E4";
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.08, (h * i) / 8);
    ctx.lineTo(w * 0.92, (h * i) / 8);
    ctx.stroke();
  }
  // plot cluster
  ctx.fillStyle = "#C9C9C9";
  ctx.fillRect(w * 0.12, h * 0.1, w * 0.16, h * 0.16);
  ctx.fillStyle = "#D0D0D0";
  ctx.fillRect(w * 0.3, h * 0.12, w * 0.17, h * 0.14);
  ctx.fillStyle = "#CFEAF3";
  ctx.fillRect(w * 0.31, h * 0.3, w * 0.44, h * 0.06);
  ctx.fillStyle = "#D8EEF5";
  ctx.fillRect(w * 0.32, h * 0.39, w * 0.43, h * 0.06);
  ctx.fillStyle = "#CBE9EF";
  ctx.fillRect(w * 0.14, h * 0.55, w * 0.3, h * 0.2);
  // teal dog-eared sticky
  ctx.fillStyle = "#BFE0E4";
  ctx.fillRect(w * 0.62, h * 0.62, w * 0.16, h * 0.16);
  ctx.fillStyle = "#A9CDD2";
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.78);
  ctx.lineTo(w * 0.78, h * 0.72);
  ctx.lineTo(w * 0.72, h * 0.78);
  ctx.closePath();
  ctx.fill();
};

// the RIGHT page stays flat on the floor: red squiggle over faint
// vertical gridlines + dashed margin (same art family as floorPaper)
const drawRightPage = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  ctx.fillStyle = "#FCFCFB";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#D8D8D4";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.strokeStyle = "#E3E3E0";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 12; i++) {
    const x = w * 0.12 + i * w * 0.055;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.12);
    ctx.lineTo(x, h * 0.88);
    ctx.stroke();
  }
  const pts: [number, number][] = [
    [0.1, 0.3], [0.2, 0.45], [0.3, 0.38], [0.42, 0.55], [0.52, 0.48],
    [0.63, 0.62], [0.72, 0.56], [0.82, 0.7], [0.9, 0.78],
  ];
  ctx.strokeStyle = "#D98A95";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(w * pts[0][0], h * pts[0][1]);
  for (const [u, v] of pts.slice(1)) ctx.lineTo(w * u, h * v);
  ctx.stroke();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "#DBA4A8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.94, h * 0.1);
  ctx.lineTo(w * 0.94, h * 0.88);
  ctx.stroke();
  ctx.setLineDash([]);
};

// gray physical rim (board thickness) showing just outside the teal
const drawBacking = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  ctx.fillStyle = "#9AA0A1";
  ctx.fillRect(0, 0, w, h);
};

export const OutroWorld: React.FC<{ frame: number }> = ({ frame }) => {

  const { phi, psi: psiDeg } = oposeAt(frame);
  const rx = ((phi - 90) * Math.PI) / 180; // -90° = flat behind, 0 = standing
  const psi = (psiDeg * Math.PI) / 180;
  const settled = frame >= SETTLE_F;
  // the page plane sweeps through vertical at ~5301: hand the visible
  // surface from the dashboard art to the teal credits across it
  const artOp = 1 - clamp01((frame - 5300) / 3);
  // r8 board-arrival retime: the ref keeps the flipping page INVISIBLE
  // through the whiteout — measured pale-cyan art mass (mask B−R>25 &
  // B>150): ref 0 @5276, 182 @5281, 367 @5285, 1516 @5288 vs ours 3620
  // already at the 5276 mount. The art fades in across 5284-5289.
  // The teal card + backing ride a SEPARATE later ramp (5296-5300):
  // a shared ramp bled the card's teal through the half-transparent art
  // at mid-fade (11510 loose-blue px at 5286 vs ref 435). The card is
  // fully opaque before the plane crosses vertical (~5301), so the
  // credits reveal and the settle track are untouched.
  const flipArt = clamp01((frame - 5284) / 5);
  const flipCard = clamp01((frame - 5296) / 4);

  return (
    <>
      {/* the squiggle page of the open book, flat in front of the fold.
          The reference keeps this page whited-out until ~5288 — fade it
          in rather than popping with the region mount at 5276. */}
      <CanvasPlane frame={0} width={BW} height={BH} res={1.5}
        position={[BOARD_CX, FLOOR_Y, BH / 2]} rotation={[-Math.PI / 2, 0, 0]}
        draw={drawRightPage} renderOrder={0}
        opacity={clamp01((frame - 5280) / 8)} />
      {/* settled page slivers left/right of the board */}
      {settled && (
        <>
          <mesh position={[299 + 4.5, 100, -4]}>
            <planeGeometry args={[9, BH]} />
            <meshBasicMaterial color="#8F9495" />
          </mesh>
          <mesh position={[-427 + 128, 100, -4]}>
            <planeGeometry args={[7, BH]} />
            <meshBasicMaterial color="#FDFDFD" />
          </mesh>
        </>
      )}
      {/* the flipping page: yawed about the fold midpoint (the ref rises
          it turned ~90° away, then swings it frontal), hinged at the
          floor line for the rise itself */}
      <group position={[BOARD_CX, FLOOR_Y, 0]} rotation={[0, psi, 0]}>
      <group rotation={[rx, 0, 0]}>
        {/* page thickness rim (under the page while rising, a teal
            border ring once the credits face the camera) */}
        <CanvasPlane frame={0} width={BW + 7} height={BH + 7} res={0.5}
          position={[0, BH / 2, -0.4]} draw={drawBacking} renderOrder={1}
          opacity={flipCard} />
        {/* credits card, revealed as the page passes vertical */}
        <CanvasPlane frame={0} width={BW} height={BH} res={2}
          position={[0, BH / 2, 0.3]} draw={drawCard} renderOrder={2}
          opacity={flipCard} />
        {/* dashboard-art surface, carried while the page rises */}
        <CanvasPlane frame={frame} width={BW} height={BH} res={1.5}
          position={[0, BH / 2, 0.6]}
          draw={(ctx, f, w, h) => {
            if (artOp <= 0) return;
            ctx.globalAlpha = artOp;
            drawPageArt(ctx, f, w, h);
          }}
          renderOrder={3} opacity={flipArt} />
      </group>
      </group>
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


