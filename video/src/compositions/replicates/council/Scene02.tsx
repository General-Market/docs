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

/* ── Inline SVG Icons ───────────────────────────────────── */

const CandlestickIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 48 48">
    <rect x="10" y="8" width="6" height="32" rx="1" fill={TEAL} />
    <line x1="13" y1="4" x2="13" y2="8" stroke={TEAL} strokeWidth="2" />
    <line x1="13" y1="40" x2="13" y2="44" stroke={TEAL} strokeWidth="2" />
    <rect x="21" y="14" width="6" height="20" rx="1" fill={TEAL} />
    <line x1="24" y1="10" x2="24" y2="14" stroke={TEAL} strokeWidth="2" />
    <line x1="24" y1="34" x2="24" y2="38" stroke={TEAL} strokeWidth="2" />
    <rect x="32" y="10" width="6" height="28" rx="1" fill={TEAL} />
    <line x1="35" y1="6" x2="35" y2="10" stroke={TEAL} strokeWidth="2" />
    <line x1="35" y1="38" x2="35" y2="42" stroke={TEAL} strokeWidth="2" />
  </svg>
);

const AgentIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="16" fill="none" stroke={TEAL} strokeWidth="2" />
    <circle cx="20" cy="16" r="5" fill={TEAL} />
    <path d="M10 32 Q20 24 30 32" fill={TEAL} opacity="0.6" />
  </svg>
);

const StopwatchIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="22" r="14" fill="none" stroke={TEAL} strokeWidth="2" />
    <line x1="20" y1="22" x2="20" y2="13" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="20" y1="22" x2="27" y2="22" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
    <rect x="17" y="4" width="6" height="4" rx="1" fill={TEAL} />
  </svg>
);

const MoneyBagIcon: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 40 40">
    <path d="M14 16 Q20 8 26 16 Q32 28 26 34 L14 34 Q8 28 14 16Z" fill={TEAL} opacity="0.8" />
    <text x="20" y="28" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">$</text>
  </svg>
);

const NetworkIcon: React.FC = () => (
  <svg width="44" height="44" viewBox="0 0 44 44">
    <circle cx="22" cy="10" r="4" fill={TEAL} />
    <circle cx="10" cy="34" r="4" fill={TEAL} />
    <circle cx="34" cy="34" r="4" fill={TEAL} />
    <circle cx="36" cy="16" r="3" fill={TEAL} opacity="0.5" />
    <line x1="22" y1="14" x2="10" y2="30" stroke={TEAL} strokeWidth="1.5" />
    <line x1="22" y1="14" x2="34" y2="30" stroke={TEAL} strokeWidth="1.5" />
    <line x1="10" y1="34" x2="34" y2="34" stroke={TEAL} strokeWidth="1.5" />
    <line x1="22" y1="10" x2="36" y2="16" stroke={TEAL} strokeWidth="1" opacity="0.5" />
  </svg>
);

const BrainIcon: React.FC = () => (
  <div style={{ position: "relative", width: 250, height: 250 }}>
    {/* Head silhouette behind brain */}
    <svg
      width="250"
      height="250"
      viewBox="0 0 250 250"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <ellipse cx="125" cy="120" rx="90" ry="105" fill={TEAL} opacity="0.08" />
      <ellipse cx="125" cy="210" rx="50" ry="30" fill={TEAL} opacity="0.06" />
    </svg>
    {/* Brain lines */}
    <svg
      width="250"
      height="250"
      viewBox="0 0 80 80"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <path
        d="M40 12 C28 12 18 22 18 34 C18 38 20 42 22 44 C18 48 16 54 18 60 C20 66 26 70 34 70 L40 70"
        fill="none"
        stroke={TEAL}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M40 12 C52 12 62 22 62 34 C62 38 60 42 58 44 C62 48 64 54 62 60 C60 66 54 70 46 70 L40 70"
        fill="none"
        stroke={TEAL}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M40 12 L40 70" stroke={TEAL} strokeWidth="1.5" opacity="0.4" />
      <path d="M24 36 Q32 40 40 36" fill="none" stroke={TEAL} strokeWidth="1.5" opacity="0.5" />
      <path d="M40 36 Q48 40 56 36" fill="none" stroke={TEAL} strokeWidth="1.5" opacity="0.5" />
      <path d="M22 50 Q31 46 40 50" fill="none" stroke={TEAL} strokeWidth="1.5" opacity="0.5" />
      <path d="M40 50 Q49 46 58 50" fill="none" stroke={TEAL} strokeWidth="1.5" opacity="0.5" />
    </svg>
  </div>
);

