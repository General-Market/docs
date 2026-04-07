import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();
const TEAL = "#4ECDC4";
const TEXT_DARK = "#1a1a1a";

/* ── Inline SVG Icons ───────────────────────────────────── */

const CandlestickIcon: React.FC<{ size?: number }> = ({ size = 90 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <rect x="14" y="18" width="12" height="36" rx="2" fill={TEAL} />
    <line x1="20" y1="10" x2="20" y2="18" stroke={TEAL} strokeWidth="3" />
    <line x1="20" y1="54" x2="20" y2="62" stroke={TEAL} strokeWidth="3" />
    <rect x="34" y="10" width="12" height="32" rx="2" fill={TEAL} />
    <line x1="40" y1="2" x2="40" y2="10" stroke={TEAL} strokeWidth="3" />
    <line x1="40" y1="42" x2="40" y2="50" stroke={TEAL} strokeWidth="3" />
    <rect x="54" y="14" width="12" height="34" rx="2" fill={TEAL} />
    <line x1="60" y1="6" x2="60" y2="14" stroke={TEAL} strokeWidth="3" />
    <line x1="60" y1="48" x2="60" y2="56" stroke={TEAL} strokeWidth="3" />
  </svg>
);

const OpenAIKnotIcon: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 32 32">
    <path
      d="M16 4 C19 4 21 6 22 8 C24 8 26 10 26 13 C27 14 27 17 26 19 C26 22 24 24 22 24 C21 26 19 28 16 28 C13 28 11 26 10 24 C8 24 6 22 6 19 C5 18 5 15 6 13 C6 10 8 8 10 8 C11 6 13 4 16 4 Z"
      fill="none"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="16" r="2" fill="#fff" />
  </svg>
);

const SparkleIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 32 32">
    <path
      d="M16 2 L18 14 L30 16 L18 18 L16 30 L14 18 L2 16 L14 14 Z"
      fill="#fff"
    />
  </svg>
);

const GeminiStarIcon: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 32 32">
    <path
      d="M16 3 L19 13 L29 16 L19 19 L16 29 L13 19 L3 16 L13 13 Z"
      fill="#fff"
    />
  </svg>
);

const ModelCircle: React.FC<{ kind: "openai" | "sparkle" | "gemini" }> = ({
  kind,
}) => (
  <div
    style={{
      width: 50,
      height: 50,
      borderRadius: "50%",
      backgroundColor: TEAL,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 6px rgba(78,205,196,0.25)",
    }}
  >
    {kind === "openai" && <OpenAIKnotIcon />}
    {kind === "sparkle" && <SparkleIcon />}
    {kind === "gemini" && <GeminiStarIcon />}
  </div>
);

const StopwatchIcon: React.FC = () => (
  <svg width="60" height="60" viewBox="0 0 48 48">
    <rect x="20" y="3" width="8" height="5" rx="1" fill={TEAL} />
    <line x1="24" y1="8" x2="24" y2="11" stroke={TEAL} strokeWidth="2.5" />
    <circle
      cx="24"
      cy="26"
      r="15"
      fill="none"
      stroke={TEAL}
      strokeWidth="3.5"
    />
    <line
      x1="24"
      y1="26"
      x2="24"
      y2="16"
      stroke={TEAL}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <line
      x1="24"
      y1="26"
      x2="32"
      y2="26"
      stroke={TEAL}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const NetworkIcon: React.FC = () => (
  <svg width="80" height="80" viewBox="0 0 80 80">
    <line x1="28" y1="32" x2="48" y2="20" stroke={TEAL} strokeWidth="3" />
    <line x1="28" y1="32" x2="56" y2="50" stroke={TEAL} strokeWidth="3" />
    <rect x="42" y="14" width="12" height="12" rx="1.5" fill={TEAL} />
    <rect x="22" y="26" width="12" height="12" rx="1.5" fill={TEAL} />
    <rect x="50" y="44" width="12" height="12" rx="1.5" fill={TEAL} />
  </svg>
);

const MoneyBagIcon: React.FC = () => (
  <svg width="70" height="70" viewBox="0 0 48 48">
    <path
      d="M18 12 Q20 9 24 9 Q28 9 30 12 L33 14 Q26 16 24 16 Q22 16 15 14 Z"
      fill={TEAL}
    />
    <path
      d="M16 16 Q12 22 12 30 Q12 40 24 42 Q36 40 36 30 Q36 22 32 16 Z"
      fill={TEAL}
    />
    <text
      x="24"
      y="33"
      textAnchor="middle"
      fill="#fff"
      fontSize="12"
      fontWeight="700"
      fontFamily="sans-serif"
    >
      $
    </text>
  </svg>
);

const AlertCircleIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 48 48">
    <circle
      cx="24"
      cy="24"
      r="18"
      fill="none"
      stroke={TEAL}
      strokeWidth="3"
    />
    <line
      x1="24"
      y1="14"
      x2="24"
      y2="26"
      stroke={TEAL}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <circle cx="24" cy="32" r="2" fill={TEAL} />
  </svg>
);

