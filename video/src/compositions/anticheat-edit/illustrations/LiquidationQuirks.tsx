import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MECHANISM 13 / 13 — "The wick they catch".
//
// A price chart spikes into a sharp downward wick that lasts a few seconds.
// A FORCED LIQUIDATION fills at the very tip of the wick. An arrow hands
// that best-possible fill to a MARKET MAKER PROGRAM box. The extreme price
// you were forced out at is exactly the one they catch.

const STAGE_W = 1560;
const STAGE_H = 500;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 380;

const PLOT_W = 980;
const PLOT_H = 420;
const PLOT_LEFT = 40;
const PLOT_TOP = 20;

const RED = "#FF4D4D";

// The price path as fractions of the plot box (0,0 top-left → 1,1 bottom-right).
// A calm line, then a sharp dive to the wick tip, then a snap back up.
const PATH: { x: number; y: number }[] = [
  { x: 0.0, y: 0.34 },
  { x: 0.14, y: 0.3 },
  { x: 0.26, y: 0.38 },
  { x: 0.38, y: 0.33 },
  { x: 0.48, y: 0.4 },
  { x: 0.55, y: 0.42 },
  { x: 0.6, y: 0.92 }, // dive to the wick tip
  { x: 0.62, y: 0.5 }, // snap back
  { x: 0.72, y: 0.46 },
  { x: 0.84, y: 0.5 },
  { x: 1.0, y: 0.47 },
];

// The wick tip — the forced-liquidation fill point.
const TIP = { x: 0.6, y: 0.92 };

const toPx = (p: { x: number; y: number }) => ({
  x: PLOT_LEFT + p.x * PLOT_W,
  y: PLOT_TOP + p.y * PLOT_H,
});

export const LiquidationQuirks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The line draws left to right; the dive lands around the midpoint.
  const draw = interpolate(frame, [12, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Build a polyline up to the draw fraction by interpolating across segments.
  const totalSeg = PATH.length - 1;
  const drawn = draw * totalSeg;
  const pts: string[] = [];
  for (let i = 0; i < PATH.length; i++) {
    if (i <= drawn) {
      const p = toPx(PATH[i]);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    } else {
      // Partial segment up to the draw front.
      const prev = PATH[i - 1];
      const frac = drawn - (i - 1);
      const ip = {
        x: prev.x + (PATH[i].x - prev.x) * frac,
        y: prev.y + (PATH[i].y - prev.y) * frac,
      };
      const p = toPx(ip);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      break;
    }
  }

  const tipPx = toPx(TIP);

  // The fill marker pops once the line reaches the tip (~frame 44).
  const fillPop = spring({
    fps,
    frame: Math.max(0, frame - 44),
    config: { mass: 0.6, damping: 12, stiffness: 150 },
    durationInFrames: 20,
  });
  const fillOp = interpolate(fillPop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });

  // Pulse ring around the fill, looping slowly.
  const ringT = ((frame - 44) % 50) / 50;
  const ringR = 14 + ringT * 34;
  const ringOp = frame > 50 ? (1 - ringT) * 0.6 : 0;

  // The arrow handing the fill to the MM box draws after the fill lands.
  const armDraw = interpolate(frame, [66, 92], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // MM box pop.
  const mmPop = spring({
    fps,
    frame: Math.max(0, frame - 84),
    config: { mass: 0.7, damping: 14, stiffness: 120 },
    durationInFrames: 22,
  });
  const mmOp = interpolate(mmPop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });

  // Arrow path from the fill tip to the MM box anchor.
  const mmAnchor = { x: PLOT_LEFT + PLOT_W + 220, y: PLOT_TOP + PLOT_H * 0.55 };
  const armStart = { x: tipPx.x, y: tipPx.y };
  const armCtrl = { x: (armStart.x + mmAnchor.x) / 2, y: tipPx.y + 70 };
  const armPts: string[] = [];
  const segs = 40;
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * armDraw;
    const mt = 1 - t;
    const x = mt * mt * armStart.x + 2 * mt * t * armCtrl.x + t * t * mmAnchor.x;
    const y = mt * mt * armStart.y + 2 * mt * t * armCtrl.y + t * t * mmAnchor.y;
    armPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return (
    <SceneFrame kicker="MECHANISM 13 / 13" title="The wick they catch">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: STAGE_H,
          }}
        >
          <svg
            width={STAGE_W}
            height={STAGE_H}
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {/* Plot frame baseline */}
            <line
              x1={PLOT_LEFT}
              y1={PLOT_TOP + PLOT_H + 16}
              x2={PLOT_LEFT + PLOT_W}
              y2={PLOT_TOP + PLOT_H + 16}
              stroke={scene.gridLine}
              strokeWidth={1.5}
            />

            {/* The price line */}
            <polyline
              points={pts.join(" ")}
              fill="none"
              stroke={scene.ink}
              strokeWidth={3.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* The arm handing the fill to the MM */}
            {armDraw > 0.02 && (
              <polyline
                points={armPts.join(" ")}
                fill="none"
                stroke={scene.accentSoft}
                strokeWidth={3}
                strokeDasharray="3 9"
                strokeLinecap="round"
              />
            )}
            {armDraw > 0.97 && (
              <polygon
                points={`${mmAnchor.x},${mmAnchor.y} ${mmAnchor.x - 16},${mmAnchor.y - 9} ${mmAnchor.x - 16},${mmAnchor.y + 9}`}
                fill={scene.accentSoft}
              />
            )}

            {/* Pulse ring around the fill */}
            {ringOp > 0.01 && (
              <circle
                cx={tipPx.x}
                cy={tipPx.y}
                r={ringR}
                fill="none"
                stroke={RED}
                strokeWidth={2}
                opacity={ringOp}
              />
            )}

            {/* The fill dot at the wick tip */}
            <circle
              cx={tipPx.x}
              cy={tipPx.y}
              r={13 * (0.4 + 0.6 * fillPop)}
              fill={RED}
              opacity={fillOp}
              style={{ filter: "drop-shadow(0 0 10px rgba(255,77,77,0.7))" }}
            />
          </svg>

          {/* FORCED LIQUIDATION tag pointing at the tip */}
          <div
            style={{
              position: "absolute",
              left: tipPx.x - 130,
              top: tipPx.y + 22,
              width: 260,
              textAlign: "center",
              opacity: fillOp,
              fontFamily: monoFont,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: RED,
            }}
          >
            forced liquidation
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: scene.inkDim,
                marginTop: 4,
              }}
            >
              filled at the wick tip
            </div>
          </div>

          {/* MARKET MAKER PROGRAM box receiving the best fill */}
          <div
            style={{
              position: "absolute",
              left: mmAnchor.x + 14,
              top: mmAnchor.y - 58,
              width: 300,
              padding: "20px 22px",
              borderRadius: 16,
              background: "rgba(91,121,255,0.12)",
              border: `1.5px solid ${scene.accentSoft}`,
              boxShadow: "0 18px 44px rgba(2,14,43,0.45)",
              opacity: mmOp,
              transform: `translateY(${((1 - mmPop) * 16).toFixed(1)}px)`,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: scene.ink,
                lineHeight: 1.05,
              }}
            >
              MARKET MAKER
              <br />
              PROGRAM
            </div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: scene.accentSoft,
                marginTop: 10,
              }}
            >
              catches the extreme price
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
