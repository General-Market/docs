import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  staticFile,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { toFrames } from "../theme";

/* ─── Timing ─── */

interface BarConfig {
  startSec: number;
  holdSec: number;
  stats: StatDef[];
}

interface StatDef {
  label: string;
  value: string;
  /** If set, animate from 0 to this number instead of showing static text */
  countTo?: number;
  countDuration?: number; // frames — defaults to 40
  prefix?: string;
  suffix?: string;
  /** Override color for the value */
  color?: string;
  /** Override opacity for the value */
  dimmed?: boolean;
  /** Larger hero number */
  hero?: boolean;
}

const BAR_CONFIGS: BarConfig[] = [
  {
    startSec: 53.76,
    holdSec: 6,
    stats: [
      {
        label: "Exclusive Markets",
        value: "500,000",
        countTo: 500000,
        countDuration: 50,
        hero: true,
      },
      { label: "Settlement", value: "10 min" },
      { label: "Fees", value: "$0", prefix: "$", countTo: 0 },
      { label: "Liquidity", value: "Parimutuel" },
    ],
  },
  {
    startSec: 97.92,
    holdSec: 8,
    stats: [
      {
        label: "Stations",
        value: "30",
        countTo: 30,
        countDuration: 35,
        hero: true,
      },
      { label: "Question", value: '"Will delay increase in 10 min?"' },
      { label: "Window", value: "10 min" },
      {
        label: "Computations",
        value: "30x",
        countTo: 30,
        suffix: "x",
        countDuration: 35,
      },
    ],
  },
  {
    startSec: 212.12,
    holdSec: 5,
    stats: [
      {
        label: "Traditional PM",
        value: "<100 pos/day",
        dimmed: true,
      },
      {
        label: "General Market",
        value: ">10,000,000 pos/day",
        countTo: 10000000,
        countDuration: 55,
        prefix: ">",
        suffix: " pos/day",
        color: "#00C853",
        hero: true,
      },
      {
        label: "Ratio",
        value: "100,000x",
        countTo: 100000,
        suffix: "x",
        countDuration: 50,
        color: "#00C853",
      },
    ],
  },
  {
    startSec: 266.24,
    holdSec: 5,
    stats: [
      {
        label: "Target Markets",
        value: "1,000,000,000",
        countTo: 1000000000,
        countDuration: 60,
        hero: true,
      },
      {
        label: "Sources",
        value: "47+",
        countTo: 47,
        suffix: "+",
        countDuration: 30,
      },
      {
        label: "Batch Types",
        value: "14+",
        countTo: 14,
        suffix: "+",
        countDuration: 25,
      },
      { label: "Status", value: "LIVE", color: "#00C853" },
    ],
  },
];

/* ─── Animated Counter ─── */

const AnimatedValue: React.FC<{
  stat: StatDef;
  localFrame: number;
  fps: number;
  staggerDelay: number;
}> = ({ stat, localFrame, fps, staggerDelay }) => {
  const delayedFrame = localFrame - staggerDelay;

  if (stat.countTo !== undefined && stat.countTo > 0) {
    const dur = stat.countDuration ?? 40;
    const rawValue = interpolate(delayedFrame, [0, dur], [0, stat.countTo], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    const display = Math.round(rawValue);
    const formatted = display.toLocaleString();
    return (
      <span>
        {stat.prefix ?? ""}
        {formatted}
        {stat.suffix ?? ""}
      </span>
    );
  }

  // Static value — fade in
  const opacity = interpolate(delayedFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <span style={{ opacity }}>{stat.value}</span>;
};

/* ─── Single Stats Bar ─── */

const StatsBar: React.FC<{
  config: BarConfig;
}> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const holdFrames = toFrames(config.holdSec);
  const fadeInFrames = 12;
  const fadeOutFrames = 10;

  // Slide up entrance
  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 140, mass: 0.7 },
    durationInFrames: 20,
  });

  const translateY = interpolate(enterProgress, [0, 1], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade in
  const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out
  const fadeOutStart = holdFrames - fadeOutFrames;
  const fadeOut = interpolate(
    frame,
    [fadeOutStart, holdFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          backgroundColor: "#000000",
          width: "100%",
          padding: "20px 48px",
          display: "flex",
          alignItems: "flex-end",
          gap: 56,
          transform: `translateY(${translateY}px)`,
          opacity: Math.max(0, opacity),
          fontFamily: font,
        }}
      >
        {config.stats.map((stat, i) => {
          const staggerDelay = i * 4;

          // Per-stat slide up
          const statEnter = spring({
            frame: frame - staggerDelay,
            fps,
            config: { damping: 20, stiffness: 160, mass: 0.5 },
            durationInFrames: 15,
          });

          const statY = interpolate(statEnter, [0, 1], [24, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const statOpacity = interpolate(
            frame - staggerDelay,
            [0, 10],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          const valueFontSize = stat.hero ? 42 : 32;

          return (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                transform: `translateY(${statY}px)`,
                opacity: statOpacity,
                flexShrink: stat.label === "Question" ? 0 : 1,
              }}
            >
              {/* Micro label */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "rgba(255, 255, 255, 0.7)",
                  marginBottom: 4,
                  fontFamily: font,
                  whiteSpace: "nowrap",
                }}
              >
                {stat.label}
              </span>

              {/* Stat value */}
              <span
                style={{
                  fontSize: valueFontSize,
                  fontWeight: 900,
                  fontFamily: stat.countTo !== undefined ? monoFont : font,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.03em",
                  color: stat.dimmed
                    ? "rgba(255, 255, 255, 0.35)"
                    : stat.color ?? "#FFFFFF",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                }}
              >
                <AnimatedValue
                  stat={stat}
                  localFrame={frame - staggerDelay}
                  fps={fps}
                  staggerDelay={0}
                />
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Full-Duration Overlay ─── */

export const StatsBarOverlays: React.FC = () => {
  return (
    <AbsoluteFill>
      {BAR_CONFIGS.map((config) => {
        const startFrame = toFrames(config.startSec);
        const durationFrames = toFrames(config.holdSec);

        return (
          <React.Fragment key={config.startSec}>
            <Sequence from={startFrame} durationInFrames={durationFrames}>
              <StatsBar config={config} />
            </Sequence>

            {/* SFX: metric-count-up when bar enters */}
            <Sequence from={startFrame} durationInFrames={60}>
              <Audio
                src={staticFile("sfx/metric-count-up.mp3")}
                volume={0.4}
              />
            </Sequence>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
