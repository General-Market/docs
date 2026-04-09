import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FPS } from "../theme";
import { COLOR, NODE } from "../designTokens";
import { DiagramCardDark } from "../components/DiagramCard";

const sec = (s: number) => Math.round(s * FPS);
const W = 1920;
const H = 1080;
// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// SVG filter for glow effects
const GlowFilter: React.FC = () => (
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="glowStrong" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
);

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM: Problem Constellation (11.3s – 22.2s local)
// ═══════════════════════════════════════════════════════════════════════════

const PROBLEMS = [
  { label: "LIQUIDITY", parasite: "orderbook depth", hitSec: 0 },
  { label: "CAPITAL LOCK", parasite: "lock period", hitSec: 7.98 },
  { label: "RISK MGMT", parasite: "counterparty exposure", hitSec: 9.02 },
];

// Triangle positions — centered in frame (main visual, dominates the shot)
const TRIANGLE = [
  { x: 960, y: 280 },  // top center
  { x: 580, y: 680 },  // bottom-left
  { x: 1340, y: 680 }, // bottom-right
];

const ProblemConstellation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <DiagramCardDark width={1100} padding="32px">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <GlowFilter />

        {/* Pulsing red connection lines between triangle points */}
      {TRIANGLE.map((p, i) => {
        const next = TRIANGLE[(i + 1) % 3];
        const lineOpacity = interpolate(frame, [sec(0.5), sec(1.5)], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const pulse = 0.3 + 0.15 * Math.sin(frame * 0.15 + i * 2);
        return (
          <line
            key={`conn-${i}`}
            x1={p.x}
            y1={p.y}
            x2={next.x}
            y2={next.y}
            stroke={COLOR.down}
            strokeWidth={NODE.connection.strokeWidth}
            opacity={lineOpacity * pulse}
            strokeDasharray={NODE.connection.dashArray}
          />
        );
      })}

      {/* Problem nodes */}
      {PROBLEMS.map((prob, i) => {
        const pos = TRIANGLE[i];
        const nodeDelay = sec(prob.hitSec);
        const baseProg = spring({
          frame: Math.max(frame - sec(0.3) - i * sec(0.5), 0),
          fps,
          config: { damping: 16, stiffness: 120, mass: 0.7 },
        });

        // Highlight zoom when speaker names it
        const isHighlighted = frame >= nodeDelay;
        const highlightProg = isHighlighted
          ? spring({
              frame: Math.max(frame - nodeDelay, 0),
              fps,
              config: { damping: 12, stiffness: 200, mass: 0.5 },
            })
          : 0;
        const highlightScale = 1 + highlightProg * 0.2;
        const nodeR = NODE.circle.radius;
        const nodeOpacity = interpolate(baseProg, [0, 0.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <g key={prob.label} opacity={nodeOpacity}>
            {/* Circle node */}
            <g
              transform={`translate(${pos.x}, ${pos.y}) scale(${interpolate(baseProg, [0, 1], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * highlightScale})`}
            >
              {isHighlighted && (
                <circle
                  cx={0}
                  cy={0}
                  r={nodeR + 8}
                  fill="none"
                  stroke={COLOR.down}
                  strokeWidth={NODE.circle.strokeWidth}
                  opacity={0.6 + 0.3 * Math.sin(frame * 0.2)}
                  filter="url(#glow)"
                />
              )}
              <circle
                cx={0}
                cy={0}
                r={nodeR}
                fill="rgba(20, 20, 20, 0.9)"
                stroke={isHighlighted ? COLOR.down : COLOR.mutedLight}
                strokeWidth={NODE.circle.strokeWidth}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={COLOR.white}
                fontFamily={NODE.circle.labelFont}
                fontWeight={NODE.circle.labelWeight}
                fontSize={prob.label.length > 10 ? NODE.circle.labelSize - 4 : NODE.circle.labelSize}
              >
                {prob.label}
              </text>
            </g>

            {/* Parasite labels removed — keep nodes clean */}
          </g>
        );
      })}

      {/* Solution box removed — not approved */}
      </svg>
    </DiagramCardDark>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — Assembled HookDiagrams
// ═══════════════════════════════════════════════════════════════════════════

const CONSTELLATION_START = sec(11.3);
const CONSTELLATION_END = sec(22.2);

export const HookDiagrams: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Problem Constellation only — other diagrams removed */}
      <Sequence
        from={CONSTELLATION_START}
        durationInFrames={CONSTELLATION_END - CONSTELLATION_START}
      >
        <ProblemConstellation />
        {PROBLEMS.map((prob) => (
          <Sequence key={prob.label} from={sec(prob.hitSec)}>
            <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
          </Sequence>
        ))}
      </Sequence>
    </AbsoluteFill>
  );
};
