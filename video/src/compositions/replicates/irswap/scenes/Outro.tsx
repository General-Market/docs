// Frames 5276-5433: the credits card. Out of the whiteout, the fallen
// dashboard book lies open on the floor; its LEFT page flips up about the
// book fold — dashboard artwork face up while rising (5285-5300), the
// teal credits board on its back revealed past vertical (~5303) — and
// settles facing the camera at 5318, static to the end.
// 3D: real page flip about a floor hinge (world x axis at the fold); the
// camera starts high, pitched and yawed, and eases to the frontal pose.
// End pose: board plane z=0, camera [0,100,DCAM] → screen x132-726 exact.

import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { clamp01, lerp1 } from "../lib/helpers";
import { CameraRig, CanvasPlane, Room, Vignette, DCAM } from "../lib/world";

const { fontFamily: FONT, waitUntilDone } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});

const F0 = 5276;
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
const PHI: [number, number][] = [
  [5283, 8], [5290, 44], [5295, 64], [5300, 88], [5303, 95], [5307, 98],
  [5312, 94], [5318, 90],
];
// board yaw about the fold midpoint: the page rises turned ~90° away
// (edge-on sliver at 5300 in the ref), then swings frontal by 5318.
const PSI: [number, number][] = [
  [5283, -96], [5295, -93], [5300, -88], [5303, -62], [5306, -34],
  [5310, -15], [5314, -5], [5318, 0],
];
// camera: [frame, x, y, z, pitchDeg] — high in front, descending to the
// exact frontal pose (0,100,DCAM) which reproduces the settled board
// span x132-726 / v-30..510 precisely.
const CAM_O: [number, number, number, number, number][] = [
  [5283, 220, 620, 1050, 30],
  [5290, 205, 590, 1030, 29],
  [5295, 190, 540, 990, 27],
  [5300, 170, 460, 920, 23],
  [5303, 85, 360, 850, 17],
  [5306, 30, 280, 800, 12],
  [5312, 5, 150, 700, 4],
  [5318, 0, 100, DCAM, 0],
];
// camera roll through the reveal (ref board tilts ~8° CCW mid-swing)
const ROLL: [number, number][] = [
  [5299, 0], [5303, -8], [5307, -4], [5312, -1.5], [5318, 0],
];
// whiteout hand-off (ref background is settled by ~5290)
const WASH: [number, number][] = [
  [5276, 0.9], [5282, 0.55], [5288, 0.2], [5294, 0],
];

