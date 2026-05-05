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

const SCENE_SECONDS = 7.5;
const STAT_DURATION = toFrames(4);

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <Sequence from={0} durationInFrames={STAT_DURATION + toFrames(0.4)}>
        <StatPanel />
      </Sequence>

      <Sequence from={STAT_DURATION}>
        <ExtractionBars />
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
          fontSize: 60,
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

// ─── Extraction bars: % of each market extracted by unfair trading ────────────
//
// Percentages sourced from local research:
//   perps        — 80%  bot/algo share of volume (Hyperliquid 90%+, Coinbase
//                       79–82% institutional; bot-activity-verified.md)
//   options      — 90%  retail options traders lose money — TastyTrade dataset,
//                       widely cited; reinforced by 80%+ Robinhood orders
//                       routed to Citadel/Virtu/G1 (bot-activity-verified.md)
//   predictions  — 71%  Polymarket: 668 wallets captured 71% of all profits
//                       (Reichenbach-Walther 2025 / 70_PERCENT_STUDY §16)
//   launchpads   — 87%  Pump.fun: 87% of sniper-bot trades profitable —
//                       humans are exit liquidity (BeInCrypto / Dune)
//
// Bars scale to the largest figure. Each bar grows left-to-right, the
// percentage zoom-echoes in as the bar lands.

type Bar = {
  label: string;
  value: number; // percentage
  displayValue: string;
};

const BARS: Bar[] = [
  { label: "perps", value: 80, displayValue: "80%" },
  { label: "options", value: 90, displayValue: "90%" },
  { label: "predictions", value: 71, displayValue: "71%" },
  { label: "launchpads", value: 87, displayValue: "87%" },
];

const MAX_VALUE = Math.max(...BARS.map((b) => b.value));
const BAR_STAGGER = toFrames(0.32);
const BAR_GROW = toFrames(0.55);
const REVEAL_AT =
  BAR_STAGGER * (BARS.length - 1) + BAR_GROW + toFrames(0.4);

const ExtractionBars: React.FC = () => {
  const frame = useCurrentFrame();

  // Eyebrow fades in immediately.
  const eyebrowOpacity = interpolate(
    frame,
    [0, toFrames(0.3)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Final reveal — knife at the end.
  const revealLocal = frame - REVEAL_AT;
  const revealOpacity = interpolate(
    revealLocal,
    [0, toFrames(0.22)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const revealY = interpolate(
    revealLocal,
    [0, toFrames(0.22)],
    [22, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      {/* Eyebrow */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: colors.dim,
          opacity: eyebrowOpacity,
        }}
      >
        % extracted by unfair trading
      </div>

      {/* Bars */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          bottom: "22%",
          left: 0,
          right: 0,
          padding: "0 200px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 36,
        }}
      >
        {BARS.map((bar, i) => (
          <BarRow
            key={bar.label}
            bar={bar}
            maxValue={MAX_VALUE}
            delayFrames={i * BAR_STAGGER}
          />
        ))}
      </div>

      {/* Knife — title-font hero treatment */}
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          color: colors.fg,
          lineHeight: 0.95,
          textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          opacity: revealOpacity,
          transform: `translateY(${revealY}px)`,
        }}
      >
        <span style={{ color: colors.dim, marginRight: 24 }}>→</span>
        every market you touched.
      </div>
    </AbsoluteFill>
  );
};

const LABEL_COL = 360;
const VALUE_COL = 240;

const BarRow: React.FC<{
  bar: Bar;
  maxValue: number;
  delayFrames: number;
}> = ({ bar, maxValue, delayFrames }) => {
  const frame = useCurrentFrame();
  const local = frame - delayFrames;

  // Label fades in at row start.
  const labelOpacity = interpolate(
    local,
    [0, toFrames(0.25)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const labelX = interpolate(
    local,
    [0, toFrames(0.3)],
    [-24, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Bar grows from 0 → final width.
  const growT = Math.max(0, Math.min(1, (local - toFrames(0.15)) / BAR_GROW));
  const easedGrow = 1 - Math.pow(1 - growT, 3);
  const widthPct = (bar.value / maxValue) * 100 * easedGrow;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        height: 84,
      }}
    >
      {/* Label */}
      <div
        style={{
          width: LABEL_COL,
          flexShrink: 0,
          fontFamily: monoFont,
          fontSize: 56,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: colors.dim,
          textAlign: "right",
          opacity: labelOpacity,
          transform: `translateX(${labelX}px)`,
        }}
      >
        {bar.label}
      </div>

      {/* Bar */}
      <div
        style={{
          flex: 1,
          height: 36,
          position: "relative",
          background: "rgba(255,59,59,0.06)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${widthPct}%`,
            background: `linear-gradient(90deg, ${colors.accent} 0%, #ff6b4a 100%)`,
            boxShadow: "0 0 24px rgba(255,59,59,0.35)",
          }}
        />
        {/* Tail tick mark */}
        <div
          style={{
            position: "absolute",
            top: -6,
            bottom: -6,
            left: `calc(${widthPct}% - 1px)`,
            width: 2,
            background: colors.fg,
            opacity: easedGrow * 0.7,
          }}
        />
      </div>

      {/* Percentage with zoom-echo */}
      <div
        style={{
          width: VALUE_COL,
          flexShrink: 0,
          textAlign: "left",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: colors.fg,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <ZoomEchoText
          text={bar.displayValue}
          delayFrames={Math.round(BAR_GROW * 0.55)}
          containerLocalFrame={local}
        />
      </div>
    </div>
  );
};

// ─── Zoom-echo text: dollar figure emerges with trailing depth-clones ─────────

const ECHO_COUNT = 5;
const ECHO_GAP_FRAMES = 1.6;
const ZOOM_DURATION = toFrames(0.55);

const ZoomEchoText: React.FC<{
  text: string;
  delayFrames: number;
  containerLocalFrame: number;
}> = ({ text, delayFrames, containerLocalFrame }) => {
  const local = containerLocalFrame - delayFrames;

  if (local < 0) {
    return (
      <span style={{ display: "inline-block", visibility: "hidden" }}>
        {text}
      </span>
    );
  }

  const echoFade = interpolate(
    local,
    [
      ZOOM_DURATION + ECHO_COUNT * ECHO_GAP_FRAMES + toFrames(0.05),
      ZOOM_DURATION + ECHO_COUNT * ECHO_GAP_FRAMES + toFrames(0.35),
    ],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ visibility: "hidden" }}>{text}</span>

      {Array.from({ length: ECHO_COUNT + 1 }).map((_, i) => {
        const f = local - i * ECHO_GAP_FRAMES;
        if (f < 0) return null;

        const t = Math.max(0, Math.min(1, f / ZOOM_DURATION));
        const eased = 1 - Math.pow(1 - t, 4);

        const scale = interpolate(eased, [0, 1], [3.6, 1]);
        const dim = i === 0 ? 1 : Math.pow(0.5, i) * echoFade;
        const op = eased * dim;

        const tint = i === 0 ? colors.fg : i % 2 === 0 ? colors.fg : colors.accent;

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              textAlign: "left",
              transform: `scale(${scale})`,
              transformOrigin: "left center",
              opacity: op,
              color: tint,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </span>
        );
      })}
    </span>
  );
};

export const antiCheatStatMeta = {
  id: "AntiCheatStat",
  component: AntiCheatStat,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
