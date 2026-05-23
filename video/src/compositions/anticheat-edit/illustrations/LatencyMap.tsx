import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MOTIF · DISTANCE — "Geography is a tax".
//
// Two nodes on a stage: PARIS (you) on the left, TOKYO — EXCHANGE on the
// right. A thin arc crawls between them while a counter ticks up to 195 ms.
// Inside the same exchange rack, a MARKET MAKER box sits 0.5 m away on a
// short cable — its readout stays at ~0 ms. The same trade, two distances.

const STAGE_W = 1500;
const STAGE_H = 460;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 360;

// Node anchor points in stage-local coordinates.
const PARIS = { x: 150, y: 230 };
const EXCH = { x: 1180, y: 200 };
const MM = { x: 1180, y: 360 };

// Quadratic arc from Paris to the exchange, bowed upward.
const ARC_C = { x: (PARIS.x + EXCH.x) / 2, y: 40 };
const arcPoint = (t: number) => {
  const mt = 1 - t;
  return {
    x: mt * mt * PARIS.x + 2 * mt * t * ARC_C.x + t * t * EXCH.x,
    y: mt * mt * PARIS.y + 2 * mt * t * ARC_C.y + t * t * EXCH.y,
  };
};

const Node: React.FC<{
  x: number;
  y: number;
  label: string;
  sub: string;
  delay: number;
  big?: boolean;
}> = ({ x, y, label, sub, delay, big }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 22,
  });
  const w = big ? 260 : 220;
  const h = big ? 96 : 80;
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        transform: `scale(${(0.6 + 0.4 * pop).toFixed(3)})`,
        opacity: interpolate(pop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        borderRadius: 16,
        background: "rgba(255,255,255,0.06)",
        border: `1.5px solid ${scene.gridLineBright}`,
        boxShadow: "0 18px 40px rgba(2,14,43,0.4)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: big ? 30 : 26,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: scene.ink,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: scene.inkDim,
        }}
      >
        {sub}
      </div>
    </div>
  );
};

const Readout: React.FC<{
  x: number;
  y: number;
  value: string;
  tone: "far" | "near";
  delay: number;
}> = ({ x, y, value, tone, delay }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const color = tone === "far" ? scene.accentSoft : scene.ink;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity: op,
        textAlign: "center",
        fontFamily: monoFont,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div style={{ fontSize: 44, fontWeight: 700, color, letterSpacing: "-0.01em" }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: scene.inkDim,
          marginTop: 4,
        }}
      >
        latency
      </div>
    </div>
  );
};

export const LatencyMap: React.FC = () => {
  const frame = useCurrentFrame();

  // Pulse crawls the arc on a slow loop; line draws in over the first beat.
  const draw = interpolate(frame, [14, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulseT = ((frame % 90) / 90);
  const pulse = arcPoint(pulseT);

  // Counter ticks from 0 to 195 over the draw, then holds.
  const ms = Math.round(interpolate(frame, [16, 52], [0, 195], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }));

  // Build the arc as a polyline up to the draw fraction.
  const pts: string[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * draw;
    const p = arcPoint(t);
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }

  // Short cable between the exchange and the co-located market maker.
  const cableOp = interpolate(frame, [22, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="MOTIF · DISTANCE" title="Geography is a tax">
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
            {/* The long arc Paris → exchange */}
            <polyline
              points={pts.join(" ")}
              fill="none"
              stroke={scene.accentSoft}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="2 10"
              opacity={0.85}
            />
            {/* Crawling pulse along the arc */}
            {draw > 0.98 && (
              <circle cx={pulse.x} cy={pulse.y} r={7} fill={scene.ink}>
              </circle>
            )}
            {/* The co-location cable: exchange ↔ market maker, 0.5 m */}
            <line
              x1={EXCH.x}
              y1={EXCH.y + 40}
              x2={MM.x}
              y2={MM.y - 40}
              stroke={scene.ink}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={cableOp}
            />
          </svg>

          {/* Cable length tag */}
          <div
            style={{
              position: "absolute",
              left: EXCH.x + 20,
              top: (EXCH.y + MM.y) / 2 - 12,
              opacity: cableOp,
              fontFamily: monoFont,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: scene.ink,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            0.5 m
          </div>

          {/* Nodes */}
          <Node x={PARIS.x} y={PARIS.y} label="PARIS" sub="you" delay={4} />
          <Node x={EXCH.x} y={EXCH.y} label="TOKYO" sub="exchange" delay={8} big />
          <Node x={MM.x} y={MM.y} label="MARKET MAKER" sub="same rack" delay={14} />

          {/* Readouts comparing the two distances */}
          <Readout
            x={PARIS.x - 70}
            y={PARIS.y + 70}
            value={`${ms} ms`}
            tone="far"
            delay={18}
          />
          <Readout x={MM.x + 150} y={MM.y - 30} value="0 ms" tone="near" delay={26} />
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
