import React, { useMemo } from "react";
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
import { font } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { BRAND_GREEN, FPS, PANEL } from "../theme";

// ---------------------------------------------------------------------------
// Timing — all in LOCAL frames (frame 0 = 48.64s in video)
// ---------------------------------------------------------------------------
const SEC = FPS; // 30 frames per second

const T = {
  qCardIn: 0,
  qCardHold: 8 * SEC, // Q card fades out by ~8s local
  gridIn: Math.round(9.12 * SEC), // 274 — 57.76s video
  dotsFlash: Math.round(11 * SEC), // ALL dots light up simultaneously
  mandatoryFill: Math.round(18.8 * SEC), // 564 — 67.44s video
  fadeStart: Math.round(36.16 * SEC), // 1085 — 84.80s video
  fadeEnd: Math.round(41.2 * SEC), // 1236 — 89.84s video
} as const;

// ---------------------------------------------------------------------------
// Dot grid constants
// ---------------------------------------------------------------------------
const GRID_COLS = 20;
const GRID_ROWS = 10;
const DOT_SIZE = 6;
const DOT_GAP = 4;
const INACTIVE_COLOR = "#333";

// Mulberry32 — deterministic PRNG for per-dot pulse phase offset
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DotData {
  col: number;
  row: number;
  phase: number;
}

function buildDots(): DotData[] {
  const rng = mulberry32(42);
  const dots: DotData[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      dots.push({ col: c, row: r, phase: rng() * Math.PI * 2 });
    }
  }
  return dots;
}

