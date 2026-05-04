import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

const SCENE_SECONDS = 5;
const CHIPS_AT = toFrames(2.5);
const WSJ_CHART = staticFile("anticheat-imgs/polymarket-chart.png");

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <TradingBackdrop />
      <WsjChartLayer />
      <StatPanel />
      <ChipsPanel />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <SourceCaption />
    </AbsoluteFill>
  );
};

// ─── WSJ chart background layer — sits behind numbers, in front of grid ──────

const WsjChartLayer: React.FC = () => {
  const frame = useCurrentFrame();
  // Same fade-out as the StatPanel: lives until CHIPS_AT then dies fast,
  // so it never fights the chips.
  const fadeIn = interpolate(
    frame,
    [0, toFrames(0.5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const fadeOut = interpolate(
    frame,
    [CHIPS_AT - 6, CHIPS_AT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = 0.16 * fadeIn * fadeOut;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "40%",
        pointerEvents: "none",
        opacity,
      }}
    >
      <img
        src={WSJ_CHART}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: "saturate(0.4)",
        }}
      />
    </div>
  );
};

// ─── Tiny attribution at the bottom-right ─────────────────────────────────────

const SourceCaption: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity =
    interpolate(
      frame,
      [toFrames(0.4), toFrames(0.9)],
      [0, 0.5],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    ) *
    interpolate(
      frame,
      [CHIPS_AT - 6, CHIPS_AT],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

  return (
    <div
      style={{
        position: "absolute",
        right: 32,
        bottom: 32,
        fontFamily: monoFont,
        fontSize: 16,
        color: colors.dim,
        letterSpacing: "0.04em",
        opacity,
        pointerEvents: "none",
      }}
    >
      Source: WSJ analysis of Polymarket data
    </div>
  );
};

// ─── Beat 1 (0.0s): "0.01% claim 70%" — numbers slam in at final value ──────

const StatPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Whole panel snaps in over 0.18s — opacity + lift, single move.
  const enterOpacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const enterY = interpolate(
    frame,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Hard exit: at CHIPS_AT, kill the panel in 6 frames.
  const exit = interpolate(
    frame,
    [CHIPS_AT - 6, CHIPS_AT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = enterOpacity * exit;

  // 70% — single scale punch on the hero number.
  const punch = spring({
    frame: frame - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const heroScale =
    1 +
    Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06;

  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${enterY}px)` }}>
      <div
        style={{
          position: "absolute",
          top: "18%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
        }}
      >
        Cheaters → Profits
      </div>

      <div
        style={{
          position: "absolute",
          top: "32%",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 72,
          padding: "0 96px",
        }}
      >
        <BigNumber value="0.01%" subtitle="of traders" tint={colors.fg} />
        <ArrowFlow />
        <BigNumber
          value="70%"
          subtitle="of all profits"
          tint={colors.accent}
          scale={heroScale}
        />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "20%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 44,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: colors.fg,
          opacity: 0.92,
        }}
      >
        0.01% of cheaters claim 70% of all profits.
      </div>
    </AbsoluteFill>
  );
};

const BigNumber: React.FC<{
  value: string;
  subtitle: string;
  tint: string;
  scale?: number;
}> = ({ value, subtitle, tint, scale = 1 }) => {
  // Numbers slam in: scale 0.6→1 over 0.32s with overshoot, opacity over 0.15s.
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({
    frame,
    fps,
    config: { damping: 11, stiffness: 200, mass: 0.7 },
  });
  const slamScale = interpolate(slam, [0, 1], [0.6, 1.0]);
  const slamOpacity = interpolate(
    frame,
    [0, toFrames(0.15)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div style={{ textAlign: "center", opacity: slamOpacity }}>
      <div
        style={{
          fontFamily: font,
          fontSize: 240,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: tint,
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          fontVariantNumeric: "tabular-nums",
          transform: `scale(${slamScale * scale})`,
          transformOrigin: "center",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: monoFont,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

const ArrowFlow: React.FC = () => {
  const length = 220;
  return (
    <svg width={length + 40} height={120} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="arrow-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colors.dim} stopOpacity={0.6} />
          <stop offset="100%" stopColor={colors.accent} stopOpacity={1} />
        </linearGradient>
      </defs>
      <line
        x1={0}
        y1={60}
        x2={length}
        y2={60}
        stroke="url(#arrow-grad)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line
        x1={length - 14}
        y1={60 - 14}
        x2={length}
        y2={60}
        stroke={colors.accent}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <line
        x1={length - 14}
        y1={60 + 14}
        x2={length}
        y2={60}
        stroke={colors.accent}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
};

// ─── Beat 2 (2.5s): four chips snap in together + tagline ─────────────────────

const CHIPS = ["Perps", "Options", "Predictions", "Launchpads"] as const;

const ChipsPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < CHIPS_AT) return null;
  const local = frame - CHIPS_AT;

  // All four chips arrive together — phrase, not cascade.
  const chipsOpacity = interpolate(
    local,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const chipsY = interpolate(
    local,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const taglineOpacity = interpolate(
    local,
    [toFrames(0.5), toFrames(0.8)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const taglineY = interpolate(
    local,
    [toFrames(0.5), toFrames(0.8)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Spring punch on the chips block once.
  const punch = spring({
    frame: local,
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const punchScale = 1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.04;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          opacity: chipsOpacity,
        }}
      >
        Every market they touch
      </div>

      <div
        style={{
          position: "absolute",
          top: "40%",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          padding: "0 96px",
          flexWrap: "wrap",
          opacity: chipsOpacity,
          transform: `translateY(${chipsY}px) scale(${punchScale})`,
        }}
      >
        {CHIPS.map((label) => (
          <div
            key={label}
            style={{
              fontFamily: monoFont,
              fontSize: 56,
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: colors.fg,
              padding: "22px 38px",
              border: `1px solid ${colors.accent}`,
              borderRadius: 4,
              backgroundColor: "rgba(255,59,59,0.04)",
              boxShadow:
                "0 0 0 1px rgba(255,59,59,0.08), 0 8px 32px rgba(0,0,0,0.45)",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "20%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: colors.fg,
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
        }}
      >
        Leaving you with{" "}
        <span style={{ color: colors.accent }}>nearly none</span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Backdrop with quiet ambient pulse ────────────────────────────────────────

const TradingBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  // Sin-wave breathing 0.10 → 0.18 → 0.10 over ~1.5s (45f).
  const pulse = 0.14 + Math.sin((frame / 45) * Math.PI * 2) * 0.04;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, opacity: 0.4 + pulse }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            x2={W}
            y1={(i + 1) * (H / 13)}
            y2={(i + 1) * (H / 13)}
            stroke="#16161b"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={(i + 1) * (W / 19)}
            x2={(i + 1) * (W / 19)}
            y1={0}
            y2={H}
            stroke="#13131a"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 60 }).map((_, i) => {
          const seedA = pseudo(i * 1.31 + frame * 0.01);
          const seedB = pseudo(i * 0.77 + 9.1);
          const cx = (i / 60) * W + (i % 2 === 0 ? 6 : -3);
          const cy = H * 0.42 + Math.sin(i * 0.41 + frame * 0.012) * 90;
          const len = 60 + seedA * 110;
          const w = 12;
          const isUp = seedB > 0.5;
          const fill = isUp ? "#1c2a22" : "#2a1a1c";
          const stroke = isUp ? "#1f3a2a" : "#3a1f22";
          return (
            <g key={i} opacity={0.55}>
              <line
                x1={cx + w / 2}
                x2={cx + w / 2}
                y1={cy - len * 0.7}
                y2={cy + len * 0.7}
                stroke={stroke}
                strokeWidth={1.2}
              />
              <rect
                x={cx}
                y={cy - len / 2}
                width={w}
                height={len}
                fill={fill}
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

function pseudo(seed: number): number {
  const v = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
  return v < 0 ? v + 1 : v;
}

export const antiCheatStatMeta = {
  id: "AntiCheatStat",
  component: AntiCheatStat,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
