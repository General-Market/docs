// Frames 5276-5433: the credits card. The map sheet stands up (5285-5300),
// swings past vertical (teal back face first visible 5301), settles flat
// to camera at 5318, then holds perfectly static to the end.
// 3D: a two-faced board plane; rotX lies it down, rotY swings it in,
// both keyed to the measured left-edge/width track.

import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { loadFont as loadTitillium } from "@remotion/google-fonts/TitilliumWeb";
import { lerp1 } from "../lib/helpers";
import { CameraRig, CanvasPlane, Room, Vignette, DCAM } from "../lib/world";

const { fontFamily: FONT, waitUntilDone } = loadTitillium("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});

const F0 = 5276;

// board: final pose spans x132-726 (594 wide), bleeds past frame v edges
const BW = 594;
const BH = 540;
const HINGE_X = 726 - 427; // vertical hinge at the right edge (299)

// rotY from measured left-edge xs: 5305:244 → cos=(726-244)/594
const ROT_Y: [number, number][] = [
  [5301, 51], [5305, 36], [5310, 24], [5315, 9], [5318, 0],
];
// rotX stand-up 5285-5305 (lying -90° → 0)
const ROT_X: [number, number][] = [
  [5285, -88], [5290, -70], [5295, -45], [5301, -12], [5305, 0],
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
  // teal board
  ctx.fillStyle = "#1E96B9";
  ctx.fillRect(0, 0, w, h);
  // white inner card (170,54)-(684,428)
  ctx.fillStyle = "#FDFDFD";
  ctx.strokeStyle = "#C9CFCF";
  ctx.lineWidth = 1.4;
  ctx.fillRect(X(170), Y(54), (684 - 170) * sx, (428 - 54) * sy);
  ctx.strokeRect(X(170), Y(54), (684 - 170) * sx, (428 - 54) * sy);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // "Tutorial created by"
  ctx.fillStyle = "#8F8F8F";
  ctx.font = `400 ${16 * sy}px ${FONT}`;
  ctx.fillText("Tutorial created by", X(412), Y(90));
  // logo: two teal swoosh/bird shapes, bbox (366,142)-(452,227)
  ctx.fillStyle = "#1C9DBE";
  ctx.save();
  ctx.translate(X(409), Y(184));
  ctx.scale(sx, sy);
  const swoosh = (flip: number, dy: number) => {
    ctx.save();
    ctx.scale(flip, 1);
    ctx.translate(0, dy);
    ctx.beginPath();
    ctx.moveTo(-42, 20);
    ctx.bezierCurveTo(-30, -26, 14, -44, 40, -34);
    ctx.bezierCurveTo(16, -30, -4, -14, -8, 6);
    ctx.bezierCurveTo(-14, 22, -30, 28, -42, 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  swoosh(1, -8);
  swoosh(-1, 22);
  ctx.restore();
  // darker notch
  ctx.fillStyle = "#127792";
  ctx.beginPath();
  ctx.ellipse(X(395.5), Y(183), 6 * sx, 9 * sy, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // "Xpono"
  ctx.fillStyle = "#4CA8C1";
  ctx.font = `600 ${42 * sy}px ${FONT}`;
  ctx.fillText("Xpono", X(411), Y(265));
  // "VISUAL FINANCE"
  ctx.font = `400 ${12 * sy}px ${FONT}`;
  const spaced = "VISUAL FINANCE".split("").join("  ");
  ctx.fillText(spaced, X(441 - 0), Y(286));
  // contact lines
  ctx.fillStyle = "#8F8F8F";
  ctx.font = `400 ${15 * sy}px ${FONT}`;
  ctx.fillText("email:  info@xpono.com", X(413), Y(347));
  ctx.fillText("tel:  02079935112", X(413), Y(368));
  ctx.fillText("www.xpono.com", X(413), Y(394));
};

// front face (the old chart page, seen edge-on during the stand-up)
const drawFront = (ctx: CanvasRenderingContext2D, _f: number, w: number, h: number) => {
  ctx.fillStyle = "#FAFAF9";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#D98A95";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.7);
  ctx.bezierCurveTo(w * 0.35, h * 0.5, w * 0.5, h * 0.75, w * 0.65, h * 0.5);
  ctx.bezierCurveTo(w * 0.75, h * 0.4, w * 0.85, h * 0.45, w * 0.9, h * 0.35);
  ctx.stroke();
};

export const Outro: React.FC = () => {
  const local = useCurrentFrame();
  const frame = local + F0;
  useFonts();
  if (frame < 5285) return null; // community still owns the frame

  const ry = (lerp1(ROT_Y, Math.min(frame, 5318)) * Math.PI) / 180;
  const rxDeg = lerp1(ROT_X, Math.min(frame, 5318));
  const rxA = (rxDeg * Math.PI) / 180;
  const settled = frame >= 5318;

  return (
    <AbsoluteFill>
      <Vignette />
      <Room>
        <CameraRig position={[0, 0, DCAM]} />
        {/* white page edge behind the board (x726-741) */}
        {settled && (
          <mesh position={[HINGE_X + 8, 0, -6]}>
            <planeGeometry args={[15, BH]} />
            <meshBasicMaterial color="#F6F6F6" />
          </mesh>
        )}
        <group position={[HINGE_X, 0, 0]} rotation={[0, ry, 0]}>
          <group rotation={[rxA, 0, 0]}>
            {/* back face = credits card (visible once past vertical) */}
            <CanvasPlane frame={settled ? 5318 : frame} width={BW} height={BH} res={2}
              position={[-BW / 2, 0, 0]} draw={drawCard} renderOrder={2} />
            {/* front face = old chart page */}
            <CanvasPlane frame={0} width={BW} height={BH} res={1}
              position={[-BW / 2, 0, -0.5]} rotation={[0, Math.PI, 0]}
              draw={drawFront} renderOrder={1} />
          </group>
        </group>
      </Room>
    </AbsoluteFill>
  );
};
