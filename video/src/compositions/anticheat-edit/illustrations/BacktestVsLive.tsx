import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MOTIF · THE GAP — "The edge that vanishes".
//
// Two lines leave a common origin. BACKTEST climbs steadily in accent blue.
// LIVE starts on the same point, then flattens and droops in soft white. The
// widening gap between them is shaded. Both lines draw in with the frame.

const PLOT_W = 1320;
const PLOT_H = 440;
const PLOT_LEFT = (1920 - PLOT_W) / 2;
const PLOT_TOP = 380;
const PAD = 8;

// Normalised curves over x∈[0,1]; y is 0 (bottom) → 1 (top).
const backtestY = (x: number) => 0.12 + 0.78 * x;
const liveY = (x: number) => {
  // Tracks backtest early, then flattens and droops.
  const climb = 0.12 + 0.62 * x;
  const droop = 0.12 + 0.62 * Math.sin(x * 1.55) * 0.74;
  const w = Math.min(1, x * 1.8);
  return climb * (1 - w) + droop * w;
};

const px = (x: number) => PAD + x * (PLOT_W - 2 * PAD);
const py = (y: number) => PLOT_H - PAD - y * (PLOT_H - 2 * PAD);

const SAMPLES = 64;

export const BacktestVsLive: React.FC = () => {
  const frame = useCurrentFrame();

  // Progressive reveal: lines extend left → right over the entrance.
  const draw = interpolate(frame, [12, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gapOp = interpolate(frame, [40, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const back: string[] = [];
  const live: string[] = [];
  const gapTop: string[] = [];
  const gapBot: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * draw;
    const bp = { x: px(x), y: py(backtestY(x)) };
    const lp = { x: px(x), y: py(liveY(x)) };
    back.push(`${bp.x.toFixed(1)},${bp.y.toFixed(1)}`);
    live.push(`${lp.x.toFixed(1)},${lp.y.toFixed(1)}`);
    gapTop.push(`${bp.x.toFixed(1)},${bp.y.toFixed(1)}`);
    gapBot.unshift(`${lp.x.toFixed(1)},${lp.y.toFixed(1)}`);
  }
  const gapPoly = [...gapTop, ...gapBot].join(" ");

  // End-point dots + labels ride the line ends.
  const endX = draw;
  const backEnd = { x: px(endX), y: py(backtestY(endX)) };
  const liveEnd = { x: px(endX), y: py(liveY(endX)) };

  return (
    <SceneFrame kicker="MOTIF · THE GAP" title="The edge that vanishes">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: PLOT_LEFT,
            top: PLOT_TOP,
            width: PLOT_W,
            height: PLOT_H,
          }}
        >
          <svg
            width={PLOT_W}
            height={PLOT_H}
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {/* Baseline */}
            <line
              x1={0}
              y1={PLOT_H - PAD}
              x2={PLOT_W}
              y2={PLOT_H - PAD}
              stroke={scene.gridLine}
              strokeWidth={1.5}
            />
            {/* Shaded widening gap */}
            <polygon points={gapPoly} fill="rgba(91,121,255,0.16)" opacity={gapOp} />
            {/* LIVE — soft white, droops */}
            <polyline
              points={live.join(" ")}
              fill="none"
              stroke={scene.inkSoft}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* BACKTEST — accent blue, climbs */}
            <polyline
              points={back.join(" ")}
              fill="none"
              stroke={scene.accentSoft}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={backEnd.x} cy={backEnd.y} r={8} fill={scene.accentSoft} />
            <circle cx={liveEnd.x} cy={liveEnd.y} r={8} fill={scene.inkSoft} />
          </svg>

          {/* Line labels at the ends */}
          <Tag x={backEnd.x + 18} y={backEnd.y - 14} text="BACKTEST" color={scene.accentSoft} show={draw > 0.45} />
          <Tag x={liveEnd.x + 18} y={liveEnd.y - 6} text="LIVE" color={scene.inkSoft} show={draw > 0.45} />

          {/* The gap callout */}
          <div
            style={{
              position: "absolute",
              left: px(0.62),
              top: (py(backtestY(0.72)) + py(liveY(0.72))) / 2 - 18,
              opacity: gapOp,
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: scene.ink,
            }}
          >
            the edge
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};

const Tag: React.FC<{ x: number; y: number; text: string; color: string; show: boolean }> = ({
  x,
  y,
  text,
  color,
  show,
}) => {
  const frame = useCurrentFrame();
  const op = show
    ? interpolate(frame, [0, 200], [1, 1])
    : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity: op,
        fontFamily: font,
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: "-0.01em",
        color,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