const useFonts = () => {
  const [, setReady] = useState(false);
  const [handle] = useState(() => delayRender("outro-fonts"));
  useEffect(() => {
    Promise.resolve(waitUntilDone()).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
};

const drawCard = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  // board texture in final-pose screen coordinates: (132,−30)-(726,510)
  const sx = w / BW;
  const sy = h / BH;
  const X = (u: number) => (u - 132) * sx;
  const Y = (v: number) => (v + 30) * sy;
  // teal board (measured vertical gradient), rounded corners like the ref
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#189BC1");
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
  // "Tutorial created by" — light gray, gently tracked
  ctx.fillStyle = "#B3B3B3";
  ctx.font = `400 ${16 * sy}px ${FONT}`;
  c2.letterSpacing = "1px";
  ctx.fillText("Tutorial created by", X(412), Y(89));
  c2.letterSpacing = "0px";
  // logo: four-lobe butterfly — two large wings left, two petals right,
  // gray center accent
  ctx.save();
  ctx.translate(X(392), Y(200));
  ctx.scale(sx, sy);
  ctx.fillStyle = "#1C9DBE";
  const lobe = (rot: number, len: number, wd: number) => {
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wd, -len * 0.45, -wd * 0.7, -len * 0.95, 6, -len);
    ctx.bezierCurveTo(wd * 0.55, -len * 0.8, wd * 0.35, -len * 0.3, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  lobe(-0.62, 46, 15); // large upper-left wing
  lobe(-1.12, 38, 13); // large lower-left wing
  lobe(0.45, 34, 11); // upper-right petal
  lobe(0.95, 26, 9); // lower-right petal
  ctx.fillStyle = "#B3B5B5";
  ctx.beginPath();
  ctx.ellipse(2, 2, 6, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // "Xpono" — heavy hollow (outlined) lettering, wide tracking
  ctx.strokeStyle = "#4CA8C1";
  ctx.lineWidth = 1.8 * sy;
  ctx.font = `600 ${40 * sy}px ${FONT}`;
  c2.letterSpacing = "7px";
  ctx.strokeText("Xpono", X(414), Y(264));
  // "VISUAL FINANCE" — small gray caps, right-aligned under the wordmark
  ctx.fillStyle = "#B4B4B4";
  ctx.font = `400 ${9 * sy}px ${FONT}`;
  c2.letterSpacing = "3px";
  ctx.textAlign = "right";
  ctx.fillText("VISUAL FINANCE", X(474), Y(286));
  ctx.textAlign = "center";
  c2.letterSpacing = "0.8px";
  // contact lines (evenly spaced — they collided at 15px pitch)
  ctx.fillStyle = "#A7A7A7";
  ctx.font = `400 ${17 * sy}px ${FONT}`;
  ctx.fillText("email:  info@xpono.com", X(413), Y(347));
  ctx.fillText("tel:  02079935112", X(413), Y(368));
  ctx.fillText("www.xpono.com", X(413), Y(389));
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

export const Outro: React.FC = () => {
  const local = useCurrentFrame();
  const frame = local + F0;
  useFonts();

  const fc = Math.min(frame, 5318);
  const phi = lerp1(PHI, fc);
  const rx = ((phi - 90) * Math.PI) / 180; // -90° = flat behind, 0 = standing
  const psi = (lerp1(PSI, fc) * Math.PI) / 180;
  const cam: [number, number, number] = [
    lerp1(CAM_O.map((k) => [k[0], k[1]] as [number, number]), fc),
    lerp1(CAM_O.map((k) => [k[0], k[2]] as [number, number]), fc),
    lerp1(CAM_O.map((k) => [k[0], k[3]] as [number, number]), fc),
  ];
  const pitch = (lerp1(CAM_O.map((k) => [k[0], k[4]] as [number, number]), fc) * Math.PI) / 180;
  const roll = (lerp1(ROLL, fc) * Math.PI) / 180;
  const settled = frame >= 5318;
  // dissolving remnant of the community glass cube (ref f5276-5289)
  const cubeGhost = 1 - clamp01((frame - 5278) / 11);
  const wash = frame < 5303 ? lerp1(WASH, frame) : 0;
  // the page plane sweeps through vertical at ~5301: hand the visible
  // surface from the dashboard art to the teal credits across it
  const artOp = 1 - clamp01((frame - 5300) / 3);

  return (
    <AbsoluteFill>
      <Vignette />
      <Room>
        <CameraRig position={cam} rotX={-pitch} rotZ={roll} />
        {/* the squiggle page of the open book, flat in front of the fold */}
        <CanvasPlane frame={0} width={BW} height={BH} res={1.5}
          position={[BOARD_CX, FLOOR_Y, BH / 2]} rotation={[-Math.PI / 2, 0, 0]}
          draw={drawRightPage} renderOrder={0} />
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
            position={[0, BH / 2, -0.4]} draw={drawBacking} renderOrder={1} />
          {/* credits card, revealed as the page passes vertical */}
          <CanvasPlane frame={0} width={BW} height={BH} res={2}
            position={[0, BH / 2, 0.3]} draw={drawCard} renderOrder={2} />
          {/* dashboard-art surface, carried while the page rises */}
          <CanvasPlane frame={frame} width={BW} height={BH} res={1.5}
            position={[0, BH / 2, 0.6]}
            draw={(ctx, f, w, h) => {
              if (artOp <= 0) return;
              ctx.globalAlpha = artOp;
              drawPageArt(ctx, f, w, h);
            }}
            renderOrder={3} />
        </group>
        </group>
      </Room>
      {/* dissolving remnant of the community glass cube */}
      {cubeGhost > 0 && (
        <svg width={854} height={480}
          style={{ position: "absolute", inset: 0, opacity: cubeGhost * 0.45 }}>
          <g stroke="#C4C4C4" strokeWidth={1.6} fill="none">
            <polyline points="238,128 402,138 578,120" />
            <line x1={238} y1={128} x2={244} y2={-10} />
            <line x1={402} y1={138} x2={408} y2={0} />
            <line x1={578} y1={120} x2={582} y2={-10} />
          </g>
        </svg>
      )}
      {wash > 0 && <AbsoluteFill style={{ background: "#FBFBFA", opacity: wash }} />}
    </AbsoluteFill>
  );
};
