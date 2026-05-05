import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, ease, easeOut, toFrames } from "./theme";

const SCENE_SECONDS = 7.5;
const STAT_DURATION = toFrames(4);

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <Sequence from={0} durationInFrames={STAT_DURATION + toFrames(0.4)}>
        <StatPanel />
      </Sequence>

      <Sequence from={STAT_DURATION}>
        <ChipsPanel />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Stat panel: 0.01% / arrow / 70% ──────────────────────────────────────────

const StatPanel: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 36], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitStart = STAT_DURATION - toFrames(0.4);
  const exit = interpolate(frame, [exitStart, exitStart + 24], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * (1 - exit);

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

  // Sub-line lands at 2.0s → 2.6s. The hairline rule draws from center outward
  // beneath it over the same window plus a small tail.
  const subLineOpacity = interpolate(
    frame,
    [toFrames(2.0), toFrames(2.6)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const subLineY = interpolate(
    frame,
    [toFrames(2.0), toFrames(2.0) + 36],
    [32, 0],
    {
      easing: easeOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const ruleT = interpolate(
    frame,
    [toFrames(2.4), toFrames(2.4) + 12],
    [0, 1],
    {
      easing: easeOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
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
          fontSize: 30,
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
        <BigNumber value={`${left}%`} subtitle="of traders" tint="#f2f2f2" />
        <ArrowFlow t={arrowT} />
        <BigNumber
          value={`${right}%`}
          subtitle="of all profits"
          tint="#f2f2f2"
        />
      </div>

      {/* 1px hairline rule at 70% vertical, drawing from center outward. */}
      <div
        style={{
          position: "absolute",
          top: "70%",
          left: "50%",
          width: `${ruleT * 100}%`,
          height: 1,
          backgroundColor: colors.rule,
          transform: "translateX(-50%)",
        }}
      />

      {/* Sub-line */}
      <div
        style={{
          position: "absolute",
          bottom: "28%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 64,
          fontWeight: 300,
          letterSpacing: "-0.025em",
          color: colors.fg,
          opacity: subLineOpacity,
          transform: `translateY(${subLineY}px)`,
        }}
      >
        0.01% of cheaters claim 70% of all profits<span style={{ opacity: 0.45 }}>.</span>
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
          fontWeight: 300,
          letterSpacing: "-0.04em",
          color: tint,
          lineHeight: 0.95,
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
  // Single 2px white line drawing across, with a chevron snap at the end.
  const length = 220;
  const drawn = Math.max(0, Math.min(length, length * t));
  const headOpacity = t > 0.92 ? 1 : 0;
  return (
    <svg width={length + 40} height={120} style={{ overflow: "visible" }}>
      <line
        x1={0}
        y1={60}
        x2={drawn}
        y2={60}
        stroke={colors.fg}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <g opacity={headOpacity}>
        <line
          x1={length - 14}
          y1={60 - 14}
          x2={length}
          y2={60}
          stroke={colors.fg}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={length - 14}
          y1={60 + 14}
          x2={length}
          y2={60}
          stroke={colors.fg}
          strokeWidth={2}
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

  // Closing pull-quote lands at 1.4s → 2.0s. The underline beneath
  // "nearly none" draws from center outward over 14 frames after it lands.
  const quoteOpacity = interpolate(
    frame,
    [toFrames(1.4), toFrames(2.0)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const quoteY = interpolate(
    frame,
    [toFrames(1.4), toFrames(1.4) + 36],
    [32, 0],
    {
      easing: easeOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const underlineT = interpolate(
    frame,
    [toFrames(2.0), toFrames(2.0) + 14],
    [0, 1],
    {
      easing: easeOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

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
          fontSize: 30,
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
          gap: 56,
          padding: "0 96px",
          flexWrap: "wrap",
        }}
      >
        {CHIPS.map((label, i) => {
          const at = toFrames(0.18 * i + 0.05);
          const local = frame - at;
          const t = interpolate(local, [0, 36], [0, 1], {
            easing: easeOut,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(t, [0, 1], [32, 0]);
          const opacity = t;
          return (
            <div
              key={label}
              style={{
                fontFamily: monoFont,
                fontSize: 56,
                fontWeight: 500,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: colors.dim,
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* Closing pull-quote */}
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 64,
          fontWeight: 400,
          letterSpacing: "-0.025em",
          color: colors.fg,
          opacity: quoteOpacity,
          transform: `translateY(${quoteY}px)`,
        }}
      >
        Leaving you with{" "}
        <span
          style={{
            color: colors.fg,
            position: "relative",
            display: "inline-block",
          }}
        >
          nearly none.
          <span
            style={{
              position: "absolute",
              left: "50%",
              bottom: -8,
              width: `${underlineT * 100}%`,
              height: 1,
              backgroundColor: colors.fg,
              transform: "translateX(-50%)",
            }}
          />
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const antiCheatAppleStatMeta = {
  id: "AntiCheatAppleStat",
  component: AntiCheatStat,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
