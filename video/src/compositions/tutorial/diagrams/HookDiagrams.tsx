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
import { font, monoFont } from "../../../common/fonts";
import { C } from "../../../common/colors";
import { FPS, BRAND_GREEN } from "../theme";

const sec = (s: number) => Math.round(s * FPS);
const W = 1920;
const H = 1080;

const GREEN = BRAND_GREEN;
const RED = C.red;
// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ── AnimatedArrow ───────────────────────────────────────────────────────────
interface AnimatedArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  progress: number; // 0→1
  color?: string;
  strokeW?: number;
}

const AnimatedArrow: React.FC<AnimatedArrowProps> = ({
  x1,
  y1,
  x2,
  y2,
  progress,
  color = "rgba(255, 255, 255, 0.6)",
  strokeW = 2,
}) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const dashOffset = interpolate(progress, [0, 1], [len, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowOpacity = interpolate(progress, [0.7, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Arrowhead points
  const angle = Math.atan2(dy, dx);
  const headLen = 10;
  const ax = x2 - headLen * Math.cos(angle - Math.PI / 6);
  const ay = y2 - headLen * Math.sin(angle - Math.PI / 6);
  const bx = x2 - headLen * Math.cos(angle + Math.PI / 6);
  const by = y2 - headLen * Math.sin(angle + Math.PI / 6);

  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeW}
        strokeDasharray={len}
        strokeDashoffset={dashOffset}
      />
      <polygon
        points={`${x2},${y2} ${ax},${ay} ${bx},${by}`}
        fill={color}
        opacity={arrowOpacity}
      />
    </g>
  );
};

// ── LeaderLine + ParasiteLabel ──────────────────────────────────────────────
interface ParasiteLabelProps {
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  text: string;
  progress: number;
  color?: string;
}

const ParasiteLabel: React.FC<ParasiteLabelProps> = ({
  anchorX,
  anchorY,
  labelX,
  labelY,
  text,
  progress,
  color = "rgba(255, 255, 255, 0.55)",
}) => {
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = 1 + 0.04 * Math.sin(progress * Math.PI * 2);

  return (
    <g opacity={opacity}>
      <line
        x1={anchorX}
        y1={anchorY}
        x2={labelX}
        y2={labelY}
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <circle cx={anchorX} cy={anchorY} r={2.5} fill={color} />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontFamily={monoFont}
        fontWeight={400}
        fontSize={10}
        letterSpacing={0.6}
        transform={`scale(${pulse})`}
      >
        {text.toUpperCase()}
      </text>
    </g>
  );
};

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

  // Solution box appears after all 3 are named (~10s into this sequence)
  const solutionDelay = sec(10);
  const solutionProg = spring({
    frame: Math.max(frame - solutionDelay, 0),
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.7 },
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <GlowFilter />

      {/* Dark backdrop behind constellation for readability */}
      <rect
        x={440}
        y={210}
        width={1040}
        height={680}
        rx={24}
        fill="rgba(10, 10, 10, 0.80)"
      />

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
            stroke={RED}
            strokeWidth={2}
            opacity={lineOpacity * pulse}
            strokeDasharray="8 4"
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
        const nodeR = 48;
        const nodeOpacity = interpolate(baseProg, [0, 0.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Parasite appears 0.3s after highlight
        const parasiteDelay = nodeDelay + sec(0.3);
        const parasiteProg = interpolate(
          frame - parasiteDelay,
          [0, sec(0.4)],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

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
                  stroke={RED}
                  strokeWidth={3}
                  opacity={0.6 + 0.3 * Math.sin(frame * 0.2)}
                  filter="url(#glow)"
                />
              )}
              <circle
                cx={0}
                cy={0}
                r={nodeR}
                fill="rgba(20, 20, 20, 0.9)"
                stroke={isHighlighted ? RED : "rgba(255, 255, 255, 0.3)"}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fafafa"
                fontFamily={font}
                fontWeight={700}
                fontSize={prob.label.length > 10 ? 10 : 12}
              >
                {prob.label}
              </text>
            </g>

            {/* Parasite label */}
            <ParasiteLabel
              anchorX={pos.x}
              anchorY={pos.y + nodeR + 6}
              labelX={pos.x}
              labelY={pos.y + nodeR + 32}
              text={prob.parasite}
              progress={parasiteProg}
              color={RED}
            />
          </g>
        );
      })}

      {/* Solution box — appears after all three named */}
      <g
        transform={`translate(960, 820)`}
        opacity={interpolate(solutionProg, [0, 0.3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
      >
        {/* Arrow down from constellation */}
        <AnimatedArrow
          x1={0}
          y1={-60}
          x2={0}
          y2={-20}
          progress={solutionProg}
          color={GREEN}
          strokeW={3}
        />
        <g transform={`scale(${interpolate(solutionProg, [0, 1], [0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`}>
          <rect
            x={-120}
            y={-16}
            width={240}
            height={36}
            rx={8}
            fill="rgba(0, 200, 83, 0.15)"
            stroke={GREEN}
            strokeWidth={2}
          />
          <text
            x={0}
            y={2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={GREEN}
            fontFamily={font}
            fontWeight={800}
            fontSize={14}
            letterSpacing={2}
          >
            GENERAL MARKET
          </text>
        </g>
      </g>
    </svg>
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
