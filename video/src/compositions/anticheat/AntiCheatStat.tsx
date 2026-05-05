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

// One figure → a crowd → the data. The crowd lingers as backing for the stat.
// Source: DeFi Oasis on-chain study of Polymarket trading, Dec 29 2025.
// 0.04% of addresses (~668 wallets) captured 70% of all realized profits — $3.7B.
// 70% of 1.7M trader addresses recorded losses; only 30% turned a profit.

const SCENE_SECONDS = 9.0;
const STAT_FROM = toFrames(2.4);
const STAT_DURATION = toFrames(4.0);
const CHIPS_FROM = toFrames(6.6);
const ALT_BLUE = "#4a9eff";

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <CandleBackdropTimed />
      <CrowdLayer />

      <Sequence
        from={STAT_FROM}
        durationInFrames={STAT_DURATION + toFrames(0.4)}
      >
        <StatPanel />
      </Sequence>

      <Sequence from={CHIPS_FROM}>
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

// ─── Candle backdrop, fades in as the crowd dims ──────────────────────────────

const CandleBackdropTimed: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(
    frame,
    [toFrames(1.8), toFrames(2.7)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <TradingBackdrop />
    </AbsoluteFill>
  );
};

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

// ─── The crowd: 51×51 = 2,601 figures. Center one is red. Dezoom 0–3s ─────────

const COLS = 51;
const ROWS = 51;
const SPACING = 18;
const CENTER_COL = 25;
const CENTER_ROW = 25;
const START_SCALE = 200;
const END_SCALE = 0.95;
const ZOOM_DURATION = toFrames(1.8);

const CrowdLayer: React.FC = () => {
  const frame = useCurrentFrame();

  const tRaw = Math.min(1, Math.max(0, frame / ZOOM_DURATION));
  const tEase = 0.5 - 0.5 * Math.cos(tRaw * Math.PI);
  const scale = START_SCALE * Math.pow(END_SCALE / START_SCALE, tEase);

  const vbW = W / scale;
  const vbH = H / scale;
  const vbX = -vbW / 2;
  const vbY = -vbH / 2;

  // Once the crowd is fully revealed, dim it so the stat sits clean on top.
  const dim = interpolate(
    frame,
    [toFrames(1.8), toFrames(2.7)],
    [1.0, 0.18],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Fade fully out as chips arrive.
  const out = interpolate(
    frame,
    [toFrames(6.2), toFrames(6.8)],
    [1.0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const layerOpacity = dim * out;

  const pulse = (Math.sin(frame * 0.14) + 1) / 2;
  const centerVis = interpolate(
    frame,
    [toFrames(1.5), toFrames(2.2)],
    [1, 0.7],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: layerOpacity, pointerEvents: "none" }}>
      <svg
        width={W}
        height={H}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <symbol id="figure" overflow="visible">
            <circle cx="0" cy="-4" r="2" />
            <path d="M -3,6 Q -3.5,1 -2,-1 L 2,-1 Q 3.5,1 3,6 Z" />
          </symbol>
        </defs>

        {/* The crowd — anonymous, gray, slightly varied */}
        {Array.from({ length: ROWS }).map((_, r) =>
          Array.from({ length: COLS }).map((_, c) => {
            if (r === CENTER_ROW && c === CENTER_COL) return null;
            const x = (c - CENTER_COL) * SPACING;
            const y = (r - CENTER_ROW) * SPACING;
            const seed = ((c * 97 + r * 31) % 100) / 100;
            const op = 0.5 + seed * 0.3;
            return (
              <use
                key={`${r}-${c}`}
                href="#figure"
                x={x}
                y={y}
                fill={colors.dim}
                opacity={op}
              />
            );
          }),
        )}

        {/* The one — red, pulsing while alone, dimmer once the crowd appears */}
        <g style={{ opacity: centerVis }}>
          <circle
            cx={0}
            cy={1}
            r={6 + pulse * 2}
            fill={colors.accent}
            opacity={0.22}
          />
          <use href="#figure" fill={colors.accent} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ─── Stat panel: 0.04% / arrow / 70% ──────────────────────────────────────────

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
  const left = (0.04 * eased).toFixed(2);
  const right = Math.round(70 * eased);

  // Arrow draws from frame 0.6s to 1.6s.
  const arrowT = interpolate(
    frame,
    [toFrames(0.6), toFrames(1.6)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // 67% (alt blue) appears 0.5s after the panel opens; the red cross
  // strikes 1s after the 0.04% number is fully readable.
  const altOpacity = interpolate(
    frame,
    [toFrames(1.0), toFrames(1.4)],
    [0, 0.95],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const crossT = interpolate(
    frame,
    [toFrames(1.5), toFrames(2.1)],
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
          fontSize: 40,
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
          alt={{ text: "67%", opacity: altOpacity, crossT }}
        />
      </div>

    </AbsoluteFill>
  );
};

const BigNumber: React.FC<{
  value: string;
  subtitle: string;
  tint: string;
  alt?: { text: string; opacity: number; crossT: number };
}> = ({ value, subtitle, tint, alt }) => {
  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      {alt && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 14,
            display: "inline-block",
            padding: "4px 18px",
            opacity: alt.opacity,
          }}
        >
          <span
            style={{
              fontFamily: font,
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: ALT_BLUE,
              fontVariantNumeric: "tabular-nums",
              textShadow: "0 2px 18px rgba(74,158,255,0.4)",
              display: "block",
              lineHeight: 1,
            }}
          >
            {alt.text}
          </span>
          <Cross t={alt.crossT} />
        </div>
      )}
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
          marginTop: 22,
          fontFamily: monoFont,
          fontSize: 36,
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

// Two diagonal strokes, drawn in sequence, that strike through the alt number.
const Cross: React.FC<{ t: number }> = ({ t }) => {
  const t1 = Math.min(1, Math.max(0, t * 1.8));
  const t2 = Math.min(1, Math.max(0, (t - 0.45) * 1.8));
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <line
        x1={4}
        y1={18}
        x2={96}
        y2={82}
        stroke={colors.accent}
        strokeWidth={6}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - t1}
      />
      <line
        x1={96}
        y1={18}
        x2={4}
        y2={82}
        stroke={colors.accent}
        strokeWidth={6}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - t2}
      />
    </svg>
  );
};

const ArrowFlow: React.FC<{ t: number }> = ({ t }) => {
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
          fontSize: 40,
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
        <span style={{ color: colors.accent }}>nearly none</span>
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