const BrainHeadIcon: React.FC<{ headOpacity: number; brainScale: number }> = ({
  headOpacity,
  brainScale,
}) => (
  <div
    style={{
      position: "relative",
      width: 320,
      height: 320,
      transform: `scale(${brainScale})`,
    }}
  >
    {/* Head silhouette behind brain */}
    <svg
      width="320"
      height="320"
      viewBox="0 0 320 320"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        opacity: headOpacity,
      }}
    >
      <path
        d="M 90 120
           Q 90 60 160 60
           Q 230 60 230 130
           Q 230 200 230 240
           L 230 280
           L 110 280
           Q 90 280 80 260
           L 70 230
           Q 60 200 60 175
           Q 60 150 80 140
           Q 90 130 90 120 Z"
        fill={TEAL}
      />
    </svg>
    {/* Brain outline overlaid on head */}
    <svg
      width="320"
      height="320"
      viewBox="0 0 320 320"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <path
        d="M 110 150
           Q 100 125 125 115
           Q 135 95 160 100
           Q 175 90 195 100
           Q 220 100 225 125
           Q 240 135 230 160
           Q 240 180 220 185
           L 120 185
           Q 100 180 110 150 Z"
        fill="#fff"
        stroke={TEAL}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M 160 105 L 160 185"
        stroke={TEAL}
        strokeWidth="3"
        opacity="0.7"
      />
      <path
        d="M 130 140 Q 140 150 155 145"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
      />
      <path
        d="M 165 145 Q 180 150 195 140"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
      />
      <path
        d="M 125 165 Q 140 170 155 165"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
      />
      <path
        d="M 165 165 Q 180 170 200 165"
        fill="none"
        stroke={TEAL}
        strokeWidth="3"
      />
    </svg>
  </div>
);

/* ── Helpers ─────────────────────────────────────────────── */

const useTypewriter = (text: string, startFrame: number, charsPerFrame = 0.9) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  return text.slice(0, charCount);
};

const TealWord: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: TEAL }}>{children}</span>
);

