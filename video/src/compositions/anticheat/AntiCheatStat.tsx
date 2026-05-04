import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

const SCENE_SECONDS = 10;
const STAT_DURATION = toFrames(5);

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <TradingBackdrop />

      <Sequence from={0} durationInFrames={STAT_DURATION + toFrames(0.4)}>
        <StatPanel />
      </Sequence>

      <Sequence from={STAT_DURATION}>
        <ChipsPanel />
      </Sequence>

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Faint trading-screen background (grid + candle silhouettes) ──────────────

const TradingBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
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
        style={{ position: "absolute", inset: 0, opacity: 0.55 }}
      >
        {/* Grid */}
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
        {/* Candle silhouettes */}
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

// ─── Stat panel: 0.01% / arrow / 70% ──────────────────────────────────────────

const StatPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const exit = spring({
    frame: frame - (STAT_DURATION - toFrames(0.4)),
    fps,
    config: { damping: 28, stiffness: 140, mass: 0.6 },
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]) * (1 - exit);

  // Counters — count up over the first 1.6s.
  const countT = Math.min(1, Math.max(0, frame / toFrames(1.6)));
  const eased = 1 - Math.pow(1 - countT, 3);
  const left = (0.01 * eased).toFixed(2);
  const right = Math.round(70 * eased);

  // Arrow draws from frame 0.6s to 1.6s.
  const arrowT = interpolate(
    frame,
    [toFrames(0.6), toFrames(1.6)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Eyebrow label */}
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

      {/* Big numbers row */}
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
        <BigNumber value={`${left}%`} subtitle="of traders" tint={colors.fg} />
        <ArrowFlow t={arrowT} />
        <BigNumber
          value={`${right}%`}
          subtitle="of all profits"
          tint={colors.accent}
        />
      </div>

      {/* Sub-line */}
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
          opacity: interpolate(
            frame,
            [toFrames(2.0), toFrames(2.6)],
            [0, 0.92],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
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
}> = ({ value, subtitle, tint }) => {
  return (
    <div style={{ textAlign: "center" }}>
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

const ArrowFlow: React.FC<{ t: number }> = ({ t }) => {
  // The arrow draws from left to right.
  const length = 220;
  const drawn = Math.max(0, Math.min(length, length * t));
  const headOpacity = t > 0.92 ? 1 : 0;
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
        x2={drawn}
        y2={60}
        stroke="url(#arrow-grad)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <g opacity={headOpacity}>
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
      </g>
    </svg>
  );
};

// ─── Chips panel: PERPS · OPTIONS · PREDICTIONS · LAUNCHPADS ──────────────────

const CHIPS = ["Perps", "Options", "Predictions", "Launchpads"] as const;

const ChipsPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
        }}
      >
        {CHIPS.map((label, i) => {
          const at = toFrames(0.18 * i + 0.05);
          const t = spring({
            frame: frame - at,
            fps,
            config: { damping: 14, stiffness: 220, mass: 0.55 },
          });
          const y = interpolate(t, [0, 1], [-46, 0]);
          const opacity = interpolate(t, [0, 1], [0, 1]);
          const scale = interpolate(t, [0, 1], [0.92, 1]);
          return (
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
                opacity,
                transform: `translateY(${y}px) scale(${scale})`,
              }}
            >
              {label}
            </div>
          );
        })}
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
          opacity: interpolate(
            frame,
            [toFrames(1.4), toFrames(2.0)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
          transform: `translateY(${interpolate(
            frame,
            [toFrames(1.4), toFrames(2.0)],
            [16, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )}px)`,
        }}
      >
        Leaving you with{" "}
        <span style={{ color: colors.accent }}>nearly none.</span>
      </div>
    </AbsoluteFill>
  );
};

// ─── Deterministic noise (lifted from the hook) ───────────────────────────────

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