// ---------------------------------------------------------------------------
// DotGrid — 200 dots, inactive grey → active green with pulse
// ---------------------------------------------------------------------------
const DotGrid: React.FC<{
  activeT: number; // 0 = grey, 1 = fully green
  pulseTime: number;
}> = ({ activeT, pulseTime }) => {
  const dots = useMemo(() => buildDots(), []);
  const gridW = GRID_COLS * (DOT_SIZE + DOT_GAP);
  const gridH = GRID_ROWS * (DOT_SIZE + DOT_GAP);

  return (
    <div style={{ position: "relative", width: gridW, height: gridH }}>
      {dots.map((d, i) => {
        const isLit = activeT > 0;
        const pulse = isLit
          ? 1 + Math.sin(d.phase + pulseTime * 2.5) * 0.25 * activeT
          : 1;

        // Interpolate color from grey to green
        const r = Math.round(0x33 + (0x00 - 0x33) * activeT);
        const g = Math.round(0x33 + (0xc8 - 0x33) * activeT);
        const b = Math.round(0x33 + (0x53 - 0x33) * activeT);
        const color = `rgb(${r},${g},${b})`;

        const glowStrength = 4 * pulse * activeT;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.col * (DOT_SIZE + DOT_GAP),
              top: d.row * (DOT_SIZE + DOT_GAP),
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: color,
              transform: `scale(${pulse})`,
              boxShadow:
                glowStrength > 0.1
                  ? `0 0 ${glowStrength}px ${BRAND_GREEN}80`
                  : "none",
            }}
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Traditional comparison — single dot lit, the rest grey
// ---------------------------------------------------------------------------
const TraditionalDiagram: React.FC<{ opacity: number }> = ({ opacity }) => {
  const dotCount = 8;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        opacity,
      }}
    >
      <span
        style={{
          fontFamily: font,
          fontWeight: 600,
          fontSize: 16,
          color: "#888",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        Traditional: pick one
      </span>

      <div style={{ display: "flex", gap: DOT_GAP, alignItems: "center" }}>
        {Array.from({ length: dotCount }).map((_, i) => (
          <div
            key={i}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: i === 0 ? "#ef4444" : INACTIVE_COLOR,
              boxShadow: i === 0 ? "0 0 6px #ef444480" : "none",
            }}
          />
        ))}
      </div>

      {/* Arrow pointing to the single lit dot */}
      <svg width={80} height={30} style={{ marginTop: -6 }}>
        <defs>
          <marker
            id="arrowRed"
            markerWidth={6}
            markerHeight={6}
            refX={5}
            refY={3}
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
          </marker>
        </defs>
        <line
          x1={40}
          y1={0}
          x2={5}
          y2={28}
          stroke="#ef4444"
          strokeWidth={1.5}
          markerEnd="url(#arrowRed)"
        />
      </svg>

      <span
        style={{
          fontFamily: font,
          fontWeight: 600,
          fontSize: 14,
          color: "#666",
        }}
      >
        TRADER
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const LiquidityDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  // --- Q card entrance (spring from bottom) ---
  const qSlide = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });
  const qOpacity = interpolate(
    frame,
    [T.qCardHold, T.qCardHold + 15],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // --- Dark backdrop panel fade-in ---
  const panelOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // --- Grid entrance ---
  const gridIn = spring({
    frame: frame - T.gridIn,
    fps,
    config: { damping: 20, stiffness: 100, mass: 1 },
  });

  // --- Dots activation: smooth 0→1 over 8 frames ---
  const dotsActiveT = interpolate(
    frame,
    [T.dotsFlash, T.dotsFlash + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // --- "Mandatory fill" label entrance ---
  const mfSpring = spring({
    frame: frame - T.mandatoryFill,
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.7 },
  });

  // --- Global fade out ---
  const fadeOut = interpolate(
    frame,
    [T.fadeStart, T.fadeEnd],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE.smooth,
    },
  );

  // Pulse time starts counting from the flash moment
  const pulseTime = dotsActiveT > 0 ? time - T.dotsFlash / fps : 0;

  // "Every trader bets on EVERY streamer" label visibility
  const everyLabel = interpolate(
    frame,
    [T.dotsFlash + 4, T.dotsFlash + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Dark backdrop panel — center 70%, talking head visible at edges */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          opacity: panelOpacity,
        }}
      >
        <div
          style={{
            width: "70%",
            height: "80%",
            ...PANEL,
          }}
        />
      </AbsoluteFill>

      {/* ---- Q Card ---- */}
      {frame < T.qCardHold + 20 && (
        <AbsoluteFill
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: qOpacity,
          }}
        >
          <div
            style={{
              transform: `translateY(${interpolate(qSlide, [0, 1], [120, 0])}px)`,
              fontFamily: font,
              fontWeight: 800,
              fontSize: 44,
              color: "#fafafa",
              textAlign: "center",
              maxWidth: 900,
              lineHeight: 1.3,
              textShadow: "0 2px 20px rgba(0,0,0,0.6)",
            }}
          >
            How does GM ensure liquidity
            <br />
            on 500,000 markets?
          </div>
        </AbsoluteFill>
      )}

      {/* ---- Batch grid ---- */}
      {frame >= T.gridIn && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: gridIn,
          }}
        >
          {/* Header label */}
          <span
            style={{
              fontFamily: font,
              fontWeight: 600,
              fontSize: 24,
              color: "#fafafa",
              marginBottom: 16,
              letterSpacing: 1,
            }}
          >
            5,000 Twitch Streamers
          </span>

          {/* Grid + traditional side by side */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 60,
            }}
          >
            {/* GM grid column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <DotGrid activeT={dotsActiveT} pulseTime={pulseTime} />

              {/* Below-grid label */}
              <span
                style={{
                  fontFamily: font,
                  fontWeight: 600,
                  fontSize: 18,
                  color: BRAND_GREEN,
                  marginTop: 8,
                  opacity: everyLabel,
                }}
              >
                Every trader bets on EVERY streamer
              </span>
            </div>

            {/* Vertical divider */}
            <div
              style={{
                width: 1,
                height: 120,
                backgroundColor: "#444",
              }}
            />

            {/* Traditional comparison */}
            <TraditionalDiagram opacity={1} />
          </div>
        </AbsoluteFill>
      )}

      {/* ---- "Mandatory fill" label ---- */}
      {frame >= T.mandatoryFill && (
        <AbsoluteFill
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            paddingBottom: 140,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              transform: `scale(${mfSpring})`,
              opacity: mfSpring,
            }}
          >
            {/* Animated checkmark */}
            <svg width={36} height={36} viewBox="0 0 36 36">
              <circle
                cx={18}
                cy={18}
                r={16}
                fill={BRAND_GREEN}
                opacity={0.15}
              />
              <path
                d="M10 18 L16 24 L26 12"
                stroke={BRAND_GREEN}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={30}
                strokeDashoffset={interpolate(mfSpring, [0, 1], [30, 0])}
              />
            </svg>

            <span
              style={{
                fontFamily: font,
                fontWeight: 900,
                fontSize: 48,
                color: BRAND_GREEN,
                textShadow: `0 0 30px ${BRAND_GREEN}40`,
              }}
            >
              Mandatory fill = guaranteed liquidity
            </span>
          </div>
        </AbsoluteFill>
      )}

      {/* ---- SFX ---- */}
      {/* Q card whoosh — plays at frame 0 (local) */}
      <Sequence from={0} durationInFrames={SEC * 2}>
        <Audio
          src={staticFile("sfx/whoosh-scene-grid.mp3")}
          volume={0.7}
        />
      </Sequence>

      {/* Dots lighting up */}
      <Sequence from={T.dotsFlash} durationInFrames={SEC * 3}>
        <Audio
          src={staticFile("sfx/metric-count-up.mp3")}
          volume={0.5}
        />
      </Sequence>

      {/* Mandatory fill latch */}
      <Sequence from={T.mandatoryFill} durationInFrames={SEC * 2}>
        <Audio
          src={staticFile("sfx/metal-latch-unlock.mp3")}
          volume={0.6}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