const FloatingIcon: React.FC<{
  x: number;
  y: number;
  opacity: number;
  scale: number;
  children: React.ReactNode;
}> = ({ x, y, opacity, scale, children }) => (
  <div
    style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%, -50%) scale(${scale})`,
      opacity,
    }}
  >
    {children}
  </div>
);

/* ── Main Scene ──────────────────────────────────────────── */

export const Scene02: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* Card morph: starts as pill (matching Scene01 end), expands to card */
  const cardWidthPct = interpolate(frame, [0, 12], [25, 84], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardHeightPct = interpolate(frame, [0, 12], [10, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardRadius = interpolate(frame, [0, 12], [40, 28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Card fade-out at end → blank white */
  const cardOpacity = interpolate(frame, [0, 4, 155, 165], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 1 (frames 9-22): "Thousands of trades" + candlestick center ── */
  const candleSpringFrame = Math.max(0, frame - 9);
  const candleScale = spring({
    frame: candleSpringFrame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 10,
  });

  /* Candlestick position: center → top-left */
  const candleX = interpolate(frame, [22, 30], [50, 28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const candleY = interpolate(frame, [22, 30], [42, 24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Trades text */
  const tradesText = useTypewriter("Thousands of trades", 14);
  const tradesOpacity = interpolate(frame, [14, 18, 30, 36], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 2 (frames 28-46): "Hundreds of agents" + AI circles center ── */
  const aiCircleSpringFrame = Math.max(0, frame - 28);
  const aiCircleScale = spring({
    frame: aiCircleSpringFrame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 10,
  });

  /* AI circles position: center → top-right */
  const aiX = interpolate(frame, [40, 48], [50, 72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const aiY = interpolate(frame, [40, 48], [42, 28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const agentsText = useTypewriter("Hundreds of agents", 32);
  const agentsOpacity = interpolate(frame, [32, 36, 48, 54], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 3 (frames 48-66): Patterns + network nodes ── */
  const networkSpringFrame = Math.max(0, frame - 48);
  const networkScale = spring({
    frame: networkSpringFrame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 10,
  });
  const networkOpacity = interpolate(frame, [48, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const patternsText = useTypewriter("Patterns", 50);
  const patternsOpacity = interpolate(frame, [50, 54, 64, 70], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 4 (frames 64-82): Timing + stopwatch ── */
  const stopwatchSpringFrame = Math.max(0, frame - 64);
  const stopwatchScale = spring({
    frame: stopwatchSpringFrame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 10,
  });
  const stopwatchOpacity = interpolate(frame, [64, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const timingText = useTypewriter("Timing", 68);
  const timingOpacity = interpolate(frame, [68, 72, 82, 88], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 5 (frames 82-104): Position Sizing + money bag ── */
  const moneySpringFrame = Math.max(0, frame - 86);
  const moneyScale = spring({
    frame: moneySpringFrame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 10,
  });
  const moneyOpacity = interpolate(frame, [86, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const positionOpacity = interpolate(frame, [84, 88, 102, 108], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sizingOpacity = interpolate(frame, [92, 96, 102, 108], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 6 (frames 102-128): Manipulation Signals + alert circle ── */
  const alertSpringFrame = Math.max(0, frame - 104);
  const alertScale = spring({
    frame: alertSpringFrame,
    fps,
    from: 0,
    to: 1,
    durationInFrames: 10,
  });
  const alertOpacity = interpolate(frame, [104, 108], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const manipulationOpacity = interpolate(
    frame,
    [102, 106, 128, 134],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const signalsOpacity = interpolate(frame, [114, 118, 128, 134], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ── Phase 7 (frames 128-160): Brain transition ── */
  /* Brain outline appears center f034 → frame 132. Head silhouette fills f035→f036 (frame ~138). */
  const brainOpacity = interpolate(frame, [128, 138], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brainSpringFrame = Math.max(0, frame - 128);
  const brainSpring = spring({
    frame: brainSpringFrame,
    fps,
    from: 0.5,
    to: 1,
    durationInFrames: 14,
  });

  /* Head fills in slightly after brain outline */
  const headOpacity = interpolate(frame, [136, 146], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* All scattered icons fade out as brain takes over */
  const iconsFadeOut = interpolate(frame, [128, 145], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Brain drifts down + shrinks at very end while card incinerates */
  const brainDriftY = interpolate(frame, [150, 165], [0, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brainEndOpacity = interpolate(frame, [160, 175], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const overallBrainOpacity = brainOpacity * brainEndOpacity;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Card (morphs from pill) */}
      <div
        style={{
          width: `${cardWidthPct}%`,
          height: `${cardHeightPct}%`,
          borderRadius: cardRadius,
          backgroundColor: "#fff",
          boxShadow: "0 12px 60px rgba(0,0,0,0.08)",
          opacity: cardOpacity,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* All accumulated icons — they NEVER disappear once placed */}
        <div style={{ opacity: iconsFadeOut, position: "absolute", inset: 0 }}>
          {/* Candlestick (center → TL) */}
          <FloatingIcon
            x={candleX}
            y={candleY}
            opacity={frame >= 9 ? 1 : 0}
            scale={candleScale}
          >
            <CandlestickIcon />
          </FloatingIcon>

          {/* AI model circles (center → TR) — three in a triangle */}
          <FloatingIcon
            x={aiX - 5}
            y={aiY + 3}
            opacity={frame >= 28 ? aiCircleScale : 0}
            scale={aiCircleScale}
          >
            <ModelCircle kind="sparkle" />
          </FloatingIcon>
          <FloatingIcon
            x={aiX}
            y={aiY - 5}
            opacity={frame >= 30 ? aiCircleScale : 0}
            scale={aiCircleScale}
          >
            <ModelCircle kind="openai" />
          </FloatingIcon>
          <FloatingIcon
            x={aiX + 5}
            y={aiY + 3}
            opacity={frame >= 32 ? aiCircleScale : 0}
            scale={aiCircleScale}
          >
            <ModelCircle kind="gemini" />
          </FloatingIcon>

          {/* Network nodes (bottom-left, fixed) */}
          <FloatingIcon x={28} y={64} opacity={networkOpacity} scale={networkScale}>
            <NetworkIcon />
          </FloatingIcon>

          {/* Stopwatch (top-center, fixed) */}
          <FloatingIcon x={50} y={22} opacity={stopwatchOpacity} scale={stopwatchScale}>
            <StopwatchIcon />
          </FloatingIcon>

          {/* Money bag (bottom-right, fixed) */}
          <FloatingIcon x={73} y={71} opacity={moneyOpacity} scale={moneyScale}>
            <MoneyBagIcon />
          </FloatingIcon>

          {/* Alert/exclamation (above text, fixed) */}
          <FloatingIcon x={50} y={37} opacity={alertOpacity} scale={alertScale}>
            <AlertCircleIcon />
          </FloatingIcon>
        </div>

        {/* Center text — single line, positioned slightly below card center */}
        <div
          style={{
            position: "absolute",
            top: "55%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            opacity: iconsFadeOut,
          }}
        >
          {/* Trades */}
          <div
            style={{
              position: "absolute",
              opacity: tradesOpacity,
              fontSize: 36,
              fontWeight: 700,
              color: TEXT_DARK,
              whiteSpace: "nowrap",
            }}
          >
            {tradesText.length <= "Thousands of ".length ? (
              tradesText
            ) : (
              <>
                Thousands of <TealWord>{tradesText.slice("Thousands of ".length)}</TealWord>
              </>
            )}
          </div>

          {/* Agents */}
          <div
            style={{
              position: "absolute",
              opacity: agentsOpacity,
              fontSize: 36,
              fontWeight: 700,
              color: TEXT_DARK,
              whiteSpace: "nowrap",
            }}
          >
            {agentsText.length <= "Hundreds of ".length ? (
              agentsText
            ) : (
              <>
                Hundreds of <TealWord>{agentsText.slice("Hundreds of ".length)}</TealWord>
              </>
            )}
          </div>

          {/* Patterns */}
          <div
            style={{
              position: "absolute",
              opacity: patternsOpacity,
              fontSize: 36,
              fontWeight: 700,
              color: TEXT_DARK,
              whiteSpace: "nowrap",
            }}
          >
            {patternsText}
          </div>

          {/* Timing */}
          <div
            style={{
              position: "absolute",
              opacity: timingOpacity,
              fontSize: 36,
              fontWeight: 700,
              color: TEXT_DARK,
              whiteSpace: "nowrap",
            }}
          >
            {timingText}
          </div>

          {/* Position Sizing */}
          <div
            style={{
              position: "absolute",
              fontSize: 36,
              fontWeight: 700,
              color: TEXT_DARK,
              whiteSpace: "nowrap",
              display: "flex",
              gap: 14,
            }}
          >
            <span style={{ opacity: positionOpacity }}>Position</span>
            <span style={{ opacity: sizingOpacity, color: "#888" }}>Sizing</span>
          </div>

          {/* Manipulation Signals */}
          <div
            style={{
              position: "absolute",
              fontSize: 36,
              fontWeight: 700,
              color: TEXT_DARK,
              whiteSpace: "nowrap",
              display: "flex",
              gap: 14,
            }}
          >
            <span style={{ opacity: manipulationOpacity }}>Manipulation</span>
            <span style={{ opacity: signalsOpacity, color: "#888" }}>Signals</span>
          </div>
        </div>

        {/* Brain + head silhouette */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, calc(-50% + ${brainDriftY}px)) scale(${brainSpring})`,
            opacity: overallBrainOpacity,
            zIndex: 5,
          }}
        >
          <BrainHeadIcon headOpacity={headOpacity} brainScale={1} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const scene02Meta = {
  id: "Council-Scene02",
  component: Scene02,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 183,
};