/* ── Helpers ─────────────────────────────────────────────── */

const useTypewriter = (text: string, startFrame: number, charsPerFrame = 0.6) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  return text.slice(0, charCount);
};

const TealWord: React.FC<{ children: string }> = ({ children }) => (
  <span style={{ color: TEAL }}>{children}</span>
);

/* ── Positioned icon wrapper ─────────────────────────────── */

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
      transition: "none",
    }}
  >
    {children}
  </div>
);

/* ── Main Scene ──────────────────────────────────────────── */

export const Scene02: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card scale in (0-15)
  const cardScale = spring({ frame, fps, from: 0.8, to: 1, durationInFrames: 15 });
  const cardOpacity = interpolate(frame, [0, 5, 260, 270], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 1 (15-53): "Thousands of trades" + candlestick — hold 30 frames
  const tradesText = useTypewriter("Thousands of trades", 18, 0.7);
  const tradesOpacity = interpolate(frame, [15, 18, 45, 53], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const candleScale = spring({ frame: Math.max(0, frame - 15), fps, from: 0, to: 1, durationInFrames: 15 });
  const candleOpacity = interpolate(frame, [15, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Candlestick drifts to top-left (53+)
  const candleX = interpolate(frame, [53, 73], [50, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const candleY = interpolate(frame, [53, 73], [35, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2 (53-88): "Hundreds of agents" + agent icons — hold 30 frames
  const agentsText = useTypewriter("Hundreds of agents", 56, 0.7);
  const agentsOpacity = interpolate(frame, [53, 56, 80, 88], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const agentScale = spring({ frame: Math.max(0, frame - 58), fps, from: 0, to: 1, durationInFrames: 15 });

  // Agents drift to top-right (88+)
  const agentBaseX = interpolate(frame, [88, 108], [50, 78], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const agentBaseY = interpolate(frame, [88, 108], [35, 22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3 (88-170): Cycling center text — stretched phases
  const patternsOpacity = interpolate(frame, [88, 91, 111, 115], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const timingOpacity = interpolate(frame, [115, 118, 138, 142], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const manipulationOpacity = interpolate(frame, [142, 145, 165, 170], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const signalsOpacity = interpolate(frame, [152, 155, 165, 170], [0, 0.65, 0.65, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Stopwatch icon (timing phase)
  const stopwatchScale = spring({ frame: Math.max(0, frame - 115), fps, from: 0, to: 1, durationInFrames: 12 });
  const stopwatchOpacity = interpolate(frame, [115, 118, 138, 142], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Money bag icon (manipulation phase)
  const moneyScale = spring({ frame: Math.max(0, frame - 142), fps, from: 0, to: 1, durationInFrames: 12 });
  const moneyOpacity = interpolate(frame, [142, 145, 165, 170], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Network icon appears bottom-left (frame 100+)
  const networkScale = spring({ frame: Math.max(0, frame - 100), fps, from: 0, to: 1, durationInFrames: 15 });
  const networkOpacity = interpolate(frame, [100, 103, 160, 170], [0, 1, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 4 (170-210): All icons scattered, then fade out, brain fades in
  const scatteredIconsOpacity = interpolate(frame, [170, 180, 195, 210], [1, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brainOpacity = interpolate(frame, [195, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 5 (215-270): Brain pulse — extended hold
  const brainPulse = interpolate(
    Math.sin((frame - 215) * 0.15),
    [-1, 1],
    [0.95, 1.05],
  );
  const brainScale = frame >= 215 ? brainPulse : 1;

  // Determine center text phase
  const renderCenterText = () => {
    if (frame < 53) {
      return (
        <div style={{ opacity: tradesOpacity, fontSize: 36, fontWeight: 700, color: "#333", textAlign: "center" }}>
          {tradesText.includes("trades") ? (
            <>
              {tradesText.split("trades")[0]}
              <TealWord>trades</TealWord>
            </>
          ) : (
            tradesText
          )}
        </div>
      );
    }
    if (frame < 88) {
      return (
        <div style={{ opacity: agentsOpacity, fontSize: 36, fontWeight: 700, color: "#333", textAlign: "center" }}>
          {agentsText.includes("agents") ? (
            <>
              {agentsText.split("agents")[0]}
              <TealWord>agents</TealWord>
            </>
          ) : (
            agentsText
          )}
        </div>
      );
    }
    if (frame < 170) {
      return (
        <>
          <div style={{ opacity: patternsOpacity, position: "absolute", fontSize: 36, fontWeight: 700, color: "#333" }}>
            <TealWord>Patterns</TealWord>
          </div>
          <div style={{ opacity: timingOpacity, position: "absolute", fontSize: 36, fontWeight: 700, color: "#333" }}>
            <TealWord>Timing</TealWord>
          </div>
          <div style={{ opacity: manipulationOpacity, position: "absolute", fontSize: 36, fontWeight: 700, color: "#333", display: "flex", gap: 10 }}>
            <TealWord>Manipulation</TealWord>
            <span style={{ opacity: signalsOpacity, color: TEAL }}>Signals</span>
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Card */}
      <div
        style={{
          width: "75%",
          height: "65%",
          borderRadius: 24,
          backgroundColor: "#fff",
          boxShadow: "0 12px 60px rgba(0,0,0,0.08)",
          transform: `scale(${cardScale})`,
          opacity: cardOpacity,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Scattered icons layer */}
        <div style={{ opacity: scatteredIconsOpacity }}>
          {/* Candlestick */}
          <FloatingIcon x={candleX} y={candleY} opacity={candleOpacity} scale={candleScale}>
            <CandlestickIcon />
          </FloatingIcon>

          {/* Agent icons */}
          <FloatingIcon x={agentBaseX - 6} y={agentBaseY} opacity={frame >= 58 ? 1 : 0} scale={agentScale}>
            <AgentIcon />
          </FloatingIcon>
          <FloatingIcon x={agentBaseX} y={agentBaseY - 8} opacity={frame >= 61 ? 1 : 0} scale={agentScale}>
            <AgentIcon />
          </FloatingIcon>
          <FloatingIcon x={agentBaseX + 6} y={agentBaseY + 2} opacity={frame >= 64 ? 1 : 0} scale={agentScale}>
            <AgentIcon />
          </FloatingIcon>

          {/* Stopwatch (timing phase) */}
          <FloatingIcon x={50} y={25} opacity={stopwatchOpacity} scale={stopwatchScale}>
            <StopwatchIcon />
          </FloatingIcon>

          {/* Money bag (position sizing phase) */}
          <FloatingIcon x={50} y={25} opacity={moneyOpacity} scale={moneyScale}>
            <MoneyBagIcon />
          </FloatingIcon>

          {/* Network nodes bottom-left */}
          <FloatingIcon x={22} y={75} opacity={networkOpacity} scale={networkScale}>
            <NetworkIcon />
          </FloatingIcon>
        </div>

        {/* Center text */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          {renderCenterText()}
        </div>

        {/* Brain */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${brainScale})`,
            opacity: brainOpacity,
            zIndex: 3,
          }}
        >
          <BrainIcon />
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
  durationInFrames: 280,
};
